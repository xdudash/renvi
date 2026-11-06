import { useState } from 'react';
import { router } from 'expo-router';
import { Btn, Screen, useToast } from '@/components/ui';
import { BigOption, Hint } from '@/components/Kit';
import { OnbHeader } from '@/components/Onboarding';
import { api, type RelStatus } from '@/lib/api';
import { STATUS_OPTIONS } from '@/lib/modes';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// ob-status · «Твой статус» — decides where the person is visible; a couple status leads on to linking profiles.
export default function ObStatus() {
  const { t } = useLang();
  const toast = useToast();
  const { profile, refresh } = useSession();
  const [status, setStatus] = useState<RelStatus>((profile?.relationship_status as RelStatus | undefined) ?? 'single');
  const [busy, setBusy] = useState(false);
  const next = async () => {
    setBusy(true);
    try {
      await api.setStatus(status);
      await api.saveOnboarding({ onboarding_step: 2 });
      await refresh();
      router.push(status === 'couple' ? '/ob-pair' : '/ob-age');
    } catch {
      toast(t('modes.saveFail'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <OnbHeader step={1} kicker={t('modes.status.kicker')} heading={t('modes.status.h')} sub={t('modes.status.sub')} />
      {STATUS_OPTIONS.map((o) => (
        <BigOption key={o.key} on={status === o.key} icon={o.icon} title={t(o.title)} sub={t(o.sub)} onPress={() => setStatus(o.key)} />
      ))}
      <Hint>{t('modes.status.hint')}</Hint>
      <Btn label={status === 'couple' ? t('modes.status.toPair') : t('modes.goals.cont')} onPress={next} busy={busy} />
    </Screen>
  );
}
