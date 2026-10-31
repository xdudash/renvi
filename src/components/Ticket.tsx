import { StyleSheet, Text, View } from 'react-native';
import { BrandMark } from './BrandMark';
import { Chip } from './ui';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

export function Ticket({ place, day, time, status, tone }: { place: string; day: string; time: string; status: string; tone: 'amber' | 'green' | 'plain' }) {
  const { t } = useLang();
  return (
    <View style={s.ticket}>
      <BrandMark size={34} />
      <Text style={s.title}>{t('components.Ticket.title')}</Text>
      <Text style={s.meta}>{place}</Text>
      <View style={s.line} />
      <View style={s.between}><Text style={s.b}>{day}</Text><Text style={s.b}>{time}</Text></View>
      <View style={{ marginTop: 14, flexDirection: 'row' }}><Chip label={status} tone={tone} /></View>
      <View style={[s.notch, { left: -11 }]} />
      <View style={[s.notch, { right: -11 }]} />
    </View>
  );
}
const s = StyleSheet.create({
  ticket: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, paddingVertical: 23, paddingHorizontal: 19, marginVertical: 15, borderRadius: 4, position: 'relative' },
  title: { fontSize: 27, fontWeight: '800', lineHeight: 29, letterSpacing: -1.2, marginTop: 15, marginBottom: 11, color: colors.ink },
  meta: { fontSize: 12, color: colors.sub },
  line: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#CFC7BF', marginTop: 19, marginBottom: 15 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  b: { fontWeight: '700', fontSize: 13, color: colors.ink },
  notch: { position: 'absolute', top: '53%', width: 20, height: 20, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
});
