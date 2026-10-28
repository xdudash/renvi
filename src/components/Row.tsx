import { Pressable, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';

// .loc-row from the prototype: label, optional sub-line, chevron.
export function Row({ label, sub, onPress, right = '›' }: { label: string; sub?: string; onPress: () => void; right?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 12 }}>
      <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 12 }}>{label}</Text>{sub ? <Text style={{ fontSize: 10, color: colors.sub, marginTop: 3 }}>{sub}</Text> : null}</View>
      <Text>{right}</Text>
    </Pressable>
  );
}
