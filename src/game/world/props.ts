// ============================================================
// ECOS DE AELTHAR — Props v3 (módulo world · R1-A10 + R4-A4)
// Sistema autocontenido de props del mapa. Kinds reales:
//   'sanctuary' · 'forge' · 'fragment' · 'altarEcho' · 'sign' · 'gate'
//   + lore R10-6: 'plaque' · 'remains' · 'altarMinor' · 'woodsign' · 'waypost'
// Todo dibujo es directo por rects (sin caché SPR de sprites.ts)
// para que el módulo no dependa de sprites ni de render.
//
// NOVEDAD v3 (R4-A4 · aditivo, firma intacta):
//   · sanctuary/altarEcho: aura de suelo con anillos concéntricos
//     pixelados que "se inhalan" hacia el centro (ciclo 2 s), motas
//     que ascienden y se disipan (2 runas / 3 motas doradas) y el
//     cristal del santuario pulsa LENTO (2 s) sincronizado con el
//     anillo flotante y el halo.
//   · sign: tabla con vetas + tornillos (cabeza + ranura) +
//     esquinas reforzadas con hierro; globo de lectura con borde
//     doble (marco oscuro exterior + filo dorado).
//   · gate: barrotes con remaches + óxido sutil de 2 tonos; de
//     noche (g.dayT) la sombra se proyecta más larga; los pilares
//     ganan grietas con musgo y base hundida 1 px en la tierra
//     (los kinds tumba/pilar no existen en PropKind: se aplica a
//     los pilares del portón, que son los únicos del juego).
//   · forge: brasero con brasas de 3 tonos que alternan por hash
//     (ventana 0.4 s), chispas que suben 1-2 px en ventanas
//     discretas de 0.5 s y brillo metálico que recorre el canto
//     del yunque.
//   · selected (jugador <24 px): TODOS los kinds reciben un
//     contorno claro de 1 px en el suelo que pulsa sutilmente.
//
// NOVEDAD v5 (R10-6 · épica 6.3, aditivo, firmas intactas):
//   · CINCO KINDS DE LORE AMBIENTAL que pueblan el mundo sin estorbar
//     (no bloquean: props nunca colisionan; no interactúan: el motor
//     nearestInteract ignora kinds desconocidos): plaque (placas
//     conmemorativas de piedra grabada), remains (restos de guerra:
//     armaduras vencidas, carros rotos, huesos, estandartes caídos),
//     altarMinor (altares menores del Eco con vela encendida y motas
//     doradas), woodsign (carteles de madera con flechas, avisos y el
//     aspa rota de «NO ENTRES» pintada) y waypost (mojones de camino).
//   · 4 VARIANTES deterministas por kind vía hash2 de coords (patrón
//     v4 del archivo). Todo por rects, cero Math.random, cero alloc
//     por frame; cada draw nuevo sale temprano si el prop queda fuera
//     de vista (offscreen(), solo en los kinds v5).
//   · lorePropsForMap(): SPAWN DETERMINISTA (ver final del archivo)
//     que decide DÓNDE aparecen: 2-4 % de tiles elegibles, sesgo hacia
//     caminos/plazas, nunca sobre sólidos ni junto a puertas, sin
//     pisar props/cofres/NPCs existentes y con pesos por bioma.
//     Contrato de integración documentado junto a la función.
//
// NOVEDAD v4 (R7-V2 · aditivo, firmas intactas):
//   · VARIANTES POR FAMILIA vía hash2 (3-4 looks por prop, cero
//     Math.random): sign → tabla doble / pértiga con banderín /
//     farol colgado encendido-apagado; forge → tonel de temple con
//     aros (tapa puesta o abierta), caja con/sin tapa y saco atado;
//     gate → faroles de pilar encendidos (el halo crece de noche) o
//     apagados con cristal agrietado; sanctuary → remate apuntado y
//     ofrenda al pie; fragment → esquirla caída / grieta extra;
//     altarEcho → tapiz frontal con sigil por altar y musgo.
//   · Detalles de historia: cuerda deshilachada, tabla agrietada y
//     musgo en el cartel; PERCHAS DE PESCADO junto a los carteles de
//     la costa (mapId 'costa' + hash de posición).
//   · Los efectos v3 (auras, brasas, remaches, selección, sombras
//     nocturnas) quedan INTACTOS: solo se AÑADEN rects deterministas
//     baratos (fillRect, sin paths nuevos ni gradientes).
//
// CONTRATO DE COORDENADAS (elección documentada):
//   drawPropV2 recibe coords de MUNDO (wx, wy = centro del prop
//   en px de mundo, p. ej. pr.x*16+8, pr.y*16+8) y aplica ella
//   misma la transformación de cámara: Math.round(wx*ZOOM) -
//   Math.round(g.camX). Con wx en px de mundo la parte entera
//   queda garantizada (px mundo enteros ×ZOOM) y el integrador
//   solo necesita pasar g.ctx, el kind y el centro del prop.
//   La cámara se redondea igual que render.ts (Math.round) para
//   coincidir píxel a píxel con el resto de la capa de mundo.
//
// Determinismo: cero Math.random. Todas las animaciones usan
// g.globalT, sin() y hash2() sobre el tile del prop. El hash2
// nativo devuelve [0,0.5): aquí se normaliza con h2() = ×2
// (misma convención que spells/horror/telegraph de R3).
// ============================================================

import type { Game } from '../engine';
import { TILE, ZOOM } from '../engine';
import { hash2, PAL, PAL_PROP } from './palette';

// ---------------- Estado de frame (scratch interno) ----------------
// JS es single-threaded y el dibujado es síncrono: scratch a nivel
// de módulo evita arrastrar ctx/offsets por cada helper.

let _ctx: CanvasRenderingContext2D | null = null;
let _ox = 0;                 // ancla X en pantalla (px enteros)
let _oy = 0;                 // ancla Y en pantalla (px enteros)
let _t = 0;                  // globalT del frame
let _tx = 0;                 // tile X del prop (para hash determinista)
let _ty = 0;                 // tile Y del prop
let _nf = 0;                 // factor noche 0..1 (de g.dayT, espejo de lighting.ts)
let _pid = '';               // id del prop actual (flags de altares por id: altar_mareas/…)
let _mid = '';               // mapId del prop (v4: variantes por mapa, p. ej. perchas en costa)

// ---------------- Helpers de dibujo (px mundo locales ×ZOOM) ----------------

/** hash2 normalizado a [0,1): el hash nativo solo devuelve [0,0.5). */
function h2(a: number, b: number): number {
  return hash2(a | 0, b | 0) * 2;
}

/** Rect sólido en px de mundo locales al prop (0,0 = ancla). Redondea a enteros. */
function P(x: number, y: number, w: number, h: number, c: string): void {
  const x2 = _ctx!;
  x2.fillStyle = c;
  x2.fillRect(
    _ox + Math.round(x) * ZOOM, _oy + Math.round(y) * ZOOM,
    Math.round(w) * ZOOM, Math.round(h) * ZOOM,
  );
}

/** Rect con alpha (restaura el alpha previo del contexto). */
function PA(x: number, y: number, w: number, h: number, c: string, a: number): void {
  if (a <= 0.01) return;
  const x2 = _ctx!;
  const prev = x2.globalAlpha;
  x2.globalAlpha = prev * Math.min(1, a);
  P(x, y, w, h, c);
  x2.globalAlpha = prev;
}

/** Elipse rellena (halos, humo, niebla) con alpha; restaura el estado. */
function ELL(cx: number, cy: number, rx: number, ry: number, c: string, a: number): void {
  if (a <= 0.01) return;
  const x2 = _ctx!;
  const prev = x2.globalAlpha;
  x2.globalAlpha = prev * Math.min(1, a);
  x2.fillStyle = c;
  x2.beginPath();
  x2.ellipse(_ox + cx * ZOOM, _oy + cy * ZOOM, Math.max(0.5, rx * ZOOM), Math.max(0.5, ry * ZOOM), 0, 0, Math.PI * 2);
  x2.fill();
  x2.globalAlpha = prev;
}

/** Semicírculo de elipse trazado (anillo del santuario). front = mitad inferior. */
function RING_HALF(cy: number, rx: number, ry: number, front: boolean, c: string, a: number): void {
  const x2 = _ctx!;
  const prev = x2.globalAlpha;
  x2.globalAlpha = prev * a;
  x2.strokeStyle = c;
  x2.lineWidth = ZOOM; // 1 px de mundo
  x2.beginPath();
  x2.ellipse(
    _ox, _oy + cy * ZOOM, rx * ZOOM, ry * ZOOM, 0,
    front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2,
  );
  x2.stroke();
  x2.globalAlpha = prev;
}

/**
 * Anillo de SUELO pixelado (elipse aplastada de bloques 1×1, sin arc/stroke).
 * v3 R4-A4: aura del santuario/altar. N fijo por radio → determinista.
 */
function GROUND_RING(cy: number, rx: number, ry: number, c: string, a: number): void {
  if (a <= 0.02) return;
  const n = Math.max(16, Math.min(44, Math.round(rx * 3)));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const gx = Math.round(Math.cos(ang) * rx);
    const gy = cy + Math.round(Math.sin(ang) * ry);
    PA(gx, gy, 1, 1, c, a);
  }
}

// ---------------- Factor noche (espejo local de lighting.ts) ----------------

/**
 * Alpha de oscuridad del ciclo día/noche (dayT 0..1): MISMA tabla de
 * keyframes que world/lighting.ts (solo lectura conceptual, documentada
 * aquí porque props no importa lighting para no crear dependencias).
 * Devuelve 0 (día pleno) .. 1 (noche cerrada, alpha ≥ 0.58).
 */
const DAY_ALPHA: readonly (readonly [number, number])[] = [
  [0.00, 0.50], [0.08, 0.28], [0.15, 0.10], [0.26, 0.00], [0.44, 0.00],
  [0.52, 0.00], [0.62, 0.10], [0.74, 0.45], [0.86, 0.58], [1.00, 0.50],
];

function nightFactor(dayT: number): number {
  const d = ((dayT % 1) + 1) % 1;
  let a = 0;
  for (let i = 0; i + 1 < DAY_ALPHA.length; i++) {
    const t0 = DAY_ALPHA[i][0], a0 = DAY_ALPHA[i][1];
    const t1 = DAY_ALPHA[i + 1][0], a1 = DAY_ALPHA[i + 1][1];
    if (d >= t0 && d <= t1) { a = a0 + (a1 - a0) * ((d - t0) / (t1 - t0)); break; }
  }
  return Math.min(1, Math.max(0, (a - 0.10) / 0.48));
}

// ---------------- PROP_SHADOW (export público) ----------------

/**
 * Sombra elíptica coherente de props (y entidades si el integrador
 * la reutiliza): rgba(0,0,0,0.25) por defecto, desplazada al suelo.
 * cx, cy: centro en píxeles de PANTALLA (ya pasados por sx/sy del
 * render). rx, ry: radios en píxeles de MUNDO (se escalan ×ZOOM aquí).
 */
export function PROP_SHADOW(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  rx: number, ry: number, alpha = 0.25,
): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, rx * ZOOM), Math.max(1, ry * ZOOM), 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- Glifos y piezas compartidas ----------------

/** Runa pixel 3×4 (4 variantes deterministas por índice). */
function RUNE(i: number, x: number, y: number, c: string, a: number): void {
  switch (i & 3) {
    case 0: // aspa vertical
      PA(x, y, 1, 4, c, a); PA(x - 1, y + 1, 3, 1, c, a);
      break;
    case 1: // rombo
      PA(x, y, 1, 1, c, a); PA(x - 1, y + 1, 1, 1, c, a);
      PA(x, y + 2, 1, 1, c, a); PA(x + 1, y + 1, 1, 1, c, a);
      break;
    case 2: // ojo
      PA(x - 1, y, 3, 1, c, a); PA(x, y + 1, 1, 2, c, a); PA(x - 1, y + 3, 3, 1, c, a);
      break;
    default: // rama
      PA(x, y, 1, 4, c, a); PA(x + 1, y + 1, 1, 1, c, a); PA(x - 1, y + 2, 1, 1, c, a);
      break;
  }
}

/** Vela 2×3 con llama animada de 3 frames (determinista por índice i). */
function CANDLE(x: number, y: number, i: number): void {
  P(x, y, 2, 3, PAL_PROP.wax);          // cera
  P(x + 1, y, 1, 3, PAL_PROP.waxShade); // costado en sombra
  P(x, y - 1, 2, 1, PAL_PROP.waxHi);    // borde superior
  if (h2(x * 7 + i, y * 3 + 1) > 0.55) P(x, y + 1, 1, 1, PAL_PROP.waxHi); // gota de cera
  const ff = Math.floor(_t * 6 + i * 1.7) % 3; // llama: 3 frames
  if (ff === 1) { // llama alta
    PA(x, y - 5, 1, 2, PAL_PROP.flame2, 0.95);
  } else if (ff === 0) { // llama media
    PA(x, y - 4, 1, 1, PAL_PROP.flame2, 0.95);
  } else { // llama baja cálida
    PA(x, y - 4, 1, 1, PAL_PROP.flame1, 0.95);
  }
  PA(x, y - 3, 1, 1, PAL_PROP.flame3, 0.95); // núcleo blanco fijo
  ELL(x + 0.5, y - 3, 3.5, 2.5, PAL_PROP.flame2, ff === 1 ? 0.16 : 0.10);
}

/** Piedrita orbitante 2×2 con luz superior. */
function PEBBLE(x: number, y: number, c: string, cHi: string, a = 1): void {
  PA(x, y, 2, 2, c, a);
  PA(x, y, 2, 1, cHi, a * 0.9);
}

/**
 * Contorno de SELECCIÓN (v3 R4-A4): corchetes claros de 1 px en el
 * suelo alrededor de la base, con pulso sutil. Vale para todos los
 * kinds (se dibuja tras el prop, alpha bajo → nunca tapa).
 */
function drawSelectedAura(): void {
  const a = 0.20 + Math.sin(_t * 3.4) * 0.12; // 0.08..0.32
  const c = PAL_PROP.runeCyanHi;
  PA(-12, 3, 5, 1, c, a); PA(7, 3, 5, 1, c, a);               // aristas superiores
  PA(-14, 6, 5, 1, c, a); PA(9, 6, 5, 1, c, a);               // aristas inferiores (1 px más anchas: perspectiva)
  PA(-14, 4, 1, 2, c, a * 0.85); PA(13, 4, 1, 2, c, a * 0.85); // laterales
}

// ---------------- Santuario del Eco ----------------

function drawSanctuary(): void {
  const t = _t;
  const fr = Math.floor(t * 2) % 2;                 // 2 frames deterministas del anillo
  const bob = Math.round(Math.sin(t * 2) * 1.5);    // flotación del anillo (px enteros)
  // v3: ciclo LENTO de 2 s compartido — el cristal, el anillo y el aura
  // respiran juntos (el Santuario "inhalas" cada 2 segundos).
  const ph = (t % 2) / 2;
  const pulse = Math.sin(ph * Math.PI);             // 0 → 1 → 0 en 2 s

  // sombra elíptica en el suelo
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 12, 3.5);

  // halo elíptico (detrás de todo el prop), sincronizado con el pulso
  ELL(0, -14, 16, 7, PAL_PROP.runeCyan, 0.05 + pulse * 0.06);
  ELL(0, -14, 9, 4, PAL_PROP.runeCyanHi, 0.04 + pulse * 0.05);

  // v3: aura de suelo — 3 anillos concéntricos que se INHALAN hacia
  // el obelisco (radio exterior → interior con fade senoidal).
  for (let i = 0; i < 3; i++) {
    const p = (ph + i / 3) % 1;
    const rx = 17 - Math.round(p * 10);             // 17 → 7 px de mundo
    GROUND_RING(4, rx, Math.max(2, Math.round(rx * 0.3)),
      i === 1 ? PAL_PROP.runeCyanHi : PAL_PROP.runeCyan,
      Math.sin(p * Math.PI) * 0.28);
  }

  // anillo: mitad trasera (detrás del fuste) + abalorio si está detrás
  const ringY = -12 + bob;
  const ringRy = fr === 0 ? 3 : 2; // perspectiva: 2 frames
  RING_HALF(ringY, 9, ringRy, false, PAL_PROP.runeCyan, 0.35 + pulse * 0.3);
  const beadAng = t * 2.4;
  const beadFront = Math.sin(beadAng) >= 0;
  if (!beadFront) {
    PA(Math.round(Math.cos(beadAng) * 9) - 1, ringY + Math.round(Math.sin(beadAng) * ringRy), 2, 2, PAL_PROP.runeCyanHi, 0.8);
  }

  // base de losas con musgo
  P(-13, 4, 26, 2, '#4a4a58');
  P(-12, 2, 24, 3, PAL.stoneDark);
  P(-12, 2, 24, 1, PAL.stoneLight);
  P(-5, 3, 1, 2, '#3e3e50'); // juntas
  P(4, 3, 1, 2, '#3e3e50');
  P(0, 5, 1, 1, '#3e3e50');
  const r1 = h2(_tx, _ty);
  if (r1 > 0.35) P(-12 + Math.floor(r1 * 6), 2, 3, 1, PAL_PROP.moss);
  const r2 = h2(_tx * 3 + 1, _ty * 5 + 2);
  if (r2 > 0.5) P(8 - Math.floor(r2 * 5), 4, 2, 1, PAL_PROP.mossDark);
  P(-5, 1, 2, 1, PAL_PROP.mossDark); // musgo al pie del fuste

  // fuste del obelisco (tapered, cara iluminada a la izquierda)
  P(-6, -1, 12, 3, PAL_PROP.sanctShade);   // cornisa
  P(-6, -1, 12, 1, PAL_PROP.sanctLight);
  P(-3, -25, 6, 24, PAL_PROP.sanctStone);  // cuerpo
  P(-3, -25, 2, 24, PAL_PROP.sanctLight);  // luz
  P(1, -25, 2, 24, PAL_PROP.sanctShade);   // sombra
  P(-2, -27, 4, 2, PAL_PROP.sanctStone);   // remate
  P(-2, -27, 2, 1, PAL_PROP.sanctLight);
  // v4: variante de remate por hash (pirámide apuntada) + ofrenda al pie
  const sv2 = h2(_tx * 5 + 3, _ty * 7 + 1);
  if (sv2 >= 0.55) {
    P(-1, -28, 2, 1, PAL_PROP.sanctStone);   // pirámide apuntada
    P(-1, -28, 1, 1, PAL_PROP.sanctLight);
  }
  if (sv2 > 0.72) {
    P(7, 2, 1, 2, PAL_PROP.wax);             // vela apagada de ofrenda
    P(7, 2, 1, 1, PAL_PROP.waxHi);
    PEBBLE(10, 3, '#6a6a7a', '#8a8a9a', 1);  // piedritas
  }
  // punta luminosa = CRISTAL del santuario: pulso LENTO de 2 s
  PA(-1, -29, 2, 2, PAL_PROP.runeCyan, 0.5 + pulse * 0.4);
  PA(-1, -29, 1, 1, PAL_PROP.runeCyanHi, 0.75 + pulse * 0.25);
  if (pulse > 0.8) { // destello en cruz al culminar cada ciclo
    const fa = ((pulse - 0.8) / 0.2) * 0.55;
    PA(-3, -28, 1, 1, PAL_PROP.runeCyanHi, fa); PA(2, -28, 1, 1, PAL_PROP.runeCyanHi, fa);
    PA(-1, -31, 1, 1, PAL_PROP.runeCyanHi, fa); PA(-1, -26, 1, 1, PAL_PROP.runeCyanHi, fa);
  }

  // runas cian que recorren el fuste: posición = floor(globalT*2)%4
  const slot = Math.floor(t * 2) % 4;
  const runeYs = [-22, -16, -10, -4];
  for (let i = 0; i < 4; i++) {
    const a = i === slot ? 0.95 : (i === (slot + 3) % 4 ? 0.5 : 0.3); // estela detrás
    RUNE(i, 0, runeYs[i], i === slot ? PAL_PROP.runeCyan : PAL_PROP.runeDim, a);
    if (i === slot) PA(0, runeYs[i] + 1, 1, 1, PAL_PROP.runeCyanHi, fr === 0 ? 0.9 : 0.6);
  }

  // anillo: mitad frontal (delante del fuste) + abalorio delante
  RING_HALF(ringY, 9, ringRy, true, PAL_PROP.runeCyanHi, 0.6 + pulse * 0.35);
  if (beadFront) {
    PA(Math.round(Math.cos(beadAng) * 9) - 1, ringY + Math.round(Math.sin(beadAng) * ringRy), 2, 2, PAL_PROP.runeCyanHi, 0.95);
  }

  // partículas ascendentes (4, deterministas con sin + hash)
  for (let i = 0; i < 4; i++) {
    const ph2 = h2(_tx * 5 + i * 13, _ty * 9 + i * 7);
    const cyc = (t * 0.35 + ph2) % 1;                       // 0..1 ciclo de subida
    const yy = 2 - Math.round(cyc * 26);
    const xx = (i < 2 ? -3 : 3) + Math.round(Math.sin(cyc * 6.283 + ph2 * 6.283) * 3);
    PA(xx, yy, 1, 2, i % 2 === 0 ? PAL_PROP.runeCyan : PAL_PROP.runeCyanHi, Math.sin(cyc * Math.PI) * 0.7);
  }

  // v3: motas-runa que ascienden junto al fuste y se DISIPAN (2)
  for (let i = 0; i < 2; i++) {
    const cyc = (t * 0.26 + i * 0.47) % 1;
    const my = 2 - Math.round(cyc * 24);
    const mx = (i === 0 ? -7 : 6) + Math.round(Math.sin(cyc * 5.1 + i * 2.6) * 2);
    RUNE(2 + i, mx, my, i === 0 ? PAL_PROP.runeCyan : PAL_PROP.runeCyanHi, Math.sin(cyc * Math.PI) * 0.6);
  }
}

// ---------------- Forja de Toln ----------------

function drawForge(): void {
  const t = _t;

  // sombra elíptica
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 13, 3.5);

  // glow cálido de la fragua (detrás)
  ELL(-13, -1, 10, 5, PAL_PROP.emberGlow, 0.10 + Math.sin(t * 5) * 0.05);

  // fragua (hogaza de piedra con carbones) a la izquierda
  P(-17, -2, 8, 6, PAL_PROP.ironLight);
  P(-17, -2, 8, 1, PAL_PROP.ironHi);
  P(-16, -1, 6, 4, PAL_PROP.barDeep);       // hueco
  P(-16, 1, 6, 2, '#1c1c26');               // carbones apagados
  // v3: brasero — 3 celdas de brasa 2×2 con 3 TONOS que alternan por
  // hash (ventana discreta de 0.4 s) + núcleo caliente estable.
  const estep = Math.floor(t * 2.5);
  for (let i = 0; i < 3; i++) {
    const tn = Math.floor(h2(estep * 31 + i * 7 + _tx, _ty * 5 + i * 3) * 3); // 0..2
    const col = tn === 0 ? PAL_PROP.ember1 : tn === 1 ? PAL_PROP.ember2 : PAL_PROP.emberCore;
    PA(-15 + i * 2, 0, 2, 2, col, 0.72 + h2(estep * 17 + i * 5, _tx + _ty * 7) * 0.23);
  }
  PA(-14, 0, 2, 1, PAL_PROP.emberCore, 0.95); // núcleo blanco-caliente
  PA(-15, -1, 2, 1, PAL_PROP.ember2, 0.8);    // brasa que asoma
  // v3: labio inferior del brasero + pie de hierro
  P(-17, 3, 8, 1, PAL_PROP.ironDeep);
  P(-16, 4, 6, 1, '#26262f');

  // tocón (base de madera)
  P(-10, -2, 20, 7, PAL.woodMid);
  P(-9, -4, 18, 2, PAL.wood);   // cara superior
  P(-7, -4, 14, 1, PAL.woodLight);
  P(-10, 3, 20, 2, PAL.woodDark);
  const rv = h2(_tx + 9, _ty + 3);
  P(-7 + Math.floor(rv * 3), -1, 1, 3, PAL.woodDark); // vetas
  P(1, 0, 1, 3, PAL.woodDark);
  P(6, -1, 1, 4, PAL.woodDark);

  // yunque sobre el tocón
  P(-4, -6, 8, 2, PAL_PROP.ironDeep);       // peana
  P(-2, -8, 4, 2, PAL_PROP.iron);           // cuello
  P(-7, -10, 12, 2, PAL_PROP.ironLight);    // mesa
  P(-7, -10, 12, 1, PAL_PROP.ironHi);       // filo de luz
  P(5, -10, 2, 2, PAL_PROP.ironLight);      // cuerna
  P(7, -9, 2, 1, PAL_PROP.iron);
  P(-7, -8, 12, 1, PAL_PROP.ironDeep);      // canto inferior
  // v3: brillo metálico que recorre el CANTO del yunque (barrido lento
  // determinista) + destello fijo en la cuerna.
  const swp = (t * 0.55 + h2(_tx + 5, _ty + 11)) % 1;
  PA(-6 + Math.round(swp * 10), -10, 2, 1, '#c0c6d0', 0.28 + Math.sin(swp * Math.PI) * 0.4);
  PA(6, -10, 1, 1, '#c0c6d0', 0.5);

  // humillo: 3 puffs que suben y se disipan (determinista)
  for (let i = 0; i < 3; i++) {
    const cyc = (t * 0.3 + i / 3) % 1;
    const sxp = -13 + i + Math.round(Math.sin(cyc * 4 + i * 2.1) * 2);
    const syp = -6 - Math.round(cyc * 14);
    const s = 1 + Math.round(cyc * 2);
    ELL(sxp, syp, s + 1, s * 0.75, PAL_PROP.smoke, (1 - cyc) * 0.38);
  }

  // martillo apoyado en el tronco (lado derecho)
  P(12, 0, 1, 4, PAL.woodDark);   // mango
  P(13, -2, 1, 3, PAL.woodMid);
  P(12, -5, 4, 3, PAL_PROP.ironLight);              // cabeza
  P(12, -5, 4, 1, PAL_PROP.ironHi);
  P(11, -4, 1, 2, PAL_PROP.iron);
  P(12, -3, 4, 1, PAL_PROP.ironDeep);               // canto inferior
  P(15, -4, 1, 2, PAL_PROP.ironDeep);               // lateral

  // herradura colgada de un clavo (sway de 1 px)
  const sway = Math.round(Math.sin(t * 1.3));
  P(-4 + sway, -1, 1, 1, '#2a2a34');                // clavo
  P(-7 + sway, 0, 7, 4, '#4a3420');                 // respaldo (contraste)
  P(-6 + sway, 0, 1, 3, '#9aa0ac');                 // herradura en U
  P(-2 + sway, 0, 1, 3, '#9aa0ac');
  P(-6 + sway, 3, 5, 1, '#9aa0ac');
  P(-6 + sway, 0, 1, 2, '#c0c6d0');                 // brillo
  P(-6 + sway, 2, 1, 1, '#5a5a6a');                 // callos
  P(-2 + sway, 2, 1, 1, '#5a5a6a');

  // v3: chispas que SUBEN 1-2 px — ventana discreta de 0.5 s
  const w5 = Math.floor(t * 2);
  const pr5 = t * 2 - w5;
  const rw = h2(w5 * 29 + _tx * 7, _ty * 5 + 3);
  if (rw < 0.82) {
    PA(-14 + Math.floor(rw * 8) + Math.round(pr5), -3 - Math.round(pr5 * 2), 1, 1,
      rw < 0.35 ? PAL_PROP.emberCore : PAL_PROP.spark, Math.max(0.02, (1 - pr5) * 0.9));
  }

  // chispas ocasionales (salpicadura): hash2 + floor(globalT*3)
  const seed = Math.floor(t * 3);
  const rs = h2(seed * 17 + _tx * 3, _ty * 11 + 5);
  if (rs > 0.4) {
    const age = t * 3 - seed; // 0..1 vida del chispazo
    const fade = Math.max(0.02, 1 - age); // piso de alpha: presencia estable en la ventana
    for (let i = 0; i < 3; i++) {
      const vx = (h2(seed * 7 + i, 3) * 2 - 1) * 5;
      const vy = 14 + h2(seed * 3, i * 5) * 8;
      const xx = -13 + Math.round(vx * age);
      const yy = -1 - Math.round(vy * age) + Math.round(10 * age * age); // gravedad
      PA(xx, yy, 1, 1, i === 0 ? PAL_PROP.emberCore : PAL_PROP.spark, fade);
    }
  }

  // —— v4: ajuar determinista alrededor de la forja (hash por
  //    posición): tonel de temple con aros, caja y saco ——
  const fs = h2(_tx * 3 + 11, _ty * 7 + 5);
  if (fs < 0.7) { // TONEL con aros (tapa puesta o abierta por hash)
    P(14, -3, 5, 7, PAL.woodMid);
    P(14, -3, 1, 7, PAL.woodLight);          // luz lateral
    P(18, -3, 1, 7, PAL.woodDark);           // sombra lateral
    P(15, -3, 1, 7, PAL.woodDark);           // junta de duelas
    P(14, -2, 5, 1, PAL_PROP.ironDeep);      // aro superior
    P(14, 1, 5, 1, PAL_PROP.ironDeep);       // aro inferior
    P(14, 3, 5, 1, PAL.woodDark);            // fondo
    if (h2(_tx * 5 + 8, _ty * 3 + 2) < 0.5) {
      P(14, -4, 5, 1, PAL.woodDark);         // tapa
      P(14, -4, 2, 1, PAL.woodLight);
    } else {
      P(15, -4, 3, 1, PAL_PROP.barDeep);     // abierto: agua de temple
      P(15, -4, 2, 1, PAL.waterGlint);
    }
  }
  if (fs >= 0.35 && fs < 0.95) { // CAJA con/sin tapa
    P(-20, 0, 6, 5, PAL.woodMid);
    P(-20, 0, 1, 5, PAL.woodLight);
    P(-15, 0, 1, 5, PAL.woodDark);
    P(-20, 2, 6, 1, PAL.woodDark);           // junta del tablón
    P(-20, 0, 2, 1, PAL_PROP.iron);          // refuerzo de esquina
    P(-20, 0, 1, 2, PAL_PROP.iron);
    if (h2(_tx * 9 + 4, _ty * 5 + 6) < 0.5) {
      P(-20, -1, 6, 1, PAL.woodLight);       // tapa cerrada
    } else {
      P(-19, 0, 4, 1, PAL_PROP.barDeep);     // abierta: contenido
      P(-18, 0, 1, 1, '#9aa0ac');            // lima asomando
    }
  }
  if (fs > 0.78 || fs < 0.12) { // SACO atado con grano derramado
    P(7, 0, 5, 4, SACK_C);
    P(7, 0, 5, 1, SACK_HI);
    P(7, 3, 5, 1, SACK_DK);
    P(8, 1, 2, 1, SACK_DK);                  // pliegue
    P(8, -1, 2, 1, SACK_C);                  // cuello
    P(8, -1, 1, 1, SACK_DK);                 // nudo
    P(6, 4, 2, 1, SACK_HI);                  // grano derramado
    P(9, 4, 1, 1, SACK_C);
  }
}

// ---------------- Fragmento de Eco ----------------

function drawFragment(): void {
  const t = _t;
  const bob = Math.round(Math.sin(t * 2.4) * 2);
  const br = Math.sin(t * 2.4); // respiración de la sombra

  // sombra en el suelo que respira
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 8 + br * 1.5, 3, 0.22 + br * 0.04);

  // halo dorado suave
  ELL(0, -12 + bob, 12, 6, PAL_PROP.crackGold, 0.14 + Math.sin(t * 3) * 0.05);

  // fragmentos orbitando: órbita elíptica (atrás si sin(ang) < 0)
  const orb: { x: number; y: number; back: boolean }[] = [];
  for (let i = 0; i < 3; i++) {
    const ang = t * 1.7 + i * (Math.PI * 2 / 3);
    orb.push({
      x: Math.round(Math.cos(ang) * 9),
      y: -12 + bob + Math.round(Math.sin(ang) * 3.5),
      back: Math.sin(ang) < 0,
    });
  }
  for (const o of orb) if (o.back) PEBBLE(o.x, o.y, '#6a6a7a', '#8a8a9a', 0.85);

  // monolito roto flotante (punta hacia abajo, pico descoyuntado)
  P(-4, -18 + bob, 8, 12, '#5a5a6a');       // cuerpo
  P(-4, -18 + bob, 2, 12, '#7a7a8a');       // cara iluminada
  P(2, -18 + bob, 2, 12, '#4a4a58');        // cara en sombra
  P(-3, -20 + bob, 3, 2, '#5a5a6a');        // pico roto superior
  P(-3, -20 + bob, 1, 2, '#7a7a8a');
  P(-3, -6 + bob, 6, 2, '#4a4a58');         // afilado inferior
  P(-2, -4 + bob, 4, 1, '#3e3e50');
  P(-1, -3 + bob, 2, 1, '#3e3e50');         // punta
  P(5, -13 + bob, 2, 4, '#4a4a58');         // esquirla desprendida
  P(5, -13 + bob, 1, 4, '#5a5a6a');

  // grietas brillantes doradas (pulso fuerte: es la pieza dorada del juego)
  const gl = 0.7 + Math.sin(t * 3) * 0.2;
  PA(-4, -18 + bob, 1, 10, PAL_PROP.crackGoldDeep, 0.5);   // filo dorado izq.
  PA(3, -18 + bob, 1, 10, PAL_PROP.crackGoldDeep, 0.25);   // reflejo der.
  PA(-1, -17 + bob, 1, 3, PAL_PROP.crackGold, gl);
  PA(0, -14 + bob, 1, 3, PAL_PROP.crackGoldDeep, gl * 0.9);
  PA(-2, -11 + bob, 2, 1, PAL_PROP.crackGold, gl);
  PA(-2, -8 + bob, 1, 2, PAL_PROP.crackGoldDeep, gl * 0.6);
  PA(-1, -19 + bob, 1, 2, PAL_PROP.crackGoldDeep, gl * 0.75);
  PA(-1, -16 + bob, 1, 1, PAL_PROP.crackGoldHi, 0.95);

  // v4: variantes por hash — esquirla caída al pie / grieta extra
  const fv = h2(_tx * 7 + 5, _ty * 3 + 2);
  if (fv < 0.3) {
    P(7, 2, 2, 2, '#5a5a6a');
    P(7, 2, 1, 1, '#7a7a8a');
    PA(7, 2, 1, 1, PAL_PROP.crackGoldDeep, 0.45); // eco dorado en la esquirla
  }
  if (fv > 0.75) PA(2, -9 + bob, 1, 2, PAL_PROP.crackGold, gl * 0.7);

  // piedritas delanteras
  for (const o of orb) if (!o.back) PEBBLE(o.x, o.y, '#6a6a7a', '#8a8a9a', 1);
}

// ---------------- Altar del Eco (cripta v2) ----------------

function drawAltarEcho(g: Game): void {
  const t = _t;
  const ph = (t % 2) / 2; // v3: ciclo de 2 s compartido con el santuario

  // sombra elíptica
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 12, 3);

  // v3: aura dorada de suelo — 3 anillos que se inhalan hacia la losa
  for (let i = 0; i < 3; i++) {
    const p = (ph + i / 3) % 1;
    const rx = 14 - Math.round(p * 7);              // 14 → 7 px de mundo
    GROUND_RING(3, rx, Math.max(2, Math.round(rx * 0.3)),
      i === 1 ? PAL_PROP.crackGoldHi : PAL_PROP.crackGold,
      Math.sin(p * Math.PI) * 0.24);
  }

  // losa del altar (2 escalones)
  P(-10, 1, 20, 4, '#6a6a7a');
  P(-10, 1, 20, 1, '#7a7a8a');
  P(-10, 4, 20, 1, '#4a4a58');
  P(-7, -2, 14, 3, '#7a7a8a');
  P(-7, -2, 14, 1, '#8a8a9a');
  P(-7, 0, 14, 1, '#5a5a6a');

  // canal central brillante (surco dorado con pulso que baja)
  P(-1, -2, 2, 6, '#8a6c28');
  const prog = (t * 2.5) % 1;
  PA(-1, -2 + Math.round(prog * 5), 2, 1, PAL_PROP.crackGoldHi, 0.9);
  ELL(0, 0, 6, 3, PAL_PROP.crackGold, 0.12 + Math.sin(t * 2) * 0.05);

  // v4: tapiz frontal con sigil por altar + musgo en la losa (hash)
  const av = h2(_tx * 5 + 1, _ty * 3 + 9);
  if (av < 0.5) {
    const sig = _pid === 'altar_mareas' ? PAL_PROP.runeCyan
      : _pid === 'altar_cumbres' ? '#a8d8ff' : PAL_PROP.crackGold;
    P(-8, 1, 6, 3, CLOTH);
    P(-8, 1, 6, 1, CLOTH_HI);
    P(-8, 3, 6, 1, CLOTH_DK);
    P(-6, 2, 1, 1, sig);                     // sigil del guardián
    P(-4, 2, 1, 1, sig);
  }
  if (av > 0.6) P(6, 0, 2, 1, PAL_PROP.mossDark);

  // velas 2×3 (dos columnas, tres filas) con llama de 3 frames
  for (let row = 0; row < 3; row++) {
    CANDLE(row === 1 ? -12 : -14, row * 2, row);          // columna izquierda
    CANDLE(row === 1 ? 10 : 12, row * 2, row + 3);        // columna derecha
  }

  // niebla baja alrededor (determinista)
  for (let i = 0; i < 5; i++) {
    const fx = -12 + i * 6 + Math.round(Math.sin(t * 0.4 + i * 2.4) * 3);
    const fa = 0.08 + Math.sin(t * 0.8 + i * 1.7) * 0.04;
    ELL(fx, 4 + (i % 2), 7 - (i % 3), 2.2, PAL_PROP.fog, fa);
  }

  // el Eco dormita sobre el altar hasta ser recogido (paridad gameplay)
  // merge Acto II: cada altar consulta SUS flags según id (altar_mareas →
  // sirena, altar_cumbres → golem, resto → Guardián Hueco)
  const ecoFlag = _pid === 'altar_mareas' ? 'ecoMareas' : _pid === 'altar_cumbres' ? 'ecoCumbres' : 'ecoVoz';
  const custodianFlag = _pid === 'altar_mareas' ? 'sirenaDefeated' : _pid === 'altar_cumbres' ? 'golemDefeated' : 'guardianDefeated';
  const fRec = g.flags as Record<string, boolean>;
  if (!fRec[ecoFlag]) {
    const bob2 = Math.round(Math.sin(t * 2.6) * 3);
    const gl2 = fRec[custodianFlag] ? 0.7 : 0.3;
    const ecoTint = _pid === 'altar_mareas' ? '#8ef0ff' : _pid === 'altar_cumbres' ? '#a8d8ff' : PAL_PROP.crackGold;
    ELL(0, -14 + bob2, 9, 5, ecoTint, gl2 * 0.35);
    P(-2, -18 + bob2, 4, 8, PAL_PROP.crackGoldDeep);      // esquirla dorada
    P(-2, -18 + bob2, 2, 8, ecoTint);
    P(-1, -16 + bob2, 2, 3, PAL_PROP.crackGoldHi);        // núcleo
    P(-1, -10 + bob2, 2, 1, PAL_PROP.crackGoldDeep);      // punta
    // dos motas orbitando el Eco
    for (let i = 0; i < 2; i++) {
      const ang = t * 2.2 + i * Math.PI;
      PA(Math.round(Math.cos(ang) * 7) - 1, -14 + bob2 + Math.round(Math.sin(ang) * 2.5), 1, 1, PAL_PROP.crackGoldHi, 0.8);
    }
  }

  // v3: 3 motas doradas que suben desde el canal y se disipan
  for (let i = 0; i < 3; i++) {
    const cyc = (t * 0.4 + i / 3) % 1;
    const mx = -5 + i * 5 + Math.round(Math.sin(cyc * 4.2 + i * 2.1) * 1.5);
    const my = -4 - Math.round(cyc * 14);
    PA(mx, my, 1, 1, PAL_PROP.crackGoldHi, (1 - cyc) * 0.75);
    PA(mx, my + 1, 1, 1, PAL_PROP.crackGold, (1 - cyc) * 0.4);
  }
}

// ---------------- Cartel de madera ----------------

function drawSign(selected: boolean): void {
  const t = _t;
  // tiembla 1 px si está seleccionado (jugador cerca)
  const dx = selected ? (Math.floor(t * 10) % 2) : 0;

  // sombra (sin temblor: el poste no se mueve del suelo)
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 6, 2.5);

  // poste
  P(-1 + dx, -11, 2, 16, PAL.woodDark);
  P(-1 + dx, -11, 1, 16, PAL.woodMid);

  // tabla clavada
  P(-8 + dx, -18, 16, 8, '#8a5a2b');
  P(-8 + dx, -18, 16, 1, '#a8703a');        // luz superior
  P(-8 + dx, -11, 16, 1, PAL.door);  // sombra inferior
  P(-8 + dx, -18, 1, 8, PAL.door);   // bordes
  P(7 + dx, -18, 1, 8, PAL.door);
  // v3: ESQUINAS reforzadas — escuadras de hierro en L (4 esquinas)
  const bk = '#3c3126', bkHi = '#5a4a34';
  P(-8 + dx, -18, 3, 1, bk); P(-8 + dx, -18, 1, 3, bk);   // sup-izq
  P(5 + dx, -18, 3, 1, bk); P(7 + dx, -18, 1, 3, bk);     // sup-der
  P(-8 + dx, -11, 3, 1, bk); P(-8 + dx, -13, 1, 3, bk);   // inf-izq
  P(5 + dx, -11, 3, 1, bk); P(7 + dx, -13, 1, 3, bk);     // inf-der
  P(-6 + dx, -16, 1, 1, bkHi); P(6 + dx, -16, 1, 1, bkHi); // brillos de escuadra
  P(-6 + dx, -13, 1, 1, bkHi); P(6 + dx, -13, 1, 1, bkHi);
  // v3: TORNILLOS (cabeza clara + ranura oscura; orientación por hash)
  P(-7 + dx, -17, 1, 1, '#9aa0ac'); P(6 + dx, -17, 1, 1, '#9aa0ac');
  P(-7 + dx, -12, 1, 1, '#9aa0ac'); P(6 + dx, -12, 1, 1, '#9aa0ac');
  if (h2(_tx + 3, _ty + 7) < 0.5) { // ranuras horizontales (hacia dentro)
    P(-6 + dx, -17, 1, 1, '#2a2a34'); P(5 + dx, -17, 1, 1, '#2a2a34');
    P(-6 + dx, -12, 1, 1, '#2a2a34'); P(5 + dx, -12, 1, 1, '#2a2a34');
  } else {                          // ranuras verticales (hacia dentro)
    P(-7 + dx, -16, 1, 1, '#2a2a34'); P(6 + dx, -16, 1, 1, '#2a2a34');
    P(-7 + dx, -13, 1, 1, '#2a2a34'); P(6 + dx, -13, 1, 1, '#2a2a34');
  }
  // veta (determinista por tile) — v3: hash normalizado (ramas vivas) + 3ª veta
  const r = h2(_tx, _ty);
  P(-6 + dx, -15, 7, 1, '#6d4520');
  P(1 + dx, -13, 5, 1, '#6d4520');
  P(-2 + dx, -14, 3, 1, '#6d4520');
  if (r > 0.5) P(-4 + dx, -16, 4, 1, '#7a5230');
  if (r < 0.35) { P(3 + dx, -16, 2, 1, '#5c3a1e'); P(4 + dx, -16, 1, 1, '#4a2d16'); } // nudo

  // —— v4: VARIANTE por hash (4 looks de la familia cartel) ——
  const sv = Math.floor(h2(_tx * 3 + 11, _ty * 5 + 2) * 4); // 0..3
  if (sv === 1) { // tabla doble bajo la principal
    P(-6 + dx, -9, 12, 4, '#8a5a2b');
    P(-6 + dx, -9, 12, 1, '#a8703a');
    P(-6 + dx, -6, 12, 1, PAL.door);
    P(-4 + dx, -8, 1, 1, '#9aa0ac'); P(3 + dx, -8, 1, 1, '#9aa0ac');
  } else if (sv === 2) { // pértiga con banderín
    P(-1 + dx, -24, 2, 7, PAL.woodDark);
    P(-1 + dx, -24, 1, 7, PAL.woodMid);
    const swy = Math.round(Math.sin(t * 2 + h2(_tx, _ty) * 6.283));
    P(1 + dx, -23, 4, 1, CLOTH);
    P(1 + dx, -22, 3, 1, CLOTH);
    P(1 + dx, -21, 2, 1, CLOTH);
    P(1 + dx + swy, -20, 1, 1, CLOTH_DK);    // punta que ondea
    P(1 + dx, -23, 1, 1, CLOTH_HI);          // brillo de la tela
  } else if (sv === 3) { // farol colgado del brazo (encendido por hash)
    P(2 + dx, -20, 5, 1, PAL.woodDark);      // brazo
    P(6 + dx, -19, 1, 1, PAL.ropeDark);      // cordel
    P(5 + dx, -18, 3, 5, PAL_PROP.ironDeep); // cuerpo
    P(5 + dx, -13, 3, 1, PAL_PROP.iron);     // base
    if (h2(_tx * 7 + 9, _ty * 11 + 3) < 0.5) {
      P(6 + dx, -17, 1, 3, LANT_LIT);        // cristal ámbar
      PA(6 + dx, -17 + (Math.floor(t * 3) % 2), 1, 1, PAL_PROP.flame2, 0.85);
      ELL(6.5 + dx, -15.5, 3.5, 3, LANT_HALO, 0.06 + 0.13 * _nf);
    } else {
      P(6 + dx, -17, 1, 3, PAL.lanternGlass);
      P(6 + dx, -17, 1, 1, PAL_PROP.iron);   // cristal agrietado
    }
  }
  // —— v4: detalles de historia (independientes de la variante) ——
  if (h2(_tx * 13 + 6, _ty * 7 + 1) < 0.3) { // cuerda deshilachada
    P(5 + dx, -10, 1, 2, PAL.rope);
    P(6 + dx, -9, 1, 1, PAL.rope);
    P(4 + dx, -9, 1, 1, PAL.ropeDark);
  }
  if (h2(_tx * 7 + 2, _ty * 9 + 4) < 0.22) { // tabla agrietada + astilla
    P(2 + dx, -18, 1, 2, PAL.door);
    P(3 + dx, -16, 1, 1, PAL.door);
    P(-2 + dx, -10, 1, 2, '#6d4520');
  }
  if (h2(_tx * 11 + 6, _ty * 3 + 1) < 0.35) P(-1 + dx, 3, 2, 1, PAL_PROP.moss); // musgo
  // —— v4: perchas de pescado (solo costa + hash): rack junto al cartel ——
  if (_mid === 'costa' && h2(_tx * 11 + 4, _ty * 13 + 7) < 0.55) {
    const swf = Math.round(Math.sin(t * 1.7 + h2(_tx, _ty) * 6.283));
    P(9, -6, 1, 11, PAL.woodDark);           // poste del rack
    P(13, -4, 1, 9, PAL.woodDark);
    P(8, -7, 7, 1, PAL.woodMid);             // travesaño
    P(8, -6, 7, 1, PAL.woodDark);            // sombra
    for (const fxp of [10, 12]) {            // peces colgando (vaivén 1px)
      P(fxp + swf, -5, 1, 3, FISH_C);
      P(fxp + swf, -5, 1, 1, FISH_HI);
      P(fxp + swf, -2, 1, 1, FISH_DK);
    }
  }

  // icono de lectura (solo seleccionado): globito redondeado con "E"
  if (selected) {
    const by = -26 + Math.round(Math.sin(t * 3));
    P(-4, by, 9, 9, 'rgba(10,12,20,0.85)');
    P(-2, by - 1, 5, 1, 'rgba(10,12,20,0.85)');   // esquinas redondeadas
    P(-2, by + 9, 5, 1, 'rgba(10,12,20,0.85)');
    // v3: BORDE DOBLE — marco oscuro exterior + filo dorado interior
    P(-5, by - 1, 11, 1, 'rgba(6,8,14,0.9)');
    P(-5, by + 10, 11, 1, 'rgba(6,8,14,0.9)');
    P(-6, by, 1, 10, 'rgba(6,8,14,0.9)');
    P(6, by, 1, 10, 'rgba(6,8,14,0.9)');
    P(-4, by, 9, 1, PAL.gold);                    // borde sin esquinas duras
    P(-4, by + 9, 9, 1, PAL.gold);
    P(-5, by + 1, 1, 8, PAL.gold);
    P(5, by + 1, 1, 8, PAL.gold);
    // letra E 3×5
    P(-1, by + 3, 1, 5, PAL_PROP.crackGold);
    P(-1, by + 3, 3, 1, PAL_PROP.crackGold);
    P(-1, by + 5, 2, 1, PAL_PROP.crackGold);
    P(-1, by + 7, 3, 1, PAL_PROP.crackGold);
  }
}

// ---------------- Puerta / arco de piedra ----------------

// Óxido del portcullis (v3: 2 tonos, locales al módulo)
const RUST_A = '#7a4a28';
const RUST_B = '#5a3a20';

// —— v4 (R7-V2 · aditivo): telas, sacos, faroles y pescado ——
const CLOTH = '#a84a3a';      // tela del banderín / tapiz
const CLOTH_HI = '#c86a50';   // borde iluminado de la tela
const CLOTH_DK = '#7e3626';   // dobladillo en sombra
const SACK_C = '#c8b088';     // arpillera del saco
const SACK_HI = '#dccaa4';
const SACK_DK = '#9a8262';
const LANT_LIT = '#ffc868';   // cristal de farol encendido
const LANT_HALO = '#ffb054';  // halo cálido del farol
const FISH_C = '#7a8a96';     // pez colgado (percha de costa)
const FISH_HI = '#9aa8b4';
const FISH_DK = '#56626e';

function drawGate(): void {
  const t = _t;
  const nf = _nf; // factor noche 0..1 (de g.dayT)

  // sombra elíptica ancha
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 15, 3);
  // v3: de NOCHE la sombra se proyecta más larga hacia el sur
  if (nf > 0.02) {
    PROP_SHADOW(_ctx!, _ox, _oy + (5 + 8 * nf) * ZOOM, 14 + 5 * nf, 2.5 + nf, 0.05 + 0.14 * nf);
    PA(-10, 7 + Math.round(nf * 3), 20, 1, '#0a0e18', 0.12 * nf); // veta de sombra en el suelo
  }

  // pilares con sillares (offset por hash para variedad)
  for (let side = 0; side < 2; side++) {
    const x0 = side === 0 ? -12 : 7;
    P(x0, -22, 5, 26, '#6a6a7a');
    P(x0, -22, 2, 26, '#7a7a8a');   // cara iluminada
    P(x0 + 3, -22, 2, 26, '#5a5a6a'); // cara en sombra
    const off = side === 0 ? 0 : 3;
    for (let yy = -22 + off; yy < 3; yy += 5) P(x0, yy, 5, 1, '#585868'); // juntas
    P(x0 - 1, -22, 7, 2, '#8a8a9a');  // capitel
    P(x0 - 1, -20, 7, 1, '#3e3e50');
    // v3: base hundida 1 px en la tierra (zanja que se come el sillar)
    P(x0 - 1, 3, 7, 1, '#3a3524');
    P(x0, 4, 5, 1, '#332e20');
    // v3: grieta con musgo (hash por pilar) — tramos discretos de 4 px
    const hg = h2(_tx * 13 + side * 7 + 3, _ty * 3 + side * 11 + 1);
    if (hg < 0.75) {
      const gy = -17 + (Math.floor(hg * 30) % 5) * 4; // -17..-1
      P(x0 + 2 + (Math.floor(hg * 70) % 2), gy, 1, 4, '#4a4a58');
      if (hg < 0.4) P(x0 + 1 + (Math.floor(hg * 110) % 3), gy + 4, 2, 1, PAL_PROP.moss);
    }
    if (hg > 0.35) P(x0 + 1 + (Math.floor(hg * 8) % 3), 0, 2, 1, PAL_PROP.mossDark); // musgo al pie

    // v4: farol de PILAR — encendido (halo que crece de noche) o
    // apagado con cristal agrietado, por hash de posición
    const hl = h2(_tx * 17 + side * 5 + 2, _ty * 9 + side * 3 + 4);
    if (hl < 0.65) {
      const ox = side === 0 ? x0 - 2 : x0 + 5;   // extremo del brazo
      P(side === 0 ? x0 - 2 : x0 + 4, -21, 2, 1, PAL_PROP.iron); // brazo
      P(ox - 1, -20, 3, 1, PAL_PROP.iron);       // tapa
      P(ox - 1, -19, 3, 5, PAL_PROP.ironDeep);   // cuerpo
      P(ox - 1, -14, 3, 1, PAL_PROP.iron);       // base
      if (h2(_tx * 7 + side * 11 + 6, _ty * 5 + side * 13 + 9) < 0.5) {
        P(ox, -18, 1, 3, LANT_LIT);              // cristal ámbar
        PA(ox, -18 + (Math.floor(t * 3 + side) % 2), 1, 1, PAL_PROP.flame2, 0.85);
        ELL(ox, -16, 4, 3, LANT_HALO, 0.05 + 0.14 * nf); // halo crece de noche
      } else {
        P(ox, -18, 1, 3, PAL.lanternGlass);
        P(ox, -18, 1, 1, PAL_PROP.iron);         // grieta del cristal
      }
    }
  }

  // penumbra del vano
  P(-7, -19, 14, 23, 'rgba(10,10,20,0.45)');

  // puerta de barrotes (portcullis, 2 px de grosor con filo de luz)
  P(-7, -20, 14, 1, PAL_PROP.bar);
  for (let x = -6; x <= 6; x += 4) {
    P(x, -19, 2, 21, PAL_PROP.bar);
    P(x, -19, 1, 21, PAL_PROP.barHi);  // filo de luz del barrote
    P(x, 2, 2, 2, PAL_PROP.barDeep);   // punta inferior
    // v3: REMACHES (cabeza clara + asiento oscuro) arriba y abajo
    P(x + 1, -16, 1, 1, PAL_PROP.barHi); P(x + 1, -15, 1, 1, PAL_PROP.barDeep);
    P(x + 1, -5, 1, 1, PAL_PROP.barHi); P(x + 1, -4, 1, 1, PAL_PROP.barDeep);
    // v3: óxido sutil de 2 tonos (2 parches por barrote, hash independiente)
    const ra = h2(_tx * 7 + x * 13 + 1, _ty * 5 + x + 2);
    if (ra < 0.6) P(x + 1, -18 + (Math.floor(ra * 33) % 19), 1, 2, ra < 0.3 ? RUST_A : RUST_B);
    const rc = h2(_tx * 11 + x * 17 + 5, _ty * 7 + x * 3 + 9);
    if (rc < 0.55) P(x, -18 + (Math.floor(rc * 41) % 20), 1, 1, rc < 0.22 ? RUST_B : RUST_A);
  }
  P(-6, -10, 14, 1, PAL_PROP.bar);     // travesaño
  P(-6, -9, 14, 1, PAL_PROP.barDeep);
  // v3: remaches del travesaño + óxido ocasional
  P(-4, -10, 1, 1, PAL_PROP.barHi); P(2, -10, 1, 1, PAL_PROP.barHi);
  const rb = h2(_tx * 3 + 5, _ty * 9 + 7);
  if (rb < 0.65) P(-5 + (Math.floor(rb * 24) % 12), -10, 2, 1, RUST_B);

  // dintel con dovelas y clave central
  P(-14, -26, 28, 4, '#6a6a7a');
  P(-14, -26, 28, 1, '#8a8a9a');
  P(-14, -23, 28, 1, '#4a4a58');
  P(-8, -26, 1, 4, '#585868');
  P(-1, -26, 2, 4, '#585868');
  P(7, -26, 1, 4, '#585868');
  P(-2, -28, 4, 2, '#7a7a8a');         // clave
  P(-2, -28, 4, 1, '#8a8a9a');

  // runas cian pulsantes en el dintel
  for (let i = 0; i < 3; i++) {
    const a = 0.45 + Math.sin(t * 2 + i * 2.1) * 0.3;
    RUNE(i, -8 + i * 7, -25, PAL_PROP.runeCyan, Math.max(0.15, a));
  }
}

// ---------------- Props de lore ambientales (v5 · R10-6) ----------------
// Familia de props pequeños que cuentan historia SIN estorbar: no
// bloquean (los props nunca colisionan) y no interactúan (el motor
// ignora estos kinds en nearestInteract). Dibujados 100 % por rects
// con los materiales del archivo (piedra/madera/hueso de PAL y
// PAL_PROP + 3 hex locales). Cada draw sale temprano si el prop está
// fuera de vista: los mapas llevan ~20 de estos props y el guard
// convierte su coste por frame en 4 comparaciones.

/** Materiales locales de la familia lore (v5): pintura vieja y hueso. */
const PAINT_RED = '#94382a';      // aspa rota pintada («NO ENTRES»)
const PAINT_RED_DK = '#6e2820';   // trazo en sombra de la pintura
const BONE = '#d8d2c0';           // hueso iluminado
const BONE_DK = '#b8b2a0';        // hueso en sombra

/** Guard de vista: los kinds v5 son pequeños (≤ ±24 px del ancla). */
function offscreen(margin: number): boolean {
  const c = _ctx!;
  return _ox < -margin || _oy < -margin ||
    _ox > c.canvas.width + margin || _oy > c.canvas.height + margin;
}

/**
 * Líneas de «inscripción» grabadas: guiones oscuros de 2-5 px con
 * hueco (palabras vistas de lejos). Determinista por (seed, fila).
 */
function ENGRAVE(x: number, y: number, rows: number, seed: number, col: string, a: number): void {
  for (let r = 0; r < rows; r++) {
    const h = h2(seed + r * 17, r * 29 + 3);
    const w = 2 + Math.floor(h * 4);
    const off = Math.floor(h2(seed * 3 + r * 5, r * 13 + 1) * 2);
    PA(x + off, y + r * 2, w, 1, col, a);
    if (h > 0.55) PA(x + off + w + 1, y + r * 2, 1, 1, col, a * 0.8);
  }
}

/** Glifo 3×5 de la letra N (pintado en la tablilla de prohibición). */
function GLYPH_N(x: number, y: number): void {
  P(x, y, 1, 5, '#3c2c18'); P(x + 2, y, 1, 5, '#3c2c18');
  P(x + 1, y + 1, 1, 1, '#3c2c18'); P(x + 1, y + 3, 1, 1, '#3c2c18');
}

/** Glifo 3×5 de la letra O (pintado en la tablilla de prohibición). */
function GLYPH_O(x: number, y: number): void {
  P(x, y, 3, 1, '#3c2c18'); P(x, y + 4, 3, 1, '#3c2c18');
  P(x, y + 1, 1, 3, '#3c2c18'); P(x + 2, y + 1, 1, 3, '#3c2c18');
}

/**
 * PLACA conmemorativa de piedra grabada. 4 variantes: estela con
 * sigilo, losa tumbada con inscripción, pedestal con placa embutida
 * (nombre en oro viejo) y estela rota con fragmento caído.
 */
function drawPlaque(): void {
  if (offscreen(48)) return;
  const v = Math.floor(h2(_tx * 13 + 7, _ty * 7 + 5) * 4); // 0..3
  const mossSeed = h2(_tx * 5 + 2, _ty * 11 + 3);
  PROP_SHADOW(_ctx!, _ox, _oy + 4 * ZOOM, 8, 2.5, 0.2);
  if (v === 0) {
    // ESTELA: losa vertical de punta redondeada sobre bancal
    P(-7, 2, 14, 2, PAL.stoneDark);
    P(-7, 2, 14, 1, PAL.stone);
    P(-3, -13, 6, 1, PAL.stoneLight);            // remate redondeado
    P(-4, -12, 8, 13, PAL.stone);                // cuerpo
    P(-4, -12, 2, 13, PAL.stoneLight);           // cara iluminada
    P(2, -12, 2, 13, PAL.stoneDark);             // cara en sombra
    P(-4, -1, 8, 1, PAL.stoneDeep);
    RUNE(Math.floor(h2(_tx + 9, _ty + 4) * 4), 0, -10, PAL.stoneDeep, 0.9); // sigilo
    ENGRAVE(-2, -7, 3, _tx * 3 + _ty, PAL.stoneDeep, 0.8);                  // texto
    PA(-1, -4, 1, 1, PAL_PROP.crackGoldDeep, 0.4 + Math.sin(_t * 1.3) * 0.15); // nombre
  } else if (v === 1) {
    // LOSA TUMBADA: pizarra a ras con la inscripción a plena vista
    P(-7, 0, 14, 4, PAL.stoneLight);             // cara superior
    P(-7, 4, 14, 2, PAL.stoneDark);              // canto frontal
    P(-7, 0, 1, 4, PAL.stoneHi);
    P(6, 0, 1, 4, PAL.stoneDeep);
    ENGRAVE(-5, 1, 2, _tx * 5 + _ty * 3, PAL.stoneDeep, 0.85);
    P(4, 3, 2, 1, PAL.stoneDeep);                // esquina desportillada
    P(5, 2, 1, 1, PAL.stoneDeep);
  } else if (v === 2) {
    // PEDESTAL: bloque con placa embutida y tapa voladiza
    P(-6, -9, 12, 2, PAL.stoneHi);               // tapa
    P(-6, -8, 12, 1, PAL.stoneDeep);
    P(-5, -7, 10, 9, PAL.stone);
    P(-5, -7, 2, 9, PAL.stoneLight);
    P(3, -7, 2, 9, PAL.stoneDark);
    P(-3, -5, 6, 5, PAL.stoneDeep);              // placa embutida
    ENGRAVE(-2, -5, 1, _tx * 7 + _ty, PAL.stoneLine, 0.7);
    PA(-1, -3, 2, 1, PAL_PROP.crackGoldDeep, 0.55); // nombre en oro viejo
    if (mossSeed > 0.6) P(-6, -9, 4, 1, PAL_PROP.moss); // musgo en la tapa
  } else {
    // ESTELA ROTA: mitad en pie ladeada + fragmento caído junto al pie
    P(-2, -13, 2, 1, PAL.stoneLight);            // pico roto
    P(-4, -12, 7, 3, PAL.stone);
    P(-5, -9, 8, 3, PAL.stone);
    P(-5, -9, 2, 3, PAL.stoneLight);
    P(-6, -6, 8, 3, PAL.stone);
    P(-6, -6, 2, 3, PAL.stoneLight);
    P(-6, -4, 8, 1, PAL.stoneDeep);
    ENGRAVE(-4, -11, 2, _tx * 3 + _ty * 7, PAL.stoneDeep, 0.75);
    P(4, 1, 5, 2, PAL.stone);                    // fragmento caído
    P(4, 1, 2, 1, PAL.stoneLight);
    PA(6, 1, 1, 1, PAL_PROP.crackGoldDeep, 0.45);
  }
  // liquen/musgo y guijarros comunes al pie (hash por posición)
  if (mossSeed < 0.35) P(-7 + Math.floor(mossSeed * 20), 3, 3, 1, PAL_PROP.moss);
  if (mossSeed > 0.8) P(4, 3, 2, 1, PAL_PROP.mossDark);
  PEBBLE(6, 3, '#6a6a7a', '#8a8a9a', 0.9);
}

/**
 * RESTOS de lo que dejó la Niebla y las guerras del Canto. 4
 * variantes: armadura vencida, carro roto, huesos y estandarte caído.
 * Todo bajo (≤ 7 px de alto) y ancho (no estorba la lectura del paso).
 */
function drawRemains(): void {
  if (offscreen(48)) return;
  const v = Math.floor(h2(_tx * 11 + 3, _ty * 13 + 2) * 4);
  const rust = h2(_tx * 3 + 8, _ty * 5 + 6);
  PROP_SHADOW(_ctx!, _ox, _oy + 3 * ZOOM, 10, 2.2, 0.18);
  PA(-9, 1, 18, 3, '#1e1a14', 0.14);             // polvillo bajo el conjunto
  if (v === 0) {
    // ARMADURA VENCIDA: peto hundido + yelmo volcado + rodela + asta rota
    P(-6, -5, 7, 6, '#6a6a7a');                  // peto medio enterrado
    P(-6, -5, 2, 6, '#8a8a9a');
    P(-1, -5, 2, 6, '#4a4a58');
    P(-4, -6, 3, 1, '#3a3a48');                  // escote
    P(-5, -2, 1, 2, '#5a5a6a');                  // abolladuras
    P(-2, -1, 2, 1, '#5a5a6a');
    if (rust < 0.5) P(-6, -4, 2, 1, RUST_A);     // óxido del peto
    P(2, -3, 5, 3, '#7a7a8a');                   // yelmo volcado
    P(2, -3, 5, 1, '#9aa0ac');
    P(3, -2, 3, 1, '#2a2a34');                   // ranura del visor
    P(9, -2, 4, 4, '#5a5a6a');                   // rodela abollada
    P(9, -2, 4, 1, '#7a7a8a');
    P(10, -1, 1, 1, '#9aa0ac');                  // umbo
    P(9, -2, 1, 1, '#3a3a48');                   // muesca rota
    P(-10, 0, 1, 4, PAL.trunkDeep);              // asta de lanza rota
    P(-9, -3, 1, 3, PAL.trunkDeep);
    P(-9, -4, 1, 1, '#9aa0ac');                  // regatón
  } else if (v === 1) {
    // CARRO ROTO: rueda vencida + caja desplomada + saco derramado
    for (let i = 0; i < 10; i++) {               // aro de la rueda (10 px)
      const ang = (i / 10) * Math.PI * 2;
      P(-6 + Math.round(Math.cos(ang) * 5), -3 + Math.round(Math.sin(ang) * 4), 1, 1, '#4a4a58');
    }
    P(-6, -3, 1, 1, '#7a7a8a'); P(-2, -3, 1, 1, '#7a7a8a'); // radios
    P(-4, -4, 2, 2, '#5a5a6a');                  // buje
    P(-8, -1, 8, 2, PAL.plankWet);               // caja desplomada
    P(-8, -2, 7, 1, PAL.woodMid);
    P(0, -2, 6, 2, PAL.woodDark);                // tabla suelta
    P(5, -3, 1, 2, PAL.woodDark);                // extremo astillado
    if (rust > 0.4) P(-8, -1, 2, 1, RUST_B);     // herrumbre del herraje
    P(6, 0, 5, 4, SACK_C); P(6, 0, 5, 1, SACK_HI); P(6, 3, 5, 1, SACK_DK);
    P(5, 4, 2, 1, SACK_HI);                      // grano derramado
  } else if (v === 2) {
    // HUESOS: cráneo + caja torácica + fémur al sol
    P(1, -5, 4, 4, BONE);                        // cráneo
    P(2, -6, 2, 1, BONE);                        // bóveda
    P(2, -4, 1, 1, '#2a2a30');                   // órbitas
    P(4, -4, 1, 1, '#2a2a30');
    P(2, -2, 2, 1, BONE_DK);                     // mandíbula
    P(-5, -4, 1, 4, BONE);                       // costillas
    P(-3, -5, 1, 5, BONE);
    P(-1, -4, 1, 4, BONE);
    P(-6, 0, 7, 1, BONE_DK);                     // columna
    P(-10, 2, 5, 1, BONE);                       // fémur
    P(-11, 1, 1, 1, BONE); P(-11, 3, 1, 1, BONE); // epífisis
    P(5, 2, 3, 1, BONE_DK);                      // hueso suelto
    if (h2(_tx + 4, _ty + 9) < 0.5) P(0, -5, 1, 1, '#2a2a30'); // fractura
  } else {
    // ESTANDARTE CAÍDO: asta quebrada + tela con sigilo desvaído + adarga
    P(-8, -6, 2, 9, PAL.woodDark);               // tramo en pie
    P(-8, -7, 2, 1, '#9aa0ac');                  // remate metálico
    P(-6, -8, 5, 1, PAL.woodDark);               // tramo caído
    P(-1, -9, 3, 1, PAL.woodDark);
    P(-2, -1, 9, 4, CLOTH);                      // tela tendida en el suelo
    P(-2, -1, 9, 1, CLOTH_HI);
    P(-2, 2, 9, 1, CLOTH_DK);
    P(0, 0, 1, 1, CLOTH_DK); P(4, 0, 1, 1, CLOTH_DK); // pliegues
    RUNE(1, 2, -1, PAL_PROP.runeDim, 0.5);       // sigilo desvaído
    P(8, -4, 3, 3, '#5a5a6a');                   // adarga partida
    P(8, -4, 3, 1, '#7a7a8a');
    P(10, -4, 1, 1, '#3a3a48');
  }
}

/**
 * ALTAR MENOR del Eco: humilde pila/ara con VELA ENCENDIDA (CANDLE
 * comparte la llama animada determinista de los altares grandes) y
 * 2 motas doradas que ascienden — el Eco escucha también en la cuneta.
 * 4 variantes: cairn de vía, losa con cuenco, monolito menor y tronco.
 */
function drawAltarMinor(): void {
  if (offscreen(48)) return;
  const t = _t;
  const v = Math.floor(h2(_tx * 17 + 5, _ty * 5 + 9) * 4);
  PROP_SHADOW(_ctx!, _ox, _oy + 4 * ZOOM, 7, 2.2, 0.2);
  ELL(0, -3, 7, 4, PAL_PROP.flame2, 0.05 + Math.sin(t * 2.1) * 0.03); // calor
  if (v === 0) {
    // CAIRN DE VÍA: piedras apiladas con la vela en la cima
    P(-6, 1, 12, 3, PAL.stoneDark);
    P(-6, 1, 12, 1, PAL.stone);
    P(-4, -2, 8, 3, PAL.stone);
    P(-4, -2, 8, 1, PAL.stoneLight);
    P(-2, -4, 4, 2, PAL.stoneHi);
    CANDLE(-1, -7, 2);
  } else if (v === 1) {
    // LOSA CON CUENCO: ofrenda de cera a un lado, vela al otro
    P(-6, -1, 12, 4, PAL.stoneLight);
    P(-6, 3, 12, 2, PAL.stoneDark);
    P(-6, -1, 1, 4, PAL.stoneHi);
    P(-5, -3, 4, 2, PAL.stoneDark);              // cuenco
    P(-4, -3, 2, 1, PAL_PROP.wax);               // cera ofrendada
    CANDLE(3, -4, 5);
  } else if (v === 2) {
    // MONOLITO MENOR inclinado con runa y vela en repisa al pie
    P(-5, -12, 3, 1, PAL.stoneLight);
    P(-4, -11, 4, 2, PAL.stone);
    P(-3, -9, 4, 9, PAL.stone);
    P(-3, -9, 1, 9, PAL.stoneLight);
    P(0, -9, 1, 9, PAL.stoneDark);
    RUNE(2, -2, -7, PAL.stoneDeep, 0.8);
    P(2, 0, 5, 1, PAL.stoneDark);                // repisa
    CANDLE(3, -3, 7);
  } else {
    // TRONCO TOSCO: ara de leñador con marcas de hacha
    P(-5, -4, 10, 2, PAL.wood);                  // cara superior
    P(-5, -2, 10, 4, PAL.woodMid);
    P(-5, 2, 10, 1, PAL.woodDark);
    P(3, -4, 2, 4, PAL.woodDark);                // veta terminal
    P(4, -3, 1, 1, PAL.woodLight);               // anillo del tronco
    P(-2, -5, 1, 1, PAL.woodDark);               // marcas de hacha
    P(1, -5, 1, 1, PAL.woodDark);
    CANDLE(-1, -7, 4);
  }
  // musgo al pie + 2 motas doradas que ascienden y se disipan
  const mo = h2(_tx * 7 + 1, _ty * 3 + 8);
  if (mo < 0.4) P(-6 + Math.floor(mo * 10), 3, 2, 1, PAL_PROP.moss);
  PEBBLE(-8, 3, '#6a6a7a', '#8a8a9a', 0.9);
  for (let i = 0; i < 2; i++) {
    const cyc = (t * 0.3 + h2(_tx * 3 + i * 5, _ty * 9 + i) + i * 0.5) % 1;
    PA(-2 + i * 4, -Math.round(cyc * 9), 1, 1, PAL_PROP.crackGoldHi, Math.sin(cyc * Math.PI) * 0.55);
  }
}

/**
 * CARTEL DE MADERA ambiental (no interactivo; los legibles son kind
 * 'sign' de maps.ts). Flechas de camino, avisos con letra corrida y
 * el clásico «NO ENTRES» con aspa rota pintada. 4 variantes.
 */
function drawWoodsign(): void {
  if (offscreen(48)) return;
  const t = _t;
  const v = Math.floor(h2(_tx * 7 + 9, _ty * 17 + 4) * 4);
  const sway = Math.round(Math.sin(t * 1.1 + h2(_tx, _ty) * 6.283)); // vaivén 1 px
  PROP_SHADOW(_ctx!, _ox, _oy + 5 * ZOOM, 6, 2.2, 0.2);
  // poste común (madera vieja clavada a la tierra)
  P(-1 + sway, -14, 2, 18, PAL.woodDark);
  P(-1 + sway, -14, 1, 18, PAL.woodMid);
  P(-2, 3, 4, 1, '#3a3524');                     // tierra apisonada
  if (v === 0) {
    // FLECHA DE CAMINO: tablón en punta que señala (izq/der por hash)
    const dir = h2(_tx * 3 + 5, _ty * 7 + 2) < 0.5 ? 1 : -1;
    if (dir > 0) {
      P(-6 + sway, -18, 11, 4, '#8a5a2b');
      P(-6 + sway, -18, 11, 1, '#a8703a');
      P(-6 + sway, -15, 11, 1, PAL.door);
      P(5 + sway, -18, 2, 1, '#8a5a2b'); P(6 + sway, -17, 2, 2, '#8a5a2b');
      P(5 + sway, -14, 2, 1, '#8a5a2b');         // punta de flecha →
      P(-5 + sway, -18, 1, 1, '#9aa0ac'); P(3 + sway, -14, 1, 1, '#9aa0ac'); // clavos
      ENGRAVE(-4 + sway, -17, 1, _tx * 5 + _ty, '#4a2d16', 0.9);
      PA(-3 + sway, -16, 4, 1, '#4a2d16', 0.8);  // segunda palabra
    } else {
      P(-5 + sway, -18, 11, 4, '#8a5a2b');
      P(-5 + sway, -18, 11, 1, '#a8703a');
      P(-5 + sway, -15, 11, 1, PAL.door);
      P(-7 + sway, -18, 2, 1, '#8a5a2b'); P(-8 + sway, -17, 2, 2, '#8a5a2b');
      P(-7 + sway, -14, 2, 1, '#8a5a2b');        // punta de flecha ←
      P(-4 + sway, -18, 1, 1, '#9aa0ac'); P(4 + sway, -14, 1, 1, '#9aa0ac');
      ENGRAVE(-2 + sway, -17, 1, _tx * 5 + _ty, '#4a2d16', 0.9);
      PA(-1 + sway, -16, 4, 1, '#4a2d16', 0.8);
    }
  } else if (v === 1) {
    // AVISO: tabla enmarcada con letra corrida y raya de pintura vieja
    P(-5 + sway, -19, 10, 8, '#8a5a2b');
    P(-5 + sway, -19, 10, 1, '#a8703a');
    P(-5 + sway, -12, 10, 1, PAL.door);
    P(-5 + sway, -19, 1, 8, PAL.door);
    P(4 + sway, -19, 1, 8, PAL.door);
    ENGRAVE(-3 + sway, -17, 2, _tx * 9 + _ty * 3, '#3c2c18', 0.95);
    PA(-3 + sway, -13, 6, 1, PAINT_RED, 0.75);   // subrayado desvaído
    P(3 + sway, -19, 2, 1, '#54381e');           // esquina rasgada
    P(3 + sway, -17, 1, 2, '#a8703a');           // astilla colgando
    P(-4 + sway, -19, 1, 1, '#9aa0ac'); P(2 + sway, -12, 1, 1, '#9aa0ac');
  } else if (v === 2) {
    // PROHIBIDO: aspa rota pintada + tablilla «NO» (glifos 3×5)
    P(-6 + sway, -20, 12, 8, '#8a5a2b');
    P(-6 + sway, -20, 12, 1, '#a8703a');
    P(-6 + sway, -13, 12, 1, PAL.door);
    for (let i = 0; i < 6; i++) {                // aspa de pintura vieja
      PA(-4 + i + sway, -19 + i, 2, 1, PAINT_RED, 0.8);
      PA(-4 + i + sway, -14 - i, 2, 1, PAINT_RED_DK, 0.8);
    }
    P(-4 + sway, -11, 9, 7, '#8a5a2b');          // tablilla inferior
    P(-4 + sway, -11, 9, 1, '#a8703a');
    P(-4 + sway, -5, 9, 1, PAL.door);
    GLYPH_N(-3 + sway, -10);
    GLYPH_O(1 + sway, -10);
    P(4 + sway, -8, 1, 1, '#4a2d16');            // punto final
  } else {
    // DIRECCIONAL DOBLE: dos tablones con flechas opuestas (cruce)
    P(-7 + sway, -19, 9, 3, '#8a5a2b');
    P(-7 + sway, -19, 9, 1, '#a8703a');
    P(-7 + sway, -17, 9, 1, PAL.door);
    PA(-5 + sway, -18, 4, 1, '#4a2d16', 0.9);    // flecha ←
    PA(-7 + sway, -18, 1, 1, '#4a2d16', 0.9);
    PA(-6 + sway, -19, 1, 1, '#4a2d16', 0.9);
    PA(-6 + sway, -17, 1, 1, '#4a2d16', 0.9);
    P(0 + sway, -14, 9, 3, '#8a5a2b');
    P(0 + sway, -14, 9, 1, '#a8703a');
    P(0 + sway, -12, 9, 1, PAL.door);
    PA(4 + sway, -13, 4, 1, '#4a2d16', 0.9);     // flecha →
    PA(9 + sway, -13, 1, 1, '#4a2d16', 0.9);
    PA(8 + sway, -14, 1, 1, '#4a2d16', 0.9);
    PA(8 + sway, -12, 1, 1, '#4a2d16', 0.9);
    P(-6 + sway, -19, 1, 1, '#9aa0ac'); P(6 + sway, -12, 1, 1, '#9aa0ac');
  }
  // musgo del pie (el poste más viejo lo crió entero)
  if (h2(_tx * 5 + 3, _ty * 3 + 6) < 0.3) {
    P(-1 + sway, -2, 2, 1, PAL_PROP.moss);
    P(0 + sway, -1, 1, 1, PAL_PROP.mossDark);
  }
}

/**
 * MOJÓN DE CAMINO: hito piedrino pequeño que marca el sendero. 4
 * variantes: hito cónico, pila de pastor, hito con flecha grabada y
 * viejo hundido comido de musgo. El más barato de la familia.
 */
function drawWaypost(): void {
  if (offscreen(48)) return;
  const v = Math.floor(h2(_tx * 5 + 1, _ty * 19 + 8) * 4);
  PROP_SHADOW(_ctx!, _ox, _oy + 4 * ZOOM, 5, 1.8, 0.18);
  if (v === 0) {
    // HITO CÓNICO clásico de los caminos del valle
    P(-1, -8, 2, 2, PAL.stoneLight);             // punta
    P(-2, -6, 4, 9, PAL.stone);
    P(-2, -6, 1, 9, PAL.stoneLight);
    P(1, -6, 1, 9, PAL.stoneDark);
    P(-3, 2, 6, 2, PAL.stoneDark);               // asiento hundido
    P(-3, 2, 6, 1, PAL.stone);
    P(-1, -4, 2, 1, PAL.stoneDeep);              // marca del cantero
  } else if (v === 1) {
    // APILADO: tres piedras del pastor
    P(-3, 0, 7, 3, PAL.stoneDark);
    P(-3, 0, 7, 1, PAL.stone);
    P(-2, -3, 5, 3, PAL.stone);
    P(-2, -3, 5, 1, PAL.stoneLight);
    P(-1, -5, 3, 2, PAL.stoneHi);
    P(4, 2, 1, 1, '#6f695c');                    // piedrecilla suelta
  } else if (v === 2) {
    // HITO-FLECHA: bloque con flecha grabada hacia el sendero
    P(-4, -7, 9, 2, PAL.stoneHi);                // remate
    P(-3, -5, 7, 9, PAL.stone);
    P(-3, -5, 1, 9, PAL.stoneLight);
    P(3, -5, 1, 9, PAL.stoneDark);
    P(-3, 3, 7, 1, PAL.stoneDeep);
    const dir = h2(_tx * 9 + 4, _ty * 3 + 7) < 0.5 ? 1 : -1;
    if (dir > 0) {                               // flecha grabada →
      PA(-1, -2, 3, 1, PAL.stoneDeep, 0.9);
      PA(2, -3, 1, 1, PAL.stoneDeep, 0.9); PA(2, -1, 1, 1, PAL.stoneDeep, 0.9);
    } else {                                     // flecha grabada ←
      PA(-2, -2, 3, 1, PAL.stoneDeep, 0.9);
      PA(-3, -3, 1, 1, PAL.stoneDeep, 0.9); PA(-3, -1, 1, 1, PAL.stoneDeep, 0.9);
    }
  } else {
    // VIEJO HUNDIDO: la tierra se lo come, el musgo lo recuerda
    P(-3, -5, 3, 1, PAL.stoneLight);             // punta ladeada
    P(-2, -4, 4, 7, PAL.stoneDark);
    P(-2, -4, 1, 7, PAL.stone);
    P(-1, 2, 3, 1, '#3a3524');                   // hundido en la tierra
    P(-2, -2, 2, 1, PAL.stoneDeep);              // grieta
    P(-3, -1, 3, 1, PAL_PROP.moss);              // musgo viejo
    P(2, 3, 2, 1, PAL_PROP.mossDark);
    P(3, 1, 1, 2, PAL.grassBlade);               // brizna al pie
  }
}

// ============================================================
// R15 · CAMPANA DE LA PLAZA — poste de madera + travesaño + campana
// de bronce que OSCILA al tañerla (E). La memoria del vaivén es
// transitoria (no serializa): engine.ringBell llama a noteBellRing
// con globalT y aquí se dibuja un seno amortiguado de 4 s.
// ============================================================
const _bellRing = new Map<string, number>();
export function noteBellRing(id: string, t: number): void {
  _bellRing.set(id, t);
  if (_bellRing.size > 8) { // higiene: nunca más de 8 campanas recordadas
    const k0 = _bellRing.keys().next().value;
    if (k0 !== undefined) _bellRing.delete(k0);
  }
}
function drawCampana(): void {
  if (offscreen(60)) return;
  PROP_SHADOW(_ctx!, _ox, _oy + 6 * ZOOM, 12, 3.5);
  // poste central con veta + travesaño con zapatas
  P(-1, -18, 2, 24, PAL.woodDark);
  P(-1, -18, 1, 24, PAL.woodMid);
  P(-8, -18, 16, 2, PAL.wood);
  P(-8, -18, 16, 1, PAL.woodLight);
  P(-8, -16, 1, 2, PAL.woodDark); P(7, -16, 1, 2, PAL.woodDark);
  // tornapunta diagonal (la madera que aguanta el bronce)
  P(1, -13, 1, 1, PAL.woodDark); P(2, -12, 1, 1, PAL.woodDark); P(3, -11, 1, 1, PAL.woodDark);
  // vaivén amortiguado: e^(-1.6·dt) · sin(13·dt) · 3.4 px
  const rt = _bellRing.get(_pid);
  let swing = 0;
  if (rt !== undefined) {
    const dtb = _t - rt;
    if (dtb < 4) swing = Math.exp(-1.6 * dtb) * Math.sin(dtb * 13) * 3.4;
    else _bellRing.delete(_pid);
  }
  const bx = swing;
  // campana de bronce: perfil de copa en 4 tramos + badajo
  P(-4 + bx * 0.5, -16, 8, 2, '#8a6428');        // asa/hombro
  P(-5 + bx * 0.8, -14, 10, 3, '#a87c30');
  P(-6 + bx, -11, 12, 4, '#c89040');
  P(-6 + bx, -11, 2, 4, '#e8bc60');              // cara iluminada
  P(4 + bx, -11, 2, 4, '#8a6428');               // cara en sombra
  P(-7 + bx, -7, 14, 2, '#b8842c');              // boca
  P(-7 + bx, -7, 14, 1, '#e8bc60');
  P(bx * 1.1, -7, 2, 2, '#6a4a20');              // badajo
  P(-1, -16, 1, 3, PAL.ropeDark);                // cuerda del badajo
  // tilinte animado del bronce (destello que corre por la boca)
  PA(3 + bx, -9, 1, 1, '#fff3c0', 0.4 + Math.sin(_t * 6) * 0.35);
  if (swing !== 0) {
    // ondas de sonido pixel (arcos a ambos lados, alpha por amplitud)
    const k = Math.min(1, Math.abs(swing) / 3.4);
    const x2 = _ctx!;
    x2.strokeStyle = `rgba(255,233,160,${0.35 * k})`;
    x2.lineWidth = ZOOM;
    x2.beginPath();
    x2.ellipse(_ox + Math.round(-9 - k * 2) * ZOOM, _oy + Math.round(-9) * ZOOM, 3 * ZOOM, 4 * ZOOM, 0, -0.7, 0.7);
    x2.stroke();
    x2.beginPath();
    x2.ellipse(_ox + Math.round(9 + k * 2) * ZOOM, _oy + Math.round(-9) * ZOOM, 3 * ZOOM, 4 * ZOOM, 0, Math.PI - 0.7, Math.PI + 0.7);
    x2.stroke();
  }
  // hierba alta al pie (el pueblo no poda junto a la campana)
  P(-9, 4, 1, 2, PAL.grassBlade); P(9, 5, 1, 2, PAL.grassBlade); P(7, 4, 1, 1, PAL.grassBlade);
}

// ============================================================
// R15 · HOGUERA DE CAMINO — anillo de piedras + leños en tipí.
// APAGADA: leños crudos, musgo, una brizna. ENCENDIDA (flag del
// prop, persiste en save): brasas latientes + llama de 3 lenguas
// animada + chispas + humo + halo cálido que de noche se ve de
// lejos (el descanso del caminante).
// ============================================================
let _plit = false; // flag del prop actual (g.flags[_pid]) — la fija drawPropV2
function drawHoguera(): void {
  if (offscreen(50)) return;
  PROP_SHADOW(_ctx!, _ox, _oy + 4 * ZOOM, 10, 3, 0.24);
  // anillo de 8 piedras (hash: tamaño y tono por piedra)
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const rx = Math.round(Math.cos(ang) * 5.4);
    const ry = Math.round(Math.sin(ang) * 3.2);
    const sz = 2 + (h2(_tx * 7 + i, _ty * 5 + i * 3) > 0.6 ? 1 : 0);
    P(rx - sz / 2, ry - sz / 2 + 2, sz, sz, h2(_tx + i, _ty + i * 7) > 0.5 ? PAL.stone : PAL.stoneDark);
    if (h2(_tx * 3 + i, _ty * 9) > 0.72) P(rx, ry + 1, 1, 1, PAL.stoneHi); // brillo de luna
  }
  // interior (tierra pisada / brasas)
  if (!_plit) {
    P(-3, 0, 6, 3, '#4a4038');
    P(-4, 2, 8, 2, '#3e3630');
    // leños crudos en tipi (2 cruzados) con musgo
    P(-4, 1, 8, 2, PAL.wood);
    P(-4, 1, 8, 1, PAL.woodLight);
    P(-2, -2, 2, 4, PAL.woodMid);
    P(1, -3, 2, 5, PAL.woodDark);
    P(-3, 2, 2, 1, PAL_PROP.moss);
    P(2, 3, 1, 1, PAL.grassBlade);
  } else {
    // brasas latientes (latido por seno, determinista)
    const pulse = 0.65 + Math.sin(_t * 3.1) * 0.25;
    P(-3, 1, 6, 2, '#5a2a18');
    PA(-2, 1, 4, 1, PAL_PROP.ember1, pulse);
    PA(0, 2, 2, 1, PAL_PROP.emberCore, pulse * 0.9);
    // leños ennegrecidos
    P(-4, 0, 8, 2, '#2e2620');
    P(-4, 0, 8, 1, '#3a302a');
    P(-2, -3, 2, 4, '#26201c');
    P(1, -4, 2, 5, '#322a24');
    // LLAMA: 3 lenguas apiladas que vibran (senos desfasados)
    const f1 = 7 + Math.sin(_t * 9) * 1.6;         // central
    const f2 = 5 + Math.sin(_t * 11 + 1.3) * 1.3;  // izquierda
    const f3 = 4 + Math.sin(_t * 8 + 2.6) * 1.2;   // derecha
    PA(-2, -2 - f3 * 0.25, 3, f3 * 0.9, PAL_PROP.flame1, 0.85);
    PA(0, -2 - f2 * 0.3, 3, f2, PAL_PROP.flame1, 0.9);
    PA(-1, -3 - f1 * 0.5, 3, f1 * 0.8, PAL_PROP.flame2, 0.95);
    PA(-1, -3 - f1 * 0.72, 2, f1 * 0.55, PAL_PROP.flame3, 0.9);
    PA(-1, -2 - f1 * 0.3, 2, f1 * 0.4, '#ffffff', 0.35 + Math.sin(_t * 13) * 0.2);
    // chispas ascendentes (2, hash por paso de tiempo)
    for (let s = 0; s < 2; s++) {
      const stp = Math.floor(_t * 3 + s * 2.7) % 5;
      const sy2 = -6 - stp * 3 - s * 2;
      const sx2 = (h2(Math.floor(_t * 3) + s, 41) - 0.5) * 6;
      PA(sx2, sy2, 1, 1, PAL_PROP.spark, Math.max(0, 0.8 - stp * 0.16));
    }
    // humo tenue
    const smo = (Math.floor(_t * 2) % 6);
    PA((h2(Math.floor(_t * 2), 43) - 0.5) * 5, -12 - smo * 2.4, 2, 2, PAL_PROP.smoke, 0.16 - smo * 0.022);
    // halo cálido: más generoso de noche (se ve desde lejos)
    ELL(0, -4, 22 + _nf * 12, 16 + _nf * 9, '#ff9040', 0.10 + _nf * 0.16);
    ELL(0, -4, 12 + _nf * 6, 9 + _nf * 5, '#ffb050', 0.12 + _nf * 0.14);
  }
}

// ============================================================
// R15 · LIBRERÍA DE LORE DETERMINISTA — texto para los props que
// ahora son interactivos (placas/carteles/mojones/restos). Mismo
// espíritu que los ecos menores: frases cortas, evocadoras, sin
// exponer la trama. Elección por hash(id, kind) con sesgo local:
// ~45% de las veces sale una línea ESCRITA PARA ESE MAPA.
// ============================================================

/** hash corto de un id de prop (estable entre sesiones) */
function idHash(id: string): number {
  let s = 0;
  for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(s);
}

const LORE_LINES: Record<'plaque' | 'woodsign' | 'waypost' | 'remains', string[]> = {
  plaque: [
    '«AQUÍ ESTUVO —» El resto de la placa es una cicatriz de cincel. Alguien quiso que el nombre se perdiera antes que la piedra.',
    'Una placa de la vieja administración del Canto: los tributos se pagaban en notas sostenidas, nunca en coronas.',
    '«QUE TU VOZ NO CALLE.» Debajo, otra mano añadió: «ni aunque te la callen».',
    'La piedra lee mejor de lo que escribe: bajo la inscripción, surcos finos donde alguien pasó el dedo mil veces.',
    'Placa conmemorativa del último solsticio cantado. La fecha quedó a medias, como una nota que no se atrevió a resolver.',
    'Un escudo de la Orden de Vesh, raspado con paciencia de hormiga. La letra pequeña del decreto aún se distingue: «por el bien del silencio».',
    '«MEMORIA DE LAS AGUAS» — nombra un río que ya no recuerda su propio cauce.',
    'La placa está escrita en dos idiomas: el de antes del Canto y el de después. Solo coinciden en una palabra: «vuelve».',
  ],
  woodsign: [
    '«ALDEA — 1 legua.» La flecha fue corregida tres veces. La niebla no respeta los atajos.',
    '«NO CANTAR AL ANOCHECER.» Alguien lo tachó y escribió debajo: «canta bajito, entonces».',
    'El cartel ofrece setas, caricuras y protection contra la niebla. Ninguna de las tres ofertas sobrevivió al invierno.',
    '«SE BUSCAN OÍDOS FINOS — pregunta por la Guarda.» La madera está mojada, pero la tinta no se rinde.',
    'Un mapa raspado a mano: el valle, el bosque, la costa… y un trazo más pequeño que dice «tú estás aquí, todavía».',
    '«SI OYES TU NOMBRE EN LA NIEBLA, NO ES TU NOMBRE.» Clavado con dos clavos torcidos y mucha fe.',
    'La lista de precios de la taberna de Merrow, medio borrada. La única columna intacta es la de «canciones — gratis».',
  ],
  waypost: [
    'El mojón señala tres caminos y calla el cuarto, que no está en ningún mapa y va a todas partes.',
    'Marcas de conteo en la piedra: alguien midió los días aquí, y un día se llevó la cuenta consigo.',
    '«NORTE: LA CIUDADELA. SUR: EL MAR. ESTE: LO QUE FUE. OESTE: LO QUE NO HA SIDO.» El grabador tenía sentido del humor o mucho miedo.',
    'El musgo crece más grueso en la cara norte: el mojón lleva tanto tiempo quieto que hasta la piedra se ha hecho raíz.',
    'Ampollas de cera de tres velas distintas: tres viajeros pidieron aquí su suerte, y la piedra guardó las tres.',
    '«QUE EL CANTO TE ACOMPAÑE» — la bendición de los caminantes viejos, antes de que bendecir costara impuestos.',
  ],
  remains: [
    'Armadura vencida, bien apilada: alguien la dejó aquí con orden, como quien se cambia de ropa y no piensa volver por ella.',
    'Los restos de un estandarte de la Orden. El emblema de Vesh quedó hacia abajo: el viento tiene opiniones.',
    'Un carro roto que aún huele a clavel seco. Las mercancías se dispersaron; ninguna era de las que se pelean.',
    'Huesos pequeños, ordenados en círculo. Los niños de antes jugaban a «el Coro» aquí. Nadie recuerda las reglas, pero sí el silencio al final.',
    'La rueda de un carro y media silla: lo demás siguió de viaje sin ellos. La niebla no devuelve fletes.',
    'Un yelmo con una mella de hacha limpia y antigua. Dentro, anidado, un nido de hace años: las aves también vencen.',
    'Restos de una fogata de campaña y una cuchara de estaño. Lo último que alguien tuvo antes de la niebla fue sopa.',
  ],
};

// sabor por mapa (~2-3 líneas escritas para cada uno; salen ~45% de
// las veces — el resto, las genéricas, para que no se quemen pronto)
const LORE_BY_MAP: Record<string, Partial<Record<'plaque' | 'woodsign' | 'waypost' | 'remains', string[]>>> = {
  lunaris: {
    plaque: ['«AQUÍ DESPERTÓ EL PORTADOR.» La piedra es nueva; la mano que la talló, temblorosa. ¿Fue tú?'],
    woodsign: ['«AL VALLE LE FALTA UNA CASA Y SOBRA UN SILENCIO.» Debajo, en carbón: «y una nana que nadie termina».', '«EL POZO DA NOMBRES, NO AGUA.» Alguien lo probó y dejó la nota como advertencia y como agradecimiento.'],
    waypost: ['«LA ALDEA, AL ESTE.» La flecha está rehecha con ramitas atadas: alguien quiso que ni la niebla la borre.'],
    remains: ['Un roble caído, podado por la Niebla hasta la médula. Debajo crecen flores que no deberían saber de estaciones.'],
  },
  bosque: {
    plaque: ['Placa del SANTUARIO CAÍDO: «aquí se ensayó el Canto por última vez con público». El público era de hojas.'],
    woodsign: ['«EL SANTUARIO QUIEBRA, EL BOSQUE NO.» Debajo: «deja una nota si bajas; el bosque las colecciona».'],
    waypost: ['Mojón de los guardabosques: tres muescas nuevas y una vieja. La vieja es la que señala a casa.'],
    remains: ['Restos de un arco de censo del Círculo Verde. La cuerda es raíz ahora, pero aún tensa.'],
  },
  costa: {
    plaque: ['Placa del faro: «POR CADA VUELTA, UNA NOTA. POR CADA NOTA, UN BARCO EN CASA». El engranaje sigue pidiendo aceite y disculpas.'],
    woodsign: ['«LA MADRE DEL MAR NO DA LO QUE PIDE: DA LO QUE CANTAS.» Sobre esa advertencia alguien garabateó: «canta bonito».'],
    waypost: ['Mojón de pescadores con redes colgadas a secar. Cada red tiene un nombre anudado. Ninguno contesta.'],
    remains: ['Media barca varada, bautizada «CONTRICIÓN». La otra mitad sigue en algún lugar deseando llegar.'],
  },
  cumbres: {
    plaque: ['Placa del mirador: «DESDE AQUÍ SE OYE EL SILENCIO DE ARRIBA». Los montañeros antiguos lo llamaban dios; los nuevos, costumbre.'],
    woodsign: ['«LA CUEVA DE LAS TRES VELAS: ENTRA LO QUE SOBRA Y SALE LO QUE FALTA.» La madera está helada, la tinta no.'],
    waypost: ['El mojón tiene la cara norte pulida por la ventisca: los viajeros se refugiaban detrás y la piedra guarda la forma de sus mochilas.'],
    remains: ['Una trineo vacío y una cuerda perfectamente enrollada. En las cumbres, ordenarse así es una despedida.'],
  },
  aldea: {
    plaque: ['Placa de la plaza: «MERROW — NOMBRE GUARDADO». Antes decía otro nombre; la aldea prefirió empezar de cero.'],
    woodsign: ['«TABERNA DE MERROW: LA PRIMERA RONDA LA PAGA EL QUE VUELVE.» Nunca se ha pagado dos veces el mismo día.'],
    waypost: ['Mojón del huerto: «AL CEMENTERIO POR EL SUR, A LOS RECUERDOS POR CUALQUIER LADO».'],
    remains: ['Un espantapájaros retirado, con su camisa doblada encima. El huerto lo echa de menos: los cuervos también, pero por otras razones.'],
  },
};

/** Texto de lore determinista para un prop interactivo (R15).
 *  Estable entre sesiones: hash(id, kind) — nunca Math.random. */
export function loreTextFor(kind: 'plaque' | 'woodsign' | 'waypost' | 'remains', mapId: string, id: string): string {
  const ih = idHash(id);
  const local = LORE_BY_MAP[mapId]?.[kind];
  const useLocal = local && local.length > 0 && hash2(ih, 3) < 0.9; // sesgo local fuerte
  const pool = useLocal ? local! : LORE_LINES[kind];
  const i = Math.floor(hash2(ih, kind.length * 7 + 1) * pool.length);
  return pool[i] ?? pool[0];
}

// ---------------- Entrada principal ----------------

/**
 * Dibuja un prop v3. VER CONTRATO DE COORDENADAS en la cabecera:
 * wx/wy en píxeles de MUNDO (centro del prop = pr.x*16+8, pr.y*16+8).
 * El integrador debe llamarlo dentro del bloque con WORLD_FILTER si
 * quiere heredar el filtro de época; este módulo no toca ctx.filter.
 * `selected`: el prop es el objetivo de interacción más cercano
 * (<24 px del jugador) — el cartel tiembla y muestra el globo de
 * lectura con borde doble, y TODOS los kinds reciben el contorno
 * claro de 1 px que pulsa (drawSelectedAura).
 */
export function drawPropV2(
  ctx: CanvasRenderingContext2D, kind: string,
  wx: number, wy: number, g: Game, selected: boolean, id?: string,
): void {
  _ctx = ctx;
  _ox = Math.round(wx * ZOOM) - Math.round(g.camX);
  _oy = Math.round(wy * ZOOM) - Math.round(g.camY);
  _t = g.globalT;
  _tx = Math.floor(wx / TILE);
  _ty = Math.floor(wy / TILE);
  _nf = nightFactor(g.dayT); // v3: factor noche para sombras largas (gate)
  _pid = id ?? '';
  _mid = g.mapId; // v4: variantes por mapa (perchas de pescado en costa)
  _plit = g.flags[_pid] === true; // R15: hoguera encendida (flag persistente)
  ctx.save();
  try {
    switch (kind) {
      case 'sanctuary': drawSanctuary(); break;
      case 'forge': drawForge(); break;
      case 'fragment': drawFragment(); break;
      case 'altarEcho': drawAltarEcho(g); break;
      case 'sign': drawSign(selected); break;
      case 'gate': drawGate(); break;
      // —— v5 (R10-6): lore ambiental — no bloquean ——
      // —— R15: interactúan (leer/orar/tañer/encender) vía nearestInteract ——
      case 'plaque': drawPlaque(); break;
      case 'remains': drawRemains(); break;
      case 'altarMinor': drawAltarMinor(); break;
      case 'woodsign': drawWoodsign(); break;
      case 'waypost': drawWaypost(); break;
      // —— R15: interactivos de plaza/camino (campana oscilante + hoguera
      //    con llama/chispas/halo nocturno) ——
      case 'campana': drawCampana(); break;
      case 'hoguera': drawHoguera(); break;
      default: break; // kinds desconocidos: no-op seguro
    }
    // v3: contorno de selección para todos los kinds (tras el prop,
    // alpha sutil → resalta sin tapar).
    if (selected) drawSelectedAura();
  } finally {
    ctx.restore();
    _ctx = null;
  }
}

// ============================================================
// R10-6 · SPAWN DETERMINISTA DE PROPS DE LORE (épica 6.3)
// ============================================================
// Hasta aquí props.ts solo DIBUJABA (los props vivían declarados a mano
// en maps.ts/maps_expansion.ts). Esta sección añade el SEMBRADO: una
// pasada de carga por mapa que decide en qué tiles aparecen los cinco
// kinds de lore, con densidad baja, sesgo hacia caminos y garantías
// anti-estorbo. Todo con hash2 (cero Math.random, cero tiempo): dos
// ejecuciones producen EXACTAMENTE el mismo mundo.
//
// CONTRATO DE INTEGRACIÓN (para el orquestador — 2 líneas):
//   1. types.ts:64 — añadir los kinds a la unión PropKind:
//      | 'plaque' | 'remains' | 'altarMinor' | 'woodsign' | 'waypost'
//      (alternativa sin tocar types.ts: hacer cast en el enganche:
//       `... lorePropsForMap(m) as unknown as PropDef[]`).
//   2. maps.ts, justo tras `export const MAPS ... = { ...BASE_MAPS,
//      ...EXPANSION_MAPS };` (maps.ts:423):
//        for (const m of Object.values(MAPS)) m.props.push(...lorePropsForMap(m));
//      (import { lorePropsForMap } from './world/props';)
//   3. render.ts:386-388 — extender el dispatch de drawProps con los
//      5 kinds nuevos para que caigan en drawPropV2:
//        case 'plaque': case 'remains': case 'altarMinor':
//        case 'woodsign': case 'waypost':
//   La cripta y la arena devuelven [] (la cripta ya tiene nichos/velas
//   de world/stone.ts y la arena debe quedar limpia para el desafío),
//   igual que los interiores (ids 'interior_*' de maps_interiores.ts y
//   cualquier mapa menor de 16 tiles: los recintos cerrados no llevan
//   lore de intemperie).

export type LorePropKind = 'plaque' | 'remains' | 'altarMinor' | 'woodsign' | 'waypost' | 'campana' | 'hoguera'; // R15: +campana (la plaza suena) +hoguera (el descanso del caminante)

export interface LorePropDef {
  id: string;
  kind: LorePropKind;
  x: number;
  y: number;
  needPast?: boolean;          // solo existe en el pasado (tile sólido hoy)
  needPresent?: boolean;       // solo existe en el presente
}

/** Forma estructural mínima que cualquier MapDef satisface tal cual
 *  (props.ts no importa types.ts para seguir siendo hermético). */
export interface LoreMapShape {
  id: string;
  w: number; h: number;
  rows: string[];
  epochDiffs: readonly { x: number; y: number; char: string }[];
  exits: readonly { x: number; y: number; w: number; h: number }[];
  props: readonly { x: number; y: number }[];
  chests: readonly { x: number; y: number }[];
  npcs: readonly { x: number; y: number }[];
}

// Espejos LOCALES de sprites.ts (mismo patrón que DAY_ALPHA espeja a
// lighting.ts; props no importa sprites por diseño del módulo):
//  · LORE_SOLID = SOLID_CHARS (sprites.ts:156)
//  · LORE_WALK  = transitables CONOCIDOS ('s'/'S'/'i' de la expansión,
//    'B' puente, 'm' bruma baja, '='/'_'/':' camino/losa, 'c' cultivo).
// Ante un char desconocido (mapas nuevos de R10) el tile NO es elegible:
// lista blanca → jamás sembramos sobre un tile que no entendemos.
const LORE_SOLID = 'tp#HrFRwgPAV~dxn';
const LORE_WALK = '.,cm=:_sSiB';

/** Densidad (fracción de tiles elegibles): 4 % junto a camino/plaza,
 *  2 % en campo abierto (pedido de la épica 6.3: DENSIDAD BAJA). */
const LORE_DENS_ROAD = 0.04;
const LORE_DENS_OPEN = 0.02;

// Pesos de kind por bioma (el hash de cada tile elige dentro de la tabla;
// junto a camino doblan mojón ×2 y cartel ×1.5, a campo abierto los
// restos ×1.5 — la historia nace donde pasaba la gente).
const LORE_WEIGHTS: Record<string, readonly (readonly [LorePropKind, number])[]> = {
  lunaris: [['plaque', 3], ['remains', 2], ['waypost', 2], ['woodsign', 2], ['altarMinor', 1]],
  bosque: [['woodsign', 3], ['remains', 2], ['waypost', 2], ['altarMinor', 1], ['plaque', 1]],
  costa: [['remains', 3], ['waypost', 2], ['plaque', 2], ['woodsign', 2], ['altarMinor', 1]],
  aldea: [['woodsign', 3], ['plaque', 2], ['altarMinor', 2], ['waypost', 1], ['remains', 1]],
  cumbres: [['waypost', 3], ['altarMinor', 2], ['woodsign', 2], ['plaque', 1], ['remains', 1]],
};
const LORE_WEIGHTS_FALLBACK: readonly (readonly [LorePropKind, number])[] =
  [['waypost', 2], ['woodsign', 2], ['plaque', 2], ['remains', 2], ['altarMinor', 1]];

/** Tile elegible: transitable conocido y NUNCA el camino '=' en sí
 *  (los caminos quedan limpios: los props se rodean, no estorban). */
function loreOkTile(ch: string): boolean {
  return ch !== '=' && LORE_WALK.indexOf(ch) >= 0 && LORE_SOLID.indexOf(ch) < 0;
}

/**
 * Devuelve los props de lore de un mapa (0..24 según su tamaño). Se
 * llama UNA vez por mapa en carga (no por frame): la salida se funde
 * en m.props y a partir de ahí el mundo la trata como cualquier prop.
 * Determinista: solo hash2 de (x, y, id del mapa).
 */
export function lorePropsForMap(m: LoreMapShape): LorePropDef[] {
  const out: LorePropDef[] = [];
  // cripta: nichos de stone.ts (otro agente) · arena: desafío limpio ·
  // interiores ('interior_*' o recinto < 16 tiles): sin lore de exterior
  if (m.id === 'cripta' || m.id === 'arena' || m.id.startsWith('interior')) return out;
  if (m.w < 16 || m.h < 16) return out;

  // semilla del mapa (hash del id) para desfasar los hashes entre mapas
  let seed = 0;
  for (let i = 0; i < m.id.length; i++) seed = (seed * 31 + m.id.charCodeAt(i)) | 0;

  // filas rellenadas (mapRows de maps.ts hace lo mismo: espejo local)
  const rows: string[] = [];
  for (let y = 0; y < m.h; y++) {
    const r = m.rows[y] ?? '';
    rows.push(r.length >= m.w ? r.slice(0, m.w) : r + '.'.repeat(m.w - r.length));
  }
  const hasPast = m.epochDiffs.length > 0;
  const diff = new Map<number, string>();
  if (hasPast) for (const d of m.epochDiffs) diff.set(d.y * m.w + d.x, d.char);

  // tiles ocupados: salidas con MARGEN 1 (nunca junto a puertas) +
  // props/NPCs existentes en 3×3 (ni solaparse ni pisarse auras) +
  // cofres en 5×5 (el motor MUEVE los cofres nacidos en tile malo con
  // búsqueda por anillos — validateChests —, así que reservamos holgura)
  const busy = new Set<number>();
  const markBox = (cx: number, cy: number, r: number): void => {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x >= 0 && y >= 0 && x < m.w && y < m.h) busy.add(y * m.w + x);
      }
    }
  };
  for (const e of m.exits) {
    for (let y = e.y - 1; y < e.y + e.h + 1; y++) {
      for (let x = e.x - 1; x < e.x + e.w + 1; x++) markBox(x, y, 0);
    }
  }
  for (const p of m.props) markBox(p.x, p.y, 1);
  for (const n of m.npcs) markBox(n.x, n.y, 1);
  for (const c of m.chests) markBox(c.x, c.y, 2);

  // 1.er pase: nº de tiles elegibles → presupuesto por mapa (~3 % de
  // los elegibles, clamp 6..24) para que la densidad absoluta escale
  // con el tamaño del mapa sin inundar los pequeños
  let eligible = 0;
  for (let y = 2; y < m.h - 2; y++) {
    for (let x = 2; x < m.w - 2; x++) {
      if (loreOkTile(rows[y][x]) && !busy.has(y * m.w + x)) eligible++;
    }
  }
  const cap = Math.max(6, Math.min(24, Math.round(eligible * 0.03)));

  // 2.º pase: colocación completa (sin cortar en el cap: si se cortara
  // aquí, la mitad inferior de los mapas grandes quedaría vacía) y
  // ADELGAZADO final uniforme (se quitan por índice par) hasta el
  // presupuesto — determinista y reparte por TODO el mapa.
  const placedKeys: number[] = [];
  for (let y = 2; y < m.h - 2; y++) {
    for (let x = 2; x < m.w - 2; x++) {
      const key = y * m.w + x;
      const chP = rows[y][x];
      const dq = hasPast ? diff.get(key) : undefined;
      const chQ = dq !== undefined ? dq : chP;
      const okP = loreOkTile(chP);
      const okQ = loreOkTile(chQ);
      if ((!okP && !okQ) || busy.has(key)) continue;

      // existe donde el tile es transitable; si solo lo es en una época,
      // el flag needPresent/needPast lo apaga en la otra (contrato PropDef)
      let needPresent = false;
      let needPast = false;
      if (!okQ) needPresent = true;
      else if (!okP) needPast = true;

      // scattering: nada de props de lore vecinos (dist.² ≤ 2 = ortogonal
      // o diagonal) para que cada pieza respire y se lea como hallazgo
      let crowded = false;
      for (const k2 of placedKeys) {
        const dx2 = (k2 % m.w) - x;
        const dy2 = Math.floor(k2 / m.w) - y;
        if (dx2 * dx2 + dy2 * dy2 <= 2) { crowded = true; break; }
      }
      if (crowded) continue;

      // ¿junto a camino/plaza? (vecinos 4 del presente; los caminos no
      // cambian entre épocas en los mapas actuales)
      const nb =
        rows[y][x - 1] === '=' || rows[y][x + 1] === '=' ||
        rows[y - 1][x] === '=' || rows[y + 1][x] === '=' ||
        rows[y][x - 1] === ':' || rows[y][x + 1] === ':' ||
        rows[y - 1][x] === ':' || rows[y + 1][x] === ':';

      // densidad + elección de kind por hash espacial determinista
      const h1 = h2(x * 3 + seed, y * 5 + seed * 2 + 1);
      if (h1 >= (nb ? LORE_DENS_ROAD : LORE_DENS_OPEN)) continue;
      const weights = LORE_WEIGHTS[m.id] ?? LORE_WEIGHTS_FALLBACK;
      const h3 = h2(x * 7 + seed * 3 + 5, y * 11 + seed + 3);
      let total = 0;
      const acc: number[] = [];
      for (const [k, w0] of weights) {
        const wi = nb
          ? (k === 'waypost' ? w0 * 2 : k === 'woodsign' ? w0 * 1.5 : w0)
          : (k === 'remains' ? w0 * 1.5 : w0);
        acc.push(wi);
        total += wi;
      }
      let pick = weights[0][0];
      let acc2 = h3 * total;
      for (let i = 0; i < weights.length; i++) {
        acc2 -= acc[i];
        if (acc2 < 0) { pick = weights[i][0]; break; }
      }

      const def: LorePropDef = { id: `lore_${m.id}_${out.length}`, kind: pick, x, y };
      if (needPresent) def.needPresent = true;
      if (needPast) def.needPast = true;
      out.push(def);
      placedKeys.push(key);
    }
  }
  // adelgazado uniforme si nos pasamos del presupuesto: muestreo por
  // índice con paso constante (floor(i·paso), estrictamente creciente
  // para paso ≥ 1) — reparte los props por TODO el mapa en vez de
  // truncar la mitad inferior; determinista y más separado todavía.
  if (out.length > cap) {
    const step = out.length / cap;
    const kept: LorePropDef[] = [];
    for (let i = 0; i < cap; i++) kept.push(out[Math.floor(i * step)]);
    for (let i = 0; i < kept.length; i++) kept[i].id = `lore_${m.id}_${i}`; // ids únicos
    out.length = 0;
    for (const d of kept) out.push(d);
  }

  // —— R15 · interactivos de plaza y camino ——————————————————————
  // La CAMPANA (aldea/lunaris: los pueblos la tañen) y la HOGUERA de
  // camino (todo exterior grande: el descanso del caminante). Se
  // colocan en tiles libres lejos de todo prop ya puesto, con sesgo
  // hacia camino/plaza. Interactuables vía engine.nearestInteract.
  const wantBell = m.id === 'aldea' || m.id === 'lunaris';
  const wantFire = m.w >= 20 && m.h >= 20 && !m.id.startsWith('interior');
  if (wantBell || wantFire) {
    const farFrom = (x: number, y: number, list: number[], r: number): boolean => {
      for (const k2 of list) {
        const dx2 = (k2 % m.w) - x;
        const dy2 = Math.floor(k2 / m.w) - y;
        if (dx2 * dx2 + dy2 * dy2 <= r * r) return false;
      }
      return true;
    };
    const cands: { x: number; y: number; road: boolean }[] = [];
    for (let y = 3; y < m.h - 3; y++) {
      for (let x = 3; x < m.w - 3; x++) {
        const key = y * m.w + x;
        if (busy.has(key) || !farFrom(x, y, placedKeys, 2)) continue;
        const chP = rows[y][x];
        const dq = hasPast ? diff.get(key) : undefined;
        const chQ = dq !== undefined ? dq : chP;
        if (!loreOkTile(chP) && !loreOkTile(chQ)) continue;
        const road = rows[y][x - 1] === '=' || rows[y][x + 1] === '=' ||
          (rows[y - 1] !== undefined && rows[y - 1][x] === '=') || (rows[y + 1] !== undefined && rows[y + 1][x] === '=');
        cands.push({ x, y, road });
      }
    }
    const pickBest = (): { x: number; y: number; road: boolean } | null => {
      if (cands.length === 0) return null;
      const roadC = cands.filter((c) => c.road);
      const pool = roadC.length > 0 ? roadC : cands;
      let best = pool[0];
      let bestH = -1;
      for (const c of pool) {
        const hh = h2(c.x * 17 + seed, c.y * 29 + seed * 3 + 2);
        if (hh > bestH) { bestH = hh; best = c; }
      }
      return best;
    };
    if (wantBell) {
      const b = pickBest();
      if (b) {
        out.push({ id: `campana_${m.id}`, kind: 'campana', x: b.x, y: b.y });
        busy.add(b.y * m.w + b.x);
        placedKeys.push(b.y * m.w + b.x);
        const bi = cands.indexOf(b);
        if (bi >= 0) cands.splice(bi, 1);
      }
    }
    if (wantFire) {
      const pool = cands.filter((c) => farFrom(c.x, c.y, placedKeys, 2));
      if (pool.length > 0) {
        let best = pool[0];
        let bestH = -1;
        for (const c of pool) {
          const hh = h2(c.x * 23 + seed * 5, c.y * 13 + seed + 7);
          if (hh > bestH) { bestH = hh; best = c; }
        }
        out.push({ id: `hoguera_${m.id}`, kind: 'hoguera', x: best.x, y: best.y });
      }
    }
  }
  return out;
}
