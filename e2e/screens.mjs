// Web layout evidence only: this does not exercise native iOS keyboard/safe areas.
// Run from e2e/: node screens.mjs [--public|--fixtures] [--strict-targets] [--report-only].
// Seeded full run (default map) follows run-all.sh and gates on unexpected findings unless --report-only.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { APP, URL as API } from './api.mjs';
import { buildScreenMap, expectedRedirects, publicScreenMap } from './screen-map.mjs';
import { expectedPath, rowFindings, validateExpectedRedirects } from './inventory.mjs';
import { auditLayout } from './layout-audit.mjs';
import { checkMobileInteraction } from './mobile-interactions.mjs';
import { fixtureScreenMap, installMobileFixtures } from './mobile-fixtures.mjs';

const reportOnly = process.argv.includes('--report-only');
const strictTargets = process.argv.includes('--strict-targets');
const fixtures = process.argv.includes('--fixtures');
const publicOnly = process.argv.includes('--public');
// Captures must use fictitious local fixtures, never a hosted account's data.
const local = (url) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
if (!local(APP) || (!publicOnly && !fixtures && !local(API))) throw new Error('Screenshot capture requires localhost app/API with fictitious e2e fixtures.');
const devices = { 'iphone-15': { width: 393, height: 852 }, 'iphone-se': { width: 375, height: 667 }, 'small-320': { width: 320, height: 568 } };
const map = publicOnly ? publicScreenMap : fixtures ? fixtureScreenMap : await buildScreenMap();
const inventory = !publicOnly && !fixtures;
const redirects = inventory ? expectedRedirects : {};
const configProblems = validateExpectedRedirects(map, redirects);
if (configProblems.length) throw new Error(`Invalid expectedRedirects: ${configProblems.join('; ')}`);
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
const output = process.env.MOBILE_QA_OUTPUT ?? 'out/screens';
const rows = [];
try {
  for (const [device, viewport] of Object.entries(devices)) {
    fs.mkdirSync(`${output}/${device}`, { recursive: true });
    const options = { viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
    const contexts = [await browser.newContext(options)];
    if (!publicOnly) {
      const signedIn = await browser.newContext(fixtures ? options : { ...options, storageState: 'out/anna.json' });
      if (fixtures) await installMobileFixtures(signedIn, APP);
      contexts.push(signedIn);
    }
    try {
      const pages = await Promise.all(contexts.map((context) => context.newPage()));
      for (const [name, [url, who]] of Object.entries(map)) {
        const page = pages[who], errors = [];
        const onError = (error) => errors.push(error.message.slice(0, 160));
        page.on('pageerror', onError);
        let audit = null, at = '', navigationError = '';
        try {
          await page.goto(APP + url, { waitUntil: 'networkidle', timeout: 20000 });
          await page.waitForTimeout(500);
          at = new URL(page.url()).pathname;
          audit = await page.evaluate(auditLayout);
          if (!await page.locator('#root').innerText()) throw new Error('App root is blank');
          await page.screenshot({ path: `${output}/${device}/${name}.png` });
          if (fixtures) await checkMobileInteraction(page, name, `${output}/${device}`);
        } catch (error) { navigationError = error.message.slice(0, 160); }
        finally { page.off('pageerror', onError); }
        rows.push({ device, name, expected: expectedPath(name, url, redirects), redirectExpected: !!redirects[name], at, errors, navigationError, ...audit });
      }
    } finally { await Promise.all(contexts.map((context) => context.close())); }
  }
} finally { await browser.close(); }
for (const row of rows) row.findings = rowFindings(row, { strictTargets });
const problems = rows.filter((row) => row.findings.length);
fs.writeFileSync(`${output}/report.json`, JSON.stringify({ surface: 'Chromium mobile web; not native iOS', fixtures, reportOnly, strictTargets, expectedRedirects: redirects, problems: problems.length, rows }, null, 2));
const cell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
fs.writeFileSync(`${output}/report.md`, [
  inventory ? `# Mobile web route inventory${reportOnly ? ' (report only)' : ''}` : '# Mobile web layout capture', '',
  'Fictitious local fixtures. Chromium mobile viewports; native keyboard, VoiceOver, Dynamic Type and safe-area behavior require separate iOS verification.', '',
  `${problems.length} rows with findings of ${rows.length}. Small targets are ${strictTargets ? (reportOnly ? 'included in findings' : 'gating') : 'advisory'} and recorded in JSON.`, '',
  ...(Object.keys(redirects).length ? ['Expected redirects (the row must land exactly on the target):', '', ...Object.entries(redirects).map(([n, r]) => `- ${n} → ${r.to}: ${r.why}`), ''] : []),
  ...(reportOnly ? ['Report-only run: findings are listed but do not fail the command.', ''] : []),
  '| device | screen | opened at | findings | overflow | small targets |', '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.device} | ${r.name} | ${r.at}${r.redirectExpected && r.at === r.expected ? ' (expected redirect)' : ''} | ${cell(r.findings.join('; '))} | ${r.outside?.length ?? 'unmeasured'} | ${r.smallTargets?.length ?? 'unmeasured'} |`), '',
].join('\n'));
console.log(`Mobile web: ${problems.length} failed rows / ${rows.length}; ${output}/report.md`);
if (problems.length) {
  for (const row of problems.slice(0, 30)) console.log(`  ${row.device} ${row.name}: ${row.findings.join('; ')}`);
  const title = inventory ? 'Mobile web route inventory' : 'Mobile web layout capture';
  const level = reportOnly ? 'warning' : 'error';
  console.log(`::${level} title=${title}::${problems.length} of ${rows.length} rows have unexpected findings (redirects, navigation failures, page errors, overflow${strictTargets ? ' or target sizes' : ''}). See ${output}/report.md.`);
  if (!reportOnly) process.exitCode = 1;
}
