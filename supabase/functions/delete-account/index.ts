// Deletes the caller's account: media files, then the auth user (all rows cascade).
import { admin, callerId, cors, json, removeFolder } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const db = admin();
  if (typeof body.reason === 'string' && body.reason.trim()) {
    await db.from('deletion_feedback').insert({ reason: body.reason.trim().slice(0, 200) });
  }
  await removeFolder(db, uid);
  const { error } = await db.auth.admin.deleteUser(uid);
  if (error) return json({ error: 'delete_failed' }, 500);
  return json({ ok: true });
});
