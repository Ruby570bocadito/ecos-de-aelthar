// ============================================================
// ECOS DE AELTHAR — storyart.ts (módulo actors · R11-9)
// EPIC 7.4 — FONDOS ANIMADOS de las escenas de historia
// ------------------------------------------------------------
// drawStoryBackdrop(ctx, sceneId, t, w, h) pinta el FONDO
// COMPLETO de cada escena clave (detrás del texto/letra que
// dibuja storyscenes.ts). El orquestador inyecta esta función
// en el módulo de escenas:
//
//   import { setStoryBackdropFn } from './storyscenes';
//   import { drawStoryBackdrop } from './storyart';
//   setStoryBackdropFn(drawStoryBackdrop);
//
// (este módulo NO importa storyscenes.ts: contrato unidireccional,
//  evita ciclos mientras ese archivo se escribe en paralelo).
//
// ESCENAS SOPORTADAS (id → QA visual rápido):
//  · 'acto1_fin'        : crepúsculo INVERTIDO (banda cálida arriba)
//    cuyos colores se APAGAN con t; colina en silueta con campanario
//    lejano; hojas que caen HACIA ARRIBA (regresan al cielo); grano
//    de película sutil que respira.
//  · 'acto2_fin'        : calle de aldea inundada en penumbra
//    azul-verdosa; 2 capas de olas en silueta con parallax; al fondo
//    el faro: su vela se ENCIENDE a t≈6 s (estado determinista) y
//    proyecta un reflejo vertical tembloroso sobre el agua.
//  · 'acto3_fin'        : noche cerrada; una GRIETA pálida se abre
//    lentamente (t 0→8 s) y se cierra como un ojo (8→12.5 s);
//    las estrellas se APAGAN cerca de la grieta; silueta de la
//    cripta abajo.
//  · 'acto4_inicio'     : umbral de niebla (3 bandas con crestas
//    curvas a velocidades distintas); figuras SIN ROSTRO a los
//    lados (siluetas encapuchadas con capas, vaivén de ±1 px);
//    desaturación progresiva hacia gris (rampa precalculada).
//  · 'heraldo_vencido'  : sala criptal; la CAPA VACÍA del Heraldo
//    ondea (ondas sinusoidales deterministas en el bajo); una nota
//    luminosa asciende y ESTALLA en motas a t≈7 s.
//  · 'eco_despierto'    : el ÁRBOL DEL ECO gigante en silueta
//    central; anillos de crecimiento que se expanden como ondas,
//    cada anillo monta una mini-viñeta en silueta (casa, barco,
//    tumba); luz cálida que crece con t.
//
// REGLAS (las de la casa — sky.ts / bossintro.ts):
//  · DETERMINISMO ABSOLUTO: cero Math.random; hash2 de
//    world/palette normalizado ×2 (el nativo devuelve [0,0.5)).
//  · CERO allocations por frame: partículas y geometrías en
//    tablas módulo preasignadas (horneadas 1× por escena/talla),
//    fillStyle constantes + globalAlpha (nunca strings rgba
//    dinámicas), fillRect con enteros.
//  · Sin gradientes: bandas planas escalonadas y halos de 2-3
//    pasos de alpha (estética pixel-art).
//  · PRERENDER perezoso: la capa ESTÁTICA de cada escena (cielo,
//    siluetas, viñeta, franjas de ola/niebla, sprites de anillo)
//    se hornea UNA vez por (escena, w×h) a canvas offscreen —
//    no es hot path. Por frame solo: 1-2 drawImage de fondo +
//    las capas animadas (≤ ~90 fillRect en el peor caso).
//  · Sin DOM (harness bun/node): los horneados caen a null y el
//    draw pinta la estática en directo — mismo píxel, sin crash.
//
// CONTRATO EXPORTADO:
//   STORY_SCENES_ART : ids soportados (readonly string[])
//   drawStoryBackdrop(ctx, sceneId, t, w, h) : fondo completo
//   storyArtReady() : true cuando las 6 escenas tienen sus
//     prerenders listos (o el modo directo sin DOM está activo)
//   prebakeStoryArt(w, h) : calienta TODAS las hornadas (opcional,
//     el orquestador puede llamarlo al cargar la pantalla de escena)
// ============================================================

import { hash2, px } from '../world/palette';

// ---------------- Utilidades deterministas ----------------

/** hash2 re-escalado a [0,1) (el nativo solo cubre [0,0.5) — ver sky.ts). */
function h01(a: number, b: number): number {
  return hash2(a, b) * 2;
}

function cl(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Módulo positivo (derivas que envuelven por los bordes). */
function md(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** easeOutCubic (entradas suaves). */
function eo(x: number): number {
  const u = 1 - cl(x);
  return 1 - u * u * u;
}

/** easeInOutCubic (la grieta: abre y cierra sin tirones). */
function em(x: number): number {
  const v = cl(x);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
}

const R = Math.round; // toda posición dinámica pasa por R()

// ---------------- Prerender: canvas offscreen seguro ----------------

let noDoc = false; // sin DOM (harness): pintamos la estática en directo

interface Cv {
  c: HTMLCanvasElement | null;
  x: CanvasRenderingContext2D | null;
}

/** Crea un canvas offscreen (null si no hay DOM — ruta directa). */
function mk(w: number, h: number): Cv {
  if (noDoc) return { c: null, x: null };
  try {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    const x = c.getContext('2d');
    if (!x) { noDoc = true; return { c: null, x: null }; }
    x.imageSmoothingEnabled = false;
    return { c, x };
  } catch {
    noDoc = true;
    return { c: null, x: null };
  }
}

/** Vuelca una capa horneada (o nada si no hubo DOM). */
function blit(ctx: CanvasRenderingContext2D, cv: Cv, dx: number, dy: number): void {
  if (cv.c !== null) ctx.drawImage(cv.c, dx, dy);
}

/** Elipse pixelada por filas de 2 px (patrón stepEllipse de sky.ts). */
function stepEllipse(
  x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number,
): void {
  if (rx <= 0 || ry <= 0) return;
  for (let dy = -ry; dy < ry; dy += 2) {
    const k = 1 - ((dy + 1) * (dy + 1)) / (ry * ry);
    if (k <= 0) continue;
    const half = Math.floor((rx * Math.sqrt(k)) / 2) * 2;
    if (half <= 0) continue;
    x.fillRect(cx - half, cy + dy, half * 2, 2);
  }
}

/** Anillo pixelado (contorno ~3 px de un círculo, filas de 2 px). */
function stepRing(
  x: CanvasRenderingContext2D, cx: number, cy: number, r: number, th: number,
): void {
  if (r <= 3) return;
  const ri = Math.max(1, r - th);
  for (let dy = -r; dy < r; dy += 2) {
    const yy = dy + 1;
    const k = r * r - yy * yy;
    if (k <= 0) continue;
    const ho = Math.floor(Math.sqrt(k) / 2) * 2;
    if (ho <= 0) continue;
    const ki = ri * ri - yy * yy;
    const hi = ki > 0 ? Math.floor(Math.sqrt(ki) / 2) * 2 : -ho;
    if (hi >= ho) continue;
    x.fillRect(cx - ho, cy + dy, ho - hi, 2);   // segmento izquierdo
    x.fillRect(cx + hi, cy + dy, ho - hi, 2);   // segmento derecho
  }
}

/** Viñeta escalonada horneada (marco oscuro sutil para el texto de la escena). */
function bakeVignette(x: CanvasRenderingContext2D, w: number, h: number): void {
  const steps = 4;
  const bh = Math.max(10, Math.round(h * 0.09));
  for (let i = steps; i >= 1; i--) {
    const T = Math.round((bh * i) / steps);
    x.globalAlpha = 0.06 * (steps - i + 1);
    x.fillStyle = '#04040a';
    x.fillRect(0, 0, w, T);
    x.fillRect(0, h - T, w, T);
    x.fillRect(0, T, T, h - 2 * T);
    x.fillRect(w - T, T, T, h - 2 * T);
  }
  x.globalAlpha = 1;
}

// ---------------- Registro de hornadas y readines ----------------

/** Ids soportados (contrato para el orquestador y QA). */
export const STORY_SCENES_ART: readonly string[] = [
  'acto1_fin', 'acto2_fin', 'acto3_fin', 'acto4_inicio',
  'heraldo_vencido', 'eco_despierto',
];

const NSC = STORY_SCENES_ART.length;

/** Índice por id (lookup O(1), sin allocations). */
const ID_IX: Record<string, number> = {
  'acto1_fin': 0, 'acto2_fin': 1, 'acto3_fin': 2,
  'acto4_inicio': 3, 'heraldo_vencido': 4, 'eco_despierto': 5,
};

/** Estado de hornada por escena (talla horneada + bandera). */
const BAKE_W = [0, 0, 0, 0, 0, 0];
const BAKE_H = [0, 0, 0, 0, 0, 0];
const BAKED = [false, false, false, false, false, false];

/** ¿Todo horneado para la talla pedida? (el orquestador puede esperarla). */
export function storyArtReady(): boolean {
  for (let i = 0; i < NSC; i++) if (!BAKED[i]) return false;
  return true;
}

/** Calienta las 6 hornadas para una talla concreta (opcional, no hot path). */
export function prebakeStoryArt(w: number, h: number): void {
  for (let i = 0; i < NSC; i++) ensureBake(i, w, h);
}

/**
 * Garantiza la hornada de la escena i a la talla (w,h).
 * Devuelve true si ya estaba lista (para saltar trabajo).
 */
function ensureBake(i: number, w: number, h: number): boolean {
  if (BAKED[i] && BAKE_W[i] === w && BAKE_H[i] === h) return true;
  BAKE_W[i] = w;
  BAKE_H[i] = h;
  BAKED[i] = true; // marcada YA: sin DOM la ruta directa pinta lo mismo
  switch (i) {
    case 0: bakeActo1(w, h); break;
    case 1: bakeActo2(w, h); break;
    case 2: bakeActo3(w, h); break;
    case 3: bakeActo4(w, h); break;
    case 4: bakeHeraldo(w, h); break;
    default: bakeEco(w, h); break;
  }
  return false;
}

// ============================================================
// ESCENA 0 · 'acto1_fin' — LA COLINA DEL ADIÓS
// ============================================================
// Cielo de crepúsculo INVERTIDO: la banda cálida (ceniza y ámbar)
// queda ARRIBA y se enfría hacia el horizonte, como un ocaso que
// ocurrió en el cielo equivocado. Con t los colores se APAGAN
// (velo oscuro de rampa). Colina en silueta con un campanario
// lejano; HOJAS que caen hacia ARRIBA (el mundo devuelve al cielo
// lo que perdió); grano de película sutil (canvas horneado).

// Bandas del cielo, de ARRIBA (cálida) hacia el horizonte (fría).
const A1_SKY = ['#d8a074', '#c87a6c', '#8a5462', '#543a52', '#382850', '#241e42', '#191634'];
const A1_HILL_FAR = '#1c1834';
const A1_HILL = '#12101f';
const A1_TOWER = '#0d0b18';
const A1_TOWER_LIT = '#2c2344';   // canto del campanario tocado por la ceniza
const A1_LEAF = ['#a8703c', '#8a5a30', '#77653a'];
const A1_VEIL = '#0b0916';        // velo del apagado progresivo

const A1_S: Cv = { c: null, x: null };        // estática (cielo+colina+campanario)
const A1_GRAIN: Cv = { c: null, x: null };    // grano horneado

// Hojas (30) — tablas planas preasignadas: cero allocs por frame.
const A1_N = 30;
const A1_LX = new Float64Array(A1_N);   // x base (fracción de w)
const A1_LY = new Float64Array(A1_N);   // y base (fracción del alto útil)
const A1_LS = new Float64Array(A1_N);   // velocidad de subida px/s
const A1_LW = new Float64Array(A1_N);   // amplitud del vaivén px
const A1_LF = new Float64Array(A1_N);   // frecuencia del vaivén
const A1_LP = new Float64Array(A1_N);   // fase
const A1_LC = new Int32Array(A1_N);     // índice de color
const A1_LZ = new Int32Array(A1_N);     // tamaño (2 o 3)

function bakeActo1(w: number, h: number): void {
  // —— estática: cielo invertido + colinas + campanario + viñeta ——
  A1_S.c = null;
  const s = mk(w, h);
  if (s.x) {
    const x = s.x;
    const nb = A1_SKY.length;
    const skyH = Math.round(h * 0.72);
    const bh = Math.ceil(skyH / nb);
    for (let i = 0; i < nb; i++) px(x, 0, i * bh, w, bh, A1_SKY[i]);
    px(x, 0, nb * bh, w, h - nb * bh, A1_SKY[nb - 1]);
    // resplandor de ceniza arriba (halo de 2 pasos, sin gradiente)
    x.globalAlpha = 0.14;
    x.fillStyle = '#f0c890';
    x.fillRect(0, 0, w, Math.round(h * 0.10));
    x.globalAlpha = 0.07;
    x.fillRect(0, Math.round(h * 0.10), w, Math.round(h * 0.07));
    x.globalAlpha = 1;
    // colina lejana (más clara, detrás)
    const hyFar = Math.round(h * 0.60);
    x.fillStyle = A1_HILL_FAR;
    for (let sx = 0; sx < w; sx += 4) {
      const yy = hyFar + Math.round(Math.sin(sx * 0.006 + 2.1) * 9 + Math.sin(sx * 0.017) * 4);
      x.fillRect(sx, yy, 4, h - yy);
    }
    // colina principal
    const hy = Math.round(h * 0.68);
    x.fillStyle = A1_HILL;
    for (let sx = 0; sx < w; sx += 4) {
      const yy = hy + Math.round(Math.sin(sx * 0.008 + 1.3) * 10 + Math.sin(sx * 0.021 + 0.5) * 5);
      x.fillRect(sx, yy, 4, h - yy);
    }
    // campanario lejano sobre la colina (derecha del tercio central)
    const tx = Math.round(w * 0.66);
    const ty = hillY1(hy, tx) - 46;
    x.fillStyle = A1_TOWER;
    x.fillRect(tx - 5, ty, 10, 46);              // fuste
    x.fillRect(tx - 8, ty - 12, 16, 13);         // espadaña
    px(x, tx - 2, ty - 8, 4, 7, '#070610');      // arco del campanil
    px(x, tx - 1, ty - 6, 2, 4, A1_TOWER_LIT);   // la campana, iluminada por la ceniza
    x.fillRect(tx - 8, ty - 15, 16, 3);          // cornisa
    px(x, tx - 6, ty - 21, 12, 6, A1_TOWER);     // tejado
    px(x, tx - 4, ty - 24, 8, 3, A1_TOWER);
    px(x, tx, ty - 29, 1, 5, A1_TOWER_LIT);      // remate
    px(x, tx - 8, ty - 15, 16, 1, A1_TOWER_LIT); // canto de la cornisa
    px(x, tx - 6, ty - 21, 12, 1, A1_TOWER_LIT); // canto del tejado
    bakeVignette(x, w, h);
    A1_S.c = s.c;
  }
  // —— grano horneado (celdas 3×3, densidad y signo por hash) ——
  A1_GRAIN.c = null;
  const g = mk(w, h);
  if (g.x) {
    const x = g.x;
    for (let gy = 0; gy < h; gy += 3) {
      for (let gx = 0; gx < w; gx += 3) {
        const v = h01(gx, gy);
        if (v < 0.06) px(x, gx, gy, 2, 2, 'rgba(10,8,18,0.16)');
        else if (v > 0.94) px(x, gx, gy, 2, 2, 'rgba(255,236,214,0.11)');
      }
    }
    A1_GRAIN.c = g.c;
  }
  // —— tabla de hojas (determinista, 1 vez) ——
  for (let i = 0; i < A1_N; i++) {
    A1_LX[i] = h01(i, 301);
    A1_LY[i] = h01(i, 302);
    A1_LS[i] = 10 + h01(i, 303) * 22;           // 10..32 px/s hacia arriba
    A1_LW[i] = 4 + h01(i, 304) * 10;
    A1_LF[i] = 0.5 + h01(i, 305) * 0.9;
    A1_LP[i] = h01(i, 306) * 6.283;
    A1_LC[i] = h01(i, 307) < 0.34 ? 0 : h01(i, 317) < 0.5 ? 1 : 2;
    A1_LZ[i] = h01(i, 308) < 0.3 ? 3 : 2;
  }
}

/** Altura de la colina principal en x (misma fórmula que la horneada). */
function hillY1(hy: number, sx: number): number {
  return hy + Math.round(Math.sin(sx * 0.008 + 1.3) * 10 + Math.sin(sx * 0.021 + 0.5) * 5);
}

function drawActo1(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  blit(ctx, A1_S, 0, 0);
  // —— apagado progresivo de los colores (velo de rampa) ——
  ctx.globalAlpha = 0.30 * cl(t / 14);
  ctx.fillStyle = A1_VEIL;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  // —— hojas que suben (deterministas, envuelven por abajo) ——
  const span = h + 40;
  for (let i = 0; i < A1_N; i++) {
    const y = R(span - md(A1_LY[i] * span + t * A1_LS[i], span)) - 20;
    const fx = A1_LX[i] * w + Math.sin(t * A1_LF[i] + A1_LP[i]) * A1_LW[i];
    const x = R(md(fx, w + 20)) - 10;
    const env = Math.sin(cl(y / h) * Math.PI); // nace abajo, se apaga arriba
    if (env < 0.05) continue;
    ctx.globalAlpha = 0.30 + 0.45 * env;
    ctx.fillStyle = A1_LEAF[A1_LC[i]];
    const z = A1_LZ[i];
    // hoja 2×2/3×2 que "gira": alterna alto por fase (oscilación de enteros)
    ctx.fillRect(x, y, z, (A1_LP[i] + t) % 1.2566 < 0.6283 ? z - 1 : 1);
  }
  ctx.globalAlpha = 1;
  // —— grano sutil que respira ——
  if (A1_GRAIN.c !== null) {
    ctx.globalAlpha = 0.55 + 0.18 * Math.sin(t * 7.3);
    ctx.drawImage(A1_GRAIN.c, 0, 0);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// ESCENA 1 · 'acto2_fin' — LA CALLE AHOGADA
// ============================================================
// Penumbra azul-verdosa: la aldea duerme bajo el agua hasta las
// ventanas. Dos CAPAS de olas en silueta cruzan con parallax
// (franjas horneadas que envuelven, crestas de seno con periodos
// enteros → sin costura). Al fondo, el FARO: su vela se enciende
// a t≈6 s (cambio de estado determinista, rampa de 0.9 s) y su
// luz cae en REFLEJO vertical sobre el agua (guiones temblorosos).

const A2_SKY = ['#0a1420', '#0d1c26', '#11303a', '#163e44', '#1c4a4c'];
const A2_WATER = '#0d1e26';
const A2_RIPPLE = '#16343c';
const A2_HOUSE = '#0f222b';
const A2_TOWER = '#0b1a22';
const A2_WAVE_FAR = '#142c35';
const A2_WAVE_FAR_HI = '#20444d';
const A2_WAVE_NEAR = '#091820';
const A2_WAVE_NEAR_HI = '#122830';
const A2_FLAME1 = '#ffd97a';
const A2_FLAME2 = '#fff3c0';
const A2_FLAME3 = '#ff9040';
const A2_REFL = '#ffc86a';
const A2_LAMP_OFF = '#15262c';

const A2_S: Cv = { c: null, x: null };   // estática (cielo+aldea+faro+agua)
let A2_WF: Cv = { c: null, x: null };    // franja de olas lejana (rehorneada)
let A2_WN: Cv = { c: null, x: null };    // franja de olas cercana (rehorneada)
const A2_HALO: Cv = { c: null, x: null };// halo del faro encendido

// Geometría del faro (resuelta al hornear, reusada por frame).
let A2_LX = 0;      // x de la lámpara
let A2_LY = 0;      // y de la lámpara
let A2_WY = 0;      // y de la línea de agua
let A2_WAVE_W = 0;  // ancho de franja de ola

// Reflejo: 10 guiones (dy, medio ancho, alpha base) — tabla fija.
const A2_RN = 10;
const A2_RDY = new Float64Array(A2_RN);
const A2_RW = new Float64Array(A2_RN);
const A2_RA = new Float64Array(A2_RN);

function bakeActo2(w: number, h: number): void {
  A2_WAVE_W = w;
  // —— estática ——
  A2_S.c = null;
  const s = mk(w, h);
  if (s.x) {
    const x = s.x;
    const nb = A2_SKY.length;
    const skyH = Math.round(h * 0.55);
    const bh = Math.ceil(skyH / nb);
    for (let i = 0; i < nb; i++) px(x, 0, i * bh, w, bh, A2_SKY[i]);
    px(x, 0, nb * bh, w, h - nb * bh, A2_SKY[nb - 1]);
    const wy = Math.round(h * 0.55);
    // agua base + líneas de ripio estáticas (hash)
    px(x, 0, wy, w, h - wy, A2_WATER);
    x.fillStyle = A2_RIPPLE;
    for (let i = 0; i < 90; i++) {
      const rx = Math.floor(h01(i, 401) * w);
      const ry = wy + 6 + Math.floor(h01(i, 402) * (h - wy - 10));
      x.fillRect(rx, ry, 6 + Math.floor(h01(i, 403) * 8), 1);
    }
    // casas ahogadas a ambos lados (siluetas escalonadas, ventanas muertas)
    x.fillStyle = A2_HOUSE;
    const roofY = wy - Math.round(h * 0.10);
    for (let side = 0; side < 2; side++) {
      const dir = side === 0 ? 1 : -1;
      const bx = side === 0 ? Math.round(w * 0.04) : Math.round(w * 0.96);
      for (let k = 0; k < 3; k++) {
        const hw = Math.round(w * (0.10 - k * 0.02));
        const cx = bx + dir * k * Math.round(w * 0.13);
        const hh2 = Math.round(h * (0.13 - k * 0.025));
        const top = roofY + k * 6 - hh2;
        // tejado a dos aguas (filas escalonadas)
        for (let r2 = 0; r2 < 6; r2++) {
          const half2 = Math.round((hw * (r2 + 1)) / 6);
          x.fillRect(cx - half2, top + r2 * 2, half2 * 2, 2);
        }
        x.fillRect(cx - hw, top + 12, hw * 2, wy - top - 12 + 4);
        // una ventana muerta por casa (casi negra)
        px(x, cx - 2, top + 18, 4, 5, '#081218');
      }
    }
    // faro: isleta + torre + linterna (lejos, derecha)
    A2_LX = Math.round(w * 0.78);
    const baseY = wy + 2;
    const th = Math.round(h * 0.22);
    const tx0 = A2_LX;
    x.fillStyle = A2_TOWER;
    x.fillRect(tx0 - 14, baseY - 4, 28, 6);                  // isleta
    for (let r2 = 0; r2 < th; r2 += 2) {                     // torre afilada
      const half2 = 5 - Math.round((r2 / th) * 3);
      x.fillRect(tx0 - half2, baseY - 4 - r2 - 2, half2 * 2, 2);
    }
    x.fillRect(tx0 - 7, baseY - 4 - th - 4, 14, 4);          // galería
    x.fillRect(tx0 - 5, baseY - 4 - th - 12, 10, 8);         // linterna
    px(x, tx0 - 6, baseY - 4 - th - 14, 12, 2, A2_TOWER);    // caperuza
    A2_LY = baseY - 4 - th - 9;
    px(x, tx0 - 3, A2_LY, 6, 5, A2_LAMP_OFF);                // el ventanuco, apagado
    bakeVignette(x, w, h);
    A2_S.c = s.c;
  }
  A2_WY = Math.round(h * 0.55);
  A2_LX = Math.round(w * 0.78);
  // —— franjas de ola (crestas de seno con periodos enteros: envuelven limpio) ——
  A2_WF.c = null; A2_WN.c = null;
  A2_WF = bakeWaveStrip(w, 22, 4011, A2_WAVE_FAR, A2_WAVE_FAR_HI, 3, 5);
  A2_WN = bakeWaveStrip(w, 30, 4027, A2_WAVE_NEAR, A2_WAVE_NEAR_HI, 2, 7);
  // —— halo del faro (anillos escalonados de 2 pasos) ——
  A2_HALO.c = null;
  const hg = mk(64, 64);
  if (hg.x) {
    const x = hg.x;
    x.fillStyle = A2_FLAME3;
    x.globalAlpha = 0.10; stepRing(x, 32, 32, 30, 7);
    x.globalAlpha = 0.16; stepRing(x, 32, 32, 22, 6);
    x.globalAlpha = 0.24; stepRing(x, 32, 32, 14, 5);
    x.globalAlpha = 1;
    A2_HALO.c = hg.c;
  }
  // —— tabla del reflejo ——
  for (let i = 0; i < A2_RN; i++) {
    A2_RDY[i] = 8 + i * 7 + h01(i, 403) * 3;   // baja desde la línea de agua
    A2_RW[i] = 2 + Math.floor(h01(i, 404) * 3);
    A2_RA[i] = 0.5 - i * 0.042;
  }
}

/**
 * Franja de ola en silueta que ENVUELVE: la cresta es suma de senos
 * con número ENTERO de periodos a lo ancho (sin costura al repetir),
 * cuerpo opaco hasta el borde inferior y motas de espuma por hash.
 */
function bakeWaveStrip(w: number, hh: number, seed: number, body: string, crest: string, k1: number, k2: number): Cv {
  const s = mk(w, hh);
  if (!s.x) return s;
  const x = s.x;
  const TAU = Math.PI * 2;
  x.fillStyle = body;
  for (let sx = 0; sx < w; sx += 2) {
    const top = 5 + Math.sin((sx * TAU * k1) / w) * 4 + Math.sin((sx * TAU * k2) / w + 1.7) * 2.5;
    x.fillRect(sx, Math.round(top), 2, hh - Math.round(top));
  }
  x.fillStyle = crest;
  for (let sx = 0; sx < w; sx += 2) {
    const top = 5 + Math.sin((sx * TAU * k1) / w) * 4 + Math.sin((sx * TAU * k2) / w + 1.7) * 2.5;
    x.fillRect(sx, Math.round(top), 2, 2);
  }
  // espuma salpicada bajo las crestas (por hash de columna, dentro del patrón)
  x.fillStyle = crest;
  for (let i = 0; i < 40; i++) {
    const fx = Math.floor(h01(i, seed) * w);
    const top = 5 + Math.sin((fx * TAU * k1) / w) * 4 + Math.sin((fx * TAU * k2) / w + 1.7) * 2.5;
    x.fillRect(fx, Math.round(top) + 4 + Math.floor(h01(i, seed + 1) * 8), 2, 1);
  }
  return s;
}

function drawActo2(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  blit(ctx, A2_S, 0, 0);
  // —— olas: 2 capas con parallax (cada una pinta 2 copias que envuelven) ——
  const o1 = R(md(t * 9, A2_WAVE_W));
  ctx.globalAlpha = 0.9;
  blit(ctx, A2_WF, -o1, A2_WY - 12);
  blit(ctx, A2_WF, A2_WAVE_W - o1, A2_WY - 12);
  const o2 = R(md(t * 19, A2_WAVE_W));
  ctx.globalAlpha = 1;
  blit(ctx, A2_WN, -o2, A2_WY + Math.round(h * 0.10));
  blit(ctx, A2_WN, A2_WAVE_W - o2, A2_WY + Math.round(h * 0.10));
  // —— la vela del faro: estado determinista (enciende a t≈6 s) ——
  const lit = t >= 6 ? cl((t - 6) / 0.9) : 0;
  if (lit <= 0.004) {
    ctx.globalAlpha = 1;
    return;
  }
  const flick = 0.82 + 0.18 * Math.sin(t * 9.7 + 1.1);
  // halo
  if (A2_HALO.c !== null) {
    ctx.globalAlpha = lit * (0.55 + 0.12 * Math.sin(t * 2.1));
    ctx.drawImage(A2_HALO.c, A2_LX - 32, A2_LY - 32);
  }
  // veta de la linterna
  ctx.globalAlpha = 0.75 * lit;
  ctx.fillStyle = A2_FLAME3;
  ctx.fillRect(A2_LX - 5, A2_LY - 1, 10, 7);
  // llama: núcleo + punta, parpadeo de enteros
  ctx.globalAlpha = lit * flick;
  ctx.fillStyle = A2_FLAME1;
  ctx.fillRect(A2_LX - 2, A2_LY + 1 + (Math.sin(t * 11) > 0 ? 0 : 1), 4, 4);
  ctx.fillStyle = A2_FLAME2;
  ctx.fillRect(A2_LX - 1, A2_LY + 1, 2, 2);
  ctx.globalAlpha = 1;
  // —— reflejo vertical (guiones que respiran) ——
  for (let i = 0; i < A2_RN; i++) {
    const dy = A2_WY + A2_RDY[i];
    if (dy > h) break;
    const sway = Math.sin(t * 2.3 + A2_RDY[i] * 0.22) * 2.5;
    ctx.globalAlpha = cl(A2_RA[i]) * lit * (0.7 + 0.3 * Math.sin(t * 3.7 + i * 1.4));
    ctx.fillStyle = A2_REFL;
    ctx.fillRect(R(A2_LX + sway) - A2_RW[i], R(dy), A2_RW[i] * 2, 2);
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// ESCENA 2 · 'acto3_fin' — LA GRIETA (EL OJO DEL CIELO)
// ============================================================
// Noche de la paleta 'noche' de sky.ts. Una GRIETA pálida en forma
// de ojo se abre despacio (amp: 0→1 en 0..8 s, easeInOut) y vuelve
// a cerrarse (8→12.5 s); la franja vertical se HORNEA a ancho máximo
// y por frame se escala en X (imageSmoothing off → píxel limpio).
// Las estrellas (tabla horneada) se APAGAN según distancia a la
// grieta. Silueta de la cripta abajo.

const A3_SKY = ['#040612', '#070a1a', '#0a0e22', '#0d122a', '#111834', '#16203e'];
const A3_RIDGE = '#080b16';
const A3_CRYPT = '#04060c';
const A3_PORTAL = '#0d1322';
const A3_STAR_C = '#cfe0ff';
const A3_STAR_W = '#ffd9a0';
const A3_HORIZON = '#9cc8de';

const A3_S: Cv = { c: null, x: null };   // estática (cielo+cripta)
const A3_JAG: Cv = { c: null, x: null }; // franja de la grieta a ancho máximo

const A3_SN = 84;
const A3_STX = new Float64Array(A3_SN);  // x (fracción)
const A3_STY = new Float64Array(A3_SN);  // y (px, resuelto al hornear)
const A3_SP = new Float64Array(A3_SN);   // fase
const A3_SS = new Float64Array(A3_SN);   // velocidad de titileo
const A3_SA = new Float64Array(A3_SN);   // alpha base
const A3_SZ = new Int32Array(A3_SN);     // 1|2
const A3_SC = new Int32Array(A3_SN);     // 0 fría · 1 cálida

let A3_SKY_H = 0;   // alto de cielo (la grieta vive aquí)
let A3_CX = 0;      // x de la grieta
const A3_JW = 76;   // ancho horneado de la franja

function bakeActo3(w: number, h: number): void {
  A3_SKY_H = Math.round(h * 0.74);
  A3_CX = Math.round(w * 0.5);
  // —— estática: cielo + cripta ——
  A3_S.c = null;
  const s = mk(w, h);
  if (s.x) {
    const x = s.x;
    const nb = A3_SKY.length;
    const bh = Math.ceil(A3_SKY_H / nb);
    for (let i = 0; i < nb; i++) px(x, 0, i * bh, w, bh, A3_SKY[i]);
    px(x, 0, nb * bh, w, h - nb * bh, A3_SKY[nb - 1]);
    // loma previa + silueta de la cripta (nave + 2 torres con agujas)
    const gy = Math.round(h * 0.80);
    x.fillStyle = A3_RIDGE;
    for (let sx = 0; sx < w; sx += 4) {
      const yy = Math.round(h * 0.74) + Math.round(Math.sin(sx * 0.005 + 0.7) * 6);
      x.fillRect(sx, yy, 4, h - yy);
    }
    x.fillStyle = A3_CRYPT;
    const cw = Math.round(w * 0.18);
    const cx0 = A3_CX;
    const ct = gy - Math.round(h * 0.16);
    x.fillRect(cx0 - cw, ct, cw * 2, h - ct);                 // nave
    // almenas
    for (let m = -cw + 4; m < cw - 2; m += 10) x.fillRect(cx0 + m, ct - 4, 5, 5);
    for (let side = -1; side <= 1; side += 2) {
      const tw = Math.round(w * 0.028);
      const tx0 = cx0 + side * Math.round(cw * 1.05);
      const tt = gy - Math.round(h * 0.22);
      x.fillRect(tx0 - tw, tt, tw * 2, h - tt);               // torre
      for (let r2 = 0; r2 < 12; r2 += 2) {                    // aguja
        const half2 = tw - Math.round((r2 / 12) * tw);
        x.fillRect(tx0 - half2, tt - 12 + r2, half2 * 2, 2);
      }
      px(x, tx0 - 1, tt - 16, 2, 4, A3_CRYPT);                // remate
    }
    // portal en arco (un tono menos profundo: se adivina la entrada)
    const pw = Math.round(w * 0.024);
    const ph2 = Math.round(h * 0.075);
    x.fillStyle = A3_PORTAL;
    x.fillRect(cx0 - pw, gy - ph2, pw * 2, ph2);
    stepEllipse(x, cx0, gy - ph2, pw, pw);
    bakeVignette(x, w, h);
    A3_S.c = s.c;
  }
  // —— franja de la grieta (ojo: se afina en los extremos) ——
  A3_JAG.c = null;
  const j = mk(A3_JW, A3_SKY_H);
  if (j.x) {
    const x = j.x;
    const mid = A3_JW / 2;
    for (let yy = 0; yy < A3_SKY_H; yy += 3) {
      const u = yy / A3_SKY_H;
      const env = Math.pow(Math.sin(u * Math.PI), 0.7);       // ojo: párpados
      const half = (1 + h01(yy, 501) * 2.2) * env;
      if (half < 0.5) continue;
      const off = (h01(yy, 502) - 0.5) * 7 * env;
      x.globalAlpha = 0.13;                                    // halo exterior
      x.fillStyle = '#5a8a9a';
      x.fillRect(R(mid + off - half * 2 - 5), yy, R(half * 4 + 10), 3);
      x.globalAlpha = 0.30;                                    // penumbra media
      x.fillStyle = '#9cc8de';
      x.fillRect(R(mid + off - half - 2), yy, R(half * 2 + 4), 3);
      x.globalAlpha = 1;                                       // espina pálida
      x.fillStyle = '#e8f4f6';
      x.fillRect(R(mid + off - half), yy, Math.max(2, R(half * 2)), 3);
    }
    // ramillas laterales (3, por hash)
    for (let b = 0; b < 3; b++) {
      const by = Math.round((0.2 + h01(b, 503) * 0.6) * A3_SKY_H);
      const bl = 5 + Math.floor(h01(b, 504) * 8);
      const dir = h01(b, 505) < 0.5 ? -1 : 1;
      x.globalAlpha = 0.5;
      x.fillStyle = '#cfe4ea';
      x.fillRect(R(mid), by, dir * bl, 2);
      x.globalAlpha = 1;
    }
    A3_JAG.c = j.c;
  }
  // —— tabla de estrellas ——
  for (let i = 0; i < A3_SN; i++) {
    A3_STX[i] = h01(i, 507);
    A3_STY[i] = h01(i, 508) * (A3_SKY_H * 0.92);
    A3_SP[i] = h01(i, 509) * 6.283;
    A3_SS[i] = 0.6 + h01(i, 510) * 1.8;
    A3_SA[i] = 0.35 + h01(i, 511) * 0.55;
    A3_SZ[i] = h01(i, 512) < 0.22 ? 2 : 1;
    A3_SC[i] = h01(i, 513) < 0.18 ? 1 : 0;
  }
}

function drawActo3(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  blit(ctx, A3_S, 0, 0);
  // —— envolvente del ojo: abre 0..8 s, cierra 8..12.5 s, queda cerrado ——
  const amp = t <= 8 ? em(t / 8) : Math.max(0, 1 - em((t - 8) / 4.5));
  // —— estrellas (se apagan cerca de la grieta) ——
  const fadeR = 26 + amp * 34;
  for (let i = 0; i < A3_SN; i++) {
    const sxp = A3_STX[i] * w;
    const d = Math.abs(sxp - A3_CX);
    const sf = cl(d / fadeR);
    const a = (0.55 + 0.45 * Math.sin(t * A3_SS[i] + A3_SP[i])) * A3_SA[i] * (0.15 + 0.85 * sf);
    if (a < 0.04) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = A3_SC[i] === 1 ? A3_STAR_W : A3_STAR_C;
    ctx.fillRect(R(sxp), R(A3_STY[i]), A3_SZ[i], A3_SZ[i]);
  }
  ctx.globalAlpha = 1;
  // —— la grieta: franja horneada escalada en X (párpados incluidos) ——
  if (amp > 0.005 && A3_JAG.c !== null) {
    const dw = Math.max(2, R(A3_JW * amp));
    ctx.globalAlpha = Math.min(1, amp * 4);
    ctx.drawImage(A3_JAG.c, A3_CX - (dw >> 1), 0, dw, A3_SKY_H);
    // vaga claridad sobre el horizonte, bajo la grieta
    ctx.globalAlpha = amp * 0.10;
    ctx.fillStyle = A3_HORIZON;
    ctx.fillRect(A3_CX - Math.round(w * 0.14), A3_SKY_H - 3, Math.round(w * 0.28), 3);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// ESCENA 3 · 'acto4_inicio' — EL UMBRAL DE NIEBLA
// ============================================================
// Un camino apagado entra en la niebla. Tres BANDAS de niebla con
// crestas curvas (senos de periodos enteros, como las olas) derivan
// a velocidades distintas. A los lados, FIGURAS SIN ROSTRO: siluetas
// encapuchadas con capa, vaivén de ±1 px. El fondo se DESATURA hacia
// gris con una rampa PRECALCULADA (tabla de 64 pasos + velos de
// color constante).

const A4_SKY = ['#20242c', '#262a34', '#2c303a'];
const A4_HILL = '#1a1e26';
const A4_GROUND = '#232830';
const A4_PATH = '#3a3f4a';
const A4_SHRUB = '#141820';
const A4_FIG = '#101318';
const A4_FIG_RIM = '#242a36';
const A4_FOG_A = '#aeb8c4';
const A4_FOG_B = '#8a94a2';
const A4_WASH = '#7e8a96';   // velo 1: lavado azul-gris
const A4_GRAY = '#8a8a90';   // velo 2: gris puro
const A4_DARK = '#101216';   // velo 3: caída de luz

const A4_S: Cv = { c: null, x: null };        // estática (camino+colinas)
let A4_FOG0: Cv = { c: null, x: null };       // niebla lejana (rehorneada)
let A4_FOG1: Cv = { c: null, x: null };       // niebla media (rehorneada)
let A4_FOG2: Cv = { c: null, x: null };       // niebla cercana (rehorneada)
const A4_FIGS: Cv[] = [];                     // 3 tallas de figura horneadas

const A4_FN = 6;
const A4_FX = new Float64Array(A4_FN);   // x (fracción)
const A4_FY = new Float64Array(A4_FN);   // y de los pies (fracción del suelo)
const A4_FP = new Float64Array(A4_FN);   // fase del vaivén
const A4_FI = new Int32Array(A4_FN);     // índice del sprite (0 lejana · 2 cercana)
const A4_FZ = new Int32Array(A4_FN);     // capa de dibujo (0 tras niebla lejana, 1 delante)

/** Rampa de desaturación PRECALCULADA: alpha del velo gris para t. */
const A4_RAMP = new Float64Array(64);
for (let i = 0; i < 64; i++) {
  const p = cl((i / 63) * 12 - 2) / 10;  // alcanza el gris pleno ~t 12 s
  A4_RAMP[i] = p * p * (3 - 2 * p);      // smoothstep horneado
}

function bakeActo4(w: number, h: number): void {
  // —— estática: cielo, colinas, suelo y camino en perspectiva ——
  A4_S.c = null;
  const s = mk(w, h);
  if (s.x) {
    const x = s.x;
    const nb = A4_SKY.length;
    const bh = Math.ceil((h * 0.5) / nb);
    for (let i = 0; i < nb; i++) px(x, 0, i * bh, w, bh, A4_SKY[i]);
    px(x, 0, nb * bh, w, h - nb * bh, A4_SKY[nb - 1]);
    // colinas apagadas
    x.fillStyle = A4_HILL;
    const hy = Math.round(h * 0.40);
    for (let sx = 0; sx < w; sx += 4) {
      const yy = hy + Math.round(Math.sin(sx * 0.007 + 0.9) * 8 + Math.sin(sx * 0.019) * 3);
      x.fillRect(sx, yy, 4, h - yy);
    }
    // suelo
    px(x, 0, Math.round(h * 0.52), w, h - Math.round(h * 0.52), A4_GROUND);
    // camino que se estrecha hacia el centro (trapecio escalonado)
    x.fillStyle = A4_PATH;
    const cxm = Math.round(w * 0.5);
    const y0 = Math.round(h * 0.55);
    for (let i = 0; i < 22; i++) {
      const yy = y0 + Math.round(((h - y0) * i * i) / (22 * 22));
      const half = Math.round(6 + (w * 0.16) * (i / 22) * (i / 22));
      x.fillRect(cxm - half, yy, half * 2, Math.max(2, Math.round((h - y0) / 22)));
    }
    // arbustos/árboles muertos en silueta (hash)
    x.fillStyle = A4_SHRUB;
    for (let i = 0; i < 14; i++) {
      const bx = Math.floor(h01(i, 601) * w);
      const by = Math.round(h * (0.56 + h01(i, 602) * 0.3));
      const bw = 6 + Math.floor(h01(i, 603) * 10);
      const bh2 = 5 + Math.floor(h01(i, 604) * 12);
      x.fillRect(bx, by - bh2, bw, bh2);
      x.fillRect(bx + 2, by - bh2 - 4, 2, 4);
    }
    bakeVignette(x, w, h);
    A4_S.c = s.c;
  }
  // —— bandas de niebla (crestas curvas, envuelven como las olas) ——
  A4_FOG0.c = null; A4_FOG1.c = null; A4_FOG2.c = null;
  A4_FOG0 = bakeFogStrip(w, Math.round(h * 0.16), 0.50, A4_FOG_A, A4_FOG_B, 2, 5);
  A4_FOG1 = bakeFogStrip(w, Math.round(h * 0.20), 0.62, A4_FOG_A, A4_FOG_B, 3, 8);
  A4_FOG2 = bakeFogStrip(w, Math.round(h * 0.26), 0.80, A4_FOG_A, A4_FOG_B, 2, 9);
  // —— figuras sin rostro (3 tallas horneadas una vez; no dependen de w/h) ——
  if (A4_FIGS.length === 0) {
    A4_FIGS.push(bakeFigure(26));
    A4_FIGS.push(bakeFigure(34));
    A4_FIGS.push(bakeFigure(42));
  }
  // tabla de posiciones (determinista; lejanas más pequeñas = A4_FI bajo)
  const gx = [0.10, 0.16, 0.06, 0.86, 0.92, 0.81];
  const gz = [0, 1, 1, 0, 1, 1];
  for (let i = 0; i < A4_FN; i++) {
    A4_FX[i] = gx[i];
    A4_FY[i] = 0.62 + h01(i, 611) * 0.22;
    A4_FP[i] = h01(i, 613) * 6.283;
    A4_FI[i] = i % 3;
    A4_FZ[i] = gz[i];
  }
}

/**
 * Franja de niebla que envuelven: cresta curva (senos de periodos
 * enteros) rellena hasta abajo con 2 tonos (panza más densa).
 */
function bakeFogStrip(w: number, hh: number, dens: number, top: string, deep: string, k1: number, k2: number): Cv {
  const s = mk(w, hh);
  if (!s.x) return s;
  const x = s.x;
  const TAU = Math.PI * 2;
  const mid = Math.round(hh * 0.35);
  for (let sx = 0; sx < w; sx += 2) {
    const crest = mid + Math.sin((sx * TAU * k1) / w) * hh * 0.18
                     + Math.sin((sx * TAU * k2) / w + 2.3) * hh * 0.10;
    const ct = Math.round(crest);
    x.globalAlpha = dens * 0.55;
    x.fillStyle = top;
    x.fillRect(sx, ct, 2, hh - ct);
    x.globalAlpha = dens;
    x.fillStyle = deep;
    x.fillRect(sx, ct + Math.round((hh - ct) * 0.45), 2, hh - ct - Math.round((hh - ct) * 0.45));
  }
  x.globalAlpha = 1;
  return s;
}

/** Figura sin rostro: capucha + capa que se abre (silueta simple). */
function bakeFigure(hh: number): Cv {
  const wMax = Math.max(8, Math.round(hh * 0.42));
  const s = mk(wMax + 4, hh);
  if (!s.x) return s;
  const x = s.x;
  const cx = (wMax + 4) >> 1;
  const headR = Math.max(3, Math.round(hh * 0.12));
  x.fillStyle = A4_FIG;
  // capucha (elipse) — sin cara: sombra interior ya es el color
  stepEllipse(x, cx, headR + 1, headR, headR + 1);
  // capa: filas de 2 px que se abren y rematan en faldón
  const by = headR * 2;
  for (let yy = by; yy < hh; yy += 2) {
    const u = (yy - by) / (hh - by);
    const half = 1.5 + Math.pow(u, 1.15) * (wMax / 2) + (u > 0.75 ? (u - 0.75) * 4 : 0);
    x.fillRect(R(cx - half), yy, R(half * 2), 2);
  }
  // vago canto iluminado en el borde izquierdo (la luz que se apaga)
  x.fillStyle = A4_FIG_RIM;
  for (let yy = by; yy < hh - 2; yy += 2) {
    const u = (yy - by) / (hh - by);
    const half = 1.5 + Math.pow(u, 1.15) * (wMax / 2) + (u > 0.75 ? (u - 0.75) * 4 : 0);
    x.fillRect(R(cx - half), yy, 1, 2);
  }
  return s;
}

function drawActo4(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  blit(ctx, A4_S, 0, 0);
  // —— figuras de fondo (tras la niebla lejana) ——
  for (let i = 0; i < A4_FN; i++) {
    if (A4_FZ[i] !== 0) continue;
    drawFigure(ctx, i, t, w, h);
  }
  // —— niebla: 3 bandas a velocidades de parallax distintas ——
  const wy0 = Math.round(h * 0.46);
  const o0 = R(md(t * 5, w));
  ctx.globalAlpha = 0.8;
  blit(ctx, A4_FOG0, -o0, wy0);
  blit(ctx, A4_FOG0, w - o0, wy0);
  // figuras medias entre niebla lejana y media
  ctx.globalAlpha = 1;
  for (let i = 0; i < A4_FN; i++) {
    if (A4_FZ[i] !== 1) continue;
    drawFigure(ctx, i, t, w, h);
  }
  const o1 = R(md(t * 11, w));
  ctx.globalAlpha = 0.65;
  blit(ctx, A4_FOG1, -o1, Math.round(h * 0.58));
  blit(ctx, A4_FOG1, w - o1, Math.round(h * 0.58));
  const o2 = R(md(t * 17, w));
  blit(ctx, A4_FOG2, -o2, Math.round(h * 0.72));
  blit(ctx, A4_FOG2, w - o2, Math.round(h * 0.72));
  ctx.globalAlpha = 1;
  // —— desaturación progresiva hacia gris (rampa precalculada) ——
  const gi = Math.min(63, (t * 4) | 0);
  const p = A4_RAMP[gi];
  ctx.globalAlpha = p * 0.30;
  ctx.fillStyle = A4_WASH;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = p * 0.22;
  ctx.fillStyle = A4_GRAY;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = p * 0.10;
  ctx.fillStyle = A4_DARK;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

/** Una figura: sprite horneado + vaivén de ±1 px (sin rostro). */
function drawFigure(ctx: CanvasRenderingContext2D, i: number, t: number, w: number, h: number): void {
  const spr = A4_FIGS[A4_FI[i]];
  if (spr.c === null) return;
  const fx = A4_FX[i] * w + Math.round(Math.sin(t * 0.7 + A4_FP[i]));
  const fy = A4_FY[i] * h;
  ctx.globalAlpha = 0.92;
  ctx.drawImage(spr.c, R(fx - spr.c.width / 2), R(fy - spr.c.height));
  ctx.globalAlpha = 1;
}

// ============================================================
// ESCENA 4 · 'heraldo_vencido' — LA CAPA VACÍA
// ============================================================
// Sala criptal (paleta cripta de palette.ts): columnas, arco,
// losas. La CAPA VACÍA del Heraldo flota sobre el altar: ~26 tiras
// verticales cuyo bajo ondea con DOS sinusoides deterministas
// (frecuencias/fases fijas). Un broche dorado flota en el cuello:
// nadie lo sostiene. Una NOTA luminosa asciende desde la capa y a
// t≈7 s ESTALLA en 24 motas (ángulos/velocidades por hash) + anillo
// de destello.

const A5_WALL = ['#262634', '#2b2b3a'];
const A5_FLOOR = '#3e3e4c';
const A5_JOINT = '#343442';
const A5_COL = '#333344';
const A5_COL_HI = '#3f3f54';
const A5_ARCH = '#1c1c28';
const A5_CLOAK = '#191926';
const A5_CLOAK_D = '#14141e';
const A5_CLOAK_RIM = '#3c3c58';
const A5_GOLD = '#ffd97a';
const A5_GOLD_HI = '#fff3c0';
const A5_EMBER = '#6a3c22';

const A5_S: Cv = { c: null, x: null };     // estática (sala)
const A5_NOTE: Cv = { c: null, x: null };  // sprite de la nota (oro)
const A5_RING: Cv = { c: null, x: null };  // anillo del estallido
const A5_GLOW: Cv = { c: null, x: null };  // resplandor del altar

// Capa: tiras preasignadas (x relativo, ancho, y de hombro, u).
const A5_CN = 26;
const A5_CX = new Float64Array(A5_CN);
const A5_CW = new Float64Array(A5_CN);
const A5_CT = new Float64Array(A5_CN);
const A5_CU = new Float64Array(A5_CN);

// Motas del estallido (24): ángulo, velocidad, tamaño, color.
const A5_MN = 24;
const A5_MAX = new Float64Array(A5_MN);
const A5_MAY = new Float64Array(A5_MN);
const A5_MSP = new Float64Array(A5_MN);
const A5_MSZ = new Int32Array(A5_MN);
const A5_MCI = new Int32Array(A5_MN);

// Polvo ambiental (12).
const A5_DN = 12;
const A5_DX = new Float64Array(A5_DN);
const A5_DY = new Float64Array(A5_DN);
const A5_DS = new Float64Array(A5_DN);
const A5_DP = new Float64Array(A5_DN);

let A5_HX = 0;       // x del centro de la capa
let A5_SHY = 0;      // y de hombros
let A5_HEMY = 0;     // y base del bajo
let A5_CLW = 0;      // ancho total de la capa

function bakeHeraldo(w: number, h: number): void {
  // —— estática: sala criptal ——
  A5_S.c = null;
  const s = mk(w, h);
  if (s.x) {
    const x = s.x;
    const wallH = Math.round(h * 0.62);
    px(x, 0, 0, w, wallH, A5_WALL[0]);
    px(x, 0, Math.round(h * 0.30), w, wallH - Math.round(h * 0.30), A5_WALL[1]);
    px(x, 0, wallH, w, h - wallH, A5_FLOOR);
    // losas: líneas horizontales en perspectiva + juntas verticales por hash
    x.fillStyle = A5_JOINT;
    for (let i = 0; i < 7; i++) {
      const yy = wallH + Math.round(((h - wallH) * (i + 1) * (i + 1)) / 49);
      x.fillRect(0, yy, w, 1);
    }
    for (let i = 0; i < 40; i++) {
      const vx = Math.floor(h01(i, 701) * w);
      const vy = wallH + Math.floor(h01(i, 702) * (h - wallH));
      x.fillRect(vx, vy, 1, 3 + Math.floor(h01(i, 703) * 5));
    }
    // arco central trasero
    x.fillStyle = A5_ARCH;
    const aw = Math.round(w * 0.10);
    stepEllipse(x, Math.round(w * 0.5), wallH - Math.round(h * 0.10), aw, Math.round(h * 0.12));
    x.fillRect(Math.round(w * 0.5) - aw, wallH - Math.round(h * 0.10), aw * 2, Math.round(h * 0.10));
    // columnas flanqueando (fuste + capitel + basa) con canto iluminado
    for (let side = -1; side <= 1; side += 2) {
      const cxx = Math.round(w * 0.5) + side * Math.round(w * 0.30);
      const cw2 = Math.round(w * 0.035);
      const ct = Math.round(h * 0.12);
      x.fillStyle = A5_COL;
      x.fillRect(cxx - cw2, ct, cw2 * 2, wallH - ct);
      x.fillRect(cxx - cw2 - 4, ct - 8, cw2 * 2 + 8, 8);       // capitel
      x.fillRect(cxx - cw2 - 2, wallH - 8, cw2 * 2 + 4, 8);    // basa
      x.fillStyle = A5_COL_HI;
      x.fillRect(cxx - cw2, ct, 2, wallH - ct);                // canto
      // brasa de antorcha apagándose (parpadeo se deja al ambiente)
      px(x, cxx + side * (cw2 + 3), ct + Math.round(h * 0.08), 3, 4, A5_EMBER);
    }
    // altar: escalones bajo la capa
    x.fillStyle = A5_COL;
    A5_HX = Math.round(w * 0.5);
    A5_SHY = Math.round(h * 0.42);
    A5_CLW = Math.round(w * 0.13);
    A5_HEMY = Math.round(h * 0.78);
    x.fillRect(A5_HX - A5_CLW, A5_HEMY + 6, A5_CLW * 2, 6);
    x.fillRect(A5_HX - A5_CLW - 8, A5_HEMY + 12, A5_CLW * 2 + 16, 6);
    bakeVignette(x, w, h);
    A5_S.c = s.c;
  }
  // —— sprite de la nota (negra con cabeza de corchea, oro) ——
  A5_NOTE.c = null;
  const nt = mk(14, 20);
  if (nt.x) {
    const x = nt.x;
    // pauta: tallo 2×12, cabeza 8×6, remate
    x.fillStyle = A5_GOLD;
    x.fillRect(9, 1, 2, 12);       // tallo
    x.fillRect(4, 11, 8, 6);       // cabeza (bloque)
    stepEllipse(x, 8, 14, 4, 3);   // cabeza redondeada
    x.fillStyle = A5_GOLD_HI;
    x.fillRect(4, 11, 3, 2);       // brillo de la cabeza
    x.fillRect(10, 1, 1, 3);       // brillo del tallo
    A5_NOTE.c = nt.c;
  }
  // —— anillo del estallido ——
  A5_RING.c = null;
  const rg = mk(84, 84);
  if (rg.x) {
    rg.x.fillStyle = A5_GOLD;
    rg.x.globalAlpha = 0.85;
    stepRing(rg.x, 42, 42, 38, 3);
    rg.x.globalAlpha = 0.3;
    stepRing(rg.x, 42, 42, 30, 3);
    rg.x.globalAlpha = 1;
    A5_RING.c = rg.c;
  }
  // —— resplandor del altar (halo bajo la capa) ——
  A5_GLOW.c = null;
  const gl = mk(160, 60);
  if (gl.x) {
    const x = gl.x;
    x.fillStyle = A5_GOLD;
    x.globalAlpha = 0.10;
    stepEllipse(x, 80, 44, 78, 14);
    x.globalAlpha = 0.14;
    stepEllipse(x, 80, 46, 50, 9);
    x.globalAlpha = 0.18;
    stepEllipse(x, 80, 48, 26, 5);
    x.globalAlpha = 1;
    A5_GLOW.c = gl.c;
  }
  // —— tabla de la capa: tiras verticales (hombros redondeados) ——
  const sw = A5_CLW / A5_CN;
  for (let i = 0; i < A5_CN; i++) {
    const u = i / (A5_CN - 1);
    A5_CX[i] = A5_HX - A5_CLW / 2 + i * sw;
    A5_CW[i] = Math.ceil(sw);
    A5_CT[i] = A5_SHY + Math.abs(u - 0.5) * 2 * 10; // hombros que caen
    A5_CU[i] = u;
  }
  // —— tabla de motas y polvo ——
  for (let i = 0; i < A5_MN; i++) {
    const ang = h01(i, 711) * 6.283;
    A5_MAX[i] = Math.cos(ang);
    A5_MAY[i] = Math.sin(ang) * 0.7;
    A5_MSP[i] = 26 + h01(i, 712) * 44;
    A5_MSZ[i] = h01(i, 713) < 0.3 ? 2 : 1;
    A5_MCI[i] = h01(i, 714) < 0.4 ? 1 : 0;
  }
  for (let i = 0; i < A5_DN; i++) {
    A5_DX[i] = h01(i, 721);
    A5_DY[i] = h01(i, 722);
    A5_DS[i] = 3 + h01(i, 723) * 6;
    A5_DP[i] = h01(i, 724) * 6.283;
  }
}

function drawHeraldo(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  blit(ctx, A5_S, 0, 0);
  // —— resplandor del altar (late despacio) ——
  if (A5_GLOW.c !== null) {
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 1.8);
    ctx.drawImage(A5_GLOW.c, A5_HX - 80, A5_HEMY - 34);
    ctx.globalAlpha = 1;
  }
  // —— polvo ambiental en la penumbra ——
  ctx.fillStyle = '#56566a';
  for (let i = 0; i < A5_DN; i++) {
    const yy = A5_DY[i] * h - (t * A5_DS[i]) % h;
    const a = 0.10 + 0.10 * Math.sin(t * 0.9 + A5_DP[i]);
    if (a <= 0.02) continue;
    ctx.globalAlpha = a;
    ctx.fillRect(R(md(A5_DX[i] * w + Math.sin(t * 0.4 + A5_DP[i]) * 8, w)), R(md(yy, h)), 1, 1);
  }
  ctx.globalAlpha = 1;
  // —— la capa vacía: tiras con bajo ondulante (2 sinusoides fijas) ——
  const sway = Math.round(Math.sin(t * 0.9) * 2);   // vaivén del conjunto
  for (let i = 0; i < A5_CN; i++) {
    const u = A5_CU[i];
    const hem = A5_HEMY - (1 - Math.sin(Math.PI * u)) * 5
              + Math.sin(A5_CX[i] * 0.30 + t * 2.3) * 3.2
              + Math.sin(A5_CX[i] * 0.12 - t * 1.5) * 2.1;
    const top = R(A5_CT[i]);
    const bot = R(hem);
    if (bot <= top) continue;
    const sx = R(A5_CX[i]) + sway;
    ctx.fillStyle = i % 3 === 1 ? A5_CLOAK_D : A5_CLOAK; // pliegues por tira
    ctx.fillRect(sx, top, A5_CW[i], bot - top);
    if (i === 0 || i === A5_CN - 1) {                     // canto exterior
      ctx.fillStyle = A5_CLOAK_RIM;
      ctx.fillRect(sx, top, 1, bot - top);
    }
  }
  // broche dorado flotando en el cuello: la capa no lo sostiene nadie
  ctx.fillStyle = A5_GOLD;
  ctx.fillRect(A5_HX - 2 + sway, A5_SHY - 3 + (Math.sin(t * 1.6) > 0 ? 0 : 1), 4, 2);
  // —— nota luminosa: asciende (0..6.5 s) y estalla a t≈7 s ——
  if (t < 7) {
    const prog = cl(t / 6.5);
    const ny = R((A5_HEMY - 10) - eo(prog) * (A5_HEMY - 10 - h * 0.16));
    const nx = R(A5_HX + Math.sin(t * 1.6) * 6) + sway;
    if (A5_NOTE.c !== null) {
      ctx.globalAlpha = Math.min(1, prog * 6) * (0.8 + 0.2 * Math.sin(t * 5.1));
      ctx.drawImage(A5_NOTE.c, nx - 7, ny - 10);
      ctx.globalAlpha = 1;
    }
  } else {
    // estallido: anillo + motas radiales (fase 1.5 s, luego silencio).
    // El centro congela el vaivén de la nota en t=6.5 (sin(10.4)):
    // la nota muere EXACTAMENTE donde dejó de verse.
    const bt = t - 7;
    const bx = A5_HX + Math.round(Math.sin(10.4) * 6);
    const by = R(h * 0.16) + 6;
    if (bt < 0.4 && A5_RING.c !== null) {
      ctx.globalAlpha = (1 - bt / 0.4) * 0.9;
      const rw = R(84 * (0.4 + bt * 2.2));
      ctx.drawImage(A5_RING.c, bx - (rw >> 1), by - (rw >> 1), rw, rw);
    }
    if (bt < 1.5) {
      const fade = 1 - bt / 1.5;
      const ease = 1 - (1 - cl(bt / 1.5)) * (1 - cl(bt / 1.5));
      for (let i = 0; i < A5_MN; i++) {
        const rr = A5_MSP[i] * bt * ease;
        const mx = R(bx + A5_MAX[i] * rr);
        const my = R(by + A5_MAY[i] * rr - bt * 6);
        if (mx < -2 || mx > w + 2 || my < -2 || my > h + 2) continue;
        ctx.globalAlpha = fade * (0.5 + 0.5 * Math.sin(i * 2.1 + t * 6));
        ctx.fillStyle = A5_MCI[i] === 1 ? A5_GOLD_HI : A5_GOLD;
        ctx.fillRect(mx, my, A5_MSZ[i], A5_MSZ[i]);
      }
      ctx.globalAlpha = 1;
    }
  }
}

// ============================================================
// ESCENA 5 · 'eco_despierto' — EL ÁRBOL DE LOS ANILLOS
// ============================================================
// El ÁRBOL DEL ECO en silueta central sobre noche cálida. Desde su
// copa se expanden ANILLOS de crecimiento (contornos pixelados
// horneados a 15 radios; por frame se elige el más cercano): cada
// anillo monta una MINI-VIÑETA en silueta — casa, barco, tumba —
// las memorias que el Eco devuelve. Luz cálida que crece (halo +
// lavado ámbar de rampa con t) y esporas doradas que suben.

const A6_SKY = ['#120e1a', '#18121f', '#1f1624', '#261a28'];
const A6_GROUND = '#0c0f0c';
const A6_TREE = '#0c120e';
const A6_TREE_RIM = '#18241c';
const A6_WARM = '#ff944a';
const A6_RING = '#ffc86a';
const A6_GOLD = '#ffd97a';
const A6_GOLD_HI = '#fff3c0';
const A6_FLY = '#ffcf80';

const A6_S: Cv = { c: null, x: null };   // estática (árbol+fondo)
const A6_GLOW: Cv = { c: null, x: null };// halo cálido central
const A6_RINGS: Cv[] = [];               // contornos por radio (fijo)
const A6_ICONS: Cv[] = [];               // casa · barco · tumba (2×)

const A6_R0 = 36;      // radio del primer anillo horneado
const A6_RST = 14;     // paso entre radios horneados
const A6_RN = 15;      // nº de contornos horneados
let A6_MAXR = 200;     // radio máximo (depende de la talla)
let A6_CCX = 0;        // centro del árbol
let A6_CCY = 0;        // centro de la copa

// Esporas doradas (16).
const A6_FN2 = 16;
const A6_FX2 = new Float64Array(A6_FN2);
const A6_FS2 = new Float64Array(A6_FN2);
const A6_FP2 = new Float64Array(A6_FN2);
const A6_FW = new Float64Array(A6_FN2);

// Ángulos de las mini-viñetas por anillo (arco superior, perspectiva).
const A6_ANG = [-2.35, -1.05, -1.7, -2.85];

// Patrones de las viñetas (silueta '#' + canto dorado '+'), 1 px = 2.
const A6_HOUSE = [
  '.....+.....',
  '....+++....',
  '...++###...',
  '..+#####...',
  '.+#######..',
  '+#########.',
  '####...####',
  '####...####',
  '####...####',
];
const A6_BOAT = [
  '.....+......',
  '.....++.....',
  '.....+++....',
  '.....++++...',
  '.....+++++..',
  '.+++++++++++',
  '.+########+.',
  '..########..',
];
const A6_TOMB = [
  '..+++++..',
  '.+#####+.',
  '+#######+',
  '+#######+',
  '+##### ##', // hueco de inscripción
  '+#######+',
  '+#######+',
  '#########',
  '#########',
];

function bakePattern(pats: readonly string[], dark: string, gold: string, scale: number): Cv {
  const rows = pats.length;
  const cols = pats[0].length;
  const s = mk(cols * scale, rows * scale);
  if (!s.x) return s;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = pats[r].charAt(c);
      if (ch === '#') px(s.x, c * scale, r * scale, scale, scale, dark);
      else if (ch === '+') px(s.x, c * scale, r * scale, scale, scale, gold);
    }
  }
  return s;
}

function bakeEco(w: number, h: number): void {
  A6_MAXR = Math.round(Math.min(w, h) * 0.48);
  A6_CCX = Math.round(w * 0.5);
  A6_CCY = Math.round(h * 0.34);
  // —— estática: fondo cálido + árbol gigante ——
  A6_S.c = null;
  const s = mk(w, h);
  if (s.x) {
    const x = s.x;
    const nb = A6_SKY.length;
    const bh = Math.ceil((h * 0.8) / nb);
    for (let i = 0; i < nb; i++) px(x, 0, i * bh, w, bh, A6_SKY[i]);
    px(x, 0, nb * bh, w, h - nb * bh, A6_SKY[nb - 1]);
    const gy = Math.round(h * 0.82);
    px(x, 0, gy, w, h - gy, A6_GROUND);
    // raíces que se hunden (filas que se abren)
    const tw = Math.round(w * 0.045);
    x.fillStyle = A6_TREE;
    for (let i = 0; i < 5; i++) {
      const half = tw + Math.round(i * tw * 0.42);
      x.fillRect(A6_CCX - half, gy - 10 + i * 2, half * 2, 2);
    }
    // tronco afilado con torceduras (hash, determinista)
    const topY = Math.round(h * 0.30);
    for (let yy = gy; yy > topY; yy -= 2) {
      const u = (gy - yy) / (gy - topY);
      const half = Math.max(2, Math.round(tw * (1 - u * 0.55) + (h01(yy, 801) - 0.5) * 3 * (1 - u)));
      const bend = Math.round(Math.sin(u * 2.6) * 5 * (1 - u));
      x.fillRect(A6_CCX - half + bend, yy, half * 2, 2);
      if (h01(yy, 802) > 0.86) px(x, A6_CCX - half + bend, yy, 2, 2, A6_TREE_RIM); // nudo iluminado
    }
    // copa: racimo de elipses escalonadas + canto superior
    stepEllipse(x, A6_CCX, A6_CCY, Math.round(w * 0.21), Math.round(h * 0.17));
    stepEllipse(x, A6_CCX - Math.round(w * 0.13), A6_CCY + Math.round(h * 0.05), Math.round(w * 0.11), Math.round(h * 0.10));
    stepEllipse(x, A6_CCX + Math.round(w * 0.13), A6_CCY + Math.round(h * 0.04), Math.round(w * 0.12), Math.round(h * 0.11));
    stepEllipse(x, A6_CCX - Math.round(w * 0.05), A6_CCY - Math.round(h * 0.07), Math.round(w * 0.10), Math.round(h * 0.09));
    stepEllipse(x, A6_CCX + Math.round(w * 0.06), A6_CCY - Math.round(h * 0.06), Math.round(w * 0.09), Math.round(h * 0.08));
    bakeVignette(x, w, h);
    A6_S.c = s.c;
  }
  // —— halo cálido central (3 anillos elípticos) ——
  A6_GLOW.c = null;
  const gl = mk(320, 260);
  if (gl.x) {
    const x = gl.x;
    x.fillStyle = A6_WARM;
    x.globalAlpha = 0.08; stepEllipse(x, 160, 130, 155, 125);
    x.globalAlpha = 0.10; stepEllipse(x, 160, 130, 110, 88);
    x.globalAlpha = 0.13; stepEllipse(x, 160, 130, 64, 52);
    x.globalAlpha = 1;
    A6_GLOW.c = gl.c;
  }
  // —— contornos de anillo horneados a radios fijos ——
  if (A6_RINGS.length === 0) for (let i = 0; i < A6_RN; i++) A6_RINGS.push(mk(1, 1));
  const rMax = Math.min(A6_MAXR, A6_R0 + A6_RST * (A6_RN - 1));
  for (let i = 0; i < A6_RN; i++) {
    const rr = A6_R0 + i * A6_RST;
    if (rr > rMax) break;
    const s2 = mk(rr * 2 + 6, rr * 2 + 6);
    if (s2.x) {
      s2.x.fillStyle = A6_RING;
      s2.x.globalAlpha = 0.6;
      stepRing(s2.x, rr + 3, rr + 3, rr, 3);
      s2.x.globalAlpha = 1;
      A6_RINGS[i] = s2;
    }
  }
  // —— mini-viñetas (casa · barco · tumba) horneadas a 2× ——
  if (A6_ICONS.length === 0) {
    A6_ICONS.push(bakePattern(A6_HOUSE, A6_TREE, A6_GOLD, 2));
    A6_ICONS.push(bakePattern(A6_BOAT, A6_TREE, A6_GOLD, 2));
    A6_ICONS.push(bakePattern(A6_TOMB, A6_TREE, A6_GOLD_HI, 2));
  }
  // —— esporas ——
  for (let i = 0; i < A6_FN2; i++) {
    A6_FX2[i] = 0.5 + (h01(i, 811) - 0.5) * 0.6;
    A6_FS2[i] = 5 + h01(i, 812) * 12;
    A6_FP2[i] = h01(i, 813) * 6.283;
    A6_FW[i] = h01(i, 814) < 0.5 ? 1 : 2;
  }
}

function drawEco(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  blit(ctx, A6_S, 0, 0);
  const lr = cl(t / 10); // la luz cálida crece
  // —— halo cálido tras el árbol ——
  if (A6_GLOW.c !== null) {
    ctx.globalAlpha = lr * (0.85 + 0.15 * Math.sin(t * 1.7));
    ctx.drawImage(A6_GLOW.c, A6_CCX - 160, A6_CCY - 130);
  }
  // lavado ámbar que crece (color constante + alpha de rampa)
  ctx.globalAlpha = lr * 0.06;
  ctx.fillStyle = A6_WARM;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  // —— anillos de crecimiento: 4 ondas escalonadas 1.25 s ——
  const P = 5; // periodo de cada anillo
  const lightK = 0.35 + 0.65 * lr;
  for (let k = 0; k < 4; k++) {
    const ph = md(t + k * (P / 4), P) / P;
    const rr = A6_R0 + ph * (A6_MAXR - A6_R0);
    const a = Math.pow(1 - ph, 1.4) * 0.55 * lightK;
    if (a < 0.03) continue;
    const idx = Math.min(A6_RN - 1, Math.max(0, Math.round((rr - A6_R0) / A6_RST)));
    const spr = A6_RINGS[idx];
    if (spr.c !== null) {
      ctx.globalAlpha = a;
      ctx.drawImage(spr.c, A6_CCX - spr.c.width / 2, A6_CCY - spr.c.height / 2);
    }
    // mini-viñeta montada en el anillo (casa/barco/tumba por índice)
    if (rr > 52 && rr < A6_MAXR - 10) {
      const ic = A6_ICONS[k % 3];
      if (ic.c !== null) {
        const th = A6_ANG[k % 4];
        const ix = A6_CCX + Math.cos(th) * rr;
        const iy = A6_CCY + Math.sin(th) * rr * 0.62;
        ctx.globalAlpha = Math.min(a * 1.6, 0.9);
        ctx.drawImage(ic.c, R(ix - ic.c.width / 2), R(iy - ic.c.height));
      }
    }
  }
  ctx.globalAlpha = 1;
  // —— esporas doradas que suben (nacen con la luz) ——
  ctx.fillStyle = A6_FLY;
  for (let i = 0; i < A6_FN2; i++) {
    const yy = h + 10 - md(A6_FP2[i] * h + t * A6_FS2[i], h + 20);
    const a = (0.25 + 0.35 * Math.sin(t * 1.1 + i)) * (0.2 + 0.8 * lr);
    if (a < 0.04) continue;
    ctx.globalAlpha = a;
    ctx.fillRect(R(md(A6_FX2[i] * w + Math.sin(t * 0.6 + i * 1.7) * 14, w)), R(yy), A6_FW[i], A6_FW[i]);
  }
  ctx.globalAlpha = 1;
}

// ---------------- CONTRATO: despachador de fondos ----------------

/**
 * drawStoryBackdrop — pinta el FONDO COMPLETO de la escena sceneId
 * en espacio de VISTA (w×h = la vista del motor, p. ej. 960×540).
 * t = segundos desde el inicio de la escena (determinista).
 * Id desconocido → vacío neutro (nunca crash).
 */
export function drawStoryBackdrop(
  ctx: CanvasRenderingContext2D, sceneId: string, t: number, w: number, h: number,
): void {
  const ix = ID_IX[sceneId];
  if (ix === undefined) {
    // fallback neutro: vacío + viñeta (QA lo ve al instante)
    ctx.fillStyle = '#0c0a14';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1c1828';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(R(h01(i, 999) * w), R(h01(i, 998) * h), 1, 1);
    }
    return;
  }
  ensureBake(ix, w, h);
  switch (ix) {
    case 0: drawActo1(ctx, t, w, h); break;
    case 1: drawActo2(ctx, t, w, h); break;
    case 2: drawActo3(ctx, t, w, h); break;
    case 3: drawActo4(ctx, t, w, h); break;
    case 4: drawHeraldo(ctx, t, w, h); break;
    default: drawEco(ctx, t, w, h); break;
  }
}
