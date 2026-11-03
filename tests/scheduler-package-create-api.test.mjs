import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url),ts=require('typescript'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../worker'),cache=new Map();
function load(file){file=path.resolve(root,file);assert.ok(file.startsWith(root+path.sep));if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','module','exports',code)(key=>{assert.ok(key.startsWith('.'));return load(path.resolve(path.dirname(file),key+'.ts'));},mod,mod.exports);return mod.exports;}
const worker=load('index.ts').default;
const fixedNow=Date.parse('2027-01-14T11:00:00Z'),originalNow=Date.now;let clock=fixedNow;Date.now=()=>clock;after(()=>{Date.now=originalNow;});
const bytes=new TextEncoder().encode('Synthetic fixture only, not provider-compatible photo');
const time={localDateTime:'2027-01-15T12:00',timezone:'Europe/Berlin',utcOffset:'+01:00',confirmed:true};
const request=()=>({projectId:'project',mediaId:'media',commonTime:{...time},targets:[{channel:'instagram',connectionId:'ig',caption:'IG fixture'},{channel:'facebook',connectionId:'fb',caption:'FB fixture',timeOverride:{...time,localDateTime:'2027-01-16T12:00'}}]});
function fixture(schema=true){
 clock=fixedNow;
 const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,email_verified INTEGER,role TEXT,plan TEXT,plan_source TEXT,trial_expires_at TEXT,plan_updated_at TEXT,created_at TEXT);CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,token_hash TEXT,expires_at TEXT,revoked_at TEXT);CREATE TABLE projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL);");
 for(const id of ['owner','other','admin']){
  db.prepare('INSERT INTO users VALUES(?,?,1,?,?,?,?,NULL,?)').run(id,id+'@example.invalid',id==='admin'?'admin':'user','trial','system','2099-01-01 00:00:00','2026-01-01');
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?,NULL)').run(id,id,createHash('sha256').update('fixture_'+id).digest('hex'),'2099-01-01T00:00:00Z');
 }
 db.exec("INSERT INTO projects VALUES('project','owner','ready'),('foreign','other','ready')");
 for(const p of ['database/migrations/2026-09-22-project-media-v1.sql','database/tasks/2026-10-07-social-publishing-v1.sql',...(schema?['database/tasks/2026-11-02-publication-package-drafts.sql','database/tasks/2026-11-03-publication-draft-admissions.sql']:[])])db.exec(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
 db.prepare("INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES('media','project','private/fixture.webp','optimized','image/webp',?)").run(bytes.length);
 db.prepare("INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES('foreign_media','foreign','private/other.webp','optimized','image/webp',?)").run(bytes.length);
 db.exec("INSERT INTO social_connections(id,user_id,provider,external_account_id,external_account_name,status) VALUES('ig','owner','instagram','111','Fixture','connected'),('fb','owner','facebook','222','Fixture','connected'),('other_ig','other','instagram','333','Fixture','connected')");
 const h={db,logs:[],reads:0,writes:0,lostAck:false,failWrite:false,mediaMissing:false};
 const bindings=s=>Object.fromEntries(s.values.map((v,i)=>['?'+(i+1),v]));
 const run=s=>db.prepare(s.sql).all(bindings(s)).map(r=>({...r}));
 const prepare=sql=>{h.logs.push(sql);return {sql,values:[],bind(...values){return {...this,values};},async first(){return db.prepare(this.sql).get(bindings(this))??null;},async all(){return {results:run(this)};}};};
 const port={prepare,withSession(mode){assert.equal(mode,'first-primary');return this;},async batch(statements){
  const write=statements.some(s=>/^INSERT /i.test(s.sql));if(write)h.writes++;
  db.exec('BEGIN');let committed=false;
  try{if(write&&h.failWrite)throw Error('Private SQL failure');const out=statements.map(s=>({results:run(s)}));db.exec('COMMIT');committed=true;
   if(write&&h.lostAck){h.lostAck=false;throw Error('Lost acknowledgement');}return out;
  }catch(e){if(!committed)db.exec('ROLLBACK');throw e;}
 }};
 h.env={DB:port,MEDIA:{async get(key){h.reads++;assert.equal(key,'private/fixture.webp');return h.mediaMissing?null:{size:bytes.length,body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})};}},SCHEDULER_READ_ENABLED:'true',SCHEDULER_DRAFT_WRITE_ENABLED:'true',SCHEDULER_DRAFT_MAX_TARGETS:'4',SCHEDULER_DRAFT_HORIZON_MS:String(4*86400000),SCHEDULER_DRAFT_MAX_MEDIA_BYTES:'1024',SCHEDULER_DRAFT_MAX_CREATES_PER_DAY:'100'};
 h.call=async(body=request(),options={})=>{
  const headers={Origin:'https://dfbk.fixture','Content-Type':'application/json','Idempotency-Key':'fictional_request_01',...(options.actor===null?{}:{Cookie:'dfbk_session=fixture_'+(options.actor??'owner')}),...options.headers};
  const r=new Request((options.origin??'https://dfbk.fixture')+(options.path??'/api/scheduler/packages'),{method:options.method??'POST',headers,...((options.method??'POST')==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
  return worker.fetch(r,h.env);
 };
 h.count=()=>db.prepare('SELECT COUNT(*) n FROM publication_package_drafts').get().n;
 return h;
}
async function using(fn,schema=true){const h=fixture(schema);try{await fn(h);}finally{h.db.close();clock=fixedNow;}}
const code=async r=>(await r.json()).error?.code;
test('authenticated POST atomically saves a draft; response allowlist and GET private DTO',()=>using(async h=>{
 const r=await h.call();assert.equal(r.status,201);const b=await r.json();assert.deepEqual(Object.keys(b).sort(),['cannotDispatch','ok','packageId','replayed','status'].sort());assert.equal(b.status,'draft');assert.equal(b.cannotDispatch,true);assert.equal(b.replayed,false);assert.equal(h.count(),1);assert.equal(h.writes,1);
 assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(r.headers.get('Vary'),'Cookie');assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
 const read=await h.call(null,{method:'GET',path:'/api/scheduler/packages/'+b.packageId});assert.equal(read.status,200);const detail=await read.json();assert.equal(detail.package.items.length,2);
 const json=JSON.stringify(detail);for(const forbidden of ['storageKey','private/fixture','draftIdentity','request_key','connectionId','destinationId','mediaSha256'])assert.ok(!json.includes(forbidden));
 const rows=h.db.prepare('SELECT draft_json FROM publication_package_draft_items').all();assert.ok(rows.every(r=>JSON.parse(r.draft_json).schedule.approval===null));assert.equal(h.db.prepare('SELECT COUNT(*) n FROM publication_jobs').get().n,0);
}));
test('guest, unknown/revoked/expired sessions cannot write',()=>using(async h=>{
 for(const actor of [null,'absent'])assert.equal((await h.call(request(),{actor})).status,401);
 h.db.exec("UPDATE sessions SET revoked_at='2026-01-01' WHERE id='owner'");assert.equal((await h.call()).status,401);
 h.db.exec("UPDATE sessions SET revoked_at=NULL,expires_at='2000-01-01' WHERE id='owner'");assert.equal((await h.call()).status,401);assert.equal(h.writes,0);assert.equal(h.reads,0);
}));
test('absent write flag keeps historical 405; read flag/policy fail closed without draft queries',()=>using(async h=>{
 for(const flag of [undefined,'false','TRUE']){h.env.SCHEDULER_DRAFT_WRITE_ENABLED=flag;assert.equal((await h.call()).status,405);}
 h.env.SCHEDULER_DRAFT_WRITE_ENABLED='true';h.env.SCHEDULER_READ_ENABLED='false';assert.equal(await code(await h.call()),'SCHEDULER_DISABLED');
 h.env.SCHEDULER_READ_ENABLED='true';h.env.SCHEDULER_DRAFT_MAX_TARGETS=undefined;h.logs=[];assert.equal(await code(await h.call()),'SCHEDULER_POLICY_REQUIRED');assert.ok(!h.logs.some(s=>s.includes('publication_package')));assert.equal(h.reads,0);
}));
test('origin/HTTPS/fetch-site, query, key and media type guards reject before writes',()=>using(async h=>{
 for(const headers of [{Origin:'https://other.invalid'},{Origin:''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await h.call(request(),{headers})).status,403);
 assert.equal((await h.call(request(),{origin:'http://dfbk.fixture',headers:{Origin:'http://dfbk.fixture'}})).status,403);
 assert.equal((await h.call(request(),{path:'/api/scheduler/packages?ownerId=other'})).status,400);
 for(const key of ['','short','a'.repeat(129)])assert.equal(await code(await h.call(request(),{headers:{'Idempotency-Key':key}})),'INVALID_IDEMPOTENCY_KEY');
 assert.equal((await h.call(request(),{headers:{'Content-Type':'text/plain'}})).status,415);
 assert.equal((await h.call('{')).status,400);assert.equal((await h.call(' '.repeat(24577))).status,413);assert.equal(h.writes,0);assert.equal(h.reads,0);
}));
test('root authority and target destination/snapshot injection reject before material reads',()=>using(async h=>{
 for(const extra of [{ownerId:'other'},{storageKey:'injected'},{approval:true}])assert.equal((await h.call({...request(),...extra})).status,400);
 const r=request();r.targets[0].destinationId='injected';assert.equal((await h.call(r)).status,400);assert.equal(h.reads,0);assert.equal(h.writes,0);
}));
test('foreign or absent media/project is indistinguishable; admin has no ownership bypass',()=>using(async h=>{
 for(const r of [{...request(),projectId:'foreign',mediaId:'foreign_media'},{...request(),mediaId:'foreign_media'},{...request(),projectId:'absent'}])assert.equal(await code(await h.call(r)),'DRAFT_MATERIAL_NOT_FOUND');
 for(const actor of ['other','admin'])assert.equal((await h.call(request(),{actor})).status,404);assert.equal(h.reads,0);assert.equal(h.writes,0);
}));
test('unverified email/expired trial cannot create; existing plan rules retained',()=>using(async h=>{
 h.db.exec("UPDATE users SET email_verified=0 WHERE id='owner'");assert.equal(await code(await h.call()),'EMAIL_NOT_VERIFIED');
 h.db.exec("UPDATE users SET email_verified=1,trial_expires_at='2000-01-01 00:00:00' WHERE id='owner'");assert.equal(await code(await h.call()),'PLAN_ACCESS_REQUIRED');assert.equal(h.reads,0);assert.equal(h.writes,0);
 h.db.exec("UPDATE users SET plan='business' WHERE id='owner'");assert.equal((await h.call()).status,201);
}));
test('unsupported channels, duplicate targets, invalid time and unavailable connection/media fail without draft',()=>using(async h=>{
 for(const channel of ['whatsapp','x','website','email','pinterest','linkedin','google_business']){const r=request();r.targets[0].channel=channel;assert.equal(await code(await h.call(r)),'DRAFT_CHANNEL_UNAVAILABLE');}
 const duplicate=request();duplicate.targets.push({...duplicate.targets[0]});assert.equal((await h.call(duplicate)).status,400);
 const past=request();past.commonTime.localDateTime='2027-01-13T12:00';assert.equal((await h.call(past)).status,400);
 const c=request();c.targets[0].connectionId='other_ig';assert.equal(await code(await h.call(c)),'DRAFT_CONNECTION_UNAVAILABLE');
 h.mediaMissing=true;assert.equal(await code(await h.call()),'DRAFT_MEDIA_UNAVAILABLE');assert.equal(h.count(),0);assert.equal(h.writes,0);
}));
test('same selection/key and reordered targets replay without R2 or writes; changes conflict',()=>using(async h=>{
 const first=await (await h.call()).json();h.mediaMissing=true;const reads=h.reads;
 const reordered=request();reordered.targets.reverse();const replay=await h.call(reordered);assert.equal(replay.status,200);assert.equal((await replay.json()).packageId,first.packageId);assert.equal(h.reads,reads);assert.equal(h.writes,1);
 for(const edit of [r=>r.targets[0].caption='Edited',r=>r.mediaId='another',r=>r.commonTime.localDateTime='2027-01-16T12:00',r=>r.targets.pop(),r=>r.targets[0].connectionId='another']){
  const r=request();edit(r);assert.equal(await code(await h.call(r)),'SCHEDULER_REQUEST_CONFLICT');
 }assert.equal(h.writes,1);assert.equal(h.reads,reads);
}));
test('receipt replay survives due time, deleted media and expired entitlement but remains an unapproved draft',()=>using(async h=>{
 const a=await (await h.call()).json();clock=Date.parse('2027-02-01T12:00Z');h.db.exec("DELETE FROM project_media WHERE id='media';UPDATE users SET trial_expires_at='2000-01-01 00:00:00',email_verified=0 WHERE id='owner'");
 const r=await h.call();assert.equal(r.status,200);const b=await r.json();assert.equal(b.packageId,a.packageId);assert.equal(b.replayed,true);assert.equal(b.cannotDispatch,true);assert.equal(h.writes,1);
 assert.equal((await h.call(request(),{headers:{'Idempotency-Key':'fictional_request_02'}})).status,403);
}));
test('lost acknowledgement replays one complete write; overlapping exact requests produce one package',()=>using(async h=>{
 h.lostAck=true;assert.equal((await h.call()).status,200);assert.equal(h.writes,1);assert.equal(h.count(),1);
 const outcomes=await Promise.all([h.call(request(),{headers:{'Idempotency-Key':'fictional_request_02'}}),h.call(request(),{headers:{'Idempotency-Key':'fictional_request_02'}})]);
 assert.ok(outcomes.every(r=>r.status===200||r.status===201));assert.equal(h.count(),2);assert.equal(h.db.prepare('SELECT COUNT(*) n FROM publication_package_draft_receipts').get().n,2);
}));
test('corrupt/incomplete receipt never replays and never overwrites',()=>using(async h=>{
 await h.call();h.db.exec('DELETE FROM publication_package_draft_receipts');const r=await h.call();assert.equal(r.status,503);assert.equal(await code(r),'SCHEDULER_DATA_UNAVAILABLE');assert.equal(h.writes,1);
}));
test('project ownership change removes old receipt access and denies former owner',()=>using(async h=>{
 await h.call();h.db.exec("UPDATE projects SET user_id='other' WHERE id='project'");assert.equal((await h.call()).status,404);assert.equal(h.writes,1);
}));
test('missing draft schema and failed atomic save return fixed errors and no false success',async()=>{
 await using(async h=>{const r=await h.call();assert.equal(r.status,503);assert.ok(!JSON.stringify(await r.json()).includes('SQL'));assert.equal(h.reads,0);},false);
 await using(async h=>{h.failWrite=true;const r=await h.call();assert.equal(r.status,503);assert.equal(await code(r),'SCHEDULER_SAVE_UNCERTAIN');assert.equal(h.count(),0);assert.equal(h.db.prepare('SELECT COUNT(*) n FROM publication_package_draft_items').get().n,0);});
});
test('POST only at root; unsupported methods/preflight keep no CORS and do not mutate',()=>using(async h=>{
 for(const method of ['OPTIONS','PUT','DELETE','HEAD']){const r=await h.call(null,{method});assert.equal(r.status,405);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);}
 assert.equal((await h.call(request(),{path:'/api/scheduler/packages/some-id'})).status,405);assert.equal(h.writes,0);
}));

test('draft destinations remain readable with Social frozen and expose only owned metadata',()=>using(async h=>{
 h.env.SOCIAL_ENABLED='false';h.logs=[];
 const r=await h.call(null,{method:'GET',path:'/api/scheduler/destinations'});assert.equal(r.status,200);const b=await r.json();
 assert.equal(b.scope,'draft_only');assert.equal(b.cannotDispatch,true);assert.deepEqual(b.destinations.map(d=>d.connectionId).sort(),['fb','ig']);
 for(const d of b.destinations)assert.deepEqual(Object.keys(d).sort(),['channel','connectionId','label']);
 const sql=h.logs.find(s=>s.includes('FROM social_connections'));assert.ok(sql.includes('user_id=?1'));assert.ok(!sql.includes('SELECT *')&&!sql.includes('access_token_encrypted')&&!sql.includes('external_account_id'));
 assert.equal(h.writes,0);assert.equal(h.reads,0);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
 assert.equal((await h.call(null,{method:'GET',path:'/api/social/instagram/connect'})).status,503);
}));
test('destinations deny guest/foreign, expire malformed dates, reject mutations and missing schema safely',()=>using(async h=>{
 assert.equal((await h.call(null,{method:'GET',path:'/api/scheduler/destinations',actor:null})).status,401);
 const other=await (await h.call(null,{method:'GET',path:'/api/scheduler/destinations',actor:'other'})).json();assert.deepEqual(other.destinations.map(d=>d.connectionId),['other_ig']);
 h.db.exec("UPDATE social_connections SET token_expires_at='2027-01-13 00:00:00' WHERE id='ig';UPDATE social_connections SET token_expires_at='2027-02-30T12:00:00Z' WHERE id='fb'");
 assert.deepEqual((await (await h.call(null,{method:'GET',path:'/api/scheduler/destinations'})).json()).destinations,[]);
 for(const method of ['POST','OPTIONS','DELETE'])assert.equal((await h.call({}, {method,path:'/api/scheduler/destinations'})).status,405);
 assert.equal((await h.call(null,{method:'GET',path:'/api/scheduler/destinations?user_id=other'})).status,400);
 h.env.SCHEDULER_READ_ENABLED='false';h.logs=[];assert.equal((await h.call(null,{method:'GET',path:'/api/scheduler/destinations'})).status,503);assert.ok(!h.logs.some(s=>s.includes('social_connections')));
 h.env.SCHEDULER_READ_ENABLED='true';h.db.exec('DROP TABLE social_connections');assert.equal(await code(await h.call(null,{method:'GET',path:'/api/scheduler/destinations'})),'SCHEDULER_UNAVAILABLE');assert.equal(h.writes,0);
}));
test('daily creation cap is required, counts only new drafts, and exact replay stays free',()=>using(async h=>{
 h.env.SCHEDULER_DRAFT_MAX_CREATES_PER_DAY=undefined;assert.equal(await code(await h.call()),'SCHEDULER_POLICY_REQUIRED');
 h.env.SCHEDULER_DRAFT_MAX_CREATES_PER_DAY='1';assert.equal((await h.call()).status,201);const reads=h.reads;
 assert.equal((await h.call()).status,200);assert.equal(h.reads,reads);
 const limited=await h.call(request(),{headers:{'Idempotency-Key':'fictional_request_02'}});assert.equal(limited.status,429);assert.equal(await code(limited),'SCHEDULER_DRAFT_RATE_LIMITED');assert.equal(h.reads,reads);assert.equal(h.count(),1);
 clock+=86400000;assert.equal((await h.call(request(),{headers:{'Idempotency-Key':'fictional_request_02'}})).status,201);
}));
