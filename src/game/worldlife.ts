// ============================================================
// ECOS DE AELTHAR — VIDA DEL MUNDO (13-b)
// ============================================================
// NOTA DE FUSIÓN (merge mejora-visual + expansion-v0.4): este módulo fue
// referenciado por engine.ts en la rama expansion-v0.4 pero el archivo nunca
// llegó a commitearse (`git add` olvidado), así que se reconstruye a partir
// del contrato documentado en el punto de integración:
//   `worldTick(this, dt); // fauna, rumores y eventos del mundo (13-b)`
//   "módulos de juego (no-ops de costo O(1) si no aplican)"
//
// Implementación: hook de mundo seguro y O(1). Reserva el punto de
// integración para fauna ambiental, rumores entre NPC y eventos del mundo
// sin acoplar el motor a detalles aún por definir. No muta estado del Game
// y no puede romper el bucle de update.
// ============================================================

import type { Game } from './engine';

/**
 * Tick de vida del mundo (13-b). Se llama una vez por frame desde el bucle
 * de update, después de challengeTick/skillTick/balanceTick. O(1): early-out
 * inmediato mientras no haya eventos activos.
 */
export function worldTick(_g: Game, _dt: number): void {
  // Sin eventos activos: no-op de costo O(1) según el contrato del motor.
  // Punto de extensión documentado: fauna ambiental, rumores y eventos.
}
