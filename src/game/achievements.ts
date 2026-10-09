// ============================================================
// ECOS DE AELTHAR — ESTADÍSTICAS + LOGROS PERSISTENTES (16-c)
// ============================================================
// Módulo autocontenido (patrón balance.ts/challenge.ts): el motor lo llama
// en Game.update (statsTick + achievementTick, ambos O(1) con early-out) y
// challenge.ts informa sus resultados en finish() (recordChallengeResult).
// Las pantallas del título (Estadísticas / Logros) se dibujan aquí con el
// MISMO lenguaje visual del resto de paneles (ui.ts + patrón del menú del
// Modo Desafío: overlay sobre el título que limpia g.uiHit y se cierra con
// ESC o su botón VOLVER).
//
// ---------------- PERSISTENCIA (localStorage, tolerante) ----------------
// · 'ecos-logros'          — JSON {v, done: string[]} ids de logros conseguidos.
//                            Desbloqueo IDEMPOTENTE: un Set en memoria + early-out
//                            cuando todo está conseguido; dos ticks nunca duplican.
// · 'ecos-stats'           — JSON StatsData: espejo de las estadísticas escritas
//                            por Game.save() (fuente primaria: el propio save
//                            'ecos-aelthar-save', campo stats con defaults).
// · 'ecos-desafio-récords' — JSON {v, times: Record<clave, number[]>}: top 3
//                            tiempos por desafío, guardado al completar un reto.
// · 'ecos-desafio-best'    — récord de puntos de oleadas (12-a, solo lectura aquí).
//
// Todo lectura/escritura va en try/catch con defaults seguros (patrón
// 'ecos-vol' de engine.ts): JSON corrupto o ausente no rompe nunca.
//
// ---------------- LOGROS (12) ----------------
// 10 se chequean por estado en achievementTick (O(1), corre en play/dialogue;
// en la arena NO progresan — Rondador va por evento en recordChallengeResult):
// Primer Canto · Cazador de Ecos · Rompejefes · Corazón de Alba (fin Acto I) ·
// Notas Perdidas (fin Acto II) · Canto al Revés (fin Acto III) ·
// El Último Canto (Acto IV: SOLO se desbloquea si existe ya alguna bandera del
// acto IV — hoy no existe ninguna, por eso su nombre lleva «próximamente» y su
// chequeo es tolerante a flags futuros con try/catch) · Invicto (Nv 5 sin
// morir) · Rico (500 coronas) · Alquimista (10 pociones) · Viajero del Tiempo
// (10 cambios de época). Rondador (ganar un desafío con vida > 70%) es
// EVENTO-DRIVEN desde challenge.ts.
// Al desbloquear: toast dorado '¡Logro: <nombre>!' + sfx 'levelup' existente.
// ============================================================

import type { Game } from './engine';
import type { StatsData } from './types';
// Ciclo achievements⇄engine seguro (mismo patrón verificado de challenge.ts,
// 11-a): los valores importados SOLO se leen dentro de funciones, nunca en
// la inicialización del módulo (live bindings ESM).
import { VIEW_W, VIEW_H, BOSS_DEFEAT_FLAG } from './engine';
import { TILE } from './sprites';
import { MEMORIES } from './data';
import { audio } from './audio';
import { COL, text, textShadow, panel, button, wrapText } from './ui';

// ---------------- claves de localStorage ----------------

export const LS_LOGROS = 'ecos-logros';
export const LS_STATS = 'ecos-stats';
export const LS_DESAFIO_RECORDS = 'ecos-desafio-récords';
const LS_SAVE = 'ecos-aelthar-save';       // guardado de campaña (solo lectura)
const LS_DESAFIO_BEST = 'ecos-desafio-best'; // récord de oleadas 12-a (solo lectura)

// ---------------- estadísticas de partida ----------------

/** Estadísticas acumuladas de una partida (campo 'stats' del SaveData). */
export function defaultStats(): StatsData {
  return {
    enemigosDerrotados: 0,
    jefesDerrotados: 0,
    muertes: 0,
    coronasGanadas: 0,
    coronasGastadas: 0,
    pocionesUsadas: 0,
    vecesCambioEpoca: 0,
    distanciaAndada: 0,   // px realmente aplicados (≈ tiles al mostrar: px/TILE)
    tiempoJugado: 0,      // segundos en estado play/dialogue
    memoriasHalladas: 0,
  };
}

/** Read tolerante de StatsData: campos desconocidos/inválidos → default. */
export function sanitizeStats(raw: unknown): StatsData {
  const out = defaultStats();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(out) as (keyof StatsData)[]) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

/**
 * Tick de estadísticas (llamado desde Game.update, que SOLO corre en
 * play/dialogue — exactamente los estados que define 'tiempoJugado', arena
 * incluida). O(1), sin allocations. Los CONTADORES de campaña (kills/muertes/
 * pociones/época/distancia) van instrumentados en engine.ts con guard
 * `!challengeRun`: la arena no contamina las cifras de campaña (12-a).
 */
export function statsTick(g: Game, dt: number): void {
  g.stats.tiempoJugado += dt;
  const p = g.player;
  if (p) g.stats.memoriasHalladas = p.memories?.length ?? 0;
}

// ---------------- definición de los 12 logros ----------------

export interface LogroDef { id: string; name: string; desc: string }

export const LOGROS: LogroDef[] = [
  { id: 'primer_canto', name: 'Primer Canto', desc: 'Derrota a tu primer enemigo' },
  { id: 'cazador_ecos', name: 'Cazador de Ecos', desc: 'Escucha 5 ecos menores' },
  { id: 'rompejefes', name: 'Rompejefes', desc: 'Derrota a 3 jefes' },
  { id: 'corazon_alba', name: 'Corazón de Alba', desc: 'Completa el Acto I' },
  { id: 'notas_perdidas', name: 'Notas Perdidas', desc: 'Completa el Acto II' },
  { id: 'canto_al_reves', name: 'Canto al Revés', desc: 'Completa el Acto III' },
  { id: 'ultima_nota', name: 'El Último Canto (próximamente)', desc: 'Completa el Acto IV (aún no ha sonado)' },
  { id: 'invicto', name: 'Invicto', desc: 'Alcanza el nivel 5 sin morir' },
  { id: 'rico', name: 'Rico', desc: 'Reúne 500 coronas en mano' },
  { id: 'alquimista', name: 'Alquimista', desc: 'Bebe 10 pociones' },
  { id: 'viajero_tiempo', name: 'Viajero del Tiempo', desc: 'Cambia de época 10 veces' },
  { id: 'rondador', name: 'Rondador', desc: 'Gana un desafío con más del 70% de vida' },
];

// ---------------- estado de logros (carga perezosa + idempotencia) ----------------

let done = new Set<string>();
let loaded = false;
let pendientes = LOGROS.length; // early-out del tick cuando todo está resuelto

function ensureLoaded(): Set<string> {
  if (loaded) return done;
  loaded = true;
  done = new Set();
  try {
    const raw = localStorage.getItem(LS_LOGROS);
    if (raw) {
      const d = JSON.parse(raw) as unknown;
      // forma {v, done:[]} (actual) o array plano (tolerancia a legacy)
      const arr = Array.isArray(d) ? d
        : d && typeof d === 'object' && Array.isArray((d as { done?: unknown }).done)
          ? (d as { done: unknown[] }).done : null;
      if (arr) {
        for (const s of arr) if (typeof s === 'string' && LOGROS.some(l => l.id === s)) done.add(s);
      }
    }
  } catch { done = new Set(); } // JSON corrupto → sin logros, sin crash
  pendientes = Math.max(0, LOGROS.length - done.size);
  return done;
}

/** Ids conseguidos (copia; para paneles/smoke). */
export function loadLogros(): string[] { return [...ensureLoaded()]; }

export function logrosCount(): { done: number; total: number } {
  ensureLoaded();
  return { done: done.size, total: LOGROS.length };
}

export function isLogroDone(id: string): boolean { return ensureLoaded().has(id); }

function persist(): void {
  try { localStorage.setItem(LS_LOGROS, JSON.stringify({ v: 1, done: [...done] })); }
  catch { /* almacenamiento lleno/bloqueado: el juego sigue sin persistir */ }
}

/** Nombre visible de un logro. El del Acto IV cambia según exista ya su
 *  bandera (ver acto4FlagDe): si existe → 'El Último Canto'; si no, el
 *  nombre lleva «(próximamente)». */
export function logroName(id: string, g?: Game): string {
  const def = LOGROS.find(l => l.id === id);
  if (!def) return id;
  if (id === 'ultima_nota' && g && acto4FlagDe(g)) return 'El Último Canto';
  return def.name;
}

/** Desbloqueo ÚNICO (idempotente): Set + persistencia + toast dorado + sfx. */
function tryUnlock(g: Game, id: string, cond: boolean): void {
  if (!cond) return;
  const d = ensureLoaded();
  if (d.has(id)) return;
  d.add(id);
  pendientes = Math.max(0, pendientes - 1);
  persist();
  g.toast(`¡Logro: ${logroName(id, g)}!`, COL.gold);
  audio.sfx('levelup');
}

/** Chequeo puntual exportado para eventos clave fuera del tick (challenge). */
export function unlockById(g: Game, id: string): void {
  tryUnlock(g, id, true);
}

// ---------------- detección tolerante de flags futuros del Acto IV ----------------
// Hoy (Actos I-III) NO existe ninguna bandera del Acto IV en el juego (verificado
// en hooks.ts/data.ts): el logro queda «próximamente» e imposible de desbloquear.
// Cuando un agente futuro añada el acto con cualquiera de estos nombres de flag
// (en g.flags o como propiedad del Game), el logro se activará solo.
const ACTO4_FLAGS = ['acto4Done', 'acto4', 'actoIVDone', 'acto4Report', 'acto4Seen', 'finalActo4'];

function acto4FlagDe(g: Game): string | null {
  try {
    const f = g.flags as Record<string, unknown>;
    for (const k of ACTO4_FLAGS) if (f[k]) return k;
    const anyG = g as unknown as Record<string, unknown>;
    for (const k of ACTO4_FLAGS) if (anyG[k]) return k;
  } catch { /* formas futuras raras: siempre tolerante */ }
  return null;
}

/** Nº de jefes de campaña derrotados (usa el mapa del motor: cubre futuros). */
function bossFlagsCount(f: Record<string, number | boolean>): number {
  let n = 0;
  for (const flag of Object.values(BOSS_DEFEAT_FLAG)) if (f[flag]) n++;
  return n;
}

/**
 * Tick de logros (llamado desde Game.update, tras statsTick). O(1):
 * cada condición es una lectura de estado, con early-out si todo está
 * conseguido o si estamos en la arena (los logros de campaña no progresan
 * ahí; Rondador se concede por evento en recordChallengeResult).
 */
export function achievementTick(g: Game): void {
  if (pendientes <= 0) return;
  if (g.challengeRun) return;
  const p = g.player;
  if (!p) return;
  const f = g.flags;
  const st = g.stats;
  tryUnlock(g, 'primer_canto', st.enemigosDerrotados >= 1);
  tryUnlock(g, 'cazador_ecos', g.takenEchoes.size >= 5);
  tryUnlock(g, 'rompejefes', bossFlagsCount(f) >= 3);
  tryUnlock(g, 'corazon_alba', g.questIdx >= 5 || !!f.acto2Done);
  tryUnlock(g, 'notas_perdidas', !!f.acto2Done);
  tryUnlock(g, 'canto_al_reves', !!f.acto3Done);
  tryUnlock(g, 'invicto', p.level >= 5 && p.deaths === 0);
  tryUnlock(g, 'rico', p.gold >= 500);
  tryUnlock(g, 'alquimista', st.pocionesUsadas >= 10);
  tryUnlock(g, 'viajero_tiempo', st.vecesCambioEpoca >= 10);
  tryUnlock(g, 'ultima_nota', !!acto4FlagDe(g));
}

// ---------------- marcas del desafío (top 3 tiempos) + Rondador ----------------

interface RecordsFile { v: number; times: Record<string, number[]> }

/** Lectura tolerante de 'ecos-desafio-récords'. */
function readRecords(): RecordsFile {
  try {
    const raw = localStorage.getItem(LS_DESAFIO_RECORDS);
    if (raw) {
      const d = JSON.parse(raw) as RecordsFile | null;
      if (d && typeof d === 'object' && d.times && typeof d.times === 'object') {
        const times: Record<string, number[]> = {};
        for (const [k, arr] of Object.entries(d.times)) {
          if (Array.isArray(arr)) {
            times[k] = arr.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0).slice(0, 3);
          }
        }
        return { v: 1, times };
      }
    }
  } catch { /* corrupto → vacío */ }
  return { v: 1, times: {} };
}

/** Guarda un tiempo en el top 3 de su desafío. Duelos: menor es mejor
 *  (victoria más rápida); oleadas: mayor es mejor (más supervivencia). */
function recordChallengeTime(key: string, sec: number, lowerIsBetter: boolean): void {
  if (!(sec > 0)) return;
  const f = readRecords();
  const arr = f.times[key] ?? [];
  arr.push(Math.round(sec * 10) / 10);
  arr.sort((a, b) => (lowerIsBetter ? a - b : b - a));
  f.times[key] = arr.slice(0, 3);
  try { localStorage.setItem(LS_DESAFIO_RECORDS, JSON.stringify(f)); } catch { /* noop */ }
}

/** Top 3 de tiempos por desafío (para el panel de Estadísticas). */
export function readChallengeRecords(): { key: string; times: number[] }[] {
  const f = readRecords();
  return Object.entries(f.times).map(([key, times]) => ({ key, times }));
}

/** Récord de puntos de oleadas (clave de 12-a, solo lectura). */
export function readOleadasBest(): number {
  try {
    const v = Number(localStorage.getItem(LS_DESAFIO_BEST) ?? '0');
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch { return 0; }
}

/**
 * Lo llama challenge.ts · finish() DESPUÉS de restaurar la campaña y limpiar
 * toasts (con el ratio de vida capturado ANTES de restaurar). Guarda la marca
 * de tiempo del reto y concede Rondador (victoria con vida > 70%).
 */
export function recordChallengeResult(
  g: Game, mode: 'oleadas' | 'jefe', boss: string | undefined, victory: boolean,
  hpRatio: number, timeSec: number,
): void {
  if (mode === 'jefe' && boss) {
    if (victory) recordChallengeTime(`duelo:${boss}`, timeSec, true);
  } else if (mode === 'oleadas') {
    recordChallengeTime('oleadas', timeSec, false); // completar = caer tras N oleadas
  }
  if (victory && hpRatio > 0.7) tryUnlock(g, 'rondador', true);
}

// ---------------- lectura del último guardado (panel de título) ----------------

export interface SaveSummary {
  name: string; level: number; gold: number; kills: number; deaths: number;
  playTime: number; memories: number; questIdx: number;
  stats: StatsData;
}

function num(v: unknown, def: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : def;
}

/**
 * Cifras del ÚLTIMO guardado, leídas del localStorage SIN arrancar partida
 * (patrón del spec: si no hay save → el panel muestra 'Aún no hay partidas').
 * Tolerante: saves antiguos sin campo stats → defaults; save corrupto → null.
 */
export function readLastSave(): SaveSummary | null {
  try {
    const raw = localStorage.getItem(LS_SAVE);
    if (!raw) return null;
    const d = JSON.parse(raw) as Record<string, unknown> | null;
    if (!d || typeof d !== 'object') return null;
    const pl = d.player as Record<string, unknown> | undefined;
    if (!pl || typeof pl !== 'object') return null;
    return {
      name: typeof pl.name === 'string' ? pl.name : 'Portador',
      level: num(pl.level, 1),
      gold: num(pl.gold, 0),
      kills: num(pl.kills, 0),
      deaths: num(pl.deaths, 0),
      playTime: num(pl.playTime, 0),
      memories: Array.isArray(pl.memories) ? pl.memories.length : 0,
      questIdx: num(d.questIdx, 0),
      stats: sanitizeStats(d.stats),
    };
  } catch { return null; }
}

/** Espejo 'ecos-stats' (escrito por Game.save(); lectura para smoke/paneles). */
export function readStatsMirror(): StatsData {
  try {
    const raw = localStorage.getItem(LS_STATS);
    return raw ? sanitizeStats(JSON.parse(raw)) : defaultStats();
  } catch { return defaultStats(); }
}

// ---------------- paneles del título ----------------
// Mismo lenguaje visual y anti-clic-fantasma que el menú del Modo Desafío:
// overlay que limpia g.uiHit del título, registra solo sus botones y se
// cierra con ESC o VOLVER. screens.ts añade las 2 entradas del menú y llama
// a drawTitlePanels(g) tras drawChallengeTitleUi(g).

let statsOpen = false;
let logrosOpen = false;

export function openStatsPanel(): void { statsOpen = true; logrosOpen = false; audio.sfx('confirm'); }
export function openLogrosPanel(): void { logrosOpen = true; statsOpen = false; audio.sfx('confirm'); }
export function closeTitlePanels(): void { statsOpen = false; logrosOpen = false; }

/** Lo llama screens.ts en el case 'title', detrás de drawChallengeTitleUi. */
export function drawTitlePanels(g: Game): void {
  if (g.state !== 'title') return;
  if (statsOpen) drawStatsPanel(g);
  else if (logrosOpen) drawLogrosPanel(g);
}

function fmtDur(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const RECORD_LABELS: Record<string, string> = {
  'oleadas': 'Oleadas (supervivencia)',
  'duelo:guardian': 'Duelo · Guardián Hueco',
  'duelo:sirena': 'Duelo · Sirena Abisal',
  'duelo:golem': 'Duelo · Gólem de Escarcha',
};

/** Panel ESTADÍSTICAS: cifras del último guardado + mejores marcas del desafío. */
function drawStatsPanel(g: Game): void {
  const ctx = g.ctx;
  g.uiHit.length = 0; // sin clics fantasma sobre los botones del título
  const w = 620, h = 440;
  const x = VIEW_W / 2 - w / 2;
  const y = Math.max(18, Math.round(VIEW_H / 2 - h / 2));
  ctx.fillStyle = 'rgba(4,6,14,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, x, y, w, h);
  textShadow(g, '◆ ESTADÍSTICAS DEL PORTADOR ◆', VIEW_W / 2, y + 16, 15, COL.gold, '#000', 'center', true);

  const s = readLastSave();
  let ly: number;
  if (!s) {
    text(g, 'Aún no hay partidas.', VIEW_W / 2, y + 64, 19, COL.dim, 'center');
    text(g, 'Cuando juegues, el juego recordará aquí tus hazañas', VIEW_W / 2, y + 96, 15, 'rgba(154,160,184,0.8)', 'center');
    text(g, '(se guardan con la partida, igual que tu canto).', VIEW_W / 2, y + 114, 15, 'rgba(154,160,184,0.8)', 'center');
    ly = y + 150;
  } else {
    const st = s.stats;
    const memTotal = Object.keys(MEMORIES).length;
    const rows: [string, string][] = [
      ['Portador', `${s.name} — Nivel ${s.level}`],
      ['Tiempo de juego', fmtDur(st.tiempoJugado || s.playTime)],
      ['Enemigos derrotados', `${st.enemigosDerrotados || s.kills}   ·   Jefes: ${st.jefesDerrotados}`],
      ['Muertes', `${st.muertes || s.deaths}   ·   Pociones usadas: ${st.pocionesUsadas}`],
      ['Coronas ganadas / gastadas', `${st.coronasGanadas} / ${st.coronasGastadas}`],
      ['Cambios de época', `${st.vecesCambioEpoca}   ·   Memorias: ${st.memoriasHalladas || s.memories}/${memTotal}`],
      ['Distancia recorrida', `≈ ${Math.round(st.distanciaAndada / TILE)} tiles`],
    ];
    text(g, 'ÚLTIMO GUARDADO', x + 30, y + 46, 13, COL.goldSoft);
    ly = y + 68;
    for (const [k, v] of rows) {
      text(g, k, x + 30, ly, 15, COL.dim);
      text(g, v, x + 250, ly, 15, COL.text);
      ly += 24;
    }
    ly += 2;
  }

  // ---- mejores marcas del desafío (12-a guarda puntos; 16-c top 3 tiempos) ----
  ctx.strokeStyle = 'rgba(90,74,48,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 30, ly); ctx.lineTo(x + w - 30, ly); ctx.stroke();
  ly += 10;
  text(g, '◆ MEJORES MARCAS DEL DESAFÍO ◆', x + 30, ly + 4, 13, COL.gold);
  ly += 26;
  const best = readOleadasBest();
  if (best > 0) {
    text(g, 'Récord de oleadas (puntos)', x + 30, ly, 14, COL.dim);
    text(g, `${best}`, x + w - 30, ly, 14, COL.goldSoft, 'right');
    ly += 18;
  }
  const recs = readChallengeRecords();
  if (recs.length === 0 && best === 0) {
    text(g, 'Sin marcas todavía: la arena te espera.', x + 30, ly, 14, 'rgba(154,160,184,0.75)');
    ly += 18;
  } else {
    for (const r of recs) {
      const label = RECORD_LABELS[r.key] ?? r.key;
      text(g, label, x + 30, ly, 14, COL.dim);
      text(g, r.times.map(fmtClock).join('  ·  '), x + w - 30, ly, 14, COL.goldSoft, 'right');
      ly += 18;
    }
  }

  button(g, 'VOLVER (ESC)', VIEW_W / 2 - 90, y + h - 40, 180, 32, () => closeTitlePanels(), 10);
  if (g.keys.has('escape')) closeTitlePanels();
}

/** Panel LOGROS: lista persistente de los 12, con contador X/Y arriba. */
function drawLogrosPanel(g: Game): void {
  const ctx = g.ctx;
  g.uiHit.length = 0;
  const w = 640, h = 440;
  const x = VIEW_W / 2 - w / 2;
  const y = Math.max(18, Math.round(VIEW_H / 2 - h / 2));
  ctx.fillStyle = 'rgba(4,6,14,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, x, y, w, h);
  textShadow(g, '◆ LOGROS ◆', VIEW_W / 2, y + 16, 16, COL.gold, '#000', 'center', true);
  const cnt = logrosCount();
  text(g, `${cnt.done} / ${cnt.total} conseguidos`, VIEW_W / 2, y + 42, 15,
    cnt.done > 0 ? COL.goldSoft : COL.dim, 'center');

  // rejilla 2 × 6 (persistente entre partidas: vive en 'ecos-logros')
  const colW = (w - 70) / 2;
  LOGROS.forEach((def, i) => {
    const cx0 = x + 30 + (i % 2) * (colW + 24);
    const ry = y + 70 + Math.floor(i / 2) * 54;
    const got = isLogroDone(def.id);
    text(g, `${got ? '✓' : '·'} ${logroName(def.id, g)}`, cx0, ry, 15, got ? COL.gold : COL.dim);
    const lines = wrapText(def.desc, 36).slice(0, 2);
    lines.forEach((l, j) => text(g, l, cx0 + 13, ry + 18 + j * 13, 13,
      got ? COL.text : 'rgba(154,160,184,0.7)'));
  });

  button(g, 'VOLVER (ESC)', VIEW_W / 2 - 90, y + h - 40, 180, 32, () => closeTitlePanels(), 10);
  if (g.keys.has('escape')) closeTitlePanels();
}

// ---------------- helpers dev/smoke (patrón __wlResetAll de worldlife) ----------------

/** SOLO smoke/dev: limpia el estado en memoria. Con reload=true vuelve a leer
 *  localStorage en el siguiente acceso (prueba de carga/persistencia). */
export function __logrosDevReset(reload = false): void {
  done = new Set();
  if (reload) loaded = false;
  else loaded = true;
  pendientes = LOGROS.length;
}
