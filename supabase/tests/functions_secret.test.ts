// Edge Function webhook secrets: refuse everything when the secret is missing; no implicit comparisons.
// Run by scripts/test-db.sh with `bun test` (no network, no Deno needed).
import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { secretMatches } from '../functions/_shared/secret.ts';

test('missing secret refuses every request', () => {
  expect(secretMatches(null, undefined)).toBe(false);
  expect(secretMatches('', '')).toBe(false);
  expect(secretMatches('anything', undefined)).toBe(false);
  expect(secretMatches(null, 's3cret')).toBe(false);
});

test('wrong secret is refused, right secret accepted', () => {
  expect(secretMatches('s3creT', 's3cret')).toBe(false);
  expect(secretMatches('s3cret-longer', 's3cret')).toBe(false);
  expect(secretMatches('s3cret', 's3cret')).toBe(true);
});

const root = join(import.meta.dir, '../functions');
const sources = readdirSync(root)
  .filter((d) => d !== '_shared')
  .map((d) => [d, readFileSync(join(root, d, 'index.ts'), 'utf8')] as const);

test('no function compares a value directly with Deno.env.get (null !== undefined trap)', () => {
  for (const [name, src] of sources) {
    const bad = /[!=]==?\s*Deno\.env\.get\(/.test(src) || /Deno\.env\.get\([^)]*\)\s*[!=]==?/.test(src);
    expect({ name, bad }).toEqual({ name, bad: false });
  }
});

test('push refuses all requests with 401 when PUSH_WEBHOOK_SECRET is not set', () => {
  const src = sources.find(([n]) => n === 'push')![1];
  expect(src).toMatch(/if \(!secret\) \{[\s\S]{0,200}401/);
  expect(src).toContain('secretMatches(');
});
