// Pure: tells a network failure apart from a real Auth refusal. Sign-in showed "wrong e-mail or password" when the
// phone was simply offline (supabase-js returns AuthRetryableFetchError with status 0 / "Failed to fetch").
export function isNetworkAuthError(err: { name?: string; status?: number; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.name === 'AuthRetryableFetchError') return true;
  if (err.status === 0) return true;
  return /failed to fetch|network request failed|networkerror|load failed/i.test(err.message ?? '');
}
