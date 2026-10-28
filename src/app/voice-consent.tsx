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

// Голосовые · взаимное разрешение (separate from the photo consent, see supabase/migrations/0017_voice_messages.sql)
export default function VoiceConsent() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const toast = useToast();
  const ctx = useAsync(() => api.matchContext(match), [match]);
  const theirs = useSignedUrl(ctx.data?.partner.photo);
  const { items } = useMyPhotos();
  const [busy, setBusy] = useState(false);
  if (ctx.loading || !ctx.data) return <Screen tabs="chats"><BackLink /><Loading /></Screen>;
  const mine = ctx.data.my_voice_consent, them = ctx.data.their_voice_consent;
  const toggle = async () => {
    setBusy(true);
    try {
      await api.voiceConsent(match, !mine);
      if (!mine && them) { router.replace({ pathname: '/chat', params: { match } }); return; }
      toast(!mine ? t('screens.voiceConsent.waiting') : t('screens.voiceConsent.off'));
      ctx.reload();
    } catch { toast(t('screens.voiceConsent.saveFailed')); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.voiceConsent.kicker')} heading={t('screens.voiceConsent.heading')} sub={t('screens.voiceConsent.sub')} />
      <Card>
        <Row><Avatar uri={items[0]?.url} /><View><Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.voiceConsent.yours')}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{mine ? t('screens.voiceConsent.enabled') : t('screens.voiceConsent.notEnabled')}</Text></View></Row>
        <Line />
        <Row><Avatar uri={theirs} /><View><Text style={{ fontWeight: '700', fontSize: 13 }}>{t('screens.voiceConsent.theirs')}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{them ? t('screens.voiceConsent.enabled') : t('screens.voiceConsent.pending')}</Text></View></Row>
      </Card>
      <Btn label={mine ? t('screens.voiceConsent.disableMine') : t('screens.voiceConsent.allow')} busy={busy} onPress={toggle} />
      <Btn kind="ghost" label={t('screens.voiceConsent.notNow')} onPress={() => router.back()} />
    </Screen>
  );
}
