import { expect, test } from 'bun:test';
import { plusState } from '../functions/plus-sync/logic.ts';
import { boostPurchases } from '../functions/boost-sync/logic.ts';

const now = Date.parse('2026-11-06T12:00:00Z');

test('plus: no record or no entitlement is Free', () => {
  expect(plusState(null, 'plus', now).expires).toBeNull();
  expect(plusState({}, 'plus', now).expires).toBeNull();
  expect(plusState({ entitlements: { playbook: { expires_date: '2027-01-01T00:00:00Z' } } }, 'plus', now).expires).toBeNull();
});

test('plus: an expired entitlement is Free, an active one carries its expiry', () => {
  expect(plusState({ entitlements: { plus: { expires_date: '2026-11-06T11:59:59Z' } } }, 'plus', now).expires).toBeNull();
  const s = plusState({ entitlements: { plus: { expires_date: '2026-12-01T00:00:00Z', product_identifier: 'renvi_plus_monthly' } } }, 'plus', now);
  expect(s.expires).toBe('2026-12-01T00:00:00.000Z');
  expect(s.product).toBe('renvi_plus_monthly');
  expect(s.trial).toBe(false);
});

test('plus: a trial period is reported as a trial', () => {
  const s = plusState({
    entitlements: { plus: { expires_date: '2026-11-13T00:00:00Z', product_identifier: 'renvi_plus_monthly' } },
    subscriptions: { renvi_plus_monthly: { period_type: 'trial', expires_date: '2026-11-13T00:00:00Z' } },
  }, 'plus', now);
  expect(s.trial).toBe(true);
});

test('plus: a lifetime promotional grant never expires', () => {
  const s = plusState({ entitlements: { plus: { expires_date: null } } }, 'plus', now);
  expect(s.expires).not.toBeNull();
});

test('boost: only boost products are returned, with their hours and transaction ids', () => {
  const list = boostPurchases({ non_subscriptions: {
    renvi_boost_3h: [{ id: 'a', store_transaction_id: 'tx-a' }, { id: 'b' }],
    renvi_boost_24h: [{ id: 'c', store_transaction_id: 'tx-c' }],
    renvi_playbook: [{ id: 'd' }],
  } });
  expect(list).toEqual([
    { tx: 'tx-a', product: 'renvi_boost_3h', hours: 3 },
    { tx: 'b', product: 'renvi_boost_3h', hours: 3 },
    { tx: 'tx-c', product: 'renvi_boost_24h', hours: 24 },
  ]);
  expect(boostPurchases(null)).toEqual([]);
});
