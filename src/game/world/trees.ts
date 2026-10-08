// ============================================================
// ECOS DE AELTHAR — Árboles altos (módulo world)
// Casos: 't' árbol coposo · 'p' pino (drawTallTile)
// Contrato: paintTall llamada por el despachador drawTallTile.
//
// R1-A5 · Árboles nuevos:
//  · Altura 1×2 tiles visuales: la copa sube 24-30px por encima de
//    la fila py0 (prerrender estático, t=0; el recorte superior del
//    canvas solo afecta al borde del mapa, como antes).
//  · Tronco con curvatura leve y veta vertical, raíces abiertas.
//  · Coposo: 3 variantes por hash (redondo, doble copa, llorón con
//    ramas caídas), copa en 3 masas superpuestas con 3 tonos, borde
//    en escalones con "mordiscos" donde asoma el cielo/hierba.
//  · Pino: 3 variantes (esbelto, doble punta, abeto ancho), pisos
//    dentados, tronco visible abajo; vecinos vía at() para fundir
//    copas sin seams verticales y continuar el tronco.
//  · Sombra elíptica en la suelo (14×5, abajo-izquierda) y franjas
//    translúcidas de copa sobre caminos adyacentes ('=').
//  · Vida: frutos/flores, nido con huevos, pájaro, hojas colgando.
//  · Fila 0 (ty=0): el prerrender no tiene margen superior, así que el
//    árbol se dibuja desplazado 2px hacia abajo para no perder copa.
// ============================================================

import { hash2, px, PAL, isForest, pick, type NeighborFn } from './palette';

type Ctx = CanvasRenderingContext2D;

const isTree = (ch: string | undefined): boolean => ch === 't' || ch === 'p';

// ---------------- primitivas ----------------

/**
 * Masa ovalada de copa con borde en escalones. Los "mordiscos"
 * (huecos de 2px donde el jitter lo decide) dejan asomar el fondo
 * entre masas; los salientes dan la silueta irregular.
 * padL/padR extienden la masa hacia vecinos árbol (copas fundidas).
 */
function lobe(
  x: Ctx, cx: number, cy: number, rx: number, ry: number,
  col: string, seed: number, bite = 0, padL = 0, padR = 0,
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
    if (hl + hr > 0) x.fillRect(cx - hl, cy + dy, hl + hr, 1);
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
 * Tronco coposo: segmentos de 3px con curvatura leve (seno), veta
 * oscura al lado del sol y brillo lateral arriba; ensanche y raíces
 * que se abren 2-3px a cada lado en la base.
 */
function trunkCoposo(
  x: Ctx, cx: number, py0: number, topY: number,
  bend: number, shortBase: boolean,
): void {
  const baseY = shortBase ? py0 + 9 : py0 + 14;          // vecino abajo árbol: tronco corto
  for (let y = topY; y < baseY; y += 3) {
    const h = Math.min(3, baseY - y);
    const t = (y + h - topY) / Math.max(1, baseY - topY); // 0 arriba → 1 abajo
    const off = Math.round(Math.sin(t * Math.PI) * bend);
    px(x, cx + off - 1, y, 3, h, PAL.trunkMid);
    px(x, cx + off + 1, y, 1, h, PAL.trunkDeep);         // veta vertical oscura
    if (t < 0.55) px(x, cx + off - 1, y, 1, h, PAL.trunkHi);
  }
  px(x, cx - 3, baseY - 3, 7, 3, PAL.trunkMid);          // ensanche de la base
  px(x, cx - 3, baseY - 1, 7, 1, PAL.trunkDeep);         // sombra al pie
  if (!shortBase) {
    px(x, cx - 5, baseY - 2, 2, 2, PAL.trunkMid);        // raíces abiertas
    px(x, cx + 4, baseY - 2, 2, 2, PAL.trunkMid);
    px(x, cx - 6, baseY - 1, 2, 1, PAL.rootSoil);
    px(x, cx + 5, baseY - 1, 2, 1, PAL.rootSoil);
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
 */
function pineCone(
  x: Ctx, cx: number, py0: number, reach: number,
  maxHw: number, fe: number, seed: number,
  padL: number, padR: number, wide: boolean,
): void {
  const topY = py0 - reach;
  const botY = py0 + 3;
  const H = botY - topY;
  const hwAt = (y: number): number => {
    const t = (y - topY) / H;                            // 0 punta → 1 base
    let hw = Math.max(1, Math.round(1 + (maxHw - 1) * Math.pow(t, 0.85)));
    if (y % fe === 0 && y < botY - 1) hw -= wide ? 2 : 1; // muesca de piso
    if (wide && y >= botY - 1) hw += 1;                   // falda del abeto
    return hw;
  };
  x.fillStyle = PAL.pineDark;
  for (let y = topY; y <= botY; y++) {
    const hw = hwAt(y);
    const jL = hash2(seed * 31 + y, 41);
    const jR = hash2(seed * 47 + y, 43);
    const hl = Math.max(0, hw + padL + (jL < 0.3 ? 1 : 0) - (jL > 0.8 ? 1 : 0));
    const hr = Math.max(0, hw + padR + (jR < 0.3 ? 1 : 0) - (jR > 0.8 ? 1 : 0));
    if (hl + hr > 0) x.fillRect(cx - hl, y, hl + hr, 1);
  }
  // tono medio: columna interior (deja ver el piso dentado en los bordes)
  x.fillStyle = PAL.pineMid;
  for (let y = topY + 2; y <= botY - 1; y++) {
    const hw = Math.max(1, Math.round(hwAt(y) * 0.45));
    x.fillRect(cx - hw, y, hw * 2, 1);
  }
  // luces en el repisa superior-izquierda de cada piso (sol arriba-izquierda)
  for (let y = topY + 2; y < botY - 2; y += fe) {
    const j = hash2(seed * 91 + y, 61);
    if (j < 0.85) px(x, cx - hwAt(y) - (j < 0.4 ? 1 : 0), y, 2, 1, PAL.pineLight);
    if (j > 0.72) px(x, cx + hwAt(y + 1) - 1, y + 1, 1, 1, PAL.pineLight);
  }
}

// ---------------- árbol coposo ('t') ----------------

function paintCoposo(x: Ctx, tx: number, ty: number, mapId: string, nb: NeighborFn): void {
  // ty=0: sin margen superior en el canvas de suelo → árbol 2px más abajo
  const px0 = tx * 16, py0 = ty * 16 + (ty === 0 ? 2 : 0);
  const forest = isForest(mapId);
  const s = tx * 3 + 1, s2 = ty * 5 + 7;                 // semillas (hash original)

  // vecindad: agrupar, variar altura, inclinar lejos del camino
  const nUp = nb(0, -1), nDown = nb(0, 1), nL = nb(-1, 0), nR = nb(1, 0);
  const tUp = isTree(nUp), tDown = isTree(nDown), tL = isTree(nL), tR = isTree(nR);

  let leanX = 0, leanY = 0;
  if (nR === '=' && nL !== '=') leanX = -2;              // camino a la derecha → copa a la izquierda
  else if (nL === '=' && nR !== '=') leanX = 2;
  if (nDown === '=') leanY = -1;
  else if (nUp === '=') leanY = 1;

  // altura: 20-28px sobre la fila; más alto en masa, más bajo aislado
  let reach = 24 + Math.floor(hash2(s * 9 + 2, s2 * 13 + 3) * 4);
  if (tUp) reach += 3;                                   // crece junto a otros árboles
  if (isTree(nb(-1, -1)) || isTree(nb(1, -1))) reach += 1;
  if (!tUp && !tDown && !tL && !tR) reach -= 2;          // ejemplar aislado
  reach = Math.min(28, Math.max(20, reach));
  if (nUp === 'p') reach = Math.min(reach, 20);          // no rebanar la copa del pino de arriba

  const variant = pick(hash2(s * 41 + 3, s2 * 37 + 9), 3); // 0 redondo · 1 doble copa · 2 llorón
  const rh = Math.round(reach / 2);
  const cx = px0 + 7 + leanX;
  const cy = py0 + 1 - rh + leanY;
  const crownTop = py0 - reach + leanY;
  const crownBot = variant === 2 ? cy + rh - 13 : py0 + 2 + leanY;
  const crownRx = rh + 1;

  const cDark = forest ? PAL.copaDeepB : PAL.copaDeepL;
  const cMid = forest ? PAL.copaMidB : PAL.copaMidL;
  const cLight = forest ? PAL.copaLightB : PAL.copaLightL;

  // solape con copas vecinas: la masa se extiende hacia el lado del vecino
  const padL = tL ? 2 : 0, padR = tR ? 2 : 0;
  const qL = Math.max(0, padL - 1), qR = Math.max(0, padR - 1);

  groundShadow(x, px0 + 7, py0 + 14); // en la base, desplazada abajo-izq
  // sombra sobre camino ANTES de la copa: el follaje la tapa donde cuelga
  pathShade(x, px0, py0, nb, hash2(s * 53 + 7, s2 * 43 + 11));
  trunkCoposo(
    x, px0 + 7, py0, crownBot - 2,
    leanX !== 0 ? Math.sign(leanX) : (hash2(s, s2 * 3) < 0.5 ? 1 : -1),
    tDown,
  );

  // ---- copa: 3 masas superpuestas · oscuro base, medio, luz arriba-izquierda ----
  if (variant === 0) {
    // redondo
    lobe(x, cx, cy + 6, rh - 3, rh - 5, cDark, s + 1, 0.04, qL, qR);
    lobe(x, cx - 5, cy - 2, 7, rh - 6, cMid, s + 2, 0.08, padL, qR);
    lobe(x, cx + 5, cy - 3, 7, rh - 6, cMid, s + 3, 0.08, qL, padR);
    lobe(x, cx, cy - 6, rh - 5, rh - 6, cMid, s + 4, 0.1, padL, padR);
    lobe(x, cx - 4, cy - 6, 5, Math.max(3, rh - 8), cLight, s + 5);
    // islotes separados de la silueta (1px despegados del borde real)
    px(x, cx - crownRx + 1, cy - 2, 1, 1, cMid);
    px(x, cx + crownRx - 3, cy + 1, 1, 1, cMid);
    px(x, cx + 3, cy - rh, 1, 1, cMid);
  } else if (variant === 1) {
    // doble copa: dos masas con nudo mordido entre ellas
    lobe(x, cx - 1, cy + 6, rh - 4, rh - 5, cDark, s + 1, 0.04, qL, qR);
    lobe(x, cx - 4, cy + 1, rh - 5, rh - 6, cMid, s + 2, 0.1, padL, qR);
    lobe(x, cx + 4, cy - 5, rh - 6, rh - 7, cMid, s + 3, 0.1, qL, padR);
    lobe(x, cx + 1, cy - 1, 4, 4, cMid, s + 6, 0.22, qL, qR);
    lobe(x, cx + 2, cy - 7, 4, Math.max(2, rh - 9), cLight, s + 5);
    lobe(x, cx - 7, cy - 3, 3, 3, cLight, s + 7);
    px(x, cx + crownRx - 4, cy - rh + 4, 1, 1, cMid);
    px(x, cx - crownRx + 2, cy + 3, 1, 1, cMid);
  } else {
    // llorón: copa alta y compacta + ramas caídas con punta clara
    lobe(x, cx, cy - 6, rh - 4, rh - 7, cDark, s + 1, 0.05, qL, qR);
    lobe(x, cx - 4, cy - 9, rh - 5, rh - 8, cMid, s + 2, 0.08, padL, qR);
    lobe(x, cx + 4, cy - 8, rh - 5, rh - 8, cMid, s + 3, 0.08, qL, padR);
    lobe(x, cx, cy - 11, rh - 6, Math.max(2, rh - 10), cMid, s + 4, 0.1, padL, padR);
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

  if (rFruit < 0.2) {
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

  if (rNest < 0.05) {
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

  if (rBird < 0.02) {
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
}

// ---------------- pino ('p') ----------------

function paintPine(x: Ctx, tx: number, ty: number, _mapId: string, nb: NeighborFn): void {
  // ty=0: sin margen superior en el canvas de suelo → árbol 2px más abajo
  const px0 = tx * 16, py0 = ty * 16 + (ty === 0 ? 2 : 0);
  const s = tx * 3 + 1, s2 = ty * 5 + 7;

  const nUp = nb(0, -1), nDown = nb(0, 1), nL = nb(-1, 0), nR = nb(1, 0);
  const tUp = isTree(nUp), tDown = isTree(nDown), tL = isTree(nL), tR = isTree(nR);

  let leanX = 0;
  if (nR === '=' && nL !== '=') leanX = -2;
  else if (nL === '=' && nR !== '=') leanX = 2;

  // altura: pinos interiores más altos; variantes con techos propios
  let reach = 24 + Math.floor(hash2(s * 9 + 2, s2 * 13 + 3) * 4);
  if (tUp) reach += 3;
  if (isTree(nb(-1, -1)) || isTree(nb(1, -1))) reach += 1;
  if (!tUp && !tDown && !tL && !tR) reach -= 2;
  const variant = pick(hash2(s * 41 + 3, s2 * 37 + 9), 3); // 0 esbelto · 1 doble punta · 2 abeto ancho
  if (variant === 0) reach += 1;
  if (variant === 1) reach = Math.min(reach, 26);        // deja sitio a la segunda punta
  if (variant === 2) reach = Math.min(reach, 28);
  reach = Math.min(28, Math.max(20, reach));
  if (nUp === 't') reach = Math.min(reach, 18);          // bajo un coposo: pino de sotobosque

  const maxHw = variant === 0 ? 6 : variant === 2 ? 9 : 7;
  const fe = variant === 2 ? 4 : 5;                      // pisos más marcados en el abeto
  const cx = px0 + 7 + leanX;

  // copas fundidas sin seams: extensión hacia vecinos pino
  const padL = tL ? 2 : 0, padR = tR ? 2 : 0;

  groundShadow(x, px0 + 7, py0 + 14); // en la base, desplazada abajo-izq
  // sombra sobre camino antes de la copa (el follaje la recorta donde cuelga)
  pathShade(x, px0, py0, nb, hash2(s * 53 + 7, s2 * 43 + 11));
  // si el vecino de arriba también es árbol, el tronco continúa hacia su base
  trunkPine(x, px0 + 7, py0, tUp ? py0 - 16 : py0 + 4);
  pineCone(x, cx, py0, reach, maxHw, fe, s + s2, padL, padR, variant === 2);

  const topY = py0 - reach;

  if (variant === 1) {
    // doble punta: aguja secundaria que supera la principal
    const syBase = topY + 8;
    const syTop = topY - 3;
    for (let y = syBase; y >= syTop; y--) {
      const t = (syBase - y) / (syBase - syTop);
      const hw = Math.round(2 * (1 - t));
      px(x, cx + 2 - hw, y, hw * 2 + 1, 1, PAL.pineDark);
    }
    px(x, cx + 2, syTop, 1, 1, PAL.pineLight);
  } else {
    px(x, cx - 1, topY + 1, 1, 1, PAL.pineLight);        // repisa iluminada junto a la punta
  }

  const rBird = hash2(s * 19 + 4, s2 * 29 + 8);
  const rLeaf = hash2(s * 23 + 6, s2 * 13 + 5);

  if (rBird < 0.02) {
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
