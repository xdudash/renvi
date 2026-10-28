// Optional pre-date video call (migration 0018 + Edge Function `video-call`, Daily.co Prebuilt in a WebView).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { toAppError } from './errors';

export type VideoCallStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'ended' | 'expired';
export type VideoCallRow = {
  id: string;
  match_id: string;
  requested_by: string;
  status: VideoCallStatus;
  room_name: string | null;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  ended_at: string | null;
};
export type JoinInfo = { url: string; room_url: string; token: string; expires_at: string };
export type VideoErrorCode = 'video_unavailable' | 'rate_limited' | 'call_expired' | 'call_not_accepted' | 'blocked' | 'forbidden' | 'video_provider' | 'offline' | 'server';

export class VideoError extends Error {
  code: VideoErrorCode;
  constructor(code: VideoErrorCode) { super(code); this.code = code; }
}

/** Requested sessions lapse and accepted calls end at expires_at, even if the row still says otherwise. */
export function effectiveStatus(c: VideoCallRow | null, now = Date.now()): VideoCallStatus | null {
  if (!c) return null;
  if ((c.status === 'requested' || c.status === 'accepted') && Date.parse(c.expires_at) <= now) return 'expired';
  return c.status;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('video-call', { body });
  if (!error) return data as T;
  const res = (error as { context?: Response }).context;
  if (res && typeof res.status === 'number') {
    const payload: { error?: VideoErrorCode } | null = await res.clone().json().catch(() => null);
    throw new VideoError(payload?.error ?? (res.status === 503 ? 'video_unavailable' : 'server'));
  }
  throw new VideoError(toAppError(error).kind === 'offline' ? 'offline' : 'server');
}

// Availability is asked once per app run. Only a definite "no" (503 from the server) is remembered;
// a network error just hides the action for now and is retried next time.
let availability: Promise<boolean> | null = null;
export function videoAvailable(): Promise<boolean> {
  if (!availability) {
    availability = invoke<{ available: boolean }>({ action: 'status' }).then(
      (r) => r.available === true,
      (e) => { if (!(e instanceof VideoError && e.code === 'video_unavailable')) availability = null; return false; },
    );
  }
  return availability;
}

/** Shows the video call action only when the server has Daily configured (null while asking). */
export function useVideoAvailable(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    videoAvailable().then((v) => { if (alive) setOn(v); });
    return () => { alive = false; };
  }, []);
  return on;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.code === 'P0429') throw new VideoError('rate_limited');
    throw toAppError(error);
  }
  return data as T;
}

export const videoApi = {
  latest: async (matchId: string): Promise<VideoCallRow | null> => {
    const { data, error } = await supabase.from('video_calls').select('*').eq('match_id', matchId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw toAppError(error);
    return (data as VideoCallRow) ?? null;
  },
  request: (matchId: string) => rpc<VideoCallRow>('request_video_call', { p_match: matchId }),
  respond: (callId: string, action: 'accept' | 'decline') => rpc<VideoCallRow>('respond_video_call', { p_call: callId, p_action: action }),
  /** Ends the session and deletes the room on the server (falls back to the RPC if the function is down). */
  end: async (callId: string) => {
    try { await invoke({ action: 'end', call_id: callId }); } catch { await rpc('end_video_call', { p_call: callId }); }
  },
  join: (callId: string) => invoke<JoinInfo>({ action: 'join', call_id: callId }),
};

/** Latest session of a match, polled while something is pending so both phones see consent changes. */
export function useVideoCall(matchId: string | undefined, enabled = true) {
  // State is keyed by match so a stale answer for another conversation is never shown.
  const [state, setState] = useState<{ match: string; call: VideoCallRow | null } | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!matchId || !enabled) return;
    let alive = true;
    videoApi.latest(matchId).then(
      (c) => { if (alive) setState({ match: matchId, call: c }); },
      () => { if (alive) setState((s) => (s?.match === matchId ? s : { match: matchId, call: null })); },
    );
    return () => { alive = false; };
  }, [matchId, enabled, tick]);
  const call = state && state.match === matchId ? state.call : null;
  const loading = !!matchId && enabled && state?.match !== matchId;
  const setCall = useCallback((c: VideoCallRow | null) => { if (matchId) setState({ match: matchId, call: c }); }, [matchId]);
  const open = call && (effectiveStatus(call) === 'requested' || effectiveStatus(call) === 'accepted');
  useEffect(() => {
    if (!matchId || !enabled) return;
    const id = setInterval(reload, open ? 4000 : 20000);
    return () => clearInterval(id);
  }, [matchId, enabled, open, reload]);
  return { call, setCall, loading, reload };
}
