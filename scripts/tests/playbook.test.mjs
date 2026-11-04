// RENVI Playbook: copy complete and identical in shape across languages, access rules, strings, no "smart" features.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { playbookContent } from '../../src/playbook/index.ts';

const root = new URL('../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const load = async (n) => (await import(new URL(`src/i18n/${n}.ts`, root).href))[n];
const LANGS = ['RU', 'EN'];

test('every language has lessons 1–5, six date routes, three first-date tabs and 30 situations', () => {
  for (const l of LANGS) {
    const c = playbookContent(l);
    assert.deepEqual(c.lessons.map((x) => x.id), [1, 2, 3, 4, 5], l);
    assert.equal(c.dates.routes.length, 6, l);
    assert.equal(c.dates.rules.length, 3, l);
    assert.equal(c.firstDate.tabs.length, 3, l);
    assert.equal(c.trainer.length, 30, l);
    assert.equal(c.paywall.points.length, 4, l);
    for (let n = 1; n <= 8; n++) assert.ok(c.titles[n]?.trim(), `${l}: title ${n}`);
    for (const lesson of c.lessons) {
      assert.equal(lesson.cards.at(-1).type, 'summary', `${l} lesson ${lesson.id} ends with a summary`);
      assert.ok(lesson.cards.some((card) => card.type === 'quiz'), `${l} lesson ${lesson.id} has a check`);
    }
  }
});

test('Russian and English copy have the same structure (cards, answers, best answer, lesson links)', () => {
  const [ru, en] = LANGS.map(playbookContent);
  ru.lessons.forEach((lesson, i) => assert.deepEqual(lesson.cards.map((c) => c.type), en.lessons[i].cards.map((c) => c.type), `lesson ${lesson.id}`));
  ru.lessons.forEach((lesson, i) => lesson.cards.forEach((c, k) => {
    if (c.type === 'quiz') assert.equal(c.best, en.lessons[i].cards[k].best, `lesson ${lesson.id} quiz`);
  }));
  ru.trainer.forEach((s, i) => {
    const e = en.trainer[i];
    assert.equal(s.best, e.best, `situation ${i + 1}: best`);
    assert.equal(s.lesson, e.lesson, `situation ${i + 1}: lesson`);
    assert.equal(s.chat.length, e.chat.length, `situation ${i + 1}: chat`);
    assert.equal(!!s.context, !!e.context, `situation ${i + 1}: context`);
  });
  ru.dates.routes.forEach((r, i) => assert.equal(r.budget, en.dates.routes[i].budget, `route ${i + 1}`));
});

test('situations: three different answers, a valid best one, an explanation; best answers are spread', () => {
  for (const l of LANGS) {
    const where = [0, 0, 0];
    for (const s of playbookContent(l).trainer) {
      assert.equal(new Set(s.options).size, 3, `${l}: ${s.tag}`);
      assert.ok([0, 1, 2].includes(s.best) && s.why.length > 30, `${l}: ${s.tag}`);
      assert.ok(s.lesson >= 2 && s.lesson <= 7, `${l}: ${s.tag}`);
      where[s.best]++;
    }
    for (const n of where) assert.ok(n >= 6, `${l}: the best answer is not always in the same place (${where})`);
  }
});

test('English copy has no Cyrillic; unknown languages get English', () => {
  assert.doesNotMatch(JSON.stringify(playbookContent('EN')), /[А-Яа-яЁё]/);
  for (const l of ['SK', 'CS', 'UA', 'XX']) assert.equal(playbookContent(l), playbookContent('EN'), l);
});

test('access: lesson 2 free, the rest after the purchase; next lesson starts with the free one', async () => {
  const src = read('src/lib/playbook.ts');
  assert.match(src, /export const FREE_LESSON = 2;/);
  assert.match(src, /lesson === FREE_LESSON \|\| s\.purchased/);
  assert.match(src, /\[FREE_LESSON, 1, 3, 4, 5, 6, 7, 8\]/);
  // The client never writes the purchase flag itself.
  for (const f of ['src/lib/playbook.ts', 'src/lib/purchases.ts', 'src/app/playbook/paywall.tsx']) {
    assert.doesNotMatch(read(f), /from\(['"]playbook_progress['"]\)|playbook_set_purchased/, f);
  }
  assert.match(read('supabase/migrations/0034_playbook.sql'), /grant execute on function public\.playbook_set_purchased\(uuid, boolean\) to service_role;/);
});

test('no chat analysis or generated replies anywhere in the Playbook', () => {
  for (const f of ['src/lib/playbook.ts', 'src/components/Playbook.tsx', ...fs.readdirSync(new URL('src/app/playbook/', root)).map((x) => `src/app/playbook/${x}`)]) {
    assert.doesNotMatch(read(f), /api\.|messages|chat_id|anthropic|openai|generate/i, f);
  }
});

test('Playbook strings exist in every language; old guide strings are gone', async () => {
  const ru = await load('ru');
  const keys = Object.keys(ru).filter((k) => k.startsWith('playbook.'));
  assert.ok(keys.length >= 40);
  assert.ok(!Object.keys(ru).some((k) => k.startsWith('guide.')));
  for (const l of ['en', 'sk', 'cs', 'ua']) {
    const d = await load(l);
    for (const k of keys) assert.ok(d[k] && String(d[k]).trim(), `${l}: ${k}`);
  }
});
