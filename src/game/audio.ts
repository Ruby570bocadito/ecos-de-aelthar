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

function noteFreq(n: string): number | null {
  if (n === '-' || n === '.') return null;
  const m = NOTE_RE.exec(n);
  if (!m) return null;
  const base: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  let semi = base[m[1]];
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
  drums: 'h...k...h...k...h...k...h.s.k..',
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

const TRACKS: Record<TrackName, Pattern> = {
  village: VILLAGE, forest: FOREST, crypt: CRYPT, boss: BOSS, title: TITLE,
};

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
    if (this.cur === name) return;
    this.cur = name;
    this.step = 0;
    this.drumGain = 0;
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

  setCombat(on: boolean) { this.combatOn = on; }

  private scheduleStep(pat: Pattern, step: number, t: number, dur: number) {
    if (!this.ctx) return;
    const lead = pat.lead[step % pat.lead.length];
    if (lead && lead !== '-') {
      const f = noteFreq(lead);
      if (f) this.tone(f, t, dur * 1.9, pat.leadType, pat.gainLead ?? 0.15, this.musicGain, 0.004, dur * 0.5);
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
    }
  }

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

  private noiseBurst(t: number, dur: number, freq: number, gain: number, filter: BiquadFilterType) {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // ---------------- SFX ----------------

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
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
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
    src.start(t); src.stop(t + dur + 0.02);
  }

  sfx(name: string) {
    this.init();
    if (!this.ctx) return;
    switch (name) {
      case 'swing': this.sNoise(0.09, 2600, 0.16, 'bandpass', 0, 900); break;
      case 'swing2': this.sNoise(0.11, 2100, 0.18, 'bandpass', 0, 700); break;
      case 'hit': this.sTone(300, 90, 0.1, 'square', 0.2); this.sNoise(0.06, 1200, 0.14); break;
      case 'crit': this.sTone(520, 110, 0.16, 'square', 0.24); this.sNoise(0.1, 2400, 0.18); break;
      case 'parry': this.sTone(1250, 1900, 0.09, 'square', 0.2); this.sTone(2500, 3100, 0.14, 'sine', 0.16, 0.02); break;
      case 'parryFail': this.sTone(500, 380, 0.08, 'square', 0.1); break;
      case 'dodge': this.sNoise(0.14, 900, 0.1, 'bandpass', 0, 3200); break;
      case 'hurt': this.sTone(280, 120, 0.14, 'sawtooth', 0.18); break;
      case 'enemyDie': this.sTone(340, 60, 0.3, 'sawtooth', 0.16); this.sNoise(0.2, 700, 0.12, 'lowpass'); break;
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
      default:
        // SFX desconocido: no-op seguro (no rompe el juego)
        break;
    }
  }
}

export const audio = new AudioEngine();
