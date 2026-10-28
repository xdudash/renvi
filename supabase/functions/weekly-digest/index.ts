// Weekly digest. Called by a scheduler (Supabase Cron / pg_cron + pg_net, see docs/SETUP.md) with header
// x-digest-secret = DIGEST_CRON_SECRET. For every active user it sends one push (and, if the user opted in and
// RESEND_API_KEY is set, one e-mail) saying how many NEW profiles in their country match their preferences.
// The text carries only that number. At most one digest per user per 7 days (public.digest_log).
// Without ?force=1 it only runs on the weekday/hour configured in app_config 'digest'.
import { admin, json } from '../_shared/clients.ts';
import { secretMatches } from '../_shared/secret.ts';
import { digestText } from './text.ts';

type Candidate = { user_id: string; new_count: number; language: string; send_push: boolean; send_email: boolean; email: string | null };

const PAGE = 500; // users per database round trip
const MAX_PAGES = 20; // safety cap per invocation (10 000 users); the next run continues
const EXPO_CHUNK = 100; // Expo push API limit per request
const RESEND_CHUNK = 100; // Resend batch API limit

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
  const force = new URL(req.url).searchParams.get('force') === '1';
  if (!force) {
    const { data: due } = await db.rpc('digest_due_now');
    if (due !== true) return json({ ok: true, skipped: 'not_due' });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('DIGEST_FROM_EMAIL') ?? Deno.env.get('EXPORT_FROM_EMAIL');
  const stats = { candidates: 0, pushed: 0, emailed: 0 };

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db.rpc('weekly_digest_candidates', { p_limit: PAGE });
    if (error) {
      console.error('weekly_digest_candidates failed', error.message);
      return json({ error: 'query_failed', ...stats }, 500);
    }
    const rows = (data ?? []) as Candidate[];
    if (!rows.length) break;
    // Claim the 7-day slot first: an overlapping run can never send the same user twice, and claimed users
    // leave the candidate list so the loop terminates.
    const { data: claimed, error: claimErr } = await db.rpc('digest_claim', { p_users: rows.map((r) => r.user_id), p_counts: rows.map((r) => r.new_count) });
    if (claimErr) {
      console.error('digest_claim failed', claimErr.message);
      return json({ error: 'claim_failed', ...stats }, 500);
    }
    const mine = new Set((claimed ?? []) as string[]);
    const batch = rows.filter((r) => mine.has(r.user_id));
    stats.candidates += batch.length;
    if (!batch.length) break;

    const pushed = await sendPush(db, batch.filter((r) => r.send_push));
    const emailed = resendKey && from ? await sendEmail(resendKey, from, batch.filter((r) => r.send_email && r.email)) : [];
    stats.pushed += pushed.length;
    stats.emailed += emailed.length;
    if (pushed.length) await db.rpc('digest_mark_sent', { p_users: pushed, p_push: true, p_email: false });
    if (emailed.length) await db.rpc('digest_mark_sent', { p_users: emailed, p_push: false, p_email: true });
    if (rows.length < PAGE) break;
  }
  return json({ ok: true, ...stats });
});

// Returns the ids of users for whom at least one push was accepted by Expo.
async function sendPush(db: ReturnType<typeof admin>, rows: Candidate[]): Promise<string[]> {
  if (!rows.length) return [];
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  const { data: tokens } = await db.from('push_tokens').select('token,user_id').in('user_id', [...byUser.keys()]);
  const messages = (tokens ?? []).map((t: { token: string; user_id: string }) => {
    const r = byUser.get(t.user_id)!;
    const x = digestText(r.language);
    return { to: t.token, title: x.pushTitle, body: x.pushBody(r.new_count), data: { route: '/discover' }, sound: 'default', userId: t.user_id };
  });
  const ok = new Set<string>();
  const dead: string[] = [];
  for (const part of chunks(messages, EXPO_CHUNK)) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(part.map(({ userId: _u, ...m }) => m)),
      });
      const out = await res.json().catch(() => null);
      part.forEach((m, i) => {
        const r = out?.data?.[i];
        if (r?.status === 'ok') ok.add(m.userId);
        if (r?.details?.error === 'DeviceNotRegistered') dead.push(m.to);
      });
    } catch (e) {
      console.error('expo push failed', (e as Error).message);
    }
  }
  // Remove tokens of uninstalled apps (same as the push function).
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);
  return [...ok];
}

// Returns the ids of users whose e-mail was accepted by Resend.
async function sendEmail(key: string, from: string, rows: Candidate[]): Promise<string[]> {
  const ok: string[] = [];
  for (const part of chunks(rows, RESEND_CHUNK)) {
    const payload = part.map((r) => {
      const x = digestText(r.language);
      return { from, to: r.email, subject: x.emailSubject, text: x.emailBody(r.new_count) };
    });
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) ok.push(...part.map((r) => r.user_id));
      else console.error('resend batch failed', res.status);
    } catch (e) {
      console.error('resend failed', (e as Error).message);
    }
  }
  return ok;
}
