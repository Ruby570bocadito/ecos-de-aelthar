// ============================================================
// ECOS DE AELTHAR — INTERIORES (Ronda 10 · épica 6.5 · agente R10-5)
// Casa de la Anciana (Lunaris) · Tienda de Taln (Lunaris) · Taberna (Aldea de Merrow)
// ============================================================
//
// ARCHIVO EXCLUSIVO R10-5: este módulo NO toca maps.ts, maps_expansion.ts,
// engine.ts, update.ts, types.ts ni data.ts. Solo importa TYPES (lectura) de
// ./types → imposible crear ciclos de imports. Todo determinista: filas
// literales a mano, sin scatter/RNG de ejecución.
//
// ---------------- VOCABULARIO DE TILES (todos preexistentes) ----------------
//
//   '_'  suelo de TABLONES cálidos (paintWood, stone.ts) — TRANSITABLE.
//        Es el suelo de los tres interiores: la madera ya existía como char
//        y era transitable (no está en SOLID_CHARS), solo nadie la había
//        usado como suelo principal.
//   '#'  muro de sillería (paintWall) — SÓLIDO. Perímetro y estanterías/armarios
//        adosados (tramos de 2 contra la pared norte: se leen como repisas).
//   'H'  pared de casa con ventanas (paintVillage/paintWall-village) — SÓLIDO.
//        Tramos de la pared NORTE: sus ventanas se encienden de noche con
//        resplandor cálido (drawVillageWindowsNight corre para TODOS los mapas).
//   'V'  vacío negro (paintVoid) — SÓLIDO. Empotrado en la pared norte:
//        se lee como BOCA DE HOGUERA / chimenea apagada.
//   'A'  altar de piedra (paintAltar) — SÓLIDO. Mesa de la Anciana, MOSTRADOR
//        de la tienda, barra y mesas de la taberna (losa de piedra con runas).
//   'r'  teja (paintRoof) — SÓLIDO. Bloques bajos de 2×1: CAMA (casa) / sacos y
//        arca (tienda) / banco (taberna). Textura cálida, silueta baja.
//   'P'  pilar de piedra (paintPillar) — SÓLIDO. Soportes centrales de la
//        taberna (el capitel sobresale 8 px hacia arriba: altura leíble).
//   'R'  roca (paintVillage) — SÓLIDO. Cajas y mercancía apilada (tienda/taberna).
//   'd'  puerta (paintDoor) — SÓLIDO (está en SOLID_CHARS). UNA por interior,
//        empotrada en el muro del BORDE SUR.
//
// Interiores atemporales: epochDiffs=[] (el cambio de época Q dentro no altera
// nada — suelo idéntico en ambas épocas por construcción del motor).
//
// ================= CONTRATO DE INTEGRACIÓN (para el orquestador) ============
//
// (a) REGISTRAR LOS MAPAS EN EL ROUTER (maps.ts, 1 línea):
//
//       import { INTERIOR_MAPS, INTERIOR_MAP_IDS } from './maps_interiores';
//       export const MAPS: Record<MapId, MapDef> =
//         { ...BASE_MAPS, ...EXPANSION_MAPS, ...INTERIOR_MAPS };
//
//     OBLIGATORIO, no opcional: loadMap resuelve MAPS[id] (engine.ts:594) y,
//     sobre todo, loadGame RECHAZA cualquier save hecho dentro de un interior
//     si el id no está en MAPS (engine.ts:468: `!MAPS[d.map]` → throw), y
//     openSanctuary haría crash al listar visitados (`MAPS[mid as MapId].name`,
//     engine.ts:1255 — loadMap marca todo interior visitado en visitedMaps).
//     Con el spread anterior, (a) habilita guardar/cargar/viajar sin tocar
//     engine.ts. NOTA: los interiores aparecerán en el menú «Viajar» del
//     Santuario una vez visitados (comportamiento genérico de visitedMaps);
//     si se quiere excluirlos, filtrar con isInteriorMap(mid) en openSanctuary.
//     Música: music:'village'/'aldea' son TrackName existentes → audio.playTrack
//     funciona sin cambios (update.ts:262).
//
// (b) PUERTAS DE ENTRADA EN LOS MAPAS EXTERIORES (R10-1/R10-2 orquestan):
//
//     El tile 'd' es SÓLIDO: la entrada se dispara pisando el tile LIBRE justo
//     DEBAJO de la puerta exterior (patrón ExitDef normal de update.ts:492).
//     Los aterrizajes interiores son INTERIOR_EXITS[key].entry — NUNCA caen
//     dentro de la zona de salida del propio interior (mismo anti-bucle que
//     cripta↔bosque). Listas para pegar (importar INTERIOR_MAP_IDS desde aquí):
//
//       // maps.ts · lunaris.exits — Casa de la Anciana (puerta exterior (9,10))
//       { x: 9, y: 11, w: 1, h: 1, to: INTERIOR_MAP_IDS.anciana, tx: 6, ty: 7, label: 'Casa de la Anciana' },
//       // maps.ts · lunaris.exits — Tienda de Taln (puerta exterior (9,28))
//       { x: 9, y: 29, w: 1, h: 1, to: INTERIOR_MAP_IDS.tienda, tx: 7, ty: 7, label: 'Tienda de Taln' },
//       // maps_expansion.ts · aldea.exits — Taberna (puerta (9,7), SOLO PASADO)
//       { x: 9, y: 8, w: 1, h: 1, to: INTERIOR_MAP_IDS.taberna, tx: 8, ty: 8, label: 'Taberna de Merrow', needPast: true },
//
//     Garantías de tile que deben asegurar en los exteriores (verificadas en
//     los grids actuales salvo la última):
//       · lunaris (9,11) y (9,12): '=' (pathV) — aterrizaje exterior (9,12) fuera de la zona (9,11).
//       · lunaris (9,29): '=' (pathV/pathH) y (9,30): '.'/',' — aterrizaje (9,30) fuera de la zona (9,29).
//       · aldea en PASADO: (9,8) zona de entrada y (9,9) aterrizaje deben ser
//         ':' transitables — la dispersión de ruinas ('r' SÓLIDO, 4.5%) puede
//         haberlos plantado: forzarlos con epochDiffs (char ':' en pasado) o
//         añadir [9,8] y [9,9] al clearKey de buildAldea. La puerta 'd' de la
//         casa NW de Merrow solo existe en el pasado (aldeaDiffs) → needPast:true.
//
// (c) SPAWN DE LOS NPCS INTERIORES: ya resuelto SIN cambios de motor — cada
//     MapDef de INTERIOR_MAPS lleva su npcs: NpcDef[] y engine.spawnNpcs()
//     (engine.ts:861) los instancia en cada loadMap. Falta SOLO el diálogo:
//     engine.talkTo(nid) → data.getDialogue(nid) devuelve 'brisa_idle' para
//     nids desconocidos (diálogo equivocado, con nombre «Anciana Brisa»).
//     Enganche EXACTO en data.ts (2 líneas + 1 de import):
//
//       import { INTERIOR_NPC_DIALOGUES } from './maps_interiores';   // arriba
//       Object.assign(DIALOGUES, INTERIOR_NPC_DIALOGUES);             // tras export const DIALOGUES
//       // y dentro de getDialogue(), ANTES del `return 'brisa_idle';` final:
//       if (nid.startsWith('int_') && DIALOGUES[nid]) return nid;
//
//     (los nids interiores son 'int_anciana' | 'int_taln' | 'int_tabernero' y
//     cada nodo de diálogo usa ESE MISMO id como clave → el hook es genérico).
//     Sin ciclo: maps_interiores no importa nada de data.ts. Rutas alternativas
//     válidas: Object.assign(g.dynNodes, ...) en loadMap + guard idéntico.
//
// (d) SALIR DEL INTERIOR POR LA PUERTA 'd':
//
//     · OPCIÓN CERO — YA FUNCIONA, 0 cambios de motor (RECOMENDADA): delante de
//       cada puerta hay una ExitDef normal (INTERIOR_EXITS[key].zone, sobre
//       suelo '_' transitable). Al pisarla, update.ts:492 dispara fadeTo al
//       exterior (sfx 'echo' + autoguardado), con exitCd 0.9 s anti-bucle.
//     · OPCIÓN E — si se quiere interactuar con E mirando a la puerta: en
//       engine.tryInteract(), PRIMERO en la cadena:
//
//         const iKey = (Object.keys(INTERIOR_MAP_IDS) as InteriorKey[])
//           .find(k => INTERIOR_MAP_IDS[k] === this.mapId);
//         if (iKey) {
//           const d = INTERIOR_EXITS[iKey].door;
//           const fx = Math.floor(this.player!.x / TILE) + (this.player!.dir === 'left' ? -1 : this.player!.dir === 'right' ? 1 : 0);
//           const fy = Math.floor(this.player!.y / TILE) + (this.player!.dir === 'up' ? -1 : this.player!.dir === 'down' ? 1 : 0);
//           if (fx === d.x && fy === d.y) {
//             const ex = INTERIOR_EXITS[iKey];
//             this.fadeTo(ex.to, ex.tx, ex.ty); audio.sfx('echo'); return;
//           }
//         }
//
//       (dejar TAMBIÉN la zona (opción cero) como respaldo: ambas rutas son
//       idempotentes gracias a fadeDir/exitCd).
//
// ---------------- RIESGOS CONOCIDOS (documentados, ninguno bloqueante) ------
//  · Cambio de época (Q) dentro de un interior: atemporal por diseño (sin
//    diffs); si salen de la taberna ya en presente, el aterrizaje en Merrow
//    (9,9) puede caer en ruina → loadMap.findSafeTile lo rescata al tile libre
//    más cercano (motor ya lo hace). Mejora futura: bloquear Q en interiores.
//  · Menú Viajar del Santuario puede listar interiores visitados (ver (a)).
//  · Retratos: 'corvin' y 'toln' existen en portraits.ts; no hay retrato
//    'merrow_h' (el motor cae a 'wisp') → el tabernero usa portrait 'toln'.
//    El sprite en mundo SÍ es 'merrow_h' (paleta reservada de los pescadores).
// ============================================================

import type { MapDef, MapId, NpcDef, DialogueNode, ExitDef } from './types';

// ---------------- Ids (cast documentado, patrón ARENA_MAP_ID) ----------------

export type InteriorKey = 'anciana' | 'tienda' | 'taberna';

/**
 * Ids fijos de los tres interiores. types.ts aún no lista 'interior_*' en la
 * unión MapId (está en manos del orquestador): el cast documentado amplía la
 * unión por impacto. Cuando el integrador añada los tres literales a MapId,
 * puede borrar los casts sin más cambios (los ids ya viajan dentro de
 * INTERIOR_MAPS y maps.ts los difunde a MAPS con el spread del contrato (a)).
 */
export const INTERIOR_MAP_IDS: Record<InteriorKey, MapId> = {
  anciana: 'interior_anciana' as unknown as MapId,
  tienda: 'interior_tienda' as unknown as MapId,
  taberna: 'interior_taberna' as unknown as MapId,
};

/** True si el id es uno de los interiores (para filtros de openSanctuary/E). */
const INTERIOR_ID_SET: Set<string> = new Set(Object.values(INTERIOR_MAP_IDS));
export function isInteriorMap(id: MapId): boolean {
  return INTERIOR_ID_SET.has(id);
}

// ---------------- NPCs interiores (data + diálogo) ----------------

export interface InteriorNpcSpec {
  key: InteriorKey;          // interior donde vive
  id: string;                // nid único (clave también del nodo raíz de diálogo)
  x: number; y: number;      // tile (sobre suelo '_' transitable)
  sprite: string;            // paleta existente en actors/palettes.ts
  portrait: string;          // retrato existente en actors/portraits.ts
  name: string;
  /** 2-3 líneas cortas; se sirven en orden como nodos encadenados (next). */
  lines: string[];
}

export const INTERIOR_NPCS: Record<InteriorKey, InteriorNpcSpec> = {
  anciana: {
    key: 'anciana',
    id: 'int_anciana',
    x: 4, y: 3,
    sprite: 'brisa',          // la propia Anciana Brisa, en su casa
    portrait: 'brisa',
    name: 'Anciana Brisa',
    lines: [
      'Shh... entra despacio, Portador. El silencio de una casa es un cristal: se empaña con cada palabra que no hace falta.',
      'Esta era la casa de mi marido. Bordaba nombres en tela para que la Niebla no se los llevara: el último que bordó fue el mío. Aquí sigo; no sé si por mérito mío o por descuido de la Niebla.',
      'Si encuentras un eco por el valle, dilo en voz alta. Un nombre dicho es una vela... y esta casa lleva mucho tiempo a oscuras.',
    ],
  },
  tienda: {
    key: 'tienda',
    id: 'int_taln',
    x: 7, y: 3,               // detrás del mostrador (fila 4)
    sprite: 'corvin',         // gorguera clara: lectura de tendero (sustituible)
    portrait: 'corvin',
    name: 'Taln, mercader del valle',
    lines: [
      '¡Puerta abierta, Corazón! Taln compra y vende: lo que el valle ya no recuerda, yo lo guardo en cajas. Todo lo de este mostrador tiene dueño; lo que hay detrás... negociable.',
      'La forja de Toln huele a gloria, pero cobra como si el canto del dios siguiera de moda. Yo ofrezco trato de agora: coronas hoy, nostalgia mañana.',
      '¿La Niebla? A la Niebla nada le compro. Se cobra en nombres, y los necesito todos para el inventario.',
    ],
  },
  taberna: {
    key: 'taberna',
    id: 'int_tabernero',
    x: 3, y: 2,               // detrás de la barra (fila 3)
    sprite: 'merrow_h',       // paleta de los pescadores de Merrow (biblia)
    portrait: 'toln',         // no hay retrato merrow: el fallback del motor es 'wisp'
    name: 'Tabernero de Merrow',
    lines: [
      '¡Adentro, forastero! Aquí se bebe lo que el mar devuelve y se canta lo que el mar calla. Butaca libre junto al fuego, si te atreves a sentarte con los pescadores.',
      'Brinda por Merrow y Merrow te oye. Esta noche pasa por esta sala el pueblo entero: nombres, risas, deudas. Pregunta por cualquiera, que aún todos sabemos quiénes somos.',
      'Dicen que un día la Niebla borrará este pueblo. Je. Que venga: dentro de esta taberna no cabe.',
    ],
  },
};

/** Clave del nodo de diálogo i-ésimo de un NPC interior. */
function dlgKey(s: InteriorNpcSpec, i: number): string {
  return i === 0 ? s.id : `${s.id}_${i + 1}`;
}

/**
 * Nodos de diálogo listos para DIALOGUES (contrato (c)): name/portrait del
 * NPC, texto corto y cadena lineal vía `next`. Clave del primer nodo = nid.
 */
export const INTERIOR_NPC_DIALOGUES: Record<string, DialogueNode> = (() => {
  const out: Record<string, DialogueNode> = {};
  for (const s of Object.values(INTERIOR_NPCS)) {
    s.lines.forEach((text, i) => {
      out[dlgKey(s, i)] = {
        name: s.name,
        portrait: s.portrait,
        text,
        next: i + 1 < s.lines.length ? dlgKey(s, i + 1) : undefined,
      };
    });
  }
  return out;
})();

/** NpcDef plano que consume engine.spawnNpcs (vía MapDef.npcs). */
export function toNpcDef(s: InteriorNpcSpec): NpcDef {
  return { id: s.id, x: s.x, y: s.y, sprite: s.sprite, name: s.name };
}

// ---------------- Salidas (puerta sur + retorno exterior) ----------------

export interface InteriorExitDef {
  key: InteriorKey;
  map: MapId;                                        // id del interior (cast)
  door: { x: number; y: number };                    // tile 'd' en el borde sur
  zone: { x: number; y: number; w: number; h: number }; // zona de salida DENTRO (suelo frente a la puerta)
  entry: { x: number; y: number };                   // aterrizaje DENTRO (fuera de zone)
  to: MapId;                                         // mapa exterior de retorno
  tx: number; ty: number;                            // aterrizaje exterior (junto a la casa, fuera de su zona de entrada)
  label: string;
}

export const INTERIOR_EXITS: Record<InteriorKey, InteriorExitDef> = {
  anciana: {
    key: 'anciana',
    map: INTERIOR_MAP_IDS.anciana,
    door: { x: 6, y: 9 },
    zone: { x: 5, y: 8, w: 3, h: 1 },
    entry: { x: 6, y: 7 },
    // Casa de Brisa en lunaris: house(7,9,5,9), puerta exterior (9,10).
    // (9,11)='=' es la zona de entrada sugerida; aterrizaje fuera: (9,12)='='.
    to: 'lunaris', tx: 9, ty: 12,
    label: 'Valle de Lunaris',
  },
  tienda: {
    key: 'tienda',
    map: INTERIOR_MAP_IDS.tienda,
    door: { x: 7, y: 9 },
    zone: { x: 6, y: 8, w: 3, h: 1 },
    entry: { x: 7, y: 7 },
    // Tienda = casa sudoeste de lunaris: house(7,27,5,9), puerta exterior (9,28).
    // (9,29)='=' zona de entrada sugerida; aterrizaje fuera: (9,30) ('.'/',').
    to: 'lunaris', tx: 9, ty: 30,
    label: 'Valle de Lunaris',
  },
  taberna: {
    key: 'taberna',
    map: INTERIOR_MAP_IDS.taberna,
    door: { x: 8, y: 10 },
    zone: { x: 7, y: 9, w: 3, h: 1 },
    entry: { x: 8, y: 8 },
    // Taberna = casa NW de la Aldea de Merrow: house(6,6,6,9), puerta (9,7),
    // SOLO en el pasado (aldeaDiffs). Zona de entrada sugerida (9,8); aterrizaje
    // (10,8)='.' — (9,9) es muro 'r' y caer DENTRO de la zona (9,8) re-dispararía
    // la salida (anti-bucle). El EXIT interior NO lleva needPast: el interior es atemporal y salir en
    // presente aterriza en las ruinas (findSafeTile rescata el tile libre).
    to: 'aldea', tx: 10, ty: 8,
    label: 'Aldea de Merrow',
  },
};

/** ExitDef estándar del motor a partir de la zona de salida interior. */
function toExitDef(e: InteriorExitDef): ExitDef {
  return {
    x: e.zone.x, y: e.zone.y, w: e.zone.w, h: e.zone.h,
    to: e.to, tx: e.tx, ty: e.ty, label: e.label,
  };
}

// ---------------- Filas (literales, w×h exacto) ----------------
// Verificación mental fila a fila: cada string mide exactamente w chars.

// CASA DE LA ANCIANA — 13×10. Cama 'r' oeste, hoguera 'V' al norte, mesa 'A',
// arca 'r' este, estantería '#' adosada al muro este, puerta (6,9).
const ROWS_ANCIANA: string[] = [
  '##V#HHHHH####', // 0: muro norte con ventanas 'H' y boca de hoguera 'V'
  '#_________###', // 1: estantería '#' (10,1)-(11,1) adosada al muro este
  '#rr_________#', // 2: cama (1,2)-(2,2)
  '#___________#', // 3: NPC Anciana Brisa en (4,3)
  '#_______AA__#', // 4: mesa (8,4)-(9,4)
  '#___________#', // 5
  '#_________rr#', // 6: arca (10,6)-(11,6)
  '#___________#', // 7: aterrizaje de entrada (6,7)
  '#___________#', // 8: ZONA DE SALIDA (5..7,8)
  '######d######', // 9: muro sur, puerta (6,9)
];

// TIENDA DE TALN — 14×10. Mostrador 'A' central, Taln detrás, estanterías '#'
// al norte, cajas 'R' y sacos 'r' contra los muros, puerta (7,9).
const ROWS_TIENDA: string[] = [
  '###HHHHHHHH###', // 0: muro norte con ventanas 'H'
  '#_##______##_#', // 1: estanterías '#' (2,1)-(3,1) y (10,1)-(11,1)
  '#____________#', // 2: pasillo trasero conectado (alcobas 1 y 12 respiran al sur)
  '#R__________R#', // 3: cajas (1,3) y (12,3); NPC Taln en (7,3), tras el mostrador
  '#____AAAA____#', // 4: mostrador (5,4)-(8,4)
  '#____________#', // 5: el Portador negocia desde aquí
  '#rr_________R#', // 6: sacos (1,6)-(2,6), caja (12,6)
  '#____________#', // 7: aterrizaje de entrada (7,7)
  '#____________#', // 8: ZONA DE SALIDA (6..8,8)
  '#######d######', // 9: muro sur, puerta (7,9)
];

// TABERNA DE MERROW — 16×11. Barra 'A' al oeste con tabernero detrás, hoguera
// 'V' en el muro norte, pilares 'P' centrales, mesas 'A' y banco 'r', cajas
// 'R', puerta (8,10).
const ROWS_TABERNA: string[] = [
  '##HHH#V###HHHH##', // 0: ventanas 'H' + hoguera 'V' (6,0) tras la barra
  '#_###__________#', // 1: repisas '#' tras la barra (2,1)-(4,1)
  '#______________#', // 2: NPC tabernero en (3,2)
  '#_AAA__________#', // 3: barra (2,3)-(4,3)
  '#__________AA__#', // 4: mesa este (11,4)-(12,4)
  '#____P____P____#', // 5: pilares (5,5) y (10,5)
  '#__AA________rr#', // 6: mesa oeste (3,6)-(4,6), banco (13,6)-(14,6)
  '#R____________R#', // 7: cajas (1,7) y (14,7)
  '#______________#', // 8: aterrizaje de entrada (8,8)
  '#______________#', // 9: ZONA DE SALIDA (7..9,9)
  '########d#######', // 10: muro sur, puerta (8,10)
];

// ---------------- MapDefs ----------------

/**
 * Los tres interiores. Sin chests/echoes/spawns/props a propósito: recinto
 * cálido y seguro (spawnEnemies y validateChests son no-op), el foco es el
 * NPC y el detalle. epochDiffs=[] → interiores atemporales.
 */
export const INTERIOR_MAPS: Record<InteriorKey, MapDef> = {
  anciana: {
    id: INTERIOR_MAP_IDS.anciana,
    name: 'Casa de la Anciana',
    subtitle: 'Lunaris · el hogar de Brisa',
    w: 13, h: 10,
    rows: ROWS_ANCIANA,
    epochDiffs: [],
    music: 'village',
    npcs: [toNpcDef(INTERIOR_NPCS.anciana)],
    chests: [],
    echoes: [],
    spawns: [],
    exits: [toExitDef(INTERIOR_EXITS.anciana)],
    props: [],
  },

  tienda: {
    id: INTERIOR_MAP_IDS.tienda,
    name: 'Tienda de Taln',
    subtitle: 'Lunaris · compra y venta de lo que queda',
    w: 14, h: 10,
    rows: ROWS_TIENDA,
    epochDiffs: [],
    music: 'village',
    npcs: [toNpcDef(INTERIOR_NPCS.tienda)],
    chests: [],
    echoes: [],
    spawns: [],
    exits: [toExitDef(INTERIOR_EXITS.tienda)],
    props: [],
  },

  taberna: {
    id: INTERIOR_MAP_IDS.taberna,
    name: 'Taberna de Merrow',
    subtitle: 'Aldea de Merrow · donde el mar aún canta',
    w: 16, h: 11,
    rows: ROWS_TABERNA,
    epochDiffs: [],
    music: 'aldea',
    npcs: [toNpcDef(INTERIOR_NPCS.taberna)],
    chests: [],
    echoes: [],
    spawns: [],
    exits: [toExitDef(INTERIOR_EXITS.taberna)],
    props: [],
  },
};
