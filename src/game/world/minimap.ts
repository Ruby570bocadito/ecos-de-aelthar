// ============================================================
// ECOS DE AELTHAR — Minimapa v2 (módulo world)
// Sustituto mejorado del minimapa plano de buildGround():
//  · 2 px por tile con paleta coherente con los módulos world
//  · variación de hierba por hash, relieve falso por bloques
//    de tiles del mismo tipo, contorno costero del agua
//  · tinte cálido suave en la época 'pasado'
//  · overlay con marco de madera remachado, placa de título y
//    marcadores: jugador (ámbar pulsante + flecha), NPC (blanco),
//    santuario (rombo cian), cofre sin abrir (dorado),
//    jefe vivo (rojo parpadeante) y salidas (flechas tenues)
// Todo determinista (sin Math.random): las animaciones derivan
// de g.globalT. El canvas base se cachea por (mapa+época).
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

type Cat = 'grass' | 'water' | 'path' | 'floor' | 'wall' | 'building' | 'wood' | 'tree' | 'void';

function catOf(ch: string): Cat {
  switch (ch) {
    case '.':
    case ',':
    case 'm': // niebla muda (suelo transitable) se funde con la hierba
    case 'c':
      return 'grass';
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
    case '~':
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
 * @param mapRows   filas del mapa (respaldo; la lectura real va por tileAtFn
 *                  para que la época aplique sus diffs)
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
  void mapRows; // la lectura de tiles se delega en tileAtFn (aplica epochDiffs)
  const kind = kindFromSize(m.w, m.h);
  const key = `${kind}|${epoch}`;
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

/** Remache metálico 3×3 con asiento sombreado (esquinas del marco). */
function rivet(ctx: CanvasRenderingContext2D, rx: number, ry: number): void {
  ctx.fillStyle = '#2a2a33'; ctx.fillRect(rx - 1, ry - 1, 4, 4);
  ctx.fillStyle = '#8a8f9a'; ctx.fillRect(rx, ry, 3, 3);
  ctx.fillStyle = '#c8ccd6'; ctx.fillRect(rx, ry, 1, 1);
  ctx.fillStyle = '#5a5f6a'; ctx.fillRect(rx + 2, ry + 2, 1, 1);
}

/**
 * Dibuja el minimapa v2 en pantalla (arriba-derecha): marco de madera
 * con esquinas remachadas, placa con el título del mapa y marcadores.
 * El contenido se recorta con clipping al área interior del marco.
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

  // ---- marco de madera con bisel y remaches ----
  ctx.fillStyle = '#4a3620'; // lecho madera
  ctx.fillRect(fx, fy, fw, fh);
  ctx.fillStyle = past ? '#8a6238' : '#7a5c3a'; // borde 2px claro (arriba/izq)
  ctx.fillRect(fx, fy, fw, 2); ctx.fillRect(fx, fy, 2, fh);
  ctx.fillStyle = '#332415'; // borde 2px oscuro (abajo/der)
  ctx.fillRect(fx, fy + fh - 2, fw, 2); ctx.fillRect(fx + fw - 2, fy, 2, fh);
  ctx.fillStyle = '#9a7850'; // bisel interior iluminado
  ctx.fillRect(fx + 2, fy + 2, fw - 4, 1); ctx.fillRect(fx + 2, fy + 2, 1, fh - 4);
  ctx.fillStyle = '#241a0e'; // bisel interior sombreado
  ctx.fillRect(fx + 2, fy + fh - 3, fw - 4, 1); ctx.fillRect(fx + fw - 3, fy + 2, 1, fh - 4);
  ctx.fillStyle = '#141018'; // lecho oscuro tras placa y mapa
  ctx.fillRect(fx + 3, fy + 3, fw - 6, fh - 6);
  rivet(ctx, fx + 3, fy + 3);
  rivet(ctx, fx + fw - 6, fy + 3);
  rivet(ctx, fx + 3, fy + fh - 6);
  rivet(ctx, fx + fw - 6, fy + fh - 6);

  // ---- placa del título ----
  ctx.fillStyle = past ? '#2c2010' : '#1c1826';
  ctx.fillRect(mapX, fy + 3, dw, plateH - 1);
  ctx.fillStyle = past ? '#8a6238' : '#6a4e30'; // filete de la placa
  ctx.fillRect(mapX, fy + 3, dw, 1);
  ctx.fillRect(mapX, fy + plateH + 1, dw, 1);
  ctx.font = fBody(14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COL.goldSoft;
  ctx.fillText(map.name, fx + fw / 2, fy + 3 + (plateH - 1) / 2 + 1);
  if (past) { // insignia de época: rombo cálido a la derecha
    const ex2 = fx + fw - 11, ey2 = fy + 3 + (plateH - 1) / 2 + 1;
    ctx.fillStyle = COL.epochPast;
    ctx.fillRect(ex2, ey2 - 1, 3, 3);
    ctx.fillRect(ex2 + 1, ey2 - 2, 1, 5);
    ctx.fillRect(ex2 - 1, ey2 - 1, 5, 1);
  }

  // ---- mapa con clipping al área interior del marco ----
  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, dw, dh);
  ctx.clip();
  ctx.fillStyle = '#0c0a14';
  ctx.fillRect(mapX, mapY, dw, dh);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mini, mapX, mapY, dw, dh);

  // proyección mundo(px) → minimapa(px de pantalla)
  const wx = (xpx: number) => mapX + (xpx / (map.w * TILE)) * dw;
  const wy = (ypx: number) => mapY + (ypx / (map.h * TILE)) * dh;

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

  // santuarios: rombo cian con pulso (filtrando needPast/needPresent)
  for (const pr of map.props) {
    if (pr.kind !== 'sanctuary') continue;
    if (pr.needPast && !past) continue;
    if (pr.needPresent && past) continue;
    const cx = wx(pr.x * TILE + 8), cy = wy(pr.y * TILE + 8);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + pr.x);
    const dia = (r: number, col: string) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    };
    ctx.globalAlpha = 0.3 + pulse * 0.25;
    ctx.strokeStyle = '#8ef0ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 6 + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    dia(4, '#0c2a30'); // contorno
    dia(3, '#8ef0ff');
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

  // jugador: punto ámbar pulsante + flecha de dirección
  const p = g.player;
  if (p) {
    const cx = wx(p.x), cy = wy(p.y);
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
    // flecha de dirección con vaivén suave
    const dirs: Record<string, [number, number]> = {
      down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0],
    };
    const [dx, dy] = dirs[p.dir] ?? [0, 1];
    const bob = Math.sin(t * 4) * 0.8;
    arrowTri(ctx, cx + dx * (5.5 + bob), cy + dy * (5.5 + bob), dx, dy, 2.6, '#ffe9a0');
  }

  ctx.restore();
}
