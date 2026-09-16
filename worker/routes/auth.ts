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


function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}


function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    body = await request.json<RegisterBody>();
  } catch {
    return json(
      {
        ok: false,
        error: 'INVALID_JSON',
      },
      400
    );
  }


  const email = normalizeEmail(body.email ?? '');
  const password = body.password ?? '';


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
      {
        ok: false,
        error: 'EMAIL_ALREADY_EXISTS',
      },
      409
    );
  }


  const userId = crypto.randomUUID();

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
     * Дополнительная защита:
     * если два одинаковых register-запроса
     * пришли одновременно.
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


  /*
   * Читаем JSON из браузера.
   */
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


  /*
   * Email и пароль обязательны.
   */
  if (!email || !password) {

    return json(
      {
        ok: false,
        error: 'EMAIL_AND_PASSWORD_REQUIRED',
      },
      400
    );
  }


  /*
   * Ищем пользователя в D1.
   */
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


  /*
   * Специально НЕ сообщаем:
   * "такого email нет".
   *
   * И неправильный email,
   * и неправильный пароль
   * возвращают одну ошибку.
   */
  if (!user) {

    return json(
      {
        ok: false,
        error: 'INVALID_CREDENTIALS',
      },
      401
    );
  }


  /*
   * Проверяем введённый пароль
   * против сохранённого PBKDF2 hash.
   */
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


  /*
   * Пароль правильный,
   * но email ещё не подтверждён.
   *
   * Пока email verification
   * мы ещё не реализовали.
   */
  if (user.email_verified !== 1) {

    return json(
      {
        ok: false,
        error: 'EMAIL_NOT_VERIFIED',
      },
      403
    );
  }


  /*
   * Создаём случайный session token.
   *
   * Сам token попадёт только
   * в HttpOnly cookie браузера.
   */
  const sessionToken =
    createSessionToken();


  /*
   * В БАЗУ записываем НЕ token,
   * а только SHA-256 hash token.
   */
  const tokenHash =
    await hashSessionToken(
      sessionToken
    );


  const sessionId =
    crypto.randomUUID();


  /*
   * Сейчас срок session:
   * 30 дней.
   */
  const expiresAt =
    getSessionExpiry();


  /*
   * Сохраняем session в D1.
   */
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


  /*
   * Login успешен.
   *
   * Browser получает cookie:
   *
   * dfbk_session=...
   *
   * Cookie:
   * - HttpOnly
   * - Secure
   * - SameSite=Lax
   */
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
