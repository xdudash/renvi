import { Text } from 'react-native';
import { Btn, Card, CheckRow, Choice, Screen, Tiny, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { SEEKING } from '@/lib/catalog';
import { useSession } from '@/lib/session';

// 12 · Кого ищу · согласие
export default function ObSeeking() {
  const { profile } = useSession();
  const toast = useToast();
  const [v, setV] = useDraft<string>(profile?.seeking ?? 'men');
  const [consent, setConsent] = useDraft(Boolean(profile?.sensitive_consent_at));
  const { save, busy } = useStepSave('ob-seeking');
  return (
    <Screen>
      <OnbHeader step={2} kicker="ВАЖНО ДЛЯ ПОДБОРА" heading="Кого вы хотите встретить?" sub="Эти настройки нужны для подбора. Они не показываются в открытой анкете." />
      {SEEKING.map((g) => (
        <Choice key={g.key} selected={v === g.key} onPress={() => setV(g.key)}>
          <Text style={{ fontSize: 12 }}>{g.label}</Text><Text>{v === g.key ? '✓' : '○'}</Text>
        </Choice>
      ))}
      <Card>
        <CheckRow left on={consent} onPress={() => setConsent(!consent)}>
          <Text style={{ fontSize: 12 }}>Я даю отдельное согласие на обработку чувствительных предпочтений для подбора</Text>
        </CheckRow>
        <Tiny>Отдельное согласие можно отозвать в настройках. Подробности — в Политике приватности.</Tiny>
      </Card>
      <Btn label="Продолжить" busy={busy} onPress={() => (consent ? save({ seeking: v, sensitive_consent: true }) : toast('Нужно отдельное согласие для подбора'))} />
    </Screen>
  );
}
