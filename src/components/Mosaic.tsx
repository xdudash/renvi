import { StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '@/components/BrandMark';
import { UiIcon, type IconName } from '@/components/UiIcon';

// Coloured tiles from the prototype (.x-mosaic / .x-tile): a 2-column grid; a tile can span both columns.
export type TileSpec = { key: string; title: string; sub: string; bg: string; fg: string; icon: IconName | 'brand'; wide?: boolean };

export function Tile({ title, sub, bg, fg, icon, wide }: Omit<TileSpec, 'key'>) {
  return (
    <View style={[s.tile, { backgroundColor: bg }, wide ? s.wide : s.half]}>
      <View style={s.icon}>{icon === 'brand' ? <BrandMark color="#DA302B" size={22} /> : <UiIcon name={icon} size={22} color={fg} />}</View>
      <Text style={[s.title, { color: fg }]}>{title}</Text>
      <Text style={[s.sub, { color: fg }]}>{sub}</Text>
    </View>
  );
}

export function Mosaic({ tiles }: { tiles: TileSpec[] }) {
  return <View style={s.grid} accessibilityRole="list">{tiles.map(({ key, ...t }) => <Tile key={key} {...t} />)}</View>;
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 4 },
  tile: { borderRadius: 20, padding: 13, gap: 3, justifyContent: 'flex-end' },
  half: { width: '48.9%', flexGrow: 1, minHeight: 92 },
  wide: { width: '100%', minHeight: 70 },
  icon: { flexGrow: 1, alignItems: 'flex-start' },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: -0.13 },
  sub: { fontSize: 10, opacity: 0.8 },
});
