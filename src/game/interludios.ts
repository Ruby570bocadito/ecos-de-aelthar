// ============================================================
// ECOS DE AELTHAR — 18-f (historia-transiciones)
// INTERLUDIOS DE ACTO + BARRERA NARRATIVA DE LOS ALTARES DEL ECO
// ============================================================
// PROPIETARIO del módulo: agente 18-f (también propietario de data.ts,
// hooks.ts y screens.ts). NO toca engine.ts / update.ts / render.ts /
// maps* / sprites* / interaccion.ts.
//
// QUÉ RESUELVE (petición del usuario):
//   · «la historia avanza de repente de una parte a otra» → cinemática de
//     transición (interludio) al abrir cada acto, REUTILIZANDO el sistema
//     de diálogo existente (cero cambios de engine): 3 nodos encadenados
//     con retrato 'fragment', opciones mínimas ('…' / '(Seguir)') y, como
//     coda, 2 nodos de reacción de Brisa y Toln definidos en data.ts.
//   · «el ALTAR DEL ECO se puede coger e irse sin vencer al jefe» →
//     watcher por frame: al acercarse a ≤4 tiles de un altar con su jefe
//     de custodia VIVO, el jefe entra en aggro (campo público Enemy.aggro,
//     types.ts:118 — el mismo campo que update.ts lee para 'patrulla' →
//     'persigue' y que los cerebros de enemies_expansion respetan) +
//     toast dramático + sfx 'banner' (el mismo que usa el despertar del
//     Guardián en update.ts:716) + cooldown de 8 s anti-spam.
//
// DISPAROS EXACTOS de los interludios (verificados leyendo el fuente):
//   · Acto I→II: la acción 'accept_q6' la gestiona ENGINE.applyAction
//     (engine.ts:1087, case 'accept_q6' — engine es congelado), que fija
//     flags.q6. El disparo real de MI interludio es el watcher por ESTADO
//     de interludioTick18 (flags.q6 && questIdx===5 && !flag interludio).
//     hooks.accept_q6 también llama a dispararInterludio18(g, 2) por si el
//     integrador algún día enruta la acción por hooks (hoy es código muerto:
//     engine.applyAction la consume en su switch antes del fallback).
//   · Acto II→III: hooks.accept_q11 (hooks.ts, handler VIVO) →
//     dispararInterludio18(g, 3). Watcher de respaldo por estado.
//   · Acto III→IV: hooks.accept_q14 (hooks.ts, handler VIVO) →
//     dispararInterludio18(g, 4). Watcher de respaldo por estado.
//   Los watchers usan questIdx===5/10/13 para que saves antiguos a mitad de
//   acto no «recuperen» el interludio fuera de sitio; el flag interludio_*
//   hace el disparo IDEMPOTENTE (una sola vez por partida; se serializa solo:
//   engine.save() hace spread de flags, engine.ts:463).
//
// ENCADENADO (cómo se navega): motor existente, sin cambios —
//   advanceDialogue (engine.ts:1039): nodo con options → opt.next abre el
//   siguiente; opción sin next cierra el diálogo (closeDialogue) y devuelve
//   al juego. Nodos registrados en INTERLUDIOS (export) y volcados en
//   DIALOGUES por data.ts con Object.assign (data.ts, bloque 18-f) →
//   openDialogue los resuelve por dynNodes ?? DIALOGUES (engine.ts:1019).
//   Cadena: interludio_actoN_a → _b → _c → r18_reacc_actoN_brisa (data.ts)
//   → r18_reacc_actoN_toln (data.ts, opción final sin next → cierre).
//   El 1er nodo marca flags.interludio_actoN_vista (acción 'flag_...' de
//   hooks) para la recuperación post-guardado (ver abajo).
//
// CABLEADO EXTERNO PARA EL INTEGRADOR (ÚNICO punto en ficheros ajenos):
//   Hoy interludioTick18(g) se llama desde screens.ts (MÍO) dentro de
//   drawScreens, case 'play' (screens.ts es llamada cada frame por
//   render.ts:54). Si el integrador prefiere el tick en LÓGICA en vez de en
//   el camino de dibujo, el punto EXACTO es update.ts, función updateGame,
//   línea ~384 (justo tras `interaccionTick(g, dt);`):
//       import { interludioTick18 } from './interludios';
//       ...
//       interludioTick18(g); // 18-f: interludios + barrera de altares
//   ...y entonces RETIRAR la llamada de screens.ts (drawScreens, case
//   'play'). El banner de acto (bannerActo18) debe seguir dibujándose en
//   screens (es presentación). No hay ningún otro punto pendiente: hooks.ts
//   y data.ts ya están cableados por mí.
//
// RIESGO DE CICLOS: cero. interludios.ts solo importa TIPOS de engine
// (import type, se borra en runtime) y el audio existente. TILE se usa como
// literal 16 con comentario (precedente: hooks.ts acto3_subir, «TILE=16,
// constante del proyecto») para no crear arista de valor engine→hooks→
// interludios→engine.
// ============================================================

import type { Game } from './engine';
import type { DialogueNode } from './types';
import { audio } from './audio';

// ---------------- Contenido: los 3 interludios (3 nodos por acto) ----------------

export const INTERLUDIOS: Record<string, DialogueNode> = {
  // ----- Interludio Acto I → II «Las Notas Perdidas» (disparo: flags.q6) -----
  interludio_acto2_a: {
    name: 'El Eco', portrait: 'fragment',
    text: 'El valle se queda atrás, Portador, y por primera vez desde que despertaste el silencio pesa menos. El Eco de la Voz duerme en ti como una brasa bajo la ceniza: todavía no canta, pero calienta. La Niebla Muda, que todo lo borra, se abre a tu paso como si reconociera al mensajero del dios que asesinaron.',
    action: 'flag_interludio_acto2_vista', // marca la cinemática como vista (recuperación post-guardado)
    options: [{ text: '…', next: 'interludio_acto2_b' }],
  },
  interludio_acto2_b: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Trescientos años lleva el mundo esperando esta caminata. La Noche del Silencio partió el canto de Aelthar en siete Ecos, y cada Eco que despiertas devuelve un trozo de ayer a un mundo que lo olvida todo: nombres, canciones, el rostro de la madre. La Orden de Vesh creyó que matando al tejedor mataba la tela. Se equivocó: el hilo sigue ahí. Y tú lo estás tirando de nuevo, punto a punto.',
    options: [{ text: '…', next: 'interludio_acto2_c' }],
  },
  interludio_acto2_c: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Al sur, el mar. Los pescadores juran que la bruma de la Costa canta con voz prestada y que los barcos que la siguen no vuelven. Allí espera el segundo Eco, guardado por algo que aprendió de memoria una letra que nunca fue suya. Camina, Portador: el mundo no se teje solo. Cada nota que devuelves es un punto que la Niebla no podrá deshacer.',
    options: [{ text: '(Seguir camino)', next: 'r18_reacc_acto2_brisa' }],
  },

  // ----- Interludio Acto II → III «El Canto al Revés» (disparo: accept_q11) -----
  interludio_acto3_a: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Anoche el mundo cantó al revés, Portador. Lo oíste: la nana de Toln bajó cuando debía subir, el pozo de Teo respondió antes de que alguien llamara, y la orilla de Mara devolvió barcos que el mar guardaba desde hace treinta años. Un canto derecho sostiene el mundo. Un canto al revés... lo desteje.',
    action: 'flag_interludio_acto3_vista',
    options: [{ text: '…', next: 'interludio_acto3_b' }],
  },
  interludio_acto3_b: {
    name: 'El Eco', portrait: 'fragment',
    text: 'La Niebla no está robando el Canto: lo está APRENDIÉNDOLO. Nota a nota, del final al principio, como quien deshace un punto de labor para copiar el dibujo. Y lo que la Niebla aprende no lo olvida: canta con las voces de los que se llevó, imita la letra del dios asesinado y espera a que alguien le responda con su propio nombre. Los ecos torcidos son sus lecciones. Enderézalos, y la clase se acaba.',
    options: [{ text: '…', next: 'interludio_acto3_c' }],
  },
  interludio_acto3_c: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Tres veces sonó torcido esta noche, y tres lugares te esperan: el pozo donde el niño repite lo que oye, la ruina donde el bosque llora hacia atrás, la orilla donde el mar lee los nombres del revés. Camina despacio, Portador: quien le da lecciones a la Niebla todavía no ha dado la cara. Y cuando la dé... mejor que te encuentre cantando derecho.',
    options: [{ text: '(Seguir)', next: 'r18_reacc_acto3_brisa' }],
  },

  // ----- Interludio Acto III → IV «El Último Canto» (disparo: accept_q14) -----
  interludio_acto4_a: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Se dice que el silencio tiene miedo, Portador. Desde que enderezaste los tres ecos, la Niebla Muda no sabe qué hacer con las manos: por primera vez en trescientos años, alguien canta más fuerte que ella. Pero tú no cantas solo: estudias. Tu maestro tiene cara de hombre, y la Ciudadela ya oye tu melodía. Lo que viene no se puede esquivar: se canta, o se calla.',
    action: 'flag_interludio_acto4_vista',
    options: [{ text: '…', next: 'interludio_acto4_b' }],
  },
  interludio_acto4_b: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Velmora te lo contó sin rostro: la Orden de Vesh asesinó al dios-tejedor por misericordia, y cada nota del Canto costaba una vida del pasado. Aelthar no fue solo un dios muerto: fue un coro que cobró caro. Ahora la Campana del Ayer de Toln quiere reunir el coro de antes —la voz de Merrow, la resonancia de las cumbres— y tú cargas con la última nota. Que sea la primera que no cobre nada.',
    options: [{ text: '…', next: 'interludio_acto4_c' }],
  },
  interludio_acto4_c: {
    name: 'El Eco', portrait: 'fragment',
    text: 'Todo canto termina, Portador; los dioses lo saben mejor que nadie. La diferencia está en cómo: hay finales que cierran la herida y finales que la abren en los que quedan. El Último Canto será tuyo: el Eco que elijas, la verdad que digas o calles, la nota que dejes sonar. Camina. El coro de antes espera, y la Campana del Ayer no sabe tocar a medias.',
    options: [{ text: '(Seguir)', next: 'r18_reacc_acto4_brisa' }],
  },
};

/** Texto del banner de acto (screens.ts lo dibuja con fade de 2,5 s). */
export const ACTO_BANNER_18F: Record<number, string> = {
  2: 'ACTO II — LAS NOTAS PERDIDAS',
  3: 'ACTO III — EL CANTO AL REVÉS',
  4: 'ACTO IV — EL ÚLTIMO CANTO',
};

/** Toast de guía narrativa en cada transición (patrón toasts de hooks). */
const PISTA_TOAST_18F: Record<number, string> = {
  2: 'Nueva pista: el sur guarda el segundo canto',
  3: 'Nueva pista: lo que se canta al revés abre puertas',
  4: 'Nueva pista: el metal que recuerda quiere ser campana',
};

/** Índice de misión de cada transición (para los watchers por estado). */
const QUEST_IDX_18F: Record<number, number> = { 2: 5, 3: 10, 4: 13 };

// ---------------- Barrera narrativa de los Altares del Eco ----------------

/** Altares con jefe de custodia vivo (tryTakeEco ya gatea el pickup; esto
 *  impone el COMBATE: acercarse a ≤4 tiles despierta al custodio). */
export const BARRERA_ALTARES_18F = [
  {
    prop: 'altar_mareas', map: 'costa', boss: 'sirena', flag: 'sirenaDefeated',
    toast: 'La Marea Sin Nombre se interpone entre tú y el Eco',
  },
  {
    prop: 'altar_cumbres', map: 'cumbres', boss: 'golem', flag: 'golemDefeated',
    toast: 'El Gólem de Escarcha se interpone entre tú y el Eco',
  },
  {
    prop: 'altar_c', map: 'cripta', boss: 'guardian', flag: 'guardianDefeated',
    toast: 'El Guardián Hueco se interpone entre tú y el Eco',
  },
] as const;

const RADIO_TILES_18F = 4;   // tiles de distancia al altar que despiertan al custodio
const CD_ALTAR_18F = 8;      // s de cooldown anti-spam por altar
const TILE_18F = 16;         // TILE=16, constante del proyecto (hooks.ts acto3_subir)

// ---------------- Estado por partida (WeakMap: HMR/multi-instancia seguro) ----------------

interface Estado18F {
  pendiente: string | null;                       // interludio encolado por abrir
  banner: { texto: string; t0: number } | null;   // banner de acto activo
  altarCd: Record<string, number>;                // último disparo por altar (g.globalT)
  altarDentro: Record<string, boolean>;           // el Portador estaba dentro del radio (flanco)
}
const ESTADOS_18F = new WeakMap<Game, Estado18F>();

function estado18F(g: Game): Estado18F {
  let e = ESTADOS_18F.get(g);
  if (!e) {
    e = { pendiente: null, banner: null, altarCd: {}, altarDentro: {} };
    ESTADOS_18F.set(g, e);
  }
  return e;
}

// ---------------- API ----------------

/**
 * Dispara el interludio de un acto (idempotente por flag interludio_actoN).
 * NO abre el diálogo inmediatamente: lo ENCOLA y interludioTick18 lo abre en
 * cuanto el juego vuelva a 'play' (así el disparo puede vivir dentro de un
 * handler de diálogo — accept_q11/accept_q14 — sin pelearse con el
 * opt.next/closeDialogue del nodo que lo invocó, engine.ts:1044-1050).
 * Devuelve true si esta llamada fue la que lo disparó.
 */
export function dispararInterludio18F(g: Game, acto: 2 | 3 | 4): boolean {
  if (!g.player || g.challengeRun) return false;
  const flagKey = `interludio_acto${acto}`;
  if (g.flags[flagKey]) return false;
  g.flags[flagKey] = true; // se serializa sola (engine.save() hace spread de flags)
  const st = estado18F(g);
  if (!st.pendiente) st.pendiente = `interludio_acto${acto}_a`;
  audio.sfx('echo');
  g.toast(PISTA_TOAST_18F[acto], '#c8b0e8');
  return true;
}

/**
 * Tick por frame (desde screens.drawScreens, case 'play'; ver cabecera para
 * el punto alternativo en update.ts). O(1) + O(1 altares por mapa):
 *  1) watchers por ESTADO de las tres transiciones (idempotentes por flag),
 *     con recuperación si el flag quedó puesto y la cinemática nunca se vio,
 *  2) barrera de los altares (aggro del custodio vivo a ≤4 tiles),
 *  3) apertura del interludio encolado.
 */
export function interludioTick18F(g: Game): void {
  if (!g.player || g.state !== 'play' || g.challengeRun) return;
  const st = estado18F(g);

  // (1) disparo por estado — cubre accept_q6 del MOTOR (engine.ts:1087) y
  // cualquier vía futura; el flag lo hace una-sola-vez.
  if (g.flags.q6 && g.questIdx === QUEST_IDX_18F[2] && !g.flags.interludio_acto2) dispararInterludio18F(g, 2);
  if (g.flags.q11 && g.questIdx === QUEST_IDX_18F[3] && !g.flags.interludio_acto3) dispararInterludio18F(g, 3);
  if (g.flags.q14 && g.questIdx === QUEST_IDX_18F[4] && !g.flags.interludio_acto4) dispararInterludio18F(g, 4);

  // (1b) recuperación: flag puesto pero cinemática nunca vista (se guardó y
  // cerró el juego entre la aceptación y el final del interludio). El índice
  // de misión evita «recuperaciones» en actos posteriores.
  for (const acto of [2, 3, 4] as const) {
    if (g.flags[`interludio_acto${acto}`] && !g.flags[`interludio_acto${acto}_vista`] &&
        g.questIdx === QUEST_IDX_18F[acto] && !st.pendiente) {
      st.pendiente = `interludio_acto${acto}_a`;
    }
  }

  // (2) barrera de los altares del Eco
  barreraAltares18F(g, st);

  // (3) abrir el interludio encolado (nunca con otro diálogo abierto)
  if (st.pendiente && !g.dlgKey) {
    const acto = st.pendiente.startsWith('interludio_acto2') ? 2
      : st.pendiente.startsWith('interludio_acto3') ? 3 : 4;
    st.banner = { texto: ACTO_BANNER_18F[acto], t0: g.globalT };
    const key = st.pendiente;
    st.pendiente = null;
    g.openDialogue(key);
  }
}

/**
 * Barrera de los altares: si el Portador ENTRA en el radio de 4 tiles de un
 * altar cuyo custodio sigue vivo (flag de derrota sin poner + enemigo vivo en
 * g.enemies), el jefe entra en aggro (campo público Enemy.aggro + ai
 * 'persigue', el mismo par que usa el motor para perseguir). Flanco
 * (dentro→fuera→dentro) + cooldown 8 s = sin spam de toasts. Con el jefe
 * muerto (o el Eco ya tomado, imposible sin vencerle) el watcher no hace nada.
 */
function barreraAltares18F(g: Game, st: Estado18F): void {
  const p = g.player!;
  const alt = BARRERA_ALTARES_18F.find(a => a.map === g.mapId); // 0-1 coincidencias por mapa
  if (!alt) return;
  if (g.flags[alt.flag]) return; // custodio derrotado: el watcher no hace nada
  const altar = g.map.props.find(pr => pr.id === alt.prop);
  if (!altar) return;
  const ptx = Math.floor(p.x / TILE_18F), pty = Math.floor(p.y / TILE_18F);
  const dentro = Math.hypot(ptx - altar.x, pty - altar.y) <= RADIO_TILES_18F;
  const estaba = st.altarDentro[alt.prop] === true;
  st.altarDentro[alt.prop] = dentro;
  if (!dentro || estaba) return; // solo en el flanco de ENTRADA al radio
  const jefe = g.enemies.find(e => e.etype === alt.boss && !e.dead);
  if (!jefe) return; // sin custodio vivo en el mapa: nada que interponer
  if (g.globalT - (st.altarCd[alt.prop] ?? -1e9) < CD_ALTAR_18F) return; // cooldown 8 s
  st.altarCd[alt.prop] = g.globalT;
  jefe.aggro = true;                      // ← campo que dispara la persecución (update.ts / brains)
  if (jefe.ai === 'patrulla') jefe.ai = 'persigue';
  if (jefe.spawnGuard && jefe.spawnGuard > 0) jefe.spawnGuard = 0;
  if (!g.bossActive) { g.bossRef = jefe; g.bossActive = true; } // barra de jefe del HUD
  audio.sfx('banner');                    // el mismo del despertar del Guardián (update.ts:716)
  g.toast(alt.toast, '#8ef0ff');
}

/**
 * Estado del banner de acto para screens.ts (fade: 0,35 s de entrada,
 * mantiene y 0,6 s de salida — total 2,5 s). Null cuando no hay banner.
 */
const BANNER_DUR_18F = 2.5;

export function bannerActo18F(g: Game): { texto: string; alpha: number } | null {
  const st = ESTADOS_18F.get(g);
  if (!st?.banner) return null;
  const e = g.globalT - st.banner.t0;
  if (e < 0) return null;
  if (e > BANNER_DUR_18F) { st.banner = null; return null; }
  const alpha = e < 0.35 ? e / 0.35 : e > BANNER_DUR_18F - 0.6 ? Math.max(0, (BANNER_DUR_18F - e) / 0.6) : 1;
  return { texto: st.banner.texto, alpha };
}
