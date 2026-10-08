// ============================================================
// ECOS DE AELTHAR — weather (R1-A7 · clima; R4-A10 · clima v2)
// Sistema de CLIMA con identidad fuerte por mapa, independiente
// del ambient simple de fx.ts (conviven: fx = motas genéricas,
// weather = clima con personalidad):
//
//   lunaris : briznas de luz al atardecer (dayT≈0.36..0.56),
//             luciérnagas de noche (dayT>0.6, 12-18 vivas),
//             pétalos a la deriva en epoch='pasado'.
//   bosque  : hojas cayendo SIEMPRE, polen luminoso en el pasado,
//             niebla baja por CAPAS con viento, LLUVIA v2 en
//             ventanas altas del índice de clima (+ salpicaduras).
//   cripta  : 3 haces de luz diagonales que RESPIRAN (±6 %) y se
//             inclinan con el viento, motas doradas ascendiendo,
//             MICRO-POLVO flotando cerca de las luces, chispas de
//             vela, bruma fría a ras de suelo.
//
// ÍNDICE DE CLIMA v2 (R4-A10) — weatherIndexAt(mapId, globalT):
//   oscila lento 0..1 (período principal 90-150 s + armónico ×1.618,
//   fase/velocidad deterministas por mapId con hash2). El clima
//   "respira" a lo largo de la sesión modulando densidad/alpha:
//     lunaris : pétalos/briznas tasa ×[0.70..1.30], alpha ×[0.90..1.10]
//     bosque  : niebla ×[0.55..1.25] (×0.55 legado en 'pasado'),
//               hojas ×[0.75..1.25], LLUVIA solo con índice ≥ RAIN_LO
//               (rampa full a RAIN_HI); sin lluvia en lunaris/cripta.
//     cripta  : bruma ×[0.70..1.30], chispas/volutas ×[0.70..1.30],
//               haces alpha ×[0.85..1.15], polvo ×[0.85..1.15].
//   VIENTO: weatherWindAt(mapId, globalT) oscila ±26 px/s (período
//   55-80 s + armónico √2) — mismo signo para lluvia (ángulo), niebla
//   (deriva) y orientación de los haces.
//
// INTEGRACIÓN (la conecta el integrador; no tocar render.ts aquí):
//   updateWeather(g, dt)      → en el update (junto a updateAmbient)
//   drawWeatherWorld(ctx, g)  → DETRÁS de entidades (capa 'world',
//                               junto a drawAmbient(g,'world'))
//   drawWeatherSky(ctx, g)    → DELANTE, sobre la iluminación
//                               (junto a drawAmbient(g,'sky'))
//
// DETERMINISMO (convenio R4): hash2 nativo solo cubre [0,0.5) — todo
// uso que necesita el rango completo [0,1) (coordenadas, planos de
// suelo, tamaños, fases, períodos) pasa por h2() = hash2×2. Las
// PUERTAS de probabilidad heredadas de R1 se comparan en CRUDO a
// propósito (las tasas vivas del juego se calibraron así) y la rejilla
// de antorchas replicada de lighting.ts usa crudo para ser idéntica.
//
// RENDIMIENTO: pool fijo de 200 ranuras reutilizado (cero GC por
// frame), spawn determinista con hash2 + globalT (ticks de 1/20 s),
// posiciones en coords de MUNDO 1× ligadas a cámara (spawn fuera de
// vista, kill fuera de vista+margen) y todo fillRect con coordenadas
// enteras para que nada "tiemble". VIEW_W/VIEW_H/ZOOM se leen de
// '../consts' (módulo fuente, mismo valor que re-exporta engine) para
// que el módulo sea evaluable en headless — misma decisión que sky.ts
// en R4-A2.
// ============================================================

import type { Game } from '../engine';
import { VIEW_W, VIEW_H, ZOOM } from '../consts';
import { hash2 } from './palette';

/** hash2 normalizado al rango completo [0,1) (convenio R4: ×2). */
function h2(x: number, y: number): number {
  return hash2(x, y) * 2;
}

// ---------------- Modo de lluvia (opcional) ----------------

export type WeatherMode = 'auto' | 'rain';

// API pública mutable: importarla mantiene el binding vivo
// (import { weatherMode } from ...). Para cambiarla desde código
// de juego existe setWeatherMode().
export let weatherMode: WeatherMode = 'auto';

/** Fija el modo de lluvia ('rain' = lluvia forzada R1 en bosque). */
export function setWeatherMode(m: WeatherMode): void {
  weatherMode = m;
}

// ---------------- Índice de clima y viento (R4-A10) ----------------

const TAU = 6.283185307179586;
const IDX_P_MIN = 90, IDX_P_MAX = 150; // período principal: 90..150 s
const WIND_MAX = 26;                   // viento máximo: ±26 px/s (mundo 1×)

/** Umbrales de lluvia v2 en bosque (ventana ALTA del índice). */
export const RAIN_LO = 0.57; // el índice entra en lluvia
export const RAIN_HI = 0.67; // lluvia a régimen completo (smoothstep entre ambos)

/** Semilla entera estable a partir del mapId (sin allocations). */
function strSeed(mapId: string): number {
  let s = 7;
  for (let i = 0; i < mapId.length; i++) s = (s * 31 + mapId.charCodeAt(i)) | 0;
  return s | 0;
}

/**
 * Índice de clima 0..1 por mapa: oscila lento (período principal
 * 90-150 s según hash del mapId + armónico de razón 1.618, amplitud
 * 0.5 garantizada → nunca sale de [0,1]). Determinista: misma
 * (mapId, globalT) → mismo valor. Función PURA (sin estado).
 */
export function weatherIndexAt(mapId: string, globalT: number): number {
  const s = strSeed(mapId);
  const p1 = IDX_P_MIN + h2(s * 13 + 1, 909) * (IDX_P_MAX - IDX_P_MIN);
  const p2 = p1 * 1.618; // armónico inconmensurable → orgánico, no sinusoidal
  const v = 0.5
    + 0.34 * Math.sin((globalT * TAU) / p1 + h2(s * 13 + 2, 911) * TAU)
    + 0.16 * Math.sin((globalT * TAU) / p2 + h2(s * 13 + 3, 913) * TAU);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Viento horizontal en px/s de mundo (-26..26): oscila con período
 * 55-80 s + armónico √2 (fase por mapId). La lluvia se inclina con
 * él, la niebla deriva con él y los haces se orientan con él.
 */
export function weatherWindAt(mapId: string, globalT: number): number {
  const s = strSeed(mapId) * 3 + 5;
  const p = 55 + h2(s * 17 + 5, 919) * 25;
  const raw = Math.sin((globalT * TAU) / p + h2(s * 17 + 7, 921) * TAU)
            + 0.55 * Math.sin((globalT * TAU) / (p * 1.414) + h2(s * 17 + 9, 923) * TAU);
  return (raw / 1.55) * WIND_MAX;
}

/** 0..1: régimen de lluvia v2 (smoothstep entre RAIN_LO y RAIN_HI, bosque). */
function rainAmpAt(mapId: string, globalT: number): number {
  if (mapId !== 'bosque') return 0;
  const u = (weatherIndexAt(mapId, globalT) - RAIN_LO) / (RAIN_HI - RAIN_LO);
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * (3 - 2 * u);
}

// ---------------- Tipos internos ----------------

const P_PETAL = 0;   // lunaris: pétalos (pasado)
const P_BRIZNA = 1;  // lunaris: briznas de luz (atardecer)
const P_FIREFLY = 2; // lunaris: luciérnagas (noche)
const P_LEAF = 3;    // bosque: hojas
const P_POLLEN = 4;  // bosque: polen luminoso (pasado)
const P_DROP = 5;    // gotas (bosque: ocasional / lluvia v2 / lluvia forzada)
const P_SPLASH = 6;  // salpicón 2-3 px (1 frame) + ripple mínimo
const P_SPARK = 7;   // cripta: chispa de vela
const P_WISP = 8;    // cripta: voluta de bruma fría
const P_DUST = 9;    // cripta v2: micro-polvo flotando cerca de luces

const CAP = 200;     // presupuesto total de partículas del clima (v2: +60 para lluvia/polvo)
const MARGIN = 48;   // margen de vida fuera de vista (px de mundo 1×)

interface WSlot {
  active: boolean;
  kind: number;
  x: number; y: number;      // coords de mundo (px 1×, 16px/tile)
  vx: number; vy: number;
  t: number; maxT: number;
  seed: number;              // 0..1 determinista
  seedI: number;             // entero para hashes de color/fase
  size: number;              // tamaño base en px de pantalla
  groundY: number;           // gotas: plano de "suelo" (profundidad fake)
  tvx: number; tvy: number;  // luciérnaga: velocidad objetivo (deriva)
  phase: number;             // luciérnaga: segundo de dirección actual
}

// Pool fijo prealocado: las ranuras muertas se reciclan (cero GC)
const pool: WSlot[] = Array.from({ length: CAP }, () => ({
  active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, maxT: 1,
  seed: 0, seedI: 0, size: 2, groundY: 0, tvx: 0, tvy: 0, phase: -1,
}));

// Estado interno del módulo (sin globales fuera de aquí)
let lastMap: string = '';
let lastEpoch: string = '';
let lastTick = -1;
// índice/viento/lluvia del frame actual (los fija updateWeather)
let curIdx = 0.5, curWind = 0, curRainAmp = 0;
// límites de vista+margen del frame actual (temps reutilizados)
let _wx0 = 0, _wy0 = 0, _wx1 = 0, _wy1 = 0;

// ---------------- Colores (constantes, sin strings por frame) ----------------

const LEAF_COLS = ['#7d8f45', '#9a7a3a', '#b08d4a', '#5f7a3c'] as const;
const PETAL_COLS = ['#e9c3cf', '#dcaebf', '#f2dde2', '#d49ab2'] as const;

// ---------------- Factores de ciclo día/noche ----------------

/** 0..1: luz de luciérnagas (entra con dayT>0.6, sigue de madrugada <0.08). */
function nightFactor(dayT: number): number {
  if (dayT > 0.6) return Math.min(1, (dayT - 0.6) / 0.08);
  if (dayT < 0.08) return 1;
  return 0;
}

/** 0..1: ventana de atardecer (briznas de luz) alrededor de dayT≈0.46. */
function duskFactor(dayT: number): number {
  const d = 1 - Math.abs(dayT - 0.46) / 0.1;
  return d <= 0 ? 0 : Math.min(1, d);
}

// ---------------- Spawning ----------------

/** Busca una ranura libre (las ranuras son intercambiables). */
function alloc(): WSlot | null {
  for (let i = 0; i < CAP; i++) {
    const s = pool[i];
    if (!s.active) return s;
  }
  return null;
}

function spawnPetal(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_PETAL;
  s.x = _wx0 - 12 + h2(k, 3) * (_wx1 - _wx0 + 24);
  s.y = _wy0 - 6 - h2(k, 5) * 12;
  s.vx = 7 + h2(k, 7) * 9 + curWind * 0.3; // brisa suave + viento del índice
  s.vy = 9 + h2(k, 11) * 8;
  s.t = 0; s.maxT = 6 + h2(k, 13) * 3;
  s.seed = h2(k, 17); s.seedI = (k * 31 + 7) | 0;
  s.size = h2(k, 19) < 0.3 ? 3 : 2; // las cercanas algo mayores
}

function spawnBrizna(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_BRIZNA;
  s.x = _wx0 - 8 + h2(k, 23) * (_wx1 - _wx0 + 16);
  s.y = _wy0 - 4 - h2(k, 29) * 14;
  s.vx = 10 + h2(k, 31) * 9 + curWind * 0.3;
  s.vy = 4 + h2(k, 37) * 5;
  s.t = 0; s.maxT = 4.5 + h2(k, 41) * 2.5;
  s.seed = h2(k, 43); s.seedI = (k * 37 + 11) | 0;
  s.size = 1;
}

function spawnFirefly(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_FIREFLY;
  // entra por un borde aleatorio con velocidad hacia el interior
  const e = Math.floor(h2(k, 23) * 4);
  const r1 = h2(k, 29), r2 = h2(k, 31);
  if (e === 0) { s.x = _wx0; s.y = _wy0 + r2 * (_wy1 - _wy0); s.tvx = 8 + r1 * 8; s.tvy = (r2 - 0.5) * 8; }
  else if (e === 1) { s.x = _wx1; s.y = _wy0 + r2 * (_wy1 - _wy0); s.tvx = -(8 + r1 * 8); s.tvy = (r2 - 0.5) * 8; }
  else if (e === 2) { s.x = _wx0 + r2 * (_wx1 - _wx0); s.y = _wy0; s.tvx = (r1 - 0.5) * 8; s.tvy = 6 + r1 * 6; }
  else { s.x = _wx0 + r2 * (_wx1 - _wx0); s.y = _wy1; s.tvx = (r1 - 0.5) * 8; s.tvy = -(6 + r1 * 6); }
  s.vx = s.tvx; s.vy = s.tvy;
  s.t = 0; s.maxT = 14;
  s.seed = h2(k, 37); s.seedI = (k * 41 + 13) | 0;
  s.size = 2; s.phase = -1;
}

function spawnLeaf(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_LEAF;
  s.x = _wx0 - 10 + h2(k, 3) * (_wx1 - _wx0 + 20);
  s.y = _wy0 - 6 - h2(k, 5) * 10;
  s.vx = (h2(k, 7) - 0.5) * 8 + curWind * 0.25; // las hojas sienten el viento
  s.vy = 14 + h2(k, 11) * 10;
  s.t = 0; s.maxT = 8 + h2(k, 13) * 4;
  s.seed = h2(k, 17); s.seedI = (k * 29 + 3) | 0;
  s.size = h2(k, 19) < 0.25 ? 3 : 2;
}

function spawnPollen(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_POLLEN;
  s.x = _wx0 + 48 + h2(k, 3) * (_wx1 - _wx0 - 96);
  s.y = _wy0 + 48 + h2(k, 5) * (_wy1 - _wy0 - 96);
  s.vx = (h2(k, 7) - 0.5) * 9;
  s.vy = -1 - h2(k, 11) * 3.5;
  s.t = 0; s.maxT = 4 + h2(k, 13) * 3;
  s.seed = h2(k, 17); s.seedI = (k * 23 + 5) | 0;
  s.size = 2;
}

/**
 * Gotas de bosque. flavor: 0 = gota ocasional suave (R1),
 * 1 = lluvia forzada R1 (weatherMode='rain'), 2 = lluvia v2 del
 * índice (diagonal por viento, alpha bajo).
 */
function spawnDrop(g: Game, k: number, flavor: 0 | 1 | 2): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_DROP;
  s.x = _wx0 + 40 + h2(k, 3) * (_wx1 - _wx0 - 80);
  s.y = _wy0 + MARGIN - 10;             // justo por encima de la vista
  if (flavor === 1) {
    // lluvia forzada R1: valores en CRUDO (comportamiento legado intacto)
    s.vx = 40 + hash2(k, 7) * 25;
    s.vy = 300 + hash2(k, 11) * 90;
  } else if (flavor === 2) {
    // ángulo por VIENTO (misma dirección que niebla y haces)
    s.vx = curWind * (0.9 + h2(k, 7) * 0.35) + (h2(k, 15) - 0.5) * 6;
    s.vy = 240 + h2(k, 11) * 90;
  } else {
    s.vx = 8 + h2(k, 7) * 6 + curWind * 0.3;
    s.vy = 120 + h2(k, 11) * 30;
  }
  // plano de suelo aleatorio por gota → profundidad creíble y
  // salpicadura DETERMINISTA por posición/tiempo (hash del tick)
  s.groundY = _wy0 + 56 + h2(k, 13) * (_wy1 - _wy0 - 72);
  s.t = 0; s.maxT = 2.2;
  s.seed = h2(k, 17); s.seedI = (k * 19 + 9) | 0;
  s.size = flavor === 1 ? 2 : 1;        // size 2 ⇒ lluvia forzada (más opaca)
}

/** Convierte una gota en salpicón + ripple en su plano de suelo. */
function toSplash(s: WSlot, heavy: boolean): void {
  s.kind = P_SPLASH;
  s.y = s.groundY;
  s.vx = 0; s.vy = 0;
  s.t = 0;
  s.maxT = heavy ? 0.42 : 0.3;
  s.size = heavy ? 3 : 2;               // 2-3 px de anchura del chispazo
}

function spawnSpark(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_SPARK;
  s.x = _wx0 + 48 + h2(k, 3) * (_wx1 - _wx0 - 96);
  s.y = _wy0 + 150 + h2(k, 5) * (_wy1 - _wy0 - 200);
  s.vx = (h2(k, 7) - 0.5) * 14;
  s.vy = -(14 + h2(k, 11) * 12);
  s.t = 0; s.maxT = 0.5 + h2(k, 13) * 0.4;
  s.seed = h2(k, 17); s.seedI = (k * 17 + 21) | 0;
  s.size = 1;
}

function spawnWisp(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_WISP;
  s.x = _wx0 + 40 + h2(k, 3) * (_wx1 - _wx0 - 80);
  s.y = _wy1 - 30 - h2(k, 5) * 26;   // a ras de suelo
  s.vx = (h2(k, 7) - 0.5) * 10;
  s.vy = -0.5 - h2(k, 11) * 1.5;
  s.t = 0; s.maxT = 5 + h2(k, 13) * 3;
  s.seed = h2(k, 17); s.seedI = (k * 13 + 17) | 0;
  s.size = 5;
}

// ---------------- Micro-polvo de la cripta (R4-A10) ----------------
// Anclas = zonas ILUMINADAS estáticas del mapa: las antorchas de muro
// (misma rejilla determinista de lighting.ts R1-A6, replicada sin
// allocations) + el altar del Eco. Sin anclas → cualquier zona alta
// del mapa (fallback del diseño). El polvo flota (senos lentos), es
// sutil y comparte la deriva del viento.

const DUST_ANCH_MAX = 12;
const TILE_PX = 16;                      // sprites.ts TILE (copia local: no importa sprites aquí)
const dustAx = new Float64Array(DUST_ANCH_MAX);
const dustAy = new Float64Array(DUST_ANCH_MAX);
let dustAn = 0;

/** ¿Tile transitable? (misma regla que lighting.ts isWalkable). */
function dustWalk(ch: string | undefined): boolean {
  return ch !== undefined && ch !== '#' && ch !== 'V' && ch !== 'P' && ch !== 'A' && ch !== 'H' && ch !== 'r';
}

/** ¿Muro '#' que da a una sala (algún vecino transitable)? */
function dustWallFacesRoom(rows: string[], tx: number, ty: number): boolean {
  if (rows[ty][tx] !== '#') return false;
  const row = rows[ty];
  return dustWalk((rows[ty - 1] ?? '')[tx]) || dustWalk((rows[ty + 1] ?? '')[tx])
      || dustWalk(row[tx - 1]) || dustWalk(row[tx + 1]);
}

/**
 * Calcula las anclas de polvo UNA vez por carga de mapa/época (las
 * luces son estáticas): rejilla de antorchas (celdas 4×4, keep 24 %,
 * máximo local, separación mínima 3.5 tiles — lighting.ts intacto)
 * + altar del Eco. Cero allocations (arrays fijos).
 */
function computeDustAnchors(g: Game): void {
  dustAn = 0;
  if (g.mapId !== 'cripta') return;
  const rows = g.rows.length >= g.map.h ? g.rows : g.map.rows;
  const W = g.map.w, H = g.map.h;

  // antorchas: misma rejilla determinista que collectCryptTorches
  for (let ty = 0; ty < H && dustAn < DUST_ANCH_MAX; ty++) {
    for (let tx = 0; tx < W && dustAn < DUST_ANCH_MAX; tx++) {
      if (!dustWallFacesRoom(rows, tx, ty)) continue;
      const cellX = tx >> 2, cellY = ty >> 2;
      if (hash2(cellX * 13 + 1, cellY * 29 + 7) >= 0.24) continue; // keep 24 %
      // máximo local del hash de portación dentro de la celda 4×4
      const hT = hash2(tx * 7 + 3, ty * 11 + 5);
      let win = true;
      for (let oy = 0; oy < 4 && win; oy++) {
        const my = (cellY << 2) + oy;
        if (my >= H) break;
        for (let ox = 0; ox < 4; ox++) {
          const mx = (cellX << 2) + ox;
          if (mx === tx && my === ty) continue;
          if (mx >= W) continue;
          if (!dustWallFacesRoom(rows, mx, my)) continue;
          const hO = hash2(mx * 7 + 3, my * 11 + 5);
          if (hO > hT || (hO === hT && (my < ty || (my === ty && mx < tx)))) { win = false; break; }
        }
      }
      if (!win) continue;
      // separación mínima 3.5 tiles con anclas ya aceptadas
      let spaced = true;
      for (let a = 0; a < dustAn; a++) {
        const dx = dustAx[a] / TILE_PX - tx, dy = dustAy[a] / TILE_PX - ty;
        if (dx * dx + dy * dy < 12.25) { spaced = false; break; }
      }
      if (!spaced) continue;
      dustAx[dustAn] = tx * TILE_PX + 8;  // cara frontal del muro (como lighting)
      dustAy[dustAn] = ty * TILE_PX + 11;
      dustAn++;
    }
  }

  // altar del Eco (luz dorada grande) — coords de prop en tiles
  for (let i = 0; i < g.map.props.length && dustAn < DUST_ANCH_MAX; i++) {
    const pr = g.map.props[i];
    if (pr.kind !== 'altarEcho') continue;
    if (pr.needPast && g.epoch !== 'pasado') continue;
    if (pr.needPresent && g.epoch !== 'presente') continue;
    dustAx[dustAn] = pr.x * TILE_PX + 8;
    dustAy[dustAn] = pr.y * TILE_PX + 8 - 12;
    dustAn++;
  }
}

function spawnDust(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_DUST;
  if (dustAn > 0 && h2(k, 211) < 0.7) {
    // 70 %: flotando alrededor de una luz real (antorcha/altar)
    const a = Math.floor(h2(k, 213) * dustAn) % DUST_ANCH_MAX;
    s.x = dustAx[a] + (h2(k, 217) - 0.5) * 76;
    s.y = dustAy[a] + (h2(k, 221) - 0.5) * 52;
  } else {
    // resto: zonas altas del mapa (fallback del diseño, sutil)
    s.x = _wx0 + 40 + h2(k, 217) * (_wx1 - _wx0 - 80);
    s.y = _wy0 + 24 + h2(k, 223) * ((_wy1 - _wy0) * 0.35);
  }
  s.vx = 0; s.vy = 0;                    // se derivan por frame (flotación)
  s.t = 0; s.maxT = 5 + h2(k, 227) * 4;
  s.seed = h2(k, 229); s.seedI = (k * 19 + 31) | 0;
  s.size = 1;
}

/**
 * Un tick de spawn = 1/20 s. Toda la aleatoriedad sale de
 * hash2(tick, const): determinista y estable entre frames.
 * Las tasas se modulan con el ÍNDICE DE CLIMA (el clima respira).
 */
function spawnTick(g: Game, k: number): void {
  if (g.mapId === 'lunaris') {
    const mod = 0.7 + 0.6 * curIdx;      // [0.70..1.30], suelo/techo del diseño
    // pétalos solo en el pasado
    if (g.epoch === 'pasado' && hash2(k * 13 + 1, 71) < 0.18 * mod) spawnPetal(g, k);
    // briznas de luz al atardecer
    const dusk = duskFactor(g.dayT);
    if (dusk > 0.15 && hash2(k * 13 + 2, 73) < 0.2 * dusk * mod) spawnBrizna(g, k);
    // luciérnagas: mantener 12-18 vivas de noche (dayT>0.6) — contrato R1 intacto
    const nf = nightFactor(g.dayT);
    if (nf > 0.2) {
      let n = 0;
      for (let i = 0; i < CAP; i++) {
        const p = pool[i];
        if (p.active && p.kind === P_FIREFLY) n++;
      }
      const target = Math.round(12 + nf * 6);
      if (n < target && hash2(k * 13 + 3, 79) < 0.9) spawnFirefly(g, k);
    }
  } else if (g.mapId === 'bosque') {
    const mod = 0.75 + 0.5 * curIdx;     // [0.75..1.25]
    // hojas SIEMPRE
    if (hash2(k * 13 + 4, 83) < 0.26 * mod) spawnLeaf(g, k);
    // polen luminoso solo en el pasado
    if (g.epoch === 'pasado' && hash2(k * 13 + 5, 89) < 0.22 * mod) spawnPollen(g, k);
    if (weatherMode === 'rain') {
      // lluvia forzada R1: 3 gotas por tick (~60/s)
      spawnDrop(g, k * 3, 1);
      spawnDrop(g, k * 3 + 1, 1);
      spawnDrop(g, k * 3 + 2, 1);
    } else {
      // lluvia v2: SOLO en la ventana alta del índice (rampa suave)
      const nRain = 3 * curRainAmp;
      const nFull = Math.floor(nRain);
      for (let q = 0; q < nFull; q++) spawnDrop(g, k * 3 + q, 2);
      if (h2(k * 13 + 16, 131) < nRain - nFull) spawnDrop(g, k * 3 + 2, 2);
      // gota ocasional legado solo cuando NO llueve
      if (hash2(k * 13 + 6, 97) < 0.014 * (1 - curRainAmp)) spawnDrop(g, k, 0);
    }
  } else {
    // cripta: chispas de vela + volutas de bruma fría + micro-polvo
    const mod = 0.7 + 0.6 * curIdx;      // [0.70..1.30]
    if (hash2(k * 13 + 7, 101) < 0.12 * mod) spawnSpark(g, k);
    if (hash2(k * 13 + 8, 103) < 0.09 * mod) spawnWisp(g, k);
    if (hash2(k * 13 + 9, 107) < 0.1 * (0.8 + 0.4 * curIdx)) spawnDust(g, k);
  }
}

// ---------------- Update ----------------

/** Deriva de luciérnaga: dirección objetivo nueva cada ~1 s (hash), giro suave. */
function fireflyStep(s: WSlot, g: Game, dt: number): void {
  const ph = Math.floor(g.globalT + s.seedI * 0.37);
  if (ph !== s.phase) {
    s.phase = ph;
    const ang = h2(ph * 7, s.seedI) * 6.2832;
    const sp = 5 + h2(ph * 11, s.seedI * 3 + 1) * 9;
    s.tvx = Math.cos(ang) * sp;
    s.tvy = Math.sin(ang) * sp * 0.6 - 1.5; // leve tendencia a flotar
  }
  const k2 = Math.min(1, dt * 1.8);
  s.vx += (s.tvx - s.vx) * k2;
  s.vy += (s.tvy - s.vy) * k2;
}

/**
 * Avanza el clima. Llamar 1× por frame desde update (con dt del juego).
 * Reinicia el pool al cambiar de mapa/época (el clima es identidad) y
 * recalcula las anclas de polvo de la cripta (luces estáticas).
 */
export function updateWeather(g: Game, dt: number): void {
  if (g.mapId !== lastMap || g.epoch !== lastEpoch) {
    lastMap = g.mapId; lastEpoch = g.epoch;
    for (let i = 0; i < CAP; i++) pool[i].active = false;
    lastTick = -1;
    computeDustAnchors(g);
  }

  // índice de clima, viento y régimen de lluvia de este frame (baratos)
  curIdx = weatherIndexAt(g.mapId, g.globalT);
  curWind = weatherWindAt(g.mapId, g.globalT);
  curRainAmp = weatherMode === 'rain' ? 1 : rainAmpAt(g.mapId, g.globalT);

  // límites de vista en coords de mundo 1× (+ margen de vida)
  const wx0 = g.camX / ZOOM, wy0 = g.camY / ZOOM;
  _wx0 = wx0 - MARGIN; _wy0 = wy0 - MARGIN;
  _wx1 = wx0 + VIEW_W / ZOOM + MARGIN; _wy1 = wy0 + VIEW_H / ZOOM + MARGIN;

  // ---- ticks deterministas de spawn (20 decisiones/s) ----
  const tick = Math.floor(g.globalT * 20);
  if (lastTick < 0) {
    lastTick = tick; // primera llamada: no "recuperar" historia
  } else {
    let steps = tick - lastTick;
    if (steps > 8) steps = 8; // tras una pausa nunca explotar
    for (let q = 0; q < steps; q++) {
      lastTick++;
      spawnTick(g, lastTick);
    }
  }

  // ---- integración del pool (una pasada, cero allocations) ----
  for (let i = 0; i < CAP; i++) {
    const s = pool[i];
    if (!s.active) continue;
    s.t += dt;
    switch (s.kind) {
      case P_FIREFLY:
        fireflyStep(s, g, dt);
        s.x += s.vx * dt; s.y += s.vy * dt;
        break;
      case P_DROP:
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.y >= s.groundY) { toSplash(s, s.size === 2); continue; }
        break;
      case P_SPARK:
        s.vy += 6 * dt; // las chispas frenan levemente al subir
        s.x += s.vx * dt; s.y += s.vy * dt;
        break;
      case P_DUST:
        // flotación determinista (senos lentos) + deriva del viento
        s.vx = Math.cos(s.t * 0.45 + s.seed * 9) * 3.2 + curWind * 0.12;
        s.vy = -1.6 + Math.sin(s.t * 0.3 + s.seed * 7) * 1.4;
        s.x += s.vx * dt; s.y += s.vy * dt;
        break;
      default:
        s.x += s.vx * dt; s.y += s.vy * dt;
        break;
    }
    // kill: vida agotada o fuera de vista + margen
    if (s.t >= s.maxT || s.x < _wx0 - 8 || s.x > _wx1 + 8 ||
        s.y < _wy0 - 8 || s.y > _wy1 + 8) {
      s.active = false;
    }
  }
}

// ---------------- Haces de luz de la cripta (deterministas) ----------------

const SHAFT_N = 3;
const SHAFT_X = [VIEW_W * 0.34, VIEW_W * 0.58, VIEW_W * 0.8];
const SHAFT_W = [16, 12, 9];
const SHAFT_A = [0.09, 0.07, 0.055];
const SHAFT_SLOPE = -0.32; // vienen de arriba-derecha: x baja al bajar y
const SHAFT_WIND_LEAN = 0.0032; // el viento inclina el haz (±26 → ±0.083 de pendiente)

/**
 * x en pantalla del eje del haz j a la altura y: vaivén lento +
 * RESPIRACIÓN del ancho (±6 %) + INCLINACIÓN por el viento (misma
 * dirección que lluvia y niebla). Función pura de (g, j, y).
 */
function shaftX(g: Game, j: number, y: number): number {
  const wind = weatherWindAt('cripta', g.globalT);
  const lean = SHAFT_SLOPE + wind * SHAFT_WIND_LEAN;
  const sway = Math.sin(g.globalT * 0.21 + j * 2.1) * 8 + wind * 0.5;
  return SHAFT_X[j] + lean * y + sway;
}

/** Ancho respirante del haz j (±6 %, lento — la luz del techo respira). */
function shaftW(g: Game, j: number): number {
  const breathe = 1 + 0.06 * Math.sin(g.globalT * 0.31 + j * 1.7);
  return Math.max(2, Math.round(SHAFT_W[j] * breathe));
}

/** 2-3 haces diagonales con parpadeo lento (capa mundo, tras entidades). */
function drawShafts(ctx: CanvasRenderingContext2D, g: Game): void {
  const aMul = 0.85 + 0.3 * curIdx;      // alpha ×[0.85..1.15] con el índice
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#d8c890';
  for (let j = 0; j < SHAFT_N; j++) {
    const flick = 0.8 + 0.2 * Math.sin(g.globalT * 0.7 + j * 2.4);
    const w = shaftW(g, j);
    // rodajas horizontales de 18px → diagonal suave sin paths caros
    for (let y = 0; y < VIEW_H; y += 18) {
      const x = shaftX(g, j, y);
      ctx.globalAlpha = SHAFT_A[j] * aMul * flick * (1.15 - (y / VIEW_H) * 0.55);
      ctx.fillRect(Math.round(x), y, w, 18);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Motas doradas ascendiendo dentro de los haces (100% determinista, sin pool). */
function drawShaftMotes(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#e8d290';
  for (let i = 0; i < 26; i++) {
    const h1 = h2(i * 31 + 7, 401);
    const h2v = h2(i * 17 + 3, 409);
    const h3 = h2(i * 13 + 1, 419);
    const j = i % SHAFT_N;
    const cyc = (g.globalT * (0.045 + h1 * 0.04) + h2v) % 1;
    const y = VIEW_H + 10 - cyc * (VIEW_H + 20);
    const x = shaftX(g, j, y) + Math.sin(g.globalT * 0.6 + h3 * 9) * (SHAFT_W[j] * 0.5);
    ctx.globalAlpha = Math.sin(cyc * Math.PI) * (0.25 + h3 * 0.3);
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------- Niebla y bruma (capas con profundidad + viento) ----------------

interface FogLayer { y: number; h0: number; pitch: number; speed: number; alpha: number; dir: number }
// profundidad: la LEJANA (i=0) es más lenta y tenue; la CERCANA más rápida y densa
const FOG_LAYERS: FogLayer[] = [
  { y: 0.5, h0: 8, pitch: 70, speed: 11, alpha: 0.06, dir: 1 },
  { y: 0.66, h0: 10, pitch: 54, speed: 18, alpha: 0.09, dir: -1 },
  { y: 0.82, h0: 13, pitch: 44, speed: 27, alpha: 0.12, dir: 1 },
];
const MIST_LAYERS: FogLayer[] = [
  { y: 0.9, h0: 9, pitch: 56, speed: 8, alpha: 0.07, dir: 1 },
  { y: 0.965, h0: 6, pitch: 44, speed: 14, alpha: 0.05, dir: -1 },
];

/**
 * Franjas horizontales que derivan y se envuelven, en CAPAS con
 * profundidad (velocidad/alpha crecientes con i) y DESPLAZAMIENTO POR
 * VIENTO: las capas cercanas responden más al viento que las lejanas,
 * con el mismo signo que la lluvia y los haces. La altura/alpha de
 * cada segmento depende de su ranura entera s (identidad estable).
 */
function drawFogLayers(
  ctx: CanvasRenderingContext2D, g: Game, layers: FogLayer[], color: string, densMul: number, windX: number,
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    const depthFrac = layers.length > 1 ? i / (layers.length - 1) : 0.5;
    const off = g.globalT * L.speed * L.dir + windX * (0.25 + 0.55 * depthFrac);
    const span = VIEW_W + L.pitch * 2;
    const nSeg = Math.ceil(span / L.pitch) + 1;
    const yBase = Math.round(L.y * VIEW_H + Math.sin(g.globalT * 0.5 + i * 2.3) * 4);
    for (let s = 0; s < nSeg; s++) {
      let x = (s * L.pitch - off) % span;
      if (x < 0) x += span;
      x -= L.pitch;
      // propiedades ligadas a la ranura s → estables al envolver
      const h = Math.round(L.h0 + h2(s * 17 + i, 500) * 6);
      const a = L.alpha * densMul * (0.85 + h2(s * 23 + i, 510) * 0.3);
      if (a <= 0) continue;
      ctx.globalAlpha = a > 1 ? 1 : a;
      ctx.fillRect(Math.round(x), yBase, L.pitch, h);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------- Dibujo: capa mundo (detrás de entidades) ----------------

/**
 * DETRÁS de entidades: niebla por capas del bosque, bruma y haces de
 * la cripta, hojas, pétalos, gotas y salpicones. Coordenadas de
 * pantalla: screen = world*ZOOM - cam, redondeadas a px entero.
 */
export function drawWeatherWorld(ctx: CanvasRenderingContext2D, g: Game): void {
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  // el draw es función pura de g (no depende de estado de update)
  const idx = weatherIndexAt(g.mapId, g.globalT);
  const wind = weatherWindAt(g.mapId, g.globalT);

  // ---- capas atmosféricas por mapa (moduladas por el índice) ----
  if (g.mapId === 'bosque') {
    // el pasado recuerda con menos niebla (×0.55 legado); el índice
    // hace respirar la densidad entre 0.55 y 1.25 del diseño actual
    const dens = (g.epoch === 'pasado' ? 0.55 : 1) * (0.55 + 0.7 * idx);
    drawFogLayers(ctx, g, FOG_LAYERS, '#aebfb4', dens, wind);
  } else if (g.mapId === 'cripta') {
    drawShafts(ctx, g);
    drawFogLayers(ctx, g, MIST_LAYERS, '#9db2c8', 0.7 + 0.6 * idx, wind);
  }

  // ---- partículas del pool en coordenadas de mundo ----
  for (let i = 0; i < CAP; i++) {
    const s = pool[i];
    if (!s.active) continue;
    const x = (s.x * ZOOM - camX) | 0;
    const y = (s.y * ZOOM - camY) | 0;
    const fade = Math.min(1, s.t * 3, (s.maxT - s.t) * 2);
    switch (s.kind) {
      case P_LEAF: {
        // hoja pixel con vaivén y "volteo" (alto variable); alpha respira con el índice
        const sway = Math.round(Math.sin(s.t * 2.2 + s.seed * 9) * 9);
        const flip = Math.abs(Math.sin(s.t * 4.4 + s.seed * 5));
        ctx.globalAlpha = (0.55 + 0.35 * s.seed) * fade * (0.9 + 0.2 * idx);
        ctx.fillStyle = LEAF_COLS[s.seedI & 3];
        ctx.fillRect(x + sway, y, s.size, Math.max(1, Math.round(flip * 2) + 1));
        break;
      }
      case P_PETAL: {
        const sway = Math.round(Math.sin(s.t * 2.5 + s.seed * 8) * 8);
        const fl = Math.sin(s.t * 3.4 + s.seed * 6);
        ctx.globalAlpha = (0.6 + 0.3 * s.seed) * fade * (0.9 + 0.2 * idx);
        ctx.fillStyle = PETAL_COLS[s.seedI & 3];
        ctx.fillRect(x + sway, y, s.size, Math.max(1, Math.round(Math.abs(fl) * 2) + 1));
        ctx.globalAlpha *= 0.7;
        ctx.fillStyle = '#f6e8ec';
        ctx.fillRect(x + sway + (fl > 0 ? 1 : s.size - 2), y, 1, 1);
        break;
      }
      case P_DROP: {
        // gota 1×4 inclinada (2 rects para el ángulo del viento)
        // lluvia forzada R1 = opaca; lluvia del índice = alpha bajo
        ctx.globalAlpha = s.size === 2 ? 0.5 : 0.22 + 0.16 * s.seed;
        ctx.fillStyle = '#a8c4de';
        const d = s.vx > 0 ? 1 : 0;
        ctx.fillRect(x, y, 1, 3);
        ctx.fillRect(x + d, y + 3, 1, 1);
        break;
      }
      case P_SPLASH: {
        // chispazo de 2-3 px (~1 frame) y luego ripple mínimo (línea 1px que crece)
        const ph = s.t / s.maxT;
        if (ph < 0.15) {
          ctx.globalAlpha = 0.7 * (1 - ph * 5);
          ctx.fillStyle = '#c8dcec';
          ctx.fillRect(x - 1, y - 1, s.size, 2);
        } else {
          const w = Math.round(3 + (ph - 0.15) * 10);
          ctx.globalAlpha = 0.45 * (1 - ph);
          ctx.fillStyle = '#a8c4de';
          ctx.fillRect(x - (w >> 1), y, w, 1);
        }
        break;
      }
      case P_WISP: {
        // voluta de bruma fría (complementa las franjas fijas)
        const pulse = 0.7 + 0.3 * Math.sin(g.globalT * 1.4 + s.seed * 9);
        ctx.globalAlpha = 0.12 * fade * pulse;
        ctx.fillStyle = '#9db2c8';
        ctx.fillRect(x, y, s.size, 2);
        break;
      }
      default:
        break;
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------- Dibujo: capa cielo (delante, sobre iluminación) ----------------

/**
 * DELANTE de todo (bajo HUD): brillos del clima en 'lighter' —
 * luciérnagas con halo de 2 capas, chispas de vela, polen luminoso,
 * briznas de atardecer, motas doradas de los haces y el micro-polvo
 * de la cripta flotando en las zonas iluminadas.
 */
export function drawWeatherSky(ctx: CanvasRenderingContext2D, g: Game): void {
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const nf = g.mapId === 'lunaris' ? nightFactor(g.dayT) : 0;
  const idx = weatherIndexAt(g.mapId, g.globalT);

  // motas doradas dentro de los haces (cripta, deterministas)
  if (g.mapId === 'cripta') drawShaftMotes(ctx, g);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < CAP; i++) {
    const s = pool[i];
    if (!s.active) continue;
    const x = (s.x * ZOOM - camX) | 0;
    const y = (s.y * ZOOM - camY) | 0;
    const fade = Math.min(1, s.t * 3, (s.maxT - s.t) * 2);
    switch (s.kind) {
      case P_FIREFLY: {
        if (nf < 0.02) break;
        // parpadeo sin(globalT*2 + seed), núcleo 1px de mundo (2×2 pantalla)
        const b = Math.max(0, Math.sin(g.globalT * 2 + s.seed * 6.283));
        const br = b * b;
        // capa 1: halo cálido cercano
        ctx.globalAlpha = 0.28 * br * nf;
        ctx.fillStyle = '#c8e890';
        ctx.fillRect(x - 2, y - 2, 6, 6);
        // capa 2: halo amplio tenue
        ctx.globalAlpha = 0.1 * br * nf;
        ctx.fillStyle = '#9cc878';
        ctx.fillRect(x - 5, y - 5, 12, 12);
        // núcleo
        ctx.globalAlpha = (0.35 + 0.65 * br) * nf;
        ctx.fillStyle = '#d8f0a0';
        ctx.fillRect(x, y, 2, 2);
        break;
      }
      case P_BRIZNA: {
        // brizna de luz titilante (1×3 + colita desplazada)
        const tw = Math.sin(g.globalT * 3 + s.seed * 12);
        const a = (0.2 + 0.5 * Math.max(0, tw) * Math.max(0, tw)) * fade * (0.9 + 0.2 * idx);
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.fillStyle = '#ffd890';
        ctx.fillRect(x, y, 1, 3);
        ctx.globalAlpha = a * 0.6;
        ctx.fillRect(x + 1, y - 1, 1, 2);
        break;
      }
      case P_POLLEN: {
        // polen luminoso: pulso lento + halo
        const pulse = 0.5 + 0.5 * Math.sin(g.globalT * 2.6 + s.seed * 9);
        ctx.globalAlpha = 0.15 * pulse * fade;
        ctx.fillStyle = '#e8d890';
        ctx.fillRect(x - 1, y - 1, 4, 4);
        ctx.globalAlpha = (0.3 + 0.5 * pulse) * fade;
        ctx.fillStyle = '#fff0b0';
        ctx.fillRect(x, y, 2, 2);
        break;
      }
      case P_SPARK: {
        // chispa de vela: flicker rápido, forma alterna por semilla
        const fl = Math.abs(Math.sin(s.t * 26 + s.seed * 20));
        ctx.globalAlpha = (0.35 + 0.65 * fl) * fade;
        ctx.fillStyle = '#ffb060';
        if ((s.seedI & 1) === 0) ctx.fillRect(x, y, 1, 2);
        else ctx.fillRect(x, y, 2, 1);
        break;
      }
      case P_DUST: {
        // micro-polvo: mota 1px de mundo (2×2 pantalla), pulso lento,
        // sutil (alpha ≤0.24), tintada cálida cerca del fuego
        const pulse = 0.55 + 0.45 * Math.sin(g.globalT * 1.1 + s.seed * 11);
        ctx.globalAlpha = (0.08 + 0.1 * pulse) * fade * (0.85 + 0.3 * idx);
        ctx.fillStyle = '#d8c8a0';
        ctx.fillRect(x, y, 2, 2);
        break;
      }
      default:
        break;
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------- Estadísticas (debug/harness, no usar por frame) ----------------

export interface WeatherStats {
  active: number; drops: number; splashes: number; dust: number; fireflies: number;
  index: number; wind: number; rainAmp: number;
}

/** Snapshot del estado del clima (para harness/debug; aloca un objeto). */
export function weatherStats(): WeatherStats {
  let drops = 0, splashes = 0, dust = 0, fireflies = 0;
  for (let i = 0; i < CAP; i++) {
    const s = pool[i];
    if (!s.active) continue;
    if (s.kind === P_DROP) drops++;
    else if (s.kind === P_SPLASH) splashes++;
    else if (s.kind === P_DUST) dust++;
    else if (s.kind === P_FIREFLY) fireflies++;
  }
  return {
    active: drops + splashes + dust + fireflies,
    drops, splashes, dust, fireflies,
    index: curIdx, wind: curWind, rainAmp: curRainAmp,
  };
}
