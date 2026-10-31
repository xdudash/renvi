import { useState } from 'react';
import { Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { BackLink, Between, Btn, CheckRow, Eyebrow, Field, Pill, Screen, Tiny, Title, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { CountryPicker } from '@/components/CountryPicker';
import { api } from '@/lib/api';
import { useDiscover } from '@/lib/discover';
import { useSession } from '@/lib/session';
import { INTENTS } from '@/lib/catalog';
import { DETAIL_OPTIONS, LANGUAGES, MAX_LANGUAGES, detailTitle, detailValue, languageLabel } from '@/lib/details';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

const ALL = INTENTS.map((i) => i.key as string);

// 29 · Фильтры
export default function Filters() {
  const { t } = useLang();
  const toast = useToast();
  const { profile, refresh } = useSession();
  const d = useDiscover();
  const [country, setCountry] = useDraft<string>(profile?.country ?? 'SK');
  const [ageMin, setAgeMin] = useDraft(String(profile?.filter_age_min ?? 22));
  const [ageMax, setAgeMax] = useDraft(String(profile?.filter_age_max ?? 32));
  const [distance, setDistance] = useDraft<number>(profile?.filter_distance_km ?? 25);
  const [verifiedOnly, setVerifiedOnly] = useDraft<boolean>(Boolean(profile?.filter_verified_only));
  const [intents, setIntents] = useDraft<string[]>(profile?.filter_intents ?? ALL);
  const [heightMin, setHeightMin] = useDraft(profile?.filter_height_min ? String(profile.filter_height_min) : '');
  const [heightMax, setHeightMax] = useDraft(profile?.filter_height_max ? String(profile.filter_height_max) : '');
  const [kids, setKids] = useDraft<string[]>(profile?.filter_kids ?? []);
  const [smoking, setSmoking] = useDraft<string[]>(profile?.filter_smoking ?? []);
  const [languages, setLanguages] = useDraft<string[]>(profile?.filter_languages ?? []);
  const [busy, setBusy] = useState(false);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const apply = async () => {
    const a = Number(ageMin), b = Number(ageMax);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 18 || b > 99 || a > b) { toast(t('screens.filters.vozrastOt18Do')); return; }
    if (!intents.length) { toast(t('screens.filters.vyberiteHotyaByOdno')); return; }
    const hMin = heightMin.trim() === '' ? null : Number(heightMin), hMax = heightMax.trim() === '' ? null : Number(heightMax);
    const badHeight = (h: number | null) => h !== null && (!Number.isInteger(h) || h < 120 || h > 230);
    if (badHeight(hMin) || badHeight(hMax) || (hMin !== null && hMax !== null && hMin > hMax)) { toast(t('details.filterHeightBad')); return; }
    setBusy(true);
    try {
      if (country !== profile?.country) await api.saveOnboarding({ country });
      await api.saveFilters({ ageMin: a, ageMax: b, distance, verifiedOnly, intents });
      try {
        await api.saveFilterDetails({ heightMin: hMin, heightMax: hMax, kids, smoking, languages });
      } catch { toast(t('details.filterFailed')); }
      await refresh();
      await d.load();
      toast(t('screens.filters.parametryPrimeneny'));
      router.navigate('/discover');
    } catch { toast(t('screens.filters.neUdalosSohranitFiltry')); } finally { setBusy(false); }
  };
  const reset = () => {
    setAgeMin('18'); setAgeMax('99'); setDistance(100); setVerifiedOnly(false); setIntents(ALL);
    setHeightMin(''); setHeightMax(''); setKids([]); setSmoking([]); setLanguages([]);
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
      <CheckRow on={verifiedOnly} onPress={() => setVerifiedOnly(!verifiedOnly)}>
        <Text style={{ fontSize: 12, color: colors.ink }}>{t('screens.filters.pokazyvatTolkoFotoProveren')}</Text>
      </CheckRow>
      <Eyebrow style={{ marginTop: 12 }}>{t('screens.filters.namerenie')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {INTENTS.map((i) => (
          <Pill key={i.key} label={t(i.filterKey)} active={intents.includes(i.key)} onPress={() => setIntents(intents.includes(i.key) ? intents.filter((x) => x !== i.key) : [...intents, i.key])} />
        ))}
      </View>
      <Eyebrow style={{ marginTop: 12 }}>{t('details.filterHeading')}</Eyebrow>
      <Tiny>{t('details.filterKeepUnset')}</Tiny>
      <Eyebrow>{t('details.filterHeight')}</Eyebrow>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={{ flex: 1 }}><Field value={heightMin} onChangeText={setHeightMin} keyboardType="number-pad" maxLength={3} accessibilityLabel={t('details.filterHeightFrom')} /></View>
        <Text>—</Text>
        <View style={{ flex: 1 }}><Field value={heightMax} onChangeText={setHeightMax} keyboardType="number-pad" maxLength={3} accessibilityLabel={t('details.filterHeightTo')} /></View>
      </View>
      <Eyebrow>{detailTitle(t, 'kids')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {DETAIL_OPTIONS.kids.map((v) => <Pill key={v} label={detailValue(t, 'kids', v)} active={kids.includes(v)} onPress={() => setKids(toggle(kids, v))} />)}
      </View>
      <Eyebrow>{detailTitle(t, 'smoking')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {DETAIL_OPTIONS.smoking.map((v) => <Pill key={v} label={detailValue(t, 'smoking', v)} active={smoking.includes(v)} onPress={() => setSmoking(toggle(smoking, v))} />)}
      </View>
      <Eyebrow>{detailTitle(t, 'languages')}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {LANGUAGES.map((c) => (
          <Pill key={c} label={languageLabel(t, c)} active={languages.includes(c)}
            onPress={() => { if (!languages.includes(c) && languages.length >= MAX_LANGUAGES) { toast(t('details.filterLanguagesMax')); return; } setLanguages(toggle(languages, c)); }} />
        ))}
      </View>
      <Btn label={t('screens.filters.pokazatPodhodyaschihLyudey')} busy={busy} onPress={apply} />
      <Btn kind="ghost" label={t('screens.filters.sbrosit')} onPress={reset} />
    </Screen>
  );
}
