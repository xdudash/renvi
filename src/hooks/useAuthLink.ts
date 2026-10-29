import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

// Capture incoming navigation events, not every render: scrubbing consumed tokens with replaceState must not
// turn a successful callback into an invalid one. Hash-only navigation can reuse the same mounted screen.
export function useAuthLink(): string | null {
  const nativeUrl = Linking.useLinkingURL();
  const [browserUrl, setBrowserUrl] = useState<string | null>(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const changed = () => setBrowserUrl(window.location.href);
    window.addEventListener('hashchange', changed);
    window.addEventListener('popstate', changed);
    return () => {
      window.removeEventListener('hashchange', changed);
      window.removeEventListener('popstate', changed);
    };
  }, []);
  return Platform.OS === 'web' ? browserUrl : nativeUrl;
}
