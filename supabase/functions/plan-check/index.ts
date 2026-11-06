// Evening «всё ок?» for plans. Called by a scheduler (Supabase Cron / pg_cron + pg_net, see docs/SETUP.md) with header
// x-digest-secret = DIGEST_CRON_SECRET (the same secret as weekly-digest). Everyone in a plan (host + accepted) gets one
// push at 21:00 local time of the plan's day (or two hours after a late start) that opens «Как прошло».
// The database decides who is due and claims (plan, person) before sending, so nobody is asked twice.
import { admin, json } from '../_shared/clients.ts';
import { secretMatches } from '../_shared/secret.ts';
import { planCheckText } from './text.ts';

type Candidate = { plan_id: string; user_id: string; language: string };

const PAGE = 500;
const MAX_PAGES = 10;
const EXPO_CHUNK = 100;
const chunks = <T>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));

Deno.serve(async (req) => {
  const secret = Deno.env.get('DIGEST_CRON_SECRET');
  // Misconfiguration must never open the endpoint: without a secret every request is refused.
  if (!secret) {
    console.error('DIGEST_CRON_SECRET is not set; refusing all requests');
    return json({ error: 'unauthorized' }, 401);
  }
  if (!secretMatches(req.headers.get('x-digest-secret'), secret)) return json({ error: 'unauthorized' }, 401);
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const db = admin();
  const stats = { candidates: 0, pushed: 0 };
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db.rpc('plan_check_candidates', { p_limit: PAGE });
    if (error) {
      console.error('plan_check_candidates failed', error.message);
      return json({ error: 'query_failed', ...stats }, 500);
    }
    const rows = (data ?? []) as Candidate[];
    if (!rows.length) break;
    const { data: claimed, error: claimErr } = await db.rpc('plan_check_claim', { p_plans: rows.map((r) => r.plan_id), p_users: rows.map((r) => r.user_id) });
    if (claimErr) {
      console.error('plan_check_claim failed', claimErr.message);
      return json({ error: 'claim_failed', ...stats }, 500);
    }
    const mine = new Set(((claimed ?? []) as Candidate[]).map((c) => `${c.plan_id}:${c.user_id}`));
    const batch = rows.filter((r) => mine.has(`${r.plan_id}:${r.user_id}`));
    stats.candidates += batch.length;
    if (!batch.length) break;
    stats.pushed += await sendPush(db, batch);
  }
  return json({ ok: true, ...stats });
});

async function sendPush(db: ReturnType<typeof admin>, rows: Candidate[]): Promise<number> {
  const byUser = new Map<string, Candidate>();
  for (const r of rows) if (!byUser.has(r.user_id)) byUser.set(r.user_id, r); // one push per person even for two plans
  const { data: tokens } = await db.from('push_tokens').select('token,user_id').in('user_id', [...byUser.keys()]);
  const messages = (tokens ?? []).map((t: { token: string; user_id: string }) => {
    const r = byUser.get(t.user_id)!;
    const x = planCheckText(r.language);
    return { to: t.token, title: x.title, body: x.body, data: { route: `/plan-after?id=${r.plan_id}` }, sound: 'default' };
  });
  let sent = 0;
  const dead: string[] = [];
  for (const part of chunks(messages, EXPO_CHUNK)) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(part) });
      const out = await res.json().catch(() => null);
      part.forEach((m, i) => {
        const r = out?.data?.[i];
        if (r?.status === 'ok') sent++;
        if (r?.details?.error === 'DeviceNotRegistered') dead.push(m.to);
      });
    } catch (e) {
      console.error('expo push failed', (e as Error).message);
    }
  }
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  return sent;
}
