// Web build: react-native-webview has no web implementation, so the Daily room is shown in an iframe.
import { createElement } from 'react';

export function isDailyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.daily.co');
  } catch {
    return false;
  }
}

export async function ensureCallPermissions(): Promise<boolean> {
  return true; // the browser asks for camera/mic itself
}

export function VideoFrame({ url, label }: { url: string; label: string }) {
  if (!isDailyUrl(url)) return null;
  return createElement('iframe', {
    src: url,
    title: label,
    allow: 'camera; microphone; autoplay; fullscreen',
    style: { flex: 1, width: '100%', height: '100%', border: 0, backgroundColor: '#000' },
  });
}
