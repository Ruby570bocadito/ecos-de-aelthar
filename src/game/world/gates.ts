// ============================================================
// ECOS DE AELTHAR — R11-7 · PUERTAS DE HISTORIA (EPIC 7.6)
// ============================================================
// Zonas avanzadas gated por progreso de historia, SIN romper la exploración.
// Principio sagrado: bloquear SÍ, frustrar NO — el gate es SIEMPRE diegético
// (un sello con voz, una niebla de marea, raíces que se ciñen), el toast de
// negación dice EXACTAMENTE qué falta, y el jugador puede seguir explorando
// todo el resto del mapa. NUNCA un muro invisible: drawGateFx pinta el efecto
// activo y gateBlockedAt nombra la puerta al rozarla.
//
// ══════════ DECISIÓN DE DISEÑO (gate_cripta_profunda) ══════════
// La tarea ofrecía dos variantes. VERIFICADO en el código actual:
//  · La puerta 'D' del puzzle (x23..24, y17..18) sella el ÚNICO paso a la
//    antesala… y EL SEPULCRO (mini-jefe R10-9, spawn zone 'antesala' en
//    maps.ts, watcher en update.ts) está DETRÁS de esa puerta. Cerrar 'D'
//    con flags.sepulcroDerrotado = SOFTLOCK (el jefe requerido vive detrás
//    del gate). DESCARTADA.
//  · Cerrar la ENTRADA de la cripta: la cripta es la mazmorra del Acto I
//    (q4 'La Cripta del Primer Canto', QUEST_COMPASS[3]); exigir acto>=2
//    rompería la cadena principal. DESCARTADA.
//  · ELEGIDA: sellar el CORREDOR D (x22..25, y8..9) entre la antesala y el
//    sanctum. Orden de progresión intacto: puzzle → 'D' → ANTESALA (aquí
//    vive y activa el Sepulcro, dist2 < 190² imposible de esquivar) →
//    CORREDOR D (gate: exige sepulcroDerrotado) → SANCTUM (Guardián/altare).
//    El mini-jefe pasa de obstáculo opcional a llave diegética, sin tocar
//    el puzzle de palancas ni la cripto puerta 'D'.
//
// ══════════ GARANTÍA «EL GATE NUNCA ATRAPA» ══════════
//  1. gateSolid solo endurece los tiles del rect MIENTRAS el Portador está
//     FUERA del rect y de su lado exterior (gatePorous). Si el Portador está
//     DENTRO del rect o al otro lado (zona protegida), TODOS los tiles del
//     gate se vuelven transitables: puede salir siempre; al salir, el gate
//     se resealla solo.
//  2. Caso límite save/carga DENTRO del rect con el gate cerrado: los tiles
//     leen sólidos y la red anti-encallamiento del motor (antiStuck, llamada
//     cada frame en engine.ts:336) reubica al Portador en el tile libre más
//     cercano (r≤6) con aviso — garantía heredada 14-b, sin código nuevo.
//  3. Las tres zonas protegidas NO tienen otra salida (cripta: bordes '#'
//     sellados R8; cumbres: muro de pinos 'p' x48..49 completo; bosque: el
//     propio rect rodea el círculo) — «poroso desde dentro» == salida libre.
//  4. Los enemigos sufren la misma solidez: los spawns del este de cumbres
//     no pueden cruzar la niebla hacia zonas de bajo nivel.
//
// ══════════ CONTRATO DE CABLEADO (para el orquestador — 3 enganches) ══════════
//  1) engine.ts · tileSolidAt(px, py) — tras la rama dinámica 'D' y ANTES del
//     return SOLID_CHARS.has(ch):
//         if (ch === 'D') return !cryptDoorOpen(this);
//         if (gateSolid(this, this.mapId, px, py)) return true;   // ← R11-7
//         return SOLID_CHARS.has(ch);
//  2) update.ts · updateGame — UNA llamada por frame tras mover al Portador
//     (junto a epochBarrierFeedback):
//         const gb = gateBlockedAt(g, g.mapId, p.x, p.y);
//         if (gb) gatePushOut(g, gb);
//     gateBlockedAt hace TODO el feedback (toast + float + sfx, con cooldown
//     propio de 4 s por gate) y devuelve el gate SOLO para el empujón; además
//     detecta ahí la transición cerrado→abierto para la micro-escena.
//  3) render.ts · drawGame — UNA llamada tras drawLightingV2(ctx, g) (el FX
//     debe brillar sobre la penumbra de la cripta):
//         drawGateFx(ctx, g, { x: g.camX, y: g.camY });
//  4) PERSISTENCIA: CERO campos nuevos de guardado. Los `need` se re-evalúan
//     SIEMPRE de estado ya persistido (flags como 'sepulcroDerrotado',
//     'ecoVoz', 'ecoMareas' — y questIdx, ambos dentro de SaveData). El
//     estado transitorio (transición, cooldown de negación) vive en un
//     WeakMap<Game,…>: se reconstruye solo por sesión, sin migrar saves.
//
// RENDIMIENTO: cero allocs por frame (estado en WeakMap inicializado 1 vez
// por Game; arrays reutilizados; el burst de apertura es un evento 1-vez, no
// por frame). Determinismo total: ninguna llamada a Math.random; todo el FX
// deriva de g.globalT y de hashes enteros fijos (hashI). Importaciones de
// valor desde engine (TILE/ZOOM) solo dentro de cuerpos de función — mismo
// patrón del ciclo engine⇄world/props ya estable en el proyecto.
// ============================================================

import type { Game } from '../engine';
import { TILE, ZOOM } from '../engine';
import { VIEW_W, VIEW_H } from '../consts';
import type { MapId } from '../types';
import { audio, playDoorOpen } from '../audio';

// ---------- Tipos públicos ----------

/** Rect del gate en TILES de mapa (x,y = esquina NO; w,h = tamaño). */
export interface GateRect { x: number; y: number; w: number; h: number }

/** Efecto visual del gate activo (drawGateFx). 'marea' queda disponible para gates futuros. */
export type GateFxKind = 'niebla' | 'sello' | 'raices' | 'marea';

/**
 * Lado PROTEGIDO del gate (hacia donde NO se puede entrar desde fuera):
 *  'N'/'S'/'E'/'W' — el contenido protegido queda al norte/sur/este/oeste del
 *  rect (gate-umbral de corredor). 'C' — el rect ES el recinto protegido
 *  (gate-cerramiento; el escape solo se garantiza estando dentro).
 * La cláusula de escape lee este campo (ver gatePorous).
 */
export type GateSide = 'N' | 'S' | 'E' | 'W' | 'C';

export interface StoryGate {
  id: string;
  map: MapId;
  rect: GateRect;                                   // tiles
  /** need: TODAS las condiciones presentes deben cumplirse (AND). */
  need: {
    acto?: number;          // acto de campaña alcanzado (actoActual(g) >= acto)
    flags?: string[];       // TODAS truthy en g.flags (p. ej. Ecos KEY_ITEM)
    bosses?: string[];      // claves de BOSS_DEFEAT_FLAG (espejo local abajo)
  };
  name: string;             // nombre diegético (float sobre el Portador)
  denialToast: string;      // SIEMPRE dice qué falta (principio sagrado)
  openToast: string;        // toast de la micro-escena de apertura
  hintNpc?: string;         // NPC id al que el mundo puede remitir (opcional)
  fxKind: GateFxKind;
  fxColor: string;          // color único del FX y de toasts/partículas
  side: GateSide;           // cláusula anti-atrapamiento (ver GateSide)
  seed: number;             // semilla entera fija del FX (determinismo)
}

/** Espejo LOCAL de engine.BOSS_DEFEAT_FLAG (solo claves usadas por gates).
 *  Duplicado a propósito: importar el valor desde engine en un módulo que el
 *  orquestador cableará DENTRO de engine crearía dependencia de valor en el
 *  ciclo engine⇄gates; los strings son estables por contrato del motor. */
const BOSS_FLAG: Record<string, string> = {
  sepulcro: 'sepulcroDerrotado', // R10-9: mini-jefe de la antesala de la cripta
};

// ---------- Los 3 GATES (coords VERIFICADAS en maps.ts / maps_expansion.ts) ----------

/**
 * R11-7 · GATES DE HISTORIA
 *
 * 1) gate_cripta_profunda — 'cripta' · rect {22,8,4,2} = CORREDOR D exacto
 *    (buildCripta: rect(g,22,8,4,2,':') entre la antesala y el sanctum).
 *    need.bosses ['sepulcro']: el mini-jefe R10-9 (spawn zone 'antesala',
 *    watcher update.ts con dist2 < 190²) debe caer antes de pisar el sanctum.
 *    side 'N': el sanctum (y2..7 + nichos) es la zona protegida al norte.
 *
 * 2) gate_cumbres_norte — 'cumbres' · rect {48,20,2,1} = ÚNICA brecha del
 *    muro de pinos 'p' (x48..49, alturas 0..41 completas, maps_expansion
 *    rect(g,48,0,2,42,'p')) que cruza el camino '=' en y20 (pathH 40..57).
 *    Detrás quedan la MINA DE LAS TRES VELAS, el CAMPAMENTO MINERO y el
 *    MIRADOR HELADO — todo el este-norte. Ninguna misión vive al este
 *    (gólem/altar/ecos/cofres cu1..cu3 son del oeste): bloquear aquí NO rompe
 *    la exploración del resto del mapa. need.acto 3 (questIdx >= 10: q11
 *    'El Canto al Revés', grant verificada en hooks accept_q11).
 *    side 'E': el este es la zona protegida.
 *
 * 3) gate_santuario — 'bosque' · rect {53,39,7,7} = el círculo del SANTUARIO
 *    CAÍDO DEL CÍRCULO VERDE (interior x53..59/y40..44 + boca norte y39 +
 *    anillo sur y45). Dentro: eco b_e5 (56,43), cofre b6 needPast (58,44),
 *    cartel sign_cir (54,44), piedra central 'g'/'A'. Los guardias (lobo
 *    50,41; esqueleto 48,45) y el cofre b2 (52,38) quedan FUERA: siguen
 *    explorables. need.flags ['ecoVoz','ecoMareas'] ≡ «2 Ecos de campaña»:
 *    la cadena de Ecos es lineal (q4 → q7), así que poseer voz+mareas ES
 *    «ecos >= 2» con la economía real del motor (KEY_ITEM flags); temática:
 *    «los Ecos llaman a los Ecos» (data.ts) — el Círculo que acompañaba al
 *    dios despierta ante quien ya carga dos voces.
 *    side 'C': recinto cerrado, el escape se garantiza desde dentro.
 */
export const GATES: readonly StoryGate[] = [
  {
    id: 'gate_cripta_profunda',
    map: 'cripta',
    rect: { x: 22, y: 8, w: 4, h: 2 },
    need: { bosses: ['sepulcro'] },
    name: 'Sello del Sanctum',
    denialToast: 'El sello del Sanctum resuena: «EL SEPULCRO aún guarda la antesala. Siléncialo y el paso se abrirá.»',
    openToast: 'El sello del Sanctum se deshace: el umbral del altar queda libre.',
    hintNpc: 'guarda',
    fxKind: 'sello',
    fxColor: '#b89cf0',
    side: 'N',
    seed: 11,
  },
  {
    id: 'gate_cumbres_norte',
    map: 'cumbres',
    rect: { x: 48, y: 20, w: 2, h: 1 },
    need: { acto: 3 },
    name: 'Niebla de Marea',
    denialToast: 'La niebla no reconoce aún tu nombre… El este de las Cumbres amanece con el tercer canto (Acto III).',
    openToast: 'La niebla de marea se retira: el este de las Cumbres recuerda tu nombre.',
    hintNpc: 'ivo',
    fxKind: 'niebla',
    fxColor: '#9adfd8',
    side: 'E',
    seed: 23,
  },
  {
    id: 'gate_santuario',
    map: 'bosque',
    rect: { x: 53, y: 39, w: 7, h: 7 },
    need: { flags: ['ecoVoz', 'ecoMareas'] },
    name: 'Raíces del Círculo',
    denialToast: 'Las raíces no ceden: el Círculo solo se abre ante quien porta dos Ecos reunidos.',
    openToast: 'Las raíces se apartan: el Círculo Verde reconoce tu canto.',
    hintNpc: 'doran',
    fxKind: 'raices',
    fxColor: '#8fb878',
    side: 'C',
    seed: 37,
  },
];

// ---------- Estado por sesión (WeakMap — cero migración de saves) ----------

interface GateState {
  locked: boolean[];      // el gate estaba cerrado la última vez que se evaluó
  lastDenial: number[];   // g.globalT del último toast de negación por gate
  abiertos: string[];     // buffer reutilizado de gatesUnlocked (NO mutar)
}

const estadoPorJuego = new WeakMap<Game, GateState>();

function estado(g: Game): GateState {
  let st = estadoPorJuego.get(g);
  if (!st) {
    st = {
      locked: GATES.map(gt => !needMet(g, gt)),
      lastDenial: GATES.map(() => -999),
      abiertos: [],
    };
    estadoPorJuego.set(g, st);
  }
  return st;
}

// ---------- Evaluación de `need` ----------

/**
 * Acto de campaña actual a partir del reloj de misiones del motor (questIdx).
 * Mapa verificado con data.ts QUESTS + hooks.ts (accept_q11 → questIdx 10):
 *   Acto I   = q1..q5  (idx 0..4)  · Acto II  = q6..q10 (idx 5..9)
 *   Acto III = q11..q13 (idx 10..12) · Acto IV = q14..q16 (idx 13..15)
 */
export function actoActual(g: Game): 1 | 2 | 3 | 4 {
  const q = g.questIdx;
  if (q <= 4) return 1;
  if (q <= 9) return 2;
  if (q <= 12) return 3;
  return 4;
}

/** ¿El `need` del gate está cumplido? (AND de acto/flags/bosses; O(need).) */
function needMet(g: Game, gate: StoryGate): boolean {
  const need = gate.need;
  if (need.acto !== undefined && actoActual(g) < need.acto) return false;
  const flags = need.flags;
  if (flags) {
    for (let i = 0; i < flags.length; i++) if (!g.flags[flags[i]]) return false;
  }
  const bosses = need.bosses;
  if (bosses) {
    for (let i = 0; i < bosses.length; i++) {
      const bf = BOSS_FLAG[bosses[i]];
      if (!bf || !g.flags[bf]) return false;
    }
  }
  return true;
}

// ---------- Cláusula anti-atrapamiento ----------

/**
 * ¿El gate es POROSO para el Portador AHORA? Devuelve true si está DENTRO del
 * rect (siempre puede salir) o al otro lado, en el lado protegido (`side`).
 * Esta cláusula es la garantía «el gate NUNCA atrapa»: gateSolid la consulta
 * antes de endurecer cualquier tile.
 */
function gatePorous(g: Game, gate: StoryGate): boolean {
  const p = g.player;
  if (!p) return false; // sin Portador (intro/título): el gate es muro
  const x0 = gate.rect.x * TILE;
  const x1 = (gate.rect.x + gate.rect.w) * TILE;
  const y0 = gate.rect.y * TILE;
  const y1 = (gate.rect.y + gate.rect.h) * TILE;
  if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) return true; // dentro → salida libre
  switch (gate.side) {
    case 'N': return p.y < y0;   // ya está en la zona protegida (norte)
    case 'S': return p.y >= y1;
    case 'E': return p.x >= x1;
    case 'W': return p.x < x0;
    default: return false;       // 'C' recinto cerrado: solo escape interior
  }
}

// ---------- API principal ----------

/**
 * Solidez del gate para tileSolidAt (integración del orquestador, ver cabecera).
 * @param x, y — píxeles de MUNDO (misma convención que tileSolidAt).
 * Devuelve true SOLO si el tile cae dentro del rect de un gate cerrado en ese
 * mapa y el Portador no goza de la cláusula de escape (gatePorous).
 */
export function gateSolid(g: Game, mapId: MapId, x: number, y: number): boolean {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  for (let i = 0; i < GATES.length; i++) {
    const gate = GATES[i];
    if (gate.map !== mapId) continue;          // salida barata: 1 comparación/gate
    const r = gate.rect;
    if (tx < r.x || ty < r.y || tx >= r.x + r.w || ty >= r.y + r.h) continue;
    if (needMet(g, gate)) return false;        // abierto: el paso es libre
    if (gatePorous(g, gate)) return false;     // NUNCA atrapa (ver cabecera)
    return true;
  }
  return false;
}

/** Radio (en tiles) para la micro-escena de apertura. */
const CERCA_APERTURA_TILES = 14;
/** Cooldown (s de tiempo de JUEGO) entre toasts de negación del mismo gate. */
const DENIAL_CD = 4;
/** Margen (tiles) alrededor del rect que cuenta como «intentar entrar». */
const EXP = 1;

/**
 * Intento de entrada al gate (el orquestador la llama 1×/frame con la posición
 * del Portador, en píxeles de mundo). Devuelve el gate SOLO cuando el Portador
 * empuja contra un gate cerrado sin cláusula de escape — el orquestador puede
 * empujarlo fuera con gatePushOut. El feedback (toast + float + sfx) ya lo
 * emite esta función, UNA vez por gate cada DENIAL_CD segundos de juego.
 *
 * Además es el ÚNICO punto que detecta la transición cerrado→abierto para
 * disparar la micro-escena de apertura (ver abrirGate) cuando el Portador está
 * a < CERCA_APERTURA_TILES del rect; si la condición se cumplió lejos, la
 * escena se conserva y estalla la PRIMERA vez que se vuelve a acercar.
 */
export function gateBlockedAt(g: Game, mapId: MapId, x: number, y: number): StoryGate | null {
  const st = estado(g);

  // (1) transición cerrado→abierto (micro-escena determinista, 1-vez por gate)
  for (let i = 0; i < GATES.length; i++) {
    const gate = GATES[i];
    if (gate.map !== mapId) continue;
    const lockedNow = !needMet(g, gate);
    if (st.locked[i] && !lockedNow && cerca(g, gate)) {
      st.locked[i] = false;
      abrirGate(g, gate);
    }
    // Si se cumplió la condición LEJOS, se conserva st.locked[i]=true para que
    // la escena estalle la primera vez que el Portador vuelva a acercarse.
  }

  // (2) intento de entrada: tile del Portador dentro del rect expandido EXP
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  for (let i = 0; i < GATES.length; i++) {
    const gate = GATES[i];
    if (gate.map !== mapId) continue;
    const r = gate.rect;
    if (tx < r.x - EXP || ty < r.y - EXP || tx > r.x + r.w - 1 + EXP || ty > r.y + r.h - 1 + EXP) continue;
    if (needMet(g, gate) || gatePorous(g, gate)) return null; // abierto o escapando
    if (g.globalT - st.lastDenial[i] >= DENIAL_CD) {
      st.lastDenial[i] = g.globalT;
      g.toast(gate.denialToast, gate.fxColor);
      const p = g.player;
      if (p) g.floatAt(p.x, p.y - 26, gate.name, gate.fxColor, 8);
      audio.sfx('error');
    }
    return gate;
  }
  return null;
}

/**
 * Empujón de cortesía para el orquestador: si el Portador quedó con el centro
 * DENTRO del rect (caso límite save/carga), lo recoloca 1 px fuera del borde
 * más cercano (eje de menor penetración, determinista). Si solo roza el borde
 * expandido (caso normal), no hace nada: la solidez de gateSolid ya lo frenó.
 */
export function gatePushOut(g: Game, gate: StoryGate): void {
  const p = g.player;
  if (!p) return;
  const x0 = gate.rect.x * TILE;
  const x1 = (gate.rect.x + gate.rect.w) * TILE;
  const y0 = gate.rect.y * TILE;
  const y1 = (gate.rect.y + gate.rect.h) * TILE;
  if (p.x < x0 || p.x >= x1 || p.y < y0 || p.y >= y1) return; // fuera: nada que empujar
  const dLeft = p.x - x0;
  const dRight = x1 - p.x;
  const dTop = p.y - y0;
  const dBottom = y1 - p.y;
  const m = Math.min(dLeft, dRight, dTop, dBottom);
  let nx = p.x;
  let ny = p.y;
  if (m === dTop) ny = y0 - 1;
  else if (m === dBottom) ny = y1 + 1;
  else if (m === dLeft) nx = x0 - 1;
  else nx = x1 + 1;
  if (!g.tileSolidAt(nx, ny)) { p.x = nx; p.y = ny; }
  // destino sólido (improbable): no-op — antiStuck del motor es la última red.
}

/**
 * Ids de gates YA cumplidos (p. ej. para que la UI no vuelva a tostear).
 * Devuelve SIEMPRE el mismo array por Game (reutilizado, cero alloc estable):
 * NO guardar la referencia ni mutarla.
 */
export function gatesUnlocked(g: Game): string[] {
  const ids = estado(g).abiertos;
  ids.length = 0;
  for (let i = 0; i < GATES.length; i++) {
    if (needMet(g, GATES[i])) ids.push(GATES[i].id);
  }
  return ids;
}

// ---------- Micro-escena de apertura (determinista, 1-vez) ----------

/** ¿El Portador está a < CERCA_APERTURA_TILES del centro del rect? */
function cerca(g: Game, gate: StoryGate): boolean {
  const p = g.player;
  if (!p) return false;
  const gx = (gate.rect.x + gate.rect.w / 2) * TILE;
  const gy = (gate.rect.y + gate.rect.h / 2) * TILE;
  const dx = p.x - gx;
  const dy = p.y - gy;
  const r = CERCA_APERTURA_TILES * TILE;
  return dx * dx + dy * dy < r * r;
}

/** Tope local de partículas (espejo de MAX_PARTICLES del motor, no exportado). */
const TOPE_PARTICULAS = 380;

/**
 * Apertura del gate: toast diegético + sfx de puerta + ráfaga de partículas
 * del fxKind con reparto por ÁNGULO ÁUREO (sin Math.random → determinista).
 * Se dispara UNA vez por gate y sesión (desde la transición de gateBlockedAt).
 */
function abrirGate(g: Game, gate: StoryGate): void {
  g.toast(gate.openToast, gate.fxColor);
  playDoorOpen();
  const p = g.player;
  if (p) g.floatAt(p.x, p.y - 26, gate.name, gate.fxColor, 9);
  const cx = (gate.rect.x + gate.rect.w / 2) * TILE;
  const cy = (gate.rect.y + gate.rect.h / 2) * TILE;
  for (let i = 0; i < 12; i++) {
    if (g.particles.length >= TOPE_PARTICULAS) break;
    const a = i * 2.399963;                       // ángulo áureo (2π/φ)
    const s = 34 + (i % 4) * 14;
    g.particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 16,
      t: 0.55 + (i % 3) * 0.12, maxT: 0.9,
      color: gate.fxColor, size: 1 + (i % 3), grav: 70,
    });
  }
}

// ---------- FX de render (barato, culling, cero allocs) ----------

/** Hash entero determinista (Knuth xorshift-multiply) — sustituto local de hash2. */
function hashI(n: number): number {
  let h = Math.imul(n | 0, 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 'niebla': bandas ondulantes + briznas a la deriva (marea que aún no cede). */
function fxNiebla(ctx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, t: number, seed: number, color: string): void {
  ctx.fillStyle = color;
  for (let b = 0; b < 3; b++) {
    const ph = t * (0.7 + b * 0.23) + seed * 0.017 + b * 2.1;
    ctx.globalAlpha = 0.16 + b * 0.07 + 0.05 * Math.sin(t * 1.7 + b * 2.3);
    ctx.fillRect(sx - 6, sy + h * (0.2 + b * 0.3) + Math.sin(ph) * 2, w + 12, 4 + b * 2);
  }
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 6; i++) {
    const k = hashI(i + seed);
    const ox = ((k % 97) / 97) * (w + 24) - 12;
    const drift = Math.sin(t * (0.5 + (k % 13) / 26) + k) * 7;
    ctx.fillRect(sx + ox + drift, sy + ((k >> 3) % 100) / 100 * h + drift * 0.4, 5, 2);
  }
  ctx.globalAlpha = 1;
}

/** 'sello': anillo rúnico girando despacio con runas pulsantes. */
function fxSello(ctx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, t: number, seed: number, color: string): void {
  const cx = sx + w / 2;
  const cy = sy + h / 2;
  const r = Math.min(w, h) / 2 - 2;
  const ry = r * 0.55;                             // corredor ancho: elipse baja
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 2.1 + seed);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 5, 0, 6.2832); ctx.stroke();
  ctx.fillStyle = color;
  const rot = t * 0.35 + seed * 0.013;
  for (let i = 0; i < 6; i++) {
    const a = rot + i * 1.0472;                    // 2π/6
    const rx = cx + Math.cos(a) * (r - 2.5);
    const rw = cy + Math.sin(a) * ry;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2 + i * 1.3 + seed);
    ctx.fillRect(rx - 1.5, rw - 3.5, 3, 7);        // runa = estela vertical
  }
  ctx.globalAlpha = 1;
}

/** 'raices': zarcillos que se ciñen al perímetro + 7 nudos (una por nota). */
function fxRaices(ctx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, t: number, seed: number, color: string): void {
  ctx.strokeStyle = color;
  const t8 = t * 0.9;
  for (let s = 0; s < 4; s++) {
    ctx.globalAlpha = 0.34 + 0.08 * (s % 3);
    ctx.beginPath();
    for (let j = 0; j <= 6; j++) {
      const f = j / 6;
      let px: number;
      let py: number;
      const on = Math.sin(t8 + f * 5 + s * 1.7) * 2.5;
      if (s === 0) { px = sx + f * w; py = sy + on; }
      else if (s === 1) { px = sx + f * w; py = sy + h - on; }
      else if (s === 2) { px = sx + on; py = sy + f * h; }
      else { px = sx + w - on; py = sy + f * h; }
      if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = color;
  for (let i = 0; i < 7; i++) {
    const k = hashI(i + seed);
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 1.4 + i);
    ctx.fillRect(sx + ((k % 89) / 89) * w - 1.5, sy + ((k >> 4) % 89) / 89 * h - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
}

/** 'marea': líneas de espuma que suben y bajan + destellos (gate futuro). */
function fxMarea(ctx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number, t: number, seed: number, color: string): void {
  ctx.fillStyle = color;
  for (let b = 0; b < 4; b++) {
    ctx.globalAlpha = 0.14 + 0.05 * Math.sin(t * 1.1 + b * 1.8 + seed);
    ctx.fillRect(sx, sy + (h / 4) * b + Math.sin(t * (0.8 + b * 0.2) + b * 2.4) * 2, w, 2);
  }
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 8; i++) {
    const k = hashI(i + seed);
    ctx.fillRect(
      sx + ((k % 91) / 91) * w,
      sy + h - ((k >> 5) % 60) / 60 * h - 2 + Math.sin(t * 1.3 + k) * 1.5,
      2, 1.5,
    );
  }
  ctx.globalAlpha = 1;
}

/**
 * FX del gate activo (llamada del orquestador tras drawLightingV2 — el efecto
 * debe brillar sobre la penumbra). Solo gates del mapa actual, SOLO cerrados,
 * con culling por vista: si el rect no toca pantalla, no dibuja nada.
 * @param cam — cámara en px de PANTALLA: pasar { x: g.camX, y: g.camY }.
 * Coste: 3 comparaciones de mapa + 1 culling por frame cuando no hay gates
 * a la vista; cero allocs (todo con primitivas del ctx).
 */
export function drawGateFx(ctx: CanvasRenderingContext2D, g: Game, cam: { x: number; y: number }): void {
  if (!g.rows.length || !g.player) return;         // mapa aún no cargado
  for (let i = 0; i < GATES.length; i++) {
    const gate = GATES[i];
    if (gate.map !== g.mapId) continue;
    if (needMet(g, gate)) continue;                // abierto: el mundo queda limpio
    const sx = gate.rect.x * TILE * ZOOM - cam.x;
    const sy = gate.rect.y * TILE * ZOOM - cam.y;
    const sw = gate.rect.w * TILE * ZOOM;
    const sh = gate.rect.h * TILE * ZOOM;
    if (sx > VIEW_W + 28 || sy > VIEW_H + 28 || sx + sw < -28 || sy + sh < -28) continue;
    const t = g.globalT;
    switch (gate.fxKind) {
      case 'niebla': fxNiebla(ctx, sx, sy, sw, sh, t, gate.seed, gate.fxColor); break;
      case 'sello': fxSello(ctx, sx, sy, sw, sh, t, gate.seed, gate.fxColor); break;
      case 'raices': fxRaices(ctx, sx, sy, sw, sh, t, gate.seed, gate.fxColor); break;
      case 'marea': fxMarea(ctx, sx, sy, sw, sh, t, gate.seed, gate.fxColor); break;
    }
    ctx.globalAlpha = 1;
  }
}
