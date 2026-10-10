// ============================================================
// ECOS DE AELTHAR — SELLOS DE LA NIEBLA (R18 «El camino se gana»)
//
// La historia marca el orden del viaje: antes se podía cruzar a la Costa,
// al Bosque o a las Cumbres en el minuto uno y la trama quedaba rota. Cada
// salida exterior tiene ahora un SELLO de Niebla Muda que se abre cuando
// la historia llega a ese punto:
//
//   Lunaris → Bosque    tras «Lobos en la Niebla» (Brisa abre el norte)
//   Bosque  → Cripta    tras tocar el Fragmento de la Ruina Antigua
//   Lunaris → Costa     tras «Ecos de Esperanza» (el mar llama al Portador)
//   Costa   → Merrow    tras calmar a la Sirena Abisal
//   Bosque  → Cumbres   tras «La Aldea que Olvidó su Nombre»
//   (+ las secciones nuevas de R18 tienen sus propios sellos en sections.ts)
//
// El sello es una cortina de niebla con runas, sólida: empuja al Portador
// de vuelta y le dice POR QUÉ (en voz de la historia, no de menú). Los
// sellos ya abiertos no se vuelven a cerrar. Las salidas sin regla siguen
// como siempre (interiores, Ciudadela/Cuna con sus flags propias).
// ============================================================

import type { Game } from './engine';
import type { ExitDef, MapId } from './types';
import { TILE } from './sprites';
import { audio } from './audio';
import { applyKnockback, addShake } from './fxcore';

export interface GateRule {
  from: MapId | string;
  to: MapId | string;
  /** ¿Abierto? (lee el estado de la historia) */
  open: (g: Game) => boolean;
  /** Qué te dice el mundo al toparte con el sello. */
  why: string;
  /** Pista corta para el minimapa / HUD. */
  hint: string;
}

export const GATES: GateRule[] = [
  {
    from: 'lunaris', to: 'bosque',
    open: g => g.questIdx >= 2,
    why: 'La Niebla Muda cierra el paso del norte. Brisa te pidió despejar primero el valle de lobos.',
    hint: 'Completa «Lobos en la Niebla»',
  },
  {
    from: 'bosque', to: 'cripta',
    open: g => g.questIdx >= 3 || !!g.flags.fragmentTouched,
    why: 'Un velo de niebla sella la escalera de la Cripta. Algo en la Ruina Antigua tiene que despertar antes.',
    hint: 'Toca el Fragmento de la Ruina Antigua',
  },
  {
    from: 'lunaris', to: 'costa',
    open: g => g.questIdx >= 5,
    why: 'El camino del sur se pierde en una niebla espesa que huele a sal. Aún no oyes al mar llamarte.',
    hint: 'Recupera el primer Eco y vuelve con Brisa',
  },
  {
    from: 'costa', to: 'aldea',
    open: g => g.questIdx >= 7 || !!g.flags.sirenaDefeated,
    why: 'La calzada a Merrow está velada. Mientras la Sirena cante, la niebla no deja pasar a nadie.',
    hint: 'Calma a la Sirena Abisal',
  },
  {
    from: 'bosque', to: 'cumbres',
    open: g => g.questIdx >= 8,
    why: 'El paso del noreste está helado de silencio. Las Cumbres esperan a que Merrow recuerde su nombre.',
    hint: 'Completa «La Aldea que Olvidó su Nombre»',
  },
];

/** Reglas extra registradas por otros módulos (secciones nuevas). */
const extra: GateRule[] = [];
export function registerGate(r: GateRule): void {
  if (!extra.some(e => e.from === r.from && e.to === r.to)) extra.push(r);
}

function ruleFor(from: string, to: string): GateRule | null {
  for (const r of GATES) if (r.from === from && r.to === to) return r;
  for (const r of extra) if (r.from === from && r.to === to) return r;
  return null;
}

/** null si la salida está abierta; si no, la regla que la sella. */
export function exitGate(g: Game, ex: ExitDef): GateRule | null {
  if (g.challengeRun) return null;
  const r = ruleFor(g.mapId, ex.to);
  if (!r) return null;
  return r.open(g) ? null : r;
}

let lastToastT = -99;
/**
 * El Portador pisa un sello cerrado: empujón hacia el interior del mapa,
 * temblor leve, aviso con la razón (como mucho cada 2,5 s) y anillo de runas.
 */
export function bumpGate(g: Game, ex: ExitDef, r: GateRule): void {
  const p = g.player;
  if (!p) return;
  const cx = (ex.x + ex.w / 2) * TILE, cy = (ex.y + ex.h / 2) * TILE;
  const mx = (g.map.w * TILE) / 2, my = (g.map.h * TILE) / 2;
  // hacia el centro del mapa (las salidas viven en los bordes)
  const dx = mx - cx, dy = my - cy;
  const ax = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
  const ay = ax === 0 ? Math.sign(dy) : 0;
  applyKnockback(p, ax, ay, 210);
  p.x += ax * 3; p.y += ay * 3;
  if (g.globalT - lastToastT > 2.5) {
    lastToastT = g.globalT;
    g.toast(r.why, '#c8b0e8');
    addShake(g, 2);
    audio.sfx('error');
    g.burst(p.x + ax * -10, p.y + ay * -10, '#c8d0e8', 10, 50);
  }
}

/** ¿El tile (tx,ty) cae dentro de una salida SELLADA? (para el dibujo) */
export function lockedExits(g: Game): { ex: ExitDef; r: GateRule }[] {
  const out: { ex: ExitDef; r: GateRule }[] = [];
  for (const ex of g.map.exits) {
    const r = exitGate(g, ex);
    if (r) out.push({ ex, r });
  }
  return out;
}

type Proj = (n: number) => number;
/**
 * Cortina de Niebla Muda sobre cada salida sellada: bandas que se arremolinan,
 * runas que laten y un velo más denso en el centro (pase de mundo).
 */
export function drawGates(ctx: CanvasRenderingContext2D, g: Game, sx: Proj, sy: Proj, Z: number): void {
  const list = lockedExits(g);
  if (!list.length) return;
  const t = g.globalT;
  for (const { ex } of list) {
    // la cortina se adentra 2 tiles hacia el interior del mapa (las salidas
    // viven en el borde y la cámara las recorta)
    let gx = ex.x, gy = ex.y, gw = ex.w, gh = ex.h;
    if (ex.y <= 1) gh += 2;
    else if (ex.y + ex.h >= g.map.h - 1) { gy -= 2; gh += 2; }
    else if (ex.x <= 1) gw += 2;
    else if (ex.x + ex.w >= g.map.w - 1) { gx -= 2; gw += 2; }
    const x0 = sx(gx * TILE), y0 = sy(gy * TILE);
    const w = gw * TILE * Z, h = gh * TILE * Z;
    const pad = 6 * Z;
    ctx.save();
    // velo base
    const gr = ctx.createLinearGradient(x0, y0 - pad, x0, y0 + h + pad);
    gr.addColorStop(0, 'rgba(200,210,224,0)');
    gr.addColorStop(0.5, 'rgba(206,214,230,0.78)');
    gr.addColorStop(1, 'rgba(200,210,224,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x0 - pad, y0 - pad, w + pad * 2, h + pad * 2);
    // bandas que se arremolinan
    for (let i = 0; i < 10; i++) {
      const ph = t * (0.6 + i * 0.13) + i * 1.7;
      const bx = x0 - pad + ((Math.sin(ph) * 0.5 + 0.5) * (w + pad * 2 - 12 * Z));
      const by = y0 - pad + ((Math.cos(ph * 0.8 + i) * 0.5 + 0.5) * (h + pad * 2 - 6 * Z));
      ctx.fillStyle = `rgba(232,236,246,${(0.25 + 0.15 * Math.sin(ph * 2)).toFixed(3)})`;
      ctx.fillRect(bx, by, 12 * Z, 3 * Z);
    }
    // runas del sello
    const n = Math.max(2, Math.round((ex.w + ex.h) / 2));
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const rx = ex.w >= ex.h ? x0 + w * k : x0 + w / 2;
      const ry = ex.w >= ex.h ? y0 + h / 2 : y0 + h * k;
      const a = 0.45 + 0.35 * Math.sin(t * 3 + i * 1.3);
      ctx.strokeStyle = `rgba(184,160,240,${a.toFixed(3)})`;
      ctx.lineWidth = Z;
      ctx.beginPath();
      ctx.arc(rx, ry, 3.5 * Z, 0, Math.PI * 2);
      ctx.moveTo(rx - 2 * Z, ry); ctx.lineTo(rx + 2 * Z, ry);
      ctx.moveTo(rx, ry - 2 * Z); ctx.lineTo(rx, ry + 2 * Z);
      ctx.stroke();
    }
    ctx.restore();
  }
}
