// ============================================================
// ECOS DE AELTHAR — ACTO II · Arte pixel procedural de la
// EXPANSIÓN (AGENTE 7-b · enemigos + sprites).
// 100% procedural: canvas + fillRect píxel a píxel, sin assets.
// NO toca sprites.ts: usa registerSpr()/hash2() (contrato).
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
// ENEMIGOS NUEVOS
// ============================================================

// ---------------- Neumo de Marea (16×16 · 2 frames) ----------------
// Criatura burbuja de espuma: flota y tiembla. Aguamarina translúcida
// con brillo y un ojo oscuro pequeño.

function buildNeumo(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(16, 16);
    const O = '#1c5a5e', BD = '#4ec2b8', B = '#7fe8d8', HL = '#d8fcf4', EYE = '#173038';
    const oy = f; // tiembla: el cuerpo sube/baja 1 px
    // contorno + masa
    disc(x, 8, 8, f === 0 ? 6 : 6.4, O, 0.85);
    disc(x, 8, 8 + oy * 0.4, 5.2, BD, 0.72);
    disc(x, 8, 8 + oy * 0.4, 4.1, B, 0.68);
    // brillo (espalda superior)
    x.globalAlpha = 0.92;
    rc(x, 5, 4 - f, 3, 2, HL);
    rc(x, 4, 5 - f, 1, 1, HL);
    x.globalAlpha = 0.55;
    rc(x, 9, 5 - f, 1, 2, HL);
    // ojo oscuro pequeño
    x.globalAlpha = 1;
    rc(x, 9, 7 - f, 2, 2, EYE);
    rc(x, 9, 7 - f, 1, 1, '#ffffff');
    // burbujitas de espuma en la base
    x.globalAlpha = 0.7;
    rc(x, 3, 12, 2, 2, B);
    rc(x, 11, 12 + f, 2, 1, B);
    rc(x, 7, 13, 1, 1, HL);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Espectro sin Nombre (16×16 · 2 frames) ----------------
// Fantasma humanoide pálido que sube y baja; borde difuminado
// (globalAlpha dentro del canvas) y ojos huecos.

function buildEspectro(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(16, 16);
    const O = '#3a4a5e', B = '#c9d4e4', S = '#a2b2c8', EYE = '#232e42';
    const dy = f === 0 ? 0 : -1; // sube/baja
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
    // borde difuminado: costados y rabo translúcidos
    x.globalAlpha = 0.35;
    rc(x, 3, 4 + dy, 1, 6, B);
    rc(x, 12, 4 + dy, 1, 6, B);
    rc(x, 4, 13 + dy, 8, 1, B);
    // jirones finales (alternan con el frame)
    x.globalAlpha = 0.55;
    if (f === 0) { rc(x, 6, 13, 2, 2, S); rc(x, 9, 13, 1, 1, S); }
    else { rc(x, 5, 12, 1, 2, S); rc(x, 8, 13, 2, 1, S); }
    // ojos huecos
    x.globalAlpha = 1;
    rc(x, 6, 4 + dy, 1, 2, EYE);
    rc(x, 9, 4 + dy, 1, 2, EYE);
    x.globalAlpha = 0.5;
    rc(x, 7, 6 + dy, 2, 1, EYE);
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

// ---------------- Arpía de Cumbre (16×16 · 2 frames) ----------------
// Ave de ventisca: alas arriba / alas abajo. Blanco-azul hielo,
// pico gris, mirada hacia la derecha (el render voltea a la izq.).

function buildArpi(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(16, 16);
    const O = '#2e4256', W = '#eef6fc', WS = '#bcdcf0', WSD = '#8fb8d8', BK = '#8a94a0', EYE = '#1e2c3a';
    // alas (arriba en f0, abajo en f1)
    x.globalAlpha = 1;
    x.fillStyle = WS;
    if (f === 0) {
      rc(x, 3, 2, 3, 5, WS); rc(x, 2, 4, 2, 4, WS);          // ala izq. alzada
      rc(x, 10, 2, 3, 5, WS); rc(x, 12, 4, 2, 4, WS);        // ala der. alzada
      rc(x, 4, 3, 1, 3, W); rc(x, 11, 3, 1, 3, W);           // brillo de pluma
    } else {
      rc(x, 2, 9, 3, 5, WS); rc(x, 1, 11, 2, 3, WS);         // ala izq. baja
      rc(x, 11, 9, 3, 5, WS); rc(x, 13, 11, 2, 3, WS);       // ala der. baja
      rc(x, 3, 10, 1, 3, W); rc(x, 12, 10, 1, 3, W);
    }
    // cola
    rc(x, 2, 8, 3, 2, WSD);
    rc(x, 1, 9, 1, 1, WSD);
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
    rc(x, 11, 5, 1, 1, EYE);
    // contorno sutil
    x.globalAlpha = 0.5;
    rc(x, 5, 6, 4, 1, O);
    rc(x, 9, 4, 4, 1, O);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Sirena Abisal (32×32 · 3 frames · JEFA) ----------------
// Reina del naufragio: melena de agua ondulante, cola de pez
// escarchada, corona de coral roto. Verde-mar + turquesa + perla.
// Debe verse REGIA y triste: mirada baja, boca mínima, perlas.

function buildSirena(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = cv(32, 32);
    const HAIR = '#2e6a68', HAIR2 = '#54b8a8', SKIN = '#e9e4d8', SKINS = '#c6c0b2',
      CORAL = '#c86a5a', CORALD = '#a44e42', PEARL = '#eef4ee',
      TOP = '#3e8a7a', TOP2 = '#54b8a8', FIN = '#54b8a8', FIN2 = '#7fd8c8',
      FROST = '#eef8f4', EYE = '#2a4a54';
    const sway = f === 0 ? 0 : f === 1 ? 1 : -1; // vaivén de melena y aletas
    // ---- melena trasera (masa de agua) ----
    x.globalAlpha = 0.95;
    rc(x, 9, 3, 14, 12, HAIR);
    rc(x, 8, 5 + sway, 2, 10, HAIR);           // mechón izq.
    rc(x, 22, 5 - sway, 2, 10, HAIR);          // mechón der.
    rc(x, 7, 9 + sway, 2, 6, HAIR2);
    rc(x, 23, 9 - sway, 2, 6, HAIR2);
    // puntas que ondean
    x.globalAlpha = 0.6;
    rc(x, 6, 15 + sway, 3, 3, HAIR2);
    rc(x, 23, 15 - sway, 3, 3, HAIR2);
    rc(x, 9, 16 - sway, 2, 2, HAIR2);
    // ---- corona de coral roto ----
    x.globalAlpha = 1;
    rc(x, 10, 1, 3, 4, CORAL);                 // pica izq. (entera)
    rc(x, 10, 1, 3, 1, PEARL);
    rc(x, 14, 3, 3, 2, CORALD);                // pica central ROTA (mucho más baja)
    rc(x, 15, 2, 1, 1, CORALD);
    rc(x, 19, 1, 3, 4, CORAL);                 // pica der. (entera)
    rc(x, 19, 1, 3, 1, PEARL);
    // ---- rostro ----
    rc(x, 12, 4, 8, 8, SKIN);
    rc(x, 12, 10, 8, 2, SKINS);
    rc(x, 11, 5, 1, 4, SKINS);
    rc(x, 20, 5, 1, 4, SKINS);
    // flequillo de agua partido
    rc(x, 11, 3, 10, 2, HAIR2);
    rc(x, 11, 5, 3, 2, HAIR2);
    rc(x, 18, 5, 3, 2, HAIR2);
    // ojos tristes (mirada baja, párpado caído)
    rc(x, 13, 7, 2, 2, EYE);
    rc(x, 17, 7, 2, 2, EYE);
    rc(x, 13, 6, 2, 1, SKINS);
    rc(x, 17, 6, 2, 1, SKINS);
    rc(x, 14, 9, 1, 1, '#bfe8f0');             // lágrima de perla
    rc(x, 15, 10, 2, 1, '#8a7a72');            // boca mínima
    // ---- busto con túnica de marea ----
    rc(x, 9, 12, 14, 3, TOP);
    rc(x, 9, 12, 14, 1, '#dceae4');            // ribete de perla
    rc(x, 12, 15, 8, 4, SKIN);
    rc(x, 12, 15, 8, 1, SKINS);
    // collar de perlas
    rc(x, 12, 15, 1, 1, PEARL); rc(x, 14, 16, 1, 1, PEARL);
    rc(x, 17, 16, 1, 1, PEARL); rc(x, 19, 15, 1, 1, PEARL);
    // brazos
    rc(x, 7, 13, 2, 6, SKIN); rc(x, 7, 13, 1, 6, SKINS);
    rc(x, 23, 13, 2, 6, SKIN); rc(x, 24, 13, 1, 6, SKINS);
    // ---- cola escarchada ----
    rc(x, 10, 18, 12, 3, TOP);
    rc(x, 11, 21, 10, 2, TOP);
    rc(x, 12, 23, 8, 2, TOP2);
    rc(x, 13, 25, 6, 2, FIN);
    // escamas de brillo
    x.globalAlpha = 0.7;
    rc(x, 12 + sway, 19, 2, 1, TOP2);
    rc(x, 17 - sway, 22, 2, 1, FROST);
    rc(x, 14, 24, 1, 2, FROST);
    x.globalAlpha = 1;
    // aletas (frost tips) — se mecen con el frame
    const fs = sway;
    rc(x, 11 + fs, 26, 4, 2, FIN); rc(x, 9 + fs, 27, 4, 2, FIN2);
    rc(x, 7 + fs, 28, 4, 2, FIN); rc(x, 5 + fs, 29, 3, 2, FROST);
    rc(x, 17 - fs, 26, 4, 2, FIN); rc(x, 19 - fs, 27, 4, 2, FIN2);
    rc(x, 21 - fs, 28, 4, 2, FIN); rc(x, 24 - fs, 29, 3, 2, FROST);
    // aura de bruma marina
    x.globalAlpha = 0.18;
    rc(x, 5, 10 + sway, 2, 8, FIN2);
    rc(x, 25, 10 - sway, 2, 8, FIN2);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Gólem de Escarcha (32×32 · 2 frames · JEFE) ----------------
// Masa de hielo masiva con núcleo brillante y cristales al hombro.
// Frame 2 = el núcleo pulsa. Azul hielo + blanco + cian núcleo.

function buildGolem(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(32, 32);
    const O = '#1c3048', ICE = '#7ea8cc', ICED = '#5a86b0', ICEDD = '#4a76a0',
      L = '#a8cce8', XT = '#c8e4f4', SNOW = '#eef6fc';
    const CORE = f === 0 ? '#3ec8e8' : '#5fdcf8';
    const CORE2 = f === 0 ? '#8ef0ff' : '#d8f8ff';
    // ---- torso macizo ----
    rc(x, 8, 10, 16, 15, ICE);
    rc(x, 8, 10, 16, 2, L);
    rc(x, 9, 24, 14, 2, ICED);
    // placas y grietas
    rc(x, 8, 14, 16, 1, ICED);
    rc(x, 8, 19, 16, 1, ICED);
    rc(x, 10, 15, 1, 4, '#3a5a7c');
    rc(x, 21, 11, 1, 3, '#3a5a7c');
    rc(x, 17, 20, 1, 3, '#3a5a7c');
    // ---- núcleo brillante ----
    if (f === 1) disc(x, 15.5, 17.5, 5.5, CORE2, 0.22); // pulso
    rc(x, 12, 14, 8, 7, '#2a7a9c');
    rc(x, 13, 15, 6, 5, CORE);
    rc(x, 14, 16, 4, 3, CORE2);
    // ---- cabeza hundida ----
    rc(x, 12, 3, 8, 7, ICE);
    rc(x, 12, 3, 8, 1, L);
    rc(x, 12, 9, 8, 1, ICED);
    rc(x, 13, 6, 2, 1, CORE); rc(x, 17, 6, 2, 1, CORE); // ojos ranura de cian
    // ---- hombros con cristales ----
    rc(x, 2, 8, 9, 7, ICED);
    rc(x, 2, 8, 9, 1, L);
    rc(x, 4, 5, 4, 3, XT); rc(x, 5, 4, 2, 1, SNOW);     // cristal izq.
    rc(x, 21, 8, 9, 7, ICED);
    rc(x, 21, 8, 9, 1, L);
    rc(x, 24, 5, 4, 3, XT); rc(x, 26, 4, 2, 1, SNOW);   // cristal der.
    // nieve posada
    rc(x, 3, 8, 4, 1, SNOW); rc(x, 25, 8, 4, 1, SNOW);
    // ---- brazos colosales ----
    rc(x, 1, 12, 5, 12, ICED);
    rc(x, 1, 12, 1, 12, L);
    rc(x, 0, 23, 7, 5, ICEDD);
    rc(x, 0, 23, 7, 1, L);
    rc(x, 26, 12, 5, 12, ICED);
    rc(x, 30, 12, 1, 12, '#3a5a7c');
    rc(x, 25, 23, 7, 5, ICEDD);
    rc(x, 25, 23, 7, 1, L);
    // ---- pata de bloque y escarcha base ----
    rc(x, 9, 25, 6, 4, ICEDD);
    rc(x, 17, 25, 6, 4, ICEDD);
    rc(x, 9, 28, 6, 1, '#3a5a7c'); rc(x, 17, 28, 6, 1, '#3a5a7c');
    rc(x, 8, 29, 8, 1, SNOW); rc(x, 16, 29, 8, 1, SNOW);
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
  registerSpr('neumo', buildNeumo());
  registerSpr('espectro', buildEspectro());
  registerSpr('arpi', buildArpi());
  registerSpr('sirena', buildSirena());
  registerSpr('golem', buildGolem());
  registerSpr('orb', buildOrb());
  registerSpr('shard', buildShard());
  registerSpr('nota', buildNota());
}

// ============================================================
// TILES DE SUELO (Acto II)
// El motor llama a drawTile() al pre-renderizar el suelo; el
// integrador debe probar PRIMERO esta función y caer al dibujo
// genérico si devuelve false:
//   if (drawExpansionTile(x, ch, tx, ty, this.mapId)) continue;
//   drawTile(x, ch, tx, ty, this.mapId, 0);
// ============================================================

export function drawExpansionTile(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number, mapId: string,
): boolean {
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx, ty);
  const r2 = hash2(tx * 7 + 3, ty * 11 + 5);
  const r3 = hash2(tx * 13 + 1, ty * 3 + 7);
  switch (ch) {
    case 's': { // arena con moteado determinista
      rc(x, px0, py0, 16, 16, r < 0.5 ? '#dcc590' : '#d2bb84');
      for (let i = 0; i < 5; i++) {
        const hx = hash2(tx * 5 + i * 3, ty * 7 + i);
        const hy = hash2(tx * 11 + i, ty * 5 + i * 7);
        if (hx < 0.45) {
          x.fillStyle = i % 2 === 0 ? '#c4ab74' : '#e6d2a2';
          x.fillRect(px0 + Math.floor(hx * 30) % 15, py0 + Math.floor(hy * 30) % 15, 1, 1);
        }
      }
      if (r2 > 0.86) { // concha suelta
        rc(x, px0 + 4 + Math.floor(r * 6), py0 + 5 + Math.floor(r3 * 6), 2, 1, '#f0e8d4');
      }
      if (r3 < 0.1) rc(x, px0 + 9, py0 + 3, 2, 1, '#e8d4a4');
      return true;
    }
    case 'S': { // nieve con destellos
      rc(x, px0, py0, 16, 16, r < 0.5 ? '#e9eef5' : '#e2e9f1');
      const n = r2 > 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const hx = hash2(tx * 3 + i * 11, ty * 9 + i * 5);
        const hy = hash2(tx * 17 + i, ty * 13 + i * 3);
        rc(x, px0 + 2 + Math.floor(hx * 12), py0 + 2 + Math.floor(hy * 12), 1, 1, '#ffffff');
      }
      if (r3 > 0.72) rc(x, px0 + 4 + Math.floor(r * 8), py0 + 9, 3, 1, '#d2dde9');
      return true;
    }
    case 'i': { // hielo liso con grietas claras + reflejo
      rc(x, px0, py0, 16, 16, r < 0.5 ? '#a9d2ea' : '#9fc9e4');
      // reflejo diagonal
      x.globalAlpha = 0.2;
      rc(x, px0 + 2 + Math.floor(r2 * 4), py0, 3, 16, '#eaf7ff');
      x.globalAlpha = 1;
      // grietas (polilínea determinista)
      if (r2 > 0.4) {
        const cx0 = px0 + 3 + Math.floor(r * 6), cy0 = py0 + 3 + Math.floor(r3 * 8);
        rc(x, cx0, cy0, 4, 1, '#d6eefc');
        rc(x, cx0 + 3, cy0 + 1, 1, 3, '#d6eefc');
        rc(x, cx0 + 2, cy0 + 3, 2, 1, '#c2e2f4');
      }
      if (r3 < 0.25) rc(x, px0 + 10, py0 + 10, 3, 1, '#c2e2f4');
      rc(x, px0, py0, 16, 1, '#b8dcf0');
      return true;
    }
    case '.': {
      if (mapId === 'costa') { // hierba salada amarillenta-verdosa
        rc(x, px0, py0, 16, 16, r < 0.5 ? '#8aa860' : '#7e9c56');
        for (let i = 0; i < 4; i++) {
          const hx = hash2(tx * 4 + i, ty * 9 + i);
          if (hx < 0.4) {
            rc(x, px0 + Math.floor(hx * 14), py0 + Math.floor(hash2(tx + i, ty * 3 + i) * 14), 1, 2,
              i % 2 === 0 ? '#a8c070' : '#6e8c4c');
          }
        }
        if (r2 > 0.8) rc(x, px0 + 6, py0 + 8, 2, 1, '#c8b878'); // brizna seca
        return true;
      }
      if (mapId === 'cumbres') { // nieve corta verdosa
        rc(x, px0, py0, 16, 16, r < 0.5 ? '#a8c098' : '#9cb48c');
        for (let i = 0; i < 4; i++) {
          const hx = hash2(tx * 6 + i, ty * 5 + i * 3);
          if (hx < 0.4) {
            rc(x, px0 + Math.floor(hx * 14), py0 + Math.floor(hash2(tx + i * 5, ty + i) * 14), 1, 1,
              i % 2 === 0 ? '#c4d8b4' : '#8aa07c');
          }
        }
        if (r2 > 0.62) rc(x, px0 + 3 + Math.floor(r * 8), py0 + 4 + Math.floor(r3 * 8), 2, 1, '#eef4f0');
        return true;
      }
      return false; // lunaris/bosque: dibujo genérico del motor
    }
    case ',': {
      if (mapId === 'costa') { // flores de sal
        rc(x, px0, py0, 16, 16, r < 0.5 ? '#8aa860' : '#7e9c56');
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
      return false;
    }
    case ':': {
      if (mapId === 'aldea') { // empedrado viejo más oscuro/agrietado
        rc(x, px0, py0, 16, 16, r < 0.5 ? '#585864' : '#525260');
        rc(x, px0, py0, 16, 1, '#6a6a78');
        // juntas de losas
        x.fillStyle = '#40404c';
        x.fillRect(px0, py0, 1, 16);
        x.fillRect(px0, py0 + (r > 0.5 ? 7 : 9), 16, 1);
        x.fillRect(px0 + (r2 > 0.5 ? 6 : 10), py0, 1, 8);
        // grietas
        if (r2 > 0.7) {
          rc(x, px0 + 3 + Math.floor(r * 6), py0 + 3, 1, 5, '#3c3c48');
          rc(x, px0 + 4 + Math.floor(r * 6), py0 + 7, 2, 1, '#3c3c48');
        }
        if (r3 > 0.85) rc(x, px0 + 11, py0 + 11, 2, 1, '#6e6e7c'); // piedra clara
        return true;
      }
      return false; // cripta/lunaris: dibujo genérico
    }
    case '=': {
      if (mapId === 'cumbres') { // camino pisado moreno
        rc(x, px0, py0, 16, 16, r < 0.5 ? '#8a7048' : '#7c6440');
        rc(x, px0, py0, 16, 1, '#9a8056');
        for (let i = 0; i < 5; i++) {
          const hx = hash2(tx * 13 + i, ty * 5 + i * 3);
          if (hx < 0.4) {
            rc(x, px0 + Math.floor(hx * 13), py0 + Math.floor(hash2(tx + i * 7, ty + i) * 13), 2, 1, '#6a5436');
          }
        }
        if (r2 > 0.75) rc(x, px0 + 5 + Math.floor(r * 6), py0 + 6, 2, 1, '#a8906a'); // piedrecilla
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

export function drawExpansionProp(
  ctx: CanvasRenderingContext2D, kind: string, cx: number, cy: number,
  zoom: number, t: number, lit: boolean,
): void {
  const Z = zoom;
  switch (kind) {
    case 'wreck': {
      // ---- casco de nave naufragada (~40×24) ----
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
      // borde superior desbordado (cubierta rota)
      ctx.fillStyle = '#8a6438';
      ctx.fillRect(-14 * Z, -12 * Z, 10 * Z, 2 * Z);
      ctx.fillStyle = '#54381e';
      ctx.fillRect(2 * Z, -11 * Z, 7 * Z, 2 * Z);
      // tablón suelto
      ctx.fillStyle = '#7d5630';
      ctx.fillRect(-4 * Z, -9 * Z, 9 * Z, 1.5 * Z);
      // musgo
      ctx.fillStyle = '#4a7a3e';
      ctx.fillRect(-9 * Z, -6 * Z, 5 * Z, 2 * Z);
      ctx.fillRect(6 * Z, 1 * Z, 4 * Z, 2 * Z);
      // mástil roto
      ctx.fillStyle = '#54381e';
      ctx.fillRect(6 * Z, -26 * Z, 2.4 * Z, 22 * Z);
      ctx.fillStyle = '#3e2a16';
      ctx.fillRect(7.4 * Z, -26 * Z, 1 * Z, 22 * Z);
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
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }
    case 'faro': {
      // ---- faro en ruinas (~20×48): torre de piedra con franjas ----
      // 8 segmentos de 6 px → 48 px de alto, se estrecha hacia arriba
      for (let i = 0; i < 8; i++) {
        const yTop = cy + (14 - i * 6) * Z - 6 * Z;
        const halfW = (10 - i * 0.5) * Z;
        ctx.fillStyle = i % 2 === 0 ? '#c8c2b4' : '#9a5a4a';
        ctx.fillRect(cx - halfW, yTop, halfW * 2, 6 * Z + 0.6);
      }
      // piedras caídas / ruina
      ctx.fillStyle = '#8a8478';
      ctx.fillRect(cx - 11 * Z, cy + 8 * Z, 3 * Z, 2 * Z);
      ctx.fillRect(cx + 7 * Z, cy + 2 * Z, 4 * Z, 2 * Z);
      // grieta
      ctx.fillStyle = 'rgba(40,36,30,0.5)';
      ctx.fillRect(cx - 2 * Z, cy - 10 * Z, 1.2 * Z, 10 * Z);
      ctx.fillRect(cx - 1 * Z, cy - 2 * Z, 1.2 * Z, 6 * Z);
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
      // ---- farol de pie (~10×18) ----
      // peana + poste
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(cx - 3 * Z, cy + 6 * Z, 6 * Z, 2 * Z);
      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(cx - 1 * Z, cy - 8 * Z, 2 * Z, 15 * Z);
      // caja del farol
      ctx.fillStyle = '#3a3a44';
      ctx.fillRect(cx - 3.5 * Z, cy - 16 * Z, 7 * Z, 9 * Z);
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(cx - 4.5 * Z, cy - 18 * Z, 9 * Z, 2.5 * Z);
      if (lit) {
        // llama cálida parpadeante + halo dorado
        const fl = 0.7 + Math.sin(t * 9) * 0.2 + Math.sin(t * 23.7) * 0.1;
        ctx.globalAlpha = 0.22 + fl * 0.18;
        ctx.fillStyle = '#ffd88a';
        ctx.beginPath();
        ctx.arc(cx, cy - 11.5 * Z, 10 * Z, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(255,216,138,${0.7 + fl * 0.3})`;
        ctx.fillRect(cx - 2.5 * Z, cy - 14.5 * Z, 5 * Z, 6 * Z);
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(cx - 1 * Z, cy - 13 * Z, 2 * Z, 3 * Z);
      } else {
        // cristal apagado gris
        ctx.fillStyle = '#8a8f98';
        ctx.fillRect(cx - 2.5 * Z, cy - 14.5 * Z, 5 * Z, 6 * Z);
        ctx.fillStyle = '#6a6f78';
        ctx.fillRect(cx - 1 * Z, cy - 12 * Z, 2 * Z, 3 * Z);
      }
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
