// ============================================================
// ECOS DE AELTHAR — ACTO II · IA de la EXPANSIÓN
// (AGENTE 7-b · enemigos + sprites · pulido 9-a: jefes profundos)
//
// Cerebros completos para los 5 enemigos nuevos:
//   · neumo    — esquiva-tirador: mantiene banda 90-130 px y
//                escupe un 'orb' telegrafiado. Huye a <40 px.
//                AGÓNICO (<35% hp): escupe 3 orbes en abanico de 15°.
//   · espectro — tanque fantasma: se DESVANECE (invulT) al recibir
//                un golpe y arremete con dash ×3.
//   · arpi     — asaltante aéreo: orbita a ~75 px y PICADO cada 2.5 s.
//                EN PANDILLA (9-a): si otra arpi picó hace <0.4 s y
//                está en rango, se lanza al instante (lastDiveT
//                compartido a nivel de módulo → bandada sincronizada).
//   · sirena   — JEFA 3 fases: salvas de marea, coro de neumos,
//                teletransporte acuático y Canto del Abismo.
//                9-a — F2: MAREA BAJA (doble onda cada 9 s) + strafe
//                orbital; F3: Canto telegrafiado con gran anillo rojo
//                (r=70·1 s) + invoca neumos (cap 3) cada 15 s; mientras
//                está aturdida suelta notas liberadas; retrocede si el
//                Portador la pega (<50 px); al morir, espiral de 12 notas.
//   · golem    — JEFE 2 fases: slam telegrafiado, lanza de cristales,
//                ventisca y embestida que rebota en los muros.
//                9-a — escarcha cayendo tras cada slam; la ventisca
//                predice la posición futura del Portador (velocidad·0.5 s);
//                la embestida deja surco de hielo; CORAZÓN DE HIELO
//                (cada 11 s: núcleo brilla + 6 shards radiales); al morir,
//                onda de nieve de 20 copos.
//
// INTEGRACIÓN (para el agente principal):
//   Llamar expansionTick(g, e, dt, def) DENTRO de stepEnemy
//   (update.ts, updateEnemy) para e.etype ∈ {neumo, espectro, arpi,
//   sirena, golem}. Lugar recomendado: justo antes del
//   `switch (e.ai)`, DESPUÉS del bloque común (hitFlash, estados,
//   stepKnockback, marca, aggro, atkCd, aturdido, anim). Si devuelve
//   true, SALTAR la IA genérica (no ejecutar el switch ni la huida
//   final); si devuelve false, continuar con el flujo normal.
//
//   El tick es ROBUSTO a la colocación: detecta (vía WeakMap) si el
//   bloque común ya corrió este frame y, si no, replica las partes
//   que necesita (hitFlash, knockback, estados, aggro, atkCd, anim,
//   aturdido, spawnGuard). ÚNICO requisito para el REMATE del
//   jugador: el bloque de bookkeeping de aturdido de update.ts
//   (WeakMaps wasAturdido/finisherUsed) debe correr como siempre.
//
//   Daño al Portador: SOLO vía proyectiles (from:'enemy'), ondas y
//   g.damagePlayer() — el motor gestiona i-frames, parada y knockback.
//   invulT (espectro/sirena) lo decae este módulo; que damageEnemy
//   lo respete es tarea del integrador (contrato types.ts).
//   bossRef/bossActive/música de jefe: los cablea el integrador.
// ============================================================

import type { Game } from './engine';
import type { Enemy, Player, EnemyType, Projectile } from './types';
import type { EnemyDef } from './data';
import { audio } from './audio';
import { addShake, addFlash, requestSlowmo, stepKnockback } from './fxcore';
// ciclo update→enemies_expansion→update: seguro (uso solo dentro de
// funciones, mismo patrón ya verificado del ciclo fx↔update por isNight).
// getPortadorVel devuelve la velocidad real del Portador medida por update.ts.
// isNight (14-a): la activación nocturna de Vult usa el MISMO criterio que
// el motor (noche = dayT>0.7 || <0.08) para no duplicar la definición.
import { getPortadorVel, isNight } from './update';
// MAPS (14-a): SOLO LECTURA-MUTACIÓN de las tablas de spawns en carga para
// activar los 2 enemigos nuevos de mapa SIN tocar maps*.ts (congelados esta
// ronda): push de SpawnDef sobre los arrays ya existentes de MAPS.
import { MAPS } from './maps';

// ── 14-a: ids de los 2 jefes-enemigos nuevos (los del Acto II quedan como
// literales 'sirena'/'golem' por consistencia con el fuente original).
export const T_VULT = 'vult' as const;
export const T_CORO = 'coro' as const;

// ── 14-a: SPAWNS de los 2 enemigos nuevos de mapa (Eco Desgarrado y Sátiro
// de la Niebla). Mutación de las tablas ya existentes SOLO UNA VEZ por carga
// del módulo (guarda anti-doble-push por HMR/recarga de módulo). El hp/dmg
// de ENEMY_DEFS_14A ya pasa por makeEnemy → recibe el balanceador (12-c).
let spawns14aPuestos = false;
function puestarSpawns14a(): void {
  if (spawns14aPuestos) return;
  spawns14aPuestos = true;
  // Eco Desgarrado: ecos partidos — donde hubo canto roto (bosque y cripta)
  if (MAPS.bosque) MAPS.bosque.spawns.push({ type: 'ecodesg', x: 8, y: 12, patrol: 3, zone: 'bosque' });
  if (MAPS.cripta) MAPS.cripta.spawns.push({ type: 'ecodesg', x: 31, y: 14, patrol: 2, zone: 'cripta' });
  // Sátiro de la Niebla: músico cabrío — la niebla del bosque y el paso alto
  if (MAPS.bosque) MAPS.bosque.spawns.push({ type: 'satiro', x: 47, y: 22, patrol: 4, zone: 'bosque' });
  if (MAPS.cumbres) MAPS.cumbres.spawns.push({ type: 'satiro', x: 18, y: 18, patrol: 4, zone: 'cumbres' });
}
puestarSpawns14a();

// ---------------- utilidades ----------------

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function isNightG(g: Game): boolean {
  return g.dayT > 0.7 || g.dayT < 0.08;
}

/** Mueve hacia (dx,dy) normalizado con colisión de tiles y fija dir/moving. */
function moveDir(g: Game, e: Enemy, dx: number, dy: number, spd: number, dt: number): void {
  const l = Math.hypot(dx, dy);
  if (l < 1e-4) { e.moving = false; return; }
  g.moveEntity(e, (dx / l) * spd * dt, (dy / l) * spd * dt);
  e.moving = true;
  if (Math.abs(dx) > 0.01) e.dir = dx > 0 ? 'right' : 'left';
}

// ---------------- memoria por enemigo (WeakMap: no persiste) ----------------

interface ExpMem {
  // señales de colocación (¿corrió ya el bloque común del motor?)
  lastAnim?: number;
  lastAtkCd?: number;
  prevHitFlash?: number;
  freshHit?: boolean;
  // dashes (arremetida/picado/embestida)
  dashDx?: number;
  dashDy?: number;
  dashHit?: boolean;
  // espectro
  pauseT?: number;      // se detiene a susurrar
  // arpi
  orbitDir?: number;    // sentido de la órbita
  // sirena
  pendingSalva?: number; // notas de la salva al terminar el windup (0 = Canto)
  tpT?: number;          // acumulador del teletransporte acuático (fase 2)
  mareaT?: number;       // acumulador de la MAREA BAJA (fase 2, 9-a)
  // golem
  act?: 'slam' | 'lanza' | 'embiste';
  actIdx?: number;       // alternancia de acciones
  slamPend?: number;     // tiempo restante del telegraph del slam → onda visual
  ventT?: number;        // acumulador de la ventisca (fase 2)
  frostT?: number;       // escarcha restante tras el slam (9-a)
  corazonT?: number;     // acumulador del CORAZÓN DE HIELO (fase 2, 9-a)
  // ── 14-a (jefes-enemigos) ──
  // vult
  vAct?: 'rafaga' | 'tajo' | 'embiste' | 'salto'; // acción elegida del ciclo
  vIdx?: number;         // alternancia del pool de acciones
  acechoCd?: number;     // cooldown del MODO ACECHO (fase 3, cada 8 s)
  saltoX?: number;       // destino del salto (centro del telegraph)
  saltoY?: number;
  // coro
  maskRoto?: boolean;    // la máscara ya cayó en ESTE periodo de quebrado
  maskIdx?: number;      // máscara activa: 1 = EL PULSO · 2 = EL VERA · 3 = EL SILENCIO
  coroRot?: number;      // 0 = cruz cardinal · 1 = cruz diagonal (F2)
  coroT?: number;        // acumulador de la lluvia de notas (F3)
  lluviaSfx?: number;    // contador para no spamear sfx de la lluvia
  // sirena — MAREA DOBLE (fase final, 14-a)
  mareaDobleT?: number;  // acumulador (cada 7 s en fase 3)
  mareaPend?: number;    // crestas en cola (2 = doble)
  mareaGap?: number;     // separación entre las 2 crestas (0.5 s)
  // gólem — METEORITO DE ESCARCHA (fase final, 14-a)
  meteoT?: number;       // acumulador (cada 9 s en fase 2)
  meteoPend?: number;    // tiempo restante de caída (sincronizado con el telegraph)
  meteoX?: number;       // centro del impacto (para el splash)
  meteoY?: number;
  // ecodesg
  blinkSide?: number;    // flanco alternante del parpadeo
}

// ARPÍAS EN PANDILLA (9-a): instante (g.globalT) del último picado iniciado
// por CUALQUIER arpi. Si otra arpi ve que la bandada acaba de lanzarse
// (<0.4 s) y está en rango, pica al instante sin esperar su ciclo propio.
let lastDiveT = -99;

const MEM = new WeakMap<Enemy, ExpMem>();

function mem(e: Enemy): ExpMem {
  let m = MEM.get(e);
  if (!m) { m = {}; MEM.set(e, m); }
  return m;
}

// ---------------- bloque común (réplica robusta del prep de update.ts) ----------------

/**
 * Devuelve TRUE si el frame quedó consumido (aturdido/spawnGuard).
 * Efectos: freshHit, decaimiento de hitFlash/invulT/atkCd, aggro, anim.
 * Todo es idempotente con el bloque común del motor gracias a la
 * detección por anim/atkCd (ver ExpMem.lastAnim/lastAtkCd).
 */
function commonTick(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  const p = g.player;

  // ¿el motor ya pasó por updateEnemy este frame? (anim solo cambia ahí)
  const motorRan = m.lastAnim !== undefined && e.anim !== m.lastAnim;
  m.lastAnim = e.anim;

  // spawnGuard (invocaciones: sin aggro inicial)
  if (e.spawnGuard && e.spawnGuard > 0) {
    if (!motorRan) e.spawnGuard = Math.max(0, e.spawnGuard - dt);
    if (e.spawnGuard > 0) return true;
  }

  // golpe nuevo: hitFlash SUBIÓ desde el frame pasado (damageEnemy pone 0.12)
  const prev = m.prevHitFlash ?? 0;
  m.freshHit = e.hitFlash > prev + 5e-4 && e.hitFlash > 0.06;
  // decaimiento de hitFlash si el motor aún no lo hizo (colocación temprana)
  if (!motorRan && e.hitFlash > 0 && Math.abs(e.hitFlash - prev) < 1e-9) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
  }
  m.prevHitFlash = e.hitFlash;

  // knockback (contrato fxcore) si el motor no lo aplicó
  if (!motorRan) stepKnockback(g, e, dt);

  // estados (quemado/congelado) + marca — réplica del bloque común
  if (!motorRan) {
    for (let i = e.statuses.length - 1; i >= 0; i--) {
      const s = e.statuses[i];
      s.t -= dt;
      if (s.kind === 'quemado') {
        e.hp -= s.power * dt;
        if (Math.random() < 0.15) {
          g.particles.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 6, vx: 0, vy: -24, t: 0.3, maxT: 0.3, color: '#ff9040', size: 1.5, grav: 0 });
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

  // invulT: campo nuevo de la expansión — SIEMPRE lo decaemos aquí
  if (e.invulT && e.invulT > 0) e.invulT = Math.max(0, e.invulT - dt);

  // atkCd: decae solo si el motor no lo hizo ya este frame
  if (m.lastAtkCd === undefined || Math.abs(e.atkCd - m.lastAtkCd) < 1e-9) e.atkCd -= dt;

  // anim (cosmético) si el motor no lo hizo
  if (!motorRan) e.anim += dt * (e.ai === 'persigue' ? 1.4 : 0.6);

  // timer auxiliar de la expansión
  e.subT = (e.subT ?? 0) + dt;

  // aggro (idempotente: si el motor ya lo fijó, no-op)
  if (p && !e.aggro && g.state === 'play') {
    const nightMult = isNightG(g) ? 1.3 : 1;
    if (dist(e.x, e.y, p.x, p.y) < def.aggroR * nightMult) {
      e.aggro = true;
      // 14-a: los jefes nuevos NO pitan (sus cerebros disparan banner+sfx propio,
      // misma técnica que sirena/golem)
      if (e.etype !== 'sirena' && e.etype !== 'golem' && e.etype !== T_VULT && e.etype !== T_CORO) audio.sfx('blip');
      // el banner de jefes lo disparan sus cerebros (flags sirenaIntro/golemIntro/vultIntro/coroIntro)
    }
  }

  // QUEBRADO/ATURDIDO — mismo patrón que update.ts (líneas 517-522):
  // cuenta atrás y, al salir, recupera la barra de quiebre completa
  // (clave para el REMATE del Portador). El motor fija aiT=4 genérico
  // en damageEnemy al quebrar; los jefes lo ajustan a su duración.
  if (e.ai === 'aturdido') {
    // 14-a: Vult se sacude más rápido (2.0 s); El Coro Roto tiene su
    // propia mecánica: quebrar = CAE LA MÁSCARA (ver abajo, 1.4 s).
    const stunT = e.etype === 'sirena' ? 2.6 : e.etype === 'golem' ? 2.8 : e.etype === T_VULT ? 2.0 : 1.6;
    if (e.aiT > stunT) e.aiT = stunT;
    // 14-a EL CORO ROTO: al quebrar la barra de quiebre cae la máscara
    // actual y entra la siguiente con patrón nuevo (UNA vez por periodo).
    if (e.etype === T_CORO && !m.maskRoto) {
      m.maskRoto = true;
      e.aiT = 1.4; // el trastabilleo de la caída es más corto que un quebrado
      caeMascara(g, e, m, true);
    }
    e.aiT -= dt;
    e.moving = false;
    e.windup = 0;
    // EL CANTO LA ROMPE / CRISTALES ROTOS (9-a): mientras dura el aturdimiento
    // los jefes del Acto II sueltan su esencia (2 partículas por frame).
    if (e.etype === 'sirena') {
      // notas liberadas que ascienden (el canto se le escapa)
      for (let i = 0; i < 2; i++) {
        g.particles.push({
          x: e.x + (Math.random() - 0.5) * 16, y: e.y - 4 - Math.random() * 10,
          vx: (Math.random() - 0.5) * 18, vy: -26 - Math.random() * 18,
          t: 0.55, maxT: 0.55, color: '#ffe9a0', size: 1.6, grav: 0,
        });
      }
    } else if (e.etype === 'golem') {
      // cristales rotos que caen
      for (let i = 0; i < 2; i++) {
        g.particles.push({
          x: e.x + (Math.random() - 0.5) * 20, y: e.y - 10 - Math.random() * 8,
          vx: (Math.random() - 0.5) * 14, vy: 8 + Math.random() * 14,
          t: 0.5, maxT: 0.5, color: '#cfe8ff', size: 1.6, grav: 260,
        });
      }
    }
    if (e.aiT <= 0) {
      e.ai = 'persigue';
      if (e.maxSta > 0) e.sta = e.maxSta;
      if (e.etype === T_CORO) m.maskRoto = false; // la siguiente máscara puede volver a caer
    }
    return true;
  }
  return false;
}

/** Daño por contacto durante dashes (una vez por dash). */
function contactHit(g: Game, e: Enemy, def: EnemyDef, m: ExpMem): void {
  if (m.dashHit) return;
  const p = g.player;
  if (!p) return;
  if (dist(e.x, e.y, p.x, p.y) < 8 + e.w / 2 + 4) {
    m.dashHit = true;
    // damagePlayer gestiona i-frames y parada perfecta (que aturde al atacante)
    g.damagePlayer(def.dmg, e.x, e.y);
  }
}

/** Flotación de espera sin Portador presente. */
function idleFloat(g: Game, e: Enemy, dt: number): void {
  e.moving = false;
  e.anim += dt * 0.4;
}

// ============================================================
// NEUMO DE MAREA — esquiva-tirador
// ============================================================

function tickNeumo(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  if (commonTick(g, e, dt, def, m)) return true;
  const st = e.subT ?? 0; // timer auxiliar (commonTick lo incrementa)
  const p = g.player;
  if (!p) { idleFloat(g, e, dt); return true; }
  const d = dist(e.x, e.y, p.x, p.y);

  // huida por proximidad: el Portador a <40 px lo espanta 1.5 s
  if (e.aggro && e.ai !== 'huye' && e.ai !== 'carga' && d < 40) {
    e.ai = 'huye';
    e.aiT = 1.5;
  }

  switch (e.ai) {
    case 'huye': {
      e.aiT -= dt;
      const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.sin(st * 5) * 0.6;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 1.25, dt);
      if (e.aiT <= 0) e.ai = e.aggro ? 'persigue' : 'patrulla';
      break;
    }
    case 'patrulla': {
      // errando cerca de su hogar, con deriva de burbuja
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 1.5 + Math.random() * 1.5;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 60;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      const drift = Math.sin(st * 2) * 8;
      const tx = Math.cos(ang) * 20 + Math.cos(ang + Math.PI / 2) * drift * 0.4;
      const ty = Math.sin(ang) * 20 + Math.sin(ang + Math.PI / 2) * drift * 0.4;
      g.moveEntity(e, tx * dt, ty * dt);
      e.moving = true;
      e.dir = tx > 0 ? 'right' : 'left';
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue':
    case 'recupera': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      if (d > def.aggroR * 2.6) { e.aggro = false; e.ai = 'patrulla'; break; }
      // banda de flotación 90-130 px
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d < 80) moveDir(g, e, -Math.cos(ang), -Math.sin(ang), def.speed, dt);
      else if (d > 140) moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else {
        // deriva lateral sinusoidal (subT)
        const tang = ang + Math.PI / 2;
        const s = Math.sin(st * 1.4);
        moveDir(g, e, Math.cos(tang) * s, Math.sin(tang) * s, def.speed * 0.6, dt);
      }
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.ai === 'recupera') {
        e.aiT -= dt;
        if (e.aiT > 0) break;
        e.ai = 'persigue';
      }
      // disparo telegrafiado
      if (e.atkCd <= 0 && d < def.atkR) {
        e.ai = 'carga';
        e.windup = def.windup; // 0.7: el motor dibuja '!' por windup>0 en 'carga'
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) {
        // escupe 'orb' hacia el Portador — NEUMO AGÓNICO (9-a): con hp<35%
        // el escupitajo se abre en abanico de 3 orbes (±15°)
        const dx = p.x - e.x, dy = p.y - 4 - e.y;
        const base = Math.atan2(dy, dx);
        const agoniza = e.hp < e.maxHp * 0.35;
        const offs = agoniza ? [-0.2618, 0, 0.2618] : [0];
        for (const off of offs) {
          g.projectiles.push({
            x: e.x, y: e.y - 2, vx: Math.cos(base + off) * 120, vy: Math.sin(base + off) * 120, t: 1.8,
            dmg: def.dmg, element: 'ninguno', from: 'enemy', sprite: 'orb', radius: 5, pierce: 0,
          });
        }
        // sfx 'splash' lo añade el agente de pistas; si aún no existe, no-op seguro
        audio.sfx('splash');
        e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
        e.ai = 'recupera';
        e.aiT = 0.4;
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
// ESPECTRO SIN NOMBRE — tanque fantasma
// ============================================================

function tickEspectro(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  if (commonTick(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { idleFloat(g, e, dt); return true; }
  const d = dist(e.x, e.y, p.x, p.y);

  // DESVANECERSE bajo los golpes: invulnerable 0.9 s en bruma
  // (el integrador cablea invulT en damageEnemy; aquí lo fijamos y decaemos)
  if (m.freshHit && (e.invulT ?? 0) <= 0) {
    e.invulT = 0.9;
    for (let i = 0; i < 3; i++) {
      g.particles.push({
        x: e.x + (i - 1) * 5, y: e.y - 4 - i * 3,
        vx: (Math.random() - 0.5) * 24, vy: -16 - Math.random() * 16,
        t: 0.5, maxT: 0.5, color: '#c9d4e4', size: 2, grav: -8,
      });
    }
    audio.sfx('shadow');
  }

  switch (e.ai) {
    case 'patrulla': {
      // erra y a veces se DETIENE 1-2 s (susurra)
      if ((m.pauseT ?? 0) > 0) {
        m.pauseT = (m.pauseT ?? 0) - dt;
        e.moving = false;
        if (Math.random() < 0.06) {
          g.particles.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y - 8, vx: 0, vy: -12, t: 0.7, maxT: 0.7, color: '#c9d4e4', size: 1.5, grav: -4 });
        }
        break;
      }
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 1.6 + Math.random() * 2;
        e.patrolAngle = Math.random() * Math.PI * 2;
        if (Math.random() < 0.45) { m.pauseT = 1 + Math.random(); break; }
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 60;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.45, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      if (d > def.aggroR * 2.4) { e.aggro = false; e.ai = 'patrulla'; break; }
      // flota persiguiendo lento (colisión de tiles normal)
      if (d > 18) moveDir(g, e, p.x - e.x, p.y - e.y, def.speed, dt);
      else e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      // arremetida desde la bruma
      if (e.atkCd <= 0 && d < 58) {
        e.ai = 'carga';
        e.windup = def.windup; // 0.5
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) {
        const l = Math.max(1, d);
        m.dashDx = (p.x - e.x) / l;
        m.dashDy = (p.y - 4 - e.y) / l;
        m.dashHit = false;
        e.ai = 'ataca';
        e.aiT = 0.35; // dash ×3 durante 0.35 s
        audio.sfx('whoosh');
      }
      break;
    }
    case 'ataca': {
      e.aiT -= dt;
      g.moveEntity(e, m.dashDx! * def.speed * 3 * dt, m.dashDy! * def.speed * 3 * dt);
      e.moving = true;
      if (Math.random() < 0.4) {
        g.particles.push({ x: e.x, y: e.y - 4, vx: 0, vy: -6, t: 0.3, maxT: 0.3, color: '#c9d4e4', size: 2, grav: 0 });
      }
      contactHit(g, e, def, m);
      if (e.aiT <= 0) {
        e.ai = 'recupera';
        e.aiT = 0.5;
        e.atkCd = def.atkCd * (0.85 + Math.random() * 0.3);
      }
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
  m.lastAtkCd = e.atkCd;
  return true;
}

// ============================================================
// ARPÍA DE CUMBRE — asaltante aéreo
// ============================================================

function tickArpi(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  if (commonTick(g, e, dt, def, m)) return true;
  const st = e.subT ?? 0; // acumulador del picado (commonTick lo incrementa)
  const p = g.player;
  if (!p) { idleFloat(g, e, dt); return true; }
  const d = dist(e.x, e.y, p.x, p.y);

  // frágil: herida grave → huida errática volando
  if (e.aggro && e.ai !== 'huye' && e.hp < e.maxHp * 0.3) {
    e.ai = 'huye';
    e.aiT = 2.5;
  }

  switch (e.ai) {
    case 'huye': {
      e.aiT -= dt;
      const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.sin(st * 6) * 0.7;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 1.35, dt);
      if (e.aiT <= 0) e.ai = 'persigue';
      break;
    }
    case 'patrulla': {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 1.2 + Math.random() * 1.6;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 70;
      const wob = Math.sin(st * 3) * 0.4;
      const base = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(base + wob), Math.sin(base + wob), def.speed * 0.55, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      if (d > def.aggroR * 2.4) { e.aggro = false; e.ai = 'patrulla'; break; }
      // órbita a ~75 px: tangencial + corrección radial
      if (m.orbitDir === undefined) m.orbitDir = e.patrolAngle > Math.PI ? -1 : 1;
      if (Math.random() < 0.002) m.orbitDir *= -1;
      const ang = Math.atan2(e.y - p.y, e.x - p.x); // del Portador a mí
      const corr = Math.max(-1, Math.min(1, (d - 75) / 26));
      const tang = ang + (Math.PI / 2) * m.orbitDir;
      const vx = Math.cos(tang) * def.speed - Math.cos(ang) * corr * def.speed * 0.95;
      const vy = Math.sin(tang) * def.speed - Math.sin(ang) * corr * def.speed * 0.95;
      g.moveEntity(e, vx * dt, vy * dt);
      e.moving = true;
      e.dir = vx > 0 ? 'right' : 'left';
      // PICADO cada ~2.5 s (subT) — ARPÍAS EN PANDILLA (9-a): si otra arpi
      // de la bandada picó hace <0.4 s y esta está en rango, se suma al
      // asalto al instante (los windup de 0.35 s hacen que los picados
      // caigan casi a la vez sobre el Portador).
      const packT = g.globalT - lastDiveT;
      if ((st >= 2.5 || packT < 0.4) && d < 150 && d > 30) {
        e.subT = 0;
        lastDiveT = g.globalT;
        e.ai = 'carga';
        e.windup = def.windup; // 0.35
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) {
        // dash hacia la posición actual del Portador (240 px/s, 0.45 s)
        const l = Math.max(1, d);
        m.dashDx = (p.x - e.x) / l;
        m.dashDy = (p.y - 4 - e.y) / l;
        m.dashHit = false;
        e.ai = 'ataca';
        e.aiT = 0.45;
        audio.sfx('whoosh');
      }
      break;
    }
    case 'ataca': {
      e.aiT -= dt;
      g.moveEntity(e, m.dashDx! * 240 * dt, m.dashDy! * 240 * dt);
      e.moving = true;
      if (Math.random() < 0.5) {
        g.particles.push({
          x: e.x - m.dashDx! * 6, y: e.y - m.dashDy! * 6,
          vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
          t: 0.3, maxT: 0.3, color: '#e8f4fc', size: 1.5, grav: 0,
        });
      }
      contactHit(g, e, def, m);
      if (e.aiT <= 0) {
        e.ai = 'recupera';
        e.aiT = 0.8; // tras el picado: se aleja 0.8 s
      }
      break;
    }
    case 'recupera': {
      e.aiT -= dt;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.9, dt);
      if (e.aiT <= 0) {
        e.ai = 'persigue';
        e.atkCd = def.atkCd * (0.85 + Math.random() * 0.3);
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
// SIRENA ABISAL — JEFA, 3 fases (SIEMPRE return true)
// ============================================================

function pushNota(g: Game, x: number, y: number, vx: number, vy: number): void {
  g.projectiles.push({
    x, y, vx, vy, t: 2.0, dmg: 10, element: 'hielo', from: 'enemy', sprite: 'nota', radius: 5, pierce: 0,
  });
}

function fireNotas(g: Game, e: Enemy, p: Player, m: ExpMem): void {
  const base = Math.atan2(p.y - 4 - e.y, p.x - e.x);
  if (m.pendingSalva === 0) {
    // CANTO DEL ABISMO: anillo de 8 notas radiales + salva dirigida de 3
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pushNota(g, e.x, e.y - 4, Math.cos(a) * 120, Math.sin(a) * 120);
    }
    for (let i = 0; i < 3; i++) {
      const a = base + (i / 2 - 0.5) * 0.52;
      pushNota(g, e.x, e.y - 4, Math.cos(a) * 145, Math.sin(a) * 145);
    }
    audio.sfx('holy');
    audio.sfx('ice');
    // estallido del Canto (9-a): destello marea + cámara lenta breve
    addFlash(g, '#8ef0ff');
    requestSlowmo(g, 0.15);
  } else {
    // salva de marea en abanico de 40° hacia el Portador
    const n = m.pendingSalva ?? 3;
    for (let i = 0; i < n; i++) {
      const a = base + (i / (n - 1) - 0.5) * 0.7;
      pushNota(g, e.x, e.y - 4, Math.cos(a) * 130, Math.sin(a) * 130);
    }
    audio.sfx('ice');
  }
  m.pendingSalva = 0;
}

/** Invoca 1 neumo en un tile libre junto a la sirena (cap 2 vivos;
 *  en fase 3 —9-a— cap 3 y cadencia propia de 15 s). */
function summonNeumo(g: Game, e: Enemy, fase: number, m: ExpMem): void {
  // 'zone' no se guarda en Enemy: contamos todos los neumos vivos
  // (solo existen los suyos, junto a la jefa)
  const cap = fase === 3 ? 3 : 2;
  const vivos = g.enemies.filter(o => !o.dead && o.etype === 'neumo').length;
  if (vivos >= cap) { e.sumT = 4; return; }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + e.patrolAngle;
    const x = e.x + Math.cos(a) * 26, y = e.y + Math.sin(a) * 26;
    if (!g.tileSolidAt(x, y)) {
      const s = g.makeEnemy('neumo', x, y, 1, 'boss');
      s.aggro = true;
      g.enemies.push(s);
      g.burst(x, y, '#8ef0ff', 14, 70);
      g.floatAt(s.x, s.y - 18, '¡un neumo emerge!', '#8ef0ff', 7);
      audio.sfx('splash');
      e.sumT = fase === 3 ? 15 : fase === 2 ? 10 : 12;
      m.lastAtkCd = e.atkCd;
      return;
    }
  }
  e.sumT = 3; // sin sitio libre: reintenta pronto
}

/** Teletransporte acuático: se sumerge y reaparece al lado opuesto. */
function teleportSirena(g: Game, e: Enemy, p: Player, m: ExpMem): void {
  m.tpT = 0;
  g.burst(e.x, e.y, '#8ef0ff', 16, 80); // splash al sumergirse
  audio.sfx('splash');
  audio.sfx('whoosh');
  e.invulT = 0.6; // sumergida: intocable un instante
  const baseAng = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI; // lado opuesto
  const radii = [135, 120, 150, 128, 142];
  const jit = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2];
  for (const rr of radii) {
    for (const j of jit) {
      const a = baseAng + j;
      const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
      if (!g.tileSolidAt(x, y)) {
        e.x = x;
        e.y = y;
        g.burst(x, y, '#8ef0ff', 16, 80); // splash al emerger
        return;
      }
    }
  }
  // sin sitio: se queda donde está
}

function tickSirena(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  // ---- guarda de muerte (9-a): última salva visual ANTES de que el motor
  //      la filtre del array (el killEnemy ya habrá puesto e.dead) ----
  if (e.hp <= 0 && !e.dead) { deathSirena(g, e); return true; }
  if (commonTick(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { idleFloat(g, e, dt); return true; }
  const d = dist(e.x, e.y, p.x, p.y);

  // ---- banner de la jefa (misma técnica que guardianBrain) ----
  if (e.aggro && !g.flags.sirenaIntro) {
    g.flags.sirenaIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = 'SIRENA ABISAL';
    g.bossBannerSub = 'La que olvidó su nombre';
    addFlash(g, '#8ef0ff', 0.25);
    addShake(g, 4);
    audio.sfx('banner');
    e.sumT = 12;
    g.toast('La Sirena Abisal alza su canto entre la bruma', '#8ef0ff');
  }

  // ---- fases (1: >60% · 2: 60-30% · 3: <30%) ----
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
  if (newPhase > e.phase) {
    e.phase = newPhase;
    addFlash(g, newPhase === 3 ? '#b48fff' : '#8ef0ff', 0.2);
    addShake(g, 5);
    requestSlowmo(g, 0.2);
    audio.sfx('roar');
    g.toast(`La Sirena cambia de fase (${e.phase}/3)`, '#8ef0ff');
    e.windup = 0;
    m.pendingSalva = 0;
    if (e.ai === 'carga') e.ai = 'persigue';
    if (e.phase === 2) { m.tpT = 0; e.sumT = Math.min(e.sumT, 10); }
  }

  switch (e.ai) {
    case 'patrulla': {
      // flota en calma cerca de su hogar hasta el aggro
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 2 + Math.random() * 2;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 50;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.4, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      // reposicionamiento por fase (banda de distancia)
      let minD = 90, maxD = 140;
      if (e.phase === 2) { minD = 100; maxD = 150; }
      if (e.phase === 3) { minD = 60; maxD = 100; }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > maxD) moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else if (d < minD) moveDir(g, e, -Math.cos(ang), -Math.sin(ang), def.speed, dt);
      else {
        // MAREA BAJA (9-a): entre salvas strafea en arco orbital elegante
        // alrededor del Portador (fase 2 amplia y serena, fase 3 cerrada)
        if (m.orbitDir === undefined) m.orbitDir = 1;
        if (Math.random() < 0.003) m.orbitDir *= -1; // invierte el arco de vez en cuando
        const tang = ang + (Math.PI / 2) * m.orbitDir;
        moveDir(g, e, Math.cos(tang), Math.sin(tang), def.speed * (e.phase === 3 ? 0.55 : 0.5), dt);
      }
      e.dir = p.x > e.x ? 'right' : 'left';
      // ataque cuando toca
      if (e.atkCd <= 0) {
        e.ai = 'carga';
        m.pendingSalva = e.phase === 3 ? 0 : e.phase === 2 ? 4 : 3;
        if (e.phase < 3) {
          e.windup = 0.55;
          // 'aro' de marea en su posición: el motor lo explota (daño si
          // el Portador se pega a ella) al expirar el telegraph
          e.telegraphKind = 'aro';
          g.telegraphs.push({ x: e.x, y: e.y, r: 26, t: 0.55, maxT: 0.55, dmg: def.dmg, kind: 'aro' });
        } else {
          // CANTO DEL ABISMO telegrafiado (9-a): gran anillo rojo (r=70 · 1 s)
          // centrado en ELLA; las 8 notas del estallido radial salen cuando
          // el anillo se cierra — un segundo para alejarse o parar el canto
          e.windup = 1.0;
          e.telegraphKind = 'aro';
          g.telegraphs.push({ x: e.x, y: e.y, r: 70, t: 1.0, maxT: 1.0, dmg: def.dmg, kind: 'aro' });
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
        fireNotas(g, e, p, m);
        e.atkCd = (e.phase === 3 ? 2.2 : 2.0) * (0.9 + Math.random() * 0.2);
        e.ai = 'recupera';
        e.aiT = 0.35;
      }
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

  // ---- distancia mínima (9-a): el Portador nunca la pega — retroceso
  //      suave si se cuela bajo su guardia (salvo mientras telegrafía) ----
  if (e.aggro && e.ai !== 'carga' && d < 50) {
    moveDir(g, e, e.x - p.x, e.y - p.y, def.speed * 0.85, dt);
  }

  // ---- coro de neumos (fases 1-2 cadencia 12/10 s · fase 3 cada 15 s, cap 3 — 9-a) ----
  if (e.aggro) {
    e.sumT -= dt;
    if (e.sumT <= 0) summonNeumo(g, e, e.phase, m);
  }

  // ---- teletransporte acuático (solo fase 2, cada 6 s) ----
  if (e.aggro && e.phase === 2) {
    m.tpT = (m.tpT ?? 0) + dt;
    if (m.tpT >= 6) teleportSirena(g, e, p, m);
  }

  // ---- MAREA BAJA (fase 2, cada 9 s — 9-a): doble onda desde su posición;
  //      castiga quedarse a rango medio mientras ella orbita ----
  if (e.aggro && e.phase === 2) {
    m.mareaT = (m.mareaT ?? 0) + dt;
    if (m.mareaT >= 9) {
      m.mareaT = 0;
      g.waves.push({ x: e.x, y: e.y, r: 0, maxR: 80, speed: 200, dmg: 10, hit: false });
      g.waves.push({ x: e.x, y: e.y, r: 12, maxR: 80, speed: 200, dmg: 10, hit: false }); // 2ª cresta desfasada
      addShake(g, 4);
      audio.sfx('splash');
    }
  }

  m.lastAtkCd = e.atkCd;
  return true;
  // NOTA: su muerte la gestiona el motor (killEnemy genérico + XP/oro).
  // El integrador pondrá g.flags.sirenaDefeated en killEnemy (o watcher).
}

// ============================================================
// GÓLEM DE ESCARCHA — JEFE, 2 fases (SIEMPRE return true)
// ============================================================

/** Ventisca: 4 telegraphs 'aro' — 2 sobre la posición ACTUAL del Portador
 *  y 2 sobre su posición futura estimada (pos + velocidad real · 0.5 s,
 *  9-a): correr en línea recta ya no es gratis. */
function ventisca(g: Game, e: Enemy, p: Player, def: EnemyDef): void {
  audio.sfx('gust'); // no-op seguro si el sfx no existe aún
  audio.sfx('ice');
  const spots: [number, number][] = [
    [p.x - 9, p.y], [p.x + 9, p.y],
  ];
  // posición futura: la velocidad real la mide update.ts (getPortadorVel);
  // tope de 60 px para no telegrafiar fuera del alcance del dash
  const pv = getPortadorVel();
  const fx = p.x + Math.max(-60, Math.min(60, pv.x * 0.5));
  const fy = p.y + Math.max(-60, Math.min(60, pv.y * 0.5));
  spots.push([fx - 9, fy - 4], [fx + 9, fy + 4]);
  for (const [sx, sy] of spots) {
    // el daño en área lo aplican los telegraphs al explotar (el motor
    // gestiona i-frames/parada; los 4 puntos nunca apilan daño)
    g.telegraphs.push({ x: sx, y: sy, r: 22, t: 0.85, maxT: 0.85, dmg: def.dmg, kind: 'aro' });
    // onda visual pequeña en cada punto (el "estallido" de la ventisca)
    g.waves.push({ x: sx, y: sy, r: 2, maxR: 26, speed: 90, dmg: 0, hit: true });
  }
}

function tickGolem(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  // ---- guarda de muerte (9-a): onda de nieve ANTES de que el motor lo filtre ----
  if (e.hp <= 0 && !e.dead) { deathGolem(g, e); return true; }
  if (commonTick(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { idleFloat(g, e, dt); return true; }
  const d = dist(e.x, e.y, p.x, p.y);

  // ---- banner del jefe ----
  if (e.aggro && !g.flags.golemIntro) {
    g.flags.golemIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = 'GÓLEM DE ESCARCHA';
    g.bossBannerSub = 'Memoria de la montaña';
    addFlash(g, '#a8d8ff', 0.25);
    addShake(g, 4);
    audio.sfx('banner');
    g.toast('El Gólem de Escarcha despierta en el paso', '#a8d8ff');
  }

  // ---- fases (1: >50% · 2: <50%) ----
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.5 ? 1 : 2;
  if (newPhase > e.phase) {
    e.phase = newPhase;
    addFlash(g, '#a8d8ff', 0.22);
    addShake(g, 5);
    requestSlowmo(g, 0.25);
    audio.sfx('roar');
    g.toast(`El hielo del Gólem se agrieta (${e.phase}/2)`, '#a8d8ff');
    m.ventT = 0;
    m.actIdx = 0;
    if (e.ai === 'carga') e.ai = 'persigue';
  }

  // ---- onda visual del slam: al expirar el telegraph (0.9 s) ----
  // El daño real lo aplica el telegraph al explotar (r=44, como el slam
  // del Guardián): la onda es visual para NO golpear dos veces.
  if ((m.slamPend ?? 0) > 0) {
    m.slamPend = (m.slamPend ?? 0) - dt;
    if ((m.slamPend ?? 0) <= 0) {
      g.waves.push({ x: e.x, y: e.y, r: 0, maxR: 70, speed: 220, dmg: 0, hit: true });
      m.frostT = 1.0; // PIZCA DE HIELO (9-a): lluvia de escarcha tras el slam
      // el motor ya ejecuta sfx('slam') + shake 6 + burst al expirar el telegraph
    }
  }

  // ---- PIZCA DE HIELO (9-a): durante 1 s cae escarcha alrededor del gólem
  if ((m.frostT ?? 0) > 0) {
    m.frostT = (m.frostT ?? 0) - dt;
    for (let i = 0; i < 4; i++) {
      const ft = 0.3 + Math.random() * 0.15;
      g.particles.push({
        x: e.x + (Math.random() - 0.5) * 40, y: e.y - 12 - Math.random() * 10,
        vx: (Math.random() - 0.5) * 24, vy: 24 + Math.random() * 26,
        t: ft, maxT: ft, color: '#a8d8ff', size: 1.5, grav: 300,
      });
    }
  }

  // ---- ventisca (fase 2, cada 7 s, independiente del ciclo) ----
  if (e.aggro && e.phase === 2 && e.ai !== 'carga') {
    m.ventT = (m.ventT ?? 0) + dt;
    if (m.ventT >= 7) {
      m.ventT = 0;
      ventisca(g, e, p, def);
    }
  }

  // ---- CORAZÓN DE HIELO (fase 2, cada 11 s — 9-a): el núcleo brilla
  //      (telegraph slam centrado en él) y escupe 6 shards en anillo radial ----
  if (e.aggro && e.phase === 2 && e.ai !== 'carga') {
    m.corazonT = (m.corazonT ?? 0) + dt;
    if (m.corazonT >= 11) {
      m.corazonT = 0;
      g.telegraphs.push({ x: e.x, y: e.y, r: 30, t: 0.7, maxT: 0.7, dmg: def.dmg, kind: 'slam' });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.projectiles.push({
          x: e.x, y: e.y - 6, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
          t: 1.7, dmg: 12, element: 'hielo', from: 'enemy', sprite: 'shard', radius: 5, pierce: 0,
        });
      }
      audio.sfx('ice');
    }
  }

  switch (e.ai) {
    case 'patrulla': {
      // pisa lento cerca de su hogar; casi una montaña
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 2.5 + Math.random() * 2.5;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 40;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.4, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      if (d > def.aggroR * 2.4) { e.aggro = false; e.ai = 'patrulla'; break; }
      if (d > def.atkR * 0.8) moveDir(g, e, p.x - e.x, p.y - e.y, def.speed, dt);
      else e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.atkCd <= 0 && d < def.aggroR) {
        // elegir acción: slam/lanza (fase 1) · slam/embiste/lanza (fase 2)
        m.actIdx = (m.actIdx ?? 0) + 1;
        m.act = e.phase === 1
          ? (m.actIdx % 2 === 1 ? 'slam' : 'lanza')
          : (['slam', 'embiste', 'lanza'] as const)[m.actIdx % 3];
        e.ai = 'carga';
        e.windup = m.act === 'embiste' ? 0.7 : def.windup; // 0.9 el slam/lanza
        e.telegraphKind = m.act === 'slam' ? 'slam' : 'salva';
        if (m.act === 'slam') {
          // telegraph EN SU FRENTE (hacia el Portador)
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          g.telegraphs.push({
            x: e.x + Math.cos(a) * 26, y: e.y + Math.sin(a) * 26,
            r: 44, t: 0.9, maxT: 0.9, dmg: def.dmg, kind: 'slam',
          });
          m.slamPend = 0.9;
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
        if (m.act === 'lanza') {
          // 2 cristales 'shard' en arco hacia el Portador
          const a = Math.atan2(p.y - 4 - e.y, p.x - e.x);
          for (const off of [-0.13, 0.13]) {
            g.projectiles.push({
              x: e.x, y: e.y - 6, vx: Math.cos(a + off) * 150, vy: Math.sin(a + off) * 150,
              t: 1.7, dmg: 12, element: 'hielo', from: 'enemy', sprite: 'shard', radius: 5, pierce: 0,
            });
          }
          audio.sfx('ice');
          e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
          e.ai = 'recupera';
          e.aiT = 0.5;
        } else if (m.act === 'embiste') {
          // embestida en línea hacia el Portador
          const l = Math.max(1, d);
          m.dashDx = (p.x - e.x) / l;
          m.dashDy = (p.y - e.y) / l;
          m.dashHit = false;
          e.ai = 'ataca';
          e.aiT = 0.9;
          audio.sfx('whoosh');
        } else {
          // slam: el telegraph ya colocada hace el trabajo; solo respira
          e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
          e.ai = 'recupera';
          e.aiT = 0.55;
        }
      }
      break;
    }
    case 'ataca': {
      // EMBESTIDA (180 px/s · 0.9 s) con rebote contra muros
      e.aiT -= dt;
      const stepX = m.dashDx! * 180 * dt;
      const stepY = m.dashDy! * 180 * dt;
      const freeX = g.boxFree(e.x + stepX, e.y, e.w, e.h);
      const freeY = g.boxFree(e.x, e.y + stepY, e.w, e.h);
      if (!freeX && !freeY) {
        // ¡rebote! detiene la embestida
        addShake(g, 3);
        g.burst(e.x, e.y, '#dceef8', 12, 60);
        e.ai = 'recupera';
        e.aiT = 0.6;
        e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
        break;
      }
      g.moveEntity(e, stepX, stepY);
      e.moving = true;
      // SURCO DE HIELO (9-a): la embestida arranca 6 partículas blancas
      // por frame a su paso — el rastro marca por dónde no cruzar
      for (let i = 0; i < 6; i++) {
        g.particles.push({
          x: e.x - m.dashDx! * 8 + (Math.random() - 0.5) * 14,
          y: e.y - m.dashDy! * 8 + 4 + (Math.random() - 0.5) * 6,
          vx: -m.dashDx! * 26 + (Math.random() - 0.5) * 18,
          vy: -12 - Math.random() * 16,
          t: 0.32, maxT: 0.32, color: '#ffffff', size: 1.6, grav: 40,
        });
      }
      contactHit(g, e, def, m);
      if (e.aiT <= 0) {
        e.ai = 'recupera';
        e.aiT = 0.6;
        e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
      }
      break;
    }
    case 'recupera': {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0) e.ai = e.aggro ? 'persigue' : 'patrulla';
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
  // NOTA: su muerte la gestiona el motor (killEnemy genérico + XP/oro).
  // El integrador pondrá g.flags.golemDefeated en killEnemy (o watcher).
}

// ============================================================
// MUERTE DE LOS JEFES (9-a) — última salva visual. La invoca update.ts
// en cuanto ve e.dead (ANTES de que el filtro g.enemies retire al muerto)
// y también las guardas hp<=0 de los propios ticks. Una sola vez por jefe.
// ============================================================

const deathFxVisto = new WeakSet<Enemy>();

function deathSirena(g: Game, e: Enemy): void {
  if (deathFxVisto.has(e)) return;
  deathFxVisto.add(e);
  // última salva: 12 notas liberadas en espiral (radial + tangencial + ascenso)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const t = 0.55 + (i % 3) * 0.1;
    g.particles.push({
      x: e.x + Math.cos(a) * 6, y: e.y - 4 + Math.sin(a) * 4,
      vx: Math.cos(a) * 55 - Math.sin(a) * 42,
      vy: Math.sin(a) * 30 + Math.cos(a) * 42 - 26,
      t, maxT: t, color: '#8ef0ff', size: 2, grav: -20,
    });
  }
  requestSlowmo(g, 0.3); // el mar contiene el aliento (el motor pone sirenaDefeated + toasts)
}

function deathGolem(g: Game, e: Enemy): void {
  if (deathFxVisto.has(e)) return;
  deathFxVisto.add(e);
  // onda de nieve: 20 copos radiales que se posan + temblor de la montaña
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + 0.2;
    const spd = 60 + (i % 4) * 18;
    const t = 0.6 + (i % 5) * 0.08;
    g.particles.push({
      x: e.x + Math.cos(a) * 8, y: e.y - 2 + Math.sin(a) * 5,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.5 - 20,
      t, maxT: t, color: '#ffffff', size: 2, grav: 60,
    });
  }
  addShake(g, 8);
}

// ============================================================
// VULT, EL CAZADOR DE ECOS — JEFE opcional (14-a), SIEMPRE return true
// Cumbres de NOCHE con contenido posterior a q11 (activación:
// expansionBossWatchers). Ciclo: RAFAGA (abanico de dagas) · EMBISTE
// (dash con estela) · SALTO (slam telegrafiado sobre la posición
// predicha). A melé: TAJO en arco. FASE 3 (<30% hp): MODO ACECHO cada
// 8 s — se desvanece, reaparece a tu espalda y su siguiente ataque
// sale casi al instante. Cazador nocturno: +10% de velocidad de noche.
// ============================================================

function pushDaga(g: Game, x: number, y: number, vx: number, vy: number): void {
  g.projectiles.push({
    x, y, vx, vy, t: 1.5, dmg: 11, element: 'sombra', from: 'enemy', sprite: 'shard', radius: 4, pierce: 0,
  });
}

function fireRafaga(g: Game, e: Enemy, p: Player): void {
  const base = Math.atan2(p.y - 4 - e.y, p.x - e.x);
  const n = e.phase >= 3 ? 9 : e.phase === 2 ? 7 : 5;
  for (let i = 0; i < n; i++) {
    const a = base + (i / (n - 1) - 0.5) * 0.9;
    pushDaga(g, e.x, e.y - 4, Math.cos(a) * 175, Math.sin(a) * 175);
  }
  audio.sfx('whoosh');
}

/** MODO ACECHO (fase 3): desvanecimiento + reaparición a la espalda. */
function acechoVult(g: Game, e: Enemy, p: Player, m: ExpMem): void {
  m.acechoCd = 0;
  g.burst(e.x, e.y, '#c8b0e8', 18, 90);
  audio.sfx('whoosh');
  e.invulT = 0.9; // entre las páginas de su mapa
  // reaparece MÁS ALLÁ del Portador (a su espalda respecto a Vult)
  const ang = Math.atan2(p.y - e.y, p.x - e.x);
  for (const dd of [55, 42, 68, 30, 80]) {
    const x = p.x + Math.cos(ang) * dd, y = p.y + Math.sin(ang) * dd;
    if (!g.tileSolidAt(x, y)) { e.x = x; e.y = y; break; }
  }
  g.burst(e.x, e.y, '#c8b0e8', 18, 90);
  e.atkCd = 0.35; // el primer ataque sale casi al instante
  g.floatAt(e.x, e.y - 22, '¡ACECHO!', '#c8b0e8', 8);
  m.lastAtkCd = e.atkCd;
}

function tickVult(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  // guarda de muerte: FX final antes de que el motor lo filtre
  if (e.hp <= 0 && !e.dead) { deathVult(g, e); return true; }
  if (commonTick(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { idleFloat(g, e, dt); return true; }
  const d = dist(e.x, e.y, p.x, p.y);

  // ---- banner del jefe (misma técnica que sirena/golem) ----
  if (e.aggro && !g.flags.vultIntro) {
    g.flags.vultIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = 'VULT, EL CAZADOR DE ECOS';
    g.bossBannerSub = 'El mapa de tus pasos es su contrato';
    addFlash(g, '#c8b0e8', 0.25);
    addShake(g, 4);
    audio.sfx('banner');
    g.toast('Un mapa se despliega en la niebla: Vult ha encontrado tus pasos', '#c8b0e8');
  }

  // ---- fases (1: >60% · 2: 60-30% · 3: <30% = MODO ACECHO) ----
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
  if (newPhase > e.phase) {
    e.phase = newPhase;
    addFlash(g, '#c8b0e8', 0.2);
    addShake(g, 5);
    requestSlowmo(g, 0.2);
    audio.sfx('roar');
    g.toast(e.phase === 3 ? 'Vult entra en MODO ACECHO: no parpadees' : `Vult se enfurece (${e.phase}/3)`, '#c8b0e8');
    e.windup = 0;
    if (e.ai === 'carga') e.ai = 'persigue';
  }

  // MODO ACECHO (fase 3, cada 8 s; no interrumpe un ataque en curso)
  if (e.aggro && e.phase === 3 && e.ai !== 'carga') {
    m.acechoCd = (m.acechoCd ?? 0) + dt;
    if (m.acechoCd >= 8) acechoVult(g, e, p, m);
  }

  // cazador nocturno: +10% de velocidad bajo la noche
  const spd = def.speed * (isNightG(g) ? 1.1 : 1.0);

  switch (e.ai) {
    case 'patrulla': {
      e.aiT -= dt;
      if (e.aiT <= 0) { e.aiT = 2 + Math.random() * 2; e.patrolAngle = Math.random() * Math.PI * 2; }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 50;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), spd * 0.4, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      // banda de cazador: 70-120 px
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 120) moveDir(g, e, Math.cos(ang), Math.sin(ang), spd, dt);
      else if (d < 70) moveDir(g, e, -Math.cos(ang), -Math.sin(ang), spd, dt);
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.atkCd <= 0) {
        if (d < def.atkR + 10) {
          // TAJO en arco (melé): el 'aro' del telegraph explota al expirar
          e.ai = 'carga';
          m.vAct = 'tajo';
          e.windup = 0.35;
          e.telegraphKind = 'aro';
          g.telegraphs.push({ x: e.x, y: e.y, r: 34, t: 0.35, maxT: 0.35, dmg: 12, kind: 'aro' });
        } else {
          // ciclo de cazador: rafaga → embiste → salto
          const ciclo: Array<'rafaga' | 'embiste' | 'salto'> = ['rafaga', 'embiste', 'salto'];
          m.vIdx = ((m.vIdx ?? -1) + 1) % 3;
          m.vAct = ciclo[m.vIdx];
          e.ai = 'carga';
          if (m.vAct === 'rafaga') {
            e.windup = 0.5;
            e.telegraphKind = undefined;
          } else if (m.vAct === 'embiste') {
            e.windup = 0.42;
            e.telegraphKind = 'onda';
          } else {
            // SALTO: slam sobre la posición PREDICHA del Portador
            const v = getPortadorVel();
            const tx = p.x + v.x * 0.35, ty = p.y + v.y * 0.35;
            m.saltoX = tx; m.saltoY = ty;
            e.windup = 0.75;
            e.telegraphKind = 'slam';
            e.invulT = Math.max(e.invulT ?? 0, 0.75); // en el aire
            g.telegraphs.push({ x: tx, y: ty, r: 44, t: 0.75, maxT: 0.75, dmg: 13, kind: 'slam' });
            audio.sfx('whoosh');
          }
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
        if (m.vAct === 'rafaga') {
          fireRafaga(g, e, p);
          e.atkCd = 1.7 * (0.9 + Math.random() * 0.2);
          e.ai = 'recupera'; e.aiT = 0.3;
        } else if (m.vAct === 'embiste') {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          m.dashDx = Math.cos(ang); m.dashDy = Math.sin(ang);
          m.dashHit = false;
          e.ai = 'ataca'; e.aiT = 0.5;
          audio.sfx('whoosh');
        } else if (m.vAct === 'salto') {
          // aterriza donde telegrafiaba + onda de impacto
          if (m.saltoX !== undefined && m.saltoY !== undefined) { e.x = m.saltoX; e.y = m.saltoY; }
          g.waves.push({ x: e.x, y: e.y, r: 0, maxR: 54, speed: 210, dmg: 13, hit: false });
          g.burst(e.x, e.y, '#c8b0e8', 14, 80);
          addShake(g, 5);
          audio.sfx('roar');
          e.atkCd = 1.8;
          e.ai = 'recupera'; e.aiT = 0.4;
        } else {
          // tajo: el 'aro' dañó; remata con una daga corta
          pushDaga(g, e.x, e.y - 4, (p.x - e.x) * 1.4, (p.y - e.y) * 1.4);
          e.atkCd = 1.2;
          e.ai = 'recupera'; e.aiT = 0.3;
        }
      }
      break;
    }
    case 'ataca': {
      // EMBESTIDA con estela (daño por contacto una vez — contactHit)
      e.aiT -= dt;
      g.moveEntity(e, (m.dashDx ?? 0) * 265 * dt, (m.dashDy ?? 0) * 265 * dt);
      e.moving = true;
      g.particles.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y + (Math.random() - 0.5) * 6, vx: 0, vy: -8, t: 0.35, maxT: 0.35, color: '#c8b0e8', size: 1.6, grav: 0 });
      contactHit(g, e, def, m);
      // el cazador no se estrella: corta la embestida en el muro
      if (g.tileSolidAt(e.x + (m.dashDx ?? 0) * 10, e.y + (m.dashDy ?? 0) * 10)) { e.aiT = 0; addShake(g, 3); }
      if (e.aiT <= 0) { e.ai = 'recupera'; e.aiT = 0.35; e.atkCd = 1.6; }
      break;
    }
    case 'recupera': {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0) e.ai = 'persigue';
      break;
    }
    default: break;
  }

  m.lastAtkCd = e.atkCd;
  return true;
}

// ============================================================
// EL CORO ROTO — JEFE post-Acto III (14-a), SIEMPRE return true
// Cripta con acto3Done + Guardián recordado descansado (activación:
// expansionBossWatchers). Tres máscaras unidas por la nota del revés
// de Velmora: quebrar la barra de quiebre hace CAER la máscara activa
// (caeMascara) y entra la siguiente con patrón nuevo:
//   · EL PULSO    (coro1) — orbes pulsantes radiales + onda
//   · EL VERA     (coro2) — rayos en cruz (cardinal ↔ diagonal)
//   · EL SILENCIO (coro3) — lluvia continua de notas caídas
// ============================================================

const MASCARA_INFO: Record<number, { nombre: string; color: string }> = {
  1: { nombre: 'EL PULSO', color: '#7ee8ff' },
  2: { nombre: 'EL VERA', color: '#ffe9a0' },
  3: { nombre: 'EL SILENCIO', color: '#b48fff' },
};

/** Cae la máscara activa del Coro Roto: estallido + la siguiente entra
 *  cantando (el latch maskRoto del bloque común garantiza 1 llamada por
 *  quebrado; al salir del aturdimiento, maskRoto vuelve a false). */
function caeMascara(g: Game, e: Enemy, m: ExpMem, _primera: boolean): void {
  m.maskIdx = ((m.maskIdx ?? 1) % 3) + 1;
  e.sprite = `coro${m.maskIdx}`;
  const info = MASCARA_INFO[m.maskIdx] ?? MASCARA_INFO[1];
  g.burst(e.x, e.y - 6, '#c8b0e8', 26, 110);
  addFlash(g, info.color, 0.22);
  addShake(g, 6);
  audio.sfx('holy');
  audio.sfx('roar');
  g.floatAt(e.x, e.y - 26, '¡cae la máscara!', info.color, 8);
  g.toast(`El Coro Roto muestra su siguiente máscara: ${info.nombre}`, info.color);
  e.atkCd = 1.0; // la nueva máscara tarda un respiro en cantar
  m.coroT = 0;
  m.lastAtkCd = e.atkCd;
}

/** El canto de la máscara activa (al expirar el windup del 'aro'). */
function cantaMascara(g: Game, e: Enemy, p: Player, m: ExpMem): void {
  const maskIdx = m.maskIdx ?? 1;
  if (maskIdx === 1) {
    // EL PULSO: anillo de 8 orbes lentos + onda pulsante
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (m.coroRot ?? 0) * 0.4;
      g.projectiles.push({
        x: e.x + Math.cos(a) * 12, y: e.y - 4 + Math.sin(a) * 12,
        vx: Math.cos(a) * 88, vy: Math.sin(a) * 88,
        t: 2.6, dmg: 11, element: 'sombra', from: 'enemy', sprite: 'orb', radius: 5.5, pierce: 0,
      });
    }
    g.waves.push({ x: e.x, y: e.y, r: 0, maxR: 64, speed: 160, dmg: 12, hit: false });
    audio.sfx('holy');
    addShake(g, 3);
  } else if (maskIdx === 2) {
    // EL VERA: rayos en cruz — cardinal ↔ diagonal (alterna con cada canto)
    m.coroRot = ((m.coroRot ?? 0) + 1) % 2;
    const baseA = (m.coroRot ?? 0) === 1 ? Math.PI / 4 : 0;
    for (let k = 0; k < 4; k++) {
      const a = baseA + (k / 4) * Math.PI * 2;
      for (let j = 1; j <= 3; j++) {
        const rr = 12 * j;
        g.projectiles.push({
          x: e.x + Math.cos(a) * rr, y: e.y - 4 + Math.sin(a) * rr,
          vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
          t: 1.6, dmg: 11, element: 'sombra', from: 'enemy', sprite: 'nota', radius: 4.5, pierce: 0,
        });
      }
    }
    audio.sfx('ice');
    addFlash(g, '#ffe9a0', 0.12);
  } else {
    // EL SILENCIO: ráfaga dirigida que castiga acercarse (mientras llueve)
    const base = Math.atan2(p.y - 4 - e.y, p.x - e.x);
    for (let i = 0; i < 3; i++) {
      const a = base + (i / 2 - 0.5) * 0.5;
      g.projectiles.push({
        x: e.x, y: e.y - 4, vx: Math.cos(a) * 135, vy: Math.sin(a) * 135,
        t: 1.8, dmg: 10, element: 'sombra', from: 'enemy', sprite: 'nota', radius: 4.5, pierce: 0,
      });
    }
    audio.sfx('whoosh');
  }
}

function tickCoro(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  if (e.hp <= 0 && !e.dead) { deathCoro(g, e); return true; }
  if (commonTick(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { idleFloat(g, e, dt); return true; }
  const d = dist(e.x, e.y, p.x, p.y);
  const maskIdx = m.maskIdx ?? 1;

  // ---- banner del jefe ----
  if (e.aggro && !g.flags.coroIntro) {
    g.flags.coroIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = 'EL CORO ROTO';
    g.bossBannerSub = 'Tres máscaras, una nota al revés';
    addFlash(g, '#c8b0e8', 0.25);
    addShake(g, 4);
    audio.sfx('banner');
    g.toast('El altar resuena: las tres máscaras giran hacia ti', '#c8b0e8');
  }

  switch (e.ai) {
    case 'patrulla': {
      // flota junto al altar
      e.aiT -= dt;
      if (e.aiT <= 0) { e.aiT = 2 + Math.random() * 2; e.patrolAngle = Math.random() * Math.PI * 2; }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 44;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.35, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      // coro lento: banda 100-170 (fuera de melé, dentro de su canto)
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 170) moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else if (d < 100) moveDir(g, e, -Math.cos(ang), -Math.sin(ang), def.speed, dt);
      else {
        if (m.orbitDir === undefined) m.orbitDir = 1;
        if (Math.random() < 0.002) m.orbitDir *= -1;
        const tang = ang + (Math.PI / 2) * m.orbitDir;
        moveDir(g, e, Math.cos(tang), Math.sin(tang), def.speed * 0.5, dt);
      }
      e.dir = p.x > e.x ? 'right' : 'left';

      // EL SILENCIO (máscara 3): lluvia continua de notas caídas sobre ti
      if (maskIdx === 3) {
        m.coroT = (m.coroT ?? 0) + dt;
        if (m.coroT >= 0.22) {
          m.coroT = 0;
          g.projectiles.push({
            x: p.x + (Math.random() - 0.5) * 130, y: p.y - 95 + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 14, vy: 118,
            t: 1.35, dmg: 10, element: 'sombra', from: 'enemy', sprite: 'nota', radius: 4.5, pierce: 0,
          });
          m.lluviaSfx = (m.lluviaSfx ?? 0) + 1;
          if ((m.lluviaSfx ?? 0) % 6 === 0) audio.sfx('ice');
        }
      }

      if (e.atkCd <= 0) {
        e.ai = 'carga';
        e.windup = 0.7;
        e.telegraphKind = 'aro';
        g.telegraphs.push({ x: e.x, y: e.y, r: 40, t: 0.7, maxT: 0.7, dmg: def.dmg, kind: 'aro' });
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) {
        e.telegraphKind = undefined;
        cantaMascara(g, e, p, m);
        e.atkCd = (maskIdx === 3 ? 2.6 : 2.1) * (0.9 + Math.random() * 0.2);
        e.ai = 'recupera';
        e.aiT = 0.4;
      }
      break;
    }
    case 'recupera': {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0) e.ai = 'persigue';
      break;
    }
    default: break;
  }

  m.lastAtkCd = e.atkCd;
  return true;
}

// ============================================================
// ECO DESGARRADO — enemigo de mapa (14-a): un eco partido en dos que
// PARPADEA a tu flanco (flanco alternante, con destello de aviso) y
// arremete en dash corto.
// ============================================================
function tickEcodesg(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  if (commonTick(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { idleFloat(g, e, dt); return true; }
  const d = dist(e.x, e.y, p.x, p.y);

  switch (e.ai) {
    case 'patrulla': {
      e.aiT -= dt;
      if (e.aiT <= 0) { e.aiT = 1.5 + Math.random() * 1.5; e.patrolAngle = Math.random() * Math.PI * 2; }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 40;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.35, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 90) moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.atkCd <= 0 && d < 135) {
        // PARPADEO al flanco (la bruma destella ANTES: es la telegrafía)
        m.blinkSide = (m.blinkSide ?? 1) * -1;
        const fa = ang + (Math.PI / 2) * (m.blinkSide ?? 1);
        g.burst(e.x, e.y, '#b48fff', 12, 70);
        audio.sfx('whoosh');
        for (const dd of [42, 34, 52, 26]) {
          const x = p.x + Math.cos(fa) * dd, y = p.y + Math.sin(fa) * dd;
          if (!g.tileSolidAt(x, y)) { e.x = x; e.y = y; break; }
        }
        g.burst(e.x, e.y, '#b48fff', 12, 70);
        e.ai = 'carga';
        e.windup = 0.3; // media ventana para girarte
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      if (e.windup <= 0) {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        m.dashDx = Math.cos(ang); m.dashDy = Math.sin(ang);
        m.dashHit = false;
        e.ai = 'ataca'; e.aiT = 0.32;
        audio.sfx('blip');
      }
      break;
    }
    case 'ataca': {
      // arremetida corta (daño por contacto una vez)
      e.aiT -= dt;
      g.moveEntity(e, (m.dashDx ?? 0) * 215 * dt, (m.dashDy ?? 0) * 215 * dt);
      e.moving = true;
      contactHit(g, e, def, m);
      if (g.tileSolidAt(e.x + (m.dashDx ?? 0) * 8, e.y + (m.dashDy ?? 0) * 8)) e.aiT = 0;
      if (e.aiT <= 0) { e.ai = 'recupera'; e.aiT = 0.55; e.atkCd = 1.5; }
      break;
    }
    case 'recupera': {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0) e.ai = 'persigue';
      break;
    }
    default: break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}

// ============================================================
// SÁTIRO DE LA NIEBLA — enemigo de mapa (14-a): silba BALADAS CURVAS
// que caen sobre la posición PREDICHA del Portador (telegraph 'aro' como
// marca de caída + orbe real con el daño); si te acercas, huye silbando.
// ============================================================
function tickSatiro(g: Game, e: Enemy, dt: number, def: EnemyDef, m: ExpMem): boolean {
  if (commonTick(g, e, dt, def, m)) return true;
  const p = g.player;
  if (!p) { idleFloat(g, e, dt); return true; }
  const d = dist(e.x, e.y, p.x, p.y);

  switch (e.ai) {
    case 'patrulla': {
      e.aiT -= dt;
      if (e.aiT <= 0) { e.aiT = 2 + Math.random() * 2; e.patrolAngle = Math.random() * Math.PI * 2; }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 44;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.4, dt);
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      if (!e.aggro) { e.ai = 'patrulla'; break; }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d < 75) moveDir(g, e, -Math.cos(ang), -Math.sin(ang), def.speed * 0.95, dt);
      else if (d > 165) moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else {
        if (m.orbitDir === undefined) m.orbitDir = 1;
        if (Math.random() < 0.004) m.orbitDir *= -1;
        const tang = ang + (Math.PI / 2) * m.orbitDir;
        moveDir(g, e, Math.cos(tang), Math.sin(tang), def.speed * 0.6, dt);
      }
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.atkCd <= 0 && d < def.atkR + 20) {
        // BALADA CURVA: marca de caída en la posición PREDICHA (0.5 s)
        const v = getPortadorVel();
        const px = p.x + v.x * 0.5, py = p.y + v.y * 0.5;
        m.saltoX = px; m.saltoY = py;
        e.ai = 'carga';
        e.windup = 0.8;
        e.telegraphKind = 'aro';
        // el telegraph SOLO avisa (dmg 0): el daño lo lleva el orbe
        g.telegraphs.push({ x: px, y: py, r: 24, t: 0.8, maxT: 0.8, dmg: 0, kind: 'aro' });
      }
      break;
    }
    case 'carga': {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      if (e.windup <= 0) {
        e.telegraphKind = undefined;
        // silba el orbe hacia el punto marcado (llega cuando el 'aro' cierra)
        if (m.saltoX !== undefined && m.saltoY !== undefined) {
          const a = Math.atan2(m.saltoY - e.y, m.saltoX - e.x);
          const dd = Math.hypot(m.saltoX - e.x, m.saltoY - e.y);
          // el punto de spawn NUNCA dentro de pared (el bucle de proyectiles
          // elimina al instante los orbes nacidos en tile sólido): prueba el
          // offset de boca, el centro del cuerpo y un empujón en la dirección
          let ox = e.x, oy = e.y - 6;
          if (g.tileSolidAt(ox, oy)) oy = e.y;
          if (g.tileSolidAt(ox, oy)) { ox = e.x + Math.cos(a) * 10; oy = e.y + Math.sin(a) * 10; }
          g.projectiles.push({
            x: ox, y: oy, vx: Math.cos(a) * Math.max(60, dd / 0.8), vy: Math.sin(a) * Math.max(60, dd / 0.8),
            t: 1.1, dmg: def.dmg, element: 'ninguno', from: 'enemy', sprite: 'orb', radius: 4, pierce: 0,
          });
        }
        audio.sfx('blip');
        e.atkCd = 2.2 * (0.9 + Math.random() * 0.2);
        e.ai = 'recupera'; e.aiT = 0.4;
      }
      break;
    }
    case 'recupera': {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0) e.ai = 'persigue';
      break;
    }
    default: break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}

// ============================================================
// FX DE MUERTE de los jefes 14-a (mismo patrón que sirena/gólem)
// ============================================================

function deathVult(g: Game, e: Enemy): void {
  if (deathFxVisto.has(e)) return;
  deathFxVisto.add(e);
  // el mapa de tus pasos se rasga: dagas y páginas caen
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.particles.push({
      x: e.x + Math.cos(a) * 6, y: e.y - 6 + Math.sin(a) * 4,
      vx: Math.cos(a) * 70, vy: Math.sin(a) * 40 - 30,
      t: 0.6 + (i % 3) * 0.1, maxT: 0.7, color: i % 2 ? '#c8b0e8' : '#f0ead0', size: 2, grav: 120,
    });
  }
  requestSlowmo(g, 0.3);
}

function deathCoro(g: Game, e: Enemy): void {
  if (deathFxVisto.has(e)) return;
  deathFxVisto.add(e);
  // las tres máscaras se parten a la vez: notas al revés que suben
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 + 0.3;
    const t = 0.6 + (i % 4) * 0.08;
    g.particles.push({
      x: e.x + Math.cos(a) * 8, y: e.y - 6 + Math.sin(a) * 5,
      vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 24,
      t, maxT: t, color: i % 3 === 0 ? '#7ee8ff' : i % 3 === 1 ? '#ffe9a0' : '#b48fff', size: 2.2, grav: -14,
    });
  }
  addFlash(g, '#c8b0e8', 0.3);
  requestSlowmo(g, 0.35);
}

/** Punto de enganche para update.ts: FX de muerte de los jefes del Acto II. */
export function expansionDeathFx(g: Game, e: Enemy): void {
  if (e.etype === 'sirena') deathSirena(g, e);
  else if (e.etype === 'golem') deathGolem(g, e);
  else if (e.etype === T_VULT) deathVult(g, e); // 14-a
  else if (e.etype === T_CORO) deathCoro(g, e); // 14-a
}

// ============================================================
// WATCHERS de los jefes opcionales 14-a (llamado 1×/frame desde update.ts,
// barato: primero filtra por mapa).
//   · VULT: Cumbres de NOCHE con contenido posterior a q11 (questIdx>=11).
//     Caza al Portador una sola vez (vultDefeated lo cierra para siempre).
//     El guard de "ya hay un vult vivo" hace el spawn auto-saneable: si
//     sales del mapa y vuelves, reaparece entero (jefe OPCIONAL de caza,
//     sin memoria de hp — decisión documentada).
//   · EL CORO ROTO: Cripta con acto3Done + Guardián recordado descansado.
//     Despierta cuando el Portador se acerca al altar libre (200 px).
// La barra/banner los pintan los mecanismos ya existentes (bossRef/
// bossActive + cerebros), al estilo update.ts:398 y hooks.acto3_subir.
// ============================================================
export function expansionBossWatchers(g: Game): void {
  if (g.state !== 'play' || !g.player) return;
  const p = g.player;

  // ---- activación de la barra de jefe al acercarte (vult) ----
  const vult = g.mapId === 'cumbres' ? g.enemies.find(e => e.etype === T_VULT && !e.dead) : undefined;
  if (vult && !g.bossActive) {
    g.bossRef = vult;
    if (dist(p.x, p.y, vult.x, vult.y) < 190) { g.bossActive = true; audio.playTrack('boss'); }
  }

  // ---- activación de la barra de jefe al acercarte (coro) ----
  const coro = g.mapId === 'cripta' ? g.enemies.find(e => e.etype === T_CORO && !e.dead) : undefined;
  if (coro && !g.bossActive) {
    g.bossRef = coro;
    if (dist(p.x, p.y, coro.x, coro.y) < 190) { g.bossActive = true; audio.playTrack('boss'); }
  }

  // ---- spawn de VULT (Cumbres de noche, tras q11) ----
  if (g.mapId === 'cumbres' && !g.flags.vultDefeated
      && !g.enemies.some(e => e.etype === T_VULT && !e.dead)
      && g.questIdx >= 11 && isNightG(g)) {
    const v = g.makeEnemy('vult', p.x, p.y, 2, 'boss');
    // colócalo a distancia de caza (makeEnemy lo creó sobre el Portador)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + g.globalT;
      const x = p.x + Math.cos(a) * 170, y = p.y + Math.sin(a) * 170;
      if (!g.tileSolidAt(x, y)) { v.x = x; v.y = y; v.homeX = x; v.homeY = y; break; }
    }
    v.spawnGuard = 0.2;
    g.enemies.push(v);
    g.burst(v.x, v.y, '#c8b0e8', 20, 90);
    audio.sfx('whoosh');
    g.toast('Las cumbres susurran: hay un cazador en la noche', '#c8b0e8');
  }

  // ---- spawn de EL CORO ROTO (Cripta, post-Acto III) ----
  if (g.mapId === 'cripta' && g.flags.acto3Done && g.flags.guardianRecordadoDerrotado
      && !g.flags.coroDefeated && !g.enemies.some(e => e.etype === T_CORO && !e.dead)) {
    const altar = g.map.props.find(pr => pr.id === 'altar_c');
    const ax = (altar ? altar.x : 19) * 16 + 8; // TILE=16, constante del proyecto
    const ay = (altar ? altar.y + 4 : 8) * 16 + 8;
    if (dist(p.x, p.y, ax, ay) < 200) {
      const c = g.makeEnemy('coro', ax, ay, 0, 'boss');
      g.enemies.push(c);
      g.burst(ax, ay, '#c8b0e8', 24, 100);
      g.shake = 8;
      g.toast('El altar libre canta al revés... EL CORO ROTO despierta', '#c8b0e8');
    }
  }
}

// ============================================================
// ENTRADA ÚNICA — se llama AL PASAR por los 5 tipos nuevos;
// true = frame gestionado por completo (el motor salta su IA).
// ============================================================

export function expansionTick(g: Game, e: Enemy, dt: number, def: EnemyDef): boolean {
  switch (e.etype) {
    case 'neumo': return tickNeumo(g, e, dt, def, mem(e));
    case 'espectro': return tickEspectro(g, e, dt, def, mem(e));
    case 'arpi': return tickArpi(g, e, dt, def, mem(e));
    case 'sirena': return tickSirena(g, e, dt, def, mem(e));
    case 'golem': return tickGolem(g, e, dt, def, mem(e));
    case 'vult': return tickVult(g, e, dt, def, mem(e)); // 14-a
    case 'coro': return tickCoro(g, e, dt, def, mem(e)); // 14-a
    case 'ecodesg': return tickEcodesg(g, e, dt, def, mem(e)); // 14-a
    case 'satiro': return tickSatiro(g, e, dt, def, mem(e)); // 14-a
    default: return false; // tipos base: IA genérica del motor
  }
}
