import { expect, test } from 'bun:test';
import { planCheckText, PLAN_CHECK_TEXT } from '../functions/plan-check/text.ts';

test('every language has a title and body, Russian is the fallback', () => {
  for (const k of ['RU', 'UA', 'SK', 'CS', 'EN']) {
    expect(PLAN_CHECK_TEXT[k].title.length).toBeGreaterThan(5);
    expect(PLAN_CHECK_TEXT[k].body.length).toBeGreaterThan(10);
  }
  expect(planCheckText('de')).toBe(PLAN_CHECK_TEXT.RU);
  expect(planCheckText(null)).toBe(PLAN_CHECK_TEXT.RU);
  expect(planCheckText('sk')).toBe(PLAN_CHECK_TEXT.SK);
});

test('the push never carries personal data', () => {
  for (const x of Object.values(PLAN_CHECK_TEXT)) expect(`${x.title} ${x.body}`).not.toMatch(/\{|\$|@/);
});

test('the function sends only a relative route and claims before sending', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../functions/plan-check/index.ts'), 'utf8');
  expect(src.indexOf('plan_check_claim')).toBeLessThan(src.indexOf('exp.host'));
  expect(src).toContain("route: `/plan-after?id=");
});
