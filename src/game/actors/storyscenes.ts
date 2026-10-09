// ============================================================
// ECOS DE AELTHAR — actors/storyscenes.ts
// R11-6 · EPIC 7.4 — ESCENAS ANIMADAS DE HISTORIA
// ------------------------------------------------------------
// Cinemáticas skippables (8-14 s) para los puntos clave del
// relato. MISMO PATRÓN que actors/bossintro.ts pero de largo
// aliento: overlay NO bloqueante — el orquestador llama
// update/draw mientras storySceneActive() y congela el mundo;
// este módulo NO toca g.state, NO pausa, NO toca nada del motor.
//
// CONTRATO (exports exactos):
//   startStoryScene(id)                 → arranca la escena (idempotente si ya activa)
//   storySceneActive()                  → true mientras dura
//   updateStoryScene(dt)                → avanza el reloj (1× por frame)
//   drawStoryScene(ctx,w,h)             → pinta TODO el frame de la escena
//   skipStoryScene()                    → salta (el orquestador la llama con E;
//                                         solo surte efecto a partir de t ≥ 1.5 s)
//   setStoryBackdropFn(fn | null)       → inyección del arte de fondos (R11-9):
//                                         fn(ctx, sceneId, t, w, h). Si no se
//                                         inyecta, se dibuja un fondo propio de
//                                         bandas deterministas (fallback).
//   onStorySceneEnd(cb | null)          → cb(id) al terminar (natural o salto),
//                                         para que el orquestador dispare lo que sigue.
//
// CAPAS que dibuja ESTE módulo (encima del fondo inyectado):
//   siluetas de actores (portador, figuras sin rostro, heraldo,
//   árbol del Eco), partículas (hojas invertidas, ceniza, motas
//   doradas, espuma), niebla, ondas de campana/anillos, grieta,
//   olas, letterbox, viñeta escalonada y texto narrativo por
//   beats (tipografía pixel 5×7 propia, caja alta, tildes y Ñ).
//
// REGLAS (mismas convenciones de horror.ts/bossintro.ts):
//   - Determinismo TOTAL: cero Math.random; hash entero propio.
//   - Cero allocations por frame: pools precalculados al cargar
//     el módulo; todo lo animado es f(t) paramétrico; los beats
//     se pasan a CAJA ALTA una sola vez al cargar (la fuente
//     pixel solo tiene mayúsculas) — el draw no alocará strings.
//   - Pixel-art limpio: solo fillRect enteros (sin arc/stroke ni
//     smoothing); sin gradientes — bandas escalonadas.
//   - Texto por beats HORNEADO 1× por beat a minicanvas (reveal
//     por recorte de ancho, como el banner de bossintro); sin
//     DOM → ruta directa (harness/smokes).
//
// SKIP: el orquestador llama skipStoryScene() al pulsar E; aquí
// se ignora antes de t=1.5 s. Pista «E: SALTAR» desde t=2.2 s.
//
// TIMELINE / BEATS (texto en la banda inferior, t en segundos):
//
//  acto1_fin (10.0 s) — la campana dobla sola
//   0.0-0.7 barras entran · 0.5 negro→escena · campana oscila siempre
//   1.0/3.0/5.0/7.0/9.0 ondas de bronce desde el campanario
//   0.4+ portador de espaldas (respiración) · 1.0+ hojas que suben
//   beats: 1.4 «La campana de la aldea dobla sola. / Nadie tira de la
//          cuerda.» · 4.6 «El bronce recuerda una hora / que aún no ha
//          llegado.» · 7.4 «Las hojas caen hacia arriba: / el cielo ya
//          cobró lo que el valle debía.»
//
//  acto2_fin (10.5 s) — el mar entra en la aldea dormida
//   0.8+ 3 capas de olas siluetas SUBEN por las calles (lento)
//   5.2  la vela del faro lejano se enciende (halo + llama)
//   beats: 1.6 «El mar sube por las calles dormidas, / sin prisa y sin
//          perdón.» · 4.8 «Las puertas se cierran solas, una a una, /
//          como párpados.» · 7.6 «En el faro lejano, una vela se
//          enciende. / Alguien aún te espera.»
//
//  acto3_fin (11.0 s) — el cielo se agrieta en silencio
//   1.4-4.4 la grieta de luz pálida crece (sin trueno, sin sacudida)
//   2.6-7.6 pájaros en silueta cruzan (2 bandadas, mudos)
//   7.4-9.4 la grieta se cierra como un ojo (párpados) → cicatriz tenue
//   beats: 1.6 · 4.8 · 7.6 (ver SCENES más abajo)
//
//  acto4_inicio (11.0 s) — el umbral de niebla
//   1.0+ el portador avanza hacia el umbral (2 frames de zancada,
//        escala 2→3 px al cruzar) · figuras sin rostro a los lados
//        que se inclinan a saludar · 2.8-8.0 EL COLOR SE APAGA de
//        fondo a primer plano (barrido gris + velo final)
//   beats: 1.6 · 4.8 · 7.6
//
//  heraldo_vencido (10.0 s) — la nota quebrada
//   0.7-1.0 el heraldo cae de rodillas (2 poses + polvo)
//   4.5-5.0 el cuerpo se vacía (alpha→0); la CAPA SIGUE ONDEANDO
//           (contorno hueco) · 5.2-7.6 una nota musical sube ·
//   7.6     la nota se rompe en 12 motas deterministas
//   beats: 1.5 · 4.4 · 7.0
//
//  eco_despierto (12.0 s) — final del Eco
//   2.0-9.0 cada 1.4 s un ANILLO del árbol se abre como onda
//   (elipses escalonadas); anillos 2/4/6 llevan una mini-viñeta
//   que cabalga el frente: CASA → BARCO → TUMBA · 8.4 el portador
//   (a la derecha) LEVANTA LA MANO · motas doradas/violetas suben
//   beats: 1.8 · 5.0 · 8.0
//
// ENGANCHES sugeridos para el orquestador (ver worklog R11-6):
//   - update.ts: if (storySceneActive()) { updateStoryScene(dt); return; }
//     (congelar mundo; render sigue llamando drawStoryScene al final)
//   - render.ts: tras el mundo, drawStoryScene(ctx, VIEW_W, VIEW_H)
//   - input 'e' → if (storySceneActive()) skipStoryScene()
//   - disparos: fin de actos 1-3 (flags de acto), spawn del heraldo de
//     acto4 (antes de crearlo), rama killEnemy del 'heraldo', trigger
//     del final del Eco. onStorySceneEnd(cb) para continuar el flujo.
// ============================================================

// ---------------- Ids y defs ----------------

export type StorySceneId =
  | 'acto1_fin'
  | 'acto2_fin'
  | 'acto3_fin'
  | 'acto4_inicio'
  | 'heraldo_vencido'
  | 'eco_despierto';

type BackdropFn = (
  ctx: CanvasRenderingContext2D, sceneId: string, t: number, w: number, h: number,
) => void;

interface Beat {
  t0: number;   // inicio del beat (s)
  t1: number;   // fin del hold (s; +0.5 s de salida)
  l1: string;   // línea 1
  l2: string;   // línea 2
}

interface SceneDef {
  id: StorySceneId;
  dur: number;          // duración total (s)
  beats: Beat[];
  tint: string;         // velo atmosférico global
  tintA: number;
  sky: string[];        // bandas del cielo (fallback y velo si no hay backdropFn)
  horizon: number;      // fracción de h donde empieza el suelo
  ground: string;       // color del suelo
}

const SCENES: SceneDef[] = [
  {
    id: 'acto1_fin', dur: 10.0, horizon: 0.62,
    tint: '#2a2448', tintA: 0.10,
    sky: ['#0a0c18', '#12142a', '#1c1838', '#2a2448', '#3a3258', '#4a4068'],
    ground: '#0c101c',
    beats: [
      { t0: 1.4, t1: 4.2, l1: '«La campana de la aldea dobla sola.', l2: 'Nadie tira de la cuerda.»' },
      { t0: 4.6, t1: 7.0, l1: 'El bronce recuerda una hora', l2: 'que aún no ha llegado.' },
      { t0: 7.4, t1: 9.5, l1: 'Las hojas caen hacia arriba:', l2: 'el cielo ya cobró lo que el valle debía.' },
    ],
  },
  {
    id: 'acto2_fin', dur: 10.5, horizon: 0.52,
    tint: '#0e2030', tintA: 0.12,
    sky: ['#060a14', '#0a1220', '#101c30', '#16263c', '#1e3048'],
    ground: '#12161e',
    beats: [
      { t0: 1.6, t1: 4.4, l1: 'El mar sube por las calles dormidas,', l2: 'sin prisa y sin perdón.' },
      { t0: 4.8, t1: 7.2, l1: 'Las puertas se cierran solas, una a una,', l2: 'como párpados.' },
      { t0: 7.6, t1: 9.7, l1: 'En el faro lejano, una vela se enciende.', l2: 'Alguien aún te espera.' },
    ],
  },
  {
    id: 'acto3_fin', dur: 11.0, horizon: 0.66,
    tint: '#0a0d18', tintA: 0.10,
    sky: ['#080a12', '#0e1220', '#161c2e', '#20283c', '#2a3450'],
    ground: '#0a0d14',
    beats: [
      { t0: 1.6, t1: 4.4, l1: 'El cielo se agrieta en silencio.', l2: 'No truena: el silencio pesa más.' },
      { t0: 4.8, t1: 7.2, l1: 'Los pájaros cruzan mudos,', l2: 'como firmas en un registro abierto.' },
      { t0: 7.6, t1: 9.9, l1: 'La grieta se cierra despacio,', l2: 'como un ojo that decide esperar.' },
    ],
  },
  {
    id: 'acto4_inicio', dur: 11.0, horizon: 0.58,
    tint: '#20242c', tintA: 0.10,
    sky: ['#101318', '#161a20', '#1c222a', '#242c36', '#2e3642'],
    ground: '#171b22',
    beats: [
      { t0: 1.6, t1: 4.4, l1: 'Un umbral de niebla se abre', l2: 'donde no había puerta.' },
      { t0: 4.8, t1: 7.2, l1: 'Figuras sin rostro te saludan:', l2: 'sus manos conocen la tuya.' },
      { t0: 7.6, t1: 9.9, l1: 'El color se apaga de atrás hacia delante,', l2: 'como un recuerdo que se queda fuera.' },
    ],
  },
  {
    id: 'heraldo_vencido', dur: 10.0, horizon: 0.64,
    tint: '#1a1c26', tintA: 0.12,
    sky: ['#0c0e14', '#12141c', '#1a1c26', '#242632', '#2e3040'],
    ground: '#0e1016',
    beats: [
      { t0: 1.5, t1: 4.0, l1: 'El heraldo cae de rodillas.', l2: 'Su nota se quiebra.' },
      { t0: 4.4, t1: 6.6, l1: 'La capa queda vacía y sigue ondeando:', l2: 'aún hay viento en su palabra.' },
      { t0: 7.0, t1: 9.3, l1: 'Una nota sube, se rompe en motas', l2: 'y el silencio la recoge.' },
    ],
  },
  {
    id: 'eco_despierto', dur: 12.0, horizon: 0.60,
    tint: '#1a3236', tintA: 0.08,
    sky: ['#0a141c', '#10202a', '#1a3236', '#2a4a48', '#3c6252', '#527a60'],
    ground: '#0e1a16',
    beats: [
      { t0: 1.8, t1: 4.6, l1: 'El árbol del Eco abre sus anillos:', l2: 'uno por cada año perdido.' },
      { t0: 5.0, t1: 7.6, l1: 'En cada anillo, una vida:', l2: 'la casa. El barco. La tumba.' },
      { t0: 8.0, t1: 10.7, l1: 'El portador levanta la mano.', l2: 'El Eco, por fin, responde.' },
    ],
  },
];

const IDX: Record<string, number> = {
  acto1_fin: 0, acto2_fin: 1, acto3_fin: 2,
  acto4_inicio: 3, heraldo_vencido: 4, eco_despierto: 5,
};

// Los beats se pasan a CAJA ALTA UNA VEZ al cargar el módulo (la fuente
// pixel solo tiene mayúsculas): el draw por frame no alocará strings.
for (let si = 0; si < SCENES.length; si++) {
  const sc = SCENES[si];
  for (let b = 0; b < sc.beats.length; b++) {
    sc.beats[b].l1 = sc.beats[b].l1.toUpperCase();
    sc.beats[b].l2 = sc.beats[b].l2.toUpperCase();
  }
}

// ---------------- Estado interno ----------------

let active = false;
let curIdx = 0;
let t = 0;
let endCb: ((id: StorySceneId) => void) | null = null;
let backdropFn: BackdropFn | null = null;

// ---------------- Utilidades deterministas (sin Math.random) ----------------

/** Hash entero → [0,1). Determinista, estilo sprites.ts (FNV-ish). */
function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function cl(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOutCubic(x: number): number {
  const u = 1 - x;
  return 1 - u * u * u;
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

// ---------------- Tipografía pixel 5×7 (solo fillRect, caja alta) ----------------

const FONT: Record<string, string[]> = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  B: ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
  C: [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '],
  D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  F: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
  G: [' ####', '#    ', '#    ', '#  ##', '#   #', '#   #', ' ### '],
  H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
  J: ['  ###', '   # ', '   # ', '   # ', '   # ', '#  # ', ' ##  '],
  K: ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
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
  W: ['#   #', '#   #', '#   #', '# # #', '# # #', '## ##', '#   #'],
  X: ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
  Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
  Z: ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
  '.': ['     ', '     ', '     ', '     ', '     ', '  ## ', '  ## '],
  ',': ['     ', '     ', '     ', '     ', '  ## ', '  ## ', '  #  '],
  ':': ['     ', '  #  ', '  #  ', '     ', '  #  ', '  #  ', '     '],
  '-': ['     ', '     ', '     ', ' ### ', '     ', '     ', '     '],
  '?': [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '],
  '!': ['  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '     ', '  #  '],
  '«': ['     ', '     ', '  # #', ' # # ', '  # #', '     ', '     '],
  '»': ['     ', '     ', ' # # ', '  # #', ' # # ', '     ', '     '],
  ' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
};

// Vocales con tilde → glifo base + acento encima (como bossintro.ts).
const ACCENT_OF: Record<string, string> = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N' };
// Acento agudo (2 px en diagonal); la Ñ lleva virgulilla propia.
const ACUTE_PX: number[][] = [[2, -2], [3, -3]];
const TILDE_PX: number[][] = [[1, -2], [2, -3], [3, -3], [4, -2]];

/** Ancho en px de una cadena a escala s: len*6*s − s. */
function textW(len: number, s: number): number {
  return len * 6 * s - s;
}

/** Dibuja una cadena 5×7 con fillRect enteros (1 pasada, color dado). */
function drawTextPx(
  ctx: CanvasRenderingContext2D, str: string, x0: number, y0: number, s: number, col: string,
): void {
  ctx.fillStyle = col;
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

// ---------------- Texto de beats HORNEADO (1× por beat, reveal por recorte) ----------------

const BEAT_S = 2;                 // escala del texto narrativo
const COL_TEXT = '#d8e0ea';       // texto principal
const COL_TEXT_SHADOW = '#05070c';
const COL_HINT = '#8a94a4';       // «E: SALTAR»
const CPS = 0.034;                // s por carácter (máquina de escribir)

interface BakedSlot {
  cv: HTMLCanvasElement | null;
  line: string;
  w: number;
  h: number;
  pad: number;   // píxeles sobre la línea base dentro del canvas (acentos + sombra)
}
const bakeA: BakedSlot = { cv: null, line: '\u0000', w: 0, h: 0, pad: 0 };
const bakeB: BakedSlot = { cv: null, line: '\u0000', w: 0, h: 0, pad: 0 };
let bakeBroken = false;   // sin DOM → ruta directa (sin reintentos)

function bakeLine(slot: BakedSlot, line: string): void {
  if (bakeBroken || (slot.line === line && slot.cv !== null)) return;
  try {
    const iw = Math.ceil(textW(line.length, BEAT_S)) + 8;
    const ih = 11 * BEAT_S + 4;
    const cv = slot.cv !== null ? slot.cv : document.createElement('canvas');
    cv.width = iw;
    cv.height = ih;
    const c = cv.getContext('2d');
    if (!c) { bakeBroken = true; return; }
    c.clearRect(0, 0, iw, ih);
    const padTop = 3 * BEAT_S + 2;
    drawTextPx(c, line, 3, padTop + 2, BEAT_S, COL_TEXT_SHADOW);
    drawTextPx(c, line, 2, padTop, BEAT_S, COL_TEXT);
    slot.cv = cv;
    slot.line = line;
    slot.w = iw;
    slot.h = ih;
    slot.pad = padTop + 2;
  } catch {
    bakeBroken = true;
  }
}

/** Vuelca una línea horneada con reveal de k caracteres y alpha a. */
function blitLine(
  ctx: CanvasRenderingContext2D, slot: BakedSlot, line: string, k: number,
  bx: number, by: number, a: number,
): void {
  if (a <= 0.01 || k <= 0) return;
  if (slot.cv !== null && slot.line === line && !bakeBroken) {
    const rw = Math.min(slot.w, k * 6 * BEAT_S + 4);
    ctx.globalAlpha = cl(a);
    ctx.drawImage(slot.cv, 0, 0, rw, slot.h, bx - 2, by - slot.pad, rw, slot.h);
  } else {
    // fallback sin DOM: slice directo (solo smokes/harness)
    const shown = line.slice(0, k);
    drawTextPx(ctx, shown, bx + 1, by + 2, BEAT_S, COL_TEXT_SHADOW);
    drawTextPx(ctx, shown, bx, by, BEAT_S, COL_TEXT);
  }
  ctx.globalAlpha = 1;
}

// ---------------- Pools precalculados (cero allocs por frame) ----------------

interface Mote { x0: number; y0: number; spd: number; sway: number; ph: number; sz: number; ci: number }

function makeMotes(n: number, seed: number): Mote[] {
  const out: Mote[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x0: hash2(i, seed),
      y0: hash2(i, seed + 1),
      spd: 14 + hash2(i, seed + 2) * 26,
      sway: 0.6 + hash2(i, seed + 3) * 0.8,
      ph: hash2(i, seed + 4) * 6.283,
      sz: hash2(i, seed + 5) < 0.4 ? 1 : 2,
      ci: Math.floor(hash2(i, seed + 6) * 3),
    });
  }
  return out;
}

const MOTES_RISE = makeMotes(18, 901);   // motas doradas/violetas que suben (eco_despierto)
const MOTES_FALL = makeMotes(16, 911);   // ceniza que cae (heraldo_vencido)
const MOTES_SPRAY = makeMotes(10, 921);  // espuma de las olas (acto2)
const MOTES_ASH1 = makeMotes(14, 931);   // motas frías (acto1/acto3 ambiente)
const RISE_COL = ['#ffe9a0', '#c8b0e8', '#e8d8a8'];
const FALL_COL = ['#9aa4ae', '#78828c', '#aab4be'];

interface Leaf { x0: number; spd: number; sway: number; ph: number }
const LEAVES: Leaf[] = [];
for (let i = 0; i < 22; i++) {
  LEAVES.push({
    x0: hash2(i, 941),
    spd: 18 + hash2(i, 943) * 26,          // px/s hacia ARRIBA (hojas invertidas)
    sway: 0.8 + hash2(i, 945) * 1.1,
    ph: hash2(i, 947) * 6.283,
  });
}
const LEAF_COL = ['#6f8f5a', '#8a7a44', '#5a7048'];

interface Star { x: number; y: number; ph: number }
const STARS: Star[] = [];
for (let i = 0; i < 16; i++) {
  STARS.push({ x: hash2(i, 951), y: 0.05 + hash2(i, 953) * 0.30, ph: hash2(i, 955) * 6.283 });
}

interface Bird { dx: number; dy: number; spd: number; ph: number }
const BIRDS: Bird[] = [];
for (let i = 0; i < 10; i++) {
  BIRDS.push({
    dx: hash2(i, 961) * 90 - 45,
    dy: (i < 5 ? 0 : 34) + hash2(i, 963) * 26 - 13,
    spd: 64 + hash2(i, 965) * 42,
    ph: hash2(i, 967) * 6.283,
  });
}

interface FogBlob { dx: number; dy: number; bw: number; bh: number }
interface FogBank { x0: number; y0: number; spd: number; dir: number; a: number; ph: number; blobs: FogBlob[] }
const FOG: FogBank[] = [];
for (let b = 0; b < 7; b++) {
  const blobs: FogBlob[] = [];
  for (let j = 0; j < 6; j++) {
    blobs.push({
      dx: j * 18 + hash2(b * 8 + j, 971) * 10,
      dy: hash2(b * 8 + j, 973) * 10 - 5,
      bw: 26 + hash2(b * 8 + j, 975) * 30,
      bh: 5 + hash2(b * 8 + j, 977) * 7,
    });
  }
  FOG.push({
    x0: hash2(b, 981),
    y0: 0.34 + hash2(b, 983) * 0.38,
    spd: 7 + hash2(b, 985) * 11,
    dir: b % 2 === 0 ? 1 : -1,
    a: 0.09 + hash2(b, 987) * 0.07,
    ph: hash2(b, 989) * 6.283,
    blobs,
  });
}

interface NoteMote { a: number; spd: number; sz: number; up: number }
const NOTE_M: NoteMote[] = [];
for (let i = 0; i < 12; i++) {
  NOTE_M.push({
    a: -Math.PI / 2 + ((i % 6) - 2.5) * 0.42,
    spd: 26 + (i % 4) * 14,
    sz: i % 3 === 0 ? 2 : 1,
    up: 10 + (i % 5) * 6,
  });
}

interface DustP { a: number; spd: number }
const DUST: DustP[] = [];
for (let i = 0; i < 12; i++) {
  DUST.push({ a: Math.PI + (hash2(i, 991) - 0.5) * 1.6, spd: 20 + hash2(i, 993) * 26 });
}

// Tiempos de las ondas de campana (acto1) y de los anillos del árbol (eco)
const BELL_RING_T: number[] = [1.0, 3.0, 5.0, 7.0, 9.0];
const BELL_SPD = 95;
const ECO_RING_T: number[] = [2.0, 3.4, 4.8, 6.2, 7.6, 9.0];
const ECO_SPD = 62;

// Grieta del cielo (acto3): polilínea determinista como fracciones [x,y]
const CRACK: number[][] = [];
const CRACK_N = 26;
{
  let cx = 0.5;
  let cy = 0.08;
  for (let i = 0; i < CRACK_N; i++) {
    CRACK.push([cx, cy]);
    cx += (hash2(i, 701) - 0.5) * 0.055;
    cx = Math.min(0.60, Math.max(0.40, cx));
    cy += 0.0175 + hash2(i, 703) * 0.005;
  }
}
// Ramillas cortas que nacen de la grieta principal
const CRACK_BRANCH: number[][] = [];   // [idxPadre, dx0, dy0, dx1, dy1, dx2, dy2]
for (let b = 0; b < 3; b++) {
  const pi = 5 + b * 8;
  const side = b % 2 === 0 ? 1 : -1;
  CRACK_BRANCH.push([
    pi,
    side * 0.012, 0.014,
    side * 0.030, 0.022,
    side * 0.044, 0.026,
  ]);
}

// ---------------- Primitivas de dibujo ----------------

/** Bandas de cielo escalonadas + suelo; devuelve el y del horizonte. */
function drawSky(ctx: CanvasRenderingContext2D, def: SceneDef, w: number, h: number): number {
  const gy = Math.round(def.horizon * h);
  const n = def.sky.length;
  const hb = gy / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = def.sky[i];
    const y0 = Math.round(i * hb);
    ctx.fillRect(0, y0, w, Math.round(hb) + 1);
  }
  ctx.fillStyle = def.ground;
  ctx.fillRect(0, gy, w, h - gy);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, gy, w, 2);
  return gy;
}

/** Círculo escalonado (luna/sol): rects por fila, sin AA. */
function drawDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number): void {
  ctx.fillStyle = col;
  ctx.globalAlpha = cl(a);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(x - half, y + dy, half * 2, 1);
  }
  ctx.globalAlpha = 1;
}

/** Anillo/onda elíptica escalonada (36 pasos). */
function drawRingEl(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, col: string, a: number,
): void {
  if (a <= 0.01) return;
  ctx.fillStyle = col;
  ctx.globalAlpha = cl(a);
  for (let i = 0; i < 36; i++) {
    const ang = (i / 36) * 6.283185;
    const px = Math.round(cx + Math.cos(ang) * rx);
    const py = Math.round(cy + Math.sin(ang) * ry);
    ctx.fillRect(px - 1, py - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
}

/** Fila de colinas/ruinas lejanas determinista. */
function drawHills(ctx: CanvasRenderingContext2D, w: number, gy: number, col: string, seed: number, step: number): void {
  ctx.fillStyle = col;
  for (let x = 0; x < w; x += step) {
    const hg = Math.round(10 + Math.sin(x * 0.012 + seed) * 6 + hash2(x, seed) * 12);
    ctx.fillRect(x, gy - hg, step + 1, hg + 2);
  }
}

/** Fila de casitas silueta (aldea). winCol: color de las ventanas. */
function drawHouseRow(
  ctx: CanvasRenderingContext2D, w: number, gy: number, col: string, winCol: string, seed: number,
): void {
  const n = 12;
  const cw = w / n;
  for (let i = 0; i < n; i++) {
    const hx = Math.round((i + 0.05 + hash2(i, seed) * 0.4) * cw);
    const hw = Math.round(12 + hash2(i, seed + 1) * 12);
    const hh = Math.round(9 + hash2(i, seed + 2) * 9);
    ctx.fillStyle = col;
    ctx.fillRect(hx, gy - hh, hw, hh);
    ctx.fillRect(hx - 2, gy - hh - 3, hw + 4, 3);            // alero
    ctx.fillRect(hx + 2, gy - hh - 5, Math.max(4, hw - 4), 2); // cumbrera
    if (hash2(i, seed + 3) > 0.55) ctx.fillRect(hx + hw - 6, gy - hh - 8, 3, 5); // chimenea
    if (hash2(i, seed + 4) > 0.35) {
      ctx.fillStyle = winCol;
      ctx.fillRect(hx + 3, gy - hh + 3, 3, 3);
      if (hw > 18) ctx.fillRect(hx + hw - 7, gy - hh + 3, 3, 3);
    }
  }
}

/**
 * Portador de ESPALDAS (silueta). mode: 0 parado, 1/2 zancada,
 * 3 de rodillas. f: frame de respiración (0/1).
 */
function drawBearer(
  ctx: CanvasRenderingContext2D, x: number, gy: number, s: number, mode: number, f: number, col: string, a: number,
): void {
  if (a <= 0.01) return;
  ctx.fillStyle = col;
  ctx.globalAlpha = cl(a);
  if (mode === 3) {
    // de rodillas: más bajo, cabeza gacha
    ctx.fillRect(x - 2 * s, gy - 9 * s, 4 * s, 3 * s);   // capucha
    ctx.fillRect(x - 2 * s, gy - 6 * s, 4 * s, 3 * s);   // torso
    ctx.fillRect(x - 4 * s, gy - 3 * s, 8 * s, 3 * s);   // manto
    ctx.fillRect(x + 1 * s, gy - 2 * s, 3 * s, 2 * s);   // rodilla
  } else {
    const bob = f === 1 ? s : 0;
    const y0 = gy - 13 * s + bob;
    ctx.fillRect(x - 2 * s, y0, 4 * s, 3 * s);            // capucha
    ctx.fillRect(x - 2 * s, gy - 10 * s + bob, 4 * s, 4 * s); // torso
    ctx.fillRect(x - 3 * s, gy - 6 * s + bob, 6 * s, 4 * s);  // manto
    if (mode === 1) {
      ctx.fillRect(x - 3 * s, gy - 2 * s, 2 * s, 2 * s);
      ctx.fillRect(x + 1 * s, gy - 2 * s, 2 * s, 2 * s);
    } else if (mode === 2) {
      ctx.fillRect(x - 1 * s, gy - 2 * s, 2 * s, 2 * s);
    } else {
      ctx.fillRect(x - 4 * s, gy - 2 * s, 8 * s, 2 * s);  // falda del manto
    }
  }
  ctx.globalAlpha = 1;
}

/** Figura SIN ROSTRO que se inclina a saludar (2 frames). bow: 0 recto, 1 inclinada. */
function drawFaceless(
  ctx: CanvasRenderingContext2D, x: number, gy: number, s: number, bow: boolean, col: string, a: number,
): void {
  if (a <= 0.01) return;
  ctx.fillStyle = col;
  ctx.globalAlpha = cl(a);
  const drop = bow ? 2 * s : 0;
  ctx.fillRect(x - 2 * s, gy - 12 * s + drop, 4 * s, 3 * s);   // capucha
  ctx.fillStyle = '#05070c';                                    // hueco sin rostro
  ctx.fillRect(x - 1 * s, gy - 11 * s + drop, 2 * s, 2 * s);
  ctx.fillStyle = col;
  ctx.fillRect(x - 2 * s, gy - 9 * s + (bow ? s : 0), 4 * s, 4 * s);
  ctx.fillRect(x - 3 * s, gy - 5 * s, 6 * s, 3 * s);
  ctx.fillRect(x - 3 * s, gy - 2 * s, 6 * s, 2 * s);
  ctx.globalAlpha = 1;
}

/** Capa del heraldo: llena (detrás del cuerpo) o contorno HUECO (tras el vaciado). */
function drawCape(
  ctx: CanvasRenderingContext2D, x: number, gy: number, tt: number, hollow: boolean, col: string, a: number,
): void {
  if (a <= 0.01) return;
  ctx.fillStyle = col;
  ctx.globalAlpha = cl(a);
  // 5 tiras verticales que ondean: la onda sigue VIVA aunque el cuerpo se vacíe
  for (let i = 0; i < 5; i++) {
    const wv = Math.sin(tt * 2.6 + i * 1.15) * 3;
    const hgt = 16 + Math.sin(tt * 2.1 + i * 0.7) * 3;
    const sx = x - 10 + i * 5 + Math.round(wv * 0.4);
    const sy = Math.round(gy - 20 - (i === 0 || i === 4 ? 2 : 0) + wv * 0.3);
    if (hollow) {
      // contorno: tira izquierda, tira derecha y faldón bajo conectando
      if (i === 0 || i === 4) ctx.fillRect(sx, sy, 3, Math.round(hgt));
      else ctx.fillRect(sx, sy + Math.round(hgt) - 3, 3, 3);
    } else {
      ctx.fillRect(sx, sy, 4, Math.round(hgt));
    }
  }
  ctx.globalAlpha = 1;
}

/** Nota musical pixel (cabeza + palito + banderín). */
function drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, col: string, a: number): void {
  if (a <= 0.01) return;
  ctx.fillStyle = col;
  ctx.globalAlpha = cl(a);
  ctx.fillRect(x - 1, y - 2, 3, 2);   // cabeza
  ctx.fillRect(x + 1, y - 9, 1, 7);   // palo
  ctx.fillRect(x + 2, y - 9, 2, 2);   // banderín
  ctx.fillRect(x + 3, y - 7, 1, 2);
  ctx.globalAlpha = 1;
}

/** Mini-viñeta de los anillos del Eco: 0 casa · 1 barco · 2 tumba. */
function drawVignetteIcon(
  ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, col: string, a: number,
): void {
  if (a <= 0.01) return;
  const s = 2;
  ctx.globalAlpha = cl(a);
  if (kind === 0) {
    // casa: muro + tejado escalonado + puerta oscura
    ctx.fillStyle = col;
    ctx.fillRect(x - 4 * s, y - 3 * s, 8 * s, 5 * s);
    ctx.fillRect(x - 5 * s, y - 4 * s, 10 * s, 1 * s);
    ctx.fillRect(x - 3 * s, y - 6 * s, 6 * s, 2 * s);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(x - 1 * s, y - 1 * s, 2 * s, 3 * s);
  } else if (kind === 1) {
    // barco: casco + mástil + vela
    ctx.fillStyle = col;
    ctx.fillRect(x - 5 * s, y, 10 * s, 2 * s);
    ctx.fillRect(x - 4 * s, y + 2 * s, 8 * s, 1 * s);
    ctx.fillRect(x, y - 7 * s, s, 7 * s);
    ctx.fillRect(x + 1 * s, y - 6 * s, 5 * s, 5 * s);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(x + 2 * s, y - 5 * s, 3 * s, 3 * s);
  } else {
    // tumba: losa + remate + surco epigráfico
    ctx.fillStyle = col;
    ctx.fillRect(x - 4 * s, y - 2 * s, 8 * s, 5 * s);
    ctx.fillRect(x - 2 * s, y - 4 * s, 4 * s, 2 * s);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(x - 1 * s, y - 1 * s, 2 * s, 1 * s);
    ctx.fillRect(x, y - 2 * s, 1 * s, 3 * s);
  }
  ctx.globalAlpha = 1;
}

/** Capa de niebla rodante (7 bancos × 6 blobs, deriva determinista). */
function drawFog(ctx: CanvasRenderingContext2D, tt: number, w: number, h: number): void {
  ctx.fillStyle = '#b8c2cc';
  for (let b = 0; b < FOG.length; b++) {
    const f = FOG[b];
    const span = w + 170;
    let bx = (f.x0 * w + f.dir * tt * f.spd) % span;
    if (bx < 0) bx += span;
    bx -= 130;
    const by = f.y0 * h;
    const shim = 0.8 + 0.2 * Math.sin(tt * 0.9 + f.ph);
    ctx.globalAlpha = cl(f.a * shim);
    for (let j = 0; j < f.blobs.length; j++) {
      const bl = f.blobs[j];
      const x = Math.round(bx + bl.dx);
      if (x + bl.bw < 0 || x > w) continue;
      ctx.fillRect(x, Math.round(by + bl.dy), Math.round(bl.bw), Math.round(bl.bh));
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------- Escenas ----------------

// ---- acto1_fin: la campana dobla sola · hojas que suben ----
function sceneActo1(ctx: CanvasRenderingContext2D, w: number, h: number, tt: number): void {
  const def = SCENES[0];
  const gy = drawSky(ctx, def, w, h);

  // aldea lejana dormida
  drawHouseRow(ctx, w, gy, '#101426', '#0a0c14', 401);

  // campanario (izquierda): torre + espadaña + campana oscilante
  const tx = Math.round(w * 0.24);
  ctx.fillStyle = '#0c0f1a';
  ctx.fillRect(tx - 12, gy - 58, 24, 58);
  ctx.fillRect(tx - 14, gy - 62, 28, 4);
  ctx.fillRect(tx - 10, gy - 66, 20, 4);
  ctx.fillRect(tx - 6, gy - 70, 12, 4);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(tx - 8, gy - 52, 16, 14);           // vano de la espadaña
  const ang = Math.sin(tt * 2.2) * 0.30;           // dobla sola, siempre
  const bx = tx + Math.round(Math.sin(ang) * 4);
  const by = gy - 45 + Math.round((1 - Math.cos(ang)) * 2);
  ctx.fillStyle = '#4a5468';
  ctx.fillRect(bx - 3, by, 6, 3);
  ctx.fillRect(bx - 4, by + 3, 8, 3);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(bx, by + 6, 1, 2);                  // badajo

  // ondas de bronce desde la campana
  for (let i = 0; i < BELL_RING_T.length; i++) {
    const rt = BELL_RING_T[i];
    if (tt < rt) continue;
    const r = (tt - rt) * BELL_SPD;
    const rMax = Math.min(w, h) * 0.30;
    if (r > rMax) continue;
    drawRingEl(ctx, bx, by + 4, r, r * 0.8, '#aebad0', (1 - r / rMax) * 0.45);
  }

  // portador de espaldas (centro-derecha), respira
  const pa = cl((tt - 0.4) / 0.6);
  drawBearer(ctx, Math.round(w * 0.62), gy + 8, 3, 0, Math.floor(tt * 1.1) % 2, '#05070c', pa);

  // hojas invertidas: caen hacia ARRIBA desde el suelo
  const lg = cl((tt - 1.0) / 0.8);
  if (lg > 0.01) {
    for (let i = 0; i < LEAVES.length; i++) {
      const lf = LEAVES[i];
      const prog = (lf.x0 + tt * lf.spd / 620) % 1;
      const ly = Math.round(gy + 10 - prog * (gy + 10 - 24));
      const lx = Math.round(lf.x0 * w + Math.sin(tt * lf.sway + lf.ph) * 16);
      const la = Math.sin(prog * Math.PI) * 0.85 * lg;
      if (la < 0.03) continue;
      ctx.globalAlpha = la;
      ctx.fillStyle = LEAF_COL[i % 3];
      if (Math.floor(tt * 2 + i) % 2 === 0) ctx.fillRect(lx, ly, 3, 1);
      else ctx.fillRect(lx + 1, ly - 1, 1, 3);
    }
    ctx.globalAlpha = 1;
  }

  // motas frías de ambiente
  if (lg > 0.01) {
    for (let i = 0; i < MOTES_ASH1.length; i++) {
      const m = MOTES_ASH1[i];
      const prog = (m.y0 + tt * m.spd / 520) % 1;
      const my = Math.round(prog * (gy + 20));
      const mx = Math.round(m.x0 * w + Math.sin(tt * m.sway + m.ph) * 10);
      const ma = Math.sin(prog * Math.PI) * 0.22;
      if (ma < 0.02) continue;
      ctx.globalAlpha = ma;
      ctx.fillStyle = FALL_COL[m.ci];
      ctx.fillRect(mx, my, m.sz, m.sz);
    }
    ctx.globalAlpha = 1;
  }
}

// ---- acto2_fin: el mar sube por las calles · la vela del faro ----
function sceneActo2(ctx: CanvasRenderingContext2D, w: number, h: number, tt: number, dur: number): void {
  const def = SCENES[1];
  const gy = drawSky(ctx, def, w, h);

  // estrellas frías
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const a = 0.22 + 0.22 * Math.sin(tt * 1.3 + s.ph);
    ctx.globalAlpha = cl(a);
    ctx.fillStyle = '#cfd8e8';
    ctx.fillRect(Math.round(s.x * w), Math.round(s.y * h), 1, 1);
  }
  ctx.globalAlpha = 1;

  // luna sobre el mar
  drawDisc(ctx, Math.round(w * 0.72), Math.round(h * 0.14), 10, '#cfd8e8', 0.75);
  drawDisc(ctx, Math.round(w * 0.72) - 3, Math.round(h * 0.14) - 2, 2, '#9aa8c0', 0.5);

  // franja de mar lejano bajo el horizonte
  ctx.fillStyle = '#14242e';
  ctx.fillRect(0, gy - 4, w, 6);

  // aldea dormida (todas las ventanas apagadas)
  drawHouseRow(ctx, w, gy + 14, '#0a0d16', '#0a0f18', 421);

  // faro lejano (derecha): la vela se enciende en t=5.2
  const lx = Math.round(w * 0.86);
  const lgy = gy - 2;
  ctx.fillStyle = '#0b0e16';
  ctx.fillRect(lx - 5, lgy - 46, 10, 46);
  ctx.fillRect(lx - 7, lgy - 50, 14, 5);           // linterna
  ctx.fillRect(lx - 9, lgy - 54, 18, 4);           // caperuza
  ctx.fillStyle = '#05070c';
  ctx.fillRect(lx - 3, lgy - 40, 2, 3);            // ventana del faro
  ctx.fillRect(lx + 1, lgy - 28, 2, 3);
  const lit = tt >= 5.2;
  if (lit) {
    const ramp = cl((tt - 5.2) / 0.9);
    const fl = 0.75 + 0.25 * Math.sin(tt * 6.3);
    ctx.fillStyle = '#ffd88a';
    ctx.globalAlpha = cl(ramp * fl);
    ctx.fillRect(lx - 2, lgy - 49, 4, 3);          // llama
    ctx.fillStyle = '#fff4d0';
    ctx.fillRect(lx - 1, lgy - 48, 2, 1);
    ctx.globalAlpha = 1;
    drawRingEl(ctx, lx, lgy - 48, 14 + Math.sin(tt * 1.7) * 2, 11, '#ffd88a', 0.16 * ramp);
    drawRingEl(ctx, lx, lgy - 48, 26 + Math.sin(tt * 1.3) * 3, 19, '#ffd88a', 0.09 * ramp);
  }

  // 3 capas de olas siluetas que SUBEN por las calles
  const k = easeInOut(cl((tt - 0.8) / (dur - 1.6)));
  const startY = [0.70, 0.76, 0.84];
  const endY = [0.42, 0.50, 0.60];
  const cols = ['#152c38', '#1b3a48', '#225064'];
  const alphas = [0.55, 0.70, 0.90];
  const amps = [5, 7, 9];
  const spds = [1.1, 0.8, 0.55];
  for (let l = 0; l < 3; l++) {
    const baseY = lerp(startY[l] * h, endY[l] * h, k);
    const amp = amps[l];
    const spd = spds[l];
    ctx.fillStyle = cols[l];
    ctx.globalAlpha = alphas[l];
    for (let x = 0; x < w; x += 12) {
      const surf = baseY
        + Math.sin(x * 0.020 + tt * spd + l * 2.1) * amp
        + Math.sin(x * 0.045 - tt * spd * 0.6 + l * 4.3) * amp * 0.35;
      const sy = Math.round(surf);
      ctx.fillRect(x, sy, 13, h - sy);
    }
    // espuma en la cresta
    ctx.fillStyle = '#7ab0c0';
    ctx.globalAlpha = alphas[l] * 0.40;
    for (let x = 0; x < w; x += 12) {
      const surf = baseY
        + Math.sin(x * 0.020 + tt * spd + l * 2.1) * amp
        + Math.sin(x * 0.045 - tt * spd * 0.6 + l * 4.3) * amp * 0.35;
      ctx.fillRect(x, Math.round(surf), 13, 2);
    }
  }
  ctx.globalAlpha = 1;

  // espuma salpicando abajo
  for (let i = 0; i < MOTES_SPRAY.length; i++) {
    const m = MOTES_SPRAY[i];
    const prog = (m.y0 + tt * m.spd / 300) % 1;
    const sy = Math.round(h * 0.86 + prog * (h * 0.12));
    const sx = Math.round((m.x0 * w - tt * 18) % w);
    const sa = Math.sin(prog * Math.PI) * 0.25;
    if (sa < 0.02) continue;
    ctx.globalAlpha = sa;
    ctx.fillStyle = '#7ab0c0';
    ctx.fillRect(sx < 0 ? sx + w : sx, sy, m.sz, 1);
  }
  ctx.globalAlpha = 1;
}

// ---- acto3_fin: la grieta silenciosa · pájaros · el ojo se cierra ----
function sceneActo3(ctx: CanvasRenderingContext2D, w: number, h: number, tt: number): void {
  const def = SCENES[2];
  const gy = drawSky(ctx, def, w, h);

  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const a = 0.18 + 0.20 * Math.sin(tt * 1.1 + s.ph);
    ctx.globalAlpha = cl(a);
    ctx.fillStyle = '#cfd8e8';
    ctx.fillRect(Math.round(s.x * w), Math.round(s.y * h), 1, 1);
  }
  ctx.globalAlpha = 1;

  drawHills(ctx, w, gy, '#10141f', 3, 26);
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, gy - 4, w, 6);

  // ---- LA GRIETA: crece 1.4→4.4, late, se cierra 7.4→9.4 ----
  const grow = easeOutCubic(cl((tt - 1.4) / 3.0));
  const lid = easeInOut(cl((tt - 7.4) / 2.0));
  if (grow > 0.01) {
    const visLen = grow * (CRACK_N - 1);
    const coreA = (0.78 + 0.16 * Math.sin(tt * 9.0)) * (1 - lid);
    const segs = Math.floor(visLen);
    for (let i = 0; i < segs && i < CRACK_N - 1; i++) {
      const p = CRACK[i];
      const q = CRACK[i + 1];
      for (let sIdx = 0; sIdx < 4; sIdx++) {
        const k = sIdx / 4;
        const px = Math.round(lerp(p[0], q[0], k) * w);
        const py = Math.round(lerp(p[1], q[1], k) * h);
        ctx.globalAlpha = cl(0.10 * (1 - lid));
        ctx.fillStyle = '#bcd2ff';
        ctx.fillRect(px - 3, py - 3, 6, 6);              // halo pálido
        ctx.globalAlpha = cl(coreA);
        ctx.fillStyle = '#e8f0ff';
        ctx.fillRect(px - 1, py - 2, 2, 4);              // núcleo
      }
    }
    // ramillas (solo cuando la grieta las alcanzó)
    for (let b = 0; b < CRACK_BRANCH.length; b++) {
      const br = CRACK_BRANCH[b];
      if (visLen < br[0] + 1) continue;
      const p = CRACK[br[0]];
      const px0 = Math.round(p[0] * w);
      const py0 = Math.round(p[1] * h);
      ctx.globalAlpha = cl(0.5 * (1 - lid));
      ctx.fillStyle = '#e8f0ff';
      for (let j = 1; j <= 3; j++) {
        ctx.fillRect(px0 + Math.round(br[j * 2 - 1] * w), py0 + Math.round(br[j * 2] * h), 2, 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  // párpados que cierran la grieta como un ojo
  if (lid > 0.01) {
    const x0 = Math.round(w * 0.42);
    const x1 = Math.round(w * 0.60);
    const yTop = Math.round(h * 0.06);
    const yBot = Math.round(h * 0.58);
    const lidH = Math.round(lid * (yBot - yTop) * 0.5);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(x0, yTop, x1 - x0, lidH);
    ctx.fillRect(x0, yBot - lidH, x1 - x0, lidH);
    if (lid >= 1) {
      // cicatriz tenue que queda tras cerrarse
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#bcd2ff';
      ctx.fillRect(Math.round(w * 0.50) - 1, yTop, 2, yBot - yTop);
      ctx.globalAlpha = 1;
    }
  }

  // pájaros mudos cruzando (2 bandadas, ventana 2.6-7.8)
  const bga = cl((tt - 2.6) / 1.2) * cl((7.8 - tt) / 0.8);
  if (bga > 0.01) {
    ctx.fillStyle = '#05070c';
    for (let i = 0; i < BIRDS.length; i++) {
      const b = BIRDS[i];
      const span = w + 140;
      let x = (tt * b.spd + b.dx * 7) % span;
      if (x < 0) x += span;
      x -= 70;
      const y = Math.round(h * 0.16 + b.dy + Math.sin(tt * 1.7 + b.ph) * 5);
      ctx.globalAlpha = cl(bga * 0.85);
      const up = Math.floor(tt * 7 + b.ph) % 2 === 0;
      ctx.fillRect(Math.round(x) - 3, y + (up ? -1 : 1), 3, 1);   // ala izq
      ctx.fillRect(Math.round(x) + 1, y + (up ? -1 : 1), 3, 1);   // ala der
      ctx.fillRect(Math.round(x), y, 1, 2);                        // cuerpo
    }
    ctx.globalAlpha = 1;
  }

  // motas frías flotando
  for (let i = 0; i < MOTES_ASH1.length; i++) {
    const m = MOTES_ASH1[i];
    const prog = (m.y0 + tt * m.spd / 560) % 1;
    const ma = Math.sin(prog * Math.PI) * 0.16;
    if (ma < 0.02) continue;
    ctx.globalAlpha = ma;
    ctx.fillStyle = FALL_COL[m.ci];
    ctx.fillRect(Math.round(m.x0 * w + Math.sin(tt * m.sway + m.ph) * 10), Math.round(prog * gy), m.sz, m.sz);
  }
  ctx.globalAlpha = 1;
}

// ---- acto4_inicio: el umbral de niebla · el color se apaga ----
function sceneActo4(ctx: CanvasRenderingContext2D, w: number, h: number, tt: number): void {
  const def = SCENES[3];
  const gy = drawSky(ctx, def, w, h);

  drawHills(ctx, w, gy, '#1e242e', 4, 30);

  // ---- umbral de niebla: dos pilas pálidas con resplandor interior ----
  const th0 = Math.round(w * 0.44);
  const th1 = Math.round(w * 0.52);
  const thTop = Math.round(h * 0.30);
  const gateA = cl((tt - 0.8) / 1.2);
  ctx.globalAlpha = cl(0.10 * gateA + 0.02 * Math.sin(tt * 1.8));
  ctx.fillStyle = '#d8dee6';
  ctx.fillRect(th0, thTop, th1 - th0, gy - thTop);           // resplandor entre las pilas
  ctx.globalAlpha = cl(0.22 * gateA);
  ctx.fillRect(th0 - 8, thTop - 10, 8, gy - thTop + 10);     // pila izquierda
  ctx.fillRect(th1, thTop - 10, 8, gy - thTop + 10);         // pila derecha
  ctx.globalAlpha = cl(0.10 * gateA);
  ctx.fillRect(th0 - 14, thTop - 6, 6, gy - thTop + 6);
  ctx.fillRect(th1 + 8, thTop - 6, 6, gy - thTop + 6);
  ctx.globalAlpha = 1;

  // ---- figuras SIN ROSTRO a los lados, se inclinan a saludar ----
  const fxs = [0.16, 0.30, 0.70, 0.86];
  for (let i = 0; i < fxs.length; i++) {
    const ph = i * 0.9;
    const cyc = (tt + ph) % 3.1;
    const bow = cyc < 0.7 && Math.floor(cyc / 0.35) % 2 === 1;
    drawFaceless(ctx, Math.round(fxs[i] * w), gy, i % 2 === 0 ? 2 : 3, bow, '#11151c', cl((tt - 1.2 - ph * 0.3) / 0.8));
  }

  // ---- el portador cruza el umbral (2 frames de zancada, escala 2→3) ----
  const walkK = cl((tt - 1.0) / 8.0);
  const px = Math.round(lerp(0.28, 0.46, walkK) * w);
  const s = tt < 6.0 ? 2 : 3;
  const wf = Math.floor(tt / 0.42) % 2;
  drawBearer(ctx, px, gy, s, walkK <= 0 ? 0 : (wf === 0 ? 1 : 2), 0, '#05070c', 1);

  // ---- niebla rodante ----
  drawFog(ctx, tt, w, h);

  // ---- EL COLOR SE APAGA de fondo a primer plano (barrido 2.8→8.0) ----
  const sweep = easeInOut(cl((tt - 2.8) / 5.2));
  if (sweep > 0.01) {
    const yS = Math.round(-20 + sweep * (h + 40));
    ctx.fillStyle = '#9aa2ac';
    ctx.globalAlpha = 0.42;
    ctx.fillRect(0, 0, w, yS);                                // mundo gris por encima
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#d8dee6';
    ctx.fillRect(0, yS - 2, w, 2);                            // línea del barrido
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, yS - 8, w, 6);
    ctx.globalAlpha = 1;
  }
  const veil = cl((tt - 8.0) / 2.0) * 0.30;                   // velo final: todo desaturado
  if (veil > 0.01) {
    ctx.fillStyle = '#9aa2ac';
    ctx.globalAlpha = veil;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}

// ---- heraldo_vencido: cae de rodillas · capa vacía · nota quebrada ----
function sceneHeraldo(ctx: CanvasRenderingContext2D, w: number, h: number, tt: number): void {
  const def = SCENES[4];
  const gy = drawSky(ctx, def, w, h);

  // crestones de ceniza
  ctx.fillStyle = '#0d1018';
  for (let x = 0; x < w; x += 16) {
    const hg = Math.round(8 + hash2(x, 431) * 26);
    ctx.fillRect(x, gy - hg, 17, hg + 2);
  }

  // ceniza que cae
  for (let i = 0; i < MOTES_FALL.length; i++) {
    const m = MOTES_FALL[i];
    const prog = (m.y0 + tt * m.spd / 500) % 1;
    const ma = Math.sin(prog * Math.PI) * 0.30;
    if (ma < 0.02) continue;
    ctx.globalAlpha = ma;
    ctx.fillStyle = FALL_COL[m.ci];
    ctx.fillRect(Math.round(m.x0 * w + Math.sin(tt * 0.7 + m.ph) * 12), Math.round(prog * (gy + 16)), m.sz, m.sz);
  }
  ctx.globalAlpha = 1;

  const cx = Math.round(w * 0.5);

  // pulso rojo apagado en la caída (0.7→2.5, decae)
  const redA = 0.12 * Math.max(0, 1 - Math.max(0, tt - 0.7) / 1.8) * cl((tt - 0.5) / 0.2);
  if (redA > 0.01) {
    ctx.fillStyle = '#560a12';
    ctx.globalAlpha = redA;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // ---- cuerpo: parado (t<0.7) → hundiéndose (0.7-1.0) → de rodillas ----
  const bodyA = 1 - cl((tt - 4.5) / 0.5);          // se vacía a las 4.5-5.0
  drawCape(ctx, cx, gy, tt, false, '#232836', bodyA);  // capa llena detrás
  if (tt < 0.7) {
    drawBearer(ctx, cx, gy, 3, 0, 0, '#05070c', 1);
  } else if (tt < 1.0) {
    drawBearer(ctx, cx, gy, 3, 2, 0, '#05070c', 1);  // se dobla
  } else {
    const jx = Math.floor(tt * 2) % 2 === 0 ? 0 : (hash2(Math.floor(tt * 2), 441) < 0.5 ? -1 : 1);
    drawBearer(ctx, cx + jx, gy, 3, 3, 0, '#05070c', bodyA);
  }
  drawCape(ctx, cx, gy, tt, true, '#232836', 1 - bodyA); // contorno HUECO que sigue ondeando

  // polvo del impacto de rodillas (t=1.0, 0.8 s)
  if (tt >= 1.0 && tt < 1.9) {
    const dk = (tt - 1.0) / 0.9;
    ctx.fillStyle = '#78828c';
    for (let i = 0; i < DUST.length; i++) {
      const d = DUST[i];
      const dx = cx + Math.cos(d.a) * d.spd * dk;
      const dy = gy - 4 + Math.sin(d.a) * d.spd * dk * 0.3 + dk * dk * 14;
      ctx.globalAlpha = (1 - dk) * 0.5;
      ctx.fillRect(Math.round(dx), Math.round(dy), 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- la nota que sube (5.2→7.6) y se rompe en motas (7.6→9.4) ----
  if (tt >= 5.2 && tt < 7.6) {
    const nk = (tt - 5.2) / 2.4;
    const nx = cx + 10 + Math.sin(tt * 3.0) * 5 + nk * 26;
    const ny = Math.round(lerp(gy - 30, gy - 118, easeOutCubic(nk)));
    drawNote(ctx, nx, ny, '#cfe0ff', cl(nk * 4));
  }
  if (tt >= 7.6 && tt < 9.4) {
    const bk = tt - 7.6;
    const ex = cx + 10 + 26 + Math.sin(7.6 * 3.0) * 5;
    const ey = gy - 118;
    ctx.fillStyle = '#cfe0ff';
    for (let i = 0; i < NOTE_M.length; i++) {
      const nm = NOTE_M[i];
      const mx = ex + Math.cos(nm.a) * nm.spd * bk;
      const my = ey + Math.sin(nm.a) * nm.spd * bk * 0.5 - bk * nm.up;
      const ma = (1 - bk / 1.8) * 0.8;
      if (ma < 0.02) continue;
      ctx.globalAlpha = cl(ma);
      ctx.fillRect(Math.round(mx), Math.round(my), nm.sz, nm.sz);
    }
    ctx.globalAlpha = 1;
  }
}

// ---- eco_despierto: anillos del árbol · casa/barco/tumba · la mano ----
function sceneEco(ctx: CanvasRenderingContext2D, w: number, h: number, tt: number): void {
  const def = SCENES[5];
  const gy = drawSky(ctx, def, w, h);

  drawHills(ctx, w, gy, '#152218', 5, 28);

  // sol pálido de alba
  drawDisc(ctx, Math.round(w * 0.30), Math.round(h * 0.30), 9, '#e8d8a8', 0.4);

  // motas doradas/violetas que suben (el Eco despierto)
  for (let i = 0; i < MOTES_RISE.length; i++) {
    const m = MOTES_RISE[i];
    const prog = (m.y0 + tt * m.spd / (h * 1.1)) % 1;
    const ma = Math.sin(prog * Math.PI) * 0.5;
    if (ma < 0.02) continue;
    ctx.globalAlpha = ma;
    ctx.fillStyle = RISE_COL[m.ci];
    ctx.fillRect(Math.round(m.x0 * w + Math.sin(tt * m.sway + m.ph) * 10), Math.round(h * 0.82 - prog * h * 0.7), m.sz, m.sz);
  }
  ctx.globalAlpha = 1;

  // ---- árbol del Eco (silueta, centro) ----
  const tx = Math.round(w * 0.5);
  const baseY = gy + 6;
  ctx.fillStyle = '#0c1410';
  ctx.fillRect(tx - 3, baseY - 34, 6, 34);          // tronco
  ctx.fillRect(tx - 10, baseY - 26, 7, 3);          // rama izq
  ctx.fillRect(tx - 13, baseY - 31, 4, 6);
  ctx.fillRect(tx + 3, baseY - 29, 7, 3);           // rama der
  ctx.fillRect(tx + 9, baseY - 34, 4, 6);
  const bob = Math.floor(tt / 1.2) % 2;             // copa que respira
  ctx.fillRect(tx - 16, baseY - 46 - bob, 32, 10);  // copa
  ctx.fillRect(tx - 10, baseY - 52 - bob, 20, 6);
  ctx.fillRect(tx - 5, baseY - 56 - bob, 10, 4);
  ctx.fillRect(tx - 20, baseY - 42 - bob, 8, 5);
  ctx.fillRect(tx + 12, baseY - 43 - bob, 8, 5);

  // ---- anillos de crecimiento que se abren como ondas ----
  const rMax = Math.min(w, h) * 0.34;
  for (let i = 0; i < ECO_RING_T.length; i++) {
    const rt = ECO_RING_T[i];
    if (tt < rt) continue;
    const r = Math.min((tt - rt) * ECO_SPD, rMax);
    const ra = (1 - (tt - rt) * ECO_SPD / rMax) * 0.40;
    drawRingEl(ctx, tx, baseY - 20, r, r * 0.55, '#7ec8b8', ra);

    // mini-viñetas que cabalgan los anillos 2/4/6: casa → barco → tumba
    if (i === 1 || i === 3 || i === 5) {
      const iconK = i === 1 ? 0 : (i === 3 ? 1 : 2);
      const ang = i === 1 ? -2.25 : (i === 3 ? -0.85 : -1.55);
      const rr = Math.min((tt - rt) * ECO_SPD, rMax * 0.8);
      const ix = tx + Math.cos(ang) * rr;
      const iy = baseY - 20 + Math.sin(ang) * rr * 0.55;
      const ia = cl((tt - rt - 0.5) / 0.45) * cl((rt + 3.2 - tt) / 0.7);
      drawVignetteIcon(ctx, iconK, Math.round(ix), Math.round(iy), '#ffe9a0', ia);
    }
  }

  // ---- portador a la derecha: levanta la mano en t=8.4 ----
  const px = Math.round(w * 0.78);
  const s = 2;
  drawBearer(ctx, px, baseY, s, 0, 0, '#05070c', cl((tt - 0.6) / 0.8));
  if (tt >= 8.4) {
    ctx.fillStyle = '#05070c';
    const raise = cl((tt - 8.4) / 0.5);
    const ay = baseY - 10 * s - Math.round(raise * 4 * s);
    ctx.fillRect(px - 3 * s, ay, s, Math.round(raise * 4 * s) + s);  // brazo que sube
    ctx.fillRect(px - 4 * s, ay - s, s, s);                           // mano abierta
  }
}

// ---------------- Overlay compartido: viñeta · letterbox · beats · fades ----------------

const VIG_A: number[] = [0.30, 0.24, 0.19, 0.15, 0.11, 0.08, 0.06, 0.04, 0.03, 0.02];

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const band = Math.max(10, Math.round(Math.min(w, h) * 0.035));
  ctx.fillStyle = '#000000';
  for (let i = 0; i < VIG_A.length; i++) {
    const T = (i + 1) * band;
    ctx.globalAlpha = VIG_A[i];
    ctx.fillRect(0, 0, w, T);
    ctx.fillRect(0, h - T, w, T);
    ctx.fillRect(0, T, T, h - 2 * T);
    ctx.fillRect(w - T, T, T, h - 2 * T);
  }
  ctx.globalAlpha = 1;
}

const SKIP_HINT = 'E: SALTAR';

function drawBeats(ctx: CanvasRenderingContext2D, w: number, h: number, tt: number, barH: number): void {
  const def = SCENES[curIdx];
  for (let b = 0; b < def.beats.length; b++) {
    const bt = def.beats[b];
    if (tt < bt.t0 || tt > bt.t1 + 0.5) continue;
    const a = cl((tt - bt.t0) / 0.35) * cl((bt.t1 + 0.5 - tt) / 0.5);
    if (a <= 0.01) continue;

    const len1 = bt.l1.length;
    const k1 = Math.min(len1, Math.floor((tt - bt.t0) / CPS));
    const t2 = bt.t0 + len1 * CPS + 0.22;
    const k2 = Math.min(bt.l2.length, Math.floor((tt - t2) / CPS));

    bakeLine(bakeA, bt.l1);
    bakeLine(bakeB, bt.l2);

    const w1 = textW(len1, BEAT_S);
    const w2 = textW(bt.l2.length, BEAT_S);
    const x1 = Math.round((w - w1) / 2);
    const x2 = Math.round((w - w2) / 2);
    const y1 = h - barH - 96;
    const y2 = y1 + 7 * BEAT_S + 12;

    blitLine(ctx, bakeA, bt.l1, k1, x1, y1, a);
    blitLine(ctx, bakeB, bt.l2, k2, x2, y2, a);
  }
}

// ---------------- CONTRATO: ciclo de vida ----------------

/** startStoryScene — arranca la escena. Idempotente: ignora si ya hay una activa. */
export function startStoryScene(id: StorySceneId): void {
  const si = IDX[id];
  if (si === undefined || active) return;
  curIdx = si;
  t = 0;
  active = true;
  bakeA.line = '\u0000';   // invalida hornadas del beat anterior
  bakeB.line = '\u0000';
}

/** storySceneActive — true mientras la escena está en curso. */
export function storySceneActive(): boolean {
  return active;
}

/**
 * updateStoryScene — avanza el reloj (1× por frame). Safe si no hay escena.
 * Al terminar (natural) dispara onStorySceneEnd(cb) con el id.
 */
export function updateStoryScene(dt: number): void {
  if (!active) return;
  if (dt > 0) t += Math.min(dt, 0.1);
  if (t >= SCENES[curIdx].dur) {
    active = false;
    if (endCb !== null) endCb(SCENES[curIdx].id);
  }
}

/**
 * skipStoryScene — el orquestador la llama al pulsar E. Solo surte
 * efecto a partir de t ≥ 1.5 s (como pide el contrato); dispara
 * onStorySceneEnd igual que el final natural.
 */
export function skipStoryScene(): void {
  if (!active || t < 1.5) return;
  active = false;
  if (endCb !== null) endCb(SCENES[curIdx].id);
}

/** setStoryBackdropFn — inyecta el arte de fondos (contrato con R11-9). */
export function setStoryBackdropFn(fn: BackdropFn | null): void {
  backdropFn = fn;
}

/** onStorySceneEnd — registra el callback de fin (null para limpiar). */
export function onStorySceneEnd(cb: ((id: StorySceneId) => void) | null): void {
  endCb = cb;
}

// ---------------- CONTRATO: dibujo ----------------

/**
 * drawStoryScene — pinta el frame completo de la escena activa en el
 * canvas del motor. Orden: backdrop (inyectado o fallback de bandas) →
 * capas de escena (siluetas/partículas/fx) → velo atmosférico →
 * viñeta → letterbox → texto por beats + pista de salto → fade negro.
 * Safe si no hay escena activa.
 */
export function drawStoryScene(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!active) return;
  const def = SCENES[curIdx];
  const tt = t;
  const dur = def.dur;

  // ---- 1) fondo: R11-9 inyectado o bandas deterministas propias ----
  if (backdropFn !== null) {
    backdropFn(ctx, def.id, tt, w, h);
  } else {
    drawSky(ctx, def, w, h);
  }

  // ---- 2) capas de la escena ----
  switch (curIdx) {
    case 0: sceneActo1(ctx, w, h, tt); break;
    case 1: sceneActo2(ctx, w, h, tt, dur); break;
    case 2: sceneActo3(ctx, w, h, tt); break;
    case 3: sceneActo4(ctx, w, h, tt); break;
    case 4: sceneHeraldo(ctx, w, h, tt); break;
    default: sceneEco(ctx, w, h, tt); break;
  }

  // ---- 3) velo atmosférico por escena ----
  ctx.fillStyle = def.tint;
  ctx.globalAlpha = def.tintA;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  // ---- 4) viñeta escalonada ----
  drawVignette(ctx, w, h);

  // ---- 5) letterbox (barras que entran 0.7 s y salen 0.6 s) ----
  const barH = Math.round(h * 0.085);
  const barK = easeOutCubic(cl(tt / 0.7)) * (1 - cl((tt - (dur - 0.6)) / 0.6));
  const off = Math.round(barH * barK);
  if (off > 0) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, off - barH, w, barH);
    ctx.fillRect(0, h - off, w, barH);
  }

  // ---- 6) texto narrativo por beats (máquina de escribir) ----
  drawBeats(ctx, w, h, tt, barH);

  // ---- 7) pista de salto (desde t=2.2, hasta el fade final) ----
  if (tt >= 2.2 && tt < dur - 1.0) {
    drawTextPx(ctx, SKIP_HINT, w - 18 - textW(SKIP_HINT.length, 2), h - barH - 20, 2, COL_HINT);
  }

  // ---- 8) fades de entrada/salida (negro) ----
  const fin = 1 - cl(tt / 0.5);
  const fout = cl((tt - (dur - 0.8)) / 0.8);
  const black = Math.max(fin, fout);
  if (black > 0.004) {
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = black;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = 1;
}
