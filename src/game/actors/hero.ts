// ============================================================
// ECOS DE AELTHAR — EL PORTADOR v4 (R18 «El Portador»)
//
// Modelo NUEVO del protagonista, independiente de humanoid.ts (que sigue
// sirviendo a NPCs y enemigos). Más alto (26×30, figura de ~22 px frente a
// los 18 de los NPC), con VOLUMEN:
//   · se pinta por MATERIALES (piel, pelo, tela, cuero, metal, malla…) en
//     un búfer y un pase automático da a cada píxel su tono: luz arriba-
//     izquierda (borde claro cálido), sombra abajo-derecha (fría) y un
//     contorno SELECTIVO del color oscuro de cada material (sel-out) en vez
//     de una línea negra plana → lee como 3 tonos + borde, con profundidad.
//   · el EQUIPO SE VE: la armadura activa (tier 0-5 de armor.ts) y la mejora
//     del arma (+0…+5) cambian piezas y colores: chaleco de cuero, cota de
//     malla con tabardo, placas con hombreras y grebas, Manto de Ecos con
//     runas, la Guarda del Primer Canto blanca y oro; la hoja pasa de hierro
//     a acero, azur, oro y luz; el cristal del báculo crece y cambia de color.
//   · ANIMACIÓN: idle (respira y parpadea), andar 8 fases, correr 6 (sprint),
//     ataque 3 (preparación · tajo · remate), lanzar 3, voltereta 4 y
//     herido 1, en 3 direcciones (abajo/arriba/perfil; el perfil izquierdo
//     es el derecho volteado por render.ts, como siempre).
//
// Generación PEREZOSA con caché por (disciplina|armadura|arma|dir|acción|
// fase). Cada fotograma devuelve además la posición de la PUNTA del arma
// (para el brillo aditivo de las armas mejoradas que pinta render.ts).
// Determinista, sin Math.random.
// ============================================================

import { mkCanvas } from './util';

export type HeroDir = 'down' | 'up' | 'side';
export type HeroAct = 'idle' | 'walk' | 'run' | 'atk' | 'cast' | 'roll' | 'hurt';
export interface HeroLook { disc: 'alba' | 'tejedor'; armor: number; weapon: number }
export interface HeroFrame { cv: HTMLCanvasElement; tipX: number; tipY: number; glow: string | null }

export const HERO_W = 26;
export const HERO_H = 30;
/** Fotogramas por acción. */
export const HERO_FRAMES: Readonly<Record<HeroAct, number>> = { idle: 3, walk: 8, run: 6, atk: 3, cast: 3, roll: 4, hurt: 1 };

// ---------------------------------------------------------------- materiales
const E = 0, SKIN = 1, HAIR = 2, CLOTH = 3, CLOTH2 = 4, LEATHER = 5, METAL = 6, TRIM = 7,
  CAPE = 8, BLADE = 9, WOOD = 10, GEM = 11, HOOD = 12, CHAIN = 13, SHIELD = 14, DARK = 15, EYE = 16,
  SOLE = 17, TABARD = 18;
const NMAT = 19;

interface Tones { hi: string; base: string; sh: string; out: string }

// ---------------------------------------------------------------- color
function rgb(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(a: string, b: string, k: number): string {
  const A = rgb(a), B = rgb(b);
  return hex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
}
function mul(a: string, f: number): string {
  const A = rgb(a);
  return hex(A[0] * f, A[1] * f, A[2] * f);
}
/** Rampa de 4 tonos con desplazamiento de tono: luces cálidas, sombras frías. */
function ramp(base: string, opts?: { hiK?: number; shK?: number; outK?: number }): Tones {
  const hiK = opts?.hiK ?? 1.22, shK = opts?.shK ?? 0.68, outK = opts?.outK ?? 0.36;
  return {
    hi: mix(mul(base, hiK), '#fff2cc', 0.14),
    base,
    sh: mix(mul(base, shK), '#2a2450', 0.16),
    out: mix(mul(base, outK), '#120a1c', 0.45),
  };
}

// ---------------------------------------------------------------- aspecto
interface LookPal {
  t: Tones[];          // por material
  hood: boolean;       // capucha (alba / mantos)
  longHair: boolean;   // melena (tejedora)
  robe: boolean;       // túnica larga (tejedora)
  shield: boolean;     // escudo en el brazo (alba)
  staff: boolean;      // báculo (tejedora) — si no, espada
  bladeLen: number;
  crystal: number;     // 0 pequeño · 1 medio · 2 grande
  glow: string | null; // color de brillo del arma (tier ≥ 3 / ≥ 2 báculo)
  armor: number;
  eyeC: string;
  runes: boolean;      // runas del Manto de Ecos
}

const BLADES = ['#a9b1bd', '#c3ccd8', '#d2dae6', '#a8d6ff', '#ffe08a', '#fff4d6'];
const CRYSTALS = ['#4fb0c4', '#62cade', '#78e4f0', '#b98cff', '#ffd76a', '#f4fbff'];

function lookPal(look: HeroLook): LookPal {
  const alba = look.disc === 'alba';
  const a = Math.max(0, Math.min(5, look.armor | 0));
  const w = Math.max(0, Math.min(5, look.weapon | 0));
  const base: Record<number, string> = {
    [SKIN]: '#f0c8a0',
    [HAIR]: alba ? '#6e3222' : '#c4b0ee',
    [CLOTH]: alba ? '#d6dbe6' : '#7c56b8',
    [CLOTH2]: alba ? '#56607a' : '#46386a',
    [LEATHER]: alba ? '#7a4a26' : '#5c3a28',
    [METAL]: a >= 5 ? '#e6e0cc' : '#a6b2c4',
    [TRIM]: '#e8c04a',
    [CAPE]: a >= 5 ? '#f2eee2' : a >= 4 ? '#2c6a7a' : alba ? '#b8304a' : '#5a3c92',
    [BLADE]: BLADES[w],
    [WOOD]: w >= 4 ? '#c8ccd8' : '#6e4c2c',
    [GEM]: CRYSTALS[w],
    [HOOD]: a >= 5 ? '#f2eee2' : a >= 4 ? '#2c6a7a' : '#c23448',
    [CHAIN]: '#9aa6b6',
    [SHIELD]: a >= 5 ? '#e6e0cc' : a >= 3 ? '#8e9cb0' : '#8a5a30',
    [DARK]: '#22182a',
    [EYE]: alba ? '#2c2838' : '#2fd6c0',
    [SOLE]: '#2a1c18',
    [TABARD]: alba ? (a >= 5 ? '#f4f0e6' : '#c23448') : '#e8c04a',
  };
  const t: Tones[] = [];
  for (let m = 0; m < NMAT; m++) {
    const b = base[m] ?? '#ff00ff';
    if (m === METAL || m === BLADE || m === TRIM) t[m] = ramp(b, { hiK: 1.35, shK: 0.6, outK: 0.32 });
    else if (m === GEM) t[m] = { hi: '#ffffff', base: b, sh: mul(b, 0.72), out: mix(mul(b, 0.35), '#101020', 0.4) };
    else if (m === SKIN) t[m] = ramp(b, { hiK: 1.08, shK: 0.8, outK: 0.42 });
    else if (m === DARK || m === SOLE) t[m] = { hi: b, base: b, sh: b, out: mul(b, 0.6) };
    else t[m] = ramp(b);
  }
  // el ojo no se sombrea: su "out" es la piel en sombra (no recorta la cara)
  t[EYE] = { hi: base[EYE], base: base[EYE], sh: mul(base[EYE], 0.7), out: t[SKIN].sh };
  return {
    t,
    hood: alba || a >= 4,
    longHair: !alba,
    robe: !alba,
    shield: alba,
    staff: !alba,
    bladeLen: [5, 5, 6, 6, 7, 7][w],
    crystal: w >= 4 ? 2 : w >= 2 ? 1 : 0,
    glow: alba ? (w >= 3 ? BLADES[w] : null) : (w >= 2 ? CRYSTALS[w] : null),
    armor: a,
    eyeC: base[EYE],
    runes: a === 4,
  };
}

// ---------------------------------------------------------------- búfer
const W = HERO_W, H = HERO_H;
class Buf {
  m = new Uint8Array(W * H);
  det: (string | null)[] = new Array(W * H).fill(null);
  tipX = 13; tipY = 20;
  set(x: number, y: number, mat: number) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.m[y * W + x] = mat;
    this.det[y * W + x] = null;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= W || y >= H) return E;
    return this.m[y * W + x];
  }
  fill(x: number, y: number, w: number, h: number, mat: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, mat);
  }
  span(y: number, x0: number, x1: number, mat: number) {
    for (let x = x0; x <= x1; x++) this.set(x, y, mat);
  }
  /** píxel de detalle con color fijo (sobre un píxel ya ocupado). */
  dot(x: number, y: number, c: string) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (this.m[y * W + x] === E) this.m[y * W + x] = DARK;
    this.det[y * W + x] = c;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, mat: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1) this.set(x, y, mat);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, mat: number) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, mat);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
}

// ---------------------------------------------------------------- pose
interface Pose {
  bob: number;          // desplazamiento vertical del cuerpo superior
  lean: number;         // inclinación horizontal (perfil) del cuerpo superior
  armL: number; armR: number;   // oscilación de brazos (vertical de frente, horizontal de perfil)
  liftL: number; liftR: number; // pie levantado
  stride: number;       // zancada de perfil (−2…2)
  hem: number;          // retraso del bajo (tela)
  blink: boolean;
  weapon: 'rest' | 'raise' | 'strike' | 'follow' | 'cast0' | 'cast1' | 'cast2';
  hurt: boolean;
}
const REST: Pose = { bob: 0, lean: 0, armL: 0, armR: 0, liftL: 0, liftR: 0, stride: 0, hem: 0, blink: false, weapon: 'rest', hurt: false };

function poseFor(act: HeroAct, f: number): Pose {
  switch (act) {
    case 'idle':
      return { ...REST, bob: f === 1 ? -1 : 0, blink: f === 2 };
    case 'walk': {
      const i = f % 8;
      return {
        ...REST,
        bob: [0, 0, -1, 0, 0, 0, -1, 0][i],
        armL: [1, 1, 0, -1, -1, -1, 0, 1][i],
        armR: [-1, -1, 0, 1, 1, 1, 0, -1][i],
        liftL: [0, 1, 2, 1, 0, 0, 0, 0][i],
        liftR: [0, 0, 0, 0, 0, 1, 2, 1][i],
        stride: [2, 1, 0, -1, -2, -1, 0, 1][i],
        hem: [0, 1, 1, 0, 0, -1, -1, 0][i],
      };
    }
    case 'run': {
      const i = f % 6;
      return {
        ...REST,
        bob: [-1, -2, -1, -1, -2, -1][i],
        lean: 1,
        armL: [2, 1, -1, -2, -1, 1][i],
        armR: [-2, -1, 1, 2, 1, -1][i],
        liftL: [0, 2, 3, 1, 0, 0][i],
        liftR: [1, 0, 0, 0, 2, 3][i],
        stride: [3, 1, -1, -3, -1, 1][i],
        hem: [1, 1, 0, -1, -1, 0][i],
      };
    }
    case 'atk':
      return [
        { ...REST, bob: 0, lean: -1, armR: -2, liftL: 0, stride: -1, weapon: 'raise' as const },
        { ...REST, bob: 0, lean: 1, armR: 2, stride: 2, liftR: 1, weapon: 'strike' as const },
        { ...REST, bob: 0, lean: 1, armR: 1, stride: 1, weapon: 'follow' as const },
      ][f % 3];
    case 'cast':
      return [
        { ...REST, bob: -1, lean: -1, armR: -2, weapon: 'cast0' as const },
        { ...REST, bob: 0, lean: 1, armR: 2, stride: 1, weapon: 'cast1' as const },
        { ...REST, bob: 0, lean: 0, armR: 1, weapon: 'cast2' as const },
      ][f % 3];
    case 'hurt':
      return { ...REST, bob: 0, lean: -2, armL: -2, armR: -2, stride: -1, hem: 1, blink: true, hurt: true };
    default:
      return REST;
  }
}

// ---------------------------------------------------------------- dibujo
const CX = 13;          // eje del cuerpo
const TOP = 8;          // fila superior de la cabeza
const GROUND = 29;      // última fila (suela)

function drawFront(b: Buf, L: LookPal, p: Pose, back: boolean): void {
  const u = p.bob + (p.hurt ? 1 : 0);
  const hy = TOP + u;                     // cabeza
  const ty = TOP + 8 + u;                 // torso (16)
  const a = L.armor;
  // ---- capa larga detrás (manto / guarda) ----
  if (a >= 4) {
    b.fill(CX - 5, ty, 10, 11, CAPE);
    b.span(ty + 11, CX - 5 + (p.hem > 0 ? 1 : 0), CX + 4 + (p.hem < 0 ? -1 : 0), CAPE);
    if (back) b.fill(CX - 5, ty + 11, 10, 2, CAPE);
  }
  // ---- melena de la tejedora por detrás de los hombros ----
  if (L.longHair) {
    b.fill(CX - 5, hy + 3, 2, 8, HAIR);
    b.fill(CX + 3, hy + 3, 2, 8, HAIR);
    if (back) b.fill(CX - 4, hy + 7, 8, 5, HAIR);
  }
  // ---- piernas (ancladas al suelo) ----
  const legTop = TOP + 16;                // 24
  const leg = (x0: number, lift: number) => {
    const top = legTop - lift;
    b.fill(x0, top, 3, 3, CLOTH2);
    if (a >= 3) b.fill(x0, top + 1, 3, 2, METAL);       // grebas
    b.fill(x0, top + 3, 3, 2, LEATHER);                  // bota
    b.span(top + 5, x0, x0 + 2, SOLE);                   // suela
  };
  leg(CX - 4, p.liftL);
  leg(CX + 1, p.liftR);
  // ---- túnica / torso ----
  b.span(ty, CX - 3, CX + 2, CLOTH);                     // hombros
  b.fill(CX - 4, ty + 1, 8, 3, CLOTH);                   // pecho
  b.span(ty + 4, CX - 3, CX + 2, CLOTH);                 // talle
  b.span(ty + 5, CX - 3, CX + 2, LEATHER);               // cinturón
  // bajo: falda corta (alba) o hábito largo (tejedora), con retraso de tela
  const hemRows = L.robe ? 7 : 2;
  for (let r = 0; r < hemRows; r++) {
    const wob = r === hemRows - 1 ? p.hem : 0;
    const wide = L.robe ? Math.min(2, r >> 1) : 0;
    b.span(ty + 6 + r, CX - 4 - wide + (wob > 0 ? 1 : 0), CX + 3 + wide + (wob < 0 ? -1 : 0), CLOTH);
  }
  // ---- armadura por tier ----
  if (a === 1) {
    b.fill(CX - 3, ty + 1, 6, 4, LEATHER);               // chaleco
    if (!back) { b.span(ty + 1, CX - 1, CX, CLOTH); b.span(ty + 2, CX - 1, CX, CLOTH); }
  } else if (a === 2) {
    b.fill(CX - 4, ty, 8, 5, CHAIN);                     // cota de malla
    b.fill(CX - 1, ty + 1, 2, 7, TABARD);                // tabardo
  } else if (a === 3) {
    b.fill(CX - 4, ty + 1, 8, 4, METAL);                 // peto
    b.span(ty, CX - 3, CX + 2, METAL);
    if (!back) b.span(ty + 2, CX - 1, CX, TRIM);         // nervadura
    b.span(ty + 6, CX - 4, CX + 3, METAL);               // faldar
  } else if (a === 4) {
    b.fill(CX - 4, ty + 1, 8, 4, CHAIN);                 // malla bajo el manto
    b.fill(CX - 2, ty + 1, 4, 3, CLOTH);
  } else if (a === 5) {
    b.fill(CX - 4, ty, 8, 5, METAL);                     // placas blancas
    b.span(ty + 1, CX - 4, CX + 3, TRIM);
    if (!back) { b.set(CX - 1, ty + 3, TRIM); b.set(CX, ty + 3, TRIM); }
    b.span(ty + 6, CX - 4, CX + 3, METAL);
  }
  b.set(CX - 1, ty + 5, TRIM); b.set(CX, ty + 5, TRIM);   // hebilla
  // ---- brazos ----
  const arm = (x0: number, dy: number) => {
    const ay = ty + dy;
    b.fill(x0, ay, 2, 4, a === 2 || a === 4 ? CHAIN : CLOTH);
    if (a === 1) b.fill(x0, ay + 2, 2, 2, LEATHER);       // brazales
    if (a === 3 || a === 5) b.fill(x0, ay + 2, 2, 2, METAL);
    b.fill(x0, ay + 4, 2, 2, a >= 3 ? METAL : a >= 1 ? LEATHER : SKIN); // mano / guantelete
  };
  const leftX = CX - 6, rightX = CX + 4;
  const weaponOnLeft = !back;   // de frente, la mano derecha del Portador queda a la IZQUIERDA de la pantalla
  const wArmDy = (p.weapon === 'raise' || p.weapon === 'cast0') ? -3 : p.weapon === 'strike' || p.weapon === 'cast1' ? 2 : 0;
  arm(leftX, weaponOnLeft ? Math.max(-3, p.armL + wArmDy) : p.armL);
  arm(rightX, weaponOnLeft ? p.armR : Math.max(-3, p.armR + wArmDy));
  // hombreras
  if (a === 3 || a === 5) {
    b.ellipse(CX - 6, ty + 0.5, 1.6, 1.2, METAL);
    b.ellipse(CX + 5, ty + 0.5, 1.6, 1.2, METAL);
    if (a === 5) { b.set(CX - 6, ty - 1, TRIM); b.set(CX + 5, ty - 1, TRIM); }
  } else if (a === 1) {
    b.set(CX - 5, ty, LEATHER); b.set(CX + 4, ty, LEATHER);
  }
  // ---- cuello y cabeza ----
  b.span(hy + 7, CX - 1, CX, SKIN);
  if (L.hood) {
    // capucha: envuelve el cráneo y cae sobre los hombros como esclavina
    b.span(hy - 1, CX - 2, CX + 1, HOOD);
    b.span(hy, CX - 4, CX + 3, HOOD);
    b.fill(CX - 5, hy + 1, 10, 6, HOOD);
    b.span(hy + 7, CX - 5, CX - 2, HOOD); b.span(hy + 7, CX + 1, CX + 4, HOOD);
    b.span(hy + 8, CX - 5, CX - 3, HOOD); b.span(hy + 8, CX + 2, CX + 4, HOOD);
    if (back) {
      b.fill(CX - 4, hy + 6, 8, 3, HOOD);
      b.set(CX - 1, hy + 9, HOOD); b.set(CX, hy + 9, HOOD);   // pico de la capucha
    }
  }
  // cráneo y pelo (de espaldas con capucha, la capucha lo cubre todo)
  const skull = back && L.hood ? HOOD : HAIR;
  b.span(hy, CX - 3, CX + 2, skull);
  b.fill(CX - 4, hy + 1, 8, 5, skull);
  if (!back) {
    // cara: 4 filas, barbilla estrecha
    b.fill(CX - 3, hy + 3, 6, 3, SKIN);
    b.span(hy + 6, CX - 2, CX + 1, SKIN);
    // flequillo en zigzag
    b.set(CX - 2, hy + 3, HAIR); b.set(CX + 1, hy + 3, HAIR);
    // ojos 1×2 (iris + brillo) o párpados
    if (p.blink) {
      b.dot(CX - 2, hy + 5, L.t[SKIN].sh); b.dot(CX + 1, hy + 5, L.t[SKIN].sh);
    } else {
      b.set(CX - 2, hy + 4, EYE); b.set(CX - 2, hy + 5, EYE);
      b.set(CX + 1, hy + 4, EYE); b.set(CX + 1, hy + 5, EYE);
      b.dot(CX - 2, hy + 4, mix(L.eyeC, '#ffffff', 0.55));
      b.dot(CX + 1, hy + 4, mix(L.eyeC, '#ffffff', 0.55));
    }
    // mejillas y boca
    b.dot(CX - 3, hy + 5, mix(L.t[SKIN].base, '#e88a7a', 0.35));
    b.dot(CX + 2, hy + 5, mix(L.t[SKIN].base, '#e88a7a', 0.35));
    if (p.hurt) b.dot(CX - 1, hy + 6, '#7a3030');
    // diadema de la tejedora con gema
    if (!L.hood && L.longHair) {
      b.span(hy + 2, CX - 4, CX + 3, TRIM);
      b.set(CX - 1, hy + 2, GEM); b.set(CX, hy + 2, GEM);
    }
    if (L.hood) { b.set(CX - 4, hy + 4, HAIR); b.set(CX + 3, hy + 4, HAIR); }
  } else if (!L.hood) {
    b.span(hy + 2, CX - 4, CX + 3, TRIM);
  }
  // ---- escudo (alba): brazo izquierdo del Portador ----
  if (L.shield) {
    const sx = back ? leftX + 0.5 : rightX + 1.5;
    const sy = ty + 3 + (back ? p.armL : p.armR) * 0.5;
    b.ellipse(sx, sy, 2.4, 3.2, SHIELD);
    if (!back) {
      b.set(Math.round(sx), Math.round(sy), TRIM);                    // umbo
      if (L.armor >= 5) { b.set(Math.round(sx), Math.round(sy) - 2, TRIM); b.set(Math.round(sx), Math.round(sy) + 2, TRIM); }
    } else {
      b.span(Math.round(sy), Math.round(sx) - 1, Math.round(sx) + 1, LEATHER); // correas
    }
  }
  // ---- arma ----
  const handX = weaponOnLeft ? leftX : rightX;
  const handDy = weaponOnLeft ? Math.max(-3, p.armL + wArmDy) : Math.max(-3, p.armR + wArmDy);
  const hx = weaponOnLeft ? handX - 1 : handX + 2;   // por fuera de la mano
  const hyH = ty + handDy + 4;                       // fila de la mano
  drawWeaponFront(b, L, p, hx, hyH, back, weaponOnLeft);
  // runas del manto (detalles fijos; el brillo animado lo pone render)
  if (L.runes) {
    b.dot(CX - 4, ty + 10, '#8af0ff'); b.dot(CX + 3, ty + 9, '#8af0ff');
    if (back) { b.dot(CX - 1, ty + 6, '#8af0ff'); b.dot(CX + 1, ty + 8, '#8af0ff'); }
  }
}

function drawWeaponFront(b: Buf, L: LookPal, p: Pose, hx: number, hy: number, back: boolean, left: boolean): void {
  const dirX = left ? -1 : 1;
  if (L.staff) {
    // báculo vertical; en lanzar se alza o se adelanta
    let top = 7, bottom = GROUND;
    let x = hx;
    if (p.weapon === 'cast0') { top = 3; bottom = hy + 6; }
    else if (p.weapon === 'cast1') { top = 9; bottom = GROUND; x = hx + (back ? 0 : 0); }
    for (let y = top + 3; y <= bottom; y++) b.set(x, y, WOOD);
    drawCrystal(b, L, x, top + 1);
    if (p.weapon === 'cast1' && !back) { b.tipX = x; b.tipY = top + 1; }
    return;
  }
  const len = L.bladeLen;
  if (p.weapon === 'raise') {
    // espada alzada por encima del hombro
    b.set(hx, hy, LEATHER); b.set(hx, hy + 1, TRIM);
    b.span(hy - 1, hx - 1, hx + 1, TRIM);
    for (let i = 0; i < len; i++) b.set(hx + (i > 2 ? dirX : 0), hy - 2 - i, BLADE);
    b.tipX = hx + dirX; b.tipY = hy - 1 - len;
  } else if (p.weapon === 'strike') {
    // estocada hacia delante (abajo o arriba según se mire)
    const vy = back ? -1 : 1;
    b.set(hx, hy, LEATHER);
    b.span(hy + vy, hx - 1, hx + 1, TRIM);
    for (let i = 0; i < len + 1; i++) b.set(hx - dirX * Math.floor(i / 3), hy + vy * (2 + i), BLADE);
    b.tipX = hx - dirX * Math.floor(len / 3); b.tipY = hy + vy * (2 + len);
  } else if (p.weapon === 'follow') {
    // remate: hoja cruzada en diagonal baja
    b.set(hx, hy, LEATHER);
    b.set(hx - dirX, hy + 1, TRIM);
    b.line(hx - dirX * 2, hy + 2, hx - dirX * (2 + len), hy + 4, BLADE);
    b.tipX = hx - dirX * (2 + len); b.tipY = hy + 4;
  } else {
    // reposo: empuñadura en la mano, hoja hacia el suelo
    b.set(hx, hy - 1, TRIM);                     // pomo
    b.set(hx, hy, LEATHER);                      // puño
    b.span(hy + 1, hx - 1, hx + 1, TRIM);        // guarda
    const end = Math.min(GROUND, hy + 1 + len);
    let tx = hx;
    for (let y = hy + 2; y <= end; y++) { tx = hx + dirX * Math.floor((y - hy - 2) / 3); b.set(tx, y, BLADE); }
    b.tipX = tx; b.tipY = end;
  }
}

function drawCrystal(b: Buf, L: LookPal, x: number, y: number): void {
  const s = L.crystal;
  if (s === 0) {
    b.set(x, y, GEM); b.set(x, y + 1, GEM); b.set(x, y + 2, TRIM);
  } else if (s === 1) {
    b.set(x, y - 1, GEM); b.span(y, x - 1, x + 1, GEM); b.set(x, y + 1, GEM); b.span(y + 2, x - 1, x + 1, TRIM);
  } else {
    b.set(x, y - 2, GEM); b.span(y - 1, x - 1, x + 1, GEM); b.span(y, x - 2, x + 2, GEM);
    b.span(y + 1, x - 1, x + 1, GEM); b.set(x, y + 2, GEM);
    b.set(x - 2, y + 2, TRIM); b.set(x + 2, y + 2, TRIM); b.span(y + 3, x - 1, x + 1, TRIM);
  }
  b.tipX = x; b.tipY = y;
}

function drawSide(b: Buf, L: LookPal, p: Pose): void {
  const u = p.bob + (p.hurt ? 1 : 0);
  const ln = p.lean;
  const hy = TOP + u;
  const ty = TOP + 8 + u;
  const a = L.armor;
  const cx = CX + ln;                       // eje del cuerpo superior (perfil derecho)
  // ---- capa (detrás, ondea hacia atrás) ----
  if (a >= 4) {
    b.fill(cx - 4, ty, 3, 10, CAPE);
    b.span(ty + 10, cx - 5 - Math.max(0, p.hem), cx - 2, CAPE);
    b.span(ty + 11, cx - 5 - Math.max(0, p.hem), cx - 3, CAPE);
  }
  if (L.longHair) b.fill(cx - 4, hy + 3, 3, 8, HAIR);
  // ---- brazo lejano (detrás) + escudo ----
  b.fill(cx - 1 - p.armL, ty + 1, 2, 4, a === 2 || a === 4 ? CHAIN : CLOTH);
  b.fill(cx - 1 - p.armL, ty + 5, 2, 1, a >= 3 ? METAL : a >= 1 ? LEATHER : SKIN);
  if (L.shield) {
    b.ellipse(cx + 2.5, ty + 3, 1.4, 3.3, SHIELD);
  }
  // ---- piernas: lejana primero ----
  const legTop = TOP + 16;
  const legS = (x0: number, lift: number, far: boolean) => {
    const top = legTop - lift;
    b.fill(x0, top, 3, 3, CLOTH2);
    if (a >= 3) b.fill(x0, top + 1, 3, 2, METAL);
    b.fill(x0, top + 3, 3, 2, LEATHER);
    b.set(x0 + 3, top + 4, LEATHER);                  // puntera
    b.span(top + 5, x0, x0 + 3, SOLE);
    if (far) b.dot(x0 + 1, top + 1, mul(L.t[CLOTH2].sh, 0.85));
  };
  legS(CX - 1 - p.stride, p.liftL, true);
  legS(CX - 1 + p.stride, p.liftR, false);
  // ---- torso ----
  b.fill(cx - 2, ty, 5, 1, CLOTH);
  b.fill(cx - 2, ty + 1, 6, 4, CLOTH);              // pecho adelantado
  b.span(ty + 5, cx - 2, cx + 2, LEATHER);
  const hemRows = L.robe ? 7 : 2;
  for (let r = 0; r < hemRows; r++) {
    const back = r === hemRows - 1 ? -Math.abs(p.hem) : 0;
    const wide = L.robe ? Math.min(2, r >> 1) : 0;
    b.span(ty + 6 + r, cx - 2 - wide + back, cx + 3 + (L.robe ? Math.min(1, r >> 2) : 0), CLOTH);
  }
  if (a === 1) b.fill(cx - 1, ty + 1, 4, 4, LEATHER);
  else if (a === 2) { b.fill(cx - 2, ty, 6, 5, CHAIN); b.fill(cx + 2, ty + 1, 1, 7, TABARD); }
  else if (a === 3) { b.fill(cx - 2, ty + 1, 6, 4, METAL); b.span(ty + 6, cx - 2, cx + 3, METAL); b.set(cx + 3, ty + 2, TRIM); }
  else if (a === 4) b.fill(cx - 1, ty + 1, 4, 4, CHAIN);
  else if (a === 5) { b.fill(cx - 2, ty, 6, 5, METAL); b.span(ty + 1, cx - 2, cx + 3, TRIM); b.span(ty + 6, cx - 2, cx + 3, METAL); }
  b.set(cx + 2, ty + 5, TRIM);
  // ---- cabeza de perfil ----
  b.span(hy + 7, cx, cx + 1, SKIN);
  if (L.hood) {
    b.span(hy - 1, cx - 2, cx + 1, HOOD);
    b.span(hy, cx - 3, cx + 2, HOOD);
    b.fill(cx - 4, hy + 1, 8, 6, HOOD);
    b.fill(cx - 4, hy + 7, 4, 2, HOOD);            // esclavina por detrás
  }
  b.span(hy, cx - 2, cx + 2, HAIR);
  b.fill(cx - 3, hy + 1, 7, 5, HAIR);
  b.fill(cx + 1, hy + 3, 3, 3, SKIN);              // cara
  b.span(hy + 6, cx + 1, cx + 2, SKIN);           // barbilla
  b.set(cx + 4, hy + 4, SKIN);                     // nariz
  b.set(cx + 1, hy + 3, HAIR);                     // patilla / flequillo
  if (p.blink) b.dot(cx + 2, hy + 5, L.t[SKIN].sh);
  else { b.set(cx + 2, hy + 4, EYE); b.set(cx + 2, hy + 5, EYE); b.dot(cx + 2, hy + 4, mix(L.eyeC, '#ffffff', 0.55)); }
  b.dot(cx + 3, hy + 5, mix(L.t[SKIN].base, '#e88a7a', 0.35));
  if (!L.hood && L.longHair) { b.span(hy + 2, cx - 3, cx + 3, TRIM); b.set(cx + 2, hy + 2, GEM); }
  // ---- brazo cercano (delante) + arma ----
  const ar = p.armR;
  let ax = cx + ar, ay = ty + 1;
  if (p.weapon === 'raise' || p.weapon === 'cast0') { ax = cx - 2; ay = ty - 2; }
  else if (p.weapon === 'strike' || p.weapon === 'cast1') { ax = cx + 2; ay = ty + 1; }
  else if (p.weapon === 'follow' || p.weapon === 'cast2') { ax = cx + 1; ay = ty + 2; }
  b.fill(ax, ay, 2, 4, a === 2 || a === 4 ? CHAIN : CLOTH);
  if (a === 1) b.fill(ax, ay + 2, 2, 2, LEATHER);
  if (a === 3 || a === 5) { b.fill(ax, ay + 2, 2, 2, METAL); b.ellipse(cx, ty + 0.5, 1.5, 1.2, METAL); }
  b.fill(ax, ay + 4, 2, 2, a >= 3 ? METAL : a >= 1 ? LEATHER : SKIN);
  const hx = ax + 1, hyH = ay + 4;
  drawWeaponSide(b, L, p, hx, hyH);
  if (L.runes) { b.dot(cx - 4, ty + 9, '#8af0ff'); b.dot(cx - 3, ty + 5, '#8af0ff'); }
}

function drawWeaponSide(b: Buf, L: LookPal, p: Pose, hx: number, hy: number): void {
  if (L.staff) {
    let x = hx + 1, top = 7, bottom = GROUND;
    if (p.weapon === 'cast0') { x = hx; top = 2; bottom = hy + 5; }
    if (p.weapon === 'cast1') {
      // báculo apuntando al frente, casi horizontal
      b.line(hx - 3, hy + 2, hx + 6, hy - 2, WOOD);
      drawCrystal(b, L, hx + 7, hy - 3);
      return;
    }
    for (let y = top + 3; y <= bottom; y++) b.set(x, y, WOOD);
    drawCrystal(b, L, x, top + 1);
    return;
  }
  const len = L.bladeLen;
  if (p.weapon === 'raise') {
    b.set(hx, hy, LEATHER); b.span(hy - 1, hx - 1, hx + 1, TRIM);
    b.line(hx - 1, hy - 2, hx - 1 - Math.floor(len * 0.5), hy - 2 - len, BLADE);
    b.tipX = hx - 1 - Math.floor(len * 0.5); b.tipY = hy - 2 - len;
  } else if (p.weapon === 'strike') {
    b.set(hx, hy, LEATHER); b.set(hx + 1, hy - 1, TRIM); b.set(hx + 1, hy, TRIM); b.set(hx + 1, hy + 1, TRIM);
    for (let i = 0; i <= len; i++) b.set(hx + 2 + i, hy, BLADE);
    b.tipX = hx + 2 + len; b.tipY = hy;
  } else if (p.weapon === 'follow') {
    b.set(hx, hy, LEATHER); b.set(hx + 1, hy + 1, TRIM);
    b.line(hx + 2, hy + 2, hx + 2 + Math.floor(len * 0.6), hy + 2 + Math.floor(len * 0.7), BLADE);
    b.tipX = hx + 2 + Math.floor(len * 0.6); b.tipY = hy + 2 + Math.floor(len * 0.7);
  } else {
    // reposo: hoja hacia delante y abajo
    b.set(hx, hy - 1, TRIM); b.set(hx, hy, LEATHER);
    b.set(hx + 1, hy, TRIM); b.set(hx, hy + 1, TRIM);
    b.line(hx + 1, hy + 1, hx + 1 + Math.floor(len * 0.55), Math.min(GROUND, hy + 1 + len), BLADE);
    b.tipX = hx + 1 + Math.floor(len * 0.55); b.tipY = Math.min(GROUND, hy + 1 + len);
  }
}

function drawRoll(b: Buf, L: LookPal, f: number, dir: HeroDir): void {
  // ovillo: cuerpo redondo que gira (la cabeza recorre el contorno)
  const cy = 23, cx = CX;
  const body = L.armor >= 4 ? CAPE : L.hood ? HOOD : CLOTH;
  b.ellipse(cx, cy, 5, 4.6, body);
  b.ellipse(cx, cy, 3, 2.6, L.armor === 2 || L.armor === 4 ? CHAIN : L.armor === 3 || L.armor === 5 ? METAL : CLOTH);
  const ang = [-1.9, -0.4, 1.2, 2.7][f % 4] * (dir === 'up' ? -1 : 1);
  const hx = cx + Math.cos(ang) * 4, hyy = cy + Math.sin(ang) * 3.6;
  b.ellipse(hx, hyy, 2, 2, L.hood ? HOOD : HAIR);
  const bx = cx - Math.cos(ang) * 4.2, by = cy - Math.sin(ang) * 3.8;
  b.fill(Math.round(bx) - 1, Math.round(by) - 1, 2, 2, LEATHER);
  // polvo/estela de la voltereta: el arma recogida brilla en el borde
  if (L.staff) b.line(cx - 4, cy + 4, cx + 4, cy - 4, WOOD);
  else b.line(cx + 3, cy + 3, cx + 6, cy + 1, BLADE);
  b.tipX = cx; b.tipY = cy;
}

// ---------------------------------------------------------------- sombreado
function shade(b: Buf, L: LookPal): (string | null)[] {
  const out: (string | null)[] = new Array(W * H).fill(null);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = b.m[y * W + x];
      if (m === E) continue;
      const d = b.det[y * W + x];
      if (d) { out[y * W + x] = d; continue; }
      const T = L.t[m];
      const lft = b.get(x - 1, y) !== m, top = b.get(x, y - 1) !== m;
      const rgt = b.get(x + 1, y) !== m, bot = b.get(x, y + 1) !== m;
      let c = T.base;
      if (m === CHAIN) {
        c = (x + y) % 2 === 0 ? T.base : T.sh;
        if (top) c = T.hi;
        else if (rgt || bot) c = T.sh;
      } else if (m === EYE || m === DARK || m === SOLE) {
        c = T.base;
      } else {
        const hi = lft || top, sh = rgt || bot;
        if (hi && !sh) c = T.hi;
        else if (sh && !hi) c = T.sh;
        else if (hi && sh) c = (lft && top) ? T.hi : (rgt && bot) ? T.sh : T.base;
        // brillo especular en metales: el píxel interior arriba-izquierda
        if ((m === METAL || m === BLADE) && !hi && b.get(x - 1, y - 1) !== m && !sh) c = mix(T.hi, '#ffffff', 0.5);
        // sombra de oclusión bajo el cinturón y la cabeza
        if (m === CLOTH && (b.get(x, y - 1) === LEATHER || b.get(x, y - 1) === SKIN)) c = T.sh;
      }
      out[y * W + x] = c;
    }
  }
  // contorno selectivo: el borde exterior toma el tono oscuro del material vecino
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (b.m[y * W + x] !== E) continue;
      let nm = E;
      const cand = [b.get(x, y + 1), b.get(x - 1, y), b.get(x + 1, y), b.get(x, y - 1)];
      for (const c of cand) if (c !== E) { nm = c; break; }
      if (nm === E) continue;
      out[y * W + x] = L.t[nm].out;
    }
  }
  return out;
}

function paint(colors: (string | null)[]): HTMLCanvasElement {
  const { c, x } = mkCanvas(W, H);
  for (let y = 0; y < H; y++) {
    let run = 0, runC: string | null = null, runX = 0;
    for (let i = 0; i <= W; i++) {
      const col = i < W ? colors[y * W + i] : null;
      if (col === runC && col !== null) { run++; continue; }
      if (runC !== null && run > 0) { x.fillStyle = runC; x.fillRect(runX, y, run, 1); }
      runC = col; runX = i; run = col !== null ? 1 : 0;
    }
  }
  return c;
}

// ---------------------------------------------------------------- API
const cache = new Map<string, HeroFrame>();

function keyOf(look: HeroLook, dir: HeroDir, act: HeroAct, f: number): string {
  return `${look.disc}|${look.armor}|${look.weapon}|${dir}|${act}|${f}`;
}

/** Fotograma del Portador (perezoso + caché). `f` se recorta al nº de fases de la acción. */
export function heroFrame(look: HeroLook, dir: HeroDir, act: HeroAct, f: number): HeroFrame {
  const n = HERO_FRAMES[act];
  const fi = ((f % n) + n) % n;
  const k = keyOf(look, dir, act, fi);
  const hit = cache.get(k);
  if (hit) return hit;
  const L = lookPal(look);
  const b = new Buf();
  if (act === 'roll') drawRoll(b, L, fi, dir);
  else {
    const p = poseFor(act, fi);
    if (dir === 'side') drawSide(b, L, p);
    else drawFront(b, L, p, dir === 'up');
  }
  const fr: HeroFrame = { cv: paint(shade(b, L)), tipX: b.tipX, tipY: b.tipY, glow: L.glow };
  if (cache.size > 900) cache.clear();
  cache.set(k, fr);
  return fr;
}

/** Vacía la caché (cambio de equipo masivo / pruebas). */
export function resetHeroCache(): void { cache.clear(); }
export function heroCacheSize(): number { return cache.size; }
