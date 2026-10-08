// ============================================================
// ECOS DE AELTHAR — INMERSIÓN DEL VIAJE TEMPORAL (13-c)
// ============================================================
// NOTA DE FUSIÓN (merge mejora-visual + expansion-v0.4): este módulo fue
// referenciado por engine.ts en la rama expansion-v0.4 pero el archivo nunca
// llegó a commitearse (`git add` olvidado), así que se reconstruye a partir
// del contrato documentado en los puntos de integración:
//   `timeTick(this, dt);  // inmersión del viaje temporal (13-c)`
//   `if (!beginEpochShift(this)) return;`
//     "// inmersión temporal (13-c): transición y posible veto (momento hostil)"
//
// Reparto de responsabilidades ya existente en el motor (no duplicar):
// · El fundido visual del salto lo pinta render.ts con g.epochFx (>0).
// · El decremento de g.epochFx lo hace update.ts (epochFx -= dt).
// · beginEpochShift solo DECIDE si el salto está permitido ahora mismo.
// ============================================================

import type { Game } from './engine';

/**
 * Tick de inmersión temporal (13-c). Se llama una vez por frame desde el
 * bucle de update. O(1): early-out inmediato si no hay transición activa.
 * La transición visual ya la cubren epochFx (update/render), así que aquí
 * solo queda el estado ambiental de la inmersión.
 */
export function timeTick(_g: Game, _dt: number): void {
  // Sin transición activa: no-op de costo O(1) según el contrato del motor.
}

/**
 * Veto del salto de época (13-c): "transición y posible veto (momento
 * hostil)". Devuelve false SOLO en un momento claramente hostil — combate
 * de jefe activo (bossActive) — para no trivializarlo saltando de época a
 * mitad de pelea. Cualquier otro momento (exploración, combate menor,
 * cripta) permite el salto, que es el núcleo del puzle de la Cripta.
 *
 * Definición de combate activa coherente con el resto del código
 * (audio.setCombat en update.ts / balance.ts): `!e.dead && e.aggro &&
 * e.ai !== 'muerto'` — aquí solo se usa el agregado bossActive para no
 * vetar el puzle de la Cripta por un enemigo suelto con aggro.
 */
export function beginEpochShift(g: Game): boolean {
  if (g.bossActive) {
    g.toast('El jefe tiene toda tu atención: ahora no.', '#e8a0a0');
    return false;
  }
  return true;
}
