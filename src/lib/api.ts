// Typed wrappers over the database RPCs in supabase/migrations. Every call is made as the signed-in user.
import { supabase } from './supabase';
import { toAppError } from './errors';

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args ?? {});
  if (error) throw toAppError(error);
  return data as T;
}

export type Gender = 'man' | 'woman' | 'nonbinary' | 'undisclosed';
export type Seeking = 'men' | 'women' | 'everyone';
export type Intent = 'serious' | 'casual' | 'friends' | 'unsure';
export type Lang = 'SK' | 'CS' | 'EN' | 'RU' | 'UA';

export type PhotoRow = { id: string; kind: 'photo' | 'video'; path: string };
export type PromptRow = { id?: string; question: string; answer: string };

export type DiscoverCard = {
  profile_id: string;
  display_name: string;
  age: number;
  city: string;
  intent: Intent;
  interests: string[];
  verified: boolean;
  distance: string;
  music_title: string | null;
  prompts: PromptRow[];
  photos: PhotoRow[];
};

export type IncomingSpark = {
  profile_id: string;
  name: string;
  age: number;
  city: string;
  comment: string | null;
  target_kind: 'profile' | 'photo' | 'prompt';
  target_ref: string | null;
  created_at: string;
  /** Cover photo path and verification (migration 0030); undefined on an older database. */
  photo?: string | null;
  verified?: boolean;
};

export type MatchRow = {
  match_id: string;
  partner_id: string;
  partner_name: string;
  partner_age: number;
  last_body: string | null;
  last_at: string | null;
  unread: number;
  muted: boolean;
  archived: boolean;
  created_at: string;
  /** Partner cover photo path and verification (migration 0030); undefined on an older database. */
  partner_photo?: string | null;
  partner_verified?: boolean;
};

export type MessageRow = {
  id: string;
  client_id: string;
  match_id: string;
  sender_id: string;
  body: string | null;
  photo_path: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type DateRow = {
  id: string;
  match_id: string;
  proposer_id: string;
  place_key: 'eurovea' | 'oldtown' | 'castle' | 'sad' | 'custom';
  place_custom: string | null;
  day: string;
  starts_at: string;
  note: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
};

export type MatchContext = {
  match_id: string;
  partner: { id: string; name: string; age: number; verified: boolean; show_active: boolean; updated_at: string | null; photo: string | null };
  spark: { from_me: boolean; kind: 'profile' | 'photo' | 'prompt'; comment: string | null; prompt: { question: string; answer: string } | null } | null;
  my_photo_consent: boolean;
  their_photo_consent: boolean;
  muted: boolean;
  archived: boolean;
  their_read_at: string | null;
  opening_moves: string[];
  their_prompts: { question: string; answer: string }[];
  their_interests: string[];
  latest_date: DateRow | null;
};

export type SparkResult = { status: 'sent' } | { status: 'match'; match_id: string };

export const api = {
  discover: (limit = 20) => rpc<DiscoverCard[]>('discover', { p_limit: limit }),
  likesToday: () => rpc<number>('likes_today'),
  pass: (to: string) => rpc<void>('pass_profile', { p_to: to }),
  undoPass: () => rpc<string | null>('undo_last_pass'),
  spark: (to: string, kind: 'profile' | 'photo' | 'prompt', ref: string | null, comment: string | null) =>
    rpc<SparkResult>('send_spark', { p_to: to, p_kind: kind, p_ref: ref, p_comment: comment }),
  incoming: () => rpc<{ count: number; items: IncomingSpark[] }>('incoming_sparks'),
  matches: () => rpc<MatchRow[]>('list_matches'),
  messages: (matchId: string, before?: string | null) =>
    rpc<MessageRow[]>('list_messages', { p_match: matchId, p_before: before ?? null, p_limit: 50 }),
  sendMessage: (matchId: string, clientId: string, body: string | null, photoPath: string | null) =>
    rpc<MessageRow>('send_message', { p_match: matchId, p_client_id: clientId, p_body: body, p_photo_path: photoPath }),
  deleteMessage: (id: string) => rpc<void>('delete_own_message', { p_message: id }),
  markRead: (matchId: string) => rpc<void>('mark_match_read', { p_match: matchId }),
  matchSettings: (matchId: string, patch: { muted?: boolean; archived?: boolean }) =>
    rpc<void>('set_match_settings', { p_match: matchId, p_muted: patch.muted ?? null, p_archived: patch.archived ?? null }),
  photoConsent: (matchId: string, allowed: boolean) =>
    rpc<void>('set_photo_consent', { p_match: matchId, p_allowed: allowed }),
  endMatch: (matchId: string) => rpc<void>('end_match', { p_match: matchId }),
  proposeDate: (matchId: string, place: string, custom: string | null, day: string, time: string, note: string | null) =>
    rpc<DateRow>('propose_date', { p_match: matchId, p_place: place, p_custom: custom, p_day: day, p_time: time, p_note: note }),
  respondDate: (dateId: string, action: 'accept' | 'decline') =>
    rpc<DateRow>('respond_date', { p_date: dateId, p_action: action }),
  cancelDate: (dateId: string) => rpc<DateRow>('cancel_date', { p_date: dateId }),
  block: (user: string) => rpc<void>('block_user', { p_user: user }),
  unblock: (user: string) => rpc<void>('unblock_user', { p_user: user }),
  report: (target: string | null, message: string | null, reason: string, details: string | null) =>
    rpc<{ id: string; status: string }>('report', {
      p_target_profile: target,
      p_target_message: message,
      p_reason: reason,
      p_details: details,
    }),
  appeal: (reportId: string, details: string) => rpc<{ id: string }>('submit_appeal', { p_report: reportId, p_details: details }),
  support: (topic: string | null, body: string, includeHistory: boolean) =>
    rpc<{ id: string }>('submit_support', { p_topic: topic, p_body: body, p_include_history: includeHistory }),
  saveOnboarding: (patch: Record<string, unknown>) => rpc<Record<string, unknown>>('save_onboarding', { p_patch: patch }),
  publish: () => rpc<Record<string, unknown>>('publish_profile'),
  registerPush: (token: string, platform: 'ios' | 'android') =>
    rpc<void>('register_push_token', { p_token: token, p_platform: platform }),
  config: async <T>(key: string): Promise<T | null> => {
    const { data, error } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
    if (error) throw toAppError(error);
    return (data?.value as T) ?? null;
  },
  // `uid` comes from the already-known session. Without it we read the stored session (no network call).
  // A failed auth lookup throws instead of returning null: null means "no profile row yet", and the
  // gate would wrongly send an existing user back to onboarding.
  myProfile: async (uid?: string) => {
    if (!uid) {
      const { data: sess, error: sessError } = await supabase.auth.getSession();
      if (sessError) throw toAppError(sessError);
      uid = sess.session?.user.id;
      if (!uid) return null;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) throw toAppError(error);
    if (!data) return null;
    const identity=await rpc<Record<string,unknown>|null>('my_identity');
    return {...data,...identity};
  },
  myPhotos: async (profileId: string) => {
    const { data, error } = await supabase
      .from('profile_photos')
      .select('id, kind, storage_path, position, verified')
      .eq('profile_id', profileId)
      .order('position');
    if (error) throw toAppError(error);
    return data ?? [];
  },
  myPrompts: async (profileId: string) => {
    const { data, error } = await supabase
      .from('profile_prompts')
      .select('id, question_key, answer, position')
      .eq('profile_id', profileId)
      .order('position');
    if (error) throw toAppError(error);
    return data ?? [];
  },
  // '*' rather than a column list: product_id (migration 0021) is optional for the app.
  subscription: async (userId: string): Promise<{ tier: string; expires_at: string | null; product_id?: string | null }> => {
    const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw toAppError(error);
    return data ?? { tier: 'free' as const, expires_at: null, product_id: null };
  },
  saveFilters: (f: { ageMin: number; ageMax: number; distance: number; verifiedOnly: boolean; intents: string[] }) =>
    rpc<void>('save_filters', { p_age_min: f.ageMin, p_age_max: f.ageMax, p_distance: f.distance, p_verified: f.verifiedOnly, p_intents: f.intents }),
  profileCard: (id: string) => rpc<(DiscoverCard & { bio: string; music_url: string | null }) | null>('profile_card', { p_id: id }),
  matchContext: (matchId: string) => rpc<MatchContext | null>('match_context', { p_match: matchId }),
  supportChat: (matchId: string | null, body: string, includeHistory: boolean) =>
    rpc<{ id: string }>('submit_support_chat', { p_match: matchId, p_body: body, p_include_history: includeHistory }),
  getDate: async (id: string): Promise<DateRow | null> => {
    const { data, error } = await supabase.from('dates').select('*').eq('id', id).maybeSingle();
    if (error) throw toAppError(error);
    return (data as DateRow) ?? null;
  },
  stats: () => rpc<Record<string, number>>('admin_stats', { p_country: null }),
  uploadPhoto: async (ownerId: string, uri: string, mime: string, folder: 'profile' | 'verify' | 'chat' = 'profile'): Promise<string> => {
    const ext = mime.startsWith('video') ? 'mp4' : 'jpg';
    const path = `${ownerId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const body = await (await fetch(uri)).arrayBuffer();
    const { error } = await supabase.storage.from('profile-media').upload(path, body, { contentType: mime });
    if (error) throw toAppError(error);
    return path;
  },
  signedUrl: async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from('profile-media').createSignedUrl(path, 3600);
    if (error) throw toAppError(error);
    return data.signedUrl;
  },
};
