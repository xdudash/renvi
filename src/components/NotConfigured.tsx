import { Text } from 'react-native';
import { Card, Screen, StateBlock } from './ui';

// A build without Supabase settings. Developers (dev builds) see what to fix; a store build never shows technical
// names (scripts/check-release.mjs also refuses to release without them).
export function NotConfigured() {
  if (!__DEV__) {
    return (
      <Screen>
        <StateBlock icon="⌁" title="RENVI" copy="Сервис временно недоступен. Попробуйте позже. · The service is temporarily unavailable. Please try again later." />
      </Screen>
    );
  }
  return (
    <Screen>
      <StateBlock icon="⌁" title="Сервер не подключён" copy="В этой сборке не заданы EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY." />
      <Card><Text style={{ fontSize: 12, lineHeight: 18 }}>Скопируйте .env.example в .env, укажите адрес проекта Supabase и публичный anon key, затем перезапустите приложение. Подробности — в docs/SETUP.md.</Text></Card>
    </Screen>
  );
}
