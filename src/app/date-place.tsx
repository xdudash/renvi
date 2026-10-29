import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BackLink, Btn, Choice, Field, Screen, Title, useToast } from '@/components/ui';
import { getDateDraft, setDateDraft } from '@/lib/dateDraft';
import { DATE_PLACES } from '@/lib/catalog';
import { useLang } from '@/lib/lang';

// 56 · Выбрать место
export default function DatePlace() {
  const { t } = useLang();
  const { match } = useLocalSearchParams<{ match: string }>();
  const toast = useToast();
  const [place, setPlace] = useState(getDateDraft().place);
  const [custom, setCustom] = useState(getDateDraft().custom);
  const [q, setQ] = useState('');
  // Names and districts in the selected language (the catalog's `name` / `sub` fields are the Russian originals).
  const label = useCallback((p: (typeof DATE_PLACES)[number]) => ({ name: 'nameKey' in p ? t(p.nameKey) : p.name, sub: t(p.subKey) }), [t]);
  const list = useMemo(() => DATE_PLACES.filter((p) => {
    if (p.key === 'custom' || !q.trim()) return true;
    const l = label(p);
    return `${l.name} ${l.sub}`.toLowerCase().includes(q.trim().toLowerCase());
  }), [q, label]);
  const next = () => {
    if (place === 'custom' && (custom.trim().length < 2 || custom.trim().length > 60)) { toast(t('screens.datePlace.ukazhitePublichnoeMesto2')); return; }
    setDateDraft({ place, custom: custom.trim() });
    router.push({ pathname: '/date-time', params: { match } });
  };
  return (
    <Screen tabs="chats">
      <BackLink />
      <Title kicker={t('screens.datePlace.mesto')} heading={t('screens.datePlace.vyberiteMestoVstrechi')} sub={t('screens.datePlace.pokazyvaemObschestvennyeMe')} />
      <Field value={q} onChangeText={setQ} placeholder={t('screens.datePlace.poiskPoMestuIli')} accessibilityLabel={t('screens.datePlace.poiskPoMestuIli')} />
      {list.map((p) => (
        <Choice key={p.key} selected={place === p.key} onPress={() => setPlace(p.key)}>
          <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
            <Text>{p.icon}</Text>
            <View><Text style={{ fontSize: 12, fontWeight: '700' }}>{label(p).name}</Text><Text style={{ fontSize: 10, color: '#706862', marginTop: 3 }}>{label(p).sub}</Text></View>
          </View>
          <Text>{place === p.key ? '✓' : '›'}</Text>
        </Choice>
      ))}
      {place === 'custom' ? <Field value={custom} onChangeText={setCustom} maxLength={60} placeholder={t('screens.datePlace.publichnoeMestoIRayon')} /> : null}
      <Btn label={t('screens.datePlace.vybratMesto')} onPress={next} />
    </Screen>
  );
}
