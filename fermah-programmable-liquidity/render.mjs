// Renders src/index.html to out/fermah-programmable-liquidity.png (1600x900 layout at 2x = 3200x1800).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const ROOT = resolve(new URL('.', import.meta.url).pathname);
const SCALE = Number(process.argv[2] || 2);
const types = { '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(ROOT, p.startsWith('/assets/') ? p : join('src', p));
  try { res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: SCALE });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForSelector('body[data-ready="1"]');
await mkdir(join(ROOT, 'out'), { recursive: true });
const out = join(ROOT, 'out', 'fermah-programmable-liquidity.png');
await page.screenshot({ path: out });
console.log('wrote', out);
await browser.close();
server.close();
