// Strings for non-React code (src/lib/errors.ts, validate.ts). Spread into `ru` in ru.ts.
export const ruLib = {
  'lib.errors.offline': 'Нет соединения',
  'lib.errors.limit': 'Лимит лайков на сегодня',
  'lib.errors.notFound': 'Профиль недоступен',
  'lib.errors.unauthorized': 'Нет доступа',
  'lib.errors.rateLimited': 'Слишком много запросов. Попробуйте через час.',
  'lib.errors.server': 'Не удалось загрузить. Проверьте соединение и повторите.',
  'lib.validate.email': 'Введите корректный адрес почты',
  'lib.validate.password': 'Пароль — не менее 8 символов',
} as const;
