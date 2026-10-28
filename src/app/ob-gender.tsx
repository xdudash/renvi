import { Text } from 'react-native';
import { Btn, Choice, Screen } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { GENDERS } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// 11 · Гендер
export default function ObGender() {
  const { t } = useLang();
  const { profile } = useSession();
  const [v, setV] = useDraft<string>(profile?.gender ?? 'man');
  const { save, busy } = useStepSave('ob-gender');
  return (
    <Screen>
      <OnbHeader step={1} kicker={t('screens.obGender.kicker')} heading={t('screens.obGender.heading')} sub={t('screens.obGender.sub')} />
      {GENDERS.map((g) => (
        <Choice key={g.key} selected={v === g.key} onPress={() => setV(g.key)}>
          <Text style={{ fontSize: 12 }}>{t(g.labelKey)}</Text><Text>{v === g.key ? '✓' : '○'}</Text>
        </Choice>
      ))}
      <Btn label={t('screens.obGender.continue')} onPress={() => save({ gender: v })} busy={busy} />
    </Screen>
  );
}
