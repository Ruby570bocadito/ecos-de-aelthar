// ============================================================
// ECOS DE AELTHAR — ACTO II · Arte pixel procedural de la
// EXPANSIÓN (AGENTE 7-b · enemigos + sprites).
// 100% procedural: canvas + fillRect píxel a píxel, sin assets.
// NO toca sprites.ts: usa registerSpr()/hash2() (contrato).
// R6-V1: REDISEÑO TERROR V2 de los jefes de expansión (sirena, golem,
// vult, coro, ecodesg, satiro + ojos de neumo/espectro/arpi):
// siluetas retorcidas, ojos glow de 2 tonos, paleta fría + 1 acento
// y detalles de historia (cadenas rotas, cicatrices, costuras).
// R9-1: EXPANSIÓN V4 — tiles al nivel del mundo base: arena con
// gradación húmeda y espuma de borde irregular, adoquinado de Merrow
// con huecos/hierba, nieve con destellos fríos, hielo SEMITRANSPARENTO
// (agua pintada bajo capa de escarcha) con grietas y coros ahogados;
// autotiling agresivo por contexto de vecinos PREHORNEADO (Uint8Array,
// cero allocations); props con variantes deterministas; enemigos con
// ciclos de 4 fases (compatibles con el cap de 2 de entityFrame) y
// jefes con pasada de contraste/silueta.
//
// Contenido:
//   · initExpansionSprites(): registra 'neumo', 'espectro', 'arpi',
//     'sirena' (jefa 32×32), 'golem' (jefe 32×32) y los proyectiles
//     'orb', 'shard', 'nota' (1 frame).
//   · drawExpansionTile(): tiles de suelo nuevos ('s' arena, 'S' nieve,
//     'i' hielo) + variantes de '.' ',' ':' '=' por mapa (costa,
//     aldea, cumbres). Devuelve true si dibujó el tile.
//   · drawExpansionTallTile(): palmera ('p' en costa) y pino nevado
//     ('t'/'p' en cumbres). Devuelve true si dibujó.
//   · drawExpansionProp(): 'wreck', 'faro', 'lamp' (centrados en cx,cy).
//   · drawExpansionProjectile(): 'orb', 'shard', 'nota' con animación.
//
// Estilo: copia la técnica de sprites.ts (buildWolf/buildGuardian/
// buildFragment/drawTile): outline oscuro, sombreado simple por
// rects, hash2(tx,ty) para moteado determinista, zoom lo aplica el
// render (los canvas van en píxeles de arte).
// ============================================================

import { registerSpr, hash2 } from './sprites';
import type { Frames } from './sprites';
// R9-1: solo lectura de las filas de la expansión para hornear vecinos
// (maps_expansion no importa nada de este módulo → sin ciclo).
import { EXPANSION_MAPS } from './maps_expansion';

// ---------------- utilidades locales ----------------

function cv(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

/** Rect pintado (equivalente al px() interno de sprites.ts). */
function rc(x: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, col: string) {
  x.fillStyle = col;
  x.fillRect(rx, ry, rw, rh);
}

/** Disco pixelado determinista (para burbujas, orbes y halos). */
function disc(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, alpha = 1) {
  x.globalAlpha = alpha;
  x.fillStyle = col;
  const top = Math.ceil(r);
  for (let dy = -top; dy <= top; dy++) {
    const w = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (w < 0.35 && Math.abs(dy) > 0) continue;
    x.fillRect(Math.round(cx - w), cy + dy, Math.max(1, Math.round(w * 2 + 1)), 1);
  }
  x.globalAlpha = 1;
}

// ============================================================
// R9-1 · CONTEXTO DE VECINOS PREHORNEADO (autotiling agresivo)
// buildGround() (engine.ts) llama a drawExpansionTile tile a tile,
// SIN acceso a los vecinos. En initExpansionSprites() leemos las
// filas de EXPANSION_MAPS (solo lectura: las mismas filas que pinta
// el motor) y horneamos, por tile, QUÉ vecinos cumplen cada
// condición:
//   bits 0..3 = N,E,S,W del anillo 1 (vecino directo)
//   bits 4..7 = misma dirección en el anillo 2 (a ≤2 pasos)
// Todo en Uint8Array de 64×64: lookup O(1) y CERO allocations en el
// prerrender. buildGround corre SIEMPRE después de initExpansionSprites
// (engine.ts: constructor → loadMap), así el contexto está listo.
// ============================================================
const NB_N = 1, NB_E = 2, NB_S = 4, NB_W = 8;
let CX_COSTA_AGUA: Uint8Array | null = null;  // bits0-3 anillo1 · bits4-7 anillo2
let CX_COSTA_ARENA: Uint8Array | null = null; // arena vecina (dunas)
let CX_ALDEA_HIERBA: Uint8Array | null = null; // hierba reclaimando el pueblo
let CX_ALDEA_AGUA: Uint8Array | null = null;  // laguna vecina (losa mojada)
let CX_CUMBRES_HIELO: Uint8Array | null = null; // lago helado vecino (orillas)

/** Máscara de vecinos directos que cumplen `match` (bits N,E,S,W). */
function ring1(rows: string[], match: (ch: string) => boolean): Uint8Array {
  const a = new Uint8Array(64 * 64);
  for (let ty = 0; ty < rows.length && ty < 64; ty++) {
    const row = rows[ty];
    const up = ty > 0 ? rows[ty - 1] : '';
    const dn = ty + 1 < rows.length ? rows[ty + 1] : '';
    for (let tx = 0; tx < row.length && tx < 64; tx++) {
      let m = 0;
      if (up.length > tx && match(up[tx])) m |= NB_N;
      if (tx + 1 < row.length && match(row[tx + 1])) m |= NB_E;
      if (dn.length > tx && match(dn[tx])) m |= NB_S;
      if (tx > 0 && match(row[tx - 1])) m |= NB_W;
      a[(ty << 6) | tx] = m;
    }
  }
  return a;
}

/** Anillo 2 por dirección: el bit exterior del anillo 1 de cada vecino. */
function ring2(r1: Uint8Array): Uint8Array {
  const a = new Uint8Array(64 * 64);
  for (let ty = 0; ty < 64; ty++) {
    for (let tx = 0; tx < 64; tx++) {
      const i = (ty << 6) | tx;
      let m = 0;
      if (ty > 0) m |= r1[i - 64] & NB_N;
      if (tx < 63) m |= r1[i + 1] & NB_E;
      if (ty < 63) m |= r1[i + 64] & NB_S;
      if (tx > 0) m |= r1[i - 1] & NB_W;
      a[i] = m;
    }
  }
  return a;
}

/** Lookup de 4 bits con desplazamiento; seguro fuera de rango (devuelve 0). */
function nbBits(a: Uint8Array | null, tx: number, ty: number, shift: number): number {
  if (!a || tx < 0 || tx > 63 || ty < 0 || ty > 63) return 0;
  return (a[(ty << 6) | tx] >> shift) & 15;
}

function initTileContext(): void {
  const agua = (ch: string) => ch === '~' || ch === 'x' || ch === 'B';
  // costa: agua a 1 y a 2 pasos (empaquetadas en un byte) + arena vecina
  const c1 = ring1(EXPANSION_MAPS.costa.rows, agua);
  const c2 = ring2(c1);
  const costaAgua = new Uint8Array(64 * 64);
  for (let i = 0; i < costaAgua.length; i++) costaAgua[i] = c1[i] | (c2[i] << 4);
  CX_COSTA_AGUA = costaAgua;
  CX_COSTA_ARENA = ring1(EXPANSION_MAPS.costa.rows, (ch) => ch === 's');
  // aldea: hierba reclaimando el empedrado + laguna
  CX_ALDEA_HIERBA = ring1(EXPANSION_MAPS.aldea.rows, (ch) => ch === '.' || ch === 'c');
  CX_ALDEA_AGUA = ring1(EXPANSION_MAPS.aldea.rows, agua);
  // cumbres: lago helado (orillas del hielo)
  CX_CUMBRES_HIELO = ring1(EXPANSION_MAPS.cumbres.rows, (ch) => ch === 'i');
}

// ============================================================
// ENEMIGOS NUEVOS
// ============================================================

// ---------------- Neumo de Marea (16×16 · 4 frames · R9-1) ----------------
// Criatura burbuja de espuma: flota y tiembla. Aguamarina translúcida
// con brillo, ojo mayor + mota menor, vórtice interior y luz de
// refracción en la panza. Ciclo de 4 fases (f0/f1 = el ciclo antiguo,
// entityFrame alterna esas dos hasta que el motor consuma n frames).

function buildNeumo(): Frames {
  const frames: Frames = [];
  const O = '#1c5a5e', BD = '#4ec2b8', B = '#7fe8d8', HL = '#d8fcf4', EYE = '#173038';
  for (let f = 0; f < 4; f++) {
    const { c, x } = cv(16, 16);
    // flotación v4 (4 fases): 0 reposo · 1 cede · 2 reposo (vórtice alterna) · 3 sube
    const oy = f === 1 ? 1 : f === 3 ? -1 : 0;
    const rr = f === 1 ? 6.4 : f === 3 ? 5.8 : 6.1; // tensión de superficie
    // contorno + masa translúcida
    disc(x, 8, 8, rr, O, 0.85);
    disc(x, 8, 8 + oy * 0.4, rr - 0.9, BD, 0.72);
    disc(x, 8, 8 + oy * 0.4, rr - 1.9, B, 0.68);
    // luz de refracción en la panza (separa la silueta del suelo)
    x.globalAlpha = 0.45;
    rc(x, 5, 11 + oy, 5, 1, B);
    rc(x, 6, 12 + oy, 3, 1, BD);
    x.globalAlpha = 1;
    // vórtice interior: la marea gira dentro (alterna por fase)
    x.globalAlpha = 0.42;
    if (f & 1) { rc(x, 6, 9, 4, 1, BD); rc(x, 9, 7 + oy, 1, 2, BD); }
    else { rc(x, 6, 8 + oy, 1, 2, BD); rc(x, 6, 9, 4, 1, BD); }
    x.globalAlpha = 1;
    // brillo (espalda superior) + reflejo secundario
    x.globalAlpha = 0.92;
    rc(x, 5, 4 - oy, 3, 2, HL);
    rc(x, 4, 5 - oy, 1, 1, HL);
    x.globalAlpha = 0.55;
    rc(x, 9, 5 - oy, 1, 2, HL);
    // ojo mayor: glow de dos tonos (halo teal + núcleo oscuro con brillo)
    x.globalAlpha = 0.35;
    rc(x, 8, 6 - oy, 4, 4, '#2a8a84');
    x.globalAlpha = 1;
    rc(x, 9, 7 - oy, 2, 2, EYE);
    rc(x, 9, 7 - oy, 1, 1, '#ffffff');
    // ojo menor (asimetría de la criatura): mota que mira a la marea
    rc(x, 6, 8 - oy, 1, 1, EYE);
    // cicatriz de la membrana (ya estalló una vez y se recosió)
    x.globalAlpha = 0.5;
    rc(x, 4, 9, 1, 2, O); rc(x, 5, 11, 1, 1, O);
    x.globalAlpha = 1;
    // burbujitas de espuma (derivan con la fase)
    x.globalAlpha = 0.7;
    rc(x, 3, 12, 2, 2, B);
    rc(x, 11, 12 + (f & 1), 2, 1, B);
    rc(x, 7, 13, 1, 1, HL);
    if (f === 2) rc(x, 12, 10, 1, 1, HL);        // burbuja escapada
    if (f === 3) rc(x, 4, 10, 1, 1, B);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Espectro sin Nombre (16×16 · 4 frames · R9-1) ----------------
// Fantasma humanoide pálido que levita; borde deshilachado que alterna
// por fase, resplandor interno en el pecho y halo frío de los ojos que
// late. f0/f1 reproducen el ciclo antiguo (cap de entityFrame).

function buildEspectro(): Frames {
  const frames: Frames = [];
  const O = '#3a4a5e', B = '#c9d4e4', S = '#a2b2c8', EYE = '#232e42';
  for (let f = 0; f < 4; f++) {
    const { c, x } = cv(16, 16);
    const dy = f === 1 || f === 2 ? -1 : 0;   // levitación: baja-sube en 4 fases
    const jag = f & 1;                         // fase del borde deshilachado
    // cuerpo (semivapor)
    x.globalAlpha = 0.88;
    rc(x, 4, 7 + dy, 8, 4, B);
    rc(x, 5, 11 + dy, 6, 2, B);
    rc(x, 4, 7 + dy, 1, 4, S);
    rc(x, 11, 7 + dy, 1, 4, S);
    // cabeza
    x.globalAlpha = 0.95;
    rc(x, 5, 2 + dy, 6, 5, B);
    rc(x, 4, 3 + dy, 8, 3, B);
    rc(x, 5, 6 + dy, 6, 1, S);
    // resplandor interno del pecho (le queda un resto de canto)
    x.globalAlpha = f === 2 ? 0.45 : 0.3;
    rc(x, 7, 9 + dy, 2, 2, '#e8f0ff');
    // borde difuminado: costados y rabo translúcidos
    x.globalAlpha = 0.35;
    rc(x, 3, 4 + dy, 1, 6, B);
    rc(x, 12, 4 + dy, 1, 6, B);
    rc(x, 4, 13 + dy, 8, 1, B);
    // borde deshilachado: dientes que alternan por fase
    x.globalAlpha = 0.55;
    if (jag === 0) { rc(x, 6, 13, 2, 2, S); rc(x, 9, 13, 1, 1, S); rc(x, 4, 13, 1, 1, S); }
    else { rc(x, 5, 12, 1, 2, S); rc(x, 8, 13, 2, 1, S); rc(x, 11, 12, 1, 2, S); }
    // jirones que se desprenden (varían por fase)
    x.globalAlpha = 0.4;
    if (f === 0) rc(x, 10, 14, 1, 1, S);
    else if (f === 1) rc(x, 6, 14, 1, 1, S);
    else if (f === 2) rc(x, 12, 13, 1, 1, S);
    else rc(x, 7, 14, 1, 1, S);
    // ojos huecos con halo frío de dos tonos (el halo LATE por fase)
    x.globalAlpha = f === 2 ? 0.5 : 0.32;
    rc(x, 5, 3 + dy, 3, 3, '#5a7a9c'); rc(x, 8, 3 + dy, 3, 3, '#5a7a9c');
    x.globalAlpha = 1;
    rc(x, 6, 4 + dy, 1, 2, EYE);
    rc(x, 9, 4 + dy, 1, 2, EYE);
    rc(x, 6, 4 + dy, 1, 1, '#d8e8ff'); rc(x, 9, 4 + dy, 1, 1, '#d8e8ff');
    // boca cosida en zigzag (nadie quiere que hable)
    x.globalAlpha = 0.8;
    rc(x, 7, 6 + dy, 2, 1, EYE); rc(x, 8, 7 + dy, 1, 1, EYE); rc(x, 7, 8 + dy, 1, 1, EYE);
    x.globalAlpha = 1;
    // contorno parcial (difuminado, nunca cerrado)
    x.globalAlpha = 0.38;
    rc(x, 4, 2 + dy, 8, 1, O);
    rc(x, 4, 2 + dy, 1, 4, O);
    rc(x, 11, 2 + dy, 1, 4, O);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Arpía de Cumbre (16×16 · 4 frames · R9-1) ----------------
// Ave de ventisca: aleteo de 4 fases (alzadas · bajadas · medio-alto ·
// medio-bajo; f0/f1 = ciclo antiguo). Barbas de pluma, cola con muesca,
// aliento de ventisca y contorno más agresivo para leer la silueta
// contra la nieve. Pico gris, mirada a la derecha (el render voltea).

function buildArpi(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 4; f++) {
    const { c, x } = cv(16, 16);
    const O = '#2e4256', W = '#eef6fc', WS = '#bcdcf0', WSD = '#8fb8d8', BK = '#8a94a0';
    // alas (4 fases de aleteo)
    x.globalAlpha = 1;
    x.fillStyle = WS;
    if (f === 0) {          // alzadas (igual que v2)
      rc(x, 3, 2, 3, 5, WS); rc(x, 2, 4, 2, 4, WS);
      rc(x, 10, 2, 3, 5, WS); rc(x, 12, 4, 2, 4, WS);
      rc(x, 4, 3, 1, 3, W); rc(x, 11, 3, 1, 3, W);
      rc(x, 3, 4, 1, 1, WSD); rc(x, 11, 4, 1, 1, WSD); // barbas
    } else if (f === 1) {   // bajadas (igual que v2)
      rc(x, 2, 9, 3, 5, WS); rc(x, 1, 11, 2, 3, WS);
      rc(x, 11, 9, 3, 5, WS); rc(x, 13, 11, 2, 3, WS);
      rc(x, 3, 10, 1, 3, W); rc(x, 12, 10, 1, 3, W);
      rc(x, 2, 10, 1, 1, WSD); rc(x, 12, 10, 1, 1, WSD);
    } else if (f === 2) {   // medio-alto: planeo extendido
      rc(x, 2, 4, 3, 4, WS); rc(x, 11, 4, 3, 4, WS);
      rc(x, 1, 6, 2, 2, WS); rc(x, 13, 6, 2, 2, WS);
      rc(x, 3, 5, 1, 2, W); rc(x, 12, 5, 1, 2, W);
    } else {                // medio-bajo: empuje
      rc(x, 2, 8, 3, 4, WS); rc(x, 11, 8, 3, 4, WS);
      rc(x, 1, 10, 2, 2, WS); rc(x, 13, 10, 2, 2, WS);
      rc(x, 3, 9, 1, 2, W); rc(x, 12, 9, 1, 2, W);
    }
    // cola con muesca (dos plumas)
    rc(x, 2, 8, 3, 2, WSD);
    rc(x, 1, 9, 1, 1, WSD);
    rc(x, 2, 10, 1, 1, WSD);
    // cuerpo
    rc(x, 5, 7, 6, 4, W);
    rc(x, 6, 6, 4, 6, W);
    rc(x, 5, 10, 6, 1, WS);
    rc(x, 6, 11, 4, 1, WS);
    // cabeza + pico gris
    rc(x, 9, 4, 4, 4, W);
    rc(x, 9, 7, 4, 1, WS);
    rc(x, 13, 5, 2, 2, BK);
    rc(x, 15, 6, 1, 1, BK);
    // aliento de ventisca (fases de empuje/planeo)
    if (f >= 2) {
      x.globalAlpha = 0.6;
      rc(x, 15, 5 + (f === 3 ? 1 : 0), 1, 1, '#dff2fc');
      x.globalAlpha = 1;
    }
    // ojo de ventisca: glow de dos tonos (halo hielo + núcleo claro)
    x.globalAlpha = 0.4;
    rc(x, 10, 4, 3, 3, '#6a9ac4');
    x.globalAlpha = 1;
    rc(x, 11, 5, 1, 1, '#bfe8ff');
    // contorno sutil (más agresivo: pecho y laterales, contra la nieve)
    x.globalAlpha = 0.5;
    rc(x, 5, 6, 4, 1, O);
    rc(x, 9, 4, 4, 1, O);
    rc(x, 5, 10, 6, 1, O);
    x.globalAlpha = 0.35;
    rc(x, 5, 7, 1, 3, O); rc(x, 10, 7, 1, 3, O);
    x.globalAlpha = 1;
    // pluma arrancada (la ventisca la desgarra)
    x.globalAlpha = 0.7;
    rc(x, 3, 13, 2, 1, W);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Sirena Abisal (32×32 · 3 frames · JEFA) ----------------
// TERROR V2: reina AHOGADA del naufragio. Paleta abisal desaturada
// (teal apagado + piel de ahogada verdosa) con UN acento teal vivo en
// ojos, aletas y bruma. Corona de coral retorcida y asimétrica, ojos
// de glow de dos tonos (núcleo perla + halo teal que late), dientes de
// aguja, cicatriz de ancla, cadena rota en la muñeca (la ataron a la
// quilla) y aleta caudal rasgada.

function buildSirena(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = cv(32, 32);
    const HAIR = '#1d464a', HAIR2 = '#35696a', SKIN = '#c7d2c2', SKINS = '#9caca0',
      CORAL = '#6e565c', CORALD = '#52424a', CHAIN = '#4c5862', CHAINL = '#7e8a94',
      TOP = '#2a5258', TOP2 = '#3a6e6c', FIN = '#3a6e6c', FIN2 = '#4f8a84',
      FROST = '#dfeee6', BK = '#0e2226',
      ACC = '#4fd8c8',   // ACENTO: teal abisal (ojos, bruma)
      HALO = '#2a8a84';  // halo del ojo (teal apagado, late en f1)
    const sway = f === 0 ? 0 : f === 1 ? 1 : -1; // vaivén de melena y aletas
    // ---- melena trasera: masa de agua retorcida, más larga a un lado ----
    x.globalAlpha = 0.95;
    rc(x, 9, 3, 14, 12, HAIR);
    rc(x, 8, 5 + sway, 2, 10, HAIR);           // mechón izq.
    rc(x, 22, 5 - sway, 2, 9, HAIR);           // mechón der. (más corto: asimetría)
    rc(x, 24, 8 - sway, 3, 7, HAIR2);          // masa baja que arrastra a un lado
    rc(x, 7, 9 + sway, 2, 6, HAIR2);
    rc(x, 27, 12 - sway, 1, 4, HAIR);          // mechón suelto flotando
    // puntas que ondean
    x.globalAlpha = 0.6;
    rc(x, 6, 15 + sway, 3, 3, HAIR2);
    rc(x, 23, 15 - sway, 3, 3, HAIR2);
    rc(x, 9, 16 - sway, 2, 2, HAIR2);
    rc(x, 27, 16 - sway, 2, 2, HAIR2);         // punta desprendida
    // ---- corona de coral retorcida (asimétrica: pica doblada y rota) ----
    x.globalAlpha = 1;
    rc(x, 12, 3, 9, 2, CORALD);                // base de la corona
    rc(x, 9, 2, 2, 4, CORAL);                  // pica izq. alta y delgada
    rc(x, 8, 1, 2, 2, CORAL);                  // muesca doblada hacia fuera
    rc(x, 8, 1, 1, 1, FROST);                  // punta perla
    rc(x, 14, 3, 2, 2, CORALD);                // pica central ROTA (tocón)
    rc(x, 15, 2, 1, 1, CORALD);
    rc(x, 19, 1, 2, 5, CORAL);                 // pica der. la más alta
    rc(x, 18, 0, 2, 2, CORAL);                 // codo que se dobla
    rc(x, 18, 0, 1, 1, FROST);
    // ---- rostro de ahogada ----
    rc(x, 12, 5, 8, 8, SKIN);
    rc(x, 12, 11, 8, 2, SKINS);
    rc(x, 11, 6, 1, 4, SKINS);
    rc(x, 20, 6, 1, 4, SKINS);
    // flequillo de agua partido
    rc(x, 11, 3, 10, 2, HAIR2);
    rc(x, 11, 5, 3, 2, HAIR2);
    rc(x, 18, 5, 3, 2, HAIR2);
    // ojos: cuenca hundida + glow de dos tonos (núcleo perla, halo teal)
    rc(x, 12, 7, 3, 2, BK);                    // cuenca izq. mayor (asimetría)
    x.globalAlpha = f === 1 ? 0.5 : 0.32;      // el halo LATE con el frame
    rc(x, 11, 7, 5, 3, HALO);
    x.globalAlpha = 1;
    rc(x, 13, 7, 2, 2, ACC);                   // iris teal
    rc(x, 13, 7, 1, 1, FROST);                 // núcleo perla
    rc(x, 17, 7, 2, 2, BK);                    // ojo der. hundido, menor
    rc(x, 17, 7, 1, 1, ACC);
    rc(x, 12, 6, 3, 1, SKINS);                 // párpados caídos
    rc(x, 17, 6, 2, 1, SKINS);
    // boca entreabierta: dientes de aguja (canta y devora)
    rc(x, 14, 11, 4, 1, BK);
    rc(x, 14, 11, 1, 1, FROST); rc(x, 16, 11, 1, 1, FROST);
    // cicatriz de ancla en la mejilla (historia)
    rc(x, 18, 9, 1, 3, SKINS); rc(x, 19, 10, 1, 1, SKINS);
    // ---- busto con túnica de marea ----
    rc(x, 9, 13, 14, 3, TOP);
    rc(x, 9, 13, 14, 1, '#cfe0d8');            // ribete de perla apagado
    rc(x, 12, 16, 8, 4, SKIN);
    rc(x, 12, 16, 8, 1, SKINS);
    // collar de perlas rotas (faltan cuentas)
    rc(x, 12, 16, 1, 1, FROST); rc(x, 15, 17, 1, 1, FROST);
    rc(x, 18, 17, 1, 1, FROST);
    // brazos + garras de perla
    rc(x, 7, 14, 2, 6, SKIN); rc(x, 7, 14, 1, 6, SKINS);
    rc(x, 6, 19, 1, 2, FROST);                 // garra
    rc(x, 23, 14, 2, 6, SKIN); rc(x, 24, 14, 1, 6, SKINS);
    rc(x, 25, 19, 1, 2, FROST);
    // cadena rota en la muñeca der. (la ataron a la quilla del naufragio)
    rc(x, 23, 17, 2, 1, CHAIN);
    rc(x, 25, 18, 1, 1, CHAINL);               // eslabón suelto que cuelga
    // ---- cola escarchada ----
    rc(x, 10, 19, 12, 3, TOP);
    rc(x, 11, 22, 10, 2, TOP);
    rc(x, 12, 24, 8, 2, TOP2);
    rc(x, 13, 26, 6, 2, FIN);
    // aleta dorsal desgarrada (asimétrica)
    rc(x, 15, 19, 1, 3, FIN2); rc(x, 16, 19, 1, 1, FIN2);
    // escamas de brillo
    x.globalAlpha = 0.7;
    rc(x, 12 + sway, 20, 2, 1, TOP2);
    rc(x, 17 - sway, 23, 2, 1, FROST);
    rc(x, 14, 25, 1, 2, FROST);
    x.globalAlpha = 1;
    // aletas caudales RASGADAS (frost tips) — se mecen con el frame
    const fs = sway;
    rc(x, 11 + fs, 27, 4, 2, FIN); rc(x, 9 + fs, 28, 4, 2, FIN2);
    rc(x, 7 + fs, 29, 4, 2, FIN); rc(x, 5 + fs, 30, 3, 1, FROST);  // rasgada
    rc(x, 17 - fs, 27, 4, 2, FIN); rc(x, 19 - fs, 28, 4, 2, FIN2);
    rc(x, 21 - fs, 29, 4, 2, FIN); rc(x, 24 - fs, 30, 3, 2, FROST);
    // ---- R9-1 · crin de espuma (la marea la peina; se mece con el frame) ----
    x.globalAlpha = 0.85;
    rc(x, 10 + sway, 4, 3, 1, FROST);          // mechón de espuma sobre la frente
    rc(x, 9 + sway, 6, 2, 1, FROST);
    rc(x, 21 - sway, 5, 2, 1, FROST);
    rc(x, 22 - sway, 7, 1, 2, '#eef8f0');      // rizo que cae
    x.globalAlpha = 0.5;
    rc(x, 8 + sway, 8, 2, 1, FROST);           // espuma enredada en la melena
    rc(x, 23 - sway, 6, 2, 1, FROST);
    rc(x, 12 + sway, 2, 2, 1, FROST);          // burbuja de la corona
    x.globalAlpha = 1;
    // fotóforos: el acento enciende la cola (late con el frame)
    x.globalAlpha = f === 1 ? 0.9 : 0.55;
    rc(x, 11, 21, 1, 1, ACC);
    rc(x, 19, 22, 1, 1, ACC);
    rc(x, 14, 25, 1, 1, ACC);
    x.globalAlpha = 1;
    // ---- R9-1 · borde de silueta (contraste contra fondos claros) ----
    x.globalAlpha = 0.45;
    rc(x, 9, 3, 14, 1, BK);                    // techo de la melena
    rc(x, 9, 4, 1, 9, BK);                     // costado izq.
    rc(x, 10, 19, 12, 1, BK);                  // cintura de la cola
    x.globalAlpha = 1;
    // aura de bruma abisal (acento, muy tenue)
    x.globalAlpha = 0.14;
    rc(x, 4, 10 + sway, 2, 9, ACC);
    rc(x, 26, 10 - sway, 2, 8, ACC);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Gólem de Escarcha (32×32 · 2 frames · JEFE) ----------------
// TERROR V2: columna de hielo encadenada a la cumbre. Paleta de
// hielo desaturada (azul grisáceo) con UN acento cian que respira en
// núcleo, grietas y ojos. Asta de hielo retorcida en el hombro izq.,
// cadena rota helada cruzando el vientre, fragmento incrustado en el
// hombro y grieta que le parte la cara. F1 = windup: brazo alzado.

function buildGolem(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(32, 32);
    const O = '#141f30', ICE = '#8ba6bc', ICED = '#68829a', ICEDD = '#54708a',
      L = '#a9c2d4', XT = '#c8dce8', SNOW = '#e6eef2', DK = '#39516a',
      CHAIN = '#3c4a5c', CHAINL = '#6c7e92',
      ACC = '#7ce8ff',   // ACENTO: cian hielo (núcleo, grietas, ojos)
      ACCD = '#2e7a96';
    const up = f; // f1: el brazo izq. se alza 1 px (windup del slam)
    const CORE = f === 0 ? '#2f8aa8' : '#4fc0e0';
    const CORE2 = f === 0 ? '#8ee4f4' : '#d8f8ff';
    // ---- torso macizo ----
    rc(x, 8, 10, 16, 15, ICE);
    rc(x, 8, 10, 16, 2, L);
    rc(x, 9, 24, 14, 2, ICED);
    // placas
    rc(x, 8, 14, 16, 1, ICED);
    rc(x, 8, 19, 16, 1, ICED);
    // grietas del torso que dejan escapar el acento (el núcleo respira)
    x.globalAlpha = f === 1 ? 0.9 : 0.55;
    rc(x, 10, 15, 1, 4, ACC);
    rc(x, 21, 11, 1, 3, ACC);
    rc(x, 17, 20, 1, 3, ACC);
    rc(x, 22, 21, 1, 2, ACCD);
    x.globalAlpha = 1;
    // ---- núcleo brillante ----
    if (f === 1) disc(x, 15.5, 17.5, 5.5, CORE2, 0.22); // pulso
    rc(x, 12, 14, 8, 7, '#1e5e78');
    rc(x, 13, 15, 6, 5, CORE);
    rc(x, 14, 16, 4, 3, CORE2);
    // ---- cadena rota helada cruzando el vientre (lo ataron a la cumbre) ----
    rc(x, 9, 21, 2, 1, CHAIN); rc(x, 11, 22, 2, 1, CHAIN);
    rc(x, 13, 23, 2, 1, CHAIN);
    rc(x, 17, 23, 2, 1, CHAIN); rc(x, 19, 22, 2, 1, CHAIN);
    rc(x, 21, 21, 2, 1, CHAIN); rc(x, 23, 20, 2, 1, CHAIN);
    rc(x, 25, 21, 1, 2, CHAINL);               // eslabón roto que cuelga
    rc(x, 24, 23, 1, 1, CHAIN);
    // ---- cabeza hundida con la cara partida ----
    rc(x, 12, 3, 8, 7, ICE);
    rc(x, 12, 3, 8, 1, L);
    rc(x, 12, 9, 8, 1, ICED);
    // ojos: glow de dos tonos (núcleo blanco, halo cian que late)
    x.globalAlpha = 0.4;
    rc(x, 12, 5, 4, 3, ACCD); rc(x, 16, 5, 4, 3, ACCD);
    if (f === 1) { x.globalAlpha = 0.25; rc(x, 11, 4, 11, 5, ACC); }
    x.globalAlpha = 1;
    rc(x, 13, 6, 2, 1, ACC); rc(x, 17, 6, 2, 1, ACC);      // iris cian
    rc(x, 13, 6, 1, 1, SNOW); rc(x, 17, 6, 1, 1, SNOW);    // núcleo blanco
    // grieta que le cruza la cara (cicatriz del primer deshielo)
    rc(x, 14, 3, 1, 2, DK); rc(x, 15, 5, 1, 2, DK); rc(x, 16, 7, 1, 1, DK);
    // ---- hombros asimétricos: asta de hielo retorcida (izq.) ----
    rc(x, 2, 8, 9, 7, ICED);
    rc(x, 2, 8, 9, 1, L);
    rc(x, 4, 4, 3, 4, XT);                     // asta: tramo bajo
    rc(x, 3, 2, 2, 2, XT);                     // asta: codo que gira
    rc(x, 6, 3, 1, 2, ICED);                   // muesca del giro
    rc(x, 3, 2, 1, 1, SNOW);                   // punta nevada
    // hombro der.: cristales rotos, sin punta
    rc(x, 21, 8, 9, 7, ICED);
    rc(x, 21, 8, 9, 1, L);
    rc(x, 24, 5, 4, 3, XT); rc(x, 25, 4, 2, 1, XT);
    // fragmento de la cadena incrustado en el hombro (historia)
    rc(x, 27, 10, 2, 2, CHAIN); rc(x, 27, 10, 1, 1, CHAINL);
    // nieve posada
    rc(x, 3, 8, 4, 1, SNOW); rc(x, 25, 8, 4, 1, SNOW);
    // ---- brazos colosales (el izq. se alza en f1: va a golpear) ----
    rc(x, 1, 12 - up, 5, 12, ICED);
    rc(x, 1, 12 - up, 1, 12, L);
    rc(x, 0, 23 - up, 7, 5, ICEDD);
    rc(x, 0, 23 - up, 7, 1, L);
    rc(x, 0, 22 - up, 1, 1, XT); rc(x, 3, 22 - up, 1, 1, XT); // garras del puño
    rc(x, 26, 12, 5, 12, ICED);
    rc(x, 30, 12, 1, 12, DK);
    rc(x, 25, 23, 7, 5, ICEDD);
    rc(x, 25, 23, 7, 1, L);
    // ---- pata de bloque y escarcha base ----
    rc(x, 9, 25, 6, 4, ICEDD);
    rc(x, 17, 25, 6, 4, ICEDD);
    rc(x, 9, 28, 6, 1, DK); rc(x, 17, 28, 6, 1, DK);
    rc(x, 8, 29, 8, 1, SNOW); rc(x, 16, 29, 8, 1, SNOW);
    // ---- R9-1 · musgo helado (lo último que la cumbre le canta) ----
    x.globalAlpha = 0.8;
    rc(x, 6, 9, 3, 1, '#5e7a62'); rc(x, 7, 10, 2, 1, '#54705a');   // hombro izq.
    rc(x, 26, 9, 2, 2, '#54705a');                                  // hombro der.
    rc(x, 10, 26, 2, 1, '#5e7a62');                                 // rodilla
    x.globalAlpha = 1;
    // carámbanos que cuelgan del puño izq. (gotean con el deshielo)
    rc(x, 1, 28 - up, 1, 3, XT);
    rc(x, 4, 28 - up, 1, 2, XT);
    // chispas de escarcha (deterministas)
    x.globalAlpha = 0.8;
    rc(x, 11, 11, 1, 1, SNOW); rc(x, 22, 17, 1, 1, SNOW); rc(x, 6, 16, 1, 1, SNOW);
    x.globalAlpha = 1;
    // contorno exterior mínimo
    x.globalAlpha = 0.55;
    rc(x, 0, 28, 7, 1, O); rc(x, 25, 28, 7, 1, O);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ============================================================
// PROYECTILES (1 frame · los anima drawExpansionProjectile)
// ============================================================

function buildOrb(): Frames {
  const { c, x } = cv(12, 12);
  disc(x, 6, 6, 5, '#2e78b8', 0.9);   // borde de agua profunda
  disc(x, 6, 6, 4.1, '#58a8e0', 0.82);
  disc(x, 6, 6, 2.6, '#9ad0f0', 0.8);
  x.globalAlpha = 1;
  rc(x, 4, 3, 2, 2, '#f4fbff');       // brillo
  rc(x, 8, 9, 1, 1, '#2e78b8');
  return [c];
}

function buildShard(): Frames {
  const { c, x } = cv(12, 12);
  // rombo afilado vertical
  const rows: [number, number, number][] = [
    // [y, x0, ancho]
    [0, 5, 2], [1, 4, 4], [2, 4, 4], [3, 3, 6], [4, 3, 6],
    [5, 2, 8], [6, 2, 8], [7, 3, 6], [8, 3, 6], [9, 4, 4], [10, 4, 4], [11, 5, 2],
  ];
  for (const [y, x0, w] of rows) {
    rc(x, x0, y, w, 1, w <= 2 ? '#dff4fc' : '#9fd4ec');
    if (w >= 6) { rc(x, x0, y, 1, 1, '#5aa8cc'); rc(x, x0 + w - 1, y, 1, 1, '#5aa8cc'); }
  }
  rc(x, 5, 2, 1, 6, '#eaf8ff');       // filo de luz
  rc(x, 6, 3, 1, 3, '#ffffff');
  return [c];
}

function buildNota(): Frames {
  const { c, x } = cv(12, 12);
  // halo + corchea pixelada blanco-azulada
  disc(x, 6, 6, 5, '#bfe0ff', 0.25);
  x.globalAlpha = 1;
  rc(x, 3, 8, 3, 2, '#e8f4ff');       // cabeza de la nota
  rc(x, 3, 9, 3, 1, '#9fc8e8');
  rc(x, 6, 2, 1, 7, '#e8f4ff');       // mástil
  rc(x, 7, 2, 2, 1, '#e8f4ff');       // banderín (corchea)
  rc(x, 8, 3, 1, 2, '#cfe6fa');
  rc(x, 9, 5, 1, 1, '#cfe6fa');
  rc(x, 10, 1, 1, 1, '#ffffff');      // destello
  x.globalAlpha = 1;
  return [c];
}

// ---------------- registro ----------------

export function initExpansionSprites(): void {
  initTileContext(); // R9-1: hornea vecinos de los mapas de expansión (autotiling de tiles)
  registerSpr('neumo', buildNeumo());
  registerSpr('espectro', buildEspectro());
  registerSpr('arpi', buildArpi());
  registerSpr('sirena', buildSirena());
  registerSpr('golem', buildGolem());
  registerSpr('orb', buildOrb());
  registerSpr('shard', buildShard());
  registerSpr('nota', buildNota());
  // 14-a (jefes-enemigos): 2 jefes nuevos + 2 enemigos de mapa
  registerSpr('vult', buildVult());
  registerSpr('coro1', buildCoro(1));
  registerSpr('coro2', buildCoro(2));
  registerSpr('coro3', buildCoro(3));
  registerSpr('ecodesg', buildEcodesg());
  registerSpr('satiro', buildSatiro());
}

// ============================================================
// TILES DE SUELO (Acto II)
// El motor llama a drawTile() al pre-renderizar el suelo; el
// integrador debe probar PRIMERO esta función y caer al dibujo
// genérico si devuelve false:
//   if (drawExpansionTile(x, ch, tx, ty, this.mapId)) continue;
//   drawTile(x, ch, tx, ty, this.mapId, 0);
// ============================================================

// ---------------- helpers de tiles v4 (R9-1) ----------------

/** Banda de gradación con borde interior irregular (determinista).
 *  dir: 0=N · 1=E · 2=S · 3=W — crece desde ese borde hacia dentro. */
function bandaHumeda(
  x: CanvasRenderingContext2D, px0: number, py0: number,
  dir: number, prof: number, col: string, tx: number, ty: number,
): void {
  x.fillStyle = col;
  for (let k = 0; k < prof; k++) {
    for (let i = 0; i < 16; i++) {
      // el borde interior de la banda se disuelve con huecos por hash
      if (k === prof - 1 && hash2(tx * 29 + i, ty * 31 + k * 7 + dir * 13) < 0.45) continue;
      if (dir === 0) x.fillRect(px0 + i, py0 + k, 1, 1);
      else if (dir === 1) x.fillRect(px0 + 15 - k, py0 + i, 1, 1);
      else if (dir === 2) x.fillRect(px0 + i, py0 + 15 - k, 1, 1);
      else x.fillRect(px0 + k, py0 + i, 1, 1);
    }
  }
}

/** Espuma de ola pegada al borde del agua (línea irregular + lavado interior).
 *  mask = bits N,E,S,W con agua vecina (contexto prehorneado). */
function bordeEspuma(
  x: CanvasRenderingContext2D, px0: number, py0: number, mask: number, tx: number, ty: number,
): void {
  const C1 = '#eef7f2', C2 = '#d8ece6';
  for (let d = 0; d < 4; d++) {
    if (!(mask & (1 << d))) continue;
    for (let i = 0; i < 16; i++) {
      const h = hash2(tx * 37 + i * 3 + d * 11, ty * 41 + i * 7 + d);
      if (h < 0.18) continue;                    // hueco del borde irregular
      const me = h > 0.85 ? 1 : 0;               // meandro hacia dentro
      if (d === 0) { rc(x, px0 + i, py0 + me, 1, 1, C1); if (h > 0.6) rc(x, px0 + i, py0 + 1 + me, 1, 1, C2); }
      else if (d === 2) { rc(x, px0 + i, py0 + 15 - me, 1, 1, C1); if (h > 0.6) rc(x, px0 + i, py0 + 14 - me, 1, 1, C2); }
      else if (d === 1) { rc(x, px0 + 15 - me, py0 + i, 1, 1, C1); if (h > 0.6) rc(x, px0 + 14 - me, py0 + i, 1, 1, C2); }
      else { rc(x, px0 + me, py0 + i, 1, 1, C1); if (h > 0.6) rc(x, px0 + 1 + me, py0 + i, 1, 1, C2); }
    }
  }
}

/** Adoquinado de Merrow v4: dos hiladas de piedras redondeadas con
 *  junta de tierra, tono/volumen por piedra, huecos de tierra y hierba
 *  entre adoquines. mode 0 = plaza ':' · mode 1 = camino '=' desgastado. */
function adoquinado(
  x: CanvasRenderingContext2D, px0: number, py0: number, tx: number, ty: number,
  r: number, r2: number, r3: number, hierba: number, wet: boolean, mode: number,
): void {
  rc(x, px0, py0, 16, 16, mode === 1 ? '#4e4840' : r < 0.5 ? '#3e3e4a' : '#3a3a46');
  const jY = mode === 1 ? 6 + Math.floor(r * 4) : 6 + Math.floor(r * 3);
  for (let half = 0; half < 2; half++) {
    const y0 = half === 0 ? 0 : jY + 1;
    const y1 = half === 0 ? jY : 15;
    const hh = y1 - y0 + 1;
    let cxr = 0;
    let idx = 0;
    while (cxr < 16) {
      let cw = (mode === 1 ? 6 : 4) + Math.floor(hash2(tx * 7 + half * 13 + idx, ty * 17 + idx * 5) * 4);
      if (cxr + cw > 16) cw = 16 - cxr;        // la última piedra llega al borde
      const tone = hash2(tx * 3 + idx * 11 + half, ty * 23 + half * 7 + idx);
      const base = mode === 1
        ? (tone < 0.4 ? '#6e6a60' : tone < 0.75 ? '#67635a' : '#716d62')
        : (tone < 0.3 ? '#5e5e6c' : tone < 0.62 ? '#585864' : tone < 0.85 ? '#61616d' : '#52525e');
      rc(x, px0 + cxr, py0 + y0, cw, hh, base);
      // volumen: canto iluminado arriba + sombra abajo
      rc(x, px0 + cxr, py0 + y0, cw, 1, tone < 0.5 ? '#6c6c78' : '#67676f');
      rc(x, px0 + cxr, py0 + y1, cw, 1, mode === 1 ? '#46423a' : '#40404c');
      if (cw > 3) rc(x, px0 + cxr + cw - 1, py0 + y0 + 1, 1, hh - 1, mode === 1 ? '#4a463e' : '#444450');
      // hueco de tierra ocasional dentro de la piedra
      if (hash2(tx * 31 + idx, ty * 29 + half) > (mode === 1 ? 0.88 : 0.8)) {
        rc(x, px0 + cxr + 1 + Math.floor(tone * Math.max(1, cw - 3)),
          py0 + y0 + 1 + Math.floor(hash2(tx + idx, ty + half) * Math.max(1, hh - 3)),
          2, 1, mode === 1 ? '#5a4f3e' : '#56504a');
      }
      cxr += cw + 1; // junta de tierra entre piedras
      idx++;
    }
  }
  // grieta vieja cruzando (solo plaza, herencia v2)
  if (mode === 0 && r2 > 0.7) {
    rc(x, px0 + 3 + Math.floor(r * 6), py0 + 3, 1, 5, '#34343e');
    rc(x, px0 + 4 + Math.floor(r * 6), py0 + 7, 2, 1, '#34343e');
  }
  // hierba entre adoquines (más densa junto a hierba vecina)
  const gP = hierba !== 0 ? 0.55 : 0.22;
  for (let i = 0; i < 3; i++) {
    const gh = hash2(tx * 13 + i * 5, ty * 7 + i * 3);
    if (gh < gP) {
      const gx = px0 + 1 + Math.floor(hash2(tx + i * 7, ty * 3 + i) * 14);
      const gy = py0 + Math.floor(hash2(tx * 5 + i, ty + i * 11) * 14);
      x.fillStyle = i % 2 === 0 ? '#5f7d46' : '#4c6a3c';
      x.fillRect(gx, gy, 1, 2);
    }
  }
  // laguna cercana: losa mojada + charco con reflejo
  if (wet && r3 > 0.35) {
    const pw = 4 + Math.floor(r * 6);
    const qx = px0 + 2 + Math.floor(r2 * 6), qy = py0 + 3 + Math.floor(r * 7);
    rc(x, qx, qy, pw, 2, '#3a5a74');
    rc(x, qx + 1, qy, Math.max(1, pw - 3), 1, '#7a98a8');
  }
}


// ============================================================
// R17 · TEXTURA CONTINUA para los suelos lisos de la expansión.
// La nieve de las Cumbres y la hierba de la Costa eran un relleno plano
// por tile (2 tonos alternos → cuadrícula visible y superficies sin
// vida). Ruido de valor bilineal en coordenadas GLOBALES de píxel (sin
// costuras entre tiles) + bandas de ventisquero que siguen el viento.
// Pintado por tramos horizontales del mismo tono (pocas llamadas).
// ============================================================
function vnE(vx: number, vy: number, L: number, seed: number): number {
  const gx = Math.floor(vx / L), gy = Math.floor(vy / L);
  const fx = vx / L - gx, fy = vy / L - gy;
  const a = hash2(gx + seed, gy + seed * 2) * 2, b = hash2(gx + 1 + seed, gy + seed * 2) * 2;
  const c = hash2(gx + seed, gy + 1 + seed * 2) * 2, d = hash2(gx + 1 + seed, gy + 1 + seed * 2) * 2;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function pintaRuns(x: CanvasRenderingContext2D, X0: number, Y0: number, tono: (vx: number, vy: number) => string): void {
  for (let j = 0; j < 16; j++) {
    let ini = 0, cur = '';
    for (let i = 0; i <= 16; i++) {
      const t = i < 16 ? tono(X0 + i, Y0 + j) : '';
      if (t !== cur) { if (i > ini) { x.fillStyle = cur; x.fillRect(X0 + ini, Y0 + j, i - ini, 1); } ini = i; cur = t; }
    }
  }
}
const NIEVE_TONOS = ['#cfdbe8', '#d9e3ee', '#e2e9f2', '#eaeff6', '#f1f4f9', '#f7f9fc'];
function tonoNieve(vx: number, vy: number): string {
  // ventisquero: bandas onduladas a lo largo del viento (NO-SE) + ruido
  const drift = Math.sin((vx * 0.85 + vy * 0.45) / 9 + vnE(vx, vy, 28, 5) * 5) * 0.5 + 0.5;
  const n = 0.45 * vnE(vx, vy, 14, 11) + 0.2 * vnE(vx, vy, 5, 23) + 0.35 * drift;
  let k = (n - 0.25) / 0.6;
  if (k < 0) k = 0; else if (k > 0.999) k = 0.999;
  return NIEVE_TONOS[(k * NIEVE_TONOS.length) | 0];
}
const ARENA_TONOS = ['#cbb17c', '#d2b984', '#d9c08c', '#dfc794', '#e5ce9c'];
function tonoArena(vx: number, vy: number): string {
  // ondas de arena que el viento deja (rizaduras) + ruido suave
  const rip = Math.sin((vx * 0.3 + vy) / 3.2 + vnE(vx, vy, 20, 61) * 3) * 0.5 + 0.5;
  const n = 0.55 * vnE(vx, vy, 11, 53) + 0.2 * vnE(vx, vy, 4, 71) + 0.25 * rip;
  let k = (n - 0.25) / 0.55;
  if (k < 0) k = 0; else if (k > 0.999) k = 0.999;
  return ARENA_TONOS[(k * ARENA_TONOS.length) | 0];
}
const PRADO_SAL = ['#6a874a', '#728f4e', '#7b9854', '#84a159', '#8daa5f', '#97b366'];
function tonoPradoSal(vx: number, vy: number): string {
  const n = 0.6 * vnE(vx, vy, 9, 31) + 0.4 * vnE(vx, vy, 4, 43);
  let k = (n - 0.2) / 0.6;
  if (k < 0) k = 0; else if (k > 0.999) k = 0.999;
  return PRADO_SAL[(k * PRADO_SAL.length) | 0];
}

export function drawExpansionTile(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number, mapId: string,
): boolean {
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx, ty);
  const r2 = hash2(tx * 7 + 3, ty * 11 + 5);
  const r3 = hash2(tx * 13 + 1, ty * 3 + 7);
  switch (ch) {
    case 's': { // —— COSTA · arena v4: gradación húmeda + espuma + tesoros de marea
      const a1 = nbBits(CX_COSTA_AGUA, tx, ty, 0);
      const a2 = nbBits(CX_COSTA_AGUA, tx, ty, 4);
      // base seca + moteado
      pintaRuns(x, px0, py0, tonoArena); // R17: arena continua con rizaduras
      for (let i = 0; i < 6; i++) {
        const hx = hash2(tx * 5 + i * 3, ty * 7 + i);
        const hy = hash2(tx * 11 + i, ty * 5 + i * 7);
        if (hx < 0.55) {
          x.fillStyle = i % 2 === 0 ? '#c9b077' : '#e6d2a2';
          x.fillRect(px0 + Math.floor(hx * 30) % 15, py0 + Math.floor(hy * 30) % 15, 1, 1);
        }
      }
      // gradación de arena húmeda hacia el agua (2 anillos, borde difuminado)
      for (let d = 0; d < 4; d++) {
        const bit = 1 << d;
        if (a2 & bit) bandaHumeda(x, px0, py0, d, 2, '#c7ab72', tx, ty);
        if (a1 & bit) {
          bandaHumeda(x, px0, py0, d, 4, '#b39868', tx, ty);
          bandaHumeda(x, px0, py0, d, 2, '#9c8153', tx, ty);
        }
      }
      // espuma de ola en el borde (línea irregular + lavado interior)
      if (a1) bordeEspuma(x, px0, py0, a1, tx, ty);
      // tesoros de la marea: glena · concha abanico · cinta de alga
      const ox = px0 + 3 + Math.floor(r * 8), oy2 = py0 + 3 + Math.floor(r3 * 8);
      if (r2 > 0.92) {                            // glena (caracola espiral)
        rc(x, ox, oy2, 2, 2, '#e2d2b6'); rc(x, ox + 2, oy2 + 1, 1, 1, '#e2d2b6');
        rc(x, ox, oy2, 1, 1, '#f4ead8'); rc(x, ox + 1, oy2 + 1, 1, 1, '#a88c64');
      } else if (r2 > 0.84) {                     // concha abanico
        rc(x, ox, oy2, 2, 1, '#f0e8d4');
        rc(x, ox, oy2 + 1, 1, 1, '#dccdb0'); rc(x, ox + 1, oy2 + 1, 1, 1, '#c9b894');
      } else if (r2 > 0.78) {                     // cinta de alga seca
        rc(x, ox, oy2, 3, 1, '#8aa878'); rc(x, ox + 2, oy2 + 1, 1, 1, '#6e8c5c');
      }
      return true;
    }
    case 'S': { // —— CUMBRES · nieve v4: ventisqueros + destellos fríos + orilla del lago
      const hielo = mapId === 'cumbres' ? nbBits(CX_CUMBRES_HIELO, tx, ty, 0) : 0;
      // R17: nieve continua (ruido global + ventisqueros) en vez de relleno plano
      pintaRuns(x, px0, py0, tonoNieve);
      // huellas de liebre/zorro que cruzan varios tiles (fila determinista)
      if (hash2(Math.floor(tx / 3) * 13, ty * 7) < 0.12) {
        for (let k = 0; k < 4; k++) {
          const fx = px0 + k * 4 + (k % 2), fy = py0 + 7 + ((k % 2) ? 2 : 0) + Math.floor(hash2(tx, ty) * 3);
          rc(x, fx, fy, 1, 1, '#b8c6d6'); rc(x, fx + 1, fy + 1, 1, 1, '#c6d2e0');
        }
      }
      // piedra o mata de hierba seca asomando entre la nieve (rara)
      if (r3 > 0.93) {
        const ox = px0 + 3 + Math.floor(r * 9), oy = py0 + 4 + Math.floor(r2 * 8);
        rc(x, ox, oy, 3, 2, '#7d8594'); rc(x, ox, oy, 2, 1, '#9aa2b0'); rc(x, ox - 1, oy + 2, 5, 1, '#c3cfdc');
      } else if (r3 > 0.86) {
        const ox = px0 + 4 + Math.floor(r * 8), oy = py0 + 5 + Math.floor(r2 * 7);
        rc(x, ox, oy, 1, 3, '#a89a6e'); rc(x, ox + 2, oy + 1, 1, 2, '#9a8c62'); rc(x, ox + 1, oy - 1, 1, 3, '#b8aa7e');
      }
      // ventisqueros: bandas de sombra suave (deterministas)
      const nB = r2 > 0.55 ? 2 : 1;
      for (let i = 0; i < nB; i++) {
        const by = py0 + 2 + Math.floor(hash2(tx * 7 + i, ty * 11 + i) * 11);
        const bx = px0 + Math.floor(hash2(tx * 3 + i * 5, ty * 13 + i) * 6);
        x.globalAlpha = 0.5;
        rc(x, bx, by, 6 + Math.floor(hash2(tx + i, ty * 5 + i) * 6), 1, '#d2dce8');
        rc(x, bx + 1, by + 1, 4, 1, '#dbe4ee');
        x.globalAlpha = 1;
      }
      // destellos fríos: mota blanca + glint cian en cruz (raro)
      const n = r2 > 0.4 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const hx2 = hash2(tx * 3 + i * 11, ty * 9 + i * 5);
        const hy2 = hash2(tx * 17 + i, ty * 13 + i * 3);
        const sxp = px0 + 1 + Math.floor(hx2 * 14), syp = py0 + 1 + Math.floor(hy2 * 14);
        rc(x, sxp, syp, 1, 1, '#ffffff');
        if (hash2(tx + i * 3, ty + i * 7) > 0.85) {
          rc(x, sxp - 1, syp, 1, 1, '#bfe4ff'); rc(x, sxp + 1, syp, 1, 1, '#bfe4ff');
          rc(x, sxp, syp - 1, 1, 1, '#bfe4ff'); rc(x, sxp, syp + 1, 1, 1, '#bfe4ff');
        }
      }
      // orilla del lago: costra helada compactada hacia el hielo
      if (hielo) {
        x.globalAlpha = 0.8;
        for (let d = 0; d < 4; d++) {
          if (!(hielo & (1 << d))) continue;
          for (let i = 0; i < 16; i++) {
            if (hash2(tx * 7 + i, ty * 3 + d * 5) < 0.25) continue;
            if (d === 0) rc(x, px0 + i, py0, 1, 1, '#d6e8f2');
            else if (d === 2) rc(x, px0 + i, py0 + 15, 1, 1, '#d6e8f2');
            else if (d === 1) rc(x, px0 + 15, py0 + i, 1, 1, '#d6e8f2');
            else rc(x, px0, py0 + i, 1, 1, '#d6e8f2');
          }
        }
        x.globalAlpha = 1;
      }
      if (r3 > 0.72) rc(x, px0 + 4 + Math.floor(r * 8), py0 + 9, 3, 1, '#d2dde9');
      return true;
    }
    case 'i': { // —— CUMBRES · lago v4: SEMITRANSPARENTO (agua pintada bajo la escarcha)
      const hielo = mapId === 'cumbres' ? nbBits(CX_CUMBRES_HIELO, tx, ty, 0) : 0;
      // agua profunda bajo el hielo (la transparencia se pinta, no se alpha)
      rc(x, px0, py0, 16, 16, '#2e6d92');
      // los coros ahogados: siluetas hundidas (historia del lago)
      if (r2 > 0.55) {
        x.globalAlpha = 0.65;
        const fx = px0 + 2 + Math.floor(r * 7), fy = py0 + 3 + Math.floor(r3 * 7);
        rc(x, fx, fy, 2, 3, '#17405c'); rc(x, fx + 2, fy + 1, 1, 2, '#17405c');
        x.globalAlpha = 1;
      }
      // profundidades: mancha oscura
      x.globalAlpha = 0.45;
      rc(x, px0 + Math.floor(r3 * 10), py0 + Math.floor(r * 10), 5, 2, '#25587a');
      x.globalAlpha = 1;
      // capa de escarcha (el "cristal" semitransparente del lago)
      x.globalAlpha = 0.78;
      rc(x, px0, py0, 16, 16, '#b8dcee');
      x.globalAlpha = 0.5;
      rc(x, px0 + 1 + Math.floor(r * 6), py0 + 1 + Math.floor(r2 * 6), 7, 5, '#cbe6f4');
      x.globalAlpha = 1;
      // brillo diagonal del hielo
      x.globalAlpha = 0.25;
      const dx0 = px0 + 2 + Math.floor(r2 * 4);
      rc(x, dx0, py0, 3, 16, '#eaf7ff');
      rc(x, dx0 + 3, py0, 1, 16, '#dcf2fc');
      x.globalAlpha = 1;
      // grietas deterministas con núcleo claro
      if (r2 > 0.3) {
        const gx = px0 + 2 + Math.floor(r * 5), gy = py0 + 2 + Math.floor(r3 * 9);
        rc(x, gx, gy, 5, 1, '#8fbcd8');
        rc(x, gx + 1, gy, 3, 1, '#eaf8ff');
        rc(x, gx + 4, gy + 1, 1, 3, '#8fbcd8');
        rc(x, gx + 4, gy + 1, 1, 1, '#eaf8ff');
        rc(x, gx + 2, gy - 1, 2, 1, '#8fbcd8');            // ramita
        if (r3 > 0.5) { rc(x, gx + 6, gy + 2, 4, 1, '#8fbcd8'); rc(x, gx + 6, gy + 2, 2, 1, '#eaf8ff'); }
      }
      // orilla: rim pálido donde NO hay hielo vecino (borde irregular)
      const rim = (~hielo) & 15;
      if (rim) {
        x.globalAlpha = 0.8;
        for (let d = 0; d < 4; d++) {
          if (!(rim & (1 << d))) continue;
          for (let i = 0; i < 16; i++) {
            if (hash2(tx * 11 + i, ty * 7 + d * 9) < 0.3) continue;   // orilla irregular
            if (d === 0) rc(x, px0 + i, py0, 1, 1, '#dceefa');
            else if (d === 2) rc(x, px0 + i, py0 + 15, 1, 1, '#dceefa');
            else if (d === 1) rc(x, px0 + 15, py0 + i, 1, 1, '#dceefa');
            else rc(x, px0, py0 + i, 1, 1, '#dceefa');
          }
        }
        x.globalAlpha = 1;
      }
      return true;
    }
    case '.': {
      if (mapId === 'aldea') { // —— MERROW · hierba reclamando el pueblo (R9-1)
        // R16: la hierba ya no es un CUADRADO liso sobre el empedrado (se leía
        // como baldosas verdes sueltas): empedrado de base y encima una mancha
        // de hierba que se deshilacha en el borde (dither por hash) y se
        // extiende hacia los vecinos que también son hierba (parches que se
        // funden entre sí).
        const gb = nbBits(CX_ALDEA_HIERBA, tx, ty, 0);
        adoquinado(x, px0, py0, tx, ty, r, r2, r3, gb, nbBits(CX_ALDEA_AGUA, tx, ty, 0) !== 0, 0);
        for (let j = 0; j < 16; j++) {
          for (let i = 0; i < 16; i++) {
            let dx = i - 7.5, dy = j - 7.5;
            if ((dx < 0 && gb & NB_W) || (dx > 0 && gb & NB_E)) dx *= 0.2;
            if ((dy < 0 && gb & NB_N) || (dy > 0 && gb & NB_S)) dy *= 0.2;
            const w = 1.2 - Math.sqrt(dx * dx + dy * dy) / 8.5;
            if (w <= 0) continue;
            const hh = hash2(tx * 16 + i * 7 + 3, ty * 16 + j * 13 + 1) * 2;
            if (hh < w) {
              x.fillStyle = hash2(tx * 31 + i, ty * 17 + j) < 0.25 ? '#72824f' : hh < w * 0.5 ? '#7a8a58' : '#76864f';
              x.fillRect(px0 + i, py0 + j, 1, 1);
            }
          }
        }
        // parche de tierra desnuda
        x.globalAlpha = 0.6;
        rc(x, px0 + 4 + Math.floor(r2 * 5), py0 + 5 + Math.floor(r3 * 5), 4, 2, '#6a5c40');
        x.globalAlpha = 1;
        // mechones cortos
        for (let i = 0; i < 4; i++) {
          const hx = hash2(tx * 4 + i, ty * 9 + i);
          if (hx < 0.5) {
            rc(x, px0 + Math.floor(hx * 14), py0 + Math.floor(hash2(tx + i, ty * 3 + i) * 13), 1, 2,
              i % 2 === 0 ? '#8ea066' : '#64744a');
          }
        }
        // adoquines sueltos heredados del empedrado
        if (r2 > 0.55) rc(x, px0 + 2 + Math.floor(r * 9), py0 + 3 + Math.floor(r3 * 9), 3, 2, '#5e5e6c');
        if (r3 > 0.7) rc(x, px0 + 9 - Math.floor(r * 5), py0 + 11, 2, 1, '#52525e');
        // flor del festival que sobrevive (rara)
        if (r3 > 0.9) {
          rc(x, px0 + 5 + Math.floor(r * 6), py0 + 4 + Math.floor(r2 * 6), 1, 1, '#e878a0');
          rc(x, px0 + 5 + Math.floor(r * 6), py0 + 5 + Math.floor(r2 * 6), 1, 1, '#4c6a3c');
        }
        return true;
      }
      if (mapId === 'costa') { // hierba salada + arena/agua cercanas (R9-1)
        const a1 = nbBits(CX_COSTA_AGUA, tx, ty, 0);
        const s1 = nbBits(CX_COSTA_ARENA, tx, ty, 0);
        // R17: prado salino continuo (ruido global) en vez de verde liso
        pintaRuns(x, px0, py0, tonoPradoSal);
        // matas de juncia que el viento del mar peina hacia tierra
        for (let i = 0; i < 3; i++) {
          const hx = hash2(tx * 9 + i * 5, ty * 3 + i);
          if (hx < 0.55) {
            const mx = px0 + 1 + Math.floor(hx * 26) % 13, my = py0 + 3 + Math.floor(hash2(tx + i * 3, ty * 11 + i) * 11);
            rc(x, mx, my, 1, 3, '#5e7a40'); rc(x, mx + 1, my - 1, 1, 3, '#a2bc6c'); rc(x, mx + 2, my, 1, 2, '#6e8a48');
          }
        }
        for (let i = 0; i < 5; i++) {
          const hx = hash2(tx * 4 + i, ty * 9 + i);
          if (hx < 0.45) {
            rc(x, px0 + Math.floor(hx * 14), py0 + Math.floor(hash2(tx + i, ty * 3 + i) * 14), 1, 2,
              i % 2 === 0 ? '#a8c070' : '#6e8c4c');
          }
        }
        // arena invadiendo el borde (dunas incipientes, sesgo hacia la arena)
        if (s1) {
          for (let i = 0; i < 6; i++) {
            const hx2 = hash2(tx * 29 + i, ty * 31 + i * 3);
            if (hx2 < 0.5) {
              let sxp = px0 + (Math.floor(hx2 * 30) % 15);
              let syp = py0 + Math.floor(hash2(tx * 37 + i * 5, ty * 41 + i) * 14);
              if (s1 & NB_N) syp = py0 + Math.floor(hash2(tx + i, ty) * 3);
              else if (s1 & NB_S) syp = py0 + 13 + Math.floor(hash2(tx + i, ty) * 3);
              if (s1 & NB_W) sxp = px0 + Math.floor(hx2 * 6);
              else if (s1 & NB_E) sxp = px0 + 13 + Math.floor(hx2 * 6);
              x.fillStyle = i % 2 === 0 ? '#c9b478' : '#bda66c';
              x.fillRect(sxp, syp, 1, 1);
            }
          }
        }
        // hierba ahogada por la salpicadura (banda oscura hacia el agua)
        if (a1) {
          for (let d = 0; d < 4; d++) {
            if (a1 & (1 << d)) bandaHumeda(x, px0, py0, d, 2, '#66804e', tx, ty);
          }
        }
        if (r2 > 0.8) rc(x, px0 + 6, py0 + 8, 2, 1, '#c8b878'); // brizna seca
        return true;
      }
      if (mapId === 'cumbres') { // nieve corta verdosa (v2 + brizna extra)
        rc(x, px0, py0, 16, 16, r < 0.5 ? '#a8c098' : '#9cb48c');
        for (let i = 0; i < 4; i++) {
          const hx = hash2(tx * 6 + i, ty * 5 + i * 3);
          if (hx < 0.4) {
            rc(x, px0 + Math.floor(hx * 14), py0 + Math.floor(hash2(tx + i * 5, ty + i) * 14), 1, 1,
              i % 2 === 0 ? '#c4d8b4' : '#8aa07c');
          }
        }
        if (r2 > 0.62) rc(x, px0 + 3 + Math.floor(r * 8), py0 + 4 + Math.floor(r3 * 8), 2, 1, '#eef4f0');
        if (r3 > 0.8) rc(x, px0 + 10 - Math.floor(r * 6), py0 + 12, 1, 2, '#8aa07c');
        return true;
      }
      return false; // lunaris/bosque: dibujo genérico del motor
    }
    case ',': {
      if (mapId === 'costa') { // flores de sal (v2)
        pintaRuns(x, px0, py0, tonoPradoSal); // R17: mismo prado continuo
        // matas de sal cristalizada
        const bx = px0 + 3 + Math.floor(r * 7), by = py0 + 3 + Math.floor(r2 * 7);
        rc(x, bx, by, 2, 2, '#f0f4f0');
        rc(x, bx + 1, by - 1, 1, 1, '#ffffff');
        rc(x, bx - 1, by + 1, 1, 1, '#d8e8e0');
        if (r3 > 0.5) {
          const cx2 = px0 + 9 - Math.floor(r * 5), cy2 = py0 + 9 - Math.floor(r2 * 5);
          rc(x, cx2, cy2, 2, 1, '#e4efe6');
          rc(x, cx2, cy2 + 1, 1, 1, '#c8dcd4');
        }
        return true;
      }
      if (mapId === 'aldea') { // —— MERROW pasado · pétalos del Festival del Nombre (R9-1)
        adoquinado(x, px0, py0, tx, ty, r, r2, r3,
          nbBits(CX_ALDEA_HIERBA, tx, ty, 0), nbBits(CX_ALDEA_AGUA, tx, ty, 0) !== 0, 0);
        // pétalos caídos de las guirnaldas
        for (let i = 0; i < 4; i++) {
          const ph = hash2(tx * 19 + i, ty * 3 + i * 7);
          if (ph > 0.35) {
            rc(x, px0 + 1 + Math.floor(hash2(tx + i, ty * 5 + i) * 14),
              py0 + 1 + Math.floor(hash2(tx * 7 + i, ty + i) * 14), 1, 1, PETALS[i % 3]);
          }
        }
        // guirnalda caída: hilillo verde con un lazo
        if (r2 > 0.6) {
          rc(x, px0 + 3 + Math.floor(r * 6), py0 + 5, 4, 1, '#4c6a3c');
          rc(x, px0 + 4 + Math.floor(r * 6), py0 + 6, 1, 1, '#e878a0');
        }
        return true;
      }
      if (mapId === 'cumbres') { // —— CUMBRES pasado · flores abrigadas junto a la hoguera (R9-1)
        pintaRuns(x, px0, py0, tonoNieve); // R17: misma nieve continua
        if (r2 > 0.3) rc(x, px0 + 3 + Math.floor(r * 8), py0 + 10, 5, 1, '#d2dce8'); // ventisquero
        // matas de flores que aguantan el frío (2-3)
        for (let i = 0; i < 3; i++) {
          const fh = hash2(tx * 7 + i * 3, ty * 11 + i);
          if (fh > 0.4) {
            const fx2 = px0 + 2 + Math.floor(hash2(tx + i * 5, ty + i) * 12);
            const fy2 = py0 + 3 + Math.floor(hash2(tx * 3 + i, ty * 7 + i) * 10);
            rc(x, fx2, fy2 + 1, 1, 2, '#4c6a3c');                       // tallito
            rc(x, fx2, fy2, 1, 1, i % 2 === 0 ? '#b48ae8' : '#f0f0f0'); // corola
          }
        }
        return true;
      }
      return false;
    }
    case ':': {
      if (mapId === 'aldea') { // —— MERROW · empedrado v4 (huecos, hierba, laguna cercana)
        adoquinado(x, px0, py0, tx, ty, r, r2, r3,
          nbBits(CX_ALDEA_HIERBA, tx, ty, 0), nbBits(CX_ALDEA_AGUA, tx, ty, 0) !== 0, 0);
        return true;
      }
      return false; // cripta/lunaris: dibujo genérico
    }
    case '=': {
      if (mapId === 'costa') { // —— COSTA · sendero de arena pisada (R9-1)
        rc(x, px0, py0, 16, 16, r < 0.5 ? '#c8ae7a' : '#c0a670');
        rc(x, px0, py0, 16, 1, '#d4bc8c');
        // rodadas y huellas (dashes deterministas)
        for (let i = 0; i < 5; i++) {
          const hx = hash2(tx * 13 + i, ty * 5 + i * 3);
          if (hx < 0.5) {
            rc(x, px0 + Math.floor(hx * 12), py0 + 2 + Math.floor(hash2(tx + i * 7, ty + i) * 12),
              2 + Math.floor(hx * 3), 1, '#aa9060');
          }
        }
        if (r2 > 0.7) rc(x, px0 + 4 + Math.floor(r * 8), py0 + 6 + Math.floor(r3 * 6), 2, 1, '#9a8860'); // piedrecilla
        if (r3 > 0.8) rc(x, px0 + 9 - Math.floor(r * 5), py0 + 11, 2, 1, '#e8dcc0'); // concha triturada
        // rociado de arena viva en los bordes
        for (let i = 0; i < 4; i++) {
          if (hash2(tx * 3 + i, ty * 9 + i) > 0.55) {
            rc(x, px0 + Math.floor(hash2(tx + i, ty * 7 + i) * 15), py0 + (i % 2 === 0 ? 1 : 14), 1, 1, '#dcc590');
          }
        }
        return true;
      }
      if (mapId === 'aldea') { // —— MERROW · camino empedrado desgastado (R9-1)
        adoquinado(x, px0, py0, tx, ty, r, r2, r3,
          nbBits(CX_ALDEA_HIERBA, tx, ty, 0), nbBits(CX_ALDEA_AGUA, tx, ty, 0) !== 0, 1);
        return true;
      }
      if (mapId === 'cumbres') { // camino pisado moreno + ventisca (v2 + nieve R9-1)
        rc(x, px0, py0, 16, 16, r < 0.5 ? '#8a7048' : '#7c6440');
        rc(x, px0, py0, 16, 1, '#9a8056');
        for (let i = 0; i < 5; i++) {
          const hx = hash2(tx * 13 + i, ty * 5 + i * 3);
          if (hx < 0.4) {
            rc(x, px0 + Math.floor(hx * 13), py0 + Math.floor(hash2(tx + i * 7, ty + i) * 13), 2, 1, '#6a5436');
          }
        }
        if (r2 > 0.75) rc(x, px0 + 5 + Math.floor(r * 6), py0 + 6, 2, 1, '#a8906a'); // piedrecilla
        // ventisca: nieve acumulada en los cantos + rociada
        for (let i = 0; i < 3; i++) {
          if (hash2(tx * 5 + i * 3, ty * 13 + i) > 0.45) {
            rc(x, px0 + 1 + Math.floor(hash2(tx + i, ty * 7 + i) * 14), py0 + (i === 0 ? 1 : 13 + (i & 1)), 2, 1, '#e6ecf2');
          }
        }
        if (r3 > 0.3) rc(x, px0 + 3 + Math.floor(r2 * 9), py0 + 5 + Math.floor(r * 6), 1, 1, '#dfe7ef');
        return true;
      }
      return false; // lunaris: dibujo genérico
    }
    default:
      return false;
  }
}

// ============================================================
// OBJETOS ALTOS (se dibujan por fila sobre el suelo, igual que
// drawTallTile del motor). Devuelve true si dibujó el tile.
// ============================================================

export function drawExpansionTallTile(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number, mapId: string,
): boolean {
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx * 3 + 1, ty * 5 + 7);
  const r2 = hash2(tx * 11 + 9, ty * 7 + 3);

  if (ch === 'p' && mapId === 'costa') {
    // ---- PALMERA: tronco curvado + hojas ----
    const bend = r > 0.5 ? 1 : -1; // curva determinista por tile
    // tronco (segmentos que se curvan)
    const seg = [
      [7, 13, 2], [7, 11, 2], [8, 9, 2], [8 + bend, 7, 2], [8 + bend, 5, 2], [9 + bend, 3, 2],
    ] as [number, number, number][];
    for (let i = 0; i < seg.length; i++) {
      const [sx, sy, sw] = seg[i];
      rc(x, px0 + sx + (bend > 0 ? 0 : 0), py0 + sy, sw, 2, i % 2 === 0 ? '#8a6a3e' : '#6d5430');
    }
    // anillos del tronco
    rc(x, px0 + 7, py0 + 12, 2, 1, '#5c462a');
    rc(x, px0 + 8 + bend, py0 + 8, 2, 1, '#5c462a');
    const crownX = px0 + 9 + bend, crownY = py0 + 2;
    // hojas (palmas) — 5 frondas
    rc(x, crownX - 6, crownY + 1, 7, 2, '#3e8a4a');   // izquierda
    rc(x, crownX - 7, crownY + 2, 4, 2, '#2e6a38');
    rc(x, crownX + 1, crownY + 1, 7, 2, '#3e8a4a');   // derecha
    rc(x, crownX + 5, crownY + 2, 4, 2, '#2e6a38');
    rc(x, crownX - 2, crownY - 2, 5, 2, '#5aa858');   // arriba
    rc(x, crownX - 1, crownY - 3, 3, 1, '#5aa858');
    rc(x, crownX - 5, crownY + 3, 3, 1, '#5aa858');   // caídas
    rc(x, crownX + 3, crownY + 3, 3, 1, '#5aa858');
    if (r2 > 0.55) rc(x, crownX - 8, crownY + 3, 2, 1, '#2e6a38'); // fronda extra
    // cocos
    rc(x, crownX - 2, crownY + 3, 2, 2, '#6d4520');
    rc(x, crownX + 1, crownY + 4, 2, 2, '#6d4520');
    return true;
  }

  if ((ch === 't' || ch === 'p') && mapId === 'cumbres') {
    // ---- PINO NEVADO: verde oscuro con capa blanca ----
    // tronco
    rc(x, px0 + 7, py0 + 12, 2, 4, '#54381e');
    rc(x, px0 + 7, py0 + 15, 2, 1, '#3e2a16');
    // tres pisos de copa, cada uno con gorro de nieve
    const layers: [number, number, number][] = [
      // [x0, y0, ancho]
      [3, 7, 10], [4, 4, 8], [5, 1, 6],
    ];
    for (let i = 0; i < layers.length; i++) {
      const [lx, ly, lw] = layers[i];
      const deep = i % 2 === 0 ? '#1e4a34' : '#21503a';
      rc(x, px0 + lx, py0 + ly, lw, 4, deep);
      rc(x, px0 + lx + 1, py0 + ly + 1, lw - 3, 1, '#2e5e42'); // brillo interior
      // capa de nieve
      const snowW = r2 > 0.5 ? lw : lw - 2;
      rc(x, px0 + lx, py0 + ly, snowW, 1, '#e8f0f4');
      rc(x, px0 + lx + 2, py0 + ly + 1, Math.max(1, snowW - 5), 1, '#d4e4ea');
    }
    // copa encendida
    rc(x, px0 + 7, py0 - 1, 2, 2, '#e8f0f4');
    if (r > 0.7) rc(x, px0 + 5, py0 + 3, 2, 1, '#f4fafc');
    return true;
  }

  return false;
}

// ============================================================
// PROPS DE LA EXPANSIÓN (dibujados a pantalla, centrados en
// (cx, cy) = coordenadas de pantalla del centro del prop — el
// motor pasará sx(px), sy(py) como hace drawProps()).
// ============================================================

/** R9-1 · Variante determinista de prop a partir de una semilla estable
 *  (hash de coords del mapa). seed=0 → variante 0 (base). */
function varianteProp(seed: number, n: number): number {
  if (!seed) return 0;
  return Math.floor(hash2(seed * 7 + 1, seed * 13 + 3) * n) % n;
}

// Paletas constantes de props/tiles (fuera de las rutas de draw: cero
// allocations por frame — el farol y los pétalos se pintan cada frame).
const GARLAND_COLS = ['#e878a0', '#f0d060', '#7ea8e0'];
const PETALS = ['#e878a0', '#f0d060', '#f0f0f0'];

export function drawExpansionProp(
  ctx: CanvasRenderingContext2D, kind: string, cx: number, cy: number,
  zoom: number, t: number, lit: boolean, seed = 0,
): void {
  const Z = zoom;
  const V = varianteProp(seed, 4); // 4 variantes por prop (0 = base)
  switch (kind) {
    case 'wreck': {
      // ---- casco de nave naufragada (~40×24) · 3 variantes (V%3) ----
      const V3 = V % 3;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.16);
      // sombra
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 11 * Z, 22 * Z, 4 * Z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // casco: franjas apiladas (quilla arriba, panza abajo)
      for (let i = 0; i < 5; i++) {
        const w = (17 - i * 2.4) * Z;
        ctx.fillStyle = i % 2 === 0 ? '#6d4a2a' : '#54381e';
        ctx.fillRect(-w, (6 - i * 4) * Z, w * 2, 4 * Z);
      }
      // cuadernas (costillas internas) asomando — la herida del casco (R9-1)
      ctx.fillStyle = '#3a2812';
      for (let i = 0; i < 4; i++) ctx.fillRect((-8 + i * 4) * Z, -2 * Z, 1.2 * Z, 4 * Z);
      // línea de quilla en sombra (contraste)
      ctx.fillStyle = 'rgba(20,14,8,0.45)';
      ctx.fillRect(-17 * Z, 6 * Z, 34 * Z, 1 * Z);
      // borde superior desbordado (cubierta rota)
      ctx.fillStyle = '#8a6438';
      ctx.fillRect(-14 * Z, -12 * Z, 10 * Z, 2 * Z);
      ctx.fillStyle = '#54381e';
      ctx.fillRect(2 * Z, -11 * Z, 7 * Z, 2 * Z);
      // tablón suelto
      ctx.fillStyle = '#7d5630';
      ctx.fillRect(-4 * Z, -9 * Z, 9 * Z, 1.5 * Z);
      // musgo + liquen
      ctx.fillStyle = '#4a7a3e';
      ctx.fillRect(-9 * Z, -6 * Z, 5 * Z, 2 * Z);
      ctx.fillRect(6 * Z, 1 * Z, 4 * Z, 2 * Z);
      ctx.fillStyle = '#5e8a4a';
      ctx.fillRect(-8 * Z, -6 * Z, 2 * Z, 1 * Z);
      // mástil roto
      ctx.fillStyle = '#54381e';
      ctx.fillRect(6 * Z, -26 * Z, 2.4 * Z, 22 * Z);
      ctx.fillStyle = '#3e2a16';
      ctx.fillRect(7.4 * Z, -26 * Z, 1 * Z, 22 * Z);
      // variante 1: percebes en la línea de flotación + red de cuerda rota
      if (V3 === 1) {
        ctx.fillStyle = '#cfc8b4';
        for (let i = 0; i < 7; i++) {
          const bx = (-14 + ((i * 37) % 28)) * Z;
          ctx.fillRect(bx, (2 + (i % 3)) * Z, 1.6 * Z, 1.6 * Z);
        }
        ctx.strokeStyle = '#8f7147';
        ctx.lineWidth = Math.max(1, Z * 0.8);
        ctx.beginPath();
        ctx.moveTo(-12 * Z, -10 * Z);
        ctx.quadraticCurveTo(-14 * Z, -2 * Z, (-10 + Math.sin(t * 1.1) * 1.2) * Z, 6 * Z);
        ctx.moveTo(-8 * Z, -11 * Z);
        ctx.lineTo((-9 + Math.sin(t * 1.3) * 1.5) * Z, 3 * Z);
        ctx.stroke();
      }
      // variante 2: cargamento derramado (barril rodado + odre roto)
      if (V3 === 2) {
        ctx.fillStyle = '#7a5c3a';
        ctx.fillRect(16 * Z, 2 * Z, 5 * Z, 4 * Z);
        ctx.fillStyle = '#54381e';
        ctx.fillRect(16 * Z, 3 * Z, 5 * Z, 1 * Z);
        ctx.fillRect(16 * Z, 5 * Z, 5 * Z, 1 * Z);
        ctx.fillStyle = '#6a4e30';
        ctx.fillRect(-20 * Z, 3 * Z, 4 * Z, 3 * Z);
        ctx.fillStyle = '#3e2a16';
        ctx.fillRect(-19 * Z, 6 * Z, 2 * Z, 1 * Z);
      }
      // vela desgarrada ondeando con sin(t)
      const wav = Math.sin(t * 1.7) * 3;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#cfc8b4';
      ctx.beginPath();
      ctx.moveTo(8.6 * Z, -25 * Z);
      ctx.quadraticCurveTo((26 + wav) * Z, (-20 + wav * 0.6) * Z, (22 + wav) * Z, (-5 + wav) * Z);
      ctx.lineTo(15 * Z, (-9 + wav * 0.4) * Z);
      ctx.lineTo(10.5 * Z, (-15 + wav * 0.2) * Z);
      ctx.closePath();
      ctx.fill();
      // jirones (desgarrada)
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#a89f8a';
      ctx.fillRect((17 + wav * 0.5) * Z, (-13 + wav) * Z, 4 * Z, 2 * Z);
      ctx.fillRect(11 * Z, -19 * Z, 3 * Z, 2 * Z);
      // algas colgando de la cubierta (se mecen, R9-1)
      ctx.fillStyle = '#3e6e3a';
      ctx.fillRect(-11 * Z, (-10 + Math.sin(t * 1.4) * 0.6) * Z, 1 * Z, 3 * Z);
      ctx.fillRect(3 * Z, (-9 + Math.sin(t * 1.7 + 1) * 0.6) * Z, 1 * Z, 2 * Z);
      // espuma lamiendo la base (determinista con t)
      ctx.globalAlpha = 0.5 + Math.sin(t * 2.2) * 0.15;
      ctx.fillStyle = '#e8f2ec';
      ctx.fillRect(-16 * Z, 9 * Z, 8 * Z, 1 * Z);
      ctx.fillRect(4 * Z, 10 * Z, 12 * Z, 1 * Z);
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }
    case 'faro': {
      // ---- faro en ruinas (~20×48) · 3 variantes (V%3) ----
      const V3 = V % 3;
      // 8 segmentos de 6 px → 48 px de alto, se estrecha hacia arriba
      for (let i = 0; i < 8; i++) {
        const yTop = cy + (14 - i * 6) * Z - 6 * Z;
        const halfW = (10 - i * 0.5) * Z;
        ctx.fillStyle = i % 2 === 0 ? '#c8c2b4' : '#9a5a4a';
        ctx.fillRect(cx - halfW, yTop, halfW * 2, 6 * Z + 0.6);
        // sillares: juntas horizontales + luz rasante en el canto izq. (R9-1)
        ctx.fillStyle = 'rgba(40,36,30,0.28)';
        for (let j = 1; j <= 2; j++) ctx.fillRect(cx - halfW, yTop + j * 2 * Z, halfW * 2, Math.max(1, Z * 0.5));
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(cx - halfW, yTop, Math.max(1, Z), 6 * Z);
      }
      // manchas de sal (goteo del mar, deterministas)
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#f4f8f4';
      ctx.fillRect(cx - 5 * Z, cy - 16 * Z, 1.4 * Z, 12 * Z);
      ctx.fillRect(cx + 3 * Z, cy - 6 * Z, 1.2 * Z, 9 * Z);
      ctx.globalAlpha = 1;
      // piedras caídas / ruina
      ctx.fillStyle = '#8a8478';
      ctx.fillRect(cx - 11 * Z, cy + 8 * Z, 3 * Z, 2 * Z);
      ctx.fillRect(cx + 7 * Z, cy + 2 * Z, 4 * Z, 2 * Z);
      // grieta
      ctx.fillStyle = 'rgba(40,36,30,0.5)';
      ctx.fillRect(cx - 2 * Z, cy - 10 * Z, 1.2 * Z, 10 * Z);
      ctx.fillRect(cx - 1 * Z, cy - 2 * Z, 1.2 * Z, 6 * Z);
      // variante 1: puerta con dintel + escalón (R9-1)
      if (V3 === 1) {
        ctx.fillStyle = '#241a12';
        ctx.fillRect(cx - 2.5 * Z, cy + 6 * Z, 5 * Z, 6 * Z);
        ctx.fillStyle = '#3a2c1c';
        ctx.fillRect(cx - 2.5 * Z, cy + 6 * Z, 5 * Z, 1 * Z);
        ctx.fillStyle = '#8a8478';
        ctx.fillRect(cx - 4 * Z, cy + 12 * Z, 8 * Z, 1.6 * Z);
      }
      // variante 2: grieta mayor con musgo + nido en la cornisa (R9-1)
      if (V3 === 2) {
        ctx.fillStyle = 'rgba(40,36,30,0.5)';
        ctx.fillRect(cx + 4 * Z, cy - 2 * Z, 1.2 * Z, 14 * Z);
        ctx.fillRect(cx + 3 * Z, cy + 4 * Z, 1.2 * Z, 4 * Z);
        ctx.fillStyle = '#4d6a44';
        ctx.fillRect(cx + 3 * Z, cy + 8 * Z, 2 * Z, 1.4 * Z);
        ctx.fillRect(cx - 7 * Z, cy - 2 * Z, 2.4 * Z, 1.4 * Z);
        ctx.fillStyle = '#8a7248';
        ctx.fillRect(cx - 8 * Z, cy - 30 * Z, 3 * Z, 1.2 * Z);   // nido de pajitas
        ctx.fillRect(cx - 7 * Z, cy - 29 * Z, 2 * Z, 0.8 * Z);
      }
      // linterna
      const gy = cy - 34 * Z;
      ctx.fillStyle = '#3a3e48';
      ctx.fillRect(cx - 6 * Z, gy, 12 * Z, 8 * Z);
      if (lit) {
        // luz superior que pulsa con sin(t*2.4)
        const pulse = 0.55 + Math.sin(t * 2.4) * 0.45;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ffe9a0';
        ctx.fillRect(cx - 4 * Z, gy + 2 * Z, 8 * Z, 4 * Z);
        ctx.globalAlpha = 0.25 + pulse * 0.3;
        ctx.fillStyle = '#ffe9a0';
        ctx.beginPath();
        ctx.arc(cx, gy + 4 * Z, 10 * Z, 0, Math.PI * 2);
        ctx.fill();
        // haz cónico semitransparente rotando lento
        ctx.globalAlpha = 0.12;
        ctx.save();
        ctx.translate(cx, gy + 4 * Z);
        ctx.rotate(t * 0.35);
        ctx.fillStyle = '#fff3c8';
        const L = 64 * Z;
        ctx.beginPath();
        ctx.moveTo(0, -3 * Z); ctx.lineTo(L, -12 * Z); ctx.lineTo(L, 12 * Z); ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -3 * Z); ctx.lineTo(-L, -12 * Z); ctx.lineTo(-L, 12 * Z); ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        // ventana oscura
        ctx.fillStyle = '#1c2028';
        ctx.fillRect(cx - 4 * Z, gy + 2 * Z, 8 * Z, 4 * Z);
      }
      // cúpula rota
      ctx.fillStyle = '#6a6458';
      ctx.fillRect(cx - 6 * Z, gy - 3 * Z, 5 * Z, 3 * Z);
      ctx.fillRect(cx + 1 * Z, gy - 2 * Z, 5 * Z, 2 * Z);
      break;
    }
    case 'lamp': {
      // ---- farol de pie (~10×18) · 4 variantes: 0 base · 1 inclinado ·
      //      2 guirnalda del festival · 3 cruzeta con cristal fisurado ----
      ctx.save();
      if (V === 1) { // poste inclinado por el viento de sal
        ctx.translate(cx, cy + 8 * Z);
        ctx.rotate(0.06);
        ctx.translate(-cx, -(cy + 8 * Z));
      }
      // peana de adoquines + poste
      ctx.fillStyle = '#4a4a54';
      ctx.fillRect(cx - 4.5 * Z, cy + 7 * Z, 9 * Z, 1.6 * Z);
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(cx - 3 * Z, cy + 6 * Z, 6 * Z, 2 * Z);
      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(cx - 1 * Z, cy - 8 * Z, 2 * Z, 15 * Z);
      ctx.fillStyle = '#4a4a56';
      ctx.fillRect(cx - 1 * Z, cy - 8 * Z, 0.8 * Z, 15 * Z);    // brillo del poste
      if (V === 3) { ctx.fillStyle = '#3a3a44'; ctx.fillRect(cx - 6 * Z, cy - 9 * Z, 12 * Z, 1.4 * Z); } // cruzeta
      // caja del farol
      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(cx - 3.5 * Z, cy - 16 * Z, 7 * Z, 9 * Z);
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(cx - 4.5 * Z, cy - 18 * Z, 9 * Z, 2.5 * Z);
      // montante central de la vitrina (2 panes, R9-1)
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(cx - 0.5 * Z, cy - 15.5 * Z, 1 * Z, 8 * Z);
      if (lit) {
        // llama cálida parpadeante + halo dorado
        const fl = 0.7 + Math.sin(t * 9) * 0.2 + Math.sin(t * 23.7) * 0.1;
        ctx.globalAlpha = 0.22 + fl * 0.18;
        ctx.fillStyle = '#ffd88a';
        ctx.beginPath();
        ctx.arc(cx, cy - 11.5 * Z, 10 * Z, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.7 + fl * 0.3;        // (R9-1: sin string rgba por frame)
        ctx.fillStyle = '#ffd88a';
        ctx.fillRect(cx - 2.5 * Z, cy - 14.5 * Z, 5 * Z, 6 * Z);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(cx - 1 * Z, cy - 13 * Z, 2 * Z, 3 * Z);
        // polillas al amor de la llama (2 motas orbitando, deterministas)
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#e8e2c8';
        ctx.fillRect(cx + Math.sin(t * 3.1) * 6 * Z, cy - 12 * Z + Math.cos(t * 4.3) * 3 * Z, 1.2 * Z, 1.2 * Z);
        ctx.fillRect(cx + Math.sin(t * 2.3 + 2.4) * 7 * Z, cy - 11 * Z + Math.cos(t * 3.7 + 1.2) * 4 * Z, 1 * Z, 1 * Z);
        ctx.globalAlpha = 1;
      } else {
        // cristal apagado gris
        ctx.fillStyle = '#8a8f98';
        ctx.fillRect(cx - 2.5 * Z, cy - 14.5 * Z, 5 * Z, 6 * Z);
        ctx.fillStyle = '#6a6f78';
        ctx.fillRect(cx - 1 * Z, cy - 12 * Z, 2 * Z, 3 * Z);
      }
      // variante 2: guirnalda del festival atada a una estaca (R9-1)
      if (V === 2) {
        const swg = Math.sin(t * 1.8) * 0.6 * Z;
        ctx.strokeStyle = '#6a5a48';
        ctx.lineWidth = Math.max(1, Z * 0.6);
        ctx.beginPath();
        ctx.moveTo(cx + 1 * Z, cy - 9 * Z);
        ctx.quadraticCurveTo(cx + 6 * Z, cy - 4 * Z + swg, cx + 10 * Z, cy - 1 * Z);
        ctx.stroke();
        ctx.fillStyle = '#5a4026';
        ctx.fillRect(cx + 9.5 * Z, cy - 1 * Z, 1.4 * Z, 4 * Z);  // estaca
        for (let i = 0; i < 3; i++) {
          const fx = (2.5 + i * 2.8) * Z;
          const fy = (-8 + swg * 0.5 - i * 1.1) * Z;
          ctx.fillStyle = GARLAND_COLS[i];
          ctx.beginPath();
          ctx.moveTo(cx + fx, cy + fy);
          ctx.lineTo(cx + fx + 2 * Z, cy + fy);
          ctx.lineTo(cx + fx + 1 * Z, cy + fy + 2.2 * Z);
          ctx.closePath();
          ctx.fill();
        }
      }
      // variante 3: cristal fisurado (el viento de la Niebla lo marcó)
      if (V === 3) {
        ctx.strokeStyle = 'rgba(30,30,38,0.6)';
        ctx.lineWidth = Math.max(1, Z * 0.5);
        ctx.beginPath();
        ctx.moveTo(cx - 2 * Z, cy - 15 * Z);
        ctx.lineTo(cx - 0.5 * Z, cy - 12 * Z);
        ctx.lineTo(cx - 2 * Z, cy - 10 * Z);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    default:
      break; // prop no gestionado: el motor usa su dibujo propio
  }
}

// ============================================================
// PROYECTILES DE LA EXPANSIÓN (a pantalla, centro x,y)
// El integrador lo llamará desde el bucle de proyectiles del
// render antes del fallback genérico. Devuelve true si dibujó.
// ============================================================

/** Corchea pixelada reutilizable (nota musical). */
function notaGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
  const u = s / 6;
  ctx.fillStyle = col;
  // cabeza
  ctx.fillRect(x - 1.6 * u, y + 1.2 * u, 2.6 * u, 1.8 * u);
  // mástil
  ctx.fillRect(x + 0.4 * u, y - 2.6 * u, 0.8 * u, 4.2 * u);
  // banderín
  ctx.fillRect(x + 1.2 * u, y - 2.6 * u, 0.8 * u, 1.6 * u);
  ctx.fillRect(x + 2 * u, y - 1.6 * u, 0.6 * u, 1.2 * u);
}

export function drawExpansionProjectile(
  ctx: CanvasRenderingContext2D, sprite: string, x: number, y: number,
  r: number, zoom: number, t: number,
): boolean {
  switch (sprite) {
    case 'orb': {
      // esfera de agua con highlight y ondulación
      const wob = 1 + Math.sin(t * 6) * 0.12;
      const R = Math.max(3, r) * zoom * wob;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#2e78b8';
      ctx.beginPath(); ctx.arc(x, y, R + 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#58a8e0';
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#9ad0f0';
      ctx.beginPath(); ctx.arc(x - R * 0.2, y - R * 0.25, R * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f4fbff';
      ctx.fillRect(x - R * 0.45, y - R * 0.55, Math.max(1.5, R * 0.35), Math.max(1.5, R * 0.35));
      return true;
    }
    case 'shard': {
      // cristal de hielo afilado girando lento
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 3);
      const s = Math.max(3, r + 1) * zoom;
      ctx.fillStyle = '#5aa8cc';
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.55, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.55, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9fd4ec';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8); ctx.lineTo(s * 0.3, 0); ctx.lineTo(0, s * 0.8); ctx.lineTo(-s * 0.3, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#eaf8ff';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.45); ctx.lineTo(s * 0.12, 0); ctx.lineTo(0, s * 0.45); ctx.lineTo(-s * 0.12, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      return true;
    }
    case 'nota': {
      // nota musical luminosa con estela parpadeante
      const bob = Math.sin(t * 4) * 1.5;
      const pulse = 0.7 + Math.sin(t * 8) * 0.3;
      const s = Math.max(3, r + 1) * zoom;
      ctx.globalAlpha = 0.22 * pulse;
      ctx.fillStyle = '#bfe0ff';
      ctx.beginPath(); ctx.arc(x, y + bob, s * 1.6, 0, Math.PI * 2); ctx.fill();
      for (let i = 1; i <= 2; i++) {
        ctx.globalAlpha = (0.3 / i) * pulse;
        notaGlyph(ctx, x - i * 2, y + bob - i * 3, s * (1 - i * 0.18), '#9fc8e8');
      }
      ctx.globalAlpha = 1;
      notaGlyph(ctx, x, y + bob, s, '#f2f9ff');
      return true;
    }
    default:
      return false; // no gestionado: fallback del motor
  }
}

// ============================================================
// 14-a (AGENTE JEFES-ENEMIGOS) — sprites de los 2 jefes nuevos
// (Vult, El Coro Roto) y los 2 enemigos de mapa (Eco Desgarrado,
// Sátiro de la Niebla). APPEND puro: lo de arriba queda intacto y
// el registro vive en initExpansionSprites (al final del bloque de
// registro, marcado con 14-a).
// ============================================================

// ---------------- Vult, el Cazador de Ecos (32×32 · 3 frames · JEFE) ----
// TERROR V2: cazador encorvado de gabardina verde BILIS desaturada.
// Ojos de glow de dos tonos (núcleo célere + halo oliva), capucha
// rasgada con cicatriz, daga mellada, costura de remiendo en la
// gabardina, cinturón con eslabón roto y pañuelo que se deshilacha.

function buildVult(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = cv(32, 32);
    const CAP = '#2c3a2e', CAP2 = '#3d5040', CAPD = '#1c281e',
      SKIN = '#c8cec0', SKINS = '#a2ac9c', SCARF = '#8ea834',
      DGA = '#dce8dc', DGAD = '#9cb4a0', BOOT = '#1a241a',
      BK = '#0e1610',
      ACC = '#b8e83c',   // ACENTO: verde bilis (ojos, brillo de filos)
      HALO = '#5e7c1e';  // halo del ojo (oliva, late en f1)
    const sway = f === 0 ? 0 : f === 1 ? 1 : -1; // capa y pañuelo
    // ---- capa trasera desgarrada (ondea opuesta al avance) ----
    x.globalAlpha = 0.95;
    rc(x, 7 - sway, 8, 7, 14, CAPD);
    rc(x, 5 - sway, 10, 3, 10, CAPD);
    rc(x, 8 - sway, 22, 3, 2, CAPD);           // jirón inferior suelto
    x.globalAlpha = 0.55;
    rc(x, 4 - sway, 14 + sway, 3, 6, CAP);     // ala baja de la capa
    x.globalAlpha = 1;
    // ---- pañuelo de eco hilachas (se mecen con el frame) ----
    rc(x, 16 + sway, 7, 6, 2, SCARF);
    rc(x, 21 + sway * 2, 6, 4, 2, SCARF);
    x.globalAlpha = 0.6;
    rc(x, 24 + sway * 2, 5, 3, 2, SCARF);      // punta que se disuelve
    rc(x, 25 + sway * 2, 8, 2, 1, SCARF);      // hilacho suelto
    x.globalAlpha = 1;
    // ---- torso y gabardina con costura de remiendo ----
    rc(x, 12, 10, 9, 10, CAP);
    rc(x, 12, 10, 9, 1, CAP2);
    rc(x, 13, 12, 1, 7, CAP2);                 // solapa
    rc(x, 19, 11, 1, 8, CAPD);
    rc(x, 12, 19, 10, 4, CAPD);                // faldón
    // costura del remiendo (lo cose con hilo de eco)
    rc(x, 14, 15, 5, 1, CAP2);
    rc(x, 14, 15, 1, 1, SKINS); rc(x, 16, 15, 1, 1, SKINS); rc(x, 18, 15, 1, 1, SKINS);
    // cinturón con eslabón roto que cuelga
    rc(x, 12, 18, 9, 1, BOOT);
    rc(x, 21, 18, 1, 2, '#4a5662'); rc(x, 22, 20, 1, 1, '#6a7884');
    rc(x, 13, 23, 4, 3, BOOT);
    rc(x, 18, 23, 4, 3, BOOT);
    // ---- cabeza con capucha rasgada ----
    rc(x, 13, 3, 8, 7, CAP);
    rc(x, 12, 4, 1, 5, CAPD);
    rc(x, 21, 4, 1, 5, CAPD);
    rc(x, 21, 3, 2, 1, CAPD);                  // oreja de la capucha rota
    rc(x, 14, 5, 6, 4, BK);                    // hueco de la capucha
    // ojos de bilis: glow de dos tonos (halo oliva que late + núcleo)
    x.globalAlpha = f === 1 ? 0.5 : 0.32;
    rc(x, 13, 5, 4, 3, HALO); rc(x, 17, 5, 3, 3, HALO);
    x.globalAlpha = 1;
    rc(x, 14, 6, 2, 2, ACC); rc(x, 18, 6, 1, 2, ACC);  // asimetría: ojo der. fino
    rc(x, 14, 6, 1, 1, '#f2ffd0'); rc(x, 18, 6, 1, 1, '#f2ffd0'); // núcleo célere
    // cicatriz vieja que cruza la capucha (historia)
    rc(x, 19, 3, 1, 1, SKINS); rc(x, 20, 4, 1, 2, SKINS);
    // ---- brazos + dagas de eco ----
    rc(x, 9, 11, 3, 3, CAP); rc(x, 8, 13, 2, 3, SKIN);   // brazo trasero
    rc(x, 21, 11, 3, 3, CAP); rc(x, 23, 13, 2, 3, SKIN); // brazo delantero
    // daga 1 (alzada, atrás — filo mellado)
    rc(x, 6, 6, 2, 8, DGA);
    rc(x, 6, 6, 1, 8, DGAD);
    rc(x, 8, 9, 1, 1, DGA);                    // mella del filo
    rc(x, 5, 13, 4, 2, DGAD);                  // guarda
    // daga 2 (invertida, adelante — agarre de cazarreco)
    rc(x, 24, 16, 2, 7, DGA);
    rc(x, 25, 16, 1, 7, DGAD);
    rc(x, 23, 22, 4, 2, DGAD);
    // brillo bilis de los filos (parpadea por frame)
    if (f !== 1) { x.globalAlpha = 0.8; rc(x, 6, 7, 1, 3, ACC); rc(x, 25, 17, 1, 2, ACC); x.globalAlpha = 1; }
    // ---- R9-1 · pasada de contraste: sombra del faldón y costado ----
    x.globalAlpha = 0.55;
    rc(x, 12, 22, 10, 1, BK);                  // borde inferior del faldón
    rc(x, 12, 10, 1, 9, BK);                   // costado izq. de la gabardina
    x.globalAlpha = 1;
    // contorno sutil
    x.globalAlpha = 0.5;
    rc(x, 13, 3, 8, 1, BK);
    rc(x, 12, 19, 10, 1, BK);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- El Coro Roto (30×30 · 2 frames × 3 máscaras · JEFE) ----
// TERROR V2: masa de tres máscaras flotantes unidas por hilos de
// bruma, hueso más frío y desaturado, glow VIOLETA y ojos de dos
// tonos (núcleo hueso claro + halo del color del coro). Una costura
// cierra la grieta principal, la cadena del techo sigue colgando del
// mentón y las máscaras laterales cuelgan retorcidas y desportilladas.
// buildCoro(fase) devuelve la variante de la fase:
//   1 · MÁSCARA DEL PULSO    — hueso claro, glow violeta-azulado.
//   2 · MÁSCARA DEL VERA     — hueso frío, glow violeta, grietas cosidas.
//   3 · MÁSCARA DEL SILENCIO — hueso apagado, glow dorado, cuarteadas.

function buildCoro(fase: 1 | 2 | 3): Frames {
  const pal = fase === 1
    ? { HUESO: '#d2d2c6', HUESO2: '#b0b0a0', GLOW: '#8fb0ff', HUECO: '#141826', FILO: '#eef0ea' }
    : fase === 2
      ? { HUESO: '#c6c4ba', HUESO2: '#a2a094', GLOW: '#a86bff', HUECO: '#160f24', FILO: '#e8e4e0' }
      : { HUESO: '#c2bcb0', HUESO2: '#98928a', GLOW: '#e0c078', HUECO: '#1c1820', FILO: '#d8d4cc' };
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(30, 30);
    const bob = f === 0 ? 0 : 1;
    const { HUESO, HUESO2, GLOW, HUECO, FILO } = pal;
    // ---- hilos de bruma que unen la masa ----
    x.globalAlpha = 0.4;
    rc(x, 8, 14 + bob, 4, 1, GLOW);
    rc(x, 18, 14 - bob, 4, 1, GLOW);
    x.globalAlpha = 0.22;
    disc(x, 15, 13 + bob, 11, GLOW);           // aura compartida
    x.globalAlpha = 1;
    // ---- máscara central (boca vertical = canto al revés) ----
    rc(x, 10, 5 + bob, 10, 13, HUESO);
    rc(x, 9, 6 + bob, 12, 11, HUESO);
    rc(x, 10, 17 + bob, 10, 2, HUESO2);        // mentón
    rc(x, 9, 6 + bob, 1, 9, HUESO2);
    rc(x, 20, 6 + bob, 1, 9, HUESO2);
    // ojos huecos con glow de dos tonos (halo del coro, late en f1)
    const eyeH = fase === 1 ? 2 : fase === 2 ? 3 : 4;
    x.globalAlpha = f === 1 ? 0.55 : 0.3;
    rc(x, 10, 7 + bob, 4, eyeH + 2, GLOW);
    rc(x, 16, 7 + bob, 4, eyeH + 2, GLOW);
    x.globalAlpha = 1;
    rc(x, 11, 8 + bob, 2, eyeH, HUECO);
    rc(x, 17, 8 + bob, 2, eyeH, HUECO);
    rc(x, 11, 8 + bob, 2, 1, FILO);            // núcleo claro
    rc(x, 17, 8 + bob, 2, 1, FILO);
    // boca vertical (la nota al revés) + glow interior
    rc(x, 14, 11 + bob, 2, 5, HUECO);
    x.globalAlpha = 0.85;
    rc(x, 14, 11 + bob, 1, 4, GLOW);
    x.globalAlpha = 1;
    // grietas: finas y COSIDAS en F2, cuarteadas en F3
    if (fase >= 2) {
      rc(x, 12, 5 + bob, 1, 3, HUECO);
      rc(x, 18, 13 + bob, 1, 4, HUECO);
      rc(x, 11, 6 + bob, 1, 1, FILO);          // puntadas de la costura
      rc(x, 13, 7 + bob, 1, 1, FILO);
      rc(x, 17, 15 + bob, 1, 1, FILO); rc(x, 19, 14 + bob, 1, 1, FILO);
    }
    if (fase === 3) {
      rc(x, 10, 12 + bob, 3, 1, HUECO);
      rc(x, 16, 5 + bob, 1, 4, HUECO);
      rc(x, 13, 18 + bob, 4, 1, HUECO);
      rc(x, 19, 9 + bob, 1, 3, HUESO2);
    }
    // cadena rota que cuelga del mentón (historia: colgó de la cripta)
    rc(x, 14, 20 + bob, 2, 1, '#4e5866');
    rc(x, 15, 21 + bob, 1, 2, '#6c7888');      // eslabón suelto
    // ---- máscara izquierda (perfil, cuelga retorcida) ----
    rc(x, 3, 13 + bob, 6, 8, HUESO2);
    rc(x, 2, 14 + bob, 1, 6, HUESO2);
    x.globalAlpha = 0.35;
    rc(x, 3, 14 + bob, 3, 3, GLOW);            // halo del ojo ladeado
    x.globalAlpha = 1;
    rc(x, 4, 15 + bob, 2, 2, HUECO);
    rc(x, 4, 15 + bob, 1, 1, FILO);
    rc(x, 5, 21 + bob, 1, 2, HUECO);           // boca pequeña
    rc(x, 7, 13 + bob, 1, 3, HUECO);           // grieta que la parte
    // ---- máscara derecha (perfil, más alta y desportillada) ----
    rc(x, 21, 8 + bob, 6, 8, HUESO2);
    rc(x, 27, 9 + bob, 1, 6, HUESO2);
    rc(x, 22, 8 + bob, 3, 1, HUECO);           // desportilladura superior
    x.globalAlpha = 0.35;
    rc(x, 22, 11 + bob, 3, 3, GLOW);
    x.globalAlpha = 1;
    rc(x, 23, 12 + bob, 2, 2, HUECO);
    rc(x, 23, 12 + bob, 1, 1, FILO);
    rc(x, 24, 17 + bob, 1, 2, HUECO);
    // ---- R9-1 · pasada de contraste: rim de silueta de las máscaras ----
    x.globalAlpha = 0.5;
    rc(x, 10, 5 + bob, 10, 1, HUECO);          // techo máscara central
    rc(x, 3, 13 + bob, 6, 1, HUECO);           // techo máscara izq.
    rc(x, 21, 8 + bob, 6, 1, HUECO);           // techo máscara der.
    x.globalAlpha = 1;
    // destello del glow (parpadeo por frame)
    if (f === 1) {
      x.globalAlpha = 0.7;
      rc(x, 14, 15 + bob, 1, 1, FILO);
      rc(x, 6, 11 + bob, 1, 1, GLOW);
      rc(x, 23, 7 + bob, 1, 1, GLOW);
      x.globalAlpha = 1;
    }
    frames.push(c);
  }
  return frames;
}

// ---------------- Eco Desgarrado (16×16 · 2 frames) ----------------------
// TERROR V2: espectro PARTIDO en dos mitades por un hueco del que se
// escapa su eco en ORO CORRUPTO (acento). Hueso frío desaturado,
// costura dorada en el costado y ojos desalineados de dos tonos. El
// hueco late (cambia de ancho y de brillo por frame).

function buildEcodesg(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(16, 16);
    const O = '#2e3844', B = '#c2ccd2', S = '#9ca8b0', HUECO = '#1c2430',
      GOLD = '#e0b850', GOLDD = '#8a6c2c';     // ACENTO: oro corrupto
    const GAP = f === 0 ? 1 : 2;
    // resplandor del desgarro (el eco dorado se escapa; late en f1)
    x.globalAlpha = f === 1 ? 0.4 : 0.25;
    rc(x, 7, 3, 2 + GAP, 9, GOLDD);
    x.globalAlpha = 1;
    // mitad izquierda (jag de desgarro) con costura dorada
    x.globalAlpha = 0.85;
    rc(x, 4, 4, 3, 7, B);
    rc(x, 3, 6, 1, 4, B);
    rc(x, 7 - GAP, 5, 1, 2, B);
    rc(x, 6 - GAP, 8, 1, 2, S);
    x.globalAlpha = 1;
    rc(x, 5, 5, 1, 4, GOLDD);                  // costura de la herida
    rc(x, 4, 7, 1, 1, S); rc(x, 6, 8, 1, 1, S);// puntadas
    // mitad derecha (simétrica rota)
    x.globalAlpha = 0.85;
    rc(x, 9 + GAP, 4, 3, 7, B);
    rc(x, 12 + GAP, 6, 1, 4, B);
    rc(x, 8 + GAP, 5, 1, 2, S);
    rc(x, 9 + GAP, 8, 1, 2, S);
    x.globalAlpha = 1;
    // cola desgarrada (3 jirones)
    x.globalAlpha = 0.6;
    rc(x, 4, 11, 2, 2 + f, B);
    rc(x, 7, 11 + GAP, 2, 1 + f, S);
    rc(x, 10 + GAP, 11, 2, 2, B);
    x.globalAlpha = 1;
    // ojos desalineados con glow de dos tonos (núcleo oro + halo)
    x.globalAlpha = f === 1 ? 0.5 : 0.3;
    rc(x, 3, 5, 3, 3, GOLDD); rc(x, 10 + GAP, 5, 3, 3, GOLDD);
    x.globalAlpha = 1;
    rc(x, 4, 6, 1, 2, HUECO); rc(x, 11 + GAP, 6, 1, 2, HUECO);
    rc(x, 4, 6, 1, 1, GOLD); rc(x, 11 + GAP, 6, 1, 1, GOLD);
    // borde superior del desgarro
    rc(x, 4, 3, 8, 1, O);
    x.globalAlpha = 0.5;
    rc(x, 7, 3 + GAP, 2, 1, O);                // labio del hueco
    x.globalAlpha = 1;
    // ---- R9-1 · contraste: rim superior + chispas del eco dorado ----
    x.globalAlpha = 0.45;
    rc(x, 3, 3, 11, 1, O);                     // rim sobre las dos mitades
    x.globalAlpha = 1;
    if (f === 1) {                             // el eco escupe chispas al latir
      x.globalAlpha = 0.8;
      rc(x, 6, 12, 1, 1, GOLD); rc(x, 12, 4, 1, 1, GOLD);
      x.globalAlpha = 1;
    }
    frames.push(c);
  }
  return frames;
}

// ---------------- Sátiro de la Niebla (16×16 · 2 frames) -----------------
// TERROR V2: bruto cabrío de ceniza (pelaje gris desaturado) con UN
// acento ROJO CARNE: asta rota con médula expuesta, hilo rojo atado
// al asta buena, ojo de glow de dos tonos, cicatriz en el costado y
// la zampoña tallada con un agujero. El frame alterna el brinco.

function buildSatiro(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(16, 16);
    const FUR = '#4a4a4c', FUR2 = '#5c5c5a', HORN = '#c4bcac',
      HOOF = '#26262a', NIEBLA = '#a8b4bc', BK = '#202022',
      ACC = '#d8483a', ACCD = '#7c241c';       // ACENTO: rojo carne
    const hop = f === 0 ? 0 : -1; // brinco
    // niebla en los cascos
    x.globalAlpha = 0.35;
    rc(x, 2, 14, 5, 1, NIEBLA);
    rc(x, 9, 14, 5, 1, NIEBLA);
    x.globalAlpha = 1;
    // astas asimétricas: la izq. ROTA, la der. curva con hilo rojo
    rc(x, 4, 1 + hop, 1, 3, HORN);
    rc(x, 4, 1 + hop, 1, 1, ACCD);             // médula expuesta del tocón
    rc(x, 9, 1 + hop, 1, 3, HORN); rc(x, 10, 1 + hop, 1, 2, HORN);
    rc(x, 9, 1 + hop, 1, 1, ACC);              // hilo de carne
    // cabeza cabruna (perfil)
    rc(x, 4, 3 + hop, 6, 4, FUR);
    rc(x, 9, 4 + hop, 2, 2, FUR);              // hocico
    // ojo con glow de dos tonos (halo carne que late + núcleo claro)
    x.globalAlpha = f === 1 ? 0.5 : 0.3;
    rc(x, 4, 3 + hop, 3, 3, ACCD);
    x.globalAlpha = 1;
    rc(x, 5, 4 + hop, 1, 1, '#ff9a80');
    // barba de chivo
    rc(x, 8, 7 + hop, 1, 2, FUR2);
    // torso encorvado con cicatriz pálida en el costado
    rc(x, 3, 7 + hop, 8, 4, FUR);
    rc(x, 4, 11 + hop, 6, 1, FUR2);
    rc(x, 3, 7 + hop, 8, 1, BK);
    rc(x, 3, 9 + hop, 2, 1, '#8a8a86');        // cicatriz
    // patas traseras y delanteras (el brinco alterna)
    rc(x, 4, 11 + hop, 1, 3 - f, FUR2); rc(x, 4, 13 + hop - f, 1, 1, HOOF);
    rc(x, 9, 11 + hop, 1, 3 - (1 - f), FUR2); rc(x, 9, 13 + hop - (1 - f), 1, 1, HOOF);
    rc(x, 3, 11 + hop, 1, 2, FUR2);
    // zampoña tallada junto al hocico (un agujero por cada nombre robado)
    rc(x, 10, 6 + hop, 1, 4, '#5c4a3a');
    rc(x, 11, 6 + hop, 1, 3, '#40342a');
    rc(x, 10, 7 + hop, 1, 1, ACCD);            // agujero tallado
    // ---- R9-1 · contraste: polvo del brinco + filo del asta buena ----
    if (f === 1) {
      x.globalAlpha = 0.5;
      rc(x, 3, 13, 2, 1, NIEBLA); rc(x, 11, 13, 2, 1, NIEBLA); // polvo al aterrizar
      x.globalAlpha = 1;
    }
    rc(x, 10, 1 + hop, 1, 1, '#e0d8c4');       // punta del asta curva
    if (f === 1) { x.globalAlpha = 0.7; rc(x, 12, 5 + hop, 1, 1, NIEBLA); x.globalAlpha = 1; } // nota de niebla
    // cola corta
    rc(x, 2, 8 + hop, 1, 2, FUR2);
    frames.push(c);
  }
  return frames;
}
