import { Text } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Screen, StateBlock } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';
import { localeOf } from '@/i18n/current';
import { AppealOutcome } from '@/components/AppealOutcome';

// 93 · Временная приостановка
export default function AccountSuspended() {
  const { t } = useLang();
  const { profile } = useSession();
  const until = profile?.suspended_until ? new Date(profile.suspended_until).toLocaleString(localeOf(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <Screen>
      <StateBlock icon="Ⅱ" title={t('screens.accountSuspended.title')} copy={t('screens.accountSuspended.copy')} label={t('screens.accountSuspended.check')} onPress={() => router.push('/support-help')} />
      {until ? <Card tight><Text style={{ fontSize: 12 }}>{t('screens.accountSuspended.until', { until })}</Text></Card> : null}
      <AppealOutcome />
      <Btn kind="ghost" label={t('screens.accountSuspended.appeal')} onPress={() => router.push('/appeal')} />
    </Screen>
  );
}
