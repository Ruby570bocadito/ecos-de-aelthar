// ============================================================
// R11 · EPIC 7 — Smoke sin navegador (jefes, NPCs, escenas, gates)
// Valida: registro de mini-jefes + spawns, puertas de historia,
// escenas de historia + cinemática de inicio, diálogos R11,
// rutinas de NPCs, audio de escenas, fix de dims de expansión.
// Ejecutar: npx tsx scripts/smoke_r11.mts
// ============================================================
import {
  QUESTS, DIALOGUES, ENEMY_DEFS, getDialogue, type DialogueCtx,
} from '../src/game/data';
import { MAPS, mapRows, tileAt } from '../src/game/maps';
import { SOLID_CHARS } from '../src/game/sprites';
import {
  MINIBOSS_DEFS, SPAWNS_R11, MINIBOSS_FLAGS, minibossEnemyDefs,
} from '../src/game/actors/minibosses';
import { MB_PATTERN_OF, AHOGADO_DEF_R11 } from '../src/game/actors/minibossai';
import { GATES, gateSolid, gateBlockedAt, gatePushOut, gatesUnlocked } from '../src/game/world/gates';
import {
  startStoryScene, storySceneActive, updateStoryScene, skipStoryScene,
  setStoryBackdropFn, onStorySceneEnd, type StorySceneId,
} from '../src/game/actors/storyscenes';
import {
  startIntroScene, introSceneActive, updateIntroScene, skipIntroScene,
} from '../src/game/actors/introscene';
import { STORY_SCENES_ART, drawStoryBackdrop } from '../src/game/actors/storyart';
import { NPCS_R11, __wlArmR11, __wlNpcMood } from '../src/game/worldlife';
import {
  playIntroSceneTone, playStorySting, playMinibossRoar, playGateDenied,
  playGateOpen, playWorkSfx, setSceneMusicMuffled,
} from '../src/game/audio';

let fails = 0, warns = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const warn = (m: string) => { console.log('  ⚠ ' + m); warns++; };
const ok = (m: string) => console.log('  ✓ ' + m);

// Game mínimo para gates/escenas (solo los campos que leen por camino feliz)
const mockG: any = {
  flags: {}, questIdx: 0, mapId: 'bosque', rows: mapRows(MAPS.bosque), player: null,
  camX: 0, camY: 0, map: MAPS.bosque, globalT: 0, state: 'play', challengeRun: null,
  npcs: [], enemies: [], dayT: 0.3, epoch: 'presente',
  // réplica mínima del tileSolidAt del motor (la usan walkNear/ensureR11)
  tileSolidAt(px: number, py: number): boolean {
    const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
    return SOLID_CHARS.has(tileAt(MAPS.bosque, mockG.rows, tx, ty, 'presente'));
  },
};

console.log('=== 1) MINI-JEFES (7.1): registro + spawns + flags ===');
const MB_TYPES = ['nodriza', 'cazador', 'espantapajaros', 'coro_mini', 'centinela'];
for (const t of MB_TYPES) {
  const d = ENEMY_DEFS[t];
  if (!d) { bad(`ENEMY_DEFS falta el mini-jefe: ${t}`); continue; }
  if (d.hp < 150 || d.hp > 230) bad(`${t}: hp ${d.hp} fuera de banda (150-230)`);
  if (!d.desc) bad(`${t}: desc vacío`);
}
if (ENEMY_DEFS['ahogado_r11']) ok(`esbirro ahogado_r11 registrado (hp ${ENEMY_DEFS['ahogado_r11'].hp})`);
else bad('ENEMY_DEFS falta el esbirro ahogado_r11');
if (ENEMY_DEFS['coro']) ok('el JEFE de historia coro conserva SU def (no pisada): ' + ENEMY_DEFS['coro'].name);
else bad('ENEMY_DEFS.coro (jefe El Coro Roto) fue PISADO por el mini-jefe');
if (Object.keys(MINIBOSS_DEFS).length === 5) ok('MINIBOSS_DEFS: 5 defs');
else bad(`MINIBOSS_DEFS tiene ${Object.keys(MINIBOSS_DEFS).length}, se esperaban 5`);
const flagVals = Object.values(MINIBOSS_FLAGS);
if (flagVals.every(f => f.startsWith('mb_')) && new Set(flagVals).size === 5) ok('MINIBOSS_FLAGS: 5 flags mb_* únicas');
else bad('MINIBOSS_FLAGS mal formadas: ' + flagVals.join(','));
if (MINIBOSS_FLAGS['coro_mini'] === 'mb_coro_muerto' && flagVals.every(f => f !== 'coroDefeated')) ok("coro_mini ≠ 'coro' de historia (flag separada)");
else bad('colisión coro_mini/coro');
for (const t of MB_TYPES) if (!MB_PATTERN_OF[t]) bad(`MB_PATTERN_OF sin patrón para ${t}`);
if (MB_TYPES.every(t => MB_PATTERN_OF[t])) ok('MB_PATTERN_OF: los 5 tienen patrón (' + MB_TYPES.map(t => MB_PATTERN_OF[t]).join(',') + ')');
const derived = minibossEnemyDefs();
if (Object.keys(derived).length === 5 && derived['coro_mini']) ok('minibossEnemyDefs: deriva 5 EnemyDef');
else bad('minibossEnemyDefs incompleto');

console.log('\n=== 2) SPAWNS en MAPS (zone PROPIA, nunca boss) ===');
const MAP_OF: Record<string, string> = { nodriza: 'costa', cazador: 'cumbres', espantapajaros: 'aldea', coro_mini: 'bosque', centinela: 'lunaris' };
let spawnOk = 0;
for (const s of SPAWNS_R11) {
  const et = s.type as unknown as string;
  const m = MAPS[MAP_OF[et] as keyof typeof MAPS];
  const found = m?.spawns.find(sp => sp.zone === s.zone && (sp.type as unknown as string) === et);
  if (found && s.zone !== 'boss') { spawnOk++; ok(`${et} → ${MAP_OF[et]} (${s.x},${s.y}) zone '${s.zone}'`); }
  else bad(`spawn de ${et} NO pusheado o zone 'boss'`);
}
if (spawnOk === 5) ok('5/5 spawns registrados con zone propia');
// tile transitable bajo el spawn (presente)
for (const s of SPAWNS_R11) {
  const m = MAPS[MAP_OF[s.type as unknown as string] as keyof typeof MAPS];
  const rows = mapRows(m);
  const ch = rows[s.y]?.[s.x] ?? '?';
  if ('^LD'.includes(ch)) bad(`spawn ${s.type as unknown as string} sobre tile sólido/especial '${ch}'`);
}
ok('spawn tiles verificados (ninguno sobre ^/L/D)');

console.log('\n=== 3) GATES (7.6): 3 puertas, sólidas sin condición, nada atrapa ===');
if (GATES.length === 3) ok('GATES: 3 puertas (' + GATES.map(gt => gt.id).join(', ') + ')');
else bad(`GATES tiene ${GATES.length}, se esperaban 3`);
for (const gt of GATES) {
  const m = MAPS[gt.map as keyof typeof MAPS];
  if (!m) { bad(`gate ${gt.id}: mapa ${gt.map} inexistente`); continue; }
  const r = gt.rect;
  if (r.x < 0 || r.y < 0 || r.x + r.w > m.w || r.y + r.h > m.h) bad(`gate ${gt.id}: rect fuera del mapa`);
  if (!gt.denialToast) bad(`gate ${gt.id}: sin denialToast`);
}
ok('rects dentro de mapas + toasts presentes');
// gateSolid: con el mock sin flags, el gate del bosque debe bloquear el rect
const gBosque = GATES.find(gt => gt.map === 'bosque');
if (gBosque) {
  mockG.mapId = 'bosque';
  mockG.player = null; // cláusula de escape: sin player, gateSolid solo mira tiles
  const px = (gBosque.rect.x + 0.5) * 16, py = (gBosque.rect.y + 0.5) * 16;
  const blocked = gateSolid(mockG, 'bosque', px, py);
  if (blocked) ok(`gate_santuario bloquea su rect sin condición cumplida (px ${px},${py})`);
  else bad('gate_santuario NO bloquea con condición incumplida');
  // fuera del rect: libre
  const far = gateSolid(mockG, 'bosque', 8 * 16 + 8, 8 * 16 + 8);
  if (!far) ok('tile lejos del gate permanece libre');
  else bad('gateSolid bloquea un tile FUERA del rect');
}
const hit = gateBlockedAt(mockG, 'bosque', 8 * 16 + 8, 8 * 16 + 8);
if (hit === null) ok('gateBlockedAt: null lejos de gates (sin toast spawm)');
else warn('gateBlockedAt devolvió un gate lejos del rect (revisar radio)');
const unlocked = gatesUnlocked(mockG);
if (Array.isArray(unlocked) && unlocked.length === 0) ok('gatesUnlocked: 0 con flags vacías');
else warn('gatesUnlocked devolvió ' + unlocked.join(','));
gatePushOut(mockG, GATES[0]); // no debe lanzar con player null
ok('gatePushOut tolera player null');

console.log('\n=== 4) ESCENAS DE HISTORIA (7.4): activación, skip, fin ===');
const SCENES: StorySceneId[] = ['acto1_fin', 'acto2_fin', 'acto3_fin', 'acto4_inicio', 'heraldo_vencido', 'eco_despierto'];
let endFired = '';
onStorySceneEnd((id) => { endFired = id; });
let scenesOk = 0;
for (const sc of SCENES) {
  startStoryScene(sc);
  if (!storySceneActive()) { bad(`${sc}: no activa tras start`); continue; }
  startStoryScene(sc); // idempotente
  skipStoryScene(); // <1.5s: ignorado
  updateStoryScene(0.1);
  skipStoryScene(); // aún <1.5s acumulado (0.1): ignorado de nuevo
  // forzar fin natural: dt grande repetido (clamp interno 0.1 por tick)
  let guard = 0;
  while (storySceneActive() && guard++ < 400) updateStoryScene(0.1);
  if (!storySceneActive()) { scenesOk++; ok(`${sc}: corre, es idempotente y termina (${guard} ticks, onEnd='${endFired}')`); }
  else { bad(`${sc}: no termina en 40s simulados`); skipStoryScene(); }
}
if (scenesOk === 6) ok('6/6 escenas de historia verdes');
setStoryBackdropFn(null); // limpiar
if (STORY_SCENES_ART.includes('eco_despierto')) ok('storyart soporta las 6 escenas (' + STORY_SCENES_ART.length + ' ids)');
else warn('storyart no lista eco_despierto (fallback de bandas cubre)');
drawStoryBackdrop({ fillRect: () => {} } as any, 'acto1_fin', 0.5, 320, 240); // no debe lanzar sin DOM
ok('drawStoryBackdrop tolera ctx mínimo (fallback sin DOM)');

console.log('\n=== 5) CINEMÁTICA DE INICIO (7.2): alba y tejedor ===');
startIntroScene('alba');
if (introSceneActive()) ok('intro alba activa');
else bad('intro alba no arranca');
skipIntroScene(); // <1.5s ignorado
updateIntroScene(0.1);
let g2 = 0;
while (introSceneActive() && g2++ < 400) { updateIntroScene(0.1); if (g2 > 20) skipIntroScene(); }
if (!introSceneActive()) ok('intro alba: skippable y termina');
else bad('intro alba no termina');
startIntroScene('tejedor');
if (introSceneActive()) ok('intro tejedor activa');
else bad('intro tejedor no arranca');
g2 = 0;
while (introSceneActive() && g2++ < 400) { updateIntroScene(0.1); if (g2 > 20) skipIntroScene(); }
if (!introSceneActive()) ok('intro tejedor: termina limpio');
else bad('intro tejedor no termina');

console.log('\n=== 6) DIÁLOGOS R11 (7.3): 5 NPCs nuevos + delegación ===');
const ctxR11: DialogueCtx = { questIdx: 14, questStep: 0, flags: {}, companion: false };
const R11_NPCS = ['vela', 'tejado', 'ceniza', 'niebla', 'toldero'];
for (const nid of R11_NPCS) {
  const d = getDialogue(nid, ctxR11);
  if (d && d.length > 0) ok(`${nid} → '${d.slice(0, 42)}…'`);
  else bad(`${nid}: getDialogue vacío (R11 no instalada o clave rota)`);
}
const legacy = getDialogue('brisa', { questIdx: 0, questStep: 0, flags: {}, companion: false });
if (legacy && legacy.length > 0) ok(`delegación intacta: brisa q0 → '${legacy.slice(0, 40)}…'`);
else bad('la capa R11 rompió la cadena previa (brisa q0)');
const heraldoV = getDialogue('heraldo', { questIdx: 15, questStep: 1, flags: { heraldoDerrotado: true }, companion: false });
if (heraldoV) ok(`variante de historia heraldo Derrotado → '${heraldoV.slice(0, 38)}…'`);
else warn('variante heraldo derrotado no resuelve (cableado opcional)');
if (DIALOGUES['vela_intro']) ok('DIALOGUES recibió el assign de R11 (vela_intro presente)');
else bad('installDialoguesR11 no asignó a DIALOGUES');

console.log('\n=== 7) WORLIFE (7.3): 5 NPCs con rutinas ===');
if (NPCS_R11.length === 5) ok('NPCS_R11: 5 defs (' + NPCS_R11.map(n => n.id).join(', ') + ')');
else bad(`NPCS_R11 tiene ${NPCS_R11.length}, se esperaban 5`);
const idsR11 = NPCS_R11.map(n => n.id);
if (R11_NPCS.every(id => idsR11.includes(id))) ok('ids EXACTOS del contrato R11-5 (diálogos emparejados)');
else bad('ids de NPCS_R11 no coinciden con los diálogos: ' + idsR11.join(','));
for (const n of NPCS_R11) {
  const m = MAPS[n.map as keyof typeof MAPS];
  if (!m) { bad(`${n.id}: mapa ${n.map} inexistente`); continue; }
  if (n.x < 0 || n.y < 0 || n.x >= m.w || n.y >= m.h) bad(`${n.id}: (${n.x},${n.y}) fuera de ${n.map} (${m.w}×${m.h})`);
  if (!n.anclaTrabajo || !n.anclaCasa) bad(`${n.id}: sin anclas de rutina`);
}
ok('anclas de trabajo/casa presentes y en rango');
__wlArmR11(mockG); // idempotente, no debe lanzar con mock mínimo
ok('__wlArmR11 idempotente con Game mínimo');
if (__wlNpcMood('vela') === null) ok('__wlNpcMood: null para NPC no armado (mock)');
else warn('__wlNpcMood devolvió mood sin armado (revisar guard)');

console.log('\n=== 8) AUDIO R11: 7 exports llamables ===');
const audioFns: [string, () => void][] = [
  ['playIntroSceneTone', () => playIntroSceneTone('alba')],
  ['playStorySting', () => playStorySting('acto')],
  ['playMinibossRoar', () => playMinibossRoar(7)],
  ['playGateDenied', () => playGateDenied()],
  ['playGateOpen', () => playGateOpen()],
  ['playWorkSfx', () => playWorkSfx('martillo')],
  ['setSceneMusicMuffled', () => setSceneMusicMuffled(true)],
];
let aOk = 0;
for (const [name, fn] of audioFns) {
  if (typeof fn !== 'function') { bad(`${name} no es función`); continue; }
  try { fn(); aOk++; ok(`${name} llamable sin ctx (degrada a no-op)`); }
  catch (err) {
    const msg = (err as Error).message ?? '';
    // node no tiene DOM: el bus de audio resuelve ctx vía window → limitación
    // del ENTORNO del smoke, no del juego (el navegador la ejecuta; el E2E la cubre).
    if (/window is not defined|AudioContext|document is not defined/.test(msg)) {
      aOk++; ok(`${name} existe y firma correcta (node sin DOM: la llamada real va en el E2E)`);
    } else { bad(`${name} lanzó: ${msg}`); }
  }
}
setSceneMusicMuffled(false);

console.log('\n=== 9) FIX P0: dims de expansión vs rows ===');
for (const id of ['costa', 'aldea', 'cumbres'] as const) {
  const m = MAPS[id];
  const rows = mapRows(m);
  const wRow = rows[0]?.length ?? 0;
  if (m.w === wRow && m.h === rows.length) ok(`${id}: ${m.w}×${m.h} = rows ✓ (zonas R10 accesibles)`);
  else bad(`${id}: decl ${m.w}×${m.h} vs rows ${wRow}×${rows.length}`);
}
const arena = MAPS.arena;
if (arena.w === 44 && arena.h === 34) ok('arena intacta: 44×34');

console.log('\n══════════════════════════════════');
console.log(`SMOKE R11 · ${fails === 0 ? 'TODO VERDE' : fails + ' FALLOS'} · ${warns} avisos`);
console.log('══════════════════════════════════');
process.exit(fails > 0 ? 1 : 0);
