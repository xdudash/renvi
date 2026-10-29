// Regression checks for the client bugs fixed in docs/BUGFIX_LOG.md (pure logic, Node type stripping, no RN).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lib = (p) => import(new URL(`../../src/lib/${p}.ts`, import.meta.url).href);
const src = (p) => fs.readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');

test('B1 date screens follow the real invitation status', async () => {
  const { dateView } = await lib('dateStatus');
  assert.equal(dateView('pending', false).canRespond, true);
  assert.equal(dateView('pending', true).canRespond, false, 'the proposer never answers their own invitation');
  assert.equal(dateView('pending', true).canCancel, true);
  for (const s of ['accepted', 'declined', 'cancelled']) assert.equal(dateView(s, false).canRespond, false, `${s} must not offer accept/decline`);
  assert.equal(dateView('declined', true).canCancel, false);
  assert.equal(dateView('cancelled', false).canCancel, false);
  assert.equal(dateView('accepted', false).chipKey, 'screens.dateAccepted.prinyato');
  assert.equal(dateView(null, false).canRespond, true, 'unknown (loading) keeps the original pending behaviour');
});

test('B2 date-time offers only days/times still ahead and drops a stale draft day', async () => {
  const { selectableTimes, pickDay, pickTime, isPastDay, isoDay } = await lib('dateSlots');
  const times = ['14:00', '16:00', '18:00', '19:30'];
  const now = new Date(2026, 9, 29, 17, 5); // 29 Oct 2026 17:05 local
  assert.deepEqual(selectableTimes('2026-10-29', times, now), ['18:00', '19:30']);
  assert.deepEqual(selectableTimes('2026-10-30', times, now), times);
  assert.deepEqual(selectableTimes('2026-10-28', times, now), []);
  assert.deepEqual(selectableTimes('2026-10-29', times, new Date(2026, 9, 29, 19, 30)), [], 'exactly 19:30 is not ahead');
  assert.equal(pickDay('2026-10-27', ['2026-10-29', '2026-10-30']), '');
  assert.equal(pickDay('2026-10-30', ['2026-10-29', '2026-10-30']), '2026-10-30');
  assert.equal(pickTime('14:00', ['18:00', '19:30']), '18:00');
  assert.equal(pickTime('19:30', ['18:00', '19:30']), '19:30');
  assert.equal(pickTime('16:00', []), '');
  assert.equal(isPastDay('', now), true);
  assert.equal(isPastDay('2026-10-28', now), true);
  assert.equal(isPastDay(isoDay(now), now), false);
});

test('B3 a button runs one async handler at a time', async () => {
  const { runGuarded } = await lib('pressGuard');
  const state = { busy: false };
  let calls = 0, release;
  const handler = () => { calls++; return new Promise((r) => { release = r; }); };
  assert.equal(runGuarded(state, handler), true);
  assert.equal(runGuarded(state, handler), false, 'second tap while pending is dropped');
  assert.equal(calls, 1);
  release(); await new Promise((r) => setTimeout(r, 0));
  assert.equal(runGuarded(state, handler), true, 'enabled again after it settled');
  const failing = { busy: false };
  runGuarded(failing, () => Promise.reject(new Error('x')));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(failing.busy, false, 'a rejected handler releases the button');
  const sync = { busy: false }; let n = 0;
  runGuarded(sync, () => { n++; }); runGuarded(sync, () => { n++; });
  assert.equal(n, 2, 'synchronous handlers are not throttled');
});

test('B4 push taps open only app routes, once', async () => {
  const { pushRoute, responseKey } = await lib('pushRoute');
  assert.equal(pushRoute({ route: '/chat?match=1' }), '/chat?match=1');
  assert.equal(pushRoute({ route: '/video-call?match=1' }), '/video-call?match=1');
  assert.equal(pushRoute({ route: '/discover' }), '/discover');
  for (const bad of ['//evil.example/x', 'https://evil.example', '/admin/users', '/\\evil', 'chat', 5, null]) assert.equal(pushRoute({ route: bad }), null, String(bad));
  assert.equal(pushRoute(null), null);
  assert.equal(responseKey({ notification: { request: { identifier: 'n1' } } }), 'n1');
  assert.equal(responseKey(null), null);
  const layout = src('app/_layout.tsx');
  assert.match(layout, /getLastNotificationResponseAsync/, 'cold-start tap must be handled');
  assert.match(layout, /handledPushes/, 'the launch tap must not open twice');
});

test('B5 the tab badge shares one incoming_sparks request', async () => {
  const { createCachedLoader } = await lib('cachedLoader');
  let t = 0, loads = 0, fail = false;
  const c = createCachedLoader(async () => { loads++; if (fail) throw new Error('x'); return loads; }, 1000, () => t);
  await Promise.all([c.get('u1'), c.get('u1'), c.get('u1')]);
  assert.equal(loads, 1);
  t = 999; await c.get('u1'); assert.equal(loads, 1);
  t = 1000; await c.get('u1'); assert.equal(loads, 2, 'expires after ttl');
  await c.get('u2'); assert.equal(loads, 3, 'another account reloads');
  fail = true; await c.get('u3').catch(() => {}); fail = false;
  await c.get('u3'); assert.equal(loads, 5, 'a failure is not cached');
  assert.match(src('components/ui.tsx'), /createCachedLoader\(\(\) => api\.incoming\(\)/);
});

test('B6 every chat hook instance gets its own Realtime topic', async () => {
  const { channelTopic, historyCursor, clampIndex } = await lib('chatLogic');
  const a = channelTopic('m1'), b = channelTopic('m1');
  assert.notEqual(a, b);
  assert.ok(a.startsWith('messages:m1:'));
  assert.doesNotMatch(src('lib/chat.ts'), /\.channel\(`messages:\$\{matchId\}`\)/, 'shared topic would collide with message-failed / photo-failed');
  // B7 history cursor: nothing loaded -> no request; otherwise the oldest delivered message.
  assert.equal(historyCursor([]), undefined);
  assert.equal(historyCursor([{ state: 'failed', created_at: '2026-01-01' }]), undefined);
  assert.equal(historyCursor([{ state: 'sent', created_at: '2026-02-01' }, { state: 'sent', created_at: '2026-01-15' }, { state: 'failed', created_at: '2026-01-01' }]), '2026-01-15');
  // B8 media viewer index from the URL.
  assert.equal(clampIndex('1', 4), 1);
  assert.equal(clampIndex('9', 4), 3);
  assert.equal(clampIndex('abc', 4), 0);
  assert.equal(clampIndex('-2', 4), 0);
  assert.equal(clampIndex('2', 0), 0);
});

test('B9 offline sign-in is not reported as a wrong password', async () => {
  const { isNetworkAuthError } = await lib('authErrors');
  assert.equal(isNetworkAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }), true);
  assert.equal(isNetworkAuthError({ message: 'Network request failed' }), true);
  assert.equal(isNetworkAuthError({ status: 400, message: 'Invalid login credentials' }), false);
  assert.equal(isNetworkAuthError(null), false);
  for (const f of ['app/signin.tsx', 'app/signup.tsx', 'app/forgot.tsx']) assert.match(src(f), /isNetworkAuthError\(err\)/, f);
});

test('B10 a failed settings save rolls the switch back', async () => {
  const { optimisticSet } = await lib('optimistic');
  let state = { messages: true, news: false };
  const update = (fn) => { state = fn(state); };
  await assert.rejects(optimisticSet(update, 'news', true, async () => { throw new Error('offline'); }));
  assert.equal(state.news, false);
  await optimisticSet(update, 'news', true, async () => {});
  assert.equal(state.news, true);
});

test('B11 catalog values are shown in the selected language', async () => {
  const { makeT } = await import(new URL('../../src/i18n/index.ts', import.meta.url).href);
  const { intentChip, placeLabel } = await lib('catalog');
  const en = makeT('EN');
  assert.equal(intentChip('serious', en), en('catalog.intent.serious.chip'));
  assert.equal(intentChip('nope', en), '');
  assert.equal(placeLabel('oldtown', null, en), en('catalog.place.oldtown.label'));
  // Call sites must pass `t` (the one-argument forms return the Russian originals).
  const files = ['components/Profile.tsx', 'app/profile.tsx', 'app/ob-done.tsx', 'hooks/useDate.ts', 'app/date-create.tsx', 'app/filters.tsx', 'app/ob-intent.tsx', 'app/date-place.tsx', 'app/video-call.tsx'];
  for (const f of files) {
    const s = src(f);
    assert.doesNotMatch(s, /intentChip\([^,()]*\)/, `${f}: intentChip without t`);
    assert.doesNotMatch(s, /placeLabel\([^,()]*,[^,()]*\)/, `${f}: placeLabel without t`);
    assert.doesNotMatch(s, /label=\{i\.filter\}|\{i\.label\}|\{i\.desc\}|\{p\.sub\}/, `${f}: untranslated catalog field`);
    assert.doesNotMatch(s, /'ru-RU'/, `${f}: hard-coded locale`);
  }
  assert.match(src('components/ui.tsx'), /promptLabel\(t, question\)/, 'prompt questions are translated in PromptCard');
});

test('B12 hold-to-spark buttons work with VoiceOver', () => {
  const ui = src('components/ui.tsx');
  const spark = ui.slice(ui.indexOf('export function SparkButton'), ui.indexOf('export function HoldButton'));
  const hold = ui.slice(ui.indexOf('export function HoldButton'), ui.indexOf('export function Pill'));
  for (const [name, s] of [['SparkButton', spark], ['HoldButton', hold]]) {
    assert.match(s, /accessibilityActions=\{\[\{ name: 'activate' \}\]\}/, `${name} declares activate`);
    assert.match(s, /onAccessibilityAction=/, `${name} handles activate`);
  }
});

test('B13 stack screens refresh when focused again', () => {
  for (const f of ['app/chats.tsx', 'app/archive.tsx', 'app/me.tsx', 'app/edit-profile.tsx', 'app/likes.tsx', 'app/chat.tsx']) {
    assert.match(src(f), /useReloadOnFocus\(/, `${f} keeps stale data after back navigation`);
  }
  const chat = src('app/chat.tsx');
  assert.match(chat, /<Chat key=\{match/, 'conversation state is keyed by match');
  assert.match(chat, /getDraft\(match\)/, 'icebreaker opener reaches the composer on return');
});

test('B14 saved prompts / opening moves are replaced atomically and never overwritten after a failed load', () => {
  const prompts = src('hooks/usePrompts.ts');
  assert.match(prompts, /rpc\('save_prompts'/);
  assert.doesNotMatch(prompts, /from\('profile_prompts'\)\.delete\(\)/);
  assert.match(prompts, /if \(error\) throw error;/);
  const moves = src('app/opening-moves.tsx');
  assert.match(moves, /rpc\('save_opening_moves'/);
  assert.doesNotMatch(moves, /from\('opening_moves'\)\.delete\(\)/);
  assert.match(moves, /loadState !== 'ok'/);
});

test('B15 lists use the photo returned by list_matches / incoming_sparks (no per-row profile_card)', () => {
  assert.match(src('components/ChatRow.tsx'), /m\.partner_photo !== undefined/);
  assert.match(src('app/likes.tsx'), /it\.photo !== undefined/);
});

test('B16 report status and blocked list distinguish a load error from an empty list', () => {
  assert.match(src('app/report-status.tsx'), /if \(error\) return/);
  assert.match(src('app/blocked.tsx'), /error \? <ErrorRetryState/);
});
