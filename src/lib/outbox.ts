// Offline outbox for chat messages. Pure (storage is injected), so scripts/check-client.mjs can exercise it.
// Every read-modify-write on one key goes through a promise-chain mutex, so concurrent failures never lose entries.
export type Pending = { client_id: string; match_id: string; body: string | null; photo_path: string | null; created_at: string };
export type KV = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
};

const tails = new Map<string, Promise<unknown>>();

/** Runs `fn` after every earlier task for `key` finished (whether it succeeded or not). */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.then(() => undefined, () => undefined);
  tails.set(key, tail);
  tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
  return run;
}

export const outboxKey = (uid: string) => `renvi.outbox.${uid}`;

function parse(raw: string | null): Pending[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((p) => p && typeof p.client_id === 'string' && typeof p.match_id === 'string') : [];
  } catch { return []; }
}

export function createOutbox(store: KV) {
  const read = async (key: string) => parse(await store.getItem(key));
  const write = (key: string, list: Pending[]) => store.setItem(key, JSON.stringify(list));
  return {
    /** Unsent messages of this account, optionally for one conversation (oldest first). */
    list: (uid: string, matchId?: string) => withLock(outboxKey(uid), async () => {
      const all = await read(outboxKey(uid));
      return matchId ? all.filter((p) => p.match_id === matchId) : all;
    }),
    /** Stores the message (idempotent by client_id). Must complete BEFORE the network request is made. */
    add: (uid: string, p: Pending) => withLock(outboxKey(uid), async () => {
      const k = outboxKey(uid);
      const box = await read(k);
      if (!box.some((x) => x.client_id === p.client_id)) await write(k, [...box, p]);
    }),
    /** Removes messages (server confirmed, discarded, or already present in the fetched history). */
    remove: (uid: string, clientIds: string[]) => withLock(outboxKey(uid), async () => {
      if (!clientIds.length) return;
      const k = outboxKey(uid);
      const box = await read(k);
      const next = box.filter((x) => !clientIds.includes(x.client_id));
      if (next.length !== box.length) await write(k, next);
    }),
  };
}

/**
 * Unsent items to show after fetching history: those already in `serverIds` were delivered (the app was closed before
 * the confirmation was stored) and are reported in `delivered` so the caller can drop them from the outbox.
 */
export function reconcile(pending: Pending[], serverIds: Iterable<string>): { unsent: Pending[]; delivered: string[] } {
  const seen = new Set(serverIds);
  const unsent: Pending[] = [], delivered: string[] = [];
  for (const p of pending) { if (seen.has(p.client_id)) delivered.push(p.client_id); else unsent.push(p); }
  return { unsent, delivered };
}
