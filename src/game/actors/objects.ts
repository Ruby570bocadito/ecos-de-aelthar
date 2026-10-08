// ============================================================
// ECOS DE AELTHAR — Objetos pixel (módulo actors)
// Cofre, santuario, fragmento y wisp. Generación procedural
// 100 % entera (fillRect, cero gradientes), paleta alineada con
// world/palette.ts (PAL / PAL_PROP / LIGHT_PAL).
// ------------------------------------------------------------
// CONTRATO DE CONSUMO (R2-A9 — documentación para el integrador):
// · sprites.ts:53-58 registra: SPR['chest'] (cerrado), SPR['chest_open']
//   (abierto), SPR['sanctuary'], SPR['fragment'], SPR['wisp'].
// · render.ts:135-136 dibuja los cofres con getSpr('chest')/'chest_open'
//   (frame [0]) a 16*ZOOM × 14*ZOOM. El sprite ahora es 18×14: se recomienda
//   dibujar a 18*ZOOM de ancho (mismo ancla y alto) para pixel-perfect;
//   mientras no, drawImage lo comprime un ~11 % horizontal (aceptable).
// · render.ts:104-107 dibuja los ecos menores con getSpr('wisp')[fr] donde
//   fr = floor(globalT*3) % 2 → alterna frames 0 (verde) y 1 (ámbar).
//   Con 3 frames, cambiar a % getSpr('wisp').length activa el destello (2).
// · screens.ts:162-165 (getSprWisp) ya cicla TODOS los frames (% length).
// · SPR['sanctuary'] / SPR['fragment'] no tienen consumidor en el mundo
//   (world/props.ts v2 dibuja sus versiones grandes): quedan como sprite
//   base registrado para HUD/diálogo/uso futuro, 2 frames cada uno.
// ============================================================

import { mkCanvas, px, type Frames } from './util';
import { hash2 } from '../world/palette';

// Pinta con alpha momentáneo (evita repetir globalAlpha en cada mota/halo).
function A(
  x: CanvasRenderingContext2D,
  X: number, Y: number, W: number, H: number, C: string, a: number,
): void {
  x.globalAlpha = a;
  px(x, X, Y, W, H, C);
  x.globalAlpha = 1;
}

// ---------------- Cofre 18×14 (cerrado / abierto) ----------------
// Madera con vetas y tablones, herrajes 2 tonos, cerradura dorada con
// brillo, sombra interna bajo la tapa y (si hash) runas de gema tenues.
// Abierto: interior oscuro con brillo dorado tenue + tapa trasera alzada.

export function buildChest(): { closed: Frames; open: Frames } {
  const O = '#3a2414';   // contorno madera profunda
  const W = '#8a5a2b';   // madera base
  const W2 = '#6d4520';  // madera media (juntas y vetas)
  const W3 = '#4a2f16';  // madera honda (sombra interna / nudos)
  const WL = '#a5713a';  // madera iluminada
  const WH = '#b89058';  // fibra clara (luz de canto)
  const ID = '#3a3a48';  // hierro oscuro
  const IL = '#6a6a7a';  // hierro claro (2.º tono de herrajes)
  const RV = '#9aa4b4';  // remaches
  const G = '#f0c84a';   // oro (PAL.gold)
  const GH = '#fff3c0';  // brillo del oro
  const GD = '#b8842a';  // oro en sombra
  const GM = '#6e5218';  // oro apagado (reflejo interior)
  const CAV = '#1a0f06'; // interior oscuro
  const CAV2 = '#2a1a0c';// pared del fondo del interior
  const GEM = '#4ac8dc'; // runa de gema (runeDim, tenue)

  // runas de gema del frontal: 1 px tenue solo donde el hash lodecida
  const gemSpots: Array<[number, number]> = [[5, 7], [11, 7], [5, 10], [11, 10]];

  const mk = (open: boolean) => {
    const { c, x } = mkCanvas(18, 14);

    if (!open) {
      // ============ CERRADO: cúpula + cuerpo de tablones ============
      px(x, 5, 1, 8, 1, O);                       // cúspide de la tapa
      px(x, 3, 2, 2, 1, O); px(x, 13, 2, 2, 1, O); // hombros del domo
      px(x, 5, 2, 3, 1, WH); px(x, 8, 2, 5, 1, WL); // luz superior del domo
      px(x, 1, 3, 2, 1, O); px(x, 15, 3, 2, 1, O); // silueta domo ancho
      px(x, 3, 3, 4, 1, WH); px(x, 7, 3, 6, 1, WL);
      px(x, 13, 3, 2, 1, W2);                     // caída a sombra (derecha)
      px(x, 1, 4, 1, 8, O); px(x, 16, 4, 1, 8, O); // laterales silueta (hasta la base)
      px(x, 2, 4, 14, 1, W2);                     // junta de tablones (tapa)
      px(x, 2, 5, 3, 1, WH); px(x, 5, 5, 8, 1, WL); px(x, 13, 5, 3, 1, W2);
      px(x, 2, 6, 14, 1, W3);                     // SOMBRA INTERNA bajo la tapa
      // cuerpo: dos tablones horizontales con junta central
      px(x, 2, 7, 14, 2, W);                      // tablón superior
      px(x, 2, 9, 14, 1, W2);                     // junta de tablones (cuerpo)
      px(x, 2, 10, 14, 2, W);                     // tablón inferior
      px(x, 1, 12, 16, 1, O);                     // base
      A(x, 1, 13, 16, 1, '#000000', 0.25);        // sombra de apoyo en el suelo
      // vetas y nudos (deterministas, dentro de los tablones)
      px(x, 5, 7, 1, 1, W2); px(x, 12, 7, 1, 1, W2);
      px(x, 5, 8, 2, 1, W2); px(x, 12, 8, 1, 1, W2);
      px(x, 6, 10, 2, 1, W2); px(x, 10, 11, 1, 1, W2);
      px(x, 11, 10, 1, 1, W3);                    // nudo
      px(x, 2, 7, 1, 1, WL); px(x, 15, 10, 1, 1, WL); // cantos iluminados
      // herrajes: 2 bandas verticales a dos tonos (luz a la izquierda)
      px(x, 3, 3, 1, 9, IL); px(x, 4, 3, 1, 9, ID);
      px(x, 13, 3, 1, 9, IL); px(x, 14, 3, 1, 9, ID);
      px(x, 3, 4, 1, 1, RV); px(x, 13, 4, 1, 1, RV); // remaches
      px(x, 3, 10, 1, 1, RV); px(x, 13, 10, 1, 1, RV);
      // cerradura dorada con brillo
      px(x, 7, 6, 4, 1, G); px(x, 7, 7, 3, 1, G); px(x, 7, 8, 3, 1, G);
      px(x, 10, 7, 1, 2, GD); px(x, 7, 9, 4, 1, GD); // sombra de la placa
      px(x, 8, 7, 1, 2, ID);                      // ojo de la cerradura
      px(x, 7, 6, 1, 1, GH);                      // destello fijo
      A(x, 12, 5, 1, 1, GH, 0.75);                // brillo flotante
      // runas de gema tenues (solo si el hash decide; determinista)
      for (let i = 0; i < gemSpots.length; i++) {
        if (hash2(41 + i * 13, 67 + i * 7) < 0.28) {
          A(x, gemSpots[i][0], gemSpots[i][1], 1, 1, GEM, 0.8);
        }
      }
    } else {
      // ============ ABIERTO: tapa alzada + interior brillando ============
      // tapa trasera visible (cara interna iluminada por el eco)
      px(x, 4, 0, 10, 1, O);                      // borde superior alzado
      px(x, 3, 1, 1, 1, O); px(x, 14, 1, 1, 1, O);
      px(x, 4, 1, 10, 1, WL); px(x, 7, 1, 1, 1, W2); px(x, 10, 1, 1, 1, W2);
      px(x, 2, 2, 1, 1, O); px(x, 15, 2, 1, 1, O);
      px(x, 3, 2, 12, 1, WL); px(x, 7, 2, 1, 1, W2); px(x, 10, 2, 1, 1, W2);
      px(x, 1, 3, 2, 1, O); px(x, 15, 3, 2, 1, O);
      px(x, 3, 3, 12, 1, GM);                     // canto inferior con reflejo
      px(x, 4, 3, 1, 1, ID); px(x, 13, 3, 1, 1, ID); // bisagras
      // caja: interior oscuro con brillo tenue dorado
      px(x, 1, 4, 1, 4, O); px(x, 16, 4, 1, 4, O);
      px(x, 2, 4, 14, 1, CAV2);                   // pared del fondo (levemente alta)
      px(x, 2, 5, 14, 2, CAV);                    // vacío oscuro
      px(x, 3, 7, 12, 1, GM);                     // brillo tenue del fondo
      px(x, 5, 6, 1, 1, G); px(x, 10, 6, 1, 1, G); // destellos del tesoro
      px(x, 7, 7, 1, 1, G); px(x, 9, 7, 1, 1, GH);
      px(x, 1, 8, 1, 1, O); px(x, 16, 8, 1, 1, O); // flancos del borde
      px(x, 2, 8, 14, 1, W3);                     // SOMBRA INTERNA bajo el borde
      // frontal de la caja (tablones + herrajes + placa)
      px(x, 1, 9, 1, 3, O); px(x, 16, 9, 1, 3, O);
      px(x, 2, 9, 14, 1, W);
      px(x, 2, 10, 14, 1, W2);                    // junta de tablones
      px(x, 2, 11, 14, 1, W);
      px(x, 3, 9, 1, 3, IL); px(x, 4, 9, 1, 3, ID); // bandas cortas
      px(x, 13, 9, 1, 3, IL); px(x, 14, 9, 1, 3, ID);
      px(x, 5, 9, 1, 1, W2); px(x, 12, 11, 1, 1, W2); // vetas
      px(x, 1, 12, 16, 1, O);                     // base
      A(x, 1, 13, 16, 1, '#000000', 0.25);        // sombra de apoyo
      // cerradura dorada (ahora en el frontal bajo)
      px(x, 7, 9, 4, 1, G); px(x, 7, 10, 3, 1, G);
      px(x, 10, 10, 1, 1, GD); px(x, 7, 11, 4, 1, GD);
      px(x, 8, 10, 1, 1, ID);                     // ojo de la cerradura
      px(x, 7, 9, 1, 1, GH);                      // destello
    }
    return c;
  };
  return { closed: [mk(false)], open: [mk(true)] };
}

// ---------------- Santuario 20×32 (obelisco, 2 frames) ----------------
// Piedra azulada con grietas, runas cian que recorren el fuste (A arriba,
// B abajo), anillo flotante con 2 posiciones y base de losas con musgo.

export function buildSanctuary(): Frames {
  const SD = '#1c2438';  // silueta piedra honda
  const SS = '#5a6a8a';  // santStone
  const SL = '#7a8aac';  // santLight (luz desde la izquierda)
  const SH = '#42506c';  // santShade
  const CR = '#2c3450';  // grieta
  const RC = '#8ef0ff';  // runeCyan
  const RH = '#d4fbff';  // runeCyanHi
  const RD = '#4ac8dc';  // runeDim (estela de la runa)
  const MO = '#4f8a46';  // musgo
  const MO2 = '#3a6836'; // musgo oscuro

  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(20, 32);

    // —— anillo flotante (2 posiciones: alto y ancho / bajo y recogido) ——
    if (f === 0) {
      A(x, 6, 0, 7, 1, RH, 0.9);                 // arco superior ancho
      A(x, 5, 1, 1, 1, RC, 0.8); A(x, 13, 1, 1, 1, RC, 0.8);
      A(x, 7, 2, 5, 1, RC, 0.55);                // arco inferior (perspectiva)
      A(x, 4, 1, 1, 1, RH, 0.85);                // abalorio (izquierda)
      A(x, 9, 1, 2, 1, RH, 0.2);                 // halo tenue sobre la punta
    } else {
      A(x, 7, 1, 5, 1, RH, 0.9);                 // arco superior recogido
      A(x, 6, 1, 1, 1, RC, 0.8); A(x, 12, 1, 1, 1, RC, 0.8);
      A(x, 8, 2, 3, 1, RC, 0.55);                // arco inferior ceñido (no toca la punta)
      A(x, 12, 2, 1, 1, RH, 0.85);               // abalorio (derecha, baja con el anillo)
      A(x, 9, 2, 2, 1, RH, 0.2);
    }

    // —— punta luminosa + piramidón ——
    A(x, 9, 3, 2, 1, RH, f === 0 ? 0.95 : 0.6);  // punta que respira
    px(x, 8, 4, 1, 1, SS); px(x, 9, 4, 2, 1, SL); px(x, 11, 4, 1, 1, SH);
    px(x, 8, 5, 2, 1, SL); px(x, 10, 5, 2, 1, SH);

    // —— fuste escalonado (se estrecha hacia arriba) con caras luz/sombra ——
    // tramo alto 6 px (y6..y11): x7..x12
    px(x, 7, 6, 1, 6, SD); px(x, 8, 6, 1, 6, SL);
    px(x, 9, 6, 2, 6, SS); px(x, 11, 6, 1, 6, SH); px(x, 12, 6, 1, 6, SD);
    // tramo medio (y12..y18): x6..x13
    px(x, 6, 12, 1, 7, SD); px(x, 7, 12, 1, 7, SL);
    px(x, 8, 12, 4, 7, SS); px(x, 12, 12, 1, 7, SH); px(x, 13, 12, 1, 7, SD);
    // tramo bajo (y19..y24): x5..x14
    px(x, 5, 19, 1, 6, SD); px(x, 6, 19, 1, 6, SL);
    px(x, 7, 19, 6, 6, SS); px(x, 13, 19, 1, 6, SH); px(x, 14, 19, 1, 6, SD);

    // —— grietas (zigzag honda, fija) ——
    px(x, 10, 8, 1, 1, CR); px(x, 9, 9, 1, 1, CR); px(x, 10, 10, 1, 2, CR);
    px(x, 9, 12, 1, 1, CR);
    px(x, 8, 15, 1, 1, CR); px(x, 7, 16, 1, 2, CR); px(x, 8, 18, 1, 1, CR);
    px(x, 11, 20, 1, 1, CR); px(x, 12, 21, 1, 1, CR); px(x, 11, 22, 1, 2, CR);
    px(x, 10, 18, 1, 1, CR); px(x, 6, 22, 1, 1, CR);

    // —— runas cian que RECORREN el fuste: frame A arriba, frame B abajo ——
    const runeYs = [7, 12, 17, 22];
    for (let i = 0; i < 4; i++) {
      const bright = f === 0 ? i < 2 : i >= 2;   // banda brillante por frame
      const col = bright ? RC : RD;
      const a = bright ? 0.95 : 0.4;
      const ry = runeYs[i];
      if (i % 2 === 0) {
        A(x, 9, ry, 1, 2, col, a);               // barra vertical
        A(x, 10, ry + 1, 1, 1, col, a);          // tick lateral
      } else {
        A(x, 10, ry, 1, 2, col, a);
        A(x, 9, ry + 1, 1, 1, col, a);
      }
      if (bright) A(x, i % 2 === 0 ? 9 : 10, ry, 1, 1, RH, 0.9);
    }

    // —— cornisa ——
    px(x, 5, 25, 10, 1, SL);
    px(x, 5, 26, 6, 1, SS); px(x, 11, 26, 4, 1, SH);
    px(x, 5, 27, 10, 1, SH);

    // —— base de losas (3 piezas con juntas y musgo) ——
    px(x, 3, 28, 14, 1, SL);                     // cara superior iluminada
    px(x, 2, 29, 16, 1, SS);
    px(x, 2, 30, 16, 1, SH);
    px(x, 3, 31, 14, 1, SD);
    px(x, 7, 29, 1, 2, CR); px(x, 12, 29, 1, 2, CR); // juntas entre losas
    px(x, 1, 29, 1, 2, SH); px(x, 18, 29, 1, 2, SH); // losas laterales pequeñas
    // musgo en las juntas (siempre presente: refugio que abraza la piedra)
    px(x, 4, 28, 2, 1, MO); px(x, 14, 30, 2, 1, MO2);
    px(x, 6, 27, 1, 1, MO2);                     // musgo al pie del fuste

    // —— aura tenue de refugio (4 motas cian fijas) ——
    A(x, 5, 9, 1, 1, RC, 0.15); A(x, 14, 14, 1, 1, RC, 0.12);
    A(x, 5, 20, 1, 1, RC, 0.15); A(x, 4, 27, 1, 1, RC, 0.18);

    frames.push(c);
  }
  return frames;
}

// ---------------- Fragmento de eco 12×14 (2 frames) ----------------
// Losa rota flotante con grietas doradas brillantes, 2-3 esquirlas
// orbitando entre frames y aura tenue.

export function buildFragment(): Frames {
  const ST = '#5a5a6a';  // piedra base (identidad del prop grande)
  const SL = '#7a7a8a';  // cara iluminada
  const SD = '#4a4a58';  // cara en sombra
  const DP = '#3e3e50';  // filo honda
  const CG = '#ffe9a0';  // crackGold
  const CD = '#f0c84a';  // crackGoldDeep
  const CH = '#fffbe0';  // crackGoldHi (destello)

  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(12, 14);
    const b = f;                                 // bob de flotación 0/1 px

    // —— losa rota flotante (silueta irregular, esquirlones rotos) ——
    px(x, 4, 4 + b, 4, 1, SL);                   // cara superior iluminada
    px(x, 3, 5 + b, 1, 1, SL); px(x, 4, 5 + b, 4, 1, ST); px(x, 8, 5 + b, 1, 1, SD);
    px(x, 2, 6 + b, 1, 3, SL);                   // canto izquierdo (luz)
    px(x, 3, 6 + b, 5, 3, ST);                   // cuerpo
    px(x, 8, 6 + b, 2, 2, SD);                   // canto derecho (sombra)
    px(x, 3, 9 + b, 6, 1, SD);                   // panza
    px(x, 2, 10 + b, 7, 1, DP);                  // filo base
    px(x, 7, 10 + b, 1, 1, DP);                  // punta descoyuntada
    // mordiscos de rotura (vacíos en la silueta ya implícitos por bordes)

    // —— grietas DORADAS brillantes (la herida del eco) ——
    px(x, 6, 4 + b, 1, 2, CD);                   // tronco de la grieta
    px(x, 5, 6 + b, 1, 2, CD); px(x, 7, 6 + b, 1, 1, CD);
    px(x, 4, 8 + b, 1, 1, CD); px(x, 6, 8 + b, 1, 1, CD);
    px(x, 6, 5 + b, 1, 1, CG); px(x, 5, 7 + b, 1, 1, CG); // núcleo caliente
    A(x, 5, 6 + b, 1, 1, CH, 0.95);              // destello
    A(x, 7, 8 + b, 1, 1, CG, 0.7);               // reflejo secundario

    // —— 2-3 esquirlas orbitando (intercambian lado entre frames) ——
    if (f === 0) {
      px(x, 1, 4, 1, 1, SL); px(x, 1, 5, 1, 1, SD);        // esquirla alto-izq
      px(x, 10, 9, 2, 1, SD); px(x, 10, 9, 1, 1, SL);      // esquirla bajo-der
      A(x, 9, 2, 1, 1, ST, 0.8);                           // mota-piedra
    } else {
      px(x, 10, 4, 1, 1, SL); px(x, 10, 5, 1, 1, SD);      // alto-der
      px(x, 0, 9, 2, 1, SD); px(x, 1, 9, 1, 1, SL);        // bajo-izq
      A(x, 2, 2, 1, 1, ST, 0.8);
    }

    // —— aura tenue dorada ——
    A(x, 3, 3 - b, 1, 1, CG, 0.14); A(x, 8, 11 - b, 1, 1, CG, 0.12);
    A(x, f === 0 ? 1 : 9, 7, 1, 1, CD, 0.1);

    frames.push(c);
  }
  return frames;
}

// ---------------- Wisp 10×10 (3 frames: aparece, flota, destella) ----------------
// Corazón claro + halo + estela de motas. Tinte verde (eco de naturaleza)
// y ámbar ALTERNANDO por frame: vivos, no fantasmas tristes.
// Frame 0 = verde · frame 1 = ámbar · frame 2 = destello cálido.

export function buildWisp(): Frames {
  const WHITE = '#ffffff';
  const frames: Frames = [];

  // paleta por frame: [halo, halo interior, corazón, motas]
  const TINTS: Array<[string, string, string, string]> = [
    ['#8ee8b0', '#b8f4cc', '#f0fff6', '#a8ecd0'], // verde naturaleza
    ['#e8c878', '#f4e0a8', '#fff8e0', '#f0d890'], // ámbar cálido
    ['#f0e8c8', '#fff8dc', '#ffffff', '#fff3c0'], // destello cálido
  ];

  for (let f = 0; f < 3; f++) {
    const { c, x } = mkCanvas(10, 10);
    const [HALO, HI, CORE, MOTA] = TINTS[f];

    if (f === 0) {
      // —— aparece: núcleo pequeño, halo ancho y suave ——
      A(x, 2, 2, 6, 6, HALO, 0.22);
      A(x, 3, 3, 4, 4, HI, 0.4);
      px(x, 4, 4, 2, 2, CORE);
      px(x, 4, 4, 1, 1, WHITE);
      A(x, 1, 6, 1, 1, MOTA, 0.5); A(x, 7, 7, 1, 1, MOTA, 0.35);
      A(x, 3, 8, 1, 1, MOTA, 0.3);
    } else if (f === 1) {
      // —— flota: cuerpo lleno + estela que queda abajo ——
      A(x, 2, 2, 6, 6, HALO, 0.3);
      A(x, 3, 3, 4, 4, HI, 0.5);
      px(x, 4, 3, 2, 1, HI); px(x, 3, 4, 1, 2, HI); // ribete del corazón
      px(x, 4, 4, 2, 2, CORE);
      px(x, 4, 4, 1, 1, WHITE);
      A(x, 2, 7, 1, 1, MOTA, 0.55); A(x, 1, 8, 1, 1, MOTA, 0.35);
      A(x, 7, 5, 1, 1, MOTA, 0.4); A(x, 6, 8, 1, 1, MOTA, 0.25);
    } else {
      // —— destella: rayos en cruz + halo grande ——
      A(x, 1, 1, 8, 8, HALO, 0.22);
      A(x, 3, 3, 4, 4, HI, 0.65);
      px(x, 4, 4, 2, 2, WHITE);                     // corazón al máximo
      A(x, 4, 2, 2, 1, '#fffbe0', 0.85); A(x, 4, 7, 2, 1, '#fffbe0', 0.85);
      A(x, 2, 4, 1, 2, '#fffbe0', 0.85); A(x, 7, 4, 1, 2, '#fffbe0', 0.85);
      A(x, 1, 2, 1, 1, MOTA, 0.45); A(x, 8, 3, 1, 1, MOTA, 0.45);
      A(x, 2, 8, 1, 1, MOTA, 0.3); A(x, 8, 7, 1, 1, MOTA, 0.3);
    }
    frames.push(c);
  }
  return frames;
}
