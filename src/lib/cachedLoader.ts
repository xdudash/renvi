// Pure: share one in-flight / recent result between many callers. Every Screen mounts its own TabBar, and each
// TabBar called incoming_sparks() for the badge, so every navigation ran that query again (a per-screen N+1).
export function createCachedLoader<T>(load: () => Promise<T>, ttlMs: number, now: () => number = () => Date.now()) {
  let entry: { key: string; at: number; promise: Promise<T> } | null = null;
  return {
    /** Result for `key` (e.g. the user id); reused while younger than ttlMs. A failure is not cached. */
    get(key: string): Promise<T> {
      if (entry && entry.key === key && now() - entry.at < ttlMs) return entry.promise;
      const promise = load();
      const mine = { key, at: now(), promise };
      entry = mine;
      promise.catch(() => { if (entry === mine) entry = null; });
      return promise;
    },
    invalidate() { entry = null; },
  };
}
