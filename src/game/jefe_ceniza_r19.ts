// ============================================================
// ECOS DE AELTHAR — RONDA 19 · Task 19-d
// JEFE OPCIONAL «EL HERALDO DE CENIZA» — Cumbres Heladas (norte)
// ============================================================
// Heraldo de la Ciudadela que subió a las Cumbres «a apagar el último
// canto»: ceniza que recuerda ser llama. Módulo AUTOCONTENIDO (def +
// cerebro + sprite + watcher + botín) que NO edita ningún fichero ajeno.
//
// ══ PUNTOS DE CABLEADO PARA EL INTEGRADOR (nombres exactos) ══
//
// (1) src/game/update.ts · updateEnemy, línea ~704, JUSTO TRAS la línea
//     `if (EXPANSION_TYPES.has(e.etype) && expansionTick(g, e, dt, def)) return;`
//     añadir:
//       if ((e.etype as string) === 'ceniza' && cenizaTickR19(g, e, dt, def)) return; // 19-d
//     (mismo contrato que expansionTick: true = frame consumido, el motor
//     salta su IA genérica. El cast `(e.etype as string)` existe porque
//     types.ts está CONGELADO y 'ceniza' no está en la unión EnemyType;
//     si el integrador añade 'ceniza' a la unión, puede escribir
//     e.etype === 'ceniza' a secas.)
//
// (2) src/game/update.ts · updateGame, línea ~432, junto a
//     `expansionBossWatchers(g);` añadir:
//       cenizaWatchR19(g); // 19-d: spawn + barra de jefe + botín al morir
//     (O(1)/frame: early-out por mapa y por estado de la partida.)
//
// (3) OPCIONAL src/game/engine.ts · constructor, tras initExpansionSprites():
//       initJefeCenizaR19Sprites(); // 19-d
//     (sin cablear, cenizaWatchR19 lo llama perezosamente — idempotente.)
//
// (4) OPCIONAL src/game/engine.ts:84 · BOSS_DEFEAT_FLAG añadir
//       ceniza: 'cenizaDefeated',
//     (sin ello, stats.jefesDerrotados no cuenta este jefe — killEnemy del
//     motor solo incrementa la estadística para etypes con flag registrada.)
//
// (5) OPCIONAL src/game/render.ts · drawEntity, contrato de frames de
//     sprites_expansion.ts (los índices >= 2 son opcionales; sin cablear,
//     el ciclo 0/1 funciona igual):
//       ceniza (5): 0 idle A · 1 idle B (capa suelta motas) ·
//                   2 TELEGRAPH (pulso/cono: grietas al núcleo) ·
//                   3 ATTACK/despersonado (capa MÁS DISPERSA) ·
//                   4 LLUVIA (brazos alzados, fase 3)
//     Con la regla genérica de 18-c sirve tal cual:
//       e.ai==='carga'&&e.windup>0 → 2 · e.ai==='ataca' → 3 ·
//       e.phase===3 (ceniza) → 4 como base de reposo si se prefiere.
//
// (6) Los proyectiles reutilizan sprites EXISTENTES ('shard' cono/lluvia
//     sombra, 'orb' ascuas fuego) → drawExpansionProjectile los anima sin
//     tocar render. Nada más pendiente: la def se inyecta sola en
//     ENEMY_DEFS al cargar el módulo (Object.assign, patrón ENEMY_DEFS_16A).
//
// ── DETERMINISMO ──
// CERO Math.random en este módulo: mulberry32 local (semilla portick para
// la lluvia de ceniza, igual a la técnica del contrato del bioma 18-a/b).
// El estado por partida vive en WeakMap<Game,…> y por jefe en
// WeakMap<Enemy,…> (HMR / multi-instancia seguro). Math.random interno del
// motor (makeEnemy anim, críticos de damageEnemy) queda fuera de alcance.
//
// ── DECISIONES DOCUMENTADAS ──
// · etype 'ceniza' NO está en la unión EnemyType (types.ts congelado): el
//   cast vive AQUÍ (spawnCenizaR19) y en el snippet de cableado (1).
// · Proyectiles del cono/lluvia: element 'sombra' (ceniza apagada del
//   Heraldo; la misión daba 'hielo' con libertad de literal — 'hielo' se
//   reserva al def para la identidad fría de las Cumbres y evita apilar
//   congelado con el Gólem). Las ascuas del PULSO sí son element 'fuego'.
// · «Quema» del Pulso: el motor NO aplica estados al Portador (Player no
//   tiene statuses; damagePlayer no recibe elemento) → la quema se
//   representa con las 8 ascuas element 'fuego' del estallido (daño propio
//   pequeño + paleta de fuego), no con un estado.
// · El botín vive en cenizaWatchR19 (killEnemy del motor no tiene rama
//   'ceniza' y no se puede editar): flag cenizaDefeated + ascua_ceniza,
//   +1 poción, toasts, disolución de los siervos. XP/oro los da el motor
//   por la def genérica (360 / 240–320).
// · Spawn (BFS verificado en scripts/smoke_jefe_ceniza_r19.ts): tile
//   (13,8) de Cumbres Heladas — interior NORTE, orilla occidental del
//   paso, a 11 tiles del Gólem (24,8) y a 43 pasos BFS de la única
//   salida (24,40). Componente transitable desde allí: 1462 tiles.
// ============================================================

import type { Game } from './engine';
import type { Enemy, EnemyType } from './types';
import type { EnemyDef } from './data';
import { ENEMY_DEFS } from './data';
import { registerSpr } from './sprites';
import type { Frames } from './sprites';
import { audio } from './audio'; // usado SOLO dentro de funciones (sin FX al cargar)
import { addShake, addFlash, requestSlowmo } from './fxcore';

// ============================================================
// 1) DEF — EnemyDef bien formado (mismo contrato que ENEMY_DEFS.guardian)
// ============================================================

export const CENIZA_DEF_R19: EnemyDef = {
  name: 'El Heraldo de Ceniza',
  hp: 540, dmg: 15, speed: 38, xp: 360, gold: [240, 320],
  sprite: 'ceniza', aggroR: 175, atkR: 44,
  windup: 0.75, atkCd: 2.0,
  element: 'hielo',      // literales REALES de Element (types.ts:14)
  weakTo: 'fuego',
  breakBar: 85,
  desc: 'Heraldo de la Ciudadela: vinieron a «apagar el último canto». Ceniza que recuerda ser llama; refleja el spam de golpes con el PULSO DEL FARO y siembra brasa donde hubo canto. Débil al fuego.',
};

/** Inyección idempotente en ENEMY_DEFS (patrón ENEMY_DEFS_16A de data.ts):
 *  makeEnemy lee ENEMY_DEFS[etype] por índice → 'ceniza' queda servible sin
 *  tocar data.ts. Record<string, EnemyDef> acepta la clave nueva sin cast. */
Object.assign(ENEMY_DEFS, { ceniza: CENIZA_DEF_R19 });

/** Datos de presentación del banner (misma forma que BOSS_INFO de challenge.ts:52-56). */
export const CENIZA_BOSS_INFO_R19 = {
  name: 'El Heraldo de Ceniza',
  sub: 'Vinieron a apagar el canto',
} as const;

/** Spawn verificado por BFS (ver cabecera): tile (13,8) → px centro de tile. */
export const CENIZA_SPAWN_R19 = {
  map: 'cumbres' as const,
  tx: 13, ty: 8,           // tiles (documentación/BFS)
  x: 13 * 16 + 8,          // 216 px — TILE=16 (constante del proyecto)
  y: 8 * 16 + 8,           // 136 px
};

// ============================================================
// 2) Estado por partida (WeakMap) y por jefe (WeakMap) — HMR seguro
// ============================================================

interface CenizaRunState {
  boss: Enemy | null;      // referencia viva (sobrevive al filtro de muertos 1 frame)
  minions: Enemy[];        // cenizas menores convocadas (para el límite 2 y la disolución)
  looted: boolean;         // botín aplicado UNA vez
}

interface CenizaBossMem {
  // ---- anti-spam «EL PULSO DEL FARO» ----
  hitCnt: number;          // golpes conectados en la ventana
  hitWin: number;          // ventana 2.5 s (se resetea el contador al expirar)
  prevHitFlash: number;    // detección de golpe fresco (hitFlash SUBIÓ)
  freshHitCeniza: boolean; // golpe fresco este tick (calculado en commonCeniza)
  lastAtkCd: number;       // guarda anti doble-decaimiento de atkCd
  lastInvulT: number;      // guarda anti doble-decaimiento de invulT
  vAct: 'cono' | 'melé' | 'pulso' | undefined;
  // ---- kite orbital (fase 1) ----
  orbitDir: 1 | -1;
  orbitT: number;
  // ---- invocaciones (fase 2+) ----
  sumT: number;
  sumSide: 1 | -1;
  // ---- lluvia de ceniza (fase 3) ----
  lluviaT: number;
  tickN: number;           // contador de ticks (semilla determinista de la lluvia)
  rng: () => number;       // mulberry32 del jefe (partículas/flecos)
}

const RUNS = new WeakMap<Game, CenizaRunState>();
const MEMS = new WeakMap<Enemy, CenizaBossMem>();

let runCount = 0;
function runState(g: Game): CenizaRunState {
  let rs = RUNS.get(g);
  if (!rs) { rs = { boss: null, minions: [], looted: false }; RUNS.set(g, rs); runCount++; }
  return rs;
}

function mem(e: Enemy): CenizaBossMem {
  let m = MEMS.get(e);
  if (!m) {
    m = {
      hitCnt: 0, hitWin: 0, prevHitFlash: 0, freshHitCeniza: false,
      lastAtkCd: -1, lastInvulT: -1,
      vAct: undefined, orbitDir: 1, orbitT: 1.4, sumT: 0, sumSide: 1,
      lluviaT: 0, tickN: 0, rng: mulberry32(0xc3e1a2a7),
    };
    MEMS.set(e, m);
  }
  return m;
}

/** mulberry32 local (cero Math.random en el módulo). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

// ============================================================
// 3) Bloque común — réplica LEAN de commonTick (enemies_expansion.ts:184-304
//    NO es export). Con el cableado (1), el motor ya consumió hitFlash/
//    spawnGuard/statuses/invulT (update.ts:673-703) ANTES de delegar aquí:
//    este bloque repite SOLO lo que el motor no llegó a hacer (atkCd/anim)
//    y lo que necesita leer (golpe fresco, aturdimiento por quebrado).
// ============================================================

function commonCeniza(g: Game, e: Enemy, dt: number, def: EnemyDef, m: CenizaBossMem): boolean {
  const p = g.player;
  m.freshHitCeniza = false;

  // golpe fresco: hitFlash SUBIÓ desde el tick pasado (damageEnemy pone 0.12)
  m.freshHitCeniza = e.hitFlash > m.prevHitFlash + 5e-4 && e.hitFlash > 0.06;
  // decaimiento de hitFlash si ningún agente lo ha tocado (colocación temprana)
  if (e.hitFlash > 0 && Math.abs(e.hitFlash - m.prevHitFlash) < 1e-9) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
  }
  m.prevHitFlash = e.hitFlash;

  // spawnGuard (invocaciones: el motor lo consume en update.ts:674; guard de cortesía)
  if (e.spawnGuard !== undefined && e.spawnGuard > 0) return true;

  // invulT: decae SOLO si el motor no lo hizo (guard por valor, no doble decaimiento)
  if (e.invulT !== undefined && e.invulT > 0
      && Math.abs(e.invulT - m.lastInvulT) < 1e-9) {
    e.invulT = Math.max(0, e.invulT - dt);
  }
  m.lastInvulT = e.invulT ?? -1;

  // atkCd: el motor lo decae en update.ts:725, DESPUÉS de este punto —
  // si el frame fue consumido, el decaimiento lo hacemos aquí (guard por valor)
  if (Math.abs(e.atkCd - m.lastAtkCd) < 1e-9) e.atkCd -= dt;

  // aggro por proximidad (el bloque del motor en update.ts:709 no llega a correr)
  if (p && !e.aggro && g.state === 'play' && dist(e.x, e.y, p.x, p.y) < def.aggroR) {
    e.aggro = true;
  }
  if (e.hp < e.maxHp) e.aggro = true;

  // anim (cosmético): con el frame consumido, solo aquí avanza
  e.anim += dt * (e.ai === 'persigue' ? 1.4 : 0.6);

  // QUEBRADO/ATURDIDO — patrón del dispatcher (enemies_expansion.ts:258-300):
  // el motor fija aiT=4 genérico; los jefes lo ajustan. Al salir, barra llena.
  if (e.ai === 'aturdido') {
    const stunT = 1.8; // ceniza: entre Vult (2.0) y el default (1.6)
    if (e.aiT > stunT) e.aiT = stunT;
    e.aiT -= dt;
    e.moving = false;
    e.windup = 0;
    // mientras está quebrado suelta esencia de ceniza (2 partículas/frame,
    // posiciones deterministas con el rng del jefe)
    for (let i = 0; i < 2; i++) {
      const r1 = m.rng(), r2 = m.rng(), r3 = m.rng();
      g.particles.push({
        x: e.x + (r1 - 0.5) * 18, y: e.y - 4 - r2 * 10,
        vx: (r3 - 0.5) * 16, vy: -24 - r2 * 16,
        t: 0.55, maxT: 0.55, color: i === 0 ? '#ff8a3a' : '#ffd8a0', size: 1.6, grav: -8,
      });
    }
    if (e.aiT <= 0) {
      e.ai = 'persigue';
      if (e.maxSta > 0) e.sta = e.maxSta;
    }
    return true;
  }
  return false;
}

// ============================================================
// 4) CEREBRO — tickCenizaR19 (contrato expansionTick: true = frame consumido)
// ============================================================

// ---- constantes de la mecánica (documentadas para el balance del integrador) ----
const PULSO_DMG = 12;        // daño del shockwave (la onda empuja por el motor)
const PULSO_MAXR = 96;       // radio máximo del Pulso
const PULSO_SPEED = 190;     // px/s de expansión
const PULSO_WINDUP = 0.8;    // telegrafía 0.8 s (misión)
const HIT_WINDOW = 2.5;      // ventana anti-spam 2.5 s (misión)
const PULSO_THRESHOLD = [4, 4, 3]; // golpes por fase (fase 3 baja a 3 — misión)
const ASCUAS_N = 8;          // ascuas 'fuego' del estallido («la quema»)
const CONE_N = 5;            // cono de ceniza: 5 proyectiles (misión)
const CONE_SPREAD = (40 * Math.PI) / 180; // abanico 40° (misión)
const CONE_SPEED = 92;       // lentos
const CONE_T = 2.2;
const CONE_DMG = 9;
const CONO_WINDUP = 0.55;
const MELE_R = 30;           // anillo del telegraph del bastón (daño = def.dmg 15)
const SUMMON_EVERY = 9;      // repite invocación cada 9 s si <2 vivos (misión)
const SUMMON_MAX = 2;        // límite de cenizas menores vivas
const LLUVIA_EVERY = 8;      // cada 8 s en fase 3 (misión)
const LLUVIA_N = 6;          // 6 proyectiles desde arriba (misión)
const LLUVIA_T = 2;          // t 2 s (misión)
const LLUVIA_DMG = 10;
const FASE3_SPEED = 46;      // speed 46 en fase 3 (misión; def.speed = 38)
const KITE_NEAR = 100;       // si el Portador se pega a <100 px se aparta (misión)

/** Devuelve los siervos de ceniza vivos y purga los muertos del registro. */
function minionsVivos(rs: CenizaRunState): number {
  for (let i = rs.minions.length - 1; i >= 0; i--) if (rs.minions[i].dead) rs.minions.splice(i, 1);
  return rs.minions.length;
}

/** Cono de ceniza: abanico de n proyectiles lentos 'sombra' ('shard'). */
function fireCono(g: Game, e: Enemy, p: { x: number; y: number }): void {
  const base = Math.atan2(p.y - 4 - e.y, p.x - e.x);
  const doble = e.phase >= 2; // fase 2+: DOBLE abanico (misión)
  const capas = doble ? [0, 0.14] : [0];
  for (const off of capas) {
    for (let i = 0; i < CONE_N; i++) {
      const a = base + off + (i / (CONE_N - 1) - 0.5) * CONE_SPREAD;
      // boca del bastón: nunca dentro de pared (contrato de satiro, 14-a)
      let ox = e.x + Math.cos(a) * 6, oy = e.y - 4 + Math.sin(a) * 4;
      if (g.tileSolidAt(ox, oy)) { ox = e.x; oy = e.y; }
      g.projectiles.push({
        x: ox, y: oy,
        vx: Math.cos(a) * CONE_SPEED, vy: Math.sin(a) * CONE_SPEED,
        t: CONE_T, dmg: CONE_DMG, element: 'sombra', from: 'enemy',
        sprite: 'shard', radius: 4, pierce: 0,
      });
    }
  }
  audio.sfx('shadow');
}

/** LLUVIA DE CENIZA (fase 3): 6 proyectiles desde arriba; vx determinista
 *  por mulberry32 sembrado con el CONTADOR DE TICKS del jefe (misión). */
function fireLluvia(g: Game, e: Enemy, m: CenizaBossMem): void {
  const rng = mulberry32((Math.imul(m.tickN, 0x9e3779b1) ^ 0xc3e1a2a7) >>> 0);
  for (let i = 0; i < LLUVIA_N; i++) {
    const x = e.x + (rng() * 2 - 1) * 110;
    const vx = (rng() * 2 - 1) * 70;
    const vy = 78 + rng() * 22;
    // caen DESDE ARRIBA: se descuelgan de y-120 hasta el primer hueco
    // transitable sobre el jefe (la cordillera norte es 'R' sólida)
    let y = e.y - 120;
    while (g.tileSolidAt(x, y) && y < e.y - 16) y += 8;
    g.projectiles.push({
      x, y, vx, vy,
      t: LLUVIA_T, dmg: LLUVIA_DMG, element: 'sombra', from: 'enemy',
      sprite: 'shard', radius: 4, pierce: 0,
    });
  }
  audio.sfx('whoosh');
}

/** PULSO DE CENIZA: shockwave radial que empuja (el motor aplica el
 *  knockback de la onda) + 8 ascuas element 'fuego' (la «quema»). */
function firePulso(g: Game, e: Enemy, m: CenizaBossMem): void {
  g.waves.push({ x: e.x, y: e.y, r: 6, maxR: PULSO_MAXR, speed: PULSO_SPEED, dmg: PULSO_DMG, hit: false });
  for (let i = 0; i < ASCUAS_N; i++) {
    const a = (i / ASCUAS_N) * Math.PI * 2 + (m.rng() - 0.5) * 0.2;
    g.projectiles.push({
      x: e.x + Math.cos(a) * 10, y: e.y - 4 + Math.sin(a) * 10,
      vx: Math.cos(a) * 105, vy: Math.sin(a) * 105,
      t: 1.1, dmg: 4, element: 'fuego', from: 'enemy',
      sprite: 'orb', radius: 3.5, pierce: 0,
    });
  }
  g.burst(e.x, e.y - 4, '#ff8a3a', 20, 95);
  addShake(g, 5);
  audio.sfx('fire');
  audio.sfx('slam');
}

/** Invoca «cenizas menores» (esqueletos genéricos — makeEnemy NO soporta
 *  tint/variante: se documenta, mismo compromiso que guardianBrain:848).
 *  Lados alternos; nunca supera SUMMON_MAX vivas. */
function summonMinions(g: Game, e: Enemy, rs: CenizaRunState, m: CenizaBossMem, n: number): void {
  const vivos = minionsVivos(rs);
  const faltan = Math.min(n, SUMMON_MAX - vivos);
  for (let i = 0; i < faltan; i++) {
    const side = m.sumSide;
    m.sumSide = (m.sumSide === 1 ? -1 : 1) as 1 | -1;
    let x = e.x + side * 30, y = e.y + 10;
    if (g.tileSolidAt(x, y)) { x = e.x + side * 22; }
    if (g.tileSolidAt(x, y)) { x = e.x; y = e.y + 18; }
    const mn = g.makeEnemy('esqueleto', x, y, 0, 'mini');
    mn.aggro = true;
    mn.spawnGuard = 0.2;
    g.enemies.push(mn);
    rs.minions.push(mn);
    g.burst(mn.x, mn.y, '#6a5a58', 12, 70);
  }
  if (faltan > 0) {
    audio.sfx('blip');
    g.toast('El Heraldo espolvorea ceniza: arden siervos menores', '#ff8a3a');
  }
}

export function tickCenizaR19(g: Game, e: Enemy, dt: number, def: EnemyDef): boolean {
  // auto-registro (robustez: aunque el jefe no nazca de spawnCenizaR19)
  const rs = runState(g);
  if (rs.boss !== e && !e.dead) rs.boss = e;
  const m = mem(e);
  m.tickN++;

  // guarda de muerte: el FX + botín los hace cenizaWatchR19 (killEnemy del
  // motor no tiene rama 'ceniza'); aquí solo se consume el frame
  if (e.hp <= 0 && !e.dead) return true;

  if (commonCeniza(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { e.moving = false; e.anim += dt * 0.4; return true; }
  const d = dist(e.x, e.y, p.x, p.y);

  // ---- banner del jefe (misma técnica que tickVult/tickCoro) ----
  if (e.aggro && !g.flags.cenizaIntro) {
    g.flags.cenizaIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = CENIZA_BOSS_INFO_R19.name.toUpperCase();
    g.bossBannerSub = CENIZA_BOSS_INFO_R19.sub;
    addFlash(g, '#ff8a3a', 0.25);
    addShake(g, 4);
    audio.sfx('banner');
    g.toast('Un velo de ceniza baja de la cordillera: el Heraldo ha venido a apagar tu canto', '#ff8a3a');
  }

  // ---- fases: 1 «CENIZA» >65% · 2 «BRASA» 65-35% · 3 «EL ÚLTIMO ALIENTO» <35% ----
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.65 ? 1 : hpPct > 0.35 ? 2 : 3;
  if (newPhase > e.phase) {
    e.phase = newPhase;
    e.windup = 0;
    if (e.ai === 'carga') e.ai = 'persigue';
    addShake(g, 5);
    addFlash(g, '#ff8a3a', 0.2);
    requestSlowmo(g, 0.2);
    audio.sfx('roar');
    if (newPhase === 2) {
      e.invulT = Math.max(e.invulT ?? 0, 1); // transición BRASA: invulT 1 s (misión)
      m.lastInvulT = e.invulT;
      g.toast('¡El Heraldo aviva su fuego!', '#ff8a3a');
      m.sumT = 0;
      summonMinions(g, e, rs, m, 2); // 2 cenizas menores al entrar en fase 2
    } else {
      g.toast('EL ÚLTIMO ALIENTO: la ceniza recuerda ser llama', '#ffd8a0');
    }
  }

  // ---- EL PULSO DEL FARO (anti-spam): refleja el golpe a golpe ----
  // contador con ventana que se resetea (más simple que timestamps — misión)
  m.hitWin -= dt;
  if (m.hitWin <= 0) m.hitCnt = 0;
  if (m.freshHitCeniza) { m.hitCnt++; m.hitWin = HIT_WINDOW; }
  const umbral = PULSO_THRESHOLD[Math.min(3, Math.max(1, e.phase)) - 1];
  if (m.hitCnt >= umbral && e.ai !== 'carga') {
    m.hitCnt = 0;
    m.hitWin = 0;
    m.vAct = 'pulso';
    e.ai = 'carga';
    e.windup = PULSO_WINDUP;
    e.telegraphKind = 'aro';
    // telegraph SOLO avisa (dmg 0), como la balada del sátiro
    g.telegraphs.push({ x: e.x, y: e.y, r: 48, t: PULSO_WINDUP, maxT: PULSO_WINDUP, dmg: 0, kind: 'aro' });
    g.floatAt(e.x, e.y - 28, '¡EL PULSO DEL FARO!', '#ffd8a0', 8);
    audio.sfx('fire');
  }

  // velocidad por fase (fase 3: 46 — misión)
  const spd = e.phase >= 3 ? FASE3_SPEED : def.speed;

  // ---- invocaciones (fase 2+): cada SUMMON_EVERY s si <SUMMON_MAX vivas ----
  if (e.phase >= 2 && e.aggro) {
    m.sumT += dt;
    if (m.sumT >= SUMMON_EVERY) {
      m.sumT = 0;
      if (minionsVivos(rs) < SUMMON_MAX) summonMinions(g, e, rs, m, SUMMON_MAX);
    }
  }

  // ---- lluvia de ceniza (fase 3): cada LLUVIA_EVERY s, cae aunque se mueva ----
  if (e.phase >= 3 && e.aggro) {
    m.lluviaT += dt;
    if (m.lluviaT >= LLUVIA_EVERY) { m.lluviaT = 0; fireLluvia(g, e, m); }
  }

  switch (e.ai) {
    case 'patrulla': {
      // vela su spawn: deriva corta alrededor de homeX/homeY
      e.aiT -= dt;
      if (e.aiT <= 0) { e.aiT = 2 + m.rng() * 2; e.patrolAngle = m.rng() * Math.PI * 2; }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 40;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      g.moveEntity(e, Math.cos(ang) * spd * 0.35 * dt, Math.sin(ang) * spd * 0.35 * dt);
      e.moving = true;
      e.dir = Math.cos(ang) > 0 ? 'right' : 'left';
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      // FASE 1 «CENIZA»: mantiene distancia media — kite perpendicular si el
      // Portador se pega a <KITE_NEAR px (misión)
      if (e.phase === 1 && d < KITE_NEAR) {
        m.orbitT -= dt;
        if (m.orbitT <= 0) { m.orbitT = 1.4; m.orbitDir = (m.orbitDir === 1 ? -1 : 1) as 1 | -1; }
        const tang = ang + (Math.PI / 2) * m.orbitDir;
        g.moveEntity(e, Math.cos(tang) * spd * 0.95 * dt, Math.sin(tang) * spd * 0.95 * dt);
        e.moving = true;
      } else if (d > 150) {
        g.moveEntity(e, Math.cos(ang) * spd * dt, Math.sin(ang) * spd * dt);
        e.moving = true;
      } else if (e.phase >= 2 && d < 60) {
        // BRASA/ÚLTIMO ALIENTO: ya no teme el melé, pero no se pega del todo
        g.moveEntity(e, -Math.cos(ang) * spd * 0.8 * dt, -Math.sin(ang) * spd * 0.8 * dt);
        e.moving = true;
      } else {
        e.moving = false;
      }
      e.dir = p.x > e.x ? 'right' : 'left';

      if (e.atkCd <= 0) {
        if (d < def.atkR) {
          // melé con bastón: el telegraph 'aro' del motor aplica el daño al expirar
          m.vAct = 'melé';
          e.ai = 'carga';
          e.windup = def.windup;
          e.telegraphKind = 'aro';
          g.telegraphs.push({ x: e.x, y: e.y, r: MELE_R, t: def.windup, maxT: def.windup, dmg: def.dmg, kind: 'aro' });
        } else if (d < 215) {
          // cono de ceniza (fase 1) / doble abanico (fase 2+)
          m.vAct = 'cono';
          e.ai = 'carga';
          e.windup = CONO_WINDUP;
          e.telegraphKind = 'salva'; // frame TELEGRAPH sin telegraph de suelo (patrón rafaga de Vult)
        }
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (m.vAct === 'pulso') {
        // marca visual naranja durante la telegrafía (1 brasa/frame, determinista)
        const r1 = m.rng(), r2 = m.rng();
        g.particles.push({
          x: e.x + (r1 - 0.5) * 40, y: e.y - 10 - r2 * 22,
          vx: 0, vy: -30, t: 0.4, maxT: 0.4, color: '#ff8a3a', size: 1.8, grav: 0,
        });
      }
      if (e.windup <= 0) {
        e.telegraphKind = undefined;
        if (m.vAct === 'pulso') {
          firePulso(g, e, m);
          e.atkCd = 2.4;
          e.ai = 'recupera'; e.aiT = 0.5;
        } else if (m.vAct === 'cono') {
          fireCono(g, e, p);
          e.atkCd = 2.0;
          e.ai = 'recupera'; e.aiT = 0.4;
        } else {
          // melé: el telegraph del motor ya golpeó; pose de ataque breve
          e.atkCd = def.atkCd;
          e.ai = 'ataca'; e.aiT = 0.2;
          audio.sfx('swing');
          g.burst(e.x + (p.x > e.x ? 12 : -12), e.y - 2, '#6a5a58', 6, 50);
        }
        m.vAct = undefined;
      }
      break;
    }
    case 'ataca': {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0) { e.ai = 'recupera'; e.aiT = 0.45; }
      break;
    }
    case 'recupera': {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0) e.ai = e.aggro ? 'persigue' : 'patrulla';
      break;
    }
    default: break;
  }

  m.lastAtkCd = e.atkCd;
  return true;
}

// ============================================================
// 5) WATCHER — spawn + barra de jefe + botín (punto de cableado 2)
// ============================================================

/** Instancia al Heraldo en su spawn (makeEnemy + ajustes de jefe). */
export function spawnCenizaR19(g: Game): Enemy {
  const e = g.makeEnemy('ceniza' as unknown as EnemyType, CENIZA_SPAWN_R19.x, CENIZA_SPAWN_R19.y, 2, 'boss');
  // hitbox de jefe (makeEnemy da 12×10 a los etypes fuera de su lista):
  // igual que guardian/sirena/golem/vult/coro (engine.ts:621-622)
  e.w = 22; e.h = 16;
  e.homeX = e.x; e.homeY = e.y;
  const rs = runState(g);
  rs.boss = e;
  rs.minions.length = 0;
  rs.looted = false;
  g.enemies.push(e);
  g.burst(e.x, e.y, '#6a5a58', 22, 80);
  g.burst(e.x, e.y, '#ff8a3a', 12, 60);
  g.shake = 6;
  audio.sfx('shadow');
  g.toast('La ceniza del norte se recoge en figura: el Heraldo aguarda', '#ff8a3a');
  return e;
}

/** Botín + FX de muerte (UNA vez). killEnemy del motor ya entregó XP/oro de
 *  la def (360 / 240–320); aquí: flags, poción, toasts, disolución de siervos. */
function lootCeniza(g: Game, rs: CenizaRunState): void {
  const boss = rs.boss!;
  const rng = mulberry32(0xc3e1a2a7 ^ 0x5eed);
  g.flags.cenizaDefeated = true;
  g.flags.ascua_ceniza = true;
  g.bossActive = false;
  audio.setCombat(false);
  audio.playTrack('cumbres');
  audio.sfx('fire');
  g.shake = 8;
  // el despersonado final: la capa vuela en ascuas que ascienden
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng();
    g.particles.push({
      x: boss.x + Math.cos(a) * 8, y: boss.y - 6 + Math.sin(a) * 5,
      vx: Math.cos(a) * 46, vy: Math.sin(a) * 30 - 34,
      t: 0.7 + (i % 3) * 0.1, maxT: 0.9,
      color: i % 3 === 0 ? '#ffd8a0' : i % 3 === 1 ? '#ff8a3a' : '#6a5a58',
      size: 2, grav: -16,
    });
  }
  const p = g.player;
  if (p) {
    p.potions += 1; // botín garantizado (patrón sirena/vult/coro, engine.ts:1866+)
    g.floatAt(boss.x, boss.y - 34, 'Botín del jefe: +1 poción · ASCUA DE CENIZA', '#ffd8a0');
  }
  g.toast('El Heraldo de Ceniza se deshace: la brasa recuerda, por fin, haber sido llama', '#ff8a3a');
  g.toast('El último canto sigue en pie', '#ffe9a0');
  // los siervos se disuelven con su señor (sin botín: son ceniza)
  for (const mn of rs.minions) {
    if (!mn.dead) { mn.dead = true; g.burst(mn.x, mn.y, '#6a5a58', 10, 50); }
  }
  rs.minions.length = 0;
  requestSlowmo(g, 0.3);
}

/** Punto de cableado (2) — 1×/frame desde updateGame, junto a expansionBossWatchers. */
export function cenizaWatchR19(g: Game): void {
  if (g.state !== 'play' || !g.player) return;
  initJefeCenizaR19Sprites(); // perezoso + idempotente (punto de cableado 3)

  const rs = runState(g);

  // (a) botín/FX de muerte: killEnemy del motor no tiene rama 'ceniza' →
  // el watcher la aporta. Corre ANTES del early-out de mapa (el jefe puede
  // morir el mismo frame en que el Portador viaja).
  if (rs.boss && rs.boss.dead && !rs.looted) {
    rs.looted = true;
    lootCeniza(g, rs);
  }

  if (g.mapId !== CENIZA_SPAWN_R19.map) return;
  const p = g.player;

  // (b) spawn: una vez por partida (cenizaDefeated lo cierra para siempre);
  // despierta cuando el Portador se acerca a su vigilía en el norte.
  const vivo = !!rs.boss && !rs.boss.dead && g.enemies.includes(rs.boss);
  if (!g.flags.cenizaDefeated && !vivo
      && dist(p.x, p.y, CENIZA_SPAWN_R19.x, CENIZA_SPAWN_R19.y) < 260) {
    spawnCenizaR19(g);
  }

  // (c) barra de jefe (patrón vult/coro, expansionBossWatchers:1770-1781)
  const boss = rs.boss;
  if (boss && !boss.dead && g.enemies.includes(boss)) {
    g.bossRef = boss;
    if (!g.bossActive && dist(p.x, p.y, boss.x, boss.y) < 190) {
      g.bossActive = true;
      audio.playTrack('boss');
    }
  }
}

// ============================================================
// 6) SPRITE — buildCenizaR19(): figura encapuchada de ceniza, 26×22, 5 frames
// ============================================================
// Paleta (misión): #3a3234 base · #6a5a58 medio · #ff8a3a grietas ·
// #ffd8a0 núcleo. Capa que se deshace en partículas (frame 3 = más dispersa).
// Determinista: solo fillRect + globalAlpha; FNV idéntico en cada build.

/** Rect pintado (patrón sprites_expansion.ts:84). */
function rc(x: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, col: string): void {
  x.fillStyle = col;
  x.fillRect(rx, ry, rw, rh);
}

export function buildCenizaR19(): Frames {
  const BASE = '#3a3234', MID = '#6a5a58', DARK = '#241f21',
    CRACK = '#ff8a3a', CORE = '#ffd8a0', PALO = '#4a3f42';
  const frames: Frames = [];
  for (let f = 0; f < 5; f++) {
    const c = document.createElement('canvas');
    c.width = 26; c.height = 22;
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = false;
    const lit = f === 2 || f === 3 || f === 4; // grietas encendidas (telegraph/ataque/lluvia)
    const disp = f === 3;                       // despersonado: capa MÁS dispersa
    const lluvia = f === 4;

    // ── capa trasera (se deshace: cada frame pierde más trozos) ──
    x.globalAlpha = 0.9;
    rc(x, 5, 9, 5, 8, DARK);
    if (f >= 1) { // motas desprendidas (deterministas, crecen por frame)
      x.globalAlpha = 0.55;
      rc(x, 3, 15 + (f > 1 ? 2 : 0), 2, 2, MID);
      rc(x, 1, 12 + f, 1, 1, MID);
    }
    if (disp || lluvia) { // estelas de ceniza horizontales / caída
      x.globalAlpha = 0.4;
      rc(x, 0, 10, 4, 1, MID); rc(x, 2, 14, 3, 1, MID);
      if (disp) { rc(x, 21, 12, 3, 1, MID); rc(x, 23, 16, 2, 1, MID); }
      else { rc(x, 4, 19, 1, 2, MID); rc(x, 20, 18, 1, 2, MID); rc(x, 12, 20, 1, 1, MID); }
    }
    x.globalAlpha = 1;

    // ── torso/túnica (el despersonado afina 1px) ──
    const tx0 = disp ? 9 : 8, tw = disp ? 8 : 10;
    rc(x, tx0, 8, tw, 8, BASE);
    rc(x, tx0, 8, tw, 1, MID);                 // luz de hombros
    rc(x, tx0 + 1, 9, 1, 6, MID);              // pliegue claro
    rc(x, tx0 + tw - 1, 9, 1, 6, DARK);        // sombra

    // ── capucha + hueco + ojos-brasa ──
    rc(x, 9, 2, 8, 6, BASE);
    rc(x, 9, 2, 8, 1, MID);
    rc(x, 8, 3, 1, 4, DARK); rc(x, 17, 3, 1, 4, DARK);
    rc(x, 11, 4, 4, 3, DARK);                  // hueco
    rc(x, 12, 5, 1, 1, lit ? CORE : CRACK);    // ojos de brasa
    rc(x, 15, 5, 1, 1, lit ? CORE : CRACK);

    // ── grietas de la túnica (más encendidas cuanto más cerca del pulso) ──
    rc(x, 10, 10, 1, 1, CRACK);
    rc(x, 13, 12, 1, 1, CRACK);
    rc(x, 16, 9, 1, 1, CRACK);
    if (lit) {
      rc(x, 11, 14, 1, 1, CRACK); rc(x, 15, 11, 1, 1, CRACK);
      rc(x, 12, 11, 2, 2, CORE);               // núcleo en el pecho
    }
    if (f === 2) { // TELEGRAPH del pulso: halo de ascuas
      x.globalAlpha = 0.7;
      rc(x, 2, 7, 1, 1, CRACK); rc(x, 23, 7, 1, 1, CRACK);
      rc(x, 4, 17, 1, 1, CRACK); rc(x, 21, 17, 1, 1, CRACK);
      rc(x, 12, 0, 1, 1, CORE);
      x.globalAlpha = 1;
    }

    // ── falda de la capa (se rae por frames) ──
    x.globalAlpha = 0.95;
    if (disp) {
      rc(x, 8, 16, 4, 2, MID); rc(x, 14, 16, 4, 2, MID); // hem roto
    } else {
      rc(x, 7, 16, 12, 2, MID);
      rc(x, 7, 18, 12, 1, DARK);
      if (f >= 1) { rc(x, 10, 18, 2, 1, BASE); rc(x, 15, 18, 2, 1, BASE); } // desgaste
    }
    x.globalAlpha = 1;

    // ── bastón (melé) / brazos alzados (lluvia) ──
    if (lluvia) {
      rc(x, 6, 6, 1, 5, BASE); rc(x, 19, 6, 1, 5, BASE);   // brazos arriba
      rc(x, 5, 4, 1, 2, PALO); rc(x, 5, 3, 1, 1, CORE);    // bastón alzado
      rc(x, 20, 5, 1, 2, PALO);
    } else {
      rc(x, 20, 7, 1, 12, PALO);                            // bastón vertical
      rc(x, 20, 6, 1, 1, lit ? CORE : CRACK);               // brasa en la punta
      rc(x, 18, 10, 2, 2, BASE);                            // mano
    }

    // ── motas ambientales (deterministas por frame) ──
    x.globalAlpha = 0.35;
    rc(x, 2 + f, 3 + (f % 2), 1, 1, MID);
    rc(x, 22 - f, 19 - (f % 3), 1, 1, MID);
    x.globalAlpha = 1;

    frames.push(c);
  }
  return frames;
}

let sprInited = false;
let buildCount = 0;

/** Registro idempotente del sprite 'ceniza' (contrato registerSpr). */
export function initJefeCenizaR19Sprites(): void {
  if (sprInited) return;
  sprInited = true;
  buildCount++;
  registerSpr('ceniza', buildCenizaR19());
}

/** Gancho dev (patrón __costaDebug): inspección desde smokes/consola. */
export function __cenizaDebug(): { sprInited: boolean; builds: number; runs: number; defInENEMY_DEFS: boolean } {
  return {
    sprInited,
    builds: buildCount,
    runs: runCount,
    defInENEMY_DEFS: ENEMY_DEFS.ceniza === CENIZA_DEF_R19,
  };
}

/** Reset dev: suelta los WeakMaps/flags de módulo (los smokes lo usan para
 *  recrear escenarios deterministas). NO forma parte del contrato de juego. */
export function __cenizaReset(): void {
  sprInited = false;
  // WeakMaps no se vacían por diseño: cada Game/Enemy nuevo crea estado nuevo
}
