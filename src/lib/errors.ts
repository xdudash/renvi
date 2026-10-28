// Maps database / network errors to user-facing states. Messages are Russian strings from the prototype.
export type AppErrorKind = 'offline' | 'limit' | 'blocked' | 'not_found' | 'unauthorized' | 'server';

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
    return new AppError('offline', 'Нет соединения');
  }
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
    return new AppError('offline', 'Нет соединения');
  }
  if (err?.code === 'P0003' || msg.includes('daily limit')) return new AppError('limit', 'Лимит лайков на сегодня');
  if (err?.code === 'P0002' || msg.includes('not available')) return new AppError('not_found', 'Профиль недоступен');
  if (err?.code === '42501' || msg.includes('blocked') || msg.includes('permission denied')) {
    return new AppError('unauthorized', 'Нет доступа');
  }
  if (msg.includes('protected field')) return new AppError('unauthorized', 'Нет доступа');
  return new AppError('server', 'Не удалось загрузить. Проверьте соединение и повторите.');
}
