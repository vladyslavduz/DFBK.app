const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const run=(file,requireMock)=>{const m={exports:{}};new Function('require','module','exports',compile(file))(requireMock,m,m.exports);return m.exports;};
const catalogue=run('src/config/publishing.ts',()=>{});
function harness(destinations){let slots=[],index=0,pending=[],tree,posts=[],mode='success';
 const react={useState(init){const i=index++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},useRef(init){const i=index++;return slots[i]??(slots[i]={current:init});},useEffect(fn,deps){const i=index++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;pending.push(fn);}},useMemo:fn=>fn(),useId:()=>String(index++)};
 class DraftSaveError extends Error{}
 const runtime={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const Form=run('src/components/ProjectDraftForm.tsx',p=>p==='react'?react:p==='react/jsx-runtime'?runtime:p==='./AppLink'?{default:'a',__esModule:true}:p.includes('config/publishing')?catalogue:p.includes('planner-draft-time')?{draftTimeChoices:()=>[],confirmedDraftTime:local=>({localDateTime:local,timezone:'Europe/Berlin',utcOffset:'+01:00',confirmed:true})}:p.includes('services/planner-draft')?{projectDraftDestinations:async()=>{if(destinations===null)throw Error('offline');return destinations;},DraftSaveError,draftSaveMessage:()=> 'uncertain',saveProjectDraft:async(body,key)=>{posts.push({body,key});if(mode==='unknown')throw Object.assign(new DraftSaveError(),{uncertain:true});return {packageId:'saved',replayed:mode==='replay'};}}:{}).default;
 const props={ownerId:'owner',projectId:'own',mediaId:'photo',imageUrl:'/api/projects/own/media/photo',texts:Object.fromEntries(catalogue.publishingChannels.map(c=>[c.id,'Own '+c.id]))};
 const render=()=>{index=0;tree=Form(props);while(pending.length)pending.shift()();return tree;};
 const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(x=>nodes(x)):[n,...nodes(n.props?.children)];
 const find=predicate=>{const n=nodes(tree).find(predicate);assert.ok(n,'node found');return n;};
 const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
 const settle=async()=>{await new Promise(r=>setImmediate(r));render();};
 const open=async()=>{render();find(n=>n.type==='button'&&text(n).includes('Entwurf im Planer vorbereiten')).props.onClick();render();await settle();};
 const choose=id=>{find(n=>n.type==='input'&&n.props['aria-label']===catalogue.publishingChannels.find(c=>c.id===id).label+' für Entwurf auswählen').props.onChange({target:{checked:true}});render();};
 const submit=async()=>{find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle();};
 return {open,choose,submit,render,find,nodes:()=>nodes(tree),text,posts,settle,setMode:v=>mode=v};
}
test('all channels prepare own captions/time without connections; no partial subset/save on unsupported/error',async()=>{
 for(const destinations of [[],null,[{channel:'instagram',connectionId:'real_ig',label:'Fixture'}]]){
  const h=harness(destinations);await h.open();h.choose('google_business');h.choose('instagram');
  const textarea=h.find(n=>n.type==='textarea'&&n.props['aria-label']==='Text für Google Business (Entwurf)');assert.equal(textarea.props.value,'Own google_business');textarea.props.onChange({target:{value:'Edited own Google text'}});h.render();
  assert.equal(h.find(n=>n.type==='textarea'&&n.props['aria-label']==='Text für Google Business (Entwurf)').props.value,'Edited own Google text');
  h.find(n=>typeof n.type==='function'&&n.props.label==='Gemeinsame Zeit').props.onChange('2027-12-03T12:00','');h.render();
  h.find(n=>n.type==='label'&&h.text(n)==='Eigene Zeit für Google Business').props.children[0].props.onChange({target:{checked:true}});h.render();
  assert.ok(h.nodes().some(n=>typeof n.type==='function'&&n.props.label==='Google Business Zeit'));
  assert.ok(h.nodes().filter(n=>n.type==='input'&&n.props['aria-label']).every(n=>!n.props.disabled));
  await h.submit();assert.deepEqual(h.posts,[]);assert.match(h.text(h.render()),/keine Teilauswahl/);
 }
});
test('connected Meta preserves exact contract and unknown retry key/body lock',async()=>{
 const h=harness([{channel:'instagram',connectionId:'real_ig',label:'Fixture'}]);await h.open();h.choose('instagram');h.find(n=>typeof n.type==='function'&&n.props.label==='Gemeinsame Zeit').props.onChange('2027-12-03T12:00','');h.render();h.setMode('unknown');await h.submit();assert.equal(h.posts.length,1);assert.deepEqual(h.posts[0].body.targets,[{channel:'instagram',connectionId:'real_ig',caption:'Own instagram'}]);assert.equal(h.posts[0].body.projectId,'own');assert.equal(h.posts[0].body.mediaId,'photo');assert.ok(h.nodes().filter(n=>n.type==='fieldset').every(n=>n.props.disabled));
 h.setMode('replay');h.find(n=>n.type==='button'&&h.text(n)==='Denselben Speicherversuch prüfen').props.onClick();await h.settle();assert.equal(h.posts.length,2);assert.deepEqual(h.posts[0],h.posts[1]);
});
