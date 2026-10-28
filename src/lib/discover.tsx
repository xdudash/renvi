// Discovery state shared by the card, the full profile, the media viewer and the comment screen.
import React, { createContext, useCallback, useContext, useState } from 'react';
import { router } from 'expo-router';
import { api, type DiscoverCard, type SparkResult } from './api';
import { AppError, toAppError } from './errors';

export type SparkTarget = { kind: 'profile' | 'photo' | 'prompt'; ref: string | null; label: string };
export type MatchInfo = { match_id: string; partner: { id: string; name: string; age: number; photo?: string | null } };

type Ctx = {
  cards: DiscoverCard[];
  index: number;
  current: DiscoverCard | null;
  loading: boolean;
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
  const [cards, setCards] = useState<DiscoverCard[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [likesUsed, setLikesUsed] = useState(0);
  const [target, setTarget] = useState<SparkTarget>({ kind: 'profile', ref: null, label: 'Фото из анкеты' });
  const [lastMatch, setLastMatch] = useState<MatchInfo | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [list, used] = await Promise.all([api.discover(20), api.likesToday()]);
      setCards(list); setIndex(0); setLikesUsed(used);
    } catch (e) {
      setError(e instanceof AppError ? e : toAppError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const current = cards[index] ?? null;

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const pass = useCallback(async () => {
    if (!current) return;
    await api.pass(current.profile_id);
    advance();
  }, [current, advance]);

  const undoPass = useCallback(async () => {
    const id = await api.undoPass();
    if (!id) return false;
    await load();
    return true;
  }, [load]);

  const spark = useCallback(async (card: DiscoverCard, t: SparkTarget, comment: string | null) => {
    try {
      const r = await api.spark(card.profile_id, t.kind, t.ref, comment);
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
    }
  }, []);

  const focus = useCallback((profileId: string) => {
    const i = cards.findIndex((c) => c.profile_id === profileId);
    if (i >= 0) setIndex(i);
  }, [cards]);

  return (
    <C.Provider value={{ cards, index, current, loading, error, likesUsed, load, pass, undoPass, spark, target, setTarget, lastMatch, setLastMatch, focus }}>
      {children}
    </C.Provider>
  );
}

export function useDiscover() {
  const v = useContext(C);
  if (!v) throw new Error('DiscoverProvider missing');
  return v;
}
