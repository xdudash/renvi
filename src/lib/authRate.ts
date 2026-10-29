// Pure: how long Auth asks to wait before another e-mail to the same address, or null if the error is something else.
// Supabase answers 429 with error code over_email_send_rate_limit and a message like
// "For security purposes, you can only request this after 42 seconds."
export function resendWaitSeconds(error: { status?: number; code?: string; message?: string } | null | undefined): number | null {
  if (!error) return null;
  const msg = error.message ?? '';
  const limited = error.status === 429 || error.code === 'over_email_send_rate_limit' || /only request this after/i.test(msg);
  if (!limited) return null;
  const m = msg.match(/after (\d+) seconds?/i);
  const n = m ? Number(m[1]) : 60;
  return Math.min(Math.max(n, 1), 3600);
}
