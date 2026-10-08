// ============================================================
// ECOS DE AELTHAR — horror.ts (módulo actors)
// R2-A4 · Terror ambiental
// ------------------------------------------------------------
// Capa de terror autocontenida que se dibuja POR ENCIMA de la
// iluminación (el integrador la llama tras drawLightingV2):
//   a) Viñeta cardiaca: late (double-beat) cuando terror > 0.5.
//   b) Susurros visuales: glifos violeta junto a enemigos 'sombra'.
//   c) Niebla que observa: ojos ámbar en el bosque nocturno.
//   d) Temblor sutil: NO toca g.shake; expone getHorrorShake()
//      para que el integrador sume el micro-desplazamiento.
//
// Convenciones del motor usadas aquí:
//   - camX/camY van en píxeles de PANTALLA (zoom): screen = wx*ZOOM - camX.
//   - TILE = 16 px de mundo (1 tile = 32 px de pantalla con ZOOM=2).
//   - dayT: noche cuando dayT > 0.7 (igual que update.isNight).
//   - Todo determinista vía hash2 (world/palette): cero Math.random.
//   - Cero allocations por frame: viñeta pre-pintada en caché, colores
//     constantes + globalAlpha (sin strings rgba dinámicas), todos los
//     fillRect con coordenadas/tamaños enteros.
// ============================================================

import { VIEW_W, VIEW_H, ZOOM } from '../consts';
import { hash2 } from '../world/palette';
import type { Game } from '../engine';

// ---------------- Estado interno (pools/cachés del módulo) ----------------

let terror = 0;          // nivel de terror suavizado 0..1 (lectura vía horrorLevel)
let shakeAmp = 0;        // amplitud de temblor 0..1.5 px
let shakeOff = 0;        // desplazamiento firmado actual (±shakeAmp)
let clockT = -1;         // globalT del último refresco (estabilidad intra-frame)
let vignette: HTMLCanvasElement | null = null; // viñeta cardiaca pre-pintada
// Anclas de los ojos en la niebla (pool interno de 2): se fijan en px de MUNDO
// al abrir cada ventana de 6 s, así el jugador puede acercarse y ahuyentarlos.
let ojoSlot = -1;
let ojoValid = false;
const ojoAnchX = [0, 0], ojoAnchY = [0, 0];

// Base de terror por mapa (lunaris sin especificar → piso bajo).
const BASE_MAP = { lunaris: 0.05, bosque: 0.15, cripta: 0.35 } as const;

// Semillas deterministas fijas (nada de strings por frame).
function strSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h & 0x7fffffff;
}
const SEM_OJOS = (strSeed('bosque') % 9973) + 1; // hash del mapId REDUCIDO: hash2 pierde precisión con operandos > ~2^31 (mismo sesgo documentado en world/lighting.ts)

/**
 * hash2 normalizado: el hash2 nativo SOLO devuelve [0, 0.5) (el producto final
 * *1274126177 desborda 2^53 y aplana el rango — verificado empíricamente sobre
 * 40 000 pares). ×2 lo lleva a [0, 1) con reparto uniforme (cuartiles ~25%).
 * Todos los umbrales de este módulo asumen [0, 1).
 */
function h2(a: number, b: number): number {
  return hash2(a, b) * 2;
}

// Colores constantes (el fade va por globalAlpha, nunca por string rgba).
const COL_SUSURRO = '#9d7be8'; // violeta tenue (glifos)
const COL_OJO = '#e2a83e';     // ámbar tenue (ojos en la niebla)

// ---------------- 1) Nivel de terror ----------------

/**
 * updateHorror — recalcula el "nivel de terror" 0..1 y el temblor interno.
 * Aporte: base por mapa (cripta 0.35 / bosque 0.15) + noche (dayT>0.7) 0.2
 * + 0.15 por cada sombra EN PANTALLA (máx 0.45) + 0.4 si el jefe está aggro.
 * Sube rápido y decae suave (rates asimétricos).
 */
export function updateHorror(g: Game, dt: number): void {
  let target: number = BASE_MAP[g.mapId];
  if (g.dayT > 0.7) target += 0.2; // noche

  // Sombras dentro de la vista (vista en px de mundo: camX/ZOOM .. (camX+W)/ZOOM)
  const minX = g.camX / ZOOM - 24, maxX = (g.camX + VIEW_W) / ZOOM + 24;
  const minY = g.camY / ZOOM - 24, maxY = (g.camY + VIEW_H) / ZOOM + 24;
  let sombras = 0;
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (e.etype !== 'sombra' || e.dead) continue;
    if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) continue;
    sombras++;
  }
  target += Math.min(0.45, sombras * 0.15);

  const b = g.bossRef;
  if (g.bossActive && b && !b.dead && b.aggro) target += 0.4;
  if (target > 1) target = 1; else if (target < 0) target = 0;

  // Aproximación asimétrica: sube a ~2.6/s, decae a ~0.55/s (suave).
  const k = target > terror ? 2.6 : 0.55;
  terror += (target - terror) * Math.min(1, dt * k);

  recomputeShake(g);
  clockT = g.globalT;
}

/** Recalcula solo el micro-temblor (d) a partir del terror almacenado. */
function recomputeShake(g: Game): void {
  const b = g.bossRef;
  if (terror > 0.75 && g.bossActive && b && !b.dead) {
    const ramp = Math.min(1, (terror - 0.75) * 4);
    // Amplitud pulsante (latido de baja frecuencia), pico 1.5 px.
    shakeAmp = ramp * 1.5 * (0.62 + 0.38 * Math.sin(g.globalT * 9.1) * Math.sin(g.globalT * 4.3 + 1.7));
    // Desplazamiento firmado, temblor rápido pero determinista.
    shakeOff = shakeAmp * (0.6 * Math.sin(g.globalT * 31.4) + 0.4 * Math.sin(g.globalT * 53.7 + 2.1));
  } else {
    shakeAmp = 0;
    shakeOff = 0;
  }
}

// ---------------- 3) 4) Lecturas para el integrador / audio ----------------

/**
 * getHorrorShake — micro-temblor del terror (d). NO toca g.shake.
 * Devuelve un desplazamiento ya oscilado y determinista en [-1.5, 1.5] px
 * (amplitud pico 1.5 px); 0 cuando no aplica. Estable dentro del mismo
 * frame (depende solo de globalT), seguro para llamarlo varias veces.
 * Sugerencia de uso en render: const h = getHorrorShake(); offset X = h,
 * offset Y = h * 0.7 (o simplemente h en ambos ejes).
 */
export function getHorrorShake(): number {
  return shakeOff;
}

/** horrorLevel — nivel de terror 0..1 actual (para audio/música futura). */
export function horrorLevel(): number {
  return terror;
}

// ---------------- 2) Capa visual (dibujar tras la iluminación) ----------------

/**
 * drawHorrorOverlay — pinta viñeta cardiaca + susurros + ojos en la niebla
 * en espacio de vista 960×540. Llamar DESPUÉS de la iluminación y antes del
 * HUD. Si el integrador aún no conecta updateHorror, refresca el temblor
 * igualmente (usando el último terror conocido) para no quedar congelado.
 */
export function drawHorrorOverlay(ctx: CanvasRenderingContext2D, g: Game): void {
  const p = g.player;
  if (!p) return;

  // Si updateHorror no corrió en este frame, al menos refresca el temblor.
  if (clockT !== g.globalT) {
    recomputeShake(g);
    clockT = g.globalT;
  }

  const camRX = Math.round(g.camX), camRY = Math.round(g.camY);
  // Vista en px de mundo (con margen para bordes de sprites).
  const minX = g.camX / ZOOM - 20, maxX = (g.camX + VIEW_W) / ZOOM + 20;
  const minY = g.camY / ZOOM - 20, maxY = (g.camY + VIEW_H) / ZOOM + 20;

  // -------- a) VIGNETTA CARDIACA (terror > 0.5) --------
  if (terror > 0.5) {
    // Double-beat suave: sin(t*4) + sin(t*8)*0.3 ∈ [-1.3, 1.3] → normalizado 0..1
    const pulso = Math.sin(g.globalT * 4) + Math.sin(g.globalT * 8) * 0.3;
    const pn = 0.5 + 0.5 * (pulso / 1.3);
    const ramp = (terror - 0.5) * 2; // aparición gradual desde 0.5
    ctx.globalAlpha = (0.12 + 0.08 * pn) * Math.min(1, ramp);
    ctx.drawImage(ensureVignette(), 0, 0);
    ctx.globalAlpha = 1;
  }

  // -------- b) SUSURROS VISUALES (glifos junto a sombras cercanas) --------
  ctx.fillStyle = COL_SUSURRO;
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (e.etype !== 'sombra' || e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    if (dx * dx + dy * dy > 14400) continue; // >120 px de mundo: nada
    if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) continue;

    // Semilla estable ligada a la posición (los glifos no saltan al moverse).
    const sxw = Math.round(e.x), syw = Math.round(e.y);
    const h0 = h2(sxw, syw);
    const n = 4 + ((h0 * 3) | 0); // 4..6 glifos por sombra
    for (let j = 0; j < n; j++) {
      const h1 = h2(sxw, j * 7 + 1);
      const h2v = h2(sxw, j * 13 + 2);
      const h3 = h2(sxw, j * 29 + 5);
      const h4 = h2(sxw, j * 47 + 11);
      const ph = (g.globalT * 0.38 + h3) % 1; // vida 0..1: sube y se disipa
      const fade = Math.sin(ph * Math.PI);    // entra, flota, se desvanece
      if (fade < 0.04) continue;
      const wx = e.x + Math.cos(h1 * 6.283185) * (6 + h2v * 14)
               + Math.sin(g.globalT * 1.7 + h3 * 6.283185) * 2;
      const wy = e.y - 4 - h2v * 12 - ph * 15;
      const sx = Math.round(wx * ZOOM) - camRX;
      const sy = Math.round(wy * ZOOM) - camRY;
      if (sx < -8 || sx > VIEW_W + 8 || sy < -8 || sy > VIEW_H + 8) continue;
      ctx.globalAlpha = 0.18 * fade; // violeta muy tenue
      drawGlyph(ctx, sx, sy, (h4 * 6) | 0);
    }
  }
  ctx.globalAlpha = 1;

  // -------- c) NIEBLA QUE OBSERVA (bosque de noche) --------
  if (g.mapId === 'bosque' && g.dayT > 0.7) {
    const slot = Math.floor(g.globalT / 6); // ventana de 6 s
    const r = h2(slot, SEM_OJOS);
    const nOjos = r < 0.5 ? 0 : (r < 0.85 ? 1 : 2); // rareza: ~mitad de ventanas vacías
    if (nOjos > 0) {
      ensureEyeAnchors(g, slot, nOjos); // anclas fijas en el mundo para toda la ventana
      for (let k = 0; k < nOjos; k++) {
        const ex = ojoAnchX[k], ey = ojoAnchY[k];
        // Si el jugador se acerca a <5 tiles, el ojo se esfuma.
        const ddx = ex - p.x, ddy = ey - p.y;
        if (ddx * ddx + ddy * ddy < 6400) continue;

        // Se abre y cierra lentamente dentro de la ventana (smoothstep).
        const phSlot = (g.globalT - slot * 6) / 6;
        let open = Math.sin(phSlot * Math.PI);
        open = open * open * (3 - 2 * open);
        // Parpadeo breve determinista en un instante propio de cada ojo.
        const blinkT = 0.2 + h2(slot, k * 41 + 53) * 0.6;
        if (phSlot > blinkT - 0.05 && phSlot < blinkT + 0.05) open *= 0.2;
        if (open < 0.08) continue;

        const exs = Math.round(ex * ZOOM) - camRX;
        const eys = Math.round(ey * ZOOM) - camRY;
        if (exs < -8 || exs > VIEW_W + 8 || eys < -8 || eys > VIEW_H + 8) continue;

        // El ojo = 2 píxeles ámbar (2 px de ancho cada uno) que se abren/cierran.
        const hgt = Math.max(1, Math.round(open * 4));
        const shift = p.x < ex ? -1 : 1; // "miran" hacia el jugador
        ctx.fillStyle = COL_OJO;
        ctx.globalAlpha = 0.14 + open * 0.26; // ámbar tenue, nunca chillón
        ctx.fillRect(exs + shift, eys - (hgt >> 1), 2, hgt);
        ctx.fillRect(exs + 4 + shift, eys - (hgt >> 1), 2, hgt);
      }
    }
    ctx.globalAlpha = 1;
  }

  // d) TEMBLOR SUTIL: no se dibuja nada aquí — el integrador suma
  //    getHorrorShake() al desplazamiento de cámara/ctx (g.shake es del motor).
}

// ---------------- Glifos de susurro (formas fijas, fillRect enteros) ----------------

/** Mini-runas de 1×2 px de trazo: 6 formas deterministas, 2-4 trazos cada una. */
function drawGlyph(ctx: CanvasRenderingContext2D, sx: number, sy: number, kind: number): void {
  switch (kind) {
    case 0: // barra vertical + punto
      ctx.fillRect(sx, sy, 2, 6);
      ctx.fillRect(sx, sy + 8, 2, 2);
      break;
    case 1: // dos travesaños
      ctx.fillRect(sx - 1, sy, 4, 2);
      ctx.fillRect(sx - 1, sy + 3, 4, 2);
      break;
    case 2: // L
      ctx.fillRect(sx, sy, 2, 6);
      ctx.fillRect(sx, sy + 4, 4, 2);
      break;
    case 3: // cruz
      ctx.fillRect(sx, sy, 2, 6);
      ctx.fillRect(sx - 1, sy + 2, 4, 2);
      break;
    case 4: // zigzag descendente
      ctx.fillRect(sx, sy, 2, 2);
      ctx.fillRect(sx + 2, sy + 2, 2, 2);
      ctx.fillRect(sx + 4, sy + 4, 2, 2);
      break;
    default: // chevrón
      ctx.fillRect(sx, sy + 2, 2, 2);
      ctx.fillRect(sx + 2, sy, 2, 2);
      ctx.fillRect(sx + 4, sy + 2, 2, 2);
      break;
  }
}

// ---------------- Caché de la viñeta cardiaca ----------------

/**
 * Anclas de los ojos: deterministas por ventana (hash2(slot,·)), posicionadas
 * a 8-10 tiles del jugador CAPTURADO al abrir la ventana y confinadas al mapa.
 * Quedan fijas en el mundo durante los 6 s (el jugador puede acercarse).
 */
function ensureEyeAnchors(g: Game, slot: number, n: number): void {
  if (ojoSlot === slot && ojoValid) return;
  ojoSlot = slot;
  const p = g.player!; // drawHorrorOverlay ya garantiza player no nulo
  for (let k = 0; k < n; k++) {
    const ang = h2(slot, k * 17 + 31) * 6.283185;
    const dist = (8 + h2(slot, k * 23 + 37) * 2) * 16; // 8..10 tiles
    let ex = p.x + Math.cos(ang) * dist;
    let ey = p.y + Math.sin(ang) * dist;
    // Confinar al mundo (sin leer tiles: robusto incluso en intro).
    const maxWX = g.map.w * 16 - 4, maxWY = g.map.h * 16 - 4;
    if (ex < 4) ex = 4; else if (ex > maxWX) ex = maxWX;
    if (ey < 4) ey = 4; else if (ey > maxWY) ey = maxWY;
    ojoAnchX[k] = ex;
    ojoAnchY[k] = ey;
  }
  ojoValid = true;
}

/**
 * Viñeta pre-pintada UNA vez (radial, rgba(90,10,16)) — por frame solo hay un
 * drawImage con globalAlpha, cero allocations. Rojo muy apagado: nunca vivo.
 */
function ensureVignette(): HTMLCanvasElement {
  if (vignette) return vignette;
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  const x = c.getContext('2d')!;
  const g0 = x.createRadialGradient(
    VIEW_W / 2, VIEW_H * 0.52, VIEW_H * 0.30,
    VIEW_W / 2, VIEW_H * 0.52, VIEW_W * 0.59,
  );
  g0.addColorStop(0, 'rgba(90,10,16,0)');
  g0.addColorStop(0.55, 'rgba(90,10,16,0)');
  g0.addColorStop(1, 'rgba(90,10,16,1)');
  x.fillStyle = g0;
  x.fillRect(0, 0, VIEW_W, VIEW_H);
  vignette = c;
  return c;
}
