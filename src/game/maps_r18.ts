// ============================================================
// ECOS DE AELTHAR — SECCIONES NUEVAS (R18 «Más mundo»)
//
// Cada región gana una sección propia, conectada por su borde y sellada
// por la historia (gates.ts):
//   · CAMPOS DEL MOLINO   (este de Lunaris)   — el molino que se calló
//   · HONDONADA DE RAÍCES (oeste del Bosque)  — el Árbol Viejo que llora ceniza
//   · ACANTILADOS DEL FARO VIEJO (oeste de la Costa) — lo que el mar devuelve
//   · PANTANO DE LAS VELAS (este de Merrow)   — una llama por cada nombre
//   · GLACIAR DEL ECO     (este de las Cumbres) — el coro congelado
//
// Generación determinista (mulberry32 con semilla fija). Cada mapa se
// construye en DOS rejillas (presente y pasado) y las diferencias de época
// salen solas del diff: lo que cambia entre épocas es jugable (puentes,
// troncos caídos, marea baja, pasarelas, hielo joven).
// También aplica los «enlaces»: abre el borde de los mapas viejos con un
// camino y una salida hacia cada sección (sin mover nada existente).
// ============================================================

import type { MapDef, MapId, EpochDiff, ExitDef } from './types';

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
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}
function set(g: Grid, x: number, y: number, ch: string) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
}
function get(g: Grid, x: number, y: number): string {
  return y >= 0 && y < g.length && x >= 0 && x < g[0].length ? g[y][x] : '';
}
function rect(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, ch);
}
function outline(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let i = x; i < x + w; i++) { set(g, i, y, ch); set(g, i, y + h - 1, ch); }
  for (let j = y; j < y + h; j++) { set(g, x, j, ch); set(g, x + w - 1, j, ch); }
}
/** Mancha orgánica (estanques, claros, matorrales). */
function blob(g: Grid, cx: number, cy: number, rx: number, ry: number, ch: string, seed: number) {
  const r = mulberry32(seed);
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 0.82 || (d <= 1.15 && r() < 0.5)) set(g, x, y, ch);
    }
  }
}
/** Sendero de 1-2 tiles por una polilínea en L (h luego v). */
function road(g: Grid, pts: [number, number][], ch = '=', wide = 1) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    let x = x0, y = y0;
    for (let k = 0; k < 400; k++) {
      for (let w = 0; w < wide; w++) set(g, x + (sy !== 0 ? w : 0), y + (sx !== 0 ? w : 0), ch);
      if (x === x1 && y === y1) break;
      if (x !== x1) x += sx; else y += sy;
    }
  }
}
function scatter(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string, dens: number, seed: number, onlyOn = '.') {
  const r = mulberry32(seed);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (get(g, x, y) === onlyOn && r() < dens) set(g, x, y, ch);
}
function border(g: Grid, t: number, ch: string) {
  const H = g.length, W = g[0].length;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.min(x, y, W - 1 - x, H - 1 - y) < t) set(g, x, y, ch);
}
function house(g: Grid, x: number, y: number, w: number) {
  rect(g, x, y, w, 1, 'r'); rect(g, x, y + 1, w, 1, 'H');
}
const clone = (g: Grid): Grid => g.map(r => r.slice());
const toRows = (g: Grid) => g.map(r => r.join(''));
function diff(pres: Grid, past: Grid): EpochDiff[] {
  const out: EpochDiff[] = [];
  for (let y = 0; y < pres.length; y++) for (let x = 0; x < pres[0].length; x++) if (pres[y][x] !== past[y][x]) out.push({ x, y, char: past[y][x] });
  return out;
}
/** Vacía un hueco transitable alrededor de un punto (props, NPCs, aterrizajes). */
function clear(g: Grid, x: number, y: number, r = 1, ch = '.') {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const c = get(g, x + i, y + j);
    if (c && c !== '=' ) set(g, x + i, y + j, ch);
  }
}

// ================================================================ CAMPOS DEL MOLINO
function buildMolino(): MapDef {
  const W = 56, H = 40;
  const g = grid(W, H, '.');
  border(g, 2, 't');
  scatter(g, 2, 2, 53, 37, ',', 0.12, 1801);
  // arroyo norte-sur con puente en el camino
  for (let y = 2; y < 25; y++) { set(g, 33, y, '~'); set(g, 34, y, '~'); if (y % 7 === 3) set(g, 35, y, '~'); }
  blob(g, 40, 30, 4, 3, '~', 1802);                       // estanque
  // caminos
  road(g, [[0, 20], [20, 20], [20, 10]], '=', 2);          // entrada → molino
  road(g, [[20, 20], [46, 20], [46, 15]], '=');             // → granero
  road(g, [[14, 21], [14, 31]], '=');                       // → granja de Aldara
  // molino (base de piedra; el aspa la dibuja el prop 'molino')
  rect(g, 18, 5, 6, 3, 'H'); rect(g, 18, 4, 6, 1, 'r');
  // campos de cultivo con cerca (en el presente: tierra muerta)
  outline(g, 5, 9, 11, 7, 'F'); rect(g, 6, 10, 9, 5, '.'); set(g, 10, 15, '.');
  outline(g, 26, 24, 12, 8, 'F'); rect(g, 27, 25, 10, 6, '.'); set(g, 31, 24, '.');
  // granero
  rect(g, 42, 9, 9, 1, 'r'); rect(g, 42, 10, 9, 3, 'H');
  rect(g, 40, 16, 13, 6, ':');                              // era de trilla (arena del mini-jefe)
  road(g, [[46, 15], [46, 16]], '=');
  // granja de Aldara + pozo
  house(g, 11, 29, 6); set(g, 18, 31, 'w');
  scatter(g, 22, 33, 52, 37, 'p', 0.08, 1803);
  scatter(g, 36, 3, 52, 7, 'p', 0.12, 1804);
  // claros alrededor de puntos importantes
  for (const [x, y] of [[6, 22], [21, 11], [15, 33], [46, 19], [9, 6], [44, 34], [28, 14]] as [number, number][]) clear(g, x, y, 1);
  const pres = g;
  const past = clone(g);
  // AYER: los campos dorados y el arroyo con DOS puentes (el del norte cayó)
  rect(past, 6, 10, 9, 5, 'c'); rect(past, 27, 25, 10, 6, 'c');
  set(past, 33, 8, '='); set(past, 34, 8, '='); set(past, 35, 8, '.');
  road(past, [[21, 8], [40, 8]], '=');
  // HOY: el puente del norte se lo llevó la riada; el camino muere en el agua
  road(pres, [[21, 8], [32, 8]], '=');
  set(pres, 35, 8, '~');
  road(pres, [[36, 8], [40, 8]], '=');
  return {
    id: 'molino', name: 'Campos del Molino', subtitle: 'El molino que se calló · Zona 2-4',
    w: W, h: H, rows: toRows(pres), epochDiffs: diff(pres, past), music: 'village',
    npcs: [{ id: 'aldara', x: 15, y: 33, sprite: 'aldara', name: 'Aldara, la molinera' }],
    chests: [{ id: 'mo1', x: 44, y: 6, gold: 55, potions: 1, needPast: true }],
    echoes: [{ id: 'mo_e1', x: 9, y: 6, title: 'La última molienda', text: 'La noche en que el dios calló, el molino dio una vuelta más sin viento. La molinera juró que la piedra cantaba. A la mañana siguiente, los cuervos ya sabían hablar.' }],
    spawns: [
      { type: 'cuervo', x: 10, y: 12, patrol: 3 }, { type: 'cuervo', x: 31, y: 27, patrol: 3 },
      { type: 'cuervo', x: 38, y: 14, patrol: 3 }, { type: 'cuervo', x: 25, y: 16, patrol: 3, needPresent: true },
      { type: 'lobo', x: 44, y: 32, patrol: 3 }, { type: 'lobo', x: 8, y: 26, patrol: 2, needPresent: true },
      { type: 'reina_cuervo', x: 46, y: 19, zone: 'boss', patrol: 0 },
    ],
    exits: [{ x: 0, y: 19, w: 2, h: 3, to: 'lunaris', tx: 60, ty: 20, label: 'Valle de Lunaris' }],
    props: [
      { id: 'sanc_mo', kind: 'sanctuary', x: 6, y: 22 },
      { id: 'molino_mo', kind: 'molino', x: 20, y: 6 },
      { id: 'cuaderno_mo', kind: 'cuaderno', x: 21, y: 11, needPast: true, label: 'El cuaderno del molinero' },
      { id: 'sign_mo', kind: 'woodsign', x: 4, y: 18, label: 'Campos del Molino' },
      { id: 'espanta1', kind: 'remains', x: 28, y: 14, label: 'Un espantapájaros' },
      { id: 'espanta2', kind: 'remains', x: 44, y: 34, label: 'Un espantapájaros' },
    ],
  };
}

// ================================================================ HONDONADA DE LAS RAÍCES
function buildHondonada(): MapDef {
  const W = 54, H = 42;
  const g = grid(W, H, '.');
  border(g, 2, 'p');
  scatter(g, 2, 2, 51, 39, 'p', 0.16, 1811);
  scatter(g, 2, 2, 51, 39, ',', 0.14, 1812);
  // claro central y el Árbol Viejo
  blob(g, 24, 19, 9, 7, '.', 1813);
  blob(g, 24, 19, 5, 3, ',', 1814);
  // estanque de setas al noroeste
  blob(g, 12, 9, 4, 3, '~', 1815);
  // caminos
  road(g, [[53, 30], [38, 30], [38, 22], [30, 22]], '=');
  road(g, [[38, 22], [38, 13], [42, 13]], '=');
  road(g, [[24, 26], [24, 31]], '=');
  // cabaña de Fenna
  house(g, 40, 9, 6);
  // claro del mini-jefe (sur)
  blob(g, 24, 33, 7, 4, '.', 1816);
  // claro del oeste (altar de la savia) cerrado por un cerco de árboles; la
  // única entrada son troncos caídos HOY y un sendero AYER
  rect(g, 2, 21, 11, 13, '.');
  outline(g, 1, 20, 13, 15, 'p');
  blob(g, 7, 27, 4, 4, ',', 1817);
  for (const [x, y] of [[42, 13], [24, 22], [24, 33], [7, 27], [47, 30], [30, 6], [18, 36], [5, 25]] as [number, number][]) clear(g, x, y, 1);
  road(g, [[24, 26], [24, 27], [14, 27]], '=');
  for (let y = 26; y <= 28; y++) set(g, 13, y, 'R');
  const pres = g;
  const past = clone(g);
  // AYER: donde hoy hay troncos caídos había un sendero abierto
  for (let y = 26; y <= 28; y++) set(past, 13, y, '=');
  // AYER: el estanque era más grande y limpio; el claro tenía flores
  blob(past, 12, 9, 5, 4, '~', 1815);
  blob(past, 24, 19, 4, 2, 'c', 1818);
  return {
    id: 'hondonada', name: 'Hondonada de las Raíces', subtitle: 'El Árbol Viejo llora ceniza · Zona 4-6',
    w: W, h: H, rows: toRows(pres), epochDiffs: diff(pres, past), music: 'forest',
    npcs: [{ id: 'fenna', x: 42, y: 13, sprite: 'fenna', name: 'Fenna, la herbolaria' }],
    chests: [{ id: 'ho1', x: 5, y: 25, gold: 70, potions: 1, needPast: true }],
    echoes: [{ id: 'ho_e1', x: 30, y: 6, title: 'La savia que recuerda', text: 'Las raíces del Árbol Viejo bebían del Canto. Cuando el dios calló, el árbol siguió bebiendo… y solo encontró ceniza. Dicen que aún espera la nota que le falta.' }],
    spawns: [
      { type: 'arana', x: 18, y: 12, patrol: 3 }, { type: 'arana', x: 33, y: 28, patrol: 3 },
      { type: 'arana', x: 44, y: 24, patrol: 3 }, { type: 'arana', x: 16, y: 36, patrol: 3 },
      { type: 'raiz', x: 28, y: 16, patrol: 2, needPresent: true }, { type: 'raiz', x: 20, y: 23, patrol: 2, needPresent: true },
      { type: 'raiz', x: 34, y: 36, patrol: 2, needPresent: true },
      { type: 'lobo', x: 46, y: 36, patrol: 3 },
      { type: 'ciervo', x: 24, y: 34, zone: 'boss', patrol: 0 },
    ],
    exits: [{ x: 52, y: 29, w: 2, h: 3, to: 'bosque', tx: 3, ty: 30, label: 'Bosque Susurrante' }],
    props: [
      { id: 'sanc_ho', kind: 'sanctuary', x: 47, y: 30 },
      { id: 'arbolviejo_ho', kind: 'arbolviejo', x: 24, y: 18 },
      { id: 'altar_savia', kind: 'altarsavia', x: 7, y: 27, needPast: true, label: 'Altar de la savia' },
      { id: 'sign_ho', kind: 'woodsign', x: 49, y: 28, label: 'Hondonada de las Raíces' },
      { id: 'restos_ho', kind: 'remains', x: 18, y: 36, label: 'Un druida caído' },
    ],
  };
}

// ================================================================ ACANTILADOS DEL FARO VIEJO
function buildAcantilado(): MapDef {
  const W = 54, H = 40;
  const g = grid(W, H, '.');
  // acantilado norte y bordes de roca
  rect(g, 0, 0, W, 2, '#');
  border(g, 1, 'R');
  scatter(g, 2, 2, 51, 20, ',', 0.12, 1821);
  // mar al oeste y al sur con playa de arena
  for (let y = 0; y < H; y++) {
    const wave = 3 + Math.round(1.5 * Math.sin(y * 0.5));
    for (let x = 0; x < wave; x++) set(g, x, y, '~');
    for (let x = wave; x < wave + 2; x++) if (get(g, x, y) !== '#') set(g, x, y, 's');
  }
  for (let x = 0; x < W; x++) {
    const wave = 34 + Math.round(1.2 * Math.sin(x * 0.4));
    for (let y = wave; y < H; y++) set(g, x, y, '~');
    for (let y = wave - 3; y < wave; y++) if (get(g, x, y) === '.' || get(g, x, y) === ',') set(g, x, y, 's');
  }
  // promontorio del Faro Viejo (noroeste)
  blob(g, 9, 9, 4, 3, ':', 1822);
  // cabaña de Bram
  house(g, 32, 6, 6);
  // cueva de la marea (sur): anillo de roca con boca al norte
  outline(g, 17, 25, 15, 9, '#'); rect(g, 18, 26, 13, 7, 's');
  set(g, 24, 25, 's'); set(g, 25, 25, 's');
  // caleta del suroeste (marea alta hoy)
  blob(g, 7, 29, 3, 3, '~', 1823);
  // caminos
  road(g, [[53, 24], [40, 24], [40, 12], [36, 12]], '=');
  road(g, [[40, 18], [12, 18], [12, 12]], '=');
  road(g, [[24, 18], [24, 24]], '=');
  for (const [x, y] of [[36, 11], [9, 9], [24, 29], [14, 26], [44, 31], [47, 24], [7, 29], [28, 4]] as [number, number][]) clear(g, x, y, 1, get(g, x, y) === 's' ? 's' : '.');
  set(g, 7, 29, '~');
  const pres = g;
  const past = clone(g);
  // AYER: marea baja — la caleta era arena y se podía llegar a la tercera botella
  blob(past, 7, 29, 3, 3, 's', 1823);
  road(past, [[12, 26], [9, 28]], 's');
  // HOY: el paso a la caleta está hundido
  road(pres, [[12, 26], [10, 27]], '~');
  return {
    id: 'acantilado', name: 'Acantilados del Faro Viejo', subtitle: 'Lo que el mar devuelve · Zona 7-9',
    w: W, h: H, rows: toRows(pres), epochDiffs: diff(pres, past), music: 'costa',
    npcs: [{ id: 'bram', x: 36, y: 11, sprite: 'bram', name: 'Bram, el pescador' }],
    chests: [{ id: 'ac1', x: 28, y: 4, gold: 90, potions: 1 }],
    echoes: [{ id: 'ac_e1', x: 9, y: 9, title: 'El primer faro', text: 'Antes que el faro de Mara hubo este. Lo apagó un farero que no soportaba ver volver vacías las barcas. El mar se lo agradeció a su manera: le devolvió una botella cada día durante cuarenta años.' }],
    spawns: [
      { type: 'cangrejo', x: 14, y: 22, patrol: 3 }, { type: 'cangrejo', x: 30, y: 21, patrol: 3 },
      { type: 'cangrejo', x: 45, y: 30, patrol: 3 }, { type: 'cangrejo', x: 20, y: 31, patrol: 2 },
      { type: 'ahogado', x: 8, y: 22, patrol: 2, needPresent: true }, { type: 'ahogado', x: 36, y: 31, patrol: 2 },
      { type: 'neumo', x: 46, y: 15, patrol: 3 },
      { type: 'rey_cangrejo', x: 24, y: 30, zone: 'boss', patrol: 0 },
    ],
    exits: [{ x: 52, y: 23, w: 2, h: 3, to: 'costa', tx: 3, ty: 24, label: 'Costa de Bruma' }],
    props: [
      { id: 'sanc_ac', kind: 'sanctuary', x: 47, y: 24 },
      { id: 'faro_viejo', kind: 'faro', x: 9, y: 8 },
      { id: 'botella1', kind: 'botella', x: 14, y: 26, label: 'Una botella con mensaje' },
      { id: 'botella2', kind: 'botella', x: 44, y: 31, label: 'Una botella con mensaje' },
      { id: 'botella3', kind: 'botella', x: 7, y: 29, label: 'Una botella con mensaje' },
      { id: 'sign_ac', kind: 'woodsign', x: 49, y: 22, label: 'Acantilados del Faro Viejo' },
    ],
  };
}

// ================================================================ PANTANO DE LAS VELAS
function buildPantano(): MapDef {
  const W = 52, H = 40;
  const g = grid(W, H, '.');
  border(g, 2, 'p');
  // agua estancada en canales y pozas
  const r = mulberry32(1831);
  for (let i = 0; i < 16; i++) blob(g, 4 + r() * 44, 4 + r() * 32, 2 + r() * 3, 1.5 + r() * 2.5, '~', 1832 + i);
  scatter(g, 2, 2, 49, 37, ',', 0.2, 1833);
  scatter(g, 2, 2, 49, 37, 'p', 0.06, 1834);
  scatter(g, 2, 2, 49, 37, 'm', 0.05, 1835);
  // isla central (arena de la Viuda)
  blob(g, 26, 22, 6, 4, ':', 1836);
  // casa sobre pilotes de Ysolde
  house(g, 30, 6, 6);
  // pasarelas (presente: rotas a trozos)
  road(g, [[0, 20], [18, 20], [18, 22], [20, 22]], '=');
  road(g, [[18, 20], [18, 11], [32, 11]], '=');
  road(g, [[18, 22], [18, 31], [12, 31]], '=');
  road(g, [[32, 22], [40, 22], [40, 31]], '=');
  road(g, [[40, 22], [44, 22], [44, 15]], '=');
  for (const [x, y] of [[32, 11], [10, 8], [44, 14], [12, 32], [40, 32], [26, 22], [5, 21], [22, 36], [46, 34]] as [number, number][]) clear(g, x, y, 1);
  const pres = g;
  const past = clone(g);
  // HOY: la pasarela del este (isla → velas del este) está hundida
  road(pres, [[32, 22], [36, 22]], '~');
  // AYER: entera, y además un embarcadero hasta la vela del noroeste
  road(past, [[32, 22], [36, 22]], '=');
  road(past, [[18, 11], [10, 11], [10, 9]], '=');
  return {
    id: 'pantano', name: 'Pantano de las Velas', subtitle: 'Una llama por cada nombre · Zona 9-11',
    w: W, h: H, rows: toRows(pres), epochDiffs: diff(pres, past), music: 'aldea',
    npcs: [{ id: 'ysolde', x: 32, y: 10, sprite: 'ysolde', name: 'Ysolde, la de las velas' }],
    chests: [{ id: 'pa1', x: 46, y: 34, gold: 100, potions: 1 }],
    echoes: [{ id: 'pa_e1', x: 22, y: 36, title: 'El registro de Merrow', text: 'Merrow anotaba a sus muertos en el agua: una vela por nombre, para que el pantano los recordara. Cuando la Niebla se comió los nombres, las velas siguieron ardiendo por nadie.' }],
    spawns: [
      { type: 'fatuo', x: 10, y: 14, patrol: 3 }, { type: 'fatuo', x: 36, y: 28, patrol: 3 },
      { type: 'fatuo', x: 42, y: 10, patrol: 3 }, { type: 'fatuo', x: 14, y: 34, patrol: 3, needPresent: true },
      { type: 'espectro', x: 24, y: 14, patrol: 2 }, { type: 'espectro', x: 44, y: 30, patrol: 2, needPresent: true },
      { type: 'viuda', x: 26, y: 23, zone: 'boss', patrol: 0 },
    ],
    exits: [{ x: 0, y: 19, w: 2, h: 3, to: 'aldea', tx: 39, ty: 20, label: 'Aldea de Merrow' }],
    props: [
      { id: 'sanc_pa', kind: 'sanctuary', x: 5, y: 21 },
      { id: 'vela1', kind: 'vela', x: 10, y: 8, label: 'Una vela apagada' },
      { id: 'vela2', kind: 'vela', x: 44, y: 14, label: 'Una vela apagada' },
      { id: 'vela3', kind: 'vela', x: 12, y: 32, label: 'Una vela apagada' },
      { id: 'vela4', kind: 'vela', x: 40, y: 32, label: 'Una vela apagada' },
      { id: 'sign_pa', kind: 'woodsign', x: 4, y: 18, label: 'Pantano de las Velas' },
    ],
  };
}

// ================================================================ GLACIAR DEL ECO
function buildGlaciar(): MapDef {
  const W = 54, H = 40;
  const g = grid(W, H, 'S');
  border(g, 2, 'p');
  rect(g, 0, 0, W, 2, 'R');
  scatter(g, 2, 2, 51, 37, 'p', 0.07, 1841, 'S');
  scatter(g, 2, 2, 51, 37, 'R', 0.05, 1842, 'S');
  // lago helado y grietas
  blob(g, 30, 18, 8, 5, 'i', 1843);
  for (let x = 8; x < 20; x++) { set(g, x, 26, '~'); set(g, x, 27, '~'); if (x % 4 === 1) set(g, x, 28, '~'); }   // grieta (agua negra)
  // campamento de Haldor
  house(g, 9, 7, 5);
  // arena del Wendigo
  blob(g, 40, 30, 6, 4, 'S', 1844);
  // caminos
  road(g, [[0, 24], [24, 24], [24, 12], [14, 12]], '=');
  road(g, [[24, 24], [40, 24], [40, 26]], '=');
  set(g, 13, 26, '='); set(g, 13, 27, '='); set(g, 14, 26, '='); set(g, 14, 27, '=');   // puente de nieve sobre la grieta
  for (const [x, y] of [[12, 11], [30, 8], [44, 20], [22, 32], [40, 30], [5, 25], [46, 8], [16, 35]] as [number, number][]) clear(g, x, y, 1, 'S');
  const pres = g;
  const past = clone(g);
  // AYER: el lago era agua viva (cascada al norte) — hoy, hielo que se puede pisar
  blob(past, 30, 18, 8, 5, '~', 1843);
  road(past, [[24, 18], [22, 18]], '=');
  // AYER: un puente de madera cruzaba el lago por el sur
  road(past, [[24, 23], [36, 23]], '=');
  return {
    id: 'glaciar', name: 'Glaciar del Eco', subtitle: 'El coro congelado · Zona 10-12',
    w: W, h: H, rows: toRows(pres), epochDiffs: diff(pres, past), music: 'cumbres',
    npcs: [{ id: 'haldor', x: 12, y: 11, sprite: 'haldor', name: 'Haldor, el ermitaño' }],
    chests: [{ id: 'gl1', x: 46, y: 8, gold: 110, potions: 1 }],
    echoes: [{ id: 'gl_e1', x: 16, y: 35, title: 'El coro del glaciar', text: 'Los pastores de las Cumbres subían aquí a cantar al alba. La noche del Silencio cantaban; el frío los oyó y quiso quedarse con la canción. Siguen dentro, con la boca abierta, esperando el compás siguiente.' }],
    spawns: [
      { type: 'arpi', x: 20, y: 8, patrol: 3 }, { type: 'arpi', x: 44, y: 14, patrol: 3 },
      { type: 'lobo', x: 18, y: 30, patrol: 3 }, { type: 'lobo', x: 34, y: 34, patrol: 3 },
      { type: 'centinela', x: 30, y: 10, patrol: 2 }, { type: 'centinela', x: 48, y: 22, patrol: 2 },
      { type: 'arpi', x: 8, y: 32, patrol: 3, needPresent: true },
      { type: 'wendigo', x: 40, y: 31, zone: 'boss', patrol: 0 },
    ],
    exits: [{ x: 0, y: 23, w: 2, h: 3, to: 'cumbres', tx: 61, ty: 24, label: 'Cumbres Heladas' }],
    props: [
      { id: 'sanc_gl', kind: 'sanctuary', x: 5, y: 25 },
      { id: 'hoguera_gl', kind: 'hoguera', x: 14, y: 10 },
      { id: 'cristal1', kind: 'cristalhielo', x: 30, y: 8, label: 'Un cristal de hielo cantor' },
      { id: 'cristal2', kind: 'cristalhielo', x: 44, y: 20, label: 'Un cristal de hielo cantor' },
      { id: 'cristal3', kind: 'cristalhielo', x: 22, y: 32, label: 'Un cristal de hielo cantor' },
      { id: 'sign_gl', kind: 'woodsign', x: 4, y: 22, label: 'Glaciar del Eco' },
    ],
  };
}

export const R18_MAPS: Record<'molino' | 'hondonada' | 'acantilado' | 'pantano' | 'glaciar', MapDef> = {
  molino: buildMolino(),
  hondonada: buildHondonada(),
  acantilado: buildAcantilado(),
  pantano: buildPantano(),
  glaciar: buildGlaciar(),
};

/** Biomas: la sección se pinta con los pintores de su región. */
export const R18_BIOME: Readonly<Record<string, string>> = {
  molino: 'lunaris', hondonada: 'bosque', acantilado: 'costa', pantano: 'bosque', glaciar: 'cumbres',
};

// ================================================================ ENLACES
/** Abre el borde de un mapa existente con un camino + salida a una sección. */
interface Link { map: MapId; carve: [number, number, number, number]; exit: ExitDef }
const LINKS: Link[] = [
  { map: 'lunaris', carve: [59, 20, 5, 1], exit: { x: 62, y: 19, w: 2, h: 3, to: 'molino', tx: 3, ty: 20, label: 'Campos del Molino' } },
  { map: 'bosque', carve: [0, 30, 6, 1], exit: { x: 0, y: 29, w: 2, h: 3, to: 'hondonada', tx: 50, ty: 30, label: 'Hondonada de las Raíces' } },
  { map: 'costa', carve: [0, 24, 6, 1], exit: { x: 0, y: 23, w: 2, h: 3, to: 'acantilado', tx: 50, ty: 24, label: 'Acantilados del Faro Viejo' } },
  { map: 'aldea', carve: [38, 20, 6, 1], exit: { x: 42, y: 19, w: 2, h: 3, to: 'pantano', tx: 3, ty: 20, label: 'Pantano de las Velas' } },
  { map: 'cumbres', carve: [58, 24, 8, 1], exit: { x: 64, y: 23, w: 2, h: 3, to: 'glaciar', tx: 3, ty: 24, label: 'Glaciar del Eco' } },
];

/** Aplica los enlaces sobre los mapas ya construidos (idempotente). */
export function applyR18Links(maps: Partial<Record<MapId, MapDef>>): void {
  for (const L of LINKS) {
    const m = maps[L.map];
    if (!m || m.exits.some(e => e.to === L.exit.to)) continue;
    const rows = m.rows.map(r => r.split(''));
    const [x0, y0, w, h] = L.carve;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (rows[y] && rows[y][x] !== undefined) rows[y][x] = '=';
    // el hueco de la salida también se abre (2×3 en el borde)
    for (let y = L.exit.y; y < L.exit.y + L.exit.h; y++) for (let x = L.exit.x; x < L.exit.x + L.exit.w; x++) if (rows[y] && rows[y][x] !== undefined && !'=~'.includes(rows[y][x])) rows[y][x] = '.';
    m.rows = rows.map(r => r.join(''));
    // las diferencias de época de esas casillas se anulan (el camino existe en ambas)
    m.epochDiffs = m.epochDiffs.filter(d => !(d.y >= y0 && d.y < y0 + h && d.x >= x0 && d.x < x0 + w));
    m.exits.push({ ...L.exit });
  }
}

// ================================================================ MENOS COFRES SUELTOS
/**
 * R18: el mundo estaba sembrado de cofres «porque sí» (6 por mapa). Quedan 2
 * por región —sobre todo los que exigen el pasado— y el resto de su valor pasa
 * a recompensas que se GANAN: misiones secundarias, mini-jefes y reliquias.
 */
const CHESTS_FUERA: Partial<Record<MapId, string[]>> = {
  lunaris: ['l2', 'l4', 'l5', 'l6'],
  bosque: ['b1', 'b2', 'b3', 'b5'],
  cripta: ['c1', 'c3'],
  costa: ['co2', 'co3', 'co4'],
  aldea: ['a2', 'a3'],
  cumbres: ['cu1', 'cu2', 'cu3'],
};
export function pruneChests(maps: Partial<Record<MapId, MapDef>>): void {
  for (const [id, fuera] of Object.entries(CHESTS_FUERA)) {
    const m = maps[id as MapId];
    if (m && fuera) m.chests = m.chests.filter(c => !fuera.includes(c.id));
  }
}
