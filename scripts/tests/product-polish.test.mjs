// Product polish (Nov 2026): grid sizing, drawn detail icons, the men's guide, new strings, App Store permission texts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gridTileSize, SCREEN_GUTTER } from '../../src/lib/grid.ts';
import { guideChapters } from '../../src/i18n/guide.ts';

const root = new URL('../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const load = async (n) => (await import(new URL(`src/i18n/${n}.ts`, root).href))[n];

test('grid tiles plus gaps always fit the screen and have a real height', () => {
  for (const w of [320, 375, 390, 393, 430, 1024]) {
    for (const [cols, gap, ratio] of [[3, 7, 0.78], [2, 10, 0.72]]) {
      const t = gridTileSize(w, cols, gap, ratio);
      assert.ok(t.width * cols + gap * (cols - 1) <= w - SCREEN_GUTTER * 2, `${w}px ${cols} cols overflow`);
      assert.ok(t.height > t.width, 'portrait tiles');
      assert.ok(t.height > 50);
    }
  }
});

test('no grid relies on width % + aspectRatio again (tiles collapsed to zero height on iOS)', () => {
  for (const f of ['src/app/likes.tsx', 'src/components/PhotoGrid.tsx', 'src/components/Profile.tsx']) {
    assert.doesNotMatch(read(f), /width: '\d+(\.\d+)?%', aspectRatio/, f);
  }
});

test('profile detail icons are drawn icons that exist, never emoji (emoji showed as "?" on iOS)', () => {
  const icons = read('src/components/UiIcon.tsx');
  const details = read('src/lib/details.ts');
  const map = details.slice(details.indexOf('export const DETAIL_ICON'), details.indexOf('};', details.indexOf('export const DETAIL_ICON')));
  const names = [...map.matchAll(/: '([a-z]+)'/g)].map((m) => m[1]);
  assert.equal(names.length, 9);
  for (const n of names) assert.match(icons, new RegExp(`\\n\\s+${n}: <`), `icon ${n} is drawn in UiIcon`);
  assert.doesNotMatch(map, /\p{Extended_Pictographic}/u);
});

test('animated values are created once, not read from a ref during render', () => {
  for (const f of ['src/components/ui.tsx', 'src/components/SwipeCard.tsx', 'src/components/Motion.tsx']) {
    assert.doesNotMatch(read(f), /useRef\(new Animated\.Value/, f);
  }
});

test('the guide has the same six chapters with four tips in every language, without mixed alphabets', () => {
  const ru = guideChapters('RU');
  assert.equal(ru.length, 6);
  for (const lang of ['RU', 'EN', 'SK', 'CS', 'UA']) {
    const g = guideChapters(lang);
    assert.equal(g.length, ru.length, lang);
    for (const c of g) {
      assert.ok(c.title.trim() && c.lead.trim(), lang);
      assert.equal(c.tips.length, 4, `${lang}: ${c.title}`);
      const text = [c.title, c.lead, ...c.tips].join(' ');
      if (lang === 'EN' || lang === 'SK' || lang === 'CS') assert.doesNotMatch(text, /[А-Яа-яЁёІіЇїЄє]/, `${lang}: Cyrillic letter in "${c.title}"`);
      else assert.doesNotMatch(text.replace(/RENVI|Татры|[A-Z]{2,}/g, ''), /[а-яіїє][a-z]|[a-z][а-яіїє]/i, `${lang}: Latin letter inside a word in "${c.title}"`);
    }
  }
  assert.equal(guideChapters('XX').length, ru.length, 'unknown language falls back to Russian');
});

test('new strings exist in every language', async () => {
  const keys = ['guide.kicker', 'guide.heading', 'guide.sub', 'guide.progress', 'guide.markRead', 'guide.readAgain', 'guide.cta', 'guide.cardTitle', 'guide.cardSub',
    'screens.discover.stampPass', 'screens.discover.stampSpark', 'screens.discover.openProfile',
    'screens.obVerify.skip', 'screens.obReview.skippedTitle', 'screens.obReview.skippedSub'];
  for (const l of ['ru', 'en', 'sk', 'cs', 'ua']) {
    const d = await load(l);
    for (const k of keys) assert.ok(d[k] && String(d[k]).trim(), `${l}: ${k}`);
  }
});

test('iOS permission texts: English for review, translated per language', () => {
  const app = JSON.parse(read('app.json')).expo;
  const keys = ['NSPhotoLibraryUsageDescription', 'NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSLocationWhenInUseUsageDescription'];
  assert.equal(app.ios.infoPlist.CFBundleDevelopmentRegion, 'en');
  for (const l of ['en', 'ru', 'sk', 'cs', 'uk']) {
    assert.ok(app.locales?.[l], `locale ${l}`);
    const strings = JSON.parse(read(app.locales[l].replace('./', '')));
    for (const k of keys) assert.ok(strings[k]?.length > 30, `${l}: ${k}`);
  }
  const picker = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker')[1];
  for (const v of Object.values(picker)) assert.doesNotMatch(v, /[А-Яа-я]/, 'plugin defaults are English');
});

test('Discover keeps its list when you come back to the tab (no "jumping" to another person)', () => {
  const screen = read('src/app/discover.tsx');
  assert.match(screen, /d\.ensure\(\)/);
  assert.doesNotMatch(screen, /useEffect\(\(\) => \{ d\.load\(\); \}/);
});

test('the start screen is covered until the session is known (no flash of the sign-up screen)', () => {
  assert.match(read('src/app/_layout.tsx'), /\{ready \? null : <View/);
});
