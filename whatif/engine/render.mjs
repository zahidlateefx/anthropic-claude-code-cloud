// Deterministic frame renderer: loads an episode page in headless Chromium,
// calls window.renderAt(t) per frame, screenshots, and pipes to ffmpeg.
// Usage:
//   node engine/render.mjs <episode-dir> [--fps 60] [--workers 2] [--stills 3,25,60] [--from 0 --to 10] [--gpu]
// --gpu uses the machine's graphics card (laptop/desktop); default is software WebGL (cloud).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ep = args[0].replace(/\\/g, '/').replace(/\/$/, '');
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > 0 ? args[i + 1] : d; };
const fps = +opt('fps', 60), workers = +opt('workers', 2);
const outDir = path.join(root, 'out', path.basename(ep)); fs.mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/${ep}/index.html`;

const gpu = args.includes('--gpu');
const cloudChrome = '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || (fs.existsSync(cloudChrome) ? cloudChrome : undefined),
  args: gpu
    ? ['--ignore-gpu-blocklist', '--enable-gpu', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-angle=gl'])]
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror', e.message));
  page.on('console', m => m.type() === 'error' && console.error('console', m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  if (!openPage.logged) {
    openPage.logged = true;
    console.log('WebGL renderer:', await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); }));
  }
  return page;
}

const shot = async (page, t) => { await page.evaluate(t => window.renderAt(t), t); return page.screenshot({ type: 'jpeg', quality: 93 }); };

const stills = opt('stills');
if (stills) {
  const page = await openPage();
  for (const t of stills.split(',').map(Number)) {
    const f = path.join(outDir, `still_${String(t).padStart(5, '0')}.jpg`);
    fs.writeFileSync(f, await shot(page, t)); console.log('wrote', f);
  }
} else {
  const page0 = await openPage();
  const dur = await page0.evaluate(() => window.DURATION);
  const from = +opt('from', 0), to = +opt('to', dur);
  const n = Math.round((to - from) * fps);
  const per = Math.ceil(n / workers);
  const t0 = Date.now(); let done = 0;
  const parts = await Promise.all([...Array(workers)].map(async (_, w) => {
    const page = w === 0 ? page0 : await openPage();
    const file = path.join(outDir, `part${w}.mp4`);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = w * per; i < Math.min(n, (w + 1) * per); i++) {
      const buf = await shot(page, from + i / fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 120 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`${done}/${n} frames  ${(el / done * 1000).toFixed(0)}ms/frame  eta ${((n - done) * el / done / 60).toFixed(1)}min`);
      }
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    return file;
  }));
  const list = path.join(outDir, 'parts.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(outDir, 'video.mp4')]);
  console.log('video ->', path.join(outDir, 'video.mp4'));
}
await browser.close(); server.close();
