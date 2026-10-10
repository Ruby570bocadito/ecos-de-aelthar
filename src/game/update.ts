// ============================================================
// ECOS DE AELTHAR — Update por frame
// Jugador, IA de enemigos, jefe, proyectiles, compañera, mundo
// + capa de feedback de combate (agente 8-c: embestida, chispas,
//   soplo de esquiva, estelas de proyectiles, recoil de Ilwen)
// + HIELO RESBALADIZO (Acto II, 9-a): inercia sobre tile 'i' de cumbres
//   + velocidad real del Portador (predicción de la ventisca del gólem)
//   + última salva visual al morir los jefes del Acto II
// + CRIPTA DE ZELDA (R10-3): pinchos '^' deterministas (daño + exports puras
//   para que world/stone.ts telegrafíe), palancas 'L' (E) y puerta 'D' que
//   se abre al activar TODAS las palancas del mapa (solidez dinámica vía
//   tileSolidAt — enganche documentado en el bloque R10-3 del final)
// ============================================================

import type { Game } from './engine';
import { TILE, playerMeleeDmg, BOSS_DEFEAT_FLAG } from './engine';
import type { Enemy, Dir, Element, Player, Companion } from './types';
import { ENEMY_DEFS } from './data';
import { audio, playSpellCast, playSpellImpact, playNightAmbience, playHowlDistant, playBossRoarVariant, playCryptAmbience, playInteriorAmbience, playSpikeUp } from './audio';
import { aggroMult } from './balance'; // R8-7: agro escala con el nivel del jugador
import { addShake, addFlash, requestSlowmo, applyKnockback, stepKnockback } from './fxcore';
// Ronda 2 · Terror: capas de pavor visual/audio + presentación del jefe + FX de fases
import { updateHorror } from './actors/horror';
import { updateDread, dreadInit, dreadStinger } from './actors/dread';
import { startBossIntro, updateBossIntro, bossIntroActive } from './actors/bossintro';
import { updateBossFx } from './actors/bossfx';
// Ronda 3 · Combate y Juice: HUD vivo, FX de Ilwen y audio de latido
import { updateHudFx, hudHeartbeatPulse } from './actors/hudfx';
import { companionShotFx, setBondActive, setArrowIndex } from './actors/companfx';
import { combatSparks, dodgeRing, critGlint } from './fx';
import { expansionTick, expansionDeathFx, expansionBossWatchers } from './enemies_expansion';
import { tileAt } from './maps'; // solo lectura (mapas propiedad de otro agente)
import { interaccionTick, companionOrdersMove, lureActive, sennoChase } from './interaccion'; // 16-b: órdenes tácticas + señuelo
import { perfQuality } from './perf'; // R6-V10: escalón de calidad adaptativa (0=alta · 1=media · 2=baja)
import { nightAggroMul } from './world/lighting'; // R9-2: curva suave de agresión nocturna
import { isInteriorMap } from './maps_interiores'; // R10-5: ambientes de interiores
import { SPELL_CAST_TIME, SPELL_IMPACT_TIME, SPELL_RESIDUE_TIME } from './actors/spells'; // R9-4: ventanas de FX
import { hash2 } from './world/palette'; // R10-3: hash determinista de los pinchos (módulo hoja, sin ciclos)

// R6-V10 · Calidad adaptativa (consumidor de perf.ts): multiplicador de partículas
// COSMÉTICAS según el escalón que perfFrame ya calcula (alta=×1 · media=×0.6 · baja=×0.35).
// Se aplica SOLO a chispas de proyectil, polvo y destellos decorativos de este módulo.
// El feedback de gameplay NO se recorta aquí (disolución de jefes/hitsparks viven en
// bossfx.ts/fx.ts); las brasas de 'quemado' llevan suelo 0.7 por ser feedback de estado.
const qMul = (): number => [1, 0.6, 0.35][perfQuality()];

// R9-8: ventana del aullido lejano (40 s deterministas) — dispara 1 vez por ventana
let lastHowlWin = -1;

const DIRS: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// ---------------- Estado transitorio de mecánicas (3-b) ----------------
// WeakMap/WeakSet a nivel de módulo: no persiste en el guardado y no
// ensucia types.ts (contrato).

/** Ciclo elemental de las flechas de Ilwen (biblia: fuego → hielo → rayo). */
const ARROW_CYCLE: Element[] = ['fuego', 'hielo', 'rayo'];

/** Memoria transitoria de Ilwen por compañero: cds de técnica/marca, ciclo de flechas y vínculo. */
interface IlwenMem { rainCd: number; markCd: number; arrowIdx: number; bondT: number }
const ilwenMem = new WeakMap<Companion, IlwenMem>();

/** REMATE: bonus único por periodo de quebrado/aturdimiento por enemigo. */
const finisherUsed = new WeakSet<Enemy>();
const wasAturdido = new WeakMap<Enemy, boolean>();

/** Detección de golpe recién liberado (empuje cargado y remate). */
const lastAttackT = new WeakMap<Player, number>();

/** Pulso previo del latido de vida baja (Ronda 3): dispara sfx en el cruce ascendente. */
let prevHeartbeat = 0;

// ---------------- R8 · IA v2 (1.2 steering anti-atasco · 2.5 espaciado) ----------------
// Token de ATAQUE por frame (EPIC 2.5, O(n) total, cero allocs): de todos los
// aggro vivos no-jefe, SOLO el más cercano al Portador tiene derecho de
// aproximación; el resto orbita lateralmente (no amontonarse). El token se
// recalcula 1×/frame en updateGame y lo lee updateEnemy.
let tokenRef: Enemy | null = null; // atacante con token este frame
let tokenD2 = Infinity;            // su distancia² al Portador (con histéresis)
let prevToken: Enemy | null = null; // histéresis: el token actual solo se cede a un reto ≥15% más cerca

// ---------------- HIELO RESBALADIZO (Acto II, 9-a) ----------------
// Sobre el lago helado de las Cumbres (tile 'i') el Portador conserva la
// inercia: aceleración reducida al moverse y deslizamiento con decaimiento
// suave al soltar. Memoria por Portador (WeakMap, no persiste).
interface IceMem { vx: number; vy: number }
const iceMem = new WeakMap<Player, IceMem>();

/** Velocidad real del Portador del último frame de juego (px/s). Mide el
 *  desplazamiento total (caminar, rodar, deslizarse, retroceso) y sirve
 *  a la ventisca del gólem (enemies_expansion → getPortadorVel) para
 *  telegrafiar su posición FUTURA. Teleportes (saltos grandes) → 0. */
let plLastX = 0, plLastY = 0, plLastOk = false, plVX = 0, plVY = 0;
// R5-O10: objeto reutilizado (cero alloc por llamada). Los lectores actuales
// (ventisca/salto/balada del gólem en enemies_expansion) consumen x/y al
// momento; si un lector futuro RETUVIERA la referencia debe copiarla antes.
const portadorVel = { x: 0, y: 0 };
export function getPortadorVel(): { x: number; y: number } {
  portadorVel.x = plVX;
  portadorVel.y = plVY;
  return portadorVel;
}

// R5-O10: sqrt en vez de Math.hypot (más rápido; equivalente a escala de juego)
function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** R5-O10: distancia al cuadrado — evita sqrt/hypot en comparaciones. */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

// ---------------- GRID ESPACIAL (R5-O10) ----------------
// Rejilla uniforme de celdas de 64 px para las consultas "enemigos cercanos"
// de las colisiones de proyectiles (antes O(proyectiles × enemigos) por frame).
// Se reconstruye UNA vez por frame, justo antes del bucle de proyectiles, con
// las posiciones ya actualizadas del frame. Con población pequeña (<12 enemigos)
// no se construye y las colisiones usan el barrido directo (más barato).
// Cero allocaciones en régimen: celdas y array de candidatos se reutilizan.
const GRID_CELL = 64;
const GRID_MIN = 12;                            // población mínima para usar la rejilla
const gridCells = new Map<number, number[]>();  // clave cx·65536+cy → índices en g.enemies
let gridArr: Enemy[] | null = null;             // identidad del array indexado (validez)
let gridMapId = '';                             // mapa indexado
let gridN = 0;                                  // nº de enemigos al construir
let gridMaxHalfW = 0;                           // mayor semiancho indexado (expansión de consulta)
const gridScratch: number[] = [];               // candidatos de la consulta en curso
const rainTargets: Enemy[] = [];                // R5-O10: objetivos de Lluvia de estrellas (reutilizado)
let curNightMult = 1;                           // R5-O10: isNight memoizado 1×/frame (no cambia dentro del frame)

/** Reconstruye la rejilla con los enemigos vivos (1×/frame). */
function gridRebuild(g: Game): void {
  for (const cell of gridCells.values()) cell.length = 0;
  gridArr = g.enemies;
  gridMapId = g.mapId;
  gridN = g.enemies.length;
  gridMaxHalfW = 0;
  if (gridN < GRID_MIN) return; // población pequeña: camino directo
  for (let i = 0; i < gridN; i++) {
    const e = g.enemies[i];
    if (e.dead) continue;
    const hw = e.w * 0.5;
    if (hw > gridMaxHalfW) gridMaxHalfW = hw;
    const key = Math.floor(e.x / GRID_CELL) * 65536 + Math.floor(e.y / GRID_CELL);
    let cell = gridCells.get(key);
    if (cell === undefined) { cell = []; gridCells.set(key, cell); }
    cell.push(i);
  }
}

/** Candidatos cercanos (índices en g.enemies) o null si la rejilla no aplica
 *  (población pequeña, mapa cambiado o array sustituido a mitad de frame → el
 *  llamador cae al barrido directo, siempre correcto). `r` es el radio MÁXIMO
 *  de la prueba del llamador: la consulta se expande con el mayor semiancho
 *  indexado para no excluir nunca un candidato válido (cero falsos negativos). */
function gridQuery(g: Game, x: number, y: number, r: number): number[] | null {
  if (gridN < GRID_MIN || gridArr !== g.enemies || gridMapId !== g.mapId) return null;
  const rr = r + gridMaxHalfW;
  gridScratch.length = 0;
  const cx0 = Math.floor((x - rr) / GRID_CELL), cx1 = Math.floor((x + rr) / GRID_CELL);
  const cy0 = Math.floor((y - rr) / GRID_CELL), cy1 = Math.floor((y + rr) / GRID_CELL);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const cell = gridCells.get(cx * 65536 + cy);
      if (cell === undefined) continue;
      for (let k = 0; k < cell.length; k++) gridScratch.push(cell[k]);
    }
  }
  return gridScratch;
}

/** Tipos de enemigo del Acto II con cerebro propio en enemies_expansion.ts. */
const EXPANSION_TYPES = new Set<string>(['neumo', 'espectro', 'arpi', 'sirena', 'golem', 'vult', 'coro', 'ecodesg', 'satiro']); // 14-a: +4 tipos

// ---------------- FX de impacto (agente 8-c) ----------------
// Detección de golpes conectados SIN tocar engine.ts: damageEnemy sube
// e.hitFlash a 0.12 al conectar (mismo patrón de borde ascendente que usa
// enemies_expansion.commonTick). Todo sale por combatSparks/critGlint (fx.ts).
const fxHitSeen = new WeakMap<Enemy, number>();
/** Impactos que ya sueltan FX propio (proyectiles, REMATE): token de frame. */
const fxOwnFx = new WeakMap<Enemy, number>();
let fxF = 0;

/** Color de chispa según el contexto: arma del Portador (acero/dorado
 *  cargado) o elemento del golpe si viene de habilidad. */
function sparkColorFor(p: Player, e: Enemy): string {
  if (p.attackT > 0) return p.chargedHit ? '#ffe86a' : '#f5f2ea';
  if (e.statuses.some(s => s.kind === 'quemado')) return '#ff9040';
  if (e.statuses.some(s => s.kind === 'congelado')) return '#a0e8ff';
  return '#e8e2d4';
}

/** Escanea enemigos buscando golpes recién conectados y suelta chispas
 *  direccionales opuestas al swing (+ destello dorado si fue crítico:
 *  el motor fija hitStop 0.09 en crítico frente a 0.04 normal).
 *  Debe correr ANTES del bucle de enemigos (hitFlash aún sin decaer). */
function updateCombatFx(g: Game): void {
  fxF++;
  const p = g.player;
  if (!p) return;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const seen = fxHitSeen.get(e) ?? 0;
    fxHitSeen.set(e, e.hitFlash);
    if (e.hitFlash <= seen + 5e-4 || e.hitFlash <= 0.06) continue; // no es golpe nuevo
    if (fxF - (fxOwnFx.get(e) ?? -99) <= 2) continue;              // ya tiene chispas propias
    // rebote del impacto: chispas en dirección opuesta al swing
    combatSparks(g, e.x, e.y - 4, p.x - e.x, p.y - e.y, sparkColorFor(p, e), 5, 70);
    if (g.hitStop > 0.05) critGlint(g, e.x, e.y - 6);
  }
}

export function updateGame(g: Game, dt: number) {
  // cosmética siempre
  if (g.state === 'dialogue' && g.dlgNode) g.dlgCharT += dt * 45;
  g.mapTitleT = Math.max(0, g.mapTitleT - dt);
  g.epochFx = Math.max(0, g.epochFx - dt);
  g.shake = Math.max(0, g.shake - dt * 22);
  // R5-O10: compactación in place — mismo filtrado y mismo orden, cero arrays
  // nuevos por frame (antes .filter() alocaba 3 arrays por frame aquí)
  let alive = 0;
  const toasts = g.toasts;
  for (let i = 0; i < toasts.length; i++) { const t = toasts[i]; t.t -= dt; if (t.t > 0) toasts[alive++] = t; }
  toasts.length = alive;
  alive = 0;
  const floats = g.floats;
  for (let i = 0; i < floats.length; i++) { const f = floats[i]; f.t -= dt; f.y += f.vy * dt; if (f.t > 0) floats[alive++] = f; }
  floats.length = alive;
  alive = 0;
  const parts = g.particles;
  for (let i = 0; i < parts.length; i++) { const pt = parts[i]; pt.t -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += pt.grav * dt; if (pt.t > 0) parts[alive++] = pt; }
  parts.length = alive;
  // terror v2 (Ronda 2) + HUD vivo (Ronda 3): corren en TODOS los estados
  updateHorror(g, dt);
  updateDread(g, dt);
  updateBossIntro(g, dt);
  updateBossFx(g, dt);
  updateHudFx(g, dt);
  // latido de vida baja (Ronda 3): suena en el cruce ascendente del pulso
  const hbNow = hudHeartbeatPulse();
  if (g.player && g.state === 'play' && g.player.hp / g.player.maxHp < 0.3 && prevHeartbeat < 0.92 && hbNow >= 0.92) {
    audio.sfx('heartbeat');
  }
  prevHeartbeat = hbNow;
  if (g.state !== 'play') { g.updateCamera(); return; }

  const p = g.player;
  if (!p) return;
  p.playTime += dt;
  g.dayT = (g.dayT + dt / 240) % 1;
  if (p.buffT) { p.buffT -= dt; if (p.buffT <= 0) p.buffT = undefined; }

  // ---------------- fades y transición de mapa ----------------
  // enfriamiento de salidas: tras cargar un mapa se ignoran sus zonas de
  // salida un instante (defensa extra anti-bucle de teletransporte)
  if (g.exitCd > 0) g.exitCd -= dt;
  if (g.fadeDir !== 0) {
    g.fadeT += g.fadeDir * dt * 2.4;
    if (g.fadeT >= 1 && g.fadeDir > 0) {
      g.fadeT = 1;
      if (g.pendingMap) {
        const { to, tx, ty } = g.pendingMap;
        g.pendingMap = null;
        g.loadMap(to, tx, ty);
        audio.playTrack(g.map.music);
        g.save();
        g.toast('Autoguardado', '#8ef0ff');
      }
      g.fadeDir = -1;
    }
    if (g.fadeT <= 0 && g.fadeDir < 0) { g.fadeT = 0; g.fadeDir = 0; }
    if (g.fadeDir !== 0) { g.updateCamera(); return; }
  }

  // ---------------- input del jugador ----------------
  const k = g.keys;
  let mx = 0, my = 0;
  if (k.has('a') || k.has('arrowleft')) mx -= 1;
  if (k.has('d') || k.has('arrowright')) mx += 1;
  if (k.has('w') || k.has('arrowup')) my -= 1;
  if (k.has('s') || k.has('arrowdown')) my += 1;
  const mlen = Math.hypot(mx, my) || 1;

  p.sta = Math.min(p.maxSta, p.sta + (p.rollT > 0 ? 0 : 26) * dt);
  // R16 (#25 QA): el Tejedor de Ecos «respira» resonancia (+2/s, hasta 50):
  // antes arrancaba a 0 y no podía lanzar NINGÚN canto sin pegar antes en
  // melé — el mago tenía que hacer de guerrero para poder ser mago.
  if (p.discipline === 'tejedor' && p.res < 50) p.res = Math.min(50, p.res + 2 * dt);
  if (p.iframes > 0) p.iframes -= dt;
  if (p.parryT > 0) p.parryT -= dt;
  if (p.parryFx > 0) p.parryFx -= dt;
  if (p.lastHitT > 0) p.lastHitT -= dt;
  for (let i = 0; i < p.cds.length; i++) if (p.cds[i] > 0) p.cds[i] -= dt;

  // knockback suave del jugador (ondas del jefe, slams) — contrato fxcore
  stepKnockback(g, p, dt);

  // carga de ataque
  if (p.charging) {
    p.chargeT += dt;
    // R6-V10: chispa de carga = cosmética → probabilidad × calidad
    if (p.chargeT > 0.35 && Math.random() < 0.4 * qMul()) {
      g.particles.push({ x: p.x + (Math.random() - 0.5) * 14, y: p.y - 10, vx: 0, vy: -30, t: 0.3, maxT: 0.3, color: '#ffe86a', size: 1.5, grav: 0 });
    }
  }

  if (p.rollT > 0) {
    // rodar
    p.rollT -= dt;
    const rd = (p as unknown as { rollDir?: Dir }).rollDir ?? p.dir;
    const [rx, ry] = DIRS[rd];
    const spd = 168;
    g.moveEntity(p, rx * spd * dt, ry * spd * dt);
    p.moving = true;
    p.anim += dt * 1.4;
    // R6-V10: polvo del rollo = cosmético → probabilidad × calidad
    if (Math.random() < 0.5 * qMul()) g.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0.25, maxT: 0.25, color: '#d8dce4', size: 2, grav: 0 });
  } else if (p.attackT > 0) {
    p.attackT -= dt;
    p.moving = false;
    p.anim += dt;
  } else {
    // HIELO RESBALADIZO (Acto II, 9-a): caminar sobre el lago helado de las
    // Cumbres (tile 'i') conserva la INERCIA. Fuera de hielo, control normal
    // 1:1 (intacto). Nunca aplica con voltereta (otra rama) ni knockback.
    const im = iceMem.get(p) ?? { vx: 0, vy: 0 };
    iceMem.set(p, im);
    const kbActive = (p.kbVx ?? 0) !== 0 || (p.kbVy ?? 0) !== 0;
    const onIce = !kbActive &&
      tileAt(g.map, g.rows, Math.floor(p.x / TILE), Math.floor((p.y + p.h / 2) / TILE), g.epoch) === 'i';
    const spd = 74;
    if (onIce) {
      if (mx !== 0 || my !== 0) {
        // al pisar hielo con velocidad, se parte de la inercia real del frame anterior
        if (im.vx === 0 && im.vy === 0) { im.vx = plVX; im.vy = plVY; }
        // aceleración reducida (×0.55): la velocidad persigue la objetivo más despacio
        const k = 1 - Math.pow(0.55, dt * 60);
        im.vx += ((mx / mlen) * spd - im.vx) * k;
        im.vy += ((my / mlen) * spd - im.vy) * k;
      } else {
        // sin input: conserva la última velocidad con decaimiento 0.90^(dt·60)
        // hasta bajar de 5 px/s (deslizamiento suave, no frenazo seco)
        const dec = Math.pow(0.9, dt * 60);
        im.vx *= dec;
        im.vy *= dec;
        if (im.vx * im.vx + im.vy * im.vy < 25) { im.vx = 0; im.vy = 0; }
      }
      if (im.vx !== 0 || im.vy !== 0) {
        g.moveEntity(p, im.vx * dt, im.vy * dt);
        p.moving = true;
        p.anim += dt * ((mx !== 0 || my !== 0) ? 1 : 0.7); // derrapa sin input
        if ((mx !== 0 || my !== 0) && (!p.charging || p.chargeT < 0.2)) {
          if (Math.abs(mx) > Math.abs(my)) p.dir = mx > 0 ? 'right' : 'left';
          else p.dir = my > 0 ? 'down' : 'up';
        }
      } else {
        p.moving = false;
        p.anim += dt * 0.4;
      }
    } else {
      // control normal (tiles no helados): la memoria de hielo se resetea
      im.vx = 0;
      im.vy = 0;
      if (mx !== 0 || my !== 0) {
        g.moveEntity(p, (mx / mlen) * spd * dt, (my / mlen) * spd * dt);
        p.moving = true;
        p.anim += dt;
        if (!p.charging || p.chargeT < 0.2) {
          if (Math.abs(mx) > Math.abs(my)) p.dir = mx > 0 ? 'right' : 'left';
          else p.dir = my > 0 ? 'down' : 'up';
        }
      } else {
        p.moving = false;
        p.anim += dt * 0.4;
      }
    }
  }

  // velocidad real del Portador (9-a): desplazamiento de este frame / dt.
  // La usan la inercia del hielo (semilla al pisarlo) y la ventisca del
  // gólem (getPortadorVel). Saltos de teleporte (>160 px) → velocidad 0.
  if (plLastOk) {
    const ddx = p.x - plLastX, ddy = p.y - plLastY;
    if (ddx * ddx + ddy * ddy < 160 * 160) {
      plVX = ddx / Math.max(1e-4, dt);
      plVY = ddy / Math.max(1e-4, dt);
      const v2 = plVX * plVX + plVY * plVY;
      if (v2 > 240 * 240) { const vm = Math.sqrt(v2); plVX *= 240 / vm; plVY *= 240 / vm; } // tope (rodar+retroceso; R5-O10: sqrt solo en la rama rara)
    } else { plVX = 0; plVY = 0; }
  }
  plLastX = p.x; plLastY = p.y; plLastOk = true;

  // ---------------- CRIPTA (R10-3): pinchos '^' bajo los pies del Portador ----------------
  // Tras medir la velocidad real: el knockback "hacia atrás del último
  // movimiento" usa plVX/plVY JUSTO cuando acaban de medir este frame.
  updateCryptSpikes(g);

  // ---------------- ventana de combo · golpe recién liberado · REMATE ----------------
  // FX de impacto (8-c): detecta golpes conectados el frame anterior
  // (input/parcelas) y suelta chispas; antes del bucle de enemigos.
  updateCombatFx(g);

  const prevAttackT = lastAttackT.get(p) ?? 0;
  const attackStarted = p.attackT > 0 && prevAttackT <= 0;
  lastAttackT.set(p, p.attackT);
  // p.chargedHit es del motor (la usa render para el arco cargado); se limpia al
  // terminar el golpe para que el siguiente ataque no herede el flag.
  if (p.attackT <= 0 && p.chargedHit) p.chargedHit = false;

  // ventana de combo: se mantiene mientras encadenas; al caducar el combo se reinicia
  if (p.attackT > 0) {
    p.comboT = 1.2;
  } else if ((p.comboT ?? 0) > 0) {
    p.comboT = (p.comboT ?? 0) - dt;
    if ((p.comboT ?? 0) <= 0) { p.comboT = 0; p.combo = 0; }
  }

  if (attackStarted) {
    // EMBESTIDA (8-c): el peso del tajo empuja al Portador un paso en su
    // dirección. applyKnockback + stepKnockback (ya en marcha, línea 100)
    // mueven con g.moveEntity → respeta tiles; fuerza suave que decae sola.
    if (p.rollT <= 0) {
      const [lgx, lgy] = DIRS[p.dir];
      applyKnockback(p, lgx, lgy, p.chargedHit ? 88 : 62);
    }
    // impacto cargado: onda de empuje frontal (el peso del Portador)
    if (p.chargedHit) {
      const [fdx, fdy] = DIRS[p.dir];
      const cx2 = p.x + fdx * 20, cy2 = p.y + fdy * 20;
      for (const e of g.enemies) {
        if (e.dead) continue;
        // R5-O10: comparación con distancia al cuadrado (evento raro, barrido directo)
        const thr = 36 + e.w * 0.5;
        const ddx = e.x - cx2, ddy = e.y - cy2;
        if (ddx * ddx + ddy * ddy < thr * thr) {
          applyKnockback(e, e.x - p.x, e.y - p.y, 200);
        }
      }
    }
    // REMATE: enemigo quebrado cerca + golpe recién liberado → bonus único por quebrado
    for (const e of g.enemies) {
      if (e.dead || e.ai !== 'aturdido' || e.maxSta <= 0) continue;
      if (finisherUsed.has(e)) continue;
      if (dist2(p.x, p.y, e.x, e.y) < 30 * 30) {
        finisherUsed.add(e);
        const [rdx, rdy] = DIRS[p.dir];
        g.damageEnemy(e, playerMeleeDmg(p) * 0.6, 'ninguno', 90, rdx, rdy);
        // chispas del REMATE (8-c): doradas, opuestas al swing; marcado para
        // que updateCombatFx no las duplique al ver el hitFlash subir
        fxOwnFx.set(e, fxF);
        combatSparks(g, e.x, e.y - 4, -rdx, -rdy, '#ffe86a', 6, 90);
        critGlint(g, e.x, e.y - 6);
        g.floatAt(e.x, e.y - 26, '¡REMATE!', '#ffe86a', 12);
        addShake(g, 4);
        requestSlowmo(g, 0.2);
        p.res = Math.min(p.maxRes, p.res + 15);
        // sfx 'break' es nuevo del contrato (lo añade 3-a); audio.sfx no tiene
        // default: nombre desconocido = no-op seguro.
        audio.sfx('break');
        break;
      }
    }
  }

  // esquiva (detección de borde: la pulsación se pone en cola en keydown;
  // mantener Espacio ya no encadena volteretas con invulnerabilidad continua)
  if (g.rollQueued) {
    // ==== 17-a (qa-combate) ==== la esquiva en cola se CONSUME SIEMPRE
    // (1 pulsación = 1 intento). Antes la cola era eterna: si otra acción
    // (parada −12, golpe cargado −8/−18) gastaba Aguante entre la pulsación y
    // el frame, la voltereta no salía pero la cola sobrevivía y el roll
    // saltaba SOLO, segundos después, al reponer 20 de Aguante.
    const puedeRodar = p.rollT <= 0 && p.attackT <= 0 && p.sta >= 20;
    g.rollQueued = false;
    if (puedeRodar) {
      p.rollT = 0.3;
      p.iframes = 0.34;
      p.sta -= 20;
      let rd: Dir = p.dir;
      if (mx !== 0 || my !== 0) rd = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
      (p as unknown as { rollDir?: Dir }).rollDir = rd;
      // soplo de esquiva (8-c): anillo de partículas que se abre con la voltereta
      dodgeRing(g, p.x, p.y);
      audio.sfx('dodge');
    }
  }

  // impacto del ataque (instantáneo en la liberación, ver releaseCharge)

  // ---------------- recoger oro perdido ----------------
  for (let i = g.deadGolds.length - 1; i >= 0; i--) {
    const dgl = g.deadGolds[i];
    if (dgl.map !== g.mapId) continue;
    if (dist2(p.x, p.y, dgl.x, dgl.y) < 14 * 14) {
      p.gold += dgl.amount;
      g.deadGolds.splice(i, 1);
      audio.sfx('coin');
      g.floatAt(dgl.x, dgl.y - 10, `+${dgl.amount}`, '#f0c84a');
      g.toast(`Recuperas tu eco de oro (+${dgl.amount})`, '#f0c84a');
    }
  }

  // ---------------- salidas de mapa ----------------
  if (g.fadeDir === 0 && g.exitCd <= 0) {
    const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    for (const ex of g.map.exits) {
      if (ex.needPast && g.epoch !== 'pasado') continue;
      if (ex.needFlag && !g.flags[ex.needFlag]) continue; // R13: escalera de la Cuna (gated)
      if (ptx >= ex.x && ptx < ex.x + ex.w && pty >= ex.y && pty < ex.y + ex.h) {
        g.fadeTo(ex.to, ex.tx, ex.ty);
        audio.sfx('echo');
        break;
      }
    }
  }

  // ---------------- watchers de contenido (baratos, O(1) por frame) ----------------
  // q2_done: Brisa da por completada la misión de los lobos → Ilwen aparece en el Bosque
  // (la bandera no la fijaba nadie y su showFlag dejaba a la elfa invisible para siempre)
  if (g.questIdx >= 2 && !g.flags.q2_done) g.flags.q2_done = true;
  // Memoria II: tras recuperar el Eco de la Voz, la casa junto al río aflora al pisar el Bosque
  if (g.flags.ecoVoz && g.mapId === 'bosque' && !g.flags.mem_casa) {
    g.flags.mem_casa = true;
    if (!(p.memories ?? []).includes('mem_casa')) g.applyAction('memory_mem_casa');
  }
  // Memoria III: la madre sin rostro aflora al vencer al Guardián Hueco
  if (g.flags.guardianDefeated && !g.flags.mem_madre) {
    g.flags.mem_madre = true;
    if (!(p.memories ?? []).includes('mem_madre')) g.applyAction('memory_mem_madre');
  }

  // ---------------- compañera ----------------
  if (g.companion) updateCompanion(g, dt);

  // ==== 16-b (interacción-compañeros): señuelo (vida/marcador/aggro timers),
  // restos (ttl/marcador) y cooldown de interposición. O(1)/frame, cero GC. ====
  interaccionTick(g, dt);

  // ---------------- enemigos ----------------
  // R5-O10: isNight no cambia dentro del frame (dayT se integró al inicio) —
  // se memoiza 1× por frame en vez de 1× por enemigo.
  // R9-2: curva suave de agresión (1.0 día → 1.35 noche profunda, sin salto binario)
  curNightMult = nightAggroMul(g.dayT * 1440);
  // R9-8: ambiente nocturno (grillos+viento; idempotente, seguro cada frame)
  const nightNow = isNight(g);
  playNightAmbience(nightNow);
  // R10-7: capas de ambiente por contexto (ambas idempotentes, crossfade suave)
  playCryptAmbience(g.mapId === 'cripta');
  playInteriorAmbience(isInteriorMap(g.mapId));
  // R9-8: aullido lejano ocasional de noche (ventana determinista de 40 s, ~45%)
  const howlWin = Math.floor(g.globalT / 40);
  if (nightNow && howlWin !== lastHowlWin && ((howlWin * 2654435761) >>> 0) % 100 < 45) {
    lastHowlWin = howlWin;
    playHowlDistant();
  }
  let anyAggro = false;
  // R8-2.5 · TOKEN DE ATAQUE — 1 pasada O(n), sin allocs ( EPIC 2.5 espaciado):
  // elige al atacante no-jefe más cercano al Portador; los demás lo respetan.
  tokenRef = null; tokenD2 = Infinity;
  for (let i = 0; i < g.enemies.length; i++) {
    const en = g.enemies[i];
    if (en.dead || !en.aggro || en.etype === 'guardian') continue;
    const dd2 = dist2(en.x, en.y, p.x, p.y) * (en === prevToken ? 0.85 : 1); // histéresis anti-parpadeo
    if (dd2 < tokenD2) { tokenD2 = dd2; tokenRef = en; }
  }
  prevToken = tokenRef;
  for (const e of g.enemies) {
    if (e.dead) {
      // jefes del Acto II (9-a) + jefes 14-a: última salva visual en cuanto mueren,
      // ANTES de que el filtro de abajo los retire del array
      if (e.etype === 'sirena' || e.etype === 'golem' || e.etype === 'vult' || e.etype === 'coro') expansionDeathFx(g, e);
      continue;
    }
    updateEnemy(g, e, dt);
    if (e.aggro && e.ai !== 'muerto') anyAggro = true;
  }
  // R5-O10: compactación in place (antes .filter() alocaba un array por frame;
  // la identidad estable del array mantiene válidos los índices del grid espacial)
  let aliveE = 0;
  const es = g.enemies;
  for (let i = 0; i < es.length; i++) { const e = es[i]; if (!e.dead) es[aliveE++] = e; }
  es.length = aliveE;
  if (g.bossRef && g.bossRef.dead) g.bossRef = null;
  audio.setCombat(anyAggro);

  // ---------------- jefe: activación (generalizada Acto II) ----------------
  const bossSpawn = g.map.spawns.find(s => s.zone === 'boss');
  if (bossSpawn && !g.flags[BOSS_DEFEAT_FLAG[bossSpawn.type] ?? 'x_defeated'] && !g.bossActive) {
    const boss = g.enemies.find(e => e.etype === bossSpawn.type);
    if (boss) {
      g.bossRef = boss;
      if (dist2(p.x, p.y, boss.x, boss.y) < 190 * 190) {
        g.bossActive = true;
        audio.playTrack('boss');
        // terror v2 (Ronda 2): capa de pavor + presentación cinematográfica
        // (ahora para TODOS los jefes; el intro lee bossRef.etype)
        dreadInit();
        dreadStinger('boss');
        startBossIntro(g);
        // aviso y sfx según el jefe que despierta (Acto II + 14-a)
        if (bossSpawn.type === 'guardian') {
          g.toast('El Guardián Hueco despierta: ROMPE SU BARRA DE QUIEBRE', '#7ee8ff');
          audio.sfx('roar');
        } else if (bossSpawn.type === 'sirena') {
          g.toast('La Sirena Abisal despierta: ROMPE SU BARRA DE QUIEBRE', '#8ef0ff');
          audio.sfx('song');
        } else if (bossSpawn.type === 'golem') {
          g.toast('El Gólem de Escarcha despierta: ROMPE SU BARRA DE QUIEBRE', '#a8d8ff');
          audio.sfx('roar');
        } else {
          g.toast(`${ENEMY_DEFS[bossSpawn.type]?.name ?? 'Un poder antiguo'} despierta: ROMPE SU BARRA DE QUIEBRE`, '#c08af0');
          audio.sfx('roar');
        }
      }
    }
  }

  // R10-9 · EL SEPULCRO (mini-jefe de la antesala de la cripta): watcher
  // PROPIO — usa zone 'antesala' para NO competir con el find() del 'boss'
  // genérico (dos spawns 'boss' romperían al Guardián). Activación idéntica.
  if (g.mapId === 'cripta' && !g.bossActive && g.state === 'play') {
    const miniSpawn = g.map.spawns.find(s => s.zone === 'antesala' && s.type === 'sepulcro');
    if (miniSpawn && !g.flags[BOSS_DEFEAT_FLAG.sepulcro]) {
      const mini = g.enemies.find(e => e.etype === 'sepulcro');
      if (mini && dist2(p.x, p.y, mini.x, mini.y) < 190 * 190) {
        g.bossRef = mini;
        g.bossActive = true;
        audio.playTrack('boss');
        dreadInit();
        dreadStinger('boss');
        startBossIntro(g);
        g.toast('EL SEPULCRO se alza de su tumba: Guarda del umbral', '#b8a0f0');
        playBossRoarVariant(7);
        g.burst(mini.x, mini.y - 6, '#8a7aa8', 14, 60);
      }
    }
  }

  // 14-a: jefes opcionales (Vult en Cumbres de noche · El Coro Roto en la
  // Cripta post-Acto III) — spawn + activación de barra al estilo del bloque
  // anterior. Barato: el watcher filtra primero por mapa.
  expansionBossWatchers(g);

  // ---------------- proyectiles ----------------
  // R5-O10: la rejilla se reconstruye UNA vez por frame aquí — los enemigos ya
  // se movieron este frame, así que las colisiones ven posiciones exactas.
  // tileSolidAt (abajo) se llama 1× por proyectil con args distintos: sin llamadas
  // repetidas con mismos args en el frame → sin memoización posible/necesaria.
  gridRebuild(g);
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const pr = g.projectiles[i];
    pr.t -= dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    // colisión de pared: tileSolidAt es el método público del motor (SOLID_CHARS + época)
    let dead = pr.t <= 0 || g.tileSolidAt(pr.x, pr.y);
      // R9-4: ¿el hechizo REMATA? (impacto contundente + sacudida sonora grande)
      let killedBig = false;
    if (pr.from !== 'enemy') {
      // proyectil aliado (Portador o Ilwen): daña enemigos
      // R6-V10: estela de proyectil aliado = cosmética → probabilidad × calidad
      if (Math.random() < 0.5 * qMul()) g.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.22, maxT: 0.22, color: pr.element === 'fuego' ? '#ff9040' : pr.element === 'hielo' ? '#a0e8ff' : '#ffe86a', size: 1.5, grav: 0 });
      // R5-O10: candidatos por rejilla espacial (≥12 enemigos) o barrido directo.
      // La prueba EXACTA por candidato y la elección del PRIMER enemigo vivo en
      // orden de array se mantienen idénticas (mínimo índice entre los en rango).
      const cands = gridQuery(g, pr.x, pr.y, pr.radius + 2);
      let hitIdx = -1;
      if (cands !== null) {
        for (let ci = 0; ci < cands.length; ci++) {
          const ei = cands[ci];
          if (hitIdx >= 0 && ei > hitIdx) continue; // no puede superar al mínimo hallado
          const e = g.enemies[ei];
          if (e.dead) continue;
          const thr = pr.radius + e.w * 0.5 + 2;
          const ddx = e.x - pr.x, ddy = e.y - 4 - pr.y;
          if (ddx * ddx + ddy * ddy < thr * thr) hitIdx = ei;
        }
      } else {
        for (let ei = 0; ei < g.enemies.length; ei++) {
          const e = g.enemies[ei];
          if (e.dead) continue;
          const thr = pr.radius + e.w * 0.5 + 2;
          const ddx = e.x - pr.x, ddy = e.y - 4 - pr.y;
          if (ddx * ddx + ddy * ddy < thr * thr) { hitIdx = ei; break; }
        }
      }
      if (hitIdx >= 0) {
        const e = g.enemies[hitIdx];
        g.damageEnemy(e, pr.dmg, pr.element, 30, Math.sign(pr.vx), Math.sign(pr.vy));
        killedBig = e.dead === true; // R9-4: el golpe mata → impacto grande
        if (killedBig) addShake(g, 2.5); // R9-4: micro-sacudida al rematar (contrato spells.ts)
        // empuje según elemento: el fuego arrea más (contrato fxcore)
        const kbForce = pr.from === 'companion' ? 90 : pr.element === 'fuego' ? 150 : pr.element === 'rayo' ? 110 : 85;
        applyKnockback(e, pr.vx, pr.vy, kbForce);
        // el impacto del proyectil ya suelta burst propio → marcar para que
        // updateCombatFx no duplique chispas al ver el hitFlash subir
        fxOwnFx.set(e, fxF);
        dead = true;
      }
    } else {
      // proyectil enemigo: parable o dañino para el Portador
      // (R5-O10: distancia al cuadrado, umbral equivalente)
      const thrP = pr.radius + 7;
      if ((p.x - pr.x) * (p.x - pr.x) + (p.y - 4 - pr.y) * (p.y - 4 - pr.y) < thrP * thrP) {
        if (p.parryT > 0) {
          // ¡parada perfecta de proyectil!
          audio.sfx('parry');
          p.res = Math.min(p.maxRes, p.res + 15);
          g.floatAt(p.x, p.y - 22, '¡PARADA!', '#fff8c0', 7);
          dead = true;
        } else if (p.iframes <= 0 && p.rollT <= 0) {
          g.damagePlayer(pr.dmg, pr.x, pr.y);
          dead = true;
        }
      }
      // estelas de proyectiles nuevos (8-c): marea/escarcha/canto dejan un
      // soplo fino del color propio, sin gravedad (extiende el patrón aliado;
      // el resto mantiene su estela púrpura genérica)
      const trailC = pr.sprite === 'orb' ? '#8ef0ff' : pr.sprite === 'shard' ? '#a8d8ff' : pr.sprite === 'nota' ? '#ffe9a0' : '';
      if (trailC) {
        // R6-V10: estela de proyectil enemigo = cosmética → probabilidad × calidad
        // (el proyectil se dibuja aparte: telegrafiar la esquiva no depende de esto)
        if (Math.random() < 0.6 * qMul()) {
          g.particles.push({ x: pr.x + (Math.random() - 0.5) * 3, y: pr.y + (Math.random() - 0.5) * 3, vx: 0, vy: 0, t: 0.25, maxT: 0.25, color: trailC, size: 1.4, grav: 0 });
        }
      } else if (Math.random() < 0.4 * qMul()) { // R6-V10: estela genérica = cosmética
        g.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.25, maxT: 0.25, color: '#b48fff', size: 1.5, grav: 0 });
      }
    }
    if (dead) {
      // R9-4 · magias espectaculares: impacto + residuo mágico del proyectil
      // del Portador (el seed queda fijado en el pool; sonido grande si remata)
      if (pr.from === 'player') {
        g.pushSpellImpactFx(pr.x, pr.y, pr.element, killedBig);
        playSpellImpact(killedBig);
      }
      g.burst(pr.x, pr.y, pr.element === 'fuego' ? '#ff9040' : pr.element === 'hielo' ? '#a0e8ff' : '#e8d0ff', 6, 40);
      // canto de sirena (8-c): al morir la nota suelta 3 destellos musicales
      // que ascienden (contra pared o contra el Portador)
      if (pr.sprite === 'nota') {
        // R6-V10: destellos al morir la nota = cosméticos → recuento × calidad (mínimo 1)
        const n = Math.max(1, Math.round(3 * qMul()));
        for (let j = 0; j < n; j++) {
          g.particles.push({
            x: pr.x + (Math.random() - 0.5) * 6, y: pr.y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 14, vy: -16 - Math.random() * 14,
            t: 0.55, maxT: 0.55, color: '#b8a0f0', size: 1.6, grav: 0,
          });
        }
      }
      g.projectiles.splice(i, 1);
    }
  }

  // ---------------- ondas expansivas ----------------
  for (let i = g.waves.length - 1; i >= 0; i--) {
    const w = g.waves[i];
    w.r += w.speed * dt;
    if (w.dmg > 0 && !w.hit) {
      // R5-O10: |d − r| < 8 ⇔ (r−8)² < d² < (r+8)² — sin sqrt por onda
      const d2w = dist2(w.x, w.y, p.x, p.y);
      const rLo = w.r - 8;
      if ((rLo <= 0 || d2w > rLo * rLo) && d2w < (w.r + 8) * (w.r + 8)) {
        // onda del Guardián: empuja al Portador si el golpe entra (no en parada)
        if (p.parryT <= 0 && p.iframes <= 0 && p.rollT <= 0) applyKnockback(p, p.x - w.x, p.y - w.y, 260);
        g.damagePlayer(w.dmg, w.x, w.y);
        w.hit = true;
      }
    }
    if (w.r >= w.maxR) g.waves.splice(i, 1);
  }
  // R9-4: edad de los FX de hechizo (carga 0.22 s · impacto 0.45 s + residuo 1.0 s)
  const scf = g.spellCastFx;
  for (let i = 0; i < scf.length; i++) {
    const s = scf[i];
    if (s.active) { s.age += dt; if (s.age >= SPELL_CAST_TIME) s.active = false; }
  }
  const sif = g.spellImpactFx;
  for (let i = 0; i < sif.length; i++) {
    const s = sif[i];
    if (s.active) { s.age += dt; if (s.age >= SPELL_IMPACT_TIME + SPELL_RESIDUE_TIME) s.active = false; }
  }

  // ---------------- telegrafías ----------------
  for (let i = g.telegraphs.length - 1; i >= 0; i--) {
    const t = g.telegraphs[i];
    t.t -= dt;
    if (t.t <= 0) {
      audio.sfx('slam');
      g.shake = 6;
      g.burst(t.x, t.y, '#c8b8a0', 18, 90);
      // ==== 17-a (qa-combate) ==== solo golpean las telegrafías con daño:
      // la marca de caída del Sátiro (dmg 0 — «el telegraph SOLO avisa»,
      // enemies_expansion) llegaba a damagePlayer, que coerciona
      // Math.max(1, …) → 1 de daño + i-frames gastados por un simple AVISO.
      // Mismo convenio que el bucle de ondas (w.dmg > 0).
      if (t.dmg > 0 && dist2(p.x, p.y, t.x, t.y) < t.r * t.r && p.rollT <= 0 && p.iframes <= 0) {
        // slam del Guardián: el impacto arrea al Portador
        if (p.parryT <= 0) applyKnockback(p, p.x - t.x, p.y - t.y, 260);
        g.damagePlayer(t.dmg, t.x, t.y);
      }
      g.telegraphs.splice(i, 1);
    }
  }

  g.updateCamera();
}

// ---------------- Compañera (Ilwen mejorada, biblia) ----------------

function updateCompanion(g: Game, dt: number) {
  const c = g.companion!;
  const p = g.player!;
  const mem = ilwenMem.get(c) ?? { rainCd: 8, markCd: 3, arrowIdx: 0, bondT: 0 };
  ilwenMem.set(c, mem);
  const perim2 = (2 * TILE) * (2 * TILE); // R5-O10: perímetro defensivo (2 tiles) al cuadrado

  // knockback suave (la empujan ondas/impactos)
  stepKnockback(g, c, dt);

  if (c.downT > 0) {
    c.downT -= dt;
    if (c.downT <= 0) { c.hp = Math.floor(c.maxHp * 0.5); g.toast('Ilwen se incorpora de nuevo', '#8ef0b0'); }
    return;
  }
  c.atkCd -= dt;
  const d = dist(c.x, c.y, p.x, p.y);
  // ==== 16-b: ¿modo defensivo? (filtra disparos y Lluvia de estrellas al perímetro de 2 tiles) ====
  const defensivo16b = (c.mode ?? 'seguir') === 'defensivo';
  // ==== 16-b (órdenes tácticas al compañero, tecla T) =====================
  // En 'agresivo' y 'defensivo' el movimiento lo decide la orden
  // (interaccion.companionOrdersMove). Devuelve false en 'seguir' —y en la
  // retirada agresiva por vida baja (<30%)— y entonces corre la escolta
  // ORIGINAL de abajo, intacta.
  if (!companionOrdersMove(g, c, p, dt, d)) {
    // mantener posición de escolta
    if (d > 30) {
      const spd = Math.min(92, 40 + (d - 30) * 2);
      const dx = (p.x - c.x) / d, dy = (p.y - c.y) / d;
      g.moveEntity(c, dx * spd * dt, dy * spd * dt);
      c.moving = true; c.anim += dt;
      c.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    } else { c.moving = false; c.anim += dt * 0.4; }
  }
  // ==== fin 16-b (dispatch de movimiento) ==================================
  // disparo a enemigos aggro cercanos: flechas elementales cíclicas fuego→hielo→rayo
  // (fuego/hielo aplican sus estados vía damageEnemy; rayo solo daño)
  if (c.atkCd <= 0) {
    // R5-O10: distancias al cuadrado — mismo ganador (orden de array + < estricto)
    let best: Enemy | null = null, bd2 = 150 * 150;
    // ==== 16-b: modo DEFENSIVO — solo dispara a enemigos a <2 tiles del Portador ====
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (defensivo16b && dist2(e.x, e.y, p.x, p.y) >= perim2) continue;
      const dd2 = dist2(c.x, c.y, e.x, e.y);
      if (dd2 < bd2) { bd2 = dd2; best = e; }
    }
    if (best) {
      c.atkCd = 1.5;
      const el = ARROW_CYCLE[mem.arrowIdx % ARROW_CYCLE.length];
      mem.arrowIdx = (mem.arrowIdx + 1) % ARROW_CYCLE.length;
      // flechas focalizadas: a enemigos marcados +60% de daño
      const dmg = (7 + p.level * 1.5) * ((best.marked ?? 0) > 0 ? 1.6 : 1);
      const dx = best.x - c.x, dy = best.y - 4 - (c.y - 6);
      const l = Math.max(1, Math.hypot(dx, dy));
      g.projectiles.push({
        x: c.x, y: c.y - 6, vx: (dx / l) * 190, vy: (dy / l) * 190, t: 1.2,
        dmg, element: el, from: 'companion', sprite: 'p_arrow', radius: 3, pierce: 0,
      });
      companionShotFx(g, c.x, c.y - 6, el); // Ronda 3: destello de arco + motas
      // micro-retroceso visual (8-c): chispas de cuerda de arco, opuestas al disparo
      combatSparks(g, c.x, c.y - 6, -dx / l, -dy / l, '#e8d8a0', 3, 42);
      audio.sfx('companionShot');
    }
  }
  // MARCA de Ilwen: en combate, cada 6 s fija al enemigo aggro más cercano (5 s)
  mem.markCd -= dt;
  if (mem.markCd <= 0) {
    // R5-O10: distancias al cuadrado — mismo ganador
    let best: Enemy | null = null, bd2 = 180 * 180;
    for (const e of g.enemies) {
      if (e.dead || !e.aggro) continue;
      const dd2 = dist2(c.x, c.y, e.x, e.y);
      if (dd2 < bd2) { bd2 = dd2; best = e; }
    }
    if (best) {
      best.marked = 5;
      g.floatAt(best.x, best.y - 24, 'MARCADO', '#e8a8c8', 6);
      mem.markCd = 6;
    }
  }
  // Técnica combinada «Lluvia de estrellas» (afinidad ≥ 20 · cd 24 s · biblia)
  mem.rainCd -= dt;
  if (mem.rainCd <= 0 && c.affinity >= 20) {
    // ==== 16-b: en DEFENSIVO la Lluvia de estrellas también respeta el perímetro de 2 tiles ====
    // R5-O10: mismo filtrado sin .filter (cero alloc) — array de módulo reutilizado
    rainTargets.length = 0;
    for (const e of g.enemies) {
      if (e.dead || !e.aggro) continue;
      if (dist2(c.x, c.y, e.x, e.y) >= 140 * 140) continue;
      if (defensivo16b && dist2(e.x, e.y, p.x, p.y) >= perim2) continue;
      rainTargets.push(e);
    }
    const targets = rainTargets;
    if (targets.length > 0) {
      mem.rainCd = 24;
      const t0 = targets[0];
      const baseAng = Math.atan2(t0.y - c.y, t0.x - c.x);
      // ráfaga de 10 flechas elementales en abanico hacia los enemigos
      for (let i = 0; i < 10; i++) {
        const ang = baseAng + ((i / 9) - 0.5) * 1.6;
        g.projectiles.push({
          x: c.x, y: c.y - 8, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, t: 1.1,
          dmg: 9 + p.level * 1.8, element: ARROW_CYCLE[i % ARROW_CYCLE.length],
          from: 'companion', sprite: 'p_arrow', radius: 3, pierce: 0,
        });
      }
      // retroceso del tiro multiple (8-c): un solo golpe de cuerda por ráfaga
      combatSparks(g, c.x, c.y - 8, -Math.cos(baseAng), -Math.sin(baseAng), '#e8d8a0', 4, 50);
      g.waves.push({ x: c.x, y: c.y, r: 4, maxR: 64, speed: 150, dmg: 0, hit: true });
      g.waves.push({ x: c.x, y: c.y, r: 4, maxR: 96, speed: 190, dmg: 0, hit: true });
      addFlash(g, '#ffe9a0', 0.15);
      addShake(g, 3);
      g.floatAt(c.x, c.y - 26, 'LLUVIA DE ESTRELLAS', '#ffe9a0', 9);
      audio.sfx('holy');
      audio.sfx('bolt');
    }
  }
  // vínculo: combatir codo con codo fortalece la afinidad (+1 cada 10 s de combate)
  const fighting = g.enemies.some(e => !e.dead && e.aggro);
  if (fighting) {
    mem.bondT += dt;
    if (mem.bondT >= 10) {
      mem.bondT -= 10;
      c.affinity = Math.min(30, c.affinity + 1);
      g.floatAt(c.x, c.y - 20, '♥', '#8ef0b0');
    }
  } else {
    mem.bondT = Math.max(0, mem.bondT - dt * 0.5);
  }
  if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + 2 * dt);
  if (c.hp <= 0) { c.downT = 8; g.toast('Ilwen cae... se repondrá en unos segundos', '#e8a0a0'); }
  // Ronda 3: sincroniza el estado del vínculo y la flecha cargada con la capa FX
  setBondActive(mem.bondT > 0);
  setArrowIndex(mem.arrowIdx);
}

// ---------------- Enemigos ----------------

function speedMult(e: Enemy): number {
  let m = 1;
  if (e.statuses.some(s => s.kind === 'congelado')) m *= 0.5;
  return m;
}

/**
 * R8-1.2 · Movimiento de persecución con steering local O(1) anti-atasco.
 * Los enemigos perseguían en LÍNEA RECTA y se encallaban contra tiles altos
 * sólidos ('t'/'p'): ahora, si el paso directo está bloqueado (sonda boxFree,
 * la misma puerta que moveEntity), deslizan PERPENDICULAR al muro con lado
 * determinista (paridad de la celda del hogar — sin Math.random → sin
 * vibración) y MANTIENEN el intento ~0.45 s (histéresis: no se recalcula la
 * dirección cada frame). Si el deslizamiento también choca, invierte el lado
 * al momento. Cero allocations; como moveEntity valida por eje, el roce con
 * el muro sigue avanzando de forma natural.
 */
function chaseMove(g: Game, e: Enemy, dx: number, dy: number, spd: number, dt: number): void {
  const step = spd * dt;
  if (e.slideT !== undefined && e.slideT > 0) {
    // deslizamiento en curso: tangente al muro + componente hacia el objetivo
    e.slideT -= dt;
    let sd = e.slideSide ?? 1;
    if (!g.boxFree(e.x - dy * sd * step, e.y + dx * sd * step, e.w, e.h)) {
      sd = -sd; e.slideSide = sd; // rincón: invierte el sentido del rodeo
    }
    const mx = -dy * sd * 0.85 + dx * 0.35, my = dx * sd * 0.85 + dy * 0.35;
    const ml = Math.sqrt(mx * mx + my * my) || 1;
    g.moveEntity(e, (mx / ml) * step, (my / ml) * step);
    if (e.slideT <= 0) { e.slideT = undefined; e.slideSide = undefined; } // reintenta directo
    return;
  }
  if (g.boxFree(e.x + dx * step, e.y + dy * step, e.w, e.h)) {
    g.moveEntity(e, dx * step, dy * step); // paso directo: sin obstáculo
    return;
  }
  // bloqueado por tile alto/muro: elige lado determinista y memoriza el intento
  const sd = (((e.homeX + e.homeY) | 0) & 1) ? 1 : -1;
  e.slideSide = sd;
  e.slideT = 0.45;
  g.moveEntity(e, -dy * sd * step * 0.8, dx * sd * step * 0.8);
}

function updateEnemy(g: Game, e: Enemy, dt: number) {
  const p = g.player!;
  const def = ENEMY_DEFS[e.etype];
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.spawnGuard && e.spawnGuard > 0) { e.spawnGuard -= dt; return; }

  // REMATE disponible al entrar en aturdimiento/quebrado (una vez por periodo)
  const prevStun = wasAturdido.get(e) ?? false;
  if (e.ai === 'aturdido' && !prevStun) finisherUsed.delete(e);
  wasAturdido.set(e, e.ai === 'aturdido');

  // knockback suave (proyectiles, cargas, ondas) — contrato fxcore
  stepKnockback(g, e, dt);

  // estados
  for (let i = e.statuses.length - 1; i >= 0; i--) {
    const s = e.statuses[i];
    s.t -= dt;
    if (s.kind === 'quemado') {
      e.hp -= s.power * dt;
      // R6-V10: brasa de 'quemado' = feedback de estado del DoT → suelo 0.7 (no baja a 0.35)
      if (Math.random() < 0.15 * Math.max(0.7, qMul())) g.particles.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 6, vx: 0, vy: -24, t: 0.3, maxT: 0.3, color: '#ff9040', size: 1.5, grav: 0 });
      if (e.hp <= 0) { g.killEnemy(e); return; }
    }
    if (s.t <= 0) e.statuses.splice(i, 1);
  }
  // decae la marca de Ilwen (el icono lo dibuja 3-a)
  if (e.marked !== undefined) {
    e.marked -= dt;
    if (e.marked <= 0) e.marked = undefined;
  }
  if (e.hp < e.maxHp) e.aggro = true;

  // Acto II: decae la fase intangible y delega en el cerebro propio si lo maneja
  if (e.invulT !== undefined && e.invulT > 0) e.invulT -= dt;
  if (EXPANSION_TYPES.has(e.etype) && expansionTick(g, e, dt, def)) return;

  const d2 = dist2(e.x, e.y, p.x, p.y);
  const nightMult = curNightMult; // R5-O10: isNight memoizado 1×/frame en updateGame
  const aggroR = def.aggroR * nightMult * aggroMult(g, e.etype) * (e.etype === 'guardian' ? (g.bossActive ? 99 : 1) : 1); // R8-7: agro por nivel (jefes/desafío exentos dentro de aggroMult)
  if (!e.aggro && d2 < aggroR * aggroR && g.state === 'play') {
    e.aggro = true;
    if (e.etype === 'guardian') {
      // primera vez que entra en aggro: banner del jefe (render lo dibuja)
      if (!g.flags.bossIntro) {
        g.flags.bossIntro = true;
        // R9-5: la intro cinematográfica ya muestra el nombre del jefe — el
        // banner doble el mismo frame se elimina (fallback si la intro no activa)
        if (!bossIntroActive()) {
          g.bossBannerT = 3.2;
          g.bossBannerText = 'GUARDIÁN HUECO';
          g.bossBannerSub = 'Custodio del Eco de la Voz';
        }
        addFlash(g, '#7ee8ff', 0.25);
        // sfx 'banner' es nuevo del contrato (3-a); no-op seguro hasta entonces
        audio.sfx('banner');
      }
    }
    else audio.sfx('blip');
  }
  e.atkCd -= dt;
  e.anim += dt * (e.ai === 'persigue' ? 1.4 : 0.6);

  if (e.ai === 'aturdido') {
    e.aiT -= dt;
    e.moving = false;
    if (e.aiT <= 0) { e.ai = 'persigue'; if (e.maxSta > 0) e.sta = e.maxSta; }
    return;
  }

  switch (e.ai) {
    case 'patrulla': {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 1.5 + Math.random() * 2;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      // si se aleja de su hogar, vuelve; si no, deambula
      // R5-O10: distancia al hogar al cuadrado
      const fhx = e.x - e.homeX, fhy = e.y - e.homeY;
      const far = fhx * fhx + fhy * fhy > 3600;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      const vx = Math.cos(ang) * 22, vy = Math.sin(ang) * 22;
      const before = { x: e.x, y: e.y };
      g.moveEntity(e, vx * dt * speedMult(e), vy * dt * speedMult(e));
      if (Math.abs(e.x - before.x) < 0.01 && Math.abs(e.y - before.y) < 0.01) {
        e.patrolAngle += Math.PI * (0.5 + Math.random());
      }
      e.moving = true;
      e.dir = Math.cos(ang) > 0 ? 'right' : 'left';
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      if (d2 > (aggroR * 2.4) * (aggroR * 2.4)) { e.aggro = false; e.ai = 'patrulla'; break; }
      // ==== 16-b (señuelo): enemigo atraído camina hacia el señuelo y NO
      // ataca al Portador; al expirar el timer retoma la persecución normal ====
      if (lureActive(g, e)) { sennoChase(g, e, dt, def.speed * speedMult(e)); break; }
      // R8-2.5 · duda tras parry (no jefes): si el Portador acaba de PARAR un
      // golpe (destello de parada activo con la ventana ya cerrada — firmado
      // por p.parryFx>0.15 && p.parryT<=0; al INICIAR parry parryT>0 y no
      // cuenta), la IA vacila ~0.25 s y no arranca nuevo viento de ataque.
      if (e.etype !== 'guardian' && p.parryFx > 0.15 && p.parryT <= 0) { e.moving = false; break; }
      const spd = def.speed * speedMult(e);
      if (d2 > (def.atkR * 0.8) * (def.atkR * 0.8)) {
        // R5-O10: sqrt solo al normalizar la dirección (antes hypot por frame)
        const dl = Math.sqrt(d2) || 1;
        let dx = (p.x - e.x) / dl, dy = (p.y - e.y) / dl;
        // R8-2.5 · espaciado (no jefes): si el atacante con token ya está a
        // <24 px del Portador, el resto ORBITA lateralmente en vez de apilarse
        // detrás de él (lado determinista por enemigo, cero allocs).
        if (e.etype !== 'guardian' && tokenRef !== null && tokenRef !== e && tokenD2 < 576) {
          const sd = e.slideSide ?? (((e.homeX + e.homeY) | 0) & 1 ? 1 : -1);
          const ox = -dy * sd * 0.8 + dx * 0.25, oy = dx * sd * 0.8 + dy * 0.25;
          const ol = Math.sqrt(ox * ox + oy * oy) || 1;
          dx = ox / ol; dy = oy / ol;
        }
        chaseMove(g, e, dx, dy, spd, dt); // R8-1.2: steering anti-atasco en árboles
        e.moving = true;
        e.dir = dx > 0 ? 'right' : 'left';
      } else e.moving = false;
      if (d2 <= def.atkR * def.atkR && e.atkCd <= 0) {
        e.ai = 'carga';
        e.windup = def.windup * (e.etype === 'guardian' && e.phase >= 3 ? 0.7 : 1);
        e.telegraphKind = undefined;
      }
      // jefe: acciones especiales (R5-O10: sqrt perezoso, solo para el jefe)
      if (e.etype === 'guardian') guardianBrain(g, e, dt, Math.sqrt(d2));
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      // mirar al jugador
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) {
        if (e.telegraphKind === 'onda') {
          // onda expansiva del Guardián
          g.waves.push({ x: e.x, y: e.y, r: 10, maxR: 150, speed: 130, dmg: 13 * e.phase, hit: false });
          audio.sfx('slam');
          g.shake = 5;
          e.telegraphKind = undefined;
          e.ai = 'recupera';
          e.aiT = 0.6;
          e.atkCd = 2.6;
        } else if (e.etype === 'guardian') {
          // golpe en área
          e.ai = 'ataca';
          e.aiT = 0.22;
          audio.sfx('slam');
          if (d2 < 46 * 46) {
            // el slam del Guardián arrea al Portador
            if (p.parryT <= 0 && p.iframes <= 0 && p.rollT <= 0) applyKnockback(p, p.x - e.x, p.y - e.y, 260);
            g.damagePlayer(def.dmg * e.phase, e.x, e.y);
          }
          g.burst(e.x, e.y, '#8a84a8', 14, 80);
          g.shake = 5;
        } else {
          // estampida del lobo / mandoble del esqueleto
          e.ai = 'ataca';
          e.aiT = 0.22;
          const dl = Math.sqrt(d2) || 1; // R5-O10
          const dx = (p.x - e.x) / dl, dy = (p.y - e.y) / dl;
          g.moveEntity(e, dx * 14, dy * 14);
          if (d2 < (def.atkR + 10) * (def.atkR + 10)) {
            g.damagePlayer(def.dmg, e.x, e.y);
          }
        }
      }
      break;
    }
    case 'ataca': {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.ai = 'recupera';
        e.aiT = 0.45;
        e.atkCd = def.atkCd * (0.85 + Math.random() * 0.3);
      }
      break;
    }
    case 'recupera': {
      e.aiT -= dt;
      // R8-2.5 · retirada (no jefes): tras golpear cede 1-2 pasos si el
      // Portador sigue encima (~0.25 s, cooldown de aproximación natural);
      // moveEntity valida por eje → nunca se mete en muros al retroceder.
      if (e.etype !== 'guardian' && e.aiT > 0.2 && d2 < (def.atkR * 1.4) * (def.atkR * 1.4)) {
        const dl = Math.sqrt(d2) || 1;
        const bx = (e.x - p.x) / dl, by = (e.y - p.y) / dl;
        g.moveEntity(e, bx * def.speed * 0.9 * dt, by * def.speed * 0.9 * dt);
        e.moving = true;
        e.dir = bx > 0 ? 'right' : 'left';
      } else e.moving = false;
      if (e.aiT <= 0) e.ai = e.aggro ? 'persigue' : 'patrulla';
      break;
    }
    default: break;
  }

  // huida de lobos heridos
  if (e.etype === 'lobo' && e.hp < e.maxHp * 0.25 && e.ai !== 'huye' && Math.random() < 0.01) {
    e.ai = 'huye'; e.aiT = 2.2;
  }
  if (e.ai === 'huye') {
    e.aiT -= dt;
    const dl = Math.sqrt(d2) || 1; // R5-O10: sqrt solo para normalizar
    const dx = (e.x - p.x) / dl, dy = (e.y - p.y) / dl;
    g.moveEntity(e, dx * def.speed * 1.2 * dt, dy * def.speed * 1.2 * dt);
    if (e.aiT <= 0) e.ai = 'persigue';
  }
}

function guardianBrain(g: Game, e: Enemy, dt: number, d: number) {
  const p = g.player!;
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
  if (newPhase !== e.phase) {
    e.phase = newPhase;
    audio.sfx('roar');
    audio.sfx('phase'); // Ronda 3: riser + impacto de cambio de fase
    g.toast(`El Guardián cambia de fase (${e.phase}/3)`, '#7ee8ff');
    addShake(g, 5);
    addFlash(g, e.phase === 3 ? '#e8a0ff' : '#7ee8ff', 0.2);
    requestSlowmo(g, 0.25);
    if (e.phase === 2 && !e.sumFase2) {
      // invoca sombras — R8-1.5: UNA VEZ por vida del jefe (latch sumFase2).
      // La memoria de vida del motor (loadMap → bossHp_*) devolvía HP de banda
      // fase-2 a un jefe RECIÉN NACIDO en fase 1; el salto 1→2 re-invocaba el
      // par de fantasmas en CADA re-entrada a la cripta ("el fantasma se
      // multiplica al salir"). El latch vive en el enemigo (opcional, el save()
      // del motor NO serializa enemigos) → sin duplicados ni fugas de estado.
      e.sumFase2 = true;
      for (let i = 0; i < 2; i++) {
        const s = g.makeEnemy('sombra', e.x + (i === 0 ? -24 : 24), e.y + 12, 0, 'boss');
        s.aggro = true;
        g.enemies.push(s);
      }
      g.toast('El Guardián llama a sombras sin rostro', '#b48fff');
    }
    // las sombras invocadas abren la ventana de 'invoca' (frames del sprite)
    e.sumT = 1.4;
  }
  e.sumT -= dt;
  if (e.atkCd <= 0) {
    // elegir acción: slam a distancia, onda en fase 2+, swipe si muy cerca
    if (d < 40) {
      e.ai = 'carga';
      e.windup = 0.55;
      e.atkCd = 2.2;
    } else if (e.phase >= 2 && Math.random() < 0.5) {
      // onda expansiva
      e.windup = 0.9;
      e.ai = 'carga';
      e.telegraphKind = 'onda';
      e.atkCd = 3.2;
    } else {
      // slam telegrafiado sobre el jugador
      g.telegraphs.push({ x: p.x, y: p.y, r: 34, t: 0.85, maxT: 0.85, dmg: 16 * e.phase, kind: 'slam' });
      e.atkCd = 2.4 / (e.phase >= 3 ? 1.4 : 1);
      e.ai = 'recupera';
      e.aiT = 0.5;
    }
  }
}

export function isNight(g: Game): boolean {
  return g.dayT > 0.7 || g.dayT < 0.08;
}

// ============================================================
// R10-3 · CRIPTA DE ZELDA — pinchos '^' · palancas 'L' · puerta 'D'
// ============================================================
// CONTRATO COMPARTIDO (mapa propiedad de R10-1: maps.ts / world/stone.ts):
//
//   '^' PINCHOS — tile de SUELO (NUNCA en SOLID_CHARS ni TALL_CHARS: se pisa).
//     FÓRMULA PURA (stone.ts NO puede importar de update.ts sin ciclo
//     engine→sprites→stone: DUPLICAR textualmente, como en maps_expansion):
//
//       fase(tx,ty,globalT) = (globalT / 1.2 + hash2(tx * 7 + 11, ty * 13 + 7) * 2) % 2
//       SUBE    : fase < 0.55            (≈0.66 s fuera del suelo, ciclo 2.4 s)
//       AVISO   : fase >= 1.75           (0.3 s antes de subir — telegrafía)
//
//     hash2 es el de world/palette (devuelve [0, 0.5) — el ×2 es el hnorm
//     estándar del repo, ver horror.ts/bossfx.ts). Determinista: NADA de
//     Math.random. stone.ts pinta con paintStone(x, ch, tx, ty, mapId, t, at):
//     caso '^' usar AVISO (puntas asomando) / SUBE (pinchos arriba) con `t`.
//
//   'L' PALANCA — al pulsar E cerca (cryptLeverTryActivateNear) se fija
//     g.flags['cripta_lever_' + tx + '_' + ty] = true  (clave EXACTA, con
//     coords de TILE del mapa; flags ya viaja en el save). Las rows del mapa
//     NO cambian (el tile sigue siendo 'L'): stone.ts/render pinta la palanca
//     ACTIVADA cuando esa flag es true (convención documentada también aquí).
//     Recomendación a R10-1: 'L' SÓLIDO en SOLID_CHARS (se acciona desde la
//     casilla vecina, radio 30 px como faroles/cofres).
//
//   'D' PUERTA — solidez DINÁMICA: sólida salvo que TODAS las 'L' del mapa
//     estén activadas (cryptDoorOpen). ENGANQUE DEL ORQUESTADOR (1 línea) en
//     engine.ts → tileSolidAt (~línea 1007), tras calcular `ch` y ANTES del
//     return:
//
//       if (ch === 'D') return !cryptDoorOpen(this); // R10-3: puerta de la cripta
//
//     (importando cryptDoorOpen desde './update'). Así 'D' sólida cerrada y
//     transitable abierta INDEPENDIENTEMENTE de SOLID_CHARS; moveEntity/
//     boxFree/IA pasan por el mismo método. No añadir 'D' a SOLID_CHARS sin
//     esta línea (quedaría clavada para siempre).
//
//   ENGANQUE PALANCA (orquestador) en engine.ts → tryInteract (~línea 1912),
//   como else-if más de la cadena (tras nearestInteract, antes de
//   worldInteract — la palanca es tile, no prop, y cede prioridad a NPCs/
//   cofres/santuarios):
//
//     else if (cryptLeverTryActivateNear(this)) { audio.sfx('select'); return; } // R10-3
//
//   El sfx de palanca/puerta queda para el orquestador (aquí solo toast+float;
//   audio.sfx('spike') abajo es no-op seguro hasta que audio.ts defina el nombre).
//
//   COSTE: hot path = 1 tileAt + 1 hash + aritmética por frame (pinchos) y un
//   bucle O(palancas del mapa, cacheado sin allocs) solo cuando alguien toca
//   una 'D'. Cero allocations por frame.
// ============================================================

/** Medio ciclo del pincho en s: ciclo completo 2×1.2 = 2.4 s (contrato R10-1). */
export const SPIKE_HALF_CYCLE = 1.2;
/** Fracción del ciclo (sobre 2) con el pincho ARRIBA: 0.55/2 ≈ 27.5% del tiempo. */
export const SPIKE_ACTIVE_FRAC = 0.55;
/** Segundos de AVISO antes de subir (telegrafía que pinta stone.ts). */
export const SPIKE_WARN_S = 0.3;

/** Fase del pincho del tile (tx,ty) ∈ [0,1) — determinista por coordenadas.
 *  h2 = hash2(tx*7+11, ty*13+7) * 2 (hash2 devuelve [0,0.5) → normalizado). */
export function spikePhaseAt(tx: number, ty: number): number {
  return hash2(tx * 7 + 11, ty * 13 + 7) * 2;
}

/** ¿Está ARRIBA el pincho del tile (tx,ty) en el instante globalT (s)?
 *  PURA y determinista — stone.ts duplica la fórmula (ver bloque R10-3). */
export function spikeUpAt(tx: number, ty: number, globalT: number): boolean {
  return ((globalT / SPIKE_HALF_CYCLE + spikePhaseAt(tx, ty)) % 2) < SPIKE_ACTIVE_FRAC;
}

/** ¿Está AVISANDO el pincho (puntas asomando, ≤SPIKE_WARN_S para subir)?
 *  PURA — misma duplicación para la telegrafía de stone.ts. */
export function spikeWarnAt(tx: number, ty: number, globalT: number): boolean {
  return ((globalT / SPIKE_HALF_CYCLE + spikePhaseAt(tx, ty)) % 2) >= 2 - SPIKE_WARN_S / SPIKE_HALF_CYCLE;
}

// ---- caché de palancas/puerta del mapa actual (reescaneo solo al cambiar mapa) ----
let leverCacheId = '';
let leverCacheRows: string[] | null = null;
const leverTXs: number[] = [];   // tiles 'L' del mapa (posiciones cacheadas)
const leverTYs: number[] = [];
const leverKeys: string[] = [];  // claves de flag pre-horneadas (cero concat en hot path)
let leverHasDoor = false;

function leverCacheRefresh(g: Game): void {
  if (leverCacheRows === g.rows && leverCacheId === g.mapId) return;
  leverCacheRows = g.rows;
  leverCacheId = g.mapId;
  leverTXs.length = 0; leverTYs.length = 0; leverKeys.length = 0;
  leverHasDoor = false;
  const rows = g.rows;
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = r.indexOf('L'); x >= 0; x = r.indexOf('L', x + 1)) {
      leverTXs.push(x); leverTYs.push(y);
      leverKeys.push('cripta_lever_' + x + '_' + y);
    }
    if (!leverHasDoor && r.indexOf('D') >= 0) leverHasDoor = true;
  }
}

/** ¿La puerta 'D' del mapa actual está ABIERTA? true ⇔ el mapa tiene 'D' Y
 *  TODAS sus palancas 'L' están activadas (flags 'cripta_lever_<tx>_<ty>').
 *  Sin palancas (o sin puerta) → false (cerrada: default seguro). Consumido
 *  por tileSolidAt vía el enganche del orquestador (ver bloque R10-3). */
export function cryptDoorOpen(g: Game): boolean {
  leverCacheRefresh(g);
  const n = leverTXs.length;
  if (n === 0 || !leverHasDoor) return false;
  for (let i = 0; i < n; i++) {
    if (!g.flags[leverKeys[i]]) return false;
  }
  return true;
}

/** Activa la palanca del tile (tx,ty) si es 'L' y no lo estaba ya.
 *  Devuelve true si la activó ESTA llamada (el llamador decide sfx, p.ej.
 *  audio.sfx('select')). Fija g.flags['cripta_lever_'+tx+'_'+ty]=true —
 *  clave simple de string, ya serializada en save() (flags → { ...flags }). */
export function cryptLeverTryActivate(g: Game, tx: number, ty: number): boolean {
  if (g.state !== 'play' || !g.player) return false;
  if (tileAt(g.map, g.rows, tx, ty, g.epoch) !== 'L') return false;
  const key = 'cripta_lever_' + tx + '_' + ty;
  if (g.flags[key]) { g.toast('La palanca ya está accionada.', '#9aa0b8'); return false; }
  g.flags[key] = true;
  g.floatAt(tx * TILE + 8, ty * TILE - 6, '¡CLANC!', '#ffe9a0', 7);
  leverCacheRefresh(g);
  const total = leverTXs.length;
  let done = 0;
  for (let i = 0; i < total; i++) if (g.flags[leverKeys[i]]) done++;
  if (leverHasDoor && done >= total && total > 0) {
    // el ÚLTIMO tacto del mecanismo: la puerta cede (sfx 'stone' → orquestador)
    g.toast('El mecanismo despierta: la puerta de piedra cede.', '#8ef0ff');
    addShake(g, 4);
  } else {
    g.toast('Palanca accionada (' + done + '/' + total + ').', '#8ef0ff');
  }
  return true;
}

/** Enganche cómodo para tryInteract (1 línea en engine.ts, ver bloque R10-3):
 *  busca la palanca 'L' más cercana al Portador en las 9 tiles vecinas
 *  (radio 30 px, mismo estándar que faroles/cofres) y la activa. */
export function cryptLeverTryActivateNear(g: Game): boolean {
  const p = g.player;
  if (!p || g.state !== 'play') return false;
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  let bx = -1, by = -1, bd2 = 30 * 30;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = ptx + dx, ty = pty + dy;
      if (tileAt(g.map, g.rows, tx, ty, g.epoch) !== 'L') continue;
      const ox = tx * TILE + 8 - p.x, oy = ty * TILE + 8 - p.y;
      const d2 = ox * ox + oy * oy;
      if (d2 < bd2) { bd2 = d2; bx = tx; by = ty; }
    }
  }
  return bx >= 0 && cryptLeverTryActivate(g, bx, by);
}

/** Daño de pincho (1×/frame, tile bajo el centro del Portador): solo si el
 *  pincho está ARRIBA y el Portador es golpeable. Los ENEMIGOS NUNCA reciben
 *  daño de pinchos (su IA los cruza: evita suicidios de patrulla) — decisión
 *  de diseño, no omisión. El suelo no se PAREA (parryT bloquea el falso
 *  «parada perfecta contra el piso»). Knockback hacia atrás del último
 *  movimiento (plVX/plVY miden JUSTO este frame — ver updateGame). */
function updateCryptSpikes(g: Game): void {
  const p = g.player;
  if (!p) return;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  if (tileAt(g.map, g.rows, tx, ty, g.epoch) !== '^') return;
  if (!spikeUpAt(tx, ty, g.globalT)) return;
  if (p.iframes > 0 || p.rollT > 0 || p.parryT > 0) return;
  // origen del golpe: por delante del último movimiento → el empujón de 8px
  // de damagePlayer y el burst salen hacia atrás; parado → el suelo de abajo.
  const sp2 = plVX * plVX + plVY * plVY;
  const moving = sp2 > 16; // >4 px/s
  g.damagePlayer(8, moving ? p.x + plVX * 0.08 : p.x, moving ? p.y + plVY * 0.08 : p.y + 6);
  if (moving) applyKnockback(p, -plVX, -plVY, 150);
  else { const [bx, by] = DIRS[p.dir]; applyKnockback(p, -bx, -by, 150); }
  playSpikeUp(); // R10-7: "shk" metálico del pincho (rate-limit interno 90 ms)
}
