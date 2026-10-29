// Screenshots of every app screen at iPhone sizes, for layout review (RENVI ships on iOS only).
// Run after run-all.sh (it needs the e2e data). Output: out/screens/<device>/<screen>.png and out/screens/report.md
// listing redirects (screen did not open), page errors and horizontal overflow per screen.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { APP } from './api.mjs';
import { buildScreenMap } from './screen-map.mjs';

const DEVICES = {
  'iphone-15': { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'iphone-se': { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const map = await buildScreenMap();
const b = await chromium.launch();
const lines = ['# Screens report', '', '| device | screen | opened at | page errors | horizontal overflow |', '|---|---|---|---|---|'];
let issues = 0;
for (const [device, opts] of Object.entries(DEVICES)) {
  fs.mkdirSync(`out/screens/${device}`, { recursive: true });
  const ctxs = [await b.newContext(opts), await b.newContext({ ...opts, storageState: 'out/anna.json' })];
  const pages = [await ctxs[0].newPage(), await ctxs[1].newPage()];
  for (const [name, [url, who]] of Object.entries(map)) {
    const p = pages[who];
    const errs = [];
    const onErr = (e) => errs.push(e.message.slice(0, 120));
    p.on('pageerror', onErr);
    await p.goto(APP + url, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(1200);
    const overflow = await p.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > w + 1);
      return wide.length ? `${wide.length} el, max ${Math.round(Math.max(...wide.map((e) => e.getBoundingClientRect().right)))}px > ${w}px` : '';
    }).catch(() => '');
    await p.screenshot({ path: `out/screens/${device}/${name}.png` });
    p.off('pageerror', onErr);
    const at = new URL(p.url()).pathname.replace(new URL(APP).pathname.replace(/\/$/, ''), '') || '/';
    const want = url.split('?')[0];
    const redirected = at !== want;
    if (redirected || errs.length || overflow) issues++;
    lines.push(`| ${device} | ${name} | ${redirected ? '**' + at + '**' : at} | ${errs.join('; ')} | ${overflow} |`);
  }
  for (const c of ctxs) await c.close();
}
await b.close();
lines.splice(2, 0, `${issues} rows with a redirect, page error or overflow.`, '');
fs.writeFileSync('out/screens/report.md', lines.join('\n') + '\n');
console.log(`screens: ${issues} rows need attention (out/screens/report.md)`);
