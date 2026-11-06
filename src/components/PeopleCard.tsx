import { StyleSheet, View } from 'react-native';
import { Photo } from '@/components/Photo';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { colors } from '@/theme/tokens';

/** Big photo for the Компания / Пары cards; falls back to a blank block while the signed URL loads. */
export function PersonPhoto({ path, height = 260, width }: { path: string | null | undefined; height?: number; width?: number | `${number}%` }) {
  const url = useSignedUrl(path ?? null);
  return url
    ? <Photo source={{ uri: url }} style={{ width: width ?? '100%', height }} resizeMode="cover" accessibilityIgnoresInvertColors />
    : <View style={{ width: width ?? '100%', height, backgroundColor: colors.blush }} />;
}

/** Round buttons row: «Пропустить» and the wide primary action (.x-actions). */
export const cardStyles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', marginTop: 10 },
  look: { backgroundColor: colors.redWash, padding: 12 },
  lookRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  lookChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  lookChipText: { fontSize: 11, fontWeight: '600', color: colors.ink },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 20, fontWeight: '900', letterSpacing: -0.6, color: colors.ink },
  meta: { fontSize: 11, color: colors.sub, marginTop: 3 },
  about: { fontSize: 12, lineHeight: 18, color: colors.ink, marginTop: 8, marginBottom: 6 },
  common: { fontSize: 10.5, fontWeight: '800', color: colors.green },
  actions: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 14, marginTop: 14 },
  roundWrap: { alignItems: 'center', gap: 4 },
  round: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, color: colors.sub },
  wide: { flex: 1, minHeight: 54, borderRadius: 27, backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  wideText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
