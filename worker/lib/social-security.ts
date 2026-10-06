import type { Env } from './env';
export type SocialProvider = 'instagram' | 'facebook' | 'linkedin' | 'x';
export const PROVIDERS: SocialProvider[] = ['instagram','facebook','linkedin','x'];
export const META_SCOPES = { instagram: ['pages_show_list','pages_read_engagement','instagram_basic','instagram_content_publish'], facebook: ['pages_show_list','pages_read_engagement','pages_manage_posts'] };
export class SocialError extends Error {
  constructor(public code: string, public uncertain = false) { super(code); }
}
export const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
}
export const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(text: string) { return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))); }
function secret(value?: string) {
  try { const bytes = decode(value ?? ''); if (bytes.length === 32) return bytes; } catch {}
  throw new SocialError('SOCIAL_NOT_CONFIGURED');
}
export function socialConfigured(env: Env): boolean {
  try {
    if (env.SOCIAL_ENABLED !== 'true' || !/^v\d+\.0$/.test(env.META_GRAPH_VERSION ?? '') || !env.META_APP_ID || !env.META_APP_SECRET) return false;
    const origin = new URL(env.SOCIAL_PUBLIC_ORIGIN ?? '');
    if (origin.protocol !== 'https:' || origin.origin !== env.SOCIAL_PUBLIC_ORIGIN) return false;
    secret(env.SOCIAL_TOKEN_ENCRYPTION_KEY); secret(env.SOCIAL_MEDIA_SIGNING_KEY);
    return true;
  } catch { return false; }
}
export const connectionContext = (userId: string, provider: string, accountId: string) => JSON.stringify([userId,provider,accountId]);
export async function encryptToken(env: Env, value: string, context: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw',secret(env.SOCIAL_TOKEN_ENCRYPTION_KEY),{name:'AES-GCM'},false,['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(context)},key,new TextEncoder().encode(value));
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(ciphertext))}`;
}
export async function decryptToken(env: Env, value: string, context: string): Promise<string> {
  try {
    const [version,iv,data,...extra] = value.split('.');
    if (version !== 'v1' || extra.length || !iv || !data) throw new Error();
    const key = await crypto.subtle.importKey('raw',secret(env.SOCIAL_TOKEN_ENCRYPTION_KEY),{name:'AES-GCM'},false,['decrypt']);
    return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(context)},key,decode(data)));
  } catch { throw new SocialError('RECONNECT_REQUIRED'); }
}
export async function signMedia(env: Env, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw',secret(env.SOCIAL_MEDIA_SIGNING_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message))));
}
export async function verifyMedia(env: Env, message: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw',secret(env.SOCIAL_MEDIA_SIGNING_KEY),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    return await crypto.subtle.verify('HMAC',key,decode(signature),new TextEncoder().encode(message));
  } catch { return false; }
}
export function callbackUrl(env: Env, provider: string) { return `${env.SOCIAL_PUBLIC_ORIGIN}/api/social/${provider}/callback`; }
