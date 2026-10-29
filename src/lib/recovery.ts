// Pure parsing of the password-recovery link (no React Native imports, so scripts can load it).
// Supabase puts the credentials in the query (PKCE `code`, or `token_hash`) or in the fragment (implicit flow
// `access_token` + `refresh_token`). Errors come back as `error`/`error_code`/`error_description` in either place.
export type RecoveryParams = {
  code?: string;
  tokenHash?: string;
  type?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};

function decode(v: string): string {
  try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch { return v; }
}

function pairs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = decode(i < 0 ? part : part.slice(0, i));
    if (k && !(k in out)) out[k] = i < 0 ? '' : decode(part.slice(i + 1));
  }
  return out;
}

export function parseRecoveryUrl(url: string | null | undefined): RecoveryParams {
  if (!url) return {};
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt < 0 ? url : url.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : url.slice(hashAt + 1);
  const qAt = beforeHash.indexOf('?');
  const query = qAt < 0 ? '' : beforeHash.slice(qAt + 1);
  // The fragment wins over the query (the implicit flow only uses the fragment).
  const p = { ...pairs(query), ...pairs(hash) };
  const out: RecoveryParams = {};
  if (p.code) out.code = p.code;
  if (p.token_hash) out.tokenHash = p.token_hash;
  if (p.type) out.type = p.type;
  if (p.access_token) out.accessToken = p.access_token;
  if (p.refresh_token) out.refreshToken = p.refresh_token;
  if (p.error || p.error_code || p.error_description) out.error = p.error_description || p.error_code || p.error;
  return out;
}

export type RecoveryPlan =
  | { kind: 'exchange'; code: string }
  | { kind: 'verify'; tokenHash: string }
  | { kind: 'setSession'; accessToken: string; refreshToken: string }
  | { kind: 'invalid'; reason: string }
  | { kind: 'none' };

/** Decides which supabase-js call establishes the recovery session. */
export function planRecovery(url: string | null | undefined): RecoveryPlan {
  const p = parseRecoveryUrl(url);
  if (p.error) return { kind: 'invalid', reason: p.error };
  if (p.code) return { kind: 'exchange', code: p.code };
  if (p.tokenHash && (!p.type || p.type === 'recovery')) return { kind: 'verify', tokenHash: p.tokenHash };
  if (p.accessToken && p.refreshToken && (!p.type || p.type === 'recovery')) {
    return { kind: 'setSession', accessToken: p.accessToken, refreshToken: p.refreshToken };
  }
  return { kind: 'none' };
}
