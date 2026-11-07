import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { UiIcon, type IconName } from '@/components/UiIcon';
import { usePressScale } from '@/components/ui';
import { colors } from '@/theme/tokens';

// Building blocks of the "RENVI для всех" prototype that several screens share (.x-big, .x-hint, .x-switch, .x-set,
// .x-step, .x-chip, .x-dark, .x-green). Sizes come from measuring the prototype.

/** Large option with an icon, title, caption and a round check (.x-big). */
export function BigOption({ on, icon, title, sub, onPress, disabled }: { on: boolean; icon: IconName; title: string; sub?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on, disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[s.big, on && s.bigOn, disabled && !on && { opacity: 0.55 }]}>
      <View style={s.ico}><UiIcon name={icon} size={20} color="#5E5852" /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.bigTitle}>{title}</Text>
        {sub ? <Text style={s.bigSub}>{sub}</Text> : null}
      </View>
      <View style={[s.check, on && s.checkOn]}>{on ? <Text style={s.checkMark}>✓</Text> : null}</View>
    </Pressable>
  );
}

/** Grey information box with an icon (.x-hint). */
export function Hint({ children, icon = 'shield' }: { children: React.ReactNode; icon?: IconName }) {
  return (
    <View style={s.hint}>
      <View style={{ marginTop: 1 }}><UiIcon name={icon} size={16} color="#5E5852" /></View>
      <Text style={s.hintText}>{children}</Text>
    </View>
  );
}

/** On/off switch, 42 × 26 (.x-switch). */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on, disabled: !!disabled }} disabled={disabled}
      hitSlop={9} onPress={() => onChange(!on)} style={[s.sw, on && s.swOn, disabled && { opacity: 0.5 }]}>
      <View style={[s.knob, on && { left: 19 }]} />
    </Pressable>
  );
}

/** Settings row: title, small caption, control on the right (.x-set). */
export function SetRow({ title, sub, right, last }: { title: string; sub?: string; right?: React.ReactNode; last?: boolean }) {
  return (
    <View style={[s.set, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.setTitle}>{title}</Text>
        {sub ? <Text style={s.setSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Numbered list of short steps (.x-step). */
export function StepList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={s.step}>
          <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
          <Text style={s.stepText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

/** Filter chip (.x-chip): outlined, dark when selected, or red-tinted. */
export function FilterChip({ label, on, tone, onPress, icon }: { label: string; on?: boolean; tone?: 'red'; onPress?: () => void; icon?: IconName }) {
  const fg = on ? '#fff' : tone === 'red' ? colors.redDark : colors.ink;
  const body = (
    <View style={[s.chip, on && s.chipOn, tone === 'red' && !on && s.chipRed]}>
      {icon ? <UiIcon name={icon} size={13} color={fg} /> : null}
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} hitSlop={4}>{body}</Pressable> : body;
}

/** Dark panel (.x-dark) and green panel (.x-green). */
export function DarkCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.dark, style]}>{children}</View>;
}
export function GreenCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.green, style]}>{children}</View>;
}

/** Pressable with the same press feedback as buttons, for custom cards. */
export function Tappable({ onPress, children, style, label }: { onPress: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; label?: string }) {
  const m = usePressScale(0.98);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={m.pressIn} onPressOut={m.pressOut} style={style}>
      {children}
    </Pressable>
  );
}

const s = StyleSheet.create({
  big: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 18, padding: 13, marginVertical: 7, minHeight: 66 },
  bigOn: { borderColor: colors.ink, backgroundColor: '#fff' },
  ico: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFEAE3', alignItems: 'center', justifyContent: 'center' },
  bigTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  bigSub: { fontSize: 10.5, lineHeight: 14, color: colors.sub, marginTop: 2 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D6D0C8', alignItems: 'center', justifyContent: 'center' },
  checkOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 13 },
  hint: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: '#EFEAE3', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginVertical: 10 },
  hintText: { flex: 1, fontSize: 10.5, lineHeight: 15, color: '#5E5852' },
  sw: { width: 42, height: 26, borderRadius: 13, backgroundColor: '#D6D0C8' },
  swOn: { backgroundColor: colors.red },
  knob: { position: 'absolute', left: 3, top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  set: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0EAE3', minHeight: 48 },
  setTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  setSub: { fontSize: 10.5, lineHeight: 14, color: colors.sub, marginTop: 2 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 5 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.redWash, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 11, fontWeight: '800', color: colors.redDark },
  stepText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.ink, paddingTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, minHeight: 34, marginRight: 7, marginBottom: 7 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipRed: { backgroundColor: colors.redWash, borderColor: colors.chipBorder },
  chipText: { fontSize: 11, fontWeight: '600' },
  dark: { backgroundColor: colors.ink, borderRadius: 20, padding: 15, marginVertical: 10 },
  green: { backgroundColor: colors.green, borderRadius: 22, paddingVertical: 22, paddingHorizontal: 17, alignItems: 'center' },
});
