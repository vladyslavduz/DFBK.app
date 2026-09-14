import { notImplemented } from '../lib/response';

export function handleProfile(pathname: string) {
  if (pathname === '/api/profile') return notImplemented('business.profile', ['DATABASE_BINDING_TBD', 'SESSION_SECRET']);
  return null;
}
