// ============================================================
// ECOS DE AELTHAR — dread (R2-A5 · capa de PAVOR)
// Capa de audio de terror PROCEDURAL que convive POR ENCIMA de
// la música chiptune de audio.ts (NO la reemplaza, NO la toca):
//
//   a. DRONE disonante .... 2 pares de sierras detuned sembradas
//                           en tritono (110 Hz + 155.6 Hz) con
//                           lowpass que respira lento.
//   b. SUB-RUMBLE ......... seno 40 Hz con LFO de amplitud 0.1 Hz
//                           (latido lejano) + armónico 80 Hz para
//                           altavoces que no reproducen graves.
//   c. SUSURRO ............ ruido blanco en bucle → bandpass Q7
//                           modulado por 2 LFOs inconmensurables
//                           (deriva pseudo-aleatoria lenta), gain
//                           MUY bajo (0.02–0.05).
//   d. STINGERS ........... dreadStinger('boss'|'susto'|'muerte').
//
// CONTEXTO DEL JUEGO (deducido del motor, no lo modifica):
//   g.mapId ∈ lunaris|bosque|cripta · g.epoch ∈ presente|pasado
//   g.bossActive (update.ts:262 dispara el jefe) · g.dayT 0..1
//   noche = dayT>0.7 || dayT<0.08 (espejo de isNight(), update.ts:679)
//
// AUDIOCONTEXT: reutiliza el del juego leyendo `audio.ctx`
// (propiedad PÚBLICA de AudioEngine en audio.ts — solo lectura,
// el archivo audio.ts no se toca). Si aún no existe, crea el suyo
// propio (dread.ownCtx=true) y lo resume en init(). Ambos caminos
// suenan bien: la mezcla la hace el hardware/OS.
//
// VOLÚMENES CONSERVADORES: el bus master de dread queda limitado a
// 0.25 × musicVol (≤ 0.25 del volumen de la música) + compresor
// anti-saturación. Nada de clipping: picos internos < 1.
//
// INTEGRACIÓN (la conecta el integrador; aquí no se toca update.ts):
//   dreadInit()              → perezosa (updateDread la llama sola);
//                              ideal llamarla junto a audio.resume()
//                              en la primera interacción del usuario.
//   updateDread(g, dt, tension?) → 1× por frame en el bucle (update.ts);
//                              `tension` (R6-V5) es OPCIONAL: lowHp/aggroCount
//                              para tensión extra; si falta, se deriva de g.
//   dreadStinger('boss')     → cuando bossActive pasa a true (junto a
//                              audio.playTrack('boss') en update.ts).
//   dreadStinger('susto')    → emboscadas / aparición de sombras.
//   dreadStinger('muerte')   → muerte del jugador (junto a 'die').
//   setDreadEnabled(false)   → accesibilidad (opciones).
//   setDreadLevel(0..1)      → nivel manual (anula el automático;
//                              setDreadAuto() devuelve el control).
//   dreadDispose()           → teardown (HMR / salir del juego).
//
// NUNCA toca nodos de audio.ts (master/musicGain/sfxGain): solo
// crea su propia cadena y conecta a ctx.destination.
// ============================================================

import type { Game } from '../engine';
import { audio } from '../audio';

// ---------------- Constantes de diseño ----------------

const NIGHT_START = 0.7;         // espejo de isNight() en update.ts
const NIGHT_END = 0.08;
const DREAD_CAP = 0.25;          // techo absoluto: master ≤ 0.25 × musicVol
const DRONE_MAX = 0.6;           // ganancia máx. del drone (pre-master)
const RUMBLE_MAX = 0.7;          // ganancia máx. del sub-rumble
const WHISPER_MAX = 0.05;        // susurro MUY bajo (0.02–0.05 exigido)
const STINGER_GAIN = 0.5;        // bus de stingers (accidentales, no loop)

// ---------------- Estado del módulo ----------------

export const dread = {
  // contexto y bus (perezosos; null hasta dreadInit())
  ctx: null as AudioContext | null,
  master: null as GainNode | null,          // bus de capas (cap 0.25×musicVol)
  droneGain: null as GainNode | null,
  rumbleGain: null as GainNode | null,
  whisperGain: null as GainNode | null,
  stingerGate: null as GainNode | null,     // 1 = activo, 0 = accesibilidad
  limiter: null as DynamicsCompressorNode | null,
  ownCtx: false,                            // true = creamos nuestro AudioContext
  ready: false,
  enabled: true,                            // accesibilidad
  level: 0,                                 // nivel actual suavizado 0..1
  manual: false,                            // setDreadLevel fijó nivel manual
  manualLevel: 0,
};

// fuentes vivas para poder pararlas en dispose()
const liveSources: AudioScheduledSourceNode[] = [];
let lastApplied = -1;   // último nivel aplicado a los AudioParams (anti-spam)

// ---------------- Utilidades ----------------

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Techo real del bus: 0.25 × volumen de música (sigue a los sliders). */
function masterCap(): number {
  const mv = typeof audio.musicVol === 'number' ? clamp01(audio.musicVol) : 0.7;
  return DREAD_CAP * mv;
}

// ---------------- Inicialización perezosa ----------------

/** Crea el grafo WebAudio una sola vez. Reutiliza audio.ctx si existe. */
export function dreadInit(): void {
  if (dread.ready) return;
  if (typeof window === 'undefined') return; // SSR: sin audio

  // 1) contexto: el del juego si ya existe, si no uno propio
  if (audio.ctx) {
    dread.ctx = audio.ctx;
    dread.ownCtx = false;
  } else {
    const AC: typeof AudioContext | undefined =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!AC) return;
    dread.ctx = new AC();
    dread.ownCtx = true;
  }
  const ctx = dread.ctx;

  try {
    // 2) bus master de capas → compresor anti-saturación → destino
    dread.master = ctx.createGain();
    dread.master.gain.value = 0; // arranca en silencio; updateDread lo sube
    dread.limiter = ctx.createDynamicsCompressor();
    // Compresor suave que SOLO actúa ante picos (garantía "sin saturación")
    dread.limiter.threshold.value = -14;
    dread.limiter.knee.value = 18;
    dread.limiter.ratio.value = 6;
    dread.limiter.attack.value = 0.015;
    dread.limiter.release.value = 0.35;
    dread.master.connect(dread.limiter);
    dread.limiter.connect(ctx.destination);

    // ---------- a) DRONE disonante (tritono 110 / 155.6 Hz) ----------
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 260; // "algo cantó mal": grave y opaco
    droneFilter.Q.value = 0.8;

    dread.droneGain = ctx.createGain();
    dread.droneGain.gain.value = 0;
    droneFilter.connect(dread.droneGain);
    dread.droneGain.connect(dread.master);

    // 2 pares de sierras detuned → batimientos inquietantes
    const droneVoices: Array<[number, number]> = [
      [110, 0.12], [110.4, 0.1], [155.6, 0.12], [156.2, 0.1],
    ];
    const droneOscs: OscillatorNode[] = [];
    for (const [freq, vol] of droneVoices) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g);
      g.connect(droneFilter);
      o.start();
      liveSources.push(o);
      droneOscs.push(o);
    }
    // lowpass lento: el filtro "respira" entre ~120 y 400 Hz
    const lfoFilter = ctx.createOscillator();
    lfoFilter.type = 'sine';
    lfoFilter.frequency.value = 0.045;
    const lfoFilterDepth = ctx.createGain();
    lfoFilterDepth.gain.value = 140;
    lfoFilter.connect(lfoFilterDepth);
    lfoFilterDepth.connect(droneFilter.frequency);
    lfoFilter.start();
    liveSources.push(lfoFilter);
    // deriva de afinación del tritono (±8 cents, 0.03 Hz) sobre el
    // tercer oscilador (155.6 Hz): el tritono "respira" y nunca clava
    const lfoDrift = ctx.createOscillator();
    lfoDrift.type = 'sine';
    lfoDrift.frequency.value = 0.03;
    const lfoDriftDepth = ctx.createGain();
    lfoDriftDepth.gain.value = 8;
    lfoDrift.connect(lfoDriftDepth);
    if (droneOscs[2]) lfoDriftDepth.connect(droneOscs[2].detune);
    lfoDrift.start();
    liveSources.push(lfoDrift);

    // ---------- b) SUB-RUMBLE (corazón lejano 0.1 Hz) ----------
    dread.rumbleGain = ctx.createGain();
    dread.rumbleGain.gain.value = 0;
    dread.rumbleGain.connect(dread.master);

    const rumblePulse = ctx.createGain();
    rumblePulse.gain.value = 0.65; // base; el LFO le suma ±0.35
    rumblePulse.connect(dread.rumbleGain);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 40;      // seno 40 Hz
    const subG = ctx.createGain();
    subG.gain.value = 0.6;
    sub.connect(subG);
    subG.connect(rumblePulse);
    sub.start();
    liveSources.push(sub);

    // armónico 80 Hz suave: para que el "latido" se sienta también
    // en altavoces de portátil sin graves reales
    const sub2 = ctx.createOscillator();
    sub2.type = 'sine';
    sub2.frequency.value = 80;
    const sub2G = ctx.createGain();
    sub2G.gain.value = 0.18;
    sub2.connect(sub2G);
    sub2G.connect(rumblePulse);
    sub2.start();
    liveSources.push(sub2);

    // LFO de amplitud 0.1 Hz = pulso cardíaco muy lento
    const lfoHeart = ctx.createOscillator();
    lfoHeart.type = 'sine';
    lfoHeart.frequency.value = 0.1;
    const lfoHeartDepth = ctx.createGain();
    lfoHeartDepth.gain.value = 0.35;
    lfoHeart.connect(lfoHeartDepth);
    lfoHeartDepth.connect(rumblePulse.gain);
    lfoHeart.start();
    liveSources.push(lfoHeart);

    // ---------- c) SUSURRO (ruido blanco + bandpass errante) ----------
    const noiseLen = Math.floor(ctx.sampleRate * 2);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;

    const whisperBand = ctx.createBiquadFilter();
    whisperBand.type = 'bandpass';
    whisperBand.frequency.value = 1200;
    whisperBand.Q.value = 7; // banda estrecha = "voz" sin palabras

    // 2 LFOs inconmensurables sobre la frecuencia → deriva que nunca
    // se repite (pseudo-aleatoria pero sin Math.random por frame)
    const lfoW1 = ctx.createOscillator();
    lfoW1.type = 'sine';
    lfoW1.frequency.value = 0.07;
    const lfoW1Depth = ctx.createGain();
    lfoW1Depth.gain.value = 600;
    lfoW1.connect(lfoW1Depth);
    lfoW1Depth.connect(whisperBand.frequency);
    lfoW1.start();
    liveSources.push(lfoW1);
    const lfoW2 = ctx.createOscillator();
    lfoW2.type = 'sine';
    lfoW2.frequency.value = 0.113;
    const lfoW2Depth = ctx.createGain();
    lfoW2Depth.gain.value = 350;
    lfoW2.connect(lfoW2Depth);
    lfoW2Depth.connect(whisperBand.frequency);
    lfoW2.start();
    liveSources.push(lfoW2);

    // respiración de amplitud (capa aparte para no ensuciar el ramp)
    const whisperBreath = ctx.createGain();
    whisperBreath.gain.value = 0.8;
    const lfoBreath = ctx.createOscillator();
    lfoBreath.type = 'sine';
    lfoBreath.frequency.value = 0.05;
    const lfoBreathDepth = ctx.createGain();
    lfoBreathDepth.gain.value = 0.2;
    lfoBreath.connect(lfoBreathDepth);
    lfoBreathDepth.connect(whisperBreath.gain);
    lfoBreath.start();
    liveSources.push(lfoBreath);

    dread.whisperGain = ctx.createGain();
    dread.whisperGain.gain.value = 0; // updateDread lo lleva a ≤ WHISPER_MAX
    noise.connect(whisperBand);
    whisperBand.connect(whisperBreath);
    whisperBreath.connect(dread.whisperGain);
    dread.whisperGain.connect(dread.master);
    noise.start();
    liveSources.push(noise);

    // ---------- d) bus de STINGERS (accidentales) ----------
    // Va directo al limiter (fuera del cap de capas) pero con ganancia
    // contenida; la accesibilidad lo apaga vía stingerGate.
    dread.stingerGate = ctx.createGain();
    dread.stingerGate.gain.value = dread.enabled ? 1 : 0;
    dread.stingerGate.connect(dread.limiter);

    dread.ready = true;
    lastApplied = -1; // fuerza el primer ramp
  } catch {
    // sin WebAudio disponible: el juego sigue funcionando sin pavor
    dread.ready = false;
  }
}

// ---------------- Nivel y rampas ----------------

/** Aplica `target` a las capas con setTargetAtTime (rampas suaves). */
function applyTarget(target: number): void {
  const ctx = dread.ctx;
  if (!ctx || !dread.master || !dread.droneGain || !dread.rumbleGain || !dread.whisperGain) return;
  if (Math.abs(target - lastApplied) < 0.002) return; // evita spam por frame

  const t = ctx.currentTime;
  const rising = target > dread.level;
  const tc = rising ? (target > 0.9 ? 0.5 : 1.2) : 0.7; // el jefe entra rápido
  dread.droneGain.gain.setTargetAtTime(target * DRONE_MAX, t, tc);
  dread.rumbleGain.gain.setTargetAtTime(target * RUMBLE_MAX, t, tc);
  dread.whisperGain.gain.setTargetAtTime(target * WHISPER_MAX, t, tc);
  // el master siempre al techo (el nivel lo dan las capas)
  dread.master.gain.setTargetAtTime(masterCap(), t, 0.25);
  lastApplied = target;
}

/** Fija el nivel 0..1 MANUAL de las capas (anula el automático). */
export function setDreadLevel(v: number): void {
  dread.manual = true;
  dread.manualLevel = clamp01(v);
  if (dread.ready) applyTarget(dread.manualLevel);
}

/** Devuelve el control del nivel a updateDread (automático). */
export function setDreadAuto(): void {
  dread.manual = false;
}

/** Accesibilidad: apaga/enciende TODA la capa de pavor (y stingers). */
export function setDreadEnabled(b: boolean): void {
  dread.enabled = b;
  const ctx = dread.ctx;
  if (!ctx || !dread.master || !dread.stingerGate) return;
  const t = ctx.currentTime;
  // nunca cortes de golpe: rampas cortas
  dread.master.gain.setTargetAtTime(b ? masterCap() : 0, t, 0.2);
  dread.stingerGate.gain.setTargetAtTime(b ? 1 : 0, t, 0.05);
  if (!b) {
    lastApplied = -1; // al reactivar, las capas se reconstruyen desde 0
    dread.level = 0;
  }
}

// ---------------- Update por frame ----------------

/**
 * Tensión extra opcional (R6-V5) para updateDread. El integrador puede
 * alimentarla para no duplicar cálculo; si no llega, se deriva del propio
 * estado del juego (cero allocations).
 */
export interface DreadTension {
  lowHp?: boolean;      // jugador por debajo del 30% de vida
  aggroCount?: number;  // nº de enemigos con aggro activo
}

/**
 * Sube/baja las capas de pavor según el contexto del juego:
 * cripta > bosque-noche > noche exterior > día; bossActive = máximo.
 * R6-V5: tensión extra si el jugador está <30% de vida (+0.14) o rodeado
 * por 3+ enemigos en aggro (+0.1) — vía `tension` opcional al final o
 * derivada de g si no llega. Solo escribe nodos PROPIOS: jamás corta la
 * música ni los sfx.
 */
export function updateDread(g: Game, dt: number, tension?: DreadTension): void {
  void dt; // las rampas viven en el tiempo del AudioContext (setTargetAtTime)
  if (!dread.ready) dreadInit();
  if (!dread.ready || !dread.ctx) return;

  // política de autoplay: despierta el contexto si estaba suspendido
  // (en el suyo propio; el compartido ya lo despierta audio.resume())
  if (dread.ownCtx && dread.ctx.state === 'suspended') void dread.ctx.resume();

  // ---- nivel automático según contexto ----
  let auto = 0;
  const st = g.state;
  if (st === 'play' || st === 'dialogue') {
    const night = g.dayT > NIGHT_START || g.dayT < NIGHT_END;
    if (g.mapId === 'cripta') {
      auto = 0.8;                                  // la cripta SIEMPRE pesa
    } else if (g.mapId === 'bosque') {
      auto = night ? 0.65 : 0.22;                  // bosque-noche: el objetivo clásico
    } else {
      auto = night ? 0.3 : 0;                      // lunaris: solo de noche
    }
    if (g.epoch === 'pasado') auto = clamp01(auto + 0.1); // el pasado susurra más

    // ---- tensión extra (R6-V5): vida baja o 3+ aggro (O(n) barato, sin allocs) ----
    const lowHp = tension?.lowHp ?? (g.player !== null && g.player.hp < g.player.maxHp * 0.3);
    if (lowHp) auto = clamp01(auto + 0.14); // el corazón te delata
    let aggroN = tension?.aggroCount;
    if (aggroN === undefined) {
      aggroN = 0;
      for (let i = 0; i < g.enemies.length; i++) {
        const e = g.enemies[i];
        if (e.aggro && !e.dead) aggroN++;
      }
    }
    if (aggroN >= 3) auto = clamp01(auto + 0.1); // te están rodeando

    if (g.bossActive) auto = 1;                    // jefe activo: pavor máximo (intocable)
  }
  // en title/pause/dead/end el auto decae a 0 (las rampas son suaves)

  const target = dread.manual ? dread.manualLevel : auto;
  dread.level = target; // el ramp fino lo hace setTargetAtTime
  applyTarget(target);
}

// ---------------- Stingers ----------------

/** Envolvente corta para un oscilador de stinger. */
function stingerVoice(
  ctx: AudioContext, type: OscillatorType, f0: number, f1: number,
  t: number, dur: number, peak: number,
): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dread.stingerGate as GainNode);
  o.start(t);
  o.stop(t + dur + 0.05);
  liveSources.push(o);
}

/** Ruido breve filtrado (para el golpe de 'muerte' y el aire de 'susto'). */
function stingerNoise(
  ctx: AudioContext, t: number, dur: number, freq: number,
  type: BiquadFilterType, peak: number,
): void {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dread.stingerGate as GainNode);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/**
 * Stinger de pavor (efecto puntual, NO loop):
 *  - 'susto'  : clúster agudo 0.3 s con caída de tono (jump-scare contenido)
 *  - 'boss'   : tres notas menores descendentes (Dm: A4→F4→D4, tonalidad del jefe)
 *  - 'muerte' : golpe grave + silencio
 * Respeta setDreadEnabled(false) (accesibilidad). Ganancias conservadoras.
 */
export function dreadStinger(kind: 'boss' | 'susto' | 'muerte'): void {
  if (!dread.ready || !dread.enabled || !dread.ctx || !dread.stingerGate) return;
  const ctx = dread.ctx;
  if (ctx.state === 'suspended') return; // sin contexto despierto no hay stinger
  const t = ctx.currentTime + 0.02;

  if (kind === 'susto') {
    // clúster agudo: 4 voces desafinadas que caen de tono en 0.3 s
    const cluster: Array<[number, OscillatorType, number]> = [
      [1840, 'sawtooth', 0.05], [2210, 'square', 0.035],
      [2680, 'triangle', 0.05], [3160, 'sawtooth', 0.03],
    ];
    for (const [f, type, peak] of cluster) stingerVoice(ctx, type, f, f * 0.68, t, 0.3, peak);
    stingerNoise(ctx, t, 0.22, 3400, 'highpass', 0.05); // aire del susto
  } else if (kind === 'boss') {
    // tres notas menores descendentes en Re menor (la tonalidad del BOSS track)
    const notes: Array<[number, number, number]> = [
      [440.0, 0, 0.42],    // A4
      [349.23, 0.22, 0.42],// F4
      [293.66, 0.44, 0.8], // D4 (más larga, se apaga sola)
    ];
    for (const [f, at, dur] of notes) {
      stingerVoice(ctx, 'sawtooth', f, f, t + at, dur, 0.075);
      stingerVoice(ctx, 'square', f * 1.005, f * 1.005, t + at, dur, 0.04); // refuerzo detuned
    }
    stingerNoise(ctx, t, 0.5, 260, 'lowpass', 0.09); // cuerpo grave bajo las notas
  } else {
    // 'muerte': golpe grave + silencio (nada después: el silencio ASUSTA)
    stingerVoice(ctx, 'sine', 90, 28, t, 0.55, 0.26);
    stingerVoice(ctx, 'triangle', 55, 30, t + 0.01, 0.4, 0.12);
    stingerNoise(ctx, t, 0.2, 240, 'lowpass', 0.2);
  }
}

// ---------------- Teardown ----------------

/** Para todas las fuentes, desenchufa y libera. Permite re-init después. */
export function dreadDispose(): void {
  for (const src of liveSources) {
    try { src.stop(); } catch { /* ya estaba parada */ }
    try { src.disconnect(); } catch { /* noop */ }
  }
  liveSources.length = 0;
  try { dread.master?.disconnect(); } catch { /* noop */ }
  try { dread.stingerGate?.disconnect(); } catch { /* noop */ }
  try { dread.limiter?.disconnect(); } catch { /* noop */ }
  // si el contexto era NUESTRO (fallback), se cierra; el del juego JAMÁS
  if (dread.ownCtx && dread.ctx) void dread.ctx.close().catch(() => undefined);
  dread.ctx = null;
  dread.master = null;
  dread.droneGain = null;
  dread.rumbleGain = null;
  dread.whisperGain = null;
  dread.stingerGate = null;
  dread.limiter = null;
  dread.ready = false;
  dread.level = 0;
  lastApplied = -1;
}
