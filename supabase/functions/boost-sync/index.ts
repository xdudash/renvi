// Applies the CALLER's paid plan boosts after asking RevenueCat: body { plan_id }. Every store transaction is applied once
// (plan_boost_apply is idempotent by transaction id) and only to a plan the caller hosts.
// Secrets: REVENUECAT_SECRET_KEY. Products: renvi_boost_3h (consumable, 0,99 €), renvi_boost_24h (consumable, 2,49 €).
import { admin, callerId, cors, json } from '../_shared/clients.ts';
import { boostPurchases, type Subscriber } from './logic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) return json({ error: 'not_configured' }, 503);
  const { plan_id } = (await req.json().catch(() => ({}))) as { plan_id?: string };
  if (!plan_id || !/^[0-9a-f-]{36}$/i.test(plan_id)) return json({ error: 'bad_request' }, 400);

  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  }).catch(() => null);
  if (!r || !r.ok) return json({ error: 'store_unavailable' }, 502);
  const body = (await r.json().catch(() => null)) as { subscriber?: Subscriber } | null;

  let applied = 0;
  let boostedUntil: string | null = null;
  const db = admin();
  for (const p of boostPurchases(body?.subscriber)) {
    const { data, error } = await db.rpc('plan_boost_apply', { p_user: uid, p_plan: plan_id, p_hours: p.hours, p_tx: p.tx, p_product: p.product });
    if (error) {
      if (error.code === 'P0002') return json({ error: 'plan_unavailable' }, 409);
      return json({ error: 'db' }, 500);
    }
    if (data?.applied) { applied++; boostedUntil = data.boosted_until; }
  }
  return json({ applied, boosted_until: boostedUntil });
});
