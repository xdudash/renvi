/** A cleared composer must always have a durable copy, even if local storage is full/unavailable. */
export async function durableSend(store: () => Promise<unknown>, deliver: () => Promise<boolean>, onStored?: () => void): Promise<boolean> {
  try { await store(); } catch { return false; }
  onStored?.();
  return deliver();
}
