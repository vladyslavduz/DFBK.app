import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { fixture } from './helpers/backend.mjs';

const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const { generateMarketingContent } = await vite.ssrLoadModule('/worker/lib/content-generation.ts');
const { handleProjectGeneration } = await vite.ssrLoadModule('/worker/routes/project-generation.ts');
const { handleProjectContent } = await vite.ssrLoadModule('/worker/routes/project-content.ts');
after(() => vite.close());

const input = { title: 'Neues Projekt', description: '', imageBytes: new Uint8Array([255,216,255]), imageMimeType: 'image/jpeg' };
const valid = { projectTitle: 'Schwarze Gehäuse', visualUnderstanding: 'Zwei schwarze Gehäuse.', workType: 'Gehäuse', marketingAngle: 'Reduzierter Gesamteindruck', googleBusiness: 'Ein klarer Auftritt. Das reduzierte Gesamtbild lässt Raum für das Wesentliche.', socialMedia: 'Weniger Ablenkung, mehr Wirkung. 🖤 Ein reduzierter Look mit klarer Linie.', websiteReference: 'Klare Linien bestimmen den Gesamteindruck dieser schwarzen Gehäuse. Die reduzierte Gestaltung setzt einen ruhigen visuellen Akzent.' };
function output(value) { return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }); }
async function mocked(provider, run) { const previous = globalThis.fetch; globalThis.fetch = provider; try { return await run(); } finally { globalThis.fetch = previous; } }

test('single existing request contains trusted marketing instructions, image and seven-field strict schema', async () => {
  let calls = 0;
  await mocked(async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-5.6-luna');
    assert.match(body.instructions, /NICHT Bildbeschreibung/);
    for (const phrase of ['Auf dem Bild sieht man', 'Das Foto zeigt', 'Zu sehen ist', 'Quellenpriorität', 'Keine Frische', 'keine ausführlichen']) {
      assert.ok(body.instructions.toLowerCase().includes(phrase.toLowerCase()), phrase);
    }
    const schema = body.text.format.schema;
    assert.equal(body.text.format.strict, true);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.required.sort(), Object.keys(valid).sort());
    const data = JSON.parse(body.input[0].content.find(c => c.type === 'input_text').text);
    assert.equal(data.optionalUserDescription, 'maßgefertigte Metallgehäuse');
    assert.ok(body.input[0].content.find(c => c.type === 'input_image').image_url.startsWith('data:image/jpeg;base64,'));
    return output(valid);
  }, async () => assert.deepEqual(await generateMarketingContent({OPENAI_API_KEY:'fixture'}, {...input,description:'maßgefertigte Metallgehäuse'}), valid));
  assert.equal(calls, 1);
});

test('missing, weak or oversized internal summaries and invalid title do not discard valid visible copy', async () => {
  for (const fields of [{}, { visualUnderstanding:42, workType:[], marketingAngle:' ' }, {visualUnderstanding:'x'.repeat(601),workType:'x'.repeat(121),marketingAngle:'x'.repeat(401)}]) {
    const {visualUnderstanding,workType,marketingAngle,...publicFields} = valid;
    await mocked(async () => output({...publicFields,...fields,projectTitle:'Tolles Projekt'}), async () => {
      const result = await generateMarketingContent({OPENAI_API_KEY:'fixture'}, input);
      assert.equal(result.projectTitle,null);
      for (const key of ['visualUnderstanding','workType','marketingAngle']) assert.equal(result[key],null);
      assert.equal(result.googleBusiness,valid.googleBusiness);
    });
  }
});

test('malformed JSON or missing/empty public text follows existing failure logic without paid retries', async () => {
  for (const response of [() => output({...valid,googleBusiness:''}), () => output({...valid,socialMedia:null}), () => output({...valid,websiteReference:undefined}), () => Response.json({output:[{content:[{type:'output_text',text:'not JSON'}]}]})]) {
    let calls=0;
    await mocked(async () => {calls++;return response();}, async () => {
      await assert.rejects(generateMarketingContent({OPENAI_API_KEY:'fixture'},input), {code:'AI_INVALID_RESPONSE'});
    });
    assert.equal(calls,1);
  }
});

test('five channel fixtures pass the contract without asserting real-model or photo-understanding quality', async () => {
  for (const title of ['Angerichtetes Hauptgericht','Schwarze Gehäuse','Wohnzimmer neu gestrichen','Damenhaarschnitt & Styling','Bodenreinigung']) {
    let calls=0;
    await mocked(async()=>{calls++;return output({...valid,projectTitle:title});},async()=>{
      const result=await generateMarketingContent({OPENAI_API_KEY:'fixture'},input);
      assert.equal(result.projectTitle,title);
      assert.equal(new Set([result.googleBusiness,result.socialMedia,result.websiteReference]).size,3);
    });
    assert.equal(calls,1);
  }
});

test('internal summaries never enter public generation/GET content or D1; manual title protected', async () => {
  const {db,env}=await fixture();env.OPENAI_API_KEY='fixture';
  db.exec("INSERT INTO projects(id,user_id,title,title_source) VALUES ('quality','user','Mein eigener Titel','manual'); INSERT INTO project_media(id,project_id,storage_key,role,mime_type,size_bytes) VALUES ('original','quality','private/key','original','image/jpeg',3);");
  env.MEDIA={get:async()=>({arrayBuffer:async()=>input.imageBytes.slice().buffer})};
  const path='/api/projects/quality/generate';
  await mocked(async()=>output({...valid,visualUnderstanding:'PRIVATE_EVIDENCE',workType:'PRIVATE_TYPE',marketingAngle:'PRIVATE_ANGLE'}),async()=>{
    const response=await handleProjectGeneration(new Request('https://dfbk.app'+path,{method:'POST',headers:{Cookie:'dfbk_session=user'}}),env,path);
    assert.equal(response.status,200);
    const result=await response.json();
    assert.deepEqual(Object.keys(result.content).sort(),['googleBusiness','socialMedia','websiteReference']);
    assert.equal(result.project.title,'Mein eigener Titel');assert.equal(result.project.titleSource,'manual');assert.equal(result.project.status,'ready');
    assert.doesNotMatch(JSON.stringify(result),/PRIVATE_/);
    const rows=db.prepare('SELECT content_type,content FROM generated_contents').all();
    assert.equal(rows.length,3);assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_/);
    const readPath='/api/projects/quality/content';
    const read=await handleProjectContent(new Request('https://dfbk.app'+readPath,{headers:{Cookie:'dfbk_session=user'}}),env,readPath);
    assert.equal(read.status,200);assert.doesNotMatch(await read.text(),/PRIVATE_/);
  });db.close();
});
