// Pure: which in-app route a tapped push notification may open. Server pushes (supabase/functions/push,
// weekly-digest) send data.route = '/chat?match=…', '/video-call?match=…' or '/discover'.
const ALLOWED = new Set(['/chat', '/video-call', '/discover', '/likes', '/chats', '/me', '/date-incoming', '/date-accepted', '/date-pending', '/date-declined']);

export function pushRoute(data: unknown): string | null {
  const route = (data as { route?: unknown } | null | undefined)?.route;
  if (typeof route !== 'string' || route.length > 300) return null;
  // Only app-relative paths: no scheme, no protocol-relative '//host', no backslash tricks.
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('\\')) return null;
  const path = route.split(/[?#]/)[0];
  return ALLOWED.has(path) ? route : null;
}

/** Identifies one notification tap, so the launch tap is not handled twice (listener + last response). */
export const responseKey = (r: { notification: { request: { identifier: string } } } | null | undefined) =>
  r?.notification?.request?.identifier ?? null;
