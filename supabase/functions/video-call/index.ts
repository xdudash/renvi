// Optional pre-date safety video call (Daily.co Prebuilt in the app's WebView).
// POST { action: 'status' }                 → 200 { available: true } | 503 { error: 'video_unavailable' }
// POST { action: 'join', call_id }          → 200 { url, room_url, token, expires_at } (token for the caller only)
// POST { action: 'end',  call_id }          → 200 { ok: true }  (closes the session, deletes the room)
// Access rules live in the database (migration 0018): video_call_join() runs as the caller and checks the active
// match, blocks, mutual acceptance, expiry and the hourly rate limit. DAILY_API_KEY is a Supabase secret.
import { admin, asUser, cors, json } from '../_shared/clients.ts';
import { DAILY_API, expiryFor, httpForDbError, joinUrl, parseAction, roomNameFor, roomRequest, tokenRequest } from './daily.ts';

type Joined = { call_id: string; match_id: string; expires_at: string; room_name: string | null; user_id: string; user_name: string | null };

async function daily(key: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${DAILY_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// Reuse the session's room if it exists, otherwise create it. Two members joining at the same moment may both
// try to create it; the loser's POST fails and the follow-up GET finds the winner's room.
async function ensureRoom(key: string, name: string, exp: number): Promise<string | null> {
  const existing = await daily(key, 'GET', `/rooms/${name}`);
  if (existing.ok && existing.data?.url) return existing.data.url as string;
  const created = await daily(key, 'POST', '/rooms', roomRequest(name, exp));
  if (created.ok && created.data?.url) return created.data.url as string;
  const again = await daily(key, 'GET', `/rooms/${name}`);
  if (again.ok && again.data?.url) return again.data.url as string;
  console.error('daily room create failed', created.status, created.data?.error, created.data?.info);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  // Authenticated users only (JWT verified by auth.getUser).
  const userClient = asUser(req);
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'unauthorized' }, 401);

  // Feature switch: without the Daily key the app hides the video call action.
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) return json({ error: 'video_unavailable' }, 503);

  const action = parseAction(await req.json().catch(() => null));
  if (!action) return json({ error: 'bad_request' }, 400);
  if (action.kind === 'status') return json({ available: true });

  if (action.kind === 'end') {
    const { data, error } = await userClient.rpc('end_video_call', { p_call: action.callId });
    if (error) { const r = httpForDbError(error.code, error.message); return json({ error: r.error }, r.status); }
    // Deleting the room ends the call for both sides even if the other phone is still open. Best effort:
    // the room expires on its own (eject_at_room_exp) anyway.
    if (data?.room_name) await daily(key, 'DELETE', `/rooms/${data.room_name}`).catch(() => null);
    return json({ ok: true });
  }

  // join: authorization + rate limit in the database, as the caller.
  const { data: joined, error } = await userClient.rpc('video_call_join', { p_call: action.callId });
  if (error) { const r = httpForDbError(error.code, error.message); return json({ error: r.error }, r.status); }
  const j = joined as Joined;
  const exp = expiryFor(j.expires_at, Date.now());
  if (!exp) return json({ error: 'call_expired' }, 410);

  const name = j.room_name ?? roomNameFor(j.call_id);
  const roomUrl = await ensureRoom(key, name, exp);
  if (!roomUrl) return json({ error: 'video_provider' }, 502);
  if (!j.room_name) await admin().from('video_calls').update({ room_name: name }).eq('id', j.call_id);

  const tok = await daily(key, 'POST', '/meeting-tokens', tokenRequest(name, j.user_id, j.user_name, exp));
  if (!tok.ok || typeof tok.data?.token !== 'string') {
    console.error('daily token failed', tok.status, tok.data?.error, tok.data?.info);
    return json({ error: 'video_provider' }, 502);
  }
  return json({ url: joinUrl(roomUrl, tok.data.token), room_url: roomUrl, token: tok.data.token, expires_at: new Date(exp * 1000).toISOString() });
});
