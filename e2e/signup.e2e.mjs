import { APP, ASSETS, URL as API } from './api.mjs';
import assert from 'node:assert/strict';
import { signIn } from './api.mjs';
import { waitForAuthEmail } from './mail.mjs';
import { chromium } from 'playwright';
import { createRunner } from './steps.mjs';
const A = ASSETS;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, geolocation: { latitude: 48.1486, longitude: 17.1077 }, permissions: ['geolocation'] });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
let n = 0;
const shot = async (name) => { await p.waitForTimeout(700); await p.screenshot({ path: `out/flow/${String(++n).padStart(2, '0')}-${name}.png` }); };
const click = async (text) => { await p.getByText(text, { exact: true }).last().click(); };
// Signup steps are sequential and depend on each other, so stop at the first failure (later steps count as failed).
const { step, finish } = createRunner({ label: 'signup', stopOnFail: true, onFail: (name) => shot('FAIL-' + name.replace(/[^\w-]+/g, '_')) });

await p.goto(APP + '/', { waitUntil: 'networkidle' });
await step('welcome', async () => { await shot('welcome'); await click('Начать знакомство'); });
await step('signup', async () => {
  await p.getByPlaceholder('name@example.com').fill('anna@renvi.test');
  await p.getByPlaceholder('Не менее 8 символов').fill('renvi-test-1');
  await p.getByRole('checkbox', { name: /Мне исполнилось 18 лет/ }).click();
  await shot('signup');
  const sentAt=Date.now();
  await click('Продолжить');
  await p.getByText('Письмо отправлено', {exact:true}).waitFor({timeout:15000});
  await assert.rejects(()=>signIn('anna@renvi.test','renvi-test-1'),/confirm/i);
  const {link}=await waitForAuthEmail('anna@renvi.test',{after:sentAt});
  // A fresh device has no locally stored PKCE verifier or previous session.
  const fresh=await b.newContext({viewport:{width:393,height:852}});
  const confirmation=await fresh.newPage();
  await confirmation.goto(link,{waitUntil:'networkidle'});
  await confirmation.getByText('Почта подтверждена',{exact:true}).first().waitFor({timeout:15000});
  await fresh.close();
  await p.goto(APP+'/signin',{waitUntil:'networkidle'});
  await p.getByPlaceholder('name@example.com').fill('anna@renvi.test');
  await p.locator('input[type="password"]').fill('renvi-test-1');
  await click('Войти');
  await p.getByText('Начать знакомство',{exact:true}).waitFor({timeout:15000});
  await p.goto(APP+'/ob-age',{waitUntil:'networkidle'});
  await p.getByText('Сколько вам лет?').waitFor({ timeout: 15000 });
});
await step('ob-age', async () => {
  await p.getByPlaceholder('Как вас называть').fill('Анна');
  for(const [label,value] of [['День','02'],['Месяц','04'],['Год','1999']]) {
    await p.getByRole('button',{name:label,exact:true}).click();
    await p.getByText(value,{exact:true}).last().click();
  }
  await p.getByRole('checkbox', { name: /Мне уже исполнилось 18 лет/ }).click();
  await p.getByRole('checkbox', { name: /Я принимаю Условия/ }).click();
  await shot('ob-age');
  await click('Продолжить');
  await p.getByText('Подтвердите дату рождения',{exact:true}).waitFor();
  await click('Подтверждаю, сохранить');
  await p.getByText('Как вас описать?').waitFor();
});
await step('ob-gender', async () => { await click('Женщина'); await shot('ob-gender'); await click('Продолжить'); await p.getByText('Подтвердите гендер',{exact:true}).waitFor(); await click('Подтверждаю, сохранить'); await p.getByText('Кого вы хотите встретить?').waitFor(); });
await step('ob-seeking', async () => {
  await click('Мужчин');
  await click('Продолжить'); // without consent → toast
  await shot('ob-seeking-consent-required');
  await p.getByRole('checkbox', { name: /Я даю отдельное согласие/ }).click();
  await click('Продолжить');
  await p.getByText('Чего вы сейчас ищете?').waitFor();
});
await step('ob-intent', async () => { await shot('ob-intent'); await click('Продолжить'); await p.getByText('Где вас искать?').waitFor(); });
await step('ob-city', async () => {
  await shot('ob-city');
  await click('Продолжить');
  await p.getByText('Добавьте фотографии').waitFor();
});
await step('ob-photos', async () => {
  for (const f of ['profile-3.jpg', 'profile-6.jpg']) {
    const fc = p.waitForEvent('filechooser');
    await p.getByLabel('Добавить фото или видео').first().click();
    await (await fc).setFiles(A + f);
    await p.waitForTimeout(2500);
  }
  await shot('ob-photos');
  await click('Продолжить');
  await p.getByText('Что важно о вас?').waitFor({ timeout: 15000 });
});
await step('ob-about', async () => {
  await p.getByPlaceholder(/Например, люблю/).fill('Люблю выставки с маленькими залами и большие разговоры после них.');
  await p.getByText('Книги', { exact: true }).click();
  await p.getByText('Кофе', { exact: true }).click();
  await shot('ob-about');
  await click('Продолжить');
  await p.getByText('Ответьте на один вопрос').waitFor();
});
await step('ob-prompts', async () => {
  await p.getByPlaceholder(/кофе, прогулка и разговор/).fill('интерес к миру и доброта к официанту');
  await shot('ob-prompts');
  await click('Сохранить ответы');
  await p.getByText('Люди рядом').waitFor();
});
await step('ob-location', async () => { await shot('ob-location'); await click('Разрешить при использовании'); await p.getByText('Покажите, что вы — это вы').waitFor(); });
await step('ob-verify', async () => {
  await shot('ob-verify');
  const fc = p.waitForEvent('filechooser');
  await click('Начать проверку');
  await (await fc).setFiles(A + 'profile-3.jpg');
  await p.getByText('Селфи отправлено').waitFor({ timeout: 15000 });
});
await step('ob-review', async () => { await shot('ob-review'); await click('Продолжить оформление'); await p.getByText(/Анкета выглядит/).waitFor(); });
await step('ob-done', async () => { await shot('ob-done'); await click('Перейти к знакомствам'); await p.getByText(/лайков осталось/).waitFor({ timeout: 15000 }); });
await step('discover', async () => { await shot('discover'); });
await ctx.storageState({ path: 'out/anna.json' });
if (errors.length) console.log(errors.slice(0, 5).join('\n'));
await finish(() => b.close());
