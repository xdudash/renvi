import { useState } from 'react';

// Form value that follows server data until the user edits it (profile may arrive after the screen opens).
export function useDraft<T>(server: T): [T, (v: T) => void] {
  const [local, setLocal] = useState<{ v: T } | null>(null);
  return [local ? local.v : server, (v: T) => setLocal({ v })];
}
