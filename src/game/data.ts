// ============================================================
// ECOS DE AELTHAR — Datos: misiones, diálogos, enemigos, skills
// Todo el contenido vive en datos (arquitectura del GDD)
// ============================================================

import type { QuestDef, DialogueNode, DialogueOption, EnemyType, Element, ToneKind, SpawnDef } from './types';
import { INTERIOR_NPC_DIALOGUES } from './maps_interiores'; // R10-5: diálogos de interiores
// R11 · EPIC 7: mini-jefes (7.1) + esbirro + diálogos de historia (7.3)
import { minibossEnemyDefs } from './actors/minibosses'; // type-only deps: sin ciclo runtime
import { AHOGADO_DEF_R11 } from './actors/minibossai';   // ciclo benigno (lee ENEMY_DEFS solo en funciones)
import { installDialoguesR11, getDialogueR11 } from './dialogues_r11'; // assign solo DENTRO de install (idempotente)

// ---------------- Misiones (cadena principal de la demo) ----------------

export const QUESTS: QuestDef[] = [
  { id: 'q1', name: 'El Despertar', steps: ['Habla con la Anciana Brisa en la plaza de Lunaris'] },
  { id: 'q2', name: 'Lobos en la Niebla', steps: ['Caza 3 Lobos de Niebla en el sur del valle (0/3)', 'Vuelve con la Anciana Brisa'] },
  { id: 'q3', name: 'El Susurro del Bosque', steps: ['Viaja al norte: el Bosque Susurrante te espera', 'Encuentra la Ruina Antigua y toca el Fragmento de Eco'] },
  { id: 'q4', name: 'La Cripta del Primer Canto', steps: ['Cruza el puente roto cambiando al pasado (Q)', 'Derrota al Guardián Hueco y silencia su coro', 'Recupera el Eco de la Voz del altar'] },
  { id: 'q5', name: 'Ecos de Esperanza', steps: ['Regresa con la Anciana Brisa a Lunaris'] },
  // ------- ACTO II · Las Notas Perdidas (expansión) -------
  { id: 'q6', name: 'El Rumor del Mar', steps: ['Viaja al sur de Lunaris: la Costa de Bruma', 'Habla con Mara, la farera'] },
  { id: 'q7', name: 'La Sirena sin Canto', steps: ['Encuentra la nave naufragada al este de la costa', 'Derrota a la Sirena Abisal', 'Recupera el Eco de las Mareas en su altar'] },
  { id: 'q8', name: 'La Aldea que Olvidó su Nombre', steps: ['Viaja a la Aldea de Merrow, al este de la costa', 'Enciende los 3 Faroles del Recuerdo (cambia al pasado con Q)', 'Habla con la Espectro de Merrow'] },
  { id: 'q9', name: 'La Cumbre del Segundo Canto', steps: ['Cruza el paso del noreste del Bosque: Cumbres Heladas', 'Derrota al Gólem de Escarcha', 'Recupera el Eco de las Cumbres en su altar'] },
  { id: 'q10', name: 'Dos Voces más Fuertes', steps: ['Regresa con la Anciana Brisa a Lunaris'] },
];

// ---------------- Diálogos ----------------

export interface DialogueCtx { questIdx: number; questStep: number; flags: Record<string, number | boolean | string>; companion: boolean }

// ---------------- Memorias del Portador (biblia: cada Eco devuelve un recuerdo) ----------------
// Contrato: screens.ts (pestaña Diario) y hooks.ts (overlay memoryReveal) leen esta tabla.

export interface MemoryDef { id: string; title: string; text: string }

export const MEMORIES: Record<string, MemoryDef> = {
  mem_nana: {
    id: 'mem_nana',
    title: 'Memoria I · La nana',
    text: 'Una voz te arrulla junto al río y tararea la melodía que llevas silbando desde que despertaste. No ves su rostro: solo el vaivén del chal, y la Niebla deteniéndose a escuchar, quieta como una oyente. La melodía la conoce. La canta contigo... y tú nunca se la enseñaste.',
  },
  mem_casa: {
    id: 'mem_casa',
    title: 'Memoria II · La casa junto al río',
    text: 'Una casa de piedra bajo un sauce llorón. Huele a pan y a tinta. En el umbral, dos tazas: una siempre llena, humeando, como si alguien acabara de irse... o de no haberse ido nunca. La Niebla espera tras la valla, paciente. Esta casa estaba en Lunaris. Antes.',
  },
  mem_madre: {
    id: 'mem_madre',
    title: 'Memoria III · La madre sin rostro',
    text: 'Manos que cosen una marca de onda en tu pañoleta. «Cuando no recuerdes quién eres —dice una voz que ya casi no oye su propio canto—, acuérdate de lo que has hecho.» Quieres girarte. El recuerdo se quiebra en silencio y, por un latido, jurarías que ella también intenta verte la cara... y no puede.',
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
  { text: 'Ver corazas de la forja', next: 'toln_armaduras' }, // 14-b
  { text: 'Comprar poción (15 coronas)', next: 'toln_potion', action: 'buy_potion' },
  { text: 'Comprar señuelo de caza (60 coronas)', next: 'toln_sennuelo', action: 'buy_sennuelo' }, // 16-b
  { text: '¿Qué sabes de la Noche del Silencio?', next: 'toln_lore' },
  { text: 'Hasta luego.', next: 'toln_bye' },
];

const D: Record<string, DialogueNode> = {
  // ----- Brisa -----
  brisa_intro: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Despierta, Portador. Tres noches dormiste junto al Santuario y tres noches algo cantó bajo tus sueños: una voz que subía desde la tierra y llamaba a la puerta de tu nombre, muy despacio, para no despertarte del todo. Esa voz tiene dueño. Se llama Aelthar... y lleva trescientos años esperando que alguien la oiga. Esta mañana ha callado de golpe: ya no necesita soñarte. Te tiene delante.',
    next: 'brisa_intro2',
  },
  brisa_intro2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Hace 300 años, en la Noche del Silencio, mataron al dios-tejedor. Su canto se rompió en siete Ecos y desde entonces la Niebla Muda avanza borrando aldeas, recuerdos y nombres: primero se oyen menos pájaros; después, menos voces; y cuando ya nadie queda que diga un nombre en voz alta —un nombre dicho es una vela—, la Niebla entra a apagar. Merrow, al sur, ya no recuerda su propio nombre.',
    next: 'brisa_intro3',
  },
  brisa_intro3: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Tú puedes OÍR los Ecos, y eso te hace distinto... o señal: en un valle que aprende a callarse, el que todavía suena llama a algo. El primer fragmento duerme en la Cripta del Primer Canto, al otro lado del Bosque. Pero antes de enviarte hacia ese silencio, necesito saber si puedes sostener un arma.',
    options: [
      { text: 'Cuéntame qué se perdió aquella noche. Quiero entenderlo de verdad.', next: 'brisa_lore', tone: 'empatico' },
      { text: 'Sé usar un arma. Dime qué hay que hacer y lo haré.', next: 'brisa_quest2', tone: 'pragmatico' },
      { text: 'Vaya: elegido por un dios muerto... y sin propina de por medio.', next: 'brisa_reac_sarc', tone: 'sarcastico' },
      { text: 'Apártate, vieja. Si ese Eco existe, será mío.', next: 'brisa_reac_amenaz', tone: 'amenazante' },
    ],
  },
  brisa_reac_sarc: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Je... trescientos años esperando un héroe y la Niebla me manda uno con lengua. Ríete, muchacho: la risa dura hasta que la niebla aprende tu nombre. Toma, para empezar, trabajo de verdad: unos lobos con hambre de tu Eco.',
    next: 'brisa_quest2',
  },
  brisa_reac_amenaz: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Esos ojos ya los he visto, Portador, en todos los que subieron a la Cripta con hambre de Eco. Ninguno volvió a cantar; algunos volvieron... pero ya no eran del todo. Aquí no se toma lo que se escucha: aprende la diferencia... y ve a cazar esos lobos.',
    next: 'brisa_quest2',
  },
  brisa_lore: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Un Eco es un recuerdo del dios hecho cristal. Quien lo toca revive el pasado de esta tierra: verás el mundo como era y, en algunos lugares, podrás alternar entre ambas épocas. Los Guardianes del Canto llevamos 300 años buscándolos. Y tú llegaste justo a tiempo... justo cuando el valle menos respira.',
    next: 'brisa_quest2',
  },
  brisa_quest2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'La Niebla trae lobos del sur: han olido el Eco que duerme en ti, y esa hambre no se apaga sola. Caza a tres y el valle volverá a respirar. Habla con Toln si necesitas acero. Y, Portador... vuelve con vida: aquí los funerales ya no saben qué nombre decir.',
    onEnd: 'accept_q2',
  },
  brisa_wolves: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Los lobos aúllan hacia el sur, entre la niebla del valle. Usa la esquiva cuando vayan a saltar y golpea cuando bajen la guardia. Y si oyes un aullido que responde desde detrás de ti... no era un lobo.',
  },
  brisa_bosque: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El Bosque Susurrante está al norte. Busca la Ruina Antigua, más allá del río: allí susurra el Fragmento de Eco. Lleva pociones, descansa en los Santuarios... y no confíes en la noche: el bosque respira, y a veces respira como si supiera que estás ahí.',
  },
  brisa_reward: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El valle ya respira. Toma esto: coronas del fondo del pozo y una poción de la vieja receta. Los Guardianes del Canto te recordarán, Portador... si la Niebla nos deja recordar.',
    onEnd: 'accept_q3',
    options: [
      { text: 'Gracias, Brisa. El valle huele a menos silencio gracias a ti.', next: 'brisa_rw_emp', tone: 'empatico' },
      { text: 'Anotado. ¿Qué sigue?', next: 'brisa_rw_prag', tone: 'pragmatico' },
      { text: '¿Coronas del fondo del pozo? Espero que nadie las eche de menos.', next: 'brisa_rw_sarc', tone: 'sarcastico' },
    ],
  },
  brisa_rw_emp: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '«Gracias a ti», alma. Hace treinta años que no oigo el valle respirar de noche. Ve al norte: el Bosque Susurrante guarda el primer susurro del Eco... y algo más que camina entre los árboles, escuchando quién canta.',
  },
  brisa_rw_prag: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Directo. Me gusta. Lo siguiente es el Bosque Susurrante, al norte: encuentra la Ruina Antigua y toca el Fragmento de Eco. Lleva pociones, y si el bosque se queda callado de golpe... no pares.',
  },
  brisa_rw_sarc: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Deseadas fueron, y por eso están donde están: el pozo las guardaba de la Niebla. Habla así delante del agua y quizá te las devuelva... mojadas. O acompañadas.',
  },
  brisa_fragment: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '¿Lo sentiste? El Fragmento ha despertado tu resonancia: ahora puedes alternar entre el presente y el PASADO de estas tierras. Pulsa Q y mira el valle como era antes del Silencio. No temas si algo del pasado te mira de vuelta: lleva mucho tiempo esperando a que alguien vuelva... y todavía más ensayando cómo saludar.',
    next: 'brisa_fragment2',
  },
  brisa_fragment2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El puente del Bosque se rompió hace 300 años... pero en el pasado sigue en pie, esperando. Cruza, llega a la Cripta y recupera el Eco de la Voz. Que tu canto sea más fuerte que tu miedo... porque allá abajo, el miedo también canta.',
    onEnd: 'accept_q4',
  },
  brisa_crypt: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El puente solo existe en el pasado, Portador: pulsa Q junto a él. Y dentro de la Cripta... no confíes en lo que la voz te prometa. Las cosas que llevan mucho tiempo solas aprenden a imitar muy bien lo que fueron.',
  },
  brisa_final: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El Eco de la Voz... después de 300 años vuelve a sonar en Lunaris. Escucha: ahora la melodía lleva tu nombre entre sus notas, y hay oídos que no perdonan ser excluidos. Esta noche, cuando la tararees, fíjate si el valle calla a la vez: es su manera de darte las gracias... o de aprendértela. Los Guardianes ya cantan en la capilla. Esta era solo la primera nota, Portador: quedan seis Ecos... y la Niebla seguirá avanzando mientras no los reúnas.',
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
    text: 'Entonces descansa en los Santuarios, mejora tu acero con Toln y busca los ecos menores que susurran entre las ruinas. Velmora te necesita despierto, no apresurado... despierto, sobre todo despierto. Vuelve cuando quieras terminar la demo.',
  },
  brisa_end: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Que el canto te acompañe, Portador. Nos vemos en la siguiente nota... si la Niebla nos deja llegar hasta ella.',
    onEnd: 'end_demo',
  },
  brisa_idle: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El valle respira y el mundo suena más lejos, Portador: el mar llama desde el sur y la montaña aguarda al norte. Yo pongo una silla para la noche y me quedo escuchando qué calla. Cuando quieras ponerle final a la demo, vuelve a mí y lo cantaremos juntos.',
  },
  // variantes por tono dominante (biblia: los PNJ tratan distinto al Portador)
  brisa_idle_emp: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Ahí estás, alma. Ahora que el valle respira, el resto del mundo suena más lejos: el mar al sur, las cumbres al norte, y tú en medio con una melodía que ya no es solo tuya — hay noches en que el eco la devuelve antes de que acabes de silbarla. La demo seguirá esperándote aquí, junto a la taza llena.',
  },
  brisa_idle_amenaz: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '...El pueblo cruza de acera cuando pasas y hasta la bruma te deja pasar primero, Portador. Hasta los lobos han aprendido tu paso y se apartan sin ladrar, y eso no me gusta: lo que se aparta está contando dónde estás. Modera esa lengua con la Orden de Vesh: toman los silencios por amenazas, y la Ciudadela ya oye tu melodía. La demo seguirá esperándote aquí.',
  },

  // ----- Toln -----
  toln_intro: {
    name: 'Maestro Toln', portrait: 'toln',
    text: '¡Ja! El viejo Brisa dice que oíste Ecos. Yo oigo otra cosa: tu arma pidiendo filo y, a las horas muertas, otras voces pidiendo entrada. La forja sigue caliente, Portador. El metal no pregunta por dioses, y por eso me gusta.',
    options: TOLN_MAIN,
  },
  // variante por tono dominante: a Toln le divierte el Portador sarcástico
  toln_intro_listillo: {
    name: 'Maestro Toln', portrait: 'toln',
    text: '¡Ja! Vuelve el Listillo. La forja no descuenta ironías, pero sí cambia filo por coronas. ¿Qué será hoy? Y no hables tan alto cerca del yunque: hay noches que contesta.',
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
  // 14-b: corazas de la forja (la compra vive en applyAction case 'armor_N')
  toln_armaduras: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Corazas, ahora que la Niebla pega más fuerte. El cuero es honesto, la malla canta bajito y las Placas pesan como una confesión. Dime cuál y te la forjo.',
    options: [
      { text: 'Coraza de Cuero (80 coronas) — daño recibido −8%', next: 'toln_armaduras', action: 'armor_1' },
      { text: 'Malla del Alba (160) — −15% · +10 vigor/s', next: 'toln_armaduras', action: 'armor_2' },
      { text: 'Placas del Canto (240) — −22% · −8% velocidad', next: 'toln_armaduras', action: 'armor_3' },
      { text: 'Manto de Ecos (280) — −12% · refleja 15% melé', next: 'toln_armaduras', action: 'armor_4' },
      { text: 'Guarda del Primer Canto (420) — −28%', next: 'toln_armaduras', action: 'armor_5' },
      { text: 'Volver', next: 'toln_intro' },
    ],
  },
  toln_potion: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Para los caminos largos. Bebe con cabeza... y no te entretengas mirando el fondo de la botella: hay noches en que ese fondo también mira.',
    next: 'toln_intro',
  },
  // 16-b: señuelo de caza (la compra vive en applyAction case 'buy_sennuelo')
  toln_sennuelo: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Señuelo de caza: carne curada, hierro viejo y un olor que los bichos no perdonan. Lo lanzas (tecla 8) tres pasos adelante, ellos van a por él, y tú decides si peleas o te escabulles. Ojo: los jefes no se distraen con panzadas.',
    next: 'toln_intro',
  },
  toln_lore: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Mi abuelo forjó el arma que mató al dios. No lo digo con orgullo: lo digo con vergüenza. Desde entonces, cada martillazo mío es una disculpa... y algunas noches el yunque me responde con lo que quedó de su canto. Si algún día vas a la Ciudadela... crimson sobre acero, recuerda mi nombre.',
    next: 'toln_intro',
  },
  toln_bye: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'El acero espera. Y cuidado con la niebla al sur: desde ahí no vuelven ni los nombres.',
  },

  // ----- Ilwen -----
  ilwen_intro: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Un Portador, aquí... ¿también tú oyes a la Niebla robando nombres? Yo busco a mi hermana Naia: se la llevó hacia el norte, y cuando el viento cruza los árboles todavía oigo su silbo... o algo que lo aprendió. Sé moverme entre esta madera oscura y mi arco no falla.',
    options: [
      { text: 'Ven conmigo. Nadie debería tener que buscar sola.', next: 'ilwen_join', action: 'recruit_ilwen', tone: 'empatico' },
      { text: 'Necesito cobertura a distancia. Tú necesitas pistas. Trato justo.', next: 'ilwen_join', action: 'recruit_ilwen', tone: 'pragmatico' },
      { text: '¿Y si lo que quedó de tu hermana ya no responde a tu silbo?', next: 'ilwen_reac_amenaz', tone: 'amenazante' },
      { text: 'Sigo solo por ahora.', next: 'ilwen_wait' },
    ],
  },
  ilwen_reac_amenaz: {
    name: 'Ilwen', portrait: 'ilwen',
    text: '...(baja el arco un dedo) Cuida esa lengua, Portador. La Niebla borra nombres; tú pareces empeñado en borrar también las esperanzas. Cuando hables como alguien con quien caminar, aquí estaré: es el único sitio del bosque donde no crece nada.',
    next: 'ilwen_wait',
  },
  ilwen_join: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Entonces vamos, Portador. Cubriré tu espalda desde la distancia. Que los árboles nos encubran... y si oyes mi silbo a tu izquierda cuando yo esté a tu derecha, no le sigas ni le respondas.',
  },
  ilwen_wait: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Te encontraré aquí si cambias de idea. El Bosque no perdona a los solitarios... y ha tenido tiempo de aprender por qué.',
  },
  ilwen_chat: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Naia cantaba mejor que las nereidas. Si la Niebla no borró su nombre, la encontraré. Cuenta con mi arco, Portador... y si el bosque te llama por el tuyo, no respondas.',
  },
  // variante por tono dominante: Ilwen respeta al Portador pragmático
  ilwen_chat_prag: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Hablamos claro, los dos: me gusta cómo mandas. Sin promesas ni flores. Mi arco cubre a quien sabe lo que quiere. Naia cantaba mejor que las nereidas... la encontraré, aunque tenga que preguntar a la propia Niebla. Cuenta conmigo, Portador.',
  },

  // ----- Voces -----
  voz_fragment: {
    name: '???', portrait: 'fragment',
    text: '...¿quiéeeeen... despierta... el canto...? Ah... otro Portador. Otro pedazo de mí, extraviado en el tiempo... huelo el hueco que traes. Toma mi resonancia: alterna entre lo que fui y lo que soy. (Has desbloqueado el CAMBIO DE ÉPOCA: pulsa Q)',
    onEnd: 'fragment_touched',
    options: [
      { text: 'Descansa. Te devolveré cada pedazo, aunque me lleve vidas.', next: 'voz_frag_emp', tone: 'empatico' },
      { text: 'Resonancia aceptada. Ahora: ¿dónde oigo el resto?', next: 'voz_frag_prag', tone: 'pragmatico' },
      { text: 'Un dios que se paga a plazos. Qué época tan práctica.', next: 'voz_frag_sarc', tone: 'sarcastico' },
    ],
  },
  voz_frag_emp: {
    name: '???', portrait: 'fragment',
    text: '...vides... sí... Yo también tardé vidas en aprender a callar. Ve... el valle recuerda por donde caminas... te canta por debajo... escúchalo de noche... y si algo te acompaña a dúo sin haber aprendido la letra... no le des las gracias...',
  },
  voz_frag_prag: {
    name: '???', portrait: 'fragment',
    text: '...el primero duerme bajo la Cripta, custodiado por lo que quedó de mi primer coro. Lleva acero... y canto. El resto... ya lo oirás... todos lo oímos, al final...',
  },
  voz_frag_sarc: {
    name: '???', portrait: 'fragment',
    text: '...mmm... bromea el pedacito... A los dioses nos matan por partes, ¿sabías? Primero la voz... luego el nombre... y lo que recuerdan de ti deja de ser tuyo. Tú verás qué te toca recoger...',
  },
  voz_vesh: {
    name: 'Gran Inquisidor Vesh', portrait: 'sombra',
    text: 'Puedo oírte, Portador. Cada paso que das hacia el Eco resuena en MI ciudadela: esta piedra lo guarda todo, y tu nombre ya está escrito en ella, junto al de todos los que subieron. Sube. Reúne las migajas de tu dios... y yo recogeré lo que quede de ti. Para eso están estas paredes: para recordar a los que ya no pueden.',
  },
  voz_guardian: {
    name: 'Guardián Hueco', portrait: 'guardian',
    text: 'EL CORO... SE ME QUEDÓ DENTRO... Y NO CABE... LLEVA TRESIENTOS AÑOS SIN CABER... TÚ... LLEVAS... RESONANCIA... LA OIGO... DETRÁS DE TUS DIENTES... DÉJALA... AQUÍ... Y ASÍ... DESCANSAMOS... TODOS... Y NADIE... MÁS... TIENE... QUE CANTAR...',
  },
  eco_voz: {
    name: 'Eco de la Voz', portrait: 'fragment',
    text: 'El primer canto vuelve a nacer entre tus manos y, por un latido, oyes a todas las cosas escuchando: la hierba, el agua, y la Niebla quieta de golpe, con la cabeza inclinada, aprendiendo. «Cuando el miedo te hable, canta más alto.» (Eco de la Voz recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)',
    onEnd: 'eco_taken_mem',
    options: [
      { text: 'Tu nana... era esta melodía, ¿verdad? La recordaba sin saber de quién.', next: 'eco_voz_emp', tone: 'empatico' },
      { text: 'Uno de siete. ¿Dónde oigo el siguiente?', next: 'eco_voz_prag', tone: 'pragmatico' },
      { text: '«Canta más alto», dice la voz. A ver si la Niebla es sorda también.', next: 'eco_voz_sarc', tone: 'sarcastico' },
    ],
  },
  eco_voz_emp: {
    name: 'Eco de la Voz', portrait: 'fragment',
    text: '...la cantaba junto al río, con el chal al hombro. No recuerdo su cara... y ella a mí tampoco me deja verse, mira tú... pero la canción sí. Ya es tuya. Cuídala: es más vieja que tu nombre, y ha calmado a más hambre de la que creerías.',
  },
  eco_voz_prag: {
    name: 'Eco de la Voz', portrait: 'fragment',
    text: '...escucha el bosque: los Ecos llaman a los Ecos. Y ten cuidado con los que rezan a lo que no canta... la Ciudadela también oye tu melodía ahora. Reza porque solo la oiga.',
  },
  eco_voz_sarc: {
    name: 'Eco de la Voz', portrait: 'fragment',
    text: '...no es sorda. Es paciente. Peor cosa. Canta, Portador... y ya verás quién responde: los que aman el canto... y los que aprendieron a temerlo tanto que no supieron dejar de escucharlo.',
  },

  // ----- Doran (druida del Círculo Verde · biblia: aceptan la Niebla como naturaleza) -----
  doran_intro: {
    name: 'Doran', portrait: 'doran',
    text: 'Sin prisa, sin espinas... La Niebla te eriza la piel, ¿eh? A nosotros nos da lástima. El Círculo Verde no la combate: la escucha. No es maldad, Portador: es lo que había ANTES del canto, cuando el mundo era silencio y raíz... y las raíces aún se acuerdan de cómo se vivía entonces.',
    options: [
      { text: 'Si la Niebla guarda algo, merece que alguien la escuche. Enséñame.', next: 'doran_verde', action: 'rep_circulo_5', tone: 'empatico' },
      { text: 'Teoría interesante. ¿Y qué gana el Círculo defendiéndola?', next: 'doran_verde', action: 'rep_circulo_5', tone: 'pragmatico' },
      { text: 'Qué bonito: apocalipsis con musgo. ¿Y los pueblos que se borra?', next: 'doran_sarc', tone: 'sarcastico' },
      { text: 'La Orden de Vesh la quemaría con lanza y sal. Y no creo que erraran.', next: 'doran_orden', tone: 'amenazante' },
    ],
  },
  doran_verde: {
    name: 'Doran', portrait: 'doran',
    text: 'Lo oyes, ¿verdad? Debajo del bosque hay una melodía que no canta Aelthar... más vieja. No rendimos culto a la Niebla: le enseñamos dónde parar, como se educa un río con presas. Vuelve cuando lleves el primer Eco: entonces la Niebla te sonará distinto... y quizá te llame de otra manera.',
  },
  doran_sarc: {
    name: 'Doran', portrait: 'doran',
    text: 'Los borra porque no les dejan sitio, como el agua cuando tapan el cauce. Podemos discutirlo sentados una noche de luna... o puedes seguir golpeando raíces con el acero y ver quién se cansa antes. Aviso: las raíces nunca se cansan. Solo esperan.',
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
    text: 'Que la Madre Espina te oiga. Los del Círculo no olvidamos a quien se planta frente a la Lanza. Pasa cuando quieras: el bosque ya conoce tu paso... y lo ha tejido en su manera de crecer.',
  },
  doran_bye: {
    name: 'Doran', portrait: 'doran',
    text: 'Piénsalo caminando. La Niebla no corre: llega. Y cuando llegue, preferiré teneros a todos cantando del mismo lado.',
  },

  // ----- Heraldo de Vesh (aparece tras el Eco de la Voz · biblia: Orden de Vesh) -----
  heraldo_intro: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: 'Así que este es el recipiente. No te arrodilles: no sería sincero. El Gran Inquisidor sabía que la Niebla escondía el primero de los siete... y ahora dice: «la Lanza ya está preparada para la segunda vez». Yo solo repito las palabras. Al recipiente no le hace falta entenderlas: basta con que contenga. Y lo que se echa dentro, una vez, ya no suele pedir permiso para quedarse.',
    options: [
      { text: 'Dile a tu Inquisidor que si quiere lo que llevo, que baje a buscarlo.', next: 'heraldo_amenaz', action: 'rep_orden_-5', tone: 'amenazante' },
      { text: 'No soy «recipiente» de nadie. Pero de momento hablaremos.', next: 'heraldo_prag', tone: 'pragmatico' },
      { text: '¿Qué es «la segunda vez»?', next: 'heraldo_emp', tone: 'empatico' },
    ],
  },
  heraldo_amenaz: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: '...La guardaré para el informe, palabra por palabra. Sabes, recipiente: el acero de la Ciudadela canta muy bajo, y por eso corta tanto. El Gran Inquisidor os espera a ti y a tu melodía. Camina con cuidado... y con contabilidad puesta al día.',
  },
  heraldo_prag: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: 'La calma fingida también es una respuesta; el Inquisidor la acepta, envuelta en papel y sello. Cuando contengas los siete —si llegas—, la Orden vendrá a cobrarlos. La Orden siempre cobra. Nos veremos, recipiente.',
  },
  heraldo_emp: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: 'La primera vez, la Lanza de los Durn atravesó el costado del dios y su canto se hizo mil pedazos que llamáis Ecos. La segunda vez... eso no me corresponde contarlo. El Gran Inquisidor espera que seas tú quien lo cuente, cuando todo esté en su sitio.',
  },

  // ----- Teo (niño rescatado de la Niebla · guiño a la biblia) -----
  teo_intro: {
    name: 'Teo', portrait: 'teo',
    text: '¿Eres tú? ¿El que sacó a la gente de la Niebla? Yo no recuerdo cómo salí... solo una nana que me cantaba mi madre: mmm-mm-mmm... La cantas igual que yo la sueño, ¿lo sabías? Cuando la tarareo, la niebla no me pega tanto miedo. Y cuando te oigo cantarla a ti, casi se me olvida que la soñé antes de oírla.',
    options: [
      { text: 'Cántala siempre, Teo. Las canciones cuidan a quien las lleva.', next: 'teo_emp', tone: 'empatico' },
      { text: 'Quédate cerca del Santuario y del pozo. Es lo más seguro.', next: 'teo_prag', tone: 'pragmatico' },
      { text: 'Vaya talento: la Niebla borra pueblos y tú la despiertas a dúo.', next: 'teo_sarc', tone: 'sarcastico' },
    ],
  },
  teo_emp: {
    name: 'Teo', portrait: 'teo',
    text: '¡Prometido! La canto para merendar, para dormir y para que la luna no se pierda. Un día, si te pierdes, me la cantas al revés y me encuentras. Así funciona, ¿no?',
  },
  teo_prag: {
    name: 'Teo', portrait: 'teo',
    text: 'Vale... aunque de noche el pozo susurra y yo le susurro de vuelta. Nos entendemos. Si ves que no estoy, es que estoy aprendiendo nombres nuevos: me los enseña el pozo. Dice que son gratis.',
  },
  teo_sarc: {
    name: 'Teo', portrait: 'teo',
    text: '(se ríe) ¡Mmm-mmm!, ¡aaaah! ¿Ves? La Niebla ni se mueve... Tú también puedes, solo que te da vergüenza cantar delante de la gente mayor.',
  },

  // ================= ACTO II · Las Notas Perdidas (expansión) =================
  // ----- Mara, la farera (Costa de Bruma · biblia: la luz como gesto de memoria) -----
  mara_intro: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: '¿Vivo? Hacía meses que no bajaba nadie por el camino del valle... Un Portador, dice la bruma. Pues mira: el faro lleva trescientos años apagado y mi familia lleva trescientas noches encendiéndole una cerilla a la esperanza. Mi abuelo juraba que el mar guarda las notas que el dios no pudo cantar. Yo digo que algo ha empezado a usarlas... y que las últimas notas que ensayaba sonaban sospechosamente a gente de aquí.',
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
    text: 'Al este hay un naufragio que la marea no se lleva; la Sirena canta debajo de la quilla. Cuando canta, los pescados suben a oírla y no vuelven... y los pescadores que la siguen, menos. Lo peor no es eso, Portador: es que la marea los devuelve del revés, empapados y sonriendo, y que los barcos amarran solos cuando ella ensaya. Si vas —y vas, se te nota en la cara— llévate sal, silencio y no le sigas la letra.',
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
    text: 'Eres de los que escuchan antes de pisar. Mi abuelo decía que así empezaron todos los fareros: el mar guarda las notas que el dios no pudo cantar, y alguien tiene que quedarse en la orilla anotando las que vuelven. Las demás también vuelven, pero no preguntan: se quedan junto a la ventana hasta que alguien cierra. Vuelve tú, ¿eh? Anota las mías.',
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
    text: 'Sigo sin poner nombre al promontorio del faro. «Punta de la Cerilla», dice la letra; «Punta de Mara», dice mi conciencia. Y junto al naufragio hay un cabo que dibuja una silueta distinta cada noche: no lo nombro, ni lo miro dos veces. Los mapas mienten mejor cuando les das tiempo.',
  },
  // variante por tono dominante
  vult_idle_prag: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: 'Si vas al este, memoriza el camino del naufragio: los clientes preguntan por rutas y yo vendo atajos. Los mapas sin nombres venden caros, Portador... pero los mapas con leyendas venden mejor. Y una advertencia de oficio: si me ves allá abajo, en la playa, cuando yo estoy aquí delante — no le compres. Aprendió mi letra.',
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
    text: 'El presente aprendió otra vez a iluminarse. Si me buscas, estaré junto a un farol encendido: es el sitio más parecido a una cita... y donde la sombra, al menos, ya no me pregunta el nombre.',
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
    text: 'El Gólem guarda el altar del Segundo Canto. Es hielo con memoria: lento, y cada paso suyo es una leyenda entera. No duerme, Portador: escucha. Lleva trescientos años contando los pasos de todo el que subió y no bajó. Cuando se detenga a reunir la ventisca, pega al quiebre: la montaña también estuvo hecha de canciones, y las canciones se rompen por la mitad.',
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
    text: 'Las cumbres estaban hechas para cantar por turnos, como los pastores de la vieja historia. Ahora solo cantan cuando el viento se equivoca... o cuando algo debajo de la escarcha quiere que parezca que se equivoca. Si subes a la cumbre, lleva fuego... y vuelve por otro camino, que el de subir ya lo conocen las arpías.',
  },
  // variante por tono dominante
  ivo_idle_emp: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: 'Buen viento traes, Portador. Los del Círculo Verde dicen que la montaña no está muerta, solo a la escucha. Yo casi lo creo: hay noches en que la nieve se para en el aire, como si esperara permiso para seguir cayendo. Ojalá tengan razón: sería una lástima que el segundo canto se quedara dentro para siempre... igual que mi padre se quedó sin volver a nevar tranquilo.',
  },
  ivo_after: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: '...Baja despacio, Portador. El eco de la cumbre llega hasta aquí: la montaña cantó de vuelta. Mi padre decía que cuando eso pasara, podría volver a nevar sin miedo. Tómate la cumbre con calma: los ecos viejos marean.',
  },

  // ----- Ecos del Acto II (el motor abre estos nodos desde el altar: onEnd contractual, no renombrar) -----
  eco_mareas: {
    name: 'Eco de las Mareas', portrait: 'fragment',
    text: 'El segundo canto asciende del naufragio, salado y vivo. «Guardé mi nota bajo la quilla de un barco que soñaba con estrellas —dice la voz—. La que me custodiaba olvidó su propia letra: cantaba a la Niebla lo que era mío... y la Niebla la ensaya desde entonces, noche tras noche, un tono más cerca de mi voz. Cántala tú, Portador: hay mareas que solo se curan devolviendo la nota.» (Eco de las Mareas recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)',
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
    text: 'El tercer canto desciende con la ventisca, limpio y paciente. «Las montañas aprendieron a guardar voces bajo el hielo —dice la voz—. La primera fue la de los pastores que cantaban por turnos para no dormirse. Todavía se turnan, Portador: todas las noches, en el mismo orden, aunque ya nadie las oiga. Toma la suya: ahora la cumbre canta contigo, y el frío ya no es silencio: es compás.» (Eco de las Cumbres recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)',
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
  // R10-5: diálogos de los INTERIORES (claves int_*) se resuelven a sí mismos
  if (nid.startsWith('int_') && DIALOGUES[nid]) return nid;
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
function toneOf(flags: Record<string, number | boolean | string>): ToneKind | null {
  const v = flags.tonoDominante;
  return typeof v === 'string' ? (v as ToneKind) : null;
}

export const DIALOGUES = D;

// R10-5: nodos de diálogo de los NPCs de los INTERIORES (claves int_*) —
// getDialogue los resuelve a sí mismos; los NPCs spawnnean al loadMap del interior.
Object.assign(DIALOGUES, INTERIOR_NPC_DIALOGUES);

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

// Record<string, EnemyDef> (14-a): la expansión inyecta tipos nuevos vía
// Object.assign (ENEMY_DEFS_14A) sin crecer el literal base.
export const ENEMY_DEFS: Record<string, EnemyDef> = {
  lobo: {
    name: 'Lobo de Niebla', hp: 30, dmg: 6, speed: 58, xp: 16, gold: [4, 8],
    sprite: 'lobo', aggroR: 95, atkR: 20, windup: 0.45, atkCd: 1.5,
    element: 'sombra', weakTo: 'fuego',
    desc: 'Perro guardián que la Niebla vació de ladrido: aúlla con voces que no son suyas. Caza en estampidas. Débil al fuego.',
  },
  esqueleto: {
    name: 'Esqueleto Cantor', hp: 46, dmg: 10, speed: 44, xp: 24, gold: [7, 12],
    sprite: 'esqueleto', aggroR: 90, atkR: 22, windup: 0.6, atkCd: 1.8,
    element: 'sombra', weakTo: 'sagrado',
    desc: 'Peregrino que cantó hasta vaciarse: aún marca el compás con su fémula de tambor, esperando a que el coro vuelva. Débil a la luz.',
  },
  sombra: {
    name: 'Sombra sin Rostro', hp: 30, dmg: 8, speed: 66, xp: 18, gold: [3, 6],
    sprite: 'sombra', aggroR: 110, atkR: 20, windup: 0.4, atkCd: 1.2,
    element: 'sombra', weakTo: 'sagrado',
    desc: 'Pedazo de Niebla con hambre. Devora nombres: si te roza, comprueba que sigues teniendo el tuyo. Rápida y frágil.',
  },
  guardian: {
    name: 'Guardián Hueco', hp: 300, dmg: 13, speed: 40, xp: 220, gold: [120, 160],
    sprite: 'guardian', aggroR: 150, atkR: 40, windup: 0.8, atkCd: 2.2,
    element: 'sombra', weakTo: 'ninguno', breakBar: 70,
    desc: 'Primer coro de Aelthar, vaciado por su propio canto. La resonancia le hace daño: quiebra su barra con golpes continuos.',
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
    text: '¿Lo oíste anoche, Portador? El Canto sonó AL REVÉS: las notas de Aelthar bajaron cuando debían subir. Toln jura que su forja cantó su nana del final al principio... y esta madrugada he visto pasar pájaros hacia el mar, de noche y sin cantar: los pájaros solo hacen eso cuando ya saben lo que viene. Lo que se canta al revés no tarda en abrirse paso. Ve a la forja y escúchalo tú: esta noche se han torcido tres ecos, y los ecos torcidos llaman a la Niebla.',
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
    text: '...Al fin. Trescientos años esperando un oído que no temblara. Escucha, Portador, porque la letra que te contaron es verdad a medias: Aelthar no murió por su PODER. Murió por su HAMBRE. Cada nota del Canto le costaba un ayer del mundo —un día entero de vidas ajenas, comido y digerido en melodía—. El mundo se quedaba sin ayeres para que un dios tuviera canción. ¿Sigues ahí? No hace falta que contestes: sigo oyéndote el pulso. Los oídos que no temblan suelen ser los primeros en huir... y yo he tenido trescientos años para contarlos todos.',
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

// ============================================================
// ═══════ BLOQUE 14-a (agente jefes-enemigos) — AÑADIDO ═══════
// Petición explícita del usuario: "más jefes más complicados, más
// patrones, más vida y daño" + "más enemigos".
// Contenido de este bloque (APPEND puro: nada de arriba se edita):
//   1) ENEMY_DEFS_14A — 2 jefes nuevos (vult, coro) + 2 enemigos de
//      mapa (ecodesg, satiro). types.ts está CONGELADO (EnemyType es
//      una unión cerrada), así que la extensión de la tabla se hace
//      en CARGA vía Object.assign: makeEnemy/damageEnemy/killEnemy y
//      la barra de jefe del render leen ENEMY_DEFS[type] por índice y
//      funcionan sin cambios. Los cerebros viven en
//      enemies_expansion.ts (14-a); el set de tipos del Acto II en
//      update.ts se amplía con los 4 ids.
//   2) BUFF de los 3 jefes de campaña: +15-20% hp, +1-2 dmg y quiebre
//      +15%. Se aplica POR ASIGNACIÓN en carga (los literales
//      originales quedan intactos en el fuente; el valor final vive
//      aquí para que la tabla antes/después del smoke sea auditable).
//      NOTA: la Sirena/Gólem del MODO DESAFÍO comparten defs (makeEnemy
//      lee ENEMY_DEFS): los duelos de arena también suben — mismo
//      espíritu del pedido del usuario.
//   3) El hp de TODOS los spawns nuevos pasa por makeEnemy → ya recibe
//      el multiplicador del balanceador (12-c): los cerebros de
//      enemies_expansion NO vuelven a multiplicar (cero doble escala).
// ============================================================

/** Defs de la expansión 14-a (mismo formato que ENEMY_DEFS). */
export const ENEMY_DEFS_14A: Record<string, EnemyDef> = {
  // ── JEFE opcional · activación en enemies_expansion.expansionBossWatchers:
  // Cumbres de NOCHE con contenido posterior a q11 (q12 aceptada o Acto III).
  vult: {
    name: 'Vult, el Cazador de Ecos', hp: 420, dmg: 14, speed: 88, xp: 260, gold: [140, 180],
    sprite: 'vult', aggroR: 150, atkR: 46, windup: 0.5, atkCd: 1.7,
    element: 'sombra', weakTo: 'sagrado', breakBar: 95,
    desc: 'El cartógrafo que la Niebla contrató con el mapa de tus pasos. Ráfagas de dagas, embestidas con estela y, al filo de la muerte, el modo acecho: se desvanece y reaparece a tu espalda. Débil a la luz.',
  },
  // ── JEFE post-Acto III · activación: Cripta con acto3Done (la sala del
  // altar queda libre tras caer el Guardián de campaña y el recordado).
  coro: {
    name: 'El Coro Roto', hp: 520, dmg: 13, speed: 34, xp: 320, gold: [160, 220],
    sprite: 'coro1', aggroR: 140, atkR: 150, windup: 0.6, atkCd: 2.1,
    element: 'sombra', weakTo: 'sagrado', breakBar: 110,
    desc: 'Tres máscaras que la Niebla unió con la nota del revés de Velmora. Quebrar la barra hace caer la máscara actual: el Pulso y sus orbes, el Vera y sus rayos en cruz, el Silencio y su lluvia de notas caídas. Débil a la luz.',
  },
  // ── Enemigos nuevos de mapa (14-a) ──
  ecodesg: {
    name: 'Eco Desgarrado', hp: 55, dmg: 11, speed: 84, xp: 30, gold: [8, 14],
    sprite: 'ecodesg', aggroR: 130, atkR: 26, windup: 0.45, atkCd: 1.5,
    element: 'sombra', weakTo: 'sagrado',
    desc: 'Un eco partido en dos que aún intenta cantarse a sí mismo. Rápido: parpadea distancias cortas hasta tu flanco y arremete. Vigila el destello de su bruma. Débil a la luz.',
  },
  satiro: {
    name: 'Sátiro de la Niebla', hp: 44, dmg: 9, speed: 62, xp: 26, gold: [8, 14],
    sprite: 'satiro', aggroR: 150, atkR: 160, windup: 0.8, atkCd: 2.2,
    element: 'ninguno', weakTo: 'fuego',
    desc: 'Músico cabrío que silba baladas curvas: su proyectil describe una parábola que cae sobre quien se esconde. Si te acercas, huye silbando mientras dispara. La quema disipa su niebla.',
  },
};
// Inyección en carga (ver cabecera del bloque): extiende ENEMY_DEFS sin
// tocar types.ts. El orden de módulos garantiza que esto corre antes de que
// engine/update/render lean la tabla.
Object.assign(ENEMY_DEFS, ENEMY_DEFS_14A);

/** BUFF 14-a de los 3 jefes de campaña (antes → después, auditable):
 *  guardian 300/13/quiebre 70 → 345/14/80  (+15% hp, +1 dmg, +14% quiebre)
 *  sirena   380/13/quiebre 90 → 440/15/105 (+15.8%, +2, +16.7%)
 *  golem    460/17/quiebre 110 → 535/19/126 (+16.3%, +2, +14.5%) */
const BUFF_JEFES_14A = {
  guardian: { hp: 345, dmg: 14, breakBar: 80 },
  sirena: { hp: 440, dmg: 15, breakBar: 105 },
  golem: { hp: 535, dmg: 19, breakBar: 126 },
} as const;
for (const k of Object.keys(BUFF_JEFES_14A) as (keyof typeof BUFF_JEFES_14A)[]) {
  const b = BUFF_JEFES_14A[k];
  ENEMY_DEFS[k].hp = b.hp;
  ENEMY_DEFS[k].dmg = b.dmg;
  ENEMY_DEFS[k].breakBar = b.breakBar;
}
void ENEMY_DEFS_14A; // (la referencia viva es ENEMY_DEFS; se mantiene exportada para el smoke)

// ============================================================
// ═══════ 16-a (agente historia-acto4) — BLOQUE AÑADIDO ═══════
// ACTO IV · "El Último Canto" (q14-q16): cierre de la historia.
// Todo lo anterior queda INTACTO. Este bloque SOLO AÑADE:
//   1) misiones q14-q16 al final del array QUESTS (push; sin tocar
//      entradas previas),
//   2) objetivos de la Brújula para los índices 13-15,
//   3) KEY_ITEMS + MEMORIES (memoria final VII 'mem_ultimacanto'),
//   4) ~20 nodos de diálogo (Object.assign sobre DIALOGUES: los nodos
//      previos quedan byte a byte),
//   5) los textos finales del epílogo (ACTO4_FIN_*) que hooks.ts
//      compone dinámicamente según jefes opcionales derrotados,
//   6) la referencia viva ACTO4_BOSS al jefe final (patrón ACTO3_ELITE),
//   7) ENEMY_DEFS_16A — el jefe final 'heraldo' (makeEnemy lee
//      ENEMY_DEFS[etype]; sprite existente 'inquisidor', sin sprites
//      nuevos; quiebre estilo Coro Roto vía breakBar),
//   8) el ENVOLTORIO de getDialogue (capa 16-a sobre la capa 13-a):
//      captura la función vigente (getDialogueActo3) y reasigna el
//      binding exportado — toda ruta que no sea del Acto IV delega
//      tal cual en la capa anterior (regresión 0).
// Idempotencia: los handlers viven en hooks.ts (bloque 16-a) con el
// watcher acto4CatchUp; aquí solo vive contenido + ruteo.
// ============================================================

// ---------------- Misiones del Acto IV (append al final del array) ----------------

QUESTS.push(
  {
    id: 'q14', name: 'Las Campanas de Antes',
    steps: [
      'Escucha a Toln en la forja de Lunaris: el metal que recuerda quiere ser campana',
      'Reúne el coro de antes: la voz de Merrow y la resonancia de las Cumbres (0/2)',
      'Vuelve con la Anciana Brisa: la Campana del Ayer puede sonar',
    ],
  },
  {
    id: 'q15', name: 'La Sala del Primer Canto',
    steps: [
      'Desciende a la Cripta: la Guarda del Primer Canto custodia la puerta de la Sala',
      'Abre la Sala del Primer Canto y derrota a El Heraldo — Vesh, la Última Nota',
      'Vuelve con la Anciana Brisa',
    ],
  },
  {
    id: 'q16', name: 'El Eco que Elegiste',
    steps: [
      'Vuelve con la Anciana Brisa: el coro de antes te espera para el Último Canto',
      'Canta el Último Canto: quédate a escuchar... o deja que el mundo descanse',
    ],
  },
);

// ---------------- Brújula de Ecos (12-b): objetivos de las misiones nuevas ----------------

QUEST_COMPASS[13] = [{ npc: 'toln' }, { npc: 'mera' }, { npc: 'brisa' }];
// 'heraldo' es un jefe instanciado por hooks (acto4_subir), no un spawn de mapa:
// el objetivo lleva map:'cripta' para que la Brújula señale la salida correcta.
QUEST_COMPASS[14] = [{ npc: 'guarda' }, { etype: 'heraldo', map: 'cripta' }, { npc: 'brisa' }];
QUEST_COMPASS[15] = [{ npc: 'brisa' }];

// ---------------- Objeto clave de la campana (sabor; sin gate de motor) ----------------

Object.assign(KEY_ITEMS, {
  campanaAyer: {
    name: 'La Campana del Ayer',
    desc: 'La campana que Toln crió con el metal que recuerda. Reparte las horas, llama al coro de antes y da nombre al valle.',
  },
} satisfies Record<string, { name: string; desc: string }>);

// ---------------- Memoria final VII (se otorga en acto4_epilogo, cierre de q16) ----------------

Object.assign(MEMORIES, {
  mem_ultimacanto: {
    id: 'mem_ultimacanto',
    title: 'Memoria VII · El Último Canto',
    text: 'La mujer sin rostro por fin tiene cara: es la tuya, la que cierra los ojos y no busca a nadie detrás. «El Canto nunca fue mío —dices, y el valle entero te escucha nombrarte—: fue de todos los que lo cantaron. Yo solo devolví lo que me tocó devolver.» Por una noche entera el mundo no necesita ayeres prestados: la Campana del Ayer reparte horas, el mar lee nombres sin borrarlos, y la Niebla —que tanto aprendió— aprende por fin a descansar. Silencio, sí. Pero de los buenos: el que queda cuando la canción ya está dentro.',
  } satisfies MemoryDef,
});

// ---------------- Nodos de diálogo del Acto IV ----------------

const D_ACTO4: Record<string, DialogueNode> = {
  // ----- q14 · Las Campanas de Antes -----
  acto4_brisa_alba: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '¿Lo oyes, Portador? Desde que enderezaste los tres ecos, el silencio tiene miedo de nosotros: no sabe qué hacemos con las manos mientras no canta. Pero la Niebla aprende rápido, y su maestro tiene cara de hombre... (seca una taza en el umbral) Anoche Toln vino con una idea imposible: el metal de su forja —el que recuerda el ritmo del martillo de su bisabuela— quiere ser CAMPANA. Las campanas de antes no se fundían solas, Portador: se criaban con el coro alrededor. Dale a Toln su campana, trae de vuelta a Merrow la voz que la Sirena cantaba robada y despierta la resonancia de los pastores en las Cumbres. Cuando el coro de antes vuelva a sonar, hasta la Niebla tendrá que aprender una canción nueva. La tuya.',
    onEnd: 'accept_q14',
    options: [
      { text: 'El coro de antes volverá, Brisa. Te lo devuelvo nota por nota.', tone: 'empatico' },
      { text: 'Forja, voz, resonancia. Tres campanas para un coro. Voy.', tone: 'pragmatico' },
      { text: 'Una campana que recuerda y una Niebla que estudia. El barrio va mejorando.', tone: 'sarcastico' },
    ],
  },
  acto4_brisa_ruta: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Las campanas no se funden solas, Portador: Toln espera en la forja con el metal que recuerda, y el coro se reúne donde dejaste voces —Merrow, al este de la costa; las Cumbres, al este del bosque—. La Brújula de Ecos (tecla 6) sabe el camino si el valle se hace largo.',
  },
  acto4_toln_cam: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Ah, viniste. Bien: quería que lo tocases tú. (pone tu mano sobre el yunque) ¿Sientes? Lleva trescientos años esperando. Mi bisabuelo fundió las campanas de Lunaris con este metal —los niños lo llaman el eco del pozo— y dicen que guarda el ritmo del martillo de su abuela. Anoche, cuando el coro del valle cantó tus tres notas, el metal LLORÓ en la fragua. Una campana no se hace, Portador: se cría. Yo le doy el cuerpo; a ti te toca traerle lo que la Niebla le robó: la voz que la llame —la que la Sirena cantaba robada, en Merrow— y la resonancia que la sostenga —donde los pastores cantaban por turnos, en las Cumbres—. Tráeme ambas, y esta campana recordará al mundo entero cómo se llama.',
    onEnd: 'acto4_toln',
    options: [
      { text: 'Tu bisabuelo fundió las campanas, Toln. Tu forja las va a devolver.', tone: 'empatico' },
      { text: 'Merrow y Cumbres. Dos viajes y una campana criada. Voy.', tone: 'pragmatico' },
      { text: 'Un yunque que llora y una Niebla que estudia. Necesito vacaciones.', tone: 'sarcastico' },
      { text: 'Necesito acero y pociones, no canciones.', next: 'toln_intro' },
    ],
  },
  // variante por tono dominante (mismo patrón que acto3_toln_intro_sarc)
  acto4_toln_cam_sarc: {
    name: 'Maestro Toln', portrait: 'toln',
    text: 'Vuelves con orejas nuevas, Listillo. Pues toca el yunque y deja de reírte: ese metal lleva trescientos años esperando y anoche LLORÓ en la fragua cuando el valle cantó tus notas. Los niños lo llaman el eco del pozo: guarda el ritmo del martillo de mi bisabuela. Voy a criar con él la campana que Lunaris merece... pero las campanas no se funden solas: necesito la voz que la Sirena cantó robada —Merrow— y la resonancia de los pastores —las Cumbres—. Anda, ve a hacer el coro y deja las gracias para el estreno.',
    onEnd: 'acto4_toln',
    options: [
      { text: 'Merrow y Cumbres. Dos viajes y una campana criada. Voy.', tone: 'pragmatico' },
      { text: 'Necesito acero y pociones, no canciones.', next: 'toln_intro' },
    ],
  },
  acto4_mera_cam: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: '...Portador. Esta mañana el mar dijo un nombre y no era el mío. La que cantaba bajo la quilla ya no canta para la Niebla: su voz quedó suelta, como un farol sin gancho... y una voz suelta siempre busca dueño. Merrow fue su primer dueño, ¿sabes? La Sirena aprendió a cantar escuchando a mis vecinas nombrar a sus hijos al alba. Devuélvela: di TÚ en voz alta que la voz del mar vuelve a casa. (junta las manos, como quien espera una cerilla) Dímelo ahora, si te atreves... y la aldea vuelve a nombrar.',
    onEnd: 'acto4_cam_mera',
    options: [
      { text: 'La voz del mar vuelve a casa, Merrow. Cantad con ella.', tone: 'empatico' },
      { text: 'Una voz suelta, un dueño, una aldea que nombra. Hecho.', tone: 'pragmatico' },
      { text: 'La ex ladrona de voces devolviendo el botín. La Niebla debe estar encantada.', tone: 'sarcastico' },
    ],
  },
  acto4_ivo_cam: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: '¡Ahí, Portador, ahí! ¡Escucha la hoguera! Anoche ardieron las piedras sin leña, te lo juro por la ballesta: las voces bajo el hielo cantaron la última estrofa. La que nadie cantó. Llevan trescientos años esperando un turno nuevo, y la montaña me ha dicho —sí, HABLADO, búscate otra explicación— que el turno nuevo es tuyo. Pon la mano en la nieve y di «os toca cantar a vosotras», que eran tres hermanas y su hermano el pequeño, y el pequeño es el que no llegaba al final... ¡Ja! La montaña vuelve a tener oído, Portador. Llévate su resonancia a tu campana: el frío ya no guarda voces... las PRESTA.',
    onEnd: 'acto4_cam_ivo',
    options: [
      { text: 'Os toca cantar a vosotras, pastores. Y al pequeño, el final.', tone: 'empatico' },
      { text: 'Resonancia prestada, devolución garantizada. Gracias, montaña.', tone: 'pragmatico' },
      { text: 'Una montaña que habla y tú sin abrigo. Aún hacéis buena pareja.', tone: 'sarcastico' },
    ],
  },
  acto4_brisa_cierre1: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Tres campanas... no, Portador: una campana y un coro entero. Escucha. (Lunaris tañe la hora; el sonido baja al mar, cruza la laguna y vuelve puesto de acuerdo con las cumbres) La Campana del Ayer suena, y lo que suena no puede comérselo la Niebla sin masticar. Pero el que enseñó a la Niebla... el de la cara de hombre... ha bajado a la Cripta. La Guarda del Primer Canto lleva tres noches en pie ante la Sala, esperándote. Ve. Y Portador: lo que hay ahí dentro no es un monstruo. Es un hombre al que enseñaron a tener miedo de la música.',
    onEnd: 'acto4_report',
    options: [
      { text: 'Iré. Nadie muere dos veces por cantar, y él lleva una esperando.', next: 'acto4_brisa_sala', tone: 'empatico' },
      { text: 'La Sala, la Nota, la Guarda. Voy.', next: 'acto4_brisa_sala', tone: 'pragmatico' },
      { text: 'Un hombre con miedo a la música, en una cripta. Perfecto para cerrar un acto.', tone: 'sarcastico' },
      { text: 'Necesito preparar el acero antes de bajar.', tone: 'pragmatico' },
    ],
  },
  // ----- q15 · La Sala del Primer Canto -----
  acto4_brisa_sala: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'La Sala del Primer Canto es la habitación donde tu dios aprendió a cantar, Portador: la primera nota, la que costó el ayer de Velmora. Desde la Noche del Silencio está sellada, y su llave no es de acero: es de coro. Ahora que la Campana del Ayer llama, la puerta puede abrirse... pero alguien tiene que sostenerla mientras tú entras. La Guarda del Primer Canto —el tercer capellán que cantaba las horas, el que no calló— te espera dentro de la Cripta. Dile que Brisa aún canta. Ella sabrá qué significa.',
    onEnd: 'accept_q15',
    options: [
      { text: 'Brisa aún canta. Y yo canto con ella. Voy.', tone: 'empatico' },
      { text: 'Cripta, Guarda, Sala. Entendido. Que suene el final.', tone: 'pragmatico' },
      { text: 'Una cripta que es cerradura y yo de llave cantora. De acuerdo.', tone: 'sarcastico' },
    ],
  },
  acto4_brisa_ruta2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'La Cripta te espera, Portador: la Guarda del Primer Canto no abandona la puerta ni para dormir, y lleva tres noches escuchando tu campana. Dile que Brisa aún canta... y que esta vieja ya no da más de sí, pero se queda escuchando hasta que vuelvas.',
  },
  acto4_brisa_sala_espera: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'La Sala está abierta y su Nota vibra, Portador: no la dejes esperando. Si saliste de la Cripta sin rematar, la Guarda sostiene la puerta: pídele volver a entrar. Y guarda una poción para el final... las últimas notas siempre piden más aire.',
  },
  acto4_guarda_intro: {
    name: 'La Guarda del Primer Canto', portrait: 'kael',
    text: '...Dijiste la palabra de Brisa. Entonces puedo bajar la lanza: trescientos años en pie y ninguna orden para apartarla. Escucha, Portador: yo era el tercer capellán de la muralla de Lunaris —el que cantaba las horas—. Cuando el Canto murió, mis compañeros callaron y yo seguí... hasta que seguí dentro de la piedra: las piedras cantan por mí cuando llueve, y la Orden me dio este puesto para que nadie olvide el camino. Esta puerta guarda la Sala del Primer Canto: aquí aprendió a cantar tu dios, y aquí dejó Vesh, el Gran Inquisidor, su Última Nota... por si el mundo volvía a necesitar una lanza. Ahora se hace llamar El Heraldo, y la Niebla le presta la voz. ¿Abro?',
    onEnd: 'acto4_guarda',
    options: [
      { text: '(Abre, Guarda. Por Brisa, por Velmora y por los que callaron.)', action: 'acto4_subir', tone: 'empatico' },
      { text: '¿Por qué la Orden guardó la nota que quiso matar?', next: 'acto4_guarda_heraldo' },
      { text: 'Prepararme antes. Nadie entra a una Sala sin filo.', tone: 'pragmatico' },
    ],
  },
  acto4_guarda_heraldo: {
    name: 'La Guarda del Primer Canto', portrait: 'kael',
    text: 'Porque Vesh no era cruel: era un hombre que VIO qué pasaba cuando el Canto tenía hambre. Vio pueblos sin ayeres, con la marea llena de nombres... y cuando la Orden bajó a matar al dios, él quiso guardar una última nota por si el mundo, algún día, la necesitaba de nuevo. Es una obediencia vieja, Portador, y las obediencias viejas no saben retirarse: ahora la Niebla le canta que la nota es SUYA, y él obedece. No lo odies. Rompe su barra... y escucha lo que canta debajo.',
    next: 'acto4_guarda_puerta',
  },
  acto4_guarda_puerta: {
    name: 'La Guarda del Primer Canto', portrait: 'kael',
    text: 'La Sala no perdona la prisa, y la Nota no perdona la piedad: come ayeres, y el tuyo también sabe a algo. Yo sostengo la puerta y la Campana del Ayer sostiene el coro; tú solo tienes que llegar hasta el final y querer más que él. Di la palabra.',
    options: [
      { text: '(Abrir la Sala: fuera del tiempo)', action: 'acto4_subir' },
      { text: 'Prepararme antes. Un filo honesto vale más que un verso.', tone: 'pragmatico' },
    ],
  },
  acto4_guarda_espera: {
    name: 'La Guarda del Primer Canto', portrait: 'kael',
    text: 'La Sala está abierta y la Nota vibra, Portador: no le dejes más silencio del debido. Si saliste sin terminar, vuelve a entrar: la puerta no se cierra mientras yo esté en pie... y en pie llevo trescientos años.',
    options: [
      { text: '(Volver a entrar en la Sala)', action: 'acto4_subir' },
      { text: 'Un momento. Hasta un coro necesita respirar.', tone: 'empatico' },
    ],
  },
  acto4_guarda_gratitud: {
    name: 'La Guarda del Primer Canto', portrait: 'kael',
    text: '...(la Guarda deja la lanza en el suelo, y suena como suena una campana chica) Trescientos años, Portador, y has tardado una sola vida. La Nota ya no llama a la Niebla: ahora es solo una canción triste... y las canciones tristes también curan, si alguien las canta entera. La Brisa te espera en el valle: el Último Canto no se canta solo. Yo me quedo. Alguien tiene que cantar las horas cuando llueva.',
    onEnd: 'acto4_report', // idempotente: finaliza el pago/paso del informe (acto4CatchUp) al hablar con ella
    options: [
      { text: 'Que llueva mucho, Guarda. Cantaré contigo la próxima vez.', tone: 'empatico' },
      { text: 'Trescientos años en pie y de pie te quedas. Nota tomada.', tone: 'pragmatico' },
    ],
  },
  acto4_guarda_silencio: {
    name: 'La Guarda del Primer Canto', portrait: 'kael',
    text: '...(la Guarda no gira la cabeza; la lanza sigue alta) Aún no, Portador. La Sala solo se abre a un coro entero: cuando el valle tenga su campana, vuelve. Trescientos años esperando no me han hecho prisa.',
  },
  acto4_heraldo_aviso: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: '...Ya lo sabes, ¿verdad? Se te nota en la manera de mirar los campanarios. Sí: bajé a la Sala. Mi Gran Inquisidor dejó una orden escrita antes de morir: «si alguien reúne el Canto, baja y sé su última nota». Yo creí que era un honor. Es un CASTIGO, recipiente: la última nota se queda vibrando para siempre, sin poder bajar del aire, oyendo apagarse el resto del canto nota a nota... hasta sonar sola, para nadie. (se ajusta la capucha) Nos vemos en la Sala. Y reza por que tu melodía sea más terca que mi obediencia.',
    options: [
      { text: 'No eres tu obediencia, Heraldo. Baja, escucha y descansa.', tone: 'empatico' },
      { text: 'La última nota de un canto también es la más alta. Nos vemos.', tone: 'pragmatico' },
      { text: 'Si tanto amas vibrar, te dejo afinado en dos notas. Las mías.', tone: 'amenazante', action: 'rep_orden_-5' },
    ],
  },
  acto4_brisa_cierre2: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '...(Brisa no habla: escucha. Muy lejos —si la Ciudadela sigue existiendo— algo deja de llamar.) Así que el Heraldo era solo un hombre con una obediencia vieja... y la Nota ya es solo una canción triste. Descansa esta noche, Portador: el coro entero tañe, y hasta la Niebla aprende canciones nuevas. Las tuyas. Queda una sola cosa, y no es una misión: es un ECO. El que elegiste, el que has ido siendo mientras devolvías nombres, ayeres y horas. Ven cuando quieras: el Último Canto se canta con la letra que tú escribiste.',
    onEnd: 'acto4_report',
    options: [
      { text: '(Respirar. Luego, el Último Canto.)', tone: 'empatico' },
      { text: '(Dar una vuelta más a la plaza. Sin motivo.)', tone: 'sarcastico' },
    ],
  },
  // ----- q16 · El Eco que Elegiste (epílogo ramificado) -----
  // Tres nodos de ENTRADA según reputación (Orden vs Guardianes; ruteo en el
  // envoltorio getDialogueActo4 leyendo el espejo flags.acto4RepOrden/Guard
  // que escribe hooks.acto4CatchUp). Los tres comparten el FINAL dinámico
  // 'acto4_epilogo_canto' (texto compuesto en hooks según jefes derrotados).
  acto4_epilogo_verdad: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'La verdad, entonces. (Brisa no sonríe: descansa) Contaste lo que Velmora te confió y la Orden dejó de ser un puño cerrado: por primera vez en trescientos años, los de la Ciudadela lloran a sus muertos en voz alta, y las lanzas descansan porque una verdad pesa menos que un secreto. Hay quien te lo reprocha, Portador: hay quien quería a los Guardianes con la causa intacta. Pero el Eco que elegiste es este: una verdad con el suelo mojado de lágrimas viejas. El Último Canto se canta con ella... o no se canta.',
    onEnd: 'acto4_epilogo',
    options: [
      { text: '(Cantar con la verdad puesta: es mi letra y la sostengo.)', action: 'accept_q16', next: 'acto4_epilogo_canto', tone: 'empatico' },
      { text: '(Cantar. Llorar encima si hace falta; la nota manda.)', action: 'accept_q16', next: 'acto4_epilogo_canto', tone: 'pragmatico' },
      { text: '(Cantar una versión donde salgo mejor parado. Obviamente.)', action: 'accept_q16', next: 'acto4_epilogo_canto', tone: 'sarcastico' },
      { text: 'Todavía no. Déjame respirar antes del Último Canto.', tone: 'pragmatico' },
    ],
  },
  acto4_epilogo_silencio: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El silencio, entonces. (Brisa sí sonríe, y es como ver llover sobre el río) Guardaste el secreto de la Orden y los Guardianes conservaron su causa: trescientos años cantando a un dios que mataba por cantar, y nada de eso se derrumbó. Hay quien dirá que mentiste al mundo con tu callar. Yo digo que elegiste a quién darle el peso: hay verdades que solo sostienen los que ya las cargan. El Eco que elegiste es este: un silencio que suena, como el de una casa vacía donde aún se guarda la taza llena. El Último Canto se canta con él... o no se canta.',
    onEnd: 'acto4_epilogo',
    options: [
      { text: '(Cantar con el silencio bien guardado: mi letra es un refugio.)', action: 'accept_q16', next: 'acto4_epilogo_canto', tone: 'empatico' },
      { text: '(Cantar. Lo que se conserva también se comparte.)', action: 'accept_q16', next: 'acto4_epilogo_canto', tone: 'pragmatico' },
      { text: 'Todavía no. Déjame respirar antes del Último Canto.', tone: 'pragmatico' },
    ],
  },
  acto4_epilogo: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Hazlo como quieras, Portador: callado o a gritos, el Canto ya es tuyo. (Brisa te mira como se mira el primer día y el último) Tres ecos devueltos, tres campanas criadas, una Sala abierta y una Nota aquietada. Lo que fuiste haciendo mientras caminabas... eso es el Último Canto. Solo falta ponerle letra. ¿La tuya?',
    onEnd: 'acto4_epilogo',
    options: [
      { text: '(Cantar. Con todo lo que tengo y lo que me dieron.)', action: 'accept_q16', next: 'acto4_epilogo_canto', tone: 'empatico' },
      { text: 'Todavía no. Déjame respirar antes del Último Canto.', tone: 'pragmatico' },
    ],
  },
  // FINAL del epílogo: versión estática de respaldo (el texto vivo lo instala
  // hooks.acto4_epilogo en g.dynNodes['acto4_epilogo_canto'] con variantes
  // según jefes opcionales derrotados; tras recargar partida, esta base cubre).
  acto4_epilogo_canto: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '...(Brisa alza la voz, y no canta sola: la Campana del Ayer reparte la primera hora, el pozo de los nombres devuelve un coro que nadie recordaba haber prestado, y hasta la Niebla —que tantas letras robó— se queda a escuchar, quieta, como un perro viejo al que por fin le cantan lo suyo.) Escucha, Portador, y no lo olvides: el Canto de Aelthar no volvió porque un héroe lo buscara. Volvió porque alguien, paso a paso, fue devolviendo lo que le iban dando: una nana, una casa, un faro, un invierno, un canto al revés. Ese es el Eco que elegiste. Ese eres tú. Que suene.',
    options: [
      { text: '(Subir el telón del Último Canto: terminar el viaje)', action: 'end_demo' },
      { text: '(Quedarse: el mundo aún tiene mañanas que nombrar)', tone: 'empatico' },
    ],
  },
  acto4_epilogo_stay: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'El coro se queda, Portador: Toln le puso badajo al Ayer, la Espectro dicta nombres en la plaza de Merrow, Ivo apuesta a que la montaña desafina en los graves y el mar le lleva la contraparte. Yo tengo una taza llena y trescientas historias nuevas. Cuando quieras terminar el viaje, cierra los ojos y termina: el resto del coro canta donde tú cantes.',
    options: [
      { text: '(Subir el telón del Último Canto: terminar el viaje)', action: 'end_demo' },
      { text: '(Quedarse un rato más junto a la taza llena)', tone: 'empatico' },
    ],
  },
};
// Los nodos previos quedan intactos: este assign SOLO añade claves nuevos.
Object.assign(DIALOGUES, D_ACTO4);

// ---------------- Textos finales del epílogo (los compone hooks.acto4_epilogo) ----------------
/**
 * 16-a: hooks.acto4_epilogo instala en g.dynNodes['acto4_epilogo_canto'] la
 * versión viva del cierre = ACTO4_FIN_BASE + los párrafos de los jefes
 * opcionales derrotados (El Coro Roto / Vult). El nodo estático de arriba es
 * la base de respaldo (saves recargados a mitad del epílogo).
 */
export const ACTO4_FIN_BASE =
  '...(Brisa alza la voz, y no canta sola: la Campana del Ayer reparte la primera hora, el pozo de los nombres devuelve un coro que nadie recordaba haber prestado, y hasta la Niebla —que tantas letras robó— se queda a escuchar, quieta, como un perro viejo al que por fin le cantan lo suyo.) Escucha, Portador, y no lo olvides: el Canto de Aelthar no volvió porque un héroe lo buscara. Volvió porque alguien, paso a paso, fue devolviendo lo que le iban dando: una nana, una casa, un faro, un invierno, un canto al revés. Ese es el Eco que elegiste. Ese eres tú. Que suene.';
export const ACTO4_FIN_JEFES: Record<string, string> = {
  coro: '(A lo lejos, algo tañe en tres voces distintas: las tres máscaras del Coro Roto, ahora tres campanas gemelas, aprendiendo por fin a sonar juntas sin nadie que las una a la fuerza.)',
  vult: '(En la colina, un mapa se dobla solo: Vult, el Cazador de Ecos, despide los pasos que robó y saluda con el sombrero de cartógrafo. La Liga facturará la escena.)',
};

// ---------------- Referencia viva al jefe final de q15 (patrón ACTO3_ELITE) ----------------
/**
 * 16-a: hooks.acto4_subir instancia el JEFE FINAL (makeEnemy 'heraldo' — la
 * Sala del Primer Canto) y guarda AQUÍ la referencia; killEnemy del motor no
 * tiene rama para un etype nuevo, así que hooks.acto4CatchUp detecta su
 * `.dead` (y el envoltorio de getDialogue también lo lee para rutar el informe
 * de q15 sin esperar a la flag). Se vive en data.ts y no en hooks.ts porque el
 * envoltorio de getDialogue vive aquí (data→hooks sería un ciclo de valor).
 */
export const ACTO4_BOSS: { ref: { dead?: boolean } | null } = { ref: null };

// ---------------- Enemigo del Acto IV: el jefe final ----------------

/** Defs del Acto IV (mismo formato que ENEMY_DEFS/ENEMY_DEFS_14A).
 *  'heraldo' reutiliza el sprite EXISTENTE 'inquisidor' (Gran Inquisidor Vesh,
 *  32×36 con máscara) — cero sprites nuevos, como pide la ronda. makeEnemy lee
 *  ENEMY_DEFS[etype] por índice y el render dibuja la barra de jefe + QUIEBRE
 *  (breakBar) con los mecanismos ya existentes. */
export const ENEMY_DEFS_16A: Record<string, EnemyDef> = {
  heraldo: {
    name: 'El Heraldo · Vesh, la Última Nota', hp: 640, dmg: 20, speed: 46, xp: 420, gold: [220, 280],
    sprite: 'inquisidor', aggroR: 175, atkR: 42, windup: 0.5, atkCd: 1.6,
    element: 'sombra', weakTo: 'sagrado', breakBar: 130,
    desc: 'El último hombre de la Orden de Vesh: entró a la Sala del Primer Canto a ser una nota por obediencia y la Niebla le prestó su voz. Golpea como un silencio que cae; quebra su barra y oirás lo que canta debajo. Débil a la luz.',
  },
};
Object.assign(ENEMY_DEFS, ENEMY_DEFS_16A);

// ---------------- Envoltorio de getDialogue (ruteo del Acto IV) ----------------
/**
 * Segunda capa del envoltorio (13-a → 16-a): captura la función VIGENTE
 * (getDialogueActo3) y reasigna el binding exportado. Toda ruta que no sea
 * del Acto IV (questIdx 13-15) delega tal cual en la capa del Acto III, que a
 * su vez delega en la original del Acto I/II — regresión 0 por diseño.
 */
const GET_DIALOGUE_ACTO3 = getDialogue;

function getDialogueActo4(nid: string, ctx: DialogueCtx): string {
  const q = ctx.questIdx, s = ctx.questStep, f = ctx.flags;
  const heraldoMuerto = !!f.heraldoDerrotado || ACTO4_BOSS.ref?.dead === true;
  // transición q12 → q13: Brisa arranca el Acto IV tras el cierre del Acto III
  // (la capa 13-a devuelve el idle del Acto I/II con acto3Done; sin esta ruta
  // el briefing de q14 sería inalcanzable — mismo patrón que la transición
  // q10→q11 de la capa anterior).
  if (nid === 'brisa' && q === 12 && f.acto3Done && !f.q14) return 'acto4_brisa_alba';
  // La Guarda existe desde acto3Done (showFlag de la NPC), incluso antes de
  // aceptar q14: se ruye ANTES del guard de rango (en q<=12 la capa 13-a
  // devolvería 'brisa_idle' con el nombre de la Guarda).
  if (nid === 'guarda') {
    if (q === 14) {
      if (s === 0 && !f.acto4Guarda) return 'acto4_guarda_intro';
      if (heraldoMuerto) return 'acto4_guarda_gratitud';
      return f.acto4SalaAbierta ? 'acto4_guarda_espera' : 'acto4_guarda_puerta';
    }
    return heraldoMuerto ? 'acto4_guarda_gratitud' : 'acto4_guarda_silencio';
  }
  if (q < 13 || q > 15) return GET_DIALOGUE_ACTO3(nid, ctx);
  switch (nid) {
    case 'brisa': {
      if (q === 13) return s === 2 ? 'acto4_brisa_cierre1' : 'acto4_brisa_ruta';
      if (q === 14) {
        if (s === 2) return 'acto4_brisa_cierre2';
        if (heraldoMuerto) return 'acto4_brisa_cierre2'; // jefe caído: informe inmediato (anti-bloqueo)
        return s === 0 ? 'acto4_brisa_ruta2' : 'acto4_brisa_sala_espera';
      }
      // q16 (índice 15): el epílogo, ramificado por reputación (espejo de
      // hooks.acto4CatchUp: DialogueCtx no lleva repFacciones)
      if (f.acto4Done) return 'acto4_epilogo_stay';
      const rO = typeof f.acto4RepOrden === 'number' ? (f.acto4RepOrden as number) : 0;
      const rG = typeof f.acto4RepGuard === 'number' ? (f.acto4RepGuard as number) : 0;
      if (f.acto3RepDecision) return rO > rG ? 'acto4_epilogo_verdad' : 'acto4_epilogo_silencio';
      return 'acto4_epilogo';
    }
    case 'toln':
      if (q === 13 && s === 0 && !f.camToln) {
        return toneOf(ctx.flags) === 'sarcastico' ? 'acto4_toln_cam_sarc' : 'acto4_toln_cam';
      }
      return GET_DIALOGUE_ACTO3(nid, ctx);
    case 'mera':
      if (q === 13 && s === 1 && !f.camMera && f.sirenaDefeated) return 'acto4_mera_cam';
      return GET_DIALOGUE_ACTO3(nid, ctx);
    case 'ivo':
      if (q === 13 && s === 1 && !f.camCumbres && f.golemDefeated) return 'acto4_ivo_cam';
      return GET_DIALOGUE_ACTO3(nid, ctx);
    case 'heraldo': // el NPC de Lunaris avisa una última vez durante el Acto IV
      if (!heraldoMuerto) return 'acto4_heraldo_aviso';
      return GET_DIALOGUE_ACTO3(nid, ctx);
    default:
      return GET_DIALOGUE_ACTO3(nid, ctx);
  }
}
// @ts-expect-error 16-a: reasignación deliberada del binding de función (capa
// del Acto IV sobre la capa del Acto III). El binding exportado es vivo:
// engine.talkTo resuelve SIEMPRE por aquí, y toda ruta no-Acto-IV delega en
// la función vigente intacta.
getDialogue = getDialogueActo4;

// ═══════ FIN DEL BLOQUE 16-a ═══════

// ============================================================
// ==== 16-b ==== (interacción-compañeros): SEÑUELO DE CAZA
// Objeto apilable 'sennuelo'. Cantidad viva en g.flags.sennuelos (se serializa
// sola en save(), tolerante con partidas antiguas). Compra en la forja de
// Toln (opción nueva de TOLN_MAIN → acción 'buy_sennuelo' en engine.ts) o
// botín raro de jefes (8%, engine.killEnemy → interaccion.bossSennoLoot16b).
// Uso: tecla 8 (5/6/7 son de las herramientas del árbol, 12-b). La lógica
// completa (tiro, atracción de aggro, timers e.lured, pool de 1) vive en
// interaccion.ts; aquí solo el dato de precio/nombre.
// ============================================================
export const SENNUEL = {
  key: 'sennuelo',
  name: 'Señuelo de caza',
  price: 60, // coronas en la forja de Toln
  desc: 'Atrae a los enemigos no-jefe cercanos durante 5 s (tecla 8). Los jefes lo ignoran.',
} as const;

// ============================================================
// ═══════ R7-V5 (agente dialogos-terror) — BLOQUE AÑADIDO ═══════
// CAPA DE EXPANSIÓN de terror para los NPC de los mapas de expansión.
// Todo lo anterior queda INTACTO. Inventario previo (maps_expansion.ts,
// solo lectura): costa → mara, vult · aldea → mera · cumbres → ivo —
// los cuatro ya tenían diálogo, pero los huecos eran: (a) tonos sin
// variante (mara sin pragmático/amenazante, vult sin empático/amenazante,
// mera sin empático/sarcástico tras el Eco, ivo sin pragmático/amenazante);
// (b) la re-visita neutra no carryaba presagio del jefe del mapa;
// (c) los jefes de expansión no tenían voz (los intros viven en update.ts,
// fuera de este archivo).
// Este bloque SOLO AÑADE:
//   1) 12 nodos de diálogo nuevos (APPEND puro vía Object.assign; las
//      claves previas quedan byte a byte). Presagios del mundo ya
//      establecidos: la marea que devuelve cosas que no se echaron
//      (costa), las ventanas que se abren solas al alba (aldea), la
//      ventisca que repite tu nombre (cumbres).
//   2) Las AMENAZAS de los jefes de expansión, contadas por el NPC que
//      custodia su mapa y conectadas con su historia visual:
//      sirena (cadena rota en la muñeca, corona torcida) → Mara ·
//      gólem (cadena helada cruzando el pecho) → Ivo ·
//      coro (tres máscaras cosidas con la nota del revés) → Mera ·
//      vult (autoprofecía del cartógrafo + cierre tras su caída).
//   3) Tercer ENVOLTORIO de getDialogue (patrón 13-a → 16-a): captura la
//      función vigente y SOLO intercepta cuando la capa anterior resuelve
//      el idle NEUTRO del NPC (mara_idle/vult_idle/mera_idle/ivo_idle).
//      Primeras visitas (*_intro), variantes de tono existentes (R6),
//      estados de faroles, rutas del Acto III/IV y relatos tras jefe
//      caído (mara_react/mara_faro, ivo_after) delegan intactos —
//      regresión 0; GET_DIALOGUE_BASE sigue igual para el smoke.
// ============================================================

const D_R7V5: Record<string, DialogueNode> = {
  // ----- Mara · Costa de Bruma (la marea que devuelve cosas que no se echaron) -----
  mara_idle_prag: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'El mar es un libro de cuentas, Portador, y esta costa lleva trescientos años descuadrada: la marea baja deja paso al naufragio hasta que sube la luna; la subida te lo quita. Cuenta los faroles del pueblo al salir: si mañana hay uno más, no fue Mara. Lleva sal. Lo que no se nombra se respeta... y lo que se nombra dos veces, responde.',
  },
  mara_idle_amenaz: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: '...(cubre la lámpara con la mano) Más bajo, Portador. El mar apunta con el dedo a los que llegan rugiendo: primero les devuelve el sombrero, después el bote, después a ellos — del revés y sonriendo. Yo enciendo la luz; tú aprieta la voz. Hasta la bruma de aquí pide permiso. Y encima cobra.',
  },
  mara_presagio_sirena: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: 'Anoche la marea dejó en la arena un remo que nadie echó, seco por el extremo que no toca el agua. Es de ella, Portador: la que canta bajo la quilla lleva la muñeca atada a una cadena rota —la arrastró trescientos años, y la noche que se rompió empezó a cantar lo que oía por dentro—. Corona de coral torcida, perlas de los ahogados. Si la oyes decir tu nombre con voz de quien te espera, no contestes con la letra: rompele el canto antes de que te rompa el oído.',
  },
  // ----- Vult · Costa de Bruma (el cartógrafo que aún no firma) -----
  vult_idle_emp: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: 'Sabe usted de inventarios, Portador, pues apunte este descuadro: la costa devuelve más de lo que recibe. Boyas de barcos que no existen. Un zapato derecho por amanecer. Y junto al naufragio, un muñeco con la cara vuelta hacia el faro, todas las noches, como si esperara que alguien lo llamara a casa. La Liga paga por datos y no por escalofríos: esto va por su cuenta. Alguien allá abajo está devolviendo lo que guardó. Todo. Hasta el cariño.',
  },
  vult_idle_amenaz: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: '...(cierra la libreta despacio) Le diré una cosa a solas, Portador: algunas noches la bruma me ofrece un contrato mejor que el de la Liga. Paga en mapas de pasos ajenos —el suyo, por ejemplo, con todas sus vueltas y todas sus dudas— y yo solo tendría que dejar de dibujar para empezar a cobrar. Todavía no he firmado. Si un día me encuentra usted lejos de esta costa, con otro título y sin libreta... no salude. Y no corra: dice el encargo que le encanta que corran.',
  },
  vult_despues: {
    name: 'Vult, cartógrafo de la Liga', portrait: 'corvin',
    text: '...(la libreta cerrada sobre la mesa; por primera vez, sin tinta en los dedos) Terminó el contrato, Portador. Lo sé porque anoche soñé los pasos que robé y esta mañana los he dibujado TODOS, aunque la Liga solo paga los que van a sitios. El que me compró con un mapa de suyos ya no cobra: dígaselo a la bruma de mi parte, con la letra que quiera. Yo me quedo con la costa. A nadie le enseñaré el camino del naufragio... ese ya se lo sabe la bruma. Y la bruma no compra.',
  },
  // ----- Espectro de Merrow · Aldea (las ventanas que se abren solas) -----
  mera_idle_emp: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: 'Merrow duerme mejor, Portador. Pero no duerme solo: al alba las ventanas se abren solas, todas a la vez, como cuando una madre abre la casa para que entre el nombre de los hijos... y las sombras de dentro saludan antes de que se cierren. Ya no me asustan: son vecinos. Solo te pido una cosa: si una ventana se abre a tu paso, déjala. Cerrarla sería cerrarle la mañana a alguien que lleva trescientos años sin tenerla.',
  },
  mera_idle_sarc: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: '(sonríe sin dientes) Ríete, ríete. En Merrow también reíamos, ¿sabes? Ahora las risas salen por las ventanas de noche y vuelven por la chimenea... y no siempre vuelven en el mismo orden. Este es pueblo de costumbres, Portador: las nuestras y las de la Niebla, que también es vecina y aprende a todo. Ríete bajito. La noche copia lo que oye, y aquí las copias salen torcidas.',
  },
  mera_presagio_coro: {
    name: 'Espectro de Merrow', portrait: 'nimue',
    text: '...(se queda muy quieta, como quien escucha un piso de abajo) ¿Oyes coser, Portador? Aguja y hilo. Aguja y hilo. Debajo de Velmora, en la cripta que respira: la Niebla está uniendo tres máscaras a pulso, cosidas con la nota del revés que la primera Portadora dejó caer. Cuando acaben la costura van a cantar las tres a la vez. Yo cosí pañales toda mi vida y te digo lo que están haciendo ahí: no es un rostro. Es un coro al que no le dejan terminar la palabra.',
  },
  // ----- Ivo · Cumbres Heladas (la ventisca que repite tu nombre) -----
  ivo_idle_prag: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: 'Tres consejos de altura, que no cobro: el fuego antes que la prisa, la ladera antes que la cresta, y mi refugio abierto mientras arda la hoguera. Lo demás ya lo sabe la ventisca: esta mañana repetía tu nombre por el paso, Portador, y no lo decía como yo. Lo probaba. Como quien prueba una llave que no es suya. Cuando la oigas decirlo bien, cambia de ladera — la cresta escucha, y lo que escucha, guarda.',
  },
  ivo_idle_amenaz: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: '...(tensando la cuerda de la ballesta) Di lo que quieras a mí, Portador: yo rugí mucho y aquí sigo, con el pan duro y la casa a medias. Pero a lo que espera ahí arriba no le hables. El Gólem del altar lleva una cadena helada cruzada al pecho: le llegó rodando desde el fondo del mundo, un día tiró de él hacia la cumbre... y obedeció. La montaña no perdona dos veces. Tú serás la primera. O no serás.',
  },
  ivo_presagio_golem: {
    name: 'Ivo, cazador de cumbres', portrait: 'brokk',
    text: 'Escucha antes de subir, que subiendo no se escucha: el Gólem no duerme, cuenta. Trescientos años contando los pasos de todo el que subió y no bajó, y le faltan los tuyos. Cuando lo veas, mira la cadena que le cruza el vientre: cada eslabón es un invierno que la montaña no quiso decir en voz alta, y el último, el que cuelga sin nada, es el que te toca a ti. Pega al quiebre y parte el hielo por la mitad. Y si la ventisca se queda quieta en el aire, no es que pare: es que te está mirando de frente.',
  },
};
// Los nodos previos quedan intactos: este assign SOLO añade claves nuevos.
Object.assign(DIALOGUES, D_R7V5);

// ---------------- Capa de ruteo R7-V5 (envoltorio #3) ----------------
/**
 * Intercepción MÍNIMA: la capa previa (Acto IV → Acto III → Acto I/II) decide
 * SIEMPRE primero. Esta capa solo sustituye el resultado en los huecos neutrales
 * de los 4 NPC de expansión; cualquier otra ruta (intros, tonos R6, faroles,
 * actos, tras-jefe-caído) sale tal cual de la capa anterior.
 */
const GET_DIALOGUE_R7V5 = getDialogue;

function getDialogueR7V5(nid: string, ctx: DialogueCtx): string {
  // Fast path: solo mara/vult/mera/ivo llevan capa; el resto delega tal cual.
  if (nid !== 'mara' && nid !== 'vult' && nid !== 'mera' && nid !== 'ivo') return GET_DIALOGUE_R7V5(nid, ctx);
  const base = GET_DIALOGUE_R7V5(nid, ctx);
  if (base !== 'mara_idle' && base !== 'vult_idle' && base !== 'mera_idle' && base !== 'ivo_idle') return base;
  const q = ctx.questIdx, td = toneOf(ctx.flags);
  if (nid === 'mara') {
    if (q === 6 && !ctx.flags.sirenaDefeated) return 'mara_presagio_sirena'; // caza de la Sirena en curso (q7)
    if (td === 'pragmatico') return 'mara_idle_prag';
    if (td === 'amenazante') return 'mara_idle_amenaz';
  } else if (nid === 'vult') {
    if (ctx.flags.vultDefeated) return 'vult_despues'; // el contrato de la Niebla terminó
    if (td === 'empatico') return 'vult_idle_emp';
    if (td === 'amenazante') return 'vult_idle_amenaz';
  } else if (nid === 'mera') {
    if (q >= 10 && !ctx.flags.coroDefeated && td === null) return 'mera_presagio_coro'; // tras el Canto al Revés, antes de que el Coro termine su costura
    if (td === 'empatico') return 'mera_idle_emp';
    if (td === 'sarcastico') return 'mera_idle_sarc';
  } else { // ivo
    if (q === 8 && !ctx.flags.golemDefeated) return 'ivo_presagio_golem'; // caza del Gólem en curso (q9)
    if (td === 'pragmatico') return 'ivo_idle_prag';
    if (td === 'amenazante') return 'ivo_idle_amenaz';
  }
  return base;
}
// @ts-expect-error R7-V5: reasignación deliberada del binding de función (capa
// R7 sobre la capa del Acto IV). El binding exportado es vivo: engine.talkTo
// resuelve SIEMPRE por aquí, y toda ruta no cubierta delega en la capa vigente
// (GET_DIALOGUE_BASE queda intacta para el smoke de regresión).
getDialogue = getDialogueR7V5;

// ═══════ FIN DEL BLOQUE R7-V5 ═══════

// ============================================================
// ═══════ R10-9 (agente minijefe-data) — BLOQUE AÑADIDO ═══════
// RONDA 10 · soporte de la épica 6.4 — EL SEPULCRO, mini-jefe de la
// ENTRADA de la Cripta del Primer Canto. La cripta rediseñada (R10-1)
// tiene una antesala antes de la sala del Guardián: allí espera este
// caballero sepulcral hundido en su tumba, que se alza cuando el
// Portador cruza el umbral y GATEA el paso a la sala del jefe.
// Contenido de este bloque (APPEND puro: nada de arriba se edita):
//   1) ENEMY_DEFS_R10A — el def 'sepulcro' (mismo formato que
//      ENEMY_DEFS/14A/16A, inyectado vía Object.assign: makeEnemy,
//      damagePlayer, killEnemy, la barra de jefe y la telegrafía leen
//      ENEMY_DEFS[etype] por índice y funcionan sin cambios).
//   2) SPAWN_SEPULCRO_R10 — spawn listo para maps.ts (enganche
//      documentado abajo; no se edita maps.ts desde aquí).
//   3) SEPULCRO_BOTIN — recompensa garantizada para la rama killEnemy.
//   4) Los ENGANCHES EXACTOS (spawn / activación / flag / toast /
//      recompensa / audio), como comentarios de esta cabecera.
// ARCHIVOS AJENOS (SOLO LECTURA — los edita el orquestador u otros
// agentes R10): maps.ts (spawn), update.ts (watcher de activación),
// engine.ts (BOSS_DEFEAT_FLAG + rama killEnemy), types.ts (unión
// EnemyType), balance.ts (TIPOS_JEFE), interaccion.ts (BOSS_TYPES del
// señuelo), bossintro.ts (nombre/subtítulo de la intro).
// ------------------------------------------------------------
// BALANCE (auditable, coherente con el balanceador 12-c/R8):
//   guardian (post-buff 14-a)  hp 345 · dmg 14 · windup 0.80 · speed 40 · xp 220 · quiebre 80
//   SEPULCRO                   hp 210 · dmg 12 · windup 0.65 · speed 36 · xp  90 · quiebre 55
//   → hp = 60.9 % del Guardián (345×0.609≈210, pedido de misión ~60 %);
//     daño notable (86 % del jefe, muy por encima del élite de mapa 11);
//     windup LEGIBLE 0.65 s (rango pedido 0.55-0.7, aún más lento que
//     el esqueleto 0.6 pero pesado); SIN FASES (el cerebro genérico de
//     update.ts no multiplica dmg por e.phase — solo el 'guardian' lo
//     hace: phase queda 1 para siempre); lento-amenazante (36 px/s,
//     más rápido que el Gólem 30, más lento que el Guardián 40);
//     aggroR medio 120 (el Guardián 150); XP/oro generosos sin robar
//     al jefe (90 xp ≈ 3-4 enemigos de mapa · [45,70] coronas vs
//     [120,160] del Guardián). Quiebre 55 = mini-jefe con la mecánica
//     QUEBRADO (barra de jefe visible al ser bossRef, como los jefes).
//     HP final de spawn pasa por makeEnemy → recibe el multiplicador
//     del mundo (igual que TODOS los spawns; sin doble escala).
// ------------------------------------------------------------
// ENGANCHES EXACTOS (copiar-pegar; ninguno editado desde este archivo):
//
// (A) SPAWN — maps.ts · BASE_MAPS.cripta.spawns (R10-1 coloca la
//     coordenada en SU antesala; con el layout actual, un hueco válido
//     entre el santuario (19,23) y la sala del Guardián es ~(19,18)):
//       { type: 'sepulcro', x: 19, y: 18, patrol: 0, zone: 'antesala' },
//     IMPORTANTE — NO usar zone 'boss' para el Sepulcro:
//     update.ts:571 hace `g.map.spawns.find(s => s.zone === 'boss')`,
//     que devuelve SOLO EL PRIMER spawn de zona 'boss' del mapa. Dos
//     spawns 'boss' en la cripta romperían al Guardián (tras caer el
//     Sepulcro, el bloque seguiría apuntando al Sepulcro muerto y el
//     Guardián quedaría para siempre sin barra, sin intro y sin música
//     de jefe). El Sepulcro usa su zona propia 'antesala' (zone es string
//     libre en SpawnDef)
//     y el Guardián conserva su spawn `zone: 'boss'` intacto.
//     El cast de SPAWN_SEPULCRO_R10 desaparece cuando types.ts añada
//     'sepulcro' a la unión EnemyType (mismo camino que 14-a/16-a).
//
// (B) ACTIVACIÓN — update.ts (watcher junto al bloque zone 'boss',
//     tras update.ts:600, patrón acto3_subir de hooks.ts:303-320):
//       const sepSpawn = g.map.spawns.find(s => s.zone === 'antesala');
//       if (sepSpawn && !g.flags.sepulcroDefeated && !g.bossActive) {
//         const sep = g.enemies.find(e => e.etype === 'sepulcro');
//         if (sep && dist2(p.x, p.y, sep.x, sep.y) < 190 * 190) {
//           g.bossRef = sep; g.bossActive = true;      // barra + QUIEBRE en HUD
//           audio.playTrack('boss');
//           dreadInit(); dreadStinger('boss'); startBossIntro(g);
//           g.toast('EL SEPULCRO se alza de su tumba: ROMPE SU BARRA DE QUIEBRE', '#9ab8c8');
//           audio.sfx('roar');                          // enganche R10-7 opcional
//           g.burst(sep.x, sep.y, '#5a6a7a', 26, 90);   // tierra de la tumba
//         }
//       }
//     El radio 190 px es el MISMO del bloque zone 'boss' (entra en la
//     antesala = se alza). Si se prefiere cero código nuevo, el
//     Sepulcro también funciona SIN watcher como élite mayor: aggro
//     orgánico a 120 px con el cerebro genérico (patrulla → persigue →
//     carga telegrafiada → mandoble), solo pierde barra/intro/música.
//
// (C) FLAG DE DERROTA — engine.ts · BOSS_DEFEAT_FLAG (línea ~83):
//       sepulcro: 'sepulcroDefeated',
//     Con la clave en el mapa del motor se activan GRATIS:
//       · spawnEnemies (engine.ts:770-771): el derrotado no renace.
//       · killEnemy (engine.ts:2272): cuenta en stats.jefesDerrotados.
//       · challenge.ts:2290: los clones de duelo no escriben campaña.
//       · loadMap (engine.ts:622-626): restauración de bossHp_cripta
//         apunta al primer enemigo con flag — con el Sepulcro listado
//         ANTES que el Guardián en spawns, el HP memorizado vuelve al
//         dueño correcto de la pelea activa.
//
// (D) VICTORIA — engine.ts · killEnemy, rama propia tras la de
//     'heraldo' (mismo estilo que coro/vult):
//       } else if (e.etype === 'sepulcro') {
//         // R10-9: la antesala cede el paso — la tumba vuelve a cerrarse
//         this.flags.sepulcroDefeated = true;
//         delete this.flags.bossHp_cripta; // si el watcher le dio bossRef
//         this.bossActive = false;
//         audio.setCombat(false);
//         audio.playTrack('crypt');
//         this.shake = 8;
//         audio.sfx('roar');
//         this.toast('El Sepulcro se hunde de nuevo en su tumba: el umbral es libre', '#9ab8c8');
//         this.toast('La sala del Guardián espera al norte', '#ffe9a0');
//         p.potions += SEPULCRO_BOTIN.potions;
//         p.gold += SEPULCRO_BOTIN.gold;
//         this.floatAt(e.x, e.y - 34, `Botín del guarda: +${SEPULCRO_BOTIN.gold} coronas, +${SEPULCRO_BOTIN.potions} poción`, '#f0c84a');
//       }
//
// (E) HP DE DISEÑO (opcional, balance.ts) — TIPOS_JEFE (~línea 260):
//     añadir 'sepulcro' para que NO reciba la curva de agresividad
//     (+2 %/nivel) en su HP, igual que los demás jefes. Solo tiene
//     efecto si el motor pasa etype a enemyStatMult (engine.ts:848).
//
// (F) SEÑUELO (opcional, interaccion.ts:90) — BOSS_TYPES: añadir
//     'sepulcro' (jefes inmunes al señuelo de caza).
//
// (G) HITBOX DE JEFE (opcional, engine.ts:852-853) — makeEnemy da
//     22×16 solo a guardian/sirena/golem/vult/coro; el Sepulcro nace
//     12×10 (jugable). Añadir `|| type === 'sepulcro'` si se quiere
//     caja grande de mini-jefe.
//
// (H) INTRO CON NOMBRE (opcional, bossintro.ts, tabla R9-5 por
//     g.bossRef.etype): sepulcro → { name: 'EL SEPULCRO',
//     sub: 'Guarda del umbral' }. Sin ella, la intro muestra el
//     fallback del Guardián (el banner del bloque zone 'boss' genérico
//     sí usaría ENEMY_DEFS.sepulcro.name).
//
// (I) AUDIO (R10-7, sin llamar aún): rugido de alzamiento = audio.sfx('roar')
//     en la activación (B) y en la muerte (D); si R10-7 expone una
//     variante (playBossRoarVariant de R9-8), usarla con seed por
//     etype 'sepulcro'.
//
// (J) SPRITE — decisión documentada: reutiliza 'guardian' (ver def).
// ============================================================

/** Defs R10-9 (mismo formato que ENEMY_DEFS/ENEMY_DEFS_14A/ENEMY_DEFS_16A). */
export const ENEMY_DEFS_R10A: Record<string, EnemyDef> = {
  // ── MINI-JEFE de la entrada de la Cripta (épica 6.4) · spawn: ver
  //    enganche (A) — maps.ts, antesala previa a la sala del Guardián.
  sepulcro: {
    name: 'El Sepulcro', hp: 210, dmg: 12, speed: 36, xp: 90, gold: [45, 70],
    sprite: 'guardian', aggroR: 120, atkR: 28, windup: 0.65, atkCd: 2.0,
    element: 'sombra', weakTo: 'sagrado', breakBar: 55,
    desc: 'El caballero que juró guardar el umbral del Primer Canto y cumplió después de la muerte: hundido en su tumba de la antesala, espera a que un paso vivo despierte el juramento. Se alza lento, empuña de nuevo el mandoble y golpea como cae la losa de un sepulcro. Quiebra su barra y la tumba volverá a cerrarse. Débil a la luz.',
  },
};
// Inyección en carga (mismo patrón que 14-a/16-a): extiende ENEMY_DEFS sin
// tocar types.ts. makeEnemy/damagePlayer/killEnemy/render leen la tabla en
// runtime → ven 'sepulcro' en cuanto este módulo termina de cargar.
Object.assign(ENEMY_DEFS, ENEMY_DEFS_R10A);
void ENEMY_DEFS_R10A; // (la referencia viva es ENEMY_DEFS; exportada para el smoke)

/**
 * Spawn listo para maps.ts · BASE_MAPS.cripta.spawns (enganche A).
 * Coordenada (19,18) = hueco sugerido con el layout ACTUAL de la cripta
 * (entre el santuario (19,23) y la sala del Guardián (19,8)); R10-1 debe
 * ajustarla a SU antesala rediseñada. spread directo:
 *   import { SPAWN_SEPULCRO_R10 } from './data';
 *   spawns: [ ..., SPAWN_SEPULCRO_R10, { guardian...zone 'boss' } ]
 * El cast se elimina cuando types.ts añada 'sepulcro' a EnemyType.
 */
export const SPAWN_SEPULCRO_R10: SpawnDef = {
  type: 'sepulcro' as unknown as EnemyType, // TODO R10: unión EnemyType += 'sepulcro'
  x: 19, y: 18,
  patrol: 0,          // guarda casi estática: el cerebro genérico deambula ±60 px (la tumba lo retiene)
  zone: 'antesala',   // zona PROPIA: nunca 'boss' (ver enganche A — find() de update.ts:571)
};

/** Recompensa garantizada del mini-jefe (enganche D, rama killEnemy). */
export const SEPULCRO_BOTIN = { potions: 1, gold: 50 } as const;

// ═══════ FIN DEL BLOQUE R10-9 ═══════

// ═══════════════════════════════════════════════════════════════════════
// R11 · EPIC 7 — registro de mini-jefes + esbirro + diálogos de historia
// (patrón ENEMY_DEFS_R10A: makeEnemy/damageEnemy/killEnemy leen ENEMY_DEFS
// en runtime → ven los etypes nuevos en cuanto este módulo termina de cargar)
// ═══════════════════════════════════════════════════════════════════════
Object.assign(ENEMY_DEFS, minibossEnemyDefs());
Object.assign(ENEMY_DEFS, { ahogado_r11: AHOGADO_DEF_R11 });

// Diálogos R11 (5 NPCs nuevos: vela/tejado/ceniza/niebla/toldero + 3 variantes
// de historia para brisa/mara/heraldo) — Object.assign idempotente con guard.
installDialoguesR11();

// Tercera capa del envoltorio de getDialogue (patrón 13-a → 16-a → R11):
// captura la función VIGENTE y reasigna el binding. getDialogueR11 resuelve
// SOLO sus claves; null → delega en la cadena previa INTACTA (regresión 0).
const GET_DIALOGUE_PRE_R11 = getDialogue;
// @ts-expect-error R11: reasignación deliberada del binding de función (capa R11)
getDialogue = (nid: string, ctx: DialogueCtx): string => {
  const r = getDialogueR11(nid, ctx);
  return r !== null ? r : GET_DIALOGUE_PRE_R11(nid, ctx);
};

// ═══════ FIN DEL BLOQUE R11 ═══════

