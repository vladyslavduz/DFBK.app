import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),cache=new Map(),config={apiBaseUrl:'/api'};
function load(file){if(cache.has(file))return cache.get(file);const mod={exports:{}},code=ts.transpileModule(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','module','exports',code)(p=>{if(p==='../config/app')return {appConfig:config};if(p==='../../worker/lib/scheduler-contract')return load('worker/lib/scheduler-contract.ts');throw Error(p);},mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
const {draftTimeChoices,confirmedDraftTime}=load('src/lib/planner-draft-time.ts');
const {saveProjectDraft,DraftSaveError,draftSaveMessage}=load('src/services/planner-draft.ts');
const selection={projectId:'project',mediaId:'media',commonTime:{localDateTime:'2027-01-15T12:00',timezone:'Europe/Berlin',utcOffset:'+01:00',confirmed:true},targets:[{channel:'instagram',connectionId:'ig',caption:'Fixture Ä 😀'}]};
test('Berlin times validate normal/invalid dates independently of host timezone',()=>{
 assert.equal(draftTimeChoices('2027-01-15T12:00')[0].scheduledAt,Date.parse('2027-01-15T11:00Z'));
 assert.equal(draftTimeChoices('2027-07-15T12:00')[0].utcOffset,'+02:00');
 for(const local of ['','2027-02-30T12:00','2027-01-15T25:00','2100-01-01T12:00','https://example.invalid'])assert.deepEqual(draftTimeChoices(local),[]);
 assert.equal(confirmedDraftTime('2027-01-15T12:00','',Date.parse('2027-01-14')).confirmed,true);
 assert.throws(()=>confirmedDraftTime('2027-01-15T12:00','',Date.parse('2027-01-16')),/Zukunft/);
});
test('DST gap rejected; fold requires explicit offset and yields distinct instants',()=>{
 assert.deepEqual(draftTimeChoices('2027-03-28T02:30'),[]);
 const choices=draftTimeChoices('2027-10-31T02:30');assert.equal(choices.length,2);assert.equal(choices[1].scheduledAt-choices[0].scheduledAt,3600000);
 assert.throws(()=>confirmedDraftTime('2027-10-31T02:30','',0),/erste oder zweite/);
 for(const c of choices)assert.equal(confirmedDraftTime(c.localDateTime,c.utcOffset,0).utcOffset,c.utcOffset);
});
async function withFetch(mock,fn){const savedFetch=globalThis.fetch,savedWindow=globalThis.window;globalThis.window={location:{origin:'https://fixture.invalid'}};globalThis.fetch=mock;try{await fn();}finally{globalThis.fetch=savedFetch;globalThis.window=savedWindow;config.apiBaseUrl='/api';}}
const response=(status,body)=>new Response(JSON.stringify(body),{status});
test('save sends only supplied selection to same-origin draft endpoint and requires real acknowledgement',()=>withFetch(async(url,options)=>{
 assert.equal(String(url),'https://fixture.invalid/api/scheduler/packages');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');assert.equal(options.method,'POST');assert.equal(options.headers['Idempotency-Key'],'fixture_request_01');assert.deepEqual(JSON.parse(options.body),selection);
 return response(201,{ok:true,packageId:'pkg_1',status:'draft',replayed:false,cannotDispatch:true});
},async()=>{assert.deepEqual(await saveProjectDraft(selection,'fixture_request_01'),{packageId:'pkg_1',replayed:false});}));
test('same key and payload can be replayed; 200 must explicitly confirm a draft',()=>withFetch(async()=>response(200,{ok:true,packageId:'pkg_1',status:'draft',replayed:true,cannotDispatch:true}),async()=>{assert.equal((await saveProjectDraft(selection,'fixture_request_01')).replayed,true);}));
test('network, invalid JSON, contradictory success and 5xx stay uncertain',async()=>{
 for(const mock of [async()=>{throw Error('network');},async()=>new Response('bad',{status:200}),async()=>response(201,{ok:true,packageId:'pkg_1',status:'published',replayed:false,cannotDispatch:true}),async()=>response(200,{ok:true,packageId:'pkg_1',status:'draft',replayed:false,cannotDispatch:true}),async()=>response(503,{ok:false,error:{code:'SCHEDULER_SAVE_UNCERTAIN'}})]){
  await withFetch(mock,async()=>{await assert.rejects(()=>saveProjectDraft(selection,'fixture_request_01'),e=>e instanceof DraftSaveError&&e.uncertain);});
 }
});
test('disabled/policy responses explain availability; conflicts are never overwritten',async()=>{
 for(const code of ['METHOD_NOT_ALLOWED','SCHEDULER_DISABLED','SCHEDULER_POLICY_REQUIRED']){
  await withFetch(async()=>response(code==='METHOD_NOT_ALLOWED'?405:503,{ok:false,error:{code}}),async()=>{await assert.rejects(()=>saveProjectDraft(selection,'fixture_request_01'),e=>!e.uncertain&&draftSaveMessage(e).includes('noch nicht freigeschaltet'));});
 }
 await withFetch(async()=>response(409,{ok:false,error:{code:'SCHEDULER_REQUEST_CONFLICT'}}),async()=>{await assert.rejects(()=>saveProjectDraft(selection,'fixture_request_01'),e=>e.conflict&&draftSaveMessage(e).includes('nichts überschrieben'));});
});
test('cross-origin configuration and oversize request reject before fetch',()=>withFetch(async()=>{throw Error('Must not fetch');},async()=>{
 config.apiBaseUrl='https://other.invalid/api';await assert.rejects(()=>saveProjectDraft(selection,'fixture_request_01'),e=>e.code==='UNSAFE_API_ORIGIN'&&!e.uncertain);
 config.apiBaseUrl='/api';await assert.rejects(()=>saveProjectDraft({...selection,targets:[{...selection.targets[0],caption:'😀'.repeat(7000)}]},'fixture_request_01'),e=>e.code==='REQUEST_TOO_LARGE'&&!e.uncertain);
}));
