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
//
// R3-A1 (Ronda 3 · combate y juice) — añadidos al final del archivo:
//   - drawFloatV2: números de daño V2 (arco + rebote, CRÍTICO con
//     doble pasada, contorno 1 px, fade-out por escala).
//   - spawnHitSparks / drawSparks: chispas de impacto como trazos
//     alargados + destello blanco (convención size >= SPARK_MIN_SIZE).
//
// R5-O7 (optimización fx): cero allocations por frame en las rutas calientes.
//   - Pool ambiental con LISTA LIBRE (spawn O(1), antes pool.find O(n)) y
//     reciclaje de la más vieja al saturar; cap 90 por mapa.
//   - drawAmbient: sx/sy inline (antes 2 clausuras/frame), bucle indexado,
//     culling de partículas fuera de viewport, batch de fillStyle y
//     sin save/restore por luciérnaga.
//   - drawSky: tabla de estrellas precalculada (hash2 una vez) + halo lunar
//     cacheado (antes createRadialGradient por frame de noche).
//   - drawSparks: 3 pases por grupo (destellos / colas / cabezas) con fillStyle
//     una vez por grupo, culling y cero arrays literales por chispa.
//   - drawFloatV2: string de fuente cacheada por tamaño + culling.
//   - spawnHitSparks/critGlint: cap propio de chispas (≤220) reciclando la
//     más vieja in situ.
//   - bannerInfo devuelve objeto reutilizado (consumo inmediato en render.ts).
//   - spawnAmbient: init pasa a función de módulo (antes 1 clausura nueva por
//     spawn, hasta ~17/s); lookup del faro con bucle indexado (sin iterador).
//   - FAROBEAM: strokeStyle en caché (_lastStroke) — 1 setter solo al cambiar.
// ============================================================

import type { Game } from './engine';
import type { PropDef } from './types';
import { VIEW_W, VIEW_H, ZOOM } from './engine';
import { hash2 } from './world/palette'; // hash determinista, devuelve [0,0.5) → normalizar ×2
import { TILE } from './sprites'; // hash2 vive en world/palette (sprites lo re-exporta); TILE para coordenadas de tile
import { tileAt } from './maps'; // solo lectura (mapas propiedad de otro agente)
import { isNight } from './update'; // solo lectura (propiedad del agente 3-b)
import { fBody } from './ui'; // misma fuente de cuerpo que usa render.ts (ui no importa nada en runtime)
import type { FloatText } from './types';

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

// R5-O7: cap 90 motas por mapa (antes 120). Con lista libre + reciclaje de la
// más vieja el emisor nunca se estanca, así que la densidad visible se mantiene.
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

// R5-O7: lista de ranuras LIBRES → spawn O(1) (antes pool.find O(n) por spawn).
// Las bajas (muerte natural o salida de encuadre) devuelven su índice aquí.
const ambFree: number[] = [];
for (let i = AMB_CAP - 1; i >= 0; i--) ambFree.push(i);

/** Ranura para una mota nueva: libre si hay, si no recicla la MÁS VIEJA
 *  (mayor t/maxT = la más cerca de morir → mínima pérdida visual). */
function allocAmb(): Amb | null {
  let i = ambFree.pop();
  if (i === undefined) {
    let worst = 0, worstK = -1;
    for (let j = 0; j < AMB_CAP; j++) {
      const a = pool[j];
      const k = a.t / a.maxT;
      if (k > worstK) { worstK = k; worst = j; }
    }
    i = worst; // el llamador SIEMPRE activa la ranura devuelta
  }
  return pool[i];
}

let spawnAcc = 0;
let dustAcc = 0;
let faroAcc = 0; // acumulador del haz del faro (10-c): 3 motas/s cuando arde

/** R5-O7: inicializa una ranura del pool SIN clausura (los parámetros entran
 *  explícitos; antes `init` capturaba slot+seed → 1 closure por spawn). */
function initAmb(slot: Amb, kind: number, x: number, y: number, vx: number, vy: number, maxT: number, size: number, seed: number): void {
  slot.active = true; slot.kind = kind;
  slot.x = x; slot.y = y; slot.vx = vx; slot.vy = vy;
  slot.t = 0; slot.maxT = maxT; slot.seed = hash2(seed, 3); slot.size = size;
}

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
  const slot = allocAmb();
  if (!slot) return;
  const margin = 24;
  const wx0 = g.camX / ZOOM - margin, wy0 = g.camY / ZOOM - margin;
  const wx1 = (g.camX + VIEW_W) / ZOOM + margin, wy1 = (g.camY + VIEW_H) / ZOOM + margin;
  const seed = Math.floor(g.globalT * 997) ^ (spawnAcc * 131 | 0);
  const r = hash2(seed, 7);

  if (g.mapId === 'lunaris') {
    if (isNight(g)) {
      // luciérnagas verdosas: deambulan cerca del suelo con parpadeo
      initAmb(slot, FIREFLY, wx0 + r * (wx1 - wx0), wy0 + (wy1 - wy0) * (0.35 + hash2(seed, 11) * 0.6),
        (r - 0.5) * 10, (hash2(seed, 13) - 0.5) * 8, 5 + hash2(seed, 17) * 3, 1.5, seed);
    } else {
      // motas doradas cálidas: deriva lenta e irregular
      initAmb(slot, MOTA, wx0 + r * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0),
        (r - 0.5) * 6, -2 - hash2(seed, 13) * 4, 6 + hash2(seed, 17) * 4, 1 + hash2(seed, 19) * 1.2, seed);
    }
  } else if (g.mapId === 'bosque') {
    if (r < 0.62) {
      // hojas: caen con vaivén sinusoidal
      initAmb(slot, LEAF, wx0 + r * (wx1 - wx0), wy0 - 6, 0, 16 + hash2(seed, 13) * 12,
        9, 2, seed);
    } else {
      // esporas: flotan casi inmóviles
      initAmb(slot, SPORE, wx0 + r * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0),
        (r - 0.5) * 5, -1 - hash2(seed, 15) * 2, 5 + hash2(seed, 17) * 3, 1, seed);
    }
  } else if (g.mapId === 'costa') {
    const night = isNight(g);
    // de noche: menos espuma, más bruma (el mar se cierra)
    const foamK = night ? 0.16 : 0.42;
    if (r < foamK) {
      // espuma: chispas blancas junto al suelo, vida corta, estallan en 2-3 destellos
      initAmb(slot, FOAM, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 + (wy1 - wy0) * (0.6 + hash2(seed, 11) * 0.32),
        5 + hash2(seed, 13) * 10, -5 - hash2(seed, 15) * 6, 0.5 + hash2(seed, 17) * 0.4, 1.2, seed);
    } else {
      // bruma salina: motas grandes semitransparentes que derivan al oeste, vida larga
      initAmb(slot, SEAMIST, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0),
        -9 - hash2(seed, 13) * 5, 0, 7 + hash2(seed, 17) * 3.5, 2.2 + hash2(seed, 19) * 1.8, seed);
    }
  } else if (g.mapId === 'aldea') {
    if (r < 0.85) {
      // memoras: ceniza del recuerdo — suben MUY lento (los nombres que flotan)
      initAmb(slot, MEMORA, wx0 + hash2(seed, 21) * (wx1 - wx0), wy1 - hash2(seed, 11) * 24,
        (r - 0.5) * 4, -3.5 - hash2(seed, 13) * 3.5, 7 + hash2(seed, 17) * 4, 1 + hash2(seed, 19) * 0.8, seed);
    } else {
      // ceniza (duelo de Merrow): unos pocos copos que ascienden más vivos
      initAmb(slot, ASH, wx0 + hash2(seed, 21) * (wx1 - wx0), wy1 - hash2(seed, 11) * 20, (r - 0.5) * 6, -7 - hash2(seed, 13) * 6,
        4 + hash2(seed, 17) * 2.5, 1 + hash2(seed, 19) * 0.6, seed);
    }
  } else if (g.mapId === 'cumbres') {
    const night = isNight(g);
    if (r < (night ? 0.7 : 0.8)) {
      // ventisca: NÚMEROS ALTOS, caída lenta constante; el viento (vx) oscila en update
      initAmb(slot, SNOW, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 - 6,
        0, 13 + hash2(seed, 13) * 10, 5 + hash2(seed, 17) * 3, 0.9 + hash2(seed, 19) * 1.3, seed);
    } else {
      // wisp frío: azul-hielo, errático y lento, cerca del suelo
      initAmb(slot, WISPFRIO, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 + (wy1 - wy0) * (0.45 + hash2(seed, 11) * 0.45),
        (r - 0.5) * 8, -1 - hash2(seed, 13) * 2, 4.5 + hash2(seed, 17) * 2, 1.4, seed);
    }
  } else {
    // cripta
    if (r < 0.78) {
      // ceniza azulada ascendente
      initAmb(slot, ASH, wx0 + r * (wx1 - wx0), wy1 - hash2(seed, 11) * 20, (r - 0.5) * 8, -9 - hash2(seed, 13) * 8,
        4.5 + hash2(seed, 17) * 3, 1 + hash2(seed, 19), seed);
    } else {
      // wisp tenue: deriva serpenteante
      initAmb(slot, CRYPTWISP, wx0 + r * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0),
        (r - 0.5) * 8, -2, 5 + hash2(seed, 17) * 2, 1.5, seed);
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
    // R5-O7: bucle indexado (sin objeto iterador por frame)
    const props = g.map.props;
    for (let pi = 0; pi < props.length; pi++) {
      const pr = props[pi];
      if (pr.kind === 'faro' && g.flags[pr.id]) { faro = pr; break; }
    }
    if (faro) {
      const lx = faro.x * TILE + 8, ly = faro.y * TILE + 8 - 34; // linterna (mundo)
      // solo emitir si la linterna está (casi) en encuadre
      if (lx >= g.camX / ZOOM - 48 && lx <= (g.camX + VIEW_W) / ZOOM + 48 &&
          ly >= g.camY / ZOOM - 48 && ly <= (g.camY + VIEW_H) / ZOOM + 48) {
        faroAcc += dt * 3;
        while (faroAcc >= 1) {
          const slot = allocAmb();
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

  // ---- partículas ambientales ----
  // costa: bruma moderada · aldea: escasa (nostalgia quieta) · cumbres: ventisca densa
  const cfgRate = g.mapId === 'bosque' ? 16 : g.mapId === 'cripta' ? 15
    : g.mapId === 'costa' ? 13 : g.mapId === 'aldea' ? 8 : g.mapId === 'cumbres' ? 17 : 12;
  spawnAcc += dt * cfgRate;
  while (spawnAcc >= 1) {
    spawnAcc -= 1;
    spawnAmbient(g);
  }

  // R5-O7: bucle indexado (sin iterador por frame) + límites de encuadre
  // precalculados (4 divisiones por frame en vez de 4 por partícula).
  // Las bajas devuelven su ranura a ambFree (invariante del pool).
  const killL = g.camX / ZOOM - 60, killR = (g.camX + VIEW_W) / ZOOM + 60;
  const killT = g.camY / ZOOM - 60, killB = (g.camY + VIEW_H) / ZOOM + 60;
  for (let i = 0; i < AMB_CAP; i++) {
    const a = pool[i];
    if (!a.active) continue;
    a.t += dt;
    if (a.t >= a.maxT) { a.active = false; ambFree.push(i); continue; }
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
    if (a.x < killL || a.x > killR || a.y < killT || a.y > killB) {
      a.active = false;
      ambFree.push(i);
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

// R5-O7: batch de fillStyle — el setter del navegador con el MISMO valor es
// barato, pero así se evita re-resolver el color en grupos largos del mismo
// tipo. Se resetea al entrar en cada función de dibujo (el fillStyle vivo puede
// venir de otro pase/contexto).
let _lastFill = '\u0000';
function fillC(ctx: CanvasRenderingContext2D, c: string): void {
  if (_lastFill !== c) { ctx.fillStyle = c; _lastFill = c; }
}

// R5-O7: mismo batch para strokeStyle (solo lo usa FAROBEAM, color constante).
let _lastStroke = '\u0000';

export function drawAmbient(g: Game, layer: 'world' | 'sky'): void {
  const ctx = g.ctx;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);

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
  // R5-O7: sin clausuras sx/sy (inline), bucle indexado, isNight 1 vez por
  // frame (antes por MEMORA/FAROBEAM) y culling al viewport. Margen 32 px de
  // pantalla: cubre el radio máximo de dibujo (SEAMIST ≈29, LEAF ≈17); las
  // motas viven hasta 60 px de MUNDO fuera del encuadre, así que el culling
  // sí descarta partículas que hoy se dibujan sin aportar un pixel visible.
  const t = g.globalT;
  const night = isNight(g);
  const CULL = 32;
  const cullL = -CULL, cullR = VIEW_W + CULL, cullT = -CULL, cullB = VIEW_H + CULL;
  _lastFill = '\u0000';
  _lastStroke = '\u0000';
  for (let i = 0; i < AMB_CAP; i++) {
    const a = pool[i];
    if (!a.active) continue;
    const lifeK = 1 - a.t / a.maxT;              // 1 → 0
    const fade = Math.min(1, lifeK * 3, a.t * 4); // fundido en ambos extremos
    if (fade <= 0.02) continue;                  // invisible: fundido aún no arranca
    const x = a.x * ZOOM - camX;
    const y = a.y * ZOOM - camY;
    if (a.kind !== FAROBEAM && (x < cullL || x > cullR || y < cullT || y > cullB)) continue;
    switch (a.kind) {
      case MOTA: {
        ctx.globalAlpha = 0.5 * fade;
        fillC(ctx, '#ffe9a0');
        const wob = Math.sin(t * 2 + a.seed * 8) * 2;
        ctx.fillRect(x + wob, y, a.size * ZOOM, a.size * ZOOM);
        break;
      }
      case FIREFLY: {
        // parpadeo: brillo breve con halo aditivo
        // R5-O7: sin save/restore por partícula — se conmuta el composite
        // explícitamente (este caso es el único que lo cambia).
        const blink = Math.max(0, Math.sin(t * 2.4 + a.seed * 12));
        const al = blink * blink * fade;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * al;
        fillC(ctx, '#8ef0a8');
        ctx.beginPath();
        ctx.arc(x, y, 5 * ZOOM * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, 0.4 + al);
        fillC(ctx, '#d8ffd0');
        ctx.fillRect(x, y, 2, 2);
        break;
      }
      case LEAF: {
        // hoja 2×2 con vaivén y balanceo de "vuelta"
        const sway = Math.sin(a.t * 2.6 + a.seed * 9) * 14;
        const flip = Math.sin(a.t * 5 + a.seed * 4);
        ctx.globalAlpha = 0.85 * fade;
        fillC(ctx, a.seed > 0.5 ? '#c8a050' : '#8aa050');
        ctx.fillRect(x + sway, y, 2 * ZOOM * 0.7, Math.max(1, Math.abs(flip) * 2.2));
        fillC(ctx, a.seed > 0.5 ? '#e0b860' : '#a8bc60');
        ctx.fillRect(x + sway, y, ZOOM * 0.7, Math.max(1, Math.abs(flip) * 1.4));
        break;
      }
      case SPORE: {
        ctx.globalAlpha = 0.45 * fade * (0.6 + 0.4 * Math.sin(t * 3 + a.seed * 7));
        fillC(ctx, '#d8f0e0');
        ctx.fillRect(x, y, 1.5 * ZOOM, 1.5 * ZOOM);
        break;
      }
      case ASH: {
        ctx.globalAlpha = 0.5 * fade;
        fillC(ctx, a.seed > 0.6 ? '#b8c8e0' : '#8fa4c8');
        ctx.fillRect(x, y, a.size * ZOOM * 0.8, a.size * ZOOM * 0.8);
        break;
      }
      case CRYPTWISP: {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + a.seed * 9);
        ctx.globalAlpha = 0.3 * fade * (0.4 + pulse * 0.6);
        fillC(ctx, '#9fe8d8');
        ctx.beginPath();
        ctx.arc(x, y, 3 * ZOOM * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8 * fade * pulse;
        fillC(ctx, '#e8fff8');
        ctx.fillRect(x, y, 1.5 * ZOOM, 1.5 * ZOOM);
        break;
      }
      case SEAMIST: {
        // bruma salina: pompa grande blanco-azulada semitransparente que ondula en y
        const wob = Math.sin(t * 0.55 + a.seed * 9) * 7;
        ctx.globalAlpha = 0.14 * fade;
        fillC(ctx, '#cfe0f2');
        ctx.beginPath();
        ctx.arc(x, y + wob, a.size * ZOOM * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.1 * fade;
        fillC(ctx, '#e8f2fa');
        ctx.beginPath();
        ctx.arc(x + a.size * ZOOM, y + wob + 3, a.size * ZOOM * 1.7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case FOAM: {
        // espuma: estalla en 2-3 destellos discretos durante su vida corta
        const strobe = Math.sin(a.t * (9 + a.seed * 5) + a.seed * 30) > 0 ? 1 : 0.12;
        ctx.globalAlpha = (0.55 + 0.45 * strobe) * fade;
        fillC(ctx, '#ffffff');
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
        ctx.globalAlpha = (night ? 0.34 : 0.55) * fade * pulse;
        fillC(ctx, a.seed > 0.5 ? '#ecdcae' : '#d8c898');
        ctx.fillRect(x + Math.sin(t * 1.6 + a.seed * 8) * 2, y, a.size * ZOOM * 0.9, a.size * ZOOM * 0.9);
        break;
      }
      case SNOW: {
        // copo: blanco, tamaño variado (la ventisca se siente por la cantidad)
        ctx.globalAlpha = 0.85 * fade;
        fillC(ctx, '#f2f6ff');
        ctx.fillRect(x, y, a.size * ZOOM * 0.8, a.size * ZOOM * 0.8);
        break;
      }
      case WISPFRIO: {
        // wisp azul-hielo (pariente frío del CRYPTWISP)
        const pulseF = 0.5 + 0.5 * Math.sin(t * 1.9 + a.seed * 8);
        ctx.globalAlpha = 0.28 * fade * (0.4 + pulseF * 0.6);
        fillC(ctx, '#9ecdf0');
        ctx.beginPath();
        ctx.arc(x, y, 3 * ZOOM * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.75 * fade * pulseF;
        fillC(ctx, '#e6f6ff');
        ctx.fillRect(x, y, 1.5 * ZOOM, 1.5 * ZOOM);
        break;
      }
      case FAROBEAM: {
        // Motas del haz del faro (10-c): órbita alrededor de la linterna
        // (a.x/a.y), dirección rotando determinista (0.35 rad/s, la misma del
        // haz cónico del sprite). Trazo alargado ORIENTADO a la tangente del
        // giro → sensación de barrido de luz. Cull barato: si la linterna
        // sale de encuadre, updateAmbient las desactiva por posición.
        const ang = t * 0.35 + a.seed * 6.28;
        const rad = (9 + a.t * 17 + a.seed * 6) * ZOOM;
        const bx = x + Math.cos(ang) * rad;
        const by = y + Math.sin(ang) * rad * 0.85; // leve achatado cenital
        // R5-O7: culling sobre el PUNTO ORBITAL (lo que se pinta de verdad;
        // la base puede quedar hasta 120 px fuera del encuadre).
        if (bx < -8 || bx > VIEW_W + 8 || by < -8 || by > VIEW_H + 8) break;
        const tw = 0.75 + 0.25 * Math.sin(t * 5 + a.seed * 40);
        const nightK = night ? 1.25 : 1; // de noche arde más en la bruma
        ctx.globalAlpha = Math.min(0.34, 0.17 * fade * tw * nightK);
        // R5-O7: strokeStyle constante → 1 setter solo si cambió desde fuera
        if (_lastStroke !== '#fff3c8') { ctx.strokeStyle = '#fff3c8'; _lastStroke = '#fff3c8'; }
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

// R5-O7: tabla de estrellas PRECALCULADA — los 3 hash2 por estrella son
// deterministas (mismos valores SIEMPRE), así que se calculan una vez y se
// reconstruyen solo si la vista dinámica cambia VIEW_W/VIEW_H. Antes: 138
// hash2 + ternarios por frame cada noche.
interface SkyStar { x: number; y: number; sz: number; warm: boolean; sp: number; ph: number }
let skyStars: SkyStar[] | null = null;
let skyStarsW = -1, skyStarsH = -1;

function ensureSkyStars(): SkyStar[] {
  if (skyStars && skyStarsW === VIEW_W && skyStarsH === VIEW_H) return skyStars;
  const arr: SkyStar[] = [];
  for (let i = 0; i < 46; i++) {
    const s1 = hash2(i * 7 + 1, 3);
    const s2 = hash2(i * 13 + 2, 5);
    const s3 = hash2(i * 17 + 4, 9);
    arr.push({
      x: s1 * VIEW_W, y: s2 * VIEW_H * 0.55,
      sz: s3 > 0.7 ? 2 : 1, warm: s3 > 0.85,
      sp: 0.5 + s3 * 1.2, ph: s3 * 9,
    });
  }
  skyStars = arr; skyStarsW = VIEW_W; skyStarsH = VIEW_H;
  return arr;
}

// R5-O7: halo lunar cacheado (antes createRadialGradient + addColorStop POR
// FRAME de noche). El nf que antes iba horneado en el stop pasa a globalAlpha:
// pintar rgba(a=0.30) con alpha nf ≡ rgba(a=0.30·nf) — resultado idéntico.
let moonHalo: CanvasGradient | null = null;
let moonHaloW = -1;

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

  // R16: salas cubiertas — sin estrellas ni luna sobre el techo
  if (g.map.indoor) return;

  // factor de noche coherente con drawLighting
  const dayLight = Math.max(0.1, Math.sin(g.dayT * Math.PI * 2) * 1.25 + 0.25);
  const nf = 1 - Math.min(1, dayLight);
  if (nf < 0.08) return;

  // ---- estrellas titilantes (deterministas, tabla precalculada) ----
  const stars = ensureSkyStars();
  _lastFill = '\u0000';
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * s.sp + s.ph));
    ctx.globalAlpha = nf * tw * 0.8;
    fillC(ctx, s.warm ? '#ffe9c8' : '#dce4ff');
    ctx.fillRect(s.x, s.y, s.sz, s.sz);
  }
  ctx.globalAlpha = 1;

  // ---- luna con halo ----
  if (nf > 0.3) {
    const mx = VIEW_W * 0.8, my = 64;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (!moonHalo || moonHaloW !== VIEW_W) {
      moonHalo = ctx.createRadialGradient(mx, my, 6, mx, my, 52);
      moonHalo.addColorStop(0, 'rgba(214,226,255,0.30)');
      moonHalo.addColorStop(1, 'rgba(214,226,255,0)');
      moonHaloW = VIEW_W;
    }
    ctx.globalAlpha = nf; // el alpha de noche vive ahora aquí (ver nota R5-O7)
    ctx.fillStyle = moonHalo;
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
}

/**
 * Destello de crítico: 3 partículas doradas grandes que se abren y se
 * apagan (tamaños decrecientes + vida escalonada → sensación de expansión).
 * Complementa el flash de daño (e.hitFlash) sin tocar render.
 */
export function critGlint(g: Game, x: number, y: number): void {
  // R5-O7: las 2 primeras son CHISPAS (size ≥ 3) → respetan el cap propio
  // de chispas vía beginSparkBatch/pushSpark (ver SPARK_CAP).
  beginSparkBatch(g, 2);
  for (let i = 0; i < 2; i++) {
    const a = i * (Math.PI * 2 / 3) + 0.5;
    const t = 0.28 + i * 0.04;
    pushSpark(
      g, x + Math.cos(a) * 3, y + Math.sin(a) * 3,
      Math.cos(a) * 24, Math.sin(a) * 24,
      t, t, i === 0 ? '#ffe86a' : '#ffd24a', 4.4 - i * 0.8, 14,
    );
  }
  // la tercera (size 2.8) es partícula NORMAL (bucle estándar del render;
  // el techo global del motor, particles ≤ 400, la cubre)
  const a2 = 2 * (Math.PI * 2 / 3) + 0.5;
  const t2 = 0.28 + 2 * 0.04;
  g.particles.push({
    x: x + Math.cos(a2) * 3, y: y + Math.sin(a2) * 3,
    vx: Math.cos(a2) * 24, vy: Math.sin(a2) * 24,
    t: t2, maxT: t2, color: '#ffd24a', size: 4.4 - 2 * 0.8, grav: 14,
  });
}

// ---------------- Consultas para render.ts ----------------

/**
 * Estelas de esquiva vivas (para dibujar afterimages).
 *
 * NOTA R3-A1: la estela se PINTA en render.ts (drawRollTrail) con el código
 * inline actual (alpha = life/TRAIL_LIFE * 0.35), así que este módulo NO la
 * toca: getRollTrail mantiene su firma y comportamiento exactos. Mejora V2
 * sugerida para el integrador (requiere editar render.ts, fuera de mi scope):
 *   1) desvanecer con ESCALADO: dibujar cada afterimage con alpha actual y
 *      tamaño 1 → 0.85 según life/TRAIL_LIFE (drawImage con w/h escalados);
 *   2) doble ghost desplazado: para life > 0.5, pintar un segundo eco del
 *      frame desplazado (-3,-2) px de pantalla con alpha*0.4 (sensación de
 *      velocidad residual tras el rodar).
 */
export function getRollTrail(): TrailPt[] {
  return rollTrail;
}

// R5-O7: objeto reutilizado (antes 1 objeto nuevo por frame); render.ts
// desestructura el resultado AL INSTANTE (consumo inmediato) — no retener la
// referencia devuelta.
const _bannerInfo = { slide: 0, out: 0, elapsed: 0 };

/** Progreso del banner de jefe: slide 0→1 (entrada), out 1→0 (salida). */
export function bannerInfo(g: Game): { slide: number; out: number; elapsed: number } {
  _bannerInfo.slide = Math.min(1, bannerElapsed / 0.45);
  _bannerInfo.out = Math.min(1, g.bossBannerT / 0.4);
  _bannerInfo.elapsed = bannerElapsed;
  return _bannerInfo;
}

/** Alpha del overlay de memoria (entrada 0.5 s, salida según t restante). */
export function memoryAlpha(g: Game): number {
  if (!g.memoryReveal) return 0;
  return Math.max(0, Math.min(1, memElapsed / 0.5, g.memoryReveal.t / 0.6));
}

// ============================================================
// R3-A1 · NÚMEROS DE DAÑO V2 (juice)
// ============================================================

const FLOAT_LIFE = 0.9; // vida que asigna Game.floatAt (f.t cuenta ATRÁS desde aquí)

/** Textos "especiales" con subrayado, igual que el inline actual de render.ts. */
const FLOAT_SPECIAL = new Set(['QUEBRADO', '¡PARADA!', '¡REMATE!', '¡CRÍTICO!']);

/** Núcleo claro por color base para la doble pasada de CRÍTICO. */
const CRIT_CORE: Record<string, string> = {
  '#ffd24a': '#fff0b0', // número de daño crítico (dorado)
  '#ffe86a': '#fff6c8', // etiqueta '¡CRÍTICO!' (pasa por FLOAT_SPECIAL)
};

// R5-O7: caché de strings de fuente por tamaño redondeado — antes 1 string
// nueva por float por frame (fBody) + re-resolución de la fuente en el setter.
// Tamaños posibles ~4..30: la tabla es diminuta y la string repetida va por
// camino rápido en el setter del navegador.
const _fontCache = new Map<number, string>();
function cachedFont(px: number): string {
  let f = _fontCache.get(px);
  if (f === undefined) { f = fBody(px); _fontCache.set(px, f); }
  return f;
}

/**
 * Número de daño V2 — reemplaza el dibujo inline de drawFloats.
 *
 * CONTRATO DE INTEGRACIÓN (render.ts · drawFloats, líneas ~568-602):
 * el integrador debe sustituir el bloque inline por:
 *
 *   for (const f of g.floats) {
 *     drawFloatV2(g.ctx, f, sx, sy, g.globalT);
 *   }
 *
 * donde sx/sy son LAS MISMAS funciones mundo→pantalla que drawFloats ya
 * recibe ((n) => n * ZOOM - cam). Los floats que NO pasen por esta función
 * siguen viéndose con el código inline actual (mismo formato, sin cambios).
 *
 * Añadidos V2 (reinterpreta f.vy/f.t SIN tocar types.ts):
 *  (a) TRAYECTORIA EN ARCO: la subida lineal de update.ts (f.y += vy*dt) se
 *      corrige en el DRAW con una parábola de lanzamiento (sube rápido,
 *      flota y cae hasta la altura de origen); fase/altura por hash2(f.x)
 *      (x nunca cambia: el update solo mueve y). Al caer, REBOTE de 1 px
 *      de mundo (2 px de pantalla) antes de morir.
 *  (b) CRÍTICO: texto que contiene 'CRÍTICO' o color '#ffd24a' → se dibuja
 *      1 px más grande con DOBLE PASADA (sombra dura desplazada + núcleo
 *      claro sobre el color base).
 *  (c) CONTORNO OSCURO de 1 px en los 4 cardinales para TODOS los floats
 *      (legibilidad sobre nieve/niebla del Bosque).
 *  (d) FADE-OUT POR ESCALA en el último 20 % de vida (la fuente encoge
 *      hacia 0.55 mientras el alpha ya baja).
 * Determinista: cero Math.random; todo por hash2 ×2 y Math.sin(globalT).
 * Restaura el estado del ctx (save/restore): no contamina otros draws.
 */
export function drawFloatV2(
  ctx: CanvasRenderingContext2D,
  f: FloatText,
  sx: (n: number) => number,
  sy: (n: number) => number,
  globalT: number,
): void {
  const alpha = Math.max(0, Math.min(1, f.t * 2.2)); // misma curva que el inline actual
  if (alpha <= 0) return;

  // --- edad normalizada 0→1 (f.t va hacia atrás desde FLOAT_LIFE) ---
  const age = Math.max(0, Math.min(FLOAT_LIFE, FLOAT_LIFE - f.t));
  const u = age / FLOAT_LIFE;

  // --- fase determinista por hash de x (×2: hash2 vive en [0,0.5)) ---
  const hx = Math.floor(f.x) * 3 + 7;
  const ph1 = hash2(hx, 91) * 2;   // altura del arco
  const ph2 = hash2(hx, 57) * 2;   // ápice del arco
  const ph3 = hash2(hx, 23) * 2;   // deriva horizontal

  // --- (a) arco: target(u) es la altura visual REAL respecto al origen ---
  const apex = 0.36 + ph2 * 0.08;          // momento del punto muerto (0.36-0.44)
  const H = 4.5 + ph1 * 3.5;               // altura del arco en px de mundo
  let target: number;                       // negativo = arriba (px de mundo)
  if (u <= apex * 2) {
    const k = (u - apex) / apex;            // -1 → 1
    target = -H * (1 - k * k);              // parábola: 0 → -H → 0
  } else {
    const ub = (u - apex * 2) / (1 - apex * 2); // fase de caída/rebote 0→1
    target = -Math.abs(Math.sin(ub * Math.PI)); // rebote de 1 px de mundo al caer
  }
  // corrección sobre la subida lineal que update.ts YA aplicó a f.y
  const oy = target - f.vy * FLOAT_LIFE * u;                       // px de mundo
  const ox = (ph3 - 0.5) * 6 * u + Math.sin(globalT * 6.5 + ph1 * 6.28) * 0.35;
  const x = Math.round(sx(f.x) + ox * ZOOM);
  const y = Math.round(sy(f.y) + oy * ZOOM);

  // R5-O7: culling — un float fuera de viewport no pinta nada. Margen Y 64 px
  // (tamaño máximo de fuente + subrayado) y margen X 96 px (los textos
  // especiales son anchos: '¡PARADA!' ≈ 73 px de semiancho).
  if (x < -96 || x > VIEW_W + 96 || y < -64 || y > VIEW_H + 64) return;

  // --- (d) fade-out por escala en el último 20 % de vida ---
  const tw = FLOAT_LIFE * 0.2;
  const scale = f.t < tw ? 0.55 + 0.45 * (f.t / tw) : 1;

  // --- tamaño/color: mismas reglas que el inline actual + crítico ---
  const special = FLOAT_SPECIAL.has(f.text);
  const crit = f.text.indexOf('CRÍTICO') >= 0 || f.color === '#ffd24a';
  let size = f.size * 1.6 * (f.t > 0.74 ? 1.38 : 1); // pop inicial igual al actual
  let color = f.color;
  if (special) { color = '#ffe86a'; size *= 1.3; }
  else if (f.color === '#ffd24a') size *= 1.15;      // críticos dorados
  else if (f.color === '#ff7060') size *= 1.08;      // daño propio
  if (crit) size += 1;                               // (b) CRÍTICO: 1 px más grande
  size *= scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  // R5-O7: font desde caché (string estable → setter rápido). El save/restore
  // se mantiene: ≤64 floats y cada uno ya cuesta 5-6 fillText — el estado del
  // ctx queda exactamente como antes (no contamina otros draws).
  ctx.font = cachedFont(Math.max(4, Math.round(size)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // --- (c) contorno oscuro de 1 px (4 cardinales) para TODOS los floats ---
  ctx.fillStyle = 'rgba(14,10,20,0.9)';
  ctx.fillText(f.text, x + 1, y);
  ctx.fillText(f.text, x - 1, y);
  ctx.fillText(f.text, x, y + 1);
  ctx.fillText(f.text, x, y - 1);

  if (crit) {
    // (b) doble pasada CRÍTICO: sombra dura + núcleo claro
    ctx.fillStyle = 'rgba(32,20,4,0.95)';
    ctx.fillText(f.text, x + 2, y + 2);
    ctx.fillStyle = CRIT_CORE[color] ?? '#fff0b0';
  } else {
    ctx.fillStyle = color;
  }
  ctx.fillText(f.text, x, y);

  if (special) {
    // subrayado brillante de los remates (entero, como el inline actual)
    const uw = Math.max(4, Math.round(size * f.text.length * 0.44));
    ctx.fillStyle = 'rgba(255,232,106,0.8)';
    ctx.fillRect(x - (uw >> 1), y + Math.round(size * 1.05), uw, 1);
  }
  ctx.restore();
}

// ============================================================
// R3-A1 · CHISPAS DE IMPACTO (juice de golpe)
// ============================================================

/**
 * CONVENCIÓN de size para partículas (no rompe Particle de types.ts):
 *   size <  SPARK_MIN_SIZE (3) → partícula NORMAL (cuadrado del bucle estándar)
 *   size >= 3 y < 5            → CHISPA: la pinta drawSparks como TRAZO alargado
 *   size >= 5                  → DESTELLO: cruz blanca creciente muy breve
 *
 * CONTRATO DE INTEGRACIÓN (render.ts · drawWorld, bucle de partículas ~154):
 *
 *   // 1) trazos de chispas ANTES del bucle normal:
 *   drawSparks(ctx, g, sx, sy);
 *
 *   // 2) el bucle normal omite las chispas con un filtro por size:
 *   for (const p of g.particles) {
 *     if (p.size >= SPARK_MIN_SIZE) continue; // las gestiona drawSparks
 *     ...
 *   }
 *
 * Auditado: NINGUNA partícula previa del motor usa size >= 3 (engine.burst
 * < 3, update.ts ≤ 2, bossfx ≤ 2.5, fx.ts ≤ 2), así que el filtro no altera
 * ningún efecto existente. Mientras el integrador no aplique los 2 pasos,
 * las chispas se verían como cuadrados grandes en el bucle normal (inofensivo).
 */
export const SPARK_MIN_SIZE = 3;

// ---------------- R5-O7 · cap de CHISPAS propias ----------------
// El motor ya protege el TOTAL de g.particles (≤ 400); aquí acotamos las
// CHISPAS nuestras (size >= SPARK_MIN_SIZE) a 220. En cada evento de spawn se
// cuentan las vivas (O(n) UNA vez por evento, no por frame) y si el lote
// excede el cap se RECICLA la más vieja mutando su slot in situ (cero
// crecida del array, cero alloc extra). "Más vieja" = primero en el orden del
// array: update.ts filtra preservando el orden y el motor recorta desde el
// inicio al pasarse de 400, así que el array siempre queda ordenado por edad.
const SPARK_CAP = 220;
const sparkIdx: number[] = []; // índices de chispas vivas (reutilizado)
let sparkRecycle = 0;          // cuántas hay que reciclar para el lote actual
let sparkUsed = 0;             // cursor de reciclaje dentro de sparkIdx

function beginSparkBatch(g: Game, incoming: number): void {
  const ps = g.particles;
  sparkIdx.length = 0;
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].size >= SPARK_MIN_SIZE) sparkIdx.push(i);
  }
  let r = sparkIdx.length + incoming - SPARK_CAP;
  if (r > sparkIdx.length) r = sparkIdx.length; // nunca más que las vivas
  sparkRecycle = r > 0 ? r : 0;
  sparkUsed = 0;
}

/** Inserta una chispa: slot nuevo o la más vieja reciclada (mutación in situ). */
function pushSpark(
  g: Game, x: number, y: number, vx: number, vy: number,
  t: number, maxT: number, color: string, size: number, grav: number,
): void {
  const ps = g.particles;
  if (sparkRecycle > 0) {
    const p = ps[sparkIdx[sparkUsed++]];
    sparkRecycle--;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.t = t; p.maxT = maxT; p.color = color; p.size = size; p.grav = grav;
    return;
  }
  ps.push({ x, y, vx, vy, t, maxT, color, size, grav });
}

/** Semilla secuencial determinista para las chispas (cero Math.random). */
let sparkSeed = 1;

/**
 * Chispas de impacto: añade a g.particles 4-8 chispas alargadas (size 3-4,
 * velocidad radial sesgada en la dirección del golpe, grav leve) + 1
 * destello blanco muy breve (size 5.5).
 *
 * @param x, y   punto de impacto en px de MUNDO (como g.burst)
 * @param dir    ángulo del golpe en radianes (convención atan2: 0 = derecha,
 *               PI/2 = abajo). Atajos documentados: -1 = izquierda, 1 =
 *               derecha, 0 = golpe SIN dirección (abanico hacia arriba).
 *               Ejemplo con knockback: Math.atan2(kby, kbx).
 * @param color  color de las chispas (el destello siempre es blanco)
 * @param n      chispas solicitadas; se recorta al rango [4, 8] (default 6)
 *
 * Determinista (hash2 ×2 con semilla secuencial) → replays estables.
 */
export function spawnHitSparks(g: Game, x: number, y: number, dir: number, color: string, n?: number): void {
  const count = Math.max(4, Math.min(8, n ?? 6)) || 6; // `|| 6`: n inválido (NaN) → default
  let base: number;
  if (dir === -1) base = Math.PI;        // atajo: golpe hacia la izquierda
  else if (dir === 1) base = 0;          // atajo: golpe hacia la derecha
  else if (dir === 0) base = -Math.PI / 2; // sin dirección: abanico hacia arriba
  else base = dir;                       // ángulo completo en radianes

  // R5-O7: cap de chispas — con el lote nuevo (count + 1 destello) por encima
  // de SPARK_CAP se recicla la más vieja en vez de crecer sin techo propio.
  beginSparkBatch(g, count + 1);

  for (let i = 0; i < count; i++) {
    const h1 = hash2(sparkSeed * 7919 + i * 131, 11) * 2;
    const h2 = hash2(sparkSeed * 7919 + i * 131, 23) * 2;
    const h3 = hash2(sparkSeed * 7919 + i * 131, 37) * 2;
    const h4 = hash2(sparkSeed * 7919 + i * 131, 53) * 2;
    const a = base + (h1 - 0.5) * 1.7;   // abanico de ±0.85 rad
    const spd = 55 + h2 * 85;            // 55-140 px/s de mundo
    const maxT = 0.22 + h3 * 0.16;       // 0.22-0.38 s
    pushSpark(
      g, x, y,
      Math.cos(a) * spd,
      Math.sin(a) * spd - 18,            // leve patada hacia arriba
      maxT, maxT, color,
      3 + (h4 > 0.72 ? 1 : 0),           // 3-4 = CHISPA (trazo en drawSparks)
      85 + h4 * 40,                      // grav leve: caen arqueándose
    );
  }
  // destello blanco: 1 partícula grande y muy breve (size >= 5 = DESTELLO)
  pushSpark(g, x, y - 2, 0, 0, 0.09, 0.09, '#ffffff', 5.5, 0);
  sparkSeed = (sparkSeed + 1) % 100003;  // avanza la secuencia determinista
}

/**
 * Dibuja las chispas/destellos (size >= SPARK_MIN_SIZE) de g.particles.
 *
 * CONTRATO: el integrador debe llamarla ANTES del bucle de partículas normal
 * de drawWorld (ver el bloque de documentación de SPARK_MIN_SIZE) y añadir
 * ahí el filtro `if (p.size >= SPARK_MIN_SIZE) continue;`.
 *
 * - CHISPA (3 ≤ size < 5): trazo de 2-3 rects de 1 px en la dirección de
 *   (vx, vy) — cabeza caliente clara + cola del color de la chispa.
 * - DESTELLO (size ≥ 5): cruz blanca 2×2 + brazos que crecen al apagarse.
 * Todo con fillRect ENTEROS en pantalla y alpha clampeado a [0,1].
 * Restaura globalAlpha; ignora partículas normales (size < 3) y muertas.
 *
 * R5-O7: 3 PASES por grupo con batch de estilo — destellos, colas (fillStyle
 * solo al cambiar de color) y cabezas (fillStyle UNA vez para todo el grupo;
 * antes: 2 setters + un array literal POR CHISPA POR FRAME). Culling de lo
 * que esté fuera de viewport (margen 8 px ≥ radio máximo de dibujo 5 px) y
 * sqrt directo en vez de hypot. Única diferencia consciente: el orden entre
 * píxeles de chispas DISTINTAS (solape raro, mezcla por alpha imperceptible).
 */
const SPARK_HEAD_A = [1, 0.65, 0.35]; // alphas cabeza/cola (antes 1 literal por chispa)

export function drawSparks(
  ctx: CanvasRenderingContext2D,
  g: Game,
  sx: (n: number) => number,
  sy: (n: number) => number,
): void {
  const ps = g.particles;
  const M = 8; // margen de culling en px de pantalla (destello ≤ 5, chispa ≤ 3)
  // ---- pase 1: DESTELLOS (size ≥ 5) — pocos; estilo por partícula ----
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.size < 5 || p.t <= 0) continue;
    const lifeK = Math.max(0, Math.min(1, p.t / p.maxT)); // 1 → 0
    const x = Math.round(sx(p.x));
    const y = Math.round(sy(p.y));
    if (x < -M || x > VIEW_W + M || y < -M || y > VIEW_H + M) continue;
    // --- destello: cruz blanca creciente que se apaga ---
    const arm = 1 + Math.round((1 - lifeK) * 3);
    ctx.globalAlpha = lifeK;
    ctx.fillStyle = p.color;
    ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.globalAlpha = Math.max(0, Math.min(1, lifeK * 0.7));
    ctx.fillRect(x - arm, y, arm * 2 + 1, 1);  // brazo horizontal
    ctx.fillRect(x, y - arm, 1, arm * 2 + 1);  // brazo vertical
  }
  // ---- pase 2: colas de CHISPA (3 ≤ size < 5) — fillStyle solo al cambiar ----
  let lastFill = '\u0000';
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.size < SPARK_MIN_SIZE || p.size >= 5 || p.t <= 0) continue;
    const lifeK = Math.max(0, Math.min(1, p.t / p.maxT));
    const x = Math.round(sx(p.x));
    const y = Math.round(sy(p.y));
    if (x < -M || x > VIEW_W + M || y < -M || y > VIEW_H + M) continue;
    const len = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
    const dx = p.vx / len, dy = p.vy / len;
    if (p.color !== lastFill) { ctx.fillStyle = p.color; lastFill = p.color; }
    ctx.globalAlpha = Math.max(0, Math.min(1, SPARK_HEAD_A[1] * lifeK));
    ctx.fillRect(x - Math.round(dx), y - Math.round(dy), 1, 1);
    ctx.globalAlpha = Math.max(0, Math.min(1, SPARK_HEAD_A[2] * lifeK));
    ctx.fillRect(x - Math.round(dx * 2), y - Math.round(dy * 2), 1, 1);
  }
  // ---- pase 3: cabezas calientes — fillStyle UNA vez para todo el grupo ----
  ctx.fillStyle = '#fff8e0';
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.size < SPARK_MIN_SIZE || p.size >= 5 || p.t <= 0) continue;
    const lifeK = Math.max(0, Math.min(1, p.t / p.maxT));
    const x = Math.round(sx(p.x));
    const y = Math.round(sy(p.y));
    if (x < -M || x > VIEW_W + M || y < -M || y > VIEW_H + M) continue;
    ctx.globalAlpha = Math.max(0, Math.min(1, SPARK_HEAD_A[0] * lifeK));
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
