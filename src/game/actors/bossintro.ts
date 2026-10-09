// ============================================================
// ECOS DE AELTHAR — bossintro.ts (módulo actors)
// R2-A8 · Intro cinematográfica del jefe
// R9-5 · INTRO COMPRIMIDA (~50 % más corta): 3.0 s → 1.7 s.
//        Fases SUPERPUESTAS: el nombre entra (t=0.18) mientras
//        las barras letterbox aún asientan (hasta 0.30) y la
//        viñeta negra sigue cerrando (hasta 0.35) — sin pausas
//        muertas. El momento clave se mantiene: doble latido a
//        t≈0.52/0.66 y revelación a t≈1.08/1.22, y salida ágil.
//        Además, el nombre/subtítulo se eligen por el jefe
//        ACTIVO (g.bossRef.etype): antes la Sirena/Gólem/Vult/
//        Coro/Heraldo veían "EL GUARDIÁN HUECO" (hardcode).
// ------------------------------------------------------------
// Overlay NO bloqueante de ~1.7 s en espacio de VISTA 960×540
// (el integrador lo llama con el ctx del motor, sin transform
// extra — mismo criterio que los overlays de render.ts).
// El juego sigue corriendo: este módulo NO toca g.state, NO
// pausa, NO toca g.shake (el temblor va integrado en el propio
// draw como jitter del banner).
//
// CONTRATO (el integrador lo conecta en update.ts ~228/568 y
// en render.ts:996 tras el HUD):
//   startBossIntro(g)      → arranca la intro (idempotente)
//   bossIntroActive()      → true mientras dura (~1.7 s)
//   updateBossIntro(g,dt)  → avanza el reloj (1× por frame)
//   drawBossIntro(ctx,g)   → pinta el overlay (safe si no hay)
//   resetBossIntro()       → nueva partida / repetir pelea
//
// TIMELINE v2 (R9-5) — todo solapado, sin aire muerto:
//   0.00-0.35  viñeta negra escalonada + barras letterbox
//              (barras 0.00-0.30, viñeta 0.00-0.35)
//   0.12-1.50  motas de ceniza ascendentes (deriva hash2)
//   0.20-1.48  viñeta roja (latido, doble-beat)
//   0.18-0.40  banner "NOMBRE DEL JEFE" (tipografía pixel
//              5×7, jitter cromático ±1 px) MIENTRAS las barras
//              y la viñeta aún entran (fases superpuestas)
//   0.24-0.46  regla que se abre del centro
//   0.36-0.56  subtítulo del jefe
//   0.52/0.66  doble latido 1 · 1.08/1.22 doble latido 2
//              (revelación: jitter sube a ±2 px)
//   1.40-1.70  banner, barras y viñeta salen (acto 3, 0.30 s)
//
// CONVENCIONES (las de horror.ts):
//   - Determinista: cero Math.random; hash2 de world/palette
//     normalizado ×2 (el nativo solo devuelve [0, 0.5)).
//   - Cero allocations por frame: viñetas pre-pintadas en canvas
//     caché, colores constantes + globalAlpha (nunca strings
//     rgba dinámicas), todos los fillRect con enteros. Los
//     sprites de texto se hornear 1× por (jefe, escala) — nunca
//     por frame.
//   - Sin gradientes: la viñeta es una rampa ESCALONADA de
//     anillos sólidos (bandas de alpha, estética pixel-art).
// ============================================================

import { VIEW_W, VIEW_H } from '../consts';
import { hash2 } from '../world/palette';
import type { Game } from '../engine';

// ---------------- Constantes de la intro ----------------

const DUR = 1.7;          // duración total (s) — R9-5: era 3.0
const BAR_H = 64;         // alto de cada barra letterbox
const A1_END = 0.35;      // fin de la entrada (viñeta negra asentada)
const A2_END = 1.4;       // inicio del acto 3 (salida, 0.30 s)
const BAR_IN = 0.3;       // entrada de barras (0 → BAR_IN)
const BAR_OUT = 0.28;     // salida de barras (DUR - BAR_OUT → DUR)
const BAN_T = 0.18;       // inicio del banner (SOLAPA barras/viñeta)
const BAN_IN = 0.22;      // duración de entrada del banner
const RULE_T = 0.24;      // inicio de la regla
const RULE_IN = 0.22;     // apertura de la regla
const SUB_T = 0.36;       // inicio del subtítulo
const SUB_IN = 0.2;       // aparición del subtítulo

// Títulos por jefe (R9-5): mismos nombres/subtítulos que los
// banners del motor (update.ts:967 / enemies_expansion.ts), en
// MAYÚSCULAS (la tipografía pixel solo tiene caja alta).
//   guardian → update.ts:967-968   'GUARDIÁN HUECO' (aquí con EL, como R2)
//   sirena   → enemies_expansion.ts:781-782
//   golem    → enemies_expansion.ts:962-963
//   vult     → enemies_expansion.ts:1267-1268
//   coro     → enemies_expansion.ts:1503-1504
//   heraldo  → hooks.ts:445-446
const BOSS_TITLES: ReadonlyArray<readonly [string, string]> = [
  ['EL GUARDIÁN HUECO', 'NO DUERME. NUNCA DURMIÓ.'],
  ['SIRENA ABISAL', 'LA QUE OLVIDÓ SU NOMBRE'],
  ['GÓLEM DE ESCARCHA', 'MEMORIA DE LA MONTAÑA'],
  ['VULT, EL CAZADOR DE ECOS', 'EL MAPA DE TUS PASOS ES SU CONTRATO'],
  ['EL CORO ROTO', 'TRES MÁSCARAS, UNA NOTA AL REVÉS'],
  ['EL HERALDO', 'VESH, LA ÚLTIMA NOTA'],
  ['EL SEPULCRO', 'GUARDA DEL UMBRAL'], // R10-9: mini-jefe de la antesala de la cripta
];
const KIND_OF: Record<string, number> = {
  guardian: 0, sirena: 1, golem: 2, vult: 3, coro: 4, heraldo: 5, sepulcro: 6, // R10-9
};

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

// R9-5: título del jefe ACTIVO (resuelto 1× en startBossIntro; el draw
// nunca construye strings ni consulta el bossRef → cero allocations).
let curKind = 0;
let nameStr: string = BOSS_TITLES[0][0];
let subStr: string = BOSS_TITLES[0][1];
let banS = 4;             // escala del nombre (4 = 20×28 px por glifo)
let subS = 2;             // escala del subtítulo

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
 * Latido doble (lub-dub) comprimido (R9-5): golpes a t≈0.52/0.66 y
 * t≈1.08/1.22 (revelación), separados 0.14 s por golpe — los 2 latidos
 * de la intro original en la MITAD de tiempo.
 */
function bump(x: number): number {
  return x <= 0 || x >= 0.12 ? 0 : Math.sin((x / 0.12) * Math.PI);
}

function beatEnv(ti: number): number {
  const e = bump(ti - 0.52) + bump(ti - 0.66)
          + bump(ti - 1.08) + bump(ti - 1.22);
  return e > 1 ? 1 : e;
}

// ---------------- Tipografía pixel 5×7 (solo fillRect) ----------------

const FONT: Record<string, string[]> = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  B: ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
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
  P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  Q: [' ### ', '#   #', '#   #', '#   #', '#  # ', ' ### ', '   ##'],
  R: ['#### ', '#   #', '#   #', '#### ', '#  # ', '# #  ', '#    '],
  S: [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', '#   #', ' # # ', ' # # ', '  #  '],
  Z: ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
  '.': ['     ', '     ', '     ', '     ', '     ', '  ## ', '  ## '],
  ',': ['     ', '     ', '     ', '     ', '  ## ', '  ## ', '  #  '],
  ' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
};

// Vocales con tilde → glifo base + acento dibujado encima (R9-5: se añaden
// É/Ú para los subtítulos de Vult/Coro/Heraldo y Ñ con VIRGULILLA propia).
const ACCENT_OF: Record<string, string> = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N' };
// Acento agudo: [columna, fila relativa al techo de la caja] (fila <0 = encima).
const ACUTE_PX: number[][] = [[2, -2], [3, -3]];
// Virgulilla de la Ñ (2 filas, curva descendente hacia los lados).
const TILDE_PX: number[][] = [[1, -2], [2, -3], [3, -3], [4, -2]];

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
      const acc = ch === 'Ñ' ? TILDE_PX : ACUTE_PX;
      for (let k = 0; k < acc.length; k++) {
        ctx.fillRect(x + acc[k][0] * s, y0 + acc[k][1] * s, s, s);
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
 * R9-5: la hornada se repite SOLO cuando cambia (jefe, escala) — máx 1× por
 * activación de jefe, nunca por frame (fallos memorizados: sin reintentos).
 */
const NAME_PASSES = [COL_SHADOW, COL_NAME, COL_CHRO_R, COL_CHRO_C];
const SUB_PASSES = [COL_SHADOW, COL_SUB];

let nameSprs: HTMLCanvasElement[] | null = null;
let subSprs: HTMLCanvasElement[] | null = null;
let bakedKind = -1;       // jefe horneado en nameSprs/subSprs
let bakedBanS = 0;        // escalas horneadas
let bakedSubS = 0;
let sprsFailed = false;   // sin DOM/canvas: fallback directo, sin reintentos

function buildTextSprs(str: string, s: number, cols: string[]): HTMLCanvasElement[] | null {
  try {
    const w = Math.ceil(textW(str.length, s)) + 2;      // +2: margen izquierdo
    const h = 10 * s + 2;                               // 3s acento/virgulilla + 7s glifo + margen
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
  if (sprsFailed) return;
  if (bakedKind === curKind && bakedBanS === banS && bakedSubS === subS && nameSprs && subSprs) return;
  nameSprs = buildTextSprs(nameStr, banS, NAME_PASSES);
  subSprs = nameSprs ? buildTextSprs(subStr, subS, SUB_PASSES) : null;
  if (!nameSprs || !subSprs) {
    nameSprs = null;
    subSprs = null;
    sprsFailed = true;
    return;
  }
  bakedKind = curKind;
  bakedBanS = banS;
  bakedSubS = subS;
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
 * la activación del jefe en update.ts:568; resetBossIntro() para repetir).
 * R9-5: elige nombre/subtítulo por g.bossRef.etype (tabla estática,
 * sin allocations) y adapta la escala del nombre a la vista actual.
 */
export function startBossIntro(g: Game): void {
  if (on || seen) return;
  const et = g.bossRef !== null && !g.bossRef.dead ? g.bossRef.etype : '';
  curKind = KIND_OF[et] ?? 0;
  const ttl = BOSS_TITLES[curKind];
  nameStr = ttl[0];
  subStr = ttl[1];
  // escala del nombre: que quepa en la vista (máx 4, mínimo 2)
  banS = 4;
  while (banS > 2 && textW(nameStr.length, banS) > VIEW_W - 48) banS--;
  subS = Math.max(1, Math.min(2, banS - 1));
  on = true;
  seen = true;
  t = 0;
}

/** bossIntroActive — true durante los ~1.7 s de la intro (R9-5: era 3.0). */
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
  curKind = 0;
  nameStr = BOSS_TITLES[0][0];
  subStr = BOSS_TITLES[0][1];
  banS = 4;
  subS = 2;
}

// ---------------- CONTRATO: dibujo (vista 960×540) ----------------

/**
 * drawBossIntro — pinta el overlay en espacio de VISTA (960×540).
 * Orden: viñeta negra → barras letterbox → ceniza → viñeta roja
 * (latido) → banner + regla + subtítulo. Safe si no hay intro.
 * R9-5: timeline comprimida con fases superpuestas (ver cabecera).
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

  // -------- ACTO 1/3 · barras letterbox (entran 0.30 s, salen 0.28 s) --------
  const barK = easeOutCubic(cl(t / BAR_IN)) * (1 - easeInCubic(cl((t - (DUR - BAR_OUT)) / BAR_OUT)));
  const off = Math.round(BAR_H * barK);
  if (off > 0) {
    ctx.fillStyle = VIG_BLACK;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, off - BAR_H, VIEW_W, BAR_H);          // barra superior
    ctx.fillRect(0, VIEW_H - off, VIEW_W, BAR_H);         // barra inferior
  }

  // -------- ACTO 2 · motas de ceniza ascendentes (deriva determinista) --------
  const ashMul = cl((t - 0.12) / 0.28) * cl((1.5 - t) / 0.28);
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

  // -------- LATIDO · viñeta roja, 2 pulsos con doble-beat (0.52/0.66 · 1.08/1.22) --------
  const redA = (0.16 + 0.6 * beat)
    * cl((t - 0.2) / 0.22) * cl((1.48 - t) / 0.22);
  blitVig(ctx, vigRed, VIG_RED, 12, 22, 0.3, redA);

  // -------- ACTO 2/3 · banner, regla y subtítulo --------
  // R9-5: el banner entra en t=0.18 mientras las barras (hasta 0.30) y la
  // viñeta negra (hasta 0.35) aún asientan — fases superpuestas, sin pausa.
  const aBan = easeOutCubic(cl((t - BAN_T) / BAN_IN)) * outRamp;
  if (aBan > 0.01) {
    // jitter del banner integrado en el draw (NO toca g.shake):
    // ±1 px base, hasta ±2 px durante los latidos; cambia ~16 veces/s.
    const tick = Math.floor(t * 16);
    const amp = 1 + 1.6 * beat;
    const jx = Math.round((h2(tick, 91) - 0.5) * 2 * amp);
    const jy = Math.round((h2(tick, 131) - 0.5) * 2 * amp);
    const rise = 1 - easeOutCubic(cl((t - BAN_T) / BAN_IN));
    // R9-5: respiración sutil del banner (bob de ±1 px, 2.2 rad/s)
    const bob = Math.sin(t * 2.2);
    const bx = Math.round((VIEW_W - textW(nameStr.length, banS)) / 2) + jx;
    const by = 176 + Math.round(rise * 14 + bob) + jy;

    // sombra dura → base cian pálido → 2 pasadas cromáticas ±1 px
    // R5-O8: pasadas HORNEADAS a sprites (4 drawImage en vez de ~2800 fillRect)
    ensureTextSprs();
    if (nameSprs) {
      const pad = 3 * banS + 1; // alto del margen superior del sprite (acentos)
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
      drawTextPx(ctx, nameStr, bx + 3, by + 3, banS);
      ctx.fillStyle = COL_NAME;
      ctx.globalAlpha = cl(aBan);
      drawTextPx(ctx, nameStr, bx, by, banS);
      ctx.fillStyle = COL_CHRO_R;
      ctx.globalAlpha = cl(0.22 * aBan);
      drawTextPx(ctx, nameStr, bx - 1, by, banS);
      ctx.fillStyle = COL_CHRO_C;
      ctx.globalAlpha = cl(0.22 * aBan);
      drawTextPx(ctx, nameStr, bx + 1, by, banS);
    }

    // regla que se abre del centro bajo el nombre
    const aRule = cl(aBan * 0.95);
    const rw = Math.round(textW(nameStr.length, banS) * easeOutCubic(cl((t - RULE_T) / RULE_IN)));
    if (rw >= 4) {
      const rlx = Math.round((VIEW_W - rw) / 2);
      const rly = by + 7 * banS + 8;
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
    const aSub = cl((t - SUB_T) / SUB_IN) * outRamp;
    if (aSub > 0.01) {
      const sx0 = Math.round((VIEW_W - textW(subStr.length, subS)) / 2);
      const sy0 = by + 7 * banS + 18;
      if (subSprs) { // R5-O8: subtítulo también horneado (2 drawImage)
        const padS = 3 * subS + 1;
        ctx.globalAlpha = cl(0.7 * aSub);
        ctx.drawImage(subSprs[0], sx0 + 2 - 1, sy0 + 2 - padS);
        ctx.globalAlpha = cl(aSub);
        ctx.drawImage(subSprs[1], sx0 - 1, sy0 - padS);
      } else {
        ctx.fillStyle = COL_SHADOW;
        ctx.globalAlpha = cl(0.7 * aSub);
        drawTextPx(ctx, subStr, sx0 + 2, sy0 + 2, subS);
        ctx.fillStyle = COL_SUB;
        ctx.globalAlpha = cl(aSub);
        drawTextPx(ctx, subStr, sx0, sy0, subS);
      }
    }
  }

  ctx.globalAlpha = 1;
}
