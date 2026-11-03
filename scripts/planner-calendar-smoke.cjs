const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const origin=process.env.PROMO_ORIGIN||'http://127.0.0.1:4184';
const image=fs.readFileSync('public/visual/integrations/friseur-optimized.webp');
const time=iso=>({scheduledAt:Date.parse(iso),timezone:'Europe/Berlin',utcOffset:'+01:00',localDateTime:'2027-03-15T12:00'});
const item=(id,channel,iso)=>({id,channel,targetKind:'account',timeSource:'common',time:time(iso),status:'draft'});
const pack=(id,projectId,items)=>({id,projectId,version:1,status:'draft',createdAt:1,commonTime:items[0].time,itemCount:items.length,earliestAt:Math.min(...items.map(i=>i.time.scheduledAt)),latestAt:Math.max(...items.map(i=>i.time.scheduledAt)),items});
const a=pack('a','first',[item('ai','instagram','2027-03-15T11:00:00Z'),{...item('af','facebook','2027-04-01T10:00:00Z'),timeSource:'override'}]),b=pack('b','second',[item('bi','instagram','2027-03-20T11:00:00Z')]),c=pack('c','second',[item('ci','instagram','2027-05-03T10:00:00Z')]);
(async()=>{const browser=await chromium.launch({executablePath:process.env.PROMO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
const page=await browser.newPage({viewport:{width:1280,height:900}});await page.addInitScript(()=>{Date.now=()=>Date.parse('2027-03-15T10:00:00Z');});
let disabled=false,guest=false,slowApril=false,releaseApril;const errors=[],mutations=[],ranges=[];page.on('pageerror',e=>errors.push(e.message));
const project=id=>({id,title:id==='first'?'Synthetic Friseurprojekt':'Synthetic zweites Projekt',status:'ready',createdAt:'2027-01-01',updatedAt:'2027-01-01'});
await page.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url()),p=url.pathname;if(request.method()!=='GET')mutations.push(p);let data={ok:true},status=200;
 if(p==='/api/auth/me'){status=guest?401:200;data=guest?{ok:false,error:'NOT_AUTHENTICATED'}:{ok:true,user:{id:'fixture-owner',email:'fixture@example.invalid',emailVerified:true,plan:'business'}};}
 else if(p.endsWith('/entitlements'))data={ok:true,plan:'business',displayName:'Business',status:'active',voice:{enabled:true,maxWords:null},features:{contentGeneration:true,share:true,businessIntegrations:true},usage:{projectsUsed:2,projectsLimit:null},expiresAt:null};
 else if(p==='/api/projects')data={ok:true,projects:[project('first'),project('second')]};
 else if(p==='/api/social/connections')data={ok:true,connections:[]};
 else if(p==='/api/scheduler/packages'){
  if(disabled){status=503;data={ok:false,error:{code:'SCHEDULER_DISABLED'}};}
  else{const from=Number(url.searchParams.get('from')),to=Number(url.searchParams.get('to'));ranges.push({from,to});let packages,nextCursor=null;
   if(from===Date.parse('2027-02-28T23:00:00Z')){packages=url.searchParams.get('projectId')==='second'||url.searchParams.has('cursorId')?[b]:[a];if(packages[0]===a)nextCursor={createdAt:1,id:'a'};}
   else if(from===Date.parse('2027-03-31T22:00:00Z')){if(slowApril)await new Promise(resolve=>{releaseApril=resolve;});packages=[a];}
   else packages=[c];data={ok:true,packages,nextCursor,cannotDispatch:true};}
 }
 else if(p.startsWith('/api/scheduler/packages/')){const raw=p.endsWith('/a')?a:p.endsWith('/b')?b:c;data={ok:true,cannotDispatch:true,package:{...raw,items:raw.items.map(i=>({...i,caption:'Synthetic caption '+i.channel,media:{id:'media',role:'optimized',mimeType:'image/webp'}}))}};}
 else if(p.endsWith('/media/media')){await route.fulfill({contentType:'image/webp',body:image});return;}
 try{await route.fulfill({status,json:data});}catch(e){if(!slowApril)throw e;}
});
await page.goto(origin+'/app/planner');await page.getByRole('heading',{name:'März 2027',exact:true}).waitFor();await page.locator('.planner-event').waitFor();assert.equal(await page.locator('.planner-event').count(),1);assert.ok(!(await page.locator('.planner-agenda').textContent()).includes('Facebook'),'April override must not appear in March');
assert.deepEqual(ranges[0],{from:Date.parse('2027-02-28T23:00:00Z'),to:Date.parse('2027-03-31T22:00:00Z')});
await page.getByRole('button',{name:'Weitere Entwürfe laden',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.planner-event').length===2);
await page.locator('[data-day="2027-03-15"]').click();assert.equal(await page.locator('.planner-event').count(),1);await page.locator('.planner-event').click();await page.getByText('Synthetic caption instagram',{exact:true}).waitFor();assert.match(await page.locator('.planner-detail img').getAttribute('src'),/first\/media\/media$/);
await page.getByRole('button',{name:'Schließen',exact:true}).click();await page.getByRole('button',{name:'Alle Tage',exact:true}).click();await page.getByLabel('Kanal',{exact:true}).selectOption('facebook');assert.equal(await page.locator('.planner-event').count(),0);await page.getByLabel('Kanal',{exact:true}).selectOption('');
await page.getByLabel('Projekt',{exact:true}).selectOption('second');await page.waitForFunction(()=>document.querySelectorAll('.planner-event').length===1&&document.querySelector('.planner-event').textContent.includes('zweites'));assert.ok(!(await page.locator('.planner-agenda').textContent()).includes('Friseurprojekt'));await page.getByLabel('Projekt',{exact:true}).selectOption('');await page.locator('[data-day="2027-03-15"]').waitFor();
await page.getByRole('button',{name:'Nächster Monat'}).click();await page.getByRole('heading',{name:'April 2027',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('.planner-event')?.textContent.includes('Facebook'));assert.equal(await page.locator('.planner-event').count(),1);
for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+width);}
fs.mkdirSync('artifacts/planner',{recursive:true});await page.screenshot({path:'artifacts/planner/mobile-320.png',fullPage:true});
await page.getByRole('button',{name:'Vorheriger Monat'}).click();await page.getByRole('heading',{name:'März 2027',exact:true}).waitFor();slowApril=true;await page.getByRole('button',{name:'Nächster Monat'}).click();await page.waitForTimeout(100);await page.getByRole('button',{name:'Nächster Monat'}).click();await page.getByRole('heading',{name:'Mai 2027',exact:true}).waitFor();await page.locator('[data-day="2027-05-03"]').waitFor();assert.ok(releaseApril);releaseApril();await page.waitForTimeout(200);assert.ok(!(await page.locator('.planner-agenda').textContent()).includes('Facebook'),'Late April must not overwrite May');slowApril=false;
disabled=true;await page.reload();await page.getByRole('alert').filter({hasText:'noch nicht freigeschaltet'}).waitFor();assert.equal(await page.locator('.planner-month,.planner-event').count(),0);disabled=false;await page.getByRole('button',{name:'Erneut laden'}).click();await page.locator('.planner-month').waitFor();
guest=true;await page.reload();await page.getByRole('heading',{name:/Anmelden|Willkommen/}).first().waitFor();assert.equal(await page.locator('.planner-month,.planner-event').count(),0);assert.equal(mutations.length,0,'Planner must never post/generate/schedule');assert.deepEqual(errors,[]);console.log('PASS: calendar month/DST bounds, per-channel override, pagination, project/channel/day filters, protected photo/details, 390/320px, late-response isolation, disabled/retry, guest access and no mutations.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
