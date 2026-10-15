import type { Env } from './env';
import { createSessionToken, hashSessionToken } from './session';

const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const JWKS_URL = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName';
const COOKIE = 'dfbk_microsoft_oauth';
const TEN_MINUTES = 600;

type Attempt = {
  state: string;
  nonce: string;
  verifier: string;
  issued: number;
  mode: 'login' | 'link';
  sessionHash?: string;
};

type IdClaims = {
  sub: string;
  tid: string;
  oid?: string;
  email?: string;
  preferred_username?: string;
};

export class MicrosoftOAuthError extends Error {
  constructor(readonly reason: string) { super(reason); }
}

function configured(env: Env): asserts env is Env & {
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  MICROSOFT_REDIRECT_URI: string;
} {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET ||
      env.MICROSOFT_REDIRECT_URI !== 'https://dfbk.app/api/auth/microsoft/callback') {
    throw new MicrosoftOAuthError('not_configured');
  }
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new MicrosoftOAuthError('invalid_identity');
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}

function random(): string { return createSessionToken(); }

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

export function clearMicrosoftCookie(): string {
  return `${COOKIE}=; Path=/api/auth/microsoft; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export async function startMicrosoft(env: Env, mode: Attempt['mode'], sessionToken?: string): Promise<{ url: string; cookie: string; state: string }> {
  configured(env);
  if (mode === 'link' && !sessionToken) throw new MicrosoftOAuthError('invalid_session');
  const attempt: Attempt = {
    state: random(), nonce: random(), verifier: random(), issued: Math.floor(Date.now() / 1000), mode,
    ...(mode === 'link' ? { sessionHash: await hashSessionToken(sessionToken!) } : {}),
  };
  const payload = base64url(new TextEncoder().encode(JSON.stringify(attempt)));
  const signature = base64url(await hmac(env.MICROSOFT_CLIENT_SECRET, payload));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(attempt.verifier))));
  const url = new URL(`${AUTHORITY}/authorize`);
  url.search = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID, response_type: 'code', redirect_uri: env.MICROSOFT_REDIRECT_URI,
    response_mode: 'query', scope: 'openid profile email User.Read', state: attempt.state,
    nonce: attempt.nonce, code_challenge: challenge, code_challenge_method: 'S256',
  }).toString();
  return { url: url.toString(), state: attempt.state,
    cookie: `${COOKIE}=${payload}.${signature}; Path=/api/auth/microsoft; HttpOnly; Secure; SameSite=Lax; Max-Age=${TEN_MINUTES}` };
}

export async function verifyMicrosoftAttempt(env: Env, cookieValue: string | null, returnedState: string | null, sessionToken?: string): Promise<Attempt> {
  configured(env);
  if (!cookieValue || cookieValue.length > 1500 || !returnedState || !/^[A-Za-z0-9_-]{43}$/.test(returnedState)) {
    throw new MicrosoftOAuthError('invalid_state');
  }
  const [payload, signature, extra] = cookieValue.split('.');
  if (!payload || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(payload)) throw new MicrosoftOAuthError('invalid_state');
  const expected = await hmac(env.MICROSOFT_CLIENT_SECRET, payload);
  const provided = decodeBase64url(signature);
  if (provided.length !== expected.length || !provided.every((v, i) => v === expected[i])) throw new MicrosoftOAuthError('invalid_state');
  let attempt: Attempt;
  try { attempt = JSON.parse(new TextDecoder().decode(decodeBase64url(payload))) as Attempt; }
  catch { throw new MicrosoftOAuthError('invalid_state'); }
  const now = Math.floor(Date.now() / 1000);
  if (attempt.state !== returnedState || !/^[A-Za-z0-9_-]{43}$/.test(attempt.nonce) ||
      !/^[A-Za-z0-9_-]{43}$/.test(attempt.verifier) || !Number.isInteger(attempt.issued) ||
      attempt.issued > now + 30 || now - attempt.issued > TEN_MINUTES ||
      !['login', 'link'].includes(attempt.mode)) throw new MicrosoftOAuthError('invalid_state');
  if (attempt.mode === 'link' && (!sessionToken || await hashSessionToken(sessionToken) !== attempt.sessionHash)) {
    throw new MicrosoftOAuthError('invalid_state');
  }
  return attempt;
}

async function readJson(response: Response): Promise<Record<string, any>> {
  let body: unknown;
  try { body = await response.json(); } catch { throw new MicrosoftOAuthError('provider_unavailable'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MicrosoftOAuthError('provider_unavailable');
  return body as Record<string, any>;
}

export async function exchangeMicrosoftCode(env: Env, code: string, verifier: string): Promise<{ idToken: string; accessToken: string }> {
  configured(env);
  const response = await fetch(`${AUTHORITY}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.MICROSOFT_CLIENT_ID, client_secret: env.MICROSOFT_CLIENT_SECRET,
      code, code_verifier: verifier, redirect_uri: env.MICROSOFT_REDIRECT_URI, grant_type: 'authorization_code',
      scope: 'openid profile email User.Read' }),
    redirect: 'manual', signal: AbortSignal.timeout(15_000),
  });
  if (response.status >= 300 && response.status < 400) throw new MicrosoftOAuthError('token_exchange_failed');
  if (!response.ok) throw new MicrosoftOAuthError('token_exchange_failed');
  const data = await readJson(response);
  if (typeof data.id_token !== 'string' || typeof data.access_token !== 'string' ||
      data.id_token.length > 16000 || data.access_token.length > 16000) throw new MicrosoftOAuthError('invalid_identity');
  return { idToken: data.id_token, accessToken: data.access_token };
}

export async function validateMicrosoftIdentity(env: Env, idToken: string, nonce: string): Promise<IdClaims> {
  configured(env);
  const parts = idToken.split('.');
  if (parts.length !== 3 || idToken.length > 16000) throw new MicrosoftOAuthError('invalid_identity');
  let header: Record<string, any>, claims: Record<string, any>;
  try {
    header = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[1])));
  } catch { throw new MicrosoftOAuthError('invalid_identity'); }
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' ||
      !claims || typeof claims.tid !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.tid) ||
      claims.iss !== `https://login.microsoftonline.com/${claims.tid}/v2.0` ||
      claims.aud !== env.MICROSOFT_CLIENT_ID || claims.nonce !== nonce ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 256 ||
      typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000 ||
      (typeof claims.nbf === 'number' && claims.nbf > Date.now() / 1000 + 60) ||
      (typeof claims.iat === 'number' && claims.iat > Date.now() / 1000 + 60)) {
    throw new MicrosoftOAuthError('invalid_identity');
  }
  const keyResponse = await fetch(JWKS_URL, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  if (keyResponse.status >= 300 && keyResponse.status < 400) throw new MicrosoftOAuthError('provider_unavailable');
  if (!keyResponse.ok) throw new MicrosoftOAuthError('provider_unavailable');
  const jwks = await readJson(keyResponse);
  const key = Array.isArray(jwks.keys) ? jwks.keys.find((candidate: Record<string, any>) =>
    candidate.kid === header.kid && candidate.kty === 'RSA' &&
    (!candidate.issuer || candidate.issuer.replace('{tenantid}', claims.tid) === claims.iss)) : null;
  if (!key) throw new MicrosoftOAuthError('invalid_identity');
  try {
    const cryptoKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, new Uint8Array(decodeBase64url(parts[2])),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) throw new MicrosoftOAuthError('invalid_identity');
  } catch { throw new MicrosoftOAuthError('invalid_identity'); }
  return { sub: claims.sub, tid: claims.tid, oid: typeof claims.oid === 'string' ? claims.oid : undefined,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    preferred_username: typeof claims.preferred_username === 'string' ? claims.preferred_username : undefined };
}

export async function fetchMicrosoftProfile(accessToken: string, identity: IdClaims): Promise<string | null> {
  const response = await fetch(GRAPH_ME_URL, { headers: { Authorization: `Bearer ${accessToken}` },
    redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  if (response.status >= 300 && response.status < 400) throw new MicrosoftOAuthError('profile_unavailable');
  if (!response.ok) throw new MicrosoftOAuthError('profile_unavailable');
  const profile = await readJson(response);
  if (identity.oid && profile.id !== identity.oid) throw new MicrosoftOAuthError('invalid_identity');
  const email = [profile.mail, identity.email, profile.userPrincipalName, identity.preferred_username]
    .find(value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
}
