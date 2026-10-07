import type { Env } from './env';
import { SocialError, callbackUrl, META_SCOPES } from './social-security';
type MetaObject = Record<string, any>;
export function metaId(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,40}$/.test(value)) throw new SocialError('SOCIAL_PUBLISH_FAILED');
  return value;
}
// Only fixed Meta hosts and server-constructed paths, never frontend URLs.
export async function metaRequest(env: Env, path: string, token: string | null, method = 'GET', fields: Record<string,string> = {}, publishing = false): Promise<MetaObject> {
  const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${path}`);
  const form = new URLSearchParams(fields);
  const headers: Record<string,string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method === 'GET') url.search = form.toString();
  else headers['Content-Type'] = 'application/x-www-form-urlencoded';
  let response: Response;
  try { response = await fetch(url,{method,headers,body:method==='GET'?undefined:form,signal:AbortSignal.timeout(20_000),redirect:'error'}); }
  catch { throw new SocialError(publishing ? 'SOCIAL_PUBLICATION_OUTCOME_UNKNOWN' : 'SOCIAL_PROVIDER_UNAVAILABLE',publishing); }
  let body: MetaObject;
  try { body = await response.json() as MetaObject; }
  catch { throw new SocialError(publishing ? 'SOCIAL_PUBLICATION_OUTCOME_UNKNOWN' : 'SOCIAL_PROVIDER_UNAVAILABLE',publishing); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SocialError(publishing?'SOCIAL_PUBLICATION_OUTCOME_UNKNOWN':'SOCIAL_PROVIDER_UNAVAILABLE',publishing);
  if (!response.ok || body.error) {
    if (response.status >= 500 && publishing) throw new SocialError('SOCIAL_PUBLICATION_OUTCOME_UNKNOWN',true);
    const code = body.error?.code;
    if (code === 190) throw new SocialError('SOCIAL_TOKEN_EXPIRED');
    if ([10,200,294].includes(code)) throw new SocialError('SOCIAL_PERMISSION_REQUIRED');
    if ([4,17,32,613].includes(code) || response.status === 429) throw new SocialError('SOCIAL_RATE_LIMITED');
    throw new SocialError('SOCIAL_PUBLISH_FAILED');
  }
  return body;
}
export function connectMeta(env: Env, provider: 'instagram' | 'facebook', state: string) {
  const url = new URL(`https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth`);
  url.search = new URLSearchParams({client_id:env.META_APP_ID!,redirect_uri:callbackUrl(env,provider),response_type:'code',scope:META_SCOPES[provider].join(','),state}).toString();
  return url.toString();
}
export async function discoverMetaAccounts(env: Env, provider: 'instagram' | 'facebook', code: string) {
  const short = await metaRequest(env,'oauth/access_token',null,'GET',{client_id:env.META_APP_ID!,client_secret:env.META_APP_SECRET!,redirect_uri:callbackUrl(env,provider),code});
  if (typeof short.access_token !== 'string') throw new SocialError('RECONNECT_REQUIRED');
  const long = await metaRequest(env,'oauth/access_token',null,'GET',{grant_type:'fb_exchange_token',client_id:env.META_APP_ID!,client_secret:env.META_APP_SECRET!,fb_exchange_token:short.access_token});
  if (typeof long.access_token !== 'string') throw new SocialError('RECONNECT_REQUIRED');
  const permissions = await metaRequest(env,'me/permissions',long.access_token);
  const granted = (Array.isArray(permissions.data)?permissions.data:[]).filter((x:MetaObject)=>x.status==='granted').map((x:MetaObject)=>x.permission);
  if (!META_SCOPES[provider].every(scope=>granted.includes(scope))) throw new SocialError('SOCIAL_PERMISSION_REQUIRED');
  const accounts: Array<{id:string;name:string;token:string;scopes:string[];expiresAt:string|null}> = [];
  let after: string | undefined;
  for (let page=0;page<4;page++) {
    const result = await metaRequest(env,'me/accounts',long.access_token,'GET',{fields:'id,name,access_token,instagram_business_account{id,username}',limit:'50',...(after?{after}:{})});
    for (const row of Array.isArray(result.data)?result.data:[]) {
      const account = provider==='facebook' ? row : row.instagram_business_account;
      if (!account || typeof row.access_token !== 'string') continue;
      accounts.push({id:metaId(account.id),name:String((provider==='instagram'?account.username:row.name)||account.id).slice(0,200),token:provider==='instagram'?long.access_token:row.access_token,scopes:granted,
        expiresAt:Number.isFinite(long.expires_in)&&long.expires_in>0?new Date(Date.now()+long.expires_in*1000).toISOString().slice(0,19).replace('T',' '):null});
      if (accounts.length > 20) throw new SocialError('SOCIAL_ACCOUNT_LIST_TOO_LARGE');
    }
    after = result.paging?.next ? result.paging?.cursors?.after : undefined;
    if (!after) return accounts;
  }
  throw new SocialError('SOCIAL_ACCOUNT_LIST_TOO_LARGE');
}
export type PublishInput = {accountId:string;token:string;caption:string;imageUrl:string;containerId:string|null;saveContainer:(id:string)=>Promise<void>;markPublish:()=>Promise<void>};
export interface SocialAdapter { publish(env: Env, input: PublishInput): Promise<{id:string;url:string|null}>; }
export const metaAdapters: Record<'instagram'|'facebook', SocialAdapter> = {
  instagram: {async publish(env,input) {
    let container = input.containerId;
    if (!container) {
      const result = await metaRequest(env,`${metaId(input.accountId)}/media`,input.token,'POST',{image_url:input.imageUrl,caption:input.caption});
      container = metaId(result.id); await input.saveContainer(container);
    }
    // Poll once per invocation; POST replay may resume a saved container, never re-send media_publish.
    const status = await metaRequest(env,metaId(container),input.token,'GET',{fields:'status_code'});
    if (status.status_code === 'IN_PROGRESS') throw new SocialError('SOCIAL_CONTAINER_PROCESSING');
    if (status.status_code !== 'FINISHED') throw new SocialError('SOCIAL_PUBLISH_FAILED');
    await input.markPublish();
    const result = await metaRequest(env,`${metaId(input.accountId)}/media_publish`,input.token,'POST',{creation_id:container},true);
    let id: string;
    try { id = metaId(result.id); } catch { throw new SocialError('SOCIAL_PUBLICATION_OUTCOME_UNKNOWN',true); }
    let url: string | null = null;
    try { const post = await metaRequest(env,id,input.token,'GET',{fields:'permalink'}); url = safePostUrl(post.permalink,'instagram'); } catch {}
    return {id,url};
  }},
  facebook: {async publish(env,input) {
    await input.markPublish();
    const result = await metaRequest(env,`${metaId(input.accountId)}/photos`,input.token,'POST',{url:input.imageUrl,caption:input.caption,published:'true'},true);
    const id = typeof result.post_id === 'string' ? result.post_id : typeof result.id === 'string' ? result.id : '';
    if (!/^[\d_]+$/.test(id)) throw new SocialError('SOCIAL_PUBLICATION_OUTCOME_UNKNOWN',true);
    return {id,url:`https://www.facebook.com/${id}`};
  }},
};
function safePostUrl(value: unknown, provider: string): string | null {
  try { const url = new URL(String(value));return url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname)&&provider==='instagram'?url.toString():null; } catch {return null;}
}
