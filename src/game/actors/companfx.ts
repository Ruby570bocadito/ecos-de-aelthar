// ============================================================
// ECOS DE AELTHAR — companfx.ts (módulo actors)
// R3-A9 · FX de Ilwen, la compañera arquera élfica (Ronda 3 · Combate y Juice)
// ------------------------------------------------------------
// CONTRATO PÚBLICO (4 exports):
//
//   drawCompanionFx(ctx, g, sx, sy)
//       Capa de FX de Ilwen: (a) aura de vínculo bajo sus pies,
//       (b) destello del arco encantado 0.15 s tras cada disparo y
//       (c) 3 glifos de flecha (fuego/hielo/rayo) orbitando su cabeza
//       en pasos discretos. PUNTO DE CONEXIÓN (render.ts, bucle de
//       entidades de drawWorld, tras drawEntity — dentro del filtro de
//       época, igual que las entidades):
//
//         for (const { e } of ents) {
//           if (e.kind === 'enemy' && !e.dead && (e.marked ?? 0) > 0)
//             drawMarkFx(ctx, sx(e.x), sy(e.y + 4), g.globalT); // anillo de suelo BAJO el enemigo
//           drawEntity(g, e, sx, sy);
//           if (e.kind === 'companion') drawCompanionFx(ctx, g, sx, sy);
//         }
//
//       (alternativa válida: drawCompanionFx justo después del bucle
//       de ents, y drawMarkFx dentro de drawCombatFx — el anillo se
//       pintaría sobre los pies del enemigo, sigue siendo legible).
//
//   companionShotFx(g, x, y, element)
//       El integrador la llama en update.ts donde Ilwen dispara (junto
//       al push del proyectil y a audio.sfx('companionShot')):
//
//         companionShotFx(g, c.x, c.y - 6, el);
//
//       Encola el destello del arco (lo pinta drawCompanionFx) y añade
//       3 motas del color del elemento a g.particles (se dispersan y
//       ascienden; size 1.5 < 3 → cuadrado normal del bucle estándar,
//       sin colisionar con la convención de chispas de fx.ts).
//       x/y en px de MUNDO (los mismos del proyectil). En «Lluvia de
//       estrellas» puede llamarse por flecha: cada llamada refresca el
//       destello del arco y añade 3 motas (efecto de ráfaga deseado).
//
//   setBondActive(b)
//       bondT de Ilwen vive en el WeakMap privado de update.ts (no
//       legible desde fuera): el integrador sincroniza el vínculo tras
//       el bloque de afinidad de updateCompanion:
//
//         setBondActive(mem.bondT > 0);
//
//       Mientras NADIE la llame, drawCompanionFx pinta una aura base
//       tenue SIEMPRE (nunca queda Ilwen sin aura); con true la aura
//       es más intensa y añade pétalos exteriores + ascensos de luz.
//
//   setArrowIndex(idx)
//       arrowIdx también vive en el WeakMap privado: el integrador lo
//       sincroniza donde incrementa mem.arrowIdx en update.ts:
//
//         setArrowIndex(mem.arrowIdx);
//
//       Mientras nadie la llame, el glifo "cargado" se deriva de
//       globalT con la cadencia real de disparo (1.5 s de atkCd), así
//       el ciclo fuego→hielo→rayo se ve correcto incluso sin integrar.
//
//   drawMarkFx(ctx, x, y, t)
//       Visual de la MARCA de Ilwen sobre el enemigo marcado
//       (Enemy.marked de types.ts). DECISIÓN DOCUMENTADA: la marca YA
//       tiene un icono sobre la cabeza (drawMarkIcon en render.ts
//       ~446-461, llamado desde drawStatusIcons) — NO se duplica.
//       drawMarkFx es el COMPLEMENTO: anillo de suelo violeta que
//       late bajo el enemigo marcado, con anillo exterior que gira en
//       pasos discretos, contrarrotación interior y pupila central con
//       brillo parpadeante (ojo estilizado en el suelo). x/y en
//       PANTALLA (ya con sx/sy aplicados); y = punto de suelo
//       (recomendado sy(e.y + 4), donde va la sombra); t = globalT.
//       Conectarlo ANTES de drawEntity del enemigo para que quede BAJO
//       el sprite (véase el snippet de arriba).
//
// REGLAS RESPECTADAS (convenciones del repo):
//   - Determinista: cero Math.random; el azar de las motas sale de
//     hash2 (world/palette, [0,0.5) → normalizado ×2) con semilla
//     secuencial por disparo → replays estables.
//   - fillRect SIEMPRE con enteros (posiciones redondeadas una vez +
//     offsets constantes; tamaños íntegros). Sin ctx.rotate: todo
//     axis-aligned, órbitas en pasos discretos por tick.
//   - Sin strings rgba dinámicas: colores hex constantes + globalAlpha
//     clampeada a [0,1] y restaurada a 1 al salir de cada función.
//   - Cero allocations en el DRAW (tablas a nivel de módulo, sin
//     literales de array/objeto en el camino de dibujo); las únicas
//     allocations son las 3 motas por DISPARO (evento, no frame).
//   - Sin emojis; comentarios en español.
// ============================================================

import type { Game } from '../engine'; // type-only: se borra en compilación, sin ciclos
import { ZOOM } from '../consts';
import { hash2 } from '../world/palette';
import { projectileColor } from './spells'; // misma paleta elemental que las flechas (R3-A5)

// ---------------- constantes ----------------

/** Duración del destello del arco encantado tras cada disparo (s). */
const BOW_DUR = 0.15;

/** Ciclo elemental de las flechas (copia local del ARROW_CYCLE de update.ts). */
const ARROW_CYCLE = ['fuego', 'hielo', 'rayo'] as const;

/** Alto del sprite de Ilwen en pantalla (16×18 px de mundo × ZOOM). */
const SPR_H = 18 * ZOOM;

/** Paso de rotación discreta de las órbitas (π/8 rad por tick). */
const ORBIT_STEP = 0.3927;

// ---------------- estado de módulo (sin WeakMaps: 1 sola compañera) ----------------

/** Vínculo activo (sincronizado por el integrador con mem.bondT > 0). */
let bondActive = false;

/** Último arrowIdx conocido (sincronizado por el integrador; -1 = derivar de globalT). */
let arrowHint = -1;

/** globalT del último disparo (sentinela muy negativa = nunca). */
let pulseT0 = -1000;

/** Elemento del último disparo (colorea el destello del arco). */
let pulseEl = 'ninguno';

/** Semilla secuencial determinista para las motas (crece por disparo). */
let shotSeed = 0;

// ---------------- utilidades ----------------

/** Alpha clampeada a [0,1] (nunca sale del rango válido). */
function setA(ctx: CanvasRenderingContext2D, a: number): void {
  ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a;
}

/** hash2 normalizado (convención del repo: el hash nativo devuelve [0,0.5)). */
function h2(a: number, b: number): number {
  return hash2(a | 0, b | 0) * 2;
}

/** Número finito o fallback (hardening contra Games falsos/NaN). */
function fin(n: unknown, fb: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fb;
}

// ============================================================
// (a) AURA DE VÍNCULO — anillo de suelo bajo los pies de Ilwen
// ============================================================

function drawBondAura(ctx: CanvasRenderingContext2D, X: number, groundY: number, gT: number): void {
  const tick = Math.floor(gT * 2); // órbita discreta (~2 pasos/s)
  const breath = Math.sin(gT * 3) * 0.5 + 0.5; // respiración de la aura

  // intensidad: base tenue SIEMPRE; con vínculo, más intensa (y más contenido)
  const a = (bondActive ? 0.26 : 0.12) + breath * (bondActive ? 0.1 : 0.05);

  // lavado elíptico interior (5×1 px de mundo a escala pantalla)
  setA(ctx, a * 0.5);
  ctx.fillStyle = '#8ef0b0';
  ctx.fillRect(X - 10, groundY - 2, 20, 4);

  // anillo de 8 bloques 2×2 en elipse (rx 14, ry 5) con brillo alternante que gira
  for (let i = 0; i < 8; i++) {
    const ang = tick * ORBIT_STEP + i * 0.7854;
    const bx = X + Math.round(Math.cos(ang) * 14);
    const by = groundY + 1 + Math.round(Math.sin(ang) * 5);
    setA(ctx, ((i + tick) & 1) === 0 ? a : a * 0.55);
    ctx.fillRect(bx - 1, by - 1, 2, 2);
  }

  if (!bondActive) return;

  // —— solo con vínculo: pétalos exteriores en contrarrotación + ascensos de luz ——
  ctx.fillStyle = '#c8f8d8';
  for (let i = 0; i < 4; i++) {
    const ang = -tick * ORBIT_STEP + i * 1.5708 + 0.3927;
    const bx = X + Math.round(Math.cos(ang) * 19);
    const by = groundY + 1 + Math.round(Math.sin(ang) * 7);
    setA(ctx, a * 0.8);
    ctx.fillRect(bx - 1, by - 1, 2, 2);
  }
  ctx.fillStyle = '#d8ffe8';
  for (let i = 0; i < 2; i++) {
    // chispa que asciende en saltos discretos y se recicla
    const rise = ((tick + i * 3) % 5) * 3;
    const sway = ((tick + i) & 1) === 0 ? -2 : 2;
    setA(ctx, a * (1 - rise * 0.14));
    ctx.fillRect(X - 6 + i * 12 + sway, groundY - 6 - rise, 1, 1);
  }
}

// ============================================================
// (c) GLIFOS DE FLECHA — 3 motivos elementales orbitando la cabeza
// ============================================================

/** Dibuja UN glifo elemental centrado en (gx,gy) — 3 rects (+1 si está cargado). */
function drawGlyph(ctx: CanvasRenderingContext2D, i: number, gx: number, gy: number, active: boolean): void {
  if (i === 0) {
    // fuego: brasa con punta cálida y base de ascuas
    ctx.fillStyle = '#ff7830';
    ctx.fillRect(gx - 1, gy - 1, 2, 2);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(gx, gy - 2, 1, 1);
    ctx.fillStyle = '#e85a20';
    ctx.fillRect(gx - 1, gy + 1, 2, 1);
    if (active) {
      ctx.fillStyle = '#fff8f0';
      ctx.fillRect(gx - 1, gy - 1, 1, 1);
    }
  } else if (i === 1) {
    // hielo: cristal en cruz con facetas claras
    ctx.fillStyle = '#a0e8ff';
    ctx.fillRect(gx - 1, gy - 1, 2, 2);
    ctx.fillRect(gx, gy - 2, 1, 1);
    ctx.fillRect(gx, gy + 2, 1, 1);
    ctx.fillStyle = '#c8f2ff';
    ctx.fillRect(gx - 2, gy, 1, 1);
    ctx.fillRect(gx + 2, gy, 1, 1);
    if (active) {
      ctx.fillStyle = '#f0fbff';
      ctx.fillRect(gx - 1, gy - 1, 1, 1);
    }
  } else {
    // rayo: mini zigzag de 3 tramos
    ctx.fillStyle = '#ffe86a';
    ctx.fillRect(gx - 1, gy - 1, 2, 1);
    ctx.fillRect(gx, gy, 2, 1);
    ctx.fillRect(gx - 1, gy + 1, 2, 1);
    if (active) {
      ctx.fillStyle = '#fff8d8';
      ctx.fillRect(gx, gy - 2, 1, 1);
    }
  }
}

function drawArrowGlyphs(ctx: CanvasRenderingContext2D, X: number, headY: number, gT: number): void {
  const tick = Math.floor(gT * 2.5); // órbita discreta (~2.5 pasos/s)
  const base = tick * 0.45;
  // glifo "cargado": el próximo del ciclo si el integrador sincroniza; si no,
  // se deriva de globalT con la cadencia real de disparo (atkCd = 1.5 s)
  const idx = arrowHint >= 0 ? ((arrowHint % 3) + 3) % 3 : Math.floor(gT / 1.5) % 3;

  for (let i = 0; i < 3; i++) {
    const ang = base + i * 2.0944;
    const gx = X + Math.round(Math.cos(ang) * 13);
    // bob determinista: ±1 px en saltos (sin rotaciones suaves)
    const gy = headY + Math.round(Math.sin(ang) * 4) + ((tick + i) & 1);
    setA(ctx, i === idx ? 1 : 0.55);
    drawGlyph(ctx, i, gx, gy, i === idx);
  }
}

// ============================================================
// (b) ARCO ENCANTADO — destello 0.15 s en la mano tras cada disparo
// ============================================================

function drawBowFlash(ctx: CanvasRenderingContext2D, X: number, feetY: number, dir: string, gT: number): void {
  const elapsed = gT - pulseT0;
  if (!(elapsed >= 0) || elapsed >= BOW_DUR) return;
  const k = 1 - elapsed / BOW_DUR; // 1 recién disparado → 0
  const spread = Math.round(k * 2); // los brazos del arco se abren al soltar

  // ancla de la mano según la dirección (centro del cuerpo = feetY - SPR_H/2)
  const dxH = dir === 'left' ? -8 : dir === 'right' ? 8 : 0;
  const dyH = dir === 'down' ? 3 : dir === 'up' ? -5 : 0;
  const hx = X + dxH;
  const hy = feetY - (SPR_H >> 1) + dyH;

  // brazos del arco (madera clara encantada) que se abren al soltar
  setA(ctx, 0.55 + 0.4 * k);
  ctx.fillStyle = '#e8c878';
  ctx.fillRect(hx - 1, hy - 10 - spread, 2, 3);
  ctx.fillRect(hx - 1, hy + 7 + spread, 2, 3);
  // empuñadura
  ctx.fillStyle = '#b89058';
  ctx.fillRect(hx - 1, hy - 2, 2, 4);
  // cuerda de luz
  setA(ctx, 0.15 + 0.35 * k);
  ctx.fillStyle = '#f0e8d0';
  ctx.fillRect(hx + (dxH >= 0 ? 1 : -2), hy - 8, 1, 16);

  // núcleo encantado del color del último elemento + destello blanco
  const col = projectileColor(pulseEl);
  setA(ctx, 0.5 * k);
  ctx.fillStyle = col;
  ctx.fillRect(hx - 2, hy - 2, 4, 4);
  setA(ctx, k);
  ctx.fillStyle = '#fff8e0';
  ctx.fillRect(hx - 1, hy - 1, 2, 2);
  // dos motas de soltura (se desprenden hacia delante)
  ctx.fillRect(hx + dxH - 1, hy - 4 + spread * 3, 1, 1);
  ctx.fillRect(hx + dxH + (dxH === 0 ? 1 : Math.sign(dxH)), hy + 3 - spread, 1, 1);
}

// ============================================================
// CONTRATO PÚBLICO
// ============================================================

/** Capa de FX de Ilwen: aura de vínculo + glifos de flecha + arco encantado.
 *  sx/sy son LAS MISMAS funciones mundo→pantalla que usa drawWorld. No dibuja
 *  nada si Ilwen no existe o está caída (downT > 0), igual que render.ts.
 *  Determinista, enteros, alpha clampeada; restaura globalAlpha a 1. */
export function drawCompanionFx(
  ctx: CanvasRenderingContext2D, g: Game, sx: (n: number) => number, sy: (n: number) => number,
): void {
  const c = g.companion;
  if (!c || (c.downT ?? 0) > 0) return;
  const gT = fin(g.globalT, 0);
  const X = Math.round(sx(fin(c.x, 0)));
  const feetY = Math.round(sy(fin(c.y, 0) + 4)); // mismo punto de suelo que la sombra de drawEntity
  drawBondAura(ctx, X, feetY, gT);
  drawArrowGlyphs(ctx, X, feetY - SPR_H + 6, gT); // centro de la cabeza (~30 px sobre el suelo)
  drawBowFlash(ctx, X, feetY, c.dir ?? 'down', gT);
  ctx.globalAlpha = 1;
}

/** Llamarla donde Ilwen dispara (update.ts, junto al push del proyectil):
 *  encola el destello del arco y añade 3 motas del color del elemento a
 *  g.particles. x/y en px de MUNDO (los mismos del proyectil creado). */
export function companionShotFx(g: Game, x: number, y: number, element: string): void {
  pulseT0 = fin(g.globalT, 0);
  pulseEl = element;
  const arr = g.particles;
  if (!arr) return; // hardening: Game falso sin partículas
  const col = projectileColor(element);
  const px = fin(x, 0);
  const py = fin(y, 0);
  const seed = shotSeed++;
  for (let i = 0; i < 3; i++) {
    const r1 = h2(seed * 17 + i * 31 + 3, i * 57 + 11);
    const r2 = h2(seed * 29 + i * 13 + 7, i * 41 + 23);
    const ang = i * 2.0944 + r1 * 1.5; // abanico de 3 motas con dispersión por hash
    const spd = 26 + r2 * 24;
    arr.push({
      x: px, y: py - 2,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd * 0.6 - 16, // dispersas y con patada ascendente mágica
      t: 0.34, maxT: 0.34,
      color: col,
      size: 1.5, // < 3 → cuadrado normal del bucle estándar (convención de fx.ts)
      grav: -22, // ascienden levemente
    });
  }
}

/** Sincroniza el vínculo (el integrador: setBondActive(mem.bondT > 0) en
 *  update.ts). Sin llamarla, drawCompanionFx pinta la aura base tenue. */
export function setBondActive(b: boolean): void {
  bondActive = !!b;
}

/** Sincroniza el ciclo de flechas (el integrador: setArrowIndex(mem.arrowIdx)
 *  donde incrementa mem.arrowIdx en update.ts). Sin llamarla se deriva de
 *  globalT con la cadencia real de disparo. Índices negativos se normalizan. */
export function setArrowIndex(idx: number): void {
  if (typeof idx === 'number' && Number.isFinite(idx)) arrowHint = Math.trunc(idx);
}

/** Anillo de suelo violeta bajo el enemigo MARCADO (complemento del icono
 *  drawMarkIcon de render.ts, que NO se duplica): late con t, anillo exterior
 *  que gira en pasos discretos, contrarrotación interior y pupila con brillo
 *  parpadeante. x/y en PANTALLA (y = punto de suelo, sy(e.y + 4)); t = globalT.
 *  Conectar ANTES de drawEntity del enemigo para que quede bajo su sprite. */
export function drawMarkFx(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const X = Math.round(fin(x, 0));
  const Y = Math.round(fin(y, 0));
  const tt = fin(t, 0);
  const pulse = Math.sin(tt * 6) * 0.5 + 0.5; // latido ~1 Hz
  const a = 0.3 + pulse * 0.26; // [0.30, 0.56]
  const tick = Math.floor(tt * 2.5); // rotación discreta del anillo

  // anillo exterior de 8 bloques 2×2 en elipse (rx 13, ry 5), brillo giratorio
  ctx.fillStyle = '#e08ad0';
  for (let i = 0; i < 8; i++) {
    const ang = tick * ORBIT_STEP + i * 0.7854;
    const bx = X + Math.round(Math.cos(ang) * 13);
    const by = Y + 1 + Math.round(Math.sin(ang) * 5);
    setA(ctx, ((i + tick) & 1) === 0 ? a : a * 0.55);
    ctx.fillRect(bx - 1, by - 1, 2, 2);
  }

  // contrarrotación interior: 4 bloques violeta oscuro (elipse rx 7, ry 3)
  ctx.fillStyle = '#8a3a9a';
  for (let i = 0; i < 4; i++) {
    const ang = -tick * ORBIT_STEP + i * 1.5708 + 0.3927;
    const bx = X + Math.round(Math.cos(ang) * 7);
    const by = Y + 1 + Math.round(Math.sin(ang) * 3);
    setA(ctx, a * 0.8);
    ctx.fillRect(bx - 1, by, 2, 1);
  }

  // pupila central (ojo estilizado en el suelo) + brillo que parpadea
  setA(ctx, a + 0.2);
  ctx.fillStyle = '#8a3a9a';
  ctx.fillRect(X - 1, Y - 1, 2, 2);
  ctx.fillStyle = '#f0c0e8';
  ctx.fillRect(X - 1 + ((tick & 1) === 0 ? 0 : 1), Y - 1, 1, 1);

  ctx.globalAlpha = 1;
}
