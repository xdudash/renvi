// Invitation draft shared by "Создать", "Место" and "Дата и время".
export type DateDraft = { match: string; place: string; custom: string; day: string; time: string; note: string };
let draft: DateDraft = { match: '', place: 'eurovea', custom: '', day: '', time: '16:00', note: '' };
export const getDateDraft = () => draft;
export const setDateDraft = (p: Partial<DateDraft>) => { draft = { ...draft, ...p }; };
export const resetDateDraft = (match: string) => { draft = { match, place: 'eurovea', custom: '', day: '', time: '16:00', note: '' }; };

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayLong = (isoDay: string) => { const d = new Date(`${isoDay}T12:00:00`); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const dayParts = (d: Date) => ({ wd: DAYS[d.getDay()], num: String(d.getDate()), mon: MONTHS_SHORT[d.getMonth()] });

// "Эта неделя" = today until Sunday; "Следующая" = next Monday–Sunday.
export function weekDays(which: 'this' | 'next'): Date[] {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const out: Date[] = [];
  if (which === 'this') {
    for (let i = 0; i <= 6 - dow; i++) { const d = new Date(today); d.setDate(today.getDate() + i); out.push(d); }
  } else {
    for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(today.getDate() + (7 - dow) + i); out.push(d); }
  }
  return out;
}
export const DATE_TIMES = ['14:00', '16:00', '18:00', '19:30'];
