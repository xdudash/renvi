// Pure route-guard rules used by components/Gate.tsx (no React Native imports, so scripts/check-client.mjs can run them).
import { nextOnboardingRoute } from './onboarding.ts';

type P = Record<string, any> | null;

export const PUBLIC = ['/', '/language', '/signin', '/signup', '/forgot', '/reset-password', '/auth-callback', '/confirmation', '/captcha', '/invite-not-found', '/legal', '/community-rules', '/support-help', '/not-found', '/safety'];
// Account controls stay reachable with an unfinished profile (deletion and data export must always be available).
export const ACCOUNT_OK = ['/profile', '/media-viewer', '/settings', '/delete-account', '/delete-confirm', '/data-export', '/privacy-data', '/legal', '/support-help', '/community-rules', '/safety', '/language'];
export const ONBOARDING_OK = (p: string) => p.startsWith('/admin') || p.startsWith('/ob-') || p.startsWith('/verification-') || ACCOUNT_OK.includes(p);
// Banned / suspended users: sanction screens, appeal and support, and the data-rights screens (export, privacy, account
// deletion) which must never be blocked.
export const RESTRICTED_OK = [
  '/appeal', '/support-help', '/support-share', '/data-export', '/report-status', '/legal', '/community-rules',
  '/account-suspended', '/account-banned', '/account-warning', '/settings',
  '/privacy-data', '/delete-account', '/delete-confirm', '/reset-password',
];

export const isBanned = (p: P) => p?.suspended_until === 'infinity' || (p?.suspended_until && new Date(p.suspended_until).getFullYear() > 9000);
export const isSuspended = (p: P, now: Date = new Date()) => !!p?.suspended_until && !isBanned(p) && new Date(p.suspended_until) > now;

/** Where the guard sends the user from `path`, or null to leave them where they are. */
export function gateTarget(path: string, signedIn: boolean, profile: P, loadError = false, now: Date = new Date(), emailConfirmed = true): string | null {
  const isPublic = PUBLIC.includes(path) || path.startsWith('/invite/');
  if (!signedIn) return isPublic ? null : '/';
  if (!emailConfirmed && !isPublic && !ACCOUNT_OK.includes(path)) return '/confirmation';
  if (isBanned(profile)) return RESTRICTED_OK.includes(path) ? null : '/account-banned';
  if (isSuspended(profile, now)) return RESTRICTED_OK.includes(path) ? null : '/account-suspended';
  // A failed profile load is not "no profile": never push an existing user back to onboarding because of it.
  if (!profile && loadError) return null;
  if (!profile?.onboarding_done && !isPublic && !ONBOARDING_OK(path)) return nextOnboardingRoute(profile);
  return null;
}
