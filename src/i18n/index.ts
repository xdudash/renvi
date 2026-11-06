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

/**
 * Plural forms. A string may contain `{n#one|few|many}`: the form is picked by the number in the parameter `n`.
 * Russian/Ukrainian: 1, 21 -> one; 2-4, 22-24 -> few; the rest (and 11-14) -> many. Slovak/Czech: 1 -> one; 2-4 -> few;
 * the rest -> many. English: 1 -> first form, everything else -> the LAST form (the middle one is unused).
 */
export function pluralForm(lang: LangCode, n: number): 0 | 1 | 2 {
  const a = Math.abs(Math.trunc(n));
  if (lang === 'EN') return a === 1 ? 0 : 2;
  if (lang === 'SK' || lang === 'CS') return a === 1 ? 0 : a >= 2 && a <= 4 ? 1 : 2;
  const m10 = a % 10, m100 = a % 100;
  if (m10 === 1 && m100 !== 11) return 0;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 1;
  return 2;
}

/** Translate `key` into `lang`; falls back to Russian when the key is missing or empty. */
export function translate(lang: LangCode, key: TranslationKey, params?: TParams): string {
  const text: string = DICTS[lang]?.[key] || ru[key];
  if (!params) return text;
  return text
    .replace(/\{(\w+)#([^|}]*)\|([^|}]*)\|([^}]*)\}/g, (m: string, name: string, ...forms: string[]) => {
      const n = Number(params[name]);
      return Number.isFinite(n) ? forms[pluralForm(lang, n)] : m;
    })
    .replace(/\{(\w+)\}/g, (m: string, name: string) => (name in params ? String(params[name]) : m));
}

export type TFunction = (key: TranslationKey, params?: TParams) => string;
export const makeT = (lang: LangCode): TFunction => (key, params) => translate(lang, key, params);
