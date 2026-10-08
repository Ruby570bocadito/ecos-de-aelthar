// ============================================================
// ECOS DE AELTHAR — Retratos de diálogo (módulo actors)
// R2-A3 · Resolución interna 44×62 px (antes 28×40), terror v2.
//
// Cada retrato se pinta UNA vez en un canvas offscreen de 44×62
// (cráneo con volumen de 3 tonos, pelo en mechones, ojos con
// esclerótica/iris/brillo/párpado, viñeta radial dithered y un
// escenario sutil por personaje) y se estampa escalado. El cache
// por clave evita re-render salvo parpadeo o paso de animación.
//
// FIRMAS (compatibles a la vez, se detecta por tipos):
//  · Modo legado (el que usan screens.ts/render.ts hoy):
//      drawPortrait(ctx, key, dx, dy, scale, blink?, t?)
//    → estampa 28×scale × 40×scale px (huella SIN cambiar).
//  · Modo w/h (nuevo, para el integrador):
//      drawPortrait(ctx, key, x, y, w, h, t?)
//    → encaja el lienzo interno 44×62 en el rect w×h pedido.
//  · t: tiempo en ms (p.ej. performance.now()); se cuantiza a
//    pasos de 400 ms y anima la Sombra (píxeles de niebla que
//    se dispersan), el Guardián (parpadeo de cuencas), el
//    esqueleto (mandíbula colgante), motas de wisp/cristal...
//    Si se omite (t=0) el retrato sale estático. 100 % determinista.
// ============================================================

import { mkCanvas } from './util';

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

// ---------------- Retratos de diálogo (44×62 internos) ----------------

/** Resolución interna del lienzo de retrato. */
const PW = 44, PH = 62;
/** Huella legada (unidades de 28×40 que esperan los llamadores). */
const LEG_W = 28, LEG_H = 40;
/** Paso de cuantización temporal de las animaciones (ms). */
const T_STEP = 400;

const PORTRAIT_OUTLINE = '#1a1420';

interface PortraitDef {
  kind: 'human' | 'guardian' | 'sombra' | 'wisp' | 'crystal' | 'sanctuary' | 'mask' | 'skeleton';
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
  // --- R2-A3: nuevos rostros del terror ---
  esqueleto: {
    kind: 'skeleton', bg: '#0d0b12',
    skin: '#d8d2c0', skinS: '#a8a290', hair: '#39323e', hairS: '#2a2532',
    eye: '#8a84a0', cloth: '#2e2836', clothS: '#211c29',
  },
  mask: {
    kind: 'mask', bg: '#141416',
    skin: '#d8d4ca', skinS: '#b8b4aa', hair: '#e4e2da', hairS: '#c6c4ba',
    eye: '#d8d4ca', cloth: '#e4e2da', clothS: '#bcbab0', accent: '#8a887e',
  },
};

// ---------------- Utilidades de color y hash (locales) ----------------

/** Mezcla dos colores hex (#rrggbb) con factor k (0 = a, 1 = b). */
function mixCol(a: string, b: string, k: number): string {
  if (a[0] !== '#' || b[0] !== '#' || a.length < 7 || b.length < 7) return a;
  const na = parseInt(a.slice(1, 7), 16), nb = parseInt(b.slice(1, 7), 16);
  const r = Math.round(((na >> 16) & 255) + (((nb >> 16) & 255) - ((na >> 16) & 255)) * k);
  const g = Math.round(((na >> 8) & 255) + (((nb >> 8) & 255) - ((na >> 8) & 255)) * k);
  const bl = Math.round((na & 255) + ((nb & 255) - (na & 255)) * k);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Hash entero determinista (0..2^32) — sustituye a Math.random. */
function h2(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Tonos derivados (3.ª piel, luces frías, labio...) para un retrato. */
interface DerivedCols {
  skinL: string; skinD: string;
  hairS: string; hairL: string; hairD: string;
  clothL: string; clothS: string; clothD: string;
  hoodL: string; hoodD: string; hoodDD: string;
  lash: string; sclera: string; irisD: string; lip: string;
}

function deriveCols(P: PortraitDef): DerivedCols {
  const hairS = P.hairS ?? P.hair;
  const hoodCol = P.hoodCol ?? P.hair;
  return {
    // luz FRÍA lateral (azulada) para la cara iluminada; sombra fría profunda
    skinL: mixCol(P.skin, '#dfe9f5', 0.42),
    skinD: mixCol(P.skinS, '#141020', 0.32),
    hairS,
    hairL: mixCol(P.hair, '#dfe9f5', 0.32),
    hairD: mixCol(hairS, '#100e18', 0.30),
    clothL: mixCol(P.cloth, '#dfe9f5', 0.24),
    clothS: P.clothS,
    clothD: mixCol(P.clothS, '#100e18', 0.30),
    hoodL: mixCol(hoodCol, '#dfe9f5', 0.30),
    hoodD: mixCol(hoodCol, '#100e18', 0.32),
    hoodDD: mixCol(hoodCol, '#0a0812', 0.50),
    lash: '#241c28',
    sclera: '#dcdce8',
    irisD: mixCol(P.eye, '#0a0810', 0.38),
    lip: mixCol(P.skin, '#8a3a34', 0.50),
  };
}

/** Paleta derivada + helpers de pintado que viajan a cada pintor. */
interface R {
  q: (x: number, y: number, w: number, h: number, c: string) => void;
  qa: (x: number, y: number, w: number, h: number, c: string, a?: number) => void;
  P: PortraitDef; C: DerivedCols;
  key: string; f: number; blink: boolean;
}

// ---------------- Viñeta radial dithered (compartida) ----------------

const BAYER2 = [0, 2, 3, 1]; // matriz 2×2 (orden fila-major)

let vGlow: HTMLCanvasElement | null = null;
let vDark: HTMLCanvasElement | null = null;

/**
 * Precomputa UNA vez: (1) foco pálido central y (2) bandas
 * concéntricas oscuras dithered (Bayer 2×2) hacia las esquinas.
 * Se estampa sobre cualquier retrato al final del pintado.
 */
function vignettes(): { glow: HTMLCanvasElement; dark: HTMLCanvasElement } {
  if (vGlow && vDark) return { glow: vGlow, dark: vDark };
  const cd = mkCanvas(PW, PH), cg = mkCanvas(PW, PH);
  const DARKS: string[] = [], GLOWS: string[] = [];
  for (let i = 0; i <= 20; i++) {
    DARKS.push(`rgba(3,1,10,${(i / 20).toFixed(2)})`);
    GLOWS.push(`rgba(210,226,244,${(i / 20).toFixed(2)})`);
  }
  for (let cy = 0; cy < PH; cy += 2) {
    for (let cx = 0; cx < PW; cx += 2) {
      // distancia elíptica normalizada al centro del rostro
      const nx = (cx + 1 - PW / 2) / (PW * 0.62);
      const ny = (cy + 1 - PH * 0.44) / (PH * 0.60);
      const d = Math.sqrt(nx * nx + ny * ny);
      const bay = BAYER2[((cx >> 1) & 1) + ((cy >> 1) & 1) * 2] / 4;
      // bandas oscuras hacia las esquinas (4 anillos dithered)
      let a = 0;
      if (d > 0.97) a = 0.46; else if (d > 0.86) a = 0.34;
      else if (d > 0.74) a = 0.24; else if (d > 0.60) a = 0.14;
      if (a > 0) {
        const af = a * (0.8 + bay * 0.4);
        cd.x.fillStyle = DARKS[Math.max(1, Math.round(af * 20))];
        cd.x.fillRect(cx, cy, 2, 2);
      }
      // foco pálido tenue detrás del rostro
      if (d < 0.45) {
        const af = (0.45 - d) * 0.16 * (0.7 + bay * 0.6);
        cg.x.fillStyle = GLOWS[Math.min(20, Math.round(af * 20))];
        cg.x.fillRect(cx, cy, 2, 2);
      }
    }
  }
  vGlow = cg.c; vDark = cd.c;
  return { glow: vGlow, dark: vDark };
}

// ---------------- Escenario sutil por personaje ----------------

function drawScenario(r: R): void {
  const { q, qa, key, f } = r;
  switch (key) {
    case 'toln': {
      // chispas de forja (2-3 px ámbar) que titilan con f
      const SP: Array<[number, number, number]> = [[7, 10, 2], [10, 17, 1], [35, 8, 2], [37, 15, 1], [33, 22, 1], [5, 23, 1]];
      for (let i = 0; i < SP.length; i++) {
        const [sx, sy, s] = SP[i];
        if (h2(i * 31 + 7, f) % 3 === 0) qa(sx, sy, s, s, '#8a5218', 0.5); // brizna apagada
        else { q(sx, sy, s, s, i % 2 ? '#e8a23a' : '#f4c65a'); qa(sx, sy, 1, 1, '#fff2c8', 0.8); }
      }
      qa(4, 27, 7, 2, 'rgba(232,140,40,0.10)'); // rescoldo tenue
      break;
    }
    case 'brisa': {
      // ventana con luz de luna + tela verde colgada
      q(29, 5, 12, 17, '#46403a');
      q(30, 6, 10, 15, '#5e788c');
      q(30, 6, 4, 6, '#8aa4b4');                    // panel iluminado
      q(34, 6, 1, 15, '#46403a'); q(30, 13, 10, 1, '#46403a');
      q(30, 6, 10, 1, '#9ab8c6');
      // haz de luz dithered hacia el rostro
      qa(26, 17, 2, 2, 'rgba(200,220,235,0.10)');
      qa(27, 12, 2, 2, 'rgba(200,220,235,0.09)');
      qa(23, 21, 2, 2, 'rgba(200,220,235,0.08)');
      // tela (harapo verde) a la izquierda
      q(2, 12, 4, 28, '#4e6a48');
      q(3, 14, 1, 24, '#3c5238');
      q(2, 12, 1, 26, '#62805a');
      q(2, 39, 4, 2, '#8a7a4e');                    // dobladillo
      break;
    }
    case 'ilwen': {
      // hojas en las esquinas + una hoja que cae según f
      const LV: Array<[number, number]> = [[5, 7], [8, 10], [4, 13], [9, 6], [34, 7], [37, 10], [36, 14]];
      for (let i = 0; i < LV.length; i++) {
        const [lx, ly] = LV[i];
        q(lx, ly, 2, 2, i % 3 === 0 ? '#8ac05a' : i % 3 === 1 ? '#5a9a3e' : '#3e7d2c');
        qa(lx, ly, 1, 1, '#c8e88a', 0.5);
      }
      const fx = 30 - ((f * 3) % 12), fy = 10 + ((f * 5) % 14);
      q(fx, fy, 2, 1, '#8ac05a'); q(fx + 1, fy + 1, 1, 1, '#5a9a3e');
      break;
    }
    case 'doran': {
      // hojas musgosas en las esquinas + brizna que cae (guardabosques del bosque)
      const LV: Array<[number, number]> = [[4, 9], [7, 12], [3, 15], [6, 6], [35, 9], [38, 13], [36, 17]];
      for (let i = 0; i < LV.length; i++) {
        const [lx, ly] = LV[i];
        q(lx, ly, 2, 2, i % 3 === 0 ? '#5a8a3e' : i % 3 === 1 ? '#3e6a34' : '#2e5226');
        qa(lx, ly, 1, 1, '#8ac05a', 0.4);
      }
      const fx = 32 - ((f * 2) % 10), fy = 13 + ((f * 4) % 12);
      q(fx, fy, 2, 1, '#5a8a3e'); q(fx + 1, fy + 1, 1, 1, '#3e6a34');
      break;
    }
    case 'kael': case 'inquisidor': case 'mask': {
      // pilar blanco frío con arista iluminada y base
      q(31, 0, 9, 62, '#a9b0bc');
      q(31, 0, 2, 62, '#d4dae2');
      q(38, 0, 2, 62, '#7e8592');
      q(29, 54, 13, 4, '#8d949f'); q(29, 54, 13, 1, '#c2c8d0');
      for (let y = 4; y < 54; y += 9) qa(36, y, 1, 3, 'rgba(0,0,0,0.12)'); // juntas
      break;
    }
    case 'corvin': {
      // estantería mínima con lomos de libros
      q(27, 27, 15, 2, '#4a3a28'); q(27, 27, 15, 1, '#5e4a34');
      const BK: Array<[number, number, string]> = [[29, 8, '#5a3a3a'], [32, 10, '#3a4a5a'], [35, 7, '#4a5a3a'], [38, 9, '#54443a']];
      for (const [bx, bh, bc] of BK) { q(bx, 27 - bh, 2, bh, bc); q(bx, 27 - bh, 1, bh, mixCol(bc, '#ffffff', 0.18)); }
      qa(27, 25, 15, 1, 'rgba(0,0,0,0.25)');
      break;
    }
    case 'guardian': {
      // niebla rastrera que deriva con f (bandas altas para que asome
      // en los flancos y sobre la masa pétrea, no tapada por ella)
      for (let band = 0; band < 3; band++) {
        const by = 38 + band * 3, off = (f * (2 + band)) % 9;
        for (let x = -9; x < 44; x += 6) qa(x + off, by, 4, 3, '#8a84b0', 0.09 + band * 0.04);
      }
      break;
    }
    case 'sombra': {
      // niebla violeta a ras de capucha: franja visible entre capucha (y≤41)
      // y hombros (y≥46), más wisps laterales; deriva con f
      for (let band = 0; band < 3; band++) {
        const by = 41 + band * 2, off = (f * (3 + band)) % 8;
        for (let x = -8; x < 44; x += 6) qa(x + off, by, 4, 3, '#6a5a9a', 0.08 + band * 0.03);
      }
      break;
    }
    case 'esqueleto': {
      // telaraña sutil en la esquina superior izquierda
      qa(2, 2, 1, 8, 'rgba(220,220,230,0.16)'); qa(2, 2, 8, 1, 'rgba(220,220,230,0.16)');
      qa(3, 3, 1, 5, 'rgba(220,220,230,0.10)'); qa(3, 3, 5, 1, 'rgba(220,220,230,0.10)');
      break;
    }
    default: break;
  }
}

// ---------------- Humanos (y variantes) ----------------

function drawHuman(r: R): void {
  const { q, qa, P, C, key, blink } = r;
  const child = P.child === true;
  const hoodCol = P.hoodCol ?? P.hair;
  // tonos de barba (si procede)
  const bS = P.beard ? mixCol(P.beard, '#100e18', 0.30) : '';
  const bL = P.beard ? mixCol(P.beard, '#dfe9f5', 0.24) : '';

  // --- melena trasera (detrás de todo) ---
  if (P.hairLong) {
    for (let x = 10; x <= 33; x++) q(x, 12, 1, Math.min(35, 30 + (h2(x, 11) % 6)), P.hair);
    qa(12, 14, 1, 24, C.hairD, 0.8);
    qa(32, 14, 1, 24, C.hairD, 0.8);
    qa(11, 16, 1, 20, C.hairL, 0.7);
  }

  // --- torso / hombros ---
  if (child) {
    q(6, 52, 32, 10, P.cloth);
    q(29, 52, 9, 10, C.clothS);
    q(6, 52, 32, 1, C.clothD);
    q(6, 53, 8, 2, C.clothL);
    if (P.accent) { q(6, 57, 32, 1, P.accent); q(29, 57, 9, 1, mixCol(P.accent, '#100e18', 0.35)); }
    q(6, 60, 32, 2, C.clothD);
  } else {
    q(3, 48, 38, 14, P.cloth);
    q(30, 48, 11, 14, C.clothS);                 // sombra derecha
    q(3, 48, 38, 1, C.clothD);
    q(17, 49, 10, 3, C.clothD);                  // escote en V
    q(3, 49, 9, 2, C.clothL);                    // luz fría del hombro izq
    if (P.accent) { q(3, 55, 38, 1, P.accent); q(30, 55, 11, 1, mixCol(P.accent, '#100e18', 0.35)); }
    q(3, 60, 38, 2, C.clothD);
  }

  // --- caídas de melena sobre los hombros ---
  if (P.hairLong) {
    const xL0 = P.ears === 'elf' ? 8 : 9, xR0 = P.ears === 'elf' ? 33 : 32;
    for (let x = xL0; x < xL0 + 4; x++) q(x, 14, 1, 26 + (h2(x, 21) % 6), P.hair);
    q(xL0 + 3, 16, 1, 24, C.hairD);
    qa(xL0 + 1, 18, 1, 20, C.hairL, 0.7);
    for (let x = xR0; x < xR0 + 4; x++) q(x, 14, 1, 26 + (h2(x, 23) % 6), P.hair);
    q(xR0 + 3, 16, 1, 24, C.hairD);
    qa(xR0, 18, 1, 20, C.hairL, 0.6);
  }

  // --- cuello ---
  if (child) {
    q(19, 38, 6, 15, P.skinS);
    qa(19, 38, 6, 3, C.skinD, 0.85);
    q(19, 42, 1, 9, C.skinL);
  } else {
    q(19, 38, 6, 11, P.skinS);
    qa(19, 38, 6, 3, C.skinD, 0.85);
    q(19, 42, 1, 7, C.skinL);
  }

  // --- rostro con volumen (3 tonos de piel) ---
  q(14, 15, 16, 16, P.skin);                     // bóveda facial y15..30
  q(15, 31, 14, 3, P.skin);                      // mandíbula y31..33
  q(16, 34, 12, 2, P.skin);                      // y34..35
  q(17, 36, 10, 3, P.skin);                      // mentón y36..38
  if (child) { q(13, 24, 1, 6, P.skin); q(30, 24, 1, 6, P.skin); } // mejillas redonditas
  qa(14, 15, 16, 1, C.skinD, 0.7);               // sombra bajo el pelo
  q(27, 16, 3, 15, P.skinS);                     // sombra lateral derecha
  q(27, 31, 2, 3, P.skinS);
  q(26, 34, 2, 2, P.skinS);
  q(14, 16, 2, 15, C.skinL);                     // ★ banda de luz fría izquierda
  q(16, 16, 8, 3, C.skinL);                      // luz de la frente
  qa(25, 27, 3, 2, P.skinS, 0.8);                // sombra bajo el pómul dcho
  qa(18, 35, 8, 1, 'rgba(0,0,0,0.15)');          // sombra bajo el labio
  qa(19, 37, 5, 1, C.skinL, 0.55);               // brillo del mentón

  // --- orejas ---
  if (P.ears === 'elf') {
    q(11, 23, 3, 4, P.skin); q(10, 22, 1, 2, P.skin);   // izq (lado de la luz)
    q(11, 23, 1, 2, C.skinL); q(12, 25, 1, 1, P.skinS);
    q(30, 23, 3, 4, P.skinS); q(33, 22, 1, 2, P.skinS); // dcha (en sombra)
    q(31, 25, 1, 1, C.skinD);
  }

  // --- cejas y ojos ---
  if (child) {
    // Teo: ojos grandes y legibles
    q(15, 19, 6, 1, C.hairS); q(23, 19, 6, 1, C.hairS);
    for (const x0 of [15, 23]) {
      if (blink) {
        q(x0, 22, 6, 1, C.lash);
        q(x0, 23, 6, 2, P.skinS);
      } else {
        q(x0, 21, 6, 1, C.lash);                  // párpado superior
        q(x0, 22, 6, 4, C.sclera);
        q(x0 + 1, 22, 3, 3, P.eye);               // iris
        q(x0 + 1, 22, 1, 1, '#ffffff');           // brillo
        q(x0 + 3, 24, 1, 1, C.irisD);
        q(x0, 25, 6, 1, P.skinS);                 // párpado inferior
      }
    }
  } else {
    q(15, 20, 5, 1, C.hairS); q(24, 20, 5, 1, C.hairS);
    if (key !== 'brisa') { q(19, 21, 1, 1, C.hairS); q(24, 21, 1, 1, C.hairS); } // ceñoSerio
    for (const x0 of [16, 24]) {
      if (blink) {
        q(x0, 23, 4, 1, C.lash);
        q(x0, 24, 4, 1, P.skinS);
      } else {
        q(x0, 22, 4, 1, C.lash);                  // pestaña/párpado superior
        q(x0, 23, 4, 2, C.sclera);
        q(x0 + 1, 23, 2, 2, P.eye);               // iris
        q(x0 + 1, 23, 1, 1, '#ffffff');           // brillo 1px
        q(x0 + 2, 24, 1, 1, C.irisD);
        q(x0, 25, 4, 1, P.skinS);                 // párpado inferior
        if (key === 'sasha') { q(x0 + 1, 23, 1, 2, '#141018'); q(x0 + 2, 23, 1, 1, '#ffffff'); } // pupila felina
      }
    }
  }

  // --- nariz (puente iluminado + sombra) ---
  q(21, 26, 2, 4, C.skinL);                      // puente con luz
  q(23, 26, 1, 4, P.skinS);                      // sombra lateral
  q(20, 30, 4, 1, P.skinS);                      // base
  q(20, 30, 1, 1, C.skinD); q(23, 30, 1, 1, C.skinD); // aletas

  // --- boca con labio sombreado ---
  if (!P.beard) {
    if (key === 'corvin' || key === 'sasha') {
      q(18, 33, 5, 1, C.lip); q(23, 32, 1, 1, C.lip);   // sonrisa ladeada
      q(19, 34, 4, 1, mixCol(C.lip, P.skin, 0.55));
    } else {
      q(18, 33, 8, 1, C.lip);
      q(19, 34, 5, 1, mixCol(C.lip, P.skin, 0.55));     // labio inferior
    }
  }

  // --- ojeras de Corvin (curioso y fatigado) ---
  if (key === 'corvin' && !blink) {
    qa(16, 26, 4, 1, 'rgba(30,24,44,0.45)');
    qa(24, 26, 4, 1, 'rgba(30,24,44,0.45)');
  }

  // --- barba en mechones ---
  if (P.beard) {
    for (let x = 15; x <= 28; x++) {
      const len = 10 + (h2(x, 5) % 5);
      q(x, 31, 1, len, P.beard);
    }
    q(17, 31, 10, 1, bS);                          // bigote
    for (let x = 16; x <= 27; x += 3) qa(x, 32, 1, 8, bS, 0.8);   // mechones oscuros
    for (let x = 18; x <= 26; x += 4) qa(x, 33, 1, 7, bL, 0.8);   // mechones claros
    q(20, 34, 4, 1, mixCol(P.beard, '#0a0810', 0.55));            // boca entre barba
    if (key === 'brokk') {
      // trenza trenzada sobre el pecho con anilla
      q(20, 44, 4, 2, P.beard);
      for (let y = 46; y <= 53; y += 2) { q(20, y, 4, 1, (y % 4 === 2) ? bS : P.beard); q(20, y + 1, 4, 1, P.beard); }
      q(20, 50, 4, 1, P.accent ?? '#b07030');      // anilla
      q(21, 55, 2, 2, bS);                         // punta
    }
  }

  // --- pelo frontal en mechones (3 tonos) ---
  if (child) {
    q(13, 5, 18, 3, P.hair);
    q(12, 7, 20, 6, P.hair);
    q(12, 12, 20, 2, C.hairS);
    q(11, 3, 3, 2, P.hair); q(15, 2, 4, 3, P.hair); q(21, 3, 4, 2, P.hair); q(27, 3, 3, 2, P.hair);
    q(31, 5, 2, 2, C.hairS);
    q(14, 6, 3, 1, C.hairL); q(20, 5, 2, 1, C.hairL);
    q(15, 13, 3, 2, P.hair); q(20, 12, 2, 3, P.hair); q(25, 13, 3, 2, P.hair);
  } else {
    q(13, 6, 18, 2, P.hair);
    q(12, 8, 20, 5, P.hair);
    q(12, 12, 20, 2, C.hairS);                     // sombra del casquete
    q(14, 13, 2, 3, P.hair);                       // mechones sobre la frente
    q(17, 14, 3, 2, P.hair);
    q(22, 13, 2, 4, P.hair);
    q(26, 14, 3, 2, P.hair);
    q(29, 13, 2, 2, C.hairS);
    q(14, 7, 4, 1, C.hairL);                       // luces frías del mechón
    q(13, 9, 2, 2, C.hairL);
    q(19, 8, 2, 1, C.hairL);
    q(12, 12, 2, 7, P.hair);                       // sienes
    q(30, 12, 2, 7, C.hairS);
  }

  // --- mechones grises de Brisa + arrugas ---
  if (key === 'brisa') {
    q(15, 8, 2, 4, '#eef0f4'); q(28, 9, 2, 3, '#eef0f4');
    qa(17, 17, 7, 1, 'rgba(0,0,0,0.12)');
    qa(18, 19, 5, 1, 'rgba(0,0,0,0.08)');
    qa(16, 26, 4, 1, 'rgba(0,0,0,0.10)');
    qa(24, 26, 4, 1, 'rgba(0,0,0,0.10)');
    qa(17, 31, 1, 3, 'rgba(0,0,0,0.10)');
    qa(27, 31, 1, 3, 'rgba(0,0,0,0.10)');
  }

  // --- capucha ---
  if (P.hood) {
    q(9, 3, 26, 3, hoodCol);
    q(7, 5, 30, 7, hoodCol);
    q(6, 8, 4, 32, hoodCol);
    q(34, 8, 4, 32, hoodCol);
    qa(10, 11, 4, 26, C.hoodD, 0.9);               // pliegue interior izq
    q(30, 11, 4, 26, C.hoodDD);                    // interior dcho más oscuro
    q(9, 4, 12, 1, C.hoodL);                       // ★ luz fría del borde
    q(7, 7, 1, 12, C.hoodL);
    q(10, 10, 24, 2, C.hoodD);                     // borde sobre la frente
    qa(14, 5, 1, 5, C.hoodDD, 0.6); qa(29, 6, 1, 4, C.hoodDD, 0.6); // pliegues
    if (P.ears === 'cat') {
      // orejas felinas atravesando la capucha
      q(9, 0, 4, 4, hoodCol); q(31, 0, 4, 4, hoodCol);
      q(10, 1, 1, 2, '#c87878'); q(32, 1, 1, 2, '#c87878');
      q(9, 0, 1, 2, C.hoodL);
    }
  }
}

// ---------------- Máscara del Gran Inquisidor ----------------

function drawMask(r: R): void {
  const { q, qa, P, C } = r;
  // manto blanco
  q(4, 46, 36, 16, P.cloth);
  q(29, 46, 11, 16, C.clothS);
  q(4, 46, 36, 1, C.clothD);
  q(4, 47, 8, 2, C.clothL);
  if (P.accent) { q(4, 53, 36, 1, P.accent); q(29, 53, 11, 1, mixCol(P.accent, '#100e18', 0.35)); }
  // yelmo blanco
  q(12, 3, 20, 3, P.hair);
  q(10, 6, 24, 8, P.hair);
  q(9, 13, 26, 4, P.hair);
  q(8, 15, 4, 26, P.hair);                       // laterales que bajan
  q(32, 15, 4, 26, P.hair);
  q(10, 6, 24, 2, C.hairS);
  q(12, 3, 10, 1, C.hairL);                      // luz fría
  q(8, 16, 1, 18, C.hairL);
  // placa facial LISA (alargada, sin ojos/nariz/boca)
  q(14, 12, 16, 21, P.skin);
  q(15, 33, 14, 4, P.skin);
  q(17, 37, 12, 3, P.skin);
  q(27, 13, 3, 20, P.skinS);                     // sombra derecha
  q(26, 33, 3, 4, P.skinS);
  q(14, 13, 2, 19, C.skinL);                     // ★ luz fría izquierda
  qa(16, 14, 5, 2, C.skinL, 0.9);
  qa(16, 14, 3, 14, 'rgba(255,255,255,0.10)');   // brillo vertical
  qa(21, 13, 1, 21, 'rgba(0,0,0,0.10)');         // costura central
  // LA GRIETA NUEVA: zigzag cruzando el ojo derecho
  const gk = '#26222c';
  q(25, 15, 1, 2, gk); q(24, 17, 1, 2, gk); q(25, 19, 2, 1, gk);
  q(24, 20, 1, 2, gk); q(25, 22, 1, 2, gk); q(24, 24, 1, 2, gk); q(25, 26, 1, 1, gk);
  q(26, 18, 1, 1, gk); q(23, 23, 1, 1, gk);      // ramillas
  qa(25, 20, 1, 1, 'rgba(255,255,255,0.35)');    // destello interior
}

// ---------------- Guardián Hueco (sin rostro) ----------------

function drawGuardian(r: R): void {
  const { q, qa, P, C, f } = r;
  // masa inferior pétreo
  q(4, 42, 36, 20, P.cloth);
  q(29, 42, 11, 20, C.clothS);
  q(8, 36, 28, 8, C.hairS);
  q(8, 36, 28, 1, mixCol(C.hairS, '#dfe9f5', 0.2));
  // hueco del pecho con brillo interno
  q(18, 44, 8, 10, '#05030c');
  q(19, 45, 6, 8, '#0d0a1c');
  qa(19, 45, 6, 8, P.eye, 0.10);
  q(21, 47, 2, 4, P.eye);
  // casco craggy
  q(11, 7, 22, 4, P.hair);
  q(9, 10, 26, 13, P.hair);
  q(10, 23, 24, 5, P.hair);
  q(11, 7, 22, 2, C.hairL);                      // canto superior
  q(9, 11, 2, 11, C.hairL);                      // ★ luz fría izquierda
  q(33, 12, 2, 10, C.hairD);                     // sombra derecha
  // cuernos
  q(3, 4, 4, 9, '#8a84a8'); q(2, 1, 3, 5, '#8a84a8'); q(5, 4, 1, 7, '#a8a2c4');
  q(37, 4, 4, 9, '#8a84a8'); q(39, 1, 3, 5, '#8a84a8');
  // cuencas PROFUNDAS — no hay cara
  q(13, 16, 6, 8, '#040209');
  q(25, 16, 6, 8, '#040209');
  q(14, 17, 4, 6, '#0a0716');
  q(26, 17, 4, 6, '#0a0716');
  // glow tenue que respira con f
  const gl = h2(f, 9) % 6 === 0 ? 0.5 : 0.85;
  qa(15, 19, 2, 2, P.eye, gl);
  qa(26, 19, 2, 2, P.eye, gl * 0.85);
  qa(14, 18, 4, 4, P.eye, 0.14);
  qa(25, 18, 4, 4, P.eye, 0.12);
  // grietas del casco
  q(12, 9, 1, 4, '#221d30'); q(13, 13, 1, 2, '#221d30');
  q(31, 11, 1, 5, '#221d30'); q(30, 16, 1, 2, '#221d30');
}

// ---------------- La Sombra (rostro que se desvanece) ----------------

function drawSombra(r: R): void {
  const { q, qa, P, C, f } = r;
  // capucha amplia
  q(6, 4, 32, 6, P.hair);
  q(4, 8, 36, 8, P.hair);
  q(4, 12, 5, 30, P.hair);
  q(35, 12, 5, 30, P.hair);
  // interior vacío
  q(9, 12, 26, 28, '#07040e');
  qa(9, 12, 26, 4, 'rgba(0,0,0,0.55)');
  // borde iluminado frío (izquierda)
  q(6, 4, 12, 1, C.hairL);
  q(4, 9, 1, 22, C.hairL);
  // rostro espectral que se DESVANECE hacia la barbilla
  qa(14, 15, 16, 9, P.skin, 0.42);
  qa(15, 24, 14, 4, P.skin, 0.26);
  qa(17, 28, 10, 3, P.skin, 0.13);
  // ojos violáceos (parpadean con f)
  const dim = h2(f, 5) % 5 === 0;
  qa(16, 16, 5, 5, P.eye, dim ? 0.12 : 0.22);
  qa(23, 16, 5, 5, P.eye, dim ? 0.12 : 0.22);
  q(17, 17, 3, 3, P.eye);
  q(24, 17, 3, 3, P.eye);
  q(18, 18, 1, 1, '#efe6ff');
  // disolución: la barbilla se deshace en píxeles flotantes (animable con t)
  for (let i = 0; i < 10; i++) {
    const fx = 12 + (h2(i * 11 + 3, f * 3 + 1) % 20);
    const fy = 25 + (h2(i * 7 + 1, f * 5 + 2) % 14);
    qa(fx, fy, 1, 1, i % 3 === 0 ? P.eye : P.skin, 0.10 + (h2(i * 3, f + i) % 24) / 100);
  }
  // borde inferior de la capucha rasgado (con huecos)
  for (let x = 9; x < 35; x += 2) {
    if (h2(x, f) % 5 === 0) continue;
    q(x, 40, 2, 2, P.hair);
  }
  // migajas que se desprenden
  for (let i = 0; i < 6; i++) {
    qa(10 + (h2(i * 5, f * 7 + 3) % 24), 43 + (h2(i, f * 3) % 3), 1, 1, P.hair, 0.45);
  }
  // hombros disueltos
  q(3, 46, 38, 16, C.clothS);
  qa(3, 46, 38, 2, 'rgba(0,0,0,0.4)');
}

// ---------------- Wisp ----------------

function drawWisp(r: R): void {
  const { q, qa, P, f, blink } = r;
  // aura por capas
  qa(10, 7, 24, 36, P.skinS, 0.13);
  qa(13, 10, 18, 30, P.skinS, 0.18);
  qa(15, 12, 14, 26, P.skin, 0.42);
  // núcleo
  q(17, 14, 10, 22, '#eafff8');
  q(18, 16, 8, 18, '#f7fffc');
  // ojos etéreos (sin boca)
  if (blink) {
    qa(19, 21, 2, 1, '#7ac8ba', 0.8); qa(24, 21, 2, 1, '#7ac8ba', 0.8);
  } else {
    q(19, 20, 2, 3, '#2e5a54'); q(24, 20, 2, 3, '#2e5a54');
    qa(19, 20, 1, 1, '#ffffff', 0.7); qa(24, 20, 1, 1, '#ffffff', 0.7);
  }
  // motas orbitales (dependen de f)
  for (let i = 0; i < 5; i++) {
    const a = (i * 1.26 + f * 0.9) % 6.283;
    qa(22 + Math.round(Math.cos(a) * 14), 25 + Math.round(Math.sin(a) * 17), 1, 1, P.skinS, 0.35 + (i % 2) * 0.15);
  }
  // cola etérea
  qa(19, 38, 6, 10, P.skinS, 0.10);
  qa(20, 44, 4, 8, P.skinS, 0.08);
}

// ---------------- Fragmento de Eco (cristal dorado) ----------------

function drawCrystal(r: R): void {
  const { q, qa, P, f } = r;
  const lo = f % 2;                              // levitación 1px
  // peana
  q(6, 49, 32, 6, '#3a3020');
  q(6, 49, 32, 1, '#5c4c2e');
  q(8, 48, 28, 1, '#4a3e26');
  // halo dorado
  qa(13, 10 + lo, 18, 30, P.skinS, 0.12);
  // cristal facetado
  q(20, 7 + lo, 4, 6, P.skin);
  q(15, 12 + lo, 14, 22, P.skinS);
  q(17, 14 + lo, 10, 18, P.skin);
  q(19, 16 + lo, 6, 14, '#fff3cf');
  q(15, 12 + lo, 1, 22, mixCol(P.skinS, '#dfe9f5', 0.35));  // luz izquierda
  q(28, 14 + lo, 1, 18, mixCol(P.skinS, '#0a0810', 0.30));  // sombra derecha
  qa(19, 13 + lo, 1, 20, 'rgba(255,255,255,0.25)');
  // eco interior
  q(20, 20 + lo, 3, 5, P.skinS);
  q(21, 20 + lo, 1, 2, '#fffbe0');
  // chispas orbitales
  for (let i = 0; i < 4; i++) {
    const a = (i * 1.57 + f * 0.8) % 6.283;
    qa(22 + Math.round(Math.cos(a) * 12), 23 + lo + Math.round(Math.sin(a) * 14), 1, 1, P.hair, 0.5);
  }
}

// ---------------- Santuario (cristal turquesa) ----------------

function drawSanctuary(r: R): void {
  const { q, qa, P, f } = r;
  // halo
  qa(15, 5, 14, 32, P.skinS, 0.14);
  qa(17, 8, 10, 26, P.skinS, 0.10);
  // cristal
  q(20, 5, 4, 5, P.skin);
  q(17, 9, 10, 26, P.skinS);
  q(19, 11, 6, 22, P.skin);
  q(20, 13, 4, 18, '#e8fcff');
  q(17, 9, 1, 26, mixCol(P.skinS, '#dfe9f5', 0.40));  // luz izquierda
  q(26, 11, 1, 22, mixCol(P.skinS, '#0a0810', 0.30)); // sombra derecha
  // ojo interior
  q(21, 16, 2, 7, P.eye);
  // peana de piedra con runas (una se enciende por paso de f)
  q(5, 40, 34, 13, P.clothS);
  q(5, 40, 34, 2, P.cloth);
  q(5, 40, 12, 1, mixCol(P.cloth, '#dfe9f5', 0.25));
  for (let i = 0; i < 4; i++) q(8 + i * 8, 45, 2, 4, i === f % 4 ? '#bff4ff' : '#2c3844');
  // motas ascendentes
  for (let i = 0; i < 3; i++) {
    qa(18 + (h2(i, f) % 9), 36 - ((f * 2 + i * 5) % 10), 1, 1, '#bff4ff', 0.4);
  }
}

// ---------------- Esqueleto (mandíbula colgante) ----------------

function drawSkeleton(r: R): void {
  const { q, qa, P, C, f } = r;
  // harapos
  q(5, 44, 34, 18, P.cloth);
  q(28, 44, 11, 18, C.clothS);
  q(5, 44, 34, 2, P.clothS);
  q(5, 44, 9, 1, C.clothL);                      // ★ luz fría izquierda
  // clavículas y esternón
  q(12, 45, 7, 1, P.skin); q(26, 45, 7, 1, P.skin);
  q(18, 46, 8, 1, P.skinS);
  // cráneo con volumen
  q(15, 9, 14, 3, P.skin);
  q(13, 11, 18, 12, P.skin);
  q(14, 23, 16, 6, P.skin);
  q(15, 9, 10, 1, C.skinL);
  q(13, 12, 2, 9, C.skinL);                      // banda de luz izquierda
  q(28, 13, 3, 9, P.skinS);                      // sombra derecha
  q(14, 28, 16, 1, P.skinS);
  // cuencas oscuras y profundas
  q(15, 16, 5, 6, '#0c0812');
  q(24, 16, 5, 6, '#0c0812');
  q(16, 17, 3, 4, '#060410');
  q(25, 17, 3, 4, '#060410');
  qa(17, 18, 1, 1, P.eye, 0.55); qa(26, 18, 1, 1, P.eye, 0.55); // puñado de luz muerta
  // nasal
  q(20, 23, 4, 2, '#0c0812'); q(21, 25, 2, 2, '#0c0812');
  // dientes superiores
  q(15, 29, 14, 2, '#39323e');
  for (let x = 16; x <= 27; x += 2) q(x, 29, 1, 2, P.skin);
  // hueco negro entre maxilar y mandíbula
  qa(15, 31, 14, 4, 'rgba(0,0,0,0.55)');
  // MANDÍBULA COLGANTE (oscila 1px con f)
  const drop = f % 2;
  for (let x = 17; x <= 27; x += 2) q(x, 33 + drop, 1, 2, P.skin);  // dientes inferiores
  q(16, 35 + drop, 13, 3, P.skin);
  q(16, 37 + drop, 13, 1, P.skinS);
  // grietas del cráneo
  q(19, 10, 1, 3, '#4e483c'); q(20, 13, 1, 2, '#4e483c');
  q(24, 11, 1, 2, '#4e483c');
}

// ---------------- Render de un retrato al canvas interno ----------------

function renderPortrait(P: PortraitDef, key: string, blink: boolean, f: number): HTMLCanvasElement {
  const { c, x: g } = mkCanvas(PW, PH);
  const q = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  const qa = (x: number, y: number, w: number, h: number, col: string, a = 1) => {
    const prev = g.globalAlpha;
    g.globalAlpha = prev * a;
    g.fillStyle = col; g.fillRect(x, y, w, h);
    g.globalAlpha = prev;
  };
  const r: R = { q, qa, P, C: deriveCols(P), key, f, blink };
  q(0, 0, PW, PH, P.bg);
  drawScenario(r);
  const vg = vignettes();
  g.drawImage(vg.glow, 0, 0);
  switch (P.kind) {
    case 'human': drawHuman(r); break;
    case 'mask': drawMask(r); break;
    case 'guardian': drawGuardian(r); break;
    case 'sombra': drawSombra(r); break;
    case 'wisp': drawWisp(r); break;
    case 'crystal': drawCrystal(r); break;
    case 'sanctuary': drawSanctuary(r); break;
    case 'skeleton': drawSkeleton(r); break;
  }
  g.drawImage(vg.dark, 0, 0);
  return c;
}

// ---------------- Cache y API pública ----------------

interface CacheEntry { c: HTMLCanvasElement; sig: string }
const cache = new Map<string, CacheEntry>();

/** Devuelve el canvas 44×62 del retrato, re-renderizando solo si cambia blink/paso de t. */
function getPortrait(key: string, blink: boolean, t: number): HTMLCanvasElement {
  const def = PORTRAITS[key] ?? PORTRAITS['wisp'];
  const ck = PORTRAITS[key] !== undefined ? key : 'wisp';
  const f = Math.floor(t / T_STEP);              // paso de animación determinista
  const sig = `${blink ? 1 : 0}:${f}`;
  const hit = cache.get(ck);
  if (hit && hit.sig === sig) return hit.c;
  const c = renderPortrait(def, ck, blink, f);
  if (cache.size > 48) cache.clear();            // techo de memoria (retratos son pequeños)
  cache.set(ck, { c, sig });
  return c;
}

/**
 * Dibuja el retrato de diálogo por clave. Dos modos compatibles:
 *  · drawPortrait(ctx, key, dx, dy, scale, blink?, t?) — legado: estampa
 *    28×scale × 40×scale px (misma huella que antes, ahora con detalle 44×62).
 *  · drawPortrait(ctx, key, x, y, w, h, t?) — encaja el lienzo 44×62 en w×h.
 * blink cierra los ojos (parpadeo del diálogo). t (ms) anima la Sombra,
 * el Guardián, el esqueleto y las motas; sin t, retrato estático.
 * Fallback seguro a 'wisp' si la clave no existe.
 */
export function drawPortrait(
  ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, t?: number,
): void;
export function drawPortrait(
  ctx: CanvasRenderingContext2D, key: string, dx: number, dy: number, scale: number, blink?: boolean, t?: number,
): void;
export function drawPortrait(
  ctx: CanvasRenderingContext2D, key: string,
  ax: number, ay: number, m: number,
  extra?: boolean | number, t = 0,
): void {
  // modo w/h si el 6.º argumento es número; modo scale/blink si es booleano
  const modoWH = typeof extra === 'number';
  const dw = Math.round(modoWH ? m : LEG_W * m);
  const dh = Math.round(modoWH ? (extra as number) : LEG_H * m);
  const blink = modoWH ? false : extra === true;
  const c = getPortrait(key, blink, t);
  ctx.save();
  ctx.imageSmoothingEnabled = false;             // píxel nítido al escalar
  ctx.drawImage(c, Math.round(ax), Math.round(ay), dw, dh);
  ctx.restore();
}
