// Tiny i18n core. Pure TypeScript (no React Native imports) so scripts can load it too.
import { ru, type Dictionary, type TranslationKey } from './ru.ts';
import { sk } from './sk.ts';
import { cs } from './cs.ts';
import { en } from './en.ts';
import { ua } from './ua.ts';

export type { TranslationKey } from './ru.ts';
export type LangCode = 'SK' | 'CS' | 'EN' | 'RU' | 'UA'; // same values as `Lang` in lib/api

const DICTS: Record<LangCode, Dictionary> = { RU: ru, SK: sk, CS: cs, EN: en, UA: ua };

export type TParams = Record<string, string | number>;

/** Translate `key` into `lang`; falls back to Russian when the key is missing or empty. */
export function translate(lang: LangCode, key: TranslationKey, params?: TParams): string {
  const text: string = DICTS[lang]?.[key] || ru[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m: string, name: string) => (name in params ? String(params[name]) : m));
}

export type TFunction = (key: TranslationKey, params?: TParams) => string;
export const makeT = (lang: LangCode): TFunction => (key, params) => translate(lang, key, params);
