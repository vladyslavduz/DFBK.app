import type { Env } from '../lib/env';
import { requireUser } from '../lib/user';
import { json } from '../lib/response';
import { readBoundedJson, requireSameOriginMutation } from '../lib/request-security';
import { PROVIDERS, socialConfigured, randomToken, digest, encryptToken, connectionContext, SocialError, type SocialProvider } from '../lib/social-security';
import { connectMeta, discoverMetaAccounts } from '../lib/social-meta';
export type Connection = { id:string;user_id:string;provider:SocialProvider;external_account_id:string;external_account_name:string;status:string;token_expires_at:string|null;access_token_encrypted:string|null;scopes:string };
export function publicConnection(row: Connection) {
  const expired = row.token_expires_at !== null && Date.parse(row.token_expires_at.replace(' ','T')+'Z') <= Date.now();
  return {connectionId:row.id,accountId:row.external_account_id,accountName:row.external_account_name,
    status:expired&&row.status==='connected'?'reconnect_required':row.status,connected:row.status==='connected'&&!expired,expiresAt:row.token_expires_at};
}
export async function connections(env: Env, userId: string) {
  const rows = socialConfigured(env) ? (await env.DB.prepare(`SELECT * FROM social_connections WHERE user_id=?1 AND status <> 'disconnected'
    ORDER BY CASE WHEN status='connected' THEN 0 ELSE 1 END,updated_at DESC,id DESC LIMIT 200`).bind(userId).all<Connection>()).results : [];
  return PROVIDERS.map(provider=>{
    const accounts=(rows??[]).filter(row=>row.provider===provider).map(publicConnection);
    const active=accounts.find(row=>row.connected);
    return {provider,availability:provider==='linkedin'||provider==='x'?'in_preparation':socialConfigured(env)?'available':'not_configured',connected:!!active,
      connectionId:active?.connectionId??null,accountId:active?.accountId??null,accountName:active?.accountName??null,
      status:active?'connected':accounts.some(row=>row.status==='reconnect_required')?'reconnect_required':'not_connected',accounts};
  });
}
function sessionCookie(request: Request) {return (request.headers.get('Cookie')??'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dfbk_session='))?.slice(13)??'';}
function redirectResult(env: Env, provider: string, result: string) {
  return new Response(null,{status:303,headers:{Location:`${env.SOCIAL_PUBLIC_ORIGIN}/app/integrations?social=${result}&provider=${provider}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export async function handleSocial(request: Request, env: Env, pathname: string): Promise<Response|null> {
  if (!pathname.startsWith('/api/social/') || pathname.startsWith('/api/social/media/')) return null;
  const match=pathname.match(/^\/api\/social\/(instagram|facebook|linkedin|x)\/(connect|callback|select|disconnect)$/);
  if (pathname!=='/api/social/connections'&&!match) return json({ok:false,error:'INVALID_SOCIAL_PROVIDER'},400);
  const user=await requireUser(request,env);if(user instanceof Response)return user;
  try {
    if(pathname==='/api/social/connections'&&request.method==='GET')return json({ok:true,connections:await connections(env,user.id)});
    if(!match)return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    const [,provider,action]=match;
    if(provider==='linkedin'||provider==='x')return json({ok:false,error:'SOCIAL_PROVIDER_NOT_AVAILABLE'},503);
    if(!socialConfigured(env))return json({ok:false,error:'SOCIAL_NOT_CONFIGURED'},503);
    if(new URL(request.url).origin!==env.SOCIAL_PUBLIC_ORIGIN)return json({ok:false,error:'INVALID_ORIGIN'},403);
    if(action==='connect'&&request.method==='GET') {
      let referringOrigin='';try{referringOrigin=new URL(request.headers.get('Referer')??'').origin;}catch{}
      if(request.headers.get('Sec-Fetch-Site')==='cross-site'||(referringOrigin!==env.SOCIAL_PUBLIC_ORIGIN&&request.headers.get('Origin')!==env.SOCIAL_PUBLIC_ORIGIN))return json({ok:false,error:'INVALID_ORIGIN'},403);
      const state=randomToken();
      const inserted=await env.DB.prepare(`INSERT INTO social_oauth_states(state_hash,user_id,session_hash,provider,expires_at)
        SELECT ?1,?2,?3,?4,datetime('now','+10 minutes') WHERE
        (SELECT COUNT(*) FROM social_oauth_states WHERE user_id=?2 AND created_at>datetime('now','-10 minutes'))<10`).bind(await digest(state),user.id,await digest(sessionCookie(request)),provider).run();
      if(!inserted.meta.changes)return json({ok:false,error:'SOCIAL_RATE_LIMITED'},429);
      return new Response(null,{status:302,headers:{Location:connectMeta(env,provider as 'instagram'|'facebook',state),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }
    if(action==='callback'&&request.method==='GET') {
      const url=new URL(request.url);const state=url.searchParams.get('state')??'';
      if(!/^[A-Za-z0-9_-]{43}$/.test(state))return json({ok:false,error:'INVALID_OAUTH_STATE'},400);
      const used=await env.DB.prepare(`UPDATE social_oauth_states SET consumed_at=CURRENT_TIMESTAMP
        WHERE state_hash=?1 AND user_id=?2 AND session_hash=?3 AND provider=?4 AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP`).bind(await digest(state),user.id,await digest(sessionCookie(request)),provider).run();
      if(!used.meta.changes)return json({ok:false,error:'INVALID_OAUTH_STATE'},400);
      if(url.searchParams.has('error'))return redirectResult(env,provider,'cancelled');
      const code=url.searchParams.get('code');if(!code||code.length>4096)return redirectResult(env,provider,'failed');
      try {
        const discovered=await discoverMetaAccounts(env,provider as 'instagram'|'facebook',code);
        if(!discovered.length)return redirectResult(env,provider,'no_accounts');
        const statements=[];
        for(const account of discovered) {
          statements.push(env.DB.prepare(`INSERT INTO social_connections(id,user_id,provider,external_account_id,external_account_name,access_token_encrypted,token_expires_at,scopes,status)
            SELECT ?1,?2,?3,?4,?5,?6,?7,?8,'pending' WHERE EXISTS(
              SELECT 1 FROM social_oauth_states WHERE state_hash=?9 AND user_id=?2 AND provider=?3 AND consumed_at IS NOT NULL AND expires_at>CURRENT_TIMESTAMP)
            ON CONFLICT(user_id,provider,external_account_id) DO UPDATE SET
            external_account_name=excluded.external_account_name,access_token_encrypted=excluded.access_token_encrypted,token_expires_at=excluded.token_expires_at,scopes=excluded.scopes,
            status=CASE WHEN social_connections.status='connected' THEN 'connected' ELSE 'pending' END,updated_at=CURRENT_TIMESTAMP`)
            .bind(crypto.randomUUID(),user.id,provider,account.id,account.name,await encryptToken(env,account.token,connectionContext(user.id,provider,account.id)),account.expiresAt,JSON.stringify(account.scopes),await digest(state)));
        }
        // D1 statement limits vary; bounded discovery, batches below platform limit.
        for(let start=0;start<statements.length;start+=40)await env.DB.batch(statements.slice(start,start+40));
        return redirectResult(env,provider,'select_account');
      }catch(error){return redirectResult(env,provider,error instanceof SocialError&&error.code==='SOCIAL_PERMISSION_REQUIRED'?'permission_required':'failed');}
    }
    if((action==='disconnect'||action==='select')&&request.method==='POST') {
      const guard=requireSameOriginMutation(request);if(guard)return guard;
      const body=await readBoundedJson(request);if(body instanceof Response)return body;
      if(action==='disconnect') {
        if(Object.keys(body).length)return json({ok:false,error:'INVALID_SOCIAL_REQUEST'},400);
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM social_oauth_states WHERE user_id=?1 AND provider=?2`).bind(user.id,provider),
          env.DB.prepare(`UPDATE social_connections SET status='disconnected',access_token_encrypted=NULL,refresh_token_encrypted=NULL,token_expires_at=NULL,scopes='[]',metadata_json='{}',updated_at=CURRENT_TIMESTAMP WHERE user_id=?1 AND provider=?2`).bind(user.id,provider),
        ]);
        return json({ok:true,connections:await connections(env,user.id)});
      }
      if(Object.keys(body).some(key=>key!=='connectionId')||typeof body.connectionId!=='string')return json({ok:false,error:'INVALID_SOCIAL_REQUEST'},400);
      const row=await env.DB.prepare(`SELECT * FROM social_connections WHERE id=?1 AND user_id=?2 AND provider=?3 AND status IN ('pending','connected') AND access_token_encrypted IS NOT NULL AND (token_expires_at IS NULL OR token_expires_at>CURRENT_TIMESTAMP)`).bind(body.connectionId,user.id,provider).first<Connection>();
      if(!row)return json({ok:false,error:'SOCIAL_NOT_CONNECTED'},404);
      await env.DB.batch([
        env.DB.prepare(`UPDATE social_connections SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE user_id=?1 AND provider=?2 AND status='connected'
          AND EXISTS(SELECT 1 FROM social_connections WHERE id=?3 AND user_id=?1 AND provider=?2 AND access_token_encrypted IS NOT NULL AND status IN ('pending','connected'))`).bind(user.id,provider,row.id),
        env.DB.prepare(`UPDATE social_connections SET status='connected',updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2 AND provider=?3 AND access_token_encrypted IS NOT NULL AND status IN ('pending','connected')`).bind(row.id,user.id,provider),
      ]);
      return json({ok:true,connections:await connections(env,user.id)});
    }
    return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  }catch {console.error('SOCIAL_REQUEST_FAILED');return json({ok:false,error:'SOCIAL_SERVICE_UNAVAILABLE'},503);}
}
