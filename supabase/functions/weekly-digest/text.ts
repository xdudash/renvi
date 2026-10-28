// Digest wording by profile language (profiles.language: SK, CS, EN, RU, UA). Russian is the fallback; to add a
// language, add an entry to DIGEST_TEXT. The text carries only a number: no names, photos or other personal data.
export type DigestText = {
  pushTitle: string;
  pushBody: (n: number) => string;
  emailSubject: string;
  emailBody: (n: number) => string;
};

// Russian plural form: 1 анкета, 2-4 анкеты, 5+ анкет (11-14 -> анкет).
export function ruProfiles(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} новая анкета`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} новые анкеты`;
  return `${n} новых анкет`;
}

export const DIGEST_TEXT: Record<string, DigestText> = {
  RU: {
    pushTitle: 'RENVI · итоги недели',
    pushBody: (n) => `На этой неделе в вашей стране ${ruProfiles(n)}, подходящих вам. Загляните в RENVI.`,
    emailSubject: 'RENVI · новые анкеты за неделю',
    emailBody: (n) =>
      `На этой неделе в вашей стране ${ruProfiles(n)}, подходящих вашим предпочтениям.\n\nОткройте RENVI, чтобы посмотреть.\n\nОтключить это письмо можно в приложении: Профиль → Уведомления.`,
  },
};

export function digestText(language: string | null | undefined): DigestText {
  return DIGEST_TEXT[(language ?? '').toUpperCase()] ?? DIGEST_TEXT.RU;
}
