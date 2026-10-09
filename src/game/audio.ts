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

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  combatBus!: GainNode;

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
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMusicVol(v: number) { this.musicVol = v; if (this.musicGain) this.musicGain.gain.value = v; }
  setSfxVol(v: number) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; }

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
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
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
      while (this.nextNoteTime < this.ctx.currentTime + 0.18) {
        this.loopNo = Math.floor(this.step / 32); // para micro-variación (10-c)
        this.scheduleStep(pat, this.step % 32, this.nextNoteTime, stepDur);
        this.step++;
        this.nextNoteTime += stepDur;
      }
    }, 40);
  }

  stopMusic() {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
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
      g.linearRampToValueAtTime(1, now + 2.4);   // crossfade de entrada
      if (this.nightTimer === null) {
        this.nightStep = 0;                       // fraseo determinista desde 0
        this.nightTimer = window.setInterval(() => this.nightTick(), 120);
      }
    } else {
      g.linearRampToValueAtTime(0.0001, now + 1.6); // crossfade de salida
      if (this.nightTimer !== null) { clearInterval(this.nightTimer); this.nightTimer = null; }
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
}

export const audio = new AudioEngine();

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
