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

/** Jefes inmunes al señuelo (espejo de BOSS_DEFEAT_FLAG del motor; el élite
 *  del Acto III es 'guardian', así que queda cubierto). Set local para NO
 *  importar valores de engine.ts y mantener el módulo sin ciclos. */
const BOSS_TYPES = new Set<string>(['guardian', 'sirena', 'golem', 'vult', 'coro']);

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
}

/** Smoke/dev: instantánea del señuelo activo. */
export function __iDecoy(g: Game): { active: boolean; x: number; y: number; t: number } {
  const d = stateFor(g).decoy;
  return { active: d.active, x: d.x, y: d.y, t: d.t };
}
