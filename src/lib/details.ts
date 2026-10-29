// "Подробнее обо мне": fixed option lists (same values as the checks in migration 0031) and display helpers.
import type { TFunction, TranslationKey } from '@/i18n';
import type { ProfileDetails } from './api';

export type DetailKey = 'kids' | 'smoking' | 'drinking' | 'workout' | 'education' | 'pets' | 'zodiac';

export const DETAIL_OPTIONS: Record<DetailKey, readonly string[]> = {
  kids: ['have', 'want', 'dont_want', 'open'],
  smoking: ['no', 'sometimes', 'yes'],
  drinking: ['no', 'socially', 'often'],
  workout: ['never', 'sometimes', 'often'],
  education: ['school', 'college', 'bachelor', 'master', 'phd'],
  pets: ['none', 'dog', 'cat', 'other'],
  zodiac: ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'],
};
export const DETAIL_ORDER: DetailKey[] = ['kids', 'smoking', 'drinking', 'workout', 'education', 'pets', 'zodiac'];
export const LANGUAGES = ['ru', 'uk', 'sk', 'cs', 'en', 'de', 'hu', 'pl', 'es', 'fr', 'it'] as const;
export const MAX_LANGUAGES = 6;

export const DETAIL_ICON: Record<DetailKey | 'height_cm' | 'languages', string> = {
  height_cm: '📏', languages: '🗣️', kids: '👶', smoking: '🚬', drinking: '🍷', workout: '🏃', education: '🎓', pets: '🐾', zodiac: '✨',
};
const ZODIAC_ICON: Record<string, string> = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋', leo: '♌', virgo: '♍',
  libra: '♎', scorpio: '♏', sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};
const PET_ICON: Record<string, string> = { none: '🐾', dog: '🐶', cat: '🐱', other: '🐾' };

export const detailTitle = (t: TFunction, k: DetailKey | 'height_cm' | 'languages') =>
  t((k === 'height_cm' ? 'details.height' : `details.${k}`) as TranslationKey);
export const detailValue = (t: TFunction, k: DetailKey, v: string) => t(`details.${k}.${v}` as TranslationKey);
export const languageLabel = (t: TFunction, code: string) => t(`details.lang.${code}` as TranslationKey);

/** Chips for a card, in a stable order: icon + label, only for values the owner filled in. */
export function detailChips(t: TFunction, d?: ProfileDetails | null): { key: string; icon: string; label: string }[] {
  if (!d) return [];
  const out: { key: string; icon: string; label: string }[] = [];
  if (d.height_cm) out.push({ key: 'height_cm', icon: DETAIL_ICON.height_cm, label: t('details.heightValue', { n: d.height_cm }) });
  for (const k of DETAIL_ORDER) {
    const v = d[k];
    if (!v) continue;
    const icon = k === 'zodiac' ? (ZODIAC_ICON[v] ?? DETAIL_ICON.zodiac) : k === 'pets' ? (PET_ICON[v] ?? DETAIL_ICON.pets) : DETAIL_ICON[k];
    out.push({ key: k, icon, label: detailValue(t, k, v) });
  }
  if (d.languages?.length) out.push({ key: 'languages', icon: DETAIL_ICON.languages, label: d.languages.map((c) => languageLabel(t, c)).join(', ') });
  return out;
}

export const filledCount = (p: Record<string, unknown> | null | undefined) =>
  !p ? 0 : (['height_cm', ...DETAIL_ORDER] as string[]).filter((k) => p[k] != null && p[k] !== '').length
    + (Array.isArray(p.languages) && p.languages.length ? 1 : 0);
