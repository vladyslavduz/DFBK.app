/** Read-only owner-scoped draft projections. Not an HTTP/auth/approval boundary. */
import { createPublicationPackage, type PackageDraft, type TargetKind } from './scheduler-package';
import { validInstant, type Channel, type ScheduleTime } from './scheduler-contract';
import type { PackageDatabase } from './scheduler-package-store';
type ReadonlyDeep<T> = T extends object ? {readonly [K in keyof T]: ReadonlyDeep<T[K]>} : T;
type ItemSummary={id:string;channel:Channel;targetKind:TargetKind;timeSource:'common'|'override';time:ScheduleTime;status:'draft'};
export type PackageSummary=ReadonlyDeep<{id:string;projectId:string;version:1;status:'draft';createdAt:number;commonTime:ScheduleTime;itemCount:number;earliestAt:number;latestAt:number;items:ItemSummary[]}>;
export type PackageDetail=ReadonlyDeep<Omit<PackageSummary,'items'>&{items:(ItemSummary&{caption:string;media:{id:string;role:'original'|'optimized';mimeType:string}})[]}>;
export type PackageReadResult<T>={status:'ok';data:T;cannotDispatch:true}|{status:'invalid'|'not_found'|'integrity_error'|'too_large'|'unavailable';cannotDispatch:true};
type Cursor={createdAt:number;id:string};
export type PackageList=ReadonlyDeep<{packages:PackageSummary[];nextCursor:Cursor|null}>;
const validReadId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const readError=(status:'invalid'|'not_found'|'integrity_error'|'too_large'|'unavailable')=>({status,cannotDispatch:true as const});
function freezeView<T>(v:T):ReadonlyDeep<T>{if(v&&typeof v==='object'){for(const child of Object.values(v))freezeView(child);Object.freeze(v);}return v as ReadonlyDeep<T>;}
function readRecord(v:unknown,required:readonly string[],optional:readonly string[]=[]):Record<string,unknown>|null{
 if(!v||typeof v!=='object'||Array.isArray(v))return null;
 if(Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)return null;
 const out:Record<string,unknown>=Object.create(null);
 for(const k of Reflect.ownKeys(v)){
  if(typeof k!=='string'||(!required.includes(k)&&!optional.includes(k)))return null;
  const d=Object.getOwnPropertyDescriptor(v,k)!;
  if(!Object.hasOwn(d,'value')||!d.enumerable)return null;
  out[k]=d.value;
 }
 return required.every(k=>Object.hasOwn(out,k))?out:null;
}
const headerReadKeys=['id','user_id','project_id','request_key','draft_identity','payload_json','item_count','created_at_ms','receipt_complete','receipt_key'];
const childReadKeys=['id','package_id','user_id','project_id','position','channel','connection_id','destination_id','target_kind','draft_json'];
const headerReadSelect='SELECT p.id,p.user_id,p.project_id,p.request_key,p.draft_identity,p.payload_json,p.item_count,p.created_at_ms,r.complete AS receipt_complete,r.request_key AS receipt_key FROM publication_package_drafts p LEFT JOIN publication_package_draft_receipts r ON r.package_id=p.id AND r.user_id=p.user_id AND r.project_id=p.project_id';
const childReadSelect='SELECT i.id,i.package_id,i.user_id,i.project_id,i.position,i.channel,i.connection_id,i.destination_id,i.target_kind,i.draft_json FROM publication_package_draft_items i JOIN publication_package_drafts p ON p.id=i.package_id AND p.user_id=i.user_id AND p.project_id=i.project_id';
const readOwnerScope='p.user_id=?1 AND EXISTS(SELECT 1 FROM projects WHERE id=p.project_id AND user_id=p.user_id)';
const detailHeaderSql=headerReadSelect+' WHERE '+readOwnerScope+' AND p.id=?2';
const detailChildrenSql=childReadSelect+' WHERE '+readOwnerScope+' AND p.id=?2 ORDER BY i.position';
const pageReadCte='WITH selected AS (SELECT p.id FROM publication_package_drafts p WHERE '+readOwnerScope+' AND (?2=\'\' OR p.project_id=?2) AND (?3=0 OR p.created_at_ms<?4 OR (p.created_at_ms=?4 AND p.id<?5)) ORDER BY p.created_at_ms DESC,p.id DESC LIMIT ?6) ';
const listHeaderSql=pageReadCte+headerReadSelect+' JOIN selected s ON s.id=p.id ORDER BY p.created_at_ms DESC,p.id DESC';
const listChildrenSql=pageReadCte+childReadSelect+' JOIN selected s ON s.id=p.id ORDER BY i.package_id,i.position';
function readRows(batch:unknown,index:number):unknown[]{
 if(!Array.isArray(batch)||batch.length!==2)throw Error('INVALID_READ_BATCH');
 const r=batch[index];if(!r||typeof r!=='object'||!Array.isArray(r.results))throw Error('INVALID_READ_ROWS');return r.results;
}
function ownedRow(v:unknown,keys:readonly string[],owner:string):Record<string,unknown>{
 if(!v||typeof v!=='object')throw Error('INVALID_READ_OWNER');
 // Owner metadata is checked before any private serialized payload is read.
 const d=Object.getOwnPropertyDescriptor(v,'user_id');
 if(!d||!Object.hasOwn(d,'value')||d.value!==owner)throw Error('INVALID_READ_OWNER');
 const row=readRecord(v,keys);if(!row)throw Error('INVALID_READ_ROW');return row;
}
function storedTimeInput(v:any){return {localDateTime:v?.localDateTime,timezone:v?.timezone,utcOffset:v?.utcOffset,confirmed:true};}
class PackageReadBudgetError extends Error {}
function decodeReadRows(headerRows:unknown[],childRows:unknown[],owner:string):{draft:PackageDraft;createdAt:number}[]{
 if(headerRows.length>21||childRows.length>21000)throw Error('READ_BOUND');
 const headers=headerRows.map(v=>ownedRow(v,headerReadKeys,owner));
 let serializedUnits=0;
 for(const h of headers){for(const key of ['payload_json','draft_identity'])if(typeof h[key]==='string'){const length=(h[key] as string).length;if(length>1024*1024)throw new PackageReadBudgetError();serializedUnits+=length;}}
 const byId=new Map<string,Record<string,unknown>[]>();
 for(const h of headers){if(!validReadId(h.id)||!validReadId(h.project_id)||byId.has(h.id))throw Error('HEADER_ID');byId.set(h.id,[]);}
 for(const value of childRows){const row=ownedRow(value,childReadKeys,owner);const items=typeof row.package_id==='string'?byId.get(row.package_id):undefined;if(!items||!Number.isInteger(row.position)||Number(row.position)<0||Number(row.position)>999)throw Error('ORPHAN_READ_ITEM');if(typeof row.draft_json==='string'){if(row.draft_json.length>1024*1024)throw new PackageReadBudgetError();serializedUnits+=row.draft_json.length;}items.push(row);}
 if(serializedUnits>2*1024*1024)throw new PackageReadBudgetError();
 return headers.map(h=>{
  if(typeof h.payload_json!=='string'||typeof h.draft_identity!=='string'||typeof h.request_key!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(h.request_key)||
     h.receipt_complete!==1||h.receipt_key!==h.request_key||!validInstant(h.created_at_ms)||!Number.isInteger(h.item_count)||Number(h.item_count)<1||Number(h.item_count)>1000)throw Error('INVALID_HEADER');
  const raw=JSON.parse(h.payload_json);
  if(!raw||raw.ownerId!==owner||raw.id!==h.id||raw.projectId!==h.project_id||!Array.isArray(raw.items)||raw.items.length<1||raw.items.length>1000)throw Error('INVALID_PAYLOAD');
  const input={id:raw.id,ownerId:raw.ownerId,projectId:raw.projectId,commonTime:storedTimeInput(raw.commonTime),items:raw.items.map((item:any)=>{
   if(!item||!item.schedule||!['common','override'].includes(item.timeSource))throw Error('INVALID_ITEM');
   return {scheduleId:item.schedule.id,targetKind:item.targetKind,snapshot:item.schedule.snapshot,...(item.timeSource==='override'?{timeOverride:storedTimeInput(item.schedule.time)}:{})};
  })};
  // Validate against the recorded creation clock, not today's planning window.
  const rebuilt=createPublicationPackage(input,h.created_at_ms,raw.policy);if(!rebuilt.ok)throw Error('INVALID_DRAFT');
  const draft=rebuilt.value;
  if(draft.items.some(item=>!validReadId(item.schedule.snapshot.mediaId)))throw Error('INVALID_MEDIA_REFERENCE');
  const items=[...draft.items].sort((a,b)=>a.schedule.id<b.schedule.id?-1:a.schedule.id>b.schedule.id?1:0);
  if(draft.draftIdentity!==h.draft_identity||JSON.stringify({...draft,items})!==h.payload_json||items.length!==h.item_count)throw Error('PAYLOAD_MISMATCH');
  const rows=byId.get(draft.id)!;if(rows.length!==items.length)throw Error('ITEM_COUNT');
  rows.sort((a,b)=>Number(a.position)-Number(b.position));
  rows.forEach((row,i)=>{const item=items[i],s=item.schedule.snapshot;if(row.project_id!==draft.projectId||row.id!==item.schedule.id||row.position!==i||row.channel!==s.channel||row.connection_id!==s.connectionId||row.destination_id!==s.destinationId||row.target_kind!==item.targetKind||row.draft_json!==JSON.stringify(item))throw Error('ITEM_MISMATCH');});
  return {draft,createdAt:h.created_at_ms};
 });
}
function summaryView(draft:PackageDraft,createdAt:number):PackageSummary{
 const times=draft.items.map(i=>i.schedule.time.scheduledAt);
 return freezeView({id:draft.id,projectId:draft.projectId,version:1 as const,status:'draft' as const,createdAt,commonTime:{...draft.commonTime},itemCount:draft.items.length,earliestAt:Math.min(...times),latestAt:Math.max(...times),
  items:draft.items.map(item=>({id:item.schedule.id,channel:item.schedule.snapshot.channel,targetKind:item.targetKind,timeSource:item.timeSource,time:{...item.schedule.time},status:'draft' as const}))});
}
/** Caller owner is supplied by future server authentication. No client owner filter. */
export async function readOwnedPackageDraft(db:PackageDatabase,owner:string,packageId:string):Promise<PackageReadResult<PackageDetail>>{
 if(!validReadId(owner)||!validReadId(packageId))return readError('invalid');
 let batch:unknown;
 try{const session=db.withSession('first-primary');batch=await session.batch([session.prepare(detailHeaderSql).bind(owner,packageId),session.prepare(detailChildrenSql).bind(owner,packageId)]);}catch{return readError('unavailable');}
 try{
  const headers=readRows(batch,0),children=readRows(batch,1);if(headers.length===0&&children.length===0)return readError('not_found');
  if(headers.length!==1)throw Error('DETAIL_COUNT');
  const [{draft,createdAt}]=decodeReadRows(headers,children,owner);
  if(draft.id!==packageId)throw Error('DETAIL_ID');
  const summary=summaryView(draft,createdAt);
  const data=freezeView({...summary,items:draft.items.map(item=>({...summary.items.find(v=>v.id===item.schedule.id)!,caption:item.schedule.snapshot.caption,media:{id:item.schedule.snapshot.mediaId,role:item.schedule.snapshot.mediaRole,mimeType:item.schedule.snapshot.mimeType}}))});
  return {status:'ok',data,cannotDispatch:true};
 }catch(error){return readError(error instanceof PackageReadBudgetError?'too_large':'integrity_error');}
}
/** Bounded keyset list, newest creation first. Not yet a calendar-month API. */
export async function listOwnedPackageDrafts(db:PackageDatabase,owner:string,query:unknown):Promise<PackageReadResult<PackageList>>{
 if(!validReadId(owner))return readError('invalid');
 let limit:number,projectId:string,cursor:Cursor|null;
 try{
  const q=readRecord(query,['limit'],['projectId','cursor']);
  if(!q||!Number.isInteger(q.limit)||Number(q.limit)<1||Number(q.limit)>20)return readError('invalid');
  if(Object.hasOwn(q,'projectId')&&!validReadId(q.projectId))return readError('invalid');
  limit=Number(q.limit);projectId=typeof q.projectId==='string'?q.projectId:'';cursor=null;
  if(Object.hasOwn(q,'cursor')){const c=readRecord(q.cursor,['createdAt','id']);if(!c||!validInstant(c.createdAt)||!validReadId(c.id))return readError('invalid');cursor={createdAt:c.createdAt,id:c.id};}
 }catch{return readError('invalid');}
 let batch:unknown;
 try{const s=db.withSession('first-primary'),values=[owner,projectId,cursor?1:0,cursor?.createdAt??0,cursor?.id??'',limit+1];batch=await s.batch([s.prepare(listHeaderSql).bind(...values),s.prepare(listChildrenSql).bind(...values)]);}catch{return readError('unavailable');}
 try{
  const headers=readRows(batch,0),children=readRows(batch,1);if(headers.length>limit+1)throw Error('PAGE_BOUND');
  const decoded=decodeReadRows(headers,children,owner);
  for(let i=0;i<decoded.length;i++){
   const current=decoded[i];if(projectId&&current.draft.projectId!==projectId)throw Error('FILTER_MISMATCH');
   if(cursor&&(current.createdAt>cursor.createdAt||(current.createdAt===cursor.createdAt&&current.draft.id>=cursor.id)))throw Error('CURSOR_MISMATCH');
   if(i){const previous=decoded[i-1];if(previous.createdAt<current.createdAt||(previous.createdAt===current.createdAt&&previous.draft.id<=current.draft.id))throw Error('PAGE_ORDER');}
  }
  const packages=decoded.slice(0,limit).map(v=>summaryView(v.draft,v.createdAt)),last=packages.at(-1);
  const nextCursor=decoded.length>limit&&last?{createdAt:last.createdAt,id:last.id}:null;
  return {status:'ok',data:freezeView({packages,nextCursor}),cannotDispatch:true};
 }catch(error){return readError(error instanceof PackageReadBudgetError?'too_large':'integrity_error');}
}
