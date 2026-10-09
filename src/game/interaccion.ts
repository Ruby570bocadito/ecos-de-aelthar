// ============================================================
// ECOS DE AELTHAR — INTERACCIÓN TOTAL + ÓRDENES DE COMPAÑERO (Task 16-b)
//
// Lógica (no visual) para "más interacción con todo":
//   · Órdenes tácticas al compañero (tecla T): seguir → agresivo → defensivo.
//     - seguir: comportamiento original (escolta de update.ts, sin cambios).
//     - agresivo: busca al enemigo CON AGGRO más cercano al Portador en radio
//       6 tiles, lo aborda hasta alcance de arco y dispara; vuelve (escolta)
//       si su vida baja del 30%.
//     - defensivo: se queda a 2 tiles del Portador, solo ataca enemigos a
//       <2 tiles de él y INTERPONE su cuerpo: si el Portador recibe un golpe
//       melé con la compañera a <1.5 tiles, ella absorbe el 50% del daño
//       (cooldown 6 s para no trivializar; solo golpes melé — la misma
//       convención de "el origen del golpe coincide con un cuerpo enemigo"
//       que usa el Manto de Ecos, 14-b).
//   · Señuelo de caza (item 'sennuelo', compra en Toln 60 coronas o botín 8%
//     de jefes; tecla 8 — la 5/6/7 son de las herramientas del árbol 12-b):
//     se lanza 3 tiles adelante; atrae (aggro + e.lured=5 s) a enemigos
//     NO-JEFE cerca del aterrizaje. Los jefes y todo enemigo con aggro en
//     jefe (g.bossActive) lo ignoran. Pool de 1 entidad; sin sprite nuevo:
//     marcador por canales existentes (partículas + onda dmg 0).
//   · Interacciones vía la cadena tryInteract del motor (añadidos, sin tocar
//     los casos existentes):
//     - RUMOR: E de nuevo justo tras cerrar un diálogo (≤2.5 s) con cooldown
//       de 60 s por NPC → rumor corto en float (10 frases por mapa).
//     - RESTOS: cadáveres (registro anillo cap 12, ttl 30 s) examinables a
//       <0.8 tile: 25% de 1-5 coronas extra, UNA vez por cadáver (flag en la
//       entidad, anti-farm).
//     - COFRES YA ABIERTOS: reinteractuar → «vacío… pero huele a antes», sin
//       loot (nunca roba interacciones del motor ni de worldlife).
//
// RENDIMIENTO (presupuesto 16-b): O(1) por frame en el camino caliente
// (bucles lineales sobre enemigos/cadáveres ya existentes en memoria), cero
// allocations por frame (pools de módulo estilo fx.ts: 12 cadáveres + 1
// señuelo), cap duro de entidades nuevas = 13. Nada de esto toca world/,
// sprites, render ni estética.
//
// R8-3 (game feel, EPIC 2.1/2.2/2.3): sección 6 — buffers de esquiva/ataque,
// REFLEJO de proyectiles al parry v2 y cierre de ventana vs AoE. Todo vive en
// interaccionTick (ya enganchado en update.ts); el parry-Reflejo corre ANTES
// del bucle de proyectiles de update.ts y recicla el MISMO objeto Projectile
// (cero allocations). Ver el comentario de la sección 6 para los enganches
// exactos del motor (opcionales).
// ============================================================

import type { Game } from './engine'; // SOLO tipo (borrado en runtime: sin ciclo de imports)
import type { CompMode, Companion, Dir, Enemy, MapId, Player } from './types';
import { TILE } from './sprites';
import { ENEMY_DEFS } from './data';
import { audio } from './audio';

// ---------------- Constantes de balance (16-b) ----------------

export const SENNUEL_PRICE = 60;      // coronas en la forja de Toln
const SENNO_T = 5;                    // s de atracción del señuelo
const SENNO_THROW = 3 * TILE;         // 3 tiles adelante
const LURE_R = 88;                    // radio de atracción del aterrizaje (5.5 tiles)
const AGGRO_SEEK_R = 6 * TILE;        // agresivo: radio de búsqueda (6 tiles)
const AGGRO_HOLD = 60;                // agresivo: se detiene a ~3.5 tiles del objetivo
const DEF_DIST = 2 * TILE;            // defensivo: distancia de guarda (2 tiles)
const INTERPOSE_DIST = 1.5 * TILE;    // interposición: compañera a <1.5 tiles
const INTERPOSE_CD = 6;               // s entre interposiciones
const RETREAT_HP = 0.3;               // agresivo: retirada bajo el 30% de vida
const CORPSE_TTL = 30;                // s que descansan los restos
const CORPSE_CAP = 12;                // cap duro del pool de cadáveres
const EXAMINE_DIST = 0.8 * TILE;      // examinar restos a <0.8 tile
const LOOT_CHANCE = 0.25;             // 25% de coronas extra
const RUMOR_WINDOW = 2.5;             // s tras cerrar un diálogo en que E da un rumor
const RUMOR_CD = 60;                  // cooldown del rumor por NPC

// ---------------- Constantes R8-3 (game feel) ----------------
const DODGE_BUFFER_T = 0.12;   // 2.1: ventana del buffer de esquiva (s)
const ATTACK_BUFFER_T = 0.14;  // 2.2: ventana del buffer de ataque (s)
const DODGE_CHAIN_CAP_T = 0.35;// 2.1: cap del modo encadenado (cubre la roll de 0.3 s)
const ATTACK_CHAIN_CAP_T = 0.45; // 2.2: cap del modo encadenado (cubre tajo cargado 0.4 s)
const DODGE_STA_NEED = 20;     // sta requerida por la voltereta (espejo update.ts L440)
const ATK_STA_NEED = 8;        // sta mínima del tajo (espejo engine.releaseCharge)
const REFLECT_SPEED = 1.2;     // 2.3: velocidad del proyectil reflejado (×1.2)
const REFLECT_MIN_T = 1.0;     // 2.3: vida mínima de vuelo del reflejado (s)
const REFLECT_REACH = 8;       // 2.3: margen sobre el umbral de parry de update (px)
const AOE_BAND_PAD = 2;        // 2.3-b: margen de la banda de onda (px)

/** Jefes inmunes al señuelo (espejo de BOSS_DEFEAT_FLAG del motor; el élite
 *  del Acto III es 'guardian', así que queda cubierto). Set local para NO
 *  importar valores de engine.ts y mantener el módulo sin ciclos. */
// ==== 17-a (qa-combate) ==== + 'heraldo' (Vesh, jefe final 16-a): sin él el
// jefe final dejaba restos examinables (registerCorpse16b), no participaba del
// botín raro de señuelo (bossSennoLoot16b 8%) y quedaba señuelizable en los
// estados raros sin bossActive (espejo incompleto de BOSS_DEFEAT_FLAG).
const BOSS_TYPES = new Set<string>(['guardian', 'sirena', 'golem', 'vult', 'coro', 'heraldo']);

// ---------------- RNG inyectable (solo smoke/dev) ----------------

let rng: () => number = Math.random;
/** Smoke/dev: fuerza un generador determinista (null → Math.random). */
export function __iForceRng(fn: (() => number) | null): void { rng = fn ?? Math.random; }

// ---------------- Estado por Game (WeakMap, no serializa) ----------------

interface IState {
  clock: number;                       // reloj propio (avanza con el update de juego)
  rot: number;                         // rotación determinista de rumores
  closedNid: string | null;            // NPC cuyo diálogo acaba de cerrarse
  closedAt: number;                    // reloj del cierre
  rumorAt: Map<string, number>;        // último rumor por nid
  decoy: { active: boolean; x: number; y: number; t: number }; // pool de 1
  decoyAcc: number;                    // acumulador del marcador visual
  corpseAcc: number;                   // acumulador del marcador de restos
  // ---- R8-3 (game feel) ----
  spaceSeen: boolean;                  // flanco previo de Espacio (polling)
  mouseSeen: boolean;                  // flanco previo de LMB (polling)
  dodgeBuf: number;                    // clock del último flanco de Espacio (-1 = vacío)
  atkBuf: number;                      // clock del último flanco de LMB (-1 = vacío)
  dodgeChain: boolean;                 // el press nació DURANTE un lock (roll/ataque)
  atkChain: boolean;                   // el press nació DURANTE la recovery del ataque
  atkHeld: boolean;                    // LMB sigue pulsado desde el press bufferizado
  lastGlobal: number;                  // g.globalT del último tick (detección de pausa/diálogo)
  noParryAt: number;                   // clock del último aviso «no parryable» (anti-spam)
  reflectAt: number;                   // clock del último FX/sfx de reflejo (anti-doble)
}

const STATES = new WeakMap<Game, IState>();

function stateFor(g: Game): IState {
  let s = STATES.get(g);
  if (!s) {
    s = {
      clock: 0, rot: 0, closedNid: null, closedAt: 0,
      rumorAt: new Map(),
      decoy: { active: false, x: 0, y: 0, t: 0 },
      decoyAcc: 0, corpseAcc: 0,
      // R8-3: buffers/parry v2
      spaceSeen: false, mouseSeen: false,
      dodgeBuf: -1, atkBuf: -1, dodgeChain: false, atkChain: false, atkHeld: false,
      lastGlobal: -1, noParryAt: 0, reflectAt: 0,
    };
    STATES.set(g, s);
  }
  return s;
}

/** Smoke/dev: limpia el estado transitorio de un Game y el pool de restos. */
export function __iReset(g?: Game): void {
  if (g) STATES.delete(g);
  for (let i = 0; i < CORPSE_CAP; i++) corpses[i].active = false;
}

interface IMem { interposeCd: number }
const MEM = new WeakMap<Companion, IMem>();
function memFor(c: Companion): IMem {
  let m = MEM.get(c);
  if (!m) { m = { interposeCd: 0 }; MEM.set(c, m); }
  return m;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/** R8-3: distancia al cuadrado (comparaciones sin sqrt). */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

const DIRS: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// ============================================================
// 1) ÓRDENES TÁCTICAS (tecla T)
// ============================================================

/** Cicla el modo del compañero: seguir → agresivo → defensivo → seguir. */
export function cycleCompanionMode(g: Game): CompMode {
  const c = g.companion;
  const cur: CompMode = c?.mode ?? 'seguir';
  const next: CompMode = cur === 'seguir' ? 'agresivo' : cur === 'agresivo' ? 'defensivo' : 'seguir';
  if (!c || g.state !== 'play') {
    g.toast('No hay nadie a quien dar órdenes...', '#9aa0b8');
    audio.sfx('error');
    return 'seguir';
  }
  c.mode = next;
  audio.sfx('select');
  g.toast(
    next === 'agresivo' ? 'Orden: AGRESIVO — caza al enemigo con aggro más cercano (retirada bajo 30% de vida)'
      : next === 'defensivo' ? 'Orden: DEFENSIVO — guarda a 2 tiles e interpone su cuerpo (50% del daño melé)'
        : 'Orden: SEGUIR — escolta clásica, cubre tu espalda',
    next === 'agresivo' ? '#f0a050' : next === 'defensivo' ? '#8ef0b0' : '#a8c8e0',
  );
  g.floatAt(c.x, c.y - 26, next.toUpperCase(), '#a8e8c8', 8);
  return next;
}

/**
 * Movimiento del compañero por orden. Devuelve TRUE si la orden gestionó el
 * movimiento este frame (update.ts NO ejecuta la escolta original); FALSE
 * significa "seguir" (o retirada agresiva por vida baja) → la escolta
 * original corre intacta.
 */
export function companionOrdersMove(g: Game, c: Companion, p: Player, dt: number, d: number): boolean {
  const mode: CompMode = c.mode ?? 'seguir';
  if (mode === 'seguir') return false;

  if (mode === 'agresivo') {
    // retirada: vida baja → escolta original (la trae de vuelta al Portador)
    if (c.hp < c.maxHp * RETREAT_HP) return false;
    // objetivo: enemigo CON AGGRO más cercano al Portador en radio 6 tiles
    const tgt = nearestAggroTo(g, p.x, p.y, AGGRO_SEEK_R);
    if (!tgt) return false; // sin objetivo: escolta original
    const de = dist(c.x, c.y, tgt.x, tgt.y);
    if (de > AGGRO_HOLD) {
      // aborda hasta alcance de arco
      const l = Math.max(1, de);
      g.moveEntity(c, ((tgt.x - c.x) / l) * 92 * dt, ((tgt.y - c.y) / l) * 92 * dt);
      c.moving = true; c.anim += dt;
      c.dir = tgt.x > c.x ? 'right' : tgt.x < c.x ? 'left' : tgt.y > c.y ? 'down' : 'up';
    } else {
      // en posición: deriva lenta hacia el Portador (mantiene el leash sin
      // disparar el anti-atasco del motor, que exige >0.6 px/frame)
      if (d > 30) {
        const l = Math.max(1, d);
        g.moveEntity(c, ((p.x - c.x) / l) * 55 * dt, ((p.y - c.y) / l) * 55 * dt);
        c.moving = true; c.anim += dt * 0.7;
      } else { c.moving = false; c.anim += dt * 0.4; }
    }
    return true;
  }

  // defensivo: guarda a 2 tiles del Portador (nunca se aleja más)
  if (d > DEF_DIST) {
    const l = Math.max(1, d);
    g.moveEntity(c, ((p.x - c.x) / l) * 86 * dt, ((p.y - c.y) / l) * 86 * dt);
    c.moving = true; c.anim += dt;
    c.dir = p.x > c.x ? 'right' : p.x < c.x ? 'left' : p.y > c.y ? 'down' : 'up';
  } else { c.moving = false; c.anim += dt * 0.4; }
  return true;
}

/** Enemigo con aggro (vivo) más cercano a un punto, dentro de un radio. */
function nearestAggroTo(g: Game, x: number, y: number, r: number): Enemy | null {
  let best: Enemy | null = null;
  let bd = r;
  for (const e of g.enemies) {
    if (e.dead || !e.aggro) continue;
    const dd = dist(x, y, e.x, e.y);
    if (dd < bd) { bd = dd; best = e; }
  }
  return best;
}

/**
 * INTERPOSICIÓN (solo modo defensivo): llamada desde Game.damagePlayer con el
 * daño YA final (balanceador + armadura + Vigía aplicados). Devuelve la parte
 * del daño que absorbe la compañera (el Portador recibe el resto). Condiciones:
 * compañera en pie a <1.5 tiles, cooldown 6 s libre y golpe MELÉ (el origen
 * coincide con el cuerpo de un enemigo — convención Manto de Ecos, 14-b).
 */
export function companionInterpose(g: Game, final: number, fromX: number, fromY: number): number {
  const c = g.companion, p = g.player;
  if (!c || !p || final <= 0) return 0;
  if ((c.mode ?? 'seguir') !== 'defensivo') return 0;
  if (c.downT > 0) return 0;
  const mem = memFor(c);
  if (mem.interposeCd > 0) return 0;
  if (dist(c.x, c.y, p.x, p.y) >= INTERPOSE_DIST) return 0;
  let melee = false;
  for (const e of g.enemies) {
    if (e.dead) continue;
    if (Math.abs(e.x - fromX) < e.w / 2 + 6 && Math.abs(e.y - fromY) < e.h / 2 + 8) { melee = true; break; }
  }
  if (!melee) return 0;
  // la compañera absorbe el 50% (el Portador siempre conserva ≥1 de daño)
  const half = Math.min(final - 1, Math.round(final * 0.5));
  if (half <= 0) return 0;
  mem.interposeCd = INTERPOSE_CD;
  c.hp -= half;
  g.floatAt(c.x, c.y - 22, `−${half} ¡INTERPUESTA!`, '#8ef0b0', 6);
  g.burst((c.x + p.x) / 2, (c.y + p.y) / 2 - 4, '#8ef0b0', 10, 60);
  audio.sfx('hit');
  return half;
}

// ============================================================
// 2) SEÑUELO DE CAZA (tecla 8 · pool de 1)
// ============================================================

/** Usa un señuelo del inventario (flags.sennuelos). Devuelve true si voló. */
export function useSenno(g: Game): boolean {
  const p = g.player;
  if (!p || g.state !== 'play') return false;
  const st = stateFor(g);
  if (st.decoy.active) { g.toast('Ya hay un señuelo activo...', '#9aa0b8'); audio.sfx('error'); return false; }
  const n = Number(g.flags.sennuelos ?? 0);
  if (n <= 0) {
    g.toast('No te quedan señuelos (Toln vende uno por 60 coronas)', '#e88');
    audio.sfx('error');
    return false;
  }
  // 3 tiles adelante en la dirección del Portador; si cae en sólido, acorta
  // el tiro (misma idea que el fix del orbe del sátiro, 14-a)
  const [dx, dy] = DIRS[p.dir];
  let tx = p.x, ty = p.y;
  for (let r = SENNO_THROW; r >= 8; r -= 8) {
    const cx = p.x + dx * r, cy = p.y + dy * r;
    if (!g.tileSolidAt(cx, cy)) { tx = cx; ty = cy; break; }
  }
  st.decoy.active = true;
  st.decoy.x = tx; st.decoy.y = ty; st.decoy.t = SENNO_T;
  st.decoyAcc = 0;
  g.flags.sennuelos = n - 1;
  audio.sfx('whoosh');
  g.burst(tx, ty - 2, '#e8c88a', 12, 55);
  g.waves.push({ x: tx, y: ty, r: 3, maxR: 26, speed: 70, dmg: 0, hit: true });

  // atracción de aggro: enemigos NO-JEFE cerca del aterrizaje; con un JEFE en
  // combate (g.bossActive) todos ignoran el señuelo (aggro en jefe)
  if (g.bossActive) {
    g.floatAt(tx, ty - 16, 'nadie muerde...', '#9aa0b8', 6);
    return true;
  }
  let pulled = 0;
  for (const e of g.enemies) {
    if (e.dead || BOSS_TYPES.has(e.etype)) continue;
    if (e.spawnGuard !== undefined && e.spawnGuard > 0) continue;
    if (dist(e.x, e.y, tx, ty) >= LURE_R) continue;
    e.aggro = true;
    if (e.ai === 'patrulla') e.ai = 'persigue';
    e.lured = SENNO_T;
    pulled++;
  }
  if (pulled > 0) {
    g.floatAt(tx, ty - 16, `¡${pulled} atraído${pulled > 1 ? 's' : ''}!`, '#e8c88a', 7);
    audio.sfx('blip');
  } else {
    g.floatAt(tx, ty - 16, 'el olor se disipa...', '#9aa0b8', 6);
  }
  return true;
}

/** ¿Este enemigo está siguiendo un señuelo activo? (para update.ts, persigue) */
export function lureActive(g: Game, e: Enemy): boolean {
  return (e.lured ?? 0) > 0 && stateFor(g).decoy.active;
}

/** Caminar hacia el señuelo (sustituye la persecución del Portador). */
export function sennoChase(g: Game, e: Enemy, dt: number, spd: number): void {
  const d = stateFor(g).decoy;
  const dx = d.x - e.x, dy = d.y - e.y;
  const l = Math.max(1, Math.hypot(dx, dy));
  g.moveEntity(e, (dx / l) * spd * dt, (dy / l) * spd * dt);
  e.moving = true;
  e.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
}

// ============================================================
// 3) RESTOS EXAMINABLES (pool anillo de 12 · una vez por cadáver)
// ============================================================

interface Corpse {
  active: boolean;
  map: MapId;
  x: number; y: number;
  etype: string;
  ttl: number;
  examined: boolean;
}

const corpses: Corpse[] = Array.from({ length: CORPSE_CAP }, () =>
  ({ active: false, map: 'lunaris' as MapId, x: 0, y: 0, etype: 'lobo', ttl: 0, examined: false }));
let corpseIdx = 0;

/** Registra los restos de un enemigo recién muerto (desde Game.killEnemy). */
export function registerCorpse16b(g: Game, e: Enemy): void {
  if (BOSS_TYPES.has(e.etype)) return; // los jefes se deshacen en notas: sin restos
  const c = corpses[corpseIdx];
  corpseIdx = (corpseIdx + 1) % CORPSE_CAP;
  c.active = true;
  c.map = g.mapId;
  c.x = e.x; c.y = e.y;
  c.etype = e.etype;
  c.ttl = CORPSE_TTL;
  c.examined = false;
}

/** Botín raro de jefes (desde Game.killEnemy): 8% de +1 señuelo. */
export function bossSennoLoot16b(g: Game, e: Enemy): void {
  if (!BOSS_TYPES.has(e.etype)) return;
  if (rng() >= 0.08) return;
  g.flags.sennuelos = (Number(g.flags.sennuelos ?? 0) || 0) + 1;
  g.floatAt(e.x, e.y - 40, 'Botín del jefe: +1 señuelo de caza', '#e8c88a', 7);
  audio.sfx('chest');
}

/** Interacción 16-b al final de la cadena tryInteract: restos y cofres abiertos. */
export function interaccionInteract16b(g: Game): boolean {
  const p = g.player;
  if (!p || g.state !== 'play') return false;
  const st = stateFor(g);

  // 1) restos de enemigos a <0.8 tile (examen de una vez por cadáver)
  for (let i = 0; i < CORPSE_CAP; i++) {
    const c = corpses[i];
    if (!c.active || c.map !== g.mapId) continue;
    if (c.examined) continue; // ya mirados: la cadena cae en el mensaje por defecto (anti-farm)
    const dx = c.x - p.x, dy = c.y - p.y;
    if (dx * dx + dy * dy > EXAMINE_DIST * EXAMINE_DIST) continue;
    c.examined = true;
    c.ttl = Math.min(c.ttl, 1.2); // los restos se desvanecen tras el examen
    const name = ENEMY_DEFS[c.etype]?.name ?? 'enemigo';
    g.burst(c.x, c.y - 2, '#9aa0a8', 6, 40);
    if (rng() < LOOT_CHANCE) {
      const n = 1 + Math.floor(rng() * 5); // 1-5 coronas
      p.gold += n;
      g.floatAt(c.x, c.y - 14, `+${n} coronas`, '#f0c84a');
      g.toast(`Examinas los restos del ${name}: ${n} coronas escondidas`, '#f0c84a');
      audio.sfx('coin');
    } else {
      g.floatAt(c.x, c.y - 14, 'nada útil', '#9aa0b8');
      g.toast(`Examinas los restos del ${name}: nada útil... solo silencio`, '#9aa0b8');
      audio.sfx('blip');
    }
    return true;
  }

  // 2) cofres YA ABIERTOS: reinteractuar cuenta la historia, sin loot
  for (const ch of g.map.chests) {
    if (!g.openedChests.has(ch.id)) continue;
    if (ch.needPast && g.epoch !== 'pasado') continue;
    const px = ch.x * TILE + 8, py = ch.y * TILE + 8;
    if (dist(px, py, p.x, p.y) > 26) continue; // mismo radio que abrir cofres
    g.floatAt(px, py - 14, 'vacío…', '#9aa0b8');
    g.toast('El cofre está vacío… pero huele a antes.', '#9aa0b8');
    audio.sfx('blip');
    return true;
  }
  return false;
}

// ============================================================
// 4) RUMOR AL RE-PULSAR E TRAS UN DIÁLOGO (cooldown 60 s por NPC)
// ============================================================

const RUMOR_LINES_16B: Record<MapId, string[]> = {
  lunaris: [
    'Dicen que la Niebla respeta las canciones de cuna. Por algo los niños dormían.',
    'El pozo de la plaza fue el primero en quedarse sin nombre.',
    'Toln forjó gratis durante un año. Nadie se lo agradece lo bastante.',
    'Los lobos del valle antes guardaban rebaños. Ahora solo guardan hambre.',
    'Si ves luces doradas de noche, no las sigas. O sí. Yo no soy nadie para opinar.',
    'El Santuario zumba cuando pasas. Lo he oído yo misma.',
    'Mi abuela juraba que el río recordaba todas las canciones. Mi abuela bebía.',
    'Antes había un puente al norte. En algún ayer sigue ahí, dicen.',
    'Que no te quite el nombre la bruma. Y si te lo quita, ven a la plaza a por otro.',
    'El silencio del valle pesa menos desde que llegaste. Se nota, Portador.',
  ],
  bosque: [
    'Los árboles del Susurrante repiten lo que oyen. Con siglos de retraso.',
    'Cuidado con las sombras sin rostro: les gustan los nombres frescos.',
    'El Círculo dice que la Madre Espina aún vela el claro viejo.',
    'Hay setas que silban al anochecer. No las comas. Bueno, una. Bueno, dos.',
    'Las flechas de Ilwen vuelven solas al aljaba. O eso jura ella.',
    'La Ruina Antigua era un templo del Canto. Ahora es un nido de ecos.',
    'Si el Bosque te llama por tu nombre, no contestes a la primera.',
    'Los esqueletos del camino no son malos. Solo aturdidos de eternidad.',
    'Doran habla con las raíces. Las raíces, según él, se quejan de ti.',
    'Cuando llueve, dicen las piedras el nombre del tercer capellán.',
  ],
  costa: [
    'La bruma de la Costa borra el rumbo y, a veces, el apellido.',
    'Mara encendía el faro con cerillas y con miedo. Ya solo quedan las cerillas.',
    'Los neumos son espuma con mal carácter. No les debes nada.',
    'El naufragio del este canta los días de calma. Acércate solo de día.',
    'Una sirena robó el canto del mar. Por eso las olas susurran en vez de gritar.',
    'Los peces saltan donde no hay que pescar. El mar tiene humor.',
    'La Liga de Vult paga bien por mapas. Y mal por poetas.',
    'Si oyes una nana en la orilla, no es tu madre. Sigue andando.',
    'La sal conserva los barcos y corroe los recuerdos.',
    'Bajo la quilla duerme un Eco, dicen. El mar habla mucho y no firma nada.',
  ],
  aldea: [
    'Merrow bailaba en el festival hasta que la Niebla se quedó con la música.',
    'Los faroles del pueblo guardan nombres. Enciéndelos y lo verás.',
    'Mera no es su nombre. Es lo que quedó de él.',
    'Las guirnaldas del festival siguen colgadas. El viento no se atreve a bajarlas.',
    'La laguna no refleja a nadie. Antes reflejaba hasta los secretos.',
    'El Heraldo de la Orden apunta los silencios largos. Sé breve.',
    'Aquí las casas se construyeron cantando. Por eso resisten tanto.',
    'Si encuentras un aldeano que no habla, no es mudo: le falta nombre.',
    'Los espectros eran vecinos. Salúdalos; no muerde quien fue cortés.',
    'El Eco de los Nombres duerme donde el pozo se seca. O era el otro pozo.',
  ],
  cumbres: [
    'El lago helado guarda coros enteros debajo. Canta fuerte y quizá respondan.',
    'Los pastores cantaban por turnos para no dormirse. Ahora nadie duerme.',
    'El Gólem no odia. Solo recuerda con demasiado peso.',
    'Las arpías guiaban a los perdidos antes. Ahora guían al fondo del barranco.',
    'Vult cartografió estas cumbres dos veces. La primera no volvió.',
    'La ventisca silba en do menor. Los lobos la afinan.',
    'Si te pierdes, sigue el hielo resbaladizo: al final siempre hay una cabaña.',
    'Ivo dice que la montaña escucha. Yo digo que Ivo debería dormir más.',
    'Las estrellas aquí bajan a beber al lago. Por eso faltan en los mapas.',
    'El paso del norte se abre solo para quien canta. Para los demás, empuja.',
  ],
  cripta: [
    'La Cripta existe fuera del tiempo. Los que entran, también un poco.',
    'El Guardián Hueco fue el primer coro. Cuidado: aún sabe de coros.',
    'Las paredes cantan lo que firmas con voz. Piensa antes de prometer.',
    'Aquí el silencio tiene dueño. Y el dueño tiene hambre.',
    'Los peregrinos que cantaron hasta vaciarse aún marcan el paso.',
    'Velmora fue la primera. Nadie sabe de qué. Todos bajan la voz al decirlo.',
    'Si el Eco te habla con voz de tu madre, no es tu madre. Escucha, no respondas.',
    'Las lámparas nunca se apagan. Nadie las enciende. Piénsalo.',
    'El polvo aquí no se posa: espera.',
    'Bajar es fácil. Subir canta.',
  ],
};

/** El motor la llama en Game.closeDialogue: recuerda junto a qué NPC cerró. */
export function noteDialogueClosed16b(g: Game): void {
  const p = g.player;
  if (!p) return;
  const st = stateFor(g);
  let best: string | null = null;
  let bd = 40;
  for (const n of g.npcs) {
    const dd = dist(n.x, n.y, p.x, p.y);
    if (dd < bd) { bd = dd; best = n.nid; }
  }
  st.closedNid = best;
  st.closedAt = st.clock;
}

/** Pre-paso de tryInteract: E de nuevo tras un diálogo → rumor corto. */
export function rumorAfterDialogue16b(g: Game): boolean {
  const p = g.player;
  if (!p || g.state !== 'play') return false;
  const st = stateFor(g);
  if (!st.closedNid) return false;
  if (st.clock - st.closedAt > RUMOR_WINDOW) { st.closedNid = null; return false; }
  let npc = null as null | { nid: string; dispName: string; x: number; y: number };
  let bd = 34;
  for (const n of g.npcs) {
    const dd = dist(n.x, n.y, p.x, p.y);
    if (dd < bd) { bd = dd; npc = n; }
  }
  if (!npc || npc.nid !== st.closedNid) return false;
  const last = st.rumorAt.get(npc.nid);
  if (last !== undefined && st.clock - last < RUMOR_CD) { st.closedNid = null; return false; }
  const pool = RUMOR_LINES_16B[g.mapId];
  const line = pool[st.rot++ % pool.length];
  g.floats.push({ x: npc.x, y: npc.y - 26, text: `${npc.dispName}: «${line}»`, t: 3.2, color: '#cfe0f8', vy: -6, size: 7 });
  audio.sfx('blip');
  st.rumorAt.set(npc.nid, st.clock);
  st.closedNid = null; // el siguiente E vuelve a abrir el diálogo
  return true;
}

// ============================================================
// 5) TICK (llamado desde update.ts, estado play · O(1)/frame)
// ============================================================

export function interaccionTick(g: Game, dt: number): void {
  if (!g.player || g.state !== 'play') return;
  const st = stateFor(g);
  st.clock += dt;

  // cooldown de interposición de la compañera
  const c = g.companion;
  if (c) {
    const mem = MEM.get(c);
    if (mem && mem.interposeCd > 0) mem.interposeCd -= dt;
  }

  // señuelo: vida y marcador (partículas + onda dmg 0 — canales existentes)
  const d = st.decoy;
  if (d.active) {
    d.t -= dt;
    if (d.t <= 0) {
      d.active = false;
      g.burst(d.x, d.y - 2, '#e8c88a', 6, 40);
    } else {
      st.decoyAcc -= dt;
      if (st.decoyAcc <= 0) {
        st.decoyAcc = 0.38;
        g.particles.push({
          x: d.x + (rng() - 0.5) * 10, y: d.y, vx: 0, vy: -14,
          t: 0.6, maxT: 0.6, color: '#e8c88a', size: 1.6, grav: 0,
        });
        g.waves.push({ x: d.x, y: d.y, r: 2, maxR: 9, speed: 12, dmg: 0, hit: true });
      }
    }
  }

  // timers de atracción
  for (const e of g.enemies) {
    if (e.lured !== undefined && e.lured > 0) {
      e.lured -= dt;
      if (e.lured <= 0) e.lured = undefined;
    }
  }

  // restos: ttl + un marcador sutil cada 0.5 s (máx 12 → ≤24 partículas vivas)
  st.corpseAcc -= dt;
  if (st.corpseAcc <= 0) {
    st.corpseAcc = 0.5;
    for (let i = 0; i < CORPSE_CAP; i++) {
      const c2 = corpses[i];
      if (!c2.active || c2.map !== g.mapId) continue;
      g.particles.push({
        x: c2.x + (rng() - 0.5) * 6, y: c2.y - 2, vx: 0, vy: -5,
        t: 0.7, maxT: 0.7, color: '#8a9098', size: 1.4, grav: 0,
      });
    }
  }
  for (let i = 0; i < CORPSE_CAP; i++) {
    const c2 = corpses[i];
    if (!c2.active) continue;
    c2.ttl -= dt;
    if (c2.ttl <= 0) c2.active = false;
  }

  // ==== R8-3 (game feel): buffers de esquiva/ataque + parry v2 (REFLEJO y
  // cierre de ventana vs AoE). interaccionTick corre en update.ts (línea ~501)
  // ANTES de que ese mismo frame procese proyectiles (~570), ondas (~666) y
  // telegrafías (~683): aquí se decide todo lo que esos bucles consumen. ====
  gameFeelTick(g, dt, st);
}

// ============================================================
// 6) GAME FEEL R8-3 (EPIC 2.1 · 2.2 · 2.3)
// ============================================================
//
// DÓNDE VIVÍA CADA MECÁNICA (auditoría R8-3):
//   · Movimiento real: update.ts ~257-355. Fuera de hielo el control ya es 1:1
//     (arranque y frenado instantáneos, sin derrape): 2.1 no necesita parche.
//     El derrape del lago helado (tile 'i', Cumbres) es mecánica INTENCIONAL
//     del Acto II y se conserva.
//   · Esquiva: engine.onKeyDown (~1523) solo arma g.rollQueued si se pulsa con
//     roll/ataque libres y sta≥20 → pulsar DURANTE un lock se perdía; update.ts
//     (~440-451) la consume. El BUFFER de 120 ms vive aquí (flanco de Espacio
//     por polling de g.keys + noteDodgePressed como enganche opcional) y se
//     consume cuando la acción vuelve a estar disponible; si el press nació
//     DURANTE el lock, ENCADENA hasta que el lock termine (cap 0.35 s, cubre
//     la voltereta) en vez de caducar antes; si el lock es la recovery del
//     ataque (attackT>0), la CANCELA (2.2) y rueda al instante. La ejecución
//     nativa (dirección, FX, sfx, coste) sigue siendo la de update.ts: aquí
//     solo se arma g.rollQueued — cero duplicación.
//   · Ataque: engine.startAttack/releaseCharge (~1633-1670): daño instantáneo
//     al soltar; attackT (0.26/0.4 s) es puro lockout=recovery. Un clic durante
//     attackT se perdía (startAttack retornaba). El BUFFER de 140 ms vive aquí
//     (flanco de g.mouse.down + noteAttackPressed opcional): si nació durante
//     la recovery ENCADENA hasta que attackT termina (cap 0.45 s, cubre el
//     cargado); al soltarse el lock, si el botón sigue pulsado arranca la
//     carga nativa y si fue un tap corto suelta el tajo seco (charging +
//     releaseCharge del motor, sin duplicar daño). La esquiva bufferizada
//     tiene prioridad (¡evadir manda!).
//   · Parry: ventana en engine.startParry (~1672: parryT=0.2, parryFx=0.32,
//     sta−12). Melé: engine.damagePlayer (~2042) — intacto. Proyectil:
//     update.ts ~617-631 DESTRUYA el proyectil parado. El REFLEJO vive aquí:
//     corre en interaccionTick, ANTES de ese bucle, recicla el MISMO objeto
//     (voltea vx/vy hacia el enemigo más cercano, ×1.2 velocidad, from→'player',
//     t refrescado) y el bucle aliado de update.ts le da el daño original al
//     objetivo. Cero allocations.
//   · AoE de jefes: g.waves (dmg>0) y g.telegraphs (dmg>0) resueltos en
//     update.ts ~666-698 vía damagePlayer; el branch de parry del motor los
//     ANULABA gratis (res+20 + intento de aturdir) consumiendo el ataque sin
//     reflejo ni riesgo. Ahora la ventana se CIERRA aquí con feedback de
//     «no parryable» (tintilla del guardia vía parryFx + sfx parryFail) y el
//     impacto entra (esquivable con voltereta/iframes, nunca parryable).
//
// ENGANCHES OPCIONALES PARA EL ORQUESTADOR (input exacto por evento; sin ellos
// el polling por frame ya funciona y ambos caminos son idempotentes):
//   1) engine.ts · onKeyDown (línea ~1523, branch state==='play'): añadir
//      `if (k === ' ') noteDodgePressed(this);`
//      (la línea existente de rollQueued puede quedarse: es idempotente).
//   2) engine.ts · onMouseDown (línea ~1593): cambiar
//      `else if (this.state === 'play') this.startAttack();`
//      por
//      `else if (this.state === 'play') { noteAttackPressed(this); this.startAttack(); }`
//
// PRESUPUESTO: O(1) por frame en reposo (2 lecturas de flanco + guardas); los
// barridos de waves/telegraphs/projectiles solo corren con parryT>0 (ventana
// de 0.2 s) y sobre arrays pequeños. Cero allocations en régimen; las
// partículas/ondas de feedback solo se emiten en el EVENTO (patrón del repo).
// ============================================================

/** Enganche del motor (opcional, ver cabecera): registra el flanco de Espacio
 *  para el buffer de esquiva de 120 ms. Idempotente con el polling. */
export function noteDodgePressed(g: Game): void {
  if (!g.player || g.state !== 'play') return;
  const st = stateFor(g);
  const p = g.player;
  st.dodgeBuf = st.clock;
  st.dodgeChain = p.rollT > 0 || p.attackT > 0;
  st.spaceSeen = true;
}

/** Enganche del motor (opcional, ver cabecera): registra el flanco de LMB
 *  para el buffer de ataque de 140 ms. Idempotente con el polling. */
export function noteAttackPressed(g: Game): void {
  if (!g.player || g.state !== 'play') return;
  const st = stateFor(g);
  st.atkBuf = st.clock;
  st.atkChain = g.player.attackT > 0;
  st.atkHeld = true;
  st.mouseSeen = true;
}

/** Tick de game feel (llamado al final de interaccionTick, estado play). */
function gameFeelTick(g: Game, dt: number, st: IState): void {
  const p = g.player!;
  const space = g.keys.has(' ');
  const mdown = g.mouse.down;

  // ¿hubo pausa/diálogo/muerte desde el último tick? g.globalT avanza SIEMPRE
  // con el mismo dt que update (loop del motor), así que gap==dt en juego
  // continuo; gap grande = frames sin simular → el input que venía pulsado NO
  // es un flanco limpio y los buffers expiran (nada fantasma al reanudar).
  const gap = g.globalT - st.lastGlobal;
  st.lastGlobal = g.globalT;
  if (gap > dt * 2 + 0.03) {
    st.dodgeBuf = -1; st.atkBuf = -1; st.atkHeld = false;
    st.spaceSeen = space; st.mouseSeen = mdown; // re-arma sin disparar flancos
  } else {
    if (space && !st.spaceSeen) { // flanco subida Espacio
      st.dodgeBuf = st.clock;
      st.dodgeChain = p.rollT > 0 || p.attackT > 0; // nació durante un lock
    }
    st.spaceSeen = space;
    if (mdown && !st.mouseSeen) { // flanco LMB
      st.atkBuf = st.clock;
      st.atkChain = p.attackT > 0; // nació durante la recovery
      st.atkHeld = true;
    } else if (!mdown) st.atkHeld = false; // el dedo ya soltó: era un tap corto
    st.mouseSeen = mdown;
  }

  // ---- 2.1: BUFFER DE ESQUIVA (~120 ms; si nació DURANTE un lock, encadena
  //      hasta que el lock termine — cap 0.35 s) — y 2.2: si el lock es la
  //      recovery del ataque, la CANCELA y rueda al instante. El consumo va
  //      ANTES de la caducidad: el tick en que el lock se suelta ES el momento
  //      de disparar, no el de expirar. ----
  if (st.dodgeBuf >= 0) {
    if (p.rollT <= 0 && p.sta >= DODGE_STA_NEED && !g.rollQueued) {
      st.dodgeBuf = -1;
      if (p.attackT > 0) { p.attackT = 0; p.charging = false; } // cancela recovery
      g.rollQueued = true; // update.ts la ejecuta con su camino nativo (dirección/FX/sfx/coste)
    } else if (st.clock - st.dodgeBuf > (st.dodgeChain ? DODGE_CHAIN_CAP_T : DODGE_BUFFER_T)) {
      st.dodgeBuf = -1; // expiró
    }
  }

  // ---- 2.2: BUFFER DE ATAQUE (~140 ms; si nació durante la recovery, encadena
  //      hasta que attackT termine — cap 0.45 s) en vez de perderse ----
  if (st.atkBuf >= 0) {
    if (!p.charging && p.attackT <= 0 && p.rollT <= 0 && !g.rollQueued && p.sta >= ATK_STA_NEED) {
      st.atkBuf = -1;
      if (st.atkHeld) {
        g.startAttack(); // sigue pulsado: la carga nativa continúa
      } else {
        // tap corto ya soltado: tajo seco vía el propio motor (mismo daño/coste/FX)
        p.charging = true;
        p.chargeT = 0;
        g.releaseCharge();
      }
    } else if (st.clock - st.atkBuf > (st.atkChain ? ATTACK_CHAIN_CAP_T : ATTACK_BUFFER_T)) {
      st.atkBuf = -1; // expiró
    }
  }

  if (p.parryT > 0 && p.iframes <= 0 && p.rollT <= 0) {
    // ---- 2.3-a: PARRY v2 — REFLEJO de proyectiles hacia el enemigo más cercano
    reflectProjectiles(g, st, p);

    // ---- 2.3-b: PARRY vs AoE — la ventana NO protege de ondas/slam de jefe:
    //      se cierra con feedback ANTES de que update.ts aplique el impacto ----
    let aoe = false;
    for (const w of g.waves) {
      if (w.dmg <= 0 || w.hit) continue;
      const rNext = w.r + w.speed * dt; // misma integración que update.ts (~668)
      const d2w = dist2(w.x, w.y, p.x, p.y);
      const lo = rNext - 8 - AOE_BAND_PAD;
      const hi = rNext + 8 + AOE_BAND_PAD;
      if ((lo <= 0 || d2w > lo * lo) && d2w < hi * hi) { aoe = true; break; }
    }
    if (!aoe) {
      for (const t of g.telegraphs) {
        if (t.dmg <= 0 || t.t - dt > 0) continue; // estalla este mismo frame
        if (dist2(t.x, t.y, p.x, p.y) < t.r * t.r) { aoe = true; break; }
      }
    }
    if (aoe) {
      p.parryT = 0; // ventana cerrada: el AoE entra (esquivable, nunca parryable)
      noParryFeedback(g, st, p);
    }
  }
}

/** 2.3-a: REFLEJO — recicla cada proyectil enemigo que alcanza la guardia:
 *  voltea el rumbo hacia el enemigo vivo más cercano (o rebote puro si no hay
 *  ninguno), velocidad ×1.2, from→'player' (aliado: no daña al Portador, sí a
 *  enemigos vía el bucle aliado de update.ts) y vida de vuelo refrescada.
 *  El margen REFLECT_REACH adelanta el reflejo al umbral de parry de update.ts
 *  (radius+7 tras mover) para que el reflejo SIEMPRE gane la carrera. */
function reflectProjectiles(g: Game, st: IState, p: Player): void {
  const projs = g.projectiles;
  let fx = false;
  for (let i = 0; i < projs.length; i++) {
    const pr = projs[i];
    if (pr.from !== 'enemy') continue;               // solo proyectiles enemigos
    const dxp = p.x - pr.x, dyp = p.y - 4 - pr.y;    // misma cuenta que update.ts (~620)
    const reach = pr.radius + 7 + REFLECT_REACH;
    if (dxp * dxp + dyp * dyp >= reach * reach) continue;
    if (pr.vx * dxp + pr.vy * dyp <= 0) continue;    // ya se aleja: no reflejar
    // objetivo: enemigo vivo más cercano AL PROYECTIL (empate: orden de array)
    let tx = 0, ty = 0, bd2 = Infinity, has = false;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const d2e = dist2(e.x, e.y - 4, pr.x, pr.y);   // e.y−4: centro del cuerpo (update.ts ~593)
      if (d2e < bd2) { bd2 = d2e; tx = e.x; ty = e.y - 4; has = true; }
    }
    const dx = has ? tx - pr.x : -pr.vx;
    const dy = has ? ty - pr.y : -pr.vy;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    const sp = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy) * REFLECT_SPEED;
    pr.vx = (dx / l) * sp;                           // reciclado del MISMO objeto: cero alloc
    pr.vy = (dy / l) * sp;
    pr.from = 'player';                              // aliado: conserva daño/elemento/sprite
    pr.t = Math.max(pr.t, REFLECT_MIN_T);            // vida de vuelta garantizada
    fx = true;
  }
  // destello/SFX del reflejo: 1 por frame aunque entren varios proyectiles
  if (fx && st.clock - st.reflectAt > 0.05) {
    st.reflectAt = st.clock;
    audio.sfx('parry');                              // ping metálico existente (sin SFX nuevo)
    p.res = Math.min(p.maxRes, p.res + 15);          // paridad con el parry de proyectil
    p.parryFx = 0.4;                                 // destello del guardia (canal de render ~521)
    g.floatAt(p.x, p.y - 22, '¡REFLEJO!', '#fff8c0', 7);
    g.burst(p.x, p.y - 8, '#fff8c0', 10, 90);
    g.waves.push({ x: p.x, y: p.y, r: 3, maxR: 18, speed: 90, dmg: 0, hit: true });
    g.hitStop = 0.07;                                // micro-pausa (el parry melé usa 0.12)
  }
}

/** 2.3-b: feedback de «no parryable» — tintilla breve del guardia (reusa el
 *  canal parryFx de render), sfx de fallo y aviso flotante. 1 aviso por
 *  intento (anti-spam 0.4 s). El daño del AoE entra por el camino normal. */
function noParryFeedback(g: Game, st: IState, p: Player): void {
  if (st.clock - st.noParryAt < 0.4) return;
  st.noParryAt = st.clock;
  audio.sfx('parryFail');
  p.parryFx = 0.15;
  g.floatAt(p.x, p.y - 26, '¡no parryable!', '#9aa0b8', 6);
  g.burst(p.x, p.y - 8, '#8a90a8', 6, 40);
}

/** Smoke/dev: instantánea del señuelo activo. */
export function __iDecoy(g: Game): { active: boolean; x: number; y: number; t: number } {
  const d = stateFor(g).decoy;
  return { active: d.active, x: d.x, y: d.y, t: d.t };
}
