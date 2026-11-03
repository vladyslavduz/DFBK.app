const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const origin=process.env.PROMO_ORIGIN||'http://127.0.0.1:4185',image=fs.readFileSync('public/visual/integrations/friseur-optimized.webp');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PROMO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.addInitScript(()=>{Date.now=()=>Date.parse('2027-01-14T11:00Z');window.nativeShares=0;Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{window.nativeShares++;}});});
 let mode='success',connected=true,guest=false,projectStatus='ready',releaseSave;const posts=[],errors=[];let saved=null;
 page.on('pageerror',e=>errors.push(e.message));
 const project=id=>({id,title:'Synthetic project '+id,titleSource:'manual',description:'Fixture',status:projectStatus,createdAt:'2027-01-01',updatedAt:'2027-01-01',media:{id:id+'-original',mimeType:'image/webp'},photoOptimization:{state:'completed'}});
 const connection=provider=>{const active=connected&&['instagram','facebook'].includes(provider);return {provider,availability:active?'available':'in_preparation',connected:active,connectionId:active?provider+'-fixture':null,accountId:active?'111':null,accountName:active?'Fixture '+provider:null,status:active?'connected':'not_connected',accounts:[]};};
 const stored=(data,key)=>{
  const t=v=>({localDateTime:v.localDateTime,timezone:v.timezone,utcOffset:v.utcOffset,scheduledAt:Date.parse(v.localDateTime+':00'+v.utcOffset)});
  const items=data.targets.map((v,i)=>({id:'item-'+i,channel:v.channel,targetKind:'account',timeSource:v.timeOverride?'override':'common',time:t(v.timeOverride||data.commonTime),status:'draft'})),times=items.map(i=>i.time.scheduledAt);
  return {id:'pkg-fixture',projectId:data.projectId,version:1,status:'draft',createdAt:Date.now(),commonTime:t(data.commonTime),itemCount:items.length,earliestAt:Math.min(...times),latestAt:Math.max(...times),items};
 };
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;let status=200,data={ok:true};
  if(req.method()!=='GET')posts.push({path:p,key:req.headers()['idempotency-key'],body:req.postDataJSON()});
  if(p==='/api/auth/me'){status=guest?401:200;data=guest?{ok:false,error:'NOT_AUTHENTICATED'}:{ok:true,user:{id:'fixture-owner',email:'fixture@example.invalid',emailVerified:true,plan:'business'}};}
  else if(p.endsWith('/entitlements'))data={ok:true,plan:'business',displayName:'Business',status:'active',voice:{enabled:true,maxWords:null},features:{contentGeneration:true,share:true,businessIntegrations:true},usage:{projectsUsed:2,projectsLimit:null},expiresAt:null};
  else if(p==='/api/social/connections')data={ok:true,connections:['instagram','facebook','linkedin','x'].map(connection)};
  else if(p==='/api/projects')data={ok:true,projects:[project('selected'),project('second')]};
  else if(p==='/api/scheduler/packages'&&req.method()==='POST'){
   if(mode==='network'){await route.abort('failed');return;}
   if(mode==='delay')await new Promise(resolve=>{releaseSave=resolve;});
   if(mode==='disabled'){status=405;data={ok:false,error:{code:'METHOD_NOT_ALLOWED'}};}
   else if(mode==='conflict'){status=409;data={ok:false,error:{code:'SCHEDULER_REQUEST_CONFLICT'}};}
   else{saved=stored(req.postDataJSON());const replayed=mode==='replay';status=replayed?200:201;data={ok:true,packageId:saved.id,status:'draft',replayed,cannotDispatch:true};}
  }
  else if(p==='/api/scheduler/packages')data={ok:true,packages:saved?[saved]:[],nextCursor:null,cannotDispatch:true};
  else {const match=p.match(/^\/api\/projects\/([^/]+)(.*)$/);if(match){const [,id,tail]=match;
   if(tail==='')data={ok:true,project:project(id)};
   else if(tail==='/content')data={ok:true,content:{socialMedia:id+' Instagram text',googleBusiness:id+' Facebook text',websiteReference:id+' Website text'}};
   else if(tail==='/media')data={ok:true,media:{original:{id:id+'-original',mimeType:'image/webp'},optimized:{id:id+'-optimized',mimeType:'image/webp'}},photoOptimization:{state:'completed'}};
   else if(tail.startsWith('/media/')){await route.fulfill({contentType:'image/webp',body:image});return;}
  }}
  try{await route.fulfill({status,json:data});}catch(e){if(mode!=='delay')throw e;}
 });
 const form=()=>page.getByRole('region',{name:'Planer-Entwurf',exact:true});
 async function open(id='selected'){await page.goto(origin+'/app/projects/'+id+'/publish');await page.getByRole('button',{name:'Entwurf im Planer vorbereiten',exact:true}).click();await form().getByText('Fixture instagram',{exact:true}).waitFor();}
 async function choose(){await form().getByRole('checkbox',{name:'Instagram für Entwurf auswählen',exact:true}).check();await form().getByLabel('Gemeinsame Zeit',{exact:true}).fill('2027-01-15T12:00');}
 await open();console.log('CHECK catalogue');assert.equal(posts.length,0);assert.equal(await form().getByRole('checkbox').count(),9);
 for(const name of ['Pinterest','WhatsApp','X','LinkedIn','E-Mail','Google Business','Website / Blog'])assert.equal(await form().getByRole('checkbox',{name:name+' für Entwurf auswählen',exact:true}).isDisabled(),true);
 await choose();await form().getByRole('checkbox',{name:'Facebook für Entwurf auswählen',exact:true}).check();
 await form().getByLabel('Text für Instagram (Entwurf)',{exact:true}).fill('Edited IG fixture');
 assert.equal(await form().getByLabel('Text für Facebook (Entwurf)',{exact:true}).inputValue(),'selected Facebook text');
 await form().getByLabel('Eigene Zeit für Facebook',{exact:true}).check();await form().getByLabel('Facebook Zeit',{exact:true}).fill('2027-01-16T16:30');
 assert.match(await form().locator('img').first().getAttribute('src'),/selected\/media\/selected-optimized$/);
 await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 mode='delay';await form().getByRole('button',{name:'Entwurf speichern',exact:true}).click();await form().getByText('Entwurf wird gespeichert …',{exact:true}).waitFor();
 assert.equal(posts.length,1);assert.equal(await form().getByLabel('Text für Instagram (Entwurf)',{exact:true}).isDisabled(),true);
 const one=posts[0];assert.equal(one.path,'/api/scheduler/packages');assert.equal(one.body.mediaId,'selected-optimized');assert.equal(one.body.commonTime.utcOffset,'+01:00');assert.equal(one.body.targets[0].caption,'Edited IG fixture');assert.equal(one.body.targets[1].caption,'selected Facebook text');assert.equal(one.body.targets[1].timeOverride.localDateTime,'2027-01-16T16:30');
 for(const forbidden of ['storageKey','destinationId','ownerId','friseur','/api/projects'])assert.ok(!JSON.stringify(one.body).includes(forbidden));
 for(let i=0;i<50&&!releaseSave;i++)await page.waitForTimeout(20);assert.ok(releaseSave);releaseSave();await form().getByText('Entwurf im Planer gespeichert.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.nativeShares),0);
 await form().getByRole('link',{name:'Entwürfe im Planer ansehen',exact:true}).click();await page.waitForURL('**/app/planner?projectId=selected');await page.waitForFunction(()=>document.querySelectorAll('.planner-event').length===2);
 assert.equal(posts.length,1);
 console.log('CHECK save/calendar');
 // Unknown outcome freezes inputs and reuses EXACT body/key on retry.
 mode='network';await open();await choose();await form().getByRole('button',{name:'Entwurf speichern',exact:true}).click();await form().getByRole('button',{name:'Denselben Speicherversuch prüfen',exact:true}).waitFor();
 assert.equal(await form().getByLabel('Gemeinsame Zeit',{exact:true}).isDisabled(),true);assert.equal(await form().getByRole('button',{name:'Entwurf bearbeiten',exact:true}).count(),0);
 const uncertain=posts.at(-1);mode='replay';await form().getByRole('button',{name:'Denselben Speicherversuch prüfen',exact:true}).click();await form().getByText('Der bereits gespeicherte Entwurf wurde bestätigt.',{exact:true}).waitFor();assert.deepEqual(posts.at(-1),uncertain);
 console.log('CHECK uncertain retry');
 // Definitive disabled response allows editing, without claiming a saved entry.
 mode='disabled';await open();await choose();await form().getByRole('button',{name:'Entwurf speichern',exact:true}).click();await form().getByText('Das Speichern von Planer-Entwürfen ist noch nicht freigeschaltet.',{exact:true}).waitFor();
 const disabledKey=posts.at(-1).key;await form().getByRole('button',{name:'Entwurf bearbeiten',exact:true}).click();await form().getByLabel('Text für Instagram (Entwurf)',{exact:true}).fill('Edited after rejection');
 mode='success';await form().getByRole('button',{name:'Entwurf speichern',exact:true}).click();await form().getByText('Entwurf im Planer gespeichert.',{exact:true}).waitFor();assert.notEqual(posts.at(-1).key,disabledKey);
 console.log('CHECK disabled/edit');
 // Conflicts lock original request, no overwrite/new-key shortcut.
 mode='conflict';await open();await choose();await form().getByRole('button',{name:'Entwurf speichern',exact:true}).click();await form().getByText('Zu diesem Versuch ist bereits ein anderer Entwurf gespeichert.',{exact:false}).waitFor();assert.equal(await form().getByRole('button',{name:'Entwurf bearbeiten',exact:true}).count(),0);
 console.log('CHECK conflict');
 // DST gap/fold and past time must not POST; ambiguous choice is explicit.
 mode='success';await open();await choose();const before=posts.length;
 await form().getByLabel('Gemeinsame Zeit',{exact:true}).fill('2027-03-28T02:30');await form().getByRole('button',{name:'Entwurf speichern',exact:true}).click();assert.equal(posts.length,before);
 await form().getByLabel('Gemeinsame Zeit',{exact:true}).fill('2027-01-13T12:00');await form().getByRole('button',{name:'Entwurf speichern',exact:true}).click();await form().getByText('Bitte wähle einen Zeitpunkt in der Zukunft.',{exact:true}).waitFor();assert.equal(posts.length,before);
 await form().getByLabel('Gemeinsame Zeit',{exact:true}).fill('2027-10-31T02:30');await form().getByRole('button',{name:'Entwurf speichern',exact:true}).click();assert.equal(posts.length,before);
 await form().getByLabel('UTC-Versatz – Gemeinsame Zeit',{exact:true}).selectOption('+02:00');await form().getByRole('button',{name:'Entwurf speichern',exact:true}).click();await form().getByText('Entwurf im Planer gespeichert.',{exact:true}).waitFor();assert.equal(posts.at(-1).body.commonTime.utcOffset,'+02:00');
 console.log('CHECK DST');
 // Project switch disposes old attempt/form. Own material/text must be reseeded.
 await open('second');await choose();assert.equal(await form().getByLabel('Text für Instagram (Entwurf)',{exact:true}).inputValue(),'second Instagram text');assert.match(await form().locator('img').first().getAttribute('src'),/second\/media\/second-optimized$/);
 assert.equal(await form().getByText('Entwurf im Planer gespeichert.',{exact:true}).count(),0);
 fs.mkdirSync('artifacts/planner-draft',{recursive:true});await form().screenshot({path:'artifacts/planner-draft/mobile-320.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // No connections: selection disabled. Incomplete project/guest: no form.
 connected=false;await page.reload();await page.getByRole('button',{name:'Entwurf im Planer vorbereiten',exact:true}).click();await form().getByText('Verbundenes Konto erforderlich',{exact:true}).first().waitFor();assert.equal(await form().getByRole('checkbox',{name:'Instagram für Entwurf auswählen',exact:true}).isDisabled(),true);
 projectStatus='processing';await page.reload();await page.getByRole('heading',{name:'Dein Projekt wird noch verarbeitet',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Entwurf im Planer vorbereiten',exact:true}).count(),0);
 guest=true;await page.reload();await page.waitForTimeout(150);assert.equal(await page.getByRole('button',{name:'Entwurf im Planer vorbereiten',exact:true}).count(),0);
 assert.ok(posts.every(p=>p.path==='/api/scheduler/packages'));assert.deepEqual(errors,[]);
 console.log('PASS draft form: own media/text, 9-channel catalogue, per-target time, mobile 320, acknowledged save/calendar, frozen retry/key, disabled/conflict, DST/past, project isolation, disconnected/processing/guest; no native share/provider calls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
