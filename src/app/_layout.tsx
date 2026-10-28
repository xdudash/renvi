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

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

function Shell() {
  const { configured } = useSession();
  // Tapping a push opens the right conversation.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const route = r.notification.request.content.data?.route;
      if (typeof route === 'string' && route.startsWith('/')) router.push(route as never);
    });
    return () => sub.remove();
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
          <DiscoverProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <Shell />
            </ToastProvider>
          </DiscoverProvider>
        </SessionProvider>
      </LangProvider>
    </SafeAreaProvider>
  );
}
