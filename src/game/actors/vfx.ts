// ============================================================
// R16 · VFX DE COMBATE Y MAGIA («El Filo y la Nota»)
// Efectos nuevos que faltaban para que golpes y magias SE VEAN:
//  · smear     — media luna de filo que barre con el tajo (combo 1-3 / cargado)
//  · impact    — estrella de impacto + anillo (crítico: estrella de 8 puntas)
//  · claw      — tres zarpazos rojos cuando un enemigo te alcanza
//  · dash      — Tajo Lunar: estela de luna con siluetas fantasma
//  · warcry    — Grito de Guerra: ondas de sonido + ascuas (aura mientras dure)
//  · dome      — Muro de Alba: cúpula hexagonal dorada que se cierra y estalla
//  · sunblades — Filo del Alba: tres hojas de luz orbitando + estallido solar
//  · bolt      — rayo quebrado con ramas (Canto de Chispa / cadenas)
//  · pyre      — impacto de fuego: columna de llama y ascuas
//  · frost     — impacto de hielo: cristales que brotan en estrella
//  · rune      — Canto Mayor: círculo rúnico con notas que gira y se cierra
//  · nova      — onda elemental mayor tras el círculo rúnico
//  · pillar    — subida de nivel: pilar de luz dorada con runas
//  · bossDeath — caída de jefe: rayos que giran, triple onda y destello
//  · parry     — parada perfecta: chispa cruzada azul-blanca
// Contrato de rendimiento (mismo que spells.ts / killfx.ts): POOL FIJO de
// ranuras reescritas (cero allocations por frame), vida corta, early-out
// por ranura inactiva. Dos pases:
//  · drawVfxWorld  — formas, bajo la iluminación (reciben la noche)
//  · drawVfxGlow   — halos aditivos 'lighter' DESPUÉS de la iluminación:
//                    la magia ilumina la oscuridad (cripta, noche).
// Coordenadas de mundo (px 1×); sx/sy las pasan a pantalla y Z = ZOOM.
// ============================================================

import type { Element } from '../types';

export type VfxKind =
  | 'smear' | 'impact' | 'claw' | 'dash' | 'warcry' | 'dome' | 'sunblades'
  | 'bolt' | 'pyre' | 'frost' | 'rune' | 'nova' | 'pillar' | 'bossDeath' | 'parry';

interface VfxSlot {
  active: boolean;
  kind: VfxKind;
  x: number; y: number;     // origen (mundo)
  x2: number; y2: number;   // destino (dash/bolt)
  ang: number;              // dirección principal (rad)
  age: number; life: number;
  size: number;             // escala libre por tipo
  flag: number;             // variante (combo, crítico, cargado…)
  el: Element;
  seed: number;
}

const POOL_N = 64;
const pool: VfxSlot[] = [];
for (let i = 0; i < POOL_N; i++) {
  pool.push({ active: false, kind: 'impact', x: 0, y: 0, x2: 0, y2: 0, ang: 0, age: 0, life: 1, size: 1, flag: 0, el: 'ninguno', seed: 0 });
}
let cursor = 0;

const LIFE: Record<VfxKind, number> = {
  smear: 0.2, impact: 0.18, claw: 0.28, dash: 0.42, warcry: 0.7, dome: 0.62,
  sunblades: 0.75, bolt: 0.24, pyre: 0.55, frost: 0.6, rune: 0.5, nova: 0.55,
  pillar: 1.3, bossDeath: 2.2, parry: 0.3,
};

const TAU = Math.PI * 2;

/** Colores por elemento: [núcleo, medio, borde] */
const ELC: Record<Element, [string, string, string]> = {
  fuego: ['#fff2c0', '#ff9a3c', '#d2401c'],
  hielo: ['#f2fcff', '#9ee6ff', '#4a9ad8'],
  rayo: ['#ffffff', '#ffe86a', '#b88cff'],
  sombra: ['#f0e2ff', '#b08af0', '#5a3a90'],
  sagrado: ['#fffbe8', '#ffe08a', '#e0a83a'],
  ninguno: ['#ffffff', '#dfe6f0', '#8a96aa'],
};

/** hash determinista [0,1) para variar forma sin Math.random en el dibujo */
function hr(seed: number, k: number): number {
  const s = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export interface VfxOpts {
  x2?: number; y2?: number; ang?: number; size?: number; flag?: number; el?: Element; life?: number;
}

/** Lanza un efecto (reutiliza la ranura más vieja si el pool está lleno). */
export function spawnVfx(kind: VfxKind, x: number, y: number, o: VfxOpts = {}): void {
  let s: VfxSlot | null = null;
  for (let i = 0; i < POOL_N; i++) {
    const c = pool[(cursor + i) % POOL_N];
    if (!c.active) { s = c; cursor = (cursor + i + 1) % POOL_N; break; }
  }
  if (!s) { s = pool[cursor]; cursor = (cursor + 1) % POOL_N; }
  s.active = true; s.kind = kind;
  s.x = x; s.y = y;
  s.x2 = o.x2 ?? x; s.y2 = o.y2 ?? y;
  s.ang = o.ang ?? 0;
  s.size = o.size ?? 1;
  s.flag = o.flag ?? 0;
  s.el = o.el ?? 'ninguno';
  s.age = 0;
  s.life = o.life ?? LIFE[kind];
  s.seed = Math.random() * 1000;
}

/** Envejece el pool (llamar 1×/frame con el dt del juego). */
export function vfxTick(dt: number): void {
  for (let i = 0; i < POOL_N; i++) {
    const s = pool[i];
    if (!s.active) continue;
    s.age += dt;
    if (s.age >= s.life) s.active = false;
  }
}

/** Limpia el pool (cambio de mapa / partida nueva). */
export function resetVfx(): void {
  for (let i = 0; i < POOL_N; i++) pool[i].active = false;
}

/** Nº de efectos vivos (smokes/telemetría). */
export function vfxActiveCount(): number {
  let n = 0;
  for (let i = 0; i < POOL_N; i++) if (pool[i].active) n++;
  return n;
}

type Proj = (n: number) => number;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

// ---------------------------------------------------------------- helpers
function star(ctx: CanvasRenderingContext2D, x: number, y: number, rOut: number, rIn: number, n: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = rot + (i / (n * 2)) * TAU;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function halo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
  if (r <= 0.5 || a <= 0.01) return;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a;
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Polilínea quebrada entre dos puntos (rayo) — determinista por seed. */
function jagged(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number, amp: number, segs: number) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.moveTo(x0, y0);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const off = (hr(seed, i) - 0.5) * 2 * amp * Math.sin(t * Math.PI);
    ctx.lineTo(x0 + dx * t + nx * off, y0 + dy * t + ny * off);
  }
  ctx.lineTo(x1, y1);
}

// ---------------------------------------------------------------- pase mundo
export function drawVfxWorld(ctx: CanvasRenderingContext2D, sx: Proj, sy: Proj, Z: number, t: number): void {
  let any = false;
  for (let i = 0; i < POOL_N; i++) if (pool[i].active) { any = true; break; }
  if (!any) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < POOL_N; i++) {
    const s = pool[i];
    if (!s.active) continue;
    const k = Math.min(1, s.age / s.life);
    const X = sx(s.x), Y = sy(s.y);
    switch (s.kind) {
      case 'smear': drawSmear(ctx, s, X, Y, Z, k); break;
      case 'impact': drawImpact(ctx, s, X, Y, Z, k); break;
      case 'claw': drawClaw(ctx, s, X, Y, Z, k); break;
      case 'dash': drawDash(ctx, s, X, Y, sx(s.x2), sy(s.y2), Z, k); break;
      case 'warcry': drawWarcry(ctx, s, X, Y, Z, k); break;
      case 'dome': drawDome(ctx, s, X, Y, Z, k, t); break;
      case 'sunblades': drawSunblades(ctx, s, X, Y, Z, k); break;
      case 'bolt': drawBolt(ctx, s, X, Y, sx(s.x2), sy(s.y2), Z, k, t); break;
      case 'pyre': drawPyre(ctx, s, X, Y, Z, k, t); break;
      case 'frost': drawFrost(ctx, s, X, Y, Z, k); break;
      case 'rune': drawRune(ctx, s, X, Y, Z, k, t); break;
      case 'nova': drawNova(ctx, s, X, Y, Z, k); break;
      case 'pillar': drawPillar(ctx, s, X, Y, Z, k, t); break;
      case 'bossDeath': drawBossDeath(ctx, s, X, Y, Z, k, t); break;
      case 'parry': drawParry(ctx, s, X, Y, Z, k); break;
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- pase brillo
/** Halos aditivos tras la iluminación: la magia alumbra la noche/cripta. */
export function drawVfxGlow(ctx: CanvasRenderingContext2D, sx: Proj, sy: Proj, Z: number, darkness: number): void {
  let any = false;
  for (let i = 0; i < POOL_N; i++) if (pool[i].active) { any = true; break; }
  if (!any) return;
  // de día el halo apenas se nota (no lava la imagen); de noche/cripta brilla
  const gain = 0.35 + 0.65 * Math.max(0, Math.min(1, darkness));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < POOL_N; i++) {
    const s = pool[i];
    if (!s.active) continue;
    const k = Math.min(1, s.age / s.life);
    const f = 1 - k;
    const X = sx(s.x), Y = sy(s.y);
    const c = ELC[s.el][1];
    switch (s.kind) {
      case 'smear': halo(ctx, X, Y - 4 * Z, 26 * Z * s.size, s.flag === 3 || s.flag === 4 ? '#ffd24a' : '#fff4d0', 0.22 * f * gain); break;
      case 'impact': halo(ctx, X, Y, (s.flag ? 22 : 12) * Z, s.flag ? '#ffe08a' : '#ffffff', 0.35 * f * gain); break;
      case 'claw': halo(ctx, X, Y, 14 * Z, '#ff4a3a', 0.25 * f * gain); break;
      case 'dash': halo(ctx, sx(s.x2), sy(s.y2), 24 * Z, '#bcd8ff', 0.35 * f * gain); break;
      case 'warcry': halo(ctx, X, Y - 6 * Z, 46 * Z * easeOut(k), '#ff8a3a', 0.3 * f * gain); break;
      case 'dome': halo(ctx, X, Y, 52 * Z, '#ffe08a', 0.4 * f * gain); break;
      case 'sunblades': halo(ctx, X, Y - 4 * Z, 70 * Z, '#ffe8a0', 0.45 * f * gain); break;
      case 'bolt': halo(ctx, sx(s.x2), sy(s.y2), 30 * Z, '#fff6b0', 0.55 * f * gain); halo(ctx, X, Y, 18 * Z, '#d8c8ff', 0.3 * f * gain); break;
      case 'pyre': halo(ctx, X, Y - 10 * Z, 40 * Z * s.size, '#ff8a3c', 0.5 * f * gain); break;
      case 'frost': halo(ctx, X, Y, 34 * Z * s.size, '#9ee6ff', 0.4 * f * gain); break;
      case 'rune': halo(ctx, X, Y, 50 * Z, c, 0.35 * Math.min(1, k * 2) * gain); break;
      case 'nova': halo(ctx, X, Y, 70 * Z * easeOut(k), c, 0.55 * f * gain); break;
      case 'pillar': halo(ctx, X, Y - 30 * Z, 50 * Z, '#ffe08a', 0.4 * Math.sin(k * Math.PI) * gain); break;
      case 'bossDeath': halo(ctx, X, Y - 8 * Z, 140 * Z * (0.4 + 0.6 * easeOut(Math.min(1, k * 1.6))), '#fff0c0', 0.6 * f * gain); break;
      case 'parry': halo(ctx, X, Y, 20 * Z, '#bfe4ff', 0.5 * f * gain); break;
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ================================================================ efectos

/** Media luna de filo: cuña rellena que barre (flag 1-3 = golpe del combo, 3 = cargado). */
function drawSmear(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number) {
  // flag: 1 primer golpe · 2 segundo (barre al revés) · 4 remate · 3 cargado
  const charged = s.flag === 3;
  const finisher = s.flag === 4;
  const r = (charged ? 30 : finisher ? 24 : 21) * Z * s.size;
  const sweep = charged ? 2.6 : finisher ? 2.4 : 2.0;
  const dirSign = s.flag === 2 ? -1 : 1;           // el 2º golpe barre al revés
  const p = easeOut(Math.min(1, k * 1.8));
  const a0 = s.ang - dirSign * sweep / 2;
  const aHead = a0 + dirSign * sweep * p;
  const tail = Math.max(0, p - 0.55);
  const aTail = a0 + dirSign * sweep * tail;
  const fade = 1 - Math.max(0, (k - 0.45) / 0.55);
  const cy = Y - 4 * Z;
  const cols = charged ? ['#fff6d0', '#ffd24a', '#e08a20'] : s.flag === 1 ? ['#ffffff', '#dfe8f4', '#9aa8c0'] : ['#fffbe0', '#ffe86a', '#d8a030'];
  // cuerpo: corona circular entre r y r·0.62 (más gruesa en la cabeza)
  const steps = 10;
  ctx.globalAlpha = 0.55 * fade;
  ctx.fillStyle = cols[1];
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = aTail + (aHead - aTail) * (i / steps);
    const rr = r * (0.86 + 0.14 * (i / steps));
    ctx.lineTo(X + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  for (let i = steps; i >= 0; i--) {
    const a = aTail + (aHead - aTail) * (i / steps);
    const th = 0.18 + 0.22 * (i / steps);         // la cabeza es más ancha
    ctx.lineTo(X + Math.cos(a) * r * (1 - th), cy + Math.sin(a) * r * (1 - th));
  }
  ctx.closePath();
  ctx.fill();
  // filo exterior brillante
  ctx.globalAlpha = 0.95 * fade;
  ctx.strokeStyle = cols[0];
  ctx.lineWidth = (charged ? 3 : 2) * Z * 0.75;
  ctx.beginPath();
  ctx.arc(X, cy, r, Math.min(aTail, aHead), Math.max(aTail, aHead));
  ctx.stroke();
  // borde interior en sombra cálida
  ctx.globalAlpha = 0.4 * fade;
  ctx.strokeStyle = cols[2];
  ctx.lineWidth = Z;
  ctx.beginPath();
  ctx.arc(X, cy, r * 0.66, Math.min(aTail, aHead), Math.max(aTail, aHead));
  ctx.stroke();
  // chispa en la punta del filo
  if (k < 0.6) {
    const hx = X + Math.cos(aHead) * r, hy = cy + Math.sin(aHead) * r;
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#ffffff';
    star(ctx, hx, hy, (charged ? 5 : 3.5) * Z, 1 * Z, 4, s.seed);
    ctx.fill();
  }
  // golpe cargado: líneas de velocidad radiales
  if (charged || finisher) {
    ctx.globalAlpha = (charged ? 0.5 : 0.3) * fade;
    ctx.strokeStyle = '#fff2b0';
    ctx.lineWidth = Z * 0.8;
    for (let j = 0; j < 7; j++) {
      const a = a0 + dirSign * sweep * (j / 6) * p;
      const r0 = r * (1.08 + hr(s.seed, j) * 0.1), r1 = r0 + (6 + hr(s.seed, j + 9) * 8) * Z;
      ctx.beginPath();
      ctx.moveTo(X + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(X + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
  }
}

/** Estrella de impacto + anillo (flag 1 = crítico). */
function drawImpact(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number) {
  const crit = s.flag === 1;
  const f = 1 - k;
  const e = easeOut(k);
  const c = ELC[s.el];
  ctx.globalAlpha = f;
  ctx.fillStyle = crit ? '#fff6c8' : c[0];
  star(ctx, X, Y, (crit ? 13 : 8) * Z * (0.6 + 0.6 * e), (crit ? 2.4 : 1.6) * Z, crit ? 8 : 4, s.seed + (crit ? e * 0.6 : 0));
  ctx.fill();
  ctx.globalAlpha = 0.8 * f;
  ctx.strokeStyle = crit ? '#ffcf4a' : c[1];
  ctx.lineWidth = Z * (crit ? 1.6 : 1);
  ctx.beginPath();
  ctx.arc(X, Y, (crit ? 18 : 10) * Z * e, 0, TAU);
  ctx.stroke();
  if (crit) {
    ctx.globalAlpha = 0.5 * f;
    ctx.beginPath();
    ctx.arc(X, Y, 26 * Z * e, 0, TAU);
    ctx.stroke();
  }
}

/** Tres zarpazos rojos sobre el Portador al recibir un golpe. */
function drawClaw(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number) {
  const p = Math.min(1, k * 3);
  const f = 1 - Math.max(0, (k - 0.3) / 0.7);
  const cos = Math.cos(s.ang), sin = Math.sin(s.ang);
  const px = -sin, py = cos;
  const L = 16 * Z * s.size;
  for (let j = -1; j <= 1; j++) {
    const ox = X + px * j * 4.5 * Z, oy = Y - 6 * Z + py * j * 4.5 * Z;
    const x0 = ox - cos * L / 2, y0 = oy - sin * L / 2;
    const x1 = x0 + cos * L * p, y1 = y0 + sin * L * p;
    ctx.globalAlpha = 0.9 * f;
    ctx.strokeStyle = '#ff3a2a';
    ctx.lineWidth = 2.2 * Z * (1 - Math.abs(j) * 0.25);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalAlpha = 0.9 * f;
    ctx.strokeStyle = '#ffd0c0';
    ctx.lineWidth = 0.8 * Z;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
}

/** Tajo Lunar: cinta de luz luna del origen al destino + siluetas fantasma. */
function drawDash(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, X2: number, Y2: number, Z: number, k: number) {
  const f = 1 - k;
  const dx = X2 - X, dy = Y2 - Y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const w = 7 * Z * f;
  const cy0 = Y - 6 * Z, cy1 = Y2 - 6 * Z;
  const gr = ctx.createLinearGradient(X, cy0, X2, cy1);
  gr.addColorStop(0, 'rgba(160,200,255,0)');
  gr.addColorStop(0.7, 'rgba(190,220,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.globalAlpha = f;
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(X, cy0);
  ctx.lineTo(X2 + nx * w, cy1 + ny * w);
  ctx.lineTo(X2 + (dx / len) * w * 0.8, cy1 + (dy / len) * w * 0.8);
  ctx.lineTo(X2 - nx * w, cy1 - ny * w);
  ctx.closePath();
  ctx.fill();
  // tres lunas crecientes fantasma a lo largo de la estela
  for (let j = 0; j < 3; j++) {
    const t = 0.25 + j * 0.25;
    const mx = X + dx * t, my = cy0 + (cy1 - cy0) * t;
    // media luna como trazo grueso en C (sin composición destructiva: el
    // canvas es el del mundo y 'destination-out' le abriría agujeros)
    ctx.globalAlpha = (0.3 + j * 0.18) * f;
    ctx.strokeStyle = '#dce8ff';
    ctx.lineWidth = 2.2 * Z;
    ctx.beginPath();
    ctx.arc(mx, my, 4.2 * Z, 0.55 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
  }
  // destellos
  ctx.fillStyle = '#ffffff';
  for (let j = 0; j < 6; j++) {
    const t = hr(s.seed, j);
    const off = (hr(s.seed, j + 7) - 0.5) * 14 * Z;
    ctx.globalAlpha = f * (0.4 + 0.6 * hr(s.seed, j + 3));
    ctx.fillRect(X + dx * t + nx * off, cy0 + (cy1 - cy0) * t + ny * off - k * 8 * Z, 1.2 * Z, 1.2 * Z);
  }
}

/** Grito de Guerra: tres ondas sonoras + ascuas que suben. */
function drawWarcry(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number) {
  const cy = Y - 8 * Z;
  for (let j = 0; j < 3; j++) {
    const kk = Math.max(0, Math.min(1, (k - j * 0.12) / 0.7));
    if (kk <= 0 || kk >= 1) continue;
    const r = (8 + 46 * easeOut(kk)) * Z;
    ctx.globalAlpha = 0.75 * (1 - kk);
    ctx.strokeStyle = j === 1 ? '#ffd27a' : '#ff7a3a';
    ctx.lineWidth = (3 - j * 0.6) * Z;
    // anillo "dentado" de sonido: arcos cortos alternos
    for (let q = 0; q < 12; q++) {
      const a0 = (q / 12) * TAU + j * 0.2;
      ctx.beginPath();
      ctx.arc(X, cy, r, a0, a0 + TAU / 12 * 0.62);
      ctx.stroke();
    }
  }
  // ascuas ascendentes
  ctx.fillStyle = '#ffb04a';
  for (let j = 0; j < 14; j++) {
    const a = hr(s.seed, j) * TAU;
    const rr = (10 + hr(s.seed, j + 20) * 26) * Z * easeOut(k);
    const up = k * (18 + hr(s.seed, j + 40) * 22) * Z;
    ctx.globalAlpha = (1 - k) * (0.5 + 0.5 * hr(s.seed, j + 60));
    ctx.fillRect(X + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.5 - up, 1.5 * Z, 1.5 * Z);
  }
}

/** Muro de Alba: cúpula hexagonal que se cierra, destella y se rompe. */
function drawDome(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number, t: number) {
  const R = 46 * Z;
  const appear = Math.min(1, k / 0.25);
  const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  const r = R * (0.55 + 0.45 * easeOut(appear));
  const cy = Y - 4 * Z;
  // relleno translúcido (cúpula vista desde arriba = elipse)
  ctx.globalAlpha = 0.18 * fade;
  ctx.fillStyle = '#ffe9a0';
  ctx.beginPath();
  ctx.ellipse(X, cy, r, r * 0.78, 0, 0, TAU);
  ctx.fill();
  // panal hexagonal recortado a la cúpula
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(X, cy, r, r * 0.78, 0, 0, TAU);
  ctx.clip();
  ctx.globalAlpha = 0.5 * fade;
  ctx.strokeStyle = '#ffe08a';
  ctx.lineWidth = Z * 0.7;
  const hs = 9 * Z;
  const rot = t * 0.4;
  for (let gx = -5; gx <= 5; gx++) {
    for (let gy = -5; gy <= 5; gy++) {
      const hx = X + gx * hs * 1.5;
      const hy = cy + (gy + (gx & 1 ? 0.5 : 0)) * hs * 1.732 * 0.78;
      if (Math.hypot(hx - X, (hy - cy) / 0.78) > r + hs) continue;
      ctx.beginPath();
      for (let v = 0; v < 6; v++) {
        const a = rot * 0 + (v / 6) * TAU;
        const vx = hx + Math.cos(a) * hs, vy = hy + Math.sin(a) * hs * 0.78;
        if (v === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
  // borde dorado brillante
  ctx.globalAlpha = 0.95 * fade;
  ctx.strokeStyle = '#fff2b8';
  ctx.lineWidth = 2.2 * Z;
  ctx.beginPath();
  ctx.ellipse(X, cy, r, r * 0.78, 0, 0, TAU);
  ctx.stroke();
  // 6 columnas de luz que suben desde el borde
  ctx.lineWidth = 2 * Z;
  for (let j = 0; j < 6; j++) {
    const a = (j / 6) * TAU + 0.26;
    const bx = X + Math.cos(a) * r, by = cy + Math.sin(a) * r * 0.78;
    const h = (14 + 10 * Math.sin(k * Math.PI)) * Z;
    const gr = ctx.createLinearGradient(bx, by, bx, by - h);
    gr.addColorStop(0, 'rgba(255,240,180,0.9)');
    gr.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.globalAlpha = fade;
    ctx.strokeStyle = gr;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - h); ctx.stroke();
  }
  // estallido final: fragmentos que salen despedidos
  if (k > 0.6) {
    const q = (k - 0.6) / 0.4;
    ctx.fillStyle = '#ffe9a0';
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * TAU + hr(s.seed, j) * 0.4;
      const rr = r * (1 + q * 0.5);
      ctx.globalAlpha = 1 - q;
      ctx.fillRect(X + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.78, 2 * Z, 2 * Z);
    }
  }
}

/** Filo del Alba: tres hojas de luz que orbitan y un sol que estalla. */
function drawSunblades(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number) {
  const cy = Y - 6 * Z;
  const f = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
  const rot = s.ang + easeOut(k) * TAU * 1.4;
  const R = (18 + 40 * easeOut(Math.min(1, k * 1.3))) * Z;
  // rayos solares de fondo
  ctx.globalAlpha = 0.35 * f;
  ctx.fillStyle = '#fff0b0';
  for (let j = 0; j < 12; j++) {
    const a = rot * 0.3 + (j / 12) * TAU;
    const L = R * (1.1 + 0.3 * hr(s.seed, j));
    ctx.beginPath();
    ctx.moveTo(X + Math.cos(a - 0.06) * 6 * Z, cy + Math.sin(a - 0.06) * 6 * Z);
    ctx.lineTo(X + Math.cos(a) * L, cy + Math.sin(a) * L);
    ctx.lineTo(X + Math.cos(a + 0.06) * 6 * Z, cy + Math.sin(a + 0.06) * 6 * Z);
    ctx.closePath();
    ctx.fill();
  }
  // tres hojas de luz (triángulos alargados) orbitando
  for (let j = 0; j < 3; j++) {
    const a = rot + (j / 3) * TAU;
    const bx = X + Math.cos(a) * R, by = cy + Math.sin(a) * R * 0.85;
    const ta = a + Math.PI / 2;                     // la hoja apunta en la tangente
    const L = 16 * Z, W = 4 * Z;
    ctx.globalAlpha = f;
    ctx.fillStyle = '#fff6d0';
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(ta) * L, by + Math.sin(ta) * L);
    ctx.lineTo(bx + Math.cos(ta + Math.PI / 2) * W, by + Math.sin(ta + Math.PI / 2) * W);
    ctx.lineTo(bx - Math.cos(ta) * L * 0.5, by - Math.sin(ta) * L * 0.5);
    ctx.lineTo(bx - Math.cos(ta + Math.PI / 2) * W, by - Math.sin(ta + Math.PI / 2) * W);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e0a83a';
    ctx.lineWidth = Z * 0.8;
    ctx.stroke();
    // estela curva de la hoja
    ctx.globalAlpha = 0.45 * f;
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 3 * Z;
    ctx.beginPath();
    ctx.ellipse(X, cy, R, R * 0.85, 0, a - 0.9, a);
    ctx.stroke();
  }
  // núcleo solar
  ctx.globalAlpha = f;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(X, cy, (4 + 3 * Math.sin(k * Math.PI)) * Z, 0, TAU);
  ctx.fill();
}

/** Rayo quebrado con dos ramas; parpadea (flag 1 = rayo que cae del cielo). */
function drawBolt(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, X2: number, Y2: number, Z: number, k: number, t: number) {
  const f = 1 - k;
  const flick = 0.6 + 0.4 * Math.abs(Math.sin(t * 60 + s.seed));
  const sd = s.seed + Math.floor(k * 4);          // el trazo "salta" 4 veces en su vida
  const y0 = s.flag === 1 ? Y2 - 90 * Z : Y - 6 * Z;
  const x0 = s.flag === 1 ? X2 + (hr(sd, 99) - 0.5) * 20 * Z : X;
  const y1 = Y2 - 6 * Z;
  ctx.globalAlpha = 0.55 * f * flick;
  ctx.strokeStyle = '#b88cff';
  ctx.lineWidth = 5 * Z;
  ctx.beginPath(); jagged(ctx, x0, y0, X2, y1, sd, 9 * Z, 8); ctx.stroke();
  ctx.globalAlpha = f * flick;
  ctx.strokeStyle = '#fff6b0';
  ctx.lineWidth = 2 * Z;
  ctx.beginPath(); jagged(ctx, x0, y0, X2, y1, sd, 9 * Z, 8); ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8 * Z;
  ctx.beginPath(); jagged(ctx, x0, y0, X2, y1, sd, 9 * Z, 8); ctx.stroke();
  // ramas
  ctx.globalAlpha = 0.6 * f * flick;
  ctx.strokeStyle = '#ffe86a';
  ctx.lineWidth = Z;
  for (let b = 0; b < 2; b++) {
    const tt = 0.35 + b * 0.3;
    const bx = x0 + (X2 - x0) * tt, by = y0 + (y1 - y0) * tt;
    const a = Math.atan2(y1 - y0, X2 - x0) + (b === 0 ? 0.8 : -0.8);
    const L = (14 + hr(sd, b + 5) * 12) * Z;
    ctx.beginPath(); jagged(ctx, bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L, sd + b * 13, 4 * Z, 4); ctx.stroke();
  }
  // destello en el punto de impacto
  ctx.globalAlpha = f;
  ctx.fillStyle = '#ffffff';
  star(ctx, X2, y1, 9 * Z * (1 - k * 0.5), 2 * Z, 4, sd);
  ctx.fill();
}

/** Impacto de fuego: columna de llama + lenguas + ascuas. */
function drawPyre(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number, t: number) {
  const f = 1 - k;
  const S = s.size;
  // marca de quemado en el suelo
  ctx.globalAlpha = 0.35 * f;
  ctx.fillStyle = '#2a1408';
  ctx.beginPath(); ctx.ellipse(X, Y, 12 * Z * S, 5 * Z * S, 0, 0, TAU); ctx.fill();
  // lenguas de fuego
  const H = (22 + 16 * Math.sin(Math.min(1, k * 2) * Math.PI / 2)) * Z * S * (1 - k * 0.6);
  for (let j = 0; j < 5; j++) {
    const ox = (j - 2) * 4 * Z * S;
    const h = H * (0.6 + 0.4 * hr(s.seed, j)) * (j === 2 ? 1 : 0.75);
    const sway = Math.sin(t * 14 + j * 1.7) * 2 * Z;
    const cols = ['#d2401c', '#ff9a3c', '#ffe08a'];
    for (let c = 0; c < 3; c++) {
      const w = (5 - c * 1.5) * Z * S;
      const hh = h * (1 - c * 0.25);
      ctx.globalAlpha = f * (0.7 + c * 0.1);
      ctx.fillStyle = cols[c];
      ctx.beginPath();
      ctx.moveTo(X + ox - w, Y);
      ctx.quadraticCurveTo(X + ox - w * 0.6 + sway, Y - hh * 0.55, X + ox + sway * 1.5, Y - hh);
      ctx.quadraticCurveTo(X + ox + w * 0.6 + sway, Y - hh * 0.55, X + ox + w, Y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // ascuas
  ctx.fillStyle = '#ffd27a';
  for (let j = 0; j < 12; j++) {
    const a = -Math.PI / 2 + (hr(s.seed, j + 10) - 0.5) * 1.6;
    const d = (8 + hr(s.seed, j) * 30) * Z * S * easeOut(k);
    ctx.globalAlpha = f * hr(s.seed, j + 30);
    ctx.fillRect(X + Math.cos(a) * d, Y - 6 * Z + Math.sin(a) * d, 1.4 * Z, 1.4 * Z);
  }
}

/** Impacto de hielo: cristales en estrella que brotan del suelo y se quiebran. */
function drawFrost(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number) {
  const grow = easeOut(Math.min(1, k / 0.25));
  const f = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
  const S = s.size;
  // escarcha en el suelo
  ctx.globalAlpha = 0.35 * f;
  ctx.fillStyle = '#dff6ff';
  ctx.beginPath(); ctx.ellipse(X, Y, 16 * Z * S * grow, 7 * Z * S * grow, 0, 0, TAU); ctx.fill();
  // cristales
  const n = 7;
  for (let j = 0; j < n; j++) {
    const a = -Math.PI / 2 + ((j / (n - 1)) - 0.5) * 2.6 + (hr(s.seed, j) - 0.5) * 0.3;
    const L = (10 + hr(s.seed, j + 4) * 12) * Z * S * grow;
    const W = (2.4 + hr(s.seed, j + 8) * 1.6) * Z * S;
    const bx = X + Math.cos(a + Math.PI / 2) * 0, by = Y - 2 * Z;
    const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L * 0.9;
    const pxn = Math.cos(a + Math.PI / 2) * W, pyn = Math.sin(a + Math.PI / 2) * W;
    ctx.globalAlpha = 0.9 * f;
    ctx.fillStyle = '#9ee6ff';
    ctx.beginPath();
    ctx.moveTo(bx + pxn, by + pyn);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx - pxn, by - pyn);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2fcff';                    // cara iluminada
    ctx.beginPath();
    ctx.moveTo(bx + pxn * 0.2, by + pyn * 0.2);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx - pxn, by - pyn);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a9ad8';
    ctx.lineWidth = Z * 0.6;
    ctx.stroke();
  }
  // esquirlas al romperse
  if (k > 0.55) {
    const q = (k - 0.55) / 0.45;
    ctx.fillStyle = '#e8faff';
    for (let j = 0; j < 10; j++) {
      const a = hr(s.seed, j + 40) * TAU;
      const d = (6 + 22 * q) * Z * S;
      ctx.globalAlpha = 1 - q;
      ctx.fillRect(X + Math.cos(a) * d, Y - 8 * Z + Math.sin(a) * d * 0.7 + q * q * 10 * Z, 1.5 * Z, 1.5 * Z);
    }
  }
}

/** Canto Mayor: círculo rúnico doble con notas que gira y se cierra. */
function drawRune(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number, t: number) {
  const c = ELC[s.el];
  const grow = easeOut(Math.min(1, k / 0.35));
  const close = k > 0.7 ? (k - 0.7) / 0.3 : 0;
  const R = 34 * Z * grow * (1 - close * 0.7);
  const rot = t * 2.4 + s.seed;
  ctx.globalAlpha = 0.9 * (1 - close * 0.5);
  ctx.strokeStyle = c[1];
  ctx.lineWidth = 1.6 * Z;
  ctx.beginPath(); ctx.ellipse(X, Y, R, R * 0.55, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = Z;
  ctx.beginPath(); ctx.ellipse(X, Y, R * 0.78, R * 0.43, 0, 0, TAU); ctx.stroke();
  // estrella de seis puntas inscrita
  ctx.globalAlpha = 0.7 * (1 - close * 0.5);
  ctx.strokeStyle = c[0];
  for (let tri = 0; tri < 2; tri++) {
    ctx.beginPath();
    for (let v = 0; v < 3; v++) {
      const a = rot + tri * Math.PI / 3 + (v / 3) * TAU;
      const vx = X + Math.cos(a) * R * 0.78, vy = Y + Math.sin(a) * R * 0.43;
      if (v === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.stroke();
  }
  // notas musicales girando sobre el anillo exterior
  ctx.fillStyle = c[0];
  for (let j = 0; j < 8; j++) {
    const a = -rot * 0.7 + (j / 8) * TAU;
    const nx = X + Math.cos(a) * R * 0.9, ny = Y + Math.sin(a) * R * 0.5;
    ctx.globalAlpha = 0.85 * (1 - close);
    ctx.beginPath(); ctx.ellipse(nx, ny, 1.8 * Z, 1.3 * Z, -0.4, 0, TAU); ctx.fill();
    ctx.fillRect(nx + 1.2 * Z, ny - 5 * Z, 0.7 * Z, 5 * Z);
  }
  // columna de convergencia al cerrarse
  if (close > 0) {
    ctx.globalAlpha = close;
    ctx.fillStyle = c[0];
    ctx.fillRect(X - 2 * Z * (1 - close), Y - 60 * Z * close, 4 * Z * (1 - close) + Z, 60 * Z * close);
  }
}

/** Nova elemental: onda doble + rayos (sigue al círculo rúnico). */
function drawNova(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number) {
  const c = ELC[s.el];
  const e = easeOut(k);
  const f = 1 - k;
  const R = 58 * Z * e * s.size;
  ctx.globalAlpha = 0.3 * f;
  ctx.fillStyle = c[1];
  ctx.beginPath(); ctx.ellipse(X, Y, R, R * 0.6, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.95 * f;
  ctx.strokeStyle = c[0];
  ctx.lineWidth = 3 * Z * f + Z;
  ctx.beginPath(); ctx.ellipse(X, Y, R, R * 0.6, 0, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.6 * f;
  ctx.strokeStyle = c[2];
  ctx.lineWidth = 2 * Z;
  ctx.beginPath(); ctx.ellipse(X, Y, R * 0.7, R * 0.42, 0, 0, TAU); ctx.stroke();
  // rayos elementales
  ctx.strokeStyle = c[1];
  ctx.lineWidth = 1.5 * Z;
  for (let j = 0; j < 10; j++) {
    const a = (j / 10) * TAU + hr(s.seed, j) * 0.3;
    const r0 = R * 0.3, r1 = R * (0.9 + hr(s.seed, j + 3) * 0.4);
    ctx.globalAlpha = 0.8 * f;
    ctx.beginPath();
    ctx.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0 * 0.6);
    ctx.lineTo(X + Math.cos(a) * r1, Y + Math.sin(a) * r1 * 0.6);
    ctx.stroke();
  }
}

/** Subida de nivel: pilar de luz dorada con runas que ascienden. */
function drawPillar(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number, t: number) {
  const env = Math.sin(Math.min(1, k) * Math.PI);
  const W = 10 * Z * (0.5 + 0.5 * env);
  const H = 120 * Z;
  const gr = ctx.createLinearGradient(X, Y, X, Y - H);
  gr.addColorStop(0, 'rgba(255,236,150,0.85)');
  gr.addColorStop(0.6, 'rgba(255,236,150,0.35)');
  gr.addColorStop(1, 'rgba(255,236,150,0)');
  ctx.globalAlpha = env;
  ctx.fillStyle = gr;
  ctx.fillRect(X - W, Y - H, W * 2, H);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(X - W * 0.25, Y - H, W * 0.5, H);
  // anillo en el suelo
  ctx.strokeStyle = '#ffe08a';
  ctx.lineWidth = 1.5 * Z;
  ctx.beginPath(); ctx.ellipse(X, Y, 16 * Z * (0.6 + 0.4 * env), 6 * Z * (0.6 + 0.4 * env), 0, 0, TAU); ctx.stroke();
  // runas ascendentes (rombos)
  ctx.fillStyle = '#fff2b0';
  for (let j = 0; j < 10; j++) {
    const ph = (hr(s.seed, j) + k * 1.4) % 1;
    const ry = Y - ph * H * 0.8;
    const rx = X + Math.sin(t * 3 + j * 1.9) * (W + 6 * Z);
    ctx.globalAlpha = env * (1 - ph);
    ctx.beginPath();
    ctx.moveTo(rx, ry - 2.5 * Z); ctx.lineTo(rx + 1.6 * Z, ry); ctx.lineTo(rx, ry + 2.5 * Z); ctx.lineTo(rx - 1.6 * Z, ry);
    ctx.closePath(); ctx.fill();
  }
}

/** Caída de jefe: rayos giratorios, triple onda, columna y destello final. */
function drawBossDeath(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number, t: number) {
  const cy = Y - 8 * Z;
  const c = ELC[s.el];
  // fase 1 (0-0.45): rayos de luz que giran y crecen desde el cuerpo
  const p1 = Math.min(1, k / 0.45);
  const f = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
  const rot = t * 0.9 + s.seed;
  ctx.globalAlpha = 0.55 * f;
  ctx.fillStyle = c[0];
  for (let j = 0; j < 14; j++) {
    const a = rot + (j / 14) * TAU;
    const L = (30 + 110 * easeOut(p1)) * Z * (0.6 + 0.4 * hr(s.seed, j));
    const w = 0.07 + 0.05 * hr(s.seed, j + 5);
    ctx.beginPath();
    ctx.moveTo(X, cy);
    ctx.lineTo(X + Math.cos(a - w) * L, cy + Math.sin(a - w) * L);
    ctx.lineTo(X + Math.cos(a + w) * L, cy + Math.sin(a + w) * L);
    ctx.closePath();
    ctx.fill();
  }
  // fase 2: tres ondas de choque
  for (let w = 0; w < 3; w++) {
    const kk = (k - 0.3 - w * 0.12) / 0.5;
    if (kk <= 0 || kk >= 1) continue;
    ctx.globalAlpha = 0.85 * (1 - kk);
    ctx.strokeStyle = w === 1 ? c[1] : '#ffffff';
    ctx.lineWidth = (4 - w) * Z;
    ctx.beginPath(); ctx.ellipse(X, Y, 140 * Z * easeOut(kk), 70 * Z * easeOut(kk), 0, 0, TAU); ctx.stroke();
  }
  // columna que sube al cielo
  const colA = Math.sin(Math.min(1, k * 1.4) * Math.PI) * f;
  if (colA > 0.01) {
    const W = 14 * Z;
    const gr = ctx.createLinearGradient(X, Y, X, Y - 220 * Z);
    gr.addColorStop(0, 'rgba(255,250,230,0.9)');
    gr.addColorStop(1, 'rgba(255,250,230,0)');
    ctx.globalAlpha = colA;
    ctx.fillStyle = gr;
    ctx.fillRect(X - W, Y - 220 * Z, W * 2, 220 * Z);
  }
  // núcleo que late y se apaga
  ctx.globalAlpha = f;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(X, cy, (10 + 6 * Math.sin(k * 20)) * Z * (1 - k), 0, TAU); ctx.fill();
}

/** Parada perfecta: chispa cruzada azul-blanca + anillo. */
function drawParry(ctx: CanvasRenderingContext2D, s: VfxSlot, X: number, Y: number, Z: number, k: number) {
  const f = 1 - k;
  const e = easeOut(k);
  ctx.globalAlpha = f;
  ctx.fillStyle = '#ffffff';
  star(ctx, X, Y - 6 * Z, 14 * Z * (0.5 + e), 1.6 * Z, 4, Math.PI / 4);
  ctx.fill();
  ctx.fillStyle = '#bfe4ff';
  star(ctx, X, Y - 6 * Z, 9 * Z * (0.5 + e), 1.2 * Z, 4, 0);
  ctx.fill();
  ctx.strokeStyle = '#8fd0ff';
  ctx.lineWidth = 1.6 * Z;
  ctx.globalAlpha = 0.8 * f;
  ctx.beginPath(); ctx.arc(X, Y - 6 * Z, 20 * Z * e, 0, TAU); ctx.stroke();
}

/** Aura de Grito de Guerra mientras dura el buff (rem = segundos restantes). */
export function drawWarcryAura(ctx: CanvasRenderingContext2D, X: number, Y: number, Z: number, t: number, rem: number): void {
  const a = Math.min(1, rem / 1.2);                // se apaga en el último segundo
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  halo(ctx, X, Y - 8 * Z, 22 * Z, '#ff7a2a', 0.28 * a);
  ctx.globalCompositeOperation = 'source-over';
  // lenguas de fuego que lamen la silueta
  for (let j = 0; j < 5; j++) {
    const ph = t * 6 + j * 1.3;
    const ox = (j - 2) * 3.2 * Z + Math.sin(ph) * Z;
    const h = (7 + 4 * Math.sin(ph * 1.7)) * Z;
    const by = Y + 1 * Z;
    ctx.globalAlpha = 0.55 * a;
    ctx.fillStyle = j % 2 ? '#ff9a3c' : '#ffd27a';
    ctx.beginPath();
    ctx.moveTo(X + ox - 1.6 * Z, by);
    ctx.quadraticCurveTo(X + ox, by - h * 0.6, X + ox + Math.sin(ph * 2) * Z, by - h);
    ctx.quadraticCurveTo(X + ox + 0.5 * Z, by - h * 0.5, X + ox + 1.6 * Z, by);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
