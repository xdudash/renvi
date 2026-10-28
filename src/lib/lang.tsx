// Selected app language. Stored on the device and, when signed in, on the profile.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from './api';
import { makeT, type TFunction } from '@/i18n';

export const LANGUAGE_NAMES: Record<Lang, string> = {
  SK: 'Slovenčina', CS: 'Čeština', EN: 'English', RU: 'Русский', UA: 'Українська',
};
export const LANGUAGE_FLAGS: Record<Lang, string> = { SK: '🇸🇰', CS: '🇨🇿', EN: '🇪🇺', RU: '🇪🇺', UA: '🇺🇦' };

const KEY = 'renvi.lang';
type LangCtx = { lang: Lang; setLang: (l: Lang) => void; t: TFunction };
const Ctx = createContext<LangCtx>({ lang: 'RU', setLang: () => {}, t: makeT('RU') });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('RU');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v && v in LANGUAGE_NAMES) setLangState(v as Lang); }).catch(() => {});
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  };
  const value = useMemo(() => ({ lang, setLang, t: makeT(lang) }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx);
