// ============================================================
// ECOS DE AELTHAR — Registro de paletas de humanoides (actors)
// Paletas de la biblia: héroes, NPCs, enemigos humanoides.
//
// R2-A6 — IDENTIDAD VISUAL por personaje (silueta a 3 m):
//  · Cada paleta usa flags EXISTENTES de HumanPal (hood, beard,
//    hairLong, pauldrons, hammer, ears, messy, small, big, mask,
//    leafy) + los aditivos nuevos de R2-A6 (chest, beardS, cape,
//    capeC, capeLong, feather, band) para que cada NPC tenga
//    2-3 marcas de identidad legibles en sprite 16×18.
//  · 3 tonos por zona: pelo base+hairS, cuerpo base+bodyS,
//    piernas base+legsS (añadido donde faltaba) y accent.
//  · Se respeta la familia cromática de identidad: rojo alba
//    (hero_alba), violeta tejedor (hero_tejedor), verde elfo
//    (ilwen/nimue) — solo se afinan tonos, nunca se cambia de hue.
//  · esqueleto y sombra: NO se tocan (terror ya horneado por R2-A1).
// ============================================================

import type { HumanPal } from './humanoid';

// ---------------- Registro de paletas ----------------

const PALS: Record<string, HumanPal> = {
  // --- HÉROES ---
  hero_alba: {
    // Ruby/Portador: capucha roja alba + hombreras de cuero rojo
    // (pauldrons toman el accent) + emblema del alba 1px dorado en el pecho.
    outline: '#2a1a20', hair: '#c8384a', hairS: '#9a2438', skin: '#f2c99c',
    body: '#cdd3de', bodyS: '#9aa3b4', accent: '#c8384a',
    legs: '#5a6070', legsS: '#474c5a', boots: '#6d4520', eye: '#2a2a3a', hood: true,
    pauldrons: true, chest: '#e8c04a',
  },
  hero_tejedor: {
    // Tejedor: túnica violeta (familia intacta) + capa corta del tono
    // de sombra con bordado dorado (bordado = accent aclarado, en humanoid).
    outline: '#241a30', hair: '#8a5ac0', hairS: '#6a3f9a', skin: '#f2c99c',
    body: '#7e58b8', bodyS: '#5e3f92', accent: '#f0c84a',
    legs: '#4a3a6a', legsS: '#3c2f58', boots: '#3a2c50', eye: '#3ae0c8', hood: true,
    cape: true, // capeC → bodyS violeta; bordado dorado automático
  },

  // --- NPCs de la biblia ---
  brisa: {
    // Anciana sabia: chal (hood con hair gris perla = pañoleta, ondea en
    // idle) + broche cálido 1px en el pecho. No hay flag de bastón
    // (hammer es el martillo de Brokk): se documenta el recorte.
    outline: '#2a2a30', hair: '#d8dade', hairS: '#b0b4bc', skin: '#eabf9a',
    body: '#7a9a6e', bodyS: '#5e7a54', accent: '#eccf96',
    legs: '#6a6a62', legsS: '#565650', boots: '#4a3a2a', eye: '#3a3a3a',
    hood: true, chest: '#e0b060',
  },
  toln: {
    // Herrero: barba castaña + delantal oscuro leído como bodyS carbón
    // (fila alta y medios tonos del torso) + accent naranja quemado
    // (cinturón/hebilla = rescoldo) + rescoldo tenue 1px en el pecho.
    outline: '#241a14', hair: '#6a4a2e', hairS: '#54381e', skin: '#e0a87a',
    body: '#8a5a33', bodyS: '#3e3a38', accent: '#a8552a',
    legs: '#4a4440', legsS: '#3a3632', boots: '#3a2c20', eye: '#2a2a2a', beard: '#6a4a2e',
    chest: '#a85428',
  },
  ilwen: {
    // Compañera elfa arquera: capucha VERDE (hood usa el hair verde,
    // familia intacta) + pluma 1px dorada en el hombro derecho
    // (feather) + orejas élficas. Sin arco (hammer es de Brokk).
    outline: '#1c2a1e', hair: '#8ad058', hairS: '#64a83e', skin: '#f2d0a8',
    body: '#3e7d4c', bodyS: '#2e5f3a', accent: '#e8c860',
    legs: '#4a5a3a', legsS: '#3a4830', boots: '#54381e', eye: '#2a4a2e',
    ears: 'elf', hood: true, feather: true,
  },
  sasha: {
    // Ladrona felina: capucha oscura + orejas de gato + ojos dorados.
    // La cola de 2px no cabe limpia en 16×18 → fallback de la biblia:
    // cinturón con hebilla dorada (buckle = accent ×1.6, ya dorado).
    outline: '#16121e', hair: '#2e2838', hairS: '#221c2c', skin: '#e8c49a',
    body: '#3a3448', bodyS: '#2a2438', accent: '#d0a440',
    legs: '#2e2a3a', legsS: '#242030', boots: '#1a1622', eye: '#f0c040',
    hood: true, ears: 'cat',
  },
  brokk: {
    // Enano herrero: hombros anchos (pauldrons con accent HIERRO) +
    // barba rojiza trenzada (beard base + beardS oscuro en zigzag) +
    // martillo en la mano.
    outline: '#241408', hair: '#8a4a26', hairS: '#6d3a1e', skin: '#e8a878',
    body: '#5a4a3a', bodyS: '#443828', accent: '#9aa4b4',
    legs: '#3e342a', legsS: '#302822', boots: '#2e241a', eye: '#2a2a2a',
    beard: '#a44e28', beardS: '#7c3a1e', hammer: true, pauldrons: true,
  },
  maelis: {
    // Sacerdotisa nereida: melena larga turquesa + diadema perla 1px
    // (band con accent perla) + faja perla (accent en el cinturón).
    outline: '#12303a', hair: '#7ad8c8', hairS: '#54b0a4', skin: '#f0d8c0',
    body: '#4aa8b0', bodyS: '#368088', accent: '#e8f0ea',
    legs: '#3a8890', legsS: '#2e6e76', boots: '#2a6870', eye: '#2a8a8a',
    hairLong: true, band: true,
  },
  corvin: {
    // Erudito sarcástico: gorguera/alfilero claro en el cuello (chest
    // blanco hueso) + faja blanca (accent claro) + túnica larga con
    // piernas hundidas en sombra (legs más oscuros que la túnica).
    outline: '#181820', hair: '#5a5a64', hairS: '#42424a', skin: '#eac8a0',
    body: '#3e3e48', bodyS: '#2e2e38', accent: '#d8d8e2',
    legs: '#26262e', legsS: '#1e1e26', boots: '#22222a', eye: '#3a3a44',
    chest: '#e8e8f0',
  },
  kael: {
    // Inquisidora fría: hombreras plateadas (pauldrons, accent acero)
    // + capa corta de acero (capeC) con bordado aclarado + mirada hielo.
    outline: '#3a3a44', hair: '#e8e0c8', hairS: '#c8bc9c', skin: '#f2d4b0',
    body: '#e8e6de', bodyS: '#c2c0b6', accent: '#8a94a8',
    legs: '#b8b6ac', legsS: '#9a988e', boots: '#8a887e', eye: '#7a8894',
    pauldrons: true, cape: true, capeC: '#78829a',
  },
  inquisidor: {
    // GRAN Inquisidor: escala ×2, armadura casi blanca SIN adornos
    // (sin chest), accent gris y CAPA LARGA blanca hasta el cinturón
    // + máscara lisa sin rasgos.
    outline: '#2a2a30', hair: '#e4e2da', hairS: '#c6c4ba', skin: '#d8d4ca',
    body: '#e4e2da', bodyS: '#bcbab0', accent: '#8a887e',
    legs: '#b4b2a8', legsS: '#98968c', boots: '#86847a', eye: '#d8d4ca',
    mask: true, maskC: '#d8d4ca', big: true, cape: true, capeC: '#e4e2da', capeLong: true,
  },
  teo: {
    // Niño de ~8 años: proporciones small + pelo revuelto (messy) +
    // pantalón remangado: legs y legsS en dos tonos distintos (cada
    // pierna alterna de color al andar = doblez leíble). Sin pecas
    // (demasiado fino para 16×18, decisión documentada).
    outline: '#2a1e14', hair: '#7a5432', hairS: '#5e4026', skin: '#f2cfa4',
    body: '#c09a54', bodyS: '#9a7a40', accent: '#7a5432',
    legs: '#6f5c3e', legsS: '#96784a', boots: '#4a3a28', eye: '#3a2a1a',
    small: true, messy: true,
  },
  doran: {
    // Druida del Círculo Verde: capucha de hojas (hood + leafy con el
    // verde brote fijo de humanoid, igual al accent) + manto musgo más
    // profundo. Sin vara (no hay flag; decisión de la biblia).
    outline: '#16241a', hair: '#3e6a34', hairS: '#2e5226', skin: '#d8b088',
    body: '#4d7c40', bodyS: '#3a6132', accent: '#8ac05a',
    legs: '#3a5232', legsS: '#2e4228', boots: '#4a3a22', eye: '#2a3a24',
    hood: true, leafy: true,
  },
  nimue: {
    // Elfa espectral: translucidez SIMULADA — paleta apagada/desaturada
    // (verde familia intacta) + vetas de niebla espectral (dreadC verde
    // pálido) + ojos que alternan glow teal/vacío (dreadEye) + postura
    // levemente encorvada que trae el modo dread. Orejas élficas + melena.
    outline: '#1a2a26', hair: '#a8cabc', hairS: '#86a898', skin: '#d4dcd2',
    body: '#4e7862', bodyS: '#3c5e4e', accent: '#a8d8c4',
    legs: '#3e5a4c', legsS: '#32483e', boots: '#2e423c', eye: '#7ae8c0',
    ears: 'elf', hairLong: true,
    dread: true, dreadC: '#bff0dc', dreadEye: '#7ae8c0',
  },

  // --- Aldea de Merrow (Acto II · pescadores; reservadas por main) ---
  merrow_h: {
    // Pescador de Merrow: jersey de trabajo descolorido, barba canosa
    outline: '#1c222a', hair: '#5a5a50', hairS: '#46463e', skin: '#d8a878',
    body: '#5a6a6a', bodyS: '#465454', accent: '#8a7a5a',
    legs: '#3e4a50', legsS: '#333e44', boots: '#3a2e20', eye: '#2a2a30', beard: '#6a6a5e',
  },
  merrow_m: {
    // Pescadora de Merrow: capucha de marinar y gabardina verde agua
    outline: '#241c22', hair: '#4a6a5e', hairS: '#3a544a', skin: '#e0b088',
    body: '#6a7a72', bodyS: '#525f58', accent: '#9a8a6a',
    legs: '#4a5450', legsS: '#3c443f', boots: '#3a2e20', eye: '#2a3a34', hood: true,
  },

  // --- Enemigos humanoides (terror horneado por R2-A1 — NO TOCAR) ---
  esqueleto: {
    outline: '#20201e', hair: '#e6e0c8', hairS: '#c2bc9e', skin: '#e6e0c8',
    body: '#d8d2b4', bodyS: '#a8a284', accent: '#7a7460',
    legs: '#c8c2a4', legsS: '#a8a284', boots: '#8a8468', eye: '#e04838', ribs: true,
    dread: true, jaw: true, // R2-A1: terror sutil (ojos brasa/niebla/encorvado) + mandíbula suelta
  },
  sombra: {
    outline: '#100c1c', hair: '#2c2440', hairS: '#201a30', skin: '#2c2440',
    body: '#241c38', bodyS: '#181226', accent: '#9f7ae0',
    legs: '#181226', boots: '#100c1c', eye: '#b48fff', hood: true,
    dread: true, // R2-A1: terror sutil (ojos ámbar/vacío, niebla violeta, encorvado)
  },
};


export { PALS };
