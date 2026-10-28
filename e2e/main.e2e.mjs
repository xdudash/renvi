import { chromium } from 'playwright';
import { APP, ASSETS, URL as API, rest, rpc, signIn } from './api.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, storageState: 'out/anna.json' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
let n = 20;
const shot = async (name) => { await p.waitForTimeout(900); await p.screenshot({ path: `out/flow/${String(++n).padStart(2, '0')}-${name}.png` }); };
const click = async (text) => { await p.getByText(text, { exact: true }).last().click(); };
const step = async (name, fn) => { try { await fn(); console.log('ok', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); await shot('FAIL-' + name); } };
const go = async (path) => { await p.goto(APP + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); };

const anna = await signIn('anna@renvi.test', 'renvi-test-1');
const marek = await signIn('marek@renvi.test', 'renvi-test-1');
const daniel = await signIn('daniel@renvi.test', 'renvi-test-1');
const annaPrompt = (await rest(anna.access_token, 'profile_prompts?select=id&profile_id=eq.' + anna.user.id))[0];

await step('marek sparks anna on her answer (API)', async () => {
  const r = await rpc(marek.access_token, 'send_spark', { p_to: anna.user.id, p_kind: 'prompt', p_ref: annaPrompt.id, p_comment: 'Доброта к официанту — лучший тест.' });
  if (r.status !== 'sent') throw new Error(JSON.stringify(r));
});
await step('likes tab on Free shows only the count', async () => { await go('/likes'); await p.getByText(/новая искра|новые искры|новых искр/).waitFor(); await shot('likes-free'); });
await step('full profile of Marek', async () => { await go('/profile?id=' + marek.user.id); await p.getByText('О человеке').waitFor(); await shot('profile'); });
await step('media viewer', async () => { await go(`/media-viewer?id=${marek.user.id}&at=1`); await shot('media-viewer'); });
await step('hold spark → mutual match', async () => {
  await go('/profile?id=' + marek.user.id);
  const btn = p.getByLabel('Удержать искру');
  await btn.scrollIntoViewIfNeeded();
  await btn.hover();
  await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
  await p.getByText('Это взаимно.').waitFor({ timeout: 10000 });
  await shot('match');
});
let matchId;
await step('start conversation', async () => {
  await click('Начать разговор');
  await p.getByPlaceholder('Сообщение…').waitFor();
  matchId = new URL(p.url()).searchParams.get('match');
  await p.getByPlaceholder('Сообщение…').fill('Привет! Какую выставку посоветуешь на выходные?');
  await p.getByLabel('Отправить').click();
  await p.getByText('Привет! Какую выставку посоветуешь на выходные?').waitFor();
  await shot('chat-sent');
});
await step('reply from Marek arrives (API + reload)', async () => {
  await rpc(marek.access_token, 'send_message', { p_match: matchId, p_client_id: crypto.randomUUID(), p_body: 'Словацкая национальная галерея — и кофе рядом.', p_photo_path: null });
  await go('/chat?match=' + matchId);
  await p.getByText('Словацкая национальная галерея — и кофе рядом.').waitFor();
  await shot('chat');
});
await step('photo consent', async () => { await go('/photo-consent?match=' + matchId); await click('Разрешить обмен фото'); await shot('photo-consent-mine'); });
await step('propose a date', async () => {
  await go('/date-create?match=' + matchId); await shot('date-create');
  await click('Продолжить');
  await p.getByText('Когда вам удобно?').waitFor();
  await click('18:00');
  await shot('date-time');
  await click('Отправить приглашение');
  await p.getByText('Предложение отправлено').waitFor();
  await shot('date-pending');
});
await step('Marek accepts (API) → accepted ticket', async () => {
  const d = (await rest(marek.access_token, 'dates?select=id&match_id=eq.' + matchId + '&order=created_at.desc&limit=1'))[0];
  await rpc(marek.access_token, 'respond_date', { p_date: d.id, p_action: 'accept' });
  await go('/chat?match=' + matchId);
  await p.getByText(/Приглашение принято/).click();
  await p.getByText('До встречи — немного').waitFor();
  await shot('date-accepted');
});
await step('incoming date from Marek → decline', async () => {
  const d = await rpc(marek.access_token, 'propose_date', { p_match: matchId, p_place: 'castle', p_custom: null, p_day: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), p_time: '16:00', p_note: 'Прогулка к замку?' });
  await go(`/date-incoming?match=${matchId}&date=${d.id}`);
  await shot('date-incoming');
  await click('Вежливо отказаться');
  await p.getByText('Ничего страшного').waitFor();
  await shot('date-declined');
});
await step('chats list', async () => { await go('/chats'); await shot('chats'); });
await step('Plus via store webhook unlocks incoming list', async () => {
  await rpc(daniel.access_token, 'send_spark', { p_to: anna.user.id, p_kind: 'profile', p_ref: null, p_comment: null });
  const r = await fetch('' + API + '/functions/v1/revenuecat-webhook', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.REVENUECAT_WEBHOOK_SECRET, 'content-type': 'application/json' },
    body: JSON.stringify({ event: { type: 'INITIAL_PURCHASE', app_user_id: anna.user.id, entitlement_ids: ['plus'], store: 'APP_STORE', environment: 'SANDBOX', expiration_at_ms: Date.now() + 30 * 864e5 } }) });
  if (!r.ok) throw new Error('webhook ' + r.status);
  await go('/likes');
  await p.getByText('Уже выбрали вас').waitFor({ timeout: 10000 });
  await shot('likes-plus');
});
await step('incoming profile', async () => { await go('/incoming-profile?id=' + daniel.user.id); await shot('incoming-profile'); });
await step('plans shows current Plus', async () => { await go('/plans'); await shot('plans'); });
await step('report a profile → status', async () => {
  const tomas = await signIn('tomas@renvi.test', 'renvi-test-1');
  await go('/report?profile=' + tomas.user.id);
  await click('Мошенничество или просьбы о деньгах');
  await click('Отправить жалобу');
  await p.getByText('Жалоба получена').waitFor();
  await shot('report-status');
});
await step('me', async () => { await go('/me'); await shot('me'); });
await step('filters (Plus)', async () => { await go('/filters'); await shot('filters'); });
await step('referral', async () => { await go('/referral'); await p.getByText('ВАША ССЫЛКА').waitFor(); await shot('referral'); });
await step('data export via function', async () => {
  await go('/data-export'); await click('Запросить выгрузку');
  await p.getByText('Скачать файл (ссылка 24 часа)').waitFor({ timeout: 15000 });
  await shot('data-export');
});
await ctx.storageState({ path: 'out/anna.json' });
console.log(JSON.stringify({ matchId }));
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
await b.close();
