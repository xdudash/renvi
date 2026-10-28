export function validateEmail(v: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Введите корректный адрес почты';
}
export function validatePassword(v: string): string | null {
  return v.length >= 8 ? null : 'Пароль — не менее 8 символов';
}
