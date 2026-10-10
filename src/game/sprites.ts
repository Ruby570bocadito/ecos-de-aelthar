// ============================================================
// ECOS DE AELTHAR — Arte pixel procedural (núcleo)
// Cache SPR + registro + slash arc + retratos + despachador de
// tiles. Los generadores viven en src/game/actors/ y world/.
// ============================================================

import { mkCanvas, px, type Frames } from './actors/util';
import { buildHumanoid, buildAttackPoses, buildRollPoses } from './actors/humanoid';
import { buildWolf, buildGuardian } from './actors/enemies';
import { buildChest, buildSanctuary, buildFragment, buildWisp } from './actors/objects';
import { PALS } from './actors/palettes';
import { drawPortrait } from './actors/portraits';
import { paintGrass, paintPath } from './world/grass';
import { paintWater } from './world/water';
import { paintStone } from './world/stone';
import { paintVillage } from './world/village';
import { paintTall } from './world/trees';
import { px as tpx, hash2 } from './world/palette';

import { volumizeAll } from './actors/volume'; // R18: profundidad para NPCs y humanoides
export { hash2 } from './world/palette';
export type { Frames } from './actors/util';
export { frameIndex, entityFrame, type HumanPal } from './actors/humanoid';
export { drawPortrait, drawSlashArc } from './actors/portraits';

const SPR: Record<string, Frames> = {};

// R9-6 · poses de combate del Portador (contrato R3-c con render.ts):
// ATK = [anticipación, golpe] ×3 direcciones (down/up/side) · ROLL = pose
// inclinada de voltereta ×3 direcciones. Se hornean 1× en initSprites.
const ATK: Record<string, Frames> = {};
const ROLL: Record<string, Frames> = {};

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
  for (const [name, pal] of Object.entries(PALS)) {
    // R18: pase de volumen horneado (luz arriba-izquierda, sombra fría)
    SPR[name] = volumizeAll(buildHumanoid(pal), 1.3);
    ATK[name] = volumizeAll(buildAttackPoses(pal), 1.3); // R9-6
    ROLL[name] = volumizeAll(buildRollPoses(pal), 1.3);  // R9-6
  }
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

// R9-6 · poses de combate consumidas por render.ts (drawEntity, contrato R3-c).
// getAttackFrames devuelve [frameAnticipación, frameGolpe] para la dirección.
export function getAttackFrames(base: string, dir: string): HTMLCanvasElement[] | null {
  const f = ATK[base];
  if (!f || f.length < 6) return null;
  const i = dir === 'up' ? 2 : dir === 'down' ? 0 : 4;
  return [f[i], f[i + 1]];
}

// La carga del hechizo comparte la pose de anticipación (el tejedor levanta
// el instrumento igual que el golpe — se lee como canalizar el Eco).
export function getCastFrames(base: string, dir: string): HTMLCanvasElement[] | null {
  return getAttackFrames(base, dir);
}

// Pose inclinada de voltereta (1 canvas según dirección).
export function getRollFrames(base: string, dir: string): HTMLCanvasElement | null {
  const f = ROLL[base];
  if (!f || f.length < 3) return null;
  return f[dir === 'up' ? 1 : dir === 'down' ? 0 : 2];
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
    // R16: el suelo bajo los árboles ('t' frondoso / 'p' pino) caía al
    // default de verde plano → cada árbol se veía sobre un CUADRADO de otro
    // tono. Ahora recibe la misma hierba moteada procedural que sus vecinos
    // (el árbol se pinta encima en la segunda pasada de buildGround).
    case 't': case 'p':
      paintGrass(x, '.', tx, ty, mapId, t, at); break;
    // R16: el camino '=' tampoco tenía pintor fuera de costa/aldea/cumbres
    // (franja verde lisa en lunaris/bosque/ciudadela/cuna/arena).
    case '=':
      paintPath(x, tx, ty, mapId, at); break;
    // R7-Q1 #3: 'n' (Niebla Muda, bosque norte) es SÓLIDO pero caía al default
    // de hierba plana → muro invisible de 6×2 en el camino. Velo de niebla
    // determinista (hash2, sin Math.random) que delata el bloqueo.
    case 'n': {
      paintGrass(x, '.', tx, ty, mapId, t, at);
      const bx = tx * TILE, by = ty * TILE;
      tpx(x, bx, by, TILE, TILE, 'rgba(186,202,196,0.66)');
      tpx(x, bx + Math.floor(hash2(tx, ty) * 9), by + Math.floor(hash2(tx + 7, ty + 3) * 9), 6, 3, 'rgba(214,226,220,0.5)');
      tpx(x, bx + Math.floor(hash2(tx + 1, ty + 5) * 10), by + Math.floor(hash2(tx + 4, ty + 2) * 10), 4, 2, 'rgba(228,238,232,0.45)');
      tpx(x, bx + Math.floor(hash2(tx + 9, ty + 8) * 11), by + Math.floor(hash2(tx + 2, ty + 6) * 12), 3, 2, 'rgba(168,188,180,0.55)');
      break;
    }
    case '~': case 'B': case 'x':
      paintWater(x, ch, tx, ty, mapId, t, at); break;
    case ':': case '_': case '#': case 'P': case 'A': case 'V':
    case '^': case 'L': case 'D': // R10-8: pinchos/palanca/puerta de la cripta Zelda
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
