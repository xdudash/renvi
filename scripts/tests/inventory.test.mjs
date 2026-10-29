// Mobile web route inventory rules (e2e/inventory.mjs). The inventory is a gating CI step: an unexpected redirect,
// navigation failure, page error or overflow fails it; declared redirects must land exactly on their target.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { expectedPath, rowFindings, validateExpectedRedirects } from '../../e2e/inventory.mjs';
import { expectedRedirects } from '../../e2e/screen-map.mjs';

const clean = { device: 'iphone-se', name: 'discover', expected: '/discover', at: '/discover', errors: [], navigationError: '', outside: [], smallTargets: [] };

test('a clean row has no findings', () => {
  assert.deepEqual(rowFindings(clean), []);
});

test('unexpected redirect, navigation error, page error and overflow are findings', () => {
  assert.match(rowFindings({ ...clean, at: '/invite-not-found', expected: '/invite/ANNA' })[0], /^redirect: expected \/invite\/ANNA/);
  assert.match(rowFindings({ ...clean, navigationError: 'Timeout 20000ms' })[0], /^navigation/);
  assert.match(rowFindings({ ...clean, errors: ['TypeError: x is undefined'] })[0], /^page error/);
  assert.match(rowFindings({ ...clean, outside: [{ tag: 'DIV' }] })[0], /^overflow/);
});

test('small targets are findings only in strict mode', () => {
  const row = { ...clean, smallTargets: [{ label: 'x', width: 30, height: 30 }] };
  assert.deepEqual(rowFindings(row), []);
  assert.equal(rowFindings(row, { strictTargets: true }).length, 1);
});

test('declared redirects are verified, not ignored', () => {
  const redirects = { match: { to: '/chats', why: 'cold load has no match result' } };
  assert.equal(expectedPath('match', '/match', redirects), '/chats');
  assert.equal(expectedPath('chat', '/chat?match=1', redirects), '/chat');
  assert.deepEqual(rowFindings({ ...clean, name: 'match', expected: '/chats', at: '/chats' }), []);
  // Landing somewhere else than the declared target is still a finding.
  assert.equal(rowFindings({ ...clean, name: 'match', expected: '/chats', at: '/' }).length, 1);
});

test('redirect declarations need a target, a reason and a real screen', () => {
  const map = { match: ['/match', 1], chat: ['/chat?match=1', 1] };
  assert.deepEqual(validateExpectedRedirects(map, { match: { to: '/chats', why: 'cold load has no match result' } }), []);
  assert.equal(validateExpectedRedirects(map, { nope: { to: '/chats', why: 'cold load has no match result' } }).length, 1);
  assert.equal(validateExpectedRedirects(map, { match: { to: '/chats', why: '' } }).length, 1);
  assert.equal(validateExpectedRedirects(map, { match: { to: '/match', why: 'pointless self redirect here' } }).length, 1);
});

test('the shipped screen map declares only screens it contains, and no longer uses a fake invite code', () => {
  const src = fs.readFileSync(new URL('../../e2e/screen-map.mjs', import.meta.url), 'utf8');
  for (const [name, r] of Object.entries(expectedRedirects)) {
    assert.match(src, new RegExp(`['"]?${name}['"]?: \\[`), `${name} is not a screen in buildScreenMap`);
    assert.ok(r.why.length >= 10);
  }
  assert.doesNotMatch(src, /\/invite\/ANNA/);
  assert.match(src, /my_referral/);
});
