// ============================================================
// ECOS DE AELTHAR — Mapas del Acto II (expansión)
// Costa de Bruma · Aldea de Merrow · Cumbres Heladas
// Generación determinista (semillas fijas, sin azar de ejecución).
//
// NOTA DE CONTRATO: los helpers de generación están DUPLICADOS a
// propósito desde maps.ts (maps.ts no debía modificarse para
// exportarlos). Transitables nuevos usados: 's' (arena),
// 'S' (nieve), 'i' (hielo) — los dibuja otro agente.
// ============================================================

import type { MapDef, EpochDiff } from './types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Grid = string[][];

function grid(w: number, h: number, fill: string): Grid {
  const g: Grid = [];
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) row.push(fill);
    g.push(row);
  }
  return g;
}

function set(g: Grid, x: number, y: number, ch: string) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
}

function rect(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, ch);
}

function rectOutline(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let i = x; i < x + w; i++) { set(g, i, y, ch); set(g, i, y + h - 1, ch); }
  for (let j = y; j < y + h; j++) { set(g, x, j, ch); set(g, x + w - 1, j, ch); }
}

function pathH(g: Grid, x0: number, x1: number, y: number, ch = '=') {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (let x = a; x <= b; x++) set(g, x, y, ch);
}

function pathV(g: Grid, y0: number, y1: number, x: number, ch = '=') {
  const a = Math.min(y0, y1), b = Math.max(y0, y1);
  for (let y = a; y <= b; y++) set(g, x, y, ch);
}

function house(g: Grid, x: number, y: number, w: number, doorX: number) {
  rect(g, x, y, w, 1, 'r');
  rect(g, x, y + 1, w, 1, 'H');
  set(g, doorX, y + 1, 'd');
}

function scatter(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string, density: number, seed: number, skip: (x: number, y: number) => boolean) {
  const rng = mulberry32(seed);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (skip(x, y)) continue;
      if (rng() < density) set(g, x, y, ch);
    }
  }
}

function borderForest(g: Grid, thickness: number, base: string) {
  const w = g[0].length, h = g.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edge < thickness) set(g, x, y, base);
    }
  }
}

function toRows(g: Grid): string[] { return g.map(r => r.join('')); }

// ---------------- COSTA DE BRUMA (52×40) ----------------
// Arena ('s'), hierba salada ('.'), acantilados al norte ('#','R'),
// mar al sur/este ('~', sólido). Muelle roto (entero en el pasado),
// naufragio al este, faro en ruinas al oeste, altar de las Mareas.

function buildCosta(): string[] {
  const W = 52, H = 40;
  const g = grid(W, H, '.');
  borderForest(g, 2, 'R');            // promontorios rocosos en los bordes
  rect(g, 0, 0, W, 2, '#');           // acantilado norte
  // abertura norte: entrada desde Lunaris (x25..27, y0..1)
  rect(g, 25, 0, 3, 2, '=');
  pathV(g, 2, 8, 25); pathV(g, 2, 8, 26);
  // mar al sur y al este, con orilla ondulada de arena
  for (let x = 2; x <= 49; x++) {
    const wave = 35 + ((x * 7 + 3) % 3);
    for (let y = wave; y < H; y++) set(g, x, y, '~');
    set(g, x, wave - 1, 's');
  }
  for (let y = 2; y <= 37; y++) {
    const seaX = 43 + ((y * 5 + 1) % 3);
    for (let x = seaX; x < W; x++) set(g, x, y, '~');
    if (g[y][seaX - 1] !== '~') set(g, seaX - 1, y, 's');
  }
  // playa de arena al sur
  rect(g, 6, 29, 34, 5, 's');
  // caminos: principal, santuario, naufragio, faro
  pathH(g, 10, 34, 9);
  pathV(g, 10, 20, 21);
  pathV(g, 10, 24, 34);
  pathH(g, 33, 41, 25);
  pathV(g, 9, 17, 7);
  // calzada este hacia la Aldea de Merrow (abertura en el borde este)
  rect(g, 43, 17, 9, 4, '=');
  // muelle de Merrow: pilares ('x') + tablones ('B'); en el presente
  // solo quedan los dos primeros tramos, el mar se tragó el resto
  for (let y = 34; y <= 38; y++) { set(g, 27, y, 'x'); set(g, 30, y, 'x'); }
  rect(g, 28, 34, 2, 2, 'B');
  // promontorio del faro (oeste)
  set(g, 4, 16, 'R'); set(g, 4, 17, 'R'); set(g, 4, 18, 'R'); set(g, 4, 19, 'R');
  set(g, 5, 17, 'R'); set(g, 5, 19, 'R');
  // textura: rocas en el acantilado, pinos salados, hierba de mar
  set(g, 5, 1, 'R'); set(g, 13, 1, 'R'); set(g, 31, 1, 'R'); set(g, 40, 1, 'R'); set(g, 47, 1, 'R');
  set(g, 10, 2, 'R'); set(g, 40, 2, 'R'); set(g, 17, 4, 'R');
  scatter(g, 3, 3, 18, 12, 'p', 0.05, 411, (x, y) => g[y][x] !== '.');
  scatter(g, 3, 10, 42, 28, ',', 0.05, 412, (x, y) => g[y][x] !== '.');
  // despejar coordenadas clave (NPCs/cofres/ecos/spawns/props) por si
  // la decoración dispersa dejó un tile sólido
  const clearKey: [number, number, string][] = [
    [7, 19, '.'], [30, 32, 's'], [4, 15, '.'], [42, 29, '.'], [24, 30, 's'],
    [37, 19, '.'], [11, 25, '.'], [23, 3, '.'], [25, 31, 's'], [22, 21, '.'],
    [36, 27, '.'], [41, 22, '.'], [39, 24, '.'], [12, 32, 's'], [20, 34, '.'],
    [33, 32, 's'], [38, 30, 's'], [14, 22, '.'], [24, 26, '.'],
  ];
  for (const [x, y, ch] of clearKey) {
    const c = g[y][x];
    if (c === 'p' || c === 'R' || c === 'H' || c === 'r' || c === '#') set(g, x, y, ch);
  }
  return toRows(g);
}

const costaDiffs: EpochDiff[] = [
  // el muelle de Merrow está entero en el pasado: el ayer sostiene los tablones
  { x: 28, y: 36, char: 'B' }, { x: 29, y: 36, char: 'B' },
  { x: 28, y: 37, char: 'B' }, { x: 29, y: 37, char: 'B' },
  { x: 28, y: 38, char: 'B' }, { x: 29, y: 38, char: 'B' },
];

// ---------------- ALDEA DE MERROW (44×34) ----------------
// Pueblo borrado por la Niebla Muda. PRESENTE: ruinas ('H' muros rotos,
// 'r' escombros, ':' empedrado agrietado) y espectros. PASADO: el pueblo
// vivo en el festival — casas enteras con puertas, flores, muelle este.

function buildAldea(): string[] {
  const W = 44, H = 34;
  const g = grid(W, H, ':');          // empedrado agrietado por doquier
  borderForest(g, 2, 'H');            // muralla de muros rotos
  // abertura oeste: entrada desde la Costa de Bruma (x0..1, y16..19)
  rect(g, 0, 16, 5, 4, '=');
  pathH(g, 4, 17, 18);
  // plaza central con el pozo seco
  rect(g, 17, 12, 10, 8, ':');
  set(g, 21, 15, 'w');
  // casas en ruinas (presente): techos hundidos y muros con boquetes
  house(g, 6, 6, 6, 9);               // casa del noroeste
  set(g, 9, 7, ':'); set(g, 7, 7, ':'); set(g, 10, 7, ':'); set(g, 8, 6, ':');
  house(g, 30, 6, 6, 33);             // casa del nordeste
  set(g, 33, 7, ':'); set(g, 31, 7, ':'); set(g, 34, 7, ':'); set(g, 32, 6, ':');
  house(g, 6, 24, 6, 9);              // casa del sudoeste
  set(g, 9, 25, ':'); set(g, 7, 25, ':'); set(g, 10, 25, ':'); set(g, 8, 24, ':');
  house(g, 30, 24, 6, 33);            // casa del sudeste
  set(g, 33, 25, ':'); set(g, 31, 25, ':'); set(g, 34, 25, ':'); set(g, 32, 24, ':');
  // caminos: plaza → sur → orilla de la laguna
  pathV(g, 19, 26, 21);
  // laguna al sudeste
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - 40) / 3.4, dy = (y - 27) / 2.6;
    if (dx * dx + dy * dy < 1) set(g, x, y, '~');
  }
  pathH(g, 21, 38, 26);
  // muelle este de la laguna (roto en el presente, entero en el pasado)
  set(g, 37, 28, 'x'); set(g, 40, 29, 'x');
  rect(g, 38, 26, 2, 2, 'B');
  rect(g, 38, 28, 2, 2, '~');
  // la hierba reclaima el pueblo; escombros por todas partes
  scatter(g, 3, 3, 40, 30, '.', 0.05, 511, (x, y) => {
    if (g[y][x] !== ':') return true;
    if (x >= 16 && x <= 27 && y >= 11 && y <= 20) return true;  // plaza empedrada
    return false;
  });
  scatter(g, 3, 3, 40, 30, 'r', 0.045, 512, (x, y) => g[y][x] !== ':');
  // despejar coordenadas clave
  const clearKey: [number, number][] = [
    [22, 16], [10, 23], [32, 9], [23, 14], [6, 19], [5, 16], [26, 20],
    [13, 13], [28, 14], [20, 22], [17, 21], [9, 12], [33, 12], [14, 22],
    [30, 21], [16, 8], [27, 29],
  ];
  for (const [x, y] of clearKey) {
    const c = g[y][x];
    if (c === 'r' || c === 'H') set(g, x, y, ':');
  }
  return toRows(g);
}

const aldeaDiffs: EpochDiff[] = [
  // el festival: el pueblo VIVO — puertas enteras y techos completos
  { x: 9, y: 7, char: 'd' }, { x: 7, y: 7, char: 'H' }, { x: 10, y: 7, char: 'H' }, { x: 8, y: 6, char: 'r' },
  { x: 33, y: 7, char: 'd' }, { x: 31, y: 7, char: 'H' }, { x: 34, y: 7, char: 'H' }, { x: 32, y: 6, char: 'r' },
  { x: 9, y: 25, char: 'd' }, { x: 7, y: 25, char: 'H' }, { x: 10, y: 25, char: 'H' }, { x: 8, y: 24, char: 'r' },
  { x: 33, y: 25, char: 'd' }, { x: 31, y: 25, char: 'H' }, { x: 34, y: 25, char: 'H' }, { x: 32, y: 24, char: 'r' },
  // guirnaldas y pétalos del Festival del Nombre en la plaza
  { x: 19, y: 13, char: ',' }, { x: 24, y: 14, char: ',' }, { x: 18, y: 17, char: ',' },
  { x: 25, y: 18, char: ',' }, { x: 20, y: 18, char: ',' },
  // el muelle este de la laguna, entero
  { x: 38, y: 28, char: 'B' }, { x: 39, y: 28, char: 'B' },
  { x: 38, y: 29, char: 'B' }, { x: 39, y: 29, char: 'B' },
];

// ---------------- CUMBRES HELADAS (50×42) ----------------
// Nieve ('S'), lago helado ('i') al centro-sur, pinos nevados ('p'),
// cordillera al norte ('R') con la meseta del altar. Entrada por el sur.

function buildCumbres(): string[] {
  const W = 50, H = 42;
  const g = grid(W, H, 'S');
  borderForest(g, 2, 'p');            // pinnedos en los bordes
  // cordillera norte
  rect(g, 2, 2, 46, 4, 'R');
  // meseta del altar del Eco de las Cumbres, abierta en la roca
  rect(g, 21, 2, 8, 5, '=');
  // abertura sur: entrada desde el Bosque Susurrante (x24..26, y40..41)
  rect(g, 24, 40, 3, 2, '=');
  pathV(g, 34, 40, 24); pathV(g, 34, 40, 25);
  // paso de montaña serpenteante
  pathH(g, 12, 25, 34);
  pathV(g, 20, 34, 12);
  pathH(g, 12, 24, 20);
  pathV(g, 8, 20, 23); pathV(g, 8, 20, 24);
  pathH(g, 26, 40, 20);
  pathV(g, 20, 30, 40);
  pathH(g, 34, 40, 30);
  // lago helado al centro-sur
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - 30) / 6, dy = (y - 30) / 4;
    if (dx * dx + dy * dy < 1) set(g, x, y, 'i');
  }
  // hoguera apagada de los pastores (anillo de piedras)
  rectOutline(g, 8, 33, 3, 3, 'R');
  // pinos nevados y rocas sueltas
  scatter(g, 2, 2, 47, 39, 'p', 0.08, 611, (x, y) => g[y][x] !== 'S');
  scatter(g, 2, 2, 47, 39, 'R', 0.025, 612, (x, y) => g[y][x] !== 'S');
  // despejar coordenadas clave
  const clearKey: [number, number][] = [
    [27, 37], [26, 37], [27, 38],                                   // ivo
    [5, 7], [6, 7], [43, 30], [42, 30], [43, 29], [27, 4],          // cofres
    [11, 19], [23, 30], [22, 30], [36, 12],                         // ecos
    [27, 39], [7, 34], [6, 34],                                     // carteles
    [14, 24], [13, 24], [14, 23], [14, 25],                         // santuario
    [15, 15], [33, 12], [38, 20], [12, 30], [18, 36], [35, 34],     // spawns
    [24, 8], [25, 8], [9, 34],                                      // jefe y hoguera
  ];
  for (const [x, y] of clearKey) {
    const c = g[y][x];
    if (c === 'p' || c === 'R') set(g, x, y, 'S');
  }
  return toRows(g);
}

const cumbresDiffs: EpochDiff[] = [
  // el camino al altar estaba empedrado: los pastores subían a cantar por turnos
  { x: 22, y: 7, char: '=' }, { x: 23, y: 7, char: '=' }, { x: 24, y: 7, char: '=' },
  { x: 25, y: 7, char: '=' }, { x: 26, y: 7, char: '=' },
  // flores abrigadas junto a la hoguera: el pasado aún tenía calor
  { x: 12, y: 33, char: ',' }, { x: 13, y: 35, char: ',' },
  { x: 7, y: 32, char: ',' }, { x: 11, y: 36, char: ',' },
];

// ---------------- Definición completa del Acto II ----------------

export const EXPANSION_MAPS: Record<'costa' | 'aldea' | 'cumbres', MapDef> = {
  costa: {
    id: 'costa',
    name: 'Costa de Bruma',
    subtitle: 'Donde el mar guarda las notas · Zona 10–16',
    w: 52, h: 40,
    rows: buildCosta(),
    epochDiffs: costaDiffs,
    music: 'costa',
    npcs: [
      { id: 'mara', x: 7, y: 19, sprite: 'maelis', name: 'Mara, la farera' },
      { id: 'vult', x: 30, y: 32, sprite: 'corvin', name: 'Vult, cartógrafo de la Liga' },
    ],
    chests: [
      // al final del muelle: solo alcanza quien camine sobre el ayer
      { id: 'co1', x: 29, y: 37, gold: 60, potions: 1, needPast: true },
      { id: 'co2', x: 4, y: 15, gold: 35 },
      { id: 'co3', x: 42, y: 29, gold: 40, potions: 1 },
    ],
    echoes: [
      { id: 'co_e1', x: 24, y: 30, title: 'Eco menor · El farero que no se dormía', text: '«La abuela de Mara subía cada noche a encender la lámpara cantando, una nota por vuelta de engranaje. Cuando el canto del dios murió, la lámpara siguió girando... pero la luz aprendió a temblar. Los barcos ya no buscan fuego en la costa: buscan permiso para volver.»' },
      { id: 'co_e2', x: 37, y: 19, title: 'Eco menor · Los barcos sin canción', text: '«Antes, las tripulaciones cantaban al doblar el cabo y el mar respondía liso como zinc. Ahora cruzan en silencio y la Niebla Muda las apunta una a una en su lista de nombres. El mar guarda las notas que faltan: por algo todavía susurra.»' },
      { id: 'co_e3', x: 11, y: 25, title: 'Eco menor · La marea que borra nombres', text: '«El mar fue el primer archivo de Aelthar: cada ola leía un nombre en voz baja para que el dios-tejedor lo bordara en su canto. La noche del asesinato, la marea subió más que nunca y, desde entonces, borra en vez de leer. La que duerme en el naufragio sabe dónde fueron a parar los nombres.»' },
    ],
    spawns: [
      // 10-b (balance): 6 spawns regulares — zona de entrada del Acto II, la
      // más amable. Verificado: nada a menos de 20 tiles de la entrada norte
      // (26,2); el spawn más cercano está en (24,26), no hace falta realojar.
      { type: 'neumo', x: 12, y: 32, patrol: 3, zone: 'costa' },
      { type: 'neumo', x: 20, y: 34, patrol: 3, zone: 'costa' },
      { type: 'neumo', x: 33, y: 32, patrol: 3, zone: 'costa' },
      { type: 'neumo', x: 38, y: 30, patrol: 3, zone: 'costa' },
      { type: 'espectro', x: 14, y: 22, zone: 'costa' },
      { type: 'espectro', x: 24, y: 26, zone: 'costa' },
      // JEFA: la Sirena Abisal, junto a su naufragio
      { type: 'sirena', x: 39, y: 24, zone: 'boss' },
    ],
    exits: [
      // aterrizaje en lunaris (26,35): camino '=', fuera de la zona de salida sur
      { x: 25, y: 0, w: 3, h: 2, to: 'lunaris', tx: 26, ty: 35, label: 'Valle de Lunaris' },
      // aterrizaje en aldea (3,18): camino '=', fuera de la zona de salida oeste
      { x: 50, y: 17, w: 2, h: 4, to: 'aldea', tx: 3, ty: 18, label: 'Aldea de Merrow' },
    ],
    props: [
      { id: 'sanc_co', kind: 'sanctuary', x: 22, y: 21 },
      { id: 'faro_co', kind: 'faro', x: 6, y: 18 },
      { id: 'wreck_co', kind: 'wreck', x: 41, y: 22 },
      { id: 'altar_mareas', kind: 'altarEcho', x: 36, y: 27 },
      { id: 'sign_co1', kind: 'sign', x: 23, y: 3, label: '«Costa de Bruma. Al sur y al este, el mar. Todavía susurra con voz prestada: no le respondas con tu nombre.»' },
      { id: 'sign_co2', kind: 'sign', x: 25, y: 31, label: '«Muelle viejo de Merrow. En pie solo cuando el ayer lo sostiene.»' },
    ],
  },

  aldea: {
    id: 'aldea',
    name: 'Aldea de Merrow',
    subtitle: 'La que la Niebla borró · Zona 12–16',
    w: 44, h: 34,
    rows: buildAldea(),
    epochDiffs: aldeaDiffs,
    music: 'aldea',
    npcs: [
      { id: 'mera', x: 22, y: 16, sprite: 'nimue', name: 'Espectro de Merrow' },
    ],
    chests: [
      // el botín del festival solo existe en el pueblo vivo
      { id: 'a1', x: 10, y: 23, gold: 60, potions: 2, needPast: true },
      { id: 'a2', x: 32, y: 9, gold: 30 },
    ],
    echoes: [
      { id: 'al_e1', x: 23, y: 14, title: 'Eco menor · El nombre que nadie dice', text: '«Merrow no es su nombre. Es el que quedó cuando la Niebla borró el verdadero, como quien roba un pañuelo y deja la mano fría. Los espectros caminan la plaza esperando que alguien les diga cómo se llamaban. Tú también has olvidado cosas, Portador. La Niebla trabaja despacio.»' },
      { id: 'al_e2', x: 6, y: 19, title: 'Eco menor · Los faroles del Recuerdo', text: '«Los faroles de Merrow no se encendían con fuego: se encendían con nombres dichos en voz alta, uno por farol, uno por familia. Tres siguen esperando en el ayer. Enciéndelos allí y acaso el presente aprenda otra vez a iluminarse.»' },
    ],
    spawns: [
      // en el pasado el pueblo estaba vivo: los espectros son del presente
      { type: 'espectro', x: 9, y: 12, zone: 'aldea', needPresent: true },
      { type: 'espectro', x: 33, y: 12, zone: 'aldea', needPresent: true },
      { type: 'espectro', x: 14, y: 22, zone: 'aldea', needPresent: true },
      { type: 'espectro', x: 30, y: 21, zone: 'aldea', needPresent: true },
      { type: 'neumo', x: 16, y: 8, zone: 'aldea' },
      { type: 'neumo', x: 27, y: 29, zone: 'aldea' },
    ],
    exits: [
      // aterrizaje en costa (47,18): calzada '=', fuera de la zona de salida este
      { x: 0, y: 16, w: 2, h: 4, to: 'costa', tx: 47, ty: 18, label: 'Costa de Bruma' },
    ],
    props: [
      { id: 'sanc_a', kind: 'sanctuary', x: 17, y: 21 },
      // Faroles del Recuerdo: se encienden en el pasado (interacción futura del motor)
      { id: 'lamp1', kind: 'lamp', x: 13, y: 13, needPast: true },
      { id: 'lamp2', kind: 'lamp', x: 28, y: 14, needPast: true },
      { id: 'lamp3', kind: 'lamp', x: 20, y: 22, needPast: true },
      { id: 'sign_al1', kind: 'sign', x: 5, y: 16, label: '«Aldea de Merrow. Pregunta por cualquiera: la Niebla respondió por todos.»' },
      { id: 'sign_al2', kind: 'sign', x: 26, y: 20, label: '«Los Faroles del Recuerdo no se encienden con fuego. Se encienden con nombres, y solo en el ayer.»' },
    ],
  },

  cumbres: {
    id: 'cumbres',
    name: 'Cumbres Heladas',
    subtitle: 'El frío que aprendió a escuchar · Zona 14–20',
    w: 50, h: 42,
    rows: buildCumbres(),
    epochDiffs: cumbresDiffs,
    music: 'cumbres',
    npcs: [
      { id: 'ivo', x: 27, y: 37, sprite: 'brokk', name: 'Ivo, cazador de cumbres' },
    ],
    chests: [
      { id: 'cu1', x: 5, y: 7, gold: 50 },
      { id: 'cu2', x: 43, y: 30, gold: 40, potions: 1 },
      { id: 'cu3', x: 27, y: 4, gold: 60 },
    ],
    echoes: [
      { id: 'cu_e1', x: 11, y: 19, title: 'Eco menor · El invierno del silencio', text: '«Hubo un invierno en que la Niebla subió a las cumbres a buscar las últimas voces libres. Los pastores dejaron de cantar para esconderlas, y el frío las guardó mejor que ellos: bajo el hielo aún se oyen, si sabes escuchar de rodillas.»' },
      { id: 'cu_e2', x: 23, y: 30, title: 'Eco menor · Los turnos de canto', text: '«Los pastores de las Cumbres cantaban por turnos: uno dormía y otro velaba su voz, para que el silencio no encontrara a nadie solo. La última noche cantaron todos a la vez. Nadie recuerda quién quedó para el alba, y la montaña, que todo lo escucha, no lo quiere decir.»' },
      { id: 'cu_e3', x: 36, y: 12, title: 'Eco menor · Las voces bajo el hielo', text: '«El lago no congela agua: congela coros. Los que la Niebla atrapó durante la huida quedaron suspendidos boca arriba, mirando el cielo desde debajo. En los deshielos breves piden ayuda... en armonía. El Gólem los cuenta cada noche, como un pastor cuenta ovejas.»' },
    ],
    spawns: [
      // 10-b (balance): las Cumbres deben superar a la Costa en densidad
      // (8 spawns regulares vs 6): 4 arpías, 2 lobos, 2 espectros. Los nuevos
      // pisan tiles '=' del camino (la dispersión de pinos nunca los toca).
      { type: 'arpi', x: 15, y: 15, patrol: 4, zone: 'cumbres' },
      { type: 'arpi', x: 33, y: 12, patrol: 4, zone: 'cumbres' },
      { type: 'arpi', x: 38, y: 20, patrol: 4, zone: 'cumbres' },
      { type: 'arpi', x: 30, y: 20, patrol: 4, zone: 'cumbres' },  // 10-b: cruce este del paso
      { type: 'lobo', x: 12, y: 30, zone: 'cumbres' },
      { type: 'lobo', x: 18, y: 36, zone: 'cumbres' },
      { type: 'espectro', x: 35, y: 34, zone: 'cumbres' },
      { type: 'espectro', x: 40, y: 26, zone: 'cumbres' },         // 10-b: guarda el tesoro del este
      // JEFE: el Gólem de Escarcha, guardián del paso al altar
      { type: 'golem', x: 24, y: 8, zone: 'boss' },
    ],
    exits: [
      // aterrizaje en bosque (51,7): plataforma '=', fuera de la zona de salida este
      { x: 24, y: 40, w: 3, h: 2, to: 'bosque', tx: 51, ty: 7, label: 'Bosque Susurrante' },
    ],
    props: [
      { id: 'sanc_cu', kind: 'sanctuary', x: 14, y: 24 },
      { id: 'altar_cumbres', kind: 'altarEcho', x: 24, y: 3 },
      { id: 'sign_cu1', kind: 'sign', x: 27, y: 39, label: '«Paso de las Cumbres. Más arriba el aire corta los nombres por la mitad. Llévalos cerca del pecho.»' },
      { id: 'sign_cu2', kind: 'sign', x: 7, y: 34, label: '«Hoguera de los pastores. Cantaban por turnos para no velar su voz en soledad. Nadie canta ya la última estrofa.»' },
    ],
  },
};
