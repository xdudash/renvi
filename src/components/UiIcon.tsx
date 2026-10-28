import { Platform } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { BrandMark } from './BrandMark';

export type IconName = 'discover' | 'chat' | 'profile' | 'comment' | 'close' | 'arrow' | 'grid' | 'shield' | 'filter' | 'date' | 'pin' | 'spark';

const hidden = Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : { accessibilityElementsHidden: true, importantForAccessibility: 'no' as const };

// Line icons copied 1:1 from the prototype's uiIcon() (24×24, stroke 1.65, round caps/joins).
export function UiIcon({ name, size = 22, color = '#201E1D', paper = '#F7F5F2' }: { name: IconName; size?: number; color?: string; paper?: string }) {
  if (name === 'spark') return <BrandMark color={color} size={size} />;
  const sp = { stroke: color, strokeWidth: 1.65, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const body = {
    discover: <><Rect x={4} y={3} width={16} height={18} rx={5} {...sp} /><Circle cx={12} cy={9} r={2.5} {...sp} /><Path d="M7 17c1-4 9-4 10 0" {...sp} /></>,
    chat: <><Path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z" {...sp} /><Path d="M7 11h1m3 0h1m3 0h1" {...sp} /></>,
    profile: <><Circle cx={12} cy={7} r={4} {...sp} /><Path d="M4 22v-2a8 8 0 0 1 16 0v2" {...sp} /></>,
    comment: <Path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a10 10 0 0 1 19 0Z" {...sp} />,
    close: <Path d="m5 5 14 14M19 5 5 19" {...sp} />,
    arrow: <Path d="M5 19 19 5M5 5h14v14" {...sp} />,
    grid: <><Rect x={3} y={3} width={7} height={7} rx={1.5} {...sp} /><Rect x={14} y={3} width={7} height={7} rx={1.5} {...sp} /><Rect x={3} y={14} width={7} height={7} rx={1.5} {...sp} /><Rect x={14} y={14} width={7} height={7} rx={1.5} {...sp} /></>,
    shield: <><Path d="m12 2 9 4v6c0 5-4 9-9 11-5-2-9-6-9-11V6Z" {...sp} /><Path d="m8 12 3 3 5-6" {...sp} /></>,
    filter: <><Path d="M3 6h18M3 12h18M3 18h18" {...sp} /><Circle cx={8} cy={6} r={2} {...sp} fill={paper} /><Circle cx={16} cy={12} r={2} {...sp} fill={paper} /><Circle cx={10} cy={18} r={2} {...sp} fill={paper} /></>,
    date: <><Rect x={3} y={5} width={18} height={16} rx={3} {...sp} /><Path d="M7 2v6m10-6v6M3 11h18m-14 5h3m4 0h3" {...sp} /></>,
    pin: <><Path d="M20 9c0 6-8 13-8 13S4 15 4 9a8 8 0 1 1 16 0Z" {...sp} /><Circle cx={12} cy={9} r={2.5} {...sp} /></>,
  }[name];
  return <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>{body}</Svg>;
}
