// ============================================================
// ECOS DE AELTHAR — Update por frame
// Jugador, IA de enemigos, jefe, proyectiles, compañera, mundo
// ============================================================

import type { Game } from './engine';
import { TILE } from './engine';
import type { Enemy, Dir } from './types';
import { ENEMY_DEFS } from './data';
import { audio } from './audio';
import { tileAt } from './maps';
import { SOLID_CHARS } from './sprites';

const DIRS: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function updateGame(g: Game, dt: number) {
  // cosmética siempre
  if (g.state === 'dialogue' && g.dlgNode) g.dlgCharT += dt * 45;
  g.mapTitleT = Math.max(0, g.mapTitleT - dt);
  g.epochFx = Math.max(0, g.epochFx - dt);
  g.shake = Math.max(0, g.shake - dt * 22);
  for (const t of g.toasts) t.t -= dt;
  g.toasts = g.toasts.filter(t => t.t > 0);
  for (const f of g.floats) { f.t -= dt; f.y += f.vy * dt; }
  g.floats = g.floats.filter(f => f.t > 0);
  for (const p of g.particles) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; }
  g.particles = g.particles.filter(p => p.t > 0);
  if (g.state !== 'play') { g.updateCamera(); return; }

  const p = g.player;
  if (!p) return;
  p.playTime += dt;
  g.dayT = (g.dayT + dt / 240) % 1;
  if (p.buffT) { p.buffT -= dt; if (p.buffT <= 0) p.buffT = undefined; }

  // ---------------- fades y transición de mapa ----------------
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
  if (p.iframes > 0) p.iframes -= dt;
  if (p.parryT > 0) p.parryT -= dt;
  if (p.parryFx > 0) p.parryFx -= dt;
  if (p.lastHitT > 0) p.lastHitT -= dt;
  for (let i = 0; i < p.cds.length; i++) if (p.cds[i] > 0) p.cds[i] -= dt;

  // carga de ataque
  if (p.charging) {
    p.chargeT += dt;
    if (p.chargeT > 0.35 && Math.random() < 0.4) {
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
    if (Math.random() < 0.5) g.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0.25, maxT: 0.25, color: '#d8dce4', size: 2, grav: 0 });
  } else if (p.attackT > 0) {
    p.attackT -= dt;
    p.moving = false;
    p.anim += dt;
  } else {
    // movimiento normal
    const spd = 74;
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

  // esquiva
  if (k.has(' ') && p.rollT <= 0 && p.attackT <= 0 && p.sta >= 20) {
    p.rollT = 0.3;
    p.iframes = 0.34;
    p.sta -= 20;
    let rd: Dir = p.dir;
    if (mx !== 0 || my !== 0) rd = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
    (p as unknown as { rollDir?: Dir }).rollDir = rd;
    audio.sfx('dodge');
  }

  // impacto del ataque (instantáneo en la liberación, ver releaseCharge)

  // ---------------- recoger oro perdido ----------------
  for (let i = g.deadGolds.length - 1; i >= 0; i--) {
    const dgl = g.deadGolds[i];
    if (dgl.map !== g.mapId) continue;
    if (dist(p.x, p.y, dgl.x, dgl.y) < 14) {
      p.gold += dgl.amount;
      g.deadGolds.splice(i, 1);
      audio.sfx('coin');
      g.floatAt(dgl.x, dgl.y - 10, `+${dgl.amount}`, '#f0c84a');
      g.toast(`Recuperas tu eco de oro (+${dgl.amount})`, '#f0c84a');
    }
  }

  // ---------------- salidas de mapa ----------------
  if (g.fadeDir === 0) {
    const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    for (const ex of g.map.exits) {
      if (ex.needPast && g.epoch !== 'pasado') continue;
      if (ptx >= ex.x && ptx < ex.x + ex.w && pty >= ex.y && pty < ex.y + ex.h) {
        g.fadeTo(ex.to, ex.tx, ex.ty);
        audio.sfx('echo');
        break;
      }
    }
  }

  // ---------------- compañera ----------------
  if (g.companion) updateCompanion(g, dt);

  // ---------------- enemigos ----------------
  let anyAggro = false;
  for (const e of g.enemies) {
    if (e.dead) continue;
    updateEnemy(g, e, dt);
    if (e.aggro && e.ai !== 'muerto') anyAggro = true;
  }
  g.enemies = g.enemies.filter(e => !e.dead);
  if (g.bossRef && g.bossRef.dead) g.bossRef = null;
  audio.setCombat(anyAggro);

  // ---------------- jefe: activación ----------------
  if (g.mapId === 'cripta' && !g.flags.guardianDefeated && !g.bossActive) {
    const boss = g.enemies.find(e => e.etype === 'guardian');
    if (boss) {
      g.bossRef = boss;
      if (dist(p.x, p.y, boss.x, boss.y) < 190) {
        g.bossActive = true;
        audio.playTrack('boss');
        g.toast('El Guardián Hueco despierta: ROMPE SU BARRA DE QUIEBRE', '#7ee8ff');
        audio.sfx('roar');
      }
    }
  }

  // ---------------- proyectiles ----------------
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const pr = g.projectiles[i];
    pr.t -= dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    const tx = Math.floor(pr.x / TILE), ty = Math.floor(pr.y / TILE);
    const ch = tileAt(g.map, g.rows, tx, ty, g.epoch);
    let dead = pr.t <= 0 || SOLID_CHARS.has(ch);
    if (pr.from === 'player') {
      if (Math.random() < 0.5) g.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.22, maxT: 0.22, color: pr.element === 'fuego' ? '#ff9040' : pr.element === 'hielo' ? '#a0e8ff' : '#ffe86a', size: 1.5, grav: 0 });
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (dist(pr.x, pr.y, e.x, e.y - 4) < pr.radius + e.w / 2 + 2) {
          g.damageEnemy(e, pr.dmg, pr.element, 30, Math.sign(pr.vx), Math.sign(pr.vy));
          dead = true;
          break;
        }
      }
    } else {
      if (dist(pr.x, pr.y, p.x, p.y - 4) < pr.radius + 7) {
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
      if (Math.random() < 0.4) g.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.25, maxT: 0.25, color: '#b48fff', size: 1.5, grav: 0 });
    }
    if (dead) {
      g.burst(pr.x, pr.y, pr.element === 'fuego' ? '#ff9040' : pr.element === 'hielo' ? '#a0e8ff' : '#e8d0ff', 6, 40);
      g.projectiles.splice(i, 1);
    }
  }

  // ---------------- ondas expansivas ----------------
  for (let i = g.waves.length - 1; i >= 0; i--) {
    const w = g.waves[i];
    w.r += w.speed * dt;
    if (w.dmg > 0 && !w.hit) {
      if (Math.abs(dist(w.x, w.y, p.x, p.y) - w.r) < 8) {
        g.damagePlayer(w.dmg, w.x, w.y);
        w.hit = true;
      }
    }
    if (w.r >= w.maxR) g.waves.splice(i, 1);
  }

  // ---------------- telegrafías ----------------
  for (let i = g.telegraphs.length - 1; i >= 0; i--) {
    const t = g.telegraphs[i];
    t.t -= dt;
    if (t.t <= 0) {
      audio.sfx('slam');
      g.shake = 6;
      g.burst(t.x, t.y, '#c8b8a0', 18, 90);
      if (dist(p.x, p.y, t.x, t.y) < t.r && p.rollT <= 0 && p.iframes <= 0) {
        g.damagePlayer(t.dmg, t.x, t.y);
      }
      g.telegraphs.splice(i, 1);
    }
  }

  g.updateCamera();
}

// ---------------- Compañera ----------------

function updateCompanion(g: Game, dt: number) {
  const c = g.companion!;
  const p = g.player!;
  if (c.downT > 0) {
    c.downT -= dt;
    if (c.downT <= 0) { c.hp = Math.floor(c.maxHp * 0.5); g.toast('Ilwen se incorpora de nuevo', '#8ef0b0'); }
    return;
  }
  c.atkCd -= dt;
  const d = dist(c.x, c.y, p.x, p.y);
  // mantener posición de escolta
  if (d > 30) {
    const spd = Math.min(92, 40 + (d - 30) * 2);
    const dx = (p.x - c.x) / d, dy = (p.y - c.y) / d;
    g.moveEntity(c, dx * spd * dt, dy * spd * dt);
    c.moving = true; c.anim += dt;
    c.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
  } else { c.moving = false; c.anim += dt * 0.4; }
  // disparo a enemigos aggro cercanos
  if (c.atkCd <= 0) {
    let best: Enemy | null = null, bd = 150;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dd = dist(c.x, c.y, e.x, e.y);
      if (dd < bd) { bd = dd; best = e; }
    }
    if (best) {
      c.atkCd = 1.5;
      const dx = best.x - c.x, dy = best.y - 4 - (c.y - 6);
      const l = Math.max(1, Math.hypot(dx, dy));
      g.projectiles.push({
        x: c.x, y: c.y - 6, vx: (dx / l) * 190, vy: (dy / l) * 190, t: 1.2,
        dmg: 7 + p.level * 1.5, element: 'ninguno', from: 'companion', sprite: 'p_arrow', radius: 3, pierce: 0,
      });
      audio.sfx('companionShot');
    }
  }
  if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + 2 * dt);
  if (c.hp <= 0) { c.downT = 8; g.toast('Ilwen cae... se repondrá en unos segundos', '#e8a0a0'); }
}

// ---------------- Enemigos ----------------

function speedMult(e: Enemy): number {
  let m = 1;
  if (e.statuses.some(s => s.kind === 'congelado')) m *= 0.5;
  return m;
}

function updateEnemy(g: Game, e: Enemy, dt: number) {
  const p = g.player!;
  const def = ENEMY_DEFS[e.etype];
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.spawnGuard && e.spawnGuard > 0) { e.spawnGuard -= dt; return; }

  // estados
  for (let i = e.statuses.length - 1; i >= 0; i--) {
    const s = e.statuses[i];
    s.t -= dt;
    if (s.kind === 'quemado') {
      e.hp -= s.power * dt;
      if (Math.random() < 0.15) g.particles.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 6, vx: 0, vy: -24, t: 0.3, maxT: 0.3, color: '#ff9040', size: 1.5, grav: 0 });
      if (e.hp <= 0) { g.killEnemy(e); return; }
    }
    if (s.t <= 0) e.statuses.splice(i, 1);
  }
  if (e.hp < e.maxHp) e.aggro = true;

  const d = dist(e.x, e.y, p.x, p.y);
  const nightMult = isNight(g) ? 1.3 : 1;
  const aggroR = def.aggroR * nightMult * (e.etype === 'guardian' ? (g.bossActive ? 99 : 1) : 1);
  if (!e.aggro && d < aggroR && g.state === 'play') {
    e.aggro = true;
    if (e.etype === 'guardian') { /* activación gestionada fuera */ }
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
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 60;
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
      if (d > aggroR * 2.4) { e.aggro = false; e.ai = 'patrulla'; break; }
      const dx = (p.x - e.x) / (d || 1), dy = (p.y - e.y) / (d || 1);
      const spd = def.speed * speedMult(e);
      if (d > def.atkR * 0.8) {
        g.moveEntity(e, dx * spd * dt, dy * spd * dt);
        e.moving = true;
        e.dir = dx > 0 ? 'right' : 'left';
      } else e.moving = false;
      if (d <= def.atkR && e.atkCd <= 0) {
        e.ai = 'carga';
        e.windup = def.windup * (e.etype === 'guardian' && e.phase >= 3 ? 0.7 : 1);
        e.telegraphKind = undefined;
      }
      // jefe: acciones especiales
      if (e.etype === 'guardian') guardianBrain(g, e, dt, d);
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
          if (d < 46) g.damagePlayer(def.dmg * e.phase, e.x, e.y);
          g.burst(e.x, e.y, '#8a84a8', 14, 80);
          g.shake = 5;
        } else {
          // estampida del lobo / mandoble del esqueleto
          e.ai = 'ataca';
          e.aiT = 0.22;
          const dx = (p.x - e.x) / (d || 1), dy = (p.y - e.y) / (d || 1);
          g.moveEntity(e, dx * 14, dy * 14);
          if (d < def.atkR + 10) {
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
      e.moving = false;
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
    const dx = (e.x - p.x) / (d || 1), dy = (e.y - p.y) / (d || 1);
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
    g.toast(`El Guardián cambia de fase (${e.phase}/3)`, '#7ee8ff');
    g.shake = 6;
    if (e.phase === 2) {
      // invoca sombras
      for (let i = 0; i < 2; i++) {
        const s = g.makeEnemy('sombra', e.x + (i === 0 ? -24 : 24), e.y + 12, 0, 'boss');
        s.aggro = true;
        g.enemies.push(s);
      }
      g.toast('El Guardián llama a sombras sin rostro', '#b48fff');
    }
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
  void dt; void p;
}

export function isNight(g: Game): boolean {
  return g.dayT > 0.7 || g.dayT < 0.08;
}
