import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, SIGNED_URL_SECONDS } from '@/lib/api';
import { onUserReset } from '@/lib/userState';

// Signed URLs are reused until shortly before they expire. The image cache is keyed by URL, so reusing the same URL
// (also after an app restart: the map is kept on the device) means a photo seen once is shown from disk, not
// downloaded again.
const cache = new Map<string, { url: string; at: number }>();
const TTL = (SIGNED_URL_SECONDS - 3600) * 1000; // one hour of margin before the link expires
const STORE = 'renvi.signedUrls.v1';
const MAX_STORED = 400;
const inflight = new Map<string, Promise<string>>();

const fresh = (path: string) => {
  const hit = cache.get(path);
  return hit && Date.now() - hit.at < TTL ? hit.url : null;
};

let restored: Promise<void> | null = null;
function restore() {
  restored ??= AsyncStorage.getItem(STORE)
    .then((raw) => {
      if (!raw) return;
      const rows = JSON.parse(raw) as [string, { url: string; at: number }][];
      for (const [p, v] of rows) if (!cache.has(p) && Date.now() - v.at < TTL) cache.set(p, v);
    })
    .catch(() => {});
  return restored;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const rows = [...cache.entries()].filter(([, v]) => Date.now() - v.at < TTL).slice(-MAX_STORED);
    AsyncStorage.setItem(STORE, JSON.stringify(rows)).catch(() => {});
  }, 800);
}

// Sign-out / account switch: the next account must not reuse the previous account's links.
onUserReset(() => {
  cache.clear();
  inflight.clear();
  restored = Promise.resolve();
  AsyncStorage.removeItem(STORE).catch(() => {});
});

export async function signed(path: string): Promise<string> {
  const hit = fresh(path);
  if (hit) return hit;
  await restore();
  const stored = fresh(path);
  if (stored) return stored;
  let p = inflight.get(path);
  if (!p) {
    p = api.signedUrl(path).then((url) => { cache.set(path, { url, at: Date.now() }); persist(); return url; })
      .finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

/** Sign many files in one request (feed prefetch); returns the URLs that are now known. */
export async function signedMany(paths: string[]): Promise<string[]> {
  await restore();
  const missing = [...new Set(paths)].filter((p) => !fresh(p) && !inflight.has(p));
  if (missing.length) {
    try {
      const got = await api.signedUrls(missing);
      for (const [p, url] of Object.entries(got)) cache.set(p, { url, at: Date.now() });
      persist();
    } catch { /* the single-file path signs them later */ }
  }
  return paths.map(fresh).filter((u): u is string => !!u);
}

// Short-lived signed URL for a private media file.
export function useSignedUrl(path?: string | null) {
  const [state, setState] = useState<{ path: string | null; url: string | null }>({ path: null, url: null });
  useEffect(() => {
    let alive = true;
    if (path) signed(path).then((u) => alive && setState({ path, url: u }), () => alive && setState({ path, url: null }));
    return () => { alive = false; };
  }, [path]);
  if (!path) return null;
  return state.path === path ? state.url : fresh(path);
}
