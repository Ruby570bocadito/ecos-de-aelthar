// ============================================================
// ECOS DE AELTHAR — actors/toasts.ts
// R3-A10 · Toasts v2 (pila abajo-izquierda) + banner de mapa v2
// ------------------------------------------------------------
// Módulo de SOLO DIBUJO (Ronda 3 · Combate y Juice). NO crea
// toasts — g.toast() sigue siendo método del motor (engine.ts) —
// y NO toca estado: update.ts sigue descontando Toast.t y
// filtrando las expiradas. Todo el timing se deriva de Toast.t
// (vida armada por el motor: 3.4 s) y de g.globalT.
//
// Determinista: cero Math.random / Date.now; cero strings rgba
// dinámicas (colores constantes + globalAlpha clampeada [0,1]);
// todos los fillRect con enteros; el globalAlpha del llamador se
// respeta y se restaura al salir.
//
// CONTRATO — el integrador REEMPLAZA estos bloques de render.ts:
//   drawToastsV2(ctx, g)    → drawHud, bloque "toasts (entrada
//                             deslizante desde la derecha + fade)"
//                             (~líneas 710-726): reemplazo directo.
//   drawMapBannerV2(ctx, g) → drawWorld, bloque "banner del mapa"
//                             (~líneas 193-200): reemplazo directo.
// Ambos son seguros con entradas vacías/NaN (no pintan, no lanzan).
// ============================================================

import { VIEW_W, VIEW_H } from '../consts';
import { COL, text, textShadow, wrapText } from '../ui';
import type { Game } from '../engine';

// ---------------- utilidades ----------------

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Rombito pixel de 5 filas (1-3-5-3-1) centrado en (cx, cy). */
function diamondAt(ctx: CanvasRenderingContext2D, cx: number, cy: number, col: string, a: number): void {
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.fillRect(cx, cy - 2, 1, 1);
  ctx.fillRect(cx - 1, cy - 1, 3, 1);
  ctx.fillRect(cx - 2, cy, 5, 1);
  ctx.fillRect(cx - 1, cy + 1, 3, 1);
  ctx.fillRect(cx, cy + 2, 1, 1);
}

// ============================================================
// TOASTS V2 — pila abajo-izquierda (misma zona que el bloque
// actual: base en VIEW_H-96 apilando hacia arriba; los más
// nuevos abajo, máximo 4 visibles, el resto omitido).
//
// Panel oscuro con borde 1 px del color del toast + barra lateral
// 2 px + GLIFO clasificado por color (caen los colores exactos
// que emite engine.toast) + texto con sombra dura (textShadow).
// Entrada deslizante DESDE LA IZQUIERDA con ease-out cúbico
// (arranca fuera de pantalla: px = 12 - (tw+16)·(1-ease)) y fade
// final en el último ~0.5 s (como el bloque actual: t·2).
// ============================================================

const TOAST_LIFE = 3.4;       // vida con la que el motor arma cada toast
const TOAST_ENTER = 0.28;     // duración de la entrada deslizante
const TOAST_MAX = 4;          // visibles simultáneas
const TOAST_TEXT = 14;        // px fBody (igual que el bloque actual)
const TOAST_LINE_H = 15;      // alto de línea (igual que el bloque actual)
const TOAST_MAX_CHARS = 48;   // a partir de aquí se parte con wrapText
const TOAST_MAX_LINES = 4;    // tope de líneas por toast (el resto se omite)
const TOAST_LEFT = 12;        // x final del panel (igual que el bloque actual)
const TOAST_BASE = VIEW_H - 96;
const TOAST_MIN_W = 76;
const TOAST_MAX_W = 360;      // ancho máximo del panel
const CHAR_W = 6.4;           // ancho medio de glifo VT323 a 14 px (como hoy)
const TOAST_PAD_X = 30;       // texto: borde + barra 2px + columna de glifo + aire
const TOAST_PAD_TOP = 6;

// glifos clasificados por color (colores EXACTOS emitidos por engine.ts)
const G_QUEST = '◈';          // misión (verde COL.quest)
const G_SYS = '✦';            // sistema (cian)
const G_WARN = '!';           // peligro / error (familia roja)
const G_LOOT = '◆';           // loot / oro (COL.gold)
const G_DOT = '·';            // resto
const C_QUEST = '#8ef0b0';
const C_SYS = '#8ef0ff';
const C_LOOT = '#f0c84a';
const WARN_SET = ['#e88', '#e8a', '#ff8060', '#ff7060', '#ff5a4a'];
// sin color, la única pista de contenido fiable son los textos de misión
const QUEST_HINT = /(^Nueva misión)|(^Misión )|\d+\/\d+\)/;

function glyphFor(color: string | undefined, s: string): string {
  if (color !== undefined) {
    if (color === C_QUEST) return G_QUEST;
    if (color === C_SYS) return G_SYS;
    if (color === C_LOOT) return G_LOOT;
    for (let i = 0; i < WARN_SET.length; i++) {
      if (color === WARN_SET[i]) return G_WARN;
    }
    return G_DOT;
  }
  return QUEST_HINT.test(s) ? G_QUEST : G_DOT;
}

/**
 * Pila de toasts v2, abajo-izquierda. Solo dibuja: lee g.toasts
 * (el motor decide qué existe y cuánto le queda de vida).
 */
export function drawToastsV2(ctx: CanvasRenderingContext2D, g: Game): void {
  const toasts = g.toasts;
  const n = toasts.length;
  if (n === 0) return;
  const start = n > TOAST_MAX ? n - TOAST_MAX : 0; // solo las 4 más nuevas
  let ty = TOAST_BASE;
  for (let i = n - 1; i >= start; i--) {
    const t = toasts[i];
    // entrada: e 0→1 en TOAST_ENTER; ease-out cúbico; desliz desde la izq.
    const e = clamp01((TOAST_LIFE - t.t) / TOAST_ENTER);
    const ease = 1 - Math.pow(1 - e, 3);
    const a = clamp01(t.t * 2) * (0.35 + 0.65 * ease); // fade final último ~0.5 s

    // geometría: el texto solo se parte si excede el ancho (wrapText)
    let lines: string[] | null = null;
    let nLines = 1;
    if (t.text.length > TOAST_MAX_CHARS) {
      lines = wrapText(t.text, TOAST_MAX_CHARS);
      nLines = lines.length > TOAST_MAX_LINES ? TOAST_MAX_LINES : lines.length;
    }
    let maxLen = t.text.length;
    if (lines !== null) {
      maxLen = 0;
      for (let j = 0; j < nLines; j++) {
        if (lines[j].length > maxLen) maxLen = lines[j].length;
      }
    }
    const tw = Math.max(TOAST_MIN_W, Math.min(TOAST_MAX_W, Math.round(maxLen * CHAR_W) + TOAST_PAD_X + 8));
    const th = nLines * TOAST_LINE_H + 12;
    const px = TOAST_LEFT - Math.round((1 - ease) * (tw + 16)); // llega oculto desde fuera
    const py = ty - th + 14; // mismo anclaje que el bloque actual
    ty -= th + 6;
    if (!(a > 0.01)) continue; // expirado/NaN: consume pila sin pintar

    const col = t.color !== undefined ? t.color : COL.dim;   // borde/barra/glifo
    const tcol = t.color !== undefined ? t.color : COL.text; // texto

    ctx.globalAlpha = a;
    // panel oscuro
    ctx.fillStyle = COL.panel;
    ctx.fillRect(px, py, tw, th);
    // borde 1 px del color del toast (pixel-perfect, 4 fillRect)
    ctx.fillStyle = col;
    ctx.fillRect(px, py, tw, 1);
    ctx.fillRect(px, py + th - 1, tw, 1);
    ctx.fillRect(px, py, 1, th);
    ctx.fillRect(px + tw - 1, py, 1, th);
    // barra lateral 2 px
    ctx.fillRect(px + 1, py + 1, 2, th - 2);
    // glifo clasificado (columna propia, centrado en el alto del panel)
    text(g, glyphFor(t.color, t.text), px + 15, py + ((th - TOAST_TEXT) >> 1), TOAST_TEXT, col, 'center');
    // texto con sombra dura (textShadow: pasada #000 a +2,+2)
    const tx0 = px + TOAST_PAD_X;
    const ty0 = py + TOAST_PAD_TOP;
    if (lines !== null) {
      for (let j = 0; j < nLines; j++) {
        textShadow(g, lines[j], tx0, ty0 + j * TOAST_LINE_H, TOAST_TEXT, tcol);
      }
    } else {
      textShadow(g, t.text, tx0, ty0, TOAST_TEXT, tcol);
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// BANNER DE MAPA V2 — banda horizontal translúcida con doble
// filete + ticсorners dorados, línea ornamental pixel que se
// despliega DESDE EL CENTRO hacia las puntas (con rombo-guía en
// el centro —◆— y rombos en los extremos de las líneas) y
// destellos que la recorren. Título en fTitle (COL.goldSoft,
// sombra dura) y subtítulo en fBody (COL.dim).
//
// PROGRESIÓN por mapTitleT (regresivo: el motor lo arma a 2.5-3.2
// y lo baja a 0): ext = clamp01(mapTitleT / 3.2) es ESTRICTAMENTE
// creciente con mapTitleT → el ornamento está desplegado al
// aparecer el mapa y se recoge hacia el centro mientras el
// banner se apaga (coherente con el fade de TITLE_FADE).
// ENTRADA slide+fade por Game (WeakMap, patrón bossBarV2 de
// ui.ts): baja 28 px con ease-out cúbico y alpha 0.35→1 en 0.45 s;
// se reinicia si mapTitleT salta hacia arriba (respawn de mapa).
// ============================================================

const TITLE_REF = 3.2;    // vida máx con la que el motor arma mapTitleT (startPlay)
const TITLE_FADE = 0.6;   // desvanecido en el último tramo de vida
const TITLE_ENTER = 0.45; // duración de la entrada (slide + fade)
const BAND_W = 680;
const BAND_H = 66;
const BAND_Y = 64;
const RULE_MAX = 300;     // semi-longitud máxima de la línea ornamental

type BannerRec = { t0: number; lastT: number };
const bannerEnter = new WeakMap<object, BannerRec>();

/**
 * Banner de entrada de mapa v2. Reemplaza el par de textos
 * centrados del bloque actual por una banda ornamental completa.
 */
export function drawMapBannerV2(ctx: CanvasRenderingContext2D, g: Game): void {
  const mT = g.mapTitleT;
  if (!(mT > 0) || !g.map) return;

  // --- entrada deslizante (por Game; reset si mapTitleT sube de golpe) ---
  const now = g.globalT;
  let rec = bannerEnter.get(g);
  if (rec === undefined) {
    rec = { t0: now, lastT: mT };
    bannerEnter.set(g, rec);
  } else {
    if (mT - rec.lastT > 0.3) rec.t0 = now;
    rec.lastT = mT;
  }
  const enter = clamp01((now - rec.t0) / TITLE_ENTER);
  const ease = 1 - Math.pow(1 - enter, 3);
  const a = clamp01(mT / TITLE_FADE) * (0.35 + 0.65 * ease);
  if (!(a > 0.01)) return;
  const prev = ctx.globalAlpha;
  const A = clamp01(prev * a);

  const ext = clamp01(mT / TITLE_REF);      // estrictamente creciente con mapTitleT
  const len = Math.round(ext * RULE_MAX);
  const dy = Math.round((1 - ease) * -28);  // baja desde arriba al entrar
  const x0 = (VIEW_W - BAND_W) / 2;         // 140, entero
  const y0 = BAND_Y + dy;                   // dy entero
  const cx = VIEW_W / 2;                    // 480, entero
  const ry = y0 + 33;                       // línea ornamental entre título y subtítulo

  // banda translúcida + doble filete
  ctx.globalAlpha = clamp01(A * 0.66);
  ctx.fillStyle = '#0a0c16';
  ctx.fillRect(x0, y0, BAND_W, BAND_H);
  ctx.globalAlpha = clamp01(A * 0.9);
  ctx.fillStyle = '#8a7440';
  ctx.fillRect(x0, y0, BAND_W, 1);
  ctx.fillRect(x0, y0 + BAND_H - 1, BAND_W, 1);
  // tics dorados en las 4 esquinas
  ctx.fillStyle = COL.gold;
  ctx.fillRect(x0, y0, 6, 1);
  ctx.fillRect(x0, y0, 1, 6);
  ctx.fillRect(x0 + BAND_W - 6, y0, 6, 1);
  ctx.fillRect(x0 + BAND_W - 1, y0, 1, 6);
  ctx.fillRect(x0, y0 + BAND_H - 1, 6, 1);
  ctx.fillRect(x0, y0 + BAND_H - 6, 1, 6);
  ctx.fillRect(x0 + BAND_W - 6, y0 + BAND_H - 1, 6, 1);
  ctx.fillRect(x0 + BAND_W - 1, y0 + BAND_H - 6, 1, 6);

  // línea ornamental desde el centro (progresión por mapTitleT) + sombra 1 px
  if (len > 0) {
    ctx.globalAlpha = clamp01(A * 0.85);
    ctx.fillStyle = COL.gold;
    ctx.fillRect(cx - len, ry, len * 2, 1);
    ctx.globalAlpha = clamp01(A * 0.4);
    ctx.fillStyle = '#4a3a18';
    ctx.fillRect(cx - len, ry + 1, len * 2, 1);
    // destellos que recorren la línea (posición determinista de globalT)
    if (len >= 12) {
      const pos = (Math.floor(now * 26) * 53) % (len * 2);
      ctx.globalAlpha = clamp01(A * 0.55);
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(cx - len + pos, ry - 1, 2, 1);
      ctx.fillRect(cx + len - pos - 2, ry - 1, 2, 1);
    }
  }

  // rombos: motivo central —◆— y rombos en las puntas (extremos de las líneas)
  ctx.globalAlpha = clamp01(A * 0.9);
  ctx.fillStyle = COL.goldSoft;
  ctx.fillRect(cx - 12, ry, 8, 1);
  ctx.fillRect(cx + 5, ry, 8, 1);
  diamondAt(ctx, cx, ry, COL.goldSoft, clamp01(A));
  if (len >= 6) {
    diamondAt(ctx, cx - len, ry, COL.goldSoft, clamp01(A * 0.9));
    diamondAt(ctx, cx + len, ry, COL.goldSoft, clamp01(A * 0.9));
  }

  // título (fTitle 18, sombra dura) + subtítulo (fBody 16)
  ctx.globalAlpha = clamp01(A);
  textShadow(g, g.map.name, cx, y0 + 9, 18, COL.goldSoft, '#050810', 'center', true);
  ctx.globalAlpha = clamp01(A * 0.95);
  text(g, g.map.subtitle, cx, y0 + 44, 16, COL.dim, 'center');

  ctx.globalAlpha = prev;
}
