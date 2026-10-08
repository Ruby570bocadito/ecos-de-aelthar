// ============================================================
// ECOS DE AELTHAR — Humanoides pixel (módulo actors)
// HumanPal, layout, fotogramas de andar (3 fases), frameIndex,
// entityFrame. Generación procedural, sin assets.
// ============================================================

import { mkCanvas, px, type Frames } from './util';

export interface HumanPal {
  outline: string;
  hair: string; hairS?: string;
  skin: string;
  body: string; bodyS: string;
  accent: string;
  legs: string; legsS?: string;
  boots: string;
  eye: string;
  hood?: boolean;
  ribs?: boolean;
  beard?: string;
  // --- rasgos del agente 3-a (biblia de personajes) ---
  small?: boolean;          // niño (Teo): proporciones compactas
  big?: boolean;            // Gran Inquisidor: escala ×2 (32×36)
  ears?: 'cat' | 'elf';     // orejas felinas / élficas
  mask?: boolean;           // máscara lisa sin boca (Gran Inquisidor)
  maskC?: string;           // color de la máscara
  hammer?: boolean;         // martillo en la mano (Brokk)
  hairLong?: boolean;       // melena larga (Maelis, Nimue)
  pauldrons?: boolean;      // hombreras (Kael)
  leafy?: boolean;          // hojas en hombros (Doran)
  messy?: boolean;          // pelo revuelto (Teo)
}

interface Layout {
  H: number;        // alto del canvas
  headTop: number;  // fila de la masa de pelo
  faceTop: number;  // fila de piel
  bodyTop: number;  // fila del torso
  bodyH: number;    // filas de torso (incluye fila de contorno)
  armLen: number;   // largo del brazo sin mano
}

export function layoutFor(pal: HumanPal): Layout {
  if (pal.small) return { H: 15, headTop: 0, faceTop: 3, bodyTop: 7, bodyH: 4, armLen: 3 };
  return { H: 18, headTop: 1, faceTop: 4, bodyTop: 8, bodyH: 6, armLen: 4 };
}

/**
 * Dibuja un fotograma humanoide. f = fase de andar (0 zancada A,
 * 1 pase —cuerpo elevado 1px—, 2 zancada B). En reposo se usa f=1
 * sin bob para una pose neutra de pie.
 */
export function drawHumanFrame(
  x: CanvasRenderingContext2D, pal: HumanPal,
  dir: 'down' | 'up' | 'side', f: number, bob: number, L: Layout,
): void {
  const hs = pal.hairS ?? pal.hair;
  const ls = pal.legsS ?? pal.legs;
  const hT = L.headTop + bob;
  const fT = L.faceTop + bob;
  const bT = L.bodyTop + bob;
  const bodyBot = bT + L.bodyH - 1;           // última fila del torso (contorno)
  const legY = bodyBot + 1;                    // piernas ancladas al suelo
  const bootY = L.H - 1;
  const legH = bootY - legY;                   // filas de pierna antes de la bota

  // balanceo de brazos (contrario entre izquierda y derecha)
  const offL = [1, 0, -1][f];
  const offR = [-1, 0, 1][f];

  if (dir === 'down' || dir === 'up') {
    // ---------- cabeza ----------
    px(x, 4, hT, 8, 1, pal.outline);
    px(x, 3, hT + 1, 10, 5, pal.hair);
    px(x, 3, hT + 1, 10, 1, hs);
    if (pal.hood) { px(x, 3, fT + 2, 10, 2, pal.hair); px(x, 4, fT + 3, 8, 1, hs); }
    if (dir === 'down') {
      px(x, 5, fT, 6, 4, pal.mask ? (pal.maskC ?? pal.skin) : pal.skin);
      if (!pal.mask) {
        px(x, 6, fT + 1, 1, 2, pal.eye); px(x, 9, fT + 1, 1, 2, pal.eye);
        if (pal.beard) px(x, 5, fT + 3, 6, 2, pal.beard);
      } else {
        // máscara lisa: solo un brillo horizontal, sin boca ni ojos
        px(x, 6, fT + 1, 4, 1, '#eae6dc');
      }
      px(x, 3, fT + 2, 1, 2, pal.hair); px(x, 12, fT + 2, 1, 2, pal.hair);
      if (pal.ears === 'elf') { px(x, 2, fT + 1, 1, 2, pal.skin); px(x, 13, fT + 1, 1, 2, pal.skin); }
      if (pal.hairLong) { px(x, 3, fT + 4, 2, Math.max(1, bT - fT - 3), pal.hair); px(x, 11, fT + 4, 2, Math.max(1, bT - fT - 3), pal.hair); }
    }
    if (pal.ears === 'cat') {
      // orejas felinas sobre la cabeza (filas fijas para que no "floten")
      px(x, 3, 0, 1, 1, hs); px(x, 12, 0, 1, 1, hs);
      px(x, 3, 1, 2, 1, pal.hair); px(x, 11, 1, 2, 1, pal.hair);
    }
    if (pal.messy) {
      // pelo revuelto (mechones sueltos)
      px(x, 2, hT + 1, 1, 1, pal.hair); px(x, 13, hT + 1, 1, 1, pal.hair);
      px(x, 5, Math.max(0, hT - 1), 2, 1, pal.hair); px(x, 9, Math.max(0, hT - 1), 3, 1, pal.hair);
    }

    // ---------- torso ----------
    px(x, 4, bT, 8, L.bodyH, pal.body);
    px(x, 4, bT, 8, 1, pal.bodyS);
    px(x, 5, bT + L.bodyH - 2, 6, 1, pal.accent);
    px(x, 4, bodyBot, 8, 1, pal.outline);
    if (pal.ribs) { px(x, 6, bT + 1, 4, 1, pal.bodyS); px(x, 6, bT + 2, 4, 1, pal.bodyS); }
    if (pal.pauldrons) { px(x, 3, bT, 2, 2, pal.accent); px(x, 11, bT, 2, 2, pal.accent); }
    if (pal.leafy) { px(x, 3, bT, 2, 1, '#8ac05a'); px(x, 11, bT, 2, 1, '#8ac05a'); }

    // ---------- brazos (oscilación) ----------
    px(x, 2, bT + offL, 2, L.armLen, pal.body); px(x, 2, bT + offL + L.armLen, 2, 1, pal.skin);
    px(x, 12, bT + offR, 2, L.armLen, pal.body); px(x, 12, bT + offR + L.armLen, 2, 1, pal.skin);
    if (pal.hammer) {
      // martillo en la mano derecha
      px(x, 13, bT + offR - 2, 1, L.armLen + 1, '#7a5c3a');
      px(x, 12, bT + offR - 4, 3, 2, '#9aa4b4');
    }

    // ---------- piernas ----------
    if (f === 0) {
      // zancada A: izquierda adelante, derecha atrás
      px(x, 4, legY, 3, legH, pal.legs); px(x, 9, legY, 3, legH, ls);
      px(x, 4, bootY, 3, 1, pal.boots); px(x, 9, bootY, 3, 1, pal.boots);
    } else if (f === 1) {
      // pase: piernas juntas, cuerpo elevado
      px(x, 5, legY, 3, legH, pal.legs); px(x, 8, legY, 3, legH, pal.legs);
      px(x, 5, bootY, 3, 1, pal.boots); px(x, 8, bootY, 3, 1, pal.boots);
    } else {
      // zancada B: derecha adelante, izquierda atrás
      px(x, 4, legY + 1, 3, Math.max(1, legH - 1), ls); px(x, 9, legY, 3, legH, pal.legs);
      px(x, 4, bootY, 3, 1, pal.boots); px(x, 9, bootY, 3, 1, pal.boots);
    }
    return;
  }

  // ---------- dir === 'side' (mirando a la derecha) ----------
  px(x, 5, hT, 8, 1, pal.outline);
  px(x, 4, hT + 1, 9, 5, pal.hair);
  px(x, 4, hT + 1, 9, 1, hs);
  if (pal.hood) { px(x, 4, fT + 2, 8, 2, pal.hair); }
  px(x, 7, fT, 5, 4, pal.mask ? (pal.maskC ?? pal.skin) : pal.skin);
  if (!pal.mask) {
    px(x, 10, fT + 1, 1, 2, pal.eye);
    if (pal.beard) px(x, 8, fT + 3, 4, 2, pal.beard);
  } else {
    px(x, 8, fT + 1, 3, 1, '#eae6dc');
  }
  px(x, 5, fT + 2, 1, 2, pal.hair);
  if (pal.ears === 'elf') px(x, 6, fT + 1, 1, 2, pal.skin);
  if (pal.ears === 'cat') { px(x, 3, 0, 1, 1, hs); px(x, 4, 1, 2, 1, pal.hair); }
  if (pal.hairLong) px(x, 4, fT + 3, 2, Math.max(1, bT - fT - 2), pal.hair);
  if (pal.messy) px(x, 5, Math.max(0, hT - 1), 3, 1, pal.hair);

  // torso
  px(x, 5, bT, 6, L.bodyH, pal.body);
  px(x, 5, bT, 6, 1, pal.bodyS);
  px(x, 6, bT + L.bodyH - 2, 4, 1, pal.accent);
  px(x, 5, bodyBot, 6, 1, pal.outline);
  if (pal.ribs) { px(x, 6, bT + 1, 3, 1, pal.bodyS); px(x, 6, bT + 2, 3, 1, pal.bodyS); }
  if (pal.pauldrons) px(x, 4, bT, 2, 2, pal.accent);
  if (pal.leafy) px(x, 4, bT, 2, 1, '#8ac05a');

  // brazo delantero con balanceo + brazo trasero al tono sombreado
  const offF = [1, 0, -1][f];
  px(x, 8, bT + offF, 3, 3, pal.body);
  px(x, 10, bT + offF + 3, 2, 1, pal.skin);
  px(x, 5, bT - offF, 2, 3, pal.bodyS);
  if (pal.hammer) {
    px(x, 11, bT + offF - 2, 1, 4, '#7a5c3a');
    px(x, 10, bT + offF - 4, 3, 2, '#9aa4b4');
  }

  // piernas en zancada (3 fases)
  if (f === 0) {
    px(x, 5, legY, 2, legH, ls); px(x, 8, legY, 2, legH, pal.legs);
    px(x, 5, bootY, 2, 1, pal.boots); px(x, 8, bootY, 2, 1, pal.boots);
  } else if (f === 1) {
    px(x, 6, legY, 2, legH, pal.legs); px(x, 8, legY + 1, 2, Math.max(1, legH - 1), ls);
    px(x, 6, bootY, 2, 1, pal.boots); px(x, 8, bootY, 2, 1, pal.boots);
  } else {
    px(x, 4, legY, 2, legH, ls); px(x, 7, legY, 2, legH, pal.legs);
    px(x, 4, bootY, 2, 1, pal.boots); px(x, 7, bootY, 2, 1, pal.boots);
  }
}

export function buildHumanoid(pal: HumanPal): Frames {
  const frames: Frames = [];
  const dirs: ('down' | 'up' | 'side')[] = ['down', 'up', 'side'];
  const L = layoutFor(pal);
  for (const dir of dirs) {
    for (let f = 0; f < 3; f++) {
      const bob = f === 1 ? -1 : 0; // el cuerpo se eleva en la fase de pase
      const { c, x } = mkCanvas(16, L.H);
      drawHumanFrame(x, pal, dir, f, bob, L);
      frames.push(c);
    }
  }
  if (pal.big) {
    // El Gran Inquisidor se dibuja a escala ×2 (32×36): imponente como el Guardián
    return frames.map(fr => {
      const { c, x } = mkCanvas(32, L.H * 2);
      x.imageSmoothingEnabled = false;
      x.drawImage(fr, 0, 0, 32, L.H * 2);
      return c;
    });
  }
  return frames;
}

/** Índice de fotograma legacy (compatible con re-export de engine.ts). */
export function frameIndex(dir: string, moving: boolean, anim: number): number {
  const base = dir === 'down' ? 0 : dir === 'up' ? 2 : 4;
  if (!moving) return base;
  return base + (Math.floor(anim * 6) % 2);
}

/**
 * Selección robusta de fotograma para cualquier sprite:
 * humanoids nuevos tienen 9 frames (3 por dirección), los demás
 * (lobo, guardián, wisp...) alternan su ciclo propio al moverse.
 */
export function entityFrame(spr: Frames, dir: string, moving: boolean, anim: number): number {
  const n = spr.length;
  if (n === 9) {
    const base = dir === 'up' ? 3 : dir === 'side' ? 6 : 0;
    if (!moving) return base + 1; // pose de pie = fase de pase sin bob
    return base + (Math.floor(anim * 8) % 3);
  }
  if (n >= 2 && moving) return Math.floor(anim * 6) % Math.min(2, n);
  return 0;
}
