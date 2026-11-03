import { useEffect, useId, useMemo, useRef, useState } from 'react';
import AppLink from './AppLink';
import { publishingChannels, type PublishingChannel } from '../config/publishing';

import { projectDraftDestinations, type DraftDestination, saveProjectDraft, draftSaveMessage, DraftSaveError } from '../services/planner-draft';
import { confirmedDraftTime, draftTimeChoices } from '../lib/planner-draft-time';
import type { ProjectDraftSelection } from '../../worker/lib/scheduler-project-draft';
import '../styles/planner-draft.css';

type Channel='instagram'|'facebook';
type Target={selected:boolean;caption:string;override:boolean;local:string;offset:string};
type Attempt={key:string;selection:ProjectDraftSelection;phase:'sending'|'uncertain'|'rejected'|'conflict'|'saved';message:string;packageId?:string};
type Props={ownerId:string;projectId:string;mediaId:string;imageUrl:string;texts:Record<PublishingChannel,string>};

function TimeInput({label,local,offset,disabled,onChange}:{label:string;local:string;offset:string;disabled:boolean;onChange:(local:string,offset:string)=>void}){
 const id=useId(),choices=useMemo(()=>draftTimeChoices(local),[local]);
 return <div className="draft-time">
  <label htmlFor={id}>{label}</label>
  <input id={id} type="datetime-local" min="2000-01-01T00:00" max="2099-12-31T23:59" step="60" required value={local} disabled={disabled} onChange={e=>onChange(e.target.value,'')} />
  {choices.length===1&&<small>Europe/Berlin · UTC{choices[0].utcOffset}</small>}
  {local&&!choices.length&&<small role="alert">Diese Berliner Uhrzeit ist ungültig oder entfällt bei der Zeitumstellung.</small>}
  {choices.length>1&&<label>UTC-Versatz – {label}<select aria-label={'UTC-Versatz – '+label} required value={offset} disabled={disabled} onChange={e=>onChange(local,e.target.value)}>
   <option value="">Uhrzeit ausdrücklich wählen</option>{choices.map((c,i)=><option key={c.utcOffset} value={c.utcOffset}>{i===0?'Erste':'Zweite'} Uhrzeit · UTC{c.utcOffset} · {new Date(c.scheduledAt).toISOString().slice(11,16)} UTC</option>)}
  </select></label>}
 </div>;
}
export default function ProjectDraftForm({ownerId,projectId,mediaId,imageUrl,texts}:Props){
 const [open,setOpen]=useState(false),[revision,setRevision]=useState(0);
 const [connections,setConnections]=useState<DraftDestination[]|null>(null),[connectionError,setConnectionError]=useState('');
 const [local,setLocal]=useState(''),[offset,setOffset]=useState(''),[inputError,setInputError]=useState('');
 const [targets,setTargets]=useState<Record<Channel,Target>>(()=>({
  instagram:{selected:false,caption:texts.instagram,override:false,local:'',offset:''},
  facebook:{selected:false,caption:texts.facebook,override:false,local:'',offset:''}
 }));
 const [attempt,setAttempt]=useState<Attempt|null>(null),attemptRef=useRef<Attempt|null>(null),busy=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!open)return;let active=true;setConnections(null);setConnectionError('');
  void projectDraftDestinations().then(data=>{if(active)setConnections(data);}).catch(error=>{if(active)setConnectionError(error instanceof DraftSaveError&&error.code==='SCHEDULER_DISABLED'?'Der Planer ist noch nicht freigeschaltet.':'Verbindungen konnten nicht geladen werden. Bitte prüfe deine Integrationen und versuche es erneut.');});
  return()=>{active=false;};
 },[open,revision,ownerId]);
 function connection(channel:Channel){return connections?.find(c=>c.channel===channel&&c.connectionId&&/^[A-Za-z0-9_-]{1,128}$/.test(c.connectionId))||null;}
 function update(channel:Channel,patch:Partial<Target>){setTargets(previous=>({...previous,[channel]:{...previous[channel],...patch}}));setInputError('');}
 const locked=attempt!==null;
 const plannerUrl='/app/planner?projectId='+encodeURIComponent(projectId);
 async function persist(next:Attempt){
  if(busy.current)return;busy.current=true;
  const wasUncertain=next.phase==='uncertain'||next.phase==='conflict';
  const sending={...next,phase:'sending' as const,message:''};attemptRef.current=sending;setAttempt(sending);setInputError('');
  try{
   const saved=await saveProjectDraft(next.selection,next.key);
   if(alive.current){const done={...next,phase:'saved' as const,packageId:saved.packageId,message:saved.replayed?'Der bereits gespeicherte Entwurf wurde bestätigt.':'Entwurf im Planer gespeichert.'};attemptRef.current=done;setAttempt(done);}
  }catch(error){
   const problem=error instanceof DraftSaveError?error:new DraftSaveError('SAVE_UNCERTAIN',true);
   const phase=problem.conflict?'conflict':wasUncertain||problem.uncertain?'uncertain':'rejected';
   if(alive.current){const failed={...next,phase,message:draftSaveMessage(wasUncertain&&!problem.conflict?new DraftSaveError('SAVE_UNCERTAIN',true):problem)} as Attempt;attemptRef.current=failed;setAttempt(failed);}
  }finally{busy.current=false;}
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy.current||attemptRef.current)return;
  try{
   const now=Date.now(),commonTime=confirmedDraftTime(local,offset,now);
   const selected:ProjectDraftSelection['targets']=[];
   for(const channel of ['instagram','facebook'] as const){
    const target=targets[channel];if(!target.selected)continue;
    const account=connection(channel);
    if(!account?.connectionId)throw Error('Bitte wähle ein verbundenes Konto. Lade bei Bedarf die Verbindungen erneut.');
    if(!target.caption.trim()||target.caption.length>10000)throw Error('Bitte prüfe die Beitragstexte. Jeder Text muss ausgefüllt sein.');
    selected.push({channel,connectionId:account.connectionId,caption:target.caption,...(target.override?{timeOverride:confirmedDraftTime(target.local,target.offset,now)}:{})});
   }
   if(!selected.length)throw Error('Bitte wähle mindestens einen verbundenen Kanal.');
   const selection={projectId,mediaId,commonTime,targets:selected};
   const next:Attempt={key:crypto.randomUUID(),selection,phase:'sending',message:''};
   await persist(next);
  }catch(error){setInputError(error instanceof Error?error.message:'Bitte prüfe deine Auswahl.');}
 }
 return <section className="project-draft" aria-label="Planer-Entwurf">
  <button className="button button-secondary" type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Entwurf im Planer vorbereiten</button>
  {open&&<div className="project-draft__body">
   <h2>Deinen Beitrag vormerken</h2>
   <p>Wähle Kanäle, prüfe die Texte und lege die Zeit fest. Du speicherst einen Entwurf – noch keine Freigabe zur automatischen Veröffentlichung.</p>
   <figure className="project-draft__image"><img src={imageUrl} alt="Ausgewähltes Foto dieses Projekts für den Entwurf" /><figcaption>Dieses Projektfoto gilt für die ausgewählten Kanäle.</figcaption></figure>
   <form onSubmit={event=>void submit(event)}>
    <fieldset disabled={locked}><legend>Kanäle auswählen</legend>
     {connections===null&&!connectionError&&<p role="status">Verbindungen werden geprüft …</p>}
     {connectionError&&<p role="alert">{connectionError}</p>}
     <div className="project-draft__channels">{publishingChannels.map(item=>{
      const supported=item.id==='instagram'||item.id==='facebook',account=supported?connection(item.id as Channel):null;
      return <label className="project-draft__channel" key={item.id}>
       <input type="checkbox" aria-label={item.label+' für Entwurf auswählen'} disabled={!supported||!account} checked={supported?targets[item.id as Channel].selected:false} onChange={e=>{if(supported)update(item.id as Channel,{selected:e.target.checked});}} />
       <img src={'/visual/integrations/icons/'+item.icon} alt="" /><span><strong>{item.label}</strong><small>{account?account.label||'Verbundenes Konto':supported?'Verbundenes Konto erforderlich':'Planer-Anbindung noch nicht verfügbar'}</small></span>
      </label>;
     })}</div>
     <div className="publishing-actions"><button type="button" onClick={()=>setRevision(v=>v+1)}>Verbindungen erneut laden</button><AppLink to="/app/integrations">Konten verwalten</AppLink></div>
    </fieldset>
    <fieldset disabled={locked}><legend>Datum und Uhrzeit</legend><p>Alle Zeiten gelten für Europe/Berlin, unabhängig von deinem Gerät.</p>
     <TimeInput label="Gemeinsame Zeit" local={local} offset={offset} disabled={locked} onChange={(v,o)=>{setLocal(v);setOffset(o);setInputError('');}} />
    </fieldset>
    {(['instagram','facebook'] as const).filter(channel=>targets[channel].selected).map(channel=>{
     const target=targets[channel],name=channel==='instagram'?'Instagram':'Facebook';
     return <fieldset disabled={locked} key={channel}><legend>{name}</legend>
      <label>Text für {name} (Entwurf)<textarea aria-label={'Text für '+name+' (Entwurf)'} required maxLength={10000} rows={5} value={target.caption} onChange={e=>update(channel,{caption:e.target.value})} /></label>
      <label className="project-draft__override"><input type="checkbox" checked={target.override} onChange={e=>update(channel,{override:e.target.checked})} />Eigene Zeit für {name}</label>
      {target.override?<TimeInput label={name+' Zeit'} local={target.local} offset={target.offset} disabled={locked} onChange={(v,o)=>update(channel,{local:v,offset:o})} />:<p>Verwendet die gemeinsame Zeit.</p>}
     </fieldset>;
    })}
    {inputError&&<p role="alert">{inputError}</p>}
    {!attempt&&<button className="button" type="submit" disabled={!connections}>Entwurf speichern</button>}
   </form>
   {attempt&&<div className="project-draft__result">
    <p role={attempt.phase==='saved'||attempt.phase==='sending'?'status':'alert'}>{attempt.phase==='sending'?'Entwurf wird gespeichert …':attempt.message}</p>
    {attempt.phase==='saved'&&<p>Die Angaben sind in deinem Konto gespeichert. Es wurde nichts veröffentlicht; automatische Veröffentlichung ist noch nicht aktiviert.</p>}
    {(attempt.phase==='uncertain'||attempt.phase==='conflict')&&<p>Diese Seite vorerst geöffnet lassen. Ein erneuter Versuch verwendet dieselbe Auswahl und denselben Schlüssel.</p>}
    {(attempt.phase==='uncertain'||attempt.phase==='conflict')&&<button className="button" type="button" onClick={()=>{if(attemptRef.current)void persist(attemptRef.current);}}>Denselben Speicherversuch prüfen</button>}
    {attempt.phase==='rejected'&&<button className="button button-secondary" type="button" onClick={()=>{attemptRef.current=null;setAttempt(null);}}>Entwurf bearbeiten</button>}
    <AppLink className="button button-secondary" to={plannerUrl}>Entwürfe im Planer ansehen</AppLink>
   </div>}
   <p className="project-draft__note">Noch nicht gespeicherte Eingaben werden beim Verlassen nicht gesichert. Deine manuelle Kanalvorbereitung unten bleibt separat verfügbar.</p>
  </div>}
 </section>;
}
