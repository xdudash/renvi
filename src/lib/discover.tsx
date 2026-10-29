// Discovery state shared by the card, the full profile, the media viewer and the comment screen.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { api, type DiscoverCard, type SparkResult } from './api';
import { AppError, toAppError } from './errors';
import { useLang } from '@/lib/lang';
import { useSession } from '@/lib/session';

export type SparkTarget = { kind: 'profile' | 'photo' | 'prompt'; ref: string | null; label: string };
export type MatchInfo = { match_id: string; partner: { id: string; name: string; age: number; photo?: string | null } };

const PAGE = 20;
const REFILL_AT = 3; // fetch the next page when this many cards (or fewer) are left

type Ctx = {
  cards: DiscoverCard[];
  index: number;
  current: DiscoverCard | null;
  loading: boolean;
  /** True while the first page loads, a further page is being fetched, or the list ran out and a refetch is about to start. */
  pending: boolean;
  error: AppError | null;
  likesUsed: number;
  load: () => Promise<void>;
  pass: () => Promise<void>;
  undoPass: () => Promise<boolean>;
  spark: (card: DiscoverCard, target: SparkTarget, comment: string | null) => Promise<SparkResult | null>;
  target: SparkTarget;
  setTarget: (t: SparkTarget) => void;
  lastMatch: MatchInfo | null;
  setLastMatch: (m: MatchInfo | null) => void;
  focus: (profileId: string) => void;
};

const C = createContext<Ctx | null>(null);

export function DiscoverProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const { session } = useSession();
  const uid = session?.user.id ?? null;
  const initialTarget = useCallback((): SparkTarget => ({ kind: 'profile', ref: null, label: t('lib.discover.photoFromProfile') }), [t]);
  const [cards, setCards] = useState<DiscoverCard[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exhausted, setExhausted] = useState(false); // the server returned nothing new
  const [error, setError] = useState<AppError | null>(null);
  const [moreError, setMoreError] = useState<AppError | null>(null);
  const [likesUsed, setLikesUsed] = useState(0);
  const [target, setTarget] = useState<SparkTarget>(initialTarget);
  const [lastMatch, setLastMatch] = useState<MatchInfo | null>(null);

  const cardsRef = useRef<DiscoverCard[]>([]);
  useEffect(() => { cardsRef.current = cards; }, [cards]);
  const epoch = useRef(0);               // bumped on account change: results of older requests are dropped
  const busyIds = useRef(new Set<string>()); // in-flight pass/spark per card
  const moreInFlight = useRef(false);

  // Account changed: nothing of the previous user (cards, goal, last match, counters) may survive.
  const [owner, setOwner] = useState(uid);
  if (owner !== uid) {
    setOwner(uid);
    setCards([]); setIndex(0); setLoading(false); setLoadingMore(false); setLoaded(false); setExhausted(false);
    setError(null); setMoreError(null); setLikesUsed(0); setTarget(initialTarget()); setLastMatch(null);
  }
  useEffect(() => {
    epoch.current++;
    busyIds.current.clear();
    moreInFlight.current = false;
    cardsRef.current = [];
  }, [uid]);

  const load = useCallback(async () => {
    const my = epoch.current;
    setLoading(true); setError(null); setMoreError(null);
    try {
      const [list, used] = await Promise.all([api.discover(PAGE), api.likesToday()]);
      if (my !== epoch.current) return;
      setCards(list); setIndex(0); setLikesUsed(used); setExhausted(list.length === 0); setLoaded(true);
    } catch (e) {
      if (my === epoch.current) setError(e instanceof AppError ? e : toAppError(e));
    } finally {
      if (my === epoch.current) setLoading(false);
    }
  }, []);

  // Next page: the server already excludes passed / sparked profiles, so a refetch yields new people.
  const loadMore = useCallback(async () => {
    if (moreInFlight.current) return;
    moreInFlight.current = true;
    const my = epoch.current;
    setLoadingMore(true);
    try {
      const list = await api.discover(PAGE);
      if (my !== epoch.current) return;
      const have = new Set(cardsRef.current.map((c) => c.profile_id));
      const fresh = list.filter((c) => !have.has(c.profile_id));
      if (fresh.length) setCards((cs) => [...cs, ...fresh.filter((c) => !cs.some((x) => x.profile_id === c.profile_id))]);
      else setExhausted(true);
      setMoreError(null);
    } catch (e) {
      if (my === epoch.current) setMoreError(e instanceof AppError ? e : toAppError(e));
    } finally {
      if (my === epoch.current) { moreInFlight.current = false; setLoadingMore(false); }
    }
  }, []);

  const current = cards[index] ?? null;
  const remaining = cards.length - index;
  useEffect(() => {
    if (loaded && !loading && !loadingMore && !exhausted && !moreError && !error && remaining <= REFILL_AT) loadMore();
  }, [loaded, loading, loadingMore, exhausted, moreError, error, remaining, loadMore]);

  // Empty is real only when the server returned nothing; a failed refetch is an error, not "no one left".
  const pending = loading || loadingMore || (!current && !error && !moreError && (!loaded || !exhausted));
  const shownError = error ?? (current ? null : moreError);

  const pass = useCallback(async () => {
    const card = cards[index];
    if (!card || busyIds.current.has(card.profile_id)) return; // double tap: one request per card
    const id = card.profile_id;
    busyIds.current.add(id);
    const my = epoch.current;
    try {
      await api.pass(id);
      if (my !== epoch.current) return;
      // Advance only if that card is still the one on screen (never skip a different card).
      setIndex((i) => (cardsRef.current[i]?.profile_id === id ? i + 1 : i));
    } finally {
      busyIds.current.delete(id);
    }
  }, [cards, index]);

  const undoPass = useCallback(async () => {
    const id = await api.undoPass();
    if (!id) return false;
    await load();
    return true;
  }, [load]);

  const spark = useCallback(async (card: DiscoverCard, t: SparkTarget, comment: string | null) => {
    if (busyIds.current.has(card.profile_id)) return null;
    busyIds.current.add(card.profile_id);
    const my = epoch.current;
    try {
      const r = await api.spark(card.profile_id, t.kind, t.ref, comment);
      if (my !== epoch.current) return r;
      setLikesUsed((n) => n + 1);
      setCards((cs) => cs.filter((c) => c.profile_id !== card.profile_id));
      if (r.status === 'match') {
        setLastMatch({ match_id: r.match_id, partner: { id: card.profile_id, name: card.display_name, age: card.age, photo: card.photos[0]?.path } });
      }
      return r;
    } catch (e) {
      const err = e instanceof AppError ? e : toAppError(e);
      if (err.kind === 'limit') { router.push('/like-limit'); return null; }
      if (err.kind === 'offline') { router.push('/offline'); return null; }
      throw err;
    } finally {
      busyIds.current.delete(card.profile_id);
    }
  }, []);

  const focus = useCallback((profileId: string) => {
    const i = cards.findIndex((c) => c.profile_id === profileId);
    if (i >= 0) setIndex(i);
  }, [cards]);

  return (
    <C.Provider value={{ cards, index, current, loading, pending, error: shownError, likesUsed, load, pass, undoPass, spark, target, setTarget, lastMatch, setLastMatch, focus }}>
      {children}
    </C.Provider>
  );
}

export function useDiscover() {
  const v = useContext(C);
  if (!v) throw new Error('DiscoverProvider missing');
  return v;
}
