import { tr } from '@/i18n/current';

export function validateEmail(v: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : tr('lib.validate.email');
}
export function validatePassword(v: string): string | null {
  return v.length >= 8 ? null : tr('lib.validate.password');
}
