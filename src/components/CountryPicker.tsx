import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Choice, Sheet, Tiny } from './ui';
import { AVAILABLE_COUNTRIES, COUNTRIES } from '@/lib/catalog';
import { colors } from '@/theme/tokens';

export function CountryPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const cur = COUNTRIES.find((c) => c[0] === value) ?? COUNTRIES[0];
  const suffix = (c: string) => (AVAILABLE_COUNTRIES.includes(c) ? ' · доступно сейчас' : ' · направление расширения');
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Страна ЕС"
        onPress={() => setOpen(true)}
        style={{ borderWidth: 1, borderColor: '#e4e0d8', borderRadius: 13, backgroundColor: colors.white, padding: 12, minHeight: 45, marginVertical: 5, flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <Text style={{ fontSize: 13 }}>{cur[1]}{'　'}{cur[2]}{suffix(cur[0])}</Text>
        <Text>⌄</Text>
      </Pressable>
      <Tiny>Показываем масштаб рынка ЕС; подключение стран помимо SK/CZ потребует расширения каталога локаций и серверной доступности.</Tiny>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 420 }}>
          {COUNTRIES.map(([c, f, n]) => {
            const ok = AVAILABLE_COUNTRIES.includes(c);
            return (
              <Choice key={c} selected={c === value} disabled={!ok} onPress={() => { onChange(c); setOpen(false); }}>
                <Text style={{ fontSize: 12, color: ok ? colors.ink : '#aaa' }}>{f}{'　'}{n}{suffix(c)}</Text>
                <Text>{c === value ? '✓' : ''}</Text>
              </Choice>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}
