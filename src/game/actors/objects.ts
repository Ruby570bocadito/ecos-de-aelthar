// ============================================================
// ECOS DE AELTHAR — Objetos pixel (módulo actors)
// Cofre, santuario, fragmento, wisp. Generación procedural.
// ============================================================

import { mkCanvas, px, type Frames } from './util';

// ---------------- Objetos ----------------

export function buildChest(): { closed: Frames; open: Frames } {
  const mk = (open: boolean) => {
    const { c, x } = mkCanvas(16, 14);
    const O = '#3a2414', W = '#8a5a2b', W2 = '#6d4520', G = '#f0c84a';
    px(x, 2, open ? 5 : 3, 12, open ? 8 : 9, W);
    px(x, 2, open ? 5 : 3, 12, 2, W2);
    px(x, 2, open ? 12 : 10, 12, 1, O);
    px(x, 1, 3, 14, 1, O); px(x, 1, 12, 14, 1, O);
    px(x, 7, open ? 8 : 6, 2, 3, G);
    if (open) {
      px(x, 2, 1, 12, 3, W2);           // tapa abierta
      px(x, 3, 4, 10, 2, '#fff3c0');    // brillo interior
      px(x, 4, 5, 8, 1, G);
    } else {
      px(x, 2, 3, 12, 2, W2);
    }
    return c;
  };
  return { closed: [mk(false)], open: [mk(true)] };
}

export function buildSanctuary(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(20, 30);
    const O = '#1c2438', S = '#5a6a8a', S2 = '#42506c';
    px(x, 7, 4, 6, 24, S);
    px(x, 7, 4, 2, 24, S2);
    px(x, 6, 2, 8, 3, S2);
    px(x, 5, 27, 10, 3, S2); px(x, 4, 28, 12, 2, O);
    const g = f === 0 ? '#8ef0ff' : '#d4fbff';
    x.globalAlpha = 0.9;
    px(x, 8, 6 + f, 4, 7, g);
    x.globalAlpha = 0.4;
    px(x, 7, 5 + f, 6, 9, g);
    x.globalAlpha = 1;
    px(x, 9, 14, 2, 10, '#7a8aac');
    frames.push(c);
  }
  return frames;
}

export function buildFragment(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = mkCanvas(12, 12);
    const G = '#ffe9a0', G2 = '#f0c84a';
    if (f === 0) { px(x, 5, 1, 3, 10, G2); px(x, 5, 2, 3, 8, G); }
    if (f === 1) { px(x, 3, 2, 6, 8, G2); px(x, 4, 3, 4, 6, G); }
    if (f === 2) { px(x, 2, 3, 8, 6, G2); px(x, 3, 4, 6, 4, G); }
    px(x, 5, 4, 2, 2, '#fffbe0');
    frames.push(c);
  }
  return frames;
}

export function buildWisp(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(10, 10);
    x.globalAlpha = 0.9; px(x, 3, 3 + f, 4, 4, '#bff4e8');
    x.globalAlpha = 0.5; px(x, 2, 2 + f, 6, 6, '#7fe0cc');
    x.globalAlpha = 1; px(x, 4, 4 + f, 2, 2, '#ffffff');
    frames.push(c);
  }
  return frames;
}
