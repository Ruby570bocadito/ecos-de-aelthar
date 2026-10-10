// ============================================================
// ECOS DE AELTHAR — 19-c · JEFE «LA MAREA SIN NOMBRE»
// (Costa de Bruma · agente 19-c, módulo autocontenido)
//
// La marea que arrastró a los primeros cantores. JEFE de 3 fases
// por hp% (patrón guardianBrain / tickVult / tickSirena):
//
//   FASE 1 · FLUJO  (>60%): avanza lento (speed 34). Cada atkCd:
//     · d ≥ 150 px → OLA EN ABANICO: 3 proyectiles 'orb' (element
//       'hielo', el literal acuático del proyecto) en abanico de 25°.
//     · d < 150 px → BARRIDO melee telegrafiado: windup 0.9 con
//       e.telegraphKind='aro' + telegraph (r 64) que explota al
//       expirar (el motor aplica el daño en update.ts:518-531).
//
//   FASE 2 · PLEAMAR (60-30%, transición UNA vez): toast + sfx
//     'roar' + invulT 1.2 s (render la dibuja sumergida, frame 4) +
//     flash/shake/slowmo. speed sube a 44. Dos mecánicas nuevas:
//     · ESPUMA-LÍNEA: cada 7 s, muro lineal de 4 orbes lentos
//       (|v| 55) que avanza desde su flanco — velocidad PERPENDICULAR
//       al eje jefe→Portador, flanco alternante determinista.
//     · LLAMARADA DE SAL: ciclo de ataques alterna abanico → salto:
//       windup 0.9 telegrafiado sobre el Portador (invulT en el
//       aire, patrón saltoVult) y al caer onda de choque g.waves
//       (maxR 110, speed 150) + burst de espuma.
//
//   FASE 3 · RESACA (<30%): comportamiento desesperado. NOTA DE
//     DISEÑO (19-c): la misión pedía «sta -extra al recibir daño»,
//     pero damageEnemy es del motor (congelado) — se aplica la
//     alternativa documentada: sus ataques pasan al 60% de cadencia
//     (atkCd × 1/0.6) y su daño sube un 20% (todo lo que emite:
//     orbes, barrido, onda y espuma). Al entrar invoca 2
//     sombras-espuma (g.makeEnemy('sombra', …, 0, 'mini') — método
//     del Game, permitido) y no vuelve a hacerlo hasta recomenzar
//     el combate (memoria por enemigo en WeakMap).
//
//   · Anti-spam de weakTo: nada especial — el motor ya aplica
//     weakTo ×1.5 (engine.ts:1763). El quiebre/aturdido usa
//     e.sta/maxSta (breakBar 90) EXACTAMENTE como los demás jefes:
//     damageEnemy baja sta y fija ai='aturdido' (engine.ts:1769-1779);
//     este cerebro solo gestiona la cuenta atrás y la recuperación
//     de la barra (stun 2.6 s, como la sirena).
//   · Determinismo: CERO Math.random — mulberry32 local con semilla
//     derivada de homeX/homeY (estable por partida). Estado por
//     partida en WeakMap<Enemy, MareaMem> (seguro HMR/multi-instancia).
//   · Daño al Portador SOLO vía proyectiles from:'enemy', g.waves,
//     telegraphs y g.damagePlayer del motor (i-frames/parada = motor).
//   · Movimiento SOLO vía g.moveEntity (colisión de tiles = motor).
//
// ============================================================
// ════════════════════════════════════════════════════════════
// PUNTOS DE CABLEADO PARA EL INTEGRADOR (nombres exactos)
// ════════════════════════════════════════════════════════════
//
// (1) src/game/types.ts:13 — EnemyType: añadir 'marea' a la unión:
//       … | 'satiro' | 'heraldo' | 'marea' // 19-c: jefe La Marea Sin Nombre
//
// (2) src/game/data.ts — registrar la def (patrón ENEMY_DEFS_14A:1404):
//       import { MAREA_DEF_R19 } from './jefe_marea_r19';   // 19-c
//       Object.assign(ENEMY_DEFS, { marea: MAREA_DEF_R19 }); // 19-c (tras el literal base o tras ENEMY_DEFS_16A)
//
// (3) src/game/engine.ts:621-622 — hitbox grande de jefe: añadir
//     `|| type === 'marea'` a AMBOS condicionales (22×16, igual que
//     guardian|sirena|golem|vult|coro).
//
// (4) src/game/engine.ts:84-91 — BOSS_DEFEAT_FLAG: añadir
//       marea: 'mareaDefeated', // 19-c
//
// (5) src/game/engine.ts killEnemy (~1907, tras la rama 'coro') — BOTÍN 19-c:
//     (el oro 260-340 y la XP 380 salen solos del def arriba):
//       } else if (e.etype === 'marea') {
//         this.flags.mareaDefeated = true;
//         this.flags.perla_marea = true;          // NO es item clave (arco principal intacto)
//         delete this.flags.bossHp_costa;
//         this.bossActive = false;
//         audio.setCombat(false);
//         audio.playTrack('costa');
//         this.shake = 8;
//         audio.sfx('song');
//         this.toast('La Marea Sin Nombre se deshace en espuma que recuerda un nombre...', '#bff0f4');
//         this.toast('La perla de la Marea brilla en tu bolsillo', '#ffe9a0');
//         p.potions += 1;                          // +1 poción (economía 10-b)
//         this.floatAt(e.x, e.y - 34, 'Botín del jefe: +1 poción · Perla de la Marea', '#7ef0a0');
//       }
//
// (6) src/game/update.ts:65 — EXPANSION_TYPES: añadir 'marea' al Set.
//
// (7) src/game/enemies_expansion.ts:1822 — expansionTick, añadir el case
//     (la firma de tickMareaR19 REPLICA la forma del dispatcher; el 5º
//     parámetro se acepta y se IGNORA: el cerebro lleva su propia WeakMap):
//       case 'marea': return tickMareaR19(g, e, dt, def, mem(e)); // 19-c
//     Import: `import { tickMareaR19 } from './jefe_marea_r19';`
//     (jefe_marea_r19 NO importa enemies_expansion ni update.ts → sin ciclos).
//
// (8) src/game/update.ts:415-424 — activación del jefe (opcional, rama de
//     toasts): añadir
//       } else if (bossSpawn.type === 'marea') {
//         g.toast('La Marea Sin Nombre despierta: ROMPE SU BARRA DE QUIEBRE', '#bff0f4');
//         audio.sfx('splash');
//       }
//
// (9) src/game/engine.ts constructor — sprites (idempotente):
//       import { initJefeMareaR19Sprites } from './jefe_marea_r19'; // 19-c
//       initJefeMareaR19Sprites();   // tras initExpansionSprites()
//
// (10) src/game/challenge.ts:52-56 — BOSS_INFO (banner del duelo): añadir
//       marea: MAREA_BOSS_INFO_R19,   // import de este módulo
//     (en campaña el banner lo pone el PROPIO cerebro al primer aggro:
//     g.bossBannerText='LA MAREA SIN NOMBRE' / sub 'El abismo también canta').
//
// (11) src/game/maps_expansion.ts — spawns de costa: añadir
//       { type: 'marea', x: MAREA_SPAWN_R19.x, y: MAREA_SPAWN_R19.y, zone: 'boss' }, // 19-c
//     ⚠ ATENCIÓN: costa YA TIENE un spawn zone:'boss' (sirena en 39,24) y
//     update.ts:407 activa solo el PRIMERO (spawns.find). El integrador debe
//     decidir: (a) cambiar la sirena a zone:'costa' y dejar 'marea' como único
//     'boss' de costa, o (b) generalizar el watcher a varios zone:'boss'.
//     MAREA_SPAWN_R19 = { map:'costa', x:25, y:33 } — tile 's' de la playa sur
//     (8/8 vecinos libres), BFS-verificado desde la llegada lunaris→costa
//     (26,2). El (25,39) propuesto era MAR SÓLIDO ('~', oleaje y36..39) y la
//     misma orilla (25,35) queda encajonada contra el mar (5/8 vecinos) →
//     corregido dos tiles al norte, sobre la arena.
//
// (12) update.ts:396 — expansionDeathFx: NO hace falta añadir 'marea' (el
//     cerebro lleva guarda de muerte propia con FX de espuma; es no-op si
//     killEnemy ya corrió). Añadirla sería duplicar el FX.
//
// (13) Barra de jefe en save/load (engine.ts:492 bossHp_${mapId}): ya es
//     genérica por bossRef — sin cambios.
// ============================================================

import type { Game } from './engine';
import type { Enemy, MapId, Player } from './types';
import type { EnemyDef } from './data'; // type-only: sin carga del módulo de datos
import { audio } from './audio';
import { addFlash, addShake, requestSlowmo } from './fxcore';
import { registerSpr } from './sprites';
import type { Frames } from './sprites';

// ============================================================
// 1) DEF del jefe (EnemyDef completo, formato data.ts:761)
// ============================================================

/**
 * Def de «La Marea Sin Nombre». element 'hielo' = el literal acuático que ya
 * usa la Sirena Abisal (types.ts:14 no tiene 'agua'); weakTo 'rayo' (literal
 * existente, mismo eje elemental que la sirena). Botín: oro [260,340] + XP 380
 * vía killEnemy (rama documentada arriba) — el resto de botín es flags+toast.
 */
export const MAREA_DEF_R19: EnemyDef = {
  name: 'La Marea Sin Nombre',
  hp: 580, dmg: 16, speed: 34, xp: 380, gold: [260, 340],
  sprite: 'marea',
  aggroR: 170, atkR: 46, windup: 0.9, atkCd: 2.4,
  element: 'hielo', weakTo: 'rayo', breakBar: 90, // literales exactos de Element (types.ts:14)
  desc: 'Es la marea que arrastró a los primeros cantores la noche que el canto del dios murió. Sube sin prisa, borra las orillas y devuelve los nombres en blanco: el abismo también canta.',
};

/** Banner/retrato (formato BOSS_INFO de challenge.ts:52-56). */
export const MAREA_BOSS_INFO_R19 = {
  name: 'La Marea Sin Nombre',
  sub: 'El abismo también canta',
} as const;

/**
 * Spawn propuesto (mapa costa 52×40). El (25,39) original es MAR SÓLIDO:
 * buildCosta fija wave = 35 + ((25·7+3)%3) = 36 → y36..39 son '~'. Se elige
 * (25,33), tile 's' de la playa sur que alcanza la pleamar: 8/8 vecinos
 * transitables (espacio de maniobra para la hitbox 22×16), BFS-verificado
 * desde la llegada de lunaris→costa (26,2) — ver scripts/smoke_jefe_marea_r19.ts.
 */
export const MAREA_SPAWN_R19: { map: MapId; x: number; y: number } = {
  map: 'costa', x: 25, y: 33,
};

// ============================================================
// 2) CEREBRO — tickMareaR19 (SIEMPRE return true: consume el frame,
//    como tickSirena/tickVult; el motor salta su IA genérica)
// ============================================================

// ---------------- constantes de combate ----------------

const TAU = Math.PI * 2;

// fases por hp% (mismos umbrales que guardian/tickVult: 0.6 / 0.3)
const STUN_T = 2.6;          // quebrado: igual que la sirena (commonTick)

// fase 1 · FLUJO
const ABANICO_N = 3;                     // orbes por abanico
const ABANICO_SPREAD = (25 * Math.PI) / 180; // abanico total de 25°
const ABANICO_SPEED = 130;
const ABANICO_T = 2.4;                   // vida del orbe (s)
const ABANICO_DMG = 0.7;                 // × def.dmg (11 con dmg 16)
const BARRIDO_D = 150;                   // <150 px prefiere el barrido melee
const BARRIDO_R = 64;                    // radio del telegraph 'aro' (barrido)

// fase 2 · PLEAMAR
const SPD_F2 = 44;                       // speed sube de 34 a 44
const ESPUMA_CADENCE = 7;                // espuma-línea cada 7 s
const ESPUMA_N = 4;                      // muro lineal de 4 orbes
const ESPUMA_SPEED = 55;                 // lentos
const ESPUMA_T = 5.0;
const ESPUMA_DMG = 0.6;                  // × def.dmg (≈10)
const ESPUMA_GAP = 13;                   // separación del muro (px)
const SALTO_WINDUP = 0.9;                // telegrafía del salto (= def.windup)
const SALTO_R = 44;                      // telegraph slam
const SALTO_ONDA_MAXR = 110;             // shockwave al caer
const SALTO_ONDA_SPEED = 150;
const SALTO_ONDA_DMG = 0.8;              // × def.dmg

// fase 3 · RESACA (alternativa documentada a «sta -extra»)
const F3_CADENCE = 1 / 0.6;              // cadencia al 60% → atkCd × 1.667
const F3_DMG = 1.2;                      // daño +20% en todo lo que emite
const RESACA_SUMMONS = 2;                // sombras-espuma al entrar

// ---------------- memoria por enemigo (WeakMap: no persiste) ----------------

interface MareaMem {
  // señales de colocación (patrón ExpMem.lastAnim/lastAtkCd)
  lastAnim?: number;
  lastAtkCd?: number;
  prevHitFlash?: number;
  // fases
  bannerHecho?: boolean;   // intro del jefe (una vez por combate)
  // ciclo de ataques (fase 2+: alterna abanico/salto)
  ciclo?: number;
  act?: 'abanico' | 'barrido' | 'salto';
  saltoX?: number;
  saltoY?: number;
  // espuma-línea
  espumaT?: number;
  flanco?: number;         // 0/1 → barrido lateral alternante determinista
  // rng determinista por partida (mulberry32, semilla fija por spawn)
  rng: () => number;
  // guarda del FX de muerte (no-op si killEnemy ya corrió)
  muertoFx?: boolean;
}

const MAREA_MEM = new WeakMap<Enemy, MareaMem>();

function mareaMem(e: Enemy): MareaMem {
  let m = MAREA_MEM.get(e);
  if (!m) {
    // semilla derivada del hogar del spawn: determinista, sin Math.random
    // ni reloj — dos partidas con el mismo spawn siguen la misma secuencia.
    const seed = (0x9e3779b9 ^ Math.imul(e.homeX | 0, 0x85ebca6b) ^ Math.imul(e.homeY | 0, 0xc2b2ae35)) >>> 0;
    m = { rng: mulberry32(seed) };
    MAREA_MEM.set(e, m);
  }
  return m;
}

/** PRNG determinista local (cero Math.random en el módulo). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- utilidades ----------------

function dmgMult(e: Enemy): number {
  return e.phase >= 3 ? F3_DMG : 1; // RESACA: desesperada, pega un 20% más
}

function cadMult(e: Enemy): number {
  return e.phase >= 3 ? F3_CADENCE : 1; // RESACA: ataques al 60% de cadencia
}

/** Mueve hacia (tx,ty) con colisión (g.moveEntity) y fija dir/moving. */
function moveMarea(g: Game, e: Enemy, tx: number, ty: number, spd: number, dt: number): void {
  const dx = tx - e.x, dy = ty - e.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-4) { e.moving = false; return; }
  g.moveEntity(e, (dx / l) * spd * dt, (dy / l) * spd * dt);
  e.moving = true;
  if (Math.abs(dx) > 0.01) e.dir = dx > 0 ? 'right' : 'left';
}

/** Orbe de marea (element 'hielo' = literal acuático; sprite 'orb' del Acto II). */
function pushOrb(g: Game, x: number, y: number, vx: number, vy: number, dmg: number, t: number): void {
  g.projectiles.push({
    x, y, vx, vy, t, dmg, element: 'hielo', from: 'enemy', sprite: 'orb', radius: 5, pierce: 0,
  });
}

// ---------------- bloque común (réplica mínima de commonTick) ----------------

/**
 * RÉPLICA MÍNIMA del prep común — commonTick (enemies_expansion.ts:184) NO es
 * export y no puede llamarse. Colocación canónica del cerebro: update.ts:704
 * (vía expansionTick), ANTES de atkCd(725)/anim(726)/aturdido(728)/aggro(707).
 * Por tanto aquí SOLO se replica lo que el motor NO hizo antes del despacho:
 *   · atkCd decay (con guard lastAtkCd anti doble-decaimiento)
 *   · anim (el motor no llega a 726 si el cerebro consume el frame)
 *   · aggro por distancia (el motor lo hace en 707-724, DESPUÉS del despacho)
 *   · aturdido/quebrado completo (cuenta atrás + recuperación de sta)
 *   · guardas de robustez (spawnGuard/hitFlash) no-ops en la colocación
 *     canónica (update.ts:673/674 ya actúan; patrón commonTick por si el
 *     integrador colocara el tick antes del bloque común).
 * DESVIACIÓN DOCUMENTADA vs commonTick: invulT NO se decae aquí — el motor ya
 * lo hace en update.ts:703 antes del despacho (commonTick lo decae «siempre»
 * y produce doble decaimiento en la colocación canónica). Los estados
 * (quemado/congelado/knockback/marca) tampoco se replican: el motor los lleva
 * en 682-699, antes del despacho.
 * Devuelve true si el frame queda consumido (aturdido/spawnGuard).
 */
function commonMarea(g: Game, e: Enemy, dt: number, def: EnemyDef, m: MareaMem): boolean {
  const p = g.player;

  // ¿el motor ya pasó por updateEnemy este frame? (anim solo cambia ahí)
  const motorRan = m.lastAnim !== undefined && e.anim !== m.lastAnim;

  // spawnGuard (invocaciones: sin aggro inicial) — no-op en colocación canónica
  if (e.spawnGuard && e.spawnGuard > 0) {
    if (!motorRan) e.spawnGuard = Math.max(0, e.spawnGuard - dt);
    if (e.spawnGuard > 0) return true;
  }

  // hitFlash: decae solo si el motor aún no lo hizo (patrón commonTick:201)
  const prev = m.prevHitFlash ?? 0;
  if (!motorRan && e.hitFlash > 0 && Math.abs(e.hitFlash - prev) < 1e-9) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
  }
  m.prevHitFlash = e.hitFlash;

  if (e.hp < e.maxHp) e.aggro = true; // idempotente con update.ts:700

  // atkCd: decae solo si el motor no lo hizo ya este frame
  if (m.lastAtkCd === undefined || Math.abs(e.atkCd - m.lastAtkCd) < 1e-9) e.atkCd -= dt;

  // anim (cosmético) si el motor no lo hizo
  if (!motorRan) e.anim += dt * (e.ai === 'persigue' ? 1.4 : 0.6);

  // timer auxiliar (contrato types.ts:131)
  e.subT = (e.subT ?? 0) + dt;

  // aggro por distancia (réplica de update.ts:707-724; los jefes NO pitan:
  // su banner lo dispara el cerebro, misma técnica que sirena/golem/vult)
  if (p && !e.aggro && g.state === 'play') {
    const night = g.dayT > 0.7 || g.dayT < 0.08 ? 1.3 : 1; // isNight sin importar update.ts
    if (Math.hypot(p.x - e.x, p.y - e.y) < def.aggroR * night) e.aggro = true;
  }

  // QUEBRADO/ATURDIDO — mismo patrón que update.ts:728-733 y commonTick:254:
  // el motor fija aiT=4 genérico al quebrar (engine.ts:1771-1779); aquí se
  // ajusta a su duración propia y, al salir, recupera la barra completa
  // (clave para el REMATE del Portador).
  if (e.ai === 'aturdido') {
    if (e.aiT > STUN_T) e.aiT = STUN_T;
    e.aiT -= dt;
    e.moving = false;
    e.windup = 0;
    e.telegraphKind = undefined;
    // la espuma se le escapa mientras está quebrada (rng determinista)
    if (m.rng() < 0.6) {
      g.particles.push({
        x: e.x + (m.rng() - 0.5) * 20, y: e.y - 6 - m.rng() * 10,
        vx: (m.rng() - 0.5) * 16, vy: -22 - m.rng() * 16,
        t: 0.5, maxT: 0.5, color: '#bff0f4', size: 1.6, grav: 0,
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

// ---------------- ataques ----------------

/** OLA EN ABANICO (fase 1 y ciclo par de fase 2+): 3 orbes en 25°. */
function iniciarAbanico(g: Game, e: Enemy, m: MareaMem): void {
  e.ai = 'carga';
  m.act = 'abanico';
  e.windup = 0.9; // def.windup
  e.telegraphKind = 'salva'; // marca de cast (contrato types.ts:128)
}

function resolverAbanico(g: Game, e: Enemy, p: Player, def: EnemyDef): void {
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  const dmg = Math.max(1, Math.round(def.dmg * dmgMult(e) * ABANICO_DMG));
  for (let i = 0; i < ABANICO_N; i++) {
    const a = base + (i / (ABANICO_N - 1) - 0.5) * ABANICO_SPREAD;
    pushOrb(g, e.x, e.y - 4, Math.cos(a) * ABANICO_SPEED, Math.sin(a) * ABANICO_SPEED, dmg, ABANICO_T);
  }
  audio.sfx('splash');
}

/** BARRIDO melee telegrafiado: telegraph 'aro' sobre ELLA que explota al expirar. */
function iniciarBarrido(g: Game, e: Enemy, def: EnemyDef, m: MareaMem): void {
  e.ai = 'carga';
  m.act = 'barrido';
  e.windup = 0.9; // def.windup
  e.telegraphKind = 'aro'; // misma marca que el tajo de Vult (update.ts aplica el daño)
  g.telegraphs.push({
    x: e.x, y: e.y, r: BARRIDO_R, t: 0.9, maxT: 0.9,
    dmg: Math.max(1, Math.round(def.dmg * dmgMult(e))), kind: 'aro',
  });
  audio.sfx('whoosh');
}

/** LLAMARADA DE SAL (fase 2+): salta sobre el Portador y cae con shockwave. */
function iniciarSalto(g: Game, e: Enemy, p: Player, def: EnemyDef, m: MareaMem): void {
  e.ai = 'carga';
  m.act = 'salto';
  m.saltoX = p.x; // centro del telegraph (predicción directa; patrón saltoVult)
  m.saltoY = p.y;
  e.windup = SALTO_WINDUP;
  e.telegraphKind = 'slam';
  e.invulT = Math.max(e.invulT ?? 0, SALTO_WINDUP); // en el aire
  g.telegraphs.push({
    x: p.x, y: p.y, r: SALTO_R, t: SALTO_WINDUP, maxT: SALTO_WINDUP,
    dmg: Math.max(1, Math.round(def.dmg * dmgMult(e))), kind: 'slam',
  });
  audio.sfx('whoosh');
}

function resolverSalto(g: Game, e: Enemy, def: EnemyDef, m: MareaMem): void {
  // aterriza donde telegrafiaba (si el tile es pisable) + onda de choque
  if (m.saltoX !== undefined && m.saltoY !== undefined && !g.tileSolidAt(m.saltoX, m.saltoY)) {
    e.x = m.saltoX;
    e.y = m.saltoY;
  }
  m.saltoX = undefined;
  m.saltoY = undefined;
  g.waves.push({
    x: e.x, y: e.y, r: 10, maxR: SALTO_ONDA_MAXR, speed: SALTO_ONDA_SPEED,
    dmg: Math.max(1, Math.round(def.dmg * dmgMult(e) * SALTO_ONDA_DMG)), hit: false,
  });
  addShake(g, 6);
  audio.sfx('splash');
  g.burst(e.x, e.y, '#bff0f4', 22, 110);
}

/** ESPUMA-LÍNEA (fase 2+, cada 7 s): muro lineal de 4 orbes lentos que barre
 *  desde su flanco — velocidad perpendicular al eje jefe→Portador. */
function fireEspuma(g: Game, e: Enemy, p: Player, def: EnemyDef, m: MareaMem): void {
  const ang = Math.atan2(p.y - e.y, p.x - e.x);
  const perp = ang + ((m.flanco ?? 0) === 1 ? Math.PI / 2 : -Math.PI / 2); // flanco alternante
  const vx = Math.cos(perp) * ESPUMA_SPEED;
  const vy = Math.sin(perp) * ESPUMA_SPEED;
  const dmg = Math.max(1, Math.round(def.dmg * dmgMult(e) * ESPUMA_DMG));
  for (let i = 0; i < ESPUMA_N; i++) {
    const off = (i - (ESPUMA_N - 1) / 2) * ESPUMA_GAP; // muro a lo largo del eje
    pushOrb(g, e.x + Math.cos(ang) * off, e.y + Math.sin(ang) * off, vx, vy, dmg, ESPUMA_T);
  }
  audio.sfx('splash');
  g.floatAt(e.x, e.y - 24, 'ESPUMA', '#bff0f4', 7);
}

/** FX de muerte propio (guarda: no-op si killEnemy ya corrió — ver cableado (12)). */
function muerteMarea(g: Game, e: Enemy, m: MareaMem): void {
  if (m.muertoFx) return;
  m.muertoFx = true;
  g.burst(e.x, e.y, '#bff0f4', 30, 120);
  g.burst(e.x, e.y - 8, '#ffd88a', 12, 90);
  addShake(g, 7);
  requestSlowmo(g, 0.3);
  audio.sfx('splash');
}

// ---------------- tick principal ----------------

/**
 * Cerebro del jefe «La Marea Sin Nombre». SIEMPRE devuelve true (frame
 * consumido). 5º parámetro replicado del dispatcher (mem(e) de
 * enemies_expansion) y ACEPTADO PERO IGNORADO: el cerebro mantiene su propia
 * WeakMap (MareaMem) para no acoplarse al tipo privado ExpMem.
 */
export function tickMareaR19(g: Game, e: Enemy, dt: number, def: EnemyDef, _m: unknown): boolean {
  void _m; // contrato del dispatcher: forma uniforme, estado propio en WeakMap
  const m = mareaMem(e);

  // guarda de muerte: FX de espuma antes de que el motor filtre el cadáver
  if (e.hp <= 0 && !e.dead) { muerteMarea(g, e, m); return true; }

  if (commonMarea(g, e, dt, def, m)) {
    m.lastAnim = e.anim;
    m.lastAtkCd = e.atkCd;
    return true;
  }

  const p = g.player;
  if (!p) {
    e.moving = false;
    m.lastAnim = e.anim;
    m.lastAtkCd = e.atkCd;
    return true;
  }
  const d = Math.hypot(p.x - e.x, p.y - e.y);

  // ---- banner del jefe (primera vez que aggro; técnica sirena/vult) ----
  if (e.aggro && !m.bannerHecho && !g.flags.mareaIntro) {
    m.bannerHecho = true;
    g.flags.mareaIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = 'LA MAREA SIN NOMBRE';
    g.bossBannerSub = MAREA_BOSS_INFO_R19.sub;
    addFlash(g, '#bff0f4', 0.25);
    addShake(g, 4);
    audio.sfx('banner');
    g.toast('La marea que arrastró a los primeros cantores se alza en la orilla', '#bff0f4');
  }

  // ---- fases por hp% (1: >60% · 2: 60-30% · 3: <30%) ----
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
  if (newPhase > e.phase) {
    e.phase = newPhase;
    e.windup = 0;
    if (e.ai === 'carga') e.ai = 'persigue';
    addFlash(g, '#bff0f4', 0.22);
    addShake(g, 5);
    requestSlowmo(g, 0.25);
    audio.sfx('roar');
    if (newPhase === 2) {
      // PLEAMAR (una vez): sube la marea — invulnerable durante la transición
      e.invulT = Math.max(e.invulT ?? 0, 1.2);
      m.espumaT = 0;
      m.ciclo = 0;
      g.toast('PLEAMAR: la Marea sube y el abismo respira contigo', '#bff0f4');
      g.floatAt(e.x, e.y - 26, 'PLEAMAR', '#bff0f4', 9);
    } else {
      // RESACA: desesperada — llama a lo que la marea arrastró (UNA vez)
      g.toast('RESACA: la Marea se vacía y llama a lo que arrastró', '#ffd88a');
      g.floatAt(e.x, e.y - 26, 'RESACA', '#ffd88a', 9);
      for (let i = 0; i < RESACA_SUMMONS; i++) {
        const s = g.makeEnemy('sombra', e.x + (i === 0 ? -24 : 24), e.y + 12, 0, 'mini');
        s.aggro = true;
        g.enemies.push(s);
      }
      g.burst(e.x, e.y, '#ffd88a', 16, 90);
    }
  }

  // ---- ESPUMA-LÍNEA (fase 2+, cada 7 s de combate; no durante el quebrado) ----
  if (e.aggro && e.phase >= 2 && e.ai !== 'aturdido') {
    m.espumaT = (m.espumaT ?? 0) + dt;
    if (m.espumaT >= ESPUMA_CADENCE) {
      m.espumaT = 0;
      m.flanco = (m.flanco ?? 0) === 0 ? 1 : 0; // barrido lateral alternante
      fireEspuma(g, e, p, def, m);
    }
  }

  // velocidad: FLUJO lento (34) → PLEAMAR/RESACA aceleran (44)
  const spd = e.phase >= 2 ? SPD_F2 : def.speed;

  switch (e.ai) {
    case 'patrulla': {
      // marea en reposo: deambula pegada a su orilla
      e.aiT -= dt;
      if (e.aiT <= 0) { e.aiT = 2 + m.rng() * 2; e.patrolAngle = m.rng() * TAU; }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 50;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveMarea(g, e, e.x + Math.cos(ang), e.y + Math.sin(ang), def.speed * 0.35, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      // la marea SIEMPRE avanza: presión constante, nunca se pega del todo
      if (d > 30) moveMarea(g, e, p.x, p.y, spd, dt);
      else e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.atkCd <= 0) {
        if (e.phase === 1) {
          // FLUJO: barrido melee si la tienes cerca; ola en abanico si lejos
          if (d < BARRIDO_D) iniciarBarrido(g, e, def, m);
          else iniciarAbanico(g, e, m);
        } else if (d < def.atkR + 8) {
          iniciarBarrido(g, e, def, m);
        } else {
          // PLEAMAR/RESACA: ciclo alterno abanico → salto → abanico → …
          m.ciclo = (m.ciclo ?? 0) + 1;
          if (m.ciclo % 2 === 1) iniciarSalto(g, e, p, def, m);
          else iniciarAbanico(g, e, m);
        }
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) {
        e.telegraphKind = undefined;
        if (m.act === 'barrido') {
          // el daño del barrido lo aplica el motor al expirar el telegraph
          audio.sfx('splash');
          g.burst(e.x, e.y + 2, '#bff0f4', 12, 80);
          e.atkCd = def.atkCd * cadMult(e);
          e.ai = 'recupera';
          e.aiT = 0.45;
        } else if (m.act === 'salto') {
          resolverSalto(g, e, def, m);
          e.atkCd = def.atkCd * cadMult(e);
          e.ai = 'recupera';
          e.aiT = 0.55;
        } else {
          resolverAbanico(g, e, p, def);
          e.atkCd = def.atkCd * cadMult(e);
          e.ai = 'recupera';
          e.aiT = 0.4;
        }
      }
      break;
    }
    case 'ataca': {
      // estado de tránsito (no se usa: los ataques resuelven en 'carga')
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0) e.ai = 'persigue';
      break;
    }
    case 'recupera': {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0) e.ai = 'persigue';
      break;
    }
    default:
      break;
  }

  m.lastAnim = e.anim;
  m.lastAtkCd = e.atkCd;
  return true;
}

// ============================================================
// 3) SPRITE — masa de agua con corona de espuma, núcleo oscuro y
//    ojos de bioluminiscencia (26×22 · 5 frames, determinista)
//    Frames: 0/1 idle (bob + corona que ondea) · 2 cast/telegraph
//    (núcleo encendido, espuma concentrada) · 3 ataque (látigo de
//    marea extendido) · 4 invulT/sumergida (solo corona y ojos).
//    Contrato render (render.ts:337-342): fi=2 en windup, fi=3 en
//    'ataca', fi=4 con invulT>0 — índices ya en ese orden.
// ============================================================

// paleta 19-c (base/medio/espuma/acento + variantes documentadas)
const M_AGUA = '#0e3a4a';   // base
const M_AGUA2 = '#2a7a8a';  // medio
const M_AGUA3 = '#07242e';  // núcleo oscuro (sombra profunda del base)
const M_ESPUMA = '#bff0f4'; // espuma
const M_ESPUMA2 = '#e8fcff';// brillo de la espuma
const M_ORO = '#ffd88a';    // acento bioluminiscente

function mcv(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

function mrc(x: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, col: string): void {
  x.fillStyle = col;
  x.fillRect(rx, ry, rw, rh);
}

/** Disco pixelado determinista (masa de agua redondeada). */
function mdisc(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, alpha = 1): void {
  x.globalAlpha = alpha;
  x.fillStyle = col;
  const top = Math.ceil(r);
  for (let dy = -top; dy <= top; dy++) {
    const w = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (w < 0.35 && Math.abs(dy) > 0) continue;
    x.fillRect(Math.round(cx - w), cy + dy, Math.max(1, Math.round(w * 2 + 1)), 1);
  }
  x.globalAlpha = 1;
}

/** Corona de espuma: dientes deterministas desplazables (fase de la ola). */
function coronaEspuma(x: CanvasRenderingContext2D, cx: number, topY: number, fase: number): void {
  // base continua
  mrc(x, cx - 9, topY + 2, 18, 2, M_ESPUMA);
  // dientes: alturas fijas por columna (permutadas por `fase`, sin rng)
  const hs = [3, 5, 2, 6, 4, 3, 5, 2, 4];
  for (let i = 0; i < 9; i++) {
    const h = hs[(i + fase) % hs.length];
    mrc(x, cx - 8 + i * 2, topY + 3 - h, 2, h, M_ESPUMA);
  }
  // brillos
  mrc(x, cx - 6 + fase * 2, topY - 1, 2, 1, M_ESPUMA2);
  mrc(x, cx + 3 - fase * 2, topY + 1, 1, 1, M_ESPUMA2);
}

function buildMareaR19Local(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 5; f++) {
    const { c, x } = mcv(26, 22);
    const bob = f === 1 ? 1 : 0;             // idle B baja 1 px
    const sway = f === 0 ? 1 : -1;           // la corona ondea
    const cast = f === 2;                    // windup: núcleo encendido
    const whip = f === 3;                    // ataque: látigo de marea
    const under = f === 4;                   // invulT: sumergida
    const cy = 13 + bob;                     // centro de la masa

    if (under) {
      // SUMERGIDA (transición PLEAMAR / invulT): solo corona y ojos sobre el agua
      mdisc(x, 13, 17, 7, M_AGUA, 0.9);
      mrc(x, 4, 14, 18, 2, M_AGUA2);
      coronaEspuma(x, 13, 8, 1);
      x.globalAlpha = 0.75;
      mrc(x, 3, 17, 20, 1, M_AGUA2);
      mrc(x, 5, 19, 16, 1, M_AGUA2);
      x.globalAlpha = 1;
      mrc(x, 10, 12, 2, 2, M_ORO);           // ojos sobre la línea de agua
      mrc(x, 14, 12, 2, 2, M_ORO);
      mrc(x, 10, 12, 1, 1, M_ESPUMA2);
      mrc(x, 14, 12, 1, 1, M_ESPUMA2);
      // burbujas del aliento
      mrc(x, 6, 11, 1, 1, M_ESPUMA); mrc(x, 19, 10, 1, 1, M_ESPUMA);
      frames.push(c);
      continue;
    }

    // masa principal (26×22: la figura llena el marco con la corona)
    mdisc(x, 13, cy, 8, M_AGUA);
    // capa media (lado superior-izq, luz de luna)
    mdisc(x, 12, cy - 2, 6, M_AGUA2, 0.9);
    // núcleo oscuro (el nombre que se ahogó)
    mdisc(x, 13, cy + 1, cast ? 4.2 : 3.6, M_AGUA3, 0.95);
    // base: espuma de arrastre
    mrc(x, 5, 19 + bob, 16, 2, M_ESPUMA);
    mrc(x, 3, 20 + bob, 6, 1, M_AGUA2);
    mrc(x, 17, 20 + bob, 7, 1, M_AGUA2);

    // corona de espuma (fase de la ola por frame: determinista)
    coronaEspuma(x, 13, cy - 10, (f * 3) % 9);

    // brazos de marea (varían por frame)
    if (whip) {
      // látigo extendido a la derecha (el barrido)
      mrc(x, 20, cy - 4, 5, 2, M_AGUA2);
      mrc(x, 23, cy - 3, 2, 3, M_ESPUMA);
      mrc(x, 24, cy + 1, 1, 2, M_ESPUMA);
      mrc(x, 19, cy + 1, 2, 1, M_ESPUMA);
      // contrapeso a la izquierda
      mrc(x, 3, cy - 1, 3, 2, M_AGUA);
    } else {
      // remolinos laterales que respiran
      mrc(x, sway > 0 ? 3 : 4, cy, 2, 3, M_AGUA2);
      mrc(x, sway > 0 ? 21 : 20, cy + 1, 2, 3, M_AGUA2);
      mrc(x, sway > 0 ? 2 : 3, cy + 3, 1, 1, M_ESPUMA);
    }

    // cast: anillo de carga + chispas de sal
    if (cast) {
      x.globalAlpha = 0.8;
      mrc(x, 8, cy - 7, 10, 1, M_ESPUMA2);
      mrc(x, 8, cy + 6, 10, 1, M_ESPUMA2);
      x.globalAlpha = 1;
      mrc(x, 12, cy - 1, 2, 2, M_ORO);       // la sal brilla en el núcleo
    }

    // ojos de bioluminiscencia (2 px + brillo)
    mrc(x, 10, cy - 3, 2, 2, M_ORO);
    mrc(x, 14, cy - 3, 2, 2, M_ORO);
    mrc(x, 10, cy - 3, 1, 1, M_ESPUMA2);
    mrc(x, 14, cy - 3, 1, 1, M_ESPUMA2);

    frames.push(c);
  }
  return frames;
}

/** Frames del jefe (26×22 · 5): idle×2 + cast + ataque + sumergida. */
export function buildMareaR19(): Frames {
  return buildMareaR19Local();
}

let spritesInit = false;

/** Registro idempotente del sprite 'marea' (llamar tras initExpansionSprites). */
export function initJefeMareaR19Sprites(): void {
  if (spritesInit) return;
  spritesInit = true;
  registerSpr('marea', buildMareaR19());
}
