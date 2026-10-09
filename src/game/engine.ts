// ============================================================
// ECOS DE AELTHAR — Motor principal
// Máquina de estados, bucle, input, mundo, diálogos, guardado
// ============================================================

// VIEW_W/VIEW_H/ZOOM viven en ./consts (primer import: ver nota allí) y se
// re-exportan para que `from './engine'` siga funcionando en todo el motor.
// fitViewToWindow (vista dinámica, merge main) también vive allí.
import { VIEW_W, VIEW_H, ZOOM, fitViewToWindow } from './consts';
export { VIEW_W, VIEW_H, ZOOM, fitViewToWindow };

import type {
  Player, Enemy, Npc, Companion, MapId, Epoch, Projectile, Particle, FloatText,
  Toast, Shockwave, TeleGraph, SaveData, DialogueNode, DialogueOption, Dir, Element, StatsData,
  ChestDef, SpellFxSlot,
} from './types';
import { MAPS, mapRows, tileAt, mapEpochs } from './maps';
import { ARENA_MAP_ID } from './maps_expansion'; // 17-d: la arena no entra en visitedMaps (ver loadMap)
import { SOLID_CHARS, TILE, initSprites, getSpr, frameIndex, drawTallTile, drawTile, hash2 } from './sprites';
import { initExpansionSprites, drawExpansionTile, drawExpansionTallTile } from './sprites_expansion';
import { audio, playSpellCast, playSpellImpact, playNightAmbience, playHowlDistant, playBossRoarVariant, playLeverPull, playDoorOpen } from './audio';
import { ENEMY_DEFS, SKILLS, DIALOGUES, QUESTS, getDialogue, SENNUEL } from './data';
import { updateGame, cryptDoorOpen, cryptLeverTryActivateNear } from './update';
// Ronda 2 · Terror: disolución al morir + stinger de pavor + resets de la intro/FX del jefe
import { spawnDeathDissolve, resetBossFx } from './actors/bossfx';
import { resetBossIntro } from './actors/bossintro';
import { dreadStinger } from './actors/dread';
// Ronda 3 · Combate y Juice: chispas, remate/kill feedback y HUD vivo
import { spawnHitSparks } from './fx';
import { comboPitch } from './fxcore';
import { onKill, onFinisher, resetKillFx } from './actors/killfx';
import { notifyLevelUp, notifyStatPoint } from './actors/hudfx';
import { drawGame } from './render';
import { buildMinimapV2 } from './world/minimap';
import { handleCustomAction, recordDialogueTone } from './hooks';
import { challengeTick, onChallengeDeath, type ChallengeRun } from './challenge';
import { skillTick, skillCdMult, setSkillCdDecay, skillDamageMult } from './skilltree';
import { balanceTick, enemyStatMult, critChance, CRIT_MULT } from './balance';
import { worldTick, worldInteract } from './worldlife';
import { timeTick, beginEpochShift } from './timeskip';
import { acto5Tick, estrenarCuna } from './acto5'; // R13 «La carta»: ritmo del Aún + estrena (solo en la Cuna)
import { acto5TickR14 } from './acto5b'; // R14 «La Ciudadela»: la muralla que canta (solo en la Ciudadela)
import { defaultStats, sanitizeStats, statsTick, achievementTick } from './achievements'; // 16-c: estadísticas + logros
import {
  cycleCompanionMode, useSenno, registerCorpse16b, bossSennoLoot16b, companionInterpose,
  noteDialogueClosed16b, rumorAfterDialogue16b, interaccionInteract16b,
} from './interaccion'; // 16-b: órdenes tácticas + señuelo + restos + rumores
import {
  ARMORS, ARMOR_HEAVY_SPEED, armorActive, armorActiveId, armorDefFor, armorReduction, armorTick,
} from './armor';
import { initPerf, perfFrame, drawPerfOverlay, togglePerfOverlay, perfQuality } from './perf'; // R5-O1: supervisión · R6-V10: consume perfQuality
import { lorePropsForMap } from './world/props'; // R10-6: lore en el mundo

// R10-6 · siembra de props de lore (placas/restos/altares/carteles/mojones):
// determinista, nunca sobre sólidos. FUNCIÓN con guard — NO a nivel de módulo:
// props importa TILE/ZOOM de engine y sembrar aquí rompería el orden de eval
// (props→engine→props con TDZ en los consts de props). Se llama en el ctor.
let loreSeeded = false;
function seedLoreProps(): void {
  if (loreSeeded) return;
  loreSeeded = true;
  for (const m of Object.values(MAPS)) m.props.push(...lorePropsForMap(m));
}


// 14-b (auditoría de cooldowns): el motor aplica skillCdMult AL FIJAR el cd
// en useSkill (camino B del contrato skilltree.ts) → el decaimiento extra por
// tick se desactiva para que NUNCA se descuente dos veces. Con esto el cd
// nace reducido en todos los puntos presentes/futuros de fijación.
setSkillCdDecay(false);

// 14-b (Manto de Ecos): guard anti-reentrancy del reflejo (damageEnemy no
// daña al jugador, pero el flag blinda el embudo ante cambios futuros).
let reflectBusy = false;

// ==== 17-a (qa-combate) ==== carga de ataque por TECLADO (mantener J):
// onKeyUp ya liberaba la carga al soltar J, pero ningún keydown la INICIABA
// (solo el clic izquierdo): el control «mantener J» era imposible. Este set
// recuerda qué cargas nacieron de J para que cada vía libere solo la suya
// (soltar el ratón no corta una carga de J y viceversa).
const chargeViaTecla = new WeakSet<Player>();

// 14-b (compañeros): memoria transitoria de Ilwen por instancia (no serializa;
// mismo patrón WeakMap que update.ts/skilltree). El seguimiento, el disparo
// base y la Lluvia de estrellas siguen viniendo de update.ts (congelado):
// este módulo AÑADE escolta robusta + apoyo de combate + avisos.
interface CompMem { lastX: number; lastY: number; stuckT: number; coverCd: number; lineCd: number; lineIdx: number }
const compMem = new WeakMap<Companion, CompMem>();
const COMPANION_LINES = [
  '¡A tu izquierda!',
  '¡Vienen varios, no te dejes rodear!',
  '¡Detrás de ti!',
  'Cúbreme el flanco.',
  '¡Están flanqueándote!',
];

/** Flag de derrota por tipo de JEFE (Acto II: sirena/golem se suman al Guardián). */
export const BOSS_DEFEAT_FLAG: Record<string, string> = {
  guardian: 'guardianDefeated',
  sirena: 'sirenaDefeated',
  golem: 'golemDefeated',
  vult: 'vultDefeated', // 14-a
  coro: 'coroDefeated', // 14-a
  // ==== 17-a (qa-combate) ==== Vesh ('heraldo', jefe final del Acto IV, 16-a)
  // no estaba en la tabla: stats.jefesDerrotados no lo contaba al matarlo
  // (killEnemy cuenta por presencia aquí) y la memoria de HP de jefe de
  // loadMap lo ignoraba. La flag la fijaba SOLO el watcher de diálogo del
  // Acto IV (hooks.acto4CatchUp), así que matar a Vesh y caer antes de
  // hablar con nadie dejaba la derrota huérfana (re-invocable → doble
  // XP/botín). Rama propia en killEnemy abajo + espejo en interaccion.BOSS_TYPES.
  heraldo: 'heraldoDerrotado',
  sepulcro: 'sepulcroDerrotado', // R10-9: mini-jefe de la entrada de la cripta
};

// R5-O6 (optimización): topes duros de recursos FX. fx.ts empuja partículas
// directo a g.particles sin cap: en picos de combate el render degradaba.
// Recortar las más viejas mantiene el coste de update/render acotado.
const MAX_PARTICLES = 400;
const MAX_FLOATS = 64;

// ---- Ronda 8 · bugs del motor (R8-1.3 / R8-1.4 / R8-1.6 / R8-1.7) ----
// Tiles altos ('t' árbol frondoso / 'p' pino): sprites que se dibujan POR
// ENCIMA de entidades/props — un cofre o un enemigo spawneado sobre ellos
// nace "dentro del árbol". Los valida el motor al cargar el mapa.
const TALL_CHARS = new Set<string>(['t', 'p']);
// R8-1.4 (evento del primer poder): topes duros del anillo de evento. El
// despertar del primer Eco convoca una respuesta de la Niebla ACOTADA: máximo
// de unidades, separación mínima entre ellas y con el Portador, y guard de
// una-sola-vez persistido en flags (ver spawnEventRing).
const EVENT_RING_MAX = 6;      // tope duro de enemigos por evento de historia
const EVENT_RING_MIN_GAP = 34; // px (~2 tiles) entre unidades del anillo
const MAX_MAP_ENEMIES = 40;    // tope de población viva total tras un evento
// R8-1.3: los cofres se validan UNA vez por objeto/sesión (WeakSet — no toca
// types.ts ni maps.ts; el ajuste de posición lo leen render e interacción).
const validatedChests = new WeakSet<ChestDef>();

// R6-V10 (calidad adaptativa): tope de ancho de vista en BAJA sostenida.
// El coste de drawGame escala con VIEW_W×VIEW_H: recortar el ancho extra que
// ganan las pantallas muy anchas (fitViewToWindow llega a 1600 px) alivia el
// fill-rate en máquinas flojas SIN tocar gameplay: la vista base 960×540 de
// 16:9 nunca se ve afectada (el tope solo actúa por encima de 1280 px).
const LOWQ_VIEW_MAX_W = 1280; // ancho máximo del buffer con calidad baja sostenida
const LOWQ_VIEW_BASE_H = 540; // alto base que fitViewToWindow mantiene a 16:9 exacto
const LOWQ_SUSTAIN_S = 5;     // segundos SEGUIDOS en calidad baja para activar el tope

export type GState = 'title' | 'controls' | 'intro' | 'play' | 'pause' | 'dialogue' | 'dead' | 'end' | 'skills';

export interface UiHit { x: number; y: number; w: number; h: number; cb: () => void; hover?: boolean; state?: GState }

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GState = 'title';
  onStateChange?: (s: GState) => void;
  onRequestCreate?: () => void;
  musicVolUi = 0.7;
  sfxVolUi = 0.8;

  requestCreate() {
    // blindaje anti clic-fantasma (2ª capa): la creación SOLO existe desde el
    // título. Si algún uiHit residual de otra instancia/estado disparara esto,
    // el guard lo ignora y el overlay DOM nunca se abre en plena partida.
    if (this.state !== 'title') return;
    audio.sfx('confirm');
    this.onRequestCreate?.();
  }

  // mundo
  mapId: MapId = 'lunaris';
  map = MAPS.lunaris;
  rows: string[] = [];
  groundCanvas: HTMLCanvasElement | null = null;
  groundPastCanvas: HTMLCanvasElement | null = null;
  miniCanvas: HTMLCanvasElement | null = null;
  miniCanvasPast: HTMLCanvasElement | null = null; // minimapa v2 del pasado (solo mapas con epochDiffs)
  // R5-O6: clave del último prerrender (mapId|epoch|rows.length) — evita
  // reconstruir groundCanvas/miniCanvas al recargar el MISMO mapa+época.
  private groundCacheKey: string | null = null;
  epoch: Epoch = 'presente';
  epochFx = 0;

  // entidades
  player: Player | null = null;
  enemies: Enemy[] = [];
  npcs: Npc[] = [];
  companion: Companion | null = null;
  visitedMaps: Record<string, boolean> = { lunaris: true };

  // efectos y proyectiles
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  floats: FloatText[] = [];
  toasts: Toast[] = [];
  waves: Shockwave[] = [];
  telegraphs: TeleGraph[] = [];
  // R9-4 · magias espectaculares: pools fijos de FX (carga visible / impacto+residuo)
  spellCastFx: SpellFxSlot[] = [];
  spellImpactFx: SpellFxSlot[] = [];
  lastNote: Element = 'fuego';

  // feedback visual compartido (contrato fxcore)
  flashT = 0;
  flashColor = '#ffffff';
  slowmoT = 0;
  memoryReveal: { id: string; title: string; text: string; t: number } | null = null;
  bossBannerT = 0;
  bossBannerText = '';
  bossBannerSub = '';

  // progreso
  flags: Record<string, number | boolean | string> = {}; // R10: string = bossHpWho_* (dueño de la memoria de HP)
  questIdx = 0;
  questStep = 0;
  openedChests = new Set<string>();
  takenEchoes = new Set<string>();
  deadGolds: { map: MapId; x: number; y: number; amount: number }[] = [];

  // cámara / tiempo
  camX = 0; camY = 0;
  dayT = 0.15;              // 0..1 ciclo día/noche
  globalT = 0;
  mapTitleT = 0;
  hitStop = 0;
  shake = 0;
  fadeT = 0; fadeDir = 0;   // transición de mapa
  pendingMap: { to: MapId; tx: number; ty: number } | null = null;
  exitCd = 0;               // enfriamiento anti-bucle tras loadMap (ignora zonas de salida)
  rollQueued = false;       // esquiva en cola (detección de borde: 1 pulsación = 1 voltereta)
  lastGoldLost = 0;         // oro perdido en la última muerte (lo muestra la pantalla de muerte)

  // UI
  uiHit: UiHit[] = [];
  mouse = { x: 0, y: 0, down: false, rdown: false, worldX: 0, worldY: 0 };
  keys = new Set<string>();
  pauseTab: 0 | 1 | 2 | 3 = 0;
  introIdx = 0;
  endStats = '';

  // diálogo
  dlgKey: string | null = null;
  dlgNode: DialogueNode | null = null;
  dlgCharT = 0;
  dlgSel = 0;
  dynNodes: Record<string, DialogueNode> = {};

  // jefe
  bossRef: Enemy | null = null;
  bossActive = false;

  // modo desafío (arena): sesión volátil — no se serializa en save()
  challengeRun: ChallengeRun | null = null;

  // ==== 16-c (logros-stats): estadísticas de la partida (save/load con defaults) ====
  stats: StatsData = defaultStats();

  // bucle
  private raf = 0;
  private lastTs = 0;
  private running = false;
  loopError: string | null = null;

  // R6-V10: histéresis propia del tope de vista (perf.ts NO exporta cuánto
  // tiempo lleva el escalón en baja → se mide aquí, en tiempo real).
  private perfLastTick = -1;  // performance.now() del tick anterior (hueco >1 s → tramo roto)
  private perfLowSince = -1;  // inicio del tramo continuo en calidad baja (-1 = fuera de baja)
  private perfCapOn = false;  // true = el tope LOWQ_VIEW_MAX_W está aplicado ahora mismo

  // R8-1.7/R8-1.6: throttles de feedback (globalT del último aviso) — evitan
  // spamear mensajes mientras el Portador insiste contra la barrera/puerta.
  private barrierMsgAt = -99;   // último aviso de barrera de época (niebla/puente)
  private cryptGateMsgAt = -99; // último aviso de "la Cripta solo cede a su puerta"

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    seedLoreProps(); // R10-6: lore del mundo (1× por sesión, tras evaluar módulos)
    initSprites();
    initExpansionSprites(); // Acto II: sprites de neumo/espectro/arpi/sirena/golem + proyectiles
    this.bindInput();
    initPerf(this); // R5-O1: lee localStorage['aelthar_perf'] (no-op seguro en SSR)
    // volúmenes persistidos (sistema → sliders)
    try {
      const v = JSON.parse(localStorage.getItem('ecos-vol') ?? 'null');
      if (v && typeof v.m === 'number' && typeof v.s === 'number') {
        this.musicVolUi = Math.min(1, Math.max(0, v.m));
        this.sfxVolUi = Math.min(1, Math.max(0, v.s));
        audio.setMusicVol(this.musicVolUi * 0.9);
        audio.setSfxVol(this.sfxVolUi * 0.9);
      }
    } catch { /* noop */ }
    (window as unknown as { __g?: Game }).__g = this;
  }

  setState(s: GState) {
    this.state = s;
    // transición fantasma: si se sale de play/dialogue a mitad de un fade
    // (pausa, muerte…), el viaje pendiente se cancela para no teletransportar
    // al reanudar ni reescribir el autoguardado con posición incorrecta.
    if (s !== 'play' && s !== 'dialogue') this.pendingMap = null;
    if (s !== 'play') this.rollQueued = false;
    // 14-b (auditoría): al salir de 'play' (pausa/muerte) con una carga en
    // curso (clic o J sostenidos), se cancela — si no, al reanudar el
    // Portador seguía "cargando" con el ratón/tecla ya soltados.
    if (s !== 'play' && s !== 'dialogue' && this.player?.charging) {
      this.player.charging = false;
      this.player.chargeT = 0;
    }
    this.onStateChange?.(s);
    if (s === 'title') audio.playTrack('title');
  }

  update(dt: number) {
    updateGame(this, dt);
    // Watchers del Acto II que viven en el motor (O(1) por frame; update.ts es
    // de otro agente). q7 paso 0→1: la Sirena entra en combate. Elección
    // documentada: watcher por ACTIVACIÓN DEL JEFE (bossActive al acercarte al
    // naufragio) — más simple y robusto que medir distancia al prop 'wreck';
    // la flag sirenaSeen evita que se repita (y se serializa en el guardado).
    if (this.bossActive && this.bossRef?.etype === 'sirena' &&
        this.questIdx === 6 && this.questStep === 0 && !this.flags.sirenaSeen) {
      this.flags.sirenaSeen = true;
      this.questAdvance();
      this.toast('La Sirena te ha visto...', '#8ef0ff');
    }
    this.catchUpActo2();
    // módulos de juego (no-ops de costo O(1) si no aplican)
    challengeTick(this, dt); // modo desafío (arena)
    skillTick(this, dt);     // pasivas del árbol de habilidades
    balanceTick(this, dt);   // monitor de dificultad dinámica
    worldTick(this, dt);     // fauna, rumores y eventos del mundo (13-b)
    timeTick(this, dt);      // inmersión del viaje temporal (13-c)
    acto5Tick(this, dt);     // R13: compás del Aún — sale temprano fuera de la Cuna
    acto5TickR14(this, dt);  // R14: la muralla que canta — sale temprano fuera de la Ciudadela
    armorTick(this, dt);     // 14-b: pasiva de la Malla del Alba (+vigor/s)
    // ==== 16-c (logros-stats): tiempoJugado + memorias + logros (O(1), early-out) ====
    statsTick(this, dt);
    achievementTick(this);
    this.companionTick(dt);  // 14-b: escolta, teletransporte, apoyo y avisos de Ilwen
    this.antiStuck();        // 14-b: red anti-encallamiento del Portador
  }

  /**
   * 11-a (integración): red de seguridad del Acto II contra JUEGO FUERA DE
   * ORDEN. Los pasos de q7-q9 se completaban solo por EVENTO (watcher de
   * aggro, killEnemy, lightLamp, eco_*_taken): si el jugador completa el
   * objetivo ANTES de aceptar la misión —mata a la Sirena durante q6, mata al
   * Gólem durante q8, enciende los 3 faroles antes de q8 o toma un Eco por
   * adelantado— el evento ya no puede repetirse (jefe muerto no re-spawnea,
   * altar vacío, farol ya encendido) y la cadena quedaba bloqueada para
   * siempre. Igual que el fix de visitas de 8-int, el avance es IDEMPOTENTE
   * POR ESTADO: cada paso se completa si su condición final ya es cierta, en
   * cualquier orden. O(1): early-out salvo cadena del Acto II activa.
   */
  private catchUpActo2() {
    if (this.questIdx < 5 || this.questIdx > 9) return;
    // q7 (idx 6): 0 avistada · 1 derrotada · 2 Eco de las Mareas tomado
    if (this.questIdx === 6) {
      if (this.questStep === 0 && this.flags.sirenaDefeated) this.questAdvance();
      if (this.questIdx === 6 && this.questStep === 1 && this.flags.sirenaDefeated) this.questAdvance();
      if (this.questIdx === 6 && this.questStep === 2 && this.flags.ecoMareas) this.questAdvance();
    }
    // q8 (idx 7): 1 los 3 faroles encendidos (orden-independiente) · 2 Eco de los Nombres
    if (this.questIdx === 7) {
      if (this.questStep === 1 &&
          (['lamp1', 'lamp2', 'lamp3'] as const).filter(l => this.flags[l]).length >= 3) this.questAdvance();
      if (this.questIdx === 7 && this.questStep === 2 && this.flags.ecoNombres) this.questAdvance();
    }
    // q9 (idx 8): 1 gólem derrotado · 2 Eco de las Cumbres tomado
    if (this.questIdx === 8) {
      if (this.questStep === 1 && this.flags.golemDefeated) this.questAdvance();
      if (this.questIdx === 8 && this.questStep === 2 && this.flags.ecoCumbres) this.questAdvance();
    }
  }

  // ---------------- Ciclo de vida ----------------

  start() {
    if (this.running) return;
    this.running = true;
    cancelAnimationFrame(this.raf); // R5-O6: blindaje anti-doble-rAF (remontajes/pausas)
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      // R5-O6: pestaña oculta → pausa lógica. rAF ya no dispara en segundo
      // plano, pero si algún navegador lo hace, no simulamos ni dejamos
      // acumular un dt enorme (al volver, dt nace fresco).
      if (document.hidden) { this.lastTs = ts; this.raf = requestAnimationFrame(loop); return; }
      try {
        // clamp 1/20 s (0.05): tras un enganchón/alt-tab el mundo nunca da un salto gigante
        let dt = Math.min(0.05, (ts - this.lastTs) / 1000);
        this.lastTs = ts;
        // R5-O6: topes duros de FX (cubren también los pushes directos de fx.ts);
        // coste O(1) mientras van por debajo del cap.
        if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
        if (this.floats.length > MAX_FLOATS) this.floats.splice(0, this.floats.length - MAX_FLOATS);
        if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
        if (this.bossBannerT > 0) this.bossBannerT = Math.max(0, this.bossBannerT - dt);
        if (this.memoryReveal) { this.memoryReveal.t -= dt; if (this.memoryReveal.t <= 0) this.memoryReveal = null; }
        if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.12; }
        if (this.slowmoT > 0) { this.slowmoT -= dt; dt *= 0.35; }
        this.globalT += dt;
        if (this.state === 'play' || this.state === 'dialogue') this.update(dt);
        drawGame(this);
        perfFrame(this, dt); drawPerfOverlay(this); // R5-O1: muestreo + overlay 1×/frame, tras update+draw
        this.perfViewTick(); // R6-V10: histéresis del tope de vista en baja sostenida
        this.loopError = null;
      } catch (err) {
        this.loopError = err instanceof Error ? (err.stack ?? String(err)) : String(err);
        console.error('[EcosAelthar loop]', err);
        try {
          this.ctx.fillStyle = '#000';
          this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
          this.ctx.font = '12px monospace';
          this.ctx.fillStyle = '#ff7060';
          this.ctx.textAlign = 'left';
          this.ctx.textBaseline = 'top';
          this.ctx.fillText('Error: ' + String(err).slice(0, 90), 20, 20);
          this.ctx.fillText((err instanceof Error ? (err.stack ?? '') : '').slice(0, 600).replace(/\n/g, ' | '), 20, 44);
        } catch { /* noop */ }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    audio.stopMusic();
  }

  newGame(name: string, disc: 'alba' | 'tejedor') {
    const maxHp = disc === 'alba' ? 110 : 96;
    this.player = {
      kind: 'player', name: name || 'Portador', discipline: disc,
      x: 25 * TILE + 8, y: 20 * TILE, w: 10, h: 8,
      vx: 0, vy: 0, dir: 'down', hp: maxHp, maxHp,
      sprite: disc === 'alba' ? 'hero_alba' : 'hero_tejedor',
      anim: 0, moving: false,
      level: 1, xp: 0, sta: 100, maxSta: 100, res: 0, maxRes: 100,
      attrs: { fue: 2, des: 2, int: 2, esp: 2, vig: 2 },
      points: 0, gold: 20, weaponPlus: 0, potions: 2, cds: [0, 0, 0, 0],
      iframes: 0, parryT: 0, parryFx: 0, attackT: 0, combo: 0,
      chargeT: 0, charging: false, rollT: 0, lastHitT: 0,
      hasEcho: false, kills: 0, deaths: 0, repGuardianes: 0, playTime: 0,
      tones: { empatico: 0, pragmatico: 0, sarcastico: 0, amenazante: 0 },
      memories: [],
      repFacciones: { guardianes: 0, orden: 0, circulo: 0, liga: 0 },
    };
    this.flags = {};
    this.questIdx = 0; this.questStep = 0;
    // terror v2 (Ronda 2): estado interno de intro del jefe y FX de fases, limpio
    resetBossIntro();
    resetBossFx();
    resetKillFx(); // Ronda 3: FX de muerte en curso, fuera
    this.openedChests = new Set();
    this.takenEchoes = new Set();
    this.deadGolds = [];
    this.companion = null;
    this.visitedMaps = { lunaris: true };
    // ==== 16-c (logros-stats): partida nueva, contadores a cero ====
    this.stats = defaultStats();
    this.dayT = 0.15;
    this.setState('intro');
    this.introIdx = 0;
    audio.playTrack('title');
  }

  startPlay() {
    this.loadMap('lunaris', 25, 20);
    this.mapTitleT = 3.2;
    this.setState('play');
    audio.playTrack('village');
  }

  hasSave(): boolean {
    try { return !!localStorage.getItem('ecos-aelthar-save'); } catch { return false; }
  }

  continueGame() {
    const raw = (() => { try { return localStorage.getItem('ecos-aelthar-save'); } catch { return null; } })();
    if (!raw) return;
    let d: SaveData;
    try {
      d = JSON.parse(raw) as SaveData;
      if (!d || !d.player || typeof d.x !== 'number' || typeof d.y !== 'number' || !MAPS[d.map]) throw new Error('forma inválida');
    } catch {
      // save corrupto: nunca dejar el juego muerto — se descarta y se puede empezar de nuevo
      try { localStorage.removeItem('ecos-aelthar-save'); } catch { /* noop */ }
      this.toast('La partida guardada estaba dañada y no pudo recuperarse.', '#ff8060');
      return;
    }
    const p = d.player;
    const maxHp = p.maxHp;
    // R8-1.1: habilidad DERIVADA del estado persistente — se calcula UNA vez y
    // se usa tanto en el Portador restaurado como en la época de entrada.
    const hasEchoDerived = p.hasEcho === true || !!d.flags.fragmentTouched;
    this.player = {
      kind: 'player', name: p.name, discipline: p.discipline,
      x: d.x, y: d.y, w: 10, h: 8, vx: 0, vy: 0, dir: 'down',
      hp: Math.max(1, p.hp), maxHp, sprite: p.discipline === 'alba' ? 'hero_alba' : 'hero_tejedor',
      anim: 0, moving: false,
      level: p.level, xp: p.xp, sta: typeof p.sta === 'number' && p.sta > 0 ? p.sta : p.maxSta, maxSta: p.maxSta, res: p.res, maxRes: 100, // ==== 17-a (qa): la stamina guardada se restaura EXACTA (saves viejos sin sta → llena) ====
      attrs: { ...p.attrs }, points: p.points,
      gold: p.gold, weaponPlus: p.weaponPlus, potions: p.potions, cds: [0, 0, 0, 0],
      iframes: 0, parryT: 0, parryFx: 0, attackT: 0, combo: 0,
      chargeT: 0, charging: false, rollT: 0, lastHitT: 0,
      // R8-1.1: la habilidad se DERIVA del estado persistente. hasEcho vive en
      // el player (volatile); flags.fragmentTouched es la marca que SIEMPRE se
      // escribe al ganarla (mismo evento) y viaja en el save. Saves antiguos
      // sin el campo hasEcho (o restauraciones parciales) recuperan aquí la
      // habilidad desde el flag — nunca se pierde al reentrar.
      hasEcho: hasEchoDerived,
      kills: p.kills, deaths: p.deaths,
      repGuardianes: p.repGuardianes, playTime: p.playTime,
      tones: p.tones ?? { empatico: 0, pragmatico: 0, sarcastico: 0, amenazante: 0 },
      memories: p.memories ?? [],
      repFacciones: p.repFacciones ?? { guardianes: 0, orden: 0, circulo: 0, liga: 0 },
    };
    this.flags = { ...d.flags };
    this.questIdx = d.questIdx; this.questStep = d.questStep;
    this.openedChests = new Set(d.openedChests);
    this.takenEchoes = new Set(d.takenEchoes);
    this.deadGolds = d.deadGolds ?? [];
    // ==== 16-c (logros-stats): restore tolerante (saves antiguos sin stats) ====
    this.stats = sanitizeStats(d.stats);
    // R8-1.1: la época de entrada usa el mismo flag derivado (saves sin
    // hasEcho no descartan el viaje guardado). R13: restaura también 'aun'
    // (loadMap re-normaliza si el mapa guardado no admite la época ternaria).
    this.epoch = d.epoch === 'pasado' && hasEchoDerived ? 'pasado' : d.epoch === 'aun' ? 'aun' : 'presente';
    this.companion = d.companion ? this.makeCompanion() : null;
    // ==== 16-b: restaura la orden táctica del compañero (saves viejos sin el
    // campo → undefined = 'seguir', el comportamiento de siempre) ====
    if (this.companion && (d.companionMode === 'agresivo' || d.companionMode === 'defensivo' || d.companionMode === 'seguir')) {
      this.companion.mode = d.companionMode;
    }
    this.visitedMaps = { lunaris: true };
    if (this.flags.visitedBosque) this.visitedMaps.bosque = true;
    if (this.flags.visitedCripta) this.visitedMaps.cripta = true;
    // ==== 17-a (qa) + R7-Q1 #5: mapas de la expansión (Ronda 14) reconstruidos
    // al cargar (sus marcas visited_* se escribe desde loadMap); el Acto II
    // termina en la Cripta pasando por el Bosque, así que acto2Done los implica ====
    for (const m of ['costa', 'aldea', 'cumbres'] as const) {
      if (this.flags[`visited_${m}`]) this.visitedMaps[m] = true;
    }
    if (this.flags.acto2Done) {
      this.visitedMaps.bosque = true;
      this.visitedMaps.cripta = true;
    }
    this.loadMap(d.map, Math.floor(d.x / TILE), Math.floor(d.y / TILE));
    // restaura la posición fina del guardado SOLO si su tile es seguro
    // (ni sólido ni dentro de una zona de salida); si no, conserva el tile
    // seguro que eligió loadMap — rescate de partidas atrapadas en el bucle
    const stx = Math.floor(d.x / TILE), sty = Math.floor(d.y / TILE);
    if (this.player && !this.tileSolidAt(d.x, d.y) && !this.inExitZone(stx, sty)) {
      this.player.x = d.x; this.player.y = d.y;
    }
    this.mapTitleT = 2.5;
    this.setState('play');
    audio.playTrack(this.map.music);
  }

  save() {
    if (!this.player) return;
    // ==== 17-a (qa) + R7-Q1 #1 (ALTA): la arena NO toca el disco. Guardar
    // desde la pausa DENTRO del desafío serializaría mapId 'arena' + Portador
    // temporal sobre el save de campaña: ni el guardado manual ni ningún
    // autoguardado escriben con un reto en marcha (la reparación resave de
    // restoreCampaign queda como segunda línea de defensa) ====
    if (this.challengeRun) return;
    const p = this.player;
    const d: SaveData = {
      v: 1,
      player: {
        name: p.name, discipline: p.discipline, level: p.level, xp: p.xp,
        hp: p.hp, maxHp: p.maxHp, sta: p.sta, maxSta: p.maxSta, res: p.res,
        attrs: { ...p.attrs }, points: p.points,
        gold: p.gold, weaponPlus: p.weaponPlus, potions: p.potions,
        // R8-1.1: espejo defensivo — aunque hasEcho se perdiera en memoria,
        // el flag persistente lo reflota en el guardado.
        hasEcho: p.hasEcho || !!this.flags.fragmentTouched, kills: p.kills, deaths: p.deaths,
        repGuardianes: p.repGuardianes, playTime: p.playTime,
        tones: p.tones, memories: p.memories, repFacciones: p.repFacciones,
      },
      map: this.mapId, x: Math.round(p.x), y: Math.round(p.y),
      epoch: this.epoch,
      flags: { ...this.flags, visitedBosque: !!this.visitedMaps.bosque, visitedCripta: !!this.visitedMaps.cripta },
      questIdx: this.questIdx, questStep: this.questStep,
      openedChests: [...this.openedChests],
      takenEchoes: [...this.takenEchoes],
      deadGolds: this.deadGolds,
      companion: !!this.companion,
      companionMode: this.companion?.mode ?? 'seguir', // 16-b: orden táctica serializada
      saveTime: Date.now(),
      stats: { ...this.stats }, // 16-c: estadísticas dentro del guardado
    };
    try { localStorage.setItem('ecos-aelthar-save', JSON.stringify(d)); } catch { /* noop */ }
    // ==== 16-c (logros-stats): espejo de las últimas cifras para el título ====
    try { localStorage.setItem('ecos-stats', JSON.stringify(this.stats)); } catch { /* noop */ }
  }

  // ---------------- Mapa ----------------

  loadMap(id: MapId, tx: number, ty: number) {
    // memoria del jefe: si sales de la cripta con el Guardián herido, no se
    // regenera al volver (cierra el exploit de reseteo de combate)
    // memoria del jefe (generalizada Acto II): si sales de un mapa con su JEFE vivo, no se regenera
    if (this.bossRef && !this.bossRef.dead) {
      this.flags[`bossHp_${this.mapId}`] = this.bossRef.hp;
      // R10: recuerda TAMBIÉN A QUIÉN pertenece la memoria (cripta tiene 2 jefes:
      // sepulcro en antesala + guardián en sanctum — restaurar al primero de la
      // lista corrompía al otro)
      this.flags[`bossHpWho_${this.mapId}`] = this.bossRef.etype;
      if (this.mapId === 'cripta') this.flags.bossHp = this.bossRef.hp; // compat con saves antiguos
    }
    this.mapId = id;
    this.map = MAPS[id];
    this.rows = mapRows(this.map);
    // ==== R13 (época ternaria): el estado 'aun' SOLO existe en mapas con
    // baseEpoch 'aun'. Cualquier entrada a un mapa viejo lo normaliza a
    // 'presente' (los mapas del primer acto jamás ven 'aun'). La Cuna SIEMPRE
    // recibe en 'aun' hasta que su primer día se estrene (el jugador baja
    // cargando 'presente' de la superficie: sin esto, el primer día ya
    // estaría estrenado al aterrizar); tras la estrena, conserva la hora con
    // la que llegues ('pasado' anómalo → 'aun'). ====
    const baseEp = this.map.baseEpoch ?? 'presente';
    if (baseEp === 'aun') {
      if (!this.flags.cunaEstrenada) this.epoch = 'aun';
      else if (this.epoch === 'pasado') this.epoch = 'aun';
    } else if (this.epoch === 'aun') this.epoch = 'presente';
    this.buildGround();
    // R8-1.3: spawn de cofres saneado — tile destino y vecindad inmediata
    // libres de tiles altos/sólidos en la(s) época(s) donde el cofre existe.
    this.validateChests();
    if (this.player) {
      // defensa anti-softlock: nunca aterrizar sobre un tile sólido ni dentro
      // de una zona de salida del destino (provocaba el bucle cripta↔bosque)
      const [sx, sy] = this.findSafeTile(tx, ty);
      this.player.x = sx * TILE + 8;
      this.player.y = sy * TILE + 8;
      // 14-b (auditoría de movimiento): el estado transitorio de combate NO
      // viaja de mapa — los iframes de un golpe recibido antes del viaje
      // daban invulnerabilidad gratis al aterrizar, y una voltereta/carga en
      // curso al iniciar el fundido seguía viva al llegar (roll a ciegas en
      // el mapa nuevo, posible encallamiento contra muros desconocidos).
      this.player.iframes = 0;
      this.player.rollT = 0;
      this.player.charging = false;
      this.player.chargeT = 0;
      this.player.parryT = 0;
      this.player.lastHitT = 0;
      this.rollQueued = false;
    }
    this.exitCd = 0.9;
    this.spawnEnemies();
    // restaura la vida memorizada del Guardián si la partida sigue en curso
    const savedBossHp = typeof this.flags[`bossHp_${id}`] === 'number' ? (this.flags[`bossHp_${id}`] as number)
      : id === 'cripta' && typeof this.flags.bossHp === 'number' ? (this.flags.bossHp as number) : null;
    if (savedBossHp !== null) {
      // R10: restaurar al DUEÑO de la memoria (bossHpWho_*); fallback legacy =
      // primer enemigo con flag (saves antiguos, un jefe por mapa)
      const who = this.flags[`bossHpWho_${id}`];
      const boss = typeof who === 'string'
        ? this.enemies.find(e => e.etype === who)
        : this.enemies.find(e => BOSS_DEFEAT_FLAG[e.etype] !== undefined);
      if (boss) boss.hp = Math.max(1, Math.min(boss.maxHp, savedBossHp));
    }
    this.spawnNpcs();
    this.projectiles = []; this.waves = []; this.telegraphs = [];
    this.spellCastFx = []; this.spellImpactFx = []; // R9-4: pools de hechizo
    this.bossRef = null; this.bossActive = false;
    audio.setCombat(false);
    // ==== 17-d (qa-mundo): la arena (modo desafío, 12-a) NO participa de la
    // campaña. Antes loadMap la marcaba en visitedMaps y el menú del Santuario
    // pasaba a ofrecer «Viajar: Arena del Eco» — un viaje a un mapa sin
    // campaña, sin santuario y sin botín. Los mapas de campaña siguen
    // registrándose igual (loadMap también la llama el desafío).
    if (id !== ARENA_MAP_ID) this.visitedMaps[id] = true;
    if (id === 'bosque' && !this.flags.visitedBosque) {
      this.flags.visitedBosque = true;
      if (this.questIdx === 2 && this.questStep === 0) this.questAdvance();
    }
    if (id === 'cripta' && !this.flags.visitedCripta) {
      this.flags.visitedCripta = true;
      if (this.questIdx === 3 && this.questStep === 0) this.questAdvance();
    }
    // Acto II: pisar cada mapa nuevo completa su objetivo de viaje. Sin guard
    // de "primera visita": si el jugador llega ANTES de aceptar la misión, el
    // avance debe funcionar igual al volver (condición idempotente por estado).
    if (id === 'costa' && this.questIdx === 5 && this.questStep === 0) this.questAdvance();
    if (id === 'aldea' && this.questIdx === 7 && this.questStep === 0) this.questAdvance();
    if (id === 'cumbres' && this.questIdx === 8 && this.questStep === 0) this.questAdvance();
    // R13: pisar la Cuna completa el descenso de q17 (idempotente por estado,
    // patrón Acto II: si el jugador baja antes de aceptar, avanza al volver a
    // repetir la bajada).
    if (id === 'cuna' && this.questIdx === 16 && this.questStep === 1) this.questAdvance();
    // R14: pisar la Ciudadela completa la entrada de q18 (idempotente por
    // estado, patrón Acto II / R13: si el Portador entra antes de aceptar,
    // el watcher de acto5b repara el orden al volver a aceptar).
    if (id === 'ciudadela' && this.questIdx === 17 && this.questStep === 1) this.questAdvance();
    if (!this.flags[`visited_${id}`]) this.flags[`visited_${id}`] = true;
    // R8-1.1: rearma de la habilidad derivado del flag persistente. Cualquier
    // ruta de (re)entrada al mapa (continueGame, respawn, viaje, fade) pasa por
    // aquí: si el Portador llega sin hasEcho pero el Fragmento ya fue tocado
    // (flag persistido en el save), la habilidad se recupera — nunca depende
    // de variables volátiles de mapa.
    if (this.player && this.flags.fragmentTouched && !this.player.hasEcho) {
      this.player.hasEcho = true;
      this.toast('El Fragmento de Eco vuelve a resonar contigo (Q)', '#c8b0e8');
    }
    this.mapTitleT = 2.6;
    this.updateCamera(true);
  }

  /**
   * R8-1.3 · Spawn de cofres validado. Causa raíz del bug: los cofres viven
   * en maps.ts con coordenadas fijas, y la dispersión determinista de pinos
   * ('p'/'t') puede caer SOBRE el cofre o en su vecindad — el cofre nacía
   * dentro/detrás de la copa (verificado: bosque b2 @(52,38) nacía EN un pino;
   * lunaris l4, bosque b1/b3/b4/b5 con troncos pegados). El dibujo y la
   * interacción leen g.map.chests, así que la corrección del motor es mover el
   * cofre UNA vez (por objeto, WeakSet) al hueco libre más cercano: tile no
   * sólido y sin tiles altos en el propio tile ni en los 8 vecinos, en la(s)
   * época(s) donde el cofre existe. Determinista (búsqueda por anillos).
   */
  private validateChests(): void {
    for (const ch of this.map.chests) {
      if (validatedChests.has(ch)) continue;
      validatedChests.add(ch);
      const eps: Epoch[] = ch.needPast
        ? ['pasado']
        // R13: cofres needPresent se validan SOLO en 'presente' (el cofre del
        // primer día no existe en 'aun'); los demás usan el PAR de épocas del
        // mapa (ternario en la Cuna, binario en los viejos).
        : ch.needPresent
        ? ['presente']
        : this.map.epochDiffs.length ? mapEpochs(this.map) : [this.map.baseEpoch ?? 'presente'];
      const badSpot = (x: number, y: number): boolean => {
        for (const ep of eps) {
          if (SOLID_CHARS.has(tileAt(this.map, this.rows, x, y, ep))) return true;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (TALL_CHARS.has(tileAt(this.map, this.rows, x + dx, y + dy, ep))) return true;
            }
          }
        }
        return false;
      };
      if (!badSpot(ch.x, ch.y)) continue; // sitio correcto: no se toca
      for (let r = 1; r <= 3; r++) {
        let moved = false;
        for (let dy = -r; dy <= r && !moved; dy++) {
          for (let dx = -r; dx <= r && !moved; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const nx = ch.x + dx, ny = ch.y + dy;
            // no sacarlo al anillo de bosque del borde ni fuera de mapa
            if (nx < 1 || ny < 1 || nx >= this.map.w - 1 || ny >= this.map.h - 1) continue;
            if (badSpot(nx, ny)) continue;
            ch.x = nx; ch.y = ny;
            moved = true;
          }
        }
        if (moved) break;
      }
    }
  }

  buildGround() {
    // R5-O6: prerrender cacheado por (mapId, epoch, nº de filas). Los mapas son
    // estáticos (rows solo se asigna en loadMap; mapRows/tileAt deterministas),
    // así que recargar el MISMO mapa+época (respawn, santuario) reutiliza los
    // canvas pintados en vez de reconstruirlos tile a tile.
    const cacheKey = `${this.mapId}|${this.epoch}|${this.rows.length}`;
    if (this.groundCacheKey === cacheKey && this.groundCanvas) return;
    this.groundCacheKey = cacheKey;
    const { w, h } = this.map;
    const mk = (ep: Epoch) => {
      const c = document.createElement('canvas');
      c.width = w * TILE; c.height = h * TILE;
      const x = c.getContext('2d')!;
      x.imageSmoothingEnabled = false;
      // suelo
      for (let ty = 0; ty < h; ty++) {
        for (let tx = 0; tx < w; tx++) {
          const ch = tileAt(this.map, this.rows, tx, ty, ep);
          // Acto II: arena/nieve/hielo y suelos por bioma los dibuja la expansión; fallback genérico
          // (el fallback usa el drawTile v2 con hook de vecinos para autotiling — merge mejora-visual)
          if (!drawExpansionTile(x, ch, tx, ty, this.mapId))
            drawTile(x, ch, tx, ty, this.mapId, 0, (dx: number, dy: number) =>
              tileAt(this.map, this.rows, tx + dx, ty + dy, ep));
        }
      }
      // objetos altos por orden de fila
      for (let ty = 0; ty < h; ty++) {
        for (let tx = 0; tx < w; tx++) {
          const ch = tileAt(this.map, this.rows, tx, ty, ep);
          if (SOLID_CHARS.has(ch) && (ch === 't' || ch === 'p')) {
            if (!drawExpansionTallTile(x, ch, tx, ty, this.mapId))
              drawTallTile(x, ch, tx, ty, this.mapId, (dx: number, dy: number) =>
                tileAt(this.map, this.rows, tx + dx, ty + dy, ep));
          }
        }
      }
      return c;
    };
    // R13: par de épocas por mapa — en los viejos es el par histórico
    // ('presente','pasado'); en la Cuna ('aun','presente'). groundPastCanvas
    // sigue siendo «el canvas de la época alternativa» (contrato de render).
    const [epA, epB] = mapEpochs(this.map);
    this.groundCanvas = mk(epA);
    this.groundPastCanvas = this.map.epochDiffs.length ? mk(epB) : this.groundCanvas;
    // minimapa v2 (2 px/tile, relieve + costas + marco en drawMinimapOverlay):
    // época base siempre; alternativa solo si el mapa tiene diffs de época.
    this.miniCanvas = buildMinimapV2(this.rows, this.map, epA,
      (tx, ty) => tileAt(this.map, this.rows, tx, ty, epA));
    this.miniCanvasPast = this.map.epochDiffs.length
      ? buildMinimapV2(this.rows, this.map, epB,
          (tx, ty) => tileAt(this.map, this.rows, tx, ty, epB))
      : null;
  }

  spawnEnemies() {
    this.enemies = [];
    for (const s of this.map.spawns) {
      if (s.needPast && this.epoch !== 'pasado') continue;
      if (s.needPresent && this.epoch !== 'presente') continue;
      const defFlag = BOSS_DEFEAT_FLAG[s.type];
      if (defFlag && this.flags[defFlag]) continue; // jefes derrotados no renacen
      // R8-1.4 (spawn saneado en el motor): un spawn sobre tile sólido/alto
      // nacía ENCALLADO dentro del árbol (verificado: bosque lobo @(44,34) y
      // esqueleto @(30,16) caen sobre 'p') — se desplaza al hueco libre más
      // cercano; sin hueco, no nace (nunca apelotonado ni dentro de muro).
      let sx = s.x, sy = s.y;
      if (this.tileSolidAt(sx * TILE + 8, sy * TILE + 8)) {
        const fix = this.findFreeSpotNear(sx, sy);
        if (!fix) continue;
        sx = fix[0]; sy = fix[1];
      }
      this.enemies.push(this.makeEnemy(s.type, sx * TILE + 8, sy * TILE + 8, s.patrol ?? 2, s.zone));
    }
  }

  /** R8-1.4: tile transitable más cercano (anillos r≤2) para rescatar spawns. */
  private findFreeSpotNear(tx: number, ty: number): [number, number] | null {
    for (let r = 1; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h) continue;
          if (this.tileSolidAt(nx * TILE + 8, ny * TILE + 8)) continue;
          return [nx, ny];
        }
      }
    }
    return null;
  }

  /**
   * R8-1.4 · Spawn de EVENTO de historia acotado (lo dispara el despertar del
   * primer Eco). Contrato anti-bug del enjambre circular reportado:
   *   1) SOLO UNA VEZ por partida — guard persistido en flags[flag] (viaja en
   *      el save), fijado al entrar (idempotente ante re-entradas).
   *   2) TOPE DURO — min(count, EVENT_RING_MAX, hueco hasta MAX_MAP_ENEMIES).
   *   3) ESPACIADO — anillo suelto a radio fijo (ángulo áureo determinista),
   *      nunca a <2 tiles del Portador ni a <EVENT_RING_MIN_GAP de otro
   *      enemigo; candidatos sin sitio válido se OMITEN (no se apilan).
   * Las unidades nacen sin aggro y con spawnGuard: la Niebla se reúne,
   * no embosca (el evento es narrativo, no una trampa).
   */
  private spawnEventRing(type: Enemy['etype'], count: number, flag: string): void {
    if (this.flags[flag]) return; // guard de evento ya disparado (persistente)
    this.flags[flag] = true;
    const p = this.player;
    if (!p) return;
    const alive = this.enemies.reduce((n, e) => (e.dead ? n : n + 1), 0);
    const n = Math.min(count, EVENT_RING_MAX, Math.max(0, MAX_MAP_ENEMIES - alive));
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const a = i * 2.399963;                    // ángulo áureo: reparto sin simetría rígida
      const x = p.x + Math.cos(a) * 3.5 * TILE;
      const y = p.y + Math.sin(a) * 3.5 * TILE;
      if (this.tileSolidAt(x, y) || !this.boxFree(x, y, 12, 10)) continue;
      if (Math.hypot(x - p.x, y - p.y) < 2 * TILE) continue; // nunca encima del Portador
      let spaced = true;
      for (const e of this.enemies) {
        if (!e.dead && Math.hypot(e.x - x, e.y - y) < EVENT_RING_MIN_GAP) { spaced = false; break; }
      }
      if (!spaced) continue;
      const s = this.makeEnemy(type, x, y, 1, 'evento');
      s.aggro = false;
      s.spawnGuard = 1.5;                        // cortesía: no aggro inmediato
      this.enemies.push(s);
      placed++;
    }
    if (placed > 0) {
      this.burst(p.x, p.y - 6, '#c8b0e8', 14, 60);
      this.toast('La Niebla responde al despertar del Eco...', '#c8b0e8');
    }
  }

  makeEnemy(type: Enemy['etype'], x: number, y: number, patrol: number, zone?: string): Enemy {
    const d = ENEMY_DEFS[type];
    // balanceador de dificultad (12-c): multiplica hp del spawn (neutro en desafío)
    const bm = enemyStatMult(this);
    const hp = Math.max(1, Math.round(d.hp * bm.hp));
    return {
      kind: 'enemy', etype: type, x, y,
      w: type === 'guardian' || type === 'sirena' || type === 'golem' || type === 'vult' || type === 'coro' ? 22 : 12,
      h: type === 'guardian' || type === 'sirena' || type === 'golem' || type === 'vult' || type === 'coro' ? 16 : 10,
      vx: 0, vy: 0, dir: 'down', hp, maxHp: hp, sprite: d.sprite, anim: Math.random() * 9, moving: false,
      ai: 'patrulla', aiT: Math.random() * 2, homeX: x, homeY: y, patrolAngle: Math.random() * Math.PI * 2,
      aggro: false, windup: 0, atkCd: Math.random(), sta: d.breakBar ?? 0, maxSta: d.breakBar ?? 0,
      statuses: [], slowT: 0, phase: 1, sumT: 0, hitFlash: 0, spawnGuard: zone === 'boss' ? 0.5 : 0,
    };
  }

  spawnNpcs() {
    this.npcs = [];
    for (const n of this.map.npcs) {
      if (n.hideFlag && this.flags[n.hideFlag]) continue;
      if (n.showFlag && !this.flags[n.showFlag]) continue;
      this.npcs.push({
        kind: 'npc', nid: n.id, dispName: n.name,
        x: n.x * TILE + 8, y: n.y * TILE + 8, w: 10, h: 8,
        vx: 0, vy: 0, dir: 'down', hp: 1, maxHp: 1, sprite: n.sprite,
        anim: Math.random() * 9, moving: false,
      });
    }
  }

  makeCompanion(): Companion {
    return {
      kind: 'companion', cname: 'Ilwen',
      x: (this.player?.x ?? 0) - 14, y: (this.player?.y ?? 0), w: 10, h: 8,
      vx: 0, vy: 0, dir: 'down', hp: 60, maxHp: 60, sprite: 'ilwen',
      anim: 0, moving: false, atkCd: 0, downT: 0, affinity: 10,
    };
  }

  // ---------------- Compañera (14-b: escolta robusta) ----------------
  // El seguimiento, el ciclo de flechas elementales, la marca y la Lluvia de
  // estrellas siguen en update.ts (congelado). Este tick AÑADE lo que faltaba:
  // (a) nunca se pierde (teletransporte >12 tiles / atasco / caja en muro),
  // (b) apoyo de combate propio contra el enemigo aggro más cercano al
  //     Portador (prioriza marcados) con cadencia propia de 2.4 s,
  // (c) regeneración extra fuera de combate (+8 hp/s — no muere por su cuenta;
  //     el regen base de 2 hp/s ya existía en update.ts),
  // (d) avisos tácticos ocasionales cuando te rodean 2+ enemigos (cd 25 s).
  private companionTick(dt: number) {
    const c = this.companion, p = this.player;
    if (!c || !p || c.downT > 0) return; // derribada: la gestiona update.ts
    const mem = compMem.get(c) ?? { lastX: c.x, lastY: c.y, stuckT: 0, coverCd: 0.5, lineCd: 14, lineIdx: 0 };
    compMem.set(c, mem);
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    // (a) escolta: a >12 tiles (384 px) reaparece a tu lado; si su caja quedó
    // dentro de un sólido (sin pathfinding detrás de un muro), también.
    if (d > 12 * TILE || !this.boxFree(c.x, c.y, c.w, c.h)) {
      this.companionTeleport(c, p);
      mem.lastX = c.x; mem.lastY = c.y;
      return;
    }
    // anti-atasco: quería seguirte (d>40) y lleva 1.2 s sin avanzar → teleporte suave
    const moved = Math.hypot(c.x - mem.lastX, c.y - mem.lastY);
    mem.lastX = c.x; mem.lastY = c.y;
    if (d > 40 && moved < 0.6) mem.stuckT += dt; else mem.stuckT = 0;
    if (mem.stuckT >= 1.2) {
      this.companionTeleport(c, p);
      mem.stuckT = 0;
      return;
    }
    // (b) apoyo de combate con cadencia propia: flecha de cobertura SIN
    // elementos (los estados los pone el ciclo de update.ts, aquí no se
    // duplican) dirigida al aggro más cercano AL PORTADOR.
    mem.coverCd -= dt;
    if (mem.coverCd <= 0 && this.state === 'play') {
      let best: Enemy | null = null, bd = 190;
      for (const e of this.enemies) {
        if (e.dead || !e.aggro) continue;
        // ==== 16-b: en modo DEFENSIVO Ilwen solo apoya a enemigos a <2 tiles del Portador ====
        if ((c.mode ?? 'seguir') === 'defensivo' && Math.hypot(e.x - p.x, e.y - p.y) >= 2 * TILE) continue;
        const score = Math.hypot(e.x - p.x, e.y - p.y) - ((e.marked ?? 0) > 0 ? 60 : 0);
        if (score < bd) { bd = score; best = e; }
      }
      if (best) {
        mem.coverCd = 2.4;
        const dx = best.x - c.x, dy = best.y - 4 - (c.y - 6);
        const l = Math.max(1, Math.hypot(dx, dy));
        this.projectiles.push({
          x: c.x, y: c.y - 6, vx: (dx / l) * 190, vy: (dy / l) * 190, t: 1.2,
          dmg: 6 + p.level * 1.2, element: 'ninguno', from: 'companion',
          sprite: 'p_arrow', radius: 3, pierce: 0,
        });
        audio.sfx('companionShot');
      }
    }
    // (c) fuera de combate regenera más rápido (el vínculo la mantiene entera)
    const inCombat = this.enemies.some(e => !e.dead && e.aggro);
    if (!inCombat && c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + 8 * dt);
    // (d) aviso táctico: 2+ enemigos aggro a <110 px del Portador, cd largo
    mem.lineCd -= dt;
    if (mem.lineCd <= 0 && inCombat && this.state === 'play') {
      let near = 0;
      for (const e of this.enemies) {
        if (!e.dead && e.aggro && Math.hypot(e.x - p.x, e.y - p.y) < 110) near++;
      }
      if (near >= 2) {
        mem.lineCd = 25;
        this.floatAt(c.x, c.y - 24, COMPANION_LINES[mem.lineIdx % COMPANION_LINES.length], '#a8e8c8', 6);
        mem.lineIdx++;
      } else {
        mem.lineCd = 4; // sin rodeo todavía: recheck pronto, sin spamear
      }
    }
  }

  /** Teletransporte de escolta: hueco libre alrededor del Portador (anillos). */
  private companionTeleport(c: Companion, p: Player) {
    let placed = false;
    for (let r = 1; r <= 3 && !placed; r++) {
      for (let i = 0; i < 8 * r && !placed; i++) {
        const a = (i / (8 * r)) * Math.PI * 2;
        const nx = p.x + Math.cos(a) * 18 * r;
        const ny = p.y + Math.sin(a) * 18 * r;
        if (this.boxFree(nx, ny, c.w, c.h)) { c.x = nx; c.y = ny; placed = true; }
      }
    }
    if (!placed) { c.x = p.x - 14; c.y = p.y; } // sin hueco: cae a su sombra
    c.kbVx = 0; c.kbVy = 0;
    this.burst(c.x, c.y - 4, '#8ef0b0', 8, 40);
  }

  /**
   * 14-b (auditoría de movimiento): red anti-encallamiento. moveEntity solo
   * acepta un eje si la caja COMPLETA queda libre: si el Portador acaba con
   * su caja dentro de un tile sólido (residuo de knockback antiguo, un save
   * previo a un fix, un edge de época o de un mapa), TODOS los ejes fallan y
   * ningún input lo saca — encallamiento permanente. Este guard (O(1) si
   * estás libre) lo recoloca al tile libre más cercano, misma red que
   * findSafeTile (sin caer en zonas de salida para no viajar por accidente).
   */
  private antiStuck() {
    const p = this.player;
    // antes del primer loadMap (estado intro/título) no hay filas: no-op
    if (!p || !this.rows.length || this.boxFree(p.x, p.y, p.w, p.h)) return;
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h) continue;
          const wx = nx * TILE + 8, wy = ny * TILE + 8;
          if (this.boxFree(wx, wy, p.w, p.h) && !this.inExitZone(nx, ny)) {
            p.x = wx; p.y = wy;
            this.floatAt(p.x, p.y - 20, 'El canto te aparta del muro', '#c8b0e8', 6);
            return;
          }
        }
      }
    }
  }

  tileSolidAt(px: number, py: number): boolean {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    const ch = tileAt(this.map, this.rows, tx, ty, this.epoch);
    // R10-3: la puerta del puzzle ('D') es sólida DINÁMICA — abierta cuando
    // todas las palancas del mapa están activadas (flags 'cripta_lever_*')
    if (ch === 'D') return !cryptDoorOpen(this);
    return SOLID_CHARS.has(ch);
  }

  /** ¿(tx,ty) está dentro de alguna zona de salida del mapa actual? */
  private inExitZone(tx: number, ty: number): boolean {
    return this.map.exits.some(ex => {
      if (ex.needPast && this.epoch !== 'pasado') return false;
      if (ex.needFlag && !this.flags[ex.needFlag]) return false; // R13: la escalera a la Cuna (gated)
      return tx >= ex.x && tx < ex.x + ex.w && ty >= ex.y && ty < ex.y + ex.h;
    });
  }

  /**
   * Busca el tile más cercano (búsqueda por anillos) que sea transitable y
   * NO esté dentro de una zona de salida. Garantiza que ningún viaje aterrice
   * en un muro ni en un teletransporte (bucle cripta↔bosque, P0-1).
   */
  private findSafeTile(tx: number, ty: number): [number, number] {
    const ok = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < this.map.w && y < this.map.h &&
      !this.tileSolidAt(x * TILE + 8, y * TILE + 8) &&
      !this.inExitZone(x, y);
    if (ok(tx, ty)) return [tx, ty];
    for (let r = 1; r <= 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (ok(tx + dx, ty + dy)) return [tx + dx, ty + dy];
        }
      }
    }
    return [tx, ty]; // sin sitio libre: comportamiento anterior
  }

  boxFree(x: number, y: number, w: number, h: number): boolean {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2 - 2, y1 = y + h / 2;
    if (this.tileSolidAt(x0, y0) || this.tileSolidAt(x1, y0) || this.tileSolidAt(x0, y1) || this.tileSolidAt(x1, y1)) return false;
    // ==== 17-d (qa-mundo): cajas más anchas/altas que un tile (jefes 22×16:
    // guardian/sirena/gólem/vult/coro/heraldo) solo muestreaban las 4
    // esquinas: un tile sólido podía quedar ENTERO entre dos esquinas
    // (squeeze diagonal, empujones, knockback) y la caja acababa solapando el
    // muro con boxFree siempre false — moveEntity se quedaba sin ejes válidos
    // para siempre y el jefe, enterrado (antiStuck solo cubre al Portador).
    // Con span > TILE se añaden los puntos medios de los bordes (máx 8
    // muestras, sin allocations; el Portador/compañera/enemigos base siguen
    // en exactamente las 4 esquinas de siempre).
    if (x1 - x0 > TILE) {
      const xm = (x0 + x1) / 2;
      if (this.tileSolidAt(xm, y0) || this.tileSolidAt(xm, y1)) return false;
    }
    if (y1 - y0 > TILE) {
      const ym = (y0 + y1) / 2;
      if (this.tileSolidAt(x0, ym) || this.tileSolidAt(x1, ym)) return false;
    }
    return true;
  }

  moveEntity(e: { x: number; y: number; w: number; h: number }, dx: number, dy: number) {
    // 14-b (armaduras): Placas del Canto — el peso de la armadura frena al
    // Portador (−8%). moveEntity es la ÚNICA puerta por la que pasa TODO
    // movimiento (caminar, rodar, empujones, Paso de Brisa): una sola fuente
    // de verdad, sin tocar update.ts. Los enemigos y la compañera no pesan.
    if (e === this.player && this.flags.armor_3) { dx *= ARMOR_HEAVY_SPEED; dy *= ARMOR_HEAVY_SPEED; }
    const wasX = e.x, wasY = e.y;
    // R8-1.7: registrar ejes RECHAZADOS para el feedback de barrera de época
    // (solo Portador, evaluación O(1); el coste extra son 2 comparaciones).
    let blockedX = false, blockedY = false;
    if (dx !== 0) { if (this.boxFree(e.x + dx, e.y, e.w, e.h)) e.x += dx; else blockedX = true; }
    if (dy !== 0) { if (this.boxFree(e.x, e.y + dy, e.w, e.h)) e.y += dy; else blockedY = true; }
    // R8-1.7: muro de hierba tras el puente = barrera de época ('n' Niebla
    // Muda, 'x' pilares del puente roto…): al chocar, mensaje claro y
    // throttled (el ARTE de la barrera vive en sprites.ts/world — ajeno;
    // aquí se arregla la lógica de bloqueo + feedback).
    if ((blockedX || blockedY) && e === this.player && this.state === 'play') {
      this.epochBarrierFeedback(e.x + (blockedX ? Math.sign(dx) : 0), e.y + (blockedY ? Math.sign(dy) : 0));
    }
    // ==== 16-c (logros-stats): distancia andada del Portador. moveEntity es la
    // ÚNICA puerta del movimiento (caminar, rodar, hielo, empujones): se cuenta
    // solo el desplazamiento REALMENTE aplicado (aprox. por tiles al mostrar).
    if (e === this.player && !this.challengeRun) {
      this.stats.distanciaAndada += Math.hypot(e.x - wasX, e.y - wasY);
    }
  }

  updateCamera(snap = false) {
    if (!this.player) return;
    const targetX = this.player.x * ZOOM - VIEW_W / 2;
    const targetY = this.player.y * ZOOM - VIEW_H / 2;
    const maxX = this.map.w * TILE * ZOOM - VIEW_W;
    const maxY = this.map.h * TILE * ZOOM - VIEW_H;
    // R7-Q1 #7: mapa más estrecho/alto que la vista (aspecto extremo, maxX<0)
    // → centrar el mundo en pantalla en vez de dejar banda negra a la derecha.
    const cx = maxX < 0 ? maxX / 2 : Math.max(0, Math.min(maxX, targetX));
    const cy = maxY < 0 ? maxY / 2 : Math.max(0, Math.min(maxY, targetY));
    if (snap) { this.camX = cx; this.camY = cy; }
    else { this.camX += (cx - this.camX) * 0.14; this.camY += (cy - this.camY) * 0.14; }
  }

  epochSwitch() {
    if (!this.player || !this.player.hasEcho) {
      this.toast('Aún no puedes oír el pasado...', '#c8b0e8');
      return;
    }
    if (this.map.epochDiffs.length === 0) {
      this.toast('La Cripta existe fuera del tiempo.', '#9aa0b8');
      return;
    }
    // ==== R13 · ÉPOCA TERNARIA: en la Cuna, Q alterna 'aun' ↔ 'presente'. ====
    // El gate es el SEGUNDO Fragmento (flags.cunaFragmento): la Cuna no alterna
    // con su pasado (no tiene: no hay ayeres donde nadie vivió), sino con el
    // tiempo que aún no se ha estrenado. Aterrizar en 'presente' por primera
    // vez ESTRENA la zona (acto5.estrenarCuna, guard cunaEstrenada).
    if (this.map.baseEpoch === 'aun') {
      if (!this.flags.cunaFragmento) {
        this.toast('El tiempo de este lugar aún no se estrena...', '#c8b0e8');
        audio.sfx('error');
        return;
      }
      if (!beginEpochShift(this)) return; // mismos vetos de momento hostil (13-c)
      const toPresente = this.epoch === 'aun';
      this.epoch = toPresente ? 'presente' : 'aun';
      this.epochFx = 0.8;
      if (!this.challengeRun) this.stats.vecesCambioEpoca++;
      audio.sfx('epoch');
      // el cambio de época puede traer el lago hasta ti: recoloca si quedas dentro
      if (this.player && this.tileSolidAt(this.player.x, this.player.y)) {
        const [sx, sy] = this.findSafeTile(Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE));
        this.player.x = sx * TILE + 8;
        this.player.y = sy * TILE + 8;
        this.toast('El mundo cambia a tu alrededor... y te aparta del muro.', '#c8b0e8');
      }
      if (toPresente && !this.flags.cunaEstrenada) {
        estrenarCuna(this); // UNA vez: emite sus propios avisos y textos
        return;
      }
      this.toast(this.epoch === 'aun' ? 'El Aún te rodea: el tiempo sin estrenar' : 'El primer día de la Cuna canta a tu alrededor', '#c8d0e8');
      return;
    }
    // inmersión temporal (13-c): transición y posible veto (momento hostil)
    if (!beginEpochShift(this)) return;
    this.epoch = this.epoch === 'presente' ? 'pasado' : 'presente';
    this.epochFx = 0.8;
    // ==== 16-c (logros-stats): solo cuenta el viaje REAL (tras el veto de 13-c) ====
    if (!this.challengeRun) this.stats.vecesCambioEpoca++;
    audio.sfx('epoch');
    // el cambio de época puede traer un muro hasta ti: recoloca si quedas dentro
    if (this.player && this.tileSolidAt(this.player.x, this.player.y)) {
      const [sx, sy] = this.findSafeTile(Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE));
      this.player.x = sx * TILE + 8;
      this.player.y = sy * TILE + 8;
      this.toast('El mundo cambia a tu alrededor... y te aparta del muro.', '#c8b0e8');
    }
    this.toast(this.epoch === 'pasado' ? 'El pasado canta a tu alrededor' : 'Vuelves al presente en ruinas', '#ffe9a0');
  }

  // ---------------- Interacción ----------------

  nearestInteract(): { kind: string; label: string; act: () => void; dist: number } | null {
    const p = this.player;
    if (!p) return null;
    let best: { kind: string; label: string; act: () => void; dist: number } | null = null;
    const consider = (x: number, y: number, kind: string, label: string, act: () => void, r = 30) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < r && (!best || d < best.dist)) best = { kind, label, act, dist: d };
    };
    for (const n of this.npcs) consider(n.x, n.y, 'npc', `Hablar con ${n.dispName}`, () => this.talkTo(n.nid), 34);
    for (const ch of this.map.chests) {
      if (this.openedChests.has(ch.id)) continue;
      if (ch.needPast && this.epoch !== 'pasado') continue;
      if (ch.needPresent && this.epoch !== 'presente') continue; // R13: el cofre del primer día
      consider(ch.x * TILE + 8, ch.y * TILE + 8, 'chest', 'Abrir cofre', () => this.openChest(ch.id), 26);
    }
    for (const pr of this.map.props) {
      if (pr.needPast && this.epoch !== 'pasado') continue;
      if (pr.needPresent && this.epoch !== 'presente') continue;
      const px = pr.x * TILE + 8, py = pr.y * TILE + 8;
      if (pr.kind === 'sanctuary') consider(px, py, 'sanc', 'Santuario del Eco', () => this.openSanctuary(), 26);
      else if (pr.kind === 'forge') consider(px, py, 'forge', 'Forja de Toln', () => this.talkTo('toln'), 28);
      else if (pr.kind === 'fragment') consider(px, py, 'frag', 'Fragmento de Eco', () => this.openDialogue('voz_fragment'), 30);
      // R13: el SEGUNDO Fragmento (la Cuna) — su propio diálogo y su flag
      else if (pr.kind === 'fragment2') consider(px, py, 'frag', 'Fragmento de la Cuna', () => this.openDialogue('voz_fragmento2'), 30);
      // R14 «La Ciudadela»: las verdades que se devuelven (label = nodo de diálogo)
      else if (pr.kind === 'verdad') consider(px, py, 'verdad', 'Devolver la verdad', () => this.openDialogue(pr.label ?? 'verdad_bib'), 30);
      // R14: las cadenas del silencio (la guardia de cada distrito; la opción mala vive aquí)
      else if (pr.kind === 'gate') consider(px, py, 'gate', 'La cadena del silencio', () => this.openDialogue(pr.label ?? 'cadena_bib'), 26);
      else if (pr.kind === 'altarEcho') consider(px, py, 'altar', 'Altar del Eco', () => this.tryTakeEco(), 30);
      else if (pr.kind === 'sign') consider(px, py, 'sign', 'Leer cartel', () => this.readSign(pr.label ?? ''), 28);
      else if (pr.kind === 'lamp' && !this.flags[pr.id]) consider(px, py, 'lamp', 'Encender el Farol del Recuerdo', () => this.lightLamp(pr.id), 28);
    }
    for (const ec of this.map.echoes) {
      if (this.takenEchoes.has(ec.id)) continue;
      consider(ec.x * TILE + 8, ec.y * TILE + 8, 'echo', 'Escuchar eco menor', () => this.takeEchoMinor(ec.id, ec.title, ec.text), 26);
    }
    return best;
  }

  openChest(id: string) {
    const ch = this.map.chests.find(c => c.id === id);
    if (!ch || this.openedChests.has(id)) return;
    this.openedChests.add(id);
    audio.sfx('chest');
    const parts: string[] = [];
    if (ch.gold) {
      this.player!.gold += ch.gold; parts.push(`${ch.gold} coronas`); this.floatAt(ch.x * TILE + 8, ch.y * TILE, `+${ch.gold}`, '#f0c84a');
      if (!this.challengeRun) this.stats.coronasGanadas += ch.gold; // ==== 16-c ====
    }
    if (ch.potions) { this.player!.potions += ch.potions; parts.push(`${ch.potions} poción(es)`); }
    if (ch.item) parts.push(ch.item);
    this.toast(`Cofre abierto: ${parts.join(', ')}`, '#f0c84a');
    this.burst(ch.x * TILE + 8, ch.y * TILE, '#ffe9a0', 10);
  }

  takeEchoMinor(id: string, title: string, text: string) {
    this.takenEchoes.add(id);
    audio.sfx('echo');
    this.dynNodes['lore'] = { name: title, portrait: 'wisp', text };
    this.openDialogue('lore');
    this.player!.res = Math.min(this.player!.maxRes, this.player!.res + 15);
  }

  readSign(text: string) {
    this.dynNodes['lore'] = { name: 'Cartel', portrait: 'wisp', text };
    this.openDialogue('lore');
  }

  /** Enciende un Farol del Recuerdo de Merrow (Acto II, misión q8). */
  lightLamp(id: string) {
    this.flags[id] = true;
    audio.sfx('lamp');
    const pr = this.map.props.find(x => x.id === id);
    if (pr) {
      this.burst(pr.x * TILE + 8, pr.y * TILE - 6, '#ffe9a0', 14, 60);
      this.floatAt(pr.x * TILE + 8, pr.y * TILE - 14, 'Un nombre vuelve', '#ffe9a0', 5);
    }
    const lamps = ['lamp1', 'lamp2', 'lamp3'].filter(l => this.flags[l]).length;
    if (this.questIdx === 7 && this.questStep === 1) {
      if (lamps >= 3) {
        this.questAdvance();
        this.toast('Los tres faroles arden: la Espectro de Merrow te espera', '#ffe9a0');
      } else {
        this.toast(`Farol encendido (${lamps}/3)`, '#8ef0b0');
      }
    } else {
      this.toast('El farol se enciende: un recuerdo de Merrow regresa', '#ffe9a0');
    }
  }

  tryTakeEco() {
    // Acto II: cada mapa con altar tiene su Eco y su custodio
    if (this.mapId === 'costa') {
      if (this.flags.ecoMareas) { this.toast('El altar ya está vacío.', '#9aa0b8'); return; }
      if (!this.flags.sirenaDefeated) { this.toast('La Sirena custodia el Eco. Calma su canto primero.', '#e88'); return; }
      if (DIALOGUES['eco_mareas']) { this.openDialogue('eco_mareas'); return; }
      this.dynNodes['eco_mareas'] = {
        name: 'Eco de las Mareas', portrait: 'fragment',
        text: 'El segundo canto asciende del naufragio, salado y vivo. «El mar guardó mi nota bajo la quilla de un barco que soñaba con estrellas. Cántala, Portador: hay mareás que solo se curan cantando.» (Eco de las Mareas recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)',
        onEnd: 'eco_mareas_taken',
      };
      this.openDialogue('eco_mareas');
      return;
    }
    if (this.mapId === 'cumbres') {
      if (this.flags.ecoCumbres) { this.toast('El altar ya está vacío.', '#9aa0b8'); return; }
      if (!this.flags.golemDefeated) { this.toast('El Gólem custodia el Eco. Rompe su hielo primero.', '#e88'); return; }
      if (DIALOGUES['eco_cumbres']) { this.openDialogue('eco_cumbres'); return; }
      this.dynNodes['eco_cumbres'] = {
        name: 'Eco de las Cumbres', portrait: 'fragment',
        text: 'El tercer canto desciende con la ventisca, limpio y paciente. «Las montañas aprendieron a guardar voces bajo el hielo. La primera fue la de los pastores que cantaban por turnos para no dormirse. Toma la suya: ahora canta contigo.» (Eco de las Cumbres recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)',
        onEnd: 'eco_cumbres_taken',
      };
      this.openDialogue('eco_cumbres');
      return;
    }
    if (this.flags.ecoVoz) { this.toast('El altar ya está vacío.', '#9aa0b8'); return; }
    if (!this.flags.guardianDefeated) { this.toast('El Guardián custodia el Eco. Derótalo primero.', '#e88'); return; }
    this.openDialogue('eco_voz');
  }

  openSanctuary() {
    const opts: { text: string; next?: string; action?: string }[] = [
      { text: 'Descansar y guardar la partida', action: 'rest' },
    ];
    for (const mid of Object.keys(this.visitedMaps) as MapId[]) {
      if (this.visitedMaps[mid] && mid !== this.mapId) {
        const nm = MAPS[mid as MapId].name;
        opts.push({ text: `Viajar: ${nm}`, action: `travel_${mid}` });
      }
    }
    opts.push({ text: 'Marcharse', action: 'close' });
    this.dynNodes['sanctuary'] = {
      name: 'Santuario del Eco', portrait: 'sanctuary',
      text: 'El cristal zumba con una melodía antigua. La luz del Santuario te envuelve: aquí puedes descansar, guardar tu canto... o dejarte llevar por él.',
      options: opts,
    };
    this.openDialogue('sanctuary');
  }

  talkTo(nid: string) {
    // q5→q6: «Regresa con la Anciana Brisa» (1 paso) se completa AL hablar con
    // ella tras el Guardián. Se avanza ANTES de resolver el nodo para que
    // getDialogue vea la misión nueva (coordinación agente 8-a: con questIdx 5
    // debe servir el nodo cuyo onEnd es accept_q6; con questIdx 9, el nodo
    // final del Acto II cuyo onEnd es end_demo).
    if (nid === 'brisa' && this.questIdx === 4 && this.questStep === 0) this.questAdvance();
    // 10-b (balance): q10 se completa al regresar con Brisa (nodo brisa_final2 →
    // acto2_report en hooks.ts, congelado); pagamos su recompensa al abrir ese
    // nodo, con flag q10Paid para no duplicar si se reabre el diálogo
    if (nid === 'brisa' && this.questIdx === 9 && !this.flags.acto2Done) this.grantQuestLoot(9);
    const key = getDialogue(nid, { questIdx: this.questIdx, questStep: this.questStep, flags: this.flags, companion: !!this.companion });
    this.openDialogue(key);
  }

  // ---------------- Diálogo ----------------

  openDialogue(key: string) {
    this.dlgKey = key;
    this.dlgNode = this.dynNodes[key] ?? DIALOGUES[key] ?? null;
    // robustez multi-agente: si el nodo resuelto no existe todavía (data.ts se
    // edita en paralelo), se cae a un nodo seguro en vez de dejar el juego en
    // un estado raro (diálogo que no abre / pantalla bloqueada)
    if (!this.dlgNode && key !== 'brisa_idle') {
      console.warn(`[EcosAelthar] Nodo de diálogo inexistente: '${key}' — fallback: 'brisa_idle'`);
      this.dlgKey = 'brisa_idle';
      this.dlgNode = DIALOGUES['brisa_idle'] ?? null;
    }
    this.dlgCharT = 0;
    this.dlgSel = 0;
    if (this.dlgNode) this.setState('dialogue');
    audio.sfx('uiOpen');
  }

  dialogueFinishedText(): boolean {
    if (!this.dlgNode) return true;
    return this.dlgCharT >= this.dlgNode.text.length;
  }

  advanceDialogue() {
    if (!this.dlgNode) return;
    if (!this.dialogueFinishedText()) { this.dlgCharT = this.dlgNode.text.length; return; }
    if (this.dlgNode.action) this.applyAction(this.dlgNode.action);
    if (this.dlgNode.onEnd) this.applyAction(this.dlgNode.onEnd);
    if (this.dlgNode.options && this.dlgNode.options.length > 0) {
      const opt = this.dlgNode.options[this.dlgSel];
      recordDialogueTone(this, opt);
      if (opt.action) this.applyAction(opt.action);
      if (opt.next) { this.openDialogue(opt.next); return; }
      this.closeDialogue();
      return;
    }
    if (this.dlgNode.next) { this.openDialogue(this.dlgNode.next); return; }
    this.closeDialogue();
  }

  closeDialogue() {
    this.dlgKey = null;
    this.dlgNode = null;
    noteDialogueClosed16b(this); // ==== 16-b: habilita el rumor al re-pulsar E ====
    if (this.state === 'dialogue') this.setState('play');
  }

  applyAction(action: string) {
    const p = this.player;
    if (!p) return;
    switch (true) {
      case action === 'accept_q2':
        this.questIdx = 1; this.questStep = 0; this.flags.q2 = true;
        audio.sfx('quest'); this.toast('Nueva misión: Lobos en la Niebla', '#8ef0b0');
        break;
      case action === 'accept_q3':
        this.questIdx = 2; this.questStep = this.flags.visitedBosque ? 1 : 0;
        p.gold += 50; p.potions += 2; p.repGuardianes += 10;
        audio.sfx('quest'); this.toast('Misión completada: Lobos en la Niebla (+50 coronas, +2 pociones, +10 reputación)', '#8ef0b0');
        this.toast('Nueva misión: El Susurro del Bosque', '#8ef0b0');
        break;
      case action === 'accept_q4':
        this.questIdx = 3; this.questStep = 0;
        audio.sfx('quest'); this.toast('Nueva misión: La Cripta del Primer Canto', '#8ef0b0');
        break;
      case action === 'accept_q5':
        this.questIdx = 4; this.questStep = 0;
        audio.sfx('quest'); this.toast('Nueva misión: Ecos de Esperanza', '#8ef0b0');
        break;
      // ------- ACTO II · aceptación de misiones q6-q10 (disparadas desde los
      // nodos de diálogo del Acto II en data.ts — agente 8-a) -------
      case action === 'accept_q6':
        this.questIdx = 5; this.questStep = 0; this.flags.q6 = true;
        audio.sfx('quest'); this.toast('Nueva misión: El Rumor del Mar', '#8ef0b0');
        break;
      case action === 'accept_q7':
        this.questIdx = 6; this.questStep = 0; this.flags.q7 = true;
        audio.sfx('quest'); this.toast('Nueva misión: La Sirena sin Canto', '#8ef0b0');
        break;
      case action === 'accept_q8':
        this.questIdx = 7; this.questStep = 0; this.flags.q8 = true;
        audio.sfx('quest'); this.toast('Nueva misión: La Aldea que Olvidó su Nombre', '#8ef0b0');
        break;
      case action === 'accept_q9':
        this.questIdx = 8; this.questStep = 0; this.flags.q9 = true;
        audio.sfx('quest'); this.toast('Nueva misión: La Cumbre del Segundo Canto', '#8ef0b0');
        break;
      case action === 'accept_q10':
        this.questIdx = 9; this.questStep = 0; this.flags.q10 = true;
        audio.sfx('quest'); this.toast('Nueva misión: Dos Voces más Fuertes', '#8ef0b0');
        break;
      case action === 'fragment_touched':
        // R8-1.4: guard de evento YA disparado. El onEnd del nodo 'voz_fragment'
        // se re-dispara en cada avance/relectura del Fragmento: sin guard
        // repetía sfx/ráfaga/toast y podía RE-AVANZAR q3 (skip de misión).
        if (this.flags.fragmentTouched) break;
        this.flags.fragmentTouched = true;
        p.hasEcho = true;
        audio.sfx('echo');
        this.burst(p.x, p.y - 8, '#ffe9a0', 24, 80);
        if (this.questIdx === 2) this.questAdvance();
        this.toast('Resonancia despierta: pulsa Q para alternar entre presente y pasado', '#ffe9a0');
        // R8-1.4: el "embate" de la Niebla al despertar el primer Eco — anillo
        // ACOTADO (tope 3), espaciado ≥2 tiles, nunca encima del Portador y UNA
        // sola vez por partida (spawnEventRing: guard persistente + topes).
        this.spawnEventRing('sombra', 3, 'embatePrimerEco');
        break;
      case action === 'eco_taken':
        this.flags.ecoVoz = true;
        p.points += 1; p.repGuardianes += 10;
        p.hp = p.maxHp;
        if (this.questIdx === 3 && this.questStep === 2) this.questAdvance();
        this.grantEchoXp(); // R8-4.4
        this.toast('Eco de la Voz recuperado: +1 punto de habilidad, +10 reputación', '#ffe9a0');
        break;
      case action === 'eco_mareas_taken':
        this.flags.ecoMareas = true;
        p.points += 1; p.repGuardianes += 10;
        p.hp = p.maxHp;
        if (this.questIdx === 6 && this.questStep === 2) this.questAdvance();
        this.applyAction('memory_mem_faro');
        this.grantEchoXp(); // R8-4.4
        this.toast('Eco de las Mareas recuperado: +1 punto de habilidad, +10 reputación', '#ffe9a0');
        break;
      case action === 'eco_cumbres_taken':
        this.flags.ecoCumbres = true;
        p.points += 1; p.repGuardianes += 10;
        p.hp = p.maxHp;
        if (this.questIdx === 8 && this.questStep === 2) this.questAdvance();
        this.applyAction('memory_mem_invierno');
        this.grantEchoXp(); // R8-4.4
        this.toast('Eco de las Cumbres recuperado: +1 punto de habilidad, +10 reputación', '#ffe9a0');
        break;
      case action === 'fragment':
        break;
      case action === 'forge': {
        const cost = 30 + p.weaponPlus * 25;
        if (p.weaponPlus >= 5) { this.toast('Toln: «+5 es lo que da de sí esta forja, Portador.»', '#e8a'); audio.sfx('error'); }
        else if (p.gold >= cost) {
          p.gold -= cost; p.weaponPlus++;
          if (!this.challengeRun) this.stats.coronasGastadas += cost; // ==== 16-c: pago en forja ====
          audio.sfx('confirm');
          this.toast(`Arma mejorada a +${p.weaponPlus} (${cost} coronas)`, '#f0c84a');
        } else { this.toast(`Te faltan coronas (${cost} necesarias)`, '#e88'); audio.sfx('error'); }
        break;
      }
      case action === 'buy_potion':
        if (p.gold >= 15) {
          p.gold -= 15; p.potions++;
          if (!this.challengeRun) this.stats.coronasGastadas += 15; // ==== 16-c: pago en tienda ====
          audio.sfx('coin'); this.toast('Poción comprada (15 coronas)', '#f0c84a');
        }
        else { this.toast('Te faltan coronas', '#e88'); audio.sfx('error'); }
        break;
      // ==== 16-b: señuelo de caza (item apilable 'sennuelo' en flags.sennuelos) ====
      case action === 'buy_sennuelo':
        if (p.gold >= SENNUEL.price) {
          p.gold -= SENNUEL.price;
          if (!this.challengeRun) this.stats.coronasGastadas += SENNUEL.price; // 16-c: espejo
          this.flags.sennuelos = (Number(this.flags.sennuelos ?? 0) || 0) + 1;
          audio.sfx('coin');
          this.toast(`Señuelo de caza comprado (${SENNUEL.price} coronas) — llevas ${this.flags.sennuelos}`, '#e8c88a');
        } else { this.toast(`Te faltan coronas (${SENNUEL.price} necesarias)`, '#e88'); audio.sfx('error'); }
        break;
      // 14-b: compra de corazas en la forja de Toln (diálogo 'toln_armaduras')
      case action.startsWith('armor_'): {
        const a = armorDefFor(Number(action.slice(6)));
        if (a) {
          if (this.flags[a.id]) { this.toast('Toln: «esa coraza ya te cubre, Portador.»', '#e88'); audio.sfx('error'); break; }
          if (a.needFlag && !this.flags[a.needFlag]) {
            this.toast('Toln: «La Guarda del Primer Canto solo la forjo para quien ha oído el tercer canto hasta el final.»', '#e88');
            audio.sfx('error');
            break;
          }
          if (p.gold >= a.cost) {
            p.gold -= a.cost;
            if (!this.challengeRun) this.stats.coronasGastadas += a.cost; // ==== 16-c: pago de coraza ====
            this.flags[a.id] = true;
            audio.sfx('confirm');
            this.toast(`${a.name} forjada (${a.cost} coronas): daño recibido −${Math.round(a.red * 100)}%`, '#f0c84a');
          } else { this.toast(`Te faltan coronas (${a.cost} necesarias)`, '#e88'); audio.sfx('error'); }
        }
        break;
      }
      case action === 'recruit_ilwen':
        if (!this.companion) {
          this.companion = this.makeCompanion();
          this.toast('Ilwen se une al grupo: cubre tu espalda con su arco', '#8ef0b0');
          audio.sfx('confirm');
        }
        break;
      case action === 'rest':
        p.hp = p.maxHp; p.sta = p.maxSta;
        this.save();
        audio.sfx('save');
        this.toast('Descansas junto al cristal. Partida guardada. Vida restaurada.', '#8ef0ff');
        break;
      case action.startsWith('travel_'): {
        const dest = action.slice(7) as MapId;
        if (MAPS[dest]) {
          this.closeDialogue();
          this.fadeTo(dest, ...this.sanctuaryPos(dest));
        }
        break;
      }
      case action === 'end_demo': {
        const mins = Math.floor(p.playTime / 60), secs = Math.floor(p.playTime % 60);
        this.endStats =
          `Nivel ${p.level} · ${p.kills} enemigos derrotados · ${p.gold} coronas\n` +
          `Reputación Guardianes: ${p.repGuardianes >= 0 ? '+' : ''}${p.repGuardianes} · Muertes: ${p.deaths}\n` +
          `Tiempo de juego: ${mins}m ${secs}s · Época favorita: la que tú elijas`;
        // el mismo cierre sirve de final del Acto I (questIdx<9) o del Acto II
        if (this.questIdx >= 9) this.toast('Fin del Acto II', '#ffe9a0');
        this.save();
        this.setState('end');
        audio.playTrack('title');
        break;
      }
      case action === 'close':
        this.closeDialogue();
        break;
      default:
        // acciones extendidas (sistema de tono, memorias, facciones...) — ver hooks.ts
        handleCustomAction(this, action);
        break;
    }
  }

  sanctuaryPos(id: MapId): [number, number] {
    // ==== 17-d (qa-mundo): dato, no tabla a mano. Antes devolvía [19,24]
    // para CUALQUIER mapa que no fuera lunaris/bosque: morir (respawn) o
    // viajar por el Santuario en la Costa, la Aldea o las Cumbres aterrizaba
    // a 3-5 tiles del cristal real (respawn costa (19,24) vs santuario
    // (22,21); aldea (19,24) vs (17,21); cumbres (19,24) vs (14,24)) — el
    // toast «Despiertas junto al Santuario» mentía y el respiro post-muerte
    // nacía lejos del punto seguro. Ahora se lee el prop 'sanctuary' del mapa
    // (aterrizando 1 tile debajo, la convención ya usada por los 3 viejos).
    const s = MAPS[id]?.props.find(pr => pr.kind === 'sanctuary');
    if (s) return [s.x, s.y + 1];
    if (id === 'lunaris') return [25, 19];
    if (id === 'bosque') return [38, 27];
    // R7-Q1 #4: santuarios de la expansión (maps_expansion: sanc_co/sanc_a/sanc_cu)
    if (id === 'costa') return [22, 21];
    if (id === 'aldea') return [17, 21];
    if (id === 'cumbres') return [14, 24];
    return [19, 24];
  }

  questAdvance() {
    if (this.questStep < QUESTS[this.questIdx].steps.length - 1) {
      this.questStep++;
    } else {
      const prev = this.questIdx;
      this.questIdx = Math.min(QUESTS.length - 1, this.questIdx + 1);
      this.questStep = 0;
      // 10-b (balance): botín pequeño al COMPLETAR cada misión del Acto II
      // (q6-q10), clave = índice de la misión recién terminada. Solo dispara
      // en el cambio de misión, así no interfiere con los avances de paso.
      this.grantQuestLoot(prev);
      // toast generalizado al CAMBIAR de misión (antes solo lo cantaba el paso
      // q4→q5 con texto hardcodeado); si el clamp ya está en la última misión,
      // no repite el aviso
      if (this.questIdx !== prev) this.toast(`Nueva misión: ${QUESTS[this.questIdx].name}`, '#8ef0b0');
    }
    audio.sfx('quest');
  }

  /**
   * 10-b (balance): recompensa por completar una misión del Acto II.
   * q6 +20 coronas · q7 +40 y 1 poción · q8 +35 · q9 +50 y 1 poción · q10 +60.
   * q10 se paga desde talkTo('brisa') (el cierre real del Acto II vive en
   * hooks.acto2_report, archivo congelado) con flag q10Paid anti-doble pago;
   * la entrada 9 del mapa queda por si el motor algún día avanza desde q10.
   */
  grantQuestLoot(doneIdx: number) {
    const LOOT: Record<number, { gold: number; potions?: number }> = {
      5: { gold: 20 },             // q6 El Rumor del Mar
      6: { gold: 40, potions: 1 }, // q7 La Sirena sin Canto
      7: { gold: 35 },             // q8 La Aldea que Olvidó su Nombre
      8: { gold: 50, potions: 1 }, // q9 La Cumbre del Segundo Canto
      9: { gold: 60 },             // q10 Dos Voces más Fuertes
    };
    const loot = LOOT[doneIdx];
    if (!loot || !this.player) return;
    if (doneIdx === 9) {
      if (this.flags.q10Paid) return;
      this.flags.q10Paid = true;
    }
    const p = this.player;
    p.gold += loot.gold;
    if (!this.challengeRun) this.stats.coronasGanadas += loot.gold; // ==== 16-c ====
    if (loot.potions) p.potions += loot.potions;
    const txt = `Recompensa: +${loot.gold} coronas${loot.potions ? ' y 1 poción' : ''}`;
    this.floatAt(p.x, p.y - 26, txt, '#f0c84a', 7);
    this.toast(txt, '#f0c84a');
    audio.sfx('coin');
  }

  questProgressText(): string | null {
    if (this.questIdx === 1 && this.questStep === 0) {
      const n = Number(this.flags.wolfKills ?? 0);
      return `Caza 3 Lobos de Niebla en el sur del valle (${n}/3)`;
    }
    return null;
  }

  fadeTo(to: MapId, tx: number, ty: number) {
    // R8-1.6: la Cripta SOLO se entra por su puerta. La zona de salida
    // bosque→cripta (x8..12, y2..3) es más ancha que la puerta del recinto
    // (x9..11, y4) — reporte: "se entra por el LADO". fadeTo es la ÚNICA puerta
    // por la que pasa toda transición (update, santuario, hooks): el blindaje
    // vive aquí y SOLO aplica al paso A PIE (Portador dentro de la zona de
    // salida); el Viajar del santuario desde bosque (fuera de la zona) queda
    // intacto. Se exigen las columnas de la puerta en la fila interior que
    // toca al dintel; cualquier otro tile de la zona se ignora con feedback
    // claro y throttle (fadeDir queda intacto → sin fundido fantasma).
    if (this.mapId === 'bosque' && to === 'cripta' && this.player) {
      const ptx = Math.floor(this.player.x / TILE), pty = Math.floor(this.player.y / TILE);
      if (this.inExitZone(ptx, pty) && !(ptx >= 9 && ptx <= 11 && (pty === 2 || pty === 3))) {
        if (this.globalT - this.cryptGateMsgAt >= 4) {
          this.cryptGateMsgAt = this.globalT;
          this.floatAt(this.player.x, this.player.y - 24, 'La Cripta solo cede a su puerta', '#c8b0e8', 7);
          audio.sfx('error');
        }
        return;
      }
    }
    this.pendingMap = { to, tx, ty };
    this.fadeDir = 1;
  }

  /**
   * R8-1.7 · Feedback al chocar contra una BARRERA DE ÉPOCA: tile sólido en la
   * época actual pero transitable en la opuesta (Niebla Muda 'n', puente roto
   * 'x', diffs equivalentes). El muro normal (sólido en ambas) NO dice nada:
   * early-out barato. Throttle 5 s por globalT — cero allocations en régimen.
   */
  private epochBarrierFeedback(nx: number, ny: number): void {
    if (this.globalT - this.barrierMsgAt < 5) return;
    const tx = Math.floor(nx / TILE), ty = Math.floor(ny / TILE);
    const chNow = tileAt(this.map, this.rows, tx, ty, this.epoch);
    if (!SOLID_CHARS.has(chNow)) return;
    const other: Epoch = this.epoch === 'presente' ? 'pasado' : 'presente';
    if (SOLID_CHARS.has(tileAt(this.map, this.rows, tx, ty, other))) return; // muro normal
    this.barrierMsgAt = this.globalT;
    const msg = chNow === 'n'
      ? 'La Niebla Muda devora los nombres: solo el ayer la disipa (Q)'
      : chNow === 'x'
        ? 'El río se llevó el paso: en el ayer el puente seguía en pie (Q)'
        : 'El tiempo bloquea el paso: alterna de época con Q';
    if (this.player) {
      this.floatAt(this.player.x, this.player.y - 24, msg, '#c8b0e8', 7);
      this.burst(nx, ny - 6, chNow === 'n' ? '#d8e8e4' : '#c8b0e8', 6, 26);
    }
    this.toast(msg, '#c8b0e8');
    audio.sfx('error');
  }

  // ---------------- Mensajes ----------------

  toast(text: string, color?: string) {
    this.toasts.push({ text, t: 3.4, color });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  floatAt(x: number, y: number, text: string, color: string, size = 8) {
    this.floats.push({ x, y, text, t: 0.9, color, vy: -26, size });
    // R5-O6: tope duro — recorta los textos más viejos (como toast)
    if (this.floats.length > MAX_FLOATS) this.floats.splice(0, this.floats.length - MAX_FLOATS);
  }

  burst(x: number, y: number, color: string, n: number, spd = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0.5 + Math.random() * 0.4, maxT: 0.9, color, size: 1 + Math.random() * 2, grav: 90 });
    }
    // R5-O6: tope duro — recorta las partículas más viejas
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
  }

  // ---------------- Muerte ----------------

  playerDied() {
    const p = this.player!;
    p.deaths++;
    if (!this.challengeRun) this.stats.muertes++; // ==== 16-c (logros-stats) ====
    const lost = Math.floor(p.gold / 2);
    this.lastGoldLost = lost;
    if (lost > 0) {
      p.gold -= lost;
      this.deadGolds.push({ map: this.mapId, x: p.x, y: p.y, amount: lost });
    }
    // 14-b (compañeros): al caer el Portador, Ilwen se RETIRA — no sigue
    // peleando sola; reaparece entera a tu lado al despertar en el Santuario
    // (companionTick la teletransporta y el regen fuera de combate la cura).
    if (this.companion) {
      if (this.companion.downT <= 0) this.companion.hp = this.companion.maxHp;
      this.toast('Ilwen te cubre la retirada...', '#8ef0b0');
    }
    audio.sfx('die');
    dreadStinger('muerte'); // terror v2 (Ronda 2): golpe grave + silencio
    this.setState('dead');
  }

  respawn() {
    // en desafío la muerte NO respawnea al santuario de campaña: el módulo
    // challenge muestra resultados y vuelve al título
    if (this.challengeRun) { onChallengeDeath(this); return; }
    const p = this.player!;
    const [sx, sy] = this.sanctuaryPos(this.mapId);
    this.epoch = 'presente';
    this.loadMap(this.mapId, sx, sy);
    p.hp = p.maxHp; p.sta = p.maxSta; p.res = 0;
    this.setState('play');
    audio.playTrack(this.map.music);
    this.toast('Despiertas junto al Santuario. Un eco de tu oro sigue donde caíste...', '#c8b0e8');
  }

  // ---------------- Input ----------------

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    // teclas pegadas tras alt-tab / cambio de ventana: soltar todo
    window.addEventListener('blur', this.onLoseFocus);
    document.addEventListener('visibilitychange', this.onLoseFocus);
    // vista dinámica: sin barras negras a cualquier aspecto de ventana
    window.addEventListener('resize', this.onResize);
    this.fitCanvas();
  }

  /** Recalcula el buffer al aspecto actual y redimensiona el bitmap del canvas. */
  private fitCanvas() {
    const before = `${VIEW_W}x${VIEW_H}`;
    fitViewToWindow(window.innerWidth, window.innerHeight);
    // R6-V10: baja sostenida ≥ LOWQ_SUSTAIN_S s → re-pide el ajuste con el
    // aspecto recortado a LOWQ_VIEW_MAX_W×540; fitViewToWindow clampéa a sus
    // mínimos/máximos, así que el resultado es exactamente ese par. Vistas ya
    // ≤1280 px (p. ej. 960×540 en 16:9) quedan intactas.
    if (this.perfCapOn && VIEW_W > LOWQ_VIEW_MAX_W) {
      fitViewToWindow(LOWQ_VIEW_MAX_W, LOWQ_VIEW_BASE_H);
    }
    if (this.canvas.width !== VIEW_W || this.canvas.height !== VIEW_H) {
      this.canvas.width = VIEW_W;
      this.canvas.height = VIEW_H;
      this.ctx.imageSmoothingEnabled = false; // el resize resetea el estado del ctx
    }
    if (before !== `${VIEW_W}x${VIEW_H}`) this.updateCamera(true);
  }

  private onResize = () => { this.fitCanvas(); };

  /**
   * R6-V10 · Histéresis del tope de vista (1×/frame, O(1), cero allocs).
   * Mide en tiempo REAL (performance.now, como perfFrame) cuánto lleva el
   * escalón de perf.ts en calidad baja: solo tras LOWQ_SUSTAIN_S s seguidos
   * activa el tope de ancho (re-fit con cap). Si la calidad sube (perf.ts ya
   * exige 6 s por encima de 58 fps para subir), el tope se retira y la vista
   * vuelve al ajuste completo de la ventana. Un hueco >1 s (alt-tab/pestaña
   * oculta) rompe el tramo, igual que perf.ts descarta su ventana móvil.
   */
  private perfViewTick() {
    const now = performance.now();
    const prev = this.perfLastTick;
    this.perfLastTick = now;
    if (prev >= 0 && now - prev > 1000) this.perfLowSince = -1; // hueco: tramo no sostenido
    if (perfQuality() === 2) {
      if (this.perfLowSince < 0) this.perfLowSince = now;
      else if (!this.perfCapOn && now - this.perfLowSince >= LOWQ_SUSTAIN_S * 1000) {
        this.perfCapOn = true;
        this.fitCanvas(); // aplica el tope y reajusta canvas + cámara
      }
    } else {
      this.perfLowSince = -1;
      if (this.perfCapOn) { this.perfCapOn = false; this.fitCanvas(); } // recuperado → vista completa
    }
  }

  private onLoseFocus = () => {
    this.keys.clear();
    this.mouse.down = false;
    this.mouse.rdown = false;
  };

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onLoseFocus);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onLoseFocus);
    // FIX clics fantasma: desvincular TAMBIÉN los listeners del canvas. Antes
    // quedaban colgados: con el doble montaje de React (StrictMode) la primera
    // instancia moría sin soltarlos, su uiHit quedaba congelado con los botones
    // del título y al hacer clic "donde estaban" durante la partida se abría la
    // creación de personaje (requestCreate sigue ligado al setState del overlay).
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.stop();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    // no interceptar teclas cuando se escribe en un input DOM (nombre del Portador)
    const t = e.target as HTMLElement | null;
    const isDomInput = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (!isDomInput && [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    audio.resume();
    if (!isDomInput && k === 'f3') { e.preventDefault(); togglePerfOverlay(); } // R5-O1: F3 alterna el overlay (k ya en minúsculas)

    if (this.state === 'title') {
      if (k === 'enter' || k === 'e' || k === ' ') { /* botones por click; enter = nueva partida */ }
    } else if (this.state === 'intro') {
      if (k === 'e' || k === ' ' || k === 'enter') {
        this.introIdx++;
        audio.sfx('blip');
        if (this.introIdx >= 3) this.startPlay();
      }
    } else if (this.state === 'dialogue') {
      if (k === 'e' || k === ' ' || k === 'enter') this.advanceDialogue();
      else if (k === 'arrowup' || k === 'w') { if (this.dlgNode?.options) { this.dlgSel = (this.dlgSel + this.dlgNode.options.length - 1) % this.dlgNode.options.length; audio.sfx('blip'); } }
      else if (k === 'arrowdown' || k === 's') { if (this.dlgNode?.options) { this.dlgSel = (this.dlgSel + 1) % this.dlgNode.options.length; audio.sfx('blip'); } }
    } else if (this.state === 'play') {
      if (k === ' ' && this.player && this.player.rollT <= 0 && this.player.attackT <= 0 && this.player.sta >= 20) {
        this.rollQueued = true; // 1 pulsación = 1 voltereta (no en cadena)
      }
      if (k === 'e') this.tryInteract();
      else if (k === 'q') this.epochSwitch();
      else if (k === 'escape' || k === 'm') { this.setState('pause'); audio.sfx('uiOpen'); }
      else if (k === 'f') this.drinkPotion();
      else if (k === 't' && e.shiftKey) {
        // accesibilidad / QoL: esperar hasta el alba
        this.dayT = 0.22;
        this.toast('Esperas junto al camino hasta el alba...', '#ffe86a');
        audio.sfx('save');
      }
      // ==== 16-b (interacción-compañeros): órdenes tácticas (T) y señuelo (8;
      // las teclas 5/6/7 son de las herramientas del árbol, 12-b) ====
      else if (k === 't') cycleCompanionMode(this);
      else if (k === '8') useSenno(this);
      // ==== 17-a (qa-combate) ==== carga por teclado: mantener J inicia la
      // carga (el keyup de abajo ya la liberaba; faltaba el inicio). Si la
      // carga ya está en curso (ratón u otra J), startAttack no la reinicia
      // (guard añadido en startAttack) y no se marca como suya.
      else if (k === 'j') {
        if (this.player && !this.player.charging) {
          this.startAttack();
          if (this.player.charging) chargeViaTecla.add(this.player);
        }
      }
      else if (['1', '2', '3', '4'].includes(k)) this.useSkill(parseInt(k, 10) - 1);
      else if (k === 'k') { this.setState('skills'); audio.sfx('uiOpen'); }
    } else if (this.state === 'pause') {
      if (k === 'escape' || k === 'm') this.setState('play');
    } else if (this.state === 'skills') {
      if (k === 'escape' || k === 'k' || k === 'm') { this.setState('play'); audio.sfx('uiOpen'); }
    } else if (this.state === 'dead') {
      if (k === 'e' || k === 'enter') this.respawn();
    } else if (this.state === 'end') {
      if (k === 'enter' || k === 'e') this.setState('title');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
    // ==== 17-a (qa-combate) ==== soltar J libera SOLO las cargas nacidas de
    // J: antes cualquier carga (también la del ratón) se cortaba al soltar J.
    if (this.player && e.key.toLowerCase() === 'j' && this.player.charging
        && chargeViaTecla.delete(this.player)) {
      this.releaseCharge();
    }
  };

  private canvasPos(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (VIEW_W / r.width), y: (e.clientY - r.top) * (VIEW_H / r.height) };
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.running) return; // instancia muerta: ignora input (clics fantasma)
    const p = this.canvasPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.running) return; // instancia muerta: ignora input (clics fantasma)
    audio.resume();
    const p = this.canvasPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
    // UI hits primero — solo del estado ACTUAL (stamp anti-fantasma: los hits
    // se registran con el estado del frame en que se dibujaron; un clic que
    // aterrice en la misma frame de una transición título→juego no reabre menús)
    for (const h of this.uiHit) {
      if (h.state !== this.state) continue;
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
        audio.sfx('select');
        h.cb();
        return;
      }
    }
    if (e.button === 2) { this.mouse.rdown = true; this.startParry(); return; }
    if (e.button !== 0) return;
    this.mouse.down = true;
    if (this.state === 'dialogue') this.advanceDialogue();
    else if (this.state === 'intro') { this.introIdx++; if (this.introIdx >= 3) this.startPlay(); else audio.sfx('blip'); }
    else if (this.state === 'end') this.setState('title');
    else if (this.state === 'play') this.startAttack();
  };

  private onMouseUp = (e: MouseEvent) => {
    if (!this.running) return; // instancia muerta: ignora input
    if (e.button === 0) {
      this.mouse.down = false;
      // ==== 17-a (qa-combate) ==== soltar el clic libera SOLO las cargas
      // nacidas del ratón: si la carga en curso es de J, el clic no la corta.
      const viaTecla = this.player ? chargeViaTecla.delete(this.player) : false;
      if (this.player?.charging && !viaTecla) this.releaseCharge();
    }
    if (e.button === 2) this.mouse.rdown = false;
  };

  tryInteract() {
    // ==== 16-b: E de nuevo justo tras cerrar un diálogo → rumor corto del NPC
    // (ventana 2.5 s, cooldown 60 s por NPC; si no toca, abre el diálogo normal) ====
    if (rumorAfterDialogue16b(this)) { audio.sfx('select'); return; }
    const it = this.nearestInteract();
    if (it) { audio.sfx('select'); it.act(); }
    // R10-3: palancas de la cripta (activación por proximidad 3×3)
    else if (cryptLeverTryActivateNear(this)) { audio.sfx("select"); playLeverPull(); }
    // micro-interacciones del mundo vivo (13-b): pozo, lápidas, agua, faroles…
    else if (worldInteract(this)) { audio.sfx('select'); }
    // ==== 16-b: restos de enemigos y cofres ya abiertos (añadidos al final de
    // la cadena: nunca roban NPCs/cofres cerrados/santuarios ni casos 13-b) ====
    else if (interaccionInteract16b(this)) { audio.sfx('select'); }
    else this.toast('No hay nada que interactuar aquí.', '#9aa0b8');
  }

  drinkPotion() {
    if (!this.player) return;
    const p = this.player;
    if (p.potions <= 0) { this.toast('No te quedan pociones', '#e88'); audio.sfx('error'); return; }
    if (p.hp >= p.maxHp) { this.toast('Vida al máximo', '#9aa0b8'); return; }
    p.potions--;
    if (!this.challengeRun) this.stats.pocionesUsadas++; // ==== 16-c (logros-stats) ====
    const heal = Math.round(p.maxHp * 0.4);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    audio.sfx('potion');
    this.floatAt(p.x, p.y - 14, `+${heal}`, '#7ef0a0');
    this.burst(p.x, p.y - 6, '#7ef0a0', 8, 30);
  }

  startAttack() {
    if (!this.player) return;
    const p = this.player;
    // ==== 17-a (qa-combate) ==== si la carga ya está en curso no se reinicia
    // (antes, pulsar J mientras se mantenía el clic ponía chargeT a 0).
    if (p.charging) return;
    if (p.attackT > 0 || p.rollT > 0) return;
    p.charging = true;
    p.chargeT = 0;
  }

  releaseCharge() {
    const p = this.player!;
    const wasCharging = p.charging;
    p.charging = false;
    const charged = wasCharging && p.chargeT > 0.35;
    const chargeTime = p.chargeT;
    p.chargeT = 0;
    if (!wasCharging) return;
    if (p.attackT > 0 || p.rollT > 0 || this.state !== 'play') return;
    if (p.sta < 8) { audio.sfx('parryFail'); return; }
    p.attackT = charged ? 0.4 : 0.26;
    p.combo = (p.combo + 1) % 3;
    p.sta -= charged ? 18 : 8;
    p.chargedHit = charged;
    this.aimAtMouse();
    audio.sfx(charged ? 'swing2' : 'swing');
    // daño del golpe ==== 17-e (qa): los multiplicadores del árbol (Filo
    // Templado/Cólera del Alba) aplican al ataque BASE del jugador ====
    const comboMult = [1, 1.12, 1.28][p.combo];
    const dmg = playerMeleeDmg(p) * comboMult * (charged ? 2.1 : 1) * skillDamageMult(this, 'melee');
    if (charged) {
      const dirs: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
      const [dx, dy] = dirs[p.dir];
      this.aoeHit(p.x + dx * 20, p.y + dy * 20, 34, dmg, 'ninguno', false);
      this.shake = 3;
      this.burst(p.x + dx * 18, p.y + dy * 18, '#ffe86a', 12, 70);
    } else {
      this.meleeHit(24, 20, dmg, 'ninguno', 50);
    }
    void chargeTime;
  }

  startParry() {
    if (!this.player) return;
    const p = this.player;
    if (this.state !== 'play' || p.rollT > 0) return;
    if (p.sta < 12) { audio.sfx('parryFail'); return; }
    p.sta -= 12;
    p.parryT = 0.2;
    p.parryFx = 0.32;
    audio.sfx('swing');
  }

  aimAtMouse() {
    if (!this.player) return;
    const p = this.player;
    const wx = this.mouse.x / ZOOM + this.camX / ZOOM;
    const wy = this.mouse.y / ZOOM + this.camY / ZOOM;
    const dx = wx - p.x, dy = wy - p.y;
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
    else p.dir = dy > 0 ? 'down' : 'up';
  }

  useSkill(i: number) {
    if (!this.player) return;
    const p = this.player;
    const disc = SKILLS[p.discipline];
    if (i < 0 || i >= disc.length) return;
    const sk = disc[i];
    if (p.cds[i] > 0) { this.toast(`${sk.name}: aún en recarga`, '#9aa0b8'); return; }
    if (p.res < sk.cost) { this.toast(`Resonancia insuficiente (${sk.cost})`, '#e88'); audio.sfx('error'); return; }
    p.res -= sk.cost;
    // 14-b (camino B del contrato skilltree.ts): el descuento del árbol se
    // aplica AL FIJAR (skillCdMult); el decaimiento extra por tick está OFF
    // (setSkillCdDecay(false)) para que NUNCA se descuente dos veces.
    p.cds[i] = sk.cd * skillCdMult(p);
    this.castSkill(sk.id, sk.element);
  }

  // R9-4 · pools de FX de hechizo (slots reescritos — cero alloc por frame).
  // El seed se fija UNA vez: las chispas del impacto quedan estables entre frames.
  private spellFxSlots(kind: 'cast' | 'impact'): SpellFxSlot[] {
    const arr = kind === 'cast' ? this.spellCastFx : this.spellImpactFx;
    if (arr.length === 0) {
      const n = kind === 'cast' ? 6 : 12;
      for (let i = 0; i < n; i++) arr.push({ active: false, x: 0, y: 0, element: 'fuego', age: 0, seed: 0, big: false });
    }
    return arr;
  }

  pushSpellCastFx(x: number, y: number, element: Element): void {
    const arr = this.spellFxSlots('cast');
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      if (!s.active) { s.active = true; s.x = x; s.y = y; s.element = element; s.age = 0; s.seed = (x * 3 + y * 5) | 0; s.big = false; return; }
    }
  }

  pushSpellImpactFx(x: number, y: number, element: Element, big: boolean): void {
    const arr = this.spellFxSlots('impact');
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      if (!s.active) { s.active = true; s.x = x; s.y = y; s.element = element; s.age = 0; s.seed = (x * 3 + y * 5) | 0; s.big = big; return; }
    }
  }

  castSkill(id: string, element: Element) {
    if (!this.player) return;
    const p = this.player;
    this.aimAtMouse();
    const wx = this.mouse.x / ZOOM + this.camX / ZOOM;
    const wy = this.mouse.y / ZOOM + this.camY / ZOOM;
    const dx = wx - p.x, dy = wy - p.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / len, ny = dy / len;
    // ==== 17-e (qa): Mente de Cristal aplica al hechizo BASE (ascuas,
    // escarcha, chispa, canto mayor) ====
    const spellDmg = (10 + p.attrs.int * 1.6 + p.level * 1) * skillDamageMult(this, 'hechizo');
    if (id !== 'grito' && element !== 'ninguno') this.lastNote = element;
    switch (id) {
      case 'tajo': {
        audio.sfx('dodge');
        const dash = 34;
        this.moveEntity(p, nx * dash, ny * dash);
        this.meleeHit(26, 22, playerMeleeDmg(p) * 1.6, 'ninguno', 90);
        this.burst(p.x + nx * 12, p.y + ny * 12, '#cdd3de', 8);
        break;
      }
      case 'grito':
        audio.sfx('holy');
        (p as Player & { buffT?: number }).buffT = 8;
        this.toast('Grito de Guerra: +50% de daño (8 s)', '#f0a050');
        this.burst(p.x, p.y - 6, '#f0a050', 14);
        break;
      case 'muro':
        audio.sfx('slam');
        this.aoeHit(p.x, p.y, 44, playerMeleeDmg(p) * 1.2, 'sagrado', true);
        this.waves.push({ x: p.x, y: p.y, r: 6, maxR: 46, speed: 120, dmg: 0, hit: true });
        break;
      case 'filo':
        audio.sfx('holy');
        for (let k = 0; k < 3; k++) {
          window.setTimeout(() => {
            if (this.state !== 'play' && this.state !== 'pause') return;
            this.aoeHit(p.x, p.y, 60, playerMeleeDmg(p) * 1.1, 'sagrado', false);
            this.waves.push({ x: p.x, y: p.y, r: 6, maxR: 64, speed: 160, dmg: 0, hit: true });
            audio.sfx('swing2');
          }, k * 180);
        }
        break;
      case 'ascuas':
        audio.sfx('fire');
        playSpellCast(); // R9-4/R9-8: carga visible + shimmer de casteo
        this.pushSpellCastFx(p.x + nx * 8, p.y - 6 + ny * 8, 'fuego');
        this.projectiles.push({ x: p.x + nx * 8, y: p.y - 6 + ny * 8, vx: nx * 150, vy: ny * 150, t: 1.6, dmg: spellDmg, element: 'fuego', from: 'player', sprite: 'p_fire', radius: 4, pierce: 0 });
        break;
      case 'escarcha':
        audio.sfx('ice');
        playSpellCast();
        this.pushSpellCastFx(p.x + nx * 8, p.y - 6 + ny * 8, 'hielo');
        this.projectiles.push({ x: p.x + nx * 8, y: p.y - 6 + ny * 8, vx: nx * 170, vy: ny * 170, t: 1.4, dmg: spellDmg * 0.9, element: 'hielo', from: 'player', sprite: 'p_ice', radius: 4, pierce: 0 });
        break;
      case 'chispa':
        audio.sfx('bolt');
        playSpellCast();
        this.pushSpellCastFx(p.x + nx * 8, p.y - 6, 'rayo');
        this.chainLightning(p.x, p.y - 6, spellDmg, 3, nx, ny);
        break;
      case 'cantomayor': {
        const el = this.lastNote === 'ninguno' ? 'fuego' : this.lastNote;
        audio.sfx(el === 'fuego' ? 'fire' : el === 'hielo' ? 'ice' : 'bolt');
        playSpellCast(); // R9-4/R9-8
        this.pushSpellCastFx(wx, wy, el); // el Canto Mayor carga en el objetivo
        const wx2 = wx, wy2 = wy;
        this.aoeHit(wx2, wy2, 52, spellDmg * 2.2, el, false);
        this.waves.push({ x: wx2, y: wy2, r: 4, maxR: 56, speed: 150, dmg: 0, hit: true });
        this.burst(wx2, wy2, el === 'fuego' ? '#ff9040' : el === 'hielo' ? '#a0e8ff' : '#ffe86a', 24, 90);
        this.shake = 5;
        break;
      }
    }
  }

  meleeHit(reach: number, width: number, dmg: number, element: Element, kb: number) {
    const p = this.player!;
    const dirs: Record<Dir, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = dirs[p.dir];
    const cx = p.x + dx * reach * 0.6, cy = p.y + dy * reach * 0.6;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - cx, e.y - cy) < reach + e.w / 2 + 4) {
        this.damageEnemy(e, dmg, element, kb, dx, dy);
      }
    }
    void width;
  }

  aoeHit(x: number, y: number, r: number, dmg: number, element: Element, stun: boolean) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) < r + e.w / 2) {
        this.damageEnemy(e, dmg, element, 60, Math.sign(e.x - x), Math.sign(e.y - y));
        if (stun) { e.ai = 'aturdido'; e.aiT = 1.5; }
      }
    }
  }

  chainLightning(x: number, y: number, dmg: number, jumps: number, nx: number, ny: number) {
    let cx = x + nx * 14, cy = y + ny * 14;
    const hitSet = new Set<Enemy>();
    for (let j = 0; j < jumps; j++) {
      let best: Enemy | null = null, bd = 90;
      for (const e of this.enemies) {
        if (e.dead || hitSet.has(e)) continue;
        const d = Math.hypot(e.x - cx, e.y - cy);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hitSet.add(best);
      this.damageEnemy(best, dmg * (1 - j * 0.2), 'rayo', 20, 0, 0);
      this.lightningFx(cx, cy, best.x, best.y);
      cx = best.x; cy = best.y;
    }
  }

  lightningFx(x0: number, y0: number, x1: number, y1: number) {
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.particles.push({
        x: x0 + (x1 - x0) * t + (Math.random() - 0.5) * 6,
        y: y0 + (y1 - y0) * t + (Math.random() - 0.5) * 6,
        vx: 0, vy: 0, t: 0.18, maxT: 0.18, color: '#ffe86a', size: 2, grav: 0,
      });
    }
  }

  damageEnemy(e: Enemy, dmg: number, element: Element, kb: number, kbx = 0, kby = 0) {
    if (e.invulT !== undefined && e.invulT > 0) {
      // fase intangible (espectro desvaneciéndose / sirena sumergida): el golpe atraviesa
      this.floatAt(e.x, e.y - 16, 'intangible', '#b8c8e0', 5);
      audio.sfx('wraith');
      return;
    }
    if (e.dead) return;
    const def = ENEMY_DEFS[e.etype];
    e.aggro = true;
    let final = dmg;
    let crit = false;
    const p = this.player!;
    if (Math.random() * 100 < critChance(p.attrs.des)) { final *= CRIT_MULT; crit = true; } // R8-7: menos críticos, más jugosos
    if (def.weakTo !== 'ninguno' && element === def.weakTo) final *= 1.5;
    if (e.ai === 'aturdido' && e.etype === 'guardian') final *= 1.5;
    final = Math.max(1, Math.round(final));
    e.hp -= final;
    e.hitFlash = 0.12;
    // quiebre
    if (e.maxSta > 0) {
      e.sta -= final * 1.1;
      if (e.sta <= 0 && e.ai !== 'aturdido') {
        e.sta = 0;
        e.ai = 'aturdido';
        e.aiT = 4;
        this.toast('¡QUEBRADO! El enemigo queda vulnerable', '#ffe86a');
        this.floatAt(e.x, e.y - 20, 'QUEBRADO', '#ffe86a', 7);
        playBossRoarVariant(e.etype.charCodeAt(0) * 7 + e.etype.length); // R9-8: variante determinista
      }
    }
    // estados
    // estados: se REFRESCAN en vez de apilarse sin tope (el quemado infinito
    // multiplicaba el DPS y trivializaba el quiebre del jefe)
    if (element === 'fuego') {
      const b = e.statuses.find(s => s.kind === 'quemado');
      if (b) { b.t = Math.min(6, b.t + 3); b.power = Math.min(8, b.power + 2); }
      else e.statuses.push({ kind: 'quemado', t: 3, power: 4 });
    }
    if (element === 'hielo') {
      const c = e.statuses.find(s => s.kind === 'congelado');
      if (c) c.t = Math.min(5, c.t + 2.5);
      else e.statuses.push({ kind: 'congelado', t: 2.5, power: 0.5 });
    }
    // reacciones elementales
    if (element === 'hielo' && e.statuses.some(s => s.kind === 'quemado' && s.t > 1)) {
      this.aoeHit(e.x, e.y, 30, 12, 'ninguno', false);
      this.floatAt(e.x, e.y - 16, 'VAPOR', '#d0f0f8', 6);
      this.burst(e.x, e.y - 6, '#d0f0f8', 12);
    }
    // knockback
    if (kb > 0) this.moveEntity(e, kbx * kb * 0.06, kby * kb * 0.06);
    // feedback
    this.floatAt(e.x + (Math.random() - 0.5) * 8, e.y - 14, `${final}`, crit ? '#ffd24a' : '#fff');
    if (crit) this.floatAt(e.x, e.y - 22, '¡CRÍTICO!', '#ffd24a', 6);
    this.burst(e.x, e.y - 4, crit ? '#ffd24a' : '#f0e8e0', crit ? 10 : 5);
    // Ronda 3: chispas direccionales del impacto + pitch que sube con el combo
    spawnHitSparks(this, e.x, e.y - 4, Math.atan2(kby, kbx) || Math.sign(e.y - p.y) * (Math.PI / 2), crit ? '#ffd24a' : '#fff0d8', crit ? 8 : 5);
    audio.sfx(crit ? 'crit' : 'hit', Math.min(1, 0.45 + comboPitch(this) * 0.55));
    this.hitStop = crit ? 0.09 : 0.04;
    // resonancia
    const espMult = 1 + p.attrs.esp * 0.1;
    p.res = Math.min(p.maxRes, p.res + 6 * espMult);
    if (e.hp <= 0) {
      // Ronda 3: remate sobre enemigo quebrado — luz + slowmo antes de morir
      if (e.ai === 'aturdido') { onFinisher(this, e); audio.sfx('finisher'); }
      this.killEnemy(e);
    }
  }

  killEnemy(e: Enemy) {
    // ==== 17-a (qa-combate) ==== guard anti-doble-muerte. El VAPOR (hielo
    // sobre quemado) recursa aoeHit→damageEnemy DENTRO del damageEnemy que
    // todavía está resolviendo el golpe original: si el daño de vapor mata,
    // killEnemy corre y el tramo final del golpe EXTERIOR volvía a llamarlo
    // (e.hp <= 0) → XP, oro, kills y restos otorgados DOS veces. Un solo pago.
    if (e.dead) return;
    e.dead = true;
    // ==== 16-b (interacción con todo): restos examinables con E + botín raro
    // de jefes (8% de +1 señuelo de caza) ====
    registerCorpse16b(this, e);
    bossSennoLoot16b(this, e);
    const def = ENEMY_DEFS[e.etype];
    const p = this.player!;
    p.kills++;
    const espMult = 1 + p.attrs.esp * 0.1;
    p.res = Math.min(p.maxRes, p.res + 10 * espMult);
    this.gainXp(Math.max(1, Math.round(def.xp * enemyStatMult(this).xp)));
    const gold = Math.round(def.gold[0] + Math.random() * (def.gold[1] - def.gold[0]));
    p.gold += gold;
    // ==== 16-c (logros-stats): combate acumulado + chequeo puntual de logros ====
    if (!this.challengeRun) {
      this.stats.enemigosDerrotados++;
      this.stats.coronasGanadas += gold;
      if (BOSS_DEFEAT_FLAG[e.etype] !== undefined) this.stats.jefesDerrotados++;
      achievementTick(this);
    }
    this.floatAt(e.x, e.y - 20, `+${gold} coronas`, '#f0c84a');
    this.burst(e.x, e.y - 4, e.etype === 'guardian' ? '#7ee8ff' : '#9ec4b4', e.etype === 'guardian' ? 40 : 14, e.etype === 'guardian' ? 120 : 60);
    // terror v2 (Ronda 2): el enemigo no explota alegre — se DESHACE en cenizas
    spawnDeathDissolve(this, e);
    // Ronda 3: sello de muerte (motas de oro + anillo) y sonido propio
    onKill(this, e);
    audio.sfx('kill');
    audio.sfx('enemyDie');
    // cuenta de lobos para la misión
    // R7-Q1 #2 (ALTA): en duelos de arena el clon del jefe NO escribe campaña
    // (flags de derrota, botín, misiones, música del mapa): el reto gestiona su
    // propio flujo y restoreCampaign restaura el estado al terminar. Antes,
    // matar al clon fijaba guardianDefeated/sirenaDefeated/... + questAdvance
    // + playTrack sobre la campaña viva → con un save en la ventana endBeat
    // (1,7 s) la cripta quedaba sin Guardián y q4 bloqueable.
    if (this.challengeRun && BOSS_DEFEAT_FLAG[e.etype] !== undefined) {
      this.bossActive = false;
      audio.setCombat(false);
      this.shake = 8;
      // ==== 17-a (qa): la pausa dramática del duelo arranca EN EL MISMO golpe
      // que cae al jefe (challengeTick solo corría en el update siguiente) ====
      if (this.challengeRun.bossEnemy === e) this.challengeRun.endBeat = 1.7;
      return;
    }
    if (e.etype === 'lobo' && !this.challengeRun && this.questIdx === 1 && this.questStep === 0) {
      const n = Number(this.flags.wolfKills ?? 0) + 1;
      this.flags.wolfKills = n;
      this.toast(`Lobo de Niebla cazado (${n}/3)`, '#8ef0b0');
      if (n >= 3) { this.questAdvance(); this.toast('Vuelve con la Anciana Brisa', '#8ef0b0'); }
    }
    if (e.etype === 'guardian') {
      this.flags.guardianDefeated = true;
      delete this.flags.bossHp;
      delete this.flags.bossHp_cripta;
      delete this.flags.bossHpWho_cripta; // R10: dueño de la memoria
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack('crypt');
      this.shake = 8;
      this.toast('El Guardián Hueco se deshace en notas de silencio...', '#7ee8ff');
      this.toast('El altar del Eco brilla al norte', '#ffe9a0');
      if (this.questIdx === 3 && this.questStep === 1) this.questAdvance();
    } else if (e.etype === 'sirena') {
      this.flags.sirenaDefeated = true;
      delete this.flags.bossHp_costa;
      delete this.flags.bossHpWho_costa; // R10
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack('costa');
      this.shake = 8;
      audio.sfx('song');
      this.toast('La Sirena Abisal se deshace en espuma que susurra un nombre...', '#8ef0ff');
      this.toast('El altar del naufragio brilla: el Eco de las Mareas es libre', '#ffe9a0');
      // 10-b (balance): botín garantizado de jefa (economía del Acto II)
      p.potions += 1;
      this.floatAt(e.x, e.y - 34, 'Botín del jefe: +1 poción', '#7ef0a0');
      if (this.questIdx === 6 && this.questStep === 1) this.questAdvance();
    } else if (e.etype === 'golem') {
      this.flags.golemDefeated = true;
      delete this.flags.bossHp_cumbres;
      delete this.flags.bossHpWho_cumbres; // R10
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack('cumbres');
      this.shake = 8;
      this.toast('El Gólem de Escarcha se aquieta: las cumbres recuerdan su canto', '#a8d8ff');
      this.toast('El altar del paso brilla: el Eco de las Cumbres es libre', '#ffe9a0');
      // 10-b (balance): botín garantizado del jefe (economía del Acto II)
      p.gold += 30;
      this.floatAt(e.x, e.y - 34, 'Botín del jefe: +30 coronas', '#f0c84a');
      if (this.questIdx === 8 && this.questStep === 1) this.questAdvance();
    } else if (e.etype === 'vult') {
      // 14-a: jefe opcional de caza (Cumbres de noche) — botín generoso
      this.flags.vultDefeated = true;
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack('cumbres');
      this.shake = 8;
      this.toast('Vult cae: su mapa se deshace y tus pasos vuelven a ser tuyos', '#c8b0e8');
      this.toast('El cartógrafo de la Liga descansará esta noche...', '#c8b0e8');
      p.potions += 1;
      p.gold += 40;
      this.floatAt(e.x, e.y - 34, 'Botín del jefe: +1 poción, +40 coronas', '#f0c84a');
    } else if (e.etype === 'coro') {
      // 14-a: jefe post-Acto III (Cripta) — cierre del contenido opcional
      this.flags.coroDefeated = true;
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack('crypt');
      this.shake = 8;
      audio.sfx('song');
      this.toast('Las tres máscaras caen a la vez: el Coro Roto por fin descansa', '#c8b0e8');
      this.toast('La Cripta respira. Fuera del tiempo, algo agradece tu canto', '#ffe9a0');
      p.potions += 1;
      p.gold += 60;
      this.floatAt(e.x, e.y - 34, 'Botín del jefe: +1 poción, +60 coronas', '#f0c84a');
    } else if (e.etype === 'heraldo') {
      // ==== 17-a (qa-combate) ==== VESH, la Última Nota (jefe final, 16-a):
      // killEnemy NO tenía rama y la derrota solo se detectaba en la SIGUIENTE
      // acción de diálogo (hooks.acto4CatchUp lee ACTO4_BOSS.ref). Consecuencias:
      // matar y caer antes de hablar dejaba la flag sin fijar (acto4_subir
      // re-invocable → doble XP/botín), bossActive/música de jefe colgados,
      // stats.jefesDerrotados sin contarle y SIN botín único garantizado
      // (todas las demás jefaturas lo sueltan). Rama propia al estilo coro;
      // el watcher de hooks queda como red idempotente (flag ya puesta → no-op).
      this.flags.heraldoDerrotado = true;
      delete this.flags.bossHp_cripta;
      delete this.flags.bossHpWho_cripta; // R10
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack('crypt');
      this.shake = 8;
      audio.sfx('song');
      this.toast('Vesh, la Última Nota, se aquietó: el coro entero respira', '#c8b0e8');
      // botín único del jefe final (escala con su rol de cierre)
      p.potions += 1;
      p.gold += 80;
      this.floatAt(e.x, e.y - 34, 'Botín del jefe: +1 poción, +80 coronas', '#f0c84a');
      if (this.questIdx === 14 && this.questStep === 1) this.questAdvance();
    } else if (e.etype === 'sepulcro') {
      // R10-9 · EL SEPULCRO (mini-jefe de la antesala): rama propia al estilo
      // coro — flag (no renace), música cripta restaurada, botín generoso.
      this.flags.sepulcroDerrotado = true;
      delete this.flags.bossHp_cripta;
      delete this.flags.bossHpWho_cripta;
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack('crypt');
      this.shake = 6;
      playDoorOpen();
      this.toast('El Sepulcro vuelve a descansar: el umbral es tuyo', '#b8a0f0');
      this.toast('El camino al sanctum del Guardián queda abierto', '#c8b0e8');
      // botín del mini-jefe (entre élite y jefatura, sin robar al Guardián)
      p.potions += 1;
      p.gold += 50;
      this.floatAt(e.x, e.y - 34, 'Botín del Guarda: +1 poción, +50 coronas', '#f0c84a');
    }
    // ==== 17-a (qa): el duelo entra en pausa dramática EN EL MISMO golpe que
    // cae al jefe — challengeTick solo corría en el update siguiente y el
    // endBeat no era observable de inmediato ====
    if (this.challengeRun && this.challengeRun.bossEnemy === e) this.challengeRun.endBeat = 1.7;
  }

  /**
   * R8-4.4 · XP por Eco de la historia (la progresión no se estanca): cada uno
   * de los 3 Ecos (Voz, Mareas, Cumbres) enseña +50% del xpNext del nivel
   * actual (banda 40-60% del encargo). gainXp gestiona los level-ups en cadena
   * (sus propios toasts/notify); aquí solo el float/toast del aprendizaje.
   * Fuera del modo desafío (los Ecos de historia no existen en la arena).
   */
  private grantEchoXp(): void {
    const p = this.player;
    if (!p || this.challengeRun) return;
    const xp = Math.round(this.xpNext(p.level) * 0.5);
    this.gainXp(xp);
    this.floatAt(p.x, p.y - 30, `El Eco te enseña: +${xp} XP`, '#ffe9a0', 8);
    this.toast(`El Eco te enseña: +${xp} XP`, '#ffe9a0');
  }

  gainXp(xp: number) {
    const p = this.player!;
    p.xp += xp;
    let next = this.xpNext(p.level);
    while (p.xp >= next) {
      p.xp -= next;
      p.level++;
      p.maxHp += 7;
      p.hp = p.maxHp;
      p.points += 3;
      notifyLevelUp(this); // Ronda 3: destello dorado + anillos en el HUD
      notifyStatPoint(this);
      audio.sfx('levelup');
      this.toast(`¡Nivel ${p.level}! +3 puntos de atributo (menú > Estado)`, '#ffe86a');
      this.burst(p.x, p.y - 8, '#ffe86a', 20, 70);
      next = this.xpNext(p.level);
    }
  }

  xpNext(level: number): number {
    return Math.round(36 * Math.pow(level, 1.45));
  }

  damagePlayer(dmg: number, fromX: number, fromY: number) {
    const p = this.player!;
    // balanceador (12-c): embudo único de todo el daño enemigo (neutro en desafío)
    dmg = Math.max(1, Math.round(dmg * enemyStatMult(this).dmg));
    if (p.iframes > 0 || p.rollT > 0 || this.state !== 'play') return;
    if (p.parryT > 0) {
      // ¡parada perfecta!
      audio.sfx('parry');
      p.res = Math.min(p.maxRes, p.res + 20);
      p.parryFx = 0.4;
      this.hitStop = 0.12;
      this.burst(p.x + (fromX - p.x) * 0.3, p.y - 8 + (fromY - p.y) * 0.3, '#fff8c0', 14, 100);
      this.floatAt(p.x, p.y - 22, '¡PARADA!', '#fff8c0', 7);
      // aturde al atacante cercano
      let best: Enemy | null = null, bd = 34;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) { best.ai = 'aturdido'; best.aiT = 1.6; best.windup = 0; }
      p.parryT = 0;
      return;
    }
    // 14-b: armadura activa — reduce DESPUÉS del balanceador y ANTES de la
    // Vigia (contrato armor.ts): dmg_final = max(1, round(bm·(1−red)·(1−vig)))
    const ared = armorReduction(this);
    const red = Math.min(0.5, p.attrs.vig * 0.01);
    const final = Math.max(1, Math.round(dmg * (1 - ared) * (1 - red)));
    // ==== 16-b: INTERPOSICIÓN — con la compañera en modo defensivo a <1.5
    // tiles, ella absorbe el 50% de este golpe melé (cooldown 6 s) ====
    const interposed16b = companionInterpose(this, final, fromX, fromY);
    p.hp -= final - interposed16b;
    p.iframes = 0.6;
    p.lastHitT = 0.3;
    // 14-b: Manto de Ecos — refleja 15% SOLO de contacto melé (el origen del
    // golpe coincide con el cuerpo de un enemigo); los proyectiles vuelan
    // desde lejos y NO reflejan (decisión documentada en armor.ts)
    const refl = armorActive(this)?.reflect;
    if (refl && final > 0) {
      const src = this.enemies.find(e => !e.dead
        && Math.abs(e.x - fromX) < e.w / 2 + 6 && Math.abs(e.y - fromY) < e.h / 2 + 8);
      if (src) {
        this.damageEnemy(src, Math.max(1, Math.round(final * refl)), 'ninguno', 0);
        this.burst(src.x, src.y - 6, '#ffe9a0', 8, 70);
      }
    }
    this.shake = 4;
    audio.sfx('hurt');
    this.floatAt(p.x, p.y - 16, `-${final}`, '#ff7060');
    const dx = p.x - fromX, dy = p.y - fromY;
    const l = Math.max(1, Math.hypot(dx, dy));
    this.moveEntity(p, (dx / l) * 8, (dy / l) * 8);
    if (p.hp <= 0) this.playerDied();
  }
}

// ---------------- utilidades de daño ----------------

export function playerMeleeDmg(p: Player): number {
  const base = p.discipline === 'alba' ? 12 : 8;
  const stat = p.discipline === 'alba' ? p.attrs.fue * 1.5 : p.attrs.int * 1.2;
  const buff = (p.buffT ?? 0) > 0 ? 1.5 : 1;
  return (base + stat + p.level * 1 + p.weaponPlus * 2.5) * buff;
}

export function playerSpellDmg(p: Player): number {
  return 10 + p.attrs.int * 1.6 + p.level;
}

export function initGame(canvas: HTMLCanvasElement): Game {
  return new Game(canvas);
}

// re-exportar helpers usados por update/render
export { MAPS, tileAt, getSpr, frameIndex, SKILLS, ENEMY_DEFS, QUESTS, DIALOGUES, audio, hash2, TILE };
