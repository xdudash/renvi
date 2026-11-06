import { expect, test } from 'bun:test';
import { decide, eventMs, eventUsers, presentedSecret } from '../functions/revenuecat-webhook/logic.ts';
import { secretMatches } from '../functions/_shared/secret.ts';
import { plusState } from '../functions/plus-sync/logic.ts';

const U1 = '11111111-2222-3333-4444-555555555555';
const U2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

test('webhook secret: header with or without Bearer matches; empty configuration refuses everything', () => {
  expect(secretMatches(presentedSecret('Bearer s3cret'), presentedSecret('s3cret'))).toBe(true);
  expect(secretMatches(presentedSecret('s3cret'), presentedSecret('Bearer s3cret'))).toBe(true);
  expect(secretMatches(presentedSecret('wrong'), presentedSecret('s3cret'))).toBe(false);
  expect(secretMatches(presentedSecret(null), presentedSecret('s3cret'))).toBe(false);
  expect(secretMatches(presentedSecret('Bearer '), presentedSecret(''))).toBe(false);
  expect(secretMatches(presentedSecret('anything'), undefined)).toBe(false);
});

test('events that change Plus ask for a sync of the named person', () => {
  for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION', 'UNCANCELLATION', 'EXPIRATION', 'BILLING_ISSUE', 'PRODUCT_CHANGE', 'REFUND_REVERSED']) {
    expect(decide({ id: 'e1', type, app_user_id: U1 })).toEqual({ action: 'sync', users: [U1] });
  }
});

test('refund arrives as a cancellation: it still syncs, and the state is read from the store, not from the body', () => {
  const d = decide({ id: 'e2', type: 'CANCELLATION', app_user_id: U1, product_id: 'renvi_plus_monthly' });
  expect(d.action).toBe('sync');
  // The store has already removed the entitlement: sync turns Plus off.
  const now = Date.parse('2026-11-06T12:00:00Z');
  expect(plusState({ entitlements: {} }, 'plus', now).expires).toBeNull();
});

test('transfers sync both sides, anonymous ids are skipped, duplicates collapse', () => {
  const d = decide({ id: 'e3', type: 'TRANSFER', app_user_id: U2, transferred_from: [U1, '$RCAnonymousID:abc'], transferred_to: [U2], aliases: [U2.toUpperCase()] });
  expect(d).toEqual({ action: 'sync', users: [U2, U1] });
});

test('test pings, unknown types, boosts and anonymous users are acknowledged without work', () => {
  expect(decide({ id: 't', type: 'TEST', app_user_id: U1 })).toEqual({ action: 'ignore', reason: 'test' });
  expect(decide({ id: 'x', type: 'SOMETHING_NEW', app_user_id: U1 })).toEqual({ action: 'ignore', reason: 'unknown_type' });
  expect(decide({ id: 'b', type: 'NON_RENEWING_PURCHASE', app_user_id: U1, product_id: 'renvi_boost_3h' })).toEqual({ action: 'ignore', reason: 'boost' });
  expect(decide({ id: 'a', type: 'RENEWAL', app_user_id: '$RCAnonymousID:abc' })).toEqual({ action: 'ignore', reason: 'no_user' });
});

test('malformed bodies are ignored, never crash', () => {
  expect(decide(null)).toEqual({ action: 'ignore', reason: 'bad_event' });
  expect(decide({})).toEqual({ action: 'ignore', reason: 'bad_event' });
  expect(decide({ type: 'RENEWAL', app_user_id: U1 })).toEqual({ action: 'ignore', reason: 'bad_event' });
  expect(eventUsers({ app_user_id: 'not-a-uuid' })).toEqual([]);
});

test('event time: the sender value when sane, otherwise the receive time', () => {
  expect(eventMs({ event_timestamp_ms: 1762430000000 }, 5)).toBe(1762430000000);
  expect(eventMs({ event_timestamp_ms: 0 }, 5)).toBe(5);
  expect(eventMs({}, 5)).toBe(5);
});

test('an active renewal carries the store expiry and keeps the trial flag', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const s = plusState({ entitlements: { plus: { expires_date: '2026-12-06T12:00:00Z', product_identifier: 'renvi_plus_monthly' } }, subscriptions: { renvi_plus_monthly: { period_type: 'trial' } } }, 'plus', now);
  expect(s).toEqual({ expires: '2026-12-06T12:00:00.000Z', product: 'renvi_plus_monthly', trial: true });
  // Expiry event: the entitlement date is in the past.
  expect(plusState({ entitlements: { plus: { expires_date: '2026-11-06T11:00:00Z' } } }, 'plus', now).expires).toBeNull();
});
