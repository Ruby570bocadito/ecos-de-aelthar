// ============================================================
// R16 · SPRITES de los enemigos nuevos («Mareas y Raíces»)
//  · centinela — Centinela de Cristal: esquirla flotante sobre un anillo de
//    piedra; 4 frames de flotación (las facetas giran) + carga + disparo.
//  · raiz      — Raíz Hambrienta: tocón con fauces y ojos de brasa;
//    2 frames de acecho, emerger, ataque (púas) y MONTÍCULO enterrado.
//  · ahogado   — Marinero ahogado: casaca azul raída, piel verdosa, algas
//    por pelo; 4 frames de andar arrastrado + carga + golpe.
//  · madre     — LA MADRE DEL MAR (jefa): mascarón de proa de madera y coral
//    con melena de algas y corona de coral, unida a la proa rota del barco;
//    2 frames de vaivén + canto (brazos alzados) + embate + quebrada.
// Pixel art procedural a resolución nativa (helpers de píxel/elipse) con
// CONTORNO automático de 1 px (lee el alfa y pinta el borde oscuro): se
// recortan bien sobre hierba, arena o losa. Defensivo ante stubs (smokes).
// ============================================================

import { mkCanvas, px, type Frames } from './util';
import { registerSpr } from '../sprites';

type Ctx = CanvasRenderingContext2D;

function ell(x: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) {
  x.fillStyle = col;
  for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
    const dy = (yy + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const hw = rx * Math.sqrt(1 - dy * dy);
    const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    if (x1 > x0) x.fillRect(x0, yy, x1 - x0, 1);
  }
}

function line(x: Ctx, x0: number, y0: number, x1: number, y1: number, col: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  x.fillStyle = col;
  for (let i = 0; i <= n; i++) {
    x.fillRect(Math.round(x0 + (x1 - x0) * (i / n)), Math.round(y0 + (y1 - y0) * (i / n)), 1, 1);
  }
}

/** Contorno de 1 px alrededor de los píxeles opacos (lectura sobre cualquier suelo). */
function outline(c: HTMLCanvasElement, x: Ctx, col: string) {
  const w = c.width, h = c.height;
  let img: ImageData | null = null;
  try { img = x.getImageData(0, 0, w, h); } catch { return; }
  if (!img || !img.data || img.data.length < w * h * 4) return;
  const d = img.data;
  const solid = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 40;
  x.fillStyle = col;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (solid(i, j)) continue;
      if (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1)) x.fillRect(i, j, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- centinela
function buildCentinela(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 6; f++) {
    const { c, x } = mkCanvas(16, 22);
    const bob = f < 4 ? [0, -1, -1, 0][f] : 0;
    const charge = f === 4, fire = f === 5;
    // sombra-anillo de piedra que flota
    ell(x, 8, 19, 5, 1.6, '#4a4c5a');
    ell(x, 8, 18.6, 4, 1, '#6a6c7c');
    px(x, 4, 18, 1, 1, '#8a8c9c'); px(x, 11, 18, 1, 1, '#8a8c9c');
    // esquirla (rombo alargado)
    const top = 2 + bob, mid = 9 + bob, bot = 16 + bob;
    for (let yy = top; yy <= bot; yy++) {
      const t = yy <= mid ? (yy - top) / (mid - top) : (bot - yy) / (bot - mid);
      const hw = Math.max(0.5, t * 4.6);
      const x0 = Math.round(8 - hw), x1 = Math.round(8 + hw);
      for (let xx = x0; xx < x1; xx++) {
        // facetas: tres bandas de tono que "giran" con el frame
        const band = ((xx - x0) + f) % 3;
        const col = fire ? (band === 0 ? '#ffffff' : '#c8f4ff')
          : charge ? (band === 0 ? '#e8fbff' : band === 1 ? '#9ee6ff' : '#5ab4e8')
          : band === 0 ? '#bdeeff' : band === 1 ? '#6cc4ec' : '#3a86c4';
        px(x, xx, yy, 1, 1, col);
      }
    }
    // arista luminosa y núcleo
    line(x, 8, top + 1, 8, bot - 1, charge || fire ? '#ffffff' : '#e2f8ff');
    const core = fire ? '#ffffff' : charge ? '#fff6b0' : f % 2 ? '#a8f0ff' : '#8ae0ff';
    ell(x, 8, mid, charge || fire ? 2.2 : 1.4, charge || fire ? 2.2 : 1.4, core);
    // grietas que brillan al cargar
    if (charge || fire) {
      px(x, 6, mid - 3, 1, 1, '#fff6b0'); px(x, 5, mid - 2, 1, 1, '#fff6b0');
      px(x, 10, mid + 2, 1, 1, '#fff6b0'); px(x, 11, mid + 3, 1, 1, '#fff6b0');
    }
    // esquirlas satélite
    const sa = f * 0.9;
    px(x, Math.round(8 + Math.cos(sa) * 6), Math.round(mid + Math.sin(sa) * 3), 1, 1, '#9ee6ff');
    px(x, Math.round(8 - Math.cos(sa) * 6), Math.round(mid - Math.sin(sa) * 3), 1, 1, '#9ee6ff');
    outline(c, x, '#121828');
    frames.push(c);
  }
  return frames;
}

// ---------------------------------------------------------------- raiz
function buildRaiz(): Frames {
  const frames: Frames = [];
  const BARK = '#5a3e26', BARK2 = '#73512f', BARKD = '#3a2616', MOSS = '#4f7a3a', EYE = '#ffb03a';
  for (let f = 0; f < 5; f++) {
    const { c, x } = mkCanvas(18, 18);
    if (f === 4) {
      // MONTÍCULO: tierra removida con grietas y un brote
      ell(x, 9, 14, 7, 3, '#5c4630');
      ell(x, 9, 13.4, 5.6, 2.2, '#73583a');
      line(x, 5, 13, 8, 15, '#3a2a1a'); line(x, 10, 12, 13, 14, '#3a2a1a');
      px(x, 9, 10, 1, 2, MOSS); px(x, 10, 9, 1, 1, '#6fa04a');
      px(x, 6, 12, 1, 1, '#8a7050'); px(x, 12, 15, 1, 1, '#8a7050');
      outline(c, x, '#1a120a');
      frames.push(c);
      continue;
    }
    const emerge = f === 2, attack = f === 3;
    const lift = emerge ? 4 : 0;
    const sway = f === 1 ? 1 : 0;
    // raíces que agarran el suelo
    line(x, 3, 16, 6, 13 + lift, BARKD); line(x, 15, 16, 12, 13 + lift, BARKD);
    line(x, 1, 15, 5, 14 + lift, BARK); line(x, 17, 15, 13, 14 + lift, BARK);
    // tronco con fauces
    for (let yy = 4 + lift; yy <= 15; yy++) {
      const hw = 3.5 + (yy - 4) * 0.12;
      const xs = Math.round(9 - hw + sway * (15 - yy) / 11), xe = Math.round(9 + hw + sway * (15 - yy) / 11);
      for (let xx = xs; xx < xe; xx++) px(x, xx, yy, 1, 1, (xx + yy) % 4 === 0 ? BARKD : xx < 8 ? BARK2 : BARK);
    }
    // fauces abiertas (más al atacar)
    const my = 9 + lift, mh = attack ? 4 : 2;
    px(x, 6 + sway, my, 6, mh, '#1a0e08');
    for (let k = 0; k < 3; k++) { px(x, 6 + sway + k * 2, my, 1, 1, '#e8dcc0'); px(x, 7 + sway + k * 2, my + mh - 1, 1, 1, '#e8dcc0'); }
    // ojos de brasa
    px(x, 6 + sway, 6 + lift, 2, 1, EYE); px(x, 10 + sway, 6 + lift, 2, 1, EYE);
    px(x, 6 + sway, 6 + lift, 1, 1, '#fff2c0');
    // ramas-brazo y hojas
    line(x, 5, 7 + lift, 2, 3 + lift - (attack ? 2 : 0), BARK);
    line(x, 13, 7 + lift, 16, 3 + lift - (attack ? 2 : 0), BARK);
    px(x, 1, 2 + lift - (attack ? 2 : 0), 2, 2, MOSS); px(x, 15, 2 + lift - (attack ? 2 : 0), 2, 2, MOSS);
    px(x, 7, 3 + lift, 4, 1, MOSS); px(x, 8, 2 + lift, 2, 1, '#6fa04a');
    // púas de raíz al atacar
    if (attack) {
      line(x, 2, 17, 0, 11, '#8a6a42'); line(x, 16, 17, 17, 11, '#8a6a42'); line(x, 9, 17, 9, 15, '#8a6a42');
    }
    if (emerge) { ell(x, 9, 16, 7, 1.5, '#73583a'); px(x, 3, 15, 2, 1, '#8a7050'); px(x, 13, 15, 2, 1, '#8a7050'); }
    outline(c, x, '#140c06');
    frames.push(c);
  }
  return frames;
}

// ---------------------------------------------------------------- ahogado
function buildAhogado(): Frames {
  const frames: Frames = [];
  const SKIN = '#9ab8a0', SKIND = '#6f8e78', COAT = '#2e4a6a', COATD = '#20344c', ALGA = '#3f6a3a', ALGA2 = '#5a8a46';
  for (let f = 0; f < 6; f++) {
    const { c, x } = mkCanvas(16, 20);
    const walk = f < 4 ? f : 0;
    const lean = f === 4 ? -1 : f === 5 ? 2 : 0;          // carga echa atrás · golpe adelante
    const step = [0, 1, 0, -1][walk];
    // charco
    x.globalAlpha = 0.45; ell(x, 8, 18.5, 5, 1.2, '#4a7a9a'); x.globalAlpha = 1;
    // piernas arrastradas
    px(x, 5, 14, 2, 4 + (step > 0 ? 0 : 0), COATD); px(x, 9, 14, 2, 4, COATD);
    px(x, 5 + (step > 0 ? 1 : 0), 17, 2, 1, '#1a1a20'); px(x, 9 - (step < 0 ? 1 : 0), 17, 2, 1, '#1a1a20');
    // casaca raída
    for (let yy = 7; yy <= 14; yy++) {
      const xs = 4 + lean * (14 - yy) / 7, xe = 12 + lean * (14 - yy) / 7;
      px(x, Math.round(xs), yy, Math.round(xe - xs), 1, yy % 3 === 0 ? COATD : COAT);
    }
    px(x, 4, 14, 1, 1, COATD); px(x, 7, 15, 1, 1, COAT); px(x, 11, 14, 1, 1, COAT); // jirones
    px(x, 7 + lean, 8, 1, 5, '#c8a050');                    // botonadura de latón
    // brazos colgando / alzados
    const armUp = f === 4 ? -3 : f === 5 ? -1 : 0;
    px(x, 3 + lean, 8 + armUp, 1, 5, SKIND); px(x, 12 + lean, 8 + armUp, 1, 5, SKIND);
    px(x, 3 + lean, 13 + armUp, 1, 1, SKIN); px(x, 12 + lean, 13 + armUp, 1, 1, SKIN);
    // cabeza hinchada y verdosa
    ell(x, 8 + lean, 4.5, 3.4, 3.2, SKIN);
    px(x, 6 + lean, 6, 4, 1, SKIND);
    // ojos sin pupila que brillan
    px(x, 6 + lean, 4, 1, 1, '#d8fff0'); px(x, 9 + lean, 4, 1, 1, '#d8fff0');
    px(x, 7 + lean, 6, 2, 1, '#2a3a30');                    // boca abierta
    // algas por pelo, cayendo
    px(x, 5 + lean, 1, 6, 1, ALGA); px(x, 4 + lean, 2, 1, 4, ALGA); px(x, 11 + lean, 2, 1, 5, ALGA2);
    px(x, 4 + lean, 6, 1, 2, ALGA2); px(x, 12 + lean, 7, 1, 2, ALGA);
    // gotas
    if (walk % 2 === 1) { px(x, 3, 15, 1, 1, '#9ad0ee'); px(x, 13, 12, 1, 1, '#9ad0ee'); }
    outline(c, x, '#0c141c');
    frames.push(c);
  }
  return frames;
}

// ---------------------------------------------------------------- madre
function buildMadre(): Frames {
  const frames: Frames = [];
  const W = 40, H = 46;
  const WOOD = '#8a5e3a', WOOD2 = '#a8764a', WOODD = '#5a3a22', CORAL = '#e0607a', CORAL2 = '#ff9aa8',
    ALGA = '#2f5a4a', ALGA2 = '#3f7a5e', ALGA3 = '#5aa080', BARN = '#cfc6b0', EYE = '#d8fff4', GOLD = '#d8b050';
  for (let f = 0; f < 5; f++) {
    const { c, x } = mkCanvas(W, H);
    const sing = f === 2, strike = f === 3, broken = f === 4;
    const sway = f === 1 ? 1 : 0;
    const bow = broken ? 3 : 0;                         // la cabeza cae al quebrarse
    // ---- proa rota del barco (base) ----
    for (let yy = 32; yy < 45; yy++) {
      const hw = 15 - (yy - 32) * 0.5;
      const x0 = Math.round(20 - hw), x1 = Math.round(20 + hw);
      px(x, x0, yy, x1 - x0, 1, (yy % 3 === 0) ? WOODD : '#6a4428');
    }
    line(x, 6, 33, 34, 33, '#3a2414');                  // regala
    for (let k = 0; k < 6; k++) px(x, 9 + k * 4, 36 + (k % 2), 2, 1, BARN);   // percebes
    px(x, 12, 40, 1, 1, CORAL); px(x, 27, 39, 2, 1, CORAL); px(x, 18, 42, 1, 1, CORAL2);
    // espuma al pie
    x.globalAlpha = 0.6; ell(x, 20, 44.5, 16, 1.4, '#d8eef8'); x.globalAlpha = 1;
    // ---- melena de algas (detrás del cuerpo) ----
    for (let k = 0; k < 9; k++) {
      const hx = 10 + k * 2.6;
      const wave = Math.round(Math.sin(k * 1.3 + f * 1.6) * 1.5);
      const len = 16 + (k % 3) * 3;
      line(x, Math.round(hx), 6 + bow, Math.round(hx + wave + (k < 4 ? -2 : 2)), 6 + len + bow, k % 2 ? ALGA : ALGA2);
      line(x, Math.round(hx) + 1, 7 + bow, Math.round(hx + wave + 1 + (k < 4 ? -2 : 2)), 5 + len + bow, ALGA3);
    }
    // ---- torso de madera tallada ----
    for (let yy = 15; yy <= 33; yy++) {
      const t = (yy - 15) / 18;
      const hw = 5 + Math.sin(t * Math.PI) * 2.2 + t * 2;
      const cx = 20 + sway * (1 - t);
      for (let xx = Math.round(cx - hw); xx < Math.round(cx + hw); xx++) {
        const grain = (xx * 3 + yy) % 7 === 0;
        px(x, xx, yy, 1, 1, grain ? WOODD : xx < cx - 1 ? WOOD2 : WOOD);
      }
    }
    // vestido tallado: pliegues y cinto dorado
    line(x, 16, 24, 15, 33, WOODD); line(x, 24, 24, 25, 33, WOODD); line(x, 20, 25, 20, 33, WOODD);
    px(x, 15, 22, 11, 1, GOLD);
    // coral creciendo sobre el pecho
    px(x, 17, 18, 2, 2, CORAL); px(x, 16, 17, 1, 1, CORAL2); px(x, 23, 19, 2, 1, CORAL);
    // ---- brazos ----
    if (sing) {
      // brazos alzados al cantar
      line(x, 14, 17, 7, 6, WOOD); line(x, 15, 17, 8, 6, WOOD2); px(x, 6, 4, 3, 3, WOOD2);
      line(x, 26, 17, 33, 6, WOOD); line(x, 25, 17, 32, 6, WOOD2); px(x, 31, 4, 3, 3, WOOD2);
    } else if (strike) {
      // embate: brazos al frente, abajo
      line(x, 14, 18, 9, 28, WOOD); line(x, 15, 18, 10, 28, WOOD2); px(x, 7, 28, 4, 3, WOOD2);
      line(x, 26, 18, 31, 28, WOOD); line(x, 25, 18, 30, 28, WOOD2); px(x, 29, 28, 4, 3, WOOD2);
    } else if (broken) {
      line(x, 14, 19, 12, 30, WOOD); line(x, 26, 19, 28, 30, WOOD);
    } else {
      // manos cruzadas sobre el pecho (mascarón clásico)
      line(x, 14, 17, 17, 23, WOOD); line(x, 26, 17, 23, 23, WOOD);
      px(x, 17, 22, 6, 2, WOOD2);
    }
    // ---- cabeza ----
    ell(x, 20 + sway, 10 + bow, 4.6, 5.2, WOOD2);
    ell(x, 21 + sway, 11 + bow, 3.2, 3.8, WOOD);
    px(x, 17 + sway, 15 + bow, 7, 1, WOODD);                         // mentón
    // ojos que lloran luz
    const eyeY = 10 + bow;
    px(x, 18 + sway, eyeY, 1, 1, EYE); px(x, 22 + sway, eyeY, 1, 1, EYE);
    if (!broken) { px(x, 18 + sway, eyeY + 1, 1, 2, '#8ae0d0'); px(x, 22 + sway, eyeY + 1, 1, 3, '#8ae0d0'); }
    // boca: cerrada / cantando
    if (sing) ell(x, 20.5 + sway, 13.5 + bow, 1.2, 1.4, '#2a160c');
    else px(x, 19 + sway, 13 + bow, 3, 1, WOODD);
    // corona de coral
    for (let k = 0; k < 5; k++) {
      const kx = 16 + k * 2 + sway;
      const kh = k === 2 ? 4 : 2 + (k % 2);
      px(x, kx, 5 + bow - kh, 1, kh, k % 2 ? CORAL2 : CORAL);
    }
    px(x, 16 + sway, 5 + bow, 9, 1, CORAL);
    // notas de canto que brotan
    if (sing) {
      px(x, 4, 2, 2, 2, '#e8fff8'); px(x, 6, 0, 1, 3, '#e8fff8');
      px(x, 34, 1, 2, 2, '#e8fff8'); px(x, 36, -1, 1, 3, '#e8fff8');
    }
    outline(c, x, '#120a06');
    frames.push(c);
  }
  return frames;
}

let built = false;
/** Registra los sprites R16 (idempotente). Llamar tras initSprites. */
export function initR16Sprites(): void {
  if (built) return;
  built = true;
  registerSpr('centinela', buildCentinela());
  registerSpr('raiz', buildRaiz());
  registerSpr('ahogado', buildAhogado());
  registerSpr('madre', buildMadre());
}
