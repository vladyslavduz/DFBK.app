import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const mod = { exports: {} };
  const source = fs.readFileSync(new URL('../worker/lib/' + name + '.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(path => { assert.ok(path.startsWith('./')); return load(path.slice(2)); }, mod, mod.exports);
  cache.set(name, mod.exports); return mod.exports;
}
const { createPublicationPackage: build } = load('scheduler-package');
const { transition } = load('scheduler-state');
const now = Date.parse('2027-01-14T11:00:00Z');
// Fictional fixture limits and identifiers, not production defaults/accounts/addresses.
const limits = { maxTargets: 20, horizonMs: 4 * 86400000 };
const wall = (day=15) => ({ localDateTime: '2027-01-'+day+'T12:00', timezone:'Europe/Berlin', utcOffset:'+01:00', confirmed:true });
const target = (channel='instagram', key=channel, targetKind='account') => ({scheduleId:'schedule_'+key,targetKind,snapshot:{projectId:'project',channel,connectionId:'connection_'+key,destinationId:'destination_'+key,
  caption:'Eigener Text '+key+' 😀',mediaId:'image_'+key,mediaRole:'optimized',storageKey:'fixture/'+key+'.jpg',mediaSha256:'a'.repeat(64),mimeType:'image/jpeg',mediaBytes:100,
  connectorVersion:'fictional-v1',mediaProfile:'photo',executionOwner:'dfbk'}});
const draft = () => ({id:'package',ownerId:'owner',projectId:'project',commonTime:wall(),items:[target(),target('facebook')]});
const ok = r => {assert.equal(r.ok,true,r.error);return r.value;};
const bad = (r,error) => assert.deepEqual(r,{ok:false,error});
test('common time, independent captions/media, explicit override, no child approval',()=>{
  const input=draft();input.items[1].timeOverride=wall(16);
  const result=ok(build(input,now,limits));
  assert.equal(result.status,'draft');assert.equal(result.cannotDispatch,true);
  assert.equal(result.items[0].timeSource,'common');assert.equal(result.items[1].timeSource,'override');
  assert.equal(result.items[1].schedule.time.scheduledAt-result.items[0].schedule.time.scheduledAt,86400000);
  assert.notEqual(result.items[0].schedule.snapshot.caption,result.items[1].schedule.snapshot.caption);
  for(const {schedule} of result.items){assert.equal(schedule.approval,null);assert.equal(schedule.attempts,0);assert.equal(schedule.lease,null);}
});
test('all eight requested directions, multiple sites/recipients and three WhatsApp modes remain distinct',()=>{
  const input=draft();input.items=[target(),target('facebook'),target('pinterest','pin','board'),target('x'),target('linkedin'),target('website','site1','blog'),target('website','site2','blog'),target('email','recipient1','email_recipient'),target('email','recipient2','email_recipient'),
    target('whatsapp','wa','whatsapp_status'),target('whatsapp','wa','whatsapp_channel'),target('whatsapp','wa','whatsapp_recipient')];
  input.items.slice(-3).forEach((v,i)=>v.scheduleId+='_'+i);
  const result=ok(build(input,now,limits));assert.equal(result.items.length,12);assert.equal(new Set(result.items.map(v=>v.schedule.executionKey)).size,12);assert.equal(result.cannotDispatch,true);
});
test('ten projects retain independent dates and snapshots',()=>{
  for(let i=0;i<10;i++){const input=draft();input.id='package_'+i;input.projectId='project_'+i;input.commonTime={...wall(),localDateTime:'2027-01-'+String(15+i).padStart(2,'0')+'T12:00'};input.items.forEach(v=>{v.scheduleId+='_'+i;v.snapshot.projectId=input.projectId;});
    const result=ok(build(input,now,{...limits,horizonMs:20*86400000}));assert.equal(result.projectId,'project_'+i);assert.equal(result.items[0].schedule.time.localDateTime,input.commonTime.localDateTime);}
});
test('duplicate child IDs and exact target tuples are rejected atomically',()=>{
  let input=draft();input.items[1].scheduleId=input.items[0].scheduleId;bad(build(input,now,limits),'DUPLICATE_PACKAGE_SCHEDULE');
  input=draft();input.items.push({...structuredClone(input.items[0]),scheduleId:'other'});bad(build(input,now,limits),'DUPLICATE_PACKAGE_TARGET');
});
test('wrong project, target kind, excluded Google and provider timer are rejected',()=>{
  let input=draft();input.items[1].snapshot.projectId='foreign';bad(build(input,now,limits),'PACKAGE_PROJECT_MISMATCH');
  input=draft();input.items[0].targetKind='blog';bad(build(input,now,limits),'INVALID_PACKAGE_TARGET_KIND');
  input=draft();input.items[0].snapshot.channel='google_business';bad(build(input,now,limits),'INVALID_PACKAGE_TARGET_KIND');
  input=draft();input.items[0].snapshot.executionOwner='provider';bad(build(input,now,limits),'PACKAGE_EXECUTION_OWNER_MISMATCH');
});
test('past, over horizon and malformed dates fail without partial results',()=>{
  let input=draft();bad(build(input,now+2*86400000,limits),'PACKAGE_OUTSIDE_HORIZON');
  input.items[1].timeOverride=wall(20);bad(build(input,now,limits),'PACKAGE_OUTSIDE_HORIZON');
  input=draft();input.commonTime.localDateTime='2027-02-30T12:00';bad(build(input,now,limits),'INVALID_LOCAL_TIME');
  input=draft();input.items[1].timeOverride=undefined;bad(build(input,now,limits),'INVALID_TIME_CONFIRMATION');
});
test('Berlin spring gap and autumn offset are checked for each destination',()=>{
  const input=draft(), n=Date.parse('2027-03-27T00:00:00Z');input.commonTime={...wall(),localDateTime:'2027-03-28T02:30'};bad(build(input,n,limits),'NONEXISTENT_LOCAL_TIME');
  const fallNow=Date.parse('2027-10-30T00:00:00Z');input.commonTime={...wall(),localDateTime:'2027-10-31T02:30',utcOffset:'+02:00'};
  input.items[1].timeOverride={...input.commonTime,utcOffset:'+01:00'};
  const result=ok(build(input,fallNow,limits));assert.equal(result.items[1].schedule.time.scheduledAt-result.items[0].schedule.time.scheduledAt,3600000);
  input.items[1].timeOverride.utcOffset='+03:00';bad(build(input,fallNow,limits),'OFFSET_ZONE_MISMATCH');
});
test('explicit limits, valid clock, nonempty bounded dense lists and plain data only',()=>{
  bad(build(draft(),now,undefined),'PACKAGE_LIMITS_REQUIRED');bad(build(draft(),NaN,limits),'INVALID_PACKAGE_CLOCK');
  for(const items of [[],new Array(2),[target(),target('facebook'),target('x')]])bad(build({...draft(),items},now,{...limits,maxTargets:2}),'INVALID_PACKAGE_ITEMS');
  let input=draft();input.items.extra=1;bad(build(input,now,limits),'INVALID_PACKAGE_ITEMS');
  input=draft();input.extra='dropped?';bad(build(input,now,limits),'INVALID_PACKAGE');
  input=draft();Object.defineProperty(input.items[0].snapshot,'caption',{enumerable:true,get(){throw Error('Getter must not run');}});bad(build(input,now,limits),'INVALID_SNAPSHOT');
  input=draft();input.items[0].snapshot.accessToken='must not be accepted';bad(build(input,now,limits),'INVALID_SNAPSHOT');
});
test('comparison identity pins content, destination mode, owner, time and policy, independent of checkbox order',()=>{
  const input=draft(), result=ok(build(input,now,limits));assert.equal(ok(build({...input,items:[...input.items].reverse()},now,limits)).draftIdentity,result.draftIdentity);
  for(const mutate of [v=>v.ownerId='other',v=>v.items[0].snapshot.caption+=' change',v=>v.items[0].snapshot.mediaSha256='b'.repeat(64),v=>v.items[0].snapshot.destinationId='other',v=>v.items[0].timeOverride=wall(16)]){const edited=draft();mutate(edited);assert.notEqual(ok(build(edited,now,limits)).draftIdentity,result.draftIdentity);}
  assert.notEqual(ok(build(input,now,{...limits,maxTargets:21})).draftIdentity,result.draftIdentity);
  const wa={...draft(),items:[target('whatsapp','wa','whatsapp_status')]}, a=ok(build(wa,now,limits));wa.items[0].targetKind='whatsapp_channel';assert.notEqual(ok(build(wa,now,limits)).draftIdentity,a.draftIdentity);
});
test('deep immutable detached results; old kernel rejects dispatch of unapproved child',()=>{
  const input=draft(), result=ok(build(input,now,limits));input.items[0].snapshot.caption='mutated';assert.notEqual(result.items[0].schedule.snapshot.caption,'mutated');
  assert.ok(Object.isFrozen(result.items[0].schedule.snapshot));assert.throws(()=>{result.items[0].schedule.snapshot.caption='edited';},TypeError);
  assert.throws(()=>result.items.push({}),TypeError);
  const child=result.items[0].schedule;bad(transition(child,child.version,{type:'claim',token:'fictional_lease_123',leaseExpiresAt:child.time.scheduledAt+60000,policy:{},gates:{}},child.time.scheduledAt),'CLAIM_CONFLICT');
});
test('package module and draft creation perform no network, timers, clocks or random ID generation',()=>{
  const originals={fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,setInterval:globalThis.setInterval}, clock=Date.now, random=Math.random, cryptoDescriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');let calls=0;
  try {for(const key of Object.keys(originals))globalThis[key]=()=>{calls++;throw Error('Unexpected side effect');};Date.now=()=>{calls++;throw Error('Unexpected clock');};Math.random=()=>{calls++;throw Error('Unexpected random');};Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID(){calls++;throw Error('Unexpected ID');},getRandomValues(){calls++;throw Error('Unexpected random');}}});cache.clear();const pure=load('scheduler-package');ok(pure.createPublicationPackage(draft(),now,limits));assert.equal(calls,0);}
  finally{Object.assign(globalThis,originals);Date.now=clock;Math.random=random;if(cryptoDescriptor)Object.defineProperty(globalThis,'crypto',cryptoDescriptor);else delete globalThis.crypto;}
});
