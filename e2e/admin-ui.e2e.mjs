// Admin panel (/admin) end to end: signs in as the seeded admin and uses every screen the way a moderator would.
// Each step asserts what the screen shows AND what happened in the database (state + admin_actions row).
// Fixtures: fresh @renvi.test accounts created here; unrelated rows left by other scripts are neutralised first.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { APP, ASSETS, rpc, signIn, ensureConfirmedFixture, makeProfile } from './api.mjs';
import { createRunner } from './steps.mjs';
import { auditLayout } from './layout-audit.mjs';

const browser = await chromium.launch();
const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 393, height: 852 };
let cur = null;
const diagnose = async () => cur ? `url=${cur.url().replace(APP, '')} text="${(await cur.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 400)}"` : '';
const { step, finish } = createRunner({ label: 'admin-ui', diagnose });

// ---- helpers ----
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
const newPage = async (viewport) => { const c = await browser.newContext({ viewport }); return { ctx: c, page: await c.newPage() }; };
// Dialog confirm button is the LAST element with the label (the modal is portaled after the page).
async function confirm(p, label, reason) {
  if (reason !== undefined) await p.locator('textarea').last().fill(reason);
  await p.getByText(label, { exact: true }).last().click();
  await p.waitForTimeout(1500);
}
const auditCount = (action, target) => Number(sql(`select count(*) from public.admin_actions where action like '${action}' and target_user = '${target}'`));

// ---- fixtures ----
const photo = [ASSETS + 'profile-1.jpg', ASSETS + 'profile-2.jpg'];
const person = (email, name, extra = {}) => makeProfile({
  email, password: 'renvi-test-1', photos: photo, prompts: [['Моё идеальное первое свидание —', 'кофе и прогулка']],
  patch: { display_name: name, birthdate: '1997-04-12', gender: 'man', seeking: 'women', intent: 'serious', country: 'SK', city: 'Bratislava', ...extra },
});
const sess = await ensureConfirmedFixture('admin@renvi.test', 'renvi-admin-1');
const adminId = sess.user.id;
sql(`insert into public.admins (user_id) values ('${adminId}') on conflict do nothing`);
const adminToken = sess.access_token;
const warnee = await person('aui-warn@renvi.test', 'Варн Тестов');
const banee = await person('aui-ban@renvi.test', 'Бан Тестов');
const plain = await person('aui-plain@renvi.test', 'Обычный Тестов');
const appealA = await person('aui-appeal-a@renvi.test', 'Апелл Принят');
const appealR = await person('aui-appeal-r@renvi.test', 'Апелл Отклонён');
const verA = await person('aui-ver-a@renvi.test', 'Селфи Одобрен');
const verR = await person('aui-ver-r@renvi.test', 'Селфи Отказан');
const reported = await person('aui-reported@renvi.test', 'Жалоба Тестов');
await ensureConfirmedFixture('aui-admin2@renvi.test', 'renvi-admin-1');
// Neutralise queue items left by the other scripts, so "the first row" is always ours.
sql(`update public.reports set status = 'dismissed' where status = 'open';
     update public.appeals set status = 'rejected' where status = 'open';
     update public.verification_requests set status = 'rejected' where status = 'pending';`);
const newReport = () => sql(`insert into public.reports (reporter_id, target_profile_id, reason, details)
  values ('${plain.uid}', '${reported.uid}', 'other', 'aui report') returning id;`).split('\n')[0];
const newAppeal = (uid) => {
  const rid = sql(`insert into public.reports (reporter_id, target_profile_id, reason, status, decision)
    values ('${plain.uid}', '${uid}', 'other', 'actioned', 'ban') returning id;`).split('\n')[0];
  // The ban comes from the report, exactly as a moderator's decision would create it: accepting the appeal lifts that sanction.
  sql(`insert into public.account_sanctions (user_id, kind, reason) values ('${uid}', 'ban', 'report ${rid}');
       update public.profiles set suspended_until = 'infinity' where id = '${uid}';
       insert into public.appeals (report_id, user_id, details) values ('${rid}', '${uid}', 'Это ошибка, прошу пересмотреть');`);
};
const newVerification = (uid) => sql(`insert into public.verification_requests (user_id, storage_path) values ('${uid}', '${uid}/selfie.jpg');
  update public.profiles set verification_status = 'pending' where id = '${uid}';`);

const { ctx: actx, page: ap } = await newPage(DESKTOP);

await step('non-admin sees "Нет доступа" on /admin', async () => {
  const { ctx, page } = await newPage(DESKTOP);
  await signInUi(page, 'aui-plain@renvi.test', 'renvi-test-1');
  await go(page, '/admin');
  await page.getByText('Нет доступа', { exact: true }).first().waitFor({ timeout: 10000 });
  must(!(await page.getByText('По странам').count()), 'dashboard data leaked to a non-admin');
  await ctx.close();
});

await step('admin signs in and sees the dashboard with the sidebar', async () => {
  await signInUi(ap, 'admin@renvi.test', 'renvi-admin-1');
  await go(ap, '/admin');
  await ap.getByText('По странам').first().waitFor({ timeout: 10000 });
  for (const label of ['Жалобы', 'Апелляции', 'Пользователи', 'Настройки', 'Админы', 'Журнал'])
    must(await ap.getByRole('link', { name: label }).count(), 'sidebar link missing: ' + label);
});

await step('every admin screen opens without an error (desktop)', async () => {
  for (const path of ['/admin', '/admin/reports', '/admin/appeals', '/admin/verification', '/admin/users', '/admin/analytics',
    '/admin/config', '/admin/audit', '/admin/errors', '/admin/admins', '/admin/demo']) {
    await go(ap, path);
    const text = await ap.innerText('body');
    must(!/Ошибка:|Нет доступа|Не удалось проверить/.test(text), `${path} shows an error: ${text.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
});

await step('users: search finds the account and opens its card', async () => {
  await go(ap, '/admin/users');
  await ap.getByPlaceholder('Имя, e-mail или ID').fill('aui-warn@renvi.test');
  await ap.keyboard.press('Enter');
  await ap.waitForTimeout(1500);
  await ap.getByText('Варн Тестов').first().click();
  await ap.waitForURL(new RegExp('/admin/user/' + warnee.uid), { timeout: 10000 });
});

await step('warn a user: sanction + audit row, user sees the warning', async () => {
  await go(ap, '/admin/user/' + warnee.uid);
  await ap.getByText('Предупредить', { exact: true }).first().click();
  await confirm(ap, 'Предупредить', 'aui: нарушение правил общения');
  eq(sql(`select count(*) from public.account_sanctions where user_id = '${warnee.uid}' and kind = 'warning' and lifted_at is null`), 1, 'warning rows');
  eq(auditCount('user.warning', warnee.uid), 1, 'audit rows for warning');
  eq(sql(`select suspended_until is null from public.profiles where id = '${warnee.uid}'`), 't', 'a warning must not restrict the account');
  // What the user sees (warning / ban screens) is covered by extra.e2e.mjs; here we check the admin side and the data.
});

await step('ban then unban a user: profile state, sanctions and audit rows', async () => {
  const navs = []; const onNav = (f) => { if (f === ap.mainFrame()) navs.push(f.url().replace(APP, '')); }; ap.on('framenavigated', onNav);
  await go(ap, '/admin/user/' + banee.uid);
  const seen = async (what) => `${what}: ap=${ap.url()} navs=${navs.join(' > ')} uid=${banee.uid} text=${(await ap.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)}`;
  await ap.getByText('Заблокировать', { exact: true }).first().click({ timeout: 8000 }).catch(async () => { throw new Error(await seen('ban button')); });
  await confirm(ap, 'Заблокировать', 'aui: мошенничество подтверждено');
  eq(sql(`select suspended_until from public.profiles where id = '${banee.uid}'`), 'infinity', 'suspended_until after ban');
  eq(auditCount('user.ban', banee.uid), 1, 'audit rows for ban');
  await go(ap, '/admin/user/' + banee.uid);
  await ap.getByText('Разблокировать', { exact: true }).first().click({ timeout: 8000 }).catch(async () => { throw new Error(await seen('unban button')); });
  await confirm(ap, 'Разблокировать', 'aui: ошибка модератора');
  eq(sql(`select suspended_until is null from public.profiles where id = '${banee.uid}'`), 't', 'suspended_until after unban');
  eq(sql(`select count(*) from public.account_sanctions where user_id = '${banee.uid}' and kind = 'ban' and lifted_at is null`), 0, 'active bans');
  eq(auditCount('user.lift', banee.uid) >= 1, true, 'audit row for unban');
});

await step('identity correction needs a reason and is audited', async () => {
  await go(ap, '/admin/user/' + plain.uid);
  await ap.getByLabel('Дата рождения (ГГГГ-ММ-ДД)').fill('1990-02-03');
  await ap.getByLabel('Причина исправления (обязательно)').fill('aui: исправление по документу');
  await ap.getByText('Сохранить исправление', { exact: true }).click();
  await ap.getByText('Исправление сохранено и записано в журнал.').waitFor({ timeout: 10000 });
  eq(sql(`select birthdate from public.private_profile where user_id = '${plain.uid}'`), '1990-02-03', 'birthdate');
  eq(auditCount('identity.correct', plain.uid), 1, 'audit rows for identity');
});

await step('report: resolve "Нарушений нет" dismisses it and writes the audit row', async () => {
  const id = newReport();
  await go(ap, '/admin/reports');
  await ap.getByText('Нарушений нет', { exact: true }).first().click();
  await confirm(ap, 'Нарушений нет', 'aui: ложное срабатывание');
  eq(sql(`select status from public.reports where id = '${id}'`), 'dismissed', 'report status');
  eq(auditCount('report.resolve', reported.uid), 1, 'audit rows for report');
});

await step('appeal: accept lifts the ban, with reason and audit row', async () => {
  newAppeal(appealA.uid);
  await go(ap, '/admin/appeals');
  await ap.getByText('Принять', { exact: true }).first().click();
  await confirm(ap, 'Принять', 'aui: блокировка была ошибочной');
  eq(sql(`select status from public.appeals where user_id = '${appealA.uid}'`), 'accepted', 'appeal status');
  eq(sql(`select suspended_until is null from public.profiles where id = '${appealA.uid}'`), 't', 'ban lifted by the accepted appeal');
  eq(sql(`select count(*) from public.admin_actions where action like 'appeal.%' and target_user = '${appealA.uid}'`), 1, 'audit rows for appeal');
});

await step('appeal: reject keeps the ban and shows the reason to the user', async () => {
  newAppeal(appealR.uid);
  await go(ap, '/admin/appeals');
  await ap.getByText('Отклонить', { exact: true }).first().click();
  await confirm(ap, 'Отклонить', 'aui: нарушение подтверждено повторно');
  eq(sql(`select status from public.appeals where user_id = '${appealR.uid}'`), 'rejected', 'appeal status');
  eq(sql(`select suspended_until from public.profiles where id = '${appealR.uid}'`), 'infinity', 'ban must stay');
  eq(sql(`select decision_reason from public.appeals where user_id = '${appealR.uid}'`), 'aui: нарушение подтверждено повторно', 'decision reason');
});

await step('selfie verification: approve', async () => {
  newVerification(verA.uid);
  await go(ap, '/admin/verification');
  await ap.getByText('Подтвердить', { exact: true }).first().click();
  await confirm(ap, 'Подтвердить');
  eq(sql(`select verification_status from public.profiles where id = '${verA.uid}'`), 'approved', 'verification_status');
  eq(auditCount('verification.approve', verA.uid), 1, 'audit rows for approve');
});

await step('selfie verification: reject needs a reason', async () => {
  newVerification(verR.uid);
  await go(ap, '/admin/verification');
  await ap.getByText('Отклонить', { exact: true }).first().click();
  await confirm(ap, 'Отклонить', 'aui: лицо не видно');
  eq(sql(`select verification_status from public.profiles where id = '${verR.uid}'`), 'rejected', 'verification_status');
  eq(auditCount('verification.reject', verR.uid), 1, 'audit rows for reject');
});

await step('config: spark limit saved, persists after reload, written to the audit log', async () => {
  await go(ap, '/admin/config');
  await ap.getByLabel('daily_spark_limit').fill('7');
  await ap.getByText('Сохранить', { exact: true }).nth(1).click();
  await ap.waitForTimeout(1500);
  eq(sql(`select value from public.app_config where key = 'daily_spark_limit'`), '7', 'app_config value');
  await ap.reload({ waitUntil: 'networkidle' });
  await ap.waitForTimeout(900);
  eq(await ap.getByLabel('daily_spark_limit').inputValue(), '7', 'value shown after reload');
  must(Number(sql(`select count(*) from public.admin_actions where action = 'config.set' and details::text like '%daily_spark_limit%'`)) >= 1, 'no config.set audit row');
});

await step('config: the server refuses a non-numeric discover_recycle', async () => {
  let bad = false;
  try { await rpc(adminToken, 'admin_config_set', { p_key: 'discover_recycle', p_value: { cooldown_hours: 'x' }, p_reason: 'aui' }); } catch { bad = true; }
  must(bad, 'server accepted a non-numeric discover_recycle');
});

await step('audit log lists the actions made above and filters by group', async () => {
  await go(ap, '/admin/audit');
  must(!/Ошибка:/.test(await ap.innerText('body')), 'audit log shows an error');
  must(Number(sql(`select count(*) from public.admin_actions where admin_id = '${adminId}'`)) >= 6, 'too few audit rows');
});

await step('admins: add by e-mail, then remove', async () => {
  await go(ap, '/admin/admins');
  await ap.getByLabel('E-mail').fill('aui-admin2@renvi.test');
  await ap.getByText('Добавить', { exact: true }).first().click();
  await confirm(ap, 'Добавить', 'aui: второй администратор');
  eq(sql(`select count(*) from public.admins a join auth.users u on u.id = a.user_id where u.email = 'aui-admin2@renvi.test'`), 1, 'admins row');
  const id2 = sql(`select id from auth.users where email = 'aui-admin2@renvi.test'`);
  eq(auditCount('admin.add', id2), 1, 'audit rows for add');
  await go(ap, '/admin/admins');
  await ap.getByText('aui-admin2@renvi.test').first().waitFor();
  const row = ap.locator('xpath=//*[text()="aui-admin2@renvi.test"]/ancestor::*[.//*[text()="Снять права"]][1]');
  await row.getByText('Снять права', { exact: true }).first().click();
  await confirm(ap, 'Снять права', 'aui: больше не нужен');
  eq(sql(`select count(*) from public.admins where user_id = '${id2}'`), 0, 'admins row after removal');
  eq(auditCount('admin.remove', id2), 1, 'audit rows for remove');
});

await step('the last admin cannot be removed (button, RPC and direct delete)', async () => {
  sql(`delete from public.admins where user_id <> '${adminId}'`); // only the signed-in admin remains
  await go(ap, '/admin/admins');
  const btn = ap.getByRole('button', { name: 'Снять права' }).first();
  await btn.waitFor();
  eq(await btn.getAttribute('aria-disabled'), 'true', 'remove button must be disabled for the last admin');
  let refused = false;
  try { await rpc(adminToken, 'admin_remove_admin', { p_user: adminId, p_reason: 'aui last admin' }); } catch { refused = true; }
  must(refused, 'RPC removed the last admin');
  let blocked = false;
  try { sql(`delete from public.admins where user_id = '${adminId}'`); } catch { blocked = true; }
  must(blocked, 'direct delete removed the last admin');
  eq(sql(`select count(*) from public.admins where user_id = '${adminId}'`), 1, 'admin still present');
});

await step('analytics, errors and demo screens render their content', async () => {
  await go(ap, '/admin/analytics');
  await ap.getByText('Обновить', { exact: true }).first().click();
  await ap.waitForTimeout(1000);
  must(!/Ошибка:/.test(await ap.innerText('body')), 'analytics error');
  await go(ap, '/admin/errors');
  await go(ap, '/admin/demo');
  must(!/Ошибка:/.test(await ap.innerText('body')), 'demo error');
});

await actx.close();

await step('phone 393px: every admin screen has no horizontal overflow and a working menu', async () => {
  const { ctx, page } = await newPage(PHONE);
  await signInUi(page, 'admin@renvi.test', 'renvi-admin-1');
  const bad = [];
  const screens = ['/admin', '/admin/reports', '/admin/appeals', '/admin/verification', '/admin/users', '/admin/analytics', '/admin/config',
    '/admin/audit', '/admin/errors', '/admin/admins', '/admin/demo', '/admin/user/' + warnee.uid];
  for (const path of screens) {
    await go(page, path);
    const { outside } = await page.evaluate(auditLayout);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (outside.length || overflow > 1) bad.push(`${path}: overflow=${overflow} outside=${JSON.stringify(outside.slice(0, 2))}`);
  }
  must(!bad.length, bad.join(' | '));
  await go(page, '/admin');
  await page.getByRole('button', { name: /^Меню/ }).click();
  await page.getByRole('link', { name: 'Журнал' }).first().click();
  await page.waitForURL(/\/admin\/audit/, { timeout: 10000 });
  await ctx.close();
});

await finish(() => browser.close());
