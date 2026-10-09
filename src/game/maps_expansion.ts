// ============================================================
// ECOS DE AELTHAR — Mapas del Acto II (expansión)
// Costa de Bruma · Aldea de Merrow · Cumbres Heladas
// Generación determinista (semillas fijas, sin azar de ejecución).
//
// NOTA DE CONTRATO: los helpers de generación están DUPLICADOS a
// propósito desde maps.ts (maps.ts no debía modificarse para
// exportarlos). Transitables nuevos usados: 's' (arena),
// 'S' (nieve), 'i' (hielo) — los dibuja otro agente.
//
// R10-2 · AMPLIACIÓN (épica 6.2): cada mapa crece POR EL BORDE sin mover
// una sola coordenada existente (NPCs, cofres, spawns de jefe, santuarios,
// aterrizajes y props quedan clavados — los saves dependen de ellos):
//   · costa 52×40 → 64×40: la marea se RETIRÓ del este y dejó en
//     seco el lecho viejo con «La Madre del Mar», nao antigua de casco
//     explorable; el faro del oeste es ahora una RUINA con sala interior.
//     Única salida reanclada: la calzada a Merrow sigue el nuevo borde este.
//   · aldea 44×34 → 44×44: la muralla sur gana una puerta y detrás crecen el
//     HUERTO QUEMADO y el CEMENTERIO MARINO con la cripta de la familia
//     fundadora (en el ayer el huerto vive y las tumbas están cuidadas).
//   · cumbres 50×42 → 66×42: la cordillera sigue al este con la MINA DE LAS
//     TRES VELAS (cueva corta: derrumbada hoy, abierta en el ayer), el
//     CAMPAMENTO MINERO abandonado y el MIRADOR HELADO con cornisa de hielo.
// ============================================================

import type { MapDef, MapId, EpochDiff } from './types';
import { INTERIOR_MAP_IDS } from './maps_interiores'; // R10-5: taberna de Merrow

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

// ---------------- COSTA DE BRUMA (64×40, ampliada R10-2) ----------------
// Arena ('s'), hierba salada ('.'), acantilados al norte ('#','R'),
// mar al sur ('~', sólido). Muelle roto (entero en el pasado), altar de
// las Mareas. R10-2: la marea del ESTE se retiró (x43→x57) y dejó en seco
// el lecho viejo: los Jardines de Sal y la nao antigua «La Madre del Mar»,
// de casco explorable. El faro del oeste es ahora una RUINA con sala.

function buildCosta(): string[] {
  const W = 64, H = 40;
  const g = grid(W, H, '.');
  borderForest(g, 2, 'R');            // promontorios rocosos en los bordes
  rect(g, 0, 0, W, 2, '#');           // acantilado norte
  // abertura norte: entrada desde Lunaris (x25..27, y0..1) — SIN CAMBIOS
  rect(g, 25, 0, 3, 2, '=');
  pathV(g, 2, 8, 25); pathV(g, 2, 8, 26);
  // mar al sur, con orilla ondulada de arena (x2..49 idéntico al original)
  for (let x = 2; x <= 61; x++) {
    const wave = 35 + ((x * 7 + 3) % 3);
    for (let y = wave; y < H; y++) set(g, x, y, '~');
    set(g, x, wave - 1, 's');
  }
  // R10-2 · LA MAREA RETIRADA: la línea de costa este pasó de x≈43 a x≈57..59.
  // El mar desalojó el lecho viejo y dejó la flota hundida mirando el cielo.
  for (let y = 2; y <= 37; y++) {
    const seaX = 57 + ((y * 5 + 1) % 3);
    for (let x = seaX; x < W; x++) set(g, x, y, '~');
    if (g[y][seaX - 1] !== '~') set(g, seaX - 1, y, 's');
  }
  // R10-2 · lecho marino expuesto (los Jardines de Sal): arena desigual
  // hasta la nueva orilla; la orilla fina del bucle la remata
  for (let y = 5; y <= 34; y++) {
    const sx = 43 + ((y * 3 + 2) % 3);
    for (let x = sx; x <= 57; x++) set(g, x, y, 's');
  }
  // charcas que la marea olvidó al irse (agua viva entre la arena)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let dx = (x - 50) / 2.2, dy = (y - 9) / 1.3;
    if (dx * dx + dy * dy < 1) set(g, x, y, '~');
    dx = (x - 47) / 1.8; dy = (y - 26) / 1.2;
    if (dx * dx + dy * dy < 1) set(g, x, y, '~');
    dx = (x - 54) / 1.6; dy = (y - 33) / 1.1;
    if (dx * dx + dy * dy < 1) set(g, x, y, '~');
  }
  // playa de arena al sur — SIN CAMBIOS
  rect(g, 6, 29, 34, 5, 's');
  // caminos: principal, santuario, naufragio, faro — SIN CAMBIOS
  pathH(g, 10, 34, 9);
  pathV(g, 10, 20, 21);
  pathV(g, 10, 24, 34);
  pathH(g, 33, 41, 25);
  pathV(g, 9, 17, 7);
  // calzada este hacia la Aldea de Merrow: cruza el estrecho nuevo como
  // malecón (x57..63 sobre el agua) hasta el borde este reanclado
  rect(g, 43, 17, 21, 4, '=');
  // muelle de Merrow: pilares ('x') + tablones ('B'); en el presente
  // solo quedan los dos primeros tramos, el mar se tragó el resto — SIN CAMBIOS
  for (let y = 34; y <= 38; y++) { set(g, 27, y, 'x'); set(g, 30, y, 'x'); }
  rect(g, 28, 34, 2, 2, 'B');
  // promontorio del faro (oeste) — SIN CAMBIOS
  set(g, 4, 16, 'R'); set(g, 4, 17, 'R'); set(g, 4, 18, 'R'); set(g, 4, 19, 'R');
  set(g, 5, 17, 'R'); set(g, 5, 19, 'R');
  // R10-2 · pilares de un muelle viejo, en seco desde la retirada
  set(g, 46, 10, 'x'); set(g, 46, 13, 'x'); set(g, 46, 16, 'x');
  set(g, 47, 19, 'x'); set(g, 47, 22, 'x');
  // textura: rocas en el acantilado, pinos salados, hierba de mar — SIN CAMBIOS
  set(g, 5, 1, 'R'); set(g, 13, 1, 'R'); set(g, 31, 1, 'R'); set(g, 40, 1, 'R'); set(g, 47, 1, 'R');
  set(g, 10, 2, 'R'); set(g, 40, 2, 'R'); set(g, 17, 4, 'R');
  scatter(g, 3, 3, 18, 12, 'p', 0.05, 411, (x, y) => g[y][x] !== '.');
  scatter(g, 3, 10, 42, 28, ',', 0.05, 412, (x, y) => g[y][x] !== '.');
  // R10-2 · restos sobre el lecho: jarcia podrida ('r') y tablones sueltos ('B')
  scatter(g, 43, 5, 56, 33, 'r', 0.05, 413, (x, y) => g[y][x] !== 's');
  scatter(g, 43, 5, 56, 33, 'B', 0.03, 414, (x, y) => g[y][x] !== 's');
  // R10-2 · FARO EN RUINAS (cabo oeste): el anillo de la torre perdió el
  // arco norte (por donde entra el camino viejo, x7) y parte del sur; el
  // suelo de la lámpara quedó a ras de cabo. Mara sigue dentro y NO se
  // mueven el prop 'faro_co' (6,18) — fx.ts lo referencia — ni el cofre
  // co2 (4,15) ni la NPC (7,19).
  rect(g, 6, 15, 4, 5, 's');          // sala barrida por el viento (x6..9, y15..19)
  set(g, 6, 14, 'R'); set(g, 8, 14, 'R'); set(g, 9, 14, 'R');   // arco norte roto
  set(g, 10, 15, 'R'); set(g, 10, 16, 'R'); set(g, 10, 17, 'R'); set(g, 10, 18, 'R');
  set(g, 6, 20, 'R'); set(g, 9, 20, 'R');                       // arco sur roto
  set(g, 5, 21, 'R'); set(g, 5, 22, 'R'); set(g, 6, 23, 'R');   // espolón del cabo
  // R10-2 · «LA MADRE DEL MAR» (naufragio antiguo): el casco roto duerme
  // sobre el banco — la proa muerde el agua nueva, la popa se abrió en la
  // arena. Cubierta 'B', bodega ':' anegada, mástil 'x'; entra por la banda
  // oeste podrida o el boquete de proa.
  rectOutline(g, 51, 22, 8, 9, 'H');  // casco (x51..58, y22..30)
  rect(g, 52, 23, 6, 4, 'B');         // cubierta
  rect(g, 52, 27, 6, 3, ':');         // bodega
  set(g, 53, 25, 'x');                // mástil
  set(g, 51, 24, 'B'); set(g, 51, 25, 'B');   // banda oeste podrida
  set(g, 54, 22, 'B'); set(g, 55, 22, 'B');   // boquete de proa
  set(g, 56, 30, 's'); set(g, 57, 30, 's');   // popa abierta
  // despejar coordenadas clave (NPCs/cofres/ecos/spawns/props) por si
  // la decoración dispersa dejó un tile sólido — originales SIN CAMBIOS
  const clearKey: [number, number, string][] = [
    [7, 19, '.'], [30, 32, 's'], [4, 15, '.'], [42, 29, '.'], [24, 30, 's'],
    [37, 19, '.'], [11, 25, '.'], [23, 3, '.'], [25, 31, 's'], [22, 21, '.'],
    [36, 27, '.'], [41, 22, '.'], [39, 24, '.'], [12, 32, 's'], [20, 34, '.'],
    [33, 32, 's'], [38, 30, 's'], [14, 22, '.'], [24, 26, '.'],
    // R10-2 · zonas nuevas
    [9, 16, 's'], [8, 17, 's'],       // faro: cofre y eco
    [10, 19, '.'],                    // cartel del faro
    [45, 21, 's'], [50, 27, 's'],     // lecho: cartel y spawn de neumo
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

// ---------------- ALDEA DE MERROW (44×44, ampliada R10-2) ----------------
// Pueblo borrado por la Niebla Muda. PRESENTE: ruinas ('H' muros rotos,
// 'r' escombros, ':' empedrado agrietado) y espectros. PASADO: el pueblo
// vivo en el festival — casas enteras con puertas, flores, muelle este.
// R10-2 · EXTRAMUROS SUR: la muralla gana una puerta (x20..23) y detrás
// quedaron el HUERTO QUEMADO (oeste; en el ayer los surcos están vivos) y
// el CEMENTERIO MARINO con la CRIPTA FAMILIAR (este, junto a la ensenada
// nueva que la laguna gotea hacia el sur).

function buildAldea(): string[] {
  const W = 44, H = 44;
  const g = grid(W, H, ':');          // empedrado agrietado por doquier
  borderForest(g, 2, 'H');            // muralla de muros rotos
  // abertura oeste: entrada desde la Costa de Bruma (x0..1, y16..19) — SIN CAMBIOS
  rect(g, 0, 16, 5, 4, '=');
  pathH(g, 4, 17, 18);
  // plaza central con el pozo seco
  rect(g, 17, 12, 10, 8, ':');
  set(g, 21, 15, 'w');
  // casas en ruinas (presente): techos hundidos y muros con boquetes — SIN CAMBIOS
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
  // muelle este de la laguna (roto en el presente, entero en el pasado) — SIN CAMBIOS
  set(g, 37, 28, 'x'); set(g, 40, 29, 'x');
  rect(g, 38, 26, 2, 2, 'B');
  rect(g, 38, 28, 2, 2, '~');
  // la hierba reclaima el pueblo; escombros por todas partes — SIN CAMBIOS
  scatter(g, 3, 3, 40, 30, '.', 0.05, 511, (x, y) => {
    if (g[y][x] !== ':') return true;
    if (x >= 16 && x <= 27 && y >= 11 && y <= 20) return true;  // plaza empedrada
    return false;
  });
  scatter(g, 3, 3, 40, 30, 'r', 0.045, 512, (x, y) => g[y][x] !== ':');
  // despejar coordenadas clave — SIN CAMBIOS
  const clearKey: [number, number][] = [
    [22, 16], [10, 23], [32, 9], [23, 14], [6, 19], [5, 16], [26, 20],
    [13, 13], [28, 14], [20, 22], [17, 21], [9, 12], [33, 12], [14, 22],
    [30, 21], [16, 8], [27, 29],
  ];
  for (const [x, y] of clearKey) {
    const c = g[y][x];
    if (c === 'r' || c === 'H') set(g, x, y, ':');
  }
  // ============ R10-2 · EXTRAMUROS SUR ============
  // La muralla sur (y32..33 era borde con H=34; con H=44 se recompone igual)
  // gana una PUERTA: al sur quedaron el huerto y el cementerio.
  rect(g, 2, 32, 40, 2, 'H');
  rect(g, 20, 32, 4, 2, '=');         // puerta sur (x20..23)
  pathV(g, 27, 31, 21);               // plaza → puerta
  // la hierba reclaima el extramuros con más fuerza que al pueblo
  scatter(g, 3, 34, 41, 41, '.', 0.20, 513, (x, y) => g[y][x] !== ':');
  scatter(g, 3, 34, 41, 41, 'r', 0.03, 514, (x, y) => g[y][x] !== ':');
  // arena que la marea vieja dejó junto a la ensenada del cementerio
  rect(g, 24, 34, 16, 7, 's');
  // HUERTO QUEMADO (oeste): cerco de estacas ('F'), surcos ('c') y brotes
  // chamuscados ('r'). En el ayer los surcos vuelven a ser verdes.
  rectOutline(g, 5, 34, 14, 7, 'F');
  rect(g, 7, 36, 10, 1, 'c');
  rect(g, 7, 38, 10, 1, 'c');
  set(g, 9, 36, 'r'); set(g, 14, 36, 'r');
  set(g, 8, 38, 'r'); set(g, 12, 38, 'r'); set(g, 15, 38, 'r');
  // CEMENTERIO MARINO (este): la laguna gotea hacia el sur y forma una
  // ensenada; las lápidas ('g') miran al agua, como les prometieron
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - 39) / 3.4, dy = (y - 35) / 3.0;
    if (dx * dx + dy * dy < 1) set(g, x, y, '~');
  }
  pathV(g, 30, 32, 41, '~');          // riachuelo: la laguna escurre al sur
  // CRIPTA FAMILIAR: piedra ('#') al borde del agua. El dintel quedó liso:
  // la Niebla también borra piedra. En el ayer, todavía se lee.
  rectOutline(g, 29, 38, 8, 4, '#');
  rect(g, 30, 39, 6, 2, ':');
  set(g, 32, 38, ':');                // entrada norte
  // caminos del extramuros: calle sur, ramal al cerco (puerta este, x18)
  // y ramal al cementerio entre las filas de tumbas
  pathV(g, 34, 38, 21); pathV(g, 34, 38, 22);
  pathH(g, 18, 21, 36);
  pathH(g, 23, 31, 36);
  // lápidas (tras los caminos: ninguna pisa el sendero)
  set(g, 25, 35, 'g'); set(g, 27, 35, 'g'); set(g, 29, 35, 'g'); set(g, 31, 35, 'g'); set(g, 33, 35, 'g');
  set(g, 26, 37, 'g'); set(g, 28, 37, 'g'); set(g, 30, 37, 'g'); set(g, 32, 37, 'g');
  set(g, 26, 39, 'g'); set(g, 27, 40, 'g');
  // despejar coordenadas clave del extramuros
  const clearKey2: [number, number, string][] = [
    [6, 39, ':'], [10, 37, ':'],      // huerto: cofre y eco
    [19, 34, ':'],                    // cartel del huerto
    [25, 34, 's'],                    // cartel del cementerio
    [34, 40, ':'], [31, 39, ':'],     // cripta: cofre y eco
    [14, 39, ':'], [33, 37, 's'],     // spawns (neumo del huerto, espectro de la cripta)
  ];
  for (const [x, y, ch] of clearKey2) {
    const c = g[y][x];
    if (c === 'r' || c === 'H' || c === 'F' || c === 'g' || c === '#') set(g, x, y, ch);
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
  // R10-2 · el huerto VIVÍA: los brotes chamuscados eran verdura, y había
  // quien cuidara las flores del cerco y las tumbas recientes
  { x: 9, y: 36, char: 'c' }, { x: 14, y: 36, char: 'c' },
  { x: 8, y: 38, char: 'c' }, { x: 12, y: 38, char: 'c' }, { x: 15, y: 38, char: 'c' },
  { x: 10, y: 35, char: ',' }, { x: 15, y: 35, char: ',' }, { x: 13, y: 37, char: ',' },
  { x: 27, y: 35, char: ',' }, { x: 30, y: 37, char: ',' },
];

// ---------------- CUMBRES HELADAS (66×42, ampliada R10-2) ----------------
// Nieve ('S'), lago helado ('i') al centro-sur, pinos nevados ('p'),
// cordillera al norte ('R') con la meseta del altar. Entrada por el sur.
// R10-2 · ESTE NUEVO: la cordillera sigue hacia el este y esconde la MINA
// DE LAS TRES VELAS (cueva corta: derrumbada en el presente, la veta abierta
// en el ayer), el CAMPAMENTO MINERO abandonado y el MIRADOR HELADO, con su
// cornisa de hielo ('i') y el cofre del que no tiene prisa.

function buildCumbres(): string[] {
  const W = 66, H = 42;
  const g = grid(W, H, 'S');
  borderForest(g, 2, 'p');            // pinnedos en los bordes
  rect(g, 48, 0, 2, 42, 'p');         // R10-2: la vieja muralla este de pinos se conserva
  // cordillera norte — SIN CAMBIOS
  rect(g, 2, 2, 46, 4, 'R');
  // R10-2: la cordillera continúa al este
  rect(g, 50, 2, 14, 4, 'R');
  // meseta del altar del Eco de las Cumbres, abierta en la roca — SIN CAMBIOS
  rect(g, 21, 2, 8, 5, '=');
  // abertura sur: entrada desde el Bosque Susurrante (x24..26, y40..41) — SIN CAMBIOS
  rect(g, 24, 40, 3, 2, '=');
  pathV(g, 34, 40, 24); pathV(g, 34, 40, 25);
  // paso de montaña serpenteante — SIN CAMBIOS
  pathH(g, 12, 25, 34);
  pathV(g, 20, 34, 12);
  pathH(g, 12, 24, 20);
  pathV(g, 8, 20, 23); pathV(g, 8, 20, 24);
  pathH(g, 26, 40, 20);
  pathV(g, 20, 30, 40);
  pathH(g, 34, 40, 30);
  // lago helado al centro-sur — SIN CAMBIOS
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - 30) / 6, dy = (y - 30) / 4;
    if (dx * dx + dy * dy < 1) set(g, x, y, 'i');
  }
  // hoguera apagada de los pastores (anillo de piedras) — SIN CAMBIOS
  rectOutline(g, 8, 33, 3, 3, 'R');
  // ============ R10-2 · ESTE: MINA, CAMPAMENTO Y MIRADOR ============
  // MINA DE LAS TRES VELAS: cueva corta en el flanco de la cordillera;
  // el derrumbe ('R') cierra la veta en el presente — en el ayer se minaba
  rect(g, 50, 1, 7, 6, '#');          // roca de la boca (x50..56, y1..6)
  rect(g, 51, 2, 5, 4, ':');          // galería
  rect(g, 54, 3, 2, 2, 'R');          // derrumbe del presente
  set(g, 53, 6, '=');                 // boca de la mina
  // MIRADOR HELADO: repisa tallada al este de la cordillera, con cornisa
  // de hielo ('i') hacia el cofre del mirador
  rect(g, 57, 2, 7, 3, 'S');          // x57..63, y2..4
  rect(g, 58, 3, 5, 1, 'i');
  // caminos del este: el paso viejo (y20) se abre hacia el campamento; de
  // él nacen la subida a la boca de mina (x53) y la trepa al mirador (x57..58)
  pathH(g, 40, 57, 20);
  pathV(g, 6, 19, 53);
  pathV(g, 5, 19, 57); pathV(g, 5, 19, 58);
  // pinos nevados y rocas sueltas del este
  scatter(g, 50, 7, 63, 39, 'p', 0.07, 613, (x, y) => g[y][x] !== 'S');
  scatter(g, 50, 7, 63, 39, 'R', 0.02, 614, (x, y) => g[y][x] !== 'S');
  // CAMPAMENTO MINERO ABANDONADO: barracones con techo hundido ('r'),
  // hoguera apagada, traviesas de la vía decapada ('B') y vagonetas podridas
  house(g, 52, 22, 5, 54);            // barracón oeste
  set(g, 53, 23, ':');                // boquete en el muro
  house(g, 59, 22, 4, 60);            // cobertizo este
  set(g, 61, 23, ':');
  rectOutline(g, 54, 16, 3, 3, 'R');  // hoguera apagada de los mineros
  pathH(g, 53, 57, 21, 'B');
  set(g, 52, 21, 'r'); set(g, 60, 21, 'r');
  // despejar coordenadas clave — SIN CAMBIOS
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
  // R10-2 · despejar coordenadas clave del este (sobre nieve dispersa)
  const clearKeyE: [number, number][] = [
    [60, 10], [52, 26],               // spawns (arpi de la trepa, lobo del campamento)
    [56, 19],                         // cartel del campamento
  ];
  for (const [x, y] of clearKeyE) {
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
  // R10-2 · la mina trabajaba en el ayer: el derrumbe aún no existía y
  // el campamento tenía flores junto a las vagonetas y la hoguera
  { x: 54, y: 3, char: ':' }, { x: 55, y: 3, char: ':' },
  { x: 54, y: 4, char: ':' }, { x: 55, y: 4, char: ':' },
  { x: 52, y: 16, char: ',' }, { x: 60, y: 19, char: ',' }, { x: 58, y: 25, char: ',' },
];

// ---------------- Definición completa del Acto II + Arena del Desafío ----------------

// ---------------- ARENA DEL ECO (44×34) — MODO DESAFÍO (12-a) ----------------
// Recinto cerrado de piedra para el modo desafío (challenge.ts). Sin NPCs,
// cofres, ecos ni spawns propios: TODOS los enemigos los instancia
// challenge.ts alrededor del Portador. Época única ('presente', epochDiffs
// vacío) y música de jefe. Tiles: '#' muralla, ':' empedrado, '=' anillo de
// combate, 'P' pilares de cobertura, 'R' rocas sueltas (todos existentes en
// sprites.ts, así el mapa se dibuja sin tocar render).
//
// ÚNICA SALIDA (puerta sur): válvula de seguridad, no una ruta de progresión.
// Salir de la arena con el reto a medio hacer dispara el aborto limpio de
// challenge.ts (restaura el estado de campaña) y evita el atrapamiento si el
// jugador guarda y sale al título desde la pausa estando dentro (el guardado
// serializaría mapId 'arena': al continuar, la puerta lo devuelve al valle).

function buildArena(): string[] {
  const W = 44, H = 34;
  const g = grid(W, H, ':');          // suelo de piedra del recinto
  borderForest(g, 2, '#');            // muralla perimetral (arena cerrada)
  // anillo de camino: el círculo de combate marca el ritmo
  rectOutline(g, 3, 3, W - 6, H - 6, '=');
  // cuatro clusters de pilares 2×2 (cobertura simétrica contra proyectiles)
  rect(g, 9, 7, 2, 2, 'P'); rect(g, 32, 7, 2, 2, 'P');
  rect(g, 9, 23, 2, 2, 'P'); rect(g, 32, 23, 2, 2, 'P');
  // rocas sueltas de cobertura (nunca sobre el centro ni la puerta)
  set(g, 14, 15, 'R'); set(g, 29, 15, 'R'); set(g, 21, 11, 'R'); set(g, 22, 21, 'R');
  // puerta de emergencia al sur: corredor transitable a través del anillo y
  // la muralla (x20..23, y29..33); la zona de salida está en los 2 últimos
  // tramos para exigir intención (no se sale por rozarla)
  rect(g, 20, 29, 4, 5, ':');
  return toRows(g);
}

/**
 * Id del mapa arena. types.ts está CONGELADO en la ronda 12 (MapId aún no
 * lista 'arena'): el cast documentado amplía la unión por impacto. El
 * integrador puede añadir 'arena' a MapId y borrar el cast sin más cambios
 * (el mapa ya viaja dentro de EXPANSION_MAPS y maps.ts lo difunde a MAPS).
 */
export const ARENA_MAP_ID = 'arena' as unknown as MapId;

export const EXPANSION_MAPS: Record<'costa' | 'aldea' | 'cumbres', MapDef> & { arena: MapDef } = {
  costa: {
    id: 'costa',
    name: 'Costa de Bruma',
    subtitle: 'Donde el mar guarda las notas · Zona 10–16',
    w: 64, h: 40,  // R11-fix: w desfasado (52) dejaba el naufragio x51..58 INaccesible
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
    w: 44, h: 44,  // R11-fix: h desfasada (34) dejaba huerto/cementerio y34..43 INaccesibles
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
      // R10-5 · taberna de Merrow (SOLO PASADO — en el presente son ruinas)
      { x: 9, y: 8, w: 1, h: 1, to: INTERIOR_MAP_IDS.taberna, tx: 8, ty: 8, label: 'Taberna de Merrow', needPast: true },
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
    w: 66, h: 42,  // R11-fix: w desfasado (50) dejaba campamento/mirador x52..61 INaccesibles
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

  // MODO DESAFÍO (12-a): la arena NO participa de la campaña — sin jefes con
  // flags, sin botín, sin autoguardado. challenge.ts la llena de enemigos.
  arena: {
    id: ARENA_MAP_ID,
    name: 'Arena del Eco',
    subtitle: 'Modo Desafío · sobrevive o cae',
    w: 44, h: 34,
    rows: buildArena(),
    epochDiffs: [],                 // época única: el desafío ocurre fuera del tiempo
    music: 'boss',
    npcs: [],
    chests: [],
    echoes: [],
    spawns: [],                     // sin spawns de mapa: challenge.ts instancia oleadas y jefes
    exits: [
      // puerta de emergencia: aterriza en el Santuario de Lunaris (mismo punto
      // que usa respawn en campaña); challenge.ts detecta la salida y restaura
      // el estado de campaña sin penalización
      { x: 20, y: 32, w: 4, h: 2, to: 'lunaris', tx: 25, ty: 19, label: 'Valle de Lunaris' },
    ],
    props: [
      { id: 'sign_arena', kind: 'sign', x: 18, y: 28, label: '«Arena del Eco. Los caídos no juzgan: cuentan. La puerta del sur devuelve al valle con lo que trajiste.»' },
    ],
  },
};
