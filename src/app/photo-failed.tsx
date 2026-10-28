import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Row, Screen, Title, useToast } from '@/components/ui';
import { failedFor, useChat } from '@/lib/chat';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

// 47 · Фото не отправилось
export default function PhotoFailed() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const { session } = useSession();
  const toast = useToast();
  const chat = useChat(match, session?.user.id);
  const [pending, setPending] = useState<{ client_id: string; photo_path: string | null } | null>(null);
  useEffect(() => { failedFor(match).then((l) => setPending(l.find((p) => p.photo_path) ?? null)); }, [match]);
  const name = pending?.photo_path?.split('/').pop() ?? 'photo.jpg';
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="СООБЩЕНИЕ" heading="Не удалось отправить фото" sub="Фото не отправится повторно без вашего действия." />
      <Card>
        <Row>
          <View style={{ width: 49, height: 49, borderRadius: 25, backgroundColor: colors.blush }} />
          <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 13 }}>{name}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>Ошибка сети · не отправлено</Text></View>
          <Chip label="Ошибка" tone="red" />
        </Row>
      </Card>
      <Btn label="Повторить отправку" disabled={!pending} onPress={async () => { if (!pending) return; const ok = await chat.retry(pending.client_id); toast(ok ? 'Повторная отправка выполнена' : 'Снова не получилось'); if (ok) router.back(); }} />
      <Btn kind="ghost" label="Удалить вложение" onPress={async () => { if (pending) await chat.discard(pending.client_id); router.back(); }} />
    </Screen>
  );
}
