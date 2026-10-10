// ============================================================
// ECOS DE AELTHAR — EL PORTADOR v5 (R19)
//
// Rehecho sobre la MARIONETA (puppet.ts): figura articulada de ~30 px en un
// lienzo 32×38, sombreada con la luz v2 (normales desde la silueta, 5 tonos
// por material, sombra de contacto, contorno selectivo y contraluz frío).
//
//  · EQUIPO VISIBLE (igual que v4, ahora con más piezas): túnica → chaleco
//    de cuero y brazales → malla con tabardo → placas con hombreras, grebas
//    y guanteletes → Manto de Ecos (capucha y capa largas con runas) →
//    Guarda del Primer Canto (blanco y oro). La hoja cambia de metal y crece
//    con la forja; el cristal del báculo crece y cambia de color.
//  · ANIMACIONES más suaves: reposo 5 (respira, pelo y capa se mecen,
//    parpadeo), andar 8, correr 8 (inclinado, brazos flexionados, capa al
//    viento), ataque 5 (preparación · arranque · TAJO con estela · remate ·
//    recuperación), lanzar 5 (reunir · tensar · LANZAR · sostener · soltar),
//    carga 2, voltereta 6 y herido 2.
//  · Las poses se calculan con funciones continuas (seno de la fase): el
//    pelo, la capa y el bajo de la tela van con retraso → movimiento fluido.
//
// API intacta respecto a v4 (render.ts, cinematic.ts y el creador la usan):
// heroFrame(look, dir, act, f) → { cv, tipX, tipY, glow }, caché perezosa.
// ============================================================

import { sculptFigure, sculptRoll, renderFigure, walkPose, idlePose, FIG_W, FIG_H, REST_POSE, type FigLook, type Pose, type FigDir } from './puppet';

export type HeroDir = 'down' | 'up' | 'side';
export type HeroAct = 'idle' | 'walk' | 'run' | 'atk' | 'cast' | 'roll' | 'hurt' | 'charge';
export interface HeroLook { disc: 'alba' | 'tejedor'; armor: number; weapon: number }
export interface HeroFrame { cv: HTMLCanvasElement; tipX: number; tipY: number; glow: string | null }

export const HERO_W = FIG_W;
export const HERO_H = FIG_H;
/** Fotogramas por acción. idle: 0-3 respiración, 4 parpadeo. */
export const HERO_FRAMES: Readonly<Record<HeroAct, number>> = { idle: 5, walk: 8, run: 8, atk: 5, cast: 5, roll: 6, hurt: 2, charge: 2 };

const BLADES = ['#a9b1bd', '#c3ccd8', '#d2dae6', '#a8d6ff', '#ffe08a', '#fff4d6'];
const CRYSTALS = ['#4fb0c4', '#62cade', '#78e4f0', '#b98cff', '#ffd76a', '#f4fbff'];

// ---------------------------------------------------------------- aspecto
function figLook(look: HeroLook): FigLook {
  const a = Math.max(0, Math.min(5, look.armor | 0));
  const w = Math.max(0, Math.min(5, look.weapon | 0));
  const capeC = a >= 5 ? '#f2eee2' : a >= 4 ? '#2c6a7a' : null;
  if (look.disc === 'alba') {
    return {
      build: 'normal', skin: '#f0c8a0', hair: '#7a3424', eyes: '#3a5a9a', hairStyle: 'short',
      head: 'hood', headC: a >= 5 ? '#f2eee2' : a >= 4 ? '#2c6a7a' : '#c23448',
      top: '#d6dbe6', sleeves: '#c4cad8', legs: '#56607a', boots: '#6a4426', belt: '#5a3a24',
      outfit: 'tunic',
      cape: capeC ?? '#b8304a', capeLong: a >= 4, lining: a >= 5 ? '#e8c04a' : a >= 4 ? '#d8c890' : '#e8b0a0',
      trim: '#e8c04a', armor: a, metal: a >= 5 ? '#e6e0cc' : '#a6b2c4', tabard: a >= 5 ? '#f4f0e6' : '#c23448',
      item: 'sword', blade: BLADES[w], bladeLen: [6, 6, 7, 7, 8, 9][w],
      shield: true, shieldC: a >= 5 ? '#e6e0cc' : a >= 3 ? '#8e9cb0' : '#8a5a30',
      runes: a === 4 ? '#8af0ff' : null,
    };
  }
  return {
    build: 'normal', skin: '#f2cca8', hair: '#c4b0ee', eyes: '#2fd6c0', glowEyes: true, hairStyle: 'long',
    head: a >= 4 ? 'hood' : 'circlet', headC: a >= 5 ? '#f2eee2' : '#2c6a7a',
    top: '#7c56b8', sleeves: '#6a48a0', legs: '#46386a', boots: '#4a3048', belt: '#3a2a50',
    outfit: 'robe', cape: capeC, capeLong: true, lining: a >= 5 ? '#e8c04a' : '#d8c890',
    trim: '#e8c04a', armor: a === 3 ? 1 : a === 2 ? 2 : a === 1 ? 1 : a, metal: a >= 5 ? '#e6e0cc' : '#a6b2c4', tabard: '#e8c04a',
    item: 'staff', gem: CRYSTALS[w], crystal: w >= 4 ? 2 : w >= 2 ? 1 : 0, itemC: w >= 4 ? '#c8ccd8' : '#6e4c2c',
    runes: a === 4 ? '#8af0ff' : null,
  };
}
function glowOf(look: HeroLook): string | null {
  const w = Math.max(0, Math.min(5, look.weapon | 0));
  return look.disc === 'alba' ? (w >= 3 ? BLADES[w] : null) : (w >= 2 ? CRYSTALS[w] : null);
}

// ---------------------------------------------------------------- poses
const dirV = (a: number): [number, number] => [Math.cos(a), Math.sin(a)];

/** Ataque con espada: 5 fases con estela. `side` = perfil a la derecha. */
function atkPose(f: number, dir: FigDir): Pose {
  const p: Pose = { ...REST_POSE };
  p.elbow = [10, 14];
  if (dir === 'side') {
    const P = [
      { hand: [-3, -6], a: -2.3, smear: null, lean: -1, leg: [-18, 16], cape: 0.4 },
      { hand: [1, -6], a: -1.25, smear: [-2.5, -1.25], lean: 0, leg: [-20, 20], cape: 1 },
      { hand: [6, 1], a: 0.2, smear: [-1.5, 0.2], lean: 2, leg: [-26, 30], cape: 2.4 },
      { hand: [4, 5], a: 1.05, smear: [-0.1, 1.05], lean: 1, leg: [-22, 26], cape: 2 },
      { hand: [2, 6], a: 1.25, smear: null, lean: 1, leg: [-12, 14], cape: 1.2 },
    ][f];
    p.hand = P.hand as [number, number]; p.wv = dirV(P.a); p.smear = P.smear as [number, number] | null;
    p.lean = P.lean; p.leg = P.leg as [number, number]; p.knee = [6, 10]; p.cape = P.cape;
    p.arm = [0, -14]; p.hair = P.cape * 0.6;
    return p;
  }
  // de frente: la mano del arma está a la IZQUIERDA de la pantalla; de espaldas, a la derecha
  const m = dir === 'up' ? -1 : 1;           // espejo horizontal
  const P = [
    { hand: [-2, -7], a: -2.1, smear: null, bob: 0 },
    { hand: [1, -6], a: -1.0, smear: [-2.3, -1.0], bob: 0 },
    { hand: [6, 1], a: 0.65, smear: [-1.1, 0.65], bob: 1 },
    { hand: [7, 4], a: 1.35, smear: [0.3, 1.35], bob: 1 },
    { hand: [3, 4], a: 1.6, smear: null, bob: 0 },
  ][f];
  const h = P.hand as [number, number];
  p.hand = [h[0] * m, h[1]];
  const v = dirV(P.a);
  p.wv = [v[0] * m, v[1]];
  if (P.smear) {
    const [s0, s1] = P.smear as [number, number];
    p.smear = m > 0 ? [s0, s1] : [Math.PI - s0, Math.PI - s1];
  }
  p.bob = P.bob; p.lift = f === 2 ? [0, 1] : [0, 0]; p.hair = f >= 2 ? 0.6 : 0; p.cape = f >= 2 ? 1 : 0.3;
  return p;
}

/** Lanzar con báculo: reunir · tensar · LANZAR · sostener · soltar. */
function castPose(f: number, dir: FigDir): Pose {
  const p: Pose = { ...REST_POSE };
  p.elbow = [12, 14];
  if (dir === 'side') {
    const P = [
      { hand: [1, -7], v: [0.05, -1], glow: 0.6, lean: -1 },
      { hand: [-2, -4], v: [-0.3, -1], glow: 0.8, lean: -1 },
      { hand: [6, -2], v: [1, -0.3], glow: 1, lean: 2 },
      { hand: [6, -1], v: [1, -0.15], glow: 0.7, lean: 1 },
      { hand: [3, 2], v: [0.2, -1], glow: 0.25, lean: 0 },
    ][f];
    p.hand = P.hand as [number, number]; p.wv = P.v as [number, number]; p.glow = P.glow; p.lean = P.lean;
    p.leg = f === 2 || f === 3 ? [-18, 20] : [-8, 8]; p.knee = [6, 8];
    p.hair = f >= 2 ? 1.6 : 0.4; p.cape = f >= 2 ? 2 : 0.6; p.arm = [0, -20];
    return p;
  }
  const m = dir === 'up' ? -1 : 1;
  const P = [
    { hand: [-1, -7], v: [0, -1], glow: 0.6, bob: -1 },
    { hand: [-3, -4], v: [-0.25, -1], glow: 0.8, bob: 0 },
    { hand: [2, -3], v: [0.35, -1], glow: 1, bob: 0 },
    { hand: [2, -2], v: [0.25, -1], glow: 0.7, bob: 0 },
    { hand: [0, 1], v: [0, -1], glow: 0.25, bob: 0 },
  ][f];
  const h = P.hand as [number, number];
  p.hand = [h[0] * m, h[1]];
  const v = P.v as [number, number];
  p.wv = [v[0] * m, v[1]];
  p.glow = P.glow; p.bob = P.bob; p.hair = f >= 2 ? 0.8 : 0; p.cape = f >= 2 ? 1 : 0.3;
  return p;
}

function hurtPose(f: number, dir: FigDir): Pose {
  const p: Pose = { ...REST_POSE };
  p.hurt = true; p.blink = true;
  p.lean = dir === 'side' ? (f === 0 ? -2 : -1) : 0;
  p.bob = f === 0 ? 1 : 0;
  p.arm = [-30, -40]; p.elbow = [40, 40];
  p.hair = -1; p.cape = -0.5; p.hem = 1;
  if (dir === 'side') { p.leg = [-10, 6]; p.knee = [10, 14]; }
  return p;
}

function chargePose(f: number, dir: FigDir, staff: boolean): Pose {
  const p = staff ? castPose(0, dir) : atkPose(0, dir);
  p.smear = null;
  if (f === 1) { p.bob += 1; p.glow = Math.min(1, p.glow + 0.3); }
  return p;
}

// ---------------------------------------------------------------- API
const cache = new Map<string, HeroFrame>();
function keyOf(look: HeroLook, dir: HeroDir, act: HeroAct, f: number): string {
  return `${look.disc}|${look.armor}|${look.weapon}|${dir}|${act}|${f}`;
}

/** Fotograma del Portador (perezoso + caché). `f` se recorta al nº de fases de la acción. */
export function heroFrame(look: HeroLook, dir: HeroDir, act: HeroAct, f: number): HeroFrame {
  const n = HERO_FRAMES[act];
  const fi = ((Math.floor(f) % n) + n) % n;
  const k = keyOf(look, dir, act, fi);
  const hit = cache.get(k);
  if (hit) return hit;
  const L = figLook(look);
  const staff = look.disc === 'tejedor';
  let fo;
  if (act === 'roll') fo = sculptRoll(L, fi, n, dir);
  else {
    let p: Pose;
    switch (act) {
      case 'walk': p = walkPose(fi, n, false, dir); break;
      case 'run': p = walkPose(fi, n, true, dir); break;
      case 'atk': p = staff ? castPose(fi, dir) : atkPose(fi, dir); break;
      case 'cast': p = staff ? castPose(fi, dir) : atkPose(fi, dir); break;
      case 'hurt': p = hurtPose(fi, dir); break;
      case 'charge': p = chargePose(fi, dir, staff); break;
      default: p = idlePose(fi);
    }
    fo = sculptFigure(L, dir, p);
  }
  const fr: HeroFrame = { cv: renderFigure(fo, L, '#a8c4ff'), tipX: fo.tipX, tipY: fo.tipY, glow: glowOf(look) };
  if (cache.size > 1400) cache.clear();
  cache.set(k, fr);
  return fr;
}

/** Vacía la caché (cambio de equipo masivo / pruebas). */
export function resetHeroCache(): void { cache.clear(); }
export function heroCacheSize(): number { return cache.size; }
/** Aspecto de figura del Portador (lo usan el retrato v2 y las cinemáticas). */
export function heroFigLook(look: HeroLook): FigLook { return figLook(look); }
