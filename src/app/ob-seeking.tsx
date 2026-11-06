import { Text } from 'react-native';
import { Btn, CheckRow, Screen, Tiny, useToast } from '@/components/ui';
import { BigOption } from '@/components/Kit';
import type { IconName } from '@/components/UiIcon';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

const ORDER = ['women', 'men', 'everyone'] as const;
const TITLE = { women: 'onbx.seeking.women', men: 'onbx.seeking.men', everyone: 'onbx.seeking.all' } as const;
const ICON: Record<string, IconName> = { women: 'profile', men: 'profile', everyone: 'people' };

// 12 · Кого показывать в свиданиях · согласие
export default function ObSeeking() {
  const { t } = useLang();
  const { profile } = useSession();
  const toast = useToast();
  const [v, setV] = useDraft<string>(profile?.seeking ?? 'men');
  const [consent, setConsent] = useDraft(Boolean(profile?.sensitive_consent_at));
  const { save, busy } = useStepSave('ob-seeking');
  return (
    <Screen>
      <OnbHeader step={4} kicker={t('onbx.seeking.kicker')} heading={t('onbx.seeking.h')} sub={t('onbx.seeking.sub')} />
      {ORDER.map((k) => (
        <BigOption key={k} on={v === k} icon={ICON[k]} title={t(TITLE[k])} onPress={() => setV(k)} />
      ))}
      <CheckRow left on={consent} onPress={() => setConsent(!consent)}>
        <Text style={{ fontSize: 13.5, fontWeight: '700' }}>{t('screens.obSeeking.consent')}</Text>
        <Tiny>{t('screens.obSeeking.consentNote')}</Tiny>
      </CheckRow>
      <Btn label={t('screens.obSeeking.continue')} busy={busy} onPress={() => (consent ? save({ seeking: v, sensitive_consent: true }) : toast(t('screens.obSeeking.consentRequired')))} />
    </Screen>
  );
}
