// Selected app language. Stored on the device and, when signed in, on the profile.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from './api';
import { makeT, type TFunction } from '@/i18n';
import { setCurrentLang } from '@/i18n/current';
import { parseLang } from './langCode';

export const LANGUAGE_NAMES: Record<Lang, string> = {
  SK: 'Slovenčina', CS: 'Čeština', EN: 'English', RU: 'Русский', UA: 'Українська',
};
export const LANGUAGE_FLAGS: Record<Lang, string> = { SK: '🇸🇰', CS: '🇨🇿', EN: '🇪🇺', RU: '🇪🇺', UA: '🇺🇦' };

const KEY = 'renvi.lang';
type LangCtx = {
  lang: Lang; setLang: (l: Lang) => void; t: TFunction;
  // Applies the language stored on the profile; ignored once the user picked one in this session.
  applyProfileLang: (v: unknown) => void;
};
const Ctx = createContext<LangCtx>({ lang: 'RU', setLang: () => {}, t: makeT('RU'), applyProfileLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('RU');
  const chosen = useRef(false); // true once the user explicitly picked a language in this session
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      const l = parseLang(v);
      if (l && !chosen.current) setLangState(l);
    }).catch(() => {});
  }, []);
  const setLang = useCallback((l: Lang) => {
    chosen.current = true;
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);
  const applyProfileLang = useCallback((v: unknown) => {
    if (v == null) return; // profile language is NULL until the user explicitly saves one
    const l = parseLang(v);
    if (!l || chosen.current) return;
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);
  setCurrentLang(lang); // keep non-React code (errors, validation, date formats) in sync before children render
  const value = useMemo(
    () => ({ lang, setLang, t: makeT(lang), applyProfileLang }),
    [lang, setLang, applyProfileLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx);
