// Selected app language. Stored on the device and, when signed in, on the profile.
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from './api';

export const LANGUAGE_NAMES: Record<Lang, string> = {
  SK: 'Slovenčina', CS: 'Čeština', EN: 'English', RU: 'Русский', UA: 'Українська',
};
export const LANGUAGE_FLAGS: Record<Lang, string> = { SK: '🇸🇰', CS: '🇨🇿', EN: '🇪🇺', RU: '🇪🇺', UA: '🇺🇦' };

const KEY = 'renvi.lang';
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'RU', setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('RU');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v && v in LANGUAGE_NAMES) setLangState(v as Lang); }).catch(() => {});
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx);
