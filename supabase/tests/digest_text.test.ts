// Pure helpers of the weekly-digest Edge Function (no network, no Deno).
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { digestText, ruProfiles } from '../functions/weekly-digest/text.ts';

test('Russian plural forms', () => {
  expect(ruProfiles(1)).toBe('1 новая анкета');
  expect(ruProfiles(2)).toBe('2 новые анкеты');
  expect(ruProfiles(5)).toBe('5 новых анкет');
  expect(ruProfiles(11)).toBe('11 новых анкет');
  expect(ruProfiles(12)).toBe('12 новых анкет');
  expect(ruProfiles(21)).toBe('21 новая анкета');
  expect(ruProfiles(24)).toBe('24 новые анкеты');
  expect(ruProfiles(100)).toBe('100 новых анкет');
});

test('unknown or missing language falls back to Russian', () => {
  expect(digestText('XX')).toBe(digestText('RU'));
  expect(digestText(null)).toBe(digestText('RU'));
  expect(digestText('ru')).toBe(digestText('RU'));
});

test('texts contain only the count', () => {
  const x = digestText('RU');
  expect(x.pushBody(3)).toContain('3 новые анкеты');
  expect(x.emailBody(3)).toContain('3 новые анкеты');
});

test('weekly-digest refuses all requests with 401 when DIGEST_CRON_SECRET is not set', () => {
  const src = readFileSync(join(import.meta.dir, '../functions/weekly-digest/index.ts'), 'utf8');
  expect(src).toMatch(/if \(!secret\) \{[\s\S]{0,200}401/);
  expect(src).toContain('secretMatches(');
});
