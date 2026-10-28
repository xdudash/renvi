// Pure helper: normalises a language code coming from storage or the profile.
import type { Lang } from './api';

const CODES: readonly Lang[] = ['SK', 'CS', 'EN', 'RU', 'UA'];

export function parseLang(v: unknown): Lang | null {
  if (typeof v !== 'string') return null;
  const u = v.trim().toUpperCase();
  return (CODES as readonly string[]).includes(u) ? (u as Lang) : null;
}
