// hCaptcha is used only when a site key is configured AND Supabase Auth → Bot protection is on.
export const HCAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY ?? '';
export const captchaEnabled = () => HCAPTCHA_SITE_KEY.length > 0;
