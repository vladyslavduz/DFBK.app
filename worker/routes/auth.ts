import { notImplemented } from '../lib/response';

export function handleAuth(pathname: string) {
  if (pathname === '/api/auth/login') return notImplemented('auth.login', ['SESSION_SECRET']);
  if (pathname === '/api/auth/register') return notImplemented('auth.register', ['SESSION_SECRET', 'EMAIL_API_KEY']);
  if (pathname === '/api/auth/logout') return notImplemented('auth.logout', ['SESSION_SECRET']);
  if (pathname === '/api/auth/forgot-password') return notImplemented('auth.forgotPassword', ['SESSION_SECRET', 'EMAIL_API_KEY']);
  if (pathname === '/api/auth/reset-password') return notImplemented('auth.resetPassword', ['SESSION_SECRET', 'EMAIL_API_KEY']);
  if (pathname === '/api/auth/verify-email') return notImplemented('auth.verifyEmail', ['EMAIL_API_KEY']);
  return null;
}
