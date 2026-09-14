import { notImplemented } from '../lib/response';

export function handleBilling(pathname: string) {
  if (pathname === '/api/billing/checkout') return notImplemented('billing.checkout', ['STRIPE_SECRET_KEY']);
  if (pathname === '/api/billing/webhook') return notImplemented('billing.webhook', ['STRIPE_WEBHOOK_SECRET']);
  return null;
}
