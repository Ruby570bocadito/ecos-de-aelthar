// ============================================================
// ECOS DE AELTHAR — 19-f (acto 5 narrativa) «LA ÚLTIMA NOTA»
// ============================================================
// Tras derrotar al Heraldo (Acto IV, flag 'heraldoDerrotado'), el Canto
// Residual despierta a la Ciudadela de Vesh —el mito— y su puerta se abre
// para quien lleve tres Ecos. Dentro, la verdad: Vesh no es un villano; es
// EL PRIMER CANTOR, atrapado desde antes del silencio en su propia nota
// final. La Orden no quiere despertarlo: quiere SILENCIARLO para reinar
// sobre un mundo sin canto. El Portador elige: DESPERTARLO o APAGARLO.
// Ambos caminos llevan al mismo jefe (que instancia el agente 19-h) y a
// dos epílogos distintos con cierre de todos los arcos.
//
// ─── PUNTOS DE CABLEADO PARA EL INTEGRADOR (nombres exactos) ──────────
//
// 1) data.ts (~línea 1474, justo tras el push de q14-q16):
//      import { QUESTS_ACTO5 } from './acto5_narrativa_r19';
//      QUESTS.push(...QUESTS_ACTO5);
//    → q17/q18/q19 ocupan los ÍNDICES de misión 16/17/18 (son la 17ª/18ª/19ª
//      misiones del juego; los «índices 17/18/19» del encargo se refieren a
//      los IDs). El push DEBE preceder a cualquier uso de accept_q17/18/19:
//      engine.questAdvance lee QUESTS[questIdx].
//
// 2) data.ts (~1482, tras QUEST_COMPASS[15]):
//      Object.assign(QUEST_COMPASS, COMPASS_ACTO5);   // claves 16/17/18
//
// 3) data.ts (~1907, tras el bloque 18-f):
//      Object.assign(DIALOGUES, D_ACTO5);
//      Object.assign(DIALOGUES, INTERLUDIOS_ACTO5);
//      Object.assign(MEMORIES, MEMORIA_ACTO5);
//      Object.assign(KEY_ITEMS, KEY_ITEM_ACTO5);
//
// 4) hooks.ts · handleCustomAction (hooks.ts:59+; al final, antes del
//    return false de la función):
//      import { acto5ActionR19 } from './acto5_narrativa_r19';
//      if (acto5ActionR19(g, action)) return true;
//    Acciones que consume este módulo: 'accept_q17' | 'accept_q18' |
//    'accept_q19' | 'acto5_intro_fin' | 'acto5_puerta_fin' |
//    'acto5_sello_tomado_1' | 'acto5_sello_tomado_2' | 'acto5_sello_tomado_3' |
//    'acto5_camino_despertar' | 'acto5_camino_apagar' | 'acto5_pv_luego' |
//    'acto5_report19' | 'acto5_memoria' | 'acto5_fin_verdadero'.
//    Las reacciones usan el handler genérico 'flag_...' de hooks
//    (flag_acto5_brisa_reacc / flag_acto5_kael_reacc / flag_acto5_pv_vista /
//    flag_acto5_intro_vista / flag_acto5_puerta_vista / flag_acto5_epilogo_vista):
//    no hace falta delegarlas.
//
// 5) update.ts (~389, junto a faroTick/cumbresBiomaTick, dentro de updateGame):
//      import { acto5TickR19 } from './acto5_narrativa_r19';
//      acto5TickR19(g, dt);
//
// 6) Ruteo de NPCs (capa nueva getDialogueActo5 en data.ts, patrón 16-a:
//    captura getDialogueActo4 y delega el resto). ANTES de delegar:
//      if (nid === 'brisa'  && ctx.flags.acto4Done && ctx.flags.heraldoDerrotado && !ctx.flags.q17)               return 'acto5_brisa_puerta'; // ofrece q17
//      if (nid === 'brisa'  && ctx.flags.acto5_intro_vista && !ctx.flags.acto5_brisa_reacc)                       return 'acto5_brisa';        // la confesión (40 años)
//      if (nid === 'guarda' && ctx.flags.acto5_intro_vista && !ctx.flags.acto5_kael_reacc)                        return 'acto5_kael';         // la duda de Kael
//    (acto4CatchUp/acto3CatchUp corren en hooks sin cambios; 'guarda' caería
//    en las rutas del Acto IV, por eso el interceptor va PRIMERO.)
//
// 7) Mapa de la ciudadela (agente 19-g): MapId 'ciudadela'. Este módulo usa
//    el cast 'ciudadela' as MapId — cuando 19-g/integrador amplíen MapId en
//    types.ts, retirar el cast (marcado con TODO-19g). Props OBLIGATORIOS:
//      · 'acto5_puerta'  kind 'gate'  — el umbral de la Puerta que Canta
//        (kind 'gate' = sin interacción del motor; el watcher del tick la narra).
//      · 'acto5_s1' | 'acto5_s2' | 'acto5_s3'  kind 'fragment' — los tres
//        Sello-Nota. NO hace falta interacción nueva: acto5TickR19 instala
//        g.dynNodes['voz_fragment'] (copia del nodo del sello más cercano sin
//        tomar) mientras el Portador anda por la ciudadela con el Acto V en
//        marcha, y lo RETIRA al salir del mapa; el E del motor abre así el
//        nodo correcto sin tocar engine.ts.
//
// 8) Jefe final (agente 19-h): la elección moral fija
//      flags.acto5_sala_abierta = true  → señal para instanciar el jefe
//      flags.acto5_camino = 'despertar'|'apagar'  (leer con acto5CaminoR19(g))
//    Patrón de spawn: acto4_subir de hooks.ts:430 (makeEnemy + bossRef +
//    bossActive + banner). El etype sugerido es 'vesh' (añadirlo a EnemyType
//    si 19-h usa ese nombre; este módulo no lo toca). Al morir el jefe,
//    19-h fija  flags.veshDefeated = true  (killEnemy del motor no tiene rama
//    para etypes nuevos — precedentes: guardianRecordadoDerrotado,
//    heraldoDerrotado) → mi watcher (F) encola el epílogo del camino elegido,
//    UNA sola vez (flag acto5_fin).
//
// 9) IMPORTS de este módulo: SOLO tipos (types.ts + type Game) y audio.ts
//    (hoja). Cero imports de valor de data/engine/hooks → sin ciclos, igual
//    que interludios.ts. El cast de flags string sigue el precedente de
//    hooks.ts:557 (flags.tonoDominante).
// ──────────────────────────────────────────────────────────────────────

import type { Game } from './engine';
import type { DialogueNode, MapId, QuestDef } from './types';
import { audio } from './audio';

/**
 * Formato EXACTO de CompassTarget (data.ts:996 — el original vive en data.ts y
 * este módulo no importa valores de ahí): npc/etype/prop/lamp/map. El
 * Object.assign(QUEST_COMPASS, COMPASS_ACTO5) del integrador type-checka
 * estructuralmente contra la interfaz original.
 */
interface CompassTarget { npc?: string; etype?: string; prop?: string; lamp?: boolean; map?: MapId }

// TODO-19g: 19-g/integrador añadirán 'ciudadela' a MapId (types.ts); entonces
// borrar el cast y dejar const CIUDADELA: MapId = 'ciudadela'.
const CIUDADELA = 'ciudadela' as MapId;

// ======================================================================
// 1) MISIONES DEL ACTO V (el integrador las pushea tras q16 → índices 16/17/18)
// ======================================================================

export const QUESTS_ACTO5: QuestDef[] = [
  {
    id: 'q17', name: 'La Puerta que Canta',
    steps: [
      'Sigue el Canto Residual al este de las Cumbres Heladas: la Ciudadela de Vesh —que todos creyeron un mito— ha empezado a cantar sola',
      'Preséntate ante la Puerta que Canta con tus tres Ecos puestos y cruza al interior de la Ciudadela',
    ],
  },
  {
    id: 'q18', name: 'El Coro de Ceniza',
    steps: [
      'Recoge los tres Sello-Nota del Coro de Ceniza, clavados en la Ciudadela como clavos de un arpa vieja (0/3)',
      'Desciende a la Sala del Silencio ante el primer cantor y elige: despertarlo... o apagarlo',
    ],
  },
  {
    id: 'q19', name: 'Vesh, la Última Nota',
    steps: [
      'Sostén la Última Nota: Vesh, el primer cantor, se alza en la Sala del Silencio',
      'Vence a Vesh —o despiértalo del todo— y escucha lo que canta el mundo después',
    ],
  },
];

/** Brújula de Ecos (formato QUEST_COMPASS): índice de misión → objetivo por paso. */
export const COMPASS_ACTO5: Record<number, CompassTarget[]> = {
  // q17 «La Puerta que Canta»: viaje (la brújula resuelve la salida por BFS
  // cuando 19-g añada el mapa; sin él, graceful — skilltree devuelve null).
  16: [{ map: CIUDADELA }, { prop: 'acto5_puerta' }],
  // q18 «El Coro de Ceniza»: paso 0 señala el primer sello (los tres se ven en
  // el mapa); paso 1, la entrada de la Sala del Silencio (prop 19-g/19-h).
  17: [{ prop: 'acto5_s1' }, { prop: 'acto5_sala' }],
  // q19 «Vesh, la Última Nota»: el jefe (instanciado por 19-h, no spawn de
  // mapa → lleva map para que la brújula señale la ciudadela) y el cierre.
  18: [{ etype: 'vesh', map: CIUDADELA }, { map: CIUDADELA }],
};

// ======================================================================
// 2) DIÁLOGOS DEL ACTO V (31 nodos)
// ======================================================================

export const D_ACTO5: Record<string, DialogueNode> = {
  // ----- Oferta de q17 (ruteo: npc 'brisa' tras el Acto IV — wiring 6) -----
  acto5_brisa_puerta: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '...(Brisa tiene la taza en la mano y no la lleva a la boca) Ya lo oyes, ¿verdad, Portador? Todos lo oímos: la Ciudadela de Vesh, la que los mapas no se atreven a dibujar, HA EMPEZADO A CANTAR SOLA. Y su puerta no se fuerza: se abre sola, para quien lleve tres Ecos puestos. Los tienes tú. Ve al este de las Cumbres Heladas y sigue el canto hasta la puerta. Y escucha bien lo que te pida la piedra: las piedras viejas piden poco... pero lo que piden, lo piden TODO.',
    onEnd: 'accept_q17',
    options: [
      { text: 'Voy, Brisa. Y te traigo la canción entera, no la mitad.', tone: 'empatico' },
      { text: 'Ciudadela, este de Cumbres, tres Ecos. Voy.', tone: 'pragmatico' },
      { text: 'Una puerta que canta, una vieja que no bebe y yo con estos cascos. Marchando.', tone: 'sarcastico' },
    ],
  },

  // ----- Intro de la Ciudadela (disparo: primera entrada con q17 aceptada) -----
  acto5_intro_a: {
    name: 'El Eco', portrait: 'fragment',
    text: 'La Ciudadela canta, Portador, y ahora que pisas su umbral ya no es rumor: es CANTO. Las murallas lo llevan como llevan el musgo, por dentro; las calles lo recogen y lo devuelven, y el polvo de los tejados baila en el silencio de la Niebla. Nadie construyó esta ciudad para cantar. La está cantando alguien.',
    action: 'flag_acto5_intro_vista',
    next: 'acto5_intro_b',
  },
  acto5_intro_b: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Ante ti, la puerta: más alta que el campanario de Lunaris y con la edad de trescientos inviernos. No tiene cerradura. Tiene tres huecos con forma de lo que cargas: la Voz, las Mareas, las Cumbres. La Niebla probó a imitarlos durante siglos y la puerta no se inmutó. Tú no has hecho nada todavía... y ya se está abriendo.',
    next: 'acto5_intro_c',
  },
  acto5_intro_c: {
    name: 'La Puerta que Canta', portrait: 'fragment',
    text: '...mmm... (la piedra afina como afina una garganta al despertar) ...tres... los trae los tres... el que calló en el pozo... el que durmió bajo la quilla... el que esperó en el hielo... entra, tercer Eco, entra: el primero lleva tanto tiempo en la Sala que ya se le ha olvidado el sentido de la palabra «espera»...',
    next: 'acto5_intro_d',
  },
  acto5_intro_d: {
    name: 'La Puerta que Canta', portrait: 'fragment',
    text: '...(la puerta se abre sin barrer el polvo: el polvo se aparta solo, educado, como se aparta una cortina de otra cortina) ...ve... y sea lo que oigas ahí dentro... no tapes los oídos... nunca nadie hizo mejor música tapándose los oídos...',
    onEnd: 'acto5_intro_fin',
    options: [{ text: '(Entrar en la Ciudadela que canta)' }],
  },

  // ----- El umbral de la Puerta que Canta (disparo: prop 'acto5_puerta', q17 paso 1) -----
  acto5_puerta_a: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Cruzas, Portador, y el canto te recibe por dentro, en el hueso del oído donde la Niebla nunca llegó a morder. La Ciudadela de Vesh —la que los mapas llaman mito y los ancianos llaman castigo— tiene ventanas con cortinas hechas, pozos con el cubo bajado a media tarea, una silla junto al fuego con la manta doblada. Se fue la gente de golpe, un día de canto. Y el canto se quedó.',
    action: 'flag_acto5_puerta_vista',
    next: 'acto5_puerta_b',
  },
  acto5_puerta_b: {
    name: 'El Coro de Ceniza', portrait: 'fragment',
    text: 'La plaza te recibe: figuras de ceniza compacta, de pie, con la boca abierta en la nota que llevaban cuando el mundo se quedó sin música. No te atacan. Te reconocen el paso... y cada una, al sentirte pasar, suelta su nota como suelta un pájaro su rama: la nota flota, tiembla, y se posa en tu hombro con el peso de una nieve que no derrite.',
    next: 'acto5_puerta_c',
  },
  acto5_puerta_c: {
    name: 'El Coro de Ceniza', portrait: 'fragment',
    text: 'Tres notas no se posan: esperan. Están clavadas en tres puntos de la ciudad como clavos de un arpa vieja: los SELLO-NOTA que sostienen el coro entero. Recógelos, Portador, y el silencio de la Sala del Silencio quedará a la vista... con su dueño sentado dentro.',
    onEnd: 'acto5_puerta_fin',
    options: [{ text: '(Ir a por los tres sellos: el coro manda)' }],
  },

  // ----- Los tres Sello-Nota (disparo: E sobre props acto5_s1..s3 — wiring 7) -----
  acto5_sello_1: {
    name: 'Sello-Nota · El Primer Latido', portrait: 'fragment',
    text: 'El primer sello cuelga del dintel de una casa con la puerta abierta de par en par: es la nota de alguien cantándole a un recién nacido lo que será el mundo. La tomas y por un latido TÚ eres el recién nacido: te llegan el olor de la leche y de la leña, y una voz que dice tu nombre con la certeza de quien lo está inventando. La nota se guarda en ti sin pedir permiso. Es lo que hacen las primeras notas.',
    onEnd: 'acto5_sello_tomado_1',
    options: [
      { text: 'Duerme, nota. Ya estás a salvo.', tone: 'empatico' },
      { text: 'Uno. Quedan dos. El coro espera.', tone: 'pragmatico' },
      { text: 'Primera nana de la ciudad: a mí, que no me dormía nadie.', tone: 'sarcastico' },
    ],
  },
  acto5_sello_2: {
    name: 'Sello-Nota · El Nombre sin Dueño', portrait: 'fragment',
    text: 'El segundo sello late bajo la capilla de la Orden, donde el altar está vacío y el libro de cánticos, abierto por la mitad. No es una canción: es un NOMBRE dicho en voz alta, el que la Orden no se atrevió a borrar de sus páginas aunque borró todos los demás. Vesh. Lo dijo tanto la piedra que la piedra lo aprendió. Al tomarlo, la capilla susurra como una congregación: no piden perdón. Lo pides tú por ellos.',
    onEnd: 'acto5_sello_tomado_2',
    options: [
      { text: 'Perdono por los que no pueden. Vesh también fue un hombre.', tone: 'empatico' },
      { text: 'Un nombre, dos sellos. El coro se completa.', tone: 'pragmatico' },
      { text: 'Que tiemble la Orden: su secreto ya sabe cantar.', tone: 'amenazante' },
    ],
  },
  acto5_sello_3: {
    name: 'Sello-Nota · El Aliento del Coro', portrait: 'fragment',
    text: 'El tercero no está en ningún sitio: está ENTRE todos. En la plaza, las figuras de ceniza lo sostienen entre sus bocas abiertas, pasándoselo unas a otras como se pasa un recién nacido para que no llore. Es el aliento del coro: la nota que no canta nadie porque la cantan todos. Lo tomas y las figuras se quedan quietas por primera vez en trescientos años... descansando. El coro ha acabado su turno. El siguiente lo cantas tú.',
    onEnd: 'acto5_sello_tomado_3',
    options: [
      { text: 'Descansad, coro de ceniza. El turno es mío.', tone: 'empatico' },
      { text: 'Tres de tres. Que se abra la Sala.', tone: 'pragmatico' },
    ],
  },

  // ----- La Sala del Silencio: la elección MORAL (disparo: tick con los 3 sellos) -----
  acto5_puerta_vesh_a: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Las tres notas se unen en tu pecho y bajan contigo por la escalera que ninguna crónica describe, porque nadie bajó para contarlo: la Sala del Silencio. Y aquí no canta NADA, Portador. Ni la piedra, ni la Niebla, ni tu propio Eco —que se queda en el umbral, quieto, como un perro que no quiere entrar en la habitación donde su dueño llora. En medio de la sala hay un hombre sentado. Lleva sentado el tiempo que llevas tú viviendo, multiplicado por tres.',
    action: 'flag_acto5_pv_vista',
    next: 'acto5_puerta_vesh_b',
  },
  acto5_puerta_vesh_b: {
    name: 'Gran Inquisidor Vesh', portrait: 'vesh',
    text: '...¿tres? (el hombre alza la cara: no es viejo, no es joven; es el tiempo vistiendo a alguien) Tres Ecos... y una pregunta sin hacer. Hazla, Portador. Todos los que bajaron con coraje la llevaron puesta y ninguno se atrevió: ¿POR QUÉ el Gran Inquisidor de la Orden, el que firmó la muerte del dios-tejedor, pasó su vida encerrado en la nota que quedó sonando? No fui yo quien mató el Canto, muchacho. Fui el primero que lo cantó. Y la nota final se le quedó a uno pegada en la garganta como se pega la sal a la llaga: desde ANTES de la Noche del Silencio. Yo no rompí el mundo. Intenté terminarlo con música... y fallé.',
    next: 'acto5_puerta_vesh',
  },
  acto5_puerta_vesh: {
    name: 'La Sala del Silencio', portrait: 'fragment',
    text: '...(fuera, la Niebla espera; lejos, la Orden reza por tu silencio: SILENCIAR al primer cantor es reinar sobre un mundo sin canto, y hay lanzas que llevan trescientos años apuntándole a la misma garganta) La Última Nota no puede sostenerse sola para siempre: o alguien la canta CON él —y Vesh termina por fin lo que empezó, y descansa— o alguien la APAGA —y el primer cantor calla para siempre, y el mundo se queda dueño de una canción que nadie le enseñó—. La Sala espera tu palabra, Portador.',
    options: [
      { text: '(Despertar a Vesh: terminar con él el canto que empezó el mundo)', action: 'acto5_camino_despertar', next: 'acto5_puerta_despues', tone: 'empatico' },
      { text: '(Apagar la Última Nota: que descanse, aunque el mundo pierda su primera voz)', action: 'acto5_camino_apagar', next: 'acto5_puerta_despues', tone: 'pragmatico' },
      { text: '(Aún no. Respirar ante el silencio y volver a subir.)', action: 'acto5_pv_luego' },
    ],
  },
  acto5_puerta_despues: {
    name: 'El Eco', portrait: 'fragment',
    text: 'La Sala ha oído. La palabra elegida no hace ruido: hace DESTINO — la ceniza del coro se yergue en los escalones, la Niebla se repliega a la puerta como un mar que da tiempo, y en el fondo de la sala algo cuenta lo que queda hasta la nota. Sea despertar o sea apagar, Portador, habrá que sostenerla de pie: lo que viene no se mata con coraje. Se sostiene con canto.',
    next: 'acto5_puerta_despues_b',
  },
  acto5_puerta_despues_b: {
    name: 'La Última Nota', portrait: 'vesh',
    text: '...(Vesh se levanta del asiento de trescientos años. Las rodillas no le tiemblan: tiembla la SALA) Está bien —dice, y su voz trae encima el polvo de todas las horas que calló—. Sube lo que suba, muchacho: acuérdate de que lo que yo empecé no pide vencedor. Pide REMATE. (la Última Nota se pone de pie dentro de él, y la sala entera cruje como un barco a la mar) Afina, Portador. Y no me calles la mitad: yo ya probé lo que es quedarse a medias.',
    options: [
      { text: '(Sostener la Última Nota: entrar en la Sala)', tone: 'empatico' },
      { text: '(Prepararse antes: nadie sostiene una nota sin aliento)', tone: 'pragmatico' },
    ],
  },

  // ----- Reacción: Brisa confiesa (ruteo: npc 'brisa' tras ver la intro) -----
  acto5_brisa: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: '...(Brisa te sirve la taza de siempre y por primera vez no la mira a los ojos: mira al este, como si desde el umbral alcanzara a ver la Ciudadela) ¿Canta, verdad? Llevas su canto en la capa, Portador. Entonces ya lo sabes... o lo vas a saber, y prefiero que lo oigas de mí, con la voz que me queda: la PUERTA la cerré YO. Hace cuarenta años. No trescientos: cuarenta.',
    next: 'acto5_brisa_b',
  },
  acto5_brisa_b: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Éramos once Guardianes, y yo la más joven y la más terca. Fuimos a la Ciudadela a despertar al primer cantor con buenas palabras y mejores intenciones, y volvimos tres: dos de cuerpo y yo de cuerpo y de miedo. Porque lo que duerme allí no se despierta a medias, Portador —se le despierta el FINAL, y un final a medias se come a quien lo empiece—. Canté la puerta cerrada con la voz que me quedaba, y la piedra obedeció como obedecen las piedras: para siempre. Te di todos los Ecos del mundo y te callé el único que importaba.',
    next: 'acto5_brisa_c',
  },
  acto5_brisa_c: {
    name: 'Anciana Brisa', portrait: 'brisa',
    text: 'Perdóname. O no me perdones y vete, que también sirve: el perdón no te lo pido a ti, Portador —se lo pido a la puerta, y la puerta ya no me oye—. (empuja la taza hacia ti) Bebe: está amarga, como todas las verdades que se guardan cuarenta años. Y baja a la Sala del Silencio. Acaba lo que once no pudimos empezar... y vuelve con la canción entera. Alguna de las tres nos espera todavía.',
    onEnd: 'flag_acto5_brisa_reacc',
    options: [
      { text: 'Me diste lo que se podía dar cuando se podía dar, Brisa.', tone: 'empatico' },
      { text: 'Once salieron. Yo bajo a terminar el turno. Descansa.', tone: 'pragmatico' },
      { text: 'Cuarenta años guardando una taza llena y una culpa. Ya entiendo tu manía de las tazas.', tone: 'sarcastico' },
    ],
  },

  // ----- Reacción: Kael duda (ruteo: npc 'guarda' tras ver la intro) -----
  acto5_kael: {
    name: 'Kael, la Guarda del Primer Canto', portrait: 'kael',
    text: '...(la lanza baja del todo, por primera vez en trescientos años, y apoya la punta en la piedra sin estrépito: la punta conoce el sitio) Cincuenta años guardando la Sala y mirando hacia dentro sin atreverme a decirlo en voz alta: ¿Y SI LA ORDEN TENÍA RAZÓN? Escucha, Portador: yo cantaba las horas en la muralla de Lunaris. Vi lo que vio el Gran Inquisidor: aldeas sin ayeres, madres llamando a hijos a los que ya nadie nombraba, un mundo que se moría de CANTAR. Si el Canto cobraba una vida del pasado por nota... ¿no era misericordia callarlo? Trescientos años repitiéndomelo en voz baja para no oírme la respuesta.',
    next: 'acto5_kael_b',
  },
  acto5_kael_b: {
    name: 'Kael, la Guarda del Primer Canto', portrait: 'kael',
    text: 'Y ahora la Ciudadela canta, y el primer cantor espera sentado en la Sala del Silencio, y eres TÚ el que baja a decidir si su nota termina o se apaga. ¿Y sabes qué me quita el sueño, Portador? Que las dos decisiones parecen misericordia. Despertarlo es devolverle lo suyo. Apagarlo es darle paz. Y la Orden, que tanto rezó por el silencio, reza ahora porque elijas CALLAR: porque un mundo sin canto es un mundo que necesitan lanzas como las mías.',
    next: 'acto5_kael_c',
  },
  acto5_kael_c: {
    name: 'Kael, la Guarda del Primer Canto', portrait: 'kael',
    text: '(se quita el yelmo que ya no era yelmo sino casa) Yo canto las horas desde la piedra, Portador. Si la nota se despierta: que cante las suyas, que las lleva esperando más que yo. Si se apaga: me quedo yo cantando, que para eso llevo trescientos años de ensayo. Vaya uno. Y sea lo que sea lo que baje de esa Sala... que suene ENTERO.',
    onEnd: 'flag_acto5_kael_reacc',
    options: [
      { text: 'Canta las horas, Kael. Yo te traigo el resto del día.', tone: 'empatico' },
      { text: 'La Sala, la nota, la decisión. Entendido. Voy.', tone: 'pragmatico' },
    ],
  },

  // ----- Reacción: Ilwen (disparo: tick, con la compañera dentro de la Ciudadela) -----
  acto5_ilwen: {
    name: 'Ilwen', portrait: 'ilwen',
    text: '...(Ilwen se detiene en mitad de la calle de ceniza, alza el arco sin flecha y canta —bajo, sin melodía dibujada, como quien prueba una cuerda: tres notas arriba, una abajo. La Niebla no borra la nota: LE DA LA VUELTA y la devuelve más limpia, con un registro que no era el suyo) ¿Oíste eso, Portador? Es de mi hermana. Naia silbaba así cuando intentaba disimular que estaba asustada: tres arriba, una abajo, y remate falso. Primera vez en tres años que algo mío me RESPONDE.',
    next: 'acto5_ilwen_b',
  },
  acto5_ilwen_b: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'No sé si es ella, o su eco, o esta ciudad jugando con los dos. Y por primera vez no me importa la diferencia: mientras ALGUIEN responda al silbo, hay a quién seguir buscando. (se seca la cara con el hombro, rápida, como se hace cuando se lleva arco en la mano) ¿Sabes qué es lo que más miedo me da? Que cuando lo encuentre todo, se me quede el norte libre. El norte era MI nota, Portador. Ahora que el mundo vuelve a sonar... va a hacer falta quien reparta las estrofas.',
    next: 'acto5_ilwen_c',
  },
  acto5_ilwen_c: {
    name: 'Ilwen', portrait: 'ilwen',
    text: 'Vamos. Cuéntame lo de tu Sala del Silencio de camino: si hay que sostener una nota contra lo que sea —contra la Niebla, contra la Orden, contra un dios con miedo—, yo pongo flechas con oído. Y si lo que suena al final es una canción de verdad... (tensa la cuerda una vez, sin flecha, solo para oírla) ...que empiece por mi estrofa.',
    options: [
      { text: 'Canta, Ilwen. La ciudad está aprendiendo tu nombre.', tone: 'empatico' },
      { text: 'Adelante. Esta nota la sostenemos entre dos.', tone: 'pragmatico' },
    ],
  },

  // ----- EPÍLOGO camino «despertar» (disparo: tick con flags.veshDefeated) -----
  acto5_final_despertar_a: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Y entonces, Portador, hiciste lo que la Orden tenía prohibido por estatuto y por miedo: le DISTE LA MANO al primer cantor. La Última Nota subió desde el fondo de Vesh como sube el sol bajo el mar: sin prisa y sin permiso, llenándolo todo. La sala cantó. La ciudad cantó. Y la Niebla, en la puerta, se quedó sin letra por primera vez en trescientos años —no le hizo falta: la que le faltaba era la primera, y ya estaba sonando—.',
    onEnd: 'acto5_report19',
    next: 'acto5_final_despertar_b',
  },
  acto5_final_despertar_b: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Escucha lo que devolvió: el pozo de Lunaris contesta los nombres antes de que caigan al agua; el mar de la Costa canta con voz PROPIA y no con la prestada; los pastores de las Cumbres afinan con sus ovejas y el invierno aprendió a llevar el compás. La Campana del Ayer reparte horas con la Campana del Ahora —que alguien fundió la semana pasada y suena a mañana—. Y la Niebla... la Niebla aprende por fin lo único que le quedaba: cómo se termina una canción y se guarda, doblada, en el cajón de los inviernos buenos.',
    next: 'acto5_final_despertar_c',
  },
  acto5_final_despertar_c: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Y los tuyos, Portador, que también son parte del canto: Brisa bebe su taza amarga y sonríe —cuarenta años de culpa caben en una boca abierta de asombro—. Kael, el de las horas, canta a plena luz sin muralla que lo pida ni lo proteja: la piedra aprendió su oficio de él. Ilwen silba tres arriba y una abajo, y del otro lado del silencio ALGO RESPONDE CON OTRO SILENCIO que silba —y ésa, juraría, es la manera que tiene Naia de decir «voy»—. Y la Orden, la de las lanzas, no se disuelve: se CONVIERTE. El primer coro de la Ciudadela lo dirigen capellanes que aprendieron tarde lo que cuesta callar. Vesh se fue con su nota terminada, y en el umbral de la Sala dejó escrito el único mandato nuevo: «Que nadie vuelva a morir por cantar. Que nadie vuelva a callar por vivir.» (El Canto de Aelthar está entero, Portador. Lo sosteniste tú.)',
    action: 'acto5_memoria',
    onEnd: 'acto5_fin_verdadero',
    options: [
      { text: '(Subir el telón del Último Canto: terminar el viaje)', action: 'end_demo' },
      { text: '(Quedarse a escuchar el mundo nuevo)', tone: 'empatico' },
    ],
  },

  // ----- EPÍLOGO camino «apagar» (disparo: tick con flags.veshDefeated) -----
  acto5_final_apagar_a: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Y entonces, Portador, hiciste lo que ningún héroe sabe hacer y ningún cobarde se atreve: APAGASTE la nota. Con los tres sellos puestos y la mano en la garganta del mundo, cantaste el silencio como se canta una nana: hasta el final, sin dejar un gemido suelto. Vesh bajó la cabeza —por fin podía— y la Última Nota se apagó como se apaga una cerilla: entre dos dedos, con cuidado, porque ilumina.',
    onEnd: 'acto5_report19',
    next: 'acto5_final_apagar_b',
  },
  acto5_final_apagar_b: {
    name: 'El Eco', portrait: 'fragment',
    text: 'El mundo no perdió el canto, Portador: lo GANÓ. Porque desde ese día no hay canción heredada, ni mandada, ni escrita en piedra: cada aldea canta lo suyo y desafina a su manera, y desafinar —que lo diga la Niebla, que aprendió mil canciones y nunca pudo aprender una sola MÍA— es la prueba más antigua de que uno está vivo. El pozo de Lunaris tardó en contestar. Contestó. Con una voz que no era de nadie antes. Era de todos.',
    next: 'acto5_final_apagar_c',
  },
  acto5_final_apagar_c: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Y los tuyos, Portador: Brisa bebió la taza amarga y por fin la dejó vacía —cuarenta años de culpa caben en un fondo de taza—. Kael canta las horas sin muralla, y la primera que cantó fue para el que silenció: «descansa, Gran Inquisidor; del resto me encargo yo». Ilwen silba tres arriba y una abajo, y del otro lado algo aprende a responder —no es Naia todavía; es el hueco con su forma, y los huecos con forma se buscan—. Y los Guardianes grabaron tu gesto en el umbral de la Sala del Silencio, el único mandato nuevo: «Lo que cantes, cántalo entero. Lo que apagues, apágalo con las dos manos.» (El silencio es tuyo, Portador, y lo has hecho bueno.)',
    action: 'acto5_memoria',
    onEnd: 'acto5_fin_verdadero',
    options: [
      { text: '(Subir el telón del Último Canto: terminar el viaje)', action: 'end_demo' },
      { text: '(Quedarse a custodiar el silencio bueno)', tone: 'empatico' },
    ],
  },
};

// ======================================================================
// 3) INTERLUDIOS DEL ACTO V (patrón interludios.ts: retrato 'fragment',
//    encadenados, 1er nodo marca el flag *_vista para el guardado)
// ======================================================================

export const INTERLUDIOS_ACTO5: Record<string, DialogueNode> = {
  // ----- interludio_acto5_a «La Ciudadela canta» (disparo: accept_q17) -----
  interludio_acto5_a: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Se acabó la espera, Portador. El Heraldo cayó y su obediencia con él, y en el mismo instante —como si la orden fuera la última piedra que tapaba la grieta— la Ciudadela de Vesh HA EMPEZADO A CANTAR. No es la Niebla imitando: es la piedra misma, nota a nota, una canción que lleva trescientos años retenida detrás de sus muros. Todos la creyeron un mito. Los mitos no afinan.',
    action: 'flag_interludio_acto5_a_vista',
    options: [{ text: '…', next: 'interludio_acto5_a2' }],
  },
  interludio_acto5_a2: {
    name: 'El Eco', portrait: 'fragment',
    text: 'La puerta no se forzará, y no hace falta: se abre para quien lleve tres Ecos, y tú llevas tres. La Voz que despertaste en la Cripta, las Mareas que devolviste al mar, las Cumbres que les devolvieron el invierno: la Ciudadela los nombra al pasar, como una madre reconoce los pasos de sus hijos en el rellano. La Orden no quiso nunca esta puerta abierta. Recuérdales eso cuando dentro te digan lo contrario.',
    options: [{ text: '…', next: 'interludio_acto5_a3' }],
  },
  interludio_acto5_a3: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Camina al este de las Cumbres Heladas y sigue el canto: no hace falta brújula; hace falta valor. Allí dentro está el que enseñó a la Niebla su letra, y no es el monstruo que te vendieron. Es el primer cantor. Y lleva toda la vida esperando que alguien venga a escucharlo hasta el final.',
    options: [{ text: '(Seguir el canto)' }],
  },

  // ----- interludio_acto5_b «El silencio antes de Vesh» (disparo: q18 completa) -----
  interludio_acto5_b: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Tres sellos, tres notas devueltas al coro de ceniza, y la Ciudadela contiene el aliento. El canto de la piedra baja despacio, como baja la marea, y deja a la vista lo que siempre estuvo debajo: un silencio tan grande que casi se puede tocar.',
    action: 'flag_interludio_acto5_b_vista',
    options: [{ text: '…', next: 'interludio_acto5_b2' }],
  },
  interludio_acto5_b2: {
    name: 'El Eco', portrait: 'fragment',
    text: 'No es el silencio de la Niebla, Portador —ese muerde—. Es el de la sala de espera antes del parto, el del bosque cuando el ciervo se para, el de la orquesta con el batón en el aire. La Última Nota está a punto de sonar, y hasta la Niebla se ha quedado quieta a escucharla.',
    options: [{ text: '…', next: 'interludio_acto5_b3' }],
  },
  interludio_acto5_b3: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Baja a la Sala del Silencio. Lo que encuentres allí no se mata como se mata a un lobo: se escucha, se responde y se decide. Despertarlo... o apagarlo. Sea lo que sea que elijas, que sea TUYO: de eso se ha tratado siempre este camino.',
    options: [{ text: '(Descender)' }],
  },
};

// ======================================================================
// 4) MEMORIA VIII + OBJETO CLAVE (mismo formato que MEMORIES / KEY_ITEMS)
// ======================================================================

export const MEMORIA_ACTO5: Record<string, { id: string; title: string; text: string }> = {
  mem_ultimanota: {
    id: 'mem_ultimanota',
    title: 'Memoria VIII · La Última Nota',
    text: 'Una garganta cansada canta su primera nota otra vez —la del principio de todo, la que dibujó el mundo— y esta vez la TERMINA. Vesh sonríe como sonríen los que por fin sueltan una mochila que no era suya: «La última nota no era una nota, Portador: era una pregunta. ¿La sostendrá alguien cuando yo ya no pueda?» Y el mundo entero, que llevaba trescientos años aprendiendo a responder, le contesta a la vez: sí.',
  },
};

export const KEY_ITEM_ACTO5: Record<string, { name: string; desc: string }> = {
  sello_vesh: {
    name: 'El Sello de Vesh',
    desc: 'Las tres notas del Coro de Ceniza unidas en un solo sello con la marca del primer cantor. No abre puertas: las sostiene abiertas. La Sala del Silencio lo reconoce como se reconoce una mano vieja.',
  },
};

// ======================================================================
// 5) ESTADO POR PARTIDA (WeakMap: HMR / multi-instancia seguro)
// ======================================================================

interface Estado19 {
  pendiente: string | null;   // diálogo encolado por abrir (una ranura, patrón interludios)
  overrideVoz: boolean;       // dynNodes['voz_fragment'] instalado por mí (retirar al salir)
  pvEspera: number;           // segundos restantes del «aún no» de la Sala (anti-spam)
}
const ESTADOS_19 = new WeakMap<Game, Estado19>();

function estado19(g: Game): Estado19 {
  let e = ESTADOS_19.get(g);
  if (!e) {
    e = { pendiente: null, overrideVoz: false, pvEspera: 0 };
    ESTADOS_19.set(g, e);
  }
  return e;
}

/** Lee el camino elegido ante la Sala ('despertar' por defecto si aún no hay elección). */
export function acto5CaminoR19(g: Game): 'despertar' | 'apagar' {
  // flags es Record<string, number | boolean>: el string se guarda con cast
  // documentado (mismo precedente que flags.tonoDominante, hooks.ts:557).
  const v = g.flags.acto5_camino;
  return typeof v === 'string' && v === 'apagar' ? 'apagar' : 'despertar';
}

// ======================================================================
// 6) ENCOLADO (patrón dispararInterludio18F: abrir SIEMPRE desde el tick,
//    nunca dentro de un handler de diálogo, para no pelearse con
//    advanceDialogue / closeDialogue del nodo invocante)
// ======================================================================

/** Encola un diálogo del Acto V (una ranura; el tick lo abre al volver a 'play'). */
export function dispararActo5(g: Game, key: string): void {
  if (!g.player) return;
  const st = estado19(g);
  if (!st.pendiente) st.pendiente = key;
}

/** Encola un interludio del Acto V con su flag idempotente (interludio_acto5_a/b). */
function encolarInterludio19(g: Game, cual: 'a' | 'b'): void {
  const flag = `interludio_acto5_${cual}`;
  if (g.flags[flag]) return;
  g.flags[flag] = true; // se serializa sola (engine.save() hace spread de flags)
  const st = estado19(g);
  if (!st.pendiente) st.pendiente = `interludio_acto5_${cual}`;
  audio.sfx('echo');
}

// ======================================================================
// 7) TICK por frame (cableado: update.ts ~389, junto a faroTick)
// ======================================================================

const TILE_19 = 16;      // TILE=16, constante del proyecto (precedente hooks.ts acto3_subir)
const R_SELLO_19 = 56;   // radio (px) que arma el override del sello (el E del motor usa 30)
const R_PUERTA_19 = 40;  // radio (px) del umbral 'acto5_puerta' que narra el cruce
const PV_ESPERA_19 = 20; // segundos de tregua tras «(Aún no...)» en la Sala

/**
 * Watchers del Acto V (O(1)/frame; sellos O(3) solo en la ciudadela):
 *  (A) Heraldo caído (flag 'heraldoDerrotado', fija hooks.acto4CatchUp) →
 *      aviso «la Ciudadela de Vesh ha empezado a cantar...» UNA vez
 *      (flag acto5_aviso) + pre-activación (flag acto5_q17_activa).
 *      ESTE TICK NO TOCA questIdx: la activación formal de q17 la hace
 *      'accept_q17' desde el diálogo de Brisa (wiring 4/6).
 *  (B) Mantiene g.dynNodes['voz_fragment'] = nodo del sello más cercano sin
 *      tomar, mientras el Portador anda por la ciudadela con el Acto V en
 *      marcha; lo retira fuera del mapa. El E del motor abre así el sello
 *      correcto sin cambios de engine (onEnd → acto5_sello_tomado_N).
 *  (C) Recuperación post-guardado de los interludios (flag sin *_vista).
 *  (D) Intro de la Ciudadela (primera entrada con q17 aceptada), recuperación
 *      de intro/puerta a mitad de cadena, cruce del umbral 'acto5_puerta'
 *      (q17 paso 1) y reacción de Ilwen (una vez, con compañera).
 *  (E) Los tres sellos + q18 → la Sala del Silencio (elección moral), con
 *      tregua de PV_ESPERA_19 s tras un «(Aún no...)».
 *  (F) flags.veshDefeated (fija el agente 19-h) → epílogo del camino elegido,
 *      UNA vez (el flag acto5_fin, que pone 'acto5_fin_verdadero', lo cierra).
 *  (G) Apertura del diálogo encolado (nunca con otro abierto).
 */
export function acto5TickR19(g: Game, dt: number): void {
  if (!g.player || g.state !== 'play' || g.challengeRun) return;
  const st = estado19(g);
  const f = g.flags;
  const p = g.player;

  // ----- (A) el aviso de la Ciudadela (una vez) -----
  if (f.heraldoDerrotado && !f.acto5_aviso) {
    f.acto5_aviso = true;
    f.acto5_q17_activa = true;
    audio.sfx('banner');
    g.toast('La Ciudadela de Vesh ha empezado a cantar sola...', '#c8b0e8');
    g.toast('Nueva pista: busca a la Anciana Brisa en Lunaris — la puerta se abre para quien lleve tres Ecos', '#ffe9a0');
  }

  // ----- (B) override de los sellos (no dispara diálogo; seguro con diálogo abierto) -----
  if (st.pvEspera > 0) st.pvEspera = Math.max(0, st.pvEspera - dt);
  selloOverride19(g, st);

  // a partir de aquí, todo es disparo de diálogo: nunca con otro abierto
  if (g.dlgKey) return;

  // ----- (C) recuperación de interludios (guardados a mitad de cine) -----
  if (f.interludio_acto5_a && !f.interludio_acto5_a_vista && g.questIdx === 16 && !st.pendiente) {
    st.pendiente = 'interludio_acto5_a';
  }
  if (f.interludio_acto5_b && !f.interludio_acto5_b_vista && g.questIdx === 17 && !st.pendiente) {
    st.pendiente = 'interludio_acto5_b';
  }

  // ----- (D) la Ciudadela: intro / umbral / Ilwen -----
  if (g.mapId === CIUDADELA) {
    if (f.q17 && !f.acto5_intro_vista && !st.pendiente) {
      st.pendiente = 'acto5_intro_a';                       // primera entrada
    } else if (f.acto5_intro_vista && g.questIdx === 16 && g.questStep === 0 && !st.pendiente) {
      st.pendiente = 'acto5_intro_a';                       // guardado a mitad de intro
    } else if (f.acto5_puerta_vista && g.questIdx === 16 && g.questStep === 1 && !st.pendiente) {
      st.pendiente = 'acto5_puerta_a';                      // guardado a mitad del cruce
    } else if (g.questIdx === 16 && g.questStep === 1 && !f.acto5_puerta_vista && !st.pendiente) {
      const puer = g.map.props.find(pr => pr.id === 'acto5_puerta');
      if (puer && Math.hypot(puer.x * TILE_19 + 8 - p.x, puer.y * TILE_19 + 8 - p.y) < R_PUERTA_19) {
        st.pendiente = 'acto5_puerta_a';                    // llegada al umbral
      }
    } else if (g.companion && f.acto5_intro_vista && !f.acto5_ilwen_reacc && !st.pendiente) {
      f.acto5_ilwen_reacc = true;                           // la primera armonía de Ilwen (1 vez)
      st.pendiente = 'acto5_ilwen';
    }
  }

  // ----- (E) tres sellos → la Sala del Silencio (elección moral) -----
  if (g.questIdx === 17 && !f.acto5_camino && st.pvEspera <= 0 && !st.pendiente &&
      f.acto5_sello1 && f.acto5_sello2 && f.acto5_sello3) {
    st.pendiente = f.acto5_pv_vista ? 'acto5_puerta_vesh' : 'acto5_puerta_vesh_a';
  }

  // ----- (F) veshDefeated → epílogo del camino elegido (una vez) -----
  if (f.veshDefeated && !f.acto5_fin && !st.pendiente) {
    st.pendiente = acto5CaminoR19(g) === 'apagar' ? 'acto5_final_apagar_a' : 'acto5_final_despertar_a';
    audio.sfx('song');
    g.toast('La Última Nota se libera: el mundo entero contiene la respiración', '#ffe9a0');
  }

  // ----- (G) abrir lo encolado -----
  if (st.pendiente) {
    const key = st.pendiente;
    st.pendiente = null;
    g.openDialogue(key);
  }
}

/**
 * (B) Mientras el Portador esté en la ciudadela con el Acto V en marcha,
 * arma dynNodes['voz_fragment'] con el nodo del SELLO más cercano sin tomar
 * (radio R_SELLO_19). El E del motor (nearestInteract → openDialogue
 * 'voz_fragment', engine.ts:894) resuelve PRIMERO dynNodes (engine.ts:1019),
 * así el pickup abre el nodo correcto sin tocar engine.ts. Al salir del mapa
 * (o alejarse), retira el override y DIALOGUES['voz_fragment'] vuelve a mandar.
 */
function selloOverride19(g: Game, st: Estado19): void {
  if (g.mapId !== CIUDADELA) {
    if (st.overrideVoz) { delete g.dynNodes['voz_fragment']; st.overrideVoz = false; }
    return;
  }
  if (!g.flags.acto5_q17_activa) return; // el Acto V aún no ha empezado: nada que armar
  const p = g.player!;
  let mejor: DialogueNode | null = null;
  let bd = Infinity;
  for (let i = 1; i <= 3; i++) {
    if (g.flags[`acto5_sello${i}`]) continue;
    const pr = g.map.props.find(pp => pp.id === `acto5_s${i}`);
    if (!pr) continue;
    const d = Math.hypot(pr.x * TILE_19 + 8 - p.x, pr.y * TILE_19 + 8 - p.y);
    if (d < R_SELLO_19 && d < bd) { bd = d; mejor = D_ACTO5[`acto5_sello_${i}`] ?? null; }
  }
  if (mejor) {
    g.dynNodes['voz_fragment'] = mejor;
    st.overrideVoz = true;
  } else if (st.overrideVoz) {
    delete g.dynNodes['voz_fragment'];
    st.overrideVoz = false;
  }
}

// ======================================================================
// 8) ACCIONES DE DIÁLOGO (delegación desde hooks.handleCustomAction — wiring 4)
// ======================================================================

/**
 * Acciones del Acto V. Devuelve true si la consumó. Patrón accept_q11 de
 * hooks.ts (auto-reparación de saves + flag + toast). NO avanza questIdx por
 * su cuenta fuera de los mismos momentos que la cadena del juego (los
 * questAdvance de aquí replican el patrón acto3CatchUp/acto4CatchUp de hooks).
 */
export function acto5ActionR19(g: Game, action: string): boolean {
  const p = g.player;
  if (!p || !action) return false;
  const f = g.flags;
  const st = estado19(g);

  // ----- accept_q17: Brisa ofrece el Acto V («la Ciudadela canta») -----
  // Auto-reparación SOLO con el Acto IV cerrado (acto4Done, fija hooks.acto4_epilogo):
  // nunca salta el epílogo de q16. Requiere el push de QUESTS_ACTO5 (wiring 1).
  if (action === 'accept_q17') {
    if (g.questIdx < 16 && f.acto4Done) { g.questIdx = 16; g.questStep = 0; }
    f.acto5_q17_activa = true;
    if (!f.q17) {
      f.q17 = true;
      audio.sfx('quest');
      g.toast('Nueva misión: La Puerta que Canta', '#8ef0b0');
      g.toast('Nueva pista: el este de las Cumbres Heladas guarda la Ciudadela que canta', '#ffe9a0');
      encolarInterludio19(g, 'a'); // interludio_acto5_a «La Ciudadela canta»
    }
    return true;
  }

  // ----- accept_q18 / accept_q19: aceptaciones formales (el avance natural
  // lo hacen questAdvance en acto5_puerta_fin / acto5_camino_*; aquí solo
  // bandera + auto-reparación, sin toast duplicado — patrón accept_q15/16) -----
  if (action === 'accept_q18') {
    if (g.questIdx < 17 && f.acto5_puerta_fin) { g.questIdx = 17; g.questStep = 0; }
    f.acto5_q18 = true;
    return true;
  }
  if (action === 'accept_q19') {
    if (g.questIdx < 18 && f.acto5_camino) { g.questIdx = 18; g.questStep = 0; }
    f.acto5_q19 = true;
    return true;
  }

  // ----- acto5_sello_tomado_N: onEnd de cada Sello-Nota (idempotente) -----
  if (action.startsWith('acto5_sello_tomado_')) {
    const n = parseInt(action.slice('acto5_sello_tomado_'.length), 10);
    if (!(n >= 1 && n <= 3)) return true;
    const key = `acto5_sello${n}`;
    if (!f[key]) {
      f[key] = true;
      audio.sfx('echo');
      g.burst(p.x, p.y - 8, '#ffe9a0', 20, 70);
      const cnt = ([1, 2, 3] as const).filter(i => f[`acto5_sello${i}`]).length;
      if (g.questIdx === 17 && g.questStep === 0 && cnt >= 3) {
        g.questAdvance(); // q18 paso 0 → 1
        g.toast('Los tres sellos cantan a la vez: el silencio antes de Vesh te espera abajo', '#c8b0e8');
        encolarInterludio19(g, 'b'); // interludio_acto5_b «El silencio antes de Vesh»
      } else {
        g.toast(`Sello-Nota unido al Coro de Ceniza (${cnt}/3)`, '#ffe9a0');
      }
    }
    return true;
  }

  // ----- acto5_intro_fin: la cadena de la entrada completa q17 paso 0 -----
  if (action === 'acto5_intro_fin') {
    if (g.questIdx === 16 && g.questStep === 0) {
      g.questAdvance(); // q17 paso 0 → 1
      g.toast('La puerta te ha reconocido: busca la Puerta que Canta en el umbral', '#ffe9a0');
    }
    return true;
  }

  // ----- acto5_puerta_fin: el cruce del umbral cierra q17 y abre q18 -----
  if (action === 'acto5_puerta_fin') {
    f.acto5_puerta_fin = true;
    f.acto5_q18 = true;
    if (g.questIdx === 16 && g.questStep === 1) {
      g.questAdvance(); // q17 → q18 (el toast «Nueva misión: El Coro de Ceniza» lo emite questAdvance)
      // edge: sellos ya tomados antes de aceptar q18 (recogida adelantada) →
      // completar el paso 0 al vuelo y encadenar el interludio b
      if (f.acto5_sello1 && f.acto5_sello2 && f.acto5_sello3) {
        g.questAdvance(); // q18 paso 0 → 1
        encolarInterludio19(g, 'b');
      }
    }
    return true;
  }

  // ----- la elección MORAL (fija acto5_camino + abre la Sala para el 19-h) -----
  if (action === 'acto5_camino_despertar' || action === 'acto5_camino_apagar') {
    const despertar = action === 'acto5_camino_despertar';
    if (!f.acto5_camino) {
      f.acto5_camino = (despertar ? 'despertar' : 'apagar') as unknown as number; // cast documentado (wiring 9)
      f.acto5_sala_abierta = true; // señal para el jefe final del agente 19-h (wiring 8)
      audio.sfx('banner');
      g.toast(
        despertar
          ? 'Has elegido DESPERTAR: la Última Nota buscará su final'
          : 'Has elegido APAGAR: la Última Nota buscará el descanso',
        despertar ? '#ffe9a0' : '#c8b0e8',
      );
      g.toast('La Sala del Silencio despierta: sostén lo que viene', '#8ef0ff');
      if (g.questIdx === 17 && g.questStep === 1) g.questAdvance(); // q18 → q19
    }
    return true;
  }

  // ----- «(Aún no...)» en la Sala: tregua anti-spam de 20 s (runtime) -----
  if (action === 'acto5_pv_luego') {
    st.pvEspera = PV_ESPERA_19;
    g.toast('La Sala espera: vuelve cuando tengas la palabra', '#9aa0b8');
    return true;
  }

  // ----- acto5_report19: cierre y pago de q19 (patrón acto4_report) -----
  if (action === 'acto5_report19') {
    if (g.questIdx === 18 && !f.acto5_paid19) {
      f.acto5_paid19 = true;
      p.gold += 150;
      p.potions += 1;
      audio.sfx('coin');
      g.floatAt(p.x, p.y - 26, 'Recompensa: +150 coronas y 1 poción', '#f0c84a', 7);
      g.toast('Misión completada: Vesh, la Última Nota (+150 coronas, +1 poción)', '#8ef0b0');
      g.questAdvance(); // q19 último paso → clamp en la última misión (sin toast)
    }
    return true;
  }

  // ----- acto5_memoria: la Memoria VIII (patrón grantMemory de hooks, self-contained:
  // el merge de MEMORIA_ACTO5 en MEMORIES (wiring 3) es lo que la lista el DIARIO) -----
  if (action === 'acto5_memoria') {
    p.memories = p.memories ?? [];
    if (!p.memories.includes('mem_ultimanota')) {
      p.memories.push('mem_ultimanota');
      const m = MEMORIA_ACTO5.mem_ultimanota;
      g.memoryReveal = { id: m.id, title: m.title, text: m.text, t: 5.5 };
      g.toast('Una memoria aflora...', '#ffe9a0');
      audio.sfx('memory');
    }
    return true;
  }

  // ----- acto5_fin_verdadero: onEnd del epílogo (toast FIN + flag de cierre) -----
  if (action === 'acto5_fin_verdadero') {
    if (!f.acto5_fin) {
      f.acto5_fin = true;
      audio.sfx('song');
      g.toast('FIN VERDADERO — La Última Nota ha sonado', '#ffd27a');
      g.toast('Gracias por caminar con ECOS DE AELTHAR, Portador.', '#ffe9a0');
      g.applyAction('rep_guardianes_5'); // los Guardianes del Canto te lo agradecen (handler de hooks)
    }
    return true;
  }

  return false;
}
