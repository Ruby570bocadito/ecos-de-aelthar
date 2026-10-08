// ============================================================
// ECOS DE AELTHAR — spells.ts (módulo actors)
// R3-A5 · Proyectiles v2 (Ronda 3 · Combate y Juice)
// ------------------------------------------------------------
// Contrato para el integrador (reemplaza el bloque 'proyectiles'
// de drawCombatFx en render.ts, líneas ~488-516):
//
//   for (const pr of g.projectiles) {
//     drawProjectileV2(ctx, pr, sx(pr.x), sy(pr.y), g.globalT);
//   }
//
//   - x/y llegan YA en pantalla (sx/sy con ZOOM y cámara aplicadas);
//     aquí se redondean a enteros antes de pintar.
//   - projectileColor(element) expone el color representativo de cada
//     elemento para las partículas de estela/impacto del integrador.
//
// Reglas respetadas:
//   - Determinista: cero Math.random; todo el azar sale de hash2
//     (world/palette, [0,0.5) → normalizado ×2) sembrado con globalT.
//   - fillRect SIEMPRE con enteros (posiciones Math.round, tamaños íntegros).
//   - Sin strings rgba dinámicas: colores constantes + globalAlpha
//     clampeada a [0,1] y restaurada a 1 al salir.
//   - Cero allocations por frame (tablas y scratch a nivel de módulo).
//
// Tipos dibujados:
//   fuego  (p_fire / 'fuego') : núcleo blanco + cuerpo naranja + lenguas
//            que flamean + 3 brasas decrecientes detrás (-vx,-vy) + halo.
//   hielo  (p_ice / 'hielo')  : cristal en cruz/rombo + destello que rota
//            en pasos discretos + 3 esquirlas satélite + polvo de escarcha.
//   rayo   ('rayo')           : zigzag real de 3 segmentos (4 vértices)
//            re-seedéado cada ~90 ms + núcleo claro + halo violeta,
//            longitud según velocidad.
//   flecha (p_arrow/companion): asta + punta de hierro 2 tonos + plumas
//            en V + estela sutil + filo elemental si element ≠ 'ninguno'.
//   enemigo (from 'enemy')    : orbe violeta con núcleo oscuro y anillo
//            pulsante (miedo, no juguete).
//   fallback                  : gema flotante facetada con brillo alterno.
// ============================================================

import type { Projectile } from '../types';
import { hash2 } from '../world/palette';

// ---------------- utilidades ----------------

/** hash2 normalizado (convención del repo: el hash nativo devuelve [0,0.5)). */
function h2(a: number, b: number): number {
  return hash2(a | 0, b | 0) * 2;
}

/** Alpha clampeada a [0,1] (nunca sale del rango válido). */
function setA(ctx: CanvasRenderingContext2D, a: number): void {
  ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a;
}

/** 8 direcciones por octante de atan2: índice = round(ángulo / 45°) & 7. */
const OCT_X = [1, 1, 0, -1, -1, -1, 0, 1];
const OCT_Y = [0, 1, 1, 1, 0, -1, -1, -1];

function octIdx(vx: number, vy: number): number {
  return Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) & 7;
}

/** Dirección de viaje cuantizada; si el proyectil está parado usa `still`. */
function travel(pr: Projectile, still: number): number {
  return pr.vx * pr.vx + pr.vy * pr.vy > 0.01 ? octIdx(pr.vx, pr.vy) : still;
}

// scratch de módulo para el zigzag (cero allocations por frame)
const BOLT_X = new Int32Array(4);
const BOLT_Y = new Int32Array(4);

// posiciones del destello del hielo (rotación en pasos discretos de 90°)
const ICE_GLINT = [5, 0, 0, 5, -5, 0, 0, -5];

// ---------------- FUEGO ----------------

function drawFire(ctx: CanvasRenderingContext2D, X: number, Y: number, pr: Projectile, gT: number): void {
  // parado: la estela cae hacia abajo (la bola "sube")
  const oct = travel(pr, 6);
  const ux = OCT_X[oct], uy = OCT_Y[oct];
  const px = -uy, py = ux;
  const tf = Math.floor(gT * 14); // parpadeo rápido (~71 ms)

  // halo tenue (dos capas para caída suave)
  setA(ctx, 0.07);
  ctx.fillStyle = '#ff8830';
  ctx.fillRect(X - 6, Y - 6, 12, 12);
  setA(ctx, 0.1);
  ctx.fillRect(X - 4, Y - 4, 8, 8);

  // cuerpo naranja + sombra interna
  setA(ctx, 1);
  ctx.fillStyle = '#ff7830';
  ctx.fillRect(X - 3, Y - 3, 6, 6);
  ctx.fillStyle = '#e85a20';
  ctx.fillRect(X - 3, Y + 1, 6, 2);

  // núcleo blanco 2px
  ctx.fillStyle = '#fff8f0';
  ctx.fillRect(X - 1, Y - 1, 2, 2);

  // lenguas de llama (3) que flamean con offset por hash(globalT rápido)
  for (let i = 0; i < 3; i++) {
    const r = h2(tf * 7 + i * 31, i * 13 + tf * 3);
    const r2 = h2(tf * 11 + i * 5, i * 41 - tf);
    const dx = Math.round((r - 0.5) * 4); // ±2 px
    const fl = (r2 * 2) | 0;              // 0..1 px de salto
    ctx.fillStyle = i === 1 ? '#ffd24a' : '#ff9a40';
    ctx.fillRect(X + (i - 1) * 2 + dx - 1, Y - 4 - fl, 2, 2 + fl);
  }

  // estela: 3 brasas decrecientes detrás según -vx,-vy (con wobble)
  const w1 = Math.round((h2(tf + 57, 91) - 0.5) * 2);
  const w2 = Math.round((h2(tf + 23, 77) - 0.5) * 2);
  const w3 = Math.round((h2(tf + 61, 13) - 0.5) * 2);
  ctx.fillStyle = '#ff9040';
  setA(ctx, 0.5);
  ctx.fillRect(X - ux * 6 + px * w1 - 1, Y - uy * 6 + py * w1 - 1, 3, 3);
  ctx.fillStyle = '#ff7830';
  setA(ctx, 0.34);
  ctx.fillRect(X - ux * 10 + px * w2 - 1, Y - uy * 10 + py * w2 - 1, 2, 2);
  ctx.fillStyle = '#e85a20';
  setA(ctx, 0.2);
  ctx.fillRect(X - ux * 14 + px * w3, Y - uy * 14 + py * w3, 1, 1);

  ctx.globalAlpha = 1;
}

// ---------------- HIELO ----------------

function drawIce(ctx: CanvasRenderingContext2D, X: number, Y: number, pr: Projectile, gT: number): void {
  const oct = travel(pr, 0);
  const ux = OCT_X[oct], uy = OCT_Y[oct];
  const px = -uy, py = ux;
  const tq = Math.floor(gT * 8); // pasos discretos (~125 ms)

  // brillo frío (halo)
  setA(ctx, 0.07);
  ctx.fillStyle = '#8ad4f0';
  ctx.fillRect(X - 6, Y - 6, 12, 12);
  setA(ctx, 0.09);
  ctx.fillRect(X - 4, Y - 4, 8, 8);

  // cristal en cruz
  setA(ctx, 1);
  ctx.fillStyle = '#a0e8ff';
  ctx.fillRect(X - 4, Y - 1, 8, 2);
  ctx.fillRect(X - 1, Y - 4, 2, 8);

  // rombo: puntas diagonales + faceta clara central
  ctx.fillStyle = '#7ec4e8';
  ctx.fillRect(X - 2, Y - 2, 1, 1);
  ctx.fillRect(X + 1, Y - 2, 1, 1);
  ctx.fillRect(X - 2, Y + 1, 1, 1);
  ctx.fillRect(X + 1, Y + 1, 1, 1);
  ctx.fillStyle = '#c8f2ff';
  ctx.fillRect(X - 1, Y - 1, 2, 2);

  // destello que rota en pasos discretos alrededor del cristal
  const gi = (tq & 3) * 2;
  ctx.fillStyle = '#f0fbff';
  ctx.fillRect(X + ICE_GLINT[gi], Y + ICE_GLINT[gi + 1], 1, 1);

  // 3 esquirlas satélite de 1 px orbitando (en saltos discretos)
  const base = tq * 0.6283; // ≈36° por paso
  for (let i = 0; i < 3; i++) {
    const a = base + i * 2.0944;
    ctx.fillStyle = '#d8f6ff';
    ctx.fillRect(X + Math.round(Math.cos(a) * 5), Y + Math.round(Math.sin(a) * 5), 1, 1);
  }

  // estela: polvo de escarcha detrás según -vx,-vy
  for (let i = 0; i < 3; i++) {
    const d = 6 + i * 4;
    const w = Math.round((h2(tq * 5 + i * 29, i * 41 + 7) - 0.5) * 2);
    setA(ctx, 0.4 - i * 0.11);
    ctx.fillStyle = '#c8ecff';
    if (i === 2) {
      ctx.fillRect(X - ux * d + px * w, Y - uy * d + py * w, 1, 1);
    } else {
      ctx.fillRect(X - ux * d + px * w - 1, Y - uy * d + py * w - 1, 2, 2);
    }
  }

  ctx.globalAlpha = 1;
}

// ---------------- RAYO ----------------

function drawBolt(ctx: CanvasRenderingContext2D, X: number, Y: number, pr: Projectile, gT: number): void {
  const sp = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy);
  const ux = sp > 0.01 ? pr.vx / sp : 1;
  const uy = sp > 0.01 ? pr.vy / sp : 0;
  const px = -uy, py = ux;
  const seed = Math.floor(gT / 0.09); // re-seed del relámpago cada ~90 ms
  // longitud según velocidad (6..13 px + micro-latido por semilla)
  const L = Math.round(6 + Math.min(7, sp * 0.02)) + Math.round(h2(seed * 13 + 5, 101) * 2) - 1;

  // vértices del zigzag: extremos anclados al eje, mitades desviadas por hash
  for (let i = 0; i < 4; i++) {
    const along = -L + Math.round((2 * L * i) / 3);
    const off = i === 0 || i === 3 ? 0 : Math.round((h2(seed * 31 + i * 17, i * 57 + seed * 7) - 0.5) * 8);
    BOLT_X[i] = Math.round(X + ux * along + px * off);
    BOLT_Y[i] = Math.round(Y + uy * along + py * off);
  }

  // halo violeta bajo los tramos
  setA(ctx, 0.18);
  ctx.fillStyle = '#8a4ad8';
  for (let i = 0; i < 3; i++) {
    const mx = (BOLT_X[i] + BOLT_X[i + 1]) >> 1;
    const my = (BOLT_Y[i] + BOLT_Y[i + 1]) >> 1;
    ctx.fillRect(mx - 2, my - 2, 4, 4);
  }

  // núcleo claro: cadena de bloques 2×2 entre vértices (zigzag REAL)
  setA(ctx, 0.9);
  ctx.fillStyle = '#ffe86a';
  for (let i = 0; i < 3; i++) {
    const x0 = BOLT_X[i], y0 = BOLT_Y[i];
    const dx = BOLT_X[i + 1] - x0, dy = BOLT_Y[i + 1] - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let s = 0; s <= steps; s++) {
      const bx = Math.round(x0 + (dx * s) / steps);
      const by = Math.round(y0 + (dy * s) / steps);
      ctx.fillRect(bx - 1, by - 1, 2, 2);
    }
  }

  // chispas blancas en los vértices
  setA(ctx, 1);
  ctx.fillStyle = '#fff8d8';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(BOLT_X[i] - 1, BOLT_Y[i] - 1, 1, 1);
    ctx.fillRect(BOLT_X[i] + (i & 1), BOLT_Y[i] - (i & 1), 1, 1);
  }

  ctx.globalAlpha = 1;
}

// ---------------- FLECHA (compañera) ----------------

function drawArrow(ctx: CanvasRenderingContext2D, X: number, Y: number, pr: Projectile, gT: number): void {
  const oct = octIdx(pr.vx, pr.vy); // parado → este, sin excepción
  const ux = OCT_X[oct], uy = OCT_Y[oct];
  const px = -uy, py = ux;
  const tf = Math.floor(gT * 10);

  // asta de madera (6 bloques 2×2 encadenados)
  setA(ctx, 1);
  ctx.fillStyle = '#d8c8a0';
  for (let k = -4; k <= 1; k++) {
    ctx.fillRect(X + k * ux - 1, Y + k * uy - 1, 2, 2);
  }

  // punta de hierro, 2 tonos (cara clara + vértice oscuro adelantado)
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(X + 2 * ux - 1, Y + 2 * uy - 1, 3, 3);
  ctx.fillStyle = '#a8a4b4';
  ctx.fillRect(X + 3 * ux - 1, Y + 3 * uy - 1, 2, 2);

  // plumas 2px en V (dos pares abriéndose hacia atrás)
  ctx.fillStyle = '#f0e8d0';
  ctx.fillRect(X - 3 * ux + px - 1, Y - 3 * uy + py - 1, 2, 2);
  ctx.fillRect(X - 3 * ux - px - 1, Y - 3 * uy - py - 1, 2, 2);
  ctx.fillRect(X - 5 * ux + px * 2 - 1, Y - 5 * uy + py * 2 - 1, 2, 2);
  ctx.fillRect(X - 5 * ux - px * 2 - 1, Y - 5 * uy - py * 2 - 1, 2, 2);

  // estela sutil (2 bloques que se desvanecen)
  const w = Math.round((h2(tf + 9, oct * 7 + 3) - 0.5) * 2);
  ctx.fillStyle = '#d8c8a0';
  setA(ctx, 0.3);
  ctx.fillRect(X - 8 * ux + px * w - 1, Y - 8 * uy + py * w - 1, 2, 2);
  setA(ctx, 0.15);
  ctx.fillRect(X - 11 * ux + px * w, Y - 11 * uy + py * w, 1, 1);

  // filo elemental 1px si el canto tiene elemento
  if (pr.element !== 'ninguno') {
    ctx.fillStyle = projectileColor(pr.element);
    setA(ctx, 0.95);
    ctx.fillRect(X + 3 * ux + px, Y + 3 * uy + py, 1, 1);
    ctx.fillRect(X + 3 * ux - px, Y + 3 * uy - py, 1, 1);
    ctx.fillRect(X + 2 * ux, Y + 2 * uy, 1, 1);
  }

  ctx.globalAlpha = 1;
}

// ---------------- PROYECTIL ENEMIGO ----------------

function drawEnemyOrb(ctx: CanvasRenderingContext2D, X: number, Y: number, gT: number): void {
  const tf = Math.floor(gT * 6);
  const wob = Math.round((h2(tf * 17 + 3, 71) - 0.5) * 2); // temblor ±1 px
  const pu = Math.sin(gT * 7); // pulso del anillo

  // halo de miedo
  setA(ctx, 0.08);
  ctx.fillStyle = '#5a2a9a';
  ctx.fillRect(X - 7, Y - 7, 14, 14);
  setA(ctx, 0.1);
  ctx.fillRect(X - 5 + wob, Y - 5, 10, 10);

  // orbe violeta con volumen
  setA(ctx, 1);
  ctx.fillStyle = '#8a5ad8';
  ctx.fillRect(X - 4, Y - 4, 8, 8);
  ctx.fillStyle = '#6a3aa8';
  ctx.fillRect(X - 4, Y + 1 + wob, 8, 3);

  // núcleo oscuro (miedo, no juguete)
  ctx.fillStyle = '#241040';
  ctx.fillRect(X - 2, Y - 2 - wob, 4, 4);
  // borde frío
  ctx.fillStyle = '#c8a0ff';
  ctx.fillRect(X - 4, Y - 4, 8, 1);

  // anillo pulsante (radio y alpha discretos)
  setA(ctx, 0.42 + pu * 0.22);
  ctx.fillStyle = '#b078f0';
  const rr = pu > 0 ? 6 : 5;
  ctx.fillRect(X - rr - 1, Y - 1, 2, 2);
  ctx.fillRect(X + rr, Y - 1, 2, 2);
  ctx.fillRect(X - 1, Y - rr - 1, 2, 2);
  ctx.fillRect(X - 1, Y + rr, 2, 2);

  ctx.globalAlpha = 1;
}

// ---------------- FALLBACK: gema flotante ----------------

function drawGem(ctx: CanvasRenderingContext2D, X: number, Y: number, gT: number): void {
  const bob = (Math.floor(gT * 3) & 1) === 0 ? 0 : -1; // flotación discreta
  const tw = Math.floor(gT * 3);

  // halo
  setA(ctx, 0.1);
  ctx.fillStyle = '#b48ae8';
  ctx.fillRect(X - 4, Y - 4 + bob, 8, 8);

  // gema flotante facetada
  setA(ctx, 1);
  ctx.fillStyle = '#b48ae8';
  ctx.fillRect(X - 2, Y - 2 + bob, 4, 4);
  ctx.fillStyle = '#d8c0f8';
  ctx.fillRect(X - 1, Y - 3 + bob, 2, 1);
  ctx.fillRect(X - 1, Y + 2 + bob, 2, 1);
  ctx.fillStyle = '#8a5ab8';
  ctx.fillRect(X + 1, Y - 1 + bob, 1, 2);
  ctx.fillStyle = '#f0e6ff';
  ctx.fillRect(X - 2, Y - 2 + bob, 1, 1);

  // destello alterno (parpadeo determinista)
  if ((tw & 1) === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(X + 3, Y - 4 + bob, 1, 1);
  } else {
    ctx.fillStyle = '#e8d0ff';
    ctx.fillRect(X - 4, Y + 3 + bob, 1, 1);
  }

  ctx.globalAlpha = 1;
}

// ---------------- CONTRATO PÚBLICO ----------------

/** Dibuja UN proyectil en coordenadas de PANTALLA (x,y ya con sx/sy).
 *  Determinista, enteros, alpha clampeada; restaurar globalAlpha a 1. */
export function drawProjectileV2(
  ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, globalT: number,
): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  if (pr.from === 'enemy') { drawEnemyOrb(ctx, X, Y, globalT); return; }
  if (pr.sprite === 'p_arrow' || pr.from === 'companion') { drawArrow(ctx, X, Y, pr, globalT); return; }
  if (pr.sprite === 'p_fire' || pr.element === 'fuego') { drawFire(ctx, X, Y, pr, globalT); return; }
  if (pr.sprite === 'p_ice' || pr.element === 'hielo') { drawIce(ctx, X, Y, pr, globalT); return; }
  if (pr.element === 'rayo') { drawBolt(ctx, X, Y, pr, globalT); return; }
  drawGem(ctx, X, Y, globalT);
}

/** Color representativo por elemento (partículas de estela del integrador). */
export function projectileColor(element: string): string {
  switch (element) {
    case 'fuego': return '#ff7830';
    case 'hielo': return '#a0e8ff';
    case 'rayo': return '#ffe86a';
    case 'sombra': return '#9a6ae0';
    case 'sagrado': return '#ffe9a0';
    case 'ninguno': return '#e8d0ff';
    default: return '#e8d0ff';
  }
}
