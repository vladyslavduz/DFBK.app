const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PROMO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const requests=[],errors=[];
  await context.addInitScript(()=>{
   window.fixtureNative=true;window.fixtureShares=[];window.fixtureCancel=false;
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.fixtureCopied=text;}}});
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
  assert.equal((await page.evaluate(()=>window.fixtureShares)).length,0,'Instagram card must not launch the OS share picker even when supported');
  await page.waitForFunction(()=>!document.querySelector('dialog button.button-secondary[download]')&&[...document.querySelectorAll('dialog button')].some(b=>b.textContent==='Datei herunterladen'&&!b.disabled));
  assert.match(await dialog.getByLabel('Beschreibung',{exact:true}).inputValue(),/share\/friseur.html/);
  const fileDownload=page.waitForEvent('download');
  await dialog.getByRole('button',{name:'Datei herunterladen',exact:true}).click();
  assert.equal((await fileDownload).suggestedFilename(),'dfbk-friseur.jpg');
  await dialog.getByRole('button',{name:'Text kopieren',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.fixtureCopied),await dialog.getByLabel('Beschreibung',{exact:true}).inputValue());
  const instagramPopup=page.waitForEvent('popup');await dialog.getByRole('link',{name:'Instagram öffnen',exact:true}).click();
  const instagramWindow=await instagramPopup;await instagramWindow.getByRole('heading',{name:'Fixture sharing composer'}).waitFor();assert.ok(instagramWindow.url().startsWith('https://www.instagram.com/'));await instagramWindow.close();
  await dialog.getByRole('button',{name:'System-Teilen (optional)',exact:true}).click();await page.waitForFunction(()=>window.fixtureShares.length===1);
  let shares=await page.evaluate(()=>window.fixtureShares);assert.equal(shares[0].type,'image/jpeg');assert.ok(shares[0].size>10000);
  assert.equal(await dialog.isVisible(),true);
  await page.evaluate(()=>{window.fixtureCancel=true;});await dialog.getByRole('button',{name:'System-Teilen (optional)',exact:true}).click();
  assert.equal(await dialog.isVisible(),true,'Cancelling optional native sharing must preserve the Instagram dialog');
  assert.equal((await page.evaluate(()=>window.fixtureShares)).length,1);
  await dialog.getByRole('button',{name:'Schließen',exact:true}).click();
  await cards.filter({has:page.getByText('Website / Blog',{exact:true})}).getByRole('button').click();
  await dialog.waitFor();await page.waitForFunction(()=>document.querySelector('dialog').scrollTop===0);assert.ok(await dialog.locator('option').count()>=14);
  await dialog.getByLabel('Deine Plattform').selectOption('Joomla');
  assert.equal(await dialog.getByRole('button',{name:'System-Teilen (optional)',exact:true}).count(),0,'Website must not offer the OS sharing picker');
  assert.equal(await dialog.getByLabel('HTML-Beispiel').isVisible(),false,'HTML should be collapsed by default');
  assert.ok(await dialog.locator('h2').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)<=28),'Dialog heading must not inherit the large landing-page size');
  fs.mkdirSync('artifacts/public-promo',{recursive:true});await dialog.evaluate(el=>{el.scrollTop=0;});const downloadBounds=await dialog.getByRole('button',{name:'Datei herunterladen',exact:true}).boundingBox();const initialBounds=await dialog.boundingBox();assert.ok(downloadBounds.y>=initialBounds.y&&downloadBounds.y+downloadBounds.height<=initialBounds.y+initialBounds.height,'Download action remains visible at the initial dialog position');await dialog.screenshot({path:'artifacts/public-promo/website-dialog-default.png'});
  await dialog.getByText('HTML-Code (optional)',{exact:true}).click();
  assert.match(await dialog.getByLabel('HTML-Beispiel').inputValue(),/<img src="https:\/\/dfbk.app\/promo\/dfbk-friseur.jpg"/);
  await dialog.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const closeBounds=await dialog.getByRole('button',{name:'Schließen',exact:true}).boundingBox();const dialogBounds=await dialog.boundingBox();assert.ok(closeBounds.y>=dialogBounds.y&&closeBounds.y+closeBounds.height<=dialogBounds.y+dialogBounds.height,'Close control remains visible while scrolling');
  fs.mkdirSync('artifacts/public-promo',{recursive:true});await dialog.screenshot({path:'artifacts/public-promo/website-dialog.png'});
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
  await cards.filter({has:page.getByText('Google Business',{exact:true})}).getByRole('button').click();await dialog.waitFor();assert.equal(await dialog.getByRole('button',{name:'System-Teilen (optional)',exact:true}).count(),0,'Google Business must not offer the OS sharing picker');await page.keyboard.press('Escape');
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
  console.log('PASS: guest link composers, Facebook single click (mocked destination), Instagram dialog without OS picker, JPEG download/copy/Instagram open, optional native sharing, cancel without retry, 14 CMS export choices without OS sharing, compact sticky dialog header, collapsed HTML, Google Business without OS sharing, focus/escape, public OG permalink, private-data isolation, mobile layout. No real social posts.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
