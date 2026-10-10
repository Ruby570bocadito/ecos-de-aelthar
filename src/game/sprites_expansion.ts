// ============================================================
// ECOS DE AELTHAR — ACTO II+III · Arte pixel procedural de la
// EXPANSIÓN · Task 18-c (sprites-jefes): REHAÚSO COMPLETO de los
// jefes/miniboses y mejora de los enemigos regulares.
// 100% procedural: canvas + fillRect píxel a píxel, sin assets.
// Determinismo TOTAL: sin Math.random — mulberry32 con semillas
// fijas y hash2(); construir el sprite dos veces da EXACTAMENTE
// los mismos canvas (verificado por smoke).
// NO toca sprites.ts: usa registerSpr()/hash2() (contrato).
//
// ══ ORDEN DE FRAMES (CONTRATO 18-c PARA EL INTEGRADOR) ══
// entityFrame() (sprites.ts) alterna SOLO los frames 0/1 cuando
// moving=true (n>=2 → Math.floor(anim*6)%2) y elige el 0 quieto:
// por eso los frames de PATRULLA son SIEMPRE 0 y 1. Los frames
// de telegraph/ataque/estado (índices >= 2) los elige el
// integrador así (todas las señales ya existen en Enemy):
//
//   e.ai === 'carga' && e.windup > 0  → frame TELEGRAPH
//   e.ai === 'ataca'                  → frame ATTACK
//   e.invulT > 0                      → frame ESPECTRAL/ESTADO
//
//   sirena  (5): 0 flotar A · 1 flotar B · 2 TELEGRAPH (se hincha,
//                abre brazos) · 3 ATTACK (látigo de agua) ·
//                4 SUMERGIDA (e.invulT>0 — 9-a)
//   golem   (5): 0 andar A · 1 andar B · 2 TELEGRAPH (brazos
//                arriba, núcleo encendido) · 3 ATTACK (smash) ·
//                4 AGRIETADO (usar como base de reposo cuando
//                e.phase === 3 — grietas abiertas con glow)
//   vult    (4): 0 carrera A · 1 carrera B · 2 TELEGRAPH (garra
//                alzada) · 3 ATTACK (embestida/acecho)
//   coro1-3 (3): 0 bob A · 1 bob B · 2 CANTO (máscara abre la
//                boca y dispara SU motivo: Pulso=orbes,
//                Vera=rayos, Silencio=notas) — usar en 'carga'
//                y durante la lluvia de la F3 (m.coroT>0)
//   neumo   (3): 0 membrana A · 1 membrana B · 2 HINCHADO
//                (telegraph de la escupitaja, windup 0.7)
//   espectro(3): 0 flotar A · 1 flotar B · 2 FASE ESPECTRAL
//                (e.invulT>0 — tras el golpe recibido)
//   arpi    (3): 0 alas arriba · 1 alas abajo · 2 PLAFÓN/PLENO
//                (alas medias — usar en el PICADO, 'carga')
//   ecodesg (3): 0 parpadeo flanco izq · 1 parpadeo flanco der ·
//                2 DASH (estirado, estelas — durante la embestida)
//   satiro  (3): 0 brinco A · 1 brinco B · 2 LIRA (tocando la
//                balada curva — telegraph del 'aro')
//   orb/shard/nota (2): pulso sutil; en pantalla los anima SIEMPRE
//                drawExpansionProjectile() (los frames son fallback).
//
// Ejemplo de cableado en render.ts (drawEntity), ANTES de
// entityFrame:
//   let fi = entityFrame(spr, e.dir, e.moving, e.anim);
//   if (e.kind === 'enemy') {
//     if (e.ai === 'carga' && e.windup > 0 && spr.length > 2) fi = 2;
//     else if (e.ai === 'ataca' && spr.length > 3) fi = 3;
//     else if ((e.invulT ?? 0) > 0 && spr.length > 4) fi = 4;
//     fi = Math.min(fi, spr.length - 1);
//   }
// (los frames >= 2 son SIEMPRE opcionales: si el integrador no
//  cablea nada, el juego sigue igual con el ciclo 0/1.)
//
// Resto del módulo (API intacta):
//   · drawExpansionTile(): tiles de suelo nuevos ('s' arena, 'S' nieve,
//     'i' hielo) + variantes de '.' ',' ':' '=' por mapa (costa,
//     aldea, cumbres). Devuelve true si dibujó el tile.
//   · drawExpansionTallTile(): palmera ('p' en costa) y pino nevado
//     ('t'/'p' en cumbres). Devuelve true si dibujó.
//   · drawExpansionProp(): 'wreck', 'faro', 'lamp' (centrados en cx,cy).
//   · drawExpansionProjectile(): 'orb', 'shard', 'nota' con animación.
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

/** PRNG determinista de semilla FIJA (cero Math.random en el módulo). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// ENEMIGOS REGULARES (14-18 px)
// ============================================================

// ---------------- Neumo de Marea (16×16 · 3 frames) ----------------
// Burbuja criatura de espuma con MEMBRANA que ONDULA: los lóbulos
// del borde giran entre frames (f0 cresta NO, f1 cresta SE) y el
// cuerpo flota con bob. f2 = HINCHADO (telegraph de la escupitaja):
// membrana tensa, anillo de tensión y núcleo brillante.
// Frames: 0 membrana A · 1 membrana B · 2 hinchado (windup 0.7).

function buildNeumo(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = cv(16, 16);
    const O = '#1c5a5e', BD = '#4ec2b8', B = '#7fe8d8', HL = '#d8fcf4', EYE = '#173038';
    const puff = f === 2;
    const bob = f === 1 ? 1 : 0;                 // flota: sube/baja 1 px
    const R = puff ? 6.6 : f === 0 ? 5.6 : 5.9;  // radio de la burbuja
    const cy = 8 + (puff ? -0.5 : bob * 0.5);
    // contorno + masa translúcida
    disc(x, 8, cy, R, O, 0.85);
    disc(x, 8, cy, R - 1.1, BD, 0.72);
    disc(x, 8, cy, R - 2.2, B, 0.66);
    // MEMBRANA ONDULANTE: lóbulos del borde que giran por frame
    x.globalAlpha = 0.85;
    const lob = puff
      ? [[0, -1], [0, 1], [-1, 0], [1, 0]]        // tenso: 4 lóbulos simétricos
      : f === 0
        ? [[-0.7, -0.7], [0.7, 0.7]]              // cresta NO
        : [[0.7, -0.7], [-0.7, 0.7]];             // cresta SE
    for (const [lx, ly] of lob) {
      disc(x, 8 + lx * (R - 0.6), cy + ly * (R - 0.6), 1.4, BD, 0.9);
    }
    // núcleo interior (espiral de marea) — gira con el frame
    x.globalAlpha = 0.55;
    if (f === 0) { rc(x, 7, 6, 2, 1, B); rc(x, 9, 8, 1, 2, B); }
    else if (f === 1) { rc(x, 7, 9, 2, 1, B); rc(x, 6, 6, 1, 2, B); }
    else { rc(x, 6, 7, 4, 1, B); rc(x, 7, 9, 2, 1, B); } // hinchado: cruz de tensión
    // brillo (espalda superior)
    x.globalAlpha = 0.92;
    rc(x, 5, 4 + bob - (puff ? 1 : 0), 3, 2, HL);
    rc(x, 4, 5 + bob, 1, 1, HL);
    x.globalAlpha = 0.55;
    rc(x, 9, 5 + bob, 1, 2, HL);
    // ojo oscuro pequeño (con brillo)
    x.globalAlpha = 1;
    rc(x, 9, 7 + bob, 2, 2, EYE);
    rc(x, 9, 7 + bob, 1, 1, '#ffffff');
    // f2: destello de carga alrededor del ojo
    if (puff) { x.globalAlpha = 0.8; rc(x, 8, 6, 1, 1, '#ffffff'); x.globalAlpha = 1; }
    // burbujitas de espuma en la base
    x.globalAlpha = 0.7;
    rc(x, 3, 12, 2, 2, B);
    rc(x, 11, 12 + (puff ? 0 : bob), 2, 1, B);
    rc(x, 7, 13, 1, 1, HL);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Espectro sin Nombre (16×16 · 3 frames) ----------------
// Fantasma humanoide pálido con TRANSPARENCIA INTERNA ANIMADA:
// los huecos internos (vacíos del pecho) se desplazan y titilan
// entre frames. f2 = FASE ESPECTRAL (e.invulT>0): cuerpo muy
// translúcido, contorno roto y ojos encendidos.
// Frames: 0 flotar A · 1 flotar B · 2 fase espectral.

function buildEspectro(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = cv(16, 16);
    const O = '#3a4a5e', B = '#c9d4e4', S = '#a2b2c8', EYE = '#232e42';
    const phase = f === 2;
    const dy = f === 1 ? -1 : 0;                 // sube/baja
    if (phase) {
      // ---- FASE ESPECTRAL: casi fuera del mundo ----
      x.globalAlpha = 0.4;
      rc(x, 4, 7 + dy, 8, 5, B);
      rc(x, 5, 11 + dy, 6, 3, B);
      x.globalAlpha = 0.7;
      rc(x, 5, 2 + dy, 6, 5, B);
      rc(x, 4, 3 + dy, 8, 3, B);
      // contorno ROTO (solo Fragmentos)
      x.globalAlpha = 0.5;
      rc(x, 4, 2 + dy, 3, 1, O); rc(x, 9, 2 + dy, 3, 1, O);
      rc(x, 4, 3 + dy, 1, 4, O); rc(x, 11, 4 + dy, 1, 3, O);
      // jirones alargados
      x.globalAlpha = 0.35;
      rc(x, 5, 13 + dy, 1, 3, B); rc(x, 8, 13 + dy, 2, 2, B); rc(x, 11, 12 + dy, 1, 3, B);
      // ojos encendidos
      x.globalAlpha = 1;
      rc(x, 6, 4 + dy, 1, 2, '#8ef0ff');
      rc(x, 9, 4 + dy, 1, 2, '#8ef0ff');
      x.globalAlpha = 0.6;
      rc(x, 6, 3 + dy, 1, 1, '#d8f8ff'); rc(x, 9, 3 + dy, 1, 1, '#d8f8ff');
      x.globalAlpha = 1;
      frames.push(c);
      continue;
    }
    // ---- frames de patrulla 0/1 ----
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
    // TRANSPARENCIA INTERNA ANIMADA: huecos del pecho que derivan
    x.globalAlpha = f === 0 ? 0.5 : 0.35;
    rc(x, 6 + f, 8 + dy, 2, 2, O);               // hueco mayor deriva →
    x.globalAlpha = f === 0 ? 0.3 : 0.5;
    rc(x, 9 - f, 9 + dy, 1, 2, O);               // hueco menor deriva ←
    x.globalAlpha = 0.22;
    rc(x, 5, 10 + dy, 1, 1, O);                  // vaho bajo
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

// ---------------- Arpía de Cumbre (16×16 · 3 frames) ----------------
// Ave de ventisca con ALETEO DE 3 FASES: f0 alas ARRIBA (apex del
// ascenso), f1 alas ABAJO (apex del descenso) — el ciclo que
// entityFrame alterna al volar — y f2 alas PLENAS (planeo, para el
// picado 'carga'): cuerpo estirado y remiges rígidas.
// Frames: 0 alas arriba · 1 alas abajo · 2 planeo.

function buildArpi(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = cv(16, 16);
    const O = '#2e4256', W = '#eef6fc', WS = '#bcdcf0', WSD = '#8fb8d8', BK = '#8a94a0', EYE = '#1e2c3a';
    const glide = f === 2;
    const bodyY = glide ? 7 : f === 0 ? 7 : 8;   // el cuerpo sube con el aleteo
    // ---- alas ----
    x.globalAlpha = 1;
    if (f === 0) {
      // alzadas (v hacia arriba)
      rc(x, 3, 1, 3, 5, WS); rc(x, 2, 2, 2, 5, WS); rc(x, 4, 0, 2, 2, W);
      rc(x, 10, 1, 3, 5, WS); rc(x, 12, 2, 2, 5, WS); rc(x, 10, 0, 2, 2, W);
      rc(x, 3, 2, 1, 3, W); rc(x, 12, 2, 1, 3, W);      // brillo de pluma
    } else if (f === 1) {
      // abatidas (v hacia abajo)
      rc(x, 2, 10, 3, 4, WS); rc(x, 1, 12, 2, 3, WS); rc(x, 3, 9, 2, 1, W);
      rc(x, 11, 10, 3, 4, WS); rc(x, 13, 12, 2, 3, WS); rc(x, 11, 9, 2, 1, W);
      rc(x, 2, 11, 1, 2, W); rc(x, 13, 11, 1, 2, W);
    } else {
      // plenas (horizontales, planeo)
      rc(x, 1, 6, 5, 2, WS); rc(x, 0, 6, 2, 1, W); rc(x, 2, 8, 3, 1, WSD);
      rc(x, 10, 6, 5, 2, WS); rc(x, 14, 6, 2, 1, W); rc(x, 11, 8, 3, 1, WSD);
      rc(x, 1, 6, 4, 1, W); rc(x, 11, 6, 4, 1, W);
    }
    // ---- cola ----
    rc(x, glide ? 1 : 2, bodyY + 2, 3, 2, WSD);
    rc(x, glide ? 0 : 1, bodyY + 3, 1, 1, WSD);
    // ---- cuerpo ----
    rc(x, 5, bodyY, 6, 4, W);
    rc(x, 6, bodyY - 1, 4, 6, W);
    rc(x, 5, bodyY + 3, 6, 1, WS);
    rc(x, 6, bodyY + 4, 4, 1, WS);
    if (glide) rc(x, 6, bodyY + 5, 4, 1, WSD);    // garras recogidas en el picado
    // ---- cabeza + pico gris ----
    rc(x, 9, bodyY - 3, 4, 4, W);
    rc(x, 9, bodyY, 4, 1, WS);
    rc(x, 13, bodyY - 2, 2, 2, BK);
    rc(x, 15, bodyY - 1, 1, 1, BK);
    rc(x, 11, bodyY - 2, 1, 1, EYE);
    // ---- contorno sutil ----
    x.globalAlpha = 0.5;
    rc(x, 5, bodyY - 1, 4, 1, O);
    rc(x, 9, bodyY - 3, 4, 1, O);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ============================================================
// JEFAS DE ZONA (36×36) — REHECHAS 18-c
// ============================================================

// ---------------- SIRENA ABISAL (36×36 · 5 frames · JEFA) ----------------
// REINA DEL NAUFRAGIO: piel abisal pálida-verdosa con
// bioluminiscencia (lunares que brillan), melena que fluye como
// marea (los mechones cambian de orilla por frame), COLA DE ESPUMA
// con aleta en abanico y borde de espuma, y CORONA DE NAUFRAGIO:
// tablones rotos de un casco (madera + clavos dorados + balanos).
// Debe verse REGIA y triste: mirada baja, boca mínima, perlas.
//
// Frames: 0 flotar A (marea a babor, aleta babor arriba) ·
//         1 flotar B (marea a estribor, bob +1px) ·
//         2 TELEGRAPH: se HINCHA (tórax ancho), brazos abiertos,
//           halo bioluminiscente, boca en O ·
//         3 ATTACK: LÁTIGO DE AGUA (brazo alzado, arco de agua
//           con cresta de espuma a estribor) ·
//         4 SUMERGIDA (e.invulT>0): solo busto y corona sobre la
//           línea de agua, anillos y burbujas.

function buildSirena(): Frames {
  const HAIR = '#1f5a5c', HAIR2 = '#3f9a8c', HAIR3 = '#8fe8d0',
    SKIN = '#cfe8dc', SKINS = '#a3c4b4',
    GLOW = '#8ff2d8', GLOW2 = '#d8fff2',
    WOOD = '#6d4a2a', WOODD = '#4a3018', GOLD = '#f0c84a', ROPE = '#9a7a4a', BARN = '#e4e0d0',
    TOP = '#2e7a6e', TOPTRIM = '#dceee6',
    TAIL = '#2e8a7a', TAIL2 = '#48b09a', FIN = '#5fd0b4', FIN2 = '#8fe8d0',
    FOAM = '#eef8f4', EYE = '#123a3e', IRIS = '#8ff2d8',
    AQUA = '#4fb8d8', AQUAD = '#2e88b8',
    WATER = '#3f8ab8', WATERD = '#2e6a94';
  const frames: Frames = [];
  for (let f = 0; f < 5; f++) {
    const { c, x } = cv(36, 36);

    // ════════ frame 4 · SUMERGIDA ════════
    if (f === 4) {
      // silueta de la cola bajo el agua (muy tenue)
      x.globalAlpha = 0.16;
      rc(x, 12, 20, 12, 6, TAIL);
      rc(x, 13, 26, 10, 3, TAIL2);
      rc(x, 8, 29, 8, 3, FIN); rc(x, 20, 29, 8, 3, FIN);
      x.globalAlpha = 1;
      // busto y corona sobre el agua
      const hy = 6;
      // corona de naufragio
      rc(x, 11, 5, 14, 1, ROPE);
      rc(x, 11, 1, 3, 4, WOOD); rc(x, 13, 1, 1, 4, WOODD); rc(x, 12, 2, 1, 1, GOLD);
      rc(x, 16, 2, 2, 3, WOODD); rc(x, 17, 1, 1, 1, WOOD);
      rc(x, 22, 1, 3, 4, WOOD); rc(x, 24, 1, 1, 4, WOODD); rc(x, 23, 2, 1, 1, GOLD);
      rc(x, 10, 4, 1, 1, BARN); rc(x, 25, 4, 1, 1, BARN); rc(x, 15, 4, 1, 1, BARN);
      // melena flotando EN el agua (extendida a ambas orillas)
      x.globalAlpha = 0.9;
      rc(x, 8, hy, 4, 6, HAIR);
      rc(x, 24, hy, 4, 6, HAIR);
      x.globalAlpha = 0.6;
      rc(x, 5, hy + 4, 4, 2, HAIR2); rc(x, 27, hy + 4, 4, 2, HAIR2);
      rc(x, 4, hy + 6, 2, 1, HAIR3); rc(x, 30, hy + 6, 2, 1, HAIR3);
      x.globalAlpha = 1;
      // cabeza (hasta las mejillas)
      rc(x, 13, hy, 10, 8, SKIN);
      rc(x, 12, hy, 12, 2, HAIR2);
      rc(x, 12, hy + 2, 3, 1, HAIR2); rc(x, 21, hy + 2, 3, 1, HAIR2);
      rc(x, 14, hy + 3, 2, 2, EYE); rc(x, 20, hy + 3, 2, 2, EYE);
      rc(x, 14, hy + 3, 1, 1, IRIS); rc(x, 20, hy + 3, 1, 1, IRIS);
      x.globalAlpha = 0.85;
      rc(x, 12, hy + 4, 1, 1, GLOW); rc(x, 23, hy + 3, 1, 1, GLOW);
      x.globalAlpha = 1;
      rc(x, 17, hy + 7, 2, 1, '#6a8a80');
      // hombros asomando
      rc(x, 13, 14, 10, 2, SKIN);
      rc(x, 14, 15, 1, 1, GLOW);
      // ═══ línea de agua ═══
      x.globalAlpha = 0.8;
      rc(x, 6, 16, 24, 1, WATER);
      x.globalAlpha = 0.65;
      rc(x, 5, 17, 26, 2, WATERD);
      x.globalAlpha = 0.9;
      rc(x, 8, 16, 3, 1, FOAM); rc(x, 14, 16, 2, 1, FOAM);
      rc(x, 21, 17, 3, 1, FOAM); rc(x, 27, 16, 2, 1, FOAM);
      // anillos concéntricos
      x.globalAlpha = 0.4;
      rc(x, 3, 18, 5, 1, '#bfe4ea'); rc(x, 28, 19, 5, 1, '#bfe4ea');
      // burbujas ascendiendo
      x.globalAlpha = 0.75;
      rc(x, 10, 13, 1, 1, FOAM); rc(x, 25, 12, 1, 1, FOAM); rc(x, 17, 11, 1, 1, FOAM);
      x.globalAlpha = 1;
      frames.push(c);
      continue;
    }

    const bob = f === 1 ? 1 : 0;                 // flotar B baja 1 px
    const sway = f === 0 ? 1 : -1;               // marea: f0 a babor, f1 a estribor
    const inflate = f === 2;                     // telegraph
    const whip = f === 3;                        // ataque
    const hy = 6 + bob;                          // top de la cabeza
    const ty = 16 + bob;                         // top del tórax/vestido
    const tyy = ty + 5;                          // top de la cola
    const fl = tyy + 8;                          // base de la aleta

    // ════════ MELENA TRASERA (masa de marea) ════════
    x.globalAlpha = 0.95;
    rc(x, 10, hy - 2, 16, 15, HAIR);
    // mechones laterales: la marea cambia de orilla por frame
    if (sway > 0) {
      rc(x, 6, hy, 2, 13, HAIR);                 // mechón babor desbordado
      rc(x, 27, hy, 2, 13, HAIR);
    } else {
      rc(x, 8, hy, 2, 13, HAIR);
      rc(x, 28, hy, 2, 13, HAIR);                // mechón estribor desbordado
    }
    x.globalAlpha = 0.6;
    // puntas que ondean (opuestas al mechón)
    rc(x, 5, hy + 11 + (sway > 0 ? 1 : 0), 3, 4, HAIR2);
    rc(x, 28, hy + 11 - (sway > 0 ? 1 : 0), 3, 4, HAIR2);
    // mechones frontales sobre los hombros
    x.globalAlpha = 0.8;
    rc(x, 7, hy + 8 + sway, 3, 6, HAIR2);
    rc(x, 26, hy + 8 - sway, 3, 6, HAIR2);
    // puntas bioluminiscentes
    x.globalAlpha = 0.8;
    rc(x, 6, hy + 15 + (sway > 0 ? 1 : 0), 1, 1, HAIR3);
    rc(x, 29, hy + 15 - (sway > 0 ? 1 : 0), 1, 1, HAIR3);
    x.globalAlpha = 1;

    // ════════ HALO DE CARGA (solo telegraph) ════════
    if (inflate) disc(x, 17.5, 18, 13.5, GLOW, 0.2);

    // ════════ COLA DE ESPUMA ════════
    rc(x, 11, tyy, 14, 3, TAIL);                 // caderas
    rc(x, 12, tyy + 3, 12, 2, TAIL);
    rc(x, 13, tyy + 5, 10, 2, TAIL2);
    rc(x, 14, tyy + 7, 8, 1, TAIL2);
    // aleta en abanico: babor/arriba · estribor/abajo (flanquean por frame)
    const lobeL = whip ? 1 : inflate ? 0 : f === 0 ? 0 : 1;
    const lobeR = whip ? 1 : inflate ? 0 : 1 - lobeL;
    rc(x, 12, fl, 12, 2, FIN);                   // base de la aleta
    rc(x, 5, fl - 1 + lobeL, 8, 3, FIN);         // lóbulo babor
    rc(x, 3, fl + lobeL, 3, 2, FIN2);
    rc(x, 23, fl - 1 + lobeR, 8, 3, FIN);        // lóbulo estribor
    rc(x, 30, fl + lobeR, 3, 2, FIN2);
    // borde de espuma
    x.globalAlpha = 0.9;
    rc(x, 3, fl + lobeL, 3, 1, FOAM);
    rc(x, 30, fl + lobeR, 3, 1, FOAM);
    rc(x, 6, fl - 1 + lobeL, 2, 1, FOAM);
    rc(x, 28, fl - 1 + lobeR, 2, 1, FOAM);
    x.globalAlpha = 1;
    // escamas de brillo
    x.globalAlpha = 0.7;
    rc(x, 13 + (sway > 0 ? 1 : 0), tyy + 1, 2, 1, TAIL2);
    rc(x, 18, tyy + 4, 2, 1, '#cfeee6');
    rc(x, 15, tyy + 6, 2, 1, FIN2);
    x.globalAlpha = 1;
    // LUNARES BIOLUMINISCENTES de la cola (derivan 1px con la marea)
    x.globalAlpha = 0.85;
    rc(x, 12 + (sway > 0 ? 1 : 0), tyy + 2, 1, 1, GLOW);
    rc(x, 22 - (sway > 0 ? 1 : 0), tyy + 3, 1, 1, GLOW);
    rc(x, 16, tyy + 6, 1, 1, GLOW2);
    rc(x, 19, tyy + 1, 1, 1, GLOW2);
    x.globalAlpha = 1;

    // ════════ CORONA DE NAUFRAGIO ════════
    rc(x, 11, hy - 1, 14, 1, ROPE);              // banda de cuerda
    rc(x, 11, hy - 5, 3, 4, WOOD);               // tablón babor
    rc(x, 13, hy - 5, 1, 4, WOODD);
    rc(x, 12, hy - 4, 1, 1, GOLD);               // clavo dorado
    rc(x, 16, hy - 4, 2, 3, WOODD);              // tablón central ROTO
    rc(x, 17, hy - 5, 1, 1, WOOD);               // astilla
    rc(x, 22, hy - 5, 3, 4, WOOD);               // tablón estribor
    rc(x, 24, hy - 5, 1, 4, WOODD);
    rc(x, 23, hy - 4, 1, 1, GOLD);
    rc(x, 10, hy - 2, 1, 1, BARN); rc(x, 25, hy - 2, 1, 1, BARN); rc(x, 15, hy - 2, 1, 1, BARN);
    if (inflate) { x.globalAlpha = 0.9; rc(x, 12, hy - 5, 1, 1, '#fff3c8'); rc(x, 23, hy - 5, 1, 1, '#fff3c8'); x.globalAlpha = 1; }

    // ════════ ROSTRO ════════
    rc(x, 13, hy, 10, 8, SKIN);
    rc(x, 13, hy + 6, 10, 2, SKINS);             // mandíbula en sombra
    rc(x, 12, hy + 1, 1, 6, SKINS); rc(x, 23, hy + 1, 1, 6, SKINS);
    // flequillo de agua partido
    rc(x, 12, hy, 12, 2, HAIR2);
    rc(x, 12, hy + 2, 3, 1, HAIR2); rc(x, 21, hy + 2, 3, 1, HAIR2);
    // ojos tristes (párpado caído) / encendidos en telegraph / rasgados al atacar
    rc(x, 14, hy + 2, 2, 1, SKINS); rc(x, 20, hy + 2, 2, 1, SKINS);
    if (whip) {
      rc(x, 14, hy + 3, 2, 1, IRIS); rc(x, 20, hy + 3, 2, 1, IRIS);   // rasgados
    } else {
      rc(x, 14, hy + 3, 2, 2, EYE); rc(x, 20, hy + 3, 2, 2, EYE);
      rc(x, 14, hy + 3, 1, 1, IRIS); rc(x, 20, hy + 3, 1, 1, IRIS);
    }
    // boca mínima / O de canto
    if (inflate) {
      rc(x, 16, hy + 7, 3, 2, '#123a3e');
      x.globalAlpha = 0.85; rc(x, 17, hy + 7, 1, 1, GLOW); x.globalAlpha = 1;
    } else {
      rc(x, 17, hy + 7, 2, 1, '#6a8a80');
    }
    // lágrima de perla (solo en patrulla: su tristeza reposada)
    if (!inflate && !whip) rc(x, 15, hy + 5, 1, 1, '#bfe8f0');
    // lunares del rostro
    x.globalAlpha = 0.85;
    rc(x, 12, hy + 4, 1, 1, GLOW); rc(x, 23, hy + 3, 1, 1, GLOW); rc(x, 16, hy + 1, 1, 1, GLOW2);
    x.globalAlpha = 1;

    // ════════ BUSTO ════════
    rc(x, 15, hy + 8, 6, 2, SKIN);               // cuello
    rc(x, inflate ? 10 : 12, ty, inflate ? 16 : 12, 1, SKIN);   // hombros
    const dw = inflate ? 16 : 14, dx0 = inflate ? 10 : 11;
    rc(x, dx0, ty + 1, dw, 4, TOP);              // vestido de marea
    rc(x, dx0, ty + 1, dw, 1, TOPTRIM);          // ribete de perla
    rc(x, dx0, ty + 4, dw, 1, '#256a60');
    // collar de perlas
    rc(x, 14, ty + 2, 1, 1, TOPTRIM); rc(x, 16, ty + 3, 1, 1, TOPTRIM);
    rc(x, 19, ty + 3, 1, 1, TOPTRIM); rc(x, 21, ty + 2, 1, 1, TOPTRIM);

    // ════════ BRAZOS (pose por frame) ════════
    if (inflate) {
      // abiertos en cruz alta (telegraph)
      rc(x, 7, ty, 2, 4, SKIN); rc(x, 5, ty - 5, 2, 5, SKIN);
      rc(x, 3, ty - 7, 4, 2, FIN2);              // mano palmeada
      rc(x, 27, ty, 2, 4, SKIN); rc(x, 29, ty - 5, 2, 5, SKIN);
      rc(x, 29, ty - 7, 4, 2, FIN2);
      x.globalAlpha = 0.8;
      rc(x, 4, ty - 8, 2, 1, GLOW2); rc(x, 30, ty - 8, 2, 1, GLOW2);
      x.globalAlpha = 1;
    } else if (whip) {
      // brazo alzado a estribor (látigo) + babor retrasado
      rc(x, 25, ty, 2, 4, SKIN); rc(x, 27, ty - 4, 2, 4, SKIN); rc(x, 27, ty - 6, 2, 2, SKIN);
      rc(x, 8, ty + 1, 2, 6, SKINS);
      // LÁTIGO DE AGUA: arco desde la mano
      rc(x, 29, 8, 2, 2, AQUA);
      rc(x, 31, 9, 2, 3, AQUA);
      rc(x, 33, 11, 2, 3, AQUAD);
      rc(x, 32, 14, 3, 2, AQUAD);
      rc(x, 30, 16, 3, 2, AQUA);
      rc(x, 28, 18, 2, 2, AQUA);
      rc(x, 26, 20, 2, 2, AQUAD);                // punta
      x.globalAlpha = 0.9;                       // cresta de espuma
      rc(x, 29, 7, 2, 1, FOAM); rc(x, 31, 8, 2, 1, FOAM); rc(x, 32, 13, 3, 1, FOAM);
      x.globalAlpha = 0.6;                       // gotas desprendidas
      rc(x, 34, 15, 1, 1, AQUA); rc(x, 29, 21, 1, 1, AQUA); rc(x, 33, 6, 1, 1, FOAM);
      x.globalAlpha = 0.3;                       // estela
      rc(x, 34, 12, 1, 5, '#bfe8f0');
      x.globalAlpha = 1;
    } else {
      // flotar: a lo largo del cuerpo, manos con destello
      rc(x, 9, ty, 2, 8, SKIN); rc(x, 9, ty, 1, 8, SKINS);
      rc(x, 25, ty, 2, 8, SKIN); rc(x, 26, ty, 1, 8, SKINS);
      x.globalAlpha = 0.8;
      rc(x, 9, ty + 8, 2, 1, GLOW); rc(x, 25, ty + 8, 2, 1, GLOW);
      x.globalAlpha = 1;
    }

    // ════════ AURA DE BRUMA MARINA ════════
    x.globalAlpha = 0.15;
    rc(x, 4, hy + 2, 2, 14, FIN2);
    rc(x, 30, hy + 2, 2, 14, FIN2);
    x.globalAlpha = 0.7;                         // burbujas
    rc(x, 5, hy + 9 + sway, 1, 1, FOAM);
    rc(x, 30, hy + 8 - sway, 1, 1, FOAM);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- GÓLEM DE ESCARCHA (36×36 · 5 frames · JEFA) ----------------
// COLOSO DE HIELO ESTRATIFICADO: torso de bandas de hielo sedimentado
// (estratos alternos), hombros-bloque con cristales, brazos colosales
// y NÚCLEO LUMINOSO que pulsa. Las grietas se acentúan con la fase.
//
// Frames: 0 andar A (hombro babor alzado, pierna babor planta) ·
//         1 andar B (espejo) ·
//         2 TELEGRAPH: brazos EN ALTO, núcleo encendido + halo ·
//         3 ATTACK: SMASH (puños al suelo, esquirlas, onda) ·
//         4 AGRIETADO (fase 3): grietas abiertas con glow cian y
//           esquirla perdida del hombro — usar de base de reposo.

function buildGolem(): Frames {
  const O = '#1c3048',
    ICE = '#7ea8cc', ICED = '#5a86b0', ICEDD = '#456e96', L = '#a8cce8',
    XT = '#c8e4f4', SNOW = '#eef6fc', CRK = '#2c4666',
    STRATA = ['#82acce', '#6f9cc4', '#5a86b0', '#6f9cc4', '#82acce'],
    CORE = '#3ec8e8', CORE2 = '#8ef0ff', CORED = '#1c5a7a';
  const rnd = mulberry32(0x6e1ce);               // semilla fija · escarcha
  const frames: Frames = [];
  for (let f = 0; f < 5; f++) {
    const { c, x } = cv(36, 36);
    const cracked = f === 4;
    const tel = f === 2;
    const smash = f === 3;
    const dy = smash ? 1 : 0;                    // el smash agacha el cuerpo
    const tiltL = f === 0 || cracked ? 1 : 0;    // balanceo lento del andar
    const tiltR = 1 - tiltL;

    // ════════ TORSO ESTRATIFICADO ════════
    rc(x, 8, 10 + dy, 20, 16, ICE);
    for (let i = 0; i < 5; i++) rc(x, 8, 10 + dy + i * 3, 20, 3, STRATA[i]);
    rc(x, 8, 10 + dy, 20, 1, L);                 // filo superior nevado
    rc(x, 8, 25 + dy, 20, 1, ICED);              // base
    if (cracked) rc(x, 8, 25 + dy, 20, 1, '#3a5a7c');

    // ════════ GRIETAS (crecen con la fase: patrulla < telegraph/smash < agrietado) ════════
    const crack = (cx: number, cy0: number, len: number, glow: boolean) => {
      let cxx = cx;
      for (let i = 0; i < len; i++) {
        rc(x, cxx, cy0 + i, 1, 1, CRK);
        if (glow && i > 0 && i < len - 1) { x.globalAlpha = 0.55; rc(x, cxx + 1, cy0 + i, 1, 1, CORE); x.globalAlpha = 1; }
        const rr = rnd();
        if (rr > 0.62) cxx += rr > 0.81 ? 1 : -1;  // quiebro determinista
      }
    };
    // grietas base (siempre)
    crack(10, 12 + dy, 4, tel || smash);
    crack(26, 11 + dy, 3, tel || smash);
    crack(19, 22 + dy, 4, tel || smash || cracked);
    // grietas extra del coloso herido (fase 3)
    if (cracked) {
      crack(14, 10 + dy, 6, true);
      crack(23, 14 + dy, 5, true);
      crack(9, 19 + dy, 4, true);
      crack(21, 10 + dy, 3, true);
      rc(x, 6, 15 + dy, 3, 1, CRK); rc(x, 27, 18 + dy, 3, 1, CRK);   // grietas de hombros
    }

    // ════════ NÚCLEO LUMINOSO ════════
    if (tel) disc(x, 17.5, 17.5 + dy, 8.5, CORE2, 0.3);           // halo de carga
    rc(x, 12, 14 + dy, 10, 7, CORED);            // engaste
    if (smash) {
      rc(x, 13, 15 + dy, 8, 5, CORE);            // estalla en blanco
      rc(x, 14, 16 + dy, 6, 3, '#ffffff');
    } else if (cracked) {
      rc(x, 14, 15 + dy, 6, 4, '#2aa8c8');       // núcleo apagado
      rc(x, 15, 16 + dy, 3, 2, CORE);
      x.globalAlpha = 0.7; rc(x, 16, 16 + dy, 1, 1, CRK); x.globalAlpha = 1;  // núcleo agrietado
    } else {
      rc(x, 13, 15 + dy, 8, 5, CORE);
      rc(x, 15, 16 + dy, 4, 3, CORE2);
      if (f === 1) disc(x, 16.5, 17 + dy, 3.5, CORE2, 0.35);      // pulso del andar
    }

    // ════════ CABEZA HUNDIDA ════════
    rc(x, 13, 4 + dy, 10, 6, ICE);
    rc(x, 13, 4 + dy, 10, 1, L);
    rc(x, 13, 9 + dy, 10, 1, ICED);
    if (cracked) { rc(x, 16, 4 + dy, 1, 3, CRK); }
    if (smash) { rc(x, 15, 6 + dy, 2, 1, '#ffffff'); rc(x, 19, 6 + dy, 2, 1, '#ffffff'); }
    else if (cracked) { rc(x, 15, 6 + dy, 1, 1, '#2aa8c8'); rc(x, 19, 6 + dy, 1, 1, '#2aa8c8'); }
    else { rc(x, 15, 6 + dy, 2, 1, CORE); rc(x, 19, 6 + dy, 2, 1, CORE); }
    if (tel) { x.globalAlpha = 0.85; rc(x, 15, 5 + dy, 2, 1, CORE2); rc(x, 19, 5 + dy, 2, 1, CORE2); x.globalAlpha = 1; }

    // ════════ HOMBROS CON CRISTALES ════════
    const syL = 8 - tiltL + dy, syR = 8 - tiltR + dy;
    rc(x, 2, syL, 9, 6, ICED); rc(x, 2, syL, 9, 1, L);
    rc(x, 4, syL - 3, 3, 3, XT); rc(x, 5, syL - 4, 2, 1, SNOW);     // cristal babor
    rc(x, 2, syL - 1, 2, 2, XT);
    rc(x, 25, syR, 9, 6, ICED); rc(x, 25, syR, 9, 1, L);
    rc(x, 29, syR - 3, 3, 3, XT); rc(x, 29, syR - 4, 2, 1, SNOW);   // cristal estribor
    rc(x, 32, syR - 1, 2, 2, XT);
    // nieve posada
    rc(x, 3, syL, 4, 1, SNOW); rc(x, 26, syR, 4, 1, SNOW);
    if (cracked) {
      // ESQUIRLA PERDIDA del hombro estribor: muesca oscura
      rc(x, 30, syR + 2, 3, 2, '#0e1c2c');
      rc(x, 29, syR + 3, 2, 1, CRK);
      rc(x, 33, syR - 2, 1, 2, XT);            // cristal roto residual
    }

    // ════════ BRAZOS COLOSALES (pose por frame) ════════
    if (tel) {
      // EN ALTO: puños sobre los cristales
      rc(x, 2, 2, 5, 10, ICED); rc(x, 2, 2, 1, 10, L);
      rc(x, 1, 0, 7, 3, ICEDD); rc(x, 1, 0, 7, 1, L);
      rc(x, 29, 2, 5, 10, ICED); rc(x, 33, 2, 1, 10, '#3a5a7c');
      rc(x, 28, 0, 7, 3, ICEDD); rc(x, 28, 0, 7, 1, L);
      x.globalAlpha = 0.8; rc(x, 2, 1, 2, 1, SNOW); rc(x, 31, 1, 2, 1, SNOW); x.globalAlpha = 1;
    } else if (smash) {
      // SMASH: puños estrellados en el suelo (1px más abajo y anchos)
      rc(x, 1, 14, 5, 11, ICED); rc(x, 1, 14, 1, 11, L);
      rc(x, 0, 25, 8, 6, ICEDD); rc(x, 0, 25, 8, 1, L);
      rc(x, 30, 14, 5, 11, ICED); rc(x, 34, 14, 1, 11, '#3a5a7c');
      rc(x, 28, 25, 8, 6, ICEDD); rc(x, 28, 25, 8, 1, L);
      // esquirlas del impacto
      x.globalAlpha = 0.95;
      rc(x, 0, 32, 2, 1, SNOW); rc(x, 4, 33, 2, 1, XT); rc(x, 8, 32, 2, 1, SNOW);
      rc(x, 27, 33, 2, 1, XT); rc(x, 31, 32, 2, 1, SNOW); rc(x, 34, 31, 1, 1, SNOW);
      x.globalAlpha = 0.4;                     // onda de polvo de nieve
      rc(x, 0, 34, 36, 1, L);
      x.globalAlpha = 1;
    } else {
      // andar: puños que se mecen con el balanceo
      rc(x, 1, 13 + tiltL, 5, 11, ICED); rc(x, 1, 13 + tiltL, 1, 11, L);
      rc(x, 0, 23 + tiltL, 7, 5, ICEDD); rc(x, 0, 23 + tiltL, 7, 1, L);
      rc(x, 30, 13 + tiltR, 5, 11, ICED); rc(x, 34, 13 + tiltR, 1, 11, '#3a5a7c');
      rc(x, 29, 23 + tiltR, 7, 5, ICEDD); rc(x, 29, 23 + tiltR, 7, 1, L);
    }

    // ════════ PATA-BLOQUE Y ESCARCHA BASE ════════
    if (!smash) {
      const stepL = f === 1 && !cracked ? 1 : 0;                 // alterna el paso
      const stepR = 1 - stepL;
      rc(x, 9, 26 + dy + stepL, 7, 6 - stepL, ICEDD);            // planta/ligera
      rc(x, 19, 26 + dy + stepR, 7, 6 - stepR, ICEDD);
      rc(x, 9, 31 + dy, 7, 1, '#3a5a7c'); rc(x, 19, 31 + dy, 7, 1, '#3a5a7c');
      rc(x, 8, 32 + dy, 9, 1, SNOW); rc(x, 18, 32 + dy, 9, 1, SNOW);
      // vaho de escarcha (determinista, 3 copos por frame)
      x.globalAlpha = 0.8;
      for (let i = 0; i < 3; i++) {
        const fx = 6 + Math.floor(rnd() * 26), fy = 30 + Math.floor(rnd() * 3);
        rc(x, fx, fy, 1, 1, SNOW);
      }
      x.globalAlpha = 1;
      if (cracked) rc(x, 12, 27 + dy, 1, 4, CRK);                // grieta de pata
    }

    // ════════ CONTORNO MÍNIMO ════════
    x.globalAlpha = 0.55;
    rc(x, 0, 28, 7, 1, O); rc(x, 29, 28, 7, 1, O);
    if (smash) { rc(x, 0, 30, 8, 1, O); rc(x, 28, 30, 8, 1, O); }
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ============================================================
// PROYECTILES (12×12 · 2 frames · pulso sutil — en pantalla los
// anima drawExpansionProjectile; los frames son el fallback)
// ============================================================

function buildOrb(): Frames {
  const out: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(12, 12);
    disc(x, 6, 6, 5, '#2e78b8', 0.9);            // borde de agua profunda
    disc(x, 6, 6, 4.1, '#58a8e0', 0.82);
    disc(x, 6, 6, 2.6, '#9ad0f0', 0.8);
    x.globalAlpha = 1;
    rc(x, 4 - f, 3, 2, 2, '#f4fbff');            // brillo que deriva
    rc(x, 8 + f, 9, 1, 1, '#2e78b8');
    if (f === 1) { x.globalAlpha = 0.5; rc(x, 3, 8, 1, 1, '#d8f0ff'); x.globalAlpha = 1; }
    out.push(c);
  }
  return out;
}

function buildShard(): Frames {
  const out: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(12, 12);
    // rombo afilado vertical (f1: 1px más estrecho = latido)
    const inx = f;
    const rows: [number, number, number][] = [
      [0, 5, 2], [1, 4, 4], [2, 4, 4], [3, 3, 6], [4, 3, 6],
      [5, 2, 8], [6, 2, 8], [7, 3, 6], [8, 3, 6], [9, 4, 4], [10, 4, 4], [11, 5, 2],
    ];
    for (const [y, x0, w] of rows) {
      const rx0 = x0 + (w >= 6 ? inx : 0), rw = Math.max(2, w - (w >= 6 ? inx * 2 : 0));
      rc(x, rx0, y, rw, 1, rw <= 2 ? '#dff4fc' : '#9fd4ec');
      if (rw >= 6) { rc(x, rx0, y, 1, 1, '#5aa8cc'); rc(x, rx0 + rw - 1, y, 1, 1, '#5aa8cc'); }
    }
    rc(x, 5, 2, 1, 6, '#eaf8ff');                // filo de luz
    rc(x, 6, 3, 1, 3, '#ffffff');
    out.push(c);
  }
  return out;
}

function buildNota(): Frames {
  const out: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = cv(12, 12);
    // halo + corchea pixelada blanco-azulada (f1: banderín a babor)
    disc(x, 6, 6, 5, '#bfe0ff', f === 0 ? 0.25 : 0.35);
    x.globalAlpha = 1;
    rc(x, 3, 8, 3, 2, '#e8f4ff');                // cabeza de la nota
    rc(x, 3, 9, 3, 1, '#9fc8e8');
    rc(x, 6, 2, 1, 7, '#e8f4ff');                // mástil
    if (f === 0) {
      rc(x, 7, 2, 2, 1, '#e8f4ff');              // banderín (corchea)
      rc(x, 8, 3, 1, 2, '#cfe6fa');
    } else {
      rc(x, 4, 2, 2, 1, '#e8f4ff');              // banderín espejo
      rc(x, 4, 3, 1, 2, '#cfe6fa');
    }
    rc(x, 9, 5, 1, 1, '#cfe6fa');
    rc(x, f === 0 ? 10 : 1, 1, 1, 1, '#ffffff'); // destello
    x.globalAlpha = 1;
    out.push(c);
  }
  return out;
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
  // 14-a/18-c (jefes-enemigos): 2 jefes nuevos + 2 enemigos de mapa
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
// 14-a (AGENTE JEFES-ENEMIGOS) · REHECHO EN 18-c — Vult, El Coro
// Roto, Eco Desgarrado y Sátiro con más detalle y poses nuevas.
// ============================================================

// ---------------- Vult, el Cazador Nocturno (32×32 · 4 frames · JEFA) ----
// Cazador de ecos: gabardina verde-niebla, MEDIA MÁSCARA de hueso
// (el rostro que ya no recuerda), pañuelo de eco al viento y GARRAS
// de hueso curvas (ya no dagas: desgarra). Silueta inclinada.
//
// Frames: 0 carrera A (pierna babor adelante, garra baja) ·
//         1 carrera B (espejo, capa alzada) ·
//         2 TELEGRAPH: agachado, garra trasera ALZADA en guadaña,
//           ojos de eco encendidos ·
//         3 ATTACK: EMBESTIDA/ACECHO (estirado al frente, garra
//           delantera extendida, capa y pañuelo a remanguillo).

function buildVult(): Frames {
  const CAP = '#24443a', CAP2 = '#2f5a4a', CAPD = '#16302a',
    MASK = '#e2ecdc', MASKD = '#a8b8a8', SCARF = '#8ef0c0',
    CLAW = '#e6f2ea', CLAWD = '#9cbcb0', EYE = '#b8ffd8',
    BOOT = '#1a2822', BKS = '#12211c';
  const frames: Frames = [];
  for (let f = 0; f < 4; f++) {
    const { c, x } = cv(32, 32);
    const run = f < 2;
    const tel = f === 2;
    const lunge = f === 3;
    const sw = f === 1 ? 1 : 0;                  // vaivén de capa/pañuelo en carrera

    if (run) {
      // ════════ CARRERA (0/1) ════════
      // capa trasera ondeando
      x.globalAlpha = 0.95;
      rc(x, 7 - sw, 9, 6, 13, CAPD);
      x.globalAlpha = 0.55;
      rc(x, 5 - sw, 13 + sw, 3, 6, CAP);
      x.globalAlpha = 1;
      // pañuelo de eco
      rc(x, 21 + sw, 7, 5, 2, SCARF);
      x.globalAlpha = 0.7;
      rc(x, 25 + sw * 2, 6, 4, 2, SCARF);
      x.globalAlpha = 0.45;
      rc(x, 28 + sw * 2, 5, 2, 1, SCARF);
      x.globalAlpha = 1;
      // torso y gabardina
      rc(x, 12, 10, 9, 9, CAP);
      rc(x, 12, 10, 9, 1, CAP2);
      rc(x, 13, 12, 1, 6, CAP2);                 // solapa
      rc(x, 20, 11, 1, 7, CAPD);
      rc(x, 12, 18, 10, 1, CAPD);                // cinturón
      // cabeza con capucha + media máscara de hueso
      rc(x, 13, 3, 8, 7, CAP);
      rc(x, 12, 4, 1, 5, CAPD); rc(x, 21, 4, 1, 5, CAPD);
      rc(x, 14, 5, 3, 3, BKS);                   // hueco de la capucha
      rc(x, 17, 4, 4, 5, MASK);                  // máscara de hueso al frente
      rc(x, 17, 4, 1, 5, MASKD);
      rc(x, 17, 3, 4, 1, MASKD);                 // ceño
      rc(x, 19, 5, 1, 1, EYE);                   // ojo de eco
      // brazos + garras huesudas (curvas de 3 segmentos)
      rc(x, 21, 11, 3, 3, CAP);                  // brazo delantero
      rc(x, 24, 13, 1, 3, CLAW); rc(x, 25, 15, 1, 3, CLAW); rc(x, 26, 17, 1, 2, CLAWD);
      rc(x, 8, 11, 3, 3, CAP);                   // brazo trasero
      rc(x, 7, 14, 1, 3, CLAW); rc(x, 6, 16, 1, 3, CLAWD);
      // piernas de carrera (alternas)
      if (f === 0) {
        rc(x, 13, 19, 3, 5, CAPD); rc(x, 12, 24, 4, 2, BOOT);   // babor adelante
        rc(x, 17, 19, 3, 4, CAPD); rc(x, 18, 23, 4, 2, BOOT);   // estribor impulso
      } else {
        rc(x, 17, 19, 3, 5, CAPD); rc(x, 18, 24, 4, 2, BOOT);
        rc(x, 13, 19, 3, 4, CAPD); rc(x, 12, 23, 4, 2, BOOT);
      }
      // polvo de la carrerilla
      x.globalAlpha = 0.35;
      rc(x, f === 0 ? 8 : 6, 26, 3, 1, '#bfe8d8');
      x.globalAlpha = 1;
    } else if (tel) {
      // ════════ TELEGRAPH · GARRA ALZADA (2) ════════
      // capa recogida (se agazapa)
      x.globalAlpha = 0.95;
      rc(x, 7, 12, 6, 10, CAPD);
      x.globalAlpha = 1;
      // torso agachado (1px más bajo)
      rc(x, 12, 11, 9, 9, CAP);
      rc(x, 12, 11, 9, 1, CAP2);
      rc(x, 20, 12, 1, 7, CAPD);
      rc(x, 12, 19, 10, 1, CAPD);
      // cabeza
      rc(x, 13, 5, 8, 7, CAP);
      rc(x, 12, 6, 1, 5, CAPD); rc(x, 21, 6, 1, 5, CAPD);
      rc(x, 14, 7, 3, 3, BKS);
      rc(x, 17, 6, 4, 5, MASK);
      rc(x, 17, 6, 1, 5, MASKD); rc(x, 17, 5, 4, 1, MASKD);
      rc(x, 19, 7, 2, 1, EYE);                   // ojos ENCENDIDOS (2px)
      // GARRA GUADAÑA alzada sobre la capucha
      rc(x, 9, 8, 3, 3, CAP);                    // brazo alzado
      rc(x, 8, 5, 1, 4, CLAW); rc(x, 7, 2, 1, 4, CLAW); rc(x, 6, 1, 1, 2, CLAWD);
      x.globalAlpha = 0.8; rc(x, 8, 2, 1, 1, '#ffffff'); x.globalAlpha = 1;
      // garra delantera retrasada, lista
      rc(x, 21, 13, 3, 3, CAP);
      rc(x, 24, 15, 1, 3, CLAW); rc(x, 25, 17, 1, 2, CLAWD);
      // piernas flexionadas
      rc(x, 13, 20, 3, 4, CAPD); rc(x, 12, 24, 4, 2, BOOT);
      rc(x, 17, 20, 3, 4, CAPD); rc(x, 18, 24, 4, 2, BOOT);
      // chispas de eco alrededor de la garra
      x.globalAlpha = 0.6;
      rc(x, 5, 4, 1, 1, EYE); rc(x, 10, 1, 1, 1, EYE);
      x.globalAlpha = 1;
    } else {
      // ════════ ATTACK · EMBESTIDA (3) ════════
      // capa ESTIRADA a remanguillo detrás
      x.globalAlpha = 0.95;
      rc(x, 3, 11, 9, 3, CAPD);
      x.globalAlpha = 0.6;
      rc(x, 1, 13, 4, 2, CAPD);
      x.globalAlpha = 0.35;
      rc(x, 0, 15, 3, 1, CAPD);
      x.globalAlpha = 1;
      // pañuelo horizontal
      rc(x, 11, 8, 8, 1, SCARF);
      x.globalAlpha = 0.6; rc(x, 9, 8, 2, 1, SCARF);
      x.globalAlpha = 1;
      // torso estirado al frente
      rc(x, 14, 10, 11, 8, CAP);
      rc(x, 14, 10, 11, 1, CAP2);
      rc(x, 24, 11, 1, 6, CAPD);
      // cabeza adelantada
      rc(x, 17, 4, 8, 6, CAP);
      rc(x, 16, 5, 1, 4, CAPD); rc(x, 25, 5, 1, 4, CAPD);
      rc(x, 18, 5, 3, 3, BKS);
      rc(x, 21, 4, 4, 5, MASK);
      rc(x, 21, 4, 1, 5, MASKD); rc(x, 21, 3, 4, 1, MASKD);
      rc(x, 23, 5, 1, 1, EYE);
      // GARRA DELANTERA EXTENDIDA (filo horizontal)
      rc(x, 25, 12, 4, 2, CAP);                  // brazo lanzado
      rc(x, 29, 11, 2, 2, CLAW); rc(x, 30, 12, 2, 1, CLAW); rc(x, 31, 10, 1, 2, CLAWD);
      // garra trasera abierta en la carrera
      rc(x, 12, 12, 3, 3, CAP);
      rc(x, 10, 14, 1, 3, CLAW); rc(x, 9, 16, 1, 2, CLAWD);
      // zancada de embestida
      rc(x, 20, 18, 4, 5, CAPD); rc(x, 21, 23, 5, 2, BOOT);     // delantera
      rc(x, 14, 18, 3, 4, CAPD); rc(x, 11, 22, 4, 2, BOOT);     // trasera extendida
      // líneas de velocidad
      x.globalAlpha = 0.35;
      rc(x, 2, 10, 5, 1, '#bfe8d8'); rc(x, 0, 14, 6, 1, '#bfe8d8'); rc(x, 3, 18, 4, 1, '#bfe8d8');
      x.globalAlpha = 1;
    }
    // contorno sutil común
    x.globalAlpha = 0.5;
    rc(x, 13, run ? 3 : tel ? 5 : 4, 8, 1, BKS);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- El Coro Roto (30×30 · 3 frames × 3 máscaras · JEFA) ----
// MASA de tres máscaras unidas por hilos de bruma: una central que
// CANTA AL REVÉS (boca vertical) y dos menores a los flancos.
// buildCoro(fase) — grieta creciente por máscara:
//   1 · EL PULSO    — hueso claro, glow aguamarina, INTACTA (0 grietas).
//   2 · EL VERA     — hueso frío, glow violeta, grietas finas (2).
//   3 · EL SILENCIO — hueso apagado, glow dorado, CUARTEADA (5 + esquirlas).
//
// Frames: 0 bob A · 1 bob B · 2 CANTO (la boca vertical se abre y
//         dispara el motivo de la máscara: Pulso=orbes en órbita,
//         Vera=rayos en cruz, Silencio=notas que caen).

function buildCoro(fase: 1 | 2 | 3): Frames {
  const pal = fase === 1
    ? { HUESO: '#d8d4c4', HUESO2: '#bdb8a6', GLOW: '#7ee8ff', HUECO: '#1a2030', FILO: '#eef2e8' }
    : fase === 2
      ? { HUESO: '#c8c2b2', HUESO2: '#aaa494', GLOW: '#b48fff', HUECO: '#1c1830', FILO: '#e4e2da' }
      : { HUESO: '#c4bcae', HUESO2: '#9c9486', GLOW: '#ffd88a', HUECO: '#241f28', FILO: '#dcd8cc' };
  const { HUESO, HUESO2, GLOW, HUECO, FILO } = pal;
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = cv(30, 30);
    const sing = f === 2;
    const bob = sing ? 0 : f;                    // canto: la masa se aquiesta
    const part = sing ? 2 : 0;                   // las máscaras se separan al cantar
    // ---- hilos de bruma que unen la masa (se tensan al cantar) ----
    x.globalAlpha = sing ? 0.6 : 0.4;
    rc(x, 8, 14 + bob, 4 - part, 1, GLOW);
    rc(x, 18 + part, 14 - bob, 4 - part, 1, GLOW);
    x.globalAlpha = sing ? 0.3 : 0.22;
    disc(x, 15, 13 + bob, sing ? 12 : 11, GLOW); // aura compartida
    x.globalAlpha = 1;
    // ---- máscara central (boca vertical = canto al revés) ----
    const mouthH = sing ? 7 : 5;
    rc(x, 10, 5 + bob, 10, 13 + (sing ? 1 : 0), HUESO);
    rc(x, 9, 6 + bob, 12, 11, HUESO);
    rc(x, 10, 17 + bob, 10, 2, HUESO2);          // mentón
    rc(x, 9, 6 + bob, 1, 9, HUESO2);
    rc(x, 20, 6 + bob, 1, 9, HUESO2);
    // ceño tallado
    rc(x, 10, 7 + bob, 4, 1, HUESO2); rc(x, 16, 7 + bob, 4, 1, HUESO2);
    // ojos huecos (crecen con la fase: el coro se apaga)
    const eyeH = fase === 1 ? 2 : fase === 2 ? 3 : 4;
    rc(x, 11, 8 + bob, 2, eyeH, HUECO);
    rc(x, 17, 8 + bob, 2, eyeH, HUECO);
    rc(x, 11, 8 + bob, 2, 1, FILO);
    rc(x, 17, 8 + bob, 2, 1, FILO);
    // boca vertical (la nota al revés) + glow interior
    rc(x, 14, 11 + bob, 2, mouthH, HUECO);
    x.globalAlpha = 0.85;
    rc(x, 14, 11 + bob, 1, mouthH - 1, GLOW);
    if (sing) {                                  // la voz se desborda
      x.globalAlpha = 0.5;
      rc(x, 13, 11 + bob, 1, mouthH - 2, GLOW); rc(x, 16, 11 + bob, 1, mouthH - 2, GLOW);
    }
    x.globalAlpha = 1;
    // GRIETA CRECIENTE: fina en F2, cuarteadas en F3
    if (fase >= 2) {
      rc(x, 12, 5 + bob, 1, 3, HUESO2);
      rc(x, 18, 13 + bob, 1, 4, HUESO2);
    }
    if (fase === 3) {
      rc(x, 10, 12 + bob, 3, 1, HUECO);
      rc(x, 16, 5 + bob, 1, 4, HUECO);
      rc(x, 13, 18 + bob, 4, 1, HUECO);
      rc(x, 19, 9 + bob, 1, 3, HUESO2);
      rc(x, 11, 16 + bob, 1, 2, HUECO);          // esquirla caída
    }
    // ---- máscara izquierda (perfil, cuelga más baja; se aleja al cantar) ----
    rc(x, 3 - part, 12 + bob, 6, 8, HUESO2);
    rc(x, 2 - part, 13 + bob, 1, 6, HUESO2);
    rc(x, 4 - part, 15 + bob, 2, 2, HUECO);      // ojo ladeado
    rc(x, 5 - part, 20 + bob, 1, 2, HUECO);      // boca pequeña
    // ---- máscara derecha (perfil, más alta) ----
    rc(x, 21 + part, 9 + bob, 6, 8, HUESO2);
    rc(x, 27 + part, 10 + bob, 1, 6, HUESO2);
    rc(x, 23 + part, 12 + bob, 2, 2, HUECO);
    rc(x, 24 + part, 17 + bob, 1, 2, HUECO);
    // ---- MOTIVO DE CANTO (solo frame 2) ----
    if (sing) {
      if (fase === 1) {
        // EL PULSO: 4 orbes en órbita
        const orbs: [number, number][] = [[4, 4], [24, 4], [4, 24], [24, 24]];
        for (const [ox, oy] of orbs) {
          disc(x, ox + 1, oy + 1, 2.2, GLOW, 0.75);
          disc(x, ox + 1, oy + 1, 1, FILO, 0.95);
        }
      } else if (fase === 2) {
        // EL VERA: rayos en cruz cardinal
        x.globalAlpha = 0.85;
        rc(x, 14, 0, 2, 4, FILO); rc(x, 14, 26, 2, 4, FILO);
        rc(x, 0, 13, 4, 2, FILO); rc(x, 26, 13, 4, 2, FILO);
        x.globalAlpha = 0.4;                     // halo del rayo
        rc(x, 14, 4, 2, 1, GLOW); rc(x, 14, 25, 2, 1, GLOW);
        rc(x, 4, 13, 1, 2, GLOW); rc(x, 25, 13, 1, 2, GLOW);
        x.globalAlpha = 1;
      } else {
        // EL SILENCIO: notas que caen y se apagan
        const notas: [number, number][] = [[3, 5], [25, 9], [5, 23]];
        for (const [nx, ny] of notas) {
          rc(x, nx, ny + 2, 2, 1, FILO);         // cabeza
          rc(x, nx + 2, ny, 1, 3, FILO);         // mástil
          rc(x, nx + 3, ny, 1, 1, GLOW);         // banderín
        }
        x.globalAlpha = 0.5;
        rc(x, 22, 22, 1, 1, GLOW); rc(x, 8, 3, 1, 1, GLOW);
        x.globalAlpha = 1;
      }
    }
    // destello del glow (parpadeo del bob alto)
    if (f === 1) {
      x.globalAlpha = 0.7;
      rc(x, 14, 15 + bob, 1, 1, FILO);
      rc(x, 6, 11 + bob, 1, 1, GLOW);
      rc(x, 23, 8 + bob, 1, 1, GLOW);
      x.globalAlpha = 1;
    }
    frames.push(c);
  }
  return frames;
}

// ---------------- Eco Desgarrado (16×16 · 3 frames) ----------------------
// Espectro PARTIDO en dos mitades con un hueco de bruma: el hueco
// late y las mitades PARPADEAN ALTERNANDO (f0 brilla la babor, f1 la
// estribor — nunca las dos a la vez: el eco no se reconoce).
// Frames: 0 parpadeo flanco izq · 1 parpadeo flanco der · 2 DASH
// (mitades estiradas con estelas — durante la embestida).

function buildEcodesg(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = cv(16, 16);
    const O = '#39465e', B = '#cdd8ea', S = '#a4b2ca', EYE = '#222c44';
    if (f === 2) {
      // ---- DASH: desgarrado en movimiento ----
      const GAP = 4;
      x.globalAlpha = 0.9;
      rc(x, 1, 5, 4, 6, B); rc(x, 0, 7, 1, 3, B);
      rc(x, 11 + GAP, 5, 4, 6, B); rc(x, 15, 7, 1, 3, B);
      x.globalAlpha = 0.5;                       // estelas de bruma
      rc(x, 5, 6, GAP - 1, 1, B); rc(x, 5, 9, GAP - 2, 1, S);
      x.globalAlpha = 0.3;
      rc(x, 0, 11, 4, 1, B); rc(x, 12, 11, 4, 1, B);
      x.globalAlpha = 1;
      rc(x, 2, 7, 1, 1, EYE); rc(x, 13, 7, 1, 1, EYE);   // ojos al frente
      x.globalAlpha = 0.55;
      rc(x, 6, 3, 5, 1, O);                      // labio del desgarro estirado
      x.globalAlpha = 1;
      frames.push(c);
      continue;
    }
    const GAP = f === 0 ? 1 : 2;
    const brightL = f === 0;                     // parpadeo de flanco alterno
    x.globalAlpha = brightL ? 0.95 : 0.7;
    // mitad izquierda (jag de desgarro)
    rc(x, 4, 4, 3, 7, B);
    rc(x, 3, 6, 1, 4, B);
    rc(x, 7 - GAP, 5, 1, 2, B);
    x.globalAlpha = brightL ? 0.7 : 0.95;
    // mitad derecha (simétrica rota)
    rc(x, 9 + GAP, 4, 3, 7, B);
    rc(x, 12 + GAP, 6, 1, 4, B);
    rc(x, 8 + GAP, 5, 1, 2, S);
    rc(x, 9 + GAP, 8, 1, 2, S);
    // cola desgarrada (3 jirones, laten con el hueco)
    x.globalAlpha = 0.6;
    rc(x, 4, 11, 2, 2 + (brightL ? 1 : 0), B);
    rc(x, 7, 11 + GAP, 2, 1 + (brightL ? 1 : 0), S);
    rc(x, 10 + GAP, 11, 2, 2 + (brightL ? 0 : 1), B);
    x.globalAlpha = 1;
    // ojos desalineados (el eco no se reconoce)
    rc(x, 4, 6, 1, 2, EYE);
    rc(x, 11 + GAP, 6, 1, 2, EYE);
    // brillo del hueco (late más abierto en f1)
    x.globalAlpha = 0.5 + (brightL ? 0 : 0.2);
    rc(x, 7, 3 + GAP, 2, 1, O);
    x.globalAlpha = 0.35;
    rc(x, 7 + (brightL ? 0 : 1), 8 + GAP, 1, 2, '#8ef0ff');
    // borde superior del desgarro
    x.globalAlpha = 0.8;
    rc(x, 4, 3, 8, 1, O);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Sátiro de la Niebla (16×16 · 3 frames) -----------------
// Cabrío pequeño y encorvado con cuernos claros y ojos dorados. El
// brinco alterna las pezuñas. f2 = LIRA: se senta a tocar la balada
// curva (lira dorada + notas de niebla) — telegraph del 'aro'.
// Frames: 0 brinco A · 1 brinco B · 2 lira.

function buildSatiro(): Frames {
  const FUR = '#4a5648', FUR2 = '#5e6c58', FUR3 = '#39443a', HORN = '#c8b890',
    EYE = '#ffd88a', HOOF = '#2c342a', NIEBLA = '#aebcc8', BK = '#262e26',
    LIRA = '#d8b45a', LIRAD = '#9a7a34';
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = cv(16, 16);
    if (f === 2) {
      // ---- LIRA: sentado, tocando la balada curva ----
      // niebla alrededor
      x.globalAlpha = 0.4;
      rc(x, 1, 14, 6, 1, NIEBLA); rc(x, 9, 14, 6, 1, NIEBLA);
      rc(x, 0, 9, 1, 3, NIEBLA); rc(x, 15, 8, 1, 3, NIEBLA);
      x.globalAlpha = 1;
      // cuernos curvos
      rc(x, 4, 2, 1, 3, HORN); rc(x, 3, 2, 1, 2, HORN);
      rc(x, 9, 2, 1, 3, HORN); rc(x, 10, 2, 1, 2, HORN);
      // cabeza cabruna (perfil, algo alzada hacia la lira)
      rc(x, 4, 4, 6, 4, FUR);
      rc(x, 9, 5, 2, 2, FUR);                    // hocico
      rc(x, 5, 5, 1, 1, EYE);
      rc(x, 8, 8, 1, 2, FUR2);                   // barba de chivo
      // torso encorvado sobre la lira
      rc(x, 3, 8, 8, 4, FUR);
      rc(x, 3, 8, 8, 1, BK);
      rc(x, 4, 12, 6, 1, FUR2);
      // patas dobladas (sentado)
      rc(x, 4, 12, 1, 2, FUR2); rc(x, 4, 13, 1, 1, HOOF);
      rc(x, 9, 12, 1, 2, FUR2); rc(x, 9, 13, 1, 1, HOOF);
      rc(x, 6, 13, 3, 1, FUR3);                  // cuartos traseros
      // LIRA dorada entre las manos
      rc(x, 11, 9, 1, 4, LIRA); rc(x, 14, 9, 1, 4, LIRA);    // brazos de la lira
      rc(x, 11, 8, 4, 1, LIRAD);                             // travesaño
      x.globalAlpha = 0.8;
      rc(x, 12, 9, 1, 4, LIRA); rc(x, 13, 9, 1, 4, LIRA);    // cuerdas
      x.globalAlpha = 1;
      rc(x, 12, 11, 2, 1, FUR2);                 // manos
      // notas de niebla subiendo de la lira
      x.globalAlpha = 0.8;
      rc(x, 13, 5, 1, 2, NIEBLA); rc(x, 14, 4, 1, 1, NIEBLA);
      x.globalAlpha = 0.5;
      rc(x, 15, 3, 1, 1, NIEBLA); rc(x, 12, 3, 1, 1, NIEBLA);
      x.globalAlpha = 1;
      // cola corta
      rc(x, 2, 9, 1, 2, FUR2);
      frames.push(c);
      continue;
    }
    const hop = f === 0 ? 0 : -1;                // brinco
    // niebla en los cascos
    x.globalAlpha = 0.35;
    rc(x, 2, 14, 5, 1, NIEBLA);
    rc(x, 9, 14, 5, 1, NIEBLA);
    x.globalAlpha = 1;
    // cuernos curvos
    rc(x, 4, 1 + hop, 1, 3, HORN); rc(x, 3, 1 + hop, 1, 2, HORN);
    rc(x, 9, 1 + hop, 1, 3, HORN); rc(x, 10, 1 + hop, 1, 2, HORN);
    // cabeza cabruna (perfil)
    rc(x, 4, 3 + hop, 6, 4, FUR);
    rc(x, 9, 4 + hop, 2, 2, FUR);                // hocico
    rc(x, 5, 4 + hop, 1, 1, EYE);
    rc(x, 8, 7 + hop, 1, 2, FUR2);               // barba de chivo
    // torso encorvado
    rc(x, 3, 7 + hop, 8, 4, FUR);
    rc(x, 3, 7 + hop, 8, 1, BK);
    rc(x, 4, 11 + hop, 6, 1, FUR2);
    // patas (el brinco alterna)
    rc(x, 4, 11 + hop, 1, 3 - f, FUR2); rc(x, 4, 13 + hop - f, 1, 1, HOOF);
    rc(x, 9, 11 + hop, 1, 3 - (1 - f), FUR2); rc(x, 9, 13 + hop - (1 - f), 1, 1, HOOF);
    rc(x, 3, 11 + hop, 1, 2, FUR2);
    // zampoña a la espalda (la guarda para el interludio)
    rc(x, 2, 8 + hop, 1, 4, '#8a6a4a');
    rc(x, 3, 8 + hop, 1, 3, '#6a4e36');
    if (f === 1) { x.globalAlpha = 0.7; rc(x, 11, 5 + hop, 1, 1, NIEBLA); x.globalAlpha = 1; } // nota de niebla
    // cola corta
    rc(x, 2, 8 + hop, 1, 2, FUR2);
    frames.push(c);
  }
  return frames;
}
