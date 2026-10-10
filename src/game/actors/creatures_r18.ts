// ============================================================
// ECOS DE AELTHAR — CRIATURAS DE LAS SECCIONES NUEVAS (R18)
// Esculpidas con sculpt.ts (materiales + volumen + contorno selectivo).
// Todas miran a la DERECHA; render.ts voltea para la izquierda.
//
//  enemigos     cuervo (18×14) · arana (22×14) · cangrejo (22×16) · fatuo (14×18)
//  mini-jefes   reina_cuervo (42×34) · ciervo (42×38) · rey_cangrejo (46×32)
//               viuda (30×40) · wendigo (38×42)
// Índices de fotograma: ver *_FRAMES (los consume enemies_r18.frameFor).
// ============================================================

import { Sculpt, ramp, type Ramp } from './sculpt';
import type { Frames } from './util';

// ---------------------------------------------------------------- paletas
const P = (cols: Record<number, string | Ramp>): Ramp[] => {
  const out: Ramp[] = [];
  for (const [k, v] of Object.entries(cols)) out[Number(k)] = typeof v === 'string' ? ramp(v) : v;
  return out;
};

// ================================================================ CUERVO
// 0-1 aleteo · 2 picado · 3 posado
export const CUERVO_FRAMES = { fly: [0, 1], dive: 2, perch: 3 } as const;
function cuervo(f: number): HTMLCanvasElement {
  const S = new Sculpt(18, 14);
  const BODY = 1, WING = 2, BEAK = 3, EYE = 4, FOOT = 5;
  const pal = P({ [BODY]: '#2c2a3c', [WING]: '#3a3650', [BEAK]: ramp('#c8a040', { hard: true }), [EYE]: ramp('#ff5a4a', { flat: true }), [FOOT]: '#8a6a3a' });
  if (f === 3) {
    S.ellipse(9, 8, 4, 3, BODY); S.ellipse(13, 5, 2.4, 2.2, BODY);
    S.tri(15, 4, 17, 5, 15, 6, BEAK); S.tri(5, 7, 1, 6, 5, 10, WING);
    S.line(8, 11, 8, 13, FOOT); S.line(10, 11, 10, 13, FOOT);
    S.set(14, 4, EYE);
    return S.render(pal);
  }
  const dive = f === 2;
  S.ellipse(9, 7, dive ? 5 : 4, dive ? 2 : 2.6, BODY);
  S.ellipse(14, dive ? 7 : 6, 2.2, 2, BODY);
  S.tri(16, dive ? 6 : 5, 18, dive ? 7 : 6, 16, dive ? 8 : 7, BEAK);
  S.tri(4, 7, 0, dive ? 6 : 5, 4, 9, BODY);                 // cola
  if (dive) S.tri(6, 6, 12, 5, 8, 9, WING);
  else if (f === 0) { S.tri(6, 6, 12, 6, 7, 0, WING); S.tri(8, 6, 13, 6, 12, 1, WING); }
  else { S.tri(6, 7, 12, 7, 5, 13, WING); S.tri(8, 7, 13, 7, 13, 12, WING); }
  S.set(15, dive ? 6 : 5, EYE);
  return S.render(pal);
}

// ================================================================ REINA DE LOS CUERVOS
// 0-1 aleteo · 2 graznido (alas abiertas) · 3 picado · 4 aturdida
export const REINA_FRAMES = { fly: [0, 1], screech: 2, dive: 3, stun: 4 } as const;
function reina(f: number): HTMLCanvasElement {
  const S = new Sculpt(42, 34);
  const BODY = 1, WING = 2, BEAK = 3, EYE = 4, CROWN = 5, FEATH = 6, FOOT = 7, BELLY = 8;
  const pal = P({
    [BODY]: '#2a2638', [WING]: '#34304c', [BEAK]: ramp('#d8b04a', { hard: true }), [EYE]: ramp('#ff6a4a', { flat: true }),
    [CROWN]: ramp('#e8c04a', { hard: true }), [FEATH]: '#4a4468', [FOOT]: '#9a7a40', [BELLY]: '#4a3e5a',
  });
  const stun = f === 4, dive = f === 3, scr = f === 2;
  const by = stun ? 24 : 16;
  // alas
  if (scr) {
    S.tri(14, by - 2, 2, by - 14, 6, by + 6, WING); S.tri(26, by - 2, 40, by - 14, 36, by + 6, WING);
    for (let i = 0; i < 4; i++) { S.line(4 + i * 2, by - 10 + i * 4, 12, by, FEATH); S.line(38 - i * 2, by - 10 + i * 4, 30, by, FEATH); }
  } else if (dive) {
    S.tri(12, by - 2, 34, by - 6, 18, by + 4, WING);
  } else if (stun) {
    S.tri(10, by, 2, by + 6, 14, by + 6, WING); S.tri(30, by, 40, by + 6, 28, by + 6, WING);
  } else if (f === 0) {
    S.tri(12, by - 2, 4, by - 16, 22, by - 3, WING); S.tri(20, by - 2, 34, by - 16, 30, by - 1, WING);
  } else {
    S.tri(12, by, 2, by + 10, 20, by + 2, WING); S.tri(22, by, 38, by + 10, 30, by + 2, WING);
  }
  // cuerpo, panza y cola
  S.ellipse(21, by, dive ? 9 : 8, dive ? 4 : 6, BODY);
  S.ellipse(22, by + 2, 5, 3, BELLY);
  S.tri(13, by + 1, 4, by + 7, 12, by + 6, FEATH);
  // cabeza con corona de plumas
  const hx = dive ? 31 : 28, hy = by - (dive ? 1 : 6);
  S.ellipse(hx, hy, 4, 3.6, BODY);
  S.tri(hx + 3, hy - 1, hx + 9, hy + (scr ? -1 : 1), hx + 3, hy + 2, BEAK);
  if (scr) S.tri(hx + 3, hy + 1, hx + 8, hy + 4, hx + 3, hy + 3, BEAK);
  for (let i = 0; i < 3; i++) S.tri(hx - 3 + i * 2, hy - 3, hx - 2 + i * 2, hy - 8 - (i === 1 ? 2 : 0), hx - 1 + i * 2, hy - 3, CROWN);
  if (stun) { S.dot(hx + 1, hy - 1, '#ffe86a'); S.dot(hx + 2, hy, '#ffe86a'); }
  else { S.set(hx + 1, hy - 1, EYE); S.set(hx + 2, hy - 1, EYE); }
  if (!dive && !stun) { S.line(19, by + 6, 19, by + 10, FOOT); S.line(23, by + 6, 23, by + 10, FOOT); }
  return S.render(pal);
}

// ================================================================ ARAÑA TEJEDORA
// 0-1 andar · 2 escupe (abdomen alzado) · 3 reposo
export const ARANA_FRAMES = { walk: [0, 1], spit: 2, idle: 3 } as const;
function arana(f: number): HTMLCanvasElement {
  const S = new Sculpt(22, 14);
  const ABD = 1, HEAD = 2, LEG = 3, EYE = 4, MARK = 5;
  const pal = P({ [ABD]: '#3a3048', [HEAD]: '#4a3e5c', [LEG]: '#2a2238', [EYE]: ramp('#9ef0ff', { flat: true }), [MARK]: ramp('#c8b0ff', { flat: true }) });
  const spit = f === 2;
  const leg = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => { S.line(x0, y0, x1, y1, LEG); S.line(x1, y1, x2, y2, LEG); };
  const ph = f === 1 ? 1 : 0;
  for (let i = 0; i < 4; i++) {
    const bx = 9 + i * 2, up = (i + ph) % 2;
    leg(bx, 8, bx - 3 + i, 4 + up, bx - 5 + i * 2, 12);
    leg(bx + 1, 8, bx + 3 + i, 4 + (1 - up), bx + 4 + i * 2, 12);
  }
  S.ellipse(spit ? 7 : 6, spit ? 5 : 7, 5, 4, ABD);
  S.ellipse(13, 8, 3.2, 2.6, HEAD);
  S.dot(spit ? 6 : 5, spit ? 4 : 6, '#c8b0ff'); S.dot(spit ? 8 : 7, spit ? 5 : 7, '#c8b0ff');
  S.set(15, 7, EYE); S.set(15, 9, EYE); S.set(14, 8, EYE);
  if (spit) S.dot(17, 8, '#e8f0ff');
  void MARK;
  return S.render(pal);
}

// ================================================================ CIERVO DE CENIZA
// 0-1 andar · 2 carga preparada (cabeza baja) · 3 embestida · 4 pisotón (alzado) · 5 aturdido
export const CIERVO_FRAMES = { walk: [0, 1], windup: 2, charge: 3, stomp: 4, stun: 5 } as const;
function ciervo(f: number): HTMLCanvasElement {
  const S = new Sculpt(42, 38);
  const BODY = 1, BELLY = 2, LEG = 3, HOOF = 4, ANT = 5, EYE = 6, EMBER = 7, MANE = 8;
  const pal = P({
    [BODY]: '#6a6460', [BELLY]: '#8a827a', [LEG]: '#544e4a', [HOOF]: '#2a2420',
    [ANT]: ramp('#d8d0c0', { hard: true }), [EYE]: ramp('#ff8a3a', { flat: true }), [EMBER]: ramp('#ffb060', { flat: true }), [MANE]: '#3e3a3a',
  });
  const stomp = f === 4, stun = f === 5, low = f === 2 || f === 3;
  const by = stomp ? 18 : 22, rise = stomp ? -4 : 0;
  // patas
  const lp = f === 1 ? 2 : f === 3 ? 3 : 0;
  if (stun) {
    S.fill(10, 30, 22, 4, LEG);
  } else {
    S.line(12 - lp, by + 4, 11 - lp, 35, LEG, 2); S.line(16 + lp, by + 4, 17 + lp, 35, LEG, 2);
    S.line(26 + lp + rise, by + 4 + rise, 28 + lp, 35 + rise, LEG, 2); S.line(30 - lp + rise, by + 4 + rise, 30 - lp, 35 + rise, LEG, 2);
    for (const hx of [11 - lp, 17 + lp, 28 + lp, 30 - lp]) S.fill(hx - 1, (hx > 20 ? 35 + rise : 35), 3, 2, HOOF);
  }
  // cuerpo
  const cy = stun ? 28 : by;
  S.ellipse(21, cy, 12, 6, BODY);
  S.ellipse(21, cy + 3, 8, 2.5, BELLY);
  S.tri(9, cy - 2, 6, cy - 6, 10, cy + 2, MANE);
  // cuello y cabeza
  const hx = low ? 36 : 33, hy = low ? cy + 1 : cy - 9;
  S.line(30, cy - 3, hx - 2, hy + 1, BODY, 4);
  S.ellipse(hx, hy, 4.2, 3.2, BODY);
  S.tri(hx + 3, hy - 1, hx + 7, hy + 1, hx + 3, hy + 2, BODY);
  // cornamenta de hueso con brasas
  const ax = hx - 1, ay = hy - 3;
  const dir = low ? 1 : 0;
  S.line(ax, ay, ax + 4 + dir * 4, ay - 9 + dir * 6, ANT); S.line(ax + 2, ay - 4 + dir * 3, ax + 7 + dir * 3, ay - 6 + dir * 5, ANT);
  S.line(ax - 2, ay, ax - 5 + dir * 6, ay - 9 + dir * 6, ANT); S.line(ax - 3, ay - 4 + dir * 3, ax - 8 + dir * 5, ay - 5 + dir * 4, ANT);
  if (stun) { S.dot(hx + 1, hy - 1, '#ffe86a'); S.dot(hx - 1, hy, '#ffe86a'); }
  else { S.set(hx + 1, hy - 1, EYE); S.set(hx + 2, hy - 1, EYE); }
  // brasas en el lomo
  for (let i = 0; i < 5; i++) S.dot(12 + i * 4, cy - 5 + (i % 2), i % 2 ? '#ffb060' : '#ff7a3a');
  void EMBER;
  return S.render(pal);
}

// ================================================================ CANGREJO
// 0-1 correr de lado · 2 guardia (pinzas arriba) · 3 pinzazo
export const CANGREJO_FRAMES = { walk: [0, 1], guard: 2, snap: 3 } as const;
function cangrejo(f: number): HTMLCanvasElement {
  const S = new Sculpt(22, 16);
  const SHELL = 1, CLAW = 2, LEG = 3, EYE = 4, BELLY = 5;
  const pal = P({ [SHELL]: ramp('#c0503a', { hard: true }), [CLAW]: ramp('#d8664a', { hard: true }), [LEG]: '#a0402e', [EYE]: ramp('#1a1a1a', { flat: true }), [BELLY]: '#e8b090' });
  const ph = f === 1 ? 1 : 0;
  for (let i = 0; i < 3; i++) {
    S.line(7 - i, 10, 4 - i * 2, 14 - ((i + ph) % 2), LEG);
    S.line(15 + i, 10, 18 + i * 2, 14 - ((i + 1 + ph) % 2), LEG);
  }
  S.ellipse(11, 9, 7, 4, SHELL);
  S.ellipse(11, 11, 4, 1.5, BELLY);
  const up = f === 2, snap = f === 3;
  // pinzas
  const cy = up ? 2 : snap ? 6 : 6;
  S.ellipse(3, cy + 2, 2.6, 2.4, CLAW); S.ellipse(19, cy + 2, 2.6, 2.4, CLAW);
  if (!snap) { S.set(3, cy, 0); S.set(19, cy, 0); }
  S.line(5, 8, 4, cy + 3, CLAW); S.line(17, 8, 18, cy + 3, CLAW);
  // ojos en pedúnculo
  S.line(9, 5, 9, 3, LEG); S.line(13, 5, 13, 3, LEG);
  S.set(9, 2, EYE); S.set(13, 2, EYE);
  return S.render(pal);
}

// ================================================================ REY CANGREJO
// 0-1 correr · 2 guardia · 3 golpe de pinzas · 4 volcado (aturdido)
export const REYCANGREJO_FRAMES = { walk: [0, 1], guard: 2, slam: 3, stun: 4 } as const;
function reyCangrejo(f: number): HTMLCanvasElement {
  const S = new Sculpt(46, 32);
  const SHELL = 1, CLAW = 2, LEG = 3, EYE = 4, BELLY = 5, BARN = 6, CROWN = 7;
  const pal = P({
    [SHELL]: ramp('#9a3a30', { hard: true }), [CLAW]: ramp('#c04e3a', { hard: true }), [LEG]: '#7a2e24', [EYE]: ramp('#ffe070', { flat: true }),
    [BELLY]: '#d8a080', [BARN]: '#b8b0a0', [CROWN]: ramp('#e8c04a', { hard: true }),
  });
  const stun = f === 4, ph = f === 1 ? 1 : 0;
  if (stun) {
    // patas arriba: panza al cielo, patas pataleando
    S.ellipse(23, 20, 15, 7, BELLY);
    for (let i = 0; i < 4; i++) { S.line(12 + i * 5, 15, 10 + i * 5 + (i % 2) * 3, 6 + (i % 2) * 2, LEG, 2); S.line(14 + i * 5, 15, 16 + i * 5, 7, LEG); }
    S.ellipse(23, 24, 12, 4, SHELL);
    return S.render(pal);
  }
  for (let i = 0; i < 4; i++) {
    S.line(14 - i * 2, 20, 6 - i * 3, 30 - ((i + ph) % 2) * 2, LEG, 2);
    S.line(32 + i * 2, 20, 40 + i * 3, 30 - ((i + 1 + ph) % 2) * 2, LEG, 2);
  }
  S.ellipse(23, 18, 15, 8, SHELL);
  S.ellipse(23, 22, 9, 3, BELLY);
  // percebes y corona de coral en el caparazón
  for (const [x, y] of [[15, 14], [28, 13], [20, 12], [32, 17]] as [number, number][]) S.ellipse(x, y, 1.4, 1.2, BARN);
  for (let i = 0; i < 5; i++) S.tri(17 + i * 3, 11, 18 + i * 3, 5 - (i % 2) * 2, 19 + i * 3, 11, CROWN);
  const up = f === 2, slam = f === 3;
  const cy = up ? 4 : slam ? 20 : 12;
  for (const side of [-1, 1]) {
    const cx = 23 + side * 18;
    S.line(23 + side * 12, 16, cx, cy + 4, CLAW, 3);
    S.ellipse(cx, cy + 2, 4.5, 4, CLAW);
    if (!slam) S.tri(cx + side * 1, cy - 2, cx + side * 6, cy - 4, cx + side * 3, cy + 1, CLAW);
  }
  S.line(19, 11, 19, 7, LEG); S.line(27, 11, 27, 7, LEG);
  S.set(19, 6, EYE); S.set(27, 6, EYE);
  return S.render(pal);
}

// ================================================================ FUEGO FATUO
// 0-2 parpadeo · 3 hinchado (va a estallar)
export const FATUO_FRAMES = { idle: [0, 1, 2], swell: 3 } as const;
function fatuo(f: number): HTMLCanvasElement {
  const S = new Sculpt(14, 18);
  const CORE = 1, FLAME = 2, TIP = 3;
  const pal = P({ [CORE]: ramp('#f4fff0', { flat: true }), [FLAME]: ramp('#7ef0c8'), [TIP]: ramp('#3ab890') });
  const sw = f === 3;
  const r = sw ? 5 : 3.6 + (f === 1 ? 0.6 : 0);
  S.ellipse(7, 12, r, r, FLAME);
  S.tri(7 - r, 12, 7 + (f - 1), 1 + (sw ? 2 : 0), 7 + r, 12, FLAME);
  S.tri(5, 9, 6 + (f % 2), 3, 8, 9, TIP);
  S.ellipse(7, 12.5, r * 0.45, r * 0.45, CORE);
  S.dot(6, 11, '#1a3a30'); S.dot(8, 11, '#1a3a30');
  return S.render(pal);
}

// ================================================================ LA VIUDA DE NIEBLA
// 0-1 flotar · 2 conjuro (brazos alzados) · 3 grito · 4 desvanecida (aturdida)
export const VIUDA_FRAMES = { float: [0, 1], cast: 2, scream: 3, stun: 4 } as const;
function viuda(f: number): HTMLCanvasElement {
  const S = new Sculpt(30, 40);
  const DRESS = 1, VEIL = 2, SKIN = 3, EYE = 4, HEM = 5, HAIR = 6;
  const pal = P({
    [DRESS]: '#3a3e58', [VEIL]: '#c8d0e0', [SKIN]: '#d8dce8', [EYE]: ramp('#9ef0ff', { flat: true }), [HEM]: '#5a6280', [HAIR]: '#e8ecf4',
  });
  const bob = f === 1 ? 1 : 0, stun = f === 4;
  const top = 6 + bob + (stun ? 6 : 0);
  // falda que se deshace en niebla
  S.tri(15, top + 8, 4, 37, 26, 37, DRESS);
  for (let i = 0; i < 6; i++) S.tri(4 + i * 4, 35, 6 + i * 4, 39 - (i + f) % 2 * 2, 8 + i * 4, 35, HEM);
  S.fill(11, top + 8, 9, 10, DRESS);
  // brazos
  if (f === 2) { S.line(11, top + 10, 4, top - 2, SKIN, 2); S.line(19, top + 10, 26, top - 2, SKIN, 2); }
  else if (f === 3) { S.line(11, top + 10, 5, top + 4, SKIN, 2); S.line(19, top + 10, 25, top + 4, SKIN, 2); }
  else { S.line(11, top + 10, 8, top + 20, SKIN, 2); S.line(19, top + 10, 22, top + 20, SKIN, 2); }
  // cabeza, melena y velo
  S.ellipse(15, top + 4, 4, 4.5, SKIN);
  S.fill(10, top + 3, 2, 10, HAIR); S.fill(19, top + 3, 2, 10, HAIR);
  S.tri(9, top + 1, 15, top - 6, 21, top + 1, VEIL);
  S.fill(9, top, 13, 3, VEIL);
  S.tri(9, top + 2, 6, top + 18, 12, top + 6, VEIL); S.tri(21, top + 2, 24, top + 18, 18, top + 6, VEIL);
  if (stun) { S.dot(13, top + 4, '#ffe86a'); S.dot(17, top + 4, '#ffe86a'); }
  else { S.set(13, top + 4, EYE); S.set(17, top + 4, EYE); }
  if (f === 3) { S.dot(14, top + 7, '#1a1a2a'); S.dot(15, top + 7, '#1a1a2a'); S.dot(16, top + 7, '#1a1a2a'); }
  return S.render(pal);
}

// ================================================================ WENDIGO DE ESCARCHA
// 0-1 andar · 2 zarpa preparada · 3 salto · 4 aullido · 5 aturdido
export const WENDIGO_FRAMES = { walk: [0, 1], windup: 2, leap: 3, howl: 4, stun: 5 } as const;
function wendigo(f: number): HTMLCanvasElement {
  const S = new Sculpt(38, 42);
  const FUR = 1, SKIN = 2, BONE = 3, EYE = 4, CLAW = 5, ICE = 6, FURD = 7;
  const pal = P({
    [FUR]: '#d8dce4', [SKIN]: '#8a8fa0', [BONE]: ramp('#efe8d8', { hard: true }), [EYE]: ramp('#7ae8ff', { flat: true }),
    [CLAW]: ramp('#2a2a34', { hard: true }), [ICE]: ramp('#b8e8ff', { hard: true }), [FURD]: '#a8b0c0',
  });
  const leap = f === 3, stun = f === 5, howl = f === 4;
  const dy = leap ? -6 : stun ? 8 : 0;
  // piernas largas y huesudas
  if (!leap && !stun) {
    const lp = f === 1 ? 3 : 0;
    S.line(16 - lp, 26, 14 - lp, 40, SKIN, 2); S.line(22 + lp, 26, 24 + lp, 40, SKIN, 2);
    S.fill(12 - lp, 40, 4, 2, CLAW); S.fill(23 + lp, 40, 4, 2, CLAW);
  } else if (leap) {
    S.line(16, 22, 10, 30, SKIN, 2); S.line(22, 22, 28, 30, SKIN, 2);
  } else {
    S.fill(8, 38, 24, 3, SKIN);
  }
  // torso encorvado de pelaje helado
  S.ellipse(19, 18 + dy, 9, 10, FUR);
  S.ellipse(21, 20 + dy, 5, 6, FURD);
  for (let i = 0; i < 4; i++) S.line(13 + i * 3, 12 + dy, 14 + i * 3, 16 + dy, SKIN);   // costillas
  // brazos largos con zarpas
  const ay = f === 2 ? -6 : howl ? -8 : 0;
  S.line(12, 14 + dy, 6, 26 + dy + ay, SKIN, 2); S.line(26, 14 + dy, 32, 26 + dy + ay, SKIN, 2);
  for (const [x, y] of [[6, 26 + dy + ay], [32, 26 + dy + ay]] as [number, number][]) { S.line(x, y, x - 2, y + 3, CLAW); S.line(x, y, x, y + 4, CLAW); S.line(x, y, x + 2, y + 3, CLAW); }
  // cráneo de ciervo con cuernos de hielo
  const hy = 7 + dy;
  S.ellipse(24, hy, 4, 3.6, BONE);
  S.tri(26, hy - 1, 32, hy + 2, 26, hy + 3, BONE);
  S.line(22, hy - 3, 18, hy - 9, ICE); S.line(20, hy - 6, 16, hy - 6, ICE);
  S.line(26, hy - 3, 30, hy - 10, ICE); S.line(28, hy - 7, 32, hy - 7, ICE);
  if (stun) { S.dot(24, hy, '#ffe86a'); S.dot(26, hy, '#ffe86a'); }
  else { S.set(24, hy, EYE); S.set(26, hy, EYE); }
  if (howl) { S.dot(29, hy + 2, '#1a1a2a'); S.dot(30, hy + 2, '#1a1a2a'); }
  return S.render(pal);
}

// ---------------------------------------------------------------- registro
export function buildR18Creatures(): Record<string, Frames> {
  return {
    cuervo: [0, 1, 2, 3].map(cuervo),
    reina_cuervo: [0, 1, 2, 3, 4].map(reina),
    arana: [0, 1, 2, 3].map(arana),
    ciervo: [0, 1, 2, 3, 4, 5].map(ciervo),
    cangrejo: [0, 1, 2, 3].map(cangrejo),
    rey_cangrejo: [0, 1, 2, 3, 4].map(reyCangrejo),
    fatuo: [0, 1, 2, 3].map(fatuo),
    viuda: [0, 1, 2, 3, 4].map(viuda),
    wendigo: [0, 1, 2, 3, 4, 5].map(wendigo),
  };
}
