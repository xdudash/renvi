// RevenueCat → server. The plan changes ONLY here, from a store-confirmed event; the app never sets it.
// Configure in RevenueCat: Integrations → Webhooks, Authorization header = REVENUECAT_WEBHOOK_SECRET.
// App user id in RevenueCat must be the Supabase user id (Purchases.logIn(uid)).
// Idempotent: applied event ids are kept in billing_events (migration 0021); any failed DB call answers 500 so
// RevenueCat retries. The event logic lives in logic.ts (unit-tested with bun).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { admin, json } from '../_shared/clients.ts';
import { secretMatches } from '../_shared/secret.ts';
import { type BillingDb, DbError, handleEvent, type SubRow } from './logic.ts';

const COLUMNS = 'user_id, tier, store, sandbox, expires_at, product_id, last_event_ms';

function supabaseDb(db: SupabaseClient): BillingDb {
  const fail = (error: { message: string; code?: string }) => { throw new DbError(error.message, error.code); };
  return {
    async isProcessed(id) {
      const { data, error } = await db.from('billing_events').select('id').eq('id', id).maybeSingle();
      if (error) fail(error);
      return !!data;
    },
    async markProcessed(e) {
      const { error } = await db.from('billing_events').upsert(e, { onConflict: 'id', ignoreDuplicates: true });
      if (error) fail(error);
    },
    async getSub(userId) {
      const { data, error } = await db.from('subscriptions').select(COLUMNS).eq('user_id', userId).maybeSingle();
      if (error) fail(error);
      return (data as SubRow | null) ?? null;
    },
    async upsertSub(row) {
      const { error } = await db.from('subscriptions').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) fail(error);
    },
  };
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || !secretMatches(req.headers.get('Authorization'), `Bearer ${secret}`)) return json({ error: 'unauthorized' }, 401);
  const { event } = await req.json().catch(() => ({ event: null }));
  const r = await handleEvent(event ?? null, supabaseDb(admin()), Date.now());
  if (r.status >= 500) console.error('revenuecat-webhook: db error', event?.type, event?.id);
  return json(r.body, r.status);
});
