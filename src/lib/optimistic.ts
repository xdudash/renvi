// Pure: optimistic boolean setting with rollback. Notification / accessibility toggles flipped on screen and stayed
// flipped when the save failed, so the screen claimed a setting the server did not have.
export async function optimisticSet<K extends string>(
  update: (fn: (s: Record<K, boolean>) => Record<K, boolean>) => void,
  key: K,
  value: boolean,
  save: () => Promise<void>,
): Promise<void> {
  let previous: boolean | undefined;
  update((s) => { previous = s[key]; return { ...s, [key]: value }; });
  try {
    await save();
  } catch (e) {
    // Roll back only if nothing else changed the value meanwhile (a later tap wins).
    update((s) => (s[key] === value && previous !== undefined ? { ...s, [key]: previous } : s));
    throw e;
  }
}
