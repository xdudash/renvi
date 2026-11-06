// Wording of the plan-chat push by the recipient's profile language (profiles.language: SK, CS, EN, RU, UA; RU fallback).
// Deliberately generic: no plan title, no names, no message text, so nothing leaks on a lock screen.
export type PushText = { title: string; body: string };

export const PLAN_MESSAGE_TEXT: Record<string, PushText> = {
  RU: { title: 'Новое сообщение в плане', body: 'Откройте RENVI' },
  UA: { title: 'Нове повідомлення в плані', body: 'Відкрийте RENVI' },
  SK: { title: 'Nová správa v pláne', body: 'Otvor RENVI' },
  CS: { title: 'Nová zpráva v plánu', body: 'Otevři RENVI' },
  EN: { title: 'New message in your plan', body: 'Open RENVI' },
};

export function planMessageText(language: string | null | undefined): PushText {
  return PLAN_MESSAGE_TEXT[(language ?? '').toUpperCase()] ?? PLAN_MESSAGE_TEXT.RU;
}

/** In-app route opened by tapping the push. The id must be a plain uuid, so nothing else can be injected into the route. */
export function planChatRoute(planId: unknown): string | null {
  return typeof planId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId) ? `/plan-chat?id=${planId.toLowerCase()}` : null;
}
