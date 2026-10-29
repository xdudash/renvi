// Pure state merge for the session provider: a failed load must not erase what was already loaded for the same user.
export type Held = { userId: string | null; profile: Record<string, any> | null };
/** `profile` is undefined when it failed to load. */
export type Loaded = { userId: string | null; profile?: Record<string, any> | null; failed: boolean };
export type Merged = Held & { loadError: boolean };

export function mergeSnapshot(prev: Held, next: Loaded): Merged {
  if (!next.userId) return { userId: null, profile: null, loadError: false };
  const same = prev.userId === next.userId; // never carry another account's data over
  return {
    userId: next.userId,
    profile: next.profile !== undefined ? next.profile : same ? prev.profile : null,
    loadError: next.failed,
  };
}
