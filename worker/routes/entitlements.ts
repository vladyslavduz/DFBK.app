import type { Env } from '../lib/env';
import { json } from '../lib/response';
import { buildEntitlements } from '../lib/entitlements';
import { requireUser } from '../lib/user';

export async function handleEntitlements(request: Request, env: Env, pathname: string): Promise<Response | null> {
  if (pathname !== '/api/account/entitlements' || request.method !== 'GET') return null;
  try {
    const user = await requireUser(request, env);
    if (user instanceof Response) return user;
    return json(buildEntitlements(user.plan));
  } catch {
    console.error('ACCOUNT_ENTITLEMENTS_READ_ERROR');
    return json({ ok: false, error: 'ENTITLEMENTS_READ_FAILED' }, 500);
  }
}
