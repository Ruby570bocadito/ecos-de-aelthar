// ============================================================
// ECOS DE AELTHAR — Iluminación dinámica v3 (R4-A3 · módulo world)
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
// la lista de ojos inyectada y las cachés de canvas (scratch/viñeta).
// ============================================================

import { VIEW_W, VIEW_H, ZOOM } from '../consts';
import { TILE } from '../sprites';
import type { Game } from '../engine';
import type { Entity, StatusFx } from '../types';
import { hash2, LIGHT_PAL } from './palette';

// ---------------- API pública ----------------

/** Fuente de luz deducida del estado del juego.
 *  Coordenadas x/y en px de MUNDO (1x, sin ZOOM); r en px de mundo.
 *  `flicker` es la semilla/fase de parpadeo (radianes): en v3 alimenta
 *  flickerOf() (2 senos inconmensurables + hash de la semilla) → radio
 *  ±8 % y alpha ±10 % con períodos de 0.4–0.9 s. */
export interface LightSrc { x: number; y: number; r: number; color: string; flicker: number; }

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

// ---------------- Utilidades ----------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
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

function blackA(a: number): string {
  return `rgba(0,0,0,${a.toFixed(3)})`;
}

function lerp3(A: RGB, B: RGB, u: number): RGB {
  return [
    A[0] + (B[0] - A[0]) * u,
    A[1] + (B[1] - A[1]) * u,
    A[2] + (B[2] - A[2]) * u,
  ];
}

interface DaySample { a: number; col: RGB; w: number; wc: RGB; }

/** Muestrea el ciclo día/noche interpolando los 2 keyframes adyacentes
 *  con easeInOut (C2). El wrap 1→0 es continuo (parada final = inicial). */
function sampleDay(d: number): DaySample {
  const t = clamp(d, 0, 1);
  for (let i = 0; i < DAY_STOPS.length - 1; i++) {
    const A = DAY_STOPS[i], B = DAY_STOPS[i + 1];
    if (t >= A.t && t <= B.t) {
      const u = easeInOut((t - A.t) / Math.max(1e-6, B.t - A.t));
      return {
        a: A.a + (B.a - A.a) * u,
        col: lerp3(A.col, B.col, u),
        w: A.w + (B.w - A.w) * u,
        wc: lerp3(A.wc, B.wc, u),
      };
    }
  }
  const last = DAY_STOPS[DAY_STOPS.length - 1];
  return { a: last.a, col: last.col, w: last.w, wc: last.wc };
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

/** ¿El tile es transitable (puede recibir luz frontal de muro)? */
function isWalkable(ch: string): boolean {
  return ch !== '#' && ch !== 'V' && ch !== 'P' && ch !== 'A' && ch !== 'H' && ch !== 'r';
}

// ---------------- Recolección de luces ----------------

/** Antorchas de muro de la cripta: rejilla determinista basada en hash2
 *  (R1-A6, intacta): celdas 4×4 + máximo local + separación mínima.
 *  Devuelve las posiciones (px de mundo) EMITIDAS en la vista, para que
 *  collectLights haga crecer la luz del Portador con las cercanas. */
function collectCryptTorches(g: Game, out: LightSrc[]): { x: number; y: number }[] {
  const rows = g.rows.length >= g.map.h ? g.rows : g.map.rows;
  const W = g.map.w, H = g.map.h;
  const emitted: { x: number; y: number }[] = [];

  // hash de portación por muro (semilla estable de parpadeo incluida)
  const hTorch = (tx: number, ty: number) => hash2(tx * 7 + 3, ty * 11 + 5);

  // 1) candidatos: muros '#' que dan a una sala, en orden de barrido fijo
  const cand: { tx: number; ty: number; h: number }[] = [];
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (rows[ty][tx] !== '#') continue;
      const n = (rows[ty - 1] ?? '')[tx], s = (rows[ty + 1] ?? '')[tx];
      const w = rows[ty][tx - 1], e = rows[ty][tx + 1];
      if (!isWalkable(n) && !isWalkable(s) && !isWalkable(w) && !isWalkable(e)) continue;
      cand.push({ tx, ty, h: hTorch(tx, ty) });
    }
  }

  // 2) rejilla: la celda 4×4 decide (hash de celda) y el máximo local elige el muro
  const kept: { tx: number; ty: number; h: number; seed: number }[] = [];
  for (const c of cand) {
    const cellX = c.tx >> 2, cellY = c.ty >> 2;
    const hCell = hash2(cellX * 13 + 1, cellY * 29 + 7);
    if (hCell >= TORCH_CELL_KEEP) continue;
    let win = true;
    for (const o of cand) {
      if (o === c) continue;
      if ((o.tx >> 2) !== cellX || (o.ty >> 2) !== cellY) continue;
      if (o.h > c.h || (o.h === c.h && (o.ty < c.ty || (o.ty === c.ty && o.tx < c.tx)))) { win = false; break; }
    }
    if (!win) continue;
    // separación mínima con portadoras ya aceptadas (orden determinista)
    let spaced = true;
    for (const k of kept) {
      const dx = k.tx - c.tx, dy = k.ty - c.ty;
      if (dx * dx + dy * dy < TORCH_MIN_DIST2) { spaced = false; break; }
    }
    if (!spaced) continue;
    kept.push({ tx: c.tx, ty: c.ty, h: hCell, seed: c.h * 97 });
  }

  // 3) emisión: solo las que caen en la vista (radio de margen holgado)
  const ZT = ZOOM * TILE;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const vx0 = camX / ZT - 6, vy0 = camY / ZT - 6;
  const vx1 = (camX + VIEW_W) / ZT + 6, vy1 = (camY + VIEW_H) / ZT + 6;
  for (const k of kept) {
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
    emitted.push({ x: px, y: py });
  }
  return emitted;
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

/** Deduce TODAS las fuentes de luz visibles a partir del estado del juego.
 *  Determinista salvo pulsos/parpadeos derivados de g.globalT. */
export function collectLights(g: Game): LightSrc[] {
  const lights: LightSrc[] = [];
  const t = g.globalT;

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
      lights.push({ x: cx, y: cy - 5, r: 58, color: LIGHT_PAL.forgeEmber, flicker: 2.1 });
    } else if (pr.kind === 'altarEcho' && g.mapId === 'cripta') {
      // el fragmento dorado brilla fuerte hasta recoger el Eco de la Voz
      const taken = !!g.flags.ecoVoz;
      lights.push({ x: cx, y: cy - 12, r: taken ? 44 : 80, color: LIGHT_PAL.altarGold, flicker: 0.7 });
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

  // 4) Jugador
  const p = g.player;
  if (p && !p.dead) {
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
      const r = PLAYER_LIGHT_R + Math.min(PLAYER_GROW_MAX, near * PLAYER_GROW_STEP);
      lights.push({ x: p.x, y: p.y - 6, r, color: PLAYER_LIGHT_COL, flicker: 0 });
    }
  }

  return lights;
}

// ---------------- Canvas offscreen (scratch reutilizable) ----------------
// Caché de buffer de dibujo, sin datos de juego: se limpia en cada frame.
let scratchCv: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function getScratch(): { cv: HTMLCanvasElement; cx: CanvasRenderingContext2D } {
  if (!scratchCv) {
    scratchCv = document.createElement('canvas');
    scratchCv.width = VIEW_W;
    scratchCv.height = VIEW_H;
    scratchCtx = scratchCv.getContext('2d');
  }
  return { cv: scratchCv, cx: scratchCtx! };
}

// ---------------- Viñeta v2: ojo dithered (pre-pintada en caché) ----------------
// Forma de OJO: elipse (superelipse p=2.4 en la cripta → se cierra por los
// 4 lados) cuantizada a 3 niveles con DITHER Bayer 4×4 ordenado. Se pinta
// UNA vez por variante (normal/cripta) y por frame solo hay un drawImage.

let vigNormal: HTMLCanvasElement | null = null;
let vigCrypt: HTMLCanvasElement | null = null;

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

// ---------------- Pipeline principal ----------------

/** Iluminación dinámica v3. Dibuja SOBRE ctx (canvas principal, espacio de
 *  vista 960×540): franja del ciclo día/noche → capa de oscuridad (vetas
 *  por tile en la cripta) con recortes ESCALONADOS por luz → tinte cálido
 *  aditivo → viñeta de ojo dithered → ojos que brillan en la oscuridad.
 *  En mapas dark usa oscuridad base 0.82 con vetas ±0.04, antorchas ámbar
 *  y luz propia del Portador (r 70→94). */
export function drawLightingV2(ctx: CanvasRenderingContext2D, g: Game): void {
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const lights = collectLights(g);
  const darkMap = !!g.map.dark;

  // ---- a) oscuridad y tinte según día/noche (o cripta) ----
  let dark: DaySample;
  if (darkMap) {
    // la cripta "respira" como brasas lejanas (más sutil que en v2:
    // las vetas por tile ya aportan la variación fina)
    const a = CRYPT_DARK + Math.sin(g.globalT * 9) * 0.012 + Math.sin(g.globalT * 19.3 + 1.7) * 0.008;
    dark = { a, col: CRYPT_COL, w: 0, wc: [255, 148, 74] };
  } else {
    dark = sampleDay(g.dayT);
  }

  // tinte de franja (amanecer rosa / tarde ámbar), 'source-over' simulando
  // un multiply suave — antes de la oscuridad para que la luz lo respire
  if (dark.w > 0.004) {
    ctx.fillStyle = rgba(dark.wc, dark.w);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // ---- b) capa de oscuridad con recortes por luz ----
  if (dark.a > 0.02) {
    const sc = getScratch();
    const lx = sc.cx;
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, VIEW_W, VIEW_H);

    if (darkMap) {
      // VETAS de oscuridad: la oscuridad base varía por tile con hash
      // determinista (2 octavas: tile y bloque 2×2) → la cripta se siente
      // viva y opresiva sin coste de estado.
      const ZT = ZOOM * TILE;
      const tx0 = Math.floor(camX / ZT), ty0 = Math.floor(camY / ZT);
      const tx1 = Math.floor((camX + VIEW_W - 1) / ZT), ty1 = Math.floor((camY + VIEW_H - 1) / ZT);
      for (let ty = ty0; ty <= ty1; ty++) {
        const sy = ty * ZT - camY;
        for (let tx = tx0; tx <= tx1; tx++) {
          const hv = 0.62 * h2(tx, ty) + 0.38 * h2((tx >> 1) + 31, (ty >> 1) + 57);
          const aT = clamp(dark.a + (hv - 0.5) * CRYPT_VEIN, 0.5, 0.94);
          lx.fillStyle = rgba(dark.col, aT);
          lx.fillRect(tx * ZT - camX, sy, ZT, ZT);
        }
      }
    } else {
      lx.fillStyle = rgba(dark.col, Math.min(1, dark.a));
      lx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // agujeros de luz ESCALONADOS: destination-out SOLO sobre la capa de
    // oscuridad. 3 bandas (0.92/0.62/0.30 de fuerza, respirando con af)
    // con fade final — el borde se lee en escalones, no como 1 corte duro.
    lx.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const fk = flickerOf(L.flicker, g.globalT);
      const r = L.r * ZOOM * fk.rf;
      const x = Math.round(L.x * ZOOM) - camX + Math.round(Math.sin(g.globalT * 7.3 + L.flicker * 5.1));
      const y = Math.round(L.y * ZOOM) - camY + Math.round(Math.cos(g.globalT * 6.1 + L.flicker * 3.7));
      if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) continue;
      const a0 = clamp(0.92 * fk.af, 0, 0.96);
      const a1 = clamp(0.62 * fk.af, 0, 0.96);
      const a2 = clamp(0.30 * fk.af, 0, 0.96);
      const r0 = Math.max(2, r * 0.05);
      const gr = lx.createRadialGradient(x, y, r0, x, y, r);
      gr.addColorStop(0, blackA(a0));
      gr.addColorStop(0.40, blackA(a0));   // banda 1: núcleo pleno
      gr.addColorStop(0.40, blackA(a1));   // ─ escalón ─
      gr.addColorStop(0.66, blackA(a1));   // banda 2
      gr.addColorStop(0.66, blackA(a2));   // ─ escalón ─
      gr.addColorStop(0.86, blackA(a2));   // banda 3
      gr.addColorStop(0.86, blackA(0));    // ─ fade final (sin corte) ─
      gr.addColorStop(1, blackA(0));
      lx.fillStyle = gr;
      lx.fillRect(x - Math.round(r), y - Math.round(r), Math.round(r * 2), Math.round(r * 2));
    }
    lx.globalCompositeOperation = 'source-over';

    // componer: los huecos revelan el escenario
    ctx.drawImage(sc.cv, 0, 0);
  }

  // ---- c) tinte cálido aditivo por luz ----
  // alpha derivada del color: cálidas (naranjas/dorados) más intensas,
  // frías (cian/violeta) tenues — ahora respira con af (alpha ±10 %)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    const [cr, cg, cb] = hexRgb(L.color);
    const warmth = (cr - cb) / 255;
    const base = clamp(0.07 + warmth * 0.09, 0.05, 0.15);
    const fk = flickerOf(L.flicker, g.globalT);
    const alpha = clamp(base * fk.af, 0, 0.2);
    const r = L.r * ZOOM * fk.rf;
    const x = Math.round(L.x * ZOOM) - camX, y = Math.round(L.y * ZOOM) - camY;
    if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) continue;
    const tg = ctx.createRadialGradient(x, y, 0, x, y, r);
    tg.addColorStop(0, rgbaA(cr, cg, cb, alpha));
    tg.addColorStop(1, rgbaA(cr, cg, cb, 0));
    ctx.fillStyle = tg;
    ctx.fillRect(x - Math.round(r), y - Math.round(r), Math.round(r * 2), Math.round(r * 2));
  }
  ctx.restore();

  // ---- d) viñeta v2: forma de ojo, dithered (pre-pintada; más cerrada
  //      por los 4 lados en la cripta) ----
  ctx.drawImage(ensureVignette(darkMap), 0, 0);

  // ---- e) ojos que brillan EN la oscuridad (setEyesVisible) ----
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
