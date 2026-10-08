// ============================================================
// ECOS DE AELTHAR — killfx.ts (módulo actors)
// R3-A8 · Feedback de muerte y remate
// ------------------------------------------------------------
// Capa de juice COMPLEMENTARIA a spawnDeathDissolve (actors/bossfx.ts,
// que ya dibuja la disolución en cenizas — aquí NO se duplica). El
// integrador conecta este módulo así (NADA de esto se aplica en este
// archivo; engine.ts/render.ts quedan intactos):
//
//   1) engine.killEnemy (~1225): tras spawnDeathDissolve(this, e) →
//        onKill(this, e);
//   2) engine.damageEnemy (~1167): rama de REMATE, ANTES de killEnemy —
//        if (e.hp <= 0 && e.ai === 'aturdido') onFinisher(this, e);
//   3) render.drawCombatFx (~465-517): al final del bloque →
//        drawKillFx(ctx, g, sx, sy);   (sx/sy = las mismas de drawWorld)
//   4) engine.newGame / carga de partida → resetKillFx();
//
// QUÉ HACE:
//   onKill(g, e) — por CADA muerte:
//     (a) chispazo de oro: 4-6 motas doradas '#f0c84a' en g.particles
//         que saltan (vy < 0) y caen al suelo (grav > 0);
//     (b) anillo de impacto PLANO de ~1 frame: partícula de size grande
//         (convención destello ≥ 5) y vida 0.05 s en e.x, e.y;
//     (c) elementos persistentes breves para drawKillFx: cruz de
//         impacto expansiva (0.25 s) + onda dorada plana (0.25 s);
//     (d) solo 'guardian': flash CIAN + cámara lenta LEVE (fxcore) +
//         columna de luz cian persistente (0.6 s).
//
//   onFinisher(g, e) — remate (golpe letal sobre un enemigo con ai
//   'aturdido'; el integrador lo llama desde damageEnemy ANTES de
//   killEnemy si aplica): finisherBurst de fxcore (slowmo + shake +
//   flash ya incluidos) + "espada de luz": 10-14 partículas blancas
//   verticales que ascienden + hoja de luz persistente (0.35 s).
//
//   drawKillFx(ctx, g, sx, sy) — dibuja SOLO los elementos persistentes
//   gestionados internamente (array módulo {x,y,t,maxT,kind}): cruz de
//   impacto que se expande 0.25 s, anillo de onda plano dorado en las
//   kills, columna de luz cian 0.6 s para el guardián y hoja blanca
//   0.35 s para los remates. Limpieza automática por t (poda in-place,
//   cero allocations por frame); el avance temporal deriva de g.globalT
//   (determinista, clamp 0.06 s anti-saltos).
//
// Convenciones (idénticas a horror.ts / bossfx.ts / spells.ts):
//   - hash2 devuelve [0, 0.5) → se normaliza ×2 (h2). CERO Math.random
//     en TODO el módulo: mismos inputs → mismos píxeles (replays estables).
//   - Todo fillRect con coordenadas y tamaños ENTEROS (redondeo dentro del
//     helper rect) y recorte duro al lienzo 960×540; alpha SOLO vía
//     ctx.globalAlpha clampeada a [0,1] (nunca rgba dinámicas) y
//     restaurada a 1 al salir.
//   - Partículas con t ≤ maxT SIEMPRE (el bucle del motor pinta con
//     alpha = t/maxT) y size 2.5 (< 3: cuadrado del bucle estándar) o
//     7.5 (≥ 5: convención destello de fx.ts R3-A1).
//   - Sin gradientes, sin ctx.filter, sin emojis, comentarios en español.
// ============================================================

import { VIEW_W, VIEW_H, ZOOM } from '../consts';
import { hash2 } from '../world/palette';
import { addFlash, requestSlowmo, finisherBurst } from '../fxcore';
import type { Game } from '../engine';
import type { Enemy } from '../types';

// ---------------- Constantes de estilo ----------------

const GOLD = '#f0c84a';       // coronas (mismo tono que floatAt del motor)
const FLASH_PALE = '#fff3c4'; // destello plano del impacto
const CYAN = '#7ee8ff';       // guardián (mismo tono que motor/bossfx)
const CYAN_CORE = '#d8f6ff';  // núcleo de la columna ciana
const WHITE = '#ffffff';      // hoja de luz del remate
const BONE = '#f4f0e8';       // halos pálidos (hueso)

const T_CRUZ = 0.25;          // vida de la cruz de impacto (s)
const T_ONDA = 0.25;          // vida del anillo de onda plano (s)
const T_COLUMNA = 0.6;        // vida de la columna ciana del guardián (s)
const T_REMATE = 0.35;        // vida de la hoja de luz del remate (s)

const ELS_MAX = 32;           // tope de elementos persistentes simultáneos
const DT_MAX = 0.06;          // clamp del dt derivado de globalT (anti-saltos)

// hash2 ∈ [0, 0.5) → normalizado a [0, 1) (convención horror/bossfx/spells)
function h2(a: number, b: number): number {
  return hash2(a, b) * 2;
}

// ---------------- Estado interno del módulo ----------------

type KillKind = 'cruz' | 'onda' | 'columna' | 'remate';

interface KillEl {
  x: number; y: number;       // ancla en px de MUNDO (cruz/remate: centro; onda/columna: pies)
  t: number;                  // vida restante (s)
  maxT: number;               // vida total (s)
  kind: KillKind;
  seed: number;               // semilla estable por elemento (parpadeo determinista)
}

const els: KillEl[] = [];
let lastGlobalT: number | null = null; // para derivar dt en drawKillFx
let seedSeq = 0;                       // desempata kills en la misma posición

/** Reserva un elemento persistente (tope ELS_MAX: descarta el más viejo). */
function pushEl(el: KillEl): void {
  if (els.length >= ELS_MAX) els.shift();
  els.push(el);
}

/** Semilla estable derivada de la posición (determinista entre replays). */
function seedFor(ex: number, ey: number, k: number): number {
  const base = Math.floor(h2(ex * 3 + 1 + k, ey * 5 + 2 + k) * 8191);
  seedSeq = (seedSeq + 1) % 4093;
  return base + seedSeq;
}

// ---------------- Helpers de dibujo (contrato de píxel) ----------------

/** fillRect con contrato: coordenadas/tamaños ENTEROS (redondeo aquí dentro)
 *  y recorte duro al lienzo 960×540. Devuelve true si pintó. */
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): boolean {
  const xi = Math.round(x), yi = Math.round(y);
  const wi = Math.round(w), hi = Math.round(h);
  if (wi <= 0 || hi <= 0) return false;
  if (xi < 0 || yi < 0 || xi + wi > VIEW_W || yi + hi > VIEW_H) return false;
  ctx.fillRect(xi, yi, wi, hi);
  return true;
}

/** Fija ctx.globalAlpha clampeado a [0,1]. Devuelve false si es invisible
 *  (el llamador se salta el bloque; nunca pinta con alpha 0). */
function setA(ctx: CanvasRenderingContext2D, a: number): boolean {
  if (!(a > 0.004)) return false;
  ctx.globalAlpha = a >= 1 ? 1 : a;
  return true;
}

// ============================================================
// onKill — feedback de muerte (llamar desde killEnemy, tras
// spawnDeathDissolve; complementario, no lo duplica)
// ============================================================

export function onKill(g: Game, e: Enemy): void {
  if (!g || !e) return;
  const ps = g.particles;
  const ex = Math.round(e.x), ey = Math.round(e.y);
  const w = Math.max(4, e.w);

  // ---- (a) chispazo de oro: 4-6 motas que saltan y CAEN al suelo ----
  if (ps) {
    const n = 4 + Math.floor(h2(ex * 3 + 1, ey * 7 + 2) * 3);          // 4..6
    for (let i = 0; i < n; i++) {
      const h0 = h2(ex + i * 31 + 5, ey + 11);
      const h1 = h2(ex + i * 57 + 13, ey + 23);
      const h2v = h2(ex + i * 83 + 17, ey + 31);
      ps.push({
        x: e.x + (h0 - 0.5) * w,
        y: e.y - 3 - h1 * 5,
        vx: (h2v - 0.5) * 26,
        vy: -(34 + h0 * 38),        // saltan hacia arriba (vy < 0)...
        grav: 170,                  // ...y grav > 0 las deja caer al suelo
        t: 0.55 + h1 * 0.2,         // ≤ maxT SIEMPRE (alpha del motor ≤ 1)
        maxT: 0.75,
        color: GOLD,
        size: 2.5,                  // < 3: cuadrado 6×6 px del bucle estándar
      });
    }
    // ---- (b) anillo de impacto PLANO: 1 destello MUY breve (size grande) ----
    ps.push({
      x: e.x, y: e.y + e.h * 0.4,
      vx: 0, vy: 0,
      t: 0.05, maxT: 0.05,          // ~1 frame: muere solo
      color: FLASH_PALE,
      size: 7.5,                    // ≥ 5: convención destello de fx.ts (R3-A1)
      grav: 0,
    });
  }

  // ---- (c) persistentes para drawKillFx: cruz expansiva + onda dorada ----
  pushEl({ x: e.x, y: e.y, t: T_CRUZ, maxT: T_CRUZ, kind: 'cruz', seed: seedFor(ex, ey, 0) });
  pushEl({ x: e.x, y: e.y + e.h * 0.5, t: T_ONDA, maxT: T_ONDA, kind: 'onda', seed: seedFor(ex, ey, 1) });

  // ---- (d) guardián: flash cian + slowmo leve + columna de luz ----
  if (e.etype === 'guardian') {
    addFlash(g, CYAN, 0.15);
    requestSlowmo(g, 0.18);
    pushEl({ x: e.x, y: e.y + e.h * 0.5, t: T_COLUMNA, maxT: T_COLUMNA, kind: 'columna', seed: seedFor(ex, ey, 2) });
  }
}

// ============================================================
// onFinisher — remate (el golpe que mata a un enemigo con ai
// 'aturdido'; el integrador lo llama desde damageEnemy ANTES de
// killEnemy: if (e.hp <= 0 && e.ai === 'aturdido') onFinisher(this, e))
// ============================================================

export function onFinisher(g: Game, e: Enemy): void {
  if (!g || !e) return;
  // paquete de fxcore: slowmo 0.3 + shake 4 + flash cálido (ya incluidos)
  finisherBurst(g, e.x, e.y);

  const ps = g.particles;
  const ex = Math.round(e.x), ey = Math.round(e.y);

  // ---- espada de luz: 10-14 partículas blancas verticales que ascienden ----
  if (ps) {
    const n = 10 + Math.floor(h2(ex * 7 + 3, ey * 11 + 5) * 5);        // 10..14
    for (let i = 0; i < n; i++) {
      const h0 = h2(ex + i * 29 + 7, ey + 13);
      const h1 = h2(ex + i * 53 + 11, ey + 29);
      const h2v = h2(ex + i * 79 + 19, ey + 41);
      ps.push({
        x: e.x + (h0 - 0.5) * 7,    // columna estrecha y vertical
        y: e.y + 2 - h1 * 44,
        vx: (h2v - 0.5) * 8,
        vy: -(46 + h0 * 54),        // SIEMPRE hacia arriba (luz, no escombro)
        grav: 0,
        t: 0.24 + h1 * 0.16,        // ≤ maxT SIEMPRE
        maxT: 0.4,
        color: i % 3 === 0 ? WHITE : BONE,
        size: 2.5,
      });
    }
  }

  // ---- hoja de luz persistente que dibuja drawKillFx ----
  pushEl({ x: e.x, y: e.y, t: T_REMATE, maxT: T_REMATE, kind: 'remate', seed: seedFor(ex, ey, 3) });
}

// ============================================================
// drawKillFx — elementos PERSISTENTES breves (llamar 1× por frame
// desde drawCombatFx en render.ts, con las mismas sx/sy de drawWorld)
// ============================================================

export function drawKillFx(ctx: CanvasRenderingContext2D, g: Game, sx: (n: number) => number, sy: (n: number) => number): void {
  if (!ctx) return;

  // ---- avance de tiempo: dt derivado de g.globalT (determinista) ----
  const gt = g && typeof g.globalT === 'number' && Number.isFinite(g.globalT) ? g.globalT : 0;
  let dt = 0;
  if (lastGlobalT !== null) {
    dt = gt - lastGlobalT;
    if (!(dt > 0)) dt = 0;
    else if (dt > DT_MAX) dt = DT_MAX;
  }
  lastGlobalT = gt;

  // ---- poda in-place por t (cero allocations por frame) ----
  let keep = 0;
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    el.t -= dt;
    if (el.t > 0) els[keep++] = el;
  }
  els.length = keep;

  // ---- dibujo por kind (k: 0 recién creado → 1 apagándose) ----
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const k = 1 - el.t / el.maxT;
    if (el.kind === 'cruz') drawCruz(ctx, el, k, sx, sy);
    else if (el.kind === 'onda') drawOnda(ctx, el, k, sx, sy);
    else if (el.kind === 'columna') drawColumna(ctx, el, k, gt, sx, sy);
    else drawRemate(ctx, el, k, sx, sy);
  }
  ctx.globalAlpha = 1;
}

/** Cruz de impacto que se EXPANDE (0.25 s): doble cruz + 4 chispas diagonales. */
function drawCruz(ctx: CanvasRenderingContext2D, el: KillEl, k: number, sx: (n: number) => number, sy: (n: number) => number): void {
  const cx = Math.round(sx(el.x));
  const cy = Math.round(sy(el.y));
  const fade = 1 - k;
  const R = Math.round((5 + k * 11) * ZOOM);          // 10..32 px de pantalla
  if (setA(ctx, fade * 0.5)) {
    ctx.fillStyle = BONE;
    rect(ctx, cx - 1, cy - R, 2, R * 2);
    rect(ctx, cx - R, cy - 1, R * 2, 2);
  }
  const R2 = Math.round(R * 0.55);                    // cruz interior blanca
  if (setA(ctx, fade * 0.9)) {
    ctx.fillStyle = WHITE;
    rect(ctx, cx - 1, cy - R2, 2, R2 * 2);
    rect(ctx, cx - R2, cy - 1, R2 * 2, 2);
    rect(ctx, cx - 1, cy - 1, 2, 2);
  }
  if (setA(ctx, fade * 0.4)) {                        // 4 chispas diagonales
    ctx.fillStyle = BONE;
    const d = Math.round(R * 0.75);
    rect(ctx, cx + d - 1, cy + d - 1, 2, 2);
    rect(ctx, cx - d - 1, cy + d - 1, 2, 2);
    rect(ctx, cx + d - 1, cy - d - 1, 2, 2);
    rect(ctx, cx - d - 1, cy - d - 1, 2, 2);
  }
}

/** Anillo de onda PLANO dorado (0.25 s): elipse achatada que se expande. */
function drawOnda(ctx: CanvasRenderingContext2D, el: KillEl, k: number, sx: (n: number) => number, sy: (n: number) => number): void {
  const cx = Math.round(sx(el.x));
  const cy = Math.round(sy(el.y));
  const fade = 1 - k;
  const Rx = Math.round((7 + k * 17) * ZOOM);         // 14..48 px de pantalla
  const Ry = Math.max(3, Math.round(Rx * 0.32));      // achatada (suelo)
  ctx.fillStyle = GOLD;
  for (let dy = -Ry; dy <= Ry; dy += 2) {
    const frac = dy / Ry;
    const half = Math.round(Rx * Math.sqrt(Math.max(0, 1 - frac * frac)));
    if (half < 4) continue;
    if (!setA(ctx, fade * 0.7)) break;                // apagándose: nada más
    rect(ctx, cx - half, cy + dy - 1, 3, 2);          // capas izq/der del anillo
    rect(ctx, cx + half - 3, cy + dy - 1, 3, 2);
  }
  if (setA(ctx, fade * 0.3)) {                        // destello central plano
    const gw = Math.round(Rx * 1.2);
    rect(ctx, cx - gw, cy - 1, gw * 2, 2);
  }
}

/** Columna de luz CIANA del guardián (0.6 s): crece y se desvanece. */
function drawColumna(ctx: CanvasRenderingContext2D, el: KillEl, k: number, gt: number, sx: (n: number) => number, sy: (n: number) => number): void {
  const cx = Math.round(sx(el.x));
  const cy = Math.round(sy(el.y));
  const fade = 1 - k;
  // parpadeo determinista por pasos de 1/24 s (hash del tick, cero random)
  const tick = Math.floor(gt * 24);
  const flick = 0.84 + h2(tick + el.seed, 17) * 0.16;
  const H = Math.round((26 + k * 46) * ZOOM);         // 52..144 px de pantalla
  if (setA(ctx, fade * 0.38 * flick)) {               // halo cian
    ctx.fillStyle = CYAN;
    rect(ctx, cx - 8, cy - H, 16, H);
  }
  if (setA(ctx, fade * 0.75 * flick)) {               // núcleo claro
    ctx.fillStyle = CYAN_CORE;
    rect(ctx, cx - 4, cy - H, 8, H);
  }
  if (setA(ctx, fade * 0.5)) {                        // corazón blanco
    ctx.fillStyle = WHITE;
    rect(ctx, cx - 2, cy - H, 4, H);
  }
  if (setA(ctx, fade * 0.85 * flick)) {               // remate superior
    ctx.fillStyle = CYAN_CORE;
    rect(ctx, cx - 5, cy - H - 2, 10, 2);
  }
  ctx.fillStyle = CYAN;                               // resplandor en el suelo
  for (let dy = -4; dy <= 4; dy += 2) {
    const half = Math.round(20 - Math.abs(dy) * 3.5);
    if (half < 4) continue;
    if (!setA(ctx, fade * 0.3 * flick)) break;
    rect(ctx, cx - half, cy + dy - 1, half * 2, 2);
  }
}

/** Hoja de luz blanca del REMATE (0.35 s): haz vertical + chispa de base. */
function drawRemate(ctx: CanvasRenderingContext2D, el: KillEl, k: number, sx: (n: number) => number, sy: (n: number) => number): void {
  const cx = Math.round(sx(el.x));
  const cy = Math.round(sy(el.y));
  const fade = 1 - k;
  const H = Math.round((40 + k * 26) * ZOOM);         // 80..132 px de pantalla
  if (setA(ctx, fade * 0.28)) {                       // halo pálido
    ctx.fillStyle = BONE;
    rect(ctx, cx - 6, cy - H, 12, H);
  }
  if (setA(ctx, fade * 0.55)) {                       // cuerpo de la hoja
    ctx.fillStyle = WHITE;
    rect(ctx, cx - 3, cy - H, 6, H);
  }
  if (setA(ctx, fade * 0.95)) {                       // filo central fino
    ctx.fillStyle = WHITE;
    rect(ctx, cx - 1, cy - H - 3, 2, H + 3);
  }
  if (setA(ctx, fade * 0.5)) {                        // chispa de base
    ctx.fillStyle = BONE;
    rect(ctx, cx - 16, cy - 2, 32, 3);
    rect(ctx, cx - 9, cy - 5, 18, 2);
  }
}

// ============================================================
// resetKillFx — nueva partida / carga (engine.newGame)
// ============================================================

export function resetKillFx(): void {
  els.length = 0;
  lastGlobalT = null;
  seedSeq = 0;
}
