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

const ALL = INTENTS.map((i) => i.key as string);

// 29 · Фильтры
export default function Filters() {
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
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 18 || b > 99 || a > b) { toast('Возраст: от 18 до 99, «от» не больше «до»'); return; }
    if (!intents.length) { toast('Выберите хотя бы одно намерение'); return; }
    setBusy(true);
    try {
      if (country !== profile?.country) await api.saveOnboarding({ country });
      await api.saveFilters({ ageMin: a, ageMax: b, distance, verifiedOnly: paid && verifiedOnly, intents });
      await refresh();
      await d.load();
      toast('Параметры применены');
      router.navigate('/discover');
    } catch { toast('Не удалось сохранить фильтры'); } finally { setBusy(false); }
  };
  const reset = () => {
    setAgeMin('18'); setAgeMax('99'); setDistance(100); setVerifiedOnly(false); setIntents(ALL);
    toast('Фильтры сброшены');
  };

  return (
    <Screen>
      <BackLink />
      <Title kicker="НАСТРОИТЬ ПОДБОР" heading="Ваши фильтры" sub="Подбор учитывает взаимные предпочтения. Возраст и страна ограничены настройками сервиса." />
      <Eyebrow>СТРАНА · ЕС</Eyebrow>
      <CountryPicker value={country} onChange={setCountry} />
      <Eyebrow style={{ marginTop: 10 }}>ВОЗРАСТ</Eyebrow>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={{ flex: 1 }}><Field value={ageMin} onChangeText={setAgeMin} keyboardType="number-pad" maxLength={2} accessibilityLabel="Возраст от" /></View>
        <Text>—</Text>
        <View style={{ flex: 1 }}><Field value={ageMax} onChangeText={setAgeMax} keyboardType="number-pad" maxLength={2} accessibilityLabel="Возраст до" /></View>
      </View>
      <Eyebrow>РАССТОЯНИЕ</Eyebrow>
      <Slider minimumValue={5} maximumValue={100} step={5} value={distance} onValueChange={setDistance} minimumTrackTintColor={colors.red} maximumTrackTintColor="#ece9e2" thumbTintColor={colors.red} accessibilityLabel="Расстояние" />
      <Between><Tiny>До {distance} км</Tiny><Tiny>Возраст ограничен правилами подбора</Tiny></Between>
      <Tiny>Расстояние округляется; точные координаты не показываются.</Tiny>
      <CheckRow disabled={!paid} on={paid && verifiedOnly} onPress={() => setVerifiedOnly(!verifiedOnly)}>
        <Text style={{ fontSize: 12, color: paid ? colors.ink : '#aaa' }}>Показывать только фото-проверенные профили</Text>
      </CheckRow>
      {!paid ? (
        <View style={{ backgroundColor: colors.redWash, borderRadius: 16, padding: 13 }}>
          <Bold>Расширенные фильтры — RENVI Plus</Bold>
          <Tiny>Входящие искры, фильтр проверенных анкет и больше контроля.</Tiny>
          <LinkBtn label="Посмотреть Plus →" onPress={() => router.push('/plans')} />
        </View>
      ) : null}
      <Eyebrow style={{ marginTop: 12 }}>НАМЕРЕНИЕ</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {INTENTS.map((i) => (
          <Pill key={i.key} label={i.filter} active={intents.includes(i.key)} onPress={() => setIntents(intents.includes(i.key) ? intents.filter((x) => x !== i.key) : [...intents, i.key])} />
        ))}
      </View>
      <Btn label="Показать подходящих людей" busy={busy} onPress={apply} />
      <Btn kind="ghost" label="Сбросить" onPress={reset} />
    </Screen>
  );
}
