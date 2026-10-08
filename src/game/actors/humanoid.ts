// ============================================================
// ECOS DE AELTHAR — Humanoides pixel (módulo actors)
// HumanPal, layout, ciclo de andar de 6 fases + 2 frames de
// idle (respiración/parpadeo) por dirección, frameIndex y
// entityFrame. Generación procedural, sin assets.
//
// R2-A1 — mejoras sin romper el contrato del motor:
//  · Ciclo de andar de 6 frames por dirección:
//      [zancadaA, contacto-medio, pase+1px, zancadaB, contacto-medio, pase+1px]
//    → 24 frames en total: 3 bloques de 8 (down 0-7, up 8-15, side 16-23);
//    dentro de cada bloque, los índices 6 y 7 son los frames de IDLE
//    (respiración + parpadeo) añadidos al final del bloque.
//  · Más modelo por píxel: doble contorno en silueta (borde oscuro +
//    medio tono interior), sombra de cuello, brillo 1px en hombros y
//    cabeza (luz arriba-izquierda), manos 2×2 en skin, cinturón con
//    hebilla 1px y botas con suela oscura.
//  · Terror sutil (sombra/esqueleto): ojos que parpadean en ámbar/
//    vacío, vetas de niebla translúcidas, postura encorvada (cabeza
//    1px más baja) y, en el esqueleto, mandíbula suelta (flag jaw)
//    y costillas marcadas (ribs). Activado EXPLÍCITAMENTE en
//    palettes.ts añadiendo los flags nuevos a las paletas 'sombra'
//    (dread) y 'esqueleto' (dread + jaw); dreadOf() mantiene la
//    deducción legacy como red de seguridad retrocompatible.
//    Todo va horneado en los frames prerrenderizados: coste en
//    runtime = 0.
//  · FIX de dirección: el motor pasa Dir = down/up/left/right (y la
//    estela de rodadura lo mismo), así que entityFrame trata
//    left/right/side como bloque LATERAL (frameIndex ya lo hacía
//    con su else; entityFrame comparaba con 'side' y nunca casaba).
//    side sigue dibujándose mirando a la DERECHA; render.ts hace el
//    flip para 'left' (no se toca).
//
// R2-A6 — identidad visual por personaje (flags NUEVOS, SOLO aditivos):
//  · chest?    → emblema/broche 1px en el pecho (hero_alba: sol dorado,
//                Brisa: broche cálido, Corvin: alfiler de gorguera, Toln: rescoldo).
//  · beardS?   → segundo tono de barba en zigzag = trenza (Brokk).
//  · cape? / capeC? / capeLong? → paneles de capa 1px a los costados
//                (corta: 3 filas; larga: hasta el cinturón) con bordado
//                1px en accent aclarado (Tejedor, Kael, Gran Inquisidor).
//  · feather?  → pluma 1px en accent sobre el hombro derecho/capucha (Ilwen).
//  · band?     → diadema/cinta 1px en accent sobre la corona (Maelis).
//  Todos son OPCIONALES: si no se definen, el dibujado es idéntico al
//  de R2-A1 (retrocompatible, coste 0).
// ============================================================

import { mkCanvas, px, type Frames } from './util';

export interface HumanPal {
  outline: string;
  hair: string; hairS?: string;
  skin: string;
  body: string; bodyS: string;
  accent: string;
  legs: string; legsS?: string;
  boots: string;
  eye: string;
  hood?: boolean;
  ribs?: boolean;
  jaw?: boolean;            // mandíbula suelta (muerto viviente): hueco oscuro + hueso descolgado
  beard?: string;
  // --- rasgos del agente 3-a (biblia de personajes) ---
  small?: boolean;          // niño (Teo): proporciones compactas
  big?: boolean;            // Gran Inquisidor: escala ×2 (32×36)
  ears?: 'cat' | 'elf';     // orejas felinas / élficas
  mask?: boolean;           // máscara lisa sin boca (Gran Inquisidor)
  maskC?: string;           // color de la máscara
  hammer?: boolean;         // martillo en la mano (Brokk)
  hairLong?: boolean;       // melena larga (Maelis, Nimue)
  pauldrons?: boolean;      // hombreras (Kael)
  leafy?: boolean;          // hojas en hombros (Doran)
  messy?: boolean;          // pelo revuelto (Teo)
  // --- R2-A1 · terror sutil (SOLO aditivos, opcionales) ---
  dread?: boolean;          // fuerza modo terror: niebla, ojos ámbar/vacío, encorvado
  dreadC?: string;          // color de las vetas de niebla (def.: accent o hueso)
  dreadEye?: string;        // color ámbar del parpadeo ocular (def.: #ffb054)
  // --- R2-A6 · identidad visual (SOLO aditivos, opcionales: undefined = sin cambio) ---
  chest?: string;           // emblema/broche 1px en el pecho (solo de frente)
  beardS?: string;          // 2º tono de barba en zigzag → trenza (Brokk)
  cape?: boolean;           // capa: paneles 1px a los costados del torso
  capeC?: string;           // color de la capa (def.: bodyS); bajo con bordado accent aclarado
  capeLong?: boolean;       // capa larga hasta el cinturón (Gran Inquisidor); def.: corta
  feather?: boolean;        // pluma 1px en accent sobre el hombro derecho (Ilwen)
  band?: boolean;           // diadema/cinta 1px en accent sobre la corona (Maelis)
}

interface Layout {
  H: number;        // alto del canvas
  headTop: number;  // fila de la masa de pelo
  faceTop: number;  // fila de piel
  bodyTop: number;  // fila del torso
  bodyH: number;    // filas de torso (incluye fila de contorno)
  armLen: number;   // largo del brazo sin mano
}

export function layoutFor(pal: HumanPal): Layout {
  if (pal.small) return { H: 15, headTop: 0, faceTop: 3, bodyTop: 7, bodyH: 4, armLen: 3 };
  return { H: 18, headTop: 1, faceTop: 4, bodyTop: 8, bodyH: 6, armLen: 4 };
}

// ---------------- utilidades de tono (locales, no tocan la paleta global) ----------------

/** Parsea '#rgb'/'#rrggbb' a [r,g,b]. */
function rgbOf(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Multiplica un color hex por f (clamp 255) — sombreado/iluminación puntual. */
function tone(hex: string, f: number): string {
  const [r, g, b] = rgbOf(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${c(r).toString(16).padStart(2, '0')}${c(g).toString(16).padStart(2, '0')}${c(b).toString(16).padStart(2, '0')}`;
}

/** Color hex → rgba() translúcido (vetas de niebla). */
function rgba(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Luminancia relativa < umbral → color "oscuro". */
function isDark(hex: string): boolean {
  const [r, g, b] = rgbOf(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.22;
}

/**
 * ¿Personaje de terror? El flag explícito `dread` manda (lo activan
 * las paletas 'sombra' y 'esqueleto' en palettes.ts); si no existe,
 * se deduce de la paleta legacy como red de seguridad retrocompatible:
 *  · ribs → esqueleto (única paleta con costillas)
 *  · capucha + piel y túnica casi negras → sombra
 */
function dreadOf(pal: HumanPal): boolean {
  if (pal.dread !== undefined) return pal.dread;
  if (pal.ribs) return true;
  return pal.hood === true && isDark(pal.skin) && isDark(pal.body);
}

// ---------------- fotogramas ----------------

/**
 * Dibuja un fotograma humanoide.
 *
 * ph (fase continua del ciclo):
 *   0 zancada A · 1 contacto-medio · 2 pase (+1px de bamboleo)
 *   3 zancada B · 4 contacto-medio · 5 pase (+1px)
 *   6 idle neutro (ojos abiertos, pecho abajo)
 *   7 idle aire (pecho 1px arriba, ojos cerrados = parpadeo)
 *
 * `bobFix` permite forzar el bamboleo (compatibilidad); si se omite se
 * deriva de la fase. El orden de dibujado es torso→cabeza→brazos→
 * piernas para que la cabeza encorvada y la mandíbula suelta del
 * esqueleto solapen el pecho de forma correcta.
 */
function drawFrame(
  x: CanvasRenderingContext2D, pal: HumanPal,
  dir: 'down' | 'up' | 'side', ph: number, L: Layout, bobFix?: number,
): void {
  const dread = dreadOf(pal);
  const jawLoose = pal.jaw === true || pal.ribs === true;   // mandíbula suelta
  const hs = pal.hairS ?? pal.hair;
  const ls = pal.legsS ?? pal.legs;
  const idle = ph >= 6;                                  // frames 6/7 de reposo
  const bob = bobFix ?? ((ph === 2 || ph === 5 || ph === 7) ? -1 : 0);
  const hy = dread ? 1 : 0;                              // encorvado: cabeza 1px más baja
  const hT = L.headTop + bob;                            // ancla de cabeza (con bamboleo)
  const fT = L.faceTop + bob;
  const bT = L.bodyTop + bob;                            // torso (las piernas quedan ancladas)
  const bodyBot = bT + L.bodyH - 1;                      // última fila del torso (contorno)
  const legY = bodyBot + 1;                              // piernas ancladas al suelo
  const bootY = L.H - 1;
  const legH2 = bootY - 1 - legY;                        // filas de pierna (bota y suela aparte)

  // paleta derivada (más modelo por píxel)
  const soleC = tone(pal.boots, 0.55);                   // suela oscura
  const neckC = tone(pal.bodyS, 0.72);                   // sombra de cuello
  const hiBody = tone(pal.body, 1.28);                   // brillo de hombro (luz arriba-izq)
  const hiHair = tone(pal.hair, 1.35);                   // brillo de cabeza
  const halfB = tone(pal.bodyS, 0.8);                    // medio tono interior del torso
  const halfH = tone(pal.hair, 0.78);                    // medio tono interior de la cabeza
  const buckle = tone(pal.accent, 1.6);                  // hebilla metálica
  const lidC = tone(pal.skin, 0.55);                     // párpado (parpadeo)
  const amber = pal.dreadEye ?? '#ffb054';               // brasa ocular (terror)
  const voidC = tone(pal.outline, 0.55);                 // ojo vacío / hueco de mandíbula
  const fogC = pal.dreadC ?? (pal.ribs ? pal.skin : pal.accent); // niebla que emana
  const faceC = pal.mask ? (pal.maskC ?? pal.skin) : pal.skin;

  // ojos: en terror parpadean ámbar/vacío entre frames; en reposo normal
  // se cierran 1 frame (ph 7). null = párpados cerrados.
  const eyeC: string | null = dread ? (ph % 2 === 0 ? amber : voidC)
    : (ph === 7 ? null : pal.eye);

  // balanceo de brazos (contrario entre izquierda y derecha); en idle, en guardia
  const sw = idle ? 0 : [1, 0, 0, -1, 0, 0][ph];
  const offL = sw, offR = -sw;

  // bota de 2 filas: cuero + suela oscura; lift=1 → pie recogido 1px
  const boot = (cx: number, w: number, lift: number) => {
    px(x, cx, bootY - 1 - lift, w, 1, pal.boots);
    px(x, cx, bootY - lift, w, 1, soleC);
  };

  if (dir === 'down' || dir === 'up') {
    // ---------- torso (primero: la cabeza encorvada solapa el pecho) ----------
    px(x, 4, bT, 8, L.bodyH, pal.body);
    px(x, 4, bT, 8, 1, pal.bodyS);
    // doble contorno lateral: borde oscuro + medio tono interior
    px(x, 4, bT, 1, L.bodyH - 1, pal.outline);
    px(x, 11, bT, 1, L.bodyH - 1, pal.outline);
    px(x, 5, bT + 1, 1, L.bodyH - 2, halfB);
    px(x, 10, bT + 1, 1, L.bodyH - 2, halfB);
    // sombra de cuello bajo la barbilla
    px(x, 6, bT, 4, 1, neckC);
    // costillas más marcadas (esqueleto): surco / hueso / surco
    if (pal.ribs) {
      px(x, 6, bT + 1, 4, 1, tone(pal.bodyS, 0.62));
      px(x, 6, bT + 2, 4, 1, pal.skin);
      px(x, 6, bT + 3, 4, 1, tone(pal.bodyS, 0.62));
    }
    // emblema/broche 1px en el pecho, solo de frente (R2-A6)
    if (pal.chest && dir === 'down') px(x, 8, bT + 1, 1, 1, pal.chest);
    // cinturón con hebilla 1px
    px(x, 5, bT + L.bodyH - 2, 6, 1, pal.accent);
    px(x, 7, bT + L.bodyH - 2, 2, 1, buckle);
    px(x, 4, bodyBot, 8, 1, pal.outline);
    // brillo 1px en hombros (luz arriba-izquierda)
    px(x, 4, bT, 2, 1, hiBody);
    if (pal.pauldrons) {
      px(x, 3, bT, 2, 2, pal.accent); px(x, 11, bT, 2, 2, pal.accent);
      px(x, 3, bT, 2, 1, tone(pal.accent, 1.3));
    }
    if (pal.leafy) { px(x, 3, bT, 2, 1, '#8ac05a'); px(x, 11, bT, 2, 1, '#8ac05a'); }

    // ---------- cabeza (hy baja la cabeza 1px en los encorvados) ----------
    const Hh = hT + hy, Ff = fT + hy;
    px(x, 4, Hh, 8, 1, pal.outline);
    px(x, 3, Hh + 1, 10, 5, pal.hair);
    px(x, 3, Hh + 1, 10, 1, hs);
    // doble contorno de la silueta de la cabeza + medio tono interior
    px(x, 3, Hh + 1, 1, 4, pal.outline);
    px(x, 12, Hh + 1, 1, 4, pal.outline);
    px(x, 4, Hh + 1, 1, 4, halfH);
    px(x, 11, Hh + 1, 1, 4, halfH);
    px(x, 4, Hh + 1, 2, 1, hiHair);                      // brillo 1px en el cráneo
    if (pal.band) px(x, 5, Hh + 1, 6, 1, pal.accent);    // diadema/cinta 1px en accent (R2-A6)
    if (pal.hood) { px(x, 3, Ff + 2, 10, 2, pal.hair); px(x, 4, Ff + 3, 8, 1, hs); }
    if (dir === 'down') {
      // cráneo: cara 3 filas y hueco oscuro (mandíbula suelta); cara normal: 4
      const faceH = jawLoose ? 3 : 4;
      px(x, 5, Ff, 6, faceH, faceC);
      if (!pal.mask) {
        if (eyeC) { px(x, 6, Ff + 1, 1, 2, eyeC); px(x, 9, Ff + 1, 1, 2, eyeC); }
        else { px(x, 6, Ff + 2, 1, 1, lidC); px(x, 9, Ff + 2, 1, 1, lidC); } // parpadeo
        if (pal.beard) px(x, 5, Ff + 3, 6, 2, pal.beard);
        if (pal.beardS) {
          // trenza: zigzag del 2º tono sobre la barba (R2-A6)
          px(x, 7, Ff + 3, 1, 1, pal.beardS); px(x, 8, Ff + 4, 1, 1, pal.beardS);
          px(x, 9, Ff + 3, 1, 1, pal.beardS);
        }
      } else {
        // máscara lisa: solo un brillo horizontal, sin boca ni ojos
        px(x, 6, Ff + 1, 4, 1, '#eae6dc');
      }
      if (jawLoose) {
        // mandíbula suelta: banda vacía + hueso 1px más abajo (sobre el pecho)
        px(x, 5, Ff + 3, 6, 1, voidC);
        px(x, 6, Ff + 4, 4, 1, pal.skin);
      }
      px(x, 3, Ff + 2, 1, 2, pal.hair); px(x, 12, Ff + 2, 1, 2, pal.hair);
      if (pal.ears === 'elf') { px(x, 2, Ff + 1, 1, 2, pal.skin); px(x, 13, Ff + 1, 1, 2, pal.skin); }
      if (pal.hairLong) {
        const hl = Math.max(1, bT - Ff - 3);
        px(x, 3, Ff + 4, 2, hl, pal.hair); px(x, 11, Ff + 4, 2, hl, pal.hair);
      }
    } else {
      // de espaldas: nuca cubierta si melena larga
      if (pal.hairLong) px(x, 4, Ff + 3, 8, 1, pal.hair);
    }
    if (pal.ears === 'cat') {
      // orejas felinas sobre la cabeza (filas fijas para que no "floten")
      px(x, 3, 0, 1, 1, hs); px(x, 12, 0, 1, 1, hs);
      px(x, 3, 1, 2, 1, pal.hair); px(x, 11, 1, 2, 1, pal.hair);
    }
    if (pal.messy) {
      // pelo revuelto (mechones sueltos)
      px(x, 2, Hh + 1, 1, 1, pal.hair); px(x, 13, Hh + 1, 1, 1, pal.hair);
      px(x, 5, Math.max(0, Hh - 1), 2, 1, pal.hair); px(x, 9, Math.max(0, Hh - 1), 3, 1, pal.hair);
    }
    if (pal.feather) {
      // pluma 1px en accent sobre el hombro derecho / borde de la capucha (R2-A6)
      px(x, dir === 'up' ? 11 : 4, bT - 1, 1, 1, pal.accent);
    }

    // ---------- brazos (oscilación) + manos 2×2 ----------
    px(x, 2, bT + offL, 2, L.armLen, pal.body);
    px(x, 2, bT + offL + L.armLen - 1, 2, 2, pal.skin);
    px(x, 12, bT + offR, 2, L.armLen, pal.body);
    px(x, 12, bT + offR + L.armLen - 1, 2, 2, pal.skin);
    if (pal.hammer) {
      // martillo en la mano derecha
      px(x, 13, bT + offR - 2, 1, L.armLen + 2, '#7a5c3a');
      px(x, 12, bT + offR - 4, 3, 2, '#9aa4b4');
    }
    if (pal.cape) {
      // capa: paneles 1px a los costados + bordado accent aclarado (R2-A6)
      const cc = pal.capeC ?? pal.bodyS;
      const ch = pal.capeLong ? L.bodyH - 1 : 3;   // larga → cinturón · corta → 3 filas
      px(x, 3, bT, 1, ch, cc); px(x, 12, bT, 1, ch, cc);
      px(x, 3, bT + ch - 1, 1, 1, tone(pal.accent, 1.3));
      px(x, 12, bT + ch - 1, 1, 1, tone(pal.accent, 1.3));
    }

    // ---------- piernas: ciclo de 6 fases, bota + suela ----------
    const m1 = Math.max(1, legH2 - 1);
    if (ph === 0) {          // zancada A: izquierda adelante, derecha atrás
      px(x, 4, legY, 3, legH2, pal.legs); boot(4, 3, 0);
      px(x, 9, legY, 3, legH2, ls); boot(9, 3, 0);
    } else if (ph === 1) {   // contacto-medio: la derecha se recoge 1px
      px(x, 5, legY, 3, legH2, pal.legs); boot(5, 3, 0);
      px(x, 9, legY + 1, 3, m1, ls); boot(9, 3, 1);
    } else if (ph === 2) {   // pase: juntas, cuerpo elevado
      px(x, 6, legY, 3, legH2, pal.legs); boot(6, 3, 0);
      px(x, 8, legY, 3, legH2, ls); boot(8, 3, 0);
    } else if (ph === 3) {   // zancada B: derecha adelante, izquierda atrás
      px(x, 4, legY + 1, 3, m1, ls); boot(4, 3, 1);
      px(x, 9, legY, 3, legH2, pal.legs); boot(9, 3, 0);
    } else if (ph === 4) {   // contacto-medio: la izquierda se recoge 1px
      px(x, 5, legY + 1, 3, m1, ls); boot(5, 3, 1);
      px(x, 9, legY, 3, legH2, pal.legs); boot(9, 3, 0);
    } else {                 // pase: juntas, cuerpo elevado
      px(x, 6, legY, 3, legH2, ls); boot(6, 3, 0);
      px(x, 8, legY, 3, legH2, pal.legs); boot(8, 3, 0);
    }
  } else {
    // ---------- dir === 'side' (mirando a la derecha; render voltea para 'left') ----------
    // torso
    px(x, 5, bT, 6, L.bodyH, pal.body);
    px(x, 5, bT, 6, 1, pal.bodyS);
    px(x, 5, bT, 1, L.bodyH - 1, pal.outline);           // doble contorno: espalda
    px(x, 10, bT, 1, L.bodyH - 1, pal.outline);          // y pecho
    px(x, 6, bT + 1, 1, L.bodyH - 2, halfB);
    px(x, 9, bT + 1, 1, L.bodyH - 2, halfB);
    px(x, 7, bT, 3, 1, neckC);                           // sombra de cuello
    if (pal.ribs) {
      px(x, 6, bT + 1, 3, 1, tone(pal.bodyS, 0.62));
      px(x, 6, bT + 2, 3, 1, pal.skin);
      px(x, 6, bT + 3, 3, 1, tone(pal.bodyS, 0.62));
    }
    if (pal.chest) px(x, 9, bT + 1, 1, 1, pal.chest);    // emblema 1px al frente (R2-A6)
    px(x, 6, bT + L.bodyH - 2, 4, 1, pal.accent);        // cinturón
    px(x, 9, bT + L.bodyH - 2, 1, 1, buckle);            // hebilla al frente
    px(x, 5, bodyBot, 6, 1, pal.outline);
    px(x, 5, bT, 2, 1, hiBody);                          // brillo de hombro
    if (pal.pauldrons) { px(x, 4, bT, 2, 2, pal.accent); px(x, 4, bT, 2, 1, tone(pal.accent, 1.3)); }
    if (pal.leafy) px(x, 4, bT, 2, 1, '#8ac05a');

    // cabeza
    const Hh = hT + hy, Ff = fT + hy;
    px(x, 5, Hh, 8, 1, pal.outline);
    px(x, 4, Hh + 1, 9, 5, pal.hair);
    px(x, 4, Hh + 1, 9, 1, hs);
    px(x, 4, Hh + 1, 1, 4, pal.outline);                 // doble contorno: nuca
    px(x, 12, Hh + 1, 1, 2, pal.outline);                // y curva frontal
    px(x, 5, Hh + 1, 1, 3, halfH);
    px(x, 5, Hh + 1, 2, 1, hiHair);
    if (pal.band) px(x, 6, Hh + 1, 4, 1, pal.accent);    // diadema 1px de perfil (R2-A6)
    if (pal.hood) px(x, 4, Ff + 2, 8, 2, pal.hair);
    const faceH = jawLoose ? 3 : 4;
    px(x, 7, Ff, 5, faceH, faceC);
    if (!pal.mask) {
      if (eyeC) px(x, 10, Ff + 1, 1, 2, eyeC);
      else px(x, 10, Ff + 2, 1, 1, lidC);                // parpadeo
      if (pal.beard) px(x, 8, Ff + 3, 4, 2, pal.beard);
      if (pal.beardS) {
        // trenza de perfil: zigzag del 2º tono (R2-A6)
        px(x, 9, Ff + 3, 1, 1, pal.beardS); px(x, 10, Ff + 4, 1, 1, pal.beardS);
      }
    } else {
      px(x, 8, Ff + 1, 3, 1, '#eae6dc');
    }
    if (jawLoose) {
      // mandíbula suelta de perfil: hueco + hueso descolgado 1px
      px(x, 7, Ff + 3, 4, 1, voidC);
      px(x, 8, Ff + 4, 3, 1, pal.skin);
    }
    px(x, 5, Ff + 2, 1, 2, pal.hair);
    if (pal.ears === 'elf') px(x, 6, Ff + 1, 1, 2, pal.skin);
    if (pal.ears === 'cat') { px(x, 3, 0, 1, 1, hs); px(x, 4, 1, 2, 1, pal.hair); }
    if (pal.hairLong) px(x, 4, Ff + 3, 2, Math.max(1, bT - Ff - 2), pal.hair);
    if (pal.messy) px(x, 5, Math.max(0, Hh - 1), 3, 1, pal.hair);
    if (pal.feather) px(x, 4, bT - 1, 1, 1, pal.accent); // pluma en el hombro trasero (R2-A6)

    // brazo delantero con balanceo + brazo trasero al tono sombreado
    px(x, 8, bT + sw, 3, 3, pal.body);
    px(x, 10, bT + sw + 2, 2, 2, pal.skin);              // mano 2×2
    px(x, 5, bT - sw, 2, 3, pal.bodyS);
    px(x, 5, bT - sw + 2, 2, 2, tone(pal.skin, 0.82));   // mano trasera en sombra
    if (pal.hammer) {
      px(x, 11, bT + sw - 2, 1, 5, '#7a5c3a');
      px(x, 10, bT + sw - 4, 3, 2, '#9aa4b4');
    }
    if (pal.cape) {
      // capa de perfil: borde 1px a la espalda + bordado accent (R2-A6)
      const cc = pal.capeC ?? pal.bodyS;
      const ch = pal.capeLong ? L.bodyH - 1 : 3;
      px(x, 4, bT, 1, ch, cc);
      px(x, 4, bT + ch - 1, 1, 1, tone(pal.accent, 1.3));
    }

    // piernas en zancada (6 fases, bota + suela)
    const m1 = Math.max(1, legH2 - 1);
    if (ph === 0) {          // zancada A: trasera extendida, delantera al frente
      px(x, 5, legY, 2, legH2, ls); boot(5, 2, 0);
      px(x, 8, legY, 2, legH2, pal.legs); boot(8, 2, 0);
    } else if (ph === 1) {   // contacto-medio: la trasera se recoge
      px(x, 6, legY + 1, 2, m1, ls); boot(6, 2, 1);
      px(x, 8, legY, 2, legH2, pal.legs); boot(8, 2, 0);
    } else if (ph === 2) {   // pase: la trasera cruza recogida, cuerpo elevado
      px(x, 6, legY, 2, legH2, pal.legs); boot(6, 2, 0);
      px(x, 8, legY + 1, 2, m1, ls); boot(8, 2, 1);
    } else if (ph === 3) {   // zancada B: zancada opuesta (sombras intercambiadas)
      px(x, 4, legY, 2, legH2, pal.legs); boot(4, 2, 0);
      px(x, 7, legY, 2, legH2, ls); boot(7, 2, 0);
    } else if (ph === 4) {   // contacto-medio: la trasera se recoge
      px(x, 5, legY + 1, 2, m1, pal.legs); boot(5, 2, 1);
      px(x, 7, legY, 2, legH2, ls); boot(7, 2, 0);
    } else {                 // pase
      px(x, 6, legY, 2, legH2, ls); boot(6, 2, 0);
      px(x, 8, legY + 1, 2, m1, pal.legs); boot(8, 2, 1);
    }
  }

  // ---------- capa ondeando en idle (hood o melena larga) ----------
  if (idle && pal.hood && ph === 6) {
    // pose neutra: tela asentada a los costados
    px(x, 3, bT, 1, 4, pal.bodyS); px(x, 12, bT, 1, 4, pal.bodyS);
  } else if (idle && pal.hood) {
    // frame de aire: la capa se levanta 1px y una solapa vuela
    px(x, 3, bT + 1, 1, 4, pal.bodyS); px(x, 12, bT + 1, 1, 4, pal.bodyS);
    px(x, 2, bT + 3, 1, 1, pal.bodyS); px(x, 13, bT + 2, 1, 1, pal.bodyS);
  } else if (idle && pal.hairLong && dir !== 'up') {
    // punta de la melena que se mece 1px entre frames
    if (ph === 6) px(x, 3, bT + 1, 1, 1, hs);
    else px(x, 4, bT + 1, 1, 1, hs);
  } else if (idle && pal.cape && ph === 7) {
    // frame de aire: una esquina de la capa vuela 1px (R2-A6)
    px(x, 2, bT + 3, 1, 1, pal.capeC ?? pal.bodyS);
    px(x, 13, bT + 3, 1, 1, pal.capeC ?? pal.bodyS);
  }

  // ---------- vetas de niebla (terror): 3 px translúcidos que derivan ----------
  if (dread) {
    px(x, 1, bT + 1 + ((ph * 2) % 3), 1, 2, rgba(fogC, 0.35));
    px(x, 14, bT + 2 + ((ph * 2 + 1) % 3), 1, 2, rgba(fogC, 0.3));
    px(x, 6 + (ph % 3) * 2, Math.max(0, hT + hy - 1), 2, 1, rgba(fogC, 0.26));
  }
}

/**
 * Dibuja un fotograma humanoide (firma legacy intacta). f = fase de
 * andar del ciclo antiguo de 3 fases (0 zancada A, 1 pase, 2 zancada
 * B), remapeada al ciclo nuevo de 6. En reposo se usa f=1 sin bob para
 * una pose neutra de pie.
 */
export function drawHumanFrame(
  x: CanvasRenderingContext2D, pal: HumanPal,
  dir: 'down' | 'up' | 'side', f: number, bob: number, L: Layout,
): void {
  const ph = f === 1 ? 2 : f === 2 ? 3 : 0;
  drawFrame(x, pal, dir, ph, L, bob);
}

/**
 * Construye los 24 frames del humanoide: por cada dirección (down,
 * up, side) 6 de andar [zancadaA, contacto, pase+1px, zancadaB,
 * contacto, pase+1px] y al FINAL del bloque 2 de idle (índices 6 y 7:
 * respiración + parpadeo). `big` escala ×2 (32×36, ≤ 40×40).
 */
export function buildHumanoid(pal: HumanPal): Frames {
  const frames: Frames = [];
  const dirs: ('down' | 'up' | 'side')[] = ['down', 'up', 'side'];
  const L = layoutFor(pal);
  for (const dir of dirs) {
    for (let ph = 0; ph < 8; ph++) {   // 6 de andar + 2 de idle (6, 7)
      const { c, x } = mkCanvas(16, L.H);
      drawFrame(x, pal, dir, ph, L);
      frames.push(c);
    }
  }
  if (pal.big) {
    // El Gran Inquisidor se dibuja a escala ×2 (32×36): imponente como el Guardián
    return frames.map(fr => {
      const { c, x } = mkCanvas(32, L.H * 2);
      x.imageSmoothingEnabled = false;
      x.drawImage(fr, 0, 0, 32, L.H * 2);
      return c;
    });
  }
  return frames;
}

/**
 * Fase de reposo compartida: 0 = idle neutro (frame 6, ojos abiertos),
 * 1 = aire/parpadeo (frame 7, ojos cerrados). El parpadeo dura 1/5 de
 * unidad de anim y se repite cada 8/5 unidades → ~3-4 s con el ritmo
 * idle del motor (anim += dt·0.4 el jugador, dt·0.6 enemigos). El
 * desfase +4 evita parpadear justo al aparecer (anim≈0).
 */
function idleBlink(anim: number): number {
  return (Math.floor(anim * 5) + 4) % 8 === 0 ? 1 : 0;
}

/**
 * Índice de fotograma (compatible con re-export de engine.ts).
 *  · En movimiento: floor(anim·6) % 6 recorre el ciclo de 6 fases —
 *    el contador avanza al mismo ritmo por frame que el ciclo legacy
 *    floor(anim·6)%2, pero con 3× más pasos: zancada más suave.
 *  · En reposo: 6 (neutro, ojos abiertos) o 7 (aire, ojos cerrados).
 *    Los frames 6/7 son locales a cada bloque de dirección
 *    (base +6/+7).
 *  · dir acepta el Dir del motor (down/up/left/right): todo lo que
 *    no es down/up cae en el bloque lateral (el sprite side mira a
 *    la derecha y render.ts lo voltea para 'left').
 */
export function frameIndex(dir: string, moving: boolean, anim: number): number {
  const base = dir === 'down' ? 0 : dir === 'up' ? 8 : 16;
  if (!moving) return base + 6 + idleBlink(anim);
  return base + (Math.floor(anim * 6) % 6);
}

/**
 * Selección robusta de fotograma para cualquier sprite (siempre
 * devuelve un índice DENTRO de spr.length — clamp explícito):
 *  · humanoids v2 (24 frames): ciclo de 6 + idle 6/7 por dirección.
 *  · humanoids legacy de 9 frames (3 por dirección): ciclo antiguo.
 *  · resto (lobo, guardián, wisp...): alternan su ciclo propio al moverse.
 *  · dir llega con el Dir del motor: down/up/left/right — left y
 *    right seleccionan el bloque LATERAL (antes se comparaba con
 *    'side', que nunca casaba, y al andar en horizontal se mostraba
 *    el sprite de frente).
 */
export function entityFrame(spr: Frames, dir: string, moving: boolean, anim: number): number {
  const n = spr.length;
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, i));
  if (n === 24) {
    const base = dir === 'up' ? 8 : dir === 'down' ? 0 : 16;
    if (!moving) return clamp(base + 6 + idleBlink(anim));
    return clamp(base + (Math.floor(anim * 6) % 6));
  }
  if (n === 9) {
    const base = dir === 'up' ? 3 : dir === 'down' ? 0 : 6;
    if (!moving) return clamp(base + 1); // pose de pie = fase de pase sin bob
    return clamp(base + (Math.floor(anim * 8) % 3));
  }
  if (n >= 2 && moving) return clamp(Math.floor(anim * 6) % Math.min(2, n));
  return clamp(0);
}
