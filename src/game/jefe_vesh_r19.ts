// ============================================================
// ECOS DE AELTHAR — R19 · AGENTE 19-h · JEFE FINAL
// «VESH, LA ÚLTIMA NOTA» — Sala del Primer Silencio (ciudadela)
// ============================================================
// El primer cantor, convertido en la nota que nadie se atrevió a
// terminar. Pelea en COMPASES de 4 tiempos (1 tiempo = 0.75 s;
// Fase 3 = 0.5 s) marcados con pulsos dorados de partículas:
//
//   FASE 1 «LA BATUTA»   (>60% hp): flota en diente de sierra; en cada
//     compás: tiempo 1 = telegrafía (3 partículas + anillo), tiempos
//     2-3 = salva en arco (3 notas a 0°/±20°), tiempo 4 = pausa (el
//     compás enseña el ritmo). Cada 4 compases: ACORDE (8 notas en
//     círculo completo).
//   FASE 2 «EL SILENCIO» (60-30%): transición con toast «El Silencio
//     desciende…», sfx propios, invulT 1.5 y penumbra (partículas
//     oscuras + flash violáceo — el flash del motor es ADITIVO
//     ('lighter'): la oscuridad real la dan los motes). Vesh se
//     desvanece y REAPARECE TRAS EL PORTADOR cada compás y deja 3
//     «nodos de silencio» (sombra estática, 90 hp): si sobreviven 3
//     compases, ESTALLAN en una onda cada uno (máx 3 vivos siempre).
//   FASE 3 «EL ACORDE FINAL» (<30%): compás acelerado (0.5 s/tiempo),
//     DOBLE acorde (2 círculos de 8 desfasados 22.5°) cada 4 compases
//     y ONDA DE COMPÁS: shockwave radial enorme (maxR 230) cada 6 s
//     con telegrafía de 1 s. A <15% hp: «CODA» — se queda quieto 2 s
//     cargando (telegrafía grande) y lanza 16 notas en espiral
//     (ángulo = base + i·22.5°, determinista).
//   ANTI-COWBOY: si el Portador se mantiene a >300 px, Vesh teleporta
//     a media distancia y castea un acorde (castiga el kite).
//   Quiebre con e.sta/maxSta (mismo patrón que el dispatcher 14-a).
//
// DETERMINISMO: cero Math.random en este módulo — mulberry32 local de
// semilla FIJA dentro de un WeakMap POR ENEMIGO (memoria de cerebro) y
// WeakMap POR PARTIDA (semilla base, HMR/multi-instancia seguro).
// Proyectiles siempre sprite 'nota' (from:'enemy') — el motor gestiona
// i-frames/parada/estelas. Daño al Portador SOLO vía proyectiles,
// ondas, telegrafías y g.damagePlayer().
//
// ═══════════════════════════════════════════════════════════════
// PUNTOS DE CABLEADO PARA EL INTEGRADOR (nombres exactos)
// ═══════════════════════════════════════════════════════════════
// NINGÚN fichero ajeno fue editado por 19-h. Cableado exacto:
//
// (1) types.ts — ampliar las uniones (2 palabras):
//       EnemyType: añadir | 'vesh'      (junto a 'heraldo')
//       MapId:     añadir | 'ciudadela' (mapa del agente 19-g, 54×44)
//
// (2) data.ts — registrar la def (patrón ENEMY_DEFS_14A/16A, tras el
//     bloque 16-a):
//       import { VESH_DEF_R19 } from './jefe_vesh_r19';
//       Object.assign(ENEMY_DEFS, { vesh: VESH_DEF_R19 });
//     (Object.assign ya no hace falta si se prefiere: la def viaja
//      auto-inyectada por CARGA de este módulo — ver más abajo.)
//
// (3) update.ts — despachar el cerebro (línea ~704, patrón expansionTick):
//       import { veshTickR19 } from './jefe_vesh_r19';
//       if (EXPANSION_TYPES.has('vesh') && e.etype === 'vesh' && veshTickR19(g, e, dt, def)) return;
//     (o añadir 'vesh' a EXPANSION_TYPES línea 65 + case 'vesh' en
//      expansionTick de enemies_expansion.ts:1822 con el import —
//      CUALQUIERA de las dos vale; NUNCA antes del bloque común.)
//
// (4) engine.ts — flag de derrota (línea ~84-91):
//       BOSS_DEFEAT_FLAG: añadir  vesh: 'veshDefeated',
//     y rama killEnemy (línea ~1894, patrón 'coro'):
//       else if (e.etype === 'vesh') {
//         this.flags.veshDefeated = true;          // ⚠ dispara el EPÍLOGO (agente 19-f)
//         delete this.flags.bossHp_ciudadela;
//         this.bossActive = false;
//         audio.setCombat(false);
//         audio.playTrack('boss');                 // o tema de epílogo
//         this.shake = 10;
//         veshDeathFxR19(this, e);                 // onda dorada + partículas (guard anti-doble)
//         audio.sfx('holy'); audio.sfx('song');
//         this.toast('La Última Nota ha sonado', '#ffd88a');
//         p.potions += 2;
//         this.floatAt(e.x, e.y - 34, 'Botín del jefe: +2 pociones', '#7ef0a0');
//       }
//     (el XP 800 y el oro 500-650 ya los paga el tronco común de
//      killEnemy leyendo ENEMY_DEFS.vesh; «veshDefeated» es LA flag
//      exacta que espera el 19-f para el epílogo.)
//
// (5) Spawn — MAPS.ciudadela (módulo del 19-g) o data de spawns:
//       { type: 'vesh', x: 27, y: 10, patrol: 0, zone: 'boss' }
//     (= VESH_SPAWN_R19). Sala del Primer Silencio, al norte. Si el
//     plano final de 19-g moviera la sala, ajustar SOLO aquí.
//     makeEnemy('vesh') necesita ENEMY_DEFS.vesh (punto 2) y da caja
//     12×10: el cerebro la auto-sana a 22×16 en su primer tick (el
//     integrador TAMBIÉN puede añadir 'vesh' al ternario de
//     makeEnemy engine.ts:621 — opcional, no requerido).
//
// (6) render.ts — OPCIONAL (frames de pose; sin cablear, el juego
//     funciona con el ciclo 0/1 de entityFrame):
//       import { veshPoseR19 } from './jefe_vesh_r19';
//       // en drawEntity, para etype 'vesh':
//       //   'idle' → frames 0/1 (entityFrame) · 'cast' → 2
//       //   'batuta' → 3 · 'coda' → 4
//
// (7) engine constructor — OPCIONAL: initJefeVeshR19Sprites() tras
//     initExpansionSprites() (si no, el primer tick lo auto-instala).
//
// (8) challenge.ts BOSS_INFO — OPCIONAL (solo si se añade duelo de
//     arena 'vesh').
//
// Banner de jefe: el CEREBRO lo dispara solo (flags.veshIntro +
// bossRef/bossActive + playTrack('boss')) al entrar en aggro.
// ============================================================

import type { Game } from './engine';
import type { Enemy, Player } from './types';
import type { EnemyDef } from './data';
import { audio } from './audio';
import { registerSpr } from './sprites';
import type { Frames } from './sprites';

// ---------------- constantes de la pelea ----------------

const BEAT = 0.75;          // s por tiempo (Fase 1-2): el compás enseña el ritmo
const BEAT_F3 = 0.5;        // s por tiempo en Fase 3 (enrage)
const VESH_STUN_T = 2.2;    // s de quebrado (patrón dispatcher: e.sta/maxSta)
const KITE_DIST = 300;      // px: a partir de aquí el Portador «farmea»
const KITE_TIME = 1.5;      // s acumulados a >KITE_DIST antes del castigo
const NODE_HP = 90;         // vida de los nodos de silencio (Fase 2)
const NODE_GUARD = 99999;   // spawnGuard enorme = nodo ESTÁTICO (el motor lo congela)
const NODE_VIDA_COMPASES = 3; // compases que aguanta un nodo antes de estallar
const CODA_CD = 9;          // s entre codas
const CODA_WINDUP = 2.0;    // s de carga de la coda
const ONDA_CD = 6;          // s entre ondas de compás (Fase 3)
const ONDA_TELEGRAFO = 1.0; // s de telegrafía de la onda
const NOTA_DMG = 12;        // dmg de las notas (def.dmg 18 queda para ondas)
const ESPIRAL_DMG = 10;     // dmg de las 16 notas de la coda (esquivable)

/** Def del jefe final. weakTo 'ninguno': sin debilidad elemental (el
 *  literal que usa el Guardián — verificado en ENEMY_DEFS.guardian). */
export const VESH_DEF_R19: EnemyDef = {
  name: 'Vesh, el Primer Cantor', // R19-int: el heraldo del Acto IV llevaba su nombre ROBADO — este es el Vesh real
  hp: 750,
  dmg: 18,
  speed: 42,
  xp: 800,
  gold: [500, 650],
  sprite: 'vesh',
  aggroR: 190,
  atkR: 50,
  windup: 0.7,
  atkCd: 1.8,
  element: 'sombra',
  weakTo: 'ninguno',
  breakBar: 110,
  desc: 'El primer cantor, convertido en la nota que nadie se atrevió a terminar. Dirige el final en compases de cuatro tiempos: aprende el ritmo, rompe su barra de quiebre y cierra la sinfonía.',
};

/** Datos de presentación (banner del motor / challenge.BOSS_INFO opcional). */
export const VESH_BOSS_INFO_R19 = {
  name: 'VESH · EL PRIMER CANTOR',
  sub: 'La nota que nadie se atrevió a terminar',
} as const;

/** Spawn previsto en la ciudadela del 19-g (Sala del Primer Silencio,
 *  al norte). El integrador lo vuelca al SpawnDef del mapa (punto 5). */
export const VESH_SPAWN_R19 = {
  map: 'ciudadela', // MapId nuevo del agente 19-g (añadir a types.ts)
  x: 27,
  y: 10,
  zone: 'boss',
} as const;

// ---------------- memoria por partida / por enemigo ----------------

const GAME_SEED = new WeakMap<Game, number>();
const BASE_SEED = 0x5e5119; // «VESH» — semilla base fija por partida

function seedDePartida(g: Game): number {
  let s = GAME_SEED.get(g);
  if (s === undefined) { s = BASE_SEED; GAME_SEED.set(g, s); }
  return s;
}

/** PRNG determinista de semilla FIJA (cero Math.random en el módulo). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface VeshMem {
  rand: () => number;                  // PRNG del cerebro (semilla fija)
  beat: number;                        // tiempo actual del compás (0 = sin empezar, 1..4)
  beatT: number;                       // acumulador dentro del tiempo actual
  compass: number;                     // compases completados
  sawDir: number;                      // deriva horizontal del diente de sierra
  dropT: number;                       // caída rápida del diente (s restantes)
  nodos: { ref: Enemy; born: number }[]; // nodos de silencio (Fase 2)
  ondaT: number;                       // acumulador de la onda de compás (F3)
  ondaPend: number;                    // >0: telegrafía en curso
  ondaX: number; ondaY: number;        // centro de la onda pendiente
  codaCd: number;                      // enfriamiento de la coda
  codaPend: boolean;                   // coda cargando (ai 'carga')
  codaBase: number;                    // ángulo base de la espiral (progresa determinista)
  acordeBase: number;                  // ángulo base de los acordes (progresa determinista)
  kiteT: number;                       // acumulador anti-cowboy
  kiteToasts: number;                  // avisos emitidos (máx 2)
}

const MEM = new WeakMap<Enemy, VeshMem>();

function mem(e: Enemy): VeshMem {
  let m = MEM.get(e);
  if (!m) {
    m = {
      rand: mulberry32(BASE_SEED ^ 0x1a03), // semilla fija: cada Vesh dirige igual
      beat: 0, beatT: 0, compass: 0, sawDir: 1, dropT: 0, nodos: [],
      ondaT: 0, ondaPend: 0, ondaX: 0, ondaY: 0,
      codaCd: 2, codaPend: false, codaBase: 0, acordeBase: 0,
      kiteT: 0, kiteToasts: 0,
    };
    MEM.set(e, m);
  }
  return m;
}

// ---------------- micro-helpers de feedback (espejo de fxcore, sin import:
// el contrato de imports de 19-h no incluye './fxcore') ----------------

function addShakeVesh(g: Game, mag: number): void { g.shake = Math.max(g.shake, mag); }
function slowmoVesh(g: Game, t: number): void { g.slowmoT = Math.max(g.slowmoT, t); }
function addFlashVesh(g: Game, color: string, t: number): void {
  if (t >= g.flashT) { g.flashT = t; g.flashColor = color; }
}

function particula(g: Game, x: number, y: number, vx: number, vy: number, t: number, color: string, size: number, grav: number): void {
  g.particles.push({ x, y, vx, vy, t, maxT: t, color, size, grav });
}

/** Estallido dorado radial (partituras que se deshacen en luz). */
function estallidoDorado(g: Game, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    particula(g, x + Math.cos(a) * 8, y - 6 + Math.sin(a) * 5,
      Math.cos(a) * 60, Math.sin(a) * 44 - 22, 0.55 + (i % 3) * 0.08,
      i % 3 === 0 ? '#fff3c0' : '#ffd88a', 2, -10);
  }
}

/** Motes de silencio: la penumbra de la Fase 2 (el flash del motor es
 *  aditivo — la oscuridad la pintan estas partículas oscuras). */
function motesOscuros(g: Game, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    particula(g, x + Math.cos(a) * 14, y - 4 + Math.sin(a) * 10,
      Math.cos(a) * 16, -8 - (i % 4) * 6, 0.9, '#0d0916', 2.2, 0);
  }
}

function pushNota(g: Game, x: number, y: number, vx: number, vy: number, dmg: number): void {
  g.projectiles.push({
    x, y, vx, vy, t: 2.2, dmg, element: 'sombra', from: 'enemy',
    sprite: 'nota', radius: 4.5, pierce: 0,
  });
}

/** Salva en arco puntual: 3 notas a 0° y ±20° hacia el Portador. */
function salvaArco(g: Game, e: Enemy, p: Player, spd: number): void {
  const base = Math.atan2(p.y - 4 - e.y, p.x - e.x);
  for (let i = 0; i < 3; i++) {
    const a = base + (i - 1) * (Math.PI / 9); // ±20°
    pushNota(g, e.x, e.y - 4, Math.cos(a) * spd, Math.sin(a) * spd, NOTA_DMG);
  }
  audio.sfx('whoosh');
}

/** ACORDE: n notas en círculo completo (determinista, base progresiva). */
function acorde(g: Game, e: Enemy, n: number, off: number, spd: number): void {
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    pushNota(g, e.x, e.y - 4, Math.cos(a) * spd, Math.sin(a) * spd, NOTA_DMG);
  }
}

// ---------------- bloque común (réplica de lo esencial de commonTick,
// que NO está exportado por enemies_expansion) ----------------
// Contrato de colocación (única soportada, ver cabecera): DESPUÉS del
// bloque común del motor (update.ts ~704). El motor ya hizo este frame:
// hitFlash, spawnGuard, knockback, estados, marca, invulT (703) — y NO
// hará: aggro por radio (709), atkCd (725), anim (726) ni aturdido
// (728), porque este tick devuelve true. Eso es exactamente lo que se
// replica aquí.

function comunVesh(g: Game, e: Enemy, dt: number, def: EnemyDef, m: VeshMem): boolean {
  const p = g.player;

  // caja de jefe (auto-saneamiento: makeEnemy genérico da 12×10)
  if (e.w < 22) { e.w = 22; e.h = 16; }

  // aggro por radio (idempotente con el motor; mismo criterio noche)
  if (p && !e.aggro && g.state === 'play') {
    const noche = g.dayT > 0.7 || g.dayT < 0.08;
    if (Math.hypot(p.x - e.x, p.y - e.y) < def.aggroR * (noche ? 1.3 : 1)) e.aggro = true;
  }

  // atkCd: el motor no lo decae para tipos despachados (return true antes)
  e.atkCd -= dt;

  // anim (cosmético)
  e.anim += dt * (e.ai === 'persigue' ? 1.4 : 0.6);

  // QUEBRADO/ATURDIDO — patrón del dispatcher (14-a): cuenta atrás propia
  // y, al salir, barra de quiebre completa (clave para el REMATE).
  if (e.ai === 'aturdido') {
    if (e.aiT > VESH_STUN_T) e.aiT = VESH_STUN_T;
    e.aiT -= dt;
    e.moving = false;
    e.windup = 0;
    // la partitura se le deshace en esquirlas doradas
    if (m.rand() < 0.5) {
      particula(g, e.x + (m.rand() - 0.5) * 16, e.y - 4 - m.rand() * 12,
        (m.rand() - 0.5) * 20, -22 - m.rand() * 16, 0.5, '#ffd88a', 1.8, 30);
    }
    if (e.aiT <= 0) {
      e.ai = 'persigue';
      if (e.maxSta > 0) e.sta = e.maxSta;
    }
    return true; // frame consumido
  }
  return false;
}

// ---------------- Fase 2: nodos de silencio ----------------

function refrescarNodos(g: Game, e: Enemy, p: Player, m: VeshMem): void {
  // purga de referencias muertas
  m.nodos = m.nodos.filter(n => !n.ref.dead);

  // estallido de los nodos que sobrevivieron a 3 compases: onda cada uno
  const vencidos = m.nodos.filter(n => m.compass - n.born >= NODE_VIDA_COMPASES);
  for (const n of vencidos) {
    g.waves.push({ x: n.ref.x, y: n.ref.y, r: 0, maxR: 74, speed: 180, dmg: 12, hit: false });
    g.burst(n.ref.x, n.ref.y, '#8a7ab0', 16, 80);
    audio.sfx('slam');
    g.killEnemy(n.ref);
  }
  if (vencidos.length > 0) m.nodos = m.nodos.filter(n => m.compass - n.born < NODE_VIDA_COMPASES);

  // rellenar hasta 3 vivos (máx 3 SIEMPRE)
  while (m.nodos.length < 3) {
    let puesto = false;
    for (let i = 0; i < 16 && !puesto; i++) {
      const a = m.rand() * Math.PI * 2;
      const rr = 30 + (i % 4) * 8;
      const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
      if (g.tileSolidAt(x, y)) continue;
      const s = g.makeEnemy('sombra', x, y, 0, 'boss');
      s.maxHp = NODE_HP;
      s.hp = NODE_HP;
      s.spawnGuard = NODE_GUARD; // estático: el motor lo congela (no persigue ni ataca)
      s.aggro = false;
      s.homeX = x; s.homeY = y;
      g.enemies.push(s);
      g.burst(x, y, '#3a2a4a', 10, 60);
      m.nodos.push({ ref: s, born: m.compass });
      puesto = true;
    }
    if (!puesto) break; // sin sitio libre: reintenta el próximo compás
  }
}

/** Teleport con partículas: reaparece TRAS el Portador (según su dirección). */
function teleportTras(g: Game, e: Enemy, p: Player, m: VeshMem): void {
  g.burst(e.x, e.y, '#3a2a4a', 14, 70);
  audio.sfx('whoosh');
  e.invulT = 0.55; // desvanecido un instante (contrato types.ts)
  const bx = p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0;
  const by = p.dir === 'down' ? -1 : p.dir === 'up' ? 1 : 0;
  const cand: [number, number][] = [[p.x + bx * 130, p.y + by * 130]];
  for (let i = 0; i < 12; i++) {
    const a = m.rand() * Math.PI * 2;
    const rr = 110 + (i % 3) * 22;
    cand.push([p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr]);
  }
  for (const [x, y] of cand) {
    if (!g.tileSolidAt(x, y)) { e.x = x; e.y = y; break; }
  }
  g.burst(e.x, e.y, '#ffd88a', 12, 70);
  motesOscuros(g, e.x, e.y, 8);
}

// ---------------- Fase 3: onda de compás + coda ----------------

function pasoOnda(g: Game, e: Enemy, m: VeshMem, dt: number): void {
  if (m.ondaPend > 0) {
    m.ondaPend -= dt;
    if (m.ondaPend <= 0) {
      g.waves.push({ x: m.ondaX, y: m.ondaY, r: 0, maxR: 230, speed: 260, dmg: 18, hit: false });
      g.burst(m.ondaX, m.ondaY, '#ffd88a', 20, 110);
      addShakeVesh(g, 6);
      audio.sfx('slam');
    }
    return;
  }
  m.ondaT += dt;
  if (m.ondaT >= ONDA_CD) {
    m.ondaT = 0;
    m.ondaPend = ONDA_TELEGRAFO;
    m.ondaX = e.x; m.ondaY = e.y;
    g.telegraphs.push({ x: e.x, y: e.y, r: 90, t: ONDA_TELEGRAFO, maxT: ONDA_TELEGRAFO, dmg: 18, kind: 'aro' });
    audio.sfx('shadow');
  }
}

function iniciarCoda(g: Game, e: Enemy, m: VeshMem): void {
  m.codaPend = true;
  m.codaCd = CODA_CD;
  e.ai = 'carga';
  e.windup = CODA_WINDUP;
  e.moving = false;
  g.telegraphs.push({ x: e.x, y: e.y, r: 74, t: CODA_WINDUP, maxT: CODA_WINDUP, dmg: 20, kind: 'aro' });
  audio.sfx('song');
  slowmoVesh(g, 0.3);
  addFlashVesh(g, '#ffd88a', 0.25);
  g.toast('Vesh alza la batuta: LA CODA', '#fff3c0');
}

/** Espiral final: 16 notas, ángulo = base + i·22.5° (π/8), determinista. */
function espiralCoda(g: Game, e: Enemy, m: VeshMem): void {
  const base = m.codaBase;
  for (let i = 0; i < 16; i++) {
    const a = base + i * (Math.PI / 8);
    pushNota(g, e.x, e.y - 4, Math.cos(a) * 150, Math.sin(a) * 150, ESPIRAL_DMG);
  }
  m.codaBase = base + 0.37; // la siguiente espiral viene girada (determinista)
  audio.sfx('shadow');
  audio.sfx('song');
  addShakeVesh(g, 7);
  estallidoDorado(g, e.x, e.y, 18);
}

// ---------------- anti-cowboy ----------------

function castigarKite(g: Game, e: Enemy, p: Player, m: VeshMem): void {
  m.kiteT = 0;
  g.burst(e.x, e.y, '#3a2a4a', 12, 60);
  e.invulT = 0.4;
  audio.sfx('whoosh');
  const a0 = m.rand() * Math.PI * 2;
  for (let i = 0; i < 14; i++) {
    const a = a0 + i * 0.7;
    let puesto = false;
    for (const rr of [150, 135, 165]) {
      const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
      if (!g.tileSolidAt(x, y)) { e.x = x; e.y = y; puesto = true; break; }
    }
    if (puesto) break;
  }
  g.burst(e.x, e.y, '#ffd88a', 14, 80);
  acorde(g, e, 8, m.acordeBase, 150); // castigo: acorde inmediato
  m.acordeBase += 0.19;
  audio.sfx('shadow');
  if (m.kiteToasts < 2) {
    m.kiteToasts++;
    g.toast(m.kiteToasts === 1
      ? 'Vesh no soporta el silencio a distancia'
      : 'La batuta te señala: deja de huir', '#ffd88a');
  }
}

// ---------------- movimiento ----------------

/** Patrulla: flota junto a la batuta de su altar (determinista vía anim). */
function flotarPatrulla(g: Game, e: Enemy, dt: number): void {
  const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 40;
  const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.anim * 0.8;
  g.moveEntity(e, Math.cos(ang) * 14 * dt, Math.sin(ang) * 14 * dt);
  e.moving = true;
  e.dir = Math.cos(ang) > 0 ? 'right' : 'left';
}

/** Diente de sierra: banda 100-170 px + subida lenta / caída rápida. */
function flotarCompas(g: Game, e: Enemy, p: Player, dt: number, def: EnemyDef, m: VeshMem, d: number): void {
  const ang = Math.atan2(p.y - e.y, p.x - e.x);
  let mvx: number, mvy: number;
  // más allá de KITE_DIST NO camina: espera (compás en mano) al castigo
  if (d > 170 && d <= KITE_DIST) { mvx = Math.cos(ang); mvy = Math.sin(ang); }
  else if (d < 100) { mvx = -Math.cos(ang); mvy = -Math.sin(ang); }
  else {
    const tang = ang + (Math.PI / 2) * m.sawDir;
    mvx = Math.cos(tang) * 0.5; mvy = Math.sin(tang) * 0.5;
  }
  if (m.dropT > 0) { m.dropT -= dt; mvy += 2.2; } // la caída del diente
  else mvy -= 0.55;                               // la subida lenta
  const spd = def.speed * (e.phase >= 3 ? 1.15 : 0.85);
  g.moveEntity(e, mvx * spd * dt, mvy * spd * dt);
  e.moving = mvx !== 0 || mvy !== 0;
  e.dir = p.x > e.x ? 'right' : 'left';
}

// ---------------- el COMPÁS ----------------

function inicioCompas(g: Game, e: Enemy, p: Player, m: VeshMem): void {
  // pulso visual del compás (anillo inocuo, patrón sirena 9-a)
  g.waves.push({ x: e.x, y: e.y, r: 0, maxR: 30, speed: 110, dmg: 0, hit: true });
  // telegrafía: 3 partículas doradas alzan el compás
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.6;
    particula(g, e.x + Math.cos(a) * 10, e.y - 8 + Math.sin(a) * 6,
      Math.cos(a) * 22, -26, 0.5, '#ffd88a', 2, 0);
  }
  m.sawDir *= -1;
  if (e.phase === 1) m.dropT = 0.28; // la caída del diente de sierra

  if (e.phase === 2) {
    // EL SILENCIO: nodos de silencio + reaparición tras el Portador
    refrescarNodos(g, e, p, m);
    teleportTras(g, e, p, m);
    salvaArco(g, e, p, 150); // proyectiles dirigidos al reaparecer
    return;
  }

  // ACORDE cada 4 compases (F1: círculo de 8 · F3: doble círculo de 8)
  if (m.compass % 4 === 0) {
    if (e.phase >= 3) {
      acorde(g, e, 8, m.acordeBase, 140);
      acorde(g, e, 8, m.acordeBase + Math.PI / 8, 140); // doble, desfasado 22.5°
    } else {
      acorde(g, e, 8, m.acordeBase, 140);
    }
    m.acordeBase += 0.19; // la próxima vuelta llega girada (determinista)
    audio.sfx('shadow');
    estallidoDorado(g, e.x, e.y, 10);
  }
}

function tiempoCompas(g: Game, e: Enemy, p: Player, m: VeshMem): void {
  // pulso por tiempo (el compás marca el ritmo)
  particula(g, e.x + (m.rand() - 0.5) * 18, e.y - 14, 0, -18, 0.35, '#fff3c0', 1.4, 0);
  if (m.beat === 2 || m.beat === 3) {
    // tiempos 2-3: salva en arco puntual (0°, ±20°)
    salvaArco(g, e, p, e.phase >= 3 ? 165 : 150);
  }
  // tiempo 4 = pausa: el compás enseña el ritmo (no dispara)
}

function pasoCompas(g: Game, e: Enemy, p: Player, m: VeshMem, dt: number): void {
  m.beatT += dt;
  const beatDur = e.phase >= 3 ? BEAT_F3 : BEAT;
  let guard = 0;
  while (m.beatT >= beatDur && guard++ < 6) {
    m.beatT -= beatDur;
    m.beat = m.beat >= 4 ? 1 : m.beat + 1;
    if (m.beat === 1) { m.compass++; inicioCompas(g, e, p, m); }
    tiempoCompas(g, e, p, m);
  }
}

// ---------------- transiciones de fase (música/sfx propios) ----------------

function transicionFase(g: Game, e: Enemy, m: VeshMem, f: number): void {
  e.phase = f;
  e.windup = 0;
  m.codaPend = false;
  if (f === 2) {
    addFlashVesh(g, '#2a1f3e', 0.5); // penumbra violácea (flash aditivo)
    addShakeVesh(g, 6);
    slowmoVesh(g, 0.3);
    motesOscuros(g, e.x, e.y, 26);
    audio.sfx('wraith');
    audio.sfx('shadow');
    audio.playTrack('boss'); // la música de fase vuelve a arrancar
    e.invulT = 1.5;          // intocable mientras el Silencio desciende
    g.toast('El Silencio desciende…', '#8a7ab0');
  } else if (f >= 3) {
    addFlashVesh(g, '#ffd88a', 0.3);
    addShakeVesh(g, 7);
    slowmoVesh(g, 0.25);
    audio.sfx('roar');
    audio.playTrack('boss');
    m.ondaT = 0;
    m.ondaPend = 0;
    estallidoDorado(g, e.x, e.y, 16);
    g.toast('EL ACORDE FINAL resuena', '#ffd88a');
  }
}

// ============================================================
// CEREBRO PRINCIPAL — despachar con update.ts:704 (ver cabecera).
// Siempre devuelve true: el frame es suyo (patrón sirena/coro).
// ============================================================

export function veshTickR19(g: Game, e: Enemy, dt: number, def: EnemyDef): boolean {
  initJefeVeshR19Sprites(); // auto-instalación perezosa (idempotente)

  // guarda de muerte: FX exactamente UNA vez aunque el integrador olvide
  // la rama killEnemy (el WeakSet de veshDeathFxR19 evita dobles)
  if (e.hp <= 0 && !e.dead) { veshDeathFxR19(g, e); return true; }

  const m = mem(e);
  if (comunVesh(g, e, dt, def, m)) return true;

  const p = g.player;
  if (!p) return true;
  const d = Math.hypot(p.x - e.x, p.y - e.y) || 1e-4;

  // ---- banner del jefe final (una vez por partida) ----
  if (e.aggro && !g.flags.veshIntro) {
    g.flags.veshIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = 'VESH, LA ÚLTIMA NOTA';
    g.bossBannerSub = VESH_BOSS_INFO_R19.sub;
    addFlashVesh(g, '#ffd88a', 0.3);
    addShakeVesh(g, 5);
    slowmoVesh(g, 0.25);
    audio.sfx('banner');
    audio.playTrack('boss');
    if (!g.bossActive) { g.bossRef = e; g.bossActive = true; }
    g.toast('El primer cantor alza su batuta: sobrevive al compás', '#ffd88a');
  }

  if (!e.aggro) { flotarPatrulla(g, e, dt); return true; }

  // ---- fases por vida (mismo corte que Guardián/Sirena: 60/30) ----
  const hpPct = e.hp / e.maxHp;
  const nuevaFase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
  if (nuevaFase > e.phase) transicionFase(g, e, m, nuevaFase);

  // ---- anti-cowboy: castiga el kite a >300 px (todas las fases).
  // Sin decaimiento: la paciencia del director no se olvida. ----
  if (e.ai === 'persigue') {
    if (d > KITE_DIST) m.kiteT += dt;
    if (m.kiteT >= KITE_TIME) castigarKite(g, e, p, m);
  }

  // ---- F3: onda de compás (acumula fuera del switch para no perderla) ----
  if (e.phase >= 3 && e.ai === 'persigue') pasoOnda(g, e, m, dt);

  switch (e.ai) {
    case 'patrulla': {
      if (e.aggro) e.ai = 'persigue';
      break;
    }
    case 'persigue': {
      flotarCompas(g, e, p, dt, def, m, d);
      pasoCompas(g, e, p, m, dt);
      m.codaCd -= dt;
      // CODA: a <15% hp se queda quieto 2 s cargando y lanza la espiral
      if (e.phase >= 3 && hpPct < 0.15 && m.codaCd <= 0) iniciarCoda(g, e, m);
      break;
    }
    case 'carga': {
      // única carga: la CODA (windup 2.0)
      e.moving = false;
      e.dir = p.x > e.x ? 'right' : 'left';
      e.windup -= dt;
      if (e.windup <= 0) {
        if (m.codaPend) {
          espiralCoda(g, e, m);
          m.codaPend = false;
          e.ai = 'recupera';
          e.aiT = 0.6;
        } else {
          e.ai = 'persigue';
        }
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

  return true;
}

/** Pose actual del director (para el render opcional — punto 6):
 *  'idle' → frames 0/1 · 'cast' → 2 · 'batuta' → 3 · 'coda' → 4. */
export function veshPoseR19(e: Enemy): 'idle' | 'cast' | 'batuta' | 'coda' {
  if (e.ai === 'carga' && e.windup > 0) return 'coda';
  const m = MEM.get(e);
  if (!m || !e.aggro) return 'idle';
  if (m.beat === 1) return 'cast';
  if (m.beat === 2 || m.beat === 3) return 'batuta';
  return 'idle';
}

// ============================================================
// MUERTE — «La Última Nota ha sonado»
// La llama la rama killEnemy del integrador (punto 4) o la guarda de
// muerte del propio cerebro. Guard anti-doble por WeakSet.
// ============================================================

const muerteVista = new WeakSet<Enemy>();

export function veshDeathFxR19(g: Game, e?: Enemy): void {
  const objetivo = e ?? g.bossRef ?? undefined;
  if (objetivo) {
    if (muerteVista.has(objetivo)) return;
    muerteVista.add(objetivo);
  }
  const x = objetivo ? objetivo.x : (g.player ? g.player.x : 0);
  const y = objetivo ? objetivo.y : (g.player ? g.player.y : 0);

  // onda dorada triple (inocua: dmg 0 — pura solemnidad)
  g.waves.push({ x, y, r: 0, maxR: 120, speed: 160, dmg: 0, hit: true });
  g.waves.push({ x, y, r: 0, maxR: 180, speed: 200, dmg: 0, hit: true });
  g.waves.push({ x, y, r: 0, maxR: 240, speed: 240, dmg: 0, hit: true });

  // partículas doradas masivas: anillo + notas que ascienden + chispas
  estallidoDorado(g, x, y, 26);
  for (let i = 0; i < 12; i++) {
    particula(g, x + (i - 6) * 3.5, y - 2, (i % 2 ? 1 : -1) * (8 + (i % 3) * 6),
      -34 - (i % 5) * 9, 1.1, i % 2 ? '#ffd88a' : '#fff3c0', 2, -6);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    particula(g, x + Math.cos(a) * 5, y - 6, Math.cos(a) * 110, Math.sin(a) * 70, 0.5, '#8a7ab0', 1.6, 60);
  }

  addFlashVesh(g, '#ffd88a', 0.45);
  addShakeVesh(g, 9);
  slowmoVesh(g, 0.4);
  audio.sfx('holy');
  audio.sfx('song');
}

/** Alias solicitado en la spec (mismo efecto exacto). */
export const drawVeshDeathFxR19 = veshDeathFxR19;

// ============================================================
// SPRITE — «director de orquesta de partituras oscuras» 30×24
// 5 frames (contrato): 0/1 flotar A/B · 2 cast · 3 batuta · 4 coda
// Paleta: #1a1424 base · #3a2a4a medio · #ffd88a dorado ·
//         #fff3c0 brillo · #8a7ab0 detalles
// Determinismo estricto: mulberry32 de semilla fija para los motes de
// tinta; construir dos veces produce canvas idénticos (smoke FNV).
// ============================================================

const PAL = {
  BASE: '#1a1424',
  MED: '#3a2a4a',
  GOLD: '#ffd88a',
  BRIGHT: '#fff3c0',
  DET: '#8a7ab0',
} as const;

function veshCv(): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = 30; c.height = 24;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

function rc(x: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, col: string): void {
  x.fillStyle = col;
  x.fillRect(rx, ry, rw, rh);
}

/** Disco pixelado determinista (halos). */
function disc(x: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, alpha = 1): void {
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

function buildVeshFrame(f: number): HTMLCanvasElement {
  const { c, x } = veshCv();
  const { BASE, MED, GOLD, BRIGHT, DET } = PAL;
  const bob = f === 1 ? 1 : 0;

  // ---- aura de batuta (luz que lo sostiene) ----
  disc(x, 15, 19 + bob, 9, GOLD, 0.10);

  // ---- manto de partituras (figura alargada, sin piernas: flota) ----
  for (let yy = 10; yy <= 22; yy++) {
    const half = 4 + Math.floor((yy - 10) * 0.5); // 4 → 10 (se abre al flotar)
    rc(x, 15 - half, yy + bob, half * 2 + 1, 1, BASE);
    rc(x, 15 + half - 2, yy + bob, 2, 1, MED);    // sombra del pliegue
    if (yy === 11 || yy === 14 || yy === 17 || yy === 20) {
      x.globalAlpha = 0.55;
      rc(x, 15 - half + 1, yy + bob, half * 2 - 1, 1, DET); // pentagrama
      x.globalAlpha = 1;
    }
  }
  // jirones de cola
  rc(x, 14, 23 + bob, 3, 1, MED);
  rc(x, 15, 22 + bob, 1, 2, MED);
  // hombros
  rc(x, 9, 10 + bob, 12, 2, MED);

  // ---- motes de tinta (deterministas: mulberry32 semilla fija por frame) ----
  const rng = mulberry32(0x1903 + f * 77);
  for (let i = 0; i < 2; i++) {
    const half = 7;
    const nx = 15 - half + 1 + Math.floor(rng() * (half * 2 - 2));
    const ny = 12 + Math.floor(rng() * 9);
    x.globalAlpha = 0.8;
    rc(x, nx, ny + bob, 1, 1, BRIGHT);
    x.globalAlpha = 1;
  }

  // ---- rostro: máscara dorada agrietada ----
  const mx = f === 3 ? 1 : 0; // la batuta lo inclina
  rc(x, 11 + mx, 2 + bob, 9, 7, GOLD);
  rc(x, 12 + mx, 1 + bob, 7, 1, GOLD);        // frente
  rc(x, 12 + mx, 2 + bob, 2, 2, BRIGHT);      // brillo del oro
  rc(x, 11 + mx, 9 + bob, 9, 1, MED);         // mentón en sombra
  rc(x, 12 + mx, 4 + bob, 2, 2, BASE);        // ojo hueco izq
  rc(x, 16 + mx, 4 + bob, 2, 2, BASE);        // ojo hueco der
  rc(x, 14 + mx, 7 + bob, 2, 1, BASE);        // boca (abre en cast)
  // grieta (el primer cantor se quebró primero)
  rc(x, 17 + mx, 1 + bob, 1, 2, BASE);
  rc(x, 16 + mx, 3 + bob, 1, 2, BASE);
  rc(x, 18 + mx, 5 + bob, 1, 2, MED);

  if (f === 0) {
    // batuta alzada a la derecha
    rc(x, 22, 9 + bob, 2, 2, MED);              // mano
    rc(x, 24, 7 + bob, 1, 2, BRIGHT);
    rc(x, 25, 5 + bob, 1, 2, BRIGHT);
    rc(x, 26, 4 + bob, 1, 1, GOLD);             // punta de luz
  } else if (f === 1) {
    // flotar B: la batuta inclinada, el manto se mece
    rc(x, 21, 10 + bob, 2, 2, MED);
    rc(x, 23, 8 + bob, 1, 2, BRIGHT);
    rc(x, 24, 6 + bob, 1, 2, BRIGHT);
    rc(x, 25, 5 + bob, 1, 1, GOLD);
    rc(x, 6, 13 + bob, 2, 4, MED);              // pliegue que se mueve
  } else if (f === 2) {
    // CAST: brazo extendido, batuta señalando, boca abierta
    rc(x, 14 + mx, 6 + bob, 2, 2, BASE);        // boca abierta (canta la nota)
    rc(x, 5, 12 + bob, 6, 2, MED);              // brazo extendido
    rc(x, 0, 12 + bob, 6, 1, BRIGHT);           // batuta horizontal
    rc(x, 0, 11 + bob, 1, 1, GOLD);             // punta
    disc(x, 15, 6 + bob, 7, GOLD, 0.18);        // halo del canto
    rc(x, 3, 10 + bob, 1, 1, DET);
    rc(x, 2, 14 + bob, 1, 1, DET);
  } else if (f === 3) {
    // BATUTA: gran barrido horizontal con estela
    x.globalAlpha = 0.4;
    rc(x, 9, 1, 14, 1, GOLD);                   // estela del barrido
    x.globalAlpha = 1;
    rc(x, 6, 3, 19, 1, BRIGHT);                 // la batuta cruzando el cielo
    rc(x, 5, 2, 1, 1, GOLD);                    // punta
    rc(x, 24, 4 + bob, 2, 2, MED);              // mano al final del arco
    disc(x, 15, 10 + bob, 8, GOLD, 0.14);
  } else {
    // CODA: ambos brazos arriba, batuta vertical, la máscara arde
    rc(x, 8, 4 + bob, 2, 6, MED);
    rc(x, 20, 4 + bob, 2, 6, MED);
    rc(x, 14, 0, 1, 7, BRIGHT);                 // batuta vertical
    disc(x, 14.5, 0.5, 1.5, GOLD, 0.9);         // punta encendida
    rc(x, 12 + mx, 4 + bob, 2, 2, BRIGHT);      // ojos encendidos
    rc(x, 16 + mx, 4 + bob, 2, 2, BRIGHT);
    rc(x, 17 + mx, 1 + bob, 1, 2, GOLD);        // las grietas brillan
    rc(x, 16 + mx, 3 + bob, 1, 2, GOLD);
    rc(x, 14 + mx, 6 + bob, 2, 2, BASE);        // boca plenamente abierta
    disc(x, 15, 5 + bob, 9, BRIGHT, 0.20);      // gran halo
    disc(x, 15, 12 + bob, 6, GOLD, 0.16);
  }

  return c;
}

/** 5 frames: 0/1 flotar A/B · 2 cast · 3 batuta · 4 coda. 30×24. */
export function buildVeshR19(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 5; f++) frames.push(buildVeshFrame(f));
  return frames;
}

let veshSprInit = false;

/** Idempotente: registerSpr('vesh', buildVeshR19()). */
export function initJefeVeshR19Sprites(): void {
  if (veshSprInit) return;
  veshSprInit = true;
  registerSpr('vesh', buildVeshR19());
}
