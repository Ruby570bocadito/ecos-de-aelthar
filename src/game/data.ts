// ============================================================
// ECOS DE AELTHAR — Datos: misiones, diálogos, enemigos, skills
// Todo el contenido vive en datos (arquitectura del GDD)
// ============================================================

import type { QuestDef, DialogueNode, DialogueOption, EnemyType, Element, ToneKind } from './types';

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

// ---------------- Memorias del Portador (biblia: cada Eco devuelve un recuerdo) ----------------
// Contrato: screens.ts (pestaña Diario) y hooks.ts (overlay memoryReveal) leen esta tabla.

export interface MemoryDef { id: string; title: string; text: string }

export const MEMORIES: Record<string, MemoryDef> = {
  mem_nana: {
    id: 'mem_nana',
    title: 'Memoria I · La nana',
    text: 'Una voz aflora en tu mente: alguien te arrulla junto al río y tararea la melodía que llevas silbando desde que despertaste. No ves su rostro, solo el vaivén de su chal. La melodía frena la Niebla... como si la conociera de memoria.',
  },
  mem_casa: {
    id: 'mem_casa',
    title: 'Memoria II · La casa junto al río',
    text: 'Una casa de piedra bajo un sauce llorón. Huele a pan y a tinta. En el umbral, dos tazas: una siempre llena. La Niebla se detiene en la valla, como si algo la mantuviera a raya con una canción. Esta casa estaba en Lunaris... antes.',
  },
  mem_madre: {
    id: 'mem_madre',
    title: 'Memoria III · La madre sin rostro',
    text: 'Manos que cosen una marca de onda en tu pañoleta. «Cuando no recuerdes quién eres —dice una voz que ya casi no oye su propio canto—, acuérdate de lo que has hecho.» Intentas girarte. El recuerdo se quiebra en silencio, y por un latido, jurarías que ella tampoco puede verte la cara.',
  },
};

// Opciones principales de Toln (compartidas por la variante de tono dominante)
const TOLN_MAIN: DialogueOption[] = [
  { text: 'Mejorar arma', next: 'toln_forge' },
  { text: 'Comprar poción (15 coronas)', next: 'toln_potion', action: 'buy_potion' },
  { text: '¿Qué sabes de la Noche del Silencio?', next: 'toln_lore' },
  { text: 'Hasta luego.', next: 'toln_bye' },
];

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
      { text: 'Cuéntame qué se perdió aquella noche. Quiero entenderlo, no solo oírlo.', next: 'brisa_lore', tone: 'empatico' },
      { text: 'Sé usar un arma. Dime qué hay que hacer y lo haré.', next: 'brisa_quest2', tone: 'pragmatico' },
      { text: 'Vaya: elegido por un dios muerto... y sin propina de por medio.', next: 'brisa_reac_sarc', tone: 'sarcastico' },
      { text: 'Apártate, vieja. Si ese Eco existe, será mío.', next: 'brisa_reac_amenaz', tone: 'amenazante' },
    ],
  },
  brisa_reac_sarc: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Je... trescientos años esperando un héroe y la Niebla me manda uno con lengua. Está bien, muchacho: ríete mientras el acero aguante. Toma, para empezar: unos lobos con hambre de tu Eco.',
    next: 'brisa_quest2',
  },
  brisa_reac_amenaz: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Esos ojos ya los he visto, Portador, en todos los que subieron a la Cripta con hambre de Eco. Ninguno volvió a cantar. Aquí no se toma lo que se escucha: aprende la diferencia... y ve a cazar esos lobos.',
    next: 'brisa_quest2',
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
  brisa_bosque: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El Bosque Susurrante está al norte. Busca la Ruina Antigua, más allá del río: allí susurra el Fragmento de Eco. Lleva pociones, descansa en los Santuarios... y no confíes en la noche.',
  },
  brisa_reward: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El valle ya respira. Toma esto: coronas del fondo del pozo y una poción de la vieja receta. Los Guardianes del Canto te recordarán, Portador.',
    onEnd: 'accept_q3',
    options: [
      { text: 'Gracias, Brisa. El valle huele a menos silencio gracias a ti.', next: 'brisa_rw_emp', tone: 'empatico' },
      { text: 'Anotado. ¿Qué sigue?', next: 'brisa_rw_prag', tone: 'pragmatico' },
      { text: '¿Coronas del fondo del pozo? Espero que nadie las hubiera deseado a algo peor.', next: 'brisa_rw_sarc', tone: 'sarcastico' },
    ],
  },
  brisa_rw_emp: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '«Gracias a ti», alma. Hace treinta años que no oigo el valle respirar de noche. Ve al norte: el Bosque Susurrante guarda el primer susurro del Eco.',
  },
  brisa_rw_prag: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Directo. Me gusta. Lo siguiente es el Bosque Susurrante, al norte: encuentra la Ruina Antigua y toca el Fragmento de Eco. Lleva pociones.',
  },
  brisa_rw_sarc: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Deseadas fueron, y por eso están donde están: el pozo las guardaba de la Niebla. Habla así delante del agua y quizá te las devuelva... mojadas.',
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
  // variantes por tono dominante (biblia: los PNJ tratan distinto al Portador)
  brisa_idle_emp: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Ahí estás, alma. El valle celebra tu nombre, y yo celebro que preguntes por los demás antes que por ti. Cuando quieras, la demo esperará tu decisión final conmigo.',
  },
  brisa_idle_amenaz: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '...El pueblo cruza de acera cuando pasas, Portador. Yo ya soy vieja y no tengo prisa, pero modera esa lengua con la Orden de Vesh: ellos toman los silencios por amenazas. La demo seguirá esperándote aquí.',
  },

  // ----- Toln -----
  toln_intro: {
    name: 'Maestro Toln', portrait: 'toln',
    text: '¡Ja! El viejo Brisa dijo que oíste Ecos. Yo oigo otra cosa: tu arma pidiendo filo. La forja sigue caliente, Portador, y el metal no pregunta por dioses.',
    options: TOLN_MAIN,
  },
  // variante por tono dominante: a Toln le divierte el Portador sarcástico
  toln_intro_listillo: {
    name: 'Maestro Toln', portrait: 'toln',
    text: '¡Ja! Vuelve el Listillo. La forja no descuenta ironías, pero sí cambia filo por coronas. ¿Qué será hoy?',
    options: TOLN_MAIN,
  },
  toln_forge: {
    name: 'Maestro Toln', portrait: 'toln',
    text: '(Usa esta conversación para mejorar: cada nivel de forja añade daño a tu arma. Las runas de mejora llegan hasta +5 en esta demo.)',
    options: [
      { text: 'Forjar (+1)', next: 'toln_intro', action: 'forge' },
      { text: 'Dale caña al martillo, maestro. Mi oro es tuyo.', next: 'toln_intro', action: 'forge', tone: 'pragmatico' },
      { text: 'Casi me haces creer que el metal escucha. Casi.', next: 'toln_forge_sarc', tone: 'sarcastico' },
      { text: 'Volver', next: 'toln_intro' },
    ],
  },
  toln_forge_sarc: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Escucha más que tu boca, Listillo. El acero bien templado canta cuando cae la Niebla... y estas últimas noches canta bajito, como rezando. Vuelve al yunque cuando tengas coronas de verdad.',
    next: 'toln_intro',
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
      { text: 'Ven conmigo. Nadie debería tener que buscar sola.', next: 'ilwen_join', action: 'recruit_ilwen', tone: 'empatico' },
      { text: 'Necesito cobertura a distancia. Tú necesitas pistas. Trato justo.', next: 'ilwen_join', action: 'recruit_ilwen', tone: 'pragmatico' },
      { text: '¿Y si lo que quedó de tu hermana ya no responde a tu silbo?', next: 'ilwen_reac_amenaz', tone: 'amenazante' },
      { text: 'Sigo solo por ahora.', next: 'ilwen_wait' },
    ],
  },
  ilwen_reac_amenaz: {
    name: 'Ilwen', portrait: 'ilwen',
    text: '...(baja el arco un dedo) Cuida esa lengua, Portador. La Niebla borra nombres; tú pareces empeñado en borrar también las esperanzas. Cuando hables como alguien con quien caminar, aquí estaré.',
    next: 'ilwen_wait',
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
  // variante por tono dominante: Ilwen respeta al Portador pragmático
  ilwen_chat_prag: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Hablamos claro, los dos: me gusta cómo mandas. Sin promesas ni flores. Mi arco cubre a quien sabe lo que quiere. Naia cantaba mejor que las nereidas... la encontraré. Cuenta conmigo, Portador.',
  },

  // ----- Voces -----
  voz_fragment: {
    name: '???', portrait: 'fragment',
    text: '...¿quiéeeeen... despierta... el canto...? Ah... otro Portador. Otro pedazo de mí, perdido en el tiempo. Toma mi resonancia: alterna entre lo que fui y lo que soy. (Has desbloqueado el CAMBIO DE ÉPOCA: pulsa Q)',
    onEnd: 'fragment_touched',
    options: [
      { text: 'Descansa. Te devolveré cada pedazo, aunque me lleve vidas.', next: 'voz_frag_emp', tone: 'empatico' },
      { text: 'Resonancia aceptada. Ahora: ¿dónde oigo el resto?', next: 'voz_frag_prag', tone: 'pragmatico' },
      { text: 'Un dios que se paga a plazos. Qué época tan práctica.', next: 'voz_frag_sarc', tone: 'sarcastico' },
    ],
  },
  voz_frag_emp: {
    name: '???', portrait: 'fragment',
    text: '...vides... sí... Yo también tardé vidas en aprender a callar. Ve... el valle recuerda por donde caminas... te canta por debajo... escúchalo de noche...',
  },
  voz_frag_prag: {
    name: '???', portrait: 'fragment',
    text: '...el primero duerme bajo la Cripta, custodiado por lo que quedó de mi primer coro. Lleva acero... y canto. El resto... ya lo oirás...',
  },
  voz_frag_sarc: {
    name: '???', portrait: 'fragment',
    text: '...mmm... bromea el pedacito... A los dioses nos matan por partes, ¿sabías? Primero la voz... luego el nombre... Tú verás qué te toca recoger...',
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
    onEnd: 'eco_taken_mem',
    options: [
      { text: 'Tu nana... era esta melodía, ¿verdad? La recordaba sin saber de quién.', next: 'eco_voz_emp', tone: 'empatico' },
      { text: 'Uno de siete. ¿Dónde oigo el siguiente?', next: 'eco_voz_prag', tone: 'pragmatico' },
      { text: '«Canta más alto», dice la voz. A ver si la Niebla es sorda también.', next: 'eco_voz_sarc', tone: 'sarcastico' },
    ],
  },
  eco_voz_emp: {
    name: 'Eco de la Voz', portrait: 'fragment',
    text: '...la cantaba junto al río, con el chal al hombro. No recuerdo su cara — a mí tampoco me deja verse, mira tú — pero la canción sí. Ya es tuya. Cuídala: es más vieja que tu nombre.',
  },
  eco_voz_prag: {
    name: 'Eco de la Voz', portrait: 'fragment',
    text: '...escucha el bosque: los Ecos llaman a los Ecos. Y ten cuidado con los que rezan a lo que no canta... la Ciudadela también oye tu melodía ahora.',
  },
  eco_voz_sarc: {
    name: 'Eco de la Voz', portrait: 'fragment',
    text: '...no es sorda. Es paciente. Peor cosa. Canta, Portador... y ya verás quién responde: los que aman el canto... y los que aprendieron a temerlo.',
  },

  // ----- Doran (druida del Círculo Verde · biblia: aceptan la Niebla como naturaleza) -----
  doran_intro: {
    name: 'Doran', portrait: 'doran',
    text: 'Sin prisa, sin espinas... La Niebla te eriza la piel, ¿eh? A nosotros nos da lástima. El Círculo Verde no la combate: la escucha. No es maldad, Portador: es lo que había ANTES del canto, cuando el mundo era silencio y raíz.',
    options: [
      { text: 'Si la Niebla guarda algo, merece que alguien la escuche. Enséñame.', next: 'doran_verde', action: 'rep_circulo_5', tone: 'empatico' },
      { text: 'Teoría interesante. ¿Y qué gana el Círculo defendiéndola?', next: 'doran_verde', action: 'rep_circulo_5', tone: 'pragmatico' },
      { text: 'Qué bonito: apocalipsis con musgo. ¿Y los pueblos que se borra?', next: 'doran_sarc', tone: 'sarcastico' },
      { text: 'La Orden de Vesh la quemaría con lanza y sal bendita. Y no creo que erraran.', next: 'doran_orden', tone: 'amenazante' },
    ],
  },
  doran_verde: {
    name: 'Doran', portrait: 'doran',
    text: 'Lo oyes, ¿verdad? Debajo del bosque hay una melodía que no canta Aelthar... más vieja. No rendimos culto a la Niebla: le enseñamos dónde parar, como se educa un río con presas. Vuelve cuando lleves el primer Eco: entonces la Niebla te sonará distinto.',
  },
  doran_sarc: {
    name: 'Doran', portrait: 'doran',
    text: 'Los borra porque no les dejan sitio, como el agua cuando tapan el cauce. Podemos discutirlo sentados una noche de luna... o puedes seguir golpeando raíces con el acero y ver quién se cansa antes.',
  },
  doran_orden: {
    name: 'Doran', portrait: 'doran',
    text: '...Lanzas y sal bendita. Sí, esa es la letra de su canción: lo que arde no vuelve a cantar jamás. Así «curó» la Orden el valle de Merrow, ¿lo sabías? Dime, Portador: ¿vas a ser su lanza en este bosque?',
    options: [
      { text: 'No. Que la Orden de Vesh se quede con sus lanzas y su miedo.', next: 'doran_reject', action: 'rep_orden_-5' },
      { text: 'Si hay que elegir entre su fuego y tu musgo... ya veremos.', next: 'doran_bye' },
    ],
  },
  doran_reject: {
    name: 'Doran', portrait: 'doran',
    text: 'Que la Madre Espina te oiga. Los del Círculo no olvidamos a quien se planta frente a la Lanza. Pasa cuando quieras: el bosque ya conoce tu paso.',
  },
  doran_bye: {
    name: 'Doran', portrait: 'doran',
    text: 'Piénsalo caminando. La Niebla no corre: llega. Y cuando llegue, preferiré teneros a todos cantando del mismo lado.',
  },

  // ----- Heraldo de Vesh (aparece tras el Eco de la Voz · biblia: Orden de Vesh) -----
  heraldo_intro: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: 'Así que este es el recipiente. No te arrodilles: no sería sincero. El Gran Inquisidor sabía que la Niebla escondía el primero de los siete... y ahora dice: «la Lanza ya está preparada para la segunda vez». Yo solo repito las palabras. Al recipiente no le hace falta entenderlas: basta con que contenga.',
    options: [
      { text: 'Dile a tu Inquisidor que si quiere lo que llevo, que baje a buscarlo.', next: 'heraldo_amenaz', action: 'rep_orden_-5', tone: 'amenazante' },
      { text: 'No soy «recipiente» de nadie. Pero de momento hablaremos.', next: 'heraldo_prag', tone: 'pragmatico' },
      { text: '¿Qué es «la segunda vez»?', next: 'heraldo_emp', tone: 'empatico' },
    ],
  },
  heraldo_amenaz: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: '...La guardaré para el informe, palabra por palabra. Sabes, recipiente: el acero de la Ciudadela canta muy bajo, y por eso corta tanto. El Gran Inquisidor os espera a ti y a tu melodía. Camina con cuidado.',
  },
  heraldo_prag: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: 'La calma fingida también es una respuesta; el Inquisidor la acepta, envuelta en papel y sello. Cuando contengas los siete —si llegas—, la Orden vendrá a cobrarlos. Nos veremos, recipiente.',
  },
  heraldo_emp: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: 'La primera vez, la Lanza de los Durn atravesó el costado del dios y su canto se hizo mil pedazos que llamáis Ecos. La segunda vez... eso no me corresponde contarlo. El Gran Inquisidor espera que seas tú quien lo cuente, cuando todo esté en su sitio.',
  },

  // ----- Teo (niño rescatado de la Niebla · guiño a la biblia) -----
  teo_intro: {
    name: 'Teo', portrait: 'teo',
    text: '¿Eres tú? ¿El que sacó a la gente de la Niebla? Yo no recuerdo cómo salí... solo una nana que me cantaba mi madre: mmm-mm-mmm... La cantas igual que yo la sueño, ¿lo sabías? Cuando la tarareo, la niebla no me pega tanto miedo.',
    options: [
      { text: 'Cántala siempre, Teo. Las canciones cuidan a quien las lleva.', next: 'teo_emp', tone: 'empatico' },
      { text: 'Quédate cerca del Santuario y del pozo. Es lo más seguro.', next: 'teo_prag', tone: 'pragmatico' },
      { text: 'Vaya talento: la Niebla borra pueblos enteros y tú la despiertas a dúo.', next: 'teo_sarc', tone: 'sarcastico' },
    ],
  },
  teo_emp: {
    name: 'Teo', portrait: 'teo',
    text: '¡Prometido! La canto para merendar, para dormir y para que la luna no se pierda. Un día, si te pierdes, me la cantas al revés y me encuentras. Así funciona, ¿no?',
  },
  teo_prag: {
    name: 'Teo', portrait: 'teo',
    text: 'Vale... aunque de noche el pozo susurra y yo le susurro de vuelta. Nos entendemos. Si ves que no estoy, es que estoy aprendiendo nombres nuevos.',
  },
  teo_sarc: {
    name: 'Teo', portrait: 'teo',
    text: '(se ríe) ¡Mmm-mmm!, ¡aaaah! ¿Ves? La Niebla ni se mueve... Tú también puedes, solo que te da vergüenza cantar delante de la gente mayor.',
  },
};

export function getDialogue(nid: string, ctx: DialogueCtx): string {
  const q = ctx.questIdx, s = ctx.questStep;
  const td = toneOf(ctx.flags);
  if (nid === 'brisa') {
    // variantes por tono dominante (biblia: los PNJ tratan distinto al Portador)
    const idle = td === 'empatico' ? 'brisa_idle_emp' : td === 'amenazante' ? 'brisa_idle_amenaz' : 'brisa_idle';
    if (ctx.flags.demoEnded) return idle;
    if (q === 0) return 'brisa_intro';
    if (q === 1) return s === 0 ? 'brisa_wolves' : 'brisa_reward';
    if (q === 2) return ctx.flags.fragmentTouched ? 'brisa_fragment' : 'brisa_bosque';
    if (q === 3) return ctx.flags.guardianDefeated ? 'brisa_final' : 'brisa_crypt';
    return 'brisa_final';
  }
  if (nid === 'toln') return td === 'sarcastico' ? 'toln_intro_listillo' : 'toln_intro';
  if (nid === 'ilwen') {
    if (ctx.companion) return td === 'pragmatico' ? 'ilwen_chat_prag' : 'ilwen_chat';
    return 'ilwen_intro';
  }
  if (nid === 'doran') return 'doran_intro';
  if (nid === 'heraldo') return 'heraldo_intro';
  if (nid === 'teo') return 'teo_intro';
  return 'brisa_idle';
}

/** Lee el tono dominante de las flags (hooks lo guarda como string en runtime). */
function toneOf(flags: Record<string, number | boolean>): ToneKind | null {
  const v = flags.tonoDominante;
  return typeof v === 'string' ? (v as ToneKind) : null;
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
    name: 'Guardián Hueco', hp: 300, dmg: 13, speed: 40, xp: 220, gold: [120, 160],
    sprite: 'guardian', aggroR: 150, atkR: 40, windup: 0.8, atkCd: 2.2,
    element: 'sombra', weakTo: 'ninguno', breakBar: 70,
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
