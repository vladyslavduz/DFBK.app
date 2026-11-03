import { validateScheduleTime } from '../../worker/lib/scheduler-contract';
export type DraftTime={localDateTime:string;timezone:'Europe/Berlin';utcOffset:string;confirmed:true};
export type TimeChoice=DraftTime&{scheduledAt:number};
/** Wall-clock input is Berlin time, independent of the browser's timezone. */
export function draftTimeChoices(localDateTime:string):TimeChoice[]{
 if(!/^(20[0-9]{2})-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime))return [];
 const naive=Date.parse(localDateTime+':00Z');if(!Number.isFinite(naive))return [];
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const offsets=new Set<string>();
 for(let hours=-36;hours<=36;hours+=6){
  const instant=naive+hours*3600000,parts=Object.fromEntries(formatter.formatToParts(instant).map(p=>[p.type,p.value]));
  const wall=Date.parse(parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute+':'+parts.second+'Z');
  const minutes=Math.round((wall-instant)/60000),absolute=Math.abs(minutes);
  offsets.add((minutes<0?'-':'+')+String(Math.floor(absolute/60)).padStart(2,'0')+':'+String(absolute%60).padStart(2,'0'));
 }
 return [...offsets].flatMap(utcOffset=>{const input={localDateTime,timezone:'Europe/Berlin' as const,utcOffset,confirmed:true as const};const checked=validateScheduleTime(input);return checked.ok?[{...input,scheduledAt:checked.value.scheduledAt}]:[];}).sort((a,b)=>a.scheduledAt-b.scheduledAt);
}
export function confirmedDraftTime(localDateTime:string,offset:string,now:number):DraftTime{
 const choices=draftTimeChoices(localDateTime),chosen=choices.length===1?choices[0]:choices.find(c=>c.utcOffset===offset);
 if(!chosen)throw Error(choices.length>1?'Bitte wähle die erste oder zweite Uhrzeit bei der Zeitumstellung.':'Bitte wähle eine gültige Berliner Zeit. Diese Uhrzeit kann bei der Zeitumstellung entfallen.');
 if(chosen.scheduledAt<now)throw Error('Bitte wähle einen Zeitpunkt in der Zukunft.');
 return {localDateTime:chosen.localDateTime,timezone:'Europe/Berlin',utcOffset:chosen.utcOffset,confirmed:true};
}
