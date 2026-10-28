import { Text } from 'react-native';
import { Card, Screen, StateBlock } from './ui';

// Shown only in a build without Supabase settings (developer misconfiguration), never to end users.
export function NotConfigured() {
  return (
    <Screen>
      <StateBlock icon="⌁" title="Сервер не подключён" copy="В этой сборке не заданы EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY." />
      <Card><Text style={{ fontSize: 12, lineHeight: 18 }}>Скопируйте .env.example в .env, укажите адрес проекта Supabase и публичный anon key, затем перезапустите приложение. Подробности — в docs/SETUP.md.</Text></Card>
    </Screen>
  );
}
