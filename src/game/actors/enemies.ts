// ============================================================
// ECOS DE AELTHAR — Enemigos pixel (módulo actors)
// Lobo de niebla y Guardián Hueco. Generación procedural.
// ============================================================

import { mkCanvas, px, type Frames } from './util';

// ---------------- Lobo de niebla (18×12) ----------------

export function buildWolf(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(18, 12);
    const O = '#26243a', B = '#7d7d9f', BS = '#5c5c80', W = '#a7a7c4';
    px(x, 3, 3, 10, 5, B);            // cuerpo
    px(x, 3, 3, 10, 1, W);
    px(x, 2, 7, 12, 1, O);
    px(x, 11, 1, 4, 5, B);            // cabeza
    px(x, 13, 0, 1, 2, B);            // oreja
    px(x, 12, 0, 1, 2, BS);
    px(x, 14, 3, 3, 2, BS);           // hocico
    px(x, 12, 2, 1, 1, '#ff6a4d');    // ojo
    px(x, 16, 4, 1, 1, O);
    px(x, 0, 2, 3, 2, BS);            // cola
    px(x, 0, 1, 1, 2, BS);
    const ly = f === 0 ? 8 : 9;
    px(x, 4, ly, 2, 3, BS); px(x, 7, f === 0 ? 9 : 8, 2, 3, BS);
    px(x, 10, ly, 2, 3, BS); px(x, 12, f === 0 ? 9 : 8, 2, 3, BS);
    // niebla
    x.globalAlpha = 0.35;
    px(x, 1 + f, 9, 3, 2, W); px(x, 13 - f, 8, 4, 2, W);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Guardián Hueco (32×34) ----------------

export function buildGuardian(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(32, 34);
    const O = '#141220', S = '#4a4660', S2 = '#5f5a7a', HL = '#8a84a8';
    const GLOW = f === 0 ? '#7ee8ff' : '#baf4ff';
    // capa
    px(x, 8, 14, 16, 12, '#2c2440');
    px(x, 7, 22 + f, 3, 6, '#221c33'); px(x, 22, 21 - f, 3, 6, '#221c33');
    // hombros
    px(x, 2, 12, 8, 6, S2); px(x, 22, 12, 8, 6, S2);
    px(x, 2, 12, 8, 1, HL); px(x, 22, 12, 8, 1, HL);
    // torso con hueco
    px(x, 9, 12, 14, 13, S);
    px(x, 9, 12, 14, 1, HL);
    px(x, 13, 16, 6, 6, O);            // hueco
    px(x, 14, 17, 4, 4, GLOW);         // brillo interior
    // astillas/cracks
    px(x, 10, 14, 1, 4, O); px(x, 21, 18, 1, 5, O); px(x, 16, 24, 3, 1, O);
    // cabeza/casco con cuernos
    px(x, 11, 4, 10, 8, S2);
    px(x, 11, 4, 10, 1, HL);
    px(x, 9, 2, 2, 6, HL); px(x, 21, 2, 2, 6, HL);   // cuernos
    px(x, 8, 1, 2, 3, HL); px(x, 22, 1, 2, 3, HL);
    px(x, 13, 7, 2, 2, GLOW); px(x, 17, 7, 2, 2, GLOW); // ojos
    // brazos y garras
    const ay = f === 0 ? 18 : 16;
    px(x, 0, ay, 3, 9, S2); px(x, 29, ay, 3, 9, S2);
    px(x, 0, ay + 9, 3, 2, O); px(x, 29, ay + 9, 3, 2, O);
    // fragmentos flotantes
    x.globalAlpha = 0.8;
    px(x, 5, 27 + f, 2, 2, S2); px(x, 25, 28 - f, 2, 2, S2); px(x, 15, 30, 2, 2, S2);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
