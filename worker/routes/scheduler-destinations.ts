import type { Env } from '../lib/env';
import { requireUser } from '../lib/user';
const ROOT='/api/scheduler/destinations';
const opaque=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
function response(body:unknown,status=200,extra:Record<string,string>={}){
 return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',Vary:'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra}});
}
const fail=(code:string,status:number,extra:Record<string,string>={})=>response({ok:false,error:{code}},status,extra);
function expiry(value:unknown):number|null{
 if(value===null)return null;
 if(typeof value!=='string')return NaN;
 const normalized=/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)?value.replace(' ','T')+'Z':value;
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(normalized))return NaN;
 const parsed=Date.parse(normalized);
 return Number.isFinite(parsed)&&new Date(parsed).toISOString()===normalized.replace(/Z$/,normalized.includes('.')?'Z':'.000Z')?parsed:NaN;
}
/** Owned metadata for draft selection only; independent from Social activation and token access. */
export async function handleSchedulerDestinations(request:Request,env:Env,pathname:string):Promise<Response|null>{
 if(pathname!==ROOT&&!pathname.startsWith(ROOT+'/'))return null;
 if(pathname!==ROOT)return fail('SCHEDULER_DESTINATION_NOT_FOUND',404);
 if(request.method!=='GET')return fail('METHOD_NOT_ALLOWED',405,{Allow:'GET'});
 if(request.url.length>2048)return fail('SCHEDULER_URL_TOO_LONG',414);
 try{
  if(new URL(request.url).search)return fail('INVALID_SCHEDULER_QUERY',400);
  const actor=await requireUser(request,env);if(actor instanceof Response)return fail('NOT_AUTHENTICATED',401);
  if(env.SCHEDULER_READ_ENABLED!=='true')return fail('SCHEDULER_DISABLED',503);
  const {results:rows}=await env.DB.withSession('first-primary').prepare(
   "SELECT id,user_id,provider,external_account_name,status,token_expires_at FROM social_connections WHERE user_id=?1 AND provider IN ('instagram','facebook') AND status='connected' ORDER BY provider,id LIMIT 3"
  ).bind(actor.id).all<Record<string,unknown>>();
  if(!Array.isArray(rows)||rows.length>2)return fail('SCHEDULER_DATA_UNAVAILABLE',503);
  const channels=new Set<string>(),destinations=[];
  for(const row of rows){
   if(row.user_id!==actor.id||!opaque(row.id)||!['instagram','facebook'].includes(String(row.provider))||row.status!=='connected'||
    typeof row.external_account_name!=='string'||!row.external_account_name.trim()||row.external_account_name.length>200||/[\u0000-\u001f\u007f]/u.test(row.external_account_name)||channels.has(String(row.provider)))return fail('SCHEDULER_DATA_UNAVAILABLE',503);
   channels.add(String(row.provider));const expires=expiry(row.token_expires_at);
   if(expires!==null&&(!Number.isFinite(expires)||expires<=Date.now()))continue;
   destinations.push({channel:row.provider,connectionId:row.id,label:row.external_account_name});
  }
  return response({ok:true,destinations,scope:'draft_only',cannotDispatch:true});
 }catch{return fail('SCHEDULER_UNAVAILABLE',503);}
}
