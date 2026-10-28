import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, CheckRow, Screen, Title, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 69 · Скрытый профиль / инкогнито
export default function PrivacyVisibility() {
  const { t } = useLang();
  const toast = useToast();
  const { profile, tier, refresh } = useSession();
  const [paused, setPaused] = useDraft<boolean>(!!profile?.paused);
  const [active, setActive] = useDraft<boolean>(profile?.show_active ?? true);
  const [incognito, setIncognito] = useDraft<boolean>(!!profile?.incognito);
  const [busy, setBusy] = useState(false);
  const premium = tier === 'premium';
  const save = async () => {
    setBusy(true);
    try { await api.saveOnboarding({ paused, show_active: active, incognito: premium && incognito }); await refresh(); toast(t('screens.privacyVisibility.saved')); router.navigate('/me'); }
    catch { toast(t('screens.privacyVisibility.saveFailed')); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker={t('screens.privacyVisibility.kicker')} heading={t('screens.privacyVisibility.heading')} sub={t('screens.privacyVisibility.sub')} />
      <Toggle title={t('screens.privacyVisibility.pauseTitle')} sub={t('screens.privacyVisibility.pauseSub')} on={paused} set={setPaused} />
      <Toggle title={t('screens.privacyVisibility.activeTitle')} sub={t('screens.privacyVisibility.activeSub')} on={active} set={setActive} />
      <Toggle title={t('screens.privacyVisibility.incognitoTitle')} sub={premium ? t('screens.privacyVisibility.incognitoSub') : t('screens.privacyVisibility.incognitoLocked')} on={incognito} set={setIncognito} disabled={!premium} />
      {!premium ? <Btn kind="tertiary" label={t('screens.privacyVisibility.viewPremium')} onPress={() => router.push('/plans')} /> : null}
      <Btn label={t('screens.privacyVisibility.save')} busy={busy} onPress={save} />
    </Screen>
  );
}

function Toggle({ title, sub, on, set, disabled }: { title: string; sub: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <CheckRow disabled={disabled} on={on} onPress={() => set(!on)}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: disabled ? '#aaa' : colors.ink }}>{title}</Text><Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{sub}</Text>
    </CheckRow>
  );
}
