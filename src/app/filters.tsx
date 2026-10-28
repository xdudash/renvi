import { useState } from 'react';
import { Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { BackLink, Between, Bold, Btn, CheckRow, Eyebrow, Field, LinkBtn, Pill, Screen, Tiny, Title, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { CountryPicker } from '@/components/CountryPicker';
import { api } from '@/lib/api';
import { useDiscover } from '@/lib/discover';
import { useSession } from '@/lib/session';
import { INTENTS } from '@/lib/catalog';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const ALL = INTENTS.map((i) => i.key as string);

// 29 · Фильтры
export default function Filters() {
  const { t } = useLang();
  const toast = useToast();
  const { profile, tier, refresh } = useSession();
  const d = useDiscover();
  const [country, setCountry] = useDraft<string>(profile?.country ?? 'SK');
  const [ageMin, setAgeMin] = useDraft(String(profile?.filter_age_min ?? 22));
  const [ageMax, setAgeMax] = useDraft(String(profile?.filter_age_max ?? 32));
  const [distance, setDistance] = useDraft<number>(profile?.filter_distance_km ?? 25);
  const [verifiedOnly, setVerifiedOnly] = useDraft<boolean>(Boolean(profile?.filter_verified_only));
  const [intents, setIntents] = useDraft<string[]>(profile?.filter_intents ?? ALL);
  const [busy, setBusy] = useState(false);
  const paid = tier !== 'free';

  const apply = async () => {
    const a = Number(ageMin), b = Number(ageMax);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 18 || b > 99 || a > b) { toast(t('screens.filters.vozrastOt18Do')); return; }
    if (!intents.length) { toast(t('screens.filters.vyberiteHotyaByOdno')); return; }
    setBusy(true);
    try {
      if (country !== profile?.country) await api.saveOnboarding({ country });
      await api.saveFilters({ ageMin: a, ageMax: b, distance, verifiedOnly: paid && verifiedOnly, intents });
      await refresh();
      await d.load();
      toast(t('screens.filters.parametryPrimeneny'));
      router.navigate('/discover');
    } catch { toast(t('screens.filters.neUdalosSohranitFiltry')); } finally { setBusy(false); }
  };
  const reset = () => {
    setAgeMin('18'); setAgeMax('99'); setDistance(100); setVerifiedOnly(false); setIntents(ALL);
    toast(t('screens.filters.filtrySbrosheny'));
  };

  return (
    <Screen>
      <BackLink />
      <Title kicker={t('screens.filters.nastroitPodbor')} heading={t('screens.filters.vashiFiltry')} sub={t('screens.filters.podborUchityvaetVzaimnyePr')} />
      <Eyebrow>{t('screens.filters.stranaEs')}</Eyebrow>
      <CountryPicker value={country} onChange={setCountry} />
      <Eyebrow style={{ marginTop: 10 }}>{t('screens.filters.vozrast')}</Eyebrow>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={{ flex: 1 }}><Field value={ageMin} onChangeText={setAgeMin} keyboardType="number-pad" maxLength={2} accessibilityLabel={t('screens.filters.vozrastOt')} /></View>
        <Text>—</Text>
        <View style={{ flex: 1 }}><Field value={ageMax} onChangeText={setAgeMax} keyboardType="number-pad" maxLength={2} accessibilityLabel={t('screens.filters.vozrastDo')} /></View>
      </View>
      <Eyebrow>{t('screens.filters.rasstoyanie')}</Eyebrow>
      <Slider minimumValue={5} maximumValue={100} step={5} value={distance} onValueChange={setDistance} minimumTrackTintColor={colors.red} maximumTrackTintColor="#ece9e2" thumbTintColor={colors.red} accessibilityLabel={t('screens.filters.rasstoyanie2')} />
      <Between><Tiny>{t('screens.filters.doDistanceKm', { distance })}</Tiny><Tiny>{t('screens.filters.vozrastOgranichenPravilami')}</Tiny></Between>
      <Tiny>{t('screens.filters.rasstoyanieOkruglyaetsyaTo')}</Tiny>
      <CheckRow disabled={!paid} on={paid && verifiedOnly} onPress={() => setVerifiedOnly(!verifiedOnly)}>
        <Text style={{ fontSize: 12, color: paid ? colors.ink : '#aaa' }}>{t('screens.filters.pokazyvatTolkoFotoProveren')}</Text>
      </CheckRow>
      {!paid ? (
        <View style={{ backgroundColor: colors.redWash, borderRadius: 16, padding: 13 }}>
          <Bold>{t('screens.filters.rasshirennyeFiltryRenviPlu')}</Bold>
          <Tiny>{t('screens.filters.vhodyaschieIskryFiltrProve')}</Tiny>
          <LinkBtn label={t('screens.filters.posmotretPlus')} onPress={() => router.push('/plans')} />
        </View>
      ) : null}
      <Eyebrow style={{ marginTop: 12 }}>{t('screens.filters.namerenie')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {INTENTS.map((i) => (
          <Pill key={i.key} label={i.filter} active={intents.includes(i.key)} onPress={() => setIntents(intents.includes(i.key) ? intents.filter((x) => x !== i.key) : [...intents, i.key])} />
        ))}
      </View>
      <Btn label={t('screens.filters.pokazatPodhodyaschihLyudey')} busy={busy} onPress={apply} />
      <Btn kind="ghost" label={t('screens.filters.sbrosit')} onPress={reset} />
    </Screen>
  );
}
