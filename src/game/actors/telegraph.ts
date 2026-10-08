// ============================================================
// ECOS DE AELTHAR — telegraph.ts (módulo actors)
// R3-A7 · Telegrafías v2 (Ronda 3 · Combate y Juice)
// ------------------------------------------------------------
// CONTRATO PARA EL INTEGRADOR (módulo nuevo; render.ts NO se toca aquí):
//
// 1) drawCombatFx (render.ts ~468-487) — sustituir los bloques
//    'telegrafías' y 'ondas' (los 2 círculos arc genéricos) por:
//
//      for (const t of g.telegraphs) {
//        drawTelegraphV2(ctx, t, sx(t.x), sy(t.y), g.globalT);
//      }
//      for (const w of g.waves) {
//        drawWaveCue(ctx, w, sx(w.x), sy(w.y), g.globalT);
//      }
//
//    x/y llegan YA en pantalla (sx/sy del llamador); el radio `r` de
//    TeleGraph y de Shockwave está en px de MUNDO y aquí se multiplica
//    por ZOOM (igual que hacía el círculo viejo).
//
// 2) drawEntity (render.ts ~327-329) — sustituir el '!' de TEXTO por:
//
//      if (en.kind === 'enemy' && en.ai === 'carga' && en.windup > 0) {
//        drawWindupCue(ctx, en.etype, windupFrac, sx(en.x), sy(en.y), g.globalT);
//      }
//
//    · x/y = punto de SUELO del enemigo (sx(en.x), sy(en.y)): el chevron
//      se dibuja a la MISMA altura que el '!' viejo (tabla interna de
//      alturas de sprite: groundY − zoomH·ZOOM − 24, ver HEAD_UP) y el
//      arco de progreso se pinta en el suelo, bajo los pies.
//    · FÓRMULA de la fracción (la calcula el integrador, NO este módulo):
//        windupMax = ENEMY_DEFS[en.etype].windup            (lobo 0.45 · esqueleto 0.6 · sombra 0.4)
//        si en.etype === 'guardian':
//          telegraphKind === 'onda' → windupMax = 0.9       (update.ts ~681)
//          resto                    → Math.max(0.55, ENEMY_DEFS.guardian.windup * (en.phase >= 3 ? 0.7 : 1))
//        windupFrac = clamp(1 - en.windup / windupMax, 0, 1)
//      (0 = arranca la carga, 1 = impacto inminente; fuera de rango se
//      clampea dentro, así que una estimación basta.)
//
// Qué dibuja cada pieza:
//   slam  : frontera 1px del radio REAL de daño (estable) + relleno
//           dithered que CRECE conforme t→0 (alpha ≤ 0.35: el jugador
//           siempre se ve debajo) + anillo de runas 2px que SE CIERRA
//           orbitando en pasos discretos (~125 ms) + grietas radiales
//           al final (p > 0.7) + núcleo ámbar en el último 25 %.
//           Rojo apagado #b03a30 sobre #8a3430; ámbar #e8a03a/#ffd24a.
//   aro   : doble anillo pulsante violeta #b48fff (exterior 2px con
//           órbita discreta, interior 1px contrarrotante) + marcos de
//           esquina alrededor del área. Sin relleno.
//   onda  : frente de onda con 3 arcos concéntricos de grosor
//           decreciente + polvo 1-2px en el frente (re-seed ~83 ms).
//           dmg > 0 → violeta de amenaza; dmg 0 → cian espectral tenue.
//   windup: chevron/triángulo pixel que PARPADEA acelerando conforme
//           windupFrac→1 (periodo 0.42 s → 0.08 s, crece en 3 pasos)
//           + arco de suelo bajo los pies que se llena con el progreso.
//           Colores por etype: lobo rojo #ff5040 · esqueleto ámbar
//           #f0a03a · guardián cian #7ee8ff · resto violeta #b48fff.
//
// Reglas respetadas (mismas convenciones que spells.ts / horror.ts):
//   · Determinista: cero Math.random en DRAW; el azar sale de hash2
//     (world/palette, [0,0.5) → normalizado ×2) sembrado con globalT,
//     geometría del telegraph y posición de mundo estable (t.x/t.y).
//   · fillRect SIEMPRE con enteros (centro Math.round 1 vez, offsets íntegros).
//   · Sin gradientes, sin arc/stroke: todo son cadenas de bloques pixel.
//   · Colores constantes + globalAlpha clampeada a [0,1] y restaurada
//     a 1 al salir de cada función pública.
//   · Cero allocations por frame (tablas a nivel de módulo, bucles planos).
// ============================================================

import type { Shockwave, TeleGraph } from '../types';
import { ZOOM } from '../consts';
import { hash2 } from '../world/palette';

// ---------------- utilidades ----------------

const TAU = 6.283185307179586;

/** hash2 normalizado (convención del repo: el hash nativo devuelve [0,0.5)). */
function h2(a: number, b: number): number {
  return hash2(a | 0, b | 0) * 2;
}

/** Alpha clampeada a [0,1] (nunca sale del rango válido). */
function setA(ctx: CanvasRenderingContext2D, a: number): void {
  ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a;
}

/** clamp escalar. */
function cl(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Cadena de bloques `size`×`size` sobre un círculo (n pasos, fase en rad).
 *  Todo sale entero: el offset centra el bloque en el punto del anillo. */
function ringChain(
  ctx: CanvasRenderingContext2D, X: number, Y: number,
  R: number, n: number, phase: number, size: number,
): void {
  const off = size >> 1;
  for (let i = 0; i < n; i++) {
    const a = phase + (i * TAU) / n;
    ctx.fillRect(
      X + Math.round(Math.cos(a) * R) - off,
      Y + Math.round(Math.sin(a) * R) - off,
      size, size,
    );
  }
}

/** Nº de bloques para un anillo casi continuo (paso ~2.5 px, acotado). */
function ringN(R: number): number {
  return Math.max(16, Math.min(160, Math.round((TAU * R) / 2.5)));
}

/** Relleno dithered de celdas 2×2 dentro del radio Rf (pantalla).
 *  La trama es ESTABLE por telegraph (seed = posición de mundo) y solo
 *  crece la densidad → el cierre se lee como expansión, no como ruido. */
function ditherFill(
  ctx: CanvasRenderingContext2D, X: number, Y: number,
  Rf: number, density: number, seed: number,
): void {
  const r2 = Rf * Rf;
  for (let gy = -Rf; gy < Rf; gy += 2) {
    const cy = gy + 1;
    for (let gx = -Rf; gx < Rf; gx += 2) {
      const cx = gx + 1;
      if (cx * cx + cy * cy > r2) continue;
      if (h2(seed + cx * 7 + cy * 131, seed * 3 + cy * 17 - cx * 5) >= density) continue;
      ctx.fillRect(X + gx, Y + gy, 2, 2);
    }
  }
}

// ---------------- SLAM (rojo apagado que se cierra) ----------------

const RUNE_N = 22; // runas del anillo orbital

function drawSlam(
  ctx: CanvasRenderingContext2D, t: TeleGraph,
  X: number, Y: number, R: number, gT: number,
): void {
  // p: 0 = arranca la telegrafía, 1 = impacto
  const p = cl(t.maxT > 0 ? 1 - t.t / t.maxT : 1, 0, 1);
  const seed = (t.x | 0) * 7 + (t.y | 0) * 131;

  // 1) frontera de la zona de peligro: radio REAL del daño, estable,
  //    pulsando cada vez más rápido conforme llega el golpe
  setA(ctx, 0.28 + 0.14 * Math.sin(gT * (6 + 8 * p)));
  ctx.fillStyle = '#8a3430';
  ringChain(ctx, X, Y, R, ringN(R), 0, 1);

  // 2) relleno dithered que crece (alpha ≤ 0.35: el jugador se ve debajo)
  const Rf = Math.round(R * (0.25 + 0.75 * p));
  setA(ctx, 0.3);
  ctx.fillStyle = '#b03a30';
  ditherFill(ctx, X, Y, Rf, 0.14 + 0.38 * p, seed);
  if (p >= 0.75) { // ascuas ámbar mezcladas al final
    setA(ctx, 0.32);
    ctx.fillStyle = '#e8a03a';
    ditherFill(ctx, X, Y, Math.round(Rf * 0.7), 0.12, seed + 777);
  }

  // 3) anillo de runas que SE CIERRA (orbita en pasos discretos de ~125 ms)
  const step = Math.floor(gT * 8);
  const Rr = Math.max(3, Math.round(R * (1 - 0.18 * p)));
  setA(ctx, 0.55 + 0.35 * p);
  for (let i = 0; i < RUNE_N; i++) {
    const a = (step * TAU) / (RUNE_N * 2) + (i * TAU) / RUNE_N;
    const ca = Math.cos(a), sa = Math.sin(a);
    const rr = h2(i * 13 + step * 3 + seed, seed + i * 7 - step);
    ctx.fillStyle = rr < 0.22 ? '#d8503c' : '#b03a30';
    ctx.fillRect(X + Math.round(ca * Rr) - 1, Y + Math.round(sa * Rr) - 1, 2, 2);
    if (rr > 0.55) { // runa larga: tick radial hacia fuera
      ctx.fillRect(X + Math.round(ca * (Rr + 3)) - 1, Y + Math.round(sa * (Rr + 3)) - 1, 2, 2);
    }
  }

  // 4) grietas radiales al final (p > 0.7): la energía acumulada agrieta el suelo
  if (p > 0.7) {
    const cp = (p - 0.7) / 0.3; // 0..1 dentro del tramo final
    const r0 = Math.round(R * 0.22);
    const r1 = Math.round(R * (0.22 + 0.72 * cp));
    setA(ctx, 0.4 + 0.4 * cp);
    ctx.fillStyle = '#d85848';
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + (h2(i * 31 + seed, seed + i * 17) - 0.5) * 0.5;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let r = r0; r <= r1; r += 2) {
        ctx.fillRect(X + Math.round(ca * r), Y + Math.round(sa * r), 2, 2);
      }
      if (cp > 0.85) { // punta ámbar al final del tramo
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(X + Math.round(ca * (r1 + 2)), Y + Math.round(sa * (r1 + 2)), 2, 2);
        ctx.fillStyle = '#d85848';
      }
    }
  }

  // 5) núcleo ámbar en el último 25 % (impacto inminente)
  if (p >= 0.75) {
    const pu = Math.sin(gT * 20);
    setA(ctx, 0.5 + 0.3 * pu);
    ctx.fillStyle = '#e8a03a';
    ctx.fillRect(X - 4, Y - 1, 8, 2);
    ctx.fillRect(X - 1, Y - 4, 2, 8);
    setA(ctx, 0.75 + 0.25 * pu);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(X - 1, Y - 1, 2, 2);
  }

  ctx.globalAlpha = 1;
}

// ---------------- ARO (doble anillo violeta + marcos de esquina) ----------------

const ARO_N = 26; // bloques del anillo exterior

function drawAro(
  ctx: CanvasRenderingContext2D, t: TeleGraph,
  X: number, Y: number, R: number, gT: number,
): void {
  const p = cl(t.maxT > 0 ? 1 - t.t / t.maxT : 1, 0, 1);
  const pu = Math.sin(gT * 5); // pulso del anillo
  const step = Math.floor(gT * 6); // órbita discreta (~167 ms)

  // anillo exterior 2px (violeta, pulso de radio ±1 px discreto)
  setA(ctx, cl(0.5 + 0.28 * pu + 0.15 * p, 0, 1));
  ctx.fillStyle = '#b48fff';
  ringChain(ctx, X, Y, R + (pu > 0.3 ? 1 : pu < -0.3 ? -1 : 0), ARO_N, (step * TAU) / (ARO_N * 2), 2);

  // anillo interior 1px (violeta claro, contrarrotante)
  const Ri = Math.max(3, Math.round(R * 0.62));
  const Ni = Math.max(12, Math.round(ARO_N * 0.7));
  setA(ctx, 0.38 + 0.22 * Math.sin(gT * 5 + 2.1));
  ctx.fillStyle = '#d4bcff';
  ringChain(ctx, X, Y, Ri, Ni, (-step * TAU) / Ni, 1);

  // marcos de esquina alrededor del área (brazos de 7 px)
  const B = R + 8;
  setA(ctx, 0.35 + 0.2 * pu);
  ctx.fillStyle = '#b48fff';
  ctx.fillRect(X - B, Y - B, 7, 2);         // sup-izq
  ctx.fillRect(X - B, Y - B, 2, 7);
  ctx.fillRect(X + B - 7, Y - B, 7, 2);     // sup-der
  ctx.fillRect(X + B - 2, Y - B, 2, 7);
  ctx.fillRect(X - B, Y + B - 2, 7, 2);     // inf-izq
  ctx.fillRect(X - B, Y + B - 7, 2, 7);
  ctx.fillRect(X + B - 7, Y + B - 2, 7, 2); // inf-der
  ctx.fillRect(X + B - 2, Y + B - 7, 2, 7);

  ctx.globalAlpha = 1;
}

// ---------------- CONTRATO PÚBLICO ----------------

/** Dibuja UNA telegrafía en coordenadas de PANTALLA (x,y ya con sx/sy).
 *  t.r está en px de MUNDO (se multiplica por ZOOM aquí, como el círculo
 *  viejo). Determinista, enteros, alpha clampeada; deja globalAlpha = 1. */
export function drawTelegraphV2(
  ctx: CanvasRenderingContext2D, t: TeleGraph, x: number, y: number, globalT: number,
): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  const R = Math.max(2, Math.round(t.r * ZOOM));
  if (t.kind === 'aro') {
    drawAro(ctx, t, X, Y, R, globalT);
  } else {
    drawSlam(ctx, t, X, Y, R, globalT); // 'slam' y cualquier kind futuro
  }
  ctx.globalAlpha = 1;
}

/** Onda expansiva v2: 3 arcos concéntricos de grosor decreciente + polvo
 *  en el frente. w.r/w.maxR en px de MUNDO (×ZOOM aquí).
 *  dmg > 0 → violeta de amenaza; dmg 0 → cian espectral tenue (×0.55). */
export function drawWaveCue(
  ctx: CanvasRenderingContext2D, w: Shockwave, x: number, y: number, globalT: number,
): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  const R = Math.max(2, Math.round(w.r * ZOOM));
  const u = cl(w.maxR > 0 ? w.r / w.maxR : 1, 0, 1); // 0 = nace, 1 = se disipa
  const fade = 1 - u;
  const threat = w.dmg > 0;
  const k = threat ? 1 : 0.55; // espectral = tenue
  const cMain = threat ? '#b48fff' : '#7ee8ff';
  const cMid = threat ? '#9a7ae0' : '#5ec4dc';
  const cDust = threat ? '#c8b0ff' : '#b0e4f0';

  // frente + estela: 3 arcos concéntricos de grosor decreciente
  const n1 = Math.max(12, Math.min(120, Math.round((TAU * R) / 3)));
  setA(ctx, 0.85 * fade * k);
  ctx.fillStyle = cMain;
  ringChain(ctx, X, Y, R, n1, 0, 2);
  setA(ctx, 0.42 * fade * k);
  ctx.fillStyle = cMid;
  ringChain(ctx, X, Y, Math.max(1, R - 3), Math.max(10, (n1 * 0.85) | 0), 0.5, 1);
  setA(ctx, 0.2 * fade * k);
  ringChain(ctx, X, Y, Math.max(1, R - 6), Math.max(8, (n1 * 0.6) | 0), 1.1, 1);

  // polvo levantado en el frente (píxeles 1-2 px, re-seed cada ~83 ms)
  const nd = threat ? 12 : 8;
  const dq = Math.floor(globalT * 12);
  for (let i = 0; i < nd; i++) {
    const hh = h2(dq * 17 + i * 31, i * 13 + dq);
    const a = (i * TAU) / nd + (hh - 0.5) * 0.5;
    const rad = R + 2 + Math.round(h2(dq + i * 7, i * 41 + dq * 3) * 5);
    const sz = hh < 0.4 ? 2 : 1;
    setA(ctx, (0.55 - hh * 0.35) * fade * k);
    ctx.fillStyle = cDust;
    ctx.fillRect(
      X + Math.round(Math.cos(a) * rad) - (sz >> 1),
      Y + Math.round(Math.sin(a) * rad) - (sz >> 1),
      sz, sz,
    );
  }

  ctx.globalAlpha = 1;
}

// ---------------- WINDUP (chevron + arco de suelo) ----------------

// Colores por etype: 0 lobo (rojo) · 1 esqueleto (ámbar) · 2 guardián (cian) · 3 resto (violeta)
const WIND_MAIN = ['#ff5040', '#f0a03a', '#7ee8ff', '#b48fff'];
const WIND_LITE = ['#ff9080', '#ffd24a', '#d4f6ff', '#d4bcff'];
const WIND_DARK = ['#7a2a24', '#8a5a20', '#3a7a8a', '#6a4a9a'];
// Altura del '!' viejo: groundY − zoomH·ZOOM − 24
// (sprite lobo 16 alto → 56 · humanoide 18 → 60 · guardián 44 → 112)
const HEAD_UP = [56, 60, 112, 60];

/** Filas de 2 px del chevron: ancho 12+4k → 2 (punta abajo, hacia el enemigo). */
function chevronRows(ctx: CanvasRenderingContext2D, X: number, topY: number, k: number): void {
  const rows = 4 + k;
  for (let i = 0; i < rows; i++) {
    const w = Math.max(2, 12 + k * 4 - i * 4);
    ctx.fillRect(X - (w >> 1), topY + i * 2, w, 2);
  }
}

/** Aviso de carga v2 (sustituye al '!' de texto — todo shapes, sin texto).
 *  · windupFrac = clamp(1 − windup/windupMax, 0, 1) — la calcula el
 *    llamador (fórmula por etype en la cabecera del módulo).
 *  · x,y = punto de SUELO del enemigo en pantalla (sx(e.x), sy(e.y)):
 *    el chevron flota a la altura del '!' viejo (HEAD_UP) y el arco de
 *    progreso se llena en el suelo, bajo los pies.
 *  · El parpadeo ACELERA conforme windupFrac→1 (periodo 0.42 s → 0.08 s)
 *    y el chevron crece en 3 pasos discretos (k = 0/1/2). */
export function drawWindupCue(
  ctx: CanvasRenderingContext2D, etype: string, windupFrac: number,
  x: number, y: number, globalT: number,
): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  const f = cl(windupFrac, 0, 1);
  const ci = etype === 'lobo' ? 0 : etype === 'esqueleto' ? 1 : etype === 'guardian' ? 2 : 3;

  // chevron parpadeante (más rápido cuanto más cerca del impacto)
  const period = 0.42 - 0.34 * f;
  const on = ((globalT / period) % 1) < 0.6;
  const topY = Y - HEAD_UP[ci] - 12;
  const k = f > 0.66 ? 2 : f > 0.33 ? 1 : 0;
  if (on) {
    setA(ctx, 0.62 + 0.33 * f);
    ctx.fillStyle = WIND_MAIN[ci];
    chevronRows(ctx, X, topY, k);
    ctx.fillStyle = WIND_LITE[ci]; // núcleo claro interior
    ctx.fillRect(X - 2, topY + 2, 4, 2);
    ctx.fillRect(X - 1, topY + 4, 2, 2);
  } else {
    setA(ctx, 0.12); // fantasma tenue: la posición sigue siendo legible
    ctx.fillStyle = WIND_MAIN[ci];
    chevronRows(ctx, X, topY, k);
  }

  // arco de suelo que se llena (progreso de la carga, bajo los pies)
  const AR = 14;
  const N = 12;
  const filled = Math.round(f * N);
  for (let i = 0; i < N; i++) {
    const a = Math.PI * (0.1 + (0.8 * i) / (N - 1)); // 18°..162° = mitad inferior
    const bx = X + Math.round(Math.cos(a) * AR);
    const by = Y + Math.round(Math.sin(a) * AR * 0.5) - 1; // aplastado ×0.5 (perspectiva)
    if (i < filled) {
      const head = i === filled - 1;
      setA(ctx, head ? 0.95 : 0.55);
      ctx.fillStyle = head ? WIND_LITE[ci] : WIND_MAIN[ci];
      ctx.fillRect(bx - 1, by, 2, 2);
    } else {
      setA(ctx, 0.25);
      ctx.fillStyle = WIND_DARK[ci];
      ctx.fillRect(bx, by + 1, 1, 1);
    }
  }

  ctx.globalAlpha = 1;
}
