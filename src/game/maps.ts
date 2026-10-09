// ============================================================
// ECOS DE AELTHAR — Mapas del mundo
// Valle de Lunaris · Bosque Susurrante · Cripta del Primer Canto
// Generación determinista (sin azar de ejecución)
// ============================================================

import type { MapDef, MapId, EpochDiff, Epoch } from './types';
import { EXPANSION_MAPS } from './maps_expansion';

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

// ---------------- LUNARIS (52×38) ----------------

function buildLunaris(): string[] {
  const W = 52, H = 38;
  const g = grid(W, H, '.');
  borderForest(g, 2, 't');
  // abertura norte hacia el bosque
  rect(g, 23, 0, 6, 2, '=');
  pathV(g, 2, 15, 25); pathV(g, 2, 15, 26);
  // plaza central de piedra
  rect(g, 21, 15, 10, 7, ':');
  rect(g, 22, 14, 8, 1, ':');
  // casas
  house(g, 7, 9, 5, 9);      // casa de Brisa (puerta 9,10)
  house(g, 32, 9, 5, 34);    // forja de Toln (puerta 34,10)
  house(g, 7, 27, 5, 9);     // casa este? oeste sur
  house(g, 32, 27, 5, 34);   // casa sur
  // caminos a puertas
  pathV(g, 10, 11, 9); pathH(g, 9, 25, 11);
  pathV(g, 10, 11, 34); pathH(g, 26, 34, 11);
  pathV(g, 28, 29, 9); pathH(g, 9, 25, 29);
  pathV(g, 28, 29, 34); pathH(g, 26, 34, 29);
  pathV(g, 12, 15, 9); pathV(g, 12, 15, 34);
  // granja
  rectOutline(g, 14, 23, 8, 6, 'F');
  rect(g, 15, 24, 6, 4, 'c');
  set(g, 17, 23, 'c'); set(g, 18, 23, '=');
  // pozo y memoria
  set(g, 20, 16, 'w');
  set(g, 17, 20, 'g'); set(g, 18, 20, 'g');
  // estanque
  for (let y = 0; y < 38; y++) for (let x = 0; x < 52; x++) {
    const dx = (x - 42) / 4.4, dy = (y - 26) / 3.2;
    if (dx * dx + dy * dy < 1) set(g, x, y, '~');
  }
  // rocas y flores
  set(g, 6, 31, 'R'); set(g, 44, 12, 'R'); set(g, 16, 6, 'R'); set(g, 46, 33, 'R');
  // cobertizo en ruinas (desaparece en el pasado) + cofre detrás
  set(g, 5, 26, 'R'); set(g, 6, 26, 'R'); set(g, 5, 25, 'R');
  scatter(g, 3, 3, 48, 34, ',', 0.055, 101, (x, y) => g[y][x] !== '.');
  scatter(g, 3, 31, 22, 35, 'm', 0.06, 77, (x, y) => g[y][x] !== '.');
  scatter(g, 3, 3, 20, 7, 'p', 0.10, 55, (x, y) => g[y][x] !== '.');
  // abertura sur hacia la Costa de Bruma (Acto II): x25..27, y36..37
  rect(g, 25, 36, 3, 2, '=');
  pathV(g, 30, 35, 25); pathV(g, 30, 35, 26);
  return toRows(g);
}

// ---------------- BOSQUE (56×44) ----------------

function buildBosque(): string[] {
  const W = 56, H = 44;
  const g = grid(W, H, '.');
  borderForest(g, 2, 't');
  // abertura sur (vuelta a Lunaris)
  rect(g, 24, 42, 6, 2, '=');
  // río
  rect(g, 0, 10, 56, 3, '~');
  for (let x = 0; x < 56; x++) {
    if (g[9][x] === 't') continue;
    if ((x * 13 + 5) % 7 < 2) set(g, x, 9, ',');
    if ((x * 7 + 3) % 8 < 2) set(g, x, 13, ',');
  }
  // puente principal (roto en el presente)
  rect(g, 25, 10, 2, 3, 'x');
  pathV(g, 13, 14, 25); pathV(g, 13, 14, 26);
  pathV(g, 2, 9, 25); pathV(g, 2, 9, 26);
  // pinos
  scatter(g, 2, 2, 53, 41, 'p', 0.17, 202, (x, y) => g[y][x] !== '.');
  // camino serpenteante al sur (entrada → ruina)
  pathV(g, 36, 41, 27);
  pathH(g, 27, 40, 36);
  pathV(g, 30, 36, 40);
  pathH(g, 40, 43, 30);
  pathV(g, 29, 30, 43);
  // ruina antigua
  rect(g, 36, 20, 12, 9, ':');
  set(g, 36, 20, 'P'); set(g, 47, 20, 'P'); set(g, 36, 28, 'P'); set(g, 47, 28, 'P');
  set(g, 39, 23, 'g'); set(g, 44, 26, 'g');
  pathH(g, 26, 40, 24);   // del puente a la ruina
  pathH(g, 43, 25, 24);   // tramo oeste
  // niebla muda que bloquea el camino norte (se disipa en el pasado)
  rect(g, 23, 6, 6, 2, 'n');
  // entrada de la cripta (noroeste)
  rect(g, 6, 1, 9, 1, '#');
  rect(g, 6, 2, 1, 3, '#'); rect(g, 14, 2, 1, 3, '#');
  rect(g, 7, 2, 7, 2, ':');
  rect(g, 7, 4, 7, 1, '#');
  rect(g, 9, 4, 3, 1, '=');
  set(g, 10, 3, 'A');
  // decoración
  set(g, 12, 20, 'R'); set(g, 30, 33, 'R'); set(g, 50, 30, 'R');
  scatter(g, 2, 14, 53, 41, ',', 0.05, 303, (x, y) => g[y][x] !== '.');
  scatter(g, 2, 14, 53, 41, 'm', 0.035, 404, (x, y) => g[y][x] !== '.');
  // abertura este hacia las Cumbres Heladas (Acto II): x54..55, y6..8.
  // El camino va por y=8 para no cruzar la Niebla Muda (y6..7) ni el río.
  pathH(g, 27, 54, 8);
  rect(g, 53, 6, 3, 3, '=');
  // plataforma de aterrizaje para quien vuelve de las Cumbres (51,7)
  rect(g, 50, 7, 3, 2, '=');
  return toRows(g);
}

// ---------------- CRIPTA (40×34) ----------------

function buildCripta(): string[] {
  const W = 40, H = 34;
  const g = grid(W, H, 'V');
  rect(g, 1, 1, 38, 32, '#');
  // sala del altar (norte)
  rect(g, 15, 2, 10, 5, ':');
  // pasillo central
  rect(g, 18, 7, 4, 22, ':');
  // arena del jefe
  rect(g, 10, 12, 20, 10, ':');
  // nicho del santuario
  rect(g, 16, 22, 8, 4, ':');
  // salas laterales
  rect(g, 6, 24, 8, 5, ':');
  rect(g, 26, 24, 8, 5, ':');
  pathH(g, 14, 18, 26); pathH(g, 23, 26, 26);
  pathV(g, 12, 14, 19); pathV(g, 12, 14, 20);
  pathV(g, 7, 12, 19); pathV(g, 7, 12, 20);
  // entrada sur
  rect(g, 18, 29, 4, 3, ':');
  // pilares decorativos
  set(g, 12, 14, 'P'); set(g, 27, 14, 'P'); set(g, 12, 19, 'P'); set(g, 27, 19, 'P');
  return toRows(g);
}

// ---------------- Diffs de época ----------------

const lunarisDiffs: EpochDiff[] = [
  // las lápidas se convierten en flores: nadie murió aún en el pasado
  { x: 17, y: 20, char: ',' }, { x: 18, y: 20, char: ',' },
  // el cobertizo está en pie: desaparecen las ruinas
  { x: 5, y: 26, char: '.' }, { x: 6, y: 26, char: '.' }, { x: 5, y: 25, char: '.' },
  // el pueblo celebra el Festival del Canto: flores y hierba alta
  { x: 24, y: 16, char: ',' }, { x: 27, y: 18, char: ',' }, { x: 23, y: 19, char: ',' },
  { x: 28, y: 15, char: ',' }, { x: 22, y: 20, char: ',' }, { x: 29, y: 20, char: ',' },
  { x: 24, y: 21, char: ',' }, { x: 27, y: 21, char: ',' },
  // el camino norte está empedrado y cuidado
  { x: 25, y: 3, char: '=' }, { x: 26, y: 3, char: '=' },
];

const bosqueDiffs: EpochDiff[] = [
  // el puente principal está entero en el pasado
  { x: 25, y: 10, char: 'B' }, { x: 26, y: 10, char: 'B' },
  { x: 25, y: 11, char: 'B' }, { x: 26, y: 11, char: 'B' },
  { x: 25, y: 12, char: 'B' }, { x: 26, y: 12, char: 'B' },
  // la Niebla Muda no existía: se disipa
  { x: 23, y: 6, char: '.' }, { x: 24, y: 6, char: '.' }, { x: 25, y: 6, char: '.' },
  { x: 26, y: 6, char: '.' }, { x: 27, y: 6, char: '.' }, { x: 28, y: 6, char: '.' },
  { x: 23, y: 7, char: '.' }, { x: 24, y: 7, char: '.' }, { x: 25, y: 7, char: '.' },
  { x: 26, y: 7, char: '.' }, { x: 27, y: 7, char: '.' }, { x: 28, y: 7, char: '.' },
  // la ruina estaba viva: guirnaldas de flores
  { x: 40, y: 22, char: ',' }, { x: 43, y: 24, char: ',' }, { x: 41, y: 26, char: ',' },
];

// ---------------- Definición completa ----------------

const BASE_MAPS: Record<'lunaris' | 'bosque' | 'cripta', MapDef> = {
  lunaris: {
    id: 'lunaris',
    name: 'Valle de Lunaris',
    subtitle: 'Cuna del Portador · Zona 1–8',
    w: 52, h: 38,
    rows: buildLunaris(),
    epochDiffs: lunarisDiffs,
    music: 'village',
    npcs: [
      { id: 'brisa', x: 23, y: 13, sprite: 'brisa', name: 'Anciana Brisa' },
      { id: 'toln', x: 35, y: 11, sprite: 'toln', name: 'Maestro Toln' },
      // Teo (biblia: niño rescatado de la Niebla) — aparece en cuanto empiezas a
      // empujar la Niebla (primer lobo cazado)
      { id: 'teo', x: 23, y: 20, sprite: 'teo', name: 'Teo', showFlag: 'wolfKills' },
      // Heraldo de la Orden de Vesh (biblia) — aparece tras recuperar el Eco de la Voz
      { id: 'heraldo', x: 28, y: 17, sprite: 'sombra', name: 'Heraldo de Vesh', showFlag: 'ecoVoz' },
    ],
    chests: [
      { id: 'l1', x: 5, y: 24, gold: 40, needPast: true },
      { id: 'l2', x: 48, y: 21, potions: 1, gold: 15 },
      { id: 'l3', x: 30, y: 33, gold: 30 },
      { id: 'l4', x: 6, y: 7, gold: 25 },
    ],
    echoes: [
      { id: 'e1', x: 21, y: 13, title: 'Eco menor · El pozo de los nombres', text: '«Antes de la Noche del Silencio, los aldeanos susurraban sus nombres al pozo para que el dios los tejiera en su canto. Ahora el pozo solo devuelve silencio.»' },
      { id: 'e2', x: 40, y: 31, title: 'Eco menor · La nieta del herrero', text: '«Toln aún forja todas las noches, aunque nadie compra. Dice que el metal recuerda el ritmo del martillo... y que algún día el canto volverá a necesitarlo.»' },
      { id: 'e3', x: 14, y: 17, title: 'Eco menor · Los Guardianes que aún cantan', text: '«Cada noche, tres capellanes subían a la muralla y cantaban las horas para que el valle durmiera sin miedo. Cuando el canto murió, dos callaron. El tercero aún canta: lo hacen las piedras por él, cuando llueve.»' },
    ],
    spawns: [
      { type: 'lobo', x: 13, y: 33, patrol: 4, zone: 'valle' },
      { type: 'lobo', x: 19, y: 34, patrol: 4, zone: 'valle' },
      { type: 'lobo', x: 9, y: 30, patrol: 3, zone: 'valle' },
      { type: 'lobo', x: 34, y: 34, patrol: 4, zone: 'valle' },
    ],
    exits: [
      { x: 23, y: 0, w: 6, h: 2, to: 'bosque', tx: 27, ty: 40, label: 'Bosque Susurrante' },
      // aterrizaje en costa (26,2): camino '=' bajo la abertura norte, fuera de su zona de salida
      { x: 25, y: 36, w: 3, h: 2, to: 'costa', tx: 26, ty: 2, label: 'Costa de Bruma' },
    ],
    props: [
      { id: 'sanc_l', kind: 'sanctuary', x: 25, y: 18 },
      { id: 'forge', kind: 'forge', x: 37, y: 10 },
      { id: 'sign_l', kind: 'sign', x: 29, y: 3, label: '«Al norte: Bosque Susurrante. Cuidado con la Niebla.»' },
      { id: 'sign_l2', kind: 'sign', x: 23, y: 34, label: '«Al sur: la Costa de Bruma. El mar... todavía susurra.»' },
    ],
  },

  bosque: {
    id: 'bosque',
    name: 'Bosque Susurrante',
    subtitle: 'Los árboles recuerdan · Zona 8–15',
    w: 56, h: 44,
    rows: buildBosque(),
    epochDiffs: bosqueDiffs,
    music: 'forest',
    npcs: [
      { id: 'ilwen', x: 16, y: 32, sprite: 'ilwen', name: 'Ilwen', showFlag: 'q2_done' },
      // Doran, druida del Círculo Verde (biblia) — cerca del santuario de la Ruina Antigua
      { id: 'doran', x: 36, y: 24, sprite: 'doran', name: 'Doran' },
    ],
    chests: [
      { id: 'b1', x: 4, y: 40, potions: 2 },
      { id: 'b2', x: 52, y: 38, gold: 35 },
      { id: 'b3', x: 30, y: 14, gold: 20 },
      { id: 'b4', x: 40, y: 4, gold: 60, potions: 1 },
      { id: 'b5', x: 21, y: 2, gold: 45 },
    ],
    echoes: [
      { id: 'b_e1', x: 33, y: 26, title: 'Eco menor · La Madre Espina', text: '«Cuando el canto murió, las raíces del Bosque enloquecieron de dolor. La Madre Espina no es mala: solo tiene roto el corazón.»' },
      { id: 'b_e2', x: 48, y: 12, title: 'Eco menor · El guardián de la niebla', text: '«Los lobos de niebla fueron una vez perros guardianes de Lunaris. Aún patrullan. Ya no saben para qué.»' },
      { id: 'b_e3', x: 12, y: 38, title: 'Eco menor · El primer Portador', text: '«Hubo otros antes que tú. Todos oyeron el primer Eco. Ninguno volvió de la Ciudadela. Prepara tu despedida, Portador.»' },
      { id: 'b_e4', x: 30, y: 24, title: 'Eco menor · La Rebelión de los Sordos', text: '«Hubo un año en que los aldeanos del bosque se taparon los oídos con cera de abejas: "si el canto nos gobernaba, el silencio nos libera". Duraron un invierno. La Niebla los encontró igual: el silencio también se puede robar.»' },
    ],
    spawns: [
      { type: 'lobo', x: 32, y: 36, patrol: 4, zone: 'bosque' },
      { type: 'lobo', x: 20, y: 34, patrol: 4, zone: 'bosque' },
      { type: 'lobo', x: 44, y: 34, patrol: 4, zone: 'bosque' },
      { type: 'lobo', x: 14, y: 20, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 30, y: 16, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 40, y: 14, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 10, y: 30, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 34, y: 5, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 45, y: 7, patrol: 3, zone: 'bosque' },
    ],
    exits: [
      { x: 24, y: 42, w: 6, h: 2, to: 'lunaris', tx: 26, ty: 3, label: 'Valle de Lunaris' },
      { x: 8, y: 2, w: 5, h: 2, to: 'cripta', tx: 19, ty: 30, label: 'Cripta del Primer Canto' },
      // aterrizaje en cumbres (25,39): camino '=' sobre la abertura sur, fuera de su zona de salida
      { x: 54, y: 6, w: 2, h: 3, to: 'cumbres', tx: 25, ty: 39, label: 'Cumbres Heladas' },
    ],
    props: [
      { id: 'sanc_b', kind: 'sanctuary', x: 38, y: 26 },
      { id: 'fragment', kind: 'fragment', x: 41, y: 24 },
      { id: 'sign_b', kind: 'sign', x: 27, y: 41, label: '«Bosque Susurrante. Los caminos cambian con la luz.»' },
      { id: 'sign_c', kind: 'sign', x: 15, y: 5, label: '«Cripta del Primer Canto. Aquí durmió la voz del dios.»' },
      // easter egg Nimue (biblia: hermana de Ilwen, atrapada en la Niebla) — solo en el pasado
      { id: 'sign_nimue', kind: 'sign', x: 25, y: 6, needPast: true, label: 'Las flores del pasado no crecen en círculo por casualidad. Entre las raíces, apenas un hilo de voz que ya no es voz: «...nimue... nimue...» Alguien duerme aquí debajo, y la Niebla la cuida como a una semilla. (Ilwen busca a su hermana... pero jura que no se llamaba así.)' },
      { id: 'sign_b2', kind: 'sign', x: 52, y: 9, label: '«Al este: el paso de las Cumbres. Lleva abrigo, Portador.»' },
    ],
  },

  cripta: {
    id: 'cripta',
    name: 'Cripta del Primer Canto',
    subtitle: 'Fuera del tiempo',
    w: 40, h: 34,
    rows: buildCripta(),
    epochDiffs: [],
    dark: true,
    music: 'crypt',
    npcs: [
      // 16-a: La Guarda del Primer Canto — el tercer capellán que no calló,
      // atado a la piedra de la Cripta. Solo aparece cuando el tercer canto
      // terminó (acto3Done): custodia la puerta de la Sala (misiones q15).
      { id: 'guarda', x: 21, y: 24, sprite: 'kael', name: 'La Guarda del Primer Canto', showFlag: 'acto3Done' },
    ],
    chests: [
      { id: 'c1', x: 28, y: 25, gold: 50 },
      { id: 'c2', x: 7, y: 25, potions: 2 },
    ],
    echoes: [
      { id: 'c_e1', x: 27, y: 13, title: 'Eco menor · El eco del guardián', text: '«El Guardián Hueco fue el primer coro de Aelthar. Cuando el dios calló, el coro siguió cantando... hasta que su propia voz lo vació por dentro.»' },
      { id: 'c_e2', x: 12, y: 25, title: 'Eco menor · El peregrino', text: '«Cientos peregrinos subieron a oír el Primer Canto. Este dejó su lámpara encendida para el siguiente. Aún arde.»' },
      { id: 'c_e3', x: 24, y: 26, title: 'Eco menor · La Lanza Muda', text: '«Aquí forjaron los Durn la Lanza que mató al dios: una lanza sin canto, sorda de nacimiento, para que el canto del dios no la desviara. Nadie la volvió a ver. Los que la buscaron dicen que sigue silbando en algún rincón del mundo... esperando la segunda vez.»' },
    ],
    spawns: [
      { type: 'esqueleto', x: 10, y: 26, patrol: 3, zone: 'cripta' },
      { type: 'esqueleto', x: 29, y: 27, patrol: 3, zone: 'cripta' },
      { type: 'esqueleto', x: 13, y: 17, patrol: 2, zone: 'cripta' },
      { type: 'guardian', x: 19, y: 8, zone: 'boss' },
    ],
    exits: [
      // destino (10,5): tile libre justo bajo la puerta (x=9..11, y=4) y FUERA
      // de la zona de salida bosque→cripta (x:8..12, y:2..3). El destino antiguo
      // (10,3) era el altar sólido DENTRO de la zona → bucle de teletransporte.
      { x: 18, y: 31, w: 4, h: 3, to: 'bosque', tx: 10, ty: 5, label: 'Bosque Susurrante' },
    ],
    props: [
      { id: 'sanc_c', kind: 'sanctuary', x: 19, y: 23 },
      { id: 'altar_c', kind: 'altarEcho', x: 19, y: 4 },
    ],
  },
};

// Mundo completo: mapa base + expansión del Acto II (Costa, Aldea, Cumbres)
export const MAPS: Record<MapId, MapDef> = { ...BASE_MAPS, ...EXPANSION_MAPS };

// Rellena filas cortas por seguridad
export function mapRows(m: MapDef): string[] {
  const rows: string[] = [];
  for (let y = 0; y < m.h; y++) {
    const r = m.rows[y] ?? '';
    rows.push(r.length >= m.w ? r.slice(0, m.w) : r + '.'.repeat(m.w - r.length));
  }
  return rows;
}

export function tileAt(m: MapDef, rows: string[], tx: number, ty: number, epoch: Epoch): string {
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return 'V';
  if (ty >= rows.length || rows[ty].length === 0) return 'V'; // mapa aún no cargado (intro)
  let ch = rows[ty][tx];
  if (epoch === 'pasado') {
    for (const d of m.epochDiffs) {
      if (d.x === tx && d.y === ty) { ch = d.char; break; }
    }
  }
  return ch;
}
