import type { Env } from '../lib/env';
import { json } from '../lib/response';
import { hashSessionToken } from '../lib/session';
import {
  buildEntitlements,
  getUserPlan,
  isPlanCode,
  setUserPlan,
} from '../lib/entitlements';

type SessionRow = {
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
};

type UserRow = {
  id: string;
};

type PlanBody = {
  plan?: unknown;
};

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [cookieName, ...cookieValueParts] = cookie.trim().split('=');

    if (cookieName === name) {
      return cookieValueParts.join('=') || null;
    }
  }

  return null;
}

async function getAuthenticatedUserId(
  request: Request,
  env: Env
): Promise<string | Response> {
  const sessionToken = getCookie(request, 'dfbk_session');

  if (!sessionToken) {
    return json({ ok: false, error: 'NOT_AUTHENTICATED' }, 401);
  }

  const tokenHash = await hashSessionToken(sessionToken);

  const session = await env.DB
    .prepare(
      `
      SELECT
        user_id,
        expires_at,
        revoked_at
      FROM sessions
      WHERE token_hash = ?1
      LIMIT 1
      `
    )
    .bind(tokenHash)
    .first<SessionRow>();

  if (!session) {
    return json({ ok: false, error: 'INVALID_SESSION' }, 401);
  }

  if (session.revoked_at !== null) {
    return json({ ok: false, error: 'SESSION_REVOKED' }, 401);
  }

  const expiresAt = new Date(session.expires_at);

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return json({ ok: false, error: 'SESSION_EXPIRED' }, 401);
  }

  return session.user_id;
}

function hasValidAdminAuthorization(request: Request, env: Env): boolean {
  if (!env.ADMIN_API_KEY) {
    return false;
  }

  const authorization = request.headers.get('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 && token === env.ADMIN_API_KEY;
}

async function getAccountEntitlements(
  request: Request,
  env: Env
): Promise<Response> {
  const authenticatedUser = await getAuthenticatedUserId(request, env);

  if (authenticatedUser instanceof Response) {
    return authenticatedUser;
  }

  try {
    const plan = await getUserPlan(env, authenticatedUser);
    return json(buildEntitlements(plan), 200);
  } catch (error) {
    console.error('ACCOUNT_ENTITLEMENTS_READ_ERROR', error);
    return json({ ok: false, error: 'ENTITLEMENTS_READ_FAILED' }, 500);
  }
}

async function setAdminUserPlan(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (!hasValidAdminAuthorization(request, env)) {
    return json({ ok: false, error: 'ADMIN_UNAUTHORIZED' }, 401);
  }

  let body: PlanBody;

  try {
    body = await request.json<PlanBody>();
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  if (!isPlanCode(body.plan)) {
    return json({ ok: false, error: 'INVALID_PLAN' }, 400);
  }

  try {
    const user = await env.DB
      .prepare(
        `
        SELECT id
        FROM users
        WHERE id = ?1
        LIMIT 1
        `
      )
      .bind(userId)
      .first<UserRow>();

    if (!user) {
      return json({ ok: false, error: 'USER_NOT_FOUND' }, 404);
    }

    await setUserPlan(env, userId, body.plan);

    return json(
      {
        ok: true,
        userId,
        plan: body.plan,
      },
      200
    );
  } catch (error) {
    console.error('ADMIN_ENTITLEMENT_UPDATE_ERROR', error);
    return json({ ok: false, error: 'ENTITLEMENT_UPDATE_FAILED' }, 500);
  }
}

export async function handleEntitlements(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  if (
    pathname === '/api/account/entitlements' &&
    request.method === 'GET'
  ) {
    return getAccountEntitlements(request, env);
  }

  const adminMatch = pathname.match(
    /^\/api\/admin\/users\/([^/]+)\/plan$/
  );

  if (!adminMatch || request.method !== 'POST') {
    return null;
  }

  const userId = decodeURIComponent(adminMatch[1]).trim();

  if (!userId) {
    return json({ ok: false, error: 'INVALID_USER_ID' }, 400);
  }

  return setAdminUserPlan(request, env, userId);
}
