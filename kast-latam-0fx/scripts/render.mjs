// Renders src/index.html frame-by-frame with headless Chromium.
//   node scripts/render.mjs                      -> out/frames/*.png (all frames, 60fps)
//   node scripts/render.mjs --stills 1,3.5,7.2   -> out/stills/t-<sec>.png
//   options: --format 16x9 (default 1x1) --fps 60 --sub 4 (sub-frames per frame for motion blur)
//            --jpeg (q95 frames, ~5x smaller than PNG) --workers 4 --logo assets/kast-logo.svg
import { createServer } from 'node:http';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const FPS = Number(args.fps || 60);
const SUB = Number(args.sub || 1);
const WORKERS = Number(args.workers || 4);
const WIDE = args.format === '16x9';
const VW = WIDE ? 1920 : 1080, VH = 1080;
const EXT = args.jpeg ? 'jpg' : 'png';
const logo = args.logo || (existsSync(join(ROOT, 'assets/kast-logo-light.svg')) ? 'assets/kast-logo-light.svg' : '');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(ROOT, p.startsWith('/assets/') ? p : join('src', p));
  try { res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const query = new URLSearchParams({ ...(WIDE ? { format: '16x9' } : {}), ...(logo ? { logo: `/${logo}` } : {}) }).toString();
const url = `http://127.0.0.1:${server.address().port}/index.html${query ? `?${query}` : ''}`;

// One browser per worker: each gets its own GPU/raster process, which is the bottleneck.
const browsers = [];
const openPage = async () => {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
  browsers.push(browser);
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(url);
  await page.evaluate(() => window.KAST.ready);
  page.cdp = await page.context().newCDPSession(page);
  return page;
};
const shoot = async (page, t, path) => {
  await page.evaluate((tt) => window.KAST.renderFrame(tt), t);
  const shot = path.endsWith('.jpg') ? { format: 'jpeg', quality: 95 } : { format: 'png', optimizeForSpeed: true };
  const { data } = await page.cdp.send('Page.captureScreenshot', shot);
  await writeFile(path, Buffer.from(data, 'base64'));
};

const probe = await openPage();
const meta = await probe.evaluate(() => ({ duration: window.KAST.DURATION, cues: window.KAST.CUES }));
await mkdir(join(ROOT, 'out'), { recursive: true });
await writeFile(join(ROOT, 'out/cues.json'), JSON.stringify(meta.cues, null, 2));

if (args.stills) {
  await mkdir(join(ROOT, 'out/stills'), { recursive: true });
  for (const s of String(args.stills).split(',')) await shoot(probe, Number(s), join(ROOT, `out/stills/t-${Number(s).toFixed(2)}.png`));
  console.log('stills written');
} else {
  const dir = join(ROOT, 'out/frames');
  if (!args.from && !args.to) await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const rate = FPS * SUB;
  const total = Math.round(meta.duration * FPS) * SUB;
  const first = args.from ? Math.round(Number(args.from) * rate) : 0;
  const last = args.to ? Math.min(total, Math.round(Number(args.to) * rate)) : total;
  const pages = [probe, ...(await Promise.all(Array.from({ length: WORKERS - 1 }, openPage)))];
  let next = first, done = 0;
  const t0 = Date.now();
  await Promise.all(pages.map(async (page) => {
    while (next < last) {
      const i = next++;
      await shoot(page, i / rate, join(dir, `f${String(i).padStart(5, '0')}.${EXT}`));
      if (++done % 120 === 0) console.log(`${done}/${last - first} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
  console.log(`rendered ${last - first} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await Promise.all(browsers.map((b) => b.close()));
server.close();
