// Switches RENVI Plus for the CALLER after asking RevenueCat (the app never writes subscriptions).
// The app calls it after a purchase or restore, at sign-in and once a day while it is open (renewals, expiry, refunds).
// Secrets: REVENUECAT_SECRET_KEY (secret v1 key); optional PLUS_ENTITLEMENT (default "plus").
// The RevenueCat app user id is the Supabase user id.
import { admin, callerId, cors, json } from '../_shared/clients.ts';
import { plusState, type Subscriber } from './logic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) return json({ error: 'not_configured' }, 503);
  const entitlement = Deno.env.get('PLUS_ENTITLEMENT') || 'plus';

  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  }).catch(() => null);
  // RevenueCat unreachable: change nothing, the app retries.
  if (!r || !r.ok) return json({ error: 'store_unavailable' }, 502);
  const body = (await r.json().catch(() => null)) as { subscriber?: Subscriber } | null;
  const s = plusState(body?.subscriber, entitlement, Date.now());

  const { error } = await admin().rpc('plus_set', { p_user: uid, p_expires: s.expires, p_product: s.product, p_trial: s.trial });
  if (error) return json({ error: 'db' }, 500);
  return json({ plus: s.expires !== null, expires_at: s.expires, trial: s.trial });
});
