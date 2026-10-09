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
//
// ---------------- R9-4 · MAGIAS ESPECTACULARES (contrato para el integrador) ----------------
//
// CARGA VISIBLE (drawSpellCast): en castSkill (engine.ts) para 'ascuas' /
//   'escarcha' / 'chispa' / 'cantomayor', registrar una entrada en un pool
//   (p.ej. g.spellFx: { x: p.x + nx*8, y: p.y - 6 + ny*8, element, age: 0,
//   seed }) y en drawCombatFx (render.ts) llamar por cada entrada:
//
//     drawSpellCast(ctx, sx(f.x), sy(f.y), f.element, f.age, g.globalT, f.seed)
//
//   avanzando f.age += dt y liberando el slot al pasar SPELL_CAST_TIME (0.22 s).
//   Opción A (recomendada, sin tocar gameplay): el proyectil sale en castT=0 y
//   la carga se dibuja como arranque convergente (el Eco "se libera").
//   Opción B (retraso real): retrasar el push del proyectil SPELL_CAST_TIME.
//   El punto de casteo ES la punta del instrumento (spawn del proyectil), así
//   que el brillo creciente ya lee como "el arma se enciende".
//
// IMPACTO + RESIDUO (una entrada, dos fases): donde el proyectil del jugador
//   muere al golpear (update.ts, rama `dead` del loop de proyectiles, junto al
//   g.burst existente — y también en aoeHit para 'cantomayor'), registrar
//   { x: pr.x, y: pr.y, element, seed: (pr.x * 3 + pr.y * 5) | 0, age: 0 }.
//   En drawCombatFx:
//
//     if (f.age < SPELL_IMPACT_TIME)
//       drawSpellImpact(ctx, sx(f.x), sy(f.y), f.element, f.age, f.seed, g.globalT);
//     else if (f.age < SPELL_IMPACT_TIME + SPELL_RESIDUE_TIME)
//       drawSpellResidue(ctx, sx(f.x), sy(f.y), f.element,
//                        f.age - SPELL_IMPACT_TIME, f.seed, g.globalT);
//
//   El seed debe fijarse UNA vez al morir el proyectil (posiciones/ángulos de
//   las chispas estables entre frames). Pool con el mismo patrón WeakMap que
//   UiHit en ui.ts (slots reescritos, cero alloc por frame).
//
// MICRO-SACUDIDA AL MATAR (screenshake del motor — solo consumo, no se
//   implementa aquí): spells.ts es draw-only y no toca g. En el sitio donde el
//   golpe de hechizo REMATA (damageEnemy → muerte), el orquestador ya tiene el
//   patrón exacto: addShake(g, 2.5) de fxcore.ts (update.ts ya lo importa).
//
// ESTELA MUSICAL: NO requiere integración — vive dentro de drawFire/drawIce/
//   drawBolt/drawGem (drawEcoTrail), ya cableado vía drawProjectileV2.
//
// ENGANCHES DE AUDIO (APIs YA creadas por R9-8 en audio.ts — cablearlas es del
//   orquestador; spells.ts NO las llama todavía):
//   playSpellCast()       — arranque del casteo (carga convergente)
//   playSpellImpact(big)  — impacto contundente (flash + onda); big = true si
//                           el golpe MATA (empareja con el addShake de remate)
//   (el residuo no lleva sonido propio — deliberado: es ambiente)
// ============================================================

import type { Projectile } from '../types';
import { VIEW_W, VIEW_H } from '../consts';
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

// ---------------- R9-4 · TABLAS Y GLIFOS DEL ECO (module-level, cero alloc) ----------------

/** Duración del casteo visible (s): ventana de drawSpellCast (~150-250 ms). */
export const SPELL_CAST_TIME = 0.22;
/** Duración del impacto (s): flash + onda expansiva + chispas que caen. */
export const SPELL_IMPACT_TIME = 0.45;
/** Duración del residuo mágico flotante (s): notas que se disuelven. */
export const SPELL_RESIDUE_TIME = 1.0;

/** Color núcleo brillante por elemento (flash / núcleo de carga). */
export function spellCoreColor(element: string): string {
  switch (element) {
    case 'fuego': return '#fff8f0';
    case 'hielo': return '#ffffff';
    case 'rayo': return '#fffbe0';
    case 'sombra': return '#e8d0ff';
    case 'sagrado': return '#fffdf0';
    default: return '#ffffff';
  }
}

/** Color halo suave por elemento (ondas del Eco, halos de estela). */
export function spellHaloColor(element: string): string {
  switch (element) {
    case 'fuego': return '#ff9a40';
    case 'hielo': return '#8ad4f0';
    case 'rayo': return '#ffe86a';
    case 'sombra': return '#9a6ae0';
    case 'sagrado': return '#f0c84a';
    default: return '#b48ae8';
  }
}

/** Anillo pixelado: 16 puntos en radio `r` (2π/16 = 0.3927 rad por punto). */
function drawRing(
  ctx: CanvasRenderingContext2D, X: number, Y: number, r: number,
  color: string, alpha: number, phase: number, every: number,
): void {
  if (alpha <= 0.02) return;
  setA(ctx, alpha);
  ctx.fillStyle = color;
  const rr = Math.round(r);
  // dash rotatorio determinista (step normalizado a positivo: JS % con negativos)
  const step = every > 0 ? ((Math.floor(phase * 16) % 16) + 16) % 16 : 0;
  for (let i = 0; i < 16; i++) {
    if (every > 0 && (i + step) % every !== 0) continue;
    const a = i * 0.3927 + phase;
    ctx.fillRect(X + Math.round(Math.cos(a) * rr), Y + Math.round(Math.sin(a) * rr), 1, 1);
  }
}

/** Corchea pixel (~3×6) centrada en (X,Y) — deben ser enteros redondeados.
 *  `parts` es máscara de disolución: 1 cabeza · 2 asta · 4 banderín.
 *  (3 = nota mini, 7 = nota completa; el residuo muere cabeza al final). */
function drawNotaGlyph(
  ctx: CanvasRenderingContext2D, X: number, Y: number, col: string, alpha: number, parts: number,
): void {
  if (alpha <= 0.02) return;
  setA(ctx, alpha);
  ctx.fillStyle = col;
  if (parts & 1) ctx.fillRect(X - 2, Y, 3, 2);       // cabeza
  if (parts & 2) ctx.fillRect(X + 1, Y - 4, 1, 5);   // asta
  if (parts & 4) { ctx.fillRect(X + 1, Y - 5, 2, 1); ctx.fillRect(X + 2, Y - 4, 1, 1); } // banderín
}

/** R9-4 · Estela musical del Eco detrás de un proyectil del jugador: 4
 *  segmentos en onda senoidal PERPENDICULAR determinista (fase que viaja hacia
 *  atrás, sin hash: función pura de globalT) + nota de cierre + núcleo que
 *  respira. Añadida a fuego/hielo/rayo/gema tras su dibujo propio.
 *  ux,uy = dirección de viaje; px,py = perpendicular (px=-uy, py=ux). */
function drawEcoTrail(
  ctx: CanvasRenderingContext2D, X: number, Y: number,
  ux: number, uy: number, px: number, py: number, el: string, gT: number,
): void {
  const core = spellCoreColor(el), mid = projectileColor(el), soft = spellHaloColor(el);
  // onda perpendicular: segmentos que se encogen y desvanecen hacia atrás
  for (let k = 0; k < 4; k++) {
    const d = 7 + k * 4;
    const w = Math.sin(gT * 11 - k * 1.35) * (2.2 - k * 0.42);
    const sx = Math.round(X - ux * d + px * w);
    const sy = Math.round(Y - uy * d + py * w);
    setA(ctx, 0.5 - k * 0.11);
    ctx.fillStyle = k < 2 ? mid : soft;
    if (k < 2) ctx.fillRect(sx - 1, sy - 1, 2, 2);
    else ctx.fillRect(sx, sy, k === 2 ? 2 : 1, 1);
  }
  // nota de cierre: la estela ES una frase musical (mini nota al final)
  const wn = Math.sin(gT * 11 - 5.4) * 0.6;
  drawNotaGlyph(ctx, Math.round(X - ux * 24 + px * wn), Math.round(Y - uy * 24 + py * wn), mid, 0.3, 3);
  // núcleo que respira (el Eco late en la punta: brillo con pulso senoidal)
  const br = 0.2 + 0.14 * Math.sin(gT * 13);
  setA(ctx, br);
  ctx.fillStyle = core;
  ctx.fillRect(X - 2, Y - 2, 4, 4);
  setA(ctx, br + 0.5 > 1 ? 1 : br + 0.5);
  ctx.fillRect(X - 1, Y - 1, 2, 2);
}

// ---------------- R9-4 · CAST: CARGA VISIBLE ----------------

/** Carga del hechizo en el punto de casteo (punta del instrumento): 2 ondas
 *  del Eco que CONVERGEN (dash rotatorio inverso al de la onda expansiva),
 *  7 notas que cierran en espiral hacia el núcleo, círculo de carga creciente
 *  y núcleo que se enciende; tramo final con cruz blanca de anticipación.
 *  Llamar cada frame con castT ∈ [0, SPELL_CAST_TIME] mientras dura el casteo.
 *  seed opcional (determinista por defecto a partir de la posición). */
export function drawSpellCast(
  ctx: CanvasRenderingContext2D, x: number, y: number, element: string,
  castT: number, globalT: number, seed?: number,
): void {
  const X = Math.round(x), Y = Math.round(y);
  if (X < -32 || X > VIEW_W + 32 || Y < -32 || Y > VIEW_H + 32) return;
  const sd = seed !== undefined ? seed | 0 : (Math.imul(X, 73856093) ^ Math.imul(Y, 19349663)) | 0;
  const p = castT <= 0 ? 0 : castT >= SPELL_CAST_TIME ? 1 : castT / SPELL_CAST_TIME;
  const pe = p * p * (3 - 2 * p); // smoothstep: arranca suave, remata fuerte
  const core = spellCoreColor(element), mid = projectileColor(element), soft = spellHaloColor(element);

  // 1) ondas del Eco que convergen (lo INVERSO de la onda expansiva del golpe)
  for (let k = 0; k < 2; k++) {
    const r = (26 - k * 8) * (1 - pe) + 3;
    drawRing(ctx, X, Y, r, k === 0 ? mid : soft, 0.1 + pe * 0.24, -globalT * (2.4 + k) + k * 0.5, 2);
  }

  // 2) notas que convergen en espiral (radio inicial escalonado 13..22 px)
  for (let i = 0; i < 7; i++) {
    const a0 = h2(sd + i * 97 + 13, i * 53 + 71) * 6.2832;
    const r0 = 13 + h2(sd + i * 41, i * 29 + 7) * 9;
    const r = r0 * (1 - pe);
    if (r < 1.5) continue; // ya llegó: se funde con el núcleo
    const sw = a0 + pe * (2.2 + (i & 1) * 0.9); // giro determinista al cerrar
    const nx = Math.round(X + Math.cos(sw) * r);
    const ny = Math.round(Y + Math.sin(sw) * r * 0.85); // elipse sutil
    const near = r < 8;
    const tw = 0.55 + 0.45 * Math.sin(globalT * (9 + (i & 3) * 2.3) + i * 1.7); // titila por nota
    drawNotaGlyph(ctx, nx, ny, near ? core : mid, (0.25 + pe * 0.75) * tw, near ? 7 : 3);
  }

  // 3) círculo de carga creciente + núcleo/halo que crecen ("esto va a doler")
  drawRing(ctx, X, Y, 3 + 6 * pe, core, 0.25 + 0.55 * pe, globalT * 3.1, 0);
  const hs = 4 + ((pe * 7) | 0); // halo 4..11 px
  setA(ctx, 0.1 + 0.22 * pe);
  ctx.fillStyle = soft;
  ctx.fillRect(X - (hs >> 1), Y - (hs >> 1), hs, hs);
  const cs = 1 + ((pe * 3) | 0); // núcleo 1..4 px
  setA(ctx, 0.5 + 0.5 * pe);
  ctx.fillStyle = core;
  ctx.fillRect(X - (cs >> 1), Y - (cs >> 1), cs, cs);

  // 4) anticipación: cruz blanca en el tramo final del casteo
  if (pe > 0.82) {
    const fa = (pe - 0.82) / 0.18;
    setA(ctx, fa * 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(X - 3, Y, 7, 1);
    ctx.fillRect(X, Y - 3, 1, 7);
    setA(ctx, fa * 0.5);
    ctx.fillRect(X - 2, Y - 2, 5, 5);
  }
  ctx.globalAlpha = 1;
}

// ---------------- R9-4 · IMPACTO CONTUNDENTE ----------------

/** Impacto de hechizo en (x,y): flash blanco 2-3 frames → doble onda
 *  expansiva (anillo principal + eco retrasado = "acorde") + 8 chispas de
 *  residuo mágico con gravedad (ángulos/velocidades deterministas por seed).
 *  Llamar cada frame con age ∈ [0, SPELL_IMPACT_TIME]; seed FIJADO 1 vez al
 *  morir el proyectil. La micro-sacudida al matar es del motor (addShake).
 *  Continúa con drawSpellResidue para el residuo flotante. */
export function drawSpellImpact(
  ctx: CanvasRenderingContext2D, x: number, y: number, element: string,
  age: number, seed: number, globalT: number,
): void {
  const X = Math.round(x), Y = Math.round(y);
  if (X < -32 || X > VIEW_W + 32 || Y < -32 || Y > VIEW_H + 32) return;
  const a = age <= 0 ? 0 : age >= SPELL_IMPACT_TIME ? 1 : age / SPELL_IMPACT_TIME;
  const core = spellCoreColor(element), mid = projectileColor(element);

  // 1) FLASH blanco (age < 0.05 s ≈ 2-3 frames): el golpe antes de la onda
  if (age < 0.05) {
    const fa = 1 - age / 0.05;
    setA(ctx, 0.25 * fa);
    ctx.fillStyle = mid;
    ctx.fillRect(X - 6, Y - 6, 12, 12);
    setA(ctx, 0.9 * fa);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(X - 3, Y - 3, 7, 7);
    ctx.fillRect(X - 5, Y - 1, 11, 3);
    ctx.fillRect(X - 1, Y - 5, 3, 11);
  }

  // 2) onda expansiva doble: anillo principal (solid) + eco retrasado (dash)
  const e1 = 1 - (1 - a) * (1 - a); // easeOut
  drawRing(ctx, X, Y, 3 + 13 * e1, core, (1 - a) * 0.8, 0, 0);
  if (age > 0.06) {
    const a2 = age >= SPELL_IMPACT_TIME + 0.06 ? 1 : (age - 0.06) / SPELL_IMPACT_TIME;
    const e2 = 1 - (1 - a2) * (1 - a2);
    drawRing(ctx, X, Y, 2 + 9 * e2, mid, (1 - a2) * 0.45, 0.39, 2);
  }
  // peso cardinal en la primera mitad (la onda "empuja")
  if (a < 0.5) {
    const rr = Math.round(3 + 13 * e1);
    setA(ctx, (1 - a * 2) * 0.7);
    ctx.fillStyle = core;
    ctx.fillRect(X - rr - 1, Y - 1, 2, 2);
    ctx.fillRect(X + rr, Y - 1, 2, 2);
    ctx.fillRect(X - 1, Y - rr - 1, 2, 2);
    ctx.fillRect(X - 1, Y + rr, 2, 2);
  }

  // 3) residuo mágico que cae: 8 chispas balísticas (deterministas por seed)
  for (let i = 0; i < 8; i++) {
    if (((Math.floor(globalT * 18) + i * 5) & 7) === 0) continue; // parpadeo
    const an = h2(seed + i * 37, i * 53 + 11) * 6.2832;
    const sp = 26 + h2(seed + i * 17 + 3, i * 91 + 29) * 34;
    const qx = Math.round(X + Math.cos(an) * sp * age);
    const qy = Math.round(Y + Math.sin(an) * sp * age * 0.8 + 46 * age * age); // caen
    const sz = age < 0.22 ? 2 : 1;
    setA(ctx, (1 - a) * 0.85);
    ctx.fillStyle = (i & 1) === 0 ? core : mid;
    ctx.fillRect(qx - (sz >> 1), qy - (sz >> 1), sz, sz);
  }
  ctx.globalAlpha = 1;
}

// ---------------- R9-4 · RESIDUO MÁGICO ----------------

/** Tras el impacto quedan 2 notas tenues flotando ~1 s que se DISUELVEN
 *  (cabeza → asta → banderín) mientras ascienden y balancean. Barato: ~10
 *  rects pico. Llamar con age ∈ [0, SPELL_RESIDUE_TIME] (age ya descontado
 *  del IMPACT, ver contrato). */
export function drawSpellResidue(
  ctx: CanvasRenderingContext2D, x: number, y: number, element: string,
  age: number, seed: number, globalT: number,
): void {
  const X = Math.round(x), Y = Math.round(y);
  if (X < -32 || X > VIEW_W + 32 || Y < -32 || Y > VIEW_H + 32) return;
  if (age < 0) return;
  const a = age >= SPELL_RESIDUE_TIME ? 1 : age / SPELL_RESIDUE_TIME;
  if (a >= 1) return;
  const mid = projectileColor(element), core = spellCoreColor(element);
  const fadeIn = age * 10 < 1 ? age * 10 : 1;
  for (let i = 0; i < 2; i++) {
    const ox = (h2(seed + i * 31, i * 57 + 77) - 0.5) * 12;
    const oy = -3 - h2(seed + i * 19 + 5, i * 23 + 41) * 5 - age * 4; // flota y sube
    const bob = Math.sin(globalT * 3.1 + i * 2.6 + h2(seed + i, 7) * 6.28) * 1.5;
    const nx = Math.round(X + ox), ny = Math.round(Y + oy + bob);
    const parts = a < 0.55 ? 7 : a < 0.8 ? 3 : 1; // se deshace por piezas
    const al = fadeIn * (1 - a) * (1 - a) * 0.55;  // tenue, disolución cuadrática
    drawNotaGlyph(ctx, nx, ny, i === 0 ? mid : core, al, parts);
    // brillito de disolución (parpadeo determinista)
    if (((Math.floor(globalT * 14) + i * 3) & 3) === 0) {
      const sa = al * 1.4 > 1 ? 1 : al * 1.4;
      setA(ctx, sa);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(nx + (i === 0 ? -2 : 2), ny - 1, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------- R5-O8 · CUERPOS HORNEADOS (sprites prerrenderizados) ----------------
/**
 * Los proyectiles v2 NO crean gradientes ni paths, pero cada uno encadena
 * ~10-15 fillRect con cambios de fillStyle/alpha POR PROYECTIL Y FRAME. Las
 * partes ESTÁTICAS (halo + cuerpo + núcleo / asta + punta + plumas) se hornean
 * a minicanvases y se vuelcan con 1 drawImage; las partes DINÁMICAS (lenguas,
 * estelas, destellos, anillos) siguen siendo fillRect con hash. Composite
 * IDÉNTICO: source-over es asociativo, así que hornear las capas (mismos rects,
 * mismos alphas, mismo orden) sobre transparente y volcar con globalAlpha 1
 * produce exactamente los mismos píxeles que pintarlas en orden sobre el
 * canvas principal. Si no hay DOM (harness), sprOk=false → rutas directas
 * originales (comportamiento de hoy, píxel a píxel).
 */

/** Crea un canvas w×h, pinta con `paint` y lo devuelve; null si no hay DOM. */
function paintSpr(w: number, h: number, paint: (x: CanvasRenderingContext2D) => void): HTMLCanvasElement | null {
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    if (!x) return null;
    paint(x);
    return c;
  } catch {
    return null;
  }
}

// fuego 14×14 (centro 7): halo 2 capas + cuerpo + sombra + núcleo (estáticos)
// hielo 14×14 (centro 7): halo + cristal en cruz + rombo + faceta (estáticos)
// orbe  16×16 (centro 8): halo + cuerpo + núcleo + borde, 1 variante por wob
// flecha 24×24 (centro 12): asta + punta + plumas, 1 variante por octante
// gema  12×12 (centro 6): halo + cuerpo facetado (el bob va en el drawImage)
let FIRE_SPR: HTMLCanvasElement | null = null;
let ICE_SPR: HTMLCanvasElement | null = null;
let GEM_SPR: HTMLCanvasElement | null = null;
const ORB_SPR: (HTMLCanvasElement | null)[] = [null, null, null]; // wob −1|0|1 → idx 0|1|2
const ARROW_SPR: (HTMLCanvasElement | null)[] = [null, null, null, null, null, null, null, null];
let sprTried = false;
let sprOk = false; // false → rutas de dibujo directas (sin sprites)

function paintOrbSpr(x: CanvasRenderingContext2D, wob: number): void {
  x.globalAlpha = 0.08;
  x.fillStyle = '#5a2a9a';
  x.fillRect(1, 1, 14, 14);
  x.globalAlpha = 0.1;
  x.fillRect(3 + wob, 3, 10, 10);
  x.globalAlpha = 1;
  x.fillStyle = '#8a5ad8';
  x.fillRect(4, 4, 8, 8);
  x.fillStyle = '#6a3aa8';
  x.fillRect(4, 9 + wob, 8, 3);
  x.fillStyle = '#241040';
  x.fillRect(6, 6 - wob, 4, 4);
  x.fillStyle = '#c8a0ff';
  x.fillRect(4, 4, 8, 1);
}

function paintArrowSpr(x: CanvasRenderingContext2D, oct: number): void {
  const ux = OCT_X[oct], uy = OCT_Y[oct];
  const px = -uy, py = ux;
  x.globalAlpha = 1;
  x.fillStyle = '#d8c8a0';
  for (let k = -4; k <= 1; k++) x.fillRect(12 + k * ux - 1, 12 + k * uy - 1, 2, 2);
  x.fillStyle = '#e8e4d8';
  x.fillRect(12 + 2 * ux - 1, 12 + 2 * uy - 1, 3, 3);
  x.fillStyle = '#a8a4b4';
  x.fillRect(12 + 3 * ux - 1, 12 + 3 * uy - 1, 2, 2);
  x.fillStyle = '#f0e8d0';
  x.fillRect(12 - 3 * ux + px - 1, 12 - 3 * uy + py - 1, 2, 2);
  x.fillRect(12 - 3 * ux - px - 1, 12 - 3 * uy - py - 1, 2, 2);
  x.fillRect(12 - 5 * ux + px * 2 - 1, 12 - 5 * uy + py * 2 - 1, 2, 2);
  x.fillRect(12 - 5 * ux - px * 2 - 1, 12 - 5 * uy - py * 2 - 1, 2, 2);
}

/** Construye TODOS los sprites 1 vez (lazy); si algo falla → rutas directas. */
function ensureSprs(): void {
  if (sprTried) return;
  sprTried = true;
  FIRE_SPR = paintSpr(14, 14, (x) => {
    x.globalAlpha = 0.07;
    x.fillStyle = '#ff8830';
    x.fillRect(1, 1, 12, 12);
    x.globalAlpha = 0.1;
    x.fillRect(3, 3, 8, 8);
    x.globalAlpha = 1;
    x.fillStyle = '#ff7830';
    x.fillRect(4, 4, 6, 6);
    x.fillStyle = '#e85a20';
    x.fillRect(4, 8, 6, 2);
    x.fillStyle = '#fff8f0';
    x.fillRect(6, 6, 2, 2);
  });
  ICE_SPR = paintSpr(14, 14, (x) => {
    x.globalAlpha = 0.07;
    x.fillStyle = '#8ad4f0';
    x.fillRect(1, 1, 12, 12);
    x.globalAlpha = 0.09;
    x.fillRect(3, 3, 8, 8);
    x.globalAlpha = 1;
    x.fillStyle = '#a0e8ff';
    x.fillRect(3, 6, 8, 2);
    x.fillRect(6, 3, 2, 8);
    x.fillStyle = '#7ec4e8';
    x.fillRect(5, 5, 1, 1);
    x.fillRect(8, 5, 1, 1);
    x.fillRect(5, 8, 1, 1);
    x.fillRect(8, 8, 1, 1);
    x.fillStyle = '#c8f2ff';
    x.fillRect(6, 6, 2, 2);
  });
  GEM_SPR = paintSpr(12, 12, (x) => {
    x.globalAlpha = 0.1;
    x.fillStyle = '#b48ae8';
    x.fillRect(2, 2, 8, 8);
    x.globalAlpha = 1;
    x.fillRect(4, 4, 4, 4);
    x.fillStyle = '#d8c0f8';
    x.fillRect(5, 3, 2, 1);
    x.fillRect(5, 8, 2, 1);
    x.fillStyle = '#8a5ab8';
    x.fillRect(7, 5, 1, 2);
    x.fillStyle = '#f0e6ff';
    x.fillRect(4, 4, 1, 1);
  });
  for (let w = -1; w <= 1; w++) ORB_SPR[w + 1] = paintSpr(16, 16, (x) => paintOrbSpr(x, w));
  for (let o = 0; o < 8; o++) ARROW_SPR[o] = paintSpr(24, 24, (x) => paintArrowSpr(x, o));
  sprOk = !!(FIRE_SPR && ICE_SPR && GEM_SPR && ORB_SPR[0] && ORB_SPR[1] && ORB_SPR[2]
    && ARROW_SPR[0] && ARROW_SPR[1] && ARROW_SPR[2] && ARROW_SPR[3]
    && ARROW_SPR[4] && ARROW_SPR[5] && ARROW_SPR[6] && ARROW_SPR[7]);
}

// ---------------- FUEGO ----------------

function drawFire(ctx: CanvasRenderingContext2D, X: number, Y: number, pr: Projectile, gT: number): void {
  // parado: la estela cae hacia abajo (la bola "sube")
  const oct = travel(pr, 6);
  const ux = OCT_X[oct], uy = OCT_Y[oct];
  const px = -uy, py = ux;
  const tf = Math.floor(gT * 14); // parpadeo rápido (~71 ms)

  // halo tenue + cuerpo + núcleo HORNEADOS (1 drawImage; composite idéntico)
  if (sprOk && FIRE_SPR) {
    ctx.globalAlpha = 1;
    ctx.drawImage(FIRE_SPR, X - 7, Y - 7);
  } else {
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
  }

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

  // R9-4: estela musical del Eco (onda perpendicular + nota + núcleo late)
  drawEcoTrail(ctx, X, Y, ux, uy, px, py, 'fuego', gT);

  ctx.globalAlpha = 1;
}

// ---------------- HIELO ----------------

function drawIce(ctx: CanvasRenderingContext2D, X: number, Y: number, pr: Projectile, gT: number): void {
  const oct = travel(pr, 0);
  const ux = OCT_X[oct], uy = OCT_Y[oct];
  const px = -uy, py = ux;
  const tq = Math.floor(gT * 8); // pasos discretos (~125 ms)

  // halo + cristal + rombo + faceta HORNEADOS (1 drawImage; composite idéntico)
  if (sprOk && ICE_SPR) {
    ctx.globalAlpha = 1;
    ctx.drawImage(ICE_SPR, X - 7, Y - 7);
  } else {
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
  }

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

  // R9-4: estela musical del Eco (onda perpendicular + nota + núcleo late)
  drawEcoTrail(ctx, X, Y, ux, uy, px, py, 'hielo', gT);

  ctx.globalAlpha = 1;
}

// ---------------- RAYO ----------------

function drawBolt(ctx: CanvasRenderingContext2D, X: number, Y: number, pr: Projectile, gT: number): void {
  const sp = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy);
  const ux = sp > 0.01 ? pr.vx / sp : 1;
  const uy = sp > 0.01 ? pr.vy / sp : 0;
  const px = -uy, py = ux;
  const seed = Math.floor(gT / 0.09); // re-seed del relámpago cada ~90 ms

  // NOTA R5-O8: el rayo queda 100% dinámico (zigzag re-seedéado y ángulo
  // continuo según velocidad): prerrenderarlo exigiría una variante por
  // (semilla × ángulo) — no compensa; coste actual ~10-40 rects pico.
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

  // R9-4: estela musical del Eco (el zigzag ya ES la onda: nota + latido)
  drawEcoTrail(ctx, X, Y, ux, uy, px, py, 'rayo', gT);

  ctx.globalAlpha = 1;
}

// ---------------- FLECHA (compañera) ----------------

function drawArrow(ctx: CanvasRenderingContext2D, X: number, Y: number, pr: Projectile, gT: number): void {
  const oct = octIdx(pr.vx, pr.vy); // parado → este, sin excepción
  const ux = OCT_X[oct], uy = OCT_Y[oct];
  const px = -uy, py = ux;
  const tf = Math.floor(gT * 10);

  // asta + punta + plumas HORNEADAS por octante (1 drawImage; composite idéntico)
  if (sprOk && ARROW_SPR[oct]) {
    ctx.globalAlpha = 1;
    ctx.drawImage(ARROW_SPR[oct] as HTMLCanvasElement, X - 12, Y - 12);
  } else {
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
  }

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

  // halo + orbe + núcleo + borde HORNEADOS por variante de wob (1 drawImage)
  if (sprOk && ORB_SPR[wob + 1]) {
    ctx.globalAlpha = 1;
    ctx.drawImage(ORB_SPR[wob + 1] as HTMLCanvasElement, X - 8, Y - 8);
  } else {
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
  }

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

  // halo + gema facetada HORNEADOS (1 drawImage; el bob va en el destino)
  if (sprOk && GEM_SPR) {
    ctx.globalAlpha = 1;
    ctx.drawImage(GEM_SPR, X - 6, Y - 6 + bob);
  } else {
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
  }

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
 *  Determinista, enteros, alpha clampeada; restaurar globalAlpha a 1.
 *  R5-O8: early-out si el proyectil está fuera del rect visible expandido
 *  (margen 32 px cubre halos/estelas/zigzag: alcance máx. ~17 px) — el canvas
 *  ya los recortaría, pero así también se ahorran todos los cambios de
 *  estado y hashes (importante en lluvias de proyectiles). */
export function drawProjectileV2(
  ctx: CanvasRenderingContext2D, pr: Projectile, x: number, y: number, globalT: number,
): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  if (X < -32 || X > VIEW_W + 32 || Y < -32 || Y > VIEW_H + 32) return; // culling
  ensureSprs(); // lazy 1×: hornea los cuerpos estáticos (no-op después)
  if (pr.from === 'enemy') { drawEnemyOrb(ctx, X, Y, globalT); return; }
  if (pr.sprite === 'p_arrow' || pr.from === 'companion') { drawArrow(ctx, X, Y, pr, globalT); return; }
  if (pr.sprite === 'p_fire' || pr.element === 'fuego') { drawFire(ctx, X, Y, pr, globalT); return; }
  if (pr.sprite === 'p_ice' || pr.element === 'hielo') { drawIce(ctx, X, Y, pr, globalT); return; }
  if (pr.element === 'rayo') { drawBolt(ctx, X, Y, pr, globalT); return; }
  // R9-4: la gema (fallback) también lleva su estela musical del Eco
  const octG = travel(pr, 0);
  const uxG = OCT_X[octG], uyG = OCT_Y[octG];
  drawEcoTrail(ctx, X, Y, uxG, uyG, -uyG, uxG, pr.element, globalT);
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
