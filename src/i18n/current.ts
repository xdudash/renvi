// Module-level current language for code that runs outside React (errors, validation, date helpers).
// LangProvider keeps it in sync; React components should keep using useLang().t.
import { translate, type LangCode, type TParams, type TranslationKey } from './index.ts';

let current: LangCode = 'RU';
export const getLang = (): LangCode => current;
export const setCurrentLang = (l: LangCode): void => { current = l; };

/** Translate into the current language (plain function, no hooks). */
export const tr = (key: TranslationKey, params?: TParams): string => translate(current, key, params);

const LOCALES: Record<LangCode, string> = { RU: 'ru-RU', SK: 'sk-SK', CS: 'cs-CZ', EN: 'en-GB', UA: 'uk-UA' };
/** BCP 47 locale for date/time formatting in the given (default: current) language. */
export const localeOf = (l: LangCode = current): string => LOCALES[l] ?? 'ru-RU';
