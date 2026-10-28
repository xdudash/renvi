// Builds a JSON copy of the caller's data, stores it privately and returns a link valid for 24 hours.
// If RESEND_API_KEY and EXPORT_FROM_EMAIL are set, the link is also e-mailed to the confirmed address.
import { admin, asUser, cors, json } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const user = asUser(req);
  const { data: u } = await user.auth.getUser();
  if (!u.user) return json({ error: 'unauthorized' }, 401);
  const { data, error } = await user.rpc('export_my_data');
  if (error) return json({ error: 'export_failed' }, 500);
  const db = admin();
  const path = `${u.user.id}/export/renvi-data-${Date.now()}.json`;
  const up = await db.storage.from('profile-media').upload(path, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), { contentType: 'application/json' });
  if (up.error) return json({ error: 'store_failed' }, 500);
  await db.from('data_exports').insert({ user_id: u.user.id, status: 'ready', storage_path: path });
  const { data: signed } = await db.storage.from('profile-media').createSignedUrl(path, 60 * 60 * 24);
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EXPORT_FROM_EMAIL');
  let emailed = false;
  if (key && from && u.user.email && signed?.signedUrl) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: u.user.email, subject: 'RENVI · копия ваших данных', text: `Ссылка действует 24 часа:\n${signed.signedUrl}` }),
    });
    emailed = r.ok;
  }
  return json({ ok: true, emailed, url: emailed ? null : signed?.signedUrl ?? null });
});
