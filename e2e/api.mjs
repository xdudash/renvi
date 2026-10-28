// Thin client for a Supabase project (local or staging). Keys come from the environment, never from the repo.
export const APP = process.env.APP_URL ?? 'http://127.0.0.1:8081';
export const ASSETS = new globalThis.URL('../src/assets/images/', import.meta.url).pathname;
import fs from 'node:fs';
export const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const ANON = process.env.SUPABASE_ANON_KEY ?? '';
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const j = async (r) => { const t = await r.text(); if (!r.ok) throw new Error(r.status + ' ' + t); return t ? JSON.parse(t) : null; };
export async function signUp(email, password) {
  return j(await fetch(URL + '/auth/v1/signup', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }));
}
export async function signIn(email, password) {
  return j(await fetch(URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }));
}
export async function rpc(token, fn, args = {}) {
  return j(await fetch(URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: ANON, authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(args) }));
}
export async function rest(token, path, method = 'GET', body) {
  return j(await fetch(URL + '/rest/v1/' + path, { method, headers: { apikey: ANON, authorization: 'Bearer ' + token, 'content-type': 'application/json', prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined }));
}
export async function upload(token, path, file) {
  return j(await fetch(URL + '/storage/v1/object/profile-media/' + path, { method: 'POST', headers: { apikey: ANON, authorization: 'Bearer ' + token, 'content-type': 'image/jpeg' }, body: fs.readFileSync(file) }));
}
export async function makeProfile({ email, password, patch, photos, prompts }) {
  let s;
  try { s = await signUp(email, password); } catch { s = await signIn(email, password); }
  const t = s.access_token, uid = s.user.id;
  await rpc(t, 'save_onboarding', { p_patch: { ...patch, adult_confirmed: true, terms_accepted: true, sensitive_consent: true } });
  const have = await rest(t, 'profile_photos?select=id&profile_id=eq.' + uid);
  if (!have.length) {
    let i = 0;
    for (const f of photos) {
      const path = uid + '/profile/' + (i) + '.jpg';
      await upload(t, path, f);
      await rest(t, 'profile_photos', 'POST', { profile_id: uid, storage_path: path, position: i });
      i++;
    }
    let k = 0;
    for (const [q, a] of prompts) await rest(t, 'profile_prompts', 'POST', { profile_id: uid, question_key: q, answer: a, position: k++ });
  }
  await rpc(t, 'publish_profile');
  return { token: t, uid };
}
