import type { Env } from '../lib/env';
import { json, notImplemented } from '../lib/response';
import { hashPassword } from '../lib/password';

type RegisterBody = {
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

  if (
    pathname === '/api/auth/register' &&
    request.method === 'POST'
  ) {
    return register(request, env);
  }

  if (pathname === '/api/auth/login') {
    return notImplemented('auth.login', ['SESSION_SECRET']);
  }

  if (pathname === '/api/auth/logout') {
    return notImplemented('auth.logout', ['SESSION_SECRET']);
  }

  if (pathname === '/api/auth/forgot-password') {
    return notImplemented(
      'auth.forgotPassword',
      ['SESSION_SECRET', 'EMAIL_API_KEY']
    );
  }

  if (pathname === '/api/auth/reset-password') {
    return notImplemented(
      'auth.resetPassword',
      ['SESSION_SECRET', 'EMAIL_API_KEY']
    );
  }

  if (pathname === '/api/auth/verify-email') {
    return notImplemented(
      'auth.verifyEmail',
      ['EMAIL_API_KEY']
    );
  }

  return null;
}

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
  const passwordHash = await hashPassword(password);

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
