import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),ts=require('typescript'),cache=new Map();
function load(name){if(cache.has(name))return cache.get(name);const mod={exports:{}};
 const source=fs.readFileSync(new URL('../worker/lib/'+name+'.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','module','exports',code)(p=>{assert.ok(p.startsWith('./'));return load(p.slice(2));},mod,mod.exports);cache.set(name,mod.exports);return mod.exports;}
const {prepareProjectPackageDraft:prepare}=load('scheduler-project-draft');
const {savePublicationPackageDraft:save}=load('scheduler-package-store');
const {readOwnedPackageDraft:read}=load('scheduler-package-read');
const now=Date.parse('2027-01-14T11:00:00Z'),key='fictional_request_01';
const policy={maxTargets:4,horizonMs:4*86400000,maxMediaBytes:1024};
const bytes=new TextEncoder().encode('Synthetic fixture bytes; not a provider-valid image.');
const time={localDateTime:'2027-01-15T12:00',timezone:'Europe/Berlin',utcOffset:'+01:00',confirmed:true};
function request(){return {projectId:'project',mediaId:'media',commonTime:{...time},targets:[
 {channel:'instagram',connectionId:'ig',caption:'Instagram fixture\nSecond line'},
 {channel:'facebook',connectionId:'fb',caption:'Facebook fixture',timeOverride:{...time,localDateTime:'2027-01-16T12:00'}}]};}
function harness(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL);');
 db.exec(fs.readFileSync(new URL('../database/migrations/2026-09-22-project-media-v1.sql',import.meta.url),'utf8'));
 db.exec(fs.readFileSync(new URL('../database/tasks/2026-10-07-social-publishing-v1.sql',import.meta.url),'utf8'));
 db.exec(fs.readFileSync(new URL('../database/tasks/2026-11-02-publication-package-drafts.sql',import.meta.url),'utf8'));
 db.exec("INSERT INTO users VALUES('owner'),('other');INSERT INTO projects VALUES('project','owner','ready'),('foreign','other','ready');");
 db.prepare("INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES('media','project','private/fixture.webp','optimized','image/webp',?)").run(bytes.length);
 db.prepare("INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES('foreign_media','foreign','private/other.webp','optimized','image/webp',?)").run(bytes.length);
 const insert=db.prepare("INSERT INTO social_connections(id,user_id,provider,external_account_id,external_account_name,status) VALUES(?,?,?,?,?,'connected')");
 insert.run('ig','owner','instagram','111','Fixture');insert.run('fb','owner','facebook','222','Fixture');insert.run('foreign_ig','other','instagram','333','Fixture');
 const h={db,queries:[],reads:[],writes:0,objectSize:bytes.length,chunks:[bytes],missing:false,cancelled:false,failDb:false,failBucket:false};
 const bindings=values=>Object.fromEntries(values.map((v,i)=>['?'+(i+1),v]));
 const run=s=>db.prepare(s.sql).all(bindings(s.values)).map(row=>({...row}));
 const stmt=sql=>({sql,values:[],bind(...values){return {...this,values};},async all(){h.queries.push(sql);if(h.failDb)throw Error('secret SQL detail');return {results:run(this)};}});
 h.port={withSession(mode){assert.equal(mode,'first-primary');return {prepare:stmt,async batch(statements){if(statements.some(s=>/^INSERT /i.test(s.sql)))h.writes++;db.exec('BEGIN');try{const result=statements.map(s=>({results:run(s)}));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}};
 h.bucket={async get(storageKey){h.reads.push(storageKey);if(h.failBucket)throw Error('secret R2 detail');if(h.missing)return null;return {size:h.objectSize,body:new ReadableStream({start(controller){for(const c of h.chunks)controller.enqueue(c);controller.close();},cancel(){h.cancelled=true;}})};}};
 h.call=(body=request(),owner='owner',requestKey=key,clock=now,p=policy)=>prepare(h.port,h.bucket,owner,requestKey,typeof body==='string'?body:JSON.stringify(body),clock,p);
 return h;
}
async function using(fn){const h=harness();try{await fn(h);}finally{h.db.close();}}
test('resolves owned project/media/connections; distinct captions and override; no sends or writes',()=>using(async h=>{
 const result=await h.call();assert.equal(result.ok,true);const d=result.value;
 assert.equal(d.status,'draft');assert.equal(d.cannotDispatch,true);assert.equal(d.items.length,2);assert.equal(h.writes,0);
 assert.deepEqual(h.reads,['private/fixture.webp']);
 assert.ok(h.queries.every(sql=>!sql.includes('access_token')&&!sql.includes('refresh_token')));
 const ig=d.items[0].schedule,fb=d.items[1].schedule;assert.equal(ig.snapshot.destinationId,'111');assert.equal(fb.snapshot.destinationId,'222');
 assert.equal(ig.snapshot.caption,request().targets[0].caption);assert.equal(fb.snapshot.caption,'Facebook fixture');
 assert.equal(ig.snapshot.mediaSha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(ig.snapshot.mediaBytes,bytes.length);
 assert.equal(ig.approval,null);assert.equal(fb.approval,null);assert.notEqual(ig.time.scheduledAt,fb.time.scheduledAt);assert.ok(Object.isFrozen(d));
 assert.equal(ig.snapshot.connectorVersion,'draft-unverified-v1');assert.equal(ig.snapshot.mediaProfile,'project-image-unverified');
}));
test('rejects forged authority/storage/destination/snapshot fields before DB/R2',()=>using(async h=>{
 for(const [level,extra] of [['root',{ownerId:'other'}],['root',{storageKey:'public.jpg'}],['root',{id:'chosen'}],['target',{destinationId:'injected'}],['target',{snapshot:{}}],['time',{scheduledAt:0}]]){
  const r=request();Object.assign(level==='root'?r:level==='target'?r.targets[0]:r.commonTime,extra);
  assert.equal((await h.call(r)).ok,false);
 }assert.equal(h.queries.length,0);assert.equal(h.reads.length,0);
}));
test('foreign/absent project or media returns same not-found and never reads R2',()=>using(async h=>{
 for(const body of [{...request(),projectId:'foreign',mediaId:'foreign_media'},{...request(),mediaId:'foreign_media'},{...request(),projectId:'absent'}])
  assert.deepEqual(await h.call(body),{ok:false,error:'DRAFT_MATERIAL_NOT_FOUND'});
 assert.deepEqual(await h.call(request(),'other'),{ok:false,error:'DRAFT_MATERIAL_NOT_FOUND'});assert.equal(h.reads.length,0);
}));
test('project not ready, unsupported role/type/size fail closed',()=>using(async h=>{
 h.db.exec("UPDATE projects SET status='processing' WHERE id='project'");assert.equal((await h.call()).error,'DRAFT_PROJECT_NOT_READY');
 h.db.exec("UPDATE projects SET status='ready';UPDATE project_media SET role='thumbnail' WHERE id='media'");assert.equal((await h.call()).error,'DRAFT_MEDIA_UNAVAILABLE');
 h.db.exec("UPDATE project_media SET role='optimized',mime_type='text/html' WHERE id='media'");assert.equal((await h.call()).ok,false);
 h.db.exec("UPDATE project_media SET mime_type='image/webp',size_bytes=2048 WHERE id='media'");assert.equal((await h.call()).ok,false);assert.equal(h.reads.length,0);
}));
test('foreign, wrong-provider, disconnected, absent connections are unavailable',()=>using(async h=>{
 for(const connectionId of ['foreign_ig','fb','absent']){const r=request();r.targets[0].connectionId=connectionId;assert.equal((await h.call(r)).error,'DRAFT_CONNECTION_UNAVAILABLE');}
 h.db.exec("UPDATE social_connections SET status='disconnected' WHERE id='ig'");assert.equal((await h.call()).error,'DRAFT_CONNECTION_UNAVAILABLE');assert.equal(h.reads.length,0);
}));
test('unsupported channels never become fake connections; duplicate targets rejected',()=>using(async h=>{
 for(const channel of ['pinterest','whatsapp','x','linkedin','email','website','google_business']){const r=request();r.targets[0].channel=channel;assert.equal((await h.call(r)).error,'DRAFT_CHANNEL_UNAVAILABLE');}
 const r=request();r.targets.push({...r.targets[0]});assert.equal((await h.call(r)).error,'DUPLICATE_DRAFT_TARGET');assert.equal(h.queries.length,0);
}));
test('bounds request, caption, policy and trusted context before IO',()=>using(async h=>{
 assert.equal((await h.call('x'.repeat(24577))).ok,false);assert.equal((await h.call('{')).ok,false);
 for(const change of [r=>r.targets=[],r=>r.targets[0].caption=' ',r=>r.targets[0].caption='a'.repeat(10001),r=>r.targets[0].caption='bad\u0000']){
  const r=request();change(r);assert.equal((await h.call(r)).ok,false);
 }
 assert.equal((await h.call(request(),'owner','short')).ok,false);
 assert.equal((await h.call(request(),'owner',key,now,{...policy,maxMediaBytes:0})).error,'DRAFT_POLICY_REQUIRED');
 assert.equal((await h.call(request(),'owner',key,now,{...policy,maxMediaBytes:11*1024*1024})).ok,false);
 assert.equal((await h.call(request(),'owner',key,now,{...policy,maxTargets:1})).ok,false);assert.equal(h.queries.length,0);
}));
test('past/horizon/timezone/DST confirmation checked before IO',()=>using(async h=>{
 for(const patch of [{confirmed:false},{utcOffset:'+02:00'},{timezone:'UTC'},{localDateTime:'2027-01-13T12:00'},{localDateTime:'2027-02-15T12:00'}]){
  const r=request();Object.assign(r.commonTime,patch);assert.equal((await h.call(r)).error,'INVALID_DRAFT_TIME');
 }
 const r=request();r.targets[1].timeOverride.confirmed=false;assert.equal((await h.call(r)).ok,false);
 const dst=request();dst.commonTime={...time,localDateTime:'2027-03-28T02:30',utcOffset:'+01:00'};
 assert.equal((await h.call(dst,'owner',key,Date.parse('2027-03-27T10:00Z'))).error,'INVALID_DRAFT_TIME');assert.equal(h.queries.length,0);
}));
test('R2 missing/metadata mismatch/short/overflow streams rejected; exact chunked bytes hashed',()=>using(async h=>{
 h.missing=true;assert.equal((await h.call()).error,'DRAFT_MEDIA_UNAVAILABLE');h.missing=false;
 h.objectSize++;assert.equal((await h.call()).ok,false);h.objectSize=bytes.length;
 h.chunks=[bytes.slice(1)];assert.equal((await h.call()).ok,false);
 h.chunks=[new Uint8Array(bytes.length+1)];assert.equal((await h.call()).ok,false);
 h.chunks=[bytes.slice(0,4),bytes.slice(4)];assert.equal((await h.call()).value.items[0].schedule.snapshot.mediaSha256,createHash('sha256').update(bytes).digest('hex'));
}));
test('stable IDs/order-independent identity; edits and media changes alter frozen content identity',()=>using(async h=>{
 const a=(await h.call()).value,r=request();r.targets.reverse();const b=(await h.call(r)).value;
 assert.equal(a.id,b.id);assert.equal(a.draftIdentity,b.draftIdentity);
 r.targets[0].caption='Edited fixture';const c=(await h.call(r)).value;assert.equal(a.id,c.id);assert.notEqual(a.draftIdentity,c.draftIdentity);
 h.chunks=[new Uint8Array(bytes.length).fill(9)];const d=(await h.call()).value;assert.notEqual(a.draftIdentity,d.draftIdentity);
 assert.equal(a.items[0].schedule.snapshot.caption,request().targets[0].caption);
 assert.notEqual(a.id,(await h.call(request(),'owner','fictional_request_02')).value.id);
}));
test('prepared draft can be atomically saved/read safely; retry replays, changed caption conflicts',()=>using(async h=>{
 const d=(await h.call()).value;
 const toInput=d=>({id:d.id,ownerId:d.ownerId,projectId:d.projectId,commonTime:{localDateTime:d.commonTime.localDateTime,timezone:d.commonTime.timezone,utcOffset:d.commonTime.utcOffset,confirmed:true},items:d.items.map(i=>({scheduleId:i.schedule.id,targetKind:i.targetKind,snapshot:i.schedule.snapshot,...(i.timeSource==='override'?{timeOverride:{localDateTime:i.schedule.time.localDateTime,timezone:i.schedule.time.timezone,utcOffset:i.schedule.time.utcOffset,confirmed:true}}:{})}))});
 const input=toInput(d);
 assert.equal((await save(h.port,'owner',key,input,now,{maxTargets:policy.maxTargets,horizonMs:policy.horizonMs})).status,'saved');
 assert.equal((await save(h.port,'owner',key,input,now+1,{maxTargets:policy.maxTargets,horizonMs:policy.horizonMs})).status,'replayed');
 const result=await read(h.port,'owner',d.id);assert.equal(result.status,'ok');assert.equal(result.cannotDispatch,true);
 const publicJson=JSON.stringify(result.data);assert.ok(!publicJson.includes('private/fixture'));assert.ok(!publicJson.includes('draftIdentity'));assert.ok(!publicJson.includes('destinationId'));
 const r=request();r.targets[0].caption='Changed';const changed=toInput((await h.call(r)).value);
 assert.equal((await save(h.port,'owner',key,changed,now,{maxTargets:policy.maxTargets,horizonMs:policy.horizonMs})).status,'conflict');
 assert.equal(h.writes,1);
}));
test('errors have fixed safe codes and no infrastructure details',()=>using(async h=>{
 h.failDb=true;assert.deepEqual(await h.call(),{ok:false,error:'DRAFT_PREPARATION_UNAVAILABLE'});h.failDb=false;h.failBucket=true;
 assert.deepEqual(await h.call(),{ok:false,error:'DRAFT_PREPARATION_UNAVAILABLE'});
}));
