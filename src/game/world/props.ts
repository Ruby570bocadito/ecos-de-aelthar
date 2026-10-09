// ============================================================
// ECOS DE AELTHAR — Props v3 (módulo world · R1-A10 + R4-A4)
// Sistema autocontenido de props del mapa. Kinds reales:
//   'sanctuary' · 'forge' · 'fragment' · 'altarEcho' · 'sign' · 'gate'
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
  ctx.save();
  try {
    switch (kind) {
      case 'sanctuary': drawSanctuary(); break;
      case 'forge': drawForge(); break;
      case 'fragment': drawFragment(); break;
      case 'altarEcho': drawAltarEcho(g); break;
      case 'sign': drawSign(selected); break;
      case 'gate': drawGate(); break;
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
