// Realtime chat with an offline outbox: every message has a client id, so retries never duplicate.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { api, type MessageRow } from './api';
import { useLang } from './lang';
import { AppError, type AppErrorKind } from './errors';

// local_uri: the sender's own recording while a voice message is not on the server yet.
export type ChatItem = MessageRow & { state: 'sent' | 'sending' | 'failed'; local_uri?: string | null };
// A voice message waits in the outbox with its local file and a server path fixed up front, so a retry
// re-uploads to the same path and re-sends with the same client_id (no duplicate file, no duplicate message).
export type PendingVoice = { uri: string; path: string; duration_ms: number };
type Pending = { client_id: string; match_id: string; body: string | null; photo_path: string | null; voice?: PendingVoice | null; created_at: string };

const toItem = (p: Pending, sender: string, state: ChatItem['state']): ChatItem => ({
  id: p.client_id, client_id: p.client_id, match_id: p.match_id, sender_id: sender, body: p.body, photo_path: p.photo_path,
  voice_path: p.voice?.path ?? null, voice_duration_ms: p.voice?.duration_ms ?? null, local_uri: p.voice?.uri ?? null,
  deleted_at: null, created_at: p.created_at, state,
});

const OUTBOX = 'renvi.outbox';
async function readOutbox(): Promise<Pending[]> {
  try { return JSON.parse((await AsyncStorage.getItem(OUTBOX)) ?? '[]'); } catch { return []; }
}
async function writeOutbox(list: Pending[]) { await AsyncStorage.setItem(OUTBOX, JSON.stringify(list)); }

export function useChat(matchId: string | undefined, myId: string | undefined) {
  const { t } = useLang();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const itemsRef = useRef<ChatItem[]>([]);
  const lastErr = useRef<AppErrorKind | null>(null);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const merge = useCallback((rows: ChatItem[]) => {
    setItems((cur) => {
      const map = new Map<string, ChatItem>();
      for (const m of cur) map.set(m.client_id + m.sender_id, m);
      for (const m of rows) map.set(m.client_id + m.sender_id, m);
      return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  // Latest page + this conversation's unsent messages from the outbox.
  const fetchLatest = useCallback(async (): Promise<{ rows: ChatItem[]; older: boolean }> => {
    if (!matchId) return { rows: [], older: false };
    const rows = await api.messages(matchId);
    const pend = (await readOutbox()).filter((p) => p.match_id === matchId);
    api.markRead(matchId).catch(() => {});
    return {
      older: rows.length >= 50,
      rows: [
        ...rows.map((r) => ({ ...r, state: 'sent' as const })),
        ...pend.map((p) => toItem(p, myId ?? '', 'failed')),
      ],
    };
  }, [matchId, myId]);
  const applyLatest = useCallback((r: { rows: ChatItem[]; older: boolean }) => {
    merge(r.rows); setHasOlder(r.older); setError(null); setLoading(false);
  }, [merge]);
  const failLatest = useCallback(() => { setError(t('common.loadFailed')); setLoading(false); }, [t]);
  const load = useCallback(() => fetchLatest().then(applyLatest, failLatest), [fetchLatest, applyLatest, failLatest]);

  // Missed messages are fetched again after reconnecting (load() on resubscribe).
  useEffect(() => {
    if (!matchId) return;
    fetchLatest().then(applyLatest, failLatest);
    const ch = supabase
      .channel(`messages:${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` }, (payload) => {
        const row = payload.new as MessageRow;
        if (!row?.id) return;
        merge([{ ...row, state: 'sent' }]);
        if (row.sender_id !== myId) api.markRead(matchId).catch(() => {});
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') fetchLatest().then(applyLatest, failLatest); });
    return () => { supabase.removeChannel(ch); };
  }, [matchId, myId, fetchLatest, applyLatest, failLatest, merge]);

  const loadOlder = useCallback(async () => {
    if (!matchId || !hasOlder || loadingOlder) return;
    const first = itemsRef.current.find((m) => m.state === 'sent');
    setLoadingOlder(true);
    try {
      const rows = await api.messages(matchId, first?.created_at ?? null);
      merge(rows.map((r) => ({ ...r, state: 'sent' as const })));
      setHasOlder(rows.length >= 50);
    } finally {
      setLoadingOlder(false);
    }
  }, [matchId, hasOlder, loadingOlder, merge]);

  const deliver = useCallback(async (p: Pending) => {
    merge([toItem(p, myId ?? '', 'sending')]);
    try {
      let row: MessageRow;
      if (p.voice) {
        await api.uploadVoice(p.voice.path, p.voice.uri);
        row = await api.sendVoice(p.match_id, p.client_id, p.voice.path, p.voice.duration_ms);
      } else {
        row = await api.sendMessage(p.match_id, p.client_id, p.body, p.photo_path);
      }
      merge([{ ...row, state: 'sent' }]);
      await writeOutbox((await readOutbox()).filter((x) => x.client_id !== p.client_id));
      lastErr.current = null;
      return true;
    } catch (e) {
      lastErr.current = e instanceof AppError ? e.kind : 'server';
      const box = await readOutbox();
      if (!box.some((x) => x.client_id === p.client_id)) await writeOutbox([...box, p]);
      merge([toItem(p, myId ?? '', 'failed')]);
      return false;
    }
  }, [merge, myId]);

  const send = useCallback(async (body: string | null, photoPath: string | null = null) => {
    if (!matchId) return false;
    const p: Pending = { client_id: Crypto.randomUUID(), match_id: matchId, body, photo_path: photoPath, created_at: new Date().toISOString() };
    return deliver(p);
  }, [matchId, deliver]);

  // Voice: the recording is uploaded to <me>/voice/<uuid>.m4a, then sent via send_voice_message.
  const sendVoice = useCallback(async (uri: string, durationMs: number) => {
    if (!matchId || !myId) return false;
    const voice: PendingVoice = { uri, path: `${myId}/voice/${Crypto.randomUUID().toLowerCase()}.m4a`, duration_ms: Math.max(1, Math.min(120000, Math.round(durationMs))) };
    const p: Pending = { client_id: Crypto.randomUUID(), match_id: matchId, body: null, photo_path: null, voice, created_at: new Date().toISOString() };
    return deliver(p);
  }, [matchId, myId, deliver]);

  const retry = useCallback(async (clientId: string) => {
    const p = (await readOutbox()).find((x) => x.client_id === clientId);
    if (!p) return false;
    return deliver(p);
  }, [deliver]);

  const discard = useCallback(async (clientId: string) => {
    await writeOutbox((await readOutbox()).filter((x) => x.client_id !== clientId));
    setItems((cur) => cur.filter((m) => !(m.client_id === clientId && m.state !== 'sent')));
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.deleteMessage(id);
    setItems((cur) => cur.map((m) => (m.id === id ? { ...m, body: null, photo_path: null, voice_path: null, voice_duration_ms: null, local_uri: null, deleted_at: new Date().toISOString() } : m)));
  }, []);

  const reload = useCallback(() => { setLoading(true); setError(null); load(); }, [load]);
  return { items, loading, error, reload, loadOlder, hasOlder, loadingOlder, send, sendVoice, retry, discard, remove,
    /** Kind of the last delivery error (e.g. 'rate_limited'), null after a success. */
    lastErrorKind: () => lastErr.current };
}

export async function failedFor(matchId: string): Promise<Pending[]> {
  return (await readOutbox()).filter((p) => p.match_id === matchId);
}
