import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { fixture } from './helpers/backend.mjs';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
const {handleSocial}=await vite.ssrLoadModule('/worker/routes/social.ts');
const {handleSocialPublish,handleSocialMedia}=await vite.ssrLoadModule('/worker/routes/social-publish.ts');
const security=await vite.ssrLoadModule('/worker/lib/social-security.ts');
after(()=>vite.close());
const key=Buffer.alloc(32,9).toString('base64');
const jpeg=new Uint8Array([255,216,255,192,0,11,8,0,100,0,100,1,1,17,0,255,217]);
async function setup() {
  const {db,env}=await fixture();
  db.exec(readFileSync(new URL('../database/tasks/2026-10-07-social-publishing-v1.sql',import.meta.url),'utf8'));
  Object.assign(env,{SOCIAL_ENABLED:'true',SOCIAL_PUBLIC_ORIGIN:'https://dfbk.app',SOCIAL_TOKEN_ENCRYPTION_KEY:key,SOCIAL_MEDIA_SIGNING_KEY:Buffer.alloc(32,7).toString('base64'),META_APP_ID:'123',META_APP_SECRET:'secret-fixture',META_GRAPH_VERSION:'v25.0'});
  const objects=new Map([['original-key',jpeg],['optimized-key',jpeg]]);
  env.MEDIA={get:async path=>{const bytes=objects.get(path);return bytes?{body:bytes,size:bytes.length,arrayBuffer:async()=>bytes.slice().buffer}:null;}};
  db.exec("INSERT INTO projects(id,user_id,title) VALUES('p','user','Name'),('foreign','admin','Other'); INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES('original','p','original-key','original','image/jpeg',17);");
  return {db,env,objects};
}
async function connect(db,env,provider='facebook',actor='user',id='connection-'+provider) {
  const cipher=await security.encryptToken(env,'SECRET_PROVIDER_TOKEN',security.connectionContext(actor,provider,'12345'));
  db.prepare(`INSERT INTO social_connections(id,user_id,provider,external_account_id,external_account_name,access_token_encrypted,status,scopes) VALUES(?,?,?,?,?,?,'connected',?)`).run(id,actor,provider,'12345','Test Business',cipher,JSON.stringify(provider==='instagram'?security.META_SCOPES.instagram:security.META_SCOPES.facebook));
  return id;
}
function request(path,method='GET',body,actor='user',idem='idempotency-test-0001') {
  return new Request('https://dfbk.app'+path,{method,headers:{...(actor?{Cookie:'dfbk_session='+actor}:{}),Origin:'https://dfbk.app','Content-Type':'application/json','Idempotency-Key':idem},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const post=(env,body={providers:['facebook'],caption:'Ein klarer Auftritt.',useOptimizedImage:true},idem)=>handleSocialPublish(request('/api/projects/p/publish','POST',body,'user',idem),env,'/api/projects/p/publish');
async function mocked(fn,run) {const old=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=old;}}

test('token encryption binds owner/provider/account, fresh IV, tampering rejected',async()=>{
  const {db,env}=await setup();const context=security.connectionContext('user','instagram','12345');
  const a=await security.encryptToken(env,'SECRET',context),b=await security.encryptToken(env,'SECRET',context);
  assert.notEqual(a,b);assert.ok(!a.includes('SECRET'));assert.equal(await security.decryptToken(env,a,context),'SECRET');
  await assert.rejects(security.decryptToken(env,a,security.connectionContext('admin','instagram','12345')),{code:'RECONNECT_REQUIRED'});
  await assert.rejects(security.decryptToken(env,a+'wrong',context),{code:'RECONNECT_REQUIRED'});db.close();
});
test('connections require existing auth, show own safe fields and disabled configuration never queries new tables',async()=>{
  const {db,env}=await setup();await connect(db,env);await connect(db,env,'instagram','admin');
  assert.equal((await handleSocial(request('/api/social/connections','GET',undefined,null),env,'/api/social/connections')).status,401);
  const response=await handleSocial(request('/api/social/connections'),env,'/api/social/connections');const body=await response.json();
  assert.equal(body.connections.length,4);assert.equal(body.connections[0].connected,false);assert.equal(body.connections[1].accountName,'Test Business');
  assert.equal(body.connections[2].availability,'in_preparation');assert.doesNotMatch(JSON.stringify(body),/SECRET|encrypted|access_token|scopes/);
  env.SOCIAL_ENABLED='false';db.exec('DROP TABLE publication_jobs; DROP TABLE social_connections');
  assert.equal((await handleSocial(request('/api/social/connections'),env,'/api/social/connections')).status,200);db.close();
});
test('OAuth state bound to session/user/provider, expired/replayed/cross-site refused; cancel never calls provider',async()=>{
  const {db,env}=await setup();const path='/api/social/facebook/connect';
  const bad=request(path);bad.headers.set('Origin','https://evil.example');
  assert.equal((await handleSocial(bad,env,path)).status,403);
  const response=await handleSocial(request(path),env,path);assert.equal(response.status,302);
  const auth=new URL(response.headers.get('Location'));assert.equal(auth.hostname,'www.facebook.com');
  const state=auth.searchParams.get('state');assert.notEqual(db.prepare('SELECT state_hash FROM social_oauth_states').get().state_hash,state);
  const callback='/api/social/facebook/callback';
  const wrong=callback+'?state='+state+'&error=access_denied';
  assert.equal((await handleSocial(request(wrong,'GET',undefined,'admin'),env,callback)).status,400);
  await mocked(async()=>{throw new Error('cancel must not contact Meta');},async()=>{
    const cancelled=await handleSocial(request(wrong),env,callback);assert.equal(cancelled.status,303);assert.match(cancelled.headers.get('Location'),/social=cancelled/);
    assert.equal((await handleSocial(request(wrong),env,callback)).status,400);
  });
  const expiredStart=await handleSocial(request(path),env,path);const expiredState=new URL(expiredStart.headers.get('Location')).searchParams.get('state');
  db.exec("UPDATE social_oauth_states SET expires_at='2000-01-01 00:00:00'");
  assert.equal((await handleSocial(request(callback+'?state='+expiredState+'&code=code'),env,callback)).status,400);
  const freshStart=await handleSocial(request(path),env,path);const freshState=new URL(freshStart.headers.get('Location')).searchParams.get('state');
  const other='/api/social/instagram/callback';assert.equal((await handleSocial(request(other+'?state='+freshState+'&code=code'),env,other)).status,400);
  db.close();
});
test('OAuth discovers and encrypts accounts, never auto-selects or publishes; explicit select/disconnect keeps history',async()=>{
  const {db,env}=await setup();const path='/api/social/facebook/connect';const response=await handleSocial(request(path),env,path);const state=new URL(response.headers.get('Location')).searchParams.get('state');let calls=0;
  await mocked(async(url)=>{
    calls++;const u=new URL(url);assert.equal(u.hostname,'graph.facebook.com');
    if(u.pathname.endsWith('oauth/access_token'))return Response.json({access_token:'USER_ACCESS_SECRET',expires_in:3600});
    if(u.pathname.endsWith('me/permissions'))return Response.json({data:security.META_SCOPES.facebook.map(permission=>({permission,status:'granted'}))});
    if(u.pathname.endsWith('me/accounts'))return Response.json({data:[{id:'12345',name:'Page A',access_token:'PAGE_ACCESS_SECRET'},{id:'54321',name:'Page B',access_token:'PAGE_ACCESS_SECRET'}]});
    throw new Error('unexpected provider call');
  },async()=>{
    const cb='/api/social/facebook/callback';const result=await handleSocial(request(cb+'?state='+state+'&code=CODE_SECRET'),env,cb);assert.equal(result.status,303);assert.match(result.headers.get('Location'),/select_account/);
  });assert.equal(calls,4);
  const rows=db.prepare('SELECT * FROM social_connections').all();assert.equal(rows.length,2);assert.ok(rows.every(row=>row.status==='pending'));assert.doesNotMatch(JSON.stringify(rows),/PAGE_ACCESS_SECRET/);
  const select='/api/social/facebook/select';assert.equal((await handleSocial(request(select,'POST',{connectionId:rows[0].id}),env,select)).status,200);
  const pub=await mocked(async()=>Response.json({id:'777',post_id:'12345_777'}),()=>post(env));assert.equal(pub.status,200);
  const disconnect='/api/social/facebook/disconnect';assert.equal((await handleSocial(request(disconnect,'POST',{}),env,disconnect)).status,200);
  assert.ok(db.prepare('SELECT * FROM social_connections').all().every(row=>row.access_token_encrypted===null&&row.status==='disconnected'));
  assert.equal(db.prepare('SELECT status FROM publication_jobs').get().status,'published');
  const blocked=await (await post(env,undefined,'new-idempotency-0002')).json();assert.equal(blocked.results[0].error,'SOCIAL_NOT_CONNECTED');db.close();
});
test('publish ownership/auth/Origin/key/caption/provider validation before side effects',async()=>{
  const {db,env}=await setup();const path='/api/projects/foreign/publish';
  assert.equal((await handleSocialPublish(request(path,'POST',{providers:['facebook'],caption:'x'}),env,path)).status,404);
  const own='/api/projects/p/publish';assert.equal((await handleSocialPublish(request(own,'POST',{},null),env,own)).status,401);
  const bad=request(own,'POST',{});bad.headers.set('Origin','https://evil.example');assert.equal((await handleSocialPublish(bad,env,own)).status,403);
  for(const body of [{providers:['premium'],caption:'a'},{providers:['facebook'],caption:' '},{providers:['instagram'],caption:'x'.repeat(2201)},{providers:['facebook','facebook'],caption:'a'},{providers:['facebook'],caption:'a',token:'injected'}])assert.equal((await post(env,body)).status,400);
  assert.equal((await post(env,{providers:['facebook'],caption:'ok'},'short')).status,400);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM publication_jobs').get().n,0);db.close();
});
test('Facebook optimized preference, original fallback, same-key replay and changed payload conflict',async()=>{
  for(const optimized of [false,true]) {
    const {db,env}=await setup();await connect(db,env);
    if(optimized)db.exec("INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES('optimized','p','optimized-key','optimized','image/jpeg',17)");
    let calls=0;
    await mocked(async(url,options)=>{calls++;assert.ok(!String(url).includes('SECRET'));assert.equal(options.headers.Authorization,'Bearer SECRET_PROVIDER_TOKEN');const fields=new URLSearchParams(options.body);assert.equal(fields.get('caption'),'Ein klarer Auftritt.');return Response.json({id:'777'});},async()=>{
      assert.equal((await post(env)).status,200);assert.equal((await post(env)).status,200);
      assert.equal((await post(env,{providers:['facebook'],caption:'Changed'})).status,409);
    });assert.equal(calls,1);assert.equal(db.prepare('SELECT media_source FROM publication_jobs').get().media_source,optimized?'optimized':'original');db.close();
  }
});
test('two parallel same-key publish calls produce exactly one external Facebook post',async()=>{
  const {db,env}=await setup();await connect(db,env);let calls=0;let release;const blocked=new Promise(resolve=>release=resolve);let started;const ready=new Promise(resolve=>started=resolve);
  await mocked(async()=>{calls++;started();await blocked;return Response.json({id:'777'});},async()=>{
    const first=post(env);await ready;
    const second=await post(env);assert.equal(second.status,202);assert.equal((await second.json()).results[0].status,'processing');release();assert.equal((await first).status,200);
  });assert.equal(calls,1);db.close();
});
test('partial success preserved, unknown provider outcome never retried or marked failed',async()=>{
  const {db,env}=await setup();await connect(db,env,'instagram');await connect(db,env);let calls=0;
  await mocked(async(url)=>{
    calls++;const path=new URL(url).pathname;
    if(path.endsWith('/media'))return Response.json({id:'999'});
    if(path.endsWith('/999'))return Response.json({status_code:'FINISHED'});
    if(path.endsWith('/media_publish'))return Response.json({error:{code:200}}, {status:400});
    if(path.endsWith('/photos'))return Response.json({id:'777'});
    throw new Error('unexpected');
  },async()=>{
    const result=await (await post(env,{providers:['instagram','facebook'],caption:'Caption'})).json();
    assert.equal(result.results.find(x=>x.provider==='facebook').status,'published');
    assert.equal(result.results.find(x=>x.provider==='instagram').error,'SOCIAL_PERMISSION_REQUIRED');
    const before=calls;await post(env,{providers:['instagram','facebook'],caption:'Caption'});assert.equal(calls,before);
  });db.close();
  const other=await setup();await connect(other.db,other.env);let attempts=0;
  await mocked(async()=>{attempts++;throw new Error('SECRET_MUST_NOT_LEAK');},async()=>{
    const response=await post(other.env);assert.equal(response.status,202);const data=await response.json();assert.equal(data.results[0].error,'SOCIAL_PUBLICATION_OUTCOME_UNKNOWN');assert.equal(data.results[0].retryAllowed,false);assert.doesNotMatch(JSON.stringify(data),/SECRET_MUST/);await post(other.env);
  });assert.equal(attempts,1);other.db.close();
});
test('Instagram saved container waits/resumes same job and publishes once, no new image/AI request',async()=>{
  const {db,env}=await setup();await connect(db,env,'instagram');let creates=0,publishes=0,checks=0;
  const body={providers:['instagram'],caption:'Caption'};
  await mocked(async(url)=>{
    const path=new URL(url).pathname;
    if(path.endsWith('/media')){creates++;return Response.json({id:'999'});}
    if(path.endsWith('/999')){checks++;return Response.json({status_code:checks===1?'IN_PROGRESS':'FINISHED'});}
    if(path.endsWith('/media_publish')){publishes++;return Response.json({id:'777'});}
    if(path.endsWith('/777'))return Response.json({permalink:'https://www.instagram.com/p/test/'});
    throw new Error('unexpected AI/optimization/network call');
  },async()=>{
    assert.equal((await post(env,body)).status,202);await post(env,body);assert.equal(checks,1);
    db.exec("UPDATE publication_jobs SET updated_at=datetime('now','-11 seconds')");
    const result=await (await post(env,body)).json();assert.equal(result.results[0].status,'published');await post(env,body);
  });assert.equal(creates,1);assert.equal(publishes,1);db.close();
});
test('signed private media only one object, expires/tampering denied, disconnect revokes capability',async()=>{
  const {db,env}=await setup();await connect(db,env);let imageUrl;
  await mocked(async(url,options)=>{imageUrl=new URLSearchParams(options.body).get('url');return Response.json({id:'777'});},()=>post(env));
  const url=new URL(imageUrl);const good=await handleSocialMedia(new Request(imageUrl),env,url.pathname);assert.equal(good.status,200);assert.equal(good.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(new Uint8Array(await good.arrayBuffer()),jpeg);
  assert.equal((await handleSocialMedia(new Request(imageUrl.replace('signature=','signature=wrong')),env,url.pathname)).status,404);
  const expired=new URL(imageUrl);expired.searchParams.set('expires',String(Math.floor(Date.now()/1000)-1));assert.equal((await handleSocialMedia(new Request(expired),env,url.pathname)).status,404);
  db.exec("UPDATE social_connections SET status='disconnected',access_token_encrypted=NULL");assert.equal((await handleSocialMedia(new Request(imageUrl),env,url.pathname)).status,404);db.close();
});
test('token expiry, missing original, unsupported IG image and D1 admission rollback make no external publish',async()=>{
  const {db,env}=await setup();await connect(db,env);db.exec("UPDATE social_connections SET token_expires_at='2000-01-01 00:00:00'");
  await mocked(async()=>{throw new Error('must not call');},async()=>{
    const result=await (await post(env)).json();assert.equal(result.results[0].error,'SOCIAL_TOKEN_EXPIRED');
    db.exec('DELETE FROM project_media');assert.equal((await post(env,undefined,'new-idempotency-0002')).status,400);
  });db.close();
  const other=await setup();await connect(other.db,other.env,'instagram');other.db.exec("UPDATE project_media SET mime_type='image/png'");assert.equal((await post(other.env,{providers:['instagram'],caption:'Caption'})).status,400);other.db.close();
  const rollback=await setup();await connect(rollback.db,rollback.env);rollback.db.exec("CREATE TRIGGER reject_job BEFORE INSERT ON publication_jobs BEGIN SELECT RAISE(ABORT,'fixture'); END;");
  assert.equal((await post(rollback.env)).status,503);assert.equal(rollback.db.prepare('SELECT COUNT(*) n FROM publication_requests').get().n,0);rollback.db.close();
});
test('lost publication DB success acknowledgement never causes second post; snapshot survives media/connection changes on replay',async()=>{
  const {db,env}=await setup();await connect(db,env);let calls=0;const prepare=env.DB.prepare;
  env.DB.prepare=sql=>{
    const statement=prepare(sql);
    if(sql.includes("status='published'")){const run=statement.run;statement.run=async function(){await run.call(this);throw new Error('lost acknowledgement');};}
    return statement;
  };
  await mocked(async()=>{calls++;return Response.json({id:'777'});},async()=>{
    const result=await (await post(env)).json();assert.equal(result.results[0].status,'published');
    db.exec("UPDATE social_connections SET status='disconnected',access_token_encrypted=NULL; DELETE FROM project_media;");
    const replay=await (await post(env)).json();assert.equal(replay.results[0].status,'published');assert.equal(replay.results[0].mediaSource,'original');
  });assert.equal(calls,1);db.close();
});
test('bounded OAuth starts and new publication admissions; status read is owner-only',async()=>{
  const {db,env}=await setup();
  const connectPath='/api/social/facebook/connect';
  for(let i=0;i<10;i++)assert.equal((await handleSocial(request(connectPath),env,connectPath)).status,302);
  assert.equal((await handleSocial(request(connectPath),env,connectPath)).status,429);
  let last;
  for(let i=0;i<20;i++)last=await (await post(env,undefined,'idempotency-request-'+String(i).padStart(3,'0'))).json();
  assert.equal((await post(env,undefined,'idempotency-request-999')).status,429);
  const path='/api/projects/p/publications';
  assert.equal((await handleSocialPublish(request(path+'?requestId='+last.requestId),env,path)).status,200);
  assert.equal((await handleSocialPublish(request(path+'?requestId='+last.requestId,'GET',undefined,'admin'),env,path)).status,404);db.close();
});
test('preview mediaId pins confirmed image even if optimized appears; foreign media denied',async()=>{
  const {db,env}=await setup();await connect(db,env);
  db.exec("INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES('optimized','p','optimized-key','optimized','image/jpeg',17),('foreign-media','foreign','other','original','image/jpeg',17)");
  let calls=0;
  await mocked(async()=>{calls++;return Response.json({id:'777'});},async()=>{
    const result=await (await post(env,{providers:['facebook'],caption:'Caption',useOptimizedImage:true,mediaId:'original'})).json();
    assert.equal(result.results[0].mediaId,'original');assert.equal(result.results[0].mediaSource,'original');
    assert.equal((await post(env,{providers:['facebook'],caption:'Caption',mediaId:'foreign-media'},'preview-idempotency-0002')).status,400);
  });assert.equal(calls,1);db.close();
});
