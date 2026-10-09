// ============================================================
// ECOS DE AELTHAR — Iluminación dinámica v4 (R4-A3 → R9-2 · módulo world)
// Evoluciona la v2 (R1-A6) manteniendo el pipeline y las firmas
// públicas EXACTAS (render.ts llama drawLightingV2(ctx, g)):
//   · FLICKER ORGÁNICO: cada luz respira con 2 senos de frecuencias
//     inconmensurables (razón √2) + hash por posición — radio ±8 %,
//     alpha ±10 %, períodos ~0.4–0.9 s. El fuego respira, no parpadea.
//   · LUZ DEL PORTADOR en la cripta: r base 70 px cálida y tenue que
//     CRECE junto a antorchas cercanas (hasta +24 px); el recorte de
//     TODAS las luces usa 3 BANDAS ESCALONADAS (destination-out) en
//     vez de 1 corte duro.
//   · CRIPTA más PROFUNDA (base 0.82) con VETAS de oscuridad por tile
//     (hash determinista, alpha ±0.04) y OJOS que brillan EN la
//     oscuridad: setEyesVisible() la llena render.ts con los enemigos
//     en vista; mientras no se llame, es un no-op.
//   · DÍA/NOCHE: interpolación entre keyframes adyacentes con curva
//     C2 (smootherstep, ease-in-out) — también continua en el wrap 1→0.
//   · VIÑETA v2: forma de OJO (elipse/superelipse) con DITHER Bayer
//     ordenado, pre-pintada en caché; en la cripta se cierra por los
//     4 lados (superelipse 2.4 + alpha máx 0.38).
// Determinismo: TODO se deriva de g y g.globalT (hash2 ×2 → [0,1),
// cero Math.random, fillRect enteros). Único estado mutable del módulo:
// la lista de ojos inyectada y las cachés de canvas (buffer/viñeta/sprites).
//
// R5-O3 (OPTIMIZACIÓN, resultado visual IGUAL o mejor):
//   · Oscuridad+luces en buffer a MEDIA RESOLUCIÓN (VIEW/2) compuesto ×2
//     con suavizado; se recrea SOLO si cambia VIEW (vista dinámica).
//   · CACHE DE GRADIENTES: sprites radiales prerrenderizados — 1 sprite de
//     recorte escalonado + Map por color para el tinte (límite 32). Cero
//     createRadialGradient por frame.
//   · EARLY-OUT: oscuridad ≤ 0.02 sin franja → no se toca buffer ni fills.
//   · Culling por rect expandido UNA vez por frame; flicker calculado 1 vez
//     por luz (antes 2) y compartido por ambas pasadas.
//   · Cero arrays nuevos por frame (reutilizables) y rejilla de antorchas
//     cacheada por mapa (solo se recalcula al cambiar de mapa).
//
// R7-V3 (PERFILES DE LUZ DE LA EXPANSIÓN — despacho por g.mapId dentro de
// este módulo; render.ts intacto): mapId SÍ llega a drawLightingV2 y a
// collectLights vía g, así que NO queda ningún punto de enganche pendiente.
//   · COSTA: luz cálida dorada de sol bajo (amanecer/atardecer) con
//     resplandor lateral (este al alba, oeste al ocaso) — gradiente horneado
//     UNA vez por ETAPA del ciclo (dayT cuantizado a 32 etapas ⇒ re-bake
//     ≈1/7.5 s y SOLO dentro de la ventana de sol bajo), invalidado si
//     cambia VIEW (patrón viñeta de horror/R5-O3) y pintado a media
//     resolución (1 drawImage escalado ×2 con suavizado, como el buffer).
//   · ALDEA: amanecer PROGRESIVO (frente cálido que entra desde el este y
//     avanza al oeste según dayT; horneado por etapa) + de NOCHE charcos de
//     luz cálida en ventanas y faroles: MISMO plan de ventanas que
//     village.ts (windowPlanAbs + hash splitmix32 "vh" replicados al
//     carácter) cacheado por (mapId, rows, epoch) — mismo patrón que la
//     rejilla de antorchas — y faroles de props kind 'lamp' encendidos
//     (g.flags). Puerta binaria IDÉNTICA a setVillageNight (dayT>0.7 ||
//     dayT<0.08): coste cero de día y coherencia píxel con la capa
//     drawVillageWindowsNight de village v3.
//   · CUMBRES: luz fría azulada de contraste alto — grade vertical horneado
//     por etapa (luz de altura arriba / sombra profunda abajo) + noche más
//     profunda y azulada (color y alpha propios SOLO en este mapa).
//   · Reglas: cero allocations por frame (bakes reutilizados, pool de
//     LightSrc de expansión, Float64Array de anclas), determinismo total
//     (hash/senos), viñeta/terror INTACTOS (horror.ts) y firmas export
//     intactas. Los destellos de sol en el agua siguen siendo de water.ts
//     (glints de render.ts + sparkle de PAL): aquí no se duplican.
//
// R9-2 (NOCHE PELIGROSA 5.3 + ILUMINACIÓN v4 5.5 — la luz cuenta la historia):
//   · NOCHE PELIGROSA: la noche profunda pasa de "tinte" a "peligro" — la
//     oscuridad de superficie gana +0.22 de alpha con curva crepúsculo→noche
//     suave (campana C1 con wrap centrada en la medianoche de DAY_STOPS,
//     dayT 0.865), color más frío y una respiración lenta de amenaza.
//     El Portador pierde radio de visión (−42 %) y DEBE buscar faroles,
//     ventanas y fogatas: los refugios se vuelven puntos de historia.
//   · LUZ DEL PORTADOR: aura cálida personal TAMBIÉN en superficie de noche
//     (antes solo cripta), parpadeo MUY sutil (±2.2 %/±3 %, semilla
//     determinista de sesión/posición = mapa+época+rincón de 96 px) y se
//     ENCOGE con la vida baja (hasta −16 %: tensión al huir herido).
//   · FUENTES v4: faroles con halo más amplio (44→62) y núcleo más caliente
//     (2.ª luz); fogatas (forja/quemados) con núcleo caliente y CHISPAS
//     ascendentes deterministas (los Faroles del Recuerdo NO echan chispas:
//     "no se encienden con fuego, se encienden con nombres"); ventanas de
//     la aldea según hash — ~28 % apagadas de noche (casas dormidas);
//     CUMBRES: la nieve refleja la luna — la luna fría REEMPLAZA parte de
//     la oscuridad total (multiplicador recortado + gradiente moonlit).
//   · REFLEJOS EN AGUA: de noche, toda fuente visible cerca de '~' proyecta
//     un reflejo alargado vertical con vaivén determinista (sprite de
//     estela cacheado por color; el camino de luna sigue siendo de water.ts).
//   · EXPORT NUEVA ÚNICA: nightAggroMul(minuteOfDay) — multiplicador de
//     agresión enemiga 1.0→1.35 con la MISMA curva del peligro nocturno
//     (el integrador la cablea en update.ts; ver su docstring).
//   · HIGIENE: sampleDay escribe en scratch de módulo (−3 alloc/frame) y la
//     rama de cripta ya no aloca el DaySample. Flicker 'subtle' vía campo
//     opcional de LightSrc (aditivo; consumidores intactos).
// ============================================================

import { VIEW_W, VIEW_H, ZOOM } from '../consts';
import { TILE } from '../sprites';
import type { Game } from '../engine';
import type { Entity, StatusFx } from '../types';
import { tileAt } from '../maps';
import { hash2, LIGHT_PAL } from './palette';
import { perfQuality } from '../perf';

// ---------------- API pública ----------------

/** Fuente de luz deducida del estado del juego.
 *  Coordenadas x/y en px de MUNDO (1x, sin ZOOM); r en px de mundo.
 *  `flicker` es la semilla/fase de parpadeo (radianes): en v3 alimenta
 *  flickerOf() (2 senos inconmensurables + hash de la semilla) → radio
 *  ±8 % y alpha ±10 % con períodos de 0.4–0.9 s. */
export interface LightSrc {
  x: number; y: number; r: number; color: string; flicker: number;
  /** R9-2 (aditivo): parpadeo MUY sutil (±2.2 % radio / ±3 % alpha) para la
   *  aura del Portador y núcleos; el fuego grande respira ±8 %/±10 %. */
  subtle?: boolean;
}

/** Ojo que brilla en la oscuridad (x/y en px de MUNDO, como las entidades). */
export type EyeDot = { x: number; y: number; color: string };

/** Lista de ojos visibles que render.ts inyecta CADA FRAME con los
 *  enemigos en vista (esqueleto/sombra). Mientras no se llame: no-op.
 *  Se copia la lista (sin retener el array del llamador). */
let eyesList: EyeDot[] = [];
export function setEyesVisible(list: EyeDot[]): void {
  eyesList = list ? list.slice() : [];
}

/** Debug de iluminación: dibuja el contorno circular de cada luz. */
export const LIGHT_DEBUG = false;

// ---------------- Constantes del módulo ----------------

const DEBUG_COL = '#3affd4';

// Keyframes del ciclo día/noche (dayT 0..1; 0.15 = amanecer).
// a/col = capa de oscuridad (alpha y color); w/wc = tinte de franja
// (amanecer rosa, tarde ámbar) pintado en 'source-over'.
// Valores de R1-A6 intactos; la v3 solo mejora la CURVA (ease-in-out C2).
interface DayStop { t: number; a: number; col: RGB; w: number; wc: RGB; }
type RGB = [number, number, number];

const DAY_STOPS: DayStop[] = [
  { t: 0.00, a: 0.50, col: [10, 14, 40], w: 0.00, wc: [255, 150, 170] }, // madrugada azul
  { t: 0.08, a: 0.28, col: [10, 14, 40], w: 0.02, wc: [255, 150, 170] },
  { t: 0.15, a: 0.10, col: [46, 36, 62], w: 0.09, wc: [255, 150, 170] }, // AMANECER rosa
  { t: 0.26, a: 0.00, col: [10, 14, 40], w: 0.00, wc: [255, 148, 74] },  // día claro
  { t: 0.44, a: 0.00, col: [10, 14, 40], w: 0.00, wc: [255, 148, 74] },
  { t: 0.52, a: 0.00, col: [10, 14, 40], w: 0.13, wc: [255, 148, 74] },  // TARDE ámbar
  { t: 0.62, a: 0.10, col: [16, 20, 52], w: 0.05, wc: [255, 148, 74] },  // anochecer
  { t: 0.74, a: 0.45, col: [10, 14, 40], w: 0.00, wc: [255, 148, 74] },  // noche azul
  { t: 0.86, a: 0.58, col: [8, 12, 36], w: 0.00, wc: [255, 148, 74] },   // medianoche
  { t: 1.00, a: 0.50, col: [10, 14, 40], w: 0.00, wc: [255, 150, 170] },
];

// Parámetros de la cripta (mapa dark) — v3: más profunda y con vetas.
const CRYPT_DARK = 0.82;          // oscuridad base (v2: 0.72)
const CRYPT_VEIN = 0.08;          // amplitud total de la veta (±0.04 por hash)
const CRYPT_COL: RGB = [6, 8, 16];

// Luz propia del Portador en la cripta (v3 reemplaza el haz r=110 frío).
const PLAYER_LIGHT_R = 70;        // radio base (px de mundo)
const PLAYER_LIGHT_COL = '#e6c896'; // cálida tenue (pergamino)
const PLAYER_GROW_DIST2 = 96 * 96;  // antorcha "cercana" si dist < 96 px de mundo
const PLAYER_GROW_STEP = 6;         // px por antorcha cercana
const PLAYER_GROW_MAX = 24;         // techo de crecimiento (r ≤ 94)

// Antorchas de muro (rejilla determinista de R1-A6, intacta).
const TORCH_CELL_KEEP = 0.24;     // ~mitad de las celdas 4×4 porta antorcha
const TORCH_MIN_DIST2 = 12.25;    // separación mínima entre antorchas (3.5 tiles²)

// Flicker orgánico: W1 base → T1 = 0.65 s; T2 = T1/√2 ≈ 0.46 s
// (razón inconmensurable √2; con el hash por posición: T1 0.59–0.72,
// T2 0.42–0.51 — dentro de la ventana 0.4–0.9 s).
const FLICK_W1 = (2 * Math.PI) / 0.65;

// Viñeta v2 (ojo dithered): celda de trama y máscara Bayer 4×4.
const VIG_CELL = 3;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// R9-2 — NOCHE PELIGROSA (5.3) + ILUMINACIÓN v4 (5.5) ----------------------
// Campana del peligro nocturno: centro en la zona de medianoche de
// DAY_STOPS (dayT 0.875, entre las paradas 0.86 y 1.00), semianchura 0.31
// → crepúsculo dentro, día pleno fuera.
// La MISMA curva gobierna oscuridad, radio de visión, luna de cumbres y
// agresión enemiga: el jugador percibe lo que el motor aplica.
const NIGHT_DANGER_C = 0.875;
const NIGHT_DANGER_S = 0.31;
const NIGHT_AGGRO_AMP = 0.35;     // nightAggroMul: 1.0 de día → 1.35 pico
const NIGHT_DANGER_EXTRA = 0.22;  // oscuridad extra (medianoche 0.58 → 0.80)
const NIGHT_DANGER_COL: RGB = [6, 9, 30];   // color de peligro (más frío)
const NIGHT_DANGER_COL_UP = 0.55;           // cuánto tiñe el color
const MOON_MUL_MAX = 0.30;        // cumbres: la luna recorta el oscurecido
const MOON_COL: RGB = [24, 34, 60];         // azul lunar (nieve que refleja)
const AURA_NIGHT_R = 78;          // radio base de visión del Portador (noche)
const AURA_DANGER_SHRINK = 0.42;  // −42 % del radio en noche profunda
const AURA_LOWHP_HP = 0.35;       // vida fraccional donde empieza la tensión
const AURA_LOWHP_SHRINK = 0.16;   // hasta −16 % de radio con vida al 0
const FIRE_CORE_COL = '#ffe0a0';  // núcleo caliente de fogata/farol (v4)
const LAMP_HALO_R = 62;           // farol v4: halo más amplio (era 44)
const LAMP_CORE_R = 20;           // farol v4: núcleo caliente
const WIN_OFF_P = 0.28;           // ~28 % ventanas apagadas (casas dormidas)
const REFL_MAX_LIGHTS = 14;       // reflejos en agua: techo de fuentes/frame
const REFL_SCAN_TILES = 14;       // búsqueda de agua bajo la fuente (tiles)
const REFL_NEAR_DIST = 96;        // px de mundo a la orilla con brillo pleno
const SPARK_MAX_LIGHTS = 6;       // fogatas con chispas por frame

// ---------------- Utilidades ----------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// R7-V3: factor de calidad [1, 0.6, 0.35] (mismo criterio que horror.ts
// R6-V5). En este módulo solo participa en la CLAVE del horneado (los
// perfiles son 1 drawImage por frame; la escala real de FX vive en weather).
const Q_SCALE = [1, 0.6, 0.35] as const;
function qNow(): number {
  return Q_SCALE[perfQuality()];
}

/** ease-in-out C2 (smootherstep): derivada también continua entre
 *  segmentos adyacentes — transición día/noche sin esquinas. */
function easeInOut(u: number): number {
  const x = clamp(u, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** hash2 normalizado: el hash2 nativo SOLO devuelve [0, 0.5) (el producto
 *  final desborda 2^53 — sesgo documentado en R2 y horror.ts). ×2 lo lleva
 *  a [0, 1) con reparto uniforme. Todos los umbrales de este módulo lo asumen. */
function h2(a: number, b: number): number {
  return hash2(a, b) * 2;
}

function hexRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

function rgbaA(r: number, g: number, b: number, a: number): string {
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// lerp3 retirado (R9-2): sampleDay escribe el scratch de módulo in place —
// cero allocations por frame (era su único consumidor).

interface DaySample { a: number; col: RGB; w: number; wc: RGB; }

/** Scratch de módulo (R9-2): sampleDay escribe AQUÍ — cero allocations por
 *  frame (antes: 1 objeto + 2 arrays por llamada). Los consumidores solo
 *  leen; las mutaciones del color de peligro/luna escriben sobre el scratch. */
const dayScratch: DaySample = { a: 0, col: [0, 0, 0], w: 0, wc: [0, 0, 0] };

/** Muestrea el ciclo día/noche interpolando los 2 keyframes adyacentes
 *  con easeInOut (C2). El wrap 1→0 es continuo (parada final = inicial). */
function sampleDay(d: number): DaySample {
  const t = clamp(d, 0, 1);
  for (let i = 0; i < DAY_STOPS.length - 1; i++) {
    const A = DAY_STOPS[i], B = DAY_STOPS[i + 1];
    if (t >= A.t && t <= B.t) {
      const u = easeInOut((t - A.t) / Math.max(1e-6, B.t - A.t));
      dayScratch.a = A.a + (B.a - A.a) * u;
      dayScratch.w = A.w + (B.w - A.w) * u;
      const c = dayScratch.col;
      c[0] = A.col[0] + (B.col[0] - A.col[0]) * u;
      c[1] = A.col[1] + (B.col[1] - A.col[1]) * u;
      c[2] = A.col[2] + (B.col[2] - A.col[2]) * u;
      const k = dayScratch.wc;
      k[0] = A.wc[0] + (B.wc[0] - A.wc[0]) * u;
      k[1] = A.wc[1] + (B.wc[1] - A.wc[1]) * u;
      k[2] = A.wc[2] + (B.wc[2] - A.wc[2]) * u;
      return dayScratch;
    }
  }
  const last = DAY_STOPS[DAY_STOPS.length - 1];
  dayScratch.a = last.a;
  dayScratch.w = last.w;
  dayScratch.col[0] = last.col[0]; dayScratch.col[1] = last.col[1]; dayScratch.col[2] = last.col[2];
  dayScratch.wc[0] = last.wc[0]; dayScratch.wc[1] = last.wc[1]; dayScratch.wc[2] = last.wc[2];
  return dayScratch;
}

// ---------------- Flicker orgánico (v3) ----------------

/** Factor de parpadeo de una luz: 2 senos de frecuencias inconmensurables
 *  (razón √2) desfasados por la semilla de la luz + hash por posición que
 *  fija la frecuencia (cada fuego respira a su propio ritmo).
 *  rf = radio ±8 % · af = alpha ±10 % · períodos 0.42–0.72 s.
 *  EXPORT (R4-A3b, aditivo): para verificación determinista del flicker
 *  (harness) y posible reutilización del integrador; render.ts no la usa. */
export function flickerOf(seed: number, t: number): { rf: number; af: number } {
  const hh = h2((Math.round(seed * 997) | 0) * 3 + 1, 17);
  const w1 = FLICK_W1 * (0.9 + 0.2 * hh);
  const w2 = w1 * Math.SQRT2;
  const bR = 0.6 * Math.sin(w1 * t + seed) + 0.4 * Math.sin(w2 * t + seed * 2.3);
  const bA = 0.6 * Math.sin(w1 * t + seed * 1.7 + 1.3) + 0.4 * Math.sin(w2 * t + seed * 3.1 + 0.7);
  return { rf: 1 + 0.08 * bR, af: 1 + 0.10 * bA };
}

// ---------------- R9-2: curva del peligro nocturno (5.3) ----------------

/** 0..1: profundidad del peligro nocturno para un dayT (0..1). Campana C1
 *  CON WRAP (distancia circular) centrada en la medinoche de DAY_STOPS
 *  (dayT 0.865): 0 en día pleno, sube por el crepúsculo, pico 1 en la
 *  medianoche, decae hacia el alba. Derivada continua — sin saltos. */
function nightDangerF(dT: number): number {
  let d = (dT - NIGHT_DANGER_C) % 1;
  if (d > 0.5) d -= 1; else if (d < -0.5) d += 1;
  const q = d / NIGHT_DANGER_S;
  const v = 1 - q * q;
  return v <= 0 ? 0 : v * v * (3 - 2 * v);
}

/** R9-2 (5.3) — ÚNICA export nueva del módulo. Multiplicador de AGRESIÓN
 *  enemiga según la hora del mundo: 1.0 de día, curva suave
 *  (crepúsculo→noche, misma campana del peligro nocturno) hasta ~1.35 en
 *  noche profunda. Comparte forma con la oscuridad extra y con el
 *  encogimiento del radio de visión: el jugador PERCIBE lo que el motor
 *  aplica (la noche se siente más peligrosa y lo ES).
 *
 *  Contrato para el integrador (update.ts, sustituye al binario R5-O10):
 *    - antes:  `curNightMult = isNight(g) ? 1.3 : 1;`
 *    - ahora:  `curNightMult = nightAggroMul(g.dayT * 1440);`
 *  minuteOfDay: minutos desde el inicio del ciclo = g.dayT × 1440
 *  (0..1439; dayT 0.865 ≈ minuto 1246 = pico). Acepta cualquier número
 *  (mod 1440 interno). Función PURA: sin estado, sin allocations. */
export function nightAggroMul(minuteOfDay: number): number {
  const dT = (((minuteOfDay / 1440) % 1) + 1) % 1;
  return 1 + NIGHT_AGGRO_AMP * nightDangerF(dT);
}

/** ¿El tile es transitable (puede recibir luz frontal de muro)? */
function isWalkable(ch: string): boolean {
  return ch !== '#' && ch !== 'V' && ch !== 'P' && ch !== 'A' && ch !== 'H' && ch !== 'r';
}

// ---------------- Recolección de luces ----------------

/** Antorchas de muro de la cripta: rejilla determinista basada en hash2
 *  (R1-A6, intacta): celdas 4×4 + máximo local + separación mínima.
 *  Devuelve las posiciones (px de mundo) EMITIDAS en la vista, para que
 *  collectLights haga crecer la luz del Portador con las cercanas.
 *  R5-O3: la rejilla depende SOLO del mapa (hash determinista y rows fijos
 *  por carga — engine.loadMap) → se calcula UNA vez por mapa en arrays
 *  reutilizables; por frame solo se filtra por vista. Mismo resultado. */
const torchKept: { tx: number; ty: number; h: number; seed: number }[] = [];
const torchCand: { tx: number; ty: number; h: number }[] = [];
const torchEmitted: { x: number; y: number }[] = [];
let torchCacheId: string | null = null;
let torchCacheRows: string[] | null = null;

function rebuildTorchGrid(rows: string[], W: number, H: number): void {
  torchCand.length = 0;
  torchKept.length = 0;

  // hash de portación por muro (semilla estable de parpadeo incluida)
  const hTorch = (tx: number, ty: number) => hash2(tx * 7 + 3, ty * 11 + 5);

  // 1) candidatos: muros '#' que dan a una sala, en orden de barrido fijo
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (rows[ty][tx] !== '#') continue;
      const n = (rows[ty - 1] ?? '')[tx], s = (rows[ty + 1] ?? '')[tx];
      const w = rows[ty][tx - 1], e = rows[ty][tx + 1];
      if (!isWalkable(n) && !isWalkable(s) && !isWalkable(w) && !isWalkable(e)) continue;
      torchCand.push({ tx, ty, h: hTorch(tx, ty) });
    }
  }

  // 2) rejilla: la celda 4×4 decide (hash de celda) y el máximo local elige el muro
  for (const c of torchCand) {
    const cellX = c.tx >> 2, cellY = c.ty >> 2;
    const hCell = hash2(cellX * 13 + 1, cellY * 29 + 7);
    if (hCell >= TORCH_CELL_KEEP) continue;
    let win = true;
    for (const o of torchCand) {
      if (o === c) continue;
      if ((o.tx >> 2) !== cellX || (o.ty >> 2) !== cellY) continue;
      if (o.h > c.h || (o.h === c.h && (o.ty < c.ty || (o.ty === c.ty && o.tx < c.tx)))) { win = false; break; }
    }
    if (!win) continue;
    // separación mínima con portadoras ya aceptadas (orden determinista)
    let spaced = true;
    for (const k of torchKept) {
      const dx = k.tx - c.tx, dy = k.ty - c.ty;
      if (dx * dx + dy * dy < TORCH_MIN_DIST2) { spaced = false; break; }
    }
    if (!spaced) continue;
    torchKept.push({ tx: c.tx, ty: c.ty, h: hCell, seed: c.h * 97 });
  }
}

function collectCryptTorches(g: Game, out: LightSrc[]): { x: number; y: number }[] {
  const rows = g.rows.length >= g.map.h ? g.rows : g.map.rows;
  if (torchCacheId !== g.mapId || torchCacheRows !== rows) {
    torchCacheId = g.mapId;
    torchCacheRows = rows;
    rebuildTorchGrid(rows, g.map.w, g.map.h);
  }

  // 3) emisión: solo las que caen en la vista (radio de margen holgado)
  const ZT = ZOOM * TILE;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const vx0 = camX / ZT - 6, vy0 = camY / ZT - 6;
  const vx1 = (camX + VIEW_W) / ZT + 6, vy1 = (camY + VIEW_H) / ZT + 6;
  let n = 0;
  for (const k of torchKept) {
    if (k.tx < vx0 || k.ty < vy0 || k.tx > vx1 || k.ty > vy1) continue;
    const px = k.tx * TILE + 8;
    const py = k.ty * TILE + 11;   // cara frontal del muro
    out.push({
      x: px,
      y: py,
      r: 40 + k.h * 30,            // 40..55 px de mundo (variación determinista)
      color: LIGHT_PAL.torchAmber,
      flicker: k.seed,
    });
    // punto emitido REUTILIZADO del pool (cero alloc por frame)
    let em = torchEmitted[n];
    if (!em) { em = { x: 0, y: 0 }; torchEmitted[n] = em; }
    em.x = px;
    em.y = py;
    n++;
  }
  torchEmitted.length = n;
  return torchEmitted;
}

/** Luz naranja parpadeante por entidad con estado 'quemado'. */
function pushBurnLight(e: Entity, seed: number, out: LightSrc[]): void {
  if (e.dead) return;
  const st = (e as { statuses?: StatusFx[] }).statuses;
  if (!st) return;
  for (const s of st) {
    if (s.kind === 'quemado' && s.t > 0) {
      out.push({ x: e.x, y: e.y - 8, r: 32, color: LIGHT_PAL.burnOrange, flicker: seed });
      return;
    }
  }
}

/** Semilla determinista "de sesión/posición" (R9-2) para la luz personal del
 *  Portador: hash del mapa + época + posición cuantizada a 96 px — el aura
 *  respira distinto en cada rincón, sin azar de ejecución. La cuantización
 *  salta la FASE (no el radio visible: ±2 % ≈ 1 px) al cruzar un bloque. */
function sessionSeedOf(g: Game, p: Entity): number {
  let h = 0;
  const id = g.mapId;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  h = (h + (g.epoch === 'pasado' ? 7919 : 0)) | 0;
  h = (h ^ (Math.round(p.x / 96) * 131 + Math.round(p.y / 96) * 197)) | 0;
  return ((h >>> 0) % 628) * 0.01;   // 0..6.27 rad
}

/** Deduce TODAS las fuentes de luz visibles a partir del estado del juego.
 *  Determinista salvo pulsos/parpadeos derivados de g.globalT. */
export function collectLights(g: Game): LightSrc[] {
  const lights: LightSrc[] = [];
  const t = g.globalT;
  expN = 0; // R7-V3: el pool de luces de expansión vuelve a cero (cero alloc)

  // 1) Props: santuarios (cian pulsante), forja (naranja), altar de la cripta (dorado)
  for (const pr of g.map.props) {
    if (pr.needPast && g.epoch !== 'pasado') continue;
    if (pr.needPresent && g.epoch !== 'presente') continue;
    const cx = pr.x * TILE + 8, cy = pr.y * TILE + 8;
    if (pr.kind === 'sanctuary') {
      // pulso lento acoplado a la fase del prop (igual que el aura del render)
      const pulse = Math.sin(t * 2 + pr.x * 0.9) * 6;
      lights.push({ x: cx, y: cy - 4, r: 88 + pulse, color: LIGHT_PAL.sanctuaryCyan, flicker: pr.x * 1.31 });
    } else if (pr.kind === 'forge') {
      // R9-2 v4 (fogata de la aldea): la hoguera de Toln gana núcleo caliente
      lights.push({ x: cx, y: cy - 5, r: 58, color: LIGHT_PAL.forgeEmber, flicker: 2.1 });
      const core = expLight();
      core.x = cx; core.y = cy - 6; core.r = 22;
      core.color = FIRE_CORE_COL; core.flicker = 2.1 * 1.7 + 0.4; core.subtle = true;
      lights.push(core);
    } else if (pr.kind === 'altarEcho' && g.mapId === 'cripta') {
      // el fragmento dorado brilla fuerte hasta recoger el Eco de la Voz
      const taken = !!g.flags.ecoVoz;
      lights.push({ x: cx, y: cy - 12, r: taken ? 44 : 80, color: LIGHT_PAL.altarGold, flicker: 0.7 });
    } else if (pr.kind === 'lamp' && !!g.flags[pr.id]) {
      // R7-V3 (aldea): Farol del Recuerdo ENCIENDIDO (flags lamp1..3 que
      // escribe engine.lightLamp). R9-2 v4: HALO MÁS AMPLIO (44→62) y
      // NÚCLEO MÁS CALIENTE (2.ª luz) — el farol es un REFUGIO que se lee
      // de noche a más distancia. Sin chispas: "no se encienden con fuego,
      // se encienden con nombres" (lore, sign_al2).
      const L = expLight();
      L.x = cx; L.y = cy - 6;
      L.r = LAMP_HALO_R;
      L.color = LAMP_WARM;
      L.flicker = pr.x * 2.3 + pr.y * 0.7;
      L.subtle = false;   // pool reutilizable: limpiar flag de otro slot
      lights.push(L);
      const core = expLight();
      core.x = cx; core.y = cy - 6; core.r = LAMP_CORE_R;
      core.color = FIRE_CORE_COL; core.flicker = pr.x * 2.3 + pr.y * 0.7 + 0.9;
      core.subtle = true;
      lights.push(core);
    }
  }

  // 2) Entidades quemadas (NPC/jefe/enemigo/compañero): naranja parpadeo
  for (let i = 0; i < g.enemies.length; i++) pushBurnLight(g.enemies[i], i * 1.9 + 0.4, lights);
  for (let i = 0; i < g.npcs.length; i++) pushBurnLight(g.npcs[i], 40 + i * 2.3, lights);
  if (g.companion) pushBurnLight(g.companion, 88.8, lights);

  // 3) Antorchas de muro (solo mapas oscuros) — ANTES del jugador: la luz
  //    del Portador crece con las antorchas cercanas (reflejo de su fuego).
  let torchPos: { x: number; y: number }[] = [];
  if (g.map.dark) torchPos = collectCryptTorches(g, lights);

  // 3b) R7-V3 (aldea): charcos de luz cálida en ventanas encendidas de
  //     noche (mismo plan que village.ts) — coste cero de día.
  if (g.mapId === 'aldea') collectAldeaWindowLights(g, lights);

  // 4) Jugador — R9-2: luz personal con parpadeo MUY sutil (semilla de
  //    sesión/posición) que se ENCOGE con la vida baja (tensión); en
  //    superficie aparece SOLO de noche como radio de visión que la noche
  //    profunda MUERDE (el Portador debe buscar faroles/fogatas/ventanas).
  const p = g.player;
  if (p && !p.dead) {
    const hpFrac = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    const lowHp = hpFrac < AURA_LOWHP_HP ? (AURA_LOWHP_HP - hpFrac) / AURA_LOWHP_HP : 0;
    const lowMul = 1 - AURA_LOWHP_SHRINK * lowHp;
    const auraSeed = sessionSeedOf(g, p);
    // disciplina tejedor: aura violeta tenue
    if (p.discipline === 'tejedor') {
      lights.push({ x: p.x, y: p.y - 8, r: 48, color: LIGHT_PAL.weaverViolet, flicker: 4.4 });
    }
    // cripta: el Portador proyecta luz propia cálida y tenue (r base 70)
    // que CRECE con las antorchas cercanas (hasta +24 px, determinista).
    if (g.map.dark) {
      let near = 0;
      for (let i = 0; i < torchPos.length; i++) {
        const dx = torchPos[i].x - p.x, dy = torchPos[i].y - p.y;
        if (dx * dx + dy * dy <= PLAYER_GROW_DIST2) near++;
      }
      const L = expLight();
      L.x = p.x; L.y = p.y - 6;
      L.r = (PLAYER_LIGHT_R + Math.min(PLAYER_GROW_MAX, near * PLAYER_GROW_STEP)) * lowMul;
      L.color = PLAYER_LIGHT_COL;
      L.flicker = auraSeed;
      L.subtle = true;
      lights.push(L);
    } else {
      // NOCHE PELIGROSA (5.3): aura de visión nocturna — nace en el
      // crepúsculo y se encoge con la profundidad de la noche (gradiente
      // suave, sin saltos; de día es un no-op con coste cero).
      const danger = nightDangerF(g.dayT);
      if (danger > 0.004) {
        const L = expLight();
        L.x = p.x; L.y = p.y - 6;
        L.r = AURA_NIGHT_R * (1 - AURA_DANGER_SHRINK * danger) * lowMul;
        L.color = PLAYER_LIGHT_COL;
        L.flicker = auraSeed;
        L.subtle = true;
        lights.push(L);
      }
    }
  }

  return lights;
}

// ---------------- Buffer offscreen a MEDIA RESOLUCIÓN (R5-O3) ----------------
// La capa de oscuridad + agujeros de luz se pinta a VIEW/2 y se compone con
// drawImage escalado ×2 (los gradientes son suaves: la pérdida es invisible;
// vetas y viñeta conservan su propio dibujado). Se recrea SOLO si cambia VIEW
// (vista dinámica de consts.ts). Sin datos de juego: se limpia cada frame.
let bufCv: HTMLCanvasElement | null = null;
let bufCtx: CanvasRenderingContext2D | null = null;
let bufVW = 0, bufVH = 0;         // VIEW para el que se creó el buffer
let bufW = 0, bufH = 0;           // tamaño actual del buffer (VIEW/2)

function ensureBuffer(): void {
  if (!bufCv) {
    bufCv = document.createElement('canvas');
    bufCtx = bufCv.getContext('2d');
    bufCtx!.imageSmoothingEnabled = true;
  }
  if (bufVW !== VIEW_W || bufVH !== VIEW_H) {
    bufVW = VIEW_W; bufVH = VIEW_H;
    bufW = Math.max(1, Math.ceil(VIEW_W / 2));
    bufH = Math.max(1, Math.ceil(VIEW_H / 2));
    bufCv.width = bufW;
    bufCv.height = bufH;
  }
}

// ---------------- Sprites radiales prerrenderizados (R5-O3) ----------------
// CACHE DE GRADIENTES: en vez de createRadialGradient por luz y por frame se
// prerrenderiza cada perfil UNA vez y solo queda drawImage escalado.
//   · Recorte escalonado (destination-out): solo importa el ALFA → un único
//     sprite blanco con el perfil de bandas de R4-A3 normalizado a su banda 1
//     (1 · 0.62/0.92 · 0.30/0.92); con globalAlpha = clamp(0.92·af, 0, 0.96)
//     el núcleo es EXACTO y las bandas 2-3 se desvían ≤0.035 solo en picos de
//     flicker (af > 1.043) — imperceptible. El radio interior 0.05·R reproduce
//     el plateau del núcleo: todos los radios en juego miden ≥ 40 px de
//     pantalla (r0 original = max(2, 0.05·r) = 0.05·r siempre).
//   · Tinte aditivo: sprite por COLOR (Map, límite 32) con falloff 1→0;
//     globalAlpha = clamp(base·af, 0, 0.2) da el alfa original EXACTO (el
//     techo 0.2 nunca se alcanza: base ≤ 0.15 · af ≤ 1.1).
const HOLE_SPRITE_SZ = 256;       // siempre se dibuja a ≤ ~204 px: solo reduce
const TINT_SPRITE_SZ = 128;
const TINT_CACHE_MAX = 32;

let holeSprite: HTMLCanvasElement | null = null;

function getHoleSprite(): HTMLCanvasElement {
  if (holeSprite) return holeSprite;
  const S = HOLE_SPRITE_SZ, R = S / 2;
  holeSprite = document.createElement('canvas');
  holeSprite.width = S;
  holeSprite.height = S;
  const c = holeSprite.getContext('2d')!;
  const a2 = (0.62 / 0.92).toFixed(4);
  const a3 = (0.30 / 0.92).toFixed(4);
  const gr = c.createRadialGradient(R, R, R * 0.05, R, R, R);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.40, 'rgba(255,255,255,1)');      // banda 1: núcleo pleno
  gr.addColorStop(0.40, `rgba(255,255,255,${a2})`);  // ─ escalón ─
  gr.addColorStop(0.66, `rgba(255,255,255,${a2})`);  // banda 2
  gr.addColorStop(0.66, `rgba(255,255,255,${a3})`);  // ─ escalón ─
  gr.addColorStop(0.86, `rgba(255,255,255,${a3})`);  // banda 3
  gr.addColorStop(0.86, 'rgba(255,255,255,0)');      // ─ fade final (sin corte) ─
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, S, S);
  return holeSprite;
}

interface TintEntry { cv: HTMLCanvasElement; base: number; }
const tintCache = new Map<string, TintEntry>();

function getTintSprite(color: string): TintEntry {
  let e = tintCache.get(color);
  if (e) return e;
  if (tintCache.size >= TINT_CACHE_MAX) tintCache.clear();  // límite de caché
  const [cr, cg, cb] = hexRgb(color);
  const cv = document.createElement('canvas');
  cv.width = TINT_SPRITE_SZ;
  cv.height = TINT_SPRITE_SZ;
  const c = cv.getContext('2d')!;
  const R = TINT_SPRITE_SZ / 2;
  const gr = c.createRadialGradient(R, R, 0, R, R, R);
  gr.addColorStop(0, rgbaA(cr, cg, cb, 1));
  gr.addColorStop(1, rgbaA(cr, cg, cb, 0));
  c.fillStyle = gr;
  c.fillRect(0, 0, TINT_SPRITE_SZ, TINT_SPRITE_SZ);
  e = { cv, base: clamp(0.07 + ((cr - cb) / 255) * 0.09, 0.05, 0.15) };
  tintCache.set(color, e);
  return e;
}

// Arrays reutilizables del camino caliente (R5-O3): cero alloc por frame.
// visLights = luces tras el culling; visRf/visAf = flicker calculado UNA vez.
const visLights: LightSrc[] = [];
const visRf: number[] = [];
const visAf: number[] = [];

// ---------------- Viñeta v2: ojo dithered (pre-pintada en caché) ----------------
// Forma de OJO: elipse (superelipse p=2.4 en la cripta → se cierra por los
// 4 lados) cuantizada a 3 niveles con DITHER Bayer 4×4 ordenado. Se pinta
// UNA vez por variante (normal/cripta) y por frame solo hay un drawImage.

let vigNormal: HTMLCanvasElement | null = null;
let vigCrypt: HTMLCanvasElement | null = null;
let vigVW = 0, vigVH = 0;         // VIEW con el que se pintaron (vista dinámica)

function buildVignette(crypt: boolean): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = VIEW_W;
  cv.height = VIEW_H;
  const x = cv.getContext('2d')!;
  const RX = VIEW_W * (crypt ? 0.545 : 0.645);
  const RY = VIEW_H * (crypt ? 0.60 : 0.70);
  const P = crypt ? 2.4 : 2.0;      // superelipse: la cripta aprieta esquinas y lados
  const MAXA = crypt ? 0.38 : 0.26;
  const D0 = 0.42, D1 = 0.98;       // interior limpio → saturación en el borde
  const cols = Math.ceil(VIEW_W / VIG_CELL);
  const rows = Math.ceil(VIEW_H / VIG_CELL);
  for (let cy = 0; cy < rows; cy++) {
    const dyN = (cy * VIG_CELL + 1.5 - VIEW_H / 2) / RY;
    const dyP = Math.pow(Math.abs(dyN), P);
    for (let cx = 0; cx < cols; cx++) {
      const dxN = (cx * VIG_CELL + 1.5 - VIEW_W / 2) / RX;
      const d = Math.pow(Math.pow(Math.abs(dxN), P) + dyP, 1 / P);
      const tt = clamp((d - D0) / (D1 - D0), 0, 1);
      if (tt <= 0) continue;
      const ease = tt * tt * (3 - 2 * tt);
      // dither ordenado: 3 niveles cuantizados + Bayer decide la celda sobrante
      const lv = ease * 3;
      const step = Math.min(3, Math.floor(lv) + (BAYER4[(cy & 3) * 4 + (cx & 3)] / 16 < lv - Math.floor(lv) ? 1 : 0));
      const a = (step / 3) * MAXA;
      if (a < 0.004) continue;
      x.fillStyle = rgbaA(0, 0, 12, a);
      x.fillRect(cx * VIG_CELL, cy * VIG_CELL, VIG_CELL, VIG_CELL);
    }
  }
  return cv;
}

function ensureVignette(crypt: boolean): HTMLCanvasElement {
  if (vigVW !== VIEW_W || vigVH !== VIEW_H) {
    vigNormal = null;              // VIEW cambió: repintar (quedaban obsoletas)
    vigCrypt = null;
    vigVW = VIEW_W; vigVH = VIEW_H;
  }
  if (crypt) {
    if (!vigCrypt) vigCrypt = buildVignette(true);
    return vigCrypt;
  }
  if (!vigNormal) vigNormal = buildVignette(false);
  return vigNormal;
}

// ---------------- Ojos en la oscuridad (v3) ----------------

/** Glows aditivos de ojos (esqueleto/sombra) SOBRE la oscuridad: se dibujan
 *  al final del pipeline para que brille EN la oscuridad, no bajo ella.
 *  El brillo escala con la oscuridad de la escena (día = tenue) y respira
 *  por hash de posición. Todo determinista y con fillRect enteros. */
function drawEyes(ctx: CanvasRenderingContext2D, g: Game, darkA: number, camX: number, camY: number): void {
  if (eyesList.length === 0) return;
  const glow = 0.35 + 0.65 * clamp(darkA * 1.2, 0, 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < eyesList.length; i++) {
    const E = eyesList[i];
    const sx = Math.round(E.x * ZOOM) - camX;
    const sy = Math.round(E.y * ZOOM) - camY;
    if (sx < -20 || sy < -20 || sx > VIEW_W + 20 || sy > VIEW_H + 20) continue;
    const ph = h2(Math.round(E.x) * 3 + 1, Math.round(E.y) * 5 + 2);
    const pulse = 0.82 + 0.18 * Math.sin(g.globalT * 2.2 + ph * 6.283185);
    const A = clamp(glow * pulse, 0, 1);
    ctx.fillStyle = E.color;
    ctx.globalAlpha = 0.10 * A;               // halo amplio
    ctx.fillRect(sx - 4, sy - 2, 14, 6);
    ctx.globalAlpha = 0.18 * A;               // halo medio
    ctx.fillRect(sx - 2, sy - 1, 10, 4);
    ctx.globalAlpha = 0.90 * A;               // pupilas (2×3 px, separadas 5)
    ctx.fillRect(sx, sy, 2, 3);
    ctx.fillRect(sx + 5, sy, 2, 3);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------- Culling + tinte aditivo (R5-O3) ----------------

/** Culling por rect expandido: deja en visLights las luces cuyo círculo
 *  (radio máx. con flicker + vaivén ±1 px) toca el viewport, y guarda su
 *  flicker (rf/af) calculado UNA vez por frame para ambas pasadas. */
function cullLights(lights: LightSrc[], camX: number, camY: number, t: number): void {
  visLights.length = 0;
  visRf.length = 0;
  visAf.length = 0;
  for (let i = 0; i < lights.length; i++) {
    const L = lights[i];
    const fk = flickerOf(L.flicker, t);
    // R9-2: luces 'subtle' (aura del Portador, núcleos) respiran ±2.2 %/±3 %
    // reutilizando la MISMA pareja de senos — determinismo intacto.
    const rf = L.subtle ? 1 + (fk.rf - 1) * 0.28 : fk.rf;
    const af = L.subtle ? 1 + (fk.af - 1) * 0.30 : fk.af;
    const rM = L.r * ZOOM * 1.08 + 2;   // rf ≤ 1.08 + margen del vaivén
    const x = Math.round(L.x * ZOOM) - camX, y = Math.round(L.y * ZOOM) - camY;
    if (x < -rM || y < -rM || x > VIEW_W + rM || y > VIEW_H + rM) continue;
    visLights.push(L);
    visRf.push(rf);
    visAf.push(af);
  }
}

/** Tinte cálido aditivo (valores R4-A3 intactos): alpha derivada del color,
 *  cálidas (naranjas/dorados) más intensas, frías (cian/violeta) tenues,
 *  respirando con af (±10 %). Usa el sprite del color cacheado con
 *  globalAlpha = alfa original EXACTO. Se aplica también de día: los
 *  santuarios/forja deben seguir brillando sin capa de oscuridad. */
function drawAdditive(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < visLights.length; i++) {
    const L = visLights[i];
    const te = getTintSprite(L.color);
    const r = L.r * ZOOM * visRf[i];
    const x = Math.round(L.x * ZOOM) - camX, y = Math.round(L.y * ZOOM) - camY;
    ctx.globalAlpha = clamp(te.base * visAf[i], 0, 0.2);
    ctx.drawImage(te.cv, x - Math.round(r), y - Math.round(r), Math.round(r * 2), Math.round(r * 2));
  }
  ctx.restore();
}

// ---------------- R9-2 v4: reflejos alargados en agua (5.5) ----------------
// De noche, toda fuente visible cerca de tiles '~' proyecta un reflejo
// VERTICAL alargado con vaivén determinista (el agua cuenta dónde están los
// refugios). El camino de luna general sigue siendo de water.ts (R4): aquí
// solo los reflejos de las fuentes concretas. Sprite de estela cacheado por
// color (mismo límite que el tinte aditivo); escaneo de columna O(luces×14
// tileAt) — ~200 consultas en el peor caso, sin allocations.

const reflCache = new Map<string, HTMLCanvasElement>();

/** Estela vertical: alpha 0.85 arriba (junto a la orilla) → 0 abajo, con
 *  bordes horizontales suaves (recorte destination-out). 32×128 px. */
function getStreakSprite(color: string): HTMLCanvasElement {
  let cv = reflCache.get(color);
  if (cv) return cv;
  if (reflCache.size >= TINT_CACHE_MAX) reflCache.clear();
  cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 128;
  const c = cv.getContext('2d')!;
  const [cr, cg, cb] = hexRgb(color);
  const gr = c.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, rgbaA(cr, cg, cb, 0.85));
  gr.addColorStop(0.35, rgbaA(cr, cg, cb, 0.38));
  gr.addColorStop(1, rgbaA(cr, cg, cb, 0));
  c.fillStyle = gr;
  c.fillRect(0, 0, 32, 128);
  const gx = c.createLinearGradient(0, 0, 32, 0);
  gx.addColorStop(0, 'rgba(0,0,0,1)');      // destination-out: bordes fuera
  gx.addColorStop(0.5, 'rgba(0,0,0,0)');    // centro intacto
  gx.addColorStop(1, 'rgba(0,0,0,1)');
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = gx;
  c.fillRect(0, 0, 32, 128);
  reflCache.set(color, cv);
  return cv;
}

/** Reflejos nocturnos en agua: 1 drawImage por fuente cercana a '~'
 *  (techo REFL_MAX_LIGHTS). Solo de noche (darkA > 0.16) y en calidad
 *  media/alta; la distancia a la orilla atenúa el brillo. */
function drawWaterReflections(ctx: CanvasRenderingContext2D, g: Game, camX: number, camY: number, darkA: number): void {
  // mapas dark: la cripta no tiene agua — el escaneo sería coste muerto
  if (g.map.dark || darkA <= 0.16 || perfQuality() === 2 || visLights.length === 0) return;
  const rows = g.rows.length >= g.map.h ? g.rows : g.map.rows;
  const nightF = clamp((darkA - 0.12) / 0.5, 0, 1);
  const n = Math.min(visLights.length, REFL_MAX_LIGHTS);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const L = visLights[i];
    // columna de agua bajo la fuente (tileAt aplica bounds y epochDiffs)
    const tx = Math.floor(L.x / TILE);
    const ty0 = Math.floor(L.y / TILE) + 1;
    let wy = -1;
    for (let ty = ty0, end = ty0 + REFL_SCAN_TILES; ty < end; ty++) {
      if (tileAt(g.map, rows, tx, ty, g.epoch) === '~') { wy = ty * TILE; break; }
    }
    if (wy < 0) continue;
    const syTop = wy * ZOOM - camY;
    if (syTop > VIEW_H || syTop < -8) continue;      // agua fuera de vista
    const dist = wy - L.y;
    if (dist > REFL_NEAR_DIST) continue;             // demasiado lejos de la orilla
    const near = 1 - dist / REFL_NEAR_DIST;
    const w = Math.max(6, L.r * ZOOM * 0.32);
    const len = Math.min(VIEW_H - syTop, Math.max(24, L.r * ZOOM * 1.5) * (0.55 + 0.45 * near));
    // vaivén determinista del reflejo (2 ondas lentas, sin estado)
    const wob = Math.sin(g.globalT * 1.35 + L.x * 0.045) * 2 + Math.sin(g.globalT * 2.6 + L.y * 0.11) * 1.2;
    ctx.globalAlpha = Math.min(0.5, (0.05 + 0.30 * near) * visAf[i] * nightF);
    ctx.drawImage(getStreakSprite(L.color), Math.round(L.x * ZOOM) - camX + wob - w * 0.5, syTop, w, len);
  }
  ctx.restore();
}

// ---------------- R9-2 v4: chispas ascendentes de las fogatas (5.5) --------
// Ascas que se desprenden de las fogatas (forja, quemados) y antorchas de
// la cripta: 1-2 por fuente, aparición/vida deterministas por hash+t (sin
// estado, sin sistema de partículas). Los Faroles del Recuerdo NO echan
// chispas (lore: se encienden con nombres). Dibujadas SOBRE la oscuridad
// ('lighter') para que brille el ascua; techo SPARK_MAX_LIGHTS fuentes.

function drawSparks(ctx: CanvasRenderingContext2D, g: Game, camX: number, camY: number): void {
  if (perfQuality() === 2 || visLights.length === 0) return;
  const t = g.globalT;
  let n = 0;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < visLights.length && n < SPARK_MAX_LIGHTS; i++) {
    const L = visLights[i];
    if (L.color !== LIGHT_PAL.forgeEmber && L.color !== LIGHT_PAL.burnOrange &&
        L.color !== LIGHT_PAL.torchAmber) continue;
    const sx0 = Math.round(L.x * ZOOM) - camX, sy0 = Math.round(L.y * ZOOM) - camY;
    if (sx0 < -8 || sy0 < -8 || sx0 > VIEW_W + 8 || sy0 > VIEW_H + 8) continue;
    n++;
    for (let s = 0; s < 2; s++) {
      const hh = h2(i * 17 + s * 5 + 3, 71);
      const per = 1.9 + hh * 2.7;                                   // 1.9..4.6 s
      const life = 0.5 + h2(i * 23 + s * 7 + 1, 53) * 0.35;         // 0.50..0.85 s
      const u = (t + h2(i * 29 + s * 11 + 5, 97) * per) % per;
      if (u >= life) continue;
      const k = u / life;                                           // 0..1 vida
      const rise = (9 + hh * 9) * k;                                // px de mundo
      const sway = Math.sin(k * 6.8 + hh * 12.6) * (1.2 + hh * 1.6);
      ctx.globalAlpha = (1 - k) * (0.35 + 0.45 * h2(i * 31 + s * 13 + 7, 11));
      ctx.fillStyle = hh < 0.5 ? '#ffd98a' : '#ff9a4a';
      const sz = k < 0.5 ? 2 : 1;                                   // se apaga encogiéndose
      ctx.fillRect(Math.round((L.x + sway) * ZOOM) - camX, Math.round((L.y - 4 - rise) * ZOOM) - camY, sz, sz);
    }
  }
  ctx.restore();
}

// ---------------- R7-V3: perfiles de luz de la expansión ----------------

// Colores locales de la expansión (palette.ts es SOLO lectura: aditivo aquí).
// WINDOW_WARM = NIGHT_WARM de village.ts → los charcos caen sobre el mismo
// cristal que pinta drawVillageWindowsNight, con el mismo tono.
const WINDOW_WARM = '#ffb054';
const LAMP_WARM = '#ffca6a';       // farol del recuerdo encendido

// Noche cumbres: más profunda y azulada que la global (contraste alto).
const CUMBRES_NIGHT_COL: RGB = [7, 11, 28];
const CUMBRES_NIGHT_MUL = 1.12;

/** Cuantización del ciclo en etapas para el horneado (re-bake ≤ 1/STAGE_S).
 *  dayT avanza dt/240 (update.ts) ⇒ ciclo de 240 s ⇒ etapa ≈ 7.5 s. */
const STAGE_STEPS = 32;

/** Campana suave 0..1 centrada en c con semianchura s (0 fuera). */
function bell(x: number, c: number, s: number): number {
  const d = (x - c) / s;
  const v = 1 - d * d;
  return v <= 0 ? 0 : v * v * (3 - 2 * v);
}

// — Bakes de etapa (UN canvas por perfil; se repintan SOLO al cambiar de
//   etapa del ciclo, de VIEW o de escalón de calidad — patrón viñeta) —
interface StageBake {
  cv: HTMLCanvasElement | null;
  ok: boolean;                      // false = env invisible en esta etapa
  stage: number;
  vw: number; vh: number;
  q: number;                        // perfQuality con el que se horneó
}
const costaBake: StageBake = { cv: null, ok: false, stage: -1, vw: 0, vh: 0, q: -1 };
const aldeaBake: StageBake = { cv: null, ok: false, stage: -1, vw: 0, vh: 0, q: -1 };
const cumbresBake: StageBake = { cv: null, ok: false, stage: -1, vw: 0, vh: 0, q: -1 };

/** Prepara el canvas del bake a MEDIA RESOLUCIÓN (como el buffer R5-O3). */
function stageBakeCv(b: StageBake, stage: number): CanvasRenderingContext2D | null {
  if (!b.cv) {
    try {
      b.cv = document.createElement('canvas');
    } catch { return null; }        // headless/SSR: sin bake, sin overlay
    b.vw = 0;
  }
  if (b.stage !== stage || b.vw !== VIEW_W || b.vh !== VIEW_H || b.q !== qNow()) {
    b.stage = stage;
    b.vw = VIEW_W; b.vh = VIEW_H;
    b.q = qNow();
    b.cv.width = Math.max(1, Math.ceil(VIEW_W / 2));
    b.cv.height = Math.max(1, Math.ceil(VIEW_H / 2));
  }
  const c = b.cv.getContext('2d');
  if (!c) return null;
  c.clearRect(0, 0, b.cv.width, b.cv.height);
  return c;
}

/** 0..1: intensidad del dorado costero en horas bajas del sol. */
function costaGoldenEnv(dayT: number): number {
  return Math.min(1, bell(dayT, 0.16, 0.10) + bell(dayT, 0.54, 0.12));
}

/** Hornea el dorado de la costa para la etapa dada (amanecer 0.16 / ocaso 0.54). */
function ensureCostaBake(dayT: number): void {
  const stage = Math.floor(dayT * STAGE_STEPS);
  const env = costaGoldenEnv(dayT);
  costaBake.ok = env > 0.004;
  if (!costaBake.ok) return;
  const c = stageBakeCv(costaBake, stage);
  if (!c) { costaBake.ok = false; return; }
  const W = costaBake.cv!.width, H = costaBake.cv!.height;
  // banda cálida que rastrella el suelo: nace en el horizonte (sur) y baja
  const gr = c.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(255,176,88,0)');
  gr.addColorStop(0.52, `rgba(255,176,88,${(0.11 * env).toFixed(3)})`);
  gr.addColorStop(0.8, `rgba(255,148,74,${(0.14 * env).toFixed(3)})`);
  gr.addColorStop(1, `rgba(255,132,64,${(0.1 * env).toFixed(3)})`);
  c.fillStyle = gr;
  c.fillRect(0, 0, W, H);
  // resplandor del sol bajo: ESTE al alba, OESTE al ocaso (reflejo en el aire)
  const sunX = dayT < 0.35 ? W : 0;
  const rg = c.createRadialGradient(sunX, H * 0.62, 0, sunX, H * 0.62, Math.max(W, H) * 0.9);
  rg.addColorStop(0, `rgba(255,198,112,${(0.1 * env).toFixed(3)})`);
  rg.addColorStop(1, 'rgba(255,198,112,0)');
  c.fillStyle = rg;
  c.fillRect(0, 0, W, H);
}

/** 0..1: intensidad del amanecer de la aldea (ventana dayT 0.09..0.27). */
function aldeaDawnEnv(dayT: number): number {
  return bell(dayT, 0.18, 0.09);
}

/** Hornea el amanecer PROGRESIVO de la aldea: el frente cálido entra desde
 *  el este y avanza al oeste dentro de la ventana (horneado por etapa). */
function ensureAldeaBake(dayT: number): void {
  const stage = Math.floor(dayT * STAGE_STEPS);
  const env = aldeaDawnEnv(dayT);
  aldeaBake.ok = env > 0.004;
  if (!aldeaBake.ok) return;
  const c = stageBakeCv(aldeaBake, stage);
  if (!c) { aldeaBake.ok = false; return; }
  const W = aldeaBake.cv!.width, H = aldeaBake.cv!.height;
  // progreso dentro del amanecer: el frente viaja de este (x=W) a oeste
  const prog = Math.min(1, Math.max(0, (dayT - 0.09) / 0.18));
  const front = W * (1.05 - 0.9 * prog);
  const gr = c.createLinearGradient(front - W * 0.7, 0, front + W * 0.25, 0);
  gr.addColorStop(0, `rgba(255,214,150,${(0.12 * env).toFixed(3)})`);
  gr.addColorStop(0.55, `rgba(255,206,140,${(0.05 * env).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(255,206,140,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, W, H);
}

/** 0..1: luz de altura de cumbres (día pleno 1, madrugada/noche 0). */
function cumbresDayF(dayT: number): number {
  const s = Math.sin(dayT * 6.2831853);
  return s <= 0 ? 0 : Math.min(1, s * 1.25);
}

/** Hornea el grade frío de cumbres: azul claro arriba (luz de altura),
 *  sombra azulada profunda abajo — el "contraste alto" del perfil.
 *  R9-2: `moon` (0..1, profundidad de la noche) añade el LAVADO LUNAR —
 *  la nieve refleja la luna: cielo frío arriba y rebote de nieve abajo. */
function ensureCumbresBake(dayT: number, moon: number): void {
  const stage = Math.floor(dayT * STAGE_STEPS);
  const dayF = cumbresDayF(dayT);
  const env = 0.3 + 0.7 * dayF;
  cumbresBake.ok = true;            // el grade frío vive también de noche (tenue)
  const c = stageBakeCv(cumbresBake, stage);
  if (!c) { cumbresBake.ok = false; return; }
  const W = cumbresBake.cv!.width, H = cumbresBake.cv!.height;
  const gr = c.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, `rgba(196,226,248,${(0.1 * env).toFixed(3)})`);
  gr.addColorStop(0.45, `rgba(196,226,248,${(0.02 * env).toFixed(3)})`);
  gr.addColorStop(0.75, `rgba(24,38,64,${(0.1 * env).toFixed(3)})`);
  gr.addColorStop(1, `rgba(18,30,54,${(0.14 * env).toFixed(3)})`);
  c.fillStyle = gr;
  c.fillRect(0, 0, W, H);
  // R9-2 (luna en cumbres): solo dentro de la noche (moon > 0) — re-bake
  // por etapa como el resto (≈7.5 s), mismo convenio de invalidación.
  if (moon > 0.004) {
    const mg = c.createLinearGradient(0, 0, 0, H);
    mg.addColorStop(0, `rgba(168,196,238,${(0.12 * moon).toFixed(3)})`);
    mg.addColorStop(0.5, `rgba(168,196,238,${(0.03 * moon).toFixed(3)})`);
    mg.addColorStop(0.78, `rgba(150,178,226,${(0.02 * moon).toFixed(3)})`);
    mg.addColorStop(1, `rgba(196,212,244,${(0.07 * moon).toFixed(3)})`);
    c.fillStyle = mg;
    c.fillRect(0, 0, W, H);
  }
}

/** Vuelca el bake de etapa a pantalla completa (1 drawImage con suavizado). */
function drawBakedGrade(ctx: CanvasRenderingContext2D, b: StageBake): void {
  if (!b.ok || !b.cv) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;  // gradiente a media resolución → bilinear
  ctx.drawImage(b.cv, 0, 0, VIEW_W, VIEW_H);
  ctx.restore();
}

// — Ventanas encendidas de la aldea (charcos de luz de noche) —
// Réplica EXACTA del plan de village.ts: hash splitmix32 "vh" + windowPlanAbs
// (rejilla del muro + regla junto a la puerta). Así las luces caen píxel a
// píxel sobre el cristal que pintó paintWindow y que ilumina de noche
// drawVillageWindowsNight. Caché por (mapId, rows, epoch) — las epochDiffs
// pueden cambiar el muro — con el mismo patrón que la rejilla de antorchas.
const WIN_ANCH_MAX = 256;
const winAx = new Float64Array(WIN_ANCH_MAX);
const winAy = new Float64Array(WIN_ANCH_MAX);
const winSeed = new Float64Array(WIN_ANCH_MAX);
const winOff = new Float64Array(WIN_ANCH_MAX);  // R9-2: hash de "casa dormida"
let winAn = 0;
let winCacheId: string | null = null;
let winCacheRows: string[] | null = null;
let winCacheEpoch = '';

/** Hash local de village.ts (splitmix32): réplica al carácter — el hash2
 *  compartido SESGA en la rejilla de la aldea (ver village.ts). */
function vhVillage(x: number, y: number): number {
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 1 | h) >>> 0;
  h = (h ^ (h + Math.imul(h ^ (h >>> 7), 61 | h))) >>> 0;
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

function rebuildWindowAnchors(g: Game): void {
  winAn = 0;
  const rows = g.rows.length >= g.map.h ? g.rows : g.map.rows;
  const epoch = g.epoch;
  const at = (tx: number, ty: number): string => tileAt(g.map, rows, tx, ty, epoch);
  for (let ty = 0; ty < g.map.h; ty++) {
    for (let tx = 0; tx < g.map.w; tx++) {
      if (at(tx, ty) !== 'H') continue;
      // === réplica literal de windowPlanAbs (village.ts) ===
      const q = (a: number): boolean => vhVillage(a * 9 + 1, ty * 13 + 7) < 0.34;
      let lx = tx, rx = tx;
      while (at(lx - 1, ty) === 'H') lx--;
      while (at(rx + 1, ty) === 'H') rx++;
      const winAt = (a: number): boolean => at(a, ty) === 'H' && q(a) && !(at(a - 1, ty) === 'H' && q(a - 1));
      let count = 0;
      for (let a = lx; a <= rx; a++) if (winAt(a)) count++;
      const has = count > 0 ? winAt(tx) : at(tx - 1, ty) === 'd';
      if (!has) continue;
      if (winAn >= WIN_ANCH_MAX) return;   // techo de seguridad del pool
      winAx[winAn] = tx * TILE + 8;        // centro del cristal (wx+4+... = +8)
      winAy[winAn] = ty * TILE + 8;
      winSeed[winAn] = vhVillage(tx * 7 + 3, ty * 5 + 1); // fase del parpadeo
      // R9-2 (hash independiente del de la fase): ~28 % de ventanas se
      // quedan APAGADAS de noche — casas dormidas. El apagón es estable por
      // (mapa, época): la misma casa duerme toda la noche.
      winOff[winAn] = vhVillage(tx * 11 + 5, ty * 23 + 9);
      winAn++;
    }
  }
}

// Pool de LightSrc de la expansión (ventanas + faroles): cero alloc por frame.
// NOTA (contrato): collectLights devuelve un array fresco por llamada, pero
// los LightSrc de expansión son objetos REUTILIZADOS entre llamadas — los
// consumidores (cullLights/drawAdditive/LIGHT_DEBUG) solo los leen dentro
// del mismo frame, como el resto de pools del módulo.
const expLights: LightSrc[] = [];
let expN = 0;

function expLight(): LightSrc {
  let L = expLights[expN];
  if (!L) {
    L = { x: 0, y: 0, r: 0, color: '', flicker: 0 };
    expLights[expN] = L;
  }
  expN++;
  return L;
}

/** Emite las luces de ventanas encendidas de la aldea (solo de noche).
 *  Puerta binaria IDÉNTICA a setVillageNight en render.ts (dayT>0.7||<0.08)
 *  → coherencia exacta con la capa de cristales encendidos. */
function collectAldeaWindowLights(g: Game, lights: LightSrc[]): void {
  if (!(g.dayT > 0.7 || g.dayT < 0.08)) return;   // de día: coste cero
  const rows = g.rows.length >= g.map.h ? g.rows : g.map.rows;
  if (winCacheId !== g.mapId || winCacheRows !== rows || winCacheEpoch !== g.epoch) {
    winCacheId = g.mapId;
    winCacheRows = rows;
    winCacheEpoch = g.epoch;
    rebuildWindowAnchors(g);
  }
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const m = LAMP_HALO_R * ZOOM;        // margen = radio máx × flicker + vaivén
  for (let i = 0; i < winAn; i++) {
    if (winOff[i] < WIN_OFF_P) continue;  // R9-2: casa dormida — ventana apagada
    const sx = winAx[i] * ZOOM - camX;
    const sy = winAy[i] * ZOOM - camY;
    if (sx < -m || sy < -m || sx > VIEW_W + m || sy > VIEW_H + m) continue;
    const L = expLight();
    L.x = winAx[i];
    L.y = winAy[i] + 2;                // charco justo bajo el cristal
    L.r = 26 + winSeed[i] * 10;        // 26..36 px de mundo
    L.color = WINDOW_WARM;
    L.flicker = winSeed[i] * 6.1;
    L.subtle = false;                  // pool reutilizable: limpiar flag de otro slot
    lights.push(L);
  }
}

// ---------------- Pipeline principal ----------------

/** Iluminación dinámica v4 (R9-2). Dibuja SOBRE ctx (canvas principal,
 *  espacio de vista 960×540): franja del ciclo día/noche → capa de
 *  oscuridad — con PELIGRO NOCTURNO (+0.22 de alpha y color más frío en
 *  noche profunda, curva crepúsculo→noche sin saltos; cumbres: la luna
 *  fría reemplaza parte de la oscuridad) — con recortes ESCALONADOS por
 *  luz, pintada en un buffer a MEDIA RESOLUCIÓN (VIEW/2) y compuesta
 *  escalada ×2 (R5-O3) → tinte cálido aditivo → reflejos en agua y
 *  chispas de fogata → viñeta de ojo dithered → ojos que brillan en la
 *  oscuridad. En mapas dark usa oscuridad base 0.82 con vetas ±0.04,
 *  antorchas ámbar y luz propia del Portador (r 70→94, ×vida baja). */
export function drawLightingV2(ctx: CanvasRenderingContext2D, g: Game): void {
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const t = g.globalT;
  const lights = collectLights(g);
  const darkMap = !!g.map.dark;

  // ---- a) oscuridad y tinte según día/noche (o cripta) ----
  // R9-2: dark ahora es el scratch de módulo (cero alloc); las ramas
  // escriben sus valores y el peligro nocturno muta el color in place.
  const dark: DaySample = dayScratch;
  const danger = darkMap ? 0 : nightDangerF(g.dayT);
  if (darkMap) {
    // la cripta "respira" como brasas lejanas (más sutil que en v2:
    // las vetas por tile ya aportan la variación fina)
    dark.a = CRYPT_DARK + Math.sin(g.globalT * 9) * 0.012 + Math.sin(g.globalT * 19.3 + 1.7) * 0.008;
    dark.col[0] = CRYPT_COL[0]; dark.col[1] = CRYPT_COL[1]; dark.col[2] = CRYPT_COL[2];
    dark.w = 0;
    dark.wc[0] = 255; dark.wc[1] = 148; dark.wc[2] = 74;
  } else {
    sampleDay(g.dayT);
    // R9-2 NOCHE PELIGROSA (5.3): la noche profunda pasa de "tinte" a
    // "peligro" — +0.22 de alpha con la campana crepúsculo→noche (C1 con
    // wrap, sin saltos), color más frío y respiración lenta de amenaza.
    if (danger > 0) {
      dark.a += NIGHT_DANGER_EXTRA * danger + Math.sin(g.globalT * 0.9) * 0.012 * danger;
      const u = NIGHT_DANGER_COL_UP * danger;
      dark.col[0] += (NIGHT_DANGER_COL[0] - dark.col[0]) * u;
      dark.col[1] += (NIGHT_DANGER_COL[1] - dark.col[1]) * u;
      dark.col[2] += (NIGHT_DANGER_COL[2] - dark.col[2]) * u;
    }
    // R7-V3 (cumbres) + R9-2 luna: noche más profunda y azulada que la
    // global, PERO la nieve refleja la luna — en noche profunda la luna
    // fría REEMPLAZA parte de la oscuridad total (multiplicador recortado
    // por danger + color moonlit + lavado horneado en ensureCumbresBake).
    if (g.mapId === 'cumbres' && dark.a > 0.02) {
      dark.a = Math.min(0.93, dark.a * (CUMBRES_NIGHT_MUL - MOON_MUL_MAX * danger));
      const u = 0.55 * danger;
      dark.col[0] = CUMBRES_NIGHT_COL[0] + (MOON_COL[0] - CUMBRES_NIGHT_COL[0]) * u;
      dark.col[1] = CUMBRES_NIGHT_COL[1] + (MOON_COL[1] - CUMBRES_NIGHT_COL[1]) * u;
      dark.col[2] = CUMBRES_NIGHT_COL[2] + (MOON_COL[2] - CUMBRES_NIGHT_COL[2]) * u;
    }
    if (dark.a > 0.90) dark.a = 0.90;   // techo de seguridad en superficie
  }

  // tinte de franja (amanecer rosa / tarde ámbar), 'source-over' simulando
  // un multiply suave — antes de la oscuridad para que la luz lo respire.
  // EARLY-OUT (R5-O3, 1/2): sin franja apreciable, cero fills.
  if (dark.w > 0.004) {
    ctx.fillStyle = rgba(dark.wc, dark.w);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // ---- a2) R7-V3: perfiles de luz de la expansión (horneados por etapa) —
  //      1 drawImage por mapa activo y SOLO dentro de su ventana del ciclo
  //      (costa/aldea: env > 0.004; cumbres: grade frío siempre, env por fase).
  //      Se dibuja ANTES de la oscuridad: los agujeros de luz recortan sobre
  //      el escenario ya graduado (la luz del ciclo respira con él).
  if (!darkMap) {
    if (g.mapId === 'costa') {
      ensureCostaBake(g.dayT);
      drawBakedGrade(ctx, costaBake);
    } else if (g.mapId === 'aldea') {
      ensureAldeaBake(g.dayT);
      drawBakedGrade(ctx, aldeaBake);
    } else if (g.mapId === 'cumbres') {
      ensureCumbresBake(g.dayT, danger);
      drawBakedGrade(ctx, cumbresBake);
    }
  }

  // ---- b) culling por rect expandido, UNA vez por frame (R5-O3) ----
  cullLights(lights, camX, camY, t);

  // ---- c) capa de oscuridad con recortes por luz (buffer a media resolución) ----
  // EARLY-OUT (R5-O3, 2/2): con oscuridad ≤ 0.02 no se crea/redimensiona el
  // buffer ni hay clearRect/fills/composite: cero trabajo de capa.
  if (dark.a > 0.02) {
    ensureBuffer();
    const lx = bufCtx!;
    lx.globalCompositeOperation = 'source-over';
    lx.globalAlpha = 1;
    lx.clearRect(0, 0, bufW, bufH);

    if (darkMap) {
      // VETAS de oscuridad: la oscuridad base varía por tile con hash
      // determinista (2 octavas: tile y bloque 2×2) → la cripta se siente
      // viva y opresiva sin coste de estado.
      const ZT = ZOOM * TILE;
      const tx0 = Math.floor(camX / ZT), ty0 = Math.floor(camY / ZT);
      const tx1 = Math.floor((camX + VIEW_W - 1) / ZT), ty1 = Math.floor((camY + VIEW_H - 1) / ZT);
      for (let ty = ty0; ty <= ty1; ty++) {
        // rectos ENTEROS a media resolución con bordes redondeados de forma
        // consistente: los tiles colindantes comparten frontera exacta
        // (sin costuras ni solapes por el redondeo)
        const y0 = Math.round((ty * ZT - camY) * 0.5);
        const y1 = Math.round((ty * ZT + ZT - camY) * 0.5);
        for (let tx = tx0; tx <= tx1; tx++) {
          const hv = 0.62 * h2(tx, ty) + 0.38 * h2((tx >> 1) + 31, (ty >> 1) + 57);
          const aT = clamp(dark.a + (hv - 0.5) * CRYPT_VEIN, 0.5, 0.94);
          lx.fillStyle = rgba(dark.col, aT);
          const x0 = Math.round((tx * ZT - camX) * 0.5);
          lx.fillRect(x0, y0, Math.round((tx * ZT + ZT - camX) * 0.5) - x0, y1 - y0);
        }
      }
    } else {
      lx.fillStyle = rgba(dark.col, Math.min(1, dark.a));
      lx.fillRect(0, 0, bufW, bufH);
    }

    // agujeros de luz ESCALONADOS: sprite prerrenderizado + destination-out
    // SOLO sobre la capa de oscuridad (globalAlpha modula el flicker; la
    // equivalencia con el gradiente original está en la sección de sprites)
    const hs = getHoleSprite();
    lx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < visLights.length; i++) {
      const L = visLights[i];
      const r = L.r * ZOOM * visRf[i];
      const x = (Math.round(L.x * ZOOM) - camX + Math.round(Math.sin(t * 7.3 + L.flicker * 5.1))) * 0.5;
      const y = (Math.round(L.y * ZOOM) - camY + Math.round(Math.cos(t * 6.1 + L.flicker * 3.7))) * 0.5;
      const hr = r * 0.5;
      lx.globalAlpha = clamp(0.92 * visAf[i], 0, 0.96);
      lx.drawImage(hs, x - hr, y - hr, hr * 2, hr * 2);
    }
    lx.globalAlpha = 1;
    lx.globalCompositeOperation = 'source-over';

    // componer: los huecos revelan el escenario — escalado ×2 CON suavizado
    // (drawGame deja imageSmoothingEnabled=false para el pixel art; el buffer
    // de gradientes necesita bilinear para no verse bloqueado)
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bufCv!, 0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  // ---- d) tinte cálido aditivo por luz (sprites cacheados por color) ----
  drawAdditive(ctx, camX, camY);

  // ---- d2) R9-2 v4: reflejos alargados en agua + chispas de fogata ----
  //      ambos SOBRE la oscuridad ('lighter'): el agua señala los refugios
  //      y las ascuas suben dentro de la noche. La viñeta sigue después.
  drawWaterReflections(ctx, g, camX, camY, dark.a);
  drawSparks(ctx, g, camX, camY);

  // ---- e) viñeta v2: forma de ojo, dithered (pre-pintada; más cerrada
  //      por los 4 lados en la cripta) ----
  ctx.drawImage(ensureVignette(darkMap), 0, 0);

  // ---- f) ojos que brillan EN la oscuridad (setEyesVisible) ----
  drawEyes(ctx, g, dark.a, camX, camY);

  // ---- debug: círculos de radio por luz ----
  if (LIGHT_DEBUG) {
    ctx.save();
    ctx.strokeStyle = DEBUG_COL;
    ctx.lineWidth = 1;
    for (const L of lights) {
      const x = L.x * ZOOM - camX, y = L.y * ZOOM - camY, r = L.r * ZOOM;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
