import { chromium } from 'playwright';
import fs from 'node:fs';
import { APP, URL as API } from './api.mjs';
import { buildScreenMap } from './screen-map.mjs';
const local = (url) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
if (!local(APP) || !local(API)) throw new Error('Capture requires a localhost app/API and fictitious fixtures.');
const map = await buildScreenMap();
fs.mkdirSync('out/app', { recursive: true });
const refs = fs.readdirSync('out/ref').sort();
const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
const ctxs = [await b.newContext({ viewport: { width: 393, height: 852 } }), await b.newContext({ viewport: { width: 393, height: 852 }, storageState: 'out/anna.json' })];
const pages = [await ctxs[0].newPage(), await ctxs[1].newPage()];
const problems = [];
for (const f of refs) {
  const id = f.replace(/^\d+-/, '').replace('.png', '');
  const route = map[id] ?? (id.startsWith('likes-') ? map.likes : undefined);
  if (!route) { problems.push(`${f}: no mapped route`); continue; }
  const [url, who] = route;
  const p = pages[who];
  const errs = [];
  const onErr = (e) => errs.push(e.message);
  p.on('pageerror', onErr);
  try {
    await p.goto(APP + url, { waitUntil: 'networkidle', timeout: 20000 });
    await p.waitForTimeout(500);
    await p.screenshot({ path: 'out/app/' + f });
  } catch (error) { problems.push(`${f}: navigation/capture failed: ${error.message}`); }
  finally { p.off('pageerror', onErr); }
  const path = new URL(p.url()).pathname;
  if (path !== url.split('?')[0]) problems.push(`${f}: redirected to ${path}`);
  if (errs.length) problems.push(`${f}: ${errs[0]}`);
  console.log(f, '→', path);
}
console.log('problems:', problems.join('\n') || 'none');
await b.close();
if (problems.length) process.exitCode = 1;
