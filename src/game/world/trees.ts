// ============================================================
// ECOS DE AELTHAR — Árboles altos (módulo world)
// Casos: 't' árbol coposo · 'p' pino (drawTallTile)
// Contrato: paintTall llamada por el despachador drawTallTile.
//
// R1-A5 · Árboles nuevos (heredado):
//  · Altura 1×2 tiles visuales: la copa sube 20-30px por encima de
//    la fila py0 (prerrender estático, t=0; el recorte superior del
//    canvas solo afecta al borde del mapa, como antes).
//  · Tronco con curvatura leve y veta vertical, raíces abiertas.
//  · Coposo: variantes por hash (redondo, doble copa, llorón con
//    ramas caídas), copa en 3 masas superpuestas con 3 tonos, borde
//    en escalones con "mordiscos" donde asoma el cielo/hierba.
//  · Pino: variantes (esbelto, doble punta, abeto ancho), pisos
//    dentados, tronco visible abajo; vecinos vía at() para fundir
//    copas sin seams verticales y continuar el tronco.
//  · Sombra elíptica en el suelo y franjas translúcidas de copa
//    sobre caminos adyacentes ('=').
//  · Fila 0 (ty=0): el prerrender no tiene margen superior, así que
//    el árbol se dibuja desplazado 2px hacia abajo para no perder copa.
//
// R4-A6 · Árboles v3 (mundo y detalle · terror):
//  · EDAD POR ESPECIE (hash tx,ty → joven/medio/anciano): bandas de
//    altura distintas (joven 12-16 · medio 18-23 · anciano 25-29),
//    grosor de tronco (2/3/4px), copa más ancha en el anciano y
//    detalles gated por edad (sin fruto/nido en el joven). pick()
//    ahora usa hash2×2: la variante 2 (llorón/abeto) vuelve a salir
//    (hash2 nativo solo cubre [0,0.5) — convención del repo).
//  · SILUETA DE TERROR (solo 'bosque', 10% por hash): árbol torcido —
//    tronco en S (curva doble), ramas muertas de 1px como dedos que
//    salen de la copa, mordiscos extra (copa irregular) y CARA
//    SUGERIDA: 2 nudos oscuros de 2px como ojos hundidos (en el
//    tronco del coposo, en la copa baja del pino). Sin frutos/nido/
//    pájaro: árbol muerto por dentro.
//  · PROFUNDIDAD: 4º tono local para el borde INFERIOR de la copa
//    (más oscuro que la base), banda de LUZ DE LUNA de 1px en el
//    flanco superior-izquierdo (borde de las masas altas / pisos
//    superiores del pino) y raíces que se hunden 1-2px en la tierra.
//  · BASE VIVA: 2-4 hojas caídas de 1px (verde de copa apagado) y
//    hongos pálidos al pie de los ancianos (20%).
//  · CAPA ANIMADA OPCIONAL drawTreeCanopy(ctx, camX, camY, mapId, t,
//    at?): dibuja SOLO 2-3 hebras de 1px en la punta de cada árbol
//    visible, con vaivén determinista (fase/frecuencia/amplitud por
//    hash del tile, ±2-3px de recorrido). Nadie la llama todavía —
//    mientras tanto es inerte. El integrador puede conectarla tras
//    el terreno con el MISMO convenio que waterOverlay: camX/camY =
//    g.camX/g.camY (px de pantalla), at ABSOLUTO at(tx,ty) = char
//    del tile (tx,ty); ideal dentro del bloque con filtro de época.
//
// R5-O5 · overlay optimizado (misma firma y estética):
//  - Snapshot de tiles visibles: UNA lectura de at() por tile y frame en un
//    Uint8Array reutilizable; la vecindad de los planes se lee de la snapshot
//    con una función de módulo (cero closures por árbol).
//  - Hebras de copa horneadas a mini-láminas por (tonos, vaivén, largo):
//    1 drawImage por hebra en vez de px() por píxel.
//  - Culling estricto al viewport, early-out sin árboles y plan/lean
//    reutilizados a nivel de módulo (cero objetos por frame).
//
// R8-9 · VAIVÉN v2 (EPIC 5.4 — "los árboles son modestos a moverse"):
// la capa anima la CIMA COMPLETA de cada árbol visible, no solo hebras.
// El prerrender sigue congelado (look v3 intacto); el movimiento es un
// pase encima con tonos de copa:
//  · Cima que SE MECE: banda superior de copa desplazada por el vaivén —
//    ±2 joven · ±3 medio · ±4 anciano px en calma, hasta ±6-7 en racha
//    (la banda asoma a un lado y a otro de la silueta: la copa "rueda").
//  · Ramas laterales con RETARDO DE FASE (0.55-1.05 rad respecto al
//    tronco): asoman y se recogen en los bordes de copa — látigo
//    orgánico, nunca rígido. Los torcidos (muertos) no brotan ramas.
//  · FASE POR POSICIÓN + ONDA ESPACIAL: aleteo propio por hash2(tile)
//    (vecinos desfasados) + onda lenta que cruza el mapa (λ≈14 tiles,
//    ~1.2 tiles/s) — nunca todo el bosque en fase.
//  · Coherencia HIERBA→ÁRBOLES: el reposo de la copa se peina con
//    windDir() de grass.ts (el MISMO campo de flujo que peina los
//    mechones, muestreado en la base del tronco) y la amplitud sube
//    donde el campo es horizontal (|cos|).
//  · RÁFAGAS (solo-lectura de weather.ts): |weatherWindAt| (racha-calma,
//    55-80 s) escala la amplitud ×1..×1.7 con transición suave por
//    construcción y su signo empuja la copa en la dirección del viento
//    vivo; weatherIndexAt (90-150 s) infla la amplitud base despacio.
//  · HOJAS SUELTAS: copas maduras (age ≥ 1, no torcidas) dejan caer 1
//    hoja cada 14-26 s (determinista por hash+t, tumbo de 2 px, deriva
//    con el viento vivo); reparto en 3 turnos de 4 s → ~0-2 simultáneas
//    en pantalla, 0 en calidad baja y la mitad en calidad media.
//  · COSTE: O(árboles visibles), CERO allocations por frame (todo en
//    scratch de módulo); stamps de hebra 3×17×2 lazy (~102 mini-canvas
//    de 17×4 px, +16 KB de bitmap en el PEOR caso vs R5 — compensado
//    sin stamps por edad: la edad solo escala el índice de vaivén, y
//    solo 2 largos). Cima/ramas/hojas son fillRect directos: 0 memoria.
// ============================================================

import { hash2, px, PAL, isForest, pick, type NeighborFn } from './palette';
import { VIEW_W, VIEW_H, ZOOM as Z } from '../consts'; // R5-O5: vista viva
// R8-9 · viento vivo (SOLO LECTURA, sin ciclos: grass solo importa palette;
// weather importa consts/palette/perf; perf solo importa `type Game`):
//  · windDir/octDX (grass.ts): el campo de flujo que peina la hierba.
//  · weatherIndexAt/weatherWindAt (weather.ts): rachas del clima.
//  · perfQuality (perf.ts): escalón adaptativo 0 alta · 1 media · 2 baja.
import { windDir, octDX } from './grass';
import { weatherIndexAt, weatherWindAt } from './weather';
import { perfQuality } from '../perf';

type Ctx = CanvasRenderingContext2D;

const isTree = (ch: string | undefined): boolean => ch === 't' || ch === 'p';

/** hash2 nativo solo cubre [0,0.5): normalización ×2 (convención del repo). */
const h2 = (a: number, b: number): number => hash2(a, b) * 2;

// ---------------- colores locales R4-A6 (palette.ts intacto) ----------------

const COPA_DEEP2_L = '#1f4423';  // borde inferior de copa coposo Lunaris (más oscuro que copaDeepL)
const COPA_DEEP2_B = '#1a3a20';  // borde inferior de copa coposo Bosque
const PINE_DEEP2 = '#0f2517';    // borde inferior del cono del pino
const PINE_EYE = '#0a1c10';      // ojo hundido en la copa baja del pino torcido
const TRUNK_EYE = '#2c1a0c';     // nudo-ojo en el tronco del coposo torcido
const LEAF_FALL_L = '#567a3e';   // hoja caída apagada (Lunaris)
const LEAF_FALL_B = '#3c5a34';   // hoja caída apagada (Bosque)
const SHROOM_CAP = '#a8563e';    // sombrero pálido del hongo de anciano
const SHROOM_STEM = '#d8ccb0';   // pie del hongo

// ---------------- primitivas ----------------

/**
 * Masa ovalada de copa con borde en escalones. Los "mordiscos"
 * (huecos de 2px donde el jitter lo decide) dejan asomar el fondo
 * entre masas; los salientes dan la silueta irregular.
 * padL/padR extienden la masa hacia vecinos árbol (copas fundidas).
 * moonCol (R4-A6): si se pasa, el flanco superior-izquierdo de la
 * masa lleva una banda de 1px en ese tono (luz de luna).
 */
function lobe(
  x: Ctx, cx: number, cy: number, rx: number, ry: number,
  col: string, seed: number, bite = 0, padL = 0, padR = 0, moonCol?: string,
): void {
  x.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) {
    const k = dy / ry;
    const core = Math.sqrt(Math.max(0, 1 - k * k)) * rx;
    const jA = hash2(seed * 131 + dy * 7, 17);
    const jB = hash2(seed * 173 + dy * 5, 29);
    let hl = Math.max(1, Math.round(core * (0.76 + jA * 0.4))) + padL;
    let hr = Math.max(1, Math.round(core * (0.76 + jB * 0.4))) + padR;
    if (jA < 0.1 + bite) hl = Math.max(0, hl - 2);      // mordisco izquierdo
    else if (jA > 0.88) hl += 1;                        // escalón saliente
    if (jB < 0.1 + bite) hr = Math.max(0, hr - 2);      // mordisco derecho
    else if (jB > 0.88) hr += 1;
    if (hl + hr > 0) {
      x.fillRect(cx - hl, cy + dy, hl + hr, 1);
      if (moonCol && dy <= 0) px(x, cx - hl, cy + dy, 1, 1, moonCol); // luna arriba-izq
    }
  }
}

/** Sombra del tronco en el suelo: elipse 14×5 desplazada abajo-izquierda. */
function groundShadow(x: Ctx, cx: number, cy: number): void {
  x.fillStyle = 'rgba(0,0,0,0.28)';
  x.beginPath();
  x.ellipse(cx - 2, cy, 7, 2.5, 0, 0, Math.PI * 2);
  x.fill();
}

/** Sombra de la copa proyectada sobre un camino adyacente ('='). */
function pathShade(
  x: Ctx, px0: number, py0: number,
  nb: NeighborFn, r: number,
): void {
  const w = 2 + (r > 0.5 ? 1 : 0);                       // 2-3 px de franja
  const col = `rgba(0,0,0,${(0.16 + r * 0.06).toFixed(2)})`;
  if (nb(1, 0) === '=') px(x, px0 + 16, py0 + 3, w, 11, col);
  if (nb(-1, 0) === '=') px(x, px0 - w, py0 + 3, w, 11, col);
  if (nb(0, -1) === '=') px(x, px0 + 2, py0 - w, 12, w, col);
  if (nb(0, 1) === '=') px(x, px0 + 2, py0 + 16, 12, w, col);
}

/**
 * Inclinación de la copa según caminos vecinos (convención R1):
 * la copa se aparta del camino. La usan el prerrender y la capa
 * animada para que la punta coincida píxel a píxel.
 */
function leanOf(nb: NeighborFn): { lx: number; ly: number } {
  const nUp = nb(0, -1), nDown = nb(0, 1), nL = nb(-1, 0), nR = nb(1, 0);
  let lx = 0, ly = 0;
  if (nR === '=' && nL !== '=') lx = -2;                 // camino a la derecha → copa a la izquierda
  else if (nL === '=' && nR !== '=') lx = 2;
  if (nDown === '=') ly = -1;
  else if (nUp === '=') ly = 1;
  LEAN.lx = lx; LEAN.ly = ly;
  return LEAN;
}

/** Plan común por ejemplar: edad, variante de copa y altura (px sobre la fila). */
interface TreePlan {
  age: number;      // 0 joven · 1 medio · 2 anciano
  variant: number;  // coposo: 0 redondo · 1 doble copa · 2 llorón — pino: 0 esbelto · 1 doble punta · 2 abeto
  reach: number;    // altura de copa sobre py0
}

/** R5-O5 · plan y lean REUTILIZABLES a nivel de módulo (cero objetos/frame). */
const PLAN: TreePlan = { age: 0, variant: 0, reach: 0 };
const LEAN: { lx: number; ly: number } = { lx: 0, ly: 0 };

/** Plan del coposo: banda de altura por edad + ajustes de vecindad (R1). */
function coposoPlan(tx: number, ty: number, nb: NeighborFn): TreePlan {
  const s = tx * 3 + 1, s2 = ty * 5 + 7;
  const nUp = nb(0, -1), nDown = nb(0, 1), nL = nb(-1, 0), nR = nb(1, 0);
  const tUp = isTree(nUp), tDown = isTree(nDown), tL = isTree(nL), tR = isTree(nR);
  const age = pick(h2(s * 61 + 5, s2 * 53 + 7), 3);
  const variant = pick(h2(s * 41 + 3, s2 * 37 + 9), 3);
  const band = age === 0 ? 14 : age === 1 ? 20 : 27;     // joven / medio / anciano
  let reach = band + Math.floor(h2(s * 9 + 2, s2 * 13 + 3) * (age === 1 ? 4 : 3));
  if (tUp) reach += 3;                                   // crece junto a otros árboles
  if (isTree(nb(-1, -1)) || isTree(nb(1, -1))) reach += 1;
  if (!tUp && !tDown && !tL && !tR) reach -= 2;          // ejemplar aislado
  reach = Math.min(29, Math.max(12, reach));
  if (nUp === 'p') reach = Math.min(reach, 20);          // no rebanar la copa del pino de arriba
  PLAN.age = age; PLAN.variant = variant; PLAN.reach = reach;
  return PLAN;
}

/** Plan del pino: mismas reglas de edad con techos propios de variante. */
function pinePlan(tx: number, ty: number, nb: NeighborFn): TreePlan {
  const s = tx * 3 + 1, s2 = ty * 5 + 7;
  const nUp = nb(0, -1), nDown = nb(0, 1), nL = nb(-1, 0), nR = nb(1, 0);
  const tUp = isTree(nUp), tDown = isTree(nDown), tL = isTree(nL), tR = isTree(nR);
  const age = pick(h2(s * 61 + 5, s2 * 53 + 7), 3);
  const variant = pick(h2(s * 41 + 3, s2 * 37 + 9), 3);
  const band = age === 0 ? 14 : age === 1 ? 20 : 27;
  let reach = band + Math.floor(h2(s * 9 + 2, s2 * 13 + 3) * (age === 1 ? 4 : 3));
  if (tUp) reach += 3;
  if (isTree(nb(-1, -1)) || isTree(nb(1, -1))) reach += 1;
  if (!tUp && !tDown && !tL && !tR) reach -= 2;
  if (variant === 0) reach += 1;                         // esbelto
  if (variant === 1) reach = Math.min(reach, 26);        // deja sitio a la segunda punta
  if (variant === 2) reach = Math.min(reach, 28);
  reach = Math.min(28, Math.max(12, reach));
  if (nUp === 't') reach = Math.min(reach, 18);          // bajo un coposo: pino de sotobosque
  PLAN.age = age; PLAN.variant = variant; PLAN.reach = reach;
  return PLAN;
}

/**
 * ¿Árbol torcido? Solo en el bosque (10% por hash): silueta de
 * terror — tronco en S, dedos de 1px, copa irregular y cara.
 */
function isTwisted(mapId: string, s: number, s2: number): boolean {
  return isForest(mapId) && h2(s * 101 + 7, s2 * 103 + 9) < 0.1;
}

/**
 * Desplazamiento horizontal del tronco en la fila `y` (mismo algoritmo
 * que trunkCoposo por tramos de 3px) para alinear los ojos del tronco.
 */
function trunkOff(y: number, topY: number, baseY: number, bend: number, twist: boolean): number {
  const seg = topY + 3 * Math.floor((y - topY) / 3);
  const h = Math.min(3, baseY - seg);
  const t = (seg + h - topY) / Math.max(1, baseY - topY);
  return twist
    ? Math.round(Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 2.3) * bend * 0.5)
    : Math.round(Math.sin(t * Math.PI) * bend);
}

/**
 * Tronco coposo: segmentos de 3px con curvatura leve (seno), veta
 * oscura al lado del sol y brillo lateral arriba; ensanche y raíces
 * que se abren en la base. R4-A6: grosor por edad (w = 2 joven,
 * 3 medio, 4 anciano) y, si `twist`, curva en S de árbol poseído.
 */
function trunkCoposo(
  x: Ctx, cx: number, py0: number, topY: number,
  bend: number, shortBase: boolean, w: number, twist: boolean,
): void {
  const baseY = shortBase ? py0 + 9 : py0 + 14;          // vecino abajo árbol: tronco corto
  const vw = Math.max(1, w - 2);                         // ancho de la veta
  for (let y = topY; y < baseY; y += 3) {
    const h = Math.min(3, baseY - y);
    const off = trunkOff(y, topY, baseY, bend, twist);
    px(x, cx + off - (w >> 1), y, w, h, PAL.trunkMid);
    px(x, cx + off - (w >> 1) + w - vw, y, vw, h, PAL.trunkDeep); // veta vertical oscura
    if (!twist) px(x, cx + off - (w >> 1), y, 1, h, PAL.trunkHi); // filo iluminado
  }
  const fw = w + 4;                                      // ensanche de la base
  px(x, cx - (fw >> 1), baseY - 3, fw, 3, PAL.trunkMid);
  px(x, cx - (fw >> 1), baseY - 1, fw, 1, PAL.trunkDeep); // sombra al pie
  if (!shortBase) {
    px(x, cx - (fw >> 1) - 2, baseY - 2, 2, 2, PAL.trunkMid);   // raíces abiertas
    px(x, cx + (fw >> 1) + 1, baseY - 2, 2, 2, PAL.trunkMid);
    px(x, cx - (fw >> 1) - 3, baseY - 1, 2, 1, PAL.rootSoil);
    px(x, cx + (fw >> 1) + 2, baseY - 1, 2, 1, PAL.rootSoil);
    // raíces que se hunden en la tierra (2-3 px visibles bajo la base)
    px(x, cx - (fw >> 1) + 1, baseY, w >= 4 ? 2 : 1, 1, PAL.rootSoil);
    px(x, cx + (fw >> 1) - 2, baseY, w >= 4 ? 2 : 1, 1, PAL.rootSoil);
    if (w >= 4) px(x, cx, baseY, 1, 1, PAL.rootSoil);
  } else {
    px(x, cx - 4, baseY - 1, 2, 1, PAL.rootSoil);
    px(x, cx + 3, baseY - 1, 2, 1, PAL.rootSoil);
  }
}

/** Tronco de pino: fino, visible bajo la copa; contTop lo alarga si el vecino de arriba también es árbol. */
function trunkPine(x: Ctx, cx: number, py0: number, contTop: number): void {
  const topY = Math.min(py0 + 4, contTop);
  px(x, cx - 1, topY, 2, py0 + 14 - topY, PAL.trunkDeep);
  px(x, cx - 2, py0 + 5, 1, 7, PAL.trunkMid);            // filo iluminado
  px(x, cx - 3, py0 + 12, 6, 2, PAL.trunkDeep);          // ensanche
  px(x, cx - 5, py0 + 13, 2, 1, PAL.rootSoil);
  px(x, cx + 4, py0 + 13, 2, 1, PAL.rootSoil);
}

/**
 * Copa de pino por pisos: filas que se estrechan hacia la punta con
 * muescas de piso cada `fe` filas y bordes dentados (jitter por hash).
 * R4-A6: `skew` curva la torre (pinos torcidos), las 2 filas
 * inferiores van en tono profundo (borde inferior más oscuro) y el
 * 40% superior lleva banda de luna de 1px en el flanco izquierdo.
 */
function pineCone(
  x: Ctx, cx: number, py0: number, reach: number,
  maxHw: number, fe: number, seed: number,
  padL: number, padR: number, wide: boolean, skew: number, deep: string,
): void {
  const topY = py0 - reach;
  const botY = py0 + 3;
  const H = botY - topY;
  const moonEnd = topY + Math.round(H * 0.4);
  const bendAt = (y: number): number => cx + Math.round((skew * (botY - y)) / H);
  const hwAt = (y: number): number => {
    const t = (y - topY) / H;                            // 0 punta → 1 base
    let hw = Math.max(1, Math.round(1 + (maxHw - 1) * Math.pow(t, 0.85)));
    if (y % fe === 0 && y < botY - 1) hw -= wide ? 2 : 1; // muesca de piso
    if (wide && y >= botY - 1) hw += 1;                   // falda del abeto
    return hw;
  };
  for (let y = topY; y <= botY; y++) {
    const cxx = bendAt(y);
    const hw = hwAt(y);
    const jL = hash2(seed * 31 + y, 41);
    const jR = hash2(seed * 47 + y, 43);
    const hl = Math.max(0, hw + padL + (jL < 0.3 ? 1 : 0) - (jL > 0.8 ? 1 : 0));
    const hr = Math.max(0, hw + padR + (jR < 0.3 ? 1 : 0) - (jR > 0.8 ? 1 : 0));
    if (hl + hr > 0) {
      x.fillStyle = y >= botY - 1 ? deep : PAL.pineDark;
      x.fillRect(cxx - hl, y, hl + hr, 1);
      if (y <= moonEnd) px(x, cxx - hl, y, 1, 1, PAL.pineLight); // luna arriba-izq
    }
  }
  // tono medio: columna interior (deja ver el piso dentado en los bordes)
  x.fillStyle = PAL.pineMid;
  for (let y = topY + 2; y <= botY - 1; y++) {
    const hw = Math.max(1, Math.round(hwAt(y) * 0.45));
    x.fillRect(bendAt(y) - hw, y, hw * 2, 1);
  }
  // luces en el repisa superior-izquierda de cada piso (luna arriba-izquierda)
  for (let y = topY + 2; y < botY - 2; y += fe) {
    const cxx = bendAt(y);
    const j = hash2(seed * 91 + y, 61);
    if (j < 0.85) px(x, cxx - hwAt(y) - (j < 0.4 ? 1 : 0), y, 2, 1, PAL.pineLight);
    if (j > 0.72) px(x, cxx + hwAt(y + 1) - 1, y + 1, 1, 1, PAL.pineLight);
  }
}

/**
 * Base viva común (R4-A6): 2-4 hojas caídas de 1px en tono de copa
 * apagado alrededor del tronco y, en los ancianos (20%), 2-3 hongos
 * pálidos de sombrero 2px y pie 1px.
 */
function baseDebris(
  x: Ctx, cx: number, px0: number, py0: number,
  forest: boolean, s: number, s2: number, anciano: boolean,
): void {
  const nFall = 2 + Math.floor(h2(s * 13 + 21, s2 * 19 + 23) * 3); // 2-4
  const fallCol = forest ? LEAF_FALL_B : LEAF_FALL_L;
  for (let i = 0; i < nFall; i++) {
    let lx = px0 + 2 + Math.floor(h2(s * 17 + i * 3, s2 * 7 + i) * 12);
    const ly = py0 + 11 + Math.floor(h2(s * 23 + i * 5, s2 * 29 + i) * 4);
    if (lx >= cx - 2 && lx <= cx + 3) lx += lx < cx ? -3 : 4; // apartadas del tronco
    px(x, lx, ly, 1, 1, fallCol);
  }
  if (anciano && h2(s * 31 + 3, s2 * 37 + 5) < 0.2) {
    const nSh = 2 + pick(h2(s * 43 + 7, s2 * 41 + 9), 2); // 2-3 hongos
    for (let i = 0; i < nSh; i++) {
      let mx = cx - 6 + Math.floor(h2(s * 47 + i * 3, s2 * 53 + i) * 13);
      const my = py0 + 12 + Math.floor(h2(s * 59 + i, s2 * 61 + i * 3) * 2);
      if (mx >= cx - 2 && mx <= cx + 2) mx += mx < cx ? -4 : 5; // fuera del tronco
      px(x, mx, my, 2, 1, SHROOM_CAP);
      px(x, mx, my + 1, 1, 1, SHROOM_STEM);
    }
  }
}

// ---------------- árbol coposo ('t') ----------------

function paintCoposo(x: Ctx, tx: number, ty: number, mapId: string, nb: NeighborFn): void {
  // ty=0: sin margen superior en el canvas de suelo → árbol 2px más abajo
  const px0 = tx * 16, py0 = ty * 16 + (ty === 0 ? 2 : 0);
  const forest = isForest(mapId);
  const s = tx * 3 + 1, s2 = ty * 5 + 7;                 // semillas (hash original)

  const { age, variant, reach } = coposoPlan(tx, ty, nb);
  const { lx: leanX, ly: leanY } = leanOf(nb);
  const twist = isTwisted(mapId, s, s2);

  const tDown = isTree(nb(0, 1)), tL = isTree(nb(-1, 0)), tR = isTree(nb(1, 0));

  const rh = Math.round(reach / 2);
  const cx = px0 + 7 + leanX;
  const cy = py0 + 1 - rh + leanY;
  const crownTop = py0 - reach + leanY;
  const crownBot = variant === 2 ? cy + rh - 13 : py0 + 2 + leanY;
  const crownRx = rh + 1 + (age === 2 ? 1 : 0);

  const cDark = forest ? PAL.copaDeepB : PAL.copaDeepL;
  const cMid = forest ? PAL.copaMidB : PAL.copaMidL;
  const cLight = forest ? PAL.copaLightB : PAL.copaLightL;
  const cDeep2 = forest ? COPA_DEEP2_B : COPA_DEEP2_L;

  // solape con copas vecinas: la masa se extiende hacia el lado del vecino
  const padL = tL ? 2 : 0, padR = tR ? 2 : 0;
  const qL = Math.max(0, padL - 1), qR = Math.max(0, padR - 1);
  const twBite = twist ? 0.08 : 0;                       // copa irregular si está torcido
  const wx = age === 2 ? 1 : 0;                          // copa extra ancha del anciano

  groundShadow(x, px0 + 7, py0 + 14); // en la base, desplazada abajo-izq
  // sombra sobre camino ANTES de la copa: el follaje la tapa donde cuelga
  pathShade(x, px0, py0, nb, hash2(s * 53 + 7, s2 * 43 + 11));
  // torcido → tronco ancho 3 (viejo antes de tiempo) y curva en S
  const trunkW = twist ? 3 : age === 0 ? 2 : age === 2 ? 4 : 3;
  trunkCoposo(
    x, px0 + 7, py0, crownBot - 2,
    twist ? 2 : leanX !== 0 ? Math.sign(leanX) : (h2(s, s2 * 3) < 0.5 ? 1 : -1),
    tDown, trunkW, twist,
  );

  // cara sugerida: 2 nudos oscuros de 2px como ojos hundidos en el tronco
  if (twist) {
    const eyeY = py0 + 4 + Math.floor(h2(s * 5 + 17, s2 * 9 + 3) * 3);
    for (let e = 0; e < 2; e++) {
      const off = trunkOff(eyeY + e, crownBot - 2, tDown ? py0 + 9 : py0 + 14, 2, true);
      px(x, cx + off - 1, eyeY + e, 1, 1, TRUNK_EYE);
      px(x, cx + off + 1, eyeY + e, 1, 1, TRUNK_EYE);
    }
  }

  // ---- copa: 3 masas superpuestas · oscuro base, medio, luz arriba-izq ----
  // (cada variante añade la franja inferior profunda y la banda de luna)
  if (variant === 0) {
    // redondo
    lobe(x, cx, cy + 6, rh - 3 + wx, rh - 5, cDark, s + 1, 0.04 + twBite, qL, qR);
    lobe(x, cx, cy + 7, Math.max(3, rh - 5 + wx), Math.max(2, rh - 7), cDeep2, s + 9, 0.02, qL, qR);
    lobe(x, cx - 5, cy - 2, 7, rh - 6, cMid, s + 2, 0.08 + twBite, padL, qR);
    lobe(x, cx + 5, cy - 3, 7, rh - 6, cMid, s + 3, 0.08 + twBite, qL, padR);
    lobe(x, cx, cy - 6, rh - 5 + wx, rh - 6, cMid, s + 4, 0.1 + twBite, padL, padR, cLight);
    lobe(x, cx - 4, cy - 6, 5, Math.max(3, rh - 8), cLight, s + 5);
    // islotes separados de la silueta (1px despegados del borde real)
    px(x, cx - crownRx + 1, cy - 2, 1, 1, cMid);
    px(x, cx + crownRx - 3, cy + 1, 1, 1, cMid);
    px(x, cx + 3, cy - rh, 1, 1, cMid);
  } else if (variant === 1) {
    // doble copa: dos masas con nudo mordido entre ellas
    lobe(x, cx - 1, cy + 6, rh - 4 + wx, rh - 5, cDark, s + 1, 0.04 + twBite, qL, qR);
    lobe(x, cx - 1, cy + 7, Math.max(2, rh - 6 + wx), Math.max(2, rh - 7), cDeep2, s + 9, 0.02, qL, qR);
    lobe(x, cx - 4, cy + 1, rh - 5, rh - 6, cMid, s + 2, 0.1 + twBite, padL, qR, cLight);
    lobe(x, cx + 4, cy - 5, rh - 6, rh - 7, cMid, s + 3, 0.1 + twBite, qL, padR);
    lobe(x, cx + 1, cy - 1, 4, 4, cMid, s + 6, 0.22 + twBite, qL, qR);
    lobe(x, cx + 2, cy - 7, 4, Math.max(2, rh - 9), cLight, s + 5);
    lobe(x, cx - 7, cy - 3, 3, 3, cLight, s + 7);
    px(x, cx + crownRx - 4, cy - rh + 4, 1, 1, cMid);
    px(x, cx - crownRx + 2, cy + 3, 1, 1, cMid);
  } else {
    // llorón: copa alta y compacta + ramas caídas con punta clara
    lobe(x, cx, cy - 6, rh - 4 + wx, rh - 7, cDark, s + 1, 0.05 + twBite, qL, qR);
    lobe(x, cx, cy - 5, Math.max(2, rh - 6 + wx), Math.max(2, rh - 8), cDeep2, s + 9, 0.02, qL, qR);
    lobe(x, cx - 4, cy - 9, rh - 5, rh - 8, cMid, s + 2, 0.08 + twBite, padL, qR, cLight);
    lobe(x, cx + 4, cy - 8, rh - 5, rh - 8, cMid, s + 3, 0.08 + twBite, qL, padR);
    lobe(x, cx, cy - 11, rh - 6, Math.max(2, rh - 10), cMid, s + 4, 0.1 + twBite, padL, padR);
    lobe(x, cx - 3, cy - 8, 4, Math.max(2, rh - 10), cLight, s + 5);
    const drops = [-6, -1, 5];
    for (let i = 0; i < drops.length; i++) {
      const d0 = drops[i];
      const bx0 = cx + d0 + Math.floor(hash2(s + i, s2 * 7 + i * 3) * 3) - 1;
      const len = 4 + Math.floor(hash2(s * 3 + i * 5, s2 + i) * 4);
      const dir = d0 < 0 ? -1 : 1;                       // caen abriéndose hacia fuera
      const startY = cy + rh - 13;
      for (let d = 0; d <= len; d++) {
        px(x, bx0 + Math.round(d * 0.3) * dir, startY + d, 1, 1, cDark);
      }
      px(x, bx0 + Math.round(len * 0.3) * dir, startY + len + 1, 1, 1, cLight);
    }
  }

  // árbol torcido: ramas muertas de 1px como dedos que salen de la copa
  if (twist) {
    const nf = 2 + pick(h2(s * 7 + 31, s2 * 11 + 37), 2); // 2-3 dedos
    for (let i = 0; i < nf; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const fy = crownTop + 2 +
        Math.floor(h2(s * 13 + i * 7, s2 * 17 + i * 3) * Math.max(2, (crownBot - crownTop) * 0.5));
      const len = 3 + Math.floor(h2(s * 19 + i, s2 * 23 + i * 5) * 2);
      for (let d = 0; d <= len; d++) {
        px(x, cx + side * (crownRx - 1 + d), fy - Math.round(d * 0.7), 1, 1, PAL.trunkDeep);
      }
    }
  }

  // brillos sueltos anclados al lóbulo claro de cada variante (radio 0.7-1.3:
  // caen sobre el anillo medio que lo rodea, nunca lejos de la copa)
  {
    const lx0 = variant === 1 ? cx + 2 : variant === 2 ? cx - 3 : cx - 4;
    const ly0 = variant === 1 ? cy - 7 : variant === 2 ? cy - 8 : cy - 6;
    const rxL = variant === 2 ? 4 : 5;
    const ryL = variant === 1 ? Math.max(2, rh - 9) : variant === 2 ? Math.max(2, rh - 10) : Math.max(3, rh - 8);
    for (let i = 0; i < 3; i++) {
      const a = hash2(s * 13 + i * 3, s2 * 19 + i) * Math.PI * 2;
      const rr = 0.7 + 0.6 * Math.sqrt(hash2(s * 23 + i, s2 * 41 + i * 3));
      px(x, Math.round(lx0 + Math.cos(a) * rxL * rr), Math.round(ly0 + Math.sin(a) * ryL * rr), 1, 1, cLight);
    }
  }

  // ---- detalles vivos ----
  const rFruit = hash2(s * 17 + 5, s2 * 23 + 1);
  const rNest = hash2(s * 11 + 9, s2 * 17 + 2);
  const rBird = hash2(s * 19 + 4, s2 * 29 + 8);
  const rLeaf = hash2(s * 23 + 6, s2 * 13 + 5);

  if (rFruit < 0.2 && age !== 0 && !twist) {
    // frutos (2×2 con brillo) y flores (1×1) dentro de la elipse de copa
    const kinds = [PAL.fruitRed, PAL.flowerGold, PAL.flowerPink];
    const midY = crownTop + (crownBot - crownTop) * 0.45;
    const halfH = Math.max(2, (crownBot - crownTop) * 0.55);
    let placed = 0;
    for (let i = 0; i < 6 && placed < 3; i++) {
      const fx = cx - crownRx + 2 + Math.floor(hash2(s * 17 + i * 3, s2 * 23 + i) * (crownRx * 2 - 4));
      const fy = crownTop + 3 + Math.floor(hash2(s * 29 + i, s2 * 31 + i * 5) * Math.max(1, crownBot - crownTop - 5));
      const ex = (fx - cx) / (crownRx - 1);
      const ey = (fy - midY) / halfH;
      if (ex * ex + ey * ey > 1) continue;               // fuera de la copa: no flota
      const kind = kinds[pick(hash2(s * 7 + i, s2 * 11 + i * 3), 3)];
      if (kind === PAL.fruitRed) {
        px(x, fx, fy, 2, 2, kind);
        px(x, fx, fy, 1, 1, PAL.fruitShine);
      } else {
        px(x, fx, fy, 1, 1, kind);
      }
      placed++;
    }
  }

  if (rNest < 0.05 && age !== 0 && !twist) {
    // nido: montoncito marrón con 2 huevos claros, dentro de la copa
    const nx = cx + 3;
    const ny = variant === 2 ? cy - 5 : cy + 1;
    const inCrown = variant !== 2 ||
      ((nx + 2 - cx) / (crownRx - 1)) ** 2 + ((ny - (crownTop + 4)) / Math.max(2, (crownBot - crownTop) * 0.5)) ** 2 <= 1;
    if (inCrown) {
      px(x, nx, ny, 5, 2, PAL.nestBrown);
      px(x, nx, ny + 2, 5, 1, PAL.nestDark);
      px(x, nx + 1, ny, 1, 1, PAL.eggShell);
      px(x, nx + 3, ny + 1, 1, 1, PAL.eggShell);
    }
  }

  if (rBird < 0.02 && !twist) {
    // pájaro diminuto 2×2 con pico, posado SOBRE la punta de la copa
    // (offset por variante: la punta real de follaje cambia de altura)
    const bx = cx - 1 + (variant === 1 ? 3 : 0);
    const by = crownTop + (variant === 0 ? 0 : variant === 1 ? 2 : -2);
    px(x, bx, by, 2, 2, PAL.birdBody);
    px(x, bx - 1, by + (rBird < 0.015 ? 0 : 1), 1, 1, PAL.birdBeak);
  }

  if (rLeaf < 0.65) {
    // hojas colgando: 1px verde claro separado de la copa
    px(x, cx - 3 + Math.floor(rLeaf * 8), crownBot + 2, 1, 1, PAL.leafHang);
    if (rLeaf > 0.5) px(x, cx - crownRx - 2, cy + 1, 1, 1, PAL.leafHang);
  }

  baseDebris(x, cx, px0, py0, forest, s, s2, age === 2);
}

// ---------------- pino ('p') ----------------

function paintPine(x: Ctx, tx: number, ty: number, mapId: string, nb: NeighborFn): void {
  // ty=0: sin margen superior en el canvas de suelo → árbol 2px más abajo
  const px0 = tx * 16, py0 = ty * 16 + (ty === 0 ? 2 : 0);
  const forest = isForest(mapId);
  const s = tx * 3 + 1, s2 = ty * 5 + 7;

  const { age, variant, reach } = pinePlan(tx, ty, nb);
  const leanX = leanOf(nb).lx;
  const twist = isTwisted(mapId, s, s2);

  const tUp = isTree(nb(0, -1)), tL = isTree(nb(-1, 0)), tR = isTree(nb(1, 0));

  const maxHw = (variant === 0 ? 6 : variant === 2 ? 9 : 7)
    + (age === 2 ? 1 : 0) - (age === 0 ? 2 : 0);         // joven esbelto · anciano ancho
  const fe = variant === 2 ? 4 : age === 0 ? 4 : 5;      // pisos más marcados en el abeto
  const cx = px0 + 7 + leanX;
  const skew = twist ? (h2(s * 107 + 3, s2 * 109 + 1) < 0.5 ? -2 : 2) : 0;

  // copas fundidas sin seams: extensión hacia vecinos pino
  const padL = tL ? 2 : 0, padR = tR ? 2 : 0;

  groundShadow(x, px0 + 7, py0 + 14); // en la base, desplazada abajo-izq
  // sombra sobre camino antes de la copa (el follaje la recorta donde cuelga)
  pathShade(x, px0, py0, nb, hash2(s * 53 + 7, s2 * 43 + 11));
  // si el vecino de arriba también es árbol, el tronco continúa hacia su base
  trunkPine(x, px0 + 7, py0, tUp ? py0 - 16 : py0 + 4);
  pineCone(x, cx, py0, reach, maxHw, fe, s + s2, padL, padR, variant === 2, skew, PINE_DEEP2);

  const topY = py0 - reach;
  const botY = py0 + 3;
  const H = botY - topY;

  if (variant === 1) {
    // doble punta: aguja secundaria que supera la principal (con la curva del torcido)
    const scx = cx + Math.round((skew * (H - 11)) / H);
    const syBase = topY + 8;
    const syTop = topY - 3;
    for (let y = syBase; y >= syTop; y--) {
      const t = (syBase - y) / (syBase - syTop);
      const hw = Math.round(2 * (1 - t));
      px(x, scx + 2 - hw, y, hw * 2 + 1, 1, PAL.pineDark);
    }
    px(x, scx + 2, syTop, 1, 1, PAL.pineLight);
  } else {
    px(x, cx - 1, topY + 1, 1, 1, PAL.pineLight);        // repisa iluminada junto a la punta
  }

  if (twist) {
    // dedos muertos de 1px colgando de los pisos del cono
    const nf = 2 + pick(h2(s * 7 + 31, s2 * 11 + 37), 2);
    for (let i = 0; i < nf; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const y = topY + 3 + Math.floor(h2(s * 13 + i * 7, s2 * 17 + i * 3) * Math.max(2, H * 0.6));
      const t = (y - topY) / H;
      const edge = Math.max(1, Math.round(1 + (maxHw - 1) * Math.pow(t, 0.85)));
      const cxx = cx + Math.round((skew * (botY - y)) / H);
      const fx = cxx + side * (edge + 1);
      const len = 2 + Math.floor(h2(s * 19 + i, s2 * 23 + i * 5) * 3);
      for (let d = 0; d < len; d++) {
        px(x, fx + side * d, y + Math.round(d * 0.5), 1, 1, PAL.trunkDeep);
      }
    }
    // cara sugerida: 2 nudos oscuros de 2px en la copa baja
    const ey = py0 - Math.round(reach * 0.35);
    const ecx = cx + Math.round((skew * (botY - ey)) / H);
    px(x, ecx - 3, ey, 2, 1, PINE_EYE);
    px(x, ecx + 1, ey, 2, 1, PINE_EYE);
  }

  const rBird = hash2(s * 19 + 4, s2 * 29 + 8);
  const rLeaf = hash2(s * 23 + 6, s2 * 13 + 5);

  if (rBird < 0.02 && !twist) {
    // pájaro posado sobre la punta del pino (cuerpo pegado a la aguja)
    const bx = cx - 1;
    const by = topY - 2;
    px(x, bx, by, 2, 2, PAL.birdBody);
    px(x, bx - 1, by + (rBird < 0.015 ? 0 : 1), 1, 1, PAL.birdBeak);
  }

  if (rLeaf < 0.5) {
    // aguja colgando despegada del borde de un piso
    px(x, cx - maxHw - 1, py0 - Math.round(reach * 0.45), 1, 1, PAL.pineLight);
  }

  baseDebris(x, cx, px0, py0, forest, s, s2, age === 2);
}

// ---------------- contrato con sprites.ts ----------------

/**
 * Pinta un tile alto (árbol) en el canvas de suelo.
 * `at(dx,dy)` devuelve el char vecino; si falta, se asume '.', lo que
 * produce un ejemplar aislado (comportamiento seguro por defecto).
 */
export function paintTall(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, at?: NeighborFn,
): void {
  const nb: NeighborFn = at ?? (() => '.');
  if (ch === 't') paintCoposo(x, tx, ty, mapId, nb);
  else if (ch === 'p') paintPine(x, tx, ty, mapId, nb);
}

// ---------------- capa animada (R4-A6 + R5-O5 + R8-9) ----------------
// R5-O5 · VIEW_W/VIEW_H/ZOOM ahora viven en consts.ts (que no importa nada:
// el ciclo era engine → render → world, y consts está FUERA del ciclo).

const T = 16;                    // TILE

/**
 * CAPA ANIMADA — copas en movimiento (R4-A6 → R5-O5 → R8-9).
 * render.ts la llama justo tras waterOverlay, MISMO convenio:
 *  - camX/camY: g.camX/g.camY redondeados (px de pantalla).
 *  - mapId: elige tonos de copa (bosque vs valle) y densidad de hojas.
 *  - t: g.globalT (segundos).
 *  - at ABSOLUTO: at(tx,ty) = char del tile (tx,ty) del mapa.
 *
 * Por árbol visible dibuja: banda de CIMA que se mece + ramas laterales
 * con retardo de fase + 2-3 hebras de punta (+ hoja suelta ocasional),
 * todo anclado a la MISMA geometría que el prerrender (coposoPlan/
 * pinePlan + leanOf) para nacer pegado a la copa. Vaivén determinista:
 * fase/frecuencia por hash2(tx,ty), onda espacial lenta por posición,
 * ráfagas por weatherWindAt/IndexAt (solo lectura).
 *
 * R5-O5: snapshot en Uint8Array (1 lectura de at por tile y frame),
 * hebras prerrenderizadas (1 drawImage por hebra), culling estricto al
 * viewport y early-out si el bloque visible no contiene árboles.
 */
// ============================================================
// R5-O5 · SNAPSHOT DE TILES VISIBLES + HEBRAS HORNEADAS
// ============================================================

let snap = new Uint8Array(0);            // charcodes del bloque visible + borde
let snapW = 0, snapX0 = 0, snapY0 = 0;   // geometría de la snapshot del frame

/** Vecino ABSOLUTO leído de la snapshot del frame (cero closures por árbol). */
function snapNb(tx: number, ty: number): string {
  return String.fromCharCode(snap[(ty - snapY0) * snapW + (tx - snapX0)]);
}

// — hebras de copa horneadas: (par de tonos) × (vaivén −8..8) × (largo 2..3) —
// R8-9: STRAND_HI 5→8 (la cima llega a ±6-7 px en racha) → 3×17×2 = 102
// mini-canvas de 17×4, creación PEREZOSA (solo los pares/largos que salen
// en el mapa). Impacto de memoria: +16 KB de bitmap en el peor caso vs
// R5 (66×11×4); compensado sin stamps por edad (la edad solo escala el
// índice de vaivén) y manteniendo 2 largos como en R5.
const STRAND_HI = 8;                     // vaivén máximo por lado (amp < 9)
const STRAND_SW = STRAND_HI * 2 + 1;     // 17 índices de vaivén
const strandStamps: (HTMLCanvasElement | null)[] = new Array(3 * STRAND_SW * 2).fill(null);

/** Mini-lámina de 1 hebra (17×4): px d en x = 8 + round(sway·(len−d)/len). */
function getStrand(pair: number, swayI: number, lenI: number): HTMLCanvasElement {
  const idx = (pair * STRAND_SW + swayI) * 2 + lenI;
  const hit = strandStamps[idx];
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = STRAND_SW; cv.height = 4;
  const c = cv.getContext('2d') as CanvasRenderingContext2D;
  const sway = swayI - STRAND_HI;
  const len = 2 + lenI;
  const hi = pair === 0 ? PAL.copaLightL : pair === 1 ? PAL.copaLightB : PAL.pineLight;
  const lo = pair === 0 ? PAL.copaMidL : pair === 1 ? PAL.copaMidB : PAL.pineMid;
  for (let d = 0; d < len; d++) {
    px(c, STRAND_HI + Math.round((sway * (len - d)) / len), d, 1, 1, d === 0 ? hi : lo);
  }
  strandStamps[idx] = cv;
  return cv;
}

// ============================================================
// R8-9 · VIENTO VIVO (EPIC 5.4) — fase por posición + onda espacial,
// ráfagas del clima, ramas con retardo de fase y hojas sueltas.
// Todo O(árboles visibles) y CERO allocations por frame (scratch).
// ============================================================

const TAU = Math.PI * 2;
const WIND_NORM = 26;            // weatherWindAt devuelve ±26 px/s (px mundo 1×)
const LEAF_DUR = 1.2;            // segundos de caída de la hoja suelta
const WAVE_K = 0.45;             // onda espacial: rad/tile → λ ≈ 14 tiles
const WAVE_W = 0.55;             // onda espacial: rad/s → cresta a ~1.2 tiles/s

/** Viento/índice del frame memoizado a 1 entrada (1 cálculo real por frame:
 *  render.ts llama drawTreeCanopy una vez con (mapId, globalT) constantes). */
let wvMap = '', wvT = -1, wvWind = 0, wvIdx = 0.5;
function windField(mapId: string, t: number): void {
  if (mapId === wvMap && t === wvT) return;
  wvMap = mapId; wvT = t;
  wvWind = weatherWindAt(mapId, t);      // -26..26 px/s · racha-calma 55-80 s
  wvIdx = weatherIndexAt(mapId, t);      // 0..1 · período 90-150 s
}

export function drawTreeCanopy(
  x: Ctx, camX: number, camY: number, mapId: string, t: number,
  at?: (tx: number, ty: number) => string,
): void {
  if (!at) return;                                       // sin acceso al mapa: nada que animar
  const gx = Math.floor(camX / Z), gy = Math.floor(camY / Z);
  const viewW = VIEW_W / Z, viewH = VIEW_H / Z;          // ventana visible en px de mundo
  // R5-O5 · culling: solo tiles cuyo rect toca la pantalla (margen ≤ 1 tile;
  // las copas suben ≤ 29px, pero siempre DENTRO de la fila que ya se recorre)
  const vx0 = Math.floor(gx / T), vx1 = Math.ceil((gx + viewW) / T);
  const vy0 = Math.floor(gy / T), vy1 = Math.ceil((gy + viewH) / T);

  // R5-O5 · snapshot del bloque visible (+borde de 1 tile para vecinos):
  // UNA llamada a at() por tile y frame (antes: hasta 11 por árbol).
  const w = vx1 - vx0 + 3, h = vy1 - vy0 + 3;
  if (snap.length < w * h) snap = new Uint8Array(w * h); // solo crece (raro)
  snapW = w; snapX0 = vx0 - 1; snapY0 = vy0 - 1;
  let hasTree = false;
  for (let r = 0; r < h; r++) {
    const ty = snapY0 + r, rowBase = r * w;
    for (let c = 0; c < w; c++) {
      const code = at(snapX0 + c, ty).charCodeAt(0);
      snap[rowBase + c] = code;
      if (code === 116 || code === 112) hasTree = true;  // 't' · 'p'
    }
  }
  if (!hasTree) return; // early-out: ni un árbol en el viewport

  // R8-9 · ráfagas (solo-lectura de weather.ts): |viento| (racha-calma,
  // 55-80 s) escala la amplitud ×1..×1.75 con transición suave por
  // construcción (senos superpuestos) y su SIGNO empuja la copa hacia
  // donde sopla el viento vivo; el índice de clima (90-150 s) infla la
  // amplitud base de forma lenta. Todo continuo: sin saltos ni pops.
  windField(mapId, t);
  const aw = wvWind < 0 ? -wvWind : wvWind;              // |viento| px/s
  const gustMult = 1 + 0.7 * (aw > WIND_NORM ? 1 : aw / WIND_NORM);
  const gustPush = (wvWind / WIND_NORM) * 0.4;           // sesgo direccional vivo
  const swell = 0.88 + 0.22 * wvIdx;                     // inflado lento (índice)
  const q = perfQuality();                               // 0 alta · 1 media · 2 baja
  // hojas sueltas: densidad por mapa (bosque 3% · valle 1.5%), repartidas en
  // 3 turnos de 4 s (nunca todas a la vez) → ~0-2 simultáneas en pantalla;
  // la mitad en calidad media y 0 en calidad baja (perfQuality, solo lectura)
  const leafP = q === 2 ? 0 : (mapId === 'bosque' ? 0.03 : 0.015) * (q === 1 ? 0.5 : 1);
  const leafSlot = Math.floor(t * 0.25) % 3;             // turno activo de hojas

  const forest = isForest(mapId);
  const nb: NeighborFn = snapNb; // vecindad desde la snapshot (misma función)
  x.save();
  x.translate(-gx * Z, -gy * Z);                         // coordenadas de mundo escaladas ×ZOOM
  x.scale(Z, Z);
  for (let r = 1; r < h - 1; r++) {                      // solo tiles que tocan la pantalla
    const ty = snapY0 + r, rowBase = r * w;
    for (let c = 1; c < w - 1; c++) {
      const idx = rowBase + c;
      const code = snap[idx];
      if (code !== 116 && code !== 112) continue;        // 't' · 'p'
      const tx = snapX0 + c;
      const py0 = ty * T + (ty === 0 ? 2 : 0);
      const s = tx * 3 + 1, s2 = ty * 5 + 7;

      // geometría de la copa (MISMA que el prerrender). Los números se
      // copian YA: PLAN/LEAN son singletons de módulo reutilizados por tile.
      const lean = leanOf(nb);
      let age: number, variant: number, reach: number;
      let cxT: number, crownTop: number, crownHalf: number;
      let tipX: number, tipY: number, pair: number;
      if (code === 116) {
        const plan = coposoPlan(tx, ty, nb);
        age = plan.age; variant = plan.variant; reach = plan.reach;
        cxT = tx * T + 7 + lean.lx;
        crownTop = py0 - reach + lean.ly;
        crownHalf = Math.round(reach / 2) + 1 + (age === 2 ? 1 : 0); // crownRx
        tipX = cxT + (variant === 1 ? 2 : 0);
        tipY = crownTop + (variant === 1 ? 3 : 0);
        pair = forest ? 1 : 0;
      } else {
        const plan = pinePlan(tx, ty, nb);
        age = plan.age; variant = plan.variant; reach = plan.reach;
        cxT = tx * T + 7 + lean.lx;
        crownTop = py0 - reach;
        crownHalf = (variant === 0 ? 6 : variant === 2 ? 9 : 7)  // mismo maxHw
          + (age === 2 ? 1 : 0) - (age === 0 ? 2 : 0);           // que paintPine
        tipX = cxT + (variant === 1 ? 2 : 0);
        tipY = crownTop + (variant === 1 ? 0 : 1);
        pair = 2;
      }
      const twist = isTwisted(mapId, s, s2);

      // — fase y frecuencia por hash (vecinos NUNCA en fase) —
      const ph = h2(s * 71 + 13, s2 * 89 + 17) * TAU;
      const fq = 1.25 + h2(s * 13 + 3, s2 * 7 + 11) * 0.8;   // 1.25-2.05 rad/s
      // coherencia hierba→copa: el reposo se peina con el campo de flujo
      // del prado (MISMA windDir que los mechones de grass.ts, muestreada
      // en la base del tronco) y la amplitud sube donde el campo es
      // horizontal (|cos|): prado y copas respiran en la misma dirección.
      const wa = windDir(tx * T + 8, ty * T + 8);
      const ca = Math.cos(wa);
      const gBias = octDX(wa) * 0.32;                        // reposo peinado
      const gAmp = 0.88 + 0.24 * (ca < 0 ? -ca : ca);
      // amplitud por edad/tamaño: cima ~±2 joven · ±3 medio · ±4 anciano
      // (antes: 1.4-3.2 plano sobre 2-3 hebras de 1px — casi invisible)
      const rA = h2(s * 17 + 9, s2 * 23 + 5);
      const amp = Math.min(7, (age === 0 ? 2.1 + rA * 0.4
        : age === 1 ? 2.7 + rA * 0.6
          : 3.3 + rA * 0.7) * swell * gustMult * gAmp);

      // — señal del TRONCO: aleteo propio (hash+frecuencia+armónico) +
      //   onda espacial lenta que cruza el mapa + sesgos de reposo —
      const flut = (Math.sin(t * fq + ph)
        + 0.33 * Math.sin(t * fq * 1.73 + ph * 1.7)) * 0.75; // |flut| ≤ 1
      const wave = Math.sin((tx + ty * 0.6) * WAVE_K - t * WAVE_W);
      let bias = gBias + gustPush;
      if (bias > 1) bias = 1; else if (bias < -1) bias = -1;
      const sig = 0.6 * flut + 0.28 * wave + 0.12 * bias;    // |sig| ≤ 1
      const swayR = Math.round(sig * amp);                   // cima del tronco

      // — RAMAS LATERALES: misma frecuencia y onda, FASE RETRASADA
      //   (0.55-1.05 rad) → látigo orgánico, nunca rígido —
      const lag = 0.55 + h2(s * 37 + 5, s2 * 31 + 3) * 0.5;
      const brFlut = (Math.sin(t * fq + ph - lag)
        + 0.33 * Math.sin(t * fq * 1.73 + ph * 1.7 - lag * 1.3)) * 0.75;
      const brSway = (0.6 * brFlut + 0.28 * wave + 0.12 * bias) * amp * 0.95;
      const extR = brSway >= 0.7 ? Math.round(brSway) : 0;   // rama dcha asoma
      const extL = brSway <= -0.7 ? Math.round(-brSway) : 0; // rama izqda asoma

      const cDark = pair === 2 ? PAL.pineDark : pair === 1 ? PAL.copaDeepB : PAL.copaDeepL;
      const cMid = pair === 2 ? PAL.pineMid : pair === 1 ? PAL.copaMidB : PAL.copaMidL;
      const cLight = pair === 2 ? PAL.pineLight : pair === 1 ? PAL.copaLightB : PAL.copaLightL;

      // — CIMA QUE SE MECE: banda superior de copa desplazada por el vaivén.
      //   El prerrender queda quieto: la banda (tonos de copa) se desliza
      //   sobre la silueta y asoma a un lado y a otro = copa que rueda.
      //   Se omite si hay pájaro posado en la punta (no cruzarlo).
      const rBird = hash2(s * 19 + 4, s2 * 29 + 8);
      if (rBird >= 0.02 || code === 112) {
        const half = code === 116 ? (age === 0 ? 2 : 3) : (age === 0 ? 1 : 2);
        let ridge = swayR;
        if (ridge > 6) ridge = 6; else if (ridge < -6) ridge = -6;
        const ry2 = tipY + (code === 116 && variant === 2 ? 0 : 1);
        x.fillStyle = cDark;
        x.fillRect(tipX - half + ridge, ry2, half * 2 + 1, 1);
        px(x, tipX - half + ridge, ry2, 1, 1, cLight);       // luna arriba-izq
      }

      // — ramas que asoman y se recogen en el borde de la copa (la base
      //   queda DENTRO de la copa: solo el avance asoma a la silueta).
      //   Calidad baja las omite; torcidos = muertos: no brotan ramas —
      if (q < 2 && !twist && (extR > 0 || extL > 0)) {
        const wLen = 3 + pick(h2(s * 41 + 7, s2 * 43 + 9), 2);         // 3-4 px
        const chH = code === 116 ? Math.round(reach * 0.9) : reach + 3;
        const hOff = h2(s * 47 + 1, s2 * 53 + 3);
        if (extR > 0) {
          const wy = crownTop + 2 + Math.round((chH - 4) * (0.3 + hOff * 0.35));
          // pino: halfwidth real a esa altura (mismo perfil que pineCone)
          const hw = pair === 2
            ? Math.max(1, Math.round(1 + (crownHalf - 1) * Math.pow((wy - crownTop) / chH, 0.85)))
            : crownHalf;
          x.fillStyle = cDark;
          x.fillRect(cxT + hw - wLen + 1, wy, wLen + extR, 1);
          px(x, cxT + hw + extR, wy, 1, 1, cMid);
        }
        if (extL > 0) {
          const wy = crownTop + 2 + Math.round((chH - 4) * (0.42 + hOff * 0.35));
          const hw = pair === 2
            ? Math.max(1, Math.round(1 + (crownHalf - 1) * Math.pow((wy - crownTop) / chH, 0.85)))
            : crownHalf;
          x.fillStyle = cDark;
          x.fillRect(cxT - hw - extL, wy, wLen + extL, 1);
          px(x, cxT - hw - extL, wy, 1, 1, cMid);
        }
      }

      // — hebras de la punta (R5-O5): 1 drawImage por hebra, con el MISMO
      //   vaivén del tronco y recorrido completo ±8 en el stamp —
      const swayI = Math.max(0, Math.min(STRAND_SW - 1, swayR + STRAND_HI));
      const strands = 2 + pick(h2(s * 29 + 1, s2 * 31 + 7), 2); // 2-3 hebras
      for (let i = 0; i < strands; i++) {
        const bx = tipX + Math.floor(h2(s * 37 + i * 3, s2 * 41 + i) * 7) - 3;
        const lenI = pick(h2(s * 43 + i, s2 * 47 + i * 5), 2);
        x.drawImage(getStrand(pair, swayI, lenI), bx - STRAND_HI, tipY);
      }

      // — HOJA SUELTA (hash+t, determinista): copas maduras sueltan 1 hoja
      //   cada 14-26 s (reparto en 3 turnos de 4 s); cae 10-20 px con
      //   vaivén de tumbo y deriva con el viento vivo. En pantalla:
      //   ~0-2 simultáneas (leafP + turno).
      if (leafP > 0 && age >= 1 && !twist
        && h2(s * 151 + 3, s2 * 157 + 5) < leafP
        && pick(h2(s * 241 + 1, s2 * 251 + 7), 3) === leafSlot) {
        const cyc = 14 + h2(s * 163 + 7, s2 * 167 + 9) * 12;        // 14-26 s
        const lt = (t + h2(s * 173 + 11, s2 * 179 + 13) * cyc) % cyc;
        if (lt < LEAF_DUR) {
          const u = lt / LEAF_DUR;                                   // 0..1 caída
          const side = h2(s * 181 + 3, s2 * 191 + 7) < 0.5 ? -1 : 1;
          const sy0 = crownTop + Math.round(reach * (0.4 + h2(s * 199 + 1, s2 * 211 + 9) * 0.25));
          // ancho real de copa a la altura de salida (pino: perfil de cono)
          const tL = Math.min(1, Math.max(0, (sy0 - crownTop) / (reach + 3)));
          const hwL = pair === 2
            ? Math.max(1, Math.round(1 + (crownHalf - 1) * Math.pow(tL, 0.85)))
            : crownHalf;
          const sx0 = cxT + side * Math.max(1, Math.round(hwL * (0.5 + h2(s * 193 + 5, s2 * 197 + 3) * 0.5)));
          const fall = 10 + h2(s * 223 + 5, s2 * 227 + 1) * 6 + reach * 0.2;
          const lyf = sy0 + Math.round(u * fall);
          const lxf = sx0 + Math.round(Math.sin(u * 5.1 + h2(s * 229 + 7, s2 * 233 + 5) * 6.28) * 1.5
            + (wvWind / WIND_NORM) * u * 2.5);
          px(x, lxf, lyf, 1, 1, PAL.leafHang);
          if (((u * 7) | 0) % 2 === 0) {                             // tumbo intermitente
            px(x, lxf, lyf - 1, 1, 1, forest ? LEAF_FALL_B : LEAF_FALL_L);
          }
        }
      }
    }
  }
  x.restore();
}
