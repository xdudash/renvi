import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, BackLink, Btn, Card, Line, Loading, Row, Screen, Title, useToast } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useMyPhotos } from '@/hooks/usePhotos';
import { api } from '@/lib/api';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 46 · Фото · взаимное разрешение
export default function PhotoConsent() {
  const { t } = useLang();
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
      toast(!mine ? t('screens.photoConsent.waiting') : t('screens.photoConsent.off'));
      ctx.reload();
    } catch { toast(t('screens.photoConsent.saveFailed')); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.photoConsent.kicker')} heading={t('screens.photoConsent.heading')} sub={t('screens.photoConsent.sub')} />
      <Card>
        <Row><Avatar uri={items[0]?.url} /><View><Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.photoConsent.yours')}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{mine ? t('screens.photoConsent.enabled') : t('screens.photoConsent.notEnabled')}</Text></View></Row>
        <Line />
        <Row><Avatar uri={theirs} /><View><Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.photoConsent.theirs')}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{them ? t('screens.photoConsent.enabled') : t('screens.photoConsent.pending')}</Text></View></Row>
      </Card>
      <Btn label={mine ? t('screens.photoConsent.disableMine') : t('screens.photoConsent.allow')} busy={busy} onPress={toggle} />
      <Btn kind="ghost" label={t('screens.photoConsent.notNow')} onPress={() => router.back()} />
    </Screen>
  );
}
