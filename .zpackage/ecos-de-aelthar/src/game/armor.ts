// ============================================================
// ECOS DE AELTHAR — Sistema de armaduras (14-b)
// 5 corazas comprables en la forja de Toln. La compra/equipado
// vive en engine.applyAction (case 'armor_N'); este módulo es la
// fuente de verdad de la TABLA y de los efectos derivados.
//
// Contrato con el motor:
//  - flags 'armor_1'..'armor_5' (g.flags: se serializan solas en save()).
//  - La armadura ACTIVA es siempre la de mayor tier poseído.
//  - Reducción de daño: se aplica en Game.damagePlayer (embudo único)
//    DESPUÉS del multiplicador del balanceador y ANTES de la Vigia (vig):
//      dmg_final = max(1, round( max(1, round(dmg·mult_balanceador))
//                                · (1−reduccion)
//                                · (1−min(0.5, vig·0.01)) ))
//  - Placas del Canto: −8% de velocidad — engine.moveEntity escala TODO
//    desplazamiento del Portador (caminar/rodar/empujones) con
//    ARMOR_HEAVY_SPEED: una sola fuente de verdad del movimiento.
//  - Manto de Ecos: refleja REFLECT_PCT del daño recibido SOLO si el
//    origen del golpe coincide con el cuerpo de un enemigo (contacto
//    melé). Los proyectiles llegan desde lejos (origen = posición del
//    proyectil en vuelo) y NO reflejan — decisión documentada.
//
// Contrato con el integrador (screens.ts, 1 línea en pausa):
//    drawArmorRow(g, cx, py + 440, pw - 56); // 14-b armadura activa
//  (mide ~18 px de alto; en ESTADO caben tras las filas de VELMORA;
//   también acepta EQUIPO/otra pestaña: x/y/w libres, devuelve alto).
// ============================================================

import type { Game } from './engine';
import { COL, text } from './ui';

export interface ArmorDef {
  tier: number;        // 1..5 (id de flag = `armor_${tier}`)
  id: string;          // 'armor_1'..'armor_5' — flag de propiedad en g.flags
  name: string;
  cost: number;        // coronas (forja de Toln)
  red: number;         // reducción de daño 0..1
  desc: string;        // línea de tienda / panel
  needFlag?: string;   // gate de compra (p.ej. 'acto3Done' para la Guarda)
  staRegen?: number;   // vigor regenerado por segundo (Malla del Alba)
  slow?: boolean;      // true: −8% velocidad (Placas del Canto)
  reflect?: number;    // fracción del daño melé reflejado (Manto de Ecos)
}

/** Multiplicador de velocidad del Portador con armadura pesada (−8%). */
export const ARMOR_HEAVY_SPEED = 0.92;

/** Tabla de las 5 armaduras (orden = tier). Economía: Acto I deja ~200-250
 *  coronas y el Acto II ~1100 — la escalera 80/160/240/280/420 es un sumidero
 *  escalonado que convive con forja (30-130) y pociones (15). */
export const ARMORS: ArmorDef[] = [
  {
    tier: 1, id: 'armor_1', name: 'Coraza de Cuero', cost: 80, red: 0.08,
    desc: 'Cuero curtido de lobo de Niebla. Ligera y honesta.',
  },
  {
    tier: 2, id: 'armor_2', name: 'Malla del Alba', cost: 160, red: 0.15,
    desc: 'Anillos tejidos con la primera luz. +10 vigor/s.',
    staRegen: 10,
  },
  {
    tier: 3, id: 'armor_3', name: 'Placas del Canto', cost: 240, red: 0.22,
    desc: 'Placas grabadas con notas. Pesadas: −8% de velocidad.',
    slow: true,
  },
  {
    tier: 4, id: 'armor_4', name: 'Manto de Ecos', cost: 280, red: 0.12,
    desc: 'Devuelve parte de cada golpe melé: refleja 15% del daño.',
    reflect: 0.15,
  },
  {
    tier: 5, id: 'armor_5', name: 'Guarda del Primer Canto', cost: 420, red: 0.28,
    desc: 'Única. Solo para quien ha oído el tercer canto hasta el final.',
    needFlag: 'acto3Done',
  },
];

export function armorDefFor(tier: number): ArmorDef | null {
  return ARMORS.find(a => a.tier === tier) ?? null;
}

/** Tier de la armadura ACTIVA (0 = ninguna): siempre el mayor poseído. */
export function armorActiveId(g: Game): number {
  let best = 0;
  for (const a of ARMORS) {
    if (g.flags[a.id] && a.tier > best) best = a.tier;
  }
  return best;
}

/** Definición de la armadura activa (o null si no llevas ninguna). */
export function armorActive(g: Game): ArmorDef | null {
  return armorDefFor(armorActiveId(g));
}

/** Reducción total de daño de la armadura activa (0..0.28). */
export function armorReduction(g: Game): number {
  return armorActive(g)?.red ?? 0;
}

/**
 * Tick pasivo de armaduras (llamado desde Game.update, SOLO en 'play').
 * Malla del Alba: +10 vigor/s (se suma al regen base de 26/s del motor).
 */
export function armorTick(g: Game, dt: number): void {
  const a = armorActive(g);
  if (!a?.staRegen) return;
  const p = g.player;
  if (!p || g.state !== 'play') return;
  p.sta = Math.min(p.maxSta, p.sta + a.staRegen * dt);
}

/**
 * CONTRATO DEL INTEGRADOR (14-b): fila compacta de armadura para la pausa.
 * Dibuja la armadura activa (o un aviso si no llevas ninguna) + su efecto y
 * devuelve el alto usado (~18 px). Solo lectura: sin uiHit/botones — la
 * compra vive en la forja de Toln (diálogo 'toln_armaduras').
 * Ejemplo en screens.ts · drawPause · pestaña ESTADO (tras las filas de
 * VELMORA, hay ~32 px libres al pie):
 *   drawArmorRow(g, cx, py + 442, pw - 56); // 14-b armadura activa
 */
export function drawArmorRow(g: Game, x: number, y: number, w: number): number {
  const act = armorActive(g);
  text(g, '◆ ARMADURA', x, y + 1, 11, COL.gold, 'left', true);
  if (!act) {
    text(g, 'ninguna — la forja de Toln vende corazas (Coraza de Cuero, Malla del Alba…)', x + 112, y, 14, COL.dim);
  } else {
    const pct = Math.round(act.red * 100);
    const extras: string[] = [];
    if (act.staRegen) extras.push(`+${act.staRegen} vigor/s`);
    if (act.slow) extras.push('−8% velocidad');
    if (act.reflect) extras.push(`refleja ${Math.round(act.reflect * 100)}% melé`);
    text(g, `${act.name} — daño recibido −${pct}%${extras.length ? ' · ' + extras.join(' · ') : ''}`, x + 112, y, 14, COL.goldSoft);
  }
  // subrayado sutil a lo ancho del bloque (usa w; mantiene el contrato x/y/w)
  const ctx = g.ctx;
  ctx.fillStyle = 'rgba(90,74,48,0.45)';
  ctx.fillRect(x, y + 16, Math.max(0, w), 1);
  return 18;
}
