import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDemoAccess } from '../../supabase/functions/demo-access/logic.ts';

const id = '00000000-0000-0000-0000-000000000201';
const email = 'existing@demo.renvi.app';
const password = () => `Demo-${crypto.randomUUID().slice(0, 12)}`;
function fixture(overrides = {}) {
  const events = [];
  const deps = {
    authorize: async () => { events.push('authorize'); return 'admin-id'; },
    eligible: async () => ({ id, email }),
    authUser: async () => ({ id, email }),
    stillEligible: async () => true,
    reserve: async (actor, target) => { events.push(['reserve', actor, target]); return 42; },
    updatePassword: async (uid, value) => { events.push(['reset', uid, value]); },
    finish: async (audit, status) => { events.push(['finish', audit, status]); },
    ...overrides,
  };
  return { deps, events };
}
test('rejects non-admin before querying accounts or resetting', async () => {
  const f = fixture({ authorize: async () => null, eligible: async () => assert.fail('must not query') });
  assert.deepEqual(await resetDemoAccess({ userId: id, password: password() }, f.deps), { status: 403, error: 'forbidden' });
  assert.equal(f.events.length, 0);
});
test('validates target and UTF-8 password bounds', async () => {
  for (const body of [{}, { userId: 'bad', password: password() }, { userId: id, password: 'short' }, { userId: id, password: 'é'.repeat(37) }]) {
    const f = fixture();
    assert.equal((await resetDemoAccess(body, f.deps)).status, 400);
    assert.equal(f.events.length, 1);
  }
});
test('never resets non-demo, admin, changed email or wrong auth identity', async () => {
  for (const overrides of [
    { eligible: async () => null },
    { eligible: async () => ({ id, email: 'real@example.com' }) },
    { authUser: async () => ({ id, email: 'other@demo.renvi.app' }) },
    { authUser: async () => ({ id: 'other', email }) },
    { stillEligible: async () => false },
  ]) {
    const f = fixture(overrides);
    assert.equal((await resetDemoAccess({ userId: id, password: password() }, f.deps)).status, 403);
    assert.equal(f.events.length, 1);
  }
});
test('reserves password-free audit before resetting and confirms success', async () => {
  const f = fixture(); const value = password();
  const result = await resetDemoAccess({ userId: id, password: value }, f.deps);
  assert.deepEqual(result, { status: 200, email, auditPending: false });
  assert.deepEqual(f.events.map(e => Array.isArray(e) ? e[0] : e), ['authorize', 'reserve', 'reset', 'finish']);
  assert.equal(JSON.stringify(f.events.filter(e => Array.isArray(e) && e[0] !== 'reset')).includes(value), false);
});
test('refuses reset if audit cannot be reserved', async () => {
  const f = fixture({ reserve: async () => { throw new Error('db'); } });
  assert.equal((await resetDemoAccess({ userId: id, password: password() }, f.deps)).error, 'audit_unavailable');
  assert.deepEqual(f.events, ['authorize']);
});
test('failed reset is audited and never reported as success', async () => {
  const f = fixture({ updatePassword: async () => { throw new Error('auth'); } });
  assert.equal((await resetDemoAccess({ userId: id, password: password() }, f.deps)).error, 'reset_unconfirmed');
  assert.deepEqual(f.events.at(-1), ['finish', 42, 'unconfirmed']);
});
test('completed reset remains usable if final audit write fails', async () => {
  const f = fixture({ finish: async () => { throw new Error('db'); } });
  assert.deepEqual(await resetDemoAccess({ userId: id, password: password() }, f.deps), { status: 200, email, auditPending: true });
});
test('blocks identity or admin membership changes during audit reservation', async () => {
  for (const changedField of ['email', 'membership']) {
    let reserved = false;
    const f = fixture({
      reserve: async () => { reserved = true; return 42; },
      authUser: async () => ({ id, email: reserved && changedField === 'email' ? 'real@example.com' : email }),
      stillEligible: async () => !(reserved && changedField === 'membership'),
    });
    assert.deepEqual(await resetDemoAccess({ userId: id, password: password() }, f.deps), { status: 403, error: 'ineligible' });
    assert.deepEqual(f.events, ['authorize', ['finish', 42, 'denied']]);
  }
});
