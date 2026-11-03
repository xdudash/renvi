import { Platform } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { BrandMark } from './BrandMark';

export type IconName = 'discover' | 'chat' | 'profile' | 'comment' | 'close' | 'arrow' | 'grid' | 'shield' | 'filter' | 'date' | 'pin' | 'spark'
  | 'ruler' | 'globe' | 'kids' | 'smoke' | 'glass' | 'dumbbell' | 'cap' | 'paw' | 'star' | 'heart' | 'book' | 'check';

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
    // Profile details ("Подробнее обо мне"): drawn, because emoji are missing in some iOS fonts and showed as "?".
    ruler: <><Path d="M3 16 16 3l5 5L8 21Z" {...sp} /><Path d="m7 12 2 2m1-5 2 2m1-5 2 2" {...sp} /></>,
    globe: <><Circle cx={12} cy={12} r={9} {...sp} /><Path d="M3 12h18M12 3c3.2 3.4 3.2 14.6 0 18M12 3c-3.2 3.4-3.2 14.6 0 18" {...sp} /></>,
    kids: <><Circle cx={12} cy={12} r={9} {...sp} /><Path d="M9 10h.01M15 10h.01M8.5 14.5c2 2 5 2 7 0" {...sp} /></>,
    smoke: <><Rect x={2} y={14} width={16} height={4} rx={1} {...sp} /><Path d="M21 14v4M18 10c0-2 2-2 2-4" {...sp} /></>,
    glass: <Path d="M7 3h10l-1 7a4 4 0 0 1-8 0Zm5 11v7m-4 0h8" {...sp} />,
    dumbbell: <Path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" {...sp} />,
    cap: <><Path d="m2 9 10-5 10 5-10 5Z" {...sp} /><Path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6" {...sp} /></>,
    paw: <><Circle cx={6.5} cy={10} r={1.7} {...sp} /><Circle cx={10} cy={5.5} r={1.7} {...sp} /><Circle cx={14} cy={5.5} r={1.7} {...sp} /><Circle cx={17.5} cy={10} r={1.7} {...sp} /><Path d="M12 12c-3 0-5.5 3.3-5.5 5.5A2.5 2.5 0 0 0 9 20h6a2.5 2.5 0 0 0 2.5-2.5C17.5 15.3 15 12 12 12Z" {...sp} /></>,
    star: <Path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" {...sp} />,
    heart: <Path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9C20 15.3 12 20 12 20Z" {...sp} />,
    book: <><Path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" {...sp} /><Path d="M4 21V5M9 7h6" {...sp} /></>,
    check: <Path d="m5 12 4.5 4.5L19 7" {...sp} />,
  }[name];
  return <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>{body}</Svg>;
}
