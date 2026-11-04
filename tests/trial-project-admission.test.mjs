import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
const ts=createRequire(import.meta.url)('typescript'), mod={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync(new URL('../worker/lib/trial-project-admission.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports);
const {recordTrialProjectAdmission:record}=mod.exports;
const ddl=fs.readFileSync(new URL('../database/tasks/2026-11-04-trial-project-admission.sql',import.meta.url),'utf8');
const bind=values=>Object.fromEntries(values.map((value,i)=>['?'+(i+1),value]));
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT);');
 db.exec(ddl);
 db.exec("INSERT INTO users VALUES('one'),('two'),('unknown'),('legacy'),('missing');INSERT INTO trial_project_admission_scopes VALUES('one','verified',0),('two','verified',0),('unknown','unknown',NULL),('legacy','verified',4);");
 const port={withSession(mode){assert.equal(mode,'first-primary');return{prepare(sql){return{sql,values:[],bind(...values){return{...this,values};},async all(){return{results:db.prepare(this.sql).all(bind(this.values))};}};},async batch(statements){
  db.exec('BEGIN');try{const results=statements.map(s=>{const q=db.prepare(s.sql);if(s.sql.startsWith('SELECT'))return{success:true,results:q.all(bind(s.values))};const outcome=q.run(bind(s.values));return{success:true,results:[],meta:{changes:Number(outcome.changes)}};});db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}
 }}}};
 return{db,port,close:()=>db.close(),count:owner=>db.prepare('SELECT count(*) n FROM trial_project_admissions WHERE user_id=?').get(owner).n};
}
const command=(i,owner='one')=>({ownerId:owner,key:'request_key_0000_'+i,projectId:owner+'_project_'+i,requestIdentity:JSON.stringify({title:'Real project '+i,description:null}),now:1000});
const safe=r=>{assert.equal(r.cannotCreateProject,true);assert.equal(r.cannotDispatch,true);return r;};

test('three lifetime winners under competing requests; exhausted exact retry is free; concurrent duplicate is one slot',async()=>{
 const h=fixture();try{
  const outcomes=await Promise.all(Array.from({length:12},(_,i)=>record(h.port,command(i))));
  assert.equal(outcomes.filter(r=>safe(r).status==='admitted').length,3);assert.equal(h.count('one'),3);
  assert.ok(outcomes.filter(r=>r.status!=='admitted').every(r=>r.status==='blocked'));
  assert.equal(safe(await record(h.port,{...command(0),now:2000})).status,'replayed');assert.equal(h.count('one'),3);
  const duplicates=await Promise.all(Array.from({length:6},()=>record(h.port,command(0,'two'))));
  assert.equal(duplicates.filter(r=>r.status==='admitted').length,1);assert.ok(duplicates.every(r=>['admitted','replayed'].includes(safe(r).status)));assert.equal(h.count('two'),1);
 }finally{h.close();}
});

test('project deletion retains history/retry tombstone, edit does not create, no direct quota reset; account deletion can cascade',async()=>{
 const h=fixture();try{
  for(let i=0;i<3;i++){assert.equal((await record(h.port,command(i))).status,'admitted');h.db.prepare('INSERT INTO projects VALUES(?,?,?)').run(command(i).projectId,'one','title');}
  h.db.prepare("UPDATE projects SET title='edited' WHERE id=?").run(command(0).projectId);assert.equal(h.count('one'),3);
  h.db.exec("DELETE FROM projects WHERE user_id='one'");assert.equal(h.count('one'),3);
  assert.equal(safe(await record(h.port,command(0))).status,'replayed');assert.equal(h.db.prepare('SELECT count(*) n FROM projects').get().n,0);
  assert.equal((await record(h.port,command(4))).status,'blocked');
  assert.throws(()=>h.db.exec("DELETE FROM trial_project_admissions WHERE user_id='one'"),/IMMUTABLE/);
  assert.throws(()=>h.db.exec("DELETE FROM trial_project_admission_scopes WHERE user_id='one'"),/MIGRATION_POLICY_REQUIRED/);
  assert.throws(()=>h.db.exec("UPDATE trial_project_admission_scopes SET baseline_consumed=0 WHERE user_id='one'"),/MIGRATION_POLICY_REQUIRED/);
  h.db.exec("DELETE FROM users WHERE id='one'");assert.equal(h.count('one'),0);assert.equal(h.db.prepare("SELECT count(*) n FROM trial_project_admission_scopes WHERE user_id='one'").get().n,0);
  assert.equal(h.db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{h.close();}
});

test('owner isolation, conflicting key/project/payload, and edits to existing real projects cannot create admission',async()=>{
 const h=fixture();try{
  assert.equal((await record(h.port,command(0))).status,'admitted');
  assert.equal((await record(h.port,{...command(0),requestIdentity:'changed payload'})).status,'conflict');
  assert.equal((await record(h.port,{...command(0),projectId:'different'})).status,'conflict');
  assert.equal((await record(h.port,{...command(1),projectId:command(0).projectId})).status,'conflict');
  assert.equal((await record(h.port,{...command(0,'two'),projectId:command(0).projectId})).status,'conflict');
  assert.equal(h.count('two'),0);
  h.db.exec("INSERT INTO projects VALUES('existing','two','edit target')");
  assert.equal((await record(h.port,{...command(1,'two'),projectId:'existing'})).status,'conflict');assert.equal(h.count('two'),0);
  assert.equal((await record(h.port,command(0,'two'))).status,'admitted');assert.equal(h.count('one'),1);assert.equal(h.count('two'),1);
 }finally{h.close();}
});

test('unverified/missing history never seeds zero; verified baseline above three blocks without deleting existing projects',async()=>{
 const h=fixture();try{
  for(const owner of ['unknown','missing']){assert.equal(safe(await record(h.port,command(0,owner))).status,'not_configured');assert.equal(h.count(owner),0);}
  assert.equal(h.db.prepare("SELECT count(*) n FROM trial_project_admission_scopes WHERE user_id='missing'").get().n,0);
  for(let i=0;i<4;i++)h.db.prepare('INSERT INTO projects VALUES(?,?,?)').run('old'+i,'legacy','old project');
  assert.equal((await record(h.port,command(0,'legacy'))).status,'blocked');assert.equal(h.db.prepare("SELECT count(*) n FROM projects WHERE user_id='legacy'").get().n,4);
  assert.throws(()=>h.db.exec("INSERT INTO trial_project_admission_scopes VALUES('missing','verified',NULL)"));
 }finally{h.close();}
});
