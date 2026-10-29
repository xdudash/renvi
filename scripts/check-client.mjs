// Node-runnable checks for the pure client logic fixed in the external audit (no test runner, no config needed).
// Run: node scripts/check-client.mjs   (Node >= 22.6 type stripping, same as check-i18n.mjs)
import assert from 'node:assert/strict';

const load = (p) => import(new URL(`../src/lib/${p}.ts`, import.meta.url).href);
const { parseRecoveryUrl, planRecovery } = await load('recovery');
const { createOutbox, withLock, reconcile, outboxKey } = await load('outbox');
const { mergeSnapshot } = await load('snapshot');
const { gateTarget, RESTRICTED_OK } = await load('gateRoutes');

let n = 0;
const ok = (name, fn) => Promise.resolve(fn()).then(() => { n++; }, (e) => { console.error(`FAIL ${name}`); throw e; });

// C1: recovery links
await ok('recovery pkce code', () => assert.deepEqual(planRecovery('renvi://reset-password?code=abc123'), { kind: 'exchange', code: 'abc123' }));
await ok('recovery token_hash', () => assert.deepEqual(planRecovery('https://x.app/reset-password?token_hash=h&type=recovery'), { kind: 'verify', tokenHash: 'h' }));
await ok('recovery implicit fragment', () => assert.deepEqual(
  planRecovery('renvi://reset-password#access_token=a.b.c&refresh_token=r&expires_in=3600&type=recovery'),
  { kind: 'setSession', accessToken: 'a.b.c', refreshToken: 'r' }));
await ok('recovery expired link', () => assert.equal(planRecovery('https://x.app/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired').kind, 'invalid'));
await ok('recovery wrong type ignored', () => assert.equal(planRecovery('x://r#access_token=a&refresh_token=b&type=signup').kind, 'none'));
await ok('recovery empty', () => { assert.equal(planRecovery(null).kind, 'none'); assert.deepEqual(parseRecoveryUrl(''), {}); });

// C2: banned / suspended users keep data-rights screens
const banned = { onboarding_done: true, suspended_until: 'infinity' };
const suspended = { onboarding_done: true, suspended_until: new Date(Date.now() + 86400000).toISOString() };
for (const p of ['/delete-account', '/delete-confirm', '/privacy-data', '/data-export', '/appeal', '/support-help', '/support-share', '/report-status']) {
  await ok(`gate banned ${p}`, () => assert.equal(gateTarget(p, true, banned), null));
  await ok(`gate suspended ${p}`, () => assert.equal(gateTarget(p, true, suspended), null));
}
await ok('gate banned discover', () => assert.equal(gateTarget('/discover', true, banned), '/account-banned'));
await ok('gate suspended chats', () => assert.equal(gateTarget('/chats', true, suspended), '/account-suspended'));
await ok('gate signed out reset-password public', () => assert.equal(gateTarget('/reset-password', false, null), null));
await ok('gate signed out private', () => assert.equal(gateTarget('/discover', false, null), '/'));
// C7: failed profile load must not send an existing user to onboarding
await ok('gate load error keeps user', () => assert.equal(gateTarget('/discover', true, null, true), null));
await ok('gate no profile row -> onboarding', () => assert.equal(gateTarget('/discover', true, null, false), '/ob-age'));
await ok('restricted list has no duplicates', () => assert.equal(new Set(RESTRICTED_OK).size, RESTRICTED_OK.length));

// C7: snapshot merge keeps last good state for the same user only
const held = { userId: 'u1', profile: { id: 'u1', onboarding_done: true }, tier: 'plus', productId: 'renvi_plus_year' };
await ok('merge failure keeps profile+tier', () => assert.deepEqual(mergeSnapshot(held, { userId: 'u1', failed: true }), { ...held, loadError: true }));
await ok('merge partial failure', () => assert.deepEqual(mergeSnapshot(held, { userId: 'u1', profile: { id: 'u1', n: 2 }, failed: true }).tier, 'plus'));
await ok('merge other user drops old data', () => assert.deepEqual(mergeSnapshot(held, { userId: 'u2', failed: true }), { userId: 'u2', profile: null, tier: 'free', productId: null, loadError: true }));
await ok('merge sign-out clears', () => assert.deepEqual(mergeSnapshot(held, { userId: null, failed: false }), { userId: null, profile: null, tier: 'free', productId: null, loadError: false }));
await ok('merge failure keeps productId (billing period)', () => assert.equal(mergeSnapshot(held, { userId: 'u1', failed: true }).productId, 'renvi_plus_year'));
await ok('merge success replaces', () => assert.equal(mergeSnapshot(held, { userId: 'u1', profile: null, tier: 'free', failed: false }).profile, null));

// C4: mutex serialises tasks; C3: add-before-send / remove-on-confirm; C12: per-user keys
const mem = new Map();
const store = {
  getItem: async (k) => { await new Promise((r) => setTimeout(r, Math.random() * 3)); return mem.get(k) ?? null; },
  setItem: async (k, v) => { await new Promise((r) => setTimeout(r, Math.random() * 3)); mem.set(k, v); },
};
const box = createOutbox(store);
const msg = (i, m = 'm1') => ({ client_id: `c${i}`, match_id: m, body: `hi ${i}`, photo_path: null, created_at: new Date(i).toISOString() });
await ok('withLock runs in order', async () => {
  const order = [];
  await Promise.all([1, 2, 3].map((i) => withLock('k', async () => { await new Promise((r) => setTimeout(r, 10 - i * 3)); order.push(i); })));
  assert.deepEqual(order, [1, 2, 3]);
});
await ok('withLock survives a failing task', async () => {
  const bad = withLock('k2', async () => { throw new Error('x'); });
  const good = withLock('k2', async () => 'fine');
  await assert.rejects(bad);
  assert.equal(await good, 'fine');
});
await ok('concurrent adds lose nothing (C4)', async () => {
  await Promise.all(Array.from({ length: 25 }, (_, i) => box.add('userA', msg(i))));
  assert.equal((await box.list('userA')).length, 25);
});
await ok('add is idempotent by client_id', async () => { await box.add('userA', msg(1)); assert.equal((await box.list('userA')).length, 25); });
await ok('concurrent add + remove', async () => {
  await Promise.all([box.remove('userA', ['c0', 'c1']), box.add('userA', msg(100)), box.remove('userA', ['c2']), box.add('userA', msg(101))]);
  const ids = (await box.list('userA')).map((p) => p.client_id);
  assert.equal(ids.length, 24); assert.ok(ids.includes('c100') && ids.includes('c101') && !ids.includes('c0') && !ids.includes('c2'));
});
await ok('persist before send, remove only on confirmation (C3)', async () => {
  const events = [];
  const send = async (fail) => {
    const p = msg(200, 'm9');
    await box.add('userB', p); events.push('stored');
    events.push((await box.list('userB', 'm9')).length === 1 ? 'in-outbox-during-request' : 'MISSING');
    if (fail) { events.push('failed'); return; }
    events.push('confirmed'); await box.remove('userB', [p.client_id]);
  };
  await send(true);
  assert.equal((await box.list('userB', 'm9')).length, 1); // failure keeps it
  await box.remove('userB', ['c200']);
  await send(false);
  assert.equal((await box.list('userB', 'm9')).length, 0);
  assert.deepEqual(events.slice(0, 3), ['stored', 'in-outbox-during-request', 'failed']);
});
await ok('outbox is keyed per user (C12)', async () => {
  assert.notEqual(outboxKey('userA'), outboxKey('userB'));
  assert.equal((await box.list('userC')).length, 0);
});
await ok('corrupt storage reads as empty', async () => { mem.set(outboxKey('bad'), '{not json'); assert.deepEqual(await box.list('bad'), []); });
await ok('reconcile drops delivered items (C5)', () => {
  const r = reconcile([msg(1), msg(2)], ['c2', 'zz']);
  assert.deepEqual(r.unsent.map((p) => p.client_id), ['c1']);
  assert.deepEqual(r.delivered, ['c2']);
});

// Resend cooldown from the Auth rate-limit answer
{
  const { resendWaitSeconds } = await load('authRate');
  await ok('resend 429 reads seconds', () => assert.equal(resendWaitSeconds({ status: 429, message: 'For security purposes, you can only request this after 42 seconds.' }), 42));
  await ok('resend rate code without seconds → 60', () => assert.equal(resendWaitSeconds({ code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }), 60));
  await ok('resend other error → null', () => assert.equal(resendWaitSeconds({ status: 400, message: 'Invalid email' }), null));
  await ok('resend no error → null', () => assert.equal(resendWaitSeconds(null), null));
}

console.log(`client checks ok (${n})`);
