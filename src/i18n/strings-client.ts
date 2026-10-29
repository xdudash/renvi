// Russian source strings for the client-audit fixes (password recovery, load-error banner, photo errors).
// Spread into the Russian base dictionary in src/i18n/ru.ts.
export const ruClient = {
  'client.reset.kicker': 'ВОССТАНОВЛЕНИЕ · НОВЫЙ ПАРОЛЬ',
  'client.reset.heading': 'Придумайте новый пароль',
  'client.reset.sub': 'После сохранения вы сразу войдёте в аккаунт.',
  'client.reset.passwordLabel': 'НОВЫЙ ПАРОЛЬ',
  'client.reset.confirmLabel': 'ПОВТОРИТЕ ПАРОЛЬ',
  'client.reset.mismatch': 'Пароли не совпадают',
  'client.reset.save': 'Сохранить пароль',
  'client.reset.saved': 'Пароль изменён',
  'client.reset.saveFailed': 'Не удалось сохранить пароль. Попробуйте ещё раз или запросите новую ссылку.',
  'client.reset.checking': 'Проверяем ссылку…',
  'client.reset.invalidTitle': 'Ссылка недействительна',
  'client.reset.invalidCopy': 'Ссылка для восстановления устарела или уже использована. Запросите новое письмо.',
  'client.reset.requestNew': 'Запросить новую ссылку',
  'client.loadError.banner': 'Не удалось обновить данные аккаунта. Показаны последние загруженные.',
  'client.loadError.bannerEmpty': 'Не удалось загрузить ваш профиль. Проверьте соединение.',
  'client.loadError.retry': 'Повторить',
  'client.photos.deleteFailed': 'Не удалось удалить фото. Попробуйте ещё раз.',
  'client.photos.coverFailed': 'Не удалось сделать фото главным.',
} as const;
