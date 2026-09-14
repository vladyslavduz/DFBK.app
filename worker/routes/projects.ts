import { notImplemented } from '../lib/response';

export function handleProjects(pathname: string) {
  if (pathname === '/api/projects' || pathname.startsWith('/api/projects/')) {
    return notImplemented('projects.database', ['DATABASE_BINDING_TBD', 'R2_BINDING_TBD']);
  }
  if (pathname === '/api/upload' || pathname === '/api/upload/sign') {
    return notImplemented('media.upload', ['R2_BINDING_TBD']);
  }
  return null;
}
