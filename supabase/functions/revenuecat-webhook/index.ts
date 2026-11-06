// Incoming RevenueCat webhook: keeps RENVI Plus in step with the store without the app being open
// (renewals, expiry, refunds, billing problems). Replaces the old handler that used billing_events / billing_commit.
//
// Security:  RevenueCat sends the Authorization header configured in its dashboard; it must equal REVENUECAT_WEBHOOK_SECRET.
//            Without the secret every request is refused. The event body is never trusted for access.
// Handling:  event -> claim (rc_event_claim: duplicate / stale / busy) -> ask RevenueCat for the subscriber record ->
//            plus_set() for each person named by the event -> rc_event_done. A failure releases the claim and answers 5xx,
//            so RevenueCat retries. Referral Plus (promo_until) is untouched: plus_set only writes the store columns.
// Secrets:   REVENUECAT_WEBHOOK_SECRET (the header value), REVENUECAT_SECRET_KEY (REST key), optional PLUS_ENTITLEMENT.
import { admin, json } from '../_shared/clients.ts';
import { secretMatches } from '../_shared/secret.ts';
import { plusState, type Subscriber } from '../plus-sync/logic.ts';
import { decide, eventMs, presentedSecret, type RcEvent } from './logic.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) {
    console.error('REVENUECAT_WEBHOOK_SECRET is not set; refusing all requests');
    return json({ error: 'unauthorized' }, 401);
  }
  if (!secretMatches(presentedSecret(req.headers.get('authorization')), presentedSecret(secret))) return json({ error: 'unauthorized' }, 401);
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) return json({ error: 'not_configured' }, 503);
  const entitlement = Deno.env.get('PLUS_ENTITLEMENT') || 'plus';

  const body = (await req.json().catch(() => null)) as { event?: RcEvent } | null;
  const event = body?.event;
  const d = decide(event);
  if (d.action === 'ignore') return json({ ok: true, ignored: d.reason });
  const e = event as RcEvent;
  const ms = eventMs(e, Date.now());

  const db = admin();
  const claim = await db.rpc('rc_event_claim', { p_event_id: e.id, p_type: e.type, p_event_ms: ms, p_users: d.users });
  if (claim.error) { console.error('rc_event_claim failed', claim.error.message); return json({ error: 'db' }, 500); }
  const c = claim.data as { status: 'new' | 'duplicate' | 'stale' | 'busy'; users: string[] };
  if (c.status === 'duplicate' || c.status === 'stale') return json({ ok: true, ignored: c.status });
  if (c.status === 'busy') return json({ error: 'busy' }, 503);

  const fail = async (status: number, error: string) => {
    await db.rpc('rc_event_release', { p_event_id: e.id });
    return json({ error }, status);
  };
  for (const uid of c.users) {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    }).catch(() => null);
    if (!r || !r.ok) return fail(502, 'store_unavailable'); // change nothing; RevenueCat retries
    const sub = (await r.json().catch(() => null)) as { subscriber?: Subscriber } | null;
    const s = plusState(sub?.subscriber, entitlement, Date.now());
    const { error } = await db.rpc('plus_set', { p_user: uid, p_expires: s.expires, p_product: s.product, p_trial: s.trial });
    if (error) { console.error('plus_set failed', error.message); return fail(500, 'db'); }
  }
  const done = await db.rpc('rc_event_done', { p_event_id: e.id, p_event_ms: ms, p_users: c.users });
  if (done.error) { console.error('rc_event_done failed', done.error.message); return fail(500, 'db'); }
  return json({ ok: true, synced: c.users.length });
});
