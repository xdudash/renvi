// Pure helpers for the video-call Edge Function (no Deno / network APIs, so `bun test` can import them).
// Daily REST API: https://docs.daily.co/reference/rest-api/rooms/create-room and .../meeting-tokens/create-meeting-token

export const DAILY_API = 'https://api.daily.co/v1';
/** Hard cap for a room and a token, whatever the database says. */
export const MAX_CALL_SECONDS = 30 * 60;

export type Action = { kind: 'status' } | { kind: 'join'; callId: string } | { kind: 'end'; callId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates the request body: { action: 'status' } | { action: 'join' | 'end', call_id: uuid }. */
export function parseAction(body: unknown): Action | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.action === 'status') return { kind: 'status' };
  if ((b.action === 'join' || b.action === 'end') && typeof b.call_id === 'string' && UUID.test(b.call_id)) {
    return { kind: b.action, callId: b.call_id.toLowerCase() };
  }
  return null;
}

/** One room per call session; deterministic so two members joining at once end up in the same room. */
export function roomNameFor(callId: string): string {
  return 'rv-' + callId.toLowerCase().replace(/-/g, '');
}

/**
 * Unix seconds when the room/token must expire: the session end from the database, but never more than
 * MAX_CALL_SECONDS from now. Returns null when the session is already over.
 */
export function expiryFor(sessionExpiresAt: string, nowMs: number): number | null {
  const end = Date.parse(sessionExpiresAt);
  if (!Number.isFinite(end)) return null;
  const exp = Math.min(Math.floor(end / 1000), Math.floor(nowMs / 1000) + MAX_CALL_SECONDS);
  return exp > Math.floor(nowMs / 1000) ? exp : null;
}

/** POST /rooms body: private, two people, ends for everyone at exp, no recording-related extras. */
export function roomRequest(name: string, exp: number) {
  return {
    name,
    privacy: 'private',
    properties: {
      exp,
      eject_at_room_exp: true,
      max_participants: 2,
      enable_prejoin_ui: true,
      enable_knocking: false,
      enable_screenshare: false,
      enable_chat: false,
    },
  };
}

/** POST /meeting-tokens body: valid only for this room and this user, never owner. */
export function tokenRequest(roomName: string, userId: string, userName: string | null, exp: number) {
  return {
    properties: {
      room_name: roomName,
      user_id: userId.slice(0, 36),
      user_name: (userName ?? '').trim().slice(0, 40) || 'RENVI',
      is_owner: false,
      exp,
      eject_at_token_exp: true,
      enable_screenshare: false,
    },
  };
}

/** Daily Prebuilt URL with the meeting token (`?t=`), opened in the app's WebView. */
export function joinUrl(roomUrl: string, token: string): string {
  const u = new URL(roomUrl);
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.daily.co')) throw new Error('unexpected room url');
  u.searchParams.set('t', token);
  return u.toString();
}

/** Maps a Postgres error from the RPCs to the function's HTTP response. */
export function httpForDbError(code: string | undefined, message: string | undefined): { status: number; error: string } {
  if (code === 'P0429') return { status: 429, error: 'rate_limited' };
  if (code === '42501') {
    const m = message ?? '';
    if (m.includes('expired')) return { status: 410, error: 'call_expired' };
    if (m.includes('not accepted')) return { status: 409, error: 'call_not_accepted' };
    if (m.includes('blocked')) return { status: 403, error: 'blocked' };
    return { status: 403, error: 'forbidden' };
  }
  return { status: 500, error: 'server' };
}
