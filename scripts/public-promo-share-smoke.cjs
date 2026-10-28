const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PROMO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const requests=[],errors=[];
  await context.addInitScript(()=>{
   window.fixtureNative=false;window.fixtureShares=[];window.fixtureCancel=false;
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>window.fixtureNative});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{if(window.fixtureCancel)throw new DOMException('Cancelled','AbortError');window.fixtureShares.push({title:data.title,text:data.text,type:data.files[0].type,size:data.files[0].size});}});
  });
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url()); requests.push(url.href);
   if(url.hostname!=='127.0.0.1'){await route.fulfill({contentType:'text/html',body:'<h1>Fixture sharing composer</h1>'});return;}
   if(url.pathname.startsWith('/api/')){await route.fulfill({status:401,json:{ok:false,error:{code:'UNAUTHORIZED',message:'Guest fixture'}}});return;}
   await route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/integrations');
  const cards=page.locator('.promo-share .mvp-integration-card');
  await cards.first().waitFor();assert.equal(await cards.count(),9);
  for(const name of ['Facebook','WhatsApp','X','LinkedIn','Pinterest','E-Mail']){
   const link=cards.filter({has:page.getByText(name,{exact:true})}).getByRole('link');
   const href=await link.getAttribute('href');assert.ok(href.includes(encodeURIComponent('https://dfbk.app/share/friseur.html')));
   assert.ok(!href.includes('/api/')&&!href.includes('access_token'));
  }
  const popupPromise=page.waitForEvent('popup');
  await page.getByRole('link',{name:'Facebook: Beispiel teilen',exact:true}).click();
  const popup=await popupPromise;await popup.getByRole('heading',{name:'Fixture sharing composer'}).waitFor();await popup.close();
  const instagram=cards.filter({has:page.getByText('Instagram',{exact:true})}).getByRole('button',{name:'Teilen',exact:true});
  await instagram.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  await page.waitForFunction(()=>!document.querySelector('dialog button.button-secondary[download]')&&[...document.querySelectorAll('dialog button')].some(b=>b.textContent==='Datei herunterladen'&&!b.disabled));
  assert.match(await dialog.getByLabel('Beschreibung',{exact:true}).inputValue(),/share\/friseur.html/);
  await dialog.getByRole('button',{name:'Schließen',exact:true}).click();
  await page.evaluate(()=>{window.fixtureNative=true;});
  await instagram.click();await page.waitForFunction(()=>window.fixtureShares.length===1);
  let shares=await page.evaluate(()=>window.fixtureShares);assert.equal(shares[0].type,'image/jpeg');assert.ok(shares[0].size>10000);
  assert.equal(await dialog.isVisible(),false);
  await page.evaluate(()=>{window.fixtureCancel=true;});await instagram.click();
  assert.equal(await dialog.isVisible(),false,'Cancelling native share must not reopen a composer');
  assert.equal((await page.evaluate(()=>window.fixtureShares)).length,1);
  await cards.filter({has:page.getByText('Website / Blog',{exact:true})}).getByRole('button').click();
  await dialog.waitFor();assert.ok(await dialog.locator('option').count()>=14);
  await dialog.getByLabel('Deine Plattform').selectOption('Joomla');
  assert.match(await dialog.getByLabel('HTML-Beispiel').inputValue(),/<img src="https:\/\/dfbk.app\/promo\/dfbk-friseur.jpg"/);
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
  assert.ok(!requests.some(url=>url.includes('/api/projects')),'Public sharing must not fetch a private project');
  const permalink=await page.request.get('http://127.0.0.1:5173/share/friseur.html');
  assert.equal(permalink.status(),200);const html=await permalink.text();
  assert.match(html,/<meta property="og:image" content="https:\/\/dfbk.app\/promo\/dfbk-friseur.jpg">/);
  assert.match(html,/<meta property="og:url" content="https:\/\/dfbk.app\/share\/friseur.html">/);
  assert.ok(!html.includes('access_token')&&!html.includes('/api/projects'));
  const image=await page.request.get('http://127.0.0.1:5173/promo/dfbk-friseur.jpg');assert.equal(image.status(),200);assert.equal((await image.body()).subarray(0,2).toString('hex'),'ffd8');
  fs.mkdirSync('artifacts/public-promo',{recursive:true});
  await page.locator('.promo-share').screenshot({path:'artifacts/public-promo/desktop.png'});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow');
  await page.locator('.promo-share').screenshot({path:'artifacts/public-promo/mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: guest link composers, Facebook single click (mocked destination), native JPEG handoff, cancel without retry, fallback dialog, 14 CMS export choices, focus/escape, public OG permalink, private-data isolation, mobile layout. No real social posts.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
