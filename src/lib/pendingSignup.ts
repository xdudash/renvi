// Credentials held in memory between "Создать аккаунт" and the CAPTCHA step (never stored).
let pending: { email: string; password: string } | null = null;
export const setPendingSignup = (v: { email: string; password: string } | null) => { pending = v; };
export const getPendingSignup = () => pending;
