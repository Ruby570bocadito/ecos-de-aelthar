// ============================================================
// ECOS DE AELTHAR — actors/minibossai.ts
// R11-2 · IA DE PATRONES DE MINI-JEFES (Ronda 11 · EPIC 7.1)
// ------------------------------------------------------------
// LOS CINCO QUE GUARDAN EL UMBRAL
//   · EL CAZADOR        ('cazador'        → 'carga')   — La Niebla aún tiene
//     jauría: embiste como la manada que fue, y el muro es su única jaula.
//   · EL ESPANTAPÁJAROS ('espantapajaros' → 'abanico') — siembra dardos de
//     paja y miedo; tras cada siembra se deshace en humo y renace dos pasos más allá.
//   · EL CORO           ('coro'           → 'coro')    — voces sin garganta que
//     dibujan anillos de notas; el hueco es su única misericordia: por él se
//     escapa al compás, y cada tercer compás es una espiral que gira.
//   · EL CENTINELA      ('centinela'      → 'guardia') — aún monta guardia a
//     un rey muerto: escudo al frente, barrido al contragolpe… y por la
//     espalda, la muerte.
//   · LA NODRIZA        ('nodriza'        → 'nueces')  — llama a sus ahogados
//     como una madre llama a cenar: siempre vuelven, siempre son más.
//
// CONTRATO FIJO (orquestador R11; NO cambiar firmas):
//   MbPattern · updateMiniboss(g, e, dt, pattern) · minibossTelegraph(e, pattern)
//   · AHOGADO_DEF_R11 (EnemyDef del esbirro, tipo exacto de data.ts)
//   + MB_PATTERN_OF (mapa etype→pattern, cortesía para el cableado)
//
// ENGANCHES PARA EL ORQUESTADOR (este módulo NO toca update/data/enemies):
//
//  (A) DESPACHO — src/game/update.ts, dentro de updateEnemy, junto a la rama
//      de EXPANSION_TYPES (~línea 1026, después del bloque común de estados):
//
//        import { MB_PATTERN_OF, updateMiniboss } from './actors/minibossai';
//        // ...
//        const mbPat = MB_PATTERN_OF[e.etype];
//        if (mbPat) { updateMiniboss(g, e, dt, mbPat); return; }
//
//      El tick es ROBUSTO a la colocación (mismo convenio que expansionTick):
//      detecta vía WeakMap si el bloque común ya corrió este frame (stamp de
//      g.globalT) y, si no, replica hitFlash/estados/knockback/atkCd por su
//      cuenta. Colocado donde se coloque, no duplica ni omite nada.
//
//  (B) DEF DEL ESBIRRO — en data.ts (o en el módulo de defs de R11-1), tras
//      cargar ENEMY_DEFS:
//
//        import { AHOGADO_DEF_R11 } from './actors/minibossai';
//        Object.assign(ENEMY_DEFS, { ahogado_r11: AHOGADO_DEF_R11 });
//
//      IMPRESCINDIBLE ANTES DE INVOCAR: makeEnemy lee ENEMY_DEFS[type] y
//      damageEnemy/killEnemy leen def.xp/def.gold — sin registro, crash.
//      Añadir además 'ahogado_r11' (y los 4 etypes de mini-jefe) al union
//      EnemyType de types.ts (mismo camino que 14-a/16-a/sepulcro).
//
//  (C) MUERTE — la detección la hace el motor: g.killEnemy(e) fija e.dead y
//      paga botín; el orquestador persiste su bandera en SU rama de killEnemy:
//
//        if (MB_PATTERN_OF[e.etype]) this.flags['mb_' + e.etype + '_muerto'] = true;
//
//      (y su watcher de activación, estilo sepulcro: zone propia NUNCA 'boss').
//
//  (D) PARRY — convenios respetados: los proyectiles del abanico y las
//      burbujas nacen con from:'enemy' → interaccion.reflectProjectiles los
//      REFLEJA y update.ts los detiene (p.parryT). El melé (embestida/barrido)
//      sale por g.damagePlayer → la parada del motor responde sola. Las zonas
//      (anillos del Coro) son NUNCA parryables (doctrina AoE de interaccion
//      2.3-b): si el Portador intenta pararlas, la ventana se cierra con el
//      mismo feedback «¡no parryable!» y entran esquivando por el hueco.
//
//  (E) FX DE JEFE GRATIS — los cerebros conducen e.ai por la ruta nativa
//      'carga' (viento) → 'ataca' (golpe) → 'recupera', así bossfx (impacto de
//      fase) y render (drawWindupCue: chevron + arco de suelo) lucen sin cablear
//      nada; para la fracción EXACTA del viento existe minibossTelegraph().
//
// DETERMINISMO: cero Math.random en la IA — la varianza por esbirro nace de un
// hash del hogar (hash2 de world/palette) y de contadores por enemigo.
// CERO ALLOCS POR FRAME tras la primera asignación del WeakMap (pools
// pre-asignados: los 6 anillos del Coro viven dentro de la memoria del jefe).
// ============================================================

import type { Game } from '../engine';   // solo tipo (cero ciclo en runtime)
import type { Enemy, Player } from '../types';
import type { EnemyDef } from '../data';
import { ENEMY_DEFS } from '../data';
import { audio } from '../audio';
import { applyKnockback, stepKnockback, addShake } from '../fxcore';
import { hash2 } from '../world/palette';

// ---------------- contrato público ----------------

/** Patrones de los 5 mini-jefes (épica 7.1). */
export type MbPattern = 'carga' | 'abanico' | 'coro' | 'guardia' | 'nueces';

/** Mapa etype→pattern para el dispatch del orquestador (enganche A). */
export const MB_PATTERN_OF: Record<string, MbPattern | undefined> = {
  cazador: 'carga',
  espantapajaros: 'abanico',
  coro: 'coro',
  coro_mini: 'coro', // R11-1b: etype real del mini-jefe del bosque ('coro' es el JEFE El Coro Roto)
  centinela: 'guardia',
  nodriza: 'nueces',
};

/**
 * ESBIRRO DE LA NODRIZA · 'ahogado_r11' (enganche B: el orquestador lo
 * registra en ENEMY_DEFS vía Object.assign). Stats débiles por contrato:
 * hp 24 · atk 8 — vuelven del fondo como ceniza vuelve al hogar.
 * Sprite reutilizado 'sombra' (decisión documentada, como el Sepulcro reusa
 * 'guardian'); el orquestador puede cambiarlo sin tocar este archivo.
 */
export const AHOGADO_DEF_R11: EnemyDef = {
  name: 'Ahogado Menor',
  hp: 24,
  dmg: 8,
  speed: 34,
  xp: 8,
  gold: [2, 5],
  sprite: 'sombra',
  aggroR: 110,
  atkR: 14,
  windup: 0.5,      // s de telegrafía (mismo convenio que el motor)
  atkCd: 1.8,
  element: 'sombra',
  weakTo: 'sagrado',
  desc: 'Lo que la marea devuelve sin nombre: un pescador que oyó el canto de la Nodriza y bajó a cenar a lo hondo. Se arrastra torpe, moja y ahoga, y responde a la luz como el ahogado responde a la cuerda: tirando. Débil a lo sagrado.',
};

// ---------------- memoria por esbirro (cero allocs en régimen) ----------------

/** Anillo de notas del Coro (pool fijo, pre-asignado dentro de la memoria). */
interface RingState {
  on: boolean;
  x: number; y: number;      // centro (posición del Coro al lanzarlo)
  r: number;                 // radio actual (px)
  spd: number;               // expansión px/s
  maxR: number;              // se disuelve al alcanzarlo
  dmg: number;
  gapA: number;              // ángulo del hueco sorteable (rad)
  gapW: number;              // apertura del hueco (rad)
  rot: number;               // giro del hueco (espiral): rad/s
  hit: boolean;              // ya resolvió su contacto con el Portador
}

interface MbMem {
  frame: number;       // stamp g.globalT del último commonTick (idempotencia)
  seed: number;        // hash determinista del hogar (varianza por esbirro)
  windupMax: number;   // duración del viento EN CURSO (para minibossTelegraph)
  st: number;          // sub-estado: 0 acecho · 1 viento · 2 activo · 3 recupera
  t1: number;          // timer genérico 1 (dash/activo/cadencias)
  t2: number;          // timer genérico 2 (invocación de la Nodriza)
  dashDx: number; dashDy: number;
  hitDone: boolean;    // la embestida ya conectó su golpe de contacto
  lastHp: number;      // Centinela: hp del frame previo (absorción del escudo)
  shieldT: number;     // Centinela: >0 escudo roto (vulnerable)
  castN: number;       // Coro: contador de anillos (alterna hueco · 3º espiral)
  roared: boolean;     // rugido de presentación 1×
  rings: RingState[];  // pool fijo de 6 anillos (Coro)
}

const MEM = new WeakMap<Enemy, MbMem>();

/** Vientos base por patrón (fallback de minibossTelegraph antes del 1er tick). */
const WINDUP_BASE: Record<MbPattern, number> = {
  carga: 0.8, abanico: 0.6, coro: 0.8, guardia: 0.5, nueces: 0.9,
};

/** Memoria del esbirro: UNA asignación por vida (WeakMap, no persiste). */
function memFor(g: Game, e: Enemy): MbMem {
  let m = MEM.get(e);
  if (m) return m;
  // semilla determinista: hash del hogar + etype (varianza sin azar vivo).
  // hash2 devuelve [0,0.5) → ×2 para [0,1) (convenio del repo, ver telegraph.ts)
  const h = hash2(Math.floor(e.homeX) + e.etype.charCodeAt(0), Math.floor(e.homeY)) * 2;
  const seed = (h * 4294967295) >>> 0;
  m = {
    frame: -1, seed,
    windupMax: 0, st: 0, t1: 0, t2: 2.2, dashDx: 0, dashDy: 0,
    hitDone: false, lastHp: e.hp, shieldT: 0, castN: 0, roared: false,
    rings: [],
  };
  for (let i = 0; i < 6; i++) {
    m.rings.push({ on: false, x: 0, y: 0, r: 0, spd: 0, maxR: 0, dmg: 0, gapA: 0, gapW: 0, rot: 0, hit: false });
  }
  MEM.set(e, m);
  return m;
}

// ---------------- utilidades sin alloc ----------------

function d2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

/** ×0.5 si lo congela la escarcha (mismo convenio que update.speedMult). */
function spdMul(e: Enemy): number {
  for (let i = 0; i < e.statuses.length; i++) {
    if (e.statuses[i].kind === 'congelado') return 0.5;
  }
  return 1;
}

/** Agro del esbirro: su def si el orquestador ya registró (def de R11-1),
 *  fallback propio si aún no. Los mini-jefes no decaen en aggro (jefes). */
function aggroCheck(g: Game, e: Enemy, p: Player, dd2: number): void {
  const def = ENEMY_DEFS[e.etype];
  const ar = def ? def.aggroR : 150;
  if (!e.aggro && dd2 < ar * ar && g.state === 'play') {
    e.aggro = true;
    const m = MEM.get(e);
    if (m && !m.roared) {
      m.roared = true;
      audio.sfx('roar');
      g.burst(e.x, e.y - 6, '#9aa0b8', 12, 70);
    } else audio.sfx('blip');
  }
}

/**
 * Bloque común del motor, IDEMPOTENTE por frame (convenio expansionTick):
 * si el orquestador colocó el despacho DESPUÉS del bloque común de
 * updateEnemy, el stamp evita replicar nada; si lo colocó antes, aquí corre
 * todo lo que el cerebro necesita (hitFlash, estados/DoT, knockback, agro por
 * daño, atkCd). Devuelve true si el turno quedó consumido (spawnGuard/muerto).
 */
function commonTick(g: Game, e: Enemy, dt: number, m: MbMem): boolean {
  if (m.frame === g.globalT) return false; // ya corrió este frame: no duplicar
  m.frame = g.globalT;
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.spawnGuard !== undefined && e.spawnGuard > 0) { e.spawnGuard -= dt; return true; }
  // estados (quemado = DoT que mata vía killEnemy; el resto decae)
  for (let i = e.statuses.length - 1; i >= 0; i--) {
    const s = e.statuses[i];
    s.t -= dt;
    if (s.kind === 'quemado') {
      e.hp -= s.power * dt;
      if (e.hp <= 0) { g.killEnemy(e); return true; }
    }
    if (s.t <= 0) e.statuses.splice(i, 1);
  }
  if (e.hp < e.maxHp) e.aggro = true; // convención del motor (update.ts:1022)
  stepKnockback(g, e, dt);
  e.atkCd -= dt;
  e.anim += dt * 0.8;
  return false;
}

/** Viento en curso: pantalla de carga del cerebro (ruta nativa del motor). */
function startWindup(e: Enemy, m: MbMem, windup: number, kind: NonNullable<Enemy['telegraphKind']>): void {
  e.ai = 'carga';
  e.windup = windup;
  m.windupMax = windup;
  e.telegraphKind = kind;
  m.st = 1;
}

// ============================================================
// EL CAZADOR — 'carga': embestida cargada (0.7-0.9 s de viento con anillo
// convergente), dash rápido en línea, y ATURDIMIENTO al chocar con muro
// (1.2 s vulnerable). La jauría vieja aún conoce el camino más corto.
// ============================================================

const CAJA = { dashSpd: 330, dashMaxT: 0.55, cd: 2.4, dmg: 14, stunT: 1.2, persSpd: 48 };

function tickCarga(g: Game, e: Enemy, p: Player, dt: number, m: MbMem): void {
  const dd2 = d2(e.x, e.y, p.x, p.y);
  if (m.st === 1) {
    // viento: quieta, mira al Portador; el anillo convergente vive en
    // g.telegraphs (dmg 0 — solo avisa; lo empujó startCargaViento)
    e.windup -= dt;
    e.moving = false;
    e.dir = p.x > e.x ? 'right' : 'left';
    if (e.windup <= 0) {
      const dl = Math.sqrt(dd2) || 1;
      m.dashDx = (p.x - e.x) / dl;
      m.dashDy = (p.y - e.y) / dl;
      m.st = 2;
      m.t1 = CAJA.dashMaxT;
      m.hitDone = false;
      e.ai = 'ataca';
      e.aiT = CAJA.dashMaxT;
      e.telegraphKind = undefined;
      audio.sfx('whoosh');
    }
    return;
  }
  if (m.st === 2) {
    // dash en línea recta: muro delante = choque (aturdido 1.2 s vulnerable)
    m.t1 -= dt;
    const step = CAJA.dashSpd * dt;
    const probeX = e.x + m.dashDx * (step * 2 + e.w * 0.5);
    const probeY = e.y + m.dashDy * (step * 2 + e.h * 0.5);
    if (!g.boxFree(probeX, probeY, e.w, e.h)) {
      // el muro gana: la jaula se cierra sobre la bestia
      e.ai = 'aturdido';
      e.aiT = CAJA.stunT;
      m.st = 0;
      e.atkCd = CAJA.cd;
      applyKnockback(e, -m.dashDx, -m.dashDy, 140);
      addShake(g, 5);
      audio.sfx('slam');
      g.burst(e.x + m.dashDx * 8, e.y + m.dashDy * 8, '#c8b8a0', 14, 80);
      g.floatAt(e.x, e.y - 24, '¡ATURDIDO!', '#ffe86a', 7);
      return;
    }
    g.moveEntity(e, m.dashDx * step, m.dashDy * step);
    e.moving = true;
    e.dir = m.dashDx > 0 ? 'right' : 'left';
    // golpe de contacto (la parada del motor responde sola vía damagePlayer)
    if (!m.hitDone && dd2 < 22 * 22) {
      m.hitDone = true;
      g.damagePlayer(CAJA.dmg, e.x, e.y);
      addShake(g, 3);
    }
    if (m.t1 <= 0) { m.st = 3; e.ai = 'recupera'; e.aiT = 0.5; e.atkCd = CAJA.cd; e.moving = false; }
    return;
  }
  if (m.st === 3) {
    e.aiT -= dt;
    e.moving = false;
    if (e.aiT <= 0) m.st = 0;
    return;
  }
  // acecho: persigue y carga cuando el cañón está listo
  aggroCheck(g, e, p, dd2);
  if (!e.aggro) { e.moving = false; return; }
  const dl = Math.sqrt(dd2) || 1;
  if (dl > 26) {
    const nx = (p.x - e.x) / dl, ny = (p.y - e.y) / dl;
    g.moveEntity(e, nx * CAJA.persSpd * spdMul(e) * dt, ny * CAJA.persSpd * spdMul(e) * dt);
    e.moving = true;
    e.dir = nx > 0 ? 'right' : 'left';
  } else e.moving = false;
  if (dd2 < 230 * 230 && e.atkCd <= 0) {
    // viento 0.7-0.9 s (determinista por hogar) + anillo convergente dmg 0:
    // drawTelegraphV2 dibuja las runas cerrándose y, al estallar, el motor
    // suelta su aviso de slam (sfx+polvo) — el disparo de salida del dash.
    const windup = 0.7 + (m.seed % 3) * 0.1;
    startWindup(e, m, windup, 'aro');
    g.telegraphs.push({ x: e.x, y: e.y, r: 30, t: windup, maxT: windup, dmg: 0, kind: 'slam' });
  }
}

// ============================================================
// EL ESPANTAPÁJAROS — 'abanico': 3-5 dardos parryables en abanico
// (cadencia 1.6-2.2 s) y TELETRANSPORTE corto en humo tras cada siembra.
// Cosecha lo que la Niebla siembra; lo siega con la misma hoz.
// ============================================================

const PAJA = { windup: 0.6, dmg: 10, spd: 150, persSpd: 26, spread: 0.9, tp: 72 };

function tickAbanico(g: Game, e: Enemy, p: Player, dt: number, m: MbMem): void {
  const dd2 = d2(e.x, e.y, p.x, p.y);
  if (m.st === 1) {
    e.windup -= dt;
    e.moving = false;
    e.dir = p.x > e.x ? 'right' : 'left';
    if (e.windup > 0) return;
    // abanico de 3-5 dardos parryables (from 'enemy' → el parry los refleja)
    const n = 3 + (m.seed % 3);
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < n; i++) {
      const ang = base + ((i / (n - 1)) - 0.5) * PAJA.spread;
      g.projectiles.push({
        x: e.x, y: e.y - 6,
        vx: Math.cos(ang) * PAJA.spd, vy: Math.sin(ang) * PAJA.spd,
        t: 1.6, dmg: PAJA.dmg, element: 'sombra', from: 'enemy',
        sprite: 'shard', radius: 4.5, pierce: 0,
      });
    }
    audio.sfx('whoosh');
    g.burst(e.x, e.y - 6, '#d8c890', 6, 50);
    // siembra hecha: humo y dos pasos más allá (flanco determinista)
    g.burst(e.x, e.y, '#9aa0b8', 10, 60);
    const away = Math.atan2(e.y - p.y, e.x - p.x);
    const side = (m.seed & 1) === 0 ? 0.85 : -0.85;
    const tpA = away + side;
    const nx = e.x + Math.cos(tpA) * PAJA.tp;
    const ny = e.y + Math.sin(tpA) * PAJA.tp;
    if (g.boxFree(nx, ny, e.w, e.h)) {
      e.x = nx; e.y = ny;
      g.burst(nx, ny, '#9aa0b8', 8, 45);
      audio.sfx('shadow');
    } // sin sitio: el espantapájaros se queda en su poste (no teletransporta)
    m.st = 3;
    e.ai = 'recupera';
    e.aiT = 0.5;
    e.atkCd = 1.6 + ((m.seed >> 2) % 4) * 0.2; // 1.6-2.2 s por contrato
    e.telegraphKind = undefined;
    return;
  }
  if (m.st === 3) {
    e.aiT -= dt;
    e.moving = false;
    if (e.aiT <= 0) m.st = 0;
    return;
  }
  aggroCheck(g, e, p, dd2);
  if (!e.aggro) { e.moving = false; return; }
  // shamble torpe hacia el Portador (paja y hueso no corren)
  const dl = Math.sqrt(dd2) || 1;
  if (dl > 120) {
    const nx = (p.x - e.x) / dl, ny = (p.y - e.y) / dl;
    g.moveEntity(e, nx * PAJA.persSpd * spdMul(e) * dt, ny * PAJA.persSpd * spdMul(e) * dt);
    e.moving = true;
    e.dir = nx > 0 ? 'right' : 'left';
  } else e.moving = false;
  if (dd2 < 260 * 260 && e.atkCd <= 0) {
    startWindup(e, m, PAJA.windup, 'salva');
  }
}

// ============================================================
// EL CORO — 'coro': anillos de notas que se EXPANDEN (2 huecos alternos
// por ángulo áureo; cada 3er anillo es una ESPIRAL lenta con hueco girando).
// ZONA: nunca parryable (doctrina AoE) — se escapa por el hueco al compás.
// ============================================================

const CORO = { windup: 0.8, cd: 2.6, ringSpd: 92, spiralSpd: 66, maxR: 185, dmg: 9, spiralDmg: 11, persSpd: 22, band: 220 };

function tickCoro(g: Game, e: Enemy, p: Player, dt: number, m: MbMem): void {
  const dd2 = d2(e.x, e.y, p.x, p.y);
  if (m.st === 1) {
    e.windup -= dt;
    e.moving = false;
    if (e.windup > 0) return;
    // lanzar anillo: hueco alternante (ángulo áureo) — cada 3º, espiral
    const espiral = (m.castN % 3) === 2;
    let ring: RingState | null = null;
    for (let i = 0; i < m.rings.length; i++) {
      if (!m.rings[i].on) { ring = m.rings[i]; break; }
    }
    if (ring !== null) {
      ring.on = true;
      ring.x = e.x; ring.y = e.y;
      ring.r = 12;
      ring.spd = espiral ? CORO.spiralSpd : CORO.ringSpd;
      ring.maxR = CORO.maxR;
      ring.dmg = espiral ? CORO.spiralDmg : CORO.dmg;
      ring.gapA = (m.seed * 0.017 + m.castN * 2.399963) % 6.283185307179586;
      ring.gapW = espiral ? 0.9 : 1.1;
      ring.rot = espiral ? 0.55 : 0;
      ring.hit = false;
      audio.sfx('song');
      m.castN++;
    }
    m.st = 3;
    e.ai = 'recupera';
    e.aiT = 0.4;
    e.atkCd = CORO.cd;
    e.telegraphKind = undefined;
    return;
  }
  if (m.st === 3) {
    e.aiT -= dt;
    e.moving = false;
    if (e.aiT <= 0) m.st = 0;
    return;
  }
  aggroCheck(g, e, p, dd2);
  if (!e.aggro) { e.moving = false; return; }
  // deriva lenta manteniendo banda (las voces no pisan el compás)
  const dl = Math.sqrt(dd2) || 1;
  if (dl > 110) {
    const nx = (p.x - e.x) / dl, ny = (p.y - e.y) / dl;
    g.moveEntity(e, nx * CORO.persSpd * spdMul(e) * dt, ny * CORO.persSpd * spdMul(e) * dt);
    e.moving = true;
    e.dir = nx > 0 ? 'right' : 'left';
  } else e.moving = false;
  if (dd2 < CORO.band * CORO.band && e.atkCd <= 0) {
    startWindup(e, m, CORO.windup, 'aro');
  }
}

/** Paso de los anillos (corre SIEMPRE que el Coro viva, viento o no). */
function stepRings(g: Game, p: Player, dt: number, m: MbMem): void {
  for (let i = 0; i < m.rings.length; i++) {
    const r = m.rings[i];
    if (!r.on) continue;
    r.r += r.spd * dt;
    if (r.rot !== 0) r.gapA = (r.gapA + r.rot * dt) % 6.283185307179586;
    if (r.r >= r.maxR) { r.on = false; continue; }
    // banda de daño |d − r| < 7 (mismo convenio que las ondas del motor)
    const dd2 = d2(r.x, r.y, p.x, p.y);
    const bandLo = r.r - 7, bandHi = r.r + 7;
    if (dd2 <= bandLo * bandLo || dd2 > bandHi * bandHi) continue;
    // ¿hueco? (la misericordia del Coro): ángulo del Portador dentro del arco
    const ang = Math.atan2(p.y - r.y, p.x - r.x);
    let diff = ang - r.gapA;
    while (diff > 3.141592653589793) diff -= 6.283185307179586;
    while (diff < -3.141592653589793) diff += 6.283185307179586;
    if (diff > -r.gapW * 0.5 && diff < r.gapW * 0.5) continue; // escapa al compás
    if (r.hit) continue;
    r.hit = true;
    if (p.parryT > 0) {
      // zona = nunca parryable (doctrina interaccion 2.3-b): la ventana se
      // cierra con el MISMO feedback y el anillo entra (esquivable, no parable)
      p.parryT = 0;
      audio.sfx('parryFail');
      g.floatAt(p.x, p.y - 26, '¡no parryable!', '#9aa0b8', 6);
      g.burst(p.x, p.y - 8, '#8a90a8', 6, 40);
    } else {
      g.damagePlayer(r.dmg, r.x, r.y);
      addShake(g, 2);
    }
  }
}

// ============================================================
// EL CENTINELA — 'guardia': escudo FRONTAL (daño 0 mientras sostiene),
// barrido al contragolpe, y ruptura por la ESPALDA o tras PARRY del barrido
// (4 s vulnerable). Aún rinde honores a un trono que ya no existe.
// ============================================================

const GUARD = { windup: 0.5, sweepT: 0.28, cd: 2.0, dmg: 12, breakT: 4.0, walk: 30, back: 26 };

function guardiaAlFrente(e: Enemy, p: Player): boolean {
  // dir 4-vías (down/up/left/right) → vector; frente = dot > 0.3
  const dx = p.x - e.x, dy = p.y - e.y;
  let fx = 0, fy = 0;
  if (e.dir === 'left') fx = -1; else if (e.dir === 'right') fx = 1;
  else if (e.dir === 'up') fy = -1; else fy = 1;
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  return (fx * dx + fy * dy) / l > 0.3;
}

function romperEscudo(g: Game, e: Enemy, m: MbMem, porParry: boolean): void {
  m.shieldT = GUARD.breakT;
  addShake(g, porParry ? 4 : 3);
  audio.sfx('slam');
  g.burst(e.x, e.y - 6, '#8ab8e8', 14, 80);
  g.floatAt(e.x, e.y - 26, '¡ESCUDO ROTO!', '#ffe86a', 8);
  g.waves.push({ x: e.x, y: e.y, r: 6, maxR: 60, speed: 150, dmg: 0, hit: true }); // aviso visual, no daña
}

function tickGuardia(g: Game, e: Enemy, p: Player, dt: number, m: MbMem): void {
  const dd2 = d2(e.x, e.y, p.x, p.y);
  // escudo vivo: ABSORBE el daño frontal (hp restaurada) y se ROMPE con
  // golpe por la espalda. El quiebre (barra sta) atraviesa: vía frontal legítima.
  if (m.shieldT <= 0 && e.hp < m.lastHp) {
    if (guardiaAlFrente(e, p)) {
      e.hp = m.lastHp; // el acero rebota en la guarda: daño 0
      audio.sfx('blip');
      g.burst(e.x, e.y - 4, '#8ab8e8', 6, 55);
      g.floatAt(e.x, e.y - 22, 'ESCUDO', '#8ab8e8', 6);
    } else {
      romperEscudo(g, e, m, false);
    }
  }
  m.lastHp = e.hp;
  if (m.shieldT > 0) {
    // escudo roto: titubea hacia atrás, expuesto (la espalda abierta)
    m.shieldT -= dt;
    if (e.ai !== 'aturdido') {
      const dl = Math.sqrt(dd2) || 1;
      if (dl > 1 && dl < 90) {
        const nx = (e.x - p.x) / dl, ny = (e.y - p.y) / dl;
        g.moveEntity(e, nx * GUARD.back * spdMul(e) * dt, ny * GUARD.back * spdMul(e) * dt);
        e.moving = true;
      } else e.moving = false;
      e.ai = 'recupera';
    }
    if (m.shieldT <= 0) {
      // vuelve a alzar la guarda
      m.lastHp = e.hp;
      audio.sfx('phase');
      g.floatAt(e.x, e.y - 24, 'ESCUDO', '#8ab8e8', 6);
    }
    return;
  }
  if (m.st === 1) {
    // viento del barrido
    e.windup -= dt;
    e.moving = false;
    e.dir = p.x > e.x ? 'right' : 'left';
    if (e.windup <= 0) {
      m.st = 2;
      m.t1 = GUARD.sweepT;
      e.ai = 'ataca';
      e.aiT = GUARD.sweepT;
      e.telegraphKind = undefined;
      audio.sfx('whoosh');
    }
    return;
  }
  if (m.st === 2) {
    // barrido activo: parry del Portador ROMPE la guarda (contrato); si no,
    // melé parable por el camino nativo (damagePlayer → parada del motor)
    m.t1 -= dt;
    const dl = Math.sqrt(dd2) || 1;
    const enFrente = guardiaAlFrente(e, p) && dd2 < 38 * 38;
    if (enFrente) {
      if (p.parryT > 0) {
        romperEscudo(g, e, m, true);
        e.ai = 'aturdido';
        e.aiT = 0.9; // tambaleo breve tras la ruptura por parada
        m.st = 0;
        e.atkCd = GUARD.cd;
        return;
      }
      if (p.iframes <= 0 && p.rollT <= 0) g.damagePlayer(GUARD.dmg, e.x, e.y);
    }
    if (m.t1 <= 0) { m.st = 3; e.ai = 'recupera'; e.aiT = 0.5; e.atkCd = GUARD.cd; }
    return;
  }
  if (m.st === 3) {
    e.aiT -= dt;
    e.moving = false;
    if (e.aiT <= 0) m.st = 0;
    return;
  }
  aggroCheck(g, e, p, dd2);
  if (!e.aggro) { e.moving = false; return; }
  // marcha lenta SIN girar nunca la espalda: encara por eje dominante
  const dx = p.x - e.x, dy = p.y - e.y;
  const dl = Math.sqrt(dd2) || 1;
  e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  if (dl > 20) {
    g.moveEntity(e, (dx / dl) * GUARD.walk * spdMul(e) * dt, (dy / dl) * GUARD.walk * spdMul(e) * dt);
    e.moving = true;
  } else e.moving = false;
  if (dd2 < 34 * 34 && e.atkCd <= 0) {
    startWindup(e, m, GUARD.windup, 'aro');
    g.telegraphs.push({ x: e.x, y: e.y, r: 34, t: GUARD.windup, maxT: GUARD.windup, dmg: 0, kind: 'slam' });
  }
}

// ============================================================
// LA NODRIZA — 'nueces': invoca 2-3 AHOGADOS MENORES ('ahogado_r11',
// máx 3 vivos) y escupe un chorro de burbujas lento parryable.
// Siempre vuelve a llamarlos. Siempre responden.
// ============================================================

const NUEZ = { windup: 0.9, sumCd: 5.0, maxVivos: 3, bubbleCd: 3.4, bubbleDmg: 8, bubbleSpd: 95, persSpd: 24 };

/** Huellas fijas de invocación (pool de módulo: cero allocs). */
const NIDO: [number, number][] = [[-20, -10], [20, -10], [0, 16]];

function tickNueces(g: Game, e: Enemy, p: Player, dt: number, m: MbMem): void {
  const dd2 = d2(e.x, e.y, p.x, p.y);
  // ciclo de invocación (independiente del viento de burbujas)
  m.t2 -= dt;
  if (m.st === 0 && m.t2 <= 0 && e.aggro) {
    if (!ENEMY_DEFS['ahogado_r11']) {
      m.t2 = 5; // def no registrada aún (enganche B): reintenta sin crash
      return;
    }
    startWindup(e, m, NUEZ.windup, 'salva');
    m.hitDone = true; // marca: 1 = llama hijos · 0 = escupe burbujas (ver abajo)
    audio.sfx('shadow');
    return;
  }
  // chorro de burbujas lento (cadencia propia por atkCd)
  if (m.st === 0 && e.atkCd <= 0 && e.aggro && dd2 < 200 * 200) {
    startWindup(e, m, 0.6, 'salva');
    m.hitDone = false; // 0 = burbujas
    return;
  }
  if (m.st === 1) {
    e.windup -= dt;
    e.moving = false;
    e.dir = p.x > e.x ? 'right' : 'left';
    if (e.windup > 0) return;
    e.telegraphKind = undefined;
    if (m.hitDone) {
      // ---- llamada a la mesa: 2-3 ahogados, nunca más de 3 vivos ----
      let vivos = 0;
      for (let i = 0; i < g.enemies.length; i++) {
        const o = g.enemies[i];
        if (!o.dead && (o.etype as string) === 'ahogado_r11') vivos++;
      }
      let quiere = 2 + (m.seed % 2); // 2-3 por contrato
      for (let i = 0; i < NIDO.length && quiere > 0 && vivos < NUEZ.maxVivos; i++) {
        const nx = e.x + NIDO[i][0], ny = e.y + NIDO[i][1];
        if (!g.boxFree(nx, ny, 12, 10)) continue;
        // 'ahogado_r11' entra al union EnemyType con R11 (enganche B);
        // mismo cast defensivo que SPAWN_SEPULCRO_R10 en data.ts
        const hijo = g.makeEnemy('ahogado_r11' as unknown as Enemy['etype'], nx, ny, 0);
        hijo.aggro = true;
        hijo.spawnGuard = 0.35; // sube del fondo: gracia breve, no invulnerable al daño
        g.enemies.push(hijo);
        g.burst(nx, ny, '#4a88a8', 10, 60);
        vivos++;
        quiere--;
      }
      audio.sfx('splash');
      g.toast('La Nodriza llama a sus ahogados', '#7ac8d8');
      m.t2 = NUEZ.sumCd;
    } else {
      // ---- chorro de burbujas lento (parryable/reflejable gratis) ----
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = 0; i < 3; i++) {
        const ang = base + ((i / 2) - 0.5) * 0.35;
        g.projectiles.push({
          x: e.x, y: e.y - 6,
          vx: Math.cos(ang) * NUEZ.bubbleSpd, vy: Math.sin(ang) * NUEZ.bubbleSpd,
          t: 2.2, dmg: NUEZ.bubbleDmg, element: 'hielo', from: 'enemy',
          sprite: 'orb', radius: 5, pierce: 0,
        });
      }
      audio.sfx('splash');
      e.atkCd = NUEZ.bubbleCd;
    }
    m.st = 3;
    e.ai = 'recupera';
    e.aiT = 0.45;
    return;
  }
  if (m.st === 3) {
    e.aiT -= dt;
    e.moving = false;
    if (e.aiT <= 0) m.st = 0;
    return;
  }
  aggroCheck(g, e, p, dd2);
  if (!e.aggro) { e.moving = false; return; }
  // boga perezosa: la Nodriza no persigue, LLAMA
  const dl = Math.sqrt(dd2) || 1;
  if (dl > 100) {
    const nx = (p.x - e.x) / dl, ny = (p.y - e.y) / dl;
    g.moveEntity(e, nx * NUEZ.persSpd * spdMul(e) * dt, ny * NUEZ.persSpd * spdMul(e) * dt);
    e.moving = true;
    e.dir = nx > 0 ? 'right' : 'left';
  } else e.moving = false;
}

// ============================================================
// API PRINCIPAL
// ============================================================

/**
 * IA de un mini-jefe para este frame. El orquestador la llama desde
 * updateEnemy (enganche A) y hace `return` justo después: el cerebro
 * replica el bloque común del motor si hace falta (idempotente por frame).
 */
export function updateMiniboss(g: Game, e: Enemy, dt: number, pattern: MbPattern): void {
  if (e.dead) return;
  const p = g.player;
  if (!p) return;
  const m = memFor(g, e);
  if (commonTick(g, e, dt, m)) return; // spawnGuard / muerte por DoT
  if (g.state !== 'play') return;
  // aturdimiento (quiebre de barra, parada del motor o muro): reset + tick
  // del timer, idéntico al bloque 'aturdido' de update.ts (~1054)
  if (e.ai === 'aturdido') {
    e.aiT -= dt;
    e.moving = false;
    m.st = 0;
    if (e.aiT <= 0) { e.ai = 'persigue'; if (e.maxSta > 0) e.sta = e.maxSta; }
    return;
  }
  switch (pattern) {
    case 'carga': tickCarga(g, e, p, dt, m); break;
    case 'abanico': tickAbanico(g, e, p, dt, m); break;
    case 'coro': tickCoro(g, e, p, dt, m); break;
    case 'guardia': tickGuardia(g, e, p, dt, m); break;
    case 'nueces': tickNueces(g, e, p, dt, m); break;
  }
  // los anillos del Coro vuelan por sí solos, viento o no
  if (pattern === 'coro') stepRings(g, p, dt, m);
}

/**
 * Progreso 0..1 del viento de ataque en curso (para dibujar el anillo
 * convergente / arco de suelo exacto). 0 = arranca la carga, 1 = impacto
 * inminente; fuera de viento devuelve 0. Lectura pura: sin efectos.
 */
export function minibossTelegraph(e: Enemy, pattern: MbPattern): number {
  if (e.windup <= 0) return 0;
  const m = MEM.get(e);
  const wmax = m !== undefined && m.windupMax > 0 ? m.windupMax : WINDUP_BASE[pattern];
  const f = 1 - e.windup / wmax;
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

void MB_PATTERN_OF; // (referencia viva para el smoke; el consumo real es el orquestador)
