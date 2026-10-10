// ============================================================
// ECOS DE AELTHAR — Tiles de hierba y naturaleza (módulo world)
// Casos: '.' hierba · ',' hierba alta/flores · 'c' cultivo
//        'm' niebla muda (suelo transitable)
// Contrato: paintGrass llamada por el despachador drawTile
// (FIRMA INMUTABLE). El suelo se prerrenderiza UNA VEZ por
// mapa/época (buildGround en engine.ts) — aquí TODO es calidad
// ESTÁTICA: no hay animación por tile. El "viento" es un CAMPO
// DE FLUJO (windDir, ruido suavizado en coordenadas globales)
// que peina los mechones con orientación coherente entre tiles
// vecinos: el prado parece peinado aunque esté congelado.
// v3 (R4-A5): mechones direccionales por campo de flujo ·
// transiciones de 2-3px en gradiente de motas (camino '=' /
// piedra ':'-familia / agua '~Bx') · flores v2 por racimos
// (campánula azul, margarita pálida, flor de eco cian) ·
// 'm' con matas de 2 alturas y semillas doradas · 'c' con
// lechos de flores densos · desgaste pisado junto a caminos
// (nivelDesgaste). Todo determinista: hash2 ∈ [0,0.5) →
// h1 = hash2×2 → [0,1); fillRect de enteros; sin allocations
// masivas por tile (<1 ms/tile medio en prerrender).
// ============================================================

import { hash2 } from './palette';
import { px, PAL, isForest, pick, type NeighborFn } from './palette';

/** hash2 devuelve [0,0.5): ×2 lo lleva a rango completo [0,1). */
function h1(a: number, b: number): number { return hash2(a, b) * 2; }

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
/** Hierba pisada (desgaste junto a caminos): oliva apagado, más corta. */
const TONOS_DESG_VALLE: string[] =
  ['#4e5a3a', '#55613f', '#5c6844', '#636f4a', '#6a7650', '#717d56'];
const TONOS_DESG_BOSQUE: string[] =
  ['#3c4a36', '#43513c', '#4a5842', '#515f48', '#58664e', '#5f6d54'];

/** Familia de tiles de hierba (no generan sombra de contacto entre sí). */
const HIERBA = new Set(['.', ',', 'c', 'm']);
/** Familia de piedra/losa (transición de 2-3px con musgo). */
const PIEDRA = new Set([':', '_', '#', 'P', 'A']);
/** Punta clara de los mechones por mapa (v3). */
export const TIP_MECHON_VALLE = '#78b86a';
export const TIP_MECHON_BOSQUE = '#67a05e';

/** Ruido de valor bilineal suavizado sobre rejilla de celdas L×L px.
 *  hash2 ∈ [0,0.5) → ×2 dentro: el ruido usa su rango completo [0,1)
 *  (antes los 6 tonos caían comprimidos en los 3 más oscuros). */
function vnoise(vx: number, vy: number, L: number, seed: number): number {
  const gx = Math.floor(vx / L), gy = Math.floor(vy / L);
  const fx = vx / L - gx, fy = vy / L - gy;
  const s2 = seed * 2;
  const a = hash2(gx + seed, gy + s2) * 2;
  const b = hash2(gx + 1 + seed, gy + s2) * 2;
  const c = hash2(gx + seed, gy + 1 + s2) * 2;
  const d = hash2(gx + 1 + seed, gy + 1 + s2) * 2;
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

// ---------------- Campo de flujo (viento estático, v3) ----------------

/**
 * Ángulo del "viento" en un punto global (radianes). Campo suave y
 * continuo: 2 octavas de ruido de valor en coordenadas GLOBALES de
 * píxel → los tiles vecinos comparten orientación y la dirección
 * cambia de forma gradual (gradiente continuo, sin costuras ni
 * saltos). Es la misma función que usan los mechones, así que el
 * prado entero queda peinado en una dirección coherente por zona.
 * Exportada para tests/harness; no anima (prerrender estático).
 */
export function windDir(vx: number, vy: number): number {
  const n = 0.85 * vnoise(vx, vy, 112, 311) + 0.15 * vnoise(vx, vy, 28, 463);
  return n * 6.2831853;
}

/** Octante horizontal de un ángulo: -1 (oeste) · 0 (calma) · 1 (este). */
export function octDX(a: number): number {
  const c = Math.cos(a);
  return c > 0.45 ? 1 : c < -0.45 ? -1 : 0;
}

// ---------------- Mechones direccionales (v3) ----------------

/**
 * Mechones v3 (sustituyen a las briznas de R1): 3-6 tallos con punta
 * peinada por windDir en su posición global — la orientación depende
 * del campo de flujo, no del azar del tile, así que vecinos comparten
 * dirección. `wear` (0..1) acorta y apaga: sendero pisado.
 */
function mechones(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, cL: string, cD: string, tip: string, wear: number,
): void {
  const corto = wear > 0.55;
  const n = corto ? 2 + pick(h1(tx * 13 + 1, ty * 17 + 2), 2)
    : wear >= 0.4 ? 3 + pick(h1(tx * 13 + 1, ty * 17 + 2), 3)
      : 3 + pick(h1(tx * 13 + 1, ty * 17 + 2), 4); // 3-6 mechones
  for (let k = 0; k < n; k++) {
    const bx = X0 + 1 + ((h1(tx * 31 + k * 7, ty * 29 + k * 3) * 14) | 0);
    const by = Y0 + 3 + ((h1(tx * 17 + k * 5, ty * 41 + k * 11) * 10) | 0);
    const a = windDir(bx, by);            // campo de flujo global (coherente)
    const dx = octDX(a);
    const s = h1(tx * 5 + k * 3, ty * 23 + k);
    const col = s < 0.3 ? cD : cL;
    const h = corto || s < 0.5 ? 1 : 2;   // hierba pisada = tallo corto
    px(x, bx, by, 1, h, col);             // tallo
    px(x, bx + dx, by - 1, 1, 1, tip);    // punta peinada por el viento
    if (h === 2 && dx !== 0 && s > 0.6 && Math.abs(Math.cos(a)) > 0.75) {
      px(x, bx + dx, by, 1, 1, col);      // codo en L: racha de viento
    }
  }
}

/** Mata densa ocasional: 3×3 con puntas claras, cuerpo medio y base oscura. */
function mata(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, cL: string, cM: string, cD: string,
): void {
  if (h1(tx * 3 + 11, ty * 5 + 13) >= 0.09) return;
  const bx = X0 + 2 + ((h1(tx * 9, ty * 21) * 10) | 0);
  const by = Y0 + 3 + ((h1(tx * 15, ty * 25) * 9) | 0);
  px(x, bx, by, 1, 1, cL); px(x, bx + 2, by, 1, 1, cL);
  px(x, bx, by + 1, 3, 1, cM);
  px(x, bx, by + 2, 3, 1, cD);
}

/** Rareza (<2% de tiles): champiñón, guijarro claro, trébol o pisada. */
function rareza(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, cD: string,
): void {
  if (h1(tx * 19 + 7, ty * 23 + 3) >= 0.02) return;
  const bx = X0 + 3 + ((h1(tx * 7, ty * 31) * 9) | 0);
  const by = Y0 + 3 + ((h1(tx * 11, ty * 37) * 9) | 0);
  switch (pick(h1(tx * 29, ty * 13), 4)) {
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

// ---------------- Flores v2 por racimos ----------------

/**
 * Especies v2 (colores disjuntos entre sí y con flowerCols):
 * 0 campánula azul [pétalo, boca, brillo] · 1 margarita pálida
 * [pétalo, corazón] · 2 flor de eco cian [cuerpo, sombra, brillo 1px].
 */
export const FLORES_V2: string[][] = [
  ['#5a7ad0', '#4a66b4', '#8ca8ec'], // campánula azul
  ['#ece6d2', '#d8c070'],            // margarita pálida
  ['#8ad0d8', '#6ab0bc', '#d8f6f8'], // flor de eco (cian tenue que brilla)
];

/** Dibuja una flor de la especie `sp` con su firma de 4-5 px. */
function florEspecie(
  x: CanvasRenderingContext2D, sp: number, bx: number, by: number, cD: string,
): void {
  if (sp === 0) {
    // campánula azul: campana 2×2 con brillo y boca oscura + tallito
    px(x, bx, by, 1, 1, FLORES_V2[0][0]);
    px(x, bx + 1, by, 1, 1, FLORES_V2[0][2]);
    px(x, bx, by + 1, 1, 1, FLORES_V2[0][1]);
    px(x, bx + 1, by + 1, 1, 1, FLORES_V2[0][0]);
    px(x, bx, by + 2, 1, 1, cD);
  } else if (sp === 1) {
    // margarita pálida: cruz 3×3 con corazón dorado
    px(x, bx + 1, by, 1, 1, FLORES_V2[1][0]);
    px(x, bx, by + 1, 1, 1, FLORES_V2[1][0]);
    px(x, bx + 2, by + 1, 1, 1, FLORES_V2[1][0]);
    px(x, bx + 1, by + 2, 1, 1, FLORES_V2[1][0]);
    px(x, bx + 1, by + 1, 1, 1, FLORES_V2[1][1]);
  } else {
    // flor de eco: 2×2 cian tenue con 1px de brillo propio
    px(x, bx, by, 1, 1, FLORES_V2[2][0]);
    px(x, bx + 1, by, 1, 1, FLORES_V2[2][2]);
    px(x, bx, by + 1, 1, 1, FLORES_V2[2][1]);
    px(x, bx + 1, by + 1, 1, 1, FLORES_V2[2][0]);
  }
}

/**
 * Racimo de flores v2 sobre hierba '.': ~12% de tiles albergan UNA
 * mancha de 2-4 flores de la MISMA especie agrupadas en ≤5px
 * (lecho natural, no salpicado uniforme). Exporta su semilla de
 * posición por hash → determinista entre épocas y ejecuciones.
 */
function racimo(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, cD: string,
): void {
  if (h1(tx * 3 + 29, ty * 5 + 31) >= 0.12) return;
  const sp = pick(h1(tx * 7 + 13, ty * 11 + 17), 3);
  const n = 2 + pick(h1(tx * 13 + 5, ty * 17 + 7), 3); // 2-4 flores
  const cx = 4 + ((h1(tx * 19 + 3, ty * 23 + 5) * 8) | 0);   // 4..11
  const cy = 4 + ((h1(tx * 23 + 9, ty * 29 + 1) * 8) | 0);   // 4..11
  for (let f = 0; f < n; f++) {
    const fx = cx + ((h1(tx * 31 + f * 3 + sp, ty * 37 + f) * 5) | 0) - 2;
    const fy = cy + ((h1(tx * 41 + f + sp * 7, ty * 43 + f * 3) * 5) | 0) - 2;
    florEspecie(x, sp, X0 + fx, Y0 + fy, cD);
  }
}

// ---------------- Desgaste (senderos pisados) ----------------

/**
 * Nivel de pisada 0..1 según vecinos: cada lado que toca un camino
 * '=' suma 0.42 (hierba corta y apagada); tocar losa ':'/'_' suma
 * 0.22 (roce del borde de la plaza). Exportado para harness.
 */
export function nivelDesgaste(at: NeighborFn): number {
  let n = 0;
  for (let s = 0; s < 4; s++) {
    const dx = s === 2 ? -1 : s === 3 ? 1 : 0;
    const dy = s === 0 ? -1 : s === 1 ? 1 : 0;
    const nb = at(dx, dy);
    if (nb === '=') n += 0.42;
    else if (nb === ':' || nb === '_') n += 0.22;
  }
  return n > 1 ? 1 : n;
}

/** Motas de tierra/wear hacia los lados que dan a camino o losa. */
function motasDesgaste(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, at: NeighborFn, wear: number,
): void {
  let mask = 0;
  for (let s = 0; s < 4; s++) {
    const dx = s === 2 ? -1 : s === 3 ? 1 : 0;
    const dy = s === 0 ? -1 : s === 1 ? 1 : 0;
    const nb = at(dx, dy);
    if (nb === '=' || nb === ':' || nb === '_') mask |= 1 << s;
  }
  if (mask === 0) return;
  const extra = wear > 0.55 ? 2 : 0;
  for (let s = 0; s < 4; s++) {
    if ((mask & (1 << s)) === 0) continue;
    const p = pintorLado(x, X0, Y0, s);
    const nM = 2 + extra + ((h1(tx * 19 + s * 7, ty * 23 + s * 3) * 2) | 0); // 2-5 por lado
    for (let k = 0; k < nM; k++) {
      const k2 = (h1(tx * 29 + k * 5 + s, ty * 31 + k * 3) * 16) | 0;
      const m = 1 + ((h1(tx * 37 + k + s, ty * 41 + k * 7) * 4) | 0); // 1-4 px hacia dentro
      const h3 = h1(tx * 43 + k * 3, ty * 47 + k + s);
      p(k2, m, h3 < 0.5 ? PAL.pathShadow : h3 < 0.8 ? '#6a5a3e' : '#6f7854');
    }
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
    if (h1(tx * 21 + k + side * 57, ty * 21 + side * 31) < umbral) p(k, 0, c);
  }
}

/**
 * Borde a camino '=' v3: gradiente de motas de 1-3px — m0 tierra del
 * camino, m1 mezcla tierra/hierba oscura, m2 motas sueltas — sin
 * corte duro entre el prado y el sendero.
 */
function bordeCamino(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  side: number, tx: number, ty: number, cD: string,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) {
    const h = h1(tx * 16 + k + side * 57, ty * 16 + side * 31);
    const d = h < 0.3 ? 3 : h < 0.75 ? 2 : 1;
    for (let m = 0; m < d; m++) {
      const h2 = h1(tx * 32 + k * 3 + m, ty * 32 + side * 7 + m * 5);
      p(k, m, m === 0 ? (h2 < 0.55 ? PAL.path : PAL.pathDark)
        : m === 1 ? (h2 < 0.6 ? PAL.pathDark : cD)
          : (h2 < 0.38 ? PAL.pathShadow : cD));
    }
    if (h1(tx * 8 + k, ty * 8 + side * 13) < 0.3) p(k, d - 1, PAL.pathShadow);
    if (d === 1 && h1(tx * 12 + k, ty * 12 + side * 17) < 0.12) p(k, 1, PAL.pathLight);
  }
}

/**
 * Orilla a agua ('~','B','x') v3: banda húmeda de 2-3px en gradiente
 * (m0 húmedo, m1 húmedo/barro, m2 motas húmedas dispersas).
 */
function bordeAgua(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  side: number, tx: number, ty: number, cWet: string,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) {
    const h = h1(tx * 16 + k + side * 71, ty * 16 + side * 13 + 5);
    const d = h < 0.45 ? 3 : 2;
    const h2 = h1(tx * 24 + k * 5, ty * 24 + side * 3);
    const h3 = h1(tx * 28 + k * 3, ty * 28 + side * 5);
    p(k, 0, cWet);
    if (d > 1) p(k, 1, h2 < 0.72 ? cWet : '#3d4a2c');
    if (d > 2 && h3 < 0.35) p(k, 2, cWet);
  }
}

/**
 * Borde a piedra/losa (':' '_' '#' 'P' 'A') v3: sombra de contacto con
 * gradiente de 2-3px (contacto oscuro → musgo medio → motas sueltas).
 */
function bordePiedra(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  side: number, tx: number, ty: number, cD: string, cMid: string,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) {
    const h = h1(tx * 16 + k + side * 63, ty * 16 + side * 21);
    const d = h < 0.4 ? 3 : 2;
    const h2 = h1(tx * 26 + k * 5, ty * 26 + side * 9);
    p(k, 0, cD);
    if (d > 1) p(k, 1, h2 < 0.55 ? cD : cMid);
    if (d > 2 && h2 > 0.7) p(k, 2, cMid);
  }
}

/** Sombra de contacto contra sólido (árboles, muros…): 1px firme + trama 2px. */
function bordeSolido(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  side: number, tx: number, ty: number, cD: string,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) {
    p(k, 0, cD);
    if (h1(tx * 16 + k + side * 57, ty * 16 + side * 31 + 9) < 0.4) p(k, 1, cD);
  }
}

/** Borde de cultivo ('c') contra hierba: tierra desgastada + hierba que invade. */
function bordeCultivo(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  side: number, tx: number, ty: number, cG: string,
): void {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0; k < 16; k++) {
    const h = h1(tx * 21 + k + side * 41, ty * 21 + side * 11);
    if (h < 0.4) p(k, 0, '#4a3620');
    else if (h < 0.65) p(k, 0, cG);
  }
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
    if (nb === '=') bordeCamino(x, X0, Y0, side, tx, ty, cD);
    else if (nb === '~' || nb === 'B' || nb === 'x') bordeAgua(x, X0, Y0, side, tx, ty, cWet);
    else if (HIERBA.has(nb)) {
      if (ch === 'c' && nb !== 'c') bordeCultivo(x, X0, Y0, side, tx, ty, cMid);
      else if (nb === 'm' && ch !== 'm') diente1(x, X0, Y0, side, tx, ty, TONOS_NIEBLA[3], 0.35);
      else if (nb !== 'm' && ch === 'm') diente1(x, X0, Y0, side, tx, ty, cMid, 0.35);
    } else if (nb === 'V') {
      // vacío: borde duro correcto, sin transición
    } else if (PIEDRA.has(nb)) {
      bordePiedra(x, X0, Y0, side, tx, ty, ch === 'c' ? '#4a3620' : cD, cMid);
    } else {
      bordeSolido(x, X0, Y0, side, tx, ty, ch === 'c' ? '#4a3620' : cD);
    }
  }
}

// ---------------- Casos especiales ----------------

/** Pool de flores de ',' : 5 clásicas + las 3 v2 (module-level, sin alloc). */
const POOL_ALTA: string[] = [
  PAL.flowerCols[0], PAL.flowerCols[1], PAL.flowerCols[2],
  PAL.flowerCols[3], PAL.flowerCols[4],
  FLORES_V2[0][0], FLORES_V2[1][0], FLORES_V2[2][0],
];

/** ',' hierba alta v2: briznas 3-5px peinadas por el viento + racimo de flores. */
function paintAlta(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, mapId: string, wear: number,
): void {
  const forest = isForest(mapId);
  const cL = forest ? PAL.grassBladeBosque : PAL.grassBlade;
  const cD = forest ? '#2c4f2a' : PAL.grassDark;
  const tip = forest ? TIP_MECHON_BOSQUE : TIP_MECHON_VALLE;
  // briznas altas (3-5px) con cabeza clara inclinada por el campo de flujo
  const rozado = wear >= 0.4;
  const nB = rozado ? 2 + pick(h1(tx, ty), 2) : 3 + pick(h1(tx, ty), 3);
  for (let k = 0; k < nB; k++) {
    const bx = X0 + 1 + ((h1(tx * 3 + k * 5, ty * 13 + k) * 13) | 0);
    const top = Y0 + 3 + ((h1(tx * 9 + k, ty * 7 + k * 3) * 6) | 0);
    const h = rozado ? 2 + ((h1(tx * 11 + k * 7, ty * 3 + k) * 2) | 0)
      : 3 + ((h1(tx * 11 + k * 7, ty * 3 + k) * 3) | 0);
    const col = h1(tx * 17 + k, ty * 19 + k) < 0.4 ? cD : cL;
    const dx = octDX(windDir(bx, top + 2));
    px(x, bx, top, 1, h, col);
    px(x, bx + dx, top - 1, 1, 1, tip);        // cap peinado por el viento
    if (h1(tx * 23 + k, ty * 29 + k) < 0.35) px(x, bx + (dx !== 0 ? dx : 1), top + 1, 1, 1, col);
  }
  // flores: racimo de 1-2 de la MISMA especie (mancha, no salpicado)
  const nF = h1(tx * 7 + 3, ty * 11 + 5) < 0.55 ? 1 : 2;
  const ci = pick(h1(tx * 53, ty * 59), POOL_ALTA.length);
  for (let f = 0; f < nF; f++) {
    const fx = X0 + 2 + ((h1(tx * 41 + f * 3, ty * 43 + f) * 11) | 0);
    const fy = Y0 + 4 + ((h1(tx * 47 + f, ty * 31 + f * 5) * 9) | 0);
    if (ci < 5) {
      const col = POOL_ALTA[ci];
      px(x, fx, fy, 2, 2, col);
      px(x, fx, fy, 1, 1, PAL.flowerCore);
      px(x, fx, fy + 2, 2, 1, cD);
    } else {
      florEspecie(x, ci - 5, fx, fy, cD);
    }
  }
}

/** Lechos de flores del cultivo ('c') v2: parche de tierra clara con 3-5 flores. */
function lechosFlor(
  x: CanvasRenderingContext2D, X0: number, Y0: number, tx: number, ty: number,
): void {
  const LECHO: string[] = [PAL.flowerCols[0], PAL.flowerCols[1], PAL.flowerCols[3], FLORES_V2[1][0]];
  const nB = h1(tx * 3 + 7, ty * 5 + 9) < 0.62 ? 1 : 2;
  for (let b = 0; b < nB; b++) {
    const cx = X0 + 3 + ((h1(tx * 9 + b * 11, ty * 13 + b * 7) * 9) | 0);   // 3..11
    const cy = Y0 + 3 + ((h1(tx * 11 + b * 5, ty * 17 + b * 3) * 9) | 0);   // 3..11
    px(x, cx - 1, cy - 1, 5, 4, '#6a5030');                                  // lecho de tierra
    const nF = 3 + pick(h1(tx * 13 + b, ty * 7 + b * 3), 3);                 // 3-5 flores
    for (let f = 0; f < nF; f++) {
      const fx = cx + ((h1(tx * 17 + f * 3 + b, ty * 19 + f + b) * 4) | 0) - 1;
      const fy = cy + ((h1(tx * 23 + f + b, ty * 29 + f * 5 + b) * 3) | 0) - 1;
      px(x, fx, fy, 2, 2, LECHO[pick(h1(tx * 31 + f * 7 + b, ty * 37 + f + b * 2), LECHO.length)]);
      px(x, fx, fy, 1, 1, PAL.flowerCore);
    }
  }
}

/** 'c' cultivo: tierra moteada, surcos curvos, brotes, lechos de flores y piedrita. */
function paintCultivo(
  x: CanvasRenderingContext2D, X0: number, Y0: number, tx: number, ty: number,
): void {
  baseMoteado(x, X0, Y0, tonoTierra);
  // surcos curvos (perspectiva) con deriva vertical por fila de tiles
  for (let row = 0; row < 3; row++) {
    const yB = 3 + row * 4 + ((ty * 2 + row * 3) % 3);
    const fase = h1(tx, ty * 3 + row) * 6.283;
    const curva = (i: number) =>
      Math.max(5, Math.min(13, yB + Math.round(Math.sin((X0 + i) * 0.5 + fase) * 1.4)));
    for (let i = 0; i < 16; i++) {
      const yC = curva(i);
      px(x, X0 + i, Y0 + yC, 1, 1, '#4a3620');       // surco oscuro
      px(x, X0 + i, Y0 + yC - 1, 1, 1, '#7a5c3a');   // lomo claro
    }
    // brotes de 2 tonos sobre cada surco
    const nS = 3 + ((h1(tx * 7 + row, ty * 5 + row) * 2) | 0);
    for (let s = 0; s < nS; s++) {
      const i = 1 + ((h1(tx * 13 + row * 3 + s * 5, ty * 11 + s * 7) * 14) | 0);
      const yC = curva(i);
      const oscuro = h1(tx + s * 3, ty * 17 + row * 5 + s) < 0.5;
      px(x, X0 + i, Y0 + yC - 3, 1, 2, oscuro ? '#427a3a' : '#4f8a46');
      px(x, X0 + i, Y0 + yC - 4, 1, 1, oscuro ? '#578f4c' : '#6fbf62');
    }
  }
  lechosFlor(x, X0, Y0, tx, ty);                     // lechos de flores v2
  // alguna piedrecita suelta
  if (h1(tx * 3 + 1, ty * 9 + 7) < 0.5) {
    const gx = X0 + 3 + ((h1(tx * 37, ty * 41) * 10) | 0);
    const gy = Y0 + 2 + ((h1(tx * 43, ty * 47) * 3) | 0);
    px(x, gx, gy, 1, 1, PAL.pathLight);
  }
}

/** Mata de niebla de 2 alturas: tallos altos (3px) y cortos (1-2px) sobre base. */
function mataNiebla(
  x: CanvasRenderingContext2D, X0: number, Y0: number, tx: number, ty: number, k: number,
): void {
  const bx = X0 + 2 + ((h1(tx * 9 + k * 13, ty * 21 + k) * 11) | 0);
  const by = Y0 + 4 + ((h1(tx * 15 + k * 7, ty * 25 + k * 3) * 8) | 0);
  px(x, bx, by + 2, 3, 1, '#333f38');          // base oscura
  px(x, bx, by, 1, 2, '#48574d');              // tallo alto corto
  px(x, bx + 2, by - 1, 1, 3, '#48574d');      // tallo alto (2ª altura)
  px(x, bx + 2, by - 2, 1, 1, '#5c6f62');      // punta clara del más alto
  px(x, bx + 1, by, 1, 1, '#414f46');          // tallo bajo
  if (h1(tx * 7 + k, ty * 9 + k) < 0.5) px(x, bx + 1, by + 1, 1, 1, '#414f46');
}

/** Semillas doradas dispersas de la niebla ('m'): 2-4 motas de 1px. */
function semillasDoradas(
  x: CanvasRenderingContext2D, X0: number, Y0: number, tx: number, ty: number,
): void {
  const nS = 2 + pick(h1(tx * 5 + 3, ty * 7 + 1), 3); // 2-4 semillas
  for (let k = 0; k < nS; k++) {
    const sx = X0 + 2 + ((h1(tx * 13 + k * 7, ty * 17 + k * 3) * 12) | 0);
    const sy = Y0 + 2 + ((h1(tx * 19 + k * 3, ty * 23 + k) * 12) | 0);
    px(x, sx, sy, 1, 1, '#d8b458');
    if (h1(tx * 9 + k * 3, ty * 11 + k) < 0.35) px(x, sx + 1, sy, 1, 1, '#f0d060');
  }
}

/** 'm' niebla muda: hierba apagada + matas de 2 alturas + semillas doradas. */
function paintMist(
  x: CanvasRenderingContext2D, X0: number, Y0: number,
  tx: number, ty: number, t: number,
): void {
  baseMoteado(x, X0, Y0, (vx, vy) => tonoEn(vx, vy, TONOS_NIEBLA));
  const nM = 1 + pick(h1(tx * 3 + 5, ty * 7 + 9), 2); // 1-2 matas por tile
  for (let k = 0; k < nM; k++) mataNiebla(x, X0, Y0, tx, ty, k);
  semillasDoradas(x, X0, Y0, tx, ty);
  // veladura gris-verdosa translúcida
  x.globalAlpha = 0.16;
  px(x, X0, Y0, 16, 16, '#9ec4b4');
  // motas claras que derivan (con t; congeladas en el prerrender se ven bien)
  x.globalAlpha = 0.4;
  const nMotas = 2 + ((h1(tx * 5 + 3, ty * 7 + 1) * 2) | 0);
  for (let k = 0; k < nMotas; k++) {
    const mx = X0 + 1 + (((((h1(tx + k * 7, ty * 3 + k) * 12 + t * (1.2 + k * 0.8)) % 12) + 12) % 12) | 0);
    const my = Y0 + 2 + (((((h1(tx * 3 + k, ty + k * 5) * 9 + Math.sin(t * 0.9 + tx + k * 2.1) * 2) % 9) + 9) % 9) | 0);
    if (k % 2 === 0) px(x, mx, my, 2, 1, '#b8d8c8');
    else px(x, mx, my, 1, 2, '#b8d8c8');
  }
  x.globalAlpha = 1;
}

// ---------------- Punto de entrada ----------------

/**
 * Pinta un tile de hierba/naturaleza completo (llamado por drawTile).
 * FIRMA INMUTABLE — ver contrato en la cabecera. v3: campo de flujo,
 * racimos de flores v2, desgaste junto a caminos y transiciones
 * degradadas de 2-3px.
 */
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
    const wear = at ? nivelDesgaste(at) : 0;
    const tonos = forest ? TONOS_BOSQUE : TONOS_LUNARIS;
    baseMoteado(x, X0, Y0, (vx, vy) =>
      tonoEn(vx, vy, wear > 0.55 ? (forest ? TONOS_DESG_BOSQUE : TONOS_DESG_VALLE) : tonos));
    if (wear > 0 && at) motasDesgaste(x, X0, Y0, tx, ty, at, wear);
    if (ch === ',') {
      paintAlta(x, X0, Y0, tx, ty, mapId, wear);
    } else {
      mechones(x, X0, Y0, tx, ty, cL, cD, forest ? TIP_MECHON_BOSQUE : TIP_MECHON_VALLE, wear);
      if (wear < 0.4) {
        mata(x, X0, Y0, tx, ty, cL, tonos[2], cD);
        racimo(x, X0, Y0, tx, ty, cD);
        rareza(x, X0, Y0, tx, ty, cD);
      }
    }
  }
  transiciones(x, X0, Y0, tx, ty, ch, mapId, at);
}

// ============================================================
// R16 · CAMINO '=' — pintor propio
// El char '=' no tenía pintor en lunaris/bosque/arena/cuna/ciudadela
// (la expansión solo cubre costa/aldea/cumbres): caía al default de
// verde plano y cada sendero se veía como una franja verde lisa con
// el borde de tierra (bordeCamino) dibujado SOLO del lado de la
// hierba. Ahora:
//  · valle/bosque → tierra apisonada moteada (ruido de valor en
//    coordenadas globales, sin costuras) con rodadas en el eje del
//    camino, guijarros con luz/sombra, huellas y — en el bosque —
//    hojarasca y agujas; los bordes que dan a hierba reciben mechones
//    que invaden 1-3 px (funde con bordeCamino del lado de la hierba).
//  · ciudades de piedra (ciudadela/arena/cuna) → calzada de losas
//    irregulares con juntas, desgaste central y musgo en juntas.
// Determinista (hash2/vnoise), prerrender estático como el resto.
// ============================================================

const TIERRA_CAMINO_VALLE: string[] = [PAL.pathShadow, PAL.pathDark, '#ad8f5e', PAL.path, PAL.pathLight];
const TIERRA_CAMINO_BOSQUE: string[] = ['#5e4a30', '#6a5436', '#765e3e', '#816846', '#8c7250'];
const LOSA_CALZADA: string[] = ['#7d776c', '#878175', '#918b7e', '#9b9587', '#a59f90'];
const CALZADA_CITY = new Set(['ciudadela', 'arena', 'cuna']);
const HOJARASCA: string[] = ['#a0602c', '#8a4e24', '#b88a3a', '#2f4a28'];

function tonoCamino(vx: number, vy: number, tones: string[]): string {
  const n = 0.6 * vnoise(vx, vy, 6, 131) + 0.4 * vnoise(vx, vy, 3, 57);
  let k = (n - 0.22) / 0.56;
  if (k < 0) k = 0; else if (k > 0.999) k = 0.999;
  return tones[(k * tones.length) | 0];
}

function esCamino(ch: string): boolean { return ch === '='; }

/** Calzada de losas (ciudades de piedra). */
function paintCalzada(x: CanvasRenderingContext2D, X0: number, Y0: number, tx: number, ty: number, at: NeighborFn): void {
  // base con ruido muy suave
  baseMoteado(x, X0, Y0, (vx, vy) => tonoCamino(vx, vy, LOSA_CALZADA));
  const junta = '#5f5a52', juntaHi = '#aaa394';
  // dos hileras de losas por tile, desfase alterno por fila → aparejo irregular
  for (let row = 0; row < 2; row++) {
    const y = Y0 + row * 8;
    px(x, X0, y, 16, 1, junta);
    px(x, X0, y + 1, 16, 1, 'rgba(170,163,148,0.35)');
    const off = (((hash2(tx * 7 + row, ty * 13) * 2) * 6) | 0) + (row === 1 ? 4 : 0);
    for (let k = 0; k < 3; k++) {
      const jx = X0 + ((off + k * 7) % 16);
      px(x, jx, y + 1, 1, 7, junta);
      if (jx + 1 < X0 + 16) px(x, jx + 1, y + 2, 1, 5, juntaHi);
    }
  }
  // desgaste central (paso de siglos) + musgo en alguna junta
  const r = h1(tx * 17, ty * 29);
  if (r < 0.5) px(x, X0 + 5 + ((r * 8) | 0), Y0 + 3 + ((h1(tx, ty * 3) * 8) | 0), 3, 1, '#b2ab9c');
  if (h1(tx * 31, ty * 11) < 0.35) {
    const mx = X0 + ((h1(tx * 5, ty * 7) * 14) | 0), my = Y0 + (h1(tx * 3, ty * 5) < 0.5 ? 0 : 8);
    px(x, mx, my, 2, 1, '#4f6a3e'); px(x, mx + 1, my + 1, 1, 1, '#5d7a48');
  }
  if (h1(tx * 13 + 3, ty * 19 + 1) < 0.18) { // grieta fina
    const cx = X0 + 3 + ((h1(tx * 9, ty * 2) * 9) | 0), cy = Y0 + 2 + ((h1(tx * 4, ty * 8) * 10) | 0);
    px(x, cx, cy, 1, 1, junta); px(x, cx + 1, cy + 1, 1, 1, junta); px(x, cx + 1, cy + 2, 1, 1, junta);
  }
  // remate contra hierba: borde de bordillo oscuro de 1px
  for (let side = 0; side < 4; side++) {
    const dx = side === 2 ? -1 : side === 3 ? 1 : 0;
    const dy = side === 0 ? -1 : side === 1 ? 1 : 0;
    const nb = at(dx, dy);
    if (esCamino(nb) || nb === ':' || nb === '_' || nb === 'P' || nb === 'V') continue;
    const p = pintorLado(x, X0, Y0, side);
    for (let k = 0; k < 16; k++) { p(k, 0, junta); if (h1(tx * 5 + k, ty * 9 + side) < 0.5) p(k, 1, '#6c665c'); }
  }
}

/** Sendero de tierra (valle / bosque). */
export function paintPath(
  x: CanvasRenderingContext2D, tx: number, ty: number, mapId: string, at?: NeighborFn,
): void {
  const X0 = tx * 16, Y0 = ty * 16;
  const nb: NeighborFn = at ?? (() => '=');
  if (CALZADA_CITY.has(mapId)) { paintCalzada(x, X0, Y0, tx, ty, nb); return; }
  const forest = isForest(mapId);
  const tones = forest ? TIERRA_CAMINO_BOSQUE : TIERRA_CAMINO_VALLE;
  baseMoteado(x, X0, Y0, (vx, vy) => tonoCamino(vx, vy, tones));

  const n = esCamino(nb(0, -1)), s = esCamino(nb(0, 1)), w = esCamino(nb(-1, 0)), e = esCamino(nb(1, 0));
  const horiz = (w || e) && !(n || s) ? true : (n || s) && !(w || e) ? false : (w && e);
  const rut = forest ? '#56432a' : PAL.pathShadow;
  const rutHi = forest ? '#8f7650' : PAL.pathLight;
  // rodadas: dos surcos discontinuos en el eje del camino
  for (let i = 0; i < 16; i++) {
    for (let k = 0; k < 2; k++) {
      const off = k === 0 ? 4 : 11;
      if (h1(tx * 16 + i * 3 + k * 7, ty * 16 + k * 11) < 0.62) {
        if (horiz) { px(x, X0 + i, Y0 + off, 1, 1, rut); if (i % 3 === 0) px(x, X0 + i, Y0 + off + 1, 1, 1, rutHi); }
        else { px(x, X0 + off, Y0 + i, 1, 1, rut); if (i % 3 === 0) px(x, X0 + off + 1, Y0 + i, 1, 1, rutHi); }
      }
    }
  }
  // guijarros (luz arriba, sombra abajo)
  const nP = 1 + ((h1(tx * 7 + 1, ty * 5 + 3) * 3) | 0);
  for (let k = 0; k < nP; k++) {
    const gx = X0 + 1 + ((h1(tx * 11 + k * 5, ty * 13 + k) * 13) | 0);
    const gy = Y0 + 1 + ((h1(tx * 17 + k, ty * 19 + k * 3) * 13) | 0);
    const big = h1(tx * 23 + k, ty * 29 + k) < 0.3;
    px(x, gx, gy, big ? 2 : 1, 1, PAL.pebble);
    px(x, gx, gy + 1, big ? 2 : 1, 1, PAL.pebbleDark);
    if (big) px(x, gx, gy, 1, 1, '#b6ac9c');
  }
  // huella de bota (rara) en el valle · hojarasca y agujas en el bosque
  if (!forest && h1(tx * 41, ty * 43) < 0.16) {
    const fx = X0 + 4 + ((h1(tx * 3, ty * 7) * 7) | 0), fy = Y0 + 4 + ((h1(tx * 5, ty * 3) * 7) | 0);
    px(x, fx, fy, 2, 3, PAL.pathDark); px(x, fx, fy + 4, 2, 1, PAL.pathDark);
  }
  if (forest) {
    const nL = 2 + ((h1(tx * 9, ty * 15) * 3) | 0);
    for (let k = 0; k < nL; k++) {
      const lx = X0 + ((h1(tx * 31 + k * 7, ty * 3 + k) * 15) | 0);
      const ly = Y0 + ((h1(tx * 5 + k, ty * 37 + k * 5) * 15) | 0);
      const c = HOJARASCA[pick(h1(tx + k * 13, ty * 7 + k), HOJARASCA.length)];
      px(x, lx, ly, 2, 1, c);
      if (h1(tx * 3 + k, ty * 3 + k) < 0.5) px(x, lx + 1, ly + 1, 1, 1, c);
    }
  }
  // bordes que dan a hierba: mechones que invaden el sendero (1-3 px)
  const cBlade = forest ? PAL.grassBladeBosque : PAL.grassBlade;
  const cDark = forest ? '#2c4f2a' : PAL.grassDark;
  for (let side = 0; side < 4; side++) {
    const dx = side === 2 ? -1 : side === 3 ? 1 : 0;
    const dy = side === 0 ? -1 : side === 1 ? 1 : 0;
    const v = nb(dx, dy);
    if (!HIERBA.has(v) && v !== 't' && v !== 'p') continue;
    const p = pintorLado(x, X0, Y0, side);
    for (let k = 0; k < 16; k++) {
      const h = h1(tx * 13 + k + side * 47, ty * 13 + side * 29);
      const d = h < 0.25 ? 3 : h < 0.65 ? 2 : 1;
      for (let m = 0; m < d; m++) p(k, m, m === 0 ? cDark : (h1(tx * 7 + k + m, ty * 9 + side + m) < 0.5 ? cBlade : cDark));
    }
  }
}
