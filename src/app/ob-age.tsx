import { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn, CheckRow, Field, SafeBanner, Screen, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/lang';

const isoOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// 10 · Возраст и имя
export default function ObAge() {
  const { t } = useLang();
  const { profile } = useSession();
  const toast = useToast();
  const [name, setName] = useDraft<string>(profile?.display_name ?? '');
  const [birthdate, setBirthdate] = useState('');
  const [adult, setAdult] = useDraft(Boolean(profile?.adult_confirmed_at));
  const [terms, setTerms] = useDraft(Boolean(profile?.terms_accepted_at));
  const { save, busy, saveDraftAndExit } = useStepSave('ob-age');
  const next = () => {
    if (!adult || !terms) { toast(t('screens.obAge.podtverditeVozrastIUsloviy')); return; }
    if (name.trim().length < 1) { toast(t('screens.obAge.vvediteImya')); return; }
    if (!isoOk(birthdate)) { toast(t('screens.obAge.ukazhiteDatuRozhdeniyaV')); return; }
    save({ display_name: name.trim(), birthdate, adult_confirmed: true, terms_accepted: true });
  };
  return (
    <Screen>
      <OnbHeader step={0} kicker={t('screens.obAge.pervyyShag')} heading={t('screens.obAge.skolkoVamLet')} sub={t('screens.obAge.uchastnikamRenviDolzhnoByt')} />
      <Field label={t('screens.obAge.imya')} value={name} onChangeText={setName} placeholder={t('screens.obAge.kakVasNazyvat')} autoComplete="given-name" />
      <Field label={t('screens.obAge.dataRozhdeniya')} value={birthdate} onChangeText={setBirthdate} placeholder="1998-08-12" keyboardType="numbers-and-punctuation" maxLength={10} />
      <CheckRow left on={adult} onPress={() => setAdult(!adult)}><Text style={{ fontSize: 12 }}>{t('screens.obAge.mneUzheIspolnilos18')}</Text></CheckRow>
      <CheckRow left on={terms} onPress={() => setTerms(!terms)}><Text style={{ fontSize: 12 }}>{t('screens.obAge.yaPrinimayuUsloviyaI')}</Text></CheckRow>
      <SafeBanner>{t('screens.obAge.dataRozhdeniyaNeBudet')}</SafeBanner>
      <Btn label={t('screens.obAge.prodolzhit')} onPress={next} busy={busy} />
      <View><Btn kind="ghost" label={t('screens.obAge.sohranitChernovikIVyyti')} onPress={() => saveDraftAndExit(name.trim() ? { display_name: name.trim() } : {})} /></View>
    </Screen>
  );
}
