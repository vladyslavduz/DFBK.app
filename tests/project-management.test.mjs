import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { fixture } from './helpers/backend.mjs';

const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { handleProjects } = await vite.ssrLoadModule('/worker/routes/projects.ts');
const { handleProjectGeneration } = await vite.ssrLoadModule('/worker/routes/project-generation.ts');
const { handleProjectImageOptimization, optimizeProjectImageForUser } = await vite.ssrLoadModule('/worker/routes/project-image-optimization.ts');
const { handleEntitlements } = await vite.ssrLoadModule('/worker/routes/entitlements.ts');
const { handleAdmin } = await vite.ssrLoadModule('/worker/routes/admin.ts');
const { default: worker } = await vite.ssrLoadModule('/worker/index.ts');
const originalFetch = globalThis.fetch;
after(async () => { globalThis.fetch = originalFetch; await vite.close(); });

function req(path, actor = 'user', method = 'GET', body) {
  const headers = { ...(actor ? { Cookie: `dfbk_session=${actor}` } : {}), ...(method !== 'GET' ? { Origin: 'https://dfbk.app' } : {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request('https://dfbk.app'+path,{method,headers,...(body !== undefined ? {body:JSON.stringify(body)} : {})});
}
async function create(env, actor = 'user', body = {}) {
  const response=await handleProjects(req('/api/projects',actor,'POST',body),env,'/api/projects');
  return { status:response.status, ...await response.json() };
}
function installMedia(env) {
  const objects = new Map();
  env.MEDIA = {
    async put(key, bytes) { objects.set(key,new Uint8Array(bytes)); },
    async get(key) { const bytes=objects.get(key); return bytes ? {body:bytes,size:bytes.byteLength,arrayBuffer:async()=>bytes.slice().buffer} : null; },
    async delete(key) { objects.delete(key); },
  };
  return objects;
}
async function upload(env,id, useWorker = false) {
  const path=`/api/projects/${id}/media`;
  const form=new FormData();form.set('file',new Blob([new Uint8Array([255,216,255,1,2])],{type:'image/jpeg'}),'original.jpg');
  const request=new Request('https://dfbk.app'+path,{method:'POST',headers:{Cookie:'dfbk_session=user',Origin:'https://dfbk.app'},body:form});
  return useWorker ? worker.fetch(request,env) : handleProjects(request,env,path);
}
async function generate(env,id) {
  const path=`/api/projects/${id}/generate`;
  const response=await handleProjectGeneration(req(path,'user','POST'),env,path);
  return {status:response.status,...await response.json()};
}
function contentResponse(...values) {
  const title = values.length ? values[0] : 'Hochzeitstorte mit Rosen';
  return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({projectTitle:title,googleBusiness:'Google content',socialMedia:'Social content',websiteReference:'Website content'})}]}]});
}
function imageResponse() { return Response.json({output_format:'jpeg',data:[{b64_json:Buffer.from([255,216,255,9,8]).toString('base64')}]}); }
async function withFetch(fn, run) { const previous=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=previous;} }

// SQL is staged as a separate task and tested against legacy fixtures before deployment.
test('SQL TASK preserves meaningful legacy titles and marks existing optimized media completed', async () => {
  const {db,env}=await fixture({applyProjectTask:false});
  db.exec(`INSERT INTO projects(id,user_id,title) VALUES ('legacy','user','Name vom Nutzer'),('pending','user','Neues Projekt');
    INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES ('legacy-image','legacy','private/key','optimized','image/jpeg',5);`);
  db.exec(readFileSync(new URL('../database/tasks/2026-10-06-project-management-trial-v1.sql',import.meta.url),'utf8'));
  assert.deepEqual({...db.prepare("SELECT title,title_source,photo_optimization_state FROM projects WHERE id='legacy'").get()}, {title:'Name vom Nutzer',title_source:'manual',photo_optimization_state:'completed'});
  assert.equal(db.prepare("SELECT title_source FROM projects WHERE id='pending'").get().title_source,'system');
  installMedia(env);env.OPENAI_API_KEY='fixture';
  await withFetch(async()=>{throw new Error('Must not call provider');},async()=>{
    assert.equal((await optimizeProjectImageForUser(env,'user','legacy')).error,'PHOTO_ALREADY_OPTIMIZED');
  });db.close();
});

test('new project has a temporary title, title/date remain separate, list/get expose metadata', async () => {
  const {db,env}=await fixture();
  const created=await create(env,'user',{title:'Legacy frontend title',description:'Cake'});
  assert.equal(created.status,201);assert.equal(created.project.title,'Neues Projekt');assert.equal(created.project.titleSource,'system');
  assert.equal(created.project.photoOptimization.state,'available');assert.ok(created.project.createdAt);
  const path='/api/projects/'+created.project.id;
  const read=await handleProjects(req(path),env,path);assert.equal((await read.json()).project.title,'Neues Projekt');
  const list=await handleProjects(req('/api/projects'),env,'/api/projects');assert.equal((await list.json()).projects[0].titleSource,'system');
  assert.equal((await create(env,null)).status,401);db.close();
});

test('one existing text-generation call supplies German title plus three texts; distinct duplicate fallback', async () => {
  const {db,env}=await fixture();installMedia(env);env.OPENAI_API_KEY='fixture';
  const titles=['Hochzeitstorte mit Rosen','Schokoladentorte','Hochzeitstorte mit Rosen'];
  let calls=0;
  await withFetch(async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);
    assert.ok(body.text.format.schema.required.includes('projectTitle'));assert.ok(body.input[0].content.some(c=>c.type==='input_image'));
    return contentResponse(titles[calls++]);
  },async()=>{
    for (const expected of ['Hochzeitstorte mit Rosen','Schokoladentorte','Hochzeitstorte mit Rosen 2']) {
      const {project}=await create(env);await upload(env,project.id);
      const result=await generate(env,project.id);assert.equal(result.status,200);assert.equal(result.project.title,expected);assert.equal(result.project.titleSource,'auto');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM generated_contents WHERE project_id=?').get(project.id).n,3);
    }
  });assert.equal(calls,3);db.close();
});

test('bad/missing auto titles do not invalidate valid content', async () => {
  for (const title of [null,undefined,'','DFBK Projekt 1','Tolles Projekt','Projekt vom 06.10.2026','<script>','x'.repeat(81)]) {
    const {db,env}=await fixture();installMedia(env);env.OPENAI_API_KEY='fixture';
    const {project}=await create(env);await upload(env,project.id);
    await withFetch(async()=>contentResponse(title),async()=>{
      const result=await generate(env,project.id);assert.equal(result.status,200);assert.equal(result.project.title,'Neues Projekt');assert.equal(result.project.titleSource,'system');
    });db.close();
  }
});

test('manual rename survives GET/reload and regenerate; forbidden/invalid updates rejected', async () => {
  const {db,env}=await fixture();installMedia(env);env.OPENAI_API_KEY='fixture';
  const {project}=await create(env);await upload(env,project.id);const path='/api/projects/'+project.id;
  const rename=await handleProjects(req(path,'user','PATCH',{title:'  Hochzeitstorte Familie Müller  '}),env,path);
  assert.equal(rename.status,200);assert.equal((await rename.json()).project.titleSource,'manual');
  for (const body of [{title:''},{title:'x'.repeat(121)},{title:'<script>'},{title:'a\nb'},{title:'Name',status:'ready'},{description:'Something'}]) assert.equal((await handleProjects(req(path,'user','PATCH',body),env,path)).status,400);
  assert.equal((await handleProjects(req(path,'admin','PATCH',{title:'Foreign rename'}),env,path)).status,404);
  assert.equal((await handleProjects(req(path,null,'PATCH',{title:'Anonymous rename'}),env,path)).status,401);
  const cross=req(path,'user','PATCH',{title:'Invalid origin'});cross.headers.set('Origin','https://evil.example');assert.equal((await handleProjects(cross,env,path)).status,403);
  await withFetch(async()=>contentResponse('Andere Hochzeitstorte'),async()=>assert.equal((await generate(env,project.id)).project.title,'Hochzeitstorte Familie Müller'));
  const read=await handleProjects(req(path),env,path);assert.equal((await read.json()).project.title,'Hochzeitstorte Familie Müller');db.close();
});

test('rename during an in-flight generation wins over the stale generation context', async () => {
  const {db,env}=await fixture();installMedia(env);env.OPENAI_API_KEY='fixture';
  const {project}=await create(env);await upload(env,project.id);
  let unblock,entered;const started=new Promise(r=>entered=r);const wait=new Promise(r=>unblock=r);
  await withFetch(async()=>{entered();await wait;return contentResponse('Auto Torte');},async()=>{
    const running=generate(env,project.id);await started;
    const path='/api/projects/'+project.id;assert.equal((await handleProjects(req(path,'user','PATCH',{title:'Mein eigener Titel'}),env,path)).status,200);
    unblock();const result=await running;assert.equal(result.status,200);assert.equal(result.project.title,'Mein eigener Titel');assert.equal(result.project.titleSource,'manual');
  });db.close();
});

test('Trial creates exactly five including concurrent requests; Business grant permits sixth and usage remains server-side', async () => {
  const {db,env}=await fixture();
  const attempts=await Promise.all(Array.from({length:12},()=>create(env)));
  assert.equal(attempts.filter(x=>x.status===201).length,5);
  for (const denied of attempts.filter(x=>x.status!==201)) {assert.equal(denied.status,403);assert.equal(denied.error,'TRIAL_PROJECT_LIMIT_REACHED');assert.equal(denied.limit,5);}
  const usage=async()=>{const r=await handleEntitlements(req('/api/account/entitlements'),env,'/api/account/entitlements');return r.json();};
  assert.deepEqual((await usage()).usage,{projectsUsed:5,projectsLimit:5});assert.equal((await usage()).features.share,true);
  const path='/api/admin/users/user/plan';assert.equal((await handleAdmin(req(path,'admin','PATCH',{plan:'business'}),env,path)).status,200);
  assert.equal((await create(env)).status,201);assert.deepEqual((await usage()).usage,{projectsUsed:6,projectsLimit:null});
  assert.equal((await handleAdmin(req(path,'admin','PATCH',{plan:'trial'}),env,path)).status,200);
  assert.equal((await create(env)).error,'TRIAL_PROJECT_LIMIT_REACHED');
  const id=db.prepare('SELECT id FROM projects LIMIT 1').get().id;
  assert.notEqual((await handleProjects(req('/api/projects/'+id,'user','DELETE'),env,'/api/projects/'+id)).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,6);db.close();
});

test('one successful optimization per project; original/private reads preserved; reupload cannot bypass completion', async () => {
  const {db,env}=await fixture();const objects=installMedia(env);env.OPENAI_API_KEY='fixture';
  const {project}=await create(env);await upload(env,project.id);let calls=0;
  await withFetch(async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/images/edits');assert.ok(options.signal);calls++;return imageResponse();},async()=>{
    const first=await optimizeProjectImageForUser(env,'user',project.id);assert.equal(first.ok,true);
    assert.equal(db.prepare('SELECT photo_optimization_state FROM projects WHERE id=?').get(project.id).photo_optimization_state,'completed');
    assert.equal((await optimizeProjectImageForUser(env,'user',project.id)).error,'PHOTO_ALREADY_OPTIMIZED');
    assert.equal((await upload(env,project.id)).status,409);
    const path='/api/projects/'+project.id+'/optimize';const response=await handleProjectImageOptimization(req(path,'user','POST'),env,path);assert.equal(response.status,409);assert.equal((await response.json()).error,'PHOTO_ALREADY_OPTIMIZED');
    const mediaPath='/api/projects/'+project.id+'/media';const state=await handleProjectImageOptimization(req(mediaPath),env,mediaPath);const body=await state.json();assert.equal(body.photoOptimization.state,'completed');assert.ok(body.media.original);assert.ok(body.media.optimized);
    for (const media of [body.media.original,body.media.optimized]) {
      const path=mediaPath+'/'+media.id;assert.equal((await handleProjects(req(path),env,path)).status,200);assert.equal((await handleProjects(req(path,'admin'),env,path)).status,404);
    }
  });assert.equal(calls,1);assert.equal(objects.size,2);db.close();
});

test('parallel optimize requests contact provider once and return 409 to the loser', async () => {
  const {db,env}=await fixture();installMedia(env);env.OPENAI_API_KEY='fixture';
  const {project}=await create(env);await upload(env,project.id);let calls=0;
  let entered,unblock;const started=new Promise(r=>entered=r);const wait=new Promise(r=>unblock=r);
  await withFetch(async()=>{calls++;entered();await wait;return imageResponse();},async()=>{
    const first=optimizeProjectImageForUser(env,'user',project.id);await started;
    const path='/api/projects/'+project.id+'/optimize';const second=await handleProjectImageOptimization(req(path,'user','POST'),env,path);assert.equal(second.status,409);assert.equal((await second.json()).error,'PHOTO_OPTIMIZATION_IN_PROGRESS');
    assert.equal((await upload(env,project.id)).status,409);unblock();assert.equal((await first).ok,true);
  });assert.equal(calls,1);db.close();
});

test('provider errors, timeouts and bad response are retryable and do not break text generation', async () => {
  for (const failure of ['http','timeout','invalid']) {
    const {db,env}=await fixture();installMedia(env);env.OPENAI_API_KEY='fixture';
    const {project}=await create(env);await upload(env,project.id);let calls=0;
    await withFetch(async url=>{
      if (url.endsWith('/responses')) return contentResponse();
      calls++;
      if (calls>1) return imageResponse();
      if (failure==='http') return new Response('failure',{status:503});
      if (failure==='timeout') throw new DOMException('timeout','TimeoutError');
      return Response.json({data:[{b64_json:'invalid'}]});
    },async()=>{
      assert.equal((await optimizeProjectImageForUser(env,'user',project.id)).ok,false);
      assert.equal(db.prepare('SELECT photo_optimization_state FROM projects WHERE id=?').get(project.id).photo_optimization_state,'available');
      assert.equal((await generate(env,project.id)).status,200);
      assert.equal((await optimizeProjectImageForUser(env,'user',project.id)).ok,true);
    });assert.equal(calls,2);db.close();
  }
});

test('R2 write or D1 completion failure leaves original and no false optimized record; retry allowed', async () => {
  for (const failure of ['r2','d1']) {
    const {db,env}=await fixture();const objects=installMedia(env);env.OPENAI_API_KEY='fixture';
    const {project}=await create(env);await upload(env,project.id);
    const originalPut=env.MEDIA.put;
    if(failure==='r2') env.MEDIA.put=async()=>{throw new Error('R2 down');};
    else db.exec("CREATE TRIGGER fail_completion BEFORE UPDATE OF photo_optimization_state ON projects WHEN NEW.photo_optimization_state='completed' BEGIN SELECT RAISE(ABORT,'storage failure'); END;");
    await withFetch(async()=>imageResponse(),async()=>{
      assert.equal((await optimizeProjectImageForUser(env,'user',project.id)).error,'OPTIMIZED_IMAGE_STORAGE_FAILED');
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM project_media WHERE role='optimized'").get().n,0);
      assert.equal(db.prepare('SELECT photo_optimization_state FROM projects WHERE id=?').get(project.id).photo_optimization_state,'available');assert.equal(objects.size,1);
      env.MEDIA.put=originalPut;if(failure==='d1') db.exec('DROP TRIGGER fail_completion');
      assert.equal((await optimizeProjectImageForUser(env,'user',project.id)).ok,true);
    });db.close();
  }
});

test('lost D1 success response is reconciled without deleting saved optimized image or charging again', async () => {
  const {db,env}=await fixture();const objects=installMedia(env);env.OPENAI_API_KEY='fixture';
  const {project}=await create(env);await upload(env,project.id);const batch=env.DB.batch;
  env.DB.batch=async statements=>{await batch(statements);throw new Error('response lost');};
  let calls=0;await withFetch(async()=>{calls++;return imageResponse();},async()=>{
    assert.equal((await optimizeProjectImageForUser(env,'user',project.id)).ok,true);
    assert.equal((await optimizeProjectImageForUser(env,'user',project.id)).error,'PHOTO_ALREADY_OPTIMIZED');
  });assert.equal(calls,1);assert.equal(objects.size,2);db.close();
});

test('no original, anonymous and foreign ownership never call paid provider', async () => {
  const {db,env}=await fixture();installMedia(env);env.OPENAI_API_KEY='fixture';const {project}=await create(env);
  await withFetch(async()=>{throw new Error('Provider must not be called');},async()=>{
    assert.equal((await optimizeProjectImageForUser(env,'user',project.id)).error,'PROJECT_IMAGE_REQUIRED');
    assert.equal((await optimizeProjectImageForUser(env,'admin',project.id)).error,'PROJECT_NOT_FOUND');
    const path='/api/projects/'+project.id+'/optimize';assert.equal((await handleProjectImageOptimization(req(path,null,'POST'),env,path)).status,401);
  });db.close();
});

test('automatic upload optimization uses the same completion guard as explicit retries', async () => {
  const {db,env}=await fixture();installMedia(env);env.OPENAI_API_KEY='fixture';const {project}=await create(env);let calls=0;
  await withFetch(async()=>{calls++;return imageResponse();},async()=>{
    assert.equal((await upload(env,project.id,true)).status,201);
    const path='/api/projects/'+project.id+'/optimize';const response=await worker.fetch(req(path,'user','POST'),env);assert.equal(response.status,409);
  });assert.equal(calls,1);db.close();
});
