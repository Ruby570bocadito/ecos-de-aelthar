// ============================================================
// ECOS DE AELTHAR — Enemigos pixel (módulo actors) · R2-A2 + R9-7
// Lobo de Niebla (24×16 · 11 frames) y Guardián Hueco (40×44 · 8 frames).
// Pixel art 100% procedural: sin assets, sin anti-aliasing, píxeles enteros.
// ------------------------------------------------------------
// CONTRATO DE FRAMES (para el integrador):
//   LOBO      0 acecho-bajo · 1 acecho-medio · 2 zancada A · 3 zancada B
//             4 preparación (agachado, orejas atrás) · 5 zambida (boca abierta, estirado)
//   LOBO R9-7 6 galope-estirado · 7 galope-recogido (estira-compresión 1px)
//             8 acecho-alza · 9 acecho-baja (pata alzada, paso denso)
//             10 impacto de la zambida (rebote legible tras el ataque)
//             → los índices 0..5 del contrato original quedan INTACTOS;
//               los nuevos son solo intermedios/poses extra (additivo).
//   GUARDIÁN  0-1 idle flotante (bob ±1px) · 2-3 grito (visera abierta, glow crece)
//             4-5 invocación (fragmentos orbitan) · 6-7 colapso (grietas, glow rojo)
//
// HELPERS EXPORTADOS:
//   wolfFrame(anim)                      → índice recomendado 0..10 (paso denso R9-7)
//   wolfFrameAI(ai, anim)                → índice 0..10 según la IA del lobo (conexión fina)
//   guardianFrame(estado, t)             → índice 0..7 según estado del jefe
//   GUARDIAN_PHASE_GLOW                  → ['#7ee8ff','#ffd24a','#ff5a4a']
//     (color de glow por FASE del jefe: el integrador lo usa en partículas,
//      ondas expansivas y auras; el sprite hornea cian en frames 0-5 y rojo
//      en colapso 6-7).
//
// El motor genérico (entityFrame) sigue funcionando sin cambios: con n≠9
// devuelve 0 en reposo y alterna 0/1 al moverse — índices siempre válidos.
// ============================================================

import { mkCanvas, px, type Frames } from './util';

// ---------------- utilidades locales ----------------

/** Pseudo-aleatorio determinista y puro (sin estado): misma entrada → mismo píxel. */
function rnd(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Línea de píxeles enteros entre dos puntos (estilo Bresenham, sin AA). */
function seg(
  x: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  c: string, w = 1,
): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, cx = x0, cy = y0;
  for (;;) {
    px(x, cx, cy, w, w, c);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
}

// ============================================================
// LOBO DE NIEBLA — 24×16, 6 frames
// Anatomía: lomo arqueado, cresta de pelo erizado (silueta dentada),
// cola larga con curva, patas con articulación (corvejón), cabeza real
// (hocico 3px con trufa, orejas triangulares — hacia atrás al embestir).
// Terror V3: ojos BRASA (ascua dorada dentro de brasa naranja + halo cálido),
// costillas marcadas bajo el pelaje, púas 1px sueltas en la silueta, dientes
// incluso con la boca cerrada, cabeza baja al andar, niebla que emana del
// lomo y las patas, colmillos 1px en la zambida y una tenue "doble exposición"
// del perro guardián que fue, desplazada 1px bajo la niebla.
// ============================================================

const WOLF = {
  O: '#131222',                    // contorno / trufa / boca
  D: '#3b3a5e',                    // volumen oscuro (tono nuevo 1)
  D2: '#211f38',                   // sombra profunda
  B: '#7d7d9f',                    // pelaje base (identidad)
  S: '#5c5c80',                    // pelaje sombra (identidad)
  W: '#a7a7c4',                    // pelaje claro
  H: '#ccd6ec',                    // highlight frío del lomo (tono nuevo 2)
  E: '#ff7830',                    // brasa del ojo (acento 1)
  EC: '#ffd24a',                   // ascua dorada: núcleo del ojo (acento 2)
  e: 'rgba(255,120,48,0.42)',      // halo brasa del ojo
  F: '#e9eef6',                    // colmillo
  N: '#10101e',                    // trufa
  f1: 'rgba(186,199,230,0.20)',    // niebla tenue
  f2: 'rgba(163,178,216,0.34)',    // niebla densa
  gh: 'rgba(18,16,38,0.55)',       // silueta del perro guardián (doble exposición)
  ghE: 'rgba(10,8,24,0.75)',       // cuenca del ojo fantasma
} as const;

interface LoboPata {
  pts: [number, number][];         // cadera → rodilla/corvejón → tobillo
  paw: [number, number];           // esquina del almohadillado 2×2 (y14 = suelo)
  cerca: boolean;                  // la pata cercana se pinta DELANTE del torso
}

interface LoboPose {
  top: number[];                   // y del dorso por columna (x = 4..16, 13 columnas)
  bot: number[];                   // y del vientre por columna
  headX: number; headY: number;    // esquina sup-izq del cráneo (6×4)
  boca: 'cerrada' | 'aullido' | 'zambida';
  orejas: 'arriba' | 'atras';
  ojoAlto: boolean;                // ojo 2×2 furioso (zambida)
  cola: [number, number][];        // polilínea desde la grupa
  patas: LoboPata[];
  brumas: [number, number, number][];  // niebla del lomo: x, y, ancho
  estelas?: boolean;               // estelas de niebla (zambida)
  fantasmaAlza?: boolean;          // el perro guardián también aúlla
}

// El dorso se define columna a columna: arco alto en zancada (apex y3),
// aplomado en acecho (y5-6) y grupa cargada en la preparación (resorte).
const LOBO_POSES: LoboPose[] = [
  { // 0 · acecho-bajo — deslizándose pegado al suelo
    top: [6, 6, 6, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6],
    bot: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 11, 10],
    headX: 16, headY: 4, boca: 'cerrada', orejas: 'arriba', ojoAlto: false,
    cola: [[4, 6], [3, 7], [2, 8], [1, 9], [0, 9]],
    patas: [
      { pts: [[14, 9], [15, 10], [15, 11], [15, 12], [15, 13]], paw: [15, 14], cerca: true },
      { pts: [[13, 9], [12, 10], [12, 11], [12, 12], [12, 13]], paw: [12, 14], cerca: false },
      { pts: [[7, 9], [8, 10], [6, 11], [7, 12], [7, 13]], paw: [8, 14], cerca: true },
      { pts: [[6, 9], [7, 10], [5, 11], [6, 12], [6, 13]], paw: [6, 14], cerca: false },
    ],
    brumas: [[6, 3, 2], [9, 2, 2], [12, 3, 3], [14, 4, 2]],
  },
  { // 1 · acecho-medio — eleva el lomo, un paso tentative
    top: [5, 5, 5, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5],
    bot: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 9],
    headX: 16, headY: 4, boca: 'cerrada', orejas: 'arriba', ojoAlto: false,
    cola: [[4, 6], [3, 6], [2, 7], [1, 8], [0, 8]],
    patas: [
      { pts: [[14, 8], [15, 9], [15, 10], [15, 11], [15, 12], [15, 13]], paw: [15, 14], cerca: true },
      { pts: [[13, 8], [13, 9], [12, 10], [12, 11], [12, 12], [12, 13]], paw: [12, 14], cerca: false },
      { pts: [[7, 8], [8, 9], [6, 10], [7, 11], [7, 12], [7, 13]], paw: [8, 14], cerca: true },
      { pts: [[6, 8], [6, 9], [5, 10], [5, 11], [5, 12], [5, 13]], paw: [5, 14], cerca: false },
    ],
    brumas: [[7, 2, 2], [10, 1, 3], [13, 2, 2], [15, 3, 2]],
  },
  { // 2 · zancada — galope con la cabeza baja: delantera alcanza, trasera empuja
    top: [5, 5, 4, 4, 3, 3, 3, 3, 4, 4, 4, 5, 5],
    bot: [9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10, 9],
    headX: 16, headY: 4, boca: 'cerrada', orejas: 'arriba', ojoAlto: false,
    cola: [[4, 6], [3, 7], [2, 8], [1, 10], [0, 11]],
    patas: [
      { pts: [[14, 8], [15, 9], [16, 10], [17, 11], [18, 12], [18, 13]], paw: [18, 14], cerca: true },
      { pts: [[13, 8], [12, 9], [11, 10], [10, 11], [10, 12], [10, 13]], paw: [10, 14], cerca: false },
      { pts: [[7, 8], [8, 9], [6, 10], [5, 11], [4, 12], [4, 13]], paw: [4, 14], cerca: true },
      { pts: [[6, 8], [7, 9], [8, 10], [9, 11], [9, 12], [9, 13]], paw: [9, 14], cerca: false },
    ],
    brumas: [[6, 2, 2], [9, 1, 3], [12, 2, 2], [15, 3, 2]],
  },
  { // 3 · zancada-opuesta — patas invertidas, rebote y cabeza aún más baja
    top: [6, 6, 5, 5, 4, 4, 4, 4, 5, 5, 5, 6, 6],
    bot: [10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 11, 11, 10],
    headX: 16, headY: 5, boca: 'cerrada', orejas: 'arriba', ojoAlto: false,
    cola: [[4, 6], [3, 6], [2, 7], [1, 7], [0, 9]],
    patas: [
      { pts: [[14, 9], [13, 10], [12, 11], [11, 12], [11, 13]], paw: [11, 14], cerca: true },
      { pts: [[13, 9], [15, 10], [16, 11], [17, 12], [17, 13]], paw: [17, 14], cerca: false },
      { pts: [[7, 9], [8, 10], [9, 11], [10, 12], [10, 13]], paw: [10, 14], cerca: true },
      { pts: [[6, 9], [5, 10], [4, 11], [3, 12], [3, 13]], paw: [3, 14], cerca: false },
    ],
    brumas: [[7, 3, 2], [10, 2, 3], [13, 3, 2], [15, 4, 2]],
  },
  { // 4 · preparación — resorte cargado: grupa alta, pecho abajo, orejas al rastrillo
    top: [4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6],
    bot: [9, 9, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11],
    headX: 16, headY: 6, boca: 'cerrada', orejas: 'atras', ojoAlto: true,
    cola: [[4, 5], [3, 6], [2, 7], [1, 8], [0, 9]],
    patas: [
      { pts: [[14, 9], [14, 10], [14, 11], [14, 12], [14, 13]], paw: [14, 14], cerca: true },
      { pts: [[13, 9], [12, 10], [12, 11], [12, 12], [12, 13]], paw: [12, 14], cerca: false },
      { pts: [[7, 8], [8, 9], [8, 10], [7, 11], [7, 12], [7, 13]], paw: [7, 14], cerca: true },
      { pts: [[6, 8], [6, 9], [5, 10], [5, 11], [5, 12], [5, 13]], paw: [5, 14], cerca: false },
    ],
    brumas: [[5, 2, 2], [8, 1, 2], [11, 3, 2], [14, 4, 2]],
  },
  { // 5 · zambida — cuerpo estirado en vuelo, boca abierta, orejas al rastrillo
  //   (R9-7: la fauces cerradas del impacto viven en la pose 10, ver abajo)
    top: [6, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    bot: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10],
    headX: 16, headY: 3, boca: 'zambida', orejas: 'atras', ojoAlto: true,
    cola: [[4, 6], [3, 6], [2, 6], [1, 6], [0, 5]],
    patas: [
      { pts: [[14, 8], [16, 9], [17, 10], [18, 11], [19, 12], [19, 13]], paw: [19, 14], cerca: true },
      { pts: [[13, 8], [15, 9], [16, 10], [16, 11], [16, 12]], paw: [16, 13], cerca: false },
      { pts: [[7, 8], [5, 9], [4, 10], [3, 11], [2, 12], [2, 13]], paw: [2, 14], cerca: true },
      { pts: [[6, 8], [5, 9], [4, 10], [3, 11], [3, 12]], paw: [3, 13], cerca: false },
    ],
    brumas: [[5, 3, 2], [9, 2, 2], [12, 3, 3], [15, 2, 2]],
    estelas: true,
  },

  // ——— R9-7 · intermedios y poses nuevas (índices 0..5 INTACTOS) ———
  // Colas con RETARDO DE FASE: cada intermedio conserva la forma de cola de
  // la pose previa del ciclo (follow-through), el cuerpo se mueve primero.
  { // 6 · galope-estirado — zancada A estirada 1px: delanteras alcanzan más
    //   allá, traseras empujan 1px más atrás; lomo aplanado hacia adelante.
    top: [4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5],
    bot: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10],
    headX: 16, headY: 4, boca: 'cerrada', orejas: 'arriba', ojoAlto: false,
    cola: [[4, 6], [3, 7], [2, 9], [1, 10], [0, 11]],
    patas: [
      { pts: [[14, 8], [16, 9], [17, 10], [18, 11], [19, 12], [19, 13]], paw: [19, 14], cerca: true },
      { pts: [[13, 8], [12, 9], [10, 10], [9, 11], [9, 12], [9, 13]], paw: [9, 14], cerca: false },
      { pts: [[7, 8], [8, 9], [5, 10], [4, 11], [3, 12], [3, 13]], paw: [3, 14], cerca: true },
      { pts: [[6, 8], [7, 9], [9, 10], [10, 11], [11, 12], [11, 13]], paw: [11, 14], cerca: false },
    ],
    brumas: [[6, 2, 2], [9, 1, 3], [12, 2, 2], [15, 3, 2]],
  },
  { // 7 · galope-recogido — compresión 1px: lomo baja, vientre carga, patas
    //   recogidas bajo el cuerpo (fase aérea del galope que precede al impacto).
    top: [7, 7, 6, 6, 5, 5, 5, 5, 6, 6, 6, 6, 7],
    bot: [10, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11],
    headX: 16, headY: 5, boca: 'cerrada', orejas: 'arriba', ojoAlto: false,
    cola: [[4, 6], [3, 6], [2, 7], [1, 8], [0, 8]],
    patas: [
      { pts: [[14, 9], [14, 10], [13, 11], [13, 12], [13, 13]], paw: [13, 14], cerca: true },
      { pts: [[13, 9], [14, 10], [15, 11], [15, 12], [15, 13]], paw: [15, 14], cerca: false },
      { pts: [[7, 9], [8, 10], [8, 11], [9, 12], [9, 13]], paw: [9, 14], cerca: true },
      { pts: [[6, 9], [5, 10], [5, 11], [5, 12], [5, 13]], paw: [5, 14], cerca: false },
    ],
    brumas: [[7, 3, 2], [10, 2, 3], [13, 3, 2], [15, 4, 2]],
  },
  { // 8 · acecho-alza — entre 0 y 1: el lomo sube y la pata delantera cercana
    //   se ALZA 1px del suelo (paso tentativo denso para la patrulla).
    top: [6, 6, 5, 5, 4, 4, 4, 4, 5, 5, 5, 5, 6],
    bot: [10, 10, 10, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10],
    headX: 16, headY: 4, boca: 'cerrada', orejas: 'arriba', ojoAlto: false,
    cola: [[4, 6], [3, 7], [2, 8], [1, 9], [0, 9]],
    patas: [
      { pts: [[14, 8], [15, 9], [15, 10], [15, 11], [14, 12], [14, 13]], paw: [13, 13], cerca: true },
      { pts: [[13, 8], [12, 9], [12, 10], [12, 11], [12, 12], [12, 13]], paw: [12, 14], cerca: false },
      { pts: [[7, 8], [8, 9], [6, 10], [7, 11], [7, 12], [7, 13]], paw: [8, 14], cerca: true },
      { pts: [[6, 8], [6, 9], [5, 10], [5, 11], [5, 12], [5, 13]], paw: [5, 14], cerca: false },
    ],
    brumas: [[6, 3, 2], [9, 2, 2], [12, 2, 3], [14, 3, 2]],
  },
  { // 9 · acecho-baja — entre 1 y 0: vuelve al ras del suelo mientras la
    //   trasera lejana flota (par diagonal de la pose 8).
    top: [6, 6, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6],
    bot: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 11, 10],
    headX: 16, headY: 4, boca: 'cerrada', orejas: 'arriba', ojoAlto: false,
    cola: [[4, 6], [3, 6], [2, 7], [1, 8], [0, 8]],
    patas: [
      { pts: [[14, 8], [15, 9], [15, 10], [15, 11], [15, 12], [15, 13]], paw: [15, 14], cerca: true },
      { pts: [[13, 8], [13, 9], [12, 10], [12, 11], [12, 12], [12, 13]], paw: [12, 14], cerca: false },
      { pts: [[7, 8], [8, 9], [6, 10], [7, 11], [7, 12], [7, 13]], paw: [8, 14], cerca: true },
      { pts: [[6, 8], [5, 9], [5, 10], [4, 11], [4, 12], [4, 13]], paw: [3, 13], cerca: false },
    ],
    brumas: [[6, 3, 2], [9, 2, 2], [12, 3, 3], [14, 4, 2]],
  },
  { // 10 · impacto — rebote de la zambida: cabeza arriba, fauces cerradas de
    //   golpe, pecho alzado y patas en braceo: el retroceso que el Portador
    //   lee como "ya me atacó, ventana de parry/golpe".
    top: [5, 5, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5],
    bot: [9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10],
    headX: 16, headY: 2, boca: 'cerrada', orejas: 'atras', ojoAlto: true,
    cola: [[4, 5], [3, 6], [2, 6], [1, 7], [0, 8]],
    patas: [
      { pts: [[14, 8], [16, 9], [17, 10], [18, 11], [18, 12], [18, 13]], paw: [18, 14], cerca: true },
      { pts: [[13, 8], [13, 9], [12, 10], [12, 11], [12, 12], [12, 13]], paw: [12, 14], cerca: false },
      { pts: [[7, 8], [8, 9], [9, 10], [10, 11], [10, 12], [10, 13]], paw: [10, 14], cerca: true },
      { pts: [[6, 8], [5, 9], [4, 10], [3, 11], [3, 12], [3, 13]], paw: [3, 14], cerca: false },
    ],
    brumas: [[5, 3, 2], [9, 2, 2], [12, 3, 3], [16, 12, 3]],
  },
];

/**
 * Silueta del "perro guardián" que fue: doble exposición tenue, +1px abajo/derecha.
 * R9-7: flota 1px FUERA de fase con el lobo real (f impar) y su cuenca vacía
 * parpadea por hash — el fantasma no copia el ritmo del cuerpo vivo.
 */
function perroFantasma(x: CanvasRenderingContext2D, alza: boolean, f: number): void {
  const hy = (alza ? 4 : 6) + (f % 2);           // en el aullido, su cabeza también sube
  px(x, 5, 8, 13, 4, WOLF.gh);                   // tronco fantasma
  px(x, 17, hy, 6, 4, WOLF.gh);                  // cráneo fantasma
  px(x, 21, hy + 2, 2, 2, WOLF.gh);              // hocico fantasma
  if (rnd(f * 5.17 + 1.3) > 0.3) px(x, 19, hy + 1, 1, 1, WOLF.ghE);  // cuenca (parpadeo hash)
  px(x, 6, 12, 1, 3, WOLF.gh);                   // patas fantasma
  px(x, 9, 12, 1, 3, WOLF.gh);
  px(x, 13, 12, 1, 3, WOLF.gh);
  px(x, 15, 12, 1, 3, WOLF.gh);
  px(x, 2, 8 + (f % 2), 3, 2, WOLF.gh);          // cola fantasma (retraso de fase)
}

/** Torso: relleno por columnas + lomo claro + vientre en sombra + pecho profundo. */
function loboTorso(x: CanvasRenderingContext2D, top: number[], bot: number[]): void {
  for (let i = 0; i < 13; i++) {
    const X = 4 + i, yt = top[i], yb = bot[i];
    px(x, X, yt, 1, yb - yt + 1, WOLF.B);
    px(x, X, yt, 1, 1, WOLF.W);                  // lomo que atrapa la luz fría
    px(x, X, yb, 1, 1, WOLF.S);                  // vientre en sombra
    const r = rnd(i * 3.7);
    if (r > 0.78) px(x, X, yb + 1, 1, 1, WOLF.D2);            // pelaje dentado (sombra profunda)
    else if (r > 0.5) px(x, X, yb + 1, 1, 1, WOLF.S);         // pelaje dentado del vientre
  }
  // costillas marcadas: el hambre de la niebla se lee bajo el pelaje
  for (let i = 2; i <= 10; i += 2) {
    if (rnd(i * 9.1 + 2.3) > 0.2) {
      px(x, 4 + i, top[i] + 2, 1, 2, i % 4 === 2 ? WOLF.D : WOLF.S);
    }
  }
  px(x, 8, top[4], 5, 1, WOLF.H);                // highlight frío en el arco del lomo
  px(x, 13, bot[10] - 1, 3, 2, WOLF.D);          // pecho profundo
  px(x, 14, bot[10], 2, 1, WOLF.D2);             // núcleo de sombra del pecho
}

/** Cresta de pelo erizado: dientes 1-2px sobre el dorso, melena más alta en el cuello. */
function loboCresta(x: CanvasRenderingContext2D, top: number[], f: number): void {
  // cresta dorsal: al galopar (f 2-3) el pelo se yergue más a menudo
  for (let i = 1; i < 12; i++) {
    const X = 4 + i;
    const h = rnd(i * 7.3 + f * 13.7) > (f >= 2 && f <= 3 ? 0.45 : 0.55) ? 2 : 1;
    for (let k = 1; k <= h; k++) px(x, X, top[i] - k, 1, 1, k === 2 ? WOLF.H : WOLF.W);
  }
  // melena del cuello: 2-4px entre hombros y cabeza, de pie al galopar
  for (let X = 13; X <= 15; X++) {
    const h = 2 + (rnd(X * 5.1 + f * 3.3) > 0.5 ? 1 : 0) + (f >= 2 && f <= 3 ? 1 : 0);
    for (let k = 1; k <= h; k++) px(x, X, top[X - 4] - k, 1, 1, k === h ? WOLF.W : WOLF.S);
  }
  // púa suelta en la grupa: rompe la silueta redondeada
  px(x, 3, top[0] + 1, 1, 1, WOLF.W);
}

/** Pata con articulación: muslo 2px, canilla 1px, almohadilla 2×2 al suelo. */
function loboPata(x: CanvasRenderingContext2D, p: LoboPata): void {
  const cAlto = p.cerca ? WOLF.D : WOLF.S;
  const cBajo = p.cerca ? WOLF.B : WOLF.S;
  seg(x, p.pts[0][0], p.pts[0][1], p.pts[1][0], p.pts[1][1], cAlto, 2);
  for (let i = 1; i < p.pts.length - 1; i++) {
    seg(x, p.pts[i][0], p.pts[i][1], p.pts[i + 1][0], p.pts[i + 1][1], cBajo, 1);
  }
  px(x, p.paw[0], p.paw[1], 2, 2, cAlto);        // pie (toca suelo en y14-15)
  px(x, p.paw[0] + 1, p.paw[1] + 1, 1, 1, p.cerca ? cBajo : WOLF.D2);
}

/** Cola larga con curva: base gruesa, punta oscura. */
function loboCola(x: CanvasRenderingContext2D, pts: [number, number][]): void {
  seg(x, pts[0][0], pts[0][1], pts[1][0], pts[1][1], WOLF.S, 2);
  for (let i = 1; i < pts.length - 1; i++) {
    seg(x, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], WOLF.S, 1);
  }
  const tip = pts[pts.length - 1];
  px(x, tip[0], tip[1], 1, 1, WOLF.D2);
}

/**
 * OJO BRASA: brasa naranja 2×2 con ascua dorada de 1px dentro + halo cálido rgba.
 * R9-7: `pulso` hornea por frame la respiración del ascua (1px de halo extra
 * arriba/abajo) — al ciclar frames, la brasa late sin coste por frame.
 */
function loboOjo(x: CanvasRenderingContext2D, hx: number, hy: number, pulso: boolean): void {
  px(x, hx + 2, hy + 1, 2, 2, WOLF.E);           // brasa (#ff7830)
  px(x, hx + 2, hy + 1, 1, 1, WOLF.EC);          // ascua dorada (#ffd24a)
  px(x, hx + 1, hy + 1, 1, 1, WOLF.e);           // halo cálido
  px(x, hx + 4, hy + 1, 1, 1, WOLF.e);
  if (pulso) {
    px(x, hx + 2, hy, 1, 1, WOLF.e);             // halo que sube (pulso alto)
    px(x, hx + 3, hy + 3, 1, 1, WOLF.e);         // halo que baja
  }
}

/** Cabeza de lobo real: cráneo 6×4, hocico 3px con trufa, orejas, ojo brasa.
 *  R9-7: f solo alimenta el PULSO del ojo (frames de esfuerzo → brasa alta). */
function loboCabeza(
  x: CanvasRenderingContext2D,
  hx: number, hy: number,
  boca: 'cerrada' | 'aullido' | 'zambida',
  orejas: 'arriba' | 'atras',
  ojoAlto: boolean,
  f: number,
): void {
  // la brasa arde fuerte en los frames de esfuerzo (zancada, estirón, zambida,
  // impacto) y en algún twinkle por hash — determinista, sin reloj:
  const ojoPulso = f === 2 || f === 5 || f === 6 || f === 10 || rnd(f * 7.31 + 2.9) > 0.8;
  // orejas triangulares
  if (orejas === 'arriba') {
    px(x, hx + 1, hy - 2, 1, 1, WOLF.H);         // puntas que captan la luz
    px(x, hx + 4, hy - 2, 1, 1, WOLF.H);
    px(x, hx, hy - 1, 1, 1, WOLF.D); px(x, hx + 1, hy - 1, 1, 1, WOLF.W); px(x, hx + 2, hy - 1, 1, 1, WOLF.D);
    px(x, hx + 3, hy - 1, 1, 1, WOLF.D); px(x, hx + 4, hy - 1, 1, 1, WOLF.W); px(x, hx + 5, hy - 1, 1, 1, WOLF.D);
  } else {
    // al rastrillo (embestida): dos V diagonales hacia atrás
    seg(x, hx + 2, hy, hx - 2, hy - 2, WOLF.W, 1);
    seg(x, hx + 3, hy + 1, hx - 1, hy - 1, WOLF.D, 1);
  }
  // cráneo
  px(x, hx, hy, 1, 1, WOLF.D);
  px(x, hx + 1, hy, 4, 1, WOLF.W);               // frente clara
  px(x, hx + 5, hy, 1, 1, WOLF.D);
  px(x, hx, hy + 1, 1, 1, WOLF.D);
  px(x, hx + 5, hy + 1, 1, 1, WOLF.S);
  px(x, hx, hy + 2, 1, 1, WOLF.D);
  px(x, hx + 1, hy + 2, 3, 1, WOLF.S);           // mejilla
  px(x, hx + 1, hy + 3, 3, 1, WOLF.D);           // mandíbula/garganta
  px(x, hx + 2, hy + 4, 1, 1, WOLF.S);           // púa de barba bajo la mandíbula

  if (boca === 'aullido') {
    // hocico alzado al cielo, boca entreabierta cantando
    loboOjo(x, hx, hy, ojoPulso);                // ojo brasa (arde al aullar)
    px(x, hx + 5, hy - 1, 2, 1, WOLF.B);         // puente del hocico (diagonal arriba)
    px(x, hx + 7, hy - 2, 1, 1, WOLF.N);         // trufa al aire
    px(x, hx + 5, hy, 2, 1, WOLF.O);             // apertura del aullido
    px(x, hx + 4, hy + 1, 3, 1, WOLF.D);         // mandíbula inferior caída
    px(x, hx + 4, hy + 2, 2, 1, WOLF.B);         // barbilla
  } else if (boca === 'zambida') {
    // fauces abiertas: interior oscuro + colmillos de 1px + ojo furioso 2×2
    loboOjo(x, hx, hy, ojoPulso);                // ojo brasa en furia
    px(x, hx + 2, hy, 1, 1, WOLF.e); px(x, hx + 3, hy, 1, 1, WOLF.e);  // resplandor que sube
    px(x, hx + 4, hy + 1, 3, 1, WOLF.B);         // hocico superior
    px(x, hx + 7, hy + 1, 1, 1, WOLF.N);         // trufa
    px(x, hx + 4, hy + 2, 4, 1, WOLF.O);         // interior de la boca
    px(x, hx + 4, hy + 2, 1, 1, WOLF.F);         // colmillo superior
    px(x, hx + 6, hy + 2, 1, 1, WOLF.F);         // colmillo superior
    px(x, hx + 5, hy + 2, 1, 1, WOLF.F);         // colmillo inferior (zigzag)
    px(x, hx + 3, hy + 3, 4, 1, WOLF.D);         // mandíbula inferior
    px(x, hx + 6, hy + 4, 1, 1, WOLF.F);         // colmillo inferior que gotea
  } else {
    // hocico cerrado de 3px (hy+1..hy+3) con trufa y línea de boca
    if (ojoAlto) px(x, hx + 2, hy, 2, 1, WOLF.D);  // ceño fruncido (preparación)
    loboOjo(x, hx, hy, ojoPulso);                // OJO BRASA 2×2 con ascua
    px(x, hx + 4, hy + 2, 4, 1, WOLF.B);         // hocico
    px(x, hx + 7, hy + 2, 1, 1, WOLF.N);         // trufa
    px(x, hx + 4, hy + 3, 3, 1, WOLF.D);         // labio inferior
    px(x, hx + 5, hy + 3, 3, 1, WOLF.O);         // línea de la boca
    px(x, hx + 6, hy + 3, 1, 1, WOLF.F);         // diente que asoma (boca cerrada)
    px(x, hx + 7, hy + 4, 1, 1, WOLF.F);         // colmillo inferior que cuelga
  }
}

/** Niebla: emana del lomo y se arrastra por el suelo entre las patas.
 *  R9-7: briznas y penachos con FASE POR HASH — cada frame de la hoja lleva
 *  su propia niebla, así el ciclado la hace rodar sin coste por frame. */
function loboNiebla(x: CanvasRenderingContext2D, P: LoboPose, f: number): void {
  for (const [bx, by, bw] of P.brumas) {
    px(x, bx, by, bw, 1, WOLF.f2);
    px(x, bx + 1, by - 1, 1, 1, WOLF.f1);        // brizna que asciende
    if (by > 2 && rnd(bx * 7.7 + f * 1.9) > 0.55) {
      px(x, bx + bw, by - 2, 1, 1, WOLF.f1);     // segunda brizna, fase por hash
    }
  }
  // bruma rasante bajo el vientre, con huecos deterministas
  for (let X = 2; X < 20; X++) {
    if (rnd(X * 3.1 + f * 5.7) > 0.45) {
      px(x, X, 13, 1, 1, rnd(X + f * 2) > 0.6 ? WOLF.f2 : WOLF.f1);
    } else if (rnd(X * 9.7 + f * 2.1) > 0.86) {
      px(x, X, 12, 1, 2, WOLF.f1);               // penacho de 2px en los huecos
    }
  }
  if (P.estelas) {
    // estelas de niebla que la zambida deja atrás
    px(x, 0, 7, 5, 1, WOLF.f2);
    px(x, 0, 9, 4, 1, WOLF.f2);
    px(x, 1, 11, 5, 1, WOLF.f1);
    px(x, 2, 13, 4, 1, WOLF.f1);
  }
}

/** LOBO DE NIEBLA — 24×16 · 11 frames (0..5 contrato clásico intacto;
 *  6..10 intermedios de galope/acecho + impacto, ver cabecera). */
export function buildWolf(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 11; f++) {
    const { c, x } = mkCanvas(24, 16);
    const P = LOBO_POSES[f];
    perroFantasma(x, !!P.fantasmaAlza, f);                  // doble exposición (fondo, fase propia)
    loboCola(x, P.cola);
    for (const p of P.patas) if (!p.cerca) loboPata(x, p);  // patas lejanas
    loboTorso(x, P.top, P.bot);
    loboCresta(x, P.top, f);
    loboCabeza(x, P.headX, P.headY, P.boca, P.orejas, P.ojoAlto, f);
    for (const p of P.patas) if (p.cerca) loboPata(x, p);   // patas cercanas
    loboNiebla(x, P, f);                                    // niebla del lomo y del suelo
    frames.push(c);
  }
  return frames;
}

/**
 * Índice RECOMENDADO de frame del lobo para un reloj continuo `anim`
 * (e.anim, g.globalT…): paso diagonal DENSO en 8 fases (R9-7) — acecho
 * intercalado entre zancadas con intermedios de subida/bajada y de
 * galope (estira-recoge). Apto para cualquier uso genérico del
 * integrador; para selección fina por estado de IA existe wolfFrameAI().
 * Devuelve siempre 0..10.
 */
const WOLF_SEQ_PACE = [0, 8, 2, 6, 1, 9, 3, 7];    // paso diagonal denso (R9-7)
const WOLF_SEQ_GALOPE = [2, 6, 3, 7];              // galope: estira → recoge (1px)
const WOLF_SEQ_ACECHO = [0, 8, 1, 9];              // acecho denso de patrulla
// (secuencias a nivel de módulo: CERO allocations por llamada)

export function wolfFrame(anim: number): number {
  return WOLF_SEQ_PACE[Math.floor(Math.max(0, anim) * 10) % 8];
}

/**
 * Índice de frame del lobo según su IA (conexión fina para el integrador).
 * ai ∈ 'patrulla' | 'persigue' | 'carga' (windup) | 'ataca' | 'recupera' |
 *      'huye' | 'aturdido'  — los mismos estados de update.ts.
 * anim = e.anim (fase continua del enemigo). Devuelve siempre 0..10.
 *
 * Sugerencia de conexión en render.ts:
 *   const fi = e.etype === 'lobo' ? wolfFrameAI(e.ai, e.anim)
 *                                 : entityFrame(spr, e.dir, e.moving, e.anim);
 *
 * R9-7: persigue/huye galopan en 4 fases (estira-recoge, mismo ritmo de
 * ciclado que antes pero con poses de estiramiento y compresión de 1px);
 * patrulla acecha en 4 fases (pata alzada); recupera muestra el IMPACTO
 * (rebote de la zambida) alternando con la recomposición. Devuelve 0..10.
 */
export function wolfFrameAI(ai: string, anim: number): number {
  const a = Math.max(0, anim);
  switch (ai) {
    case 'persigue': return WOLF_SEQ_GALOPE[Math.floor(a * 8) % 4];   // galope estira-recoge
    case 'huye': return WOLF_SEQ_GALOPE[Math.floor(a * 10) % 4];      // galope frenético
    case 'carga': return 4;                                // preparación agachada (telegrafía)
    case 'ataca': return 5;                                // zambida con las fauces abiertas
    case 'recupera': return Math.floor(a * 8) % 2 === 0 ? 10 : 1;  // IMPACTO → se recompone
    case 'aturdido': return 0;                             // vencido, pegado al suelo
    default: return WOLF_SEQ_ACECHO[Math.floor(a * 3.6) % 4];         // patrulla: acecho denso
  }
}

// ============================================================
// GUARDIÁN HUECO — 40×44, 8 frames (JEFE)
// Armadura vacía: dentro del casco NO hay cara — vacío negro con dos
// cuencas pequeñas y profundas de glow tenue; visera con grietas
// radiando; el hueco del pecho encierra el Eco con parpadeo lento; dedos-garra
// de 3 falanges; capa rota con flecos
// que flotan INDEPENDIENTES del bob. Aura: sombra elíptica horneada más
// grande + escamas caídas bajo el jefe en los frames idle.
// Estados: 0-1 idle · 2-3 grito · 4-5 invocación · 6-7 colapso.
// Terror V3: corona deslucida sobre la máscara + grieta que la parte, Eco del
// pecho con parpadeo LENTO (chispa y halo solo en el pulso alto), un único
// punto de luz parpadeante en cada cuenca hueca, brazos más largos con garras
// colgantes, flecos con jirones y desgarrón que se abre en colapso (donde
// además se rompe el cuerno izquierdo).
// ============================================================

/** Glow por FASE de juego del jefe (1..3) — para partículas/ondas del integrador. */
export const GUARDIAN_PHASE_GLOW = ['#7ee8ff', '#ffd24a', '#ff5a4a'] as const;

export type GuardianState = 'idle' | 'grito' | 'invoca' | 'colapso';

const GUARD = {
  O: '#141220',                    // vacío del casco / grietas
  V: '#0a0916',                    // cuenca del ojo (profundidad)
  A: '#241d38',                    // capa
  A2: '#191329',                   // capa en sombra / flecos
  S: '#4a4660',                    // armadura base (identidad)
  S2: '#5f5a7a',                   // armadura clara (identidad)
  HL: '#8a84a8',                   // brillo metálico
  D: '#37334c',                    // armadura oscura (volumen)
  esc: '#6a6684',                  // escama caída
  esc2: '#57536e',                 // escama en sombra
  bruma: 'rgba(160,175,210,0.16)', // bruma de la base
  brumaRoja: 'rgba(255,90,74,0.13)',
  cor: '#c9b078',                  // corona deslucida (acento 1)
  cor2: '#8a7442',                 // corona en sombra (acento 2)
} as const;

function glowDe(st: number): { glow: string; hi: string; dim: string; halo: string } {
  if (st === 3) {
    return {
      glow: '#ff5a4a', hi: '#ffb0a0', dim: '#a83526',
      halo: 'rgba(255,90,74,0.35)',
    };
  }
  return {
    glow: '#7ee8ff', hi: '#c9f6ff', dim: '#3fb6cf',
    halo: 'rgba(126,232,255,0.30)',
  };
}

/**
 * Mitad IZQUIERDA del Guardián (x0..19 sobre lienzo de 20×44).
 * El espejo se aplica en buildGuardian(): simetría perfecta garantizada.
 * Orden de pintado = profundidad: aura → capa → fragmentos traseros → cuerpo.
 */
function guardianMitad(x: CanvasRenderingContext2D, f: number): void {
  const st = f >> 1;                                  // 0 idle · 1 grito · 2 invoca · 3 colapso
  const bob = st === 3 ? (f % 2 === 1 ? 1 : 0) : (f % 2 === 1 ? 1 : -1);  // idle ±1px · colapso se hunde
  const g = glowDe(st);
  const par = f % 2 === 0;                          // parpadeo lento compartido: Eco + punto de luz

  // --- sombra-aura proyectada (más grande que la del motor) ---
  x.fillStyle = st === 3 ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.30)';
  x.fillRect(6, 41, 14, 1);
  x.fillRect(3, 42, 17, 1);
  x.fillRect(1, 43, 19, 1);

  // --- capa rota (detrás de todo el cuerpo) ---
  for (let y = 14 + bob; y <= 34 + bob; y++) {
    let xl: number;
    if (y < 17 + bob) xl = 8;
    else if (y < 29 + bob) xl = 5;
    else if (y < 33 + bob) xl = 6;
    else xl = 7;
    px(x, xl, y, 20 - xl, 1, (y + xl) % 7 === 0 ? GUARD.A2 : GUARD.A);
  }
  // desgarrón de la capa (hueco real); en el colapso se abre más
  x.clearRect(7, 22 + bob, 3, 3);
  if (st === 3) x.clearRect(7, 21 + bob, 3, 5);
  // borde inferior deshilachado
  for (let X = 7; X < 20; X += 2) px(x, X, 34 + bob, 1, 1, GUARD.A2);

  // --- flecos que flotan INDEPENDIENTES del bob (longitud propia por frame) ---
  const extraFleco = st === 3 ? 1 : 0;
  for (let X = 6; X <= 18; X += 2) {
    const len = 2 + Math.floor(rnd(X * 3.7 + f * 1.3) * 5) + extraFleco;
    px(x, X, 35, 1, len, GUARD.A2);
    px(x, X, 35 + len, 1, 1, GUARD.O);
    if (rnd(X * 1.9 + f * 2.7) > 0.6) px(x, X + 1, 34 + len, 1, 1, GUARD.A2);  // jirón lateral
  }

  // --- fragmentos traseros (invocación) ---
  if (st === 2) {
    x.globalAlpha = 0.9;
    if (f % 2 === 0) { px(x, 3, 10, 2, 2, GUARD.S2); px(x, 6, 26, 2, 2, GUARD.S2); }
    else { px(x, 5, 8, 2, 2, GUARD.S2); px(x, 8, 28, 2, 2, GUARD.S2); }
    x.globalAlpha = 1;
  }

  // --- brazo largo (nace bajo la hombrera) + antebrazo alargado ---
  px(x, 2, 18 + bob, 5, 8, GUARD.S2);                 // brazo
  px(x, 2, 18 + bob, 1, 8, GUARD.D);                  // canto exterior
  px(x, 2, 26 + bob, 4, 7, GUARD.S);                  // antebrazo
  px(x, 2, 26 + bob, 4, 1, GUARD.D);                  // codo
  px(x, 3, 21 + bob, 1, 1, GUARD.HL); px(x, 3, 29 + bob, 1, 1, GUARD.HL);

  // --- garras colgantes: 3 falanges por dedo, llegan casi al suelo ---
  for (const fx of [1, 3, 5]) {
    px(x, fx, 33 + bob, 1, 3, GUARD.S2);              // falange 1
    px(x, fx, 36 + bob, 1, 1, GUARD.O);               // nudillo
    px(x, fx, 37 + bob, 1, 3, GUARD.S2);              // falange 2
    px(x, fx, 40 + bob, 1, 1, GUARD.O);               // nudillo
    px(x, fx, 41 + bob, 1, 3, GUARD.S2);              // falange 3 (roza el borde inferior)
    px(x, fx + 1, Math.min(43, 43 + bob), 1, 1, GUARD.HL);  // punta curvada
  }

  // --- hombrera con pinchos ---
  px(x, 3, 12 + bob, 10, 6, GUARD.S2);
  px(x, 3, 12 + bob, 10, 1, GUARD.HL);
  px(x, 3, 17 + bob, 10, 2, GUARD.D);
  px(x, 4, 10 + bob, 1, 2, GUARD.S2); px(x, 7, 9 + bob, 1, 3, GUARD.S2); px(x, 10, 10 + bob, 1, 2, GUARD.S2);
  px(x, 7, 9 + bob, 1, 1, GUARD.HL);
  px(x, 6, 14 + bob, 1, 1, GUARD.HL); px(x, 9, 14 + bob, 1, 1, GUARD.HL);   // remaches

  // --- torso con placas ---
  px(x, 11, 14 + bob, 9, 17, GUARD.S);
  px(x, 11, 15 + bob, 1, 16, GUARD.D);                // sombra lateral
  px(x, 18, 14 + bob, 2, 1, GUARD.HL);                // brillo central
  px(x, 11, 17 + bob, 9, 1, GUARD.D);                 // junta de placa
  px(x, 11, 27 + bob, 9, 1, GUARD.D);

  // --- hueco del pecho: el Eco brilla dentro (parpadeo LENTO) ---
  px(x, 15, 17 + bob, 5, 10, GUARD.O);                // vacío (mitad de 10px)
  px(x, 15, 17 + bob, 1, 10, GUARD.S2);               // borde del hueco
  // rombo del Eco: el contorno arde siempre; el núcleo respira despacio
  px(x, 18, 19 + bob, 2, 1, g.glow);
  px(x, 17, 20 + bob, 3, 3, g.glow);
  px(x, 18, 23 + bob, 2, 1, g.glow);
  px(x, 18, 20 + bob, 2, 3, par ? g.glow : g.dim);    // núcleo palpitante
  if (par) px(x, 19, 21 + bob, 1, 1, g.hi);           // chispa central (solo pulso alto)
  if (par) px(x, 14, 21 + bob, 1, 2, g.dim);          // luz que escapa por la junta
  if (st === 1 || (st === 0 && par)) {
    // halo: grito desbordado · idle solo en el pulso alto (parpadeo lento)
    x.fillStyle = g.halo;
    x.fillRect(16, 18 + bob, 4, 8);
  }
  if (st === 3 && f % 2 === 1) {
    x.fillStyle = g.halo;                             // colapso: pulso rojo errático
    x.fillRect(16, 19 + bob, 4, 6);
  }

  // --- falda con pliegues, borde deshilachado ---
  px(x, 10, 31 + bob, 10, 7, GUARD.S);
  px(x, 12, 31 + bob, 1, 7, GUARD.D); px(x, 16, 31 + bob, 1, 7, GUARD.D);
  for (let X = 10; X < 20; X++) {
    if (rnd(X * 2.9 + f) > 0.3) px(x, X, 38 + bob, 1, 1, GUARD.D);   // picos del bajo
  }
  // túnica desgarrada: mordiscos de vacío en el bajo de la falda
  x.clearRect(11, 37 + bob, 1, 2);
  x.clearRect(16, 37 + bob, 1, 1);

  // --- casco hueco (NO hay cara: vacío con dos cuencas) ---
  px(x, 12, 2 + bob, 8, 11, GUARD.S2);                // bóveda
  px(x, 12, 2 + bob, 8, 1, GUARD.HL);                 // cresta del casco
  px(x, 12, 12 + bob, 8, 1, GUARD.S);                 // mandíbula del yelmo
  px(x, 12, 6 + bob, 8, 1, GUARD.HL);                 // arco de la visera
  px(x, 12, 5 + bob, 1, 7, GUARD.D);                  // canto izquierdo
  px(x, 13, 7 + bob, 7, 5, GUARD.O);                  // EL VACÍO (sin rostro)
  px(x, 15, 9 + bob, 2, 2, GUARD.V);                  // cuenca izquierda (profunda)
  x.globalAlpha = par ? 0.95 : 0.45;
  px(x, 16, 9 + bob, 1, 1, par ? g.hi : g.glow);      // UN punto de luz: parpadeo lento
  x.globalAlpha = 1;

  // --- corona deslucida: 3 puntas por lado sobre la cresta (falta la central) ---
  px(x, 13, 1 + bob, 1, 2, GUARD.cor2);               // punta corta
  px(x, 15, 1 + bob, 1, 3, GUARD.cor);                // punta alta
  px(x, 17, 2 + bob, 1, 2, GUARD.cor);                // punta media, hacia el centro

  if (st === 1) {
    // GRITO: la visera se abre hacia abajo y el glow interior crece, pero el
    // casco sigue VACÍO (el brillo es un núcleo dentro del vacío, no un lavado)
    px(x, 13, 12 + bob, 7, 2 + (f % 2), GUARD.O);     // mandíbula del yelmo cae
    x.fillStyle = f % 2 === 0 ? 'rgba(126,232,255,0.28)' : 'rgba(201,246,255,0.42)';
    x.fillRect(13, 7 + bob, 7, 7 + (f % 2));          // halo del grito (derrama)
    px(x, 13, 7 + bob, 7, 5, GUARD.O);                // el vacío permanece vacío
    x.globalAlpha = 0.85;
    px(x, 14, 8 + bob, 5, 2, g.glow);                 // núcleo del grito (crece por frame)
    px(x, 15, 9 + bob, 3, 1, g.hi);                   // centro caliente
    px(x, 16, 9 + bob, 1, 1, g.hi);                   // la cuenca se enciende
    x.globalAlpha = 1;
  }

  // --- cuerno-corona (de la sien, curvándose arriba-afuera) ---
  seg(x, 12, 6 + bob, 9, 3 + bob, GUARD.S2, 2);
  seg(x, 9, 3 + bob, 8, 1 + bob, GUARD.HL, 1);
}

/** Detalles ASIMÉTRicos sobre el lienzo espejado: grietas, fragmentos, escamas. */
function guardianFrente(x: CanvasRenderingContext2D, f: number): void {
  const st = f >> 1;
  const bob = st === 3 ? (f % 2 === 1 ? 1 : 0) : (f % 2 === 1 ? 1 : -1);  // idle ±1px · colapso se hunde
  const g = glowDe(st);

  // grietas radiando de la visera (una por lado, asimétricas entre sí)
  seg(x, 13, 7 + bob, 11, 4 + bob, GUARD.O, 1);
  seg(x, 26, 11 + bob, 29, 14 + bob, GUARD.O, 1);
  px(x, 10, 3 + bob, 1, 1, GUARD.O);
  // V3: grieta que baja de la corona y parte la máscara (solo lado izquierdo)
  seg(x, 15, 2 + bob, 14, 5 + bob, GUARD.O, 1);
  px(x, 12, 6 + bob, 1, 1, GUARD.O);

  // colapso: la armadura se agrieta y el glow rojo escapa por las grietas
  if (st === 3) {
    seg(x, 24, 15 + bob, 28, 21 + bob, GUARD.O, 1);
    seg(x, 15, 28 + bob, 19, 34 + bob, GUARD.O, 1);
    seg(x, 22, 2 + bob, 24, 6 + bob, GUARD.O, 1);
    x.globalAlpha = 0.6;
    px(x, 25, 17 + bob, 1, 2, g.glow);
    px(x, 16, 30 + bob, 1, 2, g.glow);
    px(x, 23, 3 + bob, 1, 1, g.glow);
    x.globalAlpha = 1;
    // fragmentos que se desprenden y caen
    x.globalAlpha = 0.9;
    px(x, 9, 40, 2, 2, GUARD.S2);
    px(x, 30, 38 + (f % 2), 2, 1, GUARD.esc2);
    x.globalAlpha = 1;
    // V3: el cuerno izquierdo se rompe y un trozo cae
    x.clearRect(8, 0, 3, 5);
    px(x, 7, 36 + (f % 2), 1, 2, GUARD.esc2);
  }

  // grito: esquirlas de luz que salen despedidas del casco
  if (st === 1) {
    x.globalAlpha = 0.8;
    px(x, 7, 4 + bob, 1, 1, g.hi);
    px(x, 28, 3, 1, 1, g.hi);
    px(x, 24, 0, 1, 1, g.hi);
    x.globalAlpha = 1;
  }

  // invocación: fragmentos DELANTE orbitando (con estela de 1px)
  if (st === 2) {
    x.globalAlpha = 0.95;
    if (f % 2 === 0) {
      px(x, 26, 8, 2, 2, GUARD.S2); px(x, 12, 30, 2, 2, GUARD.S2); px(x, 30, 26, 3, 2, GUARD.S2);
      px(x, 24, 10, 1, 1, GUARD.HL); px(x, 14, 28, 1, 1, GUARD.HL);
    } else {
      px(x, 24, 12, 2, 2, GUARD.S2); px(x, 28, 30, 2, 2, GUARD.S2); px(x, 10, 22, 2, 3, GUARD.S2);
      px(x, 26, 14, 1, 1, GUARD.HL); px(x, 12, 24, 1, 1, GUARD.HL);
    }
    x.globalAlpha = 1;
    x.fillStyle = g.halo;                             // el Eco se desborda al invocar
    x.fillRect(16, 18 + bob, 8, 8);
  }

  // escamas caídas bajo el jefe (solo idle: el cuerpo se desprende a trozos)
  if (st === 0) {
    x.globalAlpha = 0.85;
    px(x, 7, 41, 2, 1, GUARD.esc);                 // escama caída 1
    px(x, 19, 42, 2, 1, GUARD.esc2);               // escama caída 2
    px(x, 30, 42, 3, 1, GUARD.esc);                // escama caída 3
    x.globalAlpha = 1;
  }

  // bruma de la base (fría; teñida a rojo en colapso)
  for (let X = 3; X < 37; X++) {
    if (rnd(X * 4.4 + f * 2.1) > 0.55) {
      px(x, X, 41 + (rnd(X + f) > 0.6 ? 1 : 0), 1, 1, st === 3 ? GUARD.brumaRoja : GUARD.bruma);
    }
  }
}

/** GUARDIÁN HUECO — 40×44 · 8 frames (ver contrato en la cabecera). */
export function buildGuardian(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 8; f++) {
    const { c, x } = mkCanvas(40, 44);
    const half = mkCanvas(20, 44);
    guardianMitad(half.x, f);
    x.save();
    x.drawImage(half.c, 0, 0);              // mitad izquierda
    x.translate(40, 0);
    x.scale(-1, 1);
    x.drawImage(half.c, 0, 0);              // mitad derecha (espejo exacto)
    x.restore();
    guardianFrente(x, f);                   // detalles asimétricos por encima
    frames.push(c);
  }
  return frames;
}

/**
 * Índice de frame del Guardián según su ESTADO de juego (para el integrador).
 *
 *   guardianFrame('idle', g.globalT)      → 0..1   patrulla/persigue: bob flotante
 *   guardianFrame('grito', e.windup)      → 2..3   windup del slam/onda: visera abierta
 *   guardianFrame('invoca', e.sumT)       → 4..5   invocación de sombras (fase 2)
 *   guardianFrame('colapso', g.globalT)   → 6..7   fase 3 o 'aturdido': grietas rojas
 *
 * t es un reloj continuo en segundos (e.anim, e.windup, g.globalT…).
 * Devuelve siempre 0..7 (accesible por entityFrame sin riesgo de crash).
 *
 * Sugerencia de conexión en render.ts:
 *   let estado: GuardianState = 'idle';
 *   if (e.etype === 'guardian') {
 *     if (e.phase === 3 || e.ai === 'aturdido') estado = 'colapso';
 *     else if (e.ai === 'carga' && e.windup > 0) estado = 'grito';
 *     else if (e.sumT > 0) estado = 'invoca';
 *     fi = guardianFrame(estado, e.anim);
 *   }
 * Y para FX de fase (ondas, partículas, telegraphs):
 *   const glow = GUARDIAN_PHASE_GLOW[e.phase - 1];
 */
export function guardianFrame(state: GuardianState, t: number): number {
  const s = Math.max(0, t);
  switch (state) {
    case 'grito': return 2 + (Math.floor(s * 8) % 2);    // grito convulso
    case 'invoca': return 4 + (Math.floor(s * 6) % 2);   // órbita de fragmentos
    case 'colapso': return 6 + (Math.floor(s * 5) % 2);  // derrumbe irregular
    default: return Math.floor(s * 2) % 2;               // idle: bob lento (±1px)
  }
}
