const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const origin=process.env.PROMO_ORIGIN || 'http://127.0.0.1:5173';
(async () => {
 const browser = await chromium.launch({executablePath:process.env.PROMO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(() => {
    window.fixtureShares=[]; window.fixtureVideoSupported=true;
    Object.defineProperty(navigator,'canShare',{configurable:true,value:({files}) => files?.length === 1 && (window.fixtureVideoSupported || files[0].type !== 'video/mp4')});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data => {window.fixtureShares.push({text:data.text,type:data.files[0].type,size:data.files[0].size});}});
  });
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  let loggedIn=false, posts=[], requested=[], publishState='unknown';
  const project={id:'selected',title:'Selected fixture project',titleSource:'manual',description:'Fixture',status:'ready',createdAt:'2026-10-27',updatedAt:'2026-10-27',media:{id:'original',mimeType:'image/webp'},photoOptimization:{state:'completed'}};
  await page.route('**/api/**',async route=>{
   const req=route.request(), url=new URL(req.url()); requested.push(url.pathname);
   let data={ok:true},status=200;
   if(url.pathname==='/api/auth/me'){ if(loggedIn)data={ok:true,user:{id:'fixture',email:'fixture@example.invalid',emailVerified:true,plan:'business'}};else {status=401;data={ok:false,error:{code:'UNAUTHORIZED',message:'Test guest'}};} }
   else if(url.pathname==='/api/social/connections')data={ok:true,connections:['instagram','facebook','linkedin','x'].map(provider=>({provider,availability:'available',connected:true,connectionId:provider,accountId:provider,accountName:'Fixture',status:'connected',accounts:[]}))};
   else if(url.pathname.endsWith('/entitlements'))data={ok:true,plan:'business',displayName:'Business',status:'active',voice:{enabled:true,maxWords:null},features:{contentGeneration:true,share:true,businessIntegrations:true},usage:{projectsUsed:1,projectsLimit:null},expiresAt:null};
   else if(url.pathname==='/api/projects')data={ok:true,projects:[project]};
   else if(url.pathname==='/api/projects/selected')data={ok:true,project};
   else if(url.pathname==='/api/projects/selected/media')data={ok:true,media:{original:{id:'original',mimeType:'image/webp'},optimized:{id:'optimized',mimeType:'image/webp'}},photoOptimization:{state:'completed'}};
   else if(url.pathname==='/api/projects/selected/content')data={ok:true,content:{googleBusiness:'Facebook fixture text',socialMedia:'Instagram fixture text',websiteReference:'Pinterest fixture text'}};
   else if(url.pathname==='/api/projects/selected/media/optimized'){await route.fulfill({response:await page.request.get(origin+'/visual/integrations/friseur-optimized.webp')});return;}
   else if(url.pathname==='/api/projects/selected/publish' && req.method()==='POST'){
    posts.push({body:req.postDataJSON(),key:req.headers()['idempotency-key']});
    if(publishState==='unknown'){await route.abort('failed');return;}
    data={ok:true,requestId:'fixture-request',results:[{jobId:'fixture-job',provider:posts.at(-1).body.providers[0],status:publishState,mediaId:'optimized',mediaSource:'optimized',externalPostId:'fixture-post',url:null,error:null,retryAllowed:publishState==='pending'}]};
   }
   await route.fulfill({status,json:data});
  });
  loggedIn=true;await page.goto(origin+'/app/projects/selected/publish');
  await page.getByRole('heading',{name:'Selected fixture project',exact:true}).waitFor();
  await page.locator('.mvp-integration-card').filter({hasText:'Instagram'}).getByRole('button').click();
  assert.equal(await page.locator('textarea').inputValue(),'Instagram fixture text');
  assert.match(await page.locator('.publishing-preview img').getAttribute('src'),/selected\/media\/optimized$/);
  page.on('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Auf verbundenem Konto veröffentlichen'}).click();
  await page.getByText('Gespeicherter Veröffentlichungsversuch:',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Auf verbundenem Konto veröffentlichen'}).click();
  assert.equal(posts.length,1,'Uncertain request must block a new POST');
  await page.reload();await page.getByRole('button',{name:'Gespeicherten Versuch prüfen'}).click();
  await page.waitForFunction(()=>document.querySelector('.inline-notice')?.textContent.includes('Status noch unklar'));
  assert.equal(posts.length,2);assert.deepEqual(posts[0],posts[1],'Recovery must preserve exact key and payload');
  assert.ok(posts[0].key,'An idempotency key must exist');
  assert.equal(posts[0].body.mediaId,'optimized');
  publishState='published';await page.getByRole('button',{name:'Gespeicherten Versuch prüfen'}).click();
  await page.getByRole('button',{name:'Weiteren Beitrag vorbereiten'}).click();
  await page.locator('.mvp-integration-card').filter({hasText:'Facebook'}).getByRole('button').click();
  assert.equal(await page.locator('textarea').inputValue(),'Facebook fixture text');
  await page.evaluate(()=>{window.fixtureSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.endsWith('.attempt'))throw Error('Fixture storage denied');return window.fixtureSetItem.call(this,key,value);};});
  await page.getByRole('button',{name:'Auf verbundenem Konto veröffentlichen'}).click();
  await page.getByText('Der Browser kann den Versuch nicht sicher speichern.',{exact:false}).waitFor();
  assert.equal(posts.length,3,'Storage failure must prevent network publication');
  await page.evaluate(()=>{Storage.prototype.setItem=window.fixtureSetItem;});
  await page.getByRole('button',{name:'Auf verbundenem Konto veröffentlichen'}).click();
  await page.getByRole('button',{name:'Weiteren Beitrag vorbereiten'}).waitFor();
  assert.equal(posts.length,4);assert.equal(posts[3].body.caption,'Facebook fixture text');assert.notEqual(posts[3].key,posts[0].key);
  await page.getByRole('button',{name:'Weiteren Beitrag vorbereiten'}).click();
  publishState='pending';
  await page.locator('.mvp-integration-card').filter({hasText:'Instagram'}).getByRole('button').click();
  await page.getByRole('button',{name:'Auf verbundenem Konto veröffentlichen'}).click();
  await page.getByRole('button',{name:'Denselben ausstehenden Versuch fortsetzen'}).waitFor();
  publishState='published';await page.getByRole('button',{name:'Denselben ausstehenden Versuch fortsetzen'}).click();
  await page.getByRole('button',{name:'Weiteren Beitrag vorbereiten'}).waitFor();
  assert.equal(posts.length,6);assert.deepEqual(posts[4],posts[5],'Pending continuation must reuse exact payload/key');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: exact private project/media/text, uncertain POST blocked, reload recovery preserves payload/key, terminal reset, separate Facebook text, storage failure blocks POST, pending resumes same request.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
