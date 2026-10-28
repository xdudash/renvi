// Share of profile filled in, used for the meter on "Готово" and "Мой профиль".
export function completeness(p: Record<string, any> | null, photos: number, prompts: number): number {
  if (!p) return 0;
  const checks = [
    !!p.display_name, !!p.age, !!p.gender, !!p.seeking, !!p.intent, !!p.city,
    photos >= 2, photos >= 4, (p.bio ?? '').length > 0, (p.interests ?? []).length > 0, prompts > 0,
    !!p.music_title, p.verification_status === 'approved' || p.verification_status === 'pending',
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
