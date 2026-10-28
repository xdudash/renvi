// Pure state merge for the session provider: a failed load must not erase what was already loaded for the same user.
export type Tier = 'free' | 'plus' | 'premium';
export type Held = { userId: string | null; profile: Record<string, any> | null; tier: Tier };
/** `profile`/`tier` are undefined when that part failed to load. */
export type Loaded = { userId: string | null; profile?: Record<string, any> | null; tier?: Tier; failed: boolean };
export type Merged = Held & { loadError: boolean };

export function mergeSnapshot(prev: Held, next: Loaded): Merged {
  if (!next.userId) return { userId: null, profile: null, tier: 'free', loadError: false };
  const same = prev.userId === next.userId; // never carry another account's data over
  return {
    userId: next.userId,
    profile: next.profile !== undefined ? next.profile : same ? prev.profile : null,
    tier: next.tier !== undefined ? next.tier : same ? prev.tier : 'free',
    loadError: next.failed,
  };
}
