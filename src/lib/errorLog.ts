import { supabase } from './supabase';

// Writes to the admin error journal. Never includes message text or personal data; e-mails are masked.
export function logError(area: string, message: string) {
  const clean = message.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '***@***').slice(0, 300);
  supabase.auth.getUser().then(({ data }) => {
    supabase.from('error_events').insert({ area, message: clean, user_id: data.user?.id ?? null }).then(() => {}, () => {});
  }, () => {});
}
