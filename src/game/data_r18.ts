// ============================================================
// R18 · datos de los enemigos y mini-jefes de las secciones nuevas
// (módulo hoja: solo tipos — data.ts lo inyecta en ENEMY_DEFS sin ciclos)
// ============================================================

import type { EnemyDef } from './data';

export const ENEMY_DEFS_R18: Record<string, EnemyDef> = {
  cuervo: {
    name: 'Cuervo de Niebla', hp: 22, dmg: 6, speed: 72, xp: 14, gold: [3, 6], sprite: 'cuervo',
    aggroR: 115, atkR: 64, windup: 0.4, atkCd: 1.7, element: 'sombra', weakTo: 'rayo',
    desc: 'Aprendió a hablar la noche en que el molino se calló. Te rodea graznando y cae en picado. Débil al rayo.',
  },
  arana: {
    name: 'Araña Tejedora', hp: 30, dmg: 7, speed: 48, xp: 18, gold: [4, 8], sprite: 'arana',
    aggroR: 105, atkR: 96, windup: 0.6, atkCd: 2.3, element: 'sombra', weakTo: 'fuego',
    desc: 'Teje con hilo de niebla: quien queda atrapado olvida por dónde venía. Escupe telaraña que ralentiza. Débil al fuego.',
  },
  cangrejo: {
    name: 'Cangrejo de Acantilado', hp: 46, dmg: 9, speed: 46, xp: 22, gold: [6, 10], sprite: 'cangrejo',
    aggroR: 95, atkR: 22, windup: 0.55, atkCd: 1.9, element: 'hielo', weakTo: 'rayo',
    desc: 'Caparazón de marea dura. En guardia, sus pinzas paran los golpes de frente: rodéalo. Débil al rayo.',
  },
  fatuo: {
    name: 'Fuego Fatuo', hp: 18, dmg: 15, speed: 58, xp: 16, gold: [3, 6], sprite: 'fatuo',
    aggroR: 125, atkR: 24, windup: 0.9, atkCd: 1.0, element: 'fuego', weakTo: 'hielo',
    desc: 'Lo que queda de una vela cuando nadie recuerda por quién ardía. Se hincha y estalla: mátalo antes o apártate.',
  },
  reina_cuervo: {
    name: 'La Reina de los Cuervos', hp: 380, dmg: 11, speed: 66, xp: 170, gold: [70, 95], sprite: 'reina_cuervo',
    aggroR: 170, atkR: 30, windup: 0.6, atkCd: 1.5, element: 'sombra', weakTo: 'rayo', breakBar: 85,
    desc: 'Anidó en los engranajes del molino la noche del Silencio. Corona de plumas de oro y una bandada que obedece.',
  },
  ciervo: {
    name: 'El Ciervo de Ceniza', hp: 480, dmg: 14, speed: 58, xp: 210, gold: [80, 110], sprite: 'ciervo',
    aggroR: 170, atkR: 34, windup: 0.75, atkCd: 1.7, element: 'fuego', weakTo: 'hielo', breakBar: 105,
    desc: 'El guardián del Árbol Viejo. Su cornamenta arde con la ceniza que el árbol llora. Si embiste contra un muro, se aturde.',
  },
  rey_cangrejo: {
    name: 'El Rey Cangrejo', hp: 580, dmg: 15, speed: 40, xp: 250, gold: [90, 130], sprite: 'rey_cangrejo',
    aggroR: 165, atkR: 40, windup: 0.7, atkCd: 1.9, element: 'hielo', weakTo: 'rayo', breakBar: 135,
    desc: 'Todo lo que el mar devuelve es suyo. Su guardia de pinzas para los golpes de frente; su caparazón no.',
  },
  viuda: {
    name: 'La Viuda de Niebla', hp: 620, dmg: 15, speed: 46, xp: 270, gold: [100, 140], sprite: 'viuda',
    aggroR: 170, atkR: 60, windup: 0.8, atkCd: 1.8, element: 'sombra', weakTo: 'sagrado', breakBar: 125,
    desc: 'Lleva puestos los nombres que la Niebla robó al pantano. Se deshace en bruma y reaparece donde no la esperas.',
  },
  wendigo: {
    name: 'El Wendigo de Escarcha', hp: 740, dmg: 18, speed: 64, xp: 320, gold: [110, 160], sprite: 'wendigo',
    aggroR: 175, atkR: 30, windup: 0.6, atkCd: 1.5, element: 'hielo', weakTo: 'fuego', breakBar: 150,
    desc: 'Imita la voz de quien echas de menos. Salta sobre su presa desde lejos: mira dónde cae su sombra.',
  },
};

