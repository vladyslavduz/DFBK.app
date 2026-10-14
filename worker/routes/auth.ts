import { requireUser, serializeUser } from '../lib/user';
import type { Env } from '../lib/env';
import { json, notImplemented } from '../lib/response';

import {
  hashPassword,
  verifyPassword,
} from '../lib/password';

import {
  createSessionToken,
  hashSessionToken,
  getSessionExpiry,
  buildSessionCookie,
} from '../lib/session';

import {
  createAuthToken,
  hashAuthToken,
  getEmailVerificationExpiry,
} from '../lib/auth-token';

import {
  sendVerificationEmail,
} from '../lib/email';

import {
  buildGoogleAuthorizationUrl,
  buildGoogleStateCookie,
  clearGoogleStateCookie,
  createGoogleOAuthState,
  exchangeGoogleCode,
  fetchGoogleUser,
} from '../lib/google-oauth';
import {
  MicrosoftOAuthError,
  clearMicrosoftCookie,
  startMicrosoft,
  verifyMicrosoftAttempt,
  exchangeMicrosoftCode,
  validateMicrosoftIdentity,
  fetchMicrosoftProfile,
} from '../lib/microsoft-oauth';


type RegisterBody = {
  email?: string;
  password?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

type VerificationTokenRow = {
  id: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
  email: string;
  email_verified: number;
};

type GoogleDbUser = {
  id: string;
  email: string;
  email_verified: number;
  google_sub: string | null;
  microsoft_sub: string | null;
};

type CreatedSession = {
  token: string;
  expiresAt: Date;
};


function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasValidCredentialTypes(
  body: Record<string, unknown>
): boolean {
  return (
    (body.email === undefined || typeof body.email === 'string') &&
    (body.password === undefined || typeof body.password === 'string')
  );
}

function getCookie(
  request: Request,
  name: string
): string | null {
  const cookieHeader = request.headers.get('Cookie');

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [cookieName, ...cookieValueParts] =
      cookie.trim().split('=');

    if (cookieName === name) {
      return cookieValueParts.join('=') || null;
    }
  }

  return null;
}

function buildClearSessionCookie(): string {
  return [
    'dfbk_session=',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ].join('; ');
}

function safeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}

function buildGoogleResultUrl(
  request: Request,
  result: 'success' | 'error',
  reason?: string
): string {
  const url = new URL('/', request.url);
  url.searchParams.set('auth', `google_${result}`);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  return url.toString();
}

function redirectWithCookies(
  location: string,
  cookies: string[]
): Response {
  const headers = new Headers();
  headers.set('Location', location);
  headers.set('Cache-Control', 'no-store');
  headers.set('Referrer-Policy', 'no-referrer');

  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie);
  }

  return new Response(null, {
    status: 302,
    headers,
  });
}

async function createSessionForUser(
  env: Env,
  userId: string
): Promise<CreatedSession> {
  const sessionToken = createSessionToken();
  const tokenHash = await hashSessionToken(sessionToken);
  const sessionId = crypto.randomUUID();
  const expiresAt = getSessionExpiry();

  await env.DB
    .prepare(
      `
      INSERT INTO sessions (
        id,
        user_id,
        token_hash,
        expires_at
      )
      VALUES (?1, ?2, ?3, ?4)
      `
    )
    .bind(
      sessionId,
      userId,
      tokenHash,
      expiresAt.toISOString()
    )
    .run();

  return {
    token: sessionToken,
    expiresAt,
  };
}


export async function handleAuth(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  if (
    pathname === '/api/auth/register' &&
    request.method === 'POST'
  ) {
    return register(request, env);
  }

  if (
    pathname === '/api/auth/login' &&
    request.method === 'POST'
  ) {
    return login(request, env);
  }

  if (
    pathname === '/api/auth/me' &&
    request.method === 'GET'
  ) {
    return getCurrentUser(request, env);
  }

  if (
    pathname === '/api/auth/logout' &&
    request.method === 'POST'
  ) {
    return logout(request, env);
  }

  if (
    pathname === '/api/auth/verify-email' &&
    request.method === 'GET'
  ) {
    return verifyEmail(request, env);
  }

  if (
    pathname === '/api/auth/google' &&
    request.method === 'GET'
  ) {
    return startGoogleAuth(env);
  }

  if (
    pathname === '/api/auth/google/callback' &&
    request.method === 'GET'
  ) {
    return googleCallback(request, env);
  }

  if (pathname === '/api/auth/microsoft' && request.method === 'GET') {
    return startMicrosoftAuth(request, env);
  }

  if (pathname === '/api/auth/microsoft/callback' && request.method === 'GET') {
    return microsoftCallback(request, env);
  }

  if (
    pathname === '/api/auth/forgot-password' &&
    request.method === 'POST'
  ) {
    return notImplemented(
      'auth.forgotPassword',
      ['RESEND_API_KEY']
    );
  }

  if (
    pathname === '/api/auth/reset-password' &&
    request.method === 'POST'
  ) {
    return notImplemented(
      'auth.resetPassword',
      ['RESEND_API_KEY']
    );
  }

  return null;
}


/* =========================================================
 * REGISTER
 * ========================================================= */

async function register(
  request: Request,
  env: Env
): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, error: 'INVALID_JSON' },
      400
    );
  }

  if (!isJsonObject(body) || !hasValidCredentialTypes(body)) {
    return json(
      { ok: false, error: 'INVALID_REQUEST_BODY' },
      400
    );
  }

  const registerBody = body as RegisterBody;
  const email = normalizeEmail(registerBody.email ?? '');
  const password = registerBody.password ?? '';

  if (!email || !password) {
    return json(
      { ok: false, error: 'EMAIL_AND_PASSWORD_REQUIRED' },
      400
    );
  }

  if (!isValidEmail(email)) {
    return json(
      { ok: false, error: 'INVALID_EMAIL' },
      400
    );
  }

  if (password.length < 8) {
    return json(
      { ok: false, error: 'PASSWORD_TOO_SHORT' },
      400
    );
  }

  const existingUser = await env.DB
    .prepare(
      `
      SELECT id
      FROM users
      WHERE email = ?1
      LIMIT 1
      `
    )
    .bind(email)
    .first<{ id: string }>();

  if (existingUser) {
    return json(
      { ok: false, error: 'EMAIL_ALREADY_EXISTS' },
      409
    );
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const verificationToken = createAuthToken();
  const verificationTokenHash = await hashAuthToken(
    verificationToken
  );
  const verificationTokenId = crypto.randomUUID();
  const verificationExpiresAt = getEmailVerificationExpiry();

  try {
    await env.DB.batch([
      env.DB
        .prepare(
          `
          INSERT INTO users (
            id,
            email,
            password_hash,
            email_verified
          )
          VALUES (?1, ?2, ?3, 0)
          `
        )
        .bind(
          userId,
          email,
          passwordHash
        ),

      env.DB
        .prepare(
          `
          INSERT INTO auth_tokens (
            id,
            user_id,
            token_hash,
            type,
            expires_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5)
          `
        )
        .bind(
          verificationTokenId,
          userId,
          verificationTokenHash,
          'verify_email',
          verificationExpiresAt.toISOString()
        ),
    ]);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (
      message.includes('UNIQUE') ||
      message.includes('unique')
    ) {
      return json(
        { ok: false, error: 'EMAIL_ALREADY_EXISTS' },
        409
      );
    }

    console.error('REGISTER_DB_ERROR', error);

    return json(
      { ok: false, error: 'REGISTRATION_FAILED' },
      500
    );
  }

  const verificationUrl =
    `${new URL(request.url).origin}` +
    `/api/auth/verify-email` +
    `?token=${encodeURIComponent(verificationToken)}`;

  try {
    await sendVerificationEmail(
      env,
      {
        to: email,
        verificationUrl,
      }
    );
  } catch (error) {
    console.error(
      'VERIFICATION_EMAIL_SEND_ERROR',
      error
    );

    try {
      await env.DB
        .prepare(
          `
          DELETE FROM users
          WHERE id = ?1
          `
        )
        .bind(userId)
        .run();
    } catch (rollbackError) {
      console.error(
        'REGISTER_ROLLBACK_ERROR',
        rollbackError
      );
    }

    return json(
      { ok: false, error: 'VERIFICATION_EMAIL_FAILED' },
      502
    );
  }

  return json(
    {
      ok: true,
      user: {
        id: userId,
        email,
        emailVerified: false,
      },
      verificationEmailSent: true,
    },
    201
  );
}


/* =========================================================
 * VERIFY EMAIL
 * ========================================================= */

async function verifyEmail(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return json(
      { ok: false, error: 'VERIFICATION_TOKEN_REQUIRED' },
      400
    );
  }

  const tokenHash = await hashAuthToken(token);

  const verification = await env.DB
    .prepare(
      `
      SELECT
        auth_tokens.id,
        auth_tokens.user_id,
        auth_tokens.expires_at,
        auth_tokens.used_at,
        users.email,
        users.email_verified
      FROM auth_tokens
      INNER JOIN users
        ON users.id = auth_tokens.user_id
      WHERE auth_tokens.token_hash = ?1
        AND auth_tokens.type = 'verify_email'
      LIMIT 1
      `
    )
    .bind(tokenHash)
    .first<VerificationTokenRow>();

  if (!verification) {
    return json(
      { ok: false, error: 'INVALID_VERIFICATION_TOKEN' },
      400
    );
  }

  if (
    verification.used_at !== null &&
    verification.email_verified === 1
  ) {
    return json(
      {
        ok: true,
        alreadyVerified: true,
        user: {
          id: verification.user_id,
          email: verification.email,
          emailVerified: true,
        },
      },
      200
    );
  }

  if (verification.used_at !== null) {
    return json(
      { ok: false, error: 'VERIFICATION_TOKEN_ALREADY_USED' },
      400
    );
  }

  const expiresAt = new Date(verification.expires_at);

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return json(
      { ok: false, error: 'VERIFICATION_TOKEN_EXPIRED' },
      410
    );
  }

  try {
    await env.DB.batch([
      env.DB
        .prepare(
          `
          UPDATE users
          SET
            email_verified = 1,
            email_verified_at = CURRENT_TIMESTAMP
          WHERE id = ?1
          `
        )
        .bind(verification.user_id),

      env.DB
        .prepare(
          `
          UPDATE auth_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE id = ?1
            AND used_at IS NULL
          `
        )
        .bind(verification.id),
    ]);
  } catch (error) {
    console.error('VERIFY_EMAIL_DB_ERROR', error);

    return json(
      { ok: false, error: 'EMAIL_VERIFICATION_FAILED' },
      500
    );
  }

  return json(
    {
      ok: true,
      user: {
        id: verification.user_id,
        email: verification.email,
        emailVerified: true,
      },
    },
    200
  );
}


/* =========================================================
 * LOGIN
 * ========================================================= */

async function login(
  request: Request,
  env: Env
): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, error: 'INVALID_JSON' },
      400
    );
  }

  if (!isJsonObject(body) || !hasValidCredentialTypes(body)) {
    return json(
      { ok: false, error: 'INVALID_REQUEST_BODY' },
      400
    );
  }

  const loginBody = body as LoginBody;
  const email = normalizeEmail(loginBody.email ?? '');
  const password = loginBody.password ?? '';

  if (!email || !password) {
    return json(
      { ok: false, error: 'EMAIL_AND_PASSWORD_REQUIRED' },
      400
    );
  }

  const user = await env.DB
    .prepare(
      `
      SELECT
        id,
        email,
        password_hash,
        email_verified
      FROM users
      WHERE email = ?1
      LIMIT 1
      `
    )
    .bind(email)
    .first<{
      id: string;
      email: string;
      password_hash: string;
      email_verified: number;
    }>();

  if (!user) {
    return json(
      { ok: false, error: 'INVALID_CREDENTIALS' },
      401
    );
  }

  const passwordValid = await verifyPassword(
    password,
    user.password_hash
  );

  if (!passwordValid) {
    return json(
      { ok: false, error: 'INVALID_CREDENTIALS' },
      401
    );
  }

  if (user.email_verified !== 1) {
    return json(
      { ok: false, error: 'EMAIL_NOT_VERIFIED' },
      403
    );
  }

  let session: CreatedSession;

  try {
    session = await createSessionForUser(
      env,
      user.id
    );
  } catch (error) {
    console.error(
      'LOGIN_SESSION_DB_ERROR',
      error
    );

    return json(
      { ok: false, error: 'SESSION_CREATION_FAILED' },
      500
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type':
          'application/json; charset=UTF-8',
        'Set-Cookie':
          buildSessionCookie(
            session.token,
            session.expiresAt
          ),
      },
    }
  );
}


/* =========================================================
 * GOOGLE OAUTH
 * ========================================================= */

function startGoogleAuth(
  env: Env
): Response {
  try {
    const state = createGoogleOAuthState();
    const authorizationUrl =
      buildGoogleAuthorizationUrl(
        env,
        state
      );

    return redirectWithCookies(
      authorizationUrl,
      [buildGoogleStateCookie(state)]
    );
  } catch (error) {
    console.error(
      'GOOGLE_AUTH_START_ERROR',
      error
    );

    return json(
      { ok: false, error: 'GOOGLE_OAUTH_NOT_CONFIGURED' },
      500
    );
  }
}

async function googleCallback(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const storedState = getCookie(
    request,
    'dfbk_google_oauth_state'
  );

  if (oauthError) {
    return redirectWithCookies(
      buildGoogleResultUrl(
        request,
        'error',
        oauthError
      ),
      [clearGoogleStateCookie()]
    );
  }

  if (
    !code ||
    !returnedState ||
    !storedState ||
    !safeEqualStrings(returnedState, storedState)
  ) {
    return redirectWithCookies(
      buildGoogleResultUrl(
        request,
        'error',
        'invalid_state'
      ),
      [clearGoogleStateCookie()]
    );
  }

  try {
    const accessToken = await exchangeGoogleCode(
      env,
      code
    );

    const googleUser = await fetchGoogleUser(
      accessToken
    );

    if (!googleUser.email_verified) {
      return redirectWithCookies(
        buildGoogleResultUrl(
          request,
          'error',
          'google_email_not_verified'
        ),
        [clearGoogleStateCookie()]
      );
    }

    const email = normalizeEmail(
      googleUser.email
    );

    let dbUser = await env.DB
      .prepare(
        `
        SELECT
          id,
          email,
          email_verified,
          google_sub,
          microsoft_sub
        FROM users
        WHERE google_sub = ?1
        LIMIT 1
        `
      )
      .bind(googleUser.sub)
      .first<GoogleDbUser>();

    if (!dbUser) {
      const emailUser = await env.DB
        .prepare(
          `
          SELECT
            id,
            email,
            email_verified,
            google_sub,
            microsoft_sub
          FROM users
          WHERE email = ?1
          LIMIT 1
          `
        )
        .bind(email)
        .first<GoogleDbUser>();

      if (emailUser) {
        // A Microsoft profile email can be unverified. Never merge its account
        // into a Google identity by matching that unverified address.
        if (emailUser.microsoft_sub && emailUser.email_verified !== 1) {
          return redirectWithCookies(
            buildGoogleResultUrl(request, 'error', 'account_link_required'),
            [clearGoogleStateCookie()]
          );
        }
        if (
          emailUser.google_sub &&
          emailUser.google_sub !== googleUser.sub
        ) {
          return redirectWithCookies(
            buildGoogleResultUrl(
              request,
              'error',
              'google_account_conflict'
            ),
            [clearGoogleStateCookie()]
          );
        }

        await env.DB
          .prepare(
            `
            UPDATE users
            SET
              google_sub = ?1,
              email_verified = 1,
              email_verified_at = COALESCE(
                email_verified_at,
                CURRENT_TIMESTAMP
              )
            WHERE id = ?2
            `
          )
          .bind(
            googleUser.sub,
            emailUser.id
          )
          .run();

        dbUser = {
          ...emailUser,
          google_sub: googleUser.sub,
          email_verified: 1,
        };
      } else {
        const userId = crypto.randomUUID();

        const passwordMarker =
          `oauth$google$${crypto.randomUUID()}`;

        await env.DB
          .prepare(
            `
            INSERT INTO users (
              id,
              email,
              password_hash,
              email_verified,
              email_verified_at,
              google_sub
            )
            VALUES (?1, ?2, ?3, 1, CURRENT_TIMESTAMP, ?4)
            `
          )
          .bind(
            userId,
            email,
            passwordMarker,
            googleUser.sub
          )
          .run();

        dbUser = {
          id: userId,
          email,
          email_verified: 1,
          google_sub: googleUser.sub,
          microsoft_sub: null,
        };
      }
    }

    const session = await createSessionForUser(
      env,
      dbUser.id
    );

    return redirectWithCookies(
      buildGoogleResultUrl(
        request,
        'success'
      ),
      [
        clearGoogleStateCookie(),
        buildSessionCookie(
          session.token,
          session.expiresAt
        ),
      ]
    );
  } catch (error) {
    console.error(
      'GOOGLE_CALLBACK_ERROR',
      error
    );

    return redirectWithCookies(
      buildGoogleResultUrl(
        request,
        'error',
        'callback_failed'
      ),
      [clearGoogleStateCookie()]
    );
  }
}

/* =========================================================
 * MICROSOFT OAUTH — identity is the signed (tenant, subject), never email.
 * Existing email accounts can be linked only from an authenticated session.
 * ========================================================= */

function microsoftResult(request: Request, result: 'success' | 'error', reason?: string): string {
  const url = new URL('/', request.url);
  url.searchParams.set('auth', `microsoft_${result}`);
  if (reason) url.searchParams.set('reason', reason);
  return url.toString();
}

async function startMicrosoftAuth(request: Request, env: Env): Promise<Response> {
  const link = new URL(request.url).searchParams.get('link') === '1';
  let sessionToken: string | undefined;
  let linkingUserId: string | null = null;
  if (link) {
    const referer = request.headers.get('Referer');
    const origin = request.headers.get('Origin');
    let refererOrigin = '';
    try { refererOrigin = referer ? new URL(referer).origin : ''; } catch {}
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
        (refererOrigin !== new URL(request.url).origin && origin !== new URL(request.url).origin)) {
      return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
    }
    const user = await requireUser(request, env);
    if (user instanceof Response) return user;
    linkingUserId = user.id;
    sessionToken = getCookie(request, 'dfbk_session') ?? undefined;
  }
  try {
    const attempt = await startMicrosoft(env, link ? 'link' : 'login', sessionToken);
    await env.DB.prepare(`INSERT INTO microsoft_oauth_states(state_hash,mode,user_id,expires_at)
      VALUES (?1,?2,?3,datetime('now','+10 minutes'))`)
      .bind(await hashSessionToken(attempt.state), link ? 'link' : 'login', linkingUserId).run();
    return redirectWithCookies(attempt.url, [attempt.cookie]);
  } catch {
    console.error('MICROSOFT_AUTH_START_FAILED');
    return json({ ok: false, error: 'MICROSOFT_OAUTH_NOT_CONFIGURED' }, 503);
  }
}

async function microsoftCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const fail = (reason: string) => redirectWithCookies(microsoftResult(request, 'error', reason), [clearMicrosoftCookie()]);
  const cookie = getCookie(request, 'dfbk_microsoft_oauth');
  let attempt: Awaited<ReturnType<typeof verifyMicrosoftAttempt>>;
  try {
    attempt = await verifyMicrosoftAttempt(env, cookie, url.searchParams.get('state'),
      getCookie(request, 'dfbk_session') ?? undefined);
  } catch { return fail('invalid_state'); }
  let linkingUserId: string | null = null;
  if (attempt.mode === 'link') {
    const current = await requireUser(request, env);
    if (current instanceof Response) return fail('invalid_session');
    linkingUserId = current.id;
  }
  try {
    const consumed = await env.DB.prepare(`UPDATE microsoft_oauth_states SET consumed_at=CURRENT_TIMESTAMP
      WHERE state_hash=?1 AND mode=?2 AND user_id IS ?3 AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP`)
      .bind(await hashSessionToken(attempt.state), attempt.mode, linkingUserId).run();
    if (!consumed.meta.changes) return fail('invalid_state');
  } catch { return fail('callback_failed'); }
  if (url.searchParams.has('error')) return fail('cancelled');
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) return fail('invalid_code');

  try {
    const { idToken, accessToken } = await exchangeMicrosoftCode(env, code, attempt.verifier);
    const identity = await validateMicrosoftIdentity(env, idToken, attempt.nonce);
    const email = await fetchMicrosoftProfile(accessToken, identity);
    const subject = `${identity.tid.toLowerCase()}:${identity.sub}`;
    const linked = await env.DB.prepare(`SELECT id FROM users WHERE microsoft_sub=?1 LIMIT 1`)
      .bind(subject).first<{ id: string }>();
    let userId: string;
    if (attempt.mode === 'link') {
      if (linked && linked.id !== linkingUserId) return fail('account_conflict');
      if (!linked) {
        const update = await env.DB.prepare(`UPDATE users SET microsoft_sub=?1 WHERE id=?2 AND microsoft_sub IS NULL`)
          .bind(subject, linkingUserId).run();
        if (!update.meta.changes) return fail('account_conflict');
      }
      userId = linkingUserId!;
    } else if (linked) {
      userId = linked.id;
    } else {
      if (!email) return fail('email_unavailable');
      // Microsoft email/UPN is not proof of ownership of an existing DFBK account.
      const existing = await env.DB.prepare(`SELECT id FROM users WHERE email=?1 LIMIT 1`)
        .bind(email).first<{ id: string }>();
      if (existing) return fail('account_link_required');
      userId = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO users(id,email,password_hash,email_verified,microsoft_sub)
        VALUES (?1,?2,?3,0,?4)`)
        .bind(userId, email, `oauth$microsoft$${crypto.randomUUID()}`, subject).run();
    }
    const session = await createSessionForUser(env, userId);
    return redirectWithCookies(microsoftResult(request, 'success'), [
      clearMicrosoftCookie(), buildSessionCookie(session.token, session.expiresAt),
    ]);
  } catch (error) {
    const reason = error instanceof MicrosoftOAuthError ? error.reason : 'callback_failed';
    // Fixed reason only: never log authorization codes, identity/access tokens, or provider bodies.
    console.error('MICROSOFT_CALLBACK_FAILED', reason);
    return fail(reason);
  }
}


/* =========================================================
 * CURRENT USER
 * ========================================================= */

async function getCurrentUser(
  request: Request,
  env: Env
): Promise<Response> {
  // Preserve the existing response fields and session expiry; add plan/role fields only.
  const user = await requireUser(request, env);
  if (user instanceof Response) return user;
  return json({ ok: true, user: { ...serializeUser(user), emailVerified: user.email_verified === 1 },
    session: { expiresAt: user.session_expires_at } });
}


/* =========================================================
 * LOGOUT
 * ========================================================= */

async function logout(
  request: Request,
  env: Env
): Promise<Response> {
  const sessionToken = getCookie(
    request,
    'dfbk_session'
  );

  if (!sessionToken) {
    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/json; charset=UTF-8',
          'Set-Cookie':
            buildClearSessionCookie(),
        },
      }
    );
  }

  const tokenHash = await hashSessionToken(
    sessionToken
  );

  try {
    await env.DB
      .prepare(
        `
        UPDATE sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = ?1
          AND revoked_at IS NULL
        `
      )
      .bind(tokenHash)
      .run();
  } catch (error) {
    console.error(
      'LOGOUT_SESSION_DB_ERROR',
      error
    );

    return json(
      { ok: false, error: 'LOGOUT_FAILED' },
      500
    );
  }

  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: {
        'Content-Type':
          'application/json; charset=UTF-8',
        'Set-Cookie':
          buildClearSessionCookie(),
      },
    }
  );
}
