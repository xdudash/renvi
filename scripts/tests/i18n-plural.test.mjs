import test from 'node:test';
import assert from 'node:assert/strict';
const { translate, pluralForm } = await import(new URL('../../src/i18n/index.ts', import.meta.url).href);

test('Russian and Ukrainian plural forms', () => {
  const f = (lang, ns) => ns.map((n) => pluralForm(lang, n));
  assert.deepEqual(f('RU', [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 100, 101, 111]), [0, 1, 1, 2, 2, 2, 2, 0, 1, 2, 2, 0, 2]);
  assert.deepEqual(f('UA', [1, 3, 11, 24]), [0, 1, 2, 1]);
});
test('Slovak, Czech and English plural forms', () => {
  assert.deepEqual([1, 2, 4, 5, 21].map((n) => pluralForm('SK', n)), [0, 1, 1, 2, 2]);
  assert.deepEqual([1, 3, 5].map((n) => pluralForm('CS', n)), [0, 1, 2]);
  assert.deepEqual([0, 1, 2].map((n) => pluralForm('EN', n)), [2, 0, 2]);
});
test('strings pick the form and keep plain placeholders', () => {
  assert.equal(translate('RU', 'plans.card.seatsLeft', { n: 1 }), 'ещё 1 место');
  assert.equal(translate('RU', 'plans.card.seatsLeft', { n: 3 }), 'ещё 3 места');
  assert.equal(translate('RU', 'plans.card.seatsLeft', { n: 12 }), 'ещё 12 мест');
  assert.equal(translate('RU', 'plans.limit.h', { n: 2 }), 'У тебя уже 2 активных плана');
  assert.equal(translate('RU', 'plans.limit.h', { n: 10 }), 'У тебя уже 10 активных планов');
  assert.equal(translate('RU', 'limit.copy', { n: 20 }), 'В Free — 20 искр в день. Новые появятся завтра в 00:00.');
  assert.equal(translate('EN', 'plans.card.seatsLeft', { n: 1 }), '1 spot left');
  assert.equal(translate('SK', 'limit.copy', { n: 2 }), 'vo Free sú 2 iskry denne. Nové budú zajtra o 00:00.');
  assert.equal(translate('CS', 'limit.copy', { n: 5 }), 'Ve Free je 5 jisker denně. Nové budou zítra v 00:00.');
});
