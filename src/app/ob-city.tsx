import { useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { Bold, Btn, Card, Eyebrow, Field, Screen, Tiny, useToast } from '@/components/ui';
import { useDraft } from '@/hooks/useDraft';
import { OnbHeader, useStepSave } from '@/components/Onboarding';
import { CountryPicker } from '@/components/CountryPicker';
import { CITIES, COUNTRY_NAME } from '@/lib/catalog';
import { useSession } from '@/lib/session';

// 14 · Страна и город
export default function ObCity() {
  const { profile } = useSession();
  const toast = useToast();
  const [country, setCountry] = useDraft<string>(profile?.country ?? 'SK');
  const [city, setCity] = useDraft<string>(profile?.city ?? 'Bratislava');
  const { save, busy } = useStepSave('ob-city');
  const list = useMemo(() => CITIES[country] ?? [], [country]);
  const match = list.find(([n]) => n.toLowerCase() === city.trim().toLowerCase());
  const suggestions = useMemo(
    () => (city.trim() && !match ? list.filter(([n]) => n.toLowerCase().startsWith(city.trim().toLowerCase())).slice(0, 5) : []),
    [city, list, match],
  );
  return (
    <Screen>
      <OnbHeader step={4} kicker="ВАШ ГОРОД" heading="Где вас искать?" sub="Для старта выберите страну и город вручную. Точные координаты не нужны." />
      <CountryPicker value={country} onChange={(c) => { setCountry(c); setCity(''); }} />
      <Eyebrow style={{ marginTop: 10 }}>ГОРОД</Eyebrow>
      <Field value={city} onChangeText={setCity} placeholder="Начните вводить город" />
      {suggestions.map(([n, r]) => (
        <Pressable key={n} accessibilityRole="button" onPress={() => setCity(n)} style={{ paddingVertical: 8 }}>
          <Text style={{ fontSize: 12 }}>{n} <Text style={{ color: '#8f8c84' }}>· {r}</Text></Text>
        </Pressable>
      ))}
      {match ? (
        <Card tight><Bold>{match[0]}</Bold><Tiny>{match[1]} · {COUNTRY_NAME[country]}</Tiny></Card>
      ) : null}
      <Tiny>В макете открыт весь ЕС; доступность географии зависит от запуска сервиса в конкретной стране.</Tiny>
      <Btn label="Продолжить" busy={busy} onPress={() => (match ? save({ country, city: match[0] }) : toast('Выберите город из списка'))} />
    </Screen>
  );
}
