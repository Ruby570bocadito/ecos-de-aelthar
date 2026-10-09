// ============================================================
// ECOS DE AELTHAR — introscene.ts (módulo actors)
// R11-3 · CINEMÁTICA DE INICIO POR DISCIPLINA (ROADMAP 7.2,
//         "Inicio impresionante")
// ------------------------------------------------------------
// Cinemática de ~11 s que corre JUSTO después de crear el
// personaje y antes de despertar en Lunaris. DIFERENTE según
// la disciplina elegida en el creador:
//
//   'alba'    → LA ESPADACHINA DEL ALBA: amanecer. El cielo pasa
//               de negro índigo a oro en rampa ESCALONADA (sin
//               gradientes), la portadora aguarda en la loma con
//               la espada clavada, y el PRIMER RAYO barre el
//               valle de izquierda a derecha encendiéndolo
//               (columnas de luz + rim light en la silueta cuando
//               el barrido la cruza). Motas de polvo doradas.
//               Título "ACTO I — EL ALBA DE LA PORTADORA".
//
//   'tejedor' → EL TEJEDOR DE ECOS: noche. Telar cósmico: hilos
//               de luz que se tejen entre estrellas (béziers
//               cuadráticas con progreso determinista), luna
//               creciente propia (dibujo simple, NO importa de
//               world/sky.ts), un telar antiguo cuya lanzadera
//               deja estela de notas que ascienden. Título
//               "ACTO I — EL TEJIDO DE LOS ECOS".
//
// Ambas: letterbox superior/inferior, viñeta escalonada + grano
// sutil (mismo patrón que bossintro.ts/render.ts), fundido a
// negro final y callback de fin.
//
// CONTRATO PARA EL ORQUESTADOR (él cablea; este módulo NO toca
// engine.ts/screens.ts/render.ts):
//   1) Tras confirmar el creador (junto a g.newGame(nombre, disc))
//      →  startIntroScene(disc);   // disc: 'alba' | 'tejedor'
//   2) En el LOOP principal, mientras introSceneActive():
//        updateIntroScene(dt);      // 1× por frame, ANTES del mundo
//        (y BLOQUEAR update/input del mundo — la escena es pantalla
//         completa: no se pinta nada debajo)
//      y al final de render:
//        drawIntroScene(ctx, VIEW_W, VIEW_H); // espacio de VISTA
//   3) INPUT de saltar: en el handler de keydown, si
//      introSceneActive() → skipIntroScene() con CUALQUIER tecla.
//      El módulo IGNORA el skip antes de 1.5 s (protege el
//      establecimiento de la escena) y enseña el hint "E — SALTAR".
//      Al saltar, la timeline salta al fundido final (1.5 s), sin
//      corte seco.
//   4) FIN: onIntroEnd(fn) — se dispara 1× cuando el fundido
//      completa; ahí el orquestador hace g.startPlay() (despertar
//      en Lunaris). Los hooks NO expiran: registrar 1× y re-usar.
//   5) AUDIO (otro agente): onIntroBeat(fn) — fn(beatIndex) en los
//      golpes musicales del timeline (índices estables por
//      disciplina, ver BEATS). Este módulo NO importa nada de
//      audio.ts (el audio lo añade otro agente sobre este hook).
//
// TIMELINE ALBA (11 s — beats: 0.0 1.2 2.4 4.2 5.4 6.6 8.2):
//   0.00-0.70  fundido de entrada (negro → índigo), estrellas aún
//   1.20-4.50  el cielo se enciende por bandas (índigo→púrpura→
//              rosa→oro, rampa horneada en 12 pasos), el sol asoma
//   4.20-6.60  PRIMER RAYO: barrido horizontal que enciende el
//              valle; motas doradas; rim light en la portadora
//   6.90-9.50  título con tracking que converge + regla + subtítulo
//   9.50-11.0  fundido a negro + callback de fin
//
// TIMELINE TEJEDOR (11 s — beats: 0.0 1.4 2.2 4.0 5.2 6.4 7.2 8.4):
//   0.00-0.70  fundido de entrada, estrellas titilan, luna entra
//   1.40-4.00  el telar se perfila; urdimbre se tensa hilo a hilo
//   4.00-7.60  3 pasadas de trama: la lanzadera deja estela de
//              notas; hilos de luz se tejen entre las estrellas
//   7.60-9.50  título + regla + subtítulo
//   9.50-11.0  fundido a negro + callback de fin
//
// CONVENCIONES (las de bossintro.ts / horror.ts / fx.ts):
//   - DETERMINISMO TOTAL: cero Math.random; hash local `h2` con el
//     MISMO patrón que hash2 de world/palette.ts (fx.ts:45: devuelve
//     [0,0.5) → se normaliza). Se copia AQUÍ a propósito: el módulo
//     es AUTOCONTENIDO (cero imports) para no acoplarse a módulos
//     que otros agentes editan en paralelo.
//   - CERO allocations por frame en draw/update: todas las tablas
//     (motas, estrellas, loma, hilos, notas, bandas de cielo, grano)
//     se hornean 1× en startIntroScene; colores CONSTANTES +
//     globalAlpha (nunca strings rgba dinámicas); fillRect con
//     enteros; el texto se hornea a sprites de glifo 1× por color
//     (ruta directa fillRect si no hay DOM, como bossintro).
//   - Sin gradientes: rampas ESCALONADAS de bandas sólidas
//     (estética pixel-art del juego).
//   - drawIntroScene recibe (w, h): compatible con la vista
//     DINÁMICA del motor (fitViewToWindow). No lee VIEW_W/VIEW_H.
// ============================================================

// ---------------- Utilidades deterministas ----------------

/**
 * Hash determinista — MISMO patrón que hash2 de world/palette.ts
 * (que devuelve [0,0.5): aquí se normaliza a [0,1)). Copiado
 * localmente: módulo autocontenido, cero imports.
 */
function h2(a: number, b: number): number {
  let h = (a | 0) * 374761393 + (b | 0) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

// ---------------- Constantes de la escena ----------------

const DUR = 11.0;        // duración total (s)
const FADE_T0 = 9.5;     // inicio del fundido a negro
const SKIP_MIN = 1.5;    // el skip se ignora antes de este tiempo
const FADE_IN = 0.7;     // fundido de entrada
const TITLE_T_ALBA = 6.9;
const TITLE_T_TEJ = 7.6;

// Disciplinas: 'alba' | 'tejedor' (mismo union que SKILLS en data.ts
// y que Player.discipline en types.ts).
const D_ALBA = 0;
const D_TEJ = 1;

// Beats musicales por disciplina (índices estables para el hook de audio).
const BEATS: ReadonlyArray<ReadonlyArray<number>> = [
  [0.0, 1.2, 2.4, 4.2, 5.4, 6.6, 8.2],            // alba
  [0.0, 1.4, 2.2, 4.0, 5.2, 6.4, 7.2, 8.4],       // tejedor
];

// Paleta coherente con el juego (tonos apagados de palette.ts):
const COL_BLACK = '#000000';
const COL_BODY = '#100b14';     // silueta de la portadora
const COL_RIM = '#f4c878';      // rim light del alba
const COL_MOTE = '#f6d894';     // mota dorada
const COL_MOTE2 = '#e8b868';    // mota dorada apagada
const COL_SUN = '#f8dc88';
const COL_SUNCORE = '#fff2c0';  // núcleo del sol
const COL_GOLD = '#f2b45e';     // luz del rayo sobre el valle
const COL_RULE_A = '#f2c268';   // regla + título del alba
const COL_RULE_T = '#a8c0f0';   // regla + título del tejedor
const COL_SUB_A = '#f0e2c0';    // subtítulo alba (marfil cálido)
const COL_SUB_T = '#b8c8ec';    // subtítulo tejedor (azul pálido)
const COL_HINT = '#cfd8e8';     // hint "E — SALTAR"
const COL_STAR = '#c8d4f0';     // estrella fría
const COL_WSTAR = '#f0e8d0';    // estrella cálida
const COL_MOON = '#e8e4d0';     // luna
const COL_MOONDK = '#b8b4a0';   // cráteres
const COL_MOONSH = '#0a0d1f';   // terminador de la luna
const COL_WARP = '#3a3f6a';     // urdimbre (hilo vertical)
const COL_WEFT = '#d8b070';     // trama (hilo cálido)
const COL_SHUTTLE = '#1a1424';  // lanzadera
const COL_SHUTTOP = '#e8d8a0';  // brillo de la lanzadera
const COL_TH0 = '#8ea8f0';      // hilo entre estrellas (azul)
const COL_TH1 = '#c8a8f0';      // hilo entre estrellas (violeta)
const COL_TH2 = '#a8d0f0';      // hilo entre estrellas (hielo)
const COL_THTIP = '#ffffff';    // punta de la aguja
const COL_NOTE0 = '#f0c880';    // nota cálida
const COL_NOTE1 = '#9ab4f4';    // nota fría
const COL_VIG = '#000000';      // viñeta
const COL_GRAIN = '#000000';    // grano
const COL_HILL_A = '#120c14';   // loma del alba
const COL_HILL_T = '#080712';   // colinas del tejedor
const COL_LOOM = '#0c0a16';     // telar (silueta)
const COL_NEB = '#2a2a5c';      // nebulosa tenue

// Rampas del cielo ALBA (top→bottom, fracción vertical → color).
// Noche (índigo) y Alba (oro): se mezclan en 12 pasos HORNEADOS.
type Stop = readonly [number, string];
const RAMP_NIGHT: ReadonlyArray<Stop> = [
  [0.0, '#0b0a1c'], [0.3, '#141033'], [0.55, '#1d1545'],
  [0.78, '#241a50'], [1.0, '#2c2058'],
];
const RAMP_DAWN: ReadonlyArray<Stop> = [
  [0.0, '#1a1440'], [0.3, '#43235c'], [0.52, '#8a3d55'],
  [0.7, '#c96a48'], [0.85, '#e89a55'], [0.94, '#f2c268'], [1.0, '#f6d88a'],
];
const BAND_STEPS = 12;   // pasos de amanecer horneados
const BANDS = 18;        // bandas horizontales del cielo

/** Color de una rampa escalonada en la fracción f (banda sólida). */
function rampAt(ramp: ReadonlyArray<Stop>, f: number): string {
  for (let i = ramp.length - 1; i >= 0; i--) {
    const s = ramp[i];
    if (s !== undefined && f >= s[0]) return s[1];
  }
  const first = ramp[0];
  return first !== undefined ? first[1] : '#000000';
}

function hexToRgb(c: string): [number, number, number] {
  return [
    parseInt(c.charAt(1) + c.charAt(2), 16),
    parseInt(c.charAt(3) + c.charAt(4), 16),
    parseInt(c.charAt(5) + c.charAt(6), 16),
  ];
}

// Bandas de cielo horneadas: BAND_COLORS[paso][banda] (alba) y
// NIGHT_BANDS (tejedor, estático). Strings SOLO aquí, nunca en draw.
const BAND_COLORS: string[][] = [];
const NIGHT_BANDS: string[] = [];

function bakeBands(): void {
  if (BAND_COLORS.length > 0) return;
  for (let step = 0; step < BAND_STEPS; step++) {
    const row: string[] = [];
    const k = step / (BAND_STEPS - 1);
    for (let b = 0; b < BANDS; b++) {
      const f = b / (BANDS - 1);
      const a = hexToRgb(rampAt(RAMP_NIGHT, f));
      const c = hexToRgb(rampAt(RAMP_DAWN, f));
      const r = Math.round(lerp(a[0], c[0], k));
      const g = Math.round(lerp(a[1], c[1], k));
      const bl = Math.round(lerp(a[2], c[2], k));
      const hx = (v: number): string => (v < 16 ? '0' : '') + v.toString(16);
      row.push('#' + hx(r) + hx(g) + hx(bl));
    }
    BAND_COLORS.push(row);
  }
  // noche del tejedor: 10 bandas índigo frío estáticas
  const NB: ReadonlyArray<Stop> = [
    [0.0, '#05060f'], [0.25, '#0a0d1f'], [0.5, '#101531'],
    [0.75, '#161c3f'], [1.0, '#1c2348'],
  ];
  for (let b = 0; b < 10; b++) NIGHT_BANDS.push(rampAt(NB, b / 9));
}

// ---------------- Tipografía pixel 5×7 (solo fillRect) ----------------
// Misma idea que bossintro.ts: solo caja alta; el em dash de los
// títulos se mapea al glifo '-'. Solo los glifos que usan los
// títulos/subtítulo/hint de ESTA cinemática.

const FONT: Record<string, string[]> = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  B: ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
  C: [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '],
  D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
  J: ['  ###', '   # ', '   # ', '   # ', '   # ', '#  # ', ' ##  '],
  L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  R: ['#### ', '#   #', '#   #', '#### ', '#  # ', '# #  ', '#    '],
  S: [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', '#   #', ' # # ', ' # # ', '  #  '],
  Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
  Z: ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
  '-': ['     ', '     ', '     ', ' ### ', '     ', '     ', '     '],
  ' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
};

// '—' (em dash) → glifo '-' de la caja alta pixel
const ACCENT_OF: Record<string, string> = { '—': '-', '–': '-' };

// Títulos por disciplina (biblia 7.2); caja alta, tipografía pixel.
const TITLE: ReadonlyArray<string> = [
  'ACTO I — EL ALBA DE LA PORTADORA',
  'ACTO I — EL TEJIDO DE LOS ECOS',
];
const SUBTITLE: ReadonlyArray<string> = [
  'EL PRIMER RAYO DESPIERTA EL VALLE',
  'HILOS DE LUZ ENTRE ESTRELLAS',
];
const HINT = 'E — SALTAR';

function glyphOf(ch: string): string[] {
  const base = ACCENT_OF[ch];
  return FONT[base !== undefined ? base : ch] ?? FONT[' '];
}

function textW(str: string, s: number, track: number): number {
  return str.length <= 0 ? 0 : (str.length - 1) * (6 * s + track) + 5 * s;
}

/** Una pasada de texto SIN sombra (ruta directa, sin DOM). */
function drawTextPx(ctx: CanvasRenderingContext2D, str: string, x0: number, y0: number, s: number, track: number): void {
  let x = x0;
  for (let i = 0; i < str.length; i++) {
    const g = glyphOf(str.charAt(i));
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      if (row === undefined) continue;
      for (let c = 0; c < 5; c++) {
        if (row.charAt(c) === '#') ctx.fillRect(x + c * s, y0 + r * s, s, s);
      }
    }
    x += 6 * s + track;
  }
}

/**
 * Glifos HORNEADOS por color (1× por (escala,color), nunca por frame):
 * los títulos y el hint usan 5 colores fijos → 5 hornadas en total.
 * Sin DOM (harness): devuelve null y el draw va por fillRect directo.
 */
const COLOR_GLYPHS: Record<string, Record<string, HTMLCanvasElement> | null> = {};
let glyphFailed = false;

function coloredGlyphs(s: number, col: string): Record<string, HTMLCanvasElement> | null {
  const key = s + '|' + col;
  const hit = COLOR_GLYPHS[key];
  if (hit !== undefined) return hit;
  if (glyphFailed) { COLOR_GLYPHS[key] = null; return null; }
  try {
    const chars = Object.keys(FONT);
    const map: Record<string, HTMLCanvasElement> = {};
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === undefined) continue;
      const c = document.createElement('canvas');
      c.width = 5 * s;
      c.height = 7 * s;
      const x = c.getContext('2d');
      if (!x) { glyphFailed = true; COLOR_GLYPHS[key] = null; return null; }
      x.fillStyle = col;
      drawTextPx(x, ch, 0, 0, s, 0);
      map[ch] = c;
    }
    COLOR_GLYPHS[key] = map;
    return map;
  } catch {
    glyphFailed = true;
    COLOR_GLYPHS[key] = null;
    return null;
  }
}

/** Texto con sombra dura: sprites horneados o ruta directa (sin DOM). */
function drawTextShaded(
  ctx: CanvasRenderingContext2D, str: string, x0: number, y0: number,
  s: number, track: number, col: string, alpha: number,
): void {
  const spr = coloredGlyphs(s, col);
  ctx.fillStyle = COL_BLACK;
  ctx.globalAlpha = cl(0.65 * alpha);
  if (spr) {
    let x = x0;
    for (let i = 0; i < str.length; i++) {
      const ch = ACCENT_OF[str.charAt(i)] ?? str.charAt(i);
      const g = spr[ch];
      if (g) ctx.drawImage(g, x + s, y0 + s);
      x += 6 * s + track;
    }
    ctx.globalAlpha = cl(alpha);
    x = x0;
    for (let i = 0; i < str.length; i++) {
      const ch = ACCENT_OF[str.charAt(i)] ?? str.charAt(i);
      const g = spr[ch];
      if (g) ctx.drawImage(g, x, y0);
      x += 6 * s + track;
    }
  } else {
    drawTextPx(ctx, str, x0 + s, y0 + s, s, track);
    ctx.globalAlpha = cl(alpha);
    ctx.fillStyle = col;
    drawTextPx(ctx, str, x0, y0, s, track);
  }
  ctx.globalAlpha = 1;
}

// ---------------- Viñeta escalonada (caché, patrón bossintro) ----------------

let vigCv: HTMLCanvasElement | null = null;
let vigW = 0, vigH = 0;    // tamaño con el que se construyó
let noDoc = false;

function paintVig(x: CanvasRenderingContext2D, w: number, hh: number): void {
  // anillos concéntricos escalonados: bandas sólidas, sin gradientes
  const n = 10;
  const th = Math.max(14, Math.round(hh * 0.055));
  x.fillStyle = COL_VIG;
  for (let k = n - 1; k >= 1; k--) {
    const T = k * th;
    x.globalAlpha = 0.075;
    x.fillRect(0, 0, w, T);
    x.fillRect(0, hh - T, w, T);
    x.fillRect(0, T, T, hh - 2 * T);
    x.fillRect(w - T, T, T, hh - 2 * T);
  }
  x.globalAlpha = 1;
}

function ensureVig(w: number, hh: number): void {
  if (noDoc) return;
  if (vigCv && vigW === w && vigH === hh) return;
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    const x = c.getContext('2d');
    if (!x) { noDoc = true; return; }
    paintVig(x, w, hh);
    vigCv = c;
    vigW = w;
    vigH = hh;
  } catch {
    noDoc = true;
  }
}

// ---------------- Tablas horneadas de las escenas ----------------

interface Star { fx: number; fy: number; sz: number; ph: number; sp: number; warm: boolean }
interface Mote { fx: number; fy: number; spd: number; sw: number; amp: number; sz: number; ph: number; c2: boolean }
interface Thread { s0: number; s1: number; dx: number; dy: number; t0: number; dur: number; col: number }
interface Grain { fx: number; fy: number; fw: number; fh: number }
// Nota de la estela de la lanzadera: estado en FRACCIONES de w y pasadas
// (independiente de w/h reales — el draw lo resuelve a píxeles).
interface Note { fx: number; age: number; pass: number; hot: boolean; on: boolean }

const STARS: Star[] = [];      // 96 estrellas (ambas escenas)
const MOTES: Mote[] = [];      // 26 motas doradas (alba)
const THREADS: Thread[] = [];  // 7 hilos entre estrellas (tejedor)
const GRAIN: Grain[] = [];     // 150 celdas de grano
const NOTES: Note[] = [];      // pool FIJO de 14 notas (estela lanzadera)
const RIDGE: number[] = [];    // 65 alturas de la loma (fracción de h)
const HILL2: number[] = [];    // 65 alturas de las colinas (tejedor)
const NEB: number[] = [];      // 8 franjas de nebulosa: x,y,w,h (fracciones)

let bakedDisc = -1;            // disciplina horneada en las tablas

function bakeScene(d: number): void {
  if (bakedDisc === d) return;
  bakedDisc = d;
  STARS.length = 0;
  MOTES.length = 0;
  THREADS.length = 0;
  GRAIN.length = 0;
  NOTES.length = 0;
  RIDGE.length = 0;
  HILL2.length = 0;
  NEB.length = 0;
  for (let i = 0; i < 96; i++) {
    STARS.push({
      fx: h2(i, 11) * 0.98 + 0.01,
      fy: h2(i, 22) * 0.62,
      sz: h2(i, 33) < 0.78 ? 1 : 2,
      ph: h2(i, 44) * 6.283,
      sp: 0.6 + h2(i, 55) * 1.4,
      warm: h2(i, 66) < 0.25,
    });
  }
  for (let i = 0; i < 26; i++) {
    MOTES.push({
      fx: h2(i, 101) * 0.96 + 0.02,
      fy: 0.55 + h2(i, 102) * 0.4,
      spd: 8 + h2(i, 103) * 16,
      sw: 0.5 + h2(i, 104) * 0.8,
      amp: 6 + h2(i, 105) * 10,
      sz: h2(i, 106) < 0.6 ? 1 : 2,
      ph: h2(i, 107) * 6.283,
      c2: h2(i, 108) < 0.35,
    });
  }
  for (let i = 0; i < 7; i++) {
    THREADS.push({
      s0: Math.floor(h2(i, 201) * 44),
      s1: 48 + Math.floor(h2(i, 202) * 44),
      dx: (h2(i, 203) - 0.5) * 0.6,
      dy: -(0.06 + h2(i, 204) * 0.14),
      t0: 4.2 + i * 0.45,
      dur: 1.6,
      col: i % 3,
    });
  }
  for (let i = 0; i < 150; i++) {
    GRAIN.push({
      fx: h2(i, 301), fy: h2(i, 302),
      fw: 1 + Math.floor(h2(i, 303) * 3),
      fh: 1 + Math.floor(h2(i, 304) * 2),
    });
  }
  for (let i = 0; i < 14; i++) {
    NOTES.push({ fx: 0, age: 0, pass: 0, hot: false, on: false });
  }
  // loma del alba: anclas cada 8 columnas + interp coseno
  for (let i = 0; i <= 64; i++) {
    const a = Math.floor(i / 8);
    const u = (i - a * 8) / 8;
    const h0 = 0.72 + h2(a, 401) * 0.12;
    const h1 = 0.72 + h2(a + 1, 401) * 0.12;
    const wv = (1 - Math.cos(u * Math.PI)) / 2;
    RIDGE.push(lerp(h0, h1, wv));
  }
  // colinas del tejedor: más bajas y suaves
  for (let i = 0; i <= 64; i++) {
    const a = Math.floor(i / 16);
    const u = (i - a * 16) / 16;
    const h0 = 0.80 + h2(a, 501) * 0.06;
    const h1 = 0.80 + h2(a + 1, 501) * 0.06;
    const wv = (1 - Math.cos(u * Math.PI)) / 2;
    HILL2.push(lerp(h0, h1, wv));
  }
  for (let i = 0; i < 8; i++) {
    NEB.push(
      h2(i, 601) * 0.7, 0.08 + h2(i, 602) * 0.4,
      0.12 + h2(i, 603) * 0.22, 0.03 + h2(i, 604) * 0.05,
    );
  }
}

/** Altura de loma (px) en la columna fracción fx. */
function ridgeYAt(fx: number, h: number): number {
  const i = cl(fx) * 64;
  const i0 = Math.floor(i);
  const i1 = Math.min(64, i0 + 1);
  const r0 = RIDGE[i0] ?? 0.78;
  const r1 = RIDGE[i1] ?? 0.78;
  return lerp(r0, r1, i - i0) * h;
}

// ---------------- Estado del módulo ----------------

let on = false;            // cinemática en curso
let d = D_ALBA;            // disciplina activa (0 alba, 1 tejedor)
let t = 0;                 // reloj de la cinemática (s)
let nextBeat = 0;          // próximo beat por disparar
let endFired = false;      // el callback de fin ya se disparó (1×)
let lastNoteTick = -1;     // tick de nota de la pasada ACTUAL (determinista)
let curPass = -1;          // pasada de trama en curso (resetea lastNoteTick)
let noteHead = 0;          // cabeza del ring buffer de notas

let beatHook: ((beat: number) => void) | null = null;
let endHook: (() => void) | null = null;

/** Registra el hook de audio (fn(beatIndex)); null lo desengancha. */
export function onIntroBeat(fn: ((beat: number) => void) | null): void {
  beatHook = fn;
}

/** Callback de fin: se dispara 1× al completar el fundido a negro. */
export function onIntroEnd(fn: (() => void) | null): void {
  endHook = fn;
}

// ---------------- CONTRATO: ciclo de vida ----------------

/**
 * startIntroScene — arranca la cinemática de la disciplina `disc`.
 * Llamar 1× desde el orquestador justo tras confirmar el creador
 * (junto a g.newGame(nombre, disc)). IDEMPOTENTE: si ya está activa,
 * no hace nada. Re-hornea las tablas de la escena (1× por partida).
 */
export function startIntroScene(disc: 'alba' | 'tejedor'): void {
  if (on) return;
  d = disc === 'tejedor' ? D_TEJ : D_ALBA;
  bakeBands();
  bakeScene(d);
  t = 0;
  nextBeat = 0;
  endFired = false;
  lastNoteTick = -1;
  curPass = -1;
  noteHead = 0;
  for (let i = 0; i < NOTES.length; i++) {
    const n = NOTES[i];
    if (n) { n.on = false; n.age = 0; }
  }
  on = true;
}

/** introSceneActive — true durante los ~11 s de la cinemática. */
export function introSceneActive(): boolean {
  return on;
}

/**
 * updateIntroScene — avanza el timeline determinista (1× por frame).
 * Safe si no hay cinemática. Dispara los beats del hook de audio,
 * actualiza la estela de notas de la lanzadera (tejedor) y, al
 * completar el fundido, el callback de fin (1×).
 */
export function updateIntroScene(dt: number): void {
  if (!on) return;
  if (dt > 0) t += Math.min(dt, 0.1); // blindaje ante hitches (timeline determinista)
  const beats = BEATS[d];
  while (nextBeat < beats.length) {
    const bt = beats[nextBeat];
    if (bt === undefined || t < bt) break;
    if (beatHook) beatHook(nextBeat);
    nextBeat++;
  }
  if (d === D_TEJ) updateNotes(dt);
  if (t >= DUR) {
    on = false;
    if (!endFired) {
      endFired = true;
      if (endHook) endHook();
    }
  }
}

/**
 * Estela de notas de la lanzadera (SOLO update muta; el draw es puro):
 * 1 nota cada 0.18 s de pasada, en fracciones del recorrido (fx) para
 * no depender de w/h reales. Ring buffer fijo, cero allocations.
 */
function updateNotes(dt: number): void {
  const p0 = 4.0;
  const passIdx = Math.floor((t - p0) / 1.2);
  if (passIdx !== curPass) { curPass = passIdx; lastNoteTick = -1; }
  if (passIdx >= 0 && passIdx < 3) {
    const w0 = p0 + passIdx * 1.2;
    const pp = easeInOut(cl((t - w0) / 1.2));
    if (pp > 0.001 && pp < 1) {
      const tick = Math.floor((t - w0) / 0.18);
      if (tick > lastNoteTick) {
        lastNoteTick = tick;
        const slot = NOTES[noteHead % NOTES.length];
        if (slot) {
          const l2r = passIdx % 2 === 0;
          slot.fx = 0.40 + 0.20 * (l2r ? pp : 1 - pp);
          slot.age = 0;
          slot.pass = passIdx;
          slot.hot = (noteHead % 2) === 0;
          slot.on = true;
          noteHead++;
        }
      }
    }
  }
  for (let i = 0; i < NOTES.length; i++) {
    const n = NOTES[i];
    if (n && n.on) {
      n.age += dt;
      if (n.age >= 1.8) n.on = false; // vida 1.8 s, pool reutilizable
    }
  }
}

/**
 * skipIntroScene — CUALQUIER tecla mientras introSceneActive().
 * Se IGNORA antes de 1.5 s (protege el establecimiento). Al saltar,
 * la timeline salta AL FUNDIDO FINAL (1.5 s): sin corte seco; el
 * callback de fin se dispara igual al completarse.
 */
export function skipIntroScene(): void {
  if (!on || t < SKIP_MIN) return;
  if (t < FADE_T0) {
    t = FADE_T0;
    // los beats del tramo saltado NO suenan (4 golpes de golpe sonarían
    // mal): se descartan en silencio; el audio funde con el callback de fin
    const beats = BEATS[d];
    while (nextBeat < beats.length) {
      const bt = beats[nextBeat];
      if (bt === undefined || bt >= FADE_T0) break;
      nextBeat++;
    }
  }
}

// ---------------- Dibujo: utilidades de píxel ----------------

/** Disco pixelado por scanlines (sin path, sin antialias). */
function discPx(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, a: number): void {
  ctx.globalAlpha = cl(a);
  ctx.fillStyle = col;
  const R = Math.round(r);
  for (let dy = -R; dy <= R; dy++) {
    const half = Math.floor(Math.sqrt(R * R - dy * dy));
    ctx.fillRect(cx - half, cy + dy, half * 2, 1);
  }
  ctx.globalAlpha = 1;
}

/** Curva cuadrática muestreada a puntos de píxel (de Casteljau inline). */
function quadPx(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, cx: number, cy: number, x1: number, y1: number,
  p: number, n: number, sz: number, col: string, a: number,
): void {
  ctx.fillStyle = col;
  const nn = Math.max(1, Math.floor(n * p));
  for (let s = 0; s <= nn; s++) {
    const u = (s / n) * p;
    const v = 1 - u;
    const qx = v * v * x0 + 2 * v * u * cx + u * u * x1;
    const qy = v * v * y0 + 2 * v * u * cy + u * u * y1;
    ctx.globalAlpha = cl(a * (0.55 + 0.45 * (s / Math.max(1, nn))));
    ctx.fillRect(Math.round(qx), Math.round(qy), sz, sz);
  }
  ctx.globalAlpha = 1;
}

// ---------------- Dibujo: ESCENA ALBA (amanecer) ----------------

function drawAlba(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const dawnK = cl((t - 1.2) / 3.3);            // rampa noche→alba
  const step = Math.min(BAND_STEPS - 1, Math.floor(dawnK * BAND_STEPS));

  // ---- cielo: bandas horneadas (rampa escalonada, sin gradientes) ----
  const bandH = Math.ceil(h * 0.82 / BANDS);
  const row = BAND_COLORS[step];
  if (row) {
    for (let b = 0; b < BANDS; b++) {
      const c = row[b];
      if (c === undefined) continue;
      ctx.globalAlpha = 1;
      ctx.fillStyle = c;
      ctx.fillRect(0, b * bandH, w, bandH + 1);
    }
  }
  ctx.globalAlpha = 1;

  // ---- estrellas de la madrugada (se apagan con el amanecer) ----
  const starA = 1 - cl((t - 0.9) / 2.6);
  if (starA > 0.02) {
    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i];
      if (!s) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      const a = starA * (0.25 + 0.55 * tw);
      if (a < 0.04) continue;
      ctx.globalAlpha = cl(a);
      ctx.fillStyle = s.warm ? COL_WSTAR : COL_STAR;
      ctx.fillRect(Math.round(s.fx * w), Math.round(s.fy * h * 0.6), s.sz, s.sz);
    }
    ctx.globalAlpha = 1;
  }

  // ---- resplandor del horizonte (crece antes de que asome el sol) ----
  const glowK = cl((t - 1.6) / 2.2);
  if (glowK > 0.02) {
    const horizon = ridgeYAt(0.62, h);
    ctx.fillStyle = COL_GOLD;
    ctx.globalAlpha = cl(0.10 * glowK);
    ctx.fillRect(0, horizon - 26, w, 26);
    ctx.globalAlpha = cl(0.06 * glowK);
    ctx.fillRect(0, horizon - 52, w, 26);
    ctx.globalAlpha = 1;
  }

  // ---- sol asomando tras la loma (disco pixelado por scanlines) ----
  const riseK = easeOutCubic(cl((t - 2.2) / 3.4));
  if (riseK > 0.01) {
    const sunR = Math.round(h * 0.055) + 4;
    const sunX = Math.round(w * 0.62);
    const sunY = sunDropY(sunR, riseK, h);
    // halo escalonado (2 bandas) + disco + núcleo
    ctx.fillStyle = COL_SUN;
    ctx.globalAlpha = cl(0.10 * riseK);
    ctx.fillRect(sunX - sunR - 10, sunY - sunR - 10, (sunR + 10) * 2, (sunR + 10) * 2);
    ctx.globalAlpha = cl(0.08 * riseK);
    ctx.fillRect(sunX - sunR - 4, sunY - sunR - 4, (sunR + 4) * 2, (sunR + 4) * 2);
    ctx.globalAlpha = 1;
    discPx(ctx, sunX, sunY, sunR, COL_SUN, 1);
    discPx(ctx, sunX, sunY, Math.round(sunR * 0.6), COL_SUNCORE, 0.8);
  }

  // ---- PRIMER RAYO: barrido horizontal que enciende el valle ----
  const rayK = easeOutCubic(cl((t - 4.2) / 2.4));
  if (rayK > 0.01) {
    const sweepX = (rayK * 1.15 - 0.05) * w;
    // columnas del valle iluminadas (64 columnas de la loma)
    ctx.fillStyle = COL_GOLD;
    const colW = Math.ceil(w / 64);
    for (let i = 0; i < 64; i++) {
      const cx = ((i + 0.5) * w) / 64;
      const dist = Math.abs(cx - sweepX) / (w * 0.24);
      const a = cl(1 - dist);
      if (a < 0.02) continue;
      const ry = ridgeYAt((i + 0.5) / 64, h);
      ctx.globalAlpha = cl(a * 0.30);
      ctx.fillRect(i * colW, Math.round(ry), colW, h - Math.round(ry));
    }
    // cuña de luz desde el sol (4 columnas escalonadas, alpha decreciente)
    const sunY = sunDropY(Math.round(h * 0.055) + 4, 1, h);
    const wedgeH = h - sunY;
    for (let k = 0; k < 4; k++) {
      const ww = (k + 1) * Math.round(w * 0.012);
      ctx.globalAlpha = cl(0.07 * (1 - k * 0.22) * rayK);
      ctx.fillRect(sunX0(w) - ww, sunY, ww * 2, Math.round(wedgeH * (0.4 + k * 0.2)));
    }
    ctx.globalAlpha = 1;
  }

  // ---- loma en silueta (64 columnas sobre la rampa del valle) ----
  ctx.fillStyle = COL_HILL_A;
  ctx.globalAlpha = 1;
  const colW2 = Math.ceil(w / 64);
  for (let i = 0; i < 64; i++) {
    const ry = Math.round(ridgeYAt((i + 0.5) / 64, h));
    ctx.fillRect(i * colW2, ry, colW2 + 1, h - ry);
  }

  // ---- la portadora en la loma: silueta con espada clavada ----
  const charFx = 0.62;
  const cxp = Math.round(charFx * w);
  const baseY = Math.round(ridgeYAt(charFx, h));
  drawPortadora(ctx, cxp, baseY);

  // rim light cuando el barrido la cruza (momento clave del rayo)
  const rimK = cl(((rayK * 1.15 - 0.05) * w - (charFx * w - 14)) / (w * 0.14));
  if (rimK > 0.02) drawPortadoraRim(ctx, cxp, baseY, rimK);

  // ---- motas de polvo doradas (nacen con el rayo) ----
  const moteMul = cl((t - 4.0) / 0.8);
  if (moteMul > 0.02) {
    for (let i = 0; i < MOTES.length; i++) {
      const m = MOTES[i];
      if (!m) continue;
      const prog = (m.ph / 6.283 + (t * m.spd) / (h * 0.9)) % 1;
      const a = Math.sin(prog * Math.PI) * 0.5 * moteMul;
      if (a < 0.03) continue;
      const x = m.fx * w + Math.sin(t * m.sw + m.ph) * m.amp;
      const y = h - prog * h * 0.55 - (m.fy - 0.55) * h;
      ctx.globalAlpha = cl(a);
      ctx.fillStyle = m.c2 ? COL_MOTE2 : COL_MOTE;
      ctx.fillRect(Math.round(x), Math.round(y), m.sz, m.sz);
    }
    ctx.globalAlpha = 1;
  }

  // ---- título + subtítulo + regla ----
  drawTitle(ctx, w, h, TITLE_T_ALBA, COL_RULE_A, COL_SUB_A, 0.17);
}

/** X del sol (columna de la portadora: el alba la despierta de frente). */
function sunX0(w: number): number {
  return Math.round(w * 0.62);
}

/** Y del sol en función del alzamiento (arranca tras la loma). */
function sunDropY(sunR: number, riseK: number, h: number): number {
  const ry = ridgeYAt(0.62, h);
  return Math.round(ry + sunR * 1.6 - riseK * sunR * 2.6);
}

/**
 * Silueta de la Espadachina del Alba sobre la loma (px a escala 3):
 * capa, cabeza con capucha y la espada CLAVADA delante, en punta.
 */
function drawPortadora(ctx: CanvasRenderingContext2D, cx: number, baseY: number): void {
  const s = 3;
  const sway = Math.sin(t * 0.8) > 0.4 ? 1 : 0; // vaivén sutil de la capa
  ctx.globalAlpha = 1;
  ctx.fillStyle = COL_BODY;
  // capa (trapecio escalonado)
  for (let r = 0; r < 7; r++) {
    const wd = 3 + r + (r > 4 ? sway : 0);
    ctx.fillRect(cx - Math.floor((wd * s) / 2), baseY - 21 * s + r * 3 * s, wd * s, 3 * s);
  }
  // cabeza con capucha
  ctx.fillRect(cx - s * 2, baseY - 27 * s, 4 * s, 4 * s);
  ctx.fillRect(cx - s, baseY - 29 * s, 2 * s, 2 * s); // punta de la capucha
  // espada clavada en punta, delante y a la derecha
  const swx = cx + 8 * s;
  ctx.fillRect(swx, baseY - 22 * s, 2 * s, 22 * s);        // hoja hasta el suelo
  ctx.fillRect(swx - 3 * s, baseY - 22 * s, 8 * s, 2 * s); // guarda
  ctx.fillRect(swx, baseY - 27 * s, 2 * s, 5 * s);         // empuñadura
  ctx.fillRect(swx - s, baseY - 28 * s, 4 * s, 2 * s);     // pomo
  ctx.fillRect(swx - s, baseY - 23 * s, 4 * s, 3 * s);     // mano en la empuñadura
}

/** Rim light del lado del sol: columnas claras en el borde derecho. */
function drawPortadoraRim(ctx: CanvasRenderingContext2D, cx: number, baseY: number, k: number): void {
  const s = 3;
  ctx.fillStyle = COL_RIM;
  // borde derecho de la capa + capucha + filo de la hoja
  for (let r = 0; r < 7; r++) {
    const wd = 3 + r;
    ctx.globalAlpha = cl(k * (0.55 - r * 0.05));
    ctx.fillRect(cx + Math.floor((wd * s) / 2) - s, baseY - 21 * s + r * 3 * s, s, 3 * s);
  }
  ctx.globalAlpha = cl(k * 0.7);
  ctx.fillRect(cx + s * 2, baseY - 27 * s, s, 4 * s);
  ctx.globalAlpha = cl(k * 0.9);
  ctx.fillRect(cx + 8 * s + 2 * s, baseY - 22 * s, s, 22 * s); // filo de la hoja
  ctx.globalAlpha = 1;
}

// ---------------- Dibujo: ESCENA TEJEDOR (noche) ----------------

function drawTejedor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // ---- cielo nocturno: bandas estáticas horneadas ----
  const bandH = Math.ceil(h / 10);
  for (let b = 0; b < 10; b++) {
    const c = NIGHT_BANDS[b];
    if (c === undefined) continue;
    ctx.globalAlpha = 1;
    ctx.fillStyle = c;
    ctx.fillRect(0, b * bandH, w, bandH + 1);
  }
  ctx.globalAlpha = 1;

  // ---- nebulosa tenue (franja fría, alpha fijo) ----
  ctx.fillStyle = COL_NEB;
  for (let i = 0; i < 8; i++) {
    const nx = NEB[i * 4];
    const ny = NEB[i * 4 + 1];
    const nw = NEB[i * 4 + 2];
    const nh = NEB[i * 4 + 3];
    if (nx === undefined || ny === undefined || nw === undefined || nh === undefined) continue;
    ctx.globalAlpha = 0.06;
    ctx.fillRect(Math.round(nx * w), Math.round(ny * h), Math.round(nw * w), Math.round(nh * h));
  }
  ctx.globalAlpha = 1;

  // ---- estrellas titilando (fondo de la tela cósmica) ----
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    if (!s) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
    const a = 0.2 + 0.6 * tw;
    ctx.globalAlpha = cl(a);
    ctx.fillStyle = s.warm ? COL_WSTAR : COL_STAR;
    ctx.fillRect(Math.round(s.fx * w), Math.round(s.fy * h * 0.78), s.sz, s.sz);
  }
  ctx.globalAlpha = 1;

  // ---- luna creciente propia (NO importa de world/sky.ts) ----
  const moonIn = easeOutCubic(cl(t / 1.4));
  if (moonIn > 0.02) {
    const mx = Math.round(w * 0.8);
    const my = Math.round(h * 0.2);
    const mr = Math.round(h * 0.045);
    // halo escalonado
    ctx.fillStyle = COL_MOON;
    ctx.globalAlpha = cl(0.05 * moonIn);
    ctx.fillRect(mx - mr - 14, my - mr - 14, (mr + 14) * 2, (mr + 14) * 2);
    ctx.globalAlpha = cl(0.05 * moonIn);
    ctx.fillRect(mx - mr - 6, my - mr - 6, (mr + 6) * 2, (mr + 6) * 2);
    ctx.globalAlpha = 1;
    discPx(ctx, mx, my, mr, COL_MOON, moonIn);
    // terminador: disco de sombra desplazado (fase creciente fija k=0.5)
    discPx(ctx, mx + Math.round(mr * 2 * 0.5), my, mr, COL_MOONSH, moonIn);
    // cráteres (deterministas)
    ctx.fillStyle = COL_MOONDK;
    ctx.globalAlpha = cl(0.5 * moonIn);
    ctx.fillRect(mx - 8, my - 6, 4, 3);
    ctx.fillRect(mx + 2, my + 4, 5, 3);
    ctx.fillRect(mx - 2, my - 12, 3, 2);
    ctx.globalAlpha = 1;
  }

  // ---- hilos de luz tejiéndose entre estrellas ----
  for (let i = 0; i < THREADS.length; i++) {
    const th = THREADS[i];
    if (!th) continue;
    const s0 = STARS[th.s0];
    const s1 = STARS[th.s1];
    if (!s0 || !s1) continue;
    const p = easeInOut(cl((t - th.t0) / th.dur));
    if (p <= 0.01) continue;
    const x0 = s0.fx * w, y0 = s0.fy * h * 0.78;
    const x1 = s1.fx * w, y1 = s1.fy * h * 0.78;
    const cxq = (x0 + x1) / 2 + th.dx * w;
    const cyq = (y0 + y1) / 2 + th.dy * h;
    const col = th.col === 0 ? COL_TH0 : th.col === 1 ? COL_TH1 : COL_TH2;
    // hilo cosido (puntos de píxel a lo largo del bézier; brilla al asentarse)
    const shimmer = p >= 1 ? 0.5 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.8 + i * 1.7)) : 0.85;
    quadPx(ctx, x0, y0, cxq, cyq, x1, y1, p, 18, 2, col, shimmer);
    // punta brillante (la aguja) solo mientras se teje
    if (p < 1) {
      const u = p;
      const v = 1 - u;
      const tx = v * v * x0 + 2 * v * u * cxq + u * u * x1;
      const ty = v * v * y0 + 2 * v * u * cyq + u * u * y1;
      ctx.fillStyle = COL_THTIP;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(Math.round(tx) - 3, Math.round(ty) - 3, 7, 7);
      ctx.globalAlpha = 1;
    }
  }

  // ---- colinas en silueta (fondo del telar) ----
  ctx.fillStyle = COL_HILL_T;
  ctx.globalAlpha = 1;
  const colW = Math.ceil(w / 64);
  for (let i = 0; i < 64; i++) {
    const r0 = HILL2[i] ?? 0.83;
    const ry = Math.round(r0 * h);
    ctx.fillRect(i * colW, ry, colW + 1, h - ry);
  }

  // ---- el telar antiguo + lanzadera + estela de notas ----
  drawLoom(ctx, w, h);

  // ---- título + subtítulo + regla ----
  drawTitle(ctx, w, h, TITLE_T_TEJ, COL_RULE_T, COL_SUB_T, 0.30);
}

/**
 * El telar cósmico: silueta con postes y travesaño, urdimbre que se
 * tensa hilo a hilo (1.4-4.0 s) y 3 pasadas de trama de la lanzadera
 * (4.0-7.6 s, alternando dirección). La estela de NOTAS la muta
 * updateNotes() en update; el draw es puro (función de t).
 */
function drawLoom(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const lx0 = Math.round(w * 0.40);
  const lx1 = Math.round(w * 0.60);
  const baseY = Math.round(h * 0.90);
  const topY = Math.round(h * 0.60);
  ctx.fillStyle = COL_LOOM;
  ctx.globalAlpha = 1;
  // postes + travesaño + base
  ctx.fillRect(lx0 - 3, topY, 6, baseY - topY);
  ctx.fillRect(lx1 - 3, topY, 6, baseY - topY);
  ctx.fillRect(lx0 - 8, topY, lx1 - lx0 + 16, 6);
  ctx.fillRect(lx0 - 8, baseY - 5, lx1 - lx0 + 16, 5);

  // urdimbre: hilos verticales que se tensan uno a uno (determinista)
  const warpN = 11;
  const warpK = cl((t - 1.4) / 2.6);
  const lit = Math.floor(warpK * warpN + 0.0001);
  for (let i = 0; i < warpN; i++) {
    const wx = lx0 + Math.round(((i + 1) * (lx1 - lx0)) / (warpN + 1));
    ctx.globalAlpha = i < lit ? 0.55 : 0.16;
    ctx.fillStyle = COL_WARP;
    ctx.fillRect(wx, topY + 6, 1, baseY - topY - 12);
  }
  ctx.globalAlpha = 1;

  // pasadas de trama: 3 hilos horizontales con lanzadera (4.0-7.6 s)
  for (let p = 0; p < 3; p++) {
    const p0 = 4.0 + p * 1.2;
    const pp = easeInOut(cl((t - p0) / 1.2));
    if (pp <= 0.001) continue;
    const wy = topY + 12 + p * 8;
    const l2r = p % 2 === 0;
    const xa = l2r ? lx0 : lx1;
    const xb = l2r ? lx1 : lx0;
    const xcur = lerp(xa, xb, pp);
    // hilo tejido (con comba suave, muestreado a píxeles)
    const steps = Math.max(2, Math.floor(Math.abs(xb - xa) / 6));
    ctx.fillStyle = COL_WEFT;
    for (let sgi = 0; sgi <= steps; sgi++) {
      const u = (sgi / steps) * pp;
      const sag = Math.sin((sgi / steps) * Math.PI) * 2.2;
      ctx.globalAlpha = pp >= 1 ? 0.42 : 0.8;
      ctx.fillRect(Math.round(lerp(xa, xb, u)), Math.round(wy + sag), 2, 2);
    }
    // lanzadera (con brillo superior) solo durante la pasada
    if (pp < 1) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = COL_SHUTTLE;
      ctx.fillRect(Math.round(xcur) - 4, Math.round(wy) - 2, 9, 5);
      ctx.fillStyle = COL_SHUTTOP;
      ctx.fillRect(Math.round(xcur) - 3, Math.round(wy) - 2, 7, 1);
    }
  }
  ctx.globalAlpha = 1;

  // estela de notas ascendentes (pool fijo; estado mutado en update)
  for (let i = 0; i < NOTES.length; i++) {
    const n = NOTES[i];
    if (!n || !n.on) continue;
    const a = 1 - n.age / 1.8;
    if (a <= 0.02) continue;
    const wy = topY + 12 + n.pass * 8;
    const x = Math.round(n.fx * w + Math.sin(n.age * 3 + i) * 3);
    const y = Math.round(wy - 4 - n.age * 12);
    ctx.fillStyle = n.hot ? COL_NOTE0 : COL_NOTE1;
    ctx.globalAlpha = cl(a * 0.9);
    ctx.fillRect(x, y + 4, 3, 2);        // cabeza
    ctx.fillRect(x + 2, y, 1, 5);        // asta
    ctx.fillRect(x + 3, y, 2, 1);        // banderín
  }
  ctx.globalAlpha = 1;
}

// ---------------- Título con tracking animado ----------------

/**
 * Título "ACTO I — ..." con tracking que CONVERGE (las letras entran
 * separadas y se asientan), regla que se abre del centro y subtítulo
 * (un pelo más tarde). Toda la geometría es función pura de t.
 */
function drawTitle(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  titleT: number, titleCol: string, subCol: string, yFrac: number,
): void {
  const aT = cl((t - titleT) / 0.9);
  if (aT <= 0.01) return;
  const str = TITLE[d];
  const sub = SUBTITLE[d];
  const s = 3;
  const track = Math.round((1 - easeOutCubic(aT)) * 5); // separación extra → 0
  const rise = Math.round((1 - easeOutCubic(aT)) * 8);
  const tw = textW(str, s, track);
  const tx = Math.round((w - tw) / 2);
  const ty = Math.round(yFrac * h) + rise;
  drawTextShaded(ctx, str, tx, ty, s, track, titleCol, aT);

  // regla que se abre del centro
  const aR = cl((t - titleT - 0.25) / 0.5);
  if (aR > 0.01) {
    const rw = Math.round(tw * easeOutCubic(aR));
    if (rw >= 4) {
      const rx = Math.round((w - rw) / 2);
      const ry = ty + 7 * s + 9;
      ctx.fillStyle = COL_BLACK;
      ctx.globalAlpha = cl(0.5 * aR);
      ctx.fillRect(rx - 1, ry + 1, rw + 2, 2);
      ctx.fillStyle = titleCol;
      ctx.globalAlpha = cl(aR);
      ctx.fillRect(rx, ry, rw, 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = cl(aR);
      ctx.fillRect(rx, ry, 2, 2);
      ctx.fillRect(rx + rw - 2, ry, 2, 2);
      ctx.globalAlpha = 1;
    }
  }

  // subtítulo (escala 2, aparece después)
  const aS = cl((t - titleT - 0.45) / 0.6);
  if (aS > 0.01) {
    const sw = textW(sub, 2, 0);
    drawTextShaded(ctx, sub, Math.round((w - sw) / 2), ty + 7 * s + 17, 2, 0, subCol, aS);
  }
}

// ---------------- Overlays comunes (grano, hint) ----------------

function drawOverlays(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // ---- grano sutil (150 celdas horneadas, ventana deslizante por tick) ----
  const tick = Math.floor(t * 12);
  const start = (tick * 7) % GRAIN.length;
  ctx.fillStyle = COL_GRAIN;
  for (let k = 0; k < 50; k++) {
    const g = GRAIN[(start + k) % GRAIN.length];
    if (!g) continue;
    ctx.globalAlpha = 0.05;
    ctx.fillRect(Math.round(g.fx * w), Math.round(g.fy * h), g.fw, g.fh);
  }
  ctx.globalAlpha = 1;

  // ---- hint "E — SALTAR" (tras 1.5 s, hasta el fundido) ----
  if (t > SKIP_MIN && t < FADE_T0) {
    const aH = 0.42 + 0.15 * Math.sin(t * 2.4);
    const hw = textW(HINT, 1, 0);
    drawTextShaded(ctx, HINT, Math.round((w - hw) / 2), h - Math.round(h * 0.115) - 14, 1, 0, COL_HINT, aH);
  }
}

// ---------------- CONTRATO: dibujo ----------------

/**
 * drawIntroScene — pinta la cinemática COMPLETA en espacio de VISTA
 * (el orquestador la llama con el ctx del motor y VIEW_W/VIEW_H).
 * Orden: cielo → astros → hilos/rayo → siluetas → partículas →
 * título → viñeta → letterbox → grano → hint → fundido. Safe si no
 * hay cinemática (return inmediato). Cero allocations por frame.
 */
export function drawIntroScene(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!on) return;
  ensureVig(w, h);

  if (d === D_ALBA) drawAlba(ctx, w, h);
  else drawTejedor(ctx, w, h);

  // ---- viñeta escalonada (cacheada por tamaño, patrón bossintro) ----
  if (vigCv) {
    ctx.globalAlpha = 1;
    ctx.drawImage(vigCv, 0, 0);
  } else if (noDoc) {
    paintVig(ctx, w, h);
  }

  // ---- letterbox superior/inferior (entra en 0.5 s) ----
  const barH = Math.round(h * 0.115);
  const off = Math.round(barH * easeOutCubic(cl(t / 0.5)));
  if (off > 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = COL_BLACK;
    ctx.fillRect(0, off - barH, w, barH);
    ctx.fillRect(0, h - off, w, barH);
  }

  // ---- grano + hint ----
  drawOverlays(ctx, w, h);

  // ---- fundidos: entrada (0→0.7 s) y salida final a negro ----
  const fadeOut = easeInCubic(cl((t - FADE_T0) / (DUR - FADE_T0)));
  const fadeIn = 1 - easeOutCubic(cl(t / FADE_IN));
  const blackA = Math.max(fadeIn, fadeOut);
  if (blackA > 0.003) {
    ctx.globalAlpha = cl(blackA);
    ctx.fillStyle = COL_BLACK;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
