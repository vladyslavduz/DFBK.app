import type { Env } from '../lib/env';
import { json } from '../lib/response';
import { requireUser } from '../lib/user';
import { readBoundedJson, requireSameOriginMutation } from '../lib/request-security';
import { socialConfigured, PROVIDERS, digest, decryptToken, connectionContext, signMedia, verifyMedia, SocialError } from '../lib/social-security';
import { metaAdapters } from '../lib/social-meta';
import type { Connection } from './social';
type Job = {id:string;request_id:string;user_id:string;project_id:string;provider:'instagram'|'facebook';connection_id:string|null;status:string;caption:string;media_id:string;media_source:string;external_container_id:string|null;external_publish_started_at:string|null;external_post_id:string|null;external_post_url:string|null;error_code:string|null};
type Media = {id:string;storage_key:string;mime_type:string;size_bytes:number;role:string};
function publicJob(job: Job) {return {jobId:job.id,provider:job.provider,status:job.status,mediaId:job.media_id,mediaSource:job.media_source,externalPostId:job.external_post_id,url:job.external_post_url,error:job.error_code,
  retryAllowed:job.status==='pending'&&!job.external_publish_started_at};}
function jpegDimensions(bytes: Uint8Array): {width:number;height:number}|null {
  if(bytes[0]!==255||bytes[1]!==216)return null;
  let offset=2;
  while(offset+4<bytes.length) {
    if(bytes[offset++]!==255)return null;
    while(bytes[offset]===255)offset++;
    const marker=bytes[offset++];if(marker===217||marker===218)return null;
    const length=(bytes[offset]<<8)|bytes[offset+1];if(length<2||offset+length>bytes.length)return null;
    if([192,193,194].includes(marker)&&length>=8)return {height:(bytes[offset+3]<<8)|bytes[offset+4],width:(bytes[offset+5]<<8)|bytes[offset+6]};
    offset+=length;
  }return null;
}
async function checkMedia(env: Env, media: Media, instagram: boolean) {
  if(!['image/jpeg','image/png'].includes(media.mime_type)||media.size_bytes>10*1024*1024)throw new SocialError('SOCIAL_MEDIA_UNSUPPORTED');
  const object=await env.MEDIA.get(media.storage_key);if(!object)throw new SocialError('SOCIAL_MEDIA_NOT_AVAILABLE');
  if(object.size>10*1024*1024)throw new SocialError('SOCIAL_MEDIA_UNSUPPORTED');
  if(!instagram)return;
  if(media.mime_type!=='image/jpeg'||media.size_bytes>8*1024*1024||object.size>8*1024*1024)throw new SocialError('SOCIAL_MEDIA_UNSUPPORTED');
  const dimensions=jpegDimensions(new Uint8Array(await object.arrayBuffer()));
  if(!dimensions||!dimensions.height||dimensions.width/dimensions.height<0.8||dimensions.width/dimensions.height>1.91)throw new SocialError('SOCIAL_MEDIA_UNSUPPORTED');
}
async function runJob(env: Env, job: Job): Promise<void> {
  const claim=await env.DB.prepare(`UPDATE publication_jobs SET status='processing',error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='pending' AND external_publish_started_at IS NULL
    AND (error_code IS NULL OR updated_at<=datetime('now','-10 seconds'))`).bind(job.id).run();
  if(!claim.meta.changes)return;
  job=(await env.DB.prepare(`SELECT * FROM publication_jobs WHERE id=?1`).bind(job.id).first<Job>())!;
  try {
    const connection=await env.DB.prepare(`SELECT * FROM social_connections WHERE id=?1 AND user_id=?2 AND provider=?3 AND status='connected'`).bind(job.connection_id,job.user_id,job.provider).first<Connection>();
    if(!connection?.access_token_encrypted)throw new SocialError('SOCIAL_NOT_CONNECTED');
    if(connection.token_expires_at&&Date.parse(connection.token_expires_at.replace(' ','T')+'Z')<=Date.now())throw new SocialError('SOCIAL_TOKEN_EXPIRED');
    const token=await decryptToken(env,connection.access_token_encrypted,connectionContext(job.user_id,job.provider,connection.external_account_id));
    const expires=Math.floor(Date.now()/1000)+900;
    const signed=await signMedia(env,`${job.id}:${expires}`);
    const imageUrl=`${env.SOCIAL_PUBLIC_ORIGIN}/api/social/media/${job.id}?expires=${expires}&signature=${signed}`;
    const result=await metaAdapters[job.provider].publish(env,{accountId:connection.external_account_id,token,caption:job.caption,imageUrl,containerId:job.external_container_id,
      async saveContainer(id) {
        const saved=await env.DB.prepare(`UPDATE publication_jobs SET external_container_id=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='processing' AND external_publish_started_at IS NULL`).bind(job.id,id).run();
        if(!saved.meta.changes)throw new SocialError('SOCIAL_PUBLISH_FAILED');
      },
      async markPublish() {
        const marked=await env.DB.prepare(`UPDATE publication_jobs SET external_publish_started_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
          WHERE id=?1 AND status='processing' AND external_publish_started_at IS NULL`).bind(job.id).run();
        if(!marked.meta.changes)throw new SocialError('SOCIAL_PUBLICATION_OUTCOME_UNKNOWN',true);
      },
    });
    // A lost DB success acknowledgement must never trigger another provider publish.
    await env.DB.prepare(`UPDATE publication_jobs SET status='published',external_post_id=?2,external_post_url=?3,error_code=NULL,published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='processing'`).bind(job.id,result.id,result.url).run();
  } catch(error) {
    const social=error instanceof SocialError?error:new SocialError('SOCIAL_PUBLICATION_OUTCOME_UNKNOWN',true);
    if(['SOCIAL_TOKEN_EXPIRED','RECONNECT_REQUIRED'].includes(social.code))await env.DB.prepare(`UPDATE social_connections SET status='reconnect_required',access_token_encrypted=NULL,refresh_token_encrypted=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND user_id=?2`).bind(job.connection_id,job.user_id).run();
    if(social.code==='SOCIAL_CONTAINER_PROCESSING')await env.DB.prepare(`UPDATE publication_jobs SET status='pending',error_code=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='processing' AND external_publish_started_at IS NULL`).bind(job.id,social.code).run();
    else await env.DB.prepare(`UPDATE publication_jobs SET status=?2,error_code=?3,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='processing'`).bind(job.id,social.uncertain?'processing':'failed',social.code).run();
  }
}
// Provider fetch capability: deliberately cookie-free, signed and scoped to one job/media snapshot.
export async function handleSocialMedia(request: Request, env: Env, pathname: string): Promise<Response|null> {
  const match=pathname.match(/^\/api\/social\/media\/([\w-]{1,80})$/);if(!match)return null;
  if(!['GET','HEAD'].includes(request.method))return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  if(!socialConfigured(env))return new Response(null,{status:404});
  try {
    const url=new URL(request.url);const expires=url.searchParams.get('expires')??'';const signature=url.searchParams.get('signature')??'';
    const now=Math.floor(Date.now()/1000);
    if(url.origin!==env.SOCIAL_PUBLIC_ORIGIN||!/^\d{10}$/.test(expires)||Number(expires)<=now||Number(expires)>now+900||!(await verifyMedia(env,`${match[1]}:${expires}`,signature)))return new Response(null,{status:404});
    const media=await env.DB.prepare(`SELECT pm.storage_key,pm.mime_type,pm.size_bytes FROM publication_jobs j
      JOIN projects p ON p.id=j.project_id AND p.user_id=j.user_id
      JOIN project_media pm ON pm.id=j.media_id AND pm.project_id=p.id AND pm.role=j.media_source
      JOIN social_connections c ON c.id=j.connection_id AND c.user_id=j.user_id AND c.status='connected'
      WHERE j.id=?1 AND j.status IN ('pending','processing','published') LIMIT 1`).bind(match[1]).first<Media>();
    if(!media)return new Response(null,{status:404});
    const object=await env.MEDIA.get(media.storage_key);if(!object)return new Response(null,{status:404});
    return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':media.mime_type,'Content-Length':String(object.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
  }catch{return new Response(null,{status:404});}
}
export async function handleSocialPublish(request: Request, env: Env, pathname: string): Promise<Response|null> {
  const match=pathname.match(/^\/api\/projects\/([^/]+)\/(publish|publications)$/);if(!match)return null;
  const user=await requireUser(request,env);if(user instanceof Response)return user;
  try {
    const projectId=decodeURIComponent(match[1]);
    if(!await env.DB.prepare(`SELECT id FROM projects WHERE id=?1 AND user_id=?2`).bind(projectId,user.id).first())return json({ok:false,error:'PROJECT_NOT_FOUND'},404);
    if(!socialConfigured(env))return json({ok:false,error:'SOCIAL_NOT_CONFIGURED'},503);
    if(match[2]==='publications'&&request.method==='GET') {
      const requestId=new URL(request.url).searchParams.get('requestId');
      if(!requestId||requestId.length>80)return json({ok:false,error:'INVALID_SOCIAL_REQUEST'},400);
      const rows=(await env.DB.prepare(`SELECT * FROM publication_jobs WHERE request_id=?1 AND user_id=?2 AND project_id=?3`).bind(requestId,user.id,projectId).all<Job>()).results;
      if(!rows?.length)return json({ok:false,error:'PUBLICATION_NOT_FOUND'},404);
      return json({ok:true,requestId,results:rows.map(publicJob)});
    }
    if(match[2]!=='publish'||request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    const guard=requireSameOriginMutation(request);if(guard)return guard;
    if(new URL(request.url).origin!==env.SOCIAL_PUBLIC_ORIGIN)return json({ok:false,error:'INVALID_ORIGIN'},403);
    const body=await readBoundedJson(request,24*1024);if(body instanceof Response)return body;
    if(Object.keys(body).some(key=>!['providers','caption','useOptimizedImage','mediaId'].includes(key)))return json({ok:false,error:'INVALID_SOCIAL_REQUEST'},400);
    if(!Array.isArray(body.providers)||!body.providers.length||body.providers.length>4||body.providers.some(p=>!PROVIDERS.includes(p)))return json({ok:false,error:'INVALID_SOCIAL_PROVIDER'},400);
    const providers=[...new Set(body.providers as string[])].sort();
    if(providers.length!==body.providers.length)return json({ok:false,error:'INVALID_SOCIAL_PROVIDER'},400);
    if(providers.some(p=>p==='linkedin'||p==='x'))return json({ok:false,error:'SOCIAL_PROVIDER_NOT_AVAILABLE'},400);
    if(typeof body.caption!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.caption))return json({ok:false,error:'INVALID_CAPTION'},400);
    const caption=body.caption.trim();
    if(!caption||Array.from(caption).length>(providers.includes('instagram')?2200:5000))return json({ok:false,error:'INVALID_CAPTION'},400);
    if(body.useOptimizedImage!==undefined&&typeof body.useOptimizedImage!=='boolean')return json({ok:false,error:'INVALID_SOCIAL_REQUEST'},400);
    const optimized=body.useOptimizedImage!==false;
    if(body.mediaId!==undefined&&(typeof body.mediaId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(body.mediaId)))return json({ok:false,error:'INVALID_SOCIAL_REQUEST'},400);
    const mediaId=typeof body.mediaId==='string'?body.mediaId:null;
    const key=request.headers.get('Idempotency-Key')??'';
    if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))return json({ok:false,error:'INVALID_IDEMPOTENCY_KEY'},400);
    const payloadHash=await digest(JSON.stringify({projectId,providers,caption,optimized,mediaId}));
    let saved=await env.DB.prepare(`SELECT id,payload_hash FROM publication_requests WHERE user_id=?1 AND idempotency_key=?2`).bind(user.id,key).first<{id:string;payload_hash:string}>();
    if(saved&&saved.payload_hash!==payloadHash)return json({ok:false,error:'IDEMPOTENCY_CONFLICT'},409);
    if(!saved) {
      const media=await env.DB.prepare(`SELECT id,storage_key,mime_type,size_bytes,role FROM project_media WHERE project_id=?1 AND media_type='image' AND role IN ('original','optimized')
        AND (?2=1 OR role='original') AND (?3 IS NULL OR id=?3)
        ORDER BY CASE WHEN role='optimized' THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 1`).bind(projectId,optimized?1:0,mediaId).first<Media>();
      if(!media)return json({ok:false,error:'SOCIAL_MEDIA_NOT_AVAILABLE'},400);
      await checkMedia(env,media,providers.includes('instagram'));
      const states=[];
      for(const provider of providers) {
        const connection=await env.DB.prepare(`SELECT * FROM social_connections WHERE user_id=?1 AND provider=?2 AND status='connected' LIMIT 1`).bind(user.id,provider).first<Connection>();
        let error: string|null=null;
        if(!connection?.access_token_encrypted)error='SOCIAL_NOT_CONNECTED';
        else if(connection.token_expires_at&&Date.parse(connection.token_expires_at.replace(' ','T')+'Z')<=Date.now())error='SOCIAL_TOKEN_EXPIRED';
        states.push({provider,connectionId:connection?.id??null,error});
      }
      const id=crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO publication_requests(id,user_id,project_id,idempotency_key,payload_hash)
          SELECT ?1,?2,?3,?4,?5 WHERE (SELECT COUNT(*) FROM publication_requests WHERE user_id=?2 AND created_at>datetime('now','-1 hour'))<20
          ON CONFLICT(user_id,idempotency_key) DO NOTHING`).bind(id,user.id,projectId,key,payloadHash),
        ...states.map(state=>env.DB.prepare(`INSERT INTO publication_jobs(id,request_id,user_id,project_id,provider,connection_id,status,caption,media_id,media_source,error_code)
          SELECT ?1,r.id,?2,?3,?4,?5,?6,?7,?8,?9,?10 FROM publication_requests r WHERE r.user_id=?2 AND r.idempotency_key=?11 AND r.payload_hash=?12
          ON CONFLICT(request_id,provider) DO NOTHING`).bind(crypto.randomUUID(),user.id,projectId,state.provider,state.connectionId,state.error?'failed':'pending',caption,media.id,media.role,state.error,key,payloadHash)),
      ]);
      saved=await env.DB.prepare(`SELECT id,payload_hash FROM publication_requests WHERE user_id=?1 AND idempotency_key=?2`).bind(user.id,key).first<{id:string;payload_hash:string}>();
      if(!saved)return json({ok:false,error:'SOCIAL_RATE_LIMITED'},429);
      if(saved.payload_hash!==payloadHash)return json({ok:false,error:'IDEMPOTENCY_CONFLICT'},409);
    }
    const jobs=(await env.DB.prepare(`SELECT * FROM publication_jobs WHERE request_id=?1 AND user_id=?2 AND project_id=?3`).bind(saved.id,user.id,projectId).all<Job>()).results??[];
    // No AI, no optimization; processing/published/failed are never re-published on replay.
    for(const job of jobs)if(job.status==='pending')await runJob(env,job);
    const result=(await env.DB.prepare(`SELECT * FROM publication_jobs WHERE request_id=?1 AND user_id=?2`).bind(saved.id,user.id).all<Job>()).results??[];
    const response=json({ok:true,requestId:saved.id,results:result.map(publicJob)},result.some(row=>['pending','processing'].includes(row.status))?202:200);
    if(response.status===202)response.headers.set('Retry-After','10');
    return response;
  }catch(error){
    if(error instanceof SocialError)return json({ok:false,error:error.code},400);
    console.error('SOCIAL_PUBLICATION_REQUEST_FAILED');return json({ok:false,error:'SOCIAL_SERVICE_UNAVAILABLE'},503);
  }
}
