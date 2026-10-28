// Database Webhook target (messages, matches, dates INSERT/UPDATE). Sends a push WITHOUT names or message text.
// Configure: Database → Webhooks → HTTP request to this function with header x-push-secret = PUSH_WEBHOOK_SECRET.
import { admin, json } from '../_shared/clients.ts';
import { secretMatches } from '../_shared/secret.ts';

type Payload = { type: 'INSERT' | 'UPDATE'; table: string; record: Record<string, any>; old_record?: Record<string, any> };

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  // Misconfiguration must never open the endpoint: without a secret every request is refused.
  if (!secret) {
    console.error('PUSH_WEBHOOK_SECRET is not set; refusing all requests');
    return json({ error: 'unauthorized' }, 401);
  }
  if (!secretMatches(req.headers.get('x-push-secret'), secret)) return json({ error: 'unauthorized' }, 401);
  const p = (await req.json()) as Payload;
  const db = admin();
  const partnerOf = async (matchId: string, me: string) => {
    const { data } = await db.from('matches').select('user_a,user_b').eq('id', matchId).maybeSingle();
    return data ? (data.user_a === me ? data.user_b : data.user_a) : null;
  };
  let to: string[] = [];
  let pref: 'messages' | 'matches' | 'dates' = 'messages';
  let title = '';
  let route = '';
  if (p.table === 'messages' && p.type === 'INSERT') {
    const r = await partnerOf(p.record.match_id, p.record.sender_id);
    if (r) to = [r];
    title = 'Новое сообщение';
    route = `/chat?match=${p.record.match_id}`;
    const { data: s } = await db.from('match_settings').select('muted').eq('match_id', p.record.match_id).eq('user_id', r).maybeSingle();
    if (s?.muted) to = [];
  } else if (p.table === 'matches' && p.type === 'INSERT') {
    to = [p.record.user_a, p.record.user_b];
    pref = 'matches';
    title = 'Это взаимно';
    route = `/chat?match=${p.record.id}`;
  } else if (p.table === 'dates') {
    pref = 'dates';
    route = `/chat?match=${p.record.match_id}`;
    if (p.type === 'INSERT') {
      const r = await partnerOf(p.record.match_id, p.record.proposer_id);
      if (r) to = [r];
      title = 'Приглашение на встречу';
    } else if (p.old_record?.status !== p.record.status && ['accepted', 'declined'].includes(p.record.status)) {
      to = [p.record.proposer_id];
      title = 'Ответ на приглашение';
    }
  }
  if (!to.length) return json({ ok: true, sent: 0 });
  const { data: prefs } = await db.from('notification_prefs').select(`user_id, ${pref}`).in('user_id', to);
  const off = new Set((prefs ?? []).filter((x: any) => x[pref] === false).map((x: any) => x.user_id));
  const { data: tokens } = await db.from('push_tokens').select('token,user_id').in('user_id', to.filter((u) => !off.has(u)));
  if (!tokens?.length) return json({ ok: true, sent: 0 });
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokens.map((t) => ({ to: t.token, title, body: 'Откройте RENVI', data: { route }, sound: 'default' }))),
  });
  const out = await res.json().catch(() => null);
  // Remove tokens of uninstalled apps.
  const bad = (out?.data ?? []).map((r: any, i: number) => (r?.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null)).filter(Boolean);
  if (bad.length) await db.from('push_tokens').delete().in('token', bad);
  return json({ ok: true, sent: tokens.length });
});
