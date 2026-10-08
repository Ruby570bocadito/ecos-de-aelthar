// ============================================================
// ECOS DE AELTHAR — fxcore (CONTRATO COMPARTIDO, NO EDITAR)
// Helpers de feedback (shake/flash/slowmo/knockback) usados por
// el equipo de visuales (3-a) y el de mecánicas (3-b).
// ============================================================

import type { Game } from './engine';
import type { Entity } from './types';

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

/** Decae el knockback de una entidad y mueve con colisiones. Devuelve true si se movió. */
export function stepKnockback(g: Game, e: Entity, dt: number): boolean {
  const kx = e.kbVx ?? 0, ky = e.kbVy ?? 0;
  if (kx === 0 && ky === 0) return false;
  const decay = Math.pow(0.0015, dt); // ~decae en 0.15 s
  e.kbVx = kx * decay;
  e.kbVy = ky * decay;
  if (Math.abs(e.kbVx) < 2 && Math.abs(e.kbVy) < 2) { e.kbVx = 0; e.kbVy = 0; }
  const beforeX = e.x, beforeY = e.y;
  g.moveEntity(e, kx * dt, ky * dt);
  return e.x !== beforeX || e.y !== beforeY;
}
