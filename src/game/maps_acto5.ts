// ============================================================
// ECOS DE AELTHAR — R13 «La carta» · Mapa del Acto V fase 1
// LA CUNA DEL CANTO (46×36) · Zona 18–24
// El sótano del mundo: debajo de donde el dios aprendió a cantar
// está donde el dios aprendió a callar. La Niebla no entró aquí
// porque no había nada que comer: no hay ayeres donde nadie vivió.
//
// CONTRATO DE ÉPOCA TERNARIA (R13):
//  · baseEpoch: 'aun' — las filas base son el tiempo SIN estrenar
//    (piedra desnuda, sin flora, sin fauna). tileAt aplica los
//    epochDiffs al aterrizar en 'presente': el mapa ESTRENA su
//    primer día (flores, musgo, primeros neumos).
//  · Q en la Cuna alterna 'aun' ↔ 'presente' (nunca 'pasado').
//  · La Cuna no tiene Niebla: en 'aun' el aire solo suena si
//    sabes caminar al ritmo (acto5.ts).
//
// NOTA DE CONTRATO (igual que maps_expansion): helpers de generación
// duplicados a propósito; los tiles reutilizan sprites existentes
// ('#' ':' '=' 'P' 'x' 'R' '~' ',' '.') — el acabado cristalino
// lo dibuja el agente visual (patrón Ronda 12: el motor no toca arte).
// ============================================================

import type { MapDef, MapId, EpochDiff } from './types';

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

function pathH(g: Grid, x0: number, x1: number, y: number, ch = '=') {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (let x = a; x <= b; x++) set(g, x, y, ch);
}

function pathV(g: Grid, y0: number, y1: number, x: number, ch = '=') {
  const a = Math.min(y0, y1), b = Math.max(y0, y1);
  for (let y = a; y <= b; y++) set(g, x, y, ch);
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

function toRows(g: Grid): string[] { return g.map(r => r.join('')); }

// Coordenadas clave (NPC-free, pero cofres/ecos/spawns/signs/santuario/
// fragmento/aterrizajes): se despejan al final como en maps_expansion.
const CUNA_CLEAR: [number, number][] = [
  [23, 5], [22, 2], [23, 2], [24, 2],           // escalera de la Sala + aterrizaje
  [23, 8], [23, 9], [24, 9],                    // corredor de entrada + cartel 1
  [23, 17], [23, 16], [23, 18],                 // fragmento y acceso al díaz
  [12, 25], [12, 26],                           // santuario y aterrizaje
  [10, 12], [10, 13],                           // cofre cn1
  [36, 21], [36, 20],                           // cofre cn2 (el del primer día)
  [28, 22],                                     // cartel del lago
  [20, 17],                                     // cartel de las ondas
  [23, 12], [36, 12], [12, 18],                 // ecos menores
  [17, 22], [28, 21], [25, 26],                 // neumos del primer día
];

/**
 * LA CUNA DEL CANTO — caverna de cristal, piedra desnuda en 'aun'.
 *  · Escalera de la Sala al norte (única puerta: vuelve a la Cripta).
 *  · Cámara central con el díaz del segundo Fragmento (ondas de piedra 'P'
 *    en elipses concéntricas: las primeras notas, petrificadas al pasar).
 *  · Lago de cristal al sudeste: en 'aun' es piedra; el agua también espera.
 *  · Santuario del Eco al suroeste (el único santuario nuevo del acto).
 * Devuelve filas Y diffs: los diffs del «primer día» solo se fijan sobre
 * tiles caminables de la base (garantía estructural, no por coordenada).
 */
function buildCuna(): { rows: string[]; diffs: EpochDiff[] } {
  const W = 46, H = 36;
  const aguaNace: EpochDiff[] = []; // diffs '~' del vaso del lago (el agua nace con el primer día)
  const g: Grid = [];
  for (let y = 0; y < H; y++) { const row: string[] = []; for (let x = 0; x < W; x++) row.push('#'); g.push(row); }
  // ---- cámara central (x8..37, y10..27) ----
  rect(g, 8, 10, 30, 18, ':');
  // ---- escalera de la Sala (x21..25, y2..7): única puerta ----
  rect(g, 21, 2, 5, 6, ':');
  pathV(g, 8, 10, 23); pathV(g, 8, 10, 24);       // corredor escalera → cámara
  // ---- caminos principales: cruz sobre el pedestal ----
  pathV(g, 11, 27, 23); pathV(g, 11, 27, 24);
  pathH(g, 9, 37, 18);
  // ---- ramal al santuario (suroeste) ----
  pathV(g, 19, 25, 12);
  pathH(g, 12, 22, 25);
  // ---- ramal al cofre del oeste ----
  pathH(g, 10, 22, 13);
  pathV(g, 13, 17, 10);
  // ---- ramal este (cofre del primer día) ----
  pathH(g, 25, 36, 20);
  pathV(g, 20, 21, 36);
  // ---- elipses de ondas de piedra ('P', SÓLIDO): las primeras notas ----
  // anillo interior alrededor del pedestal (23,17)
  const ONDAS: [number, number][] = [
    [18, 15], [19, 14], [21, 12], [25, 13], [27, 14], [28, 15],
    [18, 20], [19, 21], [21, 22], [25, 22], [27, 21], [28, 20],
  ];
  for (const [x, y] of ONDAS) set(g, x, y, 'P');
  // anillo exterior parcial (la onda se pierde en las paredes)
  const ONDAS_EXT: [number, number][] = [
    [15, 12], [16, 11], [30, 12], [31, 13],
    [15, 23], [16, 24], [30, 24], [31, 23],
  ];
  for (const [x, y] of ONDAS_EXT) set(g, x, y, 'P');
  // pilares pequeños junto a la escalera (balaustrada de piedra)
  set(g, 21, 7, 'x'); set(g, 25, 7, 'x');
  // ---- el lago de cristal (sudeste): PIEDRA en 'aun'. El agua NO existe
  // todavía: cada tile del vaso queda apuntado como diff '~' — el lago
  // NACE con el primer día (estrenar el presente también lo estrena a él).
  // Orilla oeste marcada con '=' para que se lea como camino en ambas épocas.
  const LCX = 33, LCY = 25, RX = 4.5, RY = 2.8;
  for (let y = 22; y <= 28; y++) {
    for (let x = 28; x <= 38; x++) {
      const dx = (x - LCX) / RX, dy = (y - LCY) / RY;
      if (dx * dx + dy * dy < 1) {
        set(g, x, y, ':');
        if (x >= 30) aguaNace.push({ x, y, char: '~' }); // el vaso se llenará al estrenar
        if (x <= 29) set(g, x, y, '=');
      }
    }
  }
  // ---- rocas sueltas (textura; nunca sobre coordenadas clave) ----
  scatter(g, 9, 11, 37, 27, 'R', 0.03, 711, (x, y) => g[y][x] !== ':');
  // ---- despejar coordenadas clave (solo sustituye decoración) ----
  for (const [x, y] of CUNA_CLEAR) {
    const c = g[y][x];
    if (c === 'P' || c === 'R' || c === 'x') set(g, x, y, ':');
  }
  // ---- diffs del PRIMER DÍA: solo sobre tiles caminables de la base ----
  const CANDIDATOS: [number, number, string][] = [
    // alrededor del díaz: las primeras flores del mundo
    [21, 14, ','], [25, 14, ','], [20, 19, ','], [26, 19, ','], [23, 20, ','],
    [22, 19, ','], [24, 19, ','],
    // a lo largo de los caminos: musgo y hierba recién inventada
    [23, 9, ','], [24, 9, ','], [23, 25, ','], [24, 25, ','],
    [18, 18, ','], [28, 18, ','], [12, 22, ','], [22, 6, ','],
    // orilla del lago: musgo donde mañana habrá agua (solo tiles fuera del vaso)
    [28, 23, ','], [28, 26, '.'], [29, 22, '.'],
    // junto al cofre del primer día: algo floreció donde nadie miraba
    [35, 20, ','], [36, 22, '.'],
  ];
  const diffs: EpochDiff[] = [];
  diffs.push(...aguaNace); // el lago: primero el agua, después las flores
  for (const [x, y, ch] of CANDIDATOS) {
    if (g[y]?.[x] === ':' || g[y]?.[x] === '=') diffs.push({ x, y, char: ch });
  }
  return { rows: toRows(g), diffs };
}

const cuna = buildCuna();

// ---------------- Definición del mapa del Acto V fase 1 ----------------

export const ACTO5_MAPS: Record<'cuna', MapDef> = {
  cuna: {
    id: 'cuna' as unknown as MapId, // R13: MapId ya lista 'cuna' en types.ts; cast documentado por simetría con ARENA_MAP_ID
    name: 'La Cuna del Canto',
    subtitle: 'El sótano del mundo · Zona 18–24',
    w: 46, h: 36,
    rows: cuna.rows,
    baseEpoch: 'aun',            // R13: la época ternaria nace aquí (los mapas viejos jamás la ven)
    epochDiffs: cuna.diffs,      // el «primer día»: se aplican al aterrizar en 'presente'
    dark: false,                 // la Cuna no conoce la oscuridad: el Canto original la ilumina
    music: 'crypt',              // el mismo cántico de piedra de la Cripta, un piso más abajo
    npcs: [],                    // la Cuna habla por ecos y carteles (Naia llega con la Ciudadela, R14)
    chests: [
      { id: 'cn1', x: 10, y: 12, gold: 90 },                              // la espera guardó algo
      // el cofre del primer día: solo existe una vez que el tiempo se estrena
      { id: 'cn2', x: 36, y: 21, gold: 120, potions: 1, needPresent: true },
    ],
    echoes: [
      {
        id: 'cn_e1', x: 23, y: 12, title: 'Eco menor · La escalera que baja dos veces',
        text: '«Los peregrinos contaban que la Sala del Primer Canto tenía dos pisos: arriba se enseñaba el canto a los que iban a nacer; abajo, el silencio a los que ya se habían ido. La escalera de abajo no estaba prohibida: estaba ESPERANDO. Bajó poca gente. Los que bajaron decían oír lo contrario de una canción: una canción que aún no empieza.»',
      },
      {
        id: 'cn_e2', x: 36, y: 12, title: 'Eco menor · Las ondas de piedra',
        text: '«Nadie talló estas ondas: se quedaron así cuando el Canto pasó por aquí, tan lento que un siglo por nota. Los canteros venían a aprender curvatura, y se iban sabiendo paciencia. Si cuentas los anillos como en un árbol, hay uno por cada año del mundo... y el último anillo está SIN CERRAR.»',
      },
      {
        id: 'cn_e3', x: 12, y: 18, title: 'Eco menor · El lago que no ha existido aún',
        text: '«El agua de la Cuna no refleja: espera. Es la única agua del mundo que nunca ha tenido un mañana que reflejar, así que guarda la superficie lisa como un semblante antes del primer nombre. Cuando el tiempo se estrene aquí, el lago verá el cielo por primera vez... y le dará la contraria en todo.»',
      },
    ],
    spawns: [
      // los primeros habitantes: neumos que SOLO existen cuando el tiempo se
      // estrena (needPresent). En 'aun' la Cuna está vacía: no hay ayeres
      // donde nadie vivió, y no hay nada vivo donde nadie ha nacido.
      { type: 'neumo', x: 17, y: 22, patrol: 2, zone: 'cuna', needPresent: true },
      { type: 'neumo', x: 28, y: 21, patrol: 2, zone: 'cuna', needPresent: true },
      { type: 'neumo', x: 25, y: 26, patrol: 2, zone: 'cuna', needPresent: true },
    ],
    exits: [
      // la escalera vuelve a la Sala del Primer Canto; aterriza dentro de la
      // Sala (19,6), FUERA de la zona de salida cripta→cuna (x18..20, y2)
      { x: 22, y: 2, w: 3, h: 1, to: 'cripta', tx: 19, ty: 6, label: 'Sala del Primer Canto' },
    ],
    props: [
      { id: 'sanc_cn', kind: 'sanctuary', x: 12, y: 25 },
      // EL SEGUNDO FRAGMENTO: desbloquea el pulso Q en la Cuna (aun ↔ presente)
      { id: 'fragmento_cn', kind: 'fragment2', x: 23, y: 17 },
      { id: 'sign_cn1', kind: 'sign', x: 23, y: 8, label: '«La Cuna del Canto. Debajo de donde el dios aprendió a cantar está donde aprendió a callar. Aquí el aire solo suena si sabes caminar al ritmo.»' },
      { id: 'sign_cn2', kind: 'sign', x: 28, y: 22, label: '«El lago de cristal no ha existido todavía: espera su primer día. Todo lo que la Cuna guarda está a la espera.»' },
      { id: 'sign_cn3', kind: 'sign', x: 20, y: 17, label: '«Las ondas de piedra son las primeras notas. Nadie las talló: se quedaron así cuando el Canto pasó por aquí, tan lento que un siglo por nota.»' },
    ],
  },
};
