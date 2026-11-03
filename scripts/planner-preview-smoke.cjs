const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const origin=process.env.PROMO_ORIGIN||'http://127.0.0.1:4186';
const photo=fs.readFileSync('public/visual/integrations/friseur-optimized.webp');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PROMO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
const page=await browser.newPage({viewport:{width:320,height:844},timezoneId:'America/New_York'});await page.addInitScript(()=>{Date.now=()=>Date.parse('2027-03-01T10:00:00Z');});
let missing=false,foreign=false,reads=[],writes=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
const time={scheduledAt:Date.parse('2027-03-03T11:00:00Z'),timezone:'Europe/Berlin',utcOffset:'+01:00',localDateTime:'2027-03-03T12:00'};
const item={id:'item',channel:'instagram',targetKind:'account',timeSource:'common',time,status:'draft'};
const pack={id:'pack',projectId:'own',version:1,status:'draft',createdAt:1,commonTime:time,itemCount:1,earliestAt:time.scheduledAt,latestAt:time.scheduledAt,items:[item]};
await page.route('**/api/**',async route=>{const req=route.request(),p=new URL(req.url()).pathname;reads.push(p);if(req.method()!=='GET')writes.push(p);let status=200,data={ok:true};
if(p==='/api/auth/me')data={ok:true,user:{id:'owner',email:'fixture@example.invalid',emailVerified:true,plan:'business'}};
else if(p.endsWith('/entitlements'))data={ok:true,plan:'business',displayName:'Business',status:'active',voice:{enabled:true,maxWords:null},features:{contentGeneration:true,share:true,businessIntegrations:true},usage:{projectsUsed:1,projectsLimit:null},expiresAt:null};
else if(p==='/api/projects')data={ok:true,projects:[{id:'own',title:'Eigenes Projekt',status:'ready',createdAt:'2027-01-01',updatedAt:'2027-01-01'}]};
else if(p==='/api/social/connections')data={ok:true,connections:[]};
else if(p==='/api/scheduler/packages') {status=foreign?404:200;data=foreign?{ok:false,error:{code:'NOT_FOUND'}}:{ok:true,cannotDispatch:true,packages:[pack],nextCursor:null};}
else if(p==='/api/scheduler/packages/pack')data={ok:true,cannotDispatch:true,package:{...pack,items:[{...item,caption:'Eigener Text',media:{id:'media',role:'optimized',mimeType:'image/webp'}}]}};
else if(p==='/api/projects/own/media')data={ok:true,media:{original:null,optimized:missing?null:{id:'media',mimeType:'image/webp'}},photoOptimization:{state:'completed'}};
else if(p==='/api/projects/own/media/media'){if(missing){await route.fulfill({status:404,body:''});return;}await route.fulfill({contentType:'image/webp',body:photo});return;}
await route.fulfill({status,json:data});});
await page.goto(origin+'/app/planner');await page.locator('.planner-event').waitFor();assert.equal(reads.filter(p=>p.includes('/media')).length,0,'No N+1 images for list');
assert.match(await page.locator('.planner-event').textContent(),/Instagram/);assert.match(await page.locator('.planner-event time').textContent(),/03\.03\.2027.*12:00/);assert.match(await page.locator('.planner-event').textContent(),/Entwurf · wird nicht gesendet/);
await page.getByLabel('Projekt',{exact:true}).selectOption('own');await page.locator('.planner-project-preview img').waitFor();assert.equal(reads.filter(p=>p==='/api/projects/own/media').length,1);
await page.locator('.planner-event').click();await page.getByText('Eigener Text',{exact:true}).waitFor();assert.match(await page.locator('.planner-detail time').textContent(),/Europe\/Berlin/);
missing=true;await page.reload();await page.getByLabel('Projekt',{exact:true}).selectOption('own');await page.locator('.planner-project-preview').getByText('Kein Foto verfügbar').waitFor();await page.locator('.planner-event').click();await page.locator('.planner-detail').getByText('Kein Foto verfügbar').waitFor();
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px overflow');
fs.mkdirSync('artifacts/planner-preview',{recursive:true});await page.screenshot({path:'artifacts/planner-preview/mobile-320.png',fullPage:true});
foreign=true;await page.goto(origin+'/app/planner?projectId=foreign');await page.getByRole('alert').waitFor();assert.equal(await page.locator('.planner-project-preview img,.planner-detail img,.planner-event').count(),0);assert.ok(!reads.some(p=>p.startsWith('/api/projects/foreign')),'No media read for foreign project');assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
console.log('PASS: own selected thumbnail, no list N+1, foreign denial, missing photo/detail fallback, channel/Berlin time/draft status, 320px and GET-only.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
