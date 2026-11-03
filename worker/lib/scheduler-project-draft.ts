/** Internal draft preparation for trusted callers. No writes, approval or dispatch. */
import { accept, reject, validInstant, validateScheduleTime, type Result } from './scheduler-contract';
import { createPublicationPackage, type PackageDraft } from './scheduler-package';
import type { PackageDatabase } from './scheduler-package-store';
export interface DraftMediaBucket {
 get(key:string):Promise<{size:number;body:ReadableStream<Uint8Array>}|null>;
}
export type ProjectDraftPolicy={maxTargets:number;horizonMs:number;maxMediaBytes:number};
const opaque=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const exact=(v:unknown,required:string[],optional:string[]=[]) : v is Record<string,unknown> =>
 !!v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const timeKeys=['localDateTime','timezone','utcOffset','confirmed'];
const ownedMedia='SELECT p.id AS project_id,p.status,m.id AS media_id,m.storage_key,m.role,m.mime_type,m.size_bytes FROM projects p JOIN project_media m ON m.project_id=p.id WHERE p.id=?1 AND p.user_id=?2 AND m.id=?3 AND m.media_type=\'image\' LIMIT 1';
const ownedConnection='SELECT id,provider,external_account_id FROM social_connections WHERE id=?1 AND user_id=?2 AND provider=?3 AND status=\'connected\' LIMIT 1';
async function hash(value:BufferSource):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',value))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function identity(parts:string[]):Promise<string>{return hash(new TextEncoder().encode(JSON.stringify(parts)));}

type DraftTime={localDateTime:string;timezone:'Europe/Berlin';utcOffset:string;confirmed:true};
export type ProjectDraftSelection={projectId:string;mediaId:string;commonTime:DraftTime;targets:{channel:'instagram'|'facebook';connectionId:string;caption:string;timeOverride?:DraftTime}[]};
/** Shared bounded selection parser. Calendar window admission is separate, so receipts can replay after due time. */
export function parseProjectDraftSelection(requestJson:string,policy:ProjectDraftPolicy):Result<ProjectDraftSelection>{
 try{
  if(!policy||!Number.isSafeInteger(policy.maxTargets)||policy.maxTargets<1||policy.maxTargets>1000||
   !Number.isSafeInteger(policy.horizonMs)||policy.horizonMs<1||!Number.isSafeInteger(policy.maxMediaBytes)||policy.maxMediaBytes<1||policy.maxMediaBytes>10*1024*1024)return reject('DRAFT_POLICY_REQUIRED');
  if(typeof requestJson!=='string'||requestJson.length>24*1024||new TextEncoder().encode(requestJson).length>24*1024)return reject('INVALID_DRAFT_REQUEST');
  let request:unknown;try{request=JSON.parse(requestJson);}catch{return reject('INVALID_DRAFT_REQUEST');}
  if(!exact(request,['projectId','mediaId','commonTime','targets'])||!opaque(request.projectId)||!opaque(request.mediaId)||
   !Array.isArray(request.targets)||!request.targets.length||request.targets.length>policy.maxTargets)return reject('INVALID_DRAFT_REQUEST');
  const checkTime=(time:unknown)=>{if(!exact(time,timeKeys))return false;const t=validateScheduleTime(time);return t.ok;};
  if(!checkTime(request.commonTime))return reject('INVALID_DRAFT_TIME');
  const targets:Record<string,unknown>[]=[];const selected=new Set<string>();
  for(const target of request.targets){
   if(!exact(target,['channel','connectionId','caption'],['timeOverride'])||!opaque(target.connectionId)||
    typeof target.caption!=='string'||!target.caption.trim()||target.caption.length>10000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(target.caption))return reject('INVALID_DRAFT_REQUEST');
   if(target.channel!=='instagram'&&target.channel!=='facebook')return reject('DRAFT_CHANNEL_UNAVAILABLE');
   if(Object.hasOwn(target,'timeOverride')&&!checkTime(target.timeOverride))return reject('INVALID_DRAFT_TIME');
   const key=JSON.stringify([target.channel,target.connectionId]);if(selected.has(key))return reject('DUPLICATE_DRAFT_TARGET');
   selected.add(key);targets.push(target);
  }
  return accept(request as ProjectDraftSelection);
 }catch{return reject('INVALID_DRAFT_REQUEST');}
}
/** ownerId comes from authentication, requestKey from the bounded HTTP adapter.
 * JSON allows only project/media selectors, captions, connections and confirmed times.
 * Policy must be explicitly supplied by the trusted caller; there are no product defaults.
 * Returned draft contains PRIVATE storage metadata: never serialize it into an HTTP response.
 */
export async function prepareProjectPackageDraft(db:PackageDatabase,bucket:DraftMediaBucket,ownerId:string,requestKey:string,
 requestJson:string,now:number,policy:ProjectDraftPolicy):Promise<Result<PackageDraft>>{
 try{
  if(!opaque(ownerId)||typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(requestKey)||!validInstant(now))return reject('INVALID_DRAFT_CONTEXT');
  const parsed=parseProjectDraftSelection(requestJson,policy);if(!parsed.ok)return parsed;
  const request=parsed.value,targets=request.targets;
  for(const time of [request.commonTime,...targets.flatMap(t=>t.timeOverride?[t.timeOverride]:[])]){
   const checked=validateScheduleTime(time);if(!checked.ok||checked.value.scheduledAt<now||checked.value.scheduledAt-now>policy.horizonMs)return reject('INVALID_DRAFT_TIME');
  }
  const session=db.withSession('first-primary');
  const rows=(await session.prepare(ownedMedia).bind(request.projectId,ownerId,request.mediaId).all()).results;
  if(!Array.isArray(rows)||rows.length!==1)return reject('DRAFT_MATERIAL_NOT_FOUND');
  const media=rows[0];
  if(media.project_id!==request.projectId||media.media_id!==request.mediaId)return reject('DRAFT_MATERIAL_NOT_FOUND');
  if(media.status!=='ready')return reject('DRAFT_PROJECT_NOT_READY');
  if((media.role!=='original'&&media.role!=='optimized')||!['image/jpeg','image/png','image/webp'].includes(String(media.mime_type))||
   typeof media.storage_key!=='string'||!media.storage_key.trim()||media.storage_key.length>1024||/[\u0000-\u001f\u007f]/u.test(media.storage_key)||
   !Number.isSafeInteger(media.size_bytes)||Number(media.size_bytes)<1||Number(media.size_bytes)>policy.maxMediaBytes)return reject('DRAFT_MEDIA_UNAVAILABLE');
  const connections:Record<string,unknown>[]=[];
  for(const target of targets){
   const records=(await session.prepare(ownedConnection).bind(target.connectionId as string,ownerId,target.channel as string).all()).results;
   if(!Array.isArray(records)||records.length!==1)return reject('DRAFT_CONNECTION_UNAVAILABLE');
   const connection=records[0];
   if(connection.id!==target.connectionId||connection.provider!==target.channel||!opaque(connection.external_account_id))return reject('DRAFT_CONNECTION_UNAVAILABLE');
   connections.push(connection);
  }
  // No public URLs or provider fetches: read only the key resolved from the owned DB row.
  const object=await bucket.get(media.storage_key);
  if(!object||object.size!==media.size_bytes)return reject('DRAFT_MEDIA_UNAVAILABLE');
  const bytes=new Uint8Array(object.size);let offset=0;
  const reader=object.body.getReader();
  try{while(true){const chunk=await reader.read();if(chunk.done)break;
   if(!(chunk.value instanceof Uint8Array)||chunk.value.byteLength>bytes.length-offset){await reader.cancel();return reject('DRAFT_MEDIA_UNAVAILABLE');}
   bytes.set(chunk.value,offset);offset+=chunk.value.byteLength;
  }}finally{reader.releaseLock();}
  if(offset!==bytes.length)return reject('DRAFT_MEDIA_UNAVAILABLE');
  const mediaSha256=await hash(bytes);
  const packageId='pkg_'+await identity(['draft-v1',ownerId,requestKey]);
  const items=[];
  for(let i=0;i<targets.length;i++){
   const target=targets[i],connection=connections[i];
   items.push({scheduleId:'sch_'+await identity(['draft-target-v1',ownerId,requestKey,target.channel as string,target.connectionId as string]),targetKind:'account',
    snapshot:{projectId:request.projectId,channel:target.channel,connectionId:connection.id,destinationId:connection.external_account_id,
     caption:target.caption,mediaId:request.mediaId,mediaRole:media.role,storageKey:media.storage_key,mediaSha256,mimeType:media.mime_type,mediaBytes:media.size_bytes,
     connectorVersion:'draft-unverified-v1',mediaProfile:'project-image-unverified',executionOwner:'dfbk'},
    ...(Object.hasOwn(target,'timeOverride')?{timeOverride:target.timeOverride}:{})});
  }
  // Hashing observes bytes, it does NOT pin R2 or prove provider compatibility/grants.
  return createPublicationPackage({id:packageId,ownerId,projectId:request.projectId,commonTime:request.commonTime,items},now,{maxTargets:policy.maxTargets,horizonMs:policy.horizonMs});
 }catch{return reject('DRAFT_PREPARATION_UNAVAILABLE');} // No raw SQL/R2/provider error leaks.
}
