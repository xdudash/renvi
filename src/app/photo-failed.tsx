import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Card, Chip, Row, Screen, Title, useToast } from '@/components/ui';
import { failedFor, useChat } from '@/lib/chat';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 47 · Фото не отправилось
export default function PhotoFailed() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const { session } = useSession();
  const toast = useToast();
  const chat = useChat(match, session?.user.id);
  const [pending, setPending] = useState<{ client_id: string; photo_path: string | null } | null>(null);
  useEffect(() => { failedFor(session?.user.id, match).then((l) => setPending(l.find((p) => p.photo_path) ?? null), () => setPending(null)); }, [match, session?.user.id]);
  const name = pending?.photo_path?.split('/').pop() ?? 'photo.jpg';
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.photoFailed.soobschenie')} heading={t('screens.photoFailed.neUdalosOtpravitFoto')} sub={t('screens.photoFailed.fotoNeOtpravitsyaPovtorno')} />
      <Card>
        <Row>
          <View style={{ width: 49, height: 49, borderRadius: 25, backgroundColor: colors.blush }} />
          <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 13 }}>{name}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{t('screens.photoFailed.oshibkaSetiNeOtpravleno')}</Text></View>
          <Chip label={t('screens.photoFailed.oshibka')} tone="red" />
        </Row>
      </Card>
      <Btn label={t('screens.photoFailed.povtoritOtpravku')} disabled={!pending} onPress={async () => { if (!pending) return; const ok = await chat.retry(pending.client_id); toast(ok ? t('screens.photoFailed.povtornayaOtpravkaVypolnen') : t('screens.photoFailed.snovaNePoluchilos')); if (ok) router.back(); }} />
      <Btn kind="ghost" label={t('screens.photoFailed.udalitVlozhenie')} onPress={async () => { if (pending) await chat.discard(pending.client_id); router.back(); }} />
    </Screen>
  );
}
