// RevenueCat → server. The plan changes ONLY here, from a store-confirmed event; the app never sets it.
// Configure in RevenueCat: Integrations → Webhooks, Authorization header = REVENUECAT_WEBHOOK_SECRET.
// App user id in RevenueCat must be the Supabase user id (Purchases.logIn(uid)).
import { admin, json } from '../_shared/clients.ts';
import { secretMatches } from '../_shared/secret.ts';

const ENTITLEMENT_TIER: Record<string, 'plus' | 'premium'> = { plus: 'plus', premium: 'premium' };

Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || !secretMatches(req.headers.get('Authorization'), `Bearer ${secret}`)) return json({ error: 'unauthorized' }, 401);
  const { event } = await req.json().catch(() => ({ event: null }));
  if (!event?.type) return json({ error: 'bad_event' }, 400);
  const db = admin();
  const store = event.store === 'APP_STORE' ? 'app_store' : event.store === 'PLAY_STORE' ? 'play_store' : null;
  const sandbox = event.environment === 'SANDBOX';

  const tierOf = (ids: string[] = []) => (ids.includes('premium') ? 'premium' : ids.some((i) => ENTITLEMENT_TIER[i]) ? 'plus' : 'free');
  const upsert = async (userId: string, tier: string, expiresMs: number | null) => {
    await db.from('subscriptions').upsert({
      user_id: userId, tier, store, sandbox,
      expires_at: expiresMs ? new Date(expiresMs).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
  };

  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
    case 'NON_RENEWING_PURCHASE':
      await upsert(event.app_user_id, tierOf(event.entitlement_ids), event.expiration_at_ms ?? null);
      break;
    case 'CANCELLATION':
      // Access stays until the paid period ends; expiry is already set.
      break;
    case 'EXPIRATION':
    case 'BILLING_ISSUE':
      if (event.type === 'EXPIRATION') await upsert(event.app_user_id, 'free', null);
      break;
    case 'TRANSFER': {
      const to: string | undefined = event.transferred_to?.[0];
      const from: string | undefined = event.transferred_from?.[0];
      if (from) {
        const { data } = await db.from('subscriptions').select('*').eq('user_id', from).maybeSingle();
        await db.from('subscriptions').upsert({ user_id: from, tier: 'free', expires_at: null, updated_at: new Date().toISOString() });
        if (to && data) await db.from('subscriptions').upsert({ ...data, user_id: to, updated_at: new Date().toISOString() });
      }
      break;
    }
    default:
      break;
  }
  return json({ ok: true });
});
