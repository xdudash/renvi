import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { colors } from '@/theme/tokens';
import { SessionProvider, useSession } from '@/lib/session';
import { ToastProvider } from '@/components/ui';
import { LangProvider } from '@/lib/lang';
import { DiscoverProvider } from '@/lib/discover';
import { Gate } from '@/components/Gate';
import { NotConfigured } from '@/components/NotConfigured';
import { AnalyticsProvider } from '@/lib/analytics';
import { WebUpdateBanner } from '@/components/WebUpdateBanner';
import { pushRoute, responseKey } from '@/lib/pushRoute';

const handledPushes = new Set<string>();

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

function Shell() {
  const { configured } = useSession();
  // Tapping a push opens the right conversation. The listener alone misses the tap that launched a killed app
  // (cold start), so the last response is read once as well; each tap is handled once (module-level set).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    const open = (r: Notifications.NotificationResponse | null) => {
      const key = responseKey(r);
      if (!r || !key || handledPushes.has(key)) return;
      handledPushes.add(key);
      const route = pushRoute(r.notification.request.content.data);
      if (route) router.push(route as never);
    };
    Notifications.getLastNotificationResponseAsync()
      .then((r) => { if (alive) { open(r); Notifications.clearLastNotificationResponseAsync().catch(() => {}); } })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => { alive = false; sub.remove(); };
  }, []);
  if (!configured) return <NotConfigured />;
  return (
    <>
      <Gate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'fade' }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LangProvider>
        <SessionProvider>
          <AnalyticsProvider>
          <DiscoverProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <Shell />
              <WebUpdateBanner />
            </ToastProvider>
          </DiscoverProvider>
          </AnalyticsProvider>
        </SessionProvider>
      </LangProvider>
    </SafeAreaProvider>
  );
}
