import { ruDemo } from './strings-demo.ts';
import { ruIdentity } from './strings-identity.ts';
import { ruAnalytics } from './strings-analytics.ts';
// Base (complete) dictionary. Russian is the source of truth for the key set:
// every key used by t() must exist here. Other languages may only contain a subset.
import { ruA } from './strings-a.ts';
import { ruB } from './strings-b.ts';
import { ruLib } from './strings-lib.ts';
import { ruDigest } from './strings-digest.ts';
import { ruVideo } from './strings-video.ts';
import { ruClient } from './strings-client.ts';
import { ruAdmin } from './strings-admin.ts';
import { ruWeb } from './strings-web.ts';

const ruBase = {
  'chatOffline.saved': 'Нет связи с сервером. Неотправленные сообщения сохранены на этом устройстве.',
  'chatOffline.photo': 'Неотправленное фото',
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

// Screen and component strings live in strings-a.ts / strings-b.ts (one file per half); feature strings in strings-*.ts.
export const ru = { ...ruBase, ...ruA, ...ruB, ...ruLib, ...ruDigest, ...ruVideo, ...ruClient, ...ruAdmin, ...ruWeb, ...ruAnalytics, ...ruIdentity, ...ruDemo } as const;

export type TranslationKey = keyof typeof ru;
export type Dictionary = Partial<Record<TranslationKey, string>>;
