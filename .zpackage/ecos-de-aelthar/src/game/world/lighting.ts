// ============================================================
// ECOS DE AELTHAR — Iluminación dinámica (R1-A6 · módulo world)
// Reemplaza/complementa el drawLighting de render.ts con:
//   · ciclo día/noche por keyframes + smoothstep (amanecer rosa,
//     tarde ámbar, noche azul oscura)
//   · recorte de luces en canvas offscreen (destination-out) con
//     radial gradients: radio en px de mundo × ZOOM, flicker
//     1 + 0.06·sin(globalT·13 + semilla) y jitter de 1 px
//   · tinte cálido aditivo ('lighter') por luz
//   · cripta: oscuridad base 0.72 + antorchas deterministas
//     (hash2) junto a muros '#' + haz suave del jugador (r=110)
//   · viñeta perenne suave
// Sin estado de juego propio: TODO se deriva de g y g.globalT.
// ============================================================

import { VIEW_W, VIEW_H, ZOOM, TILE } from '../engine';
import type { Game } from '../engine';
import type { Entity, StatusFx } from '../types';
import { hash2, LIGHT_PAL } from './palette';

// ---------------- API pública ----------------

/** Fuente de luz deducida del estado del juego.
 *  Coordenadas x/y en px de MUNDO (1x, sin ZOOM); r en px de mundo.
 *  `flicker` es la semilla/fase de parpadeo (radianes): el factor real
 *  aplicado al dibujar es 1 + 0.06·sin(globalT·13 + flicker). */
export interface LightSrc { x: number; y: number; r: number; color: string; flicker: number; }

/** Debug de iluminación: dibuja el contorno circular de cada luz. */
export const LIGHT_DEBUG = false;

// ---------------- Constantes del módulo ----------------

const DEBUG_COL = '#3affd4';

// Keyframes del ciclo día/noche (dayT 0..1; 0.15 = amanecer).
// a/col = capa de oscuridad (alpha y color); w/wc = tinte de franja
// (amanecer rosa, tarde ámbar) pintado en 'source-over'.
interface DayStop { t: number; a: number; col: RGB; w: number; wc: RGB; }
type RGB = [number, number, number];

const DAY_STOPS: DayStop[] = [
  { t: 0.00, a: 0.50, col: [10, 14, 40], w: 0.00, wc: [255, 150, 170] }, // madrugada azul
  { t: 0.08, a: 0.28, col: [10, 14, 40], w: 0.02, wc: [255, 150, 170] },
  { t: 0.15, a: 0.10, col: [46, 36, 62], w: 0.09, wc: [255, 150, 170] }, // AMANECER rosa
  { t: 0.26, a: 0.00, col: [10, 14, 40], w: 0.00, wc: [255, 148, 74] },  // día claro
  { t: 0.44, a: 0.00, col: [10, 14, 40], w: 0.00, wc: [255, 148, 74] },
  { t: 0.52, a: 0.00, col: [10, 14, 40], w: 0.13, wc: [255, 148, 74] },  // TARDE ámbar
  { t: 0.62, a: 0.10, col: [16, 20, 52], w: 0.05, wc: [255, 148, 74] },  // anochecer
  { t: 0.74, a: 0.45, col: [10, 14, 40], w: 0.00, wc: [255, 148, 74] },  // noche azul
  { t: 0.86, a: 0.58, col: [8, 12, 36], w: 0.00, wc: [255, 148, 74] },   // medianoche
  { t: 1.00, a: 0.50, col: [10, 14, 40], w: 0.00, wc: [255, 150, 170] },
];

// Parámetros de la cripta (mapa dark).
const CRYPT_DARK = 0.72;          // oscuridad base
const CRYPT_COL: RGB = [6, 8, 16];
const CRYPT_BEAM_R = 110;         // haz suave del jugador (px de mundo)
const TORCH_CELL_KEEP = 0.24;     // ~mitad de las celdas 4×4 porta antorcha
const TORCH_MIN_DIST2 = 12.25;    // separación mínima entre antorchas (3.5 tiles²)

// ---------------- Utilidades ----------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(u: number): number {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

function hexRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

function lerp3(A: RGB, B: RGB, u: number): RGB {
  return [
    A[0] + (B[0] - A[0]) * u,
    A[1] + (B[1] - A[1]) * u,
    A[2] + (B[2] - A[2]) * u,
  ];
}

interface DaySample { a: number; col: RGB; w: number; wc: RGB; }

/** Muestrea el ciclo día/noche interpolando keyframes con smoothstep. */
function sampleDay(d: number): DaySample {
  const t = clamp(d, 0, 1);
  for (let i = 0; i < DAY_STOPS.length - 1; i++) {
    const A = DAY_STOPS[i], B = DAY_STOPS[i + 1];
    if (t >= A.t && t <= B.t) {
      const u = smoothstep((t - A.t) / Math.max(1e-6, B.t - A.t));
      return {
        a: A.a + (B.a - A.a) * u,
        col: lerp3(A.col, B.col, u),
        w: A.w + (B.w - A.w) * u,
        wc: lerp3(A.wc, B.wc, u),
      };
    }
  }
  const last = DAY_STOPS[DAY_STOPS.length - 1];
  return { a: last.a, col: last.col, w: last.w, wc: last.wc };
}

/** ¿El tile es transitable (puede recibir luz frontal de muro)? */
function isWalkable(ch: string): boolean {
  return ch !== '#' && ch !== 'V' && ch !== 'P' && ch !== 'A' && ch !== 'H' && ch !== 'r';
}

// ---------------- Recolección de luces ----------------

/** Antorchas de muro de la cripta: rejilla determinista basada en hash2.
 *  · cada muro '#' con algún vecino transitable es candidato;
 *  · celdas 4×4: el hash de celda decide si porta antorcha y el máximo
 *    local del hash por muro elige CUÁL muro la porta (sin racimos);
 *  · separación mínima de 3.5 tiles entre portadoras;
 *  · todo se evalúa sobre el mapa completo (independiente de la cámara)
 *    y solo se emiten las luces que caen dentro de la vista. */
function collectCryptTorches(g: Game, out: LightSrc[]): void {
  const rows = g.rows.length >= g.map.h ? g.rows : g.map.rows;
  const W = g.map.w, H = g.map.h;

  // hash de portación por muro (semilla estable de parpadeo incluida)
  const hTorch = (tx: number, ty: number) => hash2(tx * 7 + 3, ty * 11 + 5);

  // 1) candidatos: muros '#' que dan a una sala, en orden de barrido fijo
  const cand: { tx: number; ty: number; h: number }[] = [];
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (rows[ty][tx] !== '#') continue;
      const n = (rows[ty - 1] ?? '')[tx], s = (rows[ty + 1] ?? '')[tx];
      const w = rows[ty][tx - 1], e = rows[ty][tx + 1];
      if (!isWalkable(n) && !isWalkable(s) && !isWalkable(w) && !isWalkable(e)) continue;
      cand.push({ tx, ty, h: hTorch(tx, ty) });
    }
  }

  // 2) rejilla: la celda 4×4 decide (hash de celda) y el máximo local elige el muro
  const kept: { tx: number; ty: number; h: number; seed: number }[] = [];
  for (const c of cand) {
    const cellX = c.tx >> 2, cellY = c.ty >> 2;
    const hCell = hash2(cellX * 13 + 1, cellY * 29 + 7);
    if (hCell >= TORCH_CELL_KEEP) continue;
    let win = true;
    for (const o of cand) {
      if (o === c) continue;
      if ((o.tx >> 2) !== cellX || (o.ty >> 2) !== cellY) continue;
      if (o.h > c.h || (o.h === c.h && (o.ty < c.ty || (o.ty === c.ty && o.tx < c.tx)))) { win = false; break; }
    }
    if (!win) continue;
    // separación mínima con portadoras ya aceptadas (orden determinista)
    let spaced = true;
    for (const k of kept) {
      const dx = k.tx - c.tx, dy = k.ty - c.ty;
      if (dx * dx + dy * dy < TORCH_MIN_DIST2) { spaced = false; break; }
    }
    if (!spaced) continue;
    kept.push({ tx: c.tx, ty: c.ty, h: hCell, seed: c.h * 97 });
  }

  // 3) emisión: solo las que caen en la vista (radio de margen holgado)
  const ZT = ZOOM * TILE;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const vx0 = camX / ZT - 6, vy0 = camY / ZT - 6;
  const vx1 = (camX + VIEW_W) / ZT + 6, vy1 = (camY + VIEW_H) / ZT + 6;
  for (const k of kept) {
    if (k.tx < vx0 || k.ty < vy0 || k.tx > vx1 || k.ty > vy1) continue;
    out.push({
      x: k.tx * TILE + 8,
      y: k.ty * TILE + 11,        // cara frontal del muro
      r: 40 + k.h * 30,           // 40..55 px de mundo (variación determinista)
      color: LIGHT_PAL.torchAmber,
      flicker: k.seed,
    });
  }
}

/** Luz naranja parpadeante por entidad con estado 'quemado'. */
function pushBurnLight(e: Entity, seed: number, out: LightSrc[]): void {
  if (e.dead) return;
  const st = (e as { statuses?: StatusFx[] }).statuses;
  if (!st) return;
  for (const s of st) {
    if (s.kind === 'quemado' && s.t > 0) {
      out.push({ x: e.x, y: e.y - 8, r: 32, color: LIGHT_PAL.burnOrange, flicker: seed });
      return;
    }
  }
}

/** Deduce TODAS las fuentes de luz visibles a partir del estado del juego.
 *  Determinista salvo pulsos/parpadeos derivados de g.globalT. */
export function collectLights(g: Game): LightSrc[] {
  const lights: LightSrc[] = [];
  const t = g.globalT;

  // 1) Props: santuarios (cian pulsante), forja (naranja), altar de la cripta (dorado)
  for (const pr of g.map.props) {
    if (pr.needPast && g.epoch !== 'pasado') continue;
    if (pr.needPresent && g.epoch !== 'presente') continue;
    const cx = pr.x * TILE + 8, cy = pr.y * TILE + 8;
    if (pr.kind === 'sanctuary') {
      // pulso lento acoplado a la fase del prop (igual que el aura del render)
      const pulse = Math.sin(t * 2 + pr.x * 0.9) * 6;
      lights.push({ x: cx, y: cy - 4, r: 88 + pulse, color: LIGHT_PAL.sanctuaryCyan, flicker: pr.x * 1.31 });
    } else if (pr.kind === 'forge') {
      lights.push({ x: cx, y: cy - 5, r: 58, color: LIGHT_PAL.forgeEmber, flicker: 2.1 });
    } else if (pr.kind === 'altarEcho' && g.mapId === 'cripta') {
      // el fragmento dorado brilla fuerte hasta recoger el Eco de la Voz
      const taken = !!g.flags.ecoVoz;
      lights.push({ x: cx, y: cy - 12, r: taken ? 44 : 80, color: LIGHT_PAL.altarGold, flicker: 0.7 });
    }
  }

  // 2) Entidades quemadas (NPC/jefe/enemigo/compañero): naranja parpadeo
  for (let i = 0; i < g.enemies.length; i++) pushBurnLight(g.enemies[i], i * 1.9 + 0.4, lights);
  for (let i = 0; i < g.npcs.length; i++) pushBurnLight(g.npcs[i], 40 + i * 2.3, lights);
  if (g.companion) pushBurnLight(g.companion, 88.8, lights);

  // 3) Jugador
  const p = g.player;
  if (p && !p.dead) {
    // disciplina tejedor: aura violeta tenue
    if (p.discipline === 'tejedor') {
      lights.push({ x: p.x, y: p.y - 8, r: 48, color: LIGHT_PAL.weaverViolet, flicker: 4.4 });
    }
    // cripta: haz suave alrededor del portador
    if (g.map.dark) {
      lights.push({ x: p.x, y: p.y - 6, r: CRYPT_BEAM_R, color: LIGHT_PAL.playerBeam, flicker: 0 });
    }
  }

  // 4) Antorchas de muro (solo mapas oscuros)
  if (g.map.dark) collectCryptTorches(g, lights);

  return lights;
}

// ---------------- Canvas offscreen (scratch reutilizable) ----------------
// Caché de buffer de dibujo, sin datos de juego: se limpia en cada frame.
let scratchCv: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function getScratch(): { cv: HTMLCanvasElement; cx: CanvasRenderingContext2D } {
  if (!scratchCv) {
    scratchCv = document.createElement('canvas');
    scratchCv.width = VIEW_W;
    scratchCv.height = VIEW_H;
    scratchCtx = scratchCv.getContext('2d');
  }
  return { cv: scratchCv, cx: scratchCtx! };
}

// ---------------- Pipeline principal ----------------

/** Iluminación dinámica v2. Dibuja SOBRE ctx (canvas principal, espacio de
 *  vista 960×540): franja del ciclo día/noche → capa de oscuridad con
 *  recortes por luz → tinte cálido aditivo → viñeta. En mapas dark usa
 *  oscuridad base 0.72 con antorchas ámbar y haz del jugador. */
export function drawLightingV2(ctx: CanvasRenderingContext2D, g: Game): void {
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const lights = collectLights(g);
  const darkMap = !!g.map.dark;

  // ---- a) oscuridad y tinte según día/noche (o cripta) ----
  let dark: DaySample;
  if (darkMap) {
    // la cripta "respira" como brasas lejanas
    const a = CRYPT_DARK + Math.sin(g.globalT * 11) * 0.02 + Math.sin(g.globalT * 23 + 1.7) * 0.015;
    dark = { a, col: CRYPT_COL, w: 0, wc: [255, 148, 74] };
  } else {
    dark = sampleDay(g.dayT);
  }

  // tinte de franja (amanecer rosa / tarde ámbar), 'source-over' simulando
  // un multiply suave — antes de la oscuridad para que la luz lo respire
  if (dark.w > 0.004) {
    ctx.fillStyle = rgba(dark.wc, dark.w);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // ---- b) capa de oscuridad con recortes por luz ----
  if (dark.a > 0.02) {
    const sc = getScratch();
    const lx = sc.cx;
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, VIEW_W, VIEW_H);
    lx.fillStyle = rgba(dark.col, Math.min(1, dark.a));
    lx.fillRect(0, 0, VIEW_W, VIEW_H);

    // agujeros de luz: destination-out SOLO sobre la capa de oscuridad
    lx.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const fk = 1 + 0.06 * Math.sin(g.globalT * 13 + L.flicker);
      const r = L.r * ZOOM * fk;
      const x = L.x * ZOOM - camX + Math.round(Math.sin(g.globalT * 7.3 + L.flicker * 5.1));
      const y = L.y * ZOOM - camY + Math.round(Math.cos(g.globalT * 6.1 + L.flicker * 3.7));
      if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) continue;
      const gr = lx.createRadialGradient(x, y, Math.max(2, r * 0.08), x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,0.95)');
      gr.addColorStop(0.55, 'rgba(0,0,0,0.55)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = gr;
      lx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    lx.globalCompositeOperation = 'source-over';

    // componer: los huecos revelan el escenario
    ctx.drawImage(sc.cv, 0, 0);
  }

  // ---- c) tinte cálido aditivo por luz ----
  // alpha derivada del color: cálidas (naranjas/dorados) más intensas,
  // frías (cian/violeta) tenues — coherente con "tinte cálido"
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    const [cr, cg, cb] = hexRgb(L.color);
    const warmth = (cr - cb) / 255;
    const base = clamp(0.07 + warmth * 0.09, 0.05, 0.15);
    const fk = 1 + 0.06 * Math.sin(g.globalT * 13 + L.flicker);
    const pulse = (fk - 1) / 0.06;                    // -1..1
    const alpha = clamp(base * (0.92 + 0.08 * pulse), 0, 0.2);
    const r = L.r * ZOOM * fk;
    const x = L.x * ZOOM - camX, y = L.y * ZOOM - camY;
    if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) continue;
    const tg = ctx.createRadialGradient(x, y, 0, x, y, r);
    tg.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`);
    tg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = tg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();

  // ---- e) viñeta perenne suave ----
  const vg = ctx.createRadialGradient(
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.44,
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.92,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,10,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // ---- debug: círculos de radio por luz ----
  if (LIGHT_DEBUG) {
    ctx.save();
    ctx.strokeStyle = DEBUG_COL;
    ctx.lineWidth = 1;
    for (const L of lights) {
      const x = L.x * ZOOM - camX, y = L.y * ZOOM - camY, r = L.r * ZOOM;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
