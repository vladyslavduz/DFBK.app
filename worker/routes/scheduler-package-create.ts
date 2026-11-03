import type { Env } from '../lib/env';
import { requireUser, isTrialActive } from '../lib/user';
import { readBoundedJson, requireSameOriginMutation } from '../lib/request-security';
import { parseProjectDraftSelection, prepareProjectPackageDraft, type ProjectDraftSelection, type ProjectDraftPolicy } from '../lib/scheduler-project-draft';
import { readOwnedDraftReceipt } from '../lib/scheduler-package-read';
import { draftRequestAdmission, checkPublicationDraftQuota, savePublicationPackageDraft } from '../lib/scheduler-package-store';
import type { PackageDraft } from '../lib/scheduler-package';

function reply(data:unknown,status:number):Response{
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
const failure=(code:string,status:number)=>reply({ok:false,error:{code}},status);
const success=(id:string,replayed:boolean)=>reply({ok:true,packageId:id,status:'draft',replayed,cannotDispatch:true},replayed?200:201);
function configuredPolicy(env:Env):(ProjectDraftPolicy&{maxCreatesPerDay:number})|null{
 const values=[env.SCHEDULER_DRAFT_MAX_TARGETS,env.SCHEDULER_DRAFT_HORIZON_MS,env.SCHEDULER_DRAFT_MAX_MEDIA_BYTES,env.SCHEDULER_DRAFT_MAX_CREATES_PER_DAY];
 if(values.some(v=>typeof v!=='string'||!/^[1-9][0-9]{0,15}$/.test(v)))return null;
 const [maxTargets,horizonMs,maxMediaBytes,maxCreatesPerDay]=values.map(Number);
 if(![maxTargets,horizonMs,maxMediaBytes,maxCreatesPerDay].every(Number.isSafeInteger)||maxTargets>1000||maxMediaBytes>10*1024*1024)return null;
 return {maxTargets,horizonMs,maxMediaBytes,maxCreatesPerDay};
}
const confirmed=(t:{localDateTime:string;timezone:string;utcOffset:string})=>({localDateTime:t.localDateTime,timezone:t.timezone,utcOffset:t.utcOffset,confirmed:true});
function selectionIdentity(selection:ProjectDraftSelection):string{
 const targets=selection.targets.map(t=>({channel:t.channel,connectionId:t.connectionId,caption:t.caption,...(t.timeOverride?{timeOverride:confirmed(t.timeOverride)}:{})}));
 targets.sort((a,b)=>{const x=JSON.stringify([a.channel,a.connectionId]),y=JSON.stringify([b.channel,b.connectionId]);return x<y?-1:x>y?1:0;});
 return JSON.stringify({projectId:selection.projectId,mediaId:selection.mediaId,commonTime:confirmed(selection.commonTime),targets});
}
function matchesSelection(draft:PackageDraft,selection:ProjectDraftSelection):boolean{
 if(draft.projectId!==selection.projectId||draft.items.some(i=>i.targetKind!=='account'||i.schedule.snapshot.mediaId!==selection.mediaId))return false;
 const saved={projectId:draft.projectId,mediaId:selection.mediaId,commonTime:confirmed(draft.commonTime),targets:draft.items.map(i=>({
  channel:i.schedule.snapshot.channel,connectionId:i.schedule.snapshot.connectionId,caption:i.schedule.snapshot.caption,...(i.timeSource==='override'?{timeOverride:confirmed(i.schedule.time)}:{})
 }))} as ProjectDraftSelection;
 return selectionIdentity(saved)===selectionIdentity(selection);
}
function saveInput(draft:PackageDraft){
 return {id:draft.id,ownerId:draft.ownerId,projectId:draft.projectId,commonTime:confirmed(draft.commonTime),items:draft.items.map(i=>({
  scheduleId:i.schedule.id,targetKind:i.targetKind,snapshot:i.schedule.snapshot,...(i.timeSource==='override'?{timeOverride:confirmed(i.schedule.time)}:{})
 }))};
}
function preparationError(code:string):Response{
 if(code==='DRAFT_MATERIAL_NOT_FOUND')return failure(code,404);
 if(code==='DRAFT_CHANNEL_UNAVAILABLE'||code==='DRAFT_CONNECTION_UNAVAILABLE'||code==='DRAFT_MEDIA_UNAVAILABLE'||code==='DRAFT_PROJECT_NOT_READY')return failure(code,409);
 if(code==='DRAFT_POLICY_REQUIRED'||code==='DRAFT_PREPARATION_UNAVAILABLE')return failure('SCHEDULER_UNAVAILABLE',503);
 return failure('INVALID_DRAFT_REQUEST',400);
}
/** Reached only for POST root with the explicit write flag; never approves or sends. */
export async function handleSchedulerPackageCreate(request:Request,env:Env):Promise<Response>{
 try{
  const actor=await requireUser(request,env);
  if(actor instanceof Response)return failure('NOT_AUTHENTICATED',401);
  if(env.SCHEDULER_DRAFT_WRITE_ENABLED!=='true'||env.SCHEDULER_READ_ENABLED!=='true')return failure('SCHEDULER_DISABLED',503);
  if(requireSameOriginMutation(request))return failure('INVALID_ORIGIN',403);
  if(new URL(request.url).search)return failure('INVALID_DRAFT_REQUEST',400);
  const key=request.headers.get('Idempotency-Key');
  if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))return failure('INVALID_IDEMPOTENCY_KEY',400);
  const policy=configuredPolicy(env);if(!policy)return failure('SCHEDULER_POLICY_REQUIRED',503);
  const body=await readBoundedJson(request,24*1024);
  if(body instanceof Response){
   return failure(body.status===413?'REQUEST_TOO_LARGE':body.status===415?'INVALID_CONTENT_TYPE':'INVALID_JSON',body.status);
  }
  const json=JSON.stringify(body),parsed=parseProjectDraftSelection(json,policy);
  if(!parsed.ok)return preparationError(parsed.error);
  const selection=parsed.value;
  // A committed receipt is a frozen draft, not a request to refresh media or send.
  const replay=async():Promise<Response|null>=>{
   const receipt=await readOwnedDraftReceipt(env.DB,actor.id,key);
   if(receipt.status==='not_found')return null;
   if(receipt.status!=='ok')return failure('SCHEDULER_DATA_UNAVAILABLE',503);
   return matchesSelection(receipt.data.draft,selection)?success(receipt.data.draft.id,true):failure('SCHEDULER_REQUEST_CONFLICT',409);
  };
  const previous=await replay();if(previous)return previous;
  const owned=(await env.DB.withSession('first-primary').prepare('SELECT id FROM projects WHERE id=?1 AND user_id=?2').bind(selection.projectId,actor.id).all()).results;
  if(!Array.isArray(owned)||owned.length!==1||owned[0].id!==selection.projectId)return failure('DRAFT_MATERIAL_NOT_FOUND',404);
  const prior=await draftRequestAdmission(env.DB,actor.id,key);
  if(prior==='unavailable')return failure('SCHEDULER_UNAVAILABLE',503);
  if(prior==='used')return await replay()||failure('SCHEDULER_REQUEST_CONFLICT',409);
  // Historical reads/replays remain allowed, but creating another draft needs an active account.
  if(actor.email_verified!==1)return failure('EMAIL_NOT_VERIFIED',403);
  if(actor.plan!=='business'&&!isTrialActive(actor))return failure('PLAN_ACCESS_REQUIRED',403);
  const now=Date.now();
  const quota=await checkPublicationDraftQuota(env.DB,actor.id,now,policy.maxCreatesPerDay);
  if(quota!=='available')return failure(quota==='rate_limited'?'SCHEDULER_DRAFT_RATE_LIMITED':'SCHEDULER_UNAVAILABLE',quota==='rate_limited'?429:503);
  const prepared=await prepareProjectPackageDraft(env.DB,env.MEDIA,actor.id,key,json,now,policy);
  if(!prepared.ok)return preparationError(prepared.error);
  const saved=await savePublicationPackageDraft(env.DB,actor.id,key,saveInput(prepared.value),now,{maxTargets:policy.maxTargets,horizonMs:policy.horizonMs},policy.maxCreatesPerDay);
  if(saved.status==='saved'||saved.status==='replayed')return success(saved.packageId!,saved.status==='replayed');
  // Covers overlapping requests/lost acknowledgements; never a second write.
  const recovered=await replay();if(recovered)return recovered;
  if(saved.status==='rate_limited')return failure('SCHEDULER_DRAFT_RATE_LIMITED',429);
  if(saved.status==='not_found')return failure('DRAFT_MATERIAL_NOT_FOUND',404);
  if(saved.status==='conflict')return failure('SCHEDULER_REQUEST_CONFLICT',409);
  return failure(saved.status==='uncertain'?'SCHEDULER_SAVE_UNCERTAIN':'SCHEDULER_DATA_UNAVAILABLE',503);
 }catch{return failure('SCHEDULER_UNAVAILABLE',503);}
}
