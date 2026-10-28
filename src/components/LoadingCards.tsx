import { View } from 'react-native';
import { Card, Meter, Tiny } from './ui';

// Skeleton used while profiles load ("Загрузка" state).
export function LoadingCards() {
  return (
    <View accessibilityLabel="Загружаем профили">
      <View style={{ height: 300, borderRadius: 24, backgroundColor: '#EAE6E0', marginVertical: 7 }} />
      <Card><Meter value={42} /><Tiny>Загружаем профили…</Tiny></Card>
    </View>
  );
}
