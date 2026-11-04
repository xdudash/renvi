// Switches RENVI Playbook access for the CALLER after asking RevenueCat (the app never writes `purchased`).
// The app calls it after a purchase or restore, and when the store says the course is owned but the server does not.
// Secrets: REVENUECAT_SECRET_KEY (RevenueCat → Project settings → API keys, secret v1 key);
// optional PLAYBOOK_ENTITLEMENT (default "playbook"). The RevenueCat app user id is the Supabase user id.
import { admin, callerId, cors, json } from '../_shared/clients.ts';
import { ownsPlaybook, type Subscriber } from './logic.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) return json({ error: 'not_configured' }, 503);
  const entitlement = Deno.env.get('PLAYBOOK_ENTITLEMENT') || 'playbook';

  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  }).catch(() => null);
  // RevenueCat unreachable: change nothing, the app retries.
  if (!r || !r.ok) return json({ error: 'store_unavailable' }, 502);
  const body = (await r.json().catch(() => null)) as { subscriber?: Subscriber } | null;
  const purchased = ownsPlaybook(body?.subscriber, entitlement, Date.now());

  const { error } = await admin().rpc('playbook_set_purchased', { p_user: uid, p_purchased: purchased });
  if (error) return json({ error: 'db' }, 500);
  return json({ purchased });
});
