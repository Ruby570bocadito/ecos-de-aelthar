// ============================================================
// ECOS DE AELTHAR — HITOS DE LA HISTORIA (R18)
//
// Escenas cortas (cutscene.ts) que se disparan UNA vez cuando la historia
// llega a un punto: el despertar en Lunaris, el Eco que despierta en la
// Ruina Antigua, la primera vez en cada región, la Sirena que calla y el
// rótulo de cada ACTO. Cada hito deja su flag `cs_*` (viaja en el save).
//
// Ritmo: las peleas son rápidas; la historia se toma su tiempo. Las
// escenas duran 6-20 s, se pueden saltar con ESC y nunca te quitan nada:
// lo que cambian de verdad va en onEnd (que corre también al saltar).
// ============================================================

import type { Game } from './engine';
import { playCutscene, cutsceneActive, type Cutscene, type CutStep } from './cutscene';

const VOZ = '#8ef0ff';      // el Eco / el Canto
const NARR = '#c8c0e0';     // narrador

/** Rótulos de acto: umbral de questIdx → título. */
const ACTOS: { n: number; q: number; title: string; sub: string; lines: CutStep[] }[] = [
  {
    n: 2, q: 5, title: 'ACTO II', sub: 'Las Notas Perdidas',
    lines: [
      { k: 'say', who: '', text: 'Uno de siete. La Voz ha vuelto al valle, y con ella algo que nadie esperaba: el mar ha empezado a cantar de noche.', color: NARR },
      { k: 'say', who: 'Anciana Brisa', text: 'El camino del sur ya no está velado. Ve a la Costa, criatura. Mara lleva trescientos años esperando a alguien que oiga lo mismo que ella.' },
    ],
  },
  {
    n: 3, q: 10, title: 'ACTO III', sub: 'El Canto al Revés',
    lines: [
      { k: 'say', who: '', text: 'Tres voces cantan de nuevo. Pero esta mañana el metal de la forja de Toln ha sonado al revés, y el pozo de Teo devuelve palabras que nadie ha dicho todavía.', color: NARR },
    ],
  },
  {
    n: 4, q: 13, title: 'ACTO IV', sub: 'El Último Canto',
    lines: [
      { k: 'say', who: '', text: 'Velmora ha hablado. El dios no murió por su poder: murió por su hambre. Y la Lanza que lo mató sigue esperando «la segunda vez».', color: NARR },
    ],
  },
  {
    n: 5, q: 16, title: 'ACTO V', sub: 'El Segundo Canto',
    lines: [
      { k: 'say', who: '', text: 'El Último Canto sonó. Pero bajo la Sala alguien cosió una carta en la lanza, y al norte la Orden ha abierto sus puertas por primera vez en trescientos años.', color: NARR },
    ],
  },
];

function camOn(x: number, y: number, dur = 1.5): CutStep { return { k: 'cam', x, y, dur }; }

/** Las escenas; cada una devuelve null si no aplica ahora. */
function despertar(g: Game): Cutscene | null {
  if (g.mapId !== 'lunaris' || g.questIdx !== 0) return null;
  return {
    id: 'despertar',
    steps: [
      { k: 'wait', dur: 0.5 },
      { k: 'title', text: 'ACTO I', sub: 'El Despertar', dur: 2.8 },
      camOn(25, 18, 1.6),
      { k: 'say', who: '', text: 'El obelisco del valle aún vibra. Es lo único en Lunaris que recuerda la voz del dios… y ahora te recuerda a ti.', color: NARR },
      camOn(23, 13, 1.4),
      { k: 'say', who: 'Anciana Brisa', text: 'Otro despertar… y este OYE. Ven a la plaza, criatura: antes de que la Niebla te cuente su versión, el valle tiene algo que contarte.' },
      camOn(26, 2, 1.8),
      { k: 'say', who: '', text: 'Al norte, la Niebla Muda cierra el camino del Bosque. En Aelthar, una puerta se abre cuando la historia la respalda.', color: NARR },
      { k: 'camPlayer', dur: 1.4 },
    ],
  };
}

function ecoDespierta(g: Game): Cutscene | null {
  if (g.mapId !== 'bosque' || !g.flags.fragmentTouched) return null;
  const flip = (ep: 'pasado' | 'presente'): CutStep => ({ k: 'run', fn: gg => { gg.epoch = ep; gg.epochFx = 0.5; } });
  return {
    id: 'eco',
    steps: [
      { k: 'flash', color: '#ffffff', a: 0.6 },
      { k: 'shake', n: 6 },
      { k: 'sfx', name: 'echo' },
      flip('pasado'), { k: 'wait', dur: 0.55 },
      flip('presente'), { k: 'wait', dur: 0.4 },
      flip('pasado'), { k: 'wait', dur: 0.3 },
      flip('presente'), { k: 'wait', dur: 0.3 },
      { k: 'say', who: 'Una voz', text: 'Portador… ¿me oyes? Soy lo que queda del Canto. Te he prestado un oído: ahora el ayer también te escucha.', color: VOZ },
      { k: 'say', who: 'Una voz', text: 'Donde el presente está roto, el pasado aún está entero. Cruza. Y vuelve: lo que siembres allí, aquí habrá crecido.', color: VOZ },
      { k: 'title', text: 'EL ECO DESPIERTA', sub: 'Q · cruzar entre el presente y el pasado   ·   mantén R · Lente del Eco', dur: 3.4 },
      camOn(10, 4, 1.8),
      { k: 'say', who: '', text: 'Al norte, el velo de la escalera de la Cripta se deshace. El primer Eco espera abajo… y la Niebla ya ha olido tu despertar.', color: NARR },
      { k: 'camPlayer', dur: 1.3 },
    ],
    onEnd: gg => { gg.epoch = 'presente'; gg.epochFx = 0; },
  };
}

function cripta(g: Game): Cutscene | null {
  if (g.mapId !== 'cripta') return null;
  return {
    id: 'cripta',
    steps: [
      { k: 'fade', to: 0.6, dur: 0.6 },
      { k: 'title', text: 'LA CRIPTA DEL PRIMER CANTO', sub: 'Fuera del tiempo', dur: 2.8 },
      { k: 'fade', to: 0, dur: 0.8 },
      { k: 'say', who: '', text: 'Aquí abajo el tiempo no corre: se arrodilla. El Guardián Hueco fue el primer coro de Aelthar… hasta que su propia voz lo vació por dentro.', color: NARR },
      { k: 'say', who: '', text: 'El puente está roto en el presente. En el ayer, alguien todavía lo cruzaba cada mañana.', color: NARR },
    ],
  };
}

function costa(g: Game): Cutscene | null {
  if (g.mapId !== 'costa') return null;
  return {
    id: 'costa',
    steps: [
      { k: 'title', text: 'COSTA DE BRUMA', sub: 'Donde el mar guarda las notas', dur: 2.6 },
      camOn(6, 18, 1.8),
      { k: 'actor', id: 'mara', sprite: 'maelis', x: 8, y: 20, dir: 'left' },
      { k: 'move', id: 'mara', x: 7, y: 19, dur: 0.8, wait: true },
      { k: 'say', who: '', text: 'El faro de Mara lleva trescientas noches apagado. Ella sube cada tarde con una cerilla, por si acaso.', color: NARR },
      { k: 'remove', id: 'mara' },
      camOn(41, 22, 2.2),
      { k: 'say', who: '', text: 'Al este, la nave naufragada canta bajo el agua. Algo con voz de mujer la custodia, y no deja que nadie se acerque al Eco de las Mareas.', color: NARR },
      { k: 'camPlayer', dur: 1.6 },
    ],
  };
}

function sirenaCae(g: Game): Cutscene | null {
  if (g.mapId !== 'costa' || !g.flags.sirenaDefeated) return null;
  return {
    id: 'sirena',
    steps: [
      { k: 'wait', dur: 0.6 },
      { k: 'say', who: '', text: 'El canto bajo el agua se apaga. Por primera vez en trescientos años, la marea sube sin hambre.', color: NARR },
      camOn(6, 18, 2.2),
      { k: 'flash', color: '#ffe9a0', a: 0.35 },
      { k: 'sfx', name: 'save' },
      { k: 'say', who: 'Mara, la farera', text: '¡Ha callado! Trescientos años… y esta mañana el mar se ha quedado sin hambre. La cerilla tiembla, Portador, pero la mano no.' },
      { k: 'camPlayer', dur: 1.6 },
    ],
  };
}

function merrow(g: Game): Cutscene | null {
  if (g.mapId !== 'aldea') return null;
  return {
    id: 'merrow',
    steps: [
      { k: 'fade', to: 0.35, dur: 0.6 },
      { k: 'title', text: 'ALDEA DE MERROW', sub: 'La que la Niebla borró', dur: 2.6 },
      { k: 'fade', to: 0, dur: 0.6 },
      camOn(20, 18, 1.8),
      { k: 'actor', id: 'g1', sprite: 'merrow_h', x: 15, y: 18, dir: 'right', ghost: true },
      { k: 'actor', id: 'g2', sprite: 'merrow_m', x: 25, y: 16, dir: 'left', ghost: true },
      { k: 'move', id: 'g1', x: 19, y: 18, dur: 2.6 },
      { k: 'move', id: 'g2', x: 22, y: 17, dur: 2.6 },
      { k: 'say', who: '', text: 'Merrow no está vacía: está olvidada. Sus vecinos siguen aquí, pero ya no recuerdan su propio nombre… ni que están muertos.', color: NARR },
      { k: 'say', who: 'Un eco', text: '¿Quién eres…? ¿Quién… era yo?', color: '#a8c8d8' },
      { k: 'remove', id: 'g1' }, { k: 'remove', id: 'g2' },
      { k: 'flash', color: '#c8d8e8', a: 0.25 },
      { k: 'camPlayer', dur: 1.6 },
    ],
  };
}

function cumbres(g: Game): Cutscene | null {
  if (g.mapId !== 'cumbres') return null;
  return {
    id: 'cumbres',
    steps: [
      { k: 'title', text: 'CUMBRES HELADAS', sub: 'El frío que aprendió a escuchar', dur: 2.6 },
      camOn(24, 12, 2.4),
      { k: 'sfx', name: 'roar' },
      { k: 'shake', n: 4 },
      { k: 'say', who: '', text: 'Algo enorme se despereza entre el hielo. En las Cumbres el frío aprendió a escuchar, y bajo el lago un coro entero espera un alba que no llega.', color: NARR },
      { k: 'camPlayer', dur: 1.8 },
    ],
  };
}

function acto(g: Game): Cutscene | null {
  // el acto más alto alcanzado que aún no se ha anunciado (los anteriores se dan por vistos)
  let best: (typeof ACTOS)[number] | null = null;
  for (const a of ACTOS) if (g.questIdx >= a.q && !g.flags[`cs_acto${a.n}`]) best = a;
  if (!best) return null;
  for (const a of ACTOS) if (a.n < best.n) g.flags[`cs_acto${a.n}`] = true;
  const b = best;
  return {
    id: `acto${b.n}`,
    steps: [
      { k: 'wait', dur: 0.4 },
      { k: 'title', text: b.title, sub: b.sub, dur: 3 },
      ...b.lines,
    ],
  };
}

// ---------------------------------------------------------------- R18: llegadas a las secciones nuevas
function llegada(map: string, id: string, title: string, sub: string, cam: [number, number], line: string, npc?: [string, string, number, number]): (g: Game) => Cutscene | null {
  return (g: Game) => {
    if (g.mapId !== map) return null;
    const steps: CutStep[] = [
      { k: 'title', text: title, sub, dur: 2.6 },
      camOn(cam[0], cam[1], 2),
      { k: 'say', who: '', text: line, color: NARR },
    ];
    if (npc) steps.push(camOn(npc[2], npc[3], 1.6), { k: 'say', who: npc[0], text: npc[1] });
    steps.push({ k: 'camPlayer', dur: 1.5 });
    return { id, steps };
  };
}
const LLEGADAS: Beat[] = [
  { flag: 'cs_molino', when: llegada('molino', 'molino', 'CAMPOS DEL MOLINO', 'El molino que se calló', [20, 6],
    'Hace trescientos años estos campos eran de oro. Hoy solo quedan espantapájaros… y cuervos que aprendieron a hablar la noche en que el molino se calló.',
    ['Aldara, la molinera', '¿Eres tú el Portador del que hablan en la plaza? Ven, por favor. Necesito que alguien camine por el ayer.', 15, 33]) },
  { flag: 'cs_hondonada', when: llegada('hondonada', 'hondonada', 'HONDONADA DE LAS RAÍCES', 'El Árbol Viejo llora ceniza', [24, 18],
    'En el fondo de la Hondonada, el Árbol Viejo deja caer ceniza como quien llora sin hacer ruido. Sus raíces se han vuelto hambrientas.',
    ['Fenna, la herbolaria', 'Las raíces te han olido, Portador. No te asustes: me avisaron de que venías.', 42, 13]) },
  { flag: 'cs_acantilado', when: llegada('acantilado', 'acantilado', 'ACANTILADOS DEL FARO VIEJO', 'Lo que el mar devuelve', [9, 8],
    'Antes que el faro de Mara hubo este. Lo apagó un farero que no soportaba ver volver vacías las barcas.',
    ['Bram, el pescador', '¡Eh, tú! ¿Sabes leer? Llevo treinta años esperando a alguien que sepa leer.', 36, 11]) },
  { flag: 'cs_pantano', when: llegada('pantano', 'pantano', 'PANTANO DE LAS VELAS', 'Una llama por cada nombre', [26, 22],
    'Merrow anotaba a sus muertos en el agua: una vela por nombre. Cuando la Niebla se comió los nombres, las velas se quedaron ardiendo por nadie… hasta apagarse.',
    ['Ysolde, la de las velas', 'Pisa donde piso yo, criatura. El agua de aquí recuerda, y no siempre cosas buenas.', 32, 10]) },
  { flag: 'cs_glaciar', when: llegada('glaciar', 'glaciar', 'GLACIAR DEL ECO', 'El coro congelado', [30, 18],
    'Bajo el hielo, decenas de figuras con la boca abierta. La noche del Silencio cantaban al alba; el frío quiso quedarse con la canción.',
    ['Haldor, el ermitaño', 'No te acerques al hielo de noche. Hay algo que imita las voces… y sabe cuáles echas de menos.', 12, 11]) },
];

interface Beat { flag: string; when: (g: Game) => Cutscene | null }
const BEATS: Beat[] = [
  { flag: 'cs_despertar', when: despertar },
  { flag: 'cs_eco', when: ecoDespierta },
  { flag: 'cs_cripta', when: cripta },
  { flag: 'cs_sirena', when: sirenaCae },
  { flag: 'cs_costa', when: costa },
  { flag: 'cs_merrow', when: merrow },
  { flag: 'cs_cumbres', when: cumbres },
];
BEATS.push(...LLEGADAS); // R18

/** Hitos extra registrados por otros módulos (secciones nuevas de R18). */
const extraBeats: Beat[] = [];
export function registerBeat(flag: string, when: (g: Game) => Cutscene | null): void {
  if (!extraBeats.some(b => b.flag === flag)) extraBeats.push({ flag, when });
}

let forced = false;
/** Pruebas: dispara hitos aunque el bucle real no esté en marcha. */
export function forceStoryBeats(on: boolean): void { forced = on; }
export function storyBeatsForced(): boolean { return forced; }

let settle = 0;
/**
 * 1×/frame en juego (sin fundidos ni escena en curso): dispara el primer
 * hito pendiente cuyo momento ha llegado. Espera ~0,6 s tras cada carga
 * de mapa o diálogo para no pisar la llegada.
 */
export function storyBeatsTick(g: Game, dt: number): void {
  if (g.challengeRun || cutsceneActive() || g.state !== 'play' || g.fadeDir !== 0 || !g.player) { settle = 0; return; }
  settle += dt;
  if (settle < 0.6) return;
  // la sirena antes que la llegada a la costa (si ya cayó, la llegada sobra)
  if (g.flags.sirenaDefeated) g.flags.cs_costa = true;
  for (const b of [...BEATS, ...extraBeats]) {
    if (g.flags[b.flag]) continue;
    const cs = b.when(g);
    if (!cs) continue;
    g.flags[b.flag] = true;
    playCutscene(g, cs);
    return;
  }
  const a = acto(g);
  if (a) { g.flags[`cs_${a.id}`] = true; playCutscene(g, a); }
}
