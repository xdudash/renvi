import { router } from 'expo-router';
import { Btn, Screen, StateBlock } from '@/components/ui';
import { useLang } from '@/lib/lang';

// 94 · Аккаунт заблокирован
export default function AccountBanned() {
  const { t } = useLang();
  return (
    <Screen>
      <StateBlock icon="×" title={t('screens.accountBanned.akkauntZablokirovan')} copy={t('screens.accountBanned.zdesBudutPrichinaData')} label={t('screens.accountBanned.podatApellyatsiyu')} onPress={() => router.push('/appeal')} />
      <Btn kind="ghost" label={t('screens.accountBanned.skachatKopiyuDannyh')} onPress={() => router.push('/data-export')} />
    </Screen>
  );
}
