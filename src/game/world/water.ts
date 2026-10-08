// ============================================================
// ECOS DE AELTHAR — Tiles de agua y puentes (módulo world)
// Casos: '~' agua · 'B' puente entero (pasado) · 'x' puente roto
// Contrato: paintWater llamada por el despachador drawTile.
// ============================================================

import { hash2 } from './palette';
import { px, PAL, type NeighborFn } from './palette';

export function paintWater(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, _at?: NeighborFn,
): void {
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx, ty);
  const r2 = hash2(tx * 7 + 3, ty * 11 + 5);
  if (ch === 'B' || ch === 'x') { // puente / roto
    px(x, px0, py0, 16, 16, '#3a6a9a');
    if (ch === 'B') {
      px(x, px0, py0 + 2, 16, 12, '#9a7040');
      for (let i = 0; i < 4; i++) px(x, px0, py0 + 2 + i * 3, 16, 1, '#7a5530');
      px(x, px0, py0 + 2, 16, 1, '#b89058');
    } else {
      px(x, px0 + 1, py0 + 3, 5, 3, '#8a6438');
      px(x, px0 + 9, py0 + 9, 6, 3, '#8a6438');
    }
    return;
  }
  // agua
  const w = Math.sin((t * 2 + tx * 0.9 + ty * 1.3)) * 0.5 + 0.5;
  px(x, px0, py0, 16, 16, '#3a6a9a');
  px(x, px0, py0, 16, 16, w > 0.5 ? '#3f72a4' : '#3a6a9a');
  x.fillStyle = '#6aa0cc';
  if (r > 0.5) x.fillRect(px0 + 2, py0 + 4 + Math.floor(w * 3), 6, 1);
  if (r2 > 0.5) x.fillRect(px0 + 8, py0 + 10 + Math.floor(w * 2), 5, 1);
}
