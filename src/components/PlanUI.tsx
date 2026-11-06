import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { UiIcon } from '@/components/UiIcon';
import { Tag } from '@/components/ui';
import { categoryOf, formatWhen, type Plan } from '@/lib/plans';
import { useLang } from '@/lib/lang';
import { colors } from '@/theme/tokens';

// Pieces of the plan screens (.x-plan, .x-cover, .x-faces, .x-fab, .x-dayhead in the prototype).

/** Round initials used where the prototype shows small portraits of participants. */
export function Faces({ names, size = 26 }: { names: string[]; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {names.slice(0, 3).map((n, i) => (
        <View key={i} style={[s.face, { width: size, height: size, borderRadius: size / 2, marginLeft: i ? -7 : 0 }]}>
          <Text style={s.faceText}>{n.slice(0, 1).toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

/** Coloured band with the category and the start time. */
export function PlanCover({ plan, height = 58, children }: { plan: Pick<Plan, 'category' | 'starts_at'>; height?: number; children?: React.ReactNode }) {
  const { t } = useLang();
  const c = categoryOf(plan.category);
  return (
    <View style={[s.cover, { backgroundColor: c.tint, height }]}>
      <View style={s.catRow}>
        <UiIcon name={c.icon} size={17} color={c.ink} />
        <Text style={[s.cat, { color: c.ink }]}>{t(c.label).toUpperCase()}</Text>
      </View>
      <View style={s.when}><Text style={s.whenText}>{formatWhen(plan.starts_at)}</Text></View>
      {children}
    </View>
  );
}

export function PlanCard({ plan, onPress, style }: { plan: Plan; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { t } = useLang();
  const left = Math.max(0, plan.max_people - plan.going);
  const seats = plan.my_status === 'pending' ? t('plans.card.requested') : plan.my_status === 'going' || plan.my_status === 'host' ? t('plans.card.going') : t('plans.card.seatsLeft', { n: left });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={plan.title} onPress={onPress ?? (() => router.push({ pathname: '/plan', params: { id: plan.id } }))} style={[s.card, style]}>
      <PlanCover plan={plan} />
      <View style={{ padding: 13 }}>
        <Text style={s.title}>{plan.title}</Text>
        {plan.audience !== 'all' ? <View style={{ marginTop: 6, flexDirection: 'row' }}><Tag tone={plan.audience === 'couples' ? 'amber' : plan.audience === 'women' ? 'pink' : 'blue'} label={t(`plans.aud.${plan.audience}` as 'plans.aud.women')} /></View> : null}
        <Text style={s.meta}>{plan.area}{plan.price_text ? ` · ${plan.price_text}` : ''}</Text>
        <View style={s.foot}>
          <Faces names={[plan.host.name, ...plan.faces.map((f) => f.name)]} />
          <Text style={s.going}>{t('plans.card.goingOf', { going: plan.going, max: plan.max_people })}</Text>
          <Text style={[s.seats, plan.my_status === 'going' || plan.my_status === 'host' ? { color: colors.green } : null]}>{seats}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** "Свой план" floating button. */
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.fab}>
      <UiIcon name="plus" size={16} color="#fff" />
      <Text style={s.fabText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  face: { backgroundColor: colors.blush, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  faceText: { fontSize: 10, fontWeight: '800', color: colors.ink },
  cover: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  cat: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  when: { backgroundColor: '#fff', borderRadius: 99, paddingVertical: 5, paddingHorizontal: 9 },
  whenText: { fontSize: 10.5, fontWeight: '800', color: colors.ink },
  card: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 20, overflow: 'hidden', marginVertical: 10 },
  title: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.3, color: colors.ink, lineHeight: 19 },
  meta: { fontSize: 11, color: colors.sub, marginTop: 4 },
  foot: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  going: { flex: 1, fontSize: 10.5, color: colors.sub, marginLeft: 8 },
  seats: { fontSize: 11, fontWeight: '800', color: colors.redDark },
  fab: { alignSelf: 'flex-end', marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.red, borderRadius: 99, paddingVertical: 13, paddingHorizontal: 18,
    shadowColor: '#DA302B', shadowOpacity: 0.27, shadowRadius: 11, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
