const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const ts=require('typescript');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const root=path.resolve(__dirname,'..');
const names=['scheduler-contract','scheduler-state','scheduler-package','scheduler-package-store','scheduler-package-read'];
const compiled=names.map(name=>ts.transpileModule(fs.readFileSync(path.join(root,'worker/lib',name+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import[\s\S]*?;\s*/gm,'')).join('\n');
// Test-only Worker, synthetic fixtures only. It is never added to Wrangler/routes.
const harnessWorker = `export default { async fetch(request,env) {
 const body=await request.json();let writes=0,sessions=[];const reading=body.action==='detail'||body.action==='list';
 const port={withSession(mode){sessions.push(mode);const session=env.DB.withSession(mode);return {
  prepare:sql=>{if(reading&&!sql.startsWith('SELECT ')&&!sql.startsWith('WITH '))throw Error('Unexpected read-path mutation');return session.prepare(sql);},
  async batch(statements){if(reading)return session.batch(statements);writes++;
   if(body.mode==='ownership_change')await env.DB.prepare("UPDATE projects SET user_id='other' WHERE id='project'").run();
   if(body.mode==='skip_child')statements=statements.filter((_,i)=>i!==1);
   if(Number.isInteger(body.failAt))statements=[...statements.slice(0,body.failAt),session.prepare('INSERT INTO fixture_constraint VALUES(1)'),...statements.slice(body.failAt)];
   const response=await session.batch(statements);
   if(body.mode==='lost_ack')throw Error('Synthetic lost acknowledgement');
   return response;
  }
 };}};
 const result=body.action==='detail'?await readOwnedPackageDraft(port,body.owner||'owner',body.packageId||'package'):body.action==='list'?await listOwnedPackageDrafts(port,body.owner||'owner',body.query||{limit:10}):await savePublicationPackageDraft(port,body.owner||'owner',body.key||'fixture_request_01',body.input,body.now,body.policy);
 return Response.json({result,writes,sessions});
}};`;
const now=Date.parse('2027-01-14T11:00:00Z');
const policy={maxTargets:20,horizonMs:4*86400000};
function draft(){return {id:'package',ownerId:'owner',projectId:'project',commonTime:{localDateTime:'2027-01-15T12:00',timezone:'Europe/Berlin',utcOffset:'+01:00',confirmed:true},items:['instagram','facebook'].map(channel=>({scheduleId:'schedule_'+channel,targetKind:'account',snapshot:{projectId:'project',channel,connectionId:'connection_'+channel,destinationId:'destination_'+channel,caption:'Synthetic '+channel+' Ä 😀',mediaId:'fixture_media',mediaRole:'optimized',storageKey:'fixture/photo.jpg',mediaSha256:'a'.repeat(64),mimeType:'image/jpeg',mediaBytes:100,connectorVersion:'fixture-v1',mediaProfile:'photo',executionOwner:'dfbk'}}))};}
(async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,unsafeRegisterWorker:false,script:compiled+'\n'+harnessWorker,compatibilityDate:'2026-09-14',d1Databases:{DB:'dfbk-package-d1-check-fixture'}}));
 let passed=0;
 try{
  const db=await mf.getD1Database('DB');
  // Minimal real parent tables match required production columns, not production data/schema.
  await db.batch(['CREATE TABLE users(id TEXT PRIMARY KEY)','CREATE TABLE projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id))','CREATE TABLE fixture_constraint(id INTEGER PRIMARY KEY)','INSERT INTO fixture_constraint VALUES(1)',"INSERT INTO users VALUES('owner'),('other')"].map(sql=>db.prepare(sql)));
  const ddl=fs.readFileSync(path.join(root,'database/tasks/2026-11-02-publication-package-drafts.sql'),'utf8');
  const statements=ddl.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
  assert.equal(statements.length,3,'Only the three known draft CREATE TABLE statements');
  await db.batch(statements.map(sql=>db.prepare(sql)));
  const tables=['publication_package_drafts','publication_package_draft_items','publication_package_draft_receipts'];
  const rows=async()=>Promise.all(tables.map(async table=>(await db.prepare('SELECT * FROM '+table+' ORDER BY 1').all()).results));
  const reset=async()=>{await db.batch(['DELETE FROM publication_package_draft_receipts','DELETE FROM publication_package_draft_items','DELETE FROM publication_package_drafts','DELETE FROM projects',"INSERT INTO projects VALUES('project','owner'),('foreign','other')"].map(sql=>db.prepare(sql)));};
  const call=async(options={})=>{
   const response=await mf.dispatchFetch('http://fixture.invalid/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:draft(),now,policy,...options})});
   assert.equal(response.status,200);const result=await response.json();assert.equal(result.result.cannotDispatch,true);assert.ok(result.sessions.every(s=>s==='first-primary'));return result;
  };
  const check=async(name,fn)=>{await reset();await fn();passed++;console.log('PASS: '+name);};
  await check('actual Worker module stores package, distinct text/time and complete receipt',async()=>{
   const input=draft();input.items[1].timeOverride={...input.commonTime,localDateTime:'2027-01-16T12:00'};
   const r=await call({input});assert.equal(r.result.status,'saved');assert.equal(r.writes,1);
   const [p,items,receipts]=await rows();assert.equal(p.length,1);assert.equal(items.length,2);assert.equal(receipts[0].complete,1);
   const a=JSON.parse(items[0].draft_json),b=JSON.parse(items[1].draft_json);assert.notEqual(a.schedule.snapshot.caption,b.schedule.snapshot.caption);assert.notEqual(a.schedule.time.scheduledAt,b.schedule.time.scheduledAt);assert.equal(a.schedule.approval,null);
  });
  await check('exact-key replay and reordered checkboxes do not write',async()=>{
   await call();const before=await rows(),input=draft();input.items.reverse();const r=await call({input,now:now+1000});assert.equal(r.result.status,'replayed');assert.equal(r.writes,0);assert.deepEqual(await rows(),before);
  });
  await check('changed text under the same key conflicts without a write',async()=>{await call();const before=await rows(),input=draft();input.items[0].snapshot.caption+=' changed';const r=await call({input});assert.equal(r.result.status,'conflict');assert.equal(r.writes,0);assert.deepEqual(await rows(),before);});
  await check('constraint failure after each possible prefix rolls back the whole D1 batch',async()=>{
   for(const failAt of [0,1,2,3,4]){await reset();const r=await call({failAt});assert.equal(r.result.status,'uncertain');assert.equal(r.writes,1);assert.deepEqual(await rows(),[[],[],[]]);}
  });
  await check('missing child fails final SQL receipt assertion and rolls back',async()=>{const r=await call({mode:'skip_child'});assert.equal(r.result.status,'uncertain');assert.deepEqual(await rows(),[[],[],[]]);});
  await check('lost acknowledgement after real commit recovers receipt with no second batch',async()=>{const r=await call({mode:'lost_ack'});assert.equal(r.result.status,'replayed');assert.equal(r.writes,1);assert.equal(r.sessions.length,2);assert.equal((await rows())[1].length,2);const again=await call();assert.equal(again.result.status,'replayed');assert.equal(again.writes,0);});
  await check('foreign owner/project does not receive a package or create rows',async()=>{const input=draft();input.ownerId='other';const r=await call({owner:'other',input});assert.equal(r.result.status,'not_found');assert.equal(r.writes,0);assert.deepEqual(await rows(),[[],[],[]]);});
  await check('ownership change between read and write invalidates the guarded batch',async()=>{const r=await call({mode:'ownership_change'});assert.equal(r.result.status,'uncertain');assert.deepEqual(await rows(),[[],[],[]]);});
  await check('routing-column corruption is not accepted as a successful replay',async()=>{await call();await db.prepare("UPDATE publication_package_draft_items SET destination_id='corrupt'").run();const r=await call();assert.equal(r.result.status,'integrity_error');assert.equal(r.writes,0);});
  await check('two overlapping Worker requests retain one header, child set and receipt',async()=>{const results=await Promise.all([call(),call()]);for(const r of results)assert.ok(['saved','replayed'].includes(r.result.status));assert.deepEqual((await rows()).map(v=>v.length),[1,2,1]);});
  await check('workerd Intl resolves both explicit autumn offsets for independent targets',async()=>{const input=draft();input.commonTime={localDateTime:'2027-10-31T02:30',timezone:'Europe/Berlin',utcOffset:'+02:00',confirmed:true};input.items[1].timeOverride={...input.commonTime,utcOffset:'+01:00'};const r=await call({input,now:Date.parse('2027-10-30T00:00:00Z')});assert.equal(r.result.status,'saved');const items=(await rows())[1].map(row=>JSON.parse(row.draft_json));assert.equal(Math.abs(items[0].schedule.time.scheduledAt-items[1].schedule.time.scheduledAt),3600000);});
  await check('owner detail remains readable after due date and exposes only safe fields without writes',async()=>{await call();const before=await rows();const r=await call({action:'detail',now:Date.parse('2028-01-01T00:00:00Z')});assert.equal(r.result.status,'ok');assert.equal(r.result.data.status,'draft');assert.equal(r.writes,0);assert.ok(r.result.data.items.every(v=>v.caption.startsWith('Synthetic ')));const text=JSON.stringify(r.result);for(const key of ['fixture/photo.jpg','destination_','connection_','draftIdentity','executionKey','mediaSha256'])assert.ok(!text.includes(key),key);assert.deepEqual(await rows(),before);});
  await check('read-only list uses keyset pagination and omits captions',async()=>{for(const id of ['a','b','c']){const input=draft();input.id=id;input.items.forEach(i=>i.scheduleId=id+'_'+i.scheduleId);assert.equal((await call({input,key:'fixture_request_'+id})).result.status,'saved');}const first=await call({action:'list',query:{limit:2}});assert.equal(first.result.status,'ok');assert.equal(first.writes,0);assert.deepEqual(first.result.data.packages.map(v=>v.id),['c','b']);assert.ok(!JSON.stringify(first.result).includes('caption'));const second=await call({action:'list',query:{limit:2,cursor:first.result.data.nextCursor}});assert.equal(second.result.status,'ok');assert.deepEqual(second.result.data.packages.map(v=>v.id),['a']);assert.equal(second.result.data.nextCursor,null);});
  await check('existing foreign drafts and corrupted routing cannot be read as safe data',async()=>{await call();const denied=await call({action:'detail',owner:'other'});assert.equal(denied.result.status,'not_found');assert.equal(denied.writes,0);const empty=await call({action:'list',owner:'other'});assert.deepEqual(empty.result.data.packages,[]);await db.prepare("UPDATE publication_package_draft_items SET target_kind='corrupt'").run();const broken=await call({action:'detail'});assert.deepEqual(broken.result,{status:'integrity_error',cannotDispatch:true});assert.equal((await call({action:'list'})).result.status,'integrity_error');});
  console.log(JSON.stringify({status:'PASS',groups:passed,runtime:'installed Miniflare 5 local workerd',productionAccess:false,providerCalls:false,storage:'ephemeral SDK temp storage; dispose follows',scope:'single local runtime, not replicas/distributed/live validation'}));
 }finally{await mf.dispose();}
})().catch(error=>{console.error(error);process.exitCode=1;});
