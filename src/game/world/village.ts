// ============================================================
// ECOS DE AELTHAR — Objetos de aldea sobre hierba (módulo world)
// Casos: 'H' pared casa · 'r' tejado · 'd' puerta · 'F' valla
//        'w' pozo · 'g' lápida · 'R' roca
// Contrato: paintVillage llamada por el despachador drawTile.
//
// R1-A4b (reintento · terreno y atmósfera):
//  · Tejado anti-gofre: cursos de 4 px alineados a coordenadas ABSOLUTAS
//    (dos 'r' vecinos comparten rejilla → cero costuras), juntas verticales
//    escalonadas cada 8 px con desfase alternado por curso y jitter 0-1 por
//    hash, destellos y tejas musgo/rotas sueltas, caballete iluminado solo
//    en la fila superior, alero con sombra sobre la pared (pintada por la
//    'H' inferior) y chimeneas de piedra 4×6 ocasionales.
//  · Paredes enlucidas con vigas en esquina, zócalo, ventanas con
//    reflejo y sombra de alero. Puerta con arco, bisagras y farol.
//  · Valla continua con postes rematados, travesaños con veta y alguna
//    tabla torcida que se rompe y cae (hash).
//  · Pozo con brocal octogonal, polea y cubo; lápidas y rocas con
//    3 variantes; sombras elípticas coherentes en todo objeto alto.
//
// NOTA de prerrender: buildGround pinta todos los tiles en UN solo
// canvas por orden de fila, así que el desbordamiento hacia ARRIBA
// (chimenea, horquilla del pozo) es seguro; nunca se desborda abajo.
// ============================================================

import { px, PAL, PAL_ROOF, isForest, type NeighborFn } from './palette';

/**
 * Hash local con avalancha completa (splitmix32) para decisiones por
 * posición. Motivo: el hash2 compartido SESGA en el rango de la aldea —
 * medido en la rejilla 52×38, sus deciles 5-9 salen vacíos (P(<0.15)≈0.30
 * y jamás supera 0.9), lo que disparaba chimeneas al 55% y anulaba tablas
 * torcidas. vh reparte uniforme: P(<0.15)=0.15, P(>0.9)=0.10.
 */
function vh(x: number, y: number): number {
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 1 | h) >>> 0;
  h = (h ^ (h + Math.imul(h ^ (h >>> 7), 61 | h))) >>> 0;
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

/** Vecino seguro: sin función de vecinos devuelve '?' (trata como expuesto). */
type At = (dx: number, dy: number) => string;

const isWallCh = (c: string): boolean => c === 'H' || c === 'd';
const isStoneCh = (c: string): boolean => c === ':' || c === '_' || c === '#' || c === 'P' || c === 'A';

// ------------------------------------------------------------
// Ayudantes de suelo y sombra (compartidos por los objetos sueltos)
// ------------------------------------------------------------

/** Elipse de contacto/sombra proyectada rgba(0,0,0,0.25), desplazada 1-2 px. */
function dropShadow(x: CanvasRenderingContext2D, X: number, Y: number, W: number): void {
  px(x, X + 1, Y, W - 2, 1, PAL.objShadow);
  px(x, X, Y + 1, W, 1, PAL.objShadow);
  if (W >= 6) px(x, X + 2, Y + 2, W - 4, 1, 'rgba(0,0,0,0.12)');
}

/** Base de hierba que imita a paintGrass para fundirse con los '.' vecinos. */
function grassBase(x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string): void {
  const X = tx * 16, Y = ty * 16;
  const bosque = isForest(mapId);
  const g0 = bosque ? '#3f6d3a' : '#4f8a46';
  const g1 = bosque ? '#396334' : '#467c3e';
  px(x, X, Y, 16, 16, vh(tx, ty) < 0.5 ? g0 : g1);
  for (let i = 0; i < 3; i++) {
    const hx = vh(tx * 4 + i + 9, ty * 7 + i + 2);
    if (hx < 0.4) {
      px(x, X + Math.floor(hx * 14), Y + 2 + Math.floor(vh(tx + i * 3, ty * 5 + i) * 12),
        1, 2, bosque ? PAL.grassBladeBosque : PAL.grassBlade);
    }
  }
}

/** Base de piedra idéntica al tile ':' de stone.ts (lápidas sobre la ruina). */
function stoneBase(x: CanvasRenderingContext2D, tx: number, ty: number): void {
  const X = tx * 16, Y = ty * 16;
  px(x, X, Y, 16, 16, PAL.stone);
  px(x, X, Y, 16, 1, PAL.stoneLight);
  if (vh(tx, ty) > 0.7) px(x, X + 3, Y + 9, 7, 1, PAL.stoneDark);
  px(x, X, Y, 16, 1, PAL.stoneLine);
  px(x, X, Y, 1, 16, PAL.stoneLine);
}

/** Elige suelo según los vecinos: piedra si toca piedra, si no hierba. */
function groundBase(x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string, nb: At): void {
  const stone = isStoneCh(nb(-1, 0)) || isStoneCh(nb(1, 0)) ||
    isStoneCh(nb(0, -1)) || isStoneCh(nb(0, 1));
  if (stone) stoneBase(x, tx, ty); else grassBase(x, tx, ty, mapId);
}

// ------------------------------------------------------------
// 'r' — Tejado continuo
// ------------------------------------------------------------

function paintRoof(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At): void {
  const X = tx * 16, Y = ty * 16;
  const contL = nb(-1, 0) === 'r', contR = nb(1, 0) === 'r';
  const contU = nb(0, -1) === 'r', contD = nb(0, 1) === 'r';
  // — Faldón: base plana + CURSOS de 4 px alineados a la coordenada ABSOLUTA.
  //   Nada depende de tx: dos 'r' vecinos comparten patrón → cero costuras y
  //   sin bandas de tono alternado (eso era lo que leía como gofre) —
  px(x, X, Y, 16, 16, PAL.roof);
  for (let py = 3; py < 16; py += 4) {
    px(x, X, Y + py, 16, 1, PAL.roofDark);         // sombra del solape (curso)
  }
  // — Tejas sueltas más oscuras (húmedas): 1-2 parches por curso, hash —
  for (let py = 0; py < 16; py += 4) {
    const ci = (Y + py) >> 2;
    const nDark = vh(ci * 29 + 3, ty * 7 + 5) < 0.5 ? 1 : 2;
    for (let d = 0; d < nDark; d++) {
      const w = 3 + Math.floor(vh(ci * 13 + d * 7 + 1, ty * 5 + d) * 3); // 3..5
      const dx = Math.floor(vh(ci * 17 + d * 3 + 2, ty * 11 + d + 1) * (16 - w));
      px(x, X + dx, Y + py, w, 3, PAL.roofMid);
    }
  }
  // — Juntas verticales escalonadas: cada 8 px, desfase alternado por curso
  //   con +2 para que NUNCA caigan en la columna de borde entre tiles (eso
  //   pintaba un acento vertical en cada costura); jitter 0-1 por hash de la
  //   posición ABSOLUTA → el patrón no se corta entre dos 'r' vecinos —
  for (let py = 0; py < 16; py++) {
    const gy = Y + py, ci = gy >> 2, ly = gy & 3;
    if (ly === 3) continue;                        // no cruza la costura
    const stag = (ci & 1) * 4 + 2;                 // offset alternado por fila
    for (let m = -1; m <= 1; m++) {
      let jx = X + stag + m * 8;
      jx += vh(jx * 2 + ci, ci * 5 + 3) < 0.5 ? 0 : 1; // jitter por hash
      if (jx < X || jx > X + 15) continue;
      // junta rota (hash): solo queda la mitad baja de la teja
      if (vh(jx * 3 + 1, ci * 7 + 2) < 0.2 && ly < 2) continue;
      px(x, jx, gy, 1, 1, PAL_ROOF.roofJoint);
    }
  }
  // — Vida del faldón: destello en el canto superior de alguna teja —
  for (let py = 0; py < 16; py += 4) {
    const ci = (Y + py) >> 2;
    if (vh(ci * 13 + 5, ty * 7 + 9) < 0.55) {
      const hx = X + 1 + Math.floor(vh(ci * 17 + 2, ty + 4) * 12);
      px(x, hx, Y + py, 2, 1, PAL_ROOF.roofShine);
    }
  }
  // teja con musgo o rota suelta (hash de posición)
  const mv = vh(tx * 5 + 2, ty * 7 + 1);
  if (mv < 0.12) {
    const mx = X + 2 + Math.floor(vh(tx + 3, ty * 3) * 10);
    const my = Y + 5 + Math.floor(vh(tx * 3, ty + 5) * 8);
    px(x, mx, my, 3, 2, PAL.mossTile);
    px(x, mx + 1, my - 1, 2, 1, PAL.mossTile);
  } else if (mv < 0.2) {
    const mx = X + 3 + Math.floor(vh(tx + 3, ty * 3) * 9);
    const my = Y + 5 + Math.floor(vh(tx * 3, ty + 5) * 7);
    px(x, mx, my, 3, 2, PAL.brokenTile);
    px(x, mx + 2, my + 2, 1, 1, PAL.brokenTile);
  }
  // caballete iluminado SOLO en la fila superior del tejado
  if (!contU) {
    px(x, X, Y, 16, 1, PAL.ridgeHi);
    px(x, X, Y + 1, 16, 1, PAL.ridge);
  }
  // limatesas laterales solo contra vecino que no es tejado ('r'-'r' limpio)
  if (!contL) { px(x, X, Y, 1, 16, PAL.brokenTile); px(x, X + 1, Y, 1, 16, PAL.roofDark); }
  if (!contR) { px(x, X + 15, Y, 1, 16, PAL.brokenTile); px(x, X + 14, Y, 1, 16, PAL.roofDark); }
  // canto del alero (bajo él, la 'H' pinta su propia sombra de 2-3 px)
  if (!contD) px(x, X, Y + 15, 16, 1, PAL.brokenTile);
  // chimenea ocasional: hash < 0.15 y vecino de arriba libre
  const up = nb(0, -1);
  const upFree = up === '.' || up === ',' || up === '=' || up === 'c' || up === 'm';
  if (vh(tx * 13 + 5, ty * 17 + 3) < 0.15 && upFree) {
    const cx = X + 4 + Math.floor(vh(tx * 7 + 1, ty * 3 + 2) * 8); // cuerpo de 4 px
    px(x, cx - 1, Y - 7, 6, 1, PAL.chimneyHi);     // tapa con vuelo
    px(x, cx, Y - 6, 4, 6, PAL.chimney);           // cuerpo de piedra 4×6
    px(x, cx, Y - 6, 1, 6, PAL.chimneyHi);         // luz en la cara oeste
    px(x, cx + 3, Y - 6, 1, 6, PAL.chimneyDark);   // sombra en la cara este
    px(x, cx + 1, Y - 6, 2, 2, PAL.chimneyMouth);  // boca oscura
  }
}

// ------------------------------------------------------------
// 'H' / 'd' — Pared compartida (enlucido, vigas, zócalo, alero)
// ------------------------------------------------------------

function wallBase(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At): void {
  const X = tx * 16, Y = ty * 16;
  // enlucido crema con motas sutiles
  px(x, X, Y, 16, 16, PAL.wall);
  for (let i = 0; i < 6; i++) {
    const hx = vh(tx * 6 + i * 3 + 1, ty * 8 + i + 4);
    const hy = vh(tx * 9 + i + 2, ty * 5 + i * 3 + 6);
    px(x, X + 1 + Math.floor(hx * 14), Y + 2 + Math.floor(hy * 10), 1, 1,
      hx < 0.5 ? PAL.wallDirt : PAL.wallHi);
  }
  // sombra proyectada por el alero (línea 2-3 px en la parte alta)
  if (nb(0, -1) === 'r') {
    px(x, X, Y, 16, 3, PAL.objShadow);
    px(x, X, Y + 3, 16, 1, 'rgba(0,0,0,0.12)');
  }
  // zócalo de piedra con juntas
  px(x, X, Y + 13, 16, 3, PAL.plinth);
  px(x, X, Y + 13, 16, 1, PAL.plinthHi);
  px(x, X, Y + 15, 16, 1, PAL.plinthDark);
  px(x, X + 2 + Math.floor(vh(tx * 3 + 5, ty + 9) * 11), Y + 14, 1, 2, PAL.plinthDark);
  px(x, X + 2 + Math.floor(vh(tx * 7 + 3, ty + 4) * 11), Y + 14, 1, 2, PAL.plinthDark);
  // vigas verticales SOLO en esquinas (el vecino horizontal no es pared)
  if (!isWallCh(nb(-1, 0))) {
    px(x, X, Y, 3, 16, PAL.beam);
    px(x, X + 1, Y, 1, 16, PAL.beamHi);
  }
  if (!isWallCh(nb(1, 0))) {
    px(x, X + 13, Y, 3, 16, PAL.beam);
    px(x, X + 13, Y, 1, 16, PAL.beamHi);
  }
}

/**
 * Ventanas: 1-2 por muro y nunca adyacentes, decididas por hash de posición.
 * Si el hash no eligió ninguna en todo el muro, se garantiza una junto a la
 * puerta (tile 'H' a la derecha de una 'd').
 */
function paintWindowIfAny(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At): void {
  const chOf = (ax: number) => nb(ax - tx, 0); // vecino por coordenada absoluta
  const q = (ax: number) => vh(ax * 9 + 1, ty * 13 + 7) < 0.34;
  let lx = tx, rx = tx;
  while (chOf(lx - 1) === 'H') lx--;
  while (chOf(rx + 1) === 'H') rx++;
  const winAt = (ax: number) => chOf(ax) === 'H' && q(ax) && !(chOf(ax - 1) === 'H' && q(ax - 1));
  let count = 0;
  for (let ax = lx; ax <= rx; ax++) if (winAt(ax)) count++;
  const mine = count > 0 ? winAt(tx) : chOf(tx - 1) === 'd';
  if (!mine) return;
  const wx = tx * 16 + 4, wy = ty * 16 + 4;
  px(x, wx, wy, 8, 8, PAL.winFrame);            // marco
  px(x, wx + 1, wy + 1, 6, 6, PAL.glass);       // cristal azulado
  px(x, wx + 1, wy + 6, 6, 1, PAL.glassDark);   // fondo del cristal
  px(x, wx + 3, wy + 1, 1, 1, PAL.glassHi);     // reflejo diagonal
  px(x, wx + 2, wy + 2, 1, 1, PAL.glassHi);
  px(x, wx + 1, wy + 3, 1, 1, PAL.glassHi);
  px(x, wx + 2, wy + 1, 1, 1, '#e6f2fa');
  px(x, wx + 4, wy + 1, 1, 6, PAL.winFrame);    // travesaño vertical
  px(x, wx + 1, wy + 4, 6, 1, PAL.winFrame);    // travesaño horizontal
  px(x, wx - 1, wy + 8, 10, 1, PAL.plinthHi);   // alféizar
}

// ------------------------------------------------------------
// 'd' — Puerta de tablones con arco, bisagras, pomo y farol
// ------------------------------------------------------------

function paintDoor(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At): void {
  const X = tx * 16, Y = ty * 16;
  wallBase(x, tx, ty, nb); // misma pared de fondo (los vecinos son 'H': sin vigas)
  // arco de piedra con dovela (clave) iluminada, marcado sobre la sombra
  px(x, X + 2, Y + 2, 12, 3, PAL.step);        // dintel de piedra
  px(x, X + 2, Y + 2, 12, 1, PAL.plinthHi);    // canto superior iluminado
  px(x, X + 2, Y + 4, 12, 1, PAL.stepDark);    // sombra del dintel
  px(x, X + 7, Y + 1, 2, 1, PAL.plinthHi);     // dovela central saliente
  // jambas
  px(x, X + 2, Y + 5, 1, 8, PAL.stepDark);
  px(x, X + 13, Y + 5, 1, 8, PAL.stepDark);
  // hoja de tablones con juntas y veta
  px(x, X + 3, Y + 5, 10, 8, PAL.doorMid);
  px(x, X + 3, Y + 5, 10, 1, PAL.door);
  px(x, X + 6, Y + 6, 1, 7, PAL.door);
  px(x, X + 10, Y + 6, 1, 7, PAL.door);
  px(x, X + 12, Y + 5, 1, 8, PAL.door);
  px(x, X + 4, Y + 8, 2, 1, '#8a6038');
  px(x, X + 7, Y + 10, 2, 1, '#8a6038');
  // bisagras de forja con remate metálico
  px(x, X + 3, Y + 6, 3, 1, PAL.iron);
  px(x, X + 3, Y + 10, 3, 1, PAL.iron);
  px(x, X + 6, Y + 6, 1, 1, '#8a8a96');
  px(x, X + 6, Y + 10, 1, 1, '#8a8a96');
  // pomo dorado
  px(x, X + 10, Y + 8, 2, 2, PAL.gold);
  px(x, X + 10, Y + 8, 1, 1, '#fff0b0');
  // escalón de piedra (sustituye al zócalo bajo la puerta)
  px(x, X + 2, Y + 13, 12, 3, PAL.step);
  px(x, X + 2, Y + 13, 12, 1, PAL.plinthHi);
  px(x, X + 2, Y + 15, 12, 1, PAL.stepDark);
  // farolillo colgante apagado (por hash) junto a la puerta
  if (vh(tx * 19 + 2, ty * 23 + 4) < 0.45) {
    px(x, X + 1, Y + 4, 2, 1, PAL.iron);        // brazo
    px(x, X + 1, Y + 5, 2, 1, PAL.iron);        // gancho
    px(x, X + 1, Y + 6, 2, 3, PAL.lanternOff);  // cuerpo
    px(x, X + 1, Y + 7, 2, 1, PAL.lanternGlass);// cristal apagado
    px(x, X + 1, Y + 9, 2, 1, PAL.iron);        // base
  }
}

// ------------------------------------------------------------
// 'F' — Valla continua (postes rematados + 2 travesaños con veta)
// ------------------------------------------------------------

function paintFence(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At, mapId: string): void {
  const X = tx * 16, Y = ty * 16;
  grassBase(x, tx, ty, mapId);
  const hL = nb(-1, 0) === 'F', hR = nb(1, 0) === 'F';
  const vU = nb(0, -1) === 'F', vD = nb(0, 1) === 'F';
  const q = vh(tx * 3 + 7, ty * 5 + 11);
  // tablas verticales de los tramos en columna (cruzan el borde si hay vecino)
  if (vU || vD) {
    const pT = vU ? Y : Y + 2;
    const pB = vD ? Y + 16 : Y + 13;
    for (const cx of [5, 10]) {
      px(x, X + cx, pT, 2, pB - pT, PAL.woodMid);
      px(x, X + cx, pT, 1, pB - pT, PAL.woodLight);
    }
  }
  // travesaños horizontales: cruzan el borde sin corte si el vecino es 'F'
  if (hL || hR) {
    const x0 = hL ? X : X + 6;
    const x1 = hR ? X + 16 : X + 10; // exclusivo
    for (const ry of [4, 10]) {
      px(x, x0, Y + ry, x1 - x0, 2, PAL.wood);
      px(x, x0, Y + ry + 2, x1 - x0, 1, PAL.woodDark); // sombra del travesaño
      px(x, x0 + Math.floor(vh(tx + ry, ty * 3) * 6), Y + ry, 3, 1, PAL.woodLight); // veta
    }
    // tabla torcida (hash): el travesaño alto se rompe y la punta cae
    if (q > 0.9) {
      const gC = vh(tx, ty) < 0.5 ? '#4f8a46' : '#467c3e';
      const bx = X + 4 + Math.floor(vh(tx * 5, ty + 2) * 7); // 4..10
      px(x, bx, Y + 4, 4, 2, gC);                  // rotura: se ve el fondo
      px(x, bx + 4, Y + 5, 2, 1, PAL.woodMid);     // astilla despegada
      px(x, bx + 5, Y + 6, 2, 1, PAL.woodDark);    // punta que cae torcida
    }
  }
  // poste con remate (uno por tile); torcido y más corto si está dañado
  const ps = q > 0.82 ? 1 : 0;
  const top = q > 0.82 ? Y + 4 : Y + 2;
  const h = Y + 13 - top;
  px(x, X + 6 + ps, top, 3, h, '#9a7848');
  px(x, X + 6 + ps, top, 1, h, PAL.woodLight);
  px(x, X + 8 + ps, top, 1, h, PAL.woodDark);
  if (q <= 0.82) {
    px(x, X + 5 + ps, Y + 1, 5, 1, PAL.woodLight);  // remate
    px(x, X + 6 + ps, Y, 3, 1, '#c8a878');          // punta
  }
  px(x, X + 5 + ps, Y + 13, 5, 1, PAL.woodDark);    // base del poste
  dropShadow(x, X + 7, Y + 14, 4);                  // sombra de contacto
}

// ------------------------------------------------------------
// 'w' — Pozo (brocal octogonal, polea, cubo, hierbas)
// ------------------------------------------------------------

function paintWell(x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string): void {
  const X = tx * 16, Y = ty * 16;
  grassBase(x, tx, ty, mapId);
  dropShadow(x, X + 3, Y + 14, 11);
  // horquilla de madera con viga y polea (sobresale hacia arriba)
  px(x, X + 3, Y - 6, 2, 10, PAL.woodMid);
  px(x, X + 3, Y - 6, 1, 10, PAL.woodLight);
  px(x, X + 11, Y - 6, 2, 10, PAL.woodMid);
  px(x, X + 11, Y - 6, 1, 10, PAL.woodLight);
  px(x, X + 2, Y - 8, 12, 2, PAL.wood);
  px(x, X + 2, Y - 7, 12, 1, PAL.woodDark);
  px(x, X + 6, Y - 7, 3, 3, PAL.winFrame);   // polea
  px(x, X + 7, Y - 6, 1, 1, '#20180f');      // eje
  px(x, X + 7, Y - 4, 1, 6, PAL.rope);       // cuerda
  // cubo colgando sobre la boca
  px(x, X + 6, Y + 2, 4, 1, PAL.woodDark);
  px(x, X + 6, Y + 3, 4, 2, PAL.woodMid);
  px(x, X + 6, Y + 4, 4, 1, PAL.iron);
  // brocal octogonal de piedra (8 lados simulados por filas)
  const ring: Array<[number, number, number]> = [
    [4, 5, 10], [5, 3, 12],
    [6, 2, 13], [7, 2, 13], [8, 2, 13], [9, 2, 13], [10, 2, 13], [11, 2, 13], [12, 2, 13], [13, 2, 13],
    [14, 3, 12], [15, 5, 10],
  ];
  for (const [ry, a, b] of ring) {
    const col = ry <= 5 ? PAL.stoneHi : ry >= 14 ? PAL.stoneDark : PAL.stoneLight;
    px(x, X + a, Y + ry, b - a + 1, 1, col);
  }
  px(x, X + 2, Y + 6, 1, 7, PAL.stoneHi);    // canto izquierdo iluminado
  px(x, X + 13, Y + 6, 1, 7, PAL.stoneDark); // canto derecho en sombra
  px(x, X + 5, Y + 13, 1, 1, PAL.stoneDark); // juntas del brocal
  px(x, X + 11, Y + 14, 1, 1, PAL.stoneDark);
  px(x, X + 4, Y + 7, 1, 1, PAL.stoneLight);
  // interior oscuro con reflejo de agua (2 px cian)
  const hole: Array<[number, number, number]> = [
    [6, 5, 10], [7, 4, 11], [8, 4, 11], [9, 4, 11], [10, 4, 11], [11, 4, 11], [12, 4, 11], [13, 5, 10],
  ];
  for (const [ry, a, b] of hole) px(x, X + a, Y + ry, b - a + 1, 1, PAL.wellDeep);
  px(x, X + 5, Y + 9, 6, 1, PAL.wellWater);
  px(x, X + 6, Y + 10, 4, 1, '#38a8b8');
  // hierbas en la base
  px(x, X + 2, Y + 14, 1, 2, PAL.grassBlade);
  px(x, X + 13, Y + 13, 1, 2, PAL.mossTile);
  px(x, X + 1, Y + 13, 1, 1, PAL.grassBlade);
}

// ------------------------------------------------------------
// 'g' — Lápida (3 variantes por hash)
// ------------------------------------------------------------

function paintGrave(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At, mapId: string): void {
  const X = tx * 16, Y = ty * 16;
  groundBase(x, tx, ty, mapId, nb);
  dropShadow(x, X + 4, Y + 13, 10);
  const v = vh(tx * 11 + 1, ty * 7 + 9);
  if (v < 0.34) {
    // variante redondeada
    px(x, X + 6, Y + 5, 4, 1, PAL.stoneHi);
    px(x, X + 5, Y + 6, 6, 1, PAL.stoneHi);
    px(x, X + 4, Y + 7, 8, 6, PAL.stoneLight);
    px(x, X + 4, Y + 7, 1, 6, PAL.stoneHi);
    px(x, X + 11, Y + 7, 1, 6, PAL.stoneDark);
    px(x, X + 4, Y + 13, 8, 1, PAL.stoneDark);
    px(x, X + 6, Y + 9, 4, 1, PAL.stoneDark);   // grabado: líneas
    px(x, X + 6, Y + 11, 3, 1, PAL.stoneDark);
  } else if (v < 0.67) {
    // variante puntiaguda
    px(x, X + 7, Y + 4, 2, 1, PAL.stoneHi);
    px(x, X + 6, Y + 5, 4, 1, PAL.stoneHi);
    px(x, X + 5, Y + 6, 6, 7, PAL.stoneLight);
    px(x, X + 5, Y + 6, 1, 7, PAL.stoneHi);
    px(x, X + 10, Y + 6, 1, 7, PAL.stoneDark);
    px(x, X + 5, Y + 13, 6, 1, PAL.stoneDark);
    px(x, X + 7, Y + 8, 1, 4, PAL.stoneDark);   // grabado: línea vertical
  } else {
    // losa con cruz pequeña
    px(x, X + 7, Y + 3, 2, 5, PAL.stoneLight);
    px(x, X + 7, Y + 3, 2, 1, PAL.stoneHi);
    px(x, X + 5, Y + 4, 6, 2, PAL.stoneLight);
    px(x, X + 4, Y + 7, 8, 6, PAL.stoneLight);
    px(x, X + 4, Y + 7, 8, 1, PAL.stoneHi);
    px(x, X + 4, Y + 7, 1, 6, PAL.stoneHi);
    px(x, X + 11, Y + 7, 1, 6, PAL.stoneDark);
    px(x, X + 4, Y + 12, 8, 1, PAL.stoneDark);
    px(x, X + 7, Y + 9, 1, 3, PAL.stoneDark);   // grabado: cruz
    px(x, X + 6, Y + 10, 3, 1, PAL.stoneDark);
  }
  // hierbajos en la base
  px(x, X + 3, Y + 12, 1, 2, PAL.grassBlade);
  px(x, X + 12, Y + 13, 1, 2, PAL.mossTile);
  px(x, X + 11, Y + 12, 1, 1, PAL.grassBlade);
}

// ------------------------------------------------------------
// 'R' — Roca (3 variantes; se fusiona con vecinas 'R' en ruinas)
// ------------------------------------------------------------

function paintRock(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At, mapId: string): void {
  const X = tx * 16, Y = ty * 16;
  groundBase(x, tx, ty, mapId, nb);
  const eL = nb(-1, 0) === 'R', eR = nb(1, 0) === 'R';
  const eU = nb(0, -1) === 'R', eD = nb(0, 1) === 'R';
  // sombra elíptica al suelo (omitida entre rocas apiladas)
  if (!eD) dropShadow(x, X + 3, Y + 14, 11);
  // extremos: si el vecino es 'R', la silueta llega al borde (montón fusionado)
  const L = eL ? 0 : 3, R = eR ? 15 : 13;
  const T = eU ? 0 : 5, B = eD ? 15 : 14;
  const w = R - L + 1;
  const v = vh(tx * 17 + 3, ty * 13 + 1);
  if (v < 0.34) {
    // roca grande facetada
    px(x, X + L, Y + T, w, B - T + 1, PAL.stoneLight);
    if (!eU) {
      px(x, X + L + (eL ? 0 : 1), Y + T, w - (eL ? 0 : 1) - (eR ? 0 : 1), 1, PAL.stoneHi);
      px(x, X + L + 2, Y + T + 1, 3, 1, PAL.moss);       // musgo en cara norte
      px(x, X + L + 1, Y + T + 2, 2, 1, PAL.moss);
    }
    if (!eL) px(x, X + L, Y + T + 1, 1, B - T, PAL.stoneHi);   // cara iluminada
    if (!eR) px(x, X + R, Y + T + 1, 1, B - T, PAL.stoneDark); // faceta en sombra
    if (!eD) px(x, X + L, Y + B, w, 1, PAL.stoneDark);
    px(x, X + L + 2, Y + T + 3, 3, 3, PAL.stoneHi);            // brillo NO
    px(x, X + R - 4, Y + B - 4, 4, 3, PAL.stoneDark);          // sombra SE
    // grietas
    px(x, X + 8, Y + T + 3, 1, 2, PAL.stoneVein);
    px(x, X + 9, Y + T + 5, 1, 2, PAL.stoneVein);
    px(x, X + 7, Y + T + 7, 1, 2, PAL.stoneVein);
  } else if (v < 0.67) {
    // piedras apiladas (de arriba abajo)
    const t0 = eL ? L : L + 4, t1 = eR ? R : R - 4;
    const ts = Math.max(T, B - 10);
    px(x, X + t0, Y + ts, t1 - t0 + 1, B - 8 - ts + 1, PAL.stoneLight);
    px(x, X + t0, Y + ts, t1 - t0 + 1, 1, PAL.stoneHi);
    if (!eU) px(x, X + t0 + 1, Y + ts, 2, 1, PAL.moss);
    const m0 = eL ? L : L + 2, m1 = eR ? R : R - 1;
    px(x, X + m0, Y + B - 7, m1 - m0 + 1, 3, PAL.stoneLight);
    px(x, X + m0, Y + B - 7, m1 - m0 + 1, 1, PAL.stoneHi);
    px(x, X + m0, Y + B - 5, m1 - m0 + 1, 1, PAL.stoneDark);
    px(x, X + L, Y + B - 3, w, 3, PAL.stoneLight);
    px(x, X + L, Y + B - 3, w, 1, PAL.stoneHi);
    px(x, X + L, Y + B - 1, w, 1, PAL.stoneDark);
    px(x, X + m0 + 2, Y + B - 6, 1, 1, PAL.stoneVein);         // grieta
  } else {
    // laja plana
    const sy = eD ? B - 3 : Math.max(T, B - 5);
    px(x, X + L, Y + sy, w, 2, PAL.stoneHi);                    // cara superior
    px(x, X + L, Y + sy + 2, w, Math.max(1, B - sy - 2), PAL.stoneLight); // canto
    px(x, X + L, Y + B, w, 1, PAL.stoneDark);
    px(x, X + L + 4, Y + sy, 1, 2, PAL.stoneVein);              // grieta
    if (!eU) px(x, X + L + (eL ? 1 : 3), Y + sy, 3, 1, PAL.mossTile); // musgo norte
  }
}

// ------------------------------------------------------------
// Despachador del módulo (firma intacta)
// ------------------------------------------------------------

export function paintVillage(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, at?: NeighborFn,
): void {
  void t; // prerrender estático (t=0); los objetos de aldea no animan
  const nb: At = at ?? (() => '?');
  switch (ch) {
    case 'H': // pared casa: base + ventana(s) por hash
      wallBase(x, tx, ty, nb);
      paintWindowIfAny(x, tx, ty, nb);
      return;
    case 'r': paintRoof(x, tx, ty, nb); return;
    case 'd': paintDoor(x, tx, ty, nb); return;
    case 'F': paintFence(x, tx, ty, nb, mapId); return;
    case 'w': paintWell(x, tx, ty, mapId); return;
    case 'g': paintGrave(x, tx, ty, nb, mapId); return;
    case 'R': paintRock(x, tx, ty, nb, mapId); return;
  }
}
