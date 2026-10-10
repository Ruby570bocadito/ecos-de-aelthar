// ============================================================
// ECOS DE AELTHAR — Pase de VOLUMEN para sprites ya horneados (R18)
//
// Los humanoides (NPCs y enemigos con forma de persona) se dibujan con
// paletas planas de 3-4 tonos. Este pase, aplicado UNA vez al hornear,
// les da cuerpo con la misma luz que el Portador v4 (arriba-izquierda):
//  · sombreado cilíndrico por fila: el borde izquierdo de cada tramo
//    opaco se aclara hacia un blanco cálido y el derecho se oscurece
//    hacia un violeta frío (desplazamiento de tono, no gris);
//  · degradado vertical suave: cabeza y hombros reciben más luz que las
//    botas (la figura «se asienta» en el suelo);
//  · los contornos (píxeles muy oscuros) y los detalles de 1 px muy
//    saturados (ojos, emblemas) no se tocan, así la lectura no cambia.
// Coste en runtime = 0: los frames resultantes son canvas normales.
// ============================================================

const LIGHT = [255, 240, 214];
const SHADE = [26, 18, 48];

function lum(r: number, g: number, b: number): number {
  return 0.3 * r + 0.59 * g + 0.11 * b;
}

/** Aplica el pase de volumen al canvas (in place). */
export function volumize(c: HTMLCanvasElement, strength = 1): void {
  const x = c.getContext('2d');
  if (!x) return;
  const w = c.width, h = c.height;
  if (w < 4 || h < 4) return;
  let img: ImageData | undefined;
  try { img = x.getImageData(0, 0, w, h); } catch { return; } // canvas «tainted» o stub de tests
  const d = img?.data;
  if (!d || d.length < w * h * 4) return;
  let top = h, bot = -1;
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < w; i++) {
      if (d[(y * w + i) * 4 + 3] > 0) { if (y < top) top = y; bot = y; break; }
    }
  }
  if (bot < top) return;
  const span = Math.max(1, bot - top);
  for (let y = top; y <= bot; y++) {
    const v = (y - top) / span;
    const kv = (0.07 - v * 0.15) * strength;
    let i = 0;
    while (i < w) {
      while (i < w && d[(y * w + i) * 4 + 3] < 128) i++;
      if (i >= w) break;
      const a = i;
      while (i < w && d[(y * w + i) * 4 + 3] >= 128) i++;
      const b = i - 1;
      const len = b - a;
      for (let k = a; k <= b; k++) {
        const o = (y * w + k) * 4;
        const r = d[o], g = d[o + 1], bl = d[o + 2];
        const L = lum(r, g, bl);
        if (L < 44) continue; // contorno: intacto
        const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
        if (len >= 2 && mx - mn > 150 && mx > 200) continue; // brillo saturado de 1 px (ojos, gemas)
        let kk = kv;
        if (len >= 3) {
          const u = (k - a) / len;
          if (u < 0.3) kk += 0.12 * (1 - u / 0.3) * strength;
          else if (u > 0.6) kk -= 0.2 * ((u - 0.6) / 0.4) * strength;
        }
        if (kk > 0) {
          d[o] = r + (LIGHT[0] - r) * kk;
          d[o + 1] = g + (LIGHT[1] - g) * kk;
          d[o + 2] = bl + (LIGHT[2] - bl) * kk;
        } else if (kk < 0) {
          const q = -kk;
          d[o] = r + (SHADE[0] - r) * q;
          d[o + 1] = g + (SHADE[1] - g) * q;
          d[o + 2] = bl + (SHADE[2] - bl) * q;
        }
      }
    }
  }
  x.putImageData(img!, 0, 0);
}

/** Aplica el pase a una lista de frames (devuelve la misma lista). */
export function volumizeAll<T extends HTMLCanvasElement[]>(frames: T, strength = 1): T {
  for (const f of frames) volumize(f, strength);
  return frames;
}
