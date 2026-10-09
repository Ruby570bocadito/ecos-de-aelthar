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
// ============================================================

import type { Game } from './engine';
import { VIEW_W, VIEW_H, ZOOM } from './engine';
import type { Npc, ToneKind } from './types';
import { TILE, SOLID_CHARS } from './sprites';
import { tileAt } from './maps';
import { isNight } from './update'; // solo lectura (propiedad del agente 3-b)
import { dominantTone } from './hooks'; // tono dominante del Portador (3-b)
import { audio } from './audio';

// ---------------- Fauna: pool fijo ----------------

const AVE = 0;        // posa en árboles ('t'/'p'), huye al acercarte
const MARIPOSA = 1;   // de día (g.dayT), deambula cerca del suelo
const LUCIERNAGA = 2; // de noche (isNight), brillo pulsante
const PEZ = 3;        // Costa: salta en el mar/estanque y salpica

const POOL_CAP = 12;          // presupuesto duro de criaturas vivas
const KIND_CAPS = [4, 6, 6, 3]; // aves, voladoras, voladoras, peces

interface Critter {
  active: boolean;
  kind: number;
  x: number; y: number;       // px de mundo
  vx: number; vy: number;
  ax: number; ay: number;     // ancla (vuelta al nido / nivel del agua)
  t: number;                  // edad
  life: number;               // vida útil
  state: number;              // 0 posada/quieto/oculto · 1 huyendo/salto
  st: number;                 // temporizador de estado
  seed: number;               // fase aleatoria fija por criatura
}

// Pool fijo: ranuras reutilizadas, cero GC por frame (patrón fx.ts)
const POOL: Critter[] = Array.from({ length: POOL_CAP }, () => ({
  active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
  t: 0, life: 1, state: 0, st: 0, seed: 0,
}));
const kindCount = [0, 0, 0, 0];
let liveCount = 0; // criaturas vivas (O(1) para el cap)

/** Mapas con fauna (cripta = fuera del tiempo, arena = desafío). */
const SPAWN_OK = new Set<string>(['lunaris', 'bosque', 'costa', 'aldea', 'cumbres']);

// ---------------- Estado por Game (WeakMap) ----------------

interface WLState {
  clock: number;              // reloj propio (no depende de g.globalT)
  spawnAcc: number;
  evtIn: number;              // segundos hasta el próximo evento callejero
  evtCount: number;
  forced: 'eco' | 'rafaga' | 'viajero' | null; // clase fijada por dev/smoke
  trav: { active: boolean; x: number; y: number; dir: number; t: number };
  rumorNext: Map<string, number>; // cooldown por NPC (nid → reloj)
  rot: number;                // rotación determinista de rumores
  rumorsShown: number;
  lastRumor: string;
}

const STATES = new WeakMap<Game, WLState>();

function stateFor(g: Game): WLState {
  let s = STATES.get(g);
  if (!s) {
    s = {
      clock: 0, spawnAcc: 0, evtIn: 38 + Math.random() * 22, evtCount: 0,
      forced: null,
      trav: { active: false, x: 0, y: 0, dir: 1, t: 0 },
      rumorNext: new Map(), rot: 0, rumorsShown: 0, lastRumor: '',
    };
    STATES.set(g, s);
  }
  return s;
}

// ---------------- Helpers de cámara (mundo px) ----------------

function viewBounds(g: Game): [number, number, number, number] {
  const x0 = g.camX / ZOOM, y0 = g.camY / ZOOM;
  return [x0, y0, (g.camX + VIEW_W) / ZOOM, (g.camY + VIEW_H) / ZOOM];
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
  kindCount[kind]++;
  liveCount++;
  return true;
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
    if (ch === '~') {
      // pez: solo Costa (mar/estanque/laguna visibles en cámara)
      if (g.mapId === 'costa' && kindCount[PEZ] < KIND_CAPS[PEZ]) {
        if (spawnAt(g, PEZ, tx * TILE + 8, ty * TILE + 12, 24 + Math.random() * 20)) return;
      }
    } else if (ch === 't' || ch === 'p') {
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
    const dir = Math.random() < 0.5 ? 1 : -1;
    const b = viewBounds(g);
    st.trav.active = true;
    st.trav.dir = dir;
    st.trav.x = dir > 0 ? b[0] - 24 : b[2] + 24;
    st.trav.y = p.y - 4; // camina por el terreno del Portador (siempre pisable)
    st.trav.t = 0;
    g.toast('Un viajante errante cruza el camino, sin levantar la vista...', '#c8b0e8');
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
}

// ---------------- Utilidades dev/smoke ----------------

/** Snapshot del estado del módulo para un Game (solo smokes/dev). */
export function worldlifeStats(g: Game): {
  count: number; aves: number; mariposas: number; luciernagas: number; peces: number;
  viajero: boolean; rumorsShown: number; lastRumor: string; eventCount: number;
  critters: { x: number; y: number; kind: number }[];
} | null {
  const st = STATES.get(g);
  if (!st) return null;
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
    eventCount: st.evtCount, critters,
  };
}

/** Arma el timer de eventos y (opcional) fija la clase del próximo evento. */
export function __wlArmEvent(g: Game, inSec: number, kind?: 'eco' | 'rafaga' | 'viajero'): void {
  const st = stateFor(g);
  st.evtIn = inSec;
  st.forced = kind ?? null;
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
  // WeakMap no se itera: cada smoke usa su propia instancia de Game
}
