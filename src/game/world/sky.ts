// ============================================================
// ECOS DE AELTHAR — Cielo y ciclo día/noche (R1-A8 · v2 R4-A2 · v3 R8-8 · v4 R9-3)
// drawSkyBackdrop  : fondo de cielo completo (TITLE SCREEN y transiciones)
// drawDayNightGrade: grading de dayT sobre el mundo (se dibuja antes del HUD)
//                    + nubes v3 (3 capas), banda de amanecer/anochecer,
//                    Vía Láctea, titileo individual y estrella fugaz
// drawCloudShadows : sombras en suelo de las nubes (exteriores de día)
//
// Todo determinista (hash2 + globalT/dayT), fillRect enteros y cachés
// perezosas (patrones dither 2×2 / luna / nubes pre-pintadas) sin
// allocations por frame.
//
// —— NOVEDADES R8-8 (EPIC 5.1 + 5.2, aditivo, firmas export intactas) ——
//
// NUBES V3 — TRES CAPAS con parallax real ligado al viento:
//  · CAPA 0 ALTA : wisps finos alargados (2-4 lóbulos elípticos), viento
//    ×1.7, parallax bajo (0.24/0.20 — muy lejos), alpha tenue. NO proyecta
//    sombra en suelo (demasiado alta).
//  · CAPA 1 MEDIA: cúmulos lobulados de la v2 (misma semilla → mismas
//    formas por mapa), viento ×1.0, parallax 0.42/0.38, alpha plena.
//  · CAPA 2 BAJA : panzas grandes y blandas, viento ×0.55, parallax alto
//    (0.58/0.52 — cerca de cámara), alpha baja (tenues), sombra ancha.
//  BORDES SUAVES (pixel-art): cada nube se HORNEA por (nube, capa, franja)
//  con 4 tonos: halo dither Bayer 25% del tono base (borde que se disuelve),
//  sombra de base, cuerpo y CANTO ILUMINADO hacia EL SOL — la cara al sol
//  se desplaza según la etapa (este=+x al alba, oeste=-x al ocaso,
//  cenit al mediodía — MISMA convención que lighting.ts) y toma el color
//  de la franja (rosa amanecer / blanco mediodía / ámbar tarde).
//  SOMBRA EN SUELO (5.1): silueta opaca + penumbra dither horneadas por
//  nube; drawCloudShadows las pinta desplazadas abajo-derecha con alpha
//  por capa. ENGANCHE YA VIVO en render.ts (línea ~173): entra en el pase
//  agrupado del suelo (bajo entidades, con el filtro de época) — lighting
//  NO necesita cambios (las sombras son atmósfera, no luz).
//  DERIVA CONTINUA: dirección/velocidad base por hash(mapId) + VAIVÉN del
//  VIENTO DEL MUNDO (weatherWindAt de weather.ts — el mismo viento que
//  sienten lluvia/niebla/hierba) sumado como offset continuo
//  (derivaBase·t + vientoActual·k, patrón fog de weather.ts: sin saltos).
//
// ESTRELLAS V3 — tres activos horneados UNA vez por tamaño de vista:
//  · STAR_LAYERS (3 canvas): campo estático (posiciones hash2 intactas de
//    R5-O4), deriva+parallax por drawImage envuelto.
//  · VÍA LÁCTEA (5.2): ~240 motas diminutas (alpha 0.03-0.14) acumuladas
//    alrededor de un eje SINUSOIDAL de 1 periodo — periódico ⇒ el envuelve
//    horizontal no tiene costura — + polvo muy tenue de relleno. Horneada
//    una vez, 4 drawImage con offset envuelto.
//  · TITILEO INDIVIDUAL (5.2): tabla TWIN de 44 motas con fase/periodo
//    propios (hash2 de su posición), 55% atraídas a la banda (densidad
//    variable por zona), umbral de aparición por estrella (entran al
//    atardecer, todas de noche) y DESTELLO DE COLOR en el pico del seno
//    (azulada/cálida según su temperatura). ≤40 fillRect por frame.
//  · DENSIDAD v4 (R9-3): al hornear, un campo de densidad agrupa las
//    estrellas hacia la Vía Láctea y abre vacíos suaves; la banda lechosa
//    gana cúmulos granulares y su Gran Grieta oscura.
//  · ESTRELLA FUGAZ v3 (R9-3): brillo que DECAE (vida 0.55-1.0 s), cabeza
//    con halo + cruz de destello, 10 eslabones que se afinan/enfrían y
//    3 chispas rezagadas. Sigue: ≤1 visible (vida ≪ ventana de 40 s).
//  En el MUNDO la vía láctea + titileo corren dentro de drawDayNightGrade
//  (bajo drawAmbient 'sky' de fx.ts, módulo intocado, que pinta después).
//
// ESCALADO por perfQuality() (R5-O1): presupuesto de nubes por capa,
// sombras y motas de titileo según escalón (alta/media/baja). Los horneados
// no dependen del escalón (el coste por frame vive en los draws).
//
// —— Historial ——
//  R4-A2: nubes v2 multi-blob, grading continuo, fugaz, niebla de alba.
//  R5-O4: estrellas pre-renderizadas, plan de nubes prealocado, strings
//         rgba cacheados, bandas escaladas a VIEW_H dinámico.
//  R8-8 : nubes en 3 capas con viento del mundo, halo dither + cara al sol,
//         penumbra en sombras, vía láctea, titileo individual, fugaz v2,
//         presupuestos por perfQuality.
//  R9-3 : fugaz v3 (decae, halo + cruz + chispas), densidad por bandas
//         (clústeres + vacíos), Vía Láctea con cúmulos y Gran Grieta,
//         vientre cálido de nubes al alba/atardecer y luna FASEADA por
//         día del mundo (moonPhaseIndexAt, enganche de lectura para fx.ts).
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
import { weatherWindAt } from './weather'; // viento del mundo (lluvia/niebla/hierba)
import { perfQuality } from '../perf';     // escalón adaptativo 0=alta · 1=media · 2=baja

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
    cloudBody: '#7c5a70', cloudHi: '#e0a08a', cloudLo: '#54405c',
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
    cloudBody: '#453a6a', cloudHi: '#8a5f7c', cloudLo: '#312a54',
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

// R9-3 — VIENTRE CÁLIDO de las nubes en horas de sol bajo: la luz rasante
// del alba/atardecer tiñe la panza (arco inferior horneado + línea de base
// en las planas). null = sin vientre (mediodía/noche). Lado hacia el sol.
const BELLY: (string | null)[] = ['#d98a6e', null, '#e8b083', '#8a5a6e', null];
const BELLY_DX = [1, 0, -1, -1, 0];

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
 * hash2 devuelve SIEMPRE en [0, 0.5) (el producto float del hash deja el
 * bit alto estructuralmente a 0). hnorm re-escala a [0, 1) para que los
 * UMBRALES comparados contra hash2 (colores cálidos, excepciones, lado de
 * caída de la fugaz, densidad…) se comporten como fueron escritos — varios
 * comparaban contra >0.5 y eran rama muerta. Determinista, coste 0.
 */
function hnorm(v: number): number {
  return v * 2;
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
//  pero el patrón sigue sirviendo al halo lunar, a la niebla de amanecer,
//  a los HALOS de nube v3 y a la PENUMBRA de las sombras de suelo.)

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

// ---------------- Luna (halo dithered + FASE por día del mundo, R9-3) ----------------
// El HALO es atmósfera: circular siempre (3 anillos dither, más suave que la
// v1). El DISCO se hornea por FASE (8 fases, determinista por el día del
// mundo: floor(globalT/240) — ciclo de 240 s del motor) con terminador
// pixelado: sobre una copia del cuerpo se BORRA (destination-out) un disco
// del mismo radio desplazado, dejando iluminado el ancho 2R·MOON_LIT[p].
// Luna nueva: disco casi invisible con "luz de ceniza" (alpha 0.16).
// NOTA: la luna del MUNDO la pinta fx.ts (drawAmbient 'sky', módulo ajeno);
// esta es la del BACKDROP (título/transiciones). moonPhaseIndexAt queda
// exportada como enganche de lectura para que fx.ts alinee su fase.

const MOON_R = 22;                                        // radio del disco
const MOON_LIT = [1, 0.78, 0.5, 0.25, 0, 0.25, 0.5, 0.78]; // fracción iluminada por fase
const MOON_GLOW = [1, 1, 1, 1, 0.16, 1, 1, 1];             // alpha del disco (4 = ceniza)

let moonHaloCv: HTMLCanvasElement | null = null;
let moonBodyCv: HTMLCanvasElement | null = null;
const moonPhaseCv: (HTMLCanvasElement | null)[] = [null, null, null, null, null, null, null, null];

/** Círculo pixelado por filas de 2 px (borde en escalones, NO arc liso). */
function stepCircle(x: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy < r; dy += 2) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - (dy + 1) * (dy + 1))) / 2) * 2;
    x.fillRect(cx - half, cy + dy, half * 2, 2);
  }
}

function buildMoonHalo(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 120; c.height = 120;
  const cc = c.getContext('2d')!;
  // halo dithered: 3 anillos escalonados (corona 25% + 25% + 50% interior)
  cc.fillStyle = ditherPattern(cc, 'rgba(208,220,255,0.05)', 0b0001);
  stepCircle(cc, 60, 60, 52);
  cc.fillStyle = ditherPattern(cc, 'rgba(208,220,255,0.10)', 0b0001);
  stepCircle(cc, 60, 60, 46);
  cc.fillStyle = ditherPattern(cc, 'rgba(208,220,255,0.16)', 0b0011);
  stepCircle(cc, 60, 60, 34);
  return c;
}

function buildMoonBody(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = MOON_R * 2; c.height = MOON_R * 2;
  const cc = c.getContext('2d')!;
  const cx = MOON_R, cy = MOON_R;
  // cuerpo escalonado
  cc.fillStyle = '#e9edf5';
  stepCircle(cc, cx, cy, MOON_R);
  // cráteres (mismos de la v1)
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

/** Disco horneado para la fase p (0 llena … 4 nueva … 7 gibosa creciente).
 *  Terminador: se borra (destination-out) un disco del mismo radio centrado
 *  de modo que el ancho iluminado sea 2R·MOON_LIT[p]; la menguante (1-3)
 *  ilumina por el oeste (izquierda) y la creciente (5-7) por el este — la
 *  misma convención este/oeste del sol en lighting.ts. Borde pixelado. */
function getMoonPhase(p: number): HTMLCanvasElement {
  const hit = moonPhaseCv[p];
  if (hit) return hit;
  if (!moonBodyCv) moonBodyCv = buildMoonBody();
  const c = document.createElement('canvas');
  c.width = MOON_R * 2; c.height = MOON_R * 2;
  const cc = c.getContext('2d')!;
  cc.drawImage(moonBodyCv, 0, 0);
  const lit = MOON_LIT[p];
  if (lit > 0.005 && lit < 0.995) {
    const d = 2 * MOON_R * lit;                            // ancho iluminado
    const sx = p >= 5 ? MOON_R - d : MOON_R + d;           // centro del disco de sombra
    cc.globalCompositeOperation = 'destination-out';
    cc.fillStyle = '#000';
    stepCircle(cc, sx, MOON_R, MOON_R);
    cc.globalCompositeOperation = 'source-over';
  }
  moonPhaseCv[p] = c;
  return c;
}

/** Luna con halo y fase (backdrop): 2 drawImage, alpha por fase. */
function drawMoon(ctx: CanvasRenderingContext2D, mx: number, my: number, alpha: number, phase: number): void {
  if (alpha <= 0.01) return;
  if (!moonHaloCv) moonHaloCv = buildMoonHalo();
  ctx.globalAlpha = alpha * 0.9;
  ctx.drawImage(moonHaloCv, mx - 60, my - 60);
  ctx.globalAlpha = alpha * MOON_GLOW[phase];
  ctx.drawImage(getMoonPhase(phase), mx - MOON_R, my - MOON_R);
  ctx.globalAlpha = 1;
}

/** Fase lunar determinista por DÍA DEL MUNDO (ciclo de 240 s → 8 fases):
 *  0 llena · 1-3 mengvante · 4 nueva · 5-7 creciente. Enganche de lectura
 *  opcional para fx.ts (la luna del mundo) — coste 0. */
export function moonPhaseIndexAt(globalT: number): number {
  const day = Math.floor(Math.max(0, globalT) / 240);
  return day % 8;
}

// ============================================================
// NUBES V3 (R8-8 · EPIC 5.1) — tres capas con parallax real
// ------------------------------------------------------------
// Cada capa se hornea por (nube, capa, franja) a un canvas caché:
//   halo dither (borde suave) → sombra de base → cuerpo → canto al sol.
// El VIENTO base sale del hash del mapId (dirección + velocidad) y cada
// capa lo escala (alta rápida · baja lenta); encima, el VIENTO DEL MUNDO
// (weatherWindAt — el mismo de lluvia/niebla/hierba) añade un vaivén
// horizontal CONTINUO (offset = vientoActual·k, nunca viento·t: sin
// teleports cuando el viento bascula). Todas envuelven por los bordes.
// ============================================================

interface CloudBlob { cx: number; cy: number; rx: number; ry: number }

interface CloudGeom {
  w: number; h: number;                       // tamaño del canvas pre-pintado
  baseY: number;                              // línea plana de la base
  blobs: CloudBlob[];
  flat: boolean;                              // lleva banda plana (capas 1-2)
}

interface CloudState {
  x: number; y: number;                       // nube "virtual" (pantalla)
  w: number; h: number;                       // tamaño del canvas
  shX: number; shY: number;                   // sombra en suelo (desplazada)
  layer: number;                              // 0 alta · 1 media · 2 baja
  ci: number;                                 // índice de nube DENTRO de su capa
  alpha: number;                              // alpha de cuerpo (× dayF al pintar)
}

const geomCache = new Map<string, CloudGeom>();
const cloudBodyCache = new Map<string, HTMLCanvasElement>();
const cloudShadowCache = new Map<string, HTMLCanvasElement>();

/** Margen del canvas para que el halo dither no se recorte. */
const CLOUD_PAD = 6;

/** Semilla numérica estable a partir del mapId. */
function seedFromMapId(mapId: string): number {
  let s = 7;
  for (let i = 0; i < mapId.length; i++) s = (s * 131 + mapId.charCodeAt(i)) >>> 0;
  return s;
}

/** Elipse pixelada por filas de 2 px (borde en escalones, NO arc liso). */
function stepEllipse(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  if (rx <= 0 || ry <= 0) return;
  for (let dy = -ry; dy < ry; dy += 2) {
    const k = 1 - ((dy + 1) * (dy + 1)) / (ry * ry);
    if (k <= 0) continue;
    const half = Math.floor((rx * Math.sqrt(k)) / 2) * 2;
    if (half <= 0) continue;
    x.fillRect(cx - half, cy + dy, half * 2, 2);
  }
}

/** Medio-arco SUPERIOR elíptico desplazable (canto iluminado hacia el sol). */
function stepCapTop(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  if (rx <= 2 || ry <= 2) return;
  for (let dy = -ry; dy < -1; dy += 2) {
    const k = 1 - ((dy + 1) * (dy + 1)) / (ry * ry);
    if (k <= 0) continue;
    const half = Math.floor((rx * Math.sqrt(k)) / 2) * 2;
    if (half <= 0) continue;
    x.fillRect(cx - half, cy + dy, half * 2, 2);
  }
}

/** Arco INFERIOR elíptico (vientre cálido de la nube en horas de sol bajo,
 *  R9-3): 2 filas de 2 px pegadas al borde bajo de la elipse. */
function stepCapBottom(x: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  if (rx <= 2 || ry <= 5) return;
  for (let dy = ry - 2; dy >= ry - 4; dy -= 2) {
    const k = 1 - (dy * dy) / (ry * ry);
    if (k <= 0) continue;
    const half = Math.floor((rx * Math.sqrt(k)) / 2) * 2;
    if (half <= 0) continue;
    x.fillRect(cx - half, cy + dy, half * 2, 2);
  }
}

// Cara al sol por franja (convención de lighting.ts: el sol nace por el
// ESTE = +x y se pone por el OESTE = -x; cenit al mediodía): desplazamiento
// del canto iluminado — amanecer rosa al este, mediodía blanco arriba,
// tarde ámbar al oeste.
const SUN_DX = [1, 0, -1, -1, 0];
const SUN_DY = [1, -2, 1, -1, -1];

/** Geometría lobulada de la nube j de la capa L (cacheada).
 *  CAPA 1 replica EXACTAMENTE los hashes de la v2 → mismos cúmulos. */
function cloudGeom(seed: number, j: number, layer: number): CloudGeom {
  const key = seed + '|' + j + '|' + layer;
  const hit = geomCache.get(key);
  if (hit) return hit;
  const s = seed * 16 + j;
  const blobs: CloudBlob[] = [];
  let w: number, maxRy = 3, flat = true;

  if (layer === 0) {
    // —— wisps: finos, alargados, escalables hacia lo alto ——
    flat = false;
    const sc = 0.55 + hash2(s, 943) * 0.35;                    // 0.55..0.9
    const nB = 2 + Math.floor(hash2(s, 947) * 3);              // 2..4 lóbulos
    w = Math.max(70, Math.round((120 + hash2(s, 949) * 90) * sc));
    for (let b = 0; b < nB; b++) {
      const rx = Math.max(10, Math.round((20 + hash2(s * 4 + b, 953) * 18) * sc));
      const ry = Math.max(2, Math.round(rx * (0.22 + hash2(s * 4 + b, 955) * 0.14)));
      if (ry > maxRy) maxRy = ry;
      blobs.push({ cx: 0, cy: 0, rx, ry });
    }
  } else if (layer === 1) {
    // —— cúmulos lobulados clásicos (herencia v2) ——
    const sc = 0.8 + hash2(s, 943) * 0.8;                      // 0.8..1.6
    const nB = 3 + Math.floor(hash2(s, 947) * 4);              // 3..6 blobs
    w = Math.max(64, Math.round((80 + hash2(s, 949) * 120) * sc));
    for (let b = 0; b < nB; b++) {
      const r = Math.max(8, Math.round((10 + hash2(s * 4 + b, 953) * 15) * sc));
      if (r > maxRy) maxRy = r;
      blobs.push({ cx: 0, cy: 0, rx: r, ry: r });
    }
  } else {
    // —— panzas bajas: grandes, redondas, blandas ——
    const sc = 1.35 + hash2(s, 943) * 0.65;                    // 1.35..2.0
    const nB = 3 + Math.floor(hash2(s, 947) * 2);              // 3..4 blobs
    w = Math.max(90, Math.round((100 + hash2(s, 949) * 90) * sc));
    for (let b = 0; b < nB; b++) {
      const rx = Math.max(14, Math.round((20 + hash2(s * 4 + b, 953) * 16) * sc));
      const ry = Math.max(10, Math.round(rx * (0.66 + hash2(s * 4 + b, 955) * 0.22)));
      if (ry > maxRy) maxRy = ry;
      blobs.push({ cx: 0, cy: 0, rx, ry });
    }
  }

  const baseY = 2 * maxRy + 4 + CLOUD_PAD;                     // cabe el lóbulo más alto + halo
  for (let b = 0; b < blobs.length; b++) {
    const bl = blobs[b];
    const t = blobs.length > 1 ? b / (blobs.length - 1) : 0.5; // reparto horizontal
    bl.cx = Math.round(CLOUD_PAD + bl.rx + (w - 2 * bl.rx) * t);
    bl.cy = Math.round(baseY - bl.ry + (hash2(s * 4 + b, 957) - 0.5) * 5); // panzas casi alineadas
  }
  const gm: CloudGeom = { w: w + CLOUD_PAD * 2, h: baseY + 8, baseY, blobs, flat };
  geomCache.set(key, gm);
  return gm;
}

/** Canvas pre-pintado del cuerpo de la nube (por capa y franja del día).
 *  4 tonos horneados: halo dither → sombra base → cuerpo → canto al sol. */
function getCloudBody(seed: number, j: number, layer: number, stIdx: number): HTMLCanvasElement {
  const key = seed + '|' + j + '|' + layer + '|' + stIdx;
  let c = cloudBodyCache.get(key);
  if (!c) {
    if (cloudBodyCache.size > 200) cloudBodyCache.clear();     // techo de memoria
    const gm = cloudGeom(seed, j, layer);
    const st = DAY_STAGES[stIdx];
    c = document.createElement('canvas');
    c.width = gm.w; c.height = gm.h;
    const cc = c.getContext('2d')!;
    const hx = SUN_DX[stIdx], hy = SUN_DY[stIdx];
    // 0) HALO DITHER: el borde exterior se disuelve en el cielo (25% Bayer)
    cc.fillStyle = ditherPattern(cc, layer === 0 ? st.cloudBody : st.cloudLo, 0b0001);
    for (const b of gm.blobs) stepEllipse(cc, b.cx, b.cy, b.rx + 4, b.ry + 4);
    if (gm.flat) {
      // 1) sombra de la base: blobs +3/4 px y banda plana baja (canto inferior)
      cc.fillStyle = st.cloudLo;
      const dy = layer === 2 ? 4 : 3;
      for (const b of gm.blobs) stepEllipse(cc, b.cx, b.cy + dy, b.rx, b.ry);
      cc.fillRect(CLOUD_PAD, gm.baseY - 2, gm.w - CLOUD_PAD * 2, 4);
      // 2) cuerpo
      cc.fillStyle = st.cloudBody;
      for (const b of gm.blobs) stepEllipse(cc, b.cx, b.cy, b.rx, b.ry);
      cc.fillRect(CLOUD_PAD, gm.baseY - 8, gm.w - CLOUD_PAD * 2, 8);
    } else {
      // wisps: solo cuerpo (sin banda plana — flotan)
      cc.fillStyle = st.cloudBody;
      for (const b of gm.blobs) stepEllipse(cc, b.cx, b.cy, b.rx, b.ry);
    }
    // 3) CANTO ILUMINADO hacia EL SOL (color de la franja: rosa al alba,
    //    blanco al mediodía, ámbar por la tarde — samplea la etapa actual)
    if (st.cloudHi) {
      cc.fillStyle = st.cloudHi;
      for (const b of gm.blobs) {
        const rx = Math.max(3, b.rx - 2), ry = Math.max(2, b.ry - 1);
        stepCapTop(cc, b.cx + Math.round(b.rx * 0.22) * hx, b.cy + hy, rx, ry);
      }
    }
    // 4) VIENTRE CÁLIDO (R9-3): al alba/atardecer la luz rasante tiñe la
    //    panza — arco inferior hacia el sol bajo + línea de base cálida en
    //    las nubes planas. Horneado: coste por frame = 0.
    const belly = BELLY[stIdx];
    if (belly) {
      cc.fillStyle = belly;
      const bdx = BELLY_DX[stIdx];
      for (const b of gm.blobs) {
        stepCapBottom(cc, b.cx + Math.round(b.rx * 0.16) * bdx, b.cy, Math.max(3, b.rx - 3), b.ry + 1);
      }
      if (gm.flat) cc.fillRect(CLOUD_PAD + 2, gm.baseY - 1, gm.w - CLOUD_PAD * 2 - 4, 2);
    }
    cloudBodyCache.set(key, c);
  }
  return c;
}

/** Silueta opaca + PENUMBRA dither (para la sombra de suelo con alpha
 *  uniforme y borde blando). Solo capas 1-2 proyectan sombra. */
function getCloudShadow(seed: number, j: number, layer: number): HTMLCanvasElement {
  const key = seed + '|' + j + '|' + layer;
  let c = cloudShadowCache.get(key);
  if (!c) {
    if (cloudShadowCache.size > 60) cloudShadowCache.clear();
    const gm = cloudGeom(seed, j, layer);
    c = document.createElement('canvas');
    c.width = gm.w; c.height = gm.h;
    const cc = c.getContext('2d')!;
    cc.fillStyle = ditherPattern(cc, '#000014', 0b0011);       // penumbra 50%
    for (const b of gm.blobs) stepEllipse(cc, b.cx, b.cy, b.rx + 4, b.ry + 4);
    cc.fillStyle = '#000014';                                  // núcleo (= rgba(0,0,20,…) de la v1)
    for (const b of gm.blobs) stepEllipse(cc, b.cx, b.cy, b.rx, b.ry);
    if (gm.flat) cc.fillRect(CLOUD_PAD, gm.baseY - 8, gm.w - CLOUD_PAD * 2, 8);
    cloudShadowCache.set(key, c);
  }
  return c;
}

// —— Perfil por capa: [ALTA, MEDIA, BAJA] ——
const L_WIND = [1.7, 1.0, 0.55];       // × viento base del mapa (alta rápida)
const L_SWAY = [1.35, 1.0, 0.6];       // × viento del mundo (weatherWindAt)
const L_PARX = [0.24, 0.42, 0.58];     // parallax camX (lejos → cerca)
const L_PARY = [0.2, 0.38, 0.52];
const L_ALPHA = [0.4, 0.62, 0.3];      // alpha del cuerpo (media = la v2)
const L_SHAL = [0, 0.075, 0.055];      // alpha de sombra en suelo (0 = ninguna)
const L_SHOFF = [0, 1, 1.5];           // × desplazamiento de la sombra
// Presupuestos por escalón de perfQuality() (0 alta · 1 media · 2 baja):
const CLOUD_CAP: readonly number[][] = [[4, 5, 3], [3, 4, 2], [0, 4, 0]];
const SHADOW_CAP: readonly number[][] = [[0, 5, 3], [0, 4, 2], [0, 4, 0]];

/** Memoización del plan (drawCloudShadows + drawDayNightGrade lo piden en el
 *  MISMO frame con los mismos argumentos → cero trabajo repetido).
 *  R5-O4: estados PREALOCADOS (se mutan in situ) y memo por campos —
 *  antes se construía un string-clave y un objeto CloudState por frame. */
const PLAN_MAX = 12;
const planArr: CloudState[] = Array.from({ length: PLAN_MAX }, () => (
  { x: 0, y: 0, w: 0, h: 0, shX: 0, shY: 0, layer: 1, ci: 0, alpha: 0 }
));
const planStart = [0, 0, 0];           // índice global de la 1ª nube de cada capa
let planMapId = '', planT = -1, planCX = -1, planCY = -1;

/**
 * Estado determinista de la flota de nubes de un mapa (3 CAPAS, 9-12 nubes).
 * CAPA 0 alta (wisps finos y rápidos) · CAPA 1 media (lobuladas, la flota
 * v2) · CAPA 2 baja (panzas tenues, grandes y lentas). VIENTO: dirección/
 * velocidad por hash(mapId) escalado por capa + VAIVÉN del viento del mundo
 * (weatherWindAt) como offset continuo. Wrapper: las posiciones envuelven
 * en X e Y (salen por un borde y entran por el opuesto). La sombra queda
 * desplazada hacia abajo-derecha (sol arriba-izquierda) según capa.
 */
export function cloudPlanAt(mapId: string, globalT: number, camX: number, camY: number): CloudState[] {
  if (planMapId === mapId && planT === globalT && planCX === camX && planCY === camY) return planArr;
  planMapId = mapId; planT = globalT; planCX = camX; planCY = camY;
  const seed = seedFromMapId(mapId);
  const wAng = hash2(seed, 911) * TAU;                         // dirección del viento
  const wSpd = 7 + hash2(seed, 913) * 9;                       // 7..16 px/s
  const wX = Math.cos(wAng) * wSpd;
  const wY = Math.sin(wAng) * wSpd;
  // VIENTO DEL MUNDO (−26..26 px/s): el mismo que dobla la lluvia y arrastra
  // la niebla. Va como OFFSET continuo (velocidad·k), nunca ×t → sin saltos.
  const wWorld = weatherWindAt(mapId, globalT);
  const M = 40;                                                // margen fuera de pantalla
  const L_BASE = [31, 0, 67];                                  // desacopla las capas (media = v2)
  const L_NSEED = [901, 903, 907];                             // 3-4 altas · 4-5 medias · 2-3 bajas
  let n = 0;
  for (let L = 0; L < 3; L++) {
    planStart[L] = n;
    const nL = 3 + Math.floor(hash2(seed, L_NSEED[L]) * 2);
    for (let j = 0; j < nL && n < PLAN_MAX; j++) {
      const s = seed * 16 + L_BASE[L] + j;
      const f = 0.75 + hash2(s, 931) * 0.5;                    // factor de viento por nube
      const gm = cloudGeom(seed, j, L);
      // wrapper: span = vista + 2*(nube + margen) → sale entera y entra entera
      const spanX = VIEW_W + 2 * (gm.w + M);
      const spanY = VIEW_H + 2 * (gm.h + M);
      const bx = hash2(s, 933) * spanX;
      const by = hash2(s, 937) * spanY;
      const x = Math.round(mod(
        bx + wX * L_WIND[L] * f * globalT + wWorld * L_SWAY[L] * f - camX * L_PARX[L],
        spanX,
      ) - (gm.w + M));
      const y = Math.round(mod(
        by + wY * L_WIND[L] * f * globalT - camY * L_PARY[L],
        spanY,
      ) - (gm.h + M));
      const off = 12 + hash2(s, 941) * 8;                      // 12..20 px (euclídeo)
      const ox = Math.round(off * 0.6 * L_SHOFF[L]);           // dirección (0.6, 0.8)
      const oy = Math.round(off * 0.8 * L_SHOFF[L]);
      const st = planArr[n];
      st.x = x; st.y = y; st.w = gm.w; st.h = gm.h;
      st.shX = x + ox; st.shY = y + oy;
      st.layer = L; st.ci = j; st.alpha = L_ALPHA[L];
      n++;
    }
  }
  planArr.length = n;                                          // ranuras prealocadas
  return planArr;
}

/** Factor de día de las nubes (0 fuera de 0.08-0.70, rampa en los bordes). */
function cloudDayFactor(dT: number): number {
  if (dT < 0.08 || dT > 0.70) return 0;                        // coherente con isNight()
  if (dT < 0.12) return (dT - 0.08) / 0.04;                    // rampa al alba
  if (dT > 0.64) return (0.70 - dT) / 0.06;                    // rampa al anochecer
  return 1;
}

/** Pinta el cuerpo de una nube v3, mezclando las dos franjas si hay transición. */
function drawCloudBlend(
  ctx: CanvasRenderingContext2D, seed: number, st: CloudState,
  siA: number, siB: number, m: number, alpha: number,
): void {
  if (alpha <= 0.004) return;
  ctx.globalAlpha = alpha * (1 - m);
  ctx.drawImage(getCloudBody(seed, st.ci, st.layer, siA), st.x, st.y);
  if (m > 0.002) {
    ctx.globalAlpha = alpha * m;
    ctx.drawImage(getCloudBody(seed, st.ci, st.layer, siB), st.x, st.y);
  }
  ctx.globalAlpha = 1;
}

// ---------------- Estrella fugaz (R4-A2 · v2 R8-8 · v3 R9-3) ----------------
// Ventana temporal determinista: cada SHOOT_PERIOD s de globalT hay a lo sumo
// UNA estrella fugaz (instante, duración, posición, dirección y chispas por
// hash de la ventana k). Vida 0.55-1.0 s ≪ ventana ⇒ NUNCA hay dos en
// pantalla. El brillo DECAE (rampa de entrada + caída (1-u)^1.35, ya no el
// seno simétrico de la v2). NOTA: las estrellas fijas viven en fx.ts
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
  const dur = 0.55 + hnorm(hash2(k * 7 + 1, 991)) * 0.45;             // vida 0.55..1.0 s (R9-3)
  const t0 = hnorm(hash2(k * 11 + 3, 993)) * (SHOOT_PERIOD - dur - 1.2); // instante (margen 1.2 s)
  const u = (T - k * SHOOT_PERIOD - t0) / dur;
  if (u < 0 || u > 1) return null;
  const dir = hnorm(hash2(k * 17 + 7, 1009)) > 0.5 ? 1 : -1;   // caída a izq. o der.
  const spd = 150 + hnorm(hash2(k * 19 + 9, 1013)) * 80;       // 150..230 px/s
  SHOOT_RES.x = 70 + hnorm(hash2(k * 13 + 5, 997)) * (VIEW_W - 240);
  SHOOT_RES.y = 20 + hnorm(hash2(k * 23 + 15, 1019)) * 120;
  SHOOT_RES.dx = dir * spd * 0.86;
  SHOOT_RES.dy = spd * 0.5;
  SHOOT_RES.u = u;
  return SHOOT_RES;
}

// Trazo v3 (R9-3): cabeza blanca con halo blando + cruz de destello en el
// primer tramo, estela de 10 eslabones que se afinan y enfrían (blanco →
// azul pálido) y 3 chispas rezagadas con deriva perpendicular (hash de la
// ventana). El BRILLO DECAE: entrada rápida (~0.11 s) y caída (1-u)^1.35.
// ≤17 fillRect SOLO mientras vive (≈1 s cada 40 s); cero allocations.
const SS_SEG_A = [1, 0.74, 0.55, 0.4, 0.28, 0.19, 0.12, 0.07, 0.04, 0.02]; // alpha cabeza→cola
const SS_SEG_W = [2, 2, 2, 1, 1, 1, 1, 1, 1, 1];                           // se afina
const SS_SEG_C = ['#ffffff', '#ffffff', '#eaf1ff', '#dbe7ff', '#c9d9fa', '#b6cbf2', '#a4bce6', '#93aed8', '#84a0c8', '#7590b8'];
const SS_SPARK = [10, 17, 26];                                             // retardo de chispas (px)

function drawShootingStar(ctx: CanvasRenderingContext2D, globalT: number, gate: number): void {
  const s = shootingStarAt(globalT);
  if (!s || gate <= 0.01) return;
  const k = Math.floor(Math.max(0, globalT) / SHOOT_PERIOD);
  const fade = Math.min(1, s.u * 9) * Math.pow(1 - s.u, 1.35) * gate;  // brillo que decae
  if (fade <= 0.012) return;
  const len = Math.hypot(s.dx, s.dy);
  const ux = s.dx / len, uy = s.dy / len;
  const p = Math.round(s.x + s.dx * s.u), q = Math.round(s.y + s.dy * s.u);
  // halo blando de la cabeza
  ctx.globalAlpha = fade * 0.22;
  ctx.fillStyle = '#8fa8dc';
  ctx.fillRect(p - 2, q - 1, 5, 3);
  // cabeza 2×2 + cruz de destello en el primer tramo
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(p - 1, q - 1, 2, 2);
  if (s.u < 0.45) {
    ctx.globalAlpha = fade * 0.5;
    ctx.fillRect(p - 3, q, 7, 1);
    ctx.fillRect(p, q - 3, 1, 7);
  }
  // estela: se aleja de la cabeza afinándose y enfriándose
  for (let j = 0; j < 10; j++) {
    const a = SS_SEG_A[j] * fade * 0.9;
    if (a <= 0.012) break;
    const d = 3 + j * 2.6;
    ctx.globalAlpha = a;
    ctx.fillStyle = SS_SEG_C[j];
    ctx.fillRect(Math.round(p - ux * d), Math.round(q - uy * d), SS_SEG_W[j], SS_SEG_W[j]);
  }
  // chispas rezagadas (deriva perpendicular por hash de la ventana)
  ctx.fillStyle = '#cfe0ff';
  for (let e = 0; e < 3; e++) {
    const a = fade * 0.4 * (1 - e * 0.27);
    if (a <= 0.012) break;
    const d = SS_SPARK[e] + hash2(k * 31 + e * 7 + 3, 1031) * 8;
    const jw = (hash2(k * 37 + e * 11 + 5, 1033) - 0.5) * 5;
    ctx.globalAlpha = a;
    ctx.fillRect(Math.round(p - ux * d - uy * jw), Math.round(q - uy * d + ux * jw), 1, 1);
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

// R16 · Niebla de amanecer v2: BANCOS DE NIEBLA suaves en vez de las
// bandas Bayer de borde duro (se leían como un fallo de render: franjas
// tramadas grises de lado a lado de la pantalla con canto recto). Cada
// banco es una tira horneada UNA vez (elipses con degradado radial,
// enlosable en horizontal: cada mancha se pinta también desplazada ±W),
// que deriva con el tiempo y con parallax de cámara → la niebla se queda
// en el valle mientras el Portador camina, en lugar de ir pegada al
// cristal. Bordes que se disuelven arriba y abajo, cero fillRect duros.
const MIST_BANDS = [
  { fy: 0.62, a: 0.55, spd: 5, dir: 1, par: 0.25, seed: 3 },
  { fy: 0.74, a: 0.70, spd: 9, dir: -1, par: 0.45, seed: 11 },
  { fy: 0.86, a: 0.85, spd: 14, dir: 1, par: 0.7, seed: 23 },
];
const MIST_W = 512, MIST_H = 72;
const mistStrips: (HTMLCanvasElement | null)[] = [null, null, null];

function buildMistStrip(seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = MIST_W; c.height = MIST_H;
  const x = c.getContext('2d')!;
  const n = 14;
  for (let k = 0; k < n; k++) {
    const cx = (k + hash2(seed * 7 + k, 3) * 2) * (MIST_W / n);
    const cy = MIST_H * (0.42 + hash2(seed + k * 3, 9) * 0.32);
    const rx = 40 + hash2(k * 5 + seed, 13) * 50;
    const ry = 13 + hash2(k + seed * 3, 17) * 12;
    const al = 0.22 + hash2(k * 11, seed + 5) * 0.26;
    for (const off of [-MIST_W, 0, MIST_W]) {
      x.save();
      x.translate(cx + off, cy);
      x.scale(rx / ry, 1);
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, ry);
      gr.addColorStop(0, `rgba(220,230,240,${al.toFixed(3)})`);
      gr.addColorStop(0.55, `rgba(214,226,238,${(al * 0.55).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(214,226,238,0)');
      x.fillStyle = gr;
      x.beginPath(); x.arc(0, 0, ry, 0, Math.PI * 2); x.fill();
      x.restore();
    }
  }
  return c;
}

/** Niebla de amanecer: bancos de niebla suaves SOLO en lunaris (valle). */
function drawDawnMist(ctx: CanvasRenderingContext2D, g: Game, dT: number): void {
  if (g.mapId !== 'lunaris') return;                           // valle de Lunaris
  const p = dawnMistStrength(dT);
  if (p <= 0.005) return;
  const prevA = ctx.globalAlpha;
  for (let bi = 0; bi < MIST_BANDS.length; bi++) {
    const b = MIST_BANDS[bi];
    let strip = mistStrips[bi];
    if (!strip) { strip = buildMistStrip(b.seed); mistStrips[bi] = strip; }
    const ox = -mod(g.camX * b.par + g.globalT * b.spd * b.dir, MIST_W);
    const y = Math.round(VIEW_H * b.fy - MIST_H / 2);
    ctx.globalAlpha = prevA * b.a * p;
    for (let x0 = Math.floor(ox); x0 < VIEW_W; x0 += MIST_W) ctx.drawImage(strip, x0, y);
  }
  ctx.globalAlpha = prevA;
}

// ============================================================
// 1) drawSkyBackdrop — cielo completo para TITLE SCREEN y transiciones
//    Pinta: bandas de color INTERPOLADAS según franja del día, VÍA LÁCTEA,
//    estrellas en 3 capas PRE-RENDERIZADAS (R5-O4), titileo individual
//    (R8-8), luna escalonada con halo dithered, estrella fugaz rara y
//    nubes v3 en 3 capas derivando con el viento.
// ============================================================

// ---------------- Estrellas pre-renderizadas + VÍA LÁCTEA + titileo (R8-8) ----------------
// Tres activos horneados UNA vez por tamaño de vista (invalidación por
// starVW/starVH):  · STAR_LAYERS — 3 canvas estáticos (44 lejanas 1px +
// 26 cercanas 2px, posiciones hash2 INTACTAS; twinkle de capa alternante).
//  · milkyCv — banda de VÍA LÁCTEA: ~240 motas acumuladas alrededor de un
//    eje sinusoidal de 1 periodo (periódico ⇒ envuelve horizontal sin
//    costura) + polvo tenue de relleno; alpha bajo, sin gradiente.
//  · TWIN — tabla de 44 motas de titileo INDIVIDUAL: fase/periodo por
//    hash2 de su posición, 55% atraídas a la banda (densidad por zona),
//    umbral de aparición por estrella (entran al atardecer) y destello
//    de color (azulada/cálida) en el pico del seno.
// Coste nocturno por frame: 4 drawImage (vía láctea) + 12 drawImage (capas)
// + ≤40 fillRect (titileo, presupuesto por perfQuality). Cero allocations.

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

interface TwinStar {
  x: number; y: number; sz: number;  // posición estática + tamaño
  warm: boolean;                     // temperatura del color base
  flash: string | null;              // color del destello en el pico (o null)
  sp: number; ph: number;            // periodo/fase propios (rad/s)
  th: number;                        // umbral de nf para "salir" (0..0.5)
  base: number;                      // brillo base 0.55..1
}
const TWIN: TwinStar[] = [];
const TWIN_PAD = 40;                 // margen de envuelve de las motas
// Presupuesto de motas animadas por escalón de calidad:
const TWIN_BUDGET = [40, 28, 16];

let milkyCv: HTMLCanvasElement | null = null;

/** Campo de DENSIDAD estelar en coords normalizadas (R9-3, SOLO horneado):
 *  más denso hacia el eje sinusoidal de la Vía Láctea (misma forma que
 *  buildMilky, escalada por el fracY de la capa) + un vacío suave de baja
 *  frecuencia (frecuencia entera ⇒ el campo envuelve en X sin costura).
 *  Devuelve la probabilidad de que una candidata sobreviva al horneado. */
function starFieldDensity(nx: number, ny: number, fracY: number): number {
  const ax = (0.44 + Math.sin(nx * TAU) * 0.34) * fracY;      // eje de la banda
  const d = Math.abs(ny - ax) / (0.5 * fracY);
  let den = 0.4 + 0.55 * Math.max(0, 1 - d);                  // 0.4 base … 0.95 eje
  const v = Math.sin(nx * TAU * 2 + 0.9) * Math.sin((ny / fracY) * Math.PI * 1.7 + 0.4);
  if (v > 0.68) den *= 0.2;                                   // zona casi vacía
  return den;
}

/** Hornea la banda de VÍA LÁCTEA: motas diminutas acumuladas en un eje
 *  sinusoidal de 1 periodo por ancho (y(x+span)=y(x) ⇒ envuelve limpio)
 *  con caída de densidad desde el eje + polvo general muy tenue. */
function buildMilky(): HTMLCanvasElement {
  const span = VIEW_W + 80;
  const H = Math.max(120, Math.round(VIEW_H * 0.62));
  const cv = document.createElement('canvas');
  cv.width = span; cv.height = H;
  const cc = cv.getContext('2d')!;
  const A = H * 0.34;                    // amplitud del eje
  const MID = H * 0.44;                  // centro medio de la banda
  const HALF = H * 0.17;                 // semiancho de acumulación
  for (let k = 0; k < 240; k++) {
    const x = Math.floor(hash2(k * 3 + 2, 211) * span);
    const ax = MID + Math.sin((x / span) * TAU) * A;
    // distancia al eje triangular (2 hashes) → densidad hacia el centro
    const d = (hash2(k * 5 + 3, 223) + hash2(k * 7 + 5, 227) - 1) * HALF;
    const y = Math.round(ax + d);
    if (y < 0 || y >= H) continue;
    const fall = 1 - Math.abs(d) / (HALF * 1.15);
    const a = (0.05 + hash2(k * 11 + 7, 229) * 0.09) * Math.max(0.15, fall);
    cc.globalAlpha = a;
    cc.fillStyle = hnorm(hash2(k * 13 + 9, 233)) > 0.82 ? '#efe6f2' : '#ccd6ec';
    cc.fillRect(x, y, 1, 1);
    if (hnorm(hash2(k * 17 + 11, 239)) > 0.93) {                    // mota brillante suelta
      cc.globalAlpha = Math.min(1, a * 1.5);
      cc.fillStyle = '#e8eeff';
      cc.fillRect(x, y, 2, 1);
    }
  }
  // CÚMULOS GRANULARES (R9-3): 14 noditos de 5-9 motas pegados al eje —
  // la banda deja de ser niebla uniforme y gana "star-clouds".
  for (let cN = 0; cN < 14; cN++) {
    const cx2 = Math.floor(hash2(cN * 41 + 3, 263) * span);
    const ax2 = MID + Math.sin((cx2 / span) * TAU) * A;
    const cy2 = Math.round(ax2 + (hash2(cN * 43 + 7, 269) - 0.5) * HALF * 0.7);
    const n2 = 5 + Math.floor(hash2(cN * 47 + 11, 271) * 5);
    for (let q = 0; q < n2; q++) {
      const x = cx2 + Math.round((hash2(cN * 53 + q, 277) - 0.5) * 14);
      const y = cy2 + Math.round((hash2(cN * 59 + q, 281) - 0.5) * 8);
      if (x < 0 || x >= span || y < 0 || y >= H) continue;
      cc.globalAlpha = 0.07 + hash2(cN * 61 + q, 283) * 0.08;
      cc.fillStyle = hnorm(hash2(cN * 67 + q, 293)) > 0.8 ? '#efe6f2' : '#ccd6ec';
      cc.fillRect(x, y, 1, 1);
    }
  }
  // GRAN GRIETA (R9-3): polvo OSCURO pegado al eje — el rift realista de la
  // Vía Láctea (motas que oscurecen el cielo bajo ellas, alpha bajo).
  for (let k = 0; k < 42; k++) {
    const x = Math.floor(hash2(k * 71 + 5, 307) * span);
    const ax3 = MID + Math.sin((x / span) * TAU) * A;
    const y = Math.round(ax3 + (hash2(k * 73 + 9, 311) - 0.5) * HALF * 0.5);
    if (y < 0 || y >= H) continue;
    cc.globalAlpha = 0.14 + hash2(k * 79 + 13, 317) * 0.12;
    cc.fillStyle = '#070a18';
    cc.fillRect(x, y, 2, 1);
  }
  // polvo de relleno (pega la banda al resto del cielo, alpha muy bajo)
  for (let k = 0; k < 90; k++) {
    const x = Math.floor(hash2(k * 19 + 13, 241) * span);
    const y = Math.floor(hash2(k * 23 + 17, 251) * H);
    cc.globalAlpha = 0.03 + hash2(k * 29 + 19, 257) * 0.03;
    cc.fillStyle = '#c4cee4';
    cc.fillRect(x, y, 1, 1);
  }
  cc.globalAlpha = 1;
  return cv;
}

/** Tabla de motas de TITILEO INDIVIDUAL (fase/periodo/umbral por hash2). */
function buildTwinklers(): void {
  TWIN.length = 0;
  const span = VIEW_W + TWIN_PAD * 2;
  const bandH = Math.max(80, Math.round(VIEW_H * 0.66));
  const A = bandH * 0.34, MID = bandH * 0.44, HALF = bandH * 0.2;
  for (let k = 0; k < 44; k++) {
    const x = Math.round(TWIN_PAD + hash2(k * 7 + 3, 271) * (span - TWIN_PAD * 2));
    const inBand = hnorm(hash2(k * 11 + 5, 277)) < 0.55;     // densidad por zona
    let y: number;
    if (inBand) {
      const ax = MID + Math.sin((x / span) * TAU) * A;
      y = Math.round(ax + (hash2(k * 13 + 7, 281) + hash2(k * 17 + 9, 283) - 1) * HALF);
    } else {
      y = Math.round(Math.pow(hash2(k * 13 + 7, 281), 1.3) * bandH); // más denso al cenit
    }
    if (y < 0) y = 0; else if (y >= bandH) y = bandH - 1;
    const h = hnorm(hash2(k * 19 + 11, 293));
    const warm = h > 0.76;
    const flash = hnorm(hash2(k * 23 + 13, 307)) > 0.7 ? (warm ? '#ffd9a0' : '#a9c8ff') : null;
    TWIN.push({
      x, y,
      sz: h > 0.78 ? 2 : 1,
      warm,
      flash,
      sp: 0.7 + hash2(k * 29 + 17, 311) * 1.9,               // periodo 3.3..9 s
      ph: hash2(k * 31 + 19, 313) * TAU,
      th: hash2(k * 37 + 23, 317) * 0.5,                     // salen progresivamente
      base: 0.55 + hash2(k * 41 + 29, 331) * 0.45,
    });
  }
}

function buildStarLayers(): void {
  starVW = VIEW_W; starVH = VIEW_H;
  for (let L = 0; L < 3; L++) {
    const far = L === 0;
    // R9-3: candidatas ×~2.6 — el campo de densidad (clústeres + vacíos)
    // filtra al hornear; las supervivientes dan un cielo con masa y calvas.
    const n = far ? 112 : 36;                      // cercanas: candidatas en 2 sub-capas
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
      // —— DENSIDAD POR BANDAS (R9-3): la candidata sobrevive según el
      //    campo de densidad (más denso hacia la Vía Láctea, vacíos
      //    suaves); las muy brillantes (h3 > 0.93) pueden colarse en
      //    cualquier sitio, como en un cielo real. ——
      if (hnorm(hash2(i * 23 + 31, 137)) > starFieldDensity(h1, h2v, far ? 0.7 : 0.62) && hnorm(h3) <= 0.93) continue;
      if (far) {
        cc.globalAlpha = a;
        cc.fillStyle = hnorm(h3) > 0.85 ? '#ffe9c8' : '#dce4ff';
        cc.fillRect(x, y, 1, 1);
      } else {
        cc.globalAlpha = a;
        cc.fillStyle = hnorm(h3) > 0.8 ? '#fff3d8' : '#e6ecff';
        cc.fillRect(x, y, 2, 2);
        if (hnorm(h3) > 0.82) {                                  // cruz de destello
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
  milkyCv = buildMilky();
  buildTwinklers();
}

/** Invalidación perezosa de los activos estelares (cambia VIEW → re-hornea). */
function ensureStarAssets(): void {
  if (STAR_LAYERS[0].cv && starVW === VIEW_W && starVH === VIEW_H) return;
  buildStarLayers();
}

/** Vía Láctea: 4 drawImage con offset envuelto (deriva lenta + parallax). */
function drawMilky(ctx: CanvasRenderingContext2D, t: number, camX: number, camY: number, a: number): void {
  const cv = milkyCv;
  if (!cv || a <= 0.012) return;
  const W = cv.width, H = cv.height;
  const offX = mod(t * 1.1 + camX * 0.014, W);
  const offY = mod(camY * 0.012, H);
  ctx.globalAlpha = a;
  ctx.drawImage(cv, offX - W, offY - H);
  ctx.drawImage(cv, offX, offY - H);
  ctx.drawImage(cv, offX - W, offY);
  ctx.drawImage(cv, offX, offY);
  ctx.globalAlpha = 1;
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

/**
 * Titileo INDIVIDUAL (R8-8): cada mota oscila con su propio seno
 * (fase/periodo por hash2), aparece al cruzar su umbral de noche
 * (gate) y las que tienen `flash` lanzan una cruz de color en el pico.
 * ≤budget fillRect, cero allocations (colores constantes).
 */
function drawTwinklers(ctx: CanvasRenderingContext2D, t: number, nf: number, budget: number): void {
  const n = Math.min(TWIN.length, budget);
  for (let i = 0; i < n; i++) {
    const s = TWIN[i];
    const gate = (nf - s.th) * 3.2;
    if (gate <= 0) continue;                   // aún no "sale" esta estrella
    const tw = Math.sin(t * s.sp + s.ph);
    const a = nf * Math.min(1, gate) * s.base * (0.42 + 0.58 * tw * tw);
    if (a < 0.03) continue;
    ctx.globalAlpha = a > 1 ? 1 : a;
    ctx.fillStyle = s.warm ? '#ffe9c8' : '#dce4ff';
    ctx.fillRect(s.x, s.y, s.sz, s.sz);
    if (s.flash !== null && tw > 0.86) {       // destello de color en el pico
      ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.fillStyle = s.flash;
      ctx.fillRect(s.x - 1, s.y, s.sz + 2, 1);
      ctx.fillRect(s.x, s.y - 1, s.sz, s.sz + 2);
    }
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

  // ---- cielo nocturno: VÍA LÁCTEA (detrás) → capas de estrellas →
  //      titileo individual → fugaz → luna (todos pre-horneados) ----
  if (nf > 0.03) {
    ensureStarAssets();
    drawMilky(ctx, t, camX, camY, Math.min(1, (nf - 0.1) * 2) * 0.9);
    drawStarLayers(ctx, t, camX, camY, nf);
    drawTwinklers(ctx, t, nf, TWIN_BUDGET[perfQuality()]);

    // ---- estrella fugaz rara (comparte ventana temporal con el mundo) ----
    if (nf > 0.55) drawShootingStar(ctx, t, Math.min(1, (nf - 0.55) / 0.25));

    // ---- luna con halo dithered y FASE por día del mundo (2 drawImage) ----
    if (nf > 0.25) {
      const mx2 = Math.round(VIEW_W * 0.78 - camX * 0.004);
      drawMoon(ctx, mx2, 66, Math.min(1, (nf - 0.2) * 1.6), moonPhaseIndexAt(t));
    }
  }

  // ---- nubes v3: flota unificada de 3 capas (semilla 'titulo'), en orden
  //      de capa (alta → media → baja) con alpha propio por capa ----
  const tSeed = seedFromMapId('titulo');
  const plan = cloudPlanAt('titulo', t, camX, camY);
  for (let i = 0; i < plan.length; i++) {
    const st = plan[i];
    drawCloudBlend(ctx, tSeed, st, siA, siB, mx, Math.min(1, st.alpha * 1.7));
  }
}

// ============================================================
// 2) drawDayNightGrade — capa de grading sobre el mundo (antes del HUD)
//    R4-A2: tinte CONTINUO por franjas interpoladas (sin saltos Bayer),
//    banda rosada-naranja en bordes horizontales (dayT 0.20-0.30/0.65-0.75),
//    niebla de amanecer en lunaris, CUERPOS de las nubes v3 (las sombras
//    van en drawCloudShadows, capa suelo), VÍA LÁCTEA + titileo nocturno
//    y estrella fugaz. En 'pasado' calienta +10%; en 'presente' desatura
//    simulado (azul-gris). En la cripta: no-op.
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

  // R16: sala cubierta (casas, salas de la Ciudadela) — sin cielo: ni
  // horizonte, ni niebla de valle, ni nubes, ni estrellas. Solo el tinte
  // horario de arriba y el lavado de época de abajo.
  const indoor = !!g.map.indoor;

  // ---- 2) banda rosada-naranja tenue en los bordes horizontales ----
  if (!indoor) drawHorizonGlow(ctx, dT);

  // ---- 3) niebla de amanecer (bandas dithered bajas, solo valle) ----
  if (!indoor) drawDawnMist(ctx, g, dT);

  // ---- 4) nubes v3: cuerpos sobre entidades (exterior de día), en orden
  //      de capa (alta → media → baja), alpha por capa y presupuesto por
  //      perfQuality (en calidad baja solo sobrevive la capa media). ----
  const dayF = indoor ? 0 : cloudDayFactor(dT);
  if (dayF > 0.004) {
    const plan = cloudPlanAt(g.mapId, g.globalT, g.camX, g.camY);
    const seed = seedFromMapId(g.mapId);
    const tr = transitionAt(dT);
    const si = stageIndexAt(dT);
    const siA = tr ? tr.a : si;
    const siB = tr ? tr.b : si;
    const mx = tr ? tr.m : 0;
    const cap = CLOUD_CAP[perfQuality()];
    for (let i = 0; i < plan.length; i++) {
      const st = plan[i];
      if (i - planStart[st.layer] >= cap[st.layer]) continue;
      drawCloudBlend(ctx, seed, st, siA, siB, mx, st.alpha * dayF);
    }
  }

  // ---- 4b) noche: VÍA LÁCTEA + TITILEO individual (alpha × nf; corre
  //      ANTES de drawAmbient 'sky' de fx.ts, que pinta encima en render).
  //      Densidad crece con la profundidad de la noche (umbral por mota). ----
  const dayLight = Math.max(0.1, Math.sin(dT * TAU) * 1.25 + 0.25);
  const nf = 1 - Math.min(1, dayLight);
  if (nf > 0.14 && !indoor) {
    ensureStarAssets();
    drawMilky(ctx, g.globalT, g.camX, g.camY, Math.min(1, (nf - 0.14) / 0.32) * 0.5);
    drawTwinklers(ctx, g.globalT, nf, TWIN_BUDGET[perfQuality()]);
  }

  // ---- 5) estrella fugaz rara (noche cerrada, ventana determinista).
  //      (La LUNA del mundo la pinta fx.ts en drawAmbient 'sky'; para
  //      alinear su fase puede leer moonPhaseIndexAt(g.globalT) — v4) ----
  if (nf > 0.55 && !indoor) drawShootingStar(ctx, g.globalT, Math.min(1, (nf - 0.55) / 0.25));

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
// 3) drawCloudShadows — sombras en suelo de las NUBES v3, SOLO exterior
//    de día. Misma flota determinista que pinta los cuerpos en
//    drawDayNightGrade (cloudPlanAt): cada sombra es la silueta opaca +
//    penumbra dither de su nube, desplazada hacia abajo-derecha (sol
//    arriba-izquierda; las bajas, más cerca, desplazan más), con alpha
//    POR CAPA (media 0.075 · baja 0.055 · alta no proyecta) y presupuesto
//    por perfQuality. ENGANCHE: render.ts la llama en el pase agrupado
//    del suelo (bajo entidades, recibe el filtro de época) — no requiere
//    cambios en lighting.ts (es atmósfera, no luz).
// ============================================================

export function drawCloudShadows(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.map.dark || g.map.indoor) return;                    // cripta / salas cubiertas: nunca
  if (g.state === 'title' || g.state === 'controls') return; // sin mundo debajo
  const dayF = cloudDayFactor(mod(g.dayT, 1));
  if (dayF <= 0.004) return;

  const plan = cloudPlanAt(g.mapId, g.globalT, g.camX, g.camY);
  const seed = seedFromMapId(g.mapId);
  const cap = SHADOW_CAP[perfQuality()];
  for (let i = 0; i < plan.length; i++) {
    const st = plan[i];
    const shA = L_SHAL[st.layer];
    if (shA <= 0) continue;                                  // la capa alta no sombrea
    if (i - planStart[st.layer] >= cap[st.layer]) continue;  // presupuesto de calidad
    ctx.globalAlpha = shA * dayF;
    ctx.drawImage(getCloudShadow(seed, st.ci, st.layer), st.shX, st.shY);
  }
  ctx.globalAlpha = 1;
}
