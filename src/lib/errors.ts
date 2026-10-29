// Maps database / network errors to user-facing states. Messages follow the current app language.
import { tr } from '@/i18n/current';

export type AppErrorKind = 'offline' | 'limit' | 'rate_limited' | 'blocked' | 'not_found' | 'unauthorized' | 'server';

export class AppError extends Error {
  kind: AppErrorKind;
  constructor(kind: AppErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function toAppError(e: unknown): AppError {
  const err = e as { message?: string; code?: string; status?: number } | null;
  const msg = err?.message ?? '';
  if (!navigator?.onLine && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new AppError('offline', tr('lib.errors.offline'));
  }
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
    return new AppError('offline', tr('lib.errors.offline'));
  }
  // The app is newer than the database (function/table not deployed yet, PostgREST PGRST202/PGRST205).
  // The server is reachable, so "check your connection" would be wrong: say it is being updated.
  if (err?.code === 'PGRST202' || err?.code === 'PGRST205' || msg.includes('Could not find the function') || msg.includes('schema cache')) {
    return new AppError('server', tr('lib.errors.serverUpdating'));
  }
  // Server-side hourly rate limit (report(), submit_appeal()): SQLSTATE P0429 'rate limited'.
  if (err?.code === 'P0429' || msg.includes('rate limited')) return new AppError('rate_limited', tr('lib.errors.rateLimited'));
  if (err?.code === 'P0003' || msg.includes('daily limit')) return new AppError('limit', tr('lib.errors.limit'));
  if (err?.code === 'P0002' || msg.includes('not available')) return new AppError('not_found', tr('lib.errors.notFound'));
  // Server action guard (migration 0020): the caller's own account is suspended or banned.
  if (msg.includes('account restricted')) return new AppError('blocked', tr('lib.errors.accountRestricted'));
  if (err?.code === '42501' || msg.includes('blocked') || msg.includes('permission denied')) {
    return new AppError('unauthorized', tr('lib.errors.unauthorized'));
  }
  if (msg.includes('protected field')) return new AppError('unauthorized', tr('lib.errors.unauthorized'));
  return new AppError('server', tr('lib.errors.server'));
}
