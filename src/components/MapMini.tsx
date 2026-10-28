import { Text, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';

// .map-mini from the prototype: diagonal bands (40°) with a soft ellipse — a stylised map, no real map data.
export function MapMini({ label }: { label: string }) {
  return (
    <View style={{ height: 150, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width="100%" height="100%" style={{ position: 'absolute' }} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="bands" x1="0" y1="1" x2="0.77" y2="0.36">
            <Stop offset="0.25" stopColor="#e9eee3" /><Stop offset="0.26" stopColor="#f8f1e5" />
            <Stop offset="0.49" stopColor="#f8f1e5" /><Stop offset="0.5" stopColor="#e9eee3" />
            <Stop offset="0.72" stopColor="#e9eee3" /><Stop offset="0.73" stopColor="#f8f1e5" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#bands)" />
        <Ellipse cx="60" cy="45" rx="8" ry="8" fill="#e7e1d1" />
      </Svg>
      <Text style={{ color: '#5d694c' }}>⌖　{label}</Text>
    </View>
  );
}
