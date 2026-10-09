// ============================================================
// ECOS DE AELTHAR — hudfx (R3-A6 · HUD juice)
// Capa de "juice" del HUD, dibujada en espacio de VISTA (960×540)
// justo DESPUÉS de drawHud (render.ts) y antes de los overlays:
//   (a) vida baja  : borde interior rojo apagado con doble latido
//                    sin(t·4)+sin(t·8)·0.3 + micro viñeta por esquinas.
//   (b) subida nivel: destello dorado perimetral (bandas 2 px
//                    arriba/abajo con alpha triangular) + 3 anillos
//                    concéntricos desde el retrato (14,14·44) +
//                    partículas doradas que caen del panel.
//   (c) puntos sin gastar: pulso violeta en la esquina del panel
//                    + glifo '✦' con bob.
//   (d) XP ~llena  : brillo que recorre la barra de XP (sutil).
//
// CONTRATO (el integrador conecta):
//   - update.ts  → updateGame (junto a updateHorror/updateDread…):
//       updateHudFx(g, dt);            // 1×/frame, todos los estados, safe
//   - render.ts  → FINAL de drawHud (~línea 739):
//       drawHudFx(g.ctx, g);
//   - engine.ts  → gainXp (dentro del while, tras p.level++/p.points += 3):
//       notifyLevelUp(this);           // ráfagas → solo refresca (cola cap 1)
//       notifyStatPoint(this);         // opcional, encadenable
//   - Sugerencia de SFX de latido (NO se llama a audio desde aquí):
//       const pul = hudHeartbeatPulse();          // 0..1
//       if (prev < 0.92 && pul >= 0.92) audio.sfx('heartbeat');
//       prev = pul;   // cruce ascendente del pico = lub-dub (~0.785 s a
//                     // ritmo normal; audio.ts ya limita 'heartbeat' a 400 ms)
//
// Determinismo: hash2 de world/palette (devuelve [0,0.5) → se normaliza ×2
// a [0,1), convención del repo). Cero Math.random/Date.now en DRAW.
// Cero allocations por frame (pool de partículas preasignado + WeakMap de
// estado por Game, misma convención que fxcore/ui R3-A3). Safe si player
// es null. Nada bloquea el input (solo lectura + fillRect/fillText/arc).
// ============================================================

import type { Game } from '../engine';
import { VIEW_W, VIEW_H } from '../consts';
import { hash2 } from '../world/palette';
import { COL, fBody } from '../ui';

// ---------------- Constantes ----------------

const LOW_HP = 0.3;        // umbral de vida baja (borde rojo)
const LOW_HP_FAST = 0.15;  // por debajo: el latido se acelera ×1.5
const BEAT_WRAP = Math.PI * 128; // múltiplo de 2π (4·W y 8·W también) → wrap sin salto de fase

const LEVEL_FLASH_DUR = 0.8;   // duración del destello de nivel (s)
const LEVEL_ATTACK = 0.05;     // ataque del alpha triangular (s; visible ya en el frame de la subida)
const RING_STAGGER = 0.12;     // desfase entre anillos (s)
const RING_SPAN = 0.55;        // vida de cada anillo (s)
const RING_R0 = 24;            // radio inicial (retrato 44 px → radio ~22)
const RING_GROW = 40;          // expansión del radio (px)
const PORTRAIT_CX = 36;        // centro del retrato del HUD (14+44/2)
const PORTRAIT_CY = 36;

const XP_FULL = 0.92;      // "XP ~llena": brillo en la barra (14,64,210,5 de drawHud)
const XP_BAR_X = 14, XP_BAR_Y = 64, XP_BAR_W = 210, XP_BAR_H = 5;

const POINTS_GLINT_DUR = 0.55; // destello violeta de notifyStatPoint (s)

const PART_CAP = 32;           // pool fijo de partículas doradas (cero GC)
const PART_GRAV = 150;         // gravedad de las partículas (px/s²)

// R5-O8: string de font cacheado a nivel de módulo (antes: 1 string por frame
// con puntos sin gastar; fBody es pura → mismo resultado, cero alloc).
const FONT_POINTS = fBody(15);

// R5-O8: colores opacos constantes — el fade SIEMPRE va por globalAlpha
// (src-over: rgba(c,a) ≡ globalAlpha=a con fillStyle c → composite idéntico,
// sin construir strings rgba por frame).
const COL_LOW_HP = '#961418';  // rgb(150,20,24): borde de vida baja
const COL_GLINT = '#b080ff';   // rgb(176,128,255): destello violeta de puntos

// Panel del jugador (drawHud): panel(g, 8, 8, 224, 74) → x[8..232], y[8..82].
const PANEL_R = 232;       // borde derecho del panel
const PANEL_B = 82;        // borde inferior del panel

// ---------------- Estado interno (por Game, vía WeakMap) ----------------

interface HudFxState {
  beatT: number;        // reloj del latido (solo avanza con vida baja en 'play')
  flashT: number;       // restante del destello de nivel (s)
  flashQueue: number;   // cola de subidas pendientes (cap 1: varias seguidas colapsan)
  flashSeq: number;     // lote actual de partículas (incrementa por destello nuevo)
  glintT: number;       // restante del destello violeta de puntos (s)
}

const states = new WeakMap<object, HudFxState>();

/** Reloj del latido del ÚLTIMO Game actualizado (mirror para hudHeartbeatPulse). */
let beatShared = 0;

function stateFor(g: Game): HudFxState {
  let st = states.get(g);
  if (!st) {
    st = { beatT: 0, flashT: 0, flashQueue: 0, flashSeq: 0, glintT: 0 };
    states.set(g, st);
  }
  return st;
}

// ---------------- Pool de partículas doradas (preasignado) ----------------

interface Part {
  seq: number;      // lote al que pertenece (solo se pintan las del lote vivo)
  x0: number; y0: number;   // origen (borde inferior del panel del jugador)
  vx: number; vy: number;   // velocidad inicial
  ttl: number;      // vida útil
  size: number;     // 2..3 px (fillRect entero)
  gold: boolean;    // color: goldSoft claro o dorado
}

const pool: Part[] = Array.from({ length: PART_CAP }, () => ({
  seq: -1, x0: 0, y0: 0, vx: 0, vy: 0, ttl: 1, size: 2, gold: true,
}));

/** Siembra el lote `seq` de partículas — determinista (hash2, sin Math.random). */
function spawnLevelParticles(seq: number): void {
  const base = seq * 104729;
  for (let i = 0; i < PART_CAP; i++) {
    const q = pool[i];
    // hash2 ∈ [0,0.5) → ×2 (normalización de la convención del repo)
    const r1 = hash2(base + i * 17, 11) * 2;
    const r2 = hash2(base + i * 17, 23) * 2;
    const r3 = hash2(base + i * 17, 47) * 2;
    const r4 = hash2(base + i * 17, 59) * 2;
    q.seq = seq;
    q.x0 = 16 + r1 * 200;        // 16..216: a lo largo del borde inferior del panel
    q.y0 = 78 + r2 * 4;          // 78..82: pegadas al borde (PANEL_B)
    q.vx = (r3 - 0.5) * 36;      // ±18 px/s
    q.vy = -14 + r4 * 44;        // -14..30: algunas rompen hacia arriba y caen
    q.ttl = 0.42 + r1 * 0.3;     // 0.42..0.72 s (muere antes que el destello)
    q.size = r2 > 0.6 ? 3 : 2;
    q.gold = r3 > 0.5;
  }
}

/** Arranca (o reinicia) un destello de nivel con su lote de partículas. */
function startLevelFlash(st: HudFxState): void {
  st.flashT = LEVEL_FLASH_DUR;
  st.flashSeq++;
  spawnLevelParticles(st.flashSeq);
}

// ---------------- API principal ----------------

/**
 * Avanza los timers internos del HUD juice. Llamar 1×/frame desde update
 * (update.ts → updateGame), en TODOS los estados: es safe con player null,
 * dt NaN/negativo/>50 ms y no toca nada del motor (solo lectura).
 *
 * - Latido de vida baja: el reloj SOLO avanza con hp/maxHp < 0.3 en 'play'
 *   (en pausa queda congelado → ni borde animado ni picos de audio).
 *   Con hp/maxHp < 0.15 el latido se acelera ×1.5 (el borde sube el ritmo,
 *   el rango de alpha se mantiene [0.10, 0.22] según contrato).
 * - Destello de nivel: drena flashT; si quedó una subida en cola (flashQueue,
 *   capacidad 1 — varias seguidas colapsan en una) la lanza al terminar la
 *   actual con un lote de partículas nuevo.
 * - Destello violeta de puntos: drena glintT.
 */
export function updateHudFx(g: Game, dt: number): void {
  const st = stateFor(g);
  let d = dt;
  if (!(d > 0)) d = 0; // NaN/negativo → 0 (defensivo)
  else if (d > 0.05) d = 0.05;

  // --- latido de vida baja ---
  const p = g.player;
  if (p && g.state === 'play' && p.maxHp > 0 && p.hp > 0) {
    const pct = p.hp / p.maxHp;
    if (pct < LOW_HP) {
      st.beatT += d * (pct < LOW_HP_FAST ? 1.5 : 1);
      if (st.beatT > BEAT_WRAP) st.beatT -= BEAT_WRAP; // wrap continuo (sin salto de fase)
    }
  }
  beatShared = st.beatT; // mirror para hudHeartbeatPulse()

  // --- destello de nivel (+ cola de subidas pendientes) ---
  if (st.flashT > 0) {
    st.flashT -= d;
    if (st.flashT < 0) st.flashT = 0;
  }
  if (st.flashT <= 0 && st.flashQueue > 0) {
    st.flashQueue = 0;
    startLevelFlash(st); // la subida en cola recibe su destello (lote nuevo)
  }

  // --- destello violeta (puntos de atributo) ---
  if (st.glintT > 0) {
    st.glintT -= d;
    if (st.glintT < 0) st.glintT = 0;
  }
}

/**
 * Encola un destello dorado de subida de nivel. El integrador la llama desde
 * engine.ts → gainXp dentro del `while` de subidas, tras p.level++.
 *
 * Semántica con ráfagas (varios niveles en la misma llamada a gainXp):
 * la primera invocación arranca el destello (0.8 s) con su lote de
 * partículas; las siguientes SOLO REFRESCAN el temporizador (el destello
 * se mantiene continuo, sin apilarse) y dejan 1 subida en cola (cap 1) que
 * updateHudFx lanzará como un segundo destello al terminar el actual.
 */
export function notifyLevelUp(g: Game): void {
  const st = stateFor(g);
  if (st.flashT <= 0) {
    startLevelFlash(st); // inactivo → destello inmediato (visible ya en el draw de este frame)
  } else {
    st.flashT = LEVEL_FLASH_DUR; // activo → solo refresca
    st.flashQueue = 1;
  }
}

/**
 * Destello sutil violeta en el borde al ganar puntos de atributo. Opcional
 * y encadenable: llamadas seguidas refrescan el destello (no lo apilan).
 * El integrador la llama desde engine.ts → gainXp junto a `p.points += 3`.
 */
export function notifyStatPoint(g: Game): void {
  const st = stateFor(g);
  st.glintT = POINTS_GLINT_DUR;
}

/**
 * Pulso del latido de vida baja, normalizado [0,1], para que el integrador
 * dispare sfx('heartbeat') SIN que este módulo llame a audio: comparar el
 * valor con el del frame anterior y disparar en el cruce ASCENDENTE del
 * pico (p. ej. prev < 0.92 && pul >= 0.92). Es la componente rápida del
 * doble latido sin(8t): picos cada 2π/8 ≈ 0.785 s a ritmo normal (dentro
 * de ~0.7–0.9 s) y cada segundo pico coincide con el máximo del borde rojo
 * (lub-dub: fuerte-débil). Con vida < 0.15 el ritmo sube ×1.5 (~0.52 s).
 * Usa el reloj del último Game actualizado por updateHudFx (el juego corre
 * una única instancia de Game). audio.ts ya limita 'heartbeat' a 400 ms.
 */
export function hudHeartbeatPulse(): number {
  const v = 0.5 + 0.5 * Math.sin(beatShared * 8);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------- Dibujo (espacio vista 960×540, DESPUÉS del HUD) ----------------

/**
 * Dibuja el juice del HUD. PUNTO DE CONEXIÓN: final de drawHud en render.ts
 * (~línea 739): drawHudFx(g.ctx, g);
 *
 * (a) Vida baja — solo con estado 'play': borde interior rojo apagado
 *     rgba(150,20,24) de 3 px (+ línea interior de 1 px al 50 %) con doble
 *     latido sin(t·4)+sin(t·8)·0.3 mapeado a alpha [0.10, 0.22], más una
 *     micro viñeta escalonada en las 4 esquinas. El alpha solo depende del
 *     reloj interno (avanza en updateHudFx) → estable intra-frame.
 * (b) Subida de nivel — bandas doradas de 2 px arriba/abajo con alpha
 *     triangular (ataque 0.05 s, caída el resto), 3 anillos concéntricos
 *     discretos expandiéndose desde el retrato (14,14 · 44) y partículas
 *     doradas cayendo del panel del jugador (pool, movimiento analítico
 *     determinista en función de la edad del destello).
 * (c) Puntos sin gastar (p.points > 0) — pulso violeta en la esquina
 *     inferior-derecha del panel del jugador + glifo '✦' con bob.
 * (d) XP ~llena (≥ 92 %) — brillo que recorre la barra de XP (sutil).
 *
 * Cero allocations por frame; sin Math.random en DRAW; fillRect enteros
 * (Math.round); globalAlpha restaurado a 1 al salir. Safe si player es null.
 */
export function drawHudFx(ctx: CanvasRenderingContext2D, g: Game): void {
  const st = stateFor(g);
  const p = g.player;

  // --- (a) vida baja: borde interior + micro viñeta (solo en 'play') ---
  if (p && g.state === 'play' && p.maxHp > 0 && p.hp > 0) {
    const pct = p.hp / p.maxHp;
    if (pct < LOW_HP) {
      // doble latido → alpha [0.10, 0.22] (f/2.6 ∈ [-0.5, 0.5])
      const f = Math.sin(st.beatT * 4) + Math.sin(st.beatT * 8) * 0.3;
      const a = 0.10 + 0.12 * (0.5 + f / 2.6);
      if (a === a && a > 0) { // descarta NaN
        // borde interior 3 px + línea interior 1 px al 50 % (escalón pixel)
        // R5-O8: fillStyle constante + globalAlpha (≡ rgba dinámica, sin string)
        ctx.fillStyle = COL_LOW_HP;
        ctx.globalAlpha = a;
        ctx.fillRect(0, 0, VIEW_W, 3);
        ctx.fillRect(0, VIEW_H - 3, VIEW_W, 3);
        ctx.fillRect(0, 0, 3, VIEW_H);
        ctx.fillRect(VIEW_W - 3, 0, 3, VIEW_H);
        ctx.globalAlpha = a * 0.5;
        ctx.fillRect(0, 3, VIEW_W, 1);
        ctx.fillRect(0, VIEW_H - 4, VIEW_W, 1);
        ctx.fillRect(3, 0, 1, VIEW_H);
        ctx.fillRect(VIEW_W - 4, 0, 1, VIEW_H);
        // micro viñeta: 2 capas escalonadas por esquina (alpha sobre el rojo)
        ctx.globalAlpha = a * 0.38;
        ctx.fillRect(0, 0, 72, 72);
        ctx.fillRect(VIEW_W - 72, 0, 72, 72);
        ctx.fillRect(0, VIEW_H - 72, 72, 72);
        ctx.fillRect(VIEW_W - 72, VIEW_H - 72, 72, 72);
        ctx.globalAlpha = a * 0.20;
        ctx.fillRect(0, 0, 40, 40);
        ctx.fillRect(VIEW_W - 40, 0, 40, 40);
        ctx.fillRect(0, VIEW_H - 40, 40, 40);
        ctx.fillRect(VIEW_W - 40, VIEW_H - 40, 40, 40);
        ctx.globalAlpha = 1;
      }
    }
  }

  // --- (b) destello de subida de nivel ---
  if (st.flashT > 0) {
    const age = LEVEL_FLASH_DUR - st.flashT; // 0..0.8
    // envolvente triangular: ataque rápido (0.05 s, 0.55→1 para que el destello
    // se vea YA en el frame de la subida) y caída lineal hasta apagarse
    const env = age < LEVEL_ATTACK
      ? 0.55 + 0.45 * (age / LEVEL_ATTACK)
      : st.flashT / (LEVEL_FLASH_DUR - LEVEL_ATTACK);

    // bandas de 2 px arriba/abajo con alpha triangular
    ctx.globalAlpha = env * 0.85;
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(0, 0, VIEW_W, 2);
    ctx.fillRect(0, VIEW_H - 2, VIEW_W, 2);

    // 3 anillos concéntricos discretos desde el retrato (14,14 · 44)
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const local = (age - i * RING_STAGGER) / RING_SPAN;
      if (local < 0 || local >= 1) continue; // local 0 = anillo recién nacido pegado al retrato
      ctx.globalAlpha = (1 - local) * 0.55 * env;
      ctx.beginPath();
      ctx.arc(PORTRAIT_CX, PORTRAIT_CY, RING_R0 + local * RING_GROW, 0, Math.PI * 2);
      ctx.stroke();
    }

    // partículas doradas cayendo del panel del jugador (movimiento analítico)
    for (let i = 0; i < PART_CAP; i++) {
      const q = pool[i];
      if (q.seq !== st.flashSeq || age > q.ttl) continue;
      const y = q.y0 + q.vy * age + 0.5 * PART_GRAV * age * age;
      if (y > VIEW_H - 8) continue;
      const x = q.x0 + q.vx * age;
      ctx.globalAlpha = (1 - age / q.ttl) * 0.9;
      ctx.fillStyle = q.gold ? '#ffe9a0' : '#f0c84a';
      ctx.fillRect(Math.round(x), Math.round(y), q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  // --- (c) puntos de atributo sin gastar: pulso violeta + glifo ✦ ---
  if (p && p.points > 0) {
    const t = g.globalT;
    // L exterior en la esquina inferior-derecha del panel (8,8,224,74):
    // el hueco x[233..242] está libre (textos de oro/pociones empiezan en x=242)
    ctx.globalAlpha = 0.18 + 0.14 * Math.sin(t * 3.4); // 0.04..0.32, sutil
    ctx.fillStyle = COL.xp; // violeta de la paleta ('#c8a0f0')
    ctx.fillRect(PANEL_R + 1, 60, 2, PANEL_B - 60 + 1); // vertical junto al borde derecho
    ctx.fillRect(PANEL_R - 26, PANEL_B + 1, 27, 2);     // horizontal bajo el borde inferior
    // glifo '✦' con bob (bajo el bloque de textos de la derecha, zona libre)
    const bob = Math.round(Math.sin(t * 2.8)) * 2;
    ctx.font = FONT_POINTS; // R5-O8: string cacheado (antes fBody(15) por frame)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 3.4 + 1.3);
    ctx.fillStyle = 'rgba(14,10,20,0.9)';
    ctx.fillText('✦', 244, 85 + bob);
    ctx.fillStyle = COL.xp;
    ctx.fillText('✦', 244, 84 + bob);
    ctx.globalAlpha = 1;
  }

  // --- destello violeta de notifyStatPoint (borde superior/inferior) ---
  if (st.glintT > 0) {
    const a = (st.glintT / POINTS_GLINT_DUR) * 0.38; // decay 1→0, sutil
    // R5-O8: fillStyle constante + globalAlpha (≡ rgba dinámica, sin string)
    ctx.fillStyle = COL_GLINT;
    ctx.globalAlpha = a;
    ctx.fillRect(0, 0, VIEW_W, 2);
    ctx.fillRect(0, VIEW_H - 2, VIEW_W, 2);
    ctx.globalAlpha = 1;
  }

  // --- (d) XP ~llena: brillo que recorre la barra (sutil) ---
  // Player.xp frente al umbral g.xpNext(level) (mismo cálculo que drawHud);
  // si el Game no expone xpNext (stub), la sub-característica se omite sola.
  if (p && p.xp > 0 && typeof g.xpNext === 'function') {
    const need = g.xpNext(p.level);
    if (need > 0 && p.xp / need >= XP_FULL) {
      const off = ((g.globalT * 55) % (XP_BAR_W + 24)) - 12;
      const x0 = Math.max(XP_BAR_X, Math.round(XP_BAR_X + off));
      const x1 = Math.min(XP_BAR_X + XP_BAR_W, Math.round(XP_BAR_X + off + 7));
      if (x1 > x0) {
        ctx.globalAlpha = 0.28 + 0.14 * Math.sin(g.globalT * 6);
        ctx.fillStyle = '#ffe9a0';
        ctx.fillRect(x0, XP_BAR_Y, x1 - x0, XP_BAR_H);
        ctx.globalAlpha = 1;
      }
    }
  }
}
