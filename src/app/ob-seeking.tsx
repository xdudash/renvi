import { Text } from 'react-native';
import { Btn, Card, CheckRow, Choice, Screen, Tiny, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { SEEKING } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

// 12 · Кого ищу · согласие
export default function ObSeeking() {
  const { t } = useLang();
  const { profile } = useSession();
  const toast = useToast();
  const [v, setV] = useDraft<string>(profile?.seeking ?? 'men');
  const [consent, setConsent] = useDraft(Boolean(profile?.sensitive_consent_at));
  const { save, busy } = useStepSave('ob-seeking');
  return (
    <Screen>
      <OnbHeader step={2} kicker={t('screens.obSeeking.kicker')} heading={t('screens.obSeeking.heading')} sub={t('screens.obSeeking.sub')} />
      {SEEKING.map((g) => (
        <Choice key={g.key} selected={v === g.key} onPress={() => setV(g.key)}>
          <Text style={{ fontSize: 12 }}>{t(g.labelKey)}</Text><Text>{v === g.key ? '✓' : '○'}</Text>
        </Choice>
      ))}
      <Card>
        <CheckRow left on={consent} onPress={() => setConsent(!consent)}>
          <Text style={{ fontSize: 12 }}>{t('screens.obSeeking.consent')}</Text>
        </CheckRow>
        <Tiny>{t('screens.obSeeking.consentNote')}</Tiny>
      </Card>
      <Btn label={t('screens.obSeeking.continue')} busy={busy} onPress={() => (consent ? save({ seeking: v, sensitive_consent: true }) : toast(t('screens.obSeeking.consentRequired')))} />
    </Screen>
  );
}
