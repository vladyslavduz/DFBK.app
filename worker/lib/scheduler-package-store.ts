/** Injected draft-store only. Caller supplies auth/material checks; no approval or runner. */
import { createPublicationPackage } from './scheduler-package';
import { validInstant } from './scheduler-contract';
type Row = Record<string, unknown>;
export interface PackageStatement {
 bind(...values: (string | number)[]): PackageStatement;
 all(): Promise<{results: Row[]}>;
}
export interface PackageSession {
 prepare(sql: string): PackageStatement;
 batch(statements: PackageStatement[]): Promise<unknown>;
}
export interface PackageDatabase { withSession(mode: 'first-primary'): PackageSession; }
export type PackageStoreResult = {
 status: 'saved'|'replayed'|'conflict'|'not_found'|'uncertain'|'integrity_error'|'invalid'|'rate_limited';
 cannotDispatch: true; packageId?: string;
};
const result = (status: PackageStoreResult['status'], packageId?: string): PackageStoreResult =>
 packageId === undefined ? {status,cannotDispatch:true} : {status,cannotDispatch:true,packageId};
const owned = 'SELECT id FROM projects WHERE id=?1 AND user_id=?2';
const read = [
 'SELECT p.id,p.user_id,p.project_id,p.request_key,p.draft_identity,p.payload_json,p.item_count,p.created_at_ms,',
 'r.complete,r.request_key AS receipt_key,i.id AS item_id,i.position,i.draft_json,i.channel,i.connection_id,i.destination_id,i.target_kind',
 'FROM publication_package_drafts p',
 'LEFT JOIN publication_package_draft_receipts r ON r.package_id=p.id AND r.user_id=p.user_id AND r.project_id=p.project_id',
 'LEFT JOIN publication_package_draft_items i ON i.package_id=p.id AND i.user_id=p.user_id AND i.project_id=p.project_id',
 'WHERE p.user_id=?1 AND p.request_key=?2 AND EXISTS(SELECT 1 FROM projects WHERE id=p.project_id AND user_id=p.user_id)',
 'ORDER BY i.position'
].join(' ');
const insertPackage = [
 'INSERT INTO publication_package_drafts(id,user_id,project_id,request_key,draft_identity,payload_json,item_count,created_at_ms)',
 'SELECT ?1,?2,?3,?4,?5,?6,?7,?8 WHERE EXISTS(SELECT 1 FROM projects WHERE id=?3 AND user_id=?2)',
 'ON CONFLICT(user_id,request_key) DO NOTHING'
].join(' ');
const insertItem = [
 'INSERT INTO publication_package_draft_items(id,package_id,user_id,project_id,position,channel,connection_id,destination_id,target_kind,draft_json)',
 'SELECT ?1,p.id,p.user_id,p.project_id,?2,?3,?4,?5,?6,?7 FROM publication_package_drafts p',
 'WHERE p.id=?8 AND p.user_id=?9 AND p.request_key=?10 AND p.draft_identity=?11',
 'ON CONFLICT(id) DO NOTHING'
].join(' ');
// Unconditional final assertion: a missing header/child aborts the transaction.
const complete = [
 'INSERT INTO publication_package_draft_receipts(package_id,user_id,project_id,request_key,complete)',
 'VALUES (?1,?2,?3,?4,(SELECT CASE WHEN p.draft_identity=?5 AND p.payload_json=?6 AND p.item_count=?7',
 'AND (SELECT COUNT(*) FROM publication_package_draft_items i WHERE i.package_id=p.id)=?7',
 'AND EXISTS(SELECT 1 FROM projects WHERE id=p.project_id AND user_id=p.user_id)',
 'THEN 1 ELSE 0 END FROM publication_package_drafts p WHERE p.id=?1 AND p.user_id=?2 AND p.project_id=?3 AND p.request_key=?4))',
 'ON CONFLICT(package_id) DO NOTHING'
].join(' ');

/** Owner must come from future server authentication, not the request body.
 * Validates project ownership only, not destination grants or R2 material truth.
 */
export async function savePublicationPackageDraft(db: PackageDatabase, authenticatedOwnerId: string, requestKey: string,
 input: unknown, now: number, policy: unknown, maxCreatesPerDay?: number): Promise<PackageStoreResult> {
 if(typeof authenticatedOwnerId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(authenticatedOwnerId)||
    typeof requestKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(requestKey)) return result('invalid');
 if(maxCreatesPerDay!==undefined&&(!Number.isSafeInteger(maxCreatesPerDay)||maxCreatesPerDay<1))return result('invalid');
 const checked=createPublicationPackage(input,now,policy);
 if(!checked.ok||checked.value.ownerId!==authenticatedOwnerId) return result('invalid');
 const draft=checked.value;
 const items=[...draft.items].sort((a,b)=>a.schedule.id<b.schedule.id?-1:a.schedule.id>b.schedule.id?1:0);
 const payload=JSON.stringify({...draft,items});
 const itemJson=items.map(item=>JSON.stringify(item));
 type Observation='absent'|'match'|'conflict'|'corrupt';
 async function observe(session: PackageSession): Promise<Observation> {
  const response=await session.prepare(read).bind(authenticatedOwnerId,requestKey).all();
  if(!Array.isArray(response.results))return 'corrupt';
  const rows=response.results;
  if(!rows.length)return 'absent';
  if(rows.some(row=>row.user_id!==authenticatedOwnerId||row.request_key!==requestKey))return 'corrupt';
  if(rows.some(row=>row.id!==draft.id||row.project_id!==draft.projectId||row.draft_identity!==draft.draftIdentity))return 'conflict';
  if(rows.length!==items.length)return 'corrupt';
  for(let i=0;i<rows.length;i++) {
   const row=rows[i];
   if(row.complete!==1||row.receipt_key!==requestKey||row.payload_json!==payload||row.item_count!==items.length||
      !validInstant(row.created_at_ms)||row.created_at_ms>now||row.item_id!==items[i].schedule.id||row.position!==i||row.draft_json!==itemJson[i]||
      row.channel!==items[i].schedule.snapshot.channel||row.connection_id!==items[i].schedule.snapshot.connectionId||
      row.destination_id!==items[i].schedule.snapshot.destinationId||row.target_kind!==items[i].targetKind)return 'corrupt';
  }
  return 'match';
 }
 const observedResult=(observation: Observation): PackageStoreResult|null => observation==='match'?result('replayed',draft.id):
  observation==='conflict'?result('conflict'):observation==='corrupt'?result('integrity_error'):null;
 try {
  const session=db.withSession('first-primary');
  const existing=observedResult(await observe(session));
  if(existing)return existing;
  if(maxCreatesPerDay!==undefined){const prior=await draftRequestAdmission(db,authenticatedOwnerId,requestKey);if(prior==='unavailable')return result('uncertain');if(prior==='used')return observedResult(await observe(db.withSession('first-primary')))||result('conflict');}
  const project=await session.prepare(owned).bind(draft.projectId,authenticatedOwnerId).all();
  if(!Array.isArray(project.results)||project.results.length!==1||project.results[0].id!==draft.projectId)return result('not_found');
  if(maxCreatesPerDay!==undefined){const q=await checkPublicationDraftQuota(db,authenticatedOwnerId,now,maxCreatesPerDay);if(q!=='available')return result(q==='rate_limited'?'rate_limited':'uncertain');}
  const headerSql=maxCreatesPerDay===undefined?insertPackage:insertPackage.replace('ON CONFLICT', 'AND (SELECT COUNT(*) FROM publication_package_draft_admissions WHERE user_id=?2 AND admitted_at_ms>?10)<?9 ON CONFLICT');
  const headerValues:(string|number)[]=[draft.id,authenticatedOwnerId,draft.projectId,requestKey,draft.draftIdentity,payload,items.length,now];
  if(maxCreatesPerDay!==undefined)headerValues.push(maxCreatesPerDay,now-86400000);
  const statements=[session.prepare(headerSql).bind(...headerValues)];
  items.forEach((item,i)=>statements.push(session.prepare(insertItem).bind(item.schedule.id,i,item.schedule.snapshot.channel,
   item.schedule.snapshot.connectionId,item.schedule.snapshot.destinationId,item.targetKind,itemJson[i],draft.id,authenticatedOwnerId,requestKey,draft.draftIdentity)));
  if(maxCreatesPerDay!==undefined)statements.push(session.prepare('INSERT INTO publication_package_draft_admissions(user_id,request_key,package_id,admitted_at_ms) SELECT user_id,request_key,id,created_at_ms FROM publication_package_drafts WHERE id=?1 AND user_id=?2 AND request_key=?3 AND draft_identity=?4 ON CONFLICT(user_id,request_key) DO NOTHING').bind(draft.id,authenticatedOwnerId,requestKey,draft.draftIdentity));
  const receiptSql=maxCreatesPerDay===undefined?complete:complete.replace('THEN 1 ELSE 0','AND EXISTS(SELECT 1 FROM publication_package_draft_admissions a WHERE a.user_id=p.user_id AND a.request_key=p.request_key AND a.package_id=p.id AND a.admitted_at_ms=p.created_at_ms) THEN 1 ELSE 0');
  statements.push(session.prepare(receiptSql).bind(draft.id,authenticatedOwnerId,draft.projectId,requestKey,draft.draftIdentity,payload,items.length));
  try{await session.batch(statements);}
  catch{
   // Receipt lookup only after an ambiguous acknowledgement; never a second write.
   const recovered=await observe(db.withSession('first-primary'));
   const receipt=observedResult(recovered);if(receipt)return receipt;
   if(maxCreatesPerDay!==undefined&&await checkPublicationDraftQuota(db,authenticatedOwnerId,now,maxCreatesPerDay)==='rate_limited')return result('rate_limited');
   return result('uncertain');
  }
  const after=await observe(session);
  return after==='match'?result('saved',draft.id):observedResult(after)||result('integrity_error');
 }catch{return result('uncertain');} // Never expose SQL, identity, recipients or raw errors.
}

/** Owner-indexed rolling window. No product default; caller supplies the approved cap. */
export async function checkPublicationDraftQuota(db:PackageDatabase,owner:string,now:number,max:number):Promise<'available'|'rate_limited'|'unavailable'>{
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(owner)||!validInstant(now)||!Number.isSafeInteger(max)||max<1)return 'unavailable';
 try{const rows=(await db.withSession('first-primary').prepare('SELECT COUNT(*) AS n FROM publication_package_draft_admissions WHERE user_id=?1 AND admitted_at_ms>?2').bind(owner,now-86400000).all()).results;
  if(!Array.isArray(rows)||rows.length!==1||!Number.isSafeInteger(rows[0].n)||Number(rows[0].n)<0)return 'unavailable';
  return Number(rows[0].n)>=max?'rate_limited':'available';
 }catch{return 'unavailable';}
}

export async function draftRequestAdmission(db:PackageDatabase,owner:string,key:string):Promise<'used'|'unused'|'unavailable'>{
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(owner)||!/^[A-Za-z0-9_-]{16,128}$/.test(key))return 'unavailable';
 try{const rows=(await db.withSession('first-primary').prepare('SELECT package_id FROM publication_package_draft_admissions WHERE user_id=?1 AND request_key=?2').bind(owner,key).all()).results;
  return !Array.isArray(rows)||rows.length>1?'unavailable':rows.length===1?'used':'unused';
 }catch{return 'unavailable';}
}
