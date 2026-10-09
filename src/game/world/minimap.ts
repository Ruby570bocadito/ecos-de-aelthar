// ============================================================
// ECOS DE AELTHAR — Minimapa v4 (módulo world)
// Sustituto mejorado del minimapa plano de buildGround():
//  · 2 px por tile con paleta coherente con los módulos world,
//    incluidos los tiles de expansión ('s' arena, 'S' nieve,
//    'i' hielo, '=' camino, 'n' niebla muda — antes caían al vacío)
//  · variación de hierba por hash, relieve falso por bloques
//    de tiles del mismo tipo, contorno costero del agua
//  · tinte cálido suave en la época 'pasado'
//  · v4 (R6-V8): marco PERGAMINO/BRONCE con esquinas biseladas,
//    pre-renderizado y cacheado por (tamaño+época+mapa): por frame
//    es UN drawImage. Placa v3 intacta (hairline dorada + aguja N).
//  · marcadores: jugador (ámbar pulsante + aguja direccional según
//    p.dir + estela de 2 posiciones previas), NPC (blanco),
//    santuario (punto teal con halo + anillo expansivo tenue cada
//    ~2.5 s), cofre sin abrir (dorado) y salidas (flechas)
//  · v4: jefes VIVOS del mapa como diamante rojo pulsante, por la
//    misma vía de objetivos que setMinimapTargets(): el overlay los
//    sintetiza como targets 'rombo' desde g.enemies (maxSta > 0 =
//    barra de quiebre = jefe). MinimapTarget amplía con campos
//    OPCIONALES shape ('diana'|'rombo') y color — sin romper a los
//    llamadores del setter.
//  · RENDIMIENTO: cero canvas nuevos por frame y ~1 fillRect/frame
//    (fondo del mapa); el resto son drawImage de sprites cacheados
//    y fills/strokes de path (rombos, halos, anillos).
// Todo determinista (sin Math.random): las animaciones derivan de
// g.globalT. La estela del jugador es historial posicional (misma
// secuencia de frames → mismo dibujo). El canvas base se cachea
// por (mapa+época+huella de filas).
// ============================================================

import type { Game } from '../engine';
import { COL, fBody } from '../ui';
import { hash2 } from './palette';

// Constantes locales del motor (engine.ts: TILE/VIEW_W) — se replican
// aquí para no introducir una dependencia de runtime con engine.
const TILE = 16;
const VIEW_W = 960;

/** Px de canvas por tile en el minimapa v2. */
const S = 2;

// ---------------- utilidades de color ----------------

/** Multiplica los canales RGB de un hex (#rrggbb) por f (clamp 0..255). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ---------------- categorías de tile ----------------
// Los bloques del relieve se definen por categoría: tiles de la misma
// categoría se funden en un "bloque" con bisel arriba-izq / abajo-der.

type Cat = 'grass' | 'sand' | 'snow' | 'ice' | 'water' | 'path' | 'floor' | 'wall' | 'building' | 'wood' | 'tree' | 'void';

function catOf(ch: string): Cat {
  switch (ch) {
    case '.':
    case ',':
    case 'm': // niebla muda (suelo transitable) se funde con la hierba
    case 'n': // niebla muda (parche de lunaris): mismo trato de suelo
    case 'c':
      return 'grass';
    case 's': // arena de la Costa de Bruma (expansión)
      return 'sand';
    case 'S': // nieve de las Cumbres Heladas (expansión)
      return 'snow';
    case 'i': // hielo del lago de las cumbres (expansión)
      return 'ice';
    case '~':
      return 'water';
    case '=':
    case 'B': // puente entero (pasado)
    case 'x': // puente roto
      return 'path';
    case ':':
    case '_':
    case 'A': // altar
      return 'floor';
    case '#':
    case 'P': // pilar
    case 'w': // pozo
    case 'g': // lápida
    case 'R': // roca
      return 'wall';
    case 'H':
    case 'r': // tejado
    case 'd': // puerta
      return 'building';
    case 'F': // valla
      return 'wood';
    case 't':
    case 'p':
      return 'tree';
    default:
      return 'void';
  }
}

/**
 * Deduce el mapa por dimensiones (cada mapa tiene un tamaño único:
 * lunaris 52×38, bosque 56×44, cripta 40×34). Sirve para la clave de
 * caché y para elegir la variante de paleta (hierba/árboles del bosque).
 */
function kindFromSize(w: number, h: number): string {
  if (w === 52 && h === 38) return 'lunaris';
  if (w === 56 && h === 44) return 'bosque';
  if (w === 40 && h === 34) return 'cripta';
  return `${w}x${h}`;
}

/** Color base del tile con variación determinista por hash. */
function baseColor(ch: string, tx: number, ty: number, kind: string): string {
  const r = hash2(tx, ty);
  const r2 = hash2(tx * 7 + 3, ty * 11 + 5);
  const forest = kind === 'bosque';
  switch (ch) {
    case '.':
    case ',': {
      const g = forest ? ['#3f6d3a', '#396334', '#457540', '#355e31'] : ['#4f8a46', '#467c3e', '#578f4c', '#427a3a'];
      return g[Math.min(3, Math.floor(r * 4))];
    }
    case 'm':
      return forest ? '#45705c' : '#4f8a68'; // hierba bajo niebla
    case 'c':
      return '#6a4e30'; // cultivo (surco de tierra)
    case 's':
      return '#d8c07a'; // arena (expansión: costa) — antes caía al vacío
    case 'S':
      return '#dfe8f2'; // nieve (expansión: cumbres) — antes caía al vacío
    case 'i':
      return '#a8cfe8'; // hielo (expansión: lago) — antes caía al vacío
    case 'n':
      return '#7ea49a'; // niebla muda: velo salvia — antes caía al vacío
    case '~':
      // ('=' ya se gestionaba: dominante #b89a6a, verificado R6-V8)
      return r > 0.6 ? '#3f72a4' : '#3a6a9a';
    case '=':
      return r > 0.75 ? '#c4a878' : r < 0.2 ? '#a08454' : '#b89a6a';
    case 'B':
      return r > 0.5 ? '#9a7040' : '#8a6438';
    case 'x':
      return '#7a5530';
    case ':':
      return r > 0.7 ? '#646474' : '#6a6a7a';
    case '_':
      return '#8a6a44';
    case 'A':
      return '#8a8a9a';
    case '#':
      return r > 0.6 ? '#4a4a5c' : '#454556';
    case 'P':
      return '#8a8a9a';
    case 'H':
      return '#c9b694';
    case 'r':
      return r > 0.5 ? '#a8503a' : '#94422e';
    case 'd':
      return '#7a5230';
    case 'F':
      return '#8a6a44';
    case 'w':
      return '#5a5a6a';
    case 'g':
      return '#7a7a8a';
    case 'R':
      return r2 > 0.5 ? '#7a7a8a' : '#6e6e7e';
    case 't':
    case 'p':
      return forest ? (r > 0.5 ? '#1f4426' : '#1b3d22') : r > 0.5 ? '#26502c' : '#214526';
    default:
      return r > 0.7 ? '#15121f' : '#0c0a14'; // vacío 'V'
  }
}

// ---------------- caché del canvas base ----------------

const miniCache = new Map<string, HTMLCanvasElement>();

/**
 * Construye (o recupera de caché) el minimapa v2: 2 px por tile.
 *
 * @param mapRows   filas crudas del mapa: solo alimentan la huella de la
 *                  clave de caché (desambigua mapas con iguales dimensiones,
 *                  p. ej. aldea/arena, ambas 44×34); la lectura real va por
 *                  tileAtFn para que la época aplique sus diffs
 * @param m         dimensiones del mapa en tiles
 * @param epoch     época del mundo ('presente' | 'pasado')
 * @param tileAtFn  función de lectura de tile (tx,ty) → char, con diffs de época
 */
export function buildMinimapV2(
  mapRows: string[],
  m: { w: number; h: number },
  epoch: 'presente' | 'pasado',
  tileAtFn: (tx: number, ty: number) => string,
): HTMLCanvasElement {
  const kind = kindFromSize(m.w, m.h);
  // Clave de caché v4: dimensiones + época + huella barata de las filas
  // (primera/media/última). La huella corrige la colisión aldea/arena
  // (AMBAS 44×34): sin ella el modo desafío heredaría el minimapa
  // cacheado de la aldea y sus tiles jamás se pintarían.
  const key = `${kind}|${epoch}|${mapRows.length}|${mapRows[0] ?? ''}|${mapRows[mapRows.length >> 1] ?? ''}|${mapRows[mapRows.length - 1] ?? ''}`;
  const hit = miniCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = m.w * S;
  c.height = m.h * S;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;

  // Lectura segura con borde: fuera del mapa devuelve null para no
  // pintar relieve/costa falsos en los bordes del lienzo.
  const at = (tx: number, ty: number): string | null => {
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return null;
    return tileAtFn(tx, ty);
  };

  // ---- pase 1: color base por tile ----
  for (let ty = 0; ty < m.h; ty++) {
    for (let tx = 0; tx < m.w; tx++) {
      const ch = tileAtFn(tx, ty);
      x.fillStyle = baseColor(ch, tx, ty, kind);
      x.fillRect(tx * S, ty * S, S, S);
      if (ch === 'm') { // niebla muda: velo verdoso sobre la hierba
        x.fillStyle = 'rgba(126,164,154,0.45)';
        x.fillRect(tx * S, ty * S, S, S);
      } else if (ch === 'c') { // cultivo: hileras verdes
        x.fillStyle = '#4f8a46';
        x.fillRect(tx * S, ty * S + (hash2(tx, ty * 3) > 0.5 ? 0 : 1), S, 1);
      }
    }
  }

  // ---- pase 2: relieve falso por bloques de la misma categoría ----
  // Borde claro arriba-izquierda y oscuro abajo-derecha donde la
  // categoría cambia: los edificios/bosques/plazas ganan volumen.
  for (let ty = 0; ty < m.h; ty++) {
    for (let tx = 0; tx < m.w; tx++) {
      const ch = tileAtFn(tx, ty);
      const cat = catOf(ch);
      if (cat === 'water' || cat === 'void') continue; // el agua usa costa propia
      const col = baseColor(ch, tx, ty, kind);
      const X = tx * S, Y = ty * S;
      const up = at(tx, ty - 1), lf = at(tx - 1, ty);
      const dn = at(tx, ty + 1), rt = at(tx + 1, ty);
      if (up && catOf(up) !== cat) { x.fillStyle = shade(col, 1.22); x.fillRect(X, Y, S, 1); }
      if (lf && catOf(lf) !== cat) { x.fillStyle = shade(col, 1.12); x.fillRect(X, Y, 1, S); }
      if (dn && catOf(dn) !== cat) { x.fillStyle = shade(col, 0.72); x.fillRect(X, Y + S - 1, S, 1); }
      if (rt && catOf(rt) !== cat) { x.fillStyle = shade(col, 0.82); x.fillRect(X + S - 1, Y, 1, S); }
    }
  }

  // ---- pase 3: contorno costero del agua ----
  // Línea profunda en el borde del agua que toca tierra y línea de
  // arena en la hierba contigua: las orillas se leen de inmediato.
  for (let ty = 0; ty < m.h; ty++) {
    for (let tx = 0; tx < m.w; tx++) {
      if (catOf(tileAtFn(tx, ty)) !== 'water') continue;
      const X = tx * S, Y = ty * S;
      const sides: [number, number, number, number, number, number][] = [
        // [ntx, nty, x, y, w, h] del borde del tile de agua
        [tx, ty - 1, X, Y, S, 1],
        [tx, ty + 1, X, Y + S - 1, S, 1],
        [tx - 1, ty, X, Y, 1, S],
        [tx + 1, ty, X + S - 1, Y, 1, S],
      ];
      for (const [nx, ny, ex, ey, ew, eh] of sides) {
        const n = at(nx, ny);
        if (!n || catOf(n) === 'water') continue;
        x.fillStyle = '#2c5580'; // agua profunda: contorno
        x.fillRect(ex, ey, ew, eh);
        if (catOf(n) === 'grass') { // arena en la orilla de hierba
          x.fillStyle = '#b09c6c';
          if (nx < tx) x.fillRect(nx * S + S - 1, ny * S, 1, S);
          else if (nx > tx) x.fillRect(nx * S, ny * S, 1, S);
          else if (ny < ty) x.fillRect(nx * S, ny * S + S - 1, S, 1);
          else x.fillRect(nx * S, ny * S, S, 1);
        }
      }
    }
  }

  // ---- pase 4: tinte cálido del pasado ----
  if (epoch === 'pasado') {
    x.fillStyle = 'rgba(255,188,110,0.10)';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(140,80,30,0.07)';
    x.fillRect(0, 0, c.width, c.height);
  }

  miniCache.set(key, c);
  return c;
}

// ---------------- overlay (marco + marcadores) ----------------

// ---------------- objetivos y estado del overlay (R4-A9) ----------------

/**
 * Objetivo destacable en el minimapa. x/y en TILES del mapa (los mismos
 * que usa maps.ts); el centro del marcador cae en el centro del tile.
 *
 * v4 (R6-V8): campos OPCIONALES añadidos sin romper llamadores —
 *  · shape: 'diana' (marcador clásico circular, predeterminado según
 *    kind) o 'rombo' (diamante pulsante, la forma de los jefes vivos);
 *  · color: color base del marcador; sin él, cada forma usa su color
 *    por defecto (rombo → rojo #ff5040).
 */
export type MinimapTarget = {
  x: number; y: number;
  kind: 'quest' | 'altar' | 'salida';
  shape?: 'diana' | 'rombo';
  color?: string;
};

/** Variante interna de dibujo (v4): añade el kind 'jefe' que el overlay
 *  sintetiza desde g.enemies para recorrer la MISMA vía de marcadores que
 *  los objetivos registrados. NO forma parte del contrato público: los
 *  llamadores del setter siguen usando quest/altar/salida. */
type MinimapTargetDraw = MinimapTarget & { kind: 'quest' | 'altar' | 'salida' | 'jefe' };

/** Objetivos actuales; vacío hasta que render.ts llame a setMinimapTargets(). */
let minimapTargets: MinimapTarget[] = [];

/**
 * Registra los objetivos a destacar (llamado por render.ts cada vez que
 * cambian questIdx/questStep, calculado con QUESTS + coords de maps.ts).
 * Mientras no se llame, la lista queda vacía y el overlay es no-op con
 * respecto a los objetivos (todo lo demás de la v2 se dibuja igual).
 * Entradas con coordenadas no finitas se descartan por robustez.
 * v4: cada entrada puede llevar shape ('diana'|'rombo') y color
 * opcionales — los 'rombo' se dibujan como diamantes pulsantes (la vía
 * de los jefes vivos) con el color pedido.
 */
export function setMinimapTargets(list: MinimapTarget[]): void {
  minimapTargets = Array.isArray(list)
    ? list.filter((tg) => !!tg && Number.isFinite(tg.x) && Number.isFinite(tg.y))
    : [];
}

// estela del jugador: historial posicional por mapa (px de mundo). Se
// muestrea al FINAL del bloque para que lo dibujado en un frame sea
// siempre estrictamente anterior a la posición actual del jugador.
const TRAIL_STEP_PX = 24; // 1.5 tiles entre muestras: cola legible sin ruido
const TRAIL_MAX = 2;      // 2 posiciones previas tenues
const trailHist: { x: number; y: number }[] = [];
let trailMapId: string | undefined;

/** Periodo del anillo expansivo del santuario (s). */
const RING_PERIOD = 2.5;

/** Teal del santuario (v4): punto, halo y anillo expansivo, misma familia. */
const TEAL = '#2dd4bf';

/** Triángulo/flecha pixel determinista (con contorno oscuro). */
function arrowTri(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  dx: number, dy: number, r: number, color: string,
): void {
  const pxp = -dy, pyp = dx; // perpendicular
  const tri = (rr: number) => {
    ctx.beginPath();
    ctx.moveTo(x + dx * rr, y + dy * rr);
    ctx.lineTo(x - dx * rr * 0.55 + pxp * rr * 0.85, y - dy * rr * 0.55 + pyp * rr * 0.85);
    ctx.lineTo(x - dx * rr * 0.55 - pxp * rr * 0.85, y - dy * rr * 0.55 - pyp * rr * 0.85);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#201406';
  tri(r + 1);
  ctx.fillStyle = color;
  tri(r);
}

/** Rombo pixel relleno centrado en (cx,cy) — helper común de marcadores. */
function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
}

/**
 * Aguja Norte de 4 px para la placa: punta arriba, base de cabeza y
 * mástil de 2 px. Coordenadas enteras (pixel-art limpio sobre la placa).
 */
function northNeedle(ctx: CanvasRenderingContext2D, x: number, yBase: number): void {
  ctx.fillStyle = COL.gold;
  ctx.fillRect(x, yBase - 2, 1, 1);   // punta
  ctx.fillRect(x - 1, yBase - 1, 3, 1); // base de la cabeza
  ctx.fillRect(x, yBase, 1, 2);       // mástil
}

/** Remache BRONCE 3×3 con asiento sombreado (esquinas del marco v4). */
function rivet(ctx: CanvasRenderingContext2D, rx: number, ry: number): void {
  ctx.fillStyle = '#33240e'; ctx.fillRect(rx - 1, ry - 1, 4, 4);
  ctx.fillStyle = '#a8843c'; ctx.fillRect(rx, ry, 3, 3);
  ctx.fillStyle = '#e8cc7a'; ctx.fillRect(rx, ry, 1, 1);
  ctx.fillStyle = '#6a4e1e'; ctx.fillRect(rx + 2, ry + 2, 1, 1);
}

// ---------------- cachés del marco y sprites (v4) ----------------

/**
 * Marco pergamino/bronce + placa, pre-renderizados UNA vez por
 * (tamaño+época+nombre del mapa) y cacheados: por frame la overlay los
 * estampa con UN drawImage. La ventana del mapa queda TRANSPARENTE para
 * estampar el marco DESPUÉS del contenido (los marcadores ya dibujados
 * quedan enmarcados por el chaflán sin ser tapados). Sin canvas nuevos
 * por frame: solo en fallo de caché (cambio de mapa/época).
 */
const chromeCache = new Map<string, HTMLCanvasElement>();

/** Chaflán de esquina (v4): triángulo bronce oscuro + luz interior biselada. */
function cornerCut(x: CanvasRenderingContext2D, cx: number, cy: number, sx: number, sy: number): void {
  x.fillStyle = '#3a2a10'; // corte oscuro (sombra del chaflán)
  x.beginPath();
  x.moveTo(cx, cy);
  x.lineTo(cx + sx * 6, cy);
  x.lineTo(cx, cy + sy * 6);
  x.closePath();
  x.fill();
  x.fillStyle = '#b08c3e'; // hilo bronce interior del bisel
  x.beginPath();
  x.moveTo(cx + sx, cy + sy);
  x.lineTo(cx + sx * 5, cy + sy);
  x.lineTo(cx + sx, cy + sy * 5);
  x.closePath();
  x.fill();
}

/**
 * Pinta el marco pergamino/bronce + placa en coords locales (0,0 = esquina
 * del marco). La placa v3 queda INTACTA (fondos, hairline dorada, aguja N,
 * 'N', título e insignia de época): el restyling solo toca banda y esquinas.
 */
function buildChrome(dw: number, dh: number, past: boolean, name: string): HTMLCanvasElement {
  const plateH = 15;
  const fw = dw + 4, fh = plateH + dh + 4;
  const c = document.createElement('canvas');
  c.width = fw; c.height = fh;
  const x = c.getContext('2d')!;

  // ---- banda bronce con hilo de pergamino (bisel claro arriba-izq) ----
  x.fillStyle = '#6e5224'; // bronce base
  x.fillRect(0, 0, fw, fh);
  x.fillStyle = '#c9a44c'; // bronce luz (borde 2px arriba/izq)
  x.fillRect(0, 0, fw, 2); x.fillRect(0, 0, 2, fh);
  x.fillStyle = '#4a3414'; // bronce oscuro (borde 2px abajo/der)
  x.fillRect(0, fh - 2, fw, 2); x.fillRect(fw - 2, 0, 2, fh);
  x.fillStyle = '#e2cea0'; // hilo pergamino iluminado
  x.fillRect(2, 2, fw - 4, 1); x.fillRect(2, 2, 1, fh - 4);
  x.fillStyle = '#6a4e1e'; // hilo pergamino sombreado
  x.fillRect(2, fh - 3, fw - 4, 1); x.fillRect(fw - 3, 2, 1, fh - 4);
  x.fillStyle = '#141018'; // lecho oscuro tras placa y mapa
  x.fillRect(3, 3, fw - 6, fh - 6);

  // ---- placa integrada v3 INTACTA: fondo con sombra interna, hairline
  //      dorada, aguja N (4 px) a la izquierda y título con sombra ----
  const plateRows = plateH - 2; // 13 filas de placa; la hairline cierra abajo
  const plateCy = 3 + Math.round((plateRows - 1) / 2) + 1; // centro óptico
  x.fillStyle = past ? '#2c2010' : '#1c1826';
  x.fillRect(2, 3, dw, plateRows);
  x.fillStyle = past ? '#241a0e' : '#131020'; // sombra interna inferior
  x.fillRect(2, 2 + plateRows, dw, 1);
  x.fillStyle = past ? '#a87c46' : '#8a6c40'; // hairline dorada (une placa y mapa)
  x.fillRect(2, plateH + 1, dw, 1);
  northNeedle(x, 2 + 6, plateCy);
  x.font = fBody(11);
  x.textAlign = 'left';
  x.textBaseline = 'middle';
  x.fillStyle = '#c9b992';
  x.fillText('N', 2 + 9, plateCy + 0.5);
  x.font = fBody(14);
  x.textAlign = 'center';
  x.fillStyle = '#0e0c16'; // sombra del título
  x.fillText(name, fw / 2, plateCy + 1);
  x.fillStyle = COL.goldSoft;
  x.fillText(name, fw / 2, plateCy);
  if (past) { // insignia de época: rombo cálido a la derecha
    const ex2 = fw - 11, ey2 = plateCy;
    x.fillStyle = COL.epochPast;
    x.fillRect(ex2, ey2 - 1, 3, 3);
    x.fillRect(ex2 + 1, ey2 - 2, 1, 5);
    x.fillRect(ex2 - 1, ey2 - 1, 5, 1);
  }

  // ventana del mapa transparente: el contenido se dibuja antes en el
  // canvas principal y el marco se estampa encima sin taparlo
  x.clearRect(2, plateH + 2, dw, dh);

  // esquinas biseladas (chaflán bronce) sobre banda/placa/mapa + remaches
  // superiores (los inferiores quedaban tapados por el mapa en v3: omitidos)
  cornerCut(x, 0, 0, 1, 1);
  cornerCut(x, fw, 0, -1, 1);
  cornerCut(x, 0, fh, 1, -1);
  cornerCut(x, fw, fh, -1, -1);
  rivet(x, 5, 5);
  rivet(x, fw - 8, 5);
  return c;
}

/**
 * Sprites de marcador (v4): los puntos que en v3 eran cadenas de fillRect
 * (estela, cofres, NPCs, jugador) pre-renderizados UNA vez con el MISMO
 * patrón píxel a píxel. Por frame son drawImages: la overlay queda con
 * ~1 fillRect (el fondo del mapa) sin cambiar ni un píxel de v3.
 */
interface MarkerSprites {
  trail: HTMLCanvasElement;  // cruz dorada 3×3 (estela del jugador)
  chest: HTMLCanvasElement;  // cofre 4×4 (asiento + oro + brillo)
  npc: HTMLCanvasElement;    // NPC 4×4 (asiento + blanco)
  player: HTMLCanvasElement; // jugador 5×5 (asiento + oro + brillo)
}
let markerSprites: MarkerSprites | null = null;

function getMarkerSprites(): MarkerSprites {
  if (markerSprites) return markerSprites;
  const mk = (w: number, h: number, paint: (x: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d')!);
    return c;
  };
  markerSprites = {
    trail: mk(3, 3, (x) => {
      x.fillStyle = COL.gold;
      x.fillRect(0, 1, 3, 1); x.fillRect(1, 0, 1, 1); x.fillRect(1, 2, 1, 1);
    }),
    chest: mk(4, 4, (x) => {
      x.fillStyle = '#1a1206'; x.fillRect(0, 0, 4, 4);
      x.fillStyle = COL.gold; x.fillRect(1, 1, 2, 2);
      x.fillStyle = '#ffe9a0'; x.fillRect(1, 1, 1, 1);
    }),
    npc: mk(4, 4, (x) => {
      x.fillStyle = '#1a1a22'; x.fillRect(0, 0, 4, 4);
      x.fillStyle = '#f4f4f0'; x.fillRect(1, 1, 2, 2);
    }),
    player: mk(5, 5, (x) => {
      x.fillStyle = '#241503'; x.fillRect(0, 0, 5, 5);
      x.fillStyle = COL.gold; x.fillRect(1, 1, 3, 3);
      x.fillStyle = '#ffe9a0'; x.fillRect(1, 1, 1, 1);
    }),
  };
  return markerSprites;
}

/**
 * Dibuja el minimapa v4 en pantalla (arriba-derecha): mapa cacheado con
 * marcadores recortados al interior y, estampado encima con UN drawImage,
 * el marco pergamino/bronce de esquinas biseladas (pre-renderizado y
 * cacheado; placa v3 intacta con su aguja N). Marcadores: los de siempre
 * + jefes vivos como diamante rojo pulsante (targets 'rombo' sintetizados
 * por la misma vía de setMinimapTargets) y objetivos de misión registrados.
 * Presupuesto por frame: ~1 fillRect (fondo del mapa) y cero canvas nuevos.
 */
export function drawMinimapOverlay(
  ctx: CanvasRenderingContext2D, mini: HTMLCanvasElement, g: Game,
): void {
  const map = g.map;
  if (!map || !mini) return;
  const t = g.globalT;
  const past = g.epoch === 'pasado';

  // ---- geometría: escala entera si cae en 176..200 px; si no, ~184 px ----
  let s = 0;
  for (const k of [3, 2, 1]) {
    const w = mini.width * k;
    if (w >= 176 && w <= 200) { s = k; break; }
  }
  if (!s) s = 184 / mini.width;
  const dw = Math.round(mini.width * s);
  const dh = Math.round(mini.height * s);
  const plateH = 15;
  const fw = dw + 4, fh = plateH + dh + 4;
  const fx = VIEW_W - fw - 12, fy = 12;
  const mapX = fx + 2, mapY = fy + 2 + plateH;

  // ---- marco pergamino/bronce v4: pre-renderizado y cacheado por
  //      (tamaño+época+mapa) → por frame es UN drawImage; la placa v3
  //      (hairline dorada + aguja N + título) vive dentro del caché ----
  const chromeKey = `${fw}x${fh}|${past ? 'P' : 'A'}|${map.name}`;
  let chrome = chromeCache.get(chromeKey);
  if (!chrome) {
    chrome = buildChrome(dw, dh, past, map.name);
    chromeCache.set(chromeKey, chrome);
  }

  // ---- mapa + marcadores recortados al interior; el marco se estampa AL
  //      FINAL con su ventana transparente: el chaflán biselado enmarca el
  //      contenido sin taparlo ----
  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, dw, dh);
  ctx.clip();
  ctx.fillStyle = '#0c0a14';
  ctx.fillRect(mapX, mapY, dw, dh); // único fillRect del frame
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mini, mapX, mapY, dw, dh);

  // proyección mundo(px) → minimapa(px de pantalla)
  const wx = (xpx: number) => mapX + (xpx / (map.w * TILE)) * dw;
  const wy = (ypx: number) => mapY + (ypx / (map.h * TILE)) * dh;

  // ---- estela del jugador (R4-A9): 2 posiciones previas tenues ----
  // Se dibuja el historial ANTES de muestrear: lo pintado en un frame es
  // siempre estrictamente anterior a la posición actual. El historial se
  // resetea al cambiar de mapa (las coordenadas de otro mapa no aplican).
  const pt = g.player;
  if (pt) {
    if (trailMapId !== g.mapId) { trailHist.length = 0; trailMapId = g.mapId; }
    for (let i = 0; i < trailHist.length; i++) {
      const ax = Math.round(wx(trailHist[i].x)), ay = Math.round(wy(trailHist[i].y));
      ctx.globalAlpha = i === 0 ? 0.16 : 0.34; // antigua → reciente
      ctx.fillStyle = COL.gold;
      ctx.fillRect(ax - 1, ay, 3, 1);
      ctx.fillRect(ax, ay - 1, 1, 1);
      ctx.fillRect(ax, ay + 1, 1, 1);
    }
    ctx.globalAlpha = 1;
    const last = trailHist[trailHist.length - 1];
    if (!last || (pt.x - last.x) * (pt.x - last.x) + (pt.y - last.y) * (pt.y - last.y) >= TRAIL_STEP_PX * TRAIL_STEP_PX) {
      trailHist.push({ x: pt.x, y: pt.y });
      if (trailHist.length > TRAIL_MAX) trailHist.shift();
    }
  }

  // salidas: flecha tenue apuntando al borde correspondiente
  for (const ex of map.exits) {
    if (ex.needPast && !past) continue;
    const cx = wx((ex.x + ex.w / 2) * TILE);
    const cy = wy((ex.y + ex.h / 2) * TILE);
    let dx = 0, dy = 0;
    if (ex.y <= 1) dy = -1;
    else if (ex.y + ex.h >= map.h - 1) dy = 1;
    else if (ex.x <= 1) dx = -1;
    else if (ex.x + ex.w >= map.w - 1) dx = 1;
    else dy = ex.y < map.h / 2 ? -1 : 1;
    ctx.globalAlpha = 0.42 + 0.14 * Math.sin(t * 1.7 + ex.x);
    arrowTri(ctx, cx, cy, dx, dy, 3, '#cfd8e8');
    ctx.globalAlpha = 1;
  }

  // cofres sin abrir (respetando época): punto dorado
  for (const ch of map.chests) {
    if (ch.needPast && !past) continue;
    if (g.openedChests.has(ch.id)) continue;
    const cx = Math.round(wx(ch.x * TILE + 8)), cy = Math.round(wy(ch.y * TILE + 8));
    ctx.fillStyle = '#1a1206'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.fillStyle = COL.gold; ctx.fillRect(cx - 1, cy - 1, 2, 2);
    ctx.fillStyle = '#ffe9a0'; ctx.fillRect(cx - 1, cy - 1, 1, 1);
  }

  // NPCs visibles: punto blanco
  for (const n of g.npcs) {
    const cx = Math.round(wx(n.x)), cy = Math.round(wy(n.y));
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.fillStyle = '#f4f4f0'; ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  // ---- pulso del santuario (R4-A9): anillo expansivo tenue cada ~2.5 s ----
  // Emisores: g.sanctuaryPos(mapId) (público en engine) y, como respaldo,
  // los objetivos kind 'altar' de setMinimapTargets (deduplicados por tile
  // contra el santuario del motor para no duplicar anillos).
  let sancKey: string | null = null;
  const ringPts: [number, number][] = [];
  try {
    if (typeof g.sanctuaryPos === 'function' && g.mapId) {
      const sp = g.sanctuaryPos(g.mapId);
      if (sp && Number.isFinite(sp[0]) && Number.isFinite(sp[1])) {
        sancKey = `${Math.round(sp[0])},${Math.round(sp[1])}`;
        ringPts.push([sp[0], sp[1]]);
      }
    }
  } catch { /* motor no disponible (juegos falsos): sin emisores propios */ }
  for (const tg of minimapTargets) {
    if (tg.kind !== 'altar') continue;
    const key = `${Math.round(tg.x)},${Math.round(tg.y)}`;
    if (key === sancKey || ringPts.some(([rx, ry]) => Math.round(rx) === Math.round(tg.x) && Math.round(ry) === Math.round(tg.y))) continue;
    ringPts.push([tg.x, tg.y]);
  }
  if (ringPts.length) {
    const ph = (t % RING_PERIOD) / RING_PERIOD; // 0..1 dentro del ciclo
    const rr = 2.5 + ph * 11;
    ctx.strokeStyle = '#8ef0ff';
    ctx.lineWidth = 1;
    for (const [rtx, rty] of ringPts) {
      const cx = wx(rtx * TILE + 8), cy = wy(rty * TILE + 8);
      ctx.globalAlpha = 0.36 * (1 - ph); // tenue y desvaneciendo hasta cerrar el ciclo
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // santuarios: rombo cian con pulso (filtrando needPast/needPresent)
  for (const pr of map.props) {
    if (pr.kind !== 'sanctuary') continue;
    if (pr.needPast && !past) continue;
    if (pr.needPresent && past) continue;
    const cx = wx(pr.x * TILE + 8), cy = wy(pr.y * TILE + 8);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + pr.x);
    ctx.globalAlpha = 0.3 + pulse * 0.25;
    ctx.strokeStyle = '#8ef0ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 6 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    diamond(ctx, cx, cy, 4, '#0c2a30'); // contorno
    diamond(ctx, cx, cy, 3, '#8ef0ff');
  }

  // jefe vivo (Guardián): punto rojo parpadeante
  for (const e of g.enemies) {
    if (e.dead || e.etype !== 'guardian') continue;
    const cx = Math.round(wx(e.x)), cy = Math.round(wy(e.y));
    if ((t % 0.9) < 0.55) {
      ctx.fillStyle = '#2a0808'; ctx.fillRect(cx - 3, cy - 3, 6, 6);
      ctx.fillStyle = '#ff5040'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
      ctx.fillStyle = '#ffb0a0'; ctx.fillRect(cx - 2, cy - 2, 1, 1);
    } else { // fase apagada: brasa tenue para no perder la posición
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ff5040'; ctx.fillRect(cx - 1, cy - 1, 2, 2);
      ctx.globalAlpha = 1;
    }
  }

  // ---- objetivos registrados vía setMinimapTargets (R4-A9/A9b) ----
  // Diana de misión: rombo dorado con halo que late con sin(t*3) en el
  // tile del objetivo — para kind 'quest' y también 'salida' (esta última
  // con vivienda pálida que la hermana con las flechas de exit). Los
  // altares ya reciben su anillo expansivo (bloque del santuario) y una
  // marca dorada discreta si no coinciden con el santuario del motor.
  for (const tg of minimapTargets) {
    if (tg.kind !== 'quest') continue;
    const cx = wx(tg.x * TILE + 8), cy = wy(tg.y * TILE + 8);
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.globalAlpha = 0.2 + 0.32 * pulse;
    ctx.strokeStyle = COL.gold;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.6 + pulse * 2.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    diamond(ctx, cx, cy, 4.4, '#241503'); // contorno
    diamond(ctx, cx, cy, 3.4, COL.gold);  // diana dorada
    diamond(ctx, cx, cy, 1.5, '#fff3d0'); // corazón claro
  }
  for (const tg of minimapTargets) {
    if (tg.kind === 'quest') continue;
    const cx = Math.round(wx(tg.x * TILE + 8)), cy = Math.round(wy(tg.y * TILE + 8));
    if (tg.kind === 'altar') {
      if (sancKey && `${Math.round(tg.x)},${Math.round(tg.y)}` === sancKey) continue; // ya marcado por el motor
      diamond(ctx, cx, cy, 2.6, '#241503');
      diamond(ctx, cx, cy, 1.8, COL.gold);
    } else { // 'salida': diana dorada pulsante (sin(t*3)) — misma familia
      // que la de misión — con vivienda pálida acorde a las flechas de exit
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.globalAlpha = 0.18 + 0.3 * pulse;
      ctx.strokeStyle = COL.gold;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 4 + pulse * 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      diamond(ctx, cx, cy, 4, '#241a0e');                // contorno del marco
      diamond(ctx, cx, cy, 3, '#cfd8e8');                // vivienda pálida (exit)
      diamond(ctx, cx, cy, 2.2, '#241503');              // asiento del núcleo
      diamond(ctx, cx, cy, 1.5 + pulse * 0.7, COL.gold); // núcleo dorado que late
    }
  }

  // jugador: punto ámbar pulsante + aguja direccional según p.dir (GPS)
  const p = g.player;
  if (p) {
    const cx = Math.round(wx(p.x)), cy = Math.round(wy(p.y));
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.globalAlpha = 0.22 + pulse * 0.3;
    ctx.strokeStyle = COL.gold;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#241503'; ctx.fillRect(cx - 2, cy - 2, 5, 5);
    ctx.fillStyle = COL.gold; ctx.fillRect(cx - 1, cy - 1, 3, 3);
    ctx.fillStyle = '#ffe9a0'; ctx.fillRect(cx - 1, cy - 1, 1, 1);
    // aguja direccional anclada al punto: el triángulo nace en el núcleo
    // y apunta según p.dir, con un vaivén mínimo de vida
    const dirs: Record<string, [number, number]> = {
      down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0],
    };
    const [dx, dy] = dirs[p.dir] ?? [0, 1];
    const bob = Math.sin(t * 4) * 0.4;
    arrowTri(ctx, cx + dx * (2.4 + bob), cy + dy * (2.4 + bob), dx, dy, 3.4, '#ffe9a0');
  }

  ctx.restore();
}
