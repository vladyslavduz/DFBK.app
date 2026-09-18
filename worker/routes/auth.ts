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

  const cookieHeader =
    request.headers.get('Cookie');

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader.split(';');

  for (const cookie of cookies) {

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


export async function handleAuth(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {

  /*
   * REGISTER
   */
  if (
    pathname === '/api/auth/register' &&
    request.method === 'POST'
  ) {
    return register(request, env);
  }


  /*
   * LOGIN
   */
  if (
    pathname === '/api/auth/login' &&
    request.method === 'POST'
  ) {
    return login(request, env);
  }


  /*
   * CURRENT USER
   */
  if (
    pathname === '/api/auth/me' &&
    request.method === 'GET'
  ) {
    return getCurrentUser(request, env);
  }


  /*
   * LOGOUT
   */
  if (
    pathname === '/api/auth/logout' &&
    request.method === 'POST'
  ) {
    return logout(request, env);
  }


  /*
   * VERIFY EMAIL
   */
  if (
    pathname === '/api/auth/verify-email' &&
    request.method === 'GET'
  ) {
    return verifyEmail(request, env);
  }


  /*
   * FORGOT PASSWORD
   */
  if (
    pathname === '/api/auth/forgot-password' &&
    request.method === 'POST'
  ) {
    return notImplemented(
      'auth.forgotPassword',
      ['RESEND_API_KEY']
    );
  }


  /*
   * RESET PASSWORD
   */
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


/*
 * =========================================================
 * REGISTER
 * =========================================================
 */

async function register(
  request: Request,
  env: Env
): Promise<Response> {

  let body: RegisterBody;

  try {
    body =
      await request.json<RegisterBody>();
  } catch {
    return json(
      {
        ok: false,
        error: 'INVALID_JSON',
      },
      400
    );
  }


  const email =
    normalizeEmail(body.email ?? '');

  const password =
    body.password ?? '';


  if (!email || !password) {
    return json(
      {
        ok: false,
        error: 'EMAIL_AND_PASSWORD_REQUIRED',
      },
      400
    );
  }


  if (!isValidEmail(email)) {
    return json(
      {
        ok: false,
        error: 'INVALID_EMAIL',
      },
      400
    );
  }


  if (password.length < 8) {
    return json(
      {
        ok: false,
        error: 'PASSWORD_TOO_SHORT',
      },
      400
    );
  }


  const existingUser =
    await env.DB
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
      {
        ok: false,
        error: 'EMAIL_ALREADY_EXISTS',
      },
      409
    );
  }


  const userId =
    crypto.randomUUID();

  const passwordHash =
    await hashPassword(password);


  const verificationToken =
    createAuthToken();

  const verificationTokenHash =
    await hashAuthToken(
      verificationToken
    );

  const verificationTokenId =
    crypto.randomUUID();

  const verificationExpiresAt =
    getEmailVerificationExpiry();


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
        {
          ok: false,
          error: 'EMAIL_ALREADY_EXISTS',
        },
        409
      );
    }


    console.error(
      'REGISTER_DB_ERROR',
      error
    );


    return json(
      {
        ok: false,
        error: 'REGISTRATION_FAILED',
      },
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


    /*
     * Если письмо не отправилось,
     * удаляем созданного пользователя.
     *
     * Благодаря ON DELETE CASCADE
     * связанный auth_token также удалится.
     */
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
      {
        ok: false,
        error: 'VERIFICATION_EMAIL_FAILED',
      },
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


/*
 * =========================================================
 * VERIFY EMAIL
 *
 * GET /api/auth/verify-email?token=...
 * =========================================================
 */

async function verifyEmail(
  request: Request,
  env: Env
): Promise<Response> {

  const url =
    new URL(request.url);

  const token =
    url.searchParams.get('token');


  if (!token) {

    return json(
      {
        ok: false,
        error: 'VERIFICATION_TOKEN_REQUIRED',
      },
      400
    );
  }


  const tokenHash =
    await hashAuthToken(token);


  const verification =
    await env.DB
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
      {
        ok: false,
        error: 'INVALID_VERIFICATION_TOKEN',
      },
      400
    );
  }


  /*
   * Если email уже подтверждён
   * и token уже использован,
   * повторный переход по ссылке
   * считаем успешным.
   */
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
      {
        ok: false,
        error: 'VERIFICATION_TOKEN_ALREADY_USED',
      },
      400
    );
  }


  const expiresAt =
    new Date(verification.expires_at);


  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {

    return json(
      {
        ok: false,
        error: 'VERIFICATION_TOKEN_EXPIRED',
      },
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
        .bind(
          verification.user_id
        ),

      env.DB
        .prepare(
          `
          UPDATE auth_tokens
          SET used_at = CURRENT_TIMESTAMP
          WHERE id = ?1
            AND used_at IS NULL
          `
        )
        .bind(
          verification.id
        ),

    ]);

  } catch (error) {

    console.error(
      'VERIFY_EMAIL_DB_ERROR',
      error
    );


    return json(
      {
        ok: false,
        error: 'EMAIL_VERIFICATION_FAILED',
      },
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


/*
 * =========================================================
 * LOGIN
 * =========================================================
 */

async function login(
  request: Request,
  env: Env
): Promise<Response> {

  let body: LoginBody;


  try {

    body =
      await request.json<LoginBody>();

  } catch {

    return json(
      {
        ok: false,
        error: 'INVALID_JSON',
      },
      400
    );
  }


  const email =
    normalizeEmail(body.email ?? '');

  const password =
    body.password ?? '';


  if (!email || !password) {

    return json(
      {
        ok: false,
        error: 'EMAIL_AND_PASSWORD_REQUIRED',
      },
      400
    );
  }


  const user =
    await env.DB
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
      {
        ok: false,
        error: 'INVALID_CREDENTIALS',
      },
      401
    );
  }


  const passwordValid =
    await verifyPassword(
      password,
      user.password_hash
    );


  if (!passwordValid) {

    return json(
      {
        ok: false,
        error: 'INVALID_CREDENTIALS',
      },
      401
    );
  }


  if (user.email_verified !== 1) {

    return json(
      {
        ok: false,
        error: 'EMAIL_NOT_VERIFIED',
      },
      403
    );
  }


  const sessionToken =
    createSessionToken();


  const tokenHash =
    await hashSessionToken(
      sessionToken
    );


  const sessionId =
    crypto.randomUUID();


  const expiresAt =
    getSessionExpiry();


  try {

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
        user.id,
        tokenHash,
        expiresAt.toISOString()
      )
      .run();

  } catch (error) {

    console.error(
      'LOGIN_SESSION_DB_ERROR',
      error
    );


    return json(
      {
        ok: false,
        error: 'SESSION_CREATION_FAILED',
      },
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
            sessionToken,
            expiresAt
          ),
      },
    }
  );
}


/*
 * =========================================================
 * CURRENT USER
 *
 * GET /api/auth/me
 * =========================================================
 */

async function getCurrentUser(
  request: Request,
  env: Env
): Promise<Response> {

  const sessionToken =
    getCookie(
      request,
      'dfbk_session'
    );


  if (!sessionToken) {

    return json(
      {
        ok: false,
        error: 'NOT_AUTHENTICATED',
      },
      401
    );
  }


  const tokenHash =
    await hashSessionToken(
      sessionToken
    );


  const session =
    await env.DB
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
      {
        ok: false,
        error: 'INVALID_SESSION',
      },
      401
    );
  }


  if (session.revoked_at !== null) {

    return json(
      {
        ok: false,
        error: 'SESSION_REVOKED',
      },
      401
    );
  }


  const expiresAt =
    new Date(session.expires_at);


  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {

    return json(
      {
        ok: false,
        error: 'SESSION_EXPIRED',
      },
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
        expiresAt:
          session.expires_at,
      },
    },
    200
  );
}


/*
 * =========================================================
 * LOGOUT
 *
 * POST /api/auth/logout
 * =========================================================
 */

async function logout(
  request: Request,
  env: Env
): Promise<Response> {

  const sessionToken =
    getCookie(
      request,
      'dfbk_session'
    );


  if (!sessionToken) {

    return new Response(
      JSON.stringify({
        ok: true,
      }),
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


  const tokenHash =
    await hashSessionToken(
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
      {
        ok: false,
        error: 'LOGOUT_FAILED',
      },
      500
    );
  }


  return new Response(
    JSON.stringify({
      ok: true,
    }),
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
