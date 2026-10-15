import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hashSessionToken = async token => createHash('sha256').update(token).digest('hex');

// D1 bind() is positional even for ?1/?2 SQL. Normalize only the local
// fixture's placeholders to named bindings, avoiding Node-version differences
// for both indexed parameters and mixtures of indexed/anonymous parameters.
function sqliteBinding(sql, args) {
  const names = new Map();
  let count = 0;
  // Ignore placeholders inside SQL strings, quoted identifiers and comments.
  const tokens = /'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\/|\?(\d+)?/g;
  const normalizedSql = sql.replace(tokens, (token, digits) => {
    if (!token.startsWith('?')) return token;
    const index = digits === undefined ? count + 1 : Number(digits);
    if (!Number.isSafeInteger(index) || index < 1) throw new RangeError('Invalid SQLite parameter index');
    count = Math.max(count, index);
    const name = `:__d1_arg_${index}`;
    names.set(index, name);
    return name;
  });
  if (args.length !== count) throw new RangeError(`Expected ${count} SQL bind values, received ${args.length}`);
  if (names.size === 0) return { sql: normalizedSql, args: [] };
  const named = Object.fromEntries([...names].map(([index, name]) => [name, args[index - 1]]));
  return { sql: normalizedSql, args: [named] };
}

export function createD1Database(db) {
  const prepare = sql => ({
    args: [],
    bind(...args) { this.args = args; return this; },
    async first() {
      const binding = sqliteBinding(sql, this.args);
      return db.prepare(binding.sql).get(...binding.args) ?? null;
    },
    execute() {
      const binding = sqliteBinding(sql, this.args);
      if (/^\s*SELECT/i.test(sql)) return { results: db.prepare(binding.sql).all(...binding.args), meta: { changes: 0 } };
      return { results: [], meta: { changes: Number(db.prepare(binding.sql).run(...binding.args).changes) } };
    },
    async run() { return this.execute(); },
    async all() { return this.execute(); },
  });
  return { prepare, async batch(statements) {
    db.exec('BEGIN');
    try { const results = statements.map(s => s.execute()); db.exec('COMMIT'); return results; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } };
}

// Local fixture only. SQL TASK is explicitly applied to in-memory SQLite, never production D1.
export async function fixture({ applyProjectTask = true } = {}) {
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
  const env = { DB: createD1Database(db) };
  for (const migration of ['2026-09-22-projects-v1.sql','2026-09-22-project-media-v1.sql','2026-09-24-generated-contents-v1.sql']) db.exec(readFileSync(new URL('../../database/migrations/' + migration, import.meta.url),'utf8'));
  if (applyProjectTask) db.exec(readFileSync(new URL('../../database/tasks/2026-10-06-project-management-trial-v1.sql', import.meta.url), 'utf8'));
  return { db, env };
}
