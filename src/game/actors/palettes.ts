// ============================================================
// ECOS DE AELTHAR — Registro de paletas de humanoides (actors)
// Paletas de la biblia: héroes, NPCs, enemigos humanoides.
// ============================================================

import type { HumanPal } from './humanoid';

// ---------------- Registro de paletas ----------------

const PALS: Record<string, HumanPal> = {
  hero_alba: {
    outline: '#2a1a20', hair: '#c8384a', hairS: '#9a2438', skin: '#f2c99c',
    body: '#cdd3de', bodyS: '#9aa3b4', accent: '#c8384a',
    legs: '#5a6070', legsS: '#474c5a', boots: '#6d4520', eye: '#2a2a3a', hood: true,
  },
  hero_tejedor: {
    outline: '#241a30', hair: '#8a5ac0', hairS: '#6a3f9a', skin: '#f2c99c',
    body: '#7e58b8', bodyS: '#5e3f92', accent: '#f0c84a',
    legs: '#4a3a6a', legsS: '#3c2f58', boots: '#3a2c50', eye: '#3ae0c8', hood: true,
  },
  brisa: {
    outline: '#2a2a30', hair: '#d8dade', hairS: '#b0b4bc', skin: '#eabf9a',
    body: '#7a9a6e', bodyS: '#5e7a54', accent: '#e8d8a8',
    legs: '#6a6a62', boots: '#4a3a2a', eye: '#3a3a3a',
  },
  toln: {
    outline: '#241a14', hair: '#6a4a2e', hairS: '#54381e', skin: '#e0a87a',
    body: '#8a5a33', bodyS: '#6d4520', accent: '#3a3a3e',
    legs: '#4a4440', boots: '#3a2c20', eye: '#2a2a2a', beard: '#6a4a2e',
  },
  ilwen: {
    outline: '#1c2a1e', hair: '#8ad058', hairS: '#64a83e', skin: '#f2d0a8',
    body: '#3e7d4c', bodyS: '#2e5f3a', accent: '#e8c860',
    legs: '#4a5a3a', boots: '#54381e', eye: '#2a4a2e', ears: 'elf',
  },
  esqueleto: {
    outline: '#20201e', hair: '#e6e0c8', hairS: '#c2bc9e', skin: '#e6e0c8',
    body: '#d8d2b4', bodyS: '#a8a284', accent: '#7a7460',
    legs: '#c8c2a4', legsS: '#a8a284', boots: '#8a8468', eye: '#e04838', ribs: true,
  },
  sombra: {
    outline: '#100c1c', hair: '#2c2440', hairS: '#201a30', skin: '#2c2440',
    body: '#241c38', bodyS: '#181226', accent: '#9f7ae0',
    legs: '#181226', boots: '#100c1c', eye: '#b48fff', hood: true,
  },
  // ----- Nuevos personajes de la biblia (agente 3-a) -----
  sasha: {
    // Kaari felina ladrona: capucha oscura, ojos dorados, ágil
    outline: '#16121e', hair: '#2e2838', hairS: '#221c2c', skin: '#e8c49a',
    body: '#3a3448', bodyS: '#2a2438', accent: '#c89a3a',
    legs: '#2e2a3a', legsS: '#242030', boots: '#1a1622', eye: '#f0c040',
    hood: true, ears: 'cat',
  },
  brokk: {
    // Enano Durn: ancho, barba rojiza trenzada, martillo
    outline: '#241408', hair: '#8a4a26', hairS: '#6d3a1e', skin: '#e8a878',
    body: '#5a4a3a', bodyS: '#443828', accent: '#b07030',
    legs: '#3e342a', boots: '#2e241a', eye: '#2a2a2a', beard: '#a44e28', hammer: true,
  },
  maelis: {
    // Nereida sacerdotisa: perla y turquesa, serena
    outline: '#12303a', hair: '#7ad8c8', hairS: '#54b0a4', skin: '#f0d8c0',
    body: '#4aa8b0', bodyS: '#368088', accent: '#e8f0ea',
    legs: '#3a8890', boots: '#2a6870', eye: '#2a8a8a', hairLong: true,
  },
  corvin: {
    // Erudito desertor: túnica gris oscura elegante, sarcástico
    outline: '#181820', hair: '#5a5a64', hairS: '#42424a', skin: '#eac8a0',
    body: '#3e3e48', bodyS: '#2e2e38', accent: '#8a8a96',
    legs: '#33333c', boots: '#22222a', eye: '#3a3a44',
  },
  kael: {
    // Inquisidora de la Orden: armadura blanca, fría
    outline: '#3a3a44', hair: '#e8e0c8', hairS: '#c8bc9c', skin: '#f2d4b0',
    body: '#e8e6de', bodyS: '#c2c0b6', accent: '#8a94a8',
    legs: '#b8b6ac', boots: '#8a887e', eye: '#7a8894', pauldrons: true,
  },
  inquisidor: {
    // GRAN Inquisidor: armadura blanca sin adornos, máscara lisa, alto
    outline: '#2a2a30', hair: '#e4e2da', hairS: '#c6c4ba', skin: '#d8d4ca',
    body: '#e4e2da', bodyS: '#bcbab0', accent: '#8a887e',
    legs: '#b4b2a8', boots: '#86847a', eye: '#d8d4ca', mask: true, maskC: '#d8d4ca', big: true,
  },
  teo: {
    // Niño de unos 8 años, pelo revuelto
    outline: '#2a1e14', hair: '#7a5432', hairS: '#5e4026', skin: '#f2cfa4',
    body: '#c09a54', bodyS: '#9a7a40', accent: '#7a5432',
    legs: '#6a5a40', boots: '#4a3a28', eye: '#3a2a1a', small: true, messy: true,
  },
  doran: {
    // Druida del Círculo Verde: verde musgo, capucha de hojas
    outline: '#16241a', hair: '#3e6a34', hairS: '#2e5226', skin: '#d8b088',
    body: '#4a7a3e', bodyS: '#375e2e', accent: '#8ac05a',
    legs: '#3a5232', boots: '#4a3a22', eye: '#2a3a24', hood: true, leafy: true,
  },
  nimue: {
    // Elfa pálida espectral (verde wisp)
    outline: '#1a2a26', hair: '#b8d8c8', hairS: '#94b8a8', skin: '#e4e8de',
    body: '#5a8a72', bodyS: '#446a58', accent: '#bff0dc',
    legs: '#4a6a5a', boots: '#38504a', eye: '#7ae8c0', ears: 'elf', hairLong: true,
  },
};


export { PALS };
