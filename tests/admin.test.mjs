import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { handleProjects } = await vite.ssrLoadModule('/worker/routes/projects.ts');
const { handleProjectGeneration } = await vite.ssrLoadModule('/worker/routes/project-generation.ts');
const { handleAdmin } = await vite.ssrLoadModule('/worker/routes/admin.ts');
const { handleAuth } = await vite.ssrLoadModule('/worker/routes/auth.ts');
const { handleEntitlements } = await vite.ssrLoadModule('/worker/routes/entitlements.ts');
const { hashSessionToken } = await vite.ssrLoadModule('/worker/lib/session.ts');
const { isTrialActive, isValidTrialExpiration } = await vite.ssrLoadModule('/worker/lib/user.ts');
after(() => vite.close());

// In-memory fixture matches the verified production columns; never applied to D1.
async function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, email_verified INTEGER DEFAULT 1,
      role TEXT DEFAULT 'user' CHECK(role IN ('user','admin')), plan TEXT DEFAULT 'trial' CHECK(plan IN ('trial','business')),
      plan_source TEXT DEFAULT 'system' CHECK(plan_source IN ('system','manual_admin','stripe')),
      trial_expires_at TEXT, plan_updated_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, email_verified_at TEXT, google_sub TEXT);
    CREATE TABLE auth_tokens(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), token_hash TEXT, type TEXT, expires_at TEXT, used_at TEXT);
    CREATE TABLE sessions(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), token_hash TEXT, expires_at TEXT, revoked_at TEXT);
    CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY, admin_user_id TEXT REFERENCES users(id), target_user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL, old_value TEXT, new_value TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
  db.prepare('INSERT INTO users(id,email,role,password_hash) VALUES (?,?,?,?)').run('admin','admin@example.com','admin','never-return-this');
  db.prepare('INSERT INTO users(id,email,password_hash) VALUES (?,?,?)').run('user','user@example.com','never-return-this');
  for (const id of ['admin','user']) db.prepare('INSERT INTO sessions VALUES (?,?,?,?,NULL)').run(id,id,await hashSessionToken(id), '2099-01-01T00:00:00.000Z');
  const prepare = sql => ({ args: [], bind(...args) { this.args = args; return this; }, async first() { return db.prepare(sql).get(...this.args) ?? null; }, execute() {
    if (/^\s*SELECT/i.test(sql)) return { results: db.prepare(sql).all(...this.args), meta: { changes: 0 } };
    return { results: [], meta: { changes: Number(db.prepare(sql).run(...this.args).changes) } };
  }, async run() { return this.execute(); }, async all() { return this.execute(); } });
  const env = { DB: { prepare, async batch(statements) { db.exec('BEGIN'); try { const results = statements.map(s => s.execute()); db.exec('COMMIT'); return results; } catch (e) { db.exec('ROLLBACK'); throw e; } } } };
  for (const migration of ['2026-09-22-projects-v1.sql','2026-09-22-project-media-v1.sql','2026-09-24-generated-contents-v1.sql']) db.exec(readFileSync(new URL('../database/migrations/' + migration, import.meta.url),'utf8'));
  return { db, env };
}
function request(path, actor, body, overrides = {}) {
  const headers = { ...(actor ? { Cookie: `dfbk_session=${actor}` } : {}), ...(body !== undefined ? { Origin: 'https://dfbk.app', 'Content-Type': 'application/json' } : {}), ...overrides };
  return new Request(`https://dfbk.app${path}`, { method: body === undefined ? 'GET' : 'PATCH', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
async function call(env, path, actor, body, headers) { const res = await handleAdmin(request(path,actor,body,headers),env,path.split('?')[0]); return { status: res.status, body: await res.json() }; }
const planPath = '/api/admin/users/user/plan';

test('authorization: anonymous/invalid/expired/revoked=401, user=403, role from database only', async () => {
  const {db,env} = await fixture();
  for (const actor of [undefined,'unknown']) {
    assert.equal((await call(env,'/api/admin/me',actor)).status,401);
    assert.equal((await call(env,planPath,actor,{plan:'business'})).status,401);
  }
  assert.equal((await call(env,'/api/admin/me','user')).status,403);
  assert.equal((await call(env,'/api/admin/users?email=user@example.com','user')).status,403);
  assert.equal((await call(env,planPath,'user',{plan:'business'})).status,403);
  assert.deepEqual((await call(env,'/api/admin/me','admin')).body,{id:'admin',email:'admin@example.com',role:'admin'});
  db.exec("UPDATE sessions SET expires_at='2000-01-01' WHERE id='admin'");
  assert.equal((await call(env,'/api/admin/me','admin')).status,401);
  db.exec("UPDATE sessions SET expires_at='2099-01-01', revoked_at=CURRENT_TIMESTAMP WHERE id='admin'");
  assert.equal((await call(env,'/api/admin/me','admin')).status,401);
  db.exec("UPDATE sessions SET revoked_at=NULL WHERE id='admin'; UPDATE users SET role='user' WHERE id='admin'");
  assert.equal((await call(env,'/api/admin/me','admin')).status,403);
  db.close();
});

test('exact normalized search, not found, bounded input, no sensitive data', async () => {
  const {db,env} = await fixture();
  const found=await call(env,'/api/admin/users?email=%20USER@example.com%20','admin');
  assert.equal(found.status,200); assert.equal(found.body.user.id,'user');
  assert.equal(JSON.stringify(found.body).includes('password'),false);
  assert.equal((await call(env,'/api/admin/users?email=missing@example.com','admin')).status,404);
  assert.equal((await call(env,'/api/admin/users?email=user','admin')).status,400);
  assert.equal((await call(env,'/api/admin/users?email=user@example.com&email=admin@example.com','admin')).status,400);
  db.close();
});

test('trial/business changes, truthful atomic audit, no-op and D1/API parity', async () => {
  const {db,env} = await fixture();
  let changed=await call(env,planPath,'admin',{plan:'business'});
  assert.equal(changed.status,200); assert.equal(changed.body.changed,true);
  assert.equal(changed.body.user.planSource,'manual_admin'); assert.equal(changed.body.user.trialExpiresAt,null); assert.ok(changed.body.user.planUpdatedAt);
  assert.deepEqual({...db.prepare('SELECT old_value,new_value,action FROM admin_audit_log').get()}, {old_value:'trial',new_value:'business',action:'USER_PLAN_CHANGED'});
  assert.equal((await call(env,planPath,'admin',{plan:'business'})).body.changed,false);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').get().n,1);
  assert.equal((await call(env,planPath,'admin',{plan:'premium'})).body.error,'INVALID_PLAN');
  changed=await call(env,planPath,'admin',{plan:'trial',trialExpiresAt:'2027-01-01 12:30:00'});
  assert.equal(changed.body.changed,true); assert.equal(changed.body.user.trialExpiresAt,'2027-01-01 12:30:00');
  assert.equal((await call(env,planPath,'admin',{plan:'trial',trialExpiresAt:'2027-01-02 12:30:00'})).body.error,'TRIAL_EXPIRATION_CHANGE_NOT_SUPPORTED');
  assert.equal((await call(env,planPath,'admin',{plan:'trial'})).body.changed,false);
  const reread=await call(env,'/api/admin/users?email=user@example.com','admin');
  assert.deepEqual(reread.body.user,changed.body.user);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').get().n,2);
  const ents=await handleEntitlements(request('/api/account/entitlements','user'),env,'/api/account/entitlements');
  assert.equal((await ents.json()).plan,'trial');
  db.close();
});

test('audit INSERT or users UPDATE failure rolls back whole operation', async () => {
  for (const table of ['admin_audit_log','users']) {
    const {db,env}=await fixture();
    db.exec(`CREATE TRIGGER fail BEFORE ${table === 'users' ? 'UPDATE' : 'INSERT'} ON ${table} BEGIN SELECT RAISE(ABORT,'test failure'); END;`);
    const response=await call(env,planPath,'admin',{plan:'business'});
    assert.equal(response.status,500); assert.equal(response.body.error,'PLAN_UPDATE_FAILED');
    assert.equal(db.prepare("SELECT plan FROM users WHERE id='user'").get().plan,'trial');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').get().n,0);
    db.close();
  }
});

test('CSRF/content type/body bounds, invalid expiration and role injection', async () => {
  const {db,env}=await fixture();
  for (const origin of ['https://evil.example','null','']) assert.equal((await call(env,planPath,'admin',{plan:'business'},{Origin:origin})).status,403);
  assert.equal((await call(env,planPath,'admin',{plan:'business'},{'Content-Type':'text/plain'})).status,415);
  assert.equal((await call(env,planPath,'admin',{plan:'business',padding:'x'.repeat(2000)})).status,413);
  for (const expiry of ['2026-02-30 12:00:00','2026-01-01T12:00:00Z',null,123]) assert.equal((await call(env,planPath,'admin',{plan:'trial',trialExpiresAt:expiry})).body.error,'INVALID_TRIAL_EXPIRATION');
  assert.equal((await call(env,planPath,'admin',{plan:'business',role:'admin'})).status,400);
  assert.equal((await call(env,'/api/admin/users/missing/plan','admin',{plan:'business'})).status,404);
  db.close();
});

test('trial helper uses UTC server clock, boundary and invalid date checks', () => {
  assert.equal(isTrialActive({plan:'trial',trial_expires_at:null}),true);
  assert.equal(isTrialActive({plan:'business',trial_expires_at:null}),false);
  const expires='2026-10-02 14:00:00'; const now=Date.parse('2026-10-02T14:00:00Z');
  assert.equal(isTrialActive({plan:'trial',trial_expires_at:expires},now-1),true);
  assert.equal(isTrialActive({plan:'trial',trial_expires_at:expires},now),false);
  assert.equal(isValidTrialExpiration('2026-02-29 00:00:00'),false);
  assert.equal(isValidTrialExpiration('2028-02-29 00:00:00'),true);
});

test('auth/me additive fields, session expiry, logout revocation and entitlement refresh', async () => {
  const {db,env}=await fixture();
  let response=await handleAuth(request('/api/auth/me','user'),env,'/api/auth/me');
  let body=await response.json(); assert.equal(body.user.emailVerified,true); assert.equal(body.user.plan,'trial'); assert.equal(body.session.expiresAt,'2099-01-01T00:00:00.000Z');
  await call(env,planPath,'admin',{plan:'business'});
  response=await handleEntitlements(request('/api/account/entitlements','user'),env,'/api/account/entitlements');
  body=await response.json(); assert.equal(body.plan,'business'); assert.equal(body.features.share,true);
  response=await handleAuth(new Request('https://dfbk.app/api/auth/logout',{method:'POST',headers:{Cookie:'dfbk_session=user'}}),env,'/api/auth/logout');
  assert.equal(response.status,200); assert.ok(response.headers.get('Set-Cookie').includes('Max-Age=0'));
  assert.equal((await call(env,'/api/admin/me','user')).status,401);
  db.close();
});

test('email and Google registrations preserve D1 defaults; email/password login still creates usable session', async () => {
  const {db,env}=await fixture();
  const originalFetch=globalThis.fetch;
  try {
    Object.assign(env,{RESEND_API_KEY:'fixture',EMAIL_FROM:'test@example.com',GOOGLE_CLIENT_ID:'fixture',GOOGLE_CLIENT_SECRET:'fixture',GOOGLE_REDIRECT_URI:'https://dfbk.app/api/auth/google/callback'});
    globalThis.fetch=async url => {
      if (String(url).includes('resend.com')) return Response.json({id:'fixture'});
      if (String(url).includes('oauth2.googleapis.com')) return Response.json({access_token:'fixture'});
      if (String(url).includes('openidconnect.googleapis.com')) return Response.json({sub:'fixture-google-sub',email:'google@example.com',email_verified:true});
      throw new Error('Unexpected upstream');
    };
    let response=await handleAuth(new Request('https://dfbk.app/api/auth/register',{method:'POST',body:JSON.stringify({email:'new@example.com',password:'fixture-password'})}),env,'/api/auth/register');
    assert.equal(response.status,201);
    const defaults=email=>({...db.prepare('SELECT role,plan,plan_source,trial_expires_at FROM users WHERE email=?').get(email)});
    assert.deepEqual(defaults('new@example.com'),{role:'user',plan:'trial',plan_source:'system',trial_expires_at:null});
    db.exec("UPDATE users SET email_verified=1 WHERE email='new@example.com'");
    response=await handleAuth(new Request('https://dfbk.app/api/auth/login',{method:'POST',body:JSON.stringify({email:'new@example.com',password:'fixture-password'})}),env,'/api/auth/login');
    assert.equal(response.status,200);
    const cookie=response.headers.get('Set-Cookie');
    for (const flag of ['HttpOnly','Secure','SameSite=Lax']) assert.ok(cookie.includes(flag));
    const me=await handleAuth(new Request('https://dfbk.app/api/auth/me',{headers:{Cookie:cookie.split(';')[0]}}),env,'/api/auth/me');
    assert.equal(me.status,200); assert.equal((await me.json()).user.plan,'trial');
    response=await handleAuth(new Request('https://dfbk.app/api/auth/google/callback?code=fixture&state=fixture',{headers:{Cookie:'dfbk_google_oauth_state=fixture'}}),env,'/api/auth/google/callback');
    assert.equal(response.status,302); assert.ok(response.headers.get('Location').includes('google_success'));
    assert.deepEqual(defaults('google@example.com'),{role:'user',plan:'trial',plan_source:'system',trial_expires_at:null});
  } finally { globalThis.fetch=originalFetch; db.close(); }
});

test('projects, private media and generation remain usable before and after plan changes', async () => {
  const {db,env}=await fixture();
  const stored=new Map();
  env.MEDIA={ async put(key,bytes) { stored.set(key,bytes); }, async get(key) { const bytes=stored.get(key); return bytes ? {body:bytes,size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)} : null; }, async delete(key) { stored.delete(key); } };
  const originalFetch=globalThis.fetch;
  try {
    env.OPENAI_API_KEY='fixture';
    globalThis.fetch=async url => { assert.equal(url,'https://api.openai.com/v1/responses'); return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({googleBusiness:'Google test',socialMedia:'Social test',websiteReference:'Website test'})}]}]}); };
    for (const plan of ['trial','business']) {
      if (plan==='business') await call(env,planPath,'admin',{plan});
      let response=await handleProjects(new Request('https://dfbk.app/api/projects',{method:'POST',headers:{Cookie:'dfbk_session=user'},body:JSON.stringify({title:'Test',description:'Real work'})}),env,'/api/projects');
      assert.equal(response.status,201); const id=(await response.json()).project.id;
      const form=new FormData(); form.set('file',new Blob([new Uint8Array([255,216,255,0])],{type:'image/jpeg'}),'fixture.jpg');
      const path=`/api/projects/${id}/media`;
      response=await handleProjects(new Request('https://dfbk.app'+path,{method:'POST',headers:{Cookie:'dfbk_session=user'},body:form}),env,path);
      assert.equal(response.status,201); const media=(await response.json()).media;
      const readPath=path+'/'+media.id;
      response=await handleProjects(request(readPath,'user'),env,readPath); assert.equal(response.status,200);
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array([255,216,255,0]));
      assert.equal((await handleProjects(request(readPath,'admin'),env,readPath)).status,404);
      const generationPath=`/api/projects/${id}/generate`;
      response=await handleProjectGeneration(new Request('https://dfbk.app'+generationPath,{method:'POST',headers:{Cookie:'dfbk_session=user'}}),env,generationPath);
      assert.equal(response.status,200); assert.equal(db.prepare('SELECT status FROM projects WHERE id=?').get(id).status,'ready');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM generated_contents WHERE project_id=?').get(id).n,3);
      response=await handleProjects(request('/api/projects','user'),env,'/api/projects');
      assert.equal(response.status,200); assert.ok((await response.json()).projects.some(p=>p.id===id));
    }
  } finally { globalThis.fetch=originalFetch; db.close(); }
});
