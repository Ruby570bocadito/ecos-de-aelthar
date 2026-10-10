// ============================================================
// ECOS DE AELTHAR — ACTO V (19-g): CIUDADELA DE VESH
// «Donde el canto se hizo silencio»
// ============================================================
//
// Mapa 54×44 de piedra oscura en 3 anillos concéntricos (bandas
// sur→norte) conectados por pasillos de 4 tiles:
//   · ANTEPORTÓN (sur, y35..41): explanada de entrada con 2 estatuas
//     (props 'sign'), 3 eco_desvanecido, sello acto5_s1, santuario,
//     cofre y el Eco Guía (NPC).
//   · EL CORO DE CENIZA (anillo medio, y24..32): sala grande con
//     columnas de 2×2 en patrón regular, vigia_tinta ×2 +
//     eco_desvanecido ×2 (élites, las marca 19-e), sello acto5_s2,
//     santuario, cofre, eco menor. Capillas laterales O/E (la oeste
//     guarda el sello acto5_s3 y un santuario: ALGO debe dar el 3er
//     sello SIN cruzar la puerta del jefe — evita deadlock).
//   · LA SALA DEL PRIMER SILENCIO (norte, centro): sala circular
//     (r<8 libre, centro 26.5,13) del jefe 'vesh' (27,10) zone
//     'boss', altar vacío en el centro-norte (27,7) y cofre de 200
//     coronas tras la puerta.
//
// DETERMINISMO: builder puro + mulberry32(SEMILLA) para los restos
// de ceniza ('r') — cero Math.random. Dos llamadas → mismo raster
// (verificado en scripts/smoke_mapa_acto5_r19.ts).
//
// PALETA DE TILES (SOLO chars ya dibujados y verificados):
//   '#'  muro de piedra (paintStone)      — SÓLIDO
//   'V'  roca maciza exterior (paintStone)— SÓLIDO (como la cripta)
//   'P'  columnas/jambas (paintStone)     — SÓLIDO
//   'R','r' escombros/estatuas caídas (paintVillage) — SÓLIDO
//   ':'  suelo de losa (buildArena usa ':' como suelo base; para
//        mapId 'ciudadela' drawExpansionTile devuelve false y pinta
//        el drawTile genérico = MISMO aspecto que la cripta) — pisable
//   '='  calzada/pasillos y dais del altar — pisable
//   NO se usa 'n' (drawTile la cae al verde por defecto: no es muro
//   legible en interior). NO se usa '.','s','S','i','r'-suelo ('r' es
//   SÓLIDO en SOLID_CHARS, sprites.ts:1595 — verificado).
//
// MINIMAPA (engine.buildGround:591-596, congelado): ':'→gris azulado,
// '='→tan; 'P','V','R','r' caen al verde por defecto — MISMO
// comportamiento que cripta/arena (precedente aceptado). Si el
// integrador lo quiere gris: 1 línea opcional en ese switch:
//   ch === 'P' || ch === 'V' ? '#8a8a9a' :
//
// ----------------------------------------------------------------
// PUNTOS DE CABLEADO PARA EL INTEGRADOR (nombres exactos)
// ----------------------------------------------------------------
//
// (1) REGISTRO DEL MAPA — LA ÚNICA LÍNEA CORRECTA (en maps_expansion.ts):
//     ORDEN REAL VERIFICADO: maps.ts:8 hace
//     `import { EXPANSION_MAPS } from './maps_expansion'` y
//     maps_expansion.ts SOLO importa './types' (grep verificado) → el
//     módulo maps_expansion se evalúa COMPLETO antes de que maps.ts
//     ejecute `MAPS = {...BASE_MAPS, ...EXPANSION_MAPS}` (maps.ts:410).
//     Por eso, al final de maps_expansion.ts (tras el literal, línea
//     ~508) el integrador añade:
//       // ==== ACTO V (19-g): Ciudadela de Vesh ====
//       import { ACTO5_MAP_DEF_R19 } from './maps_acto5_r19'; // (junto a los demás imports, arriba)
//       Object.assign(EXPANSION_MAPS, { ciudadela: ACTO5_MAP_DEF_R19 });
//     ESO corre en la evaluación de maps_expansion → ANTES del spread
//     de maps.ts:410 → MAPS queda con 'ciudadela' sin más cambios.
//     NO auto-instalo nada al cargar este módulo (regla de la tarea):
//     instalarMapaActo5R19() existe como parche manual idempotente que
//     muta EXPANSION_MAPS, pero AVISO: llamada DESPUÉS del arranque NO
//     repone el mapa en MAPS (el spread de maps.ts:410 es de una vez),
//     solo sirve si se invoca antes de que maps.ts se evalúe. La línea
//     de arriba es la ÚNICA robusta.
//     Ciclo resultante maps_acto5_r19 ⇄ maps_expansion: INOFENSIVO y
//     verificado: este módulo NO lee ningún binding de maps_expansion
//     en top-level (solo dentro de instalarMapaActo5R19, en tiempo de
//     llamada) y ACTO5_MAP_DEF_R19 se construye sin tocar nada externo.
//
// (2) ENTRADA DESDE LA CRIPTA (recíproco del exit sur). ExitDef NO
//     tiene flag/puerta, así que la entrada la gestiona el integrador
//     con el prop gate 'acto5_puerta_cripta' + acción travel_ciudadela:
//       · Añadir a cripta.props (maps.ts:402-405) el prop:
//           { id: 'acto5_puerta_cripta', kind: 'gate', x: 20, y: 2 }
//         (sala del altar de la cripta, x15..24/y2..6 — la Ciudadela
//         se alza «tras» el Primer Canto; el kind 'gate' ya se dibuja:
//         world/props.ts:542 drawGate).
//       · engine.nearestInteract (congelado) no da interacción al kind
//         'gate' → 1 línea en ese método (engine.ts:888-898):
//           else if (pr.id === 'acto5_puerta_cripta') consider(px, py, 'gate', 'Puerta de la Ciudadela', () => this.applyAction('travel_ciudadela'), 30);
//         applyAction('travel_…') (engine.ts:1209) exige MAPS['ciudadela']
//         → requiere el cableado (1). Aterriza en sanctuaryPos('ciudadela').
//       · sanctuaryPos (engine.ts:1240-1244) sin tocar devuelve [19,24]
//         para mapas nuevos → GARANTIZO ese tile pisable (pasillo
//         superior del Coro). Si el integrador prefiere aterrizar en la
//         explanada sur como pide el diseño, 1 línea en sanctuaryPos:
//           if (id === 'ciudadela') return [27, 41];
//         (27,41) está GARANTIZADO libre y pisable para esa variante.
//       · ALTERNATIVA cero-cambios-de-motor: ExitDef en cripta.exits
//         { x: 20, y: 2, w: 2, h: 1, to: ACTO5_MAP_ID, tx: 27, ty: 41,
//           label: 'Ciudadela de Vesh' } — pisar (20..21, 2) viaja y
//         aterriza en la explanada (27,41). No solapa con la salida al
//         Bosque de la cripta (y31..33).
//
// (3) EXIT RECÍPROCO (hecho aquí): ciudadela.exits → sur del mapa
//     (x25..28, y42..43) → 'cripta' aterriza en (20,30): tile ':' de la
//     entrada sur de la cripta (buildCripta rect(18,29,4,3)), FUERA de
//     su zona de salida al Bosque (y31..33) → sin bucles de teletransporte
//     (patrón de los aterrizajes de maps_expansion).
//
// (4) PUERTA DEL JEFE — tick (cablear en update.ts, updateGame, tras
//     `cumbresBiomaTick(g, dt);` línea ~388):
//       import { ciudadelaGateTickR19 } from './maps_acto5_r19'; // 19-g
//       ciudadelaGateTickR19(g); // 19-g: puerta de la Sala del Primer Silencio
//     Comportamiento: si el Portador queda a ≤1.5 tiles del prop
//     'acto5_puerta' (26,22) SIN la flag 'acto5_sellos_3' → toast cada
//     3 s «La puerta no canta aún: faltan sellos» + empuje 1 tile atrás
//     (sur, recentrado). Con la flag → no hace nada (puede entrar).
//     19-f fija 'acto5_sellos_3' al entregar los 3 sellos; la apertura
//     con diálogo es SUYA vía acto5_puerta_vesh. El tick se guarda el
//     último toast en un WeakMap por instancia (HMR-safe, cero flags
//     serializadas). La geometría queda sellada: el hueco de la puerta
//     es de 2 tiles (x26..27, y21..22) flanqueado por jambas 'P' —
//     TODO paso hacia la sala del jefe entra en el radio de 1.5 tiles
//     del prop (demostrado por BFS en el smoke, check 6).
//
// (5) NOTAS PARA 19-f (diálogos/sellos):
//     · NPC 'eco_guia' (sprite 'wisp' — existe: sprites.ts:678). El
//       motor llama talkTo('eco_guia') → getDialogue('eco_guia')
//       (data.ts:696) que para nids desconocidos cae a 'brisa_idle'
//       → 19-f debe añadir en getDialogue: `if (nid === 'eco_guia')
//       return 'acto5_guia';` (o crear el nodo bajo la clave
//       'eco_guia'). Sus nodos: acto5_guia.
//     · Sellos acto5_s1..s3 son kind 'fragment': engine.nearestInteract
//       (congelado, engine.ts:894) abre SIEMPRE 'voz_fragment' para
//       fragments → 19-f rutea por contexto (getDialogue o su propia
//       capa) sabiendo que los ids exactos son acto5_s1 (anteportón),
//       acto5_s2 (coro), acto5_s3 (capilla oeste).
//     · La flag de apertura de la puerta es 'acto5_sellos_3' (la lee
//       ciudadelaGateTickR19).
//     · El altar vacío es kind 'altarEcho' id 'acto5_altar_vacio' en
//       (27,7): tryTakeEco (engine.ts:957) para mapId 'ciudadela' cae
//       al branch por defecto y, con flags.ecoVoz ya puesto (Acto I),
//       responde «El altar ya está vacío.» — texto exacto deseado. Si
//       19-f quiere diálogo propio, que use OTRO prop y documente.
//
// (6) NOTAS PARA 19-e / 19-h (enemigos y jefe):
//     · Spawns usan etypes 'eco_desvanecido' (×4), 'vigia_tinta' (×2)
//       y 'vesh' (jefe, zone 'boss'): types.ts:13 (EnemyType) está
//       congelado hoy → casts `as unknown as EnemyType` documentados;
//       cuando 19-e/19-h amplíen la unión, los casts siguen compilando.
//     · ENEMY_DEFS (data.ts:781, Record<string,EnemyDef>) debe incluir
//       esas 3 claves (makeEnemy lee ENEMY_DEFS[type] sin guard).
//     · La activación automática del jefe (update.ts:407-427) busca
//       BOSS_DEFEAT_FLAG[type] (engine.ts:84): 19-h/integrador deben
//       añadir `vesh: 'veshDefeated'` para el despacho automático/no
//       respawn. Música: el motor pasa a 'boss' solo al activarse el
//       jefe; la música base del mapa es 'crypt' (la más oscura de
//       TrackName, types.ts:11 — no se añaden valores nuevos).
//     · Los spawns van con patrol 2-4; separación ≥3 tiles entre
//       spawns y vs npcs/props (verificada en el smoke, check 5).
//
// (7) ÉPOCA: epochDiffs vacío (como la cripta): la Ciudadela es
//     ajena al cambio de época; tileAt en 'pasado' devuelve las mismas
//     filas. dark: true (iluminación de cripta automática).
// ============================================================

import type { EnemyType, MapDef, MapId } from './types';
import type { Game } from './engine';
import { EXPANSION_MAPS } from './maps_expansion';

// ---------- helpers deterministas (patrón maps.ts) ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Grid = string[][];

function grid(w: number, h: number, fill: string): Grid {
  const g: Grid = [];
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) row.push(fill);
    g.push(row);
  }
  return g;
}

function set(g: Grid, x: number, y: number, ch: string) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
}

function rect(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, ch);
}

function toRows(g: Grid): string[] { return g.map(r => r.join('')); }

// ---------- builder ----------

// 0xC17ADE1A — «C17ADE1A» = CITADELA en leet. Semilla FIJA (regla 2).
const SEMILLA_CIUDADELA = 0xc17ade1a;

// Restos de ceniza ('r', SÓLIDOS) elegidos con la semilla sobre una
// lista de celdas candidatas pre-vetadas (suelo abierto, lejos de
// props/spawns/pasillos espina). Un solo tile suelto en salas anchas
// no puede aislar nada; el smoke lo demuestra con BFS completo.
const CENIZA_CANDIDATAS: [number, number][] = [
  [15, 36], [43, 37], [21, 41],            // anteportón
  [11, 26], [16, 31], [28, 26], [33, 25], [39, 31], // coro (bases de columnas/aisles)
  [6, 26],                                  // capilla oeste
  [49, 29],                                 // capilla este
];

/**
 * buildCiudadelaR19 — raster 54×44 determinista de la Ciudadela de Vesh.
 * 3 anillos: Anteportón (sur) → Coro de Ceniza (medio) → Sala del
 * Primer Silencio (norte, circular). Pasillos de conexión de 4 tiles.
 * Puerta del jefe: hueco 2×2 (x26..27, y21..22) con jambas 'P'; el
 * prop gate 'acto5_puerta' (26,22) cubre TODO el hueco a ≤1.5 tiles.
 */
export function buildCiudadelaR19(): string[] {
  const W = 54, H = 44;
  const g = grid(W, H, 'V');
  rect(g, 1, 1, 52, 42, '#');                       // macizo de piedra oscura

  // --- ANILLO NORTE: La Sala del Primer Silencio (círculo r<8, centro 26.5,13)
  for (let y = 4; y <= 21; y++) {
    for (let x = 17; x <= 36; x++) {
      const dx = x - 26.5, dy = y - 13;
      if (dx * dx + dy * dy < 64) set(g, x, y, ':');
    }
  }
  rect(g, 25, 6, 5, 3, '=');                        // dais del altar vacío (centro-norte)

  // --- ANILLO MEDIO: El Coro de Ceniza (x9..44, y24..32) + columnas 2×2
  rect(g, 9, 24, 36, 9, ':');
  for (const cx of [12, 18, 24, 30, 36]) {
    rect(g, cx, 26, 2, 2, 'P');
    rect(g, cx, 29, 2, 2, 'P');
  }
  // Capilla oeste «Nave de los Sordos» (x3..7, y25..31) y capilla este (x46..50)
  rect(g, 3, 25, 5, 7, ':');
  rect(g, 46, 25, 5, 7, ':');

  // --- ANILLO SUR: Anteportón (x7..46, y35..41)
  rect(g, 7, 35, 40, 7, ':');

  // --- Conexiones (pasillos de 4 tiles mínimo) ---
  rect(g, 25, 21, 4, 3, '=');                       // Coro → puerta del jefe (y21..23)
  set(g, 25, 21, 'P'); set(g, 28, 21, 'P');         // jambas ceremoniales: hueco x26..27
  set(g, 25, 22, 'P'); set(g, 28, 22, 'P');         // (el gate prop cubre el hueco entero)
  rect(g, 25, 33, 4, 2, '=');                       // Anteportón → Coro (y33..34)
  rect(g, 25, 42, 4, 2, '=');                       // salida sur (y42..43) → cripta
  rect(g, 8, 27, 1, 4, '=');                        // puerta capilla oeste (4 tiles alto)
  rect(g, 45, 27, 1, 4, '=');                       // puerta capilla este (4 tiles alto)

  // --- Restos de ceniza (deterministas, semilla fija) ---
  const rng = mulberry32(SEMILLA_CIUDADELA);
  for (const [x, y] of CENIZA_CANDIDATAS) {
    if (rng() < 0.65) set(g, x, y, 'r');
  }
  return toRows(g);
}

// ---------- id y def ----------

/**
 * Id del mapa Ciudadela. types.ts está CONGELADO en la ronda 19
 * (MapId aún no lista 'ciudadela'): cast documentado, mismo patrón que
 * ARENA_MAP_ID (maps_expansion.ts:324). Cuando el integrador añada
 * 'ciudadela' a MapId, el cast sigue compilando sin cambios.
 */
export const ACTO5_MAP_ID = 'ciudadela' as unknown as MapId;

// ==== etypes nuevos (19-e/19-h): EnemyType (types.ts:13) está congelado
// hoy; casts documentados — siguen compilando cuando se amplíe la unión.
const ECO_DESVANECIDO = 'eco_desvanecido' as unknown as EnemyType;
const VIGIA_TINTA = 'vigia_tinta' as unknown as EnemyType;
const VESH = 'vesh' as unknown as EnemyType;

/**
 * ACTO5_MAP_DEF_R19 — MapDef completo de la Ciudadela de Vesh.
 * Puntos GARANTIZADOS pisables para el motor:
 *   · (19,24) — aterrizaje por defecto de sanctuaryPos (engine.ts:1244).
 *   · (27,41) — explanada sur, llegada pedida por el diseño.
 *   · (20,30) no está en este mapa: es el aterrizaje EN cripta del exit sur.
 */
export const ACTO5_MAP_DEF_R19: MapDef = {
  id: ACTO5_MAP_ID,
  name: 'Ciudadela de Vesh',
  subtitle: 'Donde el canto se hizo silencio',
  w: 54, h: 44,
  rows: buildCiudadelaR19(),
  epochDiffs: [],                 // ajena al cambio de época (como la cripta)
  dark: true,
  music: 'crypt',                 // la más oscura de TrackName existente (types.ts:11)
  npcs: [
    // Sus diálogos los pone 19-f con id 'acto5_guia' (ver cabecera, nota 5).
    { id: 'eco_guia', x: 30, y: 39, sprite: 'wisp', name: 'Eco Guía' },
  ],
  chests: [
    { id: 'acto5_c1', x: 9, y: 36, gold: 80 },
    { id: 'acto5_c2', x: 48, y: 27, gold: 120, potions: 1 },  // capilla este
    { id: 'acto5_c3', x: 21, y: 8, gold: 200 },               // Sala del Silencio, tras la puerta
  ],
  echoes: [
    {
      id: 'acto5_e1', x: 47, y: 30,
      title: 'Eco menor · El coro que no quiso callar',
      text: '«Los cien cantores de la Ciudadela juraron acompañar al dios hasta la última nota. Vesh escuchó una y la guardó para él; del resto hizo ceniza que aún se acomoda en las columnas cuando alguien canta en el Coro. No les cantes nada, Portador: aprende primero sus nombres.»',
    },
    {
      id: 'acto5_e2', x: 44, y: 40,
      title: 'Eco menor · La explanada de los peregrinos',
      text: '«Aquí esperaban los peregrinos su turno para oír el Primer Canto. Vesh les cobraba la entrada en recuerdos: quien subía, olvidaba su casa. Por eso ninguno volvió: no quisieron. La Ciudadela no mató a nadie; solo hizo que el olvido fuera cómodo.»',
    },
  ],
  spawns: [
    // --- Anteportón: eco_desvanecido ×3 ---
    { type: ECO_DESVANECIDO, x: 16, y: 40, patrol: 4, zone: 'ciudadela' },
    { type: ECO_DESVANECIDO, x: 23, y: 38, patrol: 3, zone: 'ciudadela' },
    { type: ECO_DESVANECIDO, x: 39, y: 40, patrol: 4, zone: 'ciudadela' },
    // --- Coro de Ceniza: vigia_tinta ×2 (élites, las marca 19-e) + eco_desvanecido ×2 ---
    { type: VIGIA_TINTA, x: 16, y: 25, patrol: 3, zone: 'ciudadela' },
    { type: VIGIA_TINTA, x: 34, y: 31, patrol: 3, zone: 'ciudadela' },
    { type: ECO_DESVANECIDO, x: 21, y: 25, patrol: 3, zone: 'ciudadela' },
    { type: ECO_DESVANECIDO, x: 39, y: 26, patrol: 3, zone: 'ciudadela' },
    // --- JEFE: Vesh, en el corazón de la Sala del Primer Silencio ---
    { type: VESH, x: 27, y: 10, zone: 'boss' },
  ],
  exits: [
    // Sur del mapa → Cripta. Aterriza en (20,30): losa de la entrada sur
    // de la cripta, FUERA de su zona de salida al Bosque (y31..33) → sin
    // bucle (ver cabecera, nota 3).
    { x: 25, y: 42, w: 4, h: 2, to: 'cripta', tx: 20, ty: 30, label: 'Cripta del Primer Canto' },
  ],
  props: [
    // --- 3 sellos (los referencia 19-f; kind 'fragment') ---
    { id: 'acto5_s1', kind: 'fragment', x: 12, y: 39 },  // anteportón, oeste
    { id: 'acto5_s2', kind: 'fragment', x: 41, y: 31 },  // coro, pasillo este
    { id: 'acto5_s3', kind: 'fragment', x: 4, y: 26 },   // capilla oeste: alcanzable SIN cruzar la puerta
    // --- 2 santuarios (viaje rápido, engine.openSanctuary:988) ---
    { id: 'sanc_ciud_1', kind: 'sanctuary', x: 42, y: 38 },  // anteportón, este
    { id: 'sanc_ciud_2', kind: 'sanctuary', x: 6, y: 30 },   // capilla oeste
    // --- Puerta de la Sala del Primer Silencio (tick propio, nota 4) ---
    { id: 'acto5_puerta', kind: 'gate', x: 26, y: 22 },
    // --- Altar vacío del centro-norte (nota 5: «El altar ya está vacío.») ---
    { id: 'acto5_altar_vacio', kind: 'altarEcho', x: 27, y: 7 },
    // --- 2 estatuas + 2 carteles de lore ---
    { id: 'acto5_statua1', kind: 'sign', x: 18, y: 37, label: 'Estatua del Primer Cantor. Su boca fue pulida hasta borrarla. Debajo, un grabado reciente: «VESH CANTA POR TODOS. NO HACE FALTA TU VOZ».' },
    { id: 'acto5_statua2', kind: 'sign', x: 35, y: 37, label: 'Estatua del Segundo Cantor. Le faltan las manos: se las llevaron para que no marcase el compás. La placa rezaba «QUE EL CANTO NOS REÚNA», pero alguien tachó «reúna» y escribió «disuelva».' },
    { id: 'acto5_cartel_entrada', kind: 'sign', x: 32, y: 41, label: '«Ciudadela de Vesh. Tres anillos: el portón, el coro, el silencio. Lo que entró cantando no ha vuelto; lo que ha salido, no recordaba haber entrado.»' },
    { id: 'acto5_cartel_puerta', kind: 'sign', x: 24, y: 24, label: '«La Sala del Primer Silencio. Tres sellos abren la puerta; el canto del guardián la cierra. Si la puerta no canta aún, no insistas: la piedra escucha, y Vesh también.»' },
  ],
};

// ---------- instalación (ver cabecera, nota 1) ----------

/**
 * instalarMapaActo5R19 — registra la Ciudadela en EXPANSION_MAPS de
 * forma idempotente (guard por identidad). AVISO IMPORTANTE: MAPS
 * (maps.ts:410) se construye con un spread de UNA VEZ al cargar el
 * módulo, así que esta función SOLO asegura el registro si se llama
 * antes de la evaluación de maps.ts. La vía robusta —la ÚNICA
 * recomendada— es la línea Object.assign en maps_expansion.ts
 * documentada en la cabecera (nota 1), que corre siempre pre-MAPS.
 */
export function instalarMapaActo5R19(): void {
  const exp = EXPANSION_MAPS as unknown as Record<string, MapDef>;
  if (exp['ciudadela'] === ACTO5_MAP_DEF_R19) return; // idempotente (guard)
  exp['ciudadela'] = ACTO5_MAP_DEF_R19;
}

// ---------- tick de la puerta (ver cabecera, nota 4) ----------

// Espejo local de TILE (sprites.ts:1555) para no arrastrar como valor
// el módulo de sprites (import innecesario; 1 tile = 16 px).
const TILE = 16;

const GATE_TOAST_T = new WeakMap<object, number>();

/**
 * ciudadelaGateTickR19 — bloqueo de la puerta 'acto5_puerta' mientras
 * no se tenga la flag 'acto5_sellos_3' (la fija 19-f). A ≤1.5 tiles:
 * toast cada 3 s + empuje 1 tile atrás (sur, recentrado al tile).
 * Guard estándar (mapa/estado/player/flag). O(1) por frame.
 * El diálogo de apertura lo pone 19-f vía acto5_puerta_vesh.
 */
export function ciudadelaGateTickR19(g: Game): void {
  if (g.mapId !== ACTO5_MAP_ID) return;                 // early-out barato
  if (g.flags.acto5_sellos_3) return;                   // puerta abierta (19-f)
  if (g.state !== 'play') return;                       // guard estándar
  const p = g.player;
  if (!p || p.dead) return;
  const gate = g.map.props.find(pr => pr.id === 'acto5_puerta');
  if (!gate) return;
  const gx = gate.x * TILE + 8, gy = gate.y * TILE + 8;
  if (Math.hypot(p.x - gx, p.y - gy) > TILE * 1.5) return;
  // toast con anti-spam de 3 s (WeakMap por instancia: HMR-safe)
  const last = GATE_TOAST_T.get(g) ?? -1e9;
  if (g.globalT - last >= 3) {
    GATE_TOAST_T.set(g, g.globalT);
    g.toast('La puerta no canta aún: faltan sellos', '#c8b0e8');
  }
  // empuje: 1 tile al sur, recentrado al centro del tile actual
  const ptx = Math.round((p.x - 8) / TILE);
  const pty = Math.floor(p.y / TILE);
  if (pty + 1 < g.map.h) {
    p.x = ptx * TILE + 8;
    p.y = (pty + 1) * TILE + 8;
    p.vx = 0; p.vy = 0;
  }
}
