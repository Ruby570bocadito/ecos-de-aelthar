// ============================================================
// R18 · «MÁS MUNDO» — enemigos y mini-jefes de las secciones nuevas
//
// ENEMIGOS
//  · cuervo    — vuela en círculo alrededor del Portador, se detiene un
//                instante (telegrafía) y cae en PICADO recto; luego remonta.
//  · arana     — guarda distancia y escupe TELARAÑA (proyectil 'web'): si
//                te alcanza, te ralentiza 1,8 s. Débil al fuego.
//  · cangrejo  — avanza de lado y alza las pinzas en GUARDIA: los golpes de
//                frente le hacen un 25%; rodéalo o rompe su guardia. Pinzazo.
//  · fatuo     — se acerca flotando y se HINCHA (0,9 s, círculo de aviso):
//                estalla. Mátalo antes o apártate.
// MINI-JEFES (uno por sección, vida de diseño, 2 fases)
//  · reina_cuervo — picados con estela, lluvia de plumas, llama a la bandada.
//  · ciervo       — embestida en línea (se aturde si choca contra un muro),
//                   pisotón en anillo; F2: siembra brasas bajo tus pies.
//  · rey_cangrejo — guardia de pinzas, doble pinzazo a los lados, burbujas
//                   en anillo; F2: llama a dos cangrejos.
//  · viuda        — orbes de velo que te persiguen, grito en anillo, llama a
//                   los fuegos fatuos; F2: se vuelve niebla y reaparece.
//  · wendigo      — zarpazo doble, SALTO sobre tu posición (aviso de caída),
//                   aullido con anillo de esquirlas; F2: salta dos veces.
// Contrato con update.ts igual que enemies_r16: el motor ya aplicó
// hitFlash/spawnGuard/knockback/estados antes de r18Tick.
// ============================================================

import type { Game } from './engine';
import type { Enemy, Player, Element } from './types';
import type { EnemyDef } from './data';
import { audio } from './audio';
import { spawnVfx } from './actors/vfx';
import { nightAggroMul } from './world/lighting';

export const R18_TYPES = new Set<string>(['cuervo', 'arana', 'cangrejo', 'fatuo', 'reina_cuervo', 'ciervo', 'rey_cangrejo', 'viuda', 'wendigo']);
export const R18_BOSSES: Readonly<Record<string, string>> = {
  reina_cuervo: 'reinaCuervoDerrotada', ciervo: 'ciervoDerrotado', rey_cangrejo: 'reyCangrejoDerrotado',
  viuda: 'viudaDerrotada', wendigo: 'wendigoDerrotado',
};
/** Tamaño de colisión de los mini-jefes (makeEnemy). */
export const R18_BIG = new Set<string>(['reina_cuervo', 'ciervo', 'rey_cangrejo', 'viuda', 'wendigo']);

import { ENEMY_DEFS_R18 } from './data_r18';
export { ENEMY_DEFS_R18 };

// ---------------------------------------------------------------- memoria
interface Mem {
  st?: string; t?: number; ang?: number; tx?: number; ty?: number; vx?: number; vy?: number;
  phase?: number; act?: number; sumT?: number; guard?: number; hit?: boolean; leaps?: number;
}
const MEM = new WeakMap<Enemy, Mem>();
function mem(e: Enemy): Mem { let m = MEM.get(e); if (!m) { m = {}; MEM.set(e, m); } return m; }
const minions = new WeakSet<Enemy>();
const d2 = (ax: number, ay: number, bx: number, by: number) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);

function step(g: Game, e: Enemy, dx: number, dy: number, spd: number, dt: number): boolean {
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  const ox = e.x, oy = e.y;
  g.moveEntity(e, (dx / l) * spd * dt, (dy / l) * spd * dt);
  e.moving = true;
  if (Math.abs(dx) > 0.01) e.dir = dx > 0 ? 'right' : 'left';
  // ¿chocó? (avanzó mucho menos de lo pedido)
  return Math.hypot(e.x - ox, e.y - oy) < spd * dt * 0.3;
}

function prelude(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, boss: boolean): boolean {
  e.atkCd -= dt;
  e.anim += dt * (e.moving ? 1.4 : 0.7);
  if (!e.aggro && g.state === 'play') {
    const night = boss || g.map.dark || g.map.indoor ? 1 : nightAggroMul(g.dayT * 1440);
    const r = def.aggroR * night;
    if (d2(e.x, e.y, p.x, p.y) < r * r) { e.aggro = true; if (!boss) audio.sfx('blip'); }
  }
  if (e.ai === 'aturdido') {
    const cap = boss ? 2.6 : 1.6;
    if (e.aiT > cap) e.aiT = cap;
    e.aiT -= dt;
    e.moving = false;
    e.windup = 0;
    if (e.aiT <= 0) { e.ai = 'persigue'; if (e.maxSta > 0) e.sta = e.maxSta; }
    return true;
  }
  return false;
}

function shoot(g: Game, x: number, y: number, a: number, spd: number, dmg: number, sprite: string, element: Element = 'sombra', t = 2.4) {
  g.projectiles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, t, dmg, element, from: 'enemy', sprite, radius: 5, pierce: 0 });
}
function slam(g: Game, x: number, y: number, r: number, t: number, dmg: number) {
  g.telegraphs.push({ x, y, r, t, maxT: t, dmg, kind: 'slam' });
}
function contact(g: Game, e: Enemy, p: Player, r: number, dmg: number, m: Mem): void {
  if (m.hit || p.rollT > 0 || p.iframes > 0) return;
  if (d2(e.x, e.y, p.x, p.y) < r * r) { m.hit = true; g.damagePlayer(dmg, e.x, e.y); }
}
function phaseOf(e: Enemy): number { return e.hp / e.maxHp > 0.5 ? 1 : 2; }
function announcePhase(g: Game, e: Enemy, m: Mem, line: string, color: string): void {
  const ph = phaseOf(e);
  if ((m.phase ?? 1) < ph) {
    m.phase = ph; e.phase = ph;
    g.toast(line, color);
    spawnVfx('nova', e.x, e.y - 8, { el: ENEMY_DEFS_R18[e.etype]?.element ?? 'sombra', size: 1.2, life: 0.7 });
    g.shake = Math.max(g.shake, 6);
    audio.sfx('roar');
  }
}
function summon(g: Game, e: Enemy, type: Enemy['etype'], n: number, cap: number, line: string): void {
  let vivos = 0;
  for (const o of g.enemies) if (!o.dead && minions.has(o)) vivos++;
  for (let i = 0; i < n && vivos < cap; i++) {
    const a = (i / n) * Math.PI * 2 + e.anim;
    const x = e.x + Math.cos(a) * 34, y = e.y + Math.sin(a) * 24;
    if (g.tileSolidAt(x, y)) continue;
    const s = g.makeEnemy(type, x, y, 1, 'boss');
    s.aggro = true; s.spawnGuard = 0.6;
    minions.add(s);
    g.enemies.push(s);
    vivos++;
    g.burst(x, y, '#c8b0e8', 10, 50);
  }
  g.floatAt(e.x, e.y - 40, line, '#e8d0ff', 7);
}

// ---------------------------------------------------------------- entrada
export function r18Tick(g: Game, e: Enemy, dt: number, def: EnemyDef): boolean {
  const p = g.player;
  if (!p) return false;
  const boss = R18_BIG.has(e.etype);
  if (e.etype !== 'fatuo' && prelude(g, e, dt, def, p, boss)) return true;
  const m = mem(e);
  e.moving = false;
  if (!e.aggro && e.etype !== 'fatuo') { wander(g, e, dt, def); return true; }
  switch (e.etype) {
    case 'cuervo': tickCuervo(g, e, dt, def, p, m); break;
    case 'arana': tickArana(g, e, dt, def, p, m); break;
    case 'cangrejo': tickCangrejo(g, e, dt, def, p, m); break;
    case 'fatuo': tickFatuo(g, e, dt, def, p, m); break;
    case 'reina_cuervo': tickReina(g, e, dt, def, p, m); break;
    case 'ciervo': tickCiervo(g, e, dt, def, p, m); break;
    case 'rey_cangrejo': tickRey(g, e, dt, def, p, m); break;
    case 'viuda': tickViuda(g, e, dt, def, p, m); break;
    case 'wendigo': tickWendigo(g, e, dt, def, p, m); break;
    default: return false;
  }
  // correa: muy lejos de casa y sin el Portador cerca → vuelve a patrullar
  if (!boss && d2(e.x, e.y, p.x, p.y) > (def.aggroR * 2.6) ** 2) { e.aggro = false; e.ai = 'patrulla'; }
  return true;
}

function wander(g: Game, e: Enemy, dt: number, def: EnemyDef): void {
  e.ai = 'patrulla';
  e.aiT -= dt;
  if (e.aiT <= 0) { e.aiT = 1.5 + ((e.homeX * 7 + e.homeY) % 10) / 10; e.patrolAngle += 1.9; }
  const tx = e.homeX + Math.cos(e.patrolAngle) * 24, ty = e.homeY + Math.sin(e.patrolAngle) * 18;
  if (d2(e.x, e.y, tx, ty) > 16) step(g, e, tx - e.x, ty - e.y, def.speed * 0.4, dt);
}

// ================================================================ CUERVO
function tickCuervo(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: Mem) {
  m.st = m.st ?? 'ronda';
  if (m.st === 'ronda') {
    e.ai = 'persigue';
    m.ang = (m.ang ?? Math.atan2(e.y - p.y, e.x - p.x)) + dt * 1.6;
    const tx = p.x + Math.cos(m.ang) * 52, ty = p.y - 6 + Math.sin(m.ang) * 34;
    step(g, e, tx - e.x, ty - e.y, def.speed * 1.2, dt);
    if (e.atkCd <= 0 && d2(e.x, e.y, p.x, p.y) < def.atkR * def.atkR * 1.6) {
      m.st = 'apunta'; m.t = def.windup; m.tx = p.x; m.ty = p.y; e.ai = 'carga'; e.windup = def.windup;
      audio.sfx('blip');
    }
  } else if (m.st === 'apunta') {
    m.t = (m.t ?? 0) - dt; e.windup = m.t;
    if ((m.t ?? 0) <= 0) {
      const dx = (m.tx ?? p.x) - e.x, dy = (m.ty ?? p.y) - e.y, l = Math.hypot(dx, dy) || 1;
      m.vx = dx / l; m.vy = dy / l; m.st = 'picado'; m.t = 0.42; m.hit = false; e.ai = 'ataca';
      audio.sfx('dodge');
    }
  } else if (m.st === 'picado') {
    m.t = (m.t ?? 0) - dt;
    const blocked = step(g, e, m.vx ?? 0, m.vy ?? 0, 230, dt);
    contact(g, e, p, 13, def.dmg, m);
    if ((m.t ?? 0) <= 0 || blocked) { m.st = 'remonta'; m.t = 0.6; e.ai = 'recupera'; e.atkCd = def.atkCd; }
  } else {
    m.t = (m.t ?? 0) - dt;
    step(g, e, e.x - p.x, e.y - p.y, def.speed, dt);
    if ((m.t ?? 0) <= 0) { m.st = 'ronda'; m.ang = Math.atan2(e.y - p.y, e.x - p.x); }
  }
}

// ================================================================ ARAÑA
function tickArana(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: Mem) {
  const d = Math.sqrt(d2(e.x, e.y, p.x, p.y));
  if (e.ai === 'carga') {
    e.windup -= dt;
    if (e.windup <= 0) {
      const a = Math.atan2(p.y - 4 - (e.y - 4), p.x - e.x);
      shoot(g, e.x + Math.cos(a) * 8, e.y - 4, a, 120, def.dmg, 'web', 'sombra', 1.6);
      e.ai = 'recupera'; e.aiT = 0.5; e.atkCd = def.atkCd; audio.sfx('dodge');
    }
    return;
  }
  if (e.ai === 'recupera') { e.aiT -= dt; if (e.aiT <= 0) e.ai = 'persigue'; return; }
  e.ai = 'persigue';
  if (d < 58) step(g, e, e.x - p.x, e.y - p.y, def.speed * 1.1, dt);
  else if (d > 100) step(g, e, p.x - e.x, p.y - e.y, def.speed, dt);
  else { const sd = (m.ang ?? 1) > 0 ? 1 : -1; step(g, e, -(p.y - e.y) * sd, (p.x - e.x) * sd, def.speed * 0.6, dt); }
  if (e.atkCd <= 0 && d < def.atkR) { e.ai = 'carga'; e.windup = def.windup; }
  if (Math.random() < dt * 0.4) m.ang = -(m.ang ?? 1);
}

// ================================================================ CANGREJO
function tickCangrejo(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: Mem) {
  const d = Math.sqrt(d2(e.x, e.y, p.x, p.y));
  m.guard = Math.max(0, (m.guard ?? 0) - dt);
  if (e.ai === 'carga') {
    e.windup -= dt;
    if (e.windup <= 0) {
      e.ai = 'ataca'; e.aiT = 0.2; m.hit = false;
      audio.sfx('slam');
    }
    return;
  }
  if (e.ai === 'ataca') {
    e.aiT -= dt;
    contact(g, e, p, def.atkR + 6, def.dmg, m);
    if (e.aiT <= 0) { e.ai = 'recupera'; e.aiT = 0.6; e.atkCd = def.atkCd; }
    return;
  }
  if (e.ai === 'recupera') { e.aiT -= dt; if (e.aiT <= 0) { e.ai = 'persigue'; m.guard = 1.1; } return; }
  e.ai = 'persigue';
  // se acerca de lado (zigzag)
  const sd = Math.sin(e.anim * 3) > 0 ? 1 : -1;
  if (d > def.atkR) step(g, e, (p.x - e.x) + (p.y - e.y) * 0.5 * sd, (p.y - e.y) - (p.x - e.x) * 0.5 * sd, def.speed, dt);
  else if (e.atkCd <= 0) { e.ai = 'carga'; e.windup = def.windup; }
  e.dir = p.x > e.x ? 'right' : 'left';
}

// ================================================================ FATUO
function tickFatuo(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: Mem) {
  e.anim += dt * 2;
  const dd = d2(e.x, e.y, p.x, p.y);
  if (!e.aggro) {
    if (g.state === 'play' && dd < def.aggroR * def.aggroR) e.aggro = true;
    else { wander(g, e, dt, def); return; }
  }
  if (m.st === 'mecha') {
    m.t = (m.t ?? 0) - dt;
    e.windup = m.t;
    e.ai = 'carga';
    if ((m.t ?? 0) <= 0) {
      // ESTALLA: el círculo del aviso ya dañó al terminar (telegrafía del motor)
      spawnVfx('nova', e.x, e.y - 6, { el: 'fuego', size: 0.9, life: 0.45 });
      g.burst(e.x, e.y - 6, '#7ef0c8', 22, 110);
      audio.sfx('slam');
      e.dead = true; e.hp = 0;   // se consume (sin botín: no lo has vencido)
    }
    return;
  }
  e.ai = 'persigue';
  step(g, e, p.x - e.x, p.y - 4 - e.y, def.speed * (1 + 0.15 * Math.sin(e.anim * 4)), dt);
  if (dd < def.atkR * def.atkR) {
    m.st = 'mecha'; m.t = def.windup;
    slam(g, e.x, e.y, 30, def.windup, def.dmg);
    audio.sfx('ice');
  }
}

// ================================================================ REINA DE LOS CUERVOS
function tickReina(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: Mem) {
  announcePhase(g, e, m, 'La Reina de los Cuervos: ¡LA BANDADA ENTERA!', '#d8c8ff');
  const ph = phaseOf(e);
  const d = Math.sqrt(d2(e.x, e.y, p.x, p.y));
  if (m.st === 'apunta') {
    m.t = (m.t ?? 0) - dt; e.windup = m.t; e.ai = 'carga';
    if ((m.t ?? 0) <= 0) {
      const dx = (m.tx ?? p.x) - e.x, dy = (m.ty ?? p.y) - e.y, l = Math.hypot(dx, dy) || 1;
      m.vx = dx / l; m.vy = dy / l; m.st = 'picado'; m.t = 0.55; m.hit = false; e.ai = 'ataca';
      audio.sfx('roar');
    }
    return;
  }
  if (m.st === 'picado') {
    m.t = (m.t ?? 0) - dt;
    step(g, e, m.vx ?? 0, m.vy ?? 0, 260, dt);
    contact(g, e, p, 22, def.dmg * 1.2, m);
    if (Math.random() < 0.6) g.particles.push({ x: e.x, y: e.y - 8, vx: 0, vy: 0, t: 0.35, maxT: 0.35, color: '#4a4468', size: 2, grav: 0 });
    if ((m.t ?? 0) <= 0) {
      m.leaps = (m.leaps ?? 0) + 1;
      if (ph >= 2 && (m.leaps ?? 0) < 2) { m.st = 'apunta'; m.t = 0.35; m.tx = p.x; m.ty = p.y; }
      else { m.st = 'ronda'; m.leaps = 0; e.atkCd = def.atkCd; e.ai = 'recupera'; }
    }
    return;
  }
  if (m.st === 'grito') {
    m.t = (m.t ?? 0) - dt; e.ai = 'carga';
    if ((m.t ?? 0) <= 0) {
      summon(g, e, 'cuervo', ph >= 2 ? 3 : 2, ph >= 2 ? 4 : 3, '¡Graaa! ¡Hijos míos!');
      m.st = 'ronda'; e.atkCd = def.atkCd; audio.sfx('roar');
    }
    return;
  }
  if (m.st === 'plumas') {
    m.t = (m.t ?? 0) - dt; e.ai = 'carga';
    if ((m.t ?? 0) <= 0) {
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      const n = ph >= 2 ? 7 : 5;
      for (let i = 0; i < n; i++) shoot(g, e.x, e.y - 10, base + (i - (n - 1) / 2) * 0.22, 150, def.dmg * 0.7, 'pluma', 'sombra');
      m.st = 'ronda'; e.atkCd = def.atkCd * 0.8; audio.sfx('dodge');
    }
    return;
  }
  // ronda: vuela alrededor y elige ataque
  e.ai = 'persigue';
  m.ang = (m.ang ?? 0) + dt * (ph >= 2 ? 1.4 : 1);
  const tx = p.x + Math.cos(m.ang) * 70, ty = p.y + Math.sin(m.ang) * 46;
  step(g, e, tx - e.x, ty - e.y, def.speed, dt);
  if (e.atkCd <= 0) {
    m.act = ((m.act ?? 0) + 1) % 3;
    if (m.act === 0) { m.st = 'apunta'; m.t = def.windup; m.tx = p.x; m.ty = p.y; slam(g, p.x, p.y, 14, def.windup + 0.3, 0); }
    else if (m.act === 1) { m.st = 'plumas'; m.t = 0.5; }
    else { m.st = 'grito'; m.t = 0.7; }
  }
  void d;
}

// ================================================================ CIERVO DE CENIZA
function tickCiervo(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: Mem) {
  announcePhase(g, e, m, 'El Ciervo de Ceniza: la cornamenta ARDE', '#ffb060');
  const ph = phaseOf(e);
  if (m.st === 'cabeza') {           // preparando la embestida
    m.t = (m.t ?? 0) - dt; e.windup = m.t; e.ai = 'carga';
    e.dir = p.x > e.x ? 'right' : 'left';
    if ((m.t ?? 0) > 0.25) { const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1; m.vx = dx / l; m.vy = dy / l; }
    if ((m.t ?? 0) <= 0) { m.st = 'embiste'; m.t = 0.9; m.hit = false; e.ai = 'ataca'; audio.sfx('roar'); }
    return;
  }
  if (m.st === 'embiste') {
    m.t = (m.t ?? 0) - dt;
    const blocked = step(g, e, m.vx ?? 0, m.vy ?? 0, ph >= 2 ? 300 : 260, dt);
    contact(g, e, p, 24, def.dmg * 1.3, m);
    if (Math.random() < 0.7) g.particles.push({ x: e.x - (m.vx ?? 0) * 14, y: e.y + 2, vx: 0, vy: -10, t: 0.4, maxT: 0.4, color: '#ff8a3a', size: 2, grav: -10 });
    if (blocked) {
      // ¡contra el muro! se aturde: ventana de castigo
      g.shake = Math.max(g.shake, 7); audio.sfx('slam');
      g.floatAt(e.x, e.y - 40, '¡ATURDIDO!', '#ffe86a', 8);
      e.ai = 'aturdido'; e.aiT = 1.6; m.st = undefined; e.atkCd = def.atkCd;
      return;
    }
    if ((m.t ?? 0) <= 0) { m.st = undefined; e.ai = 'recupera'; e.aiT = 0.5; e.atkCd = def.atkCd; }
    return;
  }
  if (m.st === 'pisa') {
    m.t = (m.t ?? 0) - dt; e.ai = 'carga';
    if ((m.t ?? 0) <= 0) { m.st = undefined; e.atkCd = def.atkCd; g.shake = Math.max(g.shake, 5); audio.sfx('slam'); spawnVfx('impact', e.x, e.y, { flag: 1 }); }
    return;
  }
  if (e.ai === 'recupera') { e.aiT -= dt; if (e.aiT <= 0) e.ai = 'persigue'; return; }
  e.ai = 'persigue';
  const d = Math.sqrt(d2(e.x, e.y, p.x, p.y));
  if (d > 46) step(g, e, p.x - e.x, p.y - e.y, def.speed, dt);
  if (ph >= 2) {
    m.sumT = (m.sumT ?? 2.5) - dt;
    if ((m.sumT ?? 0) <= 0) { m.sumT = 3.2; for (let i = 0; i < 3; i++) slam(g, p.x + (i - 1) * 22, p.y + ((i * 7) % 3 - 1) * 10, 16, 0.9 + i * 0.25, def.dmg * 0.8); }
  }
  if (e.atkCd <= 0) {
    if (d < 48) { m.st = 'pisa'; m.t = 0.8; slam(g, e.x, e.y, 46, 0.8, def.dmg); }
    else { m.st = 'cabeza'; m.t = def.windup; }
  }
}

// ================================================================ REY CANGREJO
function tickRey(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: Mem) {
  announcePhase(g, e, m, 'El Rey Cangrejo: ¡LA MAREA ME OBEDECE!', '#ffb090');
  const ph = phaseOf(e);
  m.guard = Math.max(0, (m.guard ?? 0) - dt);
  const d = Math.sqrt(d2(e.x, e.y, p.x, p.y));
  if (m.st === 'pinzas') {
    m.t = (m.t ?? 0) - dt; e.ai = 'carga';
    if ((m.t ?? 0) <= 0) { m.st = undefined; e.ai = 'ataca'; e.aiT = 0.3; e.atkCd = def.atkCd; g.shake = Math.max(g.shake, 6); audio.sfx('slam'); }
    return;
  }
  if (m.st === 'burbujas') {
    m.t = (m.t ?? 0) - dt; e.ai = 'carga';
    if ((m.t ?? 0) <= 0) {
      const n = ph >= 2 ? 12 : 8;
      for (let i = 0; i < n; i++) shoot(g, e.x, e.y - 8, (i / n) * Math.PI * 2 + e.anim, 95, def.dmg * 0.7, 'burbuja', 'hielo', 2.6);
      m.st = undefined; e.atkCd = def.atkCd; audio.sfx('splash');
    }
    return;
  }
  if (e.ai === 'ataca') { e.aiT -= dt; if (e.aiT <= 0) { e.ai = 'recupera'; e.aiT = 0.6; } return; }
  if (e.ai === 'recupera') { e.aiT -= dt; if (e.aiT <= 0) { e.ai = 'persigue'; m.guard = 1.6; } return; }
  e.ai = 'persigue';
  if (d > 40) step(g, e, p.x - e.x, p.y - e.y, def.speed * (m.guard ? 0.5 : 1), dt);
  e.dir = p.x > e.x ? 'right' : 'left';
  if (ph >= 2) {
    m.sumT = (m.sumT ?? 1) - dt;
    if ((m.sumT ?? 0) <= 0) { m.sumT = 14; summon(g, e, 'cangrejo', 2, 3, '¡A mí, mi guardia!'); }
  }
  if (e.atkCd <= 0) {
    m.act = ((m.act ?? 0) + 1) % 2;
    if (m.act === 0 || d < 50) {
      m.st = 'pinzas'; m.t = def.windup;
      slam(g, e.x - 30, e.y, 22, def.windup, def.dmg); slam(g, e.x + 30, e.y, 22, def.windup, def.dmg);
      if (ph >= 2) slam(g, p.x, p.y, 18, def.windup + 0.2, def.dmg * 0.8);
    } else { m.st = 'burbujas'; m.t = 0.6; m.guard = 0.6; }
  }
}

// ================================================================ LA VIUDA DE NIEBLA
function tickViuda(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: Mem) {
  announcePhase(g, e, m, 'La Viuda de Niebla: «¿Recuerdas cómo te llamas?»', '#c8d8ff');
  const ph = phaseOf(e);
  const d = Math.sqrt(d2(e.x, e.y, p.x, p.y));
  e.anim += dt * 0.6;
  if (m.st === 'bruma') {
    m.t = (m.t ?? 0) - dt; e.invulT = 0.2;
    if ((m.t ?? 0) <= 0) {
      // reaparece a un lado del Portador
      const a = Math.random() * Math.PI * 2;
      const x = p.x + Math.cos(a) * 70, y = p.y + Math.sin(a) * 50;
      if (!g.tileSolidAt(x, y)) { e.x = x; e.y = y; }
      e.invulT = 0; m.st = undefined; e.atkCd = 0.5;
      g.burst(e.x, e.y - 10, '#c8d0e0', 18, 70); audio.sfx('wraith');
    }
    return;
  }
  if (m.st === 'orbes') {
    m.t = (m.t ?? 0) - dt; e.ai = 'carga';
    if ((m.t ?? 0) <= 0) {
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = -1; i <= 1; i++) shoot(g, e.x, e.y - 14, base + i * 0.35, 85, def.dmg * 0.8, 'velo', 'sombra', 3.2);
      m.st = undefined; e.atkCd = def.atkCd; audio.sfx('wraith');
    }
    return;
  }
  if (m.st === 'grito') {
    m.t = (m.t ?? 0) - dt; e.ai = 'carga';
    if ((m.t ?? 0) <= 0) { m.st = undefined; e.atkCd = def.atkCd; audio.sfx('roar'); g.shake = Math.max(g.shake, 5); }
    return;
  }
  // las orbes de velo persiguen (giran hacia el Portador)
  for (const pr of g.projectiles) {
    if (pr.from !== 'enemy' || pr.sprite !== 'velo') continue;
    const a = Math.atan2(p.y - 4 - pr.y, p.x - pr.x);
    const sp = Math.hypot(pr.vx, pr.vy);
    pr.vx += (Math.cos(a) * sp - pr.vx) * dt * 1.6; pr.vy += (Math.sin(a) * sp - pr.vy) * dt * 1.6;
  }
  e.ai = 'persigue';
  if (d > 90) step(g, e, p.x - e.x, p.y - e.y, def.speed, dt);
  else if (d < 50) step(g, e, e.x - p.x, e.y - p.y, def.speed * 0.8, dt);
  if (e.atkCd <= 0) {
    m.act = ((m.act ?? 0) + 1) % (ph >= 2 ? 4 : 3);
    if (m.act === 0) { m.st = 'orbes'; m.t = 0.6; }
    else if (m.act === 1) { m.st = 'grito'; m.t = def.windup; slam(g, e.x, e.y, 56, def.windup, def.dmg); }
    else if (m.act === 2) { summon(g, e, 'fatuo', 2, ph >= 2 ? 4 : 3, '«Ardan, nombres sin dueño…»'); e.atkCd = def.atkCd; }
    else { m.st = 'bruma'; m.t = 1.1; g.burst(e.x, e.y - 10, '#c8d0e0', 18, 70); }
  }
}

// ================================================================ WENDIGO DE ESCARCHA
function tickWendigo(g: Game, e: Enemy, dt: number, def: EnemyDef, p: Player, m: Mem) {
  announcePhase(g, e, m, 'El Wendigo de Escarcha imita tu voz: «…¿dónde estás?»', '#b8e8ff');
  const ph = phaseOf(e);
  const d = Math.sqrt(d2(e.x, e.y, p.x, p.y));
  if (m.st === 'salta') {
    m.t = (m.t ?? 0) - dt; e.ai = 'ataca'; e.invulT = 0.1;
    const k = 1 - Math.max(0, m.t ?? 0) / 0.8;
    e.x = (m.vx ?? e.x) + ((m.tx ?? e.x) - (m.vx ?? e.x)) * k;
    e.y = (m.vy ?? e.y) + ((m.ty ?? e.y) - (m.vy ?? e.y)) * k;
    if ((m.t ?? 0) <= 0) {
      e.invulT = 0; g.shake = Math.max(g.shake, 8); audio.sfx('slam');
      spawnVfx('frost', e.x, e.y, { size: 1 });
      m.leaps = (m.leaps ?? 0) + 1;
      if (ph >= 2 && (m.leaps ?? 0) < 2) startLeap(g, e, p, m, def);
      else { m.st = undefined; m.leaps = 0; e.ai = 'recupera'; e.aiT = 0.7; e.atkCd = def.atkCd; }
    }
    return;
  }
  if (m.st === 'zarpa') {
    m.t = (m.t ?? 0) - dt; e.ai = 'carga'; e.windup = m.t ?? 0;
    if ((m.t ?? 0) <= 0) {
      m.leaps = (m.leaps ?? 0) + 1; m.hit = false;
      step(g, e, p.x - e.x, p.y - e.y, 600, 0.05);
      contact(g, e, p, def.atkR + 8, def.dmg, m);
      spawnVfx('claw', e.x + (p.x > e.x ? 12 : -12), e.y - 10, { ang: Math.atan2(p.y - e.y, p.x - e.x) });
      audio.sfx('slash');
      if ((m.leaps ?? 0) < 2) { m.t = 0.28; }
      else { m.st = undefined; m.leaps = 0; e.ai = 'recupera'; e.aiT = 0.5; e.atkCd = def.atkCd; }
    }
    return;
  }
  if (m.st === 'aullido') {
    m.t = (m.t ?? 0) - dt; e.ai = 'carga';
    if ((m.t ?? 0) <= 0) {
      for (let i = 0; i < 10; i++) shoot(g, e.x, e.y - 12, (i / 10) * Math.PI * 2, 120, def.dmg * 0.7, 'esquirla', 'hielo', 2);
      m.st = undefined; e.atkCd = def.atkCd; audio.sfx('roar');
    }
    return;
  }
  if (e.ai === 'recupera') { e.aiT -= dt; if (e.aiT <= 0) e.ai = 'persigue'; return; }
  e.ai = 'persigue';
  if (d > def.atkR) step(g, e, p.x - e.x, p.y - e.y, def.speed * (ph >= 2 ? 1.2 : 1), dt);
  if (e.atkCd <= 0) {
    if (d < def.atkR + 14) { m.st = 'zarpa'; m.t = def.windup; m.leaps = 0; }
    else {
      m.act = ((m.act ?? 0) + 1) % 2;
      if (m.act === 0) startLeap(g, e, p, m, def);
      else { m.st = 'aullido'; m.t = 0.8; }
    }
  }
}
function startLeap(g: Game, e: Enemy, p: Player, m: Mem, def: EnemyDef): void {
  m.st = 'salta'; m.t = 0.8; m.vx = e.x; m.vy = e.y; m.tx = p.x; m.ty = p.y;
  slam(g, p.x, p.y, 30, 0.8, def.dmg * 1.2);
  audio.sfx('roar');
}

// ---------------------------------------------------------------- hooks del motor
/** Multiplicador de daño recibido (guardia de pinzas de frente). */
export function r18DamageMult(e: Enemy, fromX: number): number {
  if (e.etype !== 'cangrejo' && e.etype !== 'rey_cangrejo') return 1;
  const m = MEM.get(e);
  if (!m || !(m.guard && m.guard > 0)) return 1;
  const front = e.dir === 'right' ? fromX > e.x : fromX < e.x;
  return front ? 0.25 : 1;
}

/** Fotograma según estado (render.ts). */
export function r18Frame(e: Enemy): number {
  const m = MEM.get(e);
  const fl = Math.floor(e.anim * 6) % 2;
  switch (e.etype) {
    case 'cuervo': return m?.st === 'picado' || m?.st === 'apunta' ? 2 : fl;
    case 'arana': return e.ai === 'carga' ? 2 : e.moving ? fl : 3;
    case 'cangrejo': return e.ai === 'ataca' ? 3 : (m?.guard ?? 0) > 0 || e.ai === 'carga' ? 2 : fl;
    case 'fatuo': return m?.st === 'mecha' ? 3 : Math.floor(e.anim * 4) % 3;
    case 'reina_cuervo': return e.ai === 'aturdido' ? 4 : m?.st === 'picado' || m?.st === 'apunta' ? 3 : m?.st === 'grito' || m?.st === 'plumas' ? 2 : fl;
    case 'ciervo': return e.ai === 'aturdido' ? 5 : m?.st === 'pisa' ? 4 : m?.st === 'embiste' ? 3 : m?.st === 'cabeza' ? 2 : e.moving ? fl : 0;
    case 'rey_cangrejo': return e.ai === 'aturdido' ? 4 : m?.st === 'pinzas' || e.ai === 'ataca' ? 3 : (m?.guard ?? 0) > 0 ? 2 : fl;
    case 'viuda': return e.ai === 'aturdido' ? 4 : m?.st === 'grito' ? 3 : m?.st === 'orbes' ? 2 : fl;
    case 'wendigo': return e.ai === 'aturdido' ? 5 : m?.st === 'salta' ? 3 : m?.st === 'aullido' ? 4 : m?.st === 'zarpa' ? 2 : e.moving ? fl : 0;
    default: return 0;
  }
}

/** ¿La viuda está deshecha en bruma? (render: casi transparente) */
export function r18Ghosted(e: Enemy): boolean {
  return e.etype === 'viuda' && MEM.get(e)?.st === 'bruma';
}
