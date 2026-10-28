// Realtime chat with an offline outbox: every message has a client id, so retries never duplicate.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { api, type MessageRow } from './api';
import { useLang } from './lang';

export type ChatItem = MessageRow & { state: 'sent' | 'sending' | 'failed' };
type Pending = { client_id: string; match_id: string; body: string | null; photo_path: string | null; created_at: string };

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
        ...pend.map((p) => ({ id: p.client_id, client_id: p.client_id, match_id: p.match_id, sender_id: myId ?? '', body: p.body, photo_path: p.photo_path, deleted_at: null, created_at: p.created_at, state: 'failed' as const })),
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
    merge([{ id: p.client_id, client_id: p.client_id, match_id: p.match_id, sender_id: myId ?? '', body: p.body, photo_path: p.photo_path, deleted_at: null, created_at: p.created_at, state: 'sending' }]);
    try {
      const row = await api.sendMessage(p.match_id, p.client_id, p.body, p.photo_path);
      merge([{ ...row, state: 'sent' }]);
      await writeOutbox((await readOutbox()).filter((x) => x.client_id !== p.client_id));
      return true;
    } catch {
      const box = await readOutbox();
      if (!box.some((x) => x.client_id === p.client_id)) await writeOutbox([...box, p]);
      merge([{ id: p.client_id, client_id: p.client_id, match_id: p.match_id, sender_id: myId ?? '', body: p.body, photo_path: p.photo_path, deleted_at: null, created_at: p.created_at, state: 'failed' }]);
      return false;
    }
  }, [merge, myId]);

  const send = useCallback(async (body: string | null, photoPath: string | null = null) => {
    if (!matchId) return false;
    const p: Pending = { client_id: Crypto.randomUUID(), match_id: matchId, body, photo_path: photoPath, created_at: new Date().toISOString() };
    return deliver(p);
  }, [matchId, deliver]);

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
    setItems((cur) => cur.map((m) => (m.id === id ? { ...m, body: null, photo_path: null, deleted_at: new Date().toISOString() } : m)));
  }, []);

  const reload = useCallback(() => { setLoading(true); setError(null); load(); }, [load]);
  return { items, loading, error, reload, loadOlder, hasOlder, loadingOlder, send, retry, discard, remove };
}

export async function failedFor(matchId: string): Promise<Pending[]> {
  return (await readOutbox()).filter((p) => p.match_id === matchId);
}
