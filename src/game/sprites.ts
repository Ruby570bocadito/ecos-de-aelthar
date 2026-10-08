// ============================================================
// ECOS DE AELTHAR — Arte pixel procedural (AGENTE 3-a · visuales)
// Sprites generados en canvas: humanoides con ciclos de andar de
// 3 fases, paletas de la biblia (Sasha, Brokk, Maelis, Corvin,
// Kael, Gran Inquisidor, Teo, Doran, Nimue), lobo, Guardián
// Hueco, cofres, santuario, fragmento, wisps + tiles del mundo.
// Además: arcos de ataque (slash) y retratos de diálogo.
// ============================================================

import { hash2 } from './world/palette';
import { paintGrass } from './world/grass';
import { paintWater } from './world/water';
import { paintStone } from './world/stone';
import { paintVillage } from './world/village';
import { paintTall } from './world/trees';

export { hash2 } from './world/palette';

export type Frames = HTMLCanvasElement[];

const SPR: Record<string, Frames> = {};

function mkCanvas(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

// ---------------- Humanoides (16×18 · 3 fases de andar) ----------------

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

function px(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, C: string) {
  x.fillStyle = C; x.fillRect(X, Y, W, H);
}

interface Layout {
  H: number;        // alto del canvas
  headTop: number;  // fila de la masa de pelo
  faceTop: number;  // fila de piel
  bodyTop: number;  // fila del torso
  bodyH: number;    // filas de torso (incluye fila de contorno)
  armLen: number;   // largo del brazo sin mano
}

function layoutFor(pal: HumanPal): Layout {
  if (pal.small) return { H: 15, headTop: 0, faceTop: 3, bodyTop: 7, bodyH: 4, armLen: 3 };
  return { H: 18, headTop: 1, faceTop: 4, bodyTop: 8, bodyH: 6, armLen: 4 };
}

/**
 * Dibuja un fotograma humanoide. f = fase de andar (0 zancada A,
 * 1 pase —cuerpo elevado 1px—, 2 zancada B). En reposo se usa f=1
 * sin bob para una pose neutra de pie.
 */
function drawHumanFrame(
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

function buildHumanoid(pal: HumanPal): Frames {
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

// ---------------- Lobo de niebla (18×12) ----------------

function buildWolf(): Frames {
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

function buildGuardian(): Frames {
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

// ---------------- Objetos ----------------

function buildChest(): { closed: Frames; open: Frames } {
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

function buildSanctuary(): Frames {
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

function buildFragment(): Frames {
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

function buildWisp(): Frames {
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

function buildPickups(): void {
  {
    const { c, x } = mkCanvas(8, 10);
    px(x, 2, 0, 4, 2, '#8a5a2b'); px(x, 1, 2, 6, 7, '#e05078');
    px(x, 2, 3, 2, 3, '#ff9ab0'); px(x, 1, 9, 6, 1, '#8a2a48');
    SPR['potion'] = [c];
  }
  {
    const { c, x } = mkCanvas(10, 8);
    px(x, 1, 2, 8, 5, '#e8b23a'); px(x, 1, 2, 8, 1, '#f8d878');
    px(x, 0, 3, 1, 3, '#b8842a'); px(x, 9, 3, 1, 3, '#b8842a');
    px(x, 3, 4, 2, 1, '#b8842a'); px(x, 6, 4, 1, 1, '#b8842a');
    SPR['goldbag'] = [c];
  }
  {
    const { c, x } = mkCanvas(10, 10);
    px(x, 2, 1, 6, 8, '#cfd6e2'); px(x, 3, 0, 4, 1, '#9aa4b4');
    px(x, 3, 3, 4, 1, '#7a8494'); px(x, 3, 6, 4, 1, '#7a8494');
    SPR['keyEcho'] = [c];
  }
}

// ---------------- Registro de paletas ----------------

const PALS: Record<string, HumanPal> = {
  hero_alba: {
    outline: '#2a1a20', hair: '#c8384a', hairS: '#9a2438', skin: '#f2c99c',
    body: '#cdd3de', bodyS: '#9aa3b4', accent: '#c8384a',
    legs: '#5a6070', legsS: '#474c5a', boots: '#6d4520', eye: '#2a2a3a', hood: true,
  },
  hero_tejedor: {
    outline: '#241a30', hair: '#8a5ac0', hairS: '#6a3f9a', skin: '#f2c99c',
    body: '#7e58b8', bodyS: '#5e3f92', accent: '#f0c84a',
    legs: '#4a3a6a', legsS: '#3c2f58', boots: '#3a2c50', eye: '#3ae0c8', hood: true,
  },
  brisa: {
    outline: '#2a2a30', hair: '#d8dade', hairS: '#b0b4bc', skin: '#eabf9a',
    body: '#7a9a6e', bodyS: '#5e7a54', accent: '#e8d8a8',
    legs: '#6a6a62', boots: '#4a3a2a', eye: '#3a3a3a',
  },
  toln: {
    outline: '#241a14', hair: '#6a4a2e', hairS: '#54381e', skin: '#e0a87a',
    body: '#8a5a33', bodyS: '#6d4520', accent: '#3a3a3e',
    legs: '#4a4440', boots: '#3a2c20', eye: '#2a2a2a', beard: '#6a4a2e',
  },
  ilwen: {
    outline: '#1c2a1e', hair: '#8ad058', hairS: '#64a83e', skin: '#f2d0a8',
    body: '#3e7d4c', bodyS: '#2e5f3a', accent: '#e8c860',
    legs: '#4a5a3a', boots: '#54381e', eye: '#2a4a2e', ears: 'elf',
  },
  esqueleto: {
    outline: '#20201e', hair: '#e6e0c8', hairS: '#c2bc9e', skin: '#e6e0c8',
    body: '#d8d2b4', bodyS: '#a8a284', accent: '#7a7460',
    legs: '#c8c2a4', legsS: '#a8a284', boots: '#8a8468', eye: '#e04838', ribs: true,
  },
  sombra: {
    outline: '#100c1c', hair: '#2c2440', hairS: '#201a30', skin: '#2c2440',
    body: '#241c38', bodyS: '#181226', accent: '#9f7ae0',
    legs: '#181226', boots: '#100c1c', eye: '#b48fff', hood: true,
  },
  // ----- Nuevos personajes de la biblia (agente 3-a) -----
  sasha: {
    // Kaari felina ladrona: capucha oscura, ojos dorados, ágil
    outline: '#16121e', hair: '#2e2838', hairS: '#221c2c', skin: '#e8c49a',
    body: '#3a3448', bodyS: '#2a2438', accent: '#c89a3a',
    legs: '#2e2a3a', legsS: '#242030', boots: '#1a1622', eye: '#f0c040',
    hood: true, ears: 'cat',
  },
  brokk: {
    // Enano Durn: ancho, barba rojiza trenzada, martillo
    outline: '#241408', hair: '#8a4a26', hairS: '#6d3a1e', skin: '#e8a878',
    body: '#5a4a3a', bodyS: '#443828', accent: '#b07030',
    legs: '#3e342a', boots: '#2e241a', eye: '#2a2a2a', beard: '#a44e28', hammer: true,
  },
  maelis: {
    // Nereida sacerdotisa: perla y turquesa, serena
    outline: '#12303a', hair: '#7ad8c8', hairS: '#54b0a4', skin: '#f0d8c0',
    body: '#4aa8b0', bodyS: '#368088', accent: '#e8f0ea',
    legs: '#3a8890', boots: '#2a6870', eye: '#2a8a8a', hairLong: true,
  },
  corvin: {
    // Erudito desertor: túnica gris oscura elegante, sarcástico
    outline: '#181820', hair: '#5a5a64', hairS: '#42424a', skin: '#eac8a0',
    body: '#3e3e48', bodyS: '#2e2e38', accent: '#8a8a96',
    legs: '#33333c', boots: '#22222a', eye: '#3a3a44',
  },
  kael: {
    // Inquisidora de la Orden: armadura blanca, fría
    outline: '#3a3a44', hair: '#e8e0c8', hairS: '#c8bc9c', skin: '#f2d4b0',
    body: '#e8e6de', bodyS: '#c2c0b6', accent: '#8a94a8',
    legs: '#b8b6ac', boots: '#8a887e', eye: '#7a8894', pauldrons: true,
  },
  inquisidor: {
    // GRAN Inquisidor: armadura blanca sin adornos, máscara lisa, alto
    outline: '#2a2a30', hair: '#e4e2da', hairS: '#c6c4ba', skin: '#d8d4ca',
    body: '#e4e2da', bodyS: '#bcbab0', accent: '#8a887e',
    legs: '#b4b2a8', boots: '#86847a', eye: '#d8d4ca', mask: true, maskC: '#d8d4ca', big: true,
  },
  teo: {
    // Niño de unos 8 años, pelo revuelto
    outline: '#2a1e14', hair: '#7a5432', hairS: '#5e4026', skin: '#f2cfa4',
    body: '#c09a54', bodyS: '#9a7a40', accent: '#7a5432',
    legs: '#6a5a40', boots: '#4a3a28', eye: '#3a2a1a', small: true, messy: true,
  },
  doran: {
    // Druida del Círculo Verde: verde musgo, capucha de hojas
    outline: '#16241a', hair: '#3e6a34', hairS: '#2e5226', skin: '#d8b088',
    body: '#4a7a3e', bodyS: '#375e2e', accent: '#8ac05a',
    legs: '#3a5232', boots: '#4a3a22', eye: '#2a3a24', hood: true, leafy: true,
  },
  nimue: {
    // Elfa pálida espectral (verde wisp)
    outline: '#1a2a26', hair: '#b8d8c8', hairS: '#94b8a8', skin: '#e4e8de',
    body: '#5a8a72', bodyS: '#446a58', accent: '#bff0dc',
    legs: '#4a6a5a', boots: '#38504a', eye: '#7ae8c0', ears: 'elf', hairLong: true,
  },
};

export function initSprites(): void {
  for (const [name, pal] of Object.entries(PALS)) SPR[name] = buildHumanoid(pal);
  SPR['lobo'] = buildWolf();
  SPR['guardian'] = buildGuardian();
  const chest = buildChest();
  SPR['chest'] = chest.closed;
  SPR['chest_open'] = chest.open;
  SPR['sanctuary'] = buildSanctuary();
  SPR['fragment'] = buildFragment();
  SPR['wisp'] = buildWisp();
  buildPickups();
}

export function getSpr(name: string): Frames {
  return SPR[name] ?? SPR['hero_alba'];
}

// ---------------- Arco de ataque (slash) ----------------

/**
 * Dibuja el arco de tajo del jugador. prog: 0→1 progreso del golpe,
 * combo: 0..2 (blanco → amarillo → dorado), charged: ataque cargado
 * (más grande, dorado y con estela). Todos los trazos son aditivos
 * suaves y restauran el estado del contexto.
 */
export function drawSlashArc(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  dir: string, prog: number, combo: number, charged: boolean, zoom: number,
): void {
  const base = dir === 'down' ? Math.PI / 2 : dir === 'up' ? -Math.PI / 2 : dir === 'left' ? Math.PI : 0;
  const colors = charged ? '#ffd24a' : ['#f2f6fa', '#ffe86a', '#ffc040'][Math.max(0, Math.min(2, combo))];
  const r = (charged ? 27 : 19) * zoom;
  const span = 1.2;
  const a0 = base - 1.1 + prog * 1.45;
  ctx.save();
  // relleno en cuña (ataque cargado: más presencia)
  if (charged) {
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a0 + span);
    ctx.closePath();
    ctx.fill();
  }
  // estela: dos arcos anteriores con alpha decreciente
  for (let i = 2; i >= 1; i--) {
    const p2 = prog - i * 0.17;
    if (p2 <= 0) continue;
    ctx.globalAlpha = charged ? 0.34 - i * 0.12 : 0.26 - i * 0.1;
    ctx.strokeStyle = colors;
    ctx.lineWidth = (charged ? 5 : 3) - i;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1 - i * 0.05), base - 1.1 + p2 * 1.45, base - 1.1 + p2 * 1.45 + span * 0.8);
    ctx.stroke();
  }
  // arco principal
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = colors;
  ctx.lineWidth = charged ? 5 : 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a0 + span);
  ctx.stroke();
  // filo brillante en el borde delantero
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0 + span - 0.22, a0 + span);
  ctx.stroke();
  ctx.restore();
}

// ---------------- Retratos de diálogo (28×40 escalables) ----------------

interface PortraitDef {
  kind: 'human' | 'guardian' | 'sombra' | 'wisp' | 'crystal' | 'sanctuary' | 'mask';
  bg: string;
  skin: string; skinS: string;
  hair: string; hairS?: string;
  eye: string;
  cloth: string; clothS: string;
  accent?: string;
  beard?: string;
  hood?: boolean; hoodCol?: string;
  ears?: 'cat' | 'elf';
  hairLong?: boolean;
  child?: boolean;
}

const PORTRAITS: Record<string, PortraitDef> = {
  hero_alba: {
    kind: 'human', bg: '#1a1218',
    skin: '#f2c99c', skinS: '#d8a878', hair: '#c8384a', hairS: '#9a2438',
    eye: '#2a2a3a', cloth: '#5a6070', clothS: '#474c5a', accent: '#c8384a',
    hood: true, hoodCol: '#a83044',
  },
  hero_tejedor: {
    kind: 'human', bg: '#181228',
    skin: '#f2c99c', skinS: '#d8a878', hair: '#8a5ac0', hairS: '#6a3f9a',
    eye: '#3ae0c8', cloth: '#7e58b8', clothS: '#5e3f92', accent: '#f0c84a',
    hood: true, hoodCol: '#6a44a0',
  },
  brisa: {
    kind: 'human', bg: '#141a14',
    skin: '#eabf9a', skinS: '#c89a74', hair: '#d8dade', hairS: '#b0b4bc',
    eye: '#3a3a3a', cloth: '#7a9a6e', clothS: '#5e7a54', accent: '#e8d8a8',
    hairLong: true,
  },
  toln: {
    kind: 'human', bg: '#1a140e',
    skin: '#e0a87a', skinS: '#c08858', hair: '#6a4a2e', hairS: '#54381e',
    eye: '#2a2a2a', cloth: '#8a5a33', clothS: '#6d4520', accent: '#3a3a3e',
    beard: '#6a4a2e',
  },
  ilwen: {
    kind: 'human', bg: '#101a10',
    skin: '#f2d0a8', skinS: '#d0ac84', hair: '#8ad058', hairS: '#64a83e',
    eye: '#2a4a2e', cloth: '#3e7d4c', clothS: '#2e5f3a', accent: '#e8c860',
    ears: 'elf', hairLong: true,
  },
  sasha: {
    kind: 'human', bg: '#120e18',
    skin: '#e8c49a', skinS: '#c49a70', hair: '#2e2838', hairS: '#221c2c',
    eye: '#f0c040', cloth: '#3a3448', clothS: '#2a2438', accent: '#c89a3a',
    hood: true, hoodCol: '#262032', ears: 'cat',
  },
  brokk: {
    kind: 'human', bg: '#1a120a',
    skin: '#e8a878', skinS: '#c4885a', hair: '#8a4a26', hairS: '#6d3a1e',
    eye: '#2a2a2a', cloth: '#5a4a3a', clothS: '#443828', accent: '#b07030',
    beard: '#a44e28',
  },
  maelis: {
    kind: 'human', bg: '#0e1c20',
    skin: '#f0d8c0', skinS: '#ccb094', hair: '#7ad8c8', hairS: '#54b0a4',
    eye: '#2a8a8a', cloth: '#4aa8b0', clothS: '#368088', accent: '#e8f0ea',
    hairLong: true,
  },
  corvin: {
    kind: 'human', bg: '#141418',
    skin: '#eac8a0', skinS: '#c6a67e', hair: '#5a5a64', hairS: '#42424a',
    eye: '#3a3a44', cloth: '#3e3e48', clothS: '#2e2e38', accent: '#8a8a96',
  },
  kael: {
    kind: 'human', bg: '#16161c',
    skin: '#f2d4b0', skinS: '#d0b088', hair: '#e8e0c8', hairS: '#c8bc9c',
    eye: '#7a8894', cloth: '#e8e6de', clothS: '#c2c0b6', accent: '#8a94a8',
  },
  inquisidor: {
    kind: 'mask', bg: '#141416',
    skin: '#d8d4ca', skinS: '#b8b4aa', hair: '#e4e2da', hairS: '#c6c4ba',
    eye: '#d8d4ca', cloth: '#e4e2da', clothS: '#bcbab0', accent: '#8a887e',
  },
  teo: {
    kind: 'human', bg: '#181208',
    skin: '#f2cfa4', skinS: '#d0aa78', hair: '#7a5432', hairS: '#5e4026',
    eye: '#3a2a1a', cloth: '#c09a54', clothS: '#9a7a40', accent: '#7a5432',
    child: true,
  },
  doran: {
    kind: 'human', bg: '#101a10',
    skin: '#d8b088', skinS: '#b4906a', hair: '#3e6a34', hairS: '#2e5226',
    eye: '#2a3a24', cloth: '#4a7a3e', clothS: '#375e2e', accent: '#8ac05a',
    hood: true, hoodCol: '#2e5226',
  },
  nimue: {
    kind: 'human', bg: '#0e1614',
    skin: '#e4e8de', skinS: '#c0c8ba', hair: '#b8d8c8', hairS: '#94b8a8',
    eye: '#7ae8c0', cloth: '#5a8a72', clothS: '#446a58', accent: '#bff0dc',
    ears: 'elf', hairLong: true,
  },
  guardian: {
    kind: 'guardian', bg: '#0c0a16',
    skin: '#4a4660', skinS: '#3a364c', hair: '#5f5a7a', hairS: '#4a4660',
    eye: '#7ee8ff', cloth: '#2c2440', clothS: '#221c33',
  },
  sombra: {
    kind: 'sombra', bg: '#0a0812',
    skin: '#241c38', skinS: '#181226', hair: '#2c2440', hairS: '#201a30',
    eye: '#b48fff', cloth: '#241c38', clothS: '#181226',
  },
  wisp: {
    kind: 'wisp', bg: '#0a1414',
    skin: '#bff4e8', skinS: '#7fe0cc', hair: '#bff4e8', hairS: '#7fe0cc',
    eye: '#ffffff', cloth: '#7fe0cc', clothS: '#5ab8a8',
  },
  fragment: {
    kind: 'crystal', bg: '#141020',
    skin: '#ffe9a0', skinS: '#f0c84a', hair: '#ffe9a0', hairS: '#f0c84a',
    eye: '#fffbe0', cloth: '#f0c84a', clothS: '#c89830',
  },
  sanctuary: {
    kind: 'sanctuary', bg: '#0c1420',
    skin: '#8ef0ff', skinS: '#5ac8dc', hair: '#8ef0ff', hairS: '#5ac8dc',
    eye: '#e8fbff', cloth: '#5a6a8a', clothS: '#42506c',
  },
};

const PORTRAIT_OUTLINE = '#1a1420';

/**
 * Dibuja el retrato pixel de diálogo por clave (28×40 unidades × scale).
 * Fallback seguro a 'wisp' si la clave no existe.
 */
export function drawPortrait(
  ctx: CanvasRenderingContext2D, key: string,
  dx: number, dy: number, scale: number, blink = false,
): void {
  const P = PORTRAITS[key] ?? PORTRAITS['wisp'];
  const q = (X: number, Y: number, W: number, H: number, C: string) => {
    ctx.fillStyle = C;
    ctx.fillRect(dx + X * scale, dy + Y * scale, W * scale, H * scale);
  };
  const O = PORTRAIT_OUTLINE;

  // fondo con viñeta simple
  q(0, 0, 28, 40, P.bg);
  q(0, 0, 28, 1, 'rgba(255,255,255,0.05)');
  ctx.globalAlpha = 0.25;
  q(0, 34, 28, 6, '#000');
  ctx.globalAlpha = 1;

  if (P.kind === 'guardian') {
    // Guardián Hueco: petreo, hueco y con cuernos
    q(1, 30, 26, 10, P.cloth);                    // capa
    q(5, 27, 18, 6, P.hairS ?? P.hair);                     // peto
    q(11, 31, 6, 6, O);                           // hueco
    q(12, 32, 4, 4, P.eye);                       // brillo interior
    q(7, 7, 14, 13, P.hair);                      // casco
    q(7, 7, 14, 2, '#8a84a8');
    q(4, 2, 3, 9, '#8a84a8'); q(21, 2, 3, 9, '#8a84a8');  // cuernos
    q(3, 0, 2, 3, '#8a84a8'); q(23, 0, 2, 3, '#8a84a8');
    q(10, 13, 3, 3, O); q(15, 13, 3, 3, O);       // cuencas
    q(10, 13, 2, 2, P.eye); q(16, 13, 2, 2, P.eye);
    q(6, 10, 1, 6, O); q(21, 16, 1, 4, O);        // grietas
    return;
  }
  if (P.kind === 'sombra') {
    // Sombra sin rostro: capucha vacía y ojos violáceos
    q(2, 30, 24, 10, P.clothS);
    q(3, 2, 22, 11, P.hair);                      // capucha
    q(3, 13, 5, 21, P.hair); q(20, 13, 5, 21, P.hair);
    q(7, 10, 14, 18, '#0c0816');                  // vacío
    q(10, 16, 3, 3, P.eye); q(15, 16, 3, 3, P.eye);
    ctx.globalAlpha = 0.5;
    q(9, 15, 5, 5, P.eye); q(14, 15, 5, 5, P.eye);
    ctx.globalAlpha = 1;
    return;
  }
  if (P.kind === 'wisp') {
    // Wisp: rostro etéreo sin boca
    ctx.globalAlpha = 0.3; q(7, 8, 14, 20, P.skinS);
    ctx.globalAlpha = 0.55; q(9, 10, 10, 16, P.skin);
    ctx.globalAlpha = 1; q(11, 13, 6, 10, '#eafff8');
    q(12, 16, 1, 2, P.eye); q(15, 16, 1, 2, P.eye);
    if (blink) { q(12, 17, 4, 1, P.skinS); }
    ctx.globalAlpha = 0.3;
    q(6, 6, 2, 2, P.skinS); q(20, 9, 2, 2, P.skinS); q(8, 28, 2, 2, P.skinS);
    ctx.globalAlpha = 1;
    return;
  }
  if (P.kind === 'crystal') {
    // Fragmento de Eco: cristal facetado dorado
    q(12, 6, 4, 28, P.skinS);
    q(9, 10, 10, 20, P.skinS);
    q(11, 12, 6, 16, P.skin);
    q(13, 15, 2, 6, P.eye);
    q(4, 30, 20, 8, '#3a3020');                   // peana
    q(4, 30, 20, 1, '#5a4a2c');
    ctx.globalAlpha = 0.6;
    q(6, 12, 2, 2, P.skinS); q(20, 18, 2, 2, P.skinS); q(8, 24, 2, 2, P.skinS);
    ctx.globalAlpha = 1;
    return;
  }
  if (P.kind === 'sanctuary') {
    // Santuario: cristal turquesa sobre piedra
    q(10, 5, 8, 24, P.skinS);
    q(12, 7, 4, 20, P.skin);
    q(13, 12, 2, 5, P.eye);
    q(4, 29, 20, 9, P.clothS);                    // piedra
    q(4, 29, 20, 1, P.cloth);
    q(6, 31, 2, 1, '#2c3448'); q(14, 33, 3, 1, '#2c3448'); q(19, 30, 2, 1, '#2c3448');
    ctx.globalAlpha = 0.35;
    q(8, 4, 12, 26, P.skinS);
    ctx.globalAlpha = 1;
    return;
  }

  // ----- humanos (y la máscara del Gran Inquisidor) -----
  // hombros / ropa
  q(1, 31, 26, 9, P.cloth);
  q(1, 31, 26, 2, P.clothS);
  if (P.accent) q(1, 31, 26, 1, P.accent);
  // cuello
  q(11, 27, 6, 6, P.skinS);
  // melena trasera
  if (P.hairLong) { q(4, 8, 20, 22, P.hair); }
  // rostro
  q(7, 9, 14, 17, P.skin);
  q(9, 25, 10, 4, P.skin);                       // mentón
  q(7, 23, 2, 5, P.skinS); q(19, 23, 2, 5, P.skinS); // mandíbula
  // orejas
  if (P.ears === 'elf') {
    q(5, 15, 2, 4, P.skin); q(21, 15, 2, 4, P.skin);
    q(4, 14, 1, 2, P.skin); q(23, 14, 1, 2, P.skin);
  }
  if (P.kind === 'mask') {
    // máscara LISA: sin ojos, sin nariz, sin boca
    q(7, 9, 14, 17, P.skin);
    q(9, 25, 10, 4, P.skin);
    q(9, 11, 4, 9, 'rgba(255,255,255,0.14)');    // brillo vertical
    q(14, 10, 1, 15, 'rgba(0,0,0,0.12)');        // costura central
    q(7, 9, 14, 1, P.hairS ?? P.hair);                     // borde del yelmo
    q(5, 4, 18, 7, P.hair);                      // yelmo blanco
    q(5, 4, 18, 2, P.hairS ?? P.hair);
    q(3, 9, 3, 10, P.hair); q(22, 9, 3, 10, P.hair);
    return;
  }
  // cejas
  q(9, 14, 4, 1, P.hairS ?? P.hair); q(15, 14, 4, 1, P.hairS ?? P.hair);
  // ojos grandes y legibles
  if (P.child) {
    q(8, 16, 5, 4, O); q(15, 16, 5, 4, O);
    if (blink) {
      q(8, 18, 5, 1, P.hairS ?? P.hair); q(15, 18, 5, 1, P.hairS ?? P.hair);
    } else {
      q(9, 17, 3, 2, P.eye); q(16, 17, 3, 2, P.eye);
      q(9, 17, 1, 1, '#ffffff'); q(16, 17, 1, 1, '#ffffff');
    }
  } else {
    q(9, 17, 4, 3, O); q(15, 17, 4, 3, O);
    if (blink) {
      q(9, 18, 4, 1, P.hairS ?? P.hair); q(15, 18, 4, 1, P.hairS ?? P.hair);
    } else {
      q(10, 17, 2, 2, P.eye); q(16, 17, 2, 2, P.eye);
      q(10, 17, 1, 1, '#ffffff'); q(16, 17, 1, 1, '#ffffff');
    }
  }
  // nariz
  q(13, 21, 2, 2, P.skinS);
  // boca (los sarcásticos sonríen ladeados)
  if (!P.beard) {
    if (key === 'corvin' || key === 'sasha') { q(11, 24, 5, 1, '#9a5a50'); q(16, 23, 1, 1, '#9a5a50'); }
    else q(11, 24, 6, 1, '#9a5a50');
  }
  // barba (con trenza si es Brokk)
  if (P.beard) {
    q(8, 22, 12, 9, P.beard);
    q(8, 22, 12, 1, P.hairS ?? P.beard);
    if (key === 'brokk') {
      q(12, 27, 4, 6, P.beard);
      q(12, 27, 1, 6, P.hairS ?? P.beard);
      q(12, 32, 4, 1, P.accent ?? '#b07030');    // anilla de la trenza
      q(11, 24, 1, 3, P.hairS ?? P.beard); q(16, 24, 1, 3, P.hairS ?? P.beard);
    }
  }
  // pelo frontal
  q(6, 5, 16, 7, P.hair);
  q(7, 11, 14, 2, P.hairS ?? P.hair);
  q(5, 10, 3, 9, P.hair); q(20, 10, 3, 9, P.hair);
  if (P.hairLong) { q(4, 8, 3, 22, P.hair); q(21, 8, 3, 22, P.hair); }
  if (P.child) {
    // mechones revueltos de Teo
    q(5, 3, 3, 2, P.hair); q(12, 2, 4, 3, P.hair); q(19, 3, 3, 2, P.hair);
  }
  // capucha
  if (P.hood) {
    const hc = P.hoodCol ?? P.hair;
    q(3, 2, 22, 9, hc);
    q(3, 11, 4, 16, hc); q(21, 11, 4, 16, hc);
    q(6, 9, 2, 15, 'rgba(0,0,0,0.3)'); q(20, 9, 2, 15, 'rgba(0,0,0,0.3)');
    q(3, 2, 22, 1, 'rgba(255,255,255,0.12)');
    if (P.ears === 'cat') {
      // orejas felinas atravesando la capucha
      q(5, 0, 3, 4, hc); q(20, 0, 3, 4, hc);
      q(6, 1, 1, 2, '#d88a8a'); q(21, 1, 1, 2, '#d88a8a');
    }
  }
  // arrugas de la anciana Brisa
  if (key === 'brisa') {
    q(9, 13, 10, 1, 'rgba(0,0,0,0.10)');
    q(10, 22, 8, 1, 'rgba(0,0,0,0.08)');
  }
}
export const TILE = 16;

export type NeighborFn = (tx: number, ty: number) => string;

/**
 * Despachador de tiles: delega en los módulos de src/game/world/.
 * `at` (opcional) devuelve el char del tile vecino (dx,dy) — habilita
 * autotiling y transiciones entre terrenos en los módulos del mundo.
 */
export function drawTile(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, at?: NeighborFn,
): void {
  switch (ch) {
    case '.': case ',': case 'c': case 'm':
      paintGrass(x, ch, tx, ty, mapId, t, at); break;
    case '~': case 'B': case 'x':
      paintWater(x, ch, tx, ty, mapId, t, at); break;
    case ':': case '_': case '#': case 'P': case 'A': case 'V':
      paintStone(x, ch, tx, ty, mapId, t, at); break;
    case 'H': case 'r': case 'd': case 'F': case 'w': case 'g': case 'R':
      paintVillage(x, ch, tx, ty, mapId, t, at); break;
    default:
      px(x, tx * TILE, ty * TILE, TILE, TILE, '#4f8a46');
  }
}

// Objetos altos (dibujados por encima del suelo, con orden por fila)
export function isTallTile(ch: string): boolean {
  return ch === 't' || ch === 'p';
}

export function drawTallTile(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number, mapId: string,
  at?: NeighborFn,
): void {
  paintTall(x, ch, tx, ty, mapId, at);
}

// Árbol cortado en el pasado (diffs usan '.')
export const SOLID_CHARS = new Set(['t', 'p', '#', 'H', 'r', 'F', 'R', 'w', 'g', 'P', 'A', 'V', '~', 'd', 'x', 'n']);
