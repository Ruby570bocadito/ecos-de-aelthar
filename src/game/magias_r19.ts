// ============================================================
// ECOS DE AELTHAR — SISTEMA DE MAGIAS CON MENÚ (19-b)
// Grimorio de 6 magias (2 escuelas: alba/tejedor) + loadout de
// 4 slots + lanzamiento con cooldown + pestaña MAGIAS de pausa.
// Módulo 100% ADITIVO: no edita ningún fichero ajeno.
// ============================================================
//
// PUNTOS DE CABLEADO PARA EL INTEGRADOR (nombres exactos):
// -----------------------------------------------------
// (1) pestaña en pausa — screens.ts:349:
//       const TABS = ['ESTADO', 'EQUIPO', 'DIARIO', 'SISTEMA', 'MAGIAS'];
//     y en la línea 366 de screens.ts ampliar el cast del click de pestaña:
//       () => { g.pauseTab = i as 0 | 1 | 2 | 3 | 4; }
//     y en engine.ts:174 ampliar el campo (necesario para que compile):
//       pauseTab: 0 | 1 | 2 | 3 | 4 = 0;
// (2) rama de dibujo — screens.ts · drawPause, justo ANTES del `} else {`
//     de SISTEMA (línea ~516; el último `else if` actual es `pauseTab === 2`):
//       } else if (g.pauseTab === 4) {
//         drawMagiasPanelR19(g, cx, cy, pw - 56);   // 19-b: pestaña MAGIAS
//       }
//     (cx = px + 28, cy = py + 92; pw - 56 = 664 px de ancho; devuelve alto
//      usado ~304 px, cabe de sobra en el panel de 470 px.)
// (3) tick — update.ts:389, justo tras `cumbresBiomaTick(g, dt);`:
//       magiasTickR19(g, dt);   // 19-b: cooldowns/buffs/aura de magias
//     + import { magiasTickR19 } from './magias_r19';
// (4) hotkeys — engine.ts:1459 (zona input, `['1','2','3','4']` ya está
//     TOMADA por useSkill). Dos opciones documentadas:
//       a) RECOMENDADA — magias en 5-8:
//            else if (['5', '6', '7', '8'].includes(k)) castMagiaR19(this, parseInt(k, 10) - 5);
//       b) si el diseño final quiere 1-4 para magias, re-rutear useSkill a
//          Shift+1..4 y usar parseInt(k)-1. La API de este módulo es la misma.
//     Tecla M para abrir la pestaña directamente (misma zona de input):
//            else if (k === 'm') { this.pauseTab = 4; this.setState('pause'); audio.sfx('uiOpen'); }
// (5) init — engine.ts constructor (~línea 203, tras initFaroSprites()):
//       initMagiasR19();   // 19-b: registra el sprite 'vendaval_p'
//     (opcional: castMagiaR19/draw llaman initMagiasR19() perezosamente).
// (6) OPCIONAL — absorción de Eco Escudo: engine.damagePlayer (engine.ts:1931),
//     primera línea del método:
//       dmg = ecoEscudoAbsorbR19(this, dmg);   // 19-b: escudo absorbe 40
//     Si NO se cablea, el escudo solo daña-visualiza (el buff caduca igual
//     y no rompe nada); con él, absorbe daño exactamente 1 vez por punto.
// (7) OPCIONAL — +20% velocidad del Estandarte: ya lo aplica magiasTickR19
//     (empuje proporcional con moveEntity, respeta colisiones). NO añadir
//     TAMBIÉN el multiplicador en update.ts:197 o se sumaría dos veces.
//     Alternativa preferida del integrador (elige UNA):
//       update.ts:197 → const spd = 74 * (Number(g.flags['estandarte_t']) > 0 ? 1.2 : 1);
//       y desactivar el boost de mi tick (ver ESTANDARTE_BOOST en magiasTickR19).
// (8) OPCIONAL — vendaval perforante: update.ts:455 hoy mata el proyectil al
//     primer impacto (el campo pierce existe pero el motor lo ignora). Para
//     honrarlo, en update.ts (bloque proyectiles, tras damageEnemy):
//       dead = pr.pierce-- <= 0;   // 19-b: vendaval atraviesa 2 enemigos
//     Sin esa línea el Vendaval funciona normal (1 impacto).
//
// DECISIONES DOCUMENTADAS (desviaciones del enunciado, verificadas en fuente):
//  · p.cds NO es un Record: es number[] (types.ts:163, índices de useSkill).
//    Los cooldowns de magias viven en flags numéricos 'magia_cd_<id>'
//    (serializan solos en save(), engine.ts:470).
//  · Los ids de magia de los slots ('magia_slot_0..3') son STRINGS en flags.
//    El tipo público dice number|boolean; se escribe con cast localizado y
//    es seguro: save() hace spread+JSON (engine.ts:470) y continueGame
//    restaura Object-spread (engine.ts:424) — los strings viajan intactos.
//  · Aura del Estandarte: usa g.damageEnemy (embudo público del motor, mismo
//    patrón que skilltree.ts:720) para golpear a TODOS los enemigos en radio;
//    el enunciado sugería un proyectil invisible, pero el bucle de proyectiles
//    muere en el primer impacto (update.ts:448-456) y solo golpearía a 1.
//  · Nota de Hielo Mayor: g.aoeHit público (engine.ts:1709) + slowT=3 manual.
//  · Sprite 'vendaval_p': registrado vía registerSpr (sprites.ts:692, hoja
//    sin ciclos). render.ts:577 no lo conoce aún → cae al else (cuadradito
//    4px) hasta que el integrador añada la rama del punto (8); mientras
//    tanto mi tick le da estela propia de partículas (visual digno).
//
// DETERMINISMO: cero Math.random en este módulo (fases por Math.sin/cos de
// g.globalT e índices). Estado por partida en WeakMap (HMR/multi-instancia).
// ============================================================

import type { Game } from './engine';
import type { Enemy, Element, Player } from './types';
import { COL, text, textShadow, panel, bar, wrapText, addHit, button } from './ui';
import { registerSpr, getSpr } from './sprites';
import { audio } from './audio'; // llamado SOLO dentro de funciones

// ---------------- tabla del grimorio ----------------

export interface MagiaDef {
  id: string;                       // id de flag de slot / cooldown
  nombre: string;
  escuela: 'alba' | 'tejedor';
  element: Element;                 // elemento de daño ('ninguno' = puro apoyo)
  cd: number;                       // cooldown en segundos
  desc: string;
  color: string;                    // color de icono/acentos en UI
  letra: string;                    // letra estilizada del icono
}

export const MAGIAS_R19: MagiaDef[] = [
  {
    id: 'canto_curativo', nombre: 'Canto Curativo', escuela: 'alba',
    element: 'sagrado', cd: 45, color: '#ffe9b0', letra: 'C',
    desc: 'Un acorde cálido recorre las cicatrices: cura al instante un 35% de tu vida máxima.',
  },
  {
    id: 'vendaval', nombre: 'Vendaval del Alba', escuela: 'alba',
    element: 'sagrado', cd: 6, color: '#d8e8f8', letra: 'V',
    desc: 'Luz enhiesta en forma de viento: proyectil perforante (atraviesa 2 enemigos). Daño 18 + esp×1,2.',
  },
  {
    id: 'estandarte', nombre: 'Estandarte del Alba', escuela: 'alba',
    element: 'sagrado', cd: 40, color: '#f0c84a', letra: 'E',
    desc: '8 s de estandarte étreo: +20% de velocidad y un aura que quema 4/s a 70 px (la luz del alba arde).',
  },
  {
    id: 'nota_hielo', nombre: 'Nota de Hielo', escuela: 'tejedor',
    element: 'hielo', cd: 8, color: '#a0e8ff', letra: 'N',
    desc: 'Una nota cristalizada: proyectil que congela (estado congelado del motor). Daño 14.',
  },
  {
    id: 'nota_hielo_mayor', nombre: 'Nota de Hielo Mayor', escuela: 'tejedor',
    element: 'hielo', cd: 18, color: '#68b8f0', letra: 'N',
    desc: 'Nova de escarcha en radio 90: 26 de daño, congela y deja lentos 3 s a todos los alcanzados.',
  },
  {
    id: 'eco_escudo', nombre: 'Eco Escudo', escuela: 'tejedor',
    element: 'ninguno', cd: 35, color: '#9fe8c0', letra: 'S',
    desc: '6 s de capas de eco repetido: un escudo que absorbe los primeros 40 puntos de daño.',
  },
];

export function magiaDefR19(id: string): MagiaDef | null {
  return MAGIAS_R19.find(m => m.id === id) ?? null;
}

const ESCUELA_COLOR: Record<'alba' | 'tejedor', string> = {
  alba: '#f0c84a',
  tejedor: '#a0e8ff',
};

// ---------------- estado por partida (WeakMap) ----------------

interface MagiasRT {
  selSlot: number;      // slot abierto en la UI (-1 = ninguno)
  selMagia: string;     // magia mostrada en la caja de descripción
  auraAcc: number;      // acumulador del aura del Estandarte (pulso 1/s)
  orbitAcc: number;     // acumulador de partículas del Eco Escudo
  lastX: number;        // posición previa del Portador (boost Estandarte)
  lastY: number;
  lastOk: boolean;
  trailPhase: number;   // fase determinista de la estela del Vendaval
}

const RT = new WeakMap<object, MagiasRT>();

function rt(g: Game): MagiasRT {
  let r = RT.get(g);
  if (!r) {
    r = { selSlot: -1, selMagia: '', auraAcc: 0, orbitAcc: 0, lastX: 0, lastY: 0, lastOk: false, trailPhase: 0 };
    RT.set(g, r);
  }
  return r;
}

// ---------------- flags: slots, cooldowns, gate ----------------

const SLOT_FLAGS = ['magia_slot_0', 'magia_slot_1', 'magia_slot_2', 'magia_slot_3'];
const CD_PREFIX = 'magia_cd_';

/** Flags de slot como strings (excepción documentada en la cabecera). */
type FlagBox = Record<string, number | boolean | string>;

/** Gate del grimorio: requiere el Tomo del Canto (secundaria sq6, agente 19-a). */
export function magiasGateR19(g: Game): boolean {
  return g.flags['tomo_canto'] === true;
}

/** Id de magia equipada en un slot ('' = vacío). */
export function magiaSlotR19(g: Game, slot: number): string {
  if (slot < 0 || slot >= 4) return '';
  const v = (g.flags as FlagBox)[SLOT_FLAGS[slot]];
  return typeof v === 'string' ? v : '';
}

/** Equipa/quita una magia de un slot. Devuelve true si el cambio se aplicó. */
export function setMagiaSlotR19(g: Game, slot: number, id: string): boolean {
  if (slot < 0 || slot >= 4) return false;
  if (id !== '' && !magiaDefR19(id)) return false;
  (g.flags as FlagBox)[SLOT_FLAGS[slot]] = id;
  return true;
}

/** Segundos restantes de cooldown de una magia (0 = lista). */
export function magiaCdLeftR19(g: Game, id: string): number {
  const v = g.flags[CD_PREFIX + id];
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return n > 0 ? n : 0;
}

function magiaCdSet(g: Game, id: string, secs: number): void {
  g.flags[CD_PREFIX + id] = Math.max(0, secs);
}

// ---------------- cast ----------------

const DIRS: Record<string, [number, number]> = {
  down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0],
};

function finite(n: number): boolean {
  return Number.isFinite(n);
}

/**
 * Lanza la magia equipada en `slotIdx` (0..3, hotkeys 1-4/5-8 del integrador).
 * Devuelve true si se lanzó; false si no hay gate/slot/cd o el estado no es
 * 'play'. El coste de cada magia es su cooldown (sin coste de resonancia).
 */
export function castMagiaR19(g: Game, slotIdx: number): boolean {
  initMagiasR19();
  if (g.state !== 'play') return false;
  const p: Player | null = g.player;
  if (!p || !finite(p.x) || !finite(p.y)) return false;
  if (slotIdx < 0 || slotIdx >= 4) return false;
  if (!magiasGateR19(g)) {
    g.toast('El Tomo del Canto duerme: tus dedos no recuerdan esa melodía', COL.dim);
    audio.sfx('error');
    return false;
  }
  const id = magiaSlotR19(g, slotIdx);
  if (!id) {
    g.toast(`Slot ${slotIdx + 1} vacío: equipa una magia en el menú (M)`, COL.dim);
    audio.sfx('error');
    return false;
  }
  const def = magiaDefR19(id);
  if (!def) return false;
  const left = magiaCdLeftR19(g, id);
  if (left > 0) {
    g.toast(`${def.nombre}: aún en recarga (${left.toFixed(1)} s)`, '#9aa0b8');
    audio.sfx('error');
    return false;
  }
  magiaCdSet(g, id, def.cd);

  switch (id) {
    case 'canto_curativo': {
      const cura = Math.round(p.maxHp * 0.35);
      const antes = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + cura);
      const real = Math.round(p.hp - antes);
      g.floatAt(p.x, p.y - 22, `+${real}`, '#8ef0b0', 8);
      g.burst(p.x, p.y - 6, '#ffe9b0', 14, 50);
      audio.sfx('holy');
      break;
    }
    case 'vendaval': {
      g.aimAtMouse();
      const [dx, dy] = DIRS[p.dir] ?? [1, 0];
      const dmg = Math.round(18 + p.attrs.esp * 1.2);
      g.projectiles.push({
        x: p.x + dx * 8, y: p.y - 6 + dy * 8,
        vx: dx * 240, vy: dy * 240,
        t: 1.2, dmg, element: 'sagrado', from: 'player',
        sprite: 'vendaval_p', radius: 5, pierce: 2,
      });
      g.burst(p.x + dx * 10, p.y - 6 + dy * 10, '#ffe9b0', 5, 40);
      audio.sfx('gust');
      break;
    }
    case 'estandarte': {
      g.flags['estandarte_t'] = 8;
      g.waves.push({ x: p.x, y: p.y, r: 6, maxR: 70, speed: 130, dmg: 0, hit: true });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        g.particles.push({
          x: p.x + Math.cos(a) * 10, y: p.y - 8 + Math.sin(a) * 6,
          vx: Math.cos(a) * 26, vy: -34 - (i % 3) * 8,
          t: 0.7, maxT: 0.7, color: i % 2 ? '#f0c84a' : '#ffe9b0', size: 2, grav: 0,
        });
      }
      g.floatAt(p.x, p.y - 24, 'ESTANDARTE DEL ALBA', '#f0c84a', 7);
      audio.sfx('banner');
      break;
    }
    case 'nota_hielo': {
      g.aimAtMouse();
      const [dx, dy] = DIRS[p.dir] ?? [1, 0];
      g.projectiles.push({
        x: p.x + dx * 8, y: p.y - 6 + dy * 8,
        vx: dx * 200, vy: dy * 200,
        t: 1.4, dmg: 14, element: 'hielo', from: 'player',
        sprite: 'nota', radius: 5, pierce: 0,
      });
      audio.sfx('ice');
      break;
    }
    case 'nota_hielo_mayor': {
      // nova de escarcha centrada en el Portador: daño + congelado (motor) + slowT propio
      g.aoeHit(p.x, p.y, 90, 26, 'hielo', false);
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 90 + e.w / 2) e.slowT = Math.max(e.slowT, 3);
      }
      g.waves.push({ x: p.x, y: p.y, r: 6, maxR: 90, speed: 170, dmg: 0, hit: true });
      g.waves.push({ x: p.x, y: p.y, r: 3, maxR: 64, speed: 120, dmg: 0, hit: true });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.3;
        g.particles.push({
          x: p.x + Math.cos(a) * 12, y: p.y - 4 + Math.sin(a) * 12,
          vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 10,
          t: 0.55, maxT: 0.55, color: i % 2 ? '#a0e8ff' : '#e8f8ff', size: 1.8, grav: 0,
        });
      }
      audio.sfx('ice');
      audio.sfx('splash');
      break;
    }
    case 'eco_escudo': {
      g.flags['eco_escudo_t'] = 6;
      g.flags['eco_escudo_hp'] = 40;
      g.floatAt(p.x, p.y - 24, 'ECO ESCUDO', '#9fe8c0', 7);
      g.burst(p.x, p.y - 6, '#9fe8c0', 10, 44);
      audio.sfx('echo');
      break;
    }
    default:
      return false;
  }
  return true;
}

/**
 * Absorción del Eco Escudo para engine.damagePlayer (cable opcional (6)).
 * Devuelve el daño que ATRAVIESA el escudo; el resto lo absorbe.
 */
export function ecoEscudoAbsorbR19(g: Game, dmg: number): number {
  const t = typeof g.flags['eco_escudo_t'] === 'number' ? (g.flags['eco_escudo_t'] as number) : 0;
  const hp = typeof g.flags['eco_escudo_hp'] === 'number' ? (g.flags['eco_escudo_hp'] as number) : 0;
  if (t <= 0 || hp <= 0 || dmg <= 0) return dmg;
  const absorbe = Math.min(hp, dmg);
  const queda = hp - absorbe;
  if (queda <= 0) {
    g.flags['eco_escudo_t'] = 0;
    g.flags['eco_escudo_hp'] = 0;
    g.burst(g.player?.x ?? 0, (g.player?.y ?? 0) - 6, '#9fe8c0', 12, 60);
    audio.sfx('break');
  } else {
    g.flags['eco_escudo_hp'] = queda;
  }
  return dmg - absorbe;
}

// ---------------- tick ----------------

const ESTANDARTE_BOOST = true; // ver punto (7) de la cabecera antes de tocar
const AURA_R = 70;
const AURA_DPS = 4;

/**
 * Tick de magias: decae cooldowns y buffs (estandarte/eco_escudo), gestiona
 * el aura del Estandarte (pulso 1/s en radio 70 vía damageEnemy del motor),
 * el boost de velocidad del Estandarte, la estela del Vendaval y las
 * partículas orbitales del Eco Escudo. O(enemigos visibles), cero GC por frame.
 */
export function magiasTickR19(g: Game, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const p = g.player;
  if (!p || g.state !== 'play') return;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { const r = rt(g); r.lastOk = false; return; }
  initMagiasR19();
  const r = rt(g);

  // 1) cooldowns (lista fija de 6 ids → O(1))
  for (const m of MAGIAS_R19) {
    const left = magiaCdLeftR19(g, m.id);
    if (left > 0) magiaCdSet(g, m.id, Math.max(0, left - dt));
  }

  // 2) buffs del Estandarte y del Eco Escudo
  const estT = typeof g.flags['estandarte_t'] === 'number' ? (g.flags['estandarte_t'] as number) : 0;
  const escT = typeof g.flags['eco_escudo_t'] === 'number' ? (g.flags['eco_escudo_t'] as number) : 0;
  if (escT > 0) {
    g.flags['eco_escudo_t'] = Math.max(0, escT - dt);
    if ((g.flags['eco_escudo_t'] as number) === 0) g.flags['eco_escudo_hp'] = 0;
  }

  // 3) aura del Estandarte: pulso cada 1 s a todos los enemigos en radio
  if (estT > 0) {
    g.flags['estandarte_t'] = Math.max(0, estT - dt);
    r.auraAcc += dt;
    if (r.auraAcc >= 1) {
      r.auraAcc -= 1;
      let golpeado = false;
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < AURA_R + e.w / 2) {
          g.damageEnemy(e, AURA_DPS, 'sagrado', 0); // embudo del motor: weakTo/crit/hitFlash
          golpeado = true;
        }
      }
      g.waves.push({ x: p.x, y: p.y, r: 4, maxR: AURA_R, speed: 110, dmg: 0, hit: true });
      if (golpeado && g.particles.length < 200) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + g.globalT * 1.7;
          g.particles.push({
            x: p.x + Math.cos(a) * AURA_R * 0.8, y: p.y - 4 + Math.sin(a) * AURA_R * 0.8,
            vx: 0, vy: -14, t: 0.4, maxT: 0.4, color: '#f0c84a', size: 1.6, grav: 0,
          });
        }
      }
    }
    // 4) boost de velocidad +20%: empuje proporcional al desplazamiento real
    //    del frame (74 px/s de referencia), con moveEntity → respeta colisiones.
    if (ESTANDARTE_BOOST) {
      const dx = p.x - r.lastX, dy = p.y - r.lastY;
      const v = Math.hypot(dx, dy) / Math.max(1e-4, dt);
      const sinKb = (p.kbVx ?? 0) === 0 && (p.kbVy ?? 0) === 0;
      if (r.lastOk && sinKb && p.moving && p.rollT <= 0 && p.attackT <= 0 && v > 20 && v < 130) {
        const extra = Math.min(3, 74 * 0.2 * dt); // cap anti-teleport con dt grandes
        const len = Math.max(1e-4, Math.hypot(dx, dy));
        g.moveEntity(p, (dx / len) * extra, (dy / len) * extra);
      }
    }
    // partículas del estandarte sobre el Portador
    if (g.particles.length < 210 && Math.sin(g.globalT * 9) > 0.3) {
      g.particles.push({
        x: p.x + Math.sin(g.globalT * 5.1) * 8, y: p.y - 14,
        vx: 0, vy: -22, t: 0.5, maxT: 0.5, color: '#f0c84a', size: 1.5, grav: 0,
      });
    }
  }

  // 5) Eco Escudo: capa orbital determinista
  if (escT > 0 && g.particles.length < 220) {
    r.orbitAcc += dt;
    if (r.orbitAcc >= 0.12) {
      r.orbitAcc = 0;
      const a = g.globalT * 2.4;
      g.particles.push({
        x: p.x + Math.cos(a) * 13, y: p.y - 6 + Math.sin(a) * 9,
        vx: 0, vy: 0, t: 0.3, maxT: 0.3, color: '#9fe8c0', size: 1.6, grav: 0,
      });
    }
  }

  // 6) estela del Vendaval (mientras vuele algún proyectil propio)
  let hayVendaval = false;
  for (const pr of g.projectiles) {
    if (pr.sprite === 'vendaval_p') { hayVendaval = true; break; }
  }
  if (hayVendaval && g.particles.length < 220) {
    r.trailPhase += dt * 26;
    const s = Math.sin(r.trailPhase);
    for (const pr of g.projectiles) {
      if (pr.sprite !== 'vendaval_p') continue;
      g.particles.push({
        x: pr.x + s * 4, y: pr.y + Math.cos(r.trailPhase * 0.7) * 4,
        vx: -s * 10, vy: 0, t: 0.3, maxT: 0.3, color: '#d8c890', size: 1.4, grav: 0,
      });
      break; // 1 partícula/frame: estela ligera y acotada
    }
  }

  // 7) memoria de posición SIEMPRE al final (mide el delta del frame siguiente)
  r.lastX = p.x; r.lastY = p.y; r.lastOk = true;
}

// ---------------- sprite del Vendaval ----------------

let inited = false;

/** Creciente de viento 12×12 en tonos del alba (determinista, 1 frame). */
function buildVendavalSpr(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 12; cv.height = 12;
  const c = cv.getContext('2d');
  if (c) {
    c.strokeStyle = '#ffe9b0';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(6, 6, 4.5, -2.2, 2.2);
    c.stroke();
    c.strokeStyle = '#d8c890';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(5, 6, 2.8, -1.6, 1.6);
    c.stroke();
    c.fillStyle = '#fffdf2';
    c.fillRect(9, 5, 2, 2);
  }
  return cv;
}

/** Idempotente: registra el sprite 'vendaval_p' en sprites.ts. */
export function initMagiasR19(): void {
  if (inited) return;
  inited = true;
  // getSpr cae a 'hero_alba' si no existe → comparar identidad para idempotencia real
  if (getSpr('vendaval_p') !== getSpr('__magias_probe__')) return; // ya registrado por otra instancia
  registerSpr('vendaval_p', [buildVendavalSpr()]);
}

// ---------------- UI: pestaña MAGIAS ----------------

const SLOT_SIZE = 54;
const SLOT_STEP = 68;
const ROW_H = 30;

function cdPct(g: Game, id: string): number {
  const def = magiaDefR19(id);
  if (!def) return 0;
  return Math.min(1, magiaCdLeftR19(g, id) / def.cd);
}

/**
 * Panel completo de la pestaña MAGIAS de la pausa (solo-lectura salvo los
 * clicks de slots/grimorio, que mutan flags con addHit como el resto del
 * juego). Devuelve el alto usado (~304 px con w = 664).
 * Contrato: drawMagiasPanelR19(g, cx, cy, pw - 56) desde drawPause rama 4.
 */
export function drawMagiasPanelR19(g: Game, x: number, y: number, w: number): number {
  initMagiasR19();
  const ctx = g.ctx;
  const r = rt(g);

  // ---- GATE: sin el Tomo del Canto ----
  if (!magiasGateR19(g)) {
    const h = 168;
    panel(g, x, y, w, h, '#3a4a42');
    ctx.strokeStyle = 'rgba(159,232,192,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);
    textShadow(g, 'EL TOMO DEL CANTO DUERME…', x + w / 2, y + 26, 15, COL.goldSoft, '#000', 'center', true);
    // brillos deterministas alrededor del título (7 puntos, fase por globalT)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.sin(g.globalT * 0.8) * 0.4;
      const rr = 118 + Math.sin(g.globalT * 1.3 + i) * 5;
      const sx = x + w / 2 + Math.cos(a) * rr * 1.6;
      const sy = y + 34 + Math.sin(a) * 26;
      ctx.fillStyle = i % 2 ? 'rgba(255,233,176,0.5)' : 'rgba(159,232,192,0.4)';
      ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
    }
    text(g, '«Las páginas no responden a manos que aún no han escuchado el eco.»', x + w / 2, y + 66, 14, COL.dim, 'center');
    text(g, 'Un custodio de la cripta busca a quien despierte las lámparas del eco.', x + w / 2, y + 92, 14, '#9fe8c0', 'center');
    text(g, '(Secundaria de la Cripta del Primer Canto: enciende las lámparas y habla con él)', x + w / 2, y + 110, 13, 'rgba(154,160,184,0.75)', 'center');
    text(g, `Slots del destino: ${SLOT_FLAGS.length} · magias aguardan tras el sello`, x + w / 2, y + h - 26, 13, 'rgba(154,160,184,0.5)', 'center');
    return h + 4;
  }

  // ---- cabecera ----
  textShadow(g, 'GRIMORIO DEL PORTADOR', x, y, 14, COL.gold, '#000', 'left', true);
  text(g, 'lanza con las teclas 5-8 (slot 1-4) · o pulsa M aquí', x + w, y + 2, 13, COL.dim, 'right');

  // ---- 4 slots grandes ----
  const sy0 = y + 24;
  for (let i = 0; i < 4; i++) {
    const sx = x + i * SLOT_STEP;
    const sy = sy0;
    const id = magiaSlotR19(g, i);
    const def = magiaDefR19(id);
    const abierto = r.selSlot === i;
    const hover = addHit(g, sx, sy, SLOT_SIZE, SLOT_SIZE, () => {
      r.selSlot = abierto ? -1 : i;
      r.selMagia = id;
      audio.sfx('select');
    });
    panel(g, sx, sy, SLOT_SIZE, SLOT_SIZE,
      abierto ? COL.gold : hover ? '#8a7448' : def ? ESCUELA_COLOR[def.escuela] : COL.panelBorder,
      abierto ? 'rgba(60,48,24,0.9)' : def ? 'rgba(22,26,20,0.92)' : COL.panel);
    if (def) {
      // letra estilizada + aro de escuela
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx + SLOT_SIZE / 2, sy + 22, 14, 0, Math.PI * 2);
      ctx.stroke();
      textShadow(g, def.letra, sx + SLOT_SIZE / 2, sy + 12, 17, def.color, '#000', 'center', true);
      const pct = cdPct(g, id);
      if (pct > 0) {
        bar(g, sx + 4, sy + SLOT_SIZE - 9, SLOT_SIZE - 8, 4, pct, '#e05548', '#3a1a18');
        text(g, `${magiaCdLeftR19(g, id).toFixed(1)}`, sx + SLOT_SIZE / 2, sy + SLOT_SIZE - 26, 12, '#fff', 'center');
      } else {
        bar(g, sx + 4, sy + SLOT_SIZE - 9, SLOT_SIZE - 8, 4, 1, 'rgba(142,240,176,0.35)', '#1c2e18');
      }
    } else {
      text(g, '·', sx + SLOT_SIZE / 2, sy + 16, 20, 'rgba(154,160,184,0.45)', 'center');
      text(g, 'vacío', sx + SLOT_SIZE / 2, sy + 34, 12, 'rgba(154,160,184,0.5)', 'center');
    }
    text(g, `SLOT ${i + 1}`, sx + SLOT_SIZE / 2, sy + SLOT_SIZE + 3, 11, abierto ? COL.gold : COL.dim, 'center', true);
  }

  // ---- grimorio en 2 columnas ----
  const gy0 = sy0 + SLOT_SIZE + 26;
  text(g, r.selSlot >= 0
    ? `ELIGE UNA MAGIA PARA EL SLOT ${r.selSlot + 1}`
    : 'GRIMORIO · ALBA ◆ TEJEDOR',
    x, gy0 - 6, 13, r.selSlot >= 0 ? COL.goldSoft : COL.gold, 'left', true);
  const colW = Math.floor((w - 8) / 2);
  for (let i = 0; i < MAGIAS_R19.length; i++) {
    const m = MAGIAS_R19[i];
    const rx = x + (i % 2) * (colW + 8);
    const ry = gy0 + 10 + Math.floor(i / 2) * ROW_H;
    const equipado = magiaSlotR19(g, 0) === m.id || magiaSlotR19(g, 1) === m.id
      || magiaSlotR19(g, 2) === m.id || magiaSlotR19(g, 3) === m.id;
    const hover = addHit(g, rx, ry, colW, ROW_H - 4, () => {
      if (r.selSlot >= 0) {
        const slotDst = r.selSlot; // capturar antes de cerrar la lista
        setMagiaSlotR19(g, slotDst, m.id);
        r.selMagia = m.id;
        r.selSlot = -1;
        audio.sfx('confirm');
        g.toast(`${m.nombre} equipada en el slot ${slotDst + 1}`, COL.goldSoft);
      } else {
        r.selMagia = r.selMagia === m.id ? '' : m.id;
        audio.sfx('blip');
      }
    });
    // fondo de fila
    ctx.fillStyle = hover ? 'rgba(60,48,24,0.6)' : 'rgba(20,24,34,0.6)';
    ctx.fillRect(rx, ry, colW, ROW_H - 4);
    ctx.strokeStyle = hover ? m.color : 'rgba(90,74,48,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 0.5, ry + 0.5, colW - 1, ROW_H - 5);
    // icono letra
    ctx.fillStyle = m.color;
    ctx.fillRect(rx + 5, ry + 7, 14, 14);
    text(g, m.letra, rx + 12, ry + 6, 13, '#141414', 'center', true);
    text(g, m.nombre, rx + 26, ry + 3, 14, equipado ? COL.goldSoft : COL.text);
    text(g, m.escuela === 'alba' ? '◆ alba' : '❄ tejedor', rx + 26, ry + 15, 11, ESCUELA_COLOR[m.escuela]);
    // cooldown como barra + estado
    const pct = cdPct(g, m.id);
    if (pct > 0) {
      bar(g, rx + colW - 66, ry + 5, 56, 4, pct, '#e05548', '#3a1a18');
      text(g, `${magiaCdLeftR19(g, m.id).toFixed(1)}s`, rx + colW - 38, ry + 11, 11, '#fff', 'center');
    } else {
      text(g, equipado ? 'EQUIPADA' : 'lista', rx + colW - 8, ry + 8, 11,
        equipado ? COL.goldSoft : 'rgba(142,240,176,0.7)', 'right');
    }
  }

  // ---- caja de descripción ----
  const dy0 = gy0 + 10 + 3 * ROW_H + 6;
  const dh = 84;
  panel(g, x, dy0, w, dh);
  const sel = r.selMagia ? magiaDefR19(r.selMagia) : null;
  if (sel) {
    textShadow(g, sel.nombre, x + 12, dy0 + 8, 13, sel.color, '#000', 'left', true);
    text(g, `escuela ${sel.escuela.toUpperCase()} · CD ${sel.cd} s · elemento ${sel.element}`,
      x + 12, dy0 + 26, 12, COL.dim);
    const lineas = wrapText(sel.desc, Math.floor((w - 140) / 6.2));
    for (let i = 0; i < Math.min(2, lineas.length); i++) {
      text(g, lineas[i], x + 12, dy0 + 42 + i * 16, 14, COL.text);
    }
  } else {
    text(g, 'SELECCIONA UNA MAGIA', x + 12, dy0 + 8, 13, COL.gold, 'left', true);
    text(g, 'Click en una fila del grimorio para ver su detalle.', x + 12, dy0 + 28, 14, COL.dim);
    text(g, 'Click en un slot para abrir la lista y asignar (click de nuevo para cerrar).', x + 12, dy0 + 46, 14, COL.dim);
  }
  // botones QUITAR / CERRAR a la derecha de la caja
  if (r.selSlot >= 0) {
    const ocupado = magiaSlotR19(g, r.selSlot);
    if (ocupado) {
      button(g, 'QUITAR', x + w - 116, dy0 + 8, 104, 22, () => {
        setMagiaSlotR19(g, r.selSlot, '');
        r.selMagia = '';
        audio.sfx('blip');
      }, 11, '#ff7060');
    }
    button(g, 'CERRAR', x + w - 116, dy0 + 36, 104, 22, () => {
      r.selSlot = -1;
      audio.sfx('blip');
    }, 11);
  } else if (r.selMagia) {
    const actual = [0, 1, 2, 3].find(i => magiaSlotR19(g, i) === r.selMagia);
    text(g, actual !== undefined ? `equipada en el slot ${actual + 1}` : 'sin equipar',
      x + w - 12, dy0 + dh - 20, 12, actual !== undefined ? COL.goldSoft : COL.dim, 'right');
  }

  return dy0 + dh - y + 4;
}
