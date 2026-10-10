// ============================================================
// ECOS DE AELTHAR — NPCs v2 (R19)
//
// Todos los personajes con nombre pasan a la MARIONETA del Portador
// (puppet.ts): 32×38, volumen de 5 tonos, ojos 2×2, ropa por capas y
// objeto en la mano. Cada uno conserva su identidad de la biblia (colores
// de palettes.ts) pero gana complexión, peinado, tocado, prenda y objeto:
// Brisa con pañoleta y bastón, Toln robusto con delantal y martillo, Ilwen
// con orejas élficas y arco, Bram con chubasquero y caña…
//
// Se generan en el MISMO orden de 27 fotogramas que humanoid.ts (9 por
// dirección: 6 de andar + reposo, parpadeo y respiración), así que el
// motor, las cinemáticas y entityFrame los usan sin cambios. Se construyen
// PEREZOSAMENTE la primera vez que se dibujan (sprites.getSpr).
// ============================================================

import { sculptFigure, renderFigure, walkPose, idlePose, type FigLook, type FigDir } from './puppet';
import { heroFigLook } from './hero';

export const NPC_LOOKS: Record<string, FigLook> = {
  hero_alba: heroFigLook({ disc: 'alba', armor: 0, weapon: 0 }),
  hero_tejedor: heroFigLook({ disc: 'tejedor', armor: 0, weapon: 0 }),
  brisa: {
    build: 'old', skin: '#eabf9a', hair: '#d8dade', eyes: '#4a6a7a', hairStyle: 'bun',
    head: 'scarf', headC: '#c8ccd4', top: '#7a9a6e', sleeves: '#6a8a60', legs: '#6a6a62', boots: '#4a3a2a',
    belt: '#a08a5a', outfit: 'robe', cape: '#5e7a54', capeLong: false, trim: '#eccf96', emblem: '#e0b060',
    item: 'cane', itemC: '#8a6a42',
  },
  toln: {
    build: 'stout', skin: '#e0a87a', hair: '#6a4a2e', eyes: '#3a2a1a', hairStyle: 'short', beard: 'short', beardC: '#6a4a2e',
    head: 'bandana', headC: '#a8552a', top: '#8a5a33', sleeves: '#7a4e2c', legs: '#4a4440', boots: '#3a2c20', belt: '#a8552a',
    outfit: 'apron', apron: '#3e3a38', item: 'hammer',
  },
  ilwen: {
    build: 'thin', skin: '#f2d0a8', hair: '#8ad058', eyes: '#2a6a3e', hairStyle: 'pony', pointyEars: true,
    head: 'hood', headC: '#3e7d4c', top: '#3e7d4c', sleeves: '#2e5f3a', legs: '#4a5a3a', boots: '#54381e', belt: '#7a5a30',
    outfit: 'tunic', cape: '#2e5f3a', capeLong: false, trim: '#e8c860', item: 'bow',
  },
  sasha: {
    build: 'thin', skin: '#e8c49a', hair: '#2e2838', eyes: '#f0c040', glowEyes: true, hairStyle: 'short',
    head: 'hood', headC: '#3a3448', top: '#3a3448', sleeves: '#2a2438', legs: '#2e2a3a', boots: '#1a1622', belt: '#d0a440',
    outfit: 'vest', trim: '#d0a440', item: 'none',
  },
  brokk: {
    build: 'dwarf', skin: '#e8a878', hair: '#8a4a26', eyes: '#2a2a2a', hairStyle: 'short', beard: 'long', beardC: '#a44e28',
    head: 'helm', metal: '#9aa4b4', top: '#5a4a3a', sleeves: '#443828', legs: '#3e342a', boots: '#2e241a', belt: '#7a5a30',
    outfit: 'tunic', armor: 1, item: 'hammer',
  },
  maelis: {
    build: 'tall', skin: '#f0d8c0', hair: '#7ad8c8', eyes: '#2a8a8a', hairStyle: 'long',
    head: 'circlet', trim: '#e8f0ea', gem: '#8ae8e0', top: '#4aa8b0', sleeves: '#368088', skirt: '#368088',
    legs: '#3a8890', boots: '#2a6870', belt: '#e8f0ea', outfit: 'dress', item: 'none',
  },
  corvin: {
    build: 'thin', skin: '#eac8a0', hair: '#5a5a64', eyes: '#3a3a44', hairStyle: 'short',
    top: '#3e3e48', sleeves: '#2e2e38', legs: '#26262e', boots: '#22222a', belt: '#d8d8e2', outfit: 'coat',
    emblem: '#e8e8f0', item: 'book', itemC: '#6a3a2a',
  },
  kael: {
    build: 'tall', skin: '#f2d4b0', hair: '#e8e0c8', eyes: '#7a8894', hairStyle: 'pony',
    top: '#e8e6de', sleeves: '#c2c0b6', legs: '#b8b6ac', boots: '#8a887e', belt: '#78829a', outfit: 'tunic',
    armor: 3, metal: '#c8ccd4', trim: '#8a94a8', cape: '#78829a', capeLong: false, item: 'spear', blade: '#d8dce4',
  },
  inquisidor: {
    build: 'tall', skin: '#d8d4ca', hair: '#e4e2da', eyes: '#d8d4ca', hairStyle: 'short',
    head: 'helm', metal: '#e4e2da', top: '#e4e2da', sleeves: '#bcbab0', legs: '#b4b2a8', boots: '#86847a', belt: '#8a887e',
    outfit: 'robe', armor: 5, trim: '#8a887e', cape: '#e4e2da', capeLong: true, lining: '#bcbab0', item: 'spear', blade: '#e8e6e0',
  },
  teo: {
    build: 'child', skin: '#f2cfa4', hair: '#7a5432', eyes: '#3a2a1a', hairStyle: 'wild', freckles: true,
    top: '#c09a54', sleeves: '#9a7a40', legs: '#6f5c3e', boots: '#4a3a28', belt: '#7a5432', outfit: 'tunic', item: 'none',
  },
  doran: {
    build: 'normal', skin: '#d8b088', hair: '#3e6a34', eyes: '#2a3a24', hairStyle: 'long', beard: 'long', beardC: '#5a7a4a',
    head: 'hood', headC: '#3a6132', top: '#4d7c40', sleeves: '#3a6132', legs: '#3a5232', boots: '#4a3a22', belt: '#8ac05a',
    outfit: 'robe', cape: '#3a6132', capeLong: true, trim: '#8ac05a', item: 'staff', itemC: '#5a4228', gem: '#8ac05a',
  },
  nimue: {
    build: 'thin', skin: '#d4dcd2', hair: '#a8cabc', eyes: '#7ae8c0', glowEyes: true, hairStyle: 'long', pointyEars: true,
    top: '#4e7862', sleeves: '#3c5e4e', skirt: '#3c5e4e', legs: '#3e5a4c', boots: '#2e423c', belt: '#a8d8c4',
    outfit: 'dress', trim: '#a8d8c4', item: 'none',
  },
  merrow_h: {
    build: 'stout', skin: '#d8a878', hair: '#5a5a50', eyes: '#2a2a30', hairStyle: 'short', beard: 'short', beardC: '#6a6a5e',
    head: 'cap', headC: '#3a4a5a', top: '#5a6a6a', sleeves: '#465454', legs: '#3e4a50', boots: '#3a2e20', belt: '#8a7a5a',
    outfit: 'tunic', item: 'rod', itemC: '#7a5a3a',
  },
  merrow_m: {
    build: 'normal', skin: '#e0b088', hair: '#4a6a5e', eyes: '#2a3a34', hairStyle: 'bob',
    head: 'hood', headC: '#6a7a72', top: '#6a7a72', sleeves: '#525f58', legs: '#4a5450', boots: '#3a2e20', belt: '#9a8a6a',
    outfit: 'coat', item: 'basket', itemC: '#9a7a4a',
  },
  aldara: {
    build: 'normal', skin: '#e8b88a', hair: '#d8b878', eyes: '#3a2a20', hairStyle: 'braid',
    head: 'scarf', headC: '#ece0c0', top: '#a86a48', sleeves: '#8e5a3c', legs: '#6a5440', boots: '#4a3424', belt: '#7e4c32',
    outfit: 'apron', apron: '#ece0c0', item: 'basket', itemC: '#b8945a',
  },
  fenna: {
    build: 'thin', skin: '#e0c4a0', hair: '#5a8a3e', eyes: '#2a4a2a', hairStyle: 'long',
    head: 'hood', headC: '#4a6a42', top: '#4a6a42', sleeves: '#36502e', legs: '#4a4030', boots: '#3a2c1e', belt: '#a87a48',
    outfit: 'robe', trim: '#a87a48', item: 'book', itemC: '#5a7a3a',
  },
  bram: {
    build: 'stout', skin: '#d8a078', hair: '#c8c4b8', eyes: '#2a2a2a', hairStyle: 'short', beard: 'long', beardC: '#d0ccc0',
    head: 'widehat', headC: '#d8b040', trim: '#a8862a', top: '#d8b040', sleeves: '#c8a038', legs: '#3a4a5a', boots: '#2a3240', belt: '#5a6a7a',
    outfit: 'coat', item: 'rod', itemC: '#6a4a2a',
  },
  ysolde: {
    build: 'old', skin: '#dcc0a8', hair: '#ecece4', eyes: '#4a4a52', hairStyle: 'long',
    head: 'veil', headC: '#3a3448', top: '#3a3448', sleeves: '#2a2436', legs: '#2e2a38', boots: '#1e1a24', belt: '#5a4a3a',
    outfit: 'robe', emblem: '#ffcc66', item: 'lantern',
  },
  haldor: {
    build: 'tall', skin: '#e0b090', hair: '#e8e8e8', eyes: '#3a4a5a', hairStyle: 'long', beard: 'long', beardC: '#f0f0f0',
    head: 'hood', headC: '#8a7a68', top: '#8a7a68', sleeves: '#6a5c4c', legs: '#5a5048', boots: '#3a3430', belt: '#4a3a2a',
    outfit: 'coat', cape: '#6a5c4c', capeLong: false, lining: '#d8d0c0', item: 'staff', itemC: '#7a6a5a', gem: '#b8c8d8',
  },
  // enemigo humanoide: asesino de Vesh (capucha, ojos violeta, daga)
  sombra: {
    build: 'thin', skin: '#3a3050', hair: '#2c2440', eyes: '#b48fff', glowEyes: true, hairStyle: 'short',
    head: 'hood', headC: '#241c38', top: '#241c38', sleeves: '#181226', legs: '#181226', boots: '#100c1c', belt: '#3a2a50',
    outfit: 'coat', cape: '#181226', capeLong: true, lining: '#3a2a58', trim: '#9f7ae0',
    item: 'sword', blade: '#b8a0f0', bladeLen: 5,
  },
};

/** 27 fotogramas (orden de humanoid.ts): por dirección 6 de andar + reposo, parpadeo, respiración. */
export function buildNpcFrames(L: FigLook): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  const rim = L.glowEyes ? '#b8a0ff' : '#a8c4ff';
  for (const dir of ['down', 'up', 'side'] as FigDir[]) {
    for (let f = 0; f < 6; f++) out.push(renderFigure(sculptFigure(L, dir, walkPose(f, 6, false, dir)), L, rim));
    out.push(renderFigure(sculptFigure(L, dir, idlePose(0)), L, rim));
    out.push(renderFigure(sculptFigure(L, dir, idlePose(4)), L, rim));
    out.push(renderFigure(sculptFigure(L, dir, idlePose(1)), L, rim));
  }
  return out;
}
