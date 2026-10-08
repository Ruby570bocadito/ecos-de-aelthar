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
// ============================================================

import { hash2, isForest } from './palette';
import { px, PAL, type NeighborFn } from './palette';

const T = 16; // lado del tile en px de mundo
const Z = 2;  // ZOOM de engine.ts: px de pantalla por cada px de mundo
const VIEW_W = 960, VIEW_H = 540; // espejo de engine.ts (px de pantalla)

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

/** Variante con `at` ABSOLUTO (la que usa waterOverlay). */
function countAroundAbs(at: (tx: number, ty: number) => string, tx: number, ty: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (at(tx + dx, ty + dy) === '~') n++;
    }
  }
  return n;
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
 */
function edgeRect(
  dir: number, px0: number, py0: number, i: number, inset: number, size: number, seg: number,
): [number, number, number, number] {
  if (dir === 0) return [px0 + i, py0 + inset, seg, size];              // N ↓
  if (dir === 1) return [px0 + i, py0 + T - inset - size, seg, size];   // S ↑
  if (dir === 2) return [px0 + inset, py0 + i, size, seg];              // W →
  return [px0 + T - inset - size, py0 + i, size, seg];                  // E ←
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
 * Recorre únicamente los tiles visibles (~600 pruebas de at por frame) y
 * solo pinta en los que son '~'. Trazo en px de MUNDO con scale(Z,Z):
 * alineación exacta con la rejilla de 16 px del canvas de suelo.
 */
export function waterOverlay(
  x: CanvasRenderingContext2D, camX: number, camY: number, t: number,
  mapId: string, at: (tx: number, ty: number) => string,
): void {
  const viewW = VIEW_W / Z, viewH = VIEW_H / Z;   // ventana visible en px de mundo
  const gx = Math.floor(camX / Z), gy = Math.floor(camY / Z); // igual que render.ts
  const tx0 = Math.floor(gx / T) - 1, tx1 = Math.ceil((gx + viewW) / T) + 1;
  const ty0 = Math.floor(gy / T) - 1, ty1 = Math.ceil((gy + viewH) / T) + 1;
  const forest = isForest(mapId);

  x.save();
  x.translate(-gx * Z, -gy * Z); // coordenadas de mundo escaladas ×2
  x.scale(Z, Z);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (at(tx, ty) !== '~') continue;
      const px0 = tx * T, py0 = ty * T;
      const depth = depthLevel(countAroundAbs(at, tx, ty));
      // fase idéntica a la del agua original
      const ph = t * 2 + tx * 0.9 + ty * 1.3;
      const w = Math.sin(ph) * 0.5 + 0.5;

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
        if (k === 0 && w > 0.72) { // brillo que recorre la ola
          x.fillStyle = 'rgba(214,236,248,0.6)';
          x.fillRect(px0 + lx + Math.floor(w * (len - 3)), py0 + ly, 3, 1);
        }
      }

      // — oleaje de fondo en agua profunda (banda lenta, muy sutil)
      if (depth === 2) {
        const by = Math.max(1, Math.min(T - 3, 8 + Math.round(Math.sin(ph * 0.5 + tx) * 2)));
        x.fillStyle = 'rgba(70,110,150,0.16)';
        x.fillRect(px0, py0 + by, T, 2);
      }

      // — destellos sparkle: hash2 por (tx, ty, floor(t*2)), fundido 0→1→0
      const k2 = Math.floor(t * 2);
      if (hash2(tx * 13 + k2 * 7, ty * 17 + k2 * 3) > 0.82) {
        const a = Math.sin((t * 2 - k2) * Math.PI);
        const sx = px0 + 2 + Math.floor(hash2(tx + k2 * 5, ty * 3 - k2) * 12);
        const sy = py0 + 2 + Math.floor(hash2(tx * 7 + k2, ty - k2 * 3) * 12);
        x.globalAlpha = a;
        x.fillStyle = PAL.sparkle;
        x.fillRect(sx, sy, 1, 1);
        x.globalAlpha = a * 0.5; // cruz tenue alrededor
        x.fillRect(sx - 1, sy, 1, 1); x.fillRect(sx + 1, sy, 1, 1);
        x.fillRect(sx, sy - 1, 1, 1); x.fillRect(sx, sy + 1, 1, 1);
        x.globalAlpha = 1;
      }

      // — espuma animada en las orillas (vecino no-agua, dentro del tile)
      for (let d = 0; d < 4; d++) {
        const c = at(tx + (d === 2 ? -1 : d === 3 ? 1 : 0), ty + (d === 0 ? -1 : d === 1 ? 1 : 0));
        if (c === '~' || c === 'V') continue; // agua o borde de mapa: sin espuma
        foamEdge(x, tx, ty, px0, py0, d, t);
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
  const base = dir === 0 ? tx * 0.7
             : dir === 1 ? tx * 0.7 + 2.1
             : dir === 2 ? ty * 0.7 + 4.2
             : ty * 0.7 + 5.5;
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
