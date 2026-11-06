import type { IconName } from '@/components/UiIcon';
import type { TranslationKey } from '@/i18n';
import { localeOf } from '@/i18n/current';

export type PlanCategory = 'market' | 'rink' | 'mountains' | 'thermal' | 'club' | 'quiz' | 'sport' | 'games' | 'cinema' | 'food' | 'culture' | 'trip' | 'meet' | 'other';
export type PlanAudience = 'all' | 'women' | 'men' | 'couples';
export type MyPlanStatus = 'host' | 'pending' | 'going' | 'declined' | 'cancelled' | 'left' | null;

export type Plan = {
  id: string; category: PlanCategory; title: string; starts_at: string; price_text: string | null; area: string;
  place: string | null; place_hidden: boolean; max_people: number; going: number; audience: PlanAudience;
  age_min: number | null; age_max: number | null; description: string | null; bring: string[]; auto_accept: boolean;
  status: 'active' | 'cancelled'; open: boolean; boosted: boolean;
  host: { id: string; name: string; age: number | null };
  is_host: boolean; my_status: MyPlanStatus; faces: { id: string; name: string }[];
  host_stats?: { plans: number; people: number };
  pending?: number; my_rating?: 'meh' | 'ok' | 'fire' | null;
};
export type PlanRequest = { user_id: string; name: string; age: number | null; message: string | null; status: string | null; plans: number };
export type PlanMessage = { id: string; user_id: string; name: string; host: boolean; body: string; created_at: string };
export type PlanDraft = {
  category: PlanCategory; title: string; starts_at: string; price_text: string; area: string; place: string; max_people: number;
  audience: PlanAudience; age_min: number | null; age_max: number | null; description: string; bring: string[]; auto_accept: boolean;
};

/** Look of each category (tint and ink are from the prototype's plan cards). */
export const PLAN_CATEGORIES: { key: PlanCategory; icon: IconName; tint: string; ink: string; label: TranslationKey }[] = [
  { key: 'market', icon: 'gift', tint: '#F3E1DE', ink: '#9A2B26', label: 'plans.cat.market' },
  { key: 'rink', icon: 'snow', tint: '#DDEAF4', ink: '#1F5C8A', label: 'plans.cat.rink' },
  { key: 'mountains', icon: 'mountain', tint: '#E4E9EF', ink: '#3B4E66', label: 'plans.cat.mountains' },
  { key: 'thermal', icon: 'spa', tint: '#DCEFEA', ink: '#1E6B5C', label: 'plans.cat.thermal' },
  { key: 'club', icon: 'music', tint: '#2A2633', ink: '#E8DDF7', label: 'plans.cat.club' },
  { key: 'quiz', icon: 'bulb', tint: '#F3ECDD', ink: '#7A5A12', label: 'plans.cat.quiz' },
  { key: 'sport', icon: 'ball', tint: '#D4E4DA', ink: '#22603C', label: 'plans.cat.sport' },
  { key: 'games', icon: 'dice', tint: '#F3ECDD', ink: '#7A5A12', label: 'plans.cat.games' },
  { key: 'cinema', icon: 'film', tint: '#E8E4F2', ink: '#4A3E7A', label: 'plans.cat.cinema' },
  { key: 'food', icon: 'pot', tint: '#F6E6D5', ink: '#8A4B12', label: 'plans.cat.food' },
  { key: 'culture', icon: 'book', tint: '#E9E4DC', ink: '#5E5852', label: 'plans.cat.culture' },
  { key: 'trip', icon: 'train', tint: '#DDEAF4', ink: '#1F5C8A', label: 'plans.cat.trip' },
  { key: 'meet', icon: 'people', tint: '#F3E1DE', ink: '#9A2B26', label: 'plans.cat.meet' },
  { key: 'other', icon: 'plus', tint: '#EFEAE3', ink: '#5E5852', label: 'plans.cat.other' },
];
export const categoryOf = (k: string) => PLAN_CATEGORIES.find((c) => c.key === k) ?? PLAN_CATEGORIES[PLAN_CATEGORIES.length - 1];
/** The idea tiles of the feed ("ИДЕИ НА ЗИМУ") and the chip row use these subsets. */
export const IDEA_CATEGORIES: { key: PlanCategory; sub: TranslationKey }[] = [
  { key: 'market', sub: 'plans.idea.market' }, { key: 'rink', sub: 'plans.idea.rink' }, { key: 'mountains', sub: 'plans.idea.mountains' },
  { key: 'thermal', sub: 'plans.idea.thermal' }, { key: 'quiz', sub: 'plans.idea.quiz' }, { key: 'club', sub: 'plans.idea.club' },
];
export const FEED_CHIPS: PlanCategory[] = ['market', 'rink', 'mountains', 'thermal', 'club', 'quiz', 'sport', 'games', 'food', 'culture', 'trip', 'meet'];
export const CREATE_CATEGORIES: PlanCategory[] = ['market', 'rink', 'mountains', 'thermal', 'club', 'quiz', 'sport', 'games', 'cinema', 'food', 'trip', 'other'];

export type DayKey = 'all' | 'today' | 'tomorrow' | 'weekend' | 'later';
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Local-time day buckets used by the feed. "weekend" is the nearest Saturday-Sunday that is not today or tomorrow. */
export function dayOf(iso: string, now = new Date()): Exclude<DayKey, 'all'> {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  const wd = d.getDay();
  if (diff <= 7 && (wd === 0 || wd === 6)) return 'weekend';
  return 'later';
}
export const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString(localeOf(), { weekday: 'short' })} · ${d.toLocaleTimeString(localeOf(), { hour: '2-digit', minute: '2-digit' })}`;
};
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString(localeOf(), { weekday: 'long', day: 'numeric', month: 'long' });
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(localeOf(), { hour: '2-digit', minute: '2-digit' });
export const minutesTo = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 60000);
