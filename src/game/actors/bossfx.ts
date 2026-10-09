// ============================================================
// ECOS DE AELTHAR — bossfx.ts (módulo actors)
// R2-A10 · FX de fases del Guardián y disolución de muerte
// ------------------------------------------------------------
// Capa de FX autocontenida que el integrador conecta así:
//   - updateBossFx(g, dt)      → 1× por frame en update (tras updateEnemy).
//   - drawBossFx(ctx, g)       → BAJO las entidades (antes del bucle de draw).
//   - spawnDeathDissolve(g, e) → donde el enemigo muere, ANTES de filtrarlo
//                                (damageEnemy/killEnemy en engine.ts).
//   - resetBossFx()            → nueva partida / cambio de mapa.
//
// QUÉ HACE:
//   updateBossFx: detecta TRANSICIONES de fase del guardián (memoria interna
//   de fase previa; se resetea si cambia la identidad de bossRef o si
//   bossActive pasa a false). Al SUBIR de fase dispara UNA ráfaga:
//   onda de expansión (g.waves, dmg 0) + estallido de partículas
//   (g.particles, colores GUARDIAN_PHASE_GLOW) + flash breve (fxcore) +
//   UNA sacudida leve (fxcore). Con fase ≥ 2 emite brasas ascendentes
//   periódicas y deterministas (acumulador propio, sin Math.random).
//   R9-5 · TELEGRAFÍA V4 (poses legibles):
//   - VIENTO PREVIO AL ATAQUE (drawBossFx, capa suelo): con el jefe en
//     ai='carga' (windup>0) dibuja un anillo que gira y CONVERGE + ráfagas
//     de viento entrantes + núcleo que estalla en el último 25 % de la
//     carga (pulso creciente claro: alpha y velocidad crecen con el
//     progreso). 'onda' se distingue: giro INVERSO y radio que respira.
//   - IMPACTO: al soltarse la carga (ai carga→ataca/recupera) añade
//     destello del color de fase (más contundente: 0.22) + anillo de
//     choque en suelo (dmg 0) + chispas. La subida de fase también
//     destella más fuerte y lleva un 2º anillo interior.
//   - CAMINATA: polvo de pasos al ritmo de la zancada (0.26 s) + vaivén
//     sutil del aura (±1.2 px de mundo) — bob de SUELO sin tocar sprites
//     (el bob del CUERPO vive en render.ts/sprites: ver enganche abajo).
//
//   drawBossFx: (a) aura de suelo elíptica DITHERED (bandas concéntricas con
//   alpha escalonado + dropout por hash, sin gradientes) del color de fase,
//   pulsando con sin(t); (b) 3-5 esquirlas orbitando el jefe en rectángulos
//   enteros de 1-2 px con pasos discretos por hash y estela de 1 px;
//   (c) grietas de luz bajo los pies que crecen con la fase (trazos
//   ortogonales enteros en Y/X).
//
//   spawnDeathDissolve: la muerte NO explota alegre: se DESHACE.
//   - 'lobo'/'esqueleto'/'sombra': 10-16 cenizas oscuras (#1a1626/#2a2338 y
//     alguna brasa tenue) que ascienden con deriva por hash + 1 "eco
//     espectral": contorno translúcido del color del enemigo que se expande
//     píxel a píxel y se desvanece en ~1 s (g.particles con vy negativa y
//     grav 0 — el alpha lo decae el motor con t/maxT).
//   - 'guardian': colapso mayor — 24-30 partículas rojas/ámbar + 2 ondas de
//     choque concéntricas (g.waves, dmg 0) + esquirlas de piedra que caen.
//
// Convenciones (idénticas a horror.ts / render.ts):
//   - screen = mundo*ZOOM − camX|camY redondeados (camX/camY en px de pantalla).
//   - hash2 devuelve [0, 0.5): se normaliza ×2 (ver horror.ts). Cero
//     Math.random en TODO el módulo: mismo estado → mismos píxeles.
//   - Todo fillRect con coordenadas y tamaños ENTEROS y recortado al lienzo
//     960×540; alpha solo vía globalAlpha ∈ [0,1] (nunca rgba dinámicas).
//   - Sin gradientes, sin ctx.filter, sin emojis.
//   - Nada de arrays propios de vida larga: TODO vive en g.particles/g.waves
//     y lo filtra el motor. Solo memoria propia: fase previa + acumuladores.
// ============================================================

import { VIEW_W, VIEW_H, ZOOM } from '../consts';
import { hash2 } from '../world/palette';
import { addFlash, addShake } from '../fxcore';
import { GUARDIAN_PHASE_GLOW } from './enemies';
import { ENEMY_DEFS } from '../data'; // R9-5: solo lectura (windup real del jefe)
import type { Game } from '../engine';
import type { Enemy } from '../types';

// ---------------- Estado interno del módulo (memoria de fase) ----------------

let memRef: Enemy | null = null;   // identidad del jefe vista la última vez
let memPhase = 0;                  // fase previa registrada (1..3)
let memAi = '';                    // R9-5: ai previo (detección de impacto)
let emberAcc = 0;                  // acumulador de brasas (s)
let emberTick = 0;                 // contador determinista de ráfagas de brasa
let stepAcc = 0;                   // R9-5: acumulador de polvo de pasos (s)
let stepTick = 0;                  // R9-5: contador determinista de pasos

const EMBER_INTERVAL = 0.14;       // s entre ráfagas de brasas (fase ≥ 2)
const EMBER_PER_TICK = 2;          // brasas por ráfaga
const STEP_INT = 0.26;             // R9-5: s entre pasos del jefe (polvo)
const DUST_A = '#43405a';          // R9-5: polvo de piedra (tono cripta)
const DUST_B = '#2e2b40';          // R9-5: polvo apagado

/** hash2 normalizado: hash2 nativo SOLO cubre [0,0.5) → ×2 lleva a [0,1). */
function h2(a: number, b: number): number {
  return hash2(a, b) * 2;
}

/** Fase del jefe saneada a 1..3 (engine la mantiene en 1..3; defensa extra). */
function normPhase(p: number): number {
  const v = Math.round(p);
  if (v < 1) return 1;
  if (v > 3) return 3;
  return v;
}

/** Color de glow de la fase (GUARDIAN_PHASE_GLOW del sprite del jefe). */
function glowOf(ph: number): string {
  return GUARDIAN_PHASE_GLOW[Math.min(2, Math.max(0, ph - 1))] ?? '#7ee8ff';
}

/** Variante APAGADA del glow de fase (para dar 2 tonos sin salidas de paleta). */
function dimOf(ph: number): string {
  return ph >= 3 ? '#7a1e18' : ph === 2 ? '#8a5a14' : '#2a6a78';
}

// ---------------- updateBossFx ----------------

/**
 * updateBossFx — llamar 1× por frame (update.ts, tras el cerebro del jefe).
 * - Registra la fase previa en memoria interna; al SUBIR de fase dispara
 *   exactamente UNA ráfaga (onda + estallido + flash + sacudida leve).
 * - Reset de memoria si bossRef cambia de identidad o bossActive → false.
 * - Fase ≥ 2: brasas ascendentes periódicas (deterministas, acumulador).
 */
export function updateBossFx(g: Game, dt: number): void {
  const b = g.bossRef;
  if (!g.bossActive || !b || b.dead) {
    resetBossFx();
    return;
  }
  if (b !== memRef) {
    // identidad nueva: solo registra la fase actual (SIN ráfaga de activación)
    memRef = b;
    memPhase = normPhase(b.phase);
    memAi = '';
    emberAcc = 0;
    emberTick = 0;
    stepAcc = 0;
    return;
  }

  const ph = normPhase(b.phase);
  if (ph > memPhase) phaseBurst(g, b, ph);
  memPhase = ph;

  // R9-5 · IMPACTO: la carga (viento previo) acaba de soltarse →
  // destello contundente + anillo de choque en suelo + chispas.
  // (El slam telegrafiado NO pasa por 'carga': tiene su propio aviso.)
  const ai = b.ai;
  if (memAi === 'carga' && (ai === 'ataca' || ai === 'recupera')) impactBurst(g, b, ph);
  memAi = ai;

  // R9-5 · CAMINATA: polvo al ritmo de la zancada (bob de suelo, sin sprites)
  if (b.moving) {
    stepAcc += dt;
    while (stepAcc >= STEP_INT) {
      stepAcc -= STEP_INT;
      stepDust(g, b);
    }
  } else {
    stepAcc = 0;
  }

  // brasas ascendentes (fase ≥ 2): ritmo fijo, sin azar
  if (ph >= 2) {
    emberAcc += dt;
    while (emberAcc >= EMBER_INTERVAL) {
      emberAcc -= EMBER_INTERVAL;
      emitEmbers(g, b, ph);
    }
  } else {
    emberAcc = 0;
  }
}

/** Ráfaga de subida de fase: onda (dmg 0) + estallido + flash + sacudida leve. */
function phaseBurst(g: Game, b: Enemy, ph: number): void {
  const glow = glowOf(ph);
  const dim = dimOf(ph);

  // onda de expansión: mismo estilo que las ondas del jefe (r10·maxR150·v130)
  g.waves.push({ x: b.x, y: b.y, r: 8, maxR: 150, speed: 150, dmg: 0, hit: true });

  // estallido determinista: ángulos/velocidades por hash, 2 tonos de fase
  const n = 18 + 8 * ph; // 34 (fase 2) / 42 (fase 3)
  const sx = Math.round(b.x), sy = Math.round(b.y);
  for (let i = 0; i < n; i++) {
    const h0 = h2(i * 19 + 3, sx);
    const h1 = h2(i * 43 + 9, sy);
    const h2v = h2(i * 71 + 15, sx + sy);
    const ang = (i / n) * 6.283185 + (h0 - 0.5) * 0.9;
    const spd = 44 + h1 * 110;
    g.particles.push({
      x: b.x + Math.cos(ang) * 5,
      y: b.y - 10 + Math.sin(ang) * 5,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd * 0.6 - 30,
      t: 0.5 + h2v * 0.45,
      maxT: 0.95,
      color: i % 4 === 3 ? dim : glow,
      size: 1 + h2v * 1.6,
      grav: 85,
    });
  }

  // R9-5: destello MÁS contundente (0.16 → 0.22) + 2º anillo interior rápido
  addFlash(g, glow, 0.22);  // destello del color de la NUEVA fase
  addShake(g, 3);           // UNA sacudida leve (el cerebro ya sacude 5)
  g.waves.push({ x: b.x, y: b.y, r: 20, maxR: 90, speed: 190, dmg: 0, hit: true });
}

/**
 * R9-5 · Destello de IMPACTO del ataque del jefe: la telegrafía ('carga')
 * acaba de resolverse → destello del color de fase + anillo de choque en
 * el suelo (dmg 0, solo lectura) + chispas ascendentes. Determinista por
 * hash (misma posición → mismas chispas). El motor ya sacude y burstea:
 * esto AÑADE la lectura de COLOR y el golpe de luz que faltaban.
 */
function impactBurst(g: Game, b: Enemy, ph: number): void {
  const glow = glowOf(ph);
  const dim = dimOf(ph);
  const sx = Math.round(b.x), sy = Math.round(b.y);

  // anillo de choque en el suelo (dmg 0)
  g.waves.push({ x: b.x, y: b.y, r: 4, maxR: 70, speed: 240, dmg: 0, hit: true });

  // chispas del punto de impacto (10, 2 tonos de fase)
  for (let i = 0; i < 10; i++) {
    const h0 = h2(i * 37 + 1, sx);
    const h1 = h2(i * 53 + 5, sy);
    const h2v = h2(i * 71 + 9, sx + sy);
    const ang = (i / 10) * 6.283185 + (h0 - 0.5) * 0.5;
    const spd = 56 + h1 * 88;
    g.particles.push({
      x: b.x + Math.cos(ang) * 6,
      y: b.y - 4 + Math.sin(ang) * 3,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd * 0.55 - 42,
      t: 0.32 + h0 * 0.3,
      maxT: 0.62,
      color: i % 3 === 2 ? dim : glow,
      size: 1 + h2v * 1.4,
      grav: 150,
    });
  }

  addFlash(g, glow, 0.22);  // destello contundente del impacto
}

/** R9-5 · Polvo de pasos: la zancada del jefe levanta 1 mota apagada. */
function stepDust(g: Game, b: Enemy): void {
  const sx = Math.round(b.x), sy = Math.round(b.y);
  const h0 = h2(stepTick * 29 + 3, sx);
  const h1 = h2(stepTick * 47 + 7, sy);
  g.particles.push({
    x: b.x + (h0 - 0.5) * 18,
    y: b.y + 2,
    vx: (h0 - 0.5) * 16,
    vy: -(5 + h1 * 9),
    t: 0.35 + h1 * 0.25,
    maxT: 0.6,
    color: h0 < 0.55 ? DUST_A : DUST_B,
    size: 1 + h1 * 0.8,
    grav: 30,
  });
  stepTick++;
}

/** Brasas que ascienden desde el cuerpo del jefe (fase ≥ 2). */
function emitEmbers(g: Game, b: Enemy, ph: number): void {
  const glow = glowOf(ph);
  const dim = dimOf(ph);
  const sx = Math.round(b.x), sy = Math.round(b.y);
  for (let k = 0; k < EMBER_PER_TICK; k++) {
    const h0 = h2(emberTick * 31 + k * 7 + 1, sx);
    const h1 = h2(emberTick * 53 + k * 11 + 5, sy);
    const h2v = h2(emberTick * 77 + k * 13 + 9, sx + sy);
    g.particles.push({
      x: b.x + (h0 - 0.5) * 22,                 // a lo ancho del cuerpo (40 px)
      y: b.y - 6 - h1 * 26,                     // desde el torso hacia arriba
      vx: (h2v - 0.5) * 10,                     // deriva lateral tenue
      vy: -(14 + h2v * 26),                     // ascienden
      t: 0.8 + h0 * 0.7,
      maxT: 1.5,
      color: k === 0 ? glow : (h2v < 0.5 ? glow : dim),
      size: 1 + h1,
      grav: 0,
    });
  }
  emberTick++;
}

/** Limpia la memoria de fase (nueva partida / cambio de mapa). */
export function resetBossFx(): void {
  memRef = null;
  memPhase = 0;
  memAi = '';
  emberAcc = 0;
  emberTick = 0;
  stepAcc = 0;
  stepTick = 0;
}

// ---------------- drawBossFx ----------------

// alpha de las bandas del aura (de EXTERIOR a INTERIOR; se acumulan al solaparse)
const AURA_BAND_ALPHA = [0.06, 0.055, 0.06, 0.075];
const AURA_BAND_SCALE = [1, 0.78, 0.56, 0.34];

/**
 * drawBossFx — pinta el terror del jefe BAJO sus pies (llamar ANTES de
 * dibujar entidades). Todo determinista: sin(t) + hash2; nada de Math.random.
 *   (a) aura de suelo elíptica dithered (bandas concéntricas, alpha escalonado)
 *   (b) 3-5 esquirlas orbitando (rects enteros 1-2 px, pasos discretos, estela 1 px)
 *   (c) grietas de luz bajo los pies que crecen con la fase (trazos Y/X enteros)
 */
export function drawBossFx(ctx: CanvasRenderingContext2D, g: Game): void {
  const b = g.bossRef;
  if (!g.bossActive || !b || b.dead) return;

  const ph = normPhase(b.phase);
  const glow = glowOf(ph);
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const t = g.globalT;

  // semilla estable ligada a la posición (la forma no vibra al moverse 1 px)
  const seedX = Math.round(b.x), seedY = Math.round(b.y);

  // anclas de pantalla (misma convención que render.ts: sx = wx*ZOOM − camX)
  const cx = Math.round(b.x * ZOOM) - camX;          // centro del cuerpo
  const fx = Math.round(b.x * ZOOM) - camX;          // pies (x)
  const fy = Math.round((b.y + 4) * ZOOM) - camY;    // pies (y, sombra en e.y+4)

  // R5-O8 · culling: jefe activo pero fuera del rect visible expandido → nada
  // que pintar (alcance máximo de aura/grietas/esquirlas ~100 px de pantalla;
  // margen 192 px holgado). El canvas ya recortaría todos los rects.
  if (cx < -192 || cx > VIEW_W + 192 || fy < -192 || fy > VIEW_H + 192) return;

  // pulso determinista del aura (respiración lenta, late más rápido en fase 3)
  const rate = 2.4 + ph * 0.5;
  const pulse = 0.82 + 0.18 * Math.sin(t * rate);

  // R9-5 · caminata: vaivén sutil del aura al ritmo de los pasos (±1.2 px mundo)
  const sway = b.moving ? Math.sin(t * 12.1) * 1.2 : 0;

  // -------- (a) aura de suelo: 4 bandas elípticas escalaneadas + dropout --------
  const baseR = (13 + ph * 3.5) * pulse + sway;      // radio en px de MUNDO (+ paso)
  const ratio = 0.45;                                 // achatada (suelo en perspectiva)
  for (let k = 0; k < AURA_BAND_ALPHA.length; k++) {
    const rx = baseR * AURA_BAND_SCALE[k];
    const ry = Math.max(1.2, rx * ratio);
    ctx.fillStyle = glow;
    ctx.globalAlpha = Math.min(1, Math.max(0, AURA_BAND_ALPHA[k] * (0.8 + 0.2 * pulse)));
    const rows = Math.ceil(ry);
    for (let j = -rows; j <= rows; j++) {
      const frac = j / ry;
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - frac * frac)));
      if (half < 1) continue;
      // dither: dropout determinista por fila (scanline), estable junto al jefe
      if (h2(j * 13 + k * 7 + 1, seedX) < 0.22) continue;
      rect(ctx, fx - half * ZOOM, fy + j * ZOOM, half * ZOOM * 2, ZOOM);
    }
  }

  // -------- (d) R9-5 · VIENTO PREVIO AL ATAQUE: pulso creciente que converge --------
  // Jefe en 'carga' (windup > 0): anillo que gira y CONVERGE (más rápido,
  // cerca y brillante cuanto más cerca de soltar) + ráfagas de viento
  // entrantes + núcleo que estalla en el último 25 % de la carga.
  // 'onda' se distingue a golpe de vista: giro INVERSO y radio que respira.
  if (b.ai === 'carga' && b.windup > 0) {
    const onda = b.telegraphKind === 'onda';
    const defW = ENEMY_DEFS[b.etype]?.windup;
    const wmax = onda ? 0.9 : defW !== undefined ? defW * (ph >= 3 ? 0.7 : 1) : 0.8;
    const frac = 1 - Math.min(1, Math.max(0, b.windup / wmax));   // 0 → 1
    const wA = 0.16 + 0.5 * frac;                    // alpha creciente

    // anillo que converge girando (10 segmentos)
    const rr = (26 - 15 * frac + (onda ? 3 * Math.sin(t * 8) : 0)) * ZOOM;
    const ryR = Math.max(2, rr * 0.42);
    const spin = t * (1.6 + 3.4 * frac) * (onda ? -1 : 1);
    ctx.fillStyle = glow;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283185 + spin;
      ctx.globalAlpha = Math.min(1, Math.max(0, wA * (0.55 + 0.45 * Math.sin(t * 7 + i * 2.1))));
      rect(ctx, Math.round(fx + Math.cos(a) * rr) - 1, Math.round(fy + Math.sin(a) * ryR), 3, 1);
    }

    // ráfagas entrantes: 5 líneas de viento que se acercan al jefe
    for (let i = 0; i < 5; i++) {
      const u = (t * (0.7 + 1.1 * frac) + i * 0.203) % 1;
      const d = ((1 - u) * (30 + 12 * (1 - frac)) + 6) * ZOOM;    // converge a 6 px
      const side = i % 2 === 0 ? 1 : -1;
      const sxp = Math.round(fx + side * d);
      const syp = Math.round(fy + (h2(i * 17 + 1, seedX) - 0.5) * 12 * ZOOM);
      ctx.globalAlpha = Math.min(1, Math.max(0, wA * u));
      rect(ctx, side > 0 ? sxp - 4 : sxp, syp, 4, 1);
    }

    // núcleo de aviso: estalla (parpadeo rápido) en el último 25 % de la carga
    if (frac > 0.75) {
      const k = (frac - 0.75) / 0.25;
      ctx.globalAlpha = Math.min(1, Math.max(0, k * (0.45 + 0.45 * Math.sin(t * 24))));
      rect(ctx, fx - 2, fy - 2, 5, 3);
      ctx.globalAlpha = Math.min(1, Math.max(0, k * 0.6));
      rect(ctx, fx - 5, fy - 1, 11, 1);
      rect(ctx, fx, fy - 4, 1, 7);
    }
    ctx.globalAlpha = 1;
  }

  // -------- (c) grietas de luz bajo los pies (crecen con la fase) --------
  const cracks = 1 + ph;                             // 2..4 grietas
  for (let c = 0; c < cracks; c++) {
    const hc0 = h2(c * 23 + 3, seedY);
    const ox = Math.round((hc0 * 2 - 1) * (3 + ph * 2));   // arranque ±(3+2f) px mundo
    const dir = ox >= 0 ? 1 : -1;
    let pxs = fx + ox * ZOOM;
    let pys = fy + (c % 2) * 2;
    const segs = 2 + ph;                             // más fase → más largas
    ctx.fillStyle = glow;
    ctx.globalAlpha = Math.min(1, Math.max(0, (0.16 + 0.07 * ph) * (0.75 + 0.25 * Math.sin(t * 1.9 + c * 1.7))));
    for (let s = 0; s < segs; s++) {
      // trazo vertical (Y)
      const v = 3 + Math.floor(h2(c * 31 + s * 7 + 1, seedX) * 3) * 2;   // 3..7 px
      rect(ctx, pxs, pys, 2, v);
      pys += v;
      // trazo horizontal (X), alejándose de los pies
      const step = (2 + Math.floor(h2(c * 41 + s * 11 + 5, seedX) * 4) * 2) * dir; // ±2..8
      rect(ctx, Math.min(pxs, pxs + step), pys, Math.abs(step), 2);
      pxs += step;
    }
  }

  // -------- (b) esquirlas orbitando el jefe (pasos discretos + estela) --------
  const n = 3 + (ph >= 2 ? 1 : 0) + (ph >= 3 ? 1 : 0);     // 3..5 esquirlas
  const cyc = 18;                                    // pasos discretos por órbita
  const cyB = Math.round((b.y - 16) * ZOOM) - camY;  // centro del cuerpo
  for (let i = 0; i < n; i++) {
    const h0 = h2(i * 37 + 5, seedX);
    const h1 = h2(i * 61 + 11, seedY);
    const dir = h1 < 0.5 ? 1 : -1;
    const revs = 0.28 + h1 * 0.22;                   // vueltas/s (lentas, amenazantes)
    const q = ((Math.floor(t * revs * cyc * dir + h0 * cyc) % cyc) + cyc) % cyc;
    const ang = (q / cyc) * 6.283185;
    const rOrb = 15 + h0 * 9;                        // radio de órbita (px mundo)
    const wx = Math.cos(ang) * rOrb;
    const wy = Math.sin(ang) * rOrb * 0.42;
    const sxp = cx + Math.round(wx * ZOOM);
    const syp = cyB + Math.round(wy * ZOOM);
    const a = 0.5 + 0.3 * Math.sin(t * 3.1 + i * 2.09);
    ctx.fillStyle = glow;
    // estela de 1 px en el paso anterior de la órbita
    const qPrev = (((q - dir) % cyc) + cyc) % cyc;
    const angPrev = (qPrev / cyc) * 6.283185;
    const txp = cx + Math.round(Math.cos(angPrev) * rOrb * ZOOM);
    const typ = cyB + Math.round(Math.sin(angPrev) * rOrb * 0.42 * ZOOM);
    ctx.globalAlpha = Math.min(1, Math.max(0, a * 0.45));
    rect(ctx, txp, typ, 1, 1);
    // esquirla (2×2 px de lienzo = 1 px de mundo)
    ctx.globalAlpha = Math.min(1, Math.max(0, a));
    rect(ctx, sxp - 1, syp - 1, 2, 2);
  }

  ctx.globalAlpha = 1;
}

/**
 * fillRect con contrato: coordenadas/tamaños ENTEROS y recorte duro al
 * lienzo 960×540 (el rasterizador del harness valida bounds exactos).
 * Devuelve true si pintó.
 */
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): boolean {
  if (w <= 0 || h <= 0) return false;
  if (x < 0 || y < 0 || x + w > VIEW_W || y + h > VIEW_H) return false;
  ctx.fillRect(x, y, w, h);
  return true;
}

// ---------------- spawnDeathDissolve ----------------

// ceniza oscura + alguna brasa tenue (paleta de la spec R2-A10)
const ASH_A = '#1a1626';
const ASH_B = '#2a2338';
const EMBER_DIM = '#9a4e26';

// color del eco espectral por tipo (mismos tonos que usa el motor: burst/trails)
function echoColor(e: Enemy): string {
  switch (e.etype) {
    case 'lobo': return '#9ec4b4';
    case 'esqueleto': return '#d8dce4';
    case 'sombra': return '#b48fff';
    default: return '#9ec4b4';
  }
}

// R5-O8: 8 vecinos del eco espectral — tabla de módulo (antes: array + tuplas
// nuevas por CADA muerte; evento poco frecuente, pero cero coste ahora).
const ECHO_PTS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];

// colapso del guardián: rojo vivo + ámbar (fase final del jefe)
const COLLAPSE_COLS = ['#ff5a4a', '#ffd24a', '#c03028', '#ff8a3a'];
// piedra de la cripta (PAL.stoneDark / PAL.stoneDeep, world/palette.ts)
const STONE_A = '#5a5a6a';
const STONE_B = '#3e3e50';

/**
 * spawnDeathDissolve — disolución al morir CUALQUIER enemigo. Llamar ANTES de
 * filtrar al enemigo (killEnemy / filter de g.enemies). Todo vive en
 * g.particles / g.waves (el motor lo filtra solo); cero arrays propios.
 * Determinista (hash2 sobre la posición): misma muerte → misma disolución.
 */
export function spawnDeathDissolve(g: Game, e: Enemy): void {
  if (!e) return;
  if (e.etype === 'guardian') guardianCollapse(g, e);
  else mortalDissolve(g, e);
}

/** Lobo y humanoides (sombra/esqueleto): ceniza que asciende + eco espectral. */
function mortalDissolve(g: Game, e: Enemy): void {
  const sx = Math.round(e.x), sy = Math.round(e.y);
  const w = Math.max(4, e.w), hgt = Math.max(4, e.h);

  // ---- ceniza oscura que asciende con deriva por hash (10-16 partículas) ----
  const n = 10 + Math.floor(h2(sx, sy) * 7);          // 10..16
  for (let i = 0; i < n; i++) {
    const h0 = h2(i * 13 + 1, sx);
    const h1 = h2(i * 29 + 7, sy);
    const h2v = h2(i * 47 + 13, sx + 3);
    const ember = i % 5 === 4;                        // ~20 % brasa tenue
    g.particles.push({
      x: e.x + (h0 - 0.5) * w,
      y: e.y - 2 - h1 * (hgt * 0.5),
      vx: (h2v - 0.5) * 16,                           // deriva por hash
      vy: -(16 + h0 * 30),                            // ascienden
      t: 0.7 + h1 * 0.6,
      maxT: 1.3,
      color: ember ? EMBER_DIM : (h2v < 0.5 ? ASH_A : ASH_B),
      size: 1 + h1,
      grav: 0,
    });
  }

  // ---- eco espectral: contorno translúcido del color del enemigo que se
  //      expande píxel a píxel y se desvanece en ~1 s (vy negativa, grav 0;
  //      el motor aplica el fade con alpha = t/maxT) ----
  const col = echoColor(e);
  const rx0 = w / 2 + 3;
  const ry0 = hgt / 2 + 3;
  for (let k = 0; k < ECHO_PTS.length; k++) {
    const nx = ECHO_PTS[k][0], ny = ECHO_PTS[k][1];
    const hk = h2(k * 17 + 3, sx + sy);
    g.particles.push({
      x: e.x + nx * rx0,
      y: e.y - 4 + ny * ry0,
      vx: nx * 9 + (hk - 0.5) * 4,        // se expande ~9 px/s
      vy: ny * 9 - 10,                    // SIEMPRE negativa (todo el eco sube)
      t: 1.0,
      maxT: 1.0,
      color: col,
      size: 2,
      grav: 0,
    });
  }
}

/** Guardián: colapso mayor — estallido rojo/ámbar + 2 ondas + piedra que cae. */
function guardianCollapse(g: Game, e: Enemy): void {
  const sx = Math.round(e.x), sy = Math.round(e.y);
  const w = Math.max(4, e.w), hgt = Math.max(4, e.h);

  // ---- estallido rojo/ámbar (24-30 partículas) ----
  const n = 24 + Math.floor(h2(sx, sy) * 7);          // 24..30
  for (let i = 0; i < n; i++) {
    const h0 = h2(i * 19 + 3, sx);
    const h1 = h2(i * 43 + 9, sy);
    const ang = (i / n) * 6.283185 + (h0 - 0.5) * 0.8;
    const spd = 46 + h1 * 96;
    g.particles.push({
      x: e.x + Math.cos(ang) * 4,
      y: e.y - 8 + Math.sin(ang) * 4,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd * 0.7 - 26,
      t: 0.55 + h0 * 0.55,
      maxT: 1.1,
      color: COLLAPSE_COLS[i % COLLAPSE_COLS.length],
      size: 1.5 + h1 * 1.5,
      grav: 80,
    });
  }

  // ---- 2 ondas de choque concéntricas (dmg 0, solo lectura visual) ----
  g.waves.push({ x: e.x, y: e.y, r: 4, maxR: 110, speed: 170, dmg: 0, hit: true });
  g.waves.push({ x: e.x, y: e.y, r: 4, maxR: 160, speed: 115, dmg: 0, hit: true });

  // ---- esquirlas de piedra que caen (saltan y caen por grav) ----
  const ns = 8 + Math.floor(h2(sx + 11, sy) * 3);     // 8..10
  for (let k = 0; k < ns; k++) {
    const h0 = h2(k * 23 + 5, sx);
    const h1 = h2(k * 37 + 11, sy);
    const h2v = h2(k * 53 + 17, sx + sy);
    g.particles.push({
      x: e.x + (h0 - 0.5) * w,
      y: e.y - 6 - h1 * (hgt * 0.4),
      vx: (h2v - 0.5) * 20,
      vy: -(8 + h1 * 18),                             // pequeño salto inicial
      t: 0.8 + h0 * 0.4,
      maxT: 1.2,
      color: k % 2 === 0 ? STONE_A : STONE_B,
      size: 1.5 + h1,
      grav: 170,                                      // caen
    });
  }
}
