// ============================================================
// ECOS DE AELTHAR — VIDA DEL MUNDO (agente 13-b · mundo-vivo)
// Fauna ambiental, rumores dinámicos de NPCs, eventos callejeros y
// micro-interacciones con props: el mundo respira aunque no avances.
//
// INTEGRACIÓN (solo ya cableado: engine.ts llama worldTick(this, dt) en
// Game.update — estados play/dialogue). Quedan DOS líneas para el
// integrador, ambas OPCIONALES para el juego (sin ellas no hay fauna
// visible ni micro-interacciones; rumores y eventos SÍ funcionan solos):
//
// 1) FAUNA/VIAJERO (render.ts · drawWorld · tras el bucle de cofres):
//      drawWorldLife(g, sx, sy); // 13-b fauna del mundo
//    (sx/sy son los helpers que drawWorld ya tiene; si se omiten, la
//     función calcula los suyos de g.camX/camY)
//
// 2) MICRO-INTERACCIONES (engine.ts · tryInteract · 1 línea exacta):
//      tryInteract() {
//        const it = this.nearestInteract();
//        if (it) { audio.sfx('select'); it.act(); }
//        else if (worldInteract(this)) { audio.sfx('select'); }  // ← 13-b
//        else this.toast('No hay nada que interactuar aquí.', '#9aa0b8');
//      }
//    + ampliar el import de la línea 21: `import { worldTick, worldInteract } from './worldlife';`
//    Semántica: worldInteract SOLO atiende features que nearestInteract
//    ignora (pozo/lápida/roca/agua como TILES, props wreck/faro, faroles
//    YA encendidos). Nunca roba NPCs, cofres, santuarios ni faroles sin
//    encender. Devuelve true si consumió la interacción.
//
// RENDIMIENTO (presupuesto 13-b): máx 12 criaturas vivas (pool fijo
// reutilizado como fx.ts), spawn solo en cámara, O(1)/frame, cero
// allocations por frame (los pushes a floats/particles son eventos, no
// per-frame). Estado en WeakMap<Game,…>: 1 Game por página, no se
// serializa (es ambiente, no progreso).
//
// R7-V4 · VIDA AMBIENTE EN LA EXPANSIÓN (aditivo, firmas intactas):
//   costa   : gaviotas en vuelo circular sobre el mar (silueta 3 frames ×
//             2 tonos) · cangrejos laterales en la arena que se entierran
//             al acercarte · pez determinista (hash+tiempo, ya existía).
//   aldea   : gallinas/palomas picoteando con vuelo corto de huida (el
//             humo/vahos de village.ts NO se duplica).
//   cumbres : rapaces planeando en círculos altos (1 frame lento) + NIEVE
//             DEL SUELO a ráfagas puntuales (solo levanta motas de tiles
//             'S'/'='; la VENTISCA GLOBAL es de weather.ts/R7-V3 — no se
//             invade su terreno: ≤5 motas/1.15 s, radio ±11×±8 tiles).
//   REGLAS: spawn/despawn determinista por hash(mapa, tick de reloj) para
//   la fauna nueva (sin Math.random), pool fijo sin allocations por frame
//   (los bursts de nieve son eventos), y densidad escalada con
//   perfQuality() vía qMul ×1/×0.6/×0.35 (caps por familia, mín. 1).
//
// R10-4 · EVENTOS ALEATORIOS DEL ECO (deterministas por hash de tiempo):
//   cada 70-120 s de juego puede ocurrir UNO (hash del reloj, sin
//   Math.random en la selección; máx 1 activo):
//     MANADA    — 3-5 enemigos del bioma actual aparecen FORMADOS en el borde
//                 de pantalla y buscan al Portador (aggro compartido: flag
//                 aggro=true al spawn, el mismo que marca update.ts). El push
//                 replica el patrón del motor (makeEnemy+enemies.push, como
//                 spawnEventRing/summonNeumo) SIN tocar engine.
//     HALLAZGO  — destello del Eco en suelo transitable: XP pequeña + 1-2
//                 coronas por las MISMAS APIs que los cofres (gainXp/gold).
//     FENÓMENO  — el mundo contiene el aliento: requestSlowmo(2 s, fxcore,
//                 solo lectura) + partículas musicales. El coro lejano es un
//                 ENGANCHE DE AUDIO DOCUMENTADO (no se llama desde aquí).
//     VIAJERO   — el errante decorativo ya existente ahora lleva una línea de
//                 lore determinista y responde a (E) vía worldInteract + toast
//                 (el sistema de diálogo del motor escribe estado de campaña:
//                 fuera de alcance, se documenta como enganche).
//   NUNCA con jefe/intro de jefe/combate/diálogo/desafío; solo en biomas con
//   fauna (SPAWN_OK) y en el presente (la manada también evita 'pasado').
//   REGLA DE ORO: todo se APAGA con perfQuality()==2; nada toca flags de
//   historia ni stats del jugador salvo el hallazgo.
// ============================================================

import type { Game } from './engine';
import { VIEW_W, VIEW_H, ZOOM } from './engine';
import type { Npc, ToneKind, Enemy, MapId } from './types';
import { TILE, SOLID_CHARS } from './sprites';
import { tileAt } from './maps';
import { isNight } from './update'; // solo lectura (propiedad del agente 3-b)
import { dominantTone } from './hooks'; // tono dominante del Portador (3-b)
import { audio } from './audio';
import { perfQuality } from './perf'; // escalón de calidad (R5-O1): 0 alta · 1 media · 2 baja
import { hash2 } from './world/palette'; // hash determinista (fauna nueva SIN Math.random)
import { requestSlowmo } from './fxcore'; // R10-4: fenómeno del Eco (API de fxcore, solo lectura)
import { bossIntroActive } from './actors/bossintro'; // R10-4: NUNCA durante la intro de un jefe

// ---------------- Fauna: pool fijo ----------------

const AVE = 0;        // posa en árboles ('t'/'p'), huye al acercarte
const MARIPOSA = 1;   // de día (g.dayT), deambula cerca del suelo
const LUCIERNAGA = 2; // de noche (isNight), brillo pulsante
const PEZ = 3;        // Costa: salta en el mar y salpica (R7-V4: hash+tiempo)
const GAVIOTA = 4;    // Costa: vuelo circular sobre el mar (silueta 3 frames × 2 tonos)
const CANGREJO = 5;   // Costa: paseo lateral en la arena; se entierra al acercarte
const GALLINA = 6;    // Aldea: picoteo + vuelo corto de huida (gallina/paloma)
const RAPAZ = 7;      // Cumbres: planea en círculos altos (1 frame, lento)

const POOL_CAP = 12;                          // presupuesto duro de criaturas vivas
const KIND_CAPS = [4, 6, 6, 3, 3, 4, 4, 2];  // aves, voladoras, voladoras, peces, gaviotas, cangrejos, gallinas, rapaces

interface Critter {
  active: boolean;
  kind: number;
  x: number; y: number;       // px de mundo
  vx: number; vy: number;
  ax: number; ay: number;     // ancla (vuelta al nido / nivel del agua)
  t: number;                  // edad
  life: number;               // vida útil
  state: number;              // 0 posada/quieto/oculto · 1 huyendo/salto · 2 retirada (gaviota/rapaz)
  st: number;                 // temporizador de estado
  seed: number;               // fase fija por criatura (hash en la fauna nueva)
  r: number;                  // R7-V4: radio del círculo de vuelo (gaviota/rapaz)
  w: number;                  // R7-V4: velocidad angular rad/s con signo (círculos)
  n: number;                  // R7-V4: contador de ciclos (pez: saltos · gallina: variante)
  f: number;                  // R7-V4: orientación de dibujo (+1 derecha / −1 izquierda)
}

// Pool fijo: ranuras reutilizadas, cero GC por frame (patrón fx.ts)
const POOL: Critter[] = Array.from({ length: POOL_CAP }, () => ({
  active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
  t: 0, life: 1, state: 0, st: 0, seed: 0, r: 0, w: 0, n: 0, f: 1,
}));
const kindCount = [0, 0, 0, 0, 0, 0, 0, 0];
let liveCount = 0; // criaturas vivas (O(1) para el cap)

/** Mapas con fauna (cripta = fuera del tiempo, arena = desafío). */
const SPAWN_OK = new Set<string>(['lunaris', 'bosque', 'costa', 'aldea', 'cumbres']);

// ---------------- Estado por Game (WeakMap) ----------------

interface WLState {
  clock: number;              // reloj propio (no depende de g.globalT)
  spawnAcc: number;
  fishAcc: number;            // R7-V4: acumulador del repositor del pez de costa
  fishTries: number;          // R7-V4: nº de intentos (determinismo por hash)
  evtIn: number;              // segundos hasta el próximo evento callejero
  evtCount: number;
  forced: 'eco' | 'rafaga' | 'viajero' | null; // clase fijada por dev/smoke
  trav: { active: boolean; x: number; y: number; dir: number; t: number; lore: string; spoke: boolean }; // R10-4: lore + «ya habló»
  rumorNext: Map<string, number>; // cooldown por NPC (nid → reloj)
  rot: number;                // rotación determinista de rumores
  rumorsShown: number;
  lastRumor: string;
  // R10-4: eventos aleatorios del Eco (hash de tiempo, máx 1 activo)
  r10Next: number;            // reloj del próximo evento grande (70-120 s)
  r10Count: number;           // eventos grandes disparados (stats dev)
  r10Forced: R10Kind | null;  // clase fijada por dev/smoke
  find: { active: boolean; map: string; x: number; y: number; t: number; tw: number }; // hallazgo
  pack: { t: number; refs: (Enemy | null)[] }; // manada viva (máx 5 refs)
  // R11-4c: rutinas de NPCs (caminar/trabajar/dormir) — estado por Game
  r11: { armedMap: string; npcCount: number; mem: Map<string, NpcMem> };
}

// R11-4c: memoria de rutina por NPC (se crea UNA vez al armar, cero allocs/frame)
interface NpcMem {
  wx: number; wy: number;   // ancla de trabajo (px, con nudge a tile transitable)
  cx: number; cy: number;   // ancla de casa (px)
  hx: number; hy: number;   // spawn original (px) — referencia
  phase: number;            // fase determinista por nid (hash)
  mode: number;             // 0 camino · 1 trabajo · 2 duerme · 3 guardia
  wait: number;             // pausa anti-atasco (s)
  flip: boolean;            // alterna prioridad de eje al chocar
}

const STATES = new WeakMap<Game, WLState>();

function stateFor(g: Game): WLState {
  let s = STATES.get(g);
  if (!s) {
    s = {
      clock: 0, spawnAcc: 0, fishAcc: 0, fishTries: 0, evtIn: 38 + Math.random() * 22, evtCount: 0,
      forced: null,
      trav: { active: false, x: 0, y: 0, dir: 1, t: 0, lore: '', spoke: false },
      rumorNext: new Map(), rot: 0, rumorsShown: 0, lastRumor: '',
      r10Next: 70 + hash2(911, 337) * 50, r10Count: 0, r10Forced: null, // primer evento: 70-120 s (hash)
      find: { active: false, map: '', x: 0, y: 0, t: 0, tw: 0 },
      pack: { t: 0, refs: [null, null, null, null, null] },
      r11: { armedMap: '', npcCount: -1, mem: new Map() },
    };
    STATES.set(g, s);
  }
  return s;
}

// ---------------- Helpers de cámara (mundo px) ----------------

// R7-V4: tupla RASPA de módulo (cero allocations por frame — viewBounds se
// llama 1-2 veces por frame). Todos los consumidores la leen AL MOMENTO
// (verificados: tickCritter/trySpawn/tickTraveler/fireEvent/tickExpansion);
// no guardar el resultado entre llamadas.
const VIEW_B: [number, number, number, number] = [0, 0, 0, 0];
function viewBounds(g: Game): [number, number, number, number] {
  VIEW_B[0] = g.camX / ZOOM;
  VIEW_B[1] = g.camY / ZOOM;
  VIEW_B[2] = (g.camX + VIEW_W) / ZOOM;
  VIEW_B[3] = (g.camY + VIEW_H) / ZOOM;
  return VIEW_B;
}

function inView(x: number, y: number, b: [number, number, number, number], margin: number): boolean {
  return x >= b[0] - margin && x <= b[2] + margin && y >= b[1] - margin && y <= b[3] + margin;
}

/** ¿Hay combate activo? (algún enemigo vivo con aggro) — O(n) pequeño. */
function combatActive(g: Game): boolean {
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (!e.dead && e.aggro) return true;
  }
  return false;
}

// ---------------- Fauna: spawn ----------------

function capFor(g: Game): number {
  return g.epoch === 'pasado' ? POOL_CAP : 8; // más vida en el pasado
}

// R7-V4 · escalado por calidad (mismo criterio que R6-V10): ×1/×0.6/×0.35.
// En calidad baja la fauna nueva deja de repoñense por encima del cap
// reducido ⇒ coste ~0.35 del régimen (mínimo 1 criatura por familia).
const Q_MUL = [1, 0.6, 0.35] as const;
function qMul(): number {
  return Q_MUL[perfQuality()];
}
/** Cap efectivo de una familia a la calidad actual (mín. 1). */
function kindCap(kind: number): number {
  return Math.max(1, Math.round(KIND_CAPS[kind] * qMul()));
}

/** PRNG determinista (mismo patrón que challenge.ts/maps.ts): misma semilla
 *  ⇒ misma secuencia. El repositor del pez lo usa en vez de hash2 porque los
 *  hashes de seeds pequeños CLUSTERIZAN (0/54 puntos en agua en la Costa). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spawnInterval(g: Game): number {
  return g.epoch === 'pasado' ? 1.35 : 2.4;
}

function freeSlot(): Critter | null {
  for (let i = 0; i < POOL_CAP; i++) if (!POOL[i].active) return POOL[i];
  return null;
}

function spawnAt(g: Game, kind: number, x: number, y: number, life: number): boolean {
  const c = freeSlot();
  if (!c) return false;
  c.active = true; c.kind = kind;
  c.x = x; c.y = y; c.vx = 0; c.vy = 0; c.ax = x; c.ay = y;
  c.t = 0; c.life = life; c.state = 0; c.st = 1 + Math.random() * 4;
  c.seed = Math.random() * Math.PI * 2;
  c.r = 0; c.w = 0; c.n = 0; c.f = 1;
  kindCount[kind]++;
  liveCount++;
  return true;
}

/**
 * R7-V4 · spawn determinista (hash+tiempo): como spawnAt pero fase,
 * temporizador inicial y vida salen del hash de la posición y del tick de
 * spawn (`sd`). Sin Math.random: misma (mapa, reloj, calidad) ⇒ mismo spawn.
 * Devuelve la ranura (para configurar r/w/n) o null si el pool está lleno.
 */
function spawnDet(
  kind: number, x: number, y: number, life: number, sd: number,
): Critter | null {
  const c = freeSlot();
  if (!c) return null;
  c.active = true; c.kind = kind;
  c.x = x; c.y = y; c.vx = 0; c.vy = 0; c.ax = x; c.ay = y;
  c.t = 0; c.life = life; c.state = 0;
  c.st = 1.5 + hash2(sd * 7 + 1, 613) * 4;   // espera inicial determinista
  c.seed = hash2(sd * 11 + 3, 617) * TAU;    // fase fija por criatura
  c.r = 0; c.w = 0; c.n = 0; c.f = 1;
  kindCount[kind]++;
  liveCount++;
  return c;
}

/** Un intento de spawn: samplea hasta 5 puntos de cámara y valida el tile. */
function trySpawn(g: Game): void {
  if (liveCount >= capFor(g)) return;
  const b = viewBounds(g);
  const m = 20;
  for (let i = 0; i < 5; i++) {
    const wx = b[0] - m + Math.random() * (b[2] - b[0] + m * 2);
    const wy = b[1] - m + Math.random() * (b[3] - b[1] + m * 2);
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= g.map.w || ty >= g.map.h) continue;
    const ch = tileAt(g.map, g.rows, tx, ty, g.epoch);
    // R7-V4: el pez de costa lo cría el repositor DETERMINISTA (tickExpansion,
    // hash+tiempo); legacy trySpawn ya no lo instancia.
    if (ch === 't' || ch === 'p') {
      // ave posada en la copa de un árbol
      if (kindCount[AVE] < KIND_CAPS[AVE]) {
        if (spawnAt(g, AVE, tx * TILE + 8, ty * TILE + 5, 14 + Math.random() * 12)) return;
      }
    } else if (!SOLID_CHARS.has(ch)) {
      // voladora de suelo: mariposa de día / luciérnaga de noche
      const k = isNight(g) ? LUCIERNAGA : MARIPOSA;
      if (kindCount[k] < KIND_CAPS[k]) {
        if (spawnAt(g, k, tx * TILE + 8, ty * TILE + 6, 9 + Math.random() * 7)) return;
      }
    }
  }
}

// ---------------- Fauna: update ----------------

function despawn(c: Critter): void {
  c.active = false;
  kindCount[c.kind]--;
  liveCount--;
}

function tickCritter(g: Game, c: Critter, dt: number, b: [number, number, number, number]): void {
  c.t += dt;
  const p = g.player!;
  switch (c.kind) {
    case AVE: {
      if (c.state === 0) {
        // posada: picoteos/hop ocasionales; huye si te acercas
        c.st -= dt;
        if (c.st <= 0) { c.x += (Math.random() - 0.5) * 6; c.st = 2 + Math.random() * 6; }
        const dx = c.x - p.x, dy = c.y - p.y;
        if (dx * dx + dy * dy < 46 * 46) {
          c.state = 1;
          c.vx = (dx >= 0 ? 1 : -1) * (55 + Math.random() * 25);
          c.vy = -(55 + Math.random() * 30);
        } else if (c.t > c.life - 2) {
          // se marcha por su cuenta (se acabó la paciencia)
          c.state = 1;
          c.vx = (Math.random() < 0.5 ? -1 : 1) * 45;
          c.vy = -60;
        }
      } else {
        // huyendo: remonta y se va de la cámara
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.vy -= 14 * dt; // gana altura
      }
      break;
    }
    case MARIPOSA:
    case LUCIERNAGA: {
      // deriva senoidal alrededor del ancla
      c.vx = Math.sin(c.t * 0.9 + c.seed) * 13;
      c.vy = Math.cos(c.t * 1.3 + c.seed) * 8;
      c.x += c.vx * dt; c.y += c.vy * dt;
      // imán suave al ancla (no se aleja del parche)
      if (Math.abs(c.x - c.ax) > 42) c.x += (c.ax - c.x) * dt * 0.8;
      if (Math.abs(c.y - c.ay) > 30) c.y += (c.ay - c.y) * dt * 0.8;
      break;
    }
    case PEZ: {
      if (c.state === 0) {
        // oculto bajo la superficie, espera su salto
        c.st -= dt;
        c.y = c.ay;
        if (c.st <= 0) {
          c.state = 1;
          c.vy = -(62 + Math.random() * 26);
          c.vx = (Math.random() - 0.5) * 22;
          // salpicadura en la superficie
          g.burst(c.x, c.ay, '#a8d8f0', 8, 46);
          const dx = c.x - p.x, dy = c.y - p.y;
          if (dx * dx + dy * dy < 150 * 150 && Math.random() < 0.8) audio.sfx('splash');
        }
      } else {
        // arco de salto con gravedad propia
        c.vy += 250 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.vy > 0 && c.y >= c.ay) {
          c.y = c.ay; c.state = 0; c.st = 4 + Math.random() * 7;
          g.burst(c.x, c.ay, '#a8d8f0', 5, 34);
        }
      }
      break;
    }
  }
  // despawn: fuera de cámara con margen, vida agotada o huida prolongada
  if (c.t > c.life + 4 || !inView(c.x, c.y, b, 44)) despawn(c);
}

function tickFauna(g: Game, dt: number, st: WLState): void {
  const b = viewBounds(g);
  for (let i = 0; i < POOL_CAP; i++) {
    const c = POOL[i];
    if (c.active) tickCritter(g, c, dt, b);
  }
  if (SPAWN_OK.has(g.mapId)) {
    st.spawnAcc += dt;
    if (st.spawnAcc >= spawnInterval(g)) {
      st.spawnAcc = 0;
      trySpawn(g);
    }
  }
  // R7-V4 + 17 (qa): repositor DETERMINISTA del pez de costa. El legacy
  // trySpawn ya no cría peces y el repositor prometido por el comentario
  // nunca llegó (la Costa se quedaba sin vida marina). PRNG sembrado con el
  // reloj del mundo: misma (mapa, reloj, calidad) ⇒ mismo pez, sin allocs.
  if (g.mapId === 'costa' && kindCount[PEZ] < kindCap(PEZ)) {
    st.fishAcc += dt;
    if (st.fishAcc >= 2.2) {
      st.fishAcc = 0;
      st.fishTries++;
      const sd = Math.floor(st.clock) * 31 + st.fishTries * 7919;
      const rng = mulberry32(sd);
      const m = 20; // margen como el legacy trySpawn
      for (let i = 0; i < 10; i++) {
        const wx = b[0] - m + rng() * (b[2] - b[0] + m * 2);
        const wy = b[1] - m + rng() * (b[3] - b[1] + m * 2);
        const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
        if (tx < 0 || ty < 0 || tx >= g.map.w || ty >= g.map.h) continue;
        const ch = tileAt(g.map, g.rows, tx, ty, g.epoch);
        if (ch !== '~' && ch !== 'w') continue; // solo mar/estanque
        if (spawnDet(PEZ, tx * TILE + TILE / 2, ty * TILE + TILE / 2, 18 + rng() * 14, sd)) break;
      }
    }
  }
}

// ---------------- Viajero errante (evento decorativo) ----------------

function tickTraveler(g: Game, dt: number, st: WLState): void {
  const tv = st.trav;
  if (!tv.active) return;
  tv.t += dt;
  tv.x += tv.dir * 46 * dt;
  const b = viewBounds(g);
  if (!inView(tv.x, tv.y, b, 60) || tv.t > 40) tv.active = false;
}

// ---------------- Rumores dinámicos ----------------

type RumorRule = { c?: (g: Game) => boolean; s: string };

const isPast = (g: Game) => g.epoch === 'pasado';
const isPresent = (g: Game) => g.epoch === 'presente';
const toneIs = (g: Game, t: ToneKind) => {
  const p = g.player;
  return !!p && dominantTone(p) === t;
};

/** Frases por NPC (progreso REAL: questIdx, jefes, época, tono dominante). */
const RUMORS: Record<string, RumorRule[]> = {
  brisa: [
    { c: g => g.questIdx <= 1, s: 'Brisa: «Los lobos rondan al caer el sol. Ve con cuidado, criatura.»' },
    { c: g => g.questIdx >= 2 && g.questIdx <= 4, s: 'Brisa: «El Bosque susurra nombres que ya no son de nadie.»' },
    { c: g => !!g.flags.guardianDefeated && g.questIdx <= 5, s: 'Brisa: «El Guardián calla por fin. Me tiemblan las manos de alivio.»' },
    { c: g => g.questIdx >= 5 && g.questIdx <= 6, s: 'Brisa: «El mar guarda lo que el valle perdió. Búscalo al sur.»' },
    { c: g => g.questIdx >= 7 && g.questIdx <= 8 && !g.flags.acto2Done, s: 'Brisa: «Merrow... había una nana de allí. Ya no la recuerdo entera.»' },
    { c: g => !!g.flags.acto2Done, s: 'Brisa: «Vuelves con las manos llenas de ecos. El valle respira mejor.»' },
    { c: isPast, s: 'Brisa: «¡El Festival del Canto! Huele a pan y a primavera otra vez...»' },
    { s: 'Brisa: «El silencio pesa menos desde que llegaste, Portador.»' },
  ],
  toln: [
    { c: g => (g.player?.weaponPlus ?? 0) >= 5, s: 'Toln: «+5 es lo que da de sí esta forja, Portador.»' },
    { c: g => !!g.flags.guardianDefeated, s: 'Toln: «Con el Eco de la Voz, forjaré lo que el valle pida.»' },
    { c: isPresent, s: 'Toln: «El metal recuerda el ritmo del martillo. Por eso sigo golpeando.»' },
    { c: isPast, s: 'Toln: «¡Encargos del festival! Cola en la forja. Qué luz tan buena.»' },
    { s: 'Toln: «Una espada sin canto corta. Con canto, convence.»' },
  ],
  teo: [
    { c: g => toneIs(g, 'sarcastico'), s: 'Teo: «Hablas raro, Portador. Me gustas.»' },
    { c: g => !!g.flags.guardianDefeated, s: 'Teo: «¿De verdad bajaste a la Cripta? ¡Cuenta! ¡Cuenta!»' },
    { c: isPast, s: 'Teo: «En el festival dan pastel con forma de luna. Antes daban tres.»' },
    { s: 'Teo: «Yo soñé la Niebla antes de verla. ¿Eso es valiente o es raro?»' },
    { s: 'Teo: «Cuando sea mayor quiero ser Portador. O panadero. O las dos cosas.»' },
  ],
  heraldo: [
    { c: g => toneIs(g, 'amenazante'), s: 'Heraldo: «La Orden apunta tu forma de hablar. Habla con cuidado.»' },
    { c: g => !!g.flags.guardianDefeated, s: 'Heraldo: «El Eco de la Voz nos pertenece. La Orden cobra sus deudas.»' },
    { s: 'Heraldo: «Vesh oye todo lo que se firma con voz. Todo.»' },
    { s: 'Heraldo: «Las rutas del sur también son de la Orden. En los mapas, al menos.»' },
  ],
  ilwen: [
    { c: g => toneIs(g, 'empatico'), s: 'Ilwen: «Hay calma contigo. El Bosque también la nota.»' },
    { c: g => !!g.flags.sirenaDefeated, s: 'Ilwen: «El canto de esa sirena ya no duele. Buen ojo, Portador.»' },
    { c: isPast, s: 'Ilwen: «Las flores del pasado no crecen en círculo por casualidad.»' },
    { s: 'Ilwen: «Nimue... no, nada. Sigue el camino y cubre mi espalda.»' },
    { s: 'Ilwen: «Cuida tus flechas y tus promesas: se gastan igual.»' },
  ],
  doran: [
    { c: g => toneIs(g, 'empatico'), s: 'Doran: «El Círculo te escucha. El Bosque camina contigo.»' },
    { c: isPast, s: 'Doran: «Huelo el festival de Merrow desde aquí. El mundo era más tierno.»' },
    { s: 'Doran: «La Madre Espina tiene roto el corazón, no la voluntad.»' },
    { s: 'Doran: «Las raíces gritan bajito. Solo hay que saber escuchar de rodillas.»' },
  ],
  mara: [
    { c: g => !!g.flags.maraGift, s: 'Mara: «El faro arde. Trescientos años... y vuelve a arder.»' },
    { c: g => !!g.flags.sirenaDefeated, s: 'Mara: «La marea volvió a leer nombres en vez de borrarlos.»' },
    { c: g => isNight(g), s: 'Mara: «De noche, la lámpara aprende a temblar. Quédate cerca.»' },
    { s: 'Mara: «El mar susurra con voz prestada. No le respondas con tu nombre.»' },
  ],
  vult: [
    { c: g => toneIs(g, 'pragmatico'), s: 'Vult: «Sin mapa no hay negocio. Contigo, quizá.»' },
    { c: g => !!g.flags.golemDefeated, s: 'Vult: «Las Cumbres abiertas: la Liga lo celebrará con oro.»' },
    { c: isPresent, s: 'Vult: «Cartografío el silencio. Es el bioma más extenso de Aelthar.»' },
    { s: 'Vult: «La Liga paga por rutas, no por poemas. Pero qué poemas, eh.»' },
  ],
  mera: [
    { c: g => !!g.flags.ecoNombres, s: 'Mera: «Mi nombre vuelve a mí... pieza a pieza. Gracias.»' },
    { c: g => isNight(g), s: 'Mera: «Los faroles esperan nombres, no fuego. Díselo al ayer.»' },
    { c: isPast, s: 'Mera: «Aquí había música. Ponla otra vez en las paredes.»' },
    { s: 'Mera: «Merrow no es mi nombre. Es el que quedó cuando se lo robaron.»' },
  ],
  ivo: [
    { c: g => toneIs(g, 'amenazante'), s: 'Ivo: «Gritas a la montaña y la montaña te oye. Bien.»' },
    { c: g => !!g.flags.golemDefeated, s: 'Ivo: «El paso está libre. Los pastores te deben el alba.»' },
    { c: isPast, s: 'Ivo: «Los pastores cantaban por turnos: uno velaba la voz del otro.»' },
    { s: 'Ivo: «El Gólem cuenta los coros bajo el hielo. No dejes que cuente el tuyo.»' },
  ],
};

/** 2+ frases genéricas por contexto (época), para NPCs sin línea propia. */
const GENERIC_NOW: string[] = [
  'Aldeano: «¿Oíste eso? Dicen que los ecos te siguen, Portador.»',
  'Viajero: «El silencio aburre. El mundo espera lo que tú traes.»',
  'Voces: «...oye... el canto vuelve... lo dicen las piedras...»',
];
const GENERIC_PAST: string[] = [
  'Festejante: «¡El Festival! Canta algo, ¡que el dios te teje en el canto!»',
  'Festejante: «Hoy hasta las piedras parecen querer bailar.»',
  'Festejante: «Dicen que un Portador limpiará la Niebla. ¡Salud, si es tú!»',
];

/** Candidatas vigentes para un NPC (exportado solo para smokes/dev). */
function rumorPool(g: Game, nid: string): string[] {
  const rules = RUMORS[nid];
  if (!rules) return isPast(g) ? GENERIC_PAST : GENERIC_NOW;
  const out: string[] = [];
  for (const r of rules) if (!r.c || r.c(g)) out.push(r.s);
  return out.length ? out : (isPast(g) ? GENERIC_PAST : GENERIC_NOW);
}

function fireRumor(g: Game, st: WLState, npc: Npc): void {
  const pool = rumorPool(g, npc.nid);
  const text = pool[st.rot++ % pool.length];
  const color = g.epoch === 'pasado' ? '#ffe0a0' : '#cfe0f8';
  // burbuja breve: floatText longevo (drawFloats ya lo pinta con contorno)
  g.floats.push({ x: npc.x, y: npc.y - 24, text, t: 2.8, color, vy: -6, size: 7 });
  st.rumorNext.set(npc.nid, st.clock + 8 + Math.random() * 6); // 8-14 s
  st.rumorsShown++;
  st.lastRumor = text;
}

function tickRumors(g: Game, st: WLState): void {
  if (g.state !== 'play' || g.challengeRun || combatActive(g)) return; // ni en combate
  const p = g.player!;
  const r = TILE * 2.5; // 2.5 tiles
  let best: Npc | null = null;
  let bestD = r * r;
  for (let i = 0; i < g.npcs.length; i++) {
    const n = g.npcs[i];
    const dx = n.x - p.x, dy = n.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = n; }
  }
  if (!best) return;
  // cooldown por NPC: la primera vez, gracia corta para que se vea el sistema
  if (!st.rumorNext.has(best.nid)) {
    st.rumorNext.set(best.nid, st.clock + 2.5 + Math.random() * 3);
    return;
  }
  if (st.clock >= (st.rumorNext.get(best.nid) ?? Infinity)) fireRumor(g, st, best);
}

// ---------------- Eventos callejeros ----------------

const GUST_LINE: Record<string, string> = {
  lunaris: 'Una ráfaga barre las hojas del valle...',
  bosque: 'El Bosque se mece: una ráfaga larga remueve las copas.',
  costa: 'La bruma se rasga: sal en el viento.',
  aldea: 'El polvo del festival gira en una ráfaga.',
  cumbres: 'La ventisca silba entre los pinos.',
  cripta: 'Un polvo antiguo cae del techo de la Cripta.',
};

const GUST_COLORS: Record<string, string[]> = {
  lunaris: ['#5a8a44', '#7aa04a', '#a07840'],
  bosque: ['#3e6a34', '#5a8a44', '#8a6a38'],
  costa: ['#c8d8c8', '#a8c0b0', '#d8d0b0'],
  aldea: ['#a89060', '#c0a870', '#907850'],
  cumbres: ['#e8f0f8', '#d0e0f0', '#f0f8ff'],
  cripta: ['#7a7a8a', '#5a5a6a', '#8a8a9a'],
};

/** Evento puntual. kind opcional para tests/dev. */
function fireEvent(g: Game, st: WLState, kind?: 'eco' | 'rafaga' | 'viajero'): void {
  const roll = kind ?? (() => {
    const r = Math.random();
    if (r < 0.4) return 'eco' as const;
    if (r < 0.7 && !st.trav.active && g.mapId !== 'cripta') return 'viajero' as const;
    return 'rafaga' as const;
  })();
  const p = g.player!;
  st.evtCount++;
  if (roll === 'eco') {
    // «oyes un eco lejano»: susurro existente + partícula direccional
    audio.sfx(g.mapId === 'cripta' ? 'wraith' : 'echo');
    g.floats.push({ x: p.x, y: p.y - 30, text: '...un eco lejano resuena...', t: 2.6, color: '#c8b0e8', vy: -8, size: 8 });
    const a = Math.random() * Math.PI * 2;
    const cx = Math.cos(a), sy = Math.sin(a);
    for (let i = 0; i < 8; i++) {
      const off = (i - 3.5) * 6;
      g.particles.push({
        x: p.x + cx * 80 - sy * off, y: p.y + sy * 80 + cx * off - 8,
        vx: -cx * 52 + (Math.random() - 0.5) * 10, vy: -sy * 52 + (Math.random() - 0.5) * 10,
        t: 1.4 + Math.random() * 0.4, maxT: 1.8, color: '#b8a8e8', size: 1.4, grav: 0,
      });
    }
    return;
  }
  if (roll === 'viajero') {
    // viajante errante: entidad decorativa propia que cruza la pantalla
    // (R10-4: ahora lleva lore determinista y responde a E vía worldInteract)
    spawnTraveler(g, st, Math.floor(st.clock) * 31 + 5);
    return;
  }
  // ráfaga de viento con hojas/polvo/nieve por bioma
  audio.sfx(g.mapId === 'cripta' ? 'wraith' : 'gust');
  g.floats.push({ x: p.x, y: p.y - 30, text: GUST_LINE[g.mapId] ?? 'Una ráfaga de viento cruza el mundo.', t: 2.6, color: '#9ac0a8', vy: -8, size: 8 });
  const dir = Math.random() < 0.5 ? 1 : -1;
  const b = viewBounds(g);
  const cols = GUST_COLORS[g.mapId] ?? GUST_COLORS.lunaris;
  const n = 12;
  for (let i = 0; i < n; i++) {
    g.particles.push({
      x: dir > 0 ? b[0] - 10 + Math.random() * 20 : b[2] + 10 - Math.random() * 20,
      y: b[1] + Math.random() * (b[3] - b[1]) * 0.7,
      vx: dir * (95 + Math.random() * 65), vy: -12 + Math.random() * 26,
      t: 1.6 + Math.random() * 0.8, maxT: 2.4,
      color: cols[i % cols.length], size: 1.5 + Math.random(), grav: g.mapId === 'cumbres' ? 12 : 26,
    });
  }
}

function tickEvents(g: Game, dt: number, st: WLState): void {
  st.evtIn -= dt;
  if (st.evtIn > 0) return;
  // posponer: diálogo abierto, modo desafío o combate con aggro
  if (g.state !== 'play' || g.challengeRun || combatActive(g)) {
    st.evtIn = 5;
    return;
  }
  fireEvent(g, st, st.forced ?? undefined);
  st.forced = null;
  st.evtIn = 45 + Math.random() * 45; // cada 45-90 s
}

// ---------------- R10-4 · Eventos aleatorios del Eco ----------------
//
// Selección DETERMINISTA por hash del reloj del mundo (sin Math.random):
// cada 70-120 s puede ocurrir UNO. Máx 1 activo (el hallazgo es el único que
// persiste; la manada se autobloquea por combatActive, el fenómeno es
// instantáneo y el viajero es exclusivo de st.trav). Nada de esto cuenta en
// stats/flags del jugador salvo el hallazgo (APIs del motor, patrón cofres).

type R10Kind = 'manada' | 'fenomeno' | 'hallazgo' | 'viajero';

const R10_MIN_GAP = 70;      // s de juego entre eventos grandes
const R10_MAX_GAP = 120;
const R10_RETRY = 5;         // posponer si las condiciones no dan (jefe/combate/…)

const PACK_GUARD = 0.45;     // gracia de spawn (update.ts congela la IA mientras >0)
const PACK_MIN_DIST = 150;   // px mínimos del Portador al punto de aparición
const PACK_MAX_ALIVE = 34;   // margen bajo el tope duro del motor (MAX_MAP_ENEMIES = 40)
const PACK_CHASE = 25;       // s totales de búsqueda (luego el leash del motor los suelta)
// NOTA: el leash de update.ts corta el aggro a >2.4×aggroR (lobo: 228 px — MENOS
// que el borde de pantalla). tickPack re-arma aggro y fija home=Portador cada
// frame mientras dure la ventana: fuera de leash la PATRULLA camina hacia la
// presa (22 px/s) y al entrar en rango el persigue nativo corre a velocidad
// plena (comportamiento 100 % del motor, sin tocarlo).

/** Enemigo del bioma (mismo reparto que los spawns de maps/maps_expansion). */
const PACK_DEFS: Record<string, {
  etype: Enemy['etype']; min: number; max: number; toast: string; color: string; sfx: string;
}> = {
  lunaris: { etype: 'lobo', min: 3, max: 5, toast: 'Aullidos en el valle... vienen hacia ti.', color: '#e8a0a0', sfx: 'whoosh' },
  bosque: { etype: 'lobo', min: 3, max: 5, toast: 'El Bosque cruje: la manada caza. Vienen hacia ti.', color: '#e8a0a0', sfx: 'whoosh' },
  costa: { etype: 'espectro', min: 3, max: 4, toast: 'La bruma canta con voces prestadas: espectros buscándote.', color: '#a8d8f0', sfx: 'wraith' },
  aldea: { etype: 'espectro', min: 3, max: 4, toast: 'Los patios susurran: espectros entre las casas. Vienen hacia ti.', color: '#a8d8f0', sfx: 'wraith' },
  cumbres: { etype: 'arpi', min: 3, max: 4, toast: 'Sombra sobre las cumbres: arpías en vuelo de caza.', color: '#d8c8f0', sfx: 'wraith' },
};

/** Lore corto del viajero (puro ambiente: sin flags de historia). */
const VIAJERO_LORE: string[] = [
  'Viajante: «Este camino era de fiesta, antes de la Niebla. Camina despacio.»',
  'Viajante: «Los lobos no atacan a quien canta. Pero la Niebla no escucha.»',
  'Viajante: «He visto luces en la Cripta. No eran velas.»',
  'Viajante: «El mar devuelve lo que ama. Cuidado con lo que no.»',
  'Viajante: «Las Cumbres cuentan pasos. No dejes que cuenten el tuyo dos veces.»',
  'Viajante: «Los faroles de Merrow guardan nombres. El tuyo aún pesa poco.»',
  'Viajante: «Si oyes un coro sin boca, no respondas: escucha.»',
  'Viajante: «La Orden firma rutas en mapas. El Eco firma las mías.»',
];

const PHEN_COLORS: string[] = ['#c8b0e8', '#8ef0ff', '#ffe9a0', '#b8f0d8'];

/**
 * Viajero errante (compartido 13-b/R10-4): cruza la pantalla por el terreno del
 * Portador con una línea de lore determinista (hash del tick de spawn).
 */
function spawnTraveler(g: Game, st: WLState, sd: number): void {
  const dir = hash2(sd, 7717) < 0.5 ? 1 : -1;
  const b = viewBounds(g);
  st.trav.active = true;
  st.trav.dir = dir;
  st.trav.x = dir > 0 ? b[0] - 24 : b[2] + 24;
  st.trav.y = g.player!.y - 4; // camina por el terreno del Portador (siempre pisable)
  st.trav.t = 0;
  st.trav.spoke = false;
  st.trav.lore = VIAJERO_LORE[Math.floor(hash2(sd + 9, 991) * VIAJERO_LORE.length) % VIAJERO_LORE.length];
  g.toast('Un viajante errante cruza el camino, sin levantar la vista...', '#c8b0e8');
}

/** R10-4 viajero con lore: false si ya hay uno (→ fallback fenómeno). */
function fireTravelerLore(g: Game, st: WLState, sd: number): boolean {
  if (st.trav.active) return false;
  spawnTraveler(g, st, sd);
  return true;
}

/**
 * R10-4 · MANADA (incursión): 3-5 enemigos del bioma actual aparecen FORMADOS
 * (línea en cuña perpendicular a la dirección al Portador) en el borde de
 * pantalla y lo BUSCAN: aggro=true al spawn (el mismo flag que marca el motor
 * en update.ts — aggro compartido). Push replicado del patrón del motor
 * (g.makeEnemy + g.enemies.push, idéntico a spawnEventRing/summonNeumo) SIN
 * tocar engine. Devuelve true si la incursión salió.
 */
function firePack(g: Game, st: WLState, sd: number): boolean {
  const def = PACK_DEFS[g.mapId];
  if (!def || g.epoch !== 'presente') return false; // el pasado es un festival: sin incursiones
  const p = g.player!;
  let alive = 0;
  for (let i = 0; i < g.enemies.length; i++) if (!g.enemies[i].dead) alive++;
  if (alive >= PACK_MAX_ALIVE) return false; // margen bajo el tope duro del motor
  const rng = mulberry32(sd);
  const n = def.min + Math.floor(rng() * (def.max - def.min + 1)); // 3-5
  const b = viewBounds(g);
  const need = Math.max(2, n - 1);
  const spots: { x: number; y: number }[] = []; // allocation OK: evento raro y local
  for (let att = 0; att < 20 && spots.length < need; att++) {
    const side = Math.floor(rng() * 4);
    const bx = side === 1 ? b[2] - 8 : side === 3 ? b[0] + 8 : b[0] + rng() * (b[2] - b[0]);
    const by = side === 0 ? b[1] + 8 : side === 2 ? b[3] - 8 : b[1] + rng() * (b[3] - b[1]);
    const ang = Math.atan2(p.y - by, p.x - bx);
    const fx = Math.cos(ang), fy = Math.sin(ang);
    spots.length = 0;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 26;              // línea perpendicular a la carga
      const ahead = i * 12 + (rng() - 0.5) * 8;        // cuña: punta hacia el Portador
      const x = bx - fy * off + fx * ahead;
      const y = by + fx * off + fy * ahead;
      if (x < 8 || y < 8 || x > g.map.w * TILE - 8 || y > g.map.h * TILE - 8) continue;
      if (g.tileSolidAt(x, y)) continue;
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy < PACK_MIN_DIST * PACK_MIN_DIST) continue; // nunca encima
      let spaced = true;
      for (let k = 0; k < g.enemies.length; k++) {
        const e2 = g.enemies[k];
        if (!e2.dead && Math.abs(e2.x - x) < 22 && Math.abs(e2.y - y) < 22) { spaced = false; break; }
      }
      if (!spaced) continue;
      spots.push({ x, y });
    }
  }
  if (spots.length < need) return false; // sin hueco formado: fallback en fireR10
  const pk = st.pack;
  pk.t = PACK_CHASE; // ventana total de búsqueda (luego el leash del motor manda)
  for (let i = 0; i < pk.refs.length; i++) pk.refs[i] = null;
  for (let i = 0; i < spots.length; i++) {
    const s = g.makeEnemy(def.etype, spots[i].x, spots[i].y, 1, 'evento');
    s.aggro = true;             // buscan al Portador desde que aparecen (aggro compartido)
    s.spawnGuard = PACK_GUARD;  // IA congelada 0.45 s: se lee el estallido de llegada
    g.enemies.push(s);
    if (i < pk.refs.length) pk.refs[i] = s;
    g.burst(s.x, s.y, def.color, 7, 55);
  }
  g.toast(def.toast, def.color);
  audio.sfx(def.sfx);
  return true;
}

/**
 * Mantiene la búsqueda de la manada: el leash de update.ts (persigue →
 * patrulla a >2.4×aggroR — 228 px en el lobo, MENOS que el borde de pantalla)
 * des-aggroa a los recién llegados; mientras dure PACK_CHASE re-armamos el
 * flag aggro + el hogar EN EL PORTADOR cada frame (el MISMO flag que marca el
 * motor): fuera del leash la patrulla camina hacia su "casa" (la presa, 22
 * px/s) y al entrar en rango el persigue nativo corre a velocidad plena. Al
 * agotarse la ventana, el leash vuelve a mandar: escapar ES posible (y el
 * propio motor re-aggroa por proximidad nativa).
 */
function tickPack(g: Game, dt: number, st: WLState): void {
  const pk = st.pack;
  if (pk.t <= 0) return;
  pk.t -= dt;
  if (g.state !== 'play') return;
  const es = g.enemies;
  const p = g.player!;
  for (let i = 0; i < pk.refs.length; i++) {
    const e = pk.refs[i];
    if (!e) continue;
    if (e.dead) { pk.refs[i] = null; continue; }
    let enMapa = false;
    for (let k = 0; k < es.length; k++) if (es[k] === e) { enMapa = true; break; }
    if (!enMapa) { pk.refs[i] = null; continue; } // cambió de mapa: ref huérfana
    if (!e.aggro) e.aggro = true;   // re-arma el corte del leash (el motor alterna patrulla/persigue)
    e.homeX = p.x; e.homeY = p.y;   // el hogar ES la presa: fuera de leash, la patrulla
                                    // (22 px/s hacia casa) las acerca hasta el rango de caza
  }
}

/**
 * R10-4 · HALLAZGO: un destello del Eco titila en suelo transitable cercano;
 * al tocarlo da XP pequeña + 1-2 coronas (mismas APIs del motor que los cofres:
 * gainXp + player.gold). Devuelve true si apareció.
 */
function fireFinding(g: Game, st: WLState, sd: number): boolean {
  if (st.find.active) return false; // máx 1 activo
  const p = g.player!;
  const rng = mulberry32(sd * 3 + 17);
  for (let i = 0; i < 24; i++) {
    const a = rng() * TAU;
    const d = 140 + rng() * 150; // 140-290 px: visible o asomando en el borde
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 1 || ty < 1 || tx >= g.map.w - 1 || ty >= g.map.h - 1) continue;
    const ch = tileAt(g.map, g.rows, tx, ty, g.epoch);
    if (SOLID_CHARS.has(ch) || ch === '~' || ch === 'w') continue; // suelo transitable
    st.find.active = true;
    st.find.map = g.mapId;
    st.find.x = tx * TILE + TILE / 2;
    st.find.y = ty * TILE + TILE / 2;
    st.find.t = 0; st.find.tw = 0;
    g.toast('Un destello del Eco titila cerca...', '#ffe9a0');
    return true;
  }
  return false;
}

function tickFinding(g: Game, dt: number, st: WLState): void {
  const f = st.find;
  if (!f.active) return;
  if (f.map !== g.mapId) { f.active = false; return; } // cambiaste de mapa: se desvanece
  f.t += dt; f.tw -= dt;
  const p = g.player!;
  const dx = f.x - p.x, dy = f.y - p.y;
  if (dx * dx + dy * dy < 16 * 16) {
    // recompensa determinista por posición (hash): XP 6-10, coronas 1-2
    const h1 = hash2((f.x | 0) + 3, 5171);
    const xp = 6 + Math.floor(h1 * 5);
    const gold = hash2((f.x | 0) + 9, 5177) < 0.5 ? 1 : 2;
    g.gainXp(xp);
    g.player!.gold += gold;
    g.burst(f.x, f.y, '#ffe9a0', 12, 60);
    g.floatAt(f.x, f.y - 14, `+${xp} XP`, '#ffe9a0', 7);
    g.toast(`Hallazgo del Eco: +${xp} XP, +${gold} coronas`, '#f0c84a');
    f.active = false;
    return;
  }
  if (f.tw <= 0 && perfQuality() < 2) { // titileo (apagado por calidad)
    f.tw = 0.5;
    g.particles.push({
      x: f.x + (Math.random() - 0.5) * 10, y: f.y - 4 - Math.random() * 8,
      vx: 0, vy: -14, t: 0.5, maxT: 0.5, color: '#ffe9a0', size: 1.4, grav: 0,
    });
  }
  if (f.t > 45) f.active = false; // nadie lo recogió: vuelve al silencio
}

/**
 * R10-4 · FENÓMENO DEL ECO: el mundo contiene el aliento 2 s (slowmo suave vía
 * requestSlowmo de fxcore — el motor decae dt×0.35 mientras dure) y partículas
 * musicales ascienden alrededor del Portador.
 * ENGANCHE R10-4 (AUDIO — deliberadamente NO llamado desde aquí): audio.ts
 * puede añadir p.ej. playChoirDistant() y el orquestador cablearlo en este
 * punto exacto (marcado abajo). audio.sfx('coro') sería no-op seguro hoy.
 */
function firePhenomenon(g: Game, sd: number): void {
  const p = g.player!;
  requestSlowmo(g, 2);
  // ↑ aquí iría el enganche de audio del coro lejano (documentado, no llamado)
  g.floats.push({ x: p.x, y: p.y - 34, text: '...un coro lejano canta entre mundos...', t: 2.6, color: '#c8b0e8', vy: -7, size: 8 });
  const n = Math.max(4, Math.round(12 * qMul())); // partículas escaladas por calidad
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + sd * 0.017;
    const r = 36 + (i % 3) * 24;
    g.particles.push({
      x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.6 - 8,
      vx: Math.cos(a) * 9, vy: -24 - (i % 4) * 7,
      t: 1.3 + (i % 3) * 0.3, maxT: 1.9,
      color: PHEN_COLORS[i % PHEN_COLORS.length], size: 1.6, grav: 5,
    });
  }
  g.floats.push({ x: p.x - 18, y: p.y - 20, text: '♪', t: 1.6, color: '#c8b0e8', vy: -16, size: 9 });
  g.floats.push({ x: p.x + 14, y: p.y - 30, text: '♪', t: 1.9, color: '#8ef0ff', vy: -12, size: 7 });
  g.floats.push({ x: p.x + 2, y: p.y - 42, text: '♪', t: 1.5, color: '#ffe9a0', vy: -20, size: 8 });
}

/** REGLA DE ORO: condiciones para que ocurra CUALQUIER evento R10. */
function r10Allowed(g: Game): boolean {
  if (perfQuality() >= 2) return false;           // apagable por calidad
  if (g.state !== 'play' || g.challengeRun) return false; // ni diálogo ni desafío
  if (g.bossActive || bossIntroActive()) return false;    // nunca con jefe/intro de jefe
  if (combatActive(g)) return false;              // ni con combate vivo
  if (!SPAWN_OK.has(g.mapId)) return false;       // solo biomas con fauna (cripta/arena fuera)
  return true;
}

/** Dispara el evento que toca (hash de tiempo) con escalera de fallbacks. */
function fireR10(g: Game, st: WLState, sd: number): void {
  st.r10Count++;
  let want: R10Kind;
  if (st.r10Forced) { want = st.r10Forced; st.r10Forced = null; }
  else {
    const r = hash2(sd, 4421); // determinista: mismo reloj ⇒ mismo evento
    want = r < 0.34 ? 'manada' : r < 0.58 ? 'fenomeno' : r < 0.84 ? 'hallazgo' : 'viajero';
  }
  if (want === 'manada' && firePack(g, st, sd)) return;
  if (want === 'hallazgo' && fireFinding(g, st, sd)) return;
  if (want === 'viajero' && fireTravelerLore(g, st, sd)) return;
  firePhenomenon(g, sd); // fenómeno pedido directamente o fallback: siempre disponible
}

function tickR10(g: Game, dt: number, st: WLState): void {
  tickPack(g, dt, st);
  tickFinding(g, dt, st);
  if (st.clock < st.r10Next) return;
  if (!r10Allowed(g)) { st.r10Next = st.clock + R10_RETRY; return; }
  const sd = Math.floor(st.clock) * 131 + 7;
  fireR10(g, st, sd);
  st.r10Next = st.clock + R10_MIN_GAP + hash2(sd + 55, 6421) * (R10_MAX_GAP - R10_MIN_GAP);
}

// ---------------- Tick principal ----------------

/** Tick de vida del mundo (fauna, eventos, rumores). O(1) fuera de juego. */
export function worldTick(g: Game, dt: number): void {
  if (!g.player) return;
  if (g.state !== 'play' && g.state !== 'dialogue') return;
  const st = stateFor(g);
  st.clock += dt;
  tickFauna(g, dt, st);
  tickTraveler(g, dt, st);
  tickRumors(g, st);
  tickEvents(g, dt, st);
  tickR10(g, dt, st); // R10-4: manadas, hallazgos, fenómenos y viajeros con lore
  tickR11(g, dt, st); // R11-4c: rutinas caminar/trabajar/duerme de NPCs
}

// ---------------- Micro-interacciones (worldInteract) ----------------

const WATER_LINES: Record<string, { now: string; past: string }> = {
  lunaris: {
    now: 'El estanque está quieto. Ni un reflejo contesta.',
    past: 'Los aldeanos susurran sus nombres al agua: el estanque brilla.',
  },
  bosque: {
    now: 'El río lleva musgo y silencio río abajo.',
    past: 'El río canta bajo el puente entero.',
  },
  costa: {
    now: 'El mar susurra. No le respondas con tu nombre.',
    past: 'La marea lee nombres en voz baja; hoy lee el tuyo.',
  },
  aldea: {
    now: 'La laguna no refleja nada. La Niebla bebió demasiado.',
    past: 'La laguna brilla con las guirnaldas del festival.',
  },
  cumbres: {
    now: 'El lago helado guarda coros boca arriba, debajo.',
    past: 'Bajo el hielo del ayer, los coros aún piden ayuda... en armonía.',
  },
  cripta: {
    now: 'El polvo de la Cripta no conoce el agua.',
    past: 'El polvo de la Cripta no conoce el agua.',
  },
};

function say(g: Game, text: string, color = '#c8d8f0'): void {
  const p = g.player!;
  g.floats.push({ x: p.x, y: p.y - 30, text, t: 2.8, color, vy: -6, size: 7 });
}

/**
 * Interacción ambiental con features que el motor ignora (punto exacto del
 * cableado documentado en la cabecera). Devuelve true si consumió la
 * interacción. NUNCA roba interacciones del motor (NPCs, cofres, faroles
 * sin encender, santuarios…): solo atiende lo que nearestInteract omite.
 */
export function worldInteract(g: Game): boolean {
  const p = g.player;
  if (!p) return false;

  // 1) props que nearestInteract no atiende: naufragio, faro y faroles YA
  //    encendidos (los sin encender los gestiona el motor con lightLamp)
  for (let i = 0; i < g.map.props.length; i++) {
    const pr = g.map.props[i];
    if (pr.needPast && g.epoch !== 'pasado') continue;
    if (pr.needPresent && g.epoch !== 'presente') continue;
    const px = pr.x * TILE + 8, py = pr.y * TILE + 8;
    const dx = px - p.x, dy = py - p.y;
    if (dx * dx + dy * dy > 34 * 34) continue;
    if (pr.kind === 'wreck') {
      say(g, g.epoch === 'pasado'
        ? 'El barco aún flota en el ayer: la tripulación canta al doblar el cabo.'
        : 'El naufragio cruje. Algo canta debajo, salado y vivo.', '#a8d0e0');
      return true;
    }
    if (pr.kind === 'faro') {
      say(g, g.flags.maraGift
        ? 'El faro de Mara arde de nuevo: la costa tiene permiso para volver.'
        : g.epoch === 'pasado'
          ? 'La lámpara gira cantando: una nota por vuelta de engranaje.'
          : 'El faro está a oscuras. Nadie sube ya la lámpara.', '#ffe0a0');
      return true;
    }
    if (pr.kind === 'lamp' && !!g.flags[pr.id]) {
      // farol encendido: chispazo (de noche, más vivo)
      g.burst(px, py - 8, '#ffe9a0', isNight(g) ? 12 : 6, 40);
      say(g, isNight(g)
        ? 'El farol chispea: el nombre que guarda está inquieto.'
        : 'El farol arde con un nombre dentro.', '#ffe9a0');
      if (isNight(g)) audio.sfx('lamp');
      return true;
    }
  }

  // 2) tiles con historia: pozo > lápida > roca > agua (3×3 alrededor)
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  const OFFS: [number, number][] = [
    [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  for (let o = 0; o < OFFS.length; o++) {
    const tx = ptx + OFFS[o][0], ty = pty + OFFS[o][1];
    if (tx < 0 || ty < 0 || tx >= g.map.w || ty >= g.map.h) continue;
    const ch = tileAt(g.map, g.rows, tx, ty, g.epoch);
    if (ch === 'w') {
      say(g, g.epoch === 'pasado'
        ? 'Susurra un nombre al pozo: abajo, algo lo teje en el canto.'
        : 'El pozo de los nombres devuelve solo silencio.', '#a8c8e0');
      return true;
    }
    if (ch === 'g') {
      say(g, 'Una lápida sin nombre. El musgo recuerda lo que los vivos olvidaron.', '#9aa8b8');
      return true;
    }
    if (ch === 'R') {
      say(g, g.epoch === 'pasado'
        ? 'La talla aún vive en el ayer: una nota del Primer Canto.'
        : 'Una piedra antigua. Hubo algo tallado aquí; el tiempo lo borró.', '#9aa8b8');
      return true;
    }
    if (ch === '~') {
      const line = WATER_LINES[g.mapId] ?? {
        now: 'El agua te devuelve el silencio.',
        past: 'El agua del ayer tiene ecos de fiesta.',
      };
      g.burst(tx * TILE + 8, ty * TILE + 8, '#a8d8f0', 10, 50);
      audio.sfx('splash');
      say(g, g.epoch === 'pasado' ? line.past : line.now, '#a8d0e0');
      return true;
    }
  }

  // 3) R10-4: el viajero errante responde si le hablas (E). Va AL FINAL:
  //    nunca roba props/tiles del motor; solo atiende su propia entidad.
  //    Toast en vez del sistema de diálogo: startDialogue escribe estado de
  //    campaña (fuera del alcance solo-lectura de este módulo) — enganche
  //    documentado para el integrador si quiere convertirlo en nodo real.
  const st10 = STATES.get(g);
  if (st10 && st10.trav.active && !st10.trav.spoke) {
    const tdx = st10.trav.x - p.x, tdy = st10.trav.y - p.y;
    if (tdx * tdx + tdy * tdy < 30 * 30) {
      st10.trav.spoke = true;
      g.burst(st10.trav.x, st10.trav.y - 8, '#8a7ab0', 6, 32);
      g.floats.push({ x: st10.trav.x, y: st10.trav.y - 26, text: st10.trav.lore, t: 2.8, color: '#c8b0e8', vy: -6, size: 7 });
      g.toast(st10.trav.lore, '#c8b0e8');
      return true;
    }
  }
  return false;
}

// ---------------- Dibujo (contrato integrador: render.drawWorld) ----------------

// --- caches de primitivas (se crean perezosamente, una sola vez) ---

function mkCanvas(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  draw(x);
  return c;
}

let cacheBird: HTMLCanvasElement[] | null = null;
let cacheFly: HTMLCanvasElement[][] | null = null; // [varianteColor][frame]
let cacheGlow: HTMLCanvasElement | null = null;
let cacheTrav: HTMLCanvasElement | null = null;

function ensureCaches(): void {
  if (cacheBird) return;
  const bird = (wing: number) => mkCanvas(12, 9, c => {
    // cuerpo
    c.fillStyle = '#4a3a5a';
    c.beginPath(); c.ellipse(6, 5, 4, 2.4, 0, 0, Math.PI * 2); c.fill();
    // cabeza + pico + ojo
    c.beginPath(); c.arc(9.4, 3.6, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8a040';
    c.beginPath(); c.moveTo(11.2, 3.4); c.lineTo(12, 4); c.lineTo(11.2, 4.4); c.fill();
    c.fillStyle = '#0c0c14';
    c.fillRect(9.8, 3, 1, 1);
    // cola
    c.fillStyle = '#3a2c48';
    c.fillRect(0, 4, 3, 2);
    // ala alzada / bajada
    c.fillStyle = '#5c4a70';
    c.beginPath();
    if (wing === 0) { c.moveTo(5, 4); c.lineTo(8, 0); c.lineTo(9, 4.4); }
    else { c.moveTo(5, 5); c.lineTo(8, 8.5); c.lineTo(9, 4.6); }
    c.closePath(); c.fill();
  });
  cacheBird = [bird(0), bird(1)];
  const fly = (body: string, wingCol: string) => [0, 1].map(f => mkCanvas(7, 6, c => {
    c.fillStyle = wingCol;
    if (f === 0) {
      c.beginPath(); c.ellipse(2.2, 2.6, 2, 2.4, -0.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(4.8, 2.6, 2, 2.4, 0.5, 0, Math.PI * 2); c.fill();
    } else {
      c.beginPath(); c.ellipse(2.6, 2.6, 1, 2.4, -0.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(4.4, 2.6, 1, 2.4, 0.1, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = body;
    c.fillRect(3.2, 1.2, 0.8, 3.4); // cuerpo
    c.fillRect(3.1, 4.6, 0.4, 1);   // antena/cola
    c.fillRect(3.7, 4.6, 0.4, 1);
  }));
  cacheFly = [fly('#3a3a3a', '#e88ab0'), fly('#3a3a3a', '#f0d060')];
  cacheGlow = mkCanvas(12, 12, c => {
    const rg = c.createRadialGradient(6, 6, 0.5, 6, 6, 6);
    rg.addColorStop(0, 'rgba(214,255,170,0.95)');
    rg.addColorStop(0.45, 'rgba(170,240,130,0.4)');
    rg.addColorStop(1, 'rgba(150,230,120,0)');
    c.fillStyle = rg;
    c.fillRect(0, 0, 12, 12);
  });
  cacheTrav = mkCanvas(16, 20, c => {
    // capa
    c.fillStyle = '#2a3a44';
    c.beginPath();
    c.moveTo(5, 6); c.lineTo(11, 6); c.lineTo(13, 19); c.lineTo(3, 19);
    c.closePath(); c.fill();
    // cabeza + capucha
    c.fillStyle = '#d8b890';
    c.beginPath(); c.arc(8, 4.4, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#22303a';
    c.beginPath(); c.arc(8, 4, 2.7, Math.PI * 0.9, Math.PI * 2.2); c.fill();
    // capucha sombra
    c.fillStyle = '#18242c';
    c.fillRect(6.4, 3.4, 3.2, 1.4);
    // bordado del viajante (hilo del Eco)
    c.fillStyle = '#8a7ab0';
    c.fillRect(7.6, 10, 0.8, 0.8); c.fillRect(7.6, 13, 0.8, 0.8);
    // cayado
    c.fillStyle = '#6a4a2a';
    c.fillRect(13, 1, 1, 18);
    c.fillStyle = '#8a6a3a';
    c.beginPath(); c.arc(13.5, 1.6, 1.4, 0, Math.PI * 2); c.fill();
    // morral
    c.fillStyle = '#5a4426';
    c.fillRect(3, 10, 3, 3);
  });
}

const TAU = Math.PI * 2;

/**
 * Dibuja la fauna + el viajero (primitivas cacheadas). Punto de enganche
 * documentado en la cabecera: render.ts · drawWorld, tras los cofres.
 * Idempotente y sin allocations; no dibuja nada si no hay criaturas vivas.
 */
export function drawWorldLife(g: Game, sx?: (n: number) => number, sy?: (n: number) => number): void {
  if (!g.player) return;
  const st = STATES.get(g);
  if (!st) return;
  const ox = sx ?? ((wx: number) => wx * ZOOM - Math.round(g.camX));
  const oy = sy ?? ((wy: number) => wy * ZOOM - Math.round(g.camY));
  ensureCaches();
  const ctx = g.ctx;
  const camXr = Math.round(g.camX), camYr = Math.round(g.camY);

  // visible en pantalla (coordenadas de mundo → canvas)
  const vis = (wx: number, wy: number, pad: number): boolean => {
    const sxx = wx * ZOOM - camXr, syy = wy * ZOOM - camYr;
    return sxx > -pad && sxx < VIEW_W + pad && syy > -pad && syy < VIEW_H + pad;
  };

  // R10-4: hallazgo — destello del Eco esperando en el suelo (bajo entidades)
  const fd = st.find;
  if (fd.active && vis(fd.x, fd.y, 40)) {
    const pu = 0.5 + 0.5 * Math.sin(fd.t * 5 + 1);
    ctx.globalAlpha = 0.35 + 0.65 * pu;
    ctx.fillStyle = '#ffe9a0';
    const gs = (2.2 + pu * 1.6) * ZOOM;
    ctx.fillRect(ox(fd.x) - gs, oy(fd.y) - 1.5, gs * 2, 3);
    ctx.fillRect(ox(fd.x) - 1.5, oy(fd.y) - gs, 3, gs * 2);
    ctx.fillStyle = '#fff8e0';
    ctx.fillRect(ox(fd.x) - 1.5, oy(fd.y) - 1.5, 3, 3);
    ctx.globalAlpha = 1;
  }

  // viajero errante (detrás de la fauna)
  const tv = st.trav;
  if (tv.active && cacheTrav && vis(tv.x, tv.y, 48)) {
    const bob = Math.floor(tv.t * 6) % 2;
    ctx.drawImage(cacheTrav, ox(tv.x - 8), oy(tv.y - 16 - bob), 16 * ZOOM, 20 * ZOOM);
  }

  for (let i = 0; i < POOL_CAP; i++) {
    const c = POOL[i];
    if (!c.active || !vis(c.x, c.y, 40)) continue;
    if (c.kind === AVE && cacheBird) {
      const fr = c.state === 1 ? Math.floor(c.t * 12) % 2 : 0;
      const bob = c.state === 0 ? Math.sin(c.t * 2 + c.seed) * 0.6 : 0;
      const img = cacheBird[fr];
      if (c.vx < 0) {
        ctx.save();
        ctx.translate(ox(c.x + 6), oy(c.y - 4.5 - bob));
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, 12 * ZOOM, 9 * ZOOM);
        ctx.restore();
      } else {
        ctx.drawImage(img, ox(c.x - 6), oy(c.y - 4.5 - bob), 12 * ZOOM, 9 * ZOOM);
      }
    } else if (c.kind === MARIPOSA && cacheFly) {
      const fr = Math.floor(c.t * 9) % 2;
      const img = cacheFly[Math.floor(c.seed) % 2][fr];
      ctx.drawImage(img, ox(c.x - 3.5), oy(c.y - 3), 7 * ZOOM, 6 * ZOOM);
    } else if (c.kind === LUCIERNAGA && cacheGlow) {
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(c.t * 2 + c.seed));
      ctx.globalAlpha = pulse;
      ctx.drawImage(cacheGlow, ox(c.x - 6), oy(c.y - 6), 12 * ZOOM, 12 * ZOOM);
      ctx.fillStyle = '#f2ffc8';
      ctx.fillRect(ox(c.x - 0.75), oy(c.y - 0.75), 1.5 * ZOOM, 1.5 * ZOOM);
      ctx.globalAlpha = 1;
    } else if (c.kind === PEZ) {
      if (c.state === 0) {
        // sombra bajo la superficie
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#204060';
        ctx.beginPath();
        ctx.ellipse(ox(c.x), oy(c.ay + 3), 3 * ZOOM, 1.2 * ZOOM, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        // cuerpo arqueado en el salto
        ctx.fillStyle = '#b8ccd8';
        ctx.beginPath();
        ctx.ellipse(ox(c.x), oy(c.y - 2), 2.6 * ZOOM, 1.6 * ZOOM, c.vy < 0 ? -0.4 : 0.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#e8f0f4';
        ctx.fillRect(ox(c.x - 0.5), oy(c.y - 3), 1 * ZOOM, 1 * ZOOM);
      }
    }
  }

  // R11-4c: NPCs dormidos — zZ pulsante (la pose agachada real es hook de render:
  // enganche documentado en la cabecera R11-4c). Determinista, cero allocs.
  if (MOODS.size > 0) {
    const minDay = g.dayT * 1440;
    const prevFont = ctx.font;
    ctx.font = 'bold 7px monospace';
    for (let zi = 0; zi < g.npcs.length; zi++) {
      const zn = g.npcs[zi];
      if (MOODS.get(zn.nid) !== 2) continue;
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(minDay * 0.35 + zn.x * 0.7);
      ctx.fillStyle = '#c8d8f0';
      ctx.fillText('z', ox(zn.x + 5), oy(zn.y - 11));
      ctx.fillText('Z', ox(zn.x + 9), oy(zn.y - 16));
      ctx.globalAlpha = 1;
    }
    ctx.font = prevFont;
  }
}

// ---------------- Utilidades dev/smoke ----------------

/** Snapshot del estado del módulo para un Game (solo smokes/dev). */
export function worldlifeStats(g: Game): {
  count: number; aves: number; mariposas: number; luciernagas: number; peces: number;
  viajero: boolean; rumorsShown: number; lastRumor: string; eventCount: number;
  r10Count: number; hallazgo: boolean; manada: number; // R10-4
  critters: { x: number; y: number; kind: number }[];
} | null {
  const st = STATES.get(g);
  if (!st) return null;
  let manada = 0;
  for (let i = 0; i < st.pack.refs.length; i++) {
    const e = st.pack.refs[i];
    if (e && !e.dead) manada++;
  }
  const critters: { x: number; y: number; kind: number }[] = [];
  const k = [0, 0, 0, 0];
  for (let i = 0; i < POOL_CAP; i++) {
    const c = POOL[i];
    if (!c.active) continue;
    k[c.kind]++;
    critters.push({ x: c.x, y: c.y, kind: c.kind });
  }
  return {
    count: critters.length, aves: k[AVE], mariposas: k[MARIPOSA],
    luciernagas: k[LUCIERNAGA], peces: k[PEZ], viajero: st.trav.active,
    rumorsShown: st.rumorsShown, lastRumor: st.lastRumor,
    eventCount: st.evtCount, r10Count: st.r10Count, hallazgo: st.find.active,
    manada,
    critters,
  };
}

/** Arma el timer de eventos y (opcional) fija la clase del próximo evento. */
export function __wlArmEvent(g: Game, inSec: number, kind?: 'eco' | 'rafaga' | 'viajero'): void {
  const st = stateFor(g);
  st.evtIn = inSec;
  st.forced = kind ?? null;
}

/** R10-4: arma el próximo evento grande y (opcional) fija su clase (dev/smoke). */
export function __wlArmR10(g: Game, inSec: number, kind?: R10Kind): void {
  const st = stateFor(g);
  st.r10Next = st.clock + Math.max(0, inSec);
  st.r10Forced = kind ?? null;
}

/** Pool vigente de rumores de un NPC (solo smokes/dev). */
export function __wlRumorPool(g: Game, nid: string): string[] {
  return rumorPool(g, nid);
}

/** Reinicia todo el estado del módulo (solo smokes). */
export function __wlResetAll(): void {
  for (let i = 0; i < POOL_CAP; i++) POOL[i].active = false;
  kindCount[0] = 0; kindCount[1] = 0; kindCount[2] = 0; kindCount[3] = 0;
  liveCount = 0;
  MOODS.clear(); // R11-4c: moods de rutina fuera
  // WeakMap no se itera: cada smoke usa su propia instancia de Game
}
// ============================================================
// R11-4c · RUTINAS DE NPCs (EPIC 7.3: caminan / trabajan / duermen)
// ------------------------------------------------------------
// Hora del mundo: minuteOfDay = g.dayT * 1440 (convención de
// world/lighting.ts; g.dayT avanza en update.ts). Ventanas:
//   06:00-12:00 'camino'  — caminan a su puesto (lentos, 26 px/s).
//   12:00-19:00 'trabajo' — micro-oscilación ±1 px + partícula ocasional
//                           determinista (frontera de tramo de reloj).
//   19:00-06:00 'duerme'  — vuelven a su ancla de noche y duermen (zZ
//                           en drawWorldLife; la pose agachada real es un
//                           hook de render — enganche documentado).
// EXPANSIÓN (costa/aldea/cumbres): de noche NO vagan (peligro) —
// guardia en el puesto ('guardia'). En combate: todos 'guardia'.
// Transiciones SIEMPRE caminando: pasos por eje con sondas
// tileSolidAt, pausa anti-atasco y alternancia de eje. Cero
// teletransporte. Determinismo: fase por hash del nid (sin
// Math.random), cero allocations por frame (memoria creada una vez
// en ensureR11). Los NPCs NO se serializan (spawnNpcs los recrea en
// cada loadMap): cero migración de saves.
// ============================================================

/** Def de NPC nuevo R11 (ids EXACTOS: R11-5 escribió sus diálogos). */
export interface NpcR11Def {
  id: string;
  name: string;
  map: MapId;
  x: number; y: number;                    // spawn (tile)
  sprite: string;                          // sprite humanoid existente
  anclaTrabajo: { x: number; y: number };  // tiles
  anclaCasa: { x: number; y: number };     // tiles
  paleta: string;                          // tinte/metadata de rutina
}

/**
 * Los 5 NPCs nuevos (NO renombrar: talkTo(n.nid) nativo y las claves
 * vela_intro/tejado_intro/ceniza_intro/niebla_intro/toldero_intro de
 * dialogues_r11 dependen de estos nids exactos).
 */
export const NPCS_R11: readonly NpcR11Def[] = [
  { id: 'vela', name: 'Vela, la Sabia de la Vela', map: 'costa',
    x: 9, y: 17, sprite: 'maelis',
    anclaTrabajo: { x: 9, y: 17 }, anclaCasa: { x: 7, y: 15 },
    paleta: '#e8d8a8' }, // cerca del faro (mara la farera @ 7,19)
  { id: 'tejado', name: 'Tejado, el Carpintero', map: 'aldea',
    x: 25, y: 19, sprite: 'toln',
    anclaTrabajo: { x: 25, y: 19 }, anclaCasa: { x: 27, y: 17 },
    paleta: '#c8a878' }, // plaza de Merrow (mera @ 22,16)
  { id: 'ceniza', name: 'Ceniza, Monje de Ceniza', map: 'bosque',
    x: 39, y: 27, sprite: 'doran',
    anclaTrabajo: { x: 39, y: 27 }, anclaCasa: { x: 37, y: 28 },
    paleta: '#a8a0b0' }, // santuario de la Ruina Antigua (38,26)
  { id: 'niebla', name: 'Niebla, la Pescadora', map: 'costa',
    x: 24, y: 34, sprite: 'nimue',
    anclaTrabajo: { x: 24, y: 34 }, anclaCasa: { x: 22, y: 32 },
    paleta: '#98b8c8' }, // orilla de arena sobre la línea de marea
  { id: 'toldero', name: 'Toldero, el Mercador', map: 'cumbres',
    x: 55, y: 31, sprite: 'corvin',
    anclaTrabajo: { x: 55, y: 31 }, anclaCasa: { x: 54, y: 29 },
    paleta: '#c8b090' }, // campamento de cumbres (franja x52..61)
];

/** Mapas de expansión: de noche NO vagan (peligro) — guardia en puesto. */
const EXP_NIGHT = new Set<string>(['costa', 'aldea', 'cumbres']);

// Mood vigente por nid (una Game por página; Map.set sobre clave existente
// no alloca). Lo leen __wlNpcMood y el zZ de drawWorldLife. 0 camino ·
// 1 trabajo · 2 duerme · 3 guardia.
const MOODS = new Map<string, number>();

/** Hash determinista por nid (sin Math.random) → 0..1. */
function nidHash(nid: string): number {
  let a = nid.length * 131 + 7;
  for (let i = 0; i < nid.length; i++) a = (a * 31 + nid.charCodeAt(i)) | 0;
  return (a >>> 0) / 4294967296;
}

/** Tile transitable más cercano (sonda determinista, radio ≤2). */
function walkNear(g: Game, tx: number, ty: number): { x: number; y: number } {
  if (!g.tileSolidAt(tx * TILE + 8, ty * TILE + 8)) return { x: tx, y: ty };
  const OX = [0, 0, -1, 1, -1, 1, -1, 1, 0, 0, -2, 2];
  const OY = [-1, 1, 0, 0, -1, -1, 1, 1, -2, 2, 0, 0];
  for (let i = 0; i < OX.length; i++) {
    const nx = tx + OX[i], ny = ty + OY[i];
    if (nx < 0 || ny < 0 || nx >= g.map.w || ny >= g.map.h) continue;
    if (!g.tileSolidAt(nx * TILE + 8, ny * TILE + 8)) return { x: nx, y: ny };
  }
  return { x: tx, y: ty }; // sin mejor sitio: se queda (hará de guardia)
}

/**
 * R11-4c: spawnea los NPCs nuevos del mapa y arma sus rutinas (y las de
 * los NPCs de superficie existentes). IDEMPOTENTE y O(1) si nada cambió
 * (comparación mapa+conteo — spawnNpcs reconstruye g.npcs en cada
 * loadMap y esto lo repone solo). El orquestador puede llamarla tras
 * loadMap; worldTick la invoca en modo perezoso, así funciona AUNQUE el
 * orquestador no cablee nada.
 */
export function __wlArmR11(g: Game): void {
  const st = stateFor(g);
  st.r11.armedMap = ''; // fuerza re-armado completo
  ensureR11(g, st);
}

function ensureR11(g: Game, st: WLState): void {
  if (st.r11.armedMap === g.map.id && st.r11.npcCount === g.npcs.length) return;
  st.r11.armedMap = g.map.id;
  st.r11.mem.clear();
  MOODS.clear();
  // 1) NPCs nuevos de ESTE mapa que falten (misma forma literal que
  //    spawnNpcs del engine; w/h/sprite coherentes para render y diálogo).
  for (let i = 0; i < NPCS_R11.length; i++) {
    const d = NPCS_R11[i];
    if (d.map !== g.map.id) continue;
    let there = false;
    for (let j = 0; j < g.npcs.length; j++) if (g.npcs[j].nid === d.id) { there = true; break; }
    if (there) continue;
    g.npcs.push({
      kind: 'npc', nid: d.id, dispName: d.name,
      x: d.x * TILE + 8, y: d.y * TILE + 8, w: 10, h: 8,
      vx: 0, vy: 0, dir: 'down', hp: 1, maxHp: 1, sprite: d.sprite,
      anim: nidHash(d.id) * 9, moving: false,
    });
  }
  st.r11.npcCount = g.npcs.length;
  if (!SPAWN_OK.has(g.map.id)) return; // cripta/arena: sin rutinas de vida
  // 2) memoria de rutina por NPC (anclas con nudge a tile transitable)
  for (let j = 0; j < g.npcs.length; j++) {
    const n = g.npcs[j];
    const def = NPCS_R11.find((d) => d.id === n.nid); // solo al armar: OK
    const homeTx = Math.round((n.x - 8) / TILE), homeTy = Math.round((n.y - 8) / TILE);
    const w = def ? walkNear(g, def.anclaTrabajo.x, def.anclaTrabajo.y)
                  : walkNear(g, homeTx, homeTy);
    let c: { x: number; y: number };
    if (def) {
      c = walkNear(g, def.anclaCasa.x, def.anclaCasa.y);
    } else {
      // NPCs existentes: casa = puesto + offset determinista por hash
      const h1 = nidHash(n.nid), h2 = nidHash(n.nid + '~casa');
      const ox = h1 < 0.25 ? -2 : h1 < 0.5 ? 2 : 0;
      const oy = h2 < 0.5 ? 1 : -1;
      c = walkNear(g, w.x + ox, w.y + oy);
    }
    st.r11.mem.set(n.nid, {
      wx: w.x * TILE + 8, wy: w.y * TILE + 8,
      cx: c.x * TILE + 8, cy: c.y * TILE + 8,
      hx: n.x, hy: n.y,
      phase: nidHash(n.nid) * 6.283,
      mode: 1, wait: 0, flip: false,
    });
    MOODS.set(n.nid, 1); // 'trabajo' hasta el primer tick
  }
}

/** Paso caminado por eje con sonda de solidez (sin teletransporte). */
function stepTo(g: Game, n: Npc, tx: number, ty: number, dt: number, mem: NpcMem): boolean {
  const dx = tx - n.x, dy = ty - n.y;
  if (dx * dx + dy * dy < 4) return true; // ya en el ancla
  if (mem.wait > 0) { mem.wait -= dt; return false; }
  const step = Math.min(26 * dt, 3); // lentos y con paso acotado
  const firstX = mem.flip ? Math.abs(dy) > Math.abs(dx) : Math.abs(dx) >= Math.abs(dy);
  let moved = false;
  for (let a = 0; a < 2 && !moved; a++) {
    const horiz = a === 0 ? firstX : !firstX;
    const d = horiz ? dx : dy;
    if (Math.abs(d) < 1) continue;
    const s = d > 0 ? step : -step;
    if (horiz) {
      const nx = n.x + s;
      if (!g.tileSolidAt(nx + (s > 0 ? 5 : -5), n.y)) {
        n.x = nx; n.dir = s > 0 ? 'right' : 'left'; moved = true;
      }
    } else {
      const ny = n.y + s;
      if (!g.tileSolidAt(n.x, ny + (s > 0 ? 4 : -4))) {
        n.y = ny; n.dir = s > 0 ? 'down' : 'up'; moved = true;
      }
    }
  }
  if (moved) {
    n.moving = true;
    n.anim += dt * 7; // el motor no anima NPCs: avanzamos la fase aquí
    n.vx = 0; n.vy = 0;
  } else {
    n.moving = false;
    mem.wait = 0.4;         // pausa anti-atasco determinista
    mem.flip = !mem.flip;   // alterna prioridad de eje
  }
  return false;
}

/** Tick de rutinas R11-4c (llamado desde worldTick; O(npcs) ≈ 5-9). */
function tickR11(g: Game, dt: number, st: WLState): void {
  if (!SPAWN_OK.has(g.map.id)) { if (MOODS.size > 0) MOODS.clear(); return; }
  ensureR11(g, st);
  const minute = g.dayT * 1440;
  const camino = minute >= 360 && minute < 720;
  const trabajo = minute >= 720 && minute < 1140;
  const noche = !camino && !trabajo;
  const combat = combatActive(g);
  const guardiaNoche = noche && EXP_NIGHT.has(g.map.id); // expansión: no vagan
  for (let i = 0; i < g.npcs.length; i++) {
    const n = g.npcs[i];
    const mem = st.r11.mem.get(n.nid);
    if (!mem) continue;
    let mode: number;
    if (combat || guardiaNoche) {
      mode = 3; // guardia: quieto donde esté (o en su puesto)
      n.moving = false; n.vx = 0; n.vy = 0;
    } else {
      const tx = noche ? mem.cx : mem.wx;
      const ty = noche ? mem.cy : mem.wy;
      mode = noche ? 2 : camino ? 0 : 1;
      if (stepTo(g, n, tx, ty, dt, mem)) {
        // llegó: trabajo = oscilar; casa de noche = dormir
        n.moving = false; n.vx = 0; n.vy = 0;
        if (mode === 1) {
          n.y = ty + Math.sin(st.clock * 2.4 + mem.phase); // micro-oscilación
          const t7 = st.clock + mem.phase;                  // tramo de 7 s
          if (Math.floor(t7 / 7) !== Math.floor((t7 - dt) / 7) && (Math.floor(t7 / 7) & 1) === 0) {
            g.burst(n.x, n.y - 10, '#d8c890', 3, 26);       // partícula ocasional
          }
        }
      }
    }
    mem.mode = mode;
    MOODS.set(n.nid, mode);
  }
}

/**
 * R11-4c: estado de rutina de un NPC ('camino' | 'trabajo' | 'duerme' |
 * 'guardia') o null si no tiene rutina armada (nid desconocido).
 */
export function __wlNpcMood(nid: string): 'trabajo' | 'camino' | 'duerme' | 'guardia' | null {
  const m = MOODS.get(nid);
  if (m === undefined) return null;
  return m === 0 ? 'camino' : m === 1 ? 'trabajo' : m === 2 ? 'duerme' : 'guardia';
}
