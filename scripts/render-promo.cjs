const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
const { once } = require('node:events');
(async () => {
  const origin = process.env.PROMO_ORIGIN || 'http://127.0.0.1:5173';
  const executablePath = process.env.PROMO_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ executablePath, headless: true });
  let activeEncoder;
  try {
    fs.mkdirSync('public/promo', { recursive: true });
    const specs = [{ name: 'vertical', width: 1080, height: 1920, stageWidth: 720 }, { name: 'square', width: 1080, height: 1080, stageWidth: 1080 }];
    for (const spec of specs.filter(item => !process.env.PROMO_VARIANT || item.name === process.env.PROMO_VARIANT)) {
      const page = await browser.newPage({ viewport: { width: spec.stageWidth, height: spec.height }, deviceScaleFactor: 1 });
      await page.goto(origin + '/integrations', { waitUntil: 'networkidle' });
      await page.locator('.integration-demo__stage').waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
        const stage = document.querySelector('.integration-demo__stage');
        for (const node of [...document.body.children]) {
          if (!node.contains(stage)) node.remove();
        }
        document.body.append(stage);
        for (const node of [...document.body.children]) if (node !== stage) node.remove();
        document.body.style.cssText = 'margin:0;padding:0;background:#0b1622;overflow:hidden';
        stage.style.cssText += ';position:relative;margin:0;width:100vw;max-width:none;border-radius:0';
      });
      const duration = 14, fps = 24;
      const output = path.resolve('public/promo/dfbk-promo-' + spec.name + '.mp4');
      const encoder = spawn(ffmpeg, ['-y','-f','image2pipe','-vcodec','png','-r',String(fps),'-i','-','-vf','scale=' + spec.width + ':' + spec.height + ':force_original_aspect_ratio=decrease,pad=' + spec.width + ':' + spec.height + ':(ow-iw)/2:(oh-ih)/2:color=0x0b1622','-an','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',output], { stdio: ['pipe','ignore','pipe'] });
      activeEncoder = encoder;
      let errors = ''; encoder.stderr.on('data', chunk => { errors += chunk; });
      const exited = once(encoder, 'exit');
      const animations = await page.evaluateHandle(() => {
        const all = document.querySelector('.integration-demo__stage').getAnimations({ subtree: true });
        all.forEach(a => a.pause()); return all;
      });
      for (let frame = 0; frame < duration * fps; frame++) {
        await page.evaluate(({ all, time }) => all.forEach(a => { a.currentTime = time; }), { all: animations, time: frame * 1000 / fps });
        const png = await page.locator('.integration-demo__stage').screenshot({ animations: 'allow' });
        if (frame % 48 === 0) process.stdout.write(spec.name + ': frame ' + frame + '/336\n');
        if (frame === 72) fs.writeFileSync('public/promo/poster-' + spec.name + '.png', png);
        if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
      }
      encoder.stdin.end();
      const [code] = await exited;
      if (code !== 0) throw new Error(errors);
      activeEncoder = null;
      await page.close();
      process.stdout.write(output + '\n');
    }
  } finally { if (activeEncoder) activeEncoder.kill(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
