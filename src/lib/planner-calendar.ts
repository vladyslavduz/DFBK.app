const berlinFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const berlinParts=(instant:number)=>Object.fromEntries(berlinFormatter.formatToParts(instant).map(p=>[p.type,p.value]));
export function berlinDay(instant:number):string{const p=berlinParts(instant);return p.year+'-'+p.month+'-'+p.day;}
export function berlinMonth(instant:number):string{return berlinDay(instant).slice(0,7);}
export function monthRange(month:string):{from:number;to:number}{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('INVALID_MONTH');
 const [year,m]=month.split('-').map(Number);if(year<2000||year>2099)throw Error('INVALID_MONTH');
 const boundary=(y:number,n:number)=>{const naive=Date.UTC(y,n,1);const p=berlinParts(naive);const wall=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));return naive-(wall-naive);};
 return {from:boundary(year,m-1),to:boundary(year,m)};
}
export function shiftMonth(month:string,step:number):string{monthRange(month);const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+step,1));const next=d.toISOString().slice(0,7);monthRange(next);return next;}
export function monthDays(month:string):(string|null)[]{monthRange(month);const [y,m]=month.split('-').map(Number),start=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7,count=new Date(Date.UTC(y,m,0)).getUTCDate();return [...Array(start).fill(null),...Array.from({length:count},(_,i)=>month+'-'+String(i+1).padStart(2,'0'))];}
