#!/usr/bin/env node
/* Renders src/index.html to numbered PNG frames with headless Chromium (Playwright).

   node tools/render.js --out <dir> [--from 0] [--to 479] [--step 1] [--frames 0,12,48] [--workers 3] [--no-blur]

   Frames flagged by window.blurSamples() are captured as several sub-frames
   (<frame>_<k>.png) which tools/blend.py then averages into real motion blur. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(opt('out', 'frames'));
const STEP = +opt('step', 1), WORKERS = +opt('workers', 3), NO_BLUR = args.includes('--no-blur');
const SHUTTER = +opt('shutter', 0.7);             // fraction of the frame interval the "shutter" is open

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/src/index.html`;
  const t0 = Date.now();

  const open = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
    page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
    await page.goto(url);
    await page.evaluate(() => window.READY);
    return { browser, page };
  };

  const first = await open();
  const total = await first.page.evaluate(() => window.TOTAL_FRAMES);
  const fps = await first.page.evaluate(() => window.FPS);
  const from = +opt('from', 0), to = Math.min(+opt('to', total - 1), total - 1);
  const list = opt('frames', null);             // explicit list, e.g. --frames 0,12,48
  const frames = list ? list.split(',').map(Number) : [];
  if (!list) for (let f = from; f <= to; f += STEP) frames.push(f);

  let done = 0;
  const work = async (ctx, mine) => {
    for (const f of mine) {
      const k = NO_BLUR ? 1 : await ctx.page.evaluate(n => window.blurSamples(n), f);
      for (let i = 0; i < k; i++) {
        const t = (f + (i / k) * SHUTTER) / fps;        // shutter opens on the frame, so blur never straddles a cut
        await ctx.page.evaluate(x => window.renderAt(x), t);
        const name = String(f).padStart(5, '0') + (k === 1 ? '' : `_${i}`) + '.png';
        await ctx.page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: 1080, height: 1920 } });
      }
      if (++done % 60 === 0) console.log(`${done}/${frames.length} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    await ctx.browser.close();
  };

  const n = Math.min(WORKERS, frames.length);
  const ctxs = [first, ...(await Promise.all(Array.from({ length: n - 1 }, open)))];
  await Promise.all(ctxs.map((c, w) => work(c, frames.filter((_, i) => i % n === w))));
  server.close();
  console.log(`rendered ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
