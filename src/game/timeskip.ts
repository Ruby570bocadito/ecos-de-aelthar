// ============================================================
// ECOS DE AELTHAR — INMERSIÓN DEL VIAJE TEMPORAL (agente 13-c)
// Que cambiar de época con Q se sienta como un ACONTECIMIENTO:
//   1) TRANSICIÓN (beginEpochShift): doble onda expansiva desde el
//      Portador (g.waves, dmg 0), flash suave por destino (addFlash),
//      sacudida leve, capa sfx propia ('save' al ir al pasado /
//      'quest' al volver, sobre el 'epoch' del motor) y ráfaga de
//      partículas de nota musical (configs CACHEADAS en módulo).
//      VETO narrativo: enemigo con aggro a <5 tiles → false + frase
//      rotativa + sacudida (el motor no alterna la época).
//   2) CONSECUENCIAS QUE CRUZAN ÉPOCAS: tabla genérica huella→frase.
//      Se ADQUIERE tocando el lugar en su época (puente, cobertizo,
//      lápidas/flores, muelles) o encendiendo faroles (flags del motor
//      lamp1..3) / tomando ecos menores (g.takenEchoes); al ATERRIZAR
//      en la época opuesta el mundo lo recuerda UNA VEZ por huella
//      (floatText escalonado + toast del primero). Marca ts_* en
//      g.flags → se serializa sola en save().
//   3) NPCs DUALES: Brisa/Mara/Mera — al cambiar de época a <6 tiles,
//      3 s de versos superpuestos (2 líneas alternando presente/pasado
//      por floats lentos). Cooldown 30 s por NPC (WeakMap runtime).
//   4) RESIDUOS DEL CANTO: en 'presente' motas doradas descendentes y
//      en 'pasado' notas ascendentes tenues cerca de los restos de
//      epochDiffs/lámparas visibles en cámara. Pool fijo de ranuras
//      (estilo fx.ts): las ranuras deciden CUÁNDO/DE NDE; cada spawn
//      entra al sistema de partículas del motor. Cap vivo ≤ 30 (<40).
// RENDER sin tocar render.ts: todo sale por g.waves / g.particles /
// g.floats / g.toast / g.flashT — los canales públicos del motor.
// ============================================================

import type { Game } from './engine';
import type { Epoch, MapId, Npc } from './types';
import { VIEW_W, VIEW_H, ZOOM } from './engine';
import { TILE } from './sprites';
import { MAPS } from './maps'; // solo lectura (mapas de otro agente)
import { audio } from './audio';
import { addShake, addFlash } from './fxcore';

// ---------------- Constantes ----------------

const VETO_TILES = 5;            // enemigo con aggro a <5 tiles veta el viaje
const DUAL_TILES = 6;            // radio de los versos duales
const DUAL_CD = 30;              // s de cooldown por NPC
const RESIDUE_SLOTS = 10;        // ranuras del pool de residuos (cap vivo ≤ 30)
const RECALL_MAX = 6;            // tope de recuerdos en cola

const VETO_PHRASES: string[] = [
  'Un enemigo te acecha: el tiempo no se teje bajo colmillos.',
  'El Eco calla: primero silencia lo que te muerde.',
  'La hora no cambia con aliento hostil en la nuca.',
];

// Huellas de LOCALIZACIÓN: rect de adquisición (tiles, inclusivo) en su
// época → el mundo recuerda al aterrizar en la época opuesta.
interface HuellaLoc {
  key: string;        // marca persistente ts_<key>
  map: MapId;
  ax0: number; ay0: number; ax1: number; ay1: number;
  acquire: Epoch;
  frase: string;
  fx: number; fy: number;   // dónde aparece el recuerdo (tiles)
}

const HUELLAS: HuellaLoc[] = [
  {
    key: 'puente', map: 'bosque', ax0: 24, ay0: 9, ax1: 27, ay1: 13, acquire: 'pasado',
    frase: 'Ayer cruzaste el puente; hoy el río se lo disputa tablón a tablón.',
    fx: 26, fy: 12,
  },
  {
    key: 'cobertizo', map: 'lunaris', ax0: 4, ay0: 24, ax1: 7, ay1: 27, acquire: 'pasado',
    frase: 'Donde ayer te estorbaba un cobertizo, hoy solo queda ruina y zarza.',
    fx: 6, fy: 26,
  },
  {
    key: 'lapidas', map: 'lunaris', ax0: 16, ay0: 19, ax1: 19, ay1: 21, acquire: 'pasado',
    frase: 'Pisaste flores en el ayer: hoy son dos lápidas que nadie nombra.',
    fx: 18, fy: 20,
  },
  {
    key: 'flores', map: 'lunaris', ax0: 16, ay0: 19, ax1: 19, ay1: 21, acquire: 'presente',
    frase: 'Las lápidas del presente, en el ayer eran flores: el suelo aún no sabe doler.',
    fx: 18, fy: 20,
  },
  {
    key: 'muelle_costa', map: 'costa', ax0: 27, ay0: 35, ax1: 30, ay1: 39, acquire: 'pasado',
    frase: 'El muelle que pisaste en el ayer no existe ya: el mar se lo quedó al despertar.',
    fx: 29, fy: 37,
  },
  {
    key: 'muelle_aldea', map: 'aldea', ax0: 37, ay0: 27, ax1: 40, ay1: 30, acquire: 'pasado',
    frase: 'Pisaste el muelle del festival: el presente ya no sabe sostener la madera.',
    fx: 39, fy: 29,
  },
];

// Huellas por FLAG del motor: los Faroles del Recuerdo se encienden en el
// pasado (props needPast de aldea); el presente los recuerda al volver.
const LAMP_HUELLAS: { flag: string; frase: string; fx: number; fy: number }[] = [
  { flag: 'lamp1', frase: 'Un farol arde en el ayer: alguna ventana de Merrow no está sola.', fx: 13, fy: 13 },
  { flag: 'lamp2', frase: 'La segunda luz cruzó el tiempo: la niebla aprende a temer.', fx: 28, fy: 14 },
  { flag: 'lamp3', frase: 'El tercer farol brilla donde el presente solo ve sombra.', fx: 20, fy: 22 },
];

const ECO_FRASE = 'Un eco que arrancaste tiembla aún entre estas horas del mundo.';

// Versos duales: [línea del PRESENTE, línea del PASADO] (alternan). Todos
// empiezan con elipsis suspensiva — firma propia de los duales, distinta de
// los rumores ambientales de worldlife (13-b).
const DUALS: Record<string, [string, string]> = {
  brisa: ['Brisa: «...aún canto, pequeño...»', 'Brisa: «...duerme, que el valle canta...»'],
  mara: ['Mara: «...la lámpara gira, la luz ya no...»', 'Mara: «...una nota por vuelta, abuela...»'],
  mera: ['Mera: «...dime un nombre y descanso...»', 'Mera: «...en el ayer aún lo sabía...»'],
};

// Configs de las notas de la transición — CACHEADAS al cargar el módulo
// (cero decisiones por transición: mismo choreography siempre).
const NOTE_CFG = Array.from({ length: 12 }, (_, i) => ({
  a: -Math.PI / 2 + ((i % 6) - 2.5) * 0.3,   // abanico hacia arriba
  d: 8 + (i % 3) * 6,                        // distancia de salida (px)
  s: 34 + (i % 4) * 16,                      // velocidad radial
  sz: 1.1 + (i % 3) * 0.45,                  // cabeza de la nota
  stem: i % 2 === 0,                         // la mitad llevan palito
  life: 0.8 + (i % 5) * 0.12,
}));

// ---------------- Estado de módulo (runtime; lo persistente son flags ts_*) ----------------

let prevEpoch: Epoch | null = null;   // detección del flip (frame anterior)
let lastPlayer: unknown = null;       // nueva partida/carga → estado limpio
let clock = 0;                        // reloj propio (s acumulados en timeTick):
                                      // no depende de g.globalT (solo avanza en el
                                      // bucle RAF; en hums sin RAF sigue contando)
let vetoIdx = 0;                      // rotación de frases de veto
let acquireAcc = 0;                   // throttle del escaneo de huellas (0.2 s)
let rotIdx = 0;                      // reparto circular de spots visibles

interface Recall { text: string; x: number | null; y: number | null; map: MapId; toast: boolean; delay: number }
const recalls: Recall[] = [];         // recuerdos escalonados pendientes de pintar

const pendingAcq = new Map<string, HuellaLoc>();  // tocadas y a la espera del flip

interface Duet { npc: Npc; lines: [string, string]; step: number; next: number }
const duets: Duet[] = [];
// ==== 17-d (qa-mundo): cooldown por NID, no por objeto. spawnNpcs() recréa
// las Npc en CADA loadMap: con WeakMap<Npc,…> el cooldown de 30 s se
// reiniciaba al salir y volver al mapa (versos duplicados cada re-entrada).
// La clave es el nid y se limpia al detectar partida nueva/carga.
const duetCd = new Map<string, number>();

interface Slot { next: number }
const residue: Slot[] = Array.from({ length: RESIDUE_SLOTS }, (_, i) => ({ next: 0.4 + i * 0.22 }));

// Spots de residuo por mapa: centros de celdas 4×4 de epochDiffs + faroles
// (los faroles solo sueltan motas en presente si su flag está encendida).
interface Spot { x: number; y: number; gate?: string }
const spotCache = new Map<MapId, Spot[]>();

// ============================================================
// beginEpochShift — lo llama engine.epochSwitch ANTES de alternar.
// Devuelve false para VETAR el viaje (momento hostil).
// ============================================================

export function beginEpochShift(g: Game): boolean {
  const p = g.player;
  if (!p) return true;

  // ==== 17-d (qa-mundo): veto por JEFE EN COMBATE. El veto aggro <5 tiles
  // de abajo no cubre a los jefes que pelean a distancia (notas de la Sirena,
  // rocas del Gólem, dagas de Vult): alternar de época a mitad de pelea
  // cambiaba tiles BAJO el combate (muelle, niebla, puentes). Veta si el
  // jefe del mapa tiene AGGRO (pelea viva a cualquier distancia) o si estás
  // a <12 tiles de un jefe activo (a punto de desencadenar). NO es pegajizo:
  // al romper el combate (leash) o alejarte, el viaje vuelve a disponible.
  // La Cripta ya veta por epochDiffs vacío; esto cubre costa/cumbres.
  const br = g.bossRef;
  if (g.bossActive && br && !br.dead &&
      (br.aggro || Math.hypot(br.x - p.x, br.y - p.y) < 12 * TILE)) {
    addShake(g, 4);
    g.toast('El jefe dicta el ritmo: este momento no se cambia.', '#c8b0e8');
    audio.sfx('error');
    return false;
  }

  // ---- veto narrativo: enemigo con aggro a <5 tiles ----
  for (const e of g.enemies) {
    if (e.dead || !e.aggro) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) < VETO_TILES * TILE) {
      vetoIdx = (vetoIdx + 1) % VETO_PHRASES.length;
      addShake(g, 4);
      g.toast(VETO_PHRASES[vetoIdx], '#c8b0e8');
      audio.sfx('error');
      return false;
    }
  }

  const toPast = g.epoch === 'presente';

  // ---- onda expansiva doble (dmg 0: pura escenografía del motor) ----
  g.waves.push({ x: p.x, y: p.y, r: 6, maxR: 72, speed: 210, dmg: 0, hit: true });
  g.waves.push({ x: p.x, y: p.y, r: 3, maxR: 100, speed: 290, dmg: 0, hit: true });

  // ---- flash suave teñido por DESTINO (dorado = ayer, azulado = hoy) ----
  // R13: en la Cuna la paleta es del SEGUNDO CANTO — plata al descender al
  // Aún (el tiempo sin estrenar), oro al aterrizar en el presente (el primer
  // día). toPast aquí significa «hacia la época alternativa del mapa».
  const isCuna = g.mapId === 'cuna';
  if (isCuna) addFlash(g, toPast ? '#d8d8ec' : '#ffe9a0', 0.14);
  else addFlash(g, toPast ? '#ffd88a' : '#a8b8d8', 0.12);
  addShake(g, 2); // latido leve de la realidad

  // ---- capa sfx propia sobre el 'epoch' que lanza el motor ----
  if (isCuna) audio.sfx(toPast ? 'quest' : 'save'); // el Aún abre; el presente, a hogar
  else audio.sfx(toPast ? 'save' : 'quest');

  // ---- ráfaga de notas musicales desde el Portador ----
  const c1 = isCuna ? (toPast ? '#d8d8ec' : '#ffe9a0') : (toPast ? '#ffd88a' : '#a8c8e8');
  const c2 = isCuna ? (toPast ? '#c8d0e8' : '#f0d890') : (toPast ? '#f0c060' : '#cfe0ff');
  for (let i = 0; i < NOTE_CFG.length; i++) {
    const n = NOTE_CFG[i];
    const nx = p.x + Math.cos(n.a) * n.d;
    const ny = p.y - 8 + Math.sin(n.a) * n.d * 0.55;
    g.particles.push({
      x: nx, y: ny, vx: Math.cos(n.a) * n.s, vy: Math.sin(n.a) * n.s - 26,
      t: n.life, maxT: n.life, color: i % 2 ? c1 : c2, size: n.sz, grav: -14,
    });
    if (n.stem) {
      g.particles.push({
        x: nx + n.sz * 1.6, y: ny - n.sz * 2.4,
        vx: Math.cos(n.a) * n.s * 0.9, vy: Math.sin(n.a) * n.s - 22,
        t: n.life * 0.8, maxT: n.life, color: c2, size: 0.7, grav: -14,
      });
    }
  }
  return true;
}

// ============================================================
// timeTick — detección de aterrizaje, adquisición de huellas,
// recuerdos escalonados, versos duales y residuos del canto.
// ============================================================

export function timeTick(g: Game, dt: number): void {
  const p = g.player;
  clock += dt;
  if (!p) { prevEpoch = null; return; }

  // nueva partida / carga: estado runtime limpio (los flags ts_ viajan en el save)
  if (g.player !== lastPlayer) {
    lastPlayer = g.player;
    prevEpoch = null;
    pendingAcq.clear();
    recalls.length = 0;
    duets.length = 0;
    duetCd.clear(); // ==== 17-d: cooldowns por nid también se reinician
  }

  // ---- 1) flip de época (compara con el frame anterior; sin tocar engine) ----
  if (prevEpoch !== null && prevEpoch !== g.epoch) onLanded(g);
  prevEpoch = g.epoch;

  const inGame = g.state === 'play' || g.state === 'dialogue';

  // ---- 2) adquisición de huellas de localización (throttle 0.2 s) ----
  if (inGame) {
    acquireAcc += dt;
    if (acquireAcc >= 0.2) { acquireAcc = 0; acquireScan(g); }
  }

  // ---- 3) recuerdos escalonados + versos duales ----
  recallsTick(g, dt);
  duetsTick(g, dt);
  if (inGame) residuesTick(g, dt);
}

// ---------------- Aterrizaje: el mundo recuerda ----------------

function onLanded(g: Game): void {
  // versos duales: aterrizar cerca de Brisa/Mara/Mera despierta el duelo
  // de versos (con cooldown propio por NPC)
  tryDuets(g);

  const fires: Recall[] = [];

  // a) faroles encendidos en el ayer → el presente los recuerda (una vez)
  if (g.epoch === 'presente') {
    for (const l of LAMP_HUELLAS) {
      if (g.flags[l.flag] && !g.flags[`ts_${l.flag}`]) {
        g.flags[`ts_${l.flag}`] = true;
        fires.push({ text: l.frase, x: l.fx * TILE + 8, y: l.fy * TILE + 8, map: 'aldea', toast: false, delay: 0 });
      }
    }
  }

  // b) huellas de localización tocadas en la época opuesta
  for (const [key, h] of pendingAcq) {
    if (g.epoch !== oppositeOf(h.acquire)) continue;
    pendingAcq.delete(key);
    g.flags[`ts_${h.key}`] = true;
    fires.push({ text: h.frase, x: h.fx * TILE + 8, y: h.fy * TILE + 8, map: h.map, toast: false, delay: 0 });
  }

  // c) ecos menores tomados (g.takenEchoes) — una vez por eco, máx 2 por aterrizaje
  let ecoFired = 0;
  for (const id of g.takenEchoes) {
    if (ecoFired >= 2) break;
    const ts = `ts_eco_${id}`;
    if (g.flags[ts]) continue;
    g.flags[ts] = true;
    ecoFired++;
    const def = MAPS[g.mapId].echoes.find(e => e.id === id);
    fires.push({
      text: ECO_FRASE,
      x: def ? def.x * TILE + 8 : null,
      y: def ? def.y * TILE + 8 : null,
      map: g.mapId, toast: false, delay: 0,
    });
  }

  // escalonado: 0.35 s + 0.9 s entre recuerdos; el primero también suena a toast
  for (let i = 0; i < fires.length && i < 4; i++) {
    fires[i].delay = 0.35 + i * 0.9;
    fires[i].toast = i === 0;
    recalls.push(fires[i]);
  }
  while (recalls.length > RECALL_MAX) recalls.shift();
}

function oppositeOf(e: Epoch): Epoch {
  return e === 'presente' ? 'pasado' : 'presente';
}

// ---------------- Adquisición (caminar sobre la huella en su época) ----------------

function acquireScan(g: Game): void {
  const p = g.player!;
  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor((p.y + p.h * 0.5) / TILE); // pies (convención de fx.ts)
  for (const h of HUELLAS) {
    if (h.map !== g.mapId || h.acquire !== g.epoch) continue;
    if (g.flags[`ts_${h.key}`] || pendingAcq.has(h.key)) continue;
    if (tx < h.ax0 || tx > h.ax1 || ty < h.ay0 || ty > h.ay1) continue;
    pendingAcq.set(h.key, h);
    // pista sutil: el lugar ha tomado nota (una vez por huella pendiente)
    g.floatAt(p.x, p.y - 22, h.acquire === 'pasado' ? '...el ayer toma nota...' : '...el hoy toma nota...', '#c8b0e8', 6);
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      g.particles.push({
        x: p.x + Math.cos(a) * 6, y: p.y - 8 + Math.sin(a) * 4,
        vx: Math.cos(a) * 14, vy: -14 - Math.random() * 10,
        t: 0.5, maxT: 0.5, color: '#ffe9a0', size: 1, grav: 0,
      });
    }
  }
}

// ---------------- Recuerdos escalonados ----------------

function recallsTick(g: Game, dt: number): void {
  for (let i = recalls.length - 1; i >= 0; i--) {
    const r = recalls[i];
    r.delay -= dt;
    if (r.delay > 0) continue;
    recalls.splice(i, 1);
    // la huella es de otro mapa (o muy lejos): el mundo lo recuerda IGUAL,
    // pero sobre el Portador (p. ej. faroles encendidos en Merrow y
    // recordados al aterrizar en Lunaris)
    const p = g.player!;
    const rx = r.x, ry = r.y;
    const local = r.map === g.mapId && rx !== null && ry !== null &&
      Math.hypot(rx - p.x, ry - p.y) <= 20 * TILE;
    if (local) g.floatAt(rx, ry, r.text, '#ffe9a0', 8);
    else g.floatAt(p.x, p.y - 24, r.text, '#ffe9a0', 8);
    if (r.toast) g.toast(r.text, '#ffe9a0');
  }
}

// ---------------- NPCs duales (versos superpuestos) ----------------

function duetsTick(g: Game, dt: number): void {
  for (let i = duets.length - 1; i >= 0; i--) {
    const d = duets[i];
    if (!g.npcs.includes(d.npc)) { duets.splice(i, 1); continue; }
    d.next -= dt;
    if (d.next > 0) continue;
    const past = d.step % 2 === 1;
    g.floats.push({
      x: d.npc.x, y: d.npc.y - 18 - (d.step % 2) * 15,
      text: d.lines[d.step % 2], t: 1.2,
      color: past ? '#ffd88a' : '#cfe0ff', vy: -5, size: 7,
    });
    d.step++;
    d.next = 0.55;
    if (d.step >= 6) duets.splice(i, 1); // 3 s de duelo de versos
  }
}

function tryDuets(g: Game): void {
  const p = g.player!;
  for (const n of g.npcs) {
    const lines = DUALS[n.nid];
    if (!lines) continue;
    if (Math.hypot(n.x - p.x, n.y - p.y) > DUAL_TILES * TILE) continue;
    // ==== 17-d: cooldown por nid (sobrevive a los loadMap que recréan las Npc)
    const last = duetCd.get(n.nid);
    if (last !== undefined && clock - last < DUAL_CD) continue;
    duetCd.set(n.nid, clock);
    duets.push({ npc: n, lines, step: 0, next: 0.15 });
  }
  while (duets.length > 4) duets.shift();
}

// ---------------- Residuos del canto (pool fijo, estilo fx.ts) ----------------

function residuesTick(g: Game, dt: number): void {
  if (g.particles.length > 240) return; // el combate manda: no competir por espacio
  const spots = spotsOf(g);
  const x0 = g.camX / ZOOM - 24, y0 = g.camY / ZOOM - 24;
  const x1 = (g.camX + VIEW_W) / ZOOM + 24, y1 = (g.camY + VIEW_H) / ZOOM + 24;
  const past = g.epoch === 'pasado';
  for (const s of residue) {
    s.next -= dt;
    if (s.next > 0) continue;
    s.next = 1 + Math.random() * 0.7;          // ranura ocupada ~1-1.7 s ⇒ vivo ≤ ~30
    const sp = pickVisible(spots, x0, y0, x1, y1, g, past);
    if (!sp) continue;
    const life = past ? 1.5 + Math.random() * 0.7 : 1.2 + Math.random() * 0.7;
    g.particles.push({
      x: sp.x + (Math.random() - 0.5) * 14, y: sp.y - 4 + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 10,
      vy: past ? -(12 + Math.random() * 10) : 14 + Math.random() * 12,  // ayer: notas suben; hoy: motas caen
      t: life, maxT: life,
      color: past
        ? (Math.random() < 0.6 ? '#c8b0e8' : '#ffd88a')
        : (Math.random() < 0.7 ? '#ffe9a0' : '#f0d890'),
      size: past ? 0.9 + Math.random() * 0.5 : 1 + Math.random() * 0.7,
      grav: past ? -6 : 0,
    });
  }
}

/** Spots del mapa (cacheados por mapa; las decisiones por frame no asignan memoria). */
function spotsOf(g: Game): Spot[] {
  const hit = spotCache.get(g.mapId);
  if (hit) return hit;
  const spots: Spot[] = [];
  const m = MAPS[g.mapId];
  const cells = new Map<string, { sx: number; sy: number; n: number }>();
  for (const d of m.epochDiffs) {
    const k = `${Math.floor(d.x / 4)}:${Math.floor(d.y / 4)}`;
    const c = cells.get(k) ?? { sx: 0, sy: 0, n: 0 };
    c.sx += d.x; c.sy += d.y; c.n++;
    cells.set(k, c);
  }
  for (const c of cells.values()) spots.push({ x: (c.sx / c.n) * TILE + 8, y: (c.sy / c.n) * TILE + 8 });
  for (const pr of m.props) {
    if (pr.kind === 'lamp') spots.push({ x: pr.x * TILE + 8, y: pr.y * TILE + 8, gate: pr.id });
  }
  spotCache.set(g.mapId, spots);
  return spots;
}

/** Elige un spot visible en cámara sin asignar memoria (2 pasadas + índice rotatorio). */
function pickVisible(spots: Spot[], x0: number, y0: number, x1: number, y1: number, g: Game, past: boolean): Spot | null {
  const vis = (s: Spot): boolean => {
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) return false;
    if (s.gate && !past && !g.flags[s.gate]) return false; // farol apagado en presente: sin motas
    return true;
  };
  let count = 0;
  for (const s of spots) if (vis(s)) count++;
  if (count === 0) return null;
  const target = rotIdx++ % count;
  let i = 0;
  for (const s of spots) {
    if (!vis(s)) continue;
    if (i === target) return s;
    i++;
  }
  return null;
}
