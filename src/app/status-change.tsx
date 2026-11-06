import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { BackLink, Btn, ErrorBlock, Loading, Screen, Title, useToast } from '@/components/ui';
import { BigOption, Hint } from '@/components/Kit';
import { api, type RelStatus } from '@/lib/api';
import { useModes } from '@/hooks/useModes';
import { STATUS_OPTIONS } from '@/lib/modes';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// status-change · «Что изменилось?» — the server enforces the 7-day wait before dating opens again.
export default function StatusChange() {
  const { t } = useLang();
  const toast = useToast();
  const { refresh } = useSession();
  const { modes, loading, error, reload } = useModes();
  const [status, setStatus] = useState<RelStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (modes && status === null) setStatus(modes.status); }, [modes, status]);
  if (loading) return <Screen><BackLink /><Loading /></Screen>;
  if (error || !modes) return <Screen><BackLink /><ErrorBlock message={t('modes.saveFail')} onRetry={reload} /></Screen>;
  const cur = status ?? modes.status;
  const save = async () => {
    setBusy(true);
    try {
      if (cur !== modes.status) await api.setStatus(cur);
      await refresh();
      toast(t('modes.change.saved'));
      // Choosing a couple status without a linked profile continues to the linking screen.
      router.replace((cur === 'couple' && modes.status !== 'couple' ? '/ob-pair' : '/modes') as never);
    } catch { toast(t('modes.saveFail')); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <BackLink />
      <Title kicker={t('modes.statusTitle')} heading={t('modes.change.h')} sub={t('modes.change.sub')} />
      {STATUS_OPTIONS.map((o) => (
        <BigOption key={o.key} on={cur === o.key} icon={o.icon} title={t(o.title)} sub={t(o.sub)} onPress={() => setStatus(o.key)} />
      ))}
      <Hint>{t('modes.change.hint')}</Hint>
      <Btn label={t('modes.change.save')} onPress={save} busy={busy} />
    </Screen>
  );
}
