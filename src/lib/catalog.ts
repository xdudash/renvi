// Fixed reference lists. Values come from the prototype; city list covers the launch countries.
import type { Gender, Intent, Seeking } from './api';
import type { TFunction, TranslationKey } from '@/i18n';

export const GENDERS: { key: Gender; label: string; labelKey: TranslationKey }[] = [
  { key: 'man', label: 'Мужчина', labelKey: 'catalog.gender.man' },
  { key: 'woman', label: 'Женщина', labelKey: 'catalog.gender.woman' },
  { key: 'nonbinary', label: 'Небинарный человек', labelKey: 'catalog.gender.nonbinary' },
  { key: 'undisclosed', label: 'Предпочитаю не указывать', labelKey: 'catalog.gender.undisclosed' },
];
export const SEEKING: { key: Seeking; label: string; labelKey: TranslationKey }[] = [
  { key: 'men', label: 'Мужчин', labelKey: 'catalog.seeking.men' },
  { key: 'women', label: 'Женщин', labelKey: 'catalog.seeking.women' },
  { key: 'everyone', label: 'Всех людей', labelKey: 'catalog.seeking.everyone' },
];
export const INTENTS: { key: Intent; label: string; desc: string; chip: string; filter: string; labelKey: TranslationKey; descKey: TranslationKey; chipKey: TranslationKey; filterKey: TranslationKey }[] = [
  { key: 'serious', label: 'Серьёзные отношения', desc: 'Строить близость и смотреть, куда это приведёт.', chip: 'Ищу отношения', filter: 'Отношения', labelKey: 'catalog.intent.serious.label', descKey: 'catalog.intent.serious.desc', chipKey: 'catalog.intent.serious.chip', filterKey: 'catalog.intent.serious.filter' },
  { key: 'casual', label: 'Лёгкие встречи', desc: 'Знакомства без лишних ожиданий.', chip: 'Лёгкие встречи', filter: 'Лёгкие встречи', labelKey: 'catalog.intent.casual.label', descKey: 'catalog.intent.casual.desc', chipKey: 'catalog.intent.casual.chip', filterKey: 'catalog.intent.casual.filter' },
  { key: 'friends', label: 'Новые друзья', desc: 'Расширить круг близких по духу людей.', chip: 'Новые друзья', filter: 'Друзья', labelKey: 'catalog.intent.friends.label', descKey: 'catalog.intent.friends.desc', chipKey: 'catalog.intent.friends.chip', filterKey: 'catalog.intent.friends.filter' },
  { key: 'unsure', label: 'Пока не знаю', desc: 'Открыт(а) к разным вариантам.', chip: 'Сначала посмотрим', filter: 'Не решил(а)', labelKey: 'catalog.intent.unsure.label', descKey: 'catalog.intent.unsure.desc', chipKey: 'catalog.intent.unsure.chip', filterKey: 'catalog.intent.unsure.filter' },
];
export const intentChip = (k?: string | null) => INTENTS.find((i) => i.key === k)?.chip ?? '';

export const INTERESTS = ['Архитектура', 'Кофе', 'Книги', 'Музыка', 'Путешествия', 'Кино', 'Плавание', 'Кулинария', 'Дизайн'];
// INTERESTS values are stored on the profile as-is; these keys only translate how they are displayed.
const INTEREST_KEYS: Record<string, TranslationKey> = {
  'Архитектура': 'catalog.interest.architecture',
  'Кофе': 'catalog.interest.coffee',
  'Книги': 'catalog.interest.books',
  'Музыка': 'catalog.interest.music',
  'Путешествия': 'catalog.interest.travel',
  'Кино': 'catalog.interest.cinema',
  'Плавание': 'catalog.interest.swimming',
  'Кулинария': 'catalog.interest.cooking',
  'Дизайн': 'catalog.interest.design',
};
export const interestLabel = (t: TFunction, v: string) => (INTEREST_KEYS[v] ? t(INTEREST_KEYS[v]) : v);

export const PROMPTS = [
  'Моё идеальное первое свидание —',
  'Небольшая радость недели —',
  'Зелёный флаг для меня —',
  'Навык, который мало кто ожидает —',
  'На повторе сейчас —',
  'Хочу однажды —',
  'Небольшое удовольствие —',
];
// PROMPTS values are stored as question_key; these keys only translate how they are displayed.
const PROMPT_KEYS: Record<string, TranslationKey> = {
  'Моё идеальное первое свидание —': 'catalog.prompt.idealDate',
  'Небольшая радость недели —': 'catalog.prompt.weekJoy',
  'Зелёный флаг для меня —': 'catalog.prompt.greenFlag',
  'Навык, который мало кто ожидает —': 'catalog.prompt.surprisingSkill',
  'На повторе сейчас —': 'catalog.prompt.onRepeat',
  'Хочу однажды —': 'catalog.prompt.someday',
  'Небольшое удовольствие —': 'catalog.prompt.smallPleasure',
};
export const promptLabel = (t: TFunction, v: string) => (PROMPT_KEYS[v] ? t(PROMPT_KEYS[v]) : v);

export const COUNTRIES: [string, string, string][] = [
  ['SK', '🇸🇰', 'Slovakia'], ['CZ', '🇨🇿', 'Czechia'], ['AT', '🇦🇹', 'Austria'], ['DE', '🇩🇪', 'Germany'], ['PL', '🇵🇱', 'Poland'],
  ['HU', '🇭🇺', 'Hungary'], ['SI', '🇸🇮', 'Slovenia'], ['HR', '🇭🇷', 'Croatia'], ['IT', '🇮🇹', 'Italy'], ['FR', '🇫🇷', 'France'],
  ['ES', '🇪🇸', 'Spain'], ['PT', '🇵🇹', 'Portugal'], ['NL', '🇳🇱', 'Netherlands'], ['BE', '🇧🇪', 'Belgium'], ['LU', '🇱🇺', 'Luxembourg'],
  ['IE', '🇮🇪', 'Ireland'], ['DK', '🇩🇰', 'Denmark'], ['SE', '🇸🇪', 'Sweden'], ['FI', '🇫🇮', 'Finland'], ['EE', '🇪🇪', 'Estonia'],
  ['LV', '🇱🇻', 'Latvia'], ['LT', '🇱🇹', 'Lithuania'], ['RO', '🇷🇴', 'Romania'], ['BG', '🇧🇬', 'Bulgaria'], ['GR', '🇬🇷', 'Greece'],
  ['CY', '🇨🇾', 'Cyprus'], ['MT', '🇲🇹', 'Malta'],
];
export const AVAILABLE_COUNTRIES = ['SK', 'CZ'];

export const CITIES: Record<string, [string, string][]> = {
  SK: [
    ['Bratislava', 'Bratislavský kraj'], ['Pezinok', 'Bratislavský kraj'], ['Trnava', 'Trnavský kraj'], ['Nitra', 'Nitriansky kraj'],
    ['Trenčín', 'Trenčiansky kraj'], ['Žilina', 'Žilinský kraj'], ['Martin', 'Žilinský kraj'], ['Banská Bystrica', 'Banskobystrický kraj'],
    ['Poprad', 'Prešovský kraj'], ['Prešov', 'Prešovský kraj'], ['Košice', 'Košický kraj'],
  ],
  CZ: [
    ['Praha', 'Hlavní město Praha'], ['Brno', 'Jihomoravský kraj'], ['Ostrava', 'Moravskoslezský kraj'], ['Plzeň', 'Plzeňský kraj'],
    ['Liberec', 'Liberecký kraj'], ['Olomouc', 'Olomoucký kraj'],
  ],
};
export const COUNTRY_NAME: Record<string, string> = { SK: 'Slovensko', CZ: 'Česko' };

export const DATE_PLACES = [
  { key: 'eurovea', name: 'Eurovea', sub: 'Набережная · Ружинов', subKey: 'catalog.place.eurovea.sub', icon: '☕', label: 'Eurovea · набережная', labelKey: 'catalog.place.eurovea.label' },
  { key: 'oldtown', name: 'Hlavné námestie', sub: 'Старый город', subKey: 'catalog.place.oldtown.sub', icon: '◉', label: 'Hlavné námestie · Старый город', labelKey: 'catalog.place.oldtown.label' },
  { key: 'castle', name: 'Bratislavský hrad', sub: 'Старый город · прогулка', subKey: 'catalog.place.castle.sub', icon: '⌂', label: 'Bratislavský hrad', labelKey: 'catalog.place.castle.label' },
  { key: 'sad', name: 'Sad Janka Kráľa', sub: 'Петржалка · парк', subKey: 'catalog.place.sad.sub', icon: '⌘', label: 'Sad Janka Kráľa', labelKey: 'catalog.place.sad.label' },
  { key: 'custom', name: 'Другое место', sub: 'Укажите общественное место', icon: '＋', label: 'Публичное место', nameKey: 'catalog.place.custom.name', subKey: 'catalog.place.custom.sub', labelKey: 'catalog.place.custom.label' },
] as const;
// Pass `t` to get the label in the selected language; without it the Russian label is returned (old behaviour).
export const placeLabel = (key: string, custom?: string | null, t?: TFunction) => {
  const tr = (k: TranslationKey, ru: string) => (t ? t(k) : ru);
  if (key === 'custom') return custom || tr('catalog.place.custom.label', 'Публичное место');
  const p = DATE_PLACES.find((x) => x.key === key);
  return p ? tr(p.labelKey, p.label) : tr('catalog.place.eurovea.label', 'Eurovea · набережная');
};

export const REPORT_REASONS = [
  ['fake', 'catalog.reportReason.fake'], ['photos', 'catalog.reportReason.photos'],
  ['harassment', 'catalog.reportReason.harassment'], ['scam', 'catalog.reportReason.scam'],
  ['underage', 'catalog.reportReason.underage'], ['illegal', 'catalog.reportReason.illegal'], ['other', 'catalog.reportReason.other'],
] as const;
