// ============================================================
// ECOS DE AELTHAR — MARIONETA PIXEL (R19)
//
// Figura humana articulada para el Portador v5 y los NPCs v2. En vez de
// fotogramas pintados a mano, cada fotograma se ESCULPE a partir de una pose
// continua (articulaciones: hombros, codos, manos, caderas, rodillas,
// tobillos + cabeza, torso, pelo, capa y bajo de la tela con retraso). Así
// una animación puede tener tantas fases como haga falta sin redibujar nada:
// andar 8, correr 8, ataque 5 con estela, lanzar 5, voltereta 6…
//
//  · Lienzo 32×38 (suela en la fila 37). Figura normal: ~30 px de alto,
//    cabeza 10×9 con ojos 2×2, cejas, mejillas y boca.
//  · Se pinta por MATERIALES en un Sculpt y se sombrea con la luz v2
//    (normales desde la silueta, 5 tonos por material, sombra de contacto,
//    contorno selectivo). Todo determinista, sin Math.random.
//  · Direcciones: 'down' (de frente), 'up' (de espaldas) y 'side' (perfil
//    mirando a la DERECHA; render.ts voltea para la izquierda).
//  · Complexiones: normal, alta, robusta, delgada, infantil y anciana.
// ============================================================

import { Sculpt, ramp, mixC, mulC, type Ramp } from './sculpt';

export const FIG_W = 32;
export const FIG_H = 38;
const CX = 16;
const GROUND = 37;

export type FigDir = 'down' | 'up' | 'side';

// ---------------------------------------------------------------- materiales
export const M = {
  SKIN: 1, HAIR: 2, CLOTH: 3, SLEEVE: 4, PANTS: 5, BOOT: 6, SOLE: 7, BELT: 8, METAL: 9, TRIM: 10,
  CAPE: 11, LINING: 12, HOOD: 13, LEATHER: 14, CHAIN: 15, BLADE: 16, WOOD: 17, GEM: 18, SHIELD: 19,
  BEARD: 20, HAT: 21, APRON: 22, ITEM: 23, ITEM2: 24, GLOVE: 25, DARK: 26, TABARD: 27, SKIRT: 28, GLOW: 29,
} as const;
const NMAT = 30;

// ---------------------------------------------------------------- aspecto
export type Build = 'normal' | 'tall' | 'stout' | 'thin' | 'child' | 'old' | 'dwarf';
export type HairStyle = 'short' | 'long' | 'bun' | 'pony' | 'bald' | 'spiky' | 'braid' | 'bob' | 'wild';
export type HeadGear = 'none' | 'hood' | 'cap' | 'widehat' | 'crown' | 'scarf' | 'circlet' | 'veil' | 'helm' | 'bandana';
export type Outfit = 'tunic' | 'robe' | 'dress' | 'coat' | 'apron' | 'vest';
export type Item = 'none' | 'sword' | 'staff' | 'lantern' | 'book' | 'hammer' | 'rod' | 'basket' | 'spear' | 'cane' | 'scroll' | 'axe' | 'bow';

export interface FigLook {
  build: Build;
  skin: string; hair: string; eyes: string;
  hairStyle: HairStyle;
  beard?: 'none' | 'short' | 'long' | 'mustache'; beardC?: string;
  head?: HeadGear; headC?: string;
  top: string; sleeves?: string; legs: string; boots: string; belt?: string;
  outfit: Outfit; skirt?: string; apron?: string;
  cape?: string | null; capeLong?: boolean; lining?: string;
  trim?: string;
  /** 0-5: piezas de armadura del Portador (cuero, malla+tabardo, placas, manto, guarda). */
  armor?: number; metal?: string; tabard?: string;
  item?: Item; itemC?: string; blade?: string; gem?: string; bladeLen?: number; crystal?: number;
  shield?: boolean; shieldC?: string;
  glowEyes?: boolean;
  emblem?: string | null;
  pointyEars?: boolean;
  runes?: string | null;
  freckles?: boolean;
}

// ---------------------------------------------------------------- pose
export type WeaponMode = 'rest' | 'pose';
export interface Pose {
  /** Desfase vertical del cuerpo superior (negativo = arriba). */
  bob: number;
  /** Inclinación del cuerpo superior (px hacia delante en perfil). */
  lean: number;
  /** Respiración: 0/1 (hombros y pecho suben 1 px). */
  breath: number;
  /** Brazos [arma, escudo]: ángulo del hombro en grados (0 colgando, + hacia delante) y flexión del codo. */
  arm: [number, number]; elbow: [number, number];
  /** Piernas [lejana, cercana] (perfil): ángulo de cadera y flexión de rodilla (grados). */
  leg: [number, number]; knee: [number, number];
  /** Pies levantados (vista frontal/espalda) en px. */
  lift: [number, number];
  /** Dirección de la hoja/báculo en coordenadas de pantalla (si no, cuelga). */
  wv: [number, number] | null;
  /** Mano del arma forzada a una posición relativa al hombro (px). */
  hand: [number, number] | null;
  /** Estela de tajo: ángulos (rad, pantalla) de inicio y fin alrededor de la mano. */
  smear: [number, number] | null;
  hem: number; hair: number; cape: number;
  blink: boolean; hurt: boolean;
  /** Brillo de canalización del cristal (0..1). */
  glow: number;
}
export const REST_POSE: Pose = {
  bob: 0, lean: 0, breath: 0, arm: [0, 0], elbow: [10, 10], leg: [0, 0], knee: [0, 0], lift: [0, 0],
  wv: null, hand: null, smear: null, hem: 0, hair: 0, cape: 0, blink: false, hurt: false, glow: 0,
};

// ---------------------------------------------------------------- complexión
interface Body {
  headH: number; headW: number; neck: number; torsoH: number; legLen: number;
  shHalf: number; waistHalf: number; hipHalf: number; armT: number; legT: number;
  stoop: number; upper: number; fore: number;
}
function bodyOf(b: Build): Body {
  switch (b) {
    case 'tall': return { headH: 9, headW: 10, neck: 1, torsoH: 10, legLen: 12, shHalf: 5, waistHalf: 3.5, hipHalf: 4, armT: 2, legT: 3, stoop: 0, upper: 5, fore: 5 };
    case 'stout': return { headH: 9, headW: 10, neck: 0, torsoH: 9, legLen: 9, shHalf: 6.5, waistHalf: 6, hipHalf: 5.5, armT: 3, legT: 3, stoop: 0, upper: 4, fore: 4 };
    case 'thin': return { headH: 9, headW: 9, neck: 1, torsoH: 9, legLen: 11, shHalf: 4.5, waistHalf: 3, hipHalf: 3.5, armT: 2, legT: 2, stoop: 0, upper: 4, fore: 5 };
    case 'child': return { headH: 8, headW: 9, neck: 0, torsoH: 6, legLen: 7, shHalf: 3.5, waistHalf: 3, hipHalf: 3, armT: 2, legT: 2, stoop: 0, upper: 3, fore: 3 };
    case 'dwarf': return { headH: 9, headW: 10, neck: 0, torsoH: 7, legLen: 7, shHalf: 6.5, waistHalf: 6, hipHalf: 5.5, armT: 3, legT: 3, stoop: 0, upper: 3, fore: 4 };
    case 'old': return { headH: 9, headW: 10, neck: 0, torsoH: 8, legLen: 9, shHalf: 5, waistHalf: 4.5, hipHalf: 4.5, armT: 2, legT: 3, stoop: 2, upper: 4, fore: 4 };
    default: return { headH: 9, headW: 10, neck: 1, torsoH: 9, legLen: 10, shHalf: 5, waistHalf: 3.8, hipHalf: 4.2, armT: 2, legT: 3, stoop: 0, upper: 4, fore: 4 };
  }
}

// ---------------------------------------------------------------- paleta
function palOf(L: FigLook): Ramp[] {
  const p: Ramp[] = [];
  const set = (m: number, c: string, o?: Parameters<typeof ramp>[1]) => { p[m] = ramp(c, o); };
  set(M.SKIN, L.skin, { hiK: 1.08, shK: 0.8 });
  set(M.HAIR, L.hair);
  set(M.CLOTH, L.top);
  set(M.SLEEVE, L.sleeves ?? L.top);
  set(M.PANTS, L.legs);
  set(M.BOOT, L.boots);
  p[M.SOLE] = { hi: '#3a2a24', base: '#2a1c18', sh: '#22161a', out: '#140c10' };
  set(M.BELT, L.belt ?? '#5a3a24');
  set(M.METAL, L.metal ?? '#a6b2c4', { hard: true });
  set(M.TRIM, L.trim ?? '#e8c04a', { hard: true });
  set(M.CAPE, L.cape ?? '#b8304a');
  set(M.LINING, L.lining ?? mixC(L.cape ?? '#b8304a', '#f0e0c0', 0.45));
  set(M.HOOD, L.headC ?? L.cape ?? '#c23448');
  set(M.LEATHER, '#7a4a26');
  p[M.CHAIN] = ramp('#9aa6b6', { hard: true });
  set(M.BLADE, L.blade ?? '#c3ccd8', { hard: true, hiK: 1.4 });
  set(M.WOOD, L.itemC && (L.item === 'staff' || L.item === 'cane' || L.item === 'rod' || L.item === 'spear') ? L.itemC : '#6e4c2c');
  p[M.GEM] = { hi: '#ffffff', base: L.gem ?? '#62cade', sh: mulC(L.gem ?? '#62cade', 0.72), out: mixC(mulC(L.gem ?? '#62cade', 0.35), '#101020', 0.4), hard: true };
  set(M.SHIELD, L.shieldC ?? '#8a5a30');
  set(M.BEARD, L.beardC ?? L.hair);
  set(M.HAT, L.headC ?? '#6a5a48');
  set(M.APRON, L.apron ?? '#d8d0bc');
  set(M.ITEM, L.itemC ?? '#8a6a3a');
  set(M.ITEM2, '#e8d8a8');
  set(M.GLOVE, L.armor && L.armor >= 3 ? (L.metal ?? '#a6b2c4') : '#7a4a26', { hard: !!(L.armor && L.armor >= 3) });
  p[M.DARK] = { hi: '#22182a', base: '#22182a', sh: '#22182a', out: '#140c18', flat: true };
  set(M.TABARD, L.tabard ?? '#c23448');
  set(M.SKIRT, L.skirt ?? L.top);
  p[M.GLOW] = { hi: '#ffffff', base: L.gem ?? '#8af0ff', sh: L.gem ?? '#8af0ff', out: mulC(L.gem ?? '#8af0ff', 0.5), flat: true };
  for (let m = 0; m < NMAT; m++) if (!p[m]) p[m] = ramp('#ff00ff');
  return p;
}

// ---------------------------------------------------------------- utilidades de trazo
type V = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;

/** Cápsula gruesa entre dos puntos (extremidades redondeadas). */
export function capsule(S: Sculpt, ax: number, ay: number, bx: number, by: number, w: number, mat: number) {
  const r = w / 2;
  const minX = Math.floor(Math.min(ax, bx) - r - 1), maxX = Math.ceil(Math.max(ax, bx) + r + 1);
  const minY = Math.floor(Math.min(ay, by) - r - 1), maxY = Math.ceil(Math.max(ay, by) + r + 1);
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1e-6;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5;
    let t = ((px - ax) * vx + (py - ay) * vy) / L2;
    t = Math.max(0, Math.min(1, t));
    const dx = px - (ax + vx * t), dy = py - (ay + vy * t);
    if (dx * dx + dy * dy <= r * r + 0.05) S.set(x, y, mat);
  }
}
function spanRow(S: Sculpt, y: number, x0: number, x1: number, mat: number) {
  for (let x = Math.round(x0); x <= Math.round(x1); x++) S.set(x, y, mat);
}
/** Píxel solo si ya hay figura debajo (detalles que no deben salirse). */
function over(S: Sculpt, x: number, y: number, mat: number) {
  if (S.get(Math.round(x), Math.round(y)) !== 0) S.set(x, y, mat);
}

// ---------------------------------------------------------------- figura
export interface FigOut { S: Sculpt; tipX: number; tipY: number; hand: V }

/**
 * Esculpe la figura completa para una dirección y una pose. Devuelve el
 * Sculpt (para que el llamador añada detalles) y la punta del arma.
 */
export function sculptFigure(L: FigLook, dir: FigDir, P: Pose): FigOut {
  const S = new Sculpt(FIG_W, FIG_H);
  const B = bodyOf(L.build);
  const out: FigOut = { S, tipX: CX, tipY: 20, hand: [CX, 26] };
  if (dir === 'side') drawSide(S, L, B, P, out);
  else drawFrontBack(S, L, B, P, dir === 'up', out);
  return out;
}

/** Sombrea y vuelca la figura. */
export function renderFigure(fo: FigOut, L: FigLook, rim?: string | null): HTMLCanvasElement {
  return fo.S.render2(palOf(L), { rim: rim ?? null, rimK: 0.22, bulge: 4 });
}

// ================================================================ FRENTE / ESPALDA
function drawFrontBack(S: Sculpt, L: FigLook, B: Body, P: Pose, back: boolean, out: FigOut) {
  const a = L.armor ?? 0;
  const hurtY = P.hurt ? 1 : 0;
  const hipY = GROUND - B.legLen;
  const u = P.bob + hurtY + B.stoop;                 // desfase del cuerpo superior
  const shY = hipY - B.torsoH + u - P.breath;        // fila de hombros
  const headBot = shY - B.neck - 1;                  // última fila de la cabeza
  const headTop = headBot - B.headH + 1;
  const cx = CX + (back ? 0 : 0);
  const robeLike = L.outfit === 'robe' || L.outfit === 'dress';
  // la mano del ARMA está a la izquierda de la pantalla de frente (mano derecha del personaje)
  const wSide = back ? 1 : -1;

  // ---- capa por detrás (de frente asoma por los lados; de espaldas lo cubre todo) ----
  if (L.cape) {
    const bottom = L.capeLong ? GROUND - 2 : hipY + 2;
    for (let y = shY; y <= bottom; y++) {
      const k = (y - shY) / Math.max(1, bottom - shY);
      const half = B.shHalf + 0.5 + k * 1.6;
      const sway = Math.round(P.cape * k);
      if (back) spanRow(S, y, cx - half + sway, cx + half - 1 + sway, M.CAPE);
      else {
        spanRow(S, y, cx - half + sway, cx - half + 1.5 + sway, M.CAPE);
        spanRow(S, y, cx + half - 2.5 + sway, cx + half - 1 + sway, M.CAPE);
      }
    }
    if (!back) { spanRow(S, bottom, cx - B.shHalf - 1, cx - B.shHalf + 0.5, M.LINING); spanRow(S, bottom, cx + B.shHalf - 1.5, cx + B.shHalf, M.LINING); }
  }
  // ---- melena larga por detrás ----
  if (L.hairStyle === 'long' || L.hairStyle === 'wild') {
    const hb = headTop + B.headH + 6;
    for (let y = headTop + 3; y <= hb; y++) {
      const sw = Math.round(P.hair * (y - headTop) / 10);
      const half = B.headW / 2 + (y > headTop + B.headH ? 0 : 0.5);
      if (back) spanRow(S, y, cx - half + sw, cx + half - 1 + sw, M.HAIR);
      else { spanRow(S, y, cx - half - 0.5 + sw, cx - half + 1 + sw, M.HAIR); spanRow(S, y, cx + half - 2 + sw, cx + half - 0.5 + sw, M.HAIR); }
    }
  }

  // ---- piernas ----
  const legSep = Math.max(1.5, B.hipHalf - 1.8);
  const leg = (sx: number, lift: number) => {
    const ankleY = GROUND - 2 - lift;
    const kneeY = hipY + (ankleY - hipY) * 0.5;
    const pantsMat = robeLike ? M.PANTS : M.PANTS;
    capsule(S, cx + sx, hipY, cx + sx, kneeY, B.legT, pantsMat);
    capsule(S, cx + sx, kneeY, cx + sx, ankleY - 1, B.legT, pantsMat);
    if (a >= 3) capsule(S, cx + sx, kneeY, cx + sx, ankleY - 1, B.legT + 0.4, M.METAL); // grebas
    // bota: 3 filas + suela, un pelo más ancha
    const bw = B.legT + 1;
    for (let y = ankleY - 2; y <= ankleY + 1; y++) spanRow(S, y, cx + sx - bw / 2 + 0.5, cx + sx + bw / 2 - 0.5, M.BOOT);
    spanRow(S, ankleY + 2, cx + sx - bw / 2 + 0.5, cx + sx + bw / 2 - 0.5, M.SOLE);
    if (a >= 2) over(S, cx + sx, ankleY - 2, M.BOOT);
  };
  leg(-legSep, P.lift[0]);
  leg(legSep, P.lift[1]);

  // ---- torso ----
  const waistY = hipY - 2 + u;
  const torsoRows = hipY + u - shY;
  for (let r = 0; r <= torsoRows; r++) {
    const y = shY + r;
    const k = r / Math.max(1, torsoRows);
    let half: number;
    if (r === 0) half = B.shHalf - 1;
    else if (k < 0.55) half = B.shHalf - (B.shHalf - B.waistHalf) * (k / 0.55);
    else half = B.waistHalf + (B.hipHalf - B.waistHalf) * ((k - 0.55) / 0.45);
    spanRow(S, y, cx - half, cx + half - 1, M.CLOTH);
  }
  // bajo de la prenda (falda corta / túnica / hábito)
  const hemEnd = robeLike ? GROUND - 2 : L.outfit === 'coat' ? hipY + 6 : hipY + 2;
  for (let y = hipY + u + 1; y <= hemEnd; y++) {
    const k = (y - hipY) / Math.max(1, hemEnd - hipY);
    const half = B.hipHalf + (robeLike ? k * 2.2 : L.outfit === 'coat' ? k * 1 : 0.3);
    const wob = y === hemEnd ? P.hem : 0;
    const mat = L.outfit === 'dress' ? M.SKIRT : M.CLOTH;
    spanRow(S, y, cx - half + (wob > 0 ? 1 : 0), cx + half - 1 + (wob < 0 ? -1 : 0), mat);
    if (L.outfit === 'coat' && !back) { S.set(cx - 1, y, M.SLEEVE); S.set(cx, y, M.SLEEVE); }
  }
  if (L.outfit === 'coat' && !back) for (let y = shY + 2; y <= hipY + u; y++) { S.set(cx - 1, y, M.SLEEVE); S.set(cx, y, M.SLEEVE); }
  if (L.outfit === 'apron' && !back) {
    for (let y = shY + 3; y <= Math.min(GROUND - 4, hipY + 5); y++) spanRow(S, y, cx - B.waistHalf + 1, cx + B.waistHalf - 2, M.APRON);
  }
  if (L.outfit === 'vest') {
    for (let y = shY; y <= waistY; y++) { spanRow(S, y, cx - B.shHalf + 1, cx - 1.5, M.SLEEVE); spanRow(S, y, cx + 0.5, cx + B.shHalf - 2, M.SLEEVE); }
    if (!back) for (let y = shY + 1; y <= waistY; y++) { S.set(cx - 1, y, M.CLOTH); S.set(cx, y, M.CLOTH); }
  }
  // ---- armadura ----
  if (a === 1) {
    for (let y = shY + 1; y <= waistY - 1; y++) spanRow(S, y, cx - B.waistHalf, cx + B.waistHalf - 1, M.LEATHER);
    if (!back) for (let y = shY + 1; y <= shY + 3; y++) { S.set(cx - 1, y, M.CLOTH); S.set(cx, y, M.CLOTH); }
  } else if (a === 2 || a === 4) {
    for (let y = shY; y <= waistY; y++) {
      const k = (y - shY) / Math.max(1, waistY - shY);
      const half = B.shHalf - 0.5 - k * (B.shHalf - B.waistHalf);
      spanRow(S, y, cx - half, cx + half - 1, M.CHAIN);
    }
    if (a === 2) for (let y = shY + 1; y <= hipY + u + 3; y++) spanRow(S, y, cx - 1.5, cx + 0.5, M.TABARD);
  } else if (a === 3 || a === 5) {
    for (let y = shY; y <= waistY; y++) {
      const k = (y - shY) / Math.max(1, waistY - shY);
      const half = B.shHalf - 0.5 - k * (B.shHalf - B.waistHalf) * 0.9;
      spanRow(S, y, cx - half, cx + half - 1, M.METAL);
    }
    spanRow(S, hipY + u + 1, cx - B.hipHalf, cx + B.hipHalf - 1, M.METAL); // faldar
    if (!back) { S.set(cx - 1, shY + 2, M.TRIM); S.set(cx, shY + 2, M.TRIM); S.set(cx - 1, shY + 3, M.TRIM); S.set(cx, shY + 3, M.TRIM); }
    if (a === 5) spanRow(S, shY + 1, cx - B.shHalf + 1, cx + B.shHalf - 2, M.TRIM);
  }
  // cinturón + hebilla
  spanRow(S, waistY + 1, cx - B.waistHalf, cx + B.waistHalf - 1, M.BELT);
  if (!back) { S.set(cx - 1, waistY + 1, M.TRIM); S.set(cx, waistY + 1, M.TRIM); }
  if (!back && a <= 1 && L.outfit !== 'robe') { S.set(cx + B.waistHalf - 2, waistY + 2, M.LEATHER); S.set(cx + B.waistHalf - 1, waistY + 2, M.LEATHER); } // zurrón
  if (L.emblem && !back) S.dot(cx - 2, shY + 2, L.emblem);

  // ---- brazos ----
  const shX = B.shHalf + 0.3;
  const armMat = a === 2 || a === 4 ? M.CHAIN : M.SLEEVE;
  const handMat = a >= 3 ? M.GLOVE : (a >= 1 ? M.GLOVE : M.SKIN);
  const arm = (side: number, swing: number, forced: [number, number] | null): V => {
    const sx = cx + side * shX - (side > 0 ? 1 : 0);
    const sy = shY + 1;
    let hx: number, hy: number;
    if (forced) { hx = sx + forced[0]; hy = sy + forced[1]; }
    else { hx = sx + side * 0.5; hy = sy + B.upper + B.fore - Math.abs(Math.sin(rad(swing))) * 2 - (swing > 0 ? 1 : 0); }
    const ex = (sx + hx) / 2 + side * 1.2, ey = (sy + hy) / 2;
    capsule(S, sx, sy, ex, ey, B.armT, armMat);
    capsule(S, ex, ey, hx, hy - 1, B.armT, a === 1 ? M.LEATHER : armMat);
    if (a === 3 || a === 5) capsule(S, ex, ey, hx, hy - 1, B.armT + 0.3, M.METAL);
    // mano 2×2
    S.fill(Math.round(hx - 1), Math.round(hy - 1), 2, 2, handMat);
    return [hx, hy];
  };
  const wHand = arm(wSide, P.arm[0], P.hand);
  const oHand = arm(-wSide, P.arm[1], null);
  // hombreras
  if (a === 3 || a === 5) {
    S.ellipse(cx - shX, shY + 0.5, 1.8, 1.4, M.METAL);
    S.ellipse(cx + shX - 1, shY + 0.5, 1.8, 1.4, M.METAL);
    if (a === 5) { S.set(cx - shX, shY - 1, M.TRIM); S.set(cx + shX - 1, shY - 1, M.TRIM); }
  }

  // ---- cuello y cabeza ----
  for (let y = headBot + 1; y < shY; y++) spanRow(S, y, cx - 1, cx, M.SKIN);
  drawHeadFB(S, L, B, cx, headTop, back, P);

  // ---- capucha/esclavina sobre hombros (de frente) ----
  if (L.head === 'hood') {
    spanRow(S, shY - 1, cx - B.shHalf + 0.5, cx - 2, M.HOOD);
    spanRow(S, shY - 1, cx + 1, cx + B.shHalf - 1.5, M.HOOD);
    spanRow(S, shY, cx - B.shHalf, cx - 2, M.HOOD); spanRow(S, shY, cx + 1, cx + B.shHalf - 1, M.HOOD);
    if (back) { spanRow(S, shY - 1, cx - B.shHalf + 0.5, cx + B.shHalf - 1.5, M.HOOD); spanRow(S, shY, cx - B.shHalf, cx + B.shHalf - 1, M.HOOD); spanRow(S, shY + 1, cx - 2, cx + 1, M.HOOD); }
  }

  // ---- escudo (brazo contrario al arma) ----
  if (L.shield) {
    const sx = oHand[0] + (-wSide) * 0.5, sy = oHand[1] - 3;
    S.ellipse(sx, sy, 3.3, 4.1, M.TRIM);
    S.ellipse(sx, sy, 2.3, 3.1, M.SHIELD);
    if (!back) {
      S.set(sx, sy, M.TRIM); S.set(sx - 1, sy, M.TRIM); S.set(sx, sy - 1, M.TRIM); S.set(sx - 1, sy - 1, M.TRIM);
      if ((L.armor ?? 0) >= 3) { S.set(sx - 0.5, sy - 3, M.TRIM); S.set(sx - 0.5, sy + 2, M.TRIM); }
    } else {
      spanRow(S, Math.round(sy), sx - 2, sx + 1, M.LEATHER);
    }
  }

  // ---- objeto / arma ----
  drawItem(S, L, P, wHand, wSide, back ? 'up' : 'down', out);
  // runas del manto
  if (L.runes && L.cape) {
    S.dot(cx - B.shHalf - 0.5, shY + 7, L.runes); S.dot(cx + B.shHalf - 1.5, shY + 9, L.runes);
    if (back) { S.dot(cx - 2, shY + 6, L.runes); S.dot(cx + 1, shY + 9, L.runes); S.dot(cx - 1, shY + 12, L.runes); }
  }
}

function drawHeadFB(S: Sculpt, L: FigLook, B: Body, cx: number, top: number, back: boolean, P: Pose) {
  const hw = B.headW, hh = B.headH;
  const half = hw / 2;
  // forma del cráneo (filas): estrecha arriba y en la barbilla
  const rowHalf = (r: number) => r === 0 ? half - 2 : r === 1 ? half - 1 : r >= hh - 1 ? half - 2 : r >= hh - 2 ? half - 1 : half;
  const hairMat = L.head === 'hood' || L.head === 'veil' ? M.HOOD : L.hairStyle === 'bald' ? M.SKIN : M.HAIR;
  for (let r = 0; r < hh; r++) spanRow(S, top + r, cx - rowHalf(r), cx + rowHalf(r) - 1, M.SKIN);
  if (back) {
    for (let r = 0; r < hh - 1; r++) spanRow(S, top + r, cx - rowHalf(r), cx + rowHalf(r) - 1, hairMat);
    if (L.hairStyle === 'bun') S.ellipse(cx - 0.5, top + 1, 2, 1.6, M.HAIR);
    if (L.hairStyle === 'pony' || L.hairStyle === 'braid') capsule(S, cx - 0.5, top + 3, cx - 0.5 + P.hair, top + hh + 4, 2, M.HAIR);
    drawHeadGearFB(S, L, B, cx, top, true);
    return;
  }
  // pelo: casquete + laterales + flequillo
  if (L.hairStyle !== 'bald') {
    spanRow(S, top, cx - rowHalf(0), cx + rowHalf(0) - 1, M.HAIR);
    spanRow(S, top + 1, cx - rowHalf(1), cx + rowHalf(1) - 1, M.HAIR);
    spanRow(S, top + 2, cx - half, cx + half - 1, M.HAIR);
    // flequillo en dientes
    for (let x = Math.round(cx - half); x <= Math.round(cx + half - 1); x++) if ((x + top) % 3 !== 0) S.set(x, top + 3, M.HAIR);
    // patillas / mechones laterales
    const side = L.hairStyle === 'short' || L.hairStyle === 'spiky' ? 2 : L.hairStyle === 'bob' ? 5 : 4;
    for (let r = 3; r < 3 + side && r < hh; r++) { S.set(cx - half, top + r, M.HAIR); S.set(cx + half - 1, top + r, M.HAIR); }
    if (L.hairStyle === 'spiky' || L.hairStyle === 'wild') { S.set(cx - 2, top - 1, M.HAIR); S.set(cx + 1, top - 1, M.HAIR); S.set(cx - half + 1, top - 1 + 1, M.HAIR); }
    if (L.hairStyle === 'bun') S.ellipse(cx - 0.5, top - 1, 2, 1.6, M.HAIR);
    if (L.hairStyle === 'braid') capsule(S, cx + half - 0.5, top + 5, cx + half + P.hair * 0.5, top + hh + 4, 2, M.HAIR);
  } else {
    // calvo: brillo de coronilla lo pone la luz; sienes con algo de pelo
    S.set(cx - half, top + 3, M.HAIR); S.set(cx + half - 1, top + 3, M.HAIR);
  }
  // orejas
  if (L.pointyEars) { S.set(cx - half - 1, top + 4, M.SKIN); S.set(cx - half - 2, top + 3, M.SKIN); S.set(cx + half, top + 4, M.SKIN); S.set(cx + half + 1, top + 3, M.SKIN); }
  // rasgos (detalles con color fijo)
  const ey = top + 4 + (hh >= 9 ? 1 : 0);
  const skinSh = mixC(mulC(L.skin, 0.74), '#5a3048', 0.18);
  const lash = mixC(mulC(L.hair, 0.45), '#120a18', 0.45);
  const brow = mixC(mulC(L.hair, 0.7), '#201018', 0.25);
  if (L.head !== 'helm') {
    S.dot(cx - 3, ey - 1, brow); S.dot(cx - 2, ey - 1, brow); S.dot(cx + 1, ey - 1, brow); S.dot(cx + 2, ey - 1, brow);
  }
  if (P.blink || P.hurt) {
    S.dot(cx - 3, ey + 1, lash); S.dot(cx - 2, ey + 1, lash); S.dot(cx + 1, ey + 1, lash); S.dot(cx + 2, ey + 1, lash);
  } else {
    const iris = L.eyes, glint = L.glowEyes ? '#ffffff' : mixC(L.eyes, '#ffffff', 0.75);
    S.dot(cx - 3, ey, lash); S.dot(cx - 2, ey, glint);
    S.dot(cx - 3, ey + 1, iris); S.dot(cx - 2, ey + 1, mulC(iris, 0.7));
    S.dot(cx + 1, ey, glint); S.dot(cx + 2, ey, lash);
    S.dot(cx + 1, ey + 1, mulC(iris, 0.7)); S.dot(cx + 2, ey + 1, iris);
  }
  // nariz (sombra de 1 px) · mejillas · boca
  S.dot(cx, ey + 2, skinSh);
  if (L.freckles) { S.dot(cx - 3, ey + 2, mixC(L.skin, '#9a5a3a', 0.4)); S.dot(cx + 2, ey + 2, mixC(L.skin, '#9a5a3a', 0.4)); }
  else { S.dot(cx - 4, ey + 2, mixC(L.skin, '#e87a7a', 0.35)); S.dot(cx + 3, ey + 2, mixC(L.skin, '#e87a7a', 0.35)); }
  const mouthY = Math.min(top + hh - 2, ey + 3);
  if (P.hurt) { S.dot(cx - 1, mouthY, '#6a2a30'); S.dot(cx, mouthY, '#6a2a30'); }
  else S.dot(cx - 1, mouthY, mixC(mulC(L.skin, 0.62), '#7a3040', 0.3));
  // barba / bigote
  if (L.beard && L.beard !== 'none') {
    const by = mouthY;
    if (L.beard === 'mustache') { spanRow(S, by - 1, cx - 2, cx + 1, M.BEARD); }
    else {
      spanRow(S, by - 1, cx - 2, cx + 1, M.BEARD);
      for (let y = by; y < top + hh + (L.beard === 'long' ? 4 : 1); y++) {
        const k = y - by;
        const hw2 = L.beard === 'long' ? Math.max(1, half - 1 - k * 0.6) : half - 1;
        spanRow(S, y, cx - hw2, cx + hw2 - 1, M.BEARD);
      }
      S.dot(cx - 1, by, '#3a2228');
    }
  }
  drawHeadGearFB(S, L, B, cx, top, false);
}

function drawHeadGearFB(S: Sculpt, L: FigLook, B: Body, cx: number, top: number, back: boolean) {
  const half = B.headW / 2;
  switch (L.head) {
    case 'hood': {
      spanRow(S, top - 1, cx - 2, cx + 1, M.HOOD);
      spanRow(S, top, cx - half + 0.5, cx + half - 1.5, M.HOOD);
      for (let r = 1; r < B.headH; r++) {
        const inner = r <= 3 || back;
        S.set(cx - half - 1 + (r > B.headH - 3 ? 1 : 0), top + r, M.HOOD);
        S.set(cx + half - (r > B.headH - 3 ? 1 : 0), top + r, M.HOOD);
        if (inner) { S.set(cx - half, top + r, M.HOOD); S.set(cx + half - 1, top + r, M.HOOD); }
      }
      spanRow(S, top + 1, cx - half, cx + half - 1, M.HOOD);
      if (!back) for (let x = Math.round(cx - half + 1); x <= Math.round(cx + half - 2); x++) if ((x * 7) % 3 === 0) S.set(x, top + 2, M.HOOD);
      if (back) { S.set(cx - 1, top + B.headH, M.HOOD); S.set(cx, top + B.headH, M.HOOD); }
      break;
    }
    case 'cap':
      spanRow(S, top - 1, cx - half + 1, cx + half - 2, M.HAT); spanRow(S, top, cx - half, cx + half - 1, M.HAT); spanRow(S, top + 1, cx - half, cx + half - 1, M.HAT);
      if (!back) spanRow(S, top + 2, cx - half - 1, cx + 1, M.HAT);
      break;
    case 'widehat':
      spanRow(S, top - 2, cx - 2, cx + 1, M.HAT); spanRow(S, top - 1, cx - 3, cx + 2, M.HAT); spanRow(S, top, cx - half, cx + half - 1, M.HAT);
      spanRow(S, top + 1, cx - half - 3, cx + half + 2, M.HAT);
      spanRow(S, top, cx - 3, cx + 2, M.TRIM);
      break;
    case 'crown':
      spanRow(S, top, cx - half + 1, cx + half - 2, M.TRIM);
      for (let x = Math.round(cx - half + 1); x <= Math.round(cx + half - 2); x += 2) S.set(x, top - 1, M.TRIM);
      if (!back) S.set(cx - 1, top, M.GEM);
      break;
    case 'circlet':
      spanRow(S, top + 2, cx - half, cx + half - 1, M.TRIM);
      if (!back) { S.set(cx - 1, top + 2, M.GEM); S.set(cx, top + 2, M.GEM); S.set(cx - 1, top + 1, M.GEM); }
      break;
    case 'scarf': case 'bandana':
      spanRow(S, top, cx - half + 1, cx + half - 2, M.HAT); spanRow(S, top + 1, cx - half, cx + half - 1, M.HAT); spanRow(S, top + 2, cx - half, cx + half - 1, M.HAT);
      if (L.head === 'scarf') for (let r = 3; r < B.headH; r++) { S.set(cx - half, top + r, M.HAT); S.set(cx + half - 1, top + r, M.HAT); }
      if (back) { S.set(cx + 1, top + 3, M.HAT); S.set(cx + 2, top + 4, M.HAT); }
      break;
    case 'veil':
      spanRow(S, top - 1, cx - 2, cx + 1, M.HOOD);
      for (let r = 0; r < B.headH + 3; r++) { S.set(cx - half - (r > 3 ? 1 : 0), top + r, M.HOOD); S.set(cx + half - 1 + (r > 3 ? 1 : 0), top + r, M.HOOD); }
      spanRow(S, top, cx - half + 1, cx + half - 2, M.HOOD);
      break;
    case 'helm':
      spanRow(S, top - 1, cx - 2, cx + 1, M.METAL);
      for (let r = 0; r < 5; r++) spanRow(S, top + r, cx - half, cx + half - 1, M.METAL);
      if (!back) { spanRow(S, top + 4, cx - 3, cx + 2, M.DARK); S.set(cx - 0.5, top + 5, M.METAL); }
      break;
    default: break;
  }
}

// ================================================================ PERFIL (mirando a la derecha)
function drawSide(S: Sculpt, L: FigLook, B: Body, P: Pose, out: FigOut) {
  const a = L.armor ?? 0;
  const robeLike = L.outfit === 'robe' || L.outfit === 'dress';
  // ---- piernas: ángulos → posiciones; el pie más bajo apoya en el suelo ----
  const hipBase = GROUND - B.legLen;
  const thigh = (B.legLen - 2) * 0.5, shin = (B.legLen - 2) * 0.5;
  const legPts = (i: number) => {
    const ta = rad(P.leg[i]), ka = rad(P.leg[i] - P.knee[i]);
    const kx = Math.sin(ta) * thigh, ky = Math.cos(ta) * thigh;
    const ax = kx + Math.sin(ka) * shin, ay = ky + Math.cos(ka) * shin;
    return { kx, ky, ax, ay };
  };
  const l0 = legPts(0), l1 = legPts(1);
  // altura de la cadera: el tobillo más bajo toca GROUND-2
  const lowest = Math.max(l0.ay, l1.ay);
  const hipY = Math.round(GROUND - 2 - lowest) + 0;
  const dropBob = hipY - hipBase;                        // rebote natural al andar
  const hurtY = P.hurt ? 1 : 0;
  const u = P.bob + dropBob + hurtY;
  const cx = CX - 1;                                       // cadera un pelo a la izquierda (deja sitio delante)
  const ucx = cx + P.lean + (B.stoop ? 1 : 0);             // eje del cuerpo superior
  const shY = hipBase - B.torsoH + u - P.breath;
  const headBot = shY - B.neck - 1 + (B.stoop ? 1 : 0);
  const headTop = headBot - B.headH + 1;
  const hx0 = ucx + (B.stoop ? 2 : 0);                      // eje de la cabeza

  const drawLeg = (i: number, far: boolean) => {
    const lp = i === 0 ? l0 : l1;
    const hx = cx, hy = hipY;
    const kx = hx + lp.kx, ky = hy + lp.ky, ax = hx + lp.ax, ay = hy + lp.ay;
    const mat = M.PANTS;
    capsule(S, hx, hy, kx, ky, B.legT, mat);
    capsule(S, kx, ky, ax, ay - 1, B.legT, mat);
    if (a >= 3) capsule(S, kx, ky, ax, ay - 1, B.legT + 0.3, M.METAL);
    // bota de perfil: 3 filas, puntera hacia delante
    const bx = Math.round(ax), by = Math.round(ay);
    for (let y = by - 2; y <= by + 1; y++) spanRow(S, y, bx - 1, bx + 1 + (y >= by ? 1 : 0), M.BOOT);
    spanRow(S, by + 2, bx - 1, bx + 2, M.SOLE);
    if (far) S.dot(bx, by - 1, mixC(mulC(L.boots, 0.6), '#1a1430', 0.3));
  };

  // ---- capa (detrás, ondea hacia atrás) ----
  if (L.cape) {
    const bottom = L.capeLong ? GROUND - 2 : hipY + 2;
    for (let y = shY; y <= bottom; y++) {
      const k = (y - shY) / Math.max(1, bottom - shY);
      const back = 3 + k * (2 + Math.max(0, P.cape));
      spanRow(S, y, ucx - back - (k > 0.6 ? Math.max(0, P.cape) * 0.6 : 0), ucx - 1, M.CAPE);
    }
    spanRow(S, bottom, ucx - 3 - Math.max(0, P.cape) * 1.6, ucx - 1, M.LINING);
  }
  if (L.hairStyle === 'long' || L.hairStyle === 'wild' || L.hairStyle === 'pony' || L.hairStyle === 'braid') {
    const len = L.hairStyle === 'long' || L.hairStyle === 'wild' ? 9 : 7;
    capsule(S, hx0 - 2.5, headTop + 4, hx0 - 3.5 - P.hair, headTop + 4 + len, L.hairStyle === 'long' ? 3.2 : 2, M.HAIR);
  }
  // ---- brazo lejano (escudo / mano libre) ----
  const shX = ucx + 0.5, shYY = shY + 1;
  const armPts = (ang: number, el: number, forced: [number, number] | null) => {
    if (forced) return { ex: shX + forced[0] * 0.5 - 0.5, ey: shYY + forced[1] * 0.5 + 0.5, hx: shX + forced[0], hy: shYY + forced[1] };
    const a1 = rad(ang), a2 = rad(ang + el);
    const ex = shX + Math.sin(a1) * B.upper, ey = shYY + Math.cos(a1) * B.upper;
    return { ex, ey, hx: ex + Math.sin(a2) * B.fore, hy: ey + Math.cos(a2) * B.fore };
  };
  const armMat = a === 2 || a === 4 ? M.CHAIN : M.SLEEVE;
  const handMat = a >= 1 ? M.GLOVE : M.SKIN;
  const drawArm = (pts: { ex: number; ey: number; hx: number; hy: number }) => {
    capsule(S, shX, shYY, pts.ex, pts.ey, B.armT, armMat);
    capsule(S, pts.ex, pts.ey, pts.hx, pts.hy, B.armT, a === 1 ? M.LEATHER : armMat);
    if (a === 3 || a === 5) capsule(S, pts.ex, pts.ey, pts.hx, pts.hy, B.armT + 0.3, M.METAL);
    S.fill(Math.round(pts.hx - 1), Math.round(pts.hy - 1), 2, 2, handMat);
  };
  const farArm = armPts(P.arm[1], P.elbow[1], null);
  drawArm(farArm);
  if (L.shield) {
    const sx = farArm.hx + 1.5, sy = farArm.hy - 2.5;
    S.ellipse(sx, sy, 1.8, 4.4, M.TRIM);
    S.ellipse(sx + 0.3, sy, 1, 3.4, M.SHIELD);
  }
  drawLeg(0, true);

  // ---- torso de perfil (pecho hacia delante) ----
  const torsoRows = hipY + u - shY - dropBob;
  for (let r = 0; r <= torsoRows; r++) {
    const y = shY + r;
    const k = r / Math.max(1, torsoRows);
    const lean = Math.round(P.lean * (1 - k));
    const front = 2.5 - k * 0.8 + (L.build === 'stout' ? 1.5 : 0) - (L.build === 'thin' ? 0.5 : 0);
    const backE = 2.5 - k * 0.4 + (L.build === 'stout' ? 1 : 0);
    spanRow(S, y, cx - backE + lean, cx + front + lean, M.CLOTH);
  }
  const waistY = shY + torsoRows - 1;
  const hemEnd = robeLike ? GROUND - 2 : L.outfit === 'coat' ? hipY + 6 : hipY + 2;
  for (let y = shY + torsoRows + 1; y <= hemEnd; y++) {
    const k = (y - hipY) / Math.max(1, hemEnd - hipY);
    const wob = y >= hemEnd - 1 ? -Math.abs(P.hem) : 0;
    const mat = L.outfit === 'dress' ? M.SKIRT : M.CLOTH;
    spanRow(S, y, cx - 3 - (robeLike ? k * 1.5 : 0) + wob, cx + 3 + (robeLike ? k * 1.8 : 0), mat);
  }
  drawLeg(1, false);
  if (robeLike) {
    // el hábito tapa las piernas: se repinta el bajo por encima de la pierna cercana
    for (let y = hipY + 1; y <= GROUND - 3; y++) {
      const k = (y - hipY) / Math.max(1, GROUND - 2 - hipY);
      spanRow(S, y, cx - 3 - k * 1.5 - (y >= GROUND - 4 ? Math.abs(P.hem) : 0), cx + 3 + k * 1.8, L.outfit === 'dress' ? M.SKIRT : M.CLOTH);
    }
  }
  if (L.outfit === 'apron') for (let y = shY + 3; y <= hipY + 5; y++) spanRow(S, y, cx + 1 + P.lean * 0.5, cx + 3 + P.lean * 0.5, M.APRON);
  // armadura de perfil
  if (a === 1) for (let y = shY + 1; y <= waistY - 1; y++) spanRow(S, y, cx - 2 + P.lean, cx + 2 + P.lean, M.LEATHER);
  else if (a === 2 || a === 4) {
    for (let y = shY; y <= waistY; y++) spanRow(S, y, cx - 2.5 + P.lean, cx + 2.5 + P.lean, M.CHAIN);
    if (a === 2) for (let y = shY + 1; y <= hipY + u + 3; y++) spanRow(S, y, cx + 2 + P.lean * 0.5, cx + 3 + P.lean * 0.5, M.TABARD);
  } else if (a === 3 || a === 5) {
    for (let y = shY; y <= waistY; y++) spanRow(S, y, cx - 2.5 + P.lean, cx + 3 + P.lean, M.METAL);
    spanRow(S, hipY + u + 1, cx - 3, cx + 3, M.METAL);
    S.set(cx + 3 + P.lean, shY + 3, M.TRIM);
    if (a === 5) spanRow(S, shY + 1, cx - 2 + P.lean, cx + 3 + P.lean, M.TRIM);
  }
  spanRow(S, waistY + 1, cx - 2.5 + P.lean * 0.3, cx + 2.5 + P.lean * 0.3, M.BELT);
  S.set(cx + 2 + P.lean * 0.3, waistY + 1, M.TRIM);
  if (a <= 1 && L.outfit !== 'robe') { S.set(cx - 3, waistY + 2, M.LEATHER); S.set(cx - 3, waistY + 3, M.LEATHER); }

  // ---- cabeza de perfil ----
  for (let y = headBot + 1; y < shY; y++) spanRow(S, y, hx0, hx0 + 1, M.SKIN);
  drawHeadSide(S, L, B, hx0, headTop, P);
  if (L.head === 'hood') {
    spanRow(S, shY - 1, hx0 - 3, hx0, M.HOOD); spanRow(S, shY, hx0 - 3, hx0 + 1, M.HOOD);
  }

  // ---- brazo cercano + arma ----
  const nearArm = armPts(P.arm[0], P.elbow[0], P.hand);
  drawArm(nearArm);
  if (a === 3 || a === 5) { S.ellipse(shX - 0.5, shY + 0.5, 2, 1.5, M.METAL); if (a === 5) S.set(shX - 0.5, shY - 1, M.TRIM); }
  drawItem(S, L, P, [nearArm.hx, nearArm.hy], 1, 'side', out);
  if (L.runes && L.cape) { S.dot(ucx - 4, shY + 8, L.runes); S.dot(ucx - 3, shY + 4, L.runes); }
}

function drawHeadSide(S: Sculpt, L: FigLook, B: Body, cx: number, top: number, P: Pose) {
  const hh = B.headH;
  // cráneo de perfil: occipucio a la izquierda, cara a la derecha
  const rows: [number, number][] = [];
  for (let r = 0; r < hh; r++) {
    let x0 = cx - 4, x1 = cx + 4;
    if (r === 0) { x0 = cx - 2; x1 = cx + 2; }
    else if (r === 1) { x0 = cx - 3; x1 = cx + 3; }
    else if (r >= hh - 1) { x0 = cx - 1; x1 = cx + 3; }
    else if (r >= hh - 2) { x0 = cx - 3; x1 = cx + 4; }
    rows.push([x0, x1]);
    spanRow(S, top + r, x0, x1, M.SKIN);
  }
  const ey = top + 4 + (hh >= 9 ? 1 : 0);
  S.set(cx + 5, ey + 1, M.SKIN);                         // nariz
  if (L.hairStyle !== 'bald') {
    for (let r = 0; r < 3; r++) spanRow(S, top + r, rows[r][0], rows[r][1], M.HAIR);
    for (let r = 3; r < hh - 2; r++) spanRow(S, top + r, rows[r][0], cx - (r < 5 ? 0 : 1), M.HAIR);
    S.set(cx + 1, top + 3, M.HAIR); S.set(cx + 2, top + 3, M.HAIR); S.set(cx + 3, top + 3, M.HAIR); // flequillo
    if (L.hairStyle === 'spiky' || L.hairStyle === 'wild') { S.set(cx - 1, top - 1, M.HAIR); S.set(cx + 1, top - 1, M.HAIR); S.set(cx - 4, top, M.HAIR); }
    if (L.hairStyle === 'bun') S.ellipse(cx - 3.5, top + 1, 1.8, 1.8, M.HAIR);
    if (L.hairStyle === 'bob') for (let r = 3; r < hh; r++) spanRow(S, top + r, rows[r][0], cx - 1, M.HAIR);
  } else {
    S.set(cx - 3, top + 4, M.HAIR);
  }
  // oreja
  S.set(cx - 1, ey + 1, M.SKIN); S.set(cx - 1, ey, M.SKIN);
  if (L.pointyEars) { S.set(cx - 2, ey - 1, M.SKIN); S.set(cx - 3, ey - 2, M.SKIN); }
  // ojo, ceja, boca
  const lash = mixC(mulC(L.hair, 0.45), '#120a18', 0.45);
  const brow = mixC(mulC(L.hair, 0.7), '#201018', 0.25);
  if (L.head !== 'helm') { S.dot(cx + 2, ey - 1, brow); S.dot(cx + 3, ey - 1, brow); }
  if (P.blink || P.hurt) S.dot(cx + 3, ey + 1, lash);
  else { S.dot(cx + 3, ey, L.glowEyes ? '#ffffff' : mixC(L.eyes, '#ffffff', 0.7)); S.dot(cx + 3, ey + 1, L.eyes); S.dot(cx + 2, ey, lash); }
  S.dot(cx + 4, ey + 2, mixC(L.skin, '#e87a7a', 0.3));
  S.dot(cx + 4, Math.min(top + hh - 2, ey + 3), P.hurt ? '#6a2a30' : mixC(mulC(L.skin, 0.62), '#7a3040', 0.3));
  if (L.beard && L.beard !== 'none') {
    const by = Math.min(top + hh - 2, ey + 3);
    if (L.beard === 'mustache') { S.set(cx + 3, by - 1, M.BEARD); S.set(cx + 4, by - 1, M.BEARD); }
    else {
      for (let y = by - 1; y < top + hh + (L.beard === 'long' ? 4 : 1); y++) spanRow(S, y, cx, cx + 4 - Math.max(0, y - by - 1), M.BEARD);
    }
  }
  // tocados
  switch (L.head) {
    case 'hood':
      spanRow(S, top - 1, cx - 3, cx + 1, M.HOOD);
      spanRow(S, top, cx - 4, cx + 2, M.HOOD);
      spanRow(S, top + 1, cx - 5, cx + 3, M.HOOD);
      S.set(cx + 4, top + 2, M.HOOD);                                    // visera de la capucha
      spanRow(S, top + 2, cx - 5, cx - 0, M.HOOD);
      for (let r = 3; r < hh; r++) spanRow(S, top + r, cx - 5 + (r >= hh - 1 ? 1 : 0), cx - 1, M.HOOD);
      break;
    case 'cap':
      spanRow(S, top - 1, cx - 2, cx + 2, M.HAT); spanRow(S, top, cx - 3, cx + 3, M.HAT); spanRow(S, top + 1, cx - 4, cx + 5, M.HAT);
      break;
    case 'widehat':
      spanRow(S, top - 2, cx - 2, cx + 1, M.HAT); spanRow(S, top - 1, cx - 3, cx + 2, M.HAT); spanRow(S, top, cx - 4, cx + 3, M.HAT);
      spanRow(S, top + 1, cx - 7, cx + 7, M.HAT); spanRow(S, top, cx - 3, cx + 2, M.TRIM);
      break;
    case 'crown': spanRow(S, top, cx - 3, cx + 3, M.TRIM); S.set(cx - 2, top - 1, M.TRIM); S.set(cx, top - 1, M.TRIM); S.set(cx + 2, top - 1, M.TRIM); break;
    case 'circlet': spanRow(S, top + 2, cx - 4, cx + 4, M.TRIM); S.set(cx + 3, top + 2, M.GEM); break;
    case 'scarf': case 'bandana':
      spanRow(S, top, cx - 2, cx + 2, M.HAT); spanRow(S, top + 1, cx - 3, cx + 3, M.HAT); spanRow(S, top + 2, cx - 4, cx + 3, M.HAT);
      S.set(cx - 5, top + 3, M.HAT); S.set(cx - 6, top + 4, M.HAT);
      if (L.head === 'scarf') for (let r = 3; r < hh; r++) spanRow(S, top + r, rows[r][0], cx - 1, M.HAT);
      break;
    case 'veil':
      spanRow(S, top - 1, cx - 2, cx + 2, M.HOOD);
      for (let r = 0; r < hh + 3; r++) spanRow(S, top + r, cx - 5, cx - 1 + (r < 2 ? 3 : 0), M.HOOD);
      break;
    case 'helm':
      spanRow(S, top - 1, cx - 2, cx + 2, M.METAL);
      for (let r = 0; r < 6; r++) spanRow(S, top + r, rows[r][0], rows[r][1], M.METAL);
      S.set(cx + 3, top + 4, M.DARK); S.set(cx + 2, top + 4, M.DARK);
      break;
    default: break;
  }
}

// ================================================================ OBJETOS EN LA MANO
function drawItem(S: Sculpt, L: FigLook, P: Pose, hand: V, sideSign: number, view: FigDir, out: FigOut) {
  const item = L.item ?? 'none';
  const [hx, hy] = hand;
  out.hand = [hx, hy];
  out.tipX = hx; out.tipY = hy;
  if (item === 'none') return;
  // estela del tajo (detrás de la hoja)
  if (P.smear && (item === 'sword' || item === 'axe' || item === 'hammer' || item === 'spear')) {
    const [a0, a1] = P.smear;
    const len = (L.bladeLen ?? 7) + 3;
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = a0 + (a1 - a0) * t;
      const alpha = 0.18 + 0.5 * t;
      for (let r = 3; r <= len; r++) {
        const x = Math.round(hx + Math.cos(ang) * r), y = Math.round(hy + Math.sin(ang) * r);
        if (x < 0 || y < 0 || x >= FIG_W || y >= FIG_H) continue;
        if (S.get(x, y) === 0) S.dot(x, y, `rgba(255,250,230,${(alpha * (0.45 + 0.55 * r / len)).toFixed(2)})`);
      }
    }
  }
  // dirección del objeto
  let wv: V;
  if (P.wv) wv = P.wv;
  else if (item === 'staff' || item === 'cane' || item === 'spear' || item === 'rod') wv = [0, -1];
  else if (view === 'side') wv = [0.45, 0.9];
  else wv = [sideSign * 0.18, 1];
  const n = Math.hypot(wv[0], wv[1]) || 1;
  const dx = wv[0] / n, dy = wv[1] / n;
  switch (item) {
    case 'sword': case 'axe': {
      const len = L.bladeLen ?? 7;
      // pomo y empuñadura (al otro lado de la mano)
      S.set(hx - dx * 2, hy - dy * 2, M.TRIM);
      capsule(S, hx - dx * 1.2, hy - dy * 1.2, hx, hy, 1.4, M.LEATHER);
      // guarda perpendicular
      const px = -dy, py = dx;
      for (let k = -2; k <= 2; k++) S.set(hx + dx * 1.2 + px * k, hy + dy * 1.2 + py * k, M.TRIM);
      if (item === 'axe') {
        capsule(S, hx, hy, hx + dx * (len - 1), hy + dy * (len - 1), 1.4, M.WOOD);
        const ex = hx + dx * (len - 2), ey = hy + dy * (len - 2);
        S.tri(ex, ey, ex + px * 4 - dx * 2, ey + py * 4 - dy * 2, ex + px * 4 + dx * 2, ey + py * 4 + dy * 2, M.BLADE);
        out.tipX = Math.round(ex + px * 4); out.tipY = Math.round(ey + py * 4);
        break;
      }
      // hoja 2 px con fil central
      const bx0 = hx + dx * 2, by0 = hy + dy * 2, bx1 = hx + dx * (2 + len), by1 = hy + dy * (2 + len);
      capsule(S, bx0, by0, bx1 - dx, by1 - dy, 2, M.BLADE);
      S.set(bx1, by1, M.BLADE);
      out.tipX = Math.round(bx1); out.tipY = Math.round(by1);
      break;
    }
    case 'staff': case 'cane': case 'spear': case 'rod': {
      const vertical = Math.abs(dy) > 0.85;
      const up = item === 'cane' ? 0 : item === 'rod' ? 10 : vertical ? Math.max(8, hy - 5) : 12;
      const down = item === 'cane' ? 9 : item === 'rod' ? 2 : vertical ? Math.max(2, GROUND - 1 - hy) : 7;
      const tx = hx + dx * up, ty = hy + dy * up;
      const bx = hx - dx * down, by = hy - dy * down;
      capsule(S, bx, by, tx, ty, item === 'staff' ? 2 : 1.4, M.WOOD);
      if (item === 'staff') {
        // cristal facetado con garras doradas
        const c = L.crystal ?? 0;
        const gx = tx + dx * (2 + c), gy = ty + dy * (2 + c);
        S.set(tx - dy * 1.5, ty + dx * 1.5, M.TRIM); S.set(tx + dy * 1.5, ty - dx * 1.5, M.TRIM);
        S.ellipse(gx, gy, 1.2 + c * 0.7, 1.8 + c * 0.8, M.GEM);
        S.dot(gx - 0.5, gy - 1, '#ffffff');
        if (P.glow > 0) {
          const r = 2.5 + c + P.glow * 3;
          for (let a = 0; a < 12; a++) {
            const an = (a / 12) * Math.PI * 2;
            const x = gx + Math.cos(an) * r, y = gy + Math.sin(an) * r;
            if (S.get(Math.round(x), Math.round(y)) === 0) S.dot(x, y, `rgba(200,240,255,${(0.25 + P.glow * 0.45).toFixed(2)})`);
          }
        }
        out.tipX = Math.round(gx); out.tipY = Math.round(gy);
      } else if (item === 'spear') {
        S.tri(tx - dy * 1.5, ty + dx * 1.5, tx + dy * 1.5, ty - dx * 1.5, tx + dx * 4, ty + dy * 4, M.BLADE);
        out.tipX = Math.round(tx + dx * 4); out.tipY = Math.round(ty + dy * 4);
      } else if (item === 'rod') {
        // sedal
        for (let k = 1; k < 9; k++) S.dot(tx + k * 0.6, ty + k * 1.1, 'rgba(230,230,240,0.6)');
      } else {
        S.set(hx - 1, hy - 1, M.WOOD); // puño del bastón
      }
      break;
    }
    case 'lantern': {
      capsule(S, hx, hy, hx, hy + 2, 1, M.DARK);
      S.fill(Math.round(hx - 1.5), Math.round(hy + 2), 4, 4, M.METAL);
      S.dot(hx - 0.5, hy + 3, '#ffe9a0'); S.dot(hx + 0.5, hy + 3, '#ffd060'); S.dot(hx - 0.5, hy + 4, '#ffd060'); S.dot(hx + 0.5, hy + 4, '#ffb040');
      out.tipX = Math.round(hx); out.tipY = Math.round(hy + 4);
      break;
    }
    case 'book': case 'scroll': {
      if (item === 'book') { S.fill(Math.round(hx - 2), Math.round(hy - 3), 4, 4, M.ITEM); S.set(hx - 2, hy - 3, M.ITEM2); S.set(hx - 2, hy - 2, M.ITEM2); }
      else { S.fill(Math.round(hx - 1), Math.round(hy - 4), 2, 5, M.ITEM2); S.set(hx - 1, hy - 4, M.ITEM); S.set(hx - 1, hy + 1, M.ITEM); }
      break;
    }
    case 'hammer': {
      capsule(S, hx, hy, hx + dx * 6, hy + dy * 6, 1.4, M.WOOD);
      const ex = hx + dx * 6, ey = hy + dy * 6;
      S.fill(Math.round(ex - 2), Math.round(ey - 1), 4, 3, M.METAL);
      out.tipX = Math.round(ex); out.tipY = Math.round(ey);
      break;
    }
    case 'basket': {
      S.ellipse(hx, hy + 2, 3, 2, M.ITEM);
      spanRow(S, Math.round(hy + 1), hx - 2, hx + 2, M.ITEM2);
      S.set(hx - 2, hy - 1, M.ITEM); S.set(hx + 2, hy - 1, M.ITEM); S.set(hx - 1, hy - 2, M.ITEM); S.set(hx + 1, hy - 2, M.ITEM); S.set(hx, hy - 2, M.ITEM);
      break;
    }
    case 'bow': {
      for (let k = -6; k <= 6; k++) S.set(hx + (view === 'side' ? 1 + Math.cos(k / 6 * 1.2) * 2 : 0) + (view !== 'side' ? Math.abs(k) * 0.15 * sideSign : 0), hy + k, M.WOOD);
      for (let k = -5; k <= 5; k++) S.dot(hx + (view === 'side' ? -0.5 : 0), hy + k, 'rgba(240,240,230,0.7)');
      break;
    }
    default: break;
  }
}

// ================================================================ POSES COMUNES
const TAU = Math.PI * 2;

/** Ciclo de andar/correr continuo (n fases). */
export function walkPose(f: number, n: number, run: boolean, dir: FigDir): Pose {
  const ph = (f / n) * TAU;
  const s = Math.sin(ph), c = Math.cos(ph);
  const A = run ? 40 : 26, K = run ? 70 : 38, AR = run ? 46 : 22;
  const p: Pose = { ...REST_POSE };
  p.leg = [A * s, -A * s];
  p.knee = [K * Math.max(0, c) + (run ? 12 : 4), K * Math.max(0, -c) + (run ? 12 : 4)];
  p.arm = [AR * s, -AR * s];
  p.elbow = run ? [70, 70] : [12 + 8 * Math.max(0, s), 12 + 8 * Math.max(0, -s)];
  p.lift = [Math.round((run ? 3 : 2) * Math.max(0, s)), Math.round((run ? 3 : 2) * Math.max(0, -s))];
  p.lean = run ? 2 : 0;
  if (dir !== 'side') p.bob = Math.abs(s) > 0.7 ? 1 : 0;
  if (run && dir !== 'side') p.bob = Math.abs(s) > 0.7 ? 0 : -1;
  p.hem = Math.round(Math.sin(ph - 0.8));
  p.hair = Math.sin(ph - 1.2) * (run ? 1.6 : 0.8) + (run ? 1.2 : 0);
  p.cape = (run ? 2.6 : 1) + Math.sin(ph - 1) * (run ? 1.2 : 0.7);
  return p;
}

/** Reposo: 0-3 respiración, 4 parpadeo. */
export function idlePose(f: number): Pose {
  const p: Pose = { ...REST_POSE };
  const cyc = [0, 1, 1, 0, 0][f] ?? 0;
  p.breath = cyc;
  p.hair = [0, 0.4, 0.6, 0.3, 0][f] ?? 0;
  p.cape = [0.2, 0.5, 0.8, 0.5, 0.2][f] ?? 0;
  p.elbow = [12, 12];
  p.blink = f === 4;
  return p;
}

// ================================================================ VOLTERETA
/** Ovillo que gira: cuerpo redondo, cabeza recorriendo el contorno, capa en remolino. */
export function sculptRoll(L: FigLook, f: number, n: number, dir: FigDir): FigOut {
  const S = new Sculpt(FIG_W, FIG_H);
  const cy = GROUND - 7, cx = CX;
  const spin = (f / n) * Math.PI * 2 * (dir === 'up' ? -1 : 1);
  const bodyMat = L.cape ? M.CAPE : L.head === 'hood' ? M.HOOD : M.CLOTH;
  // estela de polvo/capa
  for (let k = 1; k <= 3; k++) {
    const a = spin - k * 0.5;
    S.dot(cx + Math.cos(a + Math.PI) * 8, cy + Math.sin(a + Math.PI) * 6, `rgba(220,210,190,${(0.35 - k * 0.09).toFixed(2)})`);
  }
  S.ellipse(cx, cy, 6.2, 5.8, bodyMat);
  S.ellipse(cx + Math.cos(spin) * 1.2, cy + Math.sin(spin) * 1.2, 4, 3.6, (L.armor ?? 0) >= 3 ? M.METAL : (L.armor === 2 || L.armor === 4) ? M.CHAIN : M.CLOTH);
  // cabeza recorriendo el contorno
  const hx = cx + Math.cos(spin - 1.2) * 4.5, hy = cy + Math.sin(spin - 1.2) * 4.2;
  S.ellipse(hx, hy, 2.6, 2.4, L.head === 'hood' ? M.HOOD : M.HAIR);
  // botas y manos recogidas
  const bx = cx + Math.cos(spin + 2) * 5, by = cy + Math.sin(spin + 2) * 4.6;
  S.fill(Math.round(bx - 1), Math.round(by - 1), 3, 2, M.BOOT);
  const kx = cx + Math.cos(spin + 1.2) * 3, ky = cy + Math.sin(spin + 1.2) * 3;
  S.fill(Math.round(kx - 1), Math.round(ky - 1), 2, 2, M.GLOVE);
  // el arma recogida asoma
  if (L.item === 'staff') capsule(S, cx + Math.cos(spin + 0.8) * 7, cy + Math.sin(spin + 0.8) * 7, cx - Math.cos(spin + 0.8) * 7, cy - Math.sin(spin + 0.8) * 7, 1.4, M.WOOD);
  else if (L.item === 'sword') capsule(S, cx + Math.cos(spin + 2.6) * 4, cy + Math.sin(spin + 2.6) * 4, cx + Math.cos(spin + 2.6) * 8, cy + Math.sin(spin + 2.6) * 8, 1.4, M.BLADE);
  return { S, tipX: cx, tipY: cy, hand: [cx, cy] };
}

/** Sombra cálida/fría a mano para quien componga encima. */
export function figPalette(L: FigLook): Ramp[] { return palOf(L); }
