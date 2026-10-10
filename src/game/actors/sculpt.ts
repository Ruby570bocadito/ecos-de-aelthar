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

export interface Ramp { hi: string; base: string; sh: string; out: string; hard?: boolean; flat?: boolean }

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
