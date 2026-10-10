// ============================================================
// ECOS DE AELTHAR — BIOMA «CUMBRES HELADAS» (Task 18-b · biomas-cumbres)
// Revisualización integral del mapa 'cumbres' (50×42, maps_expansion.ts
// ~423-469) y sus capas visuales. Módulo ADITIVO y AUTOCONTENIDO: no toca
// ni depende de render/update/engine/maps*/sprites*/world/* (solo importa
// tipos/constantes y tileAt de lectura).
//
// CAPAS QUE AÑADE SOBRE EL BIOMA EXISTENTE:
//   1. Nieve viva    : ventisca mejorada por capas (3 planos parallax con
//                      rachas deterministas), acumulación de nieve
//                      pre-rasterizada en bordes de rocas ('R')/pinos ('p'),
//                      huellas del Portador que se desvanecen (cap 20, TTL 3.2 s).
//   2. Lago helado   : centro-sur, elipse ~centro (30,30) — brillos
//                      especulares que caminan en anillos, grietas
//                      pre-rasterizadas (semillas fijas) y bajo el hielo
//                      3 «voces congeladas» (eco cu_e3) que pulsan muy lento.
//   3. Aurora boreal : 3 cintas ondulantes verdosas/violetas de noche
//                      (dayT coherente con isNight() de update.ts: día si
//                      0.08 ≤ dayT ≤ 0.70, fundido en los bordes).
//   4. Aliento       : vaporito que exhalan Portador/compañera/NPCs cada
//                      ~2.5 s (cap 10), asciende y deriva con el viento.
//   5. Montaña       : sombreado de la cordillera norte ('R' filas 2-5),
//                      crestería nevada, ventisqueros en la base y niebla
//                      ligera sobre la meseta del altar (x21..28, y2..6).
//   6. Hoguera       : brasas tenues + chispas ascendentes ocasionales
//                      (cap 8) en el anillo de los pastores (origen (8,33),
//                      centro del anillo (9,34)).
//
// RENDIMIENTO (presupuesto 18-b): todo lo estático (caps, ventisqueros,
// grietas, sombreado) se PRE-RASTREIZA una vez en un canvas del tamaño del
// mapa (800×672 px) y se blita con UN drawImage recortado a la vista. Los
// pools (huellas 20 / aliento 10 / chispas 8) están prealocados y se
// reciclan: cero GC por frame. Toda la aleatoriedad es determinista:
// mulberry32 con semillas fijas para lo rasterizado, hash2 + globalT para
// lo animado. PROHIBIDO Math.random en render por frame.
//
// ============================================================
// CABLEADO PARA EL INTEGRADOR (nombres exactos)
// ============================================================
//
// 1) TICK (obligatorio) — src/game/render.ts, función drawGame, bloque
//    existente de updateAmbient (líneas ~47-49). Añadir UNA línea:
//
//      if (g.state === 'play' || g.state === 'dialogue') {
//        updateAmbient(g, dtF);
//        cumbresBiomaTick(g, dtF); // 18-b: bioma Cumbres (ventisca/huellas/aliento/hoguera)
//      }
//
//    (Alternativa válida: src/game/update.ts · updateGame, junto a la llamada
//     `interaccionTick(g, dt);` de la línea ~384. Elegimos render.ts como
//     punto recomendado porque el bioma es 100% cosmético y así sigue vivo
//     durante los diálogos, igual que updateAmbient. No genera ciclos:
//     este módulo solo importa de engine.ts/maps.ts.)
//
// 2) DRAW (obligatorio) — src/game/render.ts, función drawWorld, JUSTO
//    después de la capa de cielo (línea ~156, dentro del bloque con el
//    translate de sacudida; ANTES de drawFloats para que los textos floten
//    siempre legibles). Añadir UNA línea:
//
//      drawAmbient(g, 'sky');
//      drawCumbresBiomaOverlay(g); // 18-b: bioma Cumbres (lago/aurora/montaña/ventisca)
//
// 3) INIT (opcional) — src/game/engine.ts, constructor de Game, tras
//    `initExpansionSprites();` (línea ~203). Añadir UNA línea:
//
//      initCumbresBioma(); // 18-b: pools del bioma Cumbres (idempotente)
//
//    Si no se llama, cumbresBiomaTick la invoca perezosamente en su primer
//    tick (también idempotente).
//
// 4) IMPORTS a añadir donde se cablee:
//      import { cumbresBiomaTick, drawCumbresBiomaOverlay } from './biomas_cumbres';
//      // y en engine.ts si se cablea el init: import { initCumbresBioma } from './biomas_cumbres';
//
// NO se edita ningún otro fichero. Los SPRITES de los enemigos de Cumbres
// NO se tocan aquí (propiedad del agente 18-c en sprites_expansion.ts).
// ============================================================

import type { Game } from './engine';
import { TILE, ZOOM, VIEW_W, VIEW_H, tileAt, hash2 } from './engine';

// ---------------- Utilidades deterministas ----------------

/** PRNG mulberry32 (determinista, semillas fijas — solo en install/raster). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Modulo positivo (para envolver ráfagas y cintas). */
function mod(a: number, n: number): number {
  const m = a % n;
  return m < 0 ? m + n : m;
}

/** rgba() con alpha acotada (evita strings inválidos). */
function rgba(r: number, g: number, b: number, a: number): string {
  const aa = a < 0 ? 0 : a > 1 ? 1 : Math.round(a * 1000) / 1000;
  return `rgba(${r},${g},${b},${aa})`;
}

/**
 * Factor de noche 0..1 — REPLICA la convención de update.ts isNight()
 * (dayT > 0.7 || dayT < 0.08) con fundidos suaves en las dos fronteras,
 * para que la aurora entre/salga sin saltos. Lectura pura: no importamos
 * update.ts para no crear ciclos si el integrador cablea el tick allí.
 */
function factorNoche(dayT: number): number {
  const d = ((dayT % 1) + 1) % 1;
  if (d >= 0.7) return Math.min(1, (d - 0.7) / 0.05);
  if (d < 0.08) return d < 0.06 ? 1 : 1 - (d - 0.06) / 0.02;
  return 0;
}

/** Envolvente de rachas 0..1: valles largos, picos cortos (100% determinista). */
function rachaK(t: number): number {
  const a = 0.5 + 0.5 * Math.sin(t * 0.43 + 1.1);
  const b = 0.5 + 0.5 * Math.sin(t * 0.17 + 4.2);
  let k = a * b * 1.6 - 0.28;
  if (k < 0) k = 0; else if (k > 1) k = 1;
  return k;
}

/** Viento base hacia el este (px/s de mundo 1×), crece con la racha. */
function vientoX(t: number): number {
  return 20 + 30 * rachaK(t);
}

// ---------------- Anclas del bioma (maps_expansion.ts · buildCumbres) ----

const LAGO_CX = 30 * TILE;      // elipse del lago: centro (30,30) tiles
const LAGO_CY = 30 * TILE;      //   rx 6 tiles · ry 4 tiles (tiles 'i')
const HOGUERA_X = 9 * TILE + 8; // anillo de piedras rectOutline(8,33,3,3) → centro (9,34)
const HOGUERA_Y = 34 * TILE + 8;
const MESETA_X0 = 21 * TILE;    // meseta del altar rect(21,2,8,5,'=') → x21..28
const MESETA_X1 = 29 * TILE + 8;
const MESETA_Y0 = 20;           // banda de niebla sobre la meseta (mundo 1×)
const MESETA_Y1 = 120;

// ---------------- Estado del módulo ----------------

let installed = false;
let lastMapId = '';
let raster: HTMLCanvasElement | null = null;
let rasterKey = '';

// ---- huellas del Portador (cap duro 20, TTL corto) ----
const HUELLAS_N = 20;
const HUELLA_TTL = 3.2;
interface Huella { on: boolean; x: number; y: number; t: number }
const huellas: Huella[] = Array.from({ length: HUELLAS_N }, () => ({ on: false, x: 0, y: 0, t: 0 }));
let hIndex = 0;
let hDist = 0;
let hAlt = 0;
let lastPX = 0;
let lastPY = 0;

// ---- aliento visible (cap duro 10; 12 emisores: portador+compañera+10 NPCs) ----
const ALIENTO_N = 10;
const ALIENTO_EMISORES = 12;
interface Puff { on: boolean; x: number; y: number; vx: number; t: number; T: number }
const aliento: Puff[] = Array.from({ length: ALIENTO_N }, () => ({ on: false, x: 0, y: 0, vx: 0, t: 0, T: 1 }));
const alientoNext: number[] = [];
for (let i = 0; i < ALIENTO_EMISORES; i++) alientoNext.push(1.2 + i * 0.35); // fases iniciales escalonadas

// ---- chispas de la hoguera (cap duro 8) ----
const CHISPAS_N = 8;
interface Chispa { on: boolean; x: number; y: number; vx: number; vy: number; t: number; T: number; seed: number }
const chispas: Chispa[] = Array.from({ length: CHISPAS_N },
  () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, T: 1, seed: 0 }));
let chispaAcc = 0;
let chispaSeq = 0;

/** Busca una ranura libre en un pool (los slots son intercambiables). */
function libre<T extends { on: boolean }>(pool: T[]): T | null {
  for (let i = 0; i < pool.length; i++) if (!pool[i].on) return pool[i];
  return null;
}

/** Reset de lo dinámico (cambio de mapa / install). No toca lo estático. */
function resetDinamico(): void {
  for (let i = 0; i < HUELLAS_N; i++) huellas[i].on = false;
  for (let i = 0; i < ALIENTO_N; i++) aliento[i].on = false;
  for (let i = 0; i < CHISPAS_N; i++) chispas[i].on = false;
  hIndex = 0; hDist = 0; hAlt = 0; lastPX = 0; lastPY = 0;
  chispaAcc = 0; chispaSeq = 0;
  for (let i = 0; i < ALIENTO_EMISORES; i++) alientoNext[i] = 1.2 + i * 0.35;
}

/**
 * initCumbresBioma — idempotente. Prepara pools/estado; el raster se
 * construye perezosamente en el primer tick sobre 'cumbres' (necesita rows).
 */
export function initCumbresBioma(): void {
  installed = true;
  resetDinamico();
}

// ============================================================
// PRE-RASTREIZADO ESTÁTICO (install perezoso, semillas fijas)
// Canvas del tamaño del mapa 1× con: acumulación de nieve en bordes de
// rocas/pinos, sombreado de la cordillera norte, ventisqueros y grietas
// del lago. DETERMINISTA: solo mulberry32/hash2 sobre rows — dos builds
// del mismo mapa producen el mismo canvas (verificado en el smoke).
// ============================================================

function ensureRaster(g: Game): void {
  const key = `${g.mapId}:${g.epoch}:${g.map.w}x${g.map.h}:${g.rows.length}`;
  if (raster && key === rasterKey) return;
  raster = buildRaster(g.rows, g.map.w, g.map.h);
  rasterKey = key;
}

function buildRaster(rows: string[], w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w * TILE;
  cv.height = h * TILE;
  const x = cv.getContext('2d');
  if (!x) return cv;
  x.imageSmoothingEnabled = false;

  const rngA = mulberry32(1847); // gorros de nieve + ventisqueros
  const rngB = mulberry32(6317); // facetas/sombreado de la cordillera
  const rngC = mulberry32(9203); // grietas maestras del lago

  const at = (tx: number, ty: number): string =>
    tx < 0 || ty < 0 || tx >= w || ty >= h ? '.' : rows[ty].charAt(tx);

  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const ch = rows[ty].charAt(tx);
      const px0 = tx * TILE;
      const py0 = ty * TILE;
      if (ch === 'R') {
        // ---- roca / cordillera: facetas + crestería + ventisqueros ----
        x.fillStyle = 'rgba(255,255,255,0.10)';            // faceta iluminada (NO-NO)
        x.fillRect(px0 + 1, py0 + 1, 12, 2);
        x.fillStyle = 'rgba(26,42,72,0.20)';               // faceta en sombra (este)
        x.fillRect(px0 + 10, py0 + 1, 6, 13);
        x.fillStyle = 'rgba(22,36,64,0.15)';               // asiento al sur
        x.fillRect(px0, py0 + 13, 16, 3);
        if (at(tx, ty - 1) !== 'R') {
          // crestería: canto nevado del borde superior libre
          x.fillStyle = 'rgba(244,250,255,0.85)';
          x.fillRect(px0, py0 - 1, 16, 2);
          x.fillStyle = 'rgba(180,200,224,0.50)';
          for (let k = 0; k < 3; k++) {
            x.fillRect(px0 + 2 + k * 5 + Math.floor(rngA() * 2), py0 + 1, 2, 1);
          }
        }
        if (at(tx, ty + 1) !== 'R') {
          // ventisquero apoyado en la base
          x.fillStyle = 'rgba(238,246,252,0.75)';
          x.fillRect(px0, py0 + 14, 16, 2);
          x.fillStyle = 'rgba(246,251,255,0.65)';
          x.fillRect(px0 + Math.floor(rngB() * 4), py0 + 13, 9, 1);
        }
        if (rngA() < 0.30) {
          // lengua de ventisquero larga (deriva del viento, oeste→este)
          const dw = 10 + Math.floor(rngA() * 8);
          x.fillStyle = 'rgba(242,248,254,0.70)';
          x.fillRect(px0 + Math.floor(rngB() * 6), py0 + 12 + Math.floor(rngB() * 3), dw, 2);
        }
      } else if (ch === 'p') {
        // ---- pino nevado: ventisquero contra el tronco + gorro extra ----
        x.fillStyle = 'rgba(240,247,253,0.85)';
        x.fillRect(px0 + 3, py0 + 13, 10, 3);
        x.fillStyle = 'rgba(248,252,255,0.90)';
        x.fillRect(px0 + 5, py0 + 12, 6, 2);
        x.fillStyle = 'rgba(238,246,252,0.75)';
        x.fillRect(px0 + 5, py0 - 2, 6, 2);
        x.fillStyle = 'rgba(248,252,255,0.80)';
        x.fillRect(px0 + 6, py0 - 3, 4, 2);
        if (rngA() < 0.28) {
          x.fillStyle = 'rgba(214,236,250,0.80)';          // carámbano bajo la copa
          x.fillRect(px0 + 4 + Math.floor(rngA() * 7), py0 + 8, 1, 3);
        }
      } else if (ch === 'i') {
        // ---- lago helado: orillas reblanecidas + grietas cortas ----
        x.fillStyle = 'rgba(235,248,255,0.50)';
        if (at(tx - 1, ty) !== 'i') x.fillRect(px0, py0, 2, 16);
        if (at(tx + 1, ty) !== 'i') x.fillRect(px0 + 14, py0, 2, 16);
        if (at(tx, ty - 1) !== 'i') x.fillRect(px0, py0, 16, 2);
        if (at(tx, ty + 1) !== 'i') x.fillRect(px0, py0 + 14, 16, 2);
        const r = hash2(tx * 5 + 1, ty * 9 + 2);
        if (r < 0.34) {
          let cx0 = px0 + 2 + (Math.floor(r * 100) % 12);
          let cy0 = py0 + 2 + Math.floor(hash2(tx, ty * 3 + 7) * 11);
          const steps = 4 + (Math.floor(r * 977) % 6);
          for (let k = 0; k < steps; k++) {
            x.fillStyle = 'rgba(44,90,134,0.30)';          // sombra de la grieta
            x.fillRect(cx0 + 1, cy0 + 1, 2, 1);
            x.fillStyle = 'rgba(230,246,255,0.55)';        // brillo de la grieta
            x.fillRect(cx0, cy0, 2, 1);
            cx0 += hash2(tx * 3 + k, ty * 5 + k) < 0.5 ? 2 : 1;
            cy0 += hash2(ty * 7 + k, tx + k) < 0.55 ? 1 : 0;
            if (cx0 > px0 + 13 || cy0 > py0 + 13) break;   // dentro del tile
          }
        }
      }
    }
  }

  // ---- grietas maestras del lago: 3 recorridos largos en abanico ----
  for (let c = 0; c < 3; c++) {
    let cx0 = LAGO_CX + (c - 1) * 10;
    let cy0 = LAGO_CY - 4 + (c % 2) * 10;
    let ang = -0.55 + c * 1.05 + rngC() * 0.4;
    const steps = 26 + Math.floor(rngC() * 16);
    for (let k = 0; k < steps; k++) {
      const txx = Math.floor(cx0 / TILE);
      const tyy = Math.floor(cy0 / TILE);
      if (txx < 0 || tyy < 0 || txx >= w || tyy >= h) break;
      if (rows[tyy].charAt(txx) !== 'i') break;            // la grieta muere en la orilla
      x.fillStyle = 'rgba(44,90,134,0.30)';
      x.fillRect(Math.floor(cx0) + 1, Math.floor(cy0) + 1, 2, 1);
      x.fillStyle = 'rgba(232,247,255,0.50)';
      x.fillRect(Math.floor(cx0), Math.floor(cy0), 2, 1);
      ang += (rngC() - 0.5) * 0.55;
      cx0 += Math.cos(ang) * 3;
      cy0 += Math.sin(ang) * 2.4;
    }
  }
  return cv;
}

// ============================================================
// TICK — cumbresBiomaTick(g, dt): pools dinámicos (1× por frame)
// ============================================================

function onCam(g: Game, wx: number, wy: number): boolean {
  const x = wx * ZOOM - g.camX;
  const y = wy * ZOOM - g.camY;
  return x > -40 && x < VIEW_W + 40 && y > -40 && y < VIEW_H + 40;
}

export function cumbresBiomaTick(g: Game, dt: number): void {
  if (!installed) initCumbresBioma();
  if (g.mapId !== 'cumbres') {
    if (lastMapId === 'cumbres') resetDinamico(); // salir de Cumbres limpia pools
    lastMapId = g.mapId;
    return;
  }
  lastMapId = 'cumbres';
  ensureRaster(g);
  const t = g.globalT;

  // ---- huellas del Portador sobre nieve ('S'), nunca sobre hielo/camino ----
  const p = g.player;
  if (p && p.moving && p.rollT <= 0) {
    const dx = p.x - lastPX;
    const dy = p.y - lastPY;
    hDist += Math.sqrt(dx * dx + dy * dy);
    if (hDist > 11) {
      hDist = 0;
      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor((p.y + p.h * 0.5) / TILE);
      if (tileAt(g.map, g.rows, tx, ty, g.epoch) === 'S') {
        const s = huellas[hIndex];
        s.on = true; s.t = 0;
        const lat = p.dir === 'left' || p.dir === 'right';
        s.x = p.x + (lat ? 0 : (hAlt ? 2 : -2));
        s.y = p.y + p.h * 0.5 + (lat ? (hAlt ? 2 : -2) : 1);
        hAlt = hAlt ? 0 : 1;
        hIndex = (hIndex + 1) % HUELLAS_N;
      }
    }
  }
  if (p) { lastPX = p.x; lastPY = p.y; }
  for (let i = 0; i < HUELLAS_N; i++) {
    const s = huellas[i];
    if (!s.on) continue;
    s.t += dt;
    if (s.t >= HUELLA_TTL) s.on = false;
  }

  // ---- aliento visible: Portador, compañera y NPCs (cada ~2.5 s por emisor) ----
  const viento = vientoX(t);
  for (let i = 0; i < ALIENTO_EMISORES; i++) alientoNext[i] -= dt;
  const emite = (slot: number, e: { x: number; y: number; dir: string }, ddx: number): void => {
    if (slot >= ALIENTO_EMISORES || alientoNext[slot] > 0) return;
    alientoNext[slot] = 2.5 + hash2(slot * 17 + 3, 91) * 0.7; // ~2.5 s estable por emisor
    if (!onCam(g, e.x, e.y)) return;
    const s = libre(aliento);
    if (!s) return;                                          // cap duro 10
    s.on = true; s.t = 0; s.T = 0.85;
    s.x = e.x + ddx;
    s.y = e.y - 9;
    s.vx = viento * 0.14;
  };
  if (p) emite(0, p, p.dir === 'left' ? -4 : p.dir === 'right' ? 4 : 0);
  if (g.companion && g.companion.downT <= 0) {
    emite(1, g.companion, g.companion.dir === 'left' ? -4 : g.companion.dir === 'right' ? 4 : 0);
  }
  for (let i = 0; i < g.npcs.length; i++) {
    const n = g.npcs[i];
    emite(2 + i, n, n.dir === 'left' ? -4 : n.dir === 'right' ? 4 : 0);
  }
  for (let i = 0; i < ALIENTO_N; i++) {
    const s = aliento[i];
    if (!s.on) continue;
    s.t += dt;
    s.y -= 7 * dt;          // el vapor asciende
    s.x += s.vx * dt;       // y deriva con el viento
    if (s.t >= s.T) s.on = false;
  }

  // ---- chispas de la hoguera de los pastores (cap duro 8) ----
  chispaAcc += dt;
  while (chispaAcc >= 0.62) {
    chispaAcc -= 0.62;
    const s = libre(chispas);
    if (!s) break;
    const r1 = hash2(chispaSeq * 29 + 1, 57);
    const r2 = hash2(chispaSeq * 31 + 5, 61);
    const r3 = hash2(chispaSeq * 37 + 7, 67);
    chispaSeq++;
    s.on = true; s.t = 0;
    s.T = 0.75 + r2 * 0.55;
    s.x = HOGUERA_X + (r1 - 0.5) * 7;
    s.y = HOGUERA_Y - 2;
    s.vy = -(12 + r3 * 9);
    s.vx = viento * 0.22 + (r1 - 0.5) * 5;
    s.seed = r2 * 6.283;
  }
  for (let i = 0; i < CHISPAS_N; i++) {
    const s = chispas[i];
    if (!s.on) continue;
    s.t += dt;
    s.y += s.vy * dt;
    s.vy += 4 * dt;         // frenan al subir (el frío las apaga)
    s.x += s.vx * dt;
    if (s.t >= s.T) s.on = false;
  }
}

// ============================================================
// DRAW — drawCumbresBiomaOverlay(g): TODAS las capas del bioma.
// Enganche documentado en la cabecera (render.ts · drawWorld · tras
// drawAmbient(g,'sky')). Coordenadas de pantalla: sx = wx*ZOOM - cam.
// ============================================================

/** Cintas de la aurora (noche): geometría + color base y color del núcleo. */
interface Cinta {
  yBase: number; amp: number; w: number; ph: number;
  r: number; g: number; b: number;      // cuerpo (verdoso / violeta / turquesa)
  r2: number; g2: number; b2: number;   // núcleo brillante
}
const AURORAS: readonly Cinta[] = [
  { yBase: 40, amp: 30, w: 0.30, ph: 0.0, r: 78, g: 232, b: 156, r2: 180, g2: 248, b2: 212 },
  { yBase: 84, amp: 40, w: 0.21, ph: 2.1, r: 154, g: 116, b: 242, r2: 216, g2: 200, b2: 255 },
  { yBase: 128, amp: 24, w: 0.38, ph: 4.4, r: 108, g: 232, b: 196, r2: 204, g2: 255, b2: 232 },
];

// ---- lago: «voces congeladas» bajo el hielo (eco cu_e3, pulso muy lento) ----
const VOCES: readonly { x: number; y: number; T: number; ph: number }[] = [
  { x: 466, y: 468, T: 11.5, ph: 0.0 },
  { x: 495, y: 486, T: 14.0, ph: 4.2 },
  { x: 480, y: 500, T: 9.5, ph: 8.3 },
];
// ---- lago: radios de los anillos de brillos especulares (3 anillos × 2) ----
const ANILLO_RX: readonly number[] = [30, 58, 84];
const ANILLO_RY: readonly number[] = [20, 40, 58];

// ---- ventisca: [parallax, velocidad base, nº ráfagas, tono] por capa ----
const CAPAS_VIENTO: readonly [number, number, number, number][] = [
  [0.22, 66, 10, 0.10],
  [0.42, 118, 12, 0.13],
  [0.70, 185, 14, 0.16],
];

export function drawCumbresBiomaOverlay(g: Game): void {
  if (!g || g.mapId !== 'cumbres') return;
  if (g.state === 'title' || g.state === 'controls') return;
  const ctx = g.ctx;
  const camX = Math.round(g.camX);
  const camY = Math.round(g.camY);
  const sx = (wx: number): number => wx * ZOOM - camX;
  const sy = (wy: number): number => wy * ZOOM - camY;
  const t = g.globalT;
  const racha = rachaK(t);

  // ---- 1) raster estático: UN drawImage recortado a la vista ----
  if (!raster) ensureRaster(g);
  if (raster) {
    const mw = g.map.w * TILE;
    const mh = g.map.h * TILE;
    const rx0 = Math.max(0, Math.floor(camX / ZOOM));
    const ry0 = Math.max(0, Math.floor(camY / ZOOM));
    const rx1 = Math.min(mw, Math.ceil((camX + VIEW_W) / ZOOM));
    const ry1 = Math.min(mh, Math.ceil((camY + VIEW_H) / ZOOM));
    if (rx1 > rx0 && ry1 > ry0) {
      ctx.drawImage(
        raster, rx0, ry0, rx1 - rx0, ry1 - ry0,
        Math.round(rx0 * ZOOM - camX), Math.round(ry0 * ZOOM - camY),
        (rx1 - rx0) * ZOOM, (ry1 - ry0) * ZOOM,
      );
    }
  }

  // ---- 2) huellas que se desvanecen (bajo todo lo demás del bioma) ----
  for (let i = 0; i < HUELLAS_N; i++) {
    const s = huellas[i];
    if (!s.on) continue;
    const x = sx(s.x);
    const y = sy(s.y);
    if (x < -8 || x > VIEW_W + 8 || y < -8 || y > VIEW_H + 8) continue;
    const k = 1 - s.t / HUELLA_TTL;
    ctx.fillStyle = rgba(120, 148, 184, 0.34 * k);         // pisada (sombrita azul)
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 2);
    ctx.fillStyle = rgba(246, 251, 255, 0.30 * k);         // borde de nieve removida
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 1);
  }

  // ---- 3) lago helado: voces bajo el hielo (eco cu_e3) ----
  for (let i = 0; i < VOCES.length; i++) {
    const V = VOCES[i];
    const pulse = 0.5 + 0.5 * Math.sin((t / V.T) * Math.PI * 2 + V.ph); // pulso MUY lento
    const a = 0.045 + 0.085 * pulse;
    const x = sx(V.x);
    const y = sy(V.y);
    if (x < -40 || x > VIEW_W + 40 || y < -40 || y > VIEW_H + 40) continue;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(111, 178, 232, a * 0.55);         // halo difuso bajo el hielo
    ctx.fillRect(Math.round(x) - 9, Math.round(y) - 15, 18, 22);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(168, 212, 248, a * 1.5);          // silueta azulada boca arriba
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 13, 4, 4);   // cabeza
    ctx.fillRect(Math.round(x) - 3, Math.round(y) - 8, 6, 9);    // torso
    ctx.fillRect(Math.round(x) - 6, Math.round(y) - 7, 2, 5);    // brazo izq
    ctx.fillRect(Math.round(x) + 4, Math.round(y) - 7, 2, 5);    // brazo der
  }

  // ---- 4) lago helado: brillos especulares que caminan en anillos ----
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const ring = i % 3;
    const om = 0.13 + i * 0.019;
    const ph = i * 1.93;
    const gx = LAGO_CX + Math.cos(t * om + ph) * ANILLO_RX[ring];
    const gy = LAGO_CY + Math.sin(t * om * 1.18 + ph) * ANILLO_RY[ring];
    const x = sx(gx);
    const y = sy(gy);
    if (x < -12 || x > VIEW_W + 12 || y < -12 || y > VIEW_H + 12) continue;
    const a = 0.09 + 0.14 * (0.5 + 0.5 * Math.sin(t * 1.27 + i * 2.4));
    ctx.fillStyle = rgba(234, 250, 255, a);
    ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
    ctx.fillStyle = rgba(210, 240, 255, a * 0.5);          // cola al oeste (el viento empuja al este)
    ctx.fillRect(Math.round(x) - 3, Math.round(y), 2, 1);
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';

  // ---- 5) meseta del altar: niebla ligera y solemne ----
  const mx0 = sx(MESETA_X0);
  const mx1 = sx(MESETA_X1);
  const my0 = sy(MESETA_Y0);
  const my1 = sy(MESETA_Y1);
  if (mx1 > 0 && mx0 < VIEW_W && my1 > 0 && my0 < VIEW_H) {
    ctx.fillStyle = rgba(230, 238, 248, 0.035);            // velo general
    ctx.fillRect(Math.round(mx0) - 8, Math.round(my0), Math.round(mx1 - mx0) + 16, Math.round(my1 - my0));
    for (let i = 0; i < 3; i++) {
      const wy = 44 + i * 26 + Math.sin(t * 0.21 + i * 2.3) * 6;
      const wx = MESETA_X0 - 10 + Math.sin(t * 0.13 + i * 1.7) * 8;
      const a = 0.05 + 0.02 * Math.sin(t * 0.35 + i * 1.1);
      ctx.fillStyle = rgba(226, 236, 248, a);
      ctx.fillRect(Math.round(sx(wx)), Math.round(sy(wy)), Math.round(MESETA_X1 - MESETA_X0) + 20, 8 + i * 2);
    }
  }

  // ---- 6) hoguera de los pastores: brasas tenues + chispas ----
  const fx = sx(HOGUERA_X);
  const fy = sy(HOGUERA_Y);
  if (fx > -60 && fx < VIEW_W + 60 && fy > -60 && fy < VIEW_H + 60) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(255, 140, 58, 0.07 + 0.035 * Math.sin(t * 2.2));   // halo
    ctx.fillRect(Math.round(fx) - 16, Math.round(fy) - 12, 32, 20);
    ctx.fillStyle = rgba(255, 184, 92, 0.09 + 0.05 * Math.sin(t * 3.1 + 1.2)); // interior
    ctx.fillRect(Math.round(fx) - 7, Math.round(fy) - 7, 14, 10);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    const br = 0.5 + 0.2 * Math.sin(t * 4.7);              // brasa que respira
    ctx.fillStyle = rgba(226, 88, 42, br);
    ctx.fillRect(Math.round(fx) - 4, Math.round(fy) - 3, 8, 5);
    ctx.fillStyle = rgba(255, 154, 74, br);
    ctx.fillRect(Math.round(fx) - 2, Math.round(fy) - 2, 4, 3);
    for (let i = 0; i < CHISPAS_N; i++) {
      const s = chispas[i];
      if (!s.on) continue;
      const x = sx(s.x) + Math.sin(t * 7 + s.seed) * 2;    // vaivén de ascendencia
      const y = sy(s.y);
      if (x < -8 || x > VIEW_W + 8 || y < -8 || y > VIEW_H + 8) continue;
      const a = (1 - s.t / s.T) * 0.85;
      ctx.fillStyle = rgba(255, 207, 122, a);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
      ctx.fillStyle = rgba(255, 160, 70, a * 0.3);         // micro-halo
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    }
  }

  // ---- 7) aliento visible (vaporito que asciende) ----
  for (let i = 0; i < ALIENTO_N; i++) {
    const s = aliento[i];
    if (!s.on) continue;
    const x = sx(s.x);
    const y = sy(s.y);
    if (x < -20 || x > VIEW_W + 20 || y < -20 || y > VIEW_H + 20) continue;
    const k = 1 - s.t / s.T;
    const sz = 2 + s.t * 5;                                // crece al ascender
    ctx.fillStyle = rgba(238, 246, 255, 0.20 * k);
    ctx.fillRect(Math.round(x) - (sz >> 1), Math.round(y) - (sz >> 1), sz, Math.max(2, (sz * 0.7) | 0));
    ctx.fillStyle = rgba(250, 253, 255, 0.16 * k);
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - (sz >> 1) - 2, 2, 2);
  }

  // ---- 8) ventisca mejorada por capas (ráfagas direccionales con rachas) ----
  ctx.fillStyle = rgba(238, 246, 255, 0.026 + 0.03 * racha); // lavado de blancura
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let L = 0; L < CAPAS_VIENTO.length; L++) {
    const par = CAPAS_VIENTO[L][0];
    const vel = CAPAS_VIENTO[L][1] * (0.55 + 0.65 * racha);
    const n = CAPAS_VIENTO[L][2];
    const ton = CAPAS_VIENTO[L][3];
    const spanX = VIEW_W + 120;
    const spanY = VIEW_H + 80;
    for (let i = 0; i < n; i++) {
      const h1 = hash2(i * 13 + L * 57, 911);
      const h2 = hash2(i * 29 + L * 97, 913);
      const h3 = hash2(i * 7 + L * 31, 919);
      const h4 = hash2(i * 11 + L * 53, 929);
      const x = mod(h1 * 2600 + t * vel - camX * par, spanX) - 60;
      const y = mod(h2 * 1700 + t * (16 + L * 7 + h3 * 8) - camY * par, spanY) - 40;
      const len = (4 + L * 3) * (1 + 1.4 * racha) + h4 * 6;
      ctx.fillStyle = rgba(244, 250, 255, ton * (0.4 + 0.6 * racha) + h3 * 0.05);
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(len), 1);
      if (L === 2) {                                       // capa cercana: traza diagonal
        ctx.fillStyle = rgba(244, 250, 255, ton * (0.25 + 0.35 * racha));
        ctx.fillRect(Math.round(x + len * 0.45), Math.round(y) + 1, Math.round(len * 0.5), 1);
      }
    }
  }

  // ---- 9) aurora boreal (solo de noche; coherente con isNight) ----
  const nf = factorNoche(g.dayT);
  if (nf > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < AURORAS.length; r++) {
      const A = AURORAS[r];
      for (let j = 0; j < 22; j++) {
        const yc = A.yBase + (j - 10) * 8;
        const wave = Math.sin(t * A.w + j * 0.31 + A.ph) * A.amp +
                     Math.sin(t * A.w * 0.57 + j * 0.13 + A.ph * 2) * A.amp * 0.55;
        const y = yc + wave - camY * 0.04;                 // parallax mínimo con la cámara
        const env = Math.sin((Math.PI * (j + 0.5)) / 22);
        const flick = 0.7 + 0.3 * Math.sin(t * 0.9 + j * 0.8 + A.ph);
        const a = env * env * flick * nf * 0.085;
        if (a < 0.004) continue;
        ctx.fillStyle = rgba(A.r, A.g, A.b, a);
        ctx.fillRect(-24, Math.round(y), VIEW_W + 48, 7);
        ctx.fillStyle = rgba(A.r2, A.g2, A.b2, a * 1.7);   // núcleo brillante de la cinta
        ctx.fillRect(-24, Math.round(y) + 2, VIEW_W + 48, 2);
      }
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------------- Ganchos de verificación (solo smoke/debug) ----------------

/** Estado de los pools y del raster — para el smoke y el panel de debug. */
export function __cumbresDebug(): {
  installed: boolean; huellas: number; aliento: number; chispas: number; rasterKey: string;
} {
  let nh = 0, na = 0, nc = 0;
  for (let i = 0; i < HUELLAS_N; i++) if (huellas[i].on) nh++;
  for (let i = 0; i < ALIENTO_N; i++) if (aliento[i].on) na++;
  for (let i = 0; i < CHISPAS_N; i++) if (chispas[i].on) nc++;
  return { installed, huellas: nh, aliento: na, chispas: nc, rasterKey };
}

/** dataURL del raster estático (determinismo ×2 del smoke; null si aún no hay). */
export function __cumbresRasterDataUrl(): string | null {
  return raster ? raster.toDataURL() : null;
}
