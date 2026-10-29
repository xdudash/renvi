import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyMedia } from '@/hooks/usePhotos';
import { colors } from '@/theme/tokens';
import { useLang } from '@/lib/lang';

// 3-column grid of 6 slots; filled slots show × to remove, empty slots show ＋.
export function PhotoGrid({ items, onAdd, onRemove, onCover, busy }: {
  items: MyMedia[]; onAdd: () => void; onRemove: (id: string) => void; onCover?: (id: string) => void; busy?: boolean;
}) {
  const { t } = useLang();
  return (
    <View style={s.grid}>
      {Array.from({ length: 6 }).map((_, n) => {
        const it = items[n];
        if (!it) {
          return (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel={t('components.photoGrid.add')} disabled={busy} onPress={onAdd} style={[s.slot, s.add]}>
              {busy && n === items.length ? <Text style={s.plus}>…</Text> : (
                // Drawn, not the ＋ glyph: the font's baseline put it at the bottom of the tile on iOS.
                <View style={s.plusBox}><View style={s.plusH} /><View style={s.plusV} /></View>
              )}
            </Pressable>
          );
        }
        return (
          <View key={it.id} style={s.slot}>
            {onCover && n > 0 ? <Pressable style={StyleSheet.absoluteFill} onPress={() => onCover(it.id)} accessibilityRole="button" accessibilityLabel={t('components.photoGrid.makeCover')} /> : null}
            {it.url ? <Image pointerEvents="none" source={{ uri: it.url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={n === 0 ? t('components.photoGrid.cover') : t('components.photoGrid.photo')} /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={t('components.photoGrid.remove')} onPress={() => onRemove(it.id)} style={s.x}><Text style={{ color: '#fff' }}>×</Text></Pressable>
            {it.kind === 'video' ? <View style={s.video}><Text style={{ fontSize: 10 }}>{t('components.photoGrid.video')}</Text></View> : null}
            {n === 0 && onCover ? <View style={[s.video, { right: 4, left: undefined }]}><Text style={{ fontSize: 10 }}>{t('components.photoGrid.coverBadge')}</Text></View> : null}
          </View>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  slot: { width: '31.6%', aspectRatio: 0.78, borderRadius: 13, overflow: 'hidden', backgroundColor: '#eee' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#e2b9b1', backgroundColor: colors.white },
  plus: { fontSize: 22, color: '#8e8980' },
  plusBox: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.redWash, alignItems: 'center', justifyContent: 'center' },
  plusH: { position: 'absolute', width: 14, height: 2.4, borderRadius: 2, backgroundColor: colors.red },
  plusV: { position: 'absolute', width: 2.4, height: 14, borderRadius: 2, backgroundColor: colors.red },
  x: { position: 'absolute', right: 5, top: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(17,17,17,0.53)', alignItems: 'center', justifyContent: 'center' },
  video: { position: 'absolute', left: 4, bottom: 4, backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
});
