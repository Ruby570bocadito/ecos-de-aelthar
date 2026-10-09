// ============================================================
// ECOS DE AELTHAR — Tiles de agua y puentes (módulo world)
// Casos: '~' agua · 'B' puente entero (pasado) · 'x' puente roto
// Contrato:
//  - paintWater la llama el despachador drawTile (prerrender, t=0):
//    profundidad por vecinos (damero 2×2 entre niveles), orilla de
//    arena/lodo con hierba húmeda de contacto, olas estáticas con "V",
//    puente entero y puente roto. Todo con dithering/bandas de píxeles,
//    SIN degradados de canvas. Su `at` es RELATIVO (convención drawTile:
//    at(dx,dy) = char del vecino desplazado (dx,dy) desde el tile actual;
//    admite offsets mayores que ±1, p. ej. at(2,0)).
//  - waterOverlay la conecta render.ts (1 vez por frame) para animar
//    olas, destellos y espuma POR ENCIMA del suelo prerrenderizado.
//    Su `at` es ABSOLUTO: at(tx,ty) = char del tile (tx,ty) del mapa.
// Ronda 4 · agua v3 (todo ADITIVO, firmas intactas):
//  - setWaterNight(n): el integrador la llama CADA FRAME desde render.ts
//    con (dayT > 0.7 || dayT < 0.08 ? 1 : 0). Mientras nadie la llame la
//    noche queda a 0: waterOverlay NO puede derivar la hora de globalT
//    (el ciclo día/noche vive en g.dayT y el hook no pasa g).
//  - Camino de luna nocturno: banda vertical dithered plateada en agua
//    ABIERTA, anclada a la misma x de pantalla que la luna de sky.ts
//    (VIEW_W*0.78 - camX*0.004), serpentea y respira.
//  - Destellos sol/luna con presupuesto de 2-3 por pantalla (hash2
//    devuelve [0,0.5): los umbrales se normalizan ×2).
//  - Orillas vivas: anillo de espuma secundario con marea lenta y
//    transición barro/musgo de 2-3 px en el interior de la orilla.
//  - Reflejos de borde: banda de 2 px con el color del terreno adyacente
//    oscurecido ×0.6 (tablas precalculadas al cargar el módulo).
//  - Agua profunda: maps.ts NO usa 'x' como agua profunda ('x' es el
//    puente roto del bosque, 'B' el entero del pasado), así que las vetas
//    lentas y el polvo sumergido viven en los '~' interiores (profundidad 2).
//  - Cero allocations por frame: colores y tablas son const de módulo.
// R5-O5 · overlay optimizado (mismas firmas y estética):
//  - Snapshot de tiles visibles: UNA lectura de at() por tile y frame en un
//    Uint8Array reutilizable (antes: hasta 13 llamadas por tile de agua).
//  - Espuma y marea horneadas a minicanvases por (dirección, variante de
//    dentado, fotograma): 1 drawImage por borde en vez de ~30 fillRect+hash.
//  - Culling estricto al viewport y early-out si no hay agua visible.
//  - VIEW_W/VIEW_H vivos desde ../consts: el camino de luna queda alineado
//    con sky.ts en cualquier tamaño de ventana.
// ============================================================

import { hash2, isForest } from './palette';
import { px, PAL, type NeighborFn } from './palette';
import { VIEW_W, VIEW_H, ZOOM as Z } from '../consts'; // R5-O5: vista viva

const T = 16; // lado del tile en px de mundo (TILE)

type At = NeighborFn | undefined;

/** ¿Es agua libre? ('V' = fuera de mapa / vacío: NO cuenta como agua). */
export function isWaterChar(ch: string): boolean {
  return ch === '~';
}

/** Bajo los puentes el cauce sigue ahí: agua + tablones cuentan como río. */
function isRiverish(ch: string): boolean {
  return ch === '~' || ch === 'B' || ch === 'x';
}

/** Offsets relativos de los 4 bordes (N, S, W, E). */
const DIRS: readonly (readonly [number, number])[] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// ============================================================
// R4-A1 · AGUA V3 — noche inyectada y paleta local (aditivo)
// ============================================================

// Noche inyectada por el integrador (0 = día, 1 = noche, admite fades).
// Mientras nadie llame a setWaterNight permanece a 0.
let nightF = 0;

/**
 * Ronda 4 · el integrador llama esto CADA FRAME desde render.ts:
 *   setWaterNight(g.dayT > 0.7 || g.dayT < 0.08 ? 1 : 0);
 * (espejo de isNight() de update.ts). 0..1: valores intermedios hacen
 * fundido del camino de luna. Sin efecto sobre olas/espuma de Ronda 1.
 */
export function setWaterNight(n: number): void {
  nightF = n >= 1 ? 1 : n <= 0 ? 0 : n;
}

// Paleta local v3 — constantes de módulo: cero strings nuevos por frame.
const MOON_HI = '#e8f4ff';   // médula del camino de luna
const MOON_LO = '#a8c4de';   // plata apagada del camino
const SPARK_WARM = '#fff3d6'; // destello de sol (blanco cálido)
const SPARK_COOL = '#d8e8fc'; // destello de luna (blanco frío)
const VEIN_COL = 'rgba(118,158,198,0.20)'; // veta lenta del fondo profundo
const DUST_COL = '#9cb8d6';  // polvo sumergido (alpha por globalAlpha)

/** Oscurece un hex '#rrggbb' ×f — SOLO se ejecuta al cargar el módulo. */
function darken(c: string, f: number): string {
  const r = Math.round(parseInt(c.slice(1, 3), 16) * f);
  const g = Math.round(parseInt(c.slice(3, 5), 16) * f);
  const b = Math.round(parseInt(c.slice(5, 7), 16) * f);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// Color representativo del terreno por char ([char, valle, bosque]):
// base de la tabla de REFLEJOS DE BORDE (terreno adyacente ×0.6).
const TERRAIN_COL: readonly (readonly [string, string, string])[] = [
  ['.', '#467c3e', '#396334'], // hierba
  [',', '#4f8a46', '#3f6d3a'], // hierba alta
  ['t', '#2c5a30', '#24502c'], // borde de espesura
  ['p', '#16351f', '#16351f'], // pino
  ['m', '#3a5a48', '#3a5a48'], // niebla apagada
  ['n', '#3a5a48', '#3a5a48'], // niebla muda
  [':', '#5a5a6a', '#5a5a6a'], // losa de piedra
  ['=', '#a08454', '#a08454'], // camino
  ['H', '#d0bc94', '#d0bc94'], // muro de casa
  ['r', '#7e3626', '#7e3626'], // tejado
  ['d', '#5c3a1e', '#5c3a1e'], // puerta
  ['F', '#6a4e30', '#6a4e30'], // valla
  ['R', '#5a5a6a', '#5a5a6a'], // roca
  ['c', '#4a3520', '#4a3520'], // cultivo
  ['w', '#5a5a6a', '#5a5a6a'], // pozo
  ['g', '#3e3e50', '#3e3e50'], // lápida / glifo
  ['#', '#4a4a5c', '#4a4a5c'], // muro de cripta
  ['A', '#4a4a5c', '#4a4a5c'], // altar / entrada
  ['P', '#3e3e50', '#3e3e50'], // pilar
];
// R5-O5 · indexadas por CÓDIGO de char: lookup O(1) sin strings por frame
const REFLECT_VC: (string | undefined)[] = [];
const REFLECT_FC: (string | undefined)[] = [];
for (const [ch, cv, cf] of TERRAIN_COL) {
  REFLECT_VC[ch.charCodeAt(0)] = darken(cv, 0.6);
  REFLECT_FC[ch.charCodeAt(0)] = darken(cf, 0.6);
}
const REFLECT_DF = darken('#3a4a30', 0.6); // terreno no catalogado

/**
 * Cuenta vecinos que cumplen `pred` en la vecindad 8 del punto (ox,oy),
 * en coordenadas RELATIVAS al tile que se está pintando (convención
 * drawTile: el propio tile es (0,0), su vecino N es (0,-1), etc.).
 */
function countAround(at: At, ox: number, oy: number, pred: (ch: string) => boolean): number {
  if (!at) return 5; // sin vecinos: asumir agua media (masa interior)
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (pred(at(ox + dx, oy + dy))) n++;
    }
  }
  return n;
}

/**
 * Profundidad por vecinos agua (8-dir): 6-8 = profunda (azul oscuro) ·
 * 3-5 = media · 0-2 = somera (azul claro).
 */
function depthLevel(n: number): 0 | 1 | 2 {
  return n >= 6 ? 2 : n >= 3 ? 1 : 0;
}

// Tonos base por profundidad: somera (azul claro) · media · profunda (oscuro)
const DEPTH_BASE: readonly string[] = [PAL.waterShallow, PAL.water, PAL.waterDeep];
// Moteado interior por profundidad (siempre un tono vecino, sin degradados)
const DEPTH_DITHER: readonly string[] = [PAL.waterGlint, PAL.waterHi, PAL.waterDeep2];
const DEPTH_DENS: readonly number[] = [0.1, 0.12, 0.3];
// Tono de las olas estáticas: más claro que la base de SU profundidad
const WAVE_TONE: readonly string[] = [PAL.waterGlint, PAL.waterGlint, PAL.waterWave];

// ============================================================
// PRERRENDER — paintWater (contrato intacto con drawTile)
// ============================================================

export function paintWater(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, at?: NeighborFn,
): void {
  void t; // el prerrender congela t=0; la animación vive en waterOverlay()
  const px0 = tx * T, py0 = ty * T;
  if (ch === 'B') { paintBridge(x, tx, ty, px0, py0, false, at); return; }
  if (ch === 'x') { paintBridge(x, tx, ty, px0, py0, true, at); return; }
  paintWaterTile(x, tx, ty, px0, py0, mapId, at);
}

/** Tile '~': agua con profundidad + olas estáticas + orilla/sombra. */
function paintWaterTile(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, mapId: string, at: At,
): void {
  const depth = depthLevel(countAround(at, 0, 0, isWaterChar));
  // 1) base por profundidad + moteado determinista (sin degradados)
  px(x, px0, py0, T, T, DEPTH_BASE[depth]);
  ditherSpots(x, tx, ty, px0, py0, DEPTH_DITHER[depth], DEPTH_DENS[depth], 11 + depth * 61);
  if (depth === 1) ditherSpots(x, tx, ty, px0, py0, PAL.waterDeep, 0.07, 211);
  // 2) banda DAMERO 2×2 en las fronteras entre profundidades: la paridad
  //    es GLOBAL (coordenada de celda), así el damero de este tile enlaza
  //    sin costuras con el que pinta el vecino al otro lado de la frontera.
  if (at) {
    for (let d = 0; d < 4; d++) {
      const [ox, oy] = DIRS[d];
      if (!isWaterChar(at(ox, oy))) continue;
      const nd = depthLevel(countAround(at, ox, oy, isWaterChar));
      if (nd !== depth) edgeDamero(x, tx, ty, px0, py0, d, DEPTH_BASE[nd]);
    }
  }
  // 3) el río del bosque refleja la espesura (tinte plano, no degradado)
  if (isForest(mapId)) {
    x.globalAlpha = 0.2;
    px(x, px0, py0, T, T, PAL.forestTint);
    x.globalAlpha = 1;
  }
  // 4) olas estáticas sutiles (2-3 líneas de 1 px + "V" de ola pequeña)
  staticWaves(x, tx, ty, px0, py0, depth);
  // 5) bordes: orilla de arena/lodo contra tierra, sombra bajo puentes
  if (at) {
    for (let d = 0; d < 4; d++) {
      const c = at(DIRS[d][0], DIRS[d][1]);
      if (c === 'V' || isWaterChar(c)) continue; // borde de mapa o agua: nada
      if (isRiverish(c)) bridgeShadowBand(x, px0, py0, d);
      else shoreBand(x, tx, ty, px0, py0, d, c, mapId);
    }
  }
}

// ---------------- helpers de dithering y bordes ----------------

/** Manchas de dithering 2×2 con hash determinista (sin degradados). */
function ditherSpots(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, color: string, density: number, seed: number,
): void {
  x.fillStyle = color;
  for (let cy = 0; cy < T; cy += 2) {
    for (let cx = 0; cx < T; cx += 2) {
      if (hash2(tx * 8 + cx / 2 + seed, ty * 8 + cy / 2 - seed) < density) {
        x.fillRect(px0 + cx, py0 + cy, 2, 2);
      }
    }
  }
}

/**
 * Rect de un segmento en el borde `dir` (0=N 1=S 2=W 3=E).
 * `inset` = píxeles desde el borde hacia dentro; `size` = grosor;
 * `seg` = largo del segmento sobre el borde.
 * R5-O5: devuelve una tupla RASPA de módulo (cero allocaciones por frame —
 * la usa edgeReflect, que corre por frame). Todos los consumidores la leen
 * INMEDIATAMENTE en su fillRect (verificado en los 7 puntos de llamada);
 * no guardar el resultado entre llamadas.
 */
const EDGE_R: [number, number, number, number] = [0, 0, 0, 0];
function edgeRect(
  dir: number, px0: number, py0: number, i: number, inset: number, size: number, seg: number,
): [number, number, number, number] {
  if (dir === 0) { EDGE_R[0] = px0 + i; EDGE_R[1] = py0 + inset; EDGE_R[2] = seg; EDGE_R[3] = size; }
  else if (dir === 1) { EDGE_R[0] = px0 + i; EDGE_R[1] = py0 + T - inset - size; EDGE_R[2] = seg; EDGE_R[3] = size; }
  else if (dir === 2) { EDGE_R[0] = px0 + inset; EDGE_R[1] = py0 + i; EDGE_R[2] = size; EDGE_R[3] = seg; }
  else { EDGE_R[0] = px0 + T - inset - size; EDGE_R[1] = py0 + i; EDGE_R[2] = size; EDGE_R[3] = seg; }
  return EDGE_R;
}

/**
 * Banda DAMERO 2×2 en el borde `dir`: mezcla el tono del vecino en celdas
 * alternas usando la PARIDAD GLOBAL de celda (tx·8+i / ty·8+j). Dos tiles
 * que comparten frontera calculan esa paridad desfasada en 1 (dir N usa
 * ty·8, dir S del vecino usa ty·8-1; igual en W/E), así que sus bandas de
 * 1 celda se engarzan en un damero continuo de 2 celdas sin costuras.
 */
function edgeDamero(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, dir: number, color: string,
): void {
  x.fillStyle = color;
  for (let i = 0; i < T; i += 2) {
    const cx = dir === 2 ? tx * 8 : dir === 3 ? tx * 8 + 7 : tx * 8 + i / 2;
    const cy = dir === 0 ? ty * 8 : dir === 1 ? ty * 8 + 7 : ty * 8 + i / 2;
    if (((cx + cy) & 1) !== 0) continue; // damero 2×2 estricto
    const r = edgeRect(dir, px0, py0, i, 0, 2, 2);
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
}

/**
 * Orilla: hierba oscura/húmeda de 1 px justo al contacto con hierba '.',
 * franja de arena de 2-3 px con dientes de 1-2 px alternando con hash,
 * línea de lodo mojado y piedritas dispersas.
 * Se pinta DENTRO del tile de agua (lado del agua de la frontera) para no
 * depender del orden de dibujado: los tiles de tierra a la derecha/abajo se
 * pintan después y taparían cualquier arena que les invadiéramos.
 */
function shoreBand(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, dir: number, nch: string, mapId: string,
): void {
  const grassy = nch === '.' || nch === ','; // contacto directo con hierba
  // 1) hierba oscura/húmeda de 1 px en el borde que toca la hierba
  if (grassy) {
    x.fillStyle = isForest(mapId) ? PAL.grassWetBosque : PAL.grassWet;
    const g = edgeRect(dir, px0, py0, 0, 0, 1, T);
    x.fillRect(g[0], g[1], g[2], g[3]);
  }
  // 2) arena dentada (2-3 px + dientes de 1-2 px) y lodo mojado
  const base = grassy ? 1 : 0; // la arena empieza tras la hierba de contacto
  for (let i = 0; i < T; i += 2) {
    const jag = hash2(tx * T + i + dir * 577, ty * T + i * 13 - dir * 131);
    const d = 2 + (jag > 0.86 ? 2 : jag > 0.5 ? 1 : 0); // diente de 1-2 px
    const r = edgeRect(dir, px0, py0, i, base, d, 2);
    x.fillStyle = jag > 0.8 ? PAL.shoreSandHi : PAL.shoreSand;
    x.fillRect(r[0], r[1], r[2], r[3]);
    if (jag > 0.28) { // lodo mojado dentado pegado al agua
      const m = edgeRect(dir, px0, py0, i, base + d, 1, 2);
      x.fillStyle = PAL.shoreMud;
      x.fillRect(m[0], m[1], m[2], m[3]);
    }
  }
  // 3) piedritas (hasta 2 por borde, dentro de la franja de arena)
  for (let k = 0; k < 2; k++) {
    const rp = hash2(tx * 31 + k * 7 + dir * 17, ty * 37 - k * 11 + dir * 3);
    if (rp > 0.62) continue;
    const i = 1 + Math.floor(hash2(tx * 17 + k * 5, ty * 19 - k * 3) * (T - 2));
    const row = base + Math.floor(hash2(tx * 23 + k, ty * 29 + k * 7) * 2);
    const r = edgeRect(dir, px0, py0, i, row, 1, 1);
    x.fillStyle = rp < 0.22 ? PAL.pebbleDark : PAL.pebble;
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
}

/** Sombra que el puente proyecta sobre el agua en el borde con 'B'/'x'. */
function bridgeShadowBand(
  x: CanvasRenderingContext2D, px0: number, py0: number, dir: number,
): void {
  // línea rgba oscura de 2 px pegada al puente (sombra del tablón)
  x.fillStyle = 'rgba(10,22,42,0.45)';
  const s = edgeRect(dir, px0, py0, 0, 0, 2, T);
  x.fillRect(s[0], s[1], s[2], s[3]);
  x.fillStyle = PAL.waterDeep2;
  for (let i = 0; i < T; i += 4) { // ripple oscuro que se despega de la sombra
    if (hash2(i * 3 + dir * 41, dir * 13 + i) < 0.35) continue;
    const r = edgeRect(dir, px0, py0, i, 3, 1, 3);
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
}

/**
 * Olas estáticas: 2-3 líneas horizontales de 1 px (un tono más claro que la
 * base de SU profundidad), discontinuas y con posición/fase por hash, más
 * una "V" de ola pequeña (cresta de 3×2 px) en media de los tiles.
 */
function staticWaves(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, depth: number,
): void {
  const tone = WAVE_TONE[depth];
  const lines = 2 + (hash2(tx * 3 + 11, ty * 5 + 3) > 0.5 ? 1 : 0);
  for (let k = 0; k < lines; k++) {
    const ly = 2 + Math.floor(hash2(tx * 7 + k * 13 + 1, ty * 11 + k * 5 + 7) * 12);
    const lx = Math.floor(hash2(tx * 5 + k * 3 + 2, ty * 9 + k * 7 + 4) * 6);
    const len = Math.min(T - lx, 6 + Math.floor(hash2(tx + k * 17, ty * 2 + k * 23) * 7));
    const a = 2 + Math.floor(hash2(tx * 13 + k * 3, ty * 3 + k) * Math.max(1, len - 3));
    x.fillStyle = tone;
    x.fillRect(px0 + lx, py0 + ly, a, 1);
    if (a + 1 < len) x.fillRect(px0 + lx + a + 1, py0 + ly, len - a - 1, 1); // guión
  }
  // "V" de ola pequeña: dos píxeles abajo y uno arriba (cresta de 3×2 px)
  if (hash2(tx * 23 + 5, ty * 31 + 1) > 0.5) {
    const vx = px0 + 2 + Math.floor(hash2(tx * 9 + 4, ty * 13 + 8) * 10);
    const vy = py0 + 3 + Math.floor(hash2(tx * 15 + 2, ty * 17 + 6) * 10);
    x.fillStyle = tone;
    x.fillRect(vx, vy + 1, 1, 1);
    x.fillRect(vx + 1, vy, 1, 1);
    x.fillRect(vx + 2, vy + 1, 1, 1);
  }
}

// ---------------- puentes ----------------

/** Agua profunda de cauce bajo el puente + despacho del tablón. */
function paintBridge(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, broken: boolean, at: At,
): void {
  px(x, px0, py0, T, T, PAL.waterDeep);
  ditherSpots(x, tx, ty, px0, py0, PAL.waterDeep2, 0.3, 7);
  if (broken) { // hundimiento: bajo el puente roto el agua es aún más oscura
    x.globalAlpha = 0.4;
    px(x, px0, py0, T, T, PAL.bridgeWater);
    x.globalAlpha = 1;
    ditherSpots(x, tx, ty, px0, py0, PAL.waterDeep2, 0.22, 43);
  }
  // sombra del tablón sobre el agua: velo rgba que asoma en los márgenes
  x.fillStyle = 'rgba(10,22,42,0.4)';
  x.fillRect(px0, py0, T, T);
  if (broken) paintBridgeBroken(x, tx, ty, px0, py0, at);
  else paintBridgeWhole(x, tx, ty, px0, py0, at);
}

/**
 * Poste de madera con cuerda atada y SOMBRA (esquinas del puente).
 * La sombra va al pie si hay tablón debajo; si el poste cierra el tile por
 * el sur, se dibuja lateral para no invadir el tile vecino del prerrender.
 */
function bridgePost(
  x: CanvasRenderingContext2D, X: number, Y: number, py0: number, east: boolean,
): void {
  x.fillStyle = 'rgba(8,16,30,0.45)';
  if (Y + 5 <= py0 + T) x.fillRect(east ? X - 1 : X + 1, Y + 4, 3, 1); // sombra al pie
  else x.fillRect(east ? X - 1 : X + 3, Y, 1, 4);        // sombra lateral
  px(x, X, Y, 3, 4, PAL.woodDark);
  px(x, X, Y, 1, 4, PAL.woodMid);           // luz lateral
  px(x, X, Y, 3, 1, PAL.woodLight);         // canto superior
  px(x, X + 1, Y + 2, 2, 1, PAL.ropeLight); // cuerda atada
}

/**
 * Cuerda lateral: riel de madera de 1 px en el borde del tablón y cuerda
 * tensada dibujada a PUNTOS OSCUROS (1 px sí, 1 px no) con nudo claro cada
 * 6 px. Todo dentro del tile, sin invadir vecinos del prerrender.
 */
function ropeEdge(x: CanvasRenderingContext2D, px0: number, py0: number, east: boolean): void {
  const rx = px0 + (east ? T - 1 : 0);
  px(x, rx + (east ? -1 : 1), py0, 1, T, PAL.woodDark); // riel/sombra en la madera
  for (let ky = 1; ky < T - 1; ky += 2) { // cuerda a puntos oscuros
    x.fillStyle = (ky - 1) % 6 === 4 ? PAL.ropeLight : PAL.ropeDark;
    x.fillRect(rx, py0 + ky, 1, 1);
  }
}

/** 'B' puente del pasado: tablones con veta, cuerdas, sombra y postes. */
function paintBridgeWhole(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, at: At,
): void {
  const leftCol = !!at && at(-1, 0) !== 'B';  // columna oeste del puente
  const rightCol = !!at && at(1, 0) !== 'B';  // columna este
  const topEnd = !!at && at(0, -1) !== 'B';   // el puente empieza aquí
  const botEnd = !!at && at(0, 1) !== 'B';    // el puente termina aquí
  // (la sombra rgba del tablón sobre el agua ya quedó en los márgenes:
  //  paintBridge la aplica como velo ANTES de dibujar los tablones)
  // tablones horizontales (el puente cruza de norte a sur) con veta
  const off = Math.floor(hash2(ty * 13 + 7, 911) * 3); // junta desalineada por fila
  let y = 1 + off;
  while (y < T - 1) {
    const h = Math.min(3, T - 1 - y);
    px(x, px0, py0 + y, T, h, PAL.woodMid);
    px(x, px0, py0 + y, T, 1, PAL.woodLight); // canto iluminado de la tabla
    if (y + h < T - 1) px(x, px0, py0 + y + h, T, 1, PAL.woodDark); // junta
    if (h >= 2) { // veta QUEBRADA: guiones de 2-4 px con huecos de 1-2 px
      const gy2 = py0 + y + 1 + Math.floor(hash2(tx * 3 + y, ty * 5 - y) * (h - 1));
      let gx = px0 + Math.floor(hash2(tx * 17 + y, ty * 3 - y) * 5);
      x.fillStyle = PAL.woodDark;
      while (gx < px0 + T - 1) {
        const dash = 2 + Math.floor(hash2(gx * 3 + y, ty * 7 + y) * 3);
        x.fillRect(gx, gy2, Math.min(dash, px0 + T - 1 - gx), 1);
        gx += dash + 1 + Math.floor(hash2(gx + y, ty * 5) * 2);
      }
      if (hash2(tx * 5 - y, ty * 7 + y * 3) > 0.78) { // nudo de veta
        px(x, px0 + 2 + Math.floor(hash2(tx + y, ty - y) * (T - 5)), gy2, 2, 1, PAL.woodDark);
      }
    }
    y += 4; // 3 de tabla + 1 de junta
  }
  // cuerdas en los bordes exteriores (una por lado del puente de 2 tiles)
  if (leftCol) ropeEdge(x, px0, py0, false);
  if (rightCol) ropeEdge(x, px0, py0, true);
  // postes en las esquinas (2 por extremo), con sombra propia
  if (topEnd) {
    if (leftCol) bridgePost(x, px0, py0, py0, false);
    if (rightCol) bridgePost(x, px0 + T - 3, py0, py0, true);
  }
  if (botEnd) {
    if (leftCol) bridgePost(x, px0, py0 + T - 4, py0, false);
    if (rightCol) bridgePost(x, px0 + T - 3, py0 + T - 4, py0, true);
  }
}

/** 'x' puente roto: tablones rotos con astillas, un extremo colgando. */
function paintBridgeBroken(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, at: At,
): void {
  const leftCol = !!at && at(-1, 0) !== 'x';
  const rightCol = !!at && at(1, 0) !== 'x';
  const topEnd = !!at && at(0, -1) !== 'x'; // conectado a la orilla norte
  const botEnd = !!at && at(0, 1) !== 'x';  // el extremo sur cedió
  const off = Math.floor(hash2(ty * 13 + 7, 913) * 3);
  let y = 1 + off;
  while (y < T - 1) {
    const h = Math.min(3, T - 1 - y);
    let keep = hash2(tx * 21 + y * 3, ty * 47 + y * 5 + 13); // supervivencia de tabla
    if (topEnd && y <= 7) keep += 0.5;    // junto a la orilla norte: casi entero
    if (botEnd && y >= 8) keep = 0;       // aquí el tablón se hundió (cuelga)
    if (!topEnd && !botEnd) keep -= 0.18; // tramo medio: más agujeros
    if (keep > 0.28) {
      const full = keep > 0.62;
      const fromEast = hash2(tx * 11 + y, ty * 29 - y) > 0.5;
      const w = full ? T : 5 + Math.floor(hash2(tx * 9 - y, ty * 23 + y * 7) * 8);
      const X = px0 + (fromEast && !full ? T - w : 0);
      px(x, X, py0 + y, w, h, PAL.woodMid);
      px(x, X, py0 + y, w, 1, PAL.woodLight);
      if (!full) { // extremo roto dentado: el agua muerde el canto
        px(x, fromEast ? X : X + w - 1, py0 + y, 1, 1, PAL.waterDeep2);
      }
      if (y + h < T - 1 && (full || hash2(tx + y, ty - y) > 0.4)) {
        px(x, X, py0 + y + h, w, 1, PAL.woodDark); // junta
      }
      if (h >= 2) { // veta corta dentro de la tabla sobreviviente
        const glen = Math.min(w - 2, 3 + Math.floor(hash2(tx * 7 + y * 3, ty * 11 + y) * 4));
        const gx = X + Math.floor(hash2(tx * 3 + y, ty * 5 - y) * Math.max(1, w - glen - 1));
        px(x, gx, py0 + y + 1, glen, 1, PAL.woodDark);
      }
    } else if (keep > 0.12) { // tocón de tabla arrancada
      const fromEast = hash2(tx * 11 + y, ty * 29 - y) > 0.5;
      px(x, px0 + (fromEast ? T - 3 : 0), py0 + y, 3, h, PAL.woodDark);
    }
    y += 4;
  }
  // hueco central: el cauce abierto donde el tablón cedió (agua muy oscura)
  if (!topEnd && !botEnd) {
    px(x, px0 + 5, py0 + 3, 6, 2, PAL.waterDeep2);
    px(x, px0 + 4, py0 + 5, 8, 6, PAL.waterDeep2);
    px(x, px0 + 5, py0 + 11, 6, 2, PAL.waterDeep2);
    x.fillStyle = 'rgba(4,10,24,0.4)'; // fondo aún más profundo
    x.fillRect(px0 + 5, py0 + 5, 6, 4);
    x.fillStyle = PAL.foam;            // espuma estática mordiendo el borde
    x.fillRect(px0 + 4, py0 + 6, 1, 1);
    x.fillRect(px0 + 11, py0 + 8, 1, 1);
    x.fillRect(px0 + 6, py0 + 3, 2, 1);
  }
  // astillas apuntando a direcciones distintas, flotando sobre el cauce
  for (let k = 0; k < 3; k++) {
    const sr = hash2(tx * 41 + k * 13, ty * 43 + k * 7 + 5);
    if (sr < 0.3) continue;
    const sx = px0 + 1 + Math.floor(hash2(tx * 13 + k * 3, ty * 17 + k) * (T - 6));
    const sy = py0 + 1 + Math.floor(hash2(tx * 19 - k, ty * 7 + k * 5) * (T - 6));
    if (k === 0) { // tumbada: horizontal 2×1 con punta oscura
      px(x, sx, sy, 2, 1, PAL.woodMid);
      px(x, sx + 1, sy, 1, 1, PAL.woodDark);
    } else if (k === 1) { // clavada: vertical 1×2
      px(x, sx, sy, 1, 2, PAL.woodDark);
      px(x, sx, sy, 1, 1, PAL.woodMid);
    } else { // diagonal: escalón de 2 px, orientación por hash
      px(x, sx, sy, 1, 1, PAL.woodMid);
      px(x, sx + 1, sy + 1, 1, 1, PAL.woodDark);
      if (hash2(tx * 7 + k, ty * 9 - k) > 0.5) px(x, sx + 1, sy, 1, 1, PAL.woodDark);
      else px(x, sx, sy + 1, 1, 1, PAL.woodDark);
    }
  }
  if (botEnd) { // tablón colgando EN DIAGONAL que se hunde hacia el SE
    for (let k = 0; k < 6; k++) {
      const kx = px0 + 3 + k, ky = py0 + 5 + k;
      px(x, kx, ky, 2, 2, k >= 4 ? PAL.plankWet : PAL.woodMid); // punta mojada
      px(x, kx, ky, 2, 1, PAL.woodLight);        // canto iluminado
      px(x, kx + 1, ky + 1, 1, 1, PAL.woodDark); // vientre en sombra
    }
    x.fillStyle = 'rgba(8,16,30,0.35)'; // sombra del tablón sobre el cauce
    x.fillRect(px0 + 9, py0 + 11, 3, 1);
    px(x, px0 + 9, py0 + 10, 1, 1, PAL.foam); // espuma estática en la punta
    px(x, px0 + 12, py0 + 12, 1, 1, PAL.foam);
    // poste arrancado flotando junto al borde sur
    px(x, px0 + 11, py0 + 13, 4, 2, PAL.woodDark);
    px(x, px0 + 11, py0 + 13, 4, 1, PAL.woodMid);
    px(x, px0 + 10, py0 + 12, 1, 1, PAL.foam);
    px(x, px0 + 15, py0 + 14, 1, 1, PAL.foam);
  }
  if (topEnd) { // postes quebrados en el extremo norte, con cuerda colgando
    if (leftCol) {
      px(x, px0, py0, 3, 2, PAL.woodDark);
      px(x, px0, py0, 3, 1, PAL.woodMid);
      px(x, px0 + 1, py0 + 2, 1, 3, PAL.ropeDark);
      px(x, px0 + 2, py0 + 5, 1, 2, PAL.ropeLight);
    }
    if (rightCol) {
      px(x, px0 + T - 3, py0, 3, 2, PAL.woodDark);
      px(x, px0 + T - 3, py0, 3, 1, PAL.woodMid);
      px(x, px0 + T - 2, py0 + 2, 1, 2, PAL.ropeDark);
    }
  }
}

// ============================================================
// R5-O5 · SNAPSHOT + TIRAS DE BORDE PRERRENDERIZADAS
// La espuma (foamEdge) y la marea (tideRing + shoreWet) dibujaban ~30
// segmentos (hash2 + sin + fillRect) por BORDE y tile en cada frame.
// Ahora se hornean a minicanvases de 16×16 (coords de tile) por
// (dirección, variante de dentado, fotograma) y se pintan con UN
// drawImage por borde. edgeReflect sigue inmediato: su alpha depende de
// nightF (por frame) y del terreno del vecino. Los dentados pasan de ser
// por-tile a por-variante (8 por dirección): misma estética de orilla.
// ============================================================

let snap = new Uint8Array(0); // charcodes del bloque visible + borde de 1 tile

const AQ = 126; // código de '~'
const VD = 86;  // código de 'V' (fuera de mapa)

/** ¿Vecino de TIERRA firme? (no agua, no borde de mapa, no puente) — código. */
function isLandCode(c: number): boolean {
  return c !== AQ && c !== VD && c !== 66 && c !== 120; // no '~', 'V', 'B', 'x'
}

/** Fase base del borde (compartida por espuma, marea y barro). */
function edgeBase(dir: number, tx: number, ty: number): number {
  return dir === 0 ? tx * 0.7
       : dir === 1 ? tx * 0.7 + 2.1
       : dir === 2 ? ty * 0.7 + 4.2
       : ty * 0.7 + 5.5;
}

const EDGE_V = 8;                 // variantes de dentado por dirección
const FOAM_F = 32;                // fotogramas de espuma (período 2π/3 s)
const TIDE_F = 32;                // fotogramas de marea (período 4π s)
const FOAM_P = Math.PI * 2 / 3;   // período del ciclo de espuma (t*3)
const TIDE_P = Math.PI * 4;       // período del ciclo de marea (t*0.5)

// semillas por variante (grandes: dentados propios y estables por variante)
const vxOf = (v: number): number => v * 73 + 1;
const vyOf = (v: number): number => v * 149 + 3;

const foamStrips: (HTMLCanvasElement | null)[] = new Array(4 * EDGE_V * FOAM_F).fill(null);
const tideStrips: (HTMLCanvasElement | null)[] = new Array(4 * EDGE_V * TIDE_F).fill(null);

/** Tira horneada (se cuece al primer uso; después cache puro, 0 alloc). */
function getStrip(foam: boolean, dir: number, v: number, k: number): HTMLCanvasElement {
  const table = foam ? foamStrips : tideStrips;
  const idx = (dir * EDGE_V + v) * (foam ? FOAM_F : TIDE_F) + k;
  const hit = table[idx];
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = T; cv.height = T;
  const c = cv.getContext('2d') as CanvasRenderingContext2D;
  c.imageSmoothingEnabled = false;
  const bx = vxOf(v), by = vyOf(v);
  if (foam) {
    foamEdge(c, bx, by, 0, 0, dir, k * (FOAM_P / FOAM_F));
  } else {
    tideRing(c, bx, by, 0, 0, dir, k * (TIDE_P / TIDE_F));
    shoreWet(c, bx, by, 0, 0, dir, k * (TIDE_P / TIDE_F));
  }
  table[idx] = cv;
  return cv;
}

/** Espuma del borde `dir`: variante + fotograma por hash/fase y 1 blit. */
function drawEdgeFoam(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, dir: number, t: number,
): void {
  const v = (hash2(tx * T + dir * 61, ty * T - dir * 47) * EDGE_V) | 0;
  const db = edgeBase(dir, tx, ty) - edgeBase(dir, vxOf(v), vyOf(v));
  const kf = ((((t + db / 3) % FOAM_P) + FOAM_P) % FOAM_P) * FOAM_F / FOAM_P & (FOAM_F - 1);
  x.drawImage(getStrip(true, dir, v, kf), px0, py0);
}

/** Marea+barro del borde `dir`: misma variante que la espuma, ciclo lento. */
function drawEdgeTide(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, dir: number, t: number,
): void {
  const v = (hash2(tx * T + dir * 61, ty * T - dir * 47) * EDGE_V) | 0;
  const db = edgeBase(dir, tx, ty) - edgeBase(dir, vxOf(v), vyOf(v));
  const kt = ((((t + db * 1.2) % TIDE_P) + TIDE_P) % TIDE_P) * TIDE_F / TIDE_P & (TIDE_F - 1);
  x.drawImage(getStrip(false, dir, v, kt), px0, py0);
}

// ============================================================
// CAPA ANIMADA — waterOverlay (1 llamada por frame desde render.ts)
// ============================================================

/**
 * Dibuja SOLO los brillos/olas/espuma animados por ENCIMA del suelo
 * prerrenderizado. No repinta el agua base: se apoya en ella.
 *
 * Cómo conectarla en render.ts (después del blit del groundCanvas, dentro
 * del mismo bloque de transformación para heredar el shake de cámara):
 *   waterOverlay(ctx, camX, camY, g.globalT, g.mapId,
 *                (tx, ty) => tileAt(g.map, g.rows, tx, ty, g.epoch));
 *
 * - camX/camY: los MISMOS valores usados para el blit del suelo
 *   (g.camX/g.camY en px de PANTALLA, ZOOM ya aplicado; internamente se
 *   convierte con floor(camX / Z) igual que hace render.ts).
 * - at: char del tile en coordenadas ABSOLUTAS de mapa (¡ojo, convenio
 *   distinto al `at` relativo de drawTile/paintWater!), consciente de época.
 *
 * Recorre únicamente los tiles visibles y solo pinta en los que son '~'.
 * Trazo en px de MUNDO con scale(Z,Z): alineación exacta con la rejilla
 * de 16 px del canvas de suelo.
 *
 * R5-O5: snapshot en Uint8Array (1 lectura de at por tile y frame),
 * espuma/marea horneadas a minicanvases, culling estricto al viewport y
 * early-out si el bloque visible no contiene agua.
 *
 * Ronda 4 (agua v3): llamar TAMBIÉN cada frame, desde render.ts:
 *   setWaterNight(g.dayT > 0.7 || g.dayT < 0.08 ? 1 : 0);
 * activa el camino de luna (banda plateada en agua abierta); mientras
 * nadie la llame la noche queda a 0. mapId 'cripta' no tiene agua →
 * la capa es un no-op limpio. Nota maps.ts: 'x' NO es agua profunda
 * (es el puente roto del bosque; en el pasado es 'B'): la masa profunda
 * real son los '~' interiores (profundidad 2).
 */
export function waterOverlay(
  x: CanvasRenderingContext2D, camX: number, camY: number, t: number,
  mapId: string, at: (tx: number, ty: number) => string,
): void {
  const viewW = VIEW_W / Z, viewH = VIEW_H / Z;   // ventana visible en px de mundo
  const gx = Math.floor(camX / Z), gy = Math.floor(camY / Z); // igual que render.ts
  // R5-O5 · culling: solo tiles cuyo rect toca la pantalla (margen ≤ 1 tile)
  const vx0 = Math.floor(gx / T), vx1 = Math.ceil((gx + viewW) / T);
  const vy0 = Math.floor(gy / T), vy1 = Math.ceil((gy + viewH) / T);

  // R5-O5 · snapshot del bloque visible (+borde de 1 tile para vecinos):
  // UNA llamada a at() por tile y frame; vecinos y profundidad se leen del
  // Uint8Array (antes: hasta 13 at() por tile de agua).
  const w = vx1 - vx0 + 3, h = vy1 - vy0 + 3;
  if (snap.length < w * h) snap = new Uint8Array(w * h); // solo crece (raro)
  const sx0 = vx0 - 1, sy0 = vy0 - 1;
  let hasWater = false;
  for (let r = 0; r < h; r++) {
    const ty = sy0 + r, rowBase = r * w;
    for (let c = 0; c < w; c++) {
      const code = at(sx0 + c, ty).charCodeAt(0);
      snap[rowBase + c] = code;
      if (code === AQ) hasWater = true;
    }
  }
  if (!hasWater) return; // early-out: ni un tile de agua en el viewport

  const forest = isForest(mapId);
  const reflC = forest ? REFLECT_FC : REFLECT_VC; // reflejos por código de char
  // R4-A1 · anclaje del camino de luna: la MISMA x de pantalla que la luna
  // pre-pintada de sky.ts (VIEW_W*0.78 - camX*0.004), convertida a mundo.
  const moonWx = gx + (VIEW_W * 0.78 - camX * 0.004) / Z;
  // R4-A1 · presupuesto de destellos por frame (2-3 en pantalla)
  let sparkBudget = 3;

  x.save();
  x.translate(-gx * Z, -gy * Z); // coordenadas de mundo escaladas ×2
  x.scale(Z, Z);

  for (let r = 1; r < h - 1; r++) { // solo tiles que tocan la pantalla
    const ty = sy0 + r, rowBase = r * w;
    for (let c = 1; c < w - 1; c++) {
      const idx = rowBase + c;
      if (snap[idx] !== AQ) continue;
      const tx = sx0 + c, px0 = tx * T, py0 = ty * T;
      // vecinos desde la snapshot (0 llamadas a at)
      const cn = snap[idx - w], cs = snap[idx + w], cw = snap[idx - 1], ce = snap[idx + 1];
      // profundidad: 8 vecinos desde la snapshot (0 llamadas a at)
      let n8 = 0;
      if (snap[idx - w - 1] === AQ) n8++;
      if (cn === AQ) n8++;
      if (snap[idx - w + 1] === AQ) n8++;
      if (cw === AQ) n8++;
      if (ce === AQ) n8++;
      if (snap[idx + w - 1] === AQ) n8++;
      if (cs === AQ) n8++;
      if (snap[idx + w + 1] === AQ) n8++;
      const depth = n8 >= 6 ? 2 : n8 >= 3 ? 1 : 0;
      // fase idéntica a la del agua original
      const ph = t * 2 + tx * 0.9 + ty * 1.3;
      const wv = Math.sin(ph) * 0.5 + 0.5;

      // — olas animadas: 2 líneas de 1 px que suben y bajan con la fase
      for (let k = 0; k < 2; k++) {
        const s = Math.sin(ph + k * 2.6);
        const ly = 3 + Math.floor(hash2(tx * 5 + k * 29 + 1, ty * 3 + k * 17 + 2) * 10)
                 + Math.round(s); // -1..+1 px de vaivén
        if (ly < 1 || ly > T - 2) continue;
        const lx = Math.floor(hash2(tx * 3 + k * 7 + 5, ty * 7 + k * 11 + 3) * 7);
        const len = Math.min(T - lx, 5 + Math.floor(hash2(tx * 11 + k, ty * 13 + k * 3) * 5));
        x.fillStyle = forest
          ? (depth === 2 ? 'rgba(120,170,180,0.5)' : 'rgba(150,200,205,0.45)')
          : (depth === 2 ? 'rgba(110,160,205,0.5)' : 'rgba(150,195,228,0.45)');
        x.fillRect(px0 + lx, py0 + ly, len, 1);
        if (k === 0 && wv > 0.72) { // brillo que recorre la ola
          x.fillStyle = 'rgba(214,236,248,0.6)';
          x.fillRect(px0 + lx + Math.floor(wv * (len - 3)), py0 + ly, 3, 1);
        }
      }

      // — oleaje de fondo en agua profunda (banda lenta, muy sutil)
      if (depth === 2) {
        const by = Math.max(1, Math.min(T - 3, 8 + Math.round(Math.sin(ph * 0.5 + tx) * 2)));
        x.fillStyle = 'rgba(70,110,150,0.16)';
        x.fillRect(px0, py0 + by, T, 2);
        // R4-A1 · agua profunda viva: vetas lentas + polvo sumergido
        deepBed(x, tx, ty, px0, py0, t);
      }

      // — destellos sol/luna (R4-A1): hash2 devuelve [0,0.5) → umbral ×2;
      //    presupuesto de 3 por pantalla; blanco cálido de día, frío de noche
      if (sparkBudget > 0) {
        const k2 = Math.floor(t * 2);
        if (hash2(tx * 13 + k2 * 7, ty * 17 + k2 * 3) * 2 > 0.93) {
          sparkBudget--;
          const a = Math.sin((t * 2 - k2) * Math.PI);
          const sx = px0 + 2 + Math.floor(hash2(tx + k2 * 5, ty * 3 - k2) * 12);
          const sy = py0 + 2 + Math.floor(hash2(tx * 7 + k2, ty - k2 * 3) * 12);
          x.globalAlpha = a;
          x.fillStyle = nightF > 0.5 ? SPARK_COOL : SPARK_WARM;
          x.fillRect(sx, sy, 1, 1);
          x.globalAlpha = a * 0.5; // cruz tenue alrededor
          x.fillRect(sx - 1, sy, 1, 1); x.fillRect(sx + 1, sy, 1, 1);
          x.fillRect(sx, sy - 1, 1, 1); x.fillRect(sx, sy + 1, 1, 1);
          x.globalAlpha = 1;
        }
      }

      // — R4-A1 · reflejo oscuro-invertido del borde: banda de 2 px a 3 px
      //    de la orilla con el color del terreno adyacente oscurecido ×0.6
      //    (dibujo inmediato: alpha por frame vía nightF)
      if (isLandCode(cn)) edgeReflect(x, tx, ty, px0, py0, 0, reflC[cn] ?? REFLECT_DF, t);
      if (isLandCode(cs)) edgeReflect(x, tx, ty, px0, py0, 1, reflC[cs] ?? REFLECT_DF, t);
      if (isLandCode(cw)) edgeReflect(x, tx, ty, px0, py0, 2, reflC[cw] ?? REFLECT_DF, t);
      if (isLandCode(ce)) edgeReflect(x, tx, ty, px0, py0, 3, reflC[ce] ?? REFLECT_DF, t);

      // — R5-O5 · espuma animada horneada (1 drawImage por borde; también
      //    bajo puentes, como antes) y marea/barro solo contra tierra firme
      if (cn !== AQ && cn !== VD) drawEdgeFoam(x, tx, ty, px0, py0, 0, t);
      if (cs !== AQ && cs !== VD) drawEdgeFoam(x, tx, ty, px0, py0, 1, t);
      if (cw !== AQ && cw !== VD) drawEdgeFoam(x, tx, ty, px0, py0, 2, t);
      if (ce !== AQ && ce !== VD) drawEdgeFoam(x, tx, ty, px0, py0, 3, t);
      if (isLandCode(cn)) drawEdgeTide(x, tx, ty, px0, py0, 0, t);
      if (isLandCode(cs)) drawEdgeTide(x, tx, ty, px0, py0, 1, t);
      if (isLandCode(cw)) drawEdgeTide(x, tx, ty, px0, py0, 2, t);
      if (isLandCode(ce)) drawEdgeTide(x, tx, ty, px0, py0, 3, t);

      // — R4-A1 · camino de luna: SOLO de noche y en agua ABIERTA (los 4
      //    vecinos son '~': la orilla y los puentes cortan el reflejo)
      if (nightF > 0 && cn === AQ && cs === AQ && cw === AQ && ce === AQ
          && px0 <= moonWx + 8 && px0 + T >= moonWx - 8) {
        moonPath(x, moonWx, px0, py0, t);
      }
    }
  }
  x.restore();
}

/**
 * Línea de espuma de 1-2 px que ondula con sin(t*3 + ...) sobre el borde
 * con tierra/puente. Se dibuja dentro del tile de agua, así que lava la
 * playa estática del prerrender (efecto de oleaje que baña la orilla).
 */
function foamEdge(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, dir: number, t: number,
): void {
  // desfase por borde para que N/S/E/O no respiren al unísono
  const base = edgeBase(dir, tx, ty);
  for (let i = 0; i < T; i += 2) {
    const jag = hash2(tx * T + i * 3 + dir * 257, ty * T + i * 5 + dir * 91);
    const s = Math.sin(t * 3 + base + i * 0.35) * 0.5 + 0.5 + jag * 0.45;
    if (s < 0.45) continue;                 // espuma intermitente (dentada)
    const th = s > 1.05 ? 2 : 1;            // 1-2 px según empuje de la ola
    const r = edgeRect(dir, px0, py0, i, 0, th, 2);
    x.fillStyle = PAL.foam;
    x.fillRect(r[0], r[1], r[2], r[3]);
    if (s > 0.95) { // lavado secundario que la ola deja atrás
      const w = edgeRect(dir, px0, py0, i, th, 1, 2);
      x.fillStyle = PAL.foamWash;
      x.fillRect(w[0], w[1], w[2], w[3]);
    }
  }
}

// ============================================================
// R4-A1 · AGUA V3 — helpers de la capa animada (aditivos)
// ============================================================

/**
 * Camino de luna: banda vertical DITHERED plateada que serpentea y
 * respira. `moonWx` es la x de MUNDO equivalente a la x de PANTALLA de la
 * luna de sky.ts (ver waterOverlay). Se llama solo en agua abierta y solo
 * con noche activa; cada fila ondula con dos senos y el damero global
 * ((wx+wy)&1) + hash rompe la banda en escamas plateadas.
 */
function moonPath(
  x: CanvasRenderingContext2D, moonWx: number,
  px0: number, py0: number, t: number,
): void {
  for (let j = 0; j < T; j++) {
    const wy = py0 + j;
    const cx = moonWx + Math.sin(t * 0.55 + wy * 0.16) * 2.2
                    + Math.sin(t * 1.1 + wy * 0.07) * 1.4; // serpenteo
    const hw = 1.6 + Math.sin(t * 0.42 + wy * 0.11) * 0.9; // 0.7..2.5 px
    const cxi = Math.round(cx);
    const breath = 0.42 + 0.18 * Math.sin(t * 0.8 + wy * 0.05);
    for (let d = -3; d <= 3; d++) {
      const wx = cxi + d;
      if (wx < px0 || wx >= px0 + T) continue;
      const adn = wx - cx;
      const ad = adn < 0 ? -adn : adn;
      if (ad > hw) continue;
      if (((wx + wy) & 1) !== 0) continue;        // damero global
      const h = hash2(wx * 3 + 17, wy * 5 + 29) * 2;
      if (h < 0.22) continue;                     // huecos irregulares
      const core = ad < hw * 0.45 && h > 0.7;
      x.fillStyle = core ? MOON_HI : MOON_LO;
      x.globalAlpha = nightF * breath * (core ? 0.9 : 0.45 + 0.35 * (1 - ad / hw));
      x.fillRect(wx, wy, 1, 1);
    }
  }
  x.globalAlpha = 1;
}

/**
 * Agua profunda (tiles '~' de profundidad 2 — maps.ts no usa 'x' como
 * agua): 2 vetas lentas que derivan en X con envolvente módulo y ondulan
 * en Y, más polvo sumergido escaso (mota de 1 px con deriva y parpadeo).
 */
function deepBed(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, t: number,
): void {
  x.fillStyle = VEIN_COL;
  for (let k = 0; k < 2; k++) {
    const ly = py0 + 2 + Math.floor(hash2(tx * 17 + k * 41 + 3, ty * 23 + k * 13) * 12);
    const ph = hash2(ty * 31 + k * 7, tx * 5 + k * 19) * 24;
    const drift = (t * (2.2 + k * 1.3) + ph) % 24 - 4;   // -4..20 (envolvente)
    const lx0 = px0 + Math.floor(drift);
    for (let i = 0; i < 6; i += 2) {                      // guión ondulado
      const wx = lx0 + i;
      if (wx < px0 || wx >= px0 + T - 1) continue;
      const wy = ly + (Math.sin(t * 0.9 + wx * 0.55 + k * 2) > 0 ? 0 : 1);
      if (wy < py0 || wy >= py0 + T) continue;
      x.fillRect(wx, wy, 2, 1);
    }
  }
  for (let k = 0; k < 2; k++) {                           // polvo sumergido
    const hg = hash2(tx * 29 + k * 7 + 5, ty * 31 - k * 11 + 3) * 2;
    if (hg < 0.95) continue;                              // ~5 % por ranura
    const hx = hash2(tx * 7 + k * 13 + 1, ty * 5 + k * 3);
    const hyv = hash2(tx * 3 + k + 2, ty * 19 - k * 7);
    const wx = px0 + 1 + Math.floor(hx * 14 + Math.sin(t * 0.24 + hg * 40 + k * 2) * 1.6);
    const wy = py0 + 1 + Math.floor(hyv * 14 + Math.cos(t * 0.19 + hg * 23 + k) * 1.6);
    if (wx < px0 || wx >= px0 + T || wy < py0 || wy >= py0 + T) continue;
    const tw = Math.sin(t * (0.5 + hx) + hyv * 50) * 0.5 + 0.5;
    x.globalAlpha = 0.08 + 0.18 * tw;
    x.fillStyle = DUST_COL;
    x.fillRect(wx, wy, 1, 1);
  }
  x.globalAlpha = 1;
}

/**
 * Reflejo oscuro-invertido del borde: banda de 2 px a 3 px de la orilla,
 * dentada por hash, con el color del terreno adyacente ya oscurecido ×0.6
 * (tablas REFLECT_* precalculadas) y un shimmer lento que la vida del agua
 * deforma. Se dibuja DENTRO del tile de agua, bajo la espuma animada.
 */
function edgeReflect(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, dir: number, col: string, t: number,
): void {
  x.fillStyle = col;
  for (let i = 0; i < T; i += 2) {
    const h = hash2(tx * 13 + i * 7 + dir * 31, ty * 11 - i * 3 + dir * 57) * 2;
    if (h < 0.28) continue;                       // dentado determinista
    const sh = Math.sin(t * 1.1 + i * 0.5 + dir * 2.1) * 0.5 + 0.5;
    x.globalAlpha = (0.20 + 0.22 * sh) * (1 - nightF * 0.4);
    const r = edgeRect(dir, px0, py0, i, 3, 2, 2);
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
  x.globalAlpha = 1;
}

/**
 * Anillo de espuma secundario (1 px, foamWash, más tenue que la espuma
 * principal): respira con la marea — avanza/retrocede 1 px en un ciclo
 * lento (~12.5 s) y se disuelve en segmentos por hash + seno compartido
 * con shoreWet para que orilla y barro respiren al unísono.
 */
function tideRing(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, dir: number, t: number,
): void {
  const base = edgeBase(dir, tx, ty);
  const tide = Math.sin(t * 0.5 + base * 0.6);   // -1..1 respiración lenta
  const inset = 2 + (tide > 0 ? 1 : 0);          // 2..3 px desde la orilla
  x.fillStyle = PAL.foamWash;
  x.globalAlpha = 0.5 + 0.15 * tide;
  for (let i = 0; i < T; i += 2) {
    const jag = hash2(tx * T + i * 5 + dir * 131, ty * T - i * 3 + dir * 17) * 2;
    const s = Math.sin(t * 0.5 + base + i * 0.3) * 0.5 + 0.5 + jag * 0.3;
    if (s < 0.62) continue;                      // anillo intermitente
    const r = edgeRect(dir, px0, py0, i, inset, 1, 2);
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
  x.globalAlpha = 1;
}

/**
 * Transición barro/musgo de la orilla interior: banda de 2-3 px de
 * shoreMud (más ancha con marea alta) con motas de musgo (PAL.moss),
 * siguiendo la misma fase de marea que tideRing. Completa el gradiente
 * estático del prerrender: arena → lodo → barro vivo → agua abierta.
 */
function shoreWet(
  x: CanvasRenderingContext2D, tx: number, ty: number,
  px0: number, py0: number, dir: number, t: number,
): void {
  const base = edgeBase(dir, tx, ty);
  const tide = Math.sin(t * 0.5 + base * 0.6);
  const inset = 5 + (tide > 0 ? 0 : 1);          // 5..6 px desde la orilla
  const th = tide > 0.2 ? 3 : 2;                 // 2-3 px de transición
  x.fillStyle = PAL.shoreMud;
  x.globalAlpha = 0.30 + 0.12 * tide;
  for (let i = 0; i < T; i += 2) {
    const jag = hash2(tx * T + i * 11 + dir * 43, ty * T + i * 7 - dir * 71) * 2;
    if (jag > 0.86) continue;                    // huecos en el barro
    const r = edgeRect(dir, px0, py0, i, inset, th, 2);
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
  x.fillStyle = PAL.moss;                        // motas de musgo
  x.globalAlpha = 0.42;
  for (let i = 0; i < T; i += 4) {
    const h = hash2(tx * 19 + i * 3 + dir * 7, ty * 13 - i + dir * 29) * 2;
    if (h < 0.76) continue;
    const r = edgeRect(dir, px0, py0, i, inset + (h > 0.88 ? 1 : 0), 1, 1);
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
  x.globalAlpha = 1;
}
