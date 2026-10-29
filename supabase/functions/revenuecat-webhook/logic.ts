// Pure logic of the revenuecat-webhook Edge Function (no Deno / network APIs, so `bun test` can import it).
// Event fields: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
//  - every event: id (retries reuse the same id and event_timestamp_ms), type, event_timestamp_ms
//  - lifecycle events: app_user_id, original_app_user_id, aliases, product_id, entitlement_ids (may be null),
//    expiration_at_ms (may be null), environment (SANDBOX | PRODUCTION), store
//  - TRANSFER: only transferred_from / transferred_to (string arrays), store/environment sometimes; NO
//    entitlement_ids / expiration_at_ms / product_id. Sent only for the destination user.
//  - PRODUCT_CHANGE is informative: the change takes effect with a later RENEWAL (Apple) / INITIAL_PURCHASE (Google).

export type Tier = 'free' | 'plus' | 'premium';

export type SubRow = {
  user_id: string;
  tier: Tier;
  store: 'app_store' | 'play_store' | null;
  sandbox: boolean;
  expires_at: string | null;
  product_id: string | null;
  last_event_ms: number | null;
};

/** Thrown by a BillingDb implementation when a read or write fails. */
export class DbError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

/** Storage used by the handler. Every method throws DbError on failure (never swallows an error). */
export interface BillingDb {
  isProcessed(eventId: string): Promise<boolean>;
  markProcessed(e: { id: string; type: string; user_id: string | null; event_ms: number | null }): Promise<void>;
  getSub(userId: string): Promise<SubRow | null>;
  upsertSub(row: SubRow): Promise<void>;
}

export type Result = { status: number; body: Record<string, unknown> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const RANK: Record<Tier, number> = { free: 0, plus: 1, premium: 2 };
/** Postgres foreign_key_violation: the user no longer exists (account deleted). */
const FK_VIOLATION = '23503';

export function tierOf(ids: unknown): Tier {
  const list = Array.isArray(ids) ? ids : [];
  if (list.includes('premium')) return 'premium';
  if (list.includes('plus')) return 'plus';
  return 'free';
}

export function storeOf(store: unknown): SubRow['store'] {
  return store === 'APP_STORE' ? 'app_store' : store === 'PLAY_STORE' ? 'play_store' : null;
}

/** Tier the row gives right now (an expired paid row counts as free). */
export function activeTier(row: Pick<SubRow, 'tier' | 'expires_at'> | null, nowMs: number): Tier {
  if (!row) return 'free';
  if (row.expires_at && Date.parse(row.expires_at) <= nowMs) return 'free';
  return row.tier;
}

/** Supabase user id of the event: app_user_id, else original_app_user_id, else the first uuid alias. */
export function userIdOf(event: Record<string, any>): string | null {
  if (isUuid(event.app_user_id)) return event.app_user_id.toLowerCase();
  if (isUuid(event.original_app_user_id)) return event.original_app_user_id.toLowerCase();
  const alias = Array.isArray(event.aliases) ? event.aliases.find(isUuid) : undefined;
  return alias ? alias.toLowerCase() : null;
}

const uuids = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter(isUuid).map((s) => s.toLowerCase()))] : [];

const iso = (ms: unknown) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** True when the event is older than the newest event already applied to this row. */
const stale = (row: SubRow | null, eventMs: number | null) =>
  row?.last_event_ms != null && eventMs != null && eventMs < row.last_event_ms;

/** A row the webhook wrote from a store purchase (admin-granted promo rows have neither). */
const storeBacked = (row: SubRow) => row.store != null || row.product_id != null;

/** Better of two rows for the same person: higher active tier, then later expiry (null = no expiry). */
export function better(a: SubRow | null, b: SubRow | null, nowMs: number): SubRow | null {
  if (!a) return b;
  if (!b) return a;
  const ra = RANK[activeTier(a, nowMs)], rb = RANK[activeTier(b, nowMs)];
  if (ra !== rb) return ra > rb ? a : b;
  const ea = a.expires_at ? Date.parse(a.expires_at) : Infinity;
  const eb = b.expires_at ? Date.parse(b.expires_at) : Infinity;
  return eb > ea ? b : a;
}

/**
 * Applies one RevenueCat webhook event. Order: duplicate check → apply (idempotent writes) → record the id.
 * Any failed read/write → 500 so RevenueCat retries; a retry is safe because every write below is idempotent
 * and TRANSFER never downgrades the recipient. The id is recorded only after all writes succeeded.
 */
export async function handleEvent(event: Record<string, any> | null, db: BillingDb, nowMs: number): Promise<Result> {
  if (!event || typeof event.type !== 'string') return { status: 400, body: { error: 'bad_event' } };
  if (typeof event.id !== 'string' || !event.id || event.id.length > 200) return { status: 400, body: { error: 'bad_event_id' } };
  try {
    if (await db.isProcessed(event.id)) return { status: 200, body: { ok: true, duplicate: true } };
    const outcome = await apply(event, db, nowMs);
    await db.markProcessed({ id: event.id, type: event.type, user_id: outcome.userId, event_ms: num(event.event_timestamp_ms) });
    return { status: 200, body: { ok: true, result: outcome.result } };
  } catch (e) {
    if (e instanceof DbError && e.code === FK_VIOLATION) {
      // The account was deleted: nothing to grant. Record it so retries stop; failing that, still answer 200.
      await db.markProcessed({ id: event.id, type: event.type, user_id: null, event_ms: num(event.event_timestamp_ms) }).catch(() => {});
      return { status: 200, body: { ok: true, result: 'unknown_user' } };
    }
    return { status: 500, body: { error: 'db_error' } };
  }
}

type Outcome = { userId: string | null; result: string };

async function apply(event: Record<string, any>, db: BillingDb, nowMs: number): Promise<Outcome> {
  const eventMs = num(event.event_timestamp_ms);
  if (event.type === 'TRANSFER') return transfer(event, db, eventMs, nowMs);

  const userId = userIdOf(event);
  const sandbox = event.environment === 'SANDBOX';
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'NON_RENEWING_PURCHASE':
    case 'SUBSCRIPTION_EXTENDED': {
      if (!userId) return { userId, result: 'no_user' };
      const tier = tierOf(event.entitlement_ids);
      // A product not mapped to our entitlements must not touch the plan (and never downgrade it).
      if (tier === 'free') return { userId, result: 'no_entitlement' };
      const cur = await db.getSub(userId);
      if (stale(cur, eventMs)) return { userId, result: 'stale' };
      await db.upsertSub({
        user_id: userId, tier, store: storeOf(event.store), sandbox,
        expires_at: iso(event.expiration_at_ms), product_id: typeof event.product_id === 'string' ? event.product_id : null,
        last_event_ms: eventMs ?? cur?.last_event_ms ?? null,
      });
      return { userId, result: 'granted' };
    }
    case 'EXPIRATION': {
      if (!userId) return { userId, result: 'no_user' };
      const cur = await db.getSub(userId);
      if (!cur) return { userId, result: 'no_row' };
      if (stale(cur, eventMs)) return { userId, result: 'stale' };
      // On Google an upgrade is a new purchase; the old product's EXPIRATION must not remove the new plan.
      if (cur.product_id && typeof event.product_id === 'string' && cur.product_id !== event.product_id) {
        return { userId, result: 'other_product' };
      }
      await db.upsertSub({ ...cur, tier: 'free', expires_at: null, product_id: null, last_event_ms: eventMs ?? cur.last_event_ms });
      return { userId, result: 'expired' };
    }
    case 'CANCELLATION': {
      // Normal cancellation: access stays until expires_at. A refund revokes access now: RevenueCat then sends an
      // expiration time that is already in the past.
      if (!userId) return { userId, result: 'no_user' };
      const exp = num(event.expiration_at_ms);
      if (exp == null || exp > nowMs) return { userId, result: 'noop' };
      const cur = await db.getSub(userId);
      if (!cur || stale(cur, eventMs)) return { userId, result: cur ? 'stale' : 'no_row' };
      if (cur.product_id && typeof event.product_id === 'string' && cur.product_id !== event.product_id) {
        return { userId, result: 'other_product' };
      }
      await db.upsertSub({ ...cur, tier: 'free', expires_at: null, product_id: null, last_event_ms: eventMs ?? cur.last_event_ms });
      return { userId, result: 'revoked' };
    }
    // BILLING_ISSUE: grace period, not an expiry. PRODUCT_CHANGE: informative, the RENEWAL / INITIAL_PURCHASE
    // that follows applies the new product. TEST and everything else: acknowledged, nothing to do.
    default:
      return { userId, result: 'noop' };
  }
}

/**
 * TRANSFER moves the purchases from transferred_from to transferred_to. The payload has no entitlement/expiry, so
 * the recipient's plan is computed from the current rows: the recipient keeps the better of its own row and the
 * store-backed rows of the sources. The recipient is written first, then the sources are cleared; a replay (sources
 * already cleared) therefore leaves the recipient as it is and can never downgrade it.
 */
async function transfer(event: Record<string, any>, db: BillingDb, eventMs: number | null, nowMs: number): Promise<Outcome> {
  const to = uuids(event.transferred_to)[0] ?? null;
  const from = uuids(event.transferred_from).filter((id) => id !== to);
  if (!to || !from.length) return { userId: to, result: 'no_user' };

  const sources: SubRow[] = [];
  for (const id of from) {
    const row = await db.getSub(id);
    if (row && storeBacked(row) && activeTier(row, nowMs) !== 'free') sources.push(row);
  }
  if (!sources.length) return { userId: to, result: 'nothing_to_move' };

  const mine = await db.getSub(to);
  const best = sources.reduce<SubRow | null>((acc, r) => better(acc, r, nowMs), null)!;
  const winner = better(mine, best, nowMs)!;
  if (winner !== mine) {
    await db.upsertSub({ ...winner, user_id: to, last_event_ms: Math.max(eventMs ?? 0, mine?.last_event_ms ?? 0) || null });
  }
  for (const src of sources) {
    await db.upsertSub({ ...src, tier: 'free', expires_at: null, product_id: null, last_event_ms: eventMs ?? src.last_event_ms });
  }
  return { userId: to, result: 'transferred' };
}
