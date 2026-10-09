// ============================================================
// ECOS DE AELTHAR — fxcore (CONTRATO COMPARTIDO)
// Helpers de feedback (shake/flash/slowmo/knockback) usados por
// el equipo de visuales (3-a) y el de mecánicas (3-b).
//
// R3-A2 · juice core v2 — TODO ADITIVO, firmas v1 intactas:
//   - addShakeDir/takeShakeDir: sacudida DIRECCIONAL con decaimiento
//     ~8/s que el integrador suma a la cámara (render.drawWorld,
//     junto al translate de g.shake).
//   - impactFreeze: hitstop acotado (tope 0.14 s) — nunca baja el
//     valor existente de g.hitStop (el motor lo decae en su loop).
//   - finisherBurst: paquete de remate (slowmo + shake + flash cálido).
//   - stepKnockback pulido: fricción exponencial + tope de velocidad
//     total + cola amortiguada (converge a 0 sin corte seco).
//   - comboPitch: 0..1 según combo reciente del jugador para modular
//     el pitch del SFX de golpe.
//   Todo determinista (cero Math.random). El decaimiento direccional
//   usa el reloj del sistema (performance.now) con snapshot estable
//   intra-frame; el estado vive en un WeakMap por instancia de Game
//   (una instancia nueva empieza limpia sin reset manual).
//
// R5-O7 (optimización): takeShakeDir devuelve un objeto REUTILIZADO (antes
//   1 objeto nuevo por frame; render.ts lee x/y al instante — no retener).
//   stepKnockback memoiza la fricción 0.0015^dt (1 Math.pow por frame en vez
//   de 1 por entidad), usa sqrt directo en vez de Math.hypot y reutiliza la
//   magnitud sp0 para la cola (sp = sp0·decay; sin segundo sqrt por entidad).
// ============================================================

import type { Game } from './engine';
import type { Entity } from './types';

// ---------------- Contrato v1 (firmas inmutables) ----------------

/** Sacudida de cámara (se aplica en render.ts). mag típico: 2-8. */
export function addShake(g: Game, mag: number) {
  g.shake = Math.max(g.shake, mag);
}

/** Destello a pantalla completa (color hex, duración s). */
export function addFlash(g: Game, color: string, t = 0.18) {
  if (t >= g.flashT) {
    g.flashT = t;
    g.flashColor = color;
  }
}

/** Cámara lenta breve (0.2-0.4 s recomendado). */
export function requestSlowmo(g: Game, t = 0.25) {
  g.slowmoT = Math.max(g.slowmoT, t);
}

/** Knockback suave: fija velocidad de retroceso que update.ts aplica y decae. */
export function applyKnockback(e: Entity, dx: number, dy: number, force: number) {
  const l = Math.max(0.001, Math.hypot(dx, dy));
  e.kbVx = (e.kbVx ?? 0) + (dx / l) * force;
  e.kbVy = (e.kbVy ?? 0) + (dy / l) * force;
}

// Constantes del knockback pulido (R3-A2)
const KB_MAX_SPEED = 380; // px/s — tope de velocidad total (no dar pasos gigantes)
const KB_TAIL = 24;       // px/s — radio de la cola amortiguada
const KB_EPS = 0.25;      // px/s — consumo final

// R5-O7: memo de 1 entrada para la fricción — todas las entidades reciben el
// MISMO dt por frame, así que el Math.pow se calcula 1 vez por frame (antes:
// 1 por entidad con knockback; Math.pow es de lo más caro de esta ruta).
let kbDecayDt = -1;
let kbDecayVal = 1;

/** Decae el knockback de una entidad y mueve con colisiones. Devuelve true si se movió.
 *  R3-A2 (pulido, firma y booleano intactos): la fricción ya era exponencial
 *  (0.0015^dt ≡ e^(-6.5·dt)) y se mantiene exacta; se añade tope de velocidad
 *  total, dt acotado y cola cuadrática cerca del reposo — el corte seco
 *  anterior en <2 px/s daba un micro-salto; ahora converge suave a 0. */
export function stepKnockback(g: Game, e: Entity, dt: number): boolean {
  let kx = e.kbVx ?? 0, ky = e.kbVy ?? 0;
  if (kx === 0 && ky === 0) return false;
  const dtc = Math.max(0, Math.min(dt, 0.05)); // pausas grandes no desintegran la fricción
  // tope de velocidad total: knockbacks apilados no teletransportan
  let sp0 = Math.sqrt(kx * kx + ky * ky); // R5-O7: sqrt directo (antes hypot)
  if (sp0 > KB_MAX_SPEED) { const f = KB_MAX_SPEED / sp0; kx *= f; ky *= f; sp0 = KB_MAX_SPEED; }
  // fricción exponencial suave (equivalente exacta al 0.0015^dt original;
  // R5-O7: memoizada por dt — el valor es idéntico, solo se cachea)
  let decay: number;
  if (dtc === kbDecayDt) {
    decay = kbDecayVal;
  } else {
    decay = Math.pow(0.0015, dtc);
    kbDecayDt = dtc;
    kbDecayVal = decay;
  }
  kx *= decay;
  ky *= decay;
  // cola suave: cerca del reposo la velocidad se amortigua cuadráticamente
  // (sp → sp²/24, continua en el radio) y se consume sin reptar.
  // R5-O7: sp = sp0·decay — la fricción escala kx/ky por igual, así que la
  // magnitud pos-decaimiento es exactamente sp0·decay (sin 2º sqrt/entidad).
  const sp = sp0 * decay;
  if (sp < KB_TAIL) {
    const f = sp / KB_TAIL;
    kx *= f;
    ky *= f;
    if (sp * f < KB_EPS) { kx = 0; ky = 0; }
  }
  e.kbVx = kx;
  e.kbVy = ky;
  const beforeX = e.x, beforeY = e.y;
  // se mueve con la velocidad YA topada y decaída (el tope acota el paso;
  // moveEntity del motor clampea contra paredes)
  g.moveEntity(e, kx * dtc, ky * dtc);
  return e.x !== beforeX || e.y !== beforeY;
}

// ---------------- R3-A2 · juice core v2 ----------------

// --- sacudida direccional ---

interface DirState {
  dx: number; dy: number;   // offset acumulado (px de mundo) para la cámara
  lastMs: number;           // último tick de decaimiento (reloj real)
  sx: number; sy: number;   // snapshot entregado este frame (estable intra-frame)
  snapMs: number;           // instante del snapshot (addShakeDir lo invalida)
}

// Estado POR INSTANCIA de Game: cambia la instancia → estado limpio solo.
const dirStates = new WeakMap<Game, DirState>();

const DIR_DECAY = 8;      // 1/s — decae a ~0 en ≲1 s
const DIR_MAX = 16;       // px — tope del offset acumulado (impulsos apilados)
const DIR_EPS = 0.05;     // px — consumo final (invisible a ZOOM=2)
const FRAME_GAP_MS = 2;   // llamadas separadas <2 ms = mismo frame de render

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** Decaimiento exponencial (~8/s) del offset acumulado. */
function dirTick(s: DirState, now: number): void {
  const dt = Math.max(0, Math.min(0.1, (now - s.lastMs) / 1000));
  s.lastMs = now;
  if (dt <= 0) return;
  const k = Math.exp(-DIR_DECAY * dt);
  s.dx *= k;
  s.dy *= k;
  if (Math.hypot(s.dx, s.dy) < DIR_EPS) { s.dx = 0; s.dy = 0; }
}

function dirState(g: Game): DirState {
  let s = dirStates.get(g);
  if (!s) {
    s = { dx: 0, dy: 0, lastMs: nowMs(), sx: 0, sy: 0, snapMs: -1e9 };
    dirStates.set(g, s);
  }
  return s;
}

/** Sacudida DIRECCIONAL: empuja la cámara hacia (dx,dy) — golpes fuertes,
 *  remates, ondas del jefe. Si (dx,dy)≈0 degrada a la sacudida normal. */
export function addShakeDir(g: Game, mag: number, dx: number, dy: number): void {
  const l = Math.hypot(dx, dy);
  if (!Number.isFinite(l) || l < 0.001) { addShake(g, mag); return; }
  const s = dirState(g);
  dirTick(s, nowMs());
  s.dx += (dx / l) * mag;
  s.dy += (dy / l) * mag;
  const m = Math.hypot(s.dx, s.dy);
  if (m > DIR_MAX) { const f = DIR_MAX / m; s.dx *= f; s.dy *= f; }
  s.snapMs = -1e9; // invalida el snapshot: el próximo take entrega el offset fresco
}

/** Offset direccional DEL FRAME para sumar a la cámara (render.drawWorld,
 *  junto al translate de g.shake). Estable intra-frame: todas las llamadas
 *  dentro del mismo frame devuelven el MISMO valor; entre frames decae ~8/s
 *  y se consume — agotado, sigue devolviendo {0,0} sin coste.
 *  R5-O7: el objeto devuelto es REUTILIZADO entre frames (0 alloc/frame);
 *  contrato: el consumidor lee x/y inmediatamente (render.drawWorld lo hace). */
const _shakeDirOut = { x: 0, y: 0 };

export function takeShakeDir(g: Game): { x: number; y: number } {
  const s = dirState(g);
  const now = nowMs();
  if (now - s.snapMs >= FRAME_GAP_MS) {
    dirTick(s, now);
    s.sx = s.dx;
    s.sy = s.dy;
    s.snapMs = now;
  }
  _shakeDirOut.x = s.sx;
  _shakeDirOut.y = s.sy;
  return _shakeDirOut;
}

// --- hitstop / remate / combo ---

/** Hitstop acotado: congela el impacto un instante SIN bajar el valor
 *  existente de g.hitStop (el motor lo decae en su loop; crítico 0.09 /
 *  golpe 0.04). Tope 0.14 s — por encima el juego se siente lag. */
export function impactFreeze(g: Game, secs: number): void {
  g.hitStop = Math.max(g.hitStop, Math.min(0.14, secs));
}

/** Paquete de REMATE (punto de conexión: killEnemy en engine.ts):
 *  cámara lenta + sacudida + destello cálido de una vez. */
export function finisherBurst(g: Game, x: number, y: number): void {
  void x; void y; // reservados: anclaje de killfx/partículas del integrador
  requestSlowmo(g, 0.3);
  addShake(g, 4);
  addFlash(g, '#fff8e0', 0.12);
}

/** 0..1 según combo reciente del jugador (para modular el pitch del SFX
 *  de golpe). Sube con el índice de combo (0..2) y respira con la ventana
 *  activa (attackT swing, comboT encadenado de 1.2 s); sin jugador o sin
 *  campos devuelve 0. */
export function comboPitch(g: Game): number {
  const p = g.player;
  if (!p) return 0;
  const combo = typeof p.combo === 'number' ? p.combo : 0;
  const attackT = typeof p.attackT === 'number' ? p.attackT : 0;
  const comboT = typeof p.comboT === 'number' ? p.comboT : 0;
  // recencia: 1 recién golpeado / con ventana fresca → 0 al apagarse
  const rec = Math.max(0, Math.min(1, Math.max(attackT / 0.4, comboT / 1.2)));
  // índice de combo 0..2 → 0..1 (clamp por si el motor lo amplía)
  const cc = Math.max(0, Math.min(2, combo)) / 2;
  // fuera de ventana cae al 35 % (murmullo) en lugar de morir a seco
  return Math.max(0, Math.min(1, cc * (0.35 + 0.65 * rec)));
}
