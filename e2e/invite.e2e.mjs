import { chromium } from 'playwright';
import { APP, ASSETS, URL as API, rest, rpc, signIn, signUp } from './api.mjs';
import { execSync } from 'node:child_process';
const b = await chromium.launch();
const mk = async (state) => b.newContext({ viewport: { width: 393, height: 852 }, ...(state ? { storageState: state } : {}) });
let n = 80;
const go = async (p, path) => { await p.goto(APP + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(900); };
const shot = async (p, name) => { await p.waitForTimeout(600); await p.screenshot({ path: `out/flow/${++n}-${name}.png` }); };
const step = async (name, fn) => { try { await fn(); console.log('ok', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); } };
const anna = await signIn('anna@renvi.test', 'renvi-test-1');
const tomas = await signIn('tomas@renvi.test', 'renvi-test-1');
const daniel = await signIn('daniel@renvi.test', 'renvi-test-1');
const psql = (sql) => execSync(`psql "${process.env.DATABASE_URL}" -tAc "${sql}"`).toString().trim();

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
  await q.getByText('Продолжить', { exact: true }).last().click();
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
await b.close();
