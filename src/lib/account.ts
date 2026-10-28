import { supabase } from './supabase';

export async function requestDataExport(): Promise<{ emailed: boolean; url: string | null }> {
  const { data, error } = await supabase.functions.invoke('export-data', { body: {} });
  if (error) throw error;
  return data as { emailed: boolean; url: string | null };
}

export async function deleteAccount(reason: string | null): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: { reason } });
  if (error) throw error;
  await supabase.auth.signOut();
}

export type Prefs = { messages: boolean; matches: boolean; dates: boolean; likes: boolean; news: boolean; digest_push: boolean; digest_email: boolean; reduce_motion: boolean; larger_text: boolean };
export const DEFAULT_PREFS: Prefs = { messages: true, matches: true, dates: true, likes: true, news: false, digest_push: true, digest_email: false, reduce_motion: false, larger_text: false };

export async function loadPrefs(uid: string): Promise<Prefs> {
  const { data } = await supabase.from('notification_prefs').select('*').eq('user_id', uid).maybeSingle();
  return { ...DEFAULT_PREFS, ...(data ?? {}) };
}
export async function savePrefs(uid: string, p: Partial<Prefs>): Promise<void> {
  const { error } = await supabase.from('notification_prefs').upsert({ user_id: uid, ...p, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Spotify track links are resolved with the public oEmbed endpoint (no keys needed).
export async function resolveSpotify(url: string): Promise<string | null> {
  if (!/^https:\/\/open\.spotify\.com\/(intl-[a-z]+\/)?track\//.test(url.trim())) return null;
  const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url.trim())}`);
  if (!r.ok) return null;
  const j = await r.json();
  return typeof j.title === 'string' ? j.title : null;
}
