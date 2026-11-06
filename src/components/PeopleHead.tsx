import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Tappable } from '@/components/Kit';
import { UiIcon } from '@/components/UiIcon';
import { useIncomingCount } from '@/components/ui';
import { useModes } from '@/hooks/useModes';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

export type PeopleMode = 'discover' | 'company' | 'couples';

/** Header of the «Люди» tab: title, incoming sparks, filters and the Свидания / Компания / Пары switch (.x-modes). */
export function PeopleHead({ active, extra }: { active: PeopleMode; extra?: React.ReactNode }) {
  const { t } = useLang();
  const incoming = useIncomingCount();
  const { modes, reload } = useModes();
  useReloadOnFocus(reload);
  const isCouple = modes?.status === 'couple';
  const items: { key: PeopleMode; label: string; ok: boolean; href: string }[] = [
    { key: 'discover', label: t('people.mode.dating'), ok: modes ? modes.dating_open : true, href: '/discover' },
    { key: 'company', label: t('people.mode.company'), ok: modes ? !isCouple : true, href: '/company' },
    { key: 'couples', label: t('people.mode.couples'), ok: modes ? isCouple : true, href: '/couples' },
  ];
  return (
    <View>
      <View style={s.head}>
        <Text style={s.hello}>{t('people.h')}</Text>
        <View style={s.right}>
          <Tappable onPress={() => router.push('/likes')} label={t('modes.incoming')} style={s.incoming}>
            <UiIcon name="spark" size={13} color={colors.redDark} />
            <Text style={s.incomingText}>{incoming > 0 ? t('modes.incomingN', { n: incoming }) : t('modes.incoming')}</Text>
          </Tappable>
          {extra}
          <Tappable onPress={() => router.push('/filters')} label={t('people.filters')} style={s.iconBtn}><UiIcon name="filter" size={17} /></Tappable>
        </View>
      </View>
      <View style={s.modes} accessibilityRole="tablist">
        {items.map((m) => (
          <Pressable key={m.key} accessibilityRole="tab" accessibilityState={{ selected: active === m.key }} onPress={() => {
            if (active === m.key) return;
            if (m.ok) router.replace(m.href as never);
            else router.push({ pathname: '/people-locked', params: { mode: m.key === 'couples' ? 'couples' : 'dating' } });
          }} style={[s.mode, active === m.key && s.modeOn]}>
            {m.ok ? null : <UiIcon name="lock" size={12} color={colors.sub} />}
            <Text style={[s.modeText, active === m.key && { color: colors.ink, fontWeight: '800' }, !m.ok && { color: colors.sub }]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 10 },
  hello: { fontSize: 22, fontWeight: '800', letterSpacing: -0.9, color: colors.ink, lineHeight: 24, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  incoming: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.chipBorder, backgroundColor: colors.redWash, borderRadius: 99, paddingHorizontal: 10, minHeight: 34 },
  incomingText: { fontSize: 11, fontWeight: '700', color: colors.redDark },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  modes: { flexDirection: 'row', backgroundColor: '#eeece6', padding: 4, borderRadius: 12, gap: 3, marginBottom: 6 },
  mode: { flex: 1, minHeight: 36, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  modeOn: { backgroundColor: colors.white },
  modeText: { fontSize: 12, fontWeight: '600', color: '#5E5852' },
});
