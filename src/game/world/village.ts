// ============================================================
// ECOS DE AELTHAR — Objetos de aldea sobre hierba (módulo world)
// Casos (VERIFICADO contra maps.ts): 'H' pared casa · 'r' tejado
//        'd' puerta · 'F' valla del huerto · 'w' pozo
//        'g' lápida · 'R' roca
// (las VENTANAS se pintan sobre los muros 'H'; el cultivo del
//  huerto es 'c' → módulo grass.ts; el camino de tierra es '='
//  y cae en el default del dispatcher, fuera de este módulo).
// Contrato: paintVillage llamada por el despachador drawTile.
//
// R4-A8 (aldea v3 · mundo y detalle):
//  · TEJADOS V3 — 3 MATERIALES POR CASA (teja roja curada,
//    pizarra gris-azulada, paja dorada) asignados por hash del
//    BLOQUE de casa: flood-fill ligero por continuidad de
//    'r'/'H'/'d' (4-dir) → todas las tejas del mismo bloque
//    comparten material (ancla = teja mínima del bloque). Filas
//    de tejas desplazadas 1px por curso (herringbone simple,
//    rejilla en coordenadas ABSOLUTAS → cero costuras entre
//    vecinos), cumbrera con lomo iluminado de 1px y chimenea
//    con remate en ~1/3 de las casas (1 por bloque, teja elegida
//    por hash mínimo del bloque).
//  · MUROS — sillares de madera (pizarra) o enlucido (teja/paja,
//    ésta con tinte cálido) según el material del bloque, viga
//    maestra horizontal de 1px (Y+4, enlaza dintel y ventanas) y
//    sombra del alero de 2px + fundido sobre el muro.
//  · VENTANAS — 2 variantes por hash (cuadrícula 2×2 y buhardilla
//    redondeada); de noche se iluminan vía drawVillageWindowsNight
//    (capa animada aparte, inerte hasta que el integrador la
//    conecte — ver nota al final del archivo).
//  · PUERTAS — hoja de tablones con ARCO superior (esquinas
//    recortadas), herrajes de forja y pomo de 1px; por hash
//    algunas quedan entornadas 1-2px con interior oscuro.
//  · HUERTO — la valla 'F' v2 se mantiene; los huertos grandes
//    (bloque de valla con bbox ≥6×5) estrenan UN espantapájaros
//    (poste + brazos + camisa + cabeza de saco + sombrero,
//    ~8×12px, en la valla norte del recinto). Los surcos del
//    cultivo viven en 'c' (grass.ts), no aquí.
//  · ROCAS — piedritas sueltas al pie (hash).
//
// NOTA de prerrender: buildGround pinta todos los tiles en UN solo
// canvas por orden de fila, así que el desbordamiento hacia ARRIBA
// (chimenea, horquilla del pozo) es seguro; nunca se desborda abajo.
//
// INTEGRADOR — capa de ventanas encendidas:
//   setVillageNight(nf) con nf = factor de noche 0..1 (derivar de
//   g.dayT como nightFactor en props.ts) y luego, en render.drawWorld
//   dentro del save/restore con translate de cámara (mismo convenio
//   que waterOverlay/drawTreeCanopy):
//     drawVillageWindowsNight(ctx, Math.round(g.camX), Math.round(g.camY),
//       g.mapId, g.globalT, (tx,ty) => tileAt(g.map, g.rows, tx, ty, g.epoch));
//   camX/camY en px de PANTALLA (con ZOOM); el dibujo sale en px de
//   MUNDO (lo recorta el translate). `at` es ABSOLUTO aquí. Sin
//   llamada (o con nf=0) la función es un no-op barato.
// ============================================================

import { px, PAL, PAL_ROOF, isForest, type NeighborFn } from './palette';
import { VIEW_W, VIEW_H, ZOOM } from '../consts';

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
/** Consulta ABSOLUTA (convenio de las capas animadas: waterOverlay/trees). */
type AbsAt = (tx: number, ty: number) => string;

const isWallCh = (c: string): boolean => c === 'H' || c === 'd';
const isStoneCh = (c: string): boolean => c === ':' || c === '_' || c === '#' || c === 'P' || c === 'A';

// ------------------------------------------------------------
// Paletas locales v3 (política aditiva: PAL intacta)
// ------------------------------------------------------------

// Pizarra gris-azulada (material 1)
const SLATE = {
  base: '#57627a', seam: '#3f485c', joint: '#48536a', hi: '#6e7c96',
  shine: '#8ea0ba', patch: '#4c5870', ridge: '#8a98b2', ridgeHi: '#aab8ce',
  verge: '#333c4e', eave: '#3a4356',
} as const;
// Paja dorada (material 2)
const THATCH = {
  base: '#c19c4e', seam: '#8a6a2c', light: '#d6b264', stitch: '#7a5e26',
  ridge: '#9a7834', ridgeHi: '#c8a452', verge: '#6e5420', eave: '#7a5e26',
} as const;
// Sillares de madera (muro de las casas de pizarra)
const PLANK = {
  base: '#96744a', line: '#6a4e30', hi: '#b08a5a', post: '#5a422a', postHi: '#7a5c3a',
} as const;
// Enlucido cálido (muro de las casas de paja)
const PLASTER_WARM = { base: '#e8d4a4', hi: '#f6e8c6', dirt: '#cbb282' } as const;
// Interior oscuro de las puertas entornadas
const DOOR_IN = '#241a12';
// Espantapájaros
const SC = {
  shirt: '#9a5a40', shirtHi: '#b87458', patch: '#c89068',
  sack: '#d8c090', sackHi: '#e8d4a8', face: '#3a3020',
  brim: '#b89040', crown: '#caa050', band: '#8a6a2c', straw: '#c8a850',
} as const;
// Ventanas encendidas de noche
const NIGHT_WARM = '#ffb054';
const NIGHT_GLASS = '#e8a44e';
const NIGHT_CORE = '#ffd98a';
const NIGHT_HOT = '#fff3c8';

// ------------------------------------------------------------
// Bloques de casa (flood-fill ligero) — material y chimenea
// ------------------------------------------------------------

const HOUSE_CHARS = new Set(['r', 'H', 'd']);

interface HouseBlock {
  mat: number;     // 0 teja · 1 pizarra · 2 paja
  chim: boolean;   // el bloque tiene chimenea (~1/3)
  chimTx: number;  // teja del tejado que la dibuja (hash mínimo)
  chimTy: number;
}

/** Caché por mapId: el resultado es una función pura del grid, la caché
 *  solo ahorra el flood-fill. Acotada por si acaso. */
const houseCache = new Map<string, Map<string, HouseBlock>>();

function houseBlockAt(tx0: number, ty0: number, mapId: string, nb: At): HouseBlock {
  let cache = houseCache.get(mapId);
  if (!cache) { cache = new Map(); houseCache.set(mapId, cache); }
  const key = `${tx0},${ty0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const seen = new Set<string>();
  const stack: Array<[number, number]> = [[tx0, ty0]];
  let ax = tx0, ay = ty0;                 // ancla: teja mínima (y, luego x)
  let chimTx = -1, chimTy = -1, chimBest = 2;
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    const k = `${cx},${cy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (!HOUSE_CHARS.has(nb(cx - tx0, cy - ty0))) continue;
    if (cy < ay || (cy === ay && cx < ax)) { ax = cx; ay = cy; }
    if (nb(cx - tx0, cy - ty0) === 'r') {
      const h = vh(cx * 5 + 3, cy * 9 + 7);
      if (h < chimBest) { chimBest = h; chimTx = cx; chimTy = cy; }
    }
    stack.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
  }
  const info: HouseBlock = {
    mat: Math.floor(vh(ax * 3 + 11, ay * 7 + 5) * 3),
    chim: chimTx >= 0 && vh(ax * 13 + 1, ay * 5 + 9) < 0.34,
    chimTx, chimTy,
  };
  if (cache.size > 8192) cache.clear();
  cache.set(key, info);
  return info;
}

/** Material del bloque de casa en (tx,ty): 0 teja · 1 pizarra · 2 paja.
 *  Export de prueba/integración (puro, determinista). */
export function houseMaterialAt(tx: number, ty: number, mapId: string, at: NeighborFn): number {
  return houseBlockAt(tx, ty, mapId, at).mat;
}

// ------------------------------------------------------------
// Bloques de valla (huerto) — tamaño y espantapájaros
// ------------------------------------------------------------

interface FenceBlock { big: boolean; scTx: number; scTy: number }
const fenceCache = new Map<string, Map<string, FenceBlock>>();

function fenceBlockAt(tx0: number, ty0: number, mapId: string, nb: At): FenceBlock {
  let cache = fenceCache.get(mapId);
  if (!cache) { cache = new Map(); fenceCache.set(mapId, cache); }
  const key = `${tx0},${ty0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const seen = new Set<string>();
  const stack: Array<[number, number]> = [[tx0, ty0]];
  let minX = tx0, maxX = tx0, minY = ty0, maxY = ty0;
  const tiles: Array<[number, number]> = [];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    const k = `${cx},${cy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (nb(cx - tx0, cy - ty0) !== 'F') continue;
    tiles.push([cx, cy]);
    if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    stack.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
  }
  const big = maxX - minX + 1 >= 6 && maxY - minY + 1 >= 5;
  // espantapájaros: valla norte, el tramo recto (hL && hR && sin valla
  // vertical) MÁS A LA IZQUIERDA — barrido completo para que el resultado no
  // dependa del orden de descubrimiento del flood-fill (origen de la consulta).
  // Si no hay tramo recto, el tile más a la izquierda de la fila norte.
  let scTx = -1, scTy = -1;
  if (big) {
    for (const pick of [true, false]) {
      for (const [cx, cy] of tiles) {
        if (cy !== minY) continue;
        if (pick) {
          const hL = nb(cx - 1 - tx0, cy - ty0) === 'F';
          const hR = nb(cx + 1 - tx0, cy - ty0) === 'F';
          const vU = nb(cx - tx0, cy - 1 - ty0) === 'F';
          const vD = nb(cx - tx0, cy + 1 - ty0) === 'F';
          if (!(hL && hR && !vU && !vD)) continue;
        }
        if (scTx < 0 || cx < scTx) { scTx = cx; scTy = cy; }
      }
      if (scTx >= 0) break;
    }
  }
  const info: FenceBlock = { big, scTx, scTy };
  if (cache.size > 8192) cache.clear();
  cache.set(key, info);
  return info;
}

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
// 'r' — Tejado v3 (3 materiales por BLOQUE de casa)
// ------------------------------------------------------------

function paintRoof(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At, mapId: string): void {
  const X = tx * 16, Y = ty * 16;
  const contL = nb(-1, 0) === 'r', contR = nb(1, 0) === 'r';
  const contU = nb(0, -1) === 'r', contD = nb(0, 1) === 'r';
  const mat = houseBlockAt(tx, ty, mapId, nb).mat;

  // — Faldón: base plana + CURSOS de 4 px alineados a la coordenada ABSOLUTA.
  //   Nada depende de tx en el patrón: dos 'r' vecinos comparten rejilla →
  //   cero costuras y sin bandas de tono alternado (anti-gofre R1). —
  const base = mat === 1 ? SLATE.base : mat === 2 ? THATCH.base : PAL.roof;
  const seam = mat === 1 ? SLATE.seam : mat === 2 ? THATCH.seam : PAL.roofDark;
  px(x, X, Y, 16, 16, base);
  for (let py = 3; py < 16; py += 4) {
    px(x, X, Y + py, 16, 1, seam);                 // sombra del solape (curso)
  }

  // — Textura por material, curso a curso (rejilla absoluta) —
  for (let py = 0; py < 16; py += 4) {
    const ci = (Y + py) >> 2;                      // curso ABSOLUTO
    if (mat === 2) {
      // PAJA: banda clara superior + costuras de hilo + flecos en el solape
      for (let k = 0; k < 16; k++) {
        const ax = X + k;
        if (vh(ax * 3 + ci, ci * 7 + 1) < 0.30) px(x, ax, Y + py, 1, 1, THATCH.light);
        // peines verticales 1×2 cada 5 px, desplazados 3 px por curso
        if (((ax - ci * 3) % 5 + 5) % 5 === 0) px(x, ax, Y + py + 1, 1, 2, THATCH.stitch);
        if (py + 3 < 16 && vh(ax * 7 + ci * 5, ci * 11 + 3) < 0.28) {
          px(x, ax, Y + py + 3, 1, 1, THATCH.base);  // fleco: rompe la línea de solape
        }
      }
    } else {
      // TEJA / PIZARRA: parches húmedos más oscuros (1-2 por curso)
      const patch = mat === 1 ? SLATE.patch : PAL.roofMid;
      const nDark = vh(ci * 29 + 3, ty * 7 + 5) < 0.5 ? 1 : 2;
      for (let d = 0; d < nDark; d++) {
        const w = 3 + Math.floor(vh(ci * 13 + d * 7 + 1, ty * 5 + d) * 3); // 3..5
        const dx = Math.floor(vh(ci * 17 + d * 3 + 2, ty * 11 + d + 1) * (16 - w));
        px(x, X + dx, Y + py, w, 3, patch);
      }
      // PIZARRA: brillo de lámina en el canto superior de ~60% de cursos
      if (mat === 1 && vh(ci * 13 + 5, 7) < 0.6) px(x, X, Y + py, 16, 1, SLATE.hi);
    }
  }

  // — Juntas verticales: cada 8 px, DESPLAZADAS 1px por curso (herringbone
  //   simple) con desfase 2..7 para que NUNCA caigan en la columna de borde;
  //   jitter 0-1 por hash de la posición ABSOLUTA (el patrón no se corta
  //   entre dos 'r' vecinos). La paja no tiene juntas: usa costuras. —
  if (mat !== 2) {
    const joint = mat === 1 ? SLATE.joint : PAL_ROOF.roofJoint;
    for (let py = 0; py < 16; py++) {
      const gy = Y + py, ci = gy >> 2, ly = gy & 3;
      if (ly === 3) continue;                      // no cruza la costura
      const stag = 2 + (ci % 6);                   // desplazamiento 1px/curso
      for (let m = -1; m <= 1; m++) {
        let jx = X + stag + m * 8;
        jx += vh(jx * 2 + ci, ci * 5 + 3) < 0.5 ? 0 : 1; // jitter por hash
        if (jx < X || jx > X + 15) continue;
        // junta rota (hash): solo queda la mitad baja de la teja
        if (vh(jx * 3 + 1, ci * 7 + 2) < 0.2 && ly < 2) continue;
        px(x, jx, gy, 1, 1, joint);
      }
    }
  }

  // — Vida del faldón: destello en el canto de alguna teja (teja/pizarra) —
  if (mat !== 2) {
    const shine = mat === 1 ? SLATE.shine : PAL_ROOF.roofShine;
    for (let py = 0; py < 16; py += 4) {
      const ci = (Y + py) >> 2;
      if (vh(ci * 13 + 5, ty * 7 + 9) < 0.55) {
        const hx = X + 1 + Math.floor(vh(ci * 17 + 2, ty + 4) * 12);
        px(x, hx, Y + py, 2, 1, shine);
      }
    }
  }
  // desgaste suelto: musgo / teja rota / paja apelmazada (hash de posición)
  const mv = vh(tx * 5 + 2, ty * 7 + 1);
  if (mat === 0 && mv < 0.12) {
    const mx = X + 2 + Math.floor(vh(tx + 3, ty * 3) * 10);
    const my = Y + 5 + Math.floor(vh(tx * 3, ty + 5) * 8);
    px(x, mx, my, 3, 2, PAL.mossTile);
    px(x, mx + 1, my - 1, 2, 1, PAL.mossTile);
  } else if (mat === 0 && mv < 0.2) {
    const mx = X + 3 + Math.floor(vh(tx + 3, ty * 3) * 9);
    const my = Y + 5 + Math.floor(vh(tx * 3, ty + 5) * 7);
    px(x, mx, my, 3, 2, PAL.brokenTile);
    px(x, mx + 2, my + 2, 1, 1, PAL.brokenTile);
  } else if (mat === 1 && mv < 0.16) {
    const mx = X + 2 + Math.floor(vh(tx + 3, ty * 3) * 10);
    const my = Y + 5 + Math.floor(vh(tx * 3, ty + 5) * 8);
    px(x, mx, my, 3, 2, PAL.mossTile);             // la pizarra musga
  } else if (mat === 2 && mv < 0.14) {
    const mx = X + 3 + Math.floor(vh(tx + 3, ty * 3) * 9);
    const my = Y + 6 + Math.floor(vh(tx * 3, ty + 5) * 6);
    px(x, mx, my, 3, 2, THATCH.seam);              // paja apelmazada
  }

  // — Cumbrera con LOMO de 1px (solo en la fila superior del tejado) —
  if (!contU) {
    const rHi = mat === 1 ? SLATE.ridgeHi : mat === 2 ? THATCH.ridgeHi : PAL.ridgeHi;
    const r = mat === 1 ? SLATE.ridge : mat === 2 ? THATCH.ridge : PAL.ridge;
    px(x, X, Y, 16, 1, rHi);                       // lomo iluminado 1px
    px(x, X, Y + 1, 16, 1, r);                     // sombra del lomo
  }
  // — Limatesas laterales solo contra vecino que no es tejado —
  const verge = mat === 1 ? SLATE.verge : mat === 2 ? THATCH.verge : PAL.brokenTile;
  if (!contL) { px(x, X, Y, 1, 16, verge); px(x, X + 1, Y, 1, 16, seam); }
  if (!contR) { px(x, X + 15, Y, 1, 16, verge); px(x, X + 14, Y, 1, 16, seam); }
  // — Canto del alero (bajo él, la 'H' pinta su sombra de 2px) —
  const eave = mat === 1 ? SLATE.eave : mat === 2 ? THATCH.eave : PAL.brokenTile;
  if (!contD) px(x, X, Y + 15, 16, 1, eave);

  // — CHIMENEA: 1 por bloque en ~1/3 de las casas; la dibuja UNA sola teja
  //   (la de hash mínimo del faldón) y solo si el vecino de arriba es suelo
  //   blando (el desbordamiento hacia arriba es seguro en el prerrender). —
  const blk = houseBlockAt(tx, ty, mapId, nb);
  if (blk.chim && tx === blk.chimTx && ty === blk.chimTy) {
    const up = nb(0, -1);
    const upFree = up === '.' || up === ',' || up === '=' || up === 'c' || up === 'm';
    if (upFree) {
      const cx = X + 4 + Math.floor(vh(tx * 7 + 1, ty * 3 + 2) * 8); // cuerpo de 4 px
      px(x, cx - 1, Y - 9, 6, 1, PAL.chimneyHi);   // REMATE: copete con vuelo
      px(x, cx - 1, Y - 8, 6, 1, PAL.chimneyDark); // canto inferior del remate
      px(x, cx, Y - 7, 4, 7, PAL.chimney);         // cuerpo de piedra 4×7
      px(x, cx, Y - 7, 1, 7, PAL.chimneyHi);       // luz en la cara oeste
      px(x, cx + 3, Y - 7, 1, 7, PAL.chimneyDark); // sombra en la cara este
      px(x, cx + 1, Y - 7, 2, 2, PAL.chimneyMouth);// boca oscura
      px(x, cx, Y - 4, 4, 1, PAL.chimneyDark);     // sillería: junta
      px(x, cx, Y - 2, 4, 1, PAL.chimneyDark);     // sillería: junta
      px(x, cx + 1, Y - 3, 1, 1, PAL.chimneyHi);   // sillar iluminado suelto
    }
  }
}

// ------------------------------------------------------------
// 'H' / 'd' — Pared v3 (material del bloque, viga maestra, alero)
// ------------------------------------------------------------

function wallBase(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At, mat: number): void {
  const X = tx * 16, Y = ty * 16;
  if (mat === 1) {
    // SILLARES DE MADERA: tablones horizontales con extremos escalonados
    px(x, X, Y, 16, 16, PLANK.base);
    for (let b = 0; b < 4; b++) {
      const bandY = Y + b * 4;
      const ci = (Y + b * 4) >> 2;                 // curso ABSOLUTO
      px(x, X, bandY + 3, 16, 1, PLANK.line);      // junta del tablón
      // extremos de tablón: rejilla absoluta cada 10 px, desfase por curso
      const stag = ((ci * 5) % 10 + 10) % 10;
      const start = X + (((stag - (X % 10)) % 10) + 10) % 10;
      for (let jx = start; jx < X + 16; jx += 10) {
        px(x, jx, bandY, 1, 3, PLANK.line);
        px(x, jx, bandY, 1, 1, PLANK.hi);
      }
      // veta del tablón
      px(x, X + 2 + Math.floor(vh(ci * 7 + 1, tx * 3 + b) * 10), bandY + 1, 3, 1, PLANK.hi);
    }
  } else {
    // ENLUCIDO (teja: crema · paja: cálido) con motas sutiles
    const W = mat === 2 ? PLASTER_WARM : { base: PAL.wall, hi: PAL.wallHi, dirt: PAL.wallDirt };
    px(x, X, Y, 16, 16, W.base);
    for (let i = 0; i < 6; i++) {
      const hx = vh(tx * 6 + i * 3 + 1, ty * 8 + i + 4);
      const hy = vh(tx * 9 + i + 2, ty * 5 + i * 3 + 6);
      px(x, X + 1 + Math.floor(hx * 14), Y + 2 + Math.floor(hy * 10), 1, 1,
        hx < 0.5 ? W.dirt : W.hi);
    }
  }
  // — Sombra proyectada por el alero: 2px + fundido (el tejado cae sobre
  //   el muro) —
  if (nb(0, -1) === 'r') {
    px(x, X, Y, 16, 2, PAL.objShadow);
    px(x, X, Y + 2, 16, 1, 'rgba(0,0,0,0.12)');
  }
  // — VIGA MAESTRA horizontal de 1px (Y+4): enlaza los dinteles de puerta
  //   y el borde superior de las ventanas; el vecino 'H'/'d' la continúa —
  const beam = mat === 1 ? PLANK.post : PAL.beam;
  px(x, X, Y + 4, 16, 1, beam);
  px(x, X, Y + 5, 16, 1, 'rgba(0,0,0,0.10)');      // sombra de la viga
  // zócalo de piedra con juntas
  px(x, X, Y + 13, 16, 3, PAL.plinth);
  px(x, X, Y + 13, 16, 1, PAL.plinthHi);
  px(x, X, Y + 15, 16, 1, PAL.plinthDark);
  px(x, X + 2 + Math.floor(vh(tx * 3 + 5, ty + 9) * 11), Y + 14, 1, 2, PAL.plinthDark);
  px(x, X + 2 + Math.floor(vh(tx * 7 + 3, ty + 4) * 11), Y + 14, 1, 2, PAL.plinthDark);
  // postes verticales SOLO en esquinas (el vecino horizontal no es pared)
  const post = mat === 1 ? PLANK.post : PAL.beam;
  const postHi = mat === 1 ? PLANK.postHi : PAL.beamHi;
  if (!isWallCh(nb(-1, 0))) {
    px(x, X, Y, 3, 16, post);
    px(x, X + 1, Y, 1, 16, postHi);
  }
  if (!isWallCh(nb(1, 0))) {
    px(x, X + 13, Y, 3, 16, post);
    px(x, X + 13, Y, 1, 16, postHi);
  }
}

// ------------------------------------------------------------
// Ventanas v3 — plan compartido por el prerrender y la capa nocturna
// ------------------------------------------------------------

/**
 * ¿Hay ventana en el muro 'H' de coordenada absoluta (ax, ty)?
 * MISMA lógica R1 (rejilla del muro + regla junto a la puerta) para que
 * la capa nocturna pinte exactamente donde el prerrender pintó cristal.
 */
function windowPlanAbs(ax: number, ty: number, get: AbsAt): boolean {
  const chOf = (a: number) => get(a, ty);
  const q = (a: number) => vh(a * 9 + 1, ty * 13 + 7) < 0.34;
  let lx = ax, rx = ax;
  while (chOf(lx - 1) === 'H') lx--;
  while (chOf(rx + 1) === 'H') rx++;
  const winAt = (a: number) => chOf(a) === 'H' && q(a) && !(chOf(a - 1) === 'H' && q(a - 1));
  let count = 0;
  for (let a = lx; a <= rx; a++) if (winAt(a)) count++;
  return count > 0 ? winAt(ax) : chOf(ax - 1) === 'd';
}

/** Variante de ventana: 0 = cuadrícula 2×2 · 1 = buhardilla redondeada. */
function windowVariant(ax: number, ty: number): number {
  return vh(ax * 5 + 3, ty * 7 + 2) < 0.5 ? 0 : 1;
}

/** Pinta la ventana del tile 'H' (el plan ya decidió que toca ventana).
 *  El cristal vive SIEMPRE en (wx+1, wy+1, 6, 6) → la capa nocturna
 *  no necesita conocer la variante para situar el resplandor. */
function paintWindow(x: CanvasRenderingContext2D, tx: number, ty: number): void {
  const wx = tx * 16 + 4, wy = ty * 16 + 4;
  if (windowVariant(tx, ty) === 0) {
    // — Variante A: marco cuadrado con CUADRÍCULA 2×2 —
    px(x, wx, wy, 8, 8, PAL.winFrame);            // marco
    px(x, wx + 1, wy + 1, 6, 6, PAL.glass);       // cristal azulado
    px(x, wx + 1, wy + 6, 6, 1, PAL.glassDark);   // fondo del cristal
    px(x, wx + 3, wy + 1, 1, 1, PAL.glassHi);     // reflejo diagonal
    px(x, wx + 2, wy + 2, 1, 1, PAL.glassHi);
    px(x, wx + 1, wy + 3, 1, 1, PAL.glassHi);
    px(x, wx + 2, wy + 1, 1, 1, '#e6f2fa');
    px(x, wx + 4, wy + 1, 1, 6, PAL.winFrame);    // travesaño vertical
    px(x, wx + 1, wy + 4, 6, 1, PAL.winFrame);    // travesaño horizontal
  } else {
    // — Variante B: BUHARDILLA REDONDEADA (arco de 1px sobre el cristal) —
    px(x, wx + 1, wy + 1, 6, 6, PAL.glass);       // cristal
    px(x, wx + 1, wy + 5, 6, 2, PAL.glassDark);   // fondo del cristal
    px(x, wx + 2, wy, 4, 1, PAL.winFrame);        // arco superior
    px(x, wx + 1, wy + 1, 1, 1, PAL.winFrame);    // hombro del arco
    px(x, wx + 6, wy + 1, 1, 1, PAL.winFrame);
    px(x, wx, wy + 2, 1, 5, PAL.winFrame);        // jambas
    px(x, wx + 7, wy + 2, 1, 5, PAL.winFrame);
    px(x, wx + 1, wy + 7, 6, 1, PAL.winFrame);    // base del marco
    px(x, wx + 3, wy + 2, 1, 1, PAL.glassHi);     // reflejo diagonal
    px(x, wx + 2, wy + 3, 1, 1, PAL.glassHi);
    px(x, wx + 2, wy + 1, 1, 1, '#e6f2fa');
  }
  px(x, wx - 1, wy + 8, 10, 1, PAL.plinthHi);     // alféizar (ambas variantes)
}

// ------------------------------------------------------------
// 'd' — Puerta v3 (arco, herrajes, pomo 1px, entornadas)
// ------------------------------------------------------------

function paintDoor(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At, mapId: string): void {
  const X = tx * 16, Y = ty * 16;
  wallBase(x, tx, ty, nb, houseBlockAt(tx, ty, mapId, nb).mat); // misma pared de fondo
  // arco de piedra con dovela (clave) iluminada, marcado sobre la sombra
  px(x, X + 2, Y + 2, 12, 3, PAL.step);        // dintel de piedra
  px(x, X + 2, Y + 2, 12, 1, PAL.plinthHi);    // canto superior iluminado
  px(x, X + 2, Y + 4, 12, 1, PAL.stepDark);    // sombra del dintel
  px(x, X + 7, Y + 1, 2, 1, PAL.plinthHi);     // dovela central saliente
  // jambas
  px(x, X + 2, Y + 5, 1, 8, PAL.stepDark);
  px(x, X + 13, Y + 5, 1, 8, PAL.stepDark);
  // — Hoja de tablones: por hash algunas quedan ENTORNADAS 1-2px con el
  //   interior oscuro asomando por el lado del pomo —
  const openH = vh(tx * 7 + 3, ty * 11 + 5);
  const gap = openH < 0.10 ? 2 : openH < 0.24 ? 1 : 0;
  const leafX = X + 3, leafW = 10 - gap;
  if (gap > 0) px(x, X + 3, Y + 5, 10, 8, DOOR_IN);  // interior oscuro
  px(x, leafX + 1, Y + 5, leafW - 2, 1, PAL.doorMid); // ARCO: esquinas recortadas
  px(x, leafX, Y + 6, leafW, 7, PAL.doorMid);         // cuerpo (filas Y+6..Y+12)
  px(x, leafX, Y + 6, leafW, 1, PAL.door);            // sombra bajo el arco
  px(x, leafX + leafW - 1, Y + 6, 1, 7, PAL.door);    // canto derecho
  // juntas de los tablones (nunca sobre el canto ni el interior)
  for (const jx of [X + 6, X + 10]) {
    if (jx <= leafX + leafW - 2) px(x, jx, Y + 6, 1, 7, PAL.door);
  }
  // veta de los tablones
  if (leafW >= 9) px(x, X + 4, Y + 8, 2, 1, '#8a6038');
  px(x, X + 7, Y + 10, Math.min(2, leafW - 4), 1, '#8a6038');
  // bisagras de forja con remate metálico
  px(x, X + 3, Y + 6, 3, 1, PAL.iron);
  px(x, X + 3, Y + 10, 3, 1, PAL.iron);
  px(x, X + 6, Y + 6, 1, 1, '#8a8a96');
  px(x, X + 6, Y + 10, 1, 1, '#8a8a96');
  // herraje vertical sobre la hoja (tranca forjada)
  px(x, leafX + 1, Y + 9, leafW - 3, 1, PAL.iron);
  // POMO de 1px (dorado) junto a la rendija
  const kx = leafX + leafW - 3;
  px(x, kx, Y + 8, 1, 1, PAL.gold);
  px(x, kx, Y + 9, 1, 1, '#8a6038');           // sombra del pomo
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
// 'F' — Valla v2 del huerto + ESPANTAPÁJAROS en huertos grandes
// ------------------------------------------------------------

/** Espantapájaros (~8×12px): poste, brazos, camisa con remiendo, cabeza
 *  de saco y sombrero de paja. Todo dentro del tile (sin desbordar). */
function paintScarecrow(x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string): void {
  const X = tx * 16, Y = ty * 16;
  grassBase(x, tx, ty, mapId);
  dropShadow(x, X + 4, Y + 14, 9);
  // poste
  px(x, X + 7, Y + 4, 2, 10, PAL.woodMid);
  px(x, X + 7, Y + 4, 1, 10, PAL.woodLight);
  // brazos (travesaño)
  px(x, X + 4, Y + 7, 8, 1, PAL.woodDark);
  // camisa colgando
  px(x, X + 5, Y + 7, 5, 5, SC.shirt);
  px(x, X + 5, Y + 7, 5, 1, SC.shirtHi);
  px(x, X + 6, Y + 9, 2, 1, SC.patch);          // remiendo
  px(x, X + 5, Y + 11, 5, 1, PAL.rope);         // cuerda a la cintura
  px(x, X + 6, Y + 12, 3, 1, SC.straw);         // paja asomando abajo
  // cabeza de saco
  px(x, X + 6, Y + 3, 4, 4, SC.sack);
  px(x, X + 6, Y + 3, 1, 1, SC.sackHi);
  px(x, X + 7, Y + 4, 1, 1, SC.face);           // ojo
  px(x, X + 9, Y + 4, 1, 1, SC.face);           // ojo
  px(x, X + 8, Y + 5, 1, 1, SC.face);           // boca cosida
  // sombrero de paja
  px(x, X + 6, Y + 1, 4, 1, SC.crown);          // copa
  px(x, X + 6, Y + 2, 4, 1, SC.band);           // banda
  px(x, X + 4, Y + 3, 8, 1, SC.brim);           // ala
}

function paintFence(x: CanvasRenderingContext2D, tx: number, ty: number, nb: At, mapId: string): void {
  const X = tx * 16, Y = ty * 16;
  // — Huerto grande: UN espantapájaros en la valla norte del recinto —
  const blk = fenceBlockAt(tx, ty, mapId, nb);
  if (blk.big && tx === blk.scTx && ty === blk.scTy) {
    paintScarecrow(x, tx, ty, mapId);
    return;
  }
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
    // poste de PORTILLO: tramo horizontal que termina contra un hueco
    // (no contra otra valla ni en una esquina) → poste grueso con remate
    if (!hR && !vU && !vD) {
      px(x, X + 9, Y + 2, 2, 12, PAL.woodMid);
      px(x, X + 9, Y + 2, 1, 12, PAL.woodLight);
      px(x, X + 8, Y + 1, 4, 1, PAL.woodLight);    // remate
      px(x, X + 8, Y + 14, 4, 1, PAL.woodDark);
    } else if (!hL && !vU && !vD) {
      px(x, X + 5, Y + 2, 2, 12, PAL.woodMid);
      px(x, X + 5, Y + 2, 1, 12, PAL.woodLight);
      px(x, X + 4, Y + 1, 4, 1, PAL.woodLight);
      px(x, X + 4, Y + 14, 4, 1, PAL.woodDark);
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
  // piedritas sueltas al pie (hash; nunca entre rocas fusionadas)
  if (!eD) {
    if (vh(tx * 3 + 8, ty * 11 + 2) < 0.5) {
      px(x, X + 2 + Math.floor(vh(tx * 5 + 1, ty * 7 + 3) * 10), Y + 15, 2, 1, PAL.pebble);
    }
    if (vh(tx * 9 + 4, ty * 5 + 6) < 0.35) {
      px(x, X + 3 + Math.floor(vh(tx * 7 + 2, ty * 3 + 9) * 11), Y + 14, 1, 1, PAL.pebbleDark);
    }
  }
}

// ------------------------------------------------------------
// Capa nocturna — ventanas encendidas (inerte hasta integración)
// ------------------------------------------------------------

let nightF = 0;

/** Factor de noche 0..1 (0 = día → la capa no pinta nada).
 *  El integrador lo deriva de g.dayT cada frame (ver cabecera). */
export function setVillageNight(n: number): void {
  nightF = n >= 1 ? 1 : n <= 0 ? 0 : n;
}

/**
 * Resplandor cálido SOLO sobre las ventanas visibles de muros 'H'.
 * MISMO plan de ventanas que el prerrender (windowPlanAbs) → el brillo
 * cae píxel a píxel sobre el cristal pintado por paintWindow.
 *
 * Convenio idéntico a waterOverlay/drawTreeCanopy: camX/camY en px de
 * PANTALLA (con ZOOM); el dibujo sale en px de MUNDO (llamar dentro del
 * translate de cámara); `at` es ABSOLUTO. Sin llamada, sin `at`, de día
 * (nf=0) o fuera de la cámara es un no-op sin allocations.
 */
export function drawVillageWindowsNight(
  x: CanvasRenderingContext2D, camX: number, camY: number, mapId: string, t: number,
  at?: AbsAt,
): void {
  if (nightF <= 0.02 || !at) return;
  void mapId;
  const viewW = VIEW_W / ZOOM, viewH = VIEW_H / ZOOM;   // ventana visible en px de mundo
  const gx = Math.floor(camX / ZOOM), gy = Math.floor(camY / ZOOM);
  const tx0 = Math.floor(gx / 16) - 1, tx1 = Math.ceil((gx + viewW) / 16) + 1;
  const ty0 = Math.floor(gy / 16) - 1, ty1 = Math.ceil((gy + viewH) / 16) + 1;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (at(tx, ty) !== 'H') continue;
      if (!windowPlanAbs(tx, ty, at)) continue;
      const wx = tx * 16 + 4, wy = ty * 16 + 4;
      // parpadeo cálido determinista (fase por hash del tile)
      const flick = 0.84 + 0.16 * Math.sin(t * 2.2 + vh(tx * 7 + 3, ty * 5 + 1) * 6.283);
      const a = nightF * flick;
      x.globalAlpha = 0.10 * a;
      px(x, wx - 3, wy - 3, 14, 14, NIGHT_WARM);   // halo exterior
      x.globalAlpha = 0.16 * a;
      px(x, wx - 1, wy - 1, 10, 10, NIGHT_WARM);   // halo interior
      x.globalAlpha = 0.72 * a;
      px(x, wx + 1, wy + 1, 6, 6, NIGHT_GLASS);    // cristal encendido
      x.globalAlpha = 0.85 * a;
      px(x, wx + 2, wy + 2, 4, 4, NIGHT_CORE);
      x.globalAlpha = Math.min(1, a);
      px(x, wx + 3, wy + 2, 2, 2, NIGHT_HOT);      // mecha caliente
      x.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------------------
// Despachador del módulo (firma intacta)
// ------------------------------------------------------------

export function paintVillage(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, at?: NeighborFn,
): void {
  void t; // prerrender estático (t=0); la única capa animada es drawVillageWindowsNight
  const nb: At = at ?? (() => '?');
  switch (ch) {
    case 'H': { // pared casa: base por material + ventana(s) por plan R1
      const mat = houseBlockAt(tx, ty, mapId, nb).mat;
      wallBase(x, tx, ty, nb, mat);
      if (windowPlanAbs(tx, ty, (a) => nb(a - tx, 0))) paintWindow(x, tx, ty);
      return;
    }
    case 'r': paintRoof(x, tx, ty, nb, mapId); return;
    case 'd': paintDoor(x, tx, ty, nb, mapId); return;
    case 'F': paintFence(x, tx, ty, nb, mapId); return;
    case 'w': paintWell(x, tx, ty, mapId); return;
    case 'g': paintGrave(x, tx, ty, nb, mapId); return;
    case 'R': paintRock(x, tx, ty, nb, mapId); return;
  }
}
