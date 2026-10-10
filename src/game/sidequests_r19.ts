// ============================================================
// ECOS DE AELTHAR — 19-a · MISIONES SECUNDARIAS (sq4 · sq5 · sq6)
// «La Marea que Fue Canción» · «El Yunque Susurrado» · «El Custodio del Tomo»
// Módulo 100% ADITIVO: no edita ningún fichero existente. Estado por partida
// en WeakMap<Game,…>, cero Math.random (mulberry32 local, semilla fija) y
// solo `import type { Game }` desde engine (sin ciclos de valor).
//
// PUNTOS DE CABLEADO PARA EL INTEGRADOR (nombres exactos — verificados en el
// árbol post-R18; líneas actuales del árbol):
//
//  (1) engine.ts:210 — tras `initFaroSprites();` dentro del constructor:
//        initSecundariasR19(); // 19-a: NPCs/props de las secundarias (idempotente)
//      OPCIONAL: si no se llama, instalarSecundariasR19() se auto-instala de
//      forma perezosa en la primera interacción/tick (patrón biomas 18-a).
//
//  (2) data.ts:~1766 — dentro de getDialogueActo4, justo DESPUÉS de la ruta
//      del faro `{ const fr = faroRouteDialogue(nid, ctx); if (fr) return fr; }`:
//        { const sr = sqDialogueR19(nid, ctx); if (sr) return sr; } // 19-a: Iria/Odrik/Erev
//
//  (3) data.ts:~1909 — al final del fichero (tras el bloque 18-f), con
//      `import { SQ_R19_DIALOGUES, SQ_R19_QUESTS } from './sidequests_r19';` arriba:
//        Object.assign(D, SQ_R19_DIALOGUES);          // 19-a: 30 nodos de secundarias
//        QUESTS.push(...SQ_R19_QUESTS);               // 19-a: sq4/sq5/sq6 al final del array
//      NOTA: hacer el push al FINAL es seguro (questAdvance nunca se dispara
//      en q16 paso 1 — el epílogo cierra con 'end_demo'; el clamp de
//      Math.min(QUESTS.length-1) queda así sin efecto práctico).
//
//  (4) hooks.ts:59 — PRIMERA línea de handleCustomAction (fallback de
//      engine.applyAction, engine.ts:1235):
//        if (sqActionR19(g, action)) return true; // 19-a: accept_sq4..6 / sqN_reward
//
//  (5) update.ts:389 — tras `cumbresBiomaTick(g, dt); // 18-b`:
//        secundariasTickR19(g, dt); // 19-a: reconciliación de pasos (O(1))
//
//  (6) engine.ts tryInteract (~1524) — tras el rumor 16-b (1527) y ANTES de
//      `const it = this.nearestInteract();` (1528), con el import arriba:
//        { const sqt = sqPropTargetR19(this); // 19-a: campanas/vetas/lámparas
//          if (sqt) { audio.sfx('select'); sqPropUseR19(this, sqt); return; } }
//      IMPRESCINDIBLE que corra ANTES de nearestInteract: el motor etiqueta
//      por su cuenta los kind 'fragment' ('Fragmento de Eco' → voz_fragment)
//      y 'lamp' ('Encender el Farol del Recuerdo' → lightLamp) y ROBARÍA la
//      interacción de las vetas sq5_v* y las lámparas sq6_l*. Alternativa
//      aceptada: mismo código al inicio de interaccion.interaccionInteract16b
//      (interaccion.ts:351) — pero entonces sq4 (kind 'wreck', sin rama del
//      motor) no roba nada y sq5/sq6 necesitarían el sitio ANTES igualmente.
//      sqNpcLabelR19 es OPCIONAL: el motor ya etiqueta los NPC por dispName
//      («Hablar con Guardiana Iria»); se expone por contrato.
// ============================================================

import type { Game } from './engine'; // SOLO tipo (borrado en runtime: sin ciclo)
import type { DialogueNode, MapId, NpcDef, PropDef, QuestDef } from './types';
import { MAPS } from './maps';
import { audio } from './audio';

/** RNG determinista local (regla de la ronda: cero Math.random). Semilla fija:
 *  misma secuencia en cada arranque → comportamiento reproducible en smokes. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TILE = 16; // literal (precedente interludios.ts 18-f: cero aristas de valor)

// Deriva determinista de la semilla fija: margen anti-spam de los avisos
// (idéntico en cada arranque — sustituye con rigor a Math.random).
const SPAM_CD_19 = 1.5 + mulberry32(191909)() * 0.01;

// ============================================================
// 1) QUESTDEFS (2 pasos: objetivo por props → volver con el NPC)
// ============================================================

export const SQ_R19_QUESTS: QuestDef[] = [
  {
    id: 'sq4', name: 'La Marea que Fue Canción',
    steps: [
      'Recupera las 3 campanas de bruma de los restos hundidos de la Costa de Bruma (0/3)',
      'Vuelve con la Guardiana Iria en la orilla este de la costa',
    ],
  },
  {
    id: 'sq5', name: 'El Yunque Susurrado',
    steps: [
      'Extrae 2 vetas de hierro-niebla en las Cumbres Heladas (0/2)',
      'Vuelve con la Herrera Odrik en la plaza de Merrow',
    ],
  },
  {
    id: 'sq6', name: 'El Custodio del Tomo',
    steps: [
      'Enciende las 3 lámparas de eco: Bosque Susurrante, Costa de Bruma y Aldea de Merrow (0/3)',
      'Vuelve con el Custodio Erev, junto al altar de la Cripta',
    ],
  },
];

// ============================================================
// 2) NPCs y PROPS (auto-instalables en MAPS mediante instalarSecundariasR19)
//    Coordenadas verificadas transitables en AMBAS épocas (probe R19) y sin
//    pisar NPCs/cofres/ecos/spawns/props/salidas existentes.
// ============================================================

export const SQ_R19_NPCS: Record<string, { map: MapId; def: NpcDef }> = {
  iria: { map: 'costa', def: { id: 'iria', x: 44, y: 26, sprite: 'maelis', name: 'Guardiana Iria' } },
  odrik: { map: 'aldea', def: { id: 'odrik', x: 26, y: 15, sprite: 'brokk', name: 'Herrera Odrik' } },
  erev: { map: 'cripta', def: { id: 'erev', x: 26, y: 26, sprite: 'sombra', name: 'Custodio Erev' } },
};

export const SQ_R19_PROPS: Record<string, { map: MapId; def: PropDef }> = {
  // sq4 · campanas de bruma (restos de la flota que las llevó, kind 'wreck')
  sq4_c1: { map: 'costa', def: { id: 'sq4_c1', kind: 'wreck', x: 12, y: 28 } },
  sq4_c2: { map: 'costa', def: { id: 'sq4_c2', kind: 'wreck', x: 20, y: 31 } },
  sq4_c3: { map: 'costa', def: { id: 'sq4_c3', kind: 'wreck', x: 34, y: 23 } },
  // sq5 · vetas de hierro-niebla (kind 'fragment': el hierro que recuerda brilla)
  sq5_v1: { map: 'cumbres', def: { id: 'sq5_v1', kind: 'fragment', x: 17, y: 24 } },
  sq5_v2: { map: 'cumbres', def: { id: 'sq5_v2', kind: 'fragment', x: 36, y: 25 } },
  // sq6 · lámparas de eco (kind 'lamp', 1 por mapa; lit = flags[id])
  sq6_l1: { map: 'bosque', def: { id: 'sq6_l1', kind: 'lamp', x: 27, y: 18 } },
  sq6_l2: { map: 'costa', def: { id: 'sq6_l2', kind: 'lamp', x: 18, y: 20 } },
  sq6_l3: { map: 'aldea', def: { id: 'sq6_l3', kind: 'lamp', x: 18, y: 14 } },
};

// ============================================================
// 3) Configuración por quest (flags: accept_sqN · sqN · sqN_step · sqN_done ·
//    flags por prop: sq4_c1..sq6_l3). Convención de flags del proyecto.
// ============================================================

type SqId = 'sq4' | 'sq5' | 'sq6';

interface SqConf {
  id: SqId;
  name: string;
  nid: string;              // id del NPC que la da
  propIds: string[];        // ids de props objetivo, en orden de pista
  label: string;            // etiqueta de interacción
  sfx: 'song' | 'break' | 'lamp';
  color: string;
  float: string;            // floatText al recoger
  progressWord: string;     // sustantivo para el toast de progreso
  completeToast: string;
  returnHint: string;       // toast de reconciliación al completar objetivo
}

const SQ_CONF: Record<SqId, SqConf> = {
  sq4: {
    id: 'sq4', name: 'La Marea que Fue Canción', nid: 'iria',
    propIds: ['sq4_c1', 'sq4_c2', 'sq4_c3'],
    label: 'Recoger campana de bruma',
    sfx: 'song', color: '#8ef0ff', float: 'Una campana se libera de la sal',
    progressWord: 'Campana de bruma recuperada',
    completeToast: 'Las tres campanas juntas piden volver a la orilla: habla con la Guardiana Iria',
    returnHint: 'Las campanas reúnen su coro: vuelve con la Guardiana Iria',
  },
  sq5: {
    id: 'sq5', name: 'El Yunque Susurrado', nid: 'odrik',
    propIds: ['sq5_v1', 'sq5_v2'],
    label: 'Extraer veta de hierro-niebla',
    sfx: 'break', color: '#a8d8ff', float: 'El hierro recuerda tu mano',
    progressWord: 'Veta de hierro-niebla extraída',
    completeToast: 'Hierro suficiente para el temple: vuelve con la Herrera Odrik',
    returnHint: 'El hierro-niebla canta en tu saco: vuelve con la Herrera Odrik',
  },
  sq6: {
    id: 'sq6', name: 'El Custodio del Tomo', nid: 'erev',
    propIds: ['sq6_l1', 'sq6_l2', 'sq6_l3'],
    label: 'Encender lámpara de eco',
    sfx: 'lamp', color: '#ffe9a0', float: 'Un recuerdo que nadie reclamaba arde',
    progressWord: 'Lámpara de eco encendida',
    completeToast: 'Tres luces fuera del tiempo: el Tomo espera en la Cripta, junto al Custodio Erev',
    returnHint: 'Las tres lámparas arden: vuelve con el Custodio Erev',
  },
};

const SQ_LIST: SqConf[] = [SQ_CONF.sq4, SQ_CONF.sq5, SQ_CONF.sq6];

/** prop id → quest propietaria (para sqPropLabelR19 / sqPropUseR19). */
const PROP2CONF: Record<string, SqConf> = {};
for (const c of SQ_LIST) for (const pid of c.propIds) PROP2CONF[pid] = c;

// ---------------- Estado por partida (WeakMap, no serializa) ----------------

interface S19State {
  t: number;              // reloj propio (determinista)
  busyWarnAt: number;     // anti-spam del aviso «Termínala primero»
  hintAt: number;         // anti-spam del toast de reconciliación
}

const STATES19 = new WeakMap<Game, S19State>();

function state19For(g: Game): S19State {
  let s = STATES19.get(g);
  if (!s) {
    s = { t: 0, busyWarnAt: -9, hintAt: -9 };
    STATES19.set(g, s);
  }
  return s;
}

// ============================================================
// 4) Instalación idempotente en MAPS (NPCs + props). Guard con flag de
//    módulo + verificación por id (doble blindaje HMR/multi-instancia).
// ============================================================

let installed19 = false;

export function instalarSecundariasR19(): void {
  if (installed19) return;
  installed19 = true;
  const pushIfNew = <T extends { id: string }>(arr: T[], def: T): void => {
    if (!arr.some(x => x.id === def.id)) arr.push(def);
  };
  for (const key of Object.keys(SQ_R19_NPCS)) {
    const { map, def } = SQ_R19_NPCS[key];
    pushIfNew(MAPS[map].npcs, def);
  }
  for (const key of Object.keys(SQ_R19_PROPS)) {
    const { map, def } = SQ_R19_PROPS[key];
    pushIfNew(MAPS[map].props, def);
  }
}

/** Alias para engine.ts:210 (misma instalación idempotente). */
export function initSecundariasR19(): void {
  instalarSecundariasR19();
}

/** Auto-instalación perezosa (por si el integrador no cablea engine.ts:210). */
function ensureInstalled19(): void {
  if (!installed19) instalarSecundariasR19();
}

// ============================================================
// 5) RUTEO DE DIÁLOGO (data.ts, getDialogueActo4). Prioridad: done →
//    activa (listo/progress) → ocupada (otra secundaria en curso) → intro.
// ============================================================

export function sqDialogueR19(
  nid: string,
  ctx: { questIdx: number; questStep: number; flags: Record<string, number | boolean>; companion: boolean },
): string | null {
  const f = ctx.flags;
  const activa = (id: SqId): boolean => !!f[id] && !f[`${id}_done`];
  for (const c of SQ_LIST) {
    if (c.nid !== nid) continue;
    if (f[`${c.id}_done`]) return `${c.id}_${nid}_done`;
    if (activa(c.id)) {
      return Number(f[`${c.id}_step`] ?? 0) >= 1 ? `${c.id}_${nid}_listo` : `${c.id}_${nid}_progress`;
    }
    const otra = SQ_LIST.find(o => o.id !== c.id && activa(o.id));
    if (otra) return `${c.id}_${nid}_busy`;
    return `${c.id}_${nid}_intro`;
  }
  return null;
}

// ============================================================
// 6) ACCIONES DE DIÁLOGO (delegación desde hooks.handleCustomAction).
//    'accept_sqN' y 'sqN_reward'. Devuelve true si la acción es de 19-a.
// ============================================================

export function sqActionR19(g: Game, action: string): boolean {
  if (action.startsWith('accept_sq')) {
    const conf = SQ_CONF[('sq' + action.slice(9)) as SqId];
    if (!conf) return false;
    acceptR19(g, conf);
    return true;
  }
  if (action.startsWith('sq') && action.endsWith('_reward')) {
    const conf = SQ_CONF[action.slice(0, 3) as SqId];
    if (!conf) return false;
    rewardR19(g, conf);
    return true;
  }
  return false;
}

function otraActiva(g: Game, yo: SqId): SqConf | null {
  return SQ_LIST.find(o => o.id !== yo && !!g.flags[o.id] && !g.flags[`${o.id}_done`]) ?? null;
}

function acceptR19(g: Game, conf: SqConf): void {
  if (g.challengeRun) return; // la arena no participa de la campaña
  const f = g.flags;
  if (f[`${conf.id}_done`]) return; // ya cobrada: el ruteo nunca llega aquí
  if (f[conf.id]) {
    audio.sfx('blip');
    g.toast(`«${conf.name}» sigue abierta: vuelve cuando la tengas`, '#9aa0b8');
    return;
  }
  // «Una sola secundaria en curso»
  const otra = otraActiva(g, conf.id);
  if (otra) {
    const st = state19For(g);
    if (st.t - st.busyWarnAt > SPAM_CD_19) {
      st.busyWarnAt = st.t;
      audio.sfx('error');
      g.toast(`Termínala primero: «${otra.name}» sigue abierta`, '#e8a0a0');
    }
    return;
  }
  f[`accept_${conf.id}`] = true;
  f[conf.id] = true;
  f[`${conf.id}_step`] = 0;
  audio.sfx('quest');
  g.toast(`Nueva misión secundaria: ${conf.name}`, '#8ef0b0');
}

function rewardR19(g: Game, conf: SqConf): void {
  const p = g.player;
  if (!p || g.challengeRun) return;
  const f = g.flags;
  if (f[`${conf.id}_done`]) return; // UNA vez: segunda llamada = no-op
  if (!f[conf.id]) return;          // nunca aceptada: nada que cobrar
  // sincronización defensiva (save raro / cableado parcial): recontar por flags
  const nGot = conf.propIds.filter(id => !!f[id]).length;
  if (nGot >= conf.propIds.length) f[`${conf.id}_step`] = 1;
  if (Number(f[`${conf.id}_step`] ?? 0) < 1) {
    audio.sfx('error');
    g.toast(`${conf.name}: el objetivo aún no está completo`, '#e8a0a0');
    return;
  }
  f[`${conf.id}_done`] = true;
  f[conf.id] = false;               // desactiva (hecho queda en *_done)
  audio.sfx('coin');
  g.burst(p.x, p.y - 8, '#ffe9a0', 18, 70);
  if (conf.id === 'sq4') {
    p.gold += 150;
    p.potions += 1;
    g.gainXp(120);
    if (!g.challengeRun) g.stats.coronasGanadas += 150;
    g.toast('Misión completada: La Marea que Fue Canción (+150 coronas, +1 poción, +120 XP)', '#8ef0b0');
    g.toast('Iria afina las campanas: la costa vuelve a tener coro', '#ffe9a0');
  } else if (conf.id === 'sq5') {
    p.gold += 80;
    if (!g.challengeRun) g.stats.coronasGanadas += 80;
    if (p.weaponPlus < 5) {
      p.weaponPlus += 1;            // UNA vez (flag sq5_done lo garantiza)
      g.toast('Misión completada: El Yunque Susurrado (+80 coronas, arma +1)', '#8ef0b0');
      g.toast(`El temple de Odrik te acompaña: arma +${p.weaponPlus}`, '#f0c84a');
      audio.sfx('confirm');
    } else {
      p.gold += 60; // el acero ya no admite más filo: Odrik paga en coronas
      if (!g.challengeRun) g.stats.coronasGanadas += 60;
      g.toast('Misión completada: El Yunque Susurrado (+140 coronas)', '#8ef0b0');
      g.toast('Odrik: «tu acero ya no admite más filo. Coronas, que el carbón no es gratis.»', '#e8c88a');
    }
  } else {
    f.tomo_canto = true;            // desbloquea el menú de magias (otro agente)
    g.gainXp(200);
    p.gold += 100;
    if (!g.challengeRun) g.stats.coronasGanadas += 100;
    audio.sfx('echo');
    g.toast('Misión completada: El Custodio del Tomo (+200 XP, +100 coronas)', '#8ef0b0');
    g.toast('El Tomo del Canto se abre: notas que ya llevabas dentro (tomo_canto)', '#ffe9a0');
  }
}

// ============================================================
// 7) INTERACCIÓN DE PROPS (contrato del integrador para tryInteract)
// ============================================================

/** Etiqueta de interacción para props de 19-a, o null si no procede. */
export function sqPropLabelR19(g: Game, prop: PropDef): string | null {
  if (!g.player) return null;
  const conf = PROP2CONF[prop.id];
  if (!conf) return null;
  const f = g.flags;
  if (!f[conf.id] || f[`${conf.id}_done`]) return null;  // quest no activa
  if (Number(f[`${conf.id}_step`] ?? 0) !== 0) return null; // fase de vuelta
  if (f[prop.id]) return null;                            // ya conseguido
  return conf.label;
}

/**
 * Consume la interacción de un prop de 19-a: avanza el objetivo, tostón +
 * sfx + float. Devuelve true si la interacción fue de 19-a (el caller corta
 * la cadena). No exige distancia: la proximidad la filtra sqPropTargetR19.
 */
export function sqPropUseR19(g: Game, prop: PropDef): boolean {
  ensureInstalled19();
  if (!g.player || g.state !== 'play') return false;
  const conf = PROP2CONF[prop.id];
  if (!conf) return false;
  const f = g.flags;
  if (!f[conf.id] || f[`${conf.id}_done`]) return false;
  if (Number(f[`${conf.id}_step`] ?? 0) !== 0) return false;
  if (f[prop.id]) return false; // ya recogida/encendida: no robar la interacción
  f[prop.id] = true;
  const px = prop.x * TILE + 8, py = prop.y * TILE + 8;
  audio.sfx(conf.sfx);
  g.burst(px, py - 6, conf.color, 12, 55);
  g.floatAt(px, py - 14, conf.float, conf.color, 6);
  const n = conf.propIds.filter(id => !!f[id]).length;
  const total = conf.propIds.length;
  if (n >= total) {
    f[`${conf.id}_step`] = 1;
    audio.sfx('quest');
    g.toast(conf.completeToast, '#ffe9a0');
  } else {
    g.toast(`${conf.progressWord} (${n}/${total})`, '#8ef0b0');
  }
  return true;
}

/**
 * Prop de 19-a interactuable más cercano al Portador (radio 30 px, el mismo
 * de los props del motor). Devuelve el PropDef o null. El integrador lo usa
 * en tryInteract ANTES de nearestInteract (ver cabecera, punto 6).
 */
export function sqPropTargetR19(g: Game): PropDef | null {
  ensureInstalled19();
  const p = g.player;
  if (!p || g.state !== 'play') return null;
  let best: PropDef | null = null;
  let bd = 30;
  for (const pr of g.map.props) {
    if (pr.needPast && g.epoch !== 'pasado') continue;
    if (pr.needPresent && g.epoch !== 'presente') continue;
    if (!sqPropLabelR19(g, pr)) continue;
    const d = Math.hypot(pr.x * TILE + 8 - p.x, pr.y * TILE + 8 - p.y);
    if (d < bd) { bd = d; best = pr; }
  }
  return best;
}

/** Etiqueta de los NPC de 19-a (contracto; el motor ya etiqueta por dispName). */
export function sqNpcLabelR19(g: Game, npc: { nid: string; dispName: string }): string | null {
  if (!g.player) return null;
  for (const c of SQ_LIST) {
    if (c.nid === npc.nid) return `Hablar con ${npc.dispName}`;
  }
  return null;
}

// ============================================================
// 8) TICK (update.ts:389). O(1)/frame: reconciliación idempotente de pasos.
//    Cubre cualquier orden de cableado y estados raros: si el motor encendió
//    una lámpara sq6_l* por su rama 'lamp' (lightLamp), el tick la cuenta;
//    repara steps NaN/fuera de rango y avisa UNA vez al completar objetivo.
// ============================================================

export function secundariasTickR19(g: Game, dt: number): void {
  if (!g.player || g.state !== 'play' || g.challengeRun) return;
  ensureInstalled19();
  const st = state19For(g);
  st.t += dt;
  for (const conf of SQ_LIST) {
    const f = g.flags;
    const key = `${conf.id}_step`;
    let step = Number(f[key] ?? 0);
    if (!Number.isFinite(step)) { step = 0; f[key] = 0; } // reparación NaN
    if (step !== 0 && step !== 1) { step = 0; f[key] = 0; }
    if (!f[conf.id] || f[`${conf.id}_done`]) continue;
    const n = conf.propIds.filter(id => !!f[id]).length;
    const want = n >= conf.propIds.length ? 1 : 0;
    if (step !== want) {
      f[key] = want;
      if (want === 1 && st.t - st.hintAt > 2) {
        st.hintAt = st.t;
        audio.sfx('quest');
        g.toast(conf.returnHint, '#ffe9a0');
      }
    }
  }
}

// ============================================================
// 9) DIÁLOGOS (30 nodos). Voz del juego: «Portador», «el Canto», «la Niebla»,
//    tono poético-melancólico. Cada quest: intro (3 tonos) → historia →
//    pedir (accept) → progreso (con pista) → listo (recompensa) → done/busy.
// ============================================================

export const SQ_R19_DIALOGUES: Record<string, DialogueNode> = {
  // ======================= sq4 · Guardiana Iria =======================
  sq4_iria_intro: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: 'No te había oído llegar, Portador: aquí el mar se come los pasos. (Recoge arena y la deja caer despacio) Fui Guardiana del Canto en la única capilla que importaba de verdad: la de la orilla. Cantábamos las mareas para que los barcos supieran cuándo volver a casa.',
    options: [
      { text: 'Te escucho, Guardiana. Habla: el mar y tú sabéis esperar.', next: 'sq4_iria_historia', tone: 'empatico' },
      { text: '¿Qué necesitas de mí? Habla claro y breve.', next: 'sq4_iria_pedir', tone: 'pragmatico' },
      { text: 'Una capilla sin techo, una guardiana sin coro. ¿Y yo qué cobro por escuchar?', next: 'sq4_iria_sarc', tone: 'sarcastico' },
    ],
  },
  sq4_iria_sarc: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: '(Iria ríe poco, como quien recuerda cómo se hacía) Cobras en historias, Portador. Es la única moneda que la Niebla no sabe robar: ya llevas unas cuantas encima y todavía no te has hundido. Escucha una más, que esta moja.',
    next: 'sq4_iria_historia',
  },
  sq4_iria_historia: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: 'Las Campanas de Bruma guiaban la flota: tres bronces que sonaban distinto cada una, y el mar aprendía su coro como un niño aprende el nombre de su madre. La noche que el Canto murió, la Niebla salió del mar en vez de entrar en él. Se llevó los barcos primero. Las campanas fueron al fondo con ellos... y yo me quedé cantando a una capilla sin fieles.',
    next: 'sq4_iria_pedir',
  },
  sq4_iria_pedir: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: 'Quedan tres restos de aquella flota en esta costa: al oeste, donde la hierba se rinde a la arena; en la playa del sur, bajo las tablas; y junto al camino del este, donde la marea ya no llega. Las campanas siguen ahí, ahogadas en sal. Sácalas. No pido que suenen como antes. Pido que suenen.',
    options: [
      { text: 'Las traeré. Volveré con las tres.', action: 'accept_sq4', tone: 'empatico' },
      { text: 'Bronce hundido para una capilla vacía... está bien. ¿Y mi parte?', action: 'accept_sq4', tone: 'pragmatico' },
      { text: '¿Y si suenan y no hay nadie que las oiga?', next: 'sq4_iria_duda', tone: 'amenazante' },
    ],
  },
  sq4_iria_duda: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: 'Entonces sonarán para el mar, que siempre oye y casi nunca contesta. Yo llevé su coro treinta años sin público y no me arrepiento de una sola marea. Llévalas, Portador: lo que un canto hunde, otro canto lo sube.',
    onEnd: 'accept_sq4',
  },
  sq4_iria_progress: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: 'Aún las oigo bajo el agua, Portador... El oeste, donde la hierba se rinde a la arena. La playa del sur, bajo las tablas. El camino del este, donde la marea ya no llega. La sal es paciente; tú no lo serás menos.',
    options: [
      { text: '(Seguir buscando)', tone: 'pragmatico' },
      { text: '¿Por qué tú no las sacas?', next: 'sq4_iria_manos', tone: 'empatico' },
    ],
  },
  sq4_iria_manos: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: 'Porque las manos que las hundieron eran como las mías. El mar guarda esa cuenta desde entonces: lo que un canto hunde, otro canto lo sube. Yo ya canté mi parte. La tuya empieza donde termina la marea.',
    options: [{ text: '(Volver a la orilla)' }],
  },
  sq4_iria_listo: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: '...¿Las oyes? (No ha sonado nada, y sin embargo) Limpias de sal, limpias de silencio. Cada una guarda una marea distinta dentro: la que llama, la que responde, la que se queda. Toma lo prometido. Y una lección gratis, Portador: lo que la Niebla hunde siempre flota en alguna parte. Solo hace falta alguien dispuesto a mojarse.',
    options: [
      { text: '(Cobrar lo prometido: el bronce manda en la marea)', action: 'sq4_reward', tone: 'pragmatico' },
      { text: '(Quédate el coro, Guardiana. Yo solo las saqué del agua.)', action: 'sq4_reward', tone: 'empatico' },
      { text: '(Marcharse sin cobrar... por ahora)' },
    ],
  },
  sq4_iria_done: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: '(Afina una de las campanas con la uña) La capilla no tiene techo ni fieles, pero ya tiene voz. Cuando el mar se ponga pesado, ven: te enseño qué marea pide cada canción. Y gracias, Portador. Lo que devuelves nunca vuelve vacío.',
    options: [{ text: '(Saludar y seguir camino)' }],
  },
  sq4_iria_busy: {
    name: 'Guardiana Iria', portrait: 'maelis',
    text: 'No te daré tarea que pese doble, Portador: traes las manos llenas de otra promesa. Termínala primero. La marea sabe esperar mejor que nadie, y yo aprendí de ella.',
    options: [{ text: '(Asentir)' }],
  },

  // ======================= sq5 · Herrera Odrik =======================
  sq5_odrik_intro: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: '¡Eh, tú! ¡Ni un paso más! (Una enana baja el martillo a medio golpe) ¿Lo sientes? No, no es el martillo: es el yunque. Lleva tres días susurrando y a mí no me susurra NADIE. Herrera Odrik, de las cumbres. Y este pueblo muerto tiene algo que le canta a mi hierro.',
    options: [
      { text: 'Te escucho, herrera. ¿Qué dice tu yunque?', next: 'sq5_odrik_historia', tone: 'empatico' },
      { text: '¿Trabajo bien pagado? Entonces habla.', next: 'sq5_odrik_pedir', tone: 'pragmatico' },
      { text: 'Un yunque con opiniones. Lo que faltaba me hacía.', next: 'sq5_odrik_sarc', tone: 'sarcastico' },
    ],
  },
  sq5_odrik_sarc: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: 'Je. Risas de plaza muerta. El metal no tiene opiniones, Portador: tiene MEMORIA. Y este yunque lleva semanas despertándose con nombres que no le di yo. Ríete tú ahora, a ver si el hierro te deja reírte siempre.',
    next: 'sq5_odrik_pedir',
  },
  sq5_odrik_historia: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: 'Mi yunque viene de las cumbres: del taller donde mi abuela templaba campanas antes de la Noche del Silencio. El hierro bien golpeado recuerda el ritmo, y este... este recuerda DEMASIADO. Desde que llegué a Merrow susurra notas que no le di. Notas de festival. La Niebla borró al pueblo, pero el hierro se quedó con la música que aún le quedaba dentro.',
    next: 'sq5_odrik_pedir',
  },
  sq5_odrik_pedir: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: 'Para retemplarlo necesito hierro-niebla: el mineral que crece en las Cumbres Heladas donde el silencio fue más fuerte y aun así no se dobló. Dos vetas. Marca la nieve con un brillo que no es hielo. (Apreta los dientes) Y no lo confundas con los cristales de los altares: eso es del dios, esto es de la montaña. Tráemelas y te dejo el brazo más afilado que salga de mi forja.',
    options: [
      { text: 'Dos vetas. Volveré con la nieve en las botas.', action: 'accept_sq5', tone: 'pragmatico' },
      { text: 'Por el yunque, por el pueblo y por tu abuela. Voy.', action: 'accept_sq5', tone: 'empatico' },
      { text: 'El metal que recuerda... ¿y si recuerda demasiado?', next: 'sq5_odrik_temor', tone: 'amenazante' },
    ],
  },
  sq5_odrik_temor: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: 'Ese es el oficio, Portador: templar lo que recuerda para que no se vuelva loco de memoria. Lo mismo hago yo con el hierro que tú con el Canto. Dos vetas. El resto es mi mano, y mi mano no ha fallado nunca... delante de testigos.',
    onEnd: 'accept_sq5',
  },
  sq5_odrik_progress: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: '¿Vetas? Dos. Hierro-niebla: el brillo que no es hielo. Una en la ladera del oeste, mirando al lago helado; otra al este, donde la nieve hace cuesta abajo hacia el paso. (Vuelve al martillo) El yunque no espera... bueno, sí espera: lleva trescientos años esperando. Pero YO no.',
    options: [
      { text: '(Volver al camino)', tone: 'pragmatico' },
      { text: '¿Por qué no vas tú por ellas?', next: 'sq5_odrik_manos', tone: 'sarcastico' },
    ],
  },
  sq5_odrik_manos: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: 'Porque las montañas ya me conocieron las manos vacías una vez, y no pienso darles la satisfacción de la segunda. Tú tienes mejor pinta de volver. Vete, que la nieve no guarda las huellas de nadie.',
    options: [{ text: '(Asentir)' }],
  },
  sq5_odrik_listo: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: '(Tira las vetas al fuego y el taller entero huele a tormenta) AHÍ. ¿Lo oyes? El yunque ya no susurra: CANTA. Sujétate a algo, Portador... (Cinco golpes, ni uno de más) Listo. El temple de mi abuela para tu brazo. Un arma mejor forjada no te hace invencible: te hace digno de intentarlo. Y coronas, porque mi abuela también decía que la gratitud no paga el carbón.',
    options: [
      { text: '(Recibir el temple y lo prometido)', action: 'sq5_reward', tone: 'pragmatico' },
      { text: '(Gracias, Odrik. Por el yunque... y por lo que recuerda.)', action: 'sq5_reward', tone: 'empatico' },
      { text: '(Marcharse: el metal seguirá ahí mañana)' },
    ],
  },
  sq5_odrik_done: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: '(El yunque suena limpio: una nota por golpe) Mi abuela templaba así las campanas de la costa. Si algún día alguien las reúne todas... quiero estar. Mientras tanto, si tu arma pide más voz, ya sabes qué enana busca. Y dile a tu canto que practique: el hierro nota cuando el dueño canta mal.',
    options: [{ text: '(Despedirse)' }],
  },
  sq5_odrik_busy: {
    name: 'Herrera Odrik', portrait: 'brokk',
    text: '¡Ni una tarea más, Portador! Llevas las manos llenas con otra promesa, y el hierro desprecia a los distraídos: se venga en los dedos. Termínala primero, y luego hablamos de temple.',
    options: [{ text: '(Levantar las manos en señal de paz)' }],
  },

  // ======================= sq6 · Custodio Erev =======================
  sq6_erev_intro: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: '(La sombra gira hacia ti sin tener rostro que girar) Un Portador. Bajas tan pronto. Yo soy Erev, y no recuerdo si ese fue siempre mi nombre o si la Cripta me lo prestó. Custodio del Tomo del Canto: el libro que guarda las notas que el héroe aún no sabía llevar.',
    options: [
      { text: '¿Qué es el Tomo, custodio? Habla: aquí abajo sobra el tiempo.', next: 'sq6_erev_tomo', tone: 'empatico' },
      { text: 'Un libro guardado trescientos años quiere algo. Dime qué.', next: 'sq6_erev_pedir', tone: 'pragmatico' },
      { text: 'Enséñamelo. Ahora.', next: 'sq6_erev_exigir', tone: 'amenazante' },
    ],
  },
  sq6_erev_exigir: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: '(La sombra no retrocede: las sombras rara vez lo hacen) El Tomo no se enseña, Portador: se ENCIENDE. Y tú llegaste con las manos vacías de luz. Escucha primero. Es lo único que pido y lo único que suelo conseguir.',
    next: 'sq6_erev_pedir',
  },
  sq6_erev_tomo: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: 'Cada canto que alguien llevó sin poder sostenerlo acabó entre estas páginas: nanas que se olvidaron al alba, nombres dichos una sola vez, la nota que se te escapó en el peor momento. El Tomo no enseña magias nuevas, Portador: devuelve las que ya llevabas dentro y no sabías cargar. Pero para leerlo hace falta luz de eco. La mía se gastó... hace tanto.',
    next: 'sq6_erev_pedir',
  },
  sq6_erev_pedir: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: 'Quedan tres Lámparas de Eco fuera del tiempo de los hombres: una en el Bosque Susurrante, otra en la Costa de Bruma, otra en la Aldea de Merrow. No queman aceite: queman recuerdos que nadie reclama. Enciéndelas. Una chispa de eco basta, y las tres juntas abrirán el Tomo aunque yo haya dejado de existir cuando vuelvas.',
    options: [
      { text: 'Tres lámparas. Volveré con la luz.', action: 'accept_sq6', tone: 'empatico' },
      { text: 'Recuerdos que nadie reclama... esa moneda sí la llevo.', action: 'accept_sq6', tone: 'pragmatico' },
      { text: '¿Y si no quiero prender fuego a recuerdos ajenos?', next: 'sq6_erev_duda', tone: 'amenazante' },
    ],
  },
  sq6_erev_duda: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: 'Nadie reclama lo que ya no se recuerda, Portador. La lámpara no roba: recoge lo que la Niebla dejó tirado. Hay pueblos enteros hechos de eso. Si te pesa, enciende una con un recuerdo tuyo: el Tomo no mira de dónde viene la luz. Solo mira que haya.',
    onEnd: 'accept_sq6',
  },
  sq6_erev_progress: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: 'Faltan lámparas, Portador. El Bosque, entre los pinos del camino viejo. La Costa, junto a la hierba que aún sabe de sal. La Aldea, en la plaza donde el pozo no devuelve nombres. (Pausa) Yo estaré aquí. Estar aquí es lo que hago.',
    options: [
      { text: '(Seguir buscando)', tone: 'pragmatico' },
      { text: '¿Qué ganaré con tu Tomo abierto?', next: 'sq6_erev_precio', tone: 'amenazante' },
    ],
  },
  sq6_erev_precio: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: 'Nada que se pueda apuñalar, si es eso lo que preguntas. Notas. Las tuyas. Las que perdiste antes de saber que las llevabas. A eso los sabios lo llaman aprender, y los héroes, de otro modo que nunca aprenden a decir.',
    options: [{ text: '(Callar y salir)' }],
  },
  sq6_erev_listo: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: '(Las tres luces llegan a la vez, como si se hubieran puesto de acuerdo) Ahora, Portador. MIRA. (El Tomo se abre solo, y las páginas no tienen letras: tienen esperas) Lo que se enciende en ti no es nuevo. Es lo que SIEMPRE llevaste. Toma las coronas de los peregrinos que ya no volverán a por ellas, y aprende despacio: el Tomo también te lee.',
    options: [
      { text: '(Recibir la luz del Tomo)', action: 'sq6_reward', tone: 'empatico' },
      { text: '(Leer una sola página. Por ahora.)', action: 'sq6_reward', tone: 'pragmatico' },
      { text: '(Marcharse: la Cripta ya es bastante oscura)' },
    ],
  },
  sq6_erev_done: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: '(El Tomo respira en tu memoria, no en tus manos) Lee despacio, Portador: el Tomo también te lee, y anota. Cuando sepas qué nota eres, vuelve. Aún me deben un nombre, y me gustaría recordarlo antes de que la Cripta termine de recordarme por mí.',
    options: [{ text: '(Inclinar la cabeza)' }],
  },
  sq6_erev_busy: {
    name: 'Custodio Erev', portrait: 'sombra',
    text: 'Llevas ya una promesa sin cumplir, Portador, y el Tomo no se abre para manos ocupadas. Termínala primero. Yo soy paciente: es lo único que todavía sé hacer de memoria.',
    options: [{ text: '(Retroceder un paso)' }],
  },
};
