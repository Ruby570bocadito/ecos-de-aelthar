// ============================================================
// ECOS DE AELTHAR — ÁRBOL DE HABILIDADES (agente 12-b)
// ------------------------------------------------------------
// Pantalla propia (estado 'skills', tecla K). Tres ramas temáticas
// (Vía del Filo / Vía del Eco / Vía del Camino) con nodos pasivos,
// magias activas nuevas y herramientas. Los puntos de habilidad se
// ganan al subir de nivel (skillPointsEarned) y se gastan aquí.
//
// ARQUITECTURA (contrato con el motor, ver worklog Task 12-b):
// - El estado del árbol vive FUERA del Player (types.ts está
//   congelado): persistencia en localStorage 'ecos-arbol' con clave
//   `nombre|disciplina` + cache Map en este módulo. Lo transitorio
//   (cds de herramientas, escudo, proyectiles propios) va en una
//   WeakMap<Player, RT>.
// - applySkillStats() recalcula maxHp de forma ABSOLUTA
//   (baseDisciplina + (nivel−1)·7 + bonus del árbol): es idempotente
//   y no hace falta ordenar llamadas.
// - Los cds reducidos se aplican por decaimiento extra en skillTick
//   (funciona sin tocar engine.ts). Si el integrador prefiere
//   multiplicar en useSkill, llamar a setSkillCdDecay(false).
// - PUENTE de castSkill: skilltree envuelve Game.prototype.castSkill
//   (lazy, idempotente) para que las magias nuevas equipadas
//   funcionen hoy mismo. Desactivable con window.__ecos_no_skill_bridge.
//   La integración limpia es una línea en engine.castSkill:
//     if (castNewSkill(this, id)) return;
// ============================================================

import type { Enemy, Element, MapId, Player } from './types';
import { Game, VIEW_W, VIEW_H, ZOOM, playerMeleeDmg, playerSpellDmg } from './engine';
import {
  SKILLS, NEW_SKILLS, SKILL_TREE, TREE_BRANCHES, TOOL_INFO, QUEST_COMPASS,
  type SkillDef, type TreeNodeDef,
} from './data';
import { MAPS, tileAt } from './maps';
import { TILE } from './sprites';
import { audio } from './audio';
import { addFlash, addShake, applyKnockback } from './fxcore';
import { COL, addHit, button, panel, text, textShadow, wrapText } from './ui';

// ============================================================
// 1) PUNTOS DE HABILIDAD
// ============================================================

/**
 * Puntos TOTALES ganados al llegar a `level` (los gasta el árbol).
 * Política 12-b: 1 por nivel desde el 2 + 1 extra en Nv 5 y Nv 10
 * (hito de cada 5 niveles). Nv 12 = 13 puntos; el árbol completo
 * cuesta 31 → elegir una rama es obligado.
 */
export function skillPointsEarned(level: number): number {
  const lvl = Math.max(0, Math.floor(level));
  return Math.max(0, lvl - 1) + Math.floor(lvl / 5);
}

// ============================================================
// 2) ESTADO PERSISTENTE DEL ÁRBOL (fuera del Player)
// ============================================================

const STORE_KEY = 'ecos-arbol';

interface TreeSave {
  learned: string[];          // ids de SKILL_TREE aprendidos
  equip: (string | null)[];   // por hueco 0..3: id de NEW_SKILLS equipado (null = base)
}

/** Cache por identidad `nombre|disciplina` (vive mientras la página viva). */
const treeCache = new Map<string, TreeSave>();

function treeKey(p: Player): string {
  return `${p.name}|${p.discipline}`;
}

/** Lee (una vez por identidad) el árbol del localStorage y aplica el equipaje. */
function getTree(p: Player): TreeSave {
  const k = treeKey(p);
  const cached = treeCache.get(k);
  if (cached) return cached;
  const t: TreeSave = { learned: [], equip: [null, null, null, null] };
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, Partial<TreeSave>>;
    const raw = all[k];
    if (raw && Array.isArray(raw.learned)) {
      // valida contra los nodos actuales (guarda contra saves de otras versiones)
      t.learned = raw.learned.filter(id => SKILL_TREE.some(n => n.id === id));
      if (Array.isArray(raw.equip)) {
        for (let i = 0; i < 4; i++) t.equip[i] = typeof raw.equip[i] === 'string' ? (raw.equip[i] as string) : null;
      }
    }
  } catch { /* sin localStorage (stub de smoke): árbol volátil en memoria */ }
  treeCache.set(k, t);
  applyLoadout(p.discipline, t.equip);
  return t;
}

function saveTree(p: Player): void {
  const t = treeCache.get(treeKey(p));
  if (!t) return;
  try {
    const all: Record<string, TreeSave> = {};
    // escribe el cache completo (soporta varias partidas en la misma página)
    treeCache.forEach((v, key) => { all[key] = v; });
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch { /* noop */ }
}

function spentPoints(t: TreeSave): number {
  let s = 0;
  for (const id of t.learned) {
    const n = SKILL_TREE.find(nd => nd.id === id);
    if (n) s += n.cost;
  }
  return s;
}

/** Puntos disponibles para gastar (ganados − gastados). */
function pointsAvailable(p: Player): number {
  return skillPointsEarned(p.level) - spentPoints(getTree(p));
}

// ============================================================
// 3) ESTADÍSTICAS DERIVADAS (pasivas del árbol)
// ============================================================

/**
 * Aplica las pasivas de stats del árbol al Portador.
 * maxHp se recalcula de forma ABSOLUTA e idempotente:
 *   base(disciplina) + (nivel−1)·7 [motor] + 20 por 'Corazón de Roble'.
 * Se llama sola desde skillTick al cargar el árbol y tras gastar un
 * punto; el integrador puede llamarla también en newGame/continueGame
 * sin riesgo de doble suma.
 * NOTA: no se aplica en modo desafío (el árbol de campaña no toca la arena).
 */
export function applySkillStats(p: Player, challengeActive = false): void {
  if (challengeActive) return;
  const has = (id: string) => getTree(p).learned.includes(id);
  const base = p.discipline === 'alba' ? 110 : 96;
  const desired = base + (p.level - 1) * 7 + (has('c_vida') ? 20 : 0);
  if (p.maxHp !== desired) {
    p.maxHp = desired;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
  }
}

/** Multiplicador de daño por nodos (kind: 'melee' | 'hechizo' | 'todo'). */
export function skillDamageMult(g: Game, kind: string): number {
  const p = g.player;
  if (!p) return 1;
  const has = (id: string) => getTree(p).learned.includes(id);
  let m = 1;
  if (kind === 'melee' || kind === 'todo') {
    if (has('c_fuerte')) m *= 1.10; // Filo Templado
    if (has('c_colera')) m *= 1.15; // Cólera del Alba
  }
  if (kind === 'hechizo' || kind === 'todo') {
    if (has('a_mente')) m *= 1.20;  // Mente de Cristal
  }
  return m;
}

/** Reducción de cooldowns (1 = sin reducción; 0.8 = −20%). */
export function skillCdMult(p: Player): number {
  const has = (id: string) => getTree(p).learned.includes(id);
  let m = 1;
  if (has('c_cd')) m *= 0.8;  // Refrán Veloz
  if (has('a_cd')) m *= 0.8;  // Cadencia Arcana
  return m;
}

// --- camino A (activo por defecto): descuento extra de cds por frame ---
let cdDecayEnabled = true;
/** Si el integrador aplica skillCdMult al FIJAR cds (useSkill), desactivar
 *  este decaimiento para no descontar dos veces. */
export function setSkillCdDecay(on: boolean): void { cdDecayEnabled = on; }

// --- dev/QA hooks (patrón __iReset/__iDecoy de interaccion.ts) ---
/** ==== 17-e (qa): invalida el cache de árboles. El juego real NUNCA lo
 *  necesita (la UI aprende nodos mutando el cache), pero las pruebas que
 *  siembran 'ecos-arbol' por debajo del cache necesitan forzar la recarga. ==== */
export function __stReloadTrees(): void { treeCache.clear(); }

/** ==== 17-e (qa): limpia la selección de nodo del panel (el smoke mide el
 *  invariante "un hit por nodo" con el footer sin botones de acción). ==== */
export function __stResetSel(g: Game): void { selMap.delete(g); }

// ============================================================
// 4) EQUIPAJE DE MAGIAS NUEVAS EN LOS HUECOS 1-4
// ============================================================

/** Copia de los skills base por disciplina (antes de cualquier mutación). */
const BASE_SKILLS: Record<'alba' | 'tejedor', SkillDef[]> = {
  alba: [...SKILLS.alba],
  tejedor: [...SKILLS.tejedor],
};

const NEW_SKILL_IDS = new Set<string>([...NEW_SKILLS.alba, ...NEW_SKILLS.tejedor].map(s => s.id));

function findNewDef(id: string, disc: 'alba' | 'tejedor'): SkillDef | null {
  return NEW_SKILLS[disc].find(s => s.id === id) ?? null;
}

/** Aplica (idempotente) el equipaje guardado a la barra de skills del motor. */
function applyLoadout(disc: 'alba' | 'tejedor', equip: (string | null)[]): void {
  for (let s = 0; s < 4; s++) {
    const id = equip[s];
    const def = id ? findNewDef(id, disc) : null;
    // los huecos mantienenSkills base por defecto; un id de otra disciplina cae a base
    SKILLS[disc][s] = def ?? BASE_SKILLS[disc][s];
  }
}

/** Equipa una magia nueva en un hueco (0..3), sustituyendo a la que esté.
 *  La habilidad base desplazada "duerme" y vuelve al restaurar el hueco. */
export function equipNewSkill(p: Player, skillId: string, slot: number): boolean {
  if (slot < 0 || slot > 3) return false;
  const def = findNewDef(skillId, p.discipline);
  const node = SKILL_TREE.find(n => n.grants === skillId && n.kind === 'activa');
  if (!def || !node) return false;
  const t = getTree(p);
  if (!t.learned.includes(node.id)) return false;
  if (node.disc && node.disc !== p.discipline) return false;
  // una magia nueva solo ocupa un hueco a la vez
  for (let j = 0; j < 4; j++) if (t.equip[j] === skillId) t.equip[j] = null;
  t.equip[slot] = skillId;
  SKILLS[p.discipline][slot] = def;
  saveTree(p);
  audio.sfx('confirm');
  return true;
}

/** Restaura la habilidad base de un hueco. */
export function unequipSlot(p: Player, slot: number): void {
  if (slot < 0 || slot > 3) return;
  const t = getTree(p);
  t.equip[slot] = null;
  SKILLS[p.discipline][slot] = BASE_SKILLS[p.discipline][slot];
  saveTree(p);
}

// ============================================================
// 5) ESTADO TRANSITORIO (WeakMap — no se serializa)
// ============================================================

interface Lance { x: number; y: number; vx: number; vy: number; t: number; dmg: number; hits: Set<Enemy> }

interface RT {
  loadedKey: string | null;        // identidad ya inicializada
  prevHp: number;                  // para absorción reactiva (escudo/amuleto)
  prevGold: number;                // delta de oro (Ojo del Mercader)
  prevKills: number;
  prevLevel: number;               // aviso de +puntos al subir de nivel
  prevKeys: Set<string>;           // flanco de teclas 5/6/7
  combat: boolean;                 // flanco de combate (recarga del amuleto)
  campanaCd: number;
  brujulaCd: number;
  amuletoCharge: boolean;
  compassT: number;                // Brújula activa (s restantes)
  compassTick: number;
  compassTarget: { x: number; y: number } | null;
  compassMap: MapId | null;
  shield: number;                  // Bendición: absorción restante
  shieldT: number;                 // Bendición: tiempo restante
  auraT: number;                   // Aureola de Ceniza activa
  auraTick: number;
  lances: Lance[];                 // Lanzas del Alba en vuelo
  echoTimers: number[];            // ecos del Filo pendientes
  attackPrev: number;              // flanco de attackT (golpe nuevo)
}

const rtMap = new WeakMap<Player, RT>();

function rtOf(p: Player): RT {
  let rt = rtMap.get(p);
  if (!rt) {
    rt = {
      loadedKey: null, prevHp: p.hp, prevGold: p.gold, prevKills: p.kills, prevLevel: p.level,
      prevKeys: new Set<string>(), combat: false,
      campanaCd: 0, brujulaCd: 0, amuletoCharge: false,
      compassT: 0, compassTick: 0, compassTarget: null, compassMap: null,
      shield: 0, shieldT: 0, auraT: 0, auraTick: 0,
      lances: [], echoTimers: [], attackPrev: 0,
    };
    rtMap.set(p, rt);
  }
  return rt;
}

/** Carga el árbol del jugador (una vez) y sincroniza stats + snapshots. */
function ensureTreeForPlayer(g: Game, p: Player, rt: RT): void {
  const k = treeKey(p);
  if (rt.loadedKey === k) return;
  rt.loadedKey = k;
  const t = getTree(p); // carga si hace falta (cache-miss aplica loadout)
  // re-aplicar el loadout SIEMPRE: SKILLS es un array compartido por módulo y
  // otro perfil (p.ej. seguir jugando tras cambiar de partida) pudo mutarlo;
  // sin esto, al continuar una partida el equipaje del Portador se perdía.
  applyLoadout(p.discipline, t.equip);
  applySkillStats(p, !!g.challengeRun);
  rt.prevHp = p.hp;
  rt.prevGold = p.gold;
  rt.prevKills = p.kills;
}

// ============================================================
// 6) MAGIAS NUEVAS — castNewSkill
// ============================================================

/** Dirección de apuntado con el ratón (misma fórmula que el motor). */
function aimDir(g: Game): { nx: number; ny: number } {
  const p = g.player!;
  const wx = g.mouse.x / ZOOM + g.camX / ZOOM;
  const wy = g.mouse.y / ZOOM + g.camY / ZOOM;
  const dx = wx - p.x, dy = wy - p.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  return { nx: dx / len, ny: dy / len };
}

/**
 * EFECTOS de las magias nuevas (el switch de castSkill no los conoce).
 * Contrato de integración: llamar desde engine.castSkill con
 * `if (castNewSkill(this, id)) return;` — devuelve false para los ids
 * base y para magias no aprendidas (sin efectos secundarios).
 * El COSTE y el CD ya los gestiona engine.useSkill leyendo SKILLS
 * (el equipaje de este módulo pone la SkillDef en el hueco).
 */
export function castNewSkill(g: Game, skillId: string): boolean {
  const p = g.player;
  if (!p || g.state !== 'play') return false;
  const node = SKILL_TREE.find(n => n.kind === 'activa' && n.grants === skillId);
  if (!node) return false;
  const t = getTree(p);
  if (!t.learned.includes(node.id)) return false;
  if (node.disc && node.disc !== p.discipline) return false;
  const rt = rtOf(p);
  const def = findNewDef(skillId, p.discipline);
  if (def && def.element !== 'ninguno') g.lastNote = def.element; // sinergia con Canto Mayor
  switch (skillId) {
    // ---- ALBA ----
    case 'onda': {
      // Onda Sísmica: empuje + daño en área alrededor del Portador
      audio.sfx('slam');
      const dmg = playerMeleeDmg(p) * 1.3 * skillDamageMult(g, 'melee');
      g.aoeHit(p.x, p.y, 56, dmg, 'sagrado', false);
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 76 + e.w / 2) applyKnockback(e, e.x - p.x, e.y - p.y, 240);
      }
      g.waves.push({ x: p.x, y: p.y, r: 6, maxR: 76, speed: 150, dmg: 0, hit: true });
      g.burst(p.x, p.y, '#e8d8a0', 16, 85);
      addShake(g, 4);
      return true;
    }
    case 'lanza': {
      // Lanza del Alba: proyectil de luz propio que perfora (hasta 4 enemigos)
      audio.sfx('holy');
      const { nx, ny } = aimDir(g);
      const dmg = playerMeleeDmg(p) * 1.15 * skillDamageMult(g, 'melee');
      rt.lances.push({ x: p.x + nx * 10, y: p.y - 6 + ny * 10, vx: nx * 250, vy: ny * 250, t: 1.1, dmg, hits: new Set<Enemy>() });
      g.burst(p.x + nx * 12, p.y - 6 + ny * 12, '#fff8c0', 8, 60);
      return true;
    }
    case 'bendi': {
      // Bendición del Camino: escudo temporal que absorbe daño
      audio.sfx('holy');
      rt.shield = Math.round(p.maxHp * 0.25);
      rt.shieldT = 10;
      g.toast(`Bendición del Camino: escudo de ${rt.shield} (10 s)`, '#ffe9a0');
      addFlash(g, '#fff8c0', 0.12);
      g.burst(p.x, p.y - 6, '#ffe9a0', 18, 80);
      return true;
    }
    // ---- TEJEDORA ----
    case 'nova': {
      // Nova de Escarcha: congelación + daño en área
      audio.sfx('ice');
      const dmg = playerSpellDmg(p) * 1.6 * skillDamageMult(g, 'hechizo');
      g.aoeHit(p.x, p.y, 64, dmg, 'hielo', false);
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 72 + e.w / 2) {
          // ==== 17-a (qa-combate) ==== se empujaba un 'congelado' CRUDO tras
          // el que aoeHit→damageEnemy ya aplicó/refrescó: duplicados en la
          // pila de estados (mismo convenio de refresco con tope).
          const c = e.statuses.find(s => s.kind === 'congelado');
          if (c) c.t = Math.min(5, Math.max(c.t, 2.5));
          else e.statuses.push({ kind: 'congelado', t: 2.5, power: 1 });
        }
      }
      g.waves.push({ x: p.x, y: p.y, r: 6, maxR: 70, speed: 140, dmg: 0, hit: true });
      g.burst(p.x, p.y, '#a0e8ff', 24, 95);
      addFlash(g, '#a0e8ff', 0.15);
      addShake(g, 3);
      return true;
    }
    case 'rayos': {
      // Tormenta Encadenada: 5 saltos de rayo (el motor encadena)
      audio.sfx('bolt');
      const dmg = playerSpellDmg(p) * 1.15 * skillDamageMult(g, 'hechizo');
      const { nx, ny } = aimDir(g);
      g.chainLightning(p.x, p.y - 6, dmg, 5, nx, ny);
      addFlash(g, '#ffe86a', 0.12);
      return true;
    }
    case 'aurea': {
      // Aureola de Ceniza: aura de fuego durante 6 s (la aplica skillTick)
      audio.sfx('fire');
      rt.auraT = 6;
      rt.auraTick = 0;
      g.toast('Aureola de Ceniza: el aire arde a tu alrededor (6 s)', '#ff9040');
      g.burst(p.x, p.y, '#ff9040', 16, 70);
      return true;
    }
    default:
      return false;
  }
}

// ============================================================
// 7) HERRAMIENTAS ACTIVAS — activateTool (teclas 5/6/7 o árbol)
// ============================================================

/** Rumbo cardinal en español desde un vector (para el toast de la Brújula). */
function cardinal(dx: number, dy: number): string {
  const dirs = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  const a = Math.atan2(dy, dx);
  const idx = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return dirs[idx];
}

// --- grafo de mapas para la Brújula (BFS sobre las salidas de MAPS) ---
let adjCache: Record<string, MapId[]> | null = null;

function adjacency(): Record<string, MapId[]> {
  if (adjCache) return adjCache;
  const sets: Record<string, Set<MapId>> = {};
  for (const m of Object.values(MAPS)) {
    if (!sets[m.id]) sets[m.id] = new Set<MapId>();
    for (const ex of m.exits) {
      sets[m.id].add(ex.to);
      if (!sets[ex.to]) sets[ex.to] = new Set<MapId>();
      sets[ex.to].add(m.id);
    }
  }
  const out: Record<string, MapId[]> = {};
  for (const k of Object.keys(sets)) out[k] = [...sets[k]];
  adjCache = out;
  return out;
}

/** Primer salto del camino más corto from→to (null si no hay ruta). */
function nextHop(from: MapId, to: MapId): MapId | null {
  const adj = adjacency();
  if (from === to) return from;
  const prev = new Map<MapId, MapId>();
  const queue: MapId[] = [from];
  const seen = new Set<MapId>([from]);
  while (queue.length) {
    const cur = queue.shift() as MapId;
    for (const nb of adj[cur] ?? []) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      prev.set(nb, cur);
      if (nb === to) {
        let hop: MapId = nb;
        while (prev.get(hop) !== from) hop = prev.get(hop) as MapId;
        return hop;
      }
      queue.push(nb);
    }
  }
  return null;
}

function mapOfNpc(nid?: string): MapId | null {
  if (!nid) return null;
  for (const m of Object.values(MAPS)) if (m.npcs.some(n => n.id === nid)) return m.id;
  return null;
}
function mapOfProp(pid?: string): MapId | null {
  if (!pid) return null;
  for (const m of Object.values(MAPS)) if (m.props.some(pd => pd.id === pid)) return m.id;
  return null;
}
function mapOfEnemy(et?: string): MapId | null {
  if (!et) return null;
  for (const m of Object.values(MAPS)) if (m.spawns.some(s => s.type === et)) return m.id;
  return null;
}

/** Resuelve el objetivo de la Brújula EN el mapa actual (null si no está aquí). */
function resolveTargetHere(g: Game, t: { npc?: string; etype?: string; prop?: string; lamp?: boolean }): { x: number; y: number } | null {
  const p = g.player!;
  const tilePos = (tx: number, ty: number) => ({ x: tx * TILE + 8, y: ty * TILE + 8 });
  if (t.npc) {
    const live = g.npcs.find(n => n.nid === t.npc);
    if (live) return { x: live.x, y: live.y };
    const def = g.map.npcs.find(n => n.id === t.npc);
    if (def) return tilePos(def.x, def.y);
    return null;
  }
  if (t.etype) {
    let best: Enemy | null = null, bd = Infinity;
    for (const e of g.enemies) {
      if (e.dead || e.etype !== t.etype) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  if (t.prop) {
    const pd = g.map.props.find(pr => pr.id === t.prop);
    return pd ? tilePos(pd.x, pd.y) : null;
  }
  if (t.lamp) {
    // farol sin encender más cercano (props kind 'lamp' aún sin flag)
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const pd of g.map.props) {
      if (pd.kind !== 'lamp' || g.flags[pd.id]) continue;
      const w = tilePos(pd.x, pd.y);
      const d = Math.hypot(w.x - p.x, w.y - p.y);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }
  return null;
}

/** Objetivo actual de la misión para la Brújula de Ecos (posiciones en px). */
function questTargetPos(g: Game): { x: number; y: number } | null {
  const list = QUEST_COMPASS[g.questIdx];
  if (!list || list.length === 0) return null;
  const t = list[Math.min(g.questStep, list.length - 1)];
  const here = resolveTargetHere(g, t);
  if (here) return here;
  // destino en otro mapa: señala la salida correcta (siguiente salto del BFS)
  const dest = t.map ?? mapOfNpc(t.npc) ?? mapOfProp(t.prop) ?? mapOfEnemy(t.etype);
  if (!dest || dest === g.mapId) {
    // viaje dentro del mismo mapa sin referencia: centro del mapa
    if (dest === g.mapId && t.map) return { x: (g.map.w * TILE) / 2, y: (g.map.h * TILE) / 2 };
    return null;
  }
  const hop = nextHop(g.mapId, dest);
  if (!hop) return null;
  const exit = g.map.exits.find(e => e.to === hop);
  if (!exit) return null;
  return { x: (exit.x + exit.w / 2) * TILE, y: (exit.y + exit.h / 2) * TILE };
}

/**
 * HERRAMIENTAS ACTIVAS (contrato 12-b). Se exporta también con el nombre
 * del contrato `activateTool` (alias al final del módulo; el nombre interno es
 * activateTool porque eslint/react-hooks interpreta cualquier función
 * "use*" como Hook).
 * Cableado actual: teclas 5/6/7 por flanco en skillTick + botón "Usar"
 * en el árbol. El integrador puede llamarla desde onKeyDown:
 *   if (['5','6','7'].includes(k)) activateTool(this, ['campana','brujula','amuleto'][+k-5]);
 * Devuelve true si la herramienta se activó.
 */
export function activateTool(g: Game, toolId: string): boolean {
  const p = g.player;
  if (!p) return false;
  const node = SKILL_TREE.find(n => n.kind === 'herramienta' && n.grants === toolId);
  if (!node || !getTree(p).learned.includes(node.id)) {
    g.toast('Aún no posees ese encantamiento (árbol de habilidades: K)', '#9aa0b8');
    return false;
  }
  const rt = rtOf(p);
  switch (toolId) {
    case 'campana': {
      if (rt.campanaCd > 0) {
        g.toast(`La Campana aún resuena (${Math.ceil(rt.campanaCd)} s)`, '#9aa0b8');
        return false;
      }
      const [sx, sy] = g.sanctuaryPos(g.mapId);
      rt.campanaCd = TOOL_INFO.campana.cd;
      audio.sfx('save');
      if (g.state !== 'play') g.setState('play'); // fadeTo solo avanza en juego
      g.toast('La Campana del Retorno resuena: el mundo se pliega hacia el Santuario...', '#ffe9a0');
      g.fadeTo(g.mapId, sx, sy);
      return true;
    }
    case 'brujula': {
      if (rt.brujulaCd > 0) {
        g.toast(`La Brújula descansa (${Math.ceil(rt.brujulaCd)} s)`, '#9aa0b8');
        return false;
      }
      const tgt = questTargetPos(g);
      if (!tgt) {
        g.toast('Ninguna misión reclama tu rumbo', '#9aa0b8');
        return false;
      }
      rt.brujulaCd = TOOL_INFO.brujula.cd;
      rt.compassT = 20;
      rt.compassTick = 0;
      rt.compassTarget = tgt;
      rt.compassMap = g.mapId;
      const dx = tgt.x - p.x, dy = tgt.y - p.y;
      g.toast(`Los ecos susurran: tu misión aguarda hacia el ${cardinal(dx, dy)}...`, '#ffe9a0');
      audio.sfx('quest');
      return true;
    }
    case 'amuleto': {
      g.toast(
        rt.amuletoCharge
          ? 'El Amuleto de Aelthar vibra: absorberá el próximo golpe'
          : 'El Amuleto duerme: entra en combate y despertará',
        rt.amuletoCharge ? '#ffe9a0' : '#9aa0b8',
      );
      audio.sfx('blip');
      return true;
    }
    default:
      return false;
  }
}

// (contrato estandarizado: la herramienta activa es `activateTool` — el nombre
// `activateTool` se descartó porque ESLint lo interpreta como React Hook)

// ============================================================
// 8) PUENTE de castSkill (funciona hoy; integrable limpio mañana)
// ============================================================

let bridgeDone = false;

/** Envuelve Game.prototype.castSkill una sola vez: los ids de NEW_SKILLS
 *  se desvían a castNewSkill. Idempotente y apagable en runtime. */
function ensureBridge(): void {
  if (bridgeDone) return;
  bridgeDone = true;
  try {
    if (typeof window === 'undefined') return; // entornos sin DOM: nada que puentear
    const proto = Game.prototype as unknown as {
      castSkill?: (this: Game, id: string, element: Element) => void;
    };
    const orig = proto.castSkill;
    if (typeof orig !== 'function') return;
    if ((orig as unknown as { __ecosBridge?: boolean }).__ecosBridge) return;
    const wrapped = function castSkillBridge(this: Game, id: string, element: Element): void {
      const w = window as unknown as { __ecos_no_skill_bridge?: boolean };
      if (!w.__ecos_no_skill_bridge && NEW_SKILL_IDS.has(id) && castNewSkill(this, id)) return;
      orig.call(this, id, element);
    };
    (wrapped as unknown as { __ecosBridge?: boolean }).__ecosBridge = true;
    proto.castSkill = wrapped;
  } catch { /* sin puente: queda el cableado del integrador */ }
}

// ============================================================
// 9) TICK por frame (llamado desde Game.update en TODOS los estados)
// ============================================================

export function skillTick(g: Game, dt: number): void {
  ensureBridge();
  const p = g.player;
  if (!p) return;
  const rt = rtOf(p);
  ensureTreeForPlayer(g, p, rt);
  const tree = getTree(p);
  const has = (id: string) => tree.learned.includes(id);

  // aviso de puntos al subir de nivel (gainXp es del motor; este es el eco)
  if (p.level > rt.prevLevel && rt.prevLevel > 0) {
    const n = p.level - rt.prevLevel;
    g.toast(`+${n} punto${n > 1 ? 's' : ''} de habilidad: pulsa K y mira tu constelación`, '#ffe86a');
    audio.sfx('quest');
  }
  rt.prevLevel = p.level;

  const playing = g.state === 'play';
  if (playing) {
    // ---- Ojo del Mercader: +20% de oro por delta (killEnemy/cofres no se tocan) ----
    if (has('t_gold') && p.gold > rt.prevGold) {
      const bonus = Math.round((p.gold - rt.prevGold) * 0.2);
      if (bonus > 0) {
        p.gold += bonus;
        g.floatAt(p.x, p.y - 26, `+${bonus} (Ojo del Mercader)`, '#f0c84a');
      }
    }
    // ---- Aliento Cálido / Afinación: regeneraciones pasivas ----
    if (has('a_sta')) p.sta = Math.min(p.maxSta, p.sta + 26 * 0.4 * dt);
    if (has('a_res')) p.res = Math.min(p.maxRes, p.res + 1.5 * dt);
    // ---- Refrán Veloz / Cadencia Arcana: descuento extra de cooldowns ----
    if (cdDecayEnabled) {
      const m = skillCdMult(p);
      if (m < 1) {
        const extra = dt * (1 / m - 1); // decaimiento total ≈ dt/m → cd efectivo = cd·m
        for (let i = 0; i < p.cds.length; i++) if (p.cds[i] > 0) p.cds[i] = Math.max(0, p.cds[i] - extra);
      }
    }
    // ---- Paso de Brisa: +12% de velocidad (empujoncito que respeta muros) ----
    if (has('t_speed') && p.rollT <= 0 && p.attackT <= 0 && !p.charging) {
      const k = g.keys;
      let mx = 0, my = 0;
      if (k.has('a') || k.has('arrowleft')) mx -= 1;
      if (k.has('d') || k.has('arrowright')) mx += 1;
      if (k.has('w') || k.has('arrowup')) my -= 1;
      if (k.has('s') || k.has('arrowdown')) my += 1;
      if (mx !== 0 || my !== 0) {
        // sobre hielo ('i') no se empurra: la inercia del Acto II manda
        const tile = tileAt(g.map, g.rows, Math.floor(p.x / TILE), Math.floor((p.y + p.h / 2) / TILE), g.epoch);
        if (tile !== 'i') {
          const l = Math.hypot(mx, my) || 1;
          g.moveEntity(p, (mx / l) * 74 * 0.12 * dt, (my / l) * 74 * 0.12 * dt);
        }
      }
    }
    // ---- Eco del Filo: golpe nuevo → eco retardado en área ----
    if (p.attackT > 0 && rt.attackPrev <= 0 && has('c_eco') && p.rollT <= 0) {
      rt.echoTimers.push(0.16);
    }
    rt.attackPrev = p.attackT;
    for (let i = rt.echoTimers.length - 1; i >= 0; i--) {
      rt.echoTimers[i] -= dt;
      if (rt.echoTimers[i] <= 0) {
        rt.echoTimers.splice(i, 1);
        if (g.state === 'play') {
          const dmg = playerMeleeDmg(p) * 0.35 * skillDamageMult(g, 'melee');
          g.aoeHit(p.x, p.y, 30, dmg, 'ninguno', false);
          g.waves.push({ x: p.x, y: p.y, r: 4, maxR: 30, speed: 110, dmg: 0, hit: true });
          g.burst(p.x, p.y, '#ffe86a', 6, 50);
          audio.sfx('swing');
        }
      }
    }
    // ---- Aureola de Ceniza: quemadura periódica en anillo ----
    if (rt.auraT > 0) {
      rt.auraT -= dt;
      rt.auraTick -= dt;
      if (rt.auraTick <= 0) {
        rt.auraTick = 0.5;
        const dmg = playerSpellDmg(p) * 0.45 * skillDamageMult(g, 'hechizo');
        for (const e of g.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < 48 + e.w / 2) {
            g.damageEnemy(e, dmg, 'fuego', 0);
            // ==== 17-a (qa-combate) ==== aquí se apilaba un status 'quemado'
            // CRUDO por cada tick de aura (0,5 s): damageEnemy REFRESCA la
            // pila con tope (t≤6 · power≤8), pero este push añadía entradas
            // nuevas sin fusión y el bucle de quemado suma power·dt de TODAS
            // → DPS de quemado sin límite, trivializando quiebres y jefes.
            // Mismo convenio de refresco con tope que damageEnemy.
            const b = e.statuses.find(s => s.kind === 'quemado');
            const pow = 3 + p.attrs.int * 0.25;
            if (b) { b.t = Math.min(6, Math.max(b.t, 1.2)); b.power = Math.min(8, Math.max(b.power, pow)); }
            else e.statuses.push({ kind: 'quemado', t: 1.2, power: pow });
          }
        }
      }
      if (Math.random() < 0.45) {
        const a = Math.random() * Math.PI * 2;
        g.particles.push({
          x: p.x + Math.cos(a) * 40, y: p.y + Math.sin(a) * 40 - 4,
          vx: Math.cos(a) * 10, vy: -30 - Math.random() * 20,
          t: 0.4, maxT: 0.4, color: '#ff9040', size: 1.6, grav: 0,
        });
      }
    }
    // ---- Bendición: escudo con vida propia + halo ----
    if (rt.shieldT > 0) {
      rt.shieldT -= dt;
      if (rt.shieldT <= 0) {
        rt.shield = 0;
        g.toast('La Bendición se desvanece', '#9aa0b8');
      } else if (Math.random() < 0.2) {
        const a = Math.random() * Math.PI * 2;
        g.particles.push({
          x: p.x + Math.cos(a) * 16, y: p.y - 4 + Math.sin(a) * 16,
          vx: Math.cos(a) * 6, vy: Math.sin(a) * 6 - 8,
          t: 0.35, maxT: 0.35, color: '#ffe9a0', size: 1.4, grav: 0,
        });
      }
    }
    // ---- Amuleto: recarga al empezar una oleada de combate (flanco aggro) ----
    const combat = g.enemies.some(e => e.aggro && !e.dead);
    if (combat && !rt.combat && has('t_amuleto') && !rt.amuletoCharge) {
      rt.amuletoCharge = true;
      g.toast('El Amuleto de Aelthar despierta: absorberá un golpe', '#ffe9a0');
    }
    rt.combat = combat;
    // ---- absorción reactiva (la única forma sin tocar damagePlayer) ----
    // damagePlayer ya aplicó el golpe este frame (iframes incluidos); aquí se
    // revierte sobre el escudo/amuleto. Los golpes letales NO se absorben
    // (a hp<=0 el motor ya procesó la muerte).
    if (p.hp < rt.prevHp - 0.01 && p.hp > 0) {
      let pend = rt.prevHp - p.hp;
      if (rt.shield > 0) {
        const ab = Math.min(rt.shield, pend);
        rt.shield -= ab;
        p.hp += ab;
        pend -= ab;
        g.floatAt(p.x, p.y - 26, `escudo +${Math.round(ab)}`, '#ffe9a0');
        if (rt.shield <= 0) {
          g.toast('La Bendición se rompe absorbiendo el golpe', '#ffe9a0');
          audio.sfx('parry');
          g.burst(p.x, p.y - 4, '#ffe9a0', 14, 70);
        }
      }
      if (pend > 0 && rt.amuletoCharge && has('t_amuleto')) {
        p.hp += pend;
        rt.amuletoCharge = false;
        p.iframes = Math.max(p.iframes, 0.5);
        g.floatAt(p.x, p.y - 32, 'Amuleto: golpe absorbido', '#ffe9a0', 10);
        g.toast('El Amuleto de Aelthar se quiebra: el golpe se disuelve en canto', '#ffe9a0');
        audio.sfx('parry');
        addFlash(g, '#fff8c0', 0.12);
        g.burst(p.x, p.y - 4, '#ffe9a0', 18, 90);
      }
    }
    // ---- herramientas: teclas 5/6/7 por flanco (el motor las ignora) ----
    for (const tid of ['campana', 'brujula', 'amuleto']) {
      const key = TOOL_INFO[tid].key;
      if (g.keys.has(key) && !rt.prevKeys.has(key)) activateTool(g, tid);
    }
    if (rt.campanaCd > 0) rt.campanaCd -= dt;
    if (rt.brujulaCd > 0) rt.brujulaCd -= dt;
    // ---- Brújula de Ecos: rastro dorado hacia el objetivo ----
    if (rt.compassT > 0) {
      rt.compassT -= dt;
      if (rt.compassMap !== g.mapId) {
        const t = questTargetPos(g);
        rt.compassTarget = t;
        rt.compassMap = g.mapId;
      }
      rt.compassTick -= dt;
      if (rt.compassTick <= 0 && rt.compassTarget) {
        rt.compassTick = 0.22;
        const dx = rt.compassTarget.x - p.x, dy = rt.compassTarget.y - p.y;
        const l = Math.max(1, Math.hypot(dx, dy));
        g.particles.push({
          x: p.x + (Math.random() - 0.5) * 8, y: p.y + (Math.random() - 0.5) * 6,
          vx: (dx / l) * 46, vy: (dy / l) * 46 - 6,
          t: 0.8, maxT: 0.8, color: '#ffe9a0', size: 1.6, grav: 0,
        });
      }
    }
    // ---- Lanzas del Alba: proyectil perforante propio ----
    stepLances(g, rt, dt);
  }

  // snapshots para flancos/deltas del siguiente frame
  rt.prevHp = p.hp;
  rt.prevGold = p.gold;
  rt.prevKills = p.kills;
  rt.prevKeys = new Set(g.keys);
}

/** Paso propio de las Lanzas del Alba (el pipeline de projectiles del motor
 *  muere en el primer impacto: la perforación vive aquí). */
function stepLances(g: Game, rt: RT, dt: number): void {
  for (let i = rt.lances.length - 1; i >= 0; i--) {
    const ln = rt.lances[i];
    ln.x += ln.vx * dt;
    ln.y += ln.vy * dt;
    ln.t -= dt;
    if (Math.random() < 0.7) {
      g.particles.push({
        x: ln.x + (Math.random() - 0.5) * 4, y: ln.y + (Math.random() - 0.5) * 4,
        vx: 0, vy: 0, t: 0.2, maxT: 0.2, color: '#fff8c0', size: 1.8, grav: 0,
      });
    }
    let dead = ln.t <= 0 || g.tileSolidAt(ln.x, ln.y);
    if (!dead) {
      for (const e of g.enemies) {
        if (e.dead || ln.hits.has(e)) continue;
        if (Math.hypot(e.x - ln.x, e.y - ln.y) < 12 + e.w / 2) {
          ln.hits.add(e);
          g.damageEnemy(e, ln.dmg, 'sagrado', 40, Math.sign(ln.vx), Math.sign(ln.vy));
          g.burst(ln.x, ln.y, '#fff8c0', 6, 55);
          if (ln.hits.size >= 4) { dead = true; break; } // perfora hasta 4
        }
      }
    }
    if (dead) {
      g.burst(ln.x, ln.y, '#ffe86a', 10, 70);
      rt.lances.splice(i, 1);
    }
  }
}

// ============================================================
// 10) PANTALLA DEL ÁRBOL (estado 'skills' → render.ts)
// ============================================================

const selMap = new WeakMap<Game, string>();

function nodeById(id: string | null | undefined): TreeNodeDef | null {
  if (!id) return null;
  return SKILL_TREE.find(n => n.id === id) ?? null;
}

/** Estrella determinista para el fondo (sin estado ni Math.random). */
function starFrac(i: number, salt: number): number {
  const a = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return a - Math.floor(a);
}

export function drawSkillTree(g: Game): void {
  const ctx = g.ctx;
  const p = g.player;

  // fondo nocturno con constelación sutil
  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < 46; i++) {
    const sx = starFrac(i, 1) * VIEW_W;
    const sy = starFrac(i, 2) * VIEW_H;
    const tw = 0.35 + 0.3 * starFrac(i, 3) + 0.2 * Math.sin(g.globalT * 1.5 + i);
    ctx.fillStyle = `rgba(200,214,240,${Math.max(0.08, tw * 0.5).toFixed(2)})`;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
  }
  if (!p) {
    text(g, 'Ningún Portador contempla la constelación...', VIEW_W / 2, VIEW_H / 2, 16, COL.dim, 'center');
    return;
  }

  const tree = getTree(p);
  const learned = new Set(tree.learned);
  const avail = pointsAvailable(p);
  const sel = selMap.get(g) ?? null;
  const selNode = nodeById(sel);

  // ---- cabecera ----
  textShadow(g, 'LA CONSTELACIÓN DEL PORTADOR', VIEW_W / 2, 12, 13, COL.goldSoft, '#000', 'center', true);
  text(g, 'el árbol de habilidades', VIEW_W / 2, 30, 13, COL.dim, 'center');
  textShadow(g, `Puntos de habilidad: ${avail}`, 14, 12, 11, avail > 0 ? COL.gold : COL.dim, '#000', 'left', true);
  text(g, `${p.name} · ${p.discipline === 'alba' ? 'Portador del Alba' : 'Tejedora de Cantos'} · Nv ${p.level}`, VIEW_W - 14, 14, 13, COL.dim, 'right');

  // ---- columnas de ramas ----
  const pad = 14;
  const top = 50;
  const footerH = 118;
  const colGap = 10;
  const colW = (VIEW_W - pad * 2 - colGap * 2) / 3;
  const treeBottom = VIEW_H - footerH - 6;
  const branches: ('filo' | 'eco' | 'camino')[] = ['filo', 'eco', 'camino'];
  // la Vía del Filo tiene la cadena más larga (5 niveles de profundidad)
  const maxTiers = 5;
  const pitch = Math.max(42, Math.min(64, Math.floor((treeBottom - top - 36) / maxTiers)));
  const nodeR = Math.max(12, Math.min(16, Math.floor(pitch * 0.28)));

  for (let bi = 0; bi < 3; bi++) {
    const b = branches[bi];
    const info = TREE_BRANCHES[b];
    const colX = pad + bi * (colW + colGap);
    panel(g, colX, top, colW, treeBottom - top, info.color, 'rgba(10,12,22,0.72)');
    textShadow(g, info.name, colX + colW / 2, top + 7, 10, info.color, '#000', 'center', true);
    text(g, info.sub, colX + colW / 2, top + 21, 12, COL.dim, 'center');

    // posiciones por profundidad (tier): hijos centrados bajo su padre
    const bnodes = SKILL_TREE.filter(n => n.branch === b);
    const tierOf = new Map<string, number>();
    for (const n of bnodes) {
      const pt = n.parent ? tierOf.get(n.parent) : undefined;
      tierOf.set(n.id, n.parent && pt !== undefined ? pt + 1 : 0);
    }
    const pos = new Map<string, { x: number; y: number }>();
    const tiers: TreeNodeDef[][] = [];
    for (const n of bnodes) {
      const t = tierOf.get(n.id) ?? 0;
      (tiers[t] ??= []).push(n);
    }
    for (let t = 0; t < tiers.length; t++) {
      const row = (tiers[t] ?? []).slice().sort((a, c) => {
        const ax = a.parent ? (pos.get(a.parent)?.x ?? colX + colW / 2) : colX + colW / 2;
        const cx2 = c.parent ? (pos.get(c.parent)?.x ?? colX + colW / 2) : colX + colW / 2;
        return ax - cx2;
      });
      const spacing = Math.min(58, (colW - 20) / Math.max(1, row.length));
      const mid = colX + colW / 2;
      row.forEach((n, idx) => {
        pos.set(n.id, { x: mid + (idx - (row.length - 1) / 2) * spacing, y: top + 40 + t * pitch + nodeR });
      });
    }

    // conectores (padre → hijo)
    for (const n of bnodes) {
      if (!n.parent) continue;
      const from = pos.get(n.parent), to = pos.get(n.id);
      if (!from || !to) continue;
      const lit = learned.has(n.id) && learned.has(n.parent);
      ctx.strokeStyle = lit ? info.color : '#2c2c3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y + nodeR);
      ctx.lineTo(to.x, to.y - nodeR - 10);
      ctx.stroke();
    }

    // nodos
    for (const n of bnodes) {
      const pp = pos.get(n.id);
      if (!pp) continue;
      const isLearned = learned.has(n.id);
      const discLocked = n.disc !== undefined && n.disc !== p.discipline;
      const parentOk = !n.parent || learned.has(n.parent);
      const canLearn = !isLearned && !discLocked && parentOk && avail >= n.cost;
      const hover = addHit(g, pp.x - 24, pp.y - nodeR - 4, 48, nodeR * 2 + 24, () => {
        selMap.set(g, n.id);
        audio.sfx('blip');
      });

      let ring = '#33334a';
      let fill = 'rgba(16,18,30,0.9)';
      let glyph = '#565668';
      if (isLearned) {
        ring = info.color;
        fill = 'rgba(30,26,18,0.92)';
        glyph = info.color;
      } else if (canLearn) {
        ring = hover ? '#ffffff' : `rgba(255,255,255,${(0.45 + 0.25 * Math.sin(g.globalT * 4)).toFixed(2)})`;
        glyph = '#c8c8d8';
      } else if (hover) {
        ring = '#6a6a8a';
        glyph = '#9a9ab0';
      }
      if (sel === n.id) {
        ctx.strokeStyle = COL.goldSoft;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, nodeR + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, nodeR, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = ring;
      ctx.lineWidth = 2;
      ctx.stroke();
      text(g, n.icon, pp.x, pp.y - 8, 13, glyph, 'center');
      // nombre bajo el nodo
      const name = n.name.length > 15 ? n.name.slice(0, 14) + '…' : n.name;
      text(g, name, pp.x, pp.y + nodeR + 2, 11, isLearned ? COL.text : '#7a7a90', 'center');
      if (!isLearned) text(g, `◆${n.cost}`, pp.x, pp.y + nodeR + 14, 11, canLearn ? COL.gold : '#6a6a80', 'center');
      if (isLearned) {
        ctx.fillStyle = COL.gold;
        ctx.fillRect(pp.x + nodeR - 3, pp.y - nodeR + 1, 3, 3);
      }
      if (discLocked) text(g, n.disc === 'alba' ? 'alba' : 'tej.', pp.x, pp.y - nodeR - 12, 10, '#6a6a80', 'center');
    }
  }

  // ---- pie: detalle del nodo seleccionado + acciones ----
  const fy = VIEW_H - footerH + 2;
  panel(g, pad, fy, VIEW_W - pad * 2, footerH - 10);
  if (!selNode) {
    text(g, 'Elige una estrella de tu constelación: pasivas, magias nuevas y herramientas.', pad + 14, fy + 12, 14, COL.dim);
    text(g, 'Clic en un nodo disponible para aprenderlo con puntos de habilidad (◆).', pad + 14, fy + 32, 14, COL.dim);
    text(g, 'Las magias nuevas se equipan en los huecos 1-4 (sustituyen a la habilidad base, que duerme).', pad + 14, fy + 52, 14, COL.dim);
  } else {
    const bx = pad + 14;
    const info = TREE_BRANCHES[selNode.branch];
    const btnX = pad + Math.floor((VIEW_W - pad * 2) * 0.52);
    textShadow(g, selNode.name, bx, fy + 10, 11, info.color, '#000', 'left', true);
    const kindTxt = selNode.kind === 'activa' ? 'Habilidad activa' : selNode.kind === 'herramienta' ? 'Herramienta' : 'Pasiva';
    const discTxt = selNode.disc ? (selNode.disc === 'alba' ? ' · solo Alba' : ' · solo Tejedora') : '';
    text(g, `${kindTxt}${discTxt} · coste ${selNode.cost} ◆`, bx, fy + 27, 13, COL.dim);
    const maxChars = Math.max(24, Math.floor((btnX - bx - 20) / 7));
    wrapText(selNode.desc, maxChars).slice(0, 3).forEach((l, i) => {
      text(g, l, bx, fy + 44 + i * 15, 14, COL.text);
    });
    // acciones (derecha)
    const isLearned = learned.has(selNode.id);
    const discLocked = selNode.disc !== undefined && selNode.disc !== p.discipline;
    const parentOk = !selNode.parent || learned.has(selNode.parent);
    if (isLearned && selNode.kind === 'activa' && selNode.grants) {
      text(g, 'Equipar en hueco:', btnX, fy + 10, 13, COL.dim);
      for (let s = 0; s < 4; s++) {
        const occ = SKILLS[p.discipline][s];
        const isMine = occ ? NEW_SKILL_IDS.has(occ.id) : false;
        const w2 = 30, h2 = 28;
        const bx2 = btnX + s * (w2 + 6);
        const hov = addHit(g, bx2, fy + 26, w2, h2, () => {
          if (selNode.grants) equipNewSkill(p, selNode.grants, s);
        });
        panel(g, bx2, fy + 26, w2, h2, hov ? COL.gold : COL.panelBorder, hov ? 'rgba(40,34,20,0.95)' : COL.panel);
        text(g, `${s + 1}`, bx2 + 3, fy + 29, 9, COL.gold, 'left', true);
        if (occ) text(g, occ.icon, bx2 + w2 / 2 + 2, fy + 31, 12, isMine ? COL.goldSoft : '#8a8a9a', 'center');
      }
      const equippedHere = tree.equip.some(id => id === selNode.grants);
      if (equippedHere) {
        const slot = tree.equip.findIndex(id => id === selNode.grants);
        const hov = addHit(g, btnX, fy + 60, 150, 22, () => { unequipSlot(p, slot); });
        panel(g, btnX, fy + 60, 150, 22, hov ? COL.danger : COL.panelBorder);
        text(g, `Quitar del hueco ${slot + 1}`, btnX + 75, fy + 64, 12, hov ? COL.danger : COL.dim, 'center');
      } else {
        text(g, 'Clic en un hueco: la habilidad base duerme hasta que la quites', btnX, fy + 64, 12, COL.dim);
      }
    } else if (isLearned && selNode.kind === 'herramienta' && selNode.grants) {
      const ti = TOOL_INFO[selNode.grants];
      button(g, `Usar (tecla ${ti.key})`, btnX, fy + 12, 150, 28, () => { activateTool(g, selNode.grants as string); }, 10);
      text(g, ti.desc, btnX, fy + 46, 12, COL.dim);
    } else if (isLearned) {
      text(g, '✓ Aprendida', btnX, fy + 14, 15, COL.quest);
    } else if (discLocked) {
      text(g, selNode.disc === 'alba' ? 'Reservada al Portador del Alba' : 'Reservada a la Tejedora de Cantos', btnX, fy + 14, 13, COL.danger);
    } else if (!parentOk) {
      const par = nodeById(selNode.parent);
      text(g, `Requiere: ${par ? par.name : '???'}`, btnX, fy + 14, 13, COL.dim);
    } else if (avail < selNode.cost) {
      text(g, `Te faltan puntos (${selNode.cost} ◆)`, btnX, fy + 14, 13, COL.danger);
    } else {
      const grants = selNode.grants;
      button(g, `Aprender (−${selNode.cost} ◆)`, btnX, fy + 12, 170, 28, () => { learnNode(g, p, selNode); }, 10);
      if (selNode.kind === 'activa' && grants) {
        text(g, 'Se equipará en el hueco 3 (puedes moverla después)', btnX, fy + 46, 12, COL.dim);
      }
    }
  }

  // leyenda
  text(g, 'K/ESC cerrar · teclas 5/6/7: herramientas · ◆ = punto de habilidad (1 por nivel, +1 en Nv 5 y 10)', VIEW_W / 2, VIEW_H - 12, 12, COL.dim, 'center');
}

/** Gasta puntos y aprende un nodo (valida de nuevo por seguridad). */
function learnNode(g: Game, p: Player, node: TreeNodeDef): void {
  const t = getTree(p);
  if (t.learned.includes(node.id)) return;
  if (node.disc && node.disc !== p.discipline) return;
  const parentOk = !node.parent || t.learned.includes(node.parent);
  if (!parentOk) return;
  if (pointsAvailable(p) < node.cost) { g.toast('No tienes puntos de habilidad suficientes', '#e88'); audio.sfx('error'); return; }
  t.learned.push(node.id);
  saveTree(p);
  applySkillStats(p, !!g.challengeRun);
  audio.sfx('levelup');
  g.burst(p.x, p.y - 6, '#ffe86a', 18, 80);
  if (node.kind === 'activa' && node.grants) {
    // auto-equipaje: hueco 3 (índice 2); movible desde el árbol
    equipNewSkill(p, node.grants, 2);
    g.toast(`${node.name}: desbloqueada y equipada en el hueco 3`, '#ffe86a');
  } else {
    g.toast(`${node.name} aprendida`, '#ffe86a');
  }
}
