// Credentials held in memory between "Создать аккаунт" and the CAPTCHA step (never stored).
let pending: { email: string; password: string } | null = null;
export const setPendingSignup = (v: { email: string; password: string } | null) => { pending = v; };
export const getPendingSignup = () => pending;

// Credentials of the account waiting for e-mail confirmation, held in memory only (never stored) while the
// "Письмо отправлено" screen is open: when the user confirms in the mail app / browser and comes back, the app
// signs in by itself instead of asking them to find the sign-in screen. Cleared on success or when they leave.
let awaiting: { email: string; password: string } | null = null;
export const setAwaitingConfirmation = (v: { email: string; password: string } | null) => { awaiting = v; };
export const getAwaitingConfirmation = () => awaiting;
