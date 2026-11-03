import { appConfig } from '../config/app';
import type { ProjectDraftSelection } from '../../worker/lib/scheduler-project-draft';
export type SavedProjectDraft={packageId:string;replayed:boolean};
export class DraftSaveError extends Error{
 constructor(public code:string,public uncertain:boolean,public conflict=false){super(code);}
}
/** Same-origin draft creation only. No provider, publishing, image URL or credentials in the body. */
export async function saveProjectDraft(selection:ProjectDraftSelection,key:string):Promise<SavedProjectDraft>{
 const url=new URL(appConfig.apiBaseUrl+'/scheduler/packages',window.location.origin);
 if(url.origin!==window.location.origin)throw new DraftSaveError('UNSAFE_API_ORIGIN',false);
 if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new DraftSaveError('INVALID_IDEMPOTENCY_KEY',false);
 const body=JSON.stringify(selection);
 if(new TextEncoder().encode(body).length>24*1024)throw new DraftSaveError('REQUEST_TOO_LARGE',false);
 let response:Response,value:any;
 try{
  response=await fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','Idempotency-Key':key},body});
  const text=await response.text();if(new TextEncoder().encode(text).length>16*1024)throw Error();
  value=JSON.parse(text);
 }catch{throw new DraftSaveError('SAVE_UNCERTAIN',true);}
 if(!response.ok){
  if(value?.ok!==false||typeof value?.error?.code!=='string')throw new DraftSaveError('SAVE_UNCERTAIN',true);
  throw new DraftSaveError(value.error.code,response.status>=500&&!['SCHEDULER_DISABLED','SCHEDULER_POLICY_REQUIRED'].includes(value.error.code),value.error.code==='SCHEDULER_REQUEST_CONFLICT');
 }
 if(![200,201].includes(response.status)||value?.ok!==true||value.status!=='draft'||value.cannotDispatch!==true||
  typeof value.replayed!=='boolean'||value.replayed!==(response.status===200)||typeof value.packageId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.packageId))throw new DraftSaveError('SAVE_UNCERTAIN',true);
 return {packageId:value.packageId,replayed:value.replayed};
}
export function draftSaveMessage(error:DraftSaveError):string{
 if(error.conflict)return 'Zu diesem Versuch ist bereits ein anderer Entwurf gespeichert. Prüfe zuerst deinen Planer. Es wird nichts überschrieben.';
 if(error.uncertain)return 'Die Speicherung konnte nicht sicher bestätigt werden. Prüfe den Planer oder wiederhole exakt denselben Versuch. Es wurde keine Veröffentlichung beauftragt.';
 switch(error.code){
  case 'METHOD_NOT_ALLOWED':case 'SCHEDULER_DISABLED':case 'SCHEDULER_POLICY_REQUIRED':return 'Das Speichern von Planer-Entwürfen ist noch nicht freigeschaltet.';
  case 'NOT_AUTHENTICATED':return 'Bitte melde dich erneut an.';
  case 'EMAIL_NOT_VERIFIED':return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  case 'PLAN_ACCESS_REQUIRED':return 'Dein aktiver Zugang konnte nicht bestätigt werden. Prüfe deinen Tarif.';
  case 'DRAFT_CONNECTION_UNAVAILABLE':return 'Ein gewähltes Konto ist nicht mehr verbunden. Lade die Verbindungen erneut.';
  case 'DRAFT_MEDIA_UNAVAILABLE':case 'DRAFT_MATERIAL_NOT_FOUND':case 'DRAFT_PROJECT_NOT_READY':return 'Projekt oder Bild ist nicht mehr verfügbar oder noch nicht bereit. Prüfe die Projektdetails.';
  case 'REQUEST_TOO_LARGE':return 'Die Texte sind zusammen zu lang. Bitte kürze sie.';
  default:return 'Der Entwurf wurde nicht bestätigt. Prüfe die Auswahl und die Zeiten.';
 }
}
