import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Decorative: hidden from screen readers on every platform.
const hidden = Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : { accessibilityElementsHidden: true, importantForAccessibility: 'no' as const };

// Exact geometry from the prototype's brandMark(): two mirrored petals.
export function BrandMark({ color = '#DA302B', size = 28 }: { color?: string; size?: number }) {
  const d = 'M42 4C18 10 2 30 2 52c0 19 12 32 28 32 10 0 16-6 16-14 0-8-10-13-10-20S51 35 53 24C55 12 51 2 42 4Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 112 112" {...hidden}>
      <Path d={d} fill={color} />
      <Path d={d} fill={color} transform="translate(112 112) rotate(180)" />
    </Svg>
  );
}
