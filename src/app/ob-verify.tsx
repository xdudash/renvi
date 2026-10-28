import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bold, Btn, Card, Screen, Tiny, useToast } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { startSelfieVerification } from '@/lib/verification';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 19 · Селфи-проверка
export default function ObVerify() {
  const { t } = useLang();
  const toast = useToast();
  const { session, refresh } = useSession();
  const { save } = useStepSave('ob-verify');
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (!session) return;
    setBusy(true);
    const r = await startSelfieVerification(session.user.id);
    setBusy(false);
    if (r === 'denied') { toast(t('screens.obVerify.razreshiteDostupKKamere')); return; }
    if (r === 'error') { toast(t('screens.obVerify.neUdalosOtpravitSelfi')); return; }
    if (r === 'cancel') return;
    await refresh();
    save({});
  };
  return (
    <Screen>
      <OnbHeader step={9} kicker={t('screens.obVerify.podtverzhdenie')} heading={t('screens.obVerify.pokazhiteChtoVyEto')} sub={t('screens.obVerify.selfiSveritModeratorZnacho')} />
      <View style={{ borderRadius: 20, backgroundColor: colors.blush, height: 150, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 53, color: '#b74e43' }}>◉</Text>
      </View>
      <Card tight><Bold>{t('screens.obVerify.ponadobitsyaKamera')}</Bold><Tiny>{t('screens.obVerify.fotoNeStanetChastyu')}</Tiny></Card>
      <Btn label={t('screens.obVerify.nachatProverku')} busy={busy} onPress={start} />
      <Btn kind="ghost" label={t('screens.obVerify.pochemuEtoVazhno')} onPress={() => router.push('/safety')} />
    </Screen>
  );
}
