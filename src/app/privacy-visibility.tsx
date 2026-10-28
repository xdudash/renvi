import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { BackLink, Btn, CheckRow, Screen, Title, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/theme/tokens';

// 69 · Скрытый профиль / инкогнито
export default function PrivacyVisibility() {
  const toast = useToast();
  const { profile, tier, refresh } = useSession();
  const [paused, setPaused] = useDraft<boolean>(!!profile?.paused);
  const [active, setActive] = useDraft<boolean>(profile?.show_active ?? true);
  const [incognito, setIncognito] = useDraft<boolean>(!!profile?.incognito);
  const [busy, setBusy] = useState(false);
  const premium = tier === 'premium';
  const save = async () => {
    setBusy(true);
    try { await api.saveOnboarding({ paused, show_active: active, incognito: premium && incognito }); await refresh(); toast('Изменения сохранены'); router.navigate('/me'); }
    catch { toast('Не удалось сохранить'); } finally { setBusy(false); }
  };
  return (
    <Screen tabs="me">
      <BackLink />
      <Title kicker="ВИДИМОСТЬ" heading="Как вас находят" sub="Скрытие профиля можно отменить в один шаг." />
      <Toggle title="Пауза анкеты" sub="Не показывать вас новым людям" on={paused} set={setPaused} />
      <Toggle title="Показывать «активен(на)»" sub="Скрывайте последнее время активности" on={active} set={setActive} />
      <Toggle title="Режим инкогнито" sub={premium ? 'Только люди, которым вы поставили лайк' : 'Доступен в RENVI Premium'} on={incognito} set={setIncognito} disabled={!premium} />
      {!premium ? <Btn kind="tertiary" label="Посмотреть Premium" onPress={() => router.push('/plans')} /> : null}
      <Btn label="Сохранить настройки" busy={busy} onPress={save} />
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
