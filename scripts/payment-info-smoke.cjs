const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PROMO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
const page=await browser.newPage();let checkout=[],guest=true,contactReady=false,contactPayload;await page.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;if(/billing|checkout|stripe|paddle/i.test(path))checkout.push(path);let data={ok:true},status=200;
if(path==='/api/auth/me'){status=guest?401:200;data=guest?{ok:false,error:{code:'UNAUTHORIZED'}}:{ok:true,user:{id:'fixture',email:'fixture@example.invalid',emailVerified:true,plan:'trial'}};}
else if(path.endsWith('/entitlements'))data={ok:true,plan:'trial',displayName:'Testzugang',status:'active',voice:{enabled:true,maxWords:10},features:{contentGeneration:true,share:true,businessIntegrations:false},usage:{projectsUsed:5,projectsLimit:5},expiresAt:null};
else if(path==='/api/business-contact'){if(req.method()==='POST')contactPayload=req.postDataJSON();else data={siteKey:contactReady?'fixture-key':null};}
else if(path==='/api/projects')data={ok:true,projects:[]};else if(path==='/api/social/connections')data={ok:true,connections:[]};await route.fulfill({status,json:data});});
const origin=process.env.PROMO_ORIGIN||'http://127.0.0.1:4187';
async function check(){const trigger=page.getByRole('button',{name:'Informationen zum Business-Tarif',exact:true});await trigger.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog',{name:'DFBK.app befindet sich in Entwicklung'});await dialog.waitFor();assert.match(await dialog.textContent(),/Zahlungen sind derzeit nicht möglich\./);assert.equal(await dialog.getByRole('link',{name:'dfbk.app@gmail.com',exact:true}).getAttribute('href'),'mailto:dfbk.app@gmail.com');assert.equal(await dialog.getByRole('link',{name:'Impressum und Kontakt',exact:true}).getAttribute('href'),'/impressum');await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('dialog[open]').contains(document.activeElement)),'Focus stays in dialog');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);await trigger.press('Space');await dialog.waitFor();await dialog.getByRole('button',{name:'Schließen'}).click();await dialog.waitFor({state:'hidden'});}
await page.goto(origin+'/pricing',{waitUntil:'domcontentloaded'});await check();assert.equal(await page.getByRole('link',{name:'Kostenlos ausprobieren',exact:true}).getAttribute('href'),'/register');await page.getByRole('link',{name:'Kostenlos ausprobieren',exact:true}).click();await page.waitForURL('**/register');
guest=false;await page.goto(origin+'/app/billing',{waitUntil:'domcontentloaded'});await check();contactReady=true;
await page.route('https://challenges.cloudflare.com/turnstile/**', route => route.fulfill({
 contentType:'application/javascript',
 body:"window.turnstile={render(el, options){options.callback('test-token');return 'mock-widget';},remove(){},reset(){}};",
}));
await page.getByRole('button',{name:'Informationen zum Business-Tarif',exact:true}).click();
const formDialog=page.getByRole('dialog',{name:'DFBK.app befindet sich in Entwicklung'});
await formDialog.getByLabel('Deine E-Mail-Adresse').fill('visitor@example.invalid');
await formDialog.getByLabel('Deine Nachricht').fill('Ich interessiere mich für Business.');
assert.equal(await formDialog.getByRole('link',{name:'Datenschutzhinweise'}).getAttribute('href'),'/datenschutz');
await formDialog.getByRole('button',{name:'Anfrage senden'}).click();
await formDialog.getByText('Deine Anfrage wurde gesendet.',{exact:true}).waitFor();
assert.deepEqual(contactPayload,{email:'visitor@example.invalid',message:'Ich interessiere mich für Business.',token:'test-token'});
assert.deepEqual(checkout,[]);console.log('PASS: public and cabinet CTA, keyboard open/Tab/Escape/close/focus return, exact payment notice/contact link, Trial registration retained and no checkout requests.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
