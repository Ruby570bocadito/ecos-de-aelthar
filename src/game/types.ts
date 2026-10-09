// ============================================================
// ECOS DE AELTHAR — Demo (vertical slice)
// Tipos compartidos del motor
// ============================================================

export type Dir = 'down' | 'up' | 'left' | 'right';
export interface Vec { x: number; y: number }

export type MapId = 'lunaris' | 'bosque' | 'cripta' | 'costa' | 'aldea' | 'cumbres';
export type Epoch = 'presente' | 'pasado';
export type TrackName = 'village' | 'forest' | 'crypt' | 'boss' | 'title' | 'costa' | 'aldea' | 'cumbres';

export type EnemyType = 'lobo' | 'esqueleto' | 'sombra' | 'guardian' | 'neumo' | 'espectro' | 'arpi' | 'sirena' | 'golem' | 'vult' | 'coro' | 'ecodesg' | 'satiro' | 'heraldo' | 'sepulcro' | 'nodriza' | 'cazador' | 'espantapajaros' | 'coro_mini' | 'centinela' | 'ahogado_r11'; // 16-a: jefe final del Acto IV · R10-9: mini-jefe de la cripta · R11-1/2: 5 mini-jefes de expansión + esbirro de la Nodriza
export type Element = 'fuego' | 'hielo' | 'rayo' | 'sombra' | 'sagrado' | 'ninguno';
export type StatusKind = 'quemado' | 'congelado' | 'aturdido' | 'marcado';

// Tono de diálogo del Portador (biblia: personalidad moldeable)
export type ToneKind = 'empatico' | 'pragmatico' | 'sarcastico' | 'amenazante';

export interface StatusFx {
  kind: StatusKind;
  t: number;      // tiempo restante
  power: number;  // dps o intensidad
}

export interface EpochDiff { x: number; y: number; char: string }

export interface SpawnDef {
  type: EnemyType;
  x: number; y: number;      // en tiles
  patrol?: number;           // radio de patrulla en tiles
  zone?: string;             // 'valle' | 'bosque' | 'cripta' | 'boss' | 'costa' | 'aldea' | 'cumbres'
  needPast?: boolean;        // solo aparece en el pasado
  needPresent?: boolean;     // solo aparece en el presente
}

export interface NpcDef {
  id: string;                 // 'brisa' | 'toln' | 'ilwen' | 'vesh_voz'
  x: number; y: number;
  sprite: string;
  name: string;
  hideFlag?: string;          // no aparece si la bandera está activa
  showFlag?: string;          // solo aparece si la bandera está activa
}

export interface ChestDef {
  id: string; x: number; y: number;
  gold?: number; potions?: number; item?: string;   // item: id de objeto clave
  needPast?: boolean;         // el cofre solo existe en el pasado
}

export interface EchoDef {
  id: string; x: number; y: number;
  title: string; text: string;
}

export interface ExitDef {
  x: number; y: number; w: number; h: number;   // en tiles
  to: MapId; tx: number; ty: number;
  needPast?: boolean;          // solo transitable en el pasado
  label?: string;
}

export type PropKind = 'sanctuary' | 'forge' | 'fragment' | 'altarEcho' | 'sign' | 'gate' | 'wreck' | 'faro' | 'lamp' | 'plaque' | 'remains' | 'altarMinor' | 'woodsign' | 'waypost'; // R10-6: lore en el mundo

export interface PropDef {
  id: string; kind: PropKind; x: number; y: number;
  label?: string;
  needPast?: boolean;          // solo existe en el pasado
  needPresent?: boolean;       // solo existe en el presente
}

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  w: number; h: number;
  rows: string[];
  epochDiffs: EpochDiff[];
  dark?: boolean;
  music: TrackName;
  npcs: NpcDef[];
  chests: ChestDef[];
  echoes: EchoDef[];
  spawns: SpawnDef[];
  exits: ExitDef[];
  props: PropDef[];
}

// ---------- Combate ----------

export type EnemyAIState = 'patrulla' | 'alerta' | 'persigue' | 'carga' | 'ataca' | 'recupera' | 'huye' | 'aturdido' | 'muerto';

/** 16-b (interacción-compañeros): órdenes tácticas del compañero (tecla T). */
export type CompMode = 'seguir' | 'agresivo' | 'defensivo';

export interface Entity {
  kind: 'player' | 'enemy' | 'npc' | 'companion';
  x: number; y: number;         // px en mundo
  w: number; h: number;         // hitbox (px, 16-base)
  vx: number; vy: number;
  dir: Dir;
  hp: number; maxHp: number;
  sprite: string;
  anim: number;                 // fase de animación
  moving: boolean;
  dead?: boolean;
  kbVx?: number; kbVy?: number; // knockback suave (se aplica y decae en update)
}

export interface Enemy extends Entity {
  kind: 'enemy';
  etype: EnemyType;
  ai: EnemyAIState;
  aiT: number;                  // timer de estado
  homeX: number; homeY: number;
  patrolAngle: number;
  aggro: boolean;
  windup: number;               // >0 telegrafiando
  atkCd: number;
  sta: number;                  // barra de quiebre (jefe/élites)
  maxSta: number;
  statuses: StatusFx[];
  slowT: number;
  phase: number;
  sumT: number;
  hitFlash: number;
  telegraphKind?: 'slam' | 'onda' | 'aro' | 'salva' | 'ventisca';
  spawnGuard?: number;          // no aggro al inicio
  marked?: number;              // >0: marcado por Ilwen (flechas focalizadas + daño extra)
  subT?: number;                // timer auxiliar para cerebros de IA nuevos
  invulT?: number;              // >0: invulnerable (fase espectral de espectro/sirena)
  lured?: number;               // 16-b: >0 — atraído por un señuelo (segundos restantes)
  slideSide?: number;           // R8-1.2: lado memorizado del deslizamiento anti-obstáculo (-1|1)
  slideT?: number;              // R8-1.2: s restantes del intento de deslizamiento (histéresis anti-vibración)
  sumFase2?: boolean;           // R8-1.5: invocación de sombras de fase 2 ya realizada (1× por vida del jefe)
}

export interface Companion extends Entity {
  kind: 'companion';
  cname: string;
  atkCd: number;
  downT: number;
  affinity: number;
  mode?: CompMode;              // 16-b: orden táctica activa (default 'seguir'; serializada en save)
}

export interface Npc extends Entity {
  kind: 'npc';
  nid: string;
  dispName: string;
}

export interface Player extends Entity {
  kind: 'player';
  name: string;
  discipline: 'alba' | 'tejedor';
  level: number; xp: number;
  sta: number; maxSta: number;
  res: number; maxRes: number;
  attrs: { fue: number; des: number; int: number; esp: number; vig: number };
  points: number;
  gold: number;
  weaponPlus: number;
  potions: number;
  cds: number[];                // cooldowns de habilidades
  iframes: number;
  parryT: number;               // ventana de parada activa
  parryFx: number;
  attackT: number;              // >0 en ataque (combo)
  combo: number;
  comboT?: number;              // ventana restante para encadenar combo
  tones?: Record<ToneKind, number>;          // contadores de tono (biblia)
  memories?: string[];                       // ids de memorias recuperadas por Eco
  repFacciones?: Record<string, number>;     // guardianes | orden | circulo | liga
  chargeT: number;              // carga de ataque
  charging: boolean;
  chargedHit?: boolean;
  buffT?: number;               // Grito de Guerra activo
  rollT: number;
  lastHitT: number;
  hasEcho: boolean;             // cambio de época desbloqueado
  kills: number;
  deaths: number;
  repGuardianes: number;
  playTime: number;
}

// ---------- Misiones / diálogo ----------

export interface QuestDef {
  id: string; name: string; steps: string[];
}

export interface DialogueOption {
  text: string;
  next?: string;
  action?: string;   // 'accept_q2' | 'forge' | 'recruit_ilwen' | ...
  tone?: ToneKind;   // tono de la respuesta (define el rasgo dominante)
}

export interface DialogueNode {
  name: string;
  portrait: string;
  text: string;
  options?: DialogueOption[];
  next?: string;
  action?: string;
  onEnd?: string;    // acción al cerrar
}

// ---------- Guardado ----------

// 16-c (logros-stats): estadísticas acumuladas de la partida. Opcional en el
// guardado para mantener compatibilidad con saves antiguos (defaults seguros).
export interface StatsData {
  enemigosDerrotados: number;
  jefesDerrotados: number;
  muertes: number;
  coronasGanadas: number;
  coronasGastadas: number;
  pocionesUsadas: number;
  vecesCambioEpoca: number;
  distanciaAndada: number;   // px aplicados (se muestra ≈ tiles: px/TILE)
  tiempoJugado: number;      // segundos en estado play/dialogue
  memoriasHalladas: number;
}

export interface SaveData {
  v: number;
  player: {
    name: string; discipline: 'alba' | 'tejedor';
    level: number; xp: number;
    hp: number; maxHp: number; sta: number; maxSta: number; res: number;
    attrs: Player['attrs']; points: number;
    gold: number; weaponPlus: number; potions: number;
    hasEcho: boolean; kills: number; deaths: number; repGuardianes: number; playTime: number;
    tones?: Record<ToneKind, number>;
    memories?: string[];
    repFacciones?: Record<string, number>;
  };
  map: MapId;
  x: number; y: number;
  epoch: Epoch;
  flags: Record<string, number | boolean | string>;
  questIdx: number; questStep: number;
  openedChests: string[];
  takenEchoes: string[];
  deadGolds: { map: MapId; x: number; y: number; amount: number }[];
  companion: boolean;
  companionMode?: CompMode;  // 16-b: orden táctica del compañero (opcional: saves viejos = 'seguir')
  saveTime: number;
  stats?: StatsData;         // 16-c: ausente en saves antiguos → defaults
}

export interface Toast { text: string; t: number; color?: string }
export interface FloatText { x: number; y: number; text: string; t: number; color: string; vy: number; size: number }
export interface Particle { x: number; y: number; vx: number; vy: number; t: number; maxT: number; color: string; size: number; grav: number }
export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  t: number; dmg: number; element: Element;
  from: 'player' | 'enemy' | 'companion';
  sprite: string; radius: number; pierce: number;
}
export interface Shockwave { x: number; y: number; r: number; maxR: number; speed: number; dmg: number; hit: boolean }
export interface TeleGraph { x: number; y: number; r: number; t: number; maxT: number; dmg: number; kind: 'slam' | 'aro' }

// R9-4 · MAGIAS ESPECTACULARES: ranura de FX de hechizo (carga visible /
// impacto + residuo). Pools FIJOS del motor (slots reescritos — cero alloc
// por frame); el seed se fija UNA vez para que las chispas sean estables.
export interface SpellFxSlot {
  active: boolean;
  x: number; y: number;
  element: Element;
  age: number;
  seed: number;
  big: boolean;
}
