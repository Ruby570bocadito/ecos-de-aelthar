// ============================================================
// ECOS DE AELTHAR — bossintro.ts (módulo actors)
// R2-A8 · Intro cinematográfica del jefe "Guardián Hueco"
// ------------------------------------------------------------
// Overlay NO bloqueante de ~3.0 s en espacio de VISTA 960×540
// (el integrador lo llama con el ctx del motor, sin transform
// extra — mismo criterio que los overlays de render.ts).
// El juego sigue corriendo: este módulo NO toca g.state, NO
// pausa, NO toca g.shake (el temblor va integrado en el propio
// draw como jitter del banner).
//
// CONTRATO (el integrador lo conecta en update.ts ~255-267 y
// en render.ts tras el HUD):
//   startBossIntro(g)      → arranca la intro (idempotente)
//   bossIntroActive()      → true mientras dura (~3.0 s)
//   updateBossIntro(g,dt)  → avanza el reloj (1× por frame)
//   drawBossIntro(ctx,g)   → pinta el overlay (safe si no hay)
//   resetBossIntro()       → nueva partida / repetir pelea
//
// LOS 3 ACTOS:
//   1) 0.0-0.5 s  viñeta negra escalonada desde los bordes +
//                 2 barras letterbox que entran (arriba/abajo).
//   2) 0.5-2.4 s  banner "EL GUARDIÁN HUECO" en tipografía pixel
//                 (fillRect, sin ctx.fillText) en cian pálido
//                 #7ee8ff con jitter cromático (2 pasadas ±1 px
//                 rojo/cian, alpha bajo) + regla que se abre del
//                 centro + subtítulo "NO DUERME. NUNCA DURMIÓ."
//                 en gris azulado + motas de ceniza ascendentes
//                 (deriva determinista con hash2) + viñeta roja
//                 que late 2 veces con doble-beat (estilo
//                 horror.ts).
//   3) 2.4-3.0 s  banner y barras salen, la viñeta se disuelve.
//
// CONVENCIONES (las de horror.ts):
//   - Determinista: cero Math.random; hash2 de world/palette
//     normalizado ×2 (el nativo solo devuelve [0, 0.5)).
//   - Cero allocations por frame: viñetas pre-pintadas en canvas
//     caché, colores constantes + globalAlpha (nunca strings
//     rgba dinámicas), todos los fillRect con enteros.
//   - Sin gradientes: la viñeta es una rampa ESCALONADA de
//     anillos sólidos (bandas de alpha, estética pixel-art).
// ============================================================

import { VIEW_W, VIEW_H } from '../consts';
import { hash2 } from '../world/palette';
import type { Game } from '../engine';

// ---------------- Constantes de la intro ----------------

const DUR = 3.0;          // duración total (s)
const BAR_H = 64;         // alto de cada barra letterbox
const A1_END = 0.5;       // fin del acto 1 (entrada de barras/viñeta)
const A2_END = 2.4;       // fin del acto 2 (banner visible)
const BAN_S = 4;          // escala del nombre (5×7 px por celda)
const SUB_S = 2;          // escala del subtítulo

const NAME_STR = 'EL GUARDIÁN HUECO';
const SUB_STR = 'NO DUERME. NUNCA DURMIÓ.';

// Colores constantes (el fade SIEMPRE va por globalAlpha).
const COL_NAME = '#7ee8ff';   // cian pálido (banner) — el mismo del toast del jefe
const COL_CHRO_R = '#ff4a58'; // pasada cromática roja (±1 px)
const COL_CHRO_C = '#3ce8ff'; // pasada cromática cian (±1 px)
const COL_SHADOW = '#03121c'; // sombra dura del texto
const COL_SUB = '#8fa4b8';    // gris azulado (subtítulo)
const COL_CAP = '#d4f6ff';    // extremos de la regla
const COL_ASH1 = '#aab8c2';   // ceniza clara
const COL_ASH2 = '#78848e';   // ceniza apagada
const VIG_BLACK = '#000000';  // viñeta de oscurecimiento
const VIG_RED = '#560a12';    // viñeta del latido (rojo apagado, nunca vivo)

// ---------------- Estado interno del módulo ----------------

let on = false;           // intro en curso
let seen = false;         // esta pelea YA vio su intro (start pasa a no-op)
let t = 0;                // reloj de la intro (s)

// Cachés pre-pintadas (una sola vez por sesión; reconstruidas si VIEW cambia).
let vigDark: HTMLCanvasElement | null = null;
let vigRed: HTMLCanvasElement | null = null;
let vigW = 0, vigH = 0;   // VIEW con el que se construyeron (vista DINÁMICA)
let noDoc = false;        // sin DOM (harness): pinta los anillos en directo

// ---------------- Utilidades deterministas ----------------

/** hash2 normalizado a [0,1): el nativo solo devuelve [0,0.5) (ver horror.ts). */
function h2(a: number, b: number): number {
  return hash2(a, b) * 2;
}

function cl(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOutCubic(x: number): number {
  const u = 1 - x;
  return 1 - u * u * u;
}

function easeInCubic(x: number): number {
  return x * x * x;
}

/**
 * Latido doble (lub-dub) en t≈0.92 s y t≈1.92 s: dos pulsos separados
 * 0.17 s por golpe, como el doble-beat de horror.ts pero con ventana
 * finita para que la intro tenga EXACTAMENTE 2 latidos.
 */
function bump(x: number): number {
  return x <= 0 || x >= 0.14 ? 0 : Math.sin((x / 0.14) * Math.PI);
}

function beatEnv(ti: number): number {
  const e = bump(ti - 0.92) + bump(ti - 1.09)
          + bump(ti - 1.92) + bump(ti - 2.09);
  return e > 1 ? 1 : e;
}

// ---------------- Tipografía pixel 5×7 (solo fillRect) ----------------

const FONT: Record<string, string[]> = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  C: [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '],
  D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  G: [' ####', '#    ', '#    ', '#  ##', '#   #', '#   #', ' ### '],
  H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
  L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  R: ['#### ', '#   #', '#   #', '#### ', '#  # ', '# #  ', '#    '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  '.': ['     ', '     ', '     ', '     ', '     ', '  ## ', '  ## '],
  ' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
};

// Vocales con tilde → glifo base + acento agudo dibujado encima.
const ACCENT_OF: Record<string, string> = { 'Á': 'A', 'Í': 'I', 'Ó': 'O' };
// [columna, fila relativa al techo de la caja] (fila negativa = encima).
const ACCENT_PX: number[][] = [[2, -2], [3, -3]];

/** Ancho en px de una cadena a escala s: (len-1)*6*s + 5*s. */
function textW(len: number, s: number): number {
  return (len - 1) * 6 * s + 5 * s;
}

/**
 * Dibuja una cadena en tipografía pixel 5×7 con fillRect enteros.
 * Una sola pasada SIN sombra: las pasadas (sombra/base/cromáticas)
 * las compone el llamador para controlar alpha por capa.
 */
function drawTextPx(ctx: CanvasRenderingContext2D, str: string, x0: number, y0: number, s: number): void {
  let x = x0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charAt(i);
    const base = ACCENT_OF[ch];
    const gph = FONT[base !== undefined ? base : ch] ?? FONT[' '];
    for (let r = 0; r < 7; r++) {
      const row = gph[r];
      for (let c = 0; c < 5; c++) {
        if (row.charAt(c) === '#') ctx.fillRect(x + c * s, y0 + r * s, s, s);
      }
    }
    if (base !== undefined) {
      for (let k = 0; k < ACCENT_PX.length; k++) {
        ctx.fillRect(x + ACCENT_PX[k][0] * s, y0 + ACCENT_PX[k][1] * s, s, s);
      }
    }
    x += 6 * s;
  }
}

// ---------------- Viñetas escalonadas (caché) ----------------

/**
 * Pinta una viñeta de anillos CONCÉNTRICOS escalonados: del anillo más
 * grueso al más fino, cada punto a profundidad d acumula
 * (n-1-floor(d/th)) capas de alpha `a` → rampa escalonada hacia los
 * bordes, con bandas sólidas (sin gradientes, estética pixel-art).
 * mul escala TODOS los alphas (fallback sin DOM pinta directo al ctx).
 */
function paintVig(x: CanvasRenderingContext2D, col: string, n: number, th: number, a: number, mul: number): void {
  x.fillStyle = col;
  for (let k = n - 1; k >= 1; k--) {
    const T = k * th;
    x.globalAlpha = cl(a * mul);
    x.fillRect(0, 0, VIEW_W, T);
    x.fillRect(0, VIEW_H - T, VIEW_W, T);
    x.fillRect(0, T, T, VIEW_H - 2 * T);
    x.fillRect(VIEW_W - T, T, T, VIEW_H - 2 * T);
  }
  x.globalAlpha = 1;
}

function buildVig(col: string, n: number, th: number, a: number): HTMLCanvasElement | null {
  try {
    const c = document.createElement('canvas');
    c.width = VIEW_W;
    c.height = VIEW_H;
    const x = c.getContext('2d');
    if (!x) { noDoc = true; return null; }
    paintVig(x, col, n, th, a, 1);
    return c;
  } catch {
    noDoc = true;
    return null;
  }
}

function ensureVigs(): void {
  if (noDoc) return;
  // R5-O8: caché válida solo con el VIEW actual (fitViewToWindow la cambia) →
  // reconstrucción 1 vez por cambio de tamaño, nunca por frame.
  if (vigDark && vigRed && vigW === VIEW_W && vigH === VIEW_H) return;
  vigW = VIEW_W;
  vigH = VIEW_H;
  vigDark = buildVig(VIG_BLACK, 15, 20, 0.3); // bordes ~0.99 de negro acumulado
  if (!noDoc) vigRed = buildVig(VIG_RED, 12, 22, 0.3);
}

/** Vuelca una viñeta cacheada (o la pinta en directo si no hay DOM). */
function blitVig(
  ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement | null,
  col: string, n: number, th: number, a: number, mul: number,
): void {
  if (mul <= 0.004) return;
  if (cv) {
    ctx.globalAlpha = cl(mul);
    ctx.drawImage(cv, 0, 0);
  } else if (noDoc) {
    paintVig(ctx, col, n, th, a, mul);
  }
  ctx.globalAlpha = 1;
}

// ---------------- R5-O8 · TEXTO HORNEADO (sprites prerrenderizados) ----------------
/**
 * El banner dibujaba el nombre COMPLETO 4 veces por frame (sombra + base +
 * 2 pasadas cromáticas) y el subtítulo 2 veces con fillRect por celda:
 * ~3000 fillRect/frame durante la intro. Cada pasada se HORNEA a un
 * minicanvas (misma drawTextPx, mismos colores) y el draw por frame son 4-6
 * drawImage con la MISMA globalAlpha que antes — composite idéntico
 * (source-over es asociativo: hornear capas opacas y volcarlas con alpha 1
 * por pasada es equivalente a pintarlas en orden). Sin DOM → ruta directa.
 */
const NAME_PASSES = [COL_SHADOW, COL_NAME, COL_CHRO_R, COL_CHRO_C];
const SUB_PASSES = [COL_SHADOW, COL_SUB];

let nameSprs: HTMLCanvasElement[] | null = null;
let subSprs: HTMLCanvasElement[] | null = null;
let txtSprTried = false;

function buildTextSprs(str: string, s: number, cols: string[]): HTMLCanvasElement[] | null {
  try {
    const w = Math.ceil(textW(str.length, s)) + 2;      // +2: margen izquierdo
    const h = 10 * s + 2;                               // 3s acento + 7s glifo + margen
    const out: HTMLCanvasElement[] = [];
    for (let i = 0; i < cols.length; i++) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      if (!x) return null;
      x.fillStyle = cols[i];
      drawTextPx(x, str, 1, 3 * s + 1, s);
      out.push(c);
    }
    return out;
  } catch {
    return null;
  }
}

function ensureTextSprs(): void {
  if (txtSprTried) return;
  txtSprTried = true;
  nameSprs = buildTextSprs(NAME_STR, BAN_S, NAME_PASSES);
  subSprs = nameSprs ? buildTextSprs(SUB_STR, SUB_S, SUB_PASSES) : null;
  if (!nameSprs || !subSprs) { nameSprs = null; subSprs = null; }
}

/**
 * R5-O8 · CENIZA HORNEADA: los 8 hash por mota (h2(i, 201..209)) son
 * CONSTANTES por i — se precalculan UNA vez en esta tabla y el draw por
 * frame solo evalúa sin/módulo (antes: ~240 hash2 por frame durante la
 * intro). Mismos valores → mismos píxeles.
 */
interface AshMote {
  spd: number;   // px/s de subida
  p0: number;    // fase inicial de vida
  x0: number;    // fracción 0..1 de VIEW_W (× VIEW_W en runtime: vista dinámica)
  dx: number;    // deriva horizontal px/s
  swF: number;   // frecuencia del vaivén
  faM: number;   // multiplicador de alpha
  c2: boolean;   // color ceniza apagada
  sz: number;    // tamaño 1|2
  ex: number;    // alto extra 0|1
}
const ASH: AshMote[] = [];
let ashReady = false;

function ensureAsh(): void {
  if (ashReady) return;
  ashReady = true;
  for (let i = 0; i < 30; i++) {
    ASH.push({
      spd: 14 + h2(i, 201) * 26,
      p0: h2(i, 202),
      x0: h2(i, 203),
      dx: 6 + h2(i, 204) * 10,
      swF: 0.5 + h2(i, 205) * 0.6,
      faM: 0.14 + 0.22 * h2(i, 206),
      c2: h2(i, 207) < 0.3,
      sz: h2(i, 208) < 0.35 ? 1 : 2,
      ex: h2(i, 209) < 0.5 ? 1 : 0,
    });
  }
}

// ---------------- CONTRATO: ciclo de vida ----------------

/**
 * startBossIntro — arranca la presentación. IDEMPOTENTE: si ya está
 * activa o esta pelea ya vio su intro, no hace nada (llamar 1× desde
 * la activación del jefe en update.ts; resetBossIntro() para repetir).
 */
export function startBossIntro(g: Game): void {
  if (on || seen) return;
  void g; // la firma exige Game por contrato (lectura no necesaria)
  on = true;
  seen = true;
  t = 0;
}

/** bossIntroActive — true durante los ~3.0 s de la intro. */
export function bossIntroActive(): boolean {
  return on;
}

/**
 * updateBossIntro — avanza el reloj (1× por frame). Safe si no hay intro.
 * Si el jefe cae o la pelea se marca como ganada, corta al momento.
 */
export function updateBossIntro(g: Game, dt: number): void {
  if (!on) return;
  if (dt > 0) t += dt;
  const b = g.bossRef;
  if ((b !== null && b.dead) || g.flags.guardianDefeated === true) {
    on = false;
    return;
  }
  if (t >= DUR) {
    on = false;
    t = DUR;
  }
}

/** resetBossIntro — nueva partida / repetir la pelea: permite otra intro. */
export function resetBossIntro(): void {
  on = false;
  seen = false;
  t = 0;
}

// ---------------- CONTRATO: dibujo (vista 960×540) ----------------

/**
 * drawBossIntro — pinta el overlay en espacio de VISTA (960×540).
 * Orden: viñeta negra → barras letterbox → ceniza → viñeta roja
 * (latido) → banner + regla + subtítulo. Safe si no hay intro.
 */
export function drawBossIntro(ctx: CanvasRenderingContext2D, g: Game): void {
  if (!on) return;
  void g; // el overlay es puramente temporal (no lee mundo)
  ensureVigs();

  // -------- ventanas de los actos --------
  const inRamp = cl(t / A1_END);                          // acto 1: entra
  const outRamp = 1 - cl((t - A2_END) / (DUR - A2_END));  // acto 3: sale
  const beat = beatEnv(t);

  // -------- ACTO 1/3 · viñeta negra (el mundo se apaga por los bordes) --------
  const darkA = 0.9 * easeOutCubic(inRamp) * outRamp;
  blitVig(ctx, vigDark, VIG_BLACK, 15, 20, 0.3, darkA);

  // -------- ACTO 1/3 · barras letterbox --------
  const barK = easeOutCubic(cl(t / 0.45)) * (1 - easeInCubic(cl((t - 2.45) / 0.5)));
  const off = Math.round(BAR_H * barK);
  if (off > 0) {
    ctx.fillStyle = VIG_BLACK;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, off - BAR_H, VIEW_W, BAR_H);          // barra superior
    ctx.fillRect(0, VIEW_H - off, VIEW_W, BAR_H);         // barra inferior
  }

  // -------- ACTO 2 · motas de ceniza ascendentes (deriva determinista) --------
  const ashMul = cl((t - 0.25) / 0.4) * cl((2.85 - t) / 0.35);
  if (ashMul > 0.01) {
    ensureAsh(); // R5-O8: constantes por mota precalculadas (1 vez, no por frame)
    ctx.fillStyle = COL_ASH1;
    for (let i = 0; i < 30; i++) {
      const m = ASH[i];
      const prog = (m.p0 + (t * m.spd) / VIEW_H) % 1;           // vida 0..1
      const fa = Math.sin(prog * Math.PI) * m.faM * ashMul;
      if (fa < 0.02) continue;
      const xr = m.x0 * VIEW_W + t * m.dx
               + Math.sin(t * m.swF + i * 1.7) * 12;
      const x = ((xr % VIEW_W) + VIEW_W) % VIEW_W;
      ctx.globalAlpha = cl(fa);
      ctx.fillStyle = m.c2 ? COL_ASH2 : COL_ASH1;
      ctx.fillRect(Math.round(x), Math.round(VIEW_H - prog * VIEW_H), m.sz, m.sz + m.ex);
    }
    ctx.globalAlpha = 1;
  }

  // -------- LATIDO · viñeta roja, 2 pulsos con doble-beat --------
  const redA = (0.16 + 0.6 * beat)
    * cl((t - 0.35) / 0.3) * cl((2.8 - t) / 0.3);
  blitVig(ctx, vigRed, VIG_RED, 12, 22, 0.3, redA);

  // -------- ACTO 2/3 · banner, regla y subtítulo --------
  const aBan = easeOutCubic(cl((t - 0.5) / 0.3)) * outRamp;
  if (aBan > 0.01) {
    // jitter del banner integrado en el draw (NO toca g.shake):
    // ±1 px base, hasta ±2 px durante los latidos; cambia ~16 veces/s.
    const tick = Math.floor(t * 16);
    const amp = 1 + 1.6 * beat;
    const jx = Math.round((h2(tick, 91) - 0.5) * 2 * amp);
    const jy = Math.round((h2(tick, 131) - 0.5) * 2 * amp);
    const rise = 1 - easeOutCubic(cl((t - 0.5) / 0.3));
    const bx = Math.round((VIEW_W - textW(NAME_STR.length, BAN_S)) / 2) + jx;
    const by = 176 + Math.round(rise * 14) + jy;

    // sombra dura → base cian pálido → 2 pasadas cromáticas ±1 px
    // R5-O8: pasadas HORNEADAS a sprites (4 drawImage en vez de ~2800 fillRect)
    ensureTextSprs();
    if (nameSprs) {
      const pad = 3 * BAN_S + 1; // alto del margen superior del sprite (acentos)
      ctx.globalAlpha = cl(0.75 * aBan);
      ctx.drawImage(nameSprs[0], bx + 3 - 1, by + 3 - pad);
      ctx.globalAlpha = cl(aBan);
      ctx.drawImage(nameSprs[1], bx - 1, by - pad);
      ctx.globalAlpha = cl(0.22 * aBan);
      ctx.drawImage(nameSprs[2], bx - 1 - 1, by - pad);
      ctx.drawImage(nameSprs[3], bx + 1 - 1, by - pad);
    } else {
      ctx.fillStyle = COL_SHADOW;
      ctx.globalAlpha = cl(0.75 * aBan);
      drawTextPx(ctx, NAME_STR, bx + 3, by + 3, BAN_S);
      ctx.fillStyle = COL_NAME;
      ctx.globalAlpha = cl(aBan);
      drawTextPx(ctx, NAME_STR, bx, by, BAN_S);
      ctx.fillStyle = COL_CHRO_R;
      ctx.globalAlpha = cl(0.22 * aBan);
      drawTextPx(ctx, NAME_STR, bx - 1, by, BAN_S);
      ctx.fillStyle = COL_CHRO_C;
      ctx.globalAlpha = cl(0.22 * aBan);
      drawTextPx(ctx, NAME_STR, bx + 1, by, BAN_S);
    }

    // regla que se abre del centro bajo el nombre
    const aRule = cl(aBan * 0.95);
    const rw = Math.round(textW(NAME_STR.length, BAN_S) * easeOutCubic(cl((t - 0.55) / 0.35)));
    if (rw >= 4) {
      const rlx = Math.round((VIEW_W - rw) / 2);
      const rly = by + 7 * BAN_S + 8;
      ctx.fillStyle = COL_SHADOW;
      ctx.globalAlpha = cl(0.6 * aBan);
      ctx.fillRect(rlx - 1, rly + 1, rw + 2, 2);
      ctx.fillStyle = COL_NAME;
      ctx.globalAlpha = aRule;
      ctx.fillRect(rlx, rly, rw, 2);
      ctx.fillStyle = COL_CAP;
      ctx.globalAlpha = aRule;
      ctx.fillRect(rlx, rly, 2, 2);
      ctx.fillRect(rlx + rw - 2, rly, 2, 2);
    }

    // subtítulo en gris azulado (aparece un pelo más tarde)
    const aSub = cl((t - 0.72) / 0.3) * outRamp;
    if (aSub > 0.01) {
      const sx0 = Math.round((VIEW_W - textW(SUB_STR.length, SUB_S)) / 2);
      const sy0 = by + 7 * BAN_S + 18;
      if (subSprs) { // R5-O8: subtítulo también horneado (2 drawImage)
        const padS = 3 * SUB_S + 1;
        ctx.globalAlpha = cl(0.7 * aSub);
        ctx.drawImage(subSprs[0], sx0 + 2 - 1, sy0 + 2 - padS);
        ctx.globalAlpha = cl(aSub);
        ctx.drawImage(subSprs[1], sx0 - 1, sy0 - padS);
      } else {
        ctx.fillStyle = COL_SHADOW;
        ctx.globalAlpha = cl(0.7 * aSub);
        drawTextPx(ctx, SUB_STR, sx0 + 2, sy0 + 2, SUB_S);
        ctx.fillStyle = COL_SUB;
        ctx.globalAlpha = cl(aSub);
        drawTextPx(ctx, SUB_STR, sx0, sy0, SUB_S);
      }
    }
  }

  ctx.globalAlpha = 1;
}
