import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bold, Btn, Card, Screen, Tiny, useToast } from '@/components/ui';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { startSelfieVerification } from '@/lib/verification';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

// 19 · Селфи-проверка
export default function ObVerify() {
  const toast = useToast();
  const { session, refresh } = useSession();
  const { save } = useStepSave('ob-verify');
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (!session) return;
    setBusy(true);
    const r = await startSelfieVerification(session.user.id);
    setBusy(false);
    if (r === 'denied') { toast('Разрешите доступ к камере в настройках'); return; }
    if (r === 'error') { toast('Не удалось отправить селфи. Повторите попытку.'); return; }
    if (r === 'cancel') return;
    await refresh();
    save({});
  };
  return (
    <Screen>
      <OnbHeader step={9} kicker="ПОДТВЕРЖДЕНИЕ" heading="Покажите, что вы — это вы" sub="Селфи сверит модератор. Значок подтверждения помогает другим сделать информированный выбор, но не гарантирует безопасность." />
      <View style={{ borderRadius: 20, backgroundColor: colors.blush, height: 150, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 53, color: '#b74e43' }}>◉</Text>
      </View>
      <Card tight><Bold>Понадобится камера</Bold><Tiny>Фото не станет частью анкеты. Проверка проходит вручную.</Tiny></Card>
      <Btn label="Начать проверку" busy={busy} onPress={start} />
      <Btn kind="ghost" label="Почему это важно?" onPress={() => router.push('/safety')} />
    </Screen>
  );
}
