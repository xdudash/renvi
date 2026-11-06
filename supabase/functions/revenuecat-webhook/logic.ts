// Pure part of revenuecat-webhook (unit-tested). The event body is only a SIGNAL: access is always decided from the
// subscriber record fetched from RevenueCat (see plusState in plus-sync), so a replayed, forged-in-body or out-of-order
// event can never grant or remove Plus by itself.
import { BOOSTS } from '../boost-sync/logic.ts';

export type RcEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  product_id?: string;
  event_timestamp_ms?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Events that can change the Plus entitlement (purchase, renewal, cancel/uncancel, expiry, refund, billing problems,
// pause, extension, transfer between app user ids, promotional grants).
export const SYNC_TYPES = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'CANCELLATION', 'UNCANCELLATION', 'EXPIRATION', 'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED', 'SUBSCRIPTION_EXTENDED', 'REFUND_REVERSED', 'TRANSFER', 'NON_RENEWING_PURCHASE',
  'TEMPORARY_ENTITLEMENT_GRANT', 'INVOICE_ISSUANCE',
]);

export type Decision =
  | { action: 'ignore'; reason: 'test' | 'unknown_type' | 'boost' | 'no_user' | 'bad_event' }
  | { action: 'sync'; users: string[] };

/** Supabase user ids named by the event (RevenueCat app user id = Supabase user id; anonymous ids are skipped). */
export function eventUsers(e: RcEvent): string[] {
  const all = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? []), ...(e.transferred_from ?? []), ...(e.transferred_to ?? [])];
  return [...new Set(all.filter((x): x is string => typeof x === 'string' && UUID.test(x)).map((x) => x.toLowerCase()))];
}

export function decide(e: RcEvent | null | undefined): Decision {
  if (!e || typeof e.id !== 'string' || !e.id || typeof e.type !== 'string') return { action: 'ignore', reason: 'bad_event' };
  if (e.type === 'TEST') return { action: 'ignore', reason: 'test' };
  if (!SYNC_TYPES.has(e.type)) return { action: 'ignore', reason: 'unknown_type' };
  // Plan boosts are consumables applied by boost-sync (the app knows which plan); nothing to do for Plus.
  if (e.product_id && e.product_id in BOOSTS) return { action: 'ignore', reason: 'boost' };
  const users = eventUsers(e);
  if (!users.length) return { action: 'ignore', reason: 'no_user' };
  return { action: 'sync', users };
}

/** Header value from RevenueCat: the configured Authorization value, with or without the "Bearer " prefix. */
export function presentedSecret(header: string | null): string | null {
  if (!header) return null;
  const h = header.trim();
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : h;
}

export function eventMs(e: RcEvent, fallback: number): number {
  const n = Number(e.event_timestamp_ms);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
