// ============================================================
// ECOS DE AELTHAR — Árboles altos (módulo world)
// Casos: 't' árbol coposo · 'p' pino (drawTallTile)
// Contrato: paintTall llamada por el despachador drawTallTile.
// ============================================================

import { hash2 } from './palette';
import { type NeighborFn } from './palette';

export function paintTall(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, _at?: NeighborFn,
): void {
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx * 3 + 1, ty * 5 + 7);
  if (ch === 't') { // árbol coposo
    x.fillStyle = '#5c4028';
    x.fillRect(px0 + 6, py0 + 8, 4, 8);
    x.fillStyle = '#4a3420';
    x.fillRect(px0 + 6, py0 + 14, 4, 2);
    const c1 = mapId === 'bosque' ? '#2e5d34' : '#3a703c';
    const c2 = mapId === 'bosque' ? '#3e7244' : '#4a8a4c';
    x.fillStyle = c1;
    x.fillRect(px0 + 1, py0 - 6, 14, 14);
    x.fillRect(px0 + 3, py0 - 10, 10, 6);
    x.fillStyle = c2;
    x.fillRect(px0 + 2, py0 - 8, 8, 6);
    x.fillRect(px0 + 4, py0 - 11, 5, 4);
    if (r > 0.6) {
      x.fillStyle = r > 0.8 ? '#e05858' : '#e8c860';
      x.fillRect(px0 + 3 + Math.floor(r * 6), py0 - 4, 2, 2);
    }
  } else if (ch === 'p') { // pino
    x.fillStyle = '#54381e';
    x.fillRect(px0 + 6, py0 + 10, 4, 6);
    x.fillStyle = '#1e4a2c';
    x.fillRect(px0 + 3, py0 - 2, 10, 8);
    x.fillRect(px0 + 5, py0 - 8, 6, 7);
    x.fillRect(px0 + 6, py0 - 12, 4, 5);
    x.fillStyle = '#2e6238';
    x.fillRect(px0 + 4, py0 - 4, 6, 4);
    x.fillRect(px0 + 6, py0 - 10, 3, 3);
    x.fillStyle = '#e8f0f4';
    if (r > 0.7) x.fillRect(px0 + 5, py0 - 9, 2, 1);
  }
}
