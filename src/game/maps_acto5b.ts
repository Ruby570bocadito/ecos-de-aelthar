// ============================================================
// ECOS DE AELTHAR — R14 «La Ciudadela» · Mapas del Acto V fase 2
// LA CIUDADELA DE VESH (62×44) + las cuatro salas interiores
// (biblioteca · sala de los nombres · archivo de la Lanza · antecámara)
//
// Canon (docs/history.md §711/§720/§734): murallas que cantan los pasos
// de quien entra; la Orden sobrevivió, envejeció y olvidó por qué espera.
// Sus lanceros son vecinos con lanza. La batalla se gana RECORDANDO:
// cada distrito tiene una verdad que devolver (biblioteca, sala de los
// nombres, archivo de la Lanza) y devolverla baja la guardia sin una
// sola espada — aunque siempre queda la opción mala (forzar la cadena:
// la Orden lo recuerda, rep −).
//
// La Niebla JAMÁS entró aquí (no hay nada que comer: los ayeres se los
// comió la espera) → epochDiffs [] y baseEpoch por defecto: el tiempo
// de la Ciudadela nunca se detuvo. Sin spawns: están habitados, no
// infestados (el «opción mala» es un gesto, no un combate: R15 la abre).
//
// NOTA DE CONTRATO (igual que maps_acto5): tiles reutilizados
// ('#' ':' '=' 'x' 'P' 'R' ',' '.' 'w' 'V') — el acabado visual lo
// dibuja el agente visual (patrón Ronda 12). Helpers de generación
// duplicados a propósito (módulos de mapa autosuficientes).
// ============================================================

import type { MapDef, MapId, EpochDiff } from './types';

type Grid = string[][];

function grid(w: number, h: number, fill: string): Grid {
  const g: Grid = [];
  for (let y = 0; y < h; y++) { const row: string[] = []; for (let x = 0; x < w; x++) row.push(fill); g.push(row); }
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
function scatter(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string, density: number, seed: number, skip: (x: number, y: number) => boolean) {
  let a = seed >>> 0;
  const rng = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (skip(x, y)) continue; if (rng() < density) set(g, x, y, ch); }
}
function toRows(g: Grid): string[] { return g.map(r => r.join('')); }

// Coordenadas clave: se despejan al final (patrón maps_expansion/acto5).
const CIUD_CLEAR: [number, number][] = [
  [31, 40], [30, 39],                          // porteroc + cartel de entrada
  [11, 13], [11, 31], [51, 13],                // las tres verdades (estante/muro/archivo)
  [2, 12], [2, 31], [59, 12], [30, 3],         // las cuatro cadenas (puertas)
  [30, 11], [31, 11],                          // Hueco sur de la torre
  [34, 24], [28, 22], [31, 21],                // santuario, pozo vecino, cartel plaza
  [11, 10], [51, 10], [11, 34],                // lanceros tum/sayo/brume
  [31, 26], [8, 8], [54, 8],                   // ecos menores de la ciudad
  [6, 34], [56, 34],                           // cofres ci1/ci2
  [30, 5],                                     // aterrizaje de vuelta de la antecámara
  [4, 12], [4, 31], [57, 12],                  // aterrizajes de vuelta de las salas
];

/**
 * LA CIUDADELA DE VESH — la ciudad-fortaleza que el juego prometió.
 *  · La muralla 'x' canta los pasos de quien entra (acto5b.ts).
 *  · Tres distritos con su verdad a la vista y su cadena a la espalda.
 *  · La Torre de la Antecámara al norte: el Consejo espera tres verdades.
 *  · Sur: la entrada (el Portador es el primero que VOLVIÓ).
 */
function buildCiudadela(): { rows: string[]; diffs: EpochDiff[] } {
  const W = 62, H = 44;
  const g = grid(W, H, 'V');
  rect(g, 2, 2, 58, 40, '.');                 // interior dentro del borde V
  rectOutline(g, 1, 1, 60, 42, 'x');          // LA MURALLA QUE CANTA
  // ---- puerta sur (la entrada: por aquí se sale, nunca se entró) ----
  rect(g, 29, 41, 4, 2, '=');
  // ---- distritos: patios de piedra clara ----
  rect(g, 4, 6, 15, 11, ':');                 // biblioteca (noroeste)
  rect(g, 44, 6, 15, 11, ':');                // archivo (noreste)
  rect(g, 4, 27, 15, 11, ':');                // nombres (suroeste)
  rect(g, 44, 27, 15, 11, ':');               // barrio de los lanceros (sureste)
  rect(g, 20, 19, 23, 12, ':');               // gran plaza central
  rect(g, 26, 38, 11, 4, ':');                // entrada
  // ---- la Torre de la Antecámara (norte-centro) ----
  rectOutline(g, 26, 3, 11, 9, 'x');
  rect(g, 27, 4, 9, 7, ':');                  // interior de la torre
  set(g, 30, 11, '='); set(g, 31, 11, '=');   // hueco sur de la torre
  rect(g, 30, 3, 2, 1, ':');                  // la puerta del Consejo (al norte)
  // ---- caminos ----
  pathV(g, 19, 31, 31);                       // entrada ↔ plaza
  pathV(g, 14, 19, 31);                       // plaza ↔ torre
  pathV(g, 16, 22, 11); pathH(g, 11, 20, 22); // biblioteca → plaza
  pathV(g, 16, 22, 51); pathH(g, 42, 51, 22); // archivo → plaza
  pathH(g, 11, 20, 28);                       // nombres → plaza
  pathH(g, 42, 51, 28);                       // barrio → plaza
  // ---- las puertas de las salas, talladas en la muralla ----
  rect(g, 2, 12, 1, 2, ':');                  // biblioteca (oeste)
  rect(g, 59, 12, 1, 2, ':');                 // archivo (este)
  rect(g, 2, 31, 1, 2, ':');                  // nombres (suroeste)
  // ---- pozo de la plaza (el agua no canta: escucha) ----
  set(g, 28, 22, 'w');
  // ---- pilares del barrio de los lanceros ----
  set(g, 46, 29, 'P'); set(g, 56, 29, 'P'); set(g, 46, 35, 'P'); set(g, 56, 35, 'P');
  // ---- textura: nunca sobre coordenadas clave ----
  scatter(g, 3, 3, 58, 40, 'R', 0.012, 1414, (x, y) => g[y][x] !== '.');
  scatter(g, 3, 3, 58, 40, ',', 0.05, 1415, (x, y) => g[y][x] !== '.');
  // ---- despejar coordenadas clave (solo sustituye decoración) ----
  for (const [x, y] of CIUD_CLEAR) {
    const c = g[y]?.[x];
    if (c === 'P' || c === 'R' || c === ',' || c === 'x') set(g, x, y, c === 'x' && (y <= 1 || y >= 42 || x <= 1 || x >= 60) ? 'x' : ':');
  }
  return { rows: toRows(g), diffs: [] };      // la Niebla jamás entró: no hay ayeres
}

// ---------------- Las cuatro salas interiores ----------------

/** SALA I · LA BIBLIOTECA DE LA ORDEN — los estantes guardan lo que la espera no pudo comer. */
function buildBiblioteca(): string[] {
  const g = grid(22, 16, '#');
  rect(g, 1, 1, 20, 14, ':');
  rect(g, 4, 3, 4, 1, 'x'); rect(g, 4, 5, 4, 1, 'x'); rect(g, 4, 7, 4, 1, 'x');
  rect(g, 14, 3, 4, 1, 'x'); rect(g, 14, 5, 4, 1, 'x'); rect(g, 14, 7, 4, 1, 'x');
  set(g, 1, 7, ':'); set(g, 1, 8, ':');       // puerta de vuelta a la ciudad
  return toRows(g);
}

/** SALA II · LA SALA DE LOS NOMBRES — los faroles se encienden con nombres dichos en voz alta. */
function buildNombres(): string[] {
  const g = grid(22, 16, '#');
  rect(g, 1, 1, 20, 14, ':');
  set(g, 6, 4, 'P'); set(g, 11, 4, 'P'); set(g, 16, 4, 'P');
  set(g, 6, 11, 'P'); set(g, 16, 11, 'P');
  set(g, 1, 7, ':'); set(g, 1, 8, ':');
  return toRows(g);
}

/** SALA III · EL ARCHIVO DE LA LANZA — la lanza sorda descansa, esperando permiso. */
function buildArchivo(): string[] {
  const g = grid(22, 16, '#');
  rect(g, 1, 1, 20, 14, ':');
  rect(g, 4, 3, 5, 1, 'x'); rect(g, 13, 3, 5, 1, 'x');
  rect(g, 4, 6, 5, 1, 'x'); rect(g, 13, 6, 5, 1, 'x');
  set(g, 1, 7, ':'); set(g, 1, 8, ':');
  return toRows(g);
}

/** LA ANTECÁMARA — la mesa del Consejo y la silla vacía de Vesh. */
function buildAntecamara(): string[] {
  const g = grid(24, 16, '#');
  rect(g, 1, 1, 22, 14, ':');
  rect(g, 10, 6, 4, 3, 'P');                  // la mesa del Consejo (piedra)
  set(g, 1, 7, ':'); set(g, 1, 8, ':');
  return toRows(g);
}

const ciudadela = buildCiudadela();

// ---------------- Definiciones del Acto V fase 2 ----------------

export const ACTO5_MAPS_R14: Record<'ciudadela' | 'biblioteca' | 'nombres' | 'archivo' | 'antecamara', MapDef> = {
  ciudadela: {
    id: 'ciudadela' as unknown as MapId, // R14: MapId ya lista 'ciudadela' en types.ts (cast por simetría con la Cuna)
    name: 'La Ciudadela de Vesh',
    subtitle: 'La guardia del silencio necesario · Zona 20–26',
    w: 62, h: 44,
    rows: ciudadela.rows,
    epochDiffs: [],              // la Niebla jamás entró: no hay ayeres que devolver
    dark: false,                 // la Ciudadela está habitada: los faroles de la Orden nunca se apagaron
    music: 'crypt',              // la misma piedra que canta: la Sala, en grande
    npcs: [
      // El Guardián de la Puerta: trescientos años abriendo a los que subían
      // y ninguna vez viendo volver. Hoy abre para alguien que ya volvió.
      { id: 'porteroc', x: 31, y: 40, sprite: 'kael', name: 'El Guardián de la Puerta' },
      // Los lanceros: vecinos con lanza. El motivo de su guardia se lo comió la espera.
      { id: 'tum', x: 11, y: 10, sprite: 'kael', name: 'Lancero Tum' },
      { id: 'sayo', x: 51, y: 10, sprite: 'kael', name: 'Lancera Sayo' },
      { id: 'brume', x: 11, y: 34, sprite: 'kael', name: 'Lancero Brume' },
    ],
    chests: [
      { id: 'ci1', x: 6, y: 34, gold: 90 },                  // el barrio del sur guardó algo
      { id: 'ci2', x: 56, y: 34, gold: 70, potions: 1 },     // el barrio este: la ración de un lancero
    ],
    echoes: [
      {
        id: 'ci_e1', x: 31, y: 26, title: 'Eco menor · La muralla que canta',
        text: '«Las murallas de la Ciudadela no fueron talladas para cantar: APRENDIERON. Trescientos años de pasos que subían y no volvían, y la piedra empezó a cantar cada pisada como se canta a los que se van: para que el camino sepa que fue caminado. Camina despacio y oirás tu nombre en el canto. Es la única bienvenida que esta ciudad recuerda dar.»',
      },
      {
        id: 'ci_e2', x: 8, y: 8, title: 'Eco menor · Los que subieron',
        text: '«Todos los que oyeron el primer Eco subieron por esta rampa. La Orden les daba techo, lanza y una guardia cuyo motivo nadie les explicaba dos veces. Ninguno volvió. No los mató la Niebla — no los mató NADIE: los cambió la espera, que es más paciente que cualquier colmillo. Pregúntales a los lanceros por qué vigilan. Verás la pregunta no les duele: les da ternura.»',
      },
      {
        id: 'ci_e3', x: 54, y: 8, title: 'Eco menor · La espera',
        text: '«El archivo de la Lanza lleva trescientos años con una puerta encadenada y un estante vacío. Los archiveros fueron muriendo y los que vinieron después no preguntaban: encadenaban. La espera no destruye los archivos: los DUPLICA — por cada verdad guardada, una cadena. Y por cada cadena, alguien que olvida qué estaba guardando.»',
      },
    ],
    spawns: [],                  // habitada, no infestada: aquí la espera no muerde
    exits: [
      // la entrada: por aquí se vuelve a la Cripta (el Portador es el primero que VOLVIÓ)
      // R14-m: aterrizaje (7,24) = la alcoba oeste secreta de la cripta
      // rediseñada 48×54 (x6..8, y22..24) — en la geometría vieja era (7,26),
      // que en la cripta R10-1 es MURO. (7,24) está fuera de la puerta oeste
      // (x6) y de toda otra zona de salida — sin bucle.
      { x: 29, y: 42, w: 4, h: 1, to: 'cripta', tx: 7, ty: 24, label: 'Cripta del Primer Canto' },
      // las cuatro puertas de las salas — cada cadena cae con su verdad (needFlag)
      { x: 2, y: 12, w: 1, h: 2, to: 'biblioteca', tx: 11, ty: 8, needFlag: 'ciudV1', label: 'La Biblioteca de la Orden' },
      { x: 2, y: 31, w: 1, h: 2, to: 'nombres', tx: 11, ty: 8, needFlag: 'ciudV2', label: 'La Sala de los Nombres' },
      { x: 59, y: 12, w: 1, h: 2, to: 'archivo', tx: 11, ty: 8, needFlag: 'ciudV3', label: 'El Archivo de la Lanza' },
      { x: 30, y: 3, w: 2, h: 1, to: 'antecamara', tx: 12, ty: 12, needFlag: 'ciudConsejo', label: 'La Antecámara del Consejo' },
    ],
    props: [
      { id: 'sanc_ci', kind: 'sanctuary', x: 34, y: 24 },
      // LAS TRES VERDADES (patio de cada distrito, a la vista: la verdad no se esconde)
      { id: 'estante_bib', kind: 'verdad', x: 11, y: 13, label: 'verdad_bib' },
      { id: 'muro_nom', kind: 'verdad', x: 11, y: 31, label: 'verdad_nom' },
      { id: 'arc_lanza', kind: 'verdad', x: 51, y: 13, label: 'verdad_arc' },
      // LAS CUATRO CADENAS (la guardia del distrito; la opción mala vive aquí)
      { id: 'cadena_bib', kind: 'gate', x: 2, y: 12, label: 'cadena_bib' },
      { id: 'cadena_nom', kind: 'gate', x: 2, y: 31, label: 'cadena_nom' },
      { id: 'cadena_arc', kind: 'gate', x: 59, y: 12, label: 'cadena_arc' },
      { id: 'cadena_consejo', kind: 'gate', x: 30, y: 3, label: 'cadena_consejo' },
      // carteles
      { id: 'sign_ci0', kind: 'sign', x: 30, y: 39, label: '«LA CIUDADELA DE VESH. Trescientos años custodiando el silencio necesario. Tu nombre ya está escrito aquí, junto al de todos los que subieron. Bienvenido a casa, Portador: eres el primero que vuelve.»' },
      { id: 'sign_ci1', kind: 'sign', x: 31, y: 21, label: '«La batalla por la Ciudadela no se gana matando: se gana recordando. Cada distrito guarda una verdad que devolver. Devuélvela, y la guardia bajará sin una sola espada.»' },
      { id: 'sign_ci2', kind: 'sign', x: 31, y: 15, label: '«La Torre de la Antecámara. El Consejo de la Orden espera desde hace trescientos años. Las cadenas caen cuando las tres verdades vuelvan a su lugar.»' },
    ],
  },
  biblioteca: {
    id: 'biblioteca' as unknown as MapId,
    name: 'La Biblioteca de la Orden',
    subtitle: 'Distrito I · La verdad del primer Eco',
    w: 22, h: 16,
    rows: buildBiblioteca(),
    epochDiffs: [], dark: false, music: 'crypt',
    npcs: [],
    chests: [{ id: 'bi1', x: 11, y: 6, gold: 140 }],   // el estante guardó algo para quien volviera
    echoes: [
      {
        id: 'bi_e1', x: 11, y: 11, title: 'Eco menor · El Libro del Primer Eco',
        text: '«El registro de la Orden, tomo primero. En su última página, la misma entrada escrita trescientas veces con manos distintas: "Hoy subió otro. Le dimos techo, lanza y guardia. No le dijimos que la Ciudadela no tiene salida, porque nadie nos dijo que la pregunta existía." El libro no miente: solo espera que alguien lo lea EN VOZ ALTA para poder descansar.»',
      },
    ],
    spawns: [],
    exits: [{ x: 1, y: 7, w: 1, h: 2, to: 'ciudadela', tx: 4, ty: 12, label: 'La Ciudadela de Vesh' }],
    props: [
      { id: 'sign_bi1', kind: 'sign', x: 11, y: 3, label: '«BIBLIOTECA DE LA ORDEN. Aquí se guarda lo que la espera no pudo comer: los registros, los nombres, las razones. Si vienes a devolver algo, el estante te reconoce.»' },
    ],
  },
  nombres: {
    id: 'nombres' as unknown as MapId,
    name: 'La Sala de los Nombres',
    subtitle: 'Distrito II · La verdad de los que no volvieron',
    w: 22, h: 16,
    rows: buildNombres(),
    epochDiffs: [], dark: false, music: 'crypt',
    npcs: [
      // NAIA (biblia §734): la hermana de Ilwen. Se hizo cantora de la Orden
      // y de tanto cantar los nombres de los Portadores caídos olvidó el suyo.
      // La escena usa el catecismo de los faroles: se encienden con nombres
      // dichos en voz alta. (Sprite 'ilwen' provisional: las hermanas se
      // parecen — el agente visual lo distingue en su ronda.)
      { id: 'naia', x: 11, y: 10, sprite: 'ilwen', name: 'Una cantora de la Orden' },
    ],
    chests: [{ id: 'no1', x: 17, y: 12, gold: 80, potions: 1 }],
    echoes: [
      {
        id: 'no_e1', x: 5, y: 12, title: 'Eco menor · Los faroles de los nombres',
        text: '«Cada farol de esta sala lleva el nombre de un Portador que subió y no volvió. El catecismo de los faroles es sencillo y no admite atajos: SE ENCIENDEN CON NOMBRES DICHO EN VOZ ALTA. Durante trescientos años una cantora los recorría uno a uno cada noche. Cantaba los nombres de todos... menos uno. El suyo. Nadie se lo dijo jamás, y los faroles no encienden a los que no existen.»',
      },
    ],
    spawns: [],
    exits: [{ x: 1, y: 7, w: 1, h: 2, to: 'ciudadela', tx: 4, ty: 31, label: 'La Ciudadela de Vesh' }],
    props: [
      // los faroles del catecismo: encendibles uno a uno (cada uno, un nombre dicho)
      { id: 'farol_n1', kind: 'lamp', x: 5, y: 6 },
      { id: 'farol_n2', kind: 'lamp', x: 11, y: 6 },
      { id: 'farol_n3', kind: 'lamp', x: 17, y: 6 },
      { id: 'sign_no1', kind: 'sign', x: 11, y: 3, label: '«SALA DE LOS NOMBRES. Los Portadores que no volvieron duermen en estos faroles. El catecismo manda: se encienden con nombres dichos en voz alta. Di los que sepas. Queda uno que nadie ha dicho nunca.»' },
    ],
  },
  archivo: {
    id: 'archivo' as unknown as MapId,
    name: 'El Archivo de la Lanza',
    subtitle: 'Distrito III · La verdad de Vesh',
    w: 22, h: 16,
    rows: buildArchivo(),
    epochDiffs: [], dark: false, music: 'crypt',
    npcs: [],
    chests: [{ id: 'ar1', x: 11, y: 12, gold: 100 }],
    echoes: [
      {
        id: 'ar_e1', x: 17, y: 12, title: 'Eco menor · La segunda mitad de la orden',
        text: '«El archivo guarda el pergamino póstumo de Vesh, el Gran Inquisidor. El juego del mundo solo citó su mitad — "si alguien reúne el Canto, baja y sé su última nota" — porque la otra mitad estaba COSIDA en el forro de una lanza, esperando una Guarda curiosa. La orden completa no manda matar otra vez: manda DEVOLVER. "La lanza sorda era mía: devuélvele el silencio, no el mundo."»',
      },
    ],
    spawns: [],
    exits: [{ x: 1, y: 7, w: 1, h: 2, to: 'ciudadela', tx: 57, ty: 12, label: 'La Ciudadela de Vesh' }],
    props: [
      // LA LANZA SORDA (sprite 'fragment' provisional — el acabado lo da la ronda visual)
      { id: 'lanza_arch', kind: 'verdad', x: 11, y: 9, label: 'voz_lanza' },
      { id: 'sign_ar1', kind: 'sign', x: 11, y: 3, label: '«ARCHIVO DE LA LANZA. Aquí descansa la lanza sorda que los Durn forjaron y Vesh alzó. No está guardada: está ESPERANDO PERMISO. Trescientos años sin encontrar a quién devolvérsela.»' },
    ],
  },
  antecamara: {
    id: 'antecamara' as unknown as MapId,
    name: 'La Antecámara del Consejo',
    subtitle: 'La Orden de Vesh · Trescientos años de espera',
    w: 24, h: 16,
    rows: buildAntecamara(),
    epochDiffs: [], dark: false, music: 'crypt',
    npcs: [
      // El Consejo de la Orden: la voz de los que esperaron permiso para
      // devolver la Lanza. (Sprite 'kael' provisional — ronda visual.)
      { id: 'consejo', x: 9, y: 7, sprite: 'kael', name: 'El Consejo de la Orden' },
    ],
    chests: [{ id: 'an1', x: 19, y: 12, gold: 200 }],  // las arcas de la Orden: para quien devolviera las verdades
    echoes: [],
    spawns: [],
    exits: [{ x: 1, y: 7, w: 1, h: 2, to: 'ciudadela', tx: 30, ty: 5, label: 'La Ciudadela de Vesh' }],
    props: [
      // LA PUERTA DEL NORTE (R15 «El Silencio de Arriba»): cerrada con tres
      // cadenas nuevas. El gancho del acto — no se abre en esta fase.
      { id: 'sign_r15', kind: 'sign', x: 12, y: 2, label: '«La puerta del norte. Más arriba está el Silencio de Arriba, donde el aire corta los nombres por la mitad. Allí espera la Lanza su permiso. El Consejo no la abre hoy: primero hay que aprender a pelear sin anunciarse.»' },
    ],
  },
};
