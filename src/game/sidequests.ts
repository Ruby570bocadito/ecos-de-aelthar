// ============================================================
// ECOS DE AELTHAR — MISIONES SECUNDARIAS Y RELIQUIAS (R18)
//
// Cinco historias pequeñas, una por sección nueva. Cada una se cuenta con
// su NPC (diálogos que cambian según el progreso), un puzle que obliga a
// cruzar entre el pasado y el presente, un mini-jefe y una RELIQUIA única.
//
// El progreso se calcula a partir de HECHOS (flags del mundo), no de un
// contador frágil: si derrotas al mini-jefe antes de que te lo pidan, el
// objetivo ya aparece cumplido; si cargas una partida vieja, nada se rompe.
// Flags: sq_<id>_on (aceptada) · sq_<id>_done (entregada) · hechos propios.
//
// Reliquias (una equipada a la vez, se elige en la pausa · Equipo):
//   pluma      Pluma de la Reina     +8% velocidad
//   corona     Corona de Ramas       −10% daño recibido
//   caracola   Caracola del Faro     +1,5 de Resonancia por segundo
//   vela       Vela Eterna           +1 vida/s fuera de combate
//   escarcha   Escarcha Cantora      12% de congelar al golpear
// ============================================================

import type { Game } from './engine';
import type { Enemy, MapId, DialogueNode } from './types';
import { TILE } from './sprites';
import { audio } from './audio';
import { spawnVfx } from './actors/vfx';
import { R18_BOSSES } from './enemies_r18';

// ---------------------------------------------------------------- reliquias
export interface RelicDef { id: string; name: string; desc: string; icon: string; color: string }
export const RELICS: RelicDef[] = [
  { id: 'pluma', name: 'Pluma de la Reina', desc: '+8% de velocidad de movimiento', icon: '❦', color: '#c8b0ff' },
  { id: 'corona', name: 'Corona de Ramas', desc: 'Recibes un 10% menos de daño', icon: '✿', color: '#9ef08a' },
  { id: 'caracola', name: 'Caracola del Faro', desc: '+1,5 de Resonancia por segundo', icon: '◎', color: '#8ef0ff' },
  { id: 'vela', name: 'Vela Eterna', desc: 'Recuperas 1 de vida por segundo fuera de combate', icon: '♨', color: '#ffd27a' },
  { id: 'escarcha', name: 'Escarcha Cantora', desc: '12% de probabilidad de congelar al golpear', icon: '❄', color: '#a8e8ff' },
];
export function relicOwned(g: Game, id: string): boolean { return !!g.flags[`reliquia_${id}`]; }
export function relicEquipped(g: Game): string | null {
  const v = g.flags.reliquia;
  return typeof v === 'string' && relicOwned(g, v) ? v : null;
}
export function relicIs(g: Game, id: string): boolean { return relicEquipped(g) === id; }
export function equipRelic(g: Game, id: string | null): void {
  if (id && !relicOwned(g, id)) return;
  if (id) g.flags.reliquia = id; else delete g.flags.reliquia;
  const r = RELICS.find(x => x.id === id);
  g.toast(r ? `Reliquia equipada: ${r.name} — ${r.desc}` : 'Sin reliquia equipada', r?.color ?? '#9aa0b8');
  audio.sfx('confirm');
}
function grantRelic(g: Game, id: string): void {
  g.flags[`reliquia_${id}`] = true;
  if (!relicEquipped(g)) g.flags.reliquia = id;
  const r = RELICS.find(x => x.id === id)!;
  g.toast(`¡Reliquia: ${r.name}! ${r.desc} (pausa · Equipo para cambiarla)`, r.color);
}

// ---------------------------------------------------------------- misiones
interface Objective { text: (g: Game) => string; done: (g: Game) => boolean }
export interface SideQuest {
  id: string; name: string; map: MapId; giver: string; giverName: string; portrait: string;
  objectives: Objective[];
  reward: { gold: number; potions: number; relic: string; xpK: number };
}
const n = (g: Game, k: string) => Number(g.flags[k] ?? 0) || 0;
const countOf = (g: Game, ids: string[]) => ids.filter(id => !!g.flags[id]).length;

export const SIDE_QUESTS: SideQuest[] = [
  {
    id: 'molino', name: 'El Molino Mudo', map: 'molino', giver: 'aldara', giverName: 'Aldara, la molinera', portrait: 'aldara',
    objectives: [
      { text: () => 'Lee el cuaderno del molinero junto al molino… en el pasado (Q)', done: g => !!g.flags.sq_molino_cuaderno },
      { text: () => 'Derrota a la Reina de los Cuervos en la era del granero', done: g => !!g.flags.reinaCuervoDerrotada },
    ],
    reward: { gold: 60, potions: 1, relic: 'pluma', xpK: 0.4 },
  },
  {
    id: 'savia', name: 'Savia de Ceniza', map: 'hondonada', giver: 'fenna', giverName: 'Fenna, la herbolaria', portrait: 'fenna',
    objectives: [
      { text: g => `Recoge savia de las Raíces Hambrientas de la Hondonada (${Math.min(3, n(g, 'sq_savia_n'))}/3)`, done: g => n(g, 'sq_savia_n') >= 3 },
      { text: () => 'Lleva la savia al altar del claro oeste, en el pasado: hoy los troncos caídos cierran el paso (Q)', done: g => !!g.flags.sq_savia_altar },
      { text: () => 'Derrota al Ciervo de Ceniza en el claro del sur', done: g => !!g.flags.ciervoDerrotado },
    ],
    reward: { gold: 80, potions: 1, relic: 'corona', xpK: 0.45 },
  },
  {
    id: 'botellas', name: 'Lo que el Mar Devuelve', map: 'acantilado', giver: 'bram', giverName: 'Bram, el pescador', portrait: 'bram',
    objectives: [
      { text: g => `Recoge las botellas que trajo la marea (${countOf(g, ['botella1', 'botella2', 'botella3'])}/3) — una está en la caleta que hoy cubre el mar`, done: g => countOf(g, ['botella1', 'botella2', 'botella3']) >= 3 },
      { text: () => 'Derrota al Rey Cangrejo en la cueva de la marea', done: g => !!g.flags.reyCangrejoDerrotado },
    ],
    reward: { gold: 100, potions: 1, relic: 'caracola', xpK: 0.45 },
  },
  {
    id: 'velas', name: 'Velas para los Olvidados', map: 'pantano', giver: 'ysolde', giverName: 'Ysolde, la de las velas', portrait: 'ysolde',
    objectives: [
      { text: g => `Enciende las velas del pantano en el pasado, donde los nombres aún existen (${countOf(g, ['vela1', 'vela2', 'vela3', 'vela4'])}/4)`, done: g => countOf(g, ['vela1', 'vela2', 'vela3', 'vela4']) >= 4 },
      { text: () => 'Derrota a la Viuda de Niebla en la isla central', done: g => !!g.flags.viudaDerrotada },
    ],
    reward: { gold: 120, potions: 2, relic: 'vela', xpK: 0.5 },
  },
  {
    id: 'coro', name: 'La Voz Congelada', map: 'glaciar', giver: 'haldor', giverName: 'Haldor, el ermitaño', portrait: 'haldor',
    objectives: [
      { text: g => `Rompe los cristales cantores en el pasado, cuando el hielo era joven (${countOf(g, ['cristal1', 'cristal2', 'cristal3'])}/3)`, done: g => countOf(g, ['cristal1', 'cristal2', 'cristal3']) >= 3 },
      { text: () => 'Derrota al Wendigo de Escarcha', done: g => !!g.flags.wendigoDerrotado },
    ],
    reward: { gold: 140, potions: 2, relic: 'escarcha', xpK: 0.5 },
  },
];

export function sqOn(g: Game, q: SideQuest): boolean { return !!g.flags[`sq_${q.id}_on`]; }
export function sqDone(g: Game, q: SideQuest): boolean { return !!g.flags[`sq_${q.id}_done`]; }
/** Objetivo vigente (texto) o 'Vuelve con …' si todo está hecho; null si no aplica. */
export function sqCurrent(g: Game, q: SideQuest): string | null {
  if (!sqOn(g, q) || sqDone(g, q)) return null;
  for (const o of q.objectives) if (!o.done(g)) return o.text(g);
  return `Vuelve con ${q.giverName}`;
}
function sqReady(g: Game, q: SideQuest): boolean { return q.objectives.every(o => o.done(g)); }

/** Misión secundaria a mostrar en el HUD: la del mapa actual o la última activa. */
export function sqTracked(g: Game): { q: SideQuest; text: string } | null {
  let pick: SideQuest | null = null;
  for (const q of SIDE_QUESTS) if (sqOn(g, q) && !sqDone(g, q) && q.map === g.mapId) pick = q;
  if (!pick) for (const q of SIDE_QUESTS) if (sqOn(g, q) && !sqDone(g, q)) pick = q;
  if (!pick) return null;
  const t = sqCurrent(g, pick);
  return t ? { q: pick, text: t } : null;
}

// ---------------------------------------------------------------- diálogos
type Nodes = Record<string, DialogueNode>;
const LINES: Record<string, { intro: string; accept: string; mid: (g: Game) => string; done: string; after: string }> = {
  aldara: {
    intro: 'El molino no gira desde la Noche del Silencio. Mi abuela decía que esa noche dio una vuelta más, sin viento, y que la piedra CANTÓ. A la mañana siguiente, los cuervos ya sabían hablar… y anidaron en el granero. ¿Me ayudas a que vuelva a moler?',
    accept: 'El molinero de entonces escribía todo en un cuaderno. Hoy no queda nada… pero dicen que tú puedes caminar por el ayer. Búscalo allí, junto al molino.',
    mid: () => 'La Reina de los Cuervos anida en la era del granero, al este. Si cae, quizá el molino recuerde para qué servía.',
    done: '¡Escucha! ¿Lo oyes? La piedra… respira. No sé cómo pagarte. Toma: es una pluma de su corona. Dicen que quien la lleva camina como el viento que el molino echaba de menos.',
    after: 'Cada mañana pongo un puñado de trigo en la piedra. Aún no gira, pero ya no está muda.',
  },
  fenna: {
    intro: 'El Árbol Viejo llora ceniza desde hace trescientos años. Sus raíces se volvieron hambrientas y envenenan la Hondonada. Y el Ciervo… el Ciervo de Ceniza guarda su corazón y no deja que nadie lo cure.',
    accept: 'Tráeme la savia que les queda a las Raíces Hambrientas: tres bastarán. Luego llévala al altar del claro oeste… en el ayer, cuando el paso aún estaba abierto. El árbol tiene que beberla en el tiempo en que aún sabía beber.',
    mid: () => 'El altar del claro oeste está tras los troncos caídos. En el pasado no había troncos: había un sendero de piedras.',
    done: 'Las hojas… ¡tiene hojas! Hacía siglos que no veía verde en esas ramas. Toma esta corona: la tejí con sus primeras ramas. Te protegerá como él protegía la Hondonada.',
    after: 'El Árbol Viejo ya no llora. Ahora susurra. Dice tu nombre cuando pasas.',
  },
  bram: {
    intro: 'Treinta años recogiendo lo que el mar devuelve. Botellas, sobre todo: mensajes de los ahogados. No sé leer, pero las guardo. Esta semana la marea dejó tres más… y algo enorme con pinzas no me deja bajar a buscarlas.',
    accept: 'Dos están en la playa. La tercera la vi en la caleta del suroeste, pero ahora el mar la cubre. Dicen que hace mucho allí había marea baja todo el año… ¿será verdad lo que cuentan de ti?',
    mid: () => 'El Rey Cangrejo vive en la cueva de la marea, al sur. Todo lo que el mar devuelve, se lo queda él.',
    done: '¿Me las lees? … «Volveré antes del invierno». «Dile a mi madre que el faro se ve desde aquí». «No me esperéis». Gracias, Portador. Toma esta caracola: dentro se oye el mar entero. Te devolverá fuerzas como el mar me devuelve botellas.',
    after: 'Ahora sé lo que dicen. Las guardo igual. Alguien tiene que recordar a los que no volvieron.',
  },
  ysolde: {
    intro: 'Cada vela de este pantano es un nombre que la Niebla se comió. Merrow los anotaba en el agua para que el pantano los recordara. Pero hoy las velas no prenden: nadie recuerda por quién arden. Y la Viuda… la Viuda lleva puestos los nombres que robó.',
    accept: 'En el ayer los nombres aún existen. Enciende allí las cuatro velas, y su llama llegará hasta hoy. Así sabremos dónde se esconde ella.',
    mid: () => 'Las cuatro arden. Ahora la Viuda no tiene dónde esconderse: está en la isla del centro, contando nombres que no son suyos.',
    done: 'Se ha ido… y los nombres vuelven al agua, uno a uno. ¿Oyes? «Edda». «Tomé». «La pequeña Ila». Llévate esta vela: no se apaga nunca. Mientras arda, nadie podrá olvidarte del todo.',
    after: 'Leo los nombres cada noche. Hoy he añadido el tuyo, por si acaso.',
  },
  haldor: {
    intro: 'Vine a buscar a mi hermano hace cuarenta inviernos. Subió a cantar al alba con los pastores, la noche del Silencio. Están todos dentro del glaciar, con la boca abierta, esperando la nota siguiente. Los cristales cantores los atan.',
    accept: 'El hielo de hoy tiene trescientos inviernos: ni tu acero lo raya. Pero dicen que tú caminas por el ayer… allí el hielo era joven. Rompe los tres cristales cuando aún eran agua quieta.',
    mid: () => 'Los cristales están rotos. Pero el Wendigo… imita la voz de mi hermano. Mientras viva, el coro no podrá terminar su canción.',
    done: '¿Lo oyes? Terminaron la nota. Trescientos años, y terminaron la nota. Mi hermano estaba en la tercera fila; reconocería su voz en cualquier parte. Toma esta escarcha: canta cuando golpeas. Que el frío trabaje por fin para alguien.',
    after: 'Me quedaré aquí. Alguien tiene que escuchar la canción entera.',
  },
};

function questByGiver(nid: string): SideQuest | null { return SIDE_QUESTS.find(q => q.giver === nid) ?? null; }

/**
 * talkTo de los NPCs nuevos: construye el nodo según el estado de su misión.
 * Devuelve la clave del nodo (en g.dynNodes) o null si el NPC no es de R18.
 */
export function sideQuestDialogue(g: Game, nid: string): string | null {
  const q = questByGiver(nid);
  if (!q) return null;
  const L = LINES[nid];
  const nodes = g.dynNodes as Nodes;
  const key = `sq_${q.id}`;
  if (sqDone(g, q)) {
    nodes[key] = { name: q.giverName, portrait: q.portrait, text: L.after };
  } else if (!sqOn(g, q)) {
    nodes[key] = {
      name: q.giverName, portrait: q.portrait, text: L.intro,
      options: [
        { text: 'Te ayudaré.', next: `${key}_ok`, tone: 'empatico' },
        { text: '¿Qué gano yo con eso?', next: `${key}_ok`, tone: 'pragmatico' },
        { text: 'Ahora no.', action: 'close' },
      ],
    };
    nodes[`${key}_ok`] = { name: q.giverName, portrait: q.portrait, text: L.accept, onEnd: `sq_accept_${q.id}` };
  } else if (sqReady(g, q)) {
    nodes[key] = { name: q.giverName, portrait: q.portrait, text: L.done, onEnd: `sq_reward_${q.id}` };
  } else {
    nodes[key] = { name: q.giverName, portrait: q.portrait, text: `${L.mid(g)}\n\n(${sqCurrent(g, q)})` };
  }
  return key;
}

/** Acciones de diálogo de R18 (true = gestionada). */
export function sideQuestAction(g: Game, action: string): boolean {
  if (action.startsWith('sq_accept_')) {
    const q = SIDE_QUESTS.find(x => x.id === action.slice(10));
    if (!q || sqOn(g, q)) return true;
    g.flags[`sq_${q.id}_on`] = true;
    audio.sfx('quest');
    g.toast(`Misión secundaria: ${q.name}`, '#c8e8a0');
    return true;
  }
  if (action.startsWith('sq_reward_')) {
    const q = SIDE_QUESTS.find(x => x.id === action.slice(10));
    const p = g.player;
    if (!q || !p || sqDone(g, q) || !sqReady(g, q)) return true;
    g.flags[`sq_${q.id}_done`] = true;
    p.gold += q.reward.gold;
    p.potions += q.reward.potions;
    if (!g.challengeRun) g.stats.coronasGanadas += q.reward.gold;
    const xp = Math.round(g.xpNext(p.level) * q.reward.xpK);
    g.gainXp(xp);
    audio.sfx('levelup');
    g.toast(`Misión secundaria completada: ${q.name} (+${q.reward.gold} coronas, +${q.reward.potions} poción${q.reward.potions > 1 ? 'es' : ''}, +${xp} XP)`, '#c8e8a0');
    grantRelic(g, q.reward.relic);
    spawnVfx('pillar', p.x, p.y, { el: 'sagrado' });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- interactivos
type Consider = (x: number, y: number, kind: string, label: string, act: () => void, r?: number) => void;

function read(g: Game, title: string, text: string): void {
  (g.dynNodes as Nodes).sq_lectura = { name: title, portrait: 'wisp', text };
  g.openDialogue('sq_lectura');
}

/** Objetos de las secciones nuevas (los llama engine.nearestInteract). */
export function sideQuestInteract(g: Game, consider: Consider): void {
  const p = g.player;
  if (!p) return;
  const past = g.epoch === 'pasado';
  for (const pr of g.map.props) {
    if (pr.needPast && !past) continue;
    if (pr.needPresent && past) continue;
    const x = pr.x * TILE + 8, y = pr.y * TILE + 8;
    switch (pr.kind) {
      case 'cuaderno':
        consider(x, y, 'lore', 'Leer el cuaderno del molinero', () => {
          g.flags.sq_molino_cuaderno = true;
          read(g, 'El cuaderno del molinero', 'Día 412. Los cuervos han vuelto a anidar en los engranajes. Uno de ellos lleva plumas doradas en la cabeza, como una corona: los demás le obedecen. Si el molino se para algún día, será por ella. Si alguien lee esto… la Reina vive donde se trilla el trigo.');
          audio.sfx('echo');
        }, 28);
        break;
      case 'altarsavia': {
        const placed = !!g.flags.sq_savia_altar;
        if (placed) { consider(x, y, 'lore', 'El altar de la savia', () => read(g, 'Altar de la savia', 'La savia empapa la piedra y se hunde hacia las raíces. Muy lejos, en el centro de la Hondonada, el Árbol Viejo bebe.'), 26); break; }
        consider(x, y, 'altar', n(g, 'sq_savia_n') >= 3 ? 'Verter la savia en el altar' : 'Un altar con raíces', () => {
          if (n(g, 'sq_savia_n') >= 3) {
            g.flags.sq_savia_altar = true;
            spawnVfx('pillar', x, y, { el: 'sagrado' });
            g.burst(x, y - 6, '#9ef08a', 24, 80);
            audio.sfx('song');
            g.toast('La savia vuelve a las raíces del ayer. En el presente, el Árbol Viejo tiene hojas.', '#9ef08a');
          } else {
            read(g, 'Altar de la savia', 'Un cuenco de piedra rodeado de raíces que aún laten. Hace falta savia viva para despertarlas (la de tres Raíces Hambrientas).');
          }
        }, 26);
        break;
      }
      case 'botella':
        if (g.flags[pr.id]) break;
        consider(x, y, 'item', 'Recoger la botella', () => {
          g.flags[pr.id] = true;
          audio.sfx('coin');
          g.burst(x, y - 4, '#8ef0ff', 10, 50);
          const c = countOf(g, ['botella1', 'botella2', 'botella3']);
          g.toast(`Botella con mensaje (${c}/3) — Bram sabrá qué hacer con ella`, '#8ef0ff');
        }, 24);
        break;
      case 'vela':
        if (g.flags[pr.id]) break;
        consider(x, y, 'item', past ? 'Encender la vela' : 'Una vela que no prende', () => {
          if (!past) { g.toast('La mecha no prende: aquí nadie recuerda por quién arde. En el ayer, sí.', '#c8b0e8'); audio.sfx('error'); return; }
          g.flags[pr.id] = true;
          audio.sfx('save');
          spawnVfx('pyre', x, y - 6, { size: 0.5 });
          const c = countOf(g, ['vela1', 'vela2', 'vela3', 'vela4']);
          g.toast(`Vela encendida (${c}/4): su llama llegará hasta el presente`, '#ffd27a');
        }, 26);
        break;
      case 'cristalhielo':
        if (g.flags[pr.id]) break;
        consider(x, y, 'item', past ? 'Romper el cristal (el hielo aún es joven)' : 'Un cristal cantor', () => {
          if (!past) { g.toast('Trescientos inviernos de hielo: ni tu acero lo raya. En el ayer era agua quieta.', '#a8e8ff'); audio.sfx('error'); return; }
          g.flags[pr.id] = true;
          audio.sfx('ice');
          spawnVfx('frost', x, y, { size: 0.8 });
          g.burst(x, y - 6, '#b8e8ff', 20, 80);
          const c = countOf(g, ['cristal1', 'cristal2', 'cristal3']);
          g.toast(`Cristal cantor roto (${c}/3): una voz se suelta dentro del glaciar`, '#a8e8ff');
        }, 26);
        break;
      case 'molino':
        consider(x, y + 18, 'lore', 'Examinar el molino', () => read(g, 'El molino', g.flags.reinaCuervoDerrotada
          ? 'Las aspas crujen. No giran todavía, pero el viento ya no pasa de largo: se queda a escucharlas.'
          : past ? 'Las aspas giran despacio, cargadas de trigo. Dentro, alguien canta mientras la piedra muele.'
            : 'Aspas rotas, paja podrida y nidos. Algo dorado brilla entre los engranajes de arriba.'), 34);
        break;
      case 'arbolviejo':
        consider(x, y + 14, 'lore', 'Tocar el Árbol Viejo', () => read(g, 'El Árbol Viejo', g.flags.sq_savia_altar
          ? 'La corteza está tibia. Bajo la mano se nota un latido lento, como de alguien que despierta.'
          : past ? 'Un árbol enorme, verde, lleno de pájaros. Sus raíces beben de algo que suena como una canción.'
            : 'Corteza gris, ramas desnudas. De las grietas cae ceniza, despacio, como si el árbol llorara.'), 34);
        break;
      default: break;
    }
  }
}

// ---------------------------------------------------------------- combate
/** Muerte de enemigos: savia de las raíces (Hondonada) y mini-jefes de R18. */
export function sideQuestOnKill(g: Game, e: Enemy): void {
  const p = g.player;
  if (!p || g.challengeRun) return;
  if (e.etype === 'raiz' && g.mapId === 'hondonada' && g.flags.sq_savia_on && n(g, 'sq_savia_n') < 3) {
    const c = n(g, 'sq_savia_n') + 1;
    g.flags.sq_savia_n = c;
    g.floatAt(e.x, e.y - 20, `Savia ${c}/3`, '#9ef08a', 7);
    if (c >= 3) g.toast('Tienes savia suficiente. El altar del claro oeste… en el pasado.', '#9ef08a');
  }
  const flag = R18_BOSSES[e.etype];
  if (flag) {
    g.flags[flag] = true;
    delete g.flags[`bossHp_${g.mapId}`];
    delete g.flags[`bossHpWho_${g.mapId}`];
    g.bossActive = false;
    audio.setCombat(false);
    audio.playTrack(g.map.music);
    g.shake = 8;
    audio.sfx('song');
    p.potions += 1;
    p.points += 1;
    g.floatAt(e.x, e.y - 40, 'Botín del guardián: +1 poción, +1 punto', '#f0c84a');
    const q = SIDE_QUESTS.find(x => x.map === g.mapId);
    if (q && sqOn(g, q) && !sqDone(g, q)) g.toast(`${q.name}: vuelve con ${q.giverName}`, '#c8e8a0');
  }
}

// ---------------------------------------------------------------- reliquias en juego
/** Efectos continuos de la reliquia equipada (1×/frame en juego). */
export function relicTick(g: Game, dt: number, inCombat: boolean): void {
  const p = g.player;
  if (!p || g.challengeRun) return;
  const r = relicEquipped(g);
  if (r === 'caracola') p.res = Math.min(p.maxRes, p.res + 1.5 * dt);
  if (r === 'vela' && !inCombat && p.hp < p.maxHp && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + dt);
}
export function relicSpeedMult(g: Game): number { return relicIs(g, 'pluma') ? 1.08 : 1; }
export function relicDamageTakenMult(g: Game): number { return relicIs(g, 'corona') ? 0.9 : 1; }
export function relicFreezeChance(g: Game): number { return relicIs(g, 'escarcha') ? 0.12 : 0; }
