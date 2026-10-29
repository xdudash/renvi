import { waitForAuthEmail } from './mail.mjs';
import { chromium } from 'playwright';
import { APP, ASSETS, URL as API, rest, rpc, signIn, signUp, ensureConfirmedFixture } from './api.mjs';
import { execSync } from 'node:child_process';
import { createRunner } from './steps.mjs';
const b = await chromium.launch();
const mk = async (state) => b.newContext({ viewport: { width: 393, height: 852 }, ...(state ? { storageState: state } : {}) });
let n = 60;
let cur = null; // page used by the running step, for failure context
const diagnose = async () => cur ? `url=${cur.url().replace(APP, '')} text="${(await cur.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 400)}"` : '';
const { step, finish } = createRunner({ label: 'extra', diagnose });
const anna = await signIn('anna@renvi.test', 'renvi-test-1');
const tomas = await signIn('tomas@renvi.test', 'renvi-test-1');
const daniel = await signIn('daniel@renvi.test', 'renvi-test-1');
const psql = (sql) => execSync(`psql "${process.env.DATABASE_URL}" -tAc "${sql}"`).toString().trim();

// Admin account (granted directly in the database, as documented in SETUP).
const admin = await ensureConfirmedFixture('admin@renvi.test', 'renvi-admin-1');
psql(`insert into public.admins values ('${admin.user.id}') on conflict do nothing`);
const actx = await mk(); const ap = await actx.newPage();
const go = async (p, path) => { cur = p; await p.goto(APP + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(900); };
const shot = async (p, name) => { await p.waitForTimeout(600); await p.screenshot({ path: `out/flow/${++n}-${name}.png` }); };

await step('admin signs in through the UI', async () => {
  await go(ap, '/signin');
  await ap.getByPlaceholder('name@example.com').fill('admin@renvi.test');
  await ap.getByPlaceholder('Не менее 8 символов').fill('renvi-admin-1');
  await ap.getByText('Войти', { exact: true }).last().click();
  await ap.waitForTimeout(2500);
  await go(ap, '/admin');
  await ap.getByText('По странам').first().waitFor(); // dashboard heading and table both say it
  await shot(ap, 'admin-dashboard');
});
await step('admin approves Anna selfie', async () => {
  await go(ap, '/admin/verification');
  await ap.getByText('Подтвердить', { exact: true }).first().click();
  await ap.getByText('Подтвердить', { exact: true }).last().click(); // confirmation dialog
  await ap.waitForTimeout(1500);
  const st = psql(`select verification_status from public.profiles where id='${anna.user.id}'`);
  if (st !== 'approved') throw new Error('status ' + st);
  await shot(ap, 'admin-verification');
});
await step('admin bans Tomas from the report queue', async () => {
  await go(ap, '/admin/reports');
  await ap.getByText('Блокировка', { exact: true }).first().click();
  await ap.locator('textarea').last().fill('Просит деньги — мошенничество подтверждено'); // required moderator note
  await ap.getByText('Блокировка', { exact: true }).last().click();
  await ap.waitForTimeout(1500);
  const s = psql(`select suspended_until from public.profiles where id='${tomas.user.id}'`);
  if (s !== 'infinity') throw new Error('suspended_until ' + s);
  await shot(ap, 'admin-reports');
});
await step('admin lowers the anti-abuse daily spark limit to 1 (no rebuild)', async () => {
  await go(ap, '/admin/config');
  await ap.getByLabel('daily_spark_limit').fill('1');
  await ap.getByText('Сохранить', { exact: true }).nth(1).click(); // 2nd card: daily spark limit (1st: documents)
  await ap.waitForTimeout(1200);
  if (psql(`select value from public.app_config where key='daily_spark_limit'`) !== '1') throw new Error('not saved');
});
await step('banned Tomas sees the ban screen and can appeal', async () => {
  const c = await mk(); const p = await c.newPage();
  await go(p, '/signin');
  await p.getByPlaceholder('name@example.com').fill('tomas@renvi.test');
  await p.getByPlaceholder('Не менее 8 символов').fill('renvi-test-1');
  await p.getByText('Войти', { exact: true }).last().click();
  await p.getByText('Аккаунт заблокирован', { exact: true }).first().waitFor({ timeout: 15000 }); // title; the copy starts with the same words
  await shot(p, 'account-banned');
  await p.getByText('Подать апелляцию', { exact: true }).click();
  await p.getByPlaceholder('Опишите причину пересмотра').fill('Это недоразумение, я не просил денег.');
  await p.getByText('Отправить апелляцию', { exact: true }).click();
  await p.waitForTimeout(2000);
  if (psql(`select count(*) from public.appeals where user_id='${tomas.user.id}'`) !== '1') throw new Error('no appeal row');
  await c.close();
});
await step('Daniel hits the daily spark limit: neutral message, no upgrade offer', async () => {
  const c = await mk(); const p = await c.newPage();
  await go(p, '/signin');
  await p.getByPlaceholder('name@example.com').fill('daniel@renvi.test');
  await p.getByPlaceholder('Не менее 8 символов').fill('renvi-test-1');
  await p.getByText('Войти', { exact: true }).last().click();
  await p.waitForTimeout(2500);
  await go(p, '/discover');
  await p.getByText(/из 1 лайков осталось/).waitFor({ timeout: 10000 });
  await shot(p, 'discover-limit-config');
  const btn = p.getByLabel('Удержать искру').first();
  await btn.hover(); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
  await p.getByText('Лимит на сегодня исчерпан').waitFor({ timeout: 10000 });
  await p.getByText(/Возвращайтесь завтра/).waitFor();
  if (await p.getByText(/RENVI Plus|Premium|Подписк|тариф/i).count()) throw new Error('upsell shown on the limit screen');
  await shot(p, 'like-limit');
  await c.close();
});
const cctx = await mk('out/anna.json'); const p = await cctx.newPage();
await step('pass then undo the pass (no plan needed)', async () => {
  await go(p, '/discover');
  await p.getByLabel('Пропустить').first().click();
  await p.waitForTimeout(1200);
  await p.getByText('↶ Отменить последний пропуск').first().click();
  await p.getByText('Последний пропуск восстановлен').waitFor({ timeout: 8000 });
});
await step('delete own message', async () => {
  const match = (await rest(anna.access_token, 'matches?select=id&ended_at=is.null'))[0].id;
  const m = (await rest(anna.access_token, `messages?select=id,body&sender_id=eq.${anna.user.id}&match_id=eq.${match}`))[0];
  await go(p, `/message-actions?match=${match}&id=${m.id}&mine=1&body=${encodeURIComponent(m.body)}`);
  await p.getByText('Удалить у себя', { exact: true }).click();
  await p.getByText('Сообщение удалено').waitFor();
  const del = (await rest(anna.access_token, `messages?select=deleted_at&id=eq.${m.id}`))[0].deleted_at;
  if (!del) throw new Error('not deleted');
});
await step('block from profile menu, then unblock', async () => {
  await go(p, '/profile?id=' + daniel.user.id);
  await p.getByLabel('Действия с профилем').click();
  await p.getByText('Заблокировать', { exact: true }).click();
  await p.getByText('Кого вы исключили').waitFor();
  await shot(p, 'blocked');
  await p.getByText('Разблокировать', { exact: true }).click();
  await p.getByText('Вы никого не блокировали.').waitFor();
});
await step('sign out from settings', async () => {
  await go(p, '/settings');
  await p.getByText('Выйти из аккаунта', { exact: true }).click();
  await p.getByText('Начать знакомство').waitFor();
});
await step('sign back in', async () => {
  await go(p, '/signin');
  await p.getByPlaceholder('name@example.com').fill('anna@renvi.test');
  await p.getByPlaceholder('Не менее 8 символов').fill('renvi-test-1');
  await p.getByText('Войти', { exact: true }).last().click();
  await p.waitForURL(/\/discover/, { timeout: 15000 });
});
await step('invite link with a real code attaches the referral', async () => {
  const code = (await rpc(anna.access_token, 'my_referral')).code;
  const c = await mk(); const q = await c.newPage();
  await go(q, '/invite/' + code);
  await q.getByText(/Приглашение от Анна/).waitFor();
  await shot(q, 'invite-link');
  await q.getByText('Продолжить регистрацию', { exact: true }).click();
  await q.getByPlaceholder('name@example.com').fill('friend@renvi.test');
  await q.getByPlaceholder('Не менее 8 символов').fill('renvi-test-1');
  await q.getByRole('checkbox', { name: /Мне исполнилось 18 лет/ }).click();
  const sentAt=Date.now();
  await q.getByText('Продолжить', { exact: true }).last().click();
  await q.getByText('Письмо отправлено', { exact: true }).waitFor({ timeout: 15000 });
  const {link}=await waitForAuthEmail('friend@renvi.test',{after:sentAt});
  await q.goto(link,{waitUntil:'networkidle'});
  await q.getByText('Почта подтверждена',{exact:true}).first().waitFor({timeout:15000});
  // The authenticated callback does not change the signup metadata containing the invite code.
  await go(q,'/ob-age');
  await q.getByText('Сколько вам лет?').waitFor({ timeout: 15000 });
  const cnt = psql(`select count(*) from public.referral_signups s join auth.users u on u.id = s.invited_user where u.email='friend@renvi.test'`);
  if (cnt !== '1') throw new Error('referral not attached');
  // The new user deletes the account right away (draft profile).
  await go(q, '/delete-confirm');
  await q.getByRole('checkbox', { name: /Я понимаю/ }).click();
  await q.getByText('Удалить аккаунт', { exact: true }).last().click();
  await q.getByText('Начать знакомство').waitFor({ timeout: 15000 });
  if (psql(`select count(*) from auth.users where email='friend@renvi.test'`) !== '0') throw new Error('account still exists');
  await c.close();
});
// restore the default anti-abuse limit
psql(`update public.app_config set value = '100' where key='daily_spark_limit'`);
await finish(() => b.close());
