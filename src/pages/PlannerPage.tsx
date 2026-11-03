import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserArea } from '../contexts/UserAreaContext';
import AppLink from '../components/AppLink';
import { publishingChannels } from '../config/publishing';
import { getProjectMediaUrl, projectService } from '../services/projects';
import { plannerPage, plannerDetail, PlannerError, type PlannerPage as Page } from '../services/planner';
import type { PackageDetail } from '../../worker/lib/scheduler-package-read';
import { berlinDay, berlinMonth, monthDays, monthRange, shiftMonth } from '../lib/planner-calendar';
import '../styles/planner.css';
const channelName=(id:string)=>publishingChannels.find(c=>c.id===id)?.label||id;
const berlinTime=(instant:number)=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin',timeZoneName:'short'}).format(instant);
function ProjectPhoto({url}:{url:string|null}){
 const [failed,setFailed]=useState(false);
 return url&&!failed?<img className="planner-project-photo" src={url} alt="Foto des ausgewählten Projekts" onError={()=>setFailed(true)} />:<span className="planner-photo-placeholder">Kein Foto verfügbar</span>;
}
const errorText=(e:unknown)=>e instanceof PlannerError&&e.code==='SCHEDULER_DISABLED'?'Der Planer ist noch nicht freigeschaltet. Hier werden keine Termine simuliert.':e instanceof PlannerError&&e.code==='SCHEDULER_READ_LIMIT'?'Die Auswahl ist zu groß. Bitte wähle ein einzelnes Projekt.':e instanceof PlannerError&&e.code==='NOT_AUTHENTICATED'?'Bitte melde dich erneut an.':'Die Entwürfe konnten nicht geladen werden. Bitte versuche es erneut.';
export default function PlannerPage(){
 const {user}=useAuth(),{projects}=useUserArea();
 const [photo,setPhoto]=useState<{key:string;url:string|null}|null>(null);
 const [month,setMonth]=useState(()=>berlinMonth(Date.now())),[projectId,setProjectId]=useState(()=>{const id=new URLSearchParams(window.location.search).get('projectId')||'';return /^[A-Za-z0-9_-]{1,128}$/.test(id)?id:'';});
 const [channel,setChannel]=useState(''),[day,setDay]=useState(''),[selected,setSelected]=useState(''),[revision,setRevision]=useState(0);
 const key=(user?.id||'')+':'+month+':'+projectId,liveKey=useRef(key);liveKey.current=key;
 const [snapshot,setSnapshot]=useState<{key:string;page:Page}|null>(null),[error,setError]=useState<{key:string;text:string}|null>(null),[more,setMore]=useState(false);
 const moreAbort=useRef<AbortController|null>(null);
 const [details,setDetails]=useState<{key:string;data:PackageDetail}|null>(null),[detailError,setDetailError]=useState<{key:string;text:string}|null>(null);
 const ownProject=projects.find(p=>p.id===projectId),photoKey=(user?.id||'')+':'+(ownProject?.id||'');
 useEffect(()=>{let active=true;setPhoto(null);if(user&&ownProject)void projectService.getProjectMedia(ownProject.id).then(data=>{const media=data.media.optimized||data.media.original;if(active)setPhoto({key:photoKey,url:media?getProjectMediaUrl(ownProject.id,media.id):null});}).catch(()=>{if(active)setPhoto({key:photoKey,url:null});});return()=>{active=false;};},[photoKey]);
 const range=useMemo(()=>monthRange(month),[month]);
 useEffect(()=>{const abort=new AbortController();moreAbort.current?.abort();setMore(false);setSnapshot(null);setError(null);if(user)void plannerPage(range.from,range.to,null,projectId,abort.signal).then(page=>{if(!abort.signal.aborted&&liveKey.current===key)setSnapshot({key,page});}).catch(e=>{if(!abort.signal.aborted&&liveKey.current===key)setError({key,text:errorText(e)});});return()=>{abort.abort();moreAbort.current?.abort();};},[key,range.from,range.to,revision]);
 const page=snapshot?.key===key?snapshot.page:null,activeError=error?.key===key?error.text:'';
 const events=useMemo(()=>page?.packages.flatMap(p=>p.items.filter(i=>i.time.scheduledAt>=range.from&&i.time.scheduledAt<range.to&&(!channel||i.channel===channel)).map(i=>({...i,packageId:p.id,projectId:p.projectId,key:p.id+':'+i.id,day:berlinDay(i.time.scheduledAt)}))).sort((a,b)=>a.time.scheduledAt-b.time.scheduledAt||(a.key<b.key?-1:1))||[],[page,range,channel]);
 const counts=useMemo(()=>{const result=new Map<string,number>();for(const event of events)result.set(event.day,(result.get(event.day)||0)+1);return result;},[events]);
 const chosen=events.find(e=>e.key===selected),detailKey=key+':'+selected;
 useEffect(()=>{const abort=new AbortController();setDetails(null);setDetailError(null);if(chosen)void plannerDetail(chosen.packageId,abort.signal).then(data=>{if(!abort.signal.aborted&&liveKey.current===key)setDetails({key:detailKey,data});}).catch(e=>{if(!abort.signal.aborted)setDetailError({key:detailKey,text:errorText(e)});});return()=>abort.abort();},[detailKey,chosen?.packageId]);
 const detail=details?.key===detailKey?details.data:null,item=detail?.items.find(i=>i.id===chosen?.id);
 async function loadMore(){if(!page?.nextCursor||more)return;const requestKey=key,cursor=page.nextCursor;const abort=new AbortController();moreAbort.current=abort;setMore(true);try{const next=await plannerPage(range.from,range.to,cursor,projectId,abort.signal);if(next.nextCursor&&next.nextCursor.id===cursor.id&&next.nextCursor.createdAt===cursor.createdAt)throw new PlannerError('INVALID_RESPONSE');if(!abort.signal.aborted&&liveKey.current===requestKey)setSnapshot(previous=>previous?.key===requestKey?{key:requestKey,page:{packages:[...new Map([...previous.page.packages,...next.packages].map(p=>[p.id,p])).values()],nextCursor:next.nextCursor}}:previous);}catch(e){if(!abort.signal.aborted&&liveKey.current===requestKey)setError({key:requestKey,text:errorText(e)});}finally{if(liveKey.current===requestKey)setMore(false);}}
 const title=(id:string)=>projects.find(p=>p.id===id)?.title||'Projekt';
 const heading=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric',timeZone:'Europe/Berlin'}).format(range.from);
 const visible=events.filter(e=>!day||e.day===day);
 function move(step:number){setMonth(current=>shiftMonth(current,step));setDay('');setSelected('');}
 return <div className="app-page planner-page"><header className="app-page-heading"><span className="app-kicker">Planer</span><h1>Dein Planer</h1><p>Gespeicherte Entwürfe im Kalender · Zeitzone Europe/Berlin.</p></header>
 <p className="inline-notice">Automatische Veröffentlichung ist noch nicht aktiviert. Die Einträge sind Entwürfe, keine bestätigten Versandtermine.</p>
 <section className="planner-toolbar" aria-label="Kalenderauswahl"><button type="button" aria-label="Vorheriger Monat" disabled={month==='2000-01'} onClick={()=>move(-1)}>←</button><h2 aria-live="polite">{heading}</h2><button type="button" aria-label="Nächster Monat" disabled={month==='2099-12'} onClick={()=>move(1)}>→</button><button type="button" onClick={()=>{setMonth(berlinMonth(Date.now()));setDay('');setSelected('');}}>Heute</button>
 <label>Projekt<select aria-label="Projekt" value={projectId} onChange={e=>{setProjectId(e.target.value);setDay('');setSelected('');}}><option value="">Alle Projekte</option>{projectId&&!projects.some(p=>p.id===projectId)&&<option value={projectId}>Ausgewähltes Projekt</option>}{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
 <label>Kanal<select aria-label="Kanal" value={channel} onChange={e=>{setChannel(e.target.value);setSelected('');}}><option value="">Alle Kanäle</option>{publishingChannels.filter(c=>c.id!=='google_business').map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label></section>
 {projectId&&<section className="planner-project-preview" aria-label="Ausgewähltes Projekt"><ProjectPhoto key={photoKey+':'+(photo?.key===photoKey?photo.url:'')} url={photo?.key===photoKey?photo.url:null}/><div><strong>{ownProject?.title||'Projekt nicht verfügbar'}</strong><p>Nur dieses Projekt · Entwürfe, kein automatischer Versand</p></div></section>}
 {activeError&&<div className="inline-notice" role="alert"><p>{activeError}</p><button type="button" onClick={()=>setRevision(v=>v+1)}>Erneut laden</button></div>}
 {!page&&!activeError&&<p role="status">Entwürfe werden geladen …</p>}
 {page&&<><section className="planner-month" aria-label={heading+' Kalender'}><div className="planner-weekdays" aria-hidden="true">{['Mo','Di','Mi','Do','Fr','Sa','So'].map(d=><span key={d}>{d}</span>)}</div><div className="planner-days">{monthDays(month).map((date,i)=>date?<button type="button" data-day={date} key={date} className={day===date?'is-selected':''} aria-pressed={day===date} aria-label={date+': '+(counts.get(date)||0)+' Entwürfe'} onClick={()=>{setDay(current=>current===date?'':date);setSelected('');}}><strong>{Number(date.slice(-2))}</strong>{counts.has(date)&&<span>{(counts.get(date)||0)} <span className="planner-count-label">Entwürfe</span></span>}</button>:<span key={'blank'+i}/>)}</div></section>
 {page.nextCursor&&<div className="planner-more"><p>Weitere Einträge verfügbar. Lade sie, um den Monat vollständig zu sehen.</p><button type="button" disabled={more} onClick={()=>void loadMore()}>{more?'Wird geladen …':'Weitere Entwürfe laden'}</button></div>}
 <section className="planner-agenda" aria-labelledby="planner-agenda-heading"><header><h2 id="planner-agenda-heading">{day?day.split('-').reverse().join('.'):'Einträge im Monat'}</h2>{day&&<button type="button" onClick={()=>setDay('')}>Alle Tage</button>}</header>
 {!visible.length&&<p>Keine Einträge für diese Auswahl.{page.nextCursor?' Weitere Daten sind noch nicht geladen.':''}</p>}
 <ul>{visible.map(e=><li key={e.key}><button type="button" className="planner-event" onClick={()=>setSelected(e.key)} aria-pressed={selected===e.key}><time dateTime={new Date(e.time.scheduledAt).toISOString()}>{berlinTime(e.time.scheduledAt)}</time><strong>{title(e.projectId)}</strong><span className="planner-channel">{publishingChannels.find(c=>c.id===e.channel)&&<img src={'/visual/integrations/icons/'+publishingChannels.find(c=>c.id===e.channel)!.icon} alt=""/>}{channelName(e.channel)}{e.channel==='whatsapp'?' · '+({whatsapp_status:'Status',whatsapp_channel:'Kanal',whatsapp_recipient:'Nachricht'}[e.targetKind as 'whatsapp_status']||''):''}</span><span className="planner-draft">Entwurf · wird nicht gesendet</span></button></li>)}</ul></section></>}
 {chosen&&<section className="planner-detail" aria-label="Entwurfdetails"><header><h2>{channelName(chosen.channel)} · {title(chosen.projectId)}</h2><button type="button" onClick={()=>setSelected('')}>Schließen</button></header>{detailError?.key===detailKey?<p role="alert">{detailError.text}</p>:item?<><p><time dateTime={new Date(chosen.time.scheduledAt).toISOString()}>{berlinTime(chosen.time.scheduledAt)} · Europe/Berlin</time></p><p className="planner-draft">Entwurf · wird nicht gesendet</p><ProjectPhoto key={detailKey+item.media.id} url={getProjectMediaUrl(chosen.projectId,item.media.id)}/><p className="planner-caption">{item.caption}</p><AppLink to={'/app/projects/'+encodeURIComponent(chosen.projectId)+'/publish'}>Projektmaterialien öffnen</AppLink></>:<p role="status">Entwurf wird geladen …</p>}</section>}
 <p><AppLink to="/app/projects">Zu meinen Projekten</AppLink> · <AppLink to="/app/integrations">Kanäle verwalten</AppLink></p></div>;
}
