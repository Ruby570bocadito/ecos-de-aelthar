// ============================================================
// ECOS DE AELTHAR — CINEMÁTICAS EN EL MOTOR (R18 «La historia se mira»)
//
// Escenas cortas con el propio mundo como escenario: barras de cine,
// cámara que viaja a un punto y vuelve al Portador, subtítulos con nombre
// (texto que se escribe solo), rótulos de capítulo («ACTO II · …»),
// actores que caminan (NPCs, sombras, ecos), destellos, temblor y fundido.
//
// Mientras una escena corre, el mundo se CONGELA (enemigos, jugador) pero
// sigue vivo en lo cosmético (agua, partículas, clima, luz). Controles:
//   E / Espacio / clic → acaba la línea o pasa a la siguiente
//   ESC                → salta la escena entera
// Lo que una escena CAMBIA de verdad en la partida va en `onEnd`, que se
// ejecuta también al saltarla: saltar nunca deja la historia a medias.
// ============================================================

import type { Game } from './engine';
import type { Dir } from './types';
import { VIEW_W, VIEW_H } from './consts';
import { TILE, getSpr, entityFrame } from './sprites';
import { COL, text, textShadow, wrapText } from './ui';
import { audio } from './audio';
import { addShake, addFlash } from './fxcore';

const ZOOM = 2;

export type CutStep =
  | { k: 'cam'; x: number; y: number; dur: number }          // viaja a (tiles)
  | { k: 'camPlayer'; dur: number }                           // vuelve al Portador
  | { k: 'say'; who: string; text: string; color?: string; dur?: number }
  | { k: 'title'; text: string; sub?: string; dur: number }  // rótulo de capítulo
  | { k: 'wait'; dur: number }
  | { k: 'actor'; id: string; sprite: string; x: number; y: number; dir?: Dir; ghost?: boolean }
  | { k: 'move'; id: string; x: number; y: number; dur: number; wait?: boolean }
  | { k: 'remove'; id: string }
  | { k: 'flash'; color: string; a: number }
  | { k: 'shake'; n: number }
  | { k: 'sfx'; name: string }
  | { k: 'fade'; to: number; dur: number }                    // 0 = claro · 1 = negro
  | { k: 'run'; fn: (g: Game) => void };                      // efecto cosmético inmediato

export interface Cutscene {
  id: string;
  steps: CutStep[];
  onEnd?: (g: Game) => void;
}

interface Actor { id: string; sprite: string; x: number; y: number; dir: Dir; ghost: boolean; tx: number; ty: number; fx: number; fy: number; t: number; dur: number; anim: number }

// ---------------------------------------------------------------- estado
let cur: Cutscene | null = null;
let idx = 0;
let stepT = 0;
let bars = 0;          // 0..1 barras de cine
let fade = 0;          // 0..1 negro
let fadeFrom = 0, fadeTo = 0;
let camFromX = 0, camFromY = 0, camToX = 0, camToY = 0;
let camActive = false;
let sayWho = '', sayText = '', sayColor: string = COL.goldSoft, sayT = 0, sayDur = 0;
let titleText = '', titleSub = '', titleT = 0, titleDur = 0;
const actors = new Map<string, Actor>();
const queue: Cutscene[] = [];
let skipLatch = false;

export function cutsceneActive(): boolean { return cur !== null; }
export function cutsceneId(): string | null { return cur?.id ?? null; }

/** Pone una escena en cola (si otra está en marcha, empieza al acabar). */
export function playCutscene(g: Game, cs: Cutscene): void {
  if (cur) { if (!queue.some(q => q.id === cs.id) && cur.id !== cs.id) queue.push(cs); return; }
  cur = cs; idx = 0; stepT = 0;
  sayText = ''; titleText = '';
  camActive = false;
  actors.clear();
  const p = g.player;
  if (p) { p.attackT = 0; p.charging = false; p.moving = false; }
  g.keys.clear();
  g.mapTitleT = 0; // el rótulo de la escena manda sobre el del mapa
  enterStep(g);
}

function endCutscene(g: Game): void {
  const done = cur;
  cur = null;
  actors.clear();
  sayText = ''; titleText = '';
  camActive = false;
  fade = 0;
  g.keys.clear();
  try { done?.onEnd?.(g); } catch { /* la escena nunca rompe la partida */ }
  const next = queue.shift();
  if (next) playCutscene(g, next);
}

/** ESC: salta la escena entera (los efectos de historia de onEnd se aplican igual). */
export function skipCutscene(g: Game): void {
  if (!cur) return;
  audio.sfx('blip');
  endCutscene(g);
}

/** E / Espacio / clic: completa la línea en curso o pasa de paso. */
export function advanceCutscene(): void {
  if (!cur) return;
  const s = cur.steps[idx];
  if (!s) return;
  if (s.k === 'say') {
    const full = sayT * 42 >= sayText.length;
    if (!full) sayT = sayText.length / 42 + 0.01;
    else skipLatch = true;
  } else if (s.k === 'title' || s.k === 'wait') {
    skipLatch = true;
  }
}

function camClamp(g: Game, wx: number, wy: number): [number, number] {
  const tx = wx * ZOOM - VIEW_W / 2, ty = wy * ZOOM - VIEW_H / 2;
  const maxX = g.map.w * TILE * ZOOM - VIEW_W, maxY = g.map.h * TILE * ZOOM - VIEW_H;
  return [maxX < 0 ? maxX / 2 : Math.max(0, Math.min(maxX, tx)), maxY < 0 ? maxY / 2 : Math.max(0, Math.min(maxY, ty))];
}

function enterStep(g: Game): void {
  if (!cur) return;
  stepT = 0;
  skipLatch = false;
  const s = cur.steps[idx];
  if (!s) { endCutscene(g); return; }
  switch (s.k) {
    case 'cam': {
      camFromX = g.camX; camFromY = g.camY;
      [camToX, camToY] = camClamp(g, s.x * TILE + 8, s.y * TILE + 8);
      camActive = true;
      break;
    }
    case 'camPlayer': {
      camFromX = g.camX; camFromY = g.camY;
      const p = g.player;
      [camToX, camToY] = p ? camClamp(g, p.x, p.y) : [g.camX, g.camY];
      camActive = true;
      break;
    }
    case 'say':
      sayWho = s.who; sayText = s.text; sayColor = s.color ?? COL.goldSoft; sayT = 0;
      sayDur = s.dur ?? Math.max(2.4, 1.4 + s.text.length * 0.05);
      audio.sfx('blip');
      break;
    case 'title':
      titleText = s.text; titleSub = s.sub ?? ''; titleT = 0; titleDur = s.dur;
      audio.sfx('quest');
      break;
    case 'actor':
      actors.set(s.id, { id: s.id, sprite: s.sprite, x: s.x * TILE + 8, y: s.y * TILE + 8, dir: s.dir ?? 'down', ghost: !!s.ghost, tx: 0, ty: 0, fx: 0, fy: 0, t: 0, dur: 0, anim: 0 });
      break;
    case 'move': {
      const a = actors.get(s.id);
      if (a) {
        a.fx = a.x; a.fy = a.y; a.tx = s.x * TILE + 8; a.ty = s.y * TILE + 8; a.t = 0; a.dur = s.dur;
        const dx = a.tx - a.fx, dy = a.ty - a.fy;
        a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      }
      break;
    }
    case 'remove': actors.delete(s.id); break;
    case 'flash': addFlash(g, s.color, s.a); break;
    case 'shake': addShake(g, s.n); break;
    case 'sfx': audio.sfx(s.name); break;
    case 'fade': fadeFrom = fade; fadeTo = s.to; break;
    case 'run': try { s.fn(g); } catch { /* cosmético */ } break;
  }
}

function stepDone(s: CutStep): boolean {
  switch (s.k) {
    case 'cam': case 'camPlayer': return stepT >= s.dur;
    case 'say': return skipLatch || sayT >= sayDur;
    case 'title': return skipLatch || titleT >= titleDur;
    case 'wait': return skipLatch || stepT >= s.dur;
    case 'move': return !s.wait || stepT >= s.dur;
    case 'fade': return stepT >= s.dur;
    default: return true;
  }
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** 1×/frame desde update (en lugar del juego normal) mientras haya escena. */
export function cutsceneTick(g: Game, dt: number): void {
  // barras: entran con la escena, salen al acabar
  bars = cur ? Math.min(1, bars + dt * 2.6) : Math.max(0, bars - dt * 2.6);
  if (!cur) return;
  stepT += dt;
  const s = cur.steps[idx];
  if (s?.k === 'say') sayT += dt;
  if (s?.k === 'title') titleT += dt;
  if (s?.k === 'fade') fade = fadeFrom + (fadeTo - fadeFrom) * Math.min(1, stepT / Math.max(0.01, s.dur));
  // cámara
  if (camActive && s && (s.k === 'cam' || s.k === 'camPlayer')) {
    const k = ease(Math.min(1, stepT / Math.max(0.01, s.dur)));
    g.camX = camFromX + (camToX - camFromX) * k;
    g.camY = camFromY + (camToY - camFromY) * k;
  } else if (camActive) {
    g.camX = camToX; g.camY = camToY;
  }
  // actores
  for (const a of actors.values()) {
    if (a.dur > 0 && a.t < a.dur) {
      a.t = Math.min(a.dur, a.t + dt);
      const k = a.t / a.dur;
      a.x = a.fx + (a.tx - a.fx) * k;
      a.y = a.fy + (a.ty - a.fy) * k;
      a.anim += dt;
    }
  }
  // avance
  let guard = 0;
  while (cur && guard++ < 32) {
    const st = cur.steps[idx];
    if (!st) { endCutscene(g); return; }
    if (!stepDone(st)) break;
    idx++;
    enterStep(g);
    if (!cur) return;
    const nx = cur.steps[idx];
    if (nx && (nx.k === 'say' || nx.k === 'title' || nx.k === 'wait' || nx.k === 'cam' || nx.k === 'camPlayer' || nx.k === 'fade' || (nx.k === 'move' && nx.wait))) break;
  }
}

/** Mantiene las barras saliendo aunque ya no haya escena. */
export function cutsceneBarsTick(dt: number): void {
  if (!cur && bars > 0) bars = Math.max(0, bars - dt * 2.6);
}
export function cutsceneBars(): number { return bars; }

type Proj = (n: number) => number;
/** Actores de la escena (pase de mundo). */
export function drawCutsceneActors(ctx: CanvasRenderingContext2D, g: Game, sx: Proj, sy: Proj): void {
  if (!actors.size) return;
  for (const a of actors.values()) {
    const spr = getSpr(a.sprite);
    const moving = a.dur > 0 && a.t < a.dur;
    const fi = Math.min(entityFrame(spr, a.dir, moving, moving ? a.anim : g.globalT), spr.length - 1);
    const cv = spr[fi];
    const w = cv.width * ZOOM, h = cv.height * ZOOM;
    const dx = sx(a.x) - w / 2, dy = sy(a.y + 4) - h;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx(a.x), sy(a.y + 4), 9 * ZOOM / 2, 3 * ZOOM, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = a.ghost ? 0.45 + 0.15 * Math.sin(g.globalT * 3) : 1;
    if (a.dir === 'left') { ctx.translate(dx + w, 0); ctx.scale(-1, 1); ctx.drawImage(cv, 0, dy, w, h); }
    else ctx.drawImage(cv, dx, dy, w, h);
    ctx.restore();
  }
}

/** Barras, subtítulos, rótulos y fundido (pantalla, sobre el mundo). */
export function drawCutsceneOverlay(ctx: CanvasRenderingContext2D, g: Game): void {
  if (bars <= 0 && !cur) return;
  const bh = Math.round(58 * ease(bars));
  // fundido
  if (fade > 0) { ctx.fillStyle = `rgba(4,4,10,${fade.toFixed(3)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  // barras de cine con filete dorado
  ctx.fillStyle = '#05060c';
  ctx.fillRect(0, 0, VIEW_W, bh);
  ctx.fillRect(0, VIEW_H - bh, VIEW_W, bh);
  if (bars > 0.9) {
    ctx.fillStyle = 'rgba(240,200,74,0.28)';
    ctx.fillRect(0, bh, VIEW_W, 1);
    ctx.fillRect(0, VIEW_H - bh - 1, VIEW_W, 1);
  }
  if (!cur) return;
  const s = cur.steps[idx];
  // subtítulo
  if (s?.k === 'say' && sayText) {
    const shown = sayText.slice(0, Math.floor(sayT * 42));
    const lines = wrapText(shown, 78);
    const by = VIEW_H - bh - 18 - lines.length * 18;
    const grd = ctx.createLinearGradient(0, by - 30, 0, VIEW_H - bh);
    grd.addColorStop(0, 'rgba(4,6,12,0)');
    grd.addColorStop(1, 'rgba(4,6,12,0.7)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, by - 30, VIEW_W, VIEW_H - bh - by + 30);
    if (sayWho) textShadow(g, sayWho, VIEW_W / 2, by - 20, 11, sayColor, '#000', 'center', true);
    lines.forEach((l, i) => textShadow(g, l, VIEW_W / 2, by + i * 18, 16, COL.text, '#000', 'center'));
  }
  // rótulo de capítulo
  if (s?.k === 'title' && titleText) {
    const a = Math.min(1, titleT / 0.6) * Math.min(1, Math.max(0, (titleDur - titleT) / 0.6));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(4,4,12,0.55)';
    ctx.fillRect(0, VIEW_H / 2 - 64, VIEW_W, 128);
    textShadow(g, titleText, VIEW_W / 2, VIEW_H / 2 - 30, 22, COL.gold, '#000', 'center', true);
    const lw = 220 * Math.min(1, titleT / 1.2);
    ctx.fillStyle = 'rgba(240,200,74,0.7)';
    ctx.fillRect(VIEW_W / 2 - lw / 2, VIEW_H / 2 + 4, lw, 1);
    ctx.fillRect(VIEW_W / 2 - 2, VIEW_H / 2 + 2, 4, 4);
    if (titleSub) text(g, titleSub, VIEW_W / 2, VIEW_H / 2 + 16, 18, COL.goldSoft, 'center');
    ctx.restore();
  }
  // ayuda
  if (bars > 0.9) {
    text(g, 'E · continuar     ESC · saltar escena', VIEW_W - 16, VIEW_H - bh / 2 - 7, 12, '#7a8098', 'right');
  }
}

/** Para pruebas: suelta todo el estado. */
export function resetCutscenes(): void { cur = null; queue.length = 0; actors.clear(); bars = 0; fade = 0; }
