import type { Env } from './env';
import { hashSessionToken } from './session';
import { json } from './response';
import type { PlanCode } from './entitlements';

export type UserRow = {
  id: string;
  email: string;
  email_verified: number;
  role: 'user' | 'admin';
  plan: PlanCode;
  plan_source: 'system' | 'manual_admin' | 'stripe';
  trial_expires_at: string | null;
  plan_updated_at: string | null;
  created_at: string;
};

export const USER_COLUMNS = 'id, email, email_verified, role, plan, plan_source, trial_expires_at, plan_updated_at, created_at';

export function serializeUser(user: UserRow) {
  return {
    id: user.id, email: user.email, role: user.role, plan: user.plan,
    planSource: user.plan_source, trialExpiresAt: user.trial_expires_at,
    planUpdatedAt: user.plan_updated_at, createdAt: user.created_at,
  };
}

// Reuse the existing session cookie, hashing and sessions table. No admin token.
type AuthenticatedUser = UserRow & { session_expires_at: string };

export async function requireUser(request: Request, env: Env): Promise<AuthenticatedUser | Response> {
  const cookie = request.headers.get('Cookie') ?? '';
  const token = cookie.split(';').map(part => part.trim()).find(part => part.startsWith('dfbk_session='))?.slice('dfbk_session='.length);
  if (!token || token.length > 512) return json({ ok: false, error: 'NOT_AUTHENTICATED' }, 401);
  const hash = await hashSessionToken(token);
  const user = await env.DB.prepare(`
    SELECT ${USER_COLUMNS.split(', ').map(column => `u.${column}`).join(', ')},
      s.expires_at AS session_expires_at, s.revoked_at,
      CASE WHEN julianday(s.expires_at) > julianday('now') THEN 1 ELSE 0 END AS session_active
    FROM users u JOIN sessions s ON s.user_id = u.id
    WHERE s.token_hash = ?1 LIMIT 1
  `).bind(hash).first<AuthenticatedUser & { revoked_at: string | null; session_active: number }>();
  if (!user) return json({ ok: false, error: 'INVALID_SESSION' }, 401);
  if (user.revoked_at !== null) return json({ ok: false, error: 'SESSION_REVOKED' }, 401);
  if (!user.session_active) return json({ ok: false, error: 'SESSION_EXPIRED' }, 401);
  return user;
}

export async function requireAdmin(request: Request, env: Env): Promise<UserRow | Response> {
  const user = await requireUser(request, env);
  if (user instanceof Response) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
  return user.role === 'admin' ? user : json({ ok: false, error: 'ADMIN_REQUIRED' }, 403);
}

export function isValidTrialExpiration(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return false;
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19).replace('T', ' ') === value;
}

export function isTrialActive(user: Pick<UserRow, 'plan' | 'trial_expires_at'>, serverNow = Date.now()): boolean {
  if (user.plan !== 'trial') return false;
  if (user.trial_expires_at === null) return true;
  if (!isValidTrialExpiration(user.trial_expires_at)) return false;
  return Date.parse(user.trial_expires_at.replace(' ', 'T') + 'Z') > serverNow;
}

export function getUserPlanState(user: UserRow) {
  return { plan: user.plan, source: user.plan_source, trialExpiresAt: user.trial_expires_at, trialActive: isTrialActive(user) };
}
