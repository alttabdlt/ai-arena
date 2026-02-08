/**
 * Viewport culling helpers for tile-based rendering.
 */
import { TILE_SIZE } from '../constants';

export interface ViewportBounds {
  x: number; y: number;
  w: number; h: number;
}

/** Return range of visible tile columns/rows for the given camera viewport */
export function visibleTileRange(
  viewport: ViewportBounds,
  totalCols: number,
  totalRows: number,
): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
  const margin = 2; // render a few extra tiles beyond viewport edge
  const minCol = Math.max(0, Math.floor(viewport.x / TILE_SIZE) - margin);
  const maxCol = Math.min(totalCols - 1, Math.floor((viewport.x + viewport.w) / TILE_SIZE) + margin);
  const minRow = Math.max(0, Math.floor(viewport.y / TILE_SIZE) - margin);
  const maxRow = Math.min(totalRows - 1, Math.floor((viewport.y + viewport.h) / TILE_SIZE) + margin);
  return { minCol, maxCol, minRow, maxRow };
}
