import { notImplemented } from '../lib/response';

export function handleIntegrations(pathname: string) {
  if (pathname.startsWith('/api/integrations/google')) return notImplemented('integration.google', ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']);
  if (pathname.startsWith('/api/integrations/meta')) return notImplemented('integration.meta', ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI']);
  if (pathname.startsWith('/api/integrations/telegram')) return notImplemented('integration.telegram', ['TELEGRAM_BOT_TOKEN']);
  return null;
}
