// Mockup vs app, by numbers (web only; not native iOS). `mockup-metrics.json` holds, for every mockup screen at 393×852,
// the visible text items: [text, x, y, w, h, fontSize, fontWeight] (measured from the mockup, no markup).
// For every screen in the e2e route map this opens the app at the same size, matches items by text and reports the vertical
// offset, the spread of that offset, font-size and weight differences. Informational: it never fails the run, it ranks screens.
// Run from e2e/ after run-all.sh's seed:  node visual-compare.mjs [only-screen ...]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { APP } from './api.mjs';
import { buildScreenMap, publicScreenMap } from './screen-map.mjs';

const mock = JSON.parse(fs.readFileSync(new URL('./mockup-metrics.json', import.meta.url), 'utf8'));
const only = process.argv.slice(2);
const map = { ...(await buildScreenMap()), ...publicScreenMap };
const out = process.env.MOBILE_QA_OUTPUT ?? 'out/screens';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
const options = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const pub = await browser.newContext(options);
const signed = await browser.newContext({ ...options, storageState: 'out/anna.json' });
const pages = [await pub.newPage(), await signed.newPage()];

const extract = () => {
  const root = document.getElementById('root') ?? document.body;
  const base = root.getBoundingClientRect();
  const items = [];
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join(' ');
    const r = el.getBoundingClientRect();
    if (own && r.width > 0 && r.height > 0) items.push([own.replace(/\s+/g, ' ').slice(0, 48), Math.round(r.x - base.x), Math.round(r.y - base.y), Math.round(r.width), Math.round(r.height), parseFloat(cs.fontSize), +cs.fontWeight]);
    for (const c of el.children) walk(c);
  };
  walk(root);
  return items;
};
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 24);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const rows = [];
for (const [name, ref] of Object.entries(mock)) {
  if (only.length && !only.includes(name)) continue;
  const entry = map[name];
  if (!entry) { rows.push({ name, skipped: 'not in the route map' }); continue; }
  const [url, who] = entry;
  const page = pages[who];
  let items = [];
  try {
    await page.goto(APP + url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(700);
    items = await page.evaluate(extract);
  } catch (e) { rows.push({ name, skipped: `no render: ${e.message.slice(0, 80)}` }); continue; }
  const pool = new Map();
  for (const it of items) { const k = norm(it[0]); if (k.length < 2) continue; (pool.get(k) ?? pool.set(k, []).get(k)).push(it); }
  const pairs = [];
  let total = 0;
  for (const m of ref.items) {
    const k = norm(m[0]); if (k.length < 2) continue;
    total++;
    const c = pool.get(k); if (!c?.length) continue;
    let bi = 0; for (let i = 1; i < c.length; i++) if (Math.abs(c[i][2] - m[2]) < Math.abs(c[bi][2] - m[2])) bi = i;
    pairs.push({ m, a: c.splice(bi, 1)[0] });
  }
  const dy = pairs.map((p) => p.a[2] - p.m[2]);
  const off = median(dy);
  const spread = Math.max(0, ...dy.map((d) => Math.abs(d - off)));
  const fs = pairs.filter((p) => Math.abs(p.a[5] - p.m[5]) >= 1);
  const fw = pairs.filter((p) => Math.abs(p.a[6] - p.m[6]) >= 200);
  const dx = pairs.filter((p) => Math.abs(p.a[1] - p.m[1]) >= 4);
  rows.push({
    name, total, matched: pairs.length, offset: off, spread, mockH: ref.h,
    fontSize: fs.slice(0, 6).map((p) => `"${p.m[0].slice(0, 22)}" ${p.m[5]}→${p.a[5]}`),
    fontWeight: fw.slice(0, 4).map((p) => `"${p.m[0].slice(0, 22)}" ${p.m[6]}→${p.a[6]}`),
    shiftX: dx.slice(0, 4).map((p) => `"${p.m[0].slice(0, 22)}" x ${p.m[1]}→${p.a[1]}`),
    worstY: pairs.map((p, i) => ({ t: p.m[0].slice(0, 22), d: dy[i] - off })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 4),
  });
}
const score = (r) => (r.skipped ? -1 : r.spread + r.fontSize.length * 6 + (r.total ? ((r.total - r.matched) / r.total) * 40 : 0));
rows.sort((a, b) => score(b) - score(a));
fs.writeFileSync(`${out}/visual-compare.json`, JSON.stringify(rows, null, 1));
const lines = rows.filter((r) => !r.skipped).map((r) =>
  `${r.name.padEnd(24)} match ${String(r.matched).padStart(2)}/${String(r.total).padEnd(2)} offY ${String(r.offset).padStart(4)} spreadY ${String(r.spread).padStart(4)} fs ${r.fontSize.length} fw ${r.fontWeight.length} dx ${r.shiftX.length}`);
fs.writeFileSync(`${out}/visual-compare.md`, '# Mockup vs app (web)\n\n```\n' + lines.join('\n') + '\n```\n\nSkipped: ' + rows.filter((r) => r.skipped).map((r) => `${r.name} (${r.skipped})`).join(', ') + '\n');
console.log('VISUAL-COMPARE (mockup vs app, web only)');
console.log(lines.join('\n'));
console.log('VISUAL-DETAIL ' + JSON.stringify(rows.filter((r) => !r.skipped).slice(0, 40)));
console.log('VISUAL-SKIPPED ' + rows.filter((r) => r.skipped).map((r) => `${r.name}: ${r.skipped}`).join('; '));
await browser.close();
