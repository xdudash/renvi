import { chromium } from 'playwright';
// The prototype is a private design file and is not stored in the repository.
const file = 'file://' + process.env.PROTOTYPE_HTML;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
await p.goto(file);
await p.waitForTimeout(800);
const ids = await p.evaluate(() => routes.map((r) => r[2]));
let n = 0;
for (const id of ids) {
  n++;
  await p.evaluate((r) => { go(r); document.querySelector('#main') && (document.querySelector('#main').scrollTop = 0); }, id);
  await p.waitForTimeout(120);
  await p.screenshot({ path: `out/ref/${String(n).padStart(2, '0')}-${id}.png` });
}
console.log('captured', n);
await b.close();
