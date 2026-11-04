import { useId, useMemo, useState } from 'react';
import AppLink from './AppLink';
import { publishingChannels, promoImage, type PublishingChannel } from '../config/publishing';
import { draftTimeChoices } from '../lib/planner-draft-time';
import { demoAgenda, demoDate, futureDemoTime, type DemoRow, type DemoTime } from '../lib/public-demo-plan';
import '../styles/public-demo-plan.css';
const notice='Interaktive Demo. Es wird nichts veröffentlicht. Dein Demo-Plan wird nicht dauerhaft gespeichert.';
function DemoTimeInput({label,value,onChange}:{label:string;value:DemoTime;onChange:(next:DemoTime)=>void}){
 const id=useId(),choices=useMemo(()=>draftTimeChoices(value.local),[value.local]);
 return <div className="demo-plan__time"><label htmlFor={id}>{label}</label><input id={id} type="datetime-local" min="2000-01-01T00:00" max="2099-12-31T23:59" required value={value.local} onChange={e=>onChange({local:e.target.value,offset:''})}/>
 {choices.length>1&&<label>Uhrzeit bei Zeitumstellung · {label}<select required value={value.offset} onChange={e=>onChange({...value,offset:e.target.value})}><option value="">Bitte wählen</option>{choices.map((c,i)=><option key={c.utcOffset} value={c.utcOffset}>{i===0?'Erste':'Zweite'} Uhrzeit · UTC{c.utcOffset}</option>)}</select></label>}
 {value.local&&!choices.length&&<small role="alert">Diese Berliner Uhrzeit ist ungültig.</small>}</div>;
}
export default function PublicDemoPlan(){
 const [selected,setSelected]=useState<PublishingChannel[]>(['instagram','facebook']);
 const [common,setCommon]=useState<DemoTime>(()=>futureDemoTime(Date.now()));
 const [individual,setIndividual]=useState(false),[overrides,setOverrides]=useState<Partial<Record<PublishingChannel,DemoTime>>>({});
 const [saved,setSaved]=useState<DemoRow[]|null>(null),[error,setError]=useState('');
 function submit(e:React.FormEvent){e.preventDefault();try{setSaved(demoAgenda(selected,common,individual?overrides:{},Date.now()));setError('');}catch(e){setError(e instanceof Error?e.message:'Bitte prüfe deine Auswahl.');}}
 return <section className="share-hub demo-plan" aria-labelledby="demo-plan-heading">
 <div className="share-hub__intro"><h2 id="demo-plan-heading">Ein Foto. Mehrere Kanäle. Dein Zeitplan.</h2><p>Probiere ohne Anmeldung aus, wie du Beiträge vorbereiten könntest.</p></div>
 <p className="demo-plan__notice">{notice}</p>
 <div className="demo-plan__example"><img src={promoImage} alt="DFBK-Demofoto eines Friseurergebnisses"/><p>Ein Beispiel für deinen Plan: Kanäle wählen, Zeiten festlegen, Übersicht ansehen. Echte Kanalverbindungen und Versand sind hier nicht aktiv.</p></div>
 {!saved?<form onSubmit={submit}>
 <fieldset><legend>1. Deine Kanäle</legend><div className="demo-plan__channels">{publishingChannels.map(c=><label key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={e=>{setSelected(current=>e.target.checked?[...current,c.id]:current.filter(id=>id!==c.id));setError('');}}/><img src={'/visual/integrations/icons/'+c.icon} alt=""/>{c.label}</label>)}</div></fieldset>
 <fieldset><legend>2. Datum und Uhrzeit · Europe/Berlin</legend><DemoTimeInput label="Gemeinsame Zeit" value={common} onChange={setCommon}/><label className="demo-plan__toggle"><input type="checkbox" checked={individual} onChange={e=>setIndividual(e.target.checked)}/>Eigene Zeit je Kanal</label>
 {individual&&selected.map(channel=><DemoTimeInput key={channel} label={publishingChannels.find(c=>c.id===channel)!.label+' Zeit'} value={overrides[channel]||common} onChange={value=>setOverrides(current=>({...current,[channel]:value}))}/>)}</fieldset>
 {error&&<p role="alert">{error}</p>}<button className="button" type="submit" disabled={!selected.length}>Demo-Plan speichern</button>{!selected.length&&<p role="status">Wähle mindestens einen Kanal für deinen Demo-Plan.</p>}
 </form>:<div className="demo-plan__result"><h3 tabIndex={-1}>Dein Demo-Plan</h3><ul aria-label="Demo-Plan Übersicht">{saved.map(row=>{const c=publishingChannels.find(c=>c.id===row.channel)!;return <li key={row.channel}><img src={promoImage} alt=""/><div><strong><img src={'/visual/integrations/icons/'+c.icon} alt=""/>{c.label}</strong><time dateTime={new Date(row.scheduledAt).toISOString()}>{demoDate(row.scheduledAt)}</time><span>Nur Demo</span></div></li>;})}</ul><p role="status">Demo-Plan erstellt. {notice}</p><button className="button button-secondary" type="button" onClick={()=>setSaved(null)}>Demo-Plan bearbeiten</button></div>}
 <p className="demo-plan__footer">{notice} <AppLink to="/register">Mit eigenen Projekten ausprobieren</AppLink></p>
 </section>;
}
