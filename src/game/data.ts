// ============================================================
// ECOS DE AELTHAR — Datos: misiones, diálogos, enemigos, skills
// Todo el contenido vive en datos (arquitectura del GDD)
// ============================================================

import type { QuestDef, DialogueNode, EnemyType, Element } from './types';

// ---------------- Misiones (cadena principal de la demo) ----------------

export const QUESTS: QuestDef[] = [
  { id: 'q1', name: 'El Despertar', steps: ['Habla con la Anciana Brisa en la plaza de Lunaris'] },
  { id: 'q2', name: 'Lobos en la Niebla', steps: ['Caza 3 Lobos de Niebla en el sur del valle (0/3)', 'Vuelve con la Anciana Brisa'] },
  { id: 'q3', name: 'El Susurro del Bosque', steps: ['Viaja al Bosque Susurrante por el norte', 'Encuentra la Ruina Antigua y toca el Fragmento de Eco'] },
  { id: 'q4', name: 'La Cripta del Primer Canto', steps: ['Cruza el puente roto cambiando al pasado (Q)', 'Derrota al Guardián Hueco', 'Recupera el Eco de la Voz en el altar'] },
  { id: 'q5', name: 'Ecos de Esperanza', steps: ['Regresa con la Anciana Brisa a Lunaris'] },
];

// ---------------- Diálogos ----------------

export interface DialogueCtx { questIdx: number; questStep: number; flags: Record<string, number | boolean>; companion: boolean }

const D: Record<string, DialogueNode> = {
  // ----- Brisa -----
  brisa_intro: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Despierta, Portador. Tres noches dormiste junto al Santuario y tres noches soñaste con una voz que cantaba bajo la tierra. Esa voz tiene nombre: Aelthar.',
    next: 'brisa_intro2',
  },
  brisa_intro2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Hace 300 años, en la Noche del Silencio, el dios-tejedor fue asesinado. Su canto se partió en siete Ecos y desde entonces la Niebla Muda borra aldeas, recuerdos y nombres. Como la de Merrow, al sur.',
    next: 'brisa_intro3',
  },
  brisa_intro3: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Tú puedes OÍR los Ecos. El primer fragmento duerme en la Cripta del Primer Canto, al otro lado del Bosque. Pero antes... necesito saber si puedes sostener un arma.',
    options: [
      { text: '¿Qué es exactamente un Eco?', next: 'brisa_lore' },
      { text: 'Enséñame. Haré lo que haga falta.', next: 'brisa_quest2', action: 'accept_q2' },
    ],
  },
  brisa_lore: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Un Eco es un recuerdo del dios hecho cristal. Quien lo toca revive el pasado de esa tierra: verás el mundo como era, y en algunos lugares podrás alternar entre ambas épocas. Los Guardianes del Canto llevamos 300 años buscándolos. Y tú llegaste justo a tiempo.',
    next: 'brisa_quest2',
  },
  brisa_quest2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'La Niebla trae lobos del sur: han olido el Eco que duerme en ti. Caza a tres y el valle respirará. Habla con Toln si necesitas acero. Y... vuelve con vida, Portador.',
    onEnd: 'accept_q2',
  },
  brisa_wolves: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Los lobos aúllan hacia el sur, entre la niebla del valle. Usa la esquiva cuando vayan a saltar y golpea cuando bajen la guardia.',
  },
  brisa_reward: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El valle ya respira. Toma esto: coronas del fondo del pozo y una poción de la vieja receta. Los Guardianes del Canto te recordarán, Portador.',
    onEnd: 'accept_q3',
  },
  brisa_fragment: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '¿Lo sentiste? El Fragmento ha despertado tu resonancia: ahora puedes alternar entre el presente y el PASADO de estas tierras. Pulsa Q y mira el valle como era antes del Silencio.',
    next: 'brisa_fragment2',
  },
  brisa_fragment2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El puente del Bosque se rompió hace 300 años... pero en el pasado sigue en pie. Cruza, llega a la Cripta y recupera el Eco de la Voz. Que tu canto sea más fuerte que tu miedo.',
    onEnd: 'accept_q4',
  },
  brisa_crypt: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El puente solo existe en el pasado, Portador. Pulsa Q junto a él. Y dentro de la Cripta... no confíes en lo que la voz te prometa.',
  },
  brisa_final: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El Eco de la Voz... después de 300 años vuelve a sonar en Lunaris. Escucha: ahora la melodía tiene tu nombre entre sus notas. Los Guardianes ya cantan en la capilla. Esta era solo la primera nota, Portador: quedan seis Ecos... y la Niebla seguirá avanzando mientras no los reunas.',
    options: [
      { text: 'Iré tras los otros seis. (Terminar la demo)', action: 'end_demo' },
      { text: 'Aún tengo cosas que hacer por Velmora.', next: 'brisa_stay' },
    ],
  },
  brisa_stay: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Entonces descansa en los Santuarios, mejora tu acero con Toln y busca los ecos menores que susurran entre las ruinas. Velmora te necesita despierto, no apresurado. Vuelve cuando quieras terminar la demo.',
  },
  brisa_end: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Que el canto te acompañe. Nos vemos en la siguiente nota, Portador.',
    onEnd: 'end_demo',
  },
  brisa_idle: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El valle celebra tu nombre. Cuando quieras, la demo esperará tu decisión final conmigo.',
  },

  // ----- Toln -----
  toln_intro: {
    name: 'Maestro Toln', portrait: 'toln',
    text: '¡Ja! El viejo Brisa dijo que oíste Ecos. Yo oigo otra cosa: tu arma pidiendo filo. La forja sigue caliente, Portador, y el metal no pregunta por dioses.',
    options: [
      { text: 'Mejorar arma', next: 'toln_forge' },
      { text: 'Comprar poción (15 coronas)', next: 'toln_potion', action: 'buy_potion' },
      { text: '¿Qué sabes de la Noche del Silencio?', next: 'toln_lore' },
      { text: 'Hasta luego.', next: 'toln_bye' },
    ],
  },
  toln_forge: {
    name: 'Maestro Toln', portrait: 'toln',
    text: '(Usa esta conversación para mejorar: cada nivel de forja añade daño a tu arma. Las runas de mejora llegan hasta +5 en esta demo.)',
    options: [
      { text: 'Forjar (+1)', next: 'toln_intro', action: 'forge' },
      { text: 'Volver', next: 'toln_intro' },
    ],
  },
  toln_potion: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Para los caminos largos. Bebe con cabeza.',
    next: 'toln_intro',
  },
  toln_lore: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Mi abuelo forjó el arma que mató al dios. No lo digo con orgullo: lo digo con vergüenza. Desde entonces, cada martillazo mío es una disculpa. Si algún día vas a la Ciudadela... crimson sobre acero, recuerda mi nombre.',
    next: 'toln_intro',
  },
  toln_bye: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'El acero espera. Y cuidado con la niebla al sur: desde ahí no vuelven ni los nombres.',
  },

  // ----- Ilwen -----
  ilwen_intro: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Un Portador, aquí... ¿también tú oyes la Niebla robando nombres? Yo busco a mi hermana Naia: la Niebla se la llevó hacia el norte. Sé moverme entre estos árboles y mi arco no falla.',
    options: [
      { text: 'Ven conmigo. La buscaremos.', next: 'ilwen_join', action: 'recruit_ilwen' },
      { text: 'Sigo solo por ahora.', next: 'ilwen_wait' },
    ],
  },
  ilwen_join: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Entonces vamos, Portador. Cubriré tu espalda desde la distancia. Que los árboles nos encubran.',
  },
  ilwen_wait: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Te encontraré aquí si cambias de idea. El Bosque no perdona a los solitarios.',
  },
  ilwen_chat: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Naia cantaba mejor que las nereidas. Si la Niebla no borró su nombre, la encontraré. Cuenta con mi arco, Portador.',
  },

  // ----- Voces -----
  voz_fragment: {
    name: '???', portrait: 'fragment',
    text: '...¿quiéeeeen... despierta... el canto...? Ah... otro Portador. Otro pedazo de mí, perdido en el tiempo. Toma mi resonancia: alterna entre lo que fui y lo que soy. (Has desbloqueado el CAMBIO DE ÉPOCA: pulsa Q)',
    onEnd: 'fragment_touched',
  },
  voz_vesh: {
    name: 'Gran Inquisidor Vesh', portrait: 'sombra',
    text: 'Puedo oírte, Portador. Cada paso que das hacia el Eco resuena en MI ciudadela. Sube. Reúne las migajas de tu dios... y yo recogeré lo que quede de ti.',
  },
  voz_guardian: {
    name: 'Guardián Hueco', portrait: 'guardian',
    text: 'CORO... ROTO. CANTO... VACÍO. TÚ... LLEVAS... RESONANCIA. LA... QUIERO.',
  },
  eco_voz: {
    name: 'Eco de la Voz', portrait: 'fragment',
    text: 'El primer canto vuelve a nacer entre tus manos. «Cuando el miedo te hable, canta más alto.» (Eco de la Voz recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)',
    onEnd: 'eco_taken',
  },
};

export function getDialogue(nid: string, ctx: DialogueCtx): string {
  const q = ctx.questIdx, s = ctx.questStep;
  if (nid === 'brisa') {
    if (ctx.flags.demoEnded) return 'brisa_idle';
    if (q === 0) return 'brisa_intro';
    if (q === 1) return s === 0 ? 'brisa_wolves' : 'brisa_reward';
    if (q === 2) return ctx.flags.fragmentTouched ? 'brisa_fragment' : 'brisa_wolves';
    if (q === 3) return ctx.flags.guardianDefeated ? 'brisa_final' : 'brisa_crypt';
    return 'brisa_final';
  }
  if (nid === 'toln') return 'toln_intro';
  if (nid === 'ilwen') return ctx.companion ? 'ilwen_chat' : 'ilwen_intro';
  return 'brisa_idle';
}

export const DIALOGUES = D;

// ---------------- Enemigos ----------------

export interface EnemyDef {
  name: string;
  hp: number;
  dmg: number;
  speed: number;
  xp: number;
  gold: [number, number];
  sprite: string;
  aggroR: number;
  atkR: number;
  windup: number;      // s de telegrafía
  atkCd: number;
  element: Element;
  weakTo: Element;
  breakBar?: number;   // barra de quiebre (jefe)
  desc: string;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  lobo: {
    name: 'Lobo de Niebla', hp: 30, dmg: 6, speed: 58, xp: 16, gold: [4, 8],
    sprite: 'lobo', aggroR: 95, atkR: 20, windup: 0.45, atkCd: 1.5,
    element: 'sombra', weakTo: 'fuego',
    desc: 'Perro guardián corrompido por la Niebla. Ataca en estampidas. Débil al fuego.',
  },
  esqueleto: {
    name: 'Esqueleto Cantor', hp: 46, dmg: 10, speed: 44, xp: 24, gold: [7, 12],
    sprite: 'esqueleto', aggroR: 90, atkR: 22, windup: 0.6, atkCd: 1.8,
    element: 'sombra', weakTo: 'sagrado',
    desc: 'Peregrino que cantó hasta vaciarse. Golpea con su fémula de tambor. Débil a la luz.',
  },
  sombra: {
    name: 'Sombra sin Rostro', hp: 30, dmg: 8, speed: 66, xp: 18, gold: [3, 6],
    sprite: 'sombra', aggroR: 110, atkR: 20, windup: 0.4, atkCd: 1.2,
    element: 'sombra', weakTo: 'sagrado',
    desc: 'Criatura de la Niebla. Devora nombres. Rápida y frágil.',
  },
  guardian: {
    name: 'Guardián Hueco', hp: 420, dmg: 15, speed: 40, xp: 220, gold: [120, 160],
    sprite: 'guardian', aggroR: 150, atkR: 40, windup: 0.8, atkCd: 2.2,
    element: 'sombra', weakTo: 'ninguno', breakBar: 90,
    desc: 'Primer coro de Aelthar, vaciado por su propio canto. Rompe su barra de quiebre con golpes continuos.',
  },
};

// ---------------- Habilidades ----------------

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  cost: number;   // resonancia
  cd: number;     // s
  icon: string;   // glifo de 2 caracteres
  element: Element;
}

export const SKILLS: Record<'alba' | 'tejedor', SkillDef[]> = {
  alba: [
    { id: 'tajo', name: 'Tajo Lunar', desc: 'Embestida con el filo por delante.', cost: 25, cd: 3, icon: '◤', element: 'ninguno' },
    { id: 'grito', name: 'Grito de Guerra', desc: '+50% de daño durante 8 s.', cost: 40, cd: 14, icon: '║', element: 'ninguno' },
    { id: 'muro', name: 'Muro de Alba', desc: 'Onda de escudo que aturde a tu alrededor.', cost: 45, cd: 9, icon: '◈', element: 'sagrado' },
    { id: 'filo', name: 'Filo del Alba', desc: 'Definitiva: tres ondas giratorias de luz.', cost: 100, cd: 18, icon: '✹', element: 'sagrado' },
  ],
  tejedor: [
    { id: 'ascuas', name: 'Canto de Ascuas', desc: 'Nota de FUEGO: proyectil que quema.', cost: 20, cd: 1.2, icon: '▲', element: 'fuego' },
    { id: 'escarcha', name: 'Canto de Escarcha', desc: 'Nota de HIELO: congela y ralentiza.', cost: 25, cd: 2.2, icon: '▼', element: 'hielo' },
    { id: 'chispa', name: 'Canto de Chispa', desc: 'Nota de RAYO: rebota entre enemigos.', cost: 30, cd: 3, icon: '≫', element: 'rayo' },
    { id: 'cantomayor', name: 'Canto Mayor', desc: 'Hechizo mayor con tu última nota usada.', cost: 100, cd: 15, icon: '✺', element: 'ninguno' },
  ],
};

// ---------------- Objetos clave ----------------

export const KEY_ITEMS: Record<string, { name: string; desc: string }> = {
  fragment: { name: 'Fragmento de Eco', desc: 'Despierta tu resonancia: permite alternar entre presente y pasado (Q).' },
  ecoVoz: { name: 'Eco de la Voz', desc: 'Primer Eco de Aelthar. La melodía principal ahora lleva tu nombre.' },
};

// ---------------- Atributos ----------------

export const ATTR_INFO: { id: 'fue' | 'des' | 'int' | 'esp' | 'vig'; name: string; desc: string }[] = [
  { id: 'fue', name: 'Fuerza', desc: '+1,5 daño melé por punto' },
  { id: 'des', name: 'Destreza', desc: '+2% crítico y +2 resistencia máx.' },
  { id: 'int', name: 'Intelecto', desc: '+1,6 daño de Cantos por punto' },
  { id: 'esp', name: 'Espíritu', desc: '+10% ganancia de Resonancia' },
  { id: 'vig', name: 'Vigor', desc: '+7 vida máx. y +1% reducción' },
];
