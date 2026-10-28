// Base (complete) dictionary. Russian is the source of truth for the key set:
// every key used by t() must exist here. Other languages may only contain a subset.
export const ru = {
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

export type TranslationKey = keyof typeof ru;
export type Dictionary = Partial<Record<TranslationKey, string>>;
