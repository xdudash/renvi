// Registry for module-level, per-user client state (composer drafts, date draft, ...). SessionProvider calls
// resetUserState() whenever the signed-in user changes, so nothing leaks from one account to the next.
const resetters = new Set<() => void>();

export function onUserReset(fn: () => void): () => void {
  resetters.add(fn);
  return () => { resetters.delete(fn); };
}

export function resetUserState(): void {
  for (const fn of resetters) {
    try { fn(); } catch { /* one failing reset must not block the others */ }
  }
}
