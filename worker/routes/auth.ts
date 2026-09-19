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


type RegisterBody = {
  email?: string;
  password?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

type CurrentSessionRow = {
  session_id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  email: string;
  email_verified: number;
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
  let body: RegisterBody;

  try {
    body = await request.json<RegisterBody>();
  } catch {
    return json(
      { ok: false, error: 'INVALID_JSON' },
      400
    );
  }

  const email = normalizeEmail(body.email ?? '');
  const password = body.password ?? '';

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
  let body: LoginBody;

  try {
    body = await request.json<LoginBody>();
  } catch {
    return json(
      { ok: false, error: 'INVALID_JSON' },
      400
    );
  }

  const email = normalizeEmail(body.email ?? '');
  const password = body.password ?? '';

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
          google_sub
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
            google_sub
          FROM users
          WHERE email = ?1
          LIMIT 1
          `
        )
        .bind(email)
        .first<GoogleDbUser>();

      if (emailUser) {
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
 * CURRENT USER
 * ========================================================= */

async function getCurrentUser(
  request: Request,
  env: Env
): Promise<Response> {
  const sessionToken = getCookie(
    request,
    'dfbk_session'
  );

  if (!sessionToken) {
    return json(
      { ok: false, error: 'NOT_AUTHENTICATED' },
      401
    );
  }

  const tokenHash = await hashSessionToken(
    sessionToken
  );

  const session = await env.DB
    .prepare(
      `
      SELECT
        sessions.id AS session_id,
        sessions.user_id,
        sessions.expires_at,
        sessions.revoked_at,
        users.email,
        users.email_verified
      FROM sessions
      INNER JOIN users
        ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?1
      LIMIT 1
      `
    )
    .bind(tokenHash)
    .first<CurrentSessionRow>();

  if (!session) {
    return json(
      { ok: false, error: 'INVALID_SESSION' },
      401
    );
  }

  if (session.revoked_at !== null) {
    return json(
      { ok: false, error: 'SESSION_REVOKED' },
      401
    );
  }

  const expiresAt = new Date(
    session.expires_at
  );

  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return json(
      { ok: false, error: 'SESSION_EXPIRED' },
      401
    );
  }

  return json(
    {
      ok: true,
      user: {
        id: session.user_id,
        email: session.email,
        emailVerified:
          session.email_verified === 1,
      },
      session: {
        expiresAt: session.expires_at,
      },
    },
    200
  );
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
