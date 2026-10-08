// ============================================================
// ECOS DE AELTHAR — Props v2 (módulo world · R1-A10)
// Sistema autocontenido de props del mapa: santuario, forja,
// fragmento, altar del Eco, cartel y puerta. Todo dibujo es
// directo por rects (sin caché SPR de sprites.ts) para que el
// módulo no dependa de sprites ni de render.
//
// CONTRATO DE COORDENADAS (elección documentada):
//   drawPropV2 recibe coords de MUNDO (wx, wy = centro del prop
//   en px de mundo, p. ej. pr.x*16+8, pr.y*16+8) y aplica ella
//   misma la transformación de cámara: Math.round(wx*ZOOM) -
//   Math.round(g.camX). Con wx en px de mundo la parte entera
//   queda garantizada (px mundo enteros ×ZOOM) y el integrador
//   solo necesita pasar g.ctx, el kind y el centro del prop.
//   La cámara se redondea igual que render.ts (Math.round) para
//   coincidir píxel a píxel con el resto de la capa de mundo.
//
// Determinismo: cero Math.random. Todas las animaciones usan
// g.globalT, sin() y hash2() sobre el tile del prop.
// ============================================================

import type { Game } from '../engine';
import { TILE, ZOOM } from '../engine';
import { hash2, PAL, PAL_PROP } from './palette';

// ---------------- Estado de frame (scratch interno) ----------------
// JS es single-threaded y el dibujado es síncrono: scratch a nivel
// de módulo evita arrastrar ctx/offsets por cada helper.

let _ctx: CanvasRenderingContext2D | null = null;
let _ox = 0;                 // ancla X en pantalla (px enteros)
let _oy = 0;                 // ancla Y en pantalla (px enteros)
let _t = 0;                  // globalT del frame
let _tx = 0;                 // tile X del prop (para hash determinista)
let _ty = 0;                 // tile Y del prop

// ---------------- Helpers de dibujo (px mundo locales ×ZOOM) ----------------

/** Rect sólido en px de mundo locales al prop (0,0 = ancla). Redondea a enteros. */
function P(x: number, y: number, w: number, h: number, c: string): void {
  const x2 = _ctx!;
  x2.fillStyle = c;
  x2.fillRect(
    _ox + Math.round(x) * ZOOM, _oy + Math.round(y) * ZOOM,
    Math.round(w) * ZOOM, Math.round(h) * ZOOM,
  );
}

/** Rect con alpha (restaura el alpha previo del contexto). */
function PA(x: number, y: number, w: number, h: number, c: string, a: number): void {
  if (a <= 0.01) return;
  const x2 = _ctx!;
  const prev = x2.globalAlpha;
  x2.globalAlpha = prev * Math.min(1, a);
  P(x, y, w, h, c);
  x2.globalAlpha = prev;
}

/** Elipse rellena (halos, humo, niebla) con alpha; restaura el estado. */
function ELL(cx: number, cy: number, rx: number, ry: number, c: string, a: number): void {
  if (a <= 0.01) return;
  const x2 = _ctx!;
  const prev = x2.globalAlpha;
  x2.globalAlpha = prev * Math.min(1, a);
  x2.fillStyle = c;
  x2.beginPath();
  x2.ellipse(_ox + cx * ZOOM, _oy + cy * ZOOM, Math.max(0.5, rx * ZOOM), Math.max(0.5, ry * ZOOM), 0, 0, Math.PI * 2);
  x2.fill();
  x2.globalAlpha = prev;
}

/** Semicírculo de elipse trazado (anillo del santuario). front = mitad inferior. */
function RING_HALF(cy: number, rx: number, ry: number, front: boolean, c: string, a: number): void {
  const x2 = _ctx!;
  const prev = x2.globalAlpha;
  x2.globalAlpha = prev * a;
  x2.strokeStyle = c;
  x2.lineWidth = ZOOM; // 1 px de mundo
  x2.beginPath();
  x2.ellipse(
    _ox, _oy + cy * ZOOM, rx * ZOOM, ry * ZOOM, 0,
    front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2,
  );
  x2.stroke();
  x2.globalAlpha = prev;
}

// ---------------- PROP_SHADOW (export público) ----------------

/**
 * Sombra elíptica coherente de props (y entidades si el integrador
 * la reutiliza): rgba(0,0,0,0.25) por defecto, desplazada al suelo.
 * cx, cy: centro en píxeles de PANTALLA (ya pasados por sx/sy del
 * render). rx, ry: radios en píxeles de MUNDO (se escalan ×ZOOM aquí).
 */
export function PROP_SHADOW(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  rx: number, ry: number, alpha = 0.25,
): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, rx * ZOOM), Math.max(1, ry * ZOOM), 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- Glifos y piezas compartidas ----------------

/** Runa pixel 3×4 (4 variantes deterministas por índice). */
function RUNE(i: number, x: number, y: number, c: string, a: number): void {
  switch (i & 3) {
    case 0: // aspa vertical
      PA(x, y, 1, 4, c, a); PA(x - 1, y + 1, 3, 1, c, a);
      break;
    case 1: // rombo
      PA(x, y, 1, 1, c, a); PA(x - 1, y + 1, 1, 1, c, a);
      PA(x, y + 2, 1, 1, c, a); PA(x + 1, y + 1, 1, 1, c, a);
      break;
    case 2: // ojo
      PA(x - 1, y, 3, 1, c, a); PA(x, y + 1, 1, 2, c, a); PA(x - 1, y + 3, 3, 1, c, a);
      break;
    default: // rama
      PA(x, y, 1, 4, c, a); PA(x + 1, y + 1, 1, 1, c, a); PA(x - 1, y + 2, 1, 1, c, a);
      break;
  }
}

/** Vela 2×3 con llama animada de 3 frames (determinista por índice i). */
function CANDLE(x: number, y: number, i: number): void {
  P(x, y, 2, 3, PAL_PROP.wax);          // cera
  P(x + 1, y, 1, 3, PAL_PROP.waxShade); // costado en sombra
  P(x, y - 1, 2, 1, PAL_PROP.waxHi);    // borde superior
  if (hash2(x * 7 + i, y * 3 + 1) > 0.55) P(x, y + 1, 1, 1, PAL_PROP.waxHi); // gota de cera
  const ff = Math.floor(_t * 6 + i * 1.7) % 3; // llama: 3 frames
  if (ff === 1) { // llama alta
    PA(x, y - 5, 1, 2, PAL_PROP.flame2, 0.95);
  } else if (ff === 0) { // llama media
    PA(x, y - 4, 1, 1, PAL_PROP.flame2, 0.95);
  } else { // llama baja cálida
    PA(x, y - 4, 1, 1, PAL_PROP.flame1, 0.95);
  }
  PA(x, y - 3, 1, 1, PAL_PROP.flame3, 0.95); // núcleo blanco fijo
  ELL(x + 0.5, y - 3, 3.5, 2.5, PAL_PROP.flame2, ff === 1 ? 0.16 : 0.10);
}

/** Piedrita orbitante 2×2 con luz superior. */
function PEBBLE(x: number, y: number, c: string, cHi: string, a = 1): void {
  PA(x, y, 2, 2, c, a);
  PA(x, y, 2, 1, cHi, a * 0.9);
}

// ---------------- Santuario del Eco ----------------

function drawSanctuary(): void {
  const t = _t;
  const fr = Math.floor(t * 2) % 2;                 // 2 frames deterministas del anillo
  const bob = Math.round(Math.sin(t * 2) * 1.5);    // flotación del anillo (px enteros)

  // sombra elíptica en el suelo
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 12, 3.5);

  // halo elíptico (detrás de todo el prop)
  ELL(0, -14, 16, 7, PAL_PROP.runeCyan, 0.07 + Math.sin(t * 2) * 0.04);
  ELL(0, -14, 9, 4, PAL_PROP.runeCyanHi, 0.06 + Math.sin(t * 2.7) * 0.03);

  // anillo: mitad trasera (detrás del fuste) + abalorio si está detrás
  const ringY = -12 + bob;
  const ringRy = fr === 0 ? 3 : 2; // perspectiva: 2 frames
  RING_HALF(ringY, 9, ringRy, false, PAL_PROP.runeCyan, 0.55);
  const beadAng = t * 2.4;
  const beadFront = Math.sin(beadAng) >= 0;
  if (!beadFront) {
    PA(Math.round(Math.cos(beadAng) * 9) - 1, ringY + Math.round(Math.sin(beadAng) * ringRy), 2, 2, PAL_PROP.runeCyanHi, 0.8);
  }

  // base de losas con musgo
  P(-13, 4, 26, 2, '#4a4a58');
  P(-12, 2, 24, 3, PAL.stoneDark);
  P(-12, 2, 24, 1, PAL.stoneLight);
  P(-5, 3, 1, 2, '#3e3e50'); // juntas
  P(4, 3, 1, 2, '#3e3e50');
  P(0, 5, 1, 1, '#3e3e50');
  const r1 = hash2(_tx, _ty);
  if (r1 > 0.35) P(-12 + Math.floor(r1 * 6), 2, 3, 1, PAL_PROP.moss);
  const r2 = hash2(_tx * 3 + 1, _ty * 5 + 2);
  if (r2 > 0.5) P(8 - Math.floor(r2 * 5), 4, 2, 1, PAL_PROP.mossDark);
  P(-5, 1, 2, 1, PAL_PROP.mossDark); // musgo al pie del fuste

  // fuste del obelisco (tapered, cara iluminada a la izquierda)
  P(-6, -1, 12, 3, PAL_PROP.sanctShade);   // cornisa
  P(-6, -1, 12, 1, PAL_PROP.sanctLight);
  P(-3, -25, 6, 24, PAL_PROP.sanctStone);  // cuerpo
  P(-3, -25, 2, 24, PAL_PROP.sanctLight);  // luz
  P(1, -25, 2, 24, PAL_PROP.sanctShade);   // sombra
  P(-2, -27, 4, 2, PAL_PROP.sanctStone);   // remate
  P(-2, -27, 2, 1, PAL_PROP.sanctLight);
  PA(-1, -29, 2, 2, PAL_PROP.runeCyan, 0.55 + Math.sin(t * 2.5) * 0.3); // punta luminosa
  PA(-1, -29, 1, 1, PAL_PROP.runeCyanHi, 0.9);

  // runas cian que recorren el fuste: posición = floor(globalT*2)%4
  const slot = Math.floor(t * 2) % 4;
  const runeYs = [-22, -16, -10, -4];
  for (let i = 0; i < 4; i++) {
    const a = i === slot ? 0.95 : (i === (slot + 3) % 4 ? 0.5 : 0.3); // estela detrás
    RUNE(i, 0, runeYs[i], i === slot ? PAL_PROP.runeCyan : PAL_PROP.runeDim, a);
    if (i === slot) PA(0, runeYs[i] + 1, 1, 1, PAL_PROP.runeCyanHi, fr === 0 ? 0.9 : 0.6);
  }

  // anillo: mitad frontal (delante del fuste) + abalorio delante
  RING_HALF(ringY, 9, ringRy, true, PAL_PROP.runeCyanHi, 0.9);
  if (beadFront) {
    PA(Math.round(Math.cos(beadAng) * 9) - 1, ringY + Math.round(Math.sin(beadAng) * ringRy), 2, 2, PAL_PROP.runeCyanHi, 0.95);
  }

  // partículas ascendentes (4, deterministas con sin + hash)
  for (let i = 0; i < 4; i++) {
    const ph = hash2(_tx * 5 + i * 13, _ty * 9 + i * 7);
    const cyc = (t * 0.35 + ph) % 1;                       // 0..1 ciclo de subida
    const yy = 2 - Math.round(cyc * 26);
    const xx = (i < 2 ? -3 : 3) + Math.round(Math.sin(cyc * 6.283 + ph * 6.283) * 3);
    PA(xx, yy, 1, 2, i % 2 === 0 ? PAL_PROP.runeCyan : PAL_PROP.runeCyanHi, Math.sin(cyc * Math.PI) * 0.7);
  }
}

// ---------------- Forja de Toln ----------------

function drawForge(): void {
  const t = _t;
  const fr = Math.floor(t * 3) % 2;                 // 2 tonos de brasa alternos

  // sombra elíptica
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 13, 3.5);

  // glow cálido de la fragua (detrás)
  ELL(-13, -1, 10, 5, PAL_PROP.emberGlow, 0.10 + Math.sin(t * 5) * 0.05);

  // fragua (hogaza de piedra con carbones) a la izquierda
  P(-17, -2, 8, 6, PAL_PROP.ironLight);
  P(-17, -2, 8, 1, PAL_PROP.ironHi);
  P(-16, -1, 6, 4, PAL_PROP.barDeep);       // hueco
  P(-16, 1, 6, 2, '#1c1c26');               // carbones apagados
  PA(-15, 0, 4, 2, fr === 0 ? PAL_PROP.ember1 : PAL_PROP.ember2, 0.85 + Math.sin(t * 7) * 0.15);
  PA(-14, 0, 2, 2, PAL_PROP.emberCore, 0.95);
  PA(-15, -1, 2, 1, PAL_PROP.ember2, 0.8);  // brasa que asoma

  // tocón (base de madera)
  P(-10, -2, 20, 7, PAL.woodMid);
  P(-9, -4, 18, 2, PAL.wood);   // cara superior
  P(-7, -4, 14, 1, PAL.woodLight);
  P(-10, 3, 20, 2, PAL.woodDark);
  const rv = hash2(_tx + 9, _ty + 3);
  P(-7 + Math.floor(rv * 3), -1, 1, 3, PAL.woodDark); // vetas
  P(1, 0, 1, 3, PAL.woodDark);
  P(6, -1, 1, 4, PAL.woodDark);

  // yunque sobre el tocón
  P(-4, -6, 8, 2, PAL_PROP.ironDeep);       // peana
  P(-2, -8, 4, 2, PAL_PROP.iron);           // cuello
  P(-7, -10, 12, 2, PAL_PROP.ironLight);    // mesa
  P(-7, -10, 12, 1, PAL_PROP.ironHi);       // filo de luz
  P(5, -10, 2, 2, PAL_PROP.ironLight);      // cuerna
  P(7, -9, 2, 1, PAL_PROP.iron);
  P(-7, -8, 12, 1, PAL_PROP.ironDeep);      // canto inferior

  // humillo: 3 puffs que suben y se disipan (determinista)
  for (let i = 0; i < 3; i++) {
    const cyc = (t * 0.3 + i / 3) % 1;
    const sxp = -13 + i + Math.round(Math.sin(cyc * 4 + i * 2.1) * 2);
    const syp = -6 - Math.round(cyc * 14);
    const s = 1 + Math.round(cyc * 2);
    ELL(sxp, syp, s + 1, s * 0.75, PAL_PROP.smoke, (1 - cyc) * 0.38);
  }

  // martillo apoyado en el tronco (lado derecho)
  P(12, 0, 1, 4, PAL.woodDark);   // mango
  P(13, -2, 1, 3, PAL.woodMid);
  P(12, -5, 4, 3, PAL_PROP.ironLight);              // cabeza
  P(12, -5, 4, 1, PAL_PROP.ironHi);
  P(11, -4, 1, 2, PAL_PROP.iron);
  P(12, -3, 4, 1, PAL_PROP.ironDeep);               // canto inferior
  P(15, -4, 1, 2, PAL_PROP.ironDeep);               // lateral

  // herradura colgada de un clavo (sway de 1 px)
  const sway = Math.round(Math.sin(t * 1.3));
  P(-4 + sway, -1, 1, 1, '#2a2a34');                // clavo
  P(-7 + sway, 0, 7, 4, '#4a3420');                 // respaldo (contraste)
  P(-6 + sway, 0, 1, 3, '#9aa0ac');                 // herradura en U
  P(-2 + sway, 0, 1, 3, '#9aa0ac');
  P(-6 + sway, 3, 5, 1, '#9aa0ac');
  P(-6 + sway, 0, 1, 2, '#c0c6d0');                 // brillo
  P(-6 + sway, 2, 1, 1, '#5a5a6a');                 // callos
  P(-2 + sway, 2, 1, 1, '#5a5a6a');

  // chispas ocasionales: hash2 + floor(globalT*3)
  const seed = Math.floor(t * 3);
  const rs = hash2(seed * 17 + _tx * 3, _ty * 11 + 5);
  if (rs > 0.4) {
    const age = t * 3 - seed; // 0..1 vida del chispazo
    for (let i = 0; i < 3; i++) {
      const vx = (hash2(seed * 7 + i, 3) * 2 - 1) * 5;
      const vy = 14 + hash2(seed * 3, i * 5) * 8;
      const xx = -13 + Math.round(vx * age);
      const yy = -1 - Math.round(vy * age) + Math.round(10 * age * age); // gravedad
      PA(xx, yy, 1, 1, i === 0 ? PAL_PROP.emberCore : PAL_PROP.spark, 1 - age);
    }
  }
}

// ---------------- Fragmento de Eco ----------------

function drawFragment(): void {
  const t = _t;
  const bob = Math.round(Math.sin(t * 2.4) * 2);
  const br = Math.sin(t * 2.4); // respiración de la sombra

  // sombra en el suelo que respira
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 8 + br * 1.5, 3, 0.22 + br * 0.04);

  // halo dorado suave
  ELL(0, -12 + bob, 12, 6, PAL_PROP.crackGold, 0.14 + Math.sin(t * 3) * 0.05);

  // fragmentos orbitando: órbita elíptica (atrás si sin(ang) < 0)
  const orb: { x: number; y: number; back: boolean }[] = [];
  for (let i = 0; i < 3; i++) {
    const ang = t * 1.7 + i * (Math.PI * 2 / 3);
    orb.push({
      x: Math.round(Math.cos(ang) * 9),
      y: -12 + bob + Math.round(Math.sin(ang) * 3.5),
      back: Math.sin(ang) < 0,
    });
  }
  for (const o of orb) if (o.back) PEBBLE(o.x, o.y, '#6a6a7a', '#8a8a9a', 0.85);

  // monolito roto flotante (punta hacia abajo, pico descoyuntado)
  P(-4, -18 + bob, 8, 12, '#5a5a6a');       // cuerpo
  P(-4, -18 + bob, 2, 12, '#7a7a8a');       // cara iluminada
  P(2, -18 + bob, 2, 12, '#4a4a58');        // cara en sombra
  P(-3, -20 + bob, 3, 2, '#5a5a6a');        // pico roto superior
  P(-3, -20 + bob, 1, 2, '#7a7a8a');
  P(-3, -6 + bob, 6, 2, '#4a4a58');         // afilado inferior
  P(-2, -4 + bob, 4, 1, '#3e3e50');
  P(-1, -3 + bob, 2, 1, '#3e3e50');         // punta
  P(5, -13 + bob, 2, 4, '#4a4a58');         // esquirla desprendida
  P(5, -13 + bob, 1, 4, '#5a5a6a');

  // grietas brillantes doradas (pulso fuerte: es la pieza dorada del juego)
  const gl = 0.7 + Math.sin(t * 3) * 0.2;
  PA(-4, -18 + bob, 1, 10, PAL_PROP.crackGoldDeep, 0.5);   // filo dorado izq.
  PA(3, -18 + bob, 1, 10, PAL_PROP.crackGoldDeep, 0.25);   // reflejo der.
  PA(-1, -17 + bob, 1, 3, PAL_PROP.crackGold, gl);
  PA(0, -14 + bob, 1, 3, PAL_PROP.crackGoldDeep, gl * 0.9);
  PA(-2, -11 + bob, 2, 1, PAL_PROP.crackGold, gl);
  PA(-2, -8 + bob, 1, 2, PAL_PROP.crackGoldDeep, gl * 0.6);
  PA(1, -19 + bob, 1, 2, PAL_PROP.crackGoldDeep, gl * 0.75);
  PA(-1, -16 + bob, 1, 1, PAL_PROP.crackGoldHi, 0.95);

  // piedritas delanteras
  for (const o of orb) if (!o.back) PEBBLE(o.x, o.y, '#6a6a7a', '#8a8a9a', 1);
}

// ---------------- Altar del Eco (cripta v2) ----------------

function drawAltarEcho(g: Game): void {
  const t = _t;

  // sombra elíptica
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 12, 3);

  // losa del altar (2 escalones)
  P(-10, 1, 20, 4, '#6a6a7a');
  P(-10, 1, 20, 1, '#7a7a8a');
  P(-10, 4, 20, 1, '#4a4a58');
  P(-7, -2, 14, 3, '#7a7a8a');
  P(-7, -2, 14, 1, '#8a8a9a');
  P(-7, 0, 14, 1, '#5a5a6a');

  // canal central brillante (surco dorado con pulso que baja)
  P(-1, -2, 2, 6, '#8a6c28');
  const prog = (t * 2.5) % 1;
  PA(-1, -2 + Math.round(prog * 5), 2, 1, PAL_PROP.crackGoldHi, 0.9);
  ELL(0, 0, 6, 3, PAL_PROP.crackGold, 0.12 + Math.sin(t * 2) * 0.05);

  // velas 2×3 (dos columnas, tres filas) con llama de 3 frames
  for (let row = 0; row < 3; row++) {
    CANDLE(row === 1 ? -12 : -14, row * 2, row);          // columna izquierda
    CANDLE(row === 1 ? 10 : 12, row * 2, row + 3);        // columna derecha
  }

  // niebla baja alrededor (determinista)
  for (let i = 0; i < 5; i++) {
    const fx = -12 + i * 6 + Math.round(Math.sin(t * 0.4 + i * 2.4) * 3);
    const fa = 0.08 + Math.sin(t * 0.8 + i * 1.7) * 0.04;
    ELL(fx, 4 + (i % 2), 7 - (i % 3), 2.2, PAL_PROP.fog, fa);
  }

  // el Eco dormita sobre el altar hasta ser recogido (paridad gameplay)
  if (!g.flags.ecoVoz) {
    const bob2 = Math.round(Math.sin(t * 2.6) * 3);
    const gl2 = g.flags.guardianDefeated ? 0.7 : 0.3;
    ELL(0, -14 + bob2, 9, 5, PAL_PROP.crackGold, gl2 * 0.35);
    P(-2, -18 + bob2, 4, 8, PAL_PROP.crackGoldDeep);      // esquirla dorada
    P(-2, -18 + bob2, 2, 8, PAL_PROP.crackGold);
    P(-1, -16 + bob2, 2, 3, PAL_PROP.crackGoldHi);        // núcleo
    P(-1, -10 + bob2, 2, 1, PAL_PROP.crackGoldDeep);      // punta
    // dos motas orbitando el Eco
    for (let i = 0; i < 2; i++) {
      const ang = t * 2.2 + i * Math.PI;
      PA(Math.round(Math.cos(ang) * 7) - 1, -14 + bob2 + Math.round(Math.sin(ang) * 2.5), 1, 1, PAL_PROP.crackGoldHi, 0.8);
    }
  }
}

// ---------------- Cartel de madera ----------------

function drawSign(selected: boolean): void {
  const t = _t;
  // tiembla 1 px si está seleccionado (jugador cerca)
  const dx = selected ? (Math.floor(t * 10) % 2) : 0;

  // sombra (sin temblor: el poste no se mueve del suelo)
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 6, 2.5);

  // poste
  P(-1 + dx, -11, 2, 16, PAL.woodDark);
  P(-1 + dx, -11, 1, 16, PAL.woodMid);

  // tabla clavada
  P(-8 + dx, -18, 16, 8, '#8a5a2b');
  P(-8 + dx, -18, 16, 1, '#a8703a');        // luz superior
  P(-8 + dx, -11, 16, 1, PAL.door);  // sombra inferior
  P(-8 + dx, -18, 1, 8, PAL.door);   // bordes
  P(7 + dx, -18, 1, 8, PAL.door);
  // clavos (oscuros, con microrreflejo)
  P(-7 + dx, -17, 1, 1, '#1f1208');
  P(6 + dx, -17, 1, 1, '#1f1208');
  P(-7 + dx, -12, 1, 1, '#1f1208');
  P(6 + dx, -12, 1, 1, '#1f1208');
  P(-6 + dx, -17, 1, 1, '#c9a86a');
  P(7 + dx, -12, 1, 1, '#c9a86a');
  // veta (determinista por tile)
  const r = hash2(_tx, _ty);
  P(-6 + dx, -15, 7, 1, '#6d4520');
  P(1 + dx, -13, 5, 1, '#6d4520');
  if (r > 0.5) P(-4 + dx, -14, 4, 1, '#7a5230');
  if (r < 0.35) P(3 + dx, -16, 2, 1, '#5c3a1e'); // nudo

  // icono de lectura (solo seleccionado): globito redondeado con "E"
  if (selected) {
    const by = -26 + Math.round(Math.sin(t * 3));
    P(-4, by, 9, 9, 'rgba(10,12,20,0.85)');
    P(-2, by - 1, 5, 1, 'rgba(10,12,20,0.85)');   // esquinas redondeadas
    P(-2, by + 9, 5, 1, 'rgba(10,12,20,0.85)');
    P(-4, by, 9, 1, PAL.gold);                    // borde sin esquinas duras
    P(-4, by + 9, 9, 1, PAL.gold);
    P(-5, by + 1, 1, 8, PAL.gold);
    P(5, by + 1, 1, 8, PAL.gold);
    // letra E 3×5
    P(-1, by + 3, 1, 5, PAL_PROP.crackGold);
    P(-1, by + 3, 3, 1, PAL_PROP.crackGold);
    P(-1, by + 5, 2, 1, PAL_PROP.crackGold);
    P(-1, by + 7, 3, 1, PAL_PROP.crackGold);
  }
}

// ---------------- Puerta / arco de piedra ----------------

function drawGate(): void {
  const t = _t;

  // sombra elíptica ancha
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 15, 3);

  // pilares con sillares (offset por hash para variedad)
  for (let side = 0; side < 2; side++) {
    const x0 = side === 0 ? -12 : 7;
    P(x0, -22, 5, 26, '#6a6a7a');
    P(x0, -22, 2, 26, '#7a7a8a');   // cara iluminada
    P(x0 + 3, -22, 2, 26, '#5a5a6a'); // cara en sombra
    const off = side === 0 ? 0 : 3;
    for (let yy = -22 + off; yy < 3; yy += 5) P(x0, yy, 5, 1, '#585868'); // juntas
    P(x0 - 1, -22, 7, 2, '#8a8a9a');  // capitel
    P(x0 - 1, -20, 7, 1, '#3e3e50');
  }

  // penumbra del vano
  P(-7, -19, 14, 23, 'rgba(10,10,20,0.45)');

  // puerta de barrotes (portcullis, 2 px de grosor con filo de luz)
  P(-7, -20, 14, 1, PAL_PROP.bar);
  for (let x = -6; x <= 6; x += 4) {
    P(x, -19, 2, 21, PAL_PROP.bar);
    P(x, -19, 1, 21, PAL_PROP.barHi);  // filo de luz del barrote
    P(x, 2, 2, 2, PAL_PROP.barDeep);   // punta inferior
  }
  P(-6, -10, 14, 1, PAL_PROP.bar);     // travesaño
  P(-6, -9, 14, 1, PAL_PROP.barDeep);

  // dintel con dovelas y clave central
  P(-14, -26, 28, 4, '#6a6a7a');
  P(-14, -26, 28, 1, '#8a8a9a');
  P(-14, -23, 28, 1, '#4a4a58');
  P(-8, -26, 1, 4, '#585868');
  P(-1, -26, 2, 4, '#585868');
  P(7, -26, 1, 4, '#585868');
  P(-2, -28, 4, 2, '#7a7a8a');         // clave
  P(-2, -28, 4, 1, '#8a8a9a');

  // runas cian pulsantes en el dintel
  for (let i = 0; i < 3; i++) {
    const a = 0.45 + Math.sin(t * 2 + i * 2.1) * 0.3;
    RUNE(i, -8 + i * 7, -25, PAL_PROP.runeCyan, Math.max(0.15, a));
  }
}

// ---------------- Entrada principal ----------------

/**
 * Dibuja un prop v2. VER CONTRATO DE COORDENADAS en la cabecera:
 * wx/wy en píxeles de MUNDO (centro del prop = pr.x*16+8, pr.y*16+8).
 * El integrador debe llamarlo dentro del bloque con WORLD_FILTER si
 * quiere heredar el filtro de época; este módulo no toca ctx.filter.
 * `selected`: el prop es el objetivo de interacción más cercano
 * (solo lo usa 'sign' para el temblor de 1 px y el icono de lectura).
 */
export function drawPropV2(
  ctx: CanvasRenderingContext2D, kind: string,
  wx: number, wy: number, g: Game, selected: boolean,
): void {
  _ctx = ctx;
  _ox = Math.round(wx * ZOOM) - Math.round(g.camX);
  _oy = Math.round(wy * ZOOM) - Math.round(g.camY);
  _t = g.globalT;
  _tx = Math.floor(wx / TILE);
  _ty = Math.floor(wy / TILE);
  ctx.save();
  try {
    switch (kind) {
      case 'sanctuary': drawSanctuary(); break;
      case 'forge': drawForge(); break;
      case 'fragment': drawFragment(); break;
      case 'altarEcho': drawAltarEcho(g); break;
      case 'sign': drawSign(selected); break;
      case 'gate': drawGate(); break;
      default: break; // kinds desconocidos: no-op seguro
    }
  } finally {
    ctx.restore();
    _ctx = null;
  }
}
