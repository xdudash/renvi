// Fixed reference lists. Values come from the prototype; city list covers the launch countries.
import type { Gender, Intent, Seeking } from './api';

export const GENDERS: { key: Gender; label: string }[] = [
  { key: 'man', label: 'Мужчина' },
  { key: 'woman', label: 'Женщина' },
  { key: 'nonbinary', label: 'Небинарный человек' },
  { key: 'undisclosed', label: 'Предпочитаю не указывать' },
];
export const SEEKING: { key: Seeking; label: string }[] = [
  { key: 'men', label: 'Мужчин' },
  { key: 'women', label: 'Женщин' },
  { key: 'everyone', label: 'Всех людей' },
];
export const INTENTS: { key: Intent; label: string; desc: string; chip: string; filter: string }[] = [
  { key: 'serious', label: 'Серьёзные отношения', desc: 'Строить близость и смотреть, куда это приведёт.', chip: 'Ищу отношения', filter: 'Отношения' },
  { key: 'casual', label: 'Лёгкие встречи', desc: 'Знакомства без лишних ожиданий.', chip: 'Лёгкие встречи', filter: 'Лёгкие встречи' },
  { key: 'friends', label: 'Новые друзья', desc: 'Расширить круг близких по духу людей.', chip: 'Новые друзья', filter: 'Друзья' },
  { key: 'unsure', label: 'Пока не знаю', desc: 'Открыт(а) к разным вариантам.', chip: 'Сначала посмотрим', filter: 'Не решил(а)' },
];
export const intentChip = (k?: string | null) => INTENTS.find((i) => i.key === k)?.chip ?? '';

export const INTERESTS = ['Архитектура', 'Кофе', 'Книги', 'Музыка', 'Путешествия', 'Кино', 'Плавание', 'Кулинария', 'Дизайн'];

export const PROMPTS = [
  'Моё идеальное первое свидание —',
  'Небольшая радость недели —',
  'Зелёный флаг для меня —',
  'Навык, который мало кто ожидает —',
  'На повторе сейчас —',
  'Хочу однажды —',
  'Небольшое удовольствие —',
];

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
  { key: 'eurovea', name: 'Eurovea', sub: 'Набережная · Ружинов', icon: '☕', label: 'Eurovea · набережная' },
  { key: 'oldtown', name: 'Hlavné námestie', sub: 'Старый город', icon: '◉', label: 'Hlavné námestie · Старый город' },
  { key: 'castle', name: 'Bratislavský hrad', sub: 'Старый город · прогулка', icon: '⌂', label: 'Bratislavský hrad' },
  { key: 'sad', name: 'Sad Janka Kráľa', sub: 'Петржалка · парк', icon: '⌘', label: 'Sad Janka Kráľa' },
  { key: 'custom', name: 'Другое место', sub: 'Укажите общественное место', icon: '＋', label: 'Публичное место' },
] as const;
export const placeLabel = (key: string, custom?: string | null) =>
  key === 'custom' ? custom || 'Публичное место' : DATE_PLACES.find((p) => p.key === key)?.label ?? 'Eurovea · набережная';

export const REPORT_REASONS = [
  ['fake', 'Фальшивый профиль или выдаёт себя за другого'], ['photos', 'Фото нарушает правила'],
  ['harassment', 'Оскорбления или домогательства'], ['scam', 'Мошенничество или просьбы о деньгах'],
  ['underage', 'Кажется, человеку нет 18'], ['illegal', 'Незаконный контент'], ['other', 'Другое'],
] as const;
