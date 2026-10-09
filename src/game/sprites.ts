// ============================================================
// ECOS DE AELTHAR — Arte pixel procedural (núcleo)
// Cache SPR + registro + slash arc + retratos + despachador de
// tiles. Los generadores viven en src/game/actors/ y world/.
// ============================================================

import { mkCanvas, px, type Frames } from './actors/util';
import { buildHumanoid } from './actors/humanoid';
import { buildWolf, buildGuardian } from './actors/enemies';
import { buildChest, buildSanctuary, buildFragment, buildWisp } from './actors/objects';
import { PALS } from './actors/palettes';
import { drawPortrait } from './actors/portraits';
import { paintGrass } from './world/grass';
import { paintWater } from './world/water';
import { paintStone } from './world/stone';
import { paintVillage } from './world/village';
import { paintTall } from './world/trees';
import { px as tpx } from './world/palette';

export { hash2 } from './world/palette';
export type { Frames } from './actors/util';
export { frameIndex, entityFrame, type HumanPal } from './actors/humanoid';
export { drawPortrait, drawSlashArc } from './actors/portraits';

const SPR: Record<string, Frames> = {};

function buildPickups(): void {
  {
    const { c, x } = mkCanvas(8, 10);
    px(x, 2, 0, 4, 2, '#8a5a2b'); px(x, 1, 2, 6, 7, '#e05078');
    px(x, 2, 3, 2, 3, '#ff9ab0'); px(x, 1, 9, 6, 1, '#8a2a48');
    SPR['potion'] = [c];
  }
  {
    const { c, x } = mkCanvas(10, 8);
    px(x, 1, 2, 8, 5, '#e8b23a'); px(x, 1, 2, 8, 1, '#f8d878');
    px(x, 0, 3, 1, 3, '#b8842a'); px(x, 9, 3, 1, 3, '#b8842a');
    px(x, 3, 4, 2, 1, '#b8842a'); px(x, 6, 4, 1, 1, '#b8842a');
    SPR['goldbag'] = [c];
  }
  {
    const { c, x } = mkCanvas(10, 10);
    px(x, 2, 1, 6, 8, '#cfd6e2'); px(x, 3, 0, 4, 1, '#9aa4b4');
    px(x, 3, 3, 4, 1, '#7a8494'); px(x, 3, 6, 4, 1, '#7a8494');
    SPR['keyEcho'] = [c];
  }
}

export function initSprites(): void {
  for (const [name, pal] of Object.entries(PALS)) SPR[name] = buildHumanoid(pal);
  SPR['lobo'] = buildWolf();
  SPR['guardian'] = buildGuardian();
  const chest = buildChest();
  SPR['chest'] = chest.closed;
  SPR['chest_open'] = chest.open;
  SPR['sanctuary'] = buildSanctuary();
  SPR['fragment'] = buildFragment();
  SPR['wisp'] = buildWisp();
  buildPickups();
}

export function getSpr(name: string): Frames {
  return SPR[name] ?? SPR['hero_alba'];
}

/** Registro tardío de sprites (los usa sprites_expansion.ts: jefes y
 *  enemigos del Acto II/III — sirena, golem, vult, coro, etc.). */
export function registerSpr(name: string, frames: Frames): void {
  SPR[name] = frames;
}

export const TILE = 16;

export type NeighborFn = (tx: number, ty: number) => string;

/**
 * Despachador de tiles: delega en los módulos de src/game/world/.
 * `at` (opcional) devuelve el char del tile vecino (dx,dy) — habilita
 * autotiling y transiciones entre terrenos en los módulos del mundo.
 */
export function drawTile(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, at?: NeighborFn,
): void {
  switch (ch) {
    case '.': case ',': case 'c': case 'm':
      paintGrass(x, ch, tx, ty, mapId, t, at); break;
    case '~': case 'B': case 'x':
      paintWater(x, ch, tx, ty, mapId, t, at); break;
    case ':': case '_': case '#': case 'P': case 'A': case 'V':
      paintStone(x, ch, tx, ty, mapId, t, at); break;
    case 'H': case 'r': case 'd': case 'F': case 'w': case 'g': case 'R':
      paintVillage(x, ch, tx, ty, mapId, t, at); break;
    default:
      px(x, tx * TILE, ty * TILE, TILE, TILE, '#4f8a46');
  }
}

// Objetos altos (dibujados por encima del suelo, con orden por fila)
export function isTallTile(ch: string): boolean {
  return ch === 't' || ch === 'p';
}

export function drawTallTile(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number, mapId: string,
  at?: NeighborFn,
): void {
  paintTall(x, ch, tx, ty, mapId, at);
}

// Árbol cortado en el pasado (diffs usan '.')
export const SOLID_CHARS = new Set(['t', 'p', '#', 'H', 'r', 'F', 'R', 'w', 'g', 'P', 'A', 'V', '~', 'd', 'x', 'n']);
