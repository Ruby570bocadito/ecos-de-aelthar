// ============================================================
// ECOS DE AELTHAR — Humanoides pixel (módulo actors)
// HumanPal, layout, ciclo de andar de 6 fases + 2 frames de
// idle (respiración/parpadeo) por dirección, frameIndex y
// entityFrame. Generación procedural, sin assets.
//
// R2-A1 — mejoras sin romper el contrato del motor:
//  · Ciclo de andar de 6 frames por dirección:
//      [zancadaA, contacto-medio, pase+1px, zancadaB, contacto-medio, pase+1px]
//    → 24 frames en total: 3 bloques de 8 (down 0-7, up 8-15, side 16-23);
//    dentro de cada bloque, los índices 6 y 7 son los frames de IDLE
//    (respiración + parpadeo) añadidos al final del bloque.
//  · Más modelo por píxel: doble contorno en silueta (borde oscuro +
//    medio tono interior), sombra de cuello, brillo 1px en hombros y
//    cabeza (luz arriba-izquierda), manos 2×2 en skin, cinturón con
//    hebilla 1px y botas con suela oscura.
//  · Terror sutil (sombra/esqueleto): ojos que parpadean en ámbar/
//    vacío, vetas de niebla translúcidas, postura encorvada (cabeza
//    1px más baja) y, en el esqueleto, mandíbula suelta (flag jaw)
//    y costillas marcadas (ribs). Activado EXPLÍCITAMENTE en
//    palettes.ts añadiendo los flags nuevos a las paletas 'sombra'
//    (dread) y 'esqueleto' (dread + jaw); dreadOf() mantiene la
//    deducción legacy como red de seguridad retrocompatible.
//    Todo va horneado en los frames prerrenderizados: coste en
//    runtime = 0.
//  · FIX de dirección: el motor pasa Dir = down/up/left/right (y la
//    estela de rodadura lo mismo), así que entityFrame trata
//    left/right/side como bloque LATERAL (frameIndex ya lo hacía
//    con su else; entityFrame comparaba con 'side' y nunca casaba).
//    side sigue dibujándose mirando a la DERECHA; render.ts hace el
//    flip para 'left' (no se toca).
//
// R2-A6 — identidad visual por personaje (flags NUEVOS, SOLO aditivos):
//  · chest?    → emblema/broche 1px en el pecho (hero_alba: sol dorado,
//                Brisa: broche cálido, Corvin: alfiler de gorguera, Toln: rescoldo).
//  · beardS?   → segundo tono de barba en zigzag = trenza (Brokk).
//  · cape? / capeC? / capeLong? → paneles de capa 1px a los costados
//                (corta: 3 filas; larga: hasta el cinturón) con bordado
//                1px en accent aclarado (Tejedor, Kael, Gran Inquisidor).
//  · feather?  → pluma 1px en accent sobre el hombro derecho/capucha (Ilwen).
//  · band?     → diadema/cinta 1px en accent sobre la corona (Maelis).
//  Todos son OPCIONALES: si no se definen, el dibujado es idéntico al
//  de R2-A1 (retrocompatible, coste 0).
//
// R6-V9 — humanoides v3 (el MISMO personaje, mejor ejecutado):
//  · Proporciones: cintura 1px más estrecha por lado que los hombros
//    (fila del cinturón de 6 px frente al talle de 8; 4 frente a 6 de
//    perfil) + brillo de hombrera 1px sobre cada brazo.
//  · Mechón de vuelo 1px en la coronilla, que se mece en las fases
//    de pase (acompaña al bob existente).
//  · Perfil de nariz 1px en los frames laterales (bajo la curva
//    frontal del cráneo; la máscara lisa se queda lisa).
//  · Insignia de gremio sutil de 2-3 px en accent: pecho de frente,
//    espalda de espaldas y 1-2 px de perfil. Quien ya tiene emblema
//    propio (chest) o es puro hueso (ribs) no la lleva.
//  · Andar verificado: bob vertical 1px en las fases centrales (pase
//    2 y 5 + aire idle 7) y swing de brazos opuesto; frameIndex y
//    entityFrame conservan firma y comportamiento. Suela oscura de
//    bota y cinturón accent ya horneados se conservan. Canvas 16×H
//    intacto y todos los flags de paleta se siguen respetando.
//
// R9-6 — portador animaciones fluidas (2.7): TODO horneado en los
//  frames prerrenderizados (coste runtime 0, cero allocations, sin
//  Math.random; firmas export intactas).
//  · ANDAR con vida: balanceo de CADERA ±1px por fase (piernas y
//    botas desplazan el anclaje, el torso contra-resta), bajo de la
//    túnica que sigue 1 fase detrás (lag de tela), mechón/cabello y
//    capa con 1-2 px de retraso respecto al cuerpo, punta de melena
//    que lastra el giro y mechón de nuca de perfil al asentar el paso.
//  · SILUETA: contorno 1px completo donde se perdía (columnas
//    exteriores de ambos brazos, curva frontal de perfil, filas
//    inferiores del cráneo), coronilla redondeada y hombros en
//    trapecio (postura más erguida/elegante sin cambiar canvas ni
//    índices: el retrato del creador usa los frames 6/7 tal cual).
//  · IDLE: respiración real ~2 s — frame 8 NUEVO (torso arriba, ojos
//    abiertos) alterna con el 6; el 7 conserva su rol de parpadeo
//    (idleBlink intacto). 27 frames: 9 por bloque (6 andar + 3 idle).
//  · ATAQUE/ESQUIVA (poses nuevas, export aditivo): buildAttackPoses
//    devuelve [anticipación, golpe] × 3 direcciones — anticipación con
//    el cuerpo girado 1px atrás y brazos en guardia (chispa accent en
//    el arma), golpe con estirón, brazo extendido, puño contorneado y
//    estela de movimiento 1px. buildRollPoses: pose inclinada de
//    voltereta por dirección. render.ts ya consume getAttackFrames /
//    getCastFrames (contrato R3-c) y fx.ts ya estela la rodadura:
//    el enganche de 3 líneas queda documentado en cada builder.
// ============================================================

import { mkCanvas, px, type Frames } from './util';

export interface HumanPal {
  outline: string;
  hair: string; hairS?: string;
  skin: string;
  body: string; bodyS: string;
  accent: string;
  legs: string; legsS?: string;
  boots: string;
  eye: string;
  hood?: boolean;
  ribs?: boolean;
  jaw?: boolean;            // mandíbula suelta (muerto viviente): hueco oscuro + hueso descolgado
  beard?: string;
  // --- rasgos del agente 3-a (biblia de personajes) ---
  small?: boolean;          // niño (Teo): proporciones compactas
  big?: boolean;            // Gran Inquisidor: escala ×2 (32×36)
  ears?: 'cat' | 'elf';     // orejas felinas / élficas
  mask?: boolean;           // máscara lisa sin boca (Gran Inquisidor)
  maskC?: string;           // color de la máscara
  hammer?: boolean;         // martillo en la mano (Brokk)
  hairLong?: boolean;       // melena larga (Maelis, Nimue)
  pauldrons?: boolean;      // hombreras (Kael)
  leafy?: boolean;          // hojas en hombros (Doran)
  messy?: boolean;          // pelo revuelto (Teo)
  // --- R2-A1 · terror sutil (SOLO aditivos, opcionales) ---
  dread?: boolean;          // fuerza modo terror: niebla, ojos ámbar/vacío, encorvado
  dreadC?: string;          // color de las vetas de niebla (def.: accent o hueso)
  dreadEye?: string;        // color ámbar del parpadeo ocular (def.: #ffb054)
  // --- R2-A6 · identidad visual (SOLO aditivos, opcionales: undefined = sin cambio) ---
  chest?: string;           // emblema/broche 1px en el pecho (solo de frente)
  beardS?: string;          // 2º tono de barba en zigzag → trenza (Brokk)
  cape?: boolean;           // capa: paneles 1px a los costados del torso
  capeC?: string;           // color de la capa (def.: bodyS); bajo con bordado accent aclarado
  capeLong?: boolean;       // capa larga hasta el cinturón (Gran Inquisidor); def.: corta
  feather?: boolean;        // pluma 1px en accent sobre el hombro derecho (Ilwen)
  band?: boolean;           // diadema/cinta 1px en accent sobre la corona (Maelis)
}

interface Layout {
  H: number;        // alto del canvas
  headTop: number;  // fila de la masa de pelo
  faceTop: number;  // fila de piel
  bodyTop: number;  // fila del torso
  bodyH: number;    // filas de torso (incluye fila de contorno)
  armLen: number;   // largo del brazo sin mano
}

export function layoutFor(pal: HumanPal): Layout {
  if (pal.small) return { H: 15, headTop: 0, faceTop: 3, bodyTop: 7, bodyH: 4, armLen: 3 };
  return { H: 18, headTop: 1, faceTop: 4, bodyTop: 8, bodyH: 6, armLen: 4 };
}

// ---------------- utilidades de tono (locales, no tocan la paleta global) ----------------

/** Parsea '#rgb'/'#rrggbb' a [r,g,b]. */
function rgbOf(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Multiplica un color hex por f (clamp 255) — sombreado/iluminación puntual. */
function tone(hex: string, f: number): string {
  const [r, g, b] = rgbOf(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${c(r).toString(16).padStart(2, '0')}${c(g).toString(16).padStart(2, '0')}${c(b).toString(16).padStart(2, '0')}`;
}

/** Color hex → rgba() translúcido (vetas de niebla). */
function rgba(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Luminancia relativa < umbral → color "oscuro". */
function isDark(hex: string): boolean {
  const [r, g, b] = rgbOf(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.22;
}

/**
 * ¿Personaje de terror? El flag explícito `dread` manda (lo activan
 * las paletas 'sombra' y 'esqueleto' en palettes.ts); si no existe,
 * se deduce de la paleta legacy como red de seguridad retrocompatible:
 *  · ribs → esqueleto (única paleta con costillas)
 *  · capucha + piel y túnica casi negras → sombra
 */
function dreadOf(pal: HumanPal): boolean {
  if (pal.dread !== undefined) return pal.dread;
  if (pal.ribs) return true;
  return pal.hood === true && isDark(pal.skin) && isDark(pal.body);
}

// ---------------- fotogramas ----------------

/**
 * Dibuja un fotograma humanoide.
 *
 * ph (fase continua del ciclo):
 *   0 zancada A · 1 contacto-medio · 2 pase (+1px de bamboleo)
 *   3 zancada B · 4 contacto-medio · 5 pase (+1px)
 *   6 idle neutro (ojos abiertos, pecho abajo)
 *   7 idle aire/parpadeo (pecho 1px arriba, ojos cerrados)
 *   8 idle respiración (pecho 1px arriba, ojos abiertos)
 *
 * act (poses de acción, R9-6; 0 = andar/idle normal):
 *   1 anticipación de ataque · 2 golpe · 3 voltereta (agachada).
 *
 * `bobFix` permite forzar el bamboleo (compatibilidad); si se omite se
 * deriva de la fase. El orden de dibujado es torso→cabeza→brazos→
 * piernas para que la cabeza encorvada y la mandíbula suelta del
 * esqueleto solapen el pecho de forma correcta.
 */
function drawFrame(
  x: CanvasRenderingContext2D, pal: HumanPal,
  dir: 'down' | 'up' | 'side', ph: number, L: Layout, bobFix?: number,
  act = 0,
): void {
  const dread = dreadOf(pal);
  const jawLoose = pal.jaw === true || pal.ribs === true;   // mandíbula suelta
  const hs = pal.hairS ?? pal.hair;
  const ls = pal.legsS ?? pal.legs;
  const idle = ph >= 6;                                  // frames 6/7/8 de reposo
  // R6-V9 · andar verificado: bob vertical 1px en las fases CENTRALES
  // de cada paso (pase 2 y 5, más los aires idle 7 y 8) y swing de
  // brazos OPUESTO entre ambos lados; frameIndex/entityFrame lo consumen igual.
  const bob = act === 3 ? 1 : bobFix ?? ((ph === 2 || ph === 5 || ph === 7 || ph === 8) ? -1 : 0);
  // R9-6 · anticipación/golpe: el torso y la cabeza se inclinan 1px
  // atrás (viento) o adelante (estirón); de perfil la inclinación es
  // horizontal (translate del bloque superior, piernas ancladas).
  const leanY = act === 1 ? (dir === 'down' ? -1 : dir === 'up' ? 1 : 0)
    : act === 2 ? (dir === 'down' ? 1 : dir === 'up' ? -1 : 0) : 0;
  const hy = (dread ? 1 : 0) + (act === 3 ? 1 : 0);      // encorvado + cabeza agachada en la voltereta
  const hT = L.headTop + bob + leanY;                    // ancla de cabeza (con bamboleo)
  const fT = L.faceTop + bob + leanY;
  const bT = L.bodyTop + bob + leanY;                    // torso (las piernas quedan ancladas)
  const bodyBot = bT + L.bodyH - 1;                      // última fila del torso (contorno)
  const legY = bodyBot + 1;                              // piernas ancladas al suelo
  const bootY = L.H - 1;
  const legH2 = bootY - 1 - legY;                        // filas de pierna (bota y suela aparte)

  // paleta derivada (más modelo por píxel)
  const soleC = tone(pal.boots, 0.55);                   // suela oscura
  const neckC = tone(pal.bodyS, 0.72);                   // sombra de cuello
  const hiBody = tone(pal.body, 1.28);                   // brillo de hombro (luz arriba-izq)
  const hiHair = tone(pal.hair, 1.35);                   // brillo de cabeza
  const halfB = tone(pal.bodyS, 0.8);                    // medio tono interior del torso
  const halfH = tone(pal.hair, 0.78);                    // medio tono interior de la cabeza
  const buckle = tone(pal.accent, 1.6);                  // hebilla metálica
  const lidC = tone(pal.skin, 0.55);                     // párpado (parpadeo)
  const amber = pal.dreadEye ?? '#ffb054';               // brasa ocular (terror)
  const voidC = tone(pal.outline, 0.55);                 // ojo vacío / hueco de mandíbula
  const fogC = pal.dreadC ?? (pal.ribs ? pal.skin : pal.accent); // niebla que emana
  const faceC = pal.mask ? (pal.maskC ?? pal.skin) : pal.skin;

  // ojos: en terror parpadean ámbar/vacío entre frames; en reposo normal
  // se cierran 1 frame (ph 7). null = párpados cerrados.
  const eyeC: string | null = dread ? (ph % 2 === 0 ? amber : voidC)
    : (ph === 7 ? null : pal.eye);

  // balanceo de brazos (contrario entre izquierda y derecha); en idle, en guardia
  let sw = idle ? 0 : [1, 0, 0, -1, 0, 0][ph];
  let offL = sw, offR = -sw;
  // R9-6 · poses de acción: viento (brazos arriba/guardia, arma cargada
  // atrás-arriba), golpe (brazos lanzados al frente/caída del arma) y
  // voltereta (brazos recogidos al cuerpo).
  if (act === 1) {
    offL = dir === 'up' ? 1 : -1;
    offR = dir === 'up' ? 2 : -2;
    if (dir === 'side') sw = -1;
  } else if (act === 2) {
    offL = dir === 'down' ? 1 : -1;
    offR = dir === 'down' ? 2 : -2;
    sw = 0;
  } else if (act === 3) {
    offL = 1; offR = 1; sw = 1;
  }

  // R9-6 · balanceo de cadera (cross-lateral): el anclaje de piernas
  // desplaza ±1px con la zancada mientras el torso contra-resta; el
  // bajo de la túnica sigue 1 FASE detrás (tela con retraso).
  const walking = act === 0 && !idle;
  const hipDx = walking ? [-1, -1, 0, 1, 1, 0][ph] : 0;
  const hemDx = walking ? [0, -1, -1, 0, 1, 1][ph] : 0;   // de frente/espalda
  const hemDs = walking ? [1, 1, 0, -1, -1, 0][ph] : 0;   // de perfil

  // bota de 2 filas: cuero + suela oscura; lift=1 → pie recogido 1px
  const boot = (cx: number, w: number, lift: number) => {
    px(x, cx, bootY - 1 - lift, w, 1, pal.boots);
    px(x, cx, bootY - lift, w, 1, soleC);
  };

  if (dir === 'down' || dir === 'up') {
    // ---------- torso (primero: la cabeza encorvada solapa el pecho) ----------
    // R6-V9: talle recto y CINTURA 1px más estrecha por lado — la fila
    // del cinturón (bT+bodyH-2) mide 6 px frente a las 8 del talle.
    // R9-6: hombros en TRAPECIO (fila superior 6 px) — postura más
    // erguida/elegante sin cambiar canvas ni índices de frame.
    px(x, 5, bT, 6, 1, pal.body);                        // trapecio: hombros caídos
    px(x, 4, bT + 1, 8, L.bodyH - 3, pal.body);          // talle: hombros → cintura
    px(x, 5, bT + L.bodyH - 2, 6, 1, pal.body);          // fila de cintura (la cubre el cinturón)
    px(x, 5, bT, 6, 1, pal.bodyS);
    // doble contorno lateral: borde oscuro + medio tono interior
    px(x, 4, bT, 1, 1, pal.outline);                     // esquinas del trapecio
    px(x, 11, bT, 1, 1, pal.outline);
    px(x, 4, bT + 1, 1, L.bodyH - 3, pal.outline);
    px(x, 11, bT + 1, 1, L.bodyH - 3, pal.outline);
    px(x, 5, bT + 2, 1, L.bodyH - 4, halfB);
    px(x, 10, bT + 2, 1, L.bodyH - 4, halfB);
    // sombra de cuello bajo la barbilla
    px(x, 6, bT, 4, 1, neckC);
    // costillas más marcadas (esqueleto): surco / hueso / surco
    if (pal.ribs) {
      px(x, 6, bT + 1, 4, 1, tone(pal.bodyS, 0.62));
      px(x, 6, bT + 2, 4, 1, pal.skin);
      px(x, 6, bT + 3, 4, 1, tone(pal.bodyS, 0.62));
    }
    // emblema/broche 1px en el pecho, solo de frente (R2-A6)
    if (pal.chest && dir === 'down') px(x, 8, bT + 1, 1, 1, pal.chest);
    // insignia de gremio en accent (R6-V9): 3 px de frente y de
    // espaldas (2 si el talle es small); sin ella quien ya luce
    // emblema propio (chest) o es esqueleto (ribs)
    if (!pal.chest && !pal.ribs) {
      px(x, 7, bT + 1, 2, 1, pal.accent);
      if (L.bodyH > 4) px(x, 8, bT + 2, 1, 1, pal.accent);
    }
    // cinturón con hebilla 1px (ocupa toda la cintura estrechada)
    px(x, 5, bT + L.bodyH - 2, 6, 1, pal.accent);
    px(x, 7, bT + L.bodyH - 2, 2, 1, buckle);
    px(x, 5 + hemDx, bodyBot, 6, 1, pal.outline);        // bajo de la túnica, con lag de tela (R9-6)
    // brillo de hombrera 1px (luz arriba-izquierda), sobre el trapecio
    px(x, 5, bT, 2, 1, hiBody);
    if (pal.pauldrons) {
      px(x, 3, bT, 2, 2, pal.accent); px(x, 11, bT, 2, 2, pal.accent);
      px(x, 3, bT, 2, 1, tone(pal.accent, 1.3));
    }
    if (pal.leafy) { px(x, 3, bT, 2, 1, '#8ac05a'); px(x, 11, bT, 2, 1, '#8ac05a'); }

    // ---------- cabeza (hy baja la cabeza 1px en los encorvados) ----------
    const Hh = hT + hy, Ff = fT + hy;
    px(x, 4, Hh, 8, 1, pal.outline);
    // R9-6: coronilla REDONDEADA (8 px en la fila superior) — cabeza
    // algo menor/afilada; contorno lateral COMPLETO (5 filas) para que
    // la silueta no se pierda contra fondos claros
    px(x, 4, Hh + 1, 8, 1, pal.hair);
    px(x, 3, Hh + 2, 10, 4, pal.hair);
    px(x, 4, Hh + 1, 8, 1, hs);
    px(x, 3, Hh + 1, 1, 1, pal.outline);                 // esquinas redondeadas
    px(x, 12, Hh + 1, 1, 1, pal.outline);
    px(x, 3, Hh + 2, 1, 4, pal.outline);                 // contorno lateral completo
    px(x, 12, Hh + 2, 1, 4, pal.outline);
    px(x, 4, Hh + 2, 1, 3, halfH);
    px(x, 11, Hh + 2, 1, 3, halfH);
    px(x, 4, Hh + 1, 2, 1, hiHair);                      // brillo 1px en el cráneo
    // mechón de vuelo 1px (R6-V9), con 1 FASE de retraso respecto al
    // bob (R9-6): el cabello cae después de que el cuerpo asiente
    px(x, ph === 0 || ph === 3 ? 6 : 7, Math.max(0, Hh - 1), 1, 1, pal.hair);
    if (pal.band) px(x, 5, Hh + 1, 6, 1, pal.accent);    // diadema/cinta 1px en accent (R2-A6)
    if (pal.hood) { px(x, 3, Ff + 2, 10, 2, pal.hair); px(x, 4, Ff + 3, 8, 1, hs); }
    if (dir === 'down') {
      // cráneo: cara 3 filas y hueco oscuro (mandíbula suelta); cara normal: 4
      const faceH = jawLoose ? 3 : 4;
      px(x, 5, Ff, 6, faceH, faceC);
      if (!pal.mask) {
        if (eyeC) { px(x, 6, Ff + 1, 1, 2, eyeC); px(x, 9, Ff + 1, 1, 2, eyeC); }
        else { px(x, 6, Ff + 2, 1, 1, lidC); px(x, 9, Ff + 2, 1, 1, lidC); } // parpadeo
        if (pal.beard) px(x, 5, Ff + 3, 6, 2, pal.beard);
        if (pal.beardS) {
          // trenza: zigzag del 2º tono sobre la barba (R2-A6)
          px(x, 7, Ff + 3, 1, 1, pal.beardS); px(x, 8, Ff + 4, 1, 1, pal.beardS);
          px(x, 9, Ff + 3, 1, 1, pal.beardS);
        }
      } else {
        // máscara lisa: solo un brillo horizontal, sin boca ni ojos
        px(x, 6, Ff + 1, 4, 1, '#eae6dc');
      }
      if (jawLoose) {
        // mandíbula suelta: banda vacía + hueso 1px más abajo (sobre el pecho)
        px(x, 5, Ff + 3, 6, 1, voidC);
        px(x, 6, Ff + 4, 4, 1, pal.skin);
      }
      px(x, 3, Ff + 2, 1, 2, pal.hair); px(x, 12, Ff + 2, 1, 2, pal.hair);
      if (pal.ears === 'elf') { px(x, 2, Ff + 1, 1, 2, pal.skin); px(x, 13, Ff + 1, 1, 2, pal.skin); }
      if (pal.hairLong) {
        const hl = Math.max(1, bT - Ff - 3);
        px(x, 3, Ff + 4, 2, hl, pal.hair); px(x, 11, Ff + 4, 2, hl, pal.hair);
      }
    } else {
      // de espaldas: nuca cubierta si melena larga
      if (pal.hairLong) px(x, 4, Ff + 3, 8, 1, pal.hair);
    }
    if (pal.ears === 'cat') {
      // orejas felinas sobre la cabeza (filas fijas para que no "floten")
      px(x, 3, 0, 1, 1, hs); px(x, 12, 0, 1, 1, hs);
      px(x, 3, 1, 2, 1, pal.hair); px(x, 11, 1, 2, 1, pal.hair);
    }
    if (pal.messy) {
      // pelo revuelto (mechones sueltos)
      px(x, 2, Hh + 1, 1, 1, pal.hair); px(x, 13, Hh + 1, 1, 1, pal.hair);
      px(x, 5, Math.max(0, Hh - 1), 2, 1, pal.hair); px(x, 9, Math.max(0, Hh - 1), 3, 1, pal.hair);
    }
    if (pal.feather) {
      // pluma 1px en accent sobre el hombro derecho / borde de la capucha (R2-A6)
      px(x, dir === 'up' ? 11 : 4, bT - 1, 1, 1, pal.accent);
    }

    // ---------- brazos (oscilación) + manos 2×2 ----------
    px(x, 2, bT + offL, 2, L.armLen, pal.body);
    px(x, 2, bT + offL + L.armLen - 1, 2, 2, pal.skin);
    px(x, 12, bT + offR, 2, L.armLen, pal.body);
    px(x, 12, bT + offR + L.armLen - 1, 2, 2, pal.skin);
    if (pal.hammer) {
      // martillo en la mano derecha
      px(x, 13, bT + offR - 2, 1, L.armLen + 2, '#7a5c3a');
      px(x, 12, bT + offR - 4, 3, 2, '#9aa4b4');
    }
    // brillo de hombrera 1px sobre cada brazo (R6-V9): ensancha la
    // línea de hombro; pauldrons/leafy ya la marcan por su cuenta
    if (!pal.pauldrons && !pal.leafy) {
      px(x, 3, bT, 1, 1, hiBody);
      px(x, 12, bT, 1, 1, hiBody);
    }
    if (pal.cape) {
      // capa: paneles 1px a los costados + bordado accent aclarado (R2-A6)
      const cc = pal.capeC ?? pal.bodyS;
      const ch = pal.capeLong ? L.bodyH - 1 : 3;   // larga → cinturón · corta → 3 filas
      px(x, 3, bT, 1, ch, cc); px(x, 12, bT, 1, ch, cc);
      px(x, 3, bT + ch - 1, 1, 1, tone(pal.accent, 1.3));
      px(x, 12, bT + ch - 1, 1, 1, tone(pal.accent, 1.3));
    }
    // R9-6 · SILUETA: contorno exterior 1px de ambos brazos — antes las
    // columnas 1/14 quedaban desnudas y el brazo se fundía con fondos claros
    px(x, 1, bT + offL, 1, L.armLen + 1, pal.outline);
    if (act === 2) {
      // golpe: la estela de movimiento sustituye al contorno del brazo armado
      px(x, 14, bT + offR, 1, L.armLen + 1, rgba('#e8eef8', 0.5));
    } else {
      px(x, 14, bT + offR, 1, L.armLen + 1, pal.outline);
    }
    if (act === 1) {
      // chispa de tensión 1px junto al arma cargada: la anticipación se LEE
      px(x, 12, bT + offR + (dir === 'down' ? L.armLen + 1 : -1), 1, 1, pal.accent);
    }
    // R9-6 · seguimiento con retraso: punta de melena y esquina de capa
    // que quedan 1 fase por detrás del paso (contacto 1/4)
    if (walking && (ph === 1 || ph === 4)) {
      px(x, ph === 1 ? 13 : 2, Ff + 3, 1, 1, hs);
      if (pal.cape) {
        const ch = pal.capeLong ? L.bodyH - 1 : 3;
        px(x, ph === 1 ? 13 : 2, bT + ch, 1, 1, pal.capeC ?? pal.bodyS);
      }
    }

    // ---------- piernas: ciclo de 6 fases + balanceo de cadera, bota + suela ----------
    const m1 = Math.max(1, legH2 - 1);
    if (ph === 0) {          // zancada A: izquierda adelante, derecha atrás
      px(x, 4 + hipDx, legY, 3, legH2, pal.legs); boot(4 + hipDx, 3, 0);
      px(x, 9 + hipDx, legY, 3, legH2, ls); boot(9 + hipDx, 3, 0);
    } else if (ph === 1) {   // contacto-medio: la derecha se recoge 1px
      px(x, 5 + hipDx, legY, 3, legH2, pal.legs); boot(5 + hipDx, 3, 0);
      px(x, 9 + hipDx, legY + 1, 3, m1, ls); boot(9 + hipDx, 3, 1);
    } else if (ph === 2) {   // pase: juntas, cuerpo elevado
      px(x, 6 + hipDx, legY, 3, legH2, pal.legs); boot(6 + hipDx, 3, 0);
      px(x, 8 + hipDx, legY, 3, legH2, ls); boot(8 + hipDx, 3, 0);
    } else if (ph === 3) {   // zancada B: derecha adelante, izquierda atrás
      px(x, 4 + hipDx, legY + 1, 3, m1, ls); boot(4 + hipDx, 3, 1);
      px(x, 9 + hipDx, legY, 3, legH2, pal.legs); boot(9 + hipDx, 3, 0);
    } else if (ph === 4) {   // contacto-medio: la izquierda se recoge 1px
      px(x, 5 + hipDx, legY + 1, 3, m1, ls); boot(5 + hipDx, 3, 1);
      px(x, 9 + hipDx, legY, 3, legH2, pal.legs); boot(9 + hipDx, 3, 0);
    } else {                 // pase: juntas, cuerpo elevado
      px(x, 6 + hipDx, legY, 3, legH2, ls); boot(6 + hipDx, 3, 0);
      px(x, 8 + hipDx, legY, 3, legH2, pal.legs); boot(8 + hipDx, 3, 0);
    }
  } else {
    // ---------- dir === 'side' (mirando a la derecha; render voltea para 'left') ----------
    // R9-6 · inclinación horizontal de viento/golpe: el bloque superior
    // completo se traslada 1px (translate) y las piernas quedan ancladas
    const leanX = act === 1 ? -1 : act === 2 ? 1 : 0;
    if (leanX !== 0) x.save();
    if (leanX !== 0) x.translate(leanX, 0);
    // torso
    // R6-V9: cintura de perfil 1px más estrecha por lado (4 px de
    // cinturón frente a las 6 del talle) · R9-6: hombro en trapecio
    px(x, 6, bT, 4, 1, pal.body);                        // trapecio: hombro caído
    px(x, 5, bT + 1, 6, L.bodyH - 3, pal.body);          // talle
    px(x, 6, bT + L.bodyH - 2, 4, 1, pal.body);          // fila de cintura (la cubre el cinturón)
    px(x, 6, bT, 4, 1, pal.bodyS);
    px(x, 5, bT, 1, 1, pal.outline);                     // esquinas del trapecio
    px(x, 10, bT, 1, 1, pal.outline);
    px(x, 5, bT + 1, 1, L.bodyH - 3, pal.outline);       // doble contorno: espalda
    px(x, 10, bT + 1, 1, L.bodyH - 3, pal.outline);      // y pecho
    px(x, 6, bT + 2, 1, L.bodyH - 4, halfB);
    px(x, 9, bT + 2, 1, L.bodyH - 4, halfB);
    px(x, 7, bT, 3, 1, neckC);                           // sombra de cuello
    if (pal.ribs) {
      px(x, 6, bT + 1, 3, 1, tone(pal.bodyS, 0.62));
      px(x, 6, bT + 2, 3, 1, pal.skin);
      px(x, 6, bT + 3, 3, 1, tone(pal.bodyS, 0.62));
    }
    if (pal.chest) px(x, 9, bT + 1, 1, 1, pal.chest);    // emblema 1px al frente (R2-A6)
    // insignia de gremio al frente, 1-2 px según el talle (R6-V9)
    if (!pal.chest && !pal.ribs) {
      px(x, 9, bT + 1, 1, 1, pal.accent);
      if (L.bodyH > 4) px(x, 9, bT + 2, 1, 1, pal.accent);
    }
    px(x, 6, bT + L.bodyH - 2, 4, 1, pal.accent);        // cinturón (toda la cintura)
    px(x, 9, bT + L.bodyH - 2, 1, 1, buckle);            // hebilla al frente
    px(x, 6 + hemDs, bodyBot, 4, 1, pal.outline);        // bajo con lag de tela (R9-6)
    px(x, 6, bT, 2, 1, hiBody);                          // brillo de hombro (trapecio)
    if (pal.pauldrons) { px(x, 4, bT, 2, 2, pal.accent); px(x, 4, bT, 2, 1, tone(pal.accent, 1.3)); }
    if (pal.leafy) px(x, 4, bT, 2, 1, '#8ac05a');

    // cabeza
    const Hh = hT + hy, Ff = fT + hy;
    px(x, 5, Hh, 8, 1, pal.outline);
    // R9-6: coronilla redondeada + contorno frontal COMPLETO (5 filas):
    // la cara y la nariz no se funden con fondos claros
    px(x, 5, Hh + 1, 8, 1, pal.hair);
    px(x, 4, Hh + 2, 9, 4, pal.hair);
    px(x, 5, Hh + 1, 8, 1, hs);
    px(x, 4, Hh + 1, 1, 1, pal.outline);                 // esquina de la nuca
    px(x, 4, Hh + 2, 1, 4, pal.outline);                 // nuca completa
    px(x, 12, Hh + 1, 1, 5, pal.outline);                // curva frontal completa
    px(x, 5, Hh + 2, 1, 3, halfH);
    px(x, 5, Hh + 1, 2, 1, hiHair);
    // mechón de vuelo 1px de perfil (R6-V9), con 1 FASE de retraso (R9-6)
    px(x, ph === 0 || ph === 3 ? 5 : 6, Math.max(0, Hh - 1), 1, 1, pal.hair);
    if (pal.band) px(x, 6, Hh + 1, 4, 1, pal.accent);    // diadema 1px de perfil (R2-A6)
    if (pal.hood) px(x, 4, Ff + 2, 8, 2, pal.hair);
    const faceH = jawLoose ? 3 : 4;
    px(x, 7, Ff, 5, faceH, faceC);
    if (!pal.mask) {
      if (eyeC) px(x, 10, Ff + 1, 1, 2, eyeC);
      else px(x, 10, Ff + 2, 1, 1, lidC);                // parpadeo
      if (pal.beard) px(x, 8, Ff + 3, 4, 2, pal.beard);
      if (pal.beardS) {
        // trenza de perfil: zigzag del 2º tono (R2-A6)
        px(x, 9, Ff + 3, 1, 1, pal.beardS); px(x, 10, Ff + 4, 1, 1, pal.beardS);
      }
    } else {
      px(x, 8, Ff + 1, 3, 1, '#eae6dc');
    }
    // perfil de nariz 1px (R6-V9): sobresale bajo la curva frontal
    // del cráneo; la máscara lisa se queda lisa
    if (!pal.mask) px(x, 12, Ff + 2, 1, 1, faceC);
    if (jawLoose) {
      // mandíbula suelta de perfil: hueco + hueso descolgado 1px
      px(x, 7, Ff + 3, 4, 1, voidC);
      px(x, 8, Ff + 4, 3, 1, pal.skin);
    }
    px(x, 5, Ff + 2, 1, 2, pal.hair);
    if (pal.ears === 'elf') px(x, 6, Ff + 1, 1, 2, pal.skin);
    if (pal.ears === 'cat') { px(x, 3, 0, 1, 1, hs); px(x, 4, 1, 2, 1, pal.hair); }
    if (pal.hairLong) px(x, 4, Ff + 3, 2, Math.max(1, bT - Ff - 2), pal.hair);
    if (pal.messy) px(x, 5, Math.max(0, Hh - 1), 3, 1, pal.hair);
    if (pal.feather) px(x, 4, bT - 1, 1, 1, pal.accent); // pluma en el hombro trasero (R2-A6)

    // brazo delantero con balanceo + brazo trasero al tono sombreado
    if (act === 2) {
      // R9-6 · golpe de perfil: brazo ESTIRADO (estirón), puño 2×2
      // contorneado y estela de movimiento 1px al frente del arma
      px(x, 8, bT, 4, 2, pal.body);
      px(x, 11, bT, 2, 2, pal.skin);
      px(x, 12, bT, 1, 2, pal.outline);                  // contorno del puño
      px(x, 13, bT, 2, 1, rgba('#e8eef8', 0.5));         // estela de movimiento 1px
      px(x, 5, bT + 1, 2, 3, pal.bodyS);
      px(x, 5, bT + 3, 2, 2, tone(pal.skin, 0.82));      // mano trasera en sombra
      if (pal.hammer) {
        px(x, 11, bT + 1, 3, 1, '#7a5c3a');              // mango horizontal
        px(x, 13, bT, 2, 3, '#9aa4b4');                  // cabeza al frente
      }
    } else {
      px(x, 8, bT + sw, 3, 3, pal.body);
      px(x, 10, bT + sw + 2, 2, 2, pal.skin);              // mano 2×2
      px(x, 5, bT - sw, 2, 3, pal.bodyS);
      px(x, 5, bT - sw + 2, 2, 2, tone(pal.skin, 0.82));   // mano trasera en sombra
      if (pal.hammer) {
        px(x, 11, bT + sw - 2, 1, 5, '#7a5c3a');
        px(x, 10, bT + sw - 4, 3, 2, '#9aa4b4');
      }
      // contorno frontal de la mano delantera (R9-6 · silueta)
      px(x, 12, bT + sw + 2, 1, 2, pal.outline);
    }
    // brillo de hombrera 1px trasero (R6-V9); pauldrons/leafy ya lo marcan
    if (!pal.pauldrons && !pal.leafy) px(x, 4, bT, 1, 1, hiBody);
    if (pal.cape) {
      // capa de perfil: borde 1px a la espalda + bordado accent (R2-A6)
      const cc = pal.capeC ?? pal.bodyS;
      const ch = pal.capeLong ? L.bodyH - 1 : 3;
      px(x, 4, bT, 1, ch, cc);
      px(x, 4, bT + ch - 1, 1, 1, tone(pal.accent, 1.3));
    }
    // R9-6 · retraso de tela/cabello de perfil: esquina de capa al
    // avanzar y mechón de nuca que asienta 1 fase detrás del paso
    if (walking && pal.cape && ph === 1) {
      px(x, 3, bT + (pal.capeLong ? L.bodyH - 1 : 3), 1, 1, pal.capeC ?? pal.bodyS);
    }
    if (walking && (ph === 0 || ph === 3)) px(x, 4, bT - 1, 1, 1, pal.hair);

    if (leanX !== 0) x.restore();

    // piernas en zancada (6 fases, bota + suela)
    const m1 = Math.max(1, legH2 - 1);
    if (ph === 0) {          // zancada A: trasera extendida, delantera al frente
      px(x, 5, legY, 2, legH2, ls); boot(5, 2, 0);
      px(x, 8, legY, 2, legH2, pal.legs); boot(8, 2, 0);
    } else if (ph === 1) {   // contacto-medio: la trasera se recoge
      px(x, 6, legY + 1, 2, m1, ls); boot(6, 2, 1);
      px(x, 8, legY, 2, legH2, pal.legs); boot(8, 2, 0);
    } else if (ph === 2) {   // pase: la trasera cruza recogida, cuerpo elevado
      px(x, 6, legY, 2, legH2, pal.legs); boot(6, 2, 0);
      px(x, 8, legY + 1, 2, m1, ls); boot(8, 2, 1);
    } else if (ph === 3) {   // zancada B: zancada opuesta (sombras intercambiadas)
      px(x, 4, legY, 2, legH2, pal.legs); boot(4, 2, 0);
      px(x, 7, legY, 2, legH2, ls); boot(7, 2, 0);
    } else if (ph === 4) {   // contacto-medio: la trasera se recoge
      px(x, 5, legY + 1, 2, m1, pal.legs); boot(5, 2, 1);
      px(x, 7, legY, 2, legH2, ls); boot(7, 2, 0);
    } else {                 // pase
      px(x, 6, legY, 2, legH2, ls); boot(6, 2, 0);
      px(x, 8, legY + 1, 2, m1, pal.legs); boot(8, 2, 1);
    }
  }

  // ---------- capa ondeando en idle (hood o melena larga) ----------
  if (idle && pal.hood && ph === 6) {
    // pose neutra: tela asentada a los costados
    px(x, 3, bT, 1, 4, pal.bodyS); px(x, 12, bT, 1, 4, pal.bodyS);
  } else if (idle && pal.hood) {
    // frame de aire: la capa se levanta 1px y una solapa vuela
    px(x, 3, bT + 1, 1, 4, pal.bodyS); px(x, 12, bT + 1, 1, 4, pal.bodyS);
    px(x, 2, bT + 3, 1, 1, pal.bodyS); px(x, 13, bT + 2, 1, 1, pal.bodyS);
  } else if (idle && pal.hairLong && dir !== 'up') {
    // punta de la melena que se mece 1px entre frames
    if (ph === 6) px(x, 3, bT + 1, 1, 1, hs);
    else px(x, 4, bT + 1, 1, 1, hs);
  } else if (idle && pal.cape && (ph === 7 || ph === 8)) {
    // frame de aire (parpadeo o respiración): una esquina de la capa vuela 1px (R2-A6/R9-6)
    px(x, 2, bT + 3, 1, 1, pal.capeC ?? pal.bodyS);
    px(x, 13, bT + 3, 1, 1, pal.capeC ?? pal.bodyS);
  }

  // ---------- vetas de niebla (terror): 3 px translúcidos que derivan ----------
  if (dread) {
    px(x, 1, bT + 1 + ((ph * 2) % 3), 1, 2, rgba(fogC, 0.35));
    px(x, 14, bT + 2 + ((ph * 2 + 1) % 3), 1, 2, rgba(fogC, 0.3));
    px(x, 6 + (ph % 3) * 2, Math.max(0, hT + hy - 1), 2, 1, rgba(fogC, 0.26));
  }
}

/**
 * Dibuja un fotograma humanoide (firma legacy intacta). f = fase de
 * andar del ciclo antiguo de 3 fases (0 zancada A, 1 pase, 2 zancada
 * B), remapeada al ciclo nuevo de 6. En reposo se usa f=1 sin bob para
 * una pose neutra de pie.
 */
export function drawHumanFrame(
  x: CanvasRenderingContext2D, pal: HumanPal,
  dir: 'down' | 'up' | 'side', f: number, bob: number, L: Layout,
): void {
  const ph = f === 1 ? 2 : f === 2 ? 3 : 0;
  drawFrame(x, pal, dir, ph, L, bob);
}

/**
 * Construye los 27 frames del humanoide (R9-6): por cada dirección
 * (down, up, side) 6 de andar [zancadaA, contacto, pase+1px, zancadaB,
 * contacto, pase+1px] y al FINAL del bloque 3 de idle (índices 6/7/8:
 * 6 neutro ojos abiertos · 7 parpadeo+aire · 8 respiración, torso
 * arriba ojos abiertos). El retrato del creador (EcosGame) usa los
 * frames 6/7 directamente: contrato intacto. `big` escala ×2 (32×36).
 */
export function buildHumanoid(pal: HumanPal): Frames {
  const frames: Frames = [];
  const dirs: ('down' | 'up' | 'side')[] = ['down', 'up', 'side'];
  const L = layoutFor(pal);
  for (const dir of dirs) {
    for (let ph = 0; ph < 9; ph++) {   // 6 de andar + 3 de idle (6, 7, 8)
      const { c, x } = mkCanvas(16, L.H);
      drawFrame(x, pal, dir, ph, L);
      frames.push(c);
    }
  }
  return pal.big ? bigScale(frames, L.H) : frames;
}

/** Escalado ×2 del Gran Inquisidor y otros `big` (32×H·2, nítido). */
function bigScale(frames: Frames, H: number): Frames {
  return frames.map(fr => {
    const { c, x } = mkCanvas(32, H * 2);
    x.imageSmoothingEnabled = false;
    x.drawImage(fr, 0, 0, 32, H * 2);
    return c;
  });
}

/**
 * R9-6 · Poses de COMBATE del Portador (export aditivo, se construyen
 * una vez junto al resto de sprites — coste runtime 0).
 *
 * Devuelve 6 canvases 16×H en el orden:
 *   [0] anticipación down  [1] golpe down
 *   [2] anticipación up    [3] golpe up
 *   [4] anticipación side  [5] golpe side
 *
 *  · Anticipación (viento): torso y cabeza girados 1px atrás, brazos
 *    en guardia con el arma cargada y chispa accent 1px — se LEE.
 *  · Golpe: estirón 1px al frente, brazo extendido/puño contorneado y
 *    estela de movimiento 1px en el arma.
 *
 * ENGANCHA (contrato R3-c de render.ts:445-456, llamada opcional vía
 * namespace): en sprites.ts, junto a initSprites:
 *   const ATK: Record<string, Frames> = {};
 *   ... dentro de initSprites():
 *     for (const [name, pal] of Object.entries(PALS)) {
 *       SPR[name] = buildHumanoid(pal); ATK[name] = buildAttackPoses(pal);
 *     }
 *   export function getAttackFrames(base: string, dir: string) {
 *     const f = ATK[base]; if (!f) return null;
 *     const i = dir === 'up' ? 2 : dir === 'down' ? 0 : 4;
 *     return [f[i], f[i + 1]];
 *   }
 * render.ts ya llama SPRITES.getAttackFrames(pl.sprite, pl.dir) si
 * existe; mientras tanto el fallback es el frame de andar (intacto).
 */
export function buildAttackPoses(pal: HumanPal): Frames {
  const L = layoutFor(pal);
  const frames: Frames = [];
  for (const dir of ['down', 'up', 'side'] as const) {
    for (const act of [1, 2] as const) {
      const { c, x } = mkCanvas(16, L.H);
      drawFrame(x, pal, dir, 6, L, 0, act);   // base idle neutra + pose
      frames.push(c);
    }
  }
  return pal.big ? bigScale(frames, L.H) : frames;
}

/**
 * R9-6 · Pose INCLINADA de voltereta (esquiva), export aditivo: 3
 * canvases 16×H [down, up, side] — cuerpo agachado 1px, cabeza metida,
 * brazos recogidos. Pensada para el sprite durante rollT y para la
 * estela: fx.ts ya guarda rollTrail ({x,y,dir,anim}) y render.ts la
 * estampa tenue — el enganche es sustituir el frame de andar por esta
 * pose en esos dos puntos (o reutilizarla como poseCv en drawEntity
 * cuando p.rollT > 0). La estela de 1 frame tenue ya existe en fx.ts.
 */
export function buildRollPoses(pal: HumanPal): Frames {
  const L = layoutFor(pal);
  const frames: Frames = [];
  for (const dir of ['down', 'up', 'side'] as const) {
    const { c, x } = mkCanvas(16, L.H);
    drawFrame(x, pal, dir, 6, L, 1, 3);       // agachada: bob +1, act 3
    frames.push(c);
  }
  return pal.big ? bigScale(frames, L.H) : frames;
}

/**
 * Fase de reposo compartida: 0 = idle neutro (frame 6, ojos abiertos),
 * 1 = aire/parpadeo (frame 7, ojos cerrados). El parpadeo dura 1/5 de
 * unidad de anim y se repite cada 8/5 unidades → ~3-4 s con el ritmo
 * idle del motor (anim += dt·0.4 el jugador, dt·0.6 enemigos). El
 * desfase +4 evita parpadear justo al aparecer (anim≈0).
 * (R9-6: se conserva EXACTA — sigue siendo el detector del parpadeo.)
 */
function idleBlink(anim: number): number {
  return (Math.floor(anim * 5) + 4) % 8 === 0 ? 1 : 0;
}

/**
 * R9-6 · Sub-índice de reposo para los sprites de 27 frames:
 *   0 → frame 6 neutro (torso abajo) · 1 → frame 7 parpadeo
 *   2 → frame 8 respiración (torso arriba, ojos abiertos).
 * La respiración alterna neutro↔aire cada 0.4 unidades de anim →
 * ciclo completo ~2 s al ritmo idle del Portador (anim += dt·0.4);
 * determinista y sin estado. El parpadeo (idleBlink) tiene prioridad.
 */
function idlePose(anim: number): number {
  if (idleBlink(anim) === 1) return 1;
  return Math.floor(anim * 2.5) % 2 === 1 ? 2 : 0;
}

/**
 * Índice de fotograma (compatible con re-export de engine.ts).
 *  · En movimiento: floor(anim·6) % 6 recorre el ciclo de 6 fases —
 *    el contador avanza al mismo ritmo por frame que el ciclo legacy
 *    floor(anim·6)%2, pero con 3× más pasos: zancada más suave.
 *  · En reposo (R9-6): base+6+idlePose → 6 neutro, 7 parpadeo u
 *    8 respiración; los frames 6/7/8 son locales a cada bloque de
 *    dirección (base +6/+7/+8).
 *  · dir acepta el Dir del motor (down/up/left/right): todo lo que
 *    no es down/up cae en el bloque lateral (el sprite side mira a
 *    la derecha y render.ts lo voltea para 'left').
 */
export function frameIndex(dir: string, moving: boolean, anim: number): number {
  const base = dir === 'down' ? 0 : dir === 'up' ? 9 : 18; // R19: bloques de 9
  if (!moving) return base + 6 + idlePose(anim);
  return base + (Math.floor(anim * 6) % 6);
}

/**
 * Selección robusta de fotograma para cualquier sprite (siempre
 * devuelve un índice DENTRO de spr.length — clamp explícito):
 *  · humanoids v3 (27 frames, R9-6): ciclo de 6 + idle 6/7/8
 *    (neutro / parpadeo / respiración ~2 s) por dirección.
 *  · humanoids v2 legacy de 24 frames: ciclo de 6 + idle 6/7.
 *  · humanoids legacy de 9 frames (3 por dirección): ciclo antiguo.
 *  · resto (lobo, guardián, wisp...): alternan su ciclo propio al moverse.
 *  · dir llega con el Dir del motor: down/up/left/right — left y
 *    right seleccionan el bloque LATERAL (antes se comparaba con
 *    'side', que nunca casaba, y al andar en horizontal se mostraba
 *    el sprite de frente).
 */
export function entityFrame(spr: Frames, dir: string, moving: boolean, anim: number): number {
  const n = spr.length;
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, i));
  if (n === 27) {
    // R19: bloques de 9 (6 andar + 3 reposo): abajo 0-8 · arriba 9-17 · perfil 18-26
    // (antes 0/8/16: al andar hacia arriba o de lado se mezclaban fotogramas)
    const base = dir === 'up' ? 9 : dir === 'down' ? 0 : 18;
    if (!moving) return clamp(base + 6 + idlePose(anim));
    return clamp(base + (Math.floor(anim * 6) % 6));
  }
  if (n === 24) {
    const base = dir === 'up' ? 8 : dir === 'down' ? 0 : 16;
    if (!moving) return clamp(base + 6 + idleBlink(anim));
    return clamp(base + (Math.floor(anim * 6) % 6));
  }
  if (n === 9) {
    const base = dir === 'up' ? 3 : dir === 'down' ? 0 : 6;
    if (!moving) return clamp(base + 1); // pose de pie = fase de pase sin bob
    return clamp(base + (Math.floor(anim * 8) % 3));
  }
  if (n >= 2 && moving) return clamp(Math.floor(anim * 6) % Math.min(2, n));
  return clamp(0);
}
