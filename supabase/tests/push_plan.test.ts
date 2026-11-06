import { expect, test } from 'bun:test';
import { planChatRoute, planMessageText, PLAN_MESSAGE_TEXT } from '../functions/push/text.ts';

const ID = '11111111-2222-3333-4444-555555555555';

test('plan push opens the plan chat by a plain uuid only', () => {
  expect(planChatRoute(ID)).toBe(`/plan-chat?id=${ID}`);
  expect(planChatRoute(ID.toUpperCase())).toBe(`/plan-chat?id=${ID}`);
  for (const bad of ['', 'abc', `${ID}&x=1`, `${ID}/../admin`, '//evil', null, undefined, 5, { id: ID }]) expect(planChatRoute(bad)).toBeNull();
});

test('plan push wording follows the language and falls back to Russian', () => {
  expect(planMessageText('sk')).toEqual(PLAN_MESSAGE_TEXT.SK);
  expect(planMessageText('EN').title).toContain('plan');
  expect(planMessageText(null)).toEqual(PLAN_MESSAGE_TEXT.RU);
  expect(planMessageText('XX')).toEqual(PLAN_MESSAGE_TEXT.RU);
});

test('plan push text is generic: no placeholders, no names, no message text', () => {
  for (const [lang, x] of Object.entries(PLAN_MESSAGE_TEXT)) {
    expect(Object.keys(x).sort()).toEqual(['body', 'title']);
    expect(`${x.title} ${x.body}`).not.toMatch(/[{}$%]/);
    expect(lang).toMatch(/^(RU|UA|SK|CS|EN)$/);
  }
});
