// Wording of the evening «all well?» push by profile language (profiles.language: SK, CS, EN, RU, UA).
// Russian is the fallback. The text carries no plan title, place or names.
export type PlanCheckText = { title: string; body: string };

export const PLAN_CHECK_TEXT: Record<string, PlanCheckText> = {
  RU: { title: 'RENVI · как прошёл план?', body: 'Всё ок? Ответьте в один тап — а если что-то не так, мы рядом.' },
  UA: { title: 'RENVI · як минув план?', body: 'Усе гаразд? Відповідь в один дотик — а якщо щось не так, ми поруч.' },
  SK: { title: 'RENVI · ako prebehol plán?', body: 'Všetko v poriadku? Odpovedz jedným ťuknutím — a ak nie, sme nablízku.' },
  CS: { title: 'RENVI · jak proběhl plán?', body: 'Všechno v pořádku? Odpověz jedním klepnutím — a když ne, jsme nablízku.' },
  EN: { title: 'RENVI · how did the plan go?', body: 'All well? Answer with one tap — and if something is off, we are here.' },
};

export function planCheckText(language: string | null | undefined): PlanCheckText {
  return PLAN_CHECK_TEXT[(language ?? '').toUpperCase()] ?? PLAN_CHECK_TEXT.RU;
}
