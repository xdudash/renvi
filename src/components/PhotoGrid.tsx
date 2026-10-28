import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MyMedia } from '@/hooks/usePhotos';
import { colors } from '@/theme/tokens';

// 3-column grid of 6 slots; filled slots show × to remove, empty slots show ＋.
export function PhotoGrid({ items, onAdd, onRemove, onCover, busy }: {
  items: MyMedia[]; onAdd: () => void; onRemove: (id: string) => void; onCover?: (id: string) => void; busy?: boolean;
}) {
  return (
    <View style={s.grid}>
      {Array.from({ length: 6 }).map((_, n) => {
        const it = items[n];
        if (!it) {
          return (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel="Добавить фото или видео" disabled={busy} onPress={onAdd} style={[s.slot, s.add]}>
              <Text style={s.plus}>{busy && n === items.length ? '…' : '＋'}</Text>
            </Pressable>
          );
        }
        return (
          <View key={it.id} style={s.slot}>
            {onCover && n > 0 ? <Pressable style={StyleSheet.absoluteFill} onPress={() => onCover(it.id)} accessibilityRole="button" accessibilityLabel="Сделать обложкой" /> : null}
            {it.url ? <Image pointerEvents="none" source={{ uri: it.url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={n === 0 ? 'Обложка профиля' : 'Фото профиля'} /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Удалить" onPress={() => onRemove(it.id)} style={s.x}><Text style={{ color: '#fff' }}>×</Text></Pressable>
            {it.kind === 'video' ? <View style={s.video}><Text style={{ fontSize: 10 }}>▶ Видео</Text></View> : null}
            {n === 0 && onCover ? <View style={[s.video, { right: 4, left: undefined }]}><Text style={{ fontSize: 10 }}>Обложка</Text></View> : null}
          </View>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  slot: { width: '31.6%', aspectRatio: 0.78, borderRadius: 13, overflow: 'hidden', backgroundColor: '#eee' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#d2cdc4', backgroundColor: 'transparent' },
  plus: { fontSize: 22, color: '#8e8980' },
  x: { position: 'absolute', right: 5, top: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(17,17,17,0.53)', alignItems: 'center', justifyContent: 'center' },
  video: { position: 'absolute', left: 4, bottom: 4, backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
});
