import { Platform } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { BrandMark } from './BrandMark';

export type IconName = 'discover' | 'chat' | 'profile' | 'comment' | 'close' | 'arrow' | 'grid' | 'shield' | 'filter' | 'date' | 'pin' | 'spark'
  | 'gift' | 'ball' | 'couple' | 'people'
  | 'ruler' | 'globe' | 'kids' | 'smoke' | 'glass' | 'dumbbell' | 'cap' | 'paw' | 'star' | 'heart' | 'book' | 'check' | 'lock' | 'clock'
  | 'snow' | 'mountain' | 'spa' | 'bulb' | 'music' | 'dice' | 'film' | 'pot' | 'train' | 'plus' | 'bolt' | 'wave' | 'play';

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
    // Welcome mosaic and the plan / company screens (new "RENVI для всех" prototype).
    gift: <><Rect x={4} y={9} width={16} height={11} rx={2} {...sp} /><Path d="M3 9h18v-2H3zM12 7v13M12 7c-2-4-6-3-5-.5S12 7 12 7zm0 0c2-4 6-3 5-.5S12 7 12 7z" {...sp} /></>,
    ball: <><Circle cx={12} cy={12} r={9} {...sp} /><Path d="M3.5 9.5c5 1 12 1 17 0M3.5 14.5c5-1 12-1 17 0" {...sp} /></>,
    couple: <><Circle cx={8} cy={8} r={3} {...sp} /><Circle cx={16} cy={8} r={3} {...sp} /><Path d="M2.5 19c.5-3 2.6-4.8 5.5-4.8 1.6 0 3 .6 4 1.6 1-1 2.4-1.6 4-1.6 2.9 0 5 1.8 5.5 4.8" {...sp} /></>,
    people: <><Circle cx={9} cy={8} r={3.2} {...sp} /><Circle cx={17} cy={9} r={2.6} {...sp} /><Path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" {...sp} /><Path d="M14.5 15.2c.8-.7 1.7-1 2.6-1 2 0 3.6 1.4 4 4" {...sp} /></>,
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
    lock: <><Rect x={5} y={11} width={14} height={9} rx={2} {...sp} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" {...sp} /></>,
    snow: <Path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" {...sp} />,
    mountain: <><Path d="M3 19 9.5 8l4 6.5L16 11l5 8z" {...sp} /><Path d="m8 10.5 1.5 1.5 1.5-1.5" {...sp} /></>,
    spa: <><Path d="M4 14c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2M4 18.5c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2" {...sp} /><Path d="M9 10c0-2 1.5-2.5 1.5-4.5M14 10c0-2 1.5-2.5 1.5-4.5" {...sp} /></>,
    bulb: <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" {...sp} />,
    music: <><Path d="M9 18V5l11-2v13" {...sp} /><Circle cx={6} cy={18} r={3} {...sp} /><Circle cx={17} cy={16} r={3} {...sp} /></>,
    dice: <><Rect x={4} y={4} width={16} height={16} rx={4} {...sp} /><Circle cx={9} cy={9} r={1} {...sp} fill={color} /><Circle cx={15} cy={15} r={1} {...sp} fill={color} /><Circle cx={15} cy={9} r={1} {...sp} fill={color} /><Circle cx={9} cy={15} r={1} {...sp} fill={color} /></>,
    film: <><Rect x={3.5} y={5} width={17} height={14} rx={2} {...sp} /><Path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4" {...sp} /></>,
    pot: <Path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM2 10h20M9 6c0-1 1-1.5 1-2.5M14 6c0-1 1-1.5 1-2.5" {...sp} />,
    train: <><Rect x={6} y={3} width={12} height={14} rx={3} {...sp} /><Path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4" {...sp} /><Circle cx={9} cy={14} r={0.8} {...sp} fill={color} /><Circle cx={15} cy={14} r={0.8} {...sp} fill={color} /></>,
    plus: <Path d="M12 5v14M5 12h14" {...sp} />,
    bolt: <Path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z" {...sp} />,
    wave: <><Path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11" {...sp} /><Path d="M10 10V4.5a1.5 1.5 0 0 1 3 0V10" {...sp} /><Path d="M13 10V5.5a1.5 1.5 0 0 1 3 0V12" {...sp} /><Path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-12.6 4.2L4 15a1.6 1.6 0 0 1 2.4-2L7 13.5V11" {...sp} /></>,
    play: <Path d="M7 4.5v15l12-7.5z" {...sp} />,
    clock: <><Circle cx={12} cy={12} r={9} {...sp} /><Path d="M12 7v5l3 2" {...sp} /></>,
  }[name];
  return <Svg width={size} height={size} viewBox="0 0 24 24" {...hidden}>{body}</Svg>;
}
