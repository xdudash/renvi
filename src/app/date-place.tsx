import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Choice, Field, Screen, Title, useToast } from '@/components/ui';
import { getDateDraft, setDateDraft } from '@/lib/dateDraft';
import { DATE_PLACES } from '@/lib/catalog';

// 56 · Выбрать место
export default function DatePlace() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const toast = useToast();
  const [place, setPlace] = useState(getDateDraft().place);
  const [custom, setCustom] = useState(getDateDraft().custom);
  const [q, setQ] = useState('');
  const list = useMemo(() => DATE_PLACES.filter((p) => p.key === 'custom' || !q.trim() || `${p.name} ${p.sub}`.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  const next = () => {
    if (place === 'custom' && (custom.trim().length < 2 || custom.trim().length > 60)) { toast('Укажите публичное место: 2–60 символов'); return; }
    setDateDraft({ place, custom: custom.trim() });
    router.push({ pathname: '/date-time', params: { match } });
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker="МЕСТО" heading="Выберите место встречи" sub="Показываем общественные места в выбранном городе." />
      <Field value={q} onChangeText={setQ} placeholder="Поиск по месту или району" accessibilityLabel="Поиск по месту или району" />
      {list.map((p) => (
        <Choice key={p.key} selected={place === p.key} onPress={() => setPlace(p.key)}>
          <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
            <Text>{p.icon}</Text>
            <View><Text style={{ fontSize: 12, fontWeight: '700' }}>{p.name}</Text><Text style={{ fontSize: 10, color: '#706862', marginTop: 3 }}>{p.sub}</Text></View>
          </View>
          <Text>{place === p.key ? '✓' : '›'}</Text>
        </Choice>
      ))}
      {place === 'custom' ? <Field value={custom} onChangeText={setCustom} maxLength={60} placeholder="Публичное место и район" /> : null}
      <Btn label="Выбрать место" onPress={next} />
    </Screen>
  );
}
