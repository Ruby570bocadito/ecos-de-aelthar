// ============================================================
// ECOS DE AELTHAR — Retratos de diálogo (módulo actors)
// 28×40 escalables, generados por código.
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