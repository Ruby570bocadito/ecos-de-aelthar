// ============================================================
// ECOS DE AELTHAR — Tiles de piedra y cripta (módulo world)
// Casos: ':' suelo piedra · '_' madera · '#' muro · 'P' pilar
//        'A' altar · 'V' vacío
// Contrato: paintStone llamada por el despachador drawTile.
//
// CLAVE ANTI-REJILLA: la geometría de losas (juntas, tonos, musgo,
// grietas) se calcula con hash en coordenadas GLOBALES de píxel,
// de modo que el patrón cruza los bordes de tile sin costuras y
// las juntas sólo aparecen ENTRE losas. Mezcla de losas grandes
// (16×16 / 24 / 32 / 48), losas partidas de 8 con juntas
// desplazadas por hash e hiladas dobles fusionadas (32 px de
// alto). Nada de bordes 1px en los 4 lados de cada tile.
// Prerrender: drawTile se llama con t=0 → todo determinista.
// ============================================================

import { hash2, px, pick, PAL, isCrypt, type NeighborFn } from './palette';

// ---------------- utilidades locales ----------------

/** Píxel suelto 1×1. */
function p1(x: CanvasRenderingContext2D, X: number, Y: number, C: string): void {
  x.fillStyle = C; x.fillRect(X, Y, 1, 1);
}

/** Dither damero 2×2 (degradado sin gradientes de canvas). */
function dither(
  x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, C: string,
): void {
  x.fillStyle = C;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (((X + i) + (Y + j)) & 1) x.fillRect(X + i, Y + j, 1, 1);
    }
  }
}

// ---------------- paleta local de piedra ----------------

type Tono = { b: string; d: string; l: string };

// Suelo: 5 tonos por clima (cuerpo b / grano oscuro d / pulido claro l)
const FLOOR_TONES: Tono[][] = [
  [ // exterior (Lunaris / Bosque): gris pardo
    { b: '#72727e', d: '#666672', l: '#84848e' },
    { b: '#6a6a76', d: '#5e5e6a', l: '#7c7c88' },
    { b: '#666672', d: '#5a5a66', l: '#787884' },
    { b: '#6e6e7a', d: '#62626e', l: '#80808c' },
    { b: '#63636f', d: '#575763', l: '#757581' },
  ],
  [ // cripta: azulado y más oscuro
    { b: '#54546a', d: '#48485c', l: '#64647c' },
    { b: '#4c4c62', d: '#404054', l: '#5c5c74' },
    { b: '#505068', d: '#44445a', l: '#60607a' },
    { b: '#46465c', d: '#3a3a50', l: '#56566e' },
    { b: '#4a4a60', d: '#3e3e54', l: '#5a5a72' },
  ],
];
const FLOOR_MORTAR = ['#50505c', '#3a3a48'];
const FLOOR_CRACK = ['#4a4a56', '#333344'];
const FLOOR_SEAM = ['#4c4c58', '#40404e'];
const FLOOR_SHADOW = ['#3e3e4a', '#33333f'];
const FLOOR_CANTO = ['#7c7c90', '#66667e'];
const FLOOR_CORNER = ['#383844', '#2c2c38'];

// Muros: sillería con 3 caras por piedra (luz arriba-izq, sombra abajo-der)
const WALL_TONES: Tono[][] = [
  [
    { b: '#5c5c6e', d: '#4a4a5a', l: '#6e6e82' },
    { b: '#555566', d: '#444454', l: '#67677b' },
    { b: '#616173', d: '#4f4f60', l: '#737389' },
    { b: '#505060', d: '#40404e', l: '#626274' },
    { b: '#58586a', d: '#474758', l: '#6a6a7e' },
  ],
  [
    { b: '#4a4a5e', d: '#3a3a4c', l: '#5a5a72' },
    { b: '#46465a', d: '#36364a', l: '#56566e' },
    { b: '#4e4e64', d: '#3e3e52', l: '#5e5e78' },
    { b: '#424256', d: '#323244', l: '#52526a' },
    { b: '#48485c', d: '#38384a', l: '#585870' },
  ],
];
const WALL_MORTAR = ['#3c3c4a', '#2c2c3a'];

// Glifos rúnicos 3×3 para el suelo de la cripta
const RUNES: string[][] = [
  [' # ', '# #', ' # '],
  ['# #', ' # ', '# #'],
  ['###', ' # ', ' # '],
];

// Pilar: paleta por clima
const PILLAR = {
  normal: {
    capL: '#9c9cb0', cap: '#8a8a9c', shaft: '#7a7a8e', shaftL: '#9494a6',
    shaftD: '#5e5e6e', flute: '#585866', base: '#6e6e80', baseL: '#84849a',
    baseD: '#4e4e5c', shadow: '#46465a', ground: '#3a3a46',
  },
  crypt: {
    capL: '#8e8ea8', cap: '#7c7c94', shaft: '#6a6a84', shaftL: '#82829e',
    shaftD: '#4e4e64', flute: '#46465c', base: '#5e5e76', baseL: '#74748e',
    baseD: '#404054', shadow: '#3c3c50', ground: '#32323e',
  },
};

// ============================================================
// SUELO DE PIEDRA (':' y base de 'P'/'A')
// ============================================================

/**
 * Campo de losas continuo entre tiles: para cada píxel global decide
 * si es junta y qué tono de losa le corresponde. Tipos de hilada:
 *  - fusionada (hash por macrofila de 32): losa grande de 32 px de alto
 *  - partida (hash por hilada): losas de 8 con junta media desplazada
 *  - normal: losas de 16 de alto y 16/24/32 de ancho con offset por hash
 */
function floorBase(
  x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string,
): void {
  const crypt = isCrypt(mapId);
  const tones = FLOOR_TONES[crypt ? 1 : 0];
  const mortar = FLOOR_MORTAR[crypt ? 1 : 0];
  const px0 = tx * 16, py0 = ty * 16;
  const mossC = crypt ? PAL.stoneMossCrypt : PAL.stoneMoss;
  const mossD = crypt ? '#33503f' : PAL.stoneMossDark;
  // musgo: más denso en bosque y cripta que en la plaza del valle
  const mossDensity = mapId === 'bosque' ? 0.2 : crypt ? 0.16 : 0.1;

  for (let ly = 0; ly < 16; ly++) {
    const gy = py0 + ly;
    const ry = Math.floor(gy / 16);   // hilada de 16 px
    const k = Math.floor(gy / 32);    // macrofila de 32 px
    const merged = hash2(k, 313) > 0.72;
    const splitRow = !merged && hash2(ry, 211) > 0.62;
    let off: number, w: number, rowId: number, jointH: boolean;
    let nearTop: boolean, nearBot: boolean;
    if (merged) {
      off = Math.floor(hash2(k, 517) * 40);
      w = 24 + 12 * pick(hash2(k, 519), 3);        // 24 / 36 / 48
      rowId = 1000 + k;
      jointH = gy % 32 === 0;
      nearTop = gy % 32 === 1; nearBot = gy % 32 === 31;
    } else if (splitRow) {
      const half = (gy & 8) !== 0 ? 1 : 0;
      const mj = hash2(ry, 223) > 0.5;             // ¿partida en 8×8?
      off = Math.floor(hash2(ry * 2 + half, 217) * 8);
      w = 8;
      rowId = ry * 2 + half;
      jointH = (gy & 15) === 0 || (mj && (gy & 15) === 8);
      nearTop = mj ? (gy & 7) === 1 : (gy & 15) === 1;
      nearBot = mj ? (gy & 7) === 7 : (gy & 15) === 15;
    } else {
      off = Math.floor(hash2(ry, 71) * 24);
      w = 16 + 8 * pick(hash2(ry, 137), 3);        // 16 / 24 / 32
      rowId = ry;
      jointH = gy % 16 === 0;
      nearTop = gy % 16 === 1; nearBot = gy % 16 === 15;
    }
    for (let lx = 0; lx < 16; lx++) {
      const gx = px0 + lx;
      const u = gx + off;
      const si = Math.floor(u / w);                // losa horizontal
      const us = u - si * w;                       // 0..w-1 dentro de la losa
      let c: string;
      if (jointH || us === 0) {
        c = mortar;                                // junta SÓLO entre losas
      } else {
        const slab = tones[pick(hash2(si * 7 + rowId * 131, rowId * 17 + si * 3), 5)];
        const n = hash2(gx, gy);
        // esquina redondeada simulada en algunas losas
        const rounded = hash2(si * 5 + rowId * 9, rowId * 3 + si * 7) > 0.55;
        if (rounded && (us === 1 || us === w - 1) && (nearTop || nearBot)) {
          c = mortar;
        } else if (n > 0.94) {
          c = slab.l;                              // desgaste pulido
        } else if (n < 0.06) {
          c = slab.d;                              // grano oscuro
        } else if ((us === 1 || nearTop) && hash2(gx + 31, gy + 17) > 0.5) {
          c = slab.l;                              // labio desgastado junto a junta
        } else {
          c = slab.b;
        }
      }
      p1(x, gx, gy, c);
    }
  }

  // --- manchas de musgo (campo de manchas en celdas de 5 px) ---
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const gx = px0 + lx, gy = py0 + ly;
      const cell = hash2(Math.floor(gx / 5) + 977, Math.floor(gy / 5) + 331);
      if (cell < mossDensity && hash2(gx + 55, gy + 66) > 0.42) {
        p1(x, gx, gy, hash2(gx + 7, gy + 3) > 0.8 ? mossD : mossC);
      }
    }
  }

  // --- grietas ramificadas (1 px con codo y rama, sólo a veces) ---
  if (hash2(tx * 3 + 11, ty * 5 + 7) > 0.62) {
    const crackC = FLOOR_CRACK[crypt ? 1 : 0];
    const startX = px0 + 2 + Math.floor(hash2(tx + 21, ty + 3) * 11);
    const startY = py0 + 2 + Math.floor(hash2(tx + 5, ty + 22) * 11);
    const horizFirst = hash2(tx + 9, ty + 23) > 0.5;
    const l1 = 3 + Math.floor(hash2(tx + 13, ty + 14) * 4);
    const l2 = 3 + Math.floor(hash2(tx + 15, ty + 16) * 4);
    const inTile = (X: number, Y: number) =>
      X >= px0 && X < px0 + 16 && Y >= py0 && Y < py0 + 16;
    x.fillStyle = crackC;
    let cx = startX, cy = startY;
    for (let i = 0; i < l1 && inTile(cx, cy); i++) {   // tramo 1
      x.fillRect(cx, cy, 1, 1);
      if (horizFirst) cx++; else cy++;
    }
    for (let i = 0; i < l2 && inTile(cx, cy); i++) {   // codo
      x.fillRect(cx, cy, 1, 1);
      if (horizFirst) cy++; else cx++;
    }
    let bx = startX, by = startY;
    for (let i = 0; i < 3 && inTile(bx, by); i++) {    // rama corta
      x.fillRect(bx, by, 1, 1);
      if (horizFirst) by--; else bx--;
    }
  }

  // --- runas ocasionales de la cripta (glifo 3×3 cian apagado) ---
  if (crypt && hash2(tx + 41, ty + 777) < 0.03) {
    const g = RUNES[pick(hash2(tx, ty + 12), 3)];
    const rx = px0 + 3 + Math.floor(hash2(tx + 1, ty + 2) * 8);
    const ryy = py0 + 3 + Math.floor(hash2(tx + 3, ty + 4) * 8);
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        if (g[j][i] === '#') p1(x, rx + i, ryy + j, PAL.runeCrypt);
      }
    }
  }
}

/**
 * Autotiling con at(): sombra de caída bajo muros, cantos iluminados
 * y costuras sutiles donde el suelo encuentra otro terreno.
 */
function floorSeams(
  x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string, at?: NeighborFn,
): void {
  if (!at) return;
  const crypt = isCrypt(mapId);
  const px0 = tx * 16, py0 = ty * 16;
  const shadow = FLOOR_SHADOW[crypt ? 1 : 0];
  const seam = FLOOR_SEAM[crypt ? 1 : 0];
  const canto = FLOOR_CANTO[crypt ? 1 : 0];
  const corner = FLOOR_CORNER[crypt ? 1 : 0];
  const up = at(0, -1), dn = at(0, 1), lf = at(-1, 0), rt = at(1, 0);
  if (up !== ':') {
    if (up === '#' || up === 'P') {
      // muro encima: sombra de caída 2px + difuminado damero
      px(x, px0, py0, 16, 2, shadow);
      dither(x, px0, py0 + 2, 16, 1, shadow);
      if (up === '#') px(x, px0, py0 - 1, 16, 1, canto); // canto iluminado del muro
    } else {
      px(x, px0, py0, 16, 1, seam);              // costura con otro terreno
    }
  }
  if (lf !== ':') px(x, px0, py0, 1, 16, seam);
  if (rt !== ':') px(x, px0 + 15, py0, 1, 16, seam);
  if (dn !== ':') px(x, px0, py0 + 15, 16, 1, seam);
  // esquinas rematadas
  if (up !== ':' && lf !== ':') p1(x, px0, py0, corner);
  if (up !== ':' && rt !== ':') p1(x, px0 + 15, py0, corner);
  if (dn !== ':' && lf !== ':') p1(x, px0, py0 + 15, corner);
  if (dn !== ':' && rt !== ':') p1(x, px0 + 15, py0 + 15, corner);
}

// ============================================================
// MURO DE SILLERÍA ('#')
// ============================================================

function paintWall(
  x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string, at?: NeighborFn,
): void {
  const crypt = isCrypt(mapId);
  const tones = WALL_TONES[crypt ? 1 : 0];
  const mortar = WALL_MORTAR[crypt ? 1 : 0];
  const px0 = tx * 16, py0 = ty * 16;

  for (let ly = 0; ly < 16; ly++) {
    const gy = py0 + ly;
    const rowG = Math.floor(gy / 4);   // hilada GLOBAL de 4 px (cruza tiles)
    const ry4 = gy & 3;
    // desplazamiento y ancho de piedra POR HILADA (hash real por fila)
    const off = Math.floor(hash2(rowG, 41) * 12);
    const w = 6 + pick(hash2(rowG, 23), 3);          // 6 / 7 / 8
    for (let lx = 0; lx < 16; lx++) {
      const gx = px0 + lx;
      const u = gx + off;
      const si = Math.floor(u / w);                  // piedra de la hilada
      const us = u - si * w;
      const sh = hash2(si * 13 + rowG * 57, rowG * 29 + si * 3);
      let c: string;
      if (sh < 0.08) {
        // piedra faltante: hueco oscuro con dither
        c = ((gx + gy) & 1) === 0 ? '#32323e' : '#2a2a34';
      } else if (ry4 === 3 || us === 0) {
        c = mortar;                                  // juntas de mortero
      } else {
        const tone = tones[pick(hash2(si * 17 + rowG * 3, rowG * 5 + si * 11), 5)];
        if (ry4 === 0 || us === 1) {
          c = tone.l;                                // cara iluminada arriba-izq
        } else if (us === w - 1) {
          c = tone.d;                                // sombra abajo-der
        } else {
          const n = hash2(gx, gy);
          c = n > 0.93 ? tone.l : n < 0.07 ? tone.d : tone.b;
        }
        // liquen ocasional en la hilada baja de alguna piedra
        if (sh > 0.3 && sh < 0.38 && ry4 >= 2 && hash2(gx + 77, gy + 13) > 0.6) {
          c = '#5a6a50';
        }
      }
      p1(x, gx, gy, c);
    }
  }

  // remate superior: canto iluminado si no hay otro muro encima
  if (at && at(0, -1) !== '#') {
    px(x, px0, py0, 16, 1, crypt ? '#5e5e76' : '#74748a');
  }

  // musgo/liquen verde-grisáceo en bordes inferiores del muro
  if (!at || at(0, 1) !== '#') {
    const dens = crypt ? 0.22 : 0.45;
    for (let ly = 10; ly <= 14; ly++) {  // fila 15 la pinta el canto del suelo
      for (let lx = 0; lx < 16; lx++) {
        const gx = px0 + lx, gy = py0 + ly;
        const edge = (ly - 8) / 7;       // más denso cuanto más abajo
        if (hash2(gx + 91, gy + 37) < dens * edge) {
          p1(x, gx, gy, hash2(gx, gy + 5) > 0.6 ? '#56654c' : '#46584a');
        }
      }
    }
  }

  // --- extras de cripta: línea grabada y nicho con vela ---
  if (crypt) {
    if (hash2(tx + 3, ty + 303) < 0.12) {
      const yl = py0 + 4 + Math.floor(hash2(tx + 8, ty + 9) * 6);
      px(x, px0, yl, 16, 1, '#34344a');      // surco grabado
      px(x, px0, yl + 1, 16, 1, '#5c5c74');  // labio inferior que recoge luz
    }
    if (hash2(tx + 5, ty + 601) < 0.05) {
      const nx = px0 + 4 + Math.floor(hash2(tx + 2, ty + 11) * 6);
      const ny = py0 + 3 + Math.floor(hash2(tx + 6, ty + 13) * 4);
      // nicho oscuro con marco
      px(x, nx, ny, 5, 6, '#1e1e28');
      px(x, nx, ny, 5, 1, '#16161e');        // sombra interior superior
      px(x, nx - 1, ny - 1, 7, 1, '#5e5e76'); // dintel iluminado
      px(x, nx - 1, ny, 1, 6, '#333344');    // jamba en sombra
      px(x, nx + 5, ny, 1, 6, '#56566e');    // jamba al lado de la luz
      // vela mínima 1×2 ámbar dentro del nicho
      p1(x, nx + 2, ny + 4, PAL.candleFlame);
      p1(x, nx + 2, ny + 5, PAL.candleWax);
    }
  }
}

// ============================================================
// MADERA ('_') — tablones con veta, nudos y clavos
// ============================================================

const WOOD_TONES: Tono[] = [
  { b: '#8a6a44', d: '#7a5c3a', l: '#96764e' },
  { b: '#82643f', d: '#725635', l: '#8e7049' },
  { b: '#916f47', d: '#81613b', l: '#9d7b51' },
  { b: '#7c5e3c', d: '#6c5032', l: '#886a44' },
];
const WOOD_JOINT = '#5c442a';
const WOOD_GRAIN = '#6e5232';
const WOOD_KNOT = '#4e3a22';
const WOOD_NAIL = '#3a2a16';

function paintWood(x: CanvasRenderingContext2D, tx: number, ty: number): void {
  const px0 = tx * 16, py0 = ty * 16;
  for (let ly = 0; ly < 16; ly++) {
    const gy = py0 + ly;
    const prow = Math.floor(gy / 8);   // tablón GLOBAL de 8 px de alto
    const inP = gy & 7;
    const tone = WOOD_TONES[pick(hash2(prow, 91), 4)];
    // extremo de tablón: junta vertical desplazada por hash de fila
    const butt = px0 + 2 + Math.floor(hash2(prow, 57) * 12);
    const hasKnot = hash2(prow, 71) > 0.72;
    const knotX = px0 + 3 + Math.floor(hash2(prow + 3, 17) * 10);
    for (let lx = 0; lx < 16; lx++) {
      const gx = px0 + lx;
      let c: string;
      if (inP === 7) {
        c = WOOD_JOINT;                            // junta entre tablones
      } else if (gx === butt) {
        c = WOOD_JOINT;                            // testa del tablón
      } else if (inP === 0) {
        c = tone.l;                                // canto iluminado superior
      } else {
        // veta ondulada quebrada: segmentos de 4 px que suben/bajan
        const seg = Math.floor(gx / 4);
        const grainY1 = 2 + (hash2(seg, prow * 13 + 1) > 0.5 ? 1 : 0);
        const hasG2 = hash2(prow, 33) > 0.5;
        const grainY2 = 5 + (hash2(seg, prow * 17 + 2) > 0.5 ? 1 : 0);
        if (inP === grainY1) {
          c = WOOD_GRAIN;
        } else if (hasG2 && inP === grainY2) {
          c = WOOD_GRAIN;
        } else if (hasKnot && gx >= knotX && gx < knotX + 2 && (inP === 3 || inP === 4)) {
          c = WOOD_KNOT;                           // nudo
        } else if (hasKnot && gx === knotX - 1 && inP === 2) {
          c = tone.d;                              // anillo del nudo
        } else {
          const n = hash2(gx, gy);
          c = n > 0.93 ? tone.l : n < 0.07 ? tone.d : tone.b;
        }
      }
      // clavos oscuros junto al extremo del tablón
      if (inP === 1 && (gx === butt - 1 || gx === butt + 1)) c = WOOD_NAIL;
      p1(x, gx, gy, c);
    }
  }
}

// ============================================================
// PILAR ('P') — alto, con capitel, acanaladuras y sombra
// ============================================================

function paintPillar(
  x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string, at?: NeighborFn,
): void {
  const P = isCrypt(mapId) ? PILLAR.crypt : PILLAR.normal;
  const px0 = tx * 16, py0 = ty * 16;
  // suelo de losas bajo el pilar + autotiling de sus bordes
  floorBase(x, tx, ty, mapId);
  floorSeams(x, tx, ty, mapId, at);
  // sombra elíptica proyectada en el suelo
  px(x, px0 + 2, py0 + 12, 12, 1, P.shadow);
  px(x, px0 + 0, py0 + 13, 16, 1, P.shadow);
  px(x, px0 + 0, py0 + 14, 16, 1, P.shadow);
  dither(x, px0 + 1, py0 + 15, 14, 1, P.ground);
  // capitel: dos escalones (sobresale 8 px por encima del tile → altura)
  px(x, px0, py0 - 8, 16, 2, P.cap);
  px(x, px0, py0 - 8, 16, 1, P.capL);
  px(x, px0 + 1, py0 - 6, 14, 2, P.cap);
  px(x, px0 + 1, py0 - 6, 14, 1, P.capL);
  // sombra que el capitel proyecta sobre el fuste
  px(x, px0 + 3, py0 - 4, 10, 1, P.shaftD);
  // fuste con luz lateral izquierda y sombra derecha
  px(x, px0 + 3, py0 - 3, 10, 12, P.shaft);
  px(x, px0 + 3, py0 - 3, 2, 12, P.shaftL);
  px(x, px0 + 11, py0 - 3, 2, 12, P.shaftD);
  // acanaladuras verticales (2 líneas oscuras, desconchadas por hash)
  for (const fx of [px0 + 6, px0 + 9]) {
    for (let j = 0; j < 12; j++) {
      if (hash2(fx * 3 + j, ty * 7 + 5) > 0.18) p1(x, fx, py0 - 3 + j, P.flute);
    }
  }
  // grieta ocasional en el fuste (1 px con codo)
  if (hash2(tx + 7, ty + 41) > 0.55) {
    const fx = px0 + 4 + Math.floor(hash2(tx + 4, ty + 2) * 6);
    const fy = py0 - 2 + Math.floor(hash2(tx + 3, ty + 9) * 7);
    p1(x, fx, fy, P.shaftD);
    p1(x, fx, fy + 1, P.shaftD);
    p1(x, fx + 1, fy + 2, P.shaftD);
  }
  // basa más ancha: moldura + plinto
  px(x, px0 + 2, py0 + 9, 12, 2, P.base);
  px(x, px0 + 2, py0 + 9, 12, 1, P.baseL);
  px(x, px0 + 1, py0 + 11, 14, 4, P.base);
  px(x, px0 + 1, py0 + 11, 14, 1, P.baseL);
  px(x, px0 + 1, py0 + 14, 14, 1, P.baseD);
  // contacto con el suelo
  px(x, px0 + 1, py0 + 15, 14, 1, P.ground);
  dither(x, px0 + 0, py0 + 15, 1, 1, P.ground);
  dither(x, px0 + 15, py0 + 15, 1, 1, P.ground);
}

// ============================================================
// ALTAR ('A') — piedra ritual, runas doradas y talco blanco
// ============================================================

function paintAltar(
  x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string, at?: NeighborFn,
): void {
  const px0 = tx * 16, py0 = ty * 16;
  floorBase(x, tx, ty, mapId);
  floorSeams(x, tx, ty, mapId, at);
  // sombra proyectada al frente
  px(x, px0 + 2, py0 + 14, 12, 1, '#3a3a46');
  dither(x, px0 + 2, py0 + 15, 12, 1, '#3a3a46');
  // cuerpo ritual de piedra oscura (luz izq., sombra der.)
  px(x, px0 + 3, py0 + 5, 10, 9, '#4c4c5a');
  px(x, px0 + 3, py0 + 5, 2, 9, '#565664');
  px(x, px0 + 9, py0 + 5, 2, 9, '#3e3e4c');
  // tapa de losa que sobresale
  px(x, px0 + 2, py0 + 2, 12, 3, '#6a6a7c');
  px(x, px0 + 2, py0 + 2, 12, 1, '#84848e');   // canto iluminado
  px(x, px0 + 2, py0 + 4, 12, 1, '#48485a');   // sombra bajo la tapa
  // runas doradas: tres marcas del Primer Canto (ondas, alineadas abajo)
  px(x, px0 + 5, py0 + 9, 1, 3, PAL.gold);
  px(x, px0 + 7, py0 + 7, 1, 5, PAL.gold);
  px(x, px0 + 9, py0 + 8, 1, 4, PAL.gold);
  // grabado: reflejo oscuro bajo cada marca
  p1(x, px0 + 5, py0 + 12, '#8a6f22');
  p1(x, px0 + 7, py0 + 12, '#8a6f22');
  p1(x, px0 + 9, py0 + 12, '#8a6f22');
  // talco ritual blanco desgastado delante (dither con huecos)
  dither(x, px0 + 4, py0 + 14, 8, 1, '#c9c2ae');
  p1(x, px0 + 5, py0 + 15, '#c9c2ae');
  p1(x, px0 + 8, py0 + 15, '#c9c2ae');
  p1(x, px0 + 10, py0 + 15, '#c9c2ae');
}

// ============================================================
// VACÍO ('V') — negro azulado, polvo estelar, ecos de ladrillo
// ============================================================

function paintVoid(x: CanvasRenderingContext2D, tx: number, ty: number): void {
  const px0 = tx * 16, py0 = ty * 16;
  px(x, px0, py0, 16, 16, PAL.void0);
  // motas de polvo estelar
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const n = hash2(px0 + lx, py0 + ly);
      if (n > 0.985) p1(x, px0 + lx, py0 + ly, '#3a3454');
      else if (n > 0.94) p1(x, px0 + lx, py0 + ly, '#221c30');
    }
  }
  // eco de ladrillo difuminado (rectángulo 3×2 muy oscuro + halo dither)
  if (hash2(tx + 3, ty + 888) < 0.1) {
    const bx = px0 + 2 + Math.floor(hash2(tx + 1, ty + 4) * 10);
    const by = py0 + 2 + Math.floor(hash2(tx + 2, ty + 5) * 11);
    px(x, bx, by, 3, 2, '#130f1f');
    dither(x, bx - 1, by, 1, 2, '#130f1f');
    dither(x, bx + 3, by, 1, 2, '#130f1f');
    dither(x, bx, by - 1, 3, 1, '#130f1f');
    dither(x, bx, by + 2, 3, 1, '#130f1f');
  }
}

// ============================================================
// DESPACHO
// ============================================================

export function paintStone(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, at?: NeighborFn,
): void {
  void t; // prerrender con t=0: todo estático y determinista
  switch (ch) {
    case ':':
      floorBase(x, tx, ty, mapId);
      floorSeams(x, tx, ty, mapId, at);
      break;
    case '_':
      paintWood(x, tx, ty);
      break;
    case '#':
      paintWall(x, tx, ty, mapId, at);
      break;
    case 'P':
      paintPillar(x, tx, ty, mapId, at);
      break;
    case 'A':
      paintAltar(x, tx, ty, mapId, at);
      break;
    case 'V':
      paintVoid(x, tx, ty);
      break;
  }
}
