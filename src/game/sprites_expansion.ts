// ============================================================
// ECOS DE AELTHAR — ACTO II · Arte pixel procedural de la
// EXPANSIÓN (AGENTE 7-b · enemigos + sprites).
// 100% procedural: canvas + fillRect píxel a píxel, sin assets.
// NO toca sprites.ts: usa registerSpr()/hash2() (contrato).
// R6-V1: REDISEÑO TERROR V2 de los jefes de expansión (sirena, golem,
// vult, coro, ecodesg, satiro + ojos de neumo/espectro/arpi):
// siluetas retorcidas, ojos glow de 2 tonos, paleta fría + 1 acento
// y detalles de historia (cadenas rotas, cicatrices, costuras).
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
    // ojo: glow de dos tonos (halo teal + núcleo oscuro con brillo)
    x.globalAlpha = 0.35;
    rc(x, 8, 6 - f, 4, 4, '#2a8a84');
    x.globalAlpha = 1;
    rc(x, 9, 7 - f, 2, 2, EYE);
    rc(x, 9, 7 - f, 1, 1, '#ffffff');
    // cicatriz de la membrana (ya estalló una vez y se recosió)
    x.globalAlpha = 0.5;
    rc(x, 4, 9, 1, 2, O); rc(x, 5, 11, 1, 1, O);
    x.globalAlpha = 1;
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
    // ojos huecos con halo frío de dos tonos
    x.globalAlpha = 0.35;
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
    // ojo de ventisca: glow de dos tonos (halo hielo + núcleo claro)
    x.globalAlpha = 0.4;
    rc(x, 10, 4, 3, 3, '#6a9ac4');
    x.globalAlpha = 1;
    rc(x, 11, 5, 1, 1, '#bfe8ff');
    // contorno sutil
    x.globalAlpha = 0.5;
    rc(x, 5, 6, 4, 1, O);
    rc(x, 9, 4, 4, 1, O);
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
    if (f === 1) { x.globalAlpha = 0.7; rc(x, 12, 5 + hop, 1, 1, NIEBLA); x.globalAlpha = 1; } // nota de niebla
    // cola corta
    rc(x, 2, 8 + hop, 1, 2, FUR2);
    frames.push(c);
  }
  return frames;
}
