// Pure helpers of the video-call Edge Function (no network). Run by scripts/test-db.sh with `bun test`.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expiryFor, httpForDbError, joinUrl, MAX_CALL_SECONDS, parseAction, roomNameFor, roomRequest, tokenRequest } from '../functions/video-call/daily.ts';

const CALL = '1468E2FF-64cb-4d96-b5d8-b5d1152a93a2';

test('parseAction accepts only known actions with a uuid', () => {
  expect(parseAction({ action: 'status' })).toEqual({ kind: 'status' });
  expect(parseAction({ action: 'join', call_id: CALL })).toEqual({ kind: 'join', callId: CALL.toLowerCase() });
  expect(parseAction({ action: 'end', call_id: CALL })).toEqual({ kind: 'end', callId: CALL.toLowerCase() });
  expect(parseAction({ action: 'join' })).toBeNull();
  expect(parseAction({ action: 'join', call_id: '../rooms' })).toBeNull();
  expect(parseAction({ action: 'delete', call_id: CALL })).toBeNull();
  expect(parseAction(null)).toBeNull();
  expect(parseAction('join')).toBeNull();
});

test('room name is deterministic per session and fits the database check', () => {
  const n = roomNameFor(CALL);
  expect(n).toBe('rv-1468e2ff64cb4d96b5d8b5d1152a93a2');
  expect(n).toMatch(/^[a-z0-9-]{1,64}$/);
  expect(roomNameFor(CALL.toLowerCase())).toBe(n);
});

test('expiry is the session end, capped at 30 minutes, null when over', () => {
  const now = Date.parse('2026-10-28T18:00:00Z');
  const s = Math.floor(now / 1000);
  expect(expiryFor('2026-10-28T18:20:00Z', now)).toBe(s + 20 * 60);
  expect(expiryFor('2026-10-28T23:00:00Z', now)).toBe(s + MAX_CALL_SECONDS);
  expect(expiryFor('2026-10-28T18:00:00Z', now)).toBeNull();
  expect(expiryFor('2026-10-28T17:00:00Z', now)).toBeNull();
  expect(expiryFor('garbage', now)).toBeNull();
});

test('room is private, for two people, and ends at exp', () => {
  const r = roomRequest('rv-x', 123);
  expect(r.privacy).toBe('private');
  expect(r.properties.max_participants).toBe(2);
  expect(r.properties.exp).toBe(123);
  expect(r.properties.eject_at_room_exp).toBe(true);
  expect(r.properties.enable_screenshare).toBe(false);
});

test('token is bound to one room and one user, never owner', () => {
  const t = tokenRequest('rv-x', '00000000-0000-0000-0000-000000000021', '  Ana  ', 456);
  expect(t.properties).toMatchObject({ room_name: 'rv-x', user_id: '00000000-0000-0000-0000-000000000021', user_name: 'Ana', is_owner: false, exp: 456, eject_at_token_exp: true });
  expect(tokenRequest('rv-x', 'u', null, 1).properties.user_name).toBe('RENVI');
});

test('join URL carries the token and only points at daily.co over https', () => {
  expect(joinUrl('https://renvi.daily.co/rv-x', 'abc.def')).toBe('https://renvi.daily.co/rv-x?t=abc.def');
  expect(() => joinUrl('http://renvi.daily.co/rv-x', 't')).toThrow();
  expect(() => joinUrl('https://evil.example/rv-x', 't')).toThrow();
  expect(() => joinUrl('https://daily.co.evil.example/rv-x', 't')).toThrow();
});

test('database errors map to clear HTTP codes', () => {
  expect(httpForDbError('P0429', 'rate limited')).toEqual({ status: 429, error: 'rate_limited' });
  expect(httpForDbError('42501', 'call expired')).toEqual({ status: 410, error: 'call_expired' });
  expect(httpForDbError('42501', 'call not accepted')).toEqual({ status: 409, error: 'call_not_accepted' });
  expect(httpForDbError('42501', 'blocked')).toEqual({ status: 403, error: 'blocked' });
  expect(httpForDbError('42501', 'no call')).toEqual({ status: 403, error: 'forbidden' });
  expect(httpForDbError(undefined, 'boom')).toEqual({ status: 500, error: 'server' });
});

test('function authenticates first and answers 503 video_unavailable without DAILY_API_KEY', () => {
  const src = readFileSync(join(import.meta.dir, '../functions/video-call/index.ts'), 'utf8');
  const auth = src.indexOf('auth.getUser()');
  const missing = src.search(/if \(!key\) return json\(\{ error: 'video_unavailable' \}, 503\)/);
  expect(auth).toBeGreaterThan(-1);
  expect(missing).toBeGreaterThan(auth);
  expect(src).toContain("rpc('video_call_join'");
});
