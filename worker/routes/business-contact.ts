import type { Env } from '../lib/env';

const PATH = '/api/business-contact';
const ACTION = 'business_contact';
const RECIPIENT = 'dfbk.app@gmail.com';
const MAX_BYTES = 16 * 1024;

function response(body: object, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing body');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(body + decoder.decode());
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new RangeError('Request too large');
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function handleBusinessContact(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (url.pathname !== PATH) return null;
  const siteKey = env.BUSINESS_CONTACT_SITE_KEY?.trim();
  const secret = env.BUSINESS_CONTACT_SECRET?.trim();
  const limiter = env.BUSINESS_CONTACT_LIMIT;
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  const configured = siteKey && secret && limiter && apiKey && from;

  if (request.method === 'GET') return response({ siteKey: configured ? siteKey : null });
  if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, POST' });
  if (url.protocol !== 'https:' || request.headers.get('Origin') !== url.origin ||
      request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return response({ error: 'INVALID_ORIGIN' }, 403);
  }
  if (!configured || !limiter) return response({ error: 'CONTACT_UNAVAILABLE' }, 503);
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return response({ error: 'INVALID_CONTENT_TYPE' }, 415);
  }
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) {
    return response({ error: 'REQUEST_TOO_LARGE' }, 413);
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return response({ error: 'CONTACT_UNAVAILABLE' }, 503);

  try {
    const limit = await limiter.limit({ key: ip });
    if (!limit.success) return response({ error: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });

    let body: unknown;
    try {
      body = await readBody(request);
    } catch (error) {
      return error instanceof RangeError
        ? response({ error: 'REQUEST_TOO_LARGE' }, 413)
        : response({ error: 'INVALID_FORM' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return response({ error: 'INVALID_FORM' }, 400);
    const fields = body as Record<string, unknown>;
    const email = typeof fields.email === 'string' ? fields.email.trim() : '';
    const message = typeof fields.message === 'string' ? fields.message.trim() : '';
    const token = typeof fields.token === 'string' ? fields.token.trim() : '';
    if (Object.keys(fields).some(key => !['email', 'message', 'token'].includes(key)) ||
        email.length > 254 || !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email) ||
        message.length < 10 || message.length > 2000 || !token || token.length > 2048) {
      return response({ error: 'INVALID_FORM' }, 400);
    }

    const challenge = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: secret!, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    if (!challenge.ok) return response({ error: 'CONTACT_UNAVAILABLE' }, 503);
    const verification = await challenge.json() as { success?: boolean; hostname?: string; action?: string };
    if (verification.success !== true || verification.hostname !== url.hostname || verification.action !== ACTION) {
      return response({ error: 'CHALLENGE_FAILED' }, 400);
    }

    const delivery = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [RECIPIENT],
        reply_to: email,
        subject: 'Business-Anfrage – DFBK.app',
        text: 'Antwortadresse: ' + email + '\n\n' + message,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!delivery.ok) return response({ error: 'DELIVERY_FAILED' }, 502);
    return response({ ok: true });
  } catch {
    return response({ error: 'CONTACT_UNAVAILABLE' }, 503);
  }
}
