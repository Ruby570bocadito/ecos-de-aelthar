// ============================================================
// ECOS DE AELTHAR — Cielo y ciclo día/noche (R1-A8 · v2 R4-A2)
// drawSkyBackdrop  : fondo de cielo completo (TITLE SCREEN y transiciones)
// drawDayNightGrade: grading de dayT sobre el mundo (se dibuja antes del HUD)
//                    + nubes v2 (cuerpos), banda de amanecer/anochecer,
//                    estrellas fugaces raras y niebla de amanecer (lunaris)
// drawCloudShadows : sombras en suelo de las nubes v2 (exteriores de día)
//
// Todo determinista (hash2 + globalT/dayT), fillRect enteros y cachés
// perezosas (patrones dither 2×2 / luna / nubes pre-pintadas) sin
// allocations masivas por frame.
//
// NOVEDADES R4-A2 (aditivo, firmas intactas):
//  1) NUBES V2 — 5-8 nubes únicas por mapa (semilla por mapId) con silueta
//     lobulada multi-blob (3-6 blobs, prerender a canvas caché), que derivan
//     con el VIENTO del mapa (dirección/velocidad por hash(mapId)) y hacen
//     wrapper por los bordes del mapa. Los CUERPOS se pintan en
//     drawDayNightGrade (encima de entidades, bajo el HUD — una nube alta
//     tapa al jugador, no al revés) y las SOMBRAS en drawCloudShadows
//     (capa suelo, bajo entidades) desplazadas 12-20 px (euclídeo) de la
//     nube "virtual". Ambas comparten cloudPlanAt() → mismo estado.
//  2) GRADING V2 — el mezclador Bayer cuantizado (5 saltos) se sustituye
//     por interpolación continua rgba y la banda de transición se ensancha
//     (TRANS_W 0.018 → 0.06): sin saltos de alpha entre etapas.
//     + banda rosada-naranja tenue en los bordes horizontales durante
//     dayT 0.20-0.30 y 0.65-0.75 (escalones de alpha, sin gradiente).
//  3) ESTRELLA fugaz rara (≈1 por ~40 s de noche, trazo de ~7 px con fade,
//     ventana temporal determinista por globalT). Las estrellas fijas viven
//     en fx.ts (drawAmbient 'sky'), módulo INTOCABLE para este agente;
//     drawDayNightGrade SÍ puede albergar la fugaz: corre en play/dialogue,
//     sobre la iluminación y ANTES de drawAmbient('sky') (la fugaz queda
//     bajo las estrellas fijas, sin conflicto visual).
//  4) NIEBLA DE AMANECER — bandas horizontales bajas dithered (Bayer 2×2)
//     solo en lunaris (valle) durante el alba, con deriva por tile.
//
// R5-O4 (optimización): ESTRELLAS pre-renderizadas a 3 canvas estáticos
// (posiciones hash2 intactas; deriva/parallax por drawImage envuelto y
// twinkle por alpha alternante de capa), plan de nubes con array
// prealocado y memo por campos (cero strings/objetos por frame),
// transitionAt con objeto reutilizado + memo, strings rgba de grading/
// banda/niebla precalculados por escalón (fillStyle sin parsear),
// bandas del backdrop escaladas a VIEW_H dinámico y MIST_BANDS como
// fracción de VIEW_H.
//
// Calibración con el motor (update.ts / engine.ts / render.ts):
//  - dayT avanza dt/240  → ciclo completo de 240 s.
//  - luz del motor: dayLight = max(0.1, sin(dayT·2π)·1.25 + 0.25)
//    (pico de mediodía en dayT 0.25, meseta nocturna ~0.55–0.95).
//  - isNight() de update.ts: dayT > 0.7 || dayT < 0.08.
//  - el motor llama "alba" a dayT 0.15 (inicial) y 0.22 (Shift+T).
//  - render.ts ya aplica un tinte cálido gaussiano centrado en 0.52.
// ============================================================

import type { Game } from '../engine';
import { VIEW_W, VIEW_H } from '../consts';
import { hash2, px } from './palette';

// ---------------- Tipos ----------------

/** Tinte RGBA de grading (r, g, b, alpha 0..1). */
export type SkyTint = readonly [number, number, number, number];

export interface DayStage {
  name: string;
  from: number;               // inicio de la franja (dayT 0..1)
  to: number;                 // fin ('noche' envuelve 1 → 0.06)
  tint: SkyTint | null;       // null = franja limpia (mediodía, sin grading)
  sky: string[];              // 6 bandas horizontales del backdrop
  cloudBody: string;          // nubes: cuerpo
  cloudHi: string | null;     // nubes: brillo superior (null = sin brillo nocturno)
  cloudLo: string;            // nubes: sombra de la base plana
  desc: string;
}

// ---------------- DAY_STAGES ----------------
// Franjas de dayT calibradas con el motor: las fronteras 0.06/0.70
// coinciden con isNight(), el amanecer cubre la "alba" del motor
// (0.15–0.22), el mediodía centra el pico de luz (0.25) y el crepúsculo
// rodea el tinte cálido que render.ts ya aplica en 0.52.
//
//  dayT:  0.00    0.06      0.22       0.38      0.52        0.68    1.00
//         └─NOCHE─┴─AMANECER─┴─MEDIODÍA─┴─TARDE───┴─CREPÚSCULO┴─NOCHE──┘
export const DAY_STAGES: readonly DayStage[] = [
  {
    name: 'amanecer',
    from: 0.06, to: 0.22,
    tint: [255, 158, 108, 0.10],            // ámbar-rosa
    sky: ['#191634', '#241e42', '#382850', '#5a3a58', '#8a5462', '#c87a6c'],
    cloudBody: '#6a4a66', cloudHi: '#9a6a78', cloudLo: '#4e3652',
    desc: 'alba del motor (dayT 0.15 inicial · Shift+T espera hasta 0.22)',
  },
  {
    name: 'mediodía',
    from: 0.22, to: 0.38,
    tint: null,                             // pico de luz: sin grading
    sky: ['#2a5cb2', '#3468be', '#4076c8', '#4e84d2', '#5e94da', '#70a4e0'],
    cloudBody: '#f8fbff', cloudHi: '#ffffff', cloudLo: '#ccdcec',
    desc: 'pleno día: nubes blancas de base plana, cielo azul',
  },
  {
    name: 'tarde dorada',
    from: 0.38, to: 0.52,
    tint: [255, 196, 110, 0.08],            // dorado suave
    sky: ['#2a4c94', '#3a5ca2', '#546ea8', '#7c86a4', '#b09878', '#e2bc80'],
    cloudBody: '#f2d9ac', cloudHi: '#fbeccd', cloudLo: '#d0b084',
    desc: 'luz descendente hacia el atardecer (0.52)',
  },
  {
    name: 'crepúsculo',
    from: 0.52, to: 0.68,
    tint: [98, 86, 172, 0.14],              // violeta-azul
    sky: ['#0b0a20', '#12102c', '#1a1838', '#262148', '#342c54', '#443a60'],
    cloudBody: '#3a3260', cloudHi: '#4c4278', cloudLo: '#2c264c',
    desc: 'caída de la luz hacia la meseta nocturna del motor',
  },
  {
    name: 'noche',
    from: 0.68, to: 0.06,                   // envuelve 1 → 0.06
    tint: [22, 32, 78, 0.22],               // azul profundo
    sky: ['#040612', '#070a1a', '#0a0e22', '#0d122a', '#111834', '#16203e'],
    cloudBody: '#161c34', cloudHi: null, cloudLo: '#10152a',
    desc: 'coherente con isNight() (dayT > 0.7 || < 0.08)',
  },
];

const NOCHE = DAY_STAGES.length - 1;        // índice de la franja nocturna
const TAU = Math.PI * 2;
// R4-A2: semiancho de transición entre franjas — ensanchado de 0.018 a 0.06
// (~14.4 s del ciclo de 240 s) y con interpolación CONTINUA rgba: el grading
// ya no salta, se funde.
const TRANS_W = 0.06;

const ZERO_TINT: SkyTint = [0, 0, 0, 0];

/** Modulo positivo (para derivas y parallax que envuelven). */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/**
 * Índice de DAY_STAGES para un dayT dado (maneja el envuelve de la noche).
 * FIX R4-A2: el bucle llega hasta i=0 — en v1 la franja 'amanecer'
 * (0.06-0.22) era inalcanzable (stageIndexAt devolvía NOCHE en toda el
 * alba: salto de grading y cielo nocturno durante el amanecer).
 */
export function stageIndexAt(dayT: number): number {
  const dT = mod(dayT, 1);
  for (let i = NOCHE; i >= 0; i--) {
    if (dT >= DAY_STAGES[i].from) return i;
  }
  return NOCHE;                              // [0, 0.06) aún es noche
}

/** Etapa del día para un dayT (utilidad para el integrador/debug). */
export function stageAt(dayT: number): DayStage {
  return DAY_STAGES[stageIndexAt(dayT)];
}

/**
 * Transición activa cerca de una frontera: etapas a→b y mezcla m 0..1.
 * R5-O4: resultado en objeto REUTILIZADO (los lectores copian a/b/m al
 * momento) + memo de 1 entrada por dT — gradeTintAt, bandas del cielo y
 * nubes lo piden varias veces en el MISMO frame con el mismo dayT.
 */
const TR_RES = { a: 0, b: 0, m: 0 };
let trMemoT = -1;
let trMemoHit = false;
function transitionAt(dT: number): { a: number; b: number; m: number } | null {
  if (dT === trMemoT) return trMemoHit ? TR_RES : null;
  trMemoT = dT;
  for (let i = 0; i < DAY_STAGES.length; i++) {
    const b = DAY_STAGES[i].from;
    const d = mod(dT - b + 0.5, 1) - 0.5;    // distancia circular a la frontera
    if (Math.abs(d) <= TRANS_W) {
      TR_RES.a = mod(i - 1, DAY_STAGES.length);
      TR_RES.b = i;
      TR_RES.m = 0.5 + d / (2 * TRANS_W);
      trMemoHit = true;
      return TR_RES;
    }
  }
  trMemoHit = false;
  return null;
}

// ---------------- Mezcla continua de colores (R4-A2) ----------------

const hexCache = new Map<string, [number, number, number]>();

/** '#rrggbb' → [r, g, b] (parse cacheado). */
function hexRgb(h: string): [number, number, number] {
  let v = hexCache.get(h);
  if (!v) {
    v = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    hexCache.set(h, v);
  }
  return v;
}

/** Mezcla dos colores hex por componentes (m 0..1) → 'rgb(r,g,b)'.
 *  R5-O4: resultado cacheado por (colorA, colorB, escalón 1/64 de m) —
 *  las 6 bandas del backdrop lo piden por frame durante transiciones. */
const mixHexCache = new Map<string, string>();
function mixHex(ha: string, hb: string, m: number): string {
  const q = Math.round(m * 64);
  const key = ha + '|' + hb + '|' + q;
  let s = mixHexCache.get(key);
  if (!s) {
    const a = hexRgb(ha), b = hexRgb(hb);
    const f = q / 64;
    const r = Math.round(a[0] + (b[0] - a[0]) * f);
    const g = Math.round(a[1] + (b[1] - a[1]) * f);
    const bl = Math.round(a[2] + (b[2] - a[2]) * f);
    s = `rgb(${r},${g},${bl})`;
    if (mixHexCache.size > 1024) mixHexCache.clear();
    mixHexCache.set(key, s);
  }
  return s;
}

/** Mezcla dos tintes (null = tinte neutro transparente). */
function mixTint(a: SkyTint | null, b: SkyTint | null, m: number): SkyTint {
  const a4 = a ?? ZERO_TINT;
  const b4 = b ?? ZERO_TINT;
  return [
    a4[0] + (b4[0] - a4[0]) * m,
    a4[1] + (b4[1] - a4[1]) * m,
    a4[2] + (b4[2] - a4[2]) * m,
    a4[3] + (b4[3] - a4[3]) * m,
  ];
}

/**
 * Tinte de grading CONTINUO para un dayT (R4-A2): dentro de franja devuelve
 * su tinte y cerca de una frontera interpola rgba linealmente entre los dos
 * tintes (antes: mezcla Bayer cuantizada a 5 saltos).
 */
export function gradeTintAt(dayT: number): SkyTint {
  const dT = mod(dayT, 1);
  const tr = transitionAt(dT);
  if (tr) return mixTint(DAY_STAGES[tr.a].tint, DAY_STAGES[tr.b].tint, tr.m);
  return DAY_STAGES[stageIndexAt(dT)].tint ?? ZERO_TINT;
}

// R5-O4: fillStyle del grading SIN construir strings por frame.
// Sin transición (el caso habitual) es 1 lookup a un array precalculado
// por franja; en transición, cache por escalón 1/48 de la mezcla.
function tintCss(t: SkyTint, aMul: number): string {
  const a = Math.min(1, t[3] * aMul);
  return `rgba(${t[0]},${t[1]},${t[2]},${a.toFixed(3)})`;
}
const STAGE_TINT_NOW: (string | null)[] = DAY_STAGES.map((st) => (st.tint ? tintCss(st.tint, 1) : null));
const STAGE_TINT_PAST: (string | null)[] = DAY_STAGES.map((st) => (st.tint ? tintCss(st.tint, 1.1) : null));
const tintMixCache = new Map<number, string | null>();

/** String rgba del tinte de grading para dayT (null = franja limpia o
 *  alpha ~0 ⇒ el draw hace early-out: mediodía = cero trabajo de tinte). */
function tintStyleAt(dT: number, isPast: boolean): string | null {
  const tr = transitionAt(dT);
  if (!tr) return (isPast ? STAGE_TINT_PAST : STAGE_TINT_NOW)[stageIndexAt(dT)];
  const q = Math.round(tr.m * 48);
  const key = ((tr.a * 8 + tr.b) * 64 + q) * 2 + (isPast ? 1 : 0);
  let s = tintMixCache.get(key);
  if (s === undefined) {
    const tn = mixTint(DAY_STAGES[tr.a].tint, DAY_STAGES[tr.b].tint, q / 48);
    const ta = isPast ? Math.min(0.35, tn[3] * 1.1) : tn[3];
    s = ta >= 0.004
      ? `rgba(${Math.round(tn[0])},${Math.round(tn[1])},${Math.round(tn[2])},${ta.toFixed(3)})`
      : null;
    if (tintMixCache.size > 1024) tintMixCache.clear();
    tintMixCache.set(key, s);
  }
  return s;
}

/** Color de una banda del backdrop, interpolado si hay transición activa. */
function skyBandColorAt(band: number, dT: number, flatNight: boolean): string {
  if (flatNight) return DAY_STAGES[NOCHE].sky[band];
  const tr = transitionAt(dT);
  if (!tr) return DAY_STAGES[stageIndexAt(dT)].sky[band];
  return mixHex(DAY_STAGES[tr.a].sky[band], DAY_STAGES[tr.b].sky[band], tr.m);
}

// ---------------- Dither 2×2 (Bayer) ----------------
// Orden Bayer 2×2 de celdas (en un tile de 4×4 px, celdas de 2×2):
//   (0,0)=0  (1,1)=¼  (1,0)=½  (0,1)=¾
// Un color + máscara de 4 bits define qué celdas quedan opacas.
// (R4-A2: la mezcla de tintes ya NO usa dither — interpolación continua —
//  pero el patrón sigue sirviendo al halo lunar y a la niebla de amanecer.)

const ditherTiles = new Map<string, HTMLCanvasElement>();
const ditherPatterns = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();

function buildDitherTile(color: string, mask: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 4;
  const cc = c.getContext('2d')!;
  cc.fillStyle = color;
  if (mask & 0b0001) cc.fillRect(0, 0, 2, 2);   // bayer 0
  if (mask & 0b0010) cc.fillRect(2, 2, 2, 2);   // bayer ¼
  if (mask & 0b0100) cc.fillRect(2, 0, 2, 2);   // bayer ½
  if (mask & 0b1000) cc.fillRect(0, 2, 2, 2);   // bayer ¾
  return c;
}

/** Patrón dither cacheado por (contexto, color, máscara). */
function ditherPattern(ctx: CanvasRenderingContext2D, color: string, mask: number): CanvasPattern {
  let perCtx = ditherPatterns.get(ctx);
  if (!perCtx) { perCtx = new Map(); ditherPatterns.set(ctx, perCtx); }
  const key = color + '|' + mask;
  let p = perCtx.get(key);
  if (!p) {
    let tile = ditherTiles.get(key);
    if (!tile) { tile = buildDitherTile(color, mask); ditherTiles.set(key, tile); }
    p = ctx.createPattern(tile, 'repeat')!;
    perCtx.set(key, p);
  }
  return p;
}

// ---------------- Luna pre-pintada (cuerpo escalonado + halo dithered) ----------------

let moonCanvas: HTMLCanvasElement | null = null;

/** Círculo pixelado por filas de 2 px (borde en escalones, NO arc liso). */
function stepCircle(x: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy < r; dy += 2) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - (dy + 1) * (dy + 1))) / 2) * 2;
    x.fillRect(cx - half, cy + dy, half * 2, 2);
  }
}

/** Semicírculo SUPERIOR pixelado (canto iluminado de los lóbulos). */
function stepCircleTop(x: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy < -2; dy += 2) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - (dy + 1) * (dy + 1))) / 2) * 2;
    x.fillRect(cx - half, cy + dy, half * 2, 2);
  }
}

function buildMoon(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 120; c.height = 120;
  const cc = c.getContext('2d')!;
  const cx = 60, cy = 60;
  // halo dithered: dos anillos escalonados con cobertura 25% y 50%
  cc.fillStyle = ditherPattern(cc, 'rgba(208,220,255,0.10)', 0b0001);
  stepCircle(cc, cx, cy, 46);
  cc.fillStyle = ditherPattern(cc, 'rgba(208,220,255,0.16)', 0b0011);
  stepCircle(cc, cx, cy, 34);
  // cuerpo escalonado
  cc.fillStyle = '#e9edf5';
  stepCircle(cc, cx, cy, 22);
  // cráteres
  cc.fillStyle = 'rgba(172,184,208,0.85)';
  cc.fillRect(cx - 12, cy - 6, 8, 6);
  cc.fillRect(cx + 2, cy + 4, 7, 5);
  cc.fillRect(cx + 6, cy - 12, 5, 4);
  cc.fillRect(cx - 6, cy + 10, 4, 3);
  // borde luminoso superior-izquierdo
  cc.fillStyle = 'rgba(255,255,255,0.5)';
  cc.fillRect(cx - 16, cy - 14, 8, 2);
  cc.fillRect(cx - 18, cy - 12, 2, 6);
  return c;
}

function getMoon(): HTMLCanvasElement {
  if (!moonCanvas) moonCanvas = buildMoon();
  return moonCanvas;
}

// ============================================================
// NUBES V2 (R4-A2) — silueta lobulada multi-blob pre-pintada
// ------------------------------------------------------------ 
// Cada mapa genera 5-8 nubes ÚNICAS (semilla por mapId). La geometría
// (3-6 blobs circulares escalonados + base plana) se prerenderiza UNA vez
// por (nube, franja) a un canvas caché: el cuerpo con sus 3 tonos
// (cloudLo/cloudBody/cloudHi) y una silueta opaca aparte para la sombra
// de suelo (dibujada con globalAlpha → sin costuras por solape).
// El VIENTO (dirección + velocidad) sale del hash del mapId y todas las
// nubes derivan con él, envolviendo por el borde opuesto del mapa.
// ============================================================

interface CloudGeom {
  w: number; h: number;                       // tamaño del canvas pre-pintado
  baseY: number;                              // línea plana de la base
  blobs: { cx: number; cy: number; r: number }[];
}

interface CloudState {
  x: number; y: number;                       // nube "virtual" (pantalla)
  w: number; h: number;                       // tamaño del canvas
  shX: number; shY: number;                   // sombra en suelo (desplazada)
}

const geomCache = new Map<string, CloudGeom>();
const cloudBodyCache = new Map<string, HTMLCanvasElement>();
const cloudShadowCache = new Map<string, HTMLCanvasElement>();

/** Semilla numérica estable a partir del mapId. */
function seedFromMapId(mapId: string): number {
  let s = 7;
  for (let i = 0; i < mapId.length; i++) s = (s * 131 + mapId.charCodeAt(i)) >>> 0;
  return s;
}

/** Geometría lobulada de la nube i de un mapa (cacheada). */
function cloudGeom(seed: number, i: number): CloudGeom {
  const key = seed + '|' + i;
  const hit = geomCache.get(key);
  if (hit) return hit;
  const s = seed * 16 + i;
  const sc = 0.8 + hash2(s, 943) * 0.8;                        // escala 0.8..1.6
  const nB = 3 + Math.floor(hash2(s, 947) * 4);                // 3..6 blobs
  const w = Math.max(64, Math.round((80 + hash2(s, 949) * 120) * sc));
  const blobs: { cx: number; cy: number; r: number }[] = [];
  let maxR = 8;
  for (let j = 0; j < nB; j++) {
    const r = Math.max(8, Math.round((10 + hash2(s * 4 + j, 953) * 15) * sc));
    if (r > maxR) maxR = r;
    blobs.push({ cx: 0, cy: 0, r });
  }
  const baseY = 2 * maxR + 4;                                  // cabe el lóbulo más alto
  for (let j = 0; j < nB; j++) {
    const b = blobs[j];
    const t = nB > 1 ? j / (nB - 1) : 0.5;                     // reparto horizontal
    b.cx = Math.round(b.r + (w - 2 * b.r) * t);
    b.cy = Math.round(baseY - b.r + (hash2(s * 4 + j, 957) - 0.5) * 5); // panzas casi alineadas
  }
  const gm: CloudGeom = { w, h: baseY + 6, baseY, blobs };
  geomCache.set(key, gm);
  return gm;
}

/** Canvas pre-pintado del cuerpo de la nube (por franja del día). */
function getCloudBody(seed: number, i: number, stIdx: number): HTMLCanvasElement {
  const key = seed + '|' + i + '|' + stIdx;
  let c = cloudBodyCache.get(key);
  if (!c) {
    if (cloudBodyCache.size > 120) cloudBodyCache.clear();     // techo de memoria
    const gm = cloudGeom(seed, i);
    const st = DAY_STAGES[stIdx];
    c = document.createElement('canvas');
    c.width = gm.w; c.height = gm.h;
    const cc = c.getContext('2d')!;
    // 1) sombra de la base: blobs +3 px y banda plana baja (canto inferior)
    cc.fillStyle = st.cloudLo;
    for (const b of gm.blobs) stepCircle(cc, b.cx, b.cy + 3, b.r);
    cc.fillRect(0, gm.baseY - 2, gm.w, 4);
    // 2) cuerpo
    cc.fillStyle = st.cloudBody;
    for (const b of gm.blobs) stepCircle(cc, b.cx, b.cy, b.r);
    cc.fillRect(0, gm.baseY - 8, gm.w, 8);
    // 3) canto iluminado superior (solo si la franja tiene brillo)
    if (st.cloudHi) {
      cc.fillStyle = st.cloudHi;
      for (const b of gm.blobs) stepCircleTop(cc, b.cx, b.cy - 1, Math.max(4, b.r - 2));
    }
    cloudBodyCache.set(key, c);
  }
  return c;
}

/** Silueta opaca (para la sombra de suelo con alpha uniforme). */
function getCloudShadow(seed: number, i: number): HTMLCanvasElement {
  const key = seed + '|' + i;
  let c = cloudShadowCache.get(key);
  if (!c) {
    if (cloudShadowCache.size > 40) cloudShadowCache.clear();
    const gm = cloudGeom(seed, i);
    c = document.createElement('canvas');
    c.width = gm.w; c.height = gm.h;
    const cc = c.getContext('2d')!;
    cc.fillStyle = '#000014';                                  // = rgba(0,0,20,…) de la v1
    for (const b of gm.blobs) stepCircle(cc, b.cx, b.cy, b.r);
    cc.fillRect(0, gm.baseY - 8, gm.w, 8);
    cloudShadowCache.set(key, c);
  }
  return c;
}

/** Memoización del plan (drawCloudShadows + drawDayNightGrade lo piden en el
 *  MISMO frame con los mismos argumentos → cero trabajo repetido).
 *  R5-O4: estados PREALOCADOS (se mutan in situ) y memo por campos —
 *  antes se construía un string-clave y un objeto CloudState por frame. */
const PLAN_MAX = 8;
const planArr: CloudState[] = Array.from({ length: PLAN_MAX }, () => ({ x: 0, y: 0, w: 0, h: 0, shX: 0, shY: 0 }));
let planMapId = '', planT = -1, planCX = -1, planCY = -1;

/**
 * Estado determinista de la flota de nubes de un mapa.
 * VIENTO: dirección/velocidad por hash(mapId); cada nube tiene un factor
 * propio. Wrapper: las posiciones envuelven en X e Y (salen por un borde y
 * entran por el opuesto). La sombra queda a 12-20 px (euclídeo, hacia
 * abajo-derecha: sol arriba-izquierda) de la nube "virtual".
 */
export function cloudPlanAt(mapId: string, globalT: number, camX: number, camY: number): CloudState[] {
  if (planMapId === mapId && planT === globalT && planCX === camX && planCY === camY) return planArr;
  planMapId = mapId; planT = globalT; planCX = camX; planCY = camY;
  const seed = seedFromMapId(mapId);
  const n = 5 + Math.floor(hash2(seed, 901) * 4);              // 5..8 nubes por mapa
  const wAng = hash2(seed, 911) * TAU;                         // dirección del viento
  const wSpd = 7 + hash2(seed, 913) * 9;                       // 7..16 px/s
  const wX = Math.cos(wAng) * wSpd;
  const wY = Math.sin(wAng) * wSpd;
  const M = 40;                                                // margen fuera de pantalla
  planArr.length = n;                                          // ranuras prealocadas
  for (let i = 0; i < n; i++) {
    const s = seed * 16 + i;
    const f = 0.75 + hash2(s, 931) * 0.5;                      // factor de viento por nube
    const gm = cloudGeom(seed, i);
    // wrapper: span = vista + 2*(nube + margen) → sale entera y entra entera
    const spanX = VIEW_W + 2 * (gm.w + M);
    const spanY = VIEW_H + 2 * (gm.h + M);
    const bx = hash2(s, 933) * spanX;
    const by = hash2(s, 937) * spanY;
    const x = Math.round(mod(bx + wX * globalT * f - camX * 0.42, spanX) - (gm.w + M));
    const y = Math.round(mod(by + wY * globalT * f - camY * 0.38, spanY) - (gm.h + M));
    const off = 12 + hash2(s, 941) * 8;                        // 12..20 px (euclídeo)
    const ox = Math.round(off * 0.6);                          // dirección (0.6, 0.8)
    const oy = Math.round(off * 0.8);
    const st = planArr[i];
    st.x = x; st.y = y; st.w = gm.w; st.h = gm.h; st.shX = x + ox; st.shY = y + oy;
  }
  return planArr;
}

/** Factor de día de las nubes (0 fuera de 0.08-0.70, rampa en los bordes). */
function cloudDayFactor(dT: number): number {
  if (dT < 0.08 || dT > 0.70) return 0;                        // coherente con isNight()
  if (dT < 0.12) return (dT - 0.08) / 0.04;                    // rampa al alba
  if (dT > 0.64) return (0.70 - dT) / 0.06;                    // rampa al anochecer
  return 1;
}

/** Pinta el cuerpo de una nube, mezclando las dos franjas si hay transición. */
function drawCloudBlend(
  ctx: CanvasRenderingContext2D, seed: number, i: number,
  x: number, y: number, siA: number, siB: number, m: number, alpha: number,
): void {
  if (alpha <= 0.004) return;
  ctx.globalAlpha = alpha * (1 - m);
  ctx.drawImage(getCloudBody(seed, i, siA), x, y);
  if (m > 0.002) {
    ctx.globalAlpha = alpha * m;
    ctx.drawImage(getCloudBody(seed, i, siB), x, y);
  }
  ctx.globalAlpha = 1;
}

// ---------------- Estrella fugaz rara (R4-A2) ----------------
// Ventana temporal determinista: cada SHOOT_PERIOD s de globalT hay a lo sumo
// UNA estrella fugaz (instante, posición y dirección por hash de la ventana).
// ~1 por ~40 s de noche. NOTA: las estrellas fijas viven en fx.ts
// (drawAmbient 'sky', módulo no editable aquí); drawDayNightGrade corre
// ANTES de esa capa, así que la fugaz queda por debajo de las fijas.

/** Periodo de la ventana temporal de estrellas fugaces (s). */
export const SHOOT_PERIOD = 40;

export interface ShootStar { x: number; y: number; dx: number; dy: number; u: number }

/** Estrella fugaz activa en el instante globalT (o null). Determinista.
 *  R5-O4: devuelve un objeto REUTILIZADO (solo lectura para los draws). */
const SHOOT_RES: ShootStar = { x: 0, y: 0, dx: 0, dy: 0, u: 0 };
export function shootingStarAt(globalT: number): ShootStar | null {
  const T = Math.max(0, globalT);
  const k = Math.floor(T / SHOOT_PERIOD);
  const t0 = hash2(k * 7 + 1, 991) * (SHOOT_PERIOD - 1.2);     // instante dentro de la ventana
  const dur = 0.9;                                             // vida del trazo (s)
  const u = (T - k * SHOOT_PERIOD - t0) / dur;
  if (u < 0 || u > 1) return null;
  const dir = hash2(k * 17 + 7, 1009) > 0.5 ? 1 : -1;          // caída a izq. o der.
  const spd = 130 + hash2(k * 19 + 9, 1013) * 60;              // px/s
  SHOOT_RES.x = 60 + hash2(k * 11 + 3, 993) * (VIEW_W - 220);
  SHOOT_RES.y = 24 + hash2(k * 13 + 5, 997) * 130;
  SHOOT_RES.dx = dir * spd * 0.86;
  SHOOT_RES.dy = spd * 0.5;
  SHOOT_RES.u = u;
  return SHOOT_RES;
}

/** Trazo de ~7 px: cabeza 2×2 + 3 colas de 2 px con fade sinusoidal. */
function drawShootingStar(ctx: CanvasRenderingContext2D, globalT: number, gate: number): void {
  const s = shootingStarAt(globalT);
  if (!s || gate <= 0.01) return;
  const fade = Math.sin(Math.PI * s.u);                        // entra, pico y fade
  const len = Math.hypot(s.dx, s.dy);
  const ux = s.dx / len, uy = s.dy / len;
  const hx = s.x + s.dx * s.u, hy = s.y + s.dy * s.u;
  const SEG = [0.85, 0.5, 0.28, 0.12];                         // alpha de cabeza→cola
  for (let j = 0; j < 4; j++) {
    const a = SEG[j] * fade * gate;
    if (a <= 0.01) break;
    ctx.globalAlpha = a;
    ctx.fillStyle = j === 0 ? '#f4f9ff' : '#cfe0ff';
    ctx.fillRect(Math.round(hx - ux * 2.2 * j) - 1, Math.round(hy - uy * 2.2 * j) - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
}

// ---------------- Banda amanecer/anochecer y niebla (R4-A2) ----------------

/** Trapezoide suave: 0 fuera de [a,b], rampa r dentro, meseta 1 en medio. */
function trap(x: number, a: number, b: number, r: number): number {
  if (x <= a || x >= b) return 0;
  return Math.min(1, (x - a) / r, (b - x) / r);
}

/**
 * Fuerza de la banda rosada-naranja de bordes horizontales:
 * ventanas dayT 0.20-0.30 (amanecer) y 0.65-0.75 (anochecer).
 */
export function horizonBandStrength(dayT: number): number {
  const x = mod(dayT, 1);
  return Math.max(trap(x, 0.20, 0.30, 0.035), trap(x, 0.65, 0.75, 0.035));
}

/** Escalones de la banda (pixel-art, sin gradiente): 3 franjas por borde.
 *  R5-O4: strings rgba PRECALCULADOS por escalón de intensidad (1/64)
 *  — antes se construían 6 strings por frame en las ventanas activas. */
const HG_HS = [26, 20, 14];                                  // alturas de escalón
const HG_AS = [0.11, 0.07, 0.04];                            // alphas tenues
const HG_Q = 64;
const HG_TOP: string[][] = [[], [], []];                     // borde superior (rosado)
const HG_BOT: string[][] = [[], [], []];                     // borde inferior (naranja)
for (let i = 0; i < 3; i++) {
  for (let q = 0; q <= HG_Q; q++) {
    HG_TOP[i].push(`rgba(255,158,150,${(HG_AS[i] * q / HG_Q).toFixed(3)})`);
    HG_BOT[i].push(`rgba(255,152,106,${(HG_AS[i] * q / HG_Q).toFixed(3)})`);
  }
}

function drawHorizonGlow(ctx: CanvasRenderingContext2D, dayT: number): void {
  const s = horizonBandStrength(dayT);
  if (s <= 0.005) return;
  const q = Math.max(1, Math.round(s * HG_Q));                // intensidad cuantizada
  let y = 0;
  for (let i = 0; i < 3; i++) {                               // borde superior (rosado)
    ctx.fillStyle = HG_TOP[i][q];
    ctx.fillRect(0, y, VIEW_W, HG_HS[i]);
    y += HG_HS[i];
  }
  y = VIEW_H;
  for (let i = 0; i < 3; i++) {                               // borde inferior (naranja)
    y -= HG_HS[i];
    ctx.fillStyle = HG_BOT[i][q];
    ctx.fillRect(0, y, VIEW_W, HG_HS[i]);
  }
}

/**
 * Fuerza de la niebla de amanecer del valle (pico en la "alba" 0.15,
 * disipada al entrar el mediodía).
 */
export function dawnMistStrength(dayT: number): number {
  return trap(mod(dayT, 1), 0.07, 0.26, 0.05);
}

// Bandas bajas del valle: cobertura Bayer creciente hacia el suelo.
// R5-O4: y como FRACCIÓN de VIEW_H (vista dinámica; antes quedaba
// congelada al VIEW_H del arranque del módulo) + strings precalculados.
const MIST_BANDS = [
  { fy: 0.66, h: 36, mask: 0b0001, a: 0.18, spd: 5, dir: 1 },
  { fy: 0.76, h: 44, mask: 0b0011, a: 0.24, spd: 9, dir: -1 },
  { fy: 0.86, h: 52, mask: 0b0111, a: 0.30, spd: 14, dir: 1 },
];
const DM_Q = 64;
const DM_CSS: string[][] = [[], [], []];
for (let i = 0; i < MIST_BANDS.length; i++) {
  for (let q = 0; q <= DM_Q; q++) {
    DM_CSS[i].push(`rgba(214,226,238,${(MIST_BANDS[i].a * q / DM_Q).toFixed(3)})`);
  }
}

/** Niebla de amanecer: bandas horizontales dithered SOLO en lunaris (valle). */
function drawDawnMist(ctx: CanvasRenderingContext2D, g: Game, dT: number): void {
  if (g.mapId !== 'lunaris') return;                           // valle de Lunaris
  const p = dawnMistStrength(dT);
  if (p <= 0.005) return;
  const q = Math.max(1, Math.round(p * DM_Q));                 // intensidad cuantizada
  for (let bi = 0; bi < MIST_BANDS.length; bi++) {
    const b = MIST_BANDS[bi];
    // deriva cuantizada a píxeles ≤ 1 tile: el patrón es periódico de 4 px,
    // así que el envuelve del módulo es invisible y el rect sigue entero.
    const d = Math.floor(mod(g.globalT * b.spd * b.dir, 4));
    ctx.save();
    ctx.translate(-d, 0);
    // patrón dither cacheado por (color, máscara); con la intensidad
    // cuantizada el color es estable → el patrón se reutiliza sin rebuilds
    ctx.fillStyle = ditherPattern(ctx, DM_CSS[bi][q], b.mask);
    ctx.fillRect(d, Math.round(VIEW_H * b.fy), VIEW_W, b.h);
    ctx.restore();
  }
}

// ============================================================
// 1) drawSkyBackdrop — cielo completo para TITLE SCREEN y transiciones
//    Pinta: bandas de color INTERPOLADAS según franja del día, estrellas
//    en 3 capas PRE-RENDERIZADAS (R5-O4), luna escalonada con halo
//    dithered, estrella fugaz rara y nubes lobuladas v2 derivando.
// ============================================================

// ---------------- Estrellas pre-renderizadas (R5-O4) ----------------
// Las 70 estrellas fijas del backdrop (44 lejanas 1px + 26 cercanas 2px,
// posiciones deterministas con hash2 INTACTAS) se pintan UNA vez a 3
// canvas estáticos (la cercana partida en 2 sub-capas para alternar
// fases) y por frame solo hay 12 drawImage con offset envuelto (deriva
// + parallax, mismo signo que la v1). El twinkle por estrella se
// sustituye por 3 capas de alpha alternantes + brillo base horneado por
// estrella. Se reconstruyen si fitViewToWindow cambia VIEW_W/VIEW_H.

interface StarLayer {
  cv: HTMLCanvasElement | null;
  drift: number;                     // deriva horizontal px/s (1.6 lejanas / 3.2 cercanas)
  parX: number;                      // factor parallax camX (0.012 / 0.03)
  parY: number;                      // factor parallax camY (0.008 / 0.016)
  base: number;                      // alpha base (0.55 lejanas / 0.85 cercanas)
  om: number; ph: number;            // twinkle de capa: fase alterna por capa
}

const STAR_LAYERS: StarLayer[] = [
  { cv: null, drift: 1.6, parX: 0.012, parY: 0.008, base: 0.55, om: 0.5, ph: 0.0 },
  { cv: null, drift: 3.2, parX: 0.03,  parY: 0.016, base: 0.85, om: 0.9, ph: 2.1 },
  { cv: null, drift: 3.2, parX: 0.03,  parY: 0.016, base: 0.85, om: 0.7, ph: 4.2 },
];
let starVW = 0, starVH = 0;          // VIEW con la que se construyeron

function buildStarLayers(): void {
  starVW = VIEW_W; starVH = VIEW_H;
  for (let L = 0; L < 3; L++) {
    const far = L === 0;
    const n = far ? 44 : 13;                       // cercanas: 26 partida en 2 sub-capas
    const extra = far ? 40 : 60;                   // margen de envuelve horizontal
    const fracY = far ? 0.7 : 0.62;                // banda vertical (como la v1)
    const span = VIEW_W + extra;
    const bandH = Math.max(8, Math.round(VIEW_H * fracY));
    const cv = document.createElement('canvas');
    cv.width = span; cv.height = bandH;
    const cc = cv.getContext('2d')!;
    for (let k = 0; k < n; k++) {
      // índice ORIGINAL de estrella (mismos hash2 que la v1 → mismas posiciones)
      const i = far ? k : k * 2 + (L - 1);
      const h1 = far ? hash2(i * 3 + 11, 101) : hash2(i * 11 + 19, 113);
      const h2v = far ? hash2(i * 5 + 13, 103) : hash2(i * 13 + 23, 127);
      const h3 = far ? hash2(i * 7 + 17, 107) : hash2(i * 17 + 29, 131);
      const x = Math.round(h1 * span);
      const y = Math.round(h2v * bandH);
      const a = STAR_LAYERS[L].base * (0.6 + 0.4 * h3);          // brillo horneado
      if (far) {
        cc.globalAlpha = a;
        cc.fillStyle = h3 > 0.85 ? '#ffe9c8' : '#dce4ff';
        cc.fillRect(x, y, 1, 1);
      } else {
        cc.globalAlpha = a;
        cc.fillStyle = h3 > 0.8 ? '#fff3d8' : '#e6ecff';
        cc.fillRect(x, y, 2, 2);
        if (h3 > 0.82) {                                         // cruz de destello
          cc.globalAlpha = a * 0.47;                             // (0.4 / 0.85 de la v1)
          cc.fillRect(x - 2, y, 2, 2);
          cc.fillRect(x + 2, y, 2, 2);
          cc.fillRect(x, y - 2, 2, 2);
          cc.fillRect(x, y + 2, 2, 2);
        }
      }
    }
    STAR_LAYERS[L].cv = cv;
  }
}

/** Dibuja las 3 capas con offset envuelto (deriva + parallax) y alpha
 *  alternante por capa (twinkle barato: 12 drawImage, cero hash/sin). */
function drawStarLayers(ctx: CanvasRenderingContext2D, t: number, camX: number, camY: number, nf: number): void {
  for (let L = 0; L < 3; L++) {
    const S = STAR_LAYERS[L];
    const cv = S.cv;
    if (!cv) continue;
    const W = cv.width, H = cv.height;
    const offX = mod(t * S.drift + camX * S.parX, W);
    const offY = mod(camY * S.parY, H);
    ctx.globalAlpha = nf * (0.72 + 0.28 * Math.sin(t * S.om + S.ph));
    ctx.drawImage(cv, offX - W, offY - H);
    ctx.drawImage(cv, offX, offY - H);
    ctx.drawImage(cv, offX - W, offY);
    ctx.drawImage(cv, offX, offY);
  }
  ctx.globalAlpha = 1;
}

/** Alturas base de las 6 bandas del backdrop (suma 540; se escalan a VIEW_H). */
const BH_BASE = [128, 104, 92, 84, 72, 60];

export function drawSkyBackdrop(ctx: CanvasRenderingContext2D, g: Game): void {
  const dT = mod(g.dayT, 1);
  const t = g.globalT;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);

  // factor de noche coherente con la luz del motor (fx.ts / render.ts)
  const dayLight = Math.max(0.1, Math.sin(dT * TAU) * 1.25 + 0.25);
  let nf = 1 - Math.min(1, dayLight);

  // el título es una escena nocturna: fuerza cielo de noche ahí
  const titleMode = g.state === 'title' || g.state === 'controls';
  if (titleMode) nf = Math.max(nf, 0.9);

  // ---- bandas de cielo (pixel-art: 6 franjas horizontales, sin gradiente;
  //      interpoladas entre franjas durante las transiciones). R5-O4:
  //      alturas base (suma 540) escaladas a la vista dinámica; la última
  //      absorbe el redondeo y el total cubre VIEW_H exacto. ----
  const SC = VIEW_H / 540;
  let by = 0;
  for (let i = 0; i < 6; i++) {
    const bh = i === 5 ? VIEW_H - by : Math.round(BH_BASE[i] * SC);
    px(ctx, 0, by, VIEW_W, bh, skyBandColorAt(i, dT, titleMode));
    by += bh;
  }

  // etapas para la mezcla de nubes (en título: noche plana, sin mezcla)
  const tr = titleMode ? null : transitionAt(dT);
  const si = titleMode ? NOCHE : stageIndexAt(dT);
  const siA = tr ? tr.a : si;
  const siB = tr ? tr.b : si;
  const mx = tr ? tr.m : 0;

  // ---- estrellas: 3 capas pre-renderizadas (R5-O4): deriva + parallax
  //      por drawImage envuelto y twinkle por alpha alternante de capa ----
  if (nf > 0.03) {
    if (!STAR_LAYERS[0].cv || starVW !== VIEW_W || starVH !== VIEW_H) buildStarLayers();
    drawStarLayers(ctx, t, camX, camY, nf);

    // ---- estrella fugaz rara (comparte ventana temporal con el mundo) ----
    if (nf > 0.55) drawShootingStar(ctx, t, Math.min(1, (nf - 0.55) / 0.25));

    // ---- luna escalonada con halo dithered (pre-pintada, 1 drawImage) ----
    if (nf > 0.25) {
      const mx2 = Math.round(VIEW_W * 0.78 - camX * 0.004);
      const my = 66;
      ctx.globalAlpha = Math.min(1, (nf - 0.2) * 1.6);
      ctx.drawImage(getMoon(), mx2 - 60, my - 60);
      ctx.globalAlpha = 1;
    }
  }

  // ---- nubes lobuladas v2 derivando (4 en el backdrop, colores de franja) ----
  const tSeed = seedFromMapId('titulo');
  for (let i = 0; i < 4; i++) {
    const spd = 4 + hash2(i * 11 + 3, 61) * 5;                    // 4..9 px/s
    const spanX = VIEW_W + 360;
    const x0 = Math.round(mod(hash2(i * 13 + 5, 63) * spanX + t * spd - camX * 0.06, spanX) - 180);
    const y0 = Math.round(18 + hash2(i * 17 + 7, 67) * 150);
    drawCloudBlend(ctx, tSeed, i, x0, y0, siA, siB, mx, 1);
  }
}

// ============================================================
// 2) drawDayNightGrade — capa de grading sobre el mundo (antes del HUD)
//    R4-A2: tinte CONTINUO por franjas interpoladas (sin saltos Bayer),
//    banda rosada-naranja en bordes horizontales (dayT 0.20-0.30/0.65-0.75),
//    niebla de amanecer en lunaris, CUERPOS de las nubes v2 (las sombras
//    van en drawCloudShadows, capa suelo) y estrella fugaz nocturna.
//    En 'pasado' calienta +10%; en 'presente' desatura simulado (azul-gris).
//    En la cripta: no-op.
// ============================================================

export function drawDayNightGrade(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.map.dark) return;                                    // cripta: sin cielo
  if (g.state === 'title' || g.state === 'controls') return; // aún no hay mundo
  const dT = mod(g.dayT, 1);
  const isPast = g.epoch === 'pasado';

  // ---- 1) tinte de grading continuo (franjas interpoladas, R4-A2).
  //      R5-O4: fillStyle cacheado por franja/escalón; null ⇒ early-out
  //      (mediodía = cero trabajo de tinte, sin leer arrays ni mezclar). ----
  const tnStyle = tintStyleAt(dT, isPast);
  if (tnStyle) {
    ctx.fillStyle = tnStyle;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // ---- 2) banda rosada-naranja tenue en los bordes horizontales ----
  drawHorizonGlow(ctx, dT);

  // ---- 3) niebla de amanecer (bandas dithered bajas, solo valle) ----
  drawDawnMist(ctx, g, dT);

  // ---- 4) nubes v2: cuerpos sobre entidades (exterior de día) ----
  const dayF = cloudDayFactor(dT);
  if (dayF > 0.004) {
    const plan = cloudPlanAt(g.mapId, g.globalT, g.camX, g.camY);
    const seed = seedFromMapId(g.mapId);
    const tr = transitionAt(dT);
    const si = stageIndexAt(dT);
    const siA = tr ? tr.a : si;
    const siB = tr ? tr.b : si;
    const mx = tr ? tr.m : 0;
    for (let i = 0; i < plan.length; i++) {
      drawCloudBlend(ctx, seed, i, plan[i].x, plan[i].y, siA, siB, mx, 0.6 * dayF);
    }
  }

  // ---- 5) estrella fugaz rara (noche cerrada, ventana determinista) ----
  const dayLight = Math.max(0.1, Math.sin(dT * TAU) * 1.25 + 0.25);
  const nf = 1 - Math.min(1, dayLight);
  if (nf > 0.55) drawShootingStar(ctx, g.globalT, Math.min(1, (nf - 0.55) / 0.25));

  // ---- 6) lavado de época ----
  if (isPast) {
    // pasado: calidez extra constante (se suma al +10% de los tintes)
    ctx.fillStyle = 'rgba(255,150,70,0.03)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  } else {
    // presente: desaturación simulada (azul-gris)
    ctx.fillStyle = 'rgba(126,138,162,0.05)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// ============================================================
// 3) drawCloudShadows — sombras en suelo de las NUBES V2, SOLO exterior
//    de día. Misma flota determinista que pinta los cuerpos en
//    drawDayNightGrade (cloudPlanAt): cada sombra es la silueta opaca de
//    su nube desplazada 12-20 px (euclídeo) hacia abajo-derecha, dibujada
//    con globalAlpha uniforme (canvas opaco → sin costuras por solape).
// ============================================================

export function drawCloudShadows(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.map.dark) return;                                    // cripta: nunca
  if (g.state === 'title' || g.state === 'controls') return; // sin mundo debajo
  const dayF = cloudDayFactor(mod(g.dayT, 1));
  if (dayF <= 0.004) return;

  const plan = cloudPlanAt(g.mapId, g.globalT, g.camX, g.camY);
  const seed = seedFromMapId(g.mapId);
  ctx.globalAlpha = 0.07 * dayF;                             // = v1 rgba(0,0,20,0.07)
  for (let i = 0; i < plan.length; i++) {
    ctx.drawImage(getCloudShadow(seed, i), plan[i].shX, plan[i].shY);
  }
  ctx.globalAlpha = 1;
}
