// ============================================================
// ECOS DE AELTHAR — R11-5 · Diálogos que cambian con la historia
// Ronda 11 · EPIC 7.3/7.4 ("diálogos gated por la historia")
// ============================================================
// ARCHIVO EXCLUSIVO R11-5. APPEND puro: no toca data.ts, interaccion.ts
// ni worldlife.ts. El orquestador hace el cableado (ver ENGANCHE abajo).
//
// MECANISMO (estudiado en data.ts, sin modificarlo):
//   · engine.talkTo(nid) → getDialogue(nid, ctx) → openDialogue(key) con
//     DialogueCtx { questIdx, questStep, flags, companion } (data.ts:27).
//   · getDialogue es una cadena de envoltorios (Acto I/II → Acto III
//     [13-a] → Acto IV [16-a] → R7-V5); los nid desconocidos caen al
//     `return 'brisa_idle'` de la capa base. Por eso ESTE archivo exporta
//     getDialogueR11: una capa previa (prioridad sobre la cadena) que
//     resuelve los nid NUEVOS y 3 variantes de historia, y devuelve null
//     para todo lo demás (delegación intacta → regresión 0).
//   · El patrón "primera charla vs repetida" es el de vult (data.ts:512):
//     nodo intro con `action: 'flag_<clave>'` (hooks.handleCustomAction
//     hace g.flags[clave] = true) y getDialogue leyendo ctx.flags.<clave>.
//   · Variante por tono: `tone: 'empatico'|'pragmatico'|'sarcastico'|
//     'amenazante'` en las opciones (hooks.recordDialogueTone lo registra;
//     los idles reaccionan a flags.tonoDominante igual que mara/vult).
//
// MAPA DE CLAVES Y CONDICIONES (para orquestador y QA)
// ────────────────────────────────────────────────────────────
// NPC NUEVOS (los spawnea R11-4 con estos ids exactos; árbol COMPLETO,
// la capa R11 resuelve siempre): el orden es de más a menos específico.
//
//   vela — La Sabia de la Vela (faro, costa) · el mar como archivo:
//     vela_intro     !flags.metVela                     (action: flag_metVela)
//     vela_acto4     metVela && flags.acto4Done
//     vela_faro      metVela && flags.maraGift          (el farol de Mara, q7+)
//     vela_sirena    metVela && flags.sirenaDefeated    (q7 resuelto)
//     vela_cuenta    metVela (idle base)
//
//   tejado — el Carpintero (aldea) · ataúdes que nunca usa:
//     tejado_intro     !flags.metTejado                 (action: flag_metTejado)
//     tejado_acto4     metTejado && flags.acto4Done
//     tejado_espectro  metTejado && flags.ecoNombres    (q8 resuelto)
//     tejado_guardian  metTejado && flags.guardianDefeated (q4 resuelto)
//     tejado_idle      metTejado (idle base)
//
//   ceniza — el Monje de Ceniza (bosque, santuario caído) · reza a un coro callado:
//     ceniza_intro     !flags.metCeniza                 (action: flag_metCeniza)
//     ceniza_acto4     metCeniza && flags.acto4Done
//     ceniza_coro      metCeniza && flags.coroDefeated  (El Coro Roto, 14-a)
//     ceniza_guardian  metCeniza && flags.guardianDefeated (q4 resuelto)
//     ceniza_idle      metCeniza (idle base)
//
//   niebla — la Pescadora (costa) · pesca recuerdos y los devuelve:
//     niebla_intro     !flags.metNiebla                 (action: flag_metNiebla)
//     niebla_acto4     metNiebla && flags.acto4Done
//     niebla_eco       metNiebla && flags.ecoNombres    (q8 resuelto)
//     niebla_sirena    metNiebla && flags.sirenaDefeated (q7 resuelto)
//     niebla_idle      metNiebla (idle base)
//
//   tolnero — el Mercador Ambulante (cumbres) · amuletos contra la segunda vez:
//     tolnero_intro     !flags.metToldero               (action: flag_metToldero)
//     tolnero_acto4     metToldero && flags.acto4Done
//     tolnero_golem     metToldero && flags.golemDefeated (q9 resuelto)
//     tolnero_sepulcro  metToldero && flags.sepulcroDerrotado (R10-9)
//     tolnero_idle      metToldero (idle base)
//
// VARIANTES DE HISTORIA de NPCs EXISTENTES (claves NUEVAS con sufijo _r11_,
// condiciones ESTRECHAS; en cualquier otro estado la capa devuelve null y
// rige la cadena previa — nunca se tocan las claves ni rutas existentes):
//
//   brisa_r11_ultimo   brisa && flags.acto4Done && questIdx >= 15
//     → sustituye el idle 'acto4_epilogo_stay' DESPUÉS del Último Canto.
//       Mantiene la opción action 'end_demo' (misma funcionalidad).
//   mara_r11_segunda   mara && sirenaDefeated && maraGift && questIdx >= 10
//     → sustituye el idle 'mara_faro' durante el Acto III en adelante
//       ('mara_faro' es un idle sin opciones: cambio solo de texto).
//   heraldo_r11_sin_amo  heraldo && flags.heraldoDerrotado
//     → tras caer el jefe final (flag del motor, BOSS_DEFEAT_FLAG), la
//       cadena re-mostraría 'heraldo_intro' (con sus rep_orden); esta
//       variante da voz al mensajero sin amo, sin acciones de reputación.
//
// FLAGS EMPLEADAS (todas existentes en el motor/capa de hooks):
//   guardianDefeated · sirenaDefeated · golemDefeated · sepulcroDerrotado ·
//   coroDefeated · heraldoDerrotado (BOSS_DEFEAT_FLAG, engine.ts:96)
//   ecoNombres (mera_eco) · maraGift (mara_gift) · acto4Done (epílogo 16-a)
//   metVela/metTejado/metCeniza/metNiebla/metToldero (genéricas flag_, nuevas)
//
// ACCIONES EMPLEADAS (solo vocabulario existente y verificado):
//   'flag_<clave>' (hooks.handleCustomAction, genérico) · 'end_demo'
//   (engine.applyAction) · 'rep_circulo_5' (regex rep_(guardianes|orden|
//   circulo|liga)_(±n) en hooks) — una sola vez, en la intro del Monje.
//
// ────────────────────────────────────────────────────────────
// ENGANCHE EXACTO (ORQUESTADOR — copiar tal cual en data.ts, AL FINAL del
// archivo, tras el bloque R10-9; allí el binding getDialogue ya es la
// cadena R7-V5 y DIALOGUES lleva todos los assigns de los bloques previos):
//
//   // ── R11-5: diálogos que cambian con la historia (EPIC 7.3/7.4) ──
//   import { getDialogueR11, installDialoguesR11 } from './dialogues_r11';
//   installDialoguesR11();                      // nodos → DIALOGUES (idempotente)
//   const GET_DIALOGUE_PRE_R11 = getDialogue;   // captura la cadena vigente
//   // @ts-expect-error R11-5: reasignación deliberada del binding de función
//   // (capa R11 sobre R7-V5; mismo patrón de las capas 13-a/16-a/R7-V5).
//   getDialogue = (nid: string, ctx: DialogueCtx): string => {
//     const r11 = getDialogueR11(nid, ctx);
//     return r11 !== null ? r11 : GET_DIALOGUE_PRE_R11(nid, ctx);
//   };
//
// Alternativa admitida: llamar installDialoguesR11() desde el constructor de
// Game (engine.ts) — el assign es idempotente y solo necesita que data.ts
// haya terminado de evaluar. La reasignación de getDialogue, en cambio, SOLO
// puede hacerse dentro de data.ts (binding de módulo).
// Sin el cableado, el juego no rompe: openDialogue cae al fallback seguro
// 'brisa_idle' (engine.ts) — solo se pierde el ruteo de los NPCs nuevos.
// ============================================================

import { DIALOGUES } from './data';
import type { DialogueCtx } from './data';
import type { DialogueNode } from './types';

// ============================================================
// DIALOGUES_R11 — nodos de la Ronda 11 (claves nuevas, APPEND puro:
// ninguna colisiona con DIALOGUES, verificado sobre data.ts/maps_interiores)
// ============================================================

export const DIALOGUES_R11: Record<string, DialogueNode> = {
  // ────────────────────────────────────────────────────────────
  // VELA — La Sabia de la Vela (faro, costa)
  // Guarda la cuenta de los barcos que no volvieron. Habla del mar
  // como de un archivo: guarda lo que se le nombra, no presta hojas.
  // ────────────────────────────────────────────────────────────
  vela_intro: {
    name: 'La Sabia de la Vela', portrait: 'maelis',
    text: 'Vengo a contar. Tú también, si quieres. (La vieja no aparta la mirada del mar) Este faro ya no sirve para avisar: sirve para llevar la cuenta. Un nombre dicho es una vela, y un barco que no vuelve es una vela que se apaga... Yo las cuento. Llevo más velas que dedos, y más años que velas. El mar es un archivo, Portador: guarda todo lo que se le nombra. Solo que no entrega las hojas cuando uno pregunta.',
    action: 'flag_metVela',
    options: [
      { text: '¿Y qué se hace con una cuenta tan larga?', next: 'vela_reac_emp', tone: 'empatico' },
      { text: 'Llevas la cuenta de los muertos. ¿Y los vivos?', next: 'vela_reac_prag', tone: 'pragmatico' },
      { text: 'Un archivo que no presta libros. El peor bibliotecario del mundo.', next: 'vela_reac_sarc', tone: 'sarcastico' },
    ],
  },
  vela_reac_emp: {
    name: 'La Sabia de la Vela', portrait: 'maelis',
    text: 'Lo mismo que con cualquier archivo: leerlo en voz alta, para que no se olvide que hubo quien escribió. (Mira la lámpara apagada) Yo leo nombres cuando el viento me deja. Los que llegan al faro, escuchan. Los que no... se los queda el mar. Él también necesita alguien que los sepa de memoria.',
  },
  vela_reac_prag: {
    name: 'La Sabia de la Vela', portrait: 'maelis',
    text: 'Los vivos muelen sal y temen el agua. Yo me ocupo de los que ya no temen nada. Esa es la repartición, pequeña y justa, de esta costa: ellos el pan; yo, los nombres. Si algún día te toca llevar una cuenta, verás que es más fácil pelear que recordar.',
  },
  vela_reac_sarc: {
    name: 'La Sabia de la Vela', portrait: 'maelis',
    text: 'Je. Ríete. El mar nunca aprendió a prestar: solo a cobrar. (Saca del manto una moneda vieja y la besa) Esta la pagó un barco que no volvió. La guardo para acordarme de que hay deudas que no se saldan... solo se nombran.',
  },
  vela_acto4: {
    name: 'La Sabia de la Vela', portrait: 'maelis',
    text: '¿Lo oyes? Ya no es silencio. (Cierra el libro que nunca ha estado abierto) El coro volvió, el mar canta lo que se llevó, y mi cuenta por fin es solo la de los barcos que vuelven. Es una lista corta. Es mía. Cuando me vaya, la vela la llevarás tú: di un nombre cada día, Portador. Así es como no se apaga un archivo.',
  },
  vela_faro: {
    name: 'La Sabia de la Vela', portrait: 'maelis',
    text: 'Mara encendió el faro. Trescientos años de cerillas y de esperanzas, y lo encendió ella. (Señala con el mentón la luz baja) Ahora las velas del archivo miran otra vela más grande. No sé si eso es consuelo. Pero hay algo: cuando la luz barre el agua, los nombres que cuento se leen solos. El mar es un archivo, y hasta los archivos necesitan que alguien los abra.',
  },
  vela_sirena: {
    name: 'La Sabia de la Vela', portrait: 'maelis',
    text: 'Calló la que cantaba debajo del naufragio. (Se queda quieta, escuchando el agua) ¿Sabes qué es lo peor? Que el archivo no cambió: la misma marea, la misma letra. Una voz menos, y la cuenta de los barcos igual de larga. El mar guarda también los silencios, Portador. Y esos no se apagan: se heredan.',
  },
  vela_cuenta: {
    name: 'La Sabia de la Vela', portrait: 'maelis',
    text: 'El archivo crece sin pedir permiso. Ayer el mar me devolvió un remo sin barco. Lo siento por el barco... pero el remo ya sabía a qué olía el agua antes de que la cuenta lo escribiera. La primera vez que uno pierde algo, llora. La segunda vez, apunta la fecha. Yo ya voy por el folio setenta y uno.',
  },

  // ────────────────────────────────────────────────────────────
  // TEJADO — el Carpintero (aldea)
  // Construye ataúdes que nadie encarga; la madera aprendió a esperar.
  // ────────────────────────────────────────────────────────────
  tejado_intro: {
    name: 'Tejado, el Carpintero', portrait: 'brokk',
    text: 'No hace falta que digas para qué. (Da un toque a la tapa de un ataúd nuevo, sin tristeza) La Niebla no deja cuerpos, ¿sabes? Se lleva los nombres y deja la madera. Así que hago estas cajas... y nadie viene a por ellas. Al principio pensé que me había equivocado de oficio. Ahora sé que no: la madera aprendió a esperar. Yo aprendí con ella.',
    action: 'flag_metTejado',
    options: [
      { text: 'Debes de cargar con mucho, haciendo esto.', next: 'tejado_reac_emp', tone: 'empatico' },
      { text: 'Si no las usas, ¿por qué seguir haciéndolas?', next: 'tejado_reac_prag', tone: 'pragmatico' },
      { text: 'El único carpintero con más clientela muerta que viva.', next: 'tejado_reac_sarc', tone: 'sarcastico' },
    ],
  },
  tejado_reac_emp: {
    name: 'Tejado, el Carpintero', portrait: 'brokk',
    text: 'No es carga. Es costumbre. (Acaricia la veta) Mi padre hacía cunas y taburetes; yo hago esto. Cada caja es una promesa: si alguien tiene que irse, que se vaya con nombre y apellido, en una puerta hecha a su medida. Que nadie la use es la mejor noticia que me dan cada día.',
  },
  tejado_reac_prag: {
    name: 'Tejado, el Carpintero', portrait: 'brokk',
    text: 'Porque si dejo de hacerlas es que me he rendido. (Sopla el serrín) La Niebla cuenta con que nos acostumbremos al vacío. Yo la desmiento una caja por semana. Es mi manera de pelear: lentísima, silenciosa, y con clavos.',
  },
  tejado_reac_sarc: {
    name: 'Tejado, el Carpintero', portrait: 'brokk',
    text: 'Y con la clientela más puntual del reino: nadie. (Se limpia las manos) Anda, ríete. La risa aquí también es un oficio, y lo ejerzo peor que tú.',
  },
  tejado_acto4: {
    name: 'Tejado, el Carpintero', portrait: 'brokk',
    text: '(Apoya el último tablón contra la pared: es un banco, no una caja) La madera aprendió a esperar... y yo aprendí a terminar. Ya no hago cajas, Portador: hago asientos. Para el coro nuevo, para los que vuelven, para los que se sientan a escuchar. Si alguien tiene que irse, ya habrá tiempo. Ahora toca quedarse. Siéntate: acaba de secarse.',
  },
  tejado_espectro: {
    name: 'Tejado, el Carpintero', portrait: 'brokk',
    text: 'Ayer pasó una cosa: tallé un nombre en una cuna. (Se seca las manos en el hantal, despacio) No en un ataúd. En una cuna. Es la Espectro, ¿verdad? Ha vuelto a dictar nombres por la plaza de Merrow... Trescientos años sin encargar cunas y, de repente, la madera vuelve a tener prisa. Que la Niebla lo aprenda: lo que se lleva, si se nombra, vuelve. Y yo tengo astillas para todas las vueltas.',
  },
  tejado_guardian: {
    name: 'Tejado, el Carpintero', portrait: 'brokk',
    text: 'El que cantaba bajo la cripta calló. (Pone la lima en el banco, en cruz) Mi padre juraba que el Primer Canto era el clavo maestro de todo: de él colgaba la caja del mundo. Alguien lo ha quitado. Y, sin embargo... nadie se ha caído. (Mira las manos) Tendré que hacer una caja más pequeña. Para la canción. Que descanse en madera, como todo aquí.',
  },
  tejado_idle: {
    name: 'Tejado, el Carpintero', portrait: 'brokk',
    text: 'El serbal del cementerio dejó de crecer. No está seco: espera. (Da la vuelta a una tabla) Todo lo de este pueblo aprendió a esperar, menos nosotros, que siempre tuvimos prisa por olvidar. Si traes madera buena, la acepto. Si traes malas nuevas... también. Para eso están las cajas.',
  },

  // ────────────────────────────────────────────────────────────
  // CENIZA — el Monje de Ceniza (bosque, santuario caído)
  // Reza a un coro que ya no responde; quema ceniza en vez de incienso.
  // ────────────────────────────────────────────────────────────
  ceniza_intro: {
    name: 'El Monje de Ceniza', portrait: 'doran',
    text: 'No es humo lo que me ves echar: es ceniza. (Extiende la mano gris) El incienso se quema para que el coro respire. El nuestro se quemó entero, hace trescientos años, la noche en que el canto se rompió. Desde entonces rezo con lo que quedó del incienso... que es ceniza. Y el coro no responde. Rezo igual. Que quede constancia de que alguien seguía preguntando.',
    action: 'flag_metCeniza',
    options: [
      { text: 'Rezar sin respuesta es duro. ¿No te has rendido?', next: 'ceniza_reac_emp', tone: 'empatico', action: 'rep_circulo_5' },
      { text: '¿Qué pides, exactamente, a un coro que no contesta?', next: 'ceniza_reac_prag', tone: 'pragmatico' },
      { text: 'Si nadie contesta, quizá es que ya no hay nadie ahí.', next: 'ceniza_reac_amenaz', tone: 'amenazante' },
    ],
  },
  ceniza_reac_emp: {
    name: 'El Monje de Ceniza', portrait: 'doran',
    text: 'Rendirse también es una respuesta. Prefiero la pregunta. (Junta las cenizas en un cuenco) Los del Círculo Verde tallaron estas piedras para que el bosque cantara con ellos. El bosque se calló, pero las piedras siguen ahí, queriendo. Yo soy como las piedras, portador: lo que me quede de voz, lo gasto preguntando.',
  },
  ceniza_reac_prag: {
    name: 'El Monje de Ceniza', portrait: 'doran',
    text: 'Constancia. Pido constancia. (Señala el anillo de piedras) Un coro no responde a la voz más alta: responde a la que más noches seguidas canta. Trescientos años es una noche larga. Estamos en el último verso. Tú no lo oyes porque llegaste tarde. Yo no lo he dejado, porque llegué antes.',
  },
  ceniza_reac_amenaz: {
    name: 'El Monje de Ceniza', portrait: 'doran',
    text: '¿Y tú qué eres, entonces? ¿Silencio con dientes? (No se aparta) Muy bien: yo también he rezado enfadado. Hacen falta las dos voces, ¿sabes?: la que espera y la que golpea la puerta. Un coro que calla trescientos años no es sordo. Es terco. Terco como tú.',
  },
  ceniza_acto4: {
    name: 'El Monje de Ceniza', portrait: 'doran',
    text: '(Saca un saquito de cuero y lo abre: ceniza limpia, blanca) Era incienso. Guardaba la última pizca para el día en que el coro volviera, para quemarla como antes. Pues ya está: ha vuelto. Y no la he quemado. (Cierra el saco) No ha hecho falta. La respuesta vino sola, portador, sin pedirle permiso a mi tristeza. La ceniza se queda. Por si acaso. Que nunca se sabe cuándo hará falta volver a preguntar.',
  },
  ceniza_coro: {
    name: 'El Monje de Ceniza', portrait: 'doran',
    text: 'Lo oí. (Se arrodilla junto al fuego, sin apartarse de él) Bajo la cripta había tres máscaras que llevaban siglos sonando al revés... y de golpe, en pie. No sé si aquello es música. Pero han dejado de fingir que es silencio. (Ríe bajito, sin costumbre) Trescientos años preguntando y ahora tengo miedo de que contesten. Cómo somos, portador: rezamos para que respondan... y cuando responden, buscamos la ceniza con la mirada.',
  },
  ceniza_guardian: {
    name: 'El Monje de Ceniza', portrait: 'doran',
    text: 'El Guardián Hueco ya no sostiene el coro del Primer Canto. (Apaga las brasas con la mano, sin prisa) Un coro es eso: alguien que sostiene la nota para que otros respiren. Lo hizo hasta el final, aunque lo vaciaran. (Se enjuga la ceniza de la mano) Yo también sostengo notas, ¿sabes? Las mías son blancas y no pesan. Pero sostengo. Que quede constancia.',
  },
  ceniza_idle: {
    name: 'El Monje de Ceniza', portrait: 'doran',
    text: '(Echa ceniza sobre la piedra, en redondo) Hoy el viento sopló del sur: huele a sal y a nombres nuevos. El coro sigue callado. Yo sigo preguntando. Somos dos tercos, la piedra y yo, y el bosque hace de feligrés.',
  },

  // ────────────────────────────────────────────────────────────
  // NIEBLA — la Pescadora (costa)
  // Pesca recuerdos; devuelve al agua lo que no es suyo.
  // ────────────────────────────────────────────────────────────
  niebla_intro: {
    name: 'Niebla, la Pescadora', portrait: 'sasha',
    text: 'Mira lo que ha subido hoy. (Extiende en la palma una baratija que no sabrás nombrar, aunque te parezca conocida) Yo no pesco peces, Portador. Pesco lo que el mar se quedó: un olor a pan, un decir de nana, un nombre a medias. Y lo que no es mío, lo devuelvo. Es la ley de esta orilla: el mar presta. Nunca regala.',
    action: 'flag_metNiebla',
    options: [
      { text: '¿Y cómo sabes qué es tuyo y qué no?', next: 'niebla_reac_emp', tone: 'empatico' },
      { text: '¿Has pescado algo mío?', next: 'niebla_reac_prag', tone: 'pragmatico' },
      { text: 'La primera pescadora con devolución incluida. Llevas ventaja.', next: 'niebla_reac_sarc', tone: 'sarcastico' },
    ],
  },
  niebla_reac_emp: {
    name: 'Niebla, la Pescadora', portrait: 'sasha',
    text: 'Pesa distinto. (Cierra el puño) Lo que es tuyo te abre la mano; lo que no, la cierra. Lo aprendí de los náufragos: todos soltaron lo ajeno antes de irse bajo. El agua recuerda a quien la respeta. Yo la respeto: devuelvo.',
  },
  niebla_reac_prag: {
    name: 'Niebla, la Pescadora', portrait: 'sasha',
    text: '¿Y si lo fue? (Riega la caña hacia el agua) Un día subió un recuerdo con tu manera de mirar el mar. Lo devolví entero. No te preocupes: los recuerdos no se rompen al caer, se rompen al negarse. Tú, si quieres, pregúntale al mar con otro nombre.',
  },
  niebla_reac_sarc: {
    name: 'Niebla, la Pescadora', portrait: 'sasha',
    text: 'Ventaja tiene el mar, que pesca a pescadores. (Se ríe sola, escasa) Anda, no te me pongas filosófico, que entonces no suelto ni lo mío.',
  },
  niebla_acto4: {
    name: 'Niebla, la Pescadora', portrait: 'sasha',
    text: '(Recoge el sedal, lo enrolla, no vuelve a echar) Ya no sube nada, Portador. El mar se ha quedado con lo suyo y ha devuelto lo ajeno: el archivo está en orden. (Guarda la caña) Te voy a decir algo que no le digo a nadie: yo pescaba recuerdos porque el mío se me fue con una marea. ¿Sabes qué? Hoy ha subido atado al anzuelo. Me lo he quedado. La cuenta, por fin, cuadra.',
  },
  niebla_eco: {
    name: 'Niebla, la Pescadora', portrait: 'sasha',
    text: 'Ayer salieron los nombres. (Se seca las manos en la falda) Todos de golpe, como peces de agua dulce: por la boca del río, hacia Merrow, nadando. (Casi sonríe) Yo llevaba años pescándolos de uno en uno y devolviéndolos: no eran míos. Ahora ya lo sé. No es que no fueran míos: es que esperaban a su dueño. Saluda a la Espectro de mi parte. Que guarde bien lo que le devolví.',
  },
  niebla_sirena: {
    name: 'Niebla, la Pescadora', portrait: 'sasha',
    text: 'Calló la de abajo. (Sostiene el anzuelo en el aire, sin peso) Antes, cuando echaba el sedal, venía lleno de voces ajenas: la Sirena pescaba lo que yo soltaba. Ahora la red sube ligera, con lo justo. (Mira la espuma) Es raro lo tranquilo, ¿verdad? También lo tranquilo se pesca. Hay que ir aprendiendo a echarlo de menos.',
  },
  niebla_idle: {
    name: 'Niebla, la Pescadora', portrait: 'sasha',
    text: 'Hoy ha subido poco: una cerilla que no se apaga y la cola de un vestido de baile. (Lo devuelve al agua, despacio) El mar guarda lo que se le nombra, dicen los viejos. Yo añado: y lo devuelve a quien sabe esperar. Quédate. La marea tarda, pero es justa.',
  },

  // ────────────────────────────────────────────────────────────
  // TOLDERO — el Mercador Ambulante (cumbres)
  // Vende amuletos contra la segunda vez. Nunca descuenta.
  // ────────────────────────────────────────────────────────────
  tolnero_intro: {
    name: 'Toldero, el Mercador Ambulante', portrait: 'corvin',
    text: '¡Alto ahí, caminante! (Abre el zurrón sobre la nieve: amuletos de hueso, sal, hilo rojo) Mercancía honesta para tiempos poco honestos: amuletos contra la segunda vez. Sí, sí, esa: la que todos temen y nadie nombra. La primera vez que el canto se rompió no había amuletos que comprar. Por eso estoy yo. (Sonríe con poca cosa) El precio es el precio. En esto no descuento: la segunda vez tampoco lo hará.',
    action: 'flag_metToldero',
    options: [
      { text: '¿Y de qué protege de verdad un amuleto?', next: 'tolnero_reac_emp', tone: 'empatico' },
      { text: 'Un amuleto contra algo que pasó hace trescientos años. Vende poco.', next: 'tolnero_reac_prag', tone: 'pragmatico' },
      { text: 'El miedo también se vende al peso. Enhorabuena por el negocio.', next: 'tolnero_reac_sarc', tone: 'sarcastico' },
    ],
  },
  tolnero_reac_emp: {
    name: 'Toldero, el Mercador Ambulante', portrait: 'corvin',
    text: '¿Proteger? No, no, no. (Le da la vuelta a un amuleto de hueso) Yo no vendo escudos: vendo despedidas. Cada amuleto lleva dentro un nombre, uno solo, dicho por ti una vez. La segunda vez, si viene, se llevará lo que no esté nombrado. (Cierra el puño) Barato es lo que te sobra. Lo caro es olvidar lo que amas. Eso no está a la venta.',
  },
  tolnero_reac_prag: {
    name: 'Toldero, el Mercador Ambulante', portrait: 'corvin',
    text: 'Poco, poco... pero es luz para el camino. (Recoge el zurrón) Trescientos años es el tiempo que tarda la Niebla en volver a tener hambre. Yo llevo cien en estas cumbres vendiendo recuerdos con hilo rojo. Si me sobra mercancía cuando llegue la segunda vez... me habré equivocado. Encantado de haberlo hecho.',
  },
  tolnero_reac_sarc: {
    name: 'Toldero, el Mercador Ambulante', portrait: 'corvin',
    text: 'El miedo no lo vendo yo, amigo: lo venden el mar, el hielo y lo que canta debajo. (Señala la ventisca) Yo solo pongo el mostrador. Y sí: buen negocio. El mejor del mundo es el que nunca quieres volver a hacer. Por eso no descuento: para que dure.',
  },
  tolnero_acto4: {
    name: 'Toldero, el Mercador Ambulante', portrait: 'corvin',
    text: '(Cierra el zurrón con dos nudos y lo cuelga del hombro) Se acabó, amigo. La segunda vez no vendrá: la has cambiado por una tercera que ya no es segunda, que es la de siempre, la que canta. (Se queda mirando las cumbres) Sin compradores, un mercador se hace caminante. (Vuelve a sonreír, más entero) El precio era el precio. El regalo no lo es: te queda todo lo que nombraste. Cuidarlo. Eso sí que no hay quien lo venda.',
  },
  tolnero_golem: {
    name: 'Toldero, el Mercador Ambulante', portrait: 'corvin',
    text: '¿Ese fuiste? El hielo devolvió su voz y tú aquí, contándomelo. (Saca un amuleto nuevo, el más pequeño, y te lo tiende) Tómalo. ¿Que no descuento? Hoy es la excepción que confirma el precio. (Te cierra la mano) Se lo debes a los pastores que cantaban por turnos: su nota volvió. Un mercador que no celebra una reposición no sabe de libros. De cuentas, quiero decir.',
  },
  tolnero_sepulcro: {
    name: 'Toldero, el Mercador Ambulante', portrait: 'corvin',
    text: 'Bajaste a la cripta y el guardián del umbral te dejó pasar. (Pone la balanza en el suelo, quieta) Yo vendo amuletos contra la segunda vez, pero tú haces otra cosa: deshaces las primeras. (Busca en el zurrón, no encuentra nada, sonríe) No tengo mercancía para eso. Nadie la tiene. Te debo un favor, caminante, y los de mi gremio no decimos nunca esa frase. Guárdala: vale más que todos mis amuletos.',
  },
  tolnero_idle: {
    name: 'Toldero, el Mercador Ambulante', portrait: 'corvin',
    text: '(Ajusta los amuletos al sol, uno por uno) Hoy toca sal del norte e hilo de lino. La segunda vez no avisa, ¿sabes? Por eso el precio es el precio. Anda, mira el hielo: dice que algo recuerda. Esa mercancía no es para mí. Quizá para ti.',
  },

  // ────────────────────────────────────────────────────────────
  // VARIANTES DE HISTORIA — NPCs EXISTENTES (claves _r11_ nuevas;
  // las claves y rutas previas de brisa/mara/heraldo quedan intactas)
  // ────────────────────────────────────────────────────────────
  // brisa && flags.acto4Done && questIdx >= 15 — después del Último Canto.
  // Sustituye al idle 'acto4_epilogo_stay' CONSERVANDO su opción 'end_demo'
  // (misma funcionalidad; solo cambia el texto y el eco de lo vivido).
  brisa_r11_ultimo: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '...Sigues aquí, Portador. Bien: los que llegan al final de una cuenta suelen quedarse a mirar los números. (Sirve dos tazas; las dos humean) La primera vez que te vi no sabía si eras señal o remedio. La segunda, ya lo sabía: eras las dos cosas. El coro canta, el mar devuelve, la madera hace asientos y el archivo del faro por fin escribe páginas que se leen solas. Yo no pido más: mi taza, tu canto, y un valle que se aprende de memoria.',
    options: [
      { text: '(Terminar el viaje: subir el telón del Último Canto)', action: 'end_demo' },
      { text: '(Quedarte un rato más con la cuenta de la Anciana)', tone: 'empatico' },
    ],
  },
  // mara && sirenaDefeated && maraGift && questIdx >= 10 — el farol lleva noches
  // encendido y el Acto III camina: la segunda vez que el mar devuelve algo.
  // Sustituye al idle 'mara_faro' (idle puro, sin opciones: cambio solo de texto).
  mara_r11_segunda: {
    name: 'Mara, la farera', portrait: 'maelis',
    text: '...Otra vez, Portador. (Se limpia la cerilla en el hombro) El mar volvió a devolver algo: esta vez fue un nombre, el tuyo, entre los que lee la marea. ¿Ves cómo funciona el archivo? Lo que se le nombra, vuelve. Lo que no... espera. Yo esperé trescientos años con una cerilla en la mano y no me arrepiento de una sola. La primera vez que algo vuelve, se llora. La segunda, se apunta la fecha. (Mira el faro) La luz está. Sigue así.',
  },
  // heraldo && flags.heraldoDerrotado — tras caer el jefe final, la cadena
  // re-mostraría 'heraldo_intro' (con sus opciones de reputación); esta
  // variante da voz al mensajero sin amo, sin acciones de reputación.
  heraldo_r11_sin_amo: {
    name: 'Heraldo de Vesh', portrait: 'kael',
    text: '...No traigo cartas. (Se quita el guante y mira la mano desnuda) Traigo la cuenta, recipiente. La Orden me envió a medirte y he vuelto con la medida al revés: la Lanza que atravesó al dios la primera vez... ya no tiene quien la esgrima. ¿Sabes lo que dice ahora la Ciudadela de la segunda vez? Que no habrá. (Recoge el estandarte y lo dobla) Yo repetía palabras que no entendía. Ahora las entiendo, y no las repito. Anda: el mundo va a necesitar contadores que no cobren por nombrar. Ahí me verás.',
  },
};

// ============================================================
// CAPA DE RUTEO R11 (prioridad sobre la cadena 13-a → 16-a → R7-V5)
// ============================================================
/**
 * Resuelve SOLO lo de esta ronda; devuelve null para todo lo demás y la
 * capa previa sigue mandando (regresión 0). Para los 5 NPC nuevos devuelve
 * SIEMPRE una clave (árbol completo, ver mapa de arriba); para los 3 NPCs
 * existentes solo interfiere bajo su condición estrecha de historia.
 */
export function getDialogueR11(nid: string, ctx: DialogueCtx): string | null {
  const q = ctx.questIdx;
  const f = ctx.flags ?? {};
  switch (nid) {
    // ----- NPC nuevos (R11-4 los spawnea con estos ids exactos) -----
    case 'vela':
      if (!f.metVela) return 'vela_intro';
      if (f.acto4Done) return 'vela_acto4';
      if (f.maraGift) return 'vela_faro';       // el farol de Mara encendido (q7+)
      if (f.sirenaDefeated) return 'vela_sirena';
      return 'vela_cuenta';
    case 'tejado':
      if (!f.metTejado) return 'tejado_intro';
      if (f.acto4Done) return 'tejado_acto4';
      if (f.ecoNombres) return 'tejado_espectro'; // Merrow recuperó su nombre (q8)
      if (f.guardianDefeated) return 'tejado_guardian';
      return 'tejado_idle';
    case 'ceniza':
      if (!f.metCeniza) return 'ceniza_intro';
      if (f.acto4Done) return 'ceniza_acto4';
      if (f.coroDefeated) return 'ceniza_coro';   // El Coro Roto, en pie (14-a)
      if (f.guardianDefeated) return 'ceniza_guardian';
      return 'ceniza_idle';
    case 'niebla':
      if (!f.metNiebla) return 'niebla_intro';
      if (f.acto4Done) return 'niebla_acto4';
      if (f.ecoNombres) return 'niebla_eco';
      if (f.sirenaDefeated) return 'niebla_sirena';
      return 'niebla_idle';
    case 'toldero':
      if (!f.metToldero) return 'tolnero_intro';
      if (f.acto4Done) return 'tolnero_acto4';
      if (f.golemDefeated) return 'tolnero_golem';  // q9: el hielo devolvió su voz
      if (f.sepulcroDerrotado) return 'tolnero_sepulcro'; // R10-9: el umbral libre
      return 'tolnero_idle';
    // ----- NPCs existentes: SOLO variantes de historia (condición estrecha;
    // en cualquier otro estado null → rige la cadena previa sin cambios) -----
    case 'brisa':
      if (f.acto4Done && q >= 15) return 'brisa_r11_ultimo'; // tras el Último Canto
      return null;
    case 'mara':
      if (f.sirenaDefeated && f.maraGift && q >= 10) return 'mara_r11_segunda'; // Acto III+
      return null;
    case 'heraldo':
      if (f.heraldoDerrotado) return 'heraldo_r11_sin_amo'; // tras caer el jefe final
      return null;
    default:
      return null;
  }
}

// ============================================================
// INSTALACIÓN (idempotente)
// ============================================================
/** Asigna los nodos de la Ronda 11 a DIALOGUES una sola vez. La llama el
 *  orquestador al init (ver ENGANCHE en la cabecera). Sin efectos si ya
 *  se instaló; nunca sobrescribe claves ajenas (todas las de aquí son nuevas). */
let r11Installed = false;
export function installDialoguesR11(): void {
  if (r11Installed) return;
  r11Installed = true;
  Object.assign(DIALOGUES, DIALOGUES_R11);
}
