import { onUserReset } from './userState';

// Composer drafts per conversation (kept in memory while the app is open; cleared when the account changes).
const drafts = new Map<string, string>();
export const getDraft = (m: string) => drafts.get(m) ?? '';
export const setDraft = (m: string, v: string) => { drafts.set(m, v); };
export const clearDrafts = () => { drafts.clear(); };
onUserReset(clearDrafts);
