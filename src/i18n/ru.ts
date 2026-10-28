// Base (complete) dictionary. Russian is the source of truth for the key set:
// every key used by t() must exist here. Other languages may only contain a subset.
import { ruA } from './strings-a.ts';
import { ruB } from './strings-b.ts';
import { ruVoice } from './strings-voice.ts';

const ruBase = {
  'common.close': 'Закрыть',
  'common.back': 'Назад',
  'common.backLink': '‹ Назад',
  'common.retry': 'Повторить',
  'common.loading': 'Загружаем…',
  'common.loadFailed': 'Не удалось загрузить',
  'common.statusEyebrow': 'RENVI · СТАТУС',
  'common.chooseLanguage': 'Выбрать язык',
  'common.safetyCenter': 'Центр безопасности',
  'tabs.discover': 'Знакомства',
  'tabs.likes': 'Искры',
  'tabs.chats': 'Чаты',
  'tabs.me': 'Профиль',
} as const;

// Screen and component strings live in strings-a.ts / strings-b.ts (one file per half); voice messages in strings-voice.ts.
export const ru = { ...ruBase, ...ruA, ...ruB, ...ruVoice } as const;

export type TranslationKey = keyof typeof ru;
export type Dictionary = Partial<Record<TranslationKey, string>>;
