// Creates 20 female and 20 male demo profiles (fictional) for testing before launch.
// Usage (from the project folder):
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=<secret or service_role key> node scripts/seed-demo-bots.mjs
// Remove: node scripts/seed-demo-bots.mjs --remove
// The secret key is only used locally from the environment; never put it into .env, the app or git.
// Photos: if scripts/demo-photos/ exists (gitignored, local only), its jpg/png files (sorted by name) are used
// round-robin, two per profile. Otherwise the sample images from src/assets/images/ are used.
// Only put images there that you own, that are licensed, or whose subjects gave consent. See docs/SETUP.md.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (Supabase → Project Settings → API Keys → Secret key).');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const IMG = new URL('../src/assets/images/', import.meta.url).pathname;
const CUSTOM_DIR = new URL('./demo-photos/', import.meta.url).pathname;

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

// Each row: [name, age, city, intent, seeking, interests, bio, promptIndex, promptAnswer, musicTitle|null]
// All people are fictional; texts are written by hand on purpose (different length and tone, no template).
const PROMPT_KEYS = [
  'Моё идеальное первое свидание —', 'Небольшая радость недели —', 'Зелёный флаг для меня —',
  'Навык, который мало кто ожидает —', 'На повторе сейчас —', 'Хочу однажды —', 'Небольшое удовольствие —',
];
const WOMEN = [
  ['Зузана', 27, 'Bratislava', 'serious', 'men', ['Книги', 'Кофе', 'Кино'], 'Работаю в издательстве, так что читаю много и быстро. Про сюжет могу рассказывать часами, но спойлеры не люблю.', 5, 'увидеть северное сияние и не замёрзнуть', 'Hoppípolla · Sigur Rós'],
  ['Катарина', 31, 'Nitra', 'serious', 'men', ['Кулинария', 'Путешествия'], 'Переехала из Харькова три года назад. Учусь печь настоящий трдельник, пока получается через раз.', 6, 'свежий хлеб из пекарни у вокзала', null],
  ['Даша', 24, 'Bratislava', 'friends', 'everyone', ['Музыка', 'Дизайн'], 'Дизайнер, днём Figma, вечером гитара. Ищу людей для концертов — одной скучно.', 4, 'новый альбом Phoebe Bridgers', 'Motion Sickness · Phoebe Bridgers'],
  ['Михаэла', 29, 'Trnava', 'casual', 'men', ['Кино', 'Плавание'], 'Фельдшер, работаю сутками, поэтому планы у меня гибкие. Люблю бассейн рано утром.', 1, 'выспалась после дежурства', 'Dreams · Fleetwood Mac'],
  ['Ева', 35, 'Bratislava', 'serious', 'men', ['Архитектура', 'Кофе', 'Книги'], 'Архитектор. Могу заметить кривой фасад с другой стороны улицы. Без претензий, просто такая особенность.', 2, 'человек, который не опаздывает и не делает из этого трагедию', 'Gymnopédie No.1 · Erik Satie'],
  ['Лаура', 22, 'Košice', 'unsure', 'everyone', ['Музыка', 'Путешествия'], 'Студентка, учусь на переводчика. Живу в Кошице, но часто езжу в Братиславу.', 5, 'пожить месяц в Лиссабоне', 'Cheap Thrills · Sia'],
  ['Юлия', 33, 'Pezinok', 'serious', 'men', ['Кулинария', 'Книги'], 'Дочь учится во втором классе, это главное. Остальное — работа, сад и воскресные пироги.', 3, 'знаю, как отремонтировать велосипед', 'Fix You · Coldplay'],
  ['Петра', 26, 'Žilina', 'casual', 'men', ['Путешествия', 'Плавание'], 'Горы, походы, потом пиво. Если пойдёшь со мной в Мартинские холи — уже хороший знак.', 0, 'поход с рассветом и термос с чаем', 'Take Me Home, Country Roads · John Denver'],
  ['Николета', 30, 'Bratislava', 'friends', 'everyone', ['Дизайн', 'Кино', 'Кофе'], 'Работаю в стартапе, переехала сюда из Киева. Хочу найти компанию для настолок и киноклуба.', 2, 'умение извиниться первым', 'Show Me How · Men I Trust'],
  ['Тереза', 28, 'Nitra', 'unsure', 'men', ['Архитектура', 'Музыка'], 'Преподаю музыку детям. Пианино дома стоит, но сосед пока не жалуется.', 6, 'горячий шоколад после занятий', 'Clair de Lune · Debussy'],
  ['Анна', 38, 'Bratislava', 'serious', 'men', ['Книги', 'Путешествия'], 'Бухгалтер, и мне это нравится. Цифры спокойные, в отличие от людей.', 3, 'считаю в уме быстрее калькулятора', null],
  ['Барбора', 25, 'Trnava', 'casual', 'everyone', ['Кофе', 'Кино'], 'Бариста. Расскажу про зёрна, если спросишь, и промолчу, если нет.', 4, 'любой фильм Ким Ки Дока', 'Friday Morning · Khruangbin'],
  ['Кристина', 32, 'Bratislava', 'serious', 'men', ['Плавание', 'Кулинария'], 'Тренер по плаванию. Ещё готовлю, чтобы компенсировать. Балансирую как могу.', 0, 'ужин, который готовим вместе', 'Dog Days Are Over · Florence + The Machine'],
  ['Софья', 23, 'Košice', 'friends', 'men', ['Дизайн', 'Книги'], 'Рисую иллюстрации, продаю на маркетах. Ищу тех, кто ходит на выставки не ради фото.', 1, 'нашла старую открытку 1960-х', 'Dissolve Me · Alt-J'],
  ['Моника', 36, 'Bratislava', 'unsure', 'men', ['Кино', 'Музыка', 'Кофе'], 'Пять лет назад развелась, теперь снова учусь не бояться знакомств. Пишите просто.', 2, 'честность без драмы', 'Landslide · Fleetwood Mac'],
  ['Ольга', 40, 'Nitra', 'serious', 'men', ['Кулинария', 'Книги'], 'Работаю в школе, учу русскому и литературе. Дома двое котов и очень много чая.', 6, 'чай с лимоном в дождь', null],
  ['Луция', 21, 'Žilina', 'casual', 'everyone', ['Музыка', 'Плавание'], 'Первый год в университете, хожу на все концерты. Вопросы про мой плейлист приветствуются.', 4, 'всё, что напоминает о лете', 'Free · Florence + The Machine'],
  ['Вероника', 34, 'Pezinok', 'serious', 'men', ['Архитектура', 'Путешествия'], 'Вожу экскурсии по Братиславе на русском. Знаю, где в замке пол скрипит громче всего.', 5, 'проехать поездом через всю Европу', 'Intro · The xx'],
  ['Эмма', 28, 'Bratislava', 'casual', 'men', ['Дизайн', 'Кофе'], 'Фотографирую еду для кафе. Парадокс: сама часто забываю поесть.', 3, 'собираю мебель без инструкции', 'Sunday Morning · Maroon 5'],
  ['Мария', 37, 'Trnava', 'friends', 'everyone', ['Книги', 'Кино'], 'Мама подростка, веду клуб чтения для взрослых. Зову на встречи, где можно спорить о книгах.', 2, 'умеет слушать до конца', null],
];
const MEN = [
  ['Марек', 29, 'Bratislava', 'serious', 'women', ['Музыка', 'Кофе'], 'Звукорежиссёр. Если в баре играет плохой микс, мне физически неуютно. Да, я это знаю.', 4, 'винил Boards of Canada', 'Roygbiv · Boards of Canada'],
  ['Томаш', 34, 'Nitra', 'serious', 'women', ['Плавание', 'Путешествия'], 'Инженер на заводе, по выходным езжу на велосипеде вдоль Нитры. Один раз проехал 90 км и не пожалел.', 0, 'велопрогулка и пикник у воды', 'Home · Edward Sharpe'],
  ['Даниэль', 26, 'Bratislava', 'casual', 'women', ['Кино', 'Кулинария'], 'Программист. Люблю готовить и смотреть старые фильмы, где все курят и говорят красиво.', 3, 'делаю хороший рамен с нуля', null],
  ['Мартин', 41, 'Žilina', 'serious', 'women', ['Книги', 'Архитектура'], 'Юрист, развёлся, детей нет. Читаю исторические книги, иногда пишу сам — для себя.', 2, 'не врёт даже по мелочам', 'Hurt · Johnny Cash'],
  ['Лукаш', 23, 'Košice', 'friends', 'everyone', ['Музыка', 'Путешествия'], 'Играю в группе на басу. Репетиции по вторникам, если придёшь — налью чаю.', 5, 'сыграть концерт в Праге', 'Pursuit of Happiness · Kid Cudi'],
  ['Петер', 36, 'Bratislava', 'unsure', 'women', ['Кофе', 'Дизайн'], 'Работаю в рекламе. Много говорю по работе, поэтому в жизни предпочитаю слушать.', 1, 'кофе в тишине утром', 'Weightless · Marconi Union'],
  ['Якуб', 30, 'Trnava', 'serious', 'women', ['Плавание', 'Кулинария', 'Книги'], 'Врач-ординатор. Свободного времени немного, зато умею его ценить. Готов к простым свиданиям.', 6, 'поспать на пять минут дольше', 'Intro · The xx'],
  ['Матей', 27, 'Pezinok', 'casual', 'women', ['Путешествия', 'Кино'], 'Виноградарь в третьем поколении. Приезжай на сбор урожая — покажу, как это на самом деле.', 0, 'бокал вина на закате в виноградниках', null],
  ['Адам', 25, 'Bratislava', 'friends', 'everyone', ['Архитектура', 'Дизайн'], 'Студент магистратуры, строительный. Мечтаю когда-нибудь построить хоть один дом, который не стыдно показать.', 5, 'увидеть Бразилиа вживую', 'Dive · Ed Sheeran'],
  ['Филип', 32, 'Bratislava', 'serious', 'women', ['Музыка', 'Кино'], 'Преподаю историю в гимназии. Люблю, когда спорят на уроке, но не люблю спорить за ужином.', 2, 'смеётся над своими же шутками', 'Heroes · David Bowie'],
  ['Давид', 28, 'Žilina', 'casual', 'women', ['Плавание', 'Путешествия'], 'Курьер и по совместительству любитель скалолазания. Ищу напарницу для стены и разговоров потом.', 3, 'лазаю по скалам лучше, чем танцую', 'Hold On · Alabama Shakes'],
  ['Самуэль', 33, 'Nitra', 'unsure', 'women', ['Книги', 'Кофе'], 'Работаю удалённо, переехал из Одессы. Скучаю по морю, поэтому часто хожу в бассейн.', 1, 'пришла посылка с книгой', 'Redbone · Childish Gambino'],
  ['Михал', 39, 'Bratislava', 'serious', 'women', ['Кулинария', 'Музыка'], 'Шеф-повар небольшого ресторана. Работаю вечерами, так что завтрак со мной — самое честное свидание.', 0, 'завтрак на рынке и никуда не торопиться', 'La Vie en Rose · Louis Armstrong'],
  ['Андрей', 31, 'Košice', 'friends', 'everyone', ['Кино', 'Дизайн'], 'Режиссёр монтажа. Друзья говорят, что я цитирую фильмы чаще, чем говорю своё.', 4, 'сериалы без закадрового смеха', null],
  ['Олег', 44, 'Bratislava', 'serious', 'women', ['Архитектура', 'Путешествия'], 'Двое сыновей, живут с мамой, но часто у меня. Работаю в логистике, по выходным ремонтирую дачу.', 3, 'клею плитку ровнее, чем кажется', 'Come Together · The Beatles'],
  ['Иван', 25, 'Trnava', 'casual', 'women', ['Музыка', 'Плавание'], 'Учусь на физиотерапевта. Если у тебя болит спина, покажу упражнения, а если нет — просто выпьем кофе.', 1, 'пробежка в дождь', 'Electric Feel · MGMT'],
  ['Роман', 37, 'Pezinok', 'unsure', 'women', ['Кофе', 'Книги', 'Кулинария'], 'Менеджер проектов. Научился печь хлеб без глютена, потому что у сестры аллергия, теперь не могу остановиться.', 6, 'горячий хлеб с маслом', null],
  ['Юрай', 28, 'Bratislava', 'serious', 'women', ['Дизайн', 'Кино', 'Путешествия'], 'Делаю мобильные приложения, иногда сам удивляюсь, что они работают. Люблю неспешные прогулки по Старому городу.', 5, 'пожить на острове, где нет зимы', 'Midnight City · M83'],
  ['Патрик', 22, 'Košice', 'friends', 'everyone', ['Музыка', 'Кино'], 'Бариста по будням, диджей по пятницам. Пишите, если хотите попасть в список гостей.', 4, 'плейлист, который собрал в поезде', 'Strobe · deadmau5'],
  ['Ондрей', 35, 'Nitra', 'serious', 'women', ['Архитектура', 'Книги'], 'Реставратор. Работаю с деревянными церквями в Карпатах. Моё любимое слово — «патина».', 2, 'интересуется, как всё устроено', 'Spiegel im Spiegel · Arvo Pärt'],
];
const CITY_XY = { Bratislava: [48.15, 17.10], Pezinok: [48.29, 17.27], Nitra: [48.31, 18.09], Trnava: [48.38, 17.59], Žilina: [49.22, 18.74], Košice: [48.72, 21.26] };
const SAMPLE_WOMEN = ['profile-3.jpg', 'profile-4.jpg', 'profile-6.jpg'];
const SAMPLE_MEN = ['profile-1.jpg', 'profile-2.jpg', 'profile-5.jpg', 'gallery-2.jpg', 'gallery-3.jpg', 'gallery-4.jpg'];
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr, i) => arr[i % arr.length];
const EXTRA_ANSWERS = {
  'Моё идеальное первое свидание —': ['кофе, прогулка без маршрута и ещё один кофе', 'выставка, а потом спорить о ней за ужином'],
  'Небольшая радость недели —': ['кофе на набережной до работы', 'первый тёплый вечер на балконе'],
  'Зелёный флаг для меня —': ['интерес к миру и доброта к официанту', 'умение посмеяться над собой'],
  'Навык, который мало кто ожидает —': ['пеку хлеб на закваске', 'говорю на четырёх языках'],
  'На повторе сейчас —': ['старый джаз по вечерам', 'подкаст про историю Европы'],
  'Хочу однажды —': ['проехать поездом через всю Европу', 'увидеть северное сияние'],
  'Небольшое удовольствие —': ['свежие круассаны в субботу', 'книга и плед в дождь'],
  default: ['кофе и хороший разговор', 'прогулка по Старому городу'],
};

// Optional local photo pool: scripts/demo-photos/*.jpg|png (gitignored). Falls back to repo sample images.
function loadPhotoPool() {
  if (fs.existsSync(CUSTOM_DIR)) {
    const files = fs.readdirSync(CUSTOM_DIR).filter((f) => MIME[path.extname(f).toLowerCase()]).sort();
    if (files.length) return { dir: CUSTOM_DIR, files };
  }
  return null;
}
const POOL = loadPhotoPool();
console.log(POOL ? `Photos: ${POOL.files.length} file(s) from scripts/demo-photos/` : 'Photos: sample images from src/assets/images/ (no scripts/demo-photos/ with images)');

// g = running profile number (0..39); round-robin through the pool, two photos per profile.
function photosFor(g, woman, i) {
  if (POOL) {
    const n = POOL.files.length;
    return [...new Set([POOL.files[(2 * g) % n], POOL.files[(2 * g + 1) % n]])].map((f) => ({ dir: POOL.dir, f }));
  }
  const list = woman ? SAMPLE_WOMEN : SAMPLE_MEN;
  return [...new Set([list[i % list.length], list[(i + 1) % list.length]])].map((f) => ({ dir: IMG, f }));
}

async function makeBot(i, woman) {
  const [name, age, city, intent, seeking, interests, bio, promptIdx, answer, music] = (woman ? WOMEN : MEN)[i];
  const g = i * 2 + (woman ? 0 : 1);
  const email = `${woman ? 'w' : 'm'}${String(i + 1).padStart(2, '0')}@demo.renvi.app`;
  const year = new Date().getFullYear() - age;
  const { data: created, error } = await db.auth.admin.createUser({
    email, password: crypto.randomUUID() + 'Aa1!', email_confirm: true,
  });
  if (error) {
    if (/already/i.test(error.message)) return 'exists';
    throw error;
  }
  const id = created.user.id;
  const photos = photosFor(g, woman, i);
  const [lat0, lng0] = CITY_XY[city];
  const now = new Date().toISOString();
  let r = await db.from('profiles').upsert({
    id, display_name: name, age, gender: woman ? 'woman' : 'man', seeking, intent, country: 'SK', city, bio,
    interests, music_title: music, language: 'RU', onboarding_step: 99, onboarding_done: true,
    terms_accepted_at: now, adult_confirmed_at: now, sensitive_consent_at: now,
    verification_status: i % 3 === 2 ? 'none' : 'approved',
    // "Подробнее обо мне" (migration 0031)
    height_cm: woman ? 158 + ((i * 3) % 20) : 172 + ((i * 3) % 20),
    languages: pick([['sk', 'en'], ['ru', 'sk', 'en'], ['sk', 'cs', 'en'], ['uk', 'sk', 'en'], ['sk', 'de']], i),
    kids: pick(['want', 'dont_want', 'open', 'have'], i), smoking: pick(['no', 'no', 'sometimes', 'yes'], i + 1),
    drinking: pick(['socially', 'no', 'socially', 'often'], i), workout: pick(['sometimes', 'often', 'never'], i),
    education: pick(['bachelor', 'master', 'college', 'school', 'phd'], i), pets: pick(['none', 'dog', 'cat', 'other'], i + 2),
    zodiac: pick(['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'], i * 5),
  });
  if (r.error) throw r.error;
  r = await db.from('private_profile').upsert({
    user_id: id, birthdate: `${year}-0${1 + (i % 9)}-1${i % 9}`,
    lat: Math.round((lat0 + rnd(-0.03, 0.03)) * 100) / 100, lng: Math.round((lng0 + rnd(-0.03, 0.03)) * 100) / 100, location_enabled: true,
  });
  if (r.error) throw r.error;
  for (let k = 0; k < photos.length; k++) {
    const ext = path.extname(photos[k].f).toLowerCase();
    const storagePath = `${id}/profile/${k}${ext}`;
    const up = await db.storage.from('profile-media').upload(storagePath, fs.readFileSync(photos[k].dir + photos[k].f), { contentType: MIME[ext] ?? 'image/jpeg', upsert: true });
    if (up.error) throw up.error;
    r = await db.from('profile_photos').insert({ profile_id: id, storage_path: storagePath, position: k, verified: k === 0 && i % 3 !== 2 });
    if (r.error) throw r.error;
  }
  r = await db.from('profile_prompts').insert({ profile_id: id, question_key: PROMPT_KEYS[promptIdx], answer, position: 0 });
  if (r.error) throw r.error;
  // Two more answers so the card shows several (questions different from the first one).
  for (let k = 1; k <= 2; k++) {
    const key = PROMPT_KEYS[(promptIdx + k * 2) % PROMPT_KEYS.length];
    r = await db.from('profile_prompts').insert({ profile_id: id, question_key: key, answer: pick(EXTRA_ANSWERS[key] ?? EXTRA_ANSWERS.default, i), position: k });
    if (r.error) throw r.error;
  }
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
