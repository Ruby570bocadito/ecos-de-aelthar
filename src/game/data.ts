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
  // ------- ACTO II · Las Notas Perdidas (expansión) -------
  { id: 'q6', name: 'El Rumor del Mar', steps: ['Viaja al sur de Lunaris: la Costa de Bruma', 'Habla con Mara, la farera'] },
  { id: 'q7', name: 'La Sirena sin Canto', steps: ['Encuentra la nave naufragada al este de la costa', 'Derrota a la Sirena Abisal', 'Recupera el Eco de las Mareas en su altar'] },
  { id: 'q8', name: 'La Aldea que Olvidó su Nombre', steps: ['Viaja a la Aldea de Merrow, al este de la costa', 'Enciende los 3 Faroles del Recuerdo (cambia al pasado con Q)', 'Habla con la Espectro de Merrow'] },
  { id: 'q9', name: 'La Cumbre del Segundo Canto', steps: ['Cruza el paso del noreste del Bosque: Cumbres Heladas', 'Derrota al Gólem de Escarcha', 'Recupera el Eco de las Cumbres en su altar'] },
  { id: 'q10', name: 'Dos Voces más Fuertes', steps: ['Regresa con la Anciana Brisa a Lunaris'] },
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
  mem_faro: {
    id: 'mem_faro',
    title: 'Memoria IV · El farero que contaba barcos',
    text: 'Un faro pequeño y un hombre delgado que encendía la lámpara con una cerilla y una canción. «Cada barco que pasa —decía— es una nota que el mar se lleva. Yo solo pongo la luz para que la orquesta no se pierda.» Bajas la cerilla. La luz no era tuya, pero la melodía, sí.',
  },
  mem_invierno: {
    id: 'mem_invierno',
    title: 'Memoria V · El invierno del silencio',
    text: 'Nieve hasta las rodillas y una hoguera de pastores cantando por turnos para no dormirse. «Si el canto se apaga, el frío entra», decía el mayor. Una noche el viento se llevó las voces, y las montañas aprendieron a guardarlas bajo el hielo... esperando que alguien volviera a pedirlas.',
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
      { text: 'El mar llama y yo tengo oídos. Hablemos del sur.', next: 'brisa_acto2' },
      { text: 'Aún tengo cosas que hacer por Velmora.', next: 'brisa_stay' },
    ],
  },
  brisa_acto2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Quedan seis Ecos, Portador, y ahora que el valle respira, el mar llama: los pescadores juran oír una voz entre la bruma de la Costa, al sur de Lunaris. Una voz que canta hacia tierra... y no devuelve a los que van tras ella. Baja por el camino del sur y busca a la farera: su faro lleva 300 años apagado y las cerillas se agotan.',
    onEnd: 'accept_q6',
    options: [
      { text: 'Iré. Que el mar aprenda mi nombre sin borrarme el propio.', next: 'brisa_acto2b', tone: 'empatico' },
      { text: 'Costa, farera, sirena, Eco. Entendido. Me pongo en camino.', next: 'brisa_acto2b', tone: 'pragmatico' },
      { text: 'Una voz en la bruma que no devuelve a los curiosos. Y voy yo. Encantador.', next: 'brisa_acto2b', tone: 'sarcastico' },
    ],
  },
  brisa_acto2b: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Je... esa manera de hablar te delata, Portador: aún te queda canto por dentro. Ve, pues. Los Guardianes velarán Lunaris, la Orden contará tus pasos... y yo dejaré una taza llena en el umbral, por si el mar te trae de vuelta.',
  },
  brisa_final2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Dos voces más... tres Ecos de siete. La Niebla retrocede en el mapa de los Guardianes: ya se lee el valle, ya se oye el mar, y las cumbres recuerdan el invierno sin frío. Pero el Heraldo tenía razón en una cosa, Portador: la Ciudadela también oye tu melodía ahora. (Fin del Acto II — la demo continúa hasta que tú decidas partir.)',
    onEnd: 'acto2_report',
    options: [
      { text: 'Iré a por el cuarto Eco. (Terminar la demo)', action: 'end_demo' },
      { text: 'Aún no. Queda mundo por escuchar.', next: 'brisa_stay' },
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
    text: 'El valle respira y el mundo suena más lejos, Portador: el mar llama desde el sur y la montaña aguarda al norte. Cuando quieras ponerle final a la demo, vuelve a mí y lo cantaremos juntos.',
  },
  // variantes por tono dominante (biblia: los PNJ tratan distinto al Portador)
  brisa_idle_emp: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Ahí estás, alma. Ahora que el valle respira, el resto del mundo suena más lejos: el mar al sur, las cumbres al norte, y tú en medio con una melodía que ya no es solo tuya. La demo seguirá esperándote aquí, junto a la taza llena.',
  },
  brisa_idle_amenaz: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '...El pueblo cruza de acera cuando pasas y hasta la bruma te deja pasar primero, Portador. Modera esa lengua con la Orden de Vesh: toman los silencios por amenazas, y la Ciudadela ya oye tu melodía. La demo seguirá esperándote aquí.',
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

  // ================= ACTO II · Las Notas Perdidas (expansión) =================
  // ----- Mara, la farera (Costa de Bruma · biblia: la luz como gesto de memoria) -----
  mara_intro: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: '¿Vivo? Hacía meses que no bajaba nadie por el camino del valle... Un Portador, dice la bruma. Pues mira: el faro lleva trescientos años apagado y mi familia lleva trescientas noches encendiéndole una cerilla a la esperanza. Mi abuelo juraba que el mar guarda las notas que el dios no pudo cantar. Yo digo que algo ha empezado a usarlas.',
    action: 'mara_met',
    options: [
      { text: 'Lo siento por tu faro... y por los que no vuelven. ¿Qué es eso que canta?', next: 'mara_sirena', tone: 'empatico' },
      { text: 'Una voz en la bruma, un faro apagado. Dime dónde y cuándo.', next: 'mara_sirena', tone: 'pragmatico' },
      { text: 'Trescientas noches de cerillas... ¿y nadie trajo más cerillas?', next: 'mara_sarc', tone: 'sarcastico' },
      { text: 'Si esa voz sabe mi nombre, iré a convencerla de lo contrario.', next: 'mara_amenaz', tone: 'amenazante' },
    ],
  },
  mara_sirena: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'Al este hay un naufragio que la marea no se lleva; la Sirena canta debajo de la quilla. Cuando canta, los pescados suben a oírla y no vuelven... y los pescadores que la siguen, menos. Si vas —y vas, se te nota en la cara— llévate sal, silencio y no le sigas la letra.',
  },
  mara_sarc: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: '(se ríe, con cal) Las cerillas se las lleva el viento, Portador, como los nombres. Pero tienes lengua de sal, y en esta costa la sal manda. El naufragio está al este, siguiendo la línea de la marea baja: pregunta por la que canta bajo la quilla. Y no le sigas la letra.',
  },
  mara_amenaz: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: '...(aprieta la cerilla entre los dedos) Con esa voz no se conversa, Portador: se apaga o se obedece. La del naufragio ya probó lo primero con los barcos. Ve con cuidado, y que tu melodía sea más terca que su hambre.',
  },
  mara_idle: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'A esta hora la marea lee los nombres viejos en voz baja. Si te quedas quieto, los oirás; si te mueves, te llevará la cuenta. El naufragio sigue al este, Portador: la que canta debajo no tiene prisa, y nosotros sí.',
  },
  // variantes por tono dominante
  mara_idle_emp: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'Eres de los que escuchan antes de pisar. Mi abuelo decía que así empezaron todos los fareros: el mar guarda las notas que el dios no pudo cantar, y alguien tiene que quedarse en la orilla anotando las que vuelven. Vuelve tú, ¿eh? Anota las mías.',
  },
  mara_idle_sarc: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'Sí, sí: ríete de la bruma. Ella también se ríe de nosotros, solo que sin dientes. Anda, ve al este antes de que suba la marea y te deje sin chiste ni barco.',
  },
  mara_react: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: '...El silencio. ¿Lo oyes? Ya no canta. Trescientos años, y esta mañana el mar se ha quedado sin hambre. Ven: ayúdame con la lámpara. La cerilla tiembla, pero la mano no. (Mara enciende el faro por primera vez en tres siglos; la luz rueda sobre la bruma como una nota larga.)',
    action: 'mara_gift',
    options: [
      { text: 'La luz es tuya, Mara. Yo solo puse el silencio.', next: 'mara_react_emp', tone: 'empatico' },
      { text: 'Dos pociones y una luz encendida. Buen trato.', next: 'mara_react_prag', tone: 'pragmatico' },
      { text: 'Trescientos años apagado y funciona a la primera. Ya no hacen faros como antes.', next: 'mara_react_sarc', tone: 'sarcastico' },
    ],
  },
  mara_react_emp: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'Tuya la luz, mía la terquedad: repartija justa. Esta noche los Guardianes del Canto cantan por ti en la capilla del valle... y el mar, que de Guardianes entiende, te devuelve la barca vacía.',
  },
  mara_react_prag: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'La farera no regala: paga. Dos pociones por un mar en calma, y una luz que te guíe si el sur te trae de vuelta. Serás bien venido... y bien oído.',
  },
  mara_react_sarc: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'Cuando encendí la lámpara, hasta la bruma hizo la vista gorda. Anda, vete antes de que me veas llorar y lo cuentes en la Ciudadela: aquí la sal la pone el mar.',
  },
  mara_faro: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'La luz del faro sube cada noche, aunque ya nadie la pida. Los barcos del norte hablan de una estrella baja en la costa... Si el mar vuelve a cantar algo bajo el agua, yo apagaría la lámpara y me haría la dormida. Tú no: tú vete hacia la montaña, que tus oídos valen para el hielo también.',
  },

  // ----- Vult, cartógrafo de la Liga de Mercaderes (Costa de Bruma · biblia: los mapas venden certezas) -----
  vult_intro: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: 'Vult, cartógrafo jurado de la Liga de Mercaderes —no te fíes del título: con la bruma que hay aquí, cartógrafo y apóstata venimos a ser lo mismo—. Mapeo la Costa de Bruma porque los mapas sin nombres venden caros en la Ciudadela: un cabo sin bautizar es un cabo que alguien paga por ver en pergamino. ¿Quién me manda? La Liga. ¿Quién me mira? La Orden de Vesh, con ese telescopio que usan para todo menos para ver.',
    action: 'flag_metVult',
    options: [
      { text: 'Hablas como mercader de verdad: los mapas con leyenda, mejor negocio aún.', next: 'vult_gremio', action: 'rep_liga_5', tone: 'pragmatico' },
      { text: '¿Y Merrow? ¿Qué pone tu mapa donde hubo una aldea?', next: 'vult_merrow', tone: 'empatico' },
      { text: 'Vender caro lo sin nombre... y luego quejarse de que la Niebla borra gratis.', next: 'vult_sarc', tone: 'sarcastico' },
      { text: 'Dile a tu Liga que esta costa ya tiene dueño. Y a tu Inquisidor, que se apriete el telescopio.', next: 'vult_amenaz', action: 'rep_orden_-5', tone: 'amenazante' },
    ],
  },
  vult_gremio: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: 'Eso es. La Liga no vende seda: vende certezas. Por eso la Orden de Vesh nos teme —la fe no admite escalas de medida—: ellos queman lo que no entienden; nosotros lo tasamos. Apunta, Portador: un mapamundi con tu nombre en la leyenda vale más que una paga de por vida. Piénsalo cuando lleves tres Ecos.',
  },
  vult_merrow: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: 'Merrow, al este de esta costa. En mis mapas figura como «terreno no restituido»: así escribe la Liga lo que la Niebla se comió. Los de la Orden juran que la «curaron» hace siglos con lanza y sal. Curación rara: la aldea sigue ahí, en el ayer, y hasta los faroles piden ser encendidos. Cambia de época si no me crees... aunque los cartógrafos no deberíamos creer en el pasado.',
  },
  vult_sarc: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: 'Ríete, que la tinta es cara. Cuando la Niebla borró Merrow, la Liga perdió tres rutas y la Orden perdió la cara; yo, un encargo. Cada cual su pérdida, Portador.',
  },
  vult_amenaz: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: '...(anota en su libreta sin dejar de sonreír) «El Portador: hostil, territorial, con oído». Ya que coleccionas amenazas, otra: la Liga negoció con cosas peores que tú y sigue facturando. Y conste — a la Orden le conviene saber dónde NO poner sus lanzas.',
  },
  vult_idle: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: 'Sigo sin poner nombre al promontorio del faro. «Punta de la Cerilla», dice la letra; «Punta de Mara», dice mi conciencia. Los mapas mienten mejor cuando les das tiempo.',
  },
  // variante por tono dominante
  vult_idle_prag: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: 'Si vas al este, memoriza el camino del naufragio: los clientes preguntan por rutas y yo vendo atajos. Los mapas sin nombres venden caros, Portador... pero los mapas con leyendas venden mejor. Y tú ya vas siendo leyenda.',
  },

  // ----- Espectro de Merrow (Aldea de Merrow · q8: los Faroles del Recuerdo) -----
  mera_intro: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: '...¿Me hablas? Hace tanto que nadie me habla con voz de fuera... Espera. Espera. Yo era... yo me llamaba... (la anciana busca su nombre entre los pliegues del chal y no lo encuentra). Los vecinos de Merrow se llamaban los unos a los otros cada mañana, en voz alta, para no perderse. La Niebla se llevó los nombres y a nosotros detrás. Quédate... y escucha.',
    action: 'flag_metMera',
    options: [
      { text: 'Te ayudaré a buscar tu nombre. Dime por dónde se empieza.', next: 'mera_pidetarea', tone: 'empatico' },
      { text: 'Faroles, el ayer, nombres. Dame la lista exacta.', next: 'mera_pidetarea', tone: 'pragmatico' },
      { text: 'Una aldea que se llamaba a sí misma cada mañana... y yo olvidando las llaves.', next: 'mera_sarc', tone: 'sarcastico' },
    ],
  },
  mera_pidetarea: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: 'Cada farol guarda un nombre que la Niebla se llevó: tres siguen esperando en el AYER de Merrow —cambia de época con Q y verás arder el pueblo que fuimos—. Enciéndelos y devuélveme el mío. Los faroles no se encienden con fuego, Portador: se encienden con nombres dichos en voz alta.',
  },
  mera_sarc: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: '(sonríe sin dientes) Las llaves se pierden, Portador; los nombres se los lleva alguien. Aprende la diferencia antes de llegar a mi edad... si llegas. Tres faroles, en el ayer. Enciéndelos y devuélveme el mío.',
  },
  mera_wait: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: '¿Los faroles? Aún no arde ninguno, Portador. La Niebla no apaga: espera. Y yo también... pero los nombres tienen frío.',
  },
  mera_wait1: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: 'Uno arde... Lo oigo: un nombre vuelve a la boca de quien lo dijo. Faltan dos, Portador. Dos nombres, dos faroles, dos mañanas de Merrow.',
  },
  mera_wait2: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: 'Dos arden. El ayer ya casi ilumina al presente... Falta uno. El último nombre es siempre el más difícil, Portador: es el que uno se dice a sí mismo.',
  },
  mera_grateful: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: '...Nera. Me llamaba Nera, y mi hijo la decía «madre Nera» como otros dicen «mañana clara»... Da igual: es MÍO. Lo tengo. (El nombre le vuelve a la cara como el color a un retrato; el Eco de los Nombres rueda hacia tus manos, tibio como una palabra dicha a tiempo.) Tómalo: es pequeño, pero guarda a todos. Los que la Niebla se llevó vuelven cuando alguien los dice en voz alta.',
    onEnd: 'mera_eco',
    options: [
      { text: 'Nera... Era un buen nombre. Lo diré en voz alta de vez en cuando.', next: 'mera_grat_emp', tone: 'empatico' },
      { text: 'Un Eco menor, tres faroles, un nombre devuelto. Cuenta saldada.', next: 'mera_grat_prag', tone: 'pragmatico' },
      { text: 'Un Eco que es una lista de nombres. A la Niebla le encantará el trámite... en teoría.', next: 'mera_grat_sarc', tone: 'sarcastico' },
    ],
  },
  mera_grat_emp: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: 'Díselo a los tuyos, no a mí: los nombres no se guardan, se usan. Y cuando la niebla de tu propia cabeza llegue —que llega—, di en voz alta lo que has hecho. Eso también es un nombre, Portador.',
  },
  mera_grat_prag: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: 'Cuenta saldada, sí. Pero vuelve si pasas por el ayer: los faroles agradecen compañía... y yo ya ni recuerdo a qué le tenía miedo.',
  },
  mera_grat_sarc: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: 'Odia el trámite, sí... pero usa la lista: hay nombres que aún abren puertas. La mía, por ejemplo, ya no.',
  },
  mera_idle: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: 'El presente aprendió otra vez a iluminarse. Si me buscas, estaré junto a un farol encendido: es el sitio más parecido a una cita.',
  },

  // ----- Ivo, cazador de cumbres (Cumbres Heladas · gruñón de raíz bondadosa) -----
  ivo_intro: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: '¡Alto ahí! ...Vaya. Un Portador con el Eco a cuestas y yo con la ballesta a medio tender. Pasa, pasa: aquí arriba los modales escasean y el pan está duro. ¿Lo oyes? Nada. La montaña se levantó cuando el canto murió y lleva 300 años esperando a que alguien le cante de vuelta: el Gólem, en la cumbre. Si vas a despertarle la memoria, primero escúchame a mí.',
    action: 'flag_metIvo',
    options: [
      { text: 'Trescientos años esperando... Pobre montaña. Enséñame a no morir en el intento.', next: 'ivo_consejo', action: 'rep_circulo_5', tone: 'empatico' },
      { text: 'Gólem, cumbre, Eco. Dime debilidades y no te estorbo más.', next: 'ivo_golem', tone: 'pragmatico' },
      { text: 'Una montaña con insomnio y yo sin abrigo. Qué pareja tan bien avenida.', next: 'ivo_sarc', tone: 'sarcastico' },
      { text: 'Aparta, viejo. La cumbre es mía.', next: 'ivo_amenaz', tone: 'amenazante' },
    ],
  },
  ivo_consejo: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: 'Las arpías pican en vuelo y se ríen del acero lento: espera el picado y pega cuando giren. El fuego las baja —una pluma ardiendo vale por diez consejos—. Y si oyes la ventisca cantar con voz de mujer, no respondas: es la Niebla probando suerte. Dicho esto: que la montaña te oiga bien, Portador.',
  },
  ivo_golem: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: 'El Gólem guarda el altar del Segundo Canto. Es hielo con memoria: lento, y cada paso suyo es una leyenda entera. Cuando se detenga a reunir la ventisca, pega al quiebre: la montaña también estuvo hecha de canciones, y las canciones se rompen por la mitad.',
  },
  ivo_sarc: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: 'Je. El abrigo lo pones tú: el Canto de Ascuas derrite más que cien mantas. Y ojo con las arpías —se ríen de los listillos primero y de los fríos, después.',
  },
  ivo_amenaz: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: '...(carga la ballesta sin mirarte) La cumbre es de la montaña, Portador, y la montaña no negocia. Me recuerdas a los de la Orden: llegan rugiendo y bajan callados. Sube si te empeñas — el hielo cura la soberbia a base de astillas.',
  },
  ivo_idle: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: 'Las cumbres estaban hechas para cantar por turnos, como los pastores de la vieja historia. Ahora solo cantan cuando el viento se equivoca. Si subes a la cumbre, lleva fuego... y vuelve por otro camino, que el de subir ya lo conocen las arpías.',
  },
  // variante por tono dominante
  ivo_idle_emp: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: 'Buen viento traes, Portador. Los del Círculo Verde dicen que la montaña no está muerta, solo a la escucha. Ojalá tengan razón: sería una lástima que el segundo canto se quedara dentro para siempre... igual que mi padre se quedó sin volver a nevar tranquilo.',
  },
  ivo_after: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: '...Baja despacio, Portador. El eco de la cumbre llega hasta aquí: la montaña cantó de vuelta. Mi padre decía que cuando eso pasara, podría volver a nevar sin miedo. Tómate la cumbre con calma: los ecos viejos marean.',
  },

  // ----- Ecos del Acto II (el motor abre estos nodos desde el altar: onEnd contractual, no renombrar) -----
  eco_mareas: {
    name: 'Eco de las Mareas', portrait: 'fragment',
    text: 'El segundo canto asciende del naufragio, salado y vivo. «Guardé mi nota bajo la quilla de un barco que soñaba con estrellas —dice la voz—. La que me custodiaba olvidó su propia letra: cantaba a la Niebla lo que era mío. Cántala tú, Portador: hay mareas que solo se curan devolviendo la nota.» (Eco de las Mareas recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)',
    onEnd: 'eco_mareas_taken',
    options: [
      { text: 'Tu nota ya no duerme bajo ninguna quilla, Eco. Ahora cántame tú.', next: 'eco_mareas_emp', tone: 'empatico' },
      { text: 'Dos de siete. ¿Dónde suena el tercero?', next: 'eco_mareas_prag', tone: 'pragmatico' },
      { text: 'Una sirena que cantaba lo ajeno. Ojalá la Niebla pague derechos de autor.', next: 'eco_mareas_sarc', tone: 'sarcastico' },
    ],
  },
  eco_mareas_emp: {
    name: 'Eco de las Mareas', portrait: 'fragment',
    text: '...la cantaba un farero con una cerilla y una promesa... ya es tuya, cuídala: el mar devuelve todo lo que se le nombra. Tarde... pero entero.',
  },
  eco_mareas_prag: {
    name: 'Eco de las Mareas', portrait: 'fragment',
    text: '...escucha las cumbres, Portador: el hielo también guarda voz. Y no respondas a todo lo que cante en la bruma... hay letras que firman contratos.',
  },
  eco_mareas_sarc: {
    name: 'Eco de las Mareas', portrait: 'fragment',
    text: '...cantaba lo ajeno porque ya no tenía propio. Pasa mucho por aquí: la Niebla es un aula de imitaciones... Canta tú con voz prestada y ya verás quién acude.',
  },
  eco_cumbres: {
    name: 'Eco de las Cumbres', portrait: 'fragment',
    text: 'El tercer canto desciende con la ventisca, limpio y paciente. «Las montañas aprendieron a guardar voces bajo el hielo —dice la voz—. La primera fue la de los pastores que cantaban por turnos para no dormirse. Toma la suya: ahora la cumbre canta contigo, y el frío ya no es silencio: es compás.» (Eco de las Cumbres recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)',
    onEnd: 'eco_cumbres_taken',
    options: [
      { text: 'Descansad, pastores. Vosotros cantasteis primero; ahora canto yo por todos.', next: 'eco_cumbres_emp', tone: 'empatico' },
      { text: 'Tres de siete. Casi la mitad. ¿Qué nota sigue?', next: 'eco_cumbres_prag', tone: 'pragmatico' },
      { text: 'Una montaña que guarda voces en el congelador. Al menos este dios era organizado.', next: 'eco_cumbres_sarc', tone: 'sarcastico' },
    ],
  },
  eco_cumbres_emp: {
    name: 'Eco de las Cumbres', portrait: 'fragment',
    text: '...cantaban por turnos para que nadie se durmiera solo... tú también turnas el miedo con quien camina contigo... ya somos tres: el hielo devolverá el resto cuando le toque.',
  },
  eco_cumbres_prag: {
    name: 'Eco de las Cumbres', portrait: 'fragment',
    text: '...cuatro notas duermen donde los mapas se rinden... la Ciudadela oye tu melodía, Portador... no dejes que te la doble: el hielo es paciente; el poder, no.',
  },
  eco_cumbres_sarc: {
    name: 'Eco de las Cumbres', portrait: 'fragment',
    text: '...organizado hasta la muerte, literalmente... bromea con respeto, Portador: las montañas no perdonan dos veces... y a nosotros solo nos asesinaron una.',
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
    if (q === 4) return 'brisa_final'; // q5: el regreso con Brisa abre la oferta del sur (respaldo)
    if (q >= 9) return ctx.flags.acto2Done ? idle : 'brisa_final2'; // final del Acto II
    if (q === 5 && s === 0) return 'brisa_final'; // q6 sin aceptar aún: la oferta del sur (engine.talkTo ya avanzó q5→q6)
    if (q >= 5) return idle; // Acto II en curso (q6..q9): Brisa acompaña desde Lunaris
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
  // ----- Acto II · NPCs de la expansión (biblia: cada bioma guarda su duelo) -----
  if (nid === 'mara') {
    // La farera reacciona al destino de la Sirena (flag del motor: killEnemy)
    if (ctx.flags.sirenaDefeated) return ctx.flags.maraGift ? 'mara_faro' : 'mara_react';
    if (q === 5) return 'mara_intro'; // q6: la presentación de la Costa
    return td === 'empatico' ? 'mara_idle_emp' : td === 'sarcastico' ? 'mara_idle_sarc' : 'mara_idle';
  }
  if (nid === 'vult') {
    return ctx.flags.metVult ? (td === 'pragmatico' ? 'vult_idle_prag' : 'vult_idle') : 'vult_intro';
  }
  if (nid === 'mera') {
    // Estados por faroles encendidos (flags lamp1..3 las escribe engine.lightLamp)
    if (ctx.flags.ecoNombres) return 'mera_idle';
    const lamps = (['lamp1', 'lamp2', 'lamp3'] as const).filter(l => !!ctx.flags[l]).length;
    if (lamps >= 3) return 'mera_grateful';
    if (ctx.flags.metMera) return lamps === 2 ? 'mera_wait2' : lamps === 1 ? 'mera_wait1' : 'mera_wait';
    return 'mera_intro';
  }
  if (nid === 'ivo') {
    if (ctx.flags.golemDefeated) return 'ivo_after';
    if (ctx.flags.metIvo) return td === 'empatico' ? 'ivo_idle_emp' : 'ivo_idle';
    return 'ivo_intro';
  }
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
  // ------- ACTO II · nuevos enemigos de la expansión -------
  neumo: {
    // 10-b (balance): 24/7→30/8 — ranged molesto, no letal; oro subido para
    // financiar ~2 forjas + pociones por acto (economía del Acto II)
    name: 'Neumo de Marea', hp: 30, dmg: 8, speed: 42, xp: 20, gold: [6, 10],
    sprite: 'neumo', aggroR: 120, atkR: 135, windup: 0.7, atkCd: 2.0,
    element: 'ninguno', weakTo: 'rayo',
    desc: 'Burbuja de espuma que la Niebla enseñó a silbar. Escupe agua a distancia y retrocede si te acercas. Débil al rayo.',
  },
  espectro: {
    // 10-b (balance): 34/9→40/10 — su invulT ya lo hace táctico; oro subido
    name: 'Espectro sin Nombre', hp: 40, dmg: 10, speed: 52, xp: 26, gold: [7, 12],
    sprite: 'espectro', aggroR: 130, atkR: 24, windup: 0.5, atkCd: 1.6,
    element: 'sombra', weakTo: 'sagrado',
    desc: 'Aldeano de Merrow que olvidó hasta su hambre. Flota, se desvanece bajo los golpes y arremete desde la bruma. Débil a la luz.',
  },
  arpi: {
    // 10-b (balance): 28/8→32/9 pero atkCd 1.4→1.6 — los picados sincronizados
    // pegan duro en grupo (9-a); se compensa espaciando su cadencia
    name: 'Arpía de Cumbre', hp: 32, dmg: 9, speed: 76, xp: 22, gold: [6, 10],
    sprite: 'arpi', aggroR: 125, atkR: 20, windup: 0.35, atkCd: 1.6,
    element: 'hielo', weakTo: 'fuego',
    desc: 'Ave de ventisca que antaño guió a los pastores. Picotea en picado y se aleja volando. Débil al fuego.',
  },
  sirena: {
    // 10-b (balance): 340/12→380/13 y quiebre 80→90 — pelea más larga,
    // quiebre más recompensado
    name: 'Sirena Abisal', hp: 380, dmg: 13, speed: 46, xp: 240, gold: [130, 170],
    sprite: 'sirena', aggroR: 165, atkR: 44, windup: 0.75, atkCd: 2.0,
    element: 'hielo', weakTo: 'rayo', breakBar: 90,
    desc: 'Reina del naufragio. Cantaba a los barcos; ahora canta a la Niebla. Tres fases, salvas de marea y coro de neumos.',
  },
  golem: {
    // 10-b (balance): 420/16→460/17 y quiebre 100→110 — paredón final del Acto II
    name: 'Gólem de Escarcha', hp: 460, dmg: 17, speed: 30, xp: 280, gold: [150, 200],
    sprite: 'golem', aggroR: 140, atkR: 38, windup: 0.9, atkCd: 2.4,
    element: 'hielo', weakTo: 'fuego', breakBar: 110,
    desc: 'Memoria de montaña tallada en hielo eterno. Guarda el paso al altar de las Cumbres. Lento, aplastante, incansable.',
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
  ecoMareas: { name: 'Eco de las Mareas', desc: 'Segundo Eco de Aelthar. El mar vuelve a tener a quién cantarle.' },
  ecoCumbres: { name: 'Eco de las Cumbres', desc: 'Tercer Eco de Aelthar. Las montañas recuerdan el invierno sin frío.' },
  ecoNombres: { name: 'Eco de los Nombres', desc: 'Un Eco menor nacido de los faroles de Merrow. Guarda los nombres que la Niebla se llevó.' },
};

// ---------------- Atributos ----------------

export const ATTR_INFO: { id: 'fue' | 'des' | 'int' | 'esp' | 'vig'; name: string; desc: string }[] = [
  { id: 'fue', name: 'Fuerza', desc: '+1,5 daño melé por punto' },
  { id: 'des', name: 'Destreza', desc: '+2% crítico y +2 resistencia máx.' },
  { id: 'int', name: 'Intelecto', desc: '+1,6 daño de Cantos por punto' },
  { id: 'esp', name: 'Espíritu', desc: '+10% ganancia de Resonancia' },
  { id: 'vig', name: 'Vigor', desc: '+7 vida máx. y +1% reducción' },
];

// ============================================================
// ═══════ 12-b (agente árbol-habilidades) — BLOQUE AÑADIDO ═══════
// Todo lo anterior queda INTACTO. Este bloque contiene: las magias
// nuevas (mismo formato que SKILLS), los nodos del árbol, las
// herramientas activas y la tabla de objetivos de la Brújula.
// ============================================================

import type { MapId } from './types';

/**
 * Magias/poderes nuevos por disciplina (agente 12-b).
 * INTEGRACIÓN (contrato): el integrador puede fusionarlas con SKILLS vía
 * spread, p. ej.:
 *   const SKILLS_ALL = {
 *     alba: [...SKILLS.alba, ...NEW_SKILLS.alba],
 *     tejedor: [...SKILLS.tejedor, ...NEW_SKILLS.tejedor],
 *   };
 * Los EFECTOS de cada id viven en skilltree.ts → castNewSkill(g, id)
 * (el switch de castSkill no los conoce). Mientras el integrador no las
 * fusione, skilltree.ts ya las equipa en huecos de SKILLS en runtime.
 */
export const NEW_SKILLS: Record<'alba' | 'tejedor', SkillDef[]> = {
  alba: [
    { id: 'onda', name: 'Onda Sísmica', desc: 'Onda de choque que empuja y daña a tu alrededor.', cost: 30, cd: 8, icon: '◤', element: 'sagrado' },
    { id: 'lanza', name: 'Lanza del Alba', desc: 'Lanza de luz que atraviesa hasta 4 enemigos.', cost: 35, cd: 6, icon: '▲', element: 'sagrado' },
    { id: 'bendi', name: 'Bendición del Camino', desc: 'Escudo que absorbe daño (25% de tu vida, 10 s).', cost: 40, cd: 16, icon: '✚', element: 'sagrado' },
  ],
  tejedor: [
    { id: 'nova', name: 'Nova de Escarcha', desc: 'Explosión de hielo: congela y ralentiza en área.', cost: 35, cd: 9, icon: '▼', element: 'hielo' },
    { id: 'rayos', name: 'Tormenta Encadenada', desc: 'Cinco rayos saltan entre tus enemigos.', cost: 45, cd: 12, icon: '✦', element: 'rayo' },
    { id: 'aurea', name: 'Aureola de Ceniza', desc: 'Anillo de ascuas que quema durante 6 s.', cost: 35, cd: 14, icon: '✺', element: 'fuego' },
  ],
};

/** Nodo del árbol de habilidades (12-b). Los prerequisitos son siempre
 *  de la misma rama; disc filtra por disciplina (undefined = ambas). */
export interface TreeNodeDef {
  id: string;
  branch: 'filo' | 'eco' | 'camino';
  name: string;
  desc: string;
  cost: number;              // puntos de habilidad (se ganan al subir de nivel)
  parent?: string;           // id del nodo padre (prerequisito)
  kind: 'pasiva' | 'activa' | 'herramienta';
  grants?: string;           // id de NEW_SKILLS (activa) o de TOOL_INFO (herramienta)
  disc?: 'alba' | 'tejedor'; // gating por disciplina
  icon: string;              // glifo de 1 carácter
}

/**
 * ÁRBOL DE HABILIDADES — 3 ramas: Vía del Filo (combate), Vía del Eco
 * (arcano) y Vía del Camino (travesía/utilidades). Coste total 31 ◆;
 * el árbol otorga 13 ◆ al llegar a Nv 12 (1/nivel +1 en Nv 5 y 10):
 * aprenderlo TODO es imposible — las ramas exigen elegir.
 */
export const SKILL_TREE: TreeNodeDef[] = [
  // ---------- VÍA DEL FILO (combate) ----------
  { id: 'c_fuerte', branch: 'filo', name: 'Filo Templado', desc: 'Tus golpes melé hacen +10% de daño.', cost: 1, kind: 'pasiva', icon: '║' },
  { id: 'c_vida', branch: 'filo', name: 'Corazón de Roble', desc: '+20 de vida máxima.', cost: 1, kind: 'pasiva', icon: '✚' },
  { id: 'c_eco', branch: 'filo', name: 'Eco del Filo', desc: 'Cada golpe melé libera un eco retardado: 35% de tu daño en un área pequeña.', cost: 1, parent: 'c_fuerte', kind: 'pasiva', icon: '◈' },
  { id: 'c_cd', branch: 'filo', name: 'Refrán Veloz', desc: '−20% de enfriamiento en todas tus habilidades.', cost: 2, parent: 'c_fuerte', kind: 'pasiva', icon: '≫' },
  { id: 'c_onda', branch: 'filo', name: 'Onda Sísmica', desc: 'Desbloquea ONDA SÍSMICA: empuja y daña en área (tecla del hueco donde la equipes).', cost: 2, parent: 'c_eco', kind: 'activa', grants: 'onda', disc: 'alba', icon: '◤' },
  { id: 'c_lanza', branch: 'filo', name: 'Lanza del Alba', desc: 'Desbloquea LANZA DEL ALBA: proyectil de luz que perfora a los enemigos.', cost: 2, parent: 'c_onda', kind: 'activa', grants: 'lanza', disc: 'alba', icon: '▲' },
  { id: 'c_colera', branch: 'filo', name: 'Cólera del Alba', desc: 'Tus golpes melé hacen +15% de daño adicional.', cost: 3, parent: 'c_lanza', kind: 'pasiva', icon: '✹' },
  // ---------- VÍA DEL ECO (arcano) ----------
  { id: 'a_res', branch: 'eco', name: 'Afinación', desc: 'Recuperas +1,5 de Resonancia por segundo.', cost: 1, kind: 'pasiva', icon: '●' },
  { id: 'a_sta', branch: 'eco', name: 'Aliento Cálido', desc: '+40% de regeneración de Aguante.', cost: 1, kind: 'pasiva', icon: '◆' },
  { id: 'a_cd', branch: 'eco', name: 'Cadencia Arcana', desc: '−20% de enfriamiento en todas tus habilidades.', cost: 2, parent: 'a_res', kind: 'pasiva', icon: '≫' },
  { id: 'a_nova', branch: 'eco', name: 'Nova de Escarcha', desc: 'Desbloquea NOVA DE ESCARCHA: congelación y daño en área a tu alrededor.', cost: 2, parent: 'a_res', kind: 'activa', grants: 'nova', disc: 'tejedor', icon: '▼' },
  { id: 'a_rayos', branch: 'eco', name: 'Tormenta Encadenada', desc: 'Desbloquea TORMENTA ENCADENADA: 5 rayos saltan entre enemigos.', cost: 2, parent: 'a_nova', kind: 'activa', grants: 'rayos', disc: 'tejedor', icon: '✦' },
  { id: 'a_aura', branch: 'eco', name: 'Aureola de Ceniza', desc: 'Desbloquea AUREOLA DE CENIZA: anillo de ascuas que quema 6 s.', cost: 2, parent: 'a_nova', kind: 'activa', grants: 'aurea', disc: 'tejedor', icon: '✺' },
  { id: 'a_mente', branch: 'eco', name: 'Mente de Cristal', desc: 'Tus hechizos hacen +20% de daño.', cost: 3, parent: 'a_rayos', kind: 'pasiva', icon: '✹' },
  // ---------- VÍA DEL CAMINO (travesía) ----------
  { id: 't_speed', branch: 'camino', name: 'Paso de Brisa', desc: '+12% de velocidad de movimiento.', cost: 1, kind: 'pasiva', icon: '☾' },
  { id: 't_gold', branch: 'camino', name: 'Ojo del Mercader', desc: '+20% de coronas al conseguir oro.', cost: 1, kind: 'pasiva', icon: '★' },
  { id: 't_bendi', branch: 'camino', name: 'Bendición del Camino', desc: 'Desbloquea BENDICIÓN: escudo que absorbe daño (25% de tu vida, 10 s).', cost: 2, parent: 't_speed', kind: 'activa', grants: 'bendi', icon: '✚' },
  { id: 't_campana', branch: 'camino', name: 'Campana del Retorno', desc: 'Herramienta (tecla 5): resuena y te devuelve al Santuario del mapa (120 s de recarga).', cost: 1, parent: 't_gold', kind: 'herramienta', grants: 'campana', icon: '◉' },
  { id: 't_brujula', branch: 'camino', name: 'Brújula de Ecos', desc: 'Herramienta (tecla 6): un rastro de ecos señala tu misión durante 20 s (45 s de recarga).', cost: 1, parent: 't_campana', kind: 'herramienta', grants: 'brujula', icon: '◈' },
  { id: 't_amuleto', branch: 'camino', name: 'Amuleto de Aelthar', desc: 'Herramienta (tecla 7): absorbe 1 golpe no letal. Recarga al empezar cada combate.', cost: 2, parent: 't_bendi', kind: 'herramienta', grants: 'amuleto', icon: '☾' },
];

/** Colores de rama (los consume drawSkillTree en skilltree.ts). */
export const TREE_BRANCHES: Record<'filo' | 'eco' | 'camino', { name: string; sub: string; color: string }> = {
  filo: { name: 'VÍA DEL FILO', sub: 'cuerpo y acero', color: '#f0a050' },
  eco: { name: 'VÍA DEL ECO', sub: 'arcano elemental', color: '#5ad0e8' },
  camino: { name: 'VÍA DEL CAMINO', sub: 'travesía y astucia', color: '#8ef0b0' },
};

/** Herramientas activas (12-b): se usan con teclas 5/6/7 o desde el árbol.
 *  Contrato: skilltree.ts → activateTool(g, toolId). */
export const TOOL_INFO: Record<string, { name: string; desc: string; key: string; cd: number }> = {
  campana: { name: 'Campana del Retorno', desc: 'Te devuelve al Santuario del mapa actual.', key: '5', cd: 120 },
  brujula: { name: 'Brújula de Ecos', desc: 'Señala el objetivo de tu misión (20 s).', key: '6', cd: 45 },
  amuleto: { name: 'Amuleto de Aelthar', desc: 'Absorbe 1 golpe no letal; recarga al iniciar un combate.', key: '7', cd: 0 },
};

/**
 * Brújula de Ecos: objetivo de cada misión/paso. Referencias: npc (id de
 * NpcDef), etype (enemigo vivo), prop (id de PropDef), lamp (farol sin
 * encender más cercano) y map (viaje → señala la salida correcta).
 * La resolución (posición viva, BFS de mapas) vive en skilltree.ts.
 */
export interface CompassTarget { npc?: string; etype?: string; prop?: string; lamp?: boolean; map?: MapId }
export const QUEST_COMPASS: Record<number, CompassTarget[]> = {
  0: [{ npc: 'brisa' }],
  1: [{ etype: 'lobo', map: 'lunaris' }, { npc: 'brisa' }],
  2: [{ map: 'bosque' }, { prop: 'fragment' }],
  3: [{ map: 'cripta' }, { etype: 'guardian', map: 'cripta' }, { prop: 'altar_c' }],
  4: [{ npc: 'brisa' }],
  5: [{ map: 'costa' }, { npc: 'mara' }],
  6: [{ prop: 'wreck_co' }, { etype: 'sirena', map: 'costa' }, { prop: 'altar_mareas' }],
  7: [{ map: 'aldea' }, { lamp: true }, { npc: 'mera' }],
  8: [{ map: 'cumbres' }, { etype: 'golem', map: 'cumbres' }, { prop: 'altar_cumbres' }],
  9: [{ npc: 'brisa' }],
};

// ═══════ FIN DEL BLOQUE 12-b ═══════

// ============================================================
// ═══════ 13-a (agente historia-acto3) — BLOQUE AÑADIDO ═══════
// ACTO III · "El Canto al Revés" (q11-q13). Todo lo anterior queda
// INTACTO. Este bloque SOLO AÑADE: (1) misiones q11-q13 al final del
// array QUESTS (push; sin tocar entradas previas), (2) la memoria
// mem_cantoalreves, (3) 20 nodos de diálogo (Object.assign sobre
// DIALOGUES: los 108 nodos previos quedan byte a byte), (4) objetivos
// de la Brújula para los índices 10-12, (5) el ENVOLTORIO de
// getDialogue: captura la función original (GET_DIALOGUE_BASE) y la
// reasigna — el binding exportado está vivo, así que engine.talkTo
// resuelve SIEMPRE por aquí; toda ruta que no sea del Acto III
// delega tal cual en la original (regresión 0, verificada en smoke).
// Reutiliza el patrón ecos/Ecos del Acto II: nodos 'Eco …' con
// onEnd → acción que activa flag idempotente + questAdvance.
// ============================================================

// ---------------- Misiones del Acto III (append al final del array) ----------------

QUESTS.push(
  {
    id: 'q11', name: 'El Canto al Revés',
    steps: [
      'Habla con Toln en su forja de Lunaris: el metal cantó al revés',
      'Endereza los 3 Ecos Invertidos: el pozo de Teo, la Ruina Antigua y la orilla de Mara (0/3)',
      'Vuelve con la Anciana Brisa',
    ],
  },
  {
    id: 'q12', name: 'La Aldea sin Ayer',
    steps: [
      'Viaja a la Aldea de Merrow: amaneció sin recuerdos',
      'Devuélvele el ayer a los que conociste: 3 recuerdos perdidos (0/3)',
      'Vuelve con la Anciana Brisa',
    ],
  },
  {
    id: 'q13', name: 'La Primera Portadora',
    steps: [
      'Escucha a Velmora: la presencia quiere hablarte por boca de Brisa',
      'Derrota al Guardián recordado en la Cripta, fuera del tiempo',
      'Vuelve con la Anciana Brisa',
    ],
  },
);

// ---------------- Brújula de Ecos (12-b): objetivos de las misiones nuevas ----------------

QUEST_COMPASS[10] = [{ npc: 'toln' }, { npc: 'teo' }, { npc: 'brisa' }];
QUEST_COMPASS[11] = [{ npc: 'mera' }, { npc: 'mara' }, { npc: 'brisa' }];
QUEST_COMPASS[12] = [{ npc: 'brisa' }, { prop: 'altar_c' }, { npc: 'brisa' }];

// ---------------- Memoria VI (se otorga en acto3_report, cierre de q13) ----------------

Object.assign(MEMORIES, {
  mem_cantoalreves: {
    id: 'mem_cantoalreves',
    title: 'Memoria VI · El Canto al Revés',
    text: 'Una mujer sin rostro te tiende su ayer como quien tiende una taza: «Yo canté la primera nota, y el mundo pagó el día. Guarda esta memoria AL REVÉS, Portador: cuando la Niebla te cante con mi voz, dila derecha y devuélvela a su dueña.» Por un latido el Canto suena entero —siete notas, un mundo, un dios con hambre— y luego vuelve el silencio... un poco más cerca de lo que estaba.',
  } satisfies MemoryDef,
});

// ---------------- Nodos de diálogo del Acto III ----------------

const D_ACTO3: Record<string, DialogueNode> = {
  // ----- q11 · El Canto al Revés -----
  acto3_brisa_alba: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '¿Lo oíste anoche, Portador? El Canto sonó AL REVÉS: las notas de Aelthar bajaron cuando debían subir. Toln jura que su forja cantó su nana del final al principio... y lo que se canta al revés no tarda en abrirse paso. Ve a la forja y escúchalo tú: esta noche se han torcido tres ecos, y los ecos torcidos llaman a la Niebla.',
    onEnd: 'accept_q11',
    options: [
      { text: 'Descansa, Brisa. Yo puse el Eco en marcha: yo enderezaré la melodía.', tone: 'empatico' },
      { text: 'Tres ecos torcidos. Nombres y lugares, anciana.', tone: 'pragmatico' },
      { text: 'Un dios que canta al revés. Esta demo se está volviendo experimental.', tone: 'sarcastico' },
    ],
  },
  acto3_toln_intro: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Escucha, Portador: anoche el metal cantó solo. Mi nana —la de mi abuela—, del final al principio. Y el yunque templó al revés: el filo salió ROMO. Tres veces sonó torcido esta noche: en el pozo donde el niño Teo tararea, en la Ruina Antigua donde el druida escucha raíces, y en la orilla de la farera, donde el mar devuelve los barcos por donde los llevó. Un canto al revés no es una canción, Portador: es una puerta abierta del otro lado. Enderézalos antes de que aprendan la letra.',
    onEnd: 'acto3_toln',
    options: [
      { text: 'Tu abuelo forjó la Lanza, Toln. Esta vez tu forja me guía a mí.', tone: 'empatico' },
      { text: 'Pozo, ruina, orilla. Enderezaré los tres.', tone: 'pragmatico' },
      { text: 'Un yunque romo y un dios desafinado. Esta forja necesita vacaciones.', tone: 'sarcastico' },
      { text: 'Necesito acero y pociones, no poesía.', next: 'toln_intro' },
    ],
  },
  // variante por tono dominante (mismo patrón que toln_intro_listillo)
  acto3_toln_intro_sarc: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Vuelves con orejas nuevas, Listillo. Pues escucha esto: anoche el metal cantó mi nana del final al principio y el yunque templó ROMO. El pozo del niño, la ruina del druida, la orilla de la farera: tres veces sonó torcido. Ríete tú de eso. Un canto al revés no es broma: es una puerta abierta del otro lado, y las puertas no eligen a quien cruzan.',
    onEnd: 'acto3_toln',
    options: [
      { text: 'Tu abuelo forjó la Lanza, Toln. Esta vez tu forja me guía a mí.', tone: 'empatico' },
      { text: 'Pozo, ruina, orilla. Enderezaré los tres.', tone: 'pragmatico' },
      { text: 'Necesito acero y pociones, no poesía.', next: 'toln_intro' },
    ],
  },
  acto3_eco_teo: {
    name: 'Eco Invertido · La nana', portrait: 'fragment',
    text: 'Teo tararea junto al pozo, pero la canción sube AL REVÉS del fondo: «...aaaah, mm-mm...» — «¿La oyes? —dice el niño—. Anoche me la cantó la Niebla, del final al principio. Yo solo la repito para que no se pierda. Cuando la canto derecha, nadie responde. Cuando la canto al revés, responde alguien. Antes no había nadie debajo, ¿verdad?»',
    onEnd: 'acto3_eco1',
    options: [
      { text: 'Cántala derecha, Teo. Yo canto contigo hasta que abajo se canse de imitar.', tone: 'empatico' },
      { text: 'Deja de repetirla, Teo. La imitación se alimenta de quien la escucha.', tone: 'pragmatico' },
      { text: 'Un coro bajo el pozo. Qué vecindario tan encantador.', tone: 'sarcastico' },
      { text: 'Sea lo que sea lo que canta abajo: si sube, lo espero con acero.', tone: 'amenazante' },
    ],
  },
  acto3_eco_doran: {
    name: 'Eco Invertido · La raíz', portrait: 'fragment',
    text: 'Las raíces respiran al revés, Portador: exhalan donde debían inhalar. La Madre Espina sangra savia que vuelve al brote, y los pájaros aprenden las notas de sus propios cantos fúnebres. El Círculo dice que no es maldad: es DUELO aprendido de memoria... pero el duelo no aprende solo, Portador. Alguien le enseñó al bosque a llorar hacia atrás.',
    onEnd: 'acto3_eco2',
    options: [
      { text: 'Entonces le enseñaré otra cosa: a descansar. Lo siento por las raíces.', tone: 'empatico' },
      { text: 'Dueño de ese pesar: quien enseñó la lección pagará la clase.', tone: 'pragmatico' },
      { text: 'Árboles llorando hacia atrás. El bosque también puede exagerar.', tone: 'sarcastico' },
    ],
  },
  acto3_eco_mara: {
    name: 'Eco Invertido · La marea', portrait: 'fragment',
    text: 'Anoche la marea devolvió dos barcos que se hundieron hace treinta años. Enteros, Portador. Con sus nombres pintados por DENTRO. El mar lee los nombres del final al principio y mi faro los ilumina... pero la luz se dobla al cruzarlos, como si el ayer no supiera ya por dónde entra. Yo apagué la lámpara por primera vez en mi vida. Y la bruma, agradecida, cantó.',
    onEnd: 'acto3_eco3',
    options: [
      { text: 'Tú encendiste un faro tras 300 años, Mara. Volverás a enderezar esta luz.', tone: 'empatico' },
      { text: 'Barcos enteros, nombres por dentro. Eso no es marea: es archivo. Y alguien lo lee.', tone: 'pragmatico' },
      { text: 'El mar haciendo playback de sus peores éxitos. Encantador.', tone: 'sarcastico' },
      { text: 'Que devuelva los barcos andando si tanto le gustan.', tone: 'amenazante' },
    ],
  },
  acto3_brisa_cierre1: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Tres notas enderezadas... y las tres decían lo mismo, Portador: la Niebla no está robando el Canto. Lo está APRENDIÉNDOLO. Nota a nota, al revés, como quien deshace un punto de labor para copiar el dibujo. Alguien le enseña. O algo lo recuerda. Y en Merrow, esta mañana, la aldea entera ha amanecido sin su ayer... Ve. Los recuerdos que se comen dejan hambre.',
    onEnd: 'acto3_report',
    options: [
      { text: 'Que nadie en Merrow olvide que lo olvidado se puede volver. Voy.', next: 'acto3_brisa_q12', tone: 'empatico' },
      { text: 'La Niebla aprende; yo enseño. Merrow, y rápido.', next: 'acto3_brisa_q12', tone: 'pragmatico' },
      { text: 'La apocalíptica Niebla sacando clase particular. Ojalá pague por hora.', next: 'acto3_brisa_q12', tone: 'sarcastico' },
      { text: 'Necesito prepararme antes de volver a bajar hacia el mar.', tone: 'pragmatico' },
    ],
  },
  // ----- q12 · La Aldea sin Ayer -----
  acto3_brisa_q12: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Merrow amaneció sin recuerdos, Portador. No muerta: VACÍA. Los que caminan ahí siguen viviendo, pero el día de antes se lo comió la Niebla con la boca pequeña, y sin ayer no hay mañana que esperar. Habla con los que conociste —la farera, la Espectro, el cazador, el cartógrafo—: lo que cada uno vivió ayer no está en su cabeza. Si lo devuelves, quizá la Niebla se quede sin costumbre.',
    onEnd: 'accept_q12',
    options: [
      { text: 'Volveré con tres ayeres en las manos, Brisa.', tone: 'empatico' },
      { text: 'Cuatro bocas, tres recuerdos. Cuento hecho.', tone: 'pragmatico' },
    ],
  },
  acto3_mera_alba: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: '...Portador. La plaza amaneció sin su ayer: los faroles arden y NADIE recuerda encenderlos. Yo misma... anoche tenía un nombre prestado que los vecinos me iban devolviendo, y esta mañana la boca me lo devuelve vacío. La Niebla ha aprendido a comerse el día de antes, y en Merrow ya probó gusto. Pregunta a los que caminan fuera: lo que vivieron ayer no está en su cabeza. Lo que se come una boca... otra boca lo puede devolver.',
    onEnd: 'acto3_mera_ayer',
    options: [
      { text: 'Tu nombre volverá, Nera. Lo diré en voz alta hasta que lo oigas.', tone: 'empatico' },
      { text: 'Farera, espectro, cazador, cartógrafo. Empiezo hoy mismo.', tone: 'pragmatico' },
      { text: 'Una aldea que pierde el ayer y yo perdiendo las llaves. Empatía plena.', tone: 'sarcastico' },
    ],
  },
  acto3_mara_ayer: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'Ayer encendí el faro. ¿Verdad que lo encendí? Sé que lo hago cada noche... pero la noche del faro encendido no está en mi cabeza: hay un hueco con forma de luz y no queda ni el olor a cerilla. (mira el faro, apagado) Si la Niebla se comió mi ayer, que al menos devuelva las calorías: enciéndelo tú esta noche, Portador, y piensa en mí mientras arde.',
    onEnd: 'acto3_rec_mara',
    options: [
      { text: 'Arderá, Mara. Y tu ayer volverá con él: las luces no saben mentir.', tone: 'empatico' },
      { text: 'Un hueco con forma de luz. Apúntalo: es la pista más limpia que tenemos.', tone: 'pragmatico' },
      { text: 'Perder la memoria y quedarte el faro. Qué repartija tan injusta.', tone: 'sarcastico' },
    ],
  },
  acto3_ivo_ayer: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: 'La montaña cantó de vuelta. Te lo juro por mi ballesta: fue ayer... ¿o fue un sueño? Y ahora no sé decir cuál, y eso, Portador, es peor que la ventisca. Un cazador que duda de su memoria pierde el norte, y la montaña pierde al último que la escuchaba. La Niebla no mató el día: lo DESHIZO. Como desafinar deshace una nota.',
    onEnd: 'acto3_rec_ivo',
    options: [
      { text: 'Cantó de vuelta, Ivo. Y cuando vuelva a cantar, lo recordarás por los dos.', tone: 'empatico' },
      { text: 'Fue ayer. Confía en el que lo escuchó: eres el único que estaba allí.', tone: 'pragmatico' },
      { text: 'Un sueño, un canto, una ventisca... la montaña no te va a aclarar cuál.', tone: 'sarcastico' },
    ],
  },
  acto3_vult_ayer: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: 'Ayer dibujé la costa. Hoy el pergamino está en blanco. Y no es tinta que se borra, Portador: es un día que NO PASÓ. La Liga me paga por certezas y acabo de perder la única que tenía: mi ayer. (cierra la libreta) Anota esto en tu odre de profecías: quien coma días ajenos... acabará comiendo los tuyos. Yo facturo la advertencia.',
    onEnd: 'acto3_rec_vult',
    options: [
      { text: 'Te devolveré el día, Vult. Y la Liga te devolverá la certeza.', tone: 'empatico' },
      { text: 'Días que no pasaron, mapas en blanco. Busquemos la boca que come.', tone: 'pragmatico' },
      { text: 'Facturas hasta el apocalipsis. Con ese talante llegarás viejo.', tone: 'sarcastico' },
      { text: 'La Liga puede facturar mi paciencia. Que la Niebla no pruebe suerte.', tone: 'amenazante' },
    ],
  },
  acto3_brisa_cierre2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Tres ayeres comidos... y una aldea entera. La Niebla ya no avanza borrando, Portador: avanza DIGIRIENDO. Y eso que aprende, alguien se lo enseña... o alguien lo recuerda desde el otro lado. (te mira un largo rato) Velmora te observa. Lleva tres noches de pie detrás de tus ojos, esperando que supieras escuchar. Habla. Yo haré de puerta.',
    onEnd: 'acto3_report',
    options: [
      { text: 'Velmora... hablemos.', next: 'acto3_velmora_revela' },
      { text: 'Necesito respirar antes de hablar con presencias.', tone: 'pragmatico' },
    ],
  },
  // ----- q13 · La Primera Portadora -----
  acto3_velmora_revela: {
    name: 'Velmora', portrait: 'wisp',
    text: '...Al fin. Trescientos años esperando un oído que no temblara. Escucha, Portador, porque la letra que te contaron es verdad a medias: Aelthar no murió por su PODER. Murió por su HAMBRE. Cada nota del Canto le costaba un ayer del mundo —un día entero de vidas ajenas, comido y digerido en melodía—. El mundo se quedaba sin ayeres para que un dios tuviera canción. ¿Sigues ahí? Los oídos que no temblan suelen ser los primeros en huir.',
    onEnd: 'accept_q13',
    options: [
      { text: 'Sigo aquí. Si tu verdad pesa, la sostengo contigo.', next: 'acto3_velmora_escucha', tone: 'empatico' },
      { text: 'Sigo aquí. Los datos primero; el miedo después.', next: 'acto3_velmora_escucha', tone: 'pragmatico' },
      { text: 'Un dios con hambre y un mundo a la carta. Qué menú.', next: 'acto3_velmora_hierro', tone: 'sarcastico' },
      { text: 'A los oídos no se les echa. Habla, presencia.', next: 'acto3_velmora_hierro', tone: 'amenazante' },
    ],
  },
  acto3_velmora_escucha: {
    name: 'Velmora', portrait: 'wisp',
    text: '...Cálido. Tardaron trescientos años en dejarme hablar sin lanzas en la sala. Entonces toma mi voz, Portador: la tengo guardada desde la primera nota.',
    next: 'acto3_velmora_secreto',
  },
  acto3_velmora_hierro: {
    name: 'Velmora', portrait: 'wisp',
    text: 'Je. Fiero. Bien: los mansos cantaron lo que la Niebla quería oír; los fieros cambiaron la letra. Entonces toma mi voz, Portador: la tengo guardada desde la primera nota.',
    next: 'acto3_velmora_secreto',
  },
  acto3_velmora_secreto: {
    name: 'Velmora', portrait: 'wisp',
    text: 'Yo fui la PRIMERA Portadora. Antes que tu nana, antes que tu faro: la primera nota del Canto se pagó con MI ayer. La Orden no asesinó a tu dios por poder — mató por MISERICORDIA: mientras cantara, el mundo entero era su despensa. Dos verdades caben en una noche, Portador: fue un asesinato... y fue un regalo. Lo que ahora canta al revés con voz de mujer es mi nota, devuelta del otro lado: la Niebla aprendió lo que yo supe... y busca el día que di.',
    next: 'acto3_decision',
  },
  acto3_decision: {
    name: 'Velmora', portrait: 'wisp',
    text: 'Esta verdad pesa más que tu acero, Portador, y las verdades pesadas hay que darlas a quien pueda sostenerlas. Elige quién: los Guardianes, que llevan trescientos años cantando venganza... o el silencio, que también es una misericordia.',
    options: [
      { text: 'La verdad es de los Guardianes: la Orden mató por misericordia, y Brisa debe saberlo.', action: 'acto3_verdad', next: 'acto3_velmora_puerta', tone: 'pragmatico' },
      { text: 'La Orden guardó su secreto trescientos años. Que lo siga guardando.', action: 'acto3_silencio', next: 'acto3_velmora_puerta', tone: 'empatico' },
    ],
  },
  acto3_velmora_puerta: {
    name: 'Velmora', portrait: 'wisp',
    text: 'Escuchado sea, Portador, como se escucha una puerta: de una vez. Mi cripta no guarda mi cuerpo; guarda la puerta del tiempo, fuera del ayer y del mañana. Sube. Lo que aprendió mi voz te espera con mi cara puesta, cantando mi nota al revés. Devuélvele la nota a su dueña... y toma la mía, que ya no la necesito entera.',
    onEnd: 'acto3_velmora_fn',
    options: [
      { text: '(Subir a la Cripta: fuera del tiempo)', action: 'acto3_subir' },
      { text: 'Prepararme antes. Nadie entra a una puerta sin filo.', tone: 'pragmatico' },
    ],
  },
  acto3_brisa_cierre3: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '...Así que era eso. Trescientos años cantándole a un dios hambriento y a una Orden misericordiosa, y nosotros en medio, con el canto partido. (seca los ojos sin disimular) El Guardián recordado ya no canta: descansan sus notas. Toma lo prometido, Portador, y guarda esa memoria que te ha quedado: también es mía, de alguna manera. La primera Portadora y esta vieja: a todas nos canta la misma Niebla.',
    onEnd: 'acto3_report',
    options: [
      { text: '(Dejar que el Canto descanse: terminar la demo)', action: 'end_demo' },
      { text: 'Aún hay ecos que enderezar.', tone: 'empatico' },
    ],
  },
};
// Los 108 nodos previos quedan intactos: este assign SOLO añade claves nuevos.
Object.assign(DIALOGUES, D_ACTO3);

// ---------------- Referencia viva al Guardián recordado (jefe élite de q13) ----------------
/**
 * 13-a: hooks.acto3_subir instancia el jefe élite del clímax (makeEnemy, el mismo
 * mecanismo que usa challenge.ts para los duelos) y guarda AQUÍ la referencia;
 * engine.killEnemy muta `.dead` por su rama de etype 'guardian' (reutilización
 * completa del trato de jefes del Acto II). getDialogue (envoltorio) y hooks
 * (acto3CatchUp) lo leen para detectar la derrota y avanzar q13 paso 1→2.
 * Se guarda en data.ts y no en hooks.ts porque el envoltorio de getDialogue
 * vive aquí (data→hooks sería un ciclo de valor nuevo).
 */
export const ACTO3_ELITE: { ref: { dead?: boolean } | null } = { ref: null };

// ---------------- Envoltorio de getDialogue (ruteo del Acto III) ----------------
/**
 * Captura la función ORIGINAL de ruteo (Acto I/II, intacta) y la exporta para
 * que el smoke pruebe la regresión: wrapper(nid, ctx) === base(nid, ctx) para
 * todo el rango previo. La única ruta nueva fuera del rango 10-12 es la
 * transición q10→q11 (brisa con acto2Done y sin q11 → arranque del Acto III).
 */
const GET_DIALOGUE_ACTO1_2 = getDialogue;
export const GET_DIALOGUE_BASE = GET_DIALOGUE_ACTO1_2;

function getDialogueActo3(nid: string, ctx: DialogueCtx): string {
  const q = ctx.questIdx, s = ctx.questStep, f = ctx.flags;
  // transición q10 → q11: Brisa arranca el Acto III tras el informe del Acto II
  if (nid === 'brisa' && q === 9 && f.acto2Done && !f.q11) return 'acto3_brisa_alba';
  if (q < 10 || q > 12) return GET_DIALOGUE_ACTO1_2(nid, ctx);
  switch (nid) {
    case 'brisa': {
      if (q === 10) return s === 2 ? 'acto3_brisa_cierre1' : GET_DIALOGUE_ACTO1_2(nid, ctx);
      if (q === 11) {
        if (s === 2) return 'acto3_brisa_cierre2';
        return f.q12 ? GET_DIALOGUE_ACTO1_2(nid, ctx) : 'acto3_brisa_q12'; // briefing auto-reparable
      }
      // q13 (índice 12)
      if (!f.q13 || s === 0) return 'acto3_velmora_revela';
      const eliteDead = !!f.guardianRecordadoDerrotado || ACTO3_ELITE.ref?.dead === true;
      if (!eliteDead) return 'acto3_velmora_puerta'; // re-entrada a la Cripta (anti-bloqueo)
      if (!f.acto3Done) return 'acto3_brisa_cierre3';
      return GET_DIALOGUE_ACTO1_2(nid, ctx); // Acto III cerrado: idle del Acto I/II
    }
    case 'toln':
      if (q === 10 && s === 0) return toneOf(ctx.flags) === 'sarcastico' ? 'acto3_toln_intro_sarc' : 'acto3_toln_intro';
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case 'teo':
      if (q === 10 && s === 1 && !f.ecoInvTeo) return 'acto3_eco_teo';
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case 'doran':
      if (q === 10 && s === 1 && !f.ecoInvDoran) return 'acto3_eco_doran';
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case 'mara':
      if (q === 10 && s === 1 && !f.ecoInvMara) return 'acto3_eco_mara';
      if (q === 11 && !f.recMara) return 'acto3_mara_ayer';
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case 'mera':
      if (q === 11 && !f.recMera) return 'acto3_mera_alba';
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case 'ivo':
      if (q === 11 && !f.recIvo) return 'acto3_ivo_ayer';
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case 'vult':
      if (q === 11 && !f.recVult) return 'acto3_vult_ayer';
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    default:
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
  }
}
// @ts-expect-error 13-a: reasignación deliberada del binding de función (envoltorio
// del Acto III). El binding exportado es vivo: engine.talkTo resuelve SIEMPRE por
// aquí, y toda ruta no-Acto-III delega en la función original intacta.
getDialogue = getDialogueActo3;

// ═══════ FIN DEL BLOQUE 13-a ═══════
