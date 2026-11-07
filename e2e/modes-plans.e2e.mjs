// Plans and visibility modes through the UI: a host publishes a plan, a guest asks to join (the exact place stays hidden),
// the host accepts, both chat; then the guest changes status and dating closes. Each step also asserts the database.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { APP, ASSETS, makeProfile } from './api.mjs';
import { createRunner } from './steps.mjs';

const browser = await chromium.launch();
const PHONE = { width: 393, height: 852 };
let cur = null;
const diagnose = async () => cur ? `url=${cur.url().replace(APP, '')} text="${(await cur.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 400)}"` : '';
const { step, finish } = createRunner({ label: 'modes-plans', diagnose });
const sql = (q) => execSync('psql "$DATABASE_URL" -tA -v ON_ERROR_STOP=1', { input: q, env: process.env }).toString().trim();
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (got, want, what) => must(String(got) === String(want), `${what}: got "${got}", want "${want}"`);
const go = async (p, path) => { cur = p; await p.goto(APP + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(700); };
async function signInUi(p, email, password) {
  await go(p, '/signin');
  await p.getByPlaceholder('name@example.com').fill(email);
  await p.getByPlaceholder('Не менее 8 символов').fill(password);
  await p.getByText('Войти', { exact: true }).last().click();
  await p.waitForTimeout(2500);
}
const newPage = async () => { const c = await browser.newContext({ viewport: PHONE }); return await c.newPage(); };
const photo = [ASSETS + 'profile-1.jpg', ASSETS + 'profile-2.jpg'];
const person = (email, name, gender, seeking) => makeProfile({
  email, password: 'renvi-test-1', photos: photo, prompts: [['Моё идеальное первое свидание —', 'кофе и прогулка']],
  patch: { display_name: name, birthdate: '1996-04-12', gender, seeking, intent: 'serious', country: 'SK', city: 'Bratislava' },
});
const host = await person('mp-host@renvi.test', 'Хост Планов', 'man', 'women');
const guest = await person('mp-guest@renvi.test', 'Гостья Планов', 'woman', 'men');
const TITLE = `Прогулка по рынку ${Date.now() % 100000}`;
const PLACE = 'у большой ёлки на площади';
sql(`delete from public.plans where host_id = '${host.uid}'`);

const hp = await newPage();
const gp = await newPage();
await signInUi(hp, 'mp-host@renvi.test', 'renvi-test-1');
await signInUi(gp, 'mp-guest@renvi.test', 'renvi-test-1');

let planId = '';
await step('host publishes a plan', async () => {
  await go(hp, '/plan-create');
  await hp.getByPlaceholder('Рождественский рынок и глинтвейн').fill(TITLE);
  await hp.getByPlaceholder('Старый город').fill('Старый город');
  await hp.getByPlaceholder('Главная площадь, у большой ёлки').fill(PLACE);
  await hp.getByText('Опубликовать план', { exact: true }).last().click();
  await hp.waitForURL(/\/plan-created/, { timeout: 15000 });
  planId = sql(`select id from public.plans where host_id = '${host.uid}' and title = '${TITLE}'`);
  must(planId, 'plan row exists');
  eq(sql(`select place from public.plans where id = '${planId}'`), PLACE, 'stored place');
});
await step('guest sees the plan in the feed without the exact place', async () => {
  await go(gp, '/feed');
  await gp.getByText(TITLE).first().waitFor({ timeout: 15000 });
  const body = await gp.innerText('body');
  must(!body.includes(PLACE), 'feed must not show the exact place');
  await gp.getByText(TITLE).first().click();
  await gp.getByText('точное место откроется после одобрения').waitFor();
  must(!(await gp.innerText('body')).includes(PLACE), 'detail must not show the exact place before approval');
});
await step('guest asks to join', async () => {
  await gp.getByPlaceholder('привет! возьму термос с какао').fill('возьму термос');
  await gp.getByText('Хочу с вами', { exact: true }).last().click();
  await gp.waitForURL(/\/plan-join/, { timeout: 15000 });
  eq(sql(`select status from public.plan_members where plan_id = '${planId}' and user_id = '${guest.uid}'`), 'pending', 'member status');
});
await step('host accepts the request', async () => {
  await go(hp, `/plan-requests?id=${planId}`);
  await hp.getByText('Гостья Планов').first().waitFor({ timeout: 15000 });
  await hp.getByText('возьму термос').first().waitFor();
  await hp.getByText('Принять', { exact: true }).last().click();
  await hp.waitForTimeout(1500);
  eq(sql(`select status from public.plan_members where plan_id = '${planId}' and user_id = '${guest.uid}'`), 'going', 'member status');
});
await step('guest now sees the place and writes in the chat', async () => {
  await go(gp, `/plan?id=${planId}`);
  await gp.getByText(PLACE).first().waitFor({ timeout: 15000 });
  await go(gp, `/plan-chat?id=${planId}`);
  await gp.getByPlaceholder('Сообщение в группу').fill('привет всем!');
  await gp.getByRole('button', { name: 'Отправить' }).click();
  await gp.getByText('привет всем!').first().waitFor({ timeout: 15000 });
  eq(sql(`select count(*) from public.plan_messages where plan_id = '${planId}'`), '1', 'messages stored');
  await go(hp, `/plan-chat?id=${planId}`);
  await hp.getByText('привет всем!').first().waitFor({ timeout: 15000 });
});
await step('chat poll: a guest asks, the host votes and closes it', async () => {
  await go(gp, `/plan-chat?id=${planId}`);
  await gp.getByRole('button', { name: 'Опрос' }).click();
  await gp.getByPlaceholder('Где встречаемся?').fill('Куда пойдём после?');
  await gp.getByPlaceholder('Вариант 1').fill('Фонтан');
  await gp.getByPlaceholder('Вариант 2').fill('Кафе');
  await gp.getByText('Создать опрос', { exact: true }).last().click();
  await gp.getByText('Куда пойдём после?').first().waitFor({ timeout: 15000 });
  eq(sql(`select count(*) from public.plan_poll_options o join public.plan_polls p on p.id = o.poll_id where p.plan_id = '${planId}'`), '2', 'poll options stored');
  await go(hp, `/plan-chat?id=${planId}`);
  await hp.getByText('Куда пойдём после?').first().waitFor({ timeout: 15000 });
  await hp.getByRole('button', { name: /Фонтан/ }).click();
  await hp.waitForTimeout(1200);
  eq(sql(`select count(*) from public.plan_poll_votes v join public.plan_polls p on p.id = v.poll_id where p.plan_id = '${planId}' and v.user_id = '${host.uid}'`), '1', 'host vote stored');
  await hp.getByText('Закрыть опрос').first().click();
  await hp.getByText('Опрос закрыт').first().waitFor({ timeout: 15000 });
  eq(sql(`select count(*) from public.plan_polls where plan_id = '${planId}' and closed_at is not null`), '1', 'poll closed');
});
await step('company: a mutual hello opens a chat', async () => {
  // Only the two fixtures stay open to company, so the first card is the other one.
  sql(`update public.profiles set vis_company = false where id not in ('${host.uid}', '${guest.uid}')`);
  await go(gp, '/company');
  await gp.getByText('Хост Планов').first().waitFor({ timeout: 15000 });
  await gp.getByText('Привет', { exact: true }).last().click();
  await gp.waitForTimeout(1500);
  eq(sql(`select count(*) from public.company_hellos where from_id = '${guest.uid}' and to_id = '${host.uid}'`), '1', 'hello stored');
  eq(sql(`select count(*) from public.matches where kind = 'company'`), '0', 'no chat after one hello');
  await go(hp, '/company');
  await hp.getByText('Гостья Планов').first().waitFor({ timeout: 15000 });
  await hp.getByText('Привет', { exact: true }).last().click();
  await hp.waitForURL(/\/connected/, { timeout: 15000 });
  await hp.getByText('Вы на связи').waitFor();
  eq(sql(`select count(*) from public.matches where kind = 'company' and (user_a = '${host.uid}' or user_b = '${host.uid}')`), '1', 'company chat opened');
});
await step('company: a partner card keeps the Company tab and goes back to people', async () => {
  sql(`delete from public.ads; insert into public.ads (slot, partner, title, link_url) values ('people', 'Кофейня Тест', 'Кофе вдвоём', 'https://example.com/coffee')`);
  await go(gp, '/people-ad?from=company');
  await gp.getByText('Кофе вдвоём').waitFor({ timeout: 15000 });
  await gp.getByText('Дальше к людям').click();
  await gp.waitForURL(/\/company/, { timeout: 15000 });
  sql(`delete from public.ads`);
});
await step('visibility modes: switching dating off is saved', async () => {
  await go(gp, '/modes');
  await gp.getByText('Ты решаешь сам').waitFor({ timeout: 15000 });
  await gp.getByRole('switch', { name: 'Свидания' }).click();
  await gp.waitForTimeout(1500);
  eq(sql(`select vis_dating from public.profiles where id = '${guest.uid}'`), 'f', 'vis_dating');
  await gp.getByRole('switch', { name: 'Свидания' }).click();
  await gp.waitForTimeout(1500);
  eq(sql(`select vis_dating from public.profiles where id = '${guest.uid}'`), 't', 'vis_dating back on');
});
await step('status in a relationship closes dating', async () => {
  await go(gp, '/status-change');
  await gp.getByText('Что изменилось?').waitFor({ timeout: 15000 });
  await gp.getByText('В отношениях', { exact: true }).first().click();
  await gp.getByText('Сохранить', { exact: true }).last().click();
  await gp.waitForURL(/\/modes/, { timeout: 15000 });
  eq(sql(`select relationship_status from public.profiles where id = '${guest.uid}'`), 'relationship', 'status');
  await go(gp, '/discover');
  await gp.waitForURL(/\/company/, { timeout: 15000 });
});
await step('after the plan: the evening check and a company hello', async () => {
  sql(`update public.plans set starts_at = now() - interval '5 hours' where id = '${planId}';
       update public.plan_members set arrived_at = now() where plan_id = '${planId}' and user_id = '${guest.uid}';
       insert into public.plan_checks (plan_id, user_id) values ('${planId}', '${guest.uid}') on conflict do nothing`);
  await go(gp, `/plan-after?id=${planId}`);
  await gp.getByText('Всё ок?').first().waitFor({ timeout: 15000 });
  await gp.getByText('Всё хорошо', { exact: true }).click();
  await gp.waitForTimeout(1200);
  eq(sql(`select answer from public.plan_checks where plan_id = '${planId}' and user_id = '${guest.uid}'`), 'ok', 'check answer');
  await go(hp, `/plan-after?id=${planId}`);
  await hp.getByText('Гостья Планов').first().waitFor({ timeout: 15000 });
  await hp.getByRole('button', { name: /В компанию/ }).click();
  await hp.waitForURL(/\/connected/, { timeout: 15000 });
  eq(sql(`select count(*) from public.company_hellos where from_id = '${host.uid}' and to_id = '${guest.uid}'`), '1', 'hello stored');
});
await step('cleanup', async () => {
  sql(`update public.profiles set vis_company = true`);
  sql(`delete from public.matches where kind = 'company'`);
  sql(`delete from public.company_hellos`);
  sql(`update public.profiles set relationship_status = 'single', dating_open_at = null where id = '${guest.uid}'`);
  sql(`delete from public.plans where host_id = '${host.uid}'`);
});

await finish(() => browser.close());
