// Daily.co Prebuilt inside the app (iOS / Android). The web build uses VideoFrame.web.tsx (an iframe).
import { PermissionsAndroid, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

/** Only the Daily room itself may load in the top frame; links elsewhere are ignored. */
export function isDailyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.daily.co');
  } catch {
    return false;
  }
}

/**
 * Android WebView can only use camera/mic when the app holds the runtime permissions (manifest entries come
 * from app.json). iOS asks the system itself on first getUserMedia, using the Info.plist texts.
 */
export async function ensureCallPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const res = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.CAMERA, PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]);
  return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

export function VideoFrame({ url, label }: { url: string; label: string }) {
  return (
    <WebView
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: '#000' }}
      accessibilityLabel={label}
      originWhitelist={['https://*']}
      javaScriptEnabled
      domStorageEnabled
      // iOS: play the call inline, not in the native full-screen player; start without an extra tap.
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      // iOS 15+: the Daily page gets camera/mic without a second WebView prompt; other hosts must ask.
      mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
      allowsBackForwardNavigationGestures={false}
      onShouldStartLoadWithRequest={(r) => r.isTopFrame === false || r.url === 'about:blank' || isDailyUrl(r.url)}
      incognito
    />
  );
}
