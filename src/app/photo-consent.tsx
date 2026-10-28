import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, BackLink, Btn, Card, Line, Loading, Row, Screen, Title, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useMyPhotos } from '@/hooks/usePhotos';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';

// 46 · Фото · взаимное разрешение
export default function PhotoConsent() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const toast = useToast();
  const ctx = useAsync(() => api.matchContext(match), [match]);
  const theirs = useSignedUrl(ctx.data?.partner.photo);
  const { items } = useMyPhotos();
  const [busy, setBusy] = useState(false);
  if (ctx.loading || !ctx.data) return <Screen tabs="chats"><BackLink /><Loading /></Screen>;
  const mine = ctx.data.my_photo_consent, them = ctx.data.their_photo_consent;
  const toggle = async () => {
    setBusy(true);
    try {
      await api.photoConsent(match, !mine);
      if (!mine && them) { router.replace({ pathname: '/chat', params: { match } }); return; }
      toast(!mine ? 'Ждём взаимного согласия' : 'Ваше разрешение выключено');
      ctx.reload();
    } catch { toast('Не удалось сохранить'); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="ОБМЕН МЕДИА" heading="Фото — только по взаимному согласию" sub="Пока вы оба не разрешили обмен, фото нельзя отправить в чат." />
      <Card>
        <Row><Avatar uri={items[0]?.url} /><View><Text style={{ fontWeight: '700', fontSize: 13 }}>Ваше разрешение</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{mine ? 'включено' : 'ещё не включено'}</Text></View></Row>
        <Line />
        <Row><Avatar uri={theirs} /><View><Text style={{ fontWeight: '700', fontSize: 13 }}>Разрешение собеседника</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{them ? 'включено' : 'ожидает подтверждения'}</Text></View></Row>
      </Card>
      <Btn label={mine ? 'Выключить своё разрешение' : 'Разрешить обмен фото'} busy={busy} onPress={toggle} />
      <Btn kind="ghost" label="Не сейчас" onPress={() => router.back()} />
    </Screen>
  );
}
