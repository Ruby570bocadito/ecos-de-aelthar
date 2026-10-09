// ============================================================
// ECOS DE AELTHAR — R13 «La carta» · LA CUNA DEL CANTO (Acto V fase 1)
// Mecánica propia del mapa nuevo, sin tocar update.ts ni worldlife:
//
//  1) EL RITMO DEL AÚN (biblia 14.2: «el aire suena solo si sabes
//     caminar al ritmo»). En 'aun', caminar sobre el camino '=' acumula
//     compás; cada 3 tiles andados suena UNA nota (partícula musical con
//     palito, estilo 13-c; el sfx suena cada 2ª nota para no cansar).
//     Pisar fuera del camino rompe el compás: la Cuna no improvisa.
//
//  2) LA ESTRENA DEL PRIMER DÍA (biblia 14.2/14.4). La primera vez que
//     el Portador aterriza en 'presente' en la Cuna, el mundo estrena
//     su primer día: flash dorado, onda expansiva sin daño, ráfaga de
//     notas ascendentes, textos escalonados y — lo importante — los
//     neumos del primer día NACEN en el acto (spawnEnemies corrió en
//     'aun', cuando aún no existían). Guard cunaEstrenada: una vez.
//     Si q17 está en su paso del Fragmento y ya despertó, completa el
//     objetivo (idempotente con acto5_fragmento en hooks.ts).
//
// Todo sale por los canales públicos del motor (g.waves/g.particles/
// g.floats/g.toast/g.flags) + fxcore. Cero allocations por frame en
// reposo: el tick sale temprano si no estás en la Cuna.
// ============================================================

import type { Game } from './engine';
import { TILE } from './sprites';
import { tileAt } from './maps';
import { audio } from './audio';
import { addShake, addFlash } from './fxcore';

// ---------------- 1) El ritmo del Aún ----------------

const COMPAS_TILES = 3;      // tiles de camino = una nota
const SFX_CADA = 2;          // el sfx suena cada 2ª nota (las demás, solo partícula)

// Configs de nota cacheadas (mismo patrón que NOTE_CFG de 13-c): abanico
// ascendente suave, colores del Segundo Canto (plata-dorado).
const RITMO_CFG = Array.from({ length: 6 }, (_, i) => ({
  a: -Math.PI / 2 + ((i % 3) - 1) * 0.42,
  s: 20 + (i % 3) * 12,
  sz: 0.9 + (i % 2) * 0.3,
  stem: i % 2 === 0,
  life: 0.9 + (i % 3) * 0.15,
}));

let compas = 0;              // compás acumulado (px de camino)
let lastX = 0, lastY = 0;    // posición anterior (delta de andado real)
let notaIdx = 0;             // rotación de configs (determinista)
let lastPlayer: unknown = null;

export function acto5Tick(g: Game, dt: number): void {
  void dt; // el compás es por distancia, no por tiempo
  const p = g.player;
  if (!p || g.mapId !== 'cuna') { lastPlayer = p; return; }
  // partida nueva / carga: compás a cero
  if (p !== lastPlayer) { lastPlayer = p; compas = 0; lastX = p.x; lastY = p.y; }

  // el ritmo solo existe en 'aun' y caminando en juego
  if (g.epoch !== 'aun' || g.state !== 'play') { compas = 0; return; }

  const moved = Math.hypot(p.x - lastX, p.y - lastY);
  lastX = p.x; lastY = p.y;
  if (moved <= 0.01) return; // quieto: el compás no avanza

  // pies sobre el camino (convención fx.ts: y + h*0.5)
  const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + p.h * 0.5) / TILE);
  if (tileAt(g.map, g.rows, tx, ty, g.epoch) !== '=') { compas = 0; return; }

  compas += moved;
  if (compas < COMPAS_TILES * TILE) return;
  compas = 0;

  // UNA nota del Segundo Canto — tan lento que un siglo por nota;
  // aquí, una por cada tres pasos sabios.
  const n = RITMO_CFG[notaIdx++ % RITMO_CFG.length];
  const nx = p.x + Math.cos(n.a) * 5;
  const ny = p.y - 10 + Math.sin(n.a) * 4;
  g.particles.push({
    x: nx, y: ny, vx: Math.cos(n.a) * n.s, vy: Math.sin(n.a) * n.s - 18,
    t: n.life, maxT: n.life, color: notaIdx % 2 ? '#d8d8ec' : '#ffe9a0', size: n.sz, grav: -12,
  });
  if (n.stem) {
    g.particles.push({
      x: nx + n.sz * 1.6, y: ny - n.sz * 2.2,
      vx: Math.cos(n.a) * n.s * 0.85, vy: Math.sin(n.a) * n.s - 15,
      t: n.life * 0.8, maxT: n.life, color: '#c8d0e8', size: 0.7, grav: -12,
    });
  }
  if (notaIdx % SFX_CADA === 0) audio.sfx('blip');
}

// ---------------- 2) La estrena del primer día ----------------

/**
 * La Cuna estrena su primer día. La llama engine.epochSwitch UNA vez
 * (guard cunaEstrenada en flags, que viaja en el save). Nace también la
 * fauna needPresent que spawnEnemies no pudo crear en 'aun'.
 */
export function estrenarCuna(g: Game): void {
  g.flags.cunaEstrenada = true;
  const p = g.player;
  if (!p) return;

  // ---- escenografía: el mundo abre los ojos ----
  addFlash(g, '#ffe9a0', 0.2);
  addShake(g, 3);
  g.waves.push({ x: p.x, y: p.y, r: 4, maxR: 150, speed: 230, dmg: 0, hit: true });
  audio.sfx('quest');
  g.burst(p.x, p.y - 8, '#ffe9a0', 26, 90);

  // notas ascendentes alrededor del Portador (el primer aire que suena)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 14 + (i % 3) * 8;
    g.particles.push({
      x: p.x + Math.cos(a) * r, y: p.y - 8 + Math.sin(a) * r * 0.6,
      vx: Math.cos(a) * 12, vy: -22 - (i % 4) * 8,
      t: 1.3 + (i % 3) * 0.2, maxT: 1.7, color: i % 2 ? '#ffe9a0' : '#d8d8ec', size: 1.1, grav: -10,
    });
  }

  // textos escalonados: la Cuna aprende a tener tiempo
  g.floatAt(p.x, p.y - 26, '...el primer día...', '#ffe9a0', 8);
  g.floats.push({ x: p.x, y: p.y - 44, text: 'Las primeras flores recuerdan que aún no saben marchitarse.', t: 2.6, color: '#c8d0e8', vy: -5, size: 7 });
  g.toast('La Cuna estrena su primer día: el tiempo acaba de nacer aquí', '#ffe9a0');

  // ---- la fauna del primer día nace EN EL ACTO ----
  // (spawnEnemies corrió en 'aun': los needPresent no existían todavía)
  for (const s of g.map.spawns) {
    if (!s.needPresent) continue;
    const sx = s.x * TILE + 8, sy = s.y * TILE + 8;
    if (g.enemies.some(e => !e.dead && Math.hypot(e.x - sx, e.y - sy) < TILE * 2)) continue;
    if (g.tileSolidAt(sx, sy)) continue;
    g.enemies.push(g.makeEnemy(s.type, sx, sy, s.patrol ?? 2, s.zone));
  }

  // ---- progreso de q17 paso 2 («Despierta el Fragmento y estrena») ----
  // Idempotente con acto5_fragmento (hooks): quien llegue último, avanza.
  if (g.questIdx === 16 && g.questStep === 2 && g.flags.cunaFragmento) {
    g.questAdvance();
    g.toast('El primer día de la Cuna: vuelve con la Guarda del Primer Canto', '#8ef0b0');
  }
}
