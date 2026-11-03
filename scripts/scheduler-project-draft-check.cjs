/** Ephemeral workerd/D1/R2 integration. No Wrangler config, live bindings or provider calls. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ts=require('typescript'),{Miniflare,convertV4MiniflareOptions}=require('miniflare');
const root=path.resolve(__dirname,'..');
const names=['scheduler-contract','scheduler-state','scheduler-package','scheduler-project-draft'];
const compiled='const __modules={};\n'+names.map(n=>{const code=ts.transpileModule(fs.readFileSync(path.join(root,'worker/lib',n+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;return '__modules['+JSON.stringify(n)+']=(()=>{const module={exports:{}};const exports=module.exports;const require=p=>__modules[p.slice(2)];'+code+';return module.exports;})();';}).join('\n');
const worker='export default {async fetch(request,env){const b=await request.json();return Response.json(await __modules["scheduler-project-draft"].prepareProjectPackageDraft(env.DB,env.MEDIA,b.owner,b.key,JSON.stringify(b.request),b.now,b.policy));}};';
const now=Date.parse('2027-01-14T11:00:00Z'),policy={maxTargets:4,horizonMs:4*86400000,maxMediaBytes:1024};
const request={projectId:'project',mediaId:'media',commonTime:{localDateTime:'2027-01-15T12:00',timezone:'Europe/Berlin',utcOffset:'+01:00',confirmed:true},targets:[{channel:'instagram',connectionId:'ig',caption:'Synthetic Instagram Ä 😀'},{channel:'facebook',connectionId:'fb',caption:'Synthetic Facebook'}]};
(async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,unsafeRegisterWorker:false,script:compiled+'\n'+worker,compatibilityDate:'2026-09-14',d1Databases:{DB:'dfbk-project-draft-fixture'},r2Buckets:{MEDIA:'dfbk-project-draft-fixture'}}));
 let passed=0;
 try{
  const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('MEDIA');
  await db.batch(["CREATE TABLE users(id TEXT PRIMARY KEY)","CREATE TABLE projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL)","INSERT INTO users VALUES('owner'),('other')","INSERT INTO projects VALUES('project','owner','ready'),('foreign','other','ready')"].map(sql=>db.prepare(sql)));
  for(const file of ['database/migrations/2026-09-22-project-media-v1.sql','database/tasks/2026-10-07-social-publishing-v1.sql']){
   const statements=fs.readFileSync(path.join(root,file),'utf8').replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
   await db.batch(statements.map(sql=>db.prepare(sql)));
  }
  const bytes=new TextEncoder().encode('Synthetic fixture only; not a provider image');
  await bucket.put('private/fixture.webp',bytes);
  await db.prepare("INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES('media','project','private/fixture.webp','optimized','image/webp',?1)").bind(bytes.length).run();
  await db.batch(["INSERT INTO social_connections(id,user_id,provider,external_account_id,external_account_name,status) VALUES('ig','owner','instagram','111','Fixture','connected')","INSERT INTO social_connections(id,user_id,provider,external_account_id,external_account_name,status) VALUES('fb','owner','facebook','222','Fixture','connected')"].map(sql=>db.prepare(sql)));
  const call=async(overrides={})=>{const r=await mf.dispatchFetch('https://fixture.invalid/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:'owner',key:'fictional_request_01',request,now,policy,...overrides})});assert.equal(r.status,200);return r.json();};
  const first=await call();assert.equal(first.ok,true);assert.equal(first.value.cannotDispatch,true);assert.equal(first.value.items[0].schedule.approval,null);
  assert.equal(first.value.items[0].schedule.snapshot.mediaSha256,crypto.createHash('sha256').update(bytes).digest('hex'));passed++;
  const reordered=structuredClone(request);reordered.targets.reverse();assert.equal((await call({request:reordered})).value.draftIdentity,first.value.draftIdentity);passed++;
  assert.equal((await call({owner:'other'})).error,'DRAFT_MATERIAL_NOT_FOUND');passed++;
  const foreign=structuredClone(request);foreign.targets[0].connectionId='absent';assert.equal((await call({request:foreign})).error,'DRAFT_CONNECTION_UNAVAILABLE');passed++;
  const forged={...request,storageKey:'https://example.invalid/asset'};assert.equal((await call({request:forged})).error,'INVALID_DRAFT_REQUEST');passed++;
  await bucket.put('private/fixture.webp',new Uint8Array(bytes.length).fill(42));
  const changed=await call();assert.equal(changed.ok,true);assert.equal(changed.value.id,first.value.id);assert.notEqual(changed.value.draftIdentity,first.value.draftIdentity);passed++;
  await bucket.put('private/fixture.webp',new Uint8Array(bytes.length+1));assert.equal((await call()).error,'DRAFT_MEDIA_UNAVAILABLE');passed++;
  await bucket.delete('private/fixture.webp');assert.equal((await call()).error,'DRAFT_MEDIA_UNAVAILABLE');passed++;
  const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'publication_package%'").all()).results;assert.equal(tables.length,0);
  const jobs=await db.prepare('SELECT COUNT(*) AS count FROM publication_jobs').first();assert.equal(jobs.count,0);passed++;
  console.log('PASS '+passed+' ephemeral workerd/D1/R2 scenarios; no dispatch or draft writes');
 }finally{await mf.dispose();}
})().catch(error=>{console.error(error);process.exitCode=1;});
