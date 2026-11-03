import { useWindowDimensions } from 'react-native';
import { gridTileSize } from '@/lib/grid';

export { SCREEN_GUTTER } from '@/lib/grid';

/**
 * Exact tile size for a grid inside a Screen. Explicit width + height instead of `width: '%'` + `aspectRatio`:
 * on iOS (new architecture) that combination inside a wrapping row could lay tiles out with zero height, so the
 * incoming-sparks grid looked empty and the "+" sat at the bottom of photo slots.
 */
export function useGridTile(columns: number, gap: number, ratio: number) {
  const { width } = useWindowDimensions();
  return gridTileSize(width, columns, gap, ratio);
}
