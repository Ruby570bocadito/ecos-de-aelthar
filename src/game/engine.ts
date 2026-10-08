// ============================================================
// ECOS DE AELTHAR — Motor principal
// Máquina de estados, bucle, input, mundo, diálogos, guardado
// ============================================================

import type {
  Player, Enemy, Npc, Companion, MapId, Epoch, Projectile, Particle, FloatText,
  Toast, Shockwave, TeleGraph, SaveData, DialogueNode, Dir, Element,
} from './types';
import { MAPS, mapRows, tileAt } from './maps';
import { SOLID_CHARS, TILE, initSprites, getSpr, frameIndex, drawTallTile, drawTile, hash2 } from './sprites';
import { audio } from './audio';
import { ENEMY_DEFS, SKILLS, DIALOGUES, QUESTS, getDialogue } from './data';
import { updateGame } from './update';
import { drawGame } from './render';
import { handleCustomAction, recordDialogueTone } from './hooks';

export const VIEW_W = 960, VIEW_H = 540;
export const ZOOM = 2;

export type GState = 'title' | 'controls' | 'intro' | 'play' | 'pause' | 'dialogue' | 'dead' | 'end';

export interface UiHit { x: number; y: number; w: number; h: number; cb: () => void; hover?: boolean }

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GState = 'title';
  onStateChange?: (s: GState) => void;
  onRequestCreate?: () => void;
  musicVolUi = 0.7;
  sfxVolUi = 0.8;

  requestCreate() {
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
  flags: Record<string, number | boolean> = {};
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

  // bucle
  private raf = 0;
  private lastTs = 0;
  private running = false;
  loopError: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    initSprites();
    this.bindInput();
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
    this.onStateChange?.(s);
    if (s === 'title') audio.playTrack('title');
  }

  update(dt: number) {
    updateGame(this, dt);
  }

  // ---------------- Ciclo de vida ----------------

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      try {
        let dt = Math.min(0.05, (ts - this.lastTs) / 1000);
        this.lastTs = ts;
        if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
        if (this.bossBannerT > 0) this.bossBannerT = Math.max(0, this.bossBannerT - dt);
        if (this.memoryReveal) { this.memoryReveal.t -= dt; if (this.memoryReveal.t <= 0) this.memoryReveal = null; }
        if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.12; }
        if (this.slowmoT > 0) { this.slowmoT -= dt; dt *= 0.35; }
        this.globalT += dt;
        if (this.state === 'play' || this.state === 'dialogue') this.update(dt);
        drawGame(this);
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
    this.openedChests = new Set();
    this.takenEchoes = new Set();
    this.deadGolds = [];
    this.companion = null;
    this.visitedMaps = { lunaris: true };
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
    this.player = {
      kind: 'player', name: p.name, discipline: p.discipline,
      x: d.x, y: d.y, w: 10, h: 8, vx: 0, vy: 0, dir: 'down',
      hp: Math.max(1, p.hp), maxHp, sprite: p.discipline === 'alba' ? 'hero_alba' : 'hero_tejedor',
      anim: 0, moving: false,
      level: p.level, xp: p.xp, sta: p.maxSta, maxSta: p.maxSta, res: p.res, maxRes: 100,
      attrs: { ...p.attrs }, points: p.points,
      gold: p.gold, weaponPlus: p.weaponPlus, potions: p.potions, cds: [0, 0, 0, 0],
      iframes: 0, parryT: 0, parryFx: 0, attackT: 0, combo: 0,
      chargeT: 0, charging: false, rollT: 0, lastHitT: 0,
      hasEcho: p.hasEcho, kills: p.kills, deaths: p.deaths,
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
    this.epoch = d.epoch === 'pasado' && p.hasEcho ? 'pasado' : 'presente';
    this.companion = d.companion ? this.makeCompanion() : null;
    this.visitedMaps = { lunaris: true };
    if (this.flags.visitedBosque) this.visitedMaps.bosque = true;
    if (this.flags.visitedCripta) this.visitedMaps.cripta = true;
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
    const p = this.player;
    const d: SaveData = {
      v: 1,
      player: {
        name: p.name, discipline: p.discipline, level: p.level, xp: p.xp,
        hp: p.hp, maxHp: p.maxHp, sta: p.sta, maxSta: p.maxSta, res: p.res,
        attrs: { ...p.attrs }, points: p.points,
        gold: p.gold, weaponPlus: p.weaponPlus, potions: p.potions,
        hasEcho: p.hasEcho, kills: p.kills, deaths: p.deaths,
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
      saveTime: Date.now(),
    };
    try { localStorage.setItem('ecos-aelthar-save', JSON.stringify(d)); } catch { /* noop */ }
  }

  // ---------------- Mapa ----------------

  loadMap(id: MapId, tx: number, ty: number) {
    // memoria del jefe: si sales de la cripta con el Guardián herido, no se
    // regenera al volver (cierra el exploit de reseteo de combate)
    if (this.mapId === 'cripta' && this.bossRef && !this.bossRef.dead && !this.flags.guardianDefeated) {
      this.flags.bossHp = this.bossRef.hp;
    }
    this.mapId = id;
    this.map = MAPS[id];
    this.rows = mapRows(this.map);
    this.buildGround();
    if (this.player) {
      // defensa anti-softlock: nunca aterrizar sobre un tile sólido ni dentro
      // de una zona de salida del destino (provocaba el bucle cripta↔bosque)
      const [sx, sy] = this.findSafeTile(tx, ty);
      this.player.x = sx * TILE + 8;
      this.player.y = sy * TILE + 8;
    }
    this.exitCd = 0.9;
    this.spawnEnemies();
    // restaura la vida memorizada del Guardián si la partida sigue en curso
    if (id === 'cripta' && !this.flags.guardianDefeated && typeof this.flags.bossHp === 'number') {
      const boss = this.enemies.find(e => e.etype === 'guardian');
      if (boss) boss.hp = Math.max(1, Math.min(boss.maxHp, this.flags.bossHp as number));
    }
    this.spawnNpcs();
    this.projectiles = []; this.waves = []; this.telegraphs = [];
    this.bossRef = null; this.bossActive = false;
    audio.setCombat(false);
    this.visitedMaps[id] = true;
    if (id === 'bosque' && !this.flags.visitedBosque) {
      this.flags.visitedBosque = true;
      if (this.questIdx === 2 && this.questStep === 0) this.questAdvance();
    }
    if (id === 'cripta' && !this.flags.visitedCripta) {
      this.flags.visitedCripta = true;
      if (this.questIdx === 3 && this.questStep === 0) this.questAdvance();
    }
    this.mapTitleT = 2.6;
    this.updateCamera(true);
  }

  buildGround() {
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
          drawTile(x, ch, tx, ty, this.mapId, 0);
        }
      }
      // objetos altos por orden de fila
      for (let ty = 0; ty < h; ty++) {
        for (let tx = 0; tx < w; tx++) {
          const ch = tileAt(this.map, this.rows, tx, ty, ep);
          if (SOLID_CHARS.has(ch) && (ch === 't' || ch === 'p')) drawTallTile(x, ch, tx, ty, this.mapId);
        }
      }
      return c;
    };
    this.groundCanvas = mk('presente');
    this.groundPastCanvas = this.map.epochDiffs.length ? mk('pasado') : this.groundCanvas;
    // minimapa
    const mini = document.createElement('canvas');
    mini.width = w; mini.height = h;
    const mx = mini.getContext('2d')!;
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const ch = tileAt(this.map, this.rows, tx, ty, 'presente');
        mx.fillStyle =
          ch === '~' ? '#3a6a9a' : ch === '=' ? '#b89a6a' :
          ch === ':' ? '#6a6a7a' : ch === 't' || ch === 'p' ? '#24512a' :
          ch === '#' || ch === 'H' || ch === 'r' ? '#7a7a8a' :
          ch === 'n' ? '#7ea49a' : '#4a8a44';
        mx.fillRect(tx, ty, 1, 1);
      }
    }
    this.miniCanvas = mini;
  }

  spawnEnemies() {
    this.enemies = [];
    for (const s of this.map.spawns) {
      if (s.type === 'guardian' && this.flags.guardianDefeated) continue;
      this.enemies.push(this.makeEnemy(s.type, s.x * TILE + 8, s.y * TILE + 8, s.patrol ?? 2, s.zone));
    }
  }

  makeEnemy(type: Enemy['etype'], x: number, y: number, patrol: number, zone?: string): Enemy {
    const d = ENEMY_DEFS[type];
    return {
      kind: 'enemy', etype: type, x, y, w: type === 'guardian' ? 22 : 12, h: type === 'guardian' ? 16 : 10,
      vx: 0, vy: 0, dir: 'down', hp: d.hp, maxHp: d.hp, sprite: d.sprite, anim: Math.random() * 9, moving: false,
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

  tileSolidAt(px: number, py: number): boolean {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    const ch = tileAt(this.map, this.rows, tx, ty, this.epoch);
    return SOLID_CHARS.has(ch);
  }

  /** ¿(tx,ty) está dentro de alguna zona de salida del mapa actual? */
  private inExitZone(tx: number, ty: number): boolean {
    return this.map.exits.some(ex => {
      if (ex.needPast && this.epoch !== 'pasado') return false;
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
    return !(this.tileSolidAt(x0, y0) || this.tileSolidAt(x1, y0) || this.tileSolidAt(x0, y1) || this.tileSolidAt(x1, y1));
  }

  moveEntity(e: { x: number; y: number; w: number; h: number }, dx: number, dy: number) {
    if (dx !== 0 && this.boxFree(e.x + dx, e.y, e.w, e.h)) e.x += dx;
    if (dy !== 0 && this.boxFree(e.x, e.y + dy, e.w, e.h)) e.y += dy;
  }

  updateCamera(snap = false) {
    if (!this.player) return;
    const targetX = this.player.x * ZOOM - VIEW_W / 2;
    const targetY = this.player.y * ZOOM - VIEW_H / 2;
    const maxX = this.map.w * TILE * ZOOM - VIEW_W;
    const maxY = this.map.h * TILE * ZOOM - VIEW_H;
    const cx = Math.max(0, Math.min(maxX, targetX));
    const cy = Math.max(0, Math.min(maxY, targetY));
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
    this.epoch = this.epoch === 'presente' ? 'pasado' : 'presente';
    this.epochFx = 0.8;
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
      consider(ch.x * TILE + 8, ch.y * TILE + 8, 'chest', 'Abrir cofre', () => this.openChest(ch.id), 26);
    }
    for (const pr of this.map.props) {
      if (pr.needPast && this.epoch !== 'pasado') continue;
      if (pr.needPresent && this.epoch !== 'presente') continue;
      const px = pr.x * TILE + 8, py = pr.y * TILE + 8;
      if (pr.kind === 'sanctuary') consider(px, py, 'sanc', 'Santuario del Eco', () => this.openSanctuary(), 26);
      else if (pr.kind === 'forge') consider(px, py, 'forge', 'Forja de Toln', () => this.talkTo('toln'), 28);
      else if (pr.kind === 'fragment') consider(px, py, 'frag', 'Fragmento de Eco', () => this.openDialogue('voz_fragment'), 30);
      else if (pr.kind === 'altarEcho') consider(px, py, 'altar', 'Altar del Eco', () => this.tryTakeEco(), 30);
      else if (pr.kind === 'sign') consider(px, py, 'sign', 'Leer cartel', () => this.readSign(pr.label ?? ''), 28);
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
    if (ch.gold) { this.player!.gold += ch.gold; parts.push(`${ch.gold} coronas`); this.floatAt(ch.x * TILE + 8, ch.y * TILE, `+${ch.gold}`, '#f0c84a'); }
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

  tryTakeEco() {
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
    const key = getDialogue(nid, { questIdx: this.questIdx, questStep: this.questStep, flags: this.flags, companion: !!this.companion });
    this.openDialogue(key);
  }

  // ---------------- Diálogo ----------------

  openDialogue(key: string) {
    this.dlgKey = key;
    this.dlgNode = this.dynNodes[key] ?? DIALOGUES[key] ?? null;
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
      case action === 'fragment_touched':
        this.flags.fragmentTouched = true;
        p.hasEcho = true;
        audio.sfx('echo');
        this.burst(p.x, p.y - 8, '#ffe9a0', 24, 80);
        if (this.questIdx === 2) this.questAdvance();
        this.toast('Resonancia despierta: pulsa Q para alternar entre presente y pasado', '#ffe9a0');
        break;
      case action === 'eco_taken':
        this.flags.ecoVoz = true;
        p.points += 1; p.repGuardianes += 10;
        p.hp = p.maxHp;
        if (this.questIdx === 3 && this.questStep === 2) this.questAdvance();
        this.toast('Eco de la Voz recuperado: +1 punto de habilidad, +10 reputación', '#ffe9a0');
        break;
      case action === 'fragment':
        break;
      case action === 'forge': {
        const cost = 30 + p.weaponPlus * 25;
        if (p.weaponPlus >= 5) { this.toast('Toln: «+5 es lo que da de sí esta forja, Portador.»', '#e8a'); audio.sfx('error'); }
        else if (p.gold >= cost) {
          p.gold -= cost; p.weaponPlus++;
          audio.sfx('confirm');
          this.toast(`Arma mejorada a +${p.weaponPlus} (${cost} coronas)`, '#f0c84a');
        } else { this.toast(`Te faltan coronas (${cost} necesarias)`, '#e88'); audio.sfx('error'); }
        break;
      }
      case action === 'buy_potion':
        if (p.gold >= 15) { p.gold -= 15; p.potions++; audio.sfx('coin'); this.toast('Poción comprada (15 coronas)', '#f0c84a'); }
        else { this.toast('Te faltan coronas', '#e88'); audio.sfx('error'); }
        break;
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
    if (id === 'lunaris') return [25, 19];
    if (id === 'bosque') return [38, 27];
    return [19, 24];
  }

  questAdvance() {
    if (this.questStep < QUESTS[this.questIdx].steps.length - 1) {
      this.questStep++;
    } else {
      this.questIdx = Math.min(QUESTS.length - 1, this.questIdx + 1);
      this.questStep = 0;
      if (this.questIdx === 4) this.toast('Nueva misión: Ecos de Esperanza', '#8ef0b0');
    }
    audio.sfx('quest');
  }

  questProgressText(): string | null {
    if (this.questIdx === 1 && this.questStep === 0) {
      const n = Number(this.flags.wolfKills ?? 0);
      return `Caza 3 Lobos de Niebla en el sur del valle (${n}/3)`;
    }
    return null;
  }

  fadeTo(to: MapId, tx: number, ty: number) {
    this.pendingMap = { to, tx, ty };
    this.fadeDir = 1;
  }

  // ---------------- Mensajes ----------------

  toast(text: string, color?: string) {
    this.toasts.push({ text, t: 3.4, color });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  floatAt(x: number, y: number, text: string, color: string, size = 8) {
    this.floats.push({ x, y, text, t: 0.9, color, vy: -26, size });
  }

  burst(x: number, y: number, color: string, n: number, spd = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0.5 + Math.random() * 0.4, maxT: 0.9, color, size: 1 + Math.random() * 2, grav: 90 });
    }
  }

  // ---------------- Muerte ----------------

  playerDied() {
    const p = this.player!;
    p.deaths++;
    const lost = Math.floor(p.gold / 2);
    this.lastGoldLost = lost;
    if (lost > 0) {
      p.gold -= lost;
      this.deadGolds.push({ map: this.mapId, x: p.x, y: p.y, amount: lost });
    }
    audio.sfx('die');
    this.setState('dead');
  }

  respawn() {
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
    document.removeEventListener('visibilitychange', this.onLoseFocus);
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
      else if (['1', '2', '3', '4'].includes(k)) this.useSkill(parseInt(k, 10) - 1);
    } else if (this.state === 'pause') {
      if (k === 'escape' || k === 'm') this.setState('play');
    } else if (this.state === 'dead') {
      if (k === 'e' || k === 'enter') this.respawn();
    } else if (this.state === 'end') {
      if (k === 'enter' || k === 'e') this.setState('title');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
    if (this.player && e.key.toLowerCase() === 'j' && this.player.charging) {
      this.releaseCharge();
    }
  };

  private canvasPos(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (VIEW_W / r.width), y: (e.clientY - r.top) * (VIEW_H / r.height) };
  }

  private onMouseMove = (e: MouseEvent) => {
    const p = this.canvasPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
  };

  private onMouseDown = (e: MouseEvent) => {
    audio.resume();
    const p = this.canvasPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
    // UI hits primero
    for (const h of this.uiHit) {
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
    if (e.button === 0) {
      this.mouse.down = false;
      if (this.player?.charging) this.releaseCharge();
    }
    if (e.button === 2) this.mouse.rdown = false;
  };

  tryInteract() {
    const it = this.nearestInteract();
    if (it) { audio.sfx('select'); it.act(); }
    else this.toast('No hay nada que interactuar aquí.', '#9aa0b8');
  }

  drinkPotion() {
    if (!this.player) return;
    const p = this.player;
    if (p.potions <= 0) { this.toast('No te quedan pociones', '#e88'); audio.sfx('error'); return; }
    if (p.hp >= p.maxHp) { this.toast('Vida al máximo', '#9aa0b8'); return; }
    p.potions--;
    const heal = Math.round(p.maxHp * 0.4);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    audio.sfx('potion');
    this.floatAt(p.x, p.y - 14, `+${heal}`, '#7ef0a0');
    this.burst(p.x, p.y - 6, '#7ef0a0', 8, 30);
  }

  startAttack() {
    if (!this.player) return;
    const p = this.player;
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
    // daño del golpe
    const comboMult = [1, 1.12, 1.28][p.combo];
    const dmg = playerMeleeDmg(p) * comboMult * (charged ? 2.1 : 1);
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
    p.cds[i] = sk.cd;
    this.castSkill(sk.id, sk.element);
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
    const spellDmg = 10 + p.attrs.int * 1.6 + p.level * 1;
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
        this.projectiles.push({ x: p.x + nx * 8, y: p.y - 6 + ny * 8, vx: nx * 150, vy: ny * 150, t: 1.6, dmg: spellDmg, element: 'fuego', from: 'player', sprite: 'p_fire', radius: 4, pierce: 0 });
        break;
      case 'escarcha':
        audio.sfx('ice');
        this.projectiles.push({ x: p.x + nx * 8, y: p.y - 6 + ny * 8, vx: nx * 170, vy: ny * 170, t: 1.4, dmg: spellDmg * 0.9, element: 'hielo', from: 'player', sprite: 'p_ice', radius: 4, pierce: 0 });
        break;
      case 'chispa':
        audio.sfx('bolt');
        this.chainLightning(p.x, p.y - 6, spellDmg, 3, nx, ny);
        break;
      case 'cantomayor': {
        const el = this.lastNote === 'ninguno' ? 'fuego' : this.lastNote;
        audio.sfx(el === 'fuego' ? 'fire' : el === 'hielo' ? 'ice' : 'bolt');
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
    if (e.dead) return;
    const def = ENEMY_DEFS[e.etype];
    e.aggro = true;
    let final = dmg;
    let crit = false;
    const p = this.player!;
    if (Math.random() * 100 < Math.min(40, 5 + p.attrs.des * 2)) { final *= 2; crit = true; }
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
        audio.sfx('roar');
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
    audio.sfx(crit ? 'crit' : 'hit');
    this.hitStop = crit ? 0.09 : 0.04;
    // resonancia
    const espMult = 1 + p.attrs.esp * 0.1;
    p.res = Math.min(p.maxRes, p.res + 6 * espMult);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy) {
    e.dead = true;
    const def = ENEMY_DEFS[e.etype];
    const p = this.player!;
    p.kills++;
    const espMult = 1 + p.attrs.esp * 0.1;
    p.res = Math.min(p.maxRes, p.res + 10 * espMult);
    this.gainXp(def.xp);
    const gold = Math.round(def.gold[0] + Math.random() * (def.gold[1] - def.gold[0]));
    p.gold += gold;
    this.floatAt(e.x, e.y - 20, `+${gold} coronas`, '#f0c84a');
    this.burst(e.x, e.y - 4, e.etype === 'guardian' ? '#7ee8ff' : '#9ec4b4', e.etype === 'guardian' ? 40 : 14, e.etype === 'guardian' ? 120 : 60);
    audio.sfx('enemyDie');
    // cuenta de lobos para la misión
    if (e.etype === 'lobo' && this.questIdx === 1 && this.questStep === 0) {
      const n = Number(this.flags.wolfKills ?? 0) + 1;
      this.flags.wolfKills = n;
      this.toast(`Lobo de Niebla cazado (${n}/3)`, '#8ef0b0');
      if (n >= 3) { this.questAdvance(); this.toast('Vuelve con la Anciana Brisa', '#8ef0b0'); }
    }
    if (e.etype === 'guardian') {
      this.flags.guardianDefeated = true;
      delete this.flags.bossHp;
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack('crypt');
      this.shake = 8;
      this.toast('El Guardián Hueco se deshace en notas de silencio...', '#7ee8ff');
      this.toast('El altar del Eco brilla al norte', '#ffe9a0');
      if (this.questIdx === 3 && this.questStep === 1) this.questAdvance();
    }
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
    const red = Math.min(0.5, p.attrs.vig * 0.01);
    const final = Math.max(1, Math.round(dmg * (1 - red)));
    p.hp -= final;
    p.iframes = 0.6;
    p.lastHitT = 0.3;
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
