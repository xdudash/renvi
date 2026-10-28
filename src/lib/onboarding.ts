// Onboarding order from the prototype: 12 numbered steps.
export const ONBOARDING = ['ob-age', 'ob-gender', 'ob-seeking', 'ob-intent', 'ob-city', 'ob-photos', 'ob-about',
  'ob-prompts', 'ob-location', 'ob-verify', 'ob-review', 'ob-done'] as const;
export type OnbRoute = (typeof ONBOARDING)[number];

export function nextOnboardingRoute(profile: Record<string, any> | null): string {
  const step = Math.max(0, Math.min(ONBOARDING.length - 1, Number(profile?.onboarding_step ?? 0)));
  return `/${ONBOARDING[step]}`;
}
export const stepIndex = (r: OnbRoute) => ONBOARDING.indexOf(r);
