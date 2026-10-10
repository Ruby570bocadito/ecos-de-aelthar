// ============================================================
// R17 · «LO QUE SIEMBRAS AYER» — causa en el pasado, efecto en el presente
// Hasta ahora cambiar de época con Q casi nunca cambiaba NADA jugable fuera
// de 3-4 puntos de la historia (puente, faroles, muelle). Este módulo da a
// cada mapa exterior razones para viajar en el tiempo:
//
//  1) SEMILLAS DEL ECO — 12 parcelas (lunaris 3 · bosque 3 · costa 2 ·
//     aldea 2 · cumbres 2) elegidas de forma DETERMINISTA: transitables en
//     ambas épocas, alcanzables desde el santuario, lejos de salidas,
//     objetos, cofres, ecos, NPCs y de otras parcelas.
//       · PASADO: tierra fértil con una semilla que late → [E] plantar.
//       · PRESENTE sin plantar: tierra muerta con un brote seco (pista).
//       · PRESENTE plantada: ha crecido un ÁRBOL DEL ECO con fruto →
//         [E] recoger: cura total, +1 poción, +25 coronas y, cada 4 frutos,
//         +1 punto de atributo. Al volver al presente el mundo lo anuncia.
//     Flags persistentes semilla_<id> / fruto_<id> (viajan en el save).
//
//  2) LENTE DEL ECO — MANTENER R (con el Eco despierto): una ventana
//     circular alrededor del Portador muestra el SUELO de la otra época
//     (con su color) y los cofres/objetos que solo existen allí como
//     siluetas fantasma. Asomarse sin cruzar: planificar antes de pulsar Q.
// ============================================================

import type { Game } from './engine';
import type { MapDef, MapId } from './types';
import { MAPS, mapRows, tileAt, mapEpochs } from './maps';
import { SOLID_CHARS, TILE, hash2 } from './sprites';
import { audio } from './audio';
import { spawnVfx } from './actors/vfx';
import { VIEW_W, VIEW_H } from './consts';

export interface Parcela { id: string; map: MapId; tx: number; ty: number; idx: number }

const CUOTA: Partial<Record<string, number>> = { lunaris: 3, bosque: 3, costa: 2, aldea: 2, cumbres: 2, molino: 1, hondonada: 1, acantilado: 1, pantano: 1, glaciar: 1 }; // R18: +1 por sección nueva
const SUELOS = new Set(['.', ',', 'S', ':']);
const cache = new Map<string, Parcela[]>();

/** Parcelas del mapa (deterministas; cache por mapa). */
export function parcelasDe(mapId: string): Parcela[] {
  const hit = cache.get(mapId);
  if (hit) return hit;
  const out: Parcela[] = [];
  const m = MAPS[mapId as MapId];
  const n = CUOTA[mapId] ?? 0;
  if (m && n > 0) elegir(m, n, out);
  cache.set(mapId, out);
  return out;
}

function elegir(m: MapDef, n: number, out: Parcela[]): void {
  const rows = mapRows(m);
  const [epA, epB] = mapEpochs(m);
  const libre = (x: number, y: number) =>
    x >= 1 && y >= 1 && x < m.w - 1 && y < m.h - 1
    && !SOLID_CHARS.has(tileAt(m, rows, x, y, epA)) && !SOLID_CHARS.has(tileAt(m, rows, x, y, epB));
  // alcanzable desde el santuario en AMBAS épocas
  const s = m.props.find(p => p.kind === 'sanctuary');
  if (!s) return;
  const alcanza = (ep: typeof epA) => {
    const seen = new Uint8Array(m.w * m.h);
    const q: number[] = [s.x, s.y + 1];
    seen[(s.y + 1) * m.w + s.x] = 1;
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], y = q[i + 1];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen[ny * m.w + nx]) continue;
        if (SOLID_CHARS.has(tileAt(m, rows, nx, ny, ep))) continue;
        seen[ny * m.w + nx] = 1;
        q.push(nx, ny);
      }
    }
    return seen;
  };
  const rA = alcanza(epA), rB = alcanza(epB);
  // puntos ocupados (objetos, cofres, ecos, NPCs, spawns, salidas)
  const ocupados: [number, number, number][] = [];
  for (const p of m.props) ocupados.push([p.x, p.y, 2]);
  for (const c of m.chests) ocupados.push([c.x, c.y, 2]);
  for (const e of m.echoes) ocupados.push([e.x, e.y, 2]);
  for (const c of m.npcs) ocupados.push([c.x, c.y, 3]);
  for (const sp of m.spawns) ocupados.push([sp.x, sp.y, 2]);
  for (const ex of m.exits) ocupados.push([ex.x + (ex.w >> 1), ex.y + (ex.h >> 1), 5]);
  const cands: [number, number, number][] = [];
  const seed = m.id.length * 97 + m.id.charCodeAt(0);
  for (let y = 2; y < m.h - 2; y++) {
    for (let x = 2; x < m.w - 2; x++) {
      if (!SUELOS.has(tileAt(m, rows, x, y, epA)) || !rA[y * m.w + x] || !rB[y * m.w + x]) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) if (!libre(x + dx, y + dy)) ok = false;
      if (!ok) continue;
      // el camino '=' a menos de 1 tile: la parcela no pisa senderos
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) if (tileAt(m, rows, x + dx, y + dy, epA) === '=') ok = false;
      if (!ok) continue;
      for (const [ox, oy, r] of ocupados) if (Math.abs(ox - x) <= r && Math.abs(oy - y) <= r) { ok = false; break; }
      if (!ok) continue;
      cands.push([x, y, hash2(x * 7 + seed, y * 13 + seed)]);
    }
  }
  cands.sort((a, b) => a[2] - b[2]);
  for (const [x, y] of cands) {
    if (out.length >= n) break;
    if (out.some(p => Math.abs(p.tx - x) + Math.abs(p.ty - y) < 12)) continue;
    out.push({ id: `${m.id}_${out.length}`, map: m.id, tx: x, ty: y, idx: out.length });
  }
}

/** Todas las parcelas del juego (smokes / HUD). */
export function todasLasParcelas(): Parcela[] {
  return Object.keys(CUOTA).flatMap(id => parcelasDe(id));
}

/** Semillas plantadas y frutos recogidos en una sola pasada (HUD). */
export function progresoSemillas(g: Game): { sembradas: number; frutos: number } {
  let sembradas = 0, frutos = 0;
  for (const k in g.flags) {
    if (!g.flags[k]) continue;
    if (k.startsWith('semilla_')) sembradas++;
    else if (k.startsWith('fruto_')) frutos++;
  }
  return { sembradas, frutos };
}

export function frutosRecogidos(g: Game): number {
  let n = 0;
  for (const k of Object.keys(g.flags)) if (k.startsWith('fruto_') && g.flags[k]) n++;
  return n;
}

const enPasado = (g: Game) => g.epoch === 'pasado';

// ---------------------------------------------------------------- interacción
type Consider = (x: number, y: number, kind: string, label: string, act: () => void, r?: number) => void;

export function causalInteract(g: Game, consider: Consider): void {
  const ps = parcelasDe(g.mapId);
  if (!ps.length || !g.player) return;
  for (const s of ps) {
    const x = s.tx * TILE + 8, y = s.ty * TILE + 8;
    const plantada = !!g.flags[`semilla_${s.id}`];
    const cogido = !!g.flags[`fruto_${s.id}`];
    if (enPasado(g)) {
      if (!plantada) consider(x, y, 'semilla', 'Plantar una Semilla del Eco', () => plantar(g, s), 26);
    } else if (g.epoch === 'presente') {
      if (plantada && !cogido) consider(x, y, 'fruto', 'Recoger el Fruto del Eco', () => recoger(g, s), 30);
      else if (!plantada) consider(x, y, 'parcela', 'Examinar la tierra muerta', () => pista(g), 24);
    }
  }
}

function plantar(g: Game, s: Parcela): void {
  g.flags[`semilla_${s.id}`] = true;
  const x = s.tx * TILE + 8, y = s.ty * TILE + 8;
  spawnVfx('pillar', x, y);
  g.burst(x, y - 4, '#9ef08a', 18, 60);
  audio.sfx('song');
  g.floatAt(x, y - 20, 'Semilla plantada', '#9ef08a', 7);
  g.toast('Plantas una Semilla del Eco. Trescientos años es mucho tiempo para crecer... (vuelve al presente con Q)', '#9ef08a');
}

function recoger(g: Game, s: Parcela): void {
  const p = g.player;
  if (!p) return;
  g.flags[`fruto_${s.id}`] = true;
  const n = frutosRecogidos(g);
  const x = s.tx * TILE + 8, y = s.ty * TILE + 8;
  p.hp = p.maxHp;
  p.potions += 1;
  p.gold += 25;
  if (!g.challengeRun) g.stats.coronasGanadas += 25;
  let extra = '';
  if (n % 4 === 0) { p.points += 1; extra = ' · la savia te fortalece: +1 punto de atributo'; }
  spawnVfx('nova', x, y - 10, { el: 'sagrado', size: 0.8, life: 0.6 });
  g.burst(x, y - 16, '#ffe08a', 20, 70);
  audio.sfx('potion');
  g.floatAt(x, y - 30, '+1 poción · +25 coronas', '#f0c84a', 7);
  g.toast(`Fruto del Eco ${n}/${todasLasParcelas().length}: vida completa, +1 poción, +25 coronas${extra}`, '#ffe08a');
}

function pista(g: Game): void {
  if (g.player?.hasEcho) g.toast('Tierra muerta. Huele a algo que pudo crecer aquí hace mucho... ¿y si en el ayer aún había tiempo? (Q)', '#c8b0e8');
  else g.toast('Tierra muerta. Ni la Niebla quiere esto.', '#9aa0b8');
}

// ---------------------------------------------------------------- aviso al volver
let ultimaEpoca = '';
let ultimoMapa = '';
/** 1×/frame: al ATERRIZAR en el presente, el mundo recuerda lo plantado. */
export function causalTick(g: Game): void {
  if (g.mapId !== ultimoMapa) { ultimoMapa = g.mapId; ultimaEpoca = g.epoch; return; }
  if (g.epoch === ultimaEpoca) return;
  const antes = ultimaEpoca;
  ultimaEpoca = g.epoch;
  if (antes !== 'pasado' || g.epoch !== 'presente') return;
  const nuevos = parcelasDe(g.mapId).filter(s => g.flags[`semilla_${s.id}`] && !g.flags[`fruto_${s.id}`] && !g.flags[`arbol_visto_${s.id}`]);
  if (!nuevos.length) return;
  for (const s of nuevos) {
    g.flags[`arbol_visto_${s.id}`] = true;
    g.floatAt(s.tx * TILE + 8, s.ty * TILE - 20, 'Ha crecido un Árbol del Eco', '#9ef08a', 7);
  }
  g.toast(nuevos.length > 1 ? `Lo que sembraste ayer ha crecido: ${nuevos.length} Árboles del Eco dan fruto` : 'Lo que sembraste ayer ha crecido: un Árbol del Eco da fruto', '#9ef08a');
}

// ---------------------------------------------------------------- dibujo
type Proj = (n: number) => number;
let SPR: { muerta: HTMLCanvasElement; fertil: HTMLCanvasElement; brote: HTMLCanvasElement; arbol: HTMLCanvasElement; arbolSin: HTMLCanvasElement } | null = null;

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}
function r(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, C: string) { x.fillStyle = C; x.fillRect(X, Y, W, H); }

function sprites() {
  if (SPR) return SPR;
  // tierra muerta + brote seco
  const [muerta, a] = mk(16, 12);
  r(a, 2, 6, 12, 5, '#4a3a2a'); r(a, 3, 5, 10, 1, '#5a4632'); r(a, 4, 7, 2, 1, '#3a2c20'); r(a, 9, 8, 3, 1, '#3a2c20');
  r(a, 7, 2, 1, 4, '#7a6a4a'); r(a, 6, 2, 1, 1, '#8a7a5a'); r(a, 8, 3, 1, 1, '#6a5a3a');
  // tierra fértil con semilla que late (el latido lo pone el render)
  const [fertil, b] = mk(16, 12);
  r(b, 2, 6, 12, 5, '#5e4128'); r(b, 3, 5, 10, 1, '#704e30'); r(b, 4, 7, 2, 1, '#4a3220'); r(b, 10, 8, 2, 1, '#4a3220');
  r(b, 5, 6, 1, 1, '#6a9a3a'); r(b, 11, 7, 1, 1, '#6a9a3a');
  r(b, 7, 6, 2, 2, '#ffe08a'); r(b, 7, 6, 1, 1, '#fff6d0');
  // brote recién plantado (pasado)
  const [brote, c] = mk(16, 16);
  r(c, 3, 11, 10, 4, '#5e4128'); r(c, 4, 10, 8, 1, '#704e30');
  r(c, 7, 4, 1, 7, '#4f8a3a'); r(c, 5, 5, 2, 1, '#6fbf4a'); r(c, 8, 6, 3, 1, '#6fbf4a'); r(c, 4, 4, 1, 1, '#8fdf6a'); r(c, 10, 5, 1, 1, '#8fdf6a');
  // Árbol del Eco (presente): tronco plateado, copa con hojas de nota y frutos dorados
  const build = (fruta: boolean) => {
    const [cv, x] = mk(32, 40);
    r(x, 10, 36, 12, 3, 'rgba(0,0,0,0.25)');
    r(x, 14, 22, 4, 15, '#9a9aa8'); r(x, 15, 22, 1, 15, '#c8c8d4'); r(x, 13, 34, 6, 3, '#8a8a98');
    r(x, 11, 33, 3, 2, '#7a7a88'); r(x, 18, 33, 3, 2, '#7a7a88');
    const copa = (cx: number, cy: number, rr: number, col: string) => {
      x.fillStyle = col;
      for (let yy = -rr; yy <= rr; yy++) { const hw = Math.round(Math.sqrt(rr * rr - yy * yy)); x.fillRect(cx - hw, cy + yy, hw * 2, 1); }
    };
    copa(16, 15, 11, '#2f6a4a'); copa(13, 13, 8, '#3f8a5e'); copa(19, 12, 7, '#4fa070'); copa(15, 9, 5, '#6fc08a');
    for (let k = 0; k < 9; k++) { const fx = 6 + ((k * 7) % 20), fy = 6 + ((k * 5) % 16); r(x, fx, fy, 1, 1, '#a8f0c8'); }
    if (fruta) {
      for (const [fx, fy] of [[9, 16], [21, 14], [15, 20], [12, 9], [20, 20]]) { r(x, fx, fy, 2, 2, '#f0c84a'); r(x, fx, fy, 1, 1, '#fff2b0'); }
    }
    return cv;
  };
  SPR = { muerta, fertil, brote, arbol: build(true), arbolSin: build(false) };
  return SPR;
}

/** Parcelas (pase de mundo, bajo entidades). */
export function drawCausal(ctx: CanvasRenderingContext2D, g: Game, sx: Proj, sy: Proj, Z: number): void {
  const ps = parcelasDe(g.mapId);
  if (!ps.length) return;
  const S = sprites();
  for (const s of ps) {
    const wx = s.tx * TILE + 8, wy = s.ty * TILE + 8;
    const X = sx(wx), Y = sy(wy);
    if (X < -80 || Y < -100 || X > VIEW_W + 80 || Y > VIEW_H + 60) continue;
    const plantada = !!g.flags[`semilla_${s.id}`];
    const cogido = !!g.flags[`fruto_${s.id}`];
    if (g.epoch === 'pasado') {
      if (plantada) {
        ctx.drawImage(S.brote, X - 8 * Z, Y - 12 * Z, 16 * Z, 16 * Z);
      } else {
        ctx.drawImage(S.fertil, X - 8 * Z, Y - 8 * Z, 16 * Z, 12 * Z);
        // latido dorado de la semilla
        const k = 0.5 + 0.5 * Math.sin(g.globalT * 4 + s.idx);
        ctx.globalAlpha = 0.25 + 0.35 * k;
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath(); ctx.arc(X, Y - 1 * Z, (3 + 3 * k) * Z, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (g.epoch === 'presente') {
      if (plantada) {
        const sway = Math.round(Math.sin(g.globalT * 1.3 + s.idx) * 0.6 * Z);
        ctx.drawImage(cogido ? S.arbolSin : S.arbol, X - 16 * Z + sway, Y - 34 * Z, 32 * Z, 40 * Z);
        if (!cogido) {
          const k = 0.5 + 0.5 * Math.sin(g.globalT * 3 + s.idx);
          ctx.globalAlpha = 0.18 + 0.2 * k;
          ctx.fillStyle = '#ffe08a';
          ctx.beginPath(); ctx.arc(X, Y - 20 * Z, 18 * Z, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.drawImage(S.muerta, X - 8 * Z, Y - 8 * Z, 16 * Z, 12 * Z);
      }
    }
  }
}

// ---------------------------------------------------------------- lente del eco
let lensK = 0; // apertura animada 0..1
let lensT = -1; // reloj propio (g.globalT) para animar la apertura

/** ¿La lente está disponible en este mapa (Eco despierto + otra época)? */
export function lensDisponible(g: Game): boolean {
  return !!g.player?.hasEcho && g.map.epochDiffs.length > 0 && (g.epoch === 'presente' || g.epoch === 'pasado' || g.map.baseEpoch === 'aun');
}

/**
 * Lente del Eco: pinta el SUELO de la otra época en un círculo alrededor del
 * Portador (pase de mundo, sobre el suelo y bajo props/entidades) + siluetas
 * de cofres y objetos que solo existen allí. Devuelve si está activa.
 */
export function drawEchoLens(
  ctx: CanvasRenderingContext2D, g: Game, sx: Proj, sy: Proj, Z: number,
  current: HTMLCanvasElement | null, other: HTMLCanvasElement | null, camX: number, camY: number,
): boolean {
  const dt = lensT < 0 ? 0 : Math.max(0, Math.min(0.1, g.globalT - lensT));
  lensT = g.globalT;
  const want = g.state === 'play' && g.keys.has('r') && lensDisponible(g) && !!other && other !== current;
  lensK = Math.max(0, Math.min(1, lensK + (want ? dt * 5 : -dt * 7)));
  if (lensK <= 0.01 || !other || !g.player) return false;
  const p = g.player;
  const R = (48 + 22 * lensK) * Z;
  const cx = sx(p.x), cy = sy(p.y - 4);
  const otraEsPasado = g.epoch !== 'pasado';
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  // el pase de mundo recibirá el filtro de la época ACTUAL: se compensa para
  // que el interior se lea con el color de la OTRA época
  ctx.filter = otraEsPasado ? 'saturate(1.9) brightness(1.12) sepia(0.12)' : 'saturate(0.55) brightness(0.92)';
  const gx = Math.floor(camX / Z), gy = Math.floor(camY / Z);
  ctx.drawImage(other, gx, gy, VIEW_W / Z, VIEW_H / Z, 0, 0, VIEW_W, VIEW_H);
  ctx.filter = 'none';
  // siluetas de lo que SOLO existe en la otra época
  const otra = otraEsPasado ? 'pasado' : 'presente';
  ctx.globalAlpha = 0.65 * lensK;
  for (const ch of g.map.chests) {
    if (g.openedChests.has(ch.id)) continue;
    const solo = otra === 'pasado' ? ch.needPast : ch.needPresent;
    if (!solo) continue;
    const X = sx(ch.x * TILE + 8), Y = sy(ch.y * TILE + 6);
    ctx.fillStyle = otraEsPasado ? '#ffe08a' : '#a8c8e8';
    ctx.fillRect(X - 6 * Z, Y - 4 * Z, 12 * Z, 8 * Z);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(X - 6 * Z, Y - 1 * Z, 12 * Z, 1 * Z);
  }
  for (const pr of g.map.props) {
    const solo = otra === 'pasado' ? pr.needPast : pr.needPresent;
    if (!solo) continue;
    const X = sx(pr.x * TILE + 8), Y = sy(pr.y * TILE + 8);
    ctx.strokeStyle = otraEsPasado ? '#ffe08a' : '#a8c8e8';
    ctx.lineWidth = 1.5 * Z;
    ctx.strokeRect(X - 6 * Z, Y - 12 * Z, 12 * Z, 16 * Z);
  }
  // semillas: en el pasado se ve la tierra fértil; en el presente, el árbol
  for (const s of parcelasDe(g.mapId)) {
    const X = sx(s.tx * TILE + 8), Y = sy(s.ty * TILE + 8);
    if (otraEsPasado && !g.flags[`semilla_${s.id}`]) { ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(X, Y, 3 * Z, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // aro del tiempo: dos anillos que giran en sentidos opuestos
  ctx.save();
  ctx.strokeStyle = otraEsPasado ? '#ffd27a' : '#9ec8ff';
  ctx.lineWidth = 2 * Z;
  ctx.globalAlpha = 0.9 * lensK;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1 * Z;
  ctx.globalAlpha = 0.6 * lensK;
  const t = g.globalT;
  for (let k = 0; k < 12; k++) {
    const a = t * 1.2 + (k / 12) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, R + 4 * Z, a, a + 0.25); ctx.stroke();
    const b = -t * 0.8 + (k / 12) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, R - 4 * Z, b, b + 0.18); ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  return true;
}

// ---------------------------------------------------------------- transición
// R17: al pulsar Q el tiempo NUEVO se expande desde el Portador como una
// onda: fuera del círculo aún se ve la época anterior (con su color), en el
// borde un aro de luz. 0,7 s; si cambia el mapa, no hay barrido.
let wipeT = 9, wipeMap = '', wipeEpoca = '', wipePrevEpoca = '';
let wipeClock = -1;
const WIPE_DUR = 0.7;

export function drawEpochWipe(
  ctx: CanvasRenderingContext2D, g: Game, sx: Proj, sy: Proj, Z: number,
  current: HTMLCanvasElement | null, other: HTMLCanvasElement | null, camX: number, camY: number,
): void {
  const dt = wipeClock < 0 ? 0 : Math.max(0, Math.min(0.1, g.globalT - wipeClock));
  wipeClock = g.globalT;
  if (g.mapId !== wipeMap) { wipeMap = g.mapId; wipeEpoca = g.epoch; wipeT = 9; return; }
  if (g.epoch !== wipeEpoca) { wipePrevEpoca = wipeEpoca; wipeEpoca = g.epoch; wipeT = 0; }
  if (wipeT >= WIPE_DUR) return;
  wipeT += dt;
  if (!other || other === current || !g.player) return;
  const k = Math.min(1, wipeT / WIPE_DUR);
  const e = 1 - (1 - k) * (1 - k) * (1 - k);
  const cx = sx(g.player.x), cy = sy(g.player.y - 4);
  const maxR = Math.hypot(VIEW_W, VIEW_H);
  const R = 8 * Z + e * maxR;
  ctx.save();
  // región FUERA del círculo: la época que se deja atrás
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, VIEW_H);
  ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
  ctx.clip('evenodd');
  ctx.filter = wipePrevEpoca === 'pasado' ? 'saturate(1.9) brightness(1.12) sepia(0.12)' : 'saturate(0.55) brightness(0.92)';
  const gx = Math.floor(camX / Z), gy = Math.floor(camY / Z);
  ctx.drawImage(other, gx, gy, VIEW_W / Z, VIEW_H / Z, 0, 0, VIEW_W, VIEW_H);
  ctx.filter = 'none';
  ctx.restore();
  // frente de onda luminoso
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.8 * (1 - k);
  ctx.strokeStyle = g.epoch === 'pasado' ? '#ffd27a' : '#9ec8ff';
  ctx.lineWidth = 6 * Z * (1 - k) + Z;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.35 * (1 - k);
  ctx.lineWidth = 16 * Z * (1 - k) + Z;
  ctx.beginPath(); ctx.arc(cx, cy, R - 6 * Z, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- atmósfera
// R17: cada época con su aire. PASADO: bordes cálidos dorados (recuerdo,
// luz de tarde). PRESENTE: bordes fríos gris-azulados (ceniza, pérdida).
// Gradiente cacheado por (época, tamaño de vista): 1 fillRect por frame.
let atmCache: { key: string; grad: CanvasGradient } | null = null;
export function drawEpochAtmosphere(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.map.dark || g.map.indoor || g.map.epochDiffs.length === 0) return;
  if (g.epoch !== 'pasado' && g.epoch !== 'presente') return;
  const key = `${g.epoch}|${VIEW_W}|${VIEW_H}`;
  if (!atmCache || atmCache.key !== key) {
    const gr = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, Math.min(VIEW_W, VIEW_H) * 0.32, VIEW_W / 2, VIEW_H / 2, Math.hypot(VIEW_W, VIEW_H) * 0.55);
    if (g.epoch === 'pasado') {
      gr.addColorStop(0, 'rgba(255,214,140,0)');
      gr.addColorStop(1, 'rgba(255,190,110,0.20)');
    } else {
      gr.addColorStop(0, 'rgba(110,130,160,0)');
      gr.addColorStop(1, 'rgba(70,86,112,0.24)');
    }
    atmCache = { key, grad: gr };
  }
  ctx.save();
  ctx.fillStyle = atmCache.grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // pasado: motas doradas que flotan hacia arriba (luz de recuerdo)
  if (g.epoch === 'pasado') {
    ctx.globalCompositeOperation = 'lighter';
    const t = g.globalT;
    for (let i = 0; i < 18; i++) {
      const h1 = hash2(i * 17 + 3, 7) * 2, h2 = hash2(i * 29 + 1, 11) * 2;
      const x = ((h1 * VIEW_W + Math.sin(t * 0.4 + i) * 20) % VIEW_W + VIEW_W) % VIEW_W;
      const y = (((h2 * VIEW_H - t * (8 + (i % 5) * 3)) % VIEW_H) + VIEW_H) % VIEW_H;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + i);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(x, y, 2, 2);
    }
  } else {
    // R18 · presente: ceniza de la Niebla que cae y deriva con el viento
    // (parallax suave con la cámara; deterministas por índice, sin allocations)
    const t = g.globalT;
    const px = g.camX * 0.25, py = g.camY * 0.25;
    for (let i = 0; i < 22; i++) {
      const h1 = hash2(i * 13 + 5, 3) * 2, h2 = hash2(i * 31 + 9, 17) * 2;
      const spd = 14 + (i % 6) * 4;
      const x = (((h1 * VIEW_W + t * 9 + Math.sin(t * 0.7 + i * 1.3) * 16 - px) % VIEW_W) + VIEW_W) % VIEW_W;
      const y = (((h2 * VIEW_H + t * spd - py) % VIEW_H) + VIEW_H) % VIEW_H;
      ctx.globalAlpha = 0.18 + 0.14 * Math.sin(t * 1.3 + i);
      ctx.fillStyle = i % 3 === 0 ? '#c8ccd8' : '#7a7e8c';
      ctx.fillRect(x, y, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 2 : 1);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
