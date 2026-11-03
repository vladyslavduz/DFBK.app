/** Real ephemeral workerd/D1/R2 test. Never reads Wrangler configuration or live credentials. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ts=require('typescript'),{Miniflare,convertV4MiniflareOptions}=require('miniflare');
const root=path.resolve(__dirname,'..');
const names=['lib/scheduler-contract','lib/scheduler-state','lib/scheduler-package','lib/scheduler-package-store','lib/scheduler-package-read','lib/scheduler-project-draft','lib/response','lib/request-security','lib/session','lib/user','routes/scheduler-package-create','routes/scheduler-packages','routes/scheduler-destinations'];
// Preserve module scopes instead of concatenating declarations into one global scope.
const compiled='const __modules={};\n'+names.map(n=>{const code=ts.transpileModule(fs.readFileSync(path.join(root,'worker',n+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const parts=n.split('/');parts.pop();
 return '__modules['+JSON.stringify(n)+']=(()=>{const module={exports:{}};const exports=module.exports;const base='+JSON.stringify(parts.join('/'))+';const require=p=>{const parts=(base+"/"+p).split("/"),out=[];for(const q of parts){if(q==="..")out.pop();else if(q!==".")out.push(q);}return __modules[out.join("/")];};'+code+';return module.exports;})();';
}).join('\n');
const worker=String.raw`export default {async fetch(request,env){
 const b=await request.json(),headers={'Content-Type':'application/json',Origin:b.origin??'https://fixture.invalid','Idempotency-Key':b.key??'fictional_request_01'};
 if(b.actor!==null)headers.Cookie='dfbk_session=fixture_'+(b.actor??'owner');
 const r=new Request('https://fixture.invalid'+(b.path??'/api/scheduler/packages'),{method:b.method??'POST',headers,...((b.method??'POST')==='POST'?{body:JSON.stringify(b.json)}:{})});
 const router=b.path==='/api/scheduler/destinations'?__modules['routes/scheduler-destinations'].handleSchedulerDestinations:__modules['routes/scheduler-packages'].handleSchedulerPackages;
 const response=await router(r,{DB:env.DB,MEDIA:env.MEDIA,SCHEDULER_READ_ENABLED:'true',SCHEDULER_DRAFT_WRITE_ENABLED:b.writeFlag??'true',SCHEDULER_DRAFT_MAX_TARGETS:'4',SCHEDULER_DRAFT_HORIZON_MS:String(4*86400000),SCHEDULER_DRAFT_MAX_MEDIA_BYTES:'1024',SCHEDULER_DRAFT_MAX_CREATES_PER_DAY:b.dayLimit??'100'},new URL(r.url).pathname);
 return Response.json({status:response.status,headers:Object.fromEntries(response.headers),body:await response.json()});
}};`;
function timeAfter(days){
 const at=new Date(Date.now()+days*86400000),parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).map(p=>[p.type,p.value]));
 const localDateTime=parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
 const offset=Math.round((Date.parse(localDateTime+':00Z')-Math.floor(at.getTime()/60000)*60000)/60000);
 return {localDateTime,timezone:'Europe/Berlin',utcOffset:(offset<0?'-':'+')+String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')+':'+String(Math.abs(offset)%60).padStart(2,'0'),confirmed:true};
}
(async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,unsafeRegisterWorker:false,script:compiled+'\n'+worker,compatibilityDate:'2026-09-14',d1Databases:{DB:'dfbk-draft-api-fixture'},r2Buckets:{MEDIA:'dfbk-draft-api-fixture'}}));let passed=0;
 try{
  const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('MEDIA');
  await db.batch(["CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,email_verified INTEGER,role TEXT,plan TEXT,plan_source TEXT,trial_expires_at TEXT,plan_updated_at TEXT,created_at TEXT)","CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,token_hash TEXT,expires_at TEXT,revoked_at TEXT)","CREATE TABLE projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL)","INSERT INTO users VALUES('owner','owner@example.invalid',1,'user','trial','system','2099-01-01 00:00:00',NULL,'2026-01-01'),('other','other@example.invalid',1,'user','trial','system','2099-01-01 00:00:00',NULL,'2026-01-01')","INSERT INTO projects VALUES('project','owner','ready')"].map(sql=>db.prepare(sql)));
  for(const actor of ['owner','other'])await db.prepare('INSERT INTO sessions VALUES(?1,?2,?3,?4,NULL)').bind(actor,actor,crypto.createHash('sha256').update('fixture_'+actor).digest('hex'),'2099-01-01T00:00:00Z').run();
  for(const file of ['database/migrations/2026-09-22-project-media-v1.sql','database/tasks/2026-10-07-social-publishing-v1.sql','database/tasks/2026-11-02-publication-package-drafts.sql','database/tasks/2026-11-03-publication-draft-admissions.sql']){
   const statements=fs.readFileSync(path.join(root,file),'utf8').replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
   await db.batch(statements.map(sql=>db.prepare(sql)));
  }
  const bytes=new TextEncoder().encode('Synthetic fixture, not a provider image');await bucket.put('private/fixture.webp',bytes);
  await db.prepare("INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES('media','project','private/fixture.webp','optimized','image/webp',?1)").bind(bytes.length).run();
  await db.batch(["INSERT INTO social_connections(id,user_id,provider,external_account_id,external_account_name,status) VALUES('ig','owner','instagram','111','Fixture','connected')","INSERT INTO social_connections(id,user_id,provider,external_account_id,external_account_name,status) VALUES('fb','owner','facebook','222','Fixture','connected')"].map(sql=>db.prepare(sql)));
  const json={projectId:'project',mediaId:'media',commonTime:timeAfter(2),targets:[{channel:'instagram',connectionId:'ig',caption:'IG fixture Ä 😀'},{channel:'facebook',connectionId:'fb',caption:'FB fixture',timeOverride:timeAfter(3)}]};
  const call=async(options={})=>{const r=await mf.dispatchFetch('https://fixture.invalid/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({json,...options})});assert.equal(r.status,200);return r.json();};
  const first=await call();assert.equal(first.status,201);assert.equal(first.body.cannotDispatch,true);assert.equal(first.body.replayed,false);assert.equal(first.headers['access-control-allow-origin'],undefined);passed++;
  const read=await call({method:'GET',path:'/api/scheduler/packages/'+first.body.packageId});assert.equal(read.status,200);assert.equal(read.body.package.items.length,2);assert.ok(!JSON.stringify(read.body).includes('private/fixture'));passed++;
  const reordered=structuredClone(json);reordered.targets.reverse();assert.equal((await call({json:reordered})).body.replayed,true);passed++;
  const changed=structuredClone(json);changed.targets[0].caption='Edited';const conflict=await call({json:changed});assert.equal(conflict.status,409);assert.equal(conflict.body.error.code,'SCHEDULER_REQUEST_CONFLICT');passed++;
  const overlapping=await Promise.all([call({key:'fictional_request_02'}),call({key:'fictional_request_02'})]);assert.ok(overlapping.every(r=>r.status===200||r.status===201));assert.equal(overlapping[0].body.packageId,overlapping[1].body.packageId);passed++;
  assert.equal((await call({actor:null})).status,401);assert.equal((await call({actor:'other'})).status,404);passed++;
  assert.equal((await call({origin:'https://other.invalid'})).status,403);assert.equal((await call({writeFlag:'false'})).status,405);passed++;
  const forged={...json,storageKey:'https://example.invalid/asset'};assert.equal((await call({json:forged})).status,400);passed++;
  const destinationRead=await call({method:'GET',path:'/api/scheduler/destinations'});assert.equal(destinationRead.status,200);assert.equal(destinationRead.body.destinations.length,2);passed++;
  const quotaRace=await Promise.all([call({key:'fictional_quota_01',dayLimit:'3'}),call({key:'fictional_quota_02',dayLimit:'3'})]);assert.deepEqual(quotaRace.map(r=>r.status).sort(),[201,429]);assert.equal((await call({dayLimit:'3'})).status,200);passed++;
  await bucket.delete('private/fixture.webp');assert.equal((await call()).status,200);assert.equal((await call({key:'fictional_request_03'})).status,409);passed++;
  await db.prepare('DELETE FROM publication_package_draft_receipts WHERE package_id=?1').bind(first.body.packageId).run();assert.equal((await call()).status,503);passed++;
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM publication_package_drafts').first()).n,3);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM publication_package_draft_items').first()).n,6);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM publication_jobs').first()).n,0);passed++;
  console.log('PASS '+passed+' ephemeral workerd/D1/R2 draft-create API scenarios; zero provider jobs');
 }finally{await mf.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});
