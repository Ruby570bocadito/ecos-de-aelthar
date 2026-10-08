// ============================================================
// ECOS DE AELTHAR — hooks (PROPIEDAD DEL AGENTE 3-b · mecánicas)
// Punto de extensión de acciones de diálogo/mundo y sistema de
// tono del Portador (biblia: la personalidad moldea cómo te tratan).
// El motor llama aquí cuando applyAction no reconoce la acción.
// ============================================================

import type { Game } from './engine';
import type { DialogueOption, Player, ToneKind } from './types';
import { MEMORIES } from './data';
import { audio } from './audio';

const TONES: ToneKind[] = ['empatico', 'pragmatico', 'sarcastico', 'amenazante'];

const FAC_LABEL: Record<string, string> = {
  guardianes: 'Guardianes del Canto',
  orden: 'Orden de Vesh',
  circulo: 'Círculo Verde',
  liga: 'Liga de Mercaderes',
};

/** Lee el tono dominante guardado en flags (se guarda como string en runtime). */
export function toneFlagOf(flags: Record<string, number | boolean>): ToneKind | null {
  const v = flags.tonoDominante;
  return typeof v === 'string' ? (v as ToneKind) : null;
}

/**
 * Acciones extendidas de diálogo/mundo. Devuelve true si la acción fue
 * gestionada (el motor ignora el resto).
 * CONVENCIONES DE ACCIÓN (documentadas para el equipo):
 *   memory_<id>        → otorga una memoria del Portador (data.ts: MEMORIES),
 *                        una sola vez, con overlay de revelación.
 *                        Ej.: 'memory_mem_nana', 'memory_mem_casa'
 *   rep_<faccion>_<±n> → reputación de facción (guardianes|orden|circulo|liga),
 *                        clamp ±100, con toast de color según signo.
 *                        Ej.: 'rep_circulo_5', 'rep_orden_-5'
 *   eco_taken_mem      → ejecuta la acción original 'eco_taken' del motor y
 *                        concede 'mem_nana' (la nana: primera memoria del Eco).
 *   flag_<clave>       → activa una bandera simple (true); utilidad de contenido
 *                        (usada por data.ts: flag_metVult / flag_metMera / flag_metIvo).
 *   accept_q6          → Brisa ofrece el sur (fin del Acto I): acepta q6
 *                        'El Rumor del Mar' (engine.talkTo ya avanza q5→q6 antes
 *                        de resolver el nodo). Idempotente (flag q6, sin regreso).
 *   mara_met           → la conversación con Mara completa el objetivo de q6
 *                        (índice 5, paso 1) y abre q7.
 *   mara_gift          → Mara enciende el faro tras la Sirena (una vez):
 *                        +2 pociones, +5 rep. Círculo Verde, flag maraGift.
 *   mera_eco           → la Espectro de Merrow devuelve el Eco de los Nombres
 *                        (Eco menor): flag ecoNombres, +1 punto, sfx 'echo',
 *                        ráfaga dorada; si q8 (índice 7) está en su último paso,
 *                        avanza la cadena (→ q9).
 *   acto2_report       → el regreso final a Brisa cierra q10 (una vez):
 *                        flag acto2Done y +5 rep. Guardianes del Canto.
 */
export function handleCustomAction(g: Game, action: string): boolean {
  const p = g.player;
  if (!p || !action) return false;

  // memoria_<id>: memorias del séptimo Eco (biblia)
  if (action.startsWith('memory_')) {
    grantMemory(g, p, action.slice(7));
    return true;
  }

  // rep_<faccion>_<±n>: reputación de facciones (biblia: 4 facciones)
  if (action.startsWith('rep_')) {
    const m = /^rep_(guardianes|orden|circulo|liga)_([+-]?\d+)$/.exec(action);
    if (!m) return false;
    const fac = m[1];
    const delta = parseInt(m[2], 10);
    const rep = p.repFacciones ?? { guardianes: 0, orden: 0, circulo: 0, liga: 0 };
    const before = rep[fac] ?? 0;
    const after = Math.max(-100, Math.min(100, before + delta));
    rep[fac] = after;
    p.repFacciones = rep;
    const applied = after - before;
    g.toast(`${FAC_LABEL[fac]}: ${applied >= 0 ? '+' : ''}${applied}`, applied >= 0 ? '#8ef0b0' : '#e88a8a');
    return true;
  }

  // eco_taken_mem: el Eco de la Voz devuelve la primera memoria (la nana)
  if (action === 'eco_taken_mem') {
    g.applyAction('eco_taken'); // acción original del motor (flags.ecoVoz, +1 punto, +10 rep)
    grantMemory(g, p, 'mem_nana');
    return true;
  }

  // flag_<clave>: utilidades de contenido (banderas simples)
  if (action.startsWith('flag_')) {
    g.flags[action.slice(5)] = true;
    return true;
  }

  // ----- Acto II · Las Notas Perdidas (agente 8-a: historia y diálogos) -----

  // accept_q6: Brisa ofrece el sur — acepta q6 'El Rumor del Mar'.
  // Nota de coordinación: engine.talkTo ya avanza q5→q6 ANTES de resolver el
  // nodo, así que aquí normalmente questIdx ya es 5; la rama questIdx<5
  // auto-repara aceptaciones anticipadas (brisa_final en q4) o saves antiguos.
  if (action === 'accept_q6') {
    if (g.questIdx < 5) {
      g.questIdx = 5;
      g.questStep = g.flags.visited_costa ? 1 : 0; // como accept_q3 del motor
    }
    if (!g.flags.q6) {
      g.flags.q6 = true;
      audio.sfx('quest');
      g.toast('Nueva misión: El Rumor del Mar', '#8ef0b0');
    }
    return true;
  }

  // mara_met: hablar con Mara completa el objetivo de q6 (nodo mara_intro)
  // 11-a: el toast de 'Nueva misión' ya lo emite questAdvance (generalizado en
  // 8-b) — el explícito de aquí lo duplicaba en pantalla; se elimina.
  if (action === 'mara_met') {
    if (g.questIdx === 5 && g.questStep === 1) g.questAdvance();
    return true;
  }

  // mara_gift: Mara enciende el faro tras la Sirena y paga en pociones (una vez)
  if (action === 'mara_gift') {
    p.potions += 2;
    g.flags.maraGift = true;
    audio.sfx('potion');
    g.applyAction('rep_circulo_5'); // el Círculo Verde celebra que la costa vuelva a tener luz
    g.toast('Mara enciende el faro tras 300 años: +2 pociones', '#ffe9a0');
    return true;
  }

  // mera_eco: la Espectro devuelve el Eco de los Nombres (Eco menor de Merrow)
  // 11-a: el toast de 'Nueva misión' ya lo emite questAdvance (generalizado en
  // 8-b) — el explícito de aquí lo duplicaba en pantalla; se elimina.
  if (action === 'mera_eco') {
    g.flags.ecoNombres = true;
    p.points += 1;
    audio.sfx('echo');
    g.burst(p.x, p.y - 8, '#ffe9a0', 22, 70);
    if (g.questIdx === 7 && g.questStep === 2) g.questAdvance();
    g.toast('Eco de los Nombres recuperado: +1 punto de habilidad', '#ffe9a0');
    return true;
  }

  // acto2_report: el regreso final a Brisa cierra q10 (informe del Acto II)
  if (action === 'acto2_report') {
    if (g.questIdx === 9 && !g.flags.acto2Done) {
      g.flags.acto2Done = true;
      audio.sfx('quest');
      g.applyAction('rep_guardianes_5');
      g.toast('Misión completada: Dos Voces más Fuertes', '#8ef0b0');
    }
    return true;
  }

  return false;
}

/** Concede una memoria una única vez y lanza el overlay de revelación. */
function grantMemory(g: Game, p: Player, id: string): void {
  const mem = MEMORIES[id];
  if (!mem) return;
  p.memories = p.memories ?? [];
  if (p.memories.includes(id)) return; // ya concedida
  p.memories.push(id);
  g.memoryReveal = { id: mem.id, title: mem.title, text: mem.text, t: 5.5 };
  g.toast('Una memoria aflora...', '#ffe9a0');
  // sfx 'memory' es nuevo del contrato (lo añade 3-a); el switch de audio.sfx
  // no tiene default, así que un nombre desconocido es un no-op seguro.
  audio.sfx('memory');
}

/** Registra el tono de la opción de diálogo elegida (rasgo dominante). */
export function recordDialogueTone(g: Game, opt: DialogueOption): void {
  if (!opt.tone || !g.player) return;
  const p = g.player;
  p.tones = p.tones ?? { empatico: 0, pragmatico: 0, sarcastico: 0, amenazante: 0 };
  p.tones[opt.tone] = (p.tones[opt.tone] ?? 0) + 1;
  const dom = dominantTone(p);
  if (dom) {
    const prev = toneFlagOf(g.flags);
    if (prev !== dom) {
      // flags es Record<string, number | boolean> (types.ts congelado): el tono se
      // guarda como string en runtime mediante cast documentado.
      g.flags.tonoDominante = dom as unknown as number;
      if (prev) g.toast(`Tu forma de hablar empieza a definirte: ${TONE_LABEL[dom]}`, '#c8b0e8');
      // El rasgo deja huella: la primera vez que un tono se vuelve dominante,
      // la compañera lo nota (biblia: los compañeros reaccionan a tu personalidad).
      if (!g.flags[`toneSeen_${dom}`]) {
        g.flags[`toneSeen_${dom}`] = true;
        if (g.companion) {
          g.companion.affinity += 1;
          g.toast('Ilwen te mira de otra manera... te está entendiendo (+1 afinidad)', '#8ef0b0');
        }
      }
    }
  }
}

export const TONE_LABEL: Record<ToneKind, string> = {
  empatico: 'Empático',
  pragmatico: 'Pragmático',
  sarcastico: 'Sarcástico',
  amenazante: 'Amenazante',
};

/** Tono dominante actual (o null si aún no hay mínimo definido). */
export function dominantTone(p: Player): ToneKind | null {
  const t = p.tones;
  if (!t) return null;
  let best: ToneKind | null = null, bestN = 0, total = 0;
  for (const k of TONES) {
    total += t[k] ?? 0;
    if ((t[k] ?? 0) > bestN) { bestN = t[k] ?? 0; best = k; }
  }
  if (!best || total < 3) return null; // se necesita cierta consistencia
  return best;
}
