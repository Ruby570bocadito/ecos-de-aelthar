// ============================================================
// ECOS DE AELTHAR — Objetos de aldea sobre hierba (módulo world)
// Casos: 'H' pared casa · 'r' tejado · 'd' puerta · 'F' valla
//        'w' pozo · 'g' lápida · 'R' roca
// Contrato: paintVillage llamada por el despachador drawTile.
// ============================================================

import { hash2 } from './palette';
import { px, type NeighborFn } from './palette';

export function paintVillage(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, _at?: NeighborFn,
): void {
  void mapId; void t;
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx, ty);
  if (ch === 'H') { // pared casa
    px(x, px0, py0, 16, 16, '#e2d0ac');
    x.fillStyle = '#7a5c38';
    x.fillRect(px0, py0, 16, 2);
    x.fillRect(px0, py0, 2, 16);
    x.fillRect(px0 + 14, py0, 2, 16);
    x.fillStyle = '#d0bc94';
    x.fillRect(px0 + 4, py0 + 6, 8, 6);
    return;
  }
  if (ch === 'r') { // tejado
    px(x, px0, py0, 16, 16, '#a8503a');
    for (let row = 0; row < 4; row++) {
      x.fillStyle = row % 2 === 0 ? '#94422e' : '#a8503a';
      x.fillRect(px0, py0 + row * 4, 16, 4);
      x.fillStyle = '#7e3626';
      x.fillRect(px0, py0 + row * 4 + 3, 16, 1);
    }
    x.fillStyle = '#c86850';
    x.fillRect(px0, py0, 16, 1);
    return;
  }
  if (ch === 'd') { // puerta
    px(x, px0, py0, 16, 16, '#e2d0ac');
    px(x, px0 + 3, py0 + 2, 10, 14, '#5c3a1e');
    px(x, px0 + 4, py0 + 3, 8, 13, '#7a5230');
    px(x, px0 + 10, py0 + 9, 1, 2, '#f0c84a');
    return;
  }
  if (ch === 'F') { // valla
    px(x, px0, py0 + 4, 16, 2, '#8a6a3e');
    px(x, px0, py0 + 10, 16, 2, '#8a6a3e');
    px(x, px0 + 2, py0 + 2, 3, 13, '#9a7848');
    px(x, px0 + 11, py0 + 2, 3, 13, '#9a7848');
    px(x, px0 + 2, py0 + 2, 3, 1, '#b89868');
    return;
  }
  if (ch === 'w') { // pozo
    px(x, px0, py0, 16, 16, '#4f8a46');
    px(x, px0 + 2, py0 + 4, 12, 10, '#6a6a7a');
    px(x, px0 + 3, py0 + 5, 10, 8, '#2a3444');
    px(x, px0 + 2, py0 + 4, 12, 2, '#7a7a8a');
    px(x, px0 + 3, py0 - 4, 10, 2, '#8a6a3e');
    return;
  }
  if (ch === 'g') { // lápida
    px(x, px0, py0, 16, 16, '#396334');
    px(x, px0 + 4, py0 + 5, 8, 9, '#8a8a98');
    px(x, px0 + 5, py0 + 3, 6, 4, '#9a9aa8');
    px(x, px0 + 6, py0 + 7, 4, 1, '#6a6a7a');
    px(x, px0 + 4, py0 + 14, 8, 1, '#5a5a6a');
    return;
  }
  if (ch === 'R') { // roca
    px(x, px0, py0, 16, 16, r < 0.5 ? '#4f8a46' : '#396334');
    px(x, px0 + 3, py0 + 6, 10, 8, '#7a7a88');
    px(x, px0 + 5, py0 + 4, 7, 4, '#8a8a98');
    px(x, px0 + 4, py0 + 13, 9, 2, '#5a5a6a');
    px(x, px0 + 6, py0 + 5, 3, 2, '#a0a0b0');
  }
}
