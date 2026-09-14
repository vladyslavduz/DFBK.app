import { notImplemented } from '../lib/response';

export function handlePublish(pathname: string) {
  if (pathname === '/api/publish/google_business') return notImplemented('publish.googleBusiness', ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
  if (pathname === '/api/publish/instagram') return notImplemented('publish.instagram', ['META_APP_ID', 'META_APP_SECRET']);
  if (pathname === '/api/publish/facebook') return notImplemented('publish.facebook', ['META_APP_ID', 'META_APP_SECRET']);
  if (pathname === '/api/publish/telegram') return notImplemented('publish.telegram', ['TELEGRAM_BOT_TOKEN']);
  if (pathname === '/api/publish/website' || pathname === '/api/publish/blog') return notImplemented('publish.website', ['WEBSITE_INTEGRATION_TBD']);
  return null;
}
