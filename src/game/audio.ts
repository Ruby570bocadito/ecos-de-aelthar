// ============================================================
// ECOS DE AELTHAR — Motor de audio procedural (WebAudio)
// Música chiptune adaptativa + efectos sintetizados
// ============================================================

import type { TrackName } from './types';

type OscType = OscillatorType;

interface Pattern {
  bpm: number;
  // canales: lead (melodía), bass, pad. Strings de notas por paso ('-' silencio).
  // 32 pasos de semicorchea (2 compases 4/4)
  lead: string[];
  leadType: OscType;
  bass: string[];
  bassType: OscType;
  pad: string[];      // notas largas, un cambio cada 8 pasos
  padType: OscType;
  drums?: string;     // 'k' kick 's' snare 'h' hat '.' nada (32 chars)
  gainLead?: number;
  gainBass?: number;
  gainPad?: number;
}

const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;

// R7-O2: tabla de semitonos hoistada a módulo. Antes se alocaba el literal
// { C:-9, ... } en CADA llamada a noteFreq (~19/s con el secuenciador a
// 138 BPM). Función pura: mismos valores → mismo resultado, cero cambio audible.
const NOTE_SEMI: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

function noteFreq(n: string): number | null {
  if (n === '-' || n === '.') return null;
  const m = NOTE_RE.exec(n);
  if (!m) return null;
  let semi = NOTE_SEMI[m[1]];
  if (m[2] === '#') semi += 1;
  if (m[2] === 'b') semi -= 1;
  const oct = parseInt(m[3], 10);
  return 440 * Math.pow(2, semi / 12 + (oct - 4));
}

// --------- Patrones (melodías originales "del continente de Velmora") ---------

const VILLAGE: Pattern = {
  bpm: 96,
  leadType: 'square',
  bassType: 'triangle',
  padType: 'sine',
  gainLead: 0.16, gainBass: 0.2, gainPad: 0.1,
  lead: ['E4','-','G4','-','C5','-','B4','G4','A4','-','-','G4','E4','-','-','-',
         'D4','-','E4','-','G4','-','E4','D4','C4','-','-','-','-','-','-','-'],
  bass: ['C3','-','-','G2','C3','-','-','-','A2','-','-','E2','A2','-','-','-',
         'F2','-','-','C3','F2','-','-','-','G2','-','-','D3','G2','-','B2','-'],
  pad:  ['C4', 'C4', 'A3', 'A3', 'F3', 'F3', 'G3', 'G3'],
  drums: 'h...k...h...k...h...k...h.s.k...', // FIX agente 7-c: tenía 31 chars (deriva de 1 paso vs melodía de 32)
};

const FOREST: Pattern = {
  bpm: 84,
  leadType: 'triangle',
  bassType: 'sine',
  padType: 'sine',
  gainLead: 0.14, gainBass: 0.16, gainPad: 0.12,
  lead: ['A4','-','-','C5','B4','-','A4','-','E4','-','-','-','-','-','-','-',
         'G4','-','-','A4','B4','-','D5','-','C5','-','B4','A4','-','-','-','-'],
  bass: ['A2','-','-','-','E2','-','-','-','F2','-','-','-','C2','-','-','-',
         'D2','-','-','-','A2','-','-','-','E2','-','-','-','E2','-','G2','-'],
  pad:  ['A3', 'A3', 'F3', 'F3', 'D3', 'D3', 'E3', 'E3'],
  drums: '................h.......h.......',
};

const CRYPT: Pattern = {
  bpm: 68,
  leadType: 'triangle',
  bassType: 'sawtooth',
  padType: 'sine',
  gainLead: 0.1, gainBass: 0.16, gainPad: 0.14,
  lead: ['D4','-','-','-','F4','-','E4','-','D4','-','-','-','C4','-','-','-',
         'D4','-','-','-','A4','-','G4','-','F4','-','E4','-','D4','-','-','-'],
  bass: ['D2','-','-','-','D2','-','-','-','A#1','-','-','-','A#1','-','-','-',
         'G1','-','-','-','G1','-','-','-','A1','-','-','-','A1','-','-','-'],
  pad:  ['D3', 'D3', 'A#2', 'A#2', 'G2', 'G2', 'A2', 'A2'],
  drums: 'k.......k.......k.......k.......',
};

const BOSS: Pattern = {
  bpm: 138,
  leadType: 'square',
  bassType: 'sawtooth',
  padType: 'sine',
  gainLead: 0.15, gainBass: 0.2, gainPad: 0.08,
  lead: ['D4','D4','F4','-','G4','-','A4','A4','A#4','-','A4','-','G4','F4','G4','-',
         'D4','D4','F4','-','G4','-','C5','C5','A#4','-','A4','G4','F4','-','D4','-'],
  bass: ['D2','D2','D2','D2','D2','D2','F2','F2','G2','G2','G2','G2','A2','A2','A2','A2',
         'D2','D2','D2','D2','D2','D2','F2','F2','G2','G2','A#2','A#2','A2','A2','D2','D2'],
  pad:  ['D3', 'D3', 'D3', 'D3'],
  drums: 'k.h.s.h.k.h.s.hkk.h.s.h.k.hks.hk',
};

const TITLE: Pattern = {
  bpm: 72,
  leadType: 'triangle',
  bassType: 'sine',
  padType: 'sine',
  gainLead: 0.13, gainBass: 0.14, gainPad: 0.14,
  lead: ['A4','-','-','-','C5','-','B4','-','E4','-','-','-','-','-','-','-',
         'G4','-','-','-','B4','-','C5','-','A4','-','-','-','-','-','-','-'],
  bass: ['A2','-','-','-','-','-','-','-','F2','-','-','-','-','-','-','-',
         'C2','-','-','-','-','-','-','-','E2','-','-','-','-','-','-','-'],
  pad:  ['A3', 'A3', 'F3', 'F3', 'C3', 'C3', 'E3', 'E3'],
};

// ---- Costa de Bruma: el mar que guardó las notas del dios ----
// Mixolidio en Sol (F natural = color de dilema). Arpegios que suben y
// bajan como olas; bajo sine profundo y redondo que va y viene; la
// "espuma" son hats de ruido agudo dispersos de forma irregular.
const COSTA: Pattern = {
  bpm: 92,
  leadType: 'triangle',
  bassType: 'sine',
  padType: 'sine',
  gainLead: 0.15, gainBass: 0.22, gainPad: 0.09,
  lead: ['G4','B4','D5','G5','F5','D5','B4','G4',
         'A4','C5','E5','A5','G5','E5','C5','A4',
         'B4','D5','F5','B5','A5','F5','D5','B4',
         'C5','E5','G5','E5','C5','A4','G4','-'],
  bass: ['G1','-','-','-','G2','-','-','-','C2','-','-','-','C3','-','-','-',
         'A1','-','-','-','A2','-','-','-','G1','-','-','-','D2','-','-','-'],
  pad:  ['G3', 'G3', 'C4', 'C4', 'A3', 'A3', 'F3', 'G3'],
  // espuma: chispeo de ruido agudo, irregular como olapillas
  drums: 'h.....h...h...h.h.....h...h.h..h',
};

// ---- Aldea de Merrow: caja de música rota; la aldea olvidó su canto ----
// Re menor, tempo lento. Melodía simple con HUECOS (pasos silenciosos
// donde debería haber nota) y frases que responden como ecos tardíos;
// el bajo es mínimo y el compás final se apaga solo.
const ALDEA: Pattern = {
  bpm: 58,
  leadType: 'sine',
  bassType: 'sine',
  padType: 'sine',
  gainLead: 0.15, gainBass: 0.17, gainPad: 0.12,
  lead: ['D5','-','-','-','F5','-','-','-','E5','-','-','D5','-','-','-','-',
         'F5','-','-','-','E5','-','-','-','D5','-','-','C5','-','-','-','-'],
  bass: ['D2','-','-','-','-','-','-','-','G1','-','-','-','-','-','-','-',
         'A#1','-','-','-','-','-','-','-','A1','-','-','-','-','-','-','-'],
  pad:  ['D3', 'D3', 'G2', 'G2', 'A#2', 'A#2', 'A2', 'A2'],
  // mecanismo de la caja: clics muy espaciados (solo respiran en combate)
  drums: 'h...............h...............',
};

// ---- Las Cumbres: campanas sobre silencio inmenso ----
// Pentatónica fría de La m sobre bajada de lamento (A-G-F-E). Notas
// campana sine muy espaciadas (el decaimiento exponencial del motor las
// hace tintinear) y destellos de hielo casi imperceptibles.
const CUMBRES: Pattern = {
  bpm: 76,
  leadType: 'sine',
  bassType: 'sine',
  padType: 'sine',
  gainLead: 0.12, gainBass: 0.18, gainPad: 0.1,
  lead: ['A5','-','-','-','-','-','-','-','G5','-','-','E5','-','-','-','-',
         'D5','-','-','-','-','-','-','-','C5','-','-','E5','-','-','G5','-'],
  bass: ['A1','-','-','-','-','-','-','-','G1','-','-','-','-','-','-','-',
         'F1','-','-','-','-','-','-','-','E1','-','-','-','-','-','-','-'],
  pad:  ['A2', 'A2', 'G2', 'G2', 'F2', 'F2', 'E2', 'E2'],
  // hielo/viento: destellos tenues, casi ausentes
  drums: 'h...............h.......h.......',
};

const TRACKS: Record<TrackName, Pattern> = {
  village: VILLAGE, forest: FOREST, crypt: CRYPT, boss: BOSS, title: TITLE,
  costa: COSTA, aldea: ALDEA, cumbres: CUMBRES,
};

// +1 semitono (micro-variación de melodía 1 de cada 4 loops — Task 10-c)
const SEMI_UP = Math.pow(2, 1 / 12);

// R7-O2: duración (s) del buffer de ruido blanco COMPARTIDO. Debe superar el
// ruido más largo del juego (sNoise máx. actual: 1.2 s en 'song').
const NOISE_BUF_S = 2;

// ============================================================
// R9-8 · helpers de módulo para atmósfera nocturna + magia
// ============================================================

// Hash determinista 0..1 (estilo splitmix): mismo input → mismo output,
// sin estado ni Math.random. Se usa para variaciones por seed (rugidos),
// fraseo de grillos y variación de aullidos. Barato: 3 imul + shifts.
function det01(n: number): number {
  let x = Math.imul(n | 0, 0x9e3779b1) + 0x7f4a7c15;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// R9-8: arpegio de carga de hechizo (Re mayor ascendente, Hz) — hoisted a
// módulo para NO alocar el array en cada disparo del hechizo.
const SPELL_ARP: readonly number[] = [587.33, 739.99, 880, 1174.66, 1479.98];
// Frecuencia base del shimmer (≈C7): sine agudo con vibrato creciente.
const SPELL_SHIMMER_F = 2093;

// ============================================================
// R10-7 · constantes de cripta/interiores/eventos (épicas 6.4/6.5/6.6).
// Hoisted a módulo: cero allocations por disparo (política R7-O2).
// ============================================================

// Multiplicador al que queda el bus de la capa nocturna mientras se está
// DENTRO de una casa (exterior apagado). Ver interiorAmbience/nightAmbience.
const INTERIOR_NIGHT_MUL = 0.28;

// Dron de cripta: raíz (La1) + batido de 2.ª menor (1.5 Hz de batido, inquietud
// constante) + tritono (Mi♭2) muy flojo. Tabla hoisted — el bus la recorre UNA
// vez al crearse.
const CRYPT_DRONE: readonly { f: number; type: OscType; g: number }[] = [
  { f: 55.0, type: 'sine', g: 0.055 },
  { f: 56.5, type: 'sawtooth', g: 0.02 },
  { f: 77.78, type: 'triangle', g: 0.017 },
];

// Ratios de afinación de las 3 voces de la manada (raíz / cuarta justa arriba /
// sexta menor abajo) — entrelazadas suenan a coro de bestias, no a eco.
const PACK_RATIO: readonly number[] = [1, 1.189, 0.891];

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  combatBus!: GainNode;
  // R18 · la época se OYE: la música pasa por un filtro de época (presente
  // apagado y estrecho; pasado brillante, con un eco de memoria)
  private epochLp: BiquadFilterNode | null = null;
  private epochWet: GainNode | null = null;
  private epochWanted = 'presente';

  private musicTimer: number | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private cur: TrackName | null = null;
  private combatOn = false;
  private drumGain = 0;
  // R3-A4: rate-limit por clave (clave → última t de disparo). Evita el
  // ametrallado cuando varios eventos idénticos ocurren el mismo frame
  // (p.ej. varios enemigos mueren a la vez). Mapa de tamaño fijo (1 entrada
  // por clave usada, nunca acumula nodos ni voces).
  private lastSfx = new Map<string, number>();
  // R7-O2: buffer de ruido blanco COMPARTIDO, creado perezosamente UNA vez.
  // Antes noiseBurst/sNoise alocaban y rellenaban un AudioBuffer nuevo con
  // Math.random() POR GOLPE (hats del patrón cada ~0.22 s en 'boss'; los SFX
  // de combate encadenan 2-6 ruidos por evento: hit/crit/kill/finisher...).
  // Cada golpe reproduce una porción DISTINTA (offset aleatorio uniforme) de
  // ruido blanco estacionario → estadísticamente idéntico al buffer dedicado
  // de antes: misma densidad espectral, mismo carácter "ruido nuevo cada vez",
  // mismas envolventes/filtros/tiempos/ganancias. noiseBufCtx permite
  // regenerarlo si el ctx fuera recreado algún día (hoy init() es 1 sola vez).
  private noiseBuf: AudioBuffer | null = null;
  private noiseBufCtx: AudioContext | null = null;
  // Task 10-c: loop absoluto en curso (step/32) para la micro-variación de
  // melodía, y fundido 0→1 del "tambor de tensión" de combate.
  private loopNo = 0;
  private tensionGain = 0;

  // ---- R9-8 · estado de la capa nocturna y aullidos ----
  // nightOn: estado lógico pedido (idempotencia de nightAmbience). nightGain:
  // bus de la capa (se crea UNA vez y se reutiliza en on/off). nightTimer:
  // scheduler de grillos (SOLO corre con la capa on). nightStep: índice
  // determinista del scheduler. howlN: contador para variación determinista
  // de aullidos consecutivos.
  private nightOn = false;
  private nightGain: GainNode | null = null;
  private nightTimer: number | null = null;
  private nightStep = 0;
  private howlN = 0;

  // ---- R10-7 · estado de cripta, interior y eventos ----
  // cryptOn/cryptGain/cryptTimer/cryptStep: capa de cripta (idempotente, mismo
  // patrón de bus+scheduler que la capa nocturna). interiorOn/interiorGain/
  // interiorTimer/interiorStep: capa cálida de hogar. packN/lineN: contadores
  // para variación DETERMINISTA de aullidos de manada y blips del viajero.
  private cryptOn = false;
  private cryptGain: GainNode | null = null;
  private cryptTimer: number | null = null;
  private cryptStep = 0;
  private interiorOn = false;
  private interiorGain: GainNode | null = null;
  private interiorTimer: number | null = null;
  private interiorStep = 0;
  private packN = 0;
  private lineN = 0;

  musicVol = 0.7;
  sfxVol = 0.8;

  init() {
    if (this.ctx) return;
    const AC: typeof AudioContext =
      (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVol;
    // R18: musicGain → filtro de época → master (+ eco de memoria en paralelo)
    this.epochLp = this.ctx.createBiquadFilter();
    this.epochLp.type = 'lowpass';
    this.epochLp.Q.value = 0.7;
    const dl = this.ctx.createDelay(1);
    dl.delayTime.value = 0.33;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.34;
    this.epochWet = this.ctx.createGain();
    this.musicGain.connect(this.epochLp);
    this.epochLp.connect(this.master);
    this.epochLp.connect(dl); dl.connect(fb); fb.connect(dl);
    dl.connect(this.epochWet); this.epochWet.connect(this.master);
    this.applyEpoch(this.epochWanted, false);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // R16 (#33 QA): volumen saneado a [0,1] (antes aceptaba −3, 999 y NaN, y el
  // NaN quedaba fijo en el bus para toda la sesión)
  setMusicVol(v: number) { v = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : this.musicVol; this.musicVol = v; if (this.musicGain) this.musicGain.gain.value = v; }
  setSfxVol(v: number) { v = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : this.sfxVol; this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; }

  /** R18 · color de época para la música. `swirl` = viaje real: la música
   *  se hunde un instante (como oída desde el agua) y emerge en la otra era. */
  setEpoch(ep: string, swirl = false) {
    this.epochWanted = ep;
    this.applyEpoch(ep, swirl);
  }
  private applyEpoch(ep: string, swirl: boolean) {
    if (!this.ctx || !this.epochLp || !this.epochWet) return;
    const t = this.ctx.currentTime;
    // 'neutral' = mapa sin otra época · 'estreno' = el primer día de la Cuna
    const f = ep === 'pasado' ? 16000 : ep === 'aun' ? 1700 : ep === 'estreno' ? 12000 : ep === 'neutral' ? 20000 : 2600;
    const wet = ep === 'pasado' ? 0.24 : ep === 'aun' ? 0.3 : ep === 'estreno' ? 0.1 : 0.0;
    const fq = this.epochLp.frequency, wg = this.epochWet.gain;
    fq.cancelScheduledValues(t); wg.cancelScheduledValues(t);
    if (swirl) {
      // firma sonora del viaje: campanas que suben hacia el ayer · gong grave al volver
      if (ep === 'pasado' || ep === 'estreno') {
        this.sTone(523, 530, 0.9, 'sine', 0.06, 0.12);
        this.sTone(659, 666, 0.9, 'sine', 0.05, 0.22);
        this.sTone(784, 792, 1.1, 'sine', 0.05, 0.32);
        this.sTone(1047, 1056, 1.2, 'triangle', 0.035, 0.42);
      } else {
        this.sTone(130, 98, 1.1, 'sine', 0.12, 0.08);
        this.sTone(196, 147, 0.8, 'triangle', 0.04, 0.1);
      }
      fq.setValueAtTime(Math.max(60, fq.value), t);
      fq.exponentialRampToValueAtTime(240, t + 0.16);
      fq.exponentialRampToValueAtTime(f, t + 0.9);
      wg.setValueAtTime(wg.value, t);
      wg.linearRampToValueAtTime(0.45, t + 0.16);
      wg.linearRampToValueAtTime(wet, t + 1.4);
    } else {
      fq.setValueAtTime(f, t);
      wg.setValueAtTime(wet, t);
    }
  }

  // ---------------- Música ----------------

  playTrack(name: TrackName) {
    this.init();
    if (!this.ctx) return;
    // Guard anti-reinicio (verificado 10-c): llamar playTrack con la pista
    // que YA suena no la reinicia (engine/update la llaman por frame-evento;
    // esto evita cortes de frase al recargar mapa o repetir llamadas).
    if (this.cur === name) return;
    this.cur = name;
    this.step = 0;
    this.drumGain = 0;
    this.tensionGain = 0;
    this.loopNo = 0;
    if (this.musicTimer !== null) { window.clearInterval(this.musicTimer); this.musicTimer = null; }
    const pat = TRACKS[name];
    const stepDur = 60 / pat.bpm / 4;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    // Scheduler con lookahead
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx) return;
      // si el contexto estuvo suspendido, resincroniza
      if (this.nextNoteTime < this.ctx.currentTime - 0.25) {
        this.nextNoteTime = this.ctx.currentTime + 0.05;
      }
      try {
        while (this.nextNoteTime < this.ctx.currentTime + 0.18) {
          this.loopNo = Math.floor(this.step / 32); // para micro-variación (10-c)
          this.scheduleStep(pat, this.step % 32, this.nextNoteTime, stepDur);
          this.step++;
          this.nextNoteTime += stepDur;
        }
      } catch {
        // R16: contexto roto → la música se detiene en vez de lanzar 25 veces/s
        if (this.musicTimer !== null) { window.clearInterval(this.musicTimer); this.musicTimer = null; }
        this.cur = null;
      }
    }, 40);
  }

  stopMusic() {
    if (this.musicTimer !== null) { window.clearInterval(this.musicTimer); this.musicTimer = null; }
    this.cur = null;
  }

  // Capa de combate ADAPTATIVA Y GENÉRICA: actúa sobre cualquier pista de
  // TRACKS que tenga línea de percusión (drums). El target sube a 1 cuando
  // combatOn (la batería entra con fundido) y baja a 0.55 fuera de combate
  // (1 siempre en 'boss'). costa/aldea/cumbres la heredan sin cambios.
  // Task 10-c: además, en pistas de MAPA (no boss), setCombat(true) enciende
  // un "tambor de tensión" — kick sintético suave en pasos pares (≈0.31-0.52 s
  // según bpm) con fundido propio — ver scheduleStep/tensionKick.
  setCombat(on: boolean) { this.combatOn = on; }

  private scheduleStep(pat: Pattern, step: number, t: number, dur: number) {
    if (!this.ctx) return;
    // Micro-variación de pista (Task 10-c): en tracks de mapa (no boss/title),
    // 1 de cada 4 loops la MELODÍA sube +1 semitono durante ESE loop y revierte
    // sola al siguiente (loopNo avanza con el contador absoluto de pasos — sin
    // estado que restaurar). Bajo/pad quedan anclados: el color armónico cambia
    // sin romper el tema. Coste: 1 comparación + 1 multiplicación por nota.
    const tr = (this.cur !== 'boss' && this.cur !== 'title' && (this.loopNo % 4) === 2) ? SEMI_UP : 1;
    const lead = pat.lead[step % pat.lead.length];
    if (lead && lead !== '-') {
      const f = noteFreq(lead);
      if (f) this.tone(f * tr, t, dur * 1.9, pat.leadType, pat.gainLead ?? 0.15, this.musicGain, 0.004, dur * 0.5);
    }
    const bass = pat.bass[step % pat.bass.length];
    if (bass && bass !== '-') {
      const f = noteFreq(bass);
      if (f) this.tone(f, t, dur * 0.92, pat.bassType, pat.gainBass ?? 0.18, this.musicGain, 0.006);
    }
    if (step % 4 === 0) {
      const pad = pat.pad[Math.floor(step / 4) % pat.pad.length];
      const f = noteFreq(pad);
      if (f) {
        this.tone(f, t, dur * 15.5, pat.padType, pat.gainPad ?? 0.1, this.musicGain, 0.25);
        this.tone(f * 1.5, t, dur * 15.5, pat.padType, (pat.gainPad ?? 0.1) * 0.5, this.musicGain, 0.25);
      }
    }
    if (pat.drums) {
      const d = pat.drums[step % pat.drums.length];
      // Capa de combate: percusión entra/fundiciona suavemente
      const target = this.combatOn ? 1 : (this.cur === 'boss' ? 1 : 0.55);
      this.drumGain += (target - this.drumGain) * 0.02;
      if (d === 'k') this.kick(t, 0.5 * this.drumGain);
      else if (d === 's') this.noiseBurst(t, 0.07, 1800, 0.16 * this.drumGain, 'bandpass');
      else if (d === 'h') this.noiseBurst(t, 0.03, 7000, 0.05 * this.drumGain, 'highpass');
      // Tambor de tensión (Task 10-c): latido de combate en pistas de MAPA.
      // En pasos pares (≈0.5 s de pulso) fuerza un kick suave SI la batería
      // del patrón no pisa ya un 'k' ahí (nunca dobla). En 'boss' NO actúa
      // (ya hay percusión completa). Reversible y barato: fundido propio
      // tensionGain → 0 al salir de combate; 1 osc + 1 gain por hit.
      const tensionTarget = this.combatOn && this.cur !== 'boss' ? 1 : 0;
      this.tensionGain += (tensionTarget - this.tensionGain) * 0.03;
      if (step % 2 === 0 && d !== 'k' && this.tensionGain > 0.05) {
        this.tensionKick(t, 0.15 * this.tensionGain);
      }
    }
  }

  // R7-O2 (auditoría): 1 nota = osc + gain desechables es la práctica ESTÁNDAR
  // de WebAudio (el runtime recicla los nodos tras o.stop) — sin pool: los
  // envolventes ya programados impiden reutilizar osciladores sin cambiar el
  // sonido. El secuenciador ya usa lookahead (tick 40 ms, ventana 0.18 s) y
  // solo lee ctx.currentTime en el while del tick; los SFX por evento lo leen
  // 1 vez por disparo (necesario: el disparo se ancla al momento real).
  private tone(freq: number, t: number, dur: number, type: OscType, gain: number, bus: GainNode, attack = 0.01, decay?: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const d = decay ?? dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private kick(t: number, gain: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    g.gain.setValueAtTime(gain * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.15);
  }

  /** Tambor de tensión (Task 10-c): kick sintético más agudo y corto que el
   *  kick principal — el "latido" sutil del combate en pistas de mapa. Solo
   *  suena mientras tensionGain > 0.05, así se funde en entrada y salida. */
  private tensionKick(t: number, gain: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    g.gain.setValueAtTime(gain * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.12);
  }

  /** R7-O2: buffer de ruido blanco compartido (NOISE_BUF_S segundos), creado
   *  y rellenado UNA vez; cada golpe reproduce una porción distinta vía offset
   *  aleatorio uniforme en start(t, off). Un slice de ruido blanco ES ruido
   *  blanco: mismas propiedades estadísticas que el buffer dedicado de antes,
   *  sin alocar ni rellenar nada por golpe. */
  private sharedNoise(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noiseBuf || this.noiseBufCtx !== ctx) {
      const len = Math.floor(ctx.sampleRate * NOISE_BUF_S);
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBufCtx = ctx;
    }
    return this.noiseBuf;
  }

  private noiseBurst(t: number, dur: number, freq: number, gain: number, filter: BiquadFilterType) {
    if (!this.ctx) return;
    const buf = this.sharedNoise();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    // R7-O2: porción aleatoria distinta por golpe del buffer compartido
    // (ruido blanco estacionario → "ruido nuevo" idéntico al buffer dedicado
    // de antes; envolvente/filtro/tiempos/ganancia intactos).
    const off = dur < buf.duration ? Math.random() * (buf.duration - dur) : 0;
    src.start(t, off); src.stop(t + dur + 0.02);
  }

  // ---------------- SFX ----------------

  // R3-A4 · combate v2: intensidad opcional 0..1 para hit/crit.
  // 1 (o ausente) = volumen pleno; 0 = golpe flojo (más flojo, más agudo).
  private iGain(i?: number): number {
    if (typeof i !== 'number' || !isFinite(i)) return 1;
    return 0.5 + 0.5 * Math.min(1, Math.max(0, i));
  }

  private iPitch(i?: number): number {
    if (typeof i !== 'number' || !isFinite(i)) return 1;
    return 1.12 - 0.28 * Math.min(1, Math.max(0, i));
  }

  // Ping metálico real: par de osciladores detuned (batido) + parcial
  // inarmónico, envolvente rápida y reverb fake con DelayNode corto.
  private sPing(f0: number, dur: number, gain: number, delay = 0) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + delay;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const det of [0, 14]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(f0 + det, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f0 * 0.97), t + dur);
      o.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    }
    const p = this.ctx.createOscillator();
    p.type = 'sine';
    p.frequency.setValueAtTime(f0 * 2.756, t);
    p.connect(g);
    p.start(t); p.stop(t + dur + 0.05);
    g.connect(this.sfxGain);
    // reverb fake: tap con delay corto + realimentación suave
    // R7-O2 (auditoría): la cadena de reverb es POR LLAMADA a propósito.
    // Compartirla como bus haría que la cola del ping anterior (delay 0.085 s
    // + feedback 0.3 ≈ 1 s de tail) sangrara en el eco del siguiente parry →
    // cambio audible en parries encadenados. Paridad > ahorro de 3 nodos en
    // un SFX no-caliente (rate-limit 60 ms ya lo acota).
    if (typeof this.ctx.createDelay === 'function') {
      const dl = this.ctx.createDelay(0.4);
      if (dl.delayTime) dl.delayTime.value = 0.085;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.3;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.32;
      g.connect(dl); dl.connect(fb); fb.connect(dl);
      dl.connect(wet); wet.connect(this.sfxGain);
    }
  }

  private sTone(f0: number, f1: number, dur: number, type: OscType, gain: number, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.03);
  }

  private sNoise(dur: number, freq: number, gain: number, filter: BiquadFilterType = 'bandpass', delay = 0, sweepTo?: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const buf = this.sharedNoise();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    // R7-O2: buffer compartido con offset aleatorio (ver sharedNoise/noiseBurst).
    const off = dur < buf.duration ? Math.random() * (buf.duration - dur) : 0;
    src.start(t, off); src.stop(t + dur + 0.02);
  }

  /** Tono de sirena: sine largo con vibrato real (LFO sobre la frecuencia). */
  private sSongTone(f0: number, dur: number, gain: number, delay = 0, vib = 5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    lfo.type = 'sine';
    lfo.frequency.value = vib;
    lg.gain.value = f0 * 0.018; // vibrato sutil (~2%)
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.18); // ataque lento = etéreo
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }

  // ============================================================
  // AUDITORÍA SFX (Task 10-c) — usados en src/game vs cases de abajo.
  // USADOS (40, verificado por script sobre update.ts, engine.ts,
  // enemies_expansion.ts, hooks.ts, screens.ts):
  //   swing, swing2, hit, crit, parry, parryFail, dodge, hurt, enemyDie,
  //   coin, potion, chest, levelup, quest, blip, select, confirm, echo,
  //   epoch, fire, ice, bolt, holy, shadow, roar, slam, die, save, uiOpen,
  //   error, companionShot, break, memory, banner, whoosh,
  //   splash, song, gust, lamp, wraith
  // + Ronda 3 (R3-A4): kill, phase, heartbeat, finisher
  // DEFINIDOS: los mismos → 0 faltan, 0 cases muertos.
  //   (engine.ts interpola por elemento: solo emite 'fire'/'ice'/'bolt'
  //   — los literales 'fuego'/'hielo' ahí son Element, no SFX.)
  // NOTA: este switch NO lleva 'default' a propósito — un nombre de SFX
  // desconocido cae fuera de todos los cases y es un no-op seguro.
  // ============================================================
  sfx(name: string, intensity?: number) {
    this.init();
    if (!this.ctx) return;
    // R3-A4 · rate-limit por clave: ninguna clave suena más de 1×/60 ms
    // ('heartbeat' tiene umbral propio de 400 ms). Si el reloj del contexto
    // va hacia atrás (recreación), se permite el disparo.
    const now = this.ctx.currentTime;
    const minGap = name === 'heartbeat' ? 0.4 : 0.06;
    const last = this.lastSfx.get(name);
    if (last !== undefined && now >= last && now - last < minGap) return;
    this.lastSfx.set(name, now);
    switch (name) {
      case 'swing': this.sNoise(0.09, 2600, 0.16, 'bandpass', 0, 900); break;
      case 'swing2': this.sNoise(0.11, 2100, 0.18, 'bandpass', 0, 700); break;
      // ----- combate v2 (R3-A4): golpe con cuerpo + pitch aleatorio leve; -----
      // ----- hit/crit aceptan intensidad opcional 0..1 (sfx('hit', 0.8))  -----
      case 'hit': {
        const gk = this.iGain(intensity), pk = this.iPitch(intensity);
        const pr = (0.92 + Math.random() * 0.16) * pk;
        this.sNoise(0.02, 3200 * pr, 0.09 * gk, 'highpass');       // click
        this.sTone(300 * pr, 88 * pr, 0.11, 'square', 0.17 * gk);  // thump
        this.sTone(150 * pr, 58 * pr, 0.12, 'sine', 0.13 * gk);    // sub del golpe
        this.sNoise(0.06, 1100 * pr, 0.1 * gk);                    // roce
        break;
      }
      case 'crit': {
        const gk = this.iGain(intensity), pk = this.iPitch(intensity);
        const pr = (0.94 + Math.random() * 0.12) * pk;
        this.sTone(330 * pr, 72 * pr, 0.17, 'square', 0.22 * gk);  // impacto
        this.sTone(165 * pr, 52 * pr, 0.15, 'sine', 0.16 * gk);    // cuerpo
        this.sNoise(0.09, 2600 * pr, 0.18 * gk);                   // chasquido
        this.sTone(2450, 2380, 0.09, 'square', 0.05 * gk, 0.03);   // shimmer metálico
        this.sTone(3670, 3560, 0.11, 'sine', 0.045 * gk, 0.045);
        this.sNoise(0.07, 6200, 0.04 * gk, 'highpass', 0.03);
        break;
      }
      case 'parry':
        // ping metálico real: par detuned + parcial + envolvente rápida + reverb fake
        this.sPing(1250, 0.18, 0.15);
        this.sPing(1875, 0.12, 0.06, 0.015);
        this.sNoise(0.05, 5200, 0.06, 'highpass', 0.01);
        break;
      case 'parryFail': this.sTone(500, 380, 0.08, 'square', 0.1); break;
      case 'dodge':
        // whoosh más suave: ruido filtrado con barrido, arranque apagado
        this.sNoise(0.15, 480, 0.05, 'lowpass', 0, 1400);
        this.sNoise(0.19, 800, 0.055, 'bandpass', 0.02, 2600);
        break;
      case 'hurt':
        // golpe sordo + aire que escapa
        this.sTone(140, 65, 0.13, 'sine', 0.16);
        this.sTone(210, 85, 0.12, 'sawtooth', 0.09);
        this.sNoise(0.07, 420, 0.12, 'lowpass');
        this.sNoise(0.22, 1500, 0.045, 'bandpass', 0.02, 3400);
        break;
      case 'enemyDie': {
        // impacto + deseclipse descendente (la criatura se deshace al grave)
        this.sNoise(0.06, 900, 0.11, 'lowpass');
        this.sTone(340, 55, 0.34, 'sawtooth', 0.13);
        this.sTone(227, 40, 0.38, 'triangle', 0.07, 0.04);
        this.sNoise(0.28, 640, 0.09, 'lowpass', 0.06, 110);
        break;
      }
      case 'coin': this.sTone(1150, 1150, 0.06, 'square', 0.1); this.sTone(1720, 1720, 0.1, 'square', 0.1, 0.06); break;
      case 'potion': this.sTone(420, 780, 0.12, 'sine', 0.14); this.sTone(640, 990, 0.12, 'sine', 0.12, 0.09); break;
      case 'chest': this.sTone(240, 240, 0.08, 'square', 0.1); this.sTone(480, 480, 0.1, 'square', 0.12, 0.09); this.sTone(720, 720, 0.16, 'square', 0.12, 0.19); break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this.sTone(f, f, 0.14, 'square', 0.14, i * 0.09));
        break;
      case 'quest': [659, 880].forEach((f, i) => this.sTone(f, f, 0.18, 'triangle', 0.14, i * 0.12)); break;
      case 'blip': this.sTone(880 + Math.random() * 160, 860, 0.03, 'square', 0.05); break;
      case 'select': this.sTone(660, 880, 0.06, 'square', 0.09); break;
      case 'confirm': this.sTone(520, 780, 0.1, 'square', 0.12); break;
      case 'echo':
        this.sTone(180, 900, 0.5, 'sine', 0.14);
        this.sTone(270, 1350, 0.55, 'sine', 0.1, 0.05);
        this.sNoise(0.6, 5200, 0.05, 'highpass', 0.1, 9000);
        break;
      case 'epoch':
        this.sTone(1400, 220, 0.42, 'sine', 0.13);
        this.sNoise(0.4, 3200, 0.07, 'bandpass', 0, 500);
        break;
      case 'fire': this.sNoise(0.24, 640, 0.14, 'lowpass', 0, 220); this.sTone(190, 70, 0.2, 'sawtooth', 0.07); break;
      case 'ice': this.sTone(1480, 880, 0.12, 'triangle', 0.13); this.sNoise(0.08, 5200, 0.08, 'highpass', 0.03); break;
      case 'bolt': this.sTone(2100, 320, 0.09, 'square', 0.13); this.sNoise(0.07, 3600, 0.12); break;
      case 'holy': [784, 988, 1319].forEach((f, i) => this.sTone(f, f, 0.3, 'sine', 0.09, i * 0.05)); break;
      case 'shadow': this.sTone(220, 70, 0.35, 'sawtooth', 0.11); this.sNoise(0.3, 400, 0.08, 'lowpass'); break;
      case 'roar': this.sTone(120, 42, 0.7, 'sawtooth', 0.24); this.sNoise(0.6, 300, 0.16, 'lowpass', 0, 90); break;
      case 'slam': this.sTone(90, 30, 0.28, 'sine', 0.3); this.sNoise(0.22, 420, 0.22, 'lowpass'); break;
      case 'die': this.sTone(420, 60, 0.8, 'sawtooth', 0.18); break;
      case 'save': [880, 1175, 1568].forEach((f, i) => this.sTone(f, f, 0.22, 'sine', 0.1, i * 0.1)); break;
      case 'uiOpen': this.sTone(440, 660, 0.07, 'square', 0.07); break;
      case 'error': this.sTone(220, 180, 0.12, 'square', 0.1); break;
      case 'companionShot': this.sNoise(0.06, 3000, 0.07, 'highpass'); this.sTone(900, 1500, 0.05, 'triangle', 0.05); break;
      // ----- SFX nuevos (agente 3-b los llama desde update.ts) -----
      case 'break':
        // cristal/quebradura: chasquido de ruido + tono descendente
        this.sNoise(0.18, 4200, 0.2, 'highpass', 0, 1200);
        this.sTone(1800, 220, 0.28, 'triangle', 0.16);
        this.sNoise(0.12, 900, 0.12, 'bandpass', 0.05, 300);
        break;
      case 'memory':
        // campanita suave de 4 notas ascendentes, timbre de nana
        [659, 784, 880, 1175].forEach((f, i) => {
          this.sTone(f, f, 0.5, 'sine', 0.09, i * 0.16);
          this.sTone(f * 2, f * 2, 0.28, 'sine', 0.03, i * 0.16);
        });
        break;
      case 'banner':
        // cuerno grave breve (anuncia al jefe)
        this.sTone(98, 92, 0.55, 'sawtooth', 0.2);
        this.sTone(147, 138, 0.5, 'sawtooth', 0.12, 0.02);
        this.sNoise(0.4, 300, 0.06, 'lowpass');
        break;
      case 'whoosh':
        // susurro de esquiva
        this.sNoise(0.16, 1400, 0.09, 'bandpass', 0, 3800);
        break;
      // ----- SFX de combate v2 nuevos (R3-A4) -----
      case 'kill':
        // sello de muerte: thud + sub-drop 120→60 Hz + chispa aguda
        this.sNoise(0.09, 360, 0.2, 'lowpass');
        this.sTone(120, 60, 0.34, 'sine', 0.28);
        this.sTone(240, 120, 0.12, 'triangle', 0.1);   // octava: audible en portátiles
        this.sNoise(0.05, 5400, 0.07, 'highpass', 0.05);
        this.sTone(3400, 2700, 0.08, 'square', 0.045, 0.05);
        break;
      case 'phase':
        // cambio de fase del jefe: riser de 0.4 s + impacto
        this.sNoise(0.4, 260, 0.1, 'bandpass', 0, 3400);
        this.sTone(110, 440, 0.4, 'sawtooth', 0.08);
        this.sTone(55, 220, 0.4, 'triangle', 0.07);
        this.sTone(90, 30, 0.32, 'sine', 0.3, 0.4);
        this.sNoise(0.2, 520, 0.2, 'lowpass', 0.4, 90);
        this.sTone(1250, 860, 0.14, 'square', 0.07, 0.4);
        break;
      case 'heartbeat':
        // latido aislado lub-dub grave (sin nodos persistentes; el rate-limit
        // propio de 400 ms permite llamarlo cada ~1.2 s sin acumular voces)
        this.sTone(76, 46, 0.14, 'sine', 0.22);        // lub
        this.sTone(152, 92, 0.1, 'sine', 0.05);        // armónico audible
        this.sTone(66, 42, 0.12, 'sine', 0.16, 0.2);   // dub
        this.sTone(132, 84, 0.09, 'sine', 0.04, 0.2);
        break;
      case 'finisher':
        // remate: beat de silencio + caída guillotina
        this.sTone(1300, 1240, 0.04, 'square', 0.06);  // tic antes del silencio
        this.sTone(1500, 36, 0.28, 'sawtooth', 0.2, 0.14);  // guillotine drop
        this.sTone(300, 24, 0.36, 'sine', 0.26, 0.14);
        this.sNoise(0.12, 4200, 0.12, 'highpass', 0.14, 700);  // filo
        this.sNoise(0.16, 320, 0.22, 'lowpass', 0.3);  // impacto final
        this.sTone(85, 26, 0.26, 'sine', 0.26, 0.3);
        break;
      // ----- SFX ambientales de biomas nuevos (agente 7-c) -----
      case 'splash':
        // salpicadura: masa de agua (lowpass descendente) + burbujas cortas
        this.sNoise(0.22, 1500, 0.16, 'lowpass', 0, 260);
        this.sTone(320, 760, 0.07, 'sine', 0.08, 0.04);
        this.sTone(480, 940, 0.06, 'sine', 0.07, 0.1);
        break;
      case 'song':
        // canto de sirena: 3 tonos sine largos con vibrato, etéreos
        this.sSongTone(784, 1.1, 0.07, 0, 4.6);
        this.sSongTone(988, 1.0, 0.06, 0.35, 5.3);
        this.sSongTone(659, 1.4, 0.05, 0.7, 4.1);
        this.sNoise(1.2, 5200, 0.02, 'highpass', 0.2, 8000); // brillo del agua
        break;
      case 'gust':
        // ráfaga de viento: ruido bandpass barrido 400→2000 Hz
        this.sNoise(0.5, 400, 0.13, 'bandpass', 0, 2000);
        break;
      case 'lamp':
        // farol encendido: tono cálido ascendente corto + chispa
        this.sTone(196, 524, 0.16, 'triangle', 0.13);
        this.sTone(524, 524, 0.1, 'sine', 0.06, 0.14);
        this.sNoise(0.05, 5600, 0.07, 'highpass', 0.05);
        break;
      case 'wraith':
        // susurro de espectro: aliento highpass muy suave + tono fantasmal descendente
        this.sNoise(0.5, 6200, 0.045, 'highpass', 0, 8200);
        this.sTone(880, 240, 0.55, 'sine', 0.05);
        this.sTone(830, 200, 0.6, 'triangle', 0.035, 0.06); // detune fantasmal
        break;
      default:
        // SFX desconocido: no-op seguro (no rompe el juego)
        break;
    }
  }

  // ============================================================
  // R9-8 · ATMÓSFERA NOCTURNA + MAGIA (épicas 5.3 y 7.5)
  // Métodos internos del engine (reutilizan sTone/sNoise/sharedNoise y el
  // rate-limit). Las funciones EXPORT playSpellCast / playSpellImpact /
  // playNightAmbience / playHowlDistant / playBossRoarVariant (al final del
  // archivo) son envoltorios delgados sobre el singleton `audio`: el
  // orquestador cablea esas export, no estos métodos.
  // ============================================================

  /** R9-8: rate-limit reutilizable con la MISMA política que sfx() (clave →
   *  último disparo, Mapa de tamaño fijo). Devuelve true si se permite. */
  private rl(key: string, gap: number): boolean {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const last = this.lastSfx.get(key);
    if (last !== undefined && now >= last && now - last < gap) return false;
    this.lastSfx.set(key, now);
    return true;
  }

  // ---- 1) Carga de hechizo: arpegio ascendente + shimmer con vibrato ----
  // ----    creciente. Total < 0.4 s (última nota termina ~0.31 s;      ----
  // ----    shimmer ~0.40 s).                                           ----
  spellCast() {
    this.init();
    if (!this.ctx || !this.rl('spellCast', 0.06)) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Arpegio pentatónico-mayor ascendente (D5 F#5 A5 D6 F#6), 42 ms/nota:
    // "el hechizo se ensambla". Parcial de octava muy flojo para brillo.
    for (let i = 0; i < SPELL_ARP.length; i++) {
      const f = SPELL_ARP[i];
      this.sTone(f, f * 1.004, 0.14, 'triangle', 0.09, i * 0.042);
      this.sTone(f * 2, f * 2, 0.07, 'sine', 0.025, i * 0.042 + 0.01);
    }
    // Shimmer: sine agudo que sube un poco con vibrato que CRECE (el aire
    // "se tensa" mientras el hechizo carga). LFO → frecuencia, profundidad
    // 2→26 Hz en rampa. Nodos desechables (patrón estándar, ver tone()).
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(SPELL_SHIMMER_F, t + 0.06);
    o.frequency.exponentialRampToValueAtTime(SPELL_SHIMMER_F * 1.16, t + 0.36);
    lfo.type = 'sine';
    lfo.frequency.value = 7.5;
    lg.gain.setValueAtTime(2, t + 0.06);
    lg.gain.linearRampToValueAtTime(26, t + 0.36);
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t + 0.06);
    g.gain.linearRampToValueAtTime(0.045, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t + 0.06); o.stop(t + 0.4);
    lfo.start(t + 0.06); lfo.stop(t + 0.4);
    // Chispazo de polvo arcano (ruido COMPARTIDO, barrido agudo suave)
    this.sNoise(0.22, 7400, 0.028, 'highpass', 0.05, 9200);
  }

  // ---- 2) Impacto de hechizo: golpe grave + destello agudo. big=true     ----
  // ----    (muerte por hechizo): más grave y cola de resonancia ~0.8 s.   ----
  spellImpact(big: boolean) {
    this.init();
    if (!this.ctx || !this.rl('spellImpact', 0.06)) return;
    if (big) {
      // Remate: sub más profundo + dos resonancias lentas (tónica/quinta
      // graves que se disuelven) + cola de ruido lowpass descendente.
      this.sTone(120, 34, 0.4, 'square', 0.18);
      this.sTone(60, 30, 0.5, 'sine', 0.22);
      this.sNoise(0.1, 2400, 0.15, 'highpass');            // destello
      this.sTone(1980, 1540, 0.14, 'square', 0.05, 0.02);  // chispa
      this.sTone(90, 44, 0.7, 'sine', 0.09, 0.06);         // resonancia 1
      this.sTone(135, 66, 0.75, 'sine', 0.055, 0.12);      // resonancia 2
      this.sNoise(0.8, 420, 0.06, 'lowpass', 0.08, 90);    // cola grave
    } else {
      // Impacto estándar: thump corto + destello agudo de cierre.
      this.sTone(165, 60, 0.18, 'square', 0.16);
      this.sTone(85, 44, 0.22, 'sine', 0.18);
      this.sNoise(0.08, 3000, 0.12, 'highpass');
      this.sTone(2350, 1880, 0.1, 'square', 0.05, 0.02);
      this.sNoise(0.05, 6400, 0.045, 'highpass', 0.04);
    }
  }

  // ---- 3) Capa ambiental nocturna: grillos + viento tenue. IDEMPOTENTE   ----
  // ----    (llamable cada frame: si ya está en el estado pedido, no-op).  ----
  // Transición por crossfade (sube 2.4 s / baja 1.6 s). Coste en reposo con
  // la capa on: 1 bufferSource en loop + filtro + LFO (viento, nodos fijos
  // creados UNA vez) + setInterval 120 ms de grillos (solo mientras on).
  nightAmbience(on: boolean) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    if (on === this.nightOn) return; // ya en el estado pedido → no-op seguro
    this.nightOn = on;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (!this.nightGain) {
      // Bus de la capa (se crea UNA vez; reutilizado en on/off posteriores).
      // Va al bus sfx existente → respeta el volumen de SFX del jugador.
      const bus = ctx.createGain();
      bus.gain.value = 0.0001;
      bus.connect(this.sfxGain);
      // Viento tenue: ruido blanco COMPARTIDO en loop (sin buffers nuevos),
      // lowpass ~210 Hz con LFO muy lento (0.06 Hz) que "respira".
      const wind = ctx.createBufferSource();
      wind.buffer = this.sharedNoise();
      wind.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 210; lp.Q.value = 0.5;
      const wg = ctx.createGain(); wg.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.06;
      const lg = ctx.createGain(); lg.gain.value = 85;
      lfo.connect(lg); lg.connect(lp.frequency);
      wind.connect(lp); lp.connect(wg); wg.connect(bus);
      wind.start(now); lfo.start(now);
      this.nightGain = bus;
    }
    const g = this.nightGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    if (on) {
      // R10-7: dentro de una casa el exterior se oye APAGADO — el target del
      // crossfade respeta el pato de interior (invariante en CUALQUIER orden
      // de llamada respecto a interiorAmbience, que también programa el bus).
      g.linearRampToValueAtTime(this.interiorOn ? INTERIOR_NIGHT_MUL : 1, now + 2.4);   // crossfade de entrada
      if (this.nightTimer === null) {
        this.nightStep = 0;                       // fraseo determinista desde 0
        this.nightTimer = window.setInterval(() => this.nightTick(), 120);
      }
    } else {
      g.linearRampToValueAtTime(0.0001, now + 1.6); // crossfade de salida
      if (this.nightTimer !== null) { window.clearInterval(this.nightTimer); this.nightTimer = null; }
    }
  }

  /** Paso del scheduler de grillos (SOLO con la capa on): 2 voces
   *  independientes con fraseo DETERMINISTA — mismo índice de arranque →
   *  misma secuencia de trinos (det01, sin Math.random). Voz A cercana
   *  (p≈0.22/paso, ~4.1-4.6 kHz), voz B lejana más grave y floja (p≈0.15). */
  private nightTick() {
    if (!this.ctx || !this.nightOn || !this.nightGain) return;
    const ctx = this.ctx;
    const s = this.nightStep++;
    if (det01(s * 2 + 1) < 0.22) {
      const f = 4100 + Math.floor(det01(s * 3 + 2) * 3) * 260;
      this.nightChirp(ctx.currentTime + 0.02, f, 3 + Math.floor(det01(s * 5 + 3) * 3), 0.045);
    }
    if (det01(s * 7 + 5) < 0.15) {
      const f = 3400 + Math.floor(det01(s * 11 + 7) * 3) * 220;
      this.nightChirp(ctx.currentTime + 0.07, f, 3 + Math.floor(det01(s * 13 + 9) * 2), 0.026);
    }
  }

  /** Un trino de grillo: `pulses` pulsos de 20 ms a 32 ms de separación.
   *  Square + bandpass estrecho (Q 7) = chirp cristalino sin arpón. Un solo
   *  oscilador gateado por la envolvente del gain (4 nodos por trino,
   *  desechables — patrón estándar WebAudio, ver nota R7-O2 en tone()). */
  private nightChirp(t0: number, f: number, pulses: number, gain: number) {
    const ctx = this.ctx;
    if (!ctx || !this.nightGain) return;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 7;
    const g = ctx.createGain();
    bp.connect(g); g.connect(this.nightGain);
    const o = ctx.createOscillator();
    o.type = 'square'; o.frequency.value = f;
    o.connect(bp);
    for (let i = 0; i < pulses; i++) {
      const t = t0 + i * 0.032;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    }
    o.start(t0); o.stop(t0 + pulses * 0.032 + 0.03);
  }

  // ---- 4) Aullido lejano ocasional (lo dispara el orquestador con hash  ----
  // ----    de tiempo): sube 0.6 s, meseta, baja 1.5 s; volumen bajo y    ----
  // ----    eco barato (delay con realimentación lowpass = valle).        ----
  // Variación DETERMINISTA por contador interno: la n-ésima llamada suena
  // siempre igual (misma afinación, mismo eco), pero consecutivas no se
  // clonan. Rate-limit propio de 0.6 s (es largo).
  howlDistant() {
    this.init();
    if (!this.ctx || !this.rl('howlDistant', 0.6)) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const m = 0.92 + det01(this.howlN * 3 + 11) * 0.18;   // afinación 0.92..1.10
    const dT = 0.24 + det01(this.howlN * 5 + 17) * 0.12;  // eco 0.24..0.36 s
    this.howlN++;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(196 * m, t);
    o.frequency.exponentialRampToValueAtTime(392 * m, t + 0.6); // sube
    o.frequency.setValueAtTime(392 * m, t + 0.9);               // meseta
    o.frequency.exponentialRampToValueAtTime(150 * m, t + 2.4); // baja y muere
    const vib = ctx.createOscillator();
    vib.type = 'sine'; vib.frequency.value = 4.3;
    const vg = ctx.createGain(); vg.gain.value = 4.5;
    vib.connect(vg); vg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.3);   // ataque suave = lejanía
    g.gain.setValueAtTime(0.05, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g); g.connect(this.sfxGain);
    // Eco barato: delay + feedback pasando por lowpass (misma receta que
    // sPing, cola más larga y oscura). Cadena POR LLAMADA a propósito
    // (paridad entre aullidos, ver comentario R7-O2 en sPing).
    const dl = ctx.createDelay(0.6); dl.delayTime.value = dT;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const dk = ctx.createBiquadFilter();
    dk.type = 'lowpass'; dk.frequency.value = 1100;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    g.connect(dl); dl.connect(dk); dk.connect(fb); fb.connect(dl);
    dl.connect(wet); wet.connect(this.sfxGain);
    o.start(t); o.stop(t + 4.6);
    vib.start(t); vib.stop(t + 4.6);
    // Aliento sutil bajo el aullido (ruido COMPARTIDO, bandpass descendente)
    this.sNoise(1.8, 640 * m, 0.02, 'bandpass', 0, 240);
  }

  // ---- 5) Rugido de jefe: 4 variantes DETERMINISTAS por seed.           ----
  // v = |seed| % 4 fija la receta; det01(seed) da micro-afinación (±6%):
  // el MISMO seed reproduce EXACTAMENTE el mismo rugido. No sustituye al
  // sfx('roar') existente — el orquestador elige cuál disparar. Volúmenes
  // moderados (pico ≤ 0.22 pre-buses) y rate-limit propio de 0.3 s.
  bossRoarVariant(seed: number) {
    this.init();
    if (!this.ctx || !this.rl('bossRoarV', 0.3)) return;
    const ctx = this.ctx;
    const s = Math.trunc(seed) || 0;
    const v = Math.abs(s) % 4;
    const m = 0.94 + det01(s * 7 + 3) * 0.12;
    const t = ctx.currentTime;
    switch (v) {
      case 0: // rugido clásico: barrido grave + aire que se apaga
        this.sTone(115 * m, 40, 0.7, 'sawtooth', 0.2);
        this.sTone(58 * m, 30, 0.8, 'sine', 0.13, 0.03);
        this.sNoise(0.6, 300 * m, 0.13, 'lowpass', 0, 95);
        break;
      case 1: // alarido rasgado: más agudo, batido áspero + formante
        this.sTone(190 * m, 70, 0.55, 'sawtooth', 0.17);
        this.sTone(199 * m, 74, 0.55, 'square', 0.06);        // batido
        this.sNoise(0.45, 950 * m, 0.1, 'bandpass', 0, 420);  // formante
        this.sNoise(0.3, 2400, 0.05, 'highpass', 0.05, 900);
        break;
      case 2: { // gruño triple pulsado + cierre sub
        for (let i = 0; i < 3; i++) {
          const d = i * 0.21;
          this.sTone(104 * m * (1 - i * 0.06), 48, 0.17, 'sawtooth', 0.16 - i * 0.03, d);
          this.sNoise(0.16, 380, 0.075 - i * 0.015, 'lowpass', d, 120);
        }
        this.sTone(50, 26, 0.5, 'sine', 0.15, 0.44);
        break;
      }
      default: { // v3: bramido con trémolo de pecho (9 Hz) + sub
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(72 * m, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.9);
        // trémolo aislado en SU gain (trem) y envolvente en OTRO (env):
        // así el LFO nunca pisa la envolvente ni hace click al parar.
        const trem = ctx.createGain(); trem.gain.value = 0.55;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine'; lfo.frequency.value = 9;
        const lg = ctx.createGain(); lg.gain.value = 0.45;
        lfo.connect(lg); lg.connect(trem.gain);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.22, t + 0.07);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(trem); trem.connect(env); env.connect(this.sfxGain);
        o.start(t); o.stop(t + 0.95);
        lfo.start(t); lfo.stop(t + 0.95);
        this.sTone(55 * m, 30, 0.85, 'sine', 0.14, 0.02);
        this.sNoise(0.5, 260 * m, 0.1, 'lowpass', 0, 80);
        break;
      }
    }
  }

  // ============================================================
  // R10-7 · CRIPTA ZELDA + INTERIORES + EVENTOS (épicas 6.4/6.5/6.6)
  // Métodos internos del engine (reutilizan sharedNoise/sTone/sNoise/rl y los
  // buses existentes — NADA de buffers nuevos por disparo). Las EXPORT
  // playCryptAmbience / playSpikeUp / playLeverPull / playDoorOpen /
  // playPackHowl / playEchoFind / playInteriorAmbience / playTravelerLine
  // (al final del archivo) son envoltorios delgados sobre el singleton:
  // el orquestador cablea esas export, no estos métodos.
  // ============================================================

  // ---- 1) Capa de cripta: dron grave disonante + goteo + susurro.        ----
  // ----    IDEMPOTENTE (no-op si ya está en el estado), crossfade suave.  ----
  // Coste en reposo con la capa on: 3 osciladores del dron + LFO + filtro
  // (nodos FIJOS creados UNA vez, corren siempre que el bus existe — mismo
  // patrón que el viento nocturno) + setInterval 140 ms de goteo/susurro
  // (solo mientras on). El goteo y el susurro se conectan AL BUS de la capa,
  // así el crossfade los abrazó al salir (nada sigue sonando fuera).
  cryptAmbience(on: boolean) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    if (on === this.cryptOn) return; // ya en el estado pedido → no-op seguro
    this.cryptOn = on;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (!this.cryptGain) {
      // Bus de la capa (se crea UNA vez; reutilizado en on/off posteriores).
      // Va al bus sfx existente → respeta el volumen de SFX del jugador.
      const bus = ctx.createGain();
      bus.gain.value = 0.0001;
      bus.connect(this.sfxGain);
      // Dron disonante: tabla CRYPT_DRONE (raíz + batido + tritono) pasando
      // por lowpass grave; LFO muy lento (0.05 Hz) hace que "respire".
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 250; lp.Q.value = 0.4;
      const droneG = ctx.createGain(); droneG.gain.value = 0.88;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.05;
      const lg = ctx.createGain(); lg.gain.value = 0.12;
      lfo.connect(lg); lg.connect(droneG.gain);
      lp.connect(droneG); droneG.connect(bus);
      for (let i = 0; i < CRYPT_DRONE.length; i++) {
        const d = CRYPT_DRONE[i];
        const o = ctx.createOscillator();
        o.type = d.type;
        o.frequency.value = d.f;
        const og = ctx.createGain(); og.gain.value = d.g;
        o.connect(og); og.connect(lp);
        o.start(now);
      }
      lfo.start(now);
      this.cryptGain = bus;
    }
    const g = this.cryptGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    if (on) {
      g.linearRampToValueAtTime(1, now + 2.6);   // crossfade de entrada
      if (this.cryptTimer === null) {
        this.cryptStep = 0;                      // fraseo determinista desde 0
        this.cryptTimer = window.setInterval(() => this.cryptTick(), 140);
      }
    } else {
      g.linearRampToValueAtTime(0.0001, now + 1.8); // crossfade de salida
      if (this.cryptTimer !== null) { window.clearInterval(this.cryptTimer); this.cryptTimer = null; }
    }
  }

  /** Paso del scheduler de cripta (SOLO con la capa on): goteo ocasional
   *  (~1 cada 4 s) y susurro filtrado más raro (~1 cada 10 s), fraseo
   *  DETERMINISTA por det01 (mismo arranque → misma secuencia). */
  private cryptTick() {
    if (!this.ctx || !this.cryptOn || !this.cryptGain) return;
    const ctx = this.ctx;
    const s = this.cryptStep++;
    if (det01(s * 3 + 13) < 0.035) {
      const f = 500 + Math.floor(det01(s * 5 + 29) * 4) * 180;   // 500..1040 Hz
      this.cryptDrip(ctx.currentTime + 0.02 + det01(s * 7 + 31) * 0.08, f, 0.05);
    }
    if (det01(s * 11 + 17) < 0.014) {
      this.cryptWhisper(ctx.currentTime + 0.05, 0.026, det01(s * 13 + 19));
    }
  }

  /** Un goteo: "plip" de agua — sine con subida rápida de pitch (la gota
   *  acelera al caer) + rebote más flojo en el charco. 4 nodos, desechables. */
  private cryptDrip(t: number, f: number, gain: number) {
    const ctx = this.ctx;
    if (!ctx || !this.cryptGain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g); g.connect(this.cryptGain);
    o.start(t); o.stop(t + 0.14);
    // rebote en el charco (más flojo y agudo, determinista)
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    const t2 = t + 0.16;
    o2.type = 'sine';
    o2.frequency.setValueAtTime(f * 1.15, t2);
    o2.frequency.exponentialRampToValueAtTime(f * 2.6, t2 + 0.05);
    g2.gain.setValueAtTime(0.0001, t2);
    g2.gain.linearRampToValueAtTime(gain * 0.35, t2 + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.07);
    o2.connect(g2); g2.connect(this.cryptGain);
    o2.start(t2); o2.stop(t2 + 0.1);
  }

  /** Susurro filtrado: ráfaga de ruido COMPARTIDO por bandpass estrecho que
   *  sube y se apaga (como alguien que respira al fondo del pasillo).
   *  Offset del buffer por det01 (determinista, ver política del archivo). */
  private cryptWhisper(t: number, gain: number, seed: number) {
    const ctx = this.ctx;
    if (!ctx || !this.cryptGain) return;
    const buf = this.sharedNoise();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const f0 = 700 + seed * 500;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.linearRampToValueAtTime(f0 * 1.6, t + 1.1);
    bp.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.4);
    src.connect(bp); bp.connect(g); g.connect(this.cryptGain);
    const need = 1.5;
    const off = need < buf.duration ? det01(seed * 997 + 3) * (buf.duration - need) : 0;
    src.start(t, off); src.stop(t + need);
  }

  // ---- 2) Pincho: "shk" metálico corto — ruido filtrado con pitch       ----
  // ----    descendente + parcial metálico + golpe de mecanismo.          ----
  // Rate-limit AGRESIVO de 90 ms: el jugador puede pisar varios pinchos en
  // pocos frames y no debe ametrallar (política rl(), clave propia).
  spikeUp() {
    this.init();
    if (!this.ctx || !this.rl('spikeUp', 0.09)) return;
    this.sNoise(0.09, 5400, 0.13, 'bandpass', 0, 1400);  // shk (barrido ↓)
    this.sTone(2900, 2100, 0.05, 'square', 0.035, 0.005); // ring metálico
    this.sNoise(0.05, 900, 0.06, 'lowpass', 0.01);        // clunk del mecanismo
  }

  // ---- 3) Palanca: clac-clac mecánico + resollo de puerta LEJANA (el     ----
  // ----    mecanismo despierta algo al otro lado de la cripta).           ----
  leverPull() {
    this.init();
    if (!this.ctx || !this.rl('leverPull', 0.18)) return;
    this.sNoise(0.025, 2800, 0.16, 'bandpass');            // clac
    this.sTone(320, 150, 0.05, 'square', 0.1);             // cuerpo del clac
    this.sNoise(0.04, 1900, 0.13, 'bandpass', 0.08);       // clac-clac
    this.sNoise(1.0, 210, 0.09, 'lowpass', 0.16, 65);      // resollo lejano
    this.sTone(66, 36, 0.9, 'sine', 0.07, 0.18);           // masa de piedra
  }

  // ---- 4) Puerta de piedra abriéndose: rumble grave largo + fricción +   ----
  // ----    chillido agudo corto del eje + asentamiento final.            ----
  doorOpen() {
    this.init();
    if (!this.ctx || !this.rl('doorOpen', 0.45)) return;
    this.sNoise(1.5, 170, 0.15, 'lowpass', 0, 75);         // rumble de piedra
    this.sTone(58, 30, 1.3, 'sine', 0.13);                 // masa grave
    this.sNoise(1.1, 480, 0.05, 'bandpass', 0.1, 240);     // fricción media
    this.sTone(1750, 3300, 0.14, 'sawtooth', 0.04, 0.22);  // chillido del eje
    this.sNoise(0.16, 4600, 0.045, 'highpass', 0.22);      // brillo del chillido
    this.sNoise(0.2, 300, 0.12, 'lowpass', 1.25, 90);      // asienta al parar
  }

  // ---- 5) Manada: 3 aullidos ENTRELAZADOS con entradas escalonadas       ----
  // ----    deterministas (contadores → la n-ésima llamada suena igual,    ----
  // ----    pero consecutivas no se clonan). Volumen moderado (pico ≤0.04  ----
  // ----    por voz; el coro suma sin tapar la música). Rate-limit 1.4 s.  ----
  packHowl() {
    this.init();
    if (!this.ctx || !this.rl('packHowl', 1.4)) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.packN++;
    const base = 210 + det01(n * 3 + 23) * 60;   // 210..270 Hz por llamada
    for (let i = 0; i < 3; i++) {
      const d = i * 0.36 + det01(n * 5 + i * 7 + 31) * 0.14;          // escalonado
      const m = PACK_RATIO[i] * (0.96 + det01(n * 11 + i * 13 + 37) * 0.08);
      this.packVoice(t + d, base * m, 0.038 - i * 0.006, det01(n * 17 + i * 19 + 41));
    }
    // aliento de la manada bajo el coro (ruido COMPARTIDO, muy flojo)
    this.sNoise(2.2, 520, 0.018, 'bandpass', 0.2, 260);
  }

  /** Una voz del coro: contorno sube-meseta-baja (mismo gesto que el aullido
   *  lejano R9-8, más corto) con vibrato barato. 4 nodos por voz. */
  private packVoice(t0: number, f: number, gain: number, seed: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.62, t0);
    o.frequency.exponentialRampToValueAtTime(f, t0 + 0.5);          // sube
    o.frequency.setValueAtTime(f, t0 + 1.05);                      // meseta
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t0 + 1.9);  // cae y muere
    const vib = ctx.createOscillator();
    vib.type = 'sine'; vib.frequency.value = 4.8 + seed * 1.4;
    const vg = ctx.createGain(); vg.gain.value = f * 0.012;
    vib.connect(vg); vg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.28);
    g.gain.setValueAtTime(gain, t0 + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + 2.1);
    vib.start(t0); vib.stop(t0 + 2.1);
  }

  // ---- 6) Hallazgo del Eco: campanita cálida (2 armónicos ascendentes)   ----
  // ----    + eco corto. El eco se hace RE-DISPARANDO sTone más flojo      ----
  // ----    (cero nodos extra, determinista). Rate-limit 0.3 s.            ----
  echoFind() {
    this.init();
    if (!this.ctx || !this.rl('echoFind', 0.3)) return;
    this.sTone(880, 880, 0.5, 'sine', 0.11);               // La5 (campana)
    this.sTone(1320, 1320, 0.42, 'sine', 0.055, 0.1);      // Mi6 (armónico ↑)
    this.sTone(2793, 2793, 0.2, 'sine', 0.02, 0.02);       // brillo inarmónico
    this.sTone(880, 880, 0.3, 'sine', 0.04, 0.24);         // eco 1
    this.sTone(1320, 1320, 0.26, 'sine', 0.02, 0.34);      // eco 2
  }

  // ---- 7) Interior de casa: capa cálida de hogar (cuerpo de fuego grave   ----
  // ----    + crepitar determinista) y EXTERIOR APAGADO vía el bus de la   ----
  // ----    capa nocturna EXISTENTE (mismo acceso de clase): al entrar baja ----
  // ----    a INTERIOR_NIGHT_MUL; al salir lo restaura si sigue de noche.   ----
  // ----    nightAmbience también respeta el pato al (re)programar SU       ----
  // ----    crossfade → invariante en cualquier orden de llamada.           ----
  // IDEMPOTENTE (no-op si ya está en el estado), crossfade suave.
  interiorAmbience(on: boolean) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    if (on === this.interiorOn) return; // ya en el estado pedido → no-op seguro
    this.interiorOn = on;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (this.nightGain) {
      const ng = this.nightGain.gain;
      ng.cancelScheduledValues(now);
      ng.setValueAtTime(Math.max(0.0001, ng.value), now);
      if (on) ng.linearRampToValueAtTime(INTERIOR_NIGHT_MUL, now + 1.4);      // exterior apagado
      else if (this.nightOn) ng.linearRampToValueAtTime(1, now + 1.4);        // restaurar exterior
    }
    if (!this.interiorGain) {
      // Bus de la capa (creado UNA vez; reutilizado en on/off posteriores).
      const bus = ctx.createGain();
      bus.gain.value = 0.0001;
      bus.connect(this.sfxGain);
      // Cuerpo del fuego: ruido COMPARTIDO en loop, lowpass grave con LFO
      // muy lento (0.11 Hz) — la hoguera "respira" sin tocar la envolvente.
      const body = ctx.createBufferSource();
      body.buffer = this.sharedNoise();
      body.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 150; lp.Q.value = 0.4;
      const bg = ctx.createGain(); bg.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.11;
      const lg = ctx.createGain(); lg.gain.value = 45;
      lfo.connect(lg); lg.connect(lp.frequency);
      body.connect(lp); lp.connect(bg); bg.connect(bus);
      body.start(now); lfo.start(now);
      this.interiorGain = bus;
    }
    const g = this.interiorGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    if (on) {
      g.linearRampToValueAtTime(1, now + 1.8);   // crossfade de entrada
      if (this.interiorTimer === null) {
        this.interiorStep = 0;                   // fraseo determinista desde 0
        this.interiorTimer = window.setInterval(() => this.interiorTick(), 130);
      }
    } else {
      g.linearRampToValueAtTime(0.0001, now + 1.2); // crossfade de salida
      if (this.interiorTimer !== null) { window.clearInterval(this.interiorTimer); this.interiorTimer = null; }
    }
  }

  /** Paso del scheduler del hogar (SOLO con la capa on): crepitar de brasas
   *  DETERMINISTA — pops cortos de ruido filtrado, doble pop ocasional. */
  private interiorTick() {
    if (!this.ctx || !this.interiorOn || !this.interiorGain) return;
    const ctx = this.ctx;
    const s = this.interiorStep++;
    if (det01(s * 3 + 43) < 0.3) {
      const t = ctx.currentTime + 0.01 + det01(s * 5 + 47) * 0.09;
      const f = 380 + Math.floor(det01(s * 7 + 53) * 4) * 160;  // 380..860 Hz
      this.interiorCrackle(t, f, 0.02 + det01(s * 11 + 59) * 0.03);
    }
    if (det01(s * 13 + 61) < 0.06) {   // rama menuda que se quiebra (2 pops)
      const t = ctx.currentTime + 0.06;
      this.interiorCrackle(t, 900, 0.022);
      this.interiorCrackle(t + 0.07, 640, 0.016);
    }
  }

  /** Un pop de crepitar: ráfaga de ruido COMPARTIDO por bandpass, 45 ms.
   *  Offset del buffer por det01 (determinista, ver política del archivo). */
  private interiorCrackle(t: number, f: number, gain: number) {
    const ctx = this.ctx;
    if (!ctx || !this.interiorGain) return;
    const buf = this.sharedNoise();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(bp); bp.connect(g); g.connect(this.interiorGain);
    const need = 0.06;
    const off = need < buf.duration ? det01(Math.floor(t * 1000) * 7 + f) * (buf.duration - need) : 0;
    src.start(t, off); src.stop(t + need);
  }

  // ---- 8) Línea del viajero: blip de diálogo suave y discreto (2 notas   ----
  // ----    triangle) con leve variación determinista por contador.        ----
  travelerLine() {
    this.init();
    if (!this.ctx || !this.rl('travelerLine', 0.14)) return;
    const f = 620 + Math.floor(det01(this.lineN++ * 5 + 3) * 4) * 40; // 620..740
    this.sTone(f, f * 1.02, 0.055, 'triangle', 0.045);          // nota 1
    this.sTone(f * 1.335, f * 1.335, 0.075, 'triangle', 0.04, 0.07); // nota 2 ↑
  }
}

// R16 (#19 QA): MODO DEGRADADO. Un AudioContext cerrado o roto (ctx.close(),
// cambio de dispositivo, nodo inválido) lanzaba DENTRO de update/render y
// tumbaba el frame entero cada vez (pantalla negra con error en bucle). Cada
// llamada pública pasa ahora por un envoltorio con try/catch; tras
// AUDIO_MAX_FAILS fallos el motor de audio se silencia para el resto de la
// sesión en vez de seguir lanzando. Funciones envueltas cacheadas (cero
// alloc por llamada en régimen).
const AUDIO_MAX_FAILS = 20;
let audioFails = 0;
const audioRaw = new AudioEngine();
const wrapped = new Map<PropertyKey, unknown>();
export const audio: AudioEngine = new Proxy(audioRaw, {
  get(target, prop, recv) {
    const v = Reflect.get(target, prop, recv);
    if (typeof v !== 'function') return v;
    let w = wrapped.get(prop);
    if (!w) {
      w = (...args: unknown[]) => {
        if (audioFails >= AUDIO_MAX_FAILS) return undefined;
        // se resuelve en CADA llamada: si alguien reasigna el método (stubs de
        // los smokes, parches en caliente) el envoltorio cacheado no queda viejo
        const fn = Reflect.get(target, prop) as (...a: unknown[]) => unknown;
        try { return fn.apply(target, args); } catch (err) {
          audioFails++;
          if (audioFails === AUDIO_MAX_FAILS) {
            console.warn('[EcosAelthar] audio desactivado tras errores repetidos:', err);
            try { target.stopMusic(); } catch { /* noop */ }
          }
          return undefined;
        }
      };
      wrapped.set(prop, w);
    }
    return w;
  },
});

// ============================================================
// R9-8 · API EXPORT para el orquestador (envoltorios delgados sobre
// el singleton `audio`). Nombres EXACTOS pactados para el cableado.
// ============================================================

/** Carga de hechizo (épica 7.5): arpegio ascendente rápido + shimmer con
 *  vibrato creciente. Corto (<0.4 s). Cablear en spells.ts/update.ts justo
 *  cuando el jugador INICIA el casteo (antes del proyectil). */
export function playSpellCast(): void { audio.spellCast(); }

/** Impacto de hechizo (épica 7.5): golpe grave + destello agudo.
 *  big=true → muerte por hechizo (más grave + cola de resonancia ~0.8 s).
 *  Cablear en spells.ts al conectar el impacto; big=true también en
 *  update.ts cuando el golpe de hechizo remata (kill) a un enemigo. */
export function playSpellImpact(big: boolean): void { audio.spellImpact(big); }

/** Capa ambiental nocturna (épica 5.3): grillos sintetizados (fraseo
 *  determinista) + viento tenue grave, con crossfade suave. IDEMPOTENTE:
 *  seguro de llamar CADA FRAME desde update.ts (p.ej.
 *  playNightAmbience(esDeNoche && mapaBosque);) — si ya está en el estado
 *  pedido es no-op y no programa nada. */
export function playNightAmbience(on: boolean): void { audio.nightAmbience(on); }

/** Aullido lejano ocasional de noche (épica 5.3): tono sube-meseta-baja con
 *  eco barato (delay+feedback), volumen bajo y variación determinista por
 *  llamada. Cablear en update.ts disparado por hash de tiempo de juego
 *  (p.ej. cada ~20-40 s de noche, nunca dos veces seguidas por el
 *  rate-limit interno de 0.6 s). */
export function playHowlDistant(): void { audio.howlDistant(); }

/** Rugido de jefe con 4 variantes DETERMINISTAS según seed (épica 7.5):
 *  mismo seed → mismo rugido (variante |seed|%4 + micro-afinación por
 *  hash). Cablear en bossintro/bossfx o donde hoy suena sfx('roar'),
 *  pasando el seed de la entidad/encuentro (p.ej. boss.id o hash de sala). */
export function playBossRoarVariant(seed: number): void { audio.bossRoarVariant(seed); }

// ============================================================
// R10-7 · API EXPORT para el orquestador (envoltorios delgados sobre
// el singleton `audio`). Nombres EXACTOS pactados para el cableado.
// ============================================================

/** Capa ambiental de CRIPTA (épica 6.4): dron grave disonante (raíz + batido
 *  de 2.ª menor + tritono, con respiración lenta) + goteo determinista
 *  ocasional + susurro filtrado esporádico, con crossfade suave. IDEMPOTENTE:
 *  seguro de llamar CADA FRAME (p.ej. playCryptAmbience(g.mapId === 'cripta');)
 *  — si ya está en el estado pedido es no-op y no programa nada. El orquestador
 *  la activa al entrar en 'cripta' y la apaga al salir. */
export function playCryptAmbience(on: boolean): void { audio.cryptAmbience(on); }

/** "Shk" metálico corto del pincho al salir (épica 6.4): ruido filtrado con
 *  pitch descendente + ring metálico + clunk de mecanismo. Rate-limit
 *  agresivo de 90 ms — el jugador puede pisar varios pinchos seguidos.
 *  Cablear en el momento en que la trampa SE ACTIVA (pinchos suben). */
export function playSpikeUp(): void { audio.spikeUp(); }

/** Palanca activada (épica 6.4): clac-clac mecánico + resollo de puerta
 *  lejana (el mecanismo despierta piedra al otro lado). Cablear cuando la
 *  palanca pasa a estado activado (ONCE por activación). */
export function playLeverPull(): void { audio.leverPull(); }

/** Puerta de piedra abriéndose (épica 6.4): rumble grave largo + fricción +
 *  chillido agudo corto del eje + asentamiento final (~1.5 s). Cablear en
 *  el evento de apertura de puerta (bosque→cripta y puertas Zelda). */
export function playDoorOpen(): void { audio.doorOpen(); }

/** Aullidos MÚLTIPLES entrelazados de la manada (épica 6.6): 3 voces con
 *  entradas escalonadas y afinación DETERMINISTAS (contadores internos),
 *  volumen moderado (pico ≤0.04 por voz). Cablear al aparecer/agro de la
 *  manada (evento aleatorio) o por ventana de tiempo mientras esté viva. */
export function playPackHowl(): void { audio.packHowl(); }

/** Hallazgo del Eco (épica 6.6): campanita cálida — 2 armónicos ascendentes
 *  (La5→Mi6) + brillo inarmónico + eco corto (re-disparos atenuados).
 *  Cablear al recoger/hallar el Eco en el evento aleatorio de hallazgo. */
export function playEchoFind(): void { audio.echoFind(); }

/** Interior de casa (épica 6.5): capa cálida de hogar (cuerpo de fuego grave
 *  + crepitar determinista) y EXTERIOR APAGADO bajando el bus de la capa
 *  nocturna EXISTENTE a 0.28 mientras dure (se restaura al salir si sigue de
 *  noche; nightAmbience respeta el pato en cualquier orden de llamada).
 *  IDEMPOTENTE: seguro de llamar CADA FRAME (p.ej.
 *  playInteriorAmbience(estoyDentroDeCasa);). */
export function playInteriorAmbience(on: boolean): void { audio.interiorAmbience(on); }

/** Blip de diálogo del viajero (épica 6.6): 2 notas triangle suaves y
 *  discretas con leve variación determinista. Cablear al pintar cada línea
 *  de diálogo del viajero (evento aleatorio de encuentro). */
export function playTravelerLine(): void { audio.travelerLine(); }
