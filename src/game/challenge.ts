// ============================================================
// ECOS DE AELTHAR — MODO DESAFÍO (agente 12-a)
// Arena aparte de la campaña: OLEADAS sin fin y DUELOS 1v1 contra
// los tres jefes (Guardián Hueco, Sirena Abisal, Gólem de Escarcha).
//
// CÓMO FUNCIONA: corre sobre el GState 'play' normal (sin estado nuevo).
// g.challengeRun no-null activa el modo; challengeTick (llamado al final de
// Game.update, solo en play/dialogue) gobierna oleadas, spawns y resultado.
// El mapa 'arena' (maps_expansion.ts) no tiene spawns propios: TODOS los
// enemigos se instancian aquí, alrededor del Portador (8–14 tiles, nunca
// encima y solo sobre suelo libre verificado con tileSolidAt/boxFree).
//
// AISLAMIENTO DE CAMPAÑA (decisión clave, reforzada en R8 · 4.3): la arena
// JAMÁS juega con el Portador de campaña. startChallenge lo APARTA por
// REFERENCIA (su objeto no se toca: ni attrs, ni equipo, ni oro, ni XP) e
// instancia el PORTADOR DEL ECO, plantilla propia del modo (Nv 8 fijo,
// atributos planos, arma +2 — ver makePortadorDelEco). Toda la XP/oro que
// genera la ronda vive en ese temporal y se descarta al cerrar. Además,
// startChallenge toma una FOTOGRAFÍA del estado (ChallengeSnap) y finish()
// la restaura como segunda línea de defensa (flags de jefe que se colaran,
// deadGolds del peaje de muerte, 'bossIntro' del aggro, arena en
// visitedMaps…), y Game.save() ni siquiera escribe durante el reto (guard
// R7-Q1). RECOMPENSAS PERSISTENTES, todas del MODO (nunca de campaña):
//   · 'ecos-desafio-best'    — mejor puntuación de oleadas (récord)
//   · 'ecos-desafio-logros'  — marca 'duelo:<jefe>' (✓ en el menú)
//   · 'ecos-desafio-récords' — top 3 de tiempos (achievements.ts, 16-c)
//   · logro 'Rondador' en 'ecos-logros' (victoria con >70% de vida)
// SIN HISTORIA: vencer jefes aquí NO toca flags de campaña ni misiones
// (killEnemy hace early-return con challengeRun + BOSS_DEFEAT_FLAG, guard
// R7-Q1 que NO se rompe) y los textos del modo son de arena: victoria =
// stats de ronda + ranking. Sin fragmentos, citas ni botín de campaña.
//
// ABORTOS (redes de seguridad, ver challengeTick):
// 1) mapId deja de ser la arena (puerta sur / viaje) → restaurar y cerrar.
// 2) g.player ya no es el mismo objeto (Nueva partida / Continuar) → solo
//    se descarta el reto sin restaurar nada (el jugador nuevo viene limpio).
//
// CICLOS: challenge.ts importa VALORES de engine (VIEW_W/VIEW_H/TILE, mismo
// patrón live-binding ya verificado de screens/render en 11-a) y TYPES de
// engine/types. Ninguna lectura de engine al cargar el módulo → init-order
// seguro (mismo criterio que fx↔update).
// ============================================================

import type { Game } from './engine';
import { VIEW_W, VIEW_H, TILE } from './engine';
import type { Enemy, EnemyType, Player } from './types';
import { ENEMY_DEFS } from './data';
import { ARENA_MAP_ID } from './maps_expansion';
import { audio } from './audio';
import { COL, text, textShadow, panel, button, wrapText } from './ui';
import { recordChallengeResult } from './achievements'; // 16-c: marcas del desafío + logro Rondador

// ---------------- claves de localStorage (contrato documentado) ----------------

const LS_BEST = 'ecos-desafio-best';        // número: mejor puntuación de oleadas
const LS_LOGROS = 'ecos-desafio-logros';    // JSON string[]: 'duelo:guardian' | ...
const SAVE_KEY = 'ecos-aelthar-save';       // guardado de campaña (solo lectura/detección)

// punto seguro de la arena: centro del empedrado (verificado pisable en buildArena)
const CENTER_TX = 21, CENTER_TY = 16;

/** Datos de presentación de cada duelo (banner de jefe del motor).
 *  R8 4.3: los subtítulos ya NO narran lore de campaña ('El primer coro,
 *  vaciado de voz'…) — son Ecos de combate de la arena, sin historia. */
const BOSS_INFO: Record<string, { name: string; sub: string }> = {
  guardian: { name: 'GUARDIÁN HUECO', sub: 'Eco de combate del Desafío' },
  sirena: { name: 'SIRENA ABISAL', sub: 'Eco de combate del Desafío' },
  golem: { name: 'GÓLEM DE ESCARCHA', sub: 'Eco de combate del Desafío' },
};

// ---------------- interfaz pública (extensión documentada del esqueleto) ----------------

/**
 * Fotografía del estado de campaña al entrar al desafío. finish() la
 * restaura como defensa en profundidad (flags que se colaran por vías
 * indirectas, deadGolds del peaje de muerte, arena en visitedMaps…).
 * Desde R8 · 4.3 el Portador de campaña ni siquiera participa (se aparta
 * por referencia en run.campaignPlayer): la foto cubre solo el estado del
 * MOTOR (flags/quest/deadGolds), no del jugador.
 */
export interface ChallengeSnap {
  fromCampaign: boolean;                    // ¿había Portador de campaña vivo al entrar? (se aparta y se devuelve)
  gold: number;
  potions: number;
  deaths: number;
  kills: number;
  playTime: number;
  hp: number; sta: number; res: number;
  questIdx: number; questStep: number;
  flags: Record<string, number | boolean>;
  memories: string[];
  repFacciones: Record<string, number> | undefined;
  deadGolds: Game['deadGolds'];
  saveRaw: string | null;                   // contenido del save al entrar (detección de guardado en arena)
}

export interface ChallengeRun {
  mode: 'oleadas' | 'jefe';
  boss?: string;            // 'guardian' | 'sirena' | 'golem' (solo modo 'jefe')
  wave: number;             // oleada actual (1-based)
  waveTime: number;         // segundos dentro de la oleada
  betweenWaves: number;     // >0 = cuenta atrás entre oleadas
  kills: number;
  score: number;            // = oleadas superadas + kills (espec 12-a)
  active: boolean;
  // ----- extensión 12-a (campos opcionales: el motor solo toca challengeRun) -----
  phase?: 'jugando' | 'resultado';  // 'resultado' dibuja el panel sobre el título
  resultWin?: boolean;
  wavesCleared?: number;
  timeSec?: number;                 // tiempo total del reto
  spawnQueue?: EnemyType[];         // cola de la oleada en curso (entrada goteada)
  spawnT?: number;                  // cadencia de entrada
  spawnedTotal?: number;            // total instanciado → kills = total − vivos
  bossEnemy?: Enemy | null;         // referencia del duelo (victoria = .dead)
  endBeat?: number;                 // pausa dramática (~1,7 s) tras caer el jefe
  waveHadBoss?: boolean;            // la oleada trae Centinela (mini-jefe)
  waveBossDown?: boolean;           // su rastro de campaña ya se deshizo
  bannerT?: number;                 // aviso grande "OLEADA N" / título de duelo
  bannerText?: string;
  best?: number;                    // récord previo al entrar
  newBest?: boolean;
  newMark?: boolean;                // R8: primera corona del duelo ganada ESTA ronda
  snap?: ChallengeSnap;             // restauración al terminar
  campaignPlayer?: Player | null;   // R8 4.3: Portador de campaña APARTADO por referencia (nunca mutado)
  playerRef?: Player | null;        // detección de jugador reemplazado (aborto 2)
  resave?: 'rewrite' | 'remove';    // guardado en arena detectado → arreglar al salir
}

// ---------------- estado de módulo ----------------

// sub-menú de selección dibujado sobre el título (lo abre el botón DESAFÍO
// de screens.ts vía openChallengeMenu); el panel borra g.uiHit del título
// para que ningún botón de fondo reciba el clic
let menuOpen = false;

// ---------------- utilidades ----------------

function readBest(): number {
  try {
    const v = Number(localStorage.getItem(LS_BEST) ?? '0');
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch { return 0; }
}

function readLogros(): string[] {
  try {
    const raw = localStorage.getItem(LS_LOGROS);
    const arr = raw ? JSON.parse(raw) as unknown : null;
    return Array.isArray(arr) ? arr.filter(s => typeof s === 'string') as string[] : [];
  } catch { return []; }
}

function writeLogros(list: string[]): void {
  try { localStorage.setItem(LS_LOGROS, JSON.stringify(list)); } catch { /* noop */ }
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** RNG determinista por oleada (convención del proyecto: sin azar de ejecución). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * R8 4.3 — PORTADOR DEL ECO: plantilla PROPIA del modo Desafío, idéntica
 * para todo el mundo (ranking justo). Nivel 8 FIJO con atributos planos
 * (5/5/3/3/5) y arma +2 — potencia comparable a un Portador a mitad del
 * Acto I avanzado, pero SIN heredar NADA de la campaña: ni attrs, ni
 * equipo, ni oro, ni memorias, ni árbol de habilidades. La XP/nivel que
 * gane DURANTE la ronda es suya: se pierde con él al terminar.
 */
function makePortadorDelEco(): Player {
  const maxHp = 158; // 110 base Alba + 7·7 por nivel (misma fórmula que newGame)
  return {
    kind: 'player', name: 'Portador del Eco', discipline: 'alba',
    x: 0, y: 0, w: 10, h: 8, vx: 0, vy: 0, dir: 'down',
    hp: maxHp, maxHp, sprite: 'hero_alba', anim: 0, moving: false,
    level: 8, xp: 0, sta: 100, maxSta: 100, res: 0, maxRes: 100,
    attrs: { fue: 5, des: 5, int: 3, esp: 3, vig: 5 },
    points: 0, gold: 0, weaponPlus: 2, potions: 2, cds: [0, 0, 0, 0],
    iframes: 0, parryT: 0, parryFx: 0, attackT: 0, combo: 0,
    chargeT: 0, charging: false, rollT: 0, lastHitT: 0,
    hasEcho: false, kills: 0, deaths: 0, repGuardianes: 0, playTime: 0,
    tones: { empatico: 0, pragmatico: 0, sarcastico: 0, amenazante: 0 },
    memories: [],
    repFacciones: { guardianes: 0, orden: 0, circulo: 0, liga: 0 },
  };
}

// ---------------- fotografia / restauración de campaña ----------------

function snapshotCampaign(g: Game): ChallengeSnap {
  const p = g.player;
  let saveRaw: string | null = null;
  try { saveRaw = localStorage.getItem(SAVE_KEY); } catch { /* noop */ }
  return {
    fromCampaign: !!p,
    gold: p?.gold ?? 0,
    potions: p?.potions ?? 0,
    deaths: p?.deaths ?? 0,
    kills: p?.kills ?? 0,
    playTime: p?.playTime ?? 0,
    hp: p?.hp ?? 0, sta: p?.sta ?? 0, res: p?.res ?? 0,
    questIdx: g.questIdx, questStep: g.questStep,
    flags: { ...g.flags },
    memories: [...(p?.memories ?? [])],
    repFacciones: p?.repFacciones ? { ...p.repFacciones } : undefined,
    deadGolds: g.deadGolds.slice(),
    saveRaw,
  };
}

/**
 * Devuelve la campaña a su estado exacto de antes del reto. Se llama en
 * finish() (victoria/derrota/aborto).
 *
 * R8 4.3: el Portador de campaña se APARTÓ POR REFERENCIA al entrar
 * (run.campaignPlayer) y su objeto nunca fue mutado durante la ronda (la
 * arena jugó con el Portador del Eco): devolverlo es recolocar g.player.
 * La escritura defensiva de la foto se mantiene por si algún flux lateral
 * del motor tocó estado del jugador; la XP/nivel que ganó el Eco se va con
 * él (el desafío ya no es 'recompensa del guerrero': es un modo aparte).
 */
function restoreCampaign(g: Game, run: ChallengeRun): void {
  const s = run.snap;
  if (!s) return;
  if (s.fromCampaign && run.campaignPlayer) {
    g.player = run.campaignPlayer; // recolocar el objeto de campaña, intacto
    const p = g.player;
    // escritura defensiva (no-op en condiciones normales)
    p.gold = s.gold;
    p.potions = s.potions;
    p.deaths = s.deaths;
    p.kills = s.kills;
    p.playTime = s.playTime;
    p.hp = s.hp; p.sta = s.sta; p.res = s.res;
    p.memories = s.memories;
    p.repFacciones = s.repFacciones;
    g.questIdx = s.questIdx;
    g.questStep = s.questStep;
    g.flags = { ...s.flags };
    g.deadGolds = s.deadGolds;
  } else {
    // Portador del Eco puro (o campaña sin referencia): el oro/pociones que
    // acumuló en la arena no significan nada; endChallenge lo retira al
    // volver al título (aquí aún lo usa el HUD).
    g.deadGolds = [];
  }
  // ¿el jugador guardó desde la pausa estando DENTRO de la arena? El fichero
  // habría serializado mapId 'arena' + estado a medio reto. Marcamos la
  // reparación y endChallenge la ejecuta sobre lunaris ya cargado.
  let raw: string | null = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { /* noop */ }
  if (raw !== s.saveRaw) run.resave = s.saveRaw === null ? 'remove' : 'rewrite';
  // R7-Q1 #6: la arena nunca es mapa visitable de campaña — si un save
  // residual la dejó en visitedMaps, fuera (el santuario no ofrece Viajar
  // a la Arena del Eco).
  if (g.visitedMaps[ARENA_MAP_ID]) delete g.visitedMaps[ARENA_MAP_ID];
}

// ---------------- composición y spawn de oleadas ----------------

/** Escalado de la oleada: hp ×(1 + 0.12·(oleada−1)) — la espec del encargo. */
function waveMult(w: number): number { return 1 + 0.12 * (w - 1); }

/**
 * Mezcla de enemigos por oleada. Tablas fijas 1–7 (rampa legible: Acto I,
 * mini-jefe cada 3, tipos del Acto II desde la 4) y mezcla determinista
 * (semilla = nº de oleada) a partir de la 8. El daño NO se escala por
 * instancia (los cerebros leen ENEMY_DEFS): la presión sube por HP, por
 * mezcla (Acto II pega más) y por el Centinela.
 */
function waveComposition(w: number): EnemyType[] {
  if (w === 1) return ['lobo', 'lobo', 'lobo'];
  if (w === 2) return ['lobo', 'sombra', 'lobo', 'sombra'];
  if (w === 3) return ['guardian', 'esqueleto', 'esqueleto'];
  if (w === 4) return ['neumo', 'neumo', 'espectro', 'espectro'];
  if (w === 5) return ['arpi', 'arpi', 'espectro', 'neumo'];
  if (w === 6) return ['guardian', 'arpi', 'arpi', 'espectro'];
  if (w === 7) return ['espectro', 'espectro', 'neumo', 'arpi', 'sombra', 'lobo'];
  const pool: EnemyType[] = ['lobo', 'sombra', 'esqueleto', 'neumo', 'espectro', 'arpi'];
  const rng = mulberry32(w * 7919);
  const n = Math.min(10, 5 + Math.floor((w - 7) / 2));
  const out: EnemyType[] = [];
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(rng() * pool.length)]);
  if (w % 3 === 0) out.unshift('guardian');
  return out;
}

/**
 * Instancia un enemigo de oleada alrededor del Portador: anillo de 8–14
 * tiles (nunca encima), dentro del recinto y solo sobre suelo libre
 * (tileSolidAt + boxFree con el hitbox del tipo). Reintenta 40 ángulos; si
 * el jugador está acorralado, entra por el sur del anillo.
 */
function spawnArenaEnemy(g: Game, run: ChallengeRun, type: EnemyType, mult: number): void {
  const p = g.player!;
  const def = ENEMY_DEFS[type];
  // hitbox idéntica a makeEnemy (guardian/sirena/golem grandes)
  const big = type === 'guardian' || type === 'sirena' || type === 'golem';
  const bw = big ? 22 : 12;
  const bh = big ? 16 : 10;
  const push = (x: number, y: number) => {
    const e = g.makeEnemy(type, x, y, 2, 'arena');
    // mini-jefe (guardián) un 25% más blando: es un escollo de oleada, no la pelea de campaña
    const scaled = Math.max(1, Math.round(def.hp * (type === 'guardian' ? mult * 0.75 : mult)));
    e.hp = scaled; e.maxHp = scaled;
    g.enemies.push(e);
    run.spawnedTotal = (run.spawnedTotal ?? 0) + 1;
  };
  for (let tries = 0; tries < 40; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = (8 + Math.random() * 6) * TILE;
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    if (x < 2.5 * TILE || y < 2.5 * TILE) continue;
    if (x > (g.map.w - 2.5) * TILE || y > (g.map.h - 2.5) * TILE) continue;
    if (g.tileSolidAt(x, y)) continue;
    if (!g.boxFree(x, y, bw, bh)) continue;
    push(x, y);
    return;
  }
  push((CENTER_TX + 0.5) * TILE, (CENTER_TY + 6) * TILE);
}

function startWave(g: Game, run: ChallengeRun): void {
  run.wave++;
  run.spawnQueue = waveComposition(run.wave);
  run.spawnT = 0.2;
  run.waveTime = 0;
  run.waveHadBoss = run.spawnQueue.includes('guardian');
  run.waveBossDown = !run.waveHadBoss;
  run.bannerT = 2.2;
  run.bannerText = run.waveHadBoss ? `OLEADA ${run.wave} · CENTINELA DEL ECO` : `OLEADA ${run.wave}`;
  audio.sfx('banner');
  if (run.waveHadBoss) {
    g.bossActive = true;
    g.toast('Un Centinela del Eco despierta en la arena', COL.boss);
  }
}

/** Spawnea el jefe del duelo 1v1 (versión "de arena", sin flags de campaña). */
function spawnDuelBoss(g: Game, run: ChallengeRun, id: string): void {
  const info = BOSS_INFO[id] ?? BOSS_INFO.guardian;
  const type = id as EnemyType;
  const bx = (CENTER_TX + 0.5) * TILE;
  const by = (CENTER_TY - 8) * TILE; // 8 tiles al norte: entra en aggro con el primer paso
  const e = g.makeEnemy(type, bx, by, 0, 'boss'); // spawnGuard 0,5 s de cortesía
  run.spawnedTotal = (run.spawnedTotal ?? 0) + 1;
  run.bossEnemy = e;
  g.enemies.push(e);
  g.bossRef = e;
  g.bossActive = true;
  g.bossBannerT = 2.6;
  g.bossBannerText = info.name;
  g.bossBannerSub = info.sub;
  audio.sfx('roar');
  g.toast(`DUELO 1v1 — ${info.name}: una sola vida, sin pociones`, COL.boss);
}

// ---------------- ciclo principal ----------------

/** Tick del modo desafío (llamado al final de Game.update en cada frame de juego). */
export function challengeTick(g: Game, dt: number): void {
  const run = g.challengeRun;
  if (!run || run.phase !== 'jugando') return;

  // --- ABORTO 1: se salió de la arena con el reto en marcha (puerta sur o
  // viaje). El loadMap del destino YA regeneró el mundo (enemigos, FX,
  // bossRef) y dejó al Portador del Eco en el punto de aterrizaje; aquí se
  // restaura la campaña y se cierra el reto.
  if (g.state === 'play' && g.mapId !== ARENA_MAP_ID) {
    // la puerta deja al jugador en el aterrizaje del destino (el único
    // salida de la arena es lunaris 25,19 — Santuario): si al restaurar
    // vuelve un Portador de campaña, recolocarlo ahí (sus coords propias
    // son de su último mapa y podrían caer dentro de un muro)
    const aterrizaje = g.player ? { x: g.player.x, y: g.player.y } : null;
    restoreCampaign(g, run);
    if (aterrizaje && g.player && run.campaignPlayer) {
      g.player.x = aterrizaje.x; g.player.y = aterrizaje.y;
    }
    const temp = !run.campaignPlayer;
    g.challengeRun = null;
    g.bossRef = null; g.bossActive = false;
    audio.setCombat(false);
    if (temp) {
      // Portador del Eco sin campaña detrás: no hay mundo que seguir → título
      g.player = null;
      g.setState('title');
    } else {
      g.toast('Has abandonado el Desafío. Tu canto retoma la campaña donde estaba...', '#c8b0e8');
    }
    return;
  }
  // --- ABORTO 2: el Portador fue REEMPLAZADO (Nueva partida / Continuar
  // tras un GUARDAR Y SALIR desde la pausa). El estado nuevo viene limpio del
  // guardado: NO se restaura nada, solo se descarta el reto huérfano.
  if (run.playerRef && g.player !== run.playerRef) {
    g.challengeRun = null;
    g.bossRef = null; g.bossActive = false;
    return;
  }
  if (g.state !== 'play' || !g.player) return; // diálogo: el mundo está detenido

  const p = g.player;
  run.timeSec = (run.timeSec ?? 0) + dt;
  if (run.bannerT && run.bannerT > 0) run.bannerT -= dt;
  if (run.mode === 'oleadas' && run.wave > 0) run.waveTime += dt;

  // kills observadas: todos los enemigos del mapa son nuestros →
  // instanciados − vivos (los muertos ya los filtró update.ts)
  run.kills = Math.max(run.kills, (run.spawnedTotal ?? 0) - g.enemies.length);
  run.score = (run.wavesCleared ?? 0) + run.kills;

  // pausa dramática tras la caída del jefe: deja respirar el slowmo/burst de
  // su muerte (expansionDeathFx) antes de saltar al panel de resultados
  if (run.endBeat !== undefined) {
    run.endBeat -= dt;
    if (run.endBeat <= 0) finish(g, run, true);
    return;
  }

  if (run.mode === 'jefe') {
    // VICTORIA: killEnemy marcó dead y cantó victoria de CAMPAÑA (flags,
    // música, botín) — restoreCampaign dentro de finish lo deshace todo.
    const be = run.bossEnemy;
    if (be && be.dead) {
      run.endBeat = 1.7;
      g.enemies = []; g.projectiles = []; g.waves = []; g.telegraphs = []; // los neumos invocados se disuelven
      g.bossRef = null; g.bossActive = false;
      audio.setCombat(false);
    }
    return;
  }

  // ---------------- MODO OLEADAS ----------------

  // el Centinela muerto canta victoria de CAMPAÑA vía killEnemy (música de
  // cripta + toasts del altar): deshacer su rastro en cuanto cae
  if (run.waveHadBoss && !run.waveBossDown && !g.enemies.some(e => e.etype === 'guardian' && !e.dead)) {
    run.waveBossDown = true;
    audio.playTrack('boss');
    g.toasts = g.toasts.filter(t => !t.text.includes('Guardián Hueco') && !t.text.includes('altar del Eco'));
    g.toast('El Centinela del Eco cae hecho añicos', COL.goldSoft);
  }

  // cuenta atrás entre oleadas
  if (run.betweenWaves > 0) {
    run.betweenWaves -= dt;
    if (run.betweenWaves <= 0) startWave(g, run);
    return;
  }

  // entrada goteada de la cola de la oleada
  if (run.spawnQueue && run.spawnQueue.length > 0) {
    run.spawnT = (run.spawnT ?? 0) - dt;
    if (run.spawnT <= 0) {
      const type = run.spawnQueue.shift();
      if (type) spawnArenaEnemy(g, run, type, waveMult(run.wave));
      run.spawnT = 0.5;
    }
    return; // la oleada sigue entrando: nada de despeje todavía
  }

  // oleada despejada → recompensa breve y cuenta atrás (récord se aplica al final)
  if (run.wave > 0 && g.enemies.length === 0) {
    run.wavesCleared = run.wave;
    run.score = (run.wavesCleared ?? 0) + run.kills;
    const heal = Math.round(p.maxHp * 0.15);
    if (p.hp > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + heal);
      g.floatAt(p.x, p.y - 18, `+${heal}`, '#7ef0a0');
    }
    audio.sfx('quest');
    g.toast(`Oleada ${run.wave} superada. Respira: la Niebla vuelve en 3...`, '#8ef0b0');
    run.betweenWaves = 3.0;
    run.waveHadBoss = false;
    run.waveBossDown = false;
    run.bannerT = 0;
  }
}

/** El jugador cayó en pleno desafío (intercepta respawn de campaña). */
export function onChallengeDeath(g: Game): void {
  const run = g.challengeRun;
  if (!run) return;
  if (run.phase !== 'jugando') { g.challengeRun = null; return; }
  // el peaje de muerte de campaña (oro/2, deadGolds, deaths++) ya lo cobró
  // playerDied: restoreCampaign dentro de finish lo devuelve intacto
  finish(g, run, false);
}

/** Entrada desde el botón DESAFÍO del título (lo añade 12-a en screens.ts). */
export function startChallenge(g: Game, mode: 'oleadas' | 'jefe', boss?: string): void {
  if (g.challengeRun && g.challengeRun.phase === 'jugando') return; // ya hay un reto en marcha
  menuOpen = false;

  const snap = snapshotCampaign(g);           // ANTES de tocar nada del mundo
  // R8 4.3 — PORTADOR PROPIO SIEMPRE: la arena JAMÁS juega con el Portador
  // de campaña (se desvalanceaba y arrastraba historia). Se aparta por
  // REFERENCIA (su objeto no se muta: ni attrs, ni equipo, ni oro, ni XP) y
  // se restaura al cerrar el reto. Juega el PORTADOR DEL ECO (plantilla fija).
  const campaignPlayer = g.player ?? null;
  g.player = makePortadorDelEco();

  // arena: época única presente, aterrizaje en el centro (findSafeTile corrige
  // si acaso); loadMap vacía enemigos/proyectiles y regenera suelo y minimapa
  g.epoch = 'presente';
  g.loadMap(ARENA_MAP_ID, CENTER_TX, CENTER_TY);
  g.epoch = 'presente';

  const p = g.player;
  if (p) {
    p.hp = p.maxHp; p.sta = p.maxSta; p.res = 0;
    p.iframes = 0; p.rollT = 0; p.attackT = 0; p.charging = false; p.chargeT = 0;
    p.cds = [0, 0, 0, 0];
    // DUELO: 1 sola vida y SIN pociones (F no ayuda: la arena no regala curas)
    if (mode === 'jefe') p.potions = 0;
  }

  const run: ChallengeRun = {
    mode,
    boss: mode === 'jefe' ? (boss && BOSS_INFO[boss] ? boss : 'guardian') : undefined,
    wave: 0, waveTime: 0,
    betweenWaves: mode === 'oleadas' ? 3.4 : 0,
    kills: 0, score: 0, active: true,
    phase: 'jugando', wavesCleared: 0, timeSec: 0,
    spawnQueue: [], spawnT: 0, spawnedTotal: 0,
    bossEnemy: null, bannerT: 0, bannerText: '',
    best: readBest(), newBest: false,
    snap, campaignPlayer, playerRef: g.player,
  };
  g.challengeRun = run;

  g.projectiles = []; g.waves = []; g.telegraphs = []; g.toasts = [];
  g.bossRef = null; g.bossActive = false;

  if (mode === 'oleadas') {
    run.bannerT = 3.4;
    run.bannerText = 'SOBREVIVE';
    g.toast('El Desafío comienza: la arena juzga, no perdona', COL.goldSoft);
  } else {
    spawnDuelBoss(g, run, run.boss as string);
  }

  audio.playTrack('boss');
  g.setState('play');
}

/**
 * Cierre desde el panel de resultados: retira el reto, deja el mundo en
 * estado sano bajo el título y repara el guardado si se escribió en arena.
 */
export function endChallenge(g: Game, _victory: boolean): void {
  const run = g.challengeRun;
  g.challengeRun = null;
  menuOpen = false;
  // Portador del Eco: se retira si no hay campaña que devolver (el título no
  // necesita jugador y NUEVA PARTIDA/CONTINUAR crean el suyo). Con campaña,
  // restoreCampaign (en finish) ya recolocó el Portador de campaña intacto:
  // el Eco portador —con su XP de la ronda— se descarta aquí de verdad.
  if (run && !run.campaignPlayer) g.player = null;
  g.enemies = [];
  g.loadMap('lunaris', 25, 19); // punto del Santuario (mismo que respawn en campaña)
  if (run?.resave === 'rewrite') {
    // el guardado se escribió DENTRO de la arena: reescribirlo con el estado
    // de campaña ya restaurado y posición de santuario
    g.save();
  } else if (run?.resave === 'remove') {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
  }
  g.setState('title'); // setState ya encaja la música del título
}

// ---------------- fin de reto ----------------

/** Resultado + limpieza + vuelta al título (victoria, derrota o aborto). */
function finish(g: Game, run: ChallengeRun, victory: boolean): void {
  run.active = false;
  run.phase = 'resultado';
  run.resultWin = victory;
  run.score = (run.wavesCleared ?? 0) + run.kills;

  // ==== 16-c (logros-stats): ratio de vida EN el momento del cierre (antes de
  // que restoreCampaign recoloque el Portador de campaña) para el logro Rondador ====
  const hpRatioPre = g.player && g.player.maxHp > 0 ? g.player.hp / g.player.maxHp : 0;

  // récord de oleadas (el duelo no lleva récord: su trofeo es el logro)
  if (run.mode === 'oleadas' && run.score > (run.best ?? 0)) {
    try { localStorage.setItem(LS_BEST, String(run.score)); } catch { /* noop */ }
    run.best = run.score;
    run.newBest = true;
  }

  restoreCampaign(g, run);
  g.enemies = []; g.projectiles = []; g.waves = []; g.telegraphs = [];
  g.bossRef = null; g.bossActive = false;
  audio.setCombat(false);
  // killEnemy cantó victoria de CAMPAÑA (flags de jefe, altar, botín): las
  // restauración ya deshizo el estado; los toasts de campaña se limpian aquí
  g.toasts = [];

  // ==== 16-c (logros-stats): top 3 de tiempos por desafío ('ecos-desafio-récords')
  // + logro Rondador (victoria con vida > 70%). Tras limpiar toasts para que el
  // aviso de logro sobreviva al panel de resultados ====
  recordChallengeResult(g, run.mode, run.boss, victory, hpRatioPre, run.timeSec ?? 0);

  // R8 4.3 — RECOMPENSA PROPIA del modo (NUNCA cruza a la campaña): la marca
  // 'duelo:<jefe>' en 'ecos-desafio-logros' (el ✓ del menú). Antes se regalaba
  // +1 poción al save de campaña al ganar el primer duelo con el Portador de
  // campaña: eliminado — el desafío es un modo aparte. Lo persistente ya era
  // del modo: récord de oleadas ('ecos-desafio-best'), top 3 de tiempos
  // ('ecos-desafio-récords', recordChallengeResult arriba) y el logro Rondador.
  run.newMark = false;
  if (victory && run.mode === 'jefe' && run.boss) {
    const logros = readLogros();
    const key = `duelo:${run.boss}`;
    if (!logros.includes(key)) {
      logros.push(key);
      writeLogros(logros);
      run.newMark = true;
    }
  }

  audio.sfx(victory ? 'levelup' : 'die');
  menuOpen = false;
  g.setState('title'); // el panel de resultados se dibuja sobre el título
}

// ---------------- HUD del desafío (estado 'play', dibuja screens.ts) ----------------

/** HUD del desafío (oleada, enemigos, puntuación, cuenta atrás, banner). */
export function drawChallengeOverlay(g: Game): void {
  const run = g.challengeRun;
  if (!run || run.phase !== 'jugando') return;
  const ctx = g.ctx;

  // banner grande al abrir cada oleada (fade simple con el timer propio)
  if ((run.bannerT ?? 0) > 0 && run.bannerText) {
    const a = Math.min(1, (run.bannerT as number) * 1.4);
    ctx.globalAlpha = a;
    textShadow(g, run.bannerText, VIEW_W / 2, Math.round(VIEW_H * 0.26), 26, COL.gold, '#000', 'center', true);
    ctx.globalAlpha = 1;
  }

  if (run.mode === 'jefe') {
    // la barra del jefe ya la dibuja el motor (bossActive/bossRef): aquí solo
    // el recordatorio del formato + el Portador del Eco (4.3), bajo la barra
    const lv = g.player?.level ?? 8;
    text(g, `Portador del Eco Nv ${lv} · DUELO 1v1 · una vida · sin pociones · ${fmtTime(run.timeSec ?? 0)}`, VIEW_W / 2, 40, 13, 'rgba(200,190,230,0.85)', 'center');
    return;
  }

  // ---- cabecera de oleadas (centrada; baja mientras el Centinela muestra barra) ----
  const py = g.bossActive ? 54 : 6;
  const w = 320;
  const x = VIEW_W / 2 - w / 2;
  panel(g, x, py, w, 58);
  textShadow(g, `OLEADA ${Math.max(1, run.wave)}`, VIEW_W / 2, py + 7, 14, COL.gold, '#000', 'center', true);
  const record = run.best ?? 0;
  text(
    g,
    `Enemigos: ${g.enemies.length + (run.spawnQueue?.length ?? 0)}   ·   PUNTOS: ${run.score}   ·   RÉCORD: ${record}`,
    VIEW_W / 2, py + 26, 14, COL.text, 'center',
  );
  // R8 4.3: el modo SIEMPRE juega con su Portador propio — visible en HUD
  text(g, `Portador del Eco · Nv ${g.player?.level ?? 8} (plantilla del Desafío, no tu campaña)`, VIEW_W / 2, py + 43, 12, 'rgba(200,190,230,0.8)', 'center');

  // cuenta atrás entre oleadas, grande y al centro
  if (run.betweenWaves > 0) {
    textShadow(g, `Próxima oleada en ${Math.max(1, Math.ceil(run.betweenWaves))}`, VIEW_W / 2, Math.round(VIEW_H * 0.34), 19, COL.goldSoft, '#000', 'center', true);
  }
}

// ---------------- título: sub-menú de selección + panel de resultados ----------------

/**
 * Lo llama screens.ts en el case 'title' (detrás de drawTitle). Dibuja el
 * sub-menú de selección si está abierto o el panel de resultados si hay un
 * reto terminado. Ambos limpiAN g.uiHit antes de registrar sus botones:
 * el título de fondo queda inalcanzable mientras el panel está abierto.
 */
export function drawChallengeTitleUi(g: Game): void {
  const run = g.challengeRun;
  if (run && run.phase === 'resultado') { drawResults(g, run); return; }
  if (menuOpen) drawMenu(g);
}

/** Abre el sub-menú de selección (acción del botón DESAFÍO del título). */
export function openChallengeMenu(): void {
  menuOpen = true;
  audio.sfx('confirm');
}

function drawMenu(g: Game): void {
  const ctx = g.ctx;
  g.uiHit.length = 0; // sin clics fantasma sobre NUEVA PARTIDA / CONTINUAR
  const w = 560, h = 340;
  const x = VIEW_W / 2 - w / 2;
  const y = Math.max(24, Math.round(VIEW_H / 2 - h / 2));
  ctx.fillStyle = 'rgba(4,6,14,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, x, y, w, h);

  textShadow(g, 'MODO DESAFÍO', VIEW_W / 2, y + 16, 18, COL.gold, '#000', 'center', true);
  text(g, 'La arena del Eco recuerda a los Portadores que cayeron de pie.', VIEW_W / 2, y + 44, 15, COL.dim, 'center');
  const best = readBest();
  // R8 4.3: plantilla propia visible en el menú (Portador del Eco, nivel fijo)
  text(g, `Récord de oleadas: ${best > 0 ? String(best) : '—'}   ·   Portador del Eco · Nv 8 fijo`, VIEW_W / 2, y + 64, 15, COL.goldSoft, 'center');

  button(g, 'OLEADAS · sobrevive sin fin', x + 60, y + 90, w - 120, 38, () => startChallenge(g, 'oleadas'), 12);
  const logros = readLogros();
  const mark = (id: string) => (logros.includes(`duelo:${id}`) ? '  ✓' : '');
  button(g, `DUELO · Guardián Hueco${mark('guardian')}`, x + 60, y + 138, w - 120, 34, () => startChallenge(g, 'jefe', 'guardian'), 11, COL.boss);
  button(g, `DUELO · Sirena Abisal${mark('sirena')}`, x + 60, y + 178, w - 120, 34, () => startChallenge(g, 'jefe', 'sirena'), 11, COL.boss);
  button(g, `DUELO · Gólem de Escarcha${mark('golem')}`, x + 60, y + 218, w - 120, 34, () => startChallenge(g, 'jefe', 'golem'), 11, COL.boss);

  // R8 4.3: sin recompensas de campaña — récords y coronas viven aparte
  const nota = wrapText('Juegas con el Portador del Eco (Nv 8, plano, arma +2): tu campaña no entra en la arena ni recibe nada. Duelo: una vida, sin pociones. Récords y coronas del Desafío se guardan aparte.', 62);
  nota.forEach((l, i) => text(g, l, x + 34, y + 262 + i * 14, 13, COL.dim, 'left'));
  button(g, 'VOLVER (ESC)', x + w / 2 - 80, y + h - 42, 160, 30, () => { menuOpen = false; audio.sfx('uiOpen'); }, 10);
  if (g.keys.has('escape')) { menuOpen = false; audio.sfx('uiOpen'); }
}

function drawResults(g: Game, run: ChallengeRun): void {
  const ctx = g.ctx;
  g.uiHit.length = 0;
  const win = run.resultWin === true;
  const w = 480, h = 336;
  const x = VIEW_W / 2 - w / 2;
  const y = Math.max(28, Math.round(VIEW_H / 2 - h / 2));
  ctx.fillStyle = 'rgba(4,6,14,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, x, y, w, h, win ? COL.gold : '#5a3040');

  textShadow(g, win ? 'VICTORIA' : 'DERROTA', VIEW_W / 2, y + 18, 22, win ? COL.gold : '#e06878', '#000', 'center', true);
  const bossName = BOSS_INFO[run.boss ?? 'guardian']?.name ?? 'EL JEFE';
  // R8 4.3: victoria = STATS DE RONDA, no narrativa — sin frases de historia
  const sub = run.mode === 'jefe'
    ? (win ? `Duelo superado · ${fmtTime(run.timeSec ?? 0)}` : `${bossName} sigue en pie... esta vez`)
    : 'La Niebla se ha llevado la ronda';
  text(g, sub, VIEW_W / 2, y + 52, 15, COL.dim, 'center');

  const lines: string[] = [];
  lines.push(run.mode === 'jefe' ? `Modalidad: Duelo 1v1 · ${bossName}` : 'Modalidad: Oleadas');
  if (run.mode === 'oleadas') lines.push(`Oleadas superadas: ${run.wavesCleared ?? 0}`);
  lines.push(`Enemigos abatidos: ${run.kills}`);
  lines.push(`Tiempo: ${fmtTime(run.timeSec ?? 0)}`);
  if (run.mode === 'oleadas') {
    lines.push(`Puntuación: ${run.score}`);
    lines.push(`Récord: ${run.best ?? 0}`);
  }
  lines.forEach((l, i) => {
    const highlight = run.mode === 'oleadas' && l.startsWith('Puntuación');
    text(g, l, VIEW_W / 2, y + 84 + i * 24, 16, highlight ? COL.goldSoft : COL.text, 'center');
  });

  let ly = y + 84 + lines.length * 24 + 4;
  if (run.newBest) {
    textShadow(g, '¡NUEVO RÉCORD!', VIEW_W / 2, ly, 15, COL.gold, '#000', 'center', true);
    ly += 22;
  }
  if (win && run.mode === 'jefe' && run.newMark) {
    text(g, `Nueva corona: primer duelo ganado a ${bossName} (✓ en el menú)`, VIEW_W / 2, ly, 14, '#7ef0a0', 'center');
    ly += 20;
  }
  if (win && run.mode === 'jefe') {
    text(g, 'Sin historia aquí: la arena solo registra tiempo y coronas del modo.', VIEW_W / 2, ly, 13, 'rgba(154,160,184,0.85)', 'center');
  }

  button(g, 'CONTINUAR (ESC)', VIEW_W / 2 - 110, y + h - 46, 220, 34, () => endChallenge(g, win), 11);
  if (g.keys.has('escape') || g.keys.has('enter')) endChallenge(g, win);
}
