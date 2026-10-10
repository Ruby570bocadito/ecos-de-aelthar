// ============================================================
// R16 · «MAREAS Y RAÍCES» — cerebros de los enemigos nuevos
//  · centinela — torreta de cristal: guarda distancia (70-130 px), APUNTA
//    siguiendo al Portador el 65% de la carga, fija la línea (roja) y
//    dispara un rayo recto que se corta en los muros. Esquivable/parable.
//  · raiz      — se ENTIERRA (intangible), viaja bajo tierra hacia el
//    Portador, marca un círculo y BROTA con púas (telegrafía del motor);
//    queda expuesta 1,6 s: ventana de castigo. Débil al fuego.
//  · ahogado   — sin cerebro propio: IA genérica del motor (patrulla/
//    persecución/embestida) con sprite y animación propios.
//  · madre     — LA MADRE DEL MAR, jefa opcional de los Jardines de Sal
//    (Costa) tras derrotar a la Sirena, desde q9. 3 fases por vida:
//      F1 «Nana»   — anillo de notas con HUECO hacia ella + ancla (línea de
//                    golpes de coral que avanza hacia ti).
//      F2 «Marea»  — + coral que brota bajo tus pies y llama a 2 ahogados.
//      F3 «Llanto» — + espiral de notas de dos brazos y se teletransporta
//                    entre los restos del naufragio.
// Contrato con update.ts: el motor ya aplicó hitFlash/spawnGuard/knockback/
// estados/invulT antes de r16Tick; aquí va TODO lo demás y se devuelve true
// (el motor salta su IA genérica). El 'ahogado' devuelve false.
// Memoria transitoria por WeakMap (no serializa; patrón enemies_expansion).
// ============================================================

import type { Game } from './engine';
import type { Enemy, Player } from './types';
import type { EnemyDef } from './data';
import { audio } from './audio';
import { spawnVfx } from './actors/vfx';
import { startBossIntro, resetBossIntro } from './actors/bossintro';
import { dreadInit, dreadStinger } from './actors/dread';
import { nightAggroMul } from './world/lighting';

export const R16_TYPES = new Set<string>(['centinela', 'raiz', 'madre']);

type RaizSt = 'superficie' | 'bajo' | 'brota' | 'expuesta';
type MadreAct = 'nana' | 'ancla' | 'marea' | 'llanto';

interface R16Mem {
  // centinela
  ax?: number; ay?: number; len?: number; beamHit?: boolean;
  // raíz
  st?: RaizSt; t?: number; tx?: number; ty?: number;
  // madre
  phase?: number; act?: MadreAct; actIdx?: number; sumT?: number; tpT?: number;
  spiralT?: number; spiralA?: number; emitT?: number;
}
const MEM = new WeakMap<Enemy, R16Mem>();
function mem(e: Enemy): R16Mem {
  let m = MEM.get(e);
  if (!m) { m = {}; MEM.set(e, m); }
  return m;
}
/** Ahogados que invocó la Madre (su cap solo los cuenta a ellos). */
const tripulacion = new WeakSet<Enemy>();

const d2 = (ax: number, ay: number, bx: number, by: number) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);

/** Movimiento con colisión por ejes (moveEntity del motor) y orientación. */
function step(g: Game, e: Enemy, dx: number, dy: number, spd: number, dt: number) {
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  g.moveEntity(e, (dx / l) * spd * dt, (dy / l) * spd * dt);
  e.moving = true;
  if (Math.abs(dx) > 0.01) e.dir = dx > 0 ? 'right' : 'left';
}

/** Bloque común: cooldown/anim/aggro/aturdimiento. true = frame consumido. */
function prelude(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, boss: boolean): boolean {
  e.atkCd -= dt;
  e.anim += dt * (e.moving ? 1.4 : 0.6);
  if (!e.aggro && g.state === 'play') {
    const night = boss || g.map.dark || g.map.indoor ? 1 : nightAggroMul(g.dayT * 1440);
    const r = def.aggroR * night;
    if (d2(e.x, e.y, p.x, p.y) < r * r) { e.aggro = true; if (!boss) audio.sfx('blip'); }
  }
  if (e.ai === 'aturdido') {
    const cap = boss ? 2.6 : 1.8;
    if (e.aiT > cap) e.aiT = cap;
    e.aiT -= dt;
    e.moving = false;
    e.windup = 0;
    if (boss && Math.random() < 0.5) {
      // la madera cruje: astillas y gotas de mar mientras está quebrada
      g.particles.push({ x: e.x + (Math.random() - 0.5) * 22, y: e.y - 14 - Math.random() * 12, vx: (Math.random() - 0.5) * 20, vy: 10 + Math.random() * 10, t: 0.5, maxT: 0.5, color: Math.random() < 0.5 ? '#a8764a' : '#9ad0ee', size: 1.5, grav: 220 });
    }
    if (e.aiT <= 0) { e.ai = 'persigue'; if (e.maxSta > 0) e.sta = e.maxSta; }
    return true;
  }
  return false;
}

/** Entrada única (update.ts). true = el frame lo gestionó este módulo. */
export function r16Tick(g: Game, e: Enemy, dt: number, def: EnemyDef): boolean {
  const p = g.player;
  if (!p) return false;
  switch (e.etype) {
    case 'centinela': if (prelude(g, e, dt, def, p, false)) return true; tickCentinela(g, e, dt, def, p, mem(e)); return true;
    case 'raiz': tickRaiz(g, e, dt, def, p, mem(e)); return true;
    case 'madre': if (prelude(g, e, dt, def, p, true)) return true; tickMadre(g, e, dt, def, p, mem(e)); return true;
    default: return false;
  }
}

// ================================================================ CENTINELA
const BEAM_MAX = 190;

function beamLen(g: Game, x: number, y: number, ax: number, ay: number): number {
  for (let s = 10; s <= BEAM_MAX; s += 5) {
    if (g.tileSolidAt(x + ax * s, y - 6 + ay * s)) return s;
  }
  return BEAM_MAX;
}

function tickCentinela(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: R16Mem) {
  const dd = d2(e.x, e.y, p.x, p.y);
  e.moving = false;
  if (!e.aggro) { e.ai = 'patrulla'; return; }
  if (dd > (def.aggroR * 2.4) ** 2 && e.ai !== 'carga' && e.ai !== 'ataca') { e.aggro = false; e.ai = 'patrulla'; return; }
  switch (e.ai) {
    case 'carga': {
      e.windup -= dt;
      // apunta siguiendo al Portador el 65% de la carga; luego la línea se FIJA
      if (e.windup > def.windup * 0.35) {
        const dx = p.x - e.x, dy = (p.y - 4) - (e.y - 6);
        const l = Math.sqrt(dx * dx + dy * dy) || 1;
        m.ax = dx / l; m.ay = dy / l;
        m.len = beamLen(g, e.x, e.y, m.ax, m.ay);
        e.dir = dx > 0 ? 'right' : 'left';
      }
      if (e.windup <= 0) {
        e.ai = 'ataca'; e.aiT = 0.24; m.beamHit = false;
        audio.sfx('bolt');
        spawnVfx('impact', e.x + (m.ax ?? 0) * 10, e.y - 6 + (m.ay ?? 0) * 10, { el: 'hielo', flag: 1 });
      }
      return;
    }
    case 'ataca': {
      e.aiT -= dt;
      const ax = m.ax ?? 1, ay = m.ay ?? 0, L = m.len ?? BEAM_MAX;
      if (!m.beamHit && p.rollT <= 0 && p.iframes <= 0) {
        // distancia del Portador al segmento del rayo
        const rx = p.x - e.x, ry = (p.y - 4) - (e.y - 6);
        const along = rx * ax + ry * ay;
        if (along > 0 && along < L) {
          const perp = Math.abs(rx * ay - ry * ax);
          if (perp < 8) {
            m.beamHit = true;
            g.damagePlayer(def.dmg, e.x + ax * Math.max(0, along - 12), e.y - 6 + ay * Math.max(0, along - 12));
          }
        }
      }
      if (e.aiT <= 0) { e.ai = 'recupera'; e.aiT = 0.7; e.atkCd = def.atkCd * (0.85 + Math.random() * 0.3); }
      return;
    }
    case 'recupera':
      e.aiT -= dt;
      if (e.aiT <= 0) e.ai = 'persigue';
      return;
    default: {
      e.ai = 'persigue';
      const d = Math.sqrt(dd);
      const dx = p.x - e.x, dy = p.y - e.y;
      if (d < 70) step(g, e, -dx, -dy, def.speed * 1.2, dt);          // guarda distancia
      else if (d > 130) step(g, e, dx, dy, def.speed, dt);
      else {
        // flota de lado (lado determinista por su hogar)
        const sd = ((e.homeX + e.homeY) | 0) & 1 ? 1 : -1;
        step(g, e, -dy * sd, dx * sd, def.speed * 0.5, dt);
      }
      if (dd <= def.atkR * def.atkR && e.atkCd <= 0) {
        e.ai = 'carga'; e.windup = def.windup;
        audio.sfx('ice');
      }
    }
  }
}

// ================================================================ RAÍZ
function tickRaiz(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: R16Mem) {
  e.atkCd -= dt;
  e.anim += dt * 0.8;
  e.moving = false;
  if (!m.st) m.st = 'superficie';
  const dd = d2(e.x, e.y, p.x, p.y);
  if (!e.aggro && g.state === 'play') {
    const r = def.aggroR * (g.map.dark ? 1 : nightAggroMul(g.dayT * 1440));
    if (dd < r * r) e.aggro = true;
  }
  // quebrada/aturdida (parada perfecta, Muro de Alba): emerge y queda expuesta
  if (e.ai === 'aturdido') {
    m.st = 'expuesta'; m.t = Math.max(m.t ?? 0, 0.5);
    e.invulT = 0;
    e.aiT -= dt;
    if (e.aiT <= 0) e.ai = 'persigue';
    return;
  }
  switch (m.st) {
    case 'superficie':
      if (e.aggro) {
        m.st = 'bajo'; m.t = 0;
        g.burst(e.x, e.y, '#73583a', 10, 50);
        audio.sfx('dodge');
      }
      return;
    case 'bajo': {
      e.invulT = 0.2;                                      // bajo tierra: intangible
      m.t = (m.t ?? 0) + dt;
      if (dd > (def.aggroR * 2.4) ** 2) { e.aggro = false; m.st = 'superficie'; e.invulT = 0; return; }
      step(g, e, p.x - e.x, p.y - e.y, def.speed, dt);
      if (Math.random() < 0.3) {
        g.particles.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y + 2, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, t: 0.35, maxT: 0.35, color: '#6a5034', size: 1.4, grav: 160 });
      }
      if ((dd < 16 * 16 || m.t > 2.4) && e.atkCd <= 0) {
        m.st = 'brota'; m.t = 0.75; m.tx = p.x; m.ty = p.y;
        g.telegraphs.push({ x: p.x, y: p.y, r: 20, t: 0.75, maxT: 0.75, dmg: def.dmg, kind: 'slam' });
        audio.sfx('slam');
      }
      return;
    }
    case 'brota': {
      e.invulT = 0.2;
      m.t = (m.t ?? 0) - dt;
      // se coloca bajo el círculo
      const tx = m.tx ?? p.x, ty = m.ty ?? p.y;
      if (d2(e.x, e.y, tx, ty) > 4) step(g, e, tx - e.x, ty - e.y, 140, dt);
      if (m.t <= 0) {
        m.st = 'expuesta'; m.t = 1.6;
        e.invulT = 0;
        e.ai = 'ataca'; e.aiT = 0.3;
        e.atkCd = def.atkCd;
        spawnVfx('impact', e.x, e.y - 6, { flag: 1 });
        g.burst(e.x, e.y, '#8a6a42', 16, 90);
      }
      return;
    }
    case 'expuesta':
      m.t = (m.t ?? 0) - dt;
      if (e.ai === 'ataca') { e.aiT -= dt; if (e.aiT <= 0) e.ai = 'recupera'; }
      if (m.t <= 0) {
        e.ai = 'persigue';
        m.st = e.aggro ? 'bajo' : 'superficie'; m.t = 0;
        g.burst(e.x, e.y, '#73583a', 8, 40);
      }
      return;
  }
}

/** Frame de la raíz según su estado (lo pide render.ts). */
export function raizFrame(e: Enemy): number {
  const m = MEM.get(e);
  const st = m?.st ?? 'superficie';
  if (st === 'bajo' || st === 'brota') return 4;           // montículo
  if (st === 'expuesta') return e.ai === 'ataca' ? 3 : (m!.t ?? 0) > 1.3 ? 2 : (Math.floor(e.anim * 3) % 2);
  return Math.floor(e.anim * 2) % 2;
}

// ================================================================ MADRE DEL MAR
function nota(g: Game, x: number, y: number, a: number, spd: number, dmg: number) {
  g.projectiles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, t: 2.6, dmg, element: 'hielo', from: 'enemy', sprite: 'nota', radius: 5, pierce: 0 });
}

const PHASE_NAMES = ['', '', 'LA MAREA', 'EL LLANTO'];

function tickMadre(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: R16Mem) {
  const ratio = e.hp / e.maxHp;
  const ph = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
  if ((m.phase ?? 1) < ph) {
    m.phase = ph;
    e.phase = ph;
    g.toast(`La Madre del Mar: ${PHASE_NAMES[ph]}`, '#9ee6ff');
    spawnVfx('nova', e.x, e.y, { el: 'hielo', size: 1.3, life: 0.8 });
    g.shake = Math.max(g.shake, 7);
    audio.sfx('song');
    m.sumT = 1.5; m.tpT = 4;
  }
  m.phase = ph;
  const dd = d2(e.x, e.y, p.x, p.y);
  const d = Math.sqrt(dd);
  e.moving = false;
  // invocación de la tripulación (F2+)
  if (ph >= 2) {
    m.sumT = (m.sumT ?? 2) - dt;
    if (m.sumT <= 0) {
      m.sumT = 13;
      let vivos = 0;
      for (const o of g.enemies) if (!o.dead && tripulacion.has(o)) vivos++;
      for (let i = 0; i < 2 && vivos < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const x = e.x + Math.cos(a) * 34, y = e.y + Math.sin(a) * 24;
        if (g.tileSolidAt(x, y)) continue;
        const s = g.makeEnemy('ahogado', x, y, 1, 'boss');
        s.aggro = true; s.spawnGuard = 0.7;
        tripulacion.add(s);
        g.enemies.push(s);
        vivos++;
        g.burst(x, y, '#9ad0ee', 12, 60);
      }
      g.floatAt(e.x, e.y - 40, '¡Tripulación, a mí!', '#9ee6ff', 7);
      audio.sfx('splash');
    }
  }
  // teletransporte entre los restos (F3)
  if (ph >= 3 && e.ai !== 'carga' && e.ai !== 'ataca') {
    m.tpT = (m.tpT ?? 6) - dt;
    if (m.tpT <= 0) {
      m.tpT = 8;
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 60;
        const nx = e.homeX + Math.cos(a) * r, ny = e.homeY + Math.sin(a) * r * 0.7;
        if (!g.boxFree(nx, ny, e.w, e.h) || d2(nx, ny, p.x, p.y) < 50 * 50) continue;
        g.burst(e.x, e.y - 10, '#9ad0ee', 18, 80);
        spawnVfx('frost', e.x, e.y, { size: 1.2 });
        e.x = nx; e.y = ny;
        e.invulT = 0.35;
        g.burst(e.x, e.y - 10, '#d8eef8', 18, 80);
        audio.sfx('splash');
        break;
      }
    }
  }
  switch (e.ai) {
    case 'carga': {
      e.windup -= dt;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) execMadre(g, e, def, p, m, ph);
      return;
    }
    case 'ataca': {
      e.aiT -= dt;
      if (m.act === 'llanto' && (m.spiralT ?? 0) > 0) {
        m.spiralT = (m.spiralT ?? 0) - dt;
        m.emitT = (m.emitT ?? 0) - dt;
        while ((m.emitT ?? 0) <= 0) {
          m.emitT = (m.emitT ?? 0) + 0.09;
          m.spiralA = (m.spiralA ?? 0) + 0.32;
          for (let arm = 0; arm < 2; arm++) nota(g, e.x, e.y - 10, (m.spiralA ?? 0) + arm * Math.PI, 95, Math.round(def.dmg * 0.6));
        }
      }
      if (e.aiT <= 0) {
        e.ai = 'recupera'; e.aiT = 0.55;
        e.atkCd = def.atkCd * (ph === 3 ? 0.7 : ph === 2 ? 0.85 : 1);
      }
      return;
    }
    case 'recupera':
      e.aiT -= dt;
      if (e.aiT <= 0) e.ai = 'persigue';
      return;
    default: {
      e.ai = 'persigue';
      if (!e.aggro) return;
      // vaivén lento: se acerca si estás lejos, recula si te pegas
      if (d > 110) step(g, e, p.x - e.x, p.y - e.y, def.speed, dt);
      else if (d < 46) step(g, e, e.x - p.x, e.y - p.y, def.speed * 0.8, dt);
      if (e.atkCd <= 0 && d < def.atkR) {
        const pool: MadreAct[] = ph === 1 ? ['nana', 'ancla'] : ph === 2 ? ['nana', 'marea', 'ancla'] : ['llanto', 'marea', 'nana', 'ancla'];
        m.actIdx = ((m.actIdx ?? -1) + 1) % pool.length;
        m.act = pool[m.actIdx];
        e.ai = 'carga';
        e.windup = m.act === 'nana' ? 0.8 : m.act === 'llanto' ? 0.7 : m.act === 'ancla' ? 0.6 : 0.5;
        if (m.act === 'nana' || m.act === 'llanto') audio.sfx('song');
      }
    }
  }
}

function execMadre(g: Game, e: Enemy, def: EnemyDef, p: Player, m: R16Mem, ph: number) {
  const base = Math.atan2(p.y - 4 - (e.y - 18), p.x - e.x);
  e.ai = 'ataca';
  e.aiT = 0.35;
  switch (m.act) {
    case 'nana': {
      // anillo con HUECO de 3 notas orientado hacia ella-Portador: el sitio
      // seguro es acercarse (la nana se esquiva yendo hacia la madre)
      const n = ph === 1 ? 16 : 20;
      const gap = Math.round(((base + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * n);
      for (let i = 0; i < n; i++) {
        const di = Math.min(Math.abs(i - gap), n - Math.abs(i - gap));
        if (di <= 1) continue;
        nota(g, e.x, e.y - 10, (i / n) * Math.PI * 2, 100 + ph * 8, Math.round(def.dmg * 0.75));
      }
      spawnVfx('nova', e.x, e.y - 10, { el: 'hielo', size: 0.6, life: 0.4 });
      break;
    }
    case 'ancla': {
      // golpes de coral en línea que avanzan hacia el Portador
      const n = 5;
      for (let i = 0; i < n; i++) {
        const r = 26 + i * 24;
        const x = e.x + Math.cos(base) * r, y = e.y + Math.sin(base) * r;
        g.telegraphs.push({ x, y, r: 15, t: 0.5 + i * 0.13, maxT: 0.5 + i * 0.13, dmg: def.dmg, kind: 'slam' });
      }
      audio.sfx('slam');
      break;
    }
    case 'marea': {
      // el coral brota bajo tus pies (tres círculos)
      g.telegraphs.push({ x: p.x, y: p.y, r: 19, t: 0.8, maxT: 0.8, dmg: def.dmg, kind: 'slam' });
      for (let k = 0; k < 2; k++) {
        const a = base + (k ? 1 : -1) * 1.9;
        g.telegraphs.push({ x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, r: 17, t: 0.95, maxT: 0.95, dmg: def.dmg, kind: 'slam' });
      }
      audio.sfx('splash');
      break;
    }
    case 'llanto':
      m.spiralT = 1.5; m.emitT = 0; m.spiralA = base;
      e.aiT = 1.55;
      break;
  }
}

/** Frame de la Madre: vaivén · canto · embate · quebrada. */
export function madreFrame(e: Enemy): number {
  if (e.ai === 'aturdido') return 4;
  const m = MEM.get(e);
  if (e.ai === 'carga') return m?.act === 'ancla' || m?.act === 'marea' ? 3 : 2;
  if (e.ai === 'ataca') return m?.act === 'llanto' || m?.act === 'nana' ? 2 : 3;
  return Math.floor(e.anim * 1.6) % 2;
}

/** Frame del centinela: flotación ×4 · carga · disparo. */
export function centinelaFrame(e: Enemy): number {
  if (e.ai === 'carga') return 4;
  if (e.ai === 'ataca') return 5;
  return Math.floor(e.anim * 3) % 4;
}

/** Frame del ahogado: andar ×4 · carga · golpe. */
export function ahogadoFrame(e: Enemy): number {
  if (e.ai === 'carga') return 4;
  if (e.ai === 'ataca') return 5;
  return e.moving ? Math.floor(e.anim * 4) % 4 : 0;
}

// ================================================================ WATCHER DE LA JEFA
/** Centro de los Jardines de Sal (Costa, R10-2): donde canta la Madre. */
// Norte de los Jardines de Sal: arena abierta, a >10 tiles de la calzada a
// Merrow (el viaje obligatorio no la despierta) y con el charco al sur como
// cobertura táctica (el agua corta las notas).
export const MADRE_ARENA = { tx: 53, ty: 6 } as const;

export function r16Watchers(g: Game): void {
  if (g.mapId !== 'costa' || g.challengeRun || g.state !== 'play') return;
  const p = g.player;
  // jefa OPCIONAL de mitad del Acto II en adelante (q9+): tras la Sirena
  if (!p || !g.flags.sirenaDefeated || g.flags.madreDefeated) return;
  if (g.questIdx < 8 && !g.flags.acto2Done) return;
  const ax = MADRE_ARENA.tx * 16 + 8, ay = MADRE_ARENA.ty * 16 + 8;
  let madre: Enemy | null = null;
  for (const o of g.enemies) if (!o.dead && o.etype === 'madre') { madre = o; break; }
  if (!madre) {
    if (d2(p.x, p.y, ax, ay) > 120 * 120) return;
    madre = g.makeEnemy('madre', ax, ay, 0, 'boss');
    const saved = g.flags.bossHp_costa_madre;
    if (typeof saved === 'number') madre.hp = Math.max(1, Math.min(madre.maxHp, saved));
    madre.spawnGuard = 1.3;
    madre.aggro = true;
    g.enemies.push(madre);
    spawnVfx('nova', ax, ay, { el: 'hielo', size: 1.4, life: 0.9 });
    spawnVfx('frost', ax, ay, { size: 1.6 });
    g.burst(ax, ay - 10, '#9ad0ee', 30, 110);
    g.shake = Math.max(g.shake, 8);
    g.toast('La arena canta una nana... algo enorme se alza del lecho seco', '#9ee6ff');
    audio.sfx('song');
  }
  if (!g.bossActive && d2(p.x, p.y, madre.x, madre.y) < 190 * 190) {
    g.bossRef = madre;
    g.bossActive = true;
    audio.playTrack('boss');
    dreadInit();
    dreadStinger('boss');
    resetBossIntro();
    startBossIntro(g);
    g.toast('LA MADRE DEL MAR despierta: ROMPE SU BARRA DE QUIEBRE', '#9ee6ff');
  }
}

// ================================================================ FX propios (render)
type Proj = (n: number) => number;

/** Línea de mira / rayo del centinela y burbuja de la raíz bajo tierra. */
export function drawR16Fx(ctx: CanvasRenderingContext2D, g: Game, sx: Proj, sy: Proj, Z: number): void {
  let any = false;
  for (const e of g.enemies) if (!e.dead && (e.etype === 'centinela' || e.etype === 'raiz')) { any = true; break; }
  if (!any) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const e of g.enemies) {
    if (e.dead) continue;
    if (e.etype === 'centinela' && (e.ai === 'carga' || e.ai === 'ataca')) {
      const m = MEM.get(e);
      if (!m || m.ax === undefined || m.ay === undefined) continue;
      const L = m.len ?? BEAM_MAX;
      const x0 = sx(e.x), y0 = sy(e.y - 6);
      const x1 = sx(e.x + m.ax * L), y1 = sy(e.y - 6 + m.ay * L);
      if (e.ai === 'carga') {
        const def = 0.95;
        const k = 1 - Math.max(0, e.windup) / def;              // 0 → 1
        const locked = e.windup <= def * 0.35;
        ctx.globalAlpha = 0.25 + 0.55 * k;
        ctx.strokeStyle = locked ? '#ff4a3a' : '#ff9a8a';
        ctx.lineWidth = (locked ? 2 : 1) * Z * (0.6 + k * 0.6);
        ctx.setLineDash(locked ? [] : [4 * Z, 3 * Z]);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.setLineDash([]);
        // punto de mira que late en el extremo
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(g.globalT * 30);
        ctx.fillStyle = '#ff6a5a';
        ctx.beginPath(); ctx.arc(x1, y1, 2.5 * Z, 0, Math.PI * 2); ctx.fill();
      } else {
        const k = Math.max(0, e.aiT) / 0.24;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 * k;
        ctx.strokeStyle = '#5ab4e8';
        ctx.lineWidth = 9 * Z * k + 2 * Z;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.globalAlpha = 0.9 * k;
        ctx.strokeStyle = '#c8f4ff';
        ctx.lineWidth = 3.5 * Z * k + Z;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 * Z;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    } else if (e.etype === 'raiz') {
      const m = MEM.get(e);
      if (m?.st === 'bajo' || m?.st === 'brota') {
        // surco de tierra que ondula tras el montículo
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#4a3622';
        const ph = g.globalT * 8;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.ellipse(sx(e.x) - Math.cos(ph) * k * 2, sy(e.y + 2), (5 - k) * Z, 1.6 * Z, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ================================================================ SPAWNS DE MAPA
let spawnsPuestos = false;
/**
 * Siembra los spawns R16 en las tablas de mapa (UNA vez; lo llama el ctor
 * del motor con MAPS — no a nivel de módulo, por el orden de evaluación).
 * Coordenadas verificadas: transitables y alcanzables desde el santuario
 * en ambas épocas.
 */
export function placeR16Spawns(maps: Record<string, { spawns: { type: string; x: number; y: number; patrol?: number; zone?: string }[] } | undefined>): void {
  if (spawnsPuestos) return;
  spawnsPuestos = true;
  const add = (id: string, type: string, x: number, y: number, patrol: number) => {
    const m = maps[id];
    if (m && !m.spawns.some(s => s.type === type && s.x === x && s.y === y)) m.spawns.push({ type, x, y, patrol, zone: id });
  };
  // Raíces Hambrientas: claros del Bosque Susurrante
  add('bosque', 'raiz', 18, 38, 2);
  add('bosque', 'raiz', 42, 40, 2);
  add('bosque', 'raiz', 56, 17, 2);
  // Centinelas de Cristal: la Orden vigila la Cripta y el campamento minero
  add('cripta', 'centinela', 17, 30, 1);
  add('cripta', 'centinela', 30, 26, 1);
  add('cumbres', 'centinela', 58, 24, 1);
  add('cumbres', 'centinela', 61, 14, 1);
  // la tripulación de La Madre del Mar ronda su naufragio
  add('costa', 'ahogado', 56, 14, 3);
  add('costa', 'ahogado', 47, 14, 3);
}
