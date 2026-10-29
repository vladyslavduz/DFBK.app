const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.PROMO_ORIGIN || 'http://127.0.0.1:5174';
(async () => {
 console.log('Smoke: launching browser');
 const browser = await chromium.launch({executablePath:process.env.PROMO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(15000);
  console.log('Smoke: browser ready');
  let mode='unavailable', mutations=[];
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const project=id=>({id,title:id==='selected'?'Gewähltes Projekt':'Neuestes Projekt',status:'ready',createdAt:'2026-10-29',updatedAt:'2026-10-29'});
  const connection=id=>({provider:id,availability:mode==='unavailable'?'not_configured':(id==='instagram'||id==='facebook')?'available':'in_preparation',connected:mode==='connected'&&id==='facebook',connectionId:null,accountId:null,accountName:mode==='connected'&&id==='facebook'?'Fixture Page':null,status:mode==='reconnect'&&id==='instagram'?'reconnect_required':mode==='connected'&&id==='facebook'?'connected':'not_connected',accounts:mode==='candidates'&&id==='instagram'?[{connectionId:'candidate',accountId:'account',accountName:'Fixture Instagram',status:'pending',connected:false,expiresAt:null}]:[]});
  await page.route('**/api/**',async route=>{
   const req=route.request(), path=new URL(req.url()).pathname;
   if(req.method()!=='GET')mutations.push({path,body:req.postData()});
   let data={ok:true},status=200;
   if(path==='/api/auth/me')data={ok:true,user:{id:'fixture-owner',email:'fixture@example.invalid',emailVerified:true,plan:'business'}};
   else if(path.endsWith('/entitlements'))data={ok:true,plan:'business',displayName:'Business',status:'active',voice:{enabled:true,maxWords:null},features:{contentGeneration:true,share:true,businessIntegrations:true},usage:{projectsUsed:2,projectsLimit:null},expiresAt:null};
   else if(path==='/api/projects')data={ok:true,projects:[project('latest'),project('selected')]};
   else if(path==='/api/social/connections'&&mode==='unavailable'){status=503;data={ok:false,error:{code:'SOCIAL_NOT_CONFIGURED',message:'Fixture'}};}
   else if(path.startsWith('/api/social/'))data={ok:true,connections:['instagram','facebook','linkedin','x'].map(connection)};
   else if(path==='/api/projects/selected')data={ok:true,project:project('selected')};
   else if(path==='/api/projects/selected/content')data={ok:true,content:{googleBusiness:'Selected FB',socialMedia:'Selected IG',websiteReference:'Selected website'}};
   else if(path==='/api/projects/selected/media')data={ok:true,media:{original:null,optimized:null},photoOptimization:{state:'available'}};
   await route.fulfill({status,json:data});
  });
  const open=()=>page.goto(origin+'/app/integrations');
  console.log('Smoke: opening catalogue');
  await open();console.log('Smoke: page loaded');await page.locator('[data-channel="website"]').waitFor();
  const ids=['instagram','facebook','pinterest','whatsapp','x','linkedin','email','google_business','website'];
  assert.deepEqual(await page.locator('[data-channel]').evaluateAll(nodes=>nodes.map(n=>n.dataset.channel)),ids);
  assert.equal(await page.locator('#integration-project').inputValue(),'');
  assert.equal(await page.getByText('Verbunden',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Verbinden',exact:true}).count(),0);
  for(const id of ids){
   await page.locator(`[data-channel="${id}"]`).getByRole('button',{name:'Projekt für Materialien wählen'}).click();
   assert.equal(await page.evaluate(()=>document.activeElement.id),'integration-project');
  }
  await page.getByLabel('Website-Plattform').selectOption('IONOS');
  await page.getByText('Für IONOS:',{exact:false}).waitFor();
  assert.equal(await page.getByLabel('Website-Plattform').locator('option').count(),14);
  for(const id of ids.filter(id=>!['instagram','facebook'].includes(id))){
   const card=page.locator(`[data-channel="${id}"]`);
   await card.getByRole('button',{name:'Automatisierung: Voraussetzungen'}).click();
   await card.getByText('Für '+(id==='website'?'Website / Blog':id==='google_business'?'Google Business':id==='email'?'E-Mail':id==='x'?'X':id==='linkedin'?'LinkedIn':id==='whatsapp'?'WhatsApp':'Pinterest')+' ist hier kein automatischer Versand freigeschaltet.',{exact:false}).waitFor();
  }
  assert.equal(mutations.length,0);
  console.log('Smoke: cards/CMS/prerequisites passed');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+width);
  }
  await fs.mkdir('artifacts/channels-ui-02',{recursive:true});
  await page.screenshot({path:'artifacts/channels-ui-02/mobile-320.png',fullPage:true});
  await page.locator('#integration-project').selectOption('selected');
  await page.locator('[data-channel="pinterest"]').getByRole('button',{name:'Projektmaterialien öffnen'}).click();
  await page.waitForURL('**/app/projects/selected/publish');
  assert.equal(mutations.length,0,'Preparing exact project must not publish or generate');
  console.log('Smoke: exact project passed');
  mode='reconnect';await open();await page.getByRole('button',{name:'Erneut verbinden'}).waitFor();
  mode='connected';await open();await page.getByText('Fixture Page',{exact:true}).waitFor();
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/social/facebook/disconnect'),page.getByRole('button',{name:'Verbindung trennen'}).click()]);
  assert.equal(mutations.at(-1).path,'/api/social/facebook/disconnect');
  await page.evaluate(()=>sessionStorage.setItem('dfbk.social.v1.fixture-owner.draft',JSON.stringify({projectId:'selected',caption:'Draft',providers:['instagram'],mediaId:null,useOptimizedImage:true})));
  mode='candidates';await page.goto(origin+'/app/integrations?social=select_account&provider=instagram');
  await page.getByRole('button',{name:'Fixture Instagram Auswählen'}).click();
  await page.waitForURL('**/app/projects/selected/publish');
  assert.deepEqual(mutations.map(m=>m.path),['/api/social/facebook/disconnect','/api/social/instagram/select']);
  assert.equal(JSON.parse(mutations[1].body).connectionId,'candidate');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: 9 catalogue cards, unavailable/manual actions, explicit exact project, 14 CMS, prerequisite panels, 390/320px, reconnect control, disconnect, Meta account selection/resume, no publish/generation/schedule requests.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
