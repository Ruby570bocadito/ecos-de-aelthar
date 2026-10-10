// ============================================================
// ECOS DE AELTHAR — RETRATOS v2 (R19)
//
// Busto de 44×62 (mismo lienzo que los retratos clásicos, así encaja en el
// HUD y en el diálogo sin tocar sus marcos) pintado por MATERIALES y
// sombreado con la luz v2: cara de 22 px con ojos de 4×3 (blanco, iris,
// pupila y brillo), pestañas, cejas, nariz con aleta, labios, orejas,
// mechones de pelo, tocado y hombros con la ropa o la armadura del
// personaje. Se construye a partir del MISMO aspecto que su sprite
// (FigLook de npc2.ts / hero.ts), así el retrato y el muñeco coinciden.
//
// El del Portador refleja el equipo actual (render.ts llama a
// setPortraitHeroLook cada fotograma; la caché solo se rehace al cambiar).
// ============================================================

import { Sculpt, ramp, mixC, mulC, type Ramp } from './sculpt';
import type { FigLook } from './puppet';

export const PW = 44, PH = 62;

const SKIN = 1, HAIR = 2, CLOTH = 3, SLEEVE = 4, METAL = 5, TRIM = 6, CAPE = 7, HOOD = 8, LEATHER = 9,
  CHAIN = 10, GEM = 11, BEARD = 12, HAT = 13, APRON = 14, TABARD = 15, LIP = 16, EAR = 17, DARK = 18;

function pal(L: FigLook): Ramp[] {
  const p: Ramp[] = [];
  p[SKIN] = { ...ramp(L.skin, { hiK: 1.07, shK: 0.84 }), soft: true };
  p[EAR] = { ...ramp(mixC(L.skin, '#e88a7a', 0.12), { hiK: 1.05, shK: 0.8 }), soft: true };
  p[HAIR] = ramp(L.hair);
  p[CLOTH] = ramp(L.top);
  p[SLEEVE] = ramp(L.sleeves ?? L.top);
  p[METAL] = ramp(L.metal ?? '#a6b2c4', { hard: true });
  p[TRIM] = ramp(L.trim ?? '#e8c04a', { hard: true });
  p[CAPE] = ramp(L.cape ?? L.top);
  p[HOOD] = ramp(L.headC ?? L.cape ?? '#c23448');
  p[LEATHER] = ramp('#7a4a26');
  p[CHAIN] = ramp('#9aa6b6', { hard: true });
  p[GEM] = { hi: '#ffffff', base: L.gem ?? '#62cade', sh: mulC(L.gem ?? '#62cade', 0.7), out: mulC(L.gem ?? '#62cade', 0.35), hard: true };
  p[BEARD] = ramp(L.beardC ?? L.hair);
  p[HAT] = ramp(L.headC ?? '#6a5a48');
  p[APRON] = ramp(L.apron ?? '#d8d0bc');
  p[TABARD] = ramp(L.tabard ?? '#c23448');
  p[LIP] = ramp(mixC(L.skin, '#c05a5a', 0.38), { hiK: 1.1, shK: 0.8 });
  p[DARK] = { hi: '#1a1220', base: '#1a1220', sh: '#1a1220', out: '#0c0810', flat: true };
  return p;
}

const span = (S: Sculpt, y: number, x0: number, x1: number, m: number) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) S.set(x, y, m); };

/** Pinta el busto. `blink` cierra los ojos. */
export function buildPortrait(L: FigLook, blink: boolean): HTMLCanvasElement {
  const S = new Sculpt(PW, PH);
  const cx = 22;
  const a = L.armor ?? 0;
  const old = L.build === 'old', child = L.build === 'child', stout = L.build === 'stout' || L.build === 'dwarf';
  const headTop = child ? 15 : 11, chin = child ? 40 : 40;
  const faceHalf = (y: number) => {
    // contorno de la cara: frente ancha, pómulos y mandíbula redondeada
    const t = (y - headTop) / (chin - headTop);
    const w = 11 + (stout ? 0.8 : 0) + (child ? 0.5 : 0);
    if (t < 0.14) return 7 + t * 28.5;          // coronilla
    if (t < 0.56) return w;
    const k = (t - 0.56) / 0.5;
    return Math.max(5, w * Math.sqrt(Math.max(0, 1 - k * k)));
  };
  // ---- melena larga por detrás ----
  if (L.hairStyle === 'long' || L.hairStyle === 'wild' || L.hairStyle === 'braid') {
    for (let y = headTop + 6; y <= PH - 6; y++) {
      const half = 13 + Math.min(3, (y - headTop) * 0.08);
      span(S, y, cx - half, cx - 7, HAIR); span(S, y, cx + 6, cx + half - 1, HAIR);
    }
  }
  // ---- capa / esclavina detrás de los hombros ----
  if (L.cape || L.head === 'hood') {
    const m = L.head === 'hood' ? HOOD : CAPE;
    for (let y = 44; y < PH; y++) span(S, y, cx - 21, cx + 20, m);
  }
  // ---- hombros y torso ----
  const shTop = child ? 50 : 47;
  for (let y = shTop; y < PH; y++) {
    const k = (y - shTop) / (PH - shTop);
    const half = (stout ? 20 : 17) + k * 3;
    span(S, y, cx - half, cx + half - 1, CLOTH);
  }
  // cuello
  for (let y = chin - 2; y <= shTop + 2; y++) span(S, y, cx - 5, cx + 4, SKIN);
  // escote / cuello de la prenda
  for (let y = shTop; y <= shTop + 2; y++) { const w = 4 - (y - shTop) * 1.2; if (w > 0) span(S, y, cx - w, cx + w - 1, SKIN); }
  span(S, shTop, cx - 6, cx - 4, TRIM); span(S, shTop, cx + 3, cx + 5, TRIM);
  // prendas y armaduras
  if (L.outfit === 'apron') for (let y = shTop + 4; y < PH; y++) span(S, y, cx - 7, cx + 6, APRON);
  if (L.outfit === 'coat') for (let y = shTop + 2; y < PH; y++) { S.set(cx - 1, y, SLEEVE); S.set(cx, y, SLEEVE); }
  if (a === 1) { for (let y = shTop + 3; y < PH; y++) { span(S, y, cx - 12, cx - 5, LEATHER); span(S, y, cx + 4, cx + 11, LEATHER); } }
  if (a === 2 || a === 4) { for (let y = shTop + 1; y < PH; y++) { span(S, y, cx - 16, cx - 5, CHAIN); span(S, y, cx + 4, cx + 15, CHAIN); } }
  if (a === 2) for (let y = shTop + 5; y < PH; y++) span(S, y, cx - 4, cx + 3, TABARD);
  if (a === 3 || a === 5) {
    for (let y = shTop + 3; y < PH; y++) span(S, y, cx - 11, cx + 10, METAL);
    S.ellipse(cx - 16, shTop + 4, 6, 4.5, METAL); S.ellipse(cx + 15, shTop + 4, 6, 4.5, METAL);
    span(S, shTop + 6, cx - 21, cx - 11, TRIM); span(S, shTop + 6, cx + 10, cx + 20, TRIM);
    if (a === 5) { span(S, shTop + 9, cx - 9, cx + 8, TRIM); S.set(cx - 1, shTop + 11, GEM); S.set(cx, shTop + 11, GEM); }
    else { S.set(cx - 1, shTop + 8, TRIM); S.set(cx, shTop + 8, TRIM); }
  }
  if (L.emblem) { S.dot(cx - 9, shTop + 6, L.emblem); S.dot(cx - 8, shTop + 6, mixC(L.emblem, '#ffffff', 0.4)); }
  // ---- cabeza ----
  for (let y = headTop; y <= chin; y++) { const h = faceHalf(y); span(S, y, cx - h, cx + h - 1, SKIN); }
  // orejas
  const earY = headTop + Math.round((chin - headTop) * 0.5);
  if (L.pointyEars) {
    for (let k = 0; k < 6; k++) { span(S, earY - k, cx - 12 - k, cx - 11, EAR); span(S, earY - k, cx + 10, cx + 11 + k, EAR); }
  } else {
    S.ellipse(cx - 11.5, earY, 1.6, 2.6, EAR); S.ellipse(cx + 10.5, earY, 1.6, 2.6, EAR);
  }
  // ---- pelo ----
  const hs = L.hairStyle;
  if (hs !== 'bald') {
    // casquete
    for (let y = headTop - 2; y <= headTop + 7; y++) {
      const h = y < headTop ? 6 + (y - headTop + 2) * 2.5 : faceHalf(y) + 1;
      span(S, y, cx - h, cx + h - 1, HAIR);
    }
    // flequillo en mechones (dientes de sierra irregulares)
    const fringe = [3, 5, 4, 6, 3, 5, 6, 4, 3, 5, 4, 6, 5, 3, 4, 5, 6, 4, 3, 5, 4, 3];
    for (let i = 0; i < 22; i++) {
      const x = cx - 11 + i;
      const len = fringe[i] + (hs === 'spiky' ? -1 : 0) + (hs === 'bob' ? 1 : 0);
      for (let k = 0; k < len; k++) S.set(x, headTop + 6 + k, HAIR);
    }
    // laterales
    const sideLen = hs === 'short' || hs === 'spiky' ? 8 : hs === 'wild' ? 12 : hs === 'bob' ? 18 : hs === 'bun' || hs === 'pony' ? 10 : 24;
    for (let y = headTop + 6; y < headTop + 6 + sideLen && y < PH; y++) {
      const w = y < chin ? 2.5 : 4;
      span(S, y, cx - faceHalf(Math.min(y, chin)) - 1.5, cx - faceHalf(Math.min(y, chin)) - 1.5 + w, HAIR);
      span(S, y, cx + faceHalf(Math.min(y, chin)) - w + 0.5, cx + faceHalf(Math.min(y, chin)) + 0.5, HAIR);
    }
    if (hs === 'spiky' || hs === 'wild') {
      // mechones revueltos: bultos irregulares sobre el casquete
      const tufts = [[-9, 0, 3, 2.4], [-4, -2, 3.4, 2.6], [2, -2, 3.2, 2.4], [7, 0, 3, 2.2], [-12, 4, 2, 2.4], [11, 4, 2, 2.4]];
      for (const [dx, dy, rx, ry] of tufts) S.ellipse(cx + dx, headTop + dy, rx, ry, HAIR);
    }
    if (hs === 'bun') S.ellipse(cx, headTop - 4, 5, 3.6, HAIR);
    if (hs === 'braid') for (let y = chin - 4; y < PH - 2; y += 3) S.ellipse(cx + 13, y, 2.2, 1.8, HAIR);
    if (hs === 'pony') { S.ellipse(cx + 12, headTop + 6, 3, 2.4, HAIR); }
  } else {
    span(S, earY - 4, cx - 12, cx - 10, HAIR); span(S, earY - 4, cx + 9, cx + 11, HAIR);
  }
  // ---- rasgos ----
  const eyeY = headTop + Math.round((chin - headTop) * 0.5) - 1;
  const lash = mixC(mulC(L.hair === '#ecece4' || L.hair === '#e8e8e8' ? '#5a5a60' : L.hair, 0.4), '#120a18', 0.5);
  const brow = mixC(mulC(L.hair, 0.72), '#201018', 0.2);
  const eye = (ex: number, flip: boolean) => {
    // ceja: arco de 5 px, más alta en el centro
    for (let i = 0; i < 5; i++) S.dot(ex + i - (flip ? 0 : 1), eyeY - 3 - (i === 1 || i === 2 ? 1 : 0), brow);
    if (blink) {
      for (let i = 0; i < 4; i++) S.dot(ex + i, eyeY + 1, lash);
      S.dot(ex + (flip ? 4 : -1), eyeY, lash);
      return;
    }
    // pestaña superior (4 px + rabillo exterior)
    for (let i = 0; i < 4; i++) S.dot(ex + i, eyeY - 1, lash);
    S.dot(ex + (flip ? 4 : -1), eyeY - 1, lash);
    // blanco a los lados, iris 2×2 con brillo arriba-izquierda y pupila
    const ix = ex + 1;
    S.dot(ex, eyeY, '#f2eee8'); S.dot(ex + 3, eyeY, '#f2eee8');
    S.dot(ex, eyeY + 1, '#d8d0cc'); S.dot(ex + 3, eyeY + 1, '#d8d0cc');
    S.dot(ix, eyeY, '#ffffff'); S.dot(ix + 1, eyeY, L.glowEyes ? mixC(L.eyes, '#ffffff', 0.4) : mulC(L.eyes, 0.45));
    S.dot(ix, eyeY + 1, L.eyes); S.dot(ix + 1, eyeY + 1, mulC(L.eyes, 0.78));
    // párpado inferior apenas marcado
    S.dot(ex + 1, eyeY + 2, mixC(L.skin, '#8a5a6a', 0.18)); S.dot(ex + 2, eyeY + 2, mixC(L.skin, '#8a5a6a', 0.18));
    if (old) { S.dot(ex - 1, eyeY + 2, mixC(L.skin, '#6a4a4a', 0.3)); S.dot(ex + 4, eyeY + 2, mixC(L.skin, '#6a4a4a', 0.3)); }
  };
  eye(cx - 8, false);
  eye(cx + 3, true);
  // nariz: puente con luz, aleta en sombra
  const skinSh = mixC(mulC(L.skin, 0.72), '#6a3048', 0.2);
  S.dot(cx - 1, eyeY + 3, mixC(L.skin, '#ffffff', 0.18));
  S.dot(cx, eyeY + 4, skinSh); S.dot(cx, eyeY + 5, skinSh); S.dot(cx - 1, eyeY + 6, skinSh); S.dot(cx + 1, eyeY + 6, mulC(L.skin, 0.8));
  // mejillas / pecas
  if (L.freckles) for (const [x, y] of [[-8, 4], [-6, 5], [-9, 6], [5, 4], [7, 5], [6, 6]] as const) S.dot(cx + x, eyeY + y, mixC(L.skin, '#9a5a3a', 0.45));
  else { for (const dx of [-9, -8, 6, 7]) S.dot(cx + dx, eyeY + 5, mixC(L.skin, '#e86a6a', 0.3)); }
  // boca: comisuras, línea y labio inferior con luz
  const my = eyeY + 8;
  const lipLine = mixC(L.skin, '#7a3040', 0.5), lipLow = mixC(L.skin, '#d06a6a', 0.35);
  S.dot(cx - 3, my - 1, mixC(L.skin, '#7a3040', 0.25)); S.dot(cx + 2, my - 1, mixC(L.skin, '#7a3040', 0.25));
  for (let i = -2; i <= 1; i++) S.dot(cx + i, my, lipLine);
  S.dot(cx - 1, my + 1, lipLow); S.dot(cx, my + 1, lipLow);
  if (old) { S.dot(cx - 5, my - 1, skinSh); S.dot(cx + 4, my - 1, skinSh); }
  // barba / bigote
  if (L.beard && L.beard !== 'none') {
    span(S, my - 1, cx - 5, cx + 4, BEARD);
    S.set(cx - 6, my, BEARD); S.set(cx + 5, my, BEARD);
    if (L.beard !== 'mustache') {
      const bottom = L.beard === 'long' ? PH - 6 : chin + 3;
      for (let y = my + 1; y <= bottom; y++) {
        const t = (y - my) / Math.max(1, bottom - my);
        const h = y <= chin ? faceHalf(y) + 0.5 : Math.max(2, 9 * (1 - t) + 2);
        span(S, y, cx - h, cx + h - 1, BEARD);
      }
      S.dot(cx - 1, my + 1, lipLow); S.dot(cx, my + 1, lipLow);   // labio inferior asoma
    }
  }
  // ---- tocados ----
  switch (L.head) {
    case 'hood': {
      for (let y = headTop - 5; y <= PH - 14; y++) {
        const t = (y - (headTop - 5)) / (PH - 14 - (headTop - 5));
        const outer = t < 0.25 ? 9 + t * 40 : 19 - Math.max(0, t - 0.7) * 6;
        const inner = y < headTop + 6 ? -1 : faceHalf(Math.min(y, chin)) + 0.5;
        if (inner < 0) span(S, y, cx - outer, cx + outer - 1, HOOD);
        else { span(S, y, cx - outer, cx - inner - 1, HOOD); span(S, y, cx + inner, cx + outer - 1, HOOD); }
      }
      // pliegues de la capucha
      for (let y = headTop - 2; y < headTop + 4; y++) S.dot(cx - 4 + ((y * 3) % 7), y, mulC(L.headC ?? '#c23448', 0.8));
      break;
    }
    case 'circlet':
      span(S, headTop + 4, cx - 11, cx + 10, TRIM);
      S.ellipse(cx - 0.5, headTop + 4, 1.8, 2.2, GEM);
      break;
    case 'crown':
      span(S, headTop + 1, cx - 9, cx + 8, TRIM); span(S, headTop + 2, cx - 9, cx + 8, TRIM);
      for (let i = 0; i < 5; i++) S.tri(cx - 9 + i * 4, headTop + 1, cx - 7 + i * 4, headTop - 4, cx - 5 + i * 4, headTop + 1, TRIM);
      S.set(cx - 1, headTop + 1, GEM); S.set(cx, headTop + 1, GEM);
      break;
    case 'helm':
      for (let y = headTop - 3; y <= eyeY + 6; y++) { const h = (y < headTop ? 8 : faceHalf(y) + 1.5); span(S, y, cx - h, cx + h - 1, METAL); }
      span(S, eyeY, cx - 9, cx + 8, DARK); span(S, eyeY + 1, cx - 8, cx + 7, DARK);
      for (let y = eyeY + 2; y <= eyeY + 6; y++) { S.set(cx - 1, y, TRIM); }
      break;
    case 'widehat':
      for (let y = headTop - 7; y <= headTop + 2; y++) span(S, y, cx - 9 + Math.max(0, headTop - 3 - y), cx + 8 - Math.max(0, headTop - 3 - y), HAT);
      span(S, headTop + 3, cx - 21, cx + 20, HAT); span(S, headTop + 4, cx - 19, cx + 18, HAT);
      span(S, headTop + 1, cx - 9, cx + 8, TRIM);
      break;
    case 'cap':
      for (let y = headTop - 4; y <= headTop + 4; y++) span(S, y, cx - 11 + Math.max(0, headTop - 2 - y), cx + 10 - Math.max(0, headTop - 2 - y), HAT);
      span(S, headTop + 5, cx - 13, cx + 6, HAT);
      break;
    case 'scarf': case 'bandana':
      for (let y = headTop - 3; y <= headTop + 6; y++) span(S, y, cx - faceHalf(Math.max(headTop, y)) - 1.5, cx + faceHalf(Math.max(headTop, y)) + 0.5, HAT);
      if (L.head === 'scarf') for (let y = headTop + 7; y <= chin + 3; y++) { span(S, y, cx - faceHalf(Math.min(y, chin)) - 3, cx - faceHalf(Math.min(y, chin)) - 0.5, HAT); span(S, y, cx + faceHalf(Math.min(y, chin)) - 0.5, cx + faceHalf(Math.min(y, chin)) + 2, HAT); }
      else { S.tri(cx + 10, headTop + 1, cx + 17, headTop - 2, cx + 15, headTop + 5, HAT); }
      break;
    case 'veil':
      for (let y = headTop - 4; y < PH - 4; y++) {
        const outer = y < headTop ? 9 + (y - headTop + 4) * 1.5 : 15;
        const inner = y < headTop + 4 ? -1 : faceHalf(Math.min(y, chin)) + 0.5;
        if (inner < 0) span(S, y, cx - outer, cx + outer - 1, HOOD);
        else { span(S, y, cx - outer, cx - inner - 1, HOOD); span(S, y, cx + inner, cx + outer - 1, HOOD); }
      }
      break;
    default: break;
  }
  return S.render2(pal(L), { rim: L.glowEyes ? '#b8a0ff' : '#a8c4ff', rimK: 0.2, bulge: 7 });
}

// ---------------------------------------------------------------- caché
const cache = new Map<string, HTMLCanvasElement>();
export function portraitFor(key: string, L: FigLook, blink: boolean): HTMLCanvasElement {
  const k = `${key}|${blink ? 1 : 0}`;
  let c = cache.get(k);
  if (!c) {
    c = buildPortrait(L, blink);
    if (cache.size > 80) cache.clear();
    cache.set(k, c);
  }
  return c;
}

// ---------------------------------------------------------------- Portador
let heroKey = '';
let heroLookCur: FigLook | null = null;
/** render.ts informa del aspecto actual del Portador (equipo) — barato si no cambia. */
export function setPortraitHeroLook(key: string, L: FigLook): void {
  if (key === heroKey) return;
  heroKey = key; heroLookCur = L;
}
export function portraitHero(disc: string, blink: boolean): HTMLCanvasElement | null {
  if (!heroLookCur || !heroKey.startsWith(disc)) return null;
  return portraitFor('hero:' + heroKey, heroLookCur, blink);
}
