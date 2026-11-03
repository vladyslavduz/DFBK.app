import type { Env } from '../lib/env';
import { requireUser } from '../lib/user';
import { handleSchedulerPackageCreate } from './scheduler-package-create';
import { readOwnedPackageDraft, listOwnedPackageDrafts, type PackageReadResult } from '../lib/scheduler-package-read';
const API_ROOT='/api/scheduler/packages';
const RESPONSE_BYTES=256*1024;
function schedulerJson(data:unknown,status=200,extra:Record<string,string>={}):Response{
 const body=JSON.stringify(data);
 if(status===200&&new TextEncoder().encode(body).length>RESPONSE_BYTES)return schedulerFailure('SCHEDULER_READ_LIMIT',503);
 return new Response(body,{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra}});
}
function schedulerFailure(code:string,status:number,extra:Record<string,string>={}):Response{return schedulerJson({ok:false,error:{code}},status,extra);}
function schedulerReadFailure(result:Exclude<PackageReadResult<unknown>,{status:'ok'}>):Response{
 switch(result.status){
  case 'invalid':return schedulerFailure('INVALID_SCHEDULER_QUERY',400);
  case 'not_found':return schedulerFailure('SCHEDULER_PACKAGE_NOT_FOUND',404);
  case 'too_large':return schedulerFailure('SCHEDULER_READ_LIMIT',503);
  case 'integrity_error':return schedulerFailure('SCHEDULER_DATA_UNAVAILABLE',503);
  default:return schedulerFailure('SCHEDULER_UNAVAILABLE',503);
 }
}
/** Read endpoints plus separately gated draft creation. Neither enables sending. */
export async function handleSchedulerPackages(request:Request,env:Env,pathname:string):Promise<Response|null>{
 if(pathname!==API_ROOT&&!pathname.startsWith(API_ROOT+'/'))return null;
 if(request.url.length>4096)return schedulerFailure('SCHEDULER_URL_TOO_LONG',414);
 let url:URL;try{url=new URL(request.url);}catch{return schedulerFailure('INVALID_SCHEDULER_QUERY',400);}
 if(url.pathname!==pathname)return schedulerFailure('INVALID_SCHEDULER_QUERY',400);
 const detail=pathname===API_ROOT?null:pathname.slice(API_ROOT.length+1);
 if(detail!==null&&(!detail||detail.includes('/')))return schedulerFailure('SCHEDULER_PACKAGE_NOT_FOUND',404);
 if(request.method==='POST'&&detail===null&&env.SCHEDULER_DRAFT_WRITE_ENABLED==='true')return handleSchedulerPackageCreate(request,env);
 if(request.method!=='GET')return schedulerFailure('METHOD_NOT_ALLOWED',405,{Allow:detail===null&&env.SCHEDULER_DRAFT_WRITE_ENABLED==='true'?'GET, POST':'GET'});
 try{
  const actor=await requireUser(request,env);
  if(actor instanceof Response)return schedulerFailure('NOT_AUTHENTICATED',401);
  // No package-schema query occurs when this flag is absent or not exactly true.
  if(env.SCHEDULER_READ_ENABLED!=='true')return schedulerFailure('SCHEDULER_DISABLED',503);
  const params=url.searchParams;
  const allowed=detail===null?['limit','projectId','cursorCreatedAt','cursorId','from','to']:[];
  for(const key of params.keys())if(!allowed.includes(key)||params.getAll(key).length!==1)return schedulerFailure('INVALID_SCHEDULER_QUERY',400);
  if(detail!==null){
   let id:string;try{id=decodeURIComponent(detail);}catch{return schedulerFailure('INVALID_SCHEDULER_QUERY',400);}
   const result=await readOwnedPackageDraft(env.DB,actor.id,id);
   return result.status==='ok'?schedulerJson({ok:true,package:result.data,cannotDispatch:true}):schedulerReadFailure(result);
  }
  const limitText=params.get('limit')??'20';
  if(!/^(?:[1-9]|1[0-9]|20)$/.test(limitText))return schedulerFailure('INVALID_SCHEDULER_QUERY',400);
  const query:{limit:number;projectId?:string;from?:number;to?:number;cursor?:{createdAt:number;id:string}}={limit:Number(limitText)};
  if(params.has('projectId'))query.projectId=params.get('projectId')!;
  if(params.has('cursorCreatedAt')!==params.has('cursorId'))return schedulerFailure('INVALID_SCHEDULER_QUERY',400);
  if(params.has('cursorCreatedAt')){
   const value=params.get('cursorCreatedAt')!;
   if(!/^-?[0-9]{1,16}$/.test(value))return schedulerFailure('INVALID_SCHEDULER_QUERY',400);
   query.cursor={createdAt:Number(value),id:params.get('cursorId')!};
  }
  if(params.has('from')!==params.has('to'))return schedulerFailure('INVALID_SCHEDULER_QUERY',400);
  if(params.has('from')){for(const key of ['from','to'])if(!/^-?[0-9]{1,16}$/.test(params.get(key)!))return schedulerFailure('INVALID_SCHEDULER_QUERY',400);query.from=Number(params.get('from'));query.to=Number(params.get('to'));}
  const result=await listOwnedPackageDrafts(env.DB,actor.id,query);
  return result.status==='ok'?schedulerJson({ok:true,...result.data,cannotDispatch:true}):schedulerReadFailure(result);
 }catch{return schedulerFailure('SCHEDULER_UNAVAILABLE',503);}
}
