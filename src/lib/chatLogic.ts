// Pure chat helpers (node-testable; lib/chat.ts imports React Native modules).

let seq = 0;
/**
 * Realtime topic for one useChat() instance. supabase-js returns the EXISTING channel for a topic that is already
 * open, so a second screen on the same conversation (message-failed / photo-failed above the chat) added
 * callbacks to / re-subscribed the chat's joined channel (throws), and its cleanup removed the chat's channel,
 * silently stopping live messages underneath. Each instance now has its own topic; the filter stays the same.
 */
export function channelTopic(matchId: string, nonce: string = Math.random().toString(36).slice(2, 10)): string {
  seq += 1;
  return `messages:${matchId}:${seq}-${nonce}`;
}

/**
 * Cursor for "older messages": created_at of the oldest delivered message, or undefined when nothing has been
 * loaded yet. With no cursor the caller must wait for the first page; asking for "before null" re-fetches the
 * newest page (what ?history=1 did when it ran before the first load finished).
 */
export function historyCursor(items: readonly { state: string; created_at: string }[]): string | undefined {
  let oldest: string | undefined;
  for (const m of items) if (m.state === 'sent' && (oldest === undefined || m.created_at < oldest)) oldest = m.created_at;
  return oldest;
}

/** Media viewer index from the `at` URL parameter, kept inside the list (NaN / out of range used to show a blank frame). */
export function clampIndex(raw: unknown, length: number): number {
  const n = Math.trunc(Number(raw ?? 0));
  if (!Number.isFinite(n) || length <= 0) return 0;
  return Math.min(Math.max(n, 0), length - 1);
}
