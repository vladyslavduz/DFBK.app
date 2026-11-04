import { draftTimeChoices } from './planner-draft-time';
import { berlinDay } from './planner-calendar';
import { publishingChannels, type PublishingChannel } from '../config/publishing';
export type DemoTime={local:string;offset:string};
export type DemoRow={channel:PublishingChannel;scheduledAt:number};
export function futureDemoTime(now:number):DemoTime{return {local:berlinDay(now+86400000)+'T12:00',offset:''};}
export function demoAgenda(channels:PublishingChannel[],common:DemoTime,overrides:Partial<Record<PublishingChannel,DemoTime>>,now:number):DemoRow[]{
 if(!channels.length)throw Error('Bitte wähle mindestens einen Kanal.');
 return [...new Set(channels)].map(channel=>{
  if(!publishingChannels.some(c=>c.id===channel))throw Error('Bitte wähle einen bekannten Kanal.');
  const input=overrides[channel]||common,choices=draftTimeChoices(input.local);
  const choice=choices.length===1?choices[0]:choices.find(c=>c.utcOffset===input.offset);
  if(!choice)throw Error(choices.length>1?'Bitte wähle bei der Zeitumstellung die erste oder zweite Uhrzeit.':'Bitte wähle eine gültige Berliner Zeit. Diese Uhrzeit kann bei der Zeitumstellung entfallen.');
  if(choice.scheduledAt<=now)throw Error('Bitte wähle einen Zeitpunkt in der Zukunft.');
  return {channel,scheduledAt:choice.scheduledAt};
 }).sort((a,b)=>a.scheduledAt-b.scheduledAt);
}
export const demoDate=(instant:number)=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin',timeZoneName:'short'}).format(instant);
