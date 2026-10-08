// ============================================================
// ECOS DE AELTHAR — Tiles de piedra y cripta (módulo world)
// Casos: ':' suelo piedra · '_' madera · '#' muro · 'P' pilar
//        'A' altar · 'V' vacío
// Contrato: paintStone llamada por el despachador drawTile.
// ============================================================

import { hash2 } from './palette';
import { px, type NeighborFn } from './palette';

export function paintStone(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, _at?: NeighborFn,
): void {
  void mapId; void t;
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx, ty);
  if (ch === ':' || ch === '_') { // suelo piedra / madera
    if (ch === ':') {
      px(x, px0, py0, 16, 16, '#6a6a7a');
      px(x, px0, py0, 16, 1, '#7a7a8a');
      if (r > 0.7) { x.fillStyle = '#5a5a6a'; x.fillRect(px0 + 3, py0 + 9, 7, 1); }
      x.fillStyle = '#585868';
      x.fillRect(px0, py0, 16, 1); x.fillRect(px0, py0, 1, 16);
    } else {
      px(x, px0, py0, 16, 16, '#8a6a44');
      px(x, px0, py0 + 7, 16, 1, '#6a4e30');
      px(x, px0, py0, 1, 16, '#6a4e30');
      px(x, px0 + (r > 0.5 ? 4 : 10), py0 + 2, 1, 5, '#7a5c3a');
    }
    return;
  }
  if (ch === '#') { // muro piedra
    px(x, px0, py0, 16, 16, '#5a5a6e');
    x.fillStyle = '#4a4a5c';
    for (let row = 0; row < 4; row++) {
      x.fillRect(px0, py0 + row * 4 + 3, 16, 1);
      const off = row % 2 === 0 ? 0 : 8;
      x.fillRect(px0 + ((off + 3) % 16), py0 + row * 4, 1, 3);
      x.fillRect(px0 + ((off + 11) % 16), py0 + row * 4, 1, 3);
    }
    x.fillStyle = '#6e6e84';
    x.fillRect(px0, py0, 16, 1);
    if (r > 0.75) { x.fillStyle = '#3e3e50'; x.fillRect(px0 + 5, py0 + 6, 3, 2); }
    return;
  }
  if (ch === 'P') { // pilar
    px(x, px0, py0, 16, 16, '#6a6a7a');
    px(x, px0 + 2, py0 - 6, 12, 22, '#8a8a9a');
    px(x, px0 + 2, py0 - 6, 3, 22, '#a4a4b4');
    px(x, px0 + 1, py0 - 8, 14, 3, '#9a9aaa');
    px(x, px0 + 1, py0 + 14, 14, 2, '#5a5a6a');
    return;
  }
  if (ch === 'A') { // altar
    px(x, px0, py0, 16, 16, '#585868');
    px(x, px0 + 2, py0 + 4, 12, 9, '#7a7a8a');
    px(x, px0 + 3, py0 + 2, 10, 3, '#8a8a9a');
    px(x, px0 + 4, py0 + 6, 8, 1, '#f0c84a');
    px(x, px0 + 5, py0 + 8, 6, 1, '#f0c84a');
    return;
  }
  if (ch === 'V') { // vacío
    px(x, px0, py0, 16, 16, '#0c0a14');
    if (r > 0.8) { x.fillStyle = '#1c1828'; x.fillRect(px0 + 3, py0 + 5, 4, 2); }
  }
}
