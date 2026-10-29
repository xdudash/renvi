// CI must not float on `latest`: a new Supabase CLI / EAS CLI / runner image used to arrive unannounced and break
// unrelated PRs ("infra flakes"). Versions are bumped deliberately in the workflow files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('../../.github/workflows/', import.meta.url);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yml'));

test('workflows pin tool versions instead of latest', () => {
  assert.ok(files.length > 0);
  for (const f of files) {
    const lines = fs.readFileSync(new URL(f, dir), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*#/.test(line) || /echo /.test(line)) return; // comments and help texts may mention @latest
      assert.doesNotMatch(line, /version:\s*latest\b/, `${f}:${i + 1} floats on latest`);
      assert.doesNotMatch(line, /runs-on:\s*\S*-latest\b/, `${f}:${i + 1} floats on a latest runner image`);
      assert.doesNotMatch(line, /@latest\b/, `${f}:${i + 1} runs a tool @latest`);
    });
  }
});

test('Supabase CLI is pinned to the same exact version everywhere', () => {
  const versions = new Set();
  for (const f of files) {
    const text = fs.readFileSync(new URL(f, dir), 'utf8');
    for (const m of text.matchAll(/supabase\/setup-cli@v\d+\s*\n\s*with:\s*\n(?:\s*#.*\n)*\s*version:\s*(\S+)/g)) versions.add(m[1]);
  }
  assert.equal(versions.size, 1, `expected one pinned Supabase CLI version, got ${[...versions].join(', ')}`);
  assert.match([...versions][0], /^\d+\.\d+\.\d+$/);
});
