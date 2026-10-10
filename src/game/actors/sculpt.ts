// ============================================================
// ECOS DE AELTHAR — ESCULTOR DE PÍXELES (R18)
//
// Utilidad genérica para criaturas: se «esculpe» con MATERIALES (no con
// colores) sobre un búfer, y un pase automático da volumen:
//   · luz arriba-izquierda (tono claro cálido) y sombra abajo-derecha
//     (tono oscuro frío) en cada borde de material;
//   · brillo especular en materiales duros (caparazón, hielo, hueso);
//   · contorno SELECTIVO: el borde exterior toma el tono más oscuro del
//     material vecino (sel-out), no una línea negra plana;
//   · píxeles de detalle con color fijo (ojos, runas, brillos).
// Es la misma técnica del Portador v4 (hero.ts), abierta a cualquier tamaño.
// ============================================================

import { mkCanvas } from './util';

export interface Ramp { hi: string; base: string; sh: string; out: string; hard?: boolean; flat?: boolean; soft?: boolean }

function rgb(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function mixC(a: string, b: string, k: number): string {
  const A = rgb(a), B = rgb(b);
  return hex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
}
export function mulC(a: string, f: number): string {
  const A = rgb(a);
  return hex(A[0] * f, A[1] * f, A[2] * f);
}
/** Rampa de tonos con desplazamiento de matiz (luces cálidas, sombras frías). */
export function ramp(base: string, opts?: { hard?: boolean; flat?: boolean; hiK?: number; shK?: number }): Ramp {
  const hiK = opts?.hiK ?? (opts?.hard ? 1.35 : 1.22), shK = opts?.shK ?? (opts?.hard ? 0.6 : 0.68);
  return {
    hi: mixC(mulC(base, hiK), '#fff2cc', 0.14),
    base,
    sh: mixC(mulC(base, shK), '#2a2450', 0.16),
    out: mixC(mulC(base, 0.34), '#120a1c', 0.45),
    hard: opts?.hard, flat: opts?.flat,
  };
}

// ---------------------------------------------------------------- R19 · luz v2
/** Opciones del sombreado v2 (normales desde la silueta). */
export interface Light2 {
  /** Color de luz de borde (contraluz) en los bordes abajo-derecha; null = sin rim. */
  rim?: string | null;
  /** Intensidad del rim (0..1). */
  rimK?: number;
  /** Radio del abombado global (px). Más grande = formas más redondas. */
  bulge?: number;
  /** Sombra de contacto bajo los cambios de material (oclusión). */
  ao?: boolean;
  /** Contorno exterior (sel-out). */
  outline?: boolean;
}

interface Tones5 { hi2: string; hi: string; base: string; sh: string; sh2: string; out: string; outL: string }
const T5 = new WeakMap<Ramp, Tones5>();
function tones5(T: Ramp): Tones5 {
  let t = T5.get(T);
  if (!t) {
    t = {
      hi2: mixC(T.hi, '#fffbe8', T.hard ? 0.55 : 0.32),
      hi: T.hi, base: T.base, sh: T.sh,
      sh2: mixC(mulC(T.sh, 0.76), '#1a1438', 0.22),
      out: T.out,
      outL: mixC(T.out, T.sh, 0.45),
    };
    T5.set(T, t);
  }
  return t;
}

const LX = -0.476, LY = -0.667, LZ = 0.571; // luz arriba-izquierda, hacia el espectador

/** Distancia (chaflán 8-vecinos) de cada píxel lleno a la condición `edge` (cap). */
function distField(W: number, H: number, inside: (i: number) => boolean, same: (i: number, j: number) => boolean, cap: number): Float32Array {
  const d = new Float32Array(W * H);
  const INF = cap;
  for (let i = 0; i < W * H; i++) d[i] = inside(i) ? INF : 0;
  const D1 = 1, D2 = 1.414;
  // pasada hacia delante
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (d[i] === 0) continue;
    let v = d[i];
    const nb = (xx: number, yy: number, w: number) => {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) { v = Math.min(v, w * 0.5); return; }
      const j = yy * W + xx;
      if (!same(i, j)) { v = Math.min(v, w * 0.5); return; }
      v = Math.min(v, d[j] + w);
    };
    nb(x - 1, y, D1); nb(x, y - 1, D1); nb(x - 1, y - 1, D2); nb(x + 1, y - 1, D2);
    d[i] = v;
  }
  // pasada hacia atrás
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (d[i] === 0) continue;
    let v = d[i];
    const nb = (xx: number, yy: number, w: number) => {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) { v = Math.min(v, w * 0.5); return; }
      const j = yy * W + xx;
      if (!same(i, j)) { v = Math.min(v, w * 0.5); return; }
      v = Math.min(v, d[j] + w);
    };
    nb(x + 1, y, D1); nb(x, y + 1, D1); nb(x + 1, y + 1, D2); nb(x - 1, y + 1, D2);
    d[i] = v;
  }
  return d;
}

export class Sculpt {
  readonly w: number; readonly h: number;
  m: Uint8Array;
  det: (string | null)[];
  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.m = new Uint8Array(w * h);
    this.det = new Array(w * h).fill(null);
  }
  set(x: number, y: number, mat: number) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.m[y * this.w + x] = mat; this.det[y * this.w + x] = null;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.m[y * this.w + x];
  }
  fill(x: number, y: number, w: number, h: number, mat: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, mat);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, mat: number) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1) this.set(x, y, mat);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, mat: number, thick = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let k = 0; k < 400; k++) {
      for (let t = 0; t < thick; t++) this.set(x0 + (dy < -dx ? t : 0), y0 + (dy < -dx ? 0 : t), mat);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Triángulo relleno (alas, picos, cuernos). */
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, mat: number) {
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(area) < 0.01) return;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area;
      const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) this.set(x, y, mat);
    }
  }
  /** Píxel de detalle con color fijo. */
  dot(x: number, y: number, c: string) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (this.m[y * this.w + x] === 0) this.m[y * this.w + x] = 255;
    this.det[y * this.w + x] = c;
  }

  /**
   * R19 · sombreado v2: cada píxel recibe una NORMAL calculada desde la
   * silueta global y la de su material (campo de distancias → altura →
   * gradiente). Con luz arriba-izquierda da 5 tonos por material (brillo,
   * luz, base, sombra, sombra profunda), sombra de contacto bajo los cambios
   * de material, brillo especular en materiales duros, contraluz opcional y
   * contorno selectivo más suave del lado de la luz.
   */
  render2(pal: Ramp[], opt: Light2 = {}): HTMLCanvasElement {
    return paintColors(this.w, this.h, this.shade2(pal, opt));
  }

  /** Colores del sombreado v2 (sin volcar a canvas): útil para componer. */
  shade2(pal: Ramp[], opt: Light2 = {}): (string | null)[] {
    const W = this.w, H = this.h, m = this.m;
    const bulge = opt.bulge ?? Math.max(3, Math.min(8, Math.round(Math.min(W, H) / 6)));
    const filled = (i: number) => m[i] !== 0;
    const dS = distField(W, H, filled, (_i, j) => m[j] !== 0, bulge);
    const dM = distField(W, H, filled, (i, j) => m[j] === m[i] || m[j] === 255 || m[i] === 255, 3);
    const hgt = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (!m[i]) continue;
      const a = Math.min(dS[i], bulge) / bulge, b = Math.min(dM[i], 3) / 3;
      hgt[i] = Math.sqrt(1 - (1 - a) * (1 - a)) * bulge * 0.9 + Math.sqrt(1 - (1 - b) * (1 - b)) * 1.6;
    }
    // suavizado 3×3 dentro de la silueta: quita el moteado de los tonos
    {
      const tmp = new Float32Array(hgt);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!m[i]) continue;
        let s = 0, n = 0;
        for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
          const xx = x + k, yy = y + j;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const q = yy * W + xx;
          if (!m[q]) continue;
          const wgt = j === 0 && k === 0 ? 2 : 1;
          s += tmp[q] * wgt; n += wgt;
        }
        hgt[i] = s / n;
      }
    }
    const hAt = (x: number, y: number, fb: number) => (x < 0 || y < 0 || x >= W || y >= H || !m[y * W + x]) ? fb : hgt[y * W + x];
    const out: (string | null)[] = new Array(W * H).fill(null);
    const rimC = opt.rim ?? null, rimK = opt.rimK ?? 0.3;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, mat = m[i];
      if (!mat) continue;
      const d = this.det[i];
      if (d) { out[i] = d; continue; }
      const T = pal[mat];
      if (!T) continue;
      if (T.flat) { out[i] = T.base; continue; }
      const t = tones5(T);
      const h0 = hgt[i];
      const gx = (hAt(x + 1, y, h0 - 1.2) - hAt(x - 1, y, h0 - 1.2)) * 0.5;
      const gy = (hAt(x, y + 1, h0 - 1.2) - hAt(x, y - 1, h0 - 1.2)) * 0.5;
      let nx = -gx, ny = -gy, nz = 1.15;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      let diff = nx * LX + ny * LY + nz * LZ;
      // sombra de contacto: bajo otro material (cuello bajo la cabeza, falda bajo el cinturón…)
      if (opt.ao !== false) {
        const up = y > 0 ? m[i - W] : 0;
        if (up && up !== mat && up !== 255) diff -= 0.2;
      }
      let c: string;
      if (T.soft) {
        // piel: 3 tonos amplios (nada de sombra profunda moteando la cara)
        c = diff > 0.8 ? t.hi : diff > 0.2 ? t.base : t.sh;
      } else if (diff > (T.hard ? 0.86 : 0.93)) c = t.hi2;
      else if (diff > 0.74) c = t.hi;
      else if (diff > 0.42) c = t.base;
      else if (diff > 0.12) c = t.sh;
      else c = t.sh2;
      // contraluz: borde abajo-derecha que da a vacío
      if (rimC) {
        const er = x + 1 >= W || !m[i + 1], eb = y + 1 >= H || !m[i + W];
        if ((er || eb) && diff < 0.5) c = mixC(c, rimC, rimK);
      }
      out[i] = c;
    }
    if (opt.outline !== false) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (m[i] !== 0) continue;
        // vecino lleno: preferimos abajo/derecha (el contorno «de sombra»)
        let nm = 0, lit = false;
        const below = y + 1 < H ? m[i + W] : 0, right = x + 1 < W ? m[i + 1] : 0;
        const left = x > 0 ? m[i - 1] : 0, above = y > 0 ? m[i - W] : 0;
        if (below && below !== 255) { nm = below; lit = true; }
        else if (right && right !== 255) { nm = right; lit = true; }
        else if (left && left !== 255) nm = left;
        else if (above && above !== 255) nm = above;
        if (!nm) continue;
        const T = pal[nm];
        if (!T) { out[i] = '#100818'; continue; }
        const t = tones5(T);
        out[i] = lit ? t.outL : t.out;
      }
    }
    return out;
  }

  /** Sombrea, contornea y vuelca a un canvas. `pal[mat]` = rampa del material. */
  render(pal: Ramp[], outlineAll = true): HTMLCanvasElement {
    const W = this.w, H = this.h;
    const out: (string | null)[] = new Array(W * H).fill(null);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const m = this.m[y * W + x];
        if (m === 0) continue;
        const d = this.det[y * W + x];
        if (d) { out[y * W + x] = d; continue; }
        const T = pal[m];
        if (!T) continue;
        if (T.flat) { out[y * W + x] = T.base; continue; }
        const lft = this.get(x - 1, y) !== m, top = this.get(x, y - 1) !== m;
        const rgt = this.get(x + 1, y) !== m, bot = this.get(x, y + 1) !== m;
        const hi = lft || top, sh = rgt || bot;
        let c = T.base;
        if (hi && !sh) c = T.hi;
        else if (sh && !hi) c = T.sh;
        else if (hi && sh) c = (lft && top) ? T.hi : (rgt && bot) ? T.sh : T.base;
        if (T.hard && !hi && !sh && this.get(x - 1, y - 1) !== m) c = mixC(T.hi, '#ffffff', 0.45);
        out[y * W + x] = c;
      }
    }
    if (outlineAll) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (this.m[y * W + x] !== 0) continue;
          let nm = 0;
          for (const c of [this.get(x, y + 1), this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1)]) if (c !== 0 && c !== 255) { nm = c; break; }
          if (nm === 0) continue;
          out[y * W + x] = pal[nm]?.out ?? '#100818';
        }
      }
    }
    const { c, x } = mkCanvas(W, H);
    for (let y = 0; y < H; y++) {
      let run = 0, runC: string | null = null, runX = 0;
      for (let i = 0; i <= W; i++) {
        const col = i < W ? out[y * W + i] : null;
        if (col === runC && col !== null) { run++; continue; }
        if (runC !== null && run > 0) { x.fillStyle = runC; x.fillRect(runX, y, run, 1); }
        runC = col; runX = i; run = col !== null ? 1 : 0;
      }
    }
    return c;
  }
}

/** Vuelca una matriz de colores a canvas (por tramos horizontales). */
export function paintColors(W: number, H: number, out: (string | null)[]): HTMLCanvasElement {
  const { c, x } = mkCanvas(W, H);
  for (let y = 0; y < H; y++) {
    let run = 0, runC: string | null = null, runX = 0;
    for (let i = 0; i <= W; i++) {
      const col = i < W ? out[y * W + i] : null;
      if (col === runC && col !== null) { run++; continue; }
      if (runC !== null && run > 0) { x.fillStyle = runC; x.fillRect(runX, y, run, 1); }
      runC = col; runX = i; run = col !== null ? 1 : 0;
    }
  }
  return c;
}
