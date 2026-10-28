import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from '@/lib/account';
import { useSession } from '@/lib/session';

export function usePrefs() {
  const { session } = useSession();
  const uid = session?.user.id;
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => { if (uid) loadPrefs(uid).then(setPrefs).catch(() => {}); }, [uid]);
  const set = useCallback(async (k: keyof Prefs, v: boolean) => {
    setPrefs((p) => ({ ...p, [k]: v }));
    if (uid) await savePrefs(uid, { [k]: v });
  }, [uid]);
  return { prefs, set };
}
