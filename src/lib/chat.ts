// Realtime chat with an offline outbox: every message has a client id, so retries never duplicate.
// Send order: persist to the outbox -> request -> remove from the outbox only after the server confirmed.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { api, type MessageRow } from './api';
import { useLang } from './lang';
import { createOutbox, reconcile, type Pending } from './outbox';

export type ChatItem = MessageRow & { state: 'sent' | 'sending' | 'failed' };

const outbox = createOutbox(AsyncStorage);
const keyOf = (m: { client_id: string; sender_id: string }) => m.client_id + m.sender_id;
const sortItems = (l: ChatItem[]) => l.sort((a, b) => a.created_at.localeCompare(b.created_at));

export function useChat(matchId: string | undefined, myId: string | undefined) {
  const { t } = useLang();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const itemsRef = useRef<ChatItem[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const gen = useRef(0); // bumped by every (re)subscribe: loads started for an older conversation / account are dropped

  const toItem = useCallback((p: Pending, state: ChatItem['state']): ChatItem => (
    { id: p.client_id, client_id: p.client_id, match_id: p.match_id, sender_id: myId ?? '', body: p.body, photo_path: p.photo_path, deleted_at: null, created_at: p.created_at, state }
  ), [myId]);

  const merge = useCallback((rows: ChatItem[]) => {
    setItems((cur) => {
      const map = new Map<string, ChatItem>();
      for (const m of cur) map.set(keyOf(m), m);
      for (const m of rows) map.set(keyOf(m), m);
      return sortItems([...map.values()]);
    });
  }, []);
  // Adds only what is not on screen yet (an unsent copy must never replace a sending / sent one).
  const mergeMissing = useCallback((rows: ChatItem[]) => {
    setItems((cur) => {
      const have = new Set(cur.map(keyOf));
      const add = rows.filter((r) => !have.has(keyOf(r)));
      return add.length ? sortItems([...cur, ...add]) : cur;
    });
  }, []);

  // Outbox first (shown even when history cannot be loaded), then the latest page.
  const loadAll = useCallback(async (alive: () => boolean) => {
    if (!matchId) return;
    let pend: Pending[] = [];
    if (myId) { try { pend = await outbox.list(myId, matchId); } catch { pend = []; } }
    if (!alive()) return;
    if (pend.length) mergeMissing(pend.map((p) => toItem(p, 'failed')));
    try {
      const rows = await api.messages(matchId);
      if (!alive()) return;
      const { delivered } = reconcile(pend, rows.map((r) => r.client_id));
      if (myId && delivered.length) outbox.remove(myId, delivered).catch(() => {});
      merge(rows.map((r) => ({ ...r, state: 'sent' as const })));
      setHasOlder(rows.length >= 50);
      setError(null);
      api.markRead(matchId).catch(() => {});
    } catch {
      if (alive()) setError(t('common.loadFailed'));
    } finally {
      if (alive()) setLoading(false);
    }
  }, [matchId, myId, merge, mergeMissing, toItem, t]);

  // Missed messages are fetched again after reconnecting (loadAll() on resubscribe).
  useEffect(() => {
    if (!matchId) return;
    const my = ++gen.current;
    let dead = false;
    const alive = () => !dead && gen.current === my;
    loadAll(alive);
    const ch = supabase
      .channel(`messages:${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` }, (payload) => {
        const row = payload.new as MessageRow;
        if (!row?.id) return;
        merge([{ ...row, state: 'sent' }]);
        if (row.sender_id !== myId) api.markRead(matchId).catch(() => {});
        else if (myId) outbox.remove(myId, [row.client_id]).catch(() => {});
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') loadAll(alive); });
    return () => { dead = true; supabase.removeChannel(ch); };
  }, [matchId, myId, loadAll, merge]);

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

  // The message is already in the outbox when this runs; it leaves the outbox only after the server answered.
  const deliver = useCallback(async (p: Pending) => {
    merge([toItem(p, 'sending')]);
    try {
      const row = await api.sendMessage(p.match_id, p.client_id, p.body, p.photo_path);
      merge([{ ...row, state: 'sent' }]);
      if (myId) await outbox.remove(myId, [p.client_id]).catch(() => {});
      return true;
    } catch {
      merge([toItem(p, 'failed')]);
      return false;
    }
  }, [merge, toItem, myId]);

  /** `onStored` fires once the message is safely in the outbox (before the request), e.g. to clear the composer. */
  const send = useCallback(async (body: string | null, photoPath: string | null = null, onStored?: () => void) => {
    if (!matchId) return false;
    const p: Pending = { client_id: Crypto.randomUUID(), match_id: matchId, body, photo_path: photoPath, created_at: new Date().toISOString() };
    if (myId) { try { await outbox.add(myId, p); } catch { /* storage unavailable: still send, kept in memory only */ } }
    onStored?.();
    return deliver(p);
  }, [matchId, myId, deliver]);

  const retry = useCallback(async (clientId: string) => {
    let p: Pending | undefined;
    if (myId) { try { p = (await outbox.list(myId)).find((x) => x.client_id === clientId); } catch { /* fall back to memory */ } }
    if (!p) {
      const m = itemsRef.current.find((x) => x.client_id === clientId && x.state === 'failed');
      if (m) p = { client_id: m.client_id, match_id: m.match_id, body: m.body, photo_path: m.photo_path, created_at: m.created_at };
    }
    if (!p) return false;
    if (myId) await outbox.add(myId, p).catch(() => {});
    return deliver(p);
  }, [deliver, myId]);

  const discard = useCallback(async (clientId: string) => {
    if (myId) await outbox.remove(myId, [clientId]).catch(() => {});
    setItems((cur) => cur.filter((m) => !(m.client_id === clientId && m.state !== 'sent')));
  }, [myId]);

  const remove = useCallback(async (id: string) => {
    await api.deleteMessage(id);
    setItems((cur) => cur.map((m) => (m.id === id ? { ...m, body: null, photo_path: null, deleted_at: new Date().toISOString() } : m)));
  }, []);

  const reload = useCallback(() => {
    setLoading(true); setError(null);
    const my = gen.current;
    loadAll(() => gen.current === my);
  }, [loadAll]);
  return { items, loading, error, reload, loadOlder, hasOlder, loadingOlder, send, retry, discard, remove };
}

export async function failedFor(uid: string | undefined, matchId: string): Promise<Pending[]> {
  if (!uid) return [];
  return outbox.list(uid, matchId);
}
