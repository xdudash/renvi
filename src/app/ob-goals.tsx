import { useState } from 'react';
import { router } from 'expo-router';
import { Btn, Screen, useToast } from '@/components/ui';
import { BigOption } from '@/components/Kit';
import { OnbHeader } from '@/components/Onboarding';
import { api, type Goal } from '@/lib/api';
import { GOAL_OPTIONS } from '@/lib/modes';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// ob-goals · «Зачем ты здесь?» — what the person wants from RENVI; they can pick several and change it later.
export default function ObGoals() {
  const { t } = useLang();
  const toast = useToast();
  const { profile, refresh } = useSession();
  const [goals, setGoals] = useState<Goal[]>((profile?.goals as Goal[] | undefined)?.length ? (profile!.goals as Goal[]) : ['dating']);
  const [busy, setBusy] = useState(false);
  const flip = (g: Goal) => setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  const next = async () => {
    if (!goals.length) { toast(t('modes.goals.pick')); return; }
    setBusy(true);
    try {
      // A brand-new account has no profile row yet; the first onboarding save creates it.
      await api.saveOnboarding({ onboarding_step: 1 });
      await api.setGoals(goals);
      await refresh();
      router.push('/ob-status');
    } catch {
      toast(t('modes.saveFail'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <OnbHeader step={0} kicker={t('modes.goals.kicker')} heading={t('modes.goals.h')} sub={t('modes.goals.sub')} />
      {GOAL_OPTIONS.map((o) => (
        <BigOption key={o.key} on={goals.includes(o.key)} icon={o.icon} title={t(o.title)} sub={t(o.sub)} onPress={() => flip(o.key)} />
      ))}
      <Btn label={t('modes.goals.cont')} onPress={next} busy={busy} />
    </Screen>
  );
}
