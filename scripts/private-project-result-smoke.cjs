const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.PROMO_ORIGIN || 'http://127.0.0.1:5173';
const imageFixture = require('node:fs').readFileSync('public/visual/integrations/friseur-optimized.webp');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.PROMO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
 try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  let status='ready', optimization='completed', hasOptimized=true, hasOriginal=true, hasContent=true, forbidden=false, loggedIn=true, delayed=false;
  let releaseSlow, posts=[];
  const project = id=>({id,title:id==='second'?'Zweites Projekt':'Mein ausgewähltes Projekt',titleSource:'manual',description:'Eigene Arbeit',status,createdAt:'2026-10-28',updatedAt:'2026-10-28',media:hasOriginal?{id:id+'-original',mimeType:'image/png'}:null,photoOptimization:{state:optimization}});
  const content = id=>({googleBusiness:id+' Facebook-Text',socialMedia:id+' Instagram-Text',websiteReference:id+' Website-Text'});
  await page.route('**/api/**',async route=>{
   const req=route.request(), url=new URL(req.url()), path=url.pathname;
   if(req.method()!=='GET')posts.push({path,method:req.method()});
   let data={ok:true},code=200;
   if(path==='/api/auth/me'){code=loggedIn?200:401;data=loggedIn?{ok:true,user:{id:'fixture-owner',email:'fixture@example.invalid',emailVerified:true,plan:'business'}}:{ok:false,error:{code:'UNAUTHORIZED',message:'Fixture'}};}
   else if(path.endsWith('/entitlements'))data={ok:true,plan:'business',displayName:'Business',status:'active',voice:{enabled:true,maxWords:null},features:{contentGeneration:true,share:true,businessIntegrations:true},usage:{projectsUsed:1,projectsLimit:null},expiresAt:null};
   else if(path==='/api/social/connections')data={ok:true,connections:[]};
   else if(path==='/api/projects')data=req.method()==='POST'?{ok:true,project:project('created')}:{ok:true,projects:[project('selected'),project('second')]};
   else {
    const match=path.match(/^\/api\/projects\/([^/]+)(.*)$/);
    if(match){
     const [,id,tail]=match;
     if(forbidden){code=404;data={ok:false,error:{code:'PROJECT_NOT_FOUND',message:'Unavailable'}};}
     else if(tail===''){
      if(id==='slow' && delayed)await new Promise(resolve=>{releaseSlow=resolve;});
      data={ok:true,project:project(id)};
     } else if(tail==='/content')data={ok:true,content:hasContent?content(id):null};
     else if(tail==='/generate')data={ok:true,project:project(id),content:content(id)};
     else if(tail==='/media' && req.method()==='POST')data={ok:true,media:{id:id+'-original',projectId:id,mimeType:'image/png'}};
     else if(tail==='/media')data={ok:true,media:{original:hasOriginal?{id:id+'-original',mimeType:'image/png'}:null,optimized:hasOptimized?{id:id+'-optimized',mimeType:'image/png'}:null},photoOptimization:{state:optimization}};
     else if(tail.startsWith('/media/')){await route.fulfill({contentType:'image/webp',body:imageFixture});return;}
    }
   }
   await route.fulfill({status:code,json:data});
  });
  const open = async id => {await page.goto(origin+'/app/projects/'+id+'/publish');};
  const choose = async name => {await page.locator('.mvp-integration-card').filter({hasText:name}).getByRole('button').click();};
  await open('selected');
  await page.locator('.project-result__images img').first().waitFor();
  assert.equal(await page.locator('.project-result__images img').count(),2);
  await choose('Instagram');
  assert.equal(await page.locator('textarea').inputValue(),'selected Instagram-Text');
  assert.match(await page.locator('.publishing-preview img').getAttribute('src'),/selected\/media\/selected-optimized$/);
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Datei herunterladen'&&!b.disabled));
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Datei herunterladen'}).click()]);
  assert.equal(download.suggestedFilename(),'dfbk-projektbild.jpg');
  await page.reload();
  await page.locator('.project-result__images img').first().waitFor();
  assert.equal(posts.length,0,'Opening, preparing, downloading and reloading must not mutate or regenerate');

  optimization='processing';
  await open('selected');
  await page.getByRole('heading',{name:'Dein Projekt wird noch verarbeitet'}).waitFor();
  assert.equal(await page.locator('.mvp-integration-card').count(),0);
  optimization='completed';
  await page.getByRole('button',{name:'Materialstatus erneut laden'}).click();
  await page.locator('.mvp-integration-card').first().waitFor();
  status='failed';
  await open('selected');await page.getByRole('heading',{name:'Die Verarbeitung wurde nicht abgeschlossen'}).waitFor();
  assert.equal(await page.locator('.mvp-integration-card').count(),0);
  status='ready';hasContent=false;
  await open('selected');await page.getByRole('heading',{name:'Deine Texte sind noch nicht vollständig verfügbar'}).waitFor();
  hasContent=true;hasOptimized=false;optimization='available';
  await open('selected');await page.getByRole('heading',{name:'Das optimierte Foto ist noch nicht verfügbar'}).waitFor();
  assert.equal(await page.locator('.mvp-integration-card').count(),0);
  await page.getByRole('button',{name:'Mit dem Originalfoto fortfahren'}).click();
  await choose('Facebook');
  assert.equal(await page.locator('textarea').inputValue(),'selected Facebook-Text');
  assert.match(await page.locator('.publishing-preview img').getAttribute('src'),/selected\/media\/selected-original$/);
  hasOriginal=false;
  await open('selected');await page.getByRole('heading',{name:'Das Projektbild ist nicht verfügbar'}).waitFor();
  assert.equal(await page.locator('.mvp-integration-card').count(),0);
  hasOriginal=true;hasOptimized=true;optimization='completed';
  assert.equal(posts.length,0,'Read-only recovery and explicit original selection must not trigger POST');

  await open('selected');await page.locator('.mvp-integration-card').first().waitFor();
  delayed=true;
  await page.evaluate(async()=>{history.pushState({},'', '/app/projects/slow/publish');dispatchEvent(new PopStateEvent('popstate'));});
  await page.getByText('Projekt wird geladen …',{exact:true}).waitFor();
  assert.equal(await page.locator('.project-result__images img').count(),0,'Previous project hidden during next read');
  await page.waitForTimeout(100);
  await page.evaluate(async()=>{history.pushState({},'', '/app/projects/second/publish');dispatchEvent(new PopStateEvent('popstate'));});
  await page.getByRole('heading',{name:'Zweites Projekt',exact:true}).waitFor();
  assert.ok(releaseSlow,'Slow request intercepted');releaseSlow();
  await page.waitForTimeout(200);
  await choose('Instagram');
  assert.equal(await page.locator('textarea').inputValue(),'second Instagram-Text');
  assert.match(await page.locator('.publishing-preview img').getAttribute('src'),/second\/media\/second-optimized$/);
  assert.equal(await page.locator('img[src*="/selected/"],img[src*="/slow/"]').count(),0);

  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(()=>{document.querySelector('.project-result h1').textContent='Ausführliche Projektbeschreibung für Gebäudereinigung und Handwerksdienstleistungen';});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow at '+width);
  }
  await fs.mkdir('artifacts/private-result',{recursive:true});
  await page.screenshot({path:'artifacts/private-result/mobile-320.png',fullPage:true});
  forbidden=true;await open('foreign');await page.getByRole('heading',{name:'Projekt nicht verfügbar'}).waitFor();
  assert.equal(await page.locator('.project-result__images img, .mvp-integration-card').count(),0);
  forbidden=false;loggedIn=false;
  await open('selected');await page.getByRole('heading',{name:/Anmelden|Willkommen/}).first().waitFor();
  assert.equal(await page.locator('.project-result__images img, .mvp-integration-card').count(),0);

  loggedIn=true;posts=[];
  await page.goto(origin+'/app/new');
  await page.locator('input[type=file]').last().setInputFiles({name:'fixture.webp',mimeType:'image/webp',buffer:imageFixture});
  await page.getByRole('button',{name:'Ausschnitt übernehmen'}).click();
  await page.getByRole('button',{name:'Weiter',exact:true}).click();
  await page.getByRole('button',{name:'Ohne Zusatzinfo weiter'}).click();
  await page.waitForURL('**/app/projects/created/publish');
  await page.locator('.mvp-integration-card').first().waitFor();
  assert.deepEqual(posts.map(p=>p.path),['/api/projects','/api/projects/created/media','/api/projects/created/generate']);
  await page.reload();await page.locator('.mvp-integration-card').first().waitFor();
  assert.equal(posts.length,3,'Result reload must not repeat creation, upload or generation');
  await page.getByRole('link',{name:'← Projektdetails'}).click();
  await page.getByRole('link',{name:'Materialien verwenden'}).click();
  await page.waitForURL('**/app/projects/created/publish');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: own images/captions, JPEG download, read-only status recovery, processing/failed/missing states, explicit original, cross-project loading race, guest/foreign denial, 390/320px, creation -> exact result route and no duplicate POST on reload.');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
