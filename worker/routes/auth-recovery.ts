import { createAuthToken, getEmailVerificationExpiry, hashAuthToken } from '../lib/auth-token';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/email';
import type { Env } from '../lib/env';
import { hashPassword } from '../lib/password';

const FORGOT = '/api/auth/forgot-password';
const RESET = '/api/auth/reset-password';
const RESEND = '/api/auth/resend-verification';
const ACCOUNT_ORIGIN = 'https://dfbk.app';
const MAX_BYTES = 4096;
const PASSWORD_RESET_SECONDS = 30 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function response(body: object, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

async function readFields(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing body');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new RangeError('Request too large');
      }
      text += decoder.decode(value, { stream: true });
    }
    const body: unknown = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SyntaxError('Invalid body');
    return body as Record<string, unknown>;
  } finally {
    reader.releaseLock();
  }
}

async function sendAccountLink(env: Env, email: string, reset: boolean) {
  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ?1 AND email_verified = ?2 AND password_hash LIKE 'pbkdf2$%'"
  ).bind(email, reset ? 1 : 0).first<{ id: string }>();
  if (!user) return;

  const token = createAuthToken();
  const tokenHash = await hashAuthToken(token);
  if (reset) {
    const saved = await env.DB.prepare(
      "INSERT INTO password_reset_tokens (user_id, token_hash, requested_at, expires_at) " +
      "VALUES (?1, ?2, unixepoch(), unixepoch() + ?3) " +
      "ON CONFLICT(user_id) DO UPDATE SET token_hash = excluded.token_hash, " +
      "requested_at = excluded.requested_at, expires_at = excluded.expires_at, consumed = 0 " +
      "WHERE password_reset_tokens.requested_at <= unixepoch() - 60"
    ).bind(user.id, tokenHash, PASSWORD_RESET_SECONDS).run();
    if (saved.meta.changes === 1) {
      await sendPasswordResetEmail(env, email, ACCOUNT_ORIGIN + '/reset-password#token=' + token);
    }
    return;
  }

  const saved = await env.DB.prepare(
    "INSERT INTO auth_tokens (id, user_id, token_hash, type, expires_at) " +
    "SELECT ?1, id, ?2, 'verify_email', ?3 FROM users " +
    "WHERE id = ?4 AND email_verified = 0 AND NOT EXISTS (" +
    "SELECT 1 FROM auth_tokens WHERE user_id = ?4 AND type = 'verify_email' " +
    "AND julianday(expires_at) > julianday('now', '+1439 minutes'))"
  ).bind(crypto.randomUUID(), tokenHash, getEmailVerificationExpiry().toISOString(), user.id).run();
  if (saved.meta.changes === 1) {
    await sendVerificationEmail(env, {
      to: email,
      verificationUrl: ACCOUNT_ORIGIN + '/api/auth/verify-email?token=' + token,
    });
  }
}

async function resetPassword(env: Env, fields: Record<string, unknown>) {
  const { token, password } = fields;
  const invalidLink = () => response({ error: 'INVALID_RESET_LINK' }, 410);
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return invalidLink();
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return response({ error: 'INVALID_NEW_PASSWORD' }, 400);
  }

  const tokenHash = await hashAuthToken(token);
  const reset = await env.DB.prepare(
    'SELECT user_id FROM password_reset_tokens WHERE token_hash = ?1 AND consumed = 0 AND expires_at > unixepoch()'
  ).bind(tokenHash).first<{ user_id: string }>();
  if (!reset) return invalidLink();

  const passwordHash = await hashPassword(password);
  // The token predicate guards the password update. The newly salted hash
  // identifies that update for the other statements in the same transaction.
  const [updated] = await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET password_hash = ?1 WHERE id = ?2 AND email_verified = 1 " +
      "AND password_hash LIKE 'pbkdf2$%' AND EXISTS (SELECT 1 FROM password_reset_tokens " +
      "WHERE user_id = ?2 AND token_hash = ?3 AND consumed = 0 AND expires_at > unixepoch())"
    ).bind(passwordHash, reset.user_id, tokenHash),
    env.DB.prepare(
      "UPDATE password_reset_tokens SET consumed = 1 WHERE user_id = ?1 AND token_hash = ?2 " +
      "AND EXISTS (SELECT 1 FROM users WHERE id = ?1 AND password_hash = ?3)"
    ).bind(reset.user_id, tokenHash, passwordHash),
    env.DB.prepare(
      "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?1 AND revoked_at IS NULL " +
      "AND EXISTS (SELECT 1 FROM users WHERE id = ?1 AND password_hash = ?2)"
    ).bind(reset.user_id, passwordHash),
  ]);
  return updated.meta.changes === 1 ? response({ ok: true }) : invalidLink();
}

export async function handleAuthRecovery(
  request: Request,
  env: Env,
  url: URL,
  ctx: Pick<ExecutionContext, 'waitUntil'>
): Promise<Response | null> {
  const { pathname } = url;
  if (pathname !== FORGOT && pathname !== RESET && pathname !== RESEND) return null;
  if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'POST' });
  if (url.protocol !== 'https:' || request.headers.get('Origin') !== url.origin) {
    return response({ error: 'INVALID_ORIGIN' }, 403);
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return response({ error: 'INVALID_CONTENT_TYPE' }, 415);
  }
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) {
    return response({ error: 'REQUEST_TOO_LARGE' }, 413);
  }

  const ip = request.headers.get('CF-Connecting-IP');
  const limiter = env.AUTH_RECOVERY_LIMIT;
  if (!ip || !limiter || (pathname !== RESET && (!env.RESEND_API_KEY || !env.EMAIL_FROM))) {
    return response({ error: 'AUTH_RECOVERY_UNAVAILABLE' }, 503);
  }

  try {
    const limit = await limiter.limit({ key: pathname + ':' + ip });
    if (!limit.success) return response({ error: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });

    let fields: Record<string, unknown>;
    try {
      fields = await readFields(request);
    } catch (error) {
      return error instanceof RangeError
        ? response({ error: 'REQUEST_TOO_LARGE' }, 413)
        : response({ error: 'INVALID_REQUEST_BODY' }, 400);
    }
    if (pathname === RESET) return await resetPassword(env, fields);

    const email = typeof fields.email === 'string' ? fields.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response({ error: 'INVALID_EMAIL' }, 400);
    }

    // Database lookup and mail delivery happen outside the response path for every address.
    ctx.waitUntil(sendAccountLink(env, email, pathname === FORGOT).catch(() => {
      console.error(pathname === FORGOT ? 'PASSWORD_RESET_EMAIL_FAILED' : 'VERIFICATION_RESEND_FAILED');
    }));
    return response({ ok: true }, 202);
  } catch {
    console.error('AUTH_RECOVERY_REQUEST_FAILED');
    return response({ error: 'AUTH_RECOVERY_UNAVAILABLE' }, 503);
  }
}
