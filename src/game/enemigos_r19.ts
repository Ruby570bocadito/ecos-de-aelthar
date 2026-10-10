// ============================================================
// ECOS DE AELTHAR — R19 · SISTEMA DE ÉLITES + 2 ENEMIGOS NUEVOS
// (AGENTE 19-e · élites y enemigos nuevos · módulo ADITIVO)
//
// PARTE 1 — ÉLITES (8% de los spawns regulares, determinista):
//   · esEliteR19(mapId, spawnIdx)  — mulberry32(hash(mapId)+idx*φ) < 0.08
//   · eliteMultR19                 — { hp:1.35, dmg:1.25, xp:2.0, gold:1.8 }
//   · aplicarEliteR19(e, seed)     — hp/maxHp ×1.35, dmg ×1.25 (def leído al
//     aplicar vía e.eliteDmgR19), 1 rasgo de 4 por seed:
//       - 'aullido'    : cada 8 s buffea enemigos a <120 px (+15% speed 5 s)
//                        implementado con registro propio (BUFFS) + partículas;
//                        el buff AÑADE desplazamiento (15% del delta del frame
//                        previo vía g.moveEntity) — funciona con CUALQUIER IA.
//       - 'escudo'     : cada 10 s gana invulT 0.5 s (damageEnemy del motor ya
//                        respeta invulT, engine.ts:1750) con telegraph visual.
//       - 'tirodoble'  : los proyectiles enemigos que nacen junto a él salen
//                        en par de 2: clon a ±8° (lado determinista por seed).
//       - 'tp'         : al 3.er golpe recibido (contador WeakMap por hitFlash
//                        ascendente) se teleporta 80 px DETRÁS del Portador con
//                        partículas + invulT 0.4 (cooldown 3 s).
//   · drawEliteAuraR19(g, e, t)    — aura pulsante dorada/roja bajo el enemigo
//     + corona «ÉLITE» (icono + rótulo) sobre la barra de vida.
//   · eliteTickR19(g, dt)          — O(n): aullido/escudo/tp/tirodoble + buffs.
//
// PARTE 2 — DOS ENEMIGOS NUEVOS:
//   · eco_desvanecido (bosque ×4 + cripta ×2) — recuerdo translúcido que se
//     DESVANECE (invulT 0.8 + teleport corto determinista a 90-130 px cada 6 s
//     si el Portador está a <60 px) y dispara un proyectil 'nota' con ECO
//     (un segundo proyectil idéntico a los 0.4 s desde el MISMO sitio).
//   · vigia_tinta (costa ×3) — ojo de tinta que mantiene banda 120-160 px,
//     dispara «estela de tinta» (3 'orb' escalonados en abanico estrecho ±6°,
//     documentado como simulación del arco: el motor no tiene gravedad en
//     proyectiles) y su especial cada 12 s: MANCHA — proyectil grande lento
//     (radius 9, dmg 10) + nube de tinta (sin slow: el motor no tiene slow en
//     proyectiles — documentado).
//
// ══ PUNTOS DE CABLEADO PARA EL INTEGRADOR (nombres exactos) ══
//  (a) engine.ts · makeEnemy — convertir el `return {...}` en
//      `const e: Enemy = {...};` y ANTES del return añadir EXACTAMENTE:
//          const _ri = eliteIdxPorPosR19(this.mapId, x, y);   // 19-e (1/2)
//          if (_ri >= 0 && esEliteR19(this.mapId, _ri)) aplicarEliteR19(e, eliteSeedR19(this.mapId, _ri)); // 19-e (2/2)
//      (eliteIdxPorPosR19 resuelve el índice de spawn por posición; devuelve -1
//       para spawns zone:'boss' → los jefes NUNCA son élite. Funciona igual
//       desde spawnEnemies() y desde invocaciones directas de makeEnemy.)
//  (b) render.ts · drawEntity — justo tras el bloque de la sombra (la elipse
//      negra, línea ~330) y ANTES de `let fi = entityFrame(...)`:
//          if (e.kind === 'enemy') drawEliteAuraR19(g, e as Enemy, g.globalT); // 19-e: aura+corona de élite
//      con `import { drawEliteAuraR19 } from './enemigos_r19'; // 19-e`
//      (OPCIONAL para el frame del Eco Desvanecido: si
//       (e as Enemy).etype === 'eco_desvanecido' && (e as Enemy).invulT! > 0 → fi = 2,
//       el sprite 14×14 tiene el frame 2 fragmentado; sin cablear, el motor ya
//       lo hace translúcido por invulT>0, render.ts:321-323.)
//  (c) update.ts · updateGame — línea 389, justo tras `cumbresBiomaTick(g, dt);`:
//          eliteTickR19(g, dt); // 19-e: rasgos de élite (O(n), ANTES del bucle de enemigos, igual que updateCombatFx)
//      IMPORTA el orden: eliteTickR19 cuenta golpes por hitFlash ASCENDENTE y
//      clona proyectiles recién nacidos → debe correr ANTES del bucle de
//      enemigos (línea ~392), nunca después.
//  (d) update.ts · updateEnemy — línea 704, justo tras
//      `if (EXPANSION_TYPES.has(e.etype) && expansionTick(g, e, dt, def)) return;`:
//          if (R19_TYPES.has(e.etype) && r19Tick(g, e, dt, def)) return; // 19-e: cerebros eco_desvanecido/vigia_tinta
//  (e) data.ts — tras la definición de ENEMY_DEFS (línea ~850):
//          Object.assign(ENEMY_DEFS, ENEMY_DEFS_R19); // 19-e: defs eco_desvanecido + vigia_tinta
//      (DEBE ejecutarse ANTES de cargar cualquier mapa: makeEnemy lee ENEMY_DEFS.)
//  (f) engine.ts · constructor — tras `initFaroSprites();` (línea ~209):
//          initEnemigosR19Sprites(); // 19-e: sprites eco_desv + vigia_tinta (idempotente)
//  (g) OPCIONAL (para que el mult de élite pague de verdad en el motor):
//      engine.ts · killEnemy línea 1824:
//          this.gainXp(Math.max(1, Math.round(def.xp * enemyStatMult(this).xp * (e.eliteR19 ? eliteMultR19.xp : 1))));
//      engine.ts · killEnemy línea 1825:
//          const gold = Math.round((def.gold[0] + Math.random() * (def.gold[1] - def.gold[0])) * (e.eliteR19 ? eliteMultR19.gold : 1));
//      update.ts · updateEnemy línea 812 (golpe melee genérico):
//          g.damagePlayer(dmgEliteR19(e, def), e.x, e.y);
//      (Los cerebros 19-e ya usan dmgEliteR19(e, def) por su cuenta.)
//  (h) SPAWNS: instalarEnemigosR19() se EJECUTA AL CARGAR este módulo
//      (patrón puestarSpawns14a de enemies_expansion.ts) — no hay que llamarla.
//      Llamada extra = no-op (guard + check por mapa).
//  (i) TIPOS: EnemyType (types.ts:13) es una unión CERRADA y types.ts está
//      congelado → los spawns/defs viajan con el cast documentado
//      `as unknown as EnemyType` (mismo precedente que ARENA_MAP_ID en
//      maps_expansion.ts:324). Si el integrador amplía la unión con
//      'eco_desvanecido' | 'vigia_tinta' puede borrar los casts sin más cambios.
//      Los campos nuevos de Enemy se añaden por AUGMENTACIÓN de módulo
//      (declare module './types' { interface Enemy {...} }) — sin tocar types.ts.
//
// DETERMINISMO: cero Math.random en este módulo — mulberry32 local con semilla
// derivada de hash del mapa + índice de spawn (élites) o de la posición de
// hogar (cerebros). Mismo árbol → misma partida.
// IMPORTS: './engine' SOLO como type (cero runtime); './audio' usado en
// funciones; './sprites' para registerSpr/getSpr; './maps' lectura-mutación de
// spawns (patrón 14-a); './data' para ENEMY_DEFS (el propio motor ya lo viaja);
// './fxcore' stepKnockback (contrato). Sin ciclos nuevos de valor.
// ============================================================

import type { Game } from './engine';
import type { Enemy, EnemyType, Projectile, Element } from './types';
import type { EnemyDef } from './data';
import { ENEMY_DEFS } from './data';
import { audio } from './audio';
import { registerSpr, getSpr } from './sprites';
import type { Frames } from './sprites';
import { stepKnockback } from './fxcore';
import { MAPS } from './maps';

// ---------------- constantes del proyecto (literales, precedentes: enemies_expansion.ts:1805) ----------------
const TILE = 16;  // sprites.ts:1555
const ZOOM = 2;   // engine.ts:63

// ---------------- augmentación de Enemy (sin tocar types.ts) ----------------
/** Rasgos de élite asignables (4). */
export type EliteTraitR19 = 'aullido' | 'escudo' | 'tirodoble' | 'tp';

declare module './types' {
  interface Enemy {
    /** 19-e: el enemigo es ÉLITE (8% determinista de los spawns regulares). */
    eliteR19?: boolean;
    /** 19-e: rasgo de élite asignado por semilla. */
    eliteTraitR19?: EliteTraitR19;
    /** 19-e: daño efectivo del élite (def.dmg × eliteMultR19.dmg). Los
     *  cerebros 19-e lo leen vía dmgEliteR19(); el golpe melee genérico del
     *  motor puede adoptarlo con el cableado opcional (g). */
    eliteDmgR19?: number;
  }
}

// ---------------- PRNG determinista (cero Math.random) ----------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a de 32 bits sobre el id del mapa (estable entre partidas). */
function hashStrR19(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// ============================================================
// PARTE 1 · SISTEMA DE ÉLITES
// ============================================================

/** Multiplicadores de élite (constantes exactas, cableado opcional g). */
export const eliteMultR19 = { hp: 1.35, dmg: 1.25, xp: 2.0, gold: 1.8 } as const;

const TRAITS_R19: readonly EliteTraitR19[] = ['aullido', 'escudo', 'tirodoble', 'tp'];

/**
 * Semilla determinista de élite: hash(mapa) + spawnIdx·φ (2654435761).
 * La MISMA posición de spawn en el MISMO mapa da el MISMO resultado en
 * cualquier partida/dispositivo.
 */
export function eliteSeedR19(mapId: string, spawnIdx: number): number {
  return (hashStrR19(mapId) + Math.imul(spawnIdx >>> 0, 2654435761)) >>> 0;
}

/**
 * ¿El spawn (mapId, spawnIdx) nace ÉLITE? — 8% exacto de los spawns de
 * enemigos regulares. Determinista puro (no lee MAPS: los jefes se excluyen
 * en eliteIdxPorPosR19, que devuelve -1 para zone:'boss').
 */
export function esEliteR19(mapId: string, spawnIdx: number): boolean {
  return mulberry32(eliteSeedR19(mapId, spawnIdx))() < 0.08;
}

/** Rasgo de élite para una semilla (reparto uniforme de los 4). */
export function rasgoEliteR19(seed: number): EliteTraitR19 {
  const r = mulberry32((seed ^ 0x9e3779b9) >>> 0)();
  return TRAITS_R19[Math.floor(r * TRAITS_R19.length) % TRAITS_R19.length];
}

/**
 * Índice del spawn de MAPS[mapId] cuya posición de mundo es (x, y) en px
 * (spawnEnemies usa s.x*TILE+8, s.y*TILE+8). Devuelve -1 si no hay spawn ahí
 * o si es un JEFE (zone:'boss') — el cableado (a) lo interpreta como "no élite".
 */
export function eliteIdxPorPosR19(mapId: string, x: number, y: number): number {
  const m = (MAPS as Record<string, { spawns: { x: number; y: number; zone?: string }[] } | undefined>)[mapId];
  if (!m) return -1;
  const i = m.spawns.findIndex(s => s.x * TILE + 8 === x && s.y * TILE + 8 === y);
  if (i < 0) return -1;
  if (m.spawns[i].zone === 'boss') return -1;
  return i;
}

// ---------------- memoria por élite (WeakMap, no persiste) ----------------

interface EliteMem {
  seed: number;
  howlT: number;     // acumulador del aullido (8 s)
  shieldT: number;   // acumulador del escudo (10 s)
  twinCd: number;    // cooldown del clon tirodoble (0.5 s)
  tpCd: number;      // cooldown del teleport (3 s)
  hits: number;      // golpes recibidos desde el último tp
  prevFlash: number; // hitFlash previo (detección de golpe nuevo)
}

const EMEM = new WeakMap<Enemy, EliteMem>();
function emem(e: Enemy): EliteMem {
  let m = EMEM.get(e);
  if (!m) {
    m = { seed: 0, howlT: 0, shieldT: 0, twinCd: 0, tpCd: 0, hits: 0, prevFlash: -1 };
    EMEM.set(e, m);
  }
  return m;
}

/** Proyectiles ya vistos por el clonador tirodoble (WeakMap: sin fugas). */
const PROJ_VISTOS = new WeakMap<Projectile, true>();

// buffs de aullido: registro propio por enemigo buffeado (cualquier IA)
interface BuffR19 { t: number; lx: number; ly: number }
const BUFFS = new WeakMap<Enemy, BuffR19>();
let buffsActivos = 0; // contador para __r19Debug (WeakMap no es iterable)

/**
 * Convierte un enemigo recién creado en ÉLITE: hp/maxHp ×1.35 (redondeo
 * estable), daño ×1.25 (leído del def EN ESTE momento → e.eliteDmgR19) y un
 * rasgo de los 4 elegido por la semilla. Idempotente.
 */
export function aplicarEliteR19(e: Enemy, seed: number): void {
  if (e.eliteR19) return;
  e.eliteR19 = true;
  e.eliteTraitR19 = rasgoEliteR19(seed);
  e.hp = Math.max(1, Math.round(e.hp * eliteMultR19.hp));
  e.maxHp = Math.max(1, Math.round(e.maxHp * eliteMultR19.hp));
  const def = ENEMY_DEFS[e.etype as string];
  if (def) e.eliteDmgR19 = def.dmg * eliteMultR19.dmg;
  const m = emem(e);
  m.seed = seed >>> 0;
  m.howlT = 0; m.shieldT = 0; m.twinCd = 0; m.tpCd = 0; m.hits = 0; m.prevFlash = -1;
}

/**
 * Daño efectivo de un enemigo para el golpe melee/proyectil: el de élite
 * (×1.25 capturado al aplicar) o el del def. Úsalo también desde update.ts:812
 * (cableado opcional g).
 */
export function dmgEliteR19(e: Enemy, def: EnemyDef): number {
  return e.eliteDmgR19 ?? def.dmg;
}

// ---------------- rasgos ----------------

const AULLIDO_CD = 8;
const AULLIDO_RADIO = 120;
const AULLIDO_BUFF_T = 5;
const ESCUDO_CD = 10;
const ESCUDO_INVUL = 0.5;
const TP_GOLPES = 3;
const TP_DIST = 80;

/** Aullido: buffea a los enemigos NO élite a <120 px (+15% speed 5 s). */
function intentaAullidoR19(g: Game, e: Enemy, m: EliteMem): void {
  let alguno = false;
  for (const o of g.enemies) {
    if (o === e || o.dead || o.eliteR19 || o.ai === 'aturdido') continue;
    if (Math.hypot(o.x - e.x, o.y - e.y) >= AULLIDO_RADIO) continue;
    if (!BUFFS.has(o)) buffsActivos++;
    BUFFS.set(o, { t: AULLIDO_BUFF_T, lx: o.x, ly: o.y });
    alguno = true;
    // telegraph del buff: 2 chispas doradas sobre el buffeado
    for (let i = 0; i < 2; i++) {
      g.particles.push({
        x: o.x + (i - 0.5) * 6, y: o.y - 6 - i * 3,
        vx: 0, vy: -22, t: 0.4, maxT: 0.4, color: '#ffd24a', size: 1.6, grav: 0,
      });
    }
  }
  if (!alguno) return; // sin público: reintenta el próximo frame (sin sfx spam)
  m.howlT = 0;
  audio.sfx('roar');
  // anillo del aullido sobre el élite
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.particles.push({
      x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 8,
      vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 10,
      t: 0.5, maxT: 0.5, color: '#ff9050', size: 1.8, grav: 0,
    });
  }
}

/** Buff activo: AÑADE 15% del desplazamiento natural del frame previo. */
function aplicarBuffR19(g: Game, e: Enemy, bf: BuffR19): void {
  const dx = e.x - bf.lx, dy = e.y - bf.ly;
  const l = Math.hypot(dx, dy);
  if (l > 0.01 && l < 8) g.moveEntity(e, dx * 0.15, dy * 0.15); // teleports/knockback fuera
  // el referente se guarda DESPUÉS del empuje propio: así el delta del frame
  // siguiente solo contiene el movimiento natural (el extra NO compone).
  bf.lx = e.x; bf.ly = e.y;
}

/** tp: 80 px detrás del Portador (prolongando la línea élite→Portador). */
function tpDetrasR19(g: Game, e: Enemy, m: EliteMem): void {
  const p = g.player;
  if (!p) return;
  const ox = e.x, oy = e.y;
  const ang = Math.atan2(p.y - e.y, p.x - e.x);
  let hecho = false;
  for (let i = 0; i < 8; i++) {
    // intento 0 = exacto detrás; luego ±45°, ±90°, ±135°, 180° (determinista)
    const giro = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 4);
    const nx = p.x + Math.cos(ang + giro) * TP_DIST;
    const ny = p.y + Math.sin(ang + giro) * TP_DIST;
    if (g.boxFree(nx, ny, e.w, e.h)) {
      e.x = nx; e.y = ny; hecho = true;
      break;
    }
  }
  // partículas de desvanecimiento en el punto de origen (siempre)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.particles.push({
      x: ox + Math.cos(a) * 6, y: oy - 4 + Math.sin(a) * 5,
      vx: Math.cos(a) * 26, vy: Math.sin(a) * 20 - 8,
      t: 0.45, maxT: 0.45, color: '#b48fff', size: 1.7, grav: 0,
    });
  }
  e.invulT = Math.max(e.invulT ?? 0, 0.4);
  if (hecho) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.particles.push({
        x: e.x + Math.cos(a) * 6, y: e.y - 4 + Math.sin(a) * 5,
        vx: -Math.cos(a) * 26, vy: -Math.sin(a) * 20 - 8,
        t: 0.45, maxT: 0.45, color: '#d8c0ff', size: 1.7, grav: 0,
      });
    }
    audio.sfx('shadow');
  }
}

/** tirodoble: clona a ±8° el proyectil enemigo recién nacido junto al élite. */
function clonarTirodobleR19(g: Game, e: Enemy, m: EliteMem): void {
  if (m.twinCd > 0) return;
  for (const pr of g.projectiles) {
    if (pr.from !== 'enemy') continue;
    if (PROJ_VISTOS.has(pr)) continue;
    PROJ_VISTOS.set(pr, true);
    const ddx = pr.x - e.x, ddy = pr.y - e.y;
    if (ddx * ddx + ddy * ddy > 26 * 26) continue;          // nació lejos: no suyo
    if (pr.vx * ddx + pr.vy * ddy <= 0) continue;            // no se aleja de él
    m.twinCd = 0.5;                                          // máx 1 clon por 0.5 s
    const lado = m.seed % 2 === 0 ? 1 : -1;                  // ±8° determinista
    const base = Math.atan2(pr.vy, pr.vx);
    const a = base + lado * (8 * Math.PI / 180);
    const spd = Math.hypot(pr.vx, pr.vy);
    g.projectiles.push({
      x: pr.x, y: pr.y,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      t: pr.t, dmg: pr.dmg, element: pr.element, from: 'enemy',
      sprite: pr.sprite, radius: pr.radius, pierce: pr.pierce,
    });
    for (let i = 0; i < 3; i++) {
      g.particles.push({
        x: pr.x + (i - 1) * 3, y: pr.y - 2,
        vx: 0, vy: -18, t: 0.3, maxT: 0.3, color: '#ffd24a', size: 1.4, grav: 0,
      });
    }
    break; // un clon por tick
  }
}

/**
 * Tick de élites — O(n) sobre g.enemies. Debe correr ANTES del bucle de
 * enemigos de update.ts (misma posición que updateCombatFx) para ver los
 * hitFlash ascendentes y los proyectiles recién nacidos. Guard estándar.
 */
export function eliteTickR19(g: Game, dt: number): void {
  if (!g || g.state !== 'play' || !g.player) return;
  for (const e of g.enemies) {
    if (e.dead) continue;
    // buffs de aullido (enemigos NO élite)
    const bf = BUFFS.get(e);
    if (bf) {
      bf.t -= dt;
      if (bf.t <= 0) { BUFFS.delete(e); buffsActivos = Math.max(0, buffsActivos - 1); }
      else if (e.ai !== 'aturdido' && !(e.spawnGuard && e.spawnGuard > 0)) aplicarBuffR19(g, e, bf);
    }
    if (!e.eliteR19) continue;
    const m = emem(e);
    m.twinCd = Math.max(0, m.twinCd - dt);
    m.tpCd = Math.max(0, m.tpCd - dt);
    switch (e.eliteTraitR19) {
      case 'aullido': {
        // eps 1e-9: la suma flotante de dt puede quedarse 1 ulp por debajo del CD
        m.howlT = Math.min(m.howlT + dt, AULLIDO_CD);
        if (m.howlT >= AULLIDO_CD - 1e-9) intentaAullidoR19(g, e, m);
        break;
      }
      case 'escudo': {
        m.shieldT += dt;
        if (m.shieldT >= ESCUDO_CD - 1e-9) {
          m.shieldT = 0;
          if ((e.invulT ?? 0) <= 0) {
            e.invulT = ESCUDO_INVUL;
            audio.sfx('parry');
            g.floatAt(e.x, e.y - 18, 'escudo', '#ffd24a', 6);
            // telegraph visual: anillo dorado
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              g.particles.push({
                x: e.x + Math.cos(a) * 10, y: e.y - 3 + Math.sin(a) * 7,
                vx: Math.cos(a) * 14, vy: Math.sin(a) * 10,
                t: 0.35, maxT: 0.35, color: '#ffe86a', size: 1.6, grav: 0,
              });
            }
          }
        }
        break;
      }
      case 'tirodoble': {
        clonarTirodobleR19(g, e, m);
        break;
      }
      case 'tp': {
        // golpe nuevo = hitFlash ASCENDENTE (mismo patrón que updateCombatFx)
        const fresh = e.hitFlash > m.prevFlash + 5e-4 && e.hitFlash > 0.06;
        m.prevFlash = e.hitFlash;
        if (fresh) {
          m.hits++;
          if (m.hits >= TP_GOLPES && m.tpCd <= 0) {
            m.hits = 0;
            m.tpCd = 3;
            tpDetrasR19(g, e, m);
          }
        }
        break;
      }
      default:
        break;
    }
  }
}

// ---------------- aura + corona de élite (render) ----------------

/**
 * Aura pulsante dorada/roja BAJO el enemigo + corona «ÉLITE» sobre la barra
 * de vida. CABLEADO (b): render.ts drawEntity, tras la sombra y antes del
 * sprite. Usa g.ctx y la MISMA matemática de cámara que drawWorld
 * (sx = wx*ZOOM − round(camX)).
 */
export function drawEliteAuraR19(g: Game, e: Enemy, t: number): void {
  if (!e.eliteR19 || e.dead) return;
  const ctx = g.ctx;
  if (!ctx) return;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const cx = e.x * ZOOM - camX;
  const cy = (e.y + 4) * ZOOM - camY;
  const pulse = 0.28 + Math.sin(t * 6) * 0.1;
  // aura doble: roja exterior, dorada interior
  ctx.globalAlpha = pulse * 0.75;
  ctx.fillStyle = '#e04830';
  ctx.beginPath();
  ctx.ellipse(cx, cy, (e.w / 2 + 6) * ZOOM, 5.5 * ZOOM, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, (e.w / 2 + 3) * ZOOM, 3.5 * ZOOM, 0, 0, Math.PI * 2);
  ctx.fill();
  // corona de 3 puntas + rótulo «ÉLITE», sobre la barra de vida (dy-6)
  const spr = getSpr(e.sprite);
  const h = spr && spr[0] ? spr[0].height : 16;
  const crownY = cy - h * ZOOM - 12;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(cx - 4, crownY + 2, 9, 2);                    // base
  ctx.fillRect(cx - 4, crownY, 2, 2);                        // punta izq
  ctx.fillRect(cx - 1, crownY - 1, 2, 3);                    // punta central
  ctx.fillRect(cx + 3, crownY, 2, 2);                        // punta der
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#ff9040';
  ctx.fillRect(cx - 2, crownY + 3, 5, 1);
  // rótulo «ÉLITE»
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#ffe86a';
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'center';
  ctx.font = '5px monospace';
  ctx.fillText('ÉLITE', cx, crownY - 2);
  ctx.textAlign = prevAlign;
  ctx.globalAlpha = 1;
}

// ============================================================
// PARTE 2 · CEREBROS (formato tickX de enemies_expansion.ts)
// ============================================================

interface R19Mem {
  // señales de colocación (¿corrió ya el bloque común del motor?)
  lastAnim?: number;
  lastAtkCd?: number;
  prevHitFlash?: number;
  tickN: number;
  // eco_desvanecido
  vanishT: number;                                  // acumulador del desvanecer (6 s)
  rng?: () => number;                               // stream determinista por hogar
  echo?: { t: number; x: number; y: number; vx: number; vy: number; dmg: number };
  // vigia_tinta
  salva: { t: number; off: number; dmg: number }[]; // cola de la estela de tinta
  baseAng: number;
  atkX: number;
  atkY: number;
  manchaT: number;                                  // acumulador de la mancha (12 s)
  manchaPend: boolean;                              // telegraph de la mancha en curso
}

const RMEM = new WeakMap<Enemy, R19Mem>();
function rmem(e: Enemy): R19Mem {
  let m = RMEM.get(e);
  if (!m) {
    m = { tickN: 0, vanishT: 0, salva: [], baseAng: 0, atkX: 0, atkY: 0, manchaT: 0, manchaPend: false };
    RMEM.set(e, m);
  }
  return m;
}

/** PRNG por enemigo, semilla derivada de su posición de hogar (determinista). */
function rngDeHogar(e: Enemy): () => number {
  const seed = (Math.imul(e.homeX | 0, 73856093) ^ Math.imul(e.homeY | 0, 19349663)) >>> 0;
  return mulberry32(seed);
}

function distR19(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function isNightR19(g: Game): boolean {
  return g.dayT > 0.7 || g.dayT < 0.08; // mismo criterio que el motor (update.ts)
}

/** Mueve hacia (dx,dy) normalizado con colisión de tiles y fija dir/moving. */
function moverR19(g: Game, e: Enemy, dx: number, dy: number, spd: number, dt: number): void {
  const l = Math.hypot(dx, dy);
  if (l < 1e-4) { e.moving = false; return; }
  g.moveEntity(e, (dx / l) * spd * dt, (dy / l) * spd * dt);
  e.moving = true;
  if (Math.abs(dx) > 0.01) e.dir = dx > 0 ? 'right' : 'left';
}

/**
 * Bloque común — réplica ROBUSTA del prep de update.ts (mismo patrón que
 * commonTick de enemies_expansion): detecta si el motor ya corrió este frame
 * y, si no, replica hitFlash/knockback/estados/aggro/atkCd/anim/invulT.
 * Devuelve TRUE si el frame quedó consumido (aturdido/spawnGuard).
 * Sin Math.random (las partículas de quemado salen cada 4 ticks).
 */
function commonTickR19(g: Game, e: Enemy, dt: number, def: EnemyDef, m: R19Mem): boolean {
  const p = g.player;
  m.tickN++;

  const motorRan = m.lastAnim !== undefined && e.anim !== m.lastAnim;
  m.lastAnim = e.anim;

  if (e.spawnGuard && e.spawnGuard > 0) {
    if (!motorRan) e.spawnGuard = Math.max(0, e.spawnGuard - dt);
    if (e.spawnGuard > 0) return true;
  }

  // golpe nuevo (hitFlash ascendente, patrón 8-c)
  const prev = m.prevHitFlash ?? 0;
  const freshHit = e.hitFlash > prev + 5e-4 && e.hitFlash > 0.06;
  if (!motorRan && e.hitFlash > 0 && Math.abs(e.hitFlash - prev) < 1e-9) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
  }
  m.prevHitFlash = e.hitFlash;

  if (!motorRan) stepKnockback(g, e, dt);

  // estados + marca (solo si el motor no pasó ya)
  if (!motorRan) {
    for (let i = e.statuses.length - 1; i >= 0; i--) {
      const s = e.statuses[i];
      s.t -= dt;
      if (s.kind === 'quemado') {
        e.hp -= s.power * dt;
        if (m.tickN % 4 === 0) {
          g.particles.push({ x: e.x, y: e.y - 6, vx: 0, vy: -24, t: 0.3, maxT: 0.3, color: '#ff9040', size: 1.5, grav: 0 });
        }
        if (e.hp <= 0) { g.killEnemy(e); return true; }
      }
      if (s.t <= 0) e.statuses.splice(i, 1);
    }
    if (e.marked !== undefined) {
      e.marked -= dt;
      if (e.marked <= 0) e.marked = undefined;
    }
  }
  if (e.hp < e.maxHp) e.aggro = true;

  if (e.invulT !== undefined && e.invulT > 0) e.invulT = Math.max(0, e.invulT - dt);
  if (m.lastAtkCd === undefined || Math.abs(e.atkCd - m.lastAtkCd) < 1e-9) e.atkCd -= dt;
  if (!motorRan) e.anim += dt * (e.ai === 'persigue' ? 1.4 : 0.6);
  e.subT = (e.subT ?? 0) + dt;

  // aggro (idempotente con el motor)
  if (p && !e.aggro && g.state === 'play') {
    const nightMult = isNightR19(g) ? 1.3 : 1;
    if (distR19(e.x, e.y, p.x, p.y) < def.aggroR * nightMult) {
      e.aggro = true;
      audio.sfx('blip');
    }
  }

  // aturdido/quebrado — mismo patrón que update.ts (1.6 s en regulares)
  if (e.ai === 'aturdido') {
    if (e.aiT > 1.6) e.aiT = 1.6;
    e.aiT -= dt;
    e.moving = false;
    e.windup = 0;
    if (e.aiT <= 0) {
      e.ai = 'persigue';
      if (e.maxSta > 0) e.sta = e.maxSta;
    }
    return true;
  }
  void freshHit; // disponible para rasgos futuros (los élites cuentan golpes en eliteTickR19)
  return false;
}

function flotarR19(e: Enemy, dt: number): void {
  e.moving = false;
  e.anim += dt * 0.4;
}

// ============================================================
// ECO DESVANECIDO — recuerdo que aprendió a moverse (bosque/cripta)
// Kite fantasma: se acerca hasta atkR (34), escupe una 'nota' lenta con ECO
// (2.º proyectil 0.4 s después desde el MISMO punto) y, si el Portador se
// le echa encima (<60 px, cada 6 s), se DESVANECE: invulT 0.8 + partículas +
// teleport determinista a 90-130 px en ángulo aleatorio determinista.
// ============================================================

export function tickEcoDesvR19(g: Game, e: Enemy, dt: number, def: EnemyDef, m: R19Mem): boolean {
  if (commonTickR19(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { flotarR19(e, dt); return true; }
  const d = distR19(e.x, e.y, p.x, p.y);

  // libera el ECO pendiente (2.º proyectil, mismo sitio y velocidad)
  if (m.echo) {
    m.echo.t -= dt;
    if (m.echo.t <= 0) {
      g.projectiles.push({
        x: m.echo.x, y: m.echo.y, vx: m.echo.vx, vy: m.echo.vy, t: 1.6,
        dmg: m.echo.dmg, element: 'ninguno', from: 'enemy', sprite: 'nota', radius: 4, pierce: 0,
      });
      g.particles.push({ x: m.echo.x, y: m.echo.y, vx: 0, vy: -12, t: 0.35, maxT: 0.35, color: '#c8b0f0', size: 1.5, grav: 0 });
      audio.sfx('echo');
      m.echo = undefined;
    }
  }

  // DESVANECERSE: cada 6 s con el Portador a <60 px (proxy determinista de
  // "el Portador le apunta"): invulT 0.8 + teleport a 90-130 px
  if (e.aggro && m.vanishT >= 6 && d < 60 && (e.invulT ?? 0) <= 0 && e.ai !== 'carga') {
    m.vanishT = 0;
    e.invulT = 0.8;
    audio.sfx('wraith');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.particles.push({
        x: e.x + Math.cos(a) * 7, y: e.y - 3 + Math.sin(a) * 6,
        vx: Math.cos(a) * 30, vy: Math.sin(a) * 22 - 10,
        t: 0.5, maxT: 0.5, color: '#b8a0f0', size: 1.8, grav: 0,
      });
    }
    // teleport corto determinista (ángulo/distancia del stream por hogar)
    if (!m.rng) m.rng = rngDeHogar(e);
    const ang = m.rng() * Math.PI * 2;
    const dd = 90 + m.rng() * 40;
    const nx = p.x + Math.cos(ang) * dd;
    const ny = p.y + Math.sin(ang) * dd;
    if (g.boxFree(nx, ny, e.w, e.h)) {
      e.x = nx; e.y = ny;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.particles.push({
          x: e.x + Math.cos(a) * 6, y: e.y - 3 + Math.sin(a) * 5,
          vx: -Math.cos(a) * 22, vy: -Math.sin(a) * 16 - 6,
          t: 0.45, maxT: 0.45, color: '#d0c4f0', size: 1.6, grav: 0,
        });
      }
    }
    e.moving = false;
    return true; // el frame del desvanecimiento se consume
  }
  if (e.aggro) m.vanishT += dt; else m.vanishT = 0;

  switch (e.ai) {
    case 'patrulla': {
      // deriva de recuerdo: flota cerca de su hogar
      e.aiT -= dt;
      if (e.aiT <= 0) {
        if (!m.rng) m.rng = rngDeHogar(e);
        e.aiT = 1.5 + m.rng() * 1.5;
        e.patrolAngle = m.rng() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 60;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moverR19(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.6, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue':
    case 'recupera': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      if (d > def.aggroR * 2.6) { e.aggro = false; e.ai = 'patrulla'; break; }
      // se acerca hasta rango de eco (atkR 34) con bandita 28-42 px
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 42) moverR19(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else if (d < 28) moverR19(g, e, -Math.cos(ang), -Math.sin(ang), def.speed * 0.7, dt);
      else {
        const tang = ang + Math.PI / 2;
        const s = Math.sin(e.subT ?? 0);
        moverR19(g, e, Math.cos(tang) * s, Math.sin(tang) * s, def.speed * 0.5, dt);
      }
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.ai === 'recupera') {
        e.aiT -= dt;
        if (e.aiT > 0) break;
        e.ai = 'persigue';
      }
      if (e.atkCd <= 0 && d <= def.atkR + 8) {
        e.ai = 'carga';
        e.windup = def.windup; // 0.6 — el motor dibuja '!' por windup>0 en 'carga'
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) {
        const dx = p.x - e.x, dy = p.y - 4 - e.y;
        const base = Math.atan2(dy, dx);
        const spd = 95; // nota lenta
        const dmg = dmgEliteR19(e, def);
        g.projectiles.push({
          x: e.x, y: e.y - 2, vx: Math.cos(base) * spd, vy: Math.sin(base) * spd, t: 1.6,
          dmg, element: 'ninguno', from: 'enemy', sprite: 'nota', radius: 4, pierce: 0,
        });
        // ECO: a 0.4 s, otro idéntico desde el MISMO sitio
        m.echo = { t: 0.4, x: e.x, y: e.y - 2, vx: Math.cos(base) * spd, vy: Math.sin(base) * spd, dmg };
        audio.sfx('song');
        e.atkCd = def.atkCd;
        e.ai = 'recupera';
        e.aiT = 0.5;
      }
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}

// ============================================================
// VIGÍA DE TINTA — ojo costero (costa)
// Mantenedor de distancia (banda 120-160 px). Ataque: «estela de tinta» —
// 3 'orb' escalonados (0 / 0.12 / 0.24 s) en abanico vertical estrecho ±6°,
// SIMULACIÓN del arco (el motor no tiene gravedad en proyectiles; el abanico
// escalonado lee como una estela que cae). Especial cada 12 s: MANCHA —
// proyectil grande lento (radius 9, dmg 10) precedido de nube de tinta
// (sin slow al Portador: el motor no tiene slow en proyectiles — documentado).
// ============================================================

export function tickVigiaTintaR19(g: Game, e: Enemy, dt: number, def: EnemyDef, m: R19Mem): boolean {
  if (commonTickR19(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { flotarR19(e, dt); return true; }
  const d = distR19(e.x, e.y, p.x, p.y);

  // cola de la estela de tinta (abanico escalonado)
  if (m.salva.length > 0) {
    const quedan: { t: number; off: number; dmg: number }[] = [];
    for (const s of m.salva) {
      s.t -= dt;
      if (s.t <= 0) {
        const a = m.baseAng + s.off;
        g.projectiles.push({
          x: m.atkX, y: m.atkY, vx: Math.cos(a) * 105, vy: Math.sin(a) * 105, t: 1.7,
          dmg: s.dmg, element: 'ninguno', from: 'enemy', sprite: 'orb', radius: 4, pierce: 0,
        });
        g.particles.push({ x: m.atkX, y: m.atkY, vx: 0, vy: 6, t: 0.3, maxT: 0.3, color: '#3a3a5e', size: 1.6, grav: 0 });
      } else quedan.push(s);
    }
    m.salva = quedan;
  }

  // MANCHA: acumulador mientras está aggro
  if (e.aggro) m.manchaT += dt;

  // telegraph de tinta durante el windup de la mancha
  if (m.manchaPend && e.ai === 'carga' && e.windup > 0) {
    if (m.tickN % 2 === 0) {
      g.particles.push({
        x: e.x + (m.tickN % 5 - 2) * 4, y: e.y - 8 - (m.tickN % 3) * 3,
        vx: 0, vy: -8, t: 0.5, maxT: 0.5, color: '#3a3a5e', size: 1.8, grav: 0,
      });
    }
  }

  switch (e.ai) {
    case 'patrulla': {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        if (!m.rng) m.rng = rngDeHogar(e);
        e.aiT = 2 + m.rng() * 2;
        e.patrolAngle = m.rng() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 50;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moverR19(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.7, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue':
    case 'recupera': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      if (d > def.aggroR * 2.4) { e.aggro = false; e.ai = 'patrulla'; break; }
      // mantenedor de distancia: banda 120-160 px
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d < 120) moverR19(g, e, -Math.cos(ang), -Math.sin(ang), def.speed, dt);
      else if (d > 160) moverR19(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else {
        const tang = ang + Math.PI / 2;
        const s = Math.sin((e.subT ?? 0) * 0.9);
        moverR19(g, e, Math.cos(tang) * s, Math.sin(tang) * s, def.speed * 0.7, dt);
      }
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.ai === 'recupera') {
        e.aiT -= dt;
        if (e.aiT > 0) break;
        e.ai = 'persigue';
      }
      // especial MANCHA cada 12 s (prioridad sobre la salva; eps por suma flotante)
      if (m.manchaT >= 12 - 1e-9 && e.atkCd <= 0 && d < 200) {
        m.manchaPend = true;
        e.ai = 'carga';
        e.windup = def.windup;
        break;
      }
      if (e.atkCd <= 0 && d < def.atkR + 12) {
        e.ai = 'carga';
        e.windup = def.windup;
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) {
        const dmg = dmgEliteR19(e, def);
        if (m.manchaPend) {
          // MANCHA: proyectil grande lento (radius 9, dmg 10) + nube de tinta
          const dx = p.x - e.x, dy = p.y - 4 - e.y;
          const base = Math.atan2(dy, dx);
          g.projectiles.push({
            x: e.x, y: e.y - 2, vx: Math.cos(base) * 55, vy: Math.sin(base) * 55, t: 2.4,
            dmg: 10, element: 'ninguno', from: 'enemy', sprite: 'orb', radius: 9, pierce: 0,
          });
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            g.particles.push({
              x: e.x + Math.cos(a) * 9, y: e.y - 2 + Math.sin(a) * 7,
              vx: Math.cos(a) * 18, vy: Math.sin(a) * 12 - 6,
              t: 0.6, maxT: 0.6, color: '#3a3a5e', size: 2, grav: 0,
            });
          }
          audio.sfx('shadow');
          m.manchaT = 0;
          m.manchaPend = false;
        } else {
          // ESTELA DE TINTA: 3 orbes escalonados en abanico estrecho ±6°
          const dx = p.x - e.x, dy = p.y - 4 - e.y;
          m.baseAng = Math.atan2(dy, dx);
          m.atkX = e.x; m.atkY = e.y - 2;
          m.salva = [
            { t: 0, off: -0.10, dmg },
            { t: 0.12, off: 0, dmg },
            { t: 0.24, off: 0.10, dmg },
          ];
          audio.sfx('splash');
        }
        e.atkCd = def.atkCd;
        e.ai = 'recupera';
        e.aiT = 0.5;
      }
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}

// ============================================================
// ENTRADA ÚNICA de los cerebros 19-e (mismo contrato que expansionTick):
// true = frame gestionado por completo; false = IA genérica del motor.
// ============================================================

export const R19_TYPES: ReadonlySet<string> = new Set<string>(['eco_desvanecido', 'vigia_tinta']);

export function r19Tick(g: Game, e: Enemy, dt: number, def: EnemyDef): boolean {
  // cast a string: 'eco_desvanecido'/'vigia_tinta' aún no están en la unión
  // cerrada EnemyType (types.ts:13 congelado) — ver cabecera (i).
  switch (e.etype as string) {
    case 'eco_desvanecido': return tickEcoDesvR19(g, e, dt, def, rmem(e));
    case 'vigia_tinta': return tickVigiaTintaR19(g, e, dt, def, rmem(e));
    default: return false;
  }
}

// ============================================================
// SPRITES (procedurales, deterministas, sin assets)
//   eco_desv    (14×14 · 3): 0 flotar A (contorno discontinuo) ·
//               1 flotar B (bob, dashes girados) · 2 FRAGMENTADO
//               (usar con invulT>0 — cableado opcional b)
//   vigia_tinta (16×16 · 3): 0 ojo abierto · 1 PARPADEO (párpado coral) ·
//               2 TELEGRAPH (iris grande + burbujas — el cableado genérico
//               'carga'→frame 2 del motor ya lo elige solo)
// ============================================================

function cvR19(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

function rcR19(x: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, col: string) {
  x.fillStyle = col;
  x.fillRect(rx, ry, rw, rh);
}

function discR19(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, alpha = 1) {
  x.globalAlpha = alpha;
  x.fillStyle = col;
  const top = Math.ceil(r);
  for (let dy = -top; dy <= top; dy++) {
    const w = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (w < 0.35 && Math.abs(dy) !== 0) continue;
    x.fillRect(Math.round(cx - w), cy + dy, Math.max(1, Math.round(w * 2 + 1)), 1);
  }
  x.globalAlpha = 1;
}

/** Anillo discontinuo: puntos sobre un círculo, alternando (dash) por fase. */
function dashedRingR19(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, phase: number, alpha = 0.9): void {
  x.globalAlpha = alpha;
  x.fillStyle = col;
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    if ((i + phase) % 2 !== 0) continue;
    const a = (i / steps) * Math.PI * 2 + phase * 0.26;
    x.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
  x.globalAlpha = 1;
}

function buildEcoDesvR19(): Frames {
  const frames: Frames = [];
  const O = '#9a8cc8', B = '#d8d0f0', D = '#7a6aa8', EYE = '#181228', GL = '#f0ecff';
  for (let f = 0; f < 3; f++) {
    const { c, x } = cvR19(14, 14);
    if (f === 2) {
      // ---- FRAGMENTADO (desvaneciéndose) ----
      x.globalAlpha = 0.75;
      discR19(x, 5, 6, 2.2, B, 0.6);
      discR19(x, 9, 8, 2.6, B, 0.55);
      discR19(x, 6, 10, 1.8, B, 0.5);
      discR19(x, 5, 6, 1.2, D, 0.4);
      // jirones del contorno discontinuo, rotos
      dashedRingR19(x, 5, 6, 3.2, O, 0, 0.5);
      dashedRingR19(x, 9, 8, 3.4, O, 1, 0.45);
      // ojo vacío desgajado del cuerpo
      x.globalAlpha = 0.95;
      rcR19(x, 8, 6, 2, 2, EYE);
      rcR19(x, 8, 6, 1, 1, GL);
      // motas que se pierden
      x.globalAlpha = 0.4;
      rcR19(x, 11, 4, 1, 1, B); rcR19(x, 3, 11, 1, 1, B); rcR19(x, 12, 10, 1, 1, B);
      x.globalAlpha = 1;
      frames.push(c);
      continue;
    }
    const bob = f === 1 ? -1 : 0;
    const cy = 7 + bob;
    // cuerpo translúcido con sombra interna
    discR19(x, 7, cy, 5.2, O, 0.8);
    discR19(x, 7, cy, 4.4, B, 0.55);
    discR19(x, 7, cy + 1.5, 3, D, 0.35);
    // contorno DISCONTINUO (gira con el frame)
    dashedRingR19(x, 7, cy, 5.4, O, f, 0.9);
    // ojo vacío (socket oscuro con brillo mínimo)
    x.globalAlpha = 1;
    rcR19(x, 8, cy - 1, 2, 2, EYE);
    x.globalAlpha = 0.8;
    rcR19(x, 8, cy - 1, 1, 1, GL);
    // jirones inferiores (cola de recuerdo)
    x.globalAlpha = 0.55;
    rcR19(x, 5, cy + 5, 1, 2, B);
    rcR19(x, 8, cy + 5, 2, 1, B);
    rcR19(x, 7, cy + 6, 1, 1, D);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

function buildVigiaTintaR19(): Frames {
  const frames: Frames = [];
  const TINTA = '#241d38', IRIS = '#b48fff', PUP = '#120c22', CORAL = '#e8836a', CORAL2 = '#ff9f7d', GL = '#ffffff', BASE = '#3a3054';
  for (let f = 0; f < 3; f++) {
    const { c, x } = cvR19(16, 16);
    // pestañas de coral (4-5, más erguidas en el telegraph)
    x.globalAlpha = 1;
    const lashY = f === 2 ? 1 : 2;
    rcR19(x, 4, lashY + 1, 1, 2, CORAL); rcR19(x, 4, lashY, 1, 1, CORAL2);
    rcR19(x, 6, lashY, 1, 2, CORAL); rcR19(x, 6, lashY - 1, 1, 1, CORAL2);
    rcR19(x, 9, lashY, 1, 2, CORAL); rcR19(x, 9, lashY - 1, 1, 1, CORAL2);
    rcR19(x, 11, lashY + 1, 1, 2, CORAL); rcR19(x, 11, lashY, 1, 1, CORAL2);
    if (f === 2) { rcR19(x, 2, lashY + 2, 1, 2, CORAL); rcR19(x, 13, lashY + 2, 1, 2, CORAL); }
    if (f === 1) {
      // ---- PARPADEO: párpado coral cerrando el ojo ----
      discR19(x, 8, 8, 5.2, TINTA, 0.9);
      rcR19(x, 4, 7, 9, 2, CORAL);
      rcR19(x, 5, 9, 7, 1, CORAL2);
      x.globalAlpha = 0.6;
      rcR19(x, 6, 10, 5, 1, PUP);
      x.globalAlpha = 1;
    } else {
      // ---- ojo abierto (f0) / telegraph (f2: iris grande) ----
      discR19(x, 8, 8, 5.2, TINTA);
      discR19(x, 8, 8, f === 2 ? 4.0 : 3.3, IRIS, 0.92);
      discR19(x, 8, 8, f === 2 ? 1.1 : 1.6, PUP);
      x.globalAlpha = 0.95;
      rcR19(x, 7, 6, 1, 1, GL);
      if (f === 2) { rcR19(x, 10, 7, 1, 1, GL); }
      x.globalAlpha = 1;
    }
    // charco de tinta en la base (gotea más en telegraph)
    discR19(x, 8, 13, f === 2 ? 3.0 : 2.3, BASE, 0.55);
    x.globalAlpha = 0.8;
    rcR19(x, 7, 13, 2, f === 2 ? 3 : 2, TINTA);
    if (f !== 1) rcR19(x, 8, 15, 1, 1, TINTA);
    // burbujas de tinta del telegraph
    if (f === 2) {
      x.globalAlpha = 0.7;
      rcR19(x, 4, 4, 1, 1, '#c8b0ff');
      rcR19(x, 12, 5, 1, 1, '#c8b0ff');
      rcR19(x, 10, 2, 1, 1, '#c8b0ff');
    }
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

let spritesR19Init = false;
/** Registro idempotente de los sprites 19-e. CABLEADO (f): engine constructor. */
export function initEnemigosR19Sprites(): void {
  if (spritesR19Init) return;
  spritesR19Init = true;
  registerSpr('eco_desv', buildEcoDesvR19());
  registerSpr('vigia_tinta', buildVigiaTintaR19());
}

// ============================================================
// SPAWNS — push a MAPS AL CARGAR (patrón puestarSpawns14a), idempotente.
// Posiciones verificadas transitables (SOLID_CHARS) en AMBAS épocas donde
// aplica, BFS-alcanzables desde exits/NPCs y a ≥8 tiles de exits/NPCs
// (≥4 de spawns/echoes existentes) — el smoke lo re-verifica.
// ============================================================

interface SpawnR19 { map: 'bosque' | 'cripta' | 'costa'; type: 'eco_desvanecido' | 'vigia_tinta'; x: number; y: number; patrol: number; zone: string }

export const SPAWNS_R19: readonly SpawnR19[] = [
  // eco_desvanecido ×4 — Bosque Susurrante (dispersos, lejos de exits/NPCs)
  { map: 'bosque', type: 'eco_desvanecido', x: 29, y: 8, patrol: 3, zone: 'bosque' },
  { map: 'bosque', type: 'eco_desvanecido', x: 4, y: 13, patrol: 3, zone: 'bosque' },
  { map: 'bosque', type: 'eco_desvanecido', x: 16, y: 13, patrol: 3, zone: 'bosque' },
  { map: 'bosque', type: 'eco_desvanecido', x: 44, y: 13, patrol: 3, zone: 'bosque' },
  // eco_desvanecido ×2 — Cripta del Primer Canto
  { map: 'cripta', type: 'eco_desvanecido', x: 10, y: 12, patrol: 2, zone: 'cripta' },
  { map: 'cripta', type: 'eco_desvanecido', x: 23, y: 15, patrol: 2, zone: 'cripta' },
  // vigia_tinta ×3 — Costa de Bruma (cornisa norte, junto al mar)
  { map: 'costa', type: 'vigia_tinta', x: 8, y: 8, patrol: 3, zone: 'costa' },
  { map: 'costa', type: 'vigia_tinta', x: 20, y: 12, patrol: 3, zone: 'costa' },
  { map: 'costa', type: 'vigia_tinta', x: 32, y: 8, patrol: 3, zone: 'costa' },
];

let spawnsR19Puestos = false;

/**
 * Pushea los spawns 19-e a MAPS. Se ejecuta AL CARGAR el módulo (igual que
 * puestarSpawns14a); llamadas extra son no-op (guard + comprobación por mapa
 * tolerante a HMR).
 */
export function instalarEnemigosR19(): void {
  if (spawnsR19Puestos) return;
  spawnsR19Puestos = true;
  for (const s of SPAWNS_R19) {
    const m = MAPS[s.map];
    if (!m) continue;
    // cast documentado: EnemyType es unión cerrada (types.ts:13 congelado) —
    // mismo precedente que ARENA_MAP_ID (maps_expansion.ts:324)
    const t = s.type as unknown as EnemyType;
    // idempotencia por SPAWN exacto (tolerante a HMR/llamadas repetidas)
    const t2 = t as string;
    if (m.spawns.some(sp => sp.type === (t2 as EnemyType) && sp.x === s.x && sp.y === s.y)) continue;
    m.spawns.push({ type: t, x: s.x, y: s.y, patrol: s.patrol, zone: s.zone });
  }
}
instalarEnemigosR19();

// ============================================================
// DEFS de los 2 enemigos nuevos — el integrador fusiona con
// Object.assign(ENEMY_DEFS, ENEMY_DEFS_R19) en data.ts (cableado e).
// NOTA de elementos: types.ts:14 Element = fuego|hielo|rayo|sombra|sagrado|
// ninguno — NO existe 'agua'. El Vigía usa 'sombra' (tinta de la Niebla) y
// es débil al 'rayo' (el chispazo disuelve la tinta); el Eco usa 'sombra'
// débil al 'sagrado' (la luz recuerda lo que el olvido borra).
// ============================================================

export const ENEMY_DEFS_R19: Record<string, EnemyDef> = {
  eco_desvanecido: {
    name: 'Eco Desvanecido',
    hp: 42, dmg: 9, speed: 52, xp: 34, gold: [8, 16],
    sprite: 'eco_desv',
    aggroR: 140, atkR: 34, windup: 0.6, atkCd: 2.1,
    element: 'sombra', weakTo: 'sagrado',
    desc: 'Un recuerdo que aprendió a moverse. Se desvanece cuando te acercas y dispara notas con eco.',
  },
  vigia_tinta: {
    name: 'Vigía de Tinta',
    hp: 56, dmg: 11, speed: 30, xp: 40, gold: [10, 20],
    sprite: 'vigia_tinta',
    aggroR: 150, atkR: 130, windup: 0.9, atkCd: 2.8,
    element: 'sombra', weakTo: 'rayo',
    desc: 'Un ojo de tinta que vigila lo que el mar se llevó. Apunta con estelas de tinta y escupe una mancha lenta.',
  },
};

// ---------------- gancho dev (smoke/debug; WeakMap no es iterable) ----------------

export function __r19Debug(): { buffsActivos: number } {
  return { buffsActivos };
}
