const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ffmpeg=require('@ffmpeg-installer/ffmpeg').path;
fs.mkdirSync('artifacts/publishing',{recursive:true});
for(const [name,width,height] of [['vertical',1080,1920],['square',1080,1080]]){
 const file='public/promo/dfbk-promo-'+name+'.mp4';
 const decoded=spawnSync(ffmpeg,['-hide_banner','-i',file,'-f','null','-'],{encoding:'utf8',windowsHide:true});
 assert.equal(decoded.status,0,decoded.stderr);assert.match(decoded.stderr,/Video: h264/);assert.match(decoded.stderr,/yuv420p/);assert.ok(decoded.stderr.includes(width+'x'+height));assert.match(decoded.stderr,/Duration: 00:00:14.00/);assert.match(decoded.stderr,/24 fps/);
 const sample=spawnSync(ffmpeg,['-y','-ss','13.4','-i',file,'-frames:v','1','artifacts/publishing/final-'+name+'.png'],{encoding:'utf8',windowsHide:true});
 assert.equal(sample.status,0,sample.stderr);
 const bytes=fs.readFileSync(file);console.log(JSON.stringify({file,width,height,duration:14,fps:24,codec:'H264',pixelFormat:'yuv420p',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),decode:'PASS'}));
}
