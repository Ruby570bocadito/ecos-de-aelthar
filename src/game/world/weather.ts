// ============================================================
// ECOS DE AELTHAR — weather (R1-A7 · clima y atmósfera por mapa)
// Sistema de CLIMA con identidad fuerte por mapa, independiente
// del ambient simple de fx.ts (conviven: fx = motas genéricas,
// weather = clima con personalidad):
//
//   lunaris : briznas de luz al atardecer (dayT≈0.36..0.56),
//             luciérnagas de noche (dayT>0.6, 12-18 vivas),
//             pétalos a la deriva en epoch='pasado'.
//   bosque  : hojas cayendo SIEMPRE, polen luminoso en el pasado,
//             niebla baja en 3 franjas horizontales que derivan
//             y se envuelven (wrap), gotas ocasionales.
//   cripta  : 3 haces de luz diagonales (desde arriba-derecha)
//             con motas doradas ascendiendo, chispas de vela,
//             bruma fría a ras de suelo.
//
// INTEGRACIÓN (la conecta el integrador; no tocar render.ts aquí):
//   updateWeather(g, dt)      → en el update (junto a updateAmbient)
//   drawWeatherWorld(ctx, g)  → DETRÁS de entidades (capa 'world',
//                               junto a drawAmbient(g,'world'))
//   drawWeatherSky(ctx, g)    → DELANTE, sobre la iluminación
//                               (junto a drawAmbient(g,'sky'))
//
// RENDIMIENTO: pool fijo de 140 ranuras reutilizado (cero GC por
// frame), spawn determinista con hash2 + globalT (ticks de 1/20 s),
// posiciones en coords de MUNDO 1× ligadas a cámara (spawn fuera
// de vista, kill fuera de vista+margen) y todo fillRect con
// coordenadas enteras para que nada "tiemble".
// ============================================================

import type { Game } from '../engine';
import { VIEW_W, VIEW_H, ZOOM } from '../engine';
import { hash2 } from './palette';

// ---------------- Modo de lluvia (opcional) ----------------

export type WeatherMode = 'auto' | 'rain';

// API pública mutable: importarla mantiene el binding vivo
// (import { weatherMode } from ...). Para cambiarla desde código
// de juego existe setWeatherMode().
// eslint-disable-next-line prefer-const -- mutable a propósito (API pública)
export let weatherMode: WeatherMode = 'auto';

/** Fija el modo de lluvia ('auto' = solo gotas ocasionales en bosque). */
export function setWeatherMode(m: WeatherMode): void {
  weatherMode = m;
}

// ---------------- Tipos internos ----------------

const P_PETAL = 0;   // lunaris: pétalos (pasado)
const P_BRIZNA = 1;  // lunaris: briznas de luz (atardecer)
const P_FIREFLY = 2; // lunaris: luciérnagas (noche)
const P_LEAF = 3;    // bosque: hojas
const P_POLLEN = 4;  // bosque: polen luminoso (pasado)
const P_DROP = 5;    // gotas (bosque; lluvia en modo 'rain')
const P_SPLASH = 6;  // salpicón 2px + ripple mínimo
const P_SPARK = 7;   // cripta: chispa de vela
const P_WISP = 8;    // cripta: voluta de bruma fría

const CAP = 140;     // presupuesto total de partículas del clima
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
  s.x = _wx0 - 12 + hash2(k, 3) * (_wx1 - _wx0 + 24);
  s.y = _wy0 - 6 - hash2(k, 5) * 12;
  s.vx = 7 + hash2(k, 7) * 9;          // brisa suave hacia la derecha
  s.vy = 9 + hash2(k, 11) * 8;
  s.t = 0; s.maxT = 6 + hash2(k, 13) * 3;
  s.seed = hash2(k, 17); s.seedI = (k * 31 + 7) | 0;
  s.size = hash2(k, 19) < 0.3 ? 3 : 2; // las cercanas algo mayores
}

function spawnBrizna(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_BRIZNA;
  s.x = _wx0 - 8 + hash2(k, 23) * (_wx1 - _wx0 + 16);
  s.y = _wy0 - 4 - hash2(k, 29) * 14;
  s.vx = 10 + hash2(k, 31) * 9;
  s.vy = 4 + hash2(k, 37) * 5;
  s.t = 0; s.maxT = 4.5 + hash2(k, 41) * 2.5;
  s.seed = hash2(k, 43); s.seedI = (k * 37 + 11) | 0;
  s.size = 1;
}

function spawnFirefly(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_FIREFLY;
  // entra por un borde aleatorio con velocidad hacia el interior
  const e = Math.floor(hash2(k, 23) * 4);
  const r1 = hash2(k, 29), r2 = hash2(k, 31);
  if (e === 0) { s.x = _wx0; s.y = _wy0 + r2 * (_wy1 - _wy0); s.tvx = 8 + r1 * 8; s.tvy = (r2 - 0.5) * 8; }
  else if (e === 1) { s.x = _wx1; s.y = _wy0 + r2 * (_wy1 - _wy0); s.tvx = -(8 + r1 * 8); s.tvy = (r2 - 0.5) * 8; }
  else if (e === 2) { s.x = _wx0 + r2 * (_wx1 - _wx0); s.y = _wy0; s.tvx = (r1 - 0.5) * 8; s.tvy = 6 + r1 * 6; }
  else { s.x = _wx0 + r2 * (_wx1 - _wx0); s.y = _wy1; s.tvx = (r1 - 0.5) * 8; s.tvy = -(6 + r1 * 6); }
  s.vx = s.tvx; s.vy = s.tvy;
  s.t = 0; s.maxT = 14;
  s.seed = hash2(k, 37); s.seedI = (k * 41 + 13) | 0;
  s.size = 2; s.phase = -1;
}

function spawnLeaf(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_LEAF;
  s.x = _wx0 - 10 + hash2(k, 3) * (_wx1 - _wx0 + 20);
  s.y = _wy0 - 6 - hash2(k, 5) * 10;
  s.vx = (hash2(k, 7) - 0.5) * 8;
  s.vy = 14 + hash2(k, 11) * 10;
  s.t = 0; s.maxT = 8 + hash2(k, 13) * 4;
  s.seed = hash2(k, 17); s.seedI = (k * 29 + 3) | 0;
  s.size = hash2(k, 19) < 0.25 ? 3 : 2;
}

function spawnPollen(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_POLLEN;
  s.x = _wx0 + 48 + hash2(k, 3) * (_wx1 - _wx0 - 96);
  s.y = _wy0 + 48 + hash2(k, 5) * (_wy1 - _wy0 - 96);
  s.vx = (hash2(k, 7) - 0.5) * 9;
  s.vy = -1 - hash2(k, 11) * 3.5;
  s.t = 0; s.maxT = 4 + hash2(k, 13) * 3;
  s.seed = hash2(k, 17); s.seedI = (k * 23 + 5) | 0;
  s.size = 2;
}

function spawnDrop(g: Game, k: number, heavy: boolean): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_DROP;
  s.x = _wx0 + 40 + hash2(k, 3) * (_wx1 - _wx0 - 80);
  s.y = _wy0 + MARGIN - 10;             // justo por encima de la vista
  s.vx = heavy ? 40 + hash2(k, 7) * 25 : 8 + hash2(k, 7) * 6;
  s.vy = heavy ? 300 + hash2(k, 11) * 90 : 120 + hash2(k, 11) * 30;
  // plano de suelo aleatorio por gota → profundidad creíble
  s.groundY = _wy0 + 56 + hash2(k, 13) * (_wy1 - _wy0 - 72);
  s.t = 0; s.maxT = 2.2;
  s.seed = hash2(k, 17); s.seedI = (k * 19 + 9) | 0;
  s.size = 1;
}

/** Convierte una gota en salpicón + ripple en su plano de suelo. */
function toSplash(s: WSlot, heavy: boolean): void {
  s.kind = P_SPLASH;
  s.y = s.groundY;
  s.vx = 0; s.vy = 0;
  s.t = 0;
  s.maxT = heavy ? 0.42 : 0.3;
  s.size = heavy ? 2 : 1;
}

function spawnSpark(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_SPARK;
  s.x = _wx0 + 48 + hash2(k, 3) * (_wx1 - _wx0 - 96);
  s.y = _wy0 + 150 + hash2(k, 5) * (_wy1 - _wy0 - 200);
  s.vx = (hash2(k, 7) - 0.5) * 14;
  s.vy = -(14 + hash2(k, 11) * 12);
  s.t = 0; s.maxT = 0.5 + hash2(k, 13) * 0.4;
  s.seed = hash2(k, 17); s.seedI = (k * 17 + 21) | 0;
  s.size = 1;
}

function spawnWisp(g: Game, k: number): void {
  const s = alloc(); if (!s) return;
  s.active = true; s.kind = P_WISP;
  s.x = _wx0 + 40 + hash2(k, 3) * (_wx1 - _wx0 - 80);
  s.y = _wy1 - 30 - hash2(k, 5) * 26;   // a ras de suelo
  s.vx = (hash2(k, 7) - 0.5) * 10;
  s.vy = -0.5 - hash2(k, 11) * 1.5;
  s.t = 0; s.maxT = 5 + hash2(k, 13) * 3;
  s.seed = hash2(k, 17); s.seedI = (k * 13 + 17) | 0;
  s.size = 5;
}

/**
 * Un tick de spawn = 1/20 s. Toda la aleatoriedad sale de
 * hash2(tick, const): determinista y estable entre frames.
 */
function spawnTick(g: Game, k: number): void {
  if (g.mapId === 'lunaris') {
    // pétalos solo en el pasado
    if (g.epoch === 'pasado' && hash2(k * 13 + 1, 71) < 0.18) spawnPetal(g, k);
    // briznas de luz al atardecer
    const dusk = duskFactor(g.dayT);
    if (dusk > 0.15 && hash2(k * 13 + 2, 73) < 0.2 * dusk) spawnBrizna(g, k);
    // luciérnagas: mantener 12-18 vivas de noche (dayT>0.6)
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
    // hojas SIEMPRE
    if (hash2(k * 13 + 4, 83) < 0.26) spawnLeaf(g, k);
    // polen luminoso solo en el pasado
    if (g.epoch === 'pasado' && hash2(k * 13 + 5, 89) < 0.22) spawnPollen(g, k);
    if (weatherMode === 'rain') {
      // lluvia ligera: 3 gotas por tick (~60/s)
      spawnDrop(g, k * 3, true);
      spawnDrop(g, k * 3 + 1, true);
      spawnDrop(g, k * 3 + 2, true);
    } else if (hash2(k * 13 + 6, 97) < 0.014) {
      spawnDrop(g, k, false); // gota ocasional en 'auto'
    }
  } else {
    // cripta: chispas de vela + volutas de bruma fría
    if (hash2(k * 13 + 7, 101) < 0.12) spawnSpark(g, k);
    if (hash2(k * 13 + 8, 103) < 0.09) spawnWisp(g, k);
  }
}

// ---------------- Update ----------------

/** Deriva de luciérnaga: dirección objetivo nueva cada ~1 s (hash), giro suave. */
function fireflyStep(s: WSlot, g: Game, dt: number): void {
  const ph = Math.floor(g.globalT + s.seedI * 0.37);
  if (ph !== s.phase) {
    s.phase = ph;
    const ang = hash2(ph * 7, s.seedI) * 6.2832;
    const sp = 5 + hash2(ph * 11, s.seedI * 3 + 1) * 9;
    s.tvx = Math.cos(ang) * sp;
    s.tvy = Math.sin(ang) * sp * 0.6 - 1.5; // leve tendencia a flotar
  }
  const k2 = Math.min(1, dt * 1.8);
  s.vx += (s.tvx - s.vx) * k2;
  s.vy += (s.tvy - s.vy) * k2;
}

/**
 * Avanza el clima. Llamar 1× por frame desde update (con dt del juego).
 * Reinicia el pool al cambiar de mapa/época (el clima es identidad).
 */
export function updateWeather(g: Game, dt: number): void {
  if (g.mapId !== lastMap || g.epoch !== lastEpoch) {
    lastMap = g.mapId; lastEpoch = g.epoch;
    for (let i = 0; i < CAP; i++) pool[i].active = false;
    lastTick = -1;
  }

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
        if (s.y >= s.groundY) { toSplash(s, weatherMode === 'rain'); continue; }
        break;
      case P_SPARK:
        s.vy += 6 * dt; // las chispas frenan levemente al subir
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

/** x en pantalla del eje del haz j a la altura y (con vaivén lento). */
function shaftX(j: number, y: number, sway: number): number {
  return SHAFT_X[j] + SHAFT_SLOPE * y + sway;
}

/** 2-3 haces diagonales con parpadeo lento (capa mundo, tras entidades). */
function drawShafts(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#d8c890';
  for (let j = 0; j < SHAFT_N; j++) {
    const flick = 0.8 + 0.2 * Math.sin(g.globalT * 0.7 + j * 2.4);
    const sway = Math.sin(g.globalT * 0.21 + j * 2.1) * 8;
    // rodajas horizontales de 18px → diagonal suave sin paths caros
    for (let y = 0; y < VIEW_H; y += 18) {
      const x = shaftX(j, y, sway);
      ctx.globalAlpha = SHAFT_A[j] * flick * (1.15 - (y / VIEW_H) * 0.55);
      ctx.fillRect(Math.round(x), y, SHAFT_W[j], 18);
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
    const h1 = hash2(i * 31 + 7, 401);
    const h2 = hash2(i * 17 + 3, 409);
    const h3 = hash2(i * 13 + 1, 419);
    const j = i % SHAFT_N;
    const cyc = (g.globalT * (0.045 + h1 * 0.04) + h2) % 1;
    const y = VIEW_H + 10 - cyc * (VIEW_H + 20);
    const sway = Math.sin(g.globalT * 0.21 + j * 2.1) * 8;
    const x = shaftX(j, y, sway) + Math.sin(g.globalT * 0.6 + h3 * 9) * (SHAFT_W[j] * 0.5);
    ctx.globalAlpha = Math.sin(cyc * Math.PI) * (0.25 + h3 * 0.3);
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------- Niebla y bruma (franjas deterministas con wrap) ----------------

interface FogLayer { y: number; h0: number; pitch: number; speed: number; alpha: number; dir: number }
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
 * Franjas horizontales que derivan y se envuelven. La altura/alpha de
 * cada segmento depende de su ranura entera s (identidad estable), así
 * el patrón no "tiembla": scroll continuo, propiedades fijas por tramo.
 */
function drawFogLayers(ctx: CanvasRenderingContext2D, g: Game, layers: FogLayer[], color: string, densMul: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    const off = g.globalT * L.speed * L.dir;
    const span = VIEW_W + L.pitch * 2;
    const nSeg = Math.ceil(span / L.pitch) + 1;
    const yBase = Math.round(L.y * VIEW_H + Math.sin(g.globalT * 0.5 + i * 2.3) * 4);
    for (let s = 0; s < nSeg; s++) {
      let x = (s * L.pitch - off) % span;
      if (x < 0) x += span;
      x -= L.pitch;
      // propiedades ligadas a la ranura s → estables al envolver
      const h = Math.round(L.h0 + hash2(s * 17 + i, 500) * 6);
      const a = L.alpha * densMul * (0.85 + hash2(s * 23 + i, 510) * 0.3);
      ctx.globalAlpha = a;
      ctx.fillRect(Math.round(x), yBase, L.pitch, h);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------- Dibujo: capa mundo (detrás de entidades) ----------------

/**
 * DETRÁS de entidades: niebla baja del bosque, bruma y haces de la
 * cripta, hojas, pétalos, gotas y salpicones. Coordenadas de pantalla:
 * screen = world*ZOOM - cam, redondeadas a px entero.
 */
export function drawWeatherWorld(ctx: CanvasRenderingContext2D, g: Game): void {
  const camX = Math.round(g.camX), camY = Math.round(g.camY);

  // ---- capas atmosféricas por mapa ----
  if (g.mapId === 'bosque') {
    // el pasado recuerda con menos niebla
    drawFogLayers(ctx, g, FOG_LAYERS, '#aebfb4', g.epoch === 'pasado' ? 0.55 : 1);
  } else if (g.mapId === 'cripta') {
    drawShafts(ctx, g);
    drawFogLayers(ctx, g, MIST_LAYERS, '#9db2c8', 1);
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
        // hoja pixel con vaivén y "volteo" (alto variable)
        const sway = Math.round(Math.sin(s.t * 2.2 + s.seed * 9) * 9);
        const flip = Math.abs(Math.sin(s.t * 4.4 + s.seed * 5));
        ctx.globalAlpha = (0.55 + 0.35 * s.seed) * fade;
        ctx.fillStyle = LEAF_COLS[s.seedI & 3];
        ctx.fillRect(x + sway, y, s.size, Math.max(1, Math.round(flip * 2) + 1));
        break;
      }
      case P_PETAL: {
        const sway = Math.round(Math.sin(s.t * 2.5 + s.seed * 8) * 8);
        const fl = Math.sin(s.t * 3.4 + s.seed * 6);
        ctx.globalAlpha = (0.6 + 0.3 * s.seed) * fade;
        ctx.fillStyle = PETAL_COLS[s.seedI & 3];
        ctx.fillRect(x + sway, y, s.size, Math.max(1, Math.round(Math.abs(fl) * 2) + 1));
        ctx.globalAlpha *= 0.7;
        ctx.fillStyle = '#f6e8ec';
        ctx.fillRect(x + sway + (fl > 0 ? 1 : s.size - 2), y, 1, 1);
        break;
      }
      case P_DROP: {
        // gota 1×4 inclinada (2 rects para el ángulo del viento)
        ctx.globalAlpha = weatherMode === 'rain' ? 0.55 : 0.4;
        ctx.fillStyle = '#a8c4de';
        const d = s.vx > 0 ? 1 : 0;
        ctx.fillRect(x, y, 1, 3);
        ctx.fillRect(x + d, y + 3, 1, 1);
        break;
      }
      case P_SPLASH: {
        // salpicón 2px y luego ripple mínimo (línea 1px que crece)
        const ph = s.t / s.maxT;
        if (ph < 0.3) {
          ctx.globalAlpha = 0.7 * (1 - ph * 3);
          ctx.fillStyle = '#c8dcec';
          ctx.fillRect(x - 1, y - 1, 2, 2);
        } else {
          const w = Math.round(3 + (ph - 0.3) * 12);
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
 * briznas de atardecer y motas doradas de los haces.
 */
export function drawWeatherSky(ctx: CanvasRenderingContext2D, g: Game): void {
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const nf = g.mapId === 'lunaris' ? nightFactor(g.dayT) : 0;

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
        const a = (0.2 + 0.5 * Math.max(0, tw) * Math.max(0, tw)) * fade;
        ctx.globalAlpha = a;
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
      default:
        break;
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
