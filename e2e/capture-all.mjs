import { chromium } from 'playwright';
import fs from 'node:fs';
import { APP } from './api.mjs';
import { buildScreenMap } from './screen-map.mjs';
const map = await buildScreenMap();
const refs = fs.readdirSync('out/ref').sort();
const b = await chromium.launch();
const ctxs = [await b.newContext({ viewport: { width: 393, height: 852 } }), await b.newContext({ viewport: { width: 393, height: 852 }, storageState: 'out/anna.json' })];
const pages = [await ctxs[0].newPage(), await ctxs[1].newPage()];
const problems = [];
for (const f of refs) {
  const id = f.replace(/^\d+-/, '').replace('.png', '');
  const [url, who] = map[id];
  const p = pages[who];
  const errs = [];
  const onErr = (e) => errs.push(e.message);
  p.on('pageerror', onErr);
  await p.goto(APP + url, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1300);
  await p.screenshot({ path: 'out/app/' + f });
  p.off('pageerror', onErr);
  const path = new URL(p.url()).pathname;
  if (errs.length) problems.push(`${f}: ${errs[0]}`);
  console.log(f, '→', path);
}
console.log('problems:', problems.join('\n') || 'none');
await b.close();
