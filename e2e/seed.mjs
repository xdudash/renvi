import { APP, ASSETS, URL as API, makeProfile, rpc } from './api.mjs';
const A = ASSETS;
const marek = await makeProfile({
  email: 'marek@renvi.test', password: 'renvi-test-1',
  patch: { display_name: 'Марек', birthdate: '1998-03-01', gender: 'man', seeking: 'women', intent: 'serious', country: 'SK', city: 'Bratislava',
    bio: 'Могу пройти весь город ради хорошего эспрессо. По выходным снимаю на плёнку и нахожу новые места у Дуная.',
    interests: ['Кофе', 'Архитектура', 'Музыка'], music_title: 'Intro · The xx', lat: 48.15, lng: 17.12 },
  photos: [A + 'gallery-1.jpg', A + 'gallery-2.jpg', A + 'gallery-3.jpg', A + 'gallery-4.jpg'],
  prompts: [['Моё идеальное первое свидание —', 'кофе, прогулка без маршрута и ещё один кофе']],
});
const daniel = await makeProfile({
  email: 'daniel@renvi.test', password: 'renvi-test-1',
  patch: { display_name: 'Даниэль', birthdate: '1996-05-10', gender: 'man', seeking: 'women', intent: 'unsure', country: 'SK', city: 'Bratislava',
    bio: 'Из Лондона, теперь живу рядом с Дунаем. Учу словацкий и ищу компанию для воскресных завтраков.', interests: ['Кино', 'Кулинария'], lat: 48.16, lng: 17.10 },
  photos: [A + 'profile-2.jpg', A + 'profile-4.jpg'],
  prompts: [['Небольшая радость недели —', 'нашёл книжный магазин, который не хотел закрываться']],
});
const tomas = await makeProfile({
  email: 'tomas@renvi.test', password: 'renvi-test-1',
  patch: { display_name: 'Томаш', birthdate: '2000-01-20', gender: 'man', seeking: 'women', intent: 'casual', country: 'SK', city: 'Pezinok',
    bio: 'В субботу — поезд, в воскресенье — домашняя паста.', interests: ['Путешествия', 'Музыка'] },
  photos: [A + 'profile-5.jpg', A + 'profile-1.jpg'],
  prompts: [['На повторе сейчас —', 'всё, что напоминает о лете']],
});
console.log(JSON.stringify({ marek: marek.uid, daniel: daniel.uid, tomas: tomas.uid }));
const emma = await makeProfile({
  email: 'emma@renvi.test', password: 'renvi-test-1',
  patch: { display_name: 'Эмма', birthdate: '1999-02-14', gender: 'woman', seeking: 'men', intent: 'serious', country: 'SK', city: 'Bratislava',
    bio: 'Люблю выставки с маленькими залами и большие разговоры после них.', interests: ['Книги', 'Кофе'] },
  photos: [A + 'profile-3.jpg', A + 'profile-6.jpg'],
  prompts: [['Зелёный флаг для меня —', 'интерес к миру и доброта к официанту']],
});
const laura = await makeProfile({
  email: 'laura@renvi.test', password: 'renvi-test-1',
  patch: { display_name: 'Лаура', birthdate: '1995-07-03', gender: 'woman', seeking: 'men', intent: 'serious', country: 'SK', city: 'Bratislava',
    bio: 'Самый хороший план — тот, где можно поговорить и не проверять время.', interests: ['Плавание', 'Путешествия'] },
  photos: [A + 'profile-6.jpg', A + 'profile-3.jpg'],
  prompts: [['Хочу однажды —', 'проехать поездом через всю Европу']],
});
console.log(JSON.stringify({ emma: emma.uid, laura: laura.uid }));
