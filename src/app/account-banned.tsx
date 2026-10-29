import { router } from 'expo-router';
import { Btn, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';
import { AppealOutcome } from '@/components/AppealOutcome';

// 94 · Аккаунт заблокирован
export default function AccountBanned() {
  const { t } = useLang();
  return (
    <Screen>
      <StateBlock icon="×" title={t('screens.accountBanned.akkauntZablokirovan')} copy={t('screens.accountBanned.zdesBudutPrichinaData')} label={t('screens.accountBanned.podatApellyatsiyu')} onPress={() => router.push('/appeal')} />
      <AppealOutcome />
      <Btn kind="ghost" label={t('screens.accountBanned.skachatKopiyuDannyh')} onPress={() => router.push('/data-export')} />
      {/* Deletion stays available under any sanction (App Review 5.1.1(v); gateRoutes RESTRICTED_OK). */}
      <Btn kind="ghost" label={t('screens.privacyData.udalitAkkaunt')} onPress={() => router.push('/delete-account')} />
    </Screen>
  );
}
