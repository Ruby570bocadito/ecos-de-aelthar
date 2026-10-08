// ============================================================
// ECOS DE AELTHAR — Tiles de hierba y naturaleza (módulo world)
// Casos: '.' hierba · ',' hierba alta/flores · 'c' cultivo
//        'm' niebla muda (suelo transitable)
// Contrato: paintGrass llamada por el despachador drawTile.
// ============================================================

import { hash2 } from './palette';
import { px, PAL, isForest, pick, type NeighborFn } from './palette';

export function paintGrass(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, _at?: NeighborFn,
): void {
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx, ty);
  const r2 = hash2(tx * 7 + 3, ty * 11 + 5);
  // hierba
  const g = isForest(mapId) ? ['#3f6d3a', '#396334'] : ['#4f8a46', '#467c3e'];
  px(x, px0, py0, 16, 16, r < 0.5 ? g[0] : g[1]);
  for (let i = 0; i < 4; i++) {
    const hx = hash2(tx * 4 + i, ty * 9 + i);
    if (hx < 0.35) {
      x.fillStyle = isForest(mapId) ? PAL.grassBladeBosque : PAL.grassBlade;
      x.fillRect(px0 + Math.floor(hx * 14), py0 + Math.floor(hash2(tx + i, ty * 3 + i) * 14), 1, 2);
    }
  }
  if (ch === ',') {
    const cols = ['#f0d060', '#e878a0', '#f0f0f0', '#e88a4a'];
    const col = cols[pick(r2, cols.length)];
    x.fillStyle = col;
    x.fillRect(px0 + 4 + Math.floor(r * 7), py0 + 4 + Math.floor(r2 * 7), 2, 2);
    x.fillStyle = '#fff';
    x.fillRect(px0 + 4 + Math.floor(r * 7), py0 + 4 + Math.floor(r2 * 7), 1, 1);
  }
  if (ch === 'c') { // cultivo
    px(x, px0, py0, 16, 16, '#6a4e30');
    for (let row = 0; row < 3; row++) {
      x.fillStyle = '#4f8a46';
      x.fillRect(px0 + 2, py0 + 3 + row * 5, 12, 2);
      x.fillStyle = '#5a9a50';
      x.fillRect(px0 + 2, py0 + 3 + row * 5, 12, 1);
    }
  }
  if (ch === 'm') { // niebla muda (suelo)
    px(x, px0, py0, 16, 16, '#4a5a52');
    x.globalAlpha = 0.3;
    px(x, px0, py0 + 4 + Math.floor(Math.sin(t + tx) * 2), 16, 8, '#9ec4b4');
    x.globalAlpha = 1;
  }
}
