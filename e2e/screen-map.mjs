// Every app screen with the URL that shows it and who views it (0 = signed out, 1 = Anna).
// Needs the e2e data (run-all.sh) to exist: a match, dates, a message and a report.
import { rest, rpc, signIn } from './api.mjs';

// Screens whose redirect on a cold URL load is their intended behaviour. The inventory requires the row to land
// exactly on `to`; anything else (or a redirect from a screen not listed here) fails the run.
export const expectedRedirects = {
  match: { to: '/chats', why: 'The match celebration needs the in-memory result of the spark that just matched; a cold load has none and goes to the conversations list.' },
};
export const publicScreenMap = {
  welcome: ['/', 0], language: ['/language', 0], signin: ['/signin', 0], signup: ['/signup', 0], forgot: ['/forgot', 0],
  confirmation: ['/confirmation?email=anna%40renvi.test', 0], 'invite-not-found': ['/invite-not-found', 0],
};
export async function buildScreenMap() {
  const anna = await signIn('anna@renvi.test', 'renvi-test-1');
  const marek = await signIn('marek@renvi.test', 'renvi-test-1');
  const daniel = await signIn('daniel@renvi.test', 'renvi-test-1');
  const match = (await rest(anna.access_token, 'matches?select=id&ended_at=is.null'))[0]?.id;
  if (!match) throw new Error('Mobile QA requires a seeded active match; run e2e/run-all.sh first.');
  const dates = await rest(anna.access_token, `dates?select=id,status&match_id=eq.${match}&order=created_at.desc`);
  const dAcc = dates.find((d) => d.status === 'accepted')?.id, dDec = dates.find((d) => d.status === 'declined')?.id;
  const msg = (await rest(anna.access_token, `messages?select=id,body,sender_id&match_id=eq.${match}&order=created_at.asc`));
  const mine = msg.find((m) => m.sender_id === anna.user.id);
  const report = (await rest(anna.access_token, 'reports?select=id&order=created_at.desc&limit=1'))[0]?.id;
  // A real invite code: the old hard-coded code ANNA does not exist and redirected to /invite-not-found.
  const invite = (await rpc(anna.access_token, 'my_referral'))?.code;
  if (!dAcc || !dDec || !mine || !report || !invite) throw new Error('Mobile QA fixtures incomplete: expected accepted/declined dates, own message, report and invite code. Run e2e/run-all.sh first.');
  const M = `match=${match}`;
  const map = {
    welcome: ['/', 0], language: ['/language', 0], signin: ['/signin', 0], signup: ['/signup', 0], forgot: ['/forgot', 0],
    confirmation: ['/confirmation?email=anna%40renvi.test', 0], captcha: ['/captcha?email=x', 0], 'invite-link': [`/invite/${encodeURIComponent(invite)}`, 0], 'invite-not-found': ['/invite-not-found', 0],
    'ob-age': ['/ob-age', 1], 'ob-gender': ['/ob-gender', 1], 'ob-seeking': ['/ob-seeking', 1], 'ob-intent': ['/ob-intent', 1], 'ob-city': ['/ob-city', 1],
    'ob-photos': ['/ob-photos', 1], 'ob-about': ['/ob-about', 1], 'ob-prompts': ['/ob-prompts', 1], 'ob-location': ['/ob-location', 1], 'ob-verify': ['/ob-verify', 1],
    'ob-review': ['/ob-review', 1], 'verification-pending': ['/verification-pending', 1], 'verification-approved': ['/verification-approved', 1],
    'verification-rejected': ['/verification-rejected', 1], 'ob-done': ['/ob-done', 1],
    discover: ['/discover', 1], profile: [`/profile?id=${marek.user.id}`, 1], 'media-viewer': [`/media-viewer?id=${marek.user.id}&at=1`, 1], 'like-note': [`/like-note?id=${daniel.user.id}`, 1],
    filters: ['/filters', 1], 'location-permission': ['/location-permission', 1], 'like-limit': ['/like-limit', 1],
    offline: ['/offline', 1], 'error-retry': ['/error-retry', 1], likes: ['/likes', 1],
    'incoming-profile': [`/incoming-profile?id=${daniel.user.id}`, 1], match: ['/match', 1],
    chats: ['/chats', 1], icebreakers: [`/icebreakers?${M}`, 1], 'push-prompt': [`/push-prompt?${M}`, 1], chat: [`/chat?${M}`, 1],
    'photo-consent': [`/photo-consent?${M}`, 1], 'photo-failed': [`/photo-failed?${M}`, 1],
    'message-failed': [`/message-failed?${M}&client=x&body=${encodeURIComponent('Могу показать место у набережной.')}`, 1], 'message-deleted': [`/message-deleted?${M}`, 1],
    'message-actions': [`/message-actions?${M}&id=${mine?.id}&mine=1&body=${encodeURIComponent(mine?.body ?? '')}`, 1], archive: ['/archive', 1], muted: [`/muted?${M}`, 1],
    unmatch: [`/unmatch?${M}`, 1], 'support-share': [`/support-share?${M}`, 1],
    'date-create': [`/date-create?${M}`, 1], 'date-place': [`/date-place?${M}`, 1], 'date-time': [`/date-time?${M}`, 1], 'date-pending': [`/date-pending?${M}&date=${dAcc}`, 1],
    'date-incoming': [`/date-incoming?${M}&date=${dDec}`, 1], 'date-accepted': [`/date-accepted?${M}&date=${dAcc}`, 1], 'date-declined': [`/date-declined?${M}`, 1], 'date-cancelled': [`/date-cancelled?${M}`, 1],
    me: ['/me', 1], 'edit-profile': ['/edit-profile', 1], 'edit-media': ['/edit-media', 1], 'edit-prompts': ['/edit-prompts', 1], 'opening-moves': ['/opening-moves', 1],
    'edit-music': ['/edit-music', 1], 'edit-details': ['/edit-details', 1], 'privacy-visibility': ['/privacy-visibility', 1], settings: ['/settings', 1], 'privacy-data': ['/privacy-data', 1],
    'support-help': ['/support-help', 1], 'notification-settings': ['/notification-settings', 1], legal: ['/legal', 1], 'data-export': ['/data-export', 1],
    'delete-account': ['/delete-account', 1], 'delete-confirm': ['/delete-confirm', 1], blocked: ['/blocked', 1],
    referral: ['/referral', 1], 'referral-info': ['/referral-info', 1],
    'share-sheet': ['/share-sheet?url=https%3A%2F%2Frenvi.app%2Finvite%2FAN-1234', 1],
    safety: ['/safety', 1], report: [`/report?profile=${daniel.user.id}`, 1], 'report-status': [`/report-status?id=${report}`, 1], appeal: [`/appeal?id=${report}`, 1],
    'community-rules': ['/community-rules', 1], 'not-found': ['/not-found', 1], 'account-warning': ['/account-warning', 1],
    'account-suspended': ['/account-suspended', 1], 'account-banned': ['/account-banned', 1],
  };
  return map;
}
