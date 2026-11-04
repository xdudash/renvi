// RENVI Playbook: a paid (one purchase) course for men, 8 lessons. All copy is static and ships with the app;
// nothing here reads chats or profiles. Lesson 2 is free, the rest needs the purchase (server: playbook_progress).

/** One chat bubble. `me` = the user (right, red); otherwise it is her (left, white). */
export type Msg = { me?: boolean; text: string };

export type LessonCard =
  // Opening thought: what is wrong and why.
  | { type: 'idea'; title: string; text: string }
  // Two short chats side by side: how it dies / how it lives.
  | { type: 'compare'; badLabel: string; bad: Msg[]; badNote: string; goodLabel: string; good: Msg[]; goodNote: string }
  // Lines marked good or bad (photos, teasing, invitations).
  | { type: 'dos'; title: string; text?: string; items: { ok: boolean; text: string }[] }
  // Her profile answer + several ways to start (lesson 2).
  | { type: 'examples'; title: string; context: string; items: { label: string; text: string }[] }
  // Short situations with one line of advice each (lesson 4).
  | { type: 'tips'; title: string; items: { title: string; text: string }[] }
  // Dark card with one rule to remember.
  | { type: 'rule'; title: string; text: string }
  // One situation, three answers, explanation after the choice. Nothing is stored or scored.
  | { type: 'quiz'; context: string; chat?: Msg[]; options: [string, string, string]; best: 0 | 1 | 2; why: string }
  // Last card: one sentence and the button to the next lesson.
  | { type: 'summary'; text: string };

export type Lesson = { id: number; title: string; minutes: number; cards: LessonCard[] };

export type DateRoute = {
  title: string;
  budget: 0 | 15 | 40; // € per person, upper bound
  time: string;
  stops: [string, string, string];
  topic: string;
};

export type FirstDateTab = { title: string; blocks: { title: string; text: string; quote?: string }[] };

export type Situation = {
  tag: string; // short label in capitals: «ОНА ПРОПАЛА»
  context?: string; // one line before the chat
  chat: Msg[];
  status?: string; // small grey line under the chat: «прочитано · 2 дня назад»
  options: [string, string, string];
  best: 0 | 1 | 2;
  why: string;
  lesson: number;
};

export type PlaybookContent = {
  lessons: Lesson[]; // lessons 1–5 (card format)
  dates: { title: string; intro: string; routes: DateRoute[]; rules: string[] }; // lesson 6
  firstDate: { title: string; intro: string; tabs: FirstDateTab[] }; // lesson 7
  trainer: Situation[]; // lesson 8, 30 situations
  paywall: { chat: Msg[]; points: string[] };
  titles: Record<number, string>; // lesson number → title in the list
};
