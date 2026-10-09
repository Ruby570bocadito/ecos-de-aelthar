// ============================================================
// ECOS DE AELTHAR — Tiles de piedra y cripta (módulo world) · v4
// Casos: ':' suelo piedra · '_' madera · '#' muro · 'P' pilar
//        'A' altar · 'V' vacío
//   R10-8 (cripta de Zelda): '^' pinchos · 'L' palanca · 'D' puerta
//   '=' camino (cripta/arena: suelo piedra; lunaris/bosque: default verde)
// Contrato: paintStone llamada por el despachador drawTile.
//
// ------------------------------------------------------------
// R10-8 · ENGANCHES EXACTOS (los aplica el orquestador, no este módulo)
// ------------------------------------------------------------
// (1) sprites.ts → drawTile (~línea 134), añadir los chars nuevos al case
//     de paintStone (firma de paintStone INTACTA):
//
//       case ':': case '_': case '#': case 'P': case 'A': case 'V':
//       case '^': case 'L': case 'D': case '=':   // ← R10-8 (4 chars)
//         paintStone(x, ch, tx, ty, mapId, t, at); break;
//
//     Con esto el PRERRENDER (buildGround, t=0) pinta: socket del pincho,
//     palanca APAGADA, puerta CERRADA y suelo '=' de cripta/arena.
//     'L' y 'D' son estados completos; '^' pinta SOLO el socket (ver 2).
//
// (2) render.ts → drawWorld (~línea 177, justo DESPUÉS de waterOverlay):
//     capa animada de los pinchos (OBLIGATORIA: sin ella los '^' se ven
//     como sockets retraídos y el peligro no existe en pantalla):
//
//       spikesOverlay(octx, camX, camY, g.globalT, g.mapId,
//         (tx, ty) => tileAt(g.map, g.rows, tx, ty, g.epoch)); // R10-8
//
//     (mismo convenio que waterOverlay: camX/camY en px de PANTALLA con
//     ZOOM aplicado, at ABSOLUTO consciente de época; early-out si no hay
//     '^' en el viewport; cero allocations por frame).
//
// (3) render.ts → drawProps (pass de props, ~línea 205) o junto al (2):
//     palancas ACTIVADAS + puerta ABIERTA según el estado de R10-3
//     (flags 'cripta_lever_<tx>_<ty>' y cryptDoorOpen(g) de update.ts):
//
//       leversOverlay(octx, camX, camY, g.rows, g.flags);            // R10-8
//       doorsOverlay(octx, camX, camY, g.rows, cryptDoorOpen(g));    // R10-8
//
//     Ambas recorren SOLO el viewport (charCodeAt sobre rows, sin at()),
//     son no-op si no hay 'L'/'D' visibles y pintan POR ENCIMA del suelo
//     prerrenderizado repintando opacamente el mecanismo (cero fantasma
//     del estado anterior). Alternativa reutilizable 1-sola-llamada (repintar
//     el groundCanvas tras activar, coste único): paintLeverOn / paintDoorOpen
//     (px de mundo, misma convención que paintStone) — el orquestador elige.
//
// (4) Solidez (dominio de R10-3/update.ts, NO de este módulo): '^' es SUELO
//     (daño vía updateCryptSpikes); 'D' sólida dinámica vía tileSolidAt +
//     cryptDoorOpen (enganche documentado en update.ts:1262). Nada que
//     añadir a SOLID_CHARS de sprites.ts para estos chars.
//
// FÓRMULA DEL PINCHO (contrato R10-3, update.ts:1297-1310 — duplicada
// textualmente: stone.ts NO puede importar update.ts sin ciclo
// engine→sprites→stone; hash2 ∈ [0,0.5) fix R9, el ×2 es el hnorm estándar):
//   fase(tx,ty,gt) = (gt / 1.2 + hash2(tx * 7 + 11, ty * 13 + 7) * 2) % 2
//   ARRIBA : fase < 0.55   (0.66 s fuera del suelo · ciclo total 2.4 s)
//   AVISO  : fase >= 1.75  (últimos 0.3 s de fase baja → punta asoma 2 px)
//   Subida en rampa 0.12 s al entrar en ARRIBA; bajada instantánea al salir
//   (la misma fase gobierna el daño en update.ts: el dibujo nunca muestra
//   arriba un pincho que no esté dañando). Polvo del disparo y chispa fría
//   deterministas a partir de globalT (cero Math.random).
// ------------------------------------------------------------
//
// CLAVE ANTI-REJILLA (v3): las hiladas del suelo ya NO miden todas
// 16 px. Se construye UNA VEZ una tabla de hiladas por Y global con
// alturas acumuladas variables (8/12/16/20/24/32), de modo que las
// juntas horizontales caen en Y arbitrarias y casi nunca coinciden
// con el borde de tile. Los anchos de losa también se mezclan por
// hilada (8/12/16/24/32/48) con offset por hash y las juntas se
// pintan "desgastadas" (rotas, dos tonos) para que ninguna línea
// recorra el suelo de lado a lado. Los muros usan su propia tabla
// de hiladas de 3-5 px con desplazamiento real por fila.
// Prerrender: drawTile se llama con t=0 → todo determinista.
//
// R4-A7b (reintento): 4 patrones de baldosa por BLOQUE 2×2 de tiles
// (coherentes entre vecinos), hierba infiltrada en las juntas junto a
// hierba y desgaste donde el camino '=' cruza la plaza, esquinas
// hundidas; cripta con juntas hondas, humedades en bandas verticales,
// GRIETAS CON RUTA que continúan al tile vecino, musgo en racimos y
// runas tenues de 2-3 trazos; pilares/altar con base desgastada y
// grieta vertical; madera con sombra de contacto de 1px hacia el
// vecino inferior. Paleta: tonos existentes + 1 acento (WALL_DAMP)
// + la runa tenue mandatada (RUNE_FAINT).
// ============================================================

import { hash2, px, pick, PAL, isCrypt, type NeighborFn } from './palette';
import { VIEW_W, VIEW_H, ZOOM as Z } from '../consts'; // R10-8: ventanas vivas de overlay

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

/**
 * Hash int32 determinista (Math.imul, sin pérdida de precisión) para
 * decisiones ESTRUCTURALES: hiladas, tonos por losa, desgaste de
 * juntas. hash2 (el estándar del juego) pierde los bits bajos con
 * coordenadas grandes (flotantes > 2^53) y agrupa valores; h32 no.
 */
function h32(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor bilineal suavizado (celdas de L px) para manchas. */
function vnoise(vx: number, vy: number, L: number, seed: number): number {
  const x0 = Math.floor(vx / L), y0 = Math.floor(vy / L);
  const fx = vx / L - x0, fy = vy / L - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h32(x0 + seed, y0 + seed * 7);
  const b = h32(x0 + 1 + seed, y0 + seed * 7);
  const c = h32(x0 + seed, y0 + 1 + seed * 7);
  const d = h32(x0 + 1 + seed, y0 + 1 + seed * 7);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Grieta CON RUTA (R4-A7b): campo global puro — cada ancla de columna
 * (cada 6 px) decide por hash si abre fisura, dónde empieza y cuánto
 * dura; el píxel activo de cada fila oscila 0/1 → ruta continua de 1px
 * que CRUZA los bordes de tile sin costuras (misma función pura en el
 * tile y en su vecino). ~22% de las anclas, rutas de 24-111 px.
 */
function wallCrack(gx: number, gy: number): boolean {
  const a = gx - (gx % 6);
  if (h32(a * 3 + 5, 733) >= 0.22) return false;
  const ys = Math.floor(h32(a + 911, 739) * 256) * 4;
  if (gy < ys || gy >= ys + 24 + Math.floor(h32(a + 917, 743) * 88)) return false;
  return a + (h32(a * 7 + gy * 13, 737) < 0.20 ? 1 : 0) === gx;
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
const FLOOR_JOINT2 = ['#5c5c68', '#464654'];  // junta desgastada (más clara)
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

// R4-A7b · acentos (política de paleta: tonos existentes ±1 acento)
const WALL_DAMP = '#2e2e3c';   // humedad difusa de la sillería (cripta)
const RUNE_FAINT = '#3a3a52';  // runa tenue grabada en el muro (mandatada)
// trazos de runa tenue: 2-3 trazos de 1px (pares [dx,dy] en caja 4×3)
const RUNE_STROKES: number[][][] = [
  [[0, 0], [0, 1], [0, 2], [2, 1], [2, 2]],          // dos verticales
  [[0, 2], [1, 1], [2, 0], [0, 0], [1, 0]],          // diagonal + techo
  [[1, 0], [1, 1], [1, 2], [0, 1], [2, 1], [3, 2]],  // cruz + pie
  [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],          // T rúnica
];
// chars que cuentan como hierba a efectos de infiltración en juntas
const GRASS_CHARS = ['.', ',', 'c', 'm'];

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
// R10-8 · PALETAS DE LA CRIPTA DE ZELDA (aditivo)
// ============================================================

// Musgo PÚRPURA del Eco (cripta v2): trepa por la sillería más alto que el
// musgo verde (que queda a nivel de suelo) — la corrosión del canto asciende.
const MOS_PURPLE = ['#5c4470', '#46365c', '#342a44'];
const MOS_PURPLE_HI = '#7c62a0'; // brillo raro (1/64 px de racimo)

// chars transitables de la cripta a efectos del ARCO (hueco de 1 tile flanqueado
// por muros). 'D' NO cuenta: la puerta tiene su propio batiente enmarcado.
const WALK_C = ':=^L';

// Pinchos: hueso viejo (cripta) / metal pálido (arena)
const SPK_TONES = [
  {
    body: '#cfc9b6', lit: '#ece7d6', shade: '#948c78', tip: '#f2ede0',
    glint: '#a8e4f4', glint2: '#e2f8ff', dust: '#8a8478',
  },
  {
    body: '#b4b8c2', lit: '#d6dae2', shade: '#7a7e8a', tip: '#e8ecf2',
    glint: '#a8e4f4', glint2: '#e2f8ff', dust: '#82868e',
  },
];
// anchos de fila de la aguja (de la base a la punta): 12 filas, 13 px de alto
const SPIKE_W = [6, 6, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1];

// Palanca: bloque de piedra empotrado + brazo metálico + perilla de hueso
const LEV = {
  block: '#4e4e62', blockL: '#6a6a82', blockLL: '#60607a',
  blockD: '#33334a', blockDR: '#3a3a50', chip: '#44445a',
  recess: '#1c1a26', recessTop: '#121018', recessTopOn: '#0e2228',
  mount: '#3a3a4c', mountL: '#5c5c72',
  arm: '#8a8a9c', armL: '#b0b0c0', armD: '#5e5e70',
  knob: '#c9c2ae', knobD: '#8a8474',
  glow: '#7de8ff', glowHi: '#d8f8ff', glowDim: '#2a5a68',
  rune: '#3a3a52', runeLit: '#4ac8dc',
  slot: '#0e0c14',
};

// Puerta de la sala de puzzle: batiente con jambas, dos hojas, inhierros y
// la runa del Eco grabada (tenue) — abierta: hoja deslizada + resbalón de luz
const DOR = {
  jamb: '#5e5e74', jambD: '#46465a', jambL: '#6e6e86',
  lintel: '#66667e', lintelD: '#3e3e54',
  slab: '#4e4e62', slabL: '#5a5a72', slabD: '#44445a',
  seam: '#333344', boss: '#6a6a80', bossD: '#3e3e50',
  rune: '#2e4a56', runeLit: '#3f6a78',
  thr: '#23212c', thrL: '#5a5a70', thrOpen: '#3e4e58',
  void0: '#0a0812', voidD: '#141220', roomFloor: '#2e2e3e', roomFloorL: '#3a3a4e',
  resid: '#3f6a78',
};

// ============================================================
// TABLAS DE HILADAS (por Y global, construidas una sola vez)
// El patrón de losas/muros vive en coordenadas GLOBALES y cruza
// los bordes de tile sin costuras; las alturas acumuladas hacen
// que las juntas NO caigan sistemáticamente en el borde de tile.
// ============================================================

const LOOKUP_MAX = 1024; // cubre el mapa más alto (bosque 56 → 896 px)

// suelo: y0 de hilada, alto, ancho de losa, offset e id de hilada
let fY0: Int32Array | null = null;
let fH = new Int32Array(0), fW = new Int32Array(0), fOff = new Int32Array(0);
let fBand = new Int32Array(0), fMid = new Uint8Array(0);

function ensureFloorRows(): void {
  if (fY0) return;
  fY0 = new Int32Array(LOOKUP_MAX);
  fH = new Int32Array(LOOKUP_MAX);
  fW = new Int32Array(LOOKUP_MAX);
  fOff = new Int32Array(LOOKUP_MAX);
  fBand = new Int32Array(LOOKUP_MAX);
  fMid = new Uint8Array(LOOKUP_MAX);
  let y = 0, band = 0;
  while (y < LOOKUP_MAX) {
    const r = h32(band * 7 + 3, 911);
    // altura de hilada variable: la mezcla evita el ritmo de 16 px
    const h = r < 0.12 ? 8 : r < 0.26 ? 12 : r < 0.56 ? 16 : r < 0.66 ? 20 : r < 0.86 ? 24 : 32;
    const off = Math.floor(h32(band * 11 + 5, 913) * 48);
    const rw = h32(band * 13 + 9, 917);
    const rk = h32(band * 17 + 2, 919);
    // tipo de hilada: losa grande, partida en 2×8 con junta desplazada,
    // o losa pequeña con borde irregular (chips)
    let w: number, split = false, off2 = off;
    if (h >= 20) {
      w = rw < 0.30 ? 24 : rw < 0.70 ? 32 : 48;        // losa grande pulida
    } else if (h === 16 && rk < 0.38) {
      w = 8; split = true;                             // partida 2×8×8
      off2 = off + 3 + pick(h32(band * 19 + 4, 717), 4); // junta media desplazada
    } else if (h === 16) {
      w = rw < 0.35 ? 16 : rw < 0.75 ? 24 : 32;
    } else {
      w = h === 12 ? (rw < 0.6 ? 12 : 16) : 8;         // pequeña irregular
    }
    for (let j = 0; j < h && y + j < LOOKUP_MAX; j++) {
      fY0[y + j] = y;
      fH[y + j] = h;
      fW[y + j] = w;
      fOff[y + j] = split && j >= h / 2 ? off2 : off;  // mitad baja desplazada
      fBand[y + j] = band;
      fMid[y + j] = split && j === h / 2 ? 1 : 0;      // junta media de la partida
    }
    y += h; band++;
  }
}

// muro: hiladas de 3-5 px con desplazamiento real por fila
let wY0: Int32Array | null = null;
let wH = new Int32Array(0), wW = new Int32Array(0), wOff = new Int32Array(0), wBand = new Int32Array(0);

function ensureWallRows(): void {
  if (wY0) return;
  wY0 = new Int32Array(LOOKUP_MAX);
  wH = new Int32Array(LOOKUP_MAX);
  wW = new Int32Array(LOOKUP_MAX);
  wOff = new Int32Array(LOOKUP_MAX);
  wBand = new Int32Array(LOOKUP_MAX);
  let y = 0, band = 0;
  while (y < LOOKUP_MAX) {
    const r = h32(band * 5 + 7, 931);
    const h = r < 0.22 ? 3 : r < 0.76 ? 4 : 5;         // hilada 3-5 px
    const off = Math.floor(h32(band * 9 + 3, 937) * 16);
    const w = 5 + pick(h32(band * 15 + 1, 941), 5);    // piedra 5-9 px
    for (let j = 0; j < h && y + j < LOOKUP_MAX; j++) {
      wY0[y + j] = y;
      wH[y + j] = h;
      wW[y + j] = w;
      wOff[y + j] = off;
      wBand[y + j] = band;
    }
    y += h; band++;
  }
}

// ============================================================
// SUELO DE PIEDRA (':' y base de 'P'/'A')
// ============================================================

// ============================================================
// PATRÓN DE SUELO POR BLOQUE 2×2 (R4-A7b)
// Los 4 tiles de un bloque de 32×32 px comparten patrón de baldosa
// (hash del bloque) → las baldosas encajan entre vecinos:
//   0 · hiladas variables (tablas de arriba)
//   1 · soga: sillares 16×8 en muro corrido
//   2 · losas grandes 32×16 con fase por hilada
//   3 · mosaico 8×8 con fase por fila (borde irregular)
// ============================================================

function blockPat(bx: number, by: number): number {
  return pick(h32(bx * 3 + 17, by * 5 + 29), 4);
}

/** Patrón de la celda 2×2 que contiene el tile (export QA/harness). */
export function stonePatternAt(tx: number, ty: number, mapId?: string): number {
  void mapId;
  return blockPat(tx >> 1, ty >> 1);
}

// scratch del geometra (sin allocations; prerrender single-thread)
let sPat = 0, sB = 0, sY0 = 0, sH = 0, sW = 0, sOff = 0;
let sSi = 0, sUs = 0, sRy = 0, sJH = false;

/** Geometría de losa del píxel global (gx, gy) según el patrón del bloque. */
function slabGeom(gx: number, gy: number): void {
  const pat = blockPat(gx >> 4, gy >> 4);
  sPat = pat;
  if (pat === 1) {                       // soga 16×8
    sY0 = gy & ~7; sH = 8; sW = 16; sB = sY0;
    sOff = ((gy >> 3) & 1) !== 0 ? 8 : 0;
    sJH = (gy & 7) === 7;
  } else if (pat === 2) {                // losa grande 32×16
    sY0 = gy & ~15; sH = 16; sW = 32; sB = sY0;
    sOff = Math.floor(h32((sY0 >> 4) * 7 + 1, 601) * 32);
    sJH = (gy & 15) === 15;
  } else if (pat === 3) {                // mosaico 8×8
    sY0 = gy & ~7; sH = 8; sW = 8; sB = sY0;
    sOff = Math.floor(h32((sY0 >> 3) * 11 + 3, 613) * 8);
    sJH = (gy & 7) === 7;
  } else {                               // hiladas variables (tablas)
    ensureFloorRows();
    sY0 = fY0![gy]; sH = fH![gy]; sW = fW[gy]; sOff = fOff[gy]; sB = fBand[gy];
    sJH = gy - sY0 === 0 || fMid[gy] === 1;
  }
  const u = gx + sOff;
  sSi = Math.floor(u / sW);
  sUs = u - sSi * sW;
  sRy = gy - sY0;
}

/** ¿Junta? — exige slabGeom(gx, gy) recién calculado. */
function slabIsJoint(gx: number, gy: number): boolean {
  if (sJH || sUs === 0) return true;
  if (sW <= 12 && sUs === 1 && h32(gx * 3 + sB, gy + 41) > 0.72) return true;
  if (sW <= 12 && sRy === 1 && h32(gx + 17, gy * 3 + sB) > 0.78) return true;
  return false;
}

/** ¿Es junta el píxel global? (para costuras/infiltración desde fuera) */
function slabJoint(gx: number, gy: number): boolean {
  slabGeom(gx, gy);
  return slabIsJoint(gx, gy);
}

/**
 * Campo de losas continuo entre tiles: para cada píxel global decide
 * si es junta y qué tono de losa le corresponde. Tipos de losa:
 *  - grande (24-48 × 20-32) pulida, con brillo de pulido
 *  - partida (hilada de 16 en 2×8×8 con junta media desplazada)
 *  - pequeña (8×8 / 12×12 / 12×16) con borde irregular (muescas)
 * Juntas desgastadas: rotas y con dos tonos, NUNCA un borde 1px en
 * los 4 lados de cada tile.
 */
function floorBase(
  x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string,
): void {
  ensureFloorRows();
  const crypt = isCrypt(mapId);
  const ci = crypt ? 1 : 0;
  const tones = FLOOR_TONES[ci];
  const mortar = FLOOR_MORTAR[ci];
  const joint2 = FLOOR_JOINT2[ci];
  const px0 = tx * 16, py0 = ty * 16;
  const mossC = crypt ? PAL.stoneMossCrypt : PAL.stoneMoss;
  const mossD = crypt ? '#33503f' : PAL.stoneMossDark;
  const cornerC = FLOOR_CORNER[ci];
  // musgo: más denso en bosque y cripta que en la plaza del valle
  // (umbral calibrado con la distribución del ruido: ~10/21/26% de área)
  const mossThr = mapId === 'bosque' ? 0.595 : crypt ? 0.625 : 0.70;

  for (let ly = 0; ly < 16; ly++) {
    const gy = py0 + ly;
    for (let lx = 0; lx < 16; lx++) {
      const gx = px0 + lx;
      slabGeom(gx, gy);
      const w = sW, us = sUs, ry = sRy, b = sB, y0 = sY0, h = sH, si = sSi;
      let c: string;
      if (slabIsJoint(gx, gy)) {
        // junta desgastada: mayormente mortero, a veces clara, a veces rota
        const jn = h32(gx * 5 + b, gy * 5 + 3);
        const toneJ = tones[pick(h32(si * 7 + b * 131, b * 17 + si * 3), 5)];
        c = jn > 0.30 ? mortar : jn > 0.14 ? joint2 : toneJ.b;
      } else {
        const slabHash = h32(si * 7 + b * 131 + sPat * 57, b * 17 + si * 3 + sPat * 29);
        const tone = tones[pick(slabHash, 5)];
        const n = hash2(gx, gy);
        // pulido: las losas grandes brillan más que las demás
        const polished = w >= 24 && h >= 16 && h32(si * 3 + 7, b * 5 + 55) > 0.45;
        const inside = us > 1 && us < w - 1 && ry > 1 && ry < h - 1;
        const hl = h32(gx + 913, gy + 317);
        if (hl > (polished ? 0.86 : 0.95) && inside) {
          c = tone.l;                          // brillo de pulido suelto
        } else if (n < 0.05 && inside) {
          c = tone.d;                          // grano oscuro
        } else if (us === 1 && h32(gx + 31, gy + 17) > 0.55) {
          c = tone.l;                          // labio desgastado junto a junta
        } else if (ry === 1 && h32(gx + 13, gy + 7) > 0.55) {
          c = tone.l;
        } else {
          c = tone.b;
        }
        // esquina hundida: ~12% de las losas, cuña oscura en una esquina
        if (slabHash > 0.88) {
          const k = pick(h32(si * 13 + b * 7, sPat * 11 + 5), 4);
          const d = Math.max(
            Math.abs(gx - (gx - us + ((k & 1) !== 0 ? w - 1 : 0))),
            Math.abs(gy - (y0 + ((k & 2) !== 0 ? h - 1 : 0))),
          );
          if (d === 0) c = cornerC;
          else if (d === 1) c = tone.d;
          else if (d === 2 && h32(gx * 3 + gy, 811) > 0.5) c = tone.d;
        }
        // R10-8 · losa HUNDIDA (cripta v2): banda interior en sombra — el
        // pandeo del suelo avisa de suelo inestable (lee distinto a 1 vista)
        if (crypt && slabHash > 0.80 && slabHash <= 0.86 && inside && (us === 2 || ry === 2)) {
          c = tone.d;
        }
      }
      p1(x, gx, gy, c);
    }
  }

  // --- manchas de musgo (ruido de valor 2 octavas → blobs orgánicos) ---
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const gx = px0 + lx, gy = py0 + ly;
      const m = vnoise(gx, gy, 10, 301) * 0.62 + vnoise(gx, gy, 4, 309) * 0.38;
      if (m > mossThr) {
        p1(x, gx, gy, h32(gx + 7, gy + 3) > 0.8 ? mossD : mossC);
      }
    }
  }

  // --- grietas ramificadas (1 px con codo y rama, sólo a veces) ---
  if (h32(tx * 3 + 11, ty * 5 + 7) > 0.88) {
    const crackC = FLOOR_CRACK[ci];
    const startX = px0 + 2 + Math.floor(h32(tx + 21, ty + 3) * 11);
    const startY = py0 + 2 + Math.floor(h32(tx + 5, ty + 22) * 11);
    const horizFirst = h32(tx + 9, ty + 23) > 0.5;
    const l1 = 3 + Math.floor(h32(tx + 13, ty + 14) * 4);
    const l2 = 3 + Math.floor(h32(tx + 15, ty + 16) * 4);
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
  if (crypt && h32(tx + 41, ty + 777) < 0.05) {
    const g = RUNES[pick(h32(tx, ty + 12), 3)];
    const rx = px0 + 3 + Math.floor(h32(tx + 1, ty + 2) * 8);
    const ryy = py0 + 3 + Math.floor(h32(tx + 3, ty + 4) * 8);
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        if (g[j][i] === '#') p1(x, rx + i, ryy + j, PAL.runeCrypt);
      }
    }
  }

  // --- R10-8 · ARENA DEL ECO (mapId 'arena' SÍ pinta stone — verificado:
  // drawExpansionTile no captura ':/#/P' fuera de costa/aldea/cumbres) ---
  if (mapId === 'arena') {
    // polvo del combate: calvas pálidas difusas (ruido de valor)
    for (let ly = 0; ly < 16; ly++) {
      for (let lx = 0; lx < 16; lx++) {
        const gx = px0 + lx, gy = py0 + ly;
        const d = vnoise(gx, gy, 9, 811) * 0.6 + vnoise(gx, gy, 4, 813) * 0.4;
        if (d > 0.74) p1(x, gx, gy, h32(gx + 5, gy + 9) > 0.55 ? '#7e7e88' : '#6e6e78');
        else if (d > 0.70 && ((gx + gy) & 1) === 0) p1(x, gx, gy, '#767680');
      }
    }
    // huesos de los caídos (casi siempre en el mismo sentido, por hash)
    if (h32(tx * 7 + 3, ty * 5 + 13) > 0.86) {
      const bx = px0 + 2 + Math.floor(h32(tx + 31, ty + 7) * 10);
      const by2 = py0 + 2 + Math.floor(h32(tx + 9, ty + 27) * 10);
      const horiz = h32(tx + 3, ty + 5) > 0.5;
      p1(x, bx, by2, '#c6c0ae');
      p1(x, bx + (horiz ? 1 : 0), by2 + (horiz ? 0 : 1), '#c6c0ae');
      p1(x, bx - (horiz ? 1 : 0), by2 - (horiz ? 0 : 1), '#8e8876');
    }
    // marca de quemadura del desafío (dither, muy rara)
    if (h32(tx * 3 + 9, ty * 7 + 21) > 0.90) {
      const qx = px0 + 3 + Math.floor(h32(tx + 13, ty + 3) * 7);
      const qy = py0 + 4 + Math.floor(h32(tx + 7, ty + 11) * 6);
      px(x, qx, qy, 3, 2, '#3c3c46');
      dither(x, qx, qy + 2, 3, 1, '#3c3c46');
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
  const ci = crypt ? 1 : 0;
  const px0 = tx * 16, py0 = ty * 16;
  const shadow = FLOOR_SHADOW[ci];
  const seam = FLOOR_SEAM[ci];
  const canto = FLOOR_CANTO[ci];
  const corner = FLOOR_CORNER[ci];
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
  if (lf === '#' || lf === 'P') {
    px(x, px0, py0, 1, 16, shadow);              // sombra lateral del muro
    dither(x, px0 + 1, py0, 1, 16, shadow);
  } else if (lf !== ':') px(x, px0, py0, 1, 16, seam);
  if (rt === '#' || rt === 'P') {
    dither(x, px0 + 14, py0, 1, 16, shadow);
    px(x, px0 + 15, py0, 1, 16, shadow);
  } else if (rt !== ':') px(x, px0 + 15, py0, 1, 16, seam);
  if (dn !== ':' && dn !== '#' && dn !== 'P') px(x, px0, py0 + 15, 16, 1, seam);
  // esquinas rematadas
  if (up !== ':' && lf !== ':') p1(x, px0, py0, corner);
  if (up !== ':' && rt !== ':') p1(x, px0 + 15, py0, corner);
  if (dn !== ':' && lf !== ':') p1(x, px0, py0 + 15, corner);
  if (dn !== ':' && rt !== ':') p1(x, px0 + 15, py0 + 15, corner);

  // --- R10-8 · BOCA DE ARCO (cripta v2): hueco de 1 tile flanqueado por
  // muros y con muro al frente → sombra profunda del vano + bóvedas laterales
  // + quicio iluminado. Junto con carveArch (paintWall) compone el arco de
  // entrada imponente usando SOLO tiles existentes.
  if (crypt) {
    const sol = (c: string) => c === '#' || c === 'P' || c === 'D';
    if (sol(lf) && sol(rt) && sol(up)) {
      px(x, px0, py0, 16, 2, '#1a1826');
      dither(x, px0, py0 + 2, 16, 1, '#1a1826');
      px(x, px0, py0, 2, 6, '#1a1826');           // bóveda izquierda
      dither(x, px0 + 2, py0, 1, 6, '#1a1826');
      px(x, px0 + 14, py0, 2, 6, '#1a1826');      // bóveda derecha
      dither(x, px0 + 13, py0, 1, 6, '#1a1826');
      px(x, px0 + 7, py0, 2, 1, '#5a6278');       // filo de luz en el quicio
    }
  }

  // --- R4-A7b · hierba infiltrada en las juntas junto a hierba ---
  { // at garantizado (early-return de arriba)
    const gC = mapId === 'bosque' ? PAL.grassBosque[1] : PAL.grassLunaris[1];
    const gD = mapId === 'bosque' ? PAL.grassBosque[3] : PAL.grassDark;
    const infest = (X0: number, Y0: number, W: number, H: number): void => {
      for (let j = 0; j < H; j++) {
        for (let i = 0; i < W; i++) {
          const X = X0 + i, Y = Y0 + j;
          if (!slabJoint(X, Y)) continue;
          const r = h32(X * 7 + 3, Y * 5 + 1);
          if (r < 0.34) p1(x, X, Y, r < 0.11 ? gD : gC);
        }
      }
    };
    if (GRASS_CHARS.indexOf(up) >= 0) infest(px0, py0, 16, 2);
    if (GRASS_CHARS.indexOf(dn) >= 0) infest(px0, py0 + 14, 16, 2);
    if (GRASS_CHARS.indexOf(lf) >= 0) infest(px0, py0, 2, 16);
    if (GRASS_CHARS.indexOf(rt) >= 0) infest(px0 + 14, py0, 2, 16);

    // --- desgaste donde el camino '=' cruza la piedra ---
    const wearPx = (X: number, Y: number, edge: boolean): void => {
      const r = h32(X * 3 + 9, Y * 7 + 5);
      if (edge && r < 0.68) p1(x, X, Y, r < 0.14 ? PAL.pathDark : PAL.pathShadow);
      if (!edge && r > 0.72) p1(x, X, Y, PAL.pathShadow);
    };
    if (up === '=') for (let i = 0; i < 16; i++) { wearPx(px0 + i, py0, true); wearPx(px0 + i, py0 + 1, false); }
    if (dn === '=') for (let i = 0; i < 16; i++) { wearPx(px0 + i, py0 + 15, true); wearPx(px0 + i, py0 + 14, false); }
    if (lf === '=') for (let j = 0; j < 16; j++) { wearPx(px0, py0 + j, true); wearPx(px0 + 1, py0 + j, false); }
    if (rt === '=') for (let j = 0; j < 16; j++) { wearPx(px0 + 15, py0 + j, true); wearPx(px0 + 14, py0 + j, false); }
  }
}

// ============================================================
// MURO DE SILLERÍA ('#')
// ============================================================

function paintWall(
  x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string, at?: NeighborFn,
): void {
  ensureWallRows();
  const crypt = isCrypt(mapId);
  const ci = crypt ? 1 : 0;
  const tones = WALL_TONES[ci];
  const mortar = WALL_MORTAR[ci];
  const px0 = tx * 16, py0 = ty * 16;

  for (let ly = 0; ly < 16; ly++) {
    const gy = py0 + ly;
    const b = wBand[gy], y0 = wY0![gy], h = wH![gy];
    const w = wW[gy], off = wOff[gy];
    const ry = gy - y0;                // fila dentro de la hilada
    for (let lx = 0; lx < 16; lx++) {
      const gx = px0 + lx;
      const u = gx + off;
      const si = Math.floor(u / w);    // piedra de la hilada
      const us = u - si * w;
      const sh = h32(si * 13 + b * 57, b * 29 + si * 3);
      let c: string;
      if (sh < 0.08) {
        // piedra faltante: hueco oscuro con dither
        c = ((gx + gy) & 1) === 0 ? '#32323e' : '#2a2a34';
      } else if (ry === h - 1 || us === 0) {
        // juntas hondas (cripta): núcleo más oscuro en cruces y tramos
        c = crypt && h32(gx + 53, gy + 29) < (ry === h - 1 && us === 0 ? 0.5 : 0.18)
          ? '#2a2a34'
          : mortar;                    // juntas de mortero (horiz. y vertical)
      } else {
        const tone = tones[pick(h32(si * 17 + b * 3, b * 5 + si * 11), 5)];
        if (ry === 0 || us === 1) {
          c = tone.l;                  // cara iluminada arriba-izq
        } else if (us === w - 1 || (h >= 5 && ry === h - 2)) {
          c = tone.d;                  // sombra abajo-der
        } else {
          const n = hash2(gx, gy);
          c = n > 0.93 ? tone.l : n < 0.07 ? tone.d : tone.b;
        }
        // liquen ocasional en la parte baja de la piedra
        if (sh > 0.3 && sh < 0.38 && ry >= h - 3 && h32(gx + 77, gy + 13) > 0.6) {
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

  // --- R4-A7b · humedades: manchas oscuras difusas en bandas verticales ---
  if (crypt) {
    for (let ly = 0; ly < 16; ly++) {
      for (let lx = 0; lx < 16; lx++) {
        const gx = px0 + lx, gy = py0 + ly;
        const dv = vnoise(gx >> 1, gy, 5, 711) * 0.7 + vnoise(gx >> 1, gy, 3, 717) * 0.3;
        if (dv > 0.68) p1(x, gx, gy, WALL_DAMP);
        else if (dv > 0.63 && ((gx + gy) & 1) === 0) p1(x, gx, gy, WALL_DAMP);
      }
    }
    // --- grietas con ruta: fisura global que continúa en el tile vecino ---
    x.fillStyle = '#2a2a34';
    for (let ly = 0; ly < 16; ly++) {
      for (let lx = 0; lx < 16; lx++) {
        const gx = px0 + lx, gy = py0 + ly;
        if (wallCrack(gx, gy)) x.fillRect(gx, gy, 1, 1);
      }
    }
  }

  // musgo/liquen verde-grisáceo en RACIMOS (ruido de valor, no salteado)
  if (!at || at(0, 1) !== '#') {
    const dens = crypt ? 0.58 : 0.53;
    for (let ly = 10; ly <= 14; ly++) {  // fila 15 la pinta el canto del suelo
      for (let lx = 0; lx < 16; lx++) {
        const gx = px0 + lx, gy = py0 + ly;
        const m = vnoise(gx, gy, 7, 751) * 0.6 + vnoise(gx, gy, 3, 757) * 0.4;
        const edge = (ly - 8) / 7;       // más denso cuanto más abajo
        const wet = crypt && (wallCrack(gx, gy - 1) || wallCrack(gx, gy + 1)) ? 0.05 : 0;
        if (m > dens + (1 - edge) * 0.10 - wet) {
          p1(x, gx, gy, h32(gx, gy + 5) > 0.6 ? '#56654c' : '#46584a');
        }
      }
    }
  }

  // --- R10-8 · musgo PÚRPURA del Eco (cripta v2): racimos que TREPAN por
  // la sillería (el musgo verde queda a nivel de suelo; el púrpura asciende
  // — la corrosión del canto sube por el muro). Por hash, determinista.
  if (crypt) {
    for (let ly = 1; ly <= 13; ly++) {
      for (let lx = 0; lx < 16; lx++) {
        const gx = px0 + lx, gy = py0 + ly;
        const m = vnoise(gx, gy, 6, 831) * 0.62 + vnoise(gx, gy, 3, 837) * 0.38;
        if (m > 0.76) {
          const r = h32(gx * 3 + 5, gy + 27);
          p1(x, gx, gy, r > 0.82 ? MOS_PURPLE[0] : r > 0.38 ? MOS_PURPLE[1] : MOS_PURPLE[2]);
          if (r > 0.985) p1(x, gx, gy - 1, MOS_PURPLE_HI); // brillo raro del Eco
        }
      }
    }
  }

  // --- R4-A7b · runas tenues de sillería: 2-3 trazos 1px en ~12% ---
  const ru = h32(tx * 2 + 1, ty * 2 + 3);
  if (crypt && ru > 0.44 && ru < 0.56) {
    const g = RUNE_STROKES[pick(h32(tx + 13, ty + 31), 4)];
    const rx = px0 + 3 + Math.floor(h32(tx + 7, ty + 3) * 8);
    const ryy = py0 + 4 + Math.floor(h32(tx + 5, ty + 17) * 7);
    x.fillStyle = RUNE_FAINT;
    for (const s of g) x.fillRect(rx + s[0], ryy + s[1], 1, 1);
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

  // --- R10-8 · ARCO DE MEDIO PUNTO (cripta v2): la cara del muro que
  // corona un hueco transitable de 1 tile flanqueado por muros se talla
  // con vano, rosca de dovelas y clave — el «arco de entrada imponente»
  // del contrato, construido con tiles existentes (detección pura de at()).
  if (crypt && at) {
    const bl = at(0, 1);
    if (WALK_C.indexOf(bl) >= 0 && at(-1, 1) === '#' && at(1, 1) === '#') {
      carveArch(x, px0, py0);
    }
  }
}

/**
 * R10-8 · Vano de medio punto tallado en la cara de un muro (cripta).
 * Hueco negro con esquinas en corte + rosca de dovelas iluminada + clave
 * con sombra + impostas de arranque. Solo pinta DENTRO del tile 16×16.
 */
function carveArch(x: CanvasRenderingContext2D, wx: number, wy: number): void {
  // hueco (semicírculo r≈4 con centro en 8,14)
  px(x, wx + 6, wy + 10, 4, 1, '#100e18');
  px(x, wx + 5, wy + 11, 6, 1, '#100e18');
  px(x, wx + 5, wy + 12, 6, 1, '#100e18');
  px(x, wx + 4, wy + 13, 8, 3, '#100e18');
  // rosca (dovelas) + clave
  px(x, wx + 6, wy + 9, 4, 1, '#7a7a90');
  p1(x, wx + 5, wy + 10, '#6e6e84'); p1(x, wx + 10, wy + 10, '#6e6e84');
  p1(x, wx + 4, wy + 12, '#6a6a80'); p1(x, wx + 11, wy + 12, '#6a6a80');
  px(x, wx + 7, wy + 8, 2, 1, '#8e8ea2');           // clave del arco
  p1(x, wx + 7, wy + 9, '#5e5e74');                 // sombra bajo la clave
  // impostas de arranque
  px(x, wx + 2, wy + 13, 2, 3, '#66667e');
  px(x, wx + 12, wy + 13, 2, 3, '#5a5a72');
  // desconchón por hash en la rosca
  if (h32(wx + 3, wy + 41) > 0.55) p1(x, wx + 6 + Math.floor(h32(wx, wy + 43) * 4), wy + 9, '#5e5e74');
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

function paintWood(
  x: CanvasRenderingContext2D, tx: number, ty: number, at?: NeighborFn,
): void {
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

  // R4-A7b: sombra de contacto de 1px hacia el vecino inferior
  if (at && at(0, 1) !== '_') {
    px(x, px0, py0 + 15, 16, 1, WOOD_NAIL);
    // calas que dejan entrever la junta (no una línea perfecta)
    for (let i = 0; i < 16; i += 2) {
      if (h32(px0 + i, ty * 7 + 3) > 0.5) p1(x, px0 + i, py0 + 15, WOOD_KNOT);
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
  // grieta VERTICAL en el fuste: nace junto a la basa y sube con codo
  if (h32(tx + 7, ty + 41) > 0.78) {
    let fx = px0 + 4 + Math.floor(h32(tx + 4, ty + 2) * 6);
    const fy = py0 + 6 - Math.floor(h32(tx + 3, ty + 9) * 2);
    const len = Math.min(5 + Math.floor(h32(tx + 9, ty + 13) * 4), fy - (py0 - 2));
    x.fillStyle = P.shaftD;
    for (let j = 0; j < len; j++) {
      x.fillRect(fx, fy - j, 1, 1);
      if (j === 3 && h32(tx + 2, ty + 5) > 0.5) fx += 1;   // codo
    }
  }
  // basa más ancha: moldura + plinto
  px(x, px0 + 2, py0 + 9, 12, 2, P.base);
  px(x, px0 + 2, py0 + 9, 12, 1, P.baseL);
  px(x, px0 + 1, py0 + 11, 14, 4, P.base);
  px(x, px0 + 1, py0 + 11, 14, 1, P.baseL);
  px(x, px0 + 1, py0 + 14, 14, 1, P.baseD);
  // R4-A7b: moldura de dos tonos (filete en sombra bajo el astrágalo)
  px(x, px0 + 2, py0 + 10, 12, 1, P.shaftD);
  // base desgastada: desconchones por hash en el plinto
  for (const cxx of [px0 + 1, px0 + 3, px0 + 12, px0 + 14]) {
    if (h32(cxx * 5 + ty, ty * 3 + 21) > 0.55) {
      p1(x, cxx, py0 + 12, P.baseD);
      p1(x, cxx, py0 + 13, P.ground);
    }
  }
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
  // R4-A7b: base desgastada — desconchones en las esquinas del cuerpo
  p1(x, px0 + 3, py0 + 13, '#3e3e4c');
  p1(x, px0 + 12, py0 + 13, '#3e3e4c');
  if (h32(tx * 3 + 1, ty * 5 + 9) > 0.5) {
    p1(x, px0 + 4, py0 + 13, '#3e3e4c');
    p1(x, px0 + 3, py0 + 12, '#3e3e4c');
  }
  if (h32(tx * 3 + 2, ty * 5 + 11) > 0.5) {
    p1(x, px0 + 11, py0 + 13, '#3e3e4c');
    p1(x, px0 + 12, py0 + 12, '#3e3e4c');
  }
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
// R10-8 · PINCHOS ('^') — trampa determinista de la cripta
// Fórmula duplicada textualmente del contrato R10-3 (update.ts:1297):
// stone.ts no puede importar update.ts (ciclo engine→sprites→stone).
// ============================================================

/** Fase del pincho ∈ [0,2) — ciclo 2×1.2 = 2.4 s, offset por tile (hash2×2). */
function spikePhase(tx: number, ty: number, gt: number): number {
  return (gt / 1.2 + hash2(tx * 7 + 11, ty * 13 + 7) * 2) % 2;
}

/**
 * Socket permanente del pincho (prerrender, se pinta bajo la capa animada):
 * boca hundida 10×4, borde desportillado, grietas radiales y esquirlas de
 * hueso — a 1 vista se lee «algo sale de aquí» incluso retraído.
 */
function drawSpikeSocket(
  x: CanvasRenderingContext2D, tx: number, ty: number, ci: number,
): void {
  const wx = tx * 16, wy = ty * 16;
  const T = SPK_TONES[ci];
  px(x, wx + 3, wy + 11, 10, 4, '#16141e');       // boca hundida
  px(x, wx + 4, wy + 11, 8, 1, '#0c0a12');        // sombra interior superior
  for (let i = 0; i < 12; i++) {                  // borde desportillado
    const r = h32(wx + i, wy * 3 + 5);
    if (r > 0.30) p1(x, wx + 2 + i, wy + 10, r > 0.72 ? '#4c4a58' : '#3a3846');
    if (h32(wx + i + 7, wy * 3 + 9) > 0.55) p1(x, wx + 2 + i, wy + 15, '#2e2c38');
  }
  p1(x, wx + 2, wy + 12, '#3a3846');
  p1(x, wx + 13, wy + 12, '#4c4a58');
  // grietas radiales cortas
  if (h32(tx * 5 + 1, ty * 3 + 2) > 0.45) { p1(x, wx + 1, wy + 9, '#2a2834'); p1(x, wx, wy + 8, '#2a2834'); }
  if (h32(tx * 5 + 3, ty * 3 + 4) > 0.45) { p1(x, wx + 14, wy + 14, '#2a2834'); p1(x, wx + 15, wy + 15, '#2a2834'); }
  // esquirlas de hueso asomando (aviso pasivo del socket)
  p1(x, wx + 1 + Math.floor(h32(tx, ty + 21) * 2), wy + 9, T.shade);
  p1(x, wx + 13 - Math.floor(h32(tx + 3, ty + 23) * 2), wy + 14, T.body);
}

/**
 * Estado ANIMADO del pincho (px de mundo — sirve al overlay con scale(Z,Z)
 * y a drawTile en vivo si algún día se llama con t>0):
 *  AVISO  (fase ≥1.75): punta asomando 2 px (telegrafía del contrato).
 *  ARRIBA (fase <0.55): aguja de hueso 12 filas + laterales por hash,
 *    subida en rampa 0.12 s (budget de filas), brillo frío al completarse
 *    y chispa lenta sobre la punta; polvo en el disparo.
 *  Retraído: nada (el socket del prerrender queda visible).
 */
function drawSpike(
  x: CanvasRenderingContext2D, tx: number, ty: number, ph: number,
  ci: number, gt: number,
): void {
  const wx = tx * 16, wy = ty * 16, cx = wx + 8, by = wy + 13;
  const T = SPK_TONES[ci];
  const up = ph < 0.55;
  if (!up) {
    if (ph >= 1.75) {                             // TELEGRAFÍA: punta 2 px
      p1(x, cx, wy + 2, T.tip);
      p1(x, cx, wy + 3, T.lit);
    }
    return;
  }
  const rise = Math.min(1, ph / 0.1);             // 0.12 s de disparo
  const budget = Math.ceil(rise * 12);            // filas visibles
  for (let i = 0; i < budget; i++) {              // aguja central
    const y = by - i, w = SPIKE_W[i], x0 = cx - (w >> 1);
    px(x, x0, y, w, 1, i >= 9 ? T.tip : T.body);
    if (w >= 2) p1(x, x0, y, T.lit);
    if (w >= 3) p1(x, x0 + w - 1, y, T.shade);
  }
  if (budget >= 1) px(x, cx - 3, by + 1, 6, 1, '#0c0a12'); // asiento en la boca
  const hL = h32(tx * 3 + 5, ty * 7 + 1);
  if (hL > 0.40) {                                // pincho lateral izq.
    const bL = Math.ceil(rise * 5);
    for (let i = 0; i < bL; i++) {
      if (i < 2) px(x, cx - 6, by - i, 3, 1, T.body);
      else px(x, cx - 5, by - i, 2, 1, i >= 4 ? T.tip : T.body);
    }
  }
  if (h32(tx * 3 + 9, ty * 7 + 3) > 0.55) {       // pincho lateral der.
    const bR = Math.ceil(rise * 4);
    for (let i = 0; i < bR; i++) {
      if (i < 2) px(x, cx + 4, by - i, 3, 1, T.body);
      else px(x, cx + 4, by - i, 2, 1, i >= 3 ? T.tip : T.body);
    }
  }
  if (budget >= 12) {                             // brillo frío (activo)
    p1(x, cx, wy + 2, T.glint2);
    p1(x, cx - 1, wy + 5, T.glint);
    p1(x, cx - 2, wy + 6, T.glint);
    if (Math.floor(gt * 2 + hL * 13) % 3 === 0) { // chispa lenta sobre la punta
      p1(x, cx, wy, T.glint2);
      p1(x, cx, wy + 1, T.glint);
    }
  }
  if (ph < 0.08) {                                // polvo del disparo
    p1(x, cx - 5, wy + 10, T.dust);
    p1(x, cx + 6, wy + 12, T.dust);
    if (hL > 0.7) p1(x, cx - 1, wy + 8, T.dust);
  }
}

const SP_AQ = 94; // charCodeAt de '^'
let spSnap = new Uint8Array(0); // snapshot del viewport (solo crece)

/**
 * CAPA ANIMADA de los pinchos — 1 llamada por frame desde render.ts
 * (enganche EXACTO en la cabecera del módulo). Misma convención que
 * waterOverlay: camX/camY en px de PANTALLA, at ABSOLUTO con época.
 * Recorre solo el viewport, early-out si no hay '^' visible, cero
 * allocations por frame (snapshot en Uint8Array reutilizado).
 */
export function spikesOverlay(
  x: CanvasRenderingContext2D, camX: number, camY: number, t: number,
  mapId: string, at: (tx: number, ty: number) => string,
): void {
  const viewW = VIEW_W / Z, viewH = VIEW_H / Z;
  const gx = Math.floor(camX / Z), gy = Math.floor(camY / Z);
  const vx0 = Math.floor(gx / 16), vx1 = Math.ceil((gx + viewW) / 16);
  const vy0 = Math.floor(gy / 16), vy1 = Math.ceil((gy + viewH) / 16);
  const w = vx1 - vx0 + 3, h = vy1 - vy0 + 3;
  if (spSnap.length < w * h) spSnap = new Uint8Array(w * h);
  const sx0 = vx0 - 1, sy0 = vy0 - 1;
  let has = false;
  for (let r = 0; r < h; r++) {
    const row = r * w, ty = sy0 + r;
    for (let c = 0; c < w; c++) {
      const code = at(sx0 + c, ty).charCodeAt(0);
      spSnap[row + c] = code;
      if (code === SP_AQ) has = true;
    }
  }
  if (!has) return;
  const ci = isCrypt(mapId) ? 0 : 1;
  x.save();
  x.translate(-gx * Z, -gy * Z);                  // espacio de mundo ×Z
  x.scale(Z, Z);
  for (let r = 1; r < h - 1; r++) {
    const ty = sy0 + r, row = r * w;
    for (let c = 1; c < w - 1; c++) {
      if (spSnap[row + c] !== SP_AQ) continue;
      const tx = sx0 + c;
      drawSpike(x, tx, ty, spikePhase(tx, ty, t), ci, t);
    }
  }
  x.restore();
}

// ============================================================
// R10-8 · PALANCA ('L') — mecanismo del Eco empotrado en piedra
// Prerrender: APAGADA (brazo izq., perilla de hueso). Activada: la pinta
// el orquestador con leversOverlay (flag 'cripta_lever_<tx>_<ty>' de
// R10-3) o repaint único con paintLeverOn. El núcleo repinta el bloque
// de piedra OPACO en ambos estados → cero fantasma del brazo anterior.
// ============================================================

/** Núcleo de dibujo (ox,oy origen del tile, z escala — 1 en prerrender). */
function drawLeverCore(
  x: CanvasRenderingContext2D, ox: number, oy: number, z: number, on: boolean,
): void {
  const R = (dx: number, dy: number, w: number, h: number, c: string): void => {
    x.fillStyle = c; x.fillRect(ox + dx * z, oy + dy * z, w * z, h * z);
  };
  const P = (dx: number, dy: number, c: string): void => {
    x.fillStyle = c; x.fillRect(ox + dx * z, oy + dy * z, z, z);
  };
  // bloque de piedra (repite idéntico en ambos estados: cubre el brazo previo)
  R(2, 4, 12, 11, LEV.block);
  R(2, 4, 12, 1, LEV.blockL);
  R(2, 5, 1, 10, LEV.blockLL);
  R(2, 14, 12, 1, LEV.blockD);
  R(13, 5, 1, 10, LEV.blockDR);
  P(3, 7, LEV.chip); P(12, 12, LEV.chip); P(6, 4, LEV.chip);   // desconchones
  // hornacina + soporte del pivote
  R(4, 6, 8, 7, on ? LEV.recessTopOn : LEV.recess);
  R(4, 6, 8, 1, on ? '#0b1c22' : LEV.recessTop);
  R(7, 9, 2, 3, LEV.mount);
  R(7, 9, 2, 1, LEV.mountL);
  if (on) {
    // brazo ARRIBA a la derecha + perilla-runa encendida
    R(8, 9, 2, 2, LEV.arm);
    R(9, 7, 2, 2, LEV.armL);
    R(10, 5, 2, 2, LEV.glow);
    P(10, 5, LEV.glowHi);
    P(9, 4, LEV.glowDim); P(11, 4, LEV.glowDim); P(12, 5, LEV.glowDim); P(12, 7, LEV.glowDim);
    R(9, 12, 3, 1, LEV.slot);                    // ranura derecha vacía
    P(3, 5, LEV.runeLit); P(12, 10, LEV.runeLit);// runas del bloque despiertan
  } else {
    // brazo ABAJO a la izquierda + perilla de hueso apagada
    R(4, 10, 4, 1, LEV.arm);
    R(4, 11, 4, 1, LEV.armD);
    R(4, 9, 2, 2, LEV.knob);
    P(4, 10, LEV.knobD);
    R(4, 12, 4, 1, LEV.slot);                    // ranura izquierda vacía
    P(3, 5, LEV.rune); P(12, 10, LEV.rune);      // runas dormidas
  }
}

/** Repaint único (px de mundo) del tile con la palanca ACTIVADA. */
export function paintLeverOn(
  x: CanvasRenderingContext2D, tx: number, ty: number,
): void {
  drawLeverCore(x, tx * 16, ty * 16, 1, true);
}

/** Versión en px de PANTALLA (por si el orquestador prefiere overlay). */
export function drawLeverOnAt(
  x: CanvasRenderingContext2D, sxT: number, syT: number, zoom: number,
): void {
  drawLeverCore(x, sxT, syT, zoom, true);
}

// caché de palancas del mapa (rescan solo al cambiar el array rows) —
// claves pre-horneadas: cero concat de strings en el hot path
let lvRows: string[] | null = null;
const lvX: number[] = [], lvY: number[] = [], lvK: string[] = [];

function leverScan(rows: string[]): void {
  if (lvRows === rows) return;
  lvRows = rows;
  lvX.length = 0; lvY.length = 0; lvK.length = 0;
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = r.indexOf('L'); x >= 0; x = r.indexOf('L', x + 1)) {
      lvX.push(x); lvY.push(y);
      lvK.push('cripta_lever_' + x + '_' + y);   // clave EXACTA de R10-3
    }
  }
}

/**
 * Palancas ACTIVADAS — 1 llamada por frame desde render.ts:
 *   leversOverlay(octx, camX, camY, g.rows, g.flags);
 * Recorre las palancas cacheadas del mapa, culling al viewport, y pinta el
 * estado ON solo donde flags['cripta_lever_<tx>_<ty>'] es truthy.
 */
export function leversOverlay(
  x: CanvasRenderingContext2D, camX: number, camY: number,
  rows: string[], flags: Record<string, number | boolean | string>,
): void {
  leverScan(rows);
  const n = lvX.length;
  if (n === 0) return;
  const gx = Math.floor(camX / Z), gy = Math.floor(camY / Z);
  const wx0 = gx - 16, wx1 = gx + VIEW_W / Z + 16;
  const wy0 = gy - 20, wy1 = gy + VIEW_H / Z + 20;
  let any = false;
  for (let i = 0; i < n; i++) {
    const wx = lvX[i] * 16, wy = lvY[i] * 16;
    if (wx < wx0 || wx > wx1 || wy < wy0 || wy > wy1) continue;
    if (!flags[lvK[i]]) continue;
    if (!any) { x.save(); x.translate(-gx * Z, -gy * Z); x.scale(Z, Z); any = true; }
    drawLeverCore(x, wx, wy, 1, true);
  }
  if (any) x.restore();
}

// ============================================================
// R10-8 · PUERTA ('D') de la sala de puzzle — batiente de piedra con
// jambas, dos hojas, inhierros y la runa del Eco grabada (tenue).
// Cerrada: prerrender. Abierta (cryptDoorOpen de R10-3): doorsOverlay
// por frame o repaint único con paintDoorOpen — el núcleo repinta el
// tile COMPLETO de forma opaca → cero fantasma de la puerta cerrada.
// ============================================================

function doorClosedCore(
  x: CanvasRenderingContext2D, ox: number, oy: number, z: number,
): void {
  const R = (dx: number, dy: number, w: number, h: number, c: string): void => {
    x.fillStyle = c; x.fillRect(ox + dx * z, oy + dy * z, w * z, h * z);
  };
  const P = (dx: number, dy: number, c: string): void => {
    x.fillStyle = c; x.fillRect(ox + dx * z, oy + dy * z, z, z);
  };
  // dintel + jambas
  R(0, 0, 16, 2, DOR.lintel);
  R(0, 1, 16, 1, DOR.lintelD);
  R(0, 2, 2, 14, DOR.jamb);
  R(1, 2, 1, 14, DOR.jambD);
  R(14, 2, 2, 14, DOR.jamb);
  R(14, 2, 1, 14, DOR.jambL);
  // batiente: dos hojas con bandas
  R(2, 2, 12, 12, DOR.slab);
  R(2, 2, 12, 2, DOR.slabL);
  R(2, 5, 12, 1, DOR.seam);
  R(2, 9, 12, 1, DOR.seam);
  R(2, 10, 12, 4, DOR.slabD);
  R(7, 2, 1, 12, DOR.seam);                      // junta central de las hojas
  R(8, 2, 1, 12, DOR.slabL);
  // inhierros (placas) en las esquinas de las hojas
  R(3, 3, 2, 2, DOR.boss); P(4, 4, DOR.bossD);
  R(11, 3, 2, 2, DOR.boss); P(12, 4, DOR.bossD);
  R(3, 11, 2, 2, DOR.boss); P(4, 12, DOR.bossD);
  R(11, 11, 2, 2, DOR.boss); P(12, 12, DOR.bossD);
  // runa del Eco grabada (rombo tenue + núcleo)
  P(7, 5, DOR.rune); P(8, 5, DOR.rune);
  P(6, 6, DOR.rune); P(9, 6, DOR.rune);
  P(5, 7, DOR.rune); P(10, 7, DOR.rune);
  P(6, 8, DOR.rune); P(9, 8, DOR.rune);
  P(7, 9, DOR.rune); P(8, 9, DOR.rune);
  P(7, 7, DOR.runeLit); P(8, 7, DOR.runeLit);
  // umbral desgastado
  R(2, 14, 12, 2, DOR.thr);
  for (let i = 0; i < 12; i++) {
    if (h32(ox + 2 + i, oy + 15) > 0.62) P(2 + i, 15, DOR.thrL);
  }
}

function doorOpenCore(
  x: CanvasRenderingContext2D, ox: number, oy: number, z: number,
): void {
  const R = (dx: number, dy: number, w: number, h: number, c: string): void => {
    x.fillStyle = c; x.fillRect(ox + dx * z, oy + dy * z, w * z, h * z);
  };
  const P = (dx: number, dy: number, c: string): void => {
    x.fillStyle = c; x.fillRect(ox + dx * z, oy + dy * z, z, z);
  };
  // marco idéntico (repintado opaco: cubre la cerrada)
  R(0, 0, 16, 2, DOR.lintel);
  R(0, 1, 16, 1, DOR.lintelD);
  R(0, 2, 2, 14, DOR.jamb);
  R(1, 2, 1, 14, DOR.jambD);
  R(14, 2, 2, 14, DOR.jamb);
  R(14, 2, 1, 14, DOR.jambL);
  // vano: oscuridad con resbalón de luz del suelo lejano
  R(2, 2, 12, 12, DOR.void0);
  R(2, 2, 12, 1, DOR.voidD);
  R(2, 3, 1, 11, DOR.voidD);
  R(2, 9, 8, 5, DOR.roomFloor);
  R(2, 9, 8, 1, DOR.roomFloorL);
  // hoja deslizada dentro de la jamba derecha
  R(10, 2, 4, 12, DOR.slab);
  R(10, 2, 1, 12, DOR.slabL);
  R(10, 5, 4, 1, DOR.seam);
  R(10, 9, 4, 1, DOR.seam);
  R(10, 10, 4, 4, DOR.slabD);
  R(11, 3, 2, 2, DOR.boss); P(12, 4, DOR.bossD);
  R(11, 11, 2, 2, DOR.boss); P(12, 12, DOR.bossD);
  // umbral: línea de luz fría + residuo cian del Eco
  R(2, 14, 12, 2, DOR.thr);
  R(3, 14, 10, 1, DOR.thrOpen);
  P(4, 15, DOR.resid); P(8, 15, DOR.resid); P(11, 15, DOR.resid);
}

/** Repaint único (px de mundo) del tile con la puerta ABIERTA. */
export function paintDoorOpen(
  x: CanvasRenderingContext2D, tx: number, ty: number,
): void {
  doorOpenCore(x, tx * 16, ty * 16, 1);
}

/** Versión en px de PANTALLA (por si el orquestador prefiere overlay). */
export function drawDoorOpenAt(
  x: CanvasRenderingContext2D, sxT: number, syT: number, zoom: number,
): void {
  doorOpenCore(x, sxT, syT, zoom);
}

/**
 * Puerta ABIERTA — 1 llamada por frame desde render.ts:
 *   doorsOverlay(octx, camX, camY, g.rows, cryptDoorOpen(g));
 * No-op si open=false (el prerrender ya pintó la cerrada). Recorre SOLO el
 * viewport con acceso directo a rows (sin at(), sin allocations).
 */
export function doorsOverlay(
  x: CanvasRenderingContext2D, camX: number, camY: number,
  rows: string[], open: boolean,
): void {
  if (!open) return;
  const gx = Math.floor(camX / Z), gy = Math.floor(camY / Z);
  const vx0 = Math.max(0, Math.floor(gx / 16)), vx1 = Math.ceil((gx + VIEW_W / Z) / 16);
  const vy0 = Math.max(0, Math.floor(gy / 16)), vy1 = Math.ceil((gy + VIEW_H / Z) / 16);
  let any = false;
  for (let ty = vy0; ty < Math.min(vy1, rows.length); ty++) {
    const r = rows[ty];
    for (let tx = vx0; tx < Math.min(vx1, r.length); tx++) {
      if (r.charCodeAt(tx) !== 68) continue;     // 'D'
      if (!any) { x.save(); x.translate(-gx * Z, -gy * Z); x.scale(Z, Z); any = true; }
      doorOpenCore(x, tx * 16, ty * 16, 1);
    }
  }
  if (any) x.restore();
}

// ============================================================
// R10-8 · CAMINO ('=') en cripta/arena — suelo de piedra con desgaste.
// LUNARIS/BOSQUE: replica EXACTA del default anterior de drawTile
// (rect verde plano #4f8a46) para no alterar su look (decisión de R10-1).
// ============================================================

function paintPath(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  mapId: string, at?: NeighborFn,
): void {
  if (mapId !== 'arena' && !isCrypt(mapId)) {
    px(x, tx * 16, ty * 16, 16, 16, '#4f8a46');
    return;
  }
  floorBase(x, tx, ty, mapId);
  floorSeams(x, tx, ty, mapId, at);
  const px0 = tx * 16, py0 = ty * 16;
  const horiz = !!at && (at(-1, 0) === '=' || at(1, 0) === '=');
  const vert = !!at && (at(0, -1) === '=' || at(0, 1) === '=');
  if (isCrypt(mapId)) {
    // procesión desgastada: dos rodadas paralelas según la dirección del corredor
    if (horiz) {
      for (let i = 0; i < 16; i++) {
        if (h32(px0 + i, py0 + 4) > 0.30) p1(x, px0 + i, py0 + 4, '#5a5a72');
        if (h32(px0 + i, py0 + 11) > 0.30) p1(x, px0 + i, py0 + 11, '#5a5a72');
      }
    } else if (vert) {
      for (let j = 0; j < 16; j++) {
        if (h32(px0 + 4, py0 + j) > 0.30) p1(x, px0 + 4, py0 + j, '#5a5a72');
        if (h32(px0 + 11, py0 + j) > 0.30) p1(x, px0 + 11, py0 + j, '#5a5a72');
      }
    }
  } else {
    // anillo de combate: banda pálida discontinua en el eje del camino
    if (horiz) dither(x, px0, py0 + 7, 16, 2, '#8a8a96');
    else if (vert) dither(x, px0 + 7, py0, 2, 16, '#8a8a96');
    if (h32(tx * 5 + 3, ty * 3 + 9) > 0.55) {
      px(x, px0 + 3 + Math.floor(h32(tx + 1, ty + 5) * 9),
        py0 + 3 + Math.floor(h32(tx + 7, ty + 2) * 9), 3, 1, '#5a5a64'); // roce
    }
  }
}

// ============================================================
// DESPACHO
// ============================================================

export function paintStone(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, at?: NeighborFn,
): void {
  // t=0 en el prerrender de buildGround (todo estático); los cases '^' y 'L'
  // de R10-8 usan t SOLO si algún día drawTile se llama en vivo (t>0):
  // el camino normal de animación es spikesOverlay (ver cabecera).
  switch (ch) {
    case ':':
      floorBase(x, tx, ty, mapId);
      floorSeams(x, tx, ty, mapId, at);
      break;
    case '_':
      paintWood(x, tx, ty, at);
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
    // —— R10-8 · cripta de Zelda (contrato R10-3; enganche en sprites.ts) ——
    case '^': {                              // SUELO: socket + capa animada
      floorBase(x, tx, ty, mapId);
      floorSeams(x, tx, ty, mapId, at);
      const ci = isCrypt(mapId) ? 0 : 1;
      drawSpikeSocket(x, tx, ty, ci);
      if (t > 0) drawSpike(x, tx, ty, spikePhase(tx, ty, t), ci, t);
      break;
    }
    case 'L':                                // palanca APAGADA (ON vía overlay)
      floorBase(x, tx, ty, mapId);
      floorSeams(x, tx, ty, mapId, at);
      drawLeverCore(x, tx * 16, ty * 16, 1, false);
      break;
    case 'D':                                // puerta CERRADA (ON vía overlay)
      doorClosedCore(x, tx * 16, ty * 16, 1);
      break;
    case '=':                                // camino (cripta/arena piedra)
      paintPath(x, tx, ty, mapId, at);
      break;
  }
}
