// Pure date/time slot rules for the invitation flow (local device time, no i18n, node-testable).
// Bug fixed: the time picker offered today's 14:00 at 18:00, and a draft day kept from an earlier visit
// (yesterday, or a day of the other week tab) was still sent although it was no longer shown.

export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Times that are still ahead on `day` (all of them for a future day, none for a past day). */
export function selectableTimes(day: string, times: readonly string[], now: Date): string[] {
  const today = isoDay(now);
  if (day > today) return [...times];
  if (day < today) return [];
  const minutes = now.getHours() * 60 + now.getMinutes();
  return times.filter((tm) => {
    const [h, m] = tm.split(':').map(Number);
    return h * 60 + m > minutes;
  });
}

/** `day` if it is one of the offered days, otherwise nothing selected. */
export const pickDay = (day: string, offered: readonly string[]) => (offered.includes(day) ? day : '');

/** `time` if still selectable, otherwise the first selectable one ('' when none). */
export const pickTime = (time: string, available: readonly string[]) => (available.includes(time) ? time : available[0] ?? '');

export const isPastDay = (day: string, now: Date) => !day || day < isoDay(now);
