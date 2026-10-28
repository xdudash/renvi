import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const cache = new Map<string, { url: string; at: number }>();
const TTL = 50 * 60 * 1000;

export async function signed(path: string): Promise<string> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL) return hit.url;
  const url = await api.signedUrl(path);
  cache.set(path, { url, at: Date.now() });
  return url;
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
  return state.path === path ? state.url : cache.get(path)?.url ?? null;
}
