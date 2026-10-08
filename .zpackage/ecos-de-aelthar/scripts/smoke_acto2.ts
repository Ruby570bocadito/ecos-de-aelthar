// ============================================================
// 11-a (integrador) — Smoke sin navegador del contenido Acto II
// Importa data.ts + maps_expansion.ts (vía maps.ts) + sprites.ts (SOLID_CHARS).
// Valida misiones, ENEMY_DEFS, mapas de expansión, y audita TODAS las salidas
// del mundo completo (aterrizajes transitables y fuera de zonas de salida).
// ============================================================
import {
  QUESTS, DIALOGUES, ENEMY_DEFS, MEMORIES, KEY_ITEMS, SKILLS,
  type DialogueNode,
} from '../src/game/data';
import { MAPS, mapRows, tileAt } from '../src/game/maps';
import { SOLID_CHARS, TILE } from '../src/game/sprites';
import type { MapId, Epoch } from '../src/game/types';

let fails = 0, warns = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const warn = (m: string) => { console.log('  ⚠ ' + m); warns++; };
const ok = (m: string) => console.log('  ✓ ' + m);

console.log('=== 1) MISIONES (cadena principal) ===');
if (QUESTS.length === 13) ok(`QUESTS.length = ${QUESTS.length} (q1..q13, Acto III incluido)`);
else bad(`QUESTS.length = ${QUESTS.length}, se esperaban 13`);
QUESTS.forEach((q, i) => {
  if (!q.id || !q.name || !q.steps?.length) bad(`QUESTS[${i}] (${q.id}) incompleta`);
  else if (q.steps.some(s => !s)) bad(`QUESTS[${i}] (${q.id}) tiene un paso vacío`);
});
const ids = QUESTS.map(q => q.id);
if (new Set(ids).size !== ids.length) bad('ids de misión duplicados');
if (QUESTS.length === 13) ok('sin huecos: ' + ids.join(','));

console.log('\n=== 2) ENEMY_DEFS (9 tipos) ===');
const TYPES: (keyof typeof ENEMY_DEFS)[] = ['lobo', 'esqueleto', 'sombra', 'guardian', 'neumo', 'espectro', 'arpi', 'sirena', 'golem'];
for (const t of TYPES) {
  const d = ENEMY_DEFS[t];
  if (!d) { bad(`ENEMY_DEFS falta: ${t}`); continue; }
  const problems: string[] = [];
  if (!(d.hp > 0)) problems.push('hp');
  if (!(d.dmg >= 0)) problems.push('dmg');
  if (!(d.speed > 0)) problems.push('speed');
  if (!(d.xp > 0)) problems.push('xp');
  if (!Array.isArray(d.gold) || d.gold.length !== 2 || d.gold[0] > d.gold[1]) problems.push('gold');
  if (!d.sprite) problems.push('sprite');
  if (!(d.aggroR > 0) || !(d.atkR > 0)) problems.push('aggroR/atkR');
  if (d.windup === undefined || d.atkCd === undefined) problems.push('windup/atkCd');
  if (!d.element || !d.weakTo) problems.push('element/weakTo');
  if ((t === 'guardian' || t === 'sirena' || t === 'golem') && !(d.breakBar && d.breakBar > 0)) problems.push('breakBar (jefe)');
  if (problems.length) bad(`${t}: campos problemáticos → ${problems.join(', ')}`);
}
ok('9 tipos revisados (' + TYPES.length + ')');

console.log('\n=== 3) DIALOGUES: grafo íntegro (next/onEnd/action) ===');
// acciones gestionadas por engine.applyAction (switch true) + hooks.handleCustomAction
const ENGINE_ACTIONS = new Set(['accept_q2', 'accept_q3', 'accept_q4', 'accept_q5', 'accept_q6', 'accept_q7',
  'accept_q8', 'accept_q9', 'accept_q10', 'fragment_touched', 'eco_taken', 'eco_mareas_taken', 'eco_cumbres_taken',
  'forge', 'buy_potion', 'recruit_ilwen', 'rest', 'end_demo', 'close', 'fragment']);
const HOOKS_EXACT = new Set(['eco_taken_mem', 'mara_met', 'mara_gift', 'mera_eco', 'acto2_report', 'accept_q6',
  // Acto III (13-a): handlers en hooks.handleCustomAction
  'accept_q11', 'acto3_toln', 'acto3_eco1', 'acto3_eco2', 'acto3_eco3', 'acto3_report',
  'accept_q12', 'accept_q13', 'acto3_mera_ayer', 'acto3_rec_mara', 'acto3_rec_ivo', 'acto3_rec_vult',
  'acto3_verdad', 'acto3_silencio', 'acto3_subir', 'acto3_velmora_fn']);
const HOOKS_PREFIX = ['memory_', 'rep_', 'flag_'];
const ENGINE_PREFIX = ['armor_']; // 14-b: armor_N → engine.applyAction (case action.startsWith('armor_'))
const actionHandled = (a: string) =>
  ENGINE_ACTIONS.has(a) || HOOKS_EXACT.has(a) || HOOKS_PREFIX.some(p => a.startsWith(p)) || ENGINE_PREFIX.some(p => a.startsWith(p));
let nodes = 0;
for (const [key, node] of Object.entries(DIALOGUES) as [string, DialogueNode][]) {
  nodes++;
  const opts = node.options ?? [];
  for (const o of opts) {
    if (o.next && !DIALOGUES[o.next]) bad(`nodo ${key}: option.next → '${o.next}' NO EXISTE`);
    if (o.action && !actionHandled(o.action)) bad(`nodo ${key}: option.action → '${o.action}' sin handler`);
  }
  if (node.next && !DIALOGUES[node.next]) bad(`nodo ${key}: next → '${node.next}' NO EXISTE`);
  if (node.onEnd && !actionHandled(node.onEnd)) bad(`nodo ${key}: onEnd → '${node.onEnd}' sin handler`);
  if (node.action && !actionHandled(node.action)) bad(`nodo ${key}: action → '${node.action}' sin handler`);
}
ok(`${nodes} nodos de diálogo sin enlaces rotos`);
// nodos que el motor sirve por clave (talkTo/dynNodes/eco)
for (const k of ['brisa_idle', 'mara_intro', 'mara_react', 'mera_intro', 'mera_grateful', 'ivo_intro', 'vult_intro',
  'eco_mareas', 'eco_cumbres', 'brisa_acto2', 'brisa_final2']) {
  if (!DIALOGUES[k]) bad(`nodo contractual del motor AUSENTE: ${k}`);
}
ok('nodos clave del Acto II presentes (mara/mera/ivo/vult/ecos/brisa_acto2/brisa_final2)');

console.log('\n=== 4) MEMORIES / KEY_ITEMS / SKILLS ===');
const memN = Object.keys(MEMORIES).length;
if (memN === 6) ok(`MEMORIES = ${memN} (5 del Acto I-II + mem_cantoalreves del Acto III)`);
else warn(`MEMORIES = ${memN} (se esperaban 6)`);
for (const k of ['ecoMareas', 'ecoCumbres', 'ecoNombres']) {
  if (!KEY_ITEMS[k]) bad(`KEY_ITEMS falta: ${k}`);
}
if (KEY_ITEMS['ecoMareas'] && KEY_ITEMS['ecoCumbres'] && KEY_ITEMS['ecoNombres']) ok('KEY_ITEMS con los 3 Ecos del Acto II');
for (const disc of ['alba', 'tejedor'] as const) {
  if (!SKILLS[disc] || SKILLS[disc].length !== 4) bad(`SKILLS[${disc}] no tiene 4 habilidades`);
}
ok('SKILLS: 4 habilidades por disciplina');

console.log('\n=== 5) MAPAS: filas w×h correctas ===');
const MAP_IDS = Object.keys(MAPS) as MapId[];
if (MAP_IDS.length === 7) ok(`MAPS tiene 7 mapas: ${MAP_IDS.join(', ')}`); // 6 campaña + arena (12-a)
else bad(`MAPS tiene ${MAP_IDS.length} mapas`);
for (const id of MAP_IDS) {
  const m = MAPS[id];
  const rows = mapRows(m);
  if (rows.length !== m.h) bad(`${id}: rows.length=${rows.length} ≠ h=${m.h}`);
  if (rows.some(r => r.length !== m.w)) bad(`${id}: alguna fila ≠ w=${m.w}`);
  if (m.w !== m.rows[0]?.length) warn(`${id}: m.w=${m.w} pero rows[0].length=${m.rows[0]?.length} (mapRows normaliza)`);
}
ok('dimensiones normalizadas por mapRows (padded/truncated)');

console.log('\n=== 6) SALIDAS DEL MUNDO COMPLETO — auditoría anti-softlock ===');
const inExitZone = (id: MapId, tx: number, ty: number, epoch: Epoch): string | null => {
  for (const ex of MAPS[id].exits) {
    if (ex.needPast && epoch !== 'pasado') continue;
    if (tx >= ex.x && tx < ex.x + ex.w && ty >= ex.y && ty < ex.y + ex.h) return `${ex.to}@${ex.tx},${ex.ty}`;
  }
  return null;
};
let exitCount = 0;
for (const id of MAP_IDS) {
  const m = MAPS[id];
  const rows = mapRows(m);
  for (const ex of m.exits) {
    exitCount++;
    const dest = MAPS[ex.to];
    if (!dest) { bad(`${id}: exit a mapa inexistente '${ex.to}'`); continue; }
    const drows = mapRows(dest);
    if (ex.tx < 0 || ex.ty < 0 || ex.tx >= dest.w || ex.ty >= dest.h) {
      bad(`${id} → ${ex.to}: aterrizaje (${ex.tx},${ex.ty}) FUERA del mapa destino (${dest.w}×${dest.h})`);
      continue;
    }
    for (const ep of ['presente', 'pasado'] as Epoch[]) {
      const ch = tileAt(dest, drows, ex.tx, ex.ty, ep);
      if (SOLID_CHARS.has(ch)) bad(`${id} → ${ex.to}: aterrizaje (${ex.tx},${ex.ty}) SÓLIDO en ${ep} (tile '${ch}')`);
    }
    for (const ep of ['presente', 'pasado'] as Epoch[]) {
      const z = inExitZone(ex.to, ex.tx, ex.ty, ep);
      if (z) warn(`${id} → ${ex.to}: aterrizaje (${ex.tx},${ex.ty}) cae dentro de la zona de salida hacia ${z} en ${ep} (findSafeTile lo rescataría, pero conviene moverlo)`);
    }
  }
}
ok(`${exitCount} salidas auditadas en ${MAP_IDS.length} mapas`);

console.log('\n=== 7) EXPANSION_MAPS: spawns/NPCs/cofres/props pisables ===');
for (const id of ['costa', 'aldea', 'cumbres'] as MapId[]) {
  const m = MAPS[id];
  const rows = mapRows(m);
  const pid = new Set<string>();
  const walk = (tx: number, ty: number, ep: Epoch) => !SOLID_CHARS.has(tileAt(m, rows, tx, ty, ep));
  for (const s of m.spawns) {
    const eps: Epoch[] = s.needPast ? ['pasado'] : s.needPresent ? ['presente'] : ['presente', 'pasado'];
    for (const ep of eps) {
      if (!walk(s.x, s.y, ep)) bad(`${id}: spawn ${s.type} (${s.x},${s.y}) sobre tile SÓLIDO en ${ep} — enemigo atrapado`);
    }
    if (s.zone === 'boss' && ENEMY_DEFS[s.type]?.breakBar === undefined) bad(`${id}: spawn zone:boss de ${s.type} sin breakBar`);
  }
  for (const n of m.npcs) {
    if (!walk(n.x, n.y, 'presente') && !walk(n.x, n.y, 'pasado')) bad(`${id}: npc ${n.id} (${n.x},${n.y}) inaccesible en ambas épocas`);
  }
  for (const c of m.chests) {
    if (pid.has(c.id)) bad(`${id}: cofre con id duplicado '${c.id}'`);
    pid.add(c.id);
    const ep: Epoch = c.needPast ? 'pasado' : 'presente';
    if (!walk(c.x, c.y, ep)) bad(`${id}: cofre '${c.id}' sobre tile SÓLIDO en ${ep}`);
  }
  for (const pr of m.props) {
    if (pid.has(pr.id)) bad(`${id}: prop con id duplicado '${pr.id}'`);
    pid.add(pr.id);
    const eps: Epoch[] = pr.needPast ? ['pasado'] : pr.needPresent ? ['presente'] : ['presente', 'pasado'];
    for (const ep of eps) if (!walk(pr.x, pr.y, ep)) bad(`${id}: prop '${pr.id}' (${pr.kind}) sobre tile SÓLIDO en ${ep}`);
  }
}
ok('costa/aldea/cumbres: spawns, NPCs, cofres y props revisados');

console.log('\n=== 8) FAROLES DE MERROW (contrato lightLamp) ===');
const lamps = MAPS['aldea'].props.filter(p => p.kind === 'lamp');
const lampIds = lamps.map(p => p.id).sort();
if (JSON.stringify(lampIds) === JSON.stringify(['lamp1', 'lamp2', 'lamp3'])) ok(`ids exactos: ${lampIds.join(', ')}`);
else bad(`ids de faroles inesperados: ${lampIds.join(', ')}`);
if (lamps.every(p => p.needPast)) ok('los 3 faroles con needPast:true');
else bad('algún farol sin needPast:true');

console.log('\n=== 9) CONSTANTES ===');
if (TILE === 16) ok('TILE = 16');
else bad(`TILE = ${TILE}`);
if (SOLID_CHARS.size > 0) ok(`SOLID_CHARS = ${SOLID_CHARS.size} chars (${[...SOLID_CHARS].join('')})`);
else bad('SOLID_CHARS vacío');

console.log('\n================================');
console.log(fails === 0 ? `RESULTADO: ✗ 0 fallos, ⚠ ${warns} avisos` : `RESULTADO: ✗ ${fails} FALLOS, ⚠ ${warns} avisos`);
process.exit(fails === 0 ? 0 : 1);
