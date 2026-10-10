// ============================================================
// ECOS DE AELTHAR — BIOMA: COSTA DE BRUMA (18-a · revisualización integral)
// ============================================================
// Revisualización profesional del mapa 'costa' (52×40, maps_expansion.ts).
// Todo PROCEDURAL en canvas, determinista (mulberry32 + hash2, semillas
// fijas — CERO Math.random en caminos de render). El detalle estático se
// PRE-RASTERIZA una vez en install() y se repite idéntico entre visitas;
// lo animado por frame es O(viewport) y no asigna (globalAlpha + colores
// constantes, sin strings rgba por frame, sin canvases nuevos por frame).
//
// CAPAS QUE AÑADE:
//  · Terreno enriquecido (canvas estático 832×640 alineado al ground):
//    arena húmeda con bandas de marea, brillo especular base, charcos de
//    marea (tide pools) con cuenca pre-rasterizada, cantos rodados, algas,
//    estrellas de mar, conchas, sombreado y grietas de acantilados ('R'/'#'),
//    tablones del muelle desgastados ('B'/'x') y restos del naufragio
//    (tablones rotos + quilla) alrededor de wreck_co (41,22).
//  · Animación de orilla (por frame, solo viewport): líneas de espuma que
//    avanzan y retroceden con seno temporal acoplado al brillo especular de
//    la arena húmeda, reflejos suaves en los tide pools y veteado mojado
//    del muelle. Todo determinista por tile (hash2) y sin allocar.
//  · BRUMA VIVA: 2 capas de bancos de niebla con parallax (0.25 / 0.55)
//    que derivan hacia el oeste, más densas cerca del agua (banda sur) y
//    del naufragio (clúster anclado a wreck_co). Opacidad baja (≤ ~0.2 por
//    blob): no tapa la jugabilidad.
//  · FARO: haz rotatorio doble (cono este+oeste) con gradiente aditivo
//    ('lighter') anclado al prop 'faro_co' LEÍDO de g.map.props (fallback
//    kind 'faro'); linterna a −34 px como lo dibuja sprites_expansion.
//    Visible de noche, atenuado de día (factor g.dayT idéntico al de
//    render.ts drawLighting/drawBiomeTint). Velocidad 0.35 rad/s = la del
//    haz pequeño del prop (coherencia).
//  · GAVIOTAS: 4 siluetas de 2 frames (alas arriba/abajo, pre-rasterizadas)
//    cruzando el cielo en circuitos cerrados con oleaje visual (bob seno) y
//    «llamada» periódica dibujada como arcos concéntricos (solo dibujo).
//  · NAUFRAGIO: destello ocasional del casco bajo el agua (ciclo 6.5 s,
//    determinista) + los restos estáticos del raster.
//
// PRESUPUESTO: nada de canvases nuevos por frame; arrays de longitud FIJA
// creados en install (pools ≤ 14 · blobs 15 · gulls 4 — sin pool de
// partículas dinámicas, todo es posición derivada de fases temporales).
// No toca tiles sólidos, ni spawns, ni colisiones, ni gameplay: 100% visual.
// ============================================================
//
// -------------------- CABLEADO PARA EL INTEGRADOR (nombres exactos) --------------------
//
// (1) render.ts · imports (línea ~17, junto a `import { drawWorldLife } from './worldlife';`):
//       import { drawCostaBiomaGround, drawCostaBiomaOverlay } from './biomas_costa'; // 18-a: Costa de Bruma
//
// (2) render.ts · función drawWorld · línea 82 (justo DESPUÉS de `drawWaterGlints(g, sx, sy);`
//     y antes del bloque `ctx.save(); ctx.filter = ...` de entidades):
//       drawCostaBiomaGround(g, sx, sy); // 18-a: detalle de terreno + espuma + charcos (BAJO entidades)
//
// (3) render.ts · función drawWorld · línea 156 (justo DESPUÉS de `drawAmbient(g, 'sky');`
//     y ANTES de `drawFloats(g, sx, sy);` — sobre la iluminación, como el cielo):
//       drawCostaBiomaOverlay(g); // 18-a: bruma viva (2 capas parallax) + haz del faro + gaviotas + destello del naufragio
//
// (4) engine.ts · import (línea ~23, junto al resto de imports de módulos):
//       import { costaBiomaTick } from './biomas_costa'; // 18-a: Costa de Bruma
//     engine.ts · Game.update() · línea ~256 (tras `armorTick(this, dt);`, junto a los demás
//     ticks de módulos; corre en play/dialogue):
//       costaBiomaTick(this, dt); // 18-a: fases temporales de la Costa de Bruma (bruma/haz/gaviotas)
//
// (5) initCostaBioma() — OPCIONAL: el módulo se AUTO-INSTALA (idempotente) en el primer
//     tick/draw. Si se quiere rasterizar en el boot exacto: llamar initCostaBioma() una vez
//     dentro de initGame() (engine.ts, línea ~1994). Sin ella todo funciona igual.
//
// Nada más: este módulo NO edita render.ts/update.ts/engine.ts/maps*/world/* ni sprites*.
// ----------------------------------------------------------------------------------------
// ============================================================

import type { Game } from './engine';
import { MAPS, TILE, VIEW_W, VIEW_H, ZOOM, tileAt } from './engine';
import { px, PAL } from './world/palette';

/** Hash determinista 2D LOCAL (mulberry-family con Math.imul — uniforme en
 *  [0,1)). NOTA 18-a: el hash2 de world/palette.ts pierde precisión float en
 *  `(h^h>>13)*1274126177` (producto > 2^53 sin imul) y queda sesgado a
 *  [0,~0.45]: cualquier umbral >0.5 con él es código muerto. Este módulo usa
 *  su propio hash para que TODOS los gates de detalle funcionen de verdad. */
function h2(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------- paleta local (coherente con world/palette.ts) ----------------

const C = {
  // arena húmeda / marea (base existente: '#dcc590'/'#d2bb84' de drawExpansionTile)
  wetSand: '#b89e6e', wetSandDeep: '#a08655', damp: '#c9b07d',
  sheen: '#ecd9a8',       // brillo especular cálido de la arena mojada
  // charcos de marea
  poolDeep: '#3a6a94', poolHi: '#6fa2c8', poolSpark: '#eaf6ff',
  poolRim: '#dcc590', poolRimSh: '#8a6f4e', poolRock: '#6f695c',
  // cantos / conchas / algas
  pebble: PAL.pebble, pebbleDark: PAL.pebbleDark, pebbleHi: '#b8b0a0',
  shell: '#f0e8d4', star: '#d88a5a', starDark: '#b86a44',
  weed: '#4a6838', weedDark: '#3a5630', weedHi: '#5c7a44',
  // piedra/acantilado
  rockCrack: '#43424e', rockHi: '#8a8a9a', rockMoss: '#4d6a44',
  cliffShadow: '#181c28',
  // madera (muelle + naufragio)
  plank: PAL.woodMid, plankDark: PAL.woodDark, plankHi: PAL.woodLight,
  plankWet: PAL.plankWet, barnacle: '#cfc8b4',
  // bruma / cielo
  mist: '#d5e2ec', mistBlue: '#b9c9dd',
  beam: 'rgba(255,243,200,', beamMid: 'rgba(255,236,170,', beamEnd: 'rgba(255,230,150,0)',
  gull: '#454052', gullTip: '#6a6474', gullBeak: '#e0a83c', call: '#e8eef4',
  hull: '#dfeef8', foam: PAL.foam, foamWash: PAL.foamWash,
} as const;

/** Filtro de época — espejo EXACTO de WORLD_FILTER en render.ts (mismo tinte
 *  que el suelo para que el detalle estático no desentone por época). */
const EPOCH_FILTER: Record<string, string> = {
  presente: 'saturate(0.74) contrast(0.98)',
  pasado: 'saturate(1.35) brightness(1.1)',
};

// ---------------- RNG determinista (mulberry32, semillas fijas) ----------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- estado del módulo (instalación única, arrays fijos) ----------------

interface Pool { tx: number; ty: number; x: number; y: number; r: number; ph: number }
interface Blob { seed: number; y: number; sc: number; sp: number; a: number; ph: number; v: number }
interface Gull { x0: number; y0: number; sp: number; ph: number; sc: number }

interface CostaState {
  installed: boolean;
  builds: number;                 // cuántas veces se HA construido (1 aunque llamen N)
  t: number;                      // fase temporal acumulada por costaBiomaTick
  ticked: boolean;                // fallback a g.globalT si el integrador aún no cablea el tick
  beamA: number;                  // ángulo del haz (rad)
  staticCv: HTMLCanvasElement | null;
  mistCv: HTMLCanvasElement[];
  gullCv: HTMLCanvasElement[];
  pools: Pool[];                  // longitud fija ≤ POOL_CAP
  blobsFar: Blob[];               // longitud fija 6
  blobsNear: Blob[];              // longitud fija 9 (3 ancladas al naufragio)
  gulls: Gull[];                  // longitud fija 4
}

const POOL_CAP = 14;              // «caps de partículas ≤24»: aquí 14 cuencas fijas
const S: CostaState = {
  installed: false, builds: 0, t: 0, ticked: false, beamA: 0,
  staticCv: null, mistCv: [], gullCv: [], pools: [],
  blobsFar: [], blobsNear: [], gulls: [],
};

function mkCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

/** Fase temporal efectiva: la del tick si ya corre; si no, la global (robusto). */
function curT(g: Game): number {
  return S.ticked ? S.t : g.globalT;
}

function isSolidRock(ch: string): boolean {
  return ch === 'R' || ch === '#';
}

// ============================================================
// INSTALACIÓN — pre-rasterizado estático (UNA vez, determinista)
// ============================================================

/** Rasteriza TODO el detalle estático del bioma sobre un ctx 1× (832×640).
 *  Usa SOLO fillRect/save/translate/rotate + fillStyle/globalAlpha: así el
 *  smoke puede reconstruirlo sobre un ctx-grabador y comparar determinismo. */
function buildStatic(x: CanvasRenderingContext2D): void {
  const map = MAPS.costa;
  const W = map.w, H = map.h;
  const rows = map.rows;

  // tiles ocupados por objetos (props/cofres/npcs/ecos): no poner charcos debajo
  const busy = new Set<string>();
  for (const pr of map.props) busy.add(pr.x + ',' + pr.y);
  for (const ch of map.chests) busy.add(ch.x + ',' + ch.y);
  for (const ec of map.echoes) busy.add(ec.x + ',' + ec.y);

  const chAt = (tx: number, ty: number): string =>
    (ty < 0 || ty >= H || tx < 0 || tx >= W) ? 'V' : rows[ty][tx];
  const nearWater = (tx: number, ty: number, d: number): boolean => {
    for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) {
      if (chAt(tx + i, ty + j) === '~') return true;
    }
    return false;
  };

  // ---------- PASO A · acantilados: sombra proyectada + grietas + musgo ----------
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const ch = chAt(tx, ty);
      if (isSolidRock(ch)) {
        // grieta vertical determinista en la cara de la roca
        const r = h2(tx * 7 + 1, ty * 13 + 5);
        if (r > 0.62) {
          const x0 = tx * TILE + 2 + Math.floor(h2(tx, ty * 3) * 11);
          let y0 = ty * TILE + 2;
          const segs = 2 + Math.floor(r * 3);
          x.globalAlpha = 0.55;
          for (let k = 0; k < segs; k++) {
            px(x, x0 + (k % 2 === 0 ? 0 : 1), y0, 1, 4, C.rockCrack);
            y0 += 4;
          }
          x.globalAlpha = 1;
        }
        // musgo apagado en la base de la roca si abajo hay tierra
        if (!isSolidRock(chAt(tx, ty + 1)) && chAt(tx, ty + 1) !== '~') {
          const r2 = h2(tx * 3 + 9, ty * 5 + 2);
          x.globalAlpha = 0.5;
          px(x, tx * TILE + 2 + Math.floor(r2 * 10), ty * TILE + TILE - 3, 3, 1, C.rockMoss);
          if (r2 > 0.5) px(x, tx * TILE + 9 - Math.floor(r2 * 5), ty * TILE + TILE - 2, 2, 1, C.rockMoss);
          x.globalAlpha = 1;
        }
        continue;
      }
      if (ch === '~' || ch === 'B' || ch === 'x') continue;
      // sombra que proyecta la pared de roca sobre el suelo transitable
      if (isSolidRock(chAt(tx, ty - 1))) {
        x.globalAlpha = 0.30; px(x, tx * TILE, ty * TILE, TILE, 3, C.cliffShadow);
        x.globalAlpha = 0.16; px(x, tx * TILE, ty * TILE + 3, TILE, 3, C.cliffShadow);
        x.globalAlpha = 1;
      }
      if (isSolidRock(chAt(tx - 1, ty))) {
        x.globalAlpha = 0.18; px(x, tx * TILE, ty * TILE, 3, TILE, C.cliffShadow);
        x.globalAlpha = 1;
      }
      if (isSolidRock(chAt(tx + 1, ty))) {
        x.globalAlpha = 0.12; px(x, tx * TILE + TILE - 2, ty * TILE, 2, TILE, C.cliffShadow);
        x.globalAlpha = 1;
      }
    }
  }

  // ---------- PASO B · arena: bandas de marea húmeda + brillo base ----------
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const ch = chAt(tx, ty);
      if (ch !== 's') continue;
      const down = chAt(tx, ty + 1), right = chAt(tx + 1, ty);
      const up = chAt(tx, ty - 1), left = chAt(tx - 1, ty);
      const lvl1 = down === '~' || right === '~' || up === '~' || left === '~';
      const lvl2 = !lvl1 && nearWater(tx, ty, 2);
      const px0 = tx * TILE, py0 = ty * TILE;
      if (lvl1) {
        x.globalAlpha = 0.34; px(x, px0, py0, TILE, TILE, C.wetSand);
        // franja profunda pegada al agua (lado del vecino '~')
        if (down === '~') { x.globalAlpha = 0.30; px(x, px0, py0 + 10, TILE, 6, C.wetSandDeep); }
        if (right === '~') { x.globalAlpha = 0.30; px(x, px0 + 10, py0, 6, TILE, C.wetSandDeep); }
        if (up === '~') { x.globalAlpha = 0.30; px(x, px0, py0, TILE, 6, C.wetSandDeep); }
        if (left === '~') { x.globalAlpha = 0.30; px(x, px0, py0, 6, TILE, C.wetSandDeep); }
        // romper el canto cuadrado de la banda húmeda: dithering en el lado opuesto al agua
        x.globalAlpha = 0.5;
        if (down === '~') for (let i = 0; i < 5; i++) {
          px(x, px0 + Math.floor(h2(tx * 5 + i, ty) * 16), py0 + Math.floor(h2(tx, ty * 7 + i) * 3), 1, 1, C.damp);
        }
        if (up === '~') for (let i = 0; i < 5; i++) {
          px(x, px0 + Math.floor(h2(tx * 7 + i, ty * 3) * 16), py0 + 13 + Math.floor(h2(tx * 3, ty + i) * 3), 1, 1, C.damp);
        }
        if (left === '~') for (let i = 0; i < 5; i++) {
          px(x, px0 + 13 + Math.floor(h2(tx * 11, ty + i) * 3), py0 + Math.floor(h2(tx + i, ty * 5) * 16), 1, 1, C.damp);
        }
        if (right === '~') for (let i = 0; i < 5; i++) {
          px(x, px0 + Math.floor(h2(tx * 13, ty * 9 + i) * 3), py0 + Math.floor(h2(tx * 9 + i, ty) * 16), 1, 1, C.damp);
        }
        // brillo especular base (el parpadeo fino va por frame)
        for (let k = 0; k < 3; k++) {
          const hx = h2(tx * 5 + k * 11, ty * 7 + k * 3);
          const hy = h2(tx * 11 + k, ty * 5 + k * 13);
          x.globalAlpha = 0.4;
          px(x, px0 + 2 + Math.floor(hx * 10), py0 + 2 + Math.floor(hy * 12), 3 + Math.floor(hx * 3), 1, C.sheen);
        }
        x.globalAlpha = 1;
      } else if (lvl2) {
        x.globalAlpha = 0.14; px(x, px0, py0, TILE, TILE, C.damp);
        if (h2(tx * 13 + 2, ty * 3 + 8) > 0.6) {
          x.globalAlpha = 0.3;
          px(x, px0 + 3 + Math.floor(h2(tx, ty * 9) * 9), py0 + 4 + Math.floor(h2(tx * 9, ty) * 9), 3, 1, C.sheen);
        }
        x.globalAlpha = 1;
      } else {
        // arena seca: ondulaciones de viento (2 guiones suaves por tile)
        for (let k = 0; k < 2; k++) {
          const ry = py0 + 3 + k * 6 + Math.floor(h2(tx * 3 + k, ty * 7) * 4);
          x.globalAlpha = 0.16;
          px(x, px0 + 1 + Math.floor(h2(tx + k, ty * 3) * 4), ry, 7 + Math.floor(h2(tx * 5, ty + k) * 6), 1, '#cbb078');
          x.globalAlpha = 0.10;
          px(x, px0 + 2 + Math.floor(h2(tx * 7, ty + k * 3) * 5), ry + 1, 5, 1, '#bfa575');
        }
        x.globalAlpha = 1;
      }
    }
  }

  // ---------- PASO C · charcos de marea (cuenca estática + registro animable) ----------
  S.pools.length = 0;
  for (let ty = 2; ty < H - 1; ty++) {
    for (let tx = 2; tx < W - 1; tx++) {
      if (S.pools.length >= POOL_CAP) break;
      const ch = chAt(tx, ty);
      if (ch !== 's' || busy.has(tx + ',' + ty)) continue;
      if (chAt(tx, ty + 1) !== '~' && chAt(tx + 1, ty) !== '~') continue; // pegado al agua
      if (chAt(tx, ty) === '=' || chAt(tx - 1, ty) === '=' || chAt(tx, ty - 1) === '=') continue;
      const gate = h2(tx * 3 + 7, ty * 5 + 11);
      if (gate < 0.80) continue;
      let far = false;
      for (const p of S.pools) {
        if (Math.abs(p.tx - tx) < 3 && Math.abs(p.ty - ty) < 3) { far = true; break; }
      }
      if (far) continue;
      const r = 3 + Math.floor(h2(tx * 9, ty * 7) * 3);      // radio 3-5
      const cx = px0of(tx) + 4 + Math.floor(h2(tx * 5, ty * 11) * (TILE - 8 - r));
      const cy = px0of(ty) + 4 + Math.floor(h2(tx * 11, ty * 3) * (TILE - 8 - r));
      // cuenca: bandas horizontales de radio variable (pixel-art, sin paths)
      const prof = [Math.floor(r * 0.5), r, r + 1, r + 1, r, Math.floor(r * 0.5)];
      x.globalAlpha = 1;
      px(x, cx - prof[0] - 1, cy - 3, prof[0] * 2 + 2, 1, C.poolRim);       // labio superior iluminado
      for (let k = 0; k < prof.length; k++) {
        px(x, cx - prof[k], cy + k - 2, prof[k] * 2, 1, k === 0 ? C.poolHi : C.poolDeep);
      }
      px(x, cx - prof[5] - 1, cy + 3, prof[5] * 2 + 2, 1, C.poolRimSh);     // labio inferior en sombra
      // piedritas dentro del charco
      x.globalAlpha = 0.8;
      px(x, cx - 1 + Math.floor(h2(tx, ty * 17) * 3), cy, 2, 1, C.poolRock);
      x.globalAlpha = 1;
      S.pools.push({ tx, ty, x: cx, y: cy, r, ph: h2(tx * 7, ty * 13) * 6.283 });
    }
  }

  // ---------- PASO D · cantos rodados, algas, estrellas y restos finos ----------
  for (let ty = 2; ty < H - 2; ty++) {
    for (let tx = 2; tx < W - 2; tx++) {
      const ch = chAt(tx, ty);
      if (ch !== 's' && ch !== '.' && ch !== ',') continue;
      if (!nearWater(tx, ty, 3)) continue;
      const px0 = px0of(tx), py0 = px0of(ty);
      const r1 = h2(tx * 17 + 3, ty * 23 + 5);
      const r2 = h2(tx * 29 + 1, ty * 19 + 7);
      if (r1 > 0.86) { // cúmulo de cantos rodados
        const n = 3 + Math.floor(r2 * 3);
        for (let k = 0; k < n; k++) {
          const ox = px0 + 1 + Math.floor(h2(tx * 7 + k * 5, ty * 3 + k) * (TILE - 4));
          const oy = py0 + 1 + Math.floor(h2(tx * 3 + k, ty * 7 + k * 5) * (TILE - 4));
          x.globalAlpha = 0.9;
          px(x, ox, oy, 2, 1, k % 2 === 0 ? C.pebble : C.pebbleDark);
          px(x, ox, oy - 1, 1, 1, C.pebbleHi);
          x.globalAlpha = 0.35;
          px(x, ox, oy + 1, 2, 1, C.cliffShadow);
          x.globalAlpha = 1;
        }
      } else if (ch === 's' && r2 > 0.86) { // mata de alga varada: montón BAJO, no exclamación
        const ox = px0 + 3 + Math.floor(r1 * 8), oy = py0 + 6 + Math.floor(h2(tx * 3, ty) * 6);
        px(x, ox, oy, 4, 1, C.weedDark);          // base tumbada
        px(x, ox + 1, oy - 1, 2, 1, C.weed);      // mata
        px(x, ox + 3, oy - 1, 1, 1, C.weed);
        px(x, ox + 2, oy - 2, 1, 1, C.weedHi);    // brizna que escapa
        if (r1 > 0.93) { px(x, ox - 2, oy, 2, 1, C.weedDark); px(x, ox - 1, oy - 1, 1, 1, C.weed); }
      } else if (ch === 's' && r2 < 0.022) { // estrella de mar (rara, tono apagado)
        const ox = px0 + 5 + Math.floor(r1 * 6), oy = py0 + 5 + Math.floor(h2(tx, ty) * 6);
        x.globalAlpha = 0.9;
        px(x, ox, oy - 1, 1, 3, '#cf9a70'); px(x, ox - 1, oy, 3, 1, '#cf9a70');
        px(x, ox, oy, 1, 1, '#b8764e');
        x.globalAlpha = 1;
      }
    }
  }

  // ---------- PASO E · muelle desgastado ('B' tablones · 'x' pilares) ----------
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const ch = chAt(tx, ty);
      if (ch !== 'B' && ch !== 'x') continue;
      const px0 = px0of(tx), py0 = px0of(ty);
      // veta desgastada a lo largo de los tablones (horizontales)
      for (let k = 0; k < 3; k++) {
        const hy = py0 + 2 + k * 4 + Math.floor(h2(tx * 5 + k, ty * 9) * 3);
        const hx = px0 + Math.floor(h2(tx * 11 + k * 3, ty * 5) * 6);
        const len = 4 + Math.floor(h2(tx * 3 + k, ty * 13 + k) * 6);
        x.globalAlpha = 0.5;
        px(x, hx, hy, len, 1, C.plankDark);
        x.globalAlpha = 0.35;
        px(x, hx + 1, hy - 1, Math.max(2, len - 2), 1, C.plankHi);
        x.globalAlpha = 1;
      }
      // bertinas/barnacles en el canto que mira al agua + madera remojada
      if (chAt(tx, ty + 1) === '~') {
        x.globalAlpha = 0.42; px(x, px0, py0 + TILE - 2, TILE, 2, C.plankWet); x.globalAlpha = 1;
        for (let k = 0; k < 3; k++) {
          if (h2(tx * 7 + k * 13, ty * 3 + k) < 0.6) continue;
          px(x, px0 + 1 + Math.floor(h2(tx + k, ty * 5 + k) * 13), py0 + TILE - 3, 1, 1, C.barnacle);
        }
      }
      if (chAt(tx - 1, ty) === '~') { x.globalAlpha = 0.42; px(x, px0, py0, 2, TILE, C.plankWet); x.globalAlpha = 1; }
      if (chAt(tx + 1, ty) === '~') { x.globalAlpha = 0.42; px(x, px0 + TILE - 2, py0, 2, TILE, C.plankWet); x.globalAlpha = 1; }
    }
  }

  // ---------- PASO F · naufragio (wreck_co 41,22): tablones rotos + quilla ----------
  const rng = mulberry32(18412); // semilla fija del bioma costa
  const wcx = 41, wcy = 22;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = wcx + dx, ty = wcy + dy;
      const ch = chAt(tx, ty);
      if (ch === 'V' || ch === '~') continue;   // los restos flotantes van aparte
      if (isSolidRock(ch) || ch === '=' || ch === 'B' || ch === 'x') continue;
      if (dx === 0 && dy === 0) continue;       // el casco lo dibuja sprites_expansion
      const gate = rng();
      if (gate > 0.55) continue;
      const cx = tx * TILE + 3 + Math.floor(rng() * (TILE - 8));
      const cy = ty * TILE + 3 + Math.floor(rng() * (TILE - 8));
      // tablón roto (largo variable, ángulo determinista ±0.35 rad)
      x.save();
      x.translate(cx + 4, cy + 1);
      x.rotate((rng() - 0.5) * 0.7);
      const len = 6 + Math.floor(rng() * 7);
      x.globalAlpha = 0.95;
      px(x, -len / 2, 0, len, 2, C.plank);
      px(x, -len / 2, 0, len, 1, C.plankHi);
      px(x, -len / 2, 2, len, 1, C.plankDark);
      if (rng() > 0.5) px(x, len / 2 - 2, 0, 2, 2, C.plankWet); // punta empapada
      x.globalAlpha = 1;
      x.restore();
    }
  }
  // quilla semihundida: costillas curvadas de madera mojada hacia el agua
  for (let k = 0; k < 4; k++) {
    const bx = (wcx - 1) * TILE + 2 + k * 9;
    const by = (wcy + 1) * TILE + 6 + (k % 2) * 3;
    x.globalAlpha = 0.85;
    px(x, bx, by, 3, 2, C.plankWet);
    px(x, bx + 2, by - 2, 2, 2, C.plankDark);
    px(x, bx + 3, by - 4, 2, 2, C.plankWet);
    x.globalAlpha = 0.4;
    px(x, bx, by + 2, 4, 1, C.cliffShadow);
    x.globalAlpha = 1;
  }
  // restos flotantes estáticos sobre el agua pegada al naufragio
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = 0; dx <= 3; dx++) {
      const tx = wcx + dx, ty = wcy + dy;
      if (chAt(tx, ty) !== '~') continue;
      const g2 = h2(tx * 31 + 7, ty * 17 + 3);
      if (g2 < 0.62) continue;
      const fx = tx * TILE + 2 + Math.floor(g2 * 8), fy = ty * TILE + 3 + Math.floor(h2(tx, ty * 7) * 10);
      px(x, fx, fy, 6, 2, C.plankDark);
      px(x, fx, fy, 6, 1, C.plank);
      px(x, fx - 1, fy + 1, 1, 1, C.foam); px(x, fx + 6, fy + 1, 1, 1, C.foam);
    }
  }
}

function px0of(t: number): number { return t * TILE; }

// ---------- sprites pre-rasterizados: bancos de bruma y gaviotas ----------

function buildMist(variant: number): HTMLCanvasElement | null {
  const cv = mkCanvas(150, 40);
  if (!cv) return null;
  const x = cv.getContext('2d')!;
  const rng = mulberry32(7700 + variant * 131);
  x.globalAlpha = 0.22;
  x.fillStyle = variant % 2 === 0 ? C.mist : C.mistBlue;
  x.beginPath(); x.ellipse(75, 24, 66, 11, 0, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 0.18;
  x.beginPath(); x.ellipse(58 + variant * 6, 18, 40, 8, 0, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 0.16;
  x.beginPath(); x.ellipse(96 - variant * 4, 27, 34, 6, 0, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 0.12;
  x.beginPath(); x.ellipse(75, 13, 26, 5, 0, 0, Math.PI * 2); x.fill();
  // dientes de dithering en los bordes (lenguaje pixel-art, no blur)
  x.globalAlpha = 0.10;
  for (let k = 0; k < 14; k++) {
    const ox = 12 + rng() * 126, oy = rng() < 0.5 ? 8 + rng() * 6 : 30 + rng() * 6;
    x.fillRect(Math.floor(ox), Math.floor(oy), 2 + Math.floor(rng() * 3), 1);
  }
  x.globalAlpha = 1;
  return cv;
}

function buildGull(frame: number): HTMLCanvasElement | null {
  const cv = mkCanvas(18, 10);
  if (!cv) return null;
  const x = cv.getContext('2d')!;
  // cuerpo + cola + cabeza (silueta 1×, se dibuja ×ZOOM×sc)
  px(x, 6, 4, 6, 2, C.gull);
  px(x, 3, 5, 3, 1, C.gull);
  px(x, 12, 3, 2, 2, C.gull);
  px(x, 14, 4, 1, 1, C.gullBeak);
  if (frame === 0) { // alas arriba
    px(x, 5, 3, 2, 1, C.gull); px(x, 3, 2, 2, 1, C.gull); px(x, 1, 1, 2, 1, C.gullTip);
    px(x, 11, 3, 2, 1, C.gull); px(x, 13, 2, 2, 1, C.gull); px(x, 15, 1, 2, 1, C.gullTip);
  } else { // alas abajo
    px(x, 5, 5, 2, 1, C.gull); px(x, 3, 6, 2, 1, C.gull); px(x, 1, 7, 2, 1, C.gullTip);
    px(x, 11, 5, 2, 1, C.gull); px(x, 13, 6, 2, 1, C.gull); px(x, 15, 7, 2, 1, C.gullTip);
  }
  return cv;
}

function install(): void {
  if (S.installed) return;
  S.installed = true;
  S.builds++;
  // raster estático del terreno (idéntico entre visitas)
  const cv = mkCanvas(MAPS.costa.w * TILE, MAPS.costa.h * TILE);
  if (cv) {
    const x = cv.getContext('2d')!;
    x.imageSmoothingEnabled = false;
    buildStatic(x);
    S.staticCv = cv;
  }
  // bancos de bruma (3 variantes) y gaviotas (2 frames)
  S.mistCv.length = 0;
  for (let v = 0; v < 3; v++) {
    const m = buildMist(v);
    if (m) S.mistCv.push(m);
  }
  S.gullCv.length = 0;
  for (let f = 0; f < 2; f++) {
    const gl = buildGull(f);
    if (gl) S.gullCv.push(gl);
  }
  // bancos de bruma: parámetros fijos (derivación = f(seed, t), sin estado mutable)
  const rng = mulberry32(90210);
  S.blobsFar.length = 0;
  for (let i = 0; i < 6; i++) {
    S.blobsFar.push({
      seed: rng() * 1800, y: (14 + rng() * 10) * TILE, sc: 1.25 + rng() * 0.5,
      sp: 5 + rng() * 3, a: 0.10 + rng() * 0.05, ph: rng() * 6.283, v: i % 3,
    });
  }
  S.blobsNear.length = 0;
  for (let i = 0; i < 4; i++) { // banda sur = agua (más denso cerca del mar)
    S.blobsNear.push({
      seed: rng() * 1800, y: (32.5 + rng() * 6) * TILE, sc: 0.9 + rng() * 0.4,
      sp: 9 + rng() * 5, a: 0.13 + rng() * 0.06, ph: rng() * 6.283, v: i % 3,
    });
  }
  for (let i = 0; i < 2; i++) { // franja media costera
    S.blobsNear.push({
      seed: rng() * 1800, y: (24 + rng() * 7) * TILE, sc: 0.9 + rng() * 0.4,
      sp: 8 + rng() * 5, a: 0.12 + rng() * 0.05, ph: rng() * 6.283, v: (i + 1) % 3,
    });
  }
  for (let i = 0; i < 3; i++) { // clúster anclado al naufragio (41,22)
    S.blobsNear.push({
      seed: 41 * TILE - 70 + i * 55 + rng() * 20, y: (20.5 + rng() * 3.5) * TILE,
      sc: 0.75 + rng() * 0.3, sp: 3 + rng() * 2.5, a: 0.15 + rng() * 0.05,
      ph: rng() * 6.283, v: (i + 2) % 3,
    });
  }
  // gaviotas: 4 circuitos fijos (2 lejanas pequeñas, 2 cercanas)
  S.gulls.length = 0;
  for (let i = 0; i < 4; i++) {
    const far = i < 2;
    S.gulls.push({
      x0: rng() * 1800, y0: (4 + rng() * (far ? 14 : 16)) * TILE,
      sp: (far ? 20 + rng() * 8 : 30 + rng() * 10) * (rng() > 0.5 ? 1 : -1),
      ph: rng() * 6.283, sc: far ? 0.6 : 1,
    });
  }
}

/** Punto de instalación público (idempotente). Ver cabecera: cableado opcional. */
export function initCostaBioma(): void {
  install();
}

// ============================================================
// TICK — avanza fases temporales (O(1), sin asignaciones)
// ============================================================

/** Integrador: engine.ts · Game.update() (ver cabecera, punto 4). */
export function costaBiomaTick(g: Game, dt: number): void {
  if (g.mapId !== 'costa') return;
  install(); // auto-instalación perezosa idempotente
  S.ticked = true;
  S.t = Math.min(S.t + dt, 86400);          // cap anti-deriva de float
  S.beamA = (S.beamA + dt * 0.35) % (Math.PI * 2); // 0.35 rad/s = haz del prop
}

// ============================================================
// CAPA DE TERRENO — estático + animación de orilla (BAJO entidades)
// ============================================================

/** Integrador: render.ts · drawWorld · tras drawWaterGlints (ver cabecera, punto 2). */
export function drawCostaBiomaGround(
  g: Game, sx?: (n: number) => number, sy?: (n: number) => number,
): void {
  if (g.mapId !== 'costa' || !S.installed || !S.staticCv) return;
  const ctx = g.ctx;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const t = curT(g);

  // --- 1) blit del raster estático, misma matemática de fuente que el ground ---
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.filter = EPOCH_FILTER[g.epoch] ?? 'none';
  const gx = Math.floor(camX / ZOOM), gy = Math.floor(camY / ZOOM);
  ctx.drawImage(S.staticCv, gx, gy, VIEW_W / ZOOM, VIEW_H / ZOOM, 0, 0, VIEW_W, VIEW_H);
  ctx.restore();

  const sxp = sx ?? ((wx: number) => wx * ZOOM - camX);
  const syp = sy ?? ((wy: number) => wy * ZOOM - camY);
  const map = g.map;

  // --- 2) orilla animada: espuma que avanza/retrocede + brillo de arena mojada ---
  const tx0 = Math.max(0, Math.floor(camX / (TILE * ZOOM)) - 1);
  const ty0 = Math.max(0, Math.floor(camY / (TILE * ZOOM)) - 1);
  const tx1 = Math.min(map.w - 1, Math.ceil((camX + VIEW_W) / (TILE * ZOOM)));
  const ty1 = Math.min(map.h - 1, Math.ceil((camY + VIEW_H) / (TILE * ZOOM)));
  ctx.fillStyle = C.foam;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = tileAt(map, g.rows, tx, ty, g.epoch);
      if (ch === '~') {
        // espuma SOLO en el borde que toca arena (orilla sur y este)
        const up = tileAt(map, g.rows, tx, ty - 1, g.epoch);
        const left = tileAt(map, g.rows, tx - 1, ty, g.epoch);
        if (up !== 's' && left !== 's') continue;
        const ph = h2(tx, ty) * 6.283;
        const adv = Math.sin(t * 0.9 + ph);                 // −1 retira · +1 avanza
        // línea principal de espuma (dash que marcha despacio)
        if (up === 's') {
          // lámina CONTINUA de la orilla: garantiza lectura de espuma en la línea de costa
          ctx.globalAlpha = 0.28 + 0.20 * (0.5 + 0.5 * adv);
          ctx.fillRect(Math.round(sxp(tx * TILE)), Math.round(syp(ty * TILE + 1 + adv * 1.2)), TILE, 1);
          const fy = ty * TILE + 2 + adv * 2.4;
          ctx.globalAlpha = 0.5 + 0.28 * adv;
          const march = (t * 5 + h2(tx * 3, ty) * 12) % 16;
          for (let k = 0; k < 3; k++) {
            const dx = k * 6 + march * 0.4 + h2(tx + k, ty) * 2;
            if (dx > TILE - 2) continue;
            ctx.fillRect(Math.round(sxp(tx * TILE + dx)), Math.round(syp(fy)), 5, 1);
          }
          // lavado secundario (foamWash) con retardo de fase
          ctx.fillStyle = C.foamWash;
          ctx.globalAlpha = 0.28 + 0.14 * Math.sin(t * 0.9 + ph + 1.1);
          const fy2 = ty * TILE + 4 + Math.sin(t * 0.9 + ph + 1.1) * 2.6;
          for (let k = 0; k < 2; k++) {
            const dx = k * 9 + ((t * 3.4 + h2(tx, ty * 3) * 10) % 12);
            if (dx > TILE - 3) continue;
            ctx.fillRect(Math.round(sxp(tx * TILE + dx)), Math.round(syp(fy2)), 5, 1);
          }
          ctx.fillStyle = C.foam;
        }
        if (left === 's') { // orilla este: espuma vertical
          ctx.globalAlpha = 0.26 + 0.18 * (0.5 + 0.5 * adv);
          ctx.fillRect(Math.round(sxp(tx * TILE + 1 + adv * 1.2)), Math.round(syp(ty * TILE)), 1, TILE);
          const fx2 = tx * TILE + 2 + adv * 2.4;
          ctx.globalAlpha = 0.45 + 0.25 * adv;
          const march = (t * 4 + h2(tx, ty * 5) * 10) % 14;
          for (let k = 0; k < 3; k++) {
            const dy2 = k * 5 + march * 0.35 + h2(tx, ty + k) * 2;
            if (dy2 > TILE - 2) continue;
            ctx.fillRect(Math.round(sxp(fx2)), Math.round(syp(ty * TILE + dy2)), 1, 4);
          }
        }
      } else if (ch === 's') {
        // brillo especular de la arena mojada: se ENCIENDE cuando la ola retira
        // (misma fase que la espuma del tile de agua vecino → acoplado)
        const below = tileAt(map, g.rows, tx, ty + 1, g.epoch);
        const right = tileAt(map, g.rows, tx + 1, ty, g.epoch);
        if (below !== '~' && right !== '~') continue;
        const pw = below === '~' ? [tx, ty + 1] : [tx + 1, ty];
        const ph = h2(pw[0], pw[1]) * 6.283;             // fase del vecino de agua
        const adv = Math.sin(t * 0.9 + ph);
        ctx.fillStyle = C.sheen;
        ctx.globalAlpha = 0.05 + 0.15 * (0.5 - 0.5 * adv);  // retira → más brillo
        for (let k = 0; k < 3; k++) {
          const hy = ty * TILE + 2 + k * 5 + Math.cos(t * 1.2 + ph + k) * 1.4;
          const hx = tx * TILE + 2 + h2(tx * 3 + k, ty * 7 + k) * 8;
          ctx.fillRect(Math.round(sxp(hx)), Math.round(syp(hy)), 3 + Math.floor(h2(tx + k, ty) * 4), 1);
        }
        ctx.fillStyle = C.foam;
      }
    }
  }
  ctx.globalAlpha = 1;

  // --- 3) tide pools: reflejo animado suave sobre la cuenca estática ---
  ctx.fillStyle = C.poolHi;
  for (let i = 0; i < S.pools.length; i++) {
    const p = S.pools[i];
    if (p.tx < tx0 || p.tx > tx1 || p.ty < ty0 || p.ty > ty1) continue;
    const w1 = Math.sin(t * 0.8 + p.ph);
    ctx.globalAlpha = 0.10 + 0.14 * (0.5 + 0.5 * w1);
    const ry = p.y + w1 * 1.2;
    ctx.fillRect(Math.round(sxp(p.x - p.r * 0.5)), Math.round(syp(ry)), p.r + 2, 1);
    ctx.globalAlpha *= 0.7;
    ctx.fillRect(Math.round(sxp(p.x - p.r * 0.3)), Math.round(syp(ry + 2)), Math.max(2, p.r - 2), 1);
    if (Math.sin(t * 1.7 + p.ph * 2.7) > 0.86) { // chispa ocasional del reflejo
      ctx.fillStyle = C.poolSpark;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(Math.round(sxp(p.x + Math.cos(p.ph) * p.r * 0.4)), Math.round(syp(ry - 1)), 1, 1);
      ctx.fillStyle = C.poolHi;
    }
  }

  // --- 4) muelle: veteado mojado animado sobre tablones visibles ---
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tileAt(map, g.rows, tx, ty, g.epoch) !== 'B') continue;
      ctx.fillStyle = C.plankHi;
      ctx.globalAlpha = 0.08 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.1 + h2(tx, ty) * 6.283));
      ctx.fillRect(Math.round(sxp(tx * TILE)), Math.round(syp(ty * TILE + 1)), TILE, 1);
      // espuma lamiento el canto sur si el tablón mira al agua (muelle del ayer)
      if (tileAt(map, g.rows, tx, ty + 1, g.epoch) === '~') {
        ctx.fillStyle = C.foam;
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 0.9 + h2(tx, ty + 1) * 6.283);
        ctx.fillRect(Math.round(sxp(tx * TILE + 2)), Math.round(syp((ty + 1) * TILE)), TILE - 6, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// OVERLAY — bruma viva · haz del faro · gaviotas · naufragio
// ============================================================

/** Integrador: render.ts · drawWorld · tras drawAmbient(g,'sky') (ver cabecera, punto 3). */
export function drawCostaBiomaOverlay(g: Game): void {
  if (g.mapId !== 'costa' || !S.installed) return;
  const ctx = g.ctx;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const t = curT(g);
  const worldW = MAPS.costa.w * TILE * ZOOM;
  // factor de noche idéntico a render.ts (drawLighting / drawBiomeTint)
  const dayLight = Math.max(0.1, Math.sin(g.dayT * Math.PI * 2) * 1.25 + 0.25);
  const night = 1 - Math.min(1, dayLight);
  ctx.imageSmoothingEnabled = false;

  drawMistLayers(g, ctx, t, camX, camY, worldW, night);
  drawGulls(g, ctx, t, camX, camY, worldW);
  drawFaroBeam(g, ctx, t, camX, camY, night);
  drawWreckGlint(g, ctx, t, camX, camY);
  ctx.globalAlpha = 1;
}

// ---- BRUMA VIVA: 2 capas parallax (lejana 0.25 · cercana 0.55) ----

function drawMistLayers(
  g: Game, ctx: CanvasRenderingContext2D, t: number,
  camX: number, camY: number, worldW: number, night: number,
): void {
  if (S.mistCv.length === 0) return;
  const span = worldW + 520;
  const nightK = 0.85 + night * 0.35;               // la bruma respira más de noche
  for (let layer = 0; layer < 2; layer++) {
    const blobs = layer === 0 ? S.blobsFar : S.blobsNear;
    const par = layer === 0 ? 0.25 : 0.55;
    const kMul = layer === 0 ? 0.62 : 1;
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const cv = S.mistCv[b.v % S.mistCv.length];
      const drift = (b.seed + t * b.sp) * ZOOM - camX * par;   // px pantalla
      const sxp = ((drift % span) + span) % span - 260;
      const syp = b.y * ZOOM - camY * (par * 0.7 + 0.3) + Math.sin(t * 0.3 + b.ph) * 5;
      if (sxp < -240 || sxp > VIEW_W + 40 || syp < -70 || syp > VIEW_H + 40) continue;
      const w = cv.width * b.sc, h = cv.height * b.sc;
      ctx.globalAlpha = Math.min(0.24, b.a * kMul * nightK * (0.75 + 0.25 * Math.sin(t * 0.35 + b.ph)));
      ctx.drawImage(cv, Math.round(sxp), Math.round(syp), w, h);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- GAVIOTAS: 4 circuitos · 2 frames · oleaje visual + llamada (arcos) ----

function drawGulls(
  g: Game, ctx: CanvasRenderingContext2D, t: number,
  camX: number, camY: number, worldW: number,
): void {
  if (S.gullCv.length < 2) return;
  const span = worldW + 340;
  for (let i = 0; i < S.gulls.length; i++) {
    const gl = S.gulls[i];
    const drift = (gl.x0 + t * gl.sp) * ZOOM - camX;
    const sxp = ((drift % span) + span) % span - 170;
    const syp = gl.y0 * ZOOM - camY + Math.sin(t * 1.1 + gl.ph) * 6; // oleaje visual
    if (sxp < -60 || sxp > VIEW_W + 60 || syp < -40 || syp > VIEW_H + 40) continue;
    const fr = Math.floor(t * 2.6 + gl.ph * 2) % 2;                  // aleteo ~2.6 fps
    const w = 18 * ZOOM * gl.sc, h = 10 * ZOOM * gl.sc;
    ctx.globalAlpha = gl.sc < 1 ? 0.55 : 0.85;
    ctx.drawImage(S.gullCv[fr], Math.round(sxp), Math.round(syp), w, h);
    // «llamada» periódica: arcos concéntricos que se expanden (solo dibujo)
    const cp = (t * 0.14 + gl.ph) % 1;
    if (cp < 0.18) {
      const k = cp / 0.18;
      const cxp = sxp + w * 0.55, cyp = syp + h * 0.45;
      ctx.strokeStyle = C.call;
      ctx.lineWidth = 1;
      ctx.globalAlpha = (1 - k) * 0.45;
      ctx.beginPath();
      ctx.arc(cxp, cyp, 3 + k * 9, -2.4, -0.7);
      ctx.stroke();
      if (k < 0.5) {
        ctx.globalAlpha = (0.5 - k) * 0.6;
        ctx.beginPath();
        ctx.arc(cxp, cyp, 2 + k * 5, -2.2, -0.9);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ---- FARO: haz doble rotatorio con gradiente aditivo, anclado a 'faro_co' ----

function drawFaroBeam(
  g: Game, ctx: CanvasRenderingContext2D, t: number,
  camX: number, camY: number, night: number,
): void {
  // posición leída SIEMPRE de g.map.props (nada hardcodeado)
  let fx = -1, fy = -1;
  for (const pr of g.map.props) {
    if (pr.id === 'faro_co' || pr.kind === 'faro') {
      fx = pr.x * TILE + 8; fy = pr.y * TILE + 8;
      break;
    }
  }
  if (fx < 0) return;
  const lx = fx * ZOOM - camX, ly = (fy - 34) * ZOOM - camY; // linterna (−34 px como el prop)
  if (lx < -720 || lx > VIEW_W + 720 || ly < -160 || ly > VIEW_H + 720) return;
  const ang = S.ticked ? S.beamA : t * 0.35;
  // atenuado de día, presente de noche (sin tapar: alpha máx ~0.24). DOS conos
  // anidados (núcleo estrecho + abanico ancho) para una lectura de faro, no de linterna.
  const aBase = 0.045 + night * 0.19;
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  const cone = (L: number, W1: number, a: number): void => {
    const grad = ctx.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, C.beam + (a).toFixed(3) + ')');
    grad.addColorStop(0.45, C.beamMid + (a * 0.5).toFixed(3) + ')');
    grad.addColorStop(0.8, C.beamMid + (a * 0.18).toFixed(3) + ')');
    grad.addColorStop(1, C.beamEnd);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(L, -W1); ctx.lineTo(L, W1); ctx.lineTo(0, 7);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(-L, -W1); ctx.lineTo(-L, W1); ctx.lineTo(0, 7);
    ctx.closePath(); ctx.fill();
  };
  cone(560, 112, aBase * 0.5);   // abanico ancho tenue
  cone(500, 46, aBase);          // núcleo del haz
  ctx.restore();
}

// ---- NAUFRAGIO: destello ocasional del casco bajo el agua (ciclo 6.5 s) ----

function drawWreckGlint(
  g: Game, ctx: CanvasRenderingContext2D, t: number, camX: number, camY: number,
): void {
  let wx = -1, wy = -1;
  for (const pr of g.map.props) {
    if (pr.id === 'wreck_co' || pr.kind === 'wreck') {
      wx = pr.x * TILE + 8; wy = pr.y * TILE + 8;
      break;
    }
  }
  if (wx < 0) return;
  const sxp = wx * ZOOM - camX, syp = wy * ZOOM - camY;
  if (sxp < -80 || sxp > VIEW_W + 80 || syp < -40 || syp > VIEW_H + 40) return;
  const ph = ((t / 6.5) + 0.35) % 1;
  const k = Math.sin(ph * Math.PI);
  const k3 = k * k * k;                               // destello corto, pausa larga
  if (k3 < 0.04) return;
  const wl = (wy + 12) * ZOOM - camY;                 // línea de flotación del casco
  ctx.fillStyle = C.hull;
  for (let i = 0; i < 3; i++) {
    const ox = [-15, -4, 10][i] + Math.sin(t * 2.1 + i * 2.4) * 1.5;
    const oy = [0, 3, -2][i];
    ctx.globalAlpha = k3 * 0.5;
    ctx.fillRect(Math.round(sxp + ox * ZOOM), Math.round(wl + oy * ZOOM), 3, 1);
  }
  // reflejo alargado tenue bajo la flotación
  ctx.fillStyle = C.foam;
  ctx.globalAlpha = k3 * 0.22;
  ctx.fillRect(Math.round(sxp - 18 * ZOOM), Math.round(wl + 3), 15 * ZOOM, 1);
}

// ============================================================
// GANCHOS DEV/SMOKE (no se usan en el juego; patrón __wlResetAll)
// ============================================================

/** Estado interno para el smoke: builds (1 pese a N inits) + longitudes de arrays. */
export function __costaDebug(): {
  installed: boolean; builds: number; t: number; beamA: number;
  pools: number; blobsFar: number; blobsNear: number; gulls: number;
  mistCv: number; gullCv: number;
} {
  return {
    installed: S.installed, builds: S.builds, t: S.t, beamA: S.beamA,
    pools: S.pools.length, blobsFar: S.blobsFar.length, blobsNear: S.blobsNear.length,
    gulls: S.gulls.length, mistCv: S.mistCv.length, gullCv: S.gullCv.length,
  };
}

/** Reset de fases temporales para smokes (patrón __wlResetAll de worldlife):
 *  NO toca el raster instalado ni los arrays fijos, solo fases y ticked. */
export function __costaReset(): void {
  S.t = 0; S.ticked = false; S.beamA = 0;
}

/**
 * Determinismo del raster estático: reconstruye buildStatic sobre un
 * ctx-grabador (sin canvas real) y devuelve la traza serializada de TODAS
 * las operaciones. Dos llamadas → trazas idénticas ⇒ el detalle se repite
 * igual entre visitas (sin Math.random, semillas fijas).
 */
export function __costaRasterTrace(): string {
  let s = '';
  const rec: any = {
    imageSmoothingEnabled: false,
    save: () => { s += 'S|'; },
    restore: () => { s += 'R|'; },
    translate: (a: number, b: number) => { s += 'T' + a + ',' + b + '|'; },
    rotate: (a: number) => { s += 'O' + a.toFixed(5) + '|'; },
    fillRect: (a: number, b: number, c: number, d: number) => {
      s += 'F' + a + ',' + b + ',' + c + ',' + d + '|';
    },
  };
  Object.defineProperty(rec, 'fillStyle', {
    get: function () { return rec._fs ?? ''; },
    set: function (v: string) { rec._fs = v; s += 'c' + String(v) + '|'; },
  });
  Object.defineProperty(rec, 'globalAlpha', {
    get: function () { return rec._ga ?? 1; },
    set: function (v: number) { rec._ga = v; s += 'a' + Number(v).toFixed(3) + '|'; },
  });
  buildStatic(rec as CanvasRenderingContext2D);
  return s;
}
