import { Text, View } from 'react-native';
import { Btn, Choice, Screen } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { INTENTS } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// 13 · Намерение
export default function ObIntent() {
  const { t } = useLang();
  const { profile } = useSession();
  const [v, setV] = useDraft<string>(profile?.intent ?? 'serious');
  const { save, busy } = useStepSave('ob-intent');
  return (
    <Screen>
      <OnbHeader step={3} kicker={t('screens.obIntent.vashNastroy')} heading={t('screens.obIntent.chegoVySeychasIschete')} sub={t('screens.obIntent.mozhnoVybratToChto')} />
      {INTENTS.map((i) => (
        <Choice key={i.key} selected={v === i.key} onPress={() => setV(i.key)}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700' }}>{i.label}</Text>
            <Text style={{ fontSize: 10, color: '#706862', marginTop: 3 }}>{i.desc}</Text>
          </View>
          <Text>{v === i.key ? '✓' : '○'}</Text>
        </Choice>
      ))}
      <Btn label={t('screens.obIntent.prodolzhit')} onPress={() => save({ intent: v })} busy={busy} />
    </Screen>
  );
}
