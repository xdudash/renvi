// revenuecat-webhook logic with an in-memory fake DB, plus the app-side billing helpers. Run by scripts/test-db.sh.
import { describe, expect, test } from 'bun:test';
import { type BillingDb, DbError, handleEvent, type SubRow, tierOf, userIdOf } from '../functions/revenuecat-webhook/logic.ts';
import { canContinue, periodOfProduct, purchaseVerdict, serverTier } from '../../src/lib/billing.ts';

const A = '00000000-0000-4000-8000-0000000000aa';
const B = '00000000-0000-4000-8000-0000000000bb';
const NOW = Date.parse('2026-10-29T12:00:00Z');
const DAY = 86_400_000;
const FUTURE = NOW + 30 * DAY;

type FailOn = Partial<Record<keyof BillingDb, string | undefined>>;

class FakeDb implements BillingDb {
  subs = new Map<string, SubRow>();
  events = new Map<string, { type: string }>();
  writes = 0;
  failOn: FailOn = {};
  failUpsertFor: string | null = null;
  knownUsers: Set<string> | null = null; // null = every uuid exists

  private check(op: keyof BillingDb) {
    const code = this.failOn[op];
    if (code !== undefined) throw new DbError(`${op} failed`, code || undefined);
  }
  async isProcessed(id: string) { this.check('isProcessed'); return this.events.has(id); }
  async markProcessed(e: { id: string; type: string }) {
    this.check('markProcessed');
    if (!this.events.has(e.id)) this.events.set(e.id, { type: e.type });
  }
  async getSub(id: string) { this.check('getSub'); const r = this.subs.get(id); return r ? { ...r } : null; }
  async upsertSub(row: SubRow) {
    this.check('upsertSub');
    if (this.failUpsertFor === row.user_id) throw new DbError('write failed', '08006');
    if (this.knownUsers && !this.knownUsers.has(row.user_id)) throw new DbError('fk', '23503');
    this.writes++;
    this.subs.set(row.user_id, { ...row });
  }
}

let seq = 0;
const ev = (type: string, extra: Record<string, unknown> = {}) => ({
  id: `evt-${++seq}`, type, event_timestamp_ms: NOW + seq, app_user_id: A, environment: 'PRODUCTION', store: 'APP_STORE',
  product_id: 'renvi.plus.month', entitlement_ids: ['plus'], expiration_at_ms: FUTURE, ...extra,
});
const paid = (user: string, tier: 'plus' | 'premium', extra: Partial<SubRow> = {}): SubRow => ({
  user_id: user, tier, store: 'app_store', sandbox: false, expires_at: new Date(FUTURE).toISOString(),
  product_id: `renvi.${tier}.month`, last_event_ms: NOW, ...extra,
});

describe('normal paths', () => {
  test('INITIAL_PURCHASE grants the entitlement tier with expiry, product and store', async () => {
    const db = new FakeDb();
    const r = await handleEvent(ev('INITIAL_PURCHASE', { environment: 'SANDBOX' }), db, NOW);
    expect(r.status).toBe(200);
    expect(db.subs.get(A)).toMatchObject({ tier: 'plus', store: 'app_store', sandbox: true, product_id: 'renvi.plus.month',
      expires_at: new Date(FUTURE).toISOString() });
  });

  test('RENEWAL moves the expiry and can switch product / tier (product change taking effect)', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'plus'));
    const r = await handleEvent(ev('RENEWAL', { entitlement_ids: ['premium'], product_id: 'renvi.premium.year', expiration_at_ms: FUTURE + 365 * DAY }), db, NOW);
    expect(r.status).toBe(200);
    expect(db.subs.get(A)).toMatchObject({ tier: 'premium', product_id: 'renvi.premium.year', expires_at: new Date(FUTURE + 365 * DAY).toISOString() });
  });

  test('PRODUCT_CHANGE is informative and does not touch the plan', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'premium'));
    const r = await handleEvent(ev('PRODUCT_CHANGE', { entitlement_ids: ['plus'], new_product_id: 'renvi.plus.month' }), db, NOW);
    expect(r.status).toBe(200);
    expect(db.subs.get(A)?.tier).toBe('premium');
    expect(db.writes).toBe(0);
  });

  test('CANCELLATION keeps access until the paid period ends', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'plus', { product_id: 'renvi.plus.month' }));
    const r = await handleEvent(ev('CANCELLATION', { cancel_reason: 'UNSUBSCRIBE' }), db, NOW);
    expect(r.status).toBe(200);
    expect(db.subs.get(A)?.tier).toBe('plus');
    expect(db.writes).toBe(0);
  });

  test('CANCELLATION of a refund (expiry already past) removes access', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'plus', { product_id: 'renvi.plus.month' }));
    await handleEvent(ev('CANCELLATION', { cancel_reason: 'CUSTOMER_SUPPORT', expiration_at_ms: NOW - 1000 }), db, NOW);
    expect(db.subs.get(A)?.tier).toBe('free');
  });

  test('EXPIRATION sets free; BILLING_ISSUE does not', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'plus', { product_id: 'renvi.plus.month' }));
    await handleEvent(ev('BILLING_ISSUE'), db, NOW);
    expect(db.subs.get(A)?.tier).toBe('plus');
    const r = await handleEvent(ev('EXPIRATION', { expiration_reason: 'UNSUBSCRIBE' }), db, NOW);
    expect(r.status).toBe(200);
    expect(db.subs.get(A)).toMatchObject({ tier: 'free', expires_at: null, product_id: null });
  });

  test('EXPIRATION of an old product does not remove the newer plan (Google upgrade = new purchase)', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'premium', { product_id: 'renvi.premium.month' }));
    await handleEvent(ev('EXPIRATION', { product_id: 'renvi.plus.month' }), db, NOW);
    expect(db.subs.get(A)?.tier).toBe('premium');
  });

  test('an event older than the last applied one is ignored (out-of-order delivery)', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'plus', { last_event_ms: NOW + 1_000_000 }));
    await handleEvent(ev('EXPIRATION'), db, NOW);
    expect(db.subs.get(A)?.tier).toBe('plus');
  });

  test('events without a mapped entitlement, or for a non-uuid user, change nothing', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'premium'));
    expect((await handleEvent(ev('NON_RENEWING_PURCHASE', { entitlement_ids: null }), db, NOW)).status).toBe(200);
    expect((await handleEvent(ev('INITIAL_PURCHASE', { app_user_id: '$RCAnonymousID:x', original_app_user_id: '$RCAnonymousID:x', aliases: [] }), db, NOW)).status).toBe(200);
    expect(db.writes).toBe(0);
    expect(db.subs.get(A)?.tier).toBe('premium');
  });

  test('TEST event is acknowledged', async () => {
    const r = await handleEvent({ id: 'test-1', type: 'TEST', event_timestamp_ms: NOW }, new FakeDb(), NOW);
    expect(r.status).toBe(200);
  });

  test('bad payloads are 400', async () => {
    expect((await handleEvent(null, new FakeDb(), NOW)).status).toBe(400);
    expect((await handleEvent({ type: 'RENEWAL' }, new FakeDb(), NOW)).status).toBe(400);
  });
});

describe('B1: idempotency and TRANSFER', () => {
  test('duplicate event id → 200 no-op', async () => {
    const db = new FakeDb();
    const e = ev('INITIAL_PURCHASE');
    expect((await handleEvent(e, db, NOW)).status).toBe(200);
    const writes = db.writes;
    // Meanwhile the plan expired; a replay of the old purchase must not resurrect it.
    db.subs.set(A, { ...db.subs.get(A)!, tier: 'free', expires_at: null });
    const r = await handleEvent(e, db, NOW);
    expect(r).toEqual({ status: 200, body: { ok: true, duplicate: true } });
    expect(db.writes).toBe(writes);
    expect(db.subs.get(A)?.tier).toBe('free');
  });

  test('TRANSFER A→B moves the plan; replaying the identical event does not downgrade B', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'premium'));
    const t = { id: 'transfer-1', type: 'TRANSFER', event_timestamp_ms: NOW, transferred_from: [A], transferred_to: [B], store: 'APP_STORE' };
    expect((await handleEvent(t, db, NOW)).status).toBe(200);
    expect(db.subs.get(B)).toMatchObject({ tier: 'premium', product_id: 'renvi.premium.month', user_id: B });
    expect(db.subs.get(A)?.tier).toBe('free');

    expect((await handleEvent(t, db, NOW)).status).toBe(200);           // same id: deduplicated
    expect(db.subs.get(B)?.tier).toBe('premium');
    db.events.clear();                                                  // even if the id store were lost:
    expect((await handleEvent(t, db, NOW)).status).toBe(200);
    expect(db.subs.get(B)?.tier).toBe('premium');
    expect(db.subs.get(A)?.tier).toBe('free');
  });

  test('TRANSFER never downgrades a recipient that already has a better plan', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'plus'));
    db.subs.set(B, paid(B, 'premium'));
    await handleEvent({ id: 'transfer-2', type: 'TRANSFER', event_timestamp_ms: NOW, transferred_from: [A], transferred_to: [B] }, db, NOW);
    expect(db.subs.get(B)?.tier).toBe('premium');
    expect(db.subs.get(A)?.tier).toBe('free');
  });

  test('TRANSFER does not move an admin-granted promo row (not a store purchase)', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'plus', { store: null, product_id: null }));
    await handleEvent({ id: 'transfer-3', type: 'TRANSFER', event_timestamp_ms: NOW, transferred_from: [A], transferred_to: [B] }, db, NOW);
    expect(db.subs.get(A)?.tier).toBe('plus');
    expect(db.subs.has(B)).toBe(false);
  });

  test('TRANSFER whose recipient write fails → 500 and the source is NOT cleared, so the retry still works', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'premium'));
    db.failUpsertFor = B;
    const t = { id: 'transfer-4', type: 'TRANSFER', event_timestamp_ms: NOW, transferred_from: [A], transferred_to: [B] };
    expect((await handleEvent(t, db, NOW)).status).toBe(500);
    expect(db.subs.get(A)?.tier).toBe('premium');
    expect(db.events.has('transfer-4')).toBe(false);
    db.failUpsertFor = null;
    expect((await handleEvent(t, db, NOW)).status).toBe(200);
    expect(db.subs.get(B)?.tier).toBe('premium');
  });

  test('TRANSFER whose source clear fails → 500; the retry keeps B paid and clears A', async () => {
    const db = new FakeDb();
    db.subs.set(A, paid(A, 'plus'));
    db.failUpsertFor = A;
    const t = { id: 'transfer-5', type: 'TRANSFER', event_timestamp_ms: NOW, transferred_from: [A], transferred_to: [B] };
    expect((await handleEvent(t, db, NOW)).status).toBe(500);
    expect(db.subs.get(B)?.tier).toBe('plus');
    db.failUpsertFor = null;
    expect((await handleEvent(t, db, NOW)).status).toBe(200);
    expect(db.subs.get(B)?.tier).toBe('plus');
    expect(db.subs.get(A)?.tier).toBe('free');
  });
});

describe('B2: database failures are not swallowed', () => {
  for (const op of ['isProcessed', 'getSub', 'upsertSub', 'markProcessed'] as const) {
    test(`${op} failure → 500 and the event is not recorded as processed`, async () => {
      const db = new FakeDb();
      db.subs.set(A, paid(A, 'plus'));
      db.failOn[op] = '';
      const e = ev('RENEWAL', { entitlement_ids: ['premium'] });
      const r = await handleEvent(e, db, NOW);
      expect(r.status).toBe(500);
      expect(db.events.has(e.id)).toBe(false);
      // RevenueCat retries with the same id once the database is back: applied exactly once.
      db.failOn = {};
      expect((await handleEvent(e, db, NOW)).status).toBe(200);
      expect(db.subs.get(A)?.tier).toBe('premium');
      expect(db.events.has(e.id)).toBe(true);
    });
  }

  test('deleted account (foreign key violation) → 200 so RevenueCat stops retrying', async () => {
    const db = new FakeDb();
    db.knownUsers = new Set();
    const r = await handleEvent(ev('INITIAL_PURCHASE'), db, NOW);
    expect(r.status).toBe(200);
    expect(r.body.result).toBe('unknown_user');
  });
});

test('helpers: tierOf, userIdOf', () => {
  expect(tierOf(['plus', 'premium'])).toBe('premium');
  expect(tierOf(['plus'])).toBe('plus');
  expect(tierOf(null)).toBe('free');
  expect(userIdOf({ app_user_id: '$RCAnonymousID:1', original_app_user_id: A.toUpperCase() })).toBe(A);
  expect(userIdOf({ app_user_id: 'x', aliases: ['y', B] })).toBe(B);
  expect(userIdOf({ app_user_id: 'x' })).toBeNull();
});

describe('app: purchase confirmation (B3) and plan screen (B4)', () => {
  const sub = (tier: string, product_id: string | null = null, expires_at: string | null = new Date(FUTURE).toISOString()) => ({ tier, product_id, expires_at });

  test('upgrade is confirmed only when the server tier matches', () => {
    const e = { tier: 'premium' as const, productId: 'renvi.premium.month', previousTier: 'plus' as const, previousProduct: 'renvi.plus.month' };
    expect(purchaseVerdict(e, sub('plus', 'renvi.plus.month'), NOW, false)).toBe('waiting');
    expect(purchaseVerdict(e, sub('plus', 'renvi.plus.month'), NOW, true)).toBe('waiting');
    expect(purchaseVerdict(e, sub('premium', 'renvi.premium.month'), NOW, false)).toBe('confirmed');
    expect(purchaseVerdict(e, sub('premium', 'renvi.premium.month', new Date(NOW - 1).toISOString()), NOW, true)).toBe('waiting');
  });

  test('first purchase from free waits for the server', () => {
    const e = { tier: 'plus' as const, productId: 'renvi.plus.month', previousTier: 'free' as const, previousProduct: null };
    expect(purchaseVerdict(e, sub('free'), NOW, true)).toBe('waiting');
    expect(purchaseVerdict(e, sub('plus', 'renvi.plus.month'), NOW, false)).toBe('confirmed');
  });

  test('period change within the tier needs the new product; deferred change is reported as scheduled', () => {
    const e = { tier: 'plus' as const, productId: 'renvi.plus.year', previousTier: 'plus' as const, previousProduct: 'renvi.plus.month' };
    expect(purchaseVerdict(e, sub('plus', 'renvi.plus.month'), NOW, false)).toBe('waiting');
    expect(purchaseVerdict(e, sub('plus', 'renvi.plus.month'), NOW, true)).toBe('scheduled');
    expect(purchaseVerdict(e, sub('plus', 'renvi.plus.year'), NOW, false)).toBe('confirmed');
  });

  test('downgrade the store applies at renewal is scheduled, not success', () => {
    const e = { tier: 'plus' as const, productId: 'renvi.plus.month', previousTier: 'premium' as const, previousProduct: 'renvi.premium.month' };
    expect(purchaseVerdict(e, sub('premium', 'renvi.premium.month'), NOW, false)).toBe('waiting');
    expect(purchaseVerdict(e, sub('premium', 'renvi.premium.month'), NOW, true)).toBe('scheduled');
    expect(purchaseVerdict(e, sub('plus', 'renvi.plus.month'), NOW, false)).toBe('confirmed');
  });

  test('serverTier treats an expired row as free', () => {
    expect(serverTier(sub('plus', null, new Date(NOW - 1).toISOString()), NOW)).toBe('free');
    expect(serverTier(sub('premium', null, null), NOW)).toBe('premium');
    expect(serverTier(null, NOW)).toBe('free');
  });

  test('Continue allows Plus month → Plus year but not the same plan and period', () => {
    const offers = [{ period: 'month' as const, productId: 'renvi.plus.month' }, { period: 'year' as const, productId: 'renvi.plus.year' }];
    const cur = periodOfProduct('renvi.plus.month', offers);
    expect(cur).toBe('month');
    expect(canContinue('plus', 'plus', cur, 'year')).toBe(true);
    expect(canContinue('plus', 'plus', cur, 'month')).toBe(false);
    expect(canContinue('premium', 'plus', cur, 'month')).toBe(true);
    expect(canContinue('free', 'free', null, 'month')).toBe(false);
    expect(canContinue('plus', 'plus', periodOfProduct('unknown', offers), 'month')).toBe(true);
  });
});
