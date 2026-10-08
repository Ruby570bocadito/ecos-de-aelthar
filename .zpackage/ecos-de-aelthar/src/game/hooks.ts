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
 *   flag_<clave>       → activa una bandera simple (true); utilidad de contenido.
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
