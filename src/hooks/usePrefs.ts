import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from '@/lib/account';
import { useSession } from '@/lib/session';
import { optimisticSet } from '@/lib/optimistic';

export function usePrefs() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => { if (uid) loadPrefs(uid).then(setPrefs).catch(() => {}); }, [uid]);
  // Optimistic, but rolled back when the save fails (the callers show a toast): the switch must match the server.
  const set = useCallback((k: keyof Prefs, v: boolean) =>
    optimisticSet<keyof Prefs>((fn) => setPrefs((p) => fn(p) as Prefs), k, v, async () => { if (uid) await savePrefs(uid, { [k]: v }); }),
  [uid]);
  return { prefs, set };
}
