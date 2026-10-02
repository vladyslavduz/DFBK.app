import type { Env } from '../lib/env';
import { json } from '../lib/response';
import { isPlanCode } from '../lib/entitlements';
import { requireAdmin, serializeUser, USER_COLUMNS, isValidTrialExpiration, type UserRow } from '../lib/user';

const MAX_BODY_BYTES = 1024;

export async function handleAdmin(request: Request, env: Env, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith('/api/admin/')) return null;
  try {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    if (pathname === '/api/admin/me' && request.method === 'GET') {
      return json({ id: admin.id, email: admin.email, role: admin.role });
    }
    if (pathname === '/api/admin/users' && request.method === 'GET') {
      const url = new URL(request.url);
      const emails = url.searchParams.getAll('email');
      const email = emails[0]?.trim().toLowerCase();
      if (emails.length !== 1 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ ok: false, error: 'INVALID_EMAIL' }, 400);
      }
      const user = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?1 LIMIT 1`).bind(email).first<UserRow>();
      return user ? json({ user: serializeUser(user) }) : json({ ok: false, error: 'USER_NOT_FOUND' }, 404);
    }
    const match = pathname.match(/^\/api\/admin\/users\/([^/]+)\/plan$/);
    if (!match || request.method !== 'PATCH') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
    }
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({ ok: false, error: 'INVALID_CONTENT_TYPE' }, 415);
    }
    // Bound actual streamed bytes, including chunked requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ ok: false, error: 'INVALID_JSON' }, 400);
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); return json({ ok: false, error: 'REQUEST_TOO_LARGE' }, 413); }
      chunks.push(chunk.value);
    }
    let body: Record<string, unknown>;
    try {
      const joined = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
      body = JSON.parse(new TextDecoder().decode(joined));
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    } catch { return json({ ok: false, error: 'INVALID_JSON' }, 400); }
    if (!isPlanCode(body.plan)) return json({ ok: false, error: 'INVALID_PLAN' }, 400);
    const hasExpiry = Object.hasOwn(body, 'trialExpiresAt');
    if (hasExpiry && (body.plan !== 'trial' || !isValidTrialExpiration(body.trialExpiresAt))) {
      return json({ ok: false, error: 'INVALID_TRIAL_EXPIRATION' }, 400);
    }
    if (Object.keys(body).some(key => key !== 'plan' && key !== 'trialExpiresAt')) return json({ ok: false, error: 'INVALID_REQUEST' }, 400);
    let userId: string;
    try { userId = decodeURIComponent(match[1]); } catch { return json({ ok: false, error: 'INVALID_USER_ID' }, 400); }
    if (!userId || userId.length > 128) return json({ ok: false, error: 'INVALID_USER_ID' }, 400);
    const user = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?1 LIMIT 1`).bind(userId).first<UserRow>();
    if (!user) return json({ ok: false, error: 'USER_NOT_FOUND' }, 404);
    if (user.plan === body.plan && hasExpiry && user.trial_expires_at !== body.trialExpiresAt) {
      return json({ ok: false, error: 'TRIAL_EXPIRATION_CHANGE_NOT_SUPPORTED' }, 400);
    }
    const auditId = crypto.randomUUID();
    // Read old_value INSIDE the transaction. Concurrent same-plan requests insert no audit.
    // UPDATE depends on this specific audit ID; either both writes commit or neither does.
    const results = await env.DB.batch([
      env.DB.prepare(`INSERT INTO admin_audit_log (id, admin_user_id, target_user_id, action, old_value, new_value)
        SELECT ?1, ?2, id, 'USER_PLAN_CHANGED', plan, ?3 FROM users
        WHERE id = ?4 AND plan <> ?3`).bind(auditId, admin.id, body.plan, userId),
      env.DB.prepare(`UPDATE users SET plan = ?1, plan_source = 'manual_admin',
        trial_expires_at = ?2, plan_updated_at = CURRENT_TIMESTAMP
        WHERE id = ?3 AND EXISTS (SELECT 1 FROM admin_audit_log WHERE id = ?4)`)
        .bind(body.plan, body.plan === 'trial' && hasExpiry ? body.trialExpiresAt : null, userId, auditId),
      env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?1`).bind(userId),
    ]);
    const actual = results[2].results[0] as UserRow | undefined;
    if (!actual) return json({ ok: false, error: 'USER_NOT_FOUND' }, 404);
    return json({ changed: results[0].meta.changes > 0, user: serializeUser(actual) });
  } catch {
    console.error('ADMIN_REQUEST_FAILED');
    return json({ ok: false, error: 'PLAN_UPDATE_FAILED' }, 500);
  }
}
