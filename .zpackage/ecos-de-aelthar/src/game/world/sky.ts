// ============================================================
// ECOS DE AELTHAR — Cielo y ciclo día/noche (R1-A8 · mundo)
// drawSkyBackdrop  : fondo de cielo completo (TITLE SCREEN y transiciones)
// drawDayNightGrade: grading de dayT sobre el mundo (se dibuja antes del HUD)
// drawCloudShadows : sombras de nube en exteriores de día
//
// Todo determinista (hash2 + globalT/dayT), fillRect enteros y cachés
// perezosas (patrones dither 2×2 / luna pre-pintada) sin allocations
// masivas por frame.
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
import { VIEW_W, VIEW_H } from '../engine';
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
const TRANS_W = 0.018;                      // semiancho de transición entre franjas (~4.3 s de los 240 s del ciclo)

/** Modulo positivo (para derivas y parallax que envuelven). */
function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Índice de DAY_STAGES para un dayT dado (maneja el envuelve de la noche). */
export function stageIndexAt(dayT: number): number {
  const dT = mod(dayT, 1);
  for (let i = NOCHE; i >= 1; i--) {
    if (dT >= DAY_STAGES[i].from) return i;
  }
  return NOCHE;                              // [0, 0.06) aún es noche
}

/** Etapa del día para un dayT (utilidad para el integrador/debug). */
export function stageAt(dayT: number): DayStage {
  return DAY_STAGES[stageIndexAt(dayT)];
}

/** Transición activa cerca de una frontera: etapas a→b y mezcla m 0..1. */
function transitionAt(dT: number): { a: number; b: number; m: number } | null {
  for (let i = 0; i < DAY_STAGES.length; i++) {
    const b = DAY_STAGES[i].from;
    const d = mod(dT - b + 0.5, 1) - 0.5;    // distancia circular a la frontera
    if (Math.abs(d) <= TRANS_W) {
      return { a: mod(i - 1, DAY_STAGES.length), b: i, m: 0.5 + d / (2 * TRANS_W) };
    }
  }
  return null;
}

// ---------------- Dither 2×2 (Bayer) ----------------
// Orden Bayer 2×2 de celdas (en un tile de 4×4 px, celdas de 2×2):
//   (0,0)=0  (1,1)=¼  (1,0)=½  (0,1)=¾
// Un color + máscara de 4 bits define qué celdas quedan opacas:
// así se mezclan DOS tonos en una transición sin alpha intermedio.

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

// Máscaras de cobertura: celdas con bayer < q (tono entrante) y su complemento.
function maskLow(q: number): number {
  return q <= 0.25 ? 0b0001 : q <= 0.5 ? 0b0011 : q <= 0.75 ? 0b0111 : 0b1111;
}
function maskHigh(q: number): number {
  return q <= 0.25 ? 0b1110 : q <= 0.5 ? 0b1100 : q <= 0.75 ? 0b1000 : 0b0000;
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

// ---------------- Nubes pixeladas (rects superpuestos, base plana) ----------------

function pixelCloud(
  ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number, st: DayStage,
): void {
  const w = Math.round(120 * s);
  const h = Math.round(14 * s);
  // masa principal con base plana
  ctx.fillStyle = st.cloudBody;
  ctx.fillRect(x, y, w, h);
  // 3 lóbulos superpuestos: cuerpo grueso + escalón superior (silueta escalonada)
  for (let p = 0; p < 3; p++) {
    const pw = Math.round((34 + hash2(seed * 3 + p, 73) * 38) * s);
    const ph = Math.round((10 + hash2(seed * 5 + p, 79) * 14) * s);
    const lx = Math.round(x + 8 * s + (w - 16 * s - pw) * (p / 2));
    const ly = y - ph;
    ctx.fillRect(lx, ly + 4, pw, ph);
    const pw2 = Math.max(6, Math.round(pw * 0.55));
    ctx.fillRect(lx + Math.round((pw - pw2) / 2), ly, pw2, 6);
    if (st.cloudHi) {
      ctx.fillStyle = st.cloudHi;
      ctx.fillRect(lx + Math.round((pw - pw2) / 2), ly, pw2, 2);  // canto iluminado
      ctx.fillStyle = st.cloudBody;
    }
  }
  // sombra de la base plana (de día es lo que define la nube "clásica")
  ctx.fillStyle = st.cloudLo;
  ctx.fillRect(x, y + h - 3, w, 3);
}

// ============================================================
// 1) drawSkyBackdrop — cielo completo para TITLE SCREEN y transiciones
//    Pinta: bandas de color según franja del día, estrellas en 2 capas
//    parallax deterministas (hash2), luna escalonada con halo dithered
//    y nubes pixeladas derivando lento (blancas de base plana de día).
// ============================================================

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
  const st = titleMode ? DAY_STAGES[NOCHE] : DAY_STAGES[stageIndexAt(dT)];

  // ---- bandas de cielo (pixel-art: 6 franjas horizontales, sin gradiente) ----
  const BH = [128, 104, 92, 84, 72, 60];           // suma = VIEW_H
  let by = 0;
  for (let i = 0; i < 6; i++) {
    px(ctx, 0, by, VIEW_W, BH[i], st.sky[i]);
    by += BH[i];
  }

  // ---- estrellas: capa lejana (1 px, deriva lenta) ----
  if (nf > 0.03) {
    for (let i = 0; i < 44; i++) {
      const h1 = hash2(i * 3 + 11, 101);
      const h2 = hash2(i * 5 + 13, 103);
      const h3 = hash2(i * 7 + 17, 107);
      const x = (mod(h1 * (VIEW_W + 40) + t * 1.6 + camX * 0.012, VIEW_W + 40) - 20) | 0;
      const y = (mod(h2 * VIEW_H * 0.7 + camY * 0.008, VIEW_H * 0.7)) | 0;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.4 + h3 * 0.8) + h3 * 9));
      ctx.globalAlpha = nf * tw * 0.55;
      ctx.fillStyle = h3 > 0.85 ? '#ffe9c8' : '#dce4ff';
      ctx.fillRect(x, y, 1, 1);
    }
    // ---- estrellas: capa cercana (2 px, más brillantes y rápidas) ----
    for (let i = 0; i < 26; i++) {
      const h1 = hash2(i * 11 + 19, 113);
      const h2 = hash2(i * 13 + 23, 127);
      const h3 = hash2(i * 17 + 29, 131);
      const x = (mod(h1 * (VIEW_W + 60) + t * 3.2 + camX * 0.03, VIEW_W + 60) - 30) | 0;
      const y = (mod(h2 * VIEW_H * 0.62 + camY * 0.016, VIEW_H * 0.62)) | 0;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.9 + h3 * 1.3) + h3 * 7));
      ctx.globalAlpha = nf * tw * 0.85;
      ctx.fillStyle = h3 > 0.8 ? '#fff3d8' : '#e6ecff';
      ctx.fillRect(x, y, 2, 2);
      if (h3 > 0.82) {                              // estrella grande: cruz de destello
        ctx.globalAlpha = nf * tw * 0.4;
        ctx.fillRect(x - 2, y, 2, 2);
        ctx.fillRect(x + 2, y, 2, 2);
        ctx.fillRect(x, y - 2, 2, 2);
        ctx.fillRect(x, y + 2, 2, 2);
      }
    }
    ctx.globalAlpha = 1;

    // ---- luna escalonada con halo dithered (pre-pintada, 1 drawImage) ----
    if (nf > 0.25) {
      const mx = Math.round(VIEW_W * 0.78 - camX * 0.004);
      const my = 66;
      ctx.globalAlpha = Math.min(1, (nf - 0.2) * 1.6);
      ctx.drawImage(getMoon(), mx - 60, my - 60);
      ctx.globalAlpha = 1;
    }
  }

  // ---- nubes pixeladas derivando lento (de día: blancas de base plana) ----
  for (let i = 0; i < 4; i++) {
    const spd = 4 + hash2(i * 11 + 3, 61) * 5;                        // 4..9 px/s
    const spanX = VIEW_W + 360;
    const x0 = mod(hash2(i * 13 + 5, 63) * spanX + t * spd - camX * 0.06, spanX) - 180;
    const y0 = 26 + hash2(i * 17 + 7, 67) * 150;
    const sc = 0.8 + hash2(i * 19 + 9, 71) * 0.7;
    pixelCloud(ctx, Math.round(x0), Math.round(y0), sc, i, st);
  }
}

// ============================================================
// 2) drawDayNightGrade — capa de grading sobre el mundo (antes del HUD)
//    Franjas de dayT (ver DAY_STAGES) con dithering 2×2 entre dos tonos
//    en las transiciones. En 'pasado' calienta +10%; en 'presente'
//    desatura simulado (azul-gris). En la cripta: no-op.
// ============================================================

export function drawDayNightGrade(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.map.dark) return;                                    // cripta: sin cielo
  if (g.state === 'title' || g.state === 'controls') return; // aún no hay mundo
  const dT = mod(g.dayT, 1);
  const isPast = g.epoch === 'pasado';

  // pinta un tinte (entero con fillRect o dithered con máscara Bayer)
  const fillTint = (tn: SkyTint | null, mask: number) => {
    if (!tn || !mask) return;
    const a = isPast ? Math.min(0.35, tn[3] * 1.1) : tn[3];  // 'pasado' calienta +10%
    const col = `rgba(${tn[0]},${tn[1]},${tn[2]},${a})`;
    if (mask === 0b1111) {
      ctx.fillStyle = col;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else {
      ctx.fillStyle = ditherPattern(ctx, col, mask);
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  };

  const tr = transitionAt(dT);
  if (tr) {
    // mezcla a cuantizada a cobertura Bayer: patrón 2×2 entre los DOS tonos
    const q = tr.m < 0.125 ? 0 : tr.m < 0.375 ? 0.25 : tr.m < 0.625 ? 0.5 : tr.m < 0.875 ? 0.75 : 1;
    if (q <= 0) {
      fillTint(DAY_STAGES[tr.a].tint, 0b1111);
    } else if (q >= 1) {
      fillTint(DAY_STAGES[tr.b].tint, 0b1111);
    } else {
      fillTint(DAY_STAGES[tr.b].tint, maskLow(q));   // celdas bayer < q
      fillTint(DAY_STAGES[tr.a].tint, maskHigh(q));  // celdas bayer ≥ q
    }
  } else {
    fillTint(DAY_STAGES[stageIndexAt(dT)].tint, 0b1111);
  }

  // ---- lavado de época ----
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
// 3) drawCloudShadows — sombras de nube SOLO en exteriores de día
//    5 blobs grandes hechos de filas de rects apiladas (sin solape →
//    alpha uniforme 0.07), ancladas al mundo con parallax y deriva lenta.
// ============================================================

export function drawCloudShadows(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.map.dark) return;                                    // cripta: nunca
  if (g.state === 'title' || g.state === 'controls') return; // sin mundo debajo
  const dT = mod(g.dayT, 1);
  if (dT < 0.08 || dT > 0.70) return;                        // coherente con isNight()

  // rampa suave en los bordes del día (desaparecen al alba y al anochecer)
  let dayF = 1;
  if (dT < 0.12) dayF = (dT - 0.08) / 0.04;
  else if (dT > 0.64) dayF = (0.70 - dT) / 0.06;

  ctx.fillStyle = 'rgba(0,0,20,0.07)';
  ctx.globalAlpha = dayF;

  for (let s = 0; s < 5; s++) {
    const speed = 3.5 + hash2(s * 23 + 9, 41) * 4;           // 3.5..7.5 px/s
    const spanX = VIEW_W + 520;
    const spanY = VIEW_H + 320;
    const x0 = mod(hash2(s * 13 + 5, 31) * spanX + g.globalT * speed - g.camX * 0.45, spanX) - 260;
    const y0 = mod(hash2(s * 17 + 7, 37) * spanY - g.camY * 0.40, spanY) - 160;
    const wBase = 150 + hash2(s * 29 + 11, 43) * 170;        // 150..320 px de ancho
    // silueta blob: 6 filas apiladas SIN solapar (alpha uniforme)
    for (let j = 0; j < 6; j++) {
      const prof = 0.35 + 0.65 * Math.sin(((j + 0.5) / 6) * Math.PI);   // panza central
      const wj = Math.round(wBase * prof * (0.8 + hash2(s * 7 + j, 47) * 0.4));
      const xj = Math.round(x0 + (wBase - wj) / 2 + (hash2(s * 3 + j, 53) - 0.5) * 26);
      ctx.fillRect(xj, Math.round(y0 + j * 9), wj, 9);
    }
  }
  ctx.globalAlpha = 1;
}
