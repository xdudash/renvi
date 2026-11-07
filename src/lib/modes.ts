import type { IconName } from '@/components/UiIcon';
import type { Goal, RelStatus } from '@/lib/api';
import type { TranslationKey } from '@/i18n';
import { localeOf } from '@/i18n/current';

/** The four statuses in the order the prototype shows them. */
export const STATUS_OPTIONS: { key: RelStatus; icon: IconName; title: TranslationKey; sub: TranslationKey }[] = [
  { key: 'single', icon: 'heart', title: 'modes.st.single', sub: 'modes.st.singleSub' },
  { key: 'relationship', icon: 'people', title: 'modes.st.relationship', sub: 'modes.st.restSub' },
  { key: 'married', icon: 'people', title: 'modes.st.married', sub: 'modes.st.restSub' },
  { key: 'couple', icon: 'couple', title: 'modes.st.couple', sub: 'modes.st.coupleSub' },
];

export const GOAL_OPTIONS: { key: Goal; icon: IconName; title: TranslationKey; sub: TranslationKey }[] = [
  { key: 'company', icon: 'people', title: 'modes.goals.company', sub: 'modes.goals.companySub' },
  { key: 'dating', icon: 'heart', title: 'modes.goals.dating', sub: 'modes.goals.datingSub' },
  { key: 'couple', icon: 'couple', title: 'modes.goals.couple', sub: 'modes.goals.coupleSub' },
  { key: 'look', icon: 'star', title: 'modes.goals.look', sub: 'modes.goals.lookSub' },
];

export const statusTitleKey = (s: RelStatus): TranslationKey => `modes.st.${s}` as TranslationKey;

/** Formats the day dating opens, in the user's language. */
export function openDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(localeOf(), { day: 'numeric', month: 'long' }); } catch { return ''; }
}
