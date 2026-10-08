// ============================================================
// ECOS DE AELTHAR — Tiles de hierba y naturaleza (módulo world)
// Casos: '.' hierba · ',' hierba alta/flores · 'c' cultivo
//        'm' niebla muda (suelo transitable)
// Contrato: paintGrass llamada por el despachador drawTile.
// Terreno natural: ruido de valor de 2 octavas → parches de 6
// tonos, briznas/matitas, rarezas de aparición baja y
// transiciones con caminos ('='), agua ('~') y sólidos usando
// los vecinos `at` (autotiling). Todo con fillRect de enteros;
// el suelo se prerrenderiza una vez por mapa/época.
// ============================================================

import { hash2 } from './palette';
import { px, PAL, isForest, pick, type NeighborFn } from './palette';

// ---------------- Tonos y ruido de valor ----------------

/** Tonos de hierba del valle, del más oscuro al más claro (6). */
const TONOS_LUNARIS: string[] = [
  PAL.grassDark, PAL.grassLunaris[3], PAL.grassLunaris[1],
  PAL.grassLunaris[0], PAL.grassLunaris[2], PAL.grassBlade,
];
/** Tonos de hierba del bosque, del más oscuro al más claro (6). */
const TONOS_BOSQUE: string[] = [
  '#2c4f2a', PAL.grassBosque[3], PAL.grassBosque[1],
  PAL.grassBosque[0], PAL.grassBosque[2], PAL.grassBladeBosque,
];
/** Hierba apagada bajo la niebla muda ('m'). */
const TONOS_NIEBLA: string[] = ['#333f38', '#3a473f', '#414f46', '#48574d', '#505f54', '#586759'];
/** Tierra del cultivo ('c'), del más oscuro al más claro. */
const TIERRA: string[] = ['#54402a', '#5f4629', '#6a4e30', '#71543a'];

/** Familia de tiles de hierba (no generan sombra de contacto entre sí). */
const HIERBA = new Set(['.', ',', 'c', 'm']);

/** Ruido de valor bilineal suavizado sobre rejilla de celdas L×L px. */
function vnoise(vx: number, vy: number, L: number, seed: number): number {
  const gx = Math.floor(vx / L), gy = Math.floor(vy / L);
  const fx = vx / L - gx, fy = vy / L - gy;
  const s2 = seed * 2;
  const a = hash2(gx + seed, gy + s2);
  const b = hash2(gx + 1 + seed, gy + s2);
  const c = hash2(gx + seed, gy + 1 + s2);
  const d = hash2(gx + 1 + seed, gy + 1 + s2);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Tono de hierba en un píxel global: 2 octavas → manchas orgánicas. */
function tonoEn(vx: number, vy: number, tones: string[]): string {
  const n = 0.62 * vnoise(vx, vy, 7, 11) + 0.38 * vnoise(vx, vy, 3, 47);
  let k = (n - 0.2) / 0.6;
  if (k < 0) k = 0; else if (k > 0.999) k = 0.999;
  return tones[(k * 6) | 0];
}

/** Tono de tierra para el cultivo (mismo ruido, otras semillas). */
function tonoTierra(vx: number, vy: number): string {
  const n = 0.6 * vnoise(vx, vy, 9, 91) + 0.4 * vnoise(vx, vy, 4, 23);
  let k = (n - 0.2) / 0.6;
  if (k < 0) k = 0; else if (k > 0.999) k = 0.999;
  return TIERRA[(k * 4) | 0];
}

/** Base moteada: pinta 16×16 agrupando runs horizontales del mismo tono. */
function baseMoteado(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tonoFn: (vx: number, vy: number) => string,
): void {
  for (let j = 0; j < 16; j++) {
    let ini = 0, tono = '';
    for (let i = 0; i <= 16; i++) {
      const tk = i < 16 ? tonoFn(X0 + i, Y0 + j) : '';
      if (tk !== tono) {
        if (i > ini) px(x, X0 + ini, Y0 + j, i - ini, 1, tono);
        ini = i; tono = tk;
      }
    }
  }
}

// ---------------- Detalles de hierba ----------------

/** Briznas sueltas variadas: 1×2, 2×1, en L; algunas más oscuras. */
function briznas(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, cL: string, cD: string,
): void {
  const n = 3 + ((hash2(tx * 13 + 1, ty * 17 + 2) * 4) | 0);
  for (let k = 0; k < n; k++) {
    const bx = X0 + 1 + ((hash2(tx * 31 + k * 7, ty * 29 + k * 3) * 13) | 0);
    const by = Y0 + 2 + ((hash2(tx * 17 + k * 5, ty * 41 + k * 11) * 12) | 0);
    const s = hash2(tx * 5 + k * 3, ty * 23 + k);
    const col = s < 0.3 ? cD : cL;
    if (s < 0.45) px(x, bx, by, 1, 2, col);                       // vertical
    else if (s < 0.68) px(x, bx, by, 2, 1, col);                  // tumbada
    else if (s < 0.9) { px(x, bx, by, 1, 2, col); px(x, bx + 1, by, 1, 1, col); } // en L
    else px(x, bx, by, 1, 1, col);
  }
}

/** Mata densa ocasional: 3×3 con puntas claras, cuerpo medio y base oscura. */
function mata(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, cL: string, cM: string, cD: string,
): void {
  if (hash2(tx * 3 + 11, ty * 5 + 13) >= 0.09) return;
  const bx = X0 + 2 + ((hash2(tx * 9, ty * 21) * 10) | 0);
  const by = Y0 + 3 + ((hash2(tx * 15, ty * 25) * 9) | 0);
  px(x, bx, by, 1, 1, cL); px(x, bx + 2, by, 1, 1, cL);
  px(x, bx, by + 1, 3, 1, cM);
  px(x, bx, by + 2, 3, 1, cD);
}

/** Rareza (<2% de tiles): champiñón, guijarro claro, trébol o pisada. */
function rareza(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, cD: string,
): void {
  if (hash2(tx * 19 + 7, ty * 23 + 3) >= 0.02) return;
  const bx = X0 + 3 + ((hash2(tx * 7, ty * 31) * 9) | 0);
  const by = Y0 + 3 + ((hash2(tx * 11, ty * 37) * 9) | 0);
  switch (pick(hash2(tx * 29, ty * 13), 4)) {
    case 0: // champiñón diminuto
      px(x, bx, by, 2, 1, '#a8503a');
      px(x, bx, by, 1, 1, '#e8d0b0');
      px(x, bx, by + 1, 1, 1, '#d8c9a0');
      break;
    case 1: // guijarro claro
      px(x, bx, by, 2, 1, PAL.stoneHi);
      px(x, bx, by + 1, 1, 1, PAL.stoneDark);
      break;
    case 2: // trébol de 4 hojas
      px(x, bx + 1, by, 1, 1, '#2f7a3e');
      px(x, bx, by + 1, 1, 1, '#2f7a3e');
      px(x, bx + 2, by + 1, 1, 1, '#2f7a3e');
      px(x, bx + 1, by + 2, 1, 1, '#2f7a3e');
      px(x, bx + 1, by + 3, 1, 1, cD);
      break;
    default: // zigzag de hierba pisada
      px(x, bx, by, 1, 1, cD);
      px(x, bx + 1, by + 1, 1, 1, cD);
      px(x, bx + 2, by, 1, 1, cD);
      px(x, bx + 3, by + 1, 1, 1, cD);
      break;
  }
}

// ---------------- Transiciones de borde (usa `at`) ----------------

type Pintor = (k: number, m: number, c: string) => void;

/** Devuelve un pintor de píxel a `m` px hacia dentro desde el lado `side`. */
function pintorLado(x: CanvasRenderingContext2D, X0: number, Y0: number, side: number): Pintor {
  // side 0=N (borde superior) · 1=S · 2=O · 3=E
  if (side === 0) return (k, m, c) => px(x, X0 + k, Y0 + m, 1, 1, c);
  if (side === 1) return (k, m, c) => px(x, X0 + k, Y0 + 15 - m, 1, 1, c);
  if (side === 2) return (k, m, c) => px(x, X0 + m, Y0 + k, 1, 1, c);
  return (k, m, c) => px(x, X0 + 15 - m, Y0 + k, 1, 1, c);
}

/** Diente simple de 1px con umbral (difuminados suaves entre hierbas). */
function diente1(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  side: number, tx: number, ty: number, c: string, umbral: number,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) {
    if (hash2(tx * 21 + k + side * 57, ty * 21 + side * 31) < umbral) p(k, 0, c);
  }
}

/** Borde de tierra hacia un camino '=': dientes de 0-2px, grano y piedritas. */
function bordeCamino(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  side: number, tx: number, ty: number,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) {
    const h = hash2(tx * 16 + k + side * 57, ty * 16 + side * 31);
    const d = h < 0.25 ? 2 : h < 0.8 ? 1 : 0;
    for (let m = 0; m < d; m++) {
      const h2 = hash2(tx * 32 + k * 3 + m, ty * 32 + side * 7 + m * 5);
      p(k, m, h2 < 0.55 ? PAL.path : PAL.pathDark);
    }
    if (d > 0 && hash2(tx * 8 + k, ty * 8 + side * 13) < 0.3) p(k, d - 1, PAL.pathShadow);
    if (d > 0 && d < 2 && hash2(tx * 12 + k, ty * 12 + side * 17) < 0.12) p(k, d, PAL.pathLight);
  }
}

/** Orilla hacia agua ('~','B','x'): banda húmeda oscura de 0-2px con barro. */
function bordeAgua(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  side: number, tx: number, ty: number, cWet: string,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) {
    const h = hash2(tx * 16 + k + side * 71, ty * 16 + side * 13 + 5);
    const d = h < 0.35 ? 2 : h < 0.8 ? 1 : 0;
    for (let m = 0; m < d; m++) {
      const h2 = hash2(tx * 24 + k * 5 + m, ty * 24 + side * 3 + m);
      p(k, m, h2 < 0.75 ? cWet : '#3d4a2c');
    }
  }
}

/** Borde de cultivo ('c') contra hierba: tierra desgastada + hierba que invade. */
function bordeCultivo(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  side: number, tx: number, ty: number, cG: string,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) {
    const h = hash2(tx * 21 + k + side * 41, ty * 21 + side * 11);
    if (h < 0.4) p(k, 0, '#4a3620');
    else if (h < 0.65) p(k, 0, cG);
  }
}

/** Sombra de contacto de 1px contra un tile sólido (árboles, muros, rocas…). */
function bordeSolido(
  x: CanvasRenderingContext2D, X0: number, Y0: number, side: number, cD: string,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) p(k, 0, cD);
}

/** Aplica transiciones de los 4 lados según el char del vecino `at`. */
function transiciones(
  x: CanvasRenderingContext2D, X0: number, Y0: number, tx: number, ty: number,
  ch: string, mapId: string, at?: NeighborFn,
): void {
  if (!at) return;
  const forest = isForest(mapId);
  const cD = forest ? '#2c4f2a' : PAL.grassDark;
  const cWet = forest ? PAL.grassWetBosque : PAL.grassWet;
  const cMid = forest ? TONOS_BOSQUE[3] : TONOS_LUNARIS[3];
  for (let side = 0; side < 4; side++) {
    const dx = side === 2 ? -1 : side === 3 ? 1 : 0;
    const dy = side === 0 ? -1 : side === 1 ? 1 : 0;
    const nb = at(dx, dy);
    if (nb === '=') bordeCamino(x, X0, Y0, side, tx, ty);
    else if (nb === '~' || nb === 'B' || nb === 'x') bordeAgua(x, X0, Y0, side, tx, ty, cWet);
    else if (HIERBA.has(nb)) {
      if (ch === 'c' && nb !== 'c') bordeCultivo(x, X0, Y0, side, tx, ty, cMid);
      else if (nb === 'm' && ch !== 'm') diente1(x, X0, Y0, side, tx, ty, TONOS_NIEBLA[3], 0.35);
      else if (nb !== 'm' && ch === 'm') diente1(x, X0, Y0, side, tx, ty, cMid, 0.35);
    } else if (nb !== 'V') {
      bordeSolido(x, X0, Y0, side, ch === 'c' ? '#4a3620' : cD);
    }
  }
}

// ---------------- Casos especiales ----------------

/** ',' hierba alta: briznas de 3-5px con cabeza y flores de 5 colores. */
function paintAlta(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, mapId: string,
): void {
  const forest = isForest(mapId);
  const cL = forest ? PAL.grassBladeBosque : PAL.grassBlade;
  const cD = forest ? '#2c4f2a' : PAL.grassDark;
  // briznas altas (3-5px) con cabeza más clara y algún codo en L
  const nB = 3 + ((hash2(tx, ty) * 3) | 0);
  for (let k = 0; k < nB; k++) {
    const bx = X0 + 1 + ((hash2(tx * 3 + k * 5, ty * 13 + k) * 13) | 0);
    const top = Y0 + 3 + ((hash2(tx * 9 + k, ty * 7 + k * 3) * 6) | 0);
    const h = 3 + ((hash2(tx * 11 + k * 7, ty * 3 + k) * 3) | 0);
    const col = hash2(tx * 17 + k, ty * 19 + k) < 0.4 ? cD : cL;
    px(x, bx, top, 1, h, col);
    px(x, bx, top - 1, 1, 1, forest ? '#67a05e' : '#78b86a');
    if (hash2(tx * 23 + k, ty * 29 + k) < 0.35) px(x, bx + 1, top + 1, 1, 1, col);
  }
  // flores: pétalos 2×2, centro claro y sombra de 1px debajo
  const nF = hash2(tx * 7 + 3, ty * 11 + 5) < 0.55 ? 1 : 2;
  for (let f = 0; f < nF; f++) {
    const fx = X0 + 2 + ((hash2(tx * 41 + f * 3, ty * 43 + f) * 11) | 0);
    const fy = Y0 + 4 + ((hash2(tx * 47 + f, ty * 31 + f * 5) * 9) | 0);
    const col = PAL.flowerCols[pick(hash2(tx * 53 + f, ty * 59 + f), PAL.flowerCols.length)];
    px(x, fx, fy, 2, 2, col);
    px(x, fx, fy, 1, 1, PAL.flowerCore);
    px(x, fx, fy + 2, 2, 1, cD);
  }
}

/** 'c' cultivo: tierra moteada, surcos curvos, brotes de 2 tonos y piedrita. */
function paintCultivo(
  x: CanvasRenderingContext2D, X0: number, Y0: number, tx: number, ty: number,
): void {
  baseMoteado(x, X0, Y0, tonoTierra);
  // surcos curvos (perspectiva) con deriva vertical por fila de tiles
  for (let row = 0; row < 3; row++) {
    const yB = 3 + row * 4 + ((ty * 2 + row * 3) % 3);
    const fase = hash2(tx, ty * 3 + row) * 6.283;
    const curva = (i: number) =>
      Math.max(5, Math.min(13, yB + Math.round(Math.sin((X0 + i) * 0.5 + fase) * 1.4)));
    for (let i = 0; i < 16; i++) {
      const yC = curva(i);
      px(x, X0 + i, Y0 + yC, 1, 1, '#4a3620');       // surco oscuro
      px(x, X0 + i, Y0 + yC - 1, 1, 1, '#7a5c3a');   // lomo claro
    }
    // brotes de 2 tonos sobre cada surco
    const nS = 3 + ((hash2(tx * 7 + row, ty * 5 + row) * 2) | 0);
    for (let s = 0; s < nS; s++) {
      const i = 1 + ((hash2(tx * 13 + row * 3 + s * 5, ty * 11 + s * 7) * 14) | 0);
      const yC = curva(i);
      const oscuro = hash2(tx + s * 3, ty * 17 + row * 5 + s) < 0.5;
      px(x, X0 + i, Y0 + yC - 3, 1, 2, oscuro ? '#427a3a' : '#4f8a46');
      px(x, X0 + i, Y0 + yC - 4, 1, 1, oscuro ? '#578f4c' : '#6fbf62');
    }
  }
  // alguna piedrecita suelta
  if (hash2(tx * 3 + 1, ty * 9 + 7) < 0.5) {
    const gx = X0 + 3 + ((hash2(tx * 37, ty * 41) * 10) | 0);
    const gy = Y0 + 2 + ((hash2(tx * 43, ty * 47) * 3) | 0);
    px(x, gx, gy, 1, 1, PAL.pathLight);
  }
}

/** 'm' niebla muda: hierba apagada + veladura + motas a la deriva (usa t). */
function paintMist(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, t: number,
): void {
  baseMoteado(x, X0, Y0, (vx, vy) => tonoEn(vx, vy, TONOS_NIEBLA));
  briznas(x, X0, Y0, tx, ty, '#57695d', '#3a473f');
  // veladura gris-verdosa translúcida
  x.globalAlpha = 0.16;
  px(x, X0, Y0, 16, 16, '#9ec4b4');
  // motas claras que derivan (con t; congeladas en el prerrender se ven bien)
  x.globalAlpha = 0.4;
  const nM = 2 + ((hash2(tx * 5 + 3, ty * 7 + 1) * 2) | 0);
  for (let k = 0; k < nM; k++) {
    const mx = X0 + 1 + (((((hash2(tx + k * 7, ty * 3 + k) * 12 + t * (1.2 + k * 0.8)) % 12) + 12) % 12) | 0);
    const my = Y0 + 2 + (((((hash2(tx * 3 + k, ty + k * 5) * 9 + Math.sin(t * 0.9 + tx + k * 2.1) * 2) % 9) + 9) % 9) | 0);
    if (k % 2 === 0) px(x, mx, my, 2, 1, '#b8d8c8');
    else px(x, mx, my, 1, 2, '#b8d8c8');
  }
  x.globalAlpha = 1;
}

// ---------------- Punto de entrada ----------------

/** Pinta un tile de hierba/naturaleza completo (llamado por drawTile). */
export function paintGrass(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number, at?: NeighborFn,
): void {
  const X0 = tx * 16, Y0 = ty * 16;
  const forest = isForest(mapId);
  const cD = forest ? '#2c4f2a' : PAL.grassDark;
  const cL = forest ? PAL.grassBladeBosque : PAL.grassBlade;
  if (ch === 'c') {
    paintCultivo(x, X0, Y0, tx, ty);
  } else if (ch === 'm') {
    paintMist(x, X0, Y0, tx, ty, t);
  } else {
    const tones = forest ? TONOS_BOSQUE : TONOS_LUNARIS;
    baseMoteado(x, X0, Y0, (vx, vy) => tonoEn(vx, vy, tones));
    if (ch === ',') {
      paintAlta(x, X0, Y0, tx, ty, mapId);
    } else {
      briznas(x, X0, Y0, tx, ty, cL, cD);
      mata(x, X0, Y0, tx, ty, cL, tones[2], cD);
      rareza(x, X0, Y0, tx, ty, cD);
    }
  }
  transiciones(x, X0, Y0, tx, ty, ch, mapId, at);
}
