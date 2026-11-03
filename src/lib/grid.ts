/** Screen side padding (styles.main in components/ui.tsx). */
export const SCREEN_GUTTER = 18;

/** Exact tile size for `columns` tiles with `gap` between them inside a Screen of `screenWidth`. */
export function gridTileSize(screenWidth: number, columns: number, gap: number, ratio: number) {
  const content = screenWidth - SCREEN_GUTTER * 2;
  const width = Math.max(1, Math.floor((content - gap * (columns - 1)) / columns));
  return { width, height: Math.round(width / ratio) };
}
