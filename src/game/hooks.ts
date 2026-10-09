// ============================================================
// ECOS DE AELTHAR — hooks (PROPIEDAD DEL AGENTE 3-b · mecánicas)
// Punto de extensión de acciones de diálogo/mundo y sistema de
// tono del Portador (biblia: la personalidad moldea cómo te tratan).
// El motor llama aquí cuando applyAction no reconoce la acción.
// ============================================================

import type { Game } from './engine';
import type { DialogueNode, DialogueOption, Player, ToneKind } from './types';
import { MEMORIES } from './data';
import { ACTO3_ELITE } from './data';
import { ACTO4_BOSS, ACTO4_FIN_BASE, ACTO4_FIN_JEFES } from './data';
import { audio } from './audio';

const TONES: ToneKind[] = ['empatico', 'pragmatico', 'sarcastico', 'amenazante'];

// R7-O4: tablas de módulo para los contadores de flags por-categoría. Antes
// eran literales `as const` reconstruidos en CADA llamada (recs ×3, ecos, cams);
// la ruta es por-evento (acción de diálogo), no por-frame, pero así
// handleCustomAction queda con CERO allocations en todas sus ramas.
const RECS = ['recMera', 'recMara', 'recIvo', 'recVult'] as const;
const ECOS_INV = ['ecoInvTeo', 'ecoInvDoran', 'ecoInvMara'] as const;
const CAMS = ['camMera', 'camCumbres'] as const;

// Contrato de rendimiento de este módulo (R7-O4, verificado): TODO lo de aquí
// es por-EVENTO (engine.applyAction→handleCustomAction, engine.advanceDialogue→
// recordDialogueTone, worldlife.fireRumor→dominantTone) — NADA corre dentro del
// RAF del motor. dominantTone es O(4) sin allocations (bucle sobre TONES);
// sus únicos consumidores por-frame son el panel de personaje abierto
// (screens.ts) y el disparo de rumores (cada 8-14 s por NPC) → sin memo.

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

  // ----- Acto III · El Canto al Revés (agente 13-a: historia y diálogos) -----
  // Watcher idempotente (patrón catchUpActo2, pero viviendo en hooks): O(1)
  // fuera del rango q11-q13; completa por ESTADO los pasos que pudieron
  // cumplirse antes de aceptar la misión o cuyo evento del motor (killEnemy
  // del Guardián recordado) no dispara questAdvance para índices nuevos.
  acto3CatchUp(g);

  // accept_q11: Brisa ofrece el Acto III («el Canto sonó al revés»); acepta q11.
  // Con questIdx<10 auto-repara aceptaciones anticipadas o saves antiguos
  // (mismo principio de accept_q6).
  if (action === 'accept_q11') {
    if (g.questIdx < 10) { g.questIdx = 10; g.questStep = 0; }
    if (!g.flags.q11) {
      g.flags.q11 = true;
      audio.sfx('quest');
      g.toast('Nueva misión: El Canto al Revés', '#8ef0b0');
    }
    return true;
  }

  // acto3_toln: la conversación con Toln completa el objetivo de q11 (paso 0→1)
  if (action === 'acto3_toln') {
    if (g.questIdx === 10 && g.questStep === 0) {
      g.questAdvance();
      g.toast('Toln marca los tres lugares: el pozo de Teo, la Ruina Antigua, la orilla de Mara', '#8ef0b0');
    }
    return true;
  }

  // acto3_eco1/2/3: los 3 Ecos Invertidos (patrón eco_*_taken del Acto II):
  // flag idempotente por eco, en cualquier orden; el 3º cierra el paso 1 de q11.
  if (action === 'acto3_eco1' || action === 'acto3_eco2' || action === 'acto3_eco3') {
    g.flags[action === 'acto3_eco1' ? 'ecoInvTeo' : action === 'acto3_eco2' ? 'ecoInvDoran' : 'ecoInvMara'] = true;
    audio.sfx('echo');
    if (g.player) g.burst(g.player.x, g.player.y - 8, '#ffe9a0', 18, 70);
    const n = ECOS_INV.filter(k => g.flags[k]).length;
    if (g.questIdx === 10 && g.questStep === 1 && n >= 3) {
      g.questAdvance();
      g.toast('Los tres ecos enderezados: vuelve con la Anciana Brisa', '#8ef0b0');
    } else {
      g.toast(`Eco invertido enderezado (${n}/3)`, '#ffe9a0');
    }
    return true;
  }

  // accept_q12: el cierre de q11 abre q12. El toast de 'Nueva misión' ya lo
  // emite questAdvance al cerrar q11 (no se duplica, convención de 11-a);
  // aquí solo se activa la bandera de aceptación con auto-reparación.
  if (action === 'accept_q12') {
    if (g.questIdx < 11) { g.questIdx = 11; g.questStep = g.flags.visited_aldea ? 1 : 0; }
    g.flags.q12 = true;
    return true;
  }

  // acto3_mera_ayer: el informe de Mera completa el paso 0 de q12 y cuenta como
  // recuerdo; con 3 recuerdos de 4 posibles (cualquier orden) cierra el paso 1.
  if (action === 'acto3_mera_ayer') {
    g.flags.recMera = true;
    audio.sfx('echo');
    if (g.questIdx === 11 && g.questStep === 0) g.questAdvance();
    const recs = RECS.filter(k => g.flags[k]).length;
    if (g.questIdx === 11 && g.questStep === 1 && recs >= 3) {
      g.questAdvance();
      g.toast('Tres recuerdos devueltos: vuelve con la Anciana Brisa', '#8ef0b0');
    } else {
      g.toast(`Recuerdo devuelto (${Math.min(recs, 3)}/3)`, '#ffe9a0');
    }
    return true;
  }

  // acto3_rec_mara/_ivo/_vult: recuerdos de los aldeanos (flags idempotentes,
  // cualquier orden); el 3º cierra el paso 1 de q12.
  if (action === 'acto3_rec_mara' || action === 'acto3_rec_ivo' || action === 'acto3_rec_vult') {
    g.flags[action === 'acto3_rec_mara' ? 'recMara' : action === 'acto3_rec_ivo' ? 'recIvo' : 'recVult'] = true;
    audio.sfx('echo');
    const recs = RECS.filter(k => g.flags[k]).length;
    if (g.questIdx === 11 && g.questStep === 1 && recs >= 3) {
      g.questAdvance();
      g.toast('Tres recuerdos devueltos: vuelve con la Anciana Brisa', '#8ef0b0');
    } else {
      g.toast(`Recuerdo devuelto (${Math.min(recs, 3)}/3)`, '#ffe9a0');
    }
    return true;
  }

  // accept_q13: aceptación formal de q13 (el avance real lo hace questAdvance
  // al cerrar q12; aquí solo bandera + auto-reparación, sin toast duplicado).
  if (action === 'accept_q13') {
    if (g.questIdx < 12) { g.questIdx = 12; g.questStep = 0; }
    g.flags.q13 = true;
    return true;
  }

  // acto3_verdad / acto3_silencio: LA decisión de reputación del Acto III
  // (Guardianes vs Orden). Una sola vez por partida (anti-farm):
  //   verdad   → rep. Orden +10 (mató por misericordia) / Guardianes -5
  //   silencio → rep. Guardianes +10 (se conserva su causa) / Orden -5
  if (action === 'acto3_verdad' || action === 'acto3_silencio') {
    if (!g.flags.acto3RepDecision) {
      g.flags.acto3RepDecision = true;
      if (action === 'acto3_verdad') {
        g.applyAction('rep_orden_10');
        g.applyAction('rep_guardianes_-5');
        g.toast('Contaste la verdad: la Orden de Vesh pronuncia tu nombre con respeto', '#e8a0a0');
      } else {
        g.applyAction('rep_guardianes_10');
        g.applyAction('rep_orden_-5');
        g.toast('Callaste: los Guardianes del Canto conservan su verdad intacta', '#8ef0b0');
      }
    }
    return true;
  }

  // acto3_velmora_fn: la revelación de Velmora completa el paso 0 de q13
  if (action === 'acto3_velmora_fn') {
    if (g.questIdx === 12 && g.questStep === 0) {
      g.questAdvance();
      g.toast('La Cripta te espera: fuera del tiempo, canta la nota al revés', '#c8b0e8');
    }
    return true;
  }

  // acto3_subir: clímax de q13 — viaje instantáneo a la Cripta (el mismo método
  // público que usan respawn/travel_) + instancia del JEFE ÉLITE reutilizado
  // ('Guardián recordado', etype 'guardian' vía makeEnemy: el mecanismo que ya
  // usan challenge.ts y los spawns zone:'boss' del Acto II; killEnemy lo trata
  // por su rama de etype). La referencia vive en data.ACTO3_ELITE y acto3CatchUp
  // detecta su .dead para avanzar q13 paso 1→2 (el killEnemy del motor no avanza
  // índices nuevos). Idempotente: re-invocable desde velmora_puerta si el jugador
  // salió de la Cripta sin rematar (loadMap reconstruye enemigos desde cero).
  if (action === 'acto3_subir') {
    g.closeDialogue();
    g.loadMap('cripta', 19, 24); // aterrizaje del santuario (findSafeTile interno)
    if (!g.flags.guardianRecordadoDerrotado) {
      const altar = g.map.props.find(pr => pr.id === 'altar_c');
      const ax = (altar ? altar.x : 19) * 16 + 8; // TILE=16, constante del proyecto
      const ay = (altar ? altar.y + 5 : 9) * 16 + 8;
      const elite = g.makeEnemy('guardian', ax, ay, 0, 'boss');
      g.enemies.push(elite);
      ACTO3_ELITE.ref = elite;
      g.bossRef = elite;      // barra de jefe del HUD + limpieza de update (bossRef.dead → null)
      g.bossActive = true;
      audio.playTrack('boss');
      g.shake = 8;
      g.toast('El Guardián recordado despierta: ROMPE SU BARRA DE QUIEBRE', '#7ee8ff');
    }
    return true;
  }

  // acto3_report: cierre del Acto III — paga UNA VEZ por misión (flags
  // acto3Paid11/12/13 anti-doble-pago, mismo patrón que q10Paid). q11 +60 y
  // 1 poción · q12 +80 y 1 poción · q13 +100 y 1 poción + memoria nueva +
  // flag acto3Done (sin questAdvance: el Acto III es el final de la demo,
  // igual que acto2_report no avanza desde q10).
  if (action === 'acto3_report') {
    if (g.questIdx === 10 && g.questStep === 2 && !g.flags.acto3Paid11) {
      g.flags.acto3Paid11 = true;
      p.gold += 60; p.potions += 1;
      audio.sfx('coin');
      g.floatAt(p.x, p.y - 26, 'Recompensa: +60 coronas y 1 poción', '#f0c84a', 7);
      g.toast('Misión completada: El Canto al Revés (+60 coronas, +1 poción)', '#8ef0b0');
      g.questAdvance(); // cierre genérico: q11 → q12 (el toast de misión lo emite questAdvance)
    }
    if (g.questIdx === 11 && g.questStep === 2 && !g.flags.acto3Paid12) {
      g.flags.acto3Paid12 = true;
      p.gold += 80; p.potions += 1;
      audio.sfx('coin');
      g.floatAt(p.x, p.y - 26, 'Recompensa: +80 coronas y 1 poción', '#f0c84a', 7);
      g.toast('Misión completada: La Aldea sin Ayer (+80 coronas, +1 poción)', '#8ef0b0');
      g.questAdvance(); // q12 → q13
    }
    if (g.questIdx === 12 && g.questStep === 2 && !g.flags.acto3Paid13) {
      g.flags.acto3Paid13 = true;
      p.gold += 100; p.potions += 1;
      audio.sfx('quest');
      g.floatAt(p.x, p.y - 26, 'Recompensa: +100 coronas y 1 poción', '#f0c84a', 7);
      g.toast('Misión completada: La Primera Portadora (+100 coronas, +1 poción)', '#8ef0b0');
      grantMemory(g, p, 'mem_cantoalreves');
      g.flags.acto3Done = true;
    }
    return true;
  }

  // ----- Acto IV · El Último Canto (agente 16-a: historia y diálogos) -----
  // Watcher idempotente (patrón acto3CatchUp): O(1) fuera del rango q14-q16;
  // completa por ESTADO los pasos que pudieron cumplirse antes de aceptar la
  // misión o cuyo evento (killEnemy del motor no tiene rama para el jefe
  // final) debe detectarse por referencia (ACTO4_BOSS.ref.dead).
  acto4CatchUp(g);

  // accept_q14: Brisa abre el Acto IV («las campanas de antes»); acepta q14.
  // Con questIdx<13 auto-repara aceptaciones anticipadas o saves antiguos
  // (mismo principio de accept_q11); el Acto III quedó en idx 12 paso 2.
  if (action === 'accept_q14') {
    if (g.questIdx < 13) { g.questIdx = 13; g.questStep = 0; }
    if (!g.flags.q14) {
      g.flags.q14 = true;
      audio.sfx('quest');
      g.toast('Nueva misión: Las Campanas de Antes', '#8ef0b0');
    }
    return true;
  }

  // acto4_toln: la forja de Toln completa el paso 0 de q14 (flag idempotente
  // camToln); Toln cría la Campana del Ayer con el metal que recuerda.
  if (action === 'acto4_toln') {
    g.flags.camToln = true;
    if (g.questIdx === 13 && g.questStep === 0) {
      g.questAdvance();
      g.toast('Toln cría la Campana del Ayer: falta el coro que la llame', '#8ef0b0');
    }
    return true;
  }

  // acto4_cam_mera / acto4_cam_ivo: las voces del coro (flags idempotentes
  // camMera/camCumbres, cualquier orden); ambas cierran el paso 1 de q14.
  // camMera devuelve la voz que la Sirena Abisal cantaba robada (requiere
  // sirenaDefeated, garantizado tras el Acto II — lo valida el ruteo);
  // camCumbres recoge la resonancia de los pastores (requiere golemDefeated).
  if (action === 'acto4_cam_mera' || action === 'acto4_cam_ivo') {
    g.flags[action === 'acto4_cam_mera' ? 'camMera' : 'camCumbres'] = true;
    audio.sfx('echo');
    if (g.player) g.burst(g.player.x, g.player.y - 8, '#ffe9a0', 18, 70);
    const n = CAMS.filter(k => g.flags[k]).length;
    if (g.questIdx === 13 && g.questStep === 1 && n >= 2) {
      g.questAdvance();
      g.toast('El coro de antes acompaña a la campana: vuelve con la Anciana Brisa', '#8ef0b0');
    } else {
      g.toast(`Voz devuelta al coro (${Math.min(n, 2)}/2)`, '#ffe9a0');
    }
    return true;
  }

  // accept_q15: aceptación formal de q15 (el avance real lo hace questAdvance
  // al cerrar q14; aquí solo bandera + auto-reparación, sin toast duplicado).
  if (action === 'accept_q15') {
    if (g.questIdx < 14) { g.questIdx = 14; g.questStep = 0; }
    g.flags.q15 = true;
    return true;
  }

  // acto4_guarda: el encuentro con la Guarda del Primer Canto completa el
  // paso 0 de q15 (la Guarda es NPC de la Cripta añadida con showFlag
  // 'acto3Done': solo aparece cuando el tercer canto terminó).
  if (action === 'acto4_guarda') {
    if (g.questIdx === 14 && g.questStep === 0) {
      g.questAdvance();
      g.toast('La Guarda sostiene la puerta: la Sala del Primer Canto puede abrirse', '#c8b0e8');
    }
    return true;
  }

  // acto4_subir: clímax de q15 — JEFE FINAL. Patrón acto3_subir: loadMap
  // cripta + instancia makeEnemy + bossRef/bossActive + banner + toast.
  // El jefe usa el tipo 'heraldo' (ENEMY_DEFS_16A: sprite existente
  // 'inquisidor', quiebre estilo Coro Roto vía breakBar). Idempotente: si el
  // jefe ya cayó NO vuelve a spawnear; re-invocable desde la Guarda si el
  // jugador salió sin rematar (loadMap reconstruye enemigos desde cero).
  if (action === 'acto4_subir') {
    g.closeDialogue();
    g.flags.acto4SalaAbierta = true;
    g.loadMap('cripta', 19, 24); // aterrizaje del santuario (findSafeTile interno)
    if (!g.flags.heraldoDerrotado) {
      const altar = g.map.props.find(pr => pr.id === 'altar_c');
      const ax = (altar ? altar.x : 19) * 16 + 8;      // TILE=16, constante del proyecto
      const ay = (altar ? altar.y + 2 : 6) * 16 + 8;   // boca de la Sala del Primer Canto
      const boss = g.makeEnemy('heraldo', ax, ay, 0, 'boss');
      g.enemies.push(boss);
      ACTO4_BOSS.ref = boss;
      g.bossRef = boss;       // barra de jefe del HUD + limpieza de update (bossRef.dead → null)
      g.bossActive = true;
      g.bossBannerT = 3.2;
      g.bossBannerText = 'EL HERALDO';
      g.bossBannerSub = 'Vesh, la Última Nota';
      audio.playTrack('boss');
      g.shake = 8;
      g.toast('La Sala del Primer Canto se abre: ROMPE SU BARRA DE QUIEBRE', '#c8b0e8');
    }
    return true;
  }

  // acto4_report: cierre de q14/q15 — paga UNA VEZ por misión (flags
  // acto4Paid14/15 anti-doble-pago, mismo patrón que acto3Paid11/12/13):
  // q14 +80 y 1 poción · q15 +120 y 1 poción. q16 se paga en acto4_epilogo.
  if (action === 'acto4_report') {
    if (g.questIdx === 13 && g.questStep === 2 && !g.flags.acto4Paid14) {
      g.flags.acto4Paid14 = true;
      p.gold += 80; p.potions += 1;
      audio.sfx('coin');
      g.floatAt(p.x, p.y - 26, 'Recompensa: +80 coronas y 1 poción', '#f0c84a', 7);
      g.toast('Misión completada: Las Campanas de Antes (+80 coronas, +1 poción)', '#8ef0b0');
      g.questAdvance(); // cierre genérico: q14 → q15 (el toast de misión lo emite questAdvance)
    }
    if (g.questIdx === 14 && g.questStep === 2 && !g.flags.acto4Paid15) {
      g.flags.acto4Paid15 = true;
      p.gold += 120; p.potions += 1;
      audio.sfx('coin');
      g.floatAt(p.x, p.y - 26, 'Recompensa: +120 coronas y 1 poción', '#f0c84a', 7);
      g.toast('Misión completada: La Sala del Primer Canto (+120 coronas, +1 poción)', '#8ef0b0');
      g.questAdvance(); // q15 → q16
    }
    return true;
  }

  // accept_q16: aceptación formal de q16 — el epílogo (el avance real lo hace
  // questAdvance al cerrar q15; aquí solo bandera + auto-reparación).
  if (action === 'accept_q16') {
    if (g.questIdx < 15) { g.questIdx = 15; g.questStep = 0; }
    g.flags.q16 = true;
    return true;
  }

  // acto4_epilogo: EL ÚLTIMO CANTO — cierre de la historia. Pago final UNA
  // VEZ (flag acto4Paid16): +150 coronas, 1 poción, memoria VII
  // 'mem_ultimacanto' y flag acto4Done; avanza el paso 0→1 de q16 (la misión
  // epílogo no se cierra: es la letra con la que el mundo se queda).
  // Instala además en dynNodes el FINAL vivo del epílogo ('acto4_epilogo_canto')
  // compuesto con los jefes opcionales derrotados (Coro Roto / Vult).
  if (action === 'acto4_epilogo') {
    if (g.questIdx < 15) { g.questIdx = 15; g.questStep = 0; } // auto-reparación
    g.flags.q16 = true;
    if (!g.flags.acto4Paid16) {
      g.flags.acto4Paid16 = true;
      p.gold += 150; p.potions += 1;
      audio.sfx('quest');
      g.floatAt(p.x, p.y - 26, 'Recompensa: +150 coronas y 1 poción', '#f0c84a', 7);
      g.toast('Misión completada: El Eco que Elegiste (+150 coronas, +1 poción)', '#8ef0b0');
      grantMemory(g, p, 'mem_ultimacanto');
      g.flags.acto4Done = true;
      if (g.questIdx === 15 && g.questStep === 0) g.questAdvance(); // paso 0→1 (invitación final)
    }
    g.dynNodes['acto4_epilogo_canto'] = acto4FinNode(g);
    return true;
  }

  return false;
}

/**
 * 16-a — Nodo final del epílogo (acto4_epilogo_canto) compuesto según jefes
 * opcionales derrotados: base + párrafos del Coro Roto y de Vult. Se instala
 * en dynNodes (precedencia sobre DIALOGUES en openDialogue) y es idempotente:
 * se re-escribe en cada acto4_epilogo. Tras recargar partida (dynNodes
 * volátiles) el nodo estático de data.ts cubre como respaldo.
 */
function acto4FinNode(g: Game): DialogueNode {
  const f = g.flags;
  let text = ACTO4_FIN_BASE;
  if (f.coroDefeated) text += '\n\n' + ACTO4_FIN_JEFES.coro;
  if (f.vultDefeated) text += '\n\n' + ACTO4_FIN_JEFES.vult;
  return {
    name: 'Anciana Brisa', portrait: 'brisa', text,
    options: [
      { text: '(Subir el telón del Último Canto: terminar el viaje)', action: 'end_demo' },
      { text: '(Quedarse: el mundo aún tiene mañanas que nombrar)', tone: 'empatico' },
    ],
  };
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

/**
 * 13-a — Watcher idempotente del Acto III (anti-bloqueo, referencia conceptual:
 * catchUpActo2 del motor, que vive en engine.ts y NO se toca). Aquí no hay tick
 * propio: el motor llama handleCustomAction en cada acción de diálogo, así que
 * este corre al inicio de MI sección de handleCustomAction (las acciones
 * previas del Acto I/II hacen return antes; es O(1) y no les afecta).
 * Completa por ESTADO (mismo principio de las visitas de 8-int):
 *  · guardián recordado derrotado → flag + avance q13 paso 1→2 (killEnemy del
 *    motor no tiene rama para los índices nuevos; se detecta por ACTO3_ELITE).
 *  · q11 paso 1: los 3 ecos enderezados en cualquier orden.
 *  · q12 paso 1: 3 recuerdos de 4 posibles, en cualquier orden.
 *  · reparación de saves a medio aceptar (flag q11 con questIdx aún 9).
 */
function acto3CatchUp(g: Game): void {
  const f = g.flags;
  if (!g.player) return;
  if (g.questIdx === 9 && f.acto2Done && f.q11) { g.questIdx = 10; g.questStep = 0; }
  if (g.questIdx < 10 || g.questIdx > 12) return;
  if (ACTO3_ELITE.ref?.dead && !f.guardianRecordadoDerrotado) {
    f.guardianRecordadoDerrotado = true;
    g.toast('El Guardián recordado se aquietó: vuelve con la Anciana Brisa', '#a8d8ff');
  }
  if (g.questIdx === 10 && g.questStep === 1 &&
      f.ecoInvTeo && f.ecoInvDoran && f.ecoInvMara) {
    g.questAdvance();
    g.toast('Los tres ecos enderezados: vuelve con la Anciana Brisa', '#8ef0b0');
  }
  if (g.questIdx === 11 && g.questStep === 1 &&
      RECS.filter(k => f[k]).length >= 3) {
    g.questAdvance();
    g.toast('Tres recuerdos devueltos: vuelve con la Anciana Brisa', '#8ef0b0');
  }
  if (g.questIdx === 12 && g.questStep === 1 && f.guardianRecordadoDerrotado) {
    g.questAdvance();
  }
}

/**
 * 16-a — Watcher idempotente del Acto IV (mismo principio que acto3CatchUp:
 * sin tick propio, corre al inicio de MI sección de handleCustomAction; O(1)
 * fuera del rango 13-15). Completa por ESTADO:
 *  · Vesh derrotado → flag + limpieza de barra/música + avance q15 paso 1→2
 *    (killEnemy del motor no tiene rama para un etype nuevo: se detecta por
 *    ACTO4_BOSS.ref; el envoltorio de getDialogue en data.ts también lee la
 *    referencia para rutar el informe aunque la flag aún no exista).
 *  · q14 paso 1: camMera + camCumbres en cualquier orden (incluso antes de
 *    aceptar la misión o antes de hablar con Toln).
 *  · reparación de saves a medio aceptar (flag q14 con questIdx aún 12).
 *  · espejo de reputación en flags (DialogueCtx no la lleva): el epílogo de
 *    q16 se ramifica leyendo flags.acto4RepOrden / flags.acto4RepGuard.
 */
function acto4CatchUp(g: Game): void {
  const f = g.flags;
  if (!g.player) return;
  const rep = g.player.repFacciones;
  if (rep) {
    f.acto4RepOrden = rep.orden ?? 0;
    f.acto4RepGuard = rep.guardianes ?? 0;
  }
  if (g.questIdx === 12 && f.acto3Done && f.q14) { g.questIdx = 13; g.questStep = 0; }
  if (g.questIdx < 13 || g.questIdx > 15) return;
  if (ACTO4_BOSS.ref?.dead && !f.heraldoDerrotado) {
    f.heraldoDerrotado = true;
    g.bossActive = false;
    audio.playTrack('crypt');
    g.toast('Vesh, la Última Nota, se aquietó: el coro entero respira', '#c8b0e8');
  }
  if (g.questIdx === 13 && g.questStep === 1 && f.camMera && f.camCumbres) {
    g.questAdvance();
    g.toast('El coro de antes acompaña a la campana: vuelve con la Anciana Brisa', '#8ef0b0');
  }
  if (g.questIdx === 14 && g.questStep === 1 && f.heraldoDerrotado) {
    g.questAdvance();
  }
}
