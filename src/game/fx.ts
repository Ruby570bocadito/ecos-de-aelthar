// ============================================================
// ECOS DE AELTHAR — fx (AGENTE 3-a · visuales; biomas nuevos · agente 7-c;
// combate 8-c; pulido 10-c)
// Partículas ambientales por mapa (pool fijo, sin allocations
// masivas), polvo de pasos, estelas de esquiva y temporizadores
// de feedback (banner de jefe / overlay de memoria).
// FX de combate (8-c): chispas direccionales, soplo de esquiva y
// destello de crítico — todo entra al pool g.particles, cero draws nuevos.
// Task 10-c: polvo de pasos por bioma (arena dorada / hielo que raspa) y
// BRUMA DEL FARO (costa, faro encendido: motas alargadas orbitando la
// linterna con dirección rotando determinista).
// SKIPs 10-c (documentados): mortandad de memoras al encender farol y sal-
// picadura de proyectil en agua requieren hooks en engine.ts/update.ts
// (CONGELADOS esta ronda) — no hay punto de enganche limpio.
// Todo determinista donde puede (hash2) y sincronizado con globalT.
// (18-d) héroe-detalle: combate que se SIENTE sin cambiar ninguna firma —
// combatSparks/critGlint/dodgeRing ganan fogonazo/brasas (con cap duro
// PART_CAP=120 sobre g.particles) y updateAmbient detecta BORDES del estado
// del Portador (parada perfecta p.parryFx 0→+, golpe cargado attackT 0→+ con
// chargedHit, aura de carga p.charging) para soltar ráfagas propias: chispas
// de impacto, onda dorada del cargado y destello de parada. Cero rewiring en
// update.ts/render.ts (las mismas llamadas existentes disparan todo).
// ============================================================

import type { Game } from './engine';
import type { PropDef } from './types';
import { VIEW_W, VIEW_H, ZOOM } from './engine';
import { hash2, TILE } from './sprites';
import { tileAt } from './maps'; // solo lectura (mapas propiedad de otro agente)
import { isNight } from './update'; // solo lectura (propiedad del agente 3-b)

// ---------------- Tipos internos ----------------

const MOTA = 0;        // Lunaris día: motas doradas cálidas
const FIREFLY = 1;     // Lunaris noche: luciérnagas verdosas
const LEAF = 2;        // Bosque: hojas cayendo con vaivén
const SPORE = 3;       // Bosque: esporas flotantes
const ASH = 4;         // Cripta: ceniza azulada ascendente
const CRYPTWISP = 5;   // Cripta: wisps tenues
const SEAMIST = 6;     // Costa: bruma salina que deriva hacia el oeste
const FOAM = 7;        // Costa: chispas de espuma que estallan en destellos
const MEMORA = 8;      // Aldea: motas doradas pálidas que suben (los nombres que flotan)
const SNOW = 9;        // Cumbres: ventisca — copos con vaivén de viento
const WISPFRIO = 10;   // Cumbres: wisps azul-hielo erráticos junto al suelo
const FAROBEAM = 11;   // Costa (10-c): motas alargadas del haz del faro encendido

// 120 (antes 110): headroom para el haz del faro (~6-8 motas vivas); el
// máximo autorizado por 7-c era 120 — se alcanza exactamente.
const AMB_CAP = 120;

// (18-d) cap duro del pool de partículas de combate (g.particles): las
// ráfagas/fogonazos nuevos NO empujan por encima de 120 vivas. Las llamadas
// que ya existían (núcleo de combatSparks/critGlint/dodgeRing) mantienen su
// comportamiento — el cap protege solo los adornos añadidos en 18-d.
const PART_CAP = 120;

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
let faroAcc = 0; // acumulador del haz del faro (10-c): 3 motas/s cuando arde

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
  } else if (g.mapId === 'costa') {
    const night = isNight(g);
    // de noche: menos espuma, más bruma (el mar se cierra)
    const foamK = night ? 0.16 : 0.42;
    if (r < foamK) {
      // espuma: chispas blancas junto al suelo, vida corta, estallan en 2-3 destellos
      init(FOAM, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 + (wy1 - wy0) * (0.6 + hash2(seed, 11) * 0.32),
        5 + hash2(seed, 13) * 10, -5 - hash2(seed, 15) * 6, 0.5 + hash2(seed, 17) * 0.4, 1.2);
    } else {
      // bruma salina: motas grandes semitransparentes que derivan al oeste, vida larga
      init(SEAMIST, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0),
        -9 - hash2(seed, 13) * 5, 0, 7 + hash2(seed, 17) * 3.5, 2.2 + hash2(seed, 19) * 1.8);
    }
  } else if (g.mapId === 'aldea') {
    if (r < 0.85) {
      // memoras: ceniza del recuerdo — suben MUY lento (los nombres que flotan)
      init(MEMORA, wx0 + hash2(seed, 21) * (wx1 - wx0), wy1 - hash2(seed, 11) * 24,
        (r - 0.5) * 4, -3.5 - hash2(seed, 13) * 3.5, 7 + hash2(seed, 17) * 4, 1 + hash2(seed, 19) * 0.8);
    } else {
      // ceniza (duelo de Merrow): unos pocos copos que ascienden más vivos
      init(ASH, wx0 + hash2(seed, 21) * (wx1 - wx0), wy1 - hash2(seed, 11) * 20, (r - 0.5) * 6, -7 - hash2(seed, 13) * 6,
        4 + hash2(seed, 17) * 2.5, 1 + hash2(seed, 19) * 0.6);
    }
  } else if (g.mapId === 'cumbres') {
    const night = isNight(g);
    if (r < (night ? 0.7 : 0.8)) {
      // ventisca: NÚMEROS ALTOS, caída lenta constante; el viento (vx) oscila en update
      init(SNOW, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 - 6,
        0, 13 + hash2(seed, 13) * 10, 5 + hash2(seed, 17) * 3, 0.9 + hash2(seed, 19) * 1.3);
    } else {
      // wisp frío: azul-hielo, errático y lento, cerca del suelo
      init(WISPFRIO, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 + (wy1 - wy0) * (0.45 + hash2(seed, 11) * 0.45),
        (r - 0.5) * 8, -1 - hash2(seed, 13) * 2, 4.5 + hash2(seed, 17) * 2, 1.4);
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
  // Variación por bioma (Task 10-c): el tile se muestrea bajo los PIES
  // (y + h/2, centro de entidad — misma convención del hielo de 9-a; antes
  // se muestreaba el centro y al empujar contra un muro por arriba leía el
  // tile equivocado):
  //   's' arena (costa)  → soplo DORADO pálido #f0e0b0, partículas algo mayores
  //   'S' nieve (cumbres) → soplo blanco flotante (como 7-c)
  //   'i' hielo (cumbres) → RASPA chispas azul-blanco #dff0fa horizontales
  //                         cortas (grav 0, vida 0.2 s)
  //   resto              → polvo marrón clásico
  const p = g.player;
  dustAcc += dt;
  if (p && p.moving && p.rollT <= 0 && p.attackT <= 0 && dustAcc >= 0.12) {
    dustAcc = 0;
    const feetY = p.y + p.h * 0.5;
    const tch = tileAt(g.map, g.rows, Math.floor(p.x / TILE), Math.floor(feetY / TILE), g.epoch);
    if (tch === 'i') {
      // hielo: raspado horizontal — chispas azul-blanco sin gravedad
      const dir = Math.random() < 0.5 ? -1 : 1;
      g.particles.push({
        x: p.x + (Math.random() - 0.5) * 8, y: feetY - 1,
        vx: dir * (34 + Math.random() * 40), vy: (Math.random() - 0.5) * 6,
        t: 0.2, maxT: 0.2, color: '#dff0fa', size: 1.2, grav: 0,
      });
    } else if (tch === 's') {
      // arena de la Costa de Bruma: soplo dorado pálido, algo mayor
      g.particles.push({
        x: p.x + (Math.random() - 0.5) * 8, y: feetY - 1,
        vx: (Math.random() - 0.5) * 16, vy: -4 - Math.random() * 5,
        t: 0.36, maxT: 0.36, color: '#f0e0b0', size: 2.3, grav: 16,
      });
    } else if (tch === 'S') {
      g.particles.push({
        x: p.x + (Math.random() - 0.5) * 7, y: feetY - 1,
        vx: (Math.random() - 0.5) * 16, vy: -4 - Math.random() * 5,
        t: 0.34, maxT: 0.34, color: 'rgba(240,246,255,0.85)', size: 1.6, grav: 16,
      });
    } else {
      g.particles.push({
        x: p.x + (Math.random() - 0.5) * 6, y: feetY - 1,
        vx: (Math.random() - 0.5) * 10, vy: -6 - Math.random() * 6,
        t: 0.28, maxT: 0.28, color: 'rgba(196,188,164,0.8)', size: 1.4, grav: 42,
      });
    }
  }

  // ---- BRUMA DEL FARO (Task 10-c): haz de luz rotatorio en la costa ----
  // El faro "está encendido" cuando su flag de prop está activa — así lo lee
  // render.ts: drawExpansionProp(..., !!g.flags[pr.id]). Id real del faro:
  // 'faro_co' (x:6, y:18 en maps_expansion.ts), pero buscamos el prop por
  // kind === 'faro' + flag (lookup genérico, sin allocations, ~12 props).
  // 3 motas alargadas/s derivan alrededor de la LINTERNA (centro del prop
  // a 34 px por encima, como la dibuja sprites_expansion) con dirección
  // rotando — determinista con globalT (misma velocidad angular 0.35 rad/s
  // que el haz cónico del sprite). El posicionamiento orbital se calcula al
  // DIBUJAR (f(t, seed)): la partícula del pool va con vx/vy = 0.
  if (g.mapId === 'costa') {
    let faro: PropDef | null = null;
    for (const pr of g.map.props) {
      if (pr.kind === 'faro' && g.flags[pr.id]) { faro = pr; break; }
    }
    if (faro) {
      const lx = faro.x * TILE + 8, ly = faro.y * TILE + 8 - 34; // linterna (mundo)
      // solo emitir si la linterna está (casi) en encuadre
      if (lx >= g.camX / ZOOM - 48 && lx <= (g.camX + VIEW_W) / ZOOM + 48 &&
          ly >= g.camY / ZOOM - 48 && ly <= (g.camY + VIEW_H) / ZOOM + 48) {
        faroAcc += dt * 3;
        while (faroAcc >= 1) {
          const slot = pool.find(a => !a.active);
          if (!slot) { faroAcc = 1; break; } // sin hueco: no acumular ráfaga
          faroAcc -= 1;
          const s = Math.floor(g.globalT * 997) ^ ((faroAcc * 511) | 0);
          slot.active = true; slot.kind = FAROBEAM;
          slot.x = lx; slot.y = ly; slot.vx = 0; slot.vy = 0;
          slot.t = 0; slot.maxT = 1.5 + hash2(s, 3) * 1.1;
          slot.seed = hash2(s, 5); slot.size = 1.1 + hash2(s, 7) * 0.8;
        }
      }
    }
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

  // ---- (18-d) ráfagas de combate por detección de borde ----
  combatEdgeFx(g, dt);

  // ---- partículas ambientales ----
  // costa: bruma moderada · aldea: escasa (nostalgia quieta) · cumbres: ventisca densa
  const cfgRate = g.mapId === 'bosque' ? 16 : g.mapId === 'cripta' ? 15
    : g.mapId === 'costa' ? 13 : g.mapId === 'aldea' ? 8 : g.mapId === 'cumbres' ? 17 : 12;
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
      case SEAMIST: {
        // deriva oeste constante (vx fijo); la ondulación en y se dibuja con seno
        break;
      }
      case FOAM: {
        // estallido: sube empujada y frena (gravedad suave)
        a.vy += 14 * dt;
        break;
      }
      case MEMORA: {
        // ascenso lento con balanceo de "nombre recordado"
        a.vx += Math.sin(g.globalT * 1.4 + a.seed * 9) * 5 * dt;
        break;
      }
      case SNOW: {
        // viento horizontal oscilante (ventisca): vx se fija cada frame (determinista)
        a.vx = Math.sin(g.globalT * 0.9 + a.seed * 14) * (7 + a.seed * 11);
        break;
      }
      case WISPFRIO: {
        a.vx += Math.cos(g.globalT * 0.9 + a.seed * 6) * 9 * dt;
        a.vy += Math.sin(g.globalT * 0.7 + a.seed * 4) * 7 * dt;
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
      case SEAMIST: {
        // bruma salina: pompa grande blanco-azulada semitransparente que ondula en y
        const wob = Math.sin(g.globalT * 0.55 + a.seed * 9) * 7;
        ctx.globalAlpha = 0.14 * fade;
        ctx.fillStyle = '#cfe0f2';
        ctx.beginPath();
        ctx.arc(x, y + wob, a.size * ZOOM * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.1 * fade;
        ctx.fillStyle = '#e8f2fa';
        ctx.beginPath();
        ctx.arc(x + a.size * ZOOM, y + wob + 3, a.size * ZOOM * 1.7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case FOAM: {
        // espuma: estalla en 2-3 destellos discretos durante su vida corta
        const strobe = Math.sin(a.t * (9 + a.seed * 5) + a.seed * 30) > 0 ? 1 : 0.12;
        ctx.globalAlpha = (0.55 + 0.45 * strobe) * fade;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, 2, 2);
        if (strobe > 0) {
          ctx.globalAlpha = 0.25 * fade;
          ctx.fillRect(x - 1, y - 1, 4, 4);
        }
        break;
      }
      case MEMORA: {
        // mota dorada pálida; parpadeo (pulso de alpha) al morir — de noche, más tenue
        const dying = lifeK < 0.4;
        const pulse = dying ? 0.35 + 0.65 * Math.abs(Math.sin(a.t * 9 + a.seed * 20)) : 1;
        ctx.globalAlpha = (isNight(g) ? 0.34 : 0.55) * fade * pulse;
        ctx.fillStyle = a.seed > 0.5 ? '#ecdcae' : '#d8c898';
        ctx.fillRect(x + Math.sin(g.globalT * 1.6 + a.seed * 8) * 2, y, a.size * ZOOM * 0.9, a.size * ZOOM * 0.9);
        break;
      }
      case SNOW: {
        // copo: blanco, tamaño variado (la ventisca se siente por la cantidad)
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = '#f2f6ff';
        ctx.fillRect(x, y, a.size * ZOOM * 0.8, a.size * ZOOM * 0.8);
        break;
      }
      case WISPFRIO: {
        // wisp azul-hielo (pariente frío del CRYPTWISP)
        const pulseF = 0.5 + 0.5 * Math.sin(g.globalT * 1.9 + a.seed * 8);
        ctx.globalAlpha = 0.28 * fade * (0.4 + pulseF * 0.6);
        ctx.fillStyle = '#9ecdf0';
        ctx.beginPath();
        ctx.arc(x, y, 3 * ZOOM * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.75 * fade * pulseF;
        ctx.fillStyle = '#e6f6ff';
        ctx.fillRect(x, y, 1.5 * ZOOM, 1.5 * ZOOM);
        break;
      }
      case FAROBEAM: {
        // Motas del haz del faro (10-c): órbita alrededor de la linterna
        // (a.x/a.y), dirección rotando determinista (0.35 rad/s, la misma del
        // haz cónico del sprite). Trazo alargado ORIENTADO a la tangente del
        // giro → sensación de barrido de luz. Cull barato: si la linterna
        // sale de encuadre, updateAmbient las desactiva por posición.
        const ang = g.globalT * 0.35 + a.seed * 6.28;
        const rad = (9 + a.t * 17 + a.seed * 6) * ZOOM;
        const bx = x + Math.cos(ang) * rad;
        const by = y + Math.sin(ang) * rad * 0.85; // leve achatado cenital
        const tw = 0.75 + 0.25 * Math.sin(g.globalT * 5 + a.seed * 40);
        const nightK = isNight(g) ? 1.25 : 1; // de noche arde más en la bruma
        ctx.globalAlpha = Math.min(0.34, 0.17 * fade * tw * nightK);
        ctx.strokeStyle = '#fff3c8';
        ctx.lineWidth = a.size * ZOOM * 0.7;
        ctx.beginPath();
        ctx.moveTo(bx - Math.sin(ang) * 3.2 * ZOOM, by + Math.cos(ang) * 3.2 * ZOOM);
        ctx.lineTo(bx + Math.sin(ang) * 3.2 * ZOOM, by - Math.cos(ang) * 3.2 * ZOOM);
        ctx.stroke();
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

// ---------------- FX de combate (agente 8-c) ----------------
// Impactos que se SIENTEN: solo partículas del pool g.particles (render
// ya las dibuja cada frame), nada de draws nuevos ni allocations por frame
// fuera del pool. Estilo consistente con el polvo de pasos de arriba.
// (18-d): fogonazo central + brasa lenta en cada impacto, anillo determinista
// de parada, onda del golpe cargado y motas en espiral de carga — todo dentro
// del cap PART_CAP y sin tocar las firmas que usan update.ts/render.ts.

/** Dirección cardinal del motor → vector unitario (local, sin importar update). */
function dirVec(dir: string): [number, number] {
  return dir === 'up' ? [0, -1] : dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : [0, 1];
}

// Estado de borde del Portador (identidad estable por partida; se resetea si
// cambia el objeto player).
let fxPlayer: unknown = null;
let prevAtkT = 0;
let prevParryFx = 0;
let chargeAcc = 0;

/**
 * (18-d) Detecta transiciones 0→+ en el estado del Portador y suelta las
 * ráfagas nuevas. Corre dentro de updateAmbient (render la llama cada frame
 * en play/dialogue), así que NO requiere cablear update.ts ni render.ts:
 *  · parada perfecta: el motor sube p.parryFx (0.32 s) y render ya dibuja su
 *    anillo — aquí añadimos el destello estrellado blanco-doradas.
 *  · golpe cargado liberado: attackT sube de 0 con chargedHit → onda dorada
 *    de impacto en el punto frontal (el arco cargado de sprites.ts es el
 *    halón; esto es el estallido del contacto).
 *  · carga: motas en espiral DETERMINISTAS (ángulo = f(chargeT)) mientras se
 *    carga — complementa las aleatorias que update.ts ya suelta.
 */
function combatEdgeFx(g: Game, dt: number): void {
  const p = g.player;
  if (!p) { fxPlayer = null; return; }
  if (p !== fxPlayer) {
    fxPlayer = p; prevAtkT = 0; prevParryFx = 0; chargeAcc = 0;
  }
  const room = g.particles.length < PART_CAP;

  if (p.parryFx > 0 && prevParryFx <= 0 && room) parryFlash(g, p.x, p.y - 6);
  if (p.attackT > 0 && prevAtkT <= 0 && p.chargedHit && room) chargedImpact(g, p);
  prevAtkT = p.attackT > 0 ? p.attackT : 0;
  prevParryFx = p.parryFx > 0 ? p.parryFx : 0;

  if (p.charging && p.chargeT > 0.3) {
    chargeAcc += dt;
    while (chargeAcc >= 0.11) {
      chargeAcc -= 0.11;
      if (g.particles.length >= PART_CAP) break;
      const a = (p.chargeT * 4.2) % (Math.PI * 2);
      g.particles.push({
        x: p.x + Math.cos(a) * 9, y: p.y - 8 + Math.sin(a) * 4,
        vx: 0, vy: -14, t: 0.24, maxT: 0.24, color: '#ffe86a', size: 1.3, grav: 0,
      });
    }
  } else {
    chargeAcc = 0;
  }
}

/** (18-d) Destello de PARADA PERFECTA: fogonazo + estrella de 8 chispas
 *  deterministas (hash2, nada de random — la parada es un momento firmado). */
function parryFlash(g: Game, x: number, y: number): void {
  g.particles.push({ x, y, vx: 0, vy: 0, t: 0.1, maxT: 0.1, color: '#ffffff', size: 3.4, grav: 0 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + hash2(i + 1, 21) * 0.5;
    const spd = 46 + hash2(i + 1, 33) * 30;
    const t = 0.22 + hash2(i + 1, 7) * 0.1;
    g.particles.push({
      x: x + Math.cos(a) * 3, y: y + Math.sin(a) * 3,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 10,
      t, maxT: t, color: i % 2 ? '#fff8c0' : '#ffe86a', size: 1.6, grav: 40,
    });
  }
}

/** (18-d) Estallido del GOLPE CARGADO: fogonazo + anillo radial dorado +
 *  4 chispas frontales pesadas en la dirección del swing. */
function chargedImpact(g: Game, p: { x: number; y: number; dir: string }): void {
  const [dx, dy] = dirVec(p.dir);
  const ix = p.x + dx * 14, iy = p.y - 6 + dy * 14;
  g.particles.push({ x: ix, y: iy, vx: 0, vy: 0, t: 0.14, maxT: 0.14, color: '#fff3c0', size: 3.8, grav: 0 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.particles.push({
      x: ix + Math.cos(a) * 4, y: iy + Math.sin(a) * 4,
      vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
      t: 0.3, maxT: 0.3, color: '#ffe86a', size: 1.8, grav: 0,
    });
  }
  const base = Math.atan2(dy, dx);
  for (let i = 0; i < 4; i++) {
    const a = base + (i - 1.5) * 0.35;
    g.particles.push({
      x: ix, y: iy, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90,
      t: 0.26, maxT: 0.26, color: '#ffd24a', size: 1.5, grav: 80,
    });
  }
}

/**
 * Chispas direccionales de impacto: cono con spread angular alrededor de
 * (dirX, dirY), gravedad suave y vida corta (0.2-0.35 s). Barato: n
 * típico 4-6, power ~70. Para el rebote de un tajo el llamador pasa la
 * dirección OPUESTA al swing; para estelas/recoil, la que necesite.
 */
export function combatSparks(g: Game, x: number, y: number, dirX: number, dirY: number, color: string, n = 6, power = 70): void {
  const base = Math.atan2(dirY, dirX);
  for (let i = 0; i < n; i++) {
    const ang = base + (Math.random() - 0.5) * 1.7;    // cono ±~49°
    const spd = power * (0.45 + Math.random() * 0.75);
    const t = 0.2 + Math.random() * 0.15;
    g.particles.push({
      x: x + (Math.random() - 0.5) * 5, y: y + (Math.random() - 0.5) * 5,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      t, maxT: t, color, size: 1 + Math.random() * 1.5, grav: 60,
    });
  }
  // (18-d) fogonazo del impacto + brasa lenta que flota — solo con hueco
  // en el pool (cap duro PART_CAP).
  if (g.particles.length < PART_CAP) {
    g.particles.push({ x, y, vx: 0, vy: 0, t: 0.07, maxT: 0.07, color: '#ffffff', size: 2.6, grav: 0 });
    g.particles.push({
      x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 20, vy: -14 - Math.random() * 12,
      t: 0.42, maxT: 0.42, color, size: 1.2, grav: 50,
    });
  }
}

/**
 * Soplo de esquiva: anillo horizontal de partículas que se abren desde
 * el Portador (vista cenital: achatado en y) y se posan — un "¡fuá!" de aire.
 */
export function dodgeRing(g: Game, x: number, y: number): void {
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.35;
    const rx = Math.cos(a);
    const ry = Math.sin(a) * 0.55;                     // anillo achatado sobre el suelo
    g.particles.push({
      x: x + rx * 4, y: y + 2 + ry * 4,
      vx: rx * 46, vy: ry * 46 - 8,
      t: 0.3, maxT: 0.3, color: '#cfe0f2', size: 1.7, grav: 30,
    });
  }
  // (18-d) soplo de aire que levanta al rodar (2 pompas ascendentes)
  if (g.particles.length < PART_CAP) {
    g.particles.push({ x: x - 3, y: y - 8, vx: -8, vy: -18, t: 0.26, maxT: 0.26, color: '#dce8f4', size: 1.6, grav: 24 });
    g.particles.push({ x: x + 3, y: y - 8, vx: 8, vy: -18, t: 0.26, maxT: 0.26, color: '#dce8f4', size: 1.6, grav: 24 });
  }
}

/**
 * Destello de crítico: 3 partículas doradas grandes que se abren y se
 * apagan (tamaños decrecientes + vida escalonada → sensación de expansión).
 * Complementa el flash de daño (e.hitFlash) sin tocar render.
 */
export function critGlint(g: Game, x: number, y: number): void {
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + 0.5;
    const t = 0.28 + i * 0.04;
    g.particles.push({
      x: x + Math.cos(a) * 3, y: y + Math.sin(a) * 3,
      vx: Math.cos(a) * 24, vy: Math.sin(a) * 24,
      t, maxT: t, color: i === 0 ? '#ffe86a' : '#ffd24a', size: 4.4 - i * 0.8, grav: 14,
    });
  }
  // (18-d) núcleo blanco del crítico (legible incluso a ZOOM×2)
  if (g.particles.length < PART_CAP) {
    g.particles.push({ x, y, vx: 0, vy: 0, t: 0.09, maxT: 0.09, color: '#fffbe0', size: 3.2, grav: 0 });
  }
}

// ---------------- Consultas para render.ts ----------------

/** Estelas de esquiva vivas (para dibujar afterimages). */
export function getRollTrail(): TrailPt[] {
  return rollTrail;
}

/** (18-d) Tamaño del pool ambiental vivo y su cap — para smokes y HUD debug. */
export function poolStats(): { active: number; cap: number; partCap: number } {
  let active = 0;
  for (const a of pool) if (a.active) active++;
  return { active, cap: AMB_CAP, partCap: PART_CAP };
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
