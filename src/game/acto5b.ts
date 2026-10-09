// ============================================================
// ECOS DE AELTHAR — R14 «La Ciudadela» · Lógica del Acto V fase 2
// Módulo autosuficiente (patrón acto5.ts): mecánica propia del mapa
// nuevo + el hook de acciones del acto. Sin tocar update.ts.
//
//  1) LA MURALLA QUE CANTA (biblia §711). En la Ciudadela cada paso
//     suena: la piedra aprendió a cantar cada pisada «como se canta a
//     los que se van». Cada 4 tiles andados suena UNA nota de bienvenida
//     (plata-azul; el sfx cada 3ª para no cansar). A diferencia de la
//     Cuna, aquí NO hay ritmo que romper: la ciudad no juzga el paso,
//     solo lo acompaña (trescientos años de práctica).
//
//  2) EL HOOK DE ACCIONES R14 (lo llama hooks.handleCustomAction):
//     · accept_q18      — la Guarda abre la antecámara de la Cripta
//     · acto5_verdad1/3 — devolver las verdades de los distritos
//     · acto5_forzar1/3 — LA OPCIÓN MALA: forzar una cadena (rep −)
//     · acto5_naia      — el nombre de Naia, dicho en voz alta
//     · acto5_consejo   — la recompensa del Consejo + gancho R15
//     + watcher idempotente: las tres verdades → cadena del Consejo.
//
// Todo por canales públicos del motor (g.toast/g.flags/g.questAdvance/
// p.repFacciones) + fxcore. Cero allocations por frame en reposo.
// ============================================================

import type { Game } from './engine';
import { TILE } from './sprites';
import { audio } from './audio';
import { addShake, addFlash } from './fxcore';

// ---------------- 1) La muralla que canta ----------------

const PASO_TILES = 4;        // tiles andados = una nota de bienvenida
const SFX_CADA = 3;          // el sfx suena cada 3ª nota

// Plata-azul: el color de la espera cumplida (no del luto).
const MURALLA_CFG = Array.from({ length: 5 }, (_, i) => ({
  a: -Math.PI / 2 + ((i % 3) - 1) * 0.5,
  s: 16 + (i % 3) * 10,
  sz: 0.8 + (i % 2) * 0.35,
  stem: i % 2 === 0,
  life: 0.8 + (i % 3) * 0.12,
}));

let pasos = 0;
let lastX = 0, lastY = 0;
let notaIdx = 0;
let lastPlayer: unknown = null;

export function acto5TickR14(g: Game, dt: number): void {
  void dt; // el canto es por distancia, no por tiempo
  const p = g.player;
  if (!p || g.mapId !== 'ciudadela') { lastPlayer = p; return; }
  // partida nueva / carga: los pasos a cero
  if (p !== lastPlayer) { lastPlayer = p; pasos = 0; lastX = p.x; lastY = p.y; }
  if (g.state !== 'play') return;

  const moved = Math.hypot(p.x - lastX, p.y - lastY);
  lastX = p.x; lastY = p.y;
  if (moved <= 0.01) return;

  pasos += moved;
  if (pasos < PASO_TILES * TILE) return;
  pasos = 0;

  // UNA nota de bienvenida: la muralla canta tu pisada, siempre
  const n = MURALLA_CFG[notaIdx++ % MURALLA_CFG.length];
  const nx = p.x + Math.cos(n.a) * 5;
  const ny = p.y - 9 + Math.sin(n.a) * 3;
  g.particles.push({
    x: nx, y: ny, vx: Math.cos(n.a) * n.s, vy: Math.sin(n.a) * n.s - 14,
    t: n.life, maxT: n.life, color: notaIdx % 2 ? '#a8b8d8' : '#c8d0e8', size: n.sz, grav: -10,
  });
  if (n.stem) {
    g.particles.push({
      x: nx + n.sz * 1.5, y: ny - n.sz * 2,
      vx: Math.cos(n.a) * n.s * 0.85, vy: Math.sin(n.a) * n.s - 12,
      t: n.life * 0.8, maxT: n.life, color: '#8ea0c0', size: 0.65, grav: -10,
    });
  }
  if (notaIdx % SFX_CADA === 0) audio.sfx('blip');
}

// ---------------- 2) El hook de acciones R14 ----------------

// Reputación (mismo patrón rep_* de hooks.ts, duplicado para autosuficiencia)
const REP_LABELS: Record<string, string> = {
  guardianes: 'Guardianes del Canto', orden: 'Orden de Vesh',
  circulo: 'Círculo Verde', liga: 'Liga de Mercaderes',
};

function repAdd(g: Game, fac: string, delta: number): void {
  const p = g.player;
  if (!p) return;
  const rep = p.repFacciones ?? { guardianes: 0, orden: 0, circulo: 0, liga: 0 };
  const before = rep[fac] ?? 0;
  const after = Math.max(-100, Math.min(100, before + delta));
  rep[fac] = after;
  p.repFacciones = rep;
  const applied = after - before;
  if (applied !== 0) g.toast(`${REP_LABELS[fac]}: ${applied >= 0 ? '+' : ''}${applied}`, applied >= 0 ? '#8ef0b0' : '#e88a8a');
}

/** Devolver una verdad del distrito: la cadena cae, la guardia baja sin espada. Idempotente. */
function devolverVerdad(g: Game, n: 1 | 2 | 3): void {
  const f = g.flags;
  const key = `ciudV${n}` as string;
  if (!f[key]) {
    f[key] = true;
    repAdd(g, 'orden', 6); // la Orden recuerda a quien devuelve
    audio.sfx('echo');
    if (g.player) g.burst(g.player.x, g.player.y - 8, '#ffe9a0', 18, 70);
    addFlash(g, '#ffe9a0', 0.12);
  }
}

/** LA OPCIÓN MALA: forzar una cadena. La verdad vuelve, pero con sangre en la piedra. */
function forzarCadena(g: Game, n: 1 | 2 | 3): void {
  const f = g.flags;
  const key = `ciudV${n}` as string;
  if (!f[key]) {
    f[key] = true;
    f.ciudSangre = true;
    repAdd(g, 'orden', -8); // los vecinos con lanza también tienen memoria
    audio.sfx('break');
    addShake(g, 4);
    if (g.player) g.burst(g.player.x, g.player.y - 8, '#c07878', 20, 80);
    g.toast('La cadena cede con un crujido que toda la Ciudadela oye', '#e88a8a');
  }
}

export function acto5R14Hook(g: Game, action: string): boolean {
  const f = g.flags;
  if (!g.player) return false;

  // ---- watcher idempotente (patrón acto5CatchUp): las tres verdades ----
  if (g.questIdx === 17 && g.questStep === 2 && f.ciudV1 && f.ciudV2 && f.ciudV3) {
    g.questAdvance();
    if (!f.ciudConsejo) {
      f.ciudConsejo = true;
      audio.sfx('quest');
    }
    g.toast('Las tres verdades vuelven a su lugar: el Consejo aguarda en la Antecámara', '#8ef0b0');
  }
  // reparación de saves a medio aceptar (q18 con flag pero índice viejo)
  if (g.questIdx === 16 && f.q18 && f.acto4Done) { g.questIdx = 17; g.questStep = 1; }

  // ---- accept_q18: la Guarda abre la antecámara oeste de la Cripta ----
  if (action === 'accept_q18') {
    if (g.questIdx < 17) { g.questIdx = 17; g.questStep = 1; }
    if (!f.q18) {
      f.q18 = true;
      audio.sfx('quest');
      g.toast('Nueva misión: La Ciudadela', '#8ef0b0');
    }
    if (!f.acto5CiudAbierta) {
      f.acto5CiudAbierta = true;
      g.toast('La puerta oeste de la Cripta se abre: la Orden espera desde hace trescientos años', '#c8d0e8');
    }
    return true;
  }

  // ---- las tres verdades que se devuelven (la forma buena) ----
  if (action === 'acto5_verdad1') {
    devolverVerdad(g, 1);
    if (f.ciudV1 && g.questStep >= 0) g.toast('El Libro del Primer Eco descansa en su estante: la guardia de la Biblioteca baja sin una espada', '#ffe9a0');
    return true;
  }
  if (action === 'acto5_verdad2') {
    devolverVerdad(g, 2);
    if (f.ciudV2 && g.questStep >= 0) g.toast('Los nombres dichos en voz alta encienden la Sala: la guardia de los Nombres baja', '#ffe9a0');
    return true;
  }
  if (action === 'acto5_verdad3') {
    devolverVerdad(g, 3);
    if (f.ciudV3 && g.questStep >= 0) g.toast('La orden póstuma completa descansa en el archivo: la guardia de la Lanza baja', '#ffe9a0');
    return true;
  }

  // ---- LA OPCIÓN MALA: forzar las cadenas (la Orden lo recuerda) ----
  if (action === 'acto5_forzar1') { forzarCadena(g, 1); return true; }
  if (action === 'acto5_forzar2') { forzarCadena(g, 2); return true; }
  if (action === 'acto5_forzar3') { forzarCadena(g, 3); return true; }

  // ---- acto5_naia: el catecismo de los faroles (§734) ----
  // El nombre de Naia, dicho en voz alta. Los faroles restantes se encienden.
  if (action === 'acto5_naia') {
    if (!f.naiaNombre) {
      f.naiaNombre = true;
      f.farol_n1 = true; f.farol_n2 = true; f.farol_n3 = true; // la sala entera despierta
      repAdd(g, 'guardianes', 5); // nombrar es sostener
      audio.sfx('lamp');
      audio.sfx('song');
      addFlash(g, '#ffe9a0', 0.15);
      if (g.player) {
        g.burst(g.player.x, g.player.y - 8, '#ffe9a0', 24, 85);
        g.floatAt(g.player.x, g.player.y - 26, '...Naia...', '#ffe9a0', 9);
      }
      g.toast('«Naia». El nombre vuelve a existir: los faroles de la Sala cantan juntos', '#ffe9a0');
    }
    return true;
  }

  // ---- acto5_consejo: la recompensa del Consejo (una vez) + gancho R15 ----
  if (action === 'acto5_consejo') {
    const p = g.player;
    if (g.questIdx === 17 && g.questStep >= 3 && !f.acto5Paid18) {
      f.acto5Paid18 = true;
      p.gold += 200; p.potions += 1;
      repAdd(g, 'orden', 10);
      audio.sfx('quest');
      g.floatAt(p.x, p.y - 26, 'Recompensa: +200 coronas y 1 poción', '#f0c84a', 7);
      g.toast('El Consejo nombra al Portador «el primero que volvió» (+200 coronas, +1 poción)', '#8ef0b0');
      if (g.questStep < 3) g.questAdvance(); // patrón q17: avanzar HASTA el último paso, nunca más allá
      f.acto5Fase2 = true; // gancho R15 «El Silencio de Arriba»
    }
    return true;
  }

  return false;
}
