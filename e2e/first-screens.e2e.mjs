// First screens (cover, language, sign-in) against the measurements of the approved prototype ("RENVI для всех").
// The prototype itself is not in the repository: its numbers are written down here (see docs/IMPLEMENTATION.md).
// Signed out, 393 x 852 (iPhone). Sizes are compared with ±2 px, colours exactly.
import { chromium } from 'playwright';
import { APP } from './api.mjs';
import { createRunner } from './steps.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: 'ru-RU' });
const page = await ctx.newPage();
const diagnose = async () => `url=${page.url().replace(APP, '')} text="${(await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}"`;
const { step, finish } = createRunner({ label: 'first-screens', diagnose });

const must = (c, m) => { if (!c) throw new Error(m); };
const near = (got, want, what, tol = 2) => must(Math.abs(got - want) <= tol, `${what}: got ${got}, want ${want} ±${tol}`);
const go = async (path) => { await page.goto(APP + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(600); };
// Computed style + box of the first element with this exact text (or its ancestor `up` levels above).
const measure = (text, up = 0, nth = 0) => page.getByText(text, { exact: true }).nth(nth).evaluate((el, up) => {
  for (let i = 0; i < up; i++) el = el.parentElement;
  const c = getComputedStyle(el), r = el.getBoundingClientRect();
  return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height, fs: parseFloat(c.fontSize), fw: c.fontWeight, rad: parseFloat(c.borderTopLeftRadius), bg: c.backgroundColor, bw: parseFloat(c.borderTopWidth), bc: c.borderTopColor };
}, up);
const RED = 'rgb(218, 48, 43)', PAPER_WHITE = 'rgb(253, 252, 249)', RED_WASH = 'rgb(249, 233, 229)';

// ---------- cover ----------
await go('/');
await step('cover: heading, wordmark and copy', async () => {
  const h = await page.getByRole('heading').first().evaluate((el) => ({ t: el.innerText, fs: parseFloat(getComputedStyle(el).fontSize), fw: getComputedStyle(el).fontWeight }));
  must(/Найди своих\.\s*Рядом\./.test(h.t), `heading text: ${h.t}`);
  near(h.fs, 44, 'heading font-size', 0.5); must(h.fw === '900', `heading weight ${h.fw}`);
  near((await measure('renvi')).fs, 53, 'wordmark font-size', 0.5);
  for (const t of ['Make it mutual.　·　18+', 'Создавая аккаунт, ты подтвердишь возраст 18+, Условия и Правила сообщества.']) must(await page.getByText(t, { exact: true }).count() === 1, `missing: ${t}`);
  must(await page.locator('img').count() === 0, 'the old hero photo is still on the cover');
});
await step('cover: five tiles with the prototype geometry and colours', async () => {
  const titles = ['Глинтвейн на рынке', 'Свидания', 'Падел 2×2', 'Пары', 'Компания по интересам'];
  const t = [];
  for (const x of titles) t.push(await measure(x, 1));
  for (let i = 0; i < 4; i++) { near(t[i].w, 174.5, `tile ${i + 1} width`); must(t[i].h >= 91, `tile ${i + 1} height ${t[i].h}`); }
  near(t[4].w, 357, 'wide tile width'); must(t[4].h >= 69, `wide tile height ${t[4].h}`);
  for (const x of t) near(x.rad, 20, 'tile radius', 0.5);
  near(t[1].x - (t[0].x + t[0].w), 8, 'column gap', 1.5);
  near(t[2].y - (t[0].y + t[0].h), 8, 'row gap', 1.5);
  near(t[4].y - (t[2].y + t[2].h), 8, 'wide row gap', 1.5);
  const want = ['rgb(243, 225, 222)', 'rgb(32, 30, 29)', 'rgb(212, 228, 218)', 'rgb(243, 236, 221)', 'rgb(220, 227, 238)'];
  want.forEach((bg, i) => must(t[i].bg === bg, `tile ${i + 1} background ${t[i].bg}, want ${bg}`));
  near((await measure('5 из 10 идут')).fs, 10, 'tile caption size', 0.5);
  near((await measure('Глинтвейн на рынке')).fs, 13, 'tile title size', 0.5);
});
await step('cover: buttons, language link, no horizontal scroll', async () => {
  const a = await measure('Начать', 1), b = await measure('У меня уже есть аккаунт', 1);
  for (const x of [a, b]) { must(x.h >= 48.5, `button height ${x.h}`); near(x.rad, 25, 'button radius', 0.5); near(x.w, 357, 'button width'); }
  must(a.bg === RED, `primary button colour ${a.bg}`);
  must(b.bw === 1, 'secondary button needs a 1px outline');
  must(await page.getByText('Русский · изменить язык', { exact: true }).count() === 1, 'language link text');
  const sw = await page.evaluate(() => document.scrollingElement.scrollWidth);
  must(sw <= 393, `horizontal scroll: ${sw}px`);
});
await step('cover: buttons lead to sign-up, sign-in and language', async () => {
  await page.getByText('Начать', { exact: true }).click(); await page.waitForURL(/\/signup/, { timeout: 8000 });
  await go('/'); await page.getByText('У меня уже есть аккаунт', { exact: true }).click(); await page.waitForURL(/\/signin/, { timeout: 8000 });
  await go('/'); await page.getByText('Русский · изменить язык', { exact: true }).click(); await page.waitForURL(/\/language/, { timeout: 8000 });
});

// ---------- language ----------
await go('/language');
await step('language: copy, five rows with code tags, RU selected', async () => {
  const h = await page.getByRole('heading').first().innerText();
  must(/На каком языке\s+удобнее\?/.test(h), `heading: ${h}`);
  must(await page.getByText('ЯЗЫК', { exact: true }).count() === 1, 'kicker');
  must(await page.getByText('Язык можно поменять в профиле в любой момент.', { exact: true }).count() === 1, 'subtitle');
  const names = ['Slovenčina', 'Čeština', 'English', 'Русский', 'Українська'];
  for (const [i, n] of names.entries()) {
    const row = await measure(n, 2); // text -> label box -> row
    must(row.h >= 47.5, `${n} row height ${row.h}`); near(row.rad, 13, `${n} row radius`, 0.5);
    const selected = n === 'Русский';
    must(row.bg === (selected ? RED_WASH : PAPER_WHITE), `${n} row colour ${row.bg}`);
    const code = await page.getByText(['SK', 'CS', 'EN', 'RU', 'UA'][i], { exact: true }).last().evaluate((el) => { const t = el.parentElement, r = t.getBoundingClientRect(); return { w: r.width, h: r.height, fs: parseFloat(getComputedStyle(el).fontSize), bg: getComputedStyle(t).backgroundColor }; });
    near(code.w, 30, 'code tag width', 1); near(code.h, 19, 'code tag height', 1.5); near(code.fs, 9.5, 'code tag font', 0.5);
    must(code.bg === 'rgb(239, 234, 227)', `code tag colour ${code.bg}`);
  }
  near((await measure('Русский')).fs, 13, 'language name size', 0.5);
  must(await page.locator('img').count() === 0, 'flag images are gone');
});
await step('language: choosing English switches the interface, Continue goes back to the cover', async () => {
  await page.getByText('English', { exact: true }).click(); await page.waitForTimeout(500);
  const h = await page.getByRole('heading').first().innerText();
  must(/Which language\s+suits you\?/.test(h), `heading after choosing EN: ${h}`);
  must((await measure('English', 2)).bg === RED_WASH, 'English row is not marked selected');
  must((await measure('Русский', 2)).bg === PAPER_WHITE, 'Русский row is still marked selected');
  await page.getByText('Continue', { exact: true }).click(); await page.waitForTimeout(800);
  must(!/\/language/.test(page.url()), 'Continue stayed on the language screen');
  must(await page.getByText('Start', { exact: true }).count() === 1, 'cover is not in English');
  must(/Find your people\.\s*Nearby\./.test(await page.getByRole('heading').first().innerText()), 'cover heading is not in English');
  await go('/language'); await page.getByText('Русский', { exact: true }).click(); await page.waitForTimeout(400); // back to the default for the next screens
});

// ---------- sign-in ----------
await go('/signin');
await step('sign-in: copy, field and button geometry', async () => {
  const h = await page.getByRole('heading').first().evaluate((el) => ({ t: el.innerText, fs: parseFloat(getComputedStyle(el).fontSize) }));
  must(h.t.trim() === 'С возвращением', `heading: ${h.t}`); near(h.fs, 34, 'heading size', 0.5);
  for (const t of ['АККАУНТ', 'ЭЛЕКТРОННАЯ ПОЧТА', 'ПАРОЛЬ', 'Войдите по почте и паролю.', 'Не помню пароль']) must(await page.getByText(t, { exact: true }).count() >= 1, `missing: ${t}`);
  for (const ph of ['name@example.com', 'Не менее 8 символов']) {
    const i = await page.getByPlaceholder(ph).evaluate((el) => { const c = getComputedStyle(el), r = el.getBoundingClientRect(); return { h: r.height, w: r.width, rad: parseFloat(c.borderTopLeftRadius), fs: parseFloat(c.fontSize), bg: c.backgroundColor }; });
    near(i.h, 45, 'input height', 1.5); near(i.w, 357, 'input width'); near(i.rad, 13, 'input radius', 0.5); near(i.fs, 13, 'input font', 0.5); must(i.bg === PAPER_WHITE, `input colour ${i.bg}`);
  }
  const b = await measure('Войти', 1);
  must(b.h >= 48.5, `button height ${b.h}`); near(b.rad, 25, 'button radius', 0.5); must(b.bg === RED, `button colour ${b.bg}`);
});
await step('sign-in: real authentication errors and navigation', async () => {
  await page.getByText('Войти', { exact: true }).last().click();
  await page.getByRole('alert').waitFor({ timeout: 5000 });
  await page.getByPlaceholder('name@example.com').fill('nobody@renvi.test');
  await page.getByPlaceholder('Не менее 8 символов').fill('wrong-password-1');
  await page.getByText('Войти', { exact: true }).last().click();
  await page.getByText('Неверная почта или пароль.', { exact: true }).waitFor({ timeout: 10000 });
  await page.getByText('Не помню пароль', { exact: true }).click(); await page.waitForURL(/\/forgot/, { timeout: 8000 });
});

await finish(() => browser.close());
