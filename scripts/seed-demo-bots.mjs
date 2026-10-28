// Creates 20 female and 20 male demo profiles (fictional) for testing before launch.
// Usage (from the project folder):
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=<secret or service_role key> node scripts/seed-demo-bots.mjs
// Remove: node scripts/seed-demo-bots.mjs --remove
// The secret key is only used locally from the environment; never put it into .env, the app or git.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (Supabase → Project Settings → API Keys → Secret key).');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const IMG = new URL('../src/assets/images/', import.meta.url).pathname;

async function listBots() {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...data.users.filter((u) => u.email?.endsWith('@demo.renvi.app')));
    if (data.users.length < 200) break;
  }
  return out;
}

if (process.argv.includes('--remove')) {
  const bots = await listBots();
  for (const u of bots) {
    for (const sub of ['profile']) {
      const { data } = await db.storage.from('profile-media').list(`${u.id}/${sub}`);
      if (data?.length) await db.storage.from('profile-media').remove(data.map((f) => `${u.id}/${sub}/${f.name}`));
    }
    await db.auth.admin.deleteUser(u.id);
  }
  console.log(`Removed ${bots.length} demo profiles.`);
  process.exit(0);
}

const WOMEN = ['Эмма', 'Лаура', 'Катарина', 'Зузана', 'Мария', 'Ева', 'Николета', 'Барбора', 'Тереза', 'Луция',
  'Анна', 'Вероника', 'Даша', 'Кристина', 'Моника', 'Ольга', 'Софья', 'Юлия', 'Петра', 'Михаэла'];
const MEN = ['Марек', 'Даниэль', 'Томаш', 'Мартин', 'Лукаш', 'Петер', 'Якуб', 'Матей', 'Адам', 'Филип',
  'Давид', 'Самуэль', 'Михал', 'Андрей', 'Олег', 'Иван', 'Роман', 'Юрай', 'Патрик', 'Ондрей'];
const WOMEN_PHOTOS = ['profile-3.jpg', 'profile-4.jpg', 'profile-6.jpg'];
const MEN_PHOTOS = ['profile-1.jpg', 'profile-2.jpg', 'profile-5.jpg', 'gallery-2.jpg', 'gallery-3.jpg', 'gallery-4.jpg'];
const INTENTS = ['serious', 'serious', 'casual', 'friends', 'unsure'];
const INTERESTS = ['Архитектура', 'Кофе', 'Книги', 'Музыка', 'Путешествия', 'Кино', 'Плавание', 'Кулинария', 'Дизайн'];
const BIOS = [
  'Могу пройти весь город ради хорошего эспрессо. По выходным нахожу новые места у Дуная.',
  'Люблю выставки с маленькими залами и большие разговоры после них.',
  'Самый хороший план — тот, где можно поговорить и не проверять время.',
  'В субботу — поезд, в воскресенье — домашняя паста.',
  'Учу словацкий и ищу компанию для воскресных завтраков.',
  'Делаю цифровые продукты, но в телефоне отвечаю не сразу. Ищу живые разговоры.',
];
const PROMPTS = [
  ['Моё идеальное первое свидание —', 'кофе, прогулка без маршрута и ещё один кофе'],
  ['Небольшая радость недели —', 'нашёл(ла) книжный, который не хотел закрываться'],
  ['Зелёный флаг для меня —', 'интерес к миру и доброта к официанту'],
  ['Навык, который мало кто ожидает —', 'собираю мебель без инструкции'],
  ['На повторе сейчас —', 'всё, что напоминает о лете'],
  ['Хочу однажды —', 'проехать поездом через всю Европу'],
];
const MUSIC = ['Intro · The xx', 'Friday Morning · Khruangbin', 'Free · Florence + The Machine', 'Show Me How · Men I Trust', null];
const pick = (arr, i) => arr[i % arr.length];
const rnd = (a, b) => a + Math.random() * (b - a);

async function makeBot(i, woman) {
  const name = woman ? WOMEN[i] : MEN[i];
  const email = `${woman ? 'w' : 'm'}${String(i + 1).padStart(2, '0')}@demo.renvi.app`;
  const age = 21 + ((i * 7) % 17);
  const year = new Date().getFullYear() - age;
  const { data: created, error } = await db.auth.admin.createUser({
    email, password: crypto.randomUUID() + 'Aa1!', email_confirm: true,
  });
  if (error) {
    if (/already/i.test(error.message)) return 'exists';
    throw error;
  }
  const id = created.user.id;
  const photos = woman
    ? [pick(WOMEN_PHOTOS, i), pick(WOMEN_PHOTOS, i + 1)]
    : [pick(MEN_PHOTOS, i), pick(MEN_PHOTOS, i + 2)];
  const interests = [pick(INTERESTS, i), pick(INTERESTS, i + 3), pick(INTERESTS, i + 5)];
  const now = new Date().toISOString();
  let r = await db.from('profiles').upsert({
    id, display_name: name, age, gender: woman ? 'woman' : 'man', seeking: i % 7 === 6 ? 'everyone' : woman ? 'men' : 'women',
    intent: pick(INTENTS, i), country: 'SK', city: i % 6 === 5 ? 'Pezinok' : 'Bratislava', bio: pick(BIOS, i + (woman ? 0 : 3)),
    interests, music_title: pick(MUSIC, i), language: 'RU', onboarding_step: 99, onboarding_done: true,
    terms_accepted_at: now, adult_confirmed_at: now, sensitive_consent_at: now,
    verification_status: i % 3 === 2 ? 'none' : 'approved',
  });
  if (r.error) throw r.error;
  r = await db.from('private_profile').upsert({
    user_id: id, birthdate: `${year}-0${1 + (i % 9)}-1${i % 9}`,
    lat: Math.round(rnd(48.10, 48.20) * 100) / 100, lng: Math.round(rnd(17.03, 17.20) * 100) / 100, location_enabled: true,
  });
  if (r.error) throw r.error;
  for (let k = 0; k < photos.length; k++) {
    const path = `${id}/profile/${k}.jpg`;
    const up = await db.storage.from('profile-media').upload(path, fs.readFileSync(IMG + photos[k]), { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw up.error;
    r = await db.from('profile_photos').insert({ profile_id: id, storage_path: path, position: k, verified: k === 0 && i % 3 !== 2 });
    if (r.error) throw r.error;
  }
  const [q, a] = pick(PROMPTS, i + (woman ? 1 : 4));
  r = await db.from('profile_prompts').insert({ profile_id: id, question_key: q, answer: a, position: 0 });
  if (r.error) throw r.error;
  r = await db.from('demo_bots').insert({ user_id: id });
  if (r.error) throw r.error;
  return 'created';
}

let created = 0, existed = 0;
for (let i = 0; i < 20; i++) {
  for (const woman of [true, false]) {
    const res = await makeBot(i, woman);
    if (res === 'created') created++; else existed++;
    process.stdout.write('.');
  }
}
console.log(`\nDemo profiles: ${created} created, ${existed} already existed.`);
