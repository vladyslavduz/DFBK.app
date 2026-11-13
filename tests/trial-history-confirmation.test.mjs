import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const sql = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT NOT NULL DEFAULT 'user',plan TEXT DEFAULT 'trial');
    INSERT INTO users(id,role) VALUES('admin','admin'),('user','user'),('missing','user'),('other','user'),('verified','user');`);
  db.exec(sql('database/migrations/2026-09-22-projects-v1.sql'));
  db.exec(sql('database/tasks/2026-11-04-trial-project-admission.sql'));
  db.exec(`INSERT INTO trial_project_admission_scopes VALUES('user','unknown',NULL),('verified','verified',2);`);
  db.exec(sql('database/tasks/2026-11-05-trial-history-confirmation.sql'));
  return db;
}
const command = (user = 'user', baseline = 1) => [user, 'history_confirm_' + user, baseline, 'admin', 'reviewed:legacy-evidence', 1000];
const confirm = (db, values) => db.prepare(`INSERT INTO trial_project_history_confirmations
  (user_id,confirmation_id,baseline_consumed,admin_user_id,evidence_reference,confirmed_at_ms)
  VALUES(?,?,?,?,?,?)`).run(...values);
const scope = (db, user = 'user') => ({ ...db.prepare('SELECT * FROM trial_project_admission_scopes WHERE user_id=?').get(user) });
const count = (db, table) => db.prepare('SELECT count(*) n FROM ' + table).get().n;
const inspect = db => ['users','projects','trial_project_admission_scopes','trial_project_admissions',
  'trial_project_completions','trial_project_history_confirmations'].map(t => db.prepare('SELECT * FROM ' + t + ' ORDER BY 1').all());

test('unknown and missing confirm once; deliberate zero/above-cap baselines preserve existing projects and grants', () => {
  const db = fixture(); try {
    db.exec("INSERT INTO projects(id,user_id,title) VALUES('legacy','user','kept'); UPDATE users SET plan='business' WHERE id='user'");
    confirm(db, command('user', 4)); confirm(db, command('missing', 0));
    assert.deepEqual(scope(db), {user_id:'user',history_status:'verified',baseline_consumed:4});
    assert.deepEqual(scope(db, 'missing'), {user_id:'missing',history_status:'verified',baseline_consumed:0});
    assert.equal(count(db,'projects'),1);
    assert.equal(db.prepare("SELECT plan FROM users WHERE id='user'").get().plan,'business');
    assert.equal(count(db,'trial_project_admissions'),0);
    assert.throws(() => create(db,5),/LIFETIME_PROJECT_LIMIT/);
    assert.equal(count(db,'projects'),1);
  } finally { db.close(); }
});

test('exact replay is immutable; changed fields/cross-owner ID/verified scope are conflicts', () => {
  const db = fixture(); try {
    const input = command(); confirm(db,input); const before = inspect(db);
    assert.equal(confirm(db,input).changes,0); assert.deepEqual(inspect(db),before);
    for (const [i,value] of [[1,'other_confirm_key_1'],[2,0],[2,3],[3,'other'],[4,'changed-evidence'],[5,1001]]) {
      const changed = [...input]; changed[i]=value;
      assert.throws(() => confirm(db,changed),/CONFIRMATION_CONFLICT/); assert.deepEqual(inspect(db),before);
    }
    assert.throws(() => confirm(db,['other',input[1],1,'admin','evidence',1000]),/CONFIRMATION_CONFLICT/);
    assert.throws(() => confirm(db,command('verified',0)),/CONFIRMATION_CONFLICT/);
    assert.equal(scope(db,'verified').baseline_consumed,2);
    // Replaying an old receipt cannot replace it, even with SQLite REPLACE semantics.
    db.prepare('INSERT OR REPLACE INTO trial_project_history_confirmations VALUES(?,?,?,?,?,?)').run(...input);
    assert.deepEqual(inspect(db),before);
  } finally { db.close(); }
});

test('no silent zero; invalid baseline/evidence/admin/owner rejects without partial receipts or scopes', () => {
  const db = fixture(); try {
    const before=inspect(db);
    for (const bad of [null,-1,1.5,9007199254740992,'invalid']) {
      assert.throws(() => confirm(db,command('missing',bad))); assert.deepEqual(inspect(db),before);
    }
    for (const [i,v] of [[3,'user'],[3,'nonexistent'],[4,''],[4,'x'.repeat(1025)],[5,null],[5,1.5]]) {
      const input=command('missing');input[i]=v;assert.throws(() => confirm(db,input));assert.deepEqual(inspect(db),before);
    }
    assert.throws(() => confirm(db,command('nonexistent')));assert.deepEqual(inspect(db),before);
    assert.equal(scope(db).history_status,'unknown');assert.deepEqual(scope(db,'missing'),{});
  } finally { db.close(); }
});

test('direct scope mutation/REPLACE and history UPDATE/DELETE cannot reset quota', () => {
  const db = fixture(); try {
    assert.throws(() => db.exec("UPDATE trial_project_admission_scopes SET history_status='verified',baseline_consumed=0 WHERE user_id='user'"),/MIGRATION_POLICY_REQUIRED/);
    confirm(db,command()); const before=inspect(db);
    for (const statement of [
      "UPDATE trial_project_admission_scopes SET baseline_consumed=0 WHERE user_id='user'",
      "UPDATE trial_project_admission_scopes SET baseline_consumed=1 WHERE user_id='user'",
      "UPDATE trial_project_admission_scopes SET history_status='unknown',baseline_consumed=NULL WHERE user_id='user'",
      "INSERT OR REPLACE INTO trial_project_admission_scopes VALUES('user','verified',0)",
      "DELETE FROM trial_project_admission_scopes WHERE user_id='user'",
      "UPDATE trial_project_history_confirmations SET baseline_consumed=0 WHERE user_id='user'",
      "DELETE FROM trial_project_history_confirmations WHERE user_id='user'",
    ]) { assert.throws(() => db.exec(statement));assert.deepEqual(inspect(db),before); }
  } finally { db.close(); }
});

test('injected scope UPDATE/INSERT/assertion failure rolls receipt and scope back', () => {
  const db = fixture(); try {
    const before=inspect(db);
    db.exec("CREATE TRIGGER fail_scope BEFORE UPDATE ON trial_project_admission_scopes BEGIN SELECT RAISE(ABORT,'injected update'); END");
    assert.throws(() => confirm(db,command()),/injected update/);assert.deepEqual(inspect(db),before);
    db.exec('DROP TRIGGER fail_scope');
    db.exec("CREATE TRIGGER fail_scope BEFORE INSERT ON trial_project_admission_scopes BEGIN SELECT RAISE(ABORT,'injected insert'); END");
    assert.throws(() => confirm(db,command('missing')),/injected insert/);assert.deepEqual(inspect(db),before);
    db.exec('DROP TRIGGER fail_scope');
    // Simulate a skipped conditional update: the unconditional final assertion must abort.
    db.exec("CREATE TRIGGER skip_scope BEFORE UPDATE ON trial_project_admission_scopes BEGIN SELECT RAISE(IGNORE); END");
    assert.throws(() => confirm(db,command()),/CONFIRMATION_INCOMPLETE/);assert.deepEqual(inspect(db),before);
  } finally { db.close(); }
});

// Same admission/project/completion SQL transaction as inactive createTrialProject, no HTTP or AI.
function create(db, i, fail = false) {
  const id='new_project_'+i,key='create_request_key_'+i;
  db.exec('BEGIN');try {
    db.prepare(`INSERT INTO trial_project_admissions(user_id,idempotency_key,project_id,request_identity,created_at_ms,creation_mode)
      VALUES('user',?,?,?,2000,'atomic') ON CONFLICT(user_id,idempotency_key) DO NOTHING`).run(key,id,'frozen');
    db.prepare(`INSERT INTO projects(id,user_id,title,description)
      SELECT ?,'user','Neues Projekt',NULL FROM trial_project_admissions a
      WHERE a.user_id='user' AND a.idempotency_key=? AND a.project_id=? AND a.creation_mode='atomic'
      AND NOT EXISTS(SELECT 1 FROM trial_project_completions c WHERE c.user_id='user' AND c.idempotency_key=?)`).run(id,key,id,key);
    if (fail) throw Error('injected project failure');
    db.prepare(`INSERT INTO trial_project_completions(user_id,idempotency_key) VALUES('user',?)
      ON CONFLICT(user_id,idempotency_key) DO NOTHING`).run(key);
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK');throw e; }
}
test('baseline plus admissions enforces lifetime 3; atomic rollback/retry/deleted tombstone and account cascade survive', () => {
  const db=fixture();try {
    assert.throws(() => create(db,0),/HISTORY_REQUIRED/);confirm(db,command('user',1));
    const before=inspect(db);assert.throws(() => create(db,0,true),/injected/);assert.deepEqual(inspect(db),before);
    create(db,0);create(db,1);assert.throws(() => create(db,2),/LIFETIME_PROJECT_LIMIT/);
    create(db,0);assert.equal(count(db,'trial_project_admissions'),2);
    db.exec("UPDATE projects SET title='edited' WHERE user_id='user'; DELETE FROM projects WHERE user_id='user'");
    create(db,0);assert.equal(count(db,'projects'),0);assert.equal(count(db,'trial_project_admissions'),2);
    assert.throws(() => create(db,3),/LIFETIME_PROJECT_LIMIT/);
    assert.throws(() => db.exec("DELETE FROM trial_project_admissions WHERE user_id='user'"),/IMMUTABLE/);
    assert.throws(() => db.exec("DELETE FROM trial_project_completions WHERE user_id='user'"),/IMMUTABLE/);
    // Historical admin identity does not prevent admin deletion or mutate the receipt.
    db.exec("DELETE FROM users WHERE id='admin'");assert.equal(count(db,'trial_project_history_confirmations'),1);
    db.exec("DELETE FROM users WHERE id='user'");
    for (const t of ['trial_project_admissions','trial_project_completions','trial_project_history_confirmations'])assert.equal(count(db,t),0);
    assert.deepEqual(scope(db),{});assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  } finally {db.close();}
});
