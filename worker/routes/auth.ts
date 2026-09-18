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


function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}


function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/*
 * Читает cookie по имени из HTTP-заголовка Cookie.
 *
 * Пример:
 * Cookie: abc=123; dfbk_session=XYZ; theme=dark
 */
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
   * CURRENT USER / CURRENT SESSION
   */
  if (
    pathname === '/api/auth/me' &&
    request.method === 'GET'
  ) {
    return getCurrentUser(request, env);
  }


  /*
   * LOGOUT
   * Пока заглушка.
   */
  if (
    pathname === '/api/auth/logout' &&
    request.method === 'POST'
  ) {
    return notImplemented(
      'auth.logout',
      []
    );
  }


  /*
   * FORGOT PASSWORD
   * Пока заглушка.
   */
  if (
    pathname === '/api/auth/forgot-password' &&
    request.method === 'POST'
  ) {
    return notImplemented(
      'auth.forgotPassword',
      ['EMAIL_API_KEY']
    );
  }


  /*
   * RESET PASSWORD
   * Пока заглушка.
   */
  if (
    pathname === '/api/auth/reset-password' &&
    request.method === 'POST'
  ) {
    return notImplemented(
      'auth.resetPassword',
      ['EMAIL_API_KEY']
    );
  }


  /*
   * VERIFY EMAIL
   * Пока заглушка.
   */
  if (
    pathname === '/api/auth/verify-email'
  ) {
    return notImplemented(
      'auth.verifyEmail',
      ['EMAIL_API_KEY']
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


  try {

    await env.DB
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
      )
      .run();

  } catch (error) {

    const message =
      error instanceof Error
        ? error.message
        : String(error);


    /*
     * Защита от двух одинаковых
     * register-запросов одновременно.
     */
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


  return json(
    {
      ok: true,

      user: {
        id: userId,
        email,
        emailVerified: false,
      },
    },
    201
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

  /*
   * Берём session token
   * из HttpOnly cookie.
   */
  const sessionToken =
    getCookie(
      request,
      'dfbk_session'
    );


  /*
   * Cookie нет:
   * пользователь не авторизован.
   */
  if (!sessionToken) {

    return json(
      {
        ok: false,
        error: 'NOT_AUTHENTICATED',
      },
      401
    );
  }


  /*
   * В БД хранится не сам token,
   * а SHA-256 hash.
   */
  const tokenHash =
    await hashSessionToken(
      sessionToken
    );


  /*
   * Ищем session и сразу
   * присоединяем пользователя.
   */
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


  /*
   * Session не найдена.
   */
  if (!session) {

    return json(
      {
        ok: false,
        error: 'INVALID_SESSION',
      },
      401
    );
  }


  /*
   * Session была отозвана.
   *
   * Позже logout будет
   * заполнять revoked_at.
   */
  if (session.revoked_at !== null) {

    return json(
      {
        ok: false,
        error: 'SESSION_REVOKED',
      },
      401
    );
  }


  /*
   * Проверяем срок действия.
   */
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


  /*
   * Session действительна.
   * Возвращаем текущего пользователя.
   */
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
