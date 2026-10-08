// ============================================================
// ECOS DE AELTHAR — fx (AGENTE 3-a · visuales)
// Partículas ambientales por mapa (pool fijo, sin allocations
// masivas), polvo de pasos, estelas de esquiva y temporizadores
// de feedback (banner de jefe / overlay de memoria).
// Todo determinista donde puede (hash2) y sincronizado con globalT.
// ============================================================

import type { Game } from './engine';
import { VIEW_W, VIEW_H, ZOOM } from './engine';
import { hash2 } from './sprites';
import { isNight } from './update'; // solo lectura (propiedad del agente 3-b)

// ---------------- Tipos internos ----------------

const MOTA = 0;        // Lunaris día: motas doradas cálidas
const FIREFLY = 1;     // Lunaris noche: luciérnagas verdosas
const LEAF = 2;        // Bosque: hojas cayendo con vaivén
const SPORE = 3;       // Bosque: esporas flotantes
const ASH = 4;         // Cripta: ceniza azulada ascendente
const CRYPTWISP = 5;   // Cripta: wisps tenues

const AMB_CAP = 90;

interface Amb {
  active: boolean;
  kind: number;
  x: number; y: number;        // coordenadas de MUNDO (px)
  vx: number; vy: number;
  t: number;                   // edad
  maxT: number;                // vida útil
  seed: number;                // semilla determinista
  size: number;
}

// Pool fijo: se reutilizan las ranuras muertas (cero GC por frame)
const pool: Amb[] = Array.from({ length: AMB_CAP }, () => ({
  active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, maxT: 1, seed: 0, size: 1,
}));

let spawnAcc = 0;
let dustAcc = 0;

// temporizadores de feedback (calculados aquí, dibujados en render.ts)
let bannerElapsed = 0;
let prevBannerT = 0;
let memElapsed = 0;
let memId = '';

// estelas de esquiva (afterimages del jugador)
export interface TrailPt { x: number; y: number; dir: string; anim: number; life: number }
const rollTrail: TrailPt[] = [];

export const TRAIL_LIFE = 0.22;

// ---------------- Frame común ----------------

/**
 * Se llama al inicio de drawGame. Calcula el dt real de dibujado a
 * partir de globalT y aplica un decaimiento de seguridad del shake
 * en estados donde el bucle de update no corre (pause/dead/end).
 * Devuelve el dt calculado.
 */
export function fxFrame(g: Game): number {
  const dt = lastGT < 0 ? 1 / 60 : Math.max(0.0001, Math.min(0.05, g.globalT - lastGT));
  lastGT = g.globalT;
  if (g.state !== 'play' && g.state !== 'dialogue' && g.shake > 0) {
    // decaimiento exponencial seguro: nunca deja el temblor constante
    g.shake *= Math.pow(0.004, dt);
    if (g.shake < 0.05) g.shake = 0;
  }
  return dt;
}
let lastGT = -1;

// ---------------- Spawning por mapa ----------------

function spawnAmbient(g: Game): void {
  const slot = pool.find(a => !a.active);
  if (!slot) return;
  const margin = 24;
  const wx0 = g.camX / ZOOM - margin, wy0 = g.camY / ZOOM - margin;
  const wx1 = (g.camX + VIEW_W) / ZOOM + margin, wy1 = (g.camY + VIEW_H) / ZOOM + margin;
  const seed = Math.floor(g.globalT * 997) ^ (spawnAcc * 131 | 0);
  const r = hash2(seed, 7);

  const init = (kind: number, x: number, y: number, vx: number, vy: number, maxT: number, size: number) => {
    slot.active = true; slot.kind = kind;
    slot.x = x; slot.y = y; slot.vx = vx; slot.vy = vy;
    slot.t = 0; slot.maxT = maxT; slot.seed = hash2(seed, 3); slot.size = size;
  };

  if (g.mapId === 'lunaris') {
    if (isNight(g)) {
      // luciérnagas verdosas: deambulan cerca del suelo con parpadeo
      init(FIREFLY, wx0 + r * (wx1 - wx0), wy0 + (wy1 - wy0) * (0.35 + hash2(seed, 11) * 0.6),
        (r - 0.5) * 10, (hash2(seed, 13) - 0.5) * 8, 5 + hash2(seed, 17) * 3, 1.5);
    } else {
      // motas doradas cálidas: deriva lenta e irregular
      init(MOTA, wx0 + r * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0),
        (r - 0.5) * 6, -2 - hash2(seed, 13) * 4, 6 + hash2(seed, 17) * 4, 1 + hash2(seed, 19) * 1.2);
    }
  } else if (g.mapId === 'bosque') {
    if (r < 0.62) {
      // hojas: caen con vaivén sinusoidal
      init(LEAF, wx0 + r * (wx1 - wx0), wy0 - 6, 0, 16 + hash2(seed, 13) * 12,
        9, 2);
    } else {
      // esporas: flotan casi inmóviles
      init(SPORE, wx0 + r * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0),
        (r - 0.5) * 5, -1 - hash2(seed, 15) * 2, 5 + hash2(seed, 17) * 3, 1);
    }
  } else {
    // cripta
    if (r < 0.78) {
      // ceniza azulada ascendente
      init(ASH, wx0 + r * (wx1 - wx0), wy1 - hash2(seed, 11) * 20, (r - 0.5) * 8, -9 - hash2(seed, 13) * 8,
        4.5 + hash2(seed, 17) * 3, 1 + hash2(seed, 19));
    } else {
      // wisp tenue: deriva serpenteante
      init(CRYPTWISP, wx0 + r * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0),
        (r - 0.5) * 8, -2, 5 + hash2(seed, 17) * 2, 1.5);
    }
  }
}

// ---------------- Update (solo play/dialogue) ----------------

export function updateAmbient(g: Game, dt: number): void {
  // ---- temporizadores de feedback ----
  if (g.bossBannerT > prevBannerT + 0.03) bannerElapsed = 0; // banner nuevo
  prevBannerT = g.bossBannerT;
  bannerElapsed += dt;

  if (g.memoryReveal) {
    if (g.memoryReveal.id !== memId) { memId = g.memoryReveal.id; memElapsed = 0; }
    memElapsed += dt;
  } else {
    memId = '';
  }

  // ---- polvo de pasos (throttle ~0.12 s) ----
  const p = g.player;
  dustAcc += dt;
  if (p && p.moving && p.rollT <= 0 && p.attackT <= 0 && dustAcc >= 0.12) {
    dustAcc = 0;
    g.particles.push({
      x: p.x + (Math.random() - 0.5) * 6, y: p.y + 3,
      vx: (Math.random() - 0.5) * 10, vy: -6 - Math.random() * 6,
      t: 0.28, maxT: 0.28, color: 'rgba(196,188,164,0.8)', size: 1.4, grav: 42,
    });
  }

  // ---- estelas de esquiva ----
  for (let i = rollTrail.length - 1; i >= 0; i--) {
    rollTrail[i].life -= dt;
    if (rollTrail[i].life <= 0) rollTrail.splice(i, 1);
  }
  if (p && p.rollT > 0) {
    const last = rollTrail[rollTrail.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 7) {
      rollTrail.push({ x: p.x, y: p.y, dir: p.dir, anim: p.anim, life: TRAIL_LIFE });
      if (rollTrail.length > 6) rollTrail.shift();
    }
  }

  // ---- partículas ambientales ----
  const cfgRate = g.mapId === 'bosque' ? 16 : g.mapId === 'cripta' ? 15 : 12;
  spawnAcc += dt * cfgRate;
  while (spawnAcc >= 1) {
    spawnAcc -= 1;
    spawnAmbient(g);
  }

  for (const a of pool) {
    if (!a.active) continue;
    a.t += dt;
    if (a.t >= a.maxT) { a.active = false; continue; }
    switch (a.kind) {
      case FIREFLY: {
        // deambular suave con cambio de dirección determinista
        const w = Math.sin(g.globalT * 1.7 + a.seed * 9);
        a.vx += Math.cos(g.globalT * 1.3 + a.seed * 7) * 14 * dt;
        a.vy += w * 10 * dt;
        a.vx = Math.max(-14, Math.min(14, a.vx));
        a.vy = Math.max(-10, Math.min(10, a.vy));
        break;
      }
      case LEAF: {
        // vaivén: la posición x se calcula al dibujar con seno
        break;
      }
      case ASH: {
        a.vx += Math.sin(g.globalT * 2 + a.seed * 11) * 6 * dt;
        break;
      }
      case CRYPTWISP: {
        a.vx += Math.cos(g.globalT * 1.1 + a.seed * 5) * 10 * dt;
        a.vy += Math.sin(g.globalT * 0.9 + a.seed * 3) * 8 * dt;
        break;
      }
      default: break;
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    // matar las que salen demasiado del encuadre
    if (a.x < g.camX / ZOOM - 60 || a.x > (g.camX + VIEW_W) / ZOOM + 60 ||
        a.y < g.camY / ZOOM - 60 || a.y > (g.camY + VIEW_H) / ZOOM + 60) {
      a.active = false;
    }
  }
}

// ---------------- Dibujo ----------------

/**
 * layer 'world': motas/hojas/ceniza/niebla en coordenadas de mundo
 * (se dibuja sobre el mundo, bajo la iluminación).
 * layer 'sky': estrellas titilantes + halo lunar + parpadeo de
 * antorchas (encima de la iluminación, bajo el HUD).
 */
export function drawAmbient(g: Game, layer: 'world' | 'sky'): void {
  const ctx = g.ctx;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const sx = (wx: number) => wx * ZOOM - camX;
  const sy = (wy: number) => wy * ZOOM - camY;

  if (layer === 'sky') {
    drawSky(g, ctx);
    return;
  }

  // ---- niebla del Bosque: bandas que derivan (según época) ----
  if (g.mapId === 'bosque' && g.map.epochDiffs.length > 0) {
    const density = g.epoch === 'pasado' ? 0.045 : 0.14;
    ctx.save();
    ctx.globalAlpha = density;
    ctx.fillStyle = '#9ec4b4';
    for (let i = 0; i < 4; i++) {
      const seed = i * 37 + 5;
      const fx = ((g.globalT * 9 + i * 300) % (VIEW_W + 360)) - 180;
      const fy = 70 + i * 110 + Math.sin(g.globalT * 0.6 + seed) * 16;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 150, 24 + (i % 2) * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- partículas del pool ----
  for (const a of pool) {
    if (!a.active) continue;
    const lifeK = 1 - a.t / a.maxT;              // 1 → 0
    const fade = Math.min(1, lifeK * 3, a.t * 4); // fundido en ambos extremos
    const x = sx(a.x), y = sy(a.y);
    switch (a.kind) {
      case MOTA: {
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = '#ffe9a0';
        const wob = Math.sin(g.globalT * 2 + a.seed * 8) * 2;
        ctx.fillRect(x + wob, y, a.size * ZOOM, a.size * ZOOM);
        break;
      }
      case FIREFLY: {
        // parpadeo: brillo breve con halo aditivo
        const blink = Math.max(0, Math.sin(g.globalT * 2.4 + a.seed * 12));
        const al = blink * blink * fade;
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * al;
        ctx.fillStyle = '#8ef0a8';
        ctx.beginPath();
        ctx.arc(x, y, 5 * ZOOM * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = Math.min(1, 0.4 + al);
        ctx.fillStyle = '#d8ffd0';
        ctx.fillRect(x, y, 2, 2);
        break;
      }
      case LEAF: {
        // hoja 2×2 con vaivén y balanceo de "vuelta"
        const sway = Math.sin(a.t * 2.6 + a.seed * 9) * 14;
        const flip = Math.sin(a.t * 5 + a.seed * 4);
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = a.seed > 0.5 ? '#c8a050' : '#8aa050';
        ctx.fillRect(x + sway, y, 2 * ZOOM * 0.7, Math.max(1, Math.abs(flip) * 2.2));
        ctx.fillStyle = a.seed > 0.5 ? '#e0b860' : '#a8bc60';
        ctx.fillRect(x + sway, y, ZOOM * 0.7, Math.max(1, Math.abs(flip) * 1.4));
        break;
      }
      case SPORE: {
        ctx.globalAlpha = 0.45 * fade * (0.6 + 0.4 * Math.sin(g.globalT * 3 + a.seed * 7));
        ctx.fillStyle = '#d8f0e0';
        ctx.fillRect(x, y, 1.5 * ZOOM, 1.5 * ZOOM);
        break;
      }
      case ASH: {
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = a.seed > 0.6 ? '#b8c8e0' : '#8fa4c8';
        ctx.fillRect(x, y, a.size * ZOOM * 0.8, a.size * ZOOM * 0.8);
        break;
      }
      case CRYPTWISP: {
        const pulse = 0.5 + 0.5 * Math.sin(g.globalT * 2.2 + a.seed * 9);
        ctx.globalAlpha = 0.3 * fade * (0.4 + pulse * 0.6);
        ctx.fillStyle = '#9fe8d8';
        ctx.beginPath();
        ctx.arc(x, y, 3 * ZOOM * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8 * fade * pulse;
        ctx.fillStyle = '#e8fff8';
        ctx.fillRect(x, y, 1.5 * ZOOM, 1.5 * ZOOM);
        break;
      }
      default: break;
    }
  }
  ctx.globalAlpha = 1;
}

// ---- capa de cielo: estrellas, luna, antorchas ----
function drawSky(g: Game, ctx: CanvasRenderingContext2D): void {
  const t = g.globalT;

  if (g.map.dark) {
    // ---- Cripta: parpadeo cálido de antorchas ----
    const flick = 0.5 + 0.5 * Math.sin(t * 11) * 0.6 + 0.25 * Math.sin(t * 23 + 1.7) + 0.15 * Math.sin(t * 7.7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.05 + 0.035 * Math.max(0, flick);
    ctx.fillStyle = '#ff9a50';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
    return;
  }

  // factor de noche coherente con drawLighting
  const dayLight = Math.max(0.1, Math.sin(g.dayT * Math.PI * 2) * 1.25 + 0.25);
  const nf = 1 - Math.min(1, dayLight);
  if (nf < 0.08) return;

  // ---- estrellas titilantes (deterministas) ----
  for (let i = 0; i < 46; i++) {
    const s1 = hash2(i * 7 + 1, 3);
    const s2 = hash2(i * 13 + 2, 5);
    const s3 = hash2(i * 17 + 4, 9);
    const x = s1 * VIEW_W;
    const y = s2 * VIEW_H * 0.55;
    const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * (0.5 + s3 * 1.2) + s3 * 9));
    ctx.globalAlpha = nf * tw * 0.8;
    ctx.fillStyle = s3 > 0.85 ? '#ffe9c8' : '#dce4ff';
    ctx.fillRect(x, y, s3 > 0.7 ? 2 : 1, s3 > 0.7 ? 2 : 1);
  }
  ctx.globalAlpha = 1;

  // ---- luna con halo ----
  if (nf > 0.3) {
    const mx = VIEW_W * 0.8, my = 64;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(mx, my, 6, mx, my, 52);
    halo.addColorStop(0, `rgba(214,226,255,${0.30 * nf})`);
    halo.addColorStop(1, 'rgba(214,226,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 56, my - 56, 112, 112);
    ctx.restore();
    ctx.globalAlpha = Math.min(1, nf * 1.2);
    ctx.fillStyle = '#e8ecf4';
    ctx.beginPath();
    ctx.arc(mx, my, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,192,214,0.7)';   // cráteres
    ctx.fillRect(mx - 4, my - 3, 3, 3);
    ctx.fillRect(mx + 2, my + 3, 2, 2);
    ctx.fillRect(mx + 3, my - 5, 2, 2);
    ctx.globalAlpha = 1;
  }
}

// ---------------- Consultas para render.ts ----------------

/** Estelas de esquiva vivas (para dibujar afterimages). */
export function getRollTrail(): TrailPt[] {
  return rollTrail;
}

/** Progreso del banner de jefe: slide 0→1 (entrada), out 1→0 (salida). */
export function bannerInfo(g: Game): { slide: number; out: number; elapsed: number } {
  return {
    slide: Math.min(1, bannerElapsed / 0.45),
    out: Math.min(1, g.bossBannerT / 0.4),
    elapsed: bannerElapsed,
  };
}

/** Alpha del overlay de memoria (entrada 0.5 s, salida según t restante). */
export function memoryAlpha(g: Game): number {
  if (!g.memoryReveal) return 0;
  return Math.max(0, Math.min(1, memElapsed / 0.5, g.memoryReveal.t / 0.6));
}
