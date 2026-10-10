// ============================================================
// ECOS DE AELTHAR — 18-e · FARO-HISTORIA: «La lámpara que aprendió a temblar»
// ============================================================
// Convierte el faro de la Costa de Bruma en un HUB narrativo con TRES NPCs
// visualmente únicos (sprites procedurales propios, nadie más los usa) y una
// micro-historia propia enlazada con el eco menor co_e1 («El farero que no se
// dormía») y con el Acto II (la Sirena, la nana, el Eco de las Mareas).
//
// LOS TRES DEL FARO (tiles verificados con BFS sobre mapRows + SOLID_CHARS):
//   · mara      (7,19) — YA EXISTÍA, hoy usaba 'maelis' → sprite PROPIO
//     'mara_farera' (chubasquero azul, gorro de lana, lámpara de mano).
//     La entrada del array npcs de 'costa' la edita ESTE agente en
//     maps_expansion.ts (única línea tocada allí para Mara).
//   · uso_faro  (5,21) — NUEVO, hermano de Mara: viejo lobo de mar con
//     parche, barba de sal y gabardina. Sprite 'uso_faro'. NpcDef NO soporta
//     needPresent (types.ts congelado: id/x/y/sprite/name/hideFlag/showFlag
//     — los needPresent/needPast solo existen en SpawnDef/PropDef), así que
//     Uso queda SIEMPRE VISIBLE, como el resto de NPCs del juego.
//   · tina_faro (9,20) — NUEVO, sobrina de ambos (10 años): capa roja, concha
//     colgante, coletas. Sprite 'tina_faro' (layout small 16×15 como Teo).
//   · Prop decorativo propio: sign_co3 (8,17), cartel del faro.
//
// ============================================================
// CABLEADO PARA EL INTEGRADOR (6 líneas exactas, todo lo demás vive aquí)
// ============================================================
// 1) data.ts — tras la definición de `const D: Record<string, DialogueNode>`
//    (p. ej. junto al `export const DIALOGUES = D;`, línea ~749):
//      Object.assign(D, FARO_DIALOGUES); // ==== 18-e: faro-historia ====
//    (con el import arriba: `import { FARO_DIALOGUES } from './faro_historia';`)
//    NO introduce ciclos: faro_historia solo importa types + sprites.
//
// 2) data.ts — RUTEO de los 3 NPCs. El binding VIVO de getDialogue es el
//    envoltorio getDialogueActo4 (16-a reasigna el export al final de data.ts;
//    engine.talkTo resuelve SIEMPRE por él). Añadir al principio del cuerpo de
//    getDialogueActo4 (y SOLO allí — la capa 13-a/16-a ya delega hacia abajo):
//      { const fr = faroRouteDialogue(nid, ctx); if (fr) return fr; } // ==== 18-e ====
//    (import: `import { faroRouteDialogue } from './faro_historia';`)
//    faroRouteDialogue devuelve null para todo lo que no sea mara/uso_faro/
//    tina_faro y respeta los estados de q6/mara_intro, mara_react y las rutas
//    del Acto III (acto3_eco_mara / acto3_mara_ayer) → regresión 0.
//
// 3) sprites.ts — RETRATOS: el registro PORTRAITS es privado de sprites.ts.
//    Añadir arriba `import { FARO_PORTRAITS } from './faro_historia';` y dentro
//    de initSprites() (NO a nivel de módulo: faro_historia importa sprites →
//    a nivel de módulo sería TDZ por el ciclo; dentro de initSprites() ya no
//    hay ciclo en ejecución, es el sitio idempotente y seguro):
//      Object.assign(PORTRAITS, FARO_PORTRAITS); // ==== 18-e: retratos del faro ====
//    Los retratos siguen la MISMA cuadrícula 28×40 y la interfaz PortraitDef
//    (kind 'human') de drawPortrait: claves 'mara_farera', 'uso_faro',
//    'tina_faro'. Mientras no se fusione, drawPortrait cae a 'wisp' (fallback
//    existente, seguro). Opcional (estética): retocar portrait: 'maelis' →
//    'mara_farera' en los nodos mara_* antiguos de data.ts.
//
// 4) engine.ts — registro de sprites (constructor, tras initExpansionSprites(),
//    línea ~203): `initFaroSprites(); // ==== 18-e: faro-historia ====`
//    (import arriba). Idempotente. Sin esto, getSpr cae a 'hero_alba'.
//
// 5) update.ts — tick del faro (junto a `interaccionTick(g, dt);`, línea ~384):
//      faroTick(g, dt); // ==== 18-e: escucha nocturna + pago de la recompensa ====
//    (import arriba). O(1), early-out fuera de la costa. Sin este cableado el
//    arco sigue siendo completable hablando con Mara (ruta de diálogo
//    alternativa), pero la flag nocturna y el PAGO de las 15 coronas no
//    se entregan (no existe ninguna acción de diálogo que dé oro).
//
// 6) maps_expansion.ts — YA HECHO por este agente: sprite 'mara_farera' en
//    mara + NPCs uso_faro/tina_faro en npcs de 'costa' + cartel sign_co3.
//
// FLAGS NUEVAS (se serializan solas: save() hace spread de flags):
//   · faro_uso_hablado          — nodo faro_uso_2 (onEnd 'flag_faro_uso_hablado')
//   · faro_tina_hablado         — nodo faro_tina_2 (onEnd 'flag_faro_tina_hablado')
//   · faro_escucha              — faroTick (noche junto al faro) o ruta de
//                                 diálogo alternativa (faro_mara_c1)
//   internas de bookkeeping del arco (mismo mecanismo 'flag_<clave>' de hooks):
//   · faro_escuchaPendiente     — Mara ya pidió la escucha (faro_mara_o2)
//   · faro_recompensa           — nodo final cerrado → faroTick PAGA +15 coronas
//   · faro_pagada               — pago único hecho (anti-doble, sobrevive reload)
//
// RECOMPENSA FINAL (modesta): +8 reputación Guardianes vía acción
//   'rep_guardianes_8' (patrón genérico rep_<faccion>_<±n> ya existente en
//   hooks.handleCustomAction — VERIFICADO, no hace nada nuevo) + 15 coronas
//   pagadas por faroTick (única vía: engine.applyAction no tiene acción de
//   oro y hooks.ts está congelado) + toasts propios de cada pieza.
//
// DETERMINISMO: pixel-art procedural con mulberry32 local (semillas fijas);
// cero Math.random. buildHumanoid no es exportable desde sprites.ts, así que
// este módulo replica su contrato EXACTO (canvas 16×H, 9 frames:
// down×3/up×3/side×3, fase 1 = pase con bob -1, misma geometría de filas) y
// se registra con registerSpr() (exportado). entityFrame() los anima sin
// cambios por tener 9 frames.
// ============================================================

import { registerSpr, mergeFaroPortraits } from './sprites';
import type { Frames } from './sprites';
import type { DialogueNode } from './types';
import { audio } from './audio';

// ---------------- mulberry32 local (determinista, cero Math.random) ----------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- pixel-art: humanoides del faro (contrato buildHumanoid) ----------------

function mkCanvas(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

function px(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, C: string) {
  x.fillStyle = C; x.fillRect(X, Y, W, H);
}

/** Layouts idénticos a sprites.ts: adulto 16×18 · niño (small) 16×15. */
interface FaroLayout { H: number; headTop: number; faceTop: number; bodyTop: number; bodyH: number; armLen: number }
const L_ADULT: FaroLayout = { H: 18, headTop: 1, faceTop: 4, bodyTop: 8, bodyH: 6, armLen: 4 };
const L_SMALL: FaroLayout = { H: 15, headTop: 0, faceTop: 3, bodyTop: 7, bodyH: 4, armLen: 3 };

interface FaroPal {
  outline: string;
  hair: string; hairS: string;
  skin: string; skinS: string;
  body: string; bodyS: string;
  accent: string;
  legs: string;
  boots: string;
  eye: string;
}

// Paleta de MARA: chubasquero azul, gorro de lana rojo, lámpara de mano.
const MARA_PAL: FaroPal & { hat: string; hatHi: string; hatBand: string; pom: string; lamp: string; glass: string } = {
  outline: '#1a1826', hair: '#5a4a3e', hairS: '#4a3c32', skin: '#e8b48c', skinS: '#c89068',
  body: '#2e5a8a', bodyS: '#24466e', accent: '#e8d0a0', legs: '#24466e', boots: '#3a3a44', eye: '#4a5a68',
  hat: '#a8403e', hatHi: '#c05a50', hatBand: '#7e2c2e', pom: '#e8d8c0', lamp: '#c89830', glass: '#ffe9a0',
};

// Paleta de USO: pelo canoso, parche, barba de sal, gabardina con cinturón.
const USO_PAL: FaroPal & { patch: string; beard: string; beardS: string; belt: string; buckle: string } = {
  outline: '#181614', hair: '#9aa0a8', hairS: '#7a8088', skin: '#d8a878', skinS: '#b4885c',
  body: '#5a5244', bodyS: '#463f33', accent: '#3a342a', legs: '#463f33', boots: '#2e2a24', eye: '#8aa0b8',
  patch: '#14121a', beard: '#d8d8d0', beardS: '#b0b0a4', belt: '#2e2a22', buckle: '#b09a5a',
};

// Paleta de TINA: capa roja, vestido mostaza, concha, coletas castañas.
const TINA_PAL: FaroPal & { cape: string; capeS: string; shell: string } = {
  outline: '#201818', hair: '#8a5a30', hairS: '#6e4423', skin: '#f2cfa4', skinS: '#d0aa78',
  body: '#d8b060', bodyS: '#b89048', accent: '#f0e0c8', legs: '#8a5a38', boots: '#6a4a30', eye: '#4a6a5a',
  cape: '#c04048', capeS: '#942e38', shell: '#f0e0c8',
};

/** Moteado determinista de la barba de sal (posiciones fijas por semilla). */
function saltSpeckles(seed: number): [number, number][] {
  const rng = mulberry32(seed);
  const out: [number, number][] = [];
  for (let i = 0; i < 4; i++) out.push([5 + Math.floor(rng() * 6), Math.floor(rng() * 2)]);
  return out;
}
const USO_SPECKLES = saltSpeckles(1846); // se crea UNA vez: patrón estable entre frames

/**
 * Fotograma humanoide del faro — GEOMETRÍA EXACTA de drawHumanFrame
 * (sprites.ts) con rasgos propios por personaje. f = fase de andar
 * (0 zancada A, 1 pase —bob -1—, 2 zancada B).
 */
function faroFrame(
  x: CanvasRenderingContext2D, who: 'mara' | 'uso' | 'tina', pal: FaroPal,
  dir: 'down' | 'up' | 'side', f: number, bob: number, L: FaroLayout,
): void {
  const hT = L.headTop + bob;
  const fT = L.faceTop + bob;
  const bT = L.bodyTop + bob;
  const bodyBot = bT + L.bodyH - 1;
  const legY = bodyBot + 1;
  const bootY = L.H - 1;
  const legH = bootY - legY;
  const offL = [1, 0, -1][f];
  const offR = [-1, 0, 1][f];
  const ol = pal.outline;

  if (dir === 'down' || dir === 'up') {
    // ---------- piernas (3 fases, detrás del faldón) ----------
    faroLegsFront(x, pal, f, bob, L);

    // ---------- cabeza ----------
    px(x, 4, hT, 8, 1, ol);
    if (who === 'mara') {
      // gorro de lana: copilla + banda + borla
      px(x, 3, hT + 1, 10, 3, MARA_PAL.hat);
      px(x, 3, hT + 1, 10, 1, MARA_PAL.hatHi);
      px(x, 3, hT + 3, 10, 1, MARA_PAL.hatBand);
      if (hT - 1 >= 0) px(x, 7, hT - 1, 2, 1, MARA_PAL.pom);
    } else {
      px(x, 3, hT + 1, 10, 5, pal.hair);
      px(x, 3, hT + 1, 10, 1, pal.hairS);
      if (who === 'uso') px(x, 6, hT + 2, 4, 1, pal.skin); // calva al aire
    }
    if (dir === 'down') {
      px(x, 5, fT, 6, 4, pal.skin);
      if (who === 'uso') {
        px(x, 6, fT + 1, 2, 2, USO_PAL.patch);            // parche en el ojo izquierdo
        px(x, 9, fT + 1, 1, 2, pal.eye);                  // ojo bueno
        px(x, 8, fT + 1, 1, 1, pal.skinS);                // cicatriz del puente nasal
        px(x, 5, fT + 3, 6, 2, USO_PAL.beard);            // barba de sal
        for (const [sx, sy] of USO_SPECKLES) px(x, sx, fT + 3 + sy, 1, 1, USO_PAL.beardS);
      } else {
        px(x, 6, fT + 1, 1, 2, pal.eye); px(x, 9, fT + 1, 1, 2, pal.eye);
      }
      if (who === 'tina') {
        px(x, 5, fT + 1, 1, 1, pal.skinS);                // peca + sonrisa
        px(x, 7, fT + 3, 2, 1, pal.skinS);
        // coletas a los lados de la cara
        px(x, 2, fT + 1, 2, 3, pal.hair); px(x, 12, fT + 1, 2, 3, pal.hair);
        px(x, 2, fT + 1, 2, 1, pal.hairS); px(x, 12, fT + 1, 2, 1, pal.hairS);
      } else {
        px(x, 3, fT + 2, 1, 2, pal.hair); px(x, 12, fT + 2, 1, 2, pal.hair);
      }
    } else {
      // espalda: nuca + masa de pelo/gorro
      if (who === 'mara') px(x, 3, fT, 10, 2, MARA_PAL.hatBand);
      else if (who === 'tina') {
        px(x, 3, fT - 1, 10, 2, pal.hair);
        px(x, 2, fT + 1, 2, 3, pal.hair); px(x, 12, fT + 1, 2, 3, pal.hair); // coletas por detrás
      } else px(x, 3, fT, 10, 2, pal.hairS);
    }

    // ---------- torso ----------
    if (who === 'tina') {
      // capa roja por detrás del vestido (down: bordes; up: manto completo)
      if (dir === 'down') {
        px(x, 3, bT, 10, 1, TINA_PAL.capeS);
        px(x, 3, bT + 1, 1, L.bodyH - 1, TINA_PAL.cape); px(x, 12, bT + 1, 1, L.bodyH - 1, TINA_PAL.cape);
        px(x, 3, bodyBot, 1, 1, TINA_PAL.capeS); px(x, 12, bodyBot, 1, 1, TINA_PAL.capeS);
      } else {
        px(x, 3, bT, 10, L.bodyH, TINA_PAL.cape);
        px(x, 3, bT, 10, 1, TINA_PAL.capeS);
        px(x, 3, bodyBot, 10, 1, TINA_PAL.capeS);
      }
    }
    px(x, 4, bT, 8, L.bodyH, pal.body);
    px(x, 4, bT, 8, 1, pal.bodyS);
    px(x, 4, bodyBot, 8, 1, ol);
    if (who === 'mara') {
      // faldón del chubasquero (1px más ancho) + cremallera con botones
      px(x, 3, bT + L.bodyH - 2, 10, 2, pal.body);
      px(x, 3, bodyBot, 10, 1, ol);
      px(x, 7, bT + 1, 1, L.bodyH - 2, '#e8d0a0');
      px(x, 6, bT + 2, 1, 1, pal.bodyS); px(x, 8, bT + 2, 1, 1, pal.bodyS);
    } else if (who === 'uso') {
      // gabardina: faldón + cinturón con hebilla
      px(x, 3, bT + L.bodyH - 2, 10, 2, pal.body);
      px(x, 3, bodyBot, 10, 1, ol);
      px(x, 4, bT + 3, 8, 1, USO_PAL.belt);
      px(x, 7, bT + 3, 2, 1, USO_PAL.buckle);
    } else {
      px(x, 5, bT + L.bodyH - 2, 6, 1, pal.bodyS);
      px(x, 7, bT + 1, 2, 1, TINA_PAL.shell);             // concha colgante
    }

    // ---------- brazos ----------
    px(x, 2, bT + offL, 2, L.armLen, pal.body); px(x, 2, bT + offL + L.armLen, 2, 1, pal.skin);
    px(x, 12, bT + offR, 2, L.armLen, pal.body); px(x, 12, bT + offR + L.armLen, 2, 1, pal.skin);
    if (who === 'mara') {
      // lámpara de mano colgada de la cadera derecha: latón + cristal que arde
      px(x, 14, bT + 1, 2, 1, MARA_PAL.glass);
      px(x, 14, bT + 2, 2, 2, MARA_PAL.lamp);
      px(x, 14, bT + L.armLen + 1, 2, 1, pal.outline);
    }
    return;
  }

  // ---------- dir === 'side' (mirando a la derecha; el render voltea left) ----------
  if (who === 'tina') px(x, 3, fT + 2, 2, 3, pal.hair);   // coleta atrás (bajo el contorno)
  px(x, 5, hT, 8, 1, ol);
  if (who === 'mara') {
    px(x, 4, hT + 1, 9, 3, MARA_PAL.hat);
    px(x, 4, hT + 1, 9, 1, MARA_PAL.hatHi);
    px(x, 4, hT + 3, 9, 1, MARA_PAL.hatBand);
    px(x, 4, hT - 1 >= 0 ? hT - 1 : hT, 2, 1, MARA_PAL.pom);
  } else {
    px(x, 4, hT + 1, 9, 5, pal.hair);
    px(x, 4, hT + 1, 9, 1, pal.hairS);
    if (who === 'uso') px(x, 6, hT + 2, 4, 1, pal.skin);
  }
  px(x, 7, fT, 5, 4, pal.skin);
  if (who === 'uso') {
    px(x, 10, fT + 1, 1, 2, USO_PAL.patch);               // perfil: parche sobre el ojo visible
    px(x, 8, fT + 3, 4, 2, USO_PAL.beard);
    px(x, 9, fT + 3, 1, 1, USO_PAL.beardS);
  } else {
    px(x, 10, fT + 1, 1, 2, pal.eye);
  }
  px(x, 5, fT + 2, 1, 2, who === 'mara' ? MARA_PAL.hair : pal.hair);
  if (who === 'tina') px(x, 3, fT + 2, 1, 1, TINA_PAL.shell); // concha al hombro en perfil

  // torso (la capa de Tina va detrás: franja trasera)
  if (who === 'tina') px(x, 4, bT, 2, L.bodyH + 1, TINA_PAL.cape);
  px(x, 5, bT, 6, L.bodyH, pal.body);
  px(x, 5, bT, 6, 1, pal.bodyS);
  px(x, 5, bodyBot, 6, 1, ol);
  if (who === 'mara') {
    px(x, 4, bT + L.bodyH - 2, 8, 2, pal.body);
    px(x, 4, bodyBot, 8, 1, ol);
    px(x, 7, bT + 1, 1, L.bodyH - 2, '#e8d0a0');
  } else if (who === 'uso') {
    px(x, 4, bT + L.bodyH - 2, 8, 2, pal.body);
    px(x, 4, bodyBot, 8, 1, ol);
    px(x, 5, bT + 3, 6, 1, USO_PAL.belt);
    px(x, 8, bT + 3, 1, 1, USO_PAL.buckle);
  } else {
    px(x, 6, bT + L.bodyH - 2, 4, 1, pal.bodyS);
  }

  // brazos + lámpara de Mara en la mano delantera
  const offF = [1, 0, -1][f];
  px(x, 8, bT + offF, 3, 3, pal.body);
  px(x, 10, bT + offF + 3, 2, 1, pal.skin);
  px(x, 5, bT - offF, 2, 3, pal.bodyS);
  if (who === 'mara') {
    px(x, 12, bT + 1, 2, 1, MARA_PAL.glass);
    px(x, 12, bT + 2, 2, 2, MARA_PAL.lamp);
    px(x, 12, bT + 4, 2, 1, pal.outline);
  }

  // piernas en zancada (3 fases) — misma mecánica que buildHumanoid
  const ls = pal.bodyS; // pierna trasera en sombra, como el original
  if (f === 0) {
    px(x, 5, legY, 2, legH, ls); px(x, 8, legY, 2, legH, pal.legs);
    px(x, 5, bootY, 2, 1, pal.boots); px(x, 8, bootY, 2, 1, pal.boots);
  } else if (f === 1) {
    px(x, 6, legY, 2, legH, pal.legs); px(x, 8, legY + 1, 2, Math.max(1, legH - 1), ls);
    px(x, 6, bootY, 2, 1, pal.boots); px(x, 8, bootY, 2, 1, pal.boots);
  } else {
    px(x, 4, legY, 2, legH, ls); px(x, 7, legY, 2, legH, pal.legs);
    px(x, 4, bootY, 2, 1, pal.boots); px(x, 7, bootY, 2, 1, pal.boots);
  }
}

/** Piernas de frente/espalda (compartidas por down/up, 3 fases). */
function faroLegsFront(x: CanvasRenderingContext2D, pal: FaroPal, f: number, bob: number, L: FaroLayout): void {
  const bT = L.bodyTop + bob;
  const bodyBot = bT + L.bodyH - 1;
  const legY = bodyBot + 1;
  const bootY = L.H - 1;
  const legH = bootY - legY;
  const ls = pal.bodyS; // pierna en sombra = tono abrigo
  if (f === 0) {
    px(x, 4, legY, 3, legH, pal.legs); px(x, 9, legY, 3, legH, ls);
    px(x, 4, bootY, 3, 1, pal.boots); px(x, 9, bootY, 3, 1, pal.boots);
  } else if (f === 1) {
    px(x, 5, legY, 3, legH, pal.legs); px(x, 8, legY, 3, legH, pal.legs);
    px(x, 5, bootY, 3, 1, pal.boots); px(x, 8, bootY, 3, 1, pal.boots);
  } else {
    px(x, 4, legY + 1, 3, Math.max(1, legH - 1), ls); px(x, 9, legY, 3, legH, pal.legs);
    px(x, 4, bootY, 3, 1, pal.boots); px(x, 9, bootY, 3, 1, pal.boots);
  }
}

/**
 * buildFaroHumanoid — MISMO CONTRATO que buildHumanoid (sprites.ts):
 * 9 canvas 16×L.H en orden down×3, up×3, side×3 (fase 1 = pase con bob -1).
 */
function buildFaroHumanoid(who: 'mara' | 'uso' | 'tina'): Frames {
  const pal = who === 'mara' ? MARA_PAL : who === 'uso' ? USO_PAL : TINA_PAL;
  const L = who === 'tina' ? L_SMALL : L_ADULT;
  const frames: Frames = [];
  const dirs: ('down' | 'up' | 'side')[] = ['down', 'up', 'side'];
  for (const dir of dirs) {
    for (let f = 0; f < 3; f++) {
      const bob = f === 1 ? -1 : 0;
      const { c, x } = mkCanvas(16, L.H);
      faroFrame(x, who, pal, dir, f, bob, L);
      frames.push(c);
    }
  }
  return frames;
}

// ---------------- sprites: construcción + registro idempotente ----------------

/** Construye los 3 sprites del faro (27 frames). Expuesto para el smoke:
 *  dos llamadas deben producir dataURL idénticos (determinismo mulberry32). */
export function buildFaroSprites(): Record<string, Frames> {
  return {
    mara_farera: buildFaroHumanoid('mara'),
    uso_faro: buildFaroHumanoid('uso'),
    tina_faro: buildFaroHumanoid('tina'),
  };
}

let faroSpritesReady = false;

/** Registro idempotente en sprites.ts vía registerSpr(). El integrador lo
 *  llama desde el constructor de Game justo tras initExpansionSprites(). */
export function initFaroSprites(): void {
  if (faroSpritesReady) return;
  faroSpritesReady = true;
  const set = buildFaroSprites();
  for (const [name, frames] of Object.entries(set)) registerSpr(name, frames);
  // 18-e: retratos propios al registro privado de sprites.ts (función a
  // función — sin ciclo de módulo; PortraitDef estructuralmente compatible).
  mergeFaroPortraits(FARO_PORTRAITS as unknown as Parameters<typeof mergeFaroPortraits>[0]);
}

// ---------------- retratos (fusión en el registro privado de sprites.ts) ----------------

/**
 * Copia estructural de PortraitDef (sprites.ts — interfaz NO exportada):
 * kind 'human', cuadrícula 28×40 de drawPortrait. El integrador fusiona este
 * registro con Object.assign(PORTRAITS, FARO_PORTRAITS) dentro de initSprites()
 * (ver cabecera). Campos obligatorios de PortraitDef completos.
 */
export interface FaroPortraitDef {
  kind: 'human';
  bg: string;
  skin: string; skinS: string;
  hair: string; hairS?: string;
  eye: string;
  cloth: string; clothS: string;
  accent?: string;
  beard?: string;
  hood?: boolean; hoodCol?: string;
  hairLong?: boolean;
  child?: boolean;
}

export const FARO_PORTRAITS: Record<string, FaroPortraitDef> = {
  // Mara: gorro de lana rojo (hood=gorro con hoodCol), chubasquero azul, brillo de lámpara.
  mara_farera: {
    kind: 'human', bg: '#101c26',
    skin: '#e8b48c', skinS: '#c89068', hair: '#5a4a3e', hairS: '#4a3c32',
    eye: '#4a5a68', cloth: '#2e5a8a', clothS: '#24466e', accent: '#ffe9a0',
    hood: true, hoodCol: '#a8403e',
  },
  // Uso: canoso con barba de sal, gabardina kaki, hebilla de latón.
  uso_faro: {
    kind: 'human', bg: '#1a1710',
    skin: '#d8a878', skinS: '#b4885c', hair: '#9aa0a8', hairS: '#7a8088',
    eye: '#8aa0b8', cloth: '#5a5244', clothS: '#463f33', accent: '#b09a5a',
    beard: '#d8d8d0',
  },
  // Tina: ojos grandes de niña (child), coletas castañas, capa roja, concha.
  tina_faro: {
    kind: 'human', bg: '#1c1014',
    skin: '#f2cfa4', skinS: '#d0aa78', hair: '#8a5a30', hairS: '#6e4423',
    eye: '#4a6a5a', cloth: '#c04048', clothS: '#942e38', accent: '#f0e0c8',
    child: true, hairLong: true,
  },
};

// ---------------- FARO_DIALOGUES — «La lámpara que aprendió a temblar» ----------------
//
// Micro-arco (completable en cualquier orden uso→tina; Mara rema el arco):
//   1. USO no enciende la lámpara desde que «la luz aprendió a temblar»:
//      la noche que la lámpara contó los nombres de los barcos de atrás hacia
//      adelante (eco co_e1: «El farero que no se dormía», la abuela que cantaba
//      una nota por vuelta de engranaje).
//   2. TINA (la oreja de la abuela) jura que el faro CANTA de noche: tres notas
//      de la nana AL REVÉS — la Niebla robó la canción (mem_nana, Acto II) y el
//      faro la está devolviendo torcida.
//   3. MARA pide una noche de escucha junto al faro (faro_escucha). Recompensa:
//      +8 rep. Guardianes ('rep_guardianes_8') + 15 coronas (faroTick) + toasts.
//
// Los tres flags del arco van con el patrón 'flag_<clave>' de hooks.ts
// (handleCustomAction → g.flags[key] = true) — cero código nuevo en hooks.

export const FARO_DIALOGUES: Record<string, DialogueNode> = {
  // ----- USO, el farero tuerto (5,21) -----
  faro_uso_1: {
    name: 'Uso, el farero tuerto', portrait: 'uso_faro',
    text: 'Mara te manda, ¿eh? No hace falta que lo digas: tiene la misma cara que nuestra madre cuando quería algo. Mira —señala con la barbilla el faro—. Yo subí a esa lámpara cuarenta años. La abuela cantaba mientras daba cuerda: una nota por vuelta. Yo no canto. Yo ESCUCHO. Y una noche la luz empezó a temblar, y no le he vuelto a dar la cerilla.',
    options: [
      { text: 'No lo llamas miedo. Lo llamas escuchar. Cuéntame qué oíste.', next: 'faro_uso_emp', tone: 'empatico' },
      { text: 'Una lámpara que tiembla es una lámpara que avisa. Necesito el detalle exacto.', next: 'faro_uso_prag', tone: 'pragmatico' },
      { text: 'Cuarenta años de farero y lo que te echa atrás es un temblorcito. Vaya currículum.', next: 'faro_uso_sarc', tone: 'sarcastico' },
    ],
  },
  faro_uso_emp: {
    name: 'Uso, el farero tuerto', portrait: 'uso_faro',
    text: 'El viejo aprieta el parche, como si le molestara hasta el ojo que le queda. «Eso es. La abuela decía que la lámpara era un metrónomo: marcaba el compás de algo más grande. Cuando el dios murió, el compás se quedó sin música, pero el metrónomo siguió girando. Y el temblor, Portador... el temblor es lo que responde.»',
    next: 'faro_uso_2',
  },
  faro_uso_prag: {
    name: 'Uso, el farero tuerto', portrait: 'uso_faro',
    text: '«Detalle exacto, dice.» Escupe a la arena. «El temblor va CON el giro: la luz se dobla justo cuando el engranaje cambia de vuelta. Eso no lo hace el viento, ni el frío, ni mis ojos —y el ojo que me queda es bueno—. Algo de abajo lleva la cuenta. Y la lleva BIEN.»',
    next: 'faro_uso_2',
  },
  faro_uso_sarc: {
    name: 'Uso, el farero tuerto', portrait: 'uso_faro',
    text: '«Ríete.» No se ríe él. «El que no se dormía era yo: cuarenta noches velando la lámpara pa\' que nadie la apagara. Ahora hay algo ahí abajo que tampoco duerme, y yo, que ya velé bastante, me he jubilado del miedo. Tú que eres joven: sube tú alguna noche y ya me contarás qué se te figura el temblor.»',
    next: 'faro_uso_2',
  },
  faro_uso_2: {
    name: 'Uso, el farero tuerto', portrait: 'uso_faro',
    text: '«La noche que lo oí claro, conté los nombres. Los barcos que se llevó la Niebla, ¿sabes? La lámpara los iba diciendo de ATRÁS hacia ADELANTE, como quien deshace un punto de lana. Y cuando llegó al final... empezó de nuevo. —cierra el puño—. Yo encendía fuegos para que los barcos volvieran a casa. Ya no sé si lo que ahí arriba gira es un faro... o una lista de espera.»',
    onEnd: 'flag_faro_uso_hablado',
    options: [
      { text: '¿Y Tina? Dicen que el faro canta de noche.', next: 'faro_uso_3' },
      { text: 'Descansa, Uso. Yo subiré por ti esta noche.', tone: 'empatico' },
    ],
  },
  faro_uso_3: {
    name: 'Uso, el farero tuerto', portrait: 'uso_faro',
    text: '«Mi sobrina dice que el faro CANTA. La cría tiene la misma oreja que la abuela, y eso no es poca cosa. Yo no escucho canto: escucho el temblor. Quizá las dos cosas son la misma noticia con distintas palabras. Habla con ella, está detrás de la duna. Y si descubres qué es lo que la lámpara anda repeticiendo... dímelo con palabras de farero, no de poeta.»',
    options: [
      { text: '¿Y si el temblor es una llamada de auxilio?', next: 'faro_uso_4' },
      { text: 'Lo haré. Descansa, Uso.', tone: 'empatico' },
    ],
  },
  faro_uso_4: {
    name: 'Uso, el farero tuerto', portrait: 'uso_faro',
    text: '«Entonces que llame a alguien con mejor oído que el mío.» Mira al mar un rato largo. «Sácale la respuesta a la lámpara, Portador. A mí ya me valió con aprender a NO encenderla. Eso también es un oficio, aunque no pegue en los carteles.»',
    options: [{ text: '(Dejar al viejo con su mar y su oficio de silencios.)', tone: 'empatico' }],
  },
  faro_uso_id: {
    name: 'Uso, el farero tuerto', portrait: 'uso_faro',
    text: '«Sigo sin subir» —dice, sin pedirte que insistas—. Pero anoche, con la marea baja, la concha de la cría tintineó y yo... escuché. Solo escuchar. Todavía. Anda: pregunta a Mara por las cerillas que no gasto, que dicen que pesan.',
    options: [{ text: '(Dejarlo reposar con su secreto a medio abrir.)', tone: 'empatico' }],
  },
  faro_uso_id_emp: {
    name: 'Uso, el farero tuerto', portrait: 'uso_faro',
    text: '«...Si alguna vez subes tú a darle cuerda, canta algo. Lo que sea, no hace falta que sea bonito.» Se seca la mano en la gabardina, como si la palma recordara el escalón que no pisa. «La abuela tenía razón en una cosa: a la lámpara le gusta la compañía. Y a los que la encendimos, más.»',
    options: [{ text: 'La próxima vez que arda, cantaré contigo.', tone: 'empatico' }],
  },

  // ----- TINA, la niña del faro (9,20) -----
  faro_tina_1: {
    name: 'Tina, la niña del faro', portrait: 'tina_faro',
    text: '¡Un visitante! —la niña guarda la concha que frotaba contra su capa roja—. ¿Vienes a ver el faro? Mi tía Mara lo encendió hace poco, pero dice que todavía aprende a arder. Yo sé un secreto: el faro CANTA. De noche, con la marea baja, sale una canción por la linterna. ¿No la has oído? Es triste. Como cuando el tío Uso habla del mar, pero con nota.',
    options: [
      { text: 'Cántamela. La canción del faro, tal y como la oíste.', next: 'faro_tina_emp', tone: 'empatico' },
      { text: '¿Canta o rechina? Los engranajes viejos hacen las dos cosas.', next: 'faro_tina_prag', tone: 'pragmatico' },
      { text: 'Un faro con repertorio y nadie vende entradas. Qué desperdicio.', next: 'faro_tina_sarc', tone: 'sarcastico' },
    ],
  },
  faro_tina_emp: {
    name: 'Tina, la niña del faro', portrait: 'tina_faro',
    text: 'Tina entona tres notas, bajito y muy seria: la primera sube, la segunda baja, la tercera vuelve a subir y se queda colgando en el aire. «La oigo con la concha. Mi mamá dice que era de la abuela, y que las conchas guardan lo que el mar no se quiere quedar. La canción está triste porque le FALTAN las otras notas.»',
    next: 'faro_tina_2',
  },
  faro_tina_prag: {
    name: 'Tina, la niña del faro', portrait: 'tina_faro',
    text: '«¡Las dos cosas!» Tina chasca la lengua, toda una experta. «Rechina el engranaje, giro tras giro, y por debajo del rechinamiento va el canto. Primero pensé que era mi estómago» —se ríe— «pero la concha tintinea cuando canta, y las conchas no tienen estómago. Bueno, las ostras quizá. Pero mi concha no, que la conozco desde dentro.»',
    next: 'faro_tina_2',
  },
  faro_tina_sarc: {
    name: 'Tina, la niña del faro', portrait: 'tina_faro',
    text: '«¡Pues sí que es desperdicio!» —Tina decide no pillar la broma—. Deberías venir de noche. La tía Mara dice que el faro está aprendiendo otra vez a arder; yo digo que está aprendiendo otra vez a CANTAR. Con la concha se oye mejor. Mírala: brilla cuando suena. Las conchas no brillan por guasa.',
    next: 'faro_tina_2',
  },
  faro_tina_2: {
    name: 'Tina, la niña del faro', portrait: 'tina_faro',
    text: '«La canción que oigo son tres notas DEL REVÉS. Mi tía Mara canta una nana a los barcos —todas las fareras cantan, es ley— y era igualita pero al revés. Como cuando juegas a hablar al revés, pero con notas. La Niebla robó la canción y el faro la está devolviendo poquito a poco... a su manera torcida.» —abrazando la concha—. Si te fías de mí, escúchalo una noche entera. Las conchas saben esperar. Tú también puedes.',
    onEnd: 'flag_faro_tina_hablado',
    options: [
      { text: 'Una noche entera. Trato hecho.', tone: 'empatico' },
      { text: '¿Y por qué nadie más la oye?', next: 'faro_tina_3' },
    ],
  },
  faro_tina_3: {
    name: 'Tina, la niña del faro', portrait: 'tina_faro',
    text: '«¡Porque no ESCUCHAN!» —Tina patalea la arena—. El tío Uso está siempre mirando el temblor y la tía Mara está siempre mirando los barcos. Nadie mira el MEDIO, que es por donde va el canto. Tú escucha el medio, ¿vale? Promételo. Con la concha delante se promete mejor, pero tú hazlo así también.',
    options: [{ text: 'Lo prometo, Tina. El medio, la próxima noche.', tone: 'empatico' }],
  },
  faro_tina_id: {
    name: 'Tina, la niña del faro', portrait: 'tina_faro',
    text: '¡Ya estás aquí! —Tina te enseña la concha—. Escucha: el faro ensayó anoche. Se le notaba el esfuerzo, como cuando el tío Toln levanta el martillo grande. —bajito—. No se lo digas al tío Uso, que se asusta fácil para ser tan grande.',
    options: [{ text: 'Secreto de faro. Guardado.', tone: 'empatico' }],
  },
  faro_tina_feliz: {
    name: 'Tina, la niña del faro', portrait: 'tina_faro',
    text: '¡Lo oíste! ¡LO OÍSTE! —Tina da un brinco—. ¿Ves? El medio, te lo dije: el canto va por el medio. —cuelga la concha con mucho cuidado—. La abuela estaría contenta. Y la tía Mara también, aunque disimule con las cerillas. Ahora el faro ya no es el único que no duerme: ahora tiene con quién.',
    options: [{ text: 'Que siga ensayando. Tiene una oyente de primera fila.', tone: 'empatico' }],
  },

  // ----- MARA, la farera (7,19) — el HUB del arco -----
  faro_mara_u1: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: '¿Uso? Está ahí, apoyado en las rocas como siempre. —Mara afina la mecha sin levantar la vista—. Cuarenta años subiendo esa escalera y ahora ni la mira. Dice que la lámpara tiembla. Yo la volví a encender después de trescientos años y no veo ningún temblor... pero yo CANTO mientras doy la cuerda, como la abuela. Él escucha en silencio. Pregúntale qué oye quien no canta.',
    options: [
      { text: 'Iré. Nadie debería cargar solo con lo que oye.', next: 'faro_mara_u2', tone: 'empatico' },
      { text: 'Un testigo silencioso vale más que diez opinando. Voy.', next: 'faro_mara_u2', tone: 'pragmatico' },
      { text: 'La familia farera: una canta, otro escucha, y el faro con la palabra. Voy enseguida.', next: 'faro_mara_u2', tone: 'sarcastico' },
    ],
  },
  faro_mara_u2: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: '«Cuidado con lo que le despiertas» —dice Mara, y por primera vez se detiene—. Uso no cuenta aquella noche con nadie. Contar los nombres... eso solo se hace una vez en la vida y te cambia la voz para siempre. —vuelve a la mecha—. Pero ve. Si el faro tiembla, mejor que lo sepa alguien antes de que la próxima tormenta se lo pregunte muy fuerte.',
    options: [{ text: '(Volver con Mara cuando hayas hablado con Uso.)', tone: 'pragmatico' }],
  },
  faro_mara_t1: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: '¿Tina? —Mara sonríe a medias, la mitad preocupada—. Detrás de la duna, con su concha. Jura que el faro canta por las noches. Mi hermano dice que tiembla, yo digo que arde... esta familia lleva toda la vida discutiendo qué hace la misma luz. Si tú la oyes cantar, dímelo: lo que la cría oye de noche, de día no lo oye nadie.',
    options: [
      { text: 'La oiré. Las canciones de una niña son las que no mienten.', next: 'faro_mara_t2', tone: 'empatico' },
      { text: 'Tres versiones de la misma luz. Necesito oírla yo mismo.', next: 'faro_mara_t2', tone: 'pragmatico' },
      { text: 'Temblar, cantar, arder... El faro hace más vida social que la aldea entera.', next: 'faro_mara_t2', tone: 'sarcastico' },
    ],
  },
  faro_mara_t2: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: '«Con esa lengua no llegas viejo, Portador» —suelta una risa corta—. Pero lleva razón en algo: Tina tiene la oreja de la abuela, y la abuela encendía la lámpara CANTANDO, una nota por vuelta. Si la niña oye canto donde yo solo veo fuego, quizá el faro esté devolviendo lo que le enseñaron. Ve de noche. Y vuelve: me traes la canción si la encuentras.',
    options: [{ text: '(Volver con Mara cuando hayas hablado con Tina.)', tone: 'pragmatico' }],
  },
  faro_mara_o1: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: 'Mara aparta la cerilla y te mira de verdad por primera vez. «Necesito que hagas algo que yo no puedo: pasar UNA NOCHE entera junto al faro. Escucharlo. Sin cantar, sin contar nombres, sin esperar nada. Uso no sube, Tina duerme, y yo... yo canto, y cuando canto, la lámpara solo me contesta a mí. Tú no cantas. Tú vas a oír lo que la luz hace cuando nadie la dirige.»',
    options: [
      { text: 'Iré. Una noche entera junto a la lámpara.', next: 'faro_mara_o2', tone: 'empatico' },
      { text: 'Una noche. Dime exactamente qué tengo que escuchar.', next: 'faro_mara_o2', tone: 'pragmatico' },
      { text: 'Citas nocturnas con un faro. Mi agenda estaba vacía de todos modos.', next: 'faro_mara_o2', tone: 'sarcastico' },
    ],
  },
  faro_mara_o2: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: '«Escucha el TEMBLOR» —baja la voz—. El giro del engranaje es constante; el temblor, no. Mi hermano jura que la luz se dobla al cruzar los nombres. La cría jura que canta. Yo solo sé que cuando la lámpara se queda sola, la bruma se para a escuchar... y la bruma no se para nunca. Vuelve cuando lo hayas oído. O cuando no hayas oído nada: eso también dirá algo.',
    onEnd: 'flag_faro_escuchaPendiente',
    options: [
      { text: 'Volveré con lo que oiga.', tone: 'pragmatico' },
      { text: '¿Y si la lámpara no contesta?', next: 'faro_mara_o3' },
    ],
  },
  faro_mara_o3: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: '«Entonces contesta TÚ» —dice, con una calma que no es tranquilidad—. La abuela decía que una lámpara sola no es un faro: es una vela cara. Que la escuches es la mitad del oficio; que te oiga, la otra. Vete. La noche no espera a nadie que razone demasiado.',
    options: [{ text: '(Ir a escuchar el faro cuando caiga la noche.)', tone: 'empatico' }],
  },
  faro_mara_c1: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: '¿Ya? —Mara deja la cuerda a media vuelta—. Vas a tener que decirme algo, Portador, porque el faro a mí no me cuenta nada: yo canto, y punto. ¿Qué hiciste ahí abajo, en la noche? Y piénsala bien antes de hablar, que las fareras huelen el cuento antes que el humo.',
    options: [
      { text: 'La luz tiembla con el giro. Y debajo del temblor hay una nota que responde. No está sola.', next: 'faro_mara_fin', action: 'flag_faro_escucha', tone: 'empatico' },
      { text: 'Metronomía exacta: giro, temblor, respuesta. La lámpara lleva la cuenta de algo. Y algo la acompaña.', next: 'faro_mara_fin', action: 'flag_faro_escucha', tone: 'pragmatico' },
      { text: 'Tres notas desafinadas y una lámpara con insomnio. A tu faro le hace falta mejor público.', next: 'faro_mara_fin', action: 'flag_faro_escucha', tone: 'sarcastico' },
      { text: 'Aún no he pasado allí una noche entera. Vuelvo luego.', tone: 'pragmatico' },
    ],
  },
  faro_mara_fin: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: 'Mara escucha tu relato sin parpadear. Al acabar mira el faro un rato largo, como se mira a alguien que por fin habla. «Tiembla, canta y contesta. Tres testigos, tres versiones y ahora un forastero que lo confirma todo.» —se guarda la cerilla—. La abuela decía que el mar guarda las notas que faltan. Quizá la lámpara no temblaba de miedo: estaba PRACTICANDO. —te busca unas monedas—. Toma: las coronas de las cerillas que Uso no ha gastado este mes. Dile que las gaste en algo que no sea miedo.',
    onEnd: 'flag_faro_recompensa',
    options: [
      { text: 'La luz ya no está sola. Ni tu familia. Gracias por confiarme la noche.', action: 'rep_guardianes_8', tone: 'empatico' },
      { text: 'Una lámpara que practica es una lámpara que aprende. Apúntalo en el registro del faro.', action: 'rep_guardianes_8', tone: 'pragmatico' },
      { text: 'Un faro que ensaya en secreto. Cuando dé su primer concierto, quiero primera fila.', action: 'rep_guardianes_8', tone: 'sarcastico' },
    ],
  },
  faro_mara_fin_eco: {
    name: 'Mara, la farera', portrait: 'mara_farera',
    text: 'Mara escucha tu relato y después mira el mar, donde la Sirena ya no canta. «El Eco de las Mareas anda en tus manos y ahora esto. La abuela decía que el mar guarda las notas que faltan: entre el Eco y tu noche, el faro ya tiene con qué completarlas.» —te busca unas monedas—. Las coronas de las cerillas que Uso no ha gastado. Dile que las gaste en algo que no sea miedo.',
    onEnd: 'flag_faro_recompensa',
    options: [
      { text: 'Entre el Eco y la lámpara, la costa vuelve a tener música. Gracias.', action: 'rep_guardianes_8', tone: 'empatico' },
      { text: 'Dos pruebas, una conclusión: el faro practica. Que el registro lo diga.', action: 'rep_guardianes_8', tone: 'pragmatico' },
      { text: 'Un Eco en la mano y un faro en el karaoke. Esta costa se organiza mejor que la Liga.', action: 'rep_guardianes_8', tone: 'sarcastico' },
    ],
  },
};

// ---------------- ruteo de los 3 NPCs (1 línea en getDialogueActo4 de data.ts) ----------------

/** Copia de DialogueCtx (data.ts) sin importarlo: tipado estructural. */
export interface FaroDialogueCtx {
  questIdx: number;
  questStep: number;
  flags: Record<string, number | boolean>;
  companion: boolean;
}

/**
 * Ruteo del HUB del faro. Devuelve la clave del nodo o null para DELEGAR en
 * el ruteo original de data.ts (regresión 0). Prioridades respetadas:
 *  · mara en q6 (questIdx 5) → mara_intro (objetivo de misión, intocable).
 *  · mara tras la Sirena sin encender el faro → mara_react (mara_gift).
 *  · Acto III: acto3_eco_mara (q11 idx 10, s1) y acto3_mara_ayer (q12 idx 11).
 *  · arco completo (faro_recompensa) → null: los idle mara_idle* originales.
 */
export function faroRouteDialogue(nid: string, ctx: FaroDialogueCtx): string | null {
  const f = ctx.flags;
  if (nid === 'mara') {
    if (ctx.questIdx === 5) return null;                                    // q6: mara_intro
    if (f.sirenaDefeated && !f.maraGift) return null;                       // mara_react (enciende el faro)
    if (ctx.questIdx === 10 && ctx.questStep === 1 && !f.ecoInvMara) return null; // Acto III: eco invertido
    if (ctx.questIdx === 11 && !f.recMara) return null;                     // Acto III: el ayer de Mara
    if (!f.faro_uso_hablado) return 'faro_mara_u1';
    if (!f.faro_tina_hablado) return 'faro_mara_t1';
    if (!f.faro_escucha) return f.faro_escuchaPendiente ? 'faro_mara_c1' : 'faro_mara_o1';
    if (!f.faro_recompensa) return f.ecoMareas ? 'faro_mara_fin_eco' : 'faro_mara_fin';
    return null;                                                            // arco cerrado: rutas originales
  }
  if (nid === 'uso_faro') {
    if (!f.faro_uso_hablado) return 'faro_uso_1';
    // idle post-arco: variante cálida si el Portador es empático de dominante
    return typeof f.tonoDominante === 'string' && f.tonoDominante === 'empatico' ? 'faro_uso_id_emp' : 'faro_uso_id';
  }
  if (nid === 'tina_faro') {
    if (!f.faro_tina_hablado) return 'faro_tina_1';
    return f.faro_escucha ? 'faro_tina_feliz' : 'faro_tina_id';
  }
  return null;
}

// ---------------- faroTick — escucha nocturna + pago de la recompensa ----------------

// Costantes del prop del faro en costa (maps_expansion.ts): { id: 'faro_co', kind: 'faro', x: 6, y: 18 }
const FARO_MAP = 'costa';
const FARO_X = 6;
const FARO_Y = 18;
const FARO_RADIUS = 2.6;   // tiles: radio de «estar junto al faro» (interact del motor ≈ 2.1)
const RECOMPENSA_ORO = 15; // coronas de las cerillas de Uso

/**
 * Noche coherente con isNight() de update.ts (dayT > 0.7 || dayT < 0.08).
 * Copia deliberada de 1 línea (como duplican los helpers maps_expansion) para
 * NO crear una nueva arista de ciclo módulo→update.ts: update.ts importará a
 * este módulo (faroTick), no al revés.
 */
function isNightFaro(g: { dayT: number }): boolean {
  return g.dayT > 0.7 || g.dayT < 0.08;
}

/**
 * Tick O(1) del faro — el integrador lo llama desde update.ts junto a
 * interaccionTick (línea 384). Dos deberes, ambos idempotentes:
 *  1) PAGO DE LA RECOMPENSA: si el nodo final del arco cerró
 *     (flags.faro_recompensa vía onEnd 'flag_faro_recompensa') y aún no se
 *     pagó → +15 coronas con float/toast/sfx + stats.coronasGanadas.
 *     Única vía posible: engine.applyAction no tiene acción de oro y
 *     hooks.ts está congelado. Anti-doble-pago con flag faro_pagada
 *     (sobrevive guardado/carga porque save() serializa todos los flags).
 *  2) ESCUCHA NOCTURNA: de NOCHE en el presente, con el Portador junto al
 *     faro → flag faro_escucha + toast + sfx + ráfaga dorada (la "interacción
 *     de noche con el faro" pedida por el guion, sin tocar engine/worldlife).
 *     Ruta alternativa sin tick: re-hablar con Mara y contárselo (faro_mara_c1).
 */
export function faroTick(g: {
  player: { x: number; y: number; gold: number } | null;
  mapId: string;
  epoch: string;
  state: string;
  challengeRun: unknown;
  dayT: number;
  flags: Record<string, number | boolean>;
  stats: { coronasGanadas: number };
  toast(text: string, color?: string): void;
  burst(x: number, y: number, color: string, n: number, spd?: number): void;
  floatAt(x: number, y: number, text: string, color: string, size?: number): void;
}): void {
  const p = g.player;
  if (!p || g.challengeRun) return;

  // 1) pago único de la recompensa del arco (mapa-agnóstico: el nodo puede
  //    cerrarse y salir del mapa en el mismo frame)
  if (g.flags.faro_recompensa && !g.flags.faro_pagada) {
    g.flags.faro_pagada = true;
    p.gold += RECOMPENSA_ORO;
    g.stats.coronasGanadas += RECOMPENSA_ORO;
    g.floatAt(p.x, p.y - 14, `+${RECOMPENSA_ORO}`, '#f0c84a');
    g.toast('Mara paga las cerillas que Uso no gastó: +15 coronas', '#f0c84a');
    audio.sfx('coin');
  }

  // 2) la noche junto al faro (solo costa, presente, de noche, una vez)
  if (g.flags.faro_escucha) return;
  if (g.mapId !== FARO_MAP || g.epoch !== 'presente') return;
  if (!isNightFaro(g)) return;
  const fx = FARO_X * 16 + 8;
  const fy = FARO_Y * 16 + 8;
  if (Math.hypot(p.x - fx, p.y - fy) > FARO_RADIUS * 16) return;
  g.flags.faro_escucha = true;
  g.toast('Escuchas el faro: giro, temblor... y una nota que responde', '#ffe9a0');
  audio.sfx('lamp');
  g.burst(fx, fy - 20, '#ffe9a0', 12, 46);
}
