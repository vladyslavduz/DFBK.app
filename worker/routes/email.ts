import { notImplemented } from '../lib/response';

export function handleEmail(pathname: string) {
  if (pathname === '/api/email/test') return notImplemented('email.transactional', ['EMAIL_API_KEY', 'EMAIL_FROM']);
  return null;
}
