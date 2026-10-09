// ============================================================
// ECOS DE AELTHAR — BALANCEADOR DE DIFICULTAD (agente 12-c)
// ============================================================
// Dificultad dinámica de CAMPAÑA: un monitor observa el rendimiento del
// Portador y mueve el nivel del mundo entre -2 y +2 con histéresis; los
// multiplicadores se aplican a hp/dmg/xp de los enemigos en los puntos de
// integración documentados al final de este comentario. Persistente en
// localStorage ('ecos-balance') con guardado con debounce; modo AUTO
// (por defecto) y MANUAL (el Portador fija el nivel).
//
// ESTADO VIVO: variable de módulo `bal` + monitor `mon`. El juego crea UNA
// instancia de Game por página (el doble montaje de React StrictMode desecha
// la primera antes de actualizar), así que el estado de módulo es seguro; el
// monitor se re-sincroniza solo si g.player cambia de objeto (nueva partida /
// carga de guardado) para no heredar contadores de otra partida.
//
// ---------------- SEÑALES OBSERVADAS (balanceTick) ----------------
// Todas medibles desde fuera del motor, sin hooks nuevos:
// · Muertes ........ delta p.deaths entre frames (playerDied hace p.deaths++
//                    dentro del mismo update; el tick aún corre ese frame).
// · Daño recibido .. comparación de p.hp frame a frame: si bajó, la diferencia
//                    es daño (la ÚNICA fuente de pérdida de vida es
//                    Game.damagePlayer; pociones y santuarios solo suben).
//                    Se atribuye al combate en curso si hay un enemigo con
//                    aggro (misma definición que audio.setCombat en update.ts:
//                    `!e.dead && e.aggro && e.ai !== 'muerto'`).
// · Combates flawless .. tramo continuo de combate (entra/sale el aggro) de
//                    ≥ 4 s que termina SIN haber recibido daño.
// · Pociones ....... delta negativo de p.potions (beber con F; comprar solo
//                    recalibra).
// · Nivel vs zona .. p.level contra la referencia de la zona (rampa ~Nv 1-12
//                    documentada por 10-b).
//
// ---------------- HISTÉRESIS (cómo se mueve el nivel) ----------------
// Cada VENTANA (10 s) se cierra un "voto" entre -3 y +3 sumando:
//   +2 por muerte en los últimos 120 s, +1 adicional con ≥2 muertes (la
//     memoria móvil SOSTIENE el voto ≥ +3 pese a las ventanas tranquilas de
//     la vuelta al santuario; una muerte sola da +2 en ventanas posteriores
//     y no alcanza el umbral de bajada)
//   +1 si se bebieron ≥ 3 pociones en los últimos 60 s   (R8 4.2: antes 2)
//   +1 si en la ventana hubo ≥ 3 s de combate y se recibió ≥ 40% de la vida
//   -1 si hubo ≥ 3 s de combate y se recibió ≤ 15% de la vida (R8 4.2: antes 10%)
//   -1 por combates flawless en los últimos 120 s, CAP -1 (R8 4.2: antes -2:
//     con ≥2 flawless la señal ya no sostiene sola la presión a la baja)
//   -1 si nivel ≥ refZona+2 · +1 si nivel ≤ refZona-2
// El nivel solo se mueve ±1 cuando las ÚLTIMAS 2 ventanas (HISTERESIS) votan
// en el mismo sentido con fuerza suficiente: subir exige voto ≤ -2
// (UMBRAL_SUBIR) y bajar voto ≥ +3 (UMBRAL_BAJAR, más exigente a propósito:
// morir UNA vez avisa pero no nerfea el mundo; morir mucho —2 en 2 min— sí).
// Además: 30 s (ENFRIAMIENTO) mínimos entre cambios y 60 s (GRACIA) de
// partida antes del primero. La memoria móvil de muertes/flawless (120 s)
// mantiene el voto sostenido pese a las ventanas tranquilas de la vuelta al
// santuario. El nivel NUNCA deriva solo hacia 0: el mundo recuerda; solo
// resetBalance o el modo MANUAL lo devuelven a Normal.
//
// ---------------- TABLA DE MULTIPLICADORES (enemyStatMult) ----------------
//   nivel  nombre        hp     dmg    xp     (sobre los valores de ENEMY_DEFS)
//   -2     Muy fácil     0.75   0.80   0.85
//   -1     Fácil         0.88   0.90   0.93
//    0     Normal        1.00   1.00   1.00
//   +1     Difícil       1.20   1.14   1.08   (R8 4.2: antes 1.15/1.10)
//   +2     Muy difícil   1.42   1.28   1.15   (R8 4.2: antes 1.30/1.20)
// Curva suave y asimétrica a propósito: bajar alivia la supervivencia (hp)
// más que el castigo (dmg); subir paga XP por debajo del riesgo asumido.
// Los enemigos YA SPAWNEADOS conservan sus stats: el multiplicador se lee al
// CONSTRUIR el enemigo (loadMap, cambio de época, minions de jefe).
//
// ---------------- R8 · EPIC 4 (balance-desafío) ----------------
// 4.1 CRÍTICO — nueva API en este módulo (el número vivía hardcodeado en
// engine.damageEnemy y lo pintaba screens.drawStats):
//   ANTES  chance = min(40, 5 + des·2) %   · multiplicador ×2
//          (Portador nuevo des 2 → 9 % · des 5 → 15 % · cap 40 %)
//   AHORA  chance = min(25, 4 + des·0.7) % · multiplicador ×2.5 (CRIT_MULT)
//          (des 2 → 5.4 % · des 5 → 7.5 % · des 10 → 11 % · cap 25 %)
// Es decir: ~la mitad de críticos que antes, pero cada uno pega un 25 % más.
// El jugo visual ya existente (hitStop 0.09, '¡CRÍTICO!', chispas doradas,
// sfx 'crit') ahora acompaña un evento raro → se LEE más jugoso sin tocar
// fx.ts. ENGANCHES exactos (1 línea cada uno, propietario: engine/screens):
//   engine.ts · damageEnemy (antes: `if (Math.random() * 100 <
//     Math.min(40, 5 + p.attrs.des * 2)) { final *= 2; crit = true; }`):
//     if (Math.random() * 100 < critChance(p.attrs.des)) { final *= CRIT_MULT; crit = true; }
//   screens.ts · línea 'Daño melé…' del panel de estado:
//     `Crítico: ${Math.round(critChance(p.attrs.des))}%`
//
// 4.2 DIFICULTAD QUE RETA — tres palancas, early game intacto:
// (a) CURVA DE AGRESIVIDAD por nivel del Portador (agresionPorNivel): los
//     enemigos NORMALES ganan +2 % de hp y daño por nivel del Portador a
//     partir del Nv 3, con tope +15 %. Nv 1-2 → ×1.00 (el arranque NO
//     cambia); Nv 8 → +10 %; Nv 10+ → +15 %. Va DENTRO de enemyStatMult,
//     así que hp/dmg quedan cableados SIN editar el motor (makeEnemy y
//     damagePlayer ya llaman enemyStatMult). El rango de aggro NO está
//     cableado: export aggroMult(g, etype?) para el enganche de 1 línea en
//     update.ts (ver CONTRATO abajo).
// (b) JEFES aparte: TIPOS_JEFE (guardian/sirena/golem/vult/coro/heraldo) NO
//     recibe la curva en HP cuando makeEnemy pasa el tipo (enganche
//     opcional: `enemyStatMult(this, type)`). El embudo de daño
//     (damagePlayer) no conoce al atacante por diseño 12-c: ahí la curva se
//     aplica a todo como YA hacía el multiplicador de mundo. Patrones y
//     fases de jefe: intactos (esa es la tarea 2.4/7.1, no esta).
// (c) AUTO más exigente (el jugador dejó de sentir peligro): para BAJAR el
//     mundo ahora hacen falta ≥3 pociones en 60 s (antes 2), el tramo
//     'recibiste poco daño' cuenta a partir del 15 % de vida (antes 10 %)
//     y los combates flawless empujan como mucho -1 (antes cap -2). Subir
//     sigue igual de alcanzable (voto ≤ -2 dos ventanas seguidas) y la
//     válvula de seguridad se mantiene: 2 muertes en 2 min siguen bajando.
//
// MODO DESAFÍO: enemyStatMult y aggroMult siguen NEUTROS con
// g.challengeRun (la arena escala por oleada en challenge.ts) y el panel
// lo indica; el Portador del Eco del desafío no dispara el monitor.
//
// ---------------- MODO DESAFÍO ----------------
// Si g.challengeRun existe, balanceTick NO actúa y enemyStatMult devuelve
// neutro: la arena del agente 12-a tiene su propio escalado por oleada.
//
// ---------------- ANTI-ABUSO (avisos) ----------------
// Máximo 1 toast por cambio de nivel y nunca en los primeros 5 minutos de
// partida (p.playTime < 300): bajar → "El mundo cede un paso atrás...",
// subir → "El mundo se torna más fiero...". Los cambios MANUALES no avisan.
//
// ================= CONTRATO DE INTEGRACIÓN (EXACTO) =================
// El integrador (propietario de engine.ts / screens.ts) cablea 4 puntos:
//
// 1) HP de enemigos — Game.makeEnemy (engine.ts, donde `const d = ENEMY_DEFS[type]`):
//      const bm = enemyStatMult(this);
//      ... hp: Math.round(d.hp * bm.hp), maxHp: Math.round(d.hp * bm.hp), ...
//    Cubre spawnEnemies de TODOS los mapas y los minions de jefe ('sombra'
//    del Guardián en update.ts, 'neumo' de la Sirena en enemies_expansion.ts):
//    todos pasan por makeEnemy. La barra de quiebre (sta/maxSta) NO se escala
//    por decisión de diseño (el quiebre es mecánica, no presión).
//
// 2) Daño enemigo→Portador — Game.damagePlayer (engine.ts), PRIMERA línea:
//      dmg = Math.max(1, Math.round(dmg * enemyStatMult(this).dmg));
//    Es el ÚNICO embudo de todo el daño enemigo (melé update.ts:770/781,
//    contacto enemies_expansion.ts:248, proyectiles update.ts:455 y
//    enemies_expansion.ts:342, ondas update.ts:496, telegrafías update.ts:514
//    y enemies_expansion.ts:749/756/843/924/970). La IA lee def.dmg de
//    ENEMY_DEFS para telegrafiar, pero el número final siempre pasa por
//    damagePlayer. No existe daño del jugador a sí mismo (verificado).
//
// 3) XP — Game.killEnemy (engine.ts, `this.gainXp(def.xp)`):
//      this.gainXp(Math.round(def.xp * enemyStatMult(this).xp));
//
// 4) Panel — screens.ts · drawPause · pestaña ESTADO (1 línea):
//      drawBalancePanel(g, px + 28, py + 398, pw - 56); // 12-c dificultad
//    El bloque mide (pw-56)×70 con botones, o ×62 en solo lectura
//    (drawBalancePanel(g, x, y, w, { readOnly: true })). En ESTADO quedan
//    ~37 px libres al pie (py+433..py+470, tras las filas de reputación de
//    VELMORA): el integrador decide si comprime esa sección (~30 px, p.ej.
//    vy0 = y+36 y filas de reputación a paso 18) o coloca el bloque en otra
//    pestaña; la función acepta x/y/w explícitos y DEVUELVE su altura.
//    Los botones del panel (Modo AUTO/MANUAL, −, +, Restablecer) usan el
//    uiHit global de ui.ts y FUNCIONAN tal cual dentro de drawPause (los hits
//    se despachan en onMouseDown sea cual sea el estado; clearHits corre al
//    inicio de drawGame). Si se prefiere la variante solo lectura, los
//    setters exportados (setBalanceAuto, nudgeBalanceLevel, resetBalance)
//    quedan listos para la tecla/botón que el integrador prefiera
//    (sugerencia: 'B' cicla MANUAL entre -2..+2 en juego).
// ============================================================

import type { Game } from './engine';
import type { Player } from './types';
import { COL, text, textShadow, panel, button } from './ui';

// ---------------- constantes de afinación ----------------

const LS_KEY = 'ecos-balance';

const VENTANA_S = 10;          // duración de cada ventana de evaluación
const UMBRAL_SUBIR = -2;       // voto mínimo (negativo) para subir de nivel
const UMBRAL_BAJAR = 3;        // voto mínimo (positivo) para bajar de nivel
const HISTERESIS = 2;          // ventanas consecutivas en el mismo sentido
const ENFRIAMIENTO_S = 30;     // mínimo entre cambios automáticos de nivel
const GRACIA_S = 60;           // partida mínima antes del primer ajuste
const TOAST_GRACIA_S = 300;    // nunca anunciar cambios en los primeros 5 min
const MEMORIA_MUERTE_S = 120;  // memoria móvil de muertes
const MEMORIA_FLAWLESS_S = 120;// memoria móvil de combates flawless
const MEMORIA_POCION_S = 60;   // memoria móvil de pociones bebidas
const COMBATE_MIN_S = 3;       // combate mínimo para valorar el daño recibido
const FLAWLESS_MIN_S = 4;      // tramo mínimo de combate para certificar flawless
const DEBOUNCE_MS = 1500;      // cadencia de guardado en localStorage
// --- R8 4.2 (AUTO más exigente: al mundo le cuesta más bajar de nivel) ---
const POCIONES_VOTO = 3;         // antes 2: beber 2 pociones ya no pide clemencia
const VOTO_DANO_ALTO_PCT = 0.40; // (antes inline 0.4, sin cambio) daño ≥ 40% vida: +1
const VOTO_DANO_BAJO_PCT = 0.15; // antes 0.10: más tramos cuentan como 'demasiado fácil'
const FLAWLESS_CAP = 1;          // antes 2: jugar perfecto empuja menos a bajar

const NIVEL_MIN = -2;
const NIVEL_MAX = 2;

/** Nivel de referencia por zona (rampa ~Nv 1-12, balance 10-b). Sirve para la
 *  señal "nivel vs zona": estar ≥2 por debajo presiona a favor de facilitar,
 *  ≥2 por encima, de endurecer. Estimaciones suaves, no castigo por zona. */
const ZONA_NIVEL_REF: Record<string, number> = {
  lunaris: 2, bosque: 4, cripta: 5, costa: 8, aldea: 9, cumbres: 11,
};

interface Mult { hp: number; dmg: number; xp: number }

/** Tabla de multiplicadores (documentada en la cabecera). +1/+2 más duros
 *  desde R8 (4.2): el mundo por ENCIMA de Normal castiga más; Normal y por
 *  debajo intactos para no romper el early game. */
const MULTS: Record<number, Mult> = {
  [-2]: { hp: 0.75, dmg: 0.80, xp: 0.85 },
  [-1]: { hp: 0.88, dmg: 0.90, xp: 0.93 },
  [0]: { hp: 1.00, dmg: 1.00, xp: 1.00 },
  [1]: { hp: 1.20, dmg: 1.14, xp: 1.08 },
  [2]: { hp: 1.42, dmg: 1.28, xp: 1.15 },
};

/** Nombres en español de -2..+2 (índice 0 = nivel -2). */
export const BALANCE_NAMES: readonly string[] = [
  'Muy fácil', 'Fácil', 'Normal', 'Difícil', 'Muy difícil',
];

export function balanceLevelName(level: number): string {
  return BALANCE_NAMES[Math.max(0, Math.min(4, level + 2))];
}

function clampLevel(n: number): number {
  return Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, Math.round(n)));
}

function multFor(level: number): Mult {
  return MULTS[clampLevel(level)];
}

// ---------------- R8 · 4.1 crítico (menos común, más jugoso) ----------------

/** Multiplicador de daño de un crítico. ANTES ×2 (hardcodeado en
 *  engine.damageEnemy). AHORA ×2.5: menos críticos (critChance), más jugo. */
export const CRIT_MULT = 2.5;

/** Probabilidad de crítico (%) en función de Destreza.
 *  ANTES: `Math.min(40, 5 + des * 2)` — des 2 → 9 %, des 5 → 15 %, cap 40 %.
 *  AHORA: `Math.min(25, 4 + des * 0.7)` — des 2 → 5.4 %, des 5 → 7.5 %,
 *  des 10 → 11 %, cap 25 %. Sigue escalando con des (~+0.7 %/punto).
 *  ENGANCHES (propietarios engine/screens, ver cabecera): engine.damageEnemy
 *  y la línea 'Crítico:' del panel de estado en screens.ts. */
export function critChance(des: number): number {
  return Math.min(25, 4 + Math.max(0, des) * 0.7);
}

// ---------------- R8 · 4.2 curva de agresividad por nivel ----------------

const AGRESION_NIVEL_BASE = 3;   // Nv 1-2 sin extra: el arranque queda intacto
const AGRESION_POR_NIVEL = 0.02; // +2 % de hp/daño/aggro por nivel a partir del 3
const AGRESION_TOPE = 1.15;      // tope +15 % (encargo 4.2: +10-15 % a mitad/final)

/** Multiplicador de agresividad de los enemigos NORMALES según el nivel del
 *  Portador: ×1.00 hasta Nv 3, +2 %/nivel, tope +15 %. Se aplica dentro de
 *  enemyStatMult (hp/dmg ya cableados por contrato 12-c) y en aggroMult
 *  (enganche documentado para update.ts). */
export function agresionPorNivel(nivel: number): number {
  const extra = Math.max(0, nivel - AGRESION_NIVEL_BASE) * AGRESION_POR_NIVEL;
  return Math.min(AGRESION_TOPE, 1 + extra);
}

/** Tipos de JEFE: no reciben la curva de agresividad en HP (sus peleas tienen
 *  fases y HP de diseño; patrones intactos). heraldo incluido por 16-a. */
const TIPOS_JEFE: ReadonlySet<string> = new Set([
  'guardian', 'sirena', 'golem', 'vult', 'coro', 'heraldo',
]);

// ---------------- estado persistido ----------------

export interface BalanceState {
  level: number;          // -2..+2 (Muy fácil → Muy difícil)
  auto: boolean;          // ajuste automático activado
  recentDeaths: number;   // diagnóstico en vivo: muertes en la memoria móvil
  recentFlawless: number; // diagnóstico en vivo: flawless en la memoria móvil
}

let bal: BalanceState | null = null;              // estado vivo (1 Game/página)
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Carga perezosa (primer uso desde el motor: título/tick/panel). SSR-safe:
 *  sin localStorage definido o con JSON corrupto, valores por defecto. */
function ensureLoaded(): BalanceState {
  if (bal) return bal;
  bal = { level: 0, auto: true, recentDeaths: 0, recentFlawless: 0 };
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { v?: number; level?: number; auto?: boolean };
        if (d && typeof d.level === 'number' && typeof d.auto === 'boolean') {
          bal.level = clampLevel(d.level);
          bal.auto = d.auto;
        }
      }
    }
  } catch { /* guardado corrupto: se parte de Normal/AUTO */ }
  return bal;
}

/** Estado actual (copia defensiva; útil para HUD/paneles del integrador). */
export function loadBalance(): BalanceState {
  const b = ensureLoaded();
  return { ...b };
}

/** Escritura inmediata en localStorage ('ecos-balance'). El propio módulo
 *  guarda con debounce (scheduleSave); esta API queda expuesta por contrato. */
export function saveBalance(s: BalanceState): void {
  bal = {
    level: clampLevel(s.level),
    auto: !!s.auto,
    recentDeaths: Math.max(0, Math.floor(s.recentDeaths)),
    recentFlawless: Math.max(0, Math.floor(s.recentFlawless)),
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, level: bal.level, auto: bal.auto }));
    }
  } catch { /* almacenamiento lleno/bloqueado: el juego sigue sin persistir */ }
}

/** Guardado con debounce: como mucho 1 escritura cada DEBOUNCE_MS. */
function scheduleSave(): void {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { saveBalance(ensureLoaded()); } catch { /* noop */ }
  }, DEBOUNCE_MS);
}

// ---------------- API manual (botones/teclas del integrador) ----------------

/** Alterna AUTO/MANUAL. Volver a AUTO no resetea el nivel: el monitor lo
 *  moverá (o no) según las señales siguientes. */
export function setBalanceAuto(auto: boolean): void {
  const b = ensureLoaded();
  if (b.auto === auto) return;
  b.auto = auto;
  scheduleSave();
}

/** Fija el nivel a mano (pasa a MANUAL). delta ±1 = un paso; cualquier otro
 *  valor se interpreta como nivel absoluto (clamp a -2..+2). */
export function nudgeBalanceLevel(delta: number): void {
  const b = ensureLoaded();
  b.auto = false;
  b.level = clampLevel(Math.abs(delta) === 1 ? b.level + delta : delta);
  scheduleSave();
}

/** Restablece a Normal/AUTO (escritura inmediata, sin debounce) y limpia el
 *  historial de votos para que el monitor no reaplique el ajuste antiguo. */
export function resetBalance(): void {
  bal = { level: 0, auto: true, recentDeaths: 0, recentFlawless: 0 };
  try { saveBalance(bal); } catch { /* noop */ }
  if (mon) { mon.votes = []; mon.lastChangeT = -1e9; }
}

// ---------------- monitor (señales por tick) ----------------

interface Monitor {
  prevPlayer: Player | null;   // re-sincronización al cambiar de partida
  prevHp: number;
  prevDeaths: number;
  prevPotions: number;
  inCombat: boolean;           // hay enemigo con aggro (definición de update.ts)
  spanDmg: number;             // daño recibido en el tramo de combate actual
  spanT: number;               // duración del tramo de combate actual
  winT: number;                // tiempo acumulado de la ventana actual
  winDmg: number;              // daño recibido (en combate) en la ventana
  winCombatT: number;          // segundos en combate dentro de la ventana
  votes: number[];             // últimos votos de ventana (histéresis)
  lastChangeT: number;         // playTime del último cambio (-1e9: nunca)
  tMuertes: number[];          // timestamps (playTime) de muertes
  tFlawless: number[];         // timestamps de combates flawless
  tPociones: number[];         // timestamps de pociones bebidas
}

let mon: Monitor | null = null;

function newMonitor(): Monitor {
  return {
    prevPlayer: null, prevHp: 0, prevDeaths: 0, prevPotions: 0,
    inCombat: false, spanDmg: 0, spanT: 0,
    winT: 0, winDmg: 0, winCombatT: 0,
    votes: [], lastChangeT: -1e9,
    tMuertes: [], tFlawless: [], tPociones: [],
  };
}

/** Cierra la ventana: computa el voto y, con histéresis cumplida y modo AUTO,
 *  mueve el nivel ±1 (con enfriamiento, gracia y anti-abuso de toasts). */
function cerrarVentana(g: Game, t: number): void {
  if (!mon) return;
  const p = g.player!;
  const b = ensureLoaded();

  // ---- voto de la ventana ----
  // R8 4.2 (AUTO reta más): con las mismas señales, ahora CUESTA MÁS que el
  // mundo baje y es más fácil que suba: los flawless empujan como mucho -1
  // (antes -2), beber pociones exige 3 en 60 s (antes 2) y el tramo
  // 'recibiste poco daño' cuenta desde el 15 % de vida (antes 10 %). La
  // válvula de seguridad se mantiene: 2 muertes en 2 min siguen bajando.
  let voto = 0;
  const muertes = mon.tMuertes.length;
  if (muertes >= 1) voto += 2; // morir pesa mucho (y la memoria lo sostiene)
  if (muertes >= 2) voto += 1; // morir mucho: voto ≥ +3 sostenido → baja
  if (mon.tPociones.length >= POCIONES_VOTO) voto += 1;
  const huboCombate = mon.winCombatT >= COMBATE_MIN_S;
  const pctVida = p.maxHp > 0 ? mon.winDmg / p.maxHp : 0;
  if (huboCombate && pctVida >= VOTO_DANO_ALTO_PCT) voto += 1;
  if (huboCombate && pctVida <= VOTO_DANO_BAJO_PCT) voto -= 1;
  voto -= Math.min(FLAWLESS_CAP, mon.tFlawless.length);
  const ref = ZONA_NIVEL_REF[g.mapId] ?? 6;
  if (p.level >= ref + 2) voto -= 1;
  if (p.level <= ref - 2) voto += 1;
  voto = Math.max(-3, Math.min(3, voto));

  // ---- histéresis ----
  mon.votes.push(voto);
  if (mon.votes.length > HISTERESIS) mon.votes.shift();
  if (!b.auto || t < GRACIA_S) return;
  if (t - mon.lastChangeT < ENFRIAMIENTO_S) return;
  if (mon.votes.length < HISTERESIS) return;
  const sube = mon.votes.every(v => v <= UMBRAL_SUBIR);
  const baja = mon.votes.every(v => v >= UMBRAL_BAJAR);
  if (!sube && !baja) return;

  // ---- cambio de nivel (±1, nunca brusco) ----
  const dir = sube ? 1 : -1;
  const nuevo = clampLevel(b.level + dir);
  mon.votes = []; // las señales se consumen: el siguiente cambio debe ganarse
  if (nuevo === b.level) return; // ya en el tope -2/+2
  b.level = nuevo;
  mon.lastChangeT = t;
  scheduleSave();
  // anti-abuso: 1 toast por cambio, nunca en los primeros 5 min de partida
  if (t >= TOAST_GRACIA_S) {
    g.toast(
      dir < 0 ? 'El mundo cede un paso atrás...' : 'El mundo se torna más fiero...',
      dir < 0 ? '#8ef0b0' : '#e0a060',
    );
  }
}

/** Tick del monitor (llamado desde Game.update en play/dialogue). O(enemigos),
 *  sin allocations por frame salvo eventos (muerte/flawless/poción). */
export function balanceTick(g: Game, dt: number): void {
  const p = g.player;
  if (!p) return;                 // título/intro: nada que observar
  if (g.challengeRun) return;     // modo desafío: fuera de alcance (12-a)
  const b = ensureLoaded();
  if (!mon) mon = newMonitor();

  // re-sincronización: nueva partida / carga (otro objeto Player) → calibrar
  // sin heredar contadores ni contar muertes del guardado antiguo.
  if (mon.prevPlayer !== p) {
    mon.prevPlayer = p;
    mon.prevHp = p.hp;
    mon.prevDeaths = p.deaths;
    mon.prevPotions = p.potions;
    mon.inCombat = false;
    mon.spanDmg = 0; mon.spanT = 0;
    mon.winT = 0; mon.winDmg = 0; mon.winCombatT = 0;
    mon.tMuertes = []; mon.tFlawless = []; mon.tPociones = [];
    return;
  }

  const t = p.playTime;
  const combate = g.enemies.some(e => !e.dead && e.aggro && e.ai !== 'muerto');

  // daño recibido: hp previo → actual (la única fuente de pérdida es
  // Game.damagePlayer; se atribuye al combate si hay aggro)
  if (p.hp < mon.prevHp) {
    const d = mon.prevHp - p.hp;
    if (combate) { mon.winDmg += d; mon.spanDmg += d; }
  }
  mon.prevHp = p.hp;

  // muertes: el frame de la muerte aún pasa por aquí (playerDied corre dentro
  // de updateGame, antes de este tick)
  while (mon.prevDeaths < p.deaths) { mon.prevDeaths++; mon.tMuertes.push(t); }

  // pociones bebidas (comprar recalibra, no cuenta como señal)
  while (mon.prevPotions > p.potions) { mon.prevPotions--; mon.tPociones.push(t); }
  if (p.potions > mon.prevPotions) mon.prevPotions = p.potions;

  // tramos de combate (para flawless): entra/sale el aggro
  if (combate && g.state === 'play') {
    if (!mon.inCombat) { mon.inCombat = true; mon.spanDmg = 0; mon.spanT = 0; }
    mon.spanT += dt;
    mon.winCombatT += dt;
  } else if (mon.inCombat) {
    mon.inCombat = false;
    if (mon.spanT >= FLAWLESS_MIN_S && mon.spanDmg === 0) mon.tFlawless.push(t);
  }

  // diagnóstico en vivo (paneles/HUD)
  b.recentDeaths = mon.tMuertes.length;
  b.recentFlawless = mon.tFlawless.length;

  // ventana de evaluación
  mon.winT += dt;
  if (mon.winT >= VENTANA_S) {
    cerrarVentana(g, t);
    mon.winT = 0; mon.winDmg = 0; mon.winCombatT = 0;
  }

  // poda de memorias móviles
  const prune = (arr: number[], win: number) => {
    while (arr.length > 0 && arr[0] < t - win) arr.shift();
  };
  prune(mon.tMuertes, MEMORIA_MUERTE_S);
  prune(mon.tFlawless, MEMORIA_FLAWLESS_S);
  prune(mon.tPociones, MEMORIA_POCION_S);
}

// ---------------- multiplicadores (contrato de spawns) ----------------

/** Multiplicadores actuales para un spawn de enemigo. Ver CONTRATO en la
 *  cabecera: hp en Game.makeEnemy, dmg en Game.damagePlayer, xp en
 *  Game.killEnemy. Neutro sin partida y en modo desafío.
 *
 *  R8 4.2: sobre la tabla de mundo se aplica la CURVA DE AGRESIVIDAD por
 *  nivel del Portador (agresionPorNivel: +2 %/nivel desde Nv 3, tope +15 %).
 *  Los tres puntos de integración del motor llaman `enemyStatMult(this)`,
 *  así que hp/dmg suben SIN editar el motor. Si se pasa `etype` y es JEFE
 *  (TIPOS_JEFE), la curva NO se aplica a esa lectura: HP de jefe de diseño
 *  (enganche recomendado en makeEnemy: `enemyStatMult(this, type)`).
 *  El funnel de daño (damagePlayer) no conoce al atacante: ahí la curva se
 *  aplica a todo, igual que YA hacía el multiplicador de mundo 12-c. La XP
 *  NO sube con la curva (más riesgo no regala más progresión). */
export function enemyStatMult(g: Game, etype?: string): { hp: number; dmg: number; xp: number } {
  if (!g.player) return { hp: 1, dmg: 1, xp: 1 };     // sin partida activa
  if (g.challengeRun) return { hp: 1, dmg: 1, xp: 1 };// desafío: escala 12-a
  const base = multFor(ensureLoaded().level);
  if (etype && TIPOS_JEFE.has(etype)) return { ...base }; // jefe: HP de diseño
  const agresion = agresionPorNivel(g.player.level);      // enemigos normales
  return { hp: base.hp * agresion, dmg: base.dmg * agresion, xp: base.xp };
}

/** R8 4.2 — multiplicador del RANGO DE AGGRO para el enganche de update.ts
 *  (1 línea, ver CONTRATO). Misma curva que hp/dmg: a mayor nivel del
 *  Portador, los enemigos normales te detectan antes (hasta +15 %). Jefes y
 *  desafío: neutro. ENGANCHE EXACTO en update.ts (~línea 889):
 *    ANTES: const aggroR = def.aggroR * nightMult * (e.etype === 'guardian' ? (g.bossActive ? 99 : 1) : 1);
 *    AHORA: const aggroR = def.aggroR * nightMult * aggroMult(g, e.etype) * (e.etype === 'guardian' ? (g.bossActive ? 99 : 1) : 1);
 *  (+ import { aggroMult } from './balance') */
export function aggroMult(g: Game, etype?: string): number {
  if (!g.player || g.challengeRun) return 1;
  if (etype && TIPOS_JEFE.has(etype)) return 1;
  return agresionPorNivel(g.player.level);
}

// ---------------- panel (pestaña ESTADO de la pausa) ----------------

/**
 * Panel de dificultad para la pausa. INTEGRACIÓN (1 línea, ver contrato):
 *   drawBalancePanel(g, px + 28, py + 398, pw - 56); // en drawPause · ESTADO
 * Por defecto se ancla solo al pie del panel de pausa (el bitmap del canvas
 * SIEMPRE mide VIEW_W×VIEW_H — Game.fitCanvas — así no se importa el valor
 * del motor). Devuelve la altura dibujada (70 interactivo / 62 solo lectura).
 * Los botones usan el uiHit global y funcionan tal cual dentro de drawPause;
 * con { readOnly: true } dibuja sin botones (los setters quedan para la
 * tecla/botón que el integrador prefiera).
 */
export function drawBalancePanel(
  g: Game, x?: number, y?: number, w = 664, opts?: { readOnly?: boolean },
): number {
  const b = ensureLoaded();
  const readOnly = opts?.readOnly === true;
  if (x === undefined) x = (g.canvas.width - 720) / 2 + 28;   // margen de drawPause
  if (y === undefined) y = (g.canvas.height - 470) / 2 + 398; // pie del panel
  const h = readOnly ? 62 : 70;

  panel(g, x, y, w, h, 'rgba(90,74,48,0.6)', 'rgba(8,10,18,0.6)');

  // cabecera + indicador AUTO/MANUAL
  textShadow(g, '◆ DIFICULTAD DEL MUNDO ◆', x + 10, y + 5, 16, COL.gold, '#000');
  text(g, b.auto ? 'MODO AUTO' : 'MODO MANUAL', x + w - 10, y + 7, 14,
    b.auto ? COL.quest : COL.goldSoft, 'right');

  // galga de 5 niveles con nombres en español
  // R8 4.2: los efectos mostrados son los REALES que verá un spawn de
  // enemigo normal: tabla de mundo × curva de agresividad por nivel del
  // Portador. En desafío (enemyStatMult neutro) la fila lo indica.
  const curva = g.challengeRun || !g.player ? 1 : agresionPorNivel(g.player.level);
  const mult0 = multFor(b.level);
  const mult = { hp: mult0.hp * curva, dmg: mult0.dmg * curva, xp: mult0.xp };
  const cellW = 84, gap = 4, gy = y + 24, gh = 16;
  let gx = x + 10;
  for (let i = 0; i < 5; i++) {
    const activo = i - 2 === b.level;
    panel(g, gx, gy, cellW, gh, activo ? COL.gold : COL.panelBorder,
      activo ? 'rgba(60,48,24,0.9)' : 'rgba(12,14,24,0.8)');
    text(g, BALANCE_NAMES[i], gx + cellW / 2, gy + 2, 12,
      activo ? COL.goldSoft : COL.dim, 'center');
    gx += cellW + gap;
  }
  // efectos actuales (contrato: hp/dmg/xp sobre ENEMY_DEFS)
  const pct = (v: number) =>
    v === 1 ? '+0%' : (v > 1 ? '+' : '-') + Math.round(Math.abs(v - 1) * 100) + '%';
  text(g, g.challengeRun
    ? 'En el Desafío la presión la marcan las oleadas (no este panel)'
    : `Vida ${pct(mult.hp)} · Daño ${pct(mult.dmg)} · XP ${pct(mult.xp)}`,
    gx + 10, gy + 2, 13, COL.dim);

  if (!readOnly) {
    // botones (funcionales vía uiHit global; el integrador solo llama esto)
    const by = y + 46, bh = 20;
    const agg = curva > 1 ? ` · agresión +${Math.round((curva - 1) * 100)}%` : '';
    button(g, b.auto ? 'Modo: AUTO' : 'Modo: MANUAL', x + 10, by, 124, bh,
      () => setBalanceAuto(!b.auto), 11);
    button(g, '-', x + 138, by, 28, bh, () => nudgeBalanceLevel(-1), 11);
    button(g, '+', x + 170, by, 28, bh, () => nudgeBalanceLevel(1), 11);
    button(g, 'Restablecer', x + 202, by, 120, bh, () => resetBalance(), 10);
    text(g, b.auto
      ? `Se ajusta según tu rendimiento (y se guarda)${agg}`
      : `Fijado a mano: no cambiará solo${agg}`,
      x + 332, by + 5, 13, COL.dim);
  } else {
    const agg = curva > 1
      ? ` · agresión por tu nivel (Nv ${g.player?.level ?? 1}): +${Math.round((curva - 1) * 100)}%`
      : '';
    text(g, g.challengeRun
      ? 'El Desafío no usa este panel: juega con el Portador del Eco'
      : b.auto
        ? `Ajuste automático: observa tu rendimiento y se guarda solo${agg}`
        : `Nivel fijado a mano (persistente entre sesiones)${agg}`,
      x + 10, y + 45, 13, COL.dim);
  }
  return h;
}
