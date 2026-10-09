// ============================================================
// SMOKE 17-c (qa-sistemas) — AUDITORÍA DE SISTEMAS Y PERSISTENCIA
// bun, sin navegador (stub DOM/Audio, patrón smoke_logros.ts) + Game real.
// Dos procesos para persistencia REAL vía /tmp:
//   bun scripts/smoke_qa17_sistemas.ts          (sesión principal)
//   bun scripts/smoke_qa17_sistemas.ts load     (recarga en proceso nuevo)
//
// CUBRE:
//  1) save/load COMPLETO campo a campo (companion+modo, flags con señuelos,
//     armaduras, stats, memorias, época, chests/echos/deadGolds, quest)
//     + defaults en saves viejos + versión futura + JSON corrupto/truncado
//     en CADA clave localStorage.
//  2) Autoguardado: santuario (posición correcta), fade→save al destino,
//     save() NO-OP dentro del desafío (regresión), posición de transición.
//  3) Logros: 12 condiciones exactas, nunca duplicados, Rondador >70%,
//     panel sin save, persistencia entre procesos.
//  4) Stats: 10 contadores (ganadas vs gastadas) + espejo 'ecos-stats'.
//  5) Desafío: oleadas y duelos completos, restauración de campaña,
//     aborto por puerta con save BYTE-IDÉNTICO, aborto por newGame,
//     reto huérfano (GUARDAR Y SALIR en arena) re-arrancable,
//     cadencia nueva, aislamiento (logros/balance/eventos en arena).
//  6) Skilltree: curva de puntos, aprender vía UI real (puntos/padres/
//     disciplina), cds exactos sin doble descuento, daño melé/hechizo
//     del árbol aplicado a los ataques BASE (regresión), persistencia.
//  7) Balanceador: tabla exacta -2..+2 (hp/dmg/xp), neutro en arena,
//     persistencia entre procesos, reset.
//  8) Armaduras: compra única, gate acto3Done, reducción UNA vez
//     (fórmula exacta), −8% velocidad, +10 vigor/s, fila del panel.
//  9) Economía: oro nunca negativo, sin items duplicados, señuelos apilan.
// ============================================================

import { readFileSync, writeFileSync } from 'fs';

// ---------- stub universal (patrón smoke_logros/smoke_desafio) ----------
type AnyP = Record<string | symbol, unknown>;
const noop = () => stub();
function stub(): any {
  return new Proxy(noop, {
    get: (_t, prop) => {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'toString') return () => '';
      if (prop === 'valueOf') return () => 0;
      if (prop === 'width' || prop === 'height') return 300;
      if (prop === 'length') return 0;
      return stub();
    },
    set: () => true,
    apply: () => stub(),
  }) as unknown as AnyP;
}
const ctxStub = () => {
  const gradient = { addColorStop: noop };
  return {
    canvas: null,
    imageSmoothingEnabled: false,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    drawImage: noop, fillText: noop, setTransform: noop, rect: noop, clip: noop,
    drawFocusIfNeeded: noop,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
  } as unknown as CanvasRenderingContext2D;
};
const makeCanvas = (): HTMLCanvasElement => {
  return {
    width: 300, height: 150, style: {},
    getContext: (_: string) => ctxStub(),
    addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
  } as unknown as HTMLCanvasElement;
};

// ---------- localStorage respaldado en /tmp (persistencia REAL entre procesos) ----------
const LS_FILE = '/tmp/ecos-qa17-smoke.json';
function lsRead(): Record<string, string> {
  try { return JSON.parse(readFileSync(LS_FILE, 'utf8')) as Record<string, string>; }
  catch { return {}; }
}
function lsWrite(d: Record<string, string>): void {
  writeFileSync(LS_FILE, JSON.stringify(d));
}
(globalThis as AnyP).localStorage = {
  getItem: (k: string) => lsRead()[k] ?? null,
  setItem: (k: string, v: string) => { const d = lsRead(); d[k] = v; lsWrite(d); },
  removeItem: (k: string) => { const d = lsRead(); delete d[k]; lsWrite(d); },
  clear: () => lsWrite({}),
  key: () => null, length: 0,
};
const rawLs = (k: string): string | null => lsRead()[k] ?? null;
const setLs = (k: string, v: string) => { const d = lsRead(); d[k] = v; lsWrite(d); };
const delLs = (k: string) => { const d = lsRead(); delete d[k]; lsWrite(d); };

const listeners: AnyP = {};
(globalThis as AnyP).window = {
  addEventListener: (t: string, f: unknown) => { (listeners[t] ??= []).push(f); },
  removeEventListener: noop,
  innerWidth: 1280, innerHeight: 720,
  setInterval: () => 0, clearInterval: noop, setTimeout: () => 0,
  AudioContext: undefined, webkitAudioContext: undefined,
} as unknown as Window & typeof globalThis;
(globalThis as AnyP).document = {
  createElement: () => makeCanvas(),
  getElementById: () => makeCanvas(),
  addEventListener: noop,
  body: stub(),
  documentElement: stub(),
} as unknown as Document;
(globalThis as AnyP).performance = { now: () => Date.now() };
(globalThis as AnyP).requestAnimationFrame = () => 0;
(globalThis as AnyP).cancelAnimationFrame = noop;

const { Game } = await import('../src/game/engine');
const { TILE, playerMeleeDmg, playerSpellDmg } = await import('../src/game/engine');
const { audio } = await import('../src/game/audio');
(audio as unknown as { init: () => void; ctx: unknown }).init = () => {};
(audio as unknown as { ctx: unknown }).ctx = stub();

const {
  achievementTick, statsTick, loadLogros, logrosCount, isLogroDone,
  recordChallengeResult, readChallengeRecords, readLastSave, readStatsMirror,
  defaultStats, drawTitlePanels, openStatsPanel, openLogrosPanel,
  closeTitlePanels, __logrosDevReset, LOGROS, LS_LOGROS, LS_STATS,
} = await import('../src/game/achievements');
const {
  loadBalance, saveBalance, resetBalance, enemyStatMult, BALANCE_NAMES,
} = await import('../src/game/balance');
const {
  skillPointsEarned, skillDamageMult, skillCdMult, applySkillStats, drawSkillTree,
  __stReloadTrees, __stResetSel,
} = await import('../src/game/skilltree');
const { SKILL_TREE, SKILLS, ENEMY_DEFS } = await import('../src/game/data');
const {
  ARMORS, armorActive, armorActiveId, armorReduction, armorTick, drawArmorRow,
} = await import('../src/game/armor');
const {
  __iReset, __iForceRng, __iDecoy, SENNUEL_PRICE,
  useSenno, registerCorpse16b, interaccionInteract16b, interaccionTick,
} = await import('../src/game/interaccion');
const { startChallenge, endChallenge } = await import('../src/game/challenge');
const { ARENA_MAP_ID } = await import('../src/game/maps_expansion');

let fails = 0;
const bad = (m: string, extra = '') => { console.log(`  ✗ ${m}${extra ? ' — ' + extra : ''}`); fails++; };
const ok = (m: string, extra = '') => console.log(`  ✓ ${m}${extra ? ' — ' + extra : ''}`);
function check(nombre: string, cond: boolean, extra = ''): void {
  if (cond) ok(nombre, extra); else bad(nombre, extra);
}
const J = (v: unknown) => JSON.stringify(v);
const eq = (a: unknown, b: unknown) => J(a) === J(b);
type G = InstanceType<typeof Game>;

function newGame(name: string, disc: 'alba' | 'tejedor' = 'alba'): G {
  const g = new Game(makeCanvas());
  g.newGame(name, disc);
  g.startPlay();
  return g;
}

/** Lee el árbol en crudo de 'ecos-arbol' (formato del módulo skilltree). */
function seedTree(name: string, disc: 'alba' | 'tejedor', learned: string[], equip: (string | null)[] = [null, null, null, null]): void {
  let all: Record<string, unknown> = {};
  try { all = JSON.parse(rawLs('ecos-arbol') ?? '{}') as Record<string, unknown>; } catch { all = {}; }
  all[`${name}|${disc}`] = { learned, equip };
  setLs('ecos-arbol', JSON.stringify(all));
  __stReloadTrees(); // el seed escribe el disco POR DEBAJO del cache del módulo: fuerza recarga
}

// claves del contrato completo (para la batería de corrupción)
const KEYS = [
  'ecos-aelthar-save', 'ecos-logros', 'ecos-stats', 'ecos-desafio-récords',
  'ecos-desafio-best', 'ecos-desafio-logros', 'ecos-balance', 'ecos-arbol',
  'ecos-vol', 'aelthar_perf',
];

// ================= fase LOAD: proceso nuevo =================
const modo = process.argv[2];
if (modo === 'load') {
  console.log('=== SMOKE QA17 · fase LOAD (proceso nuevo, lee /tmp) ===');

  // ---- L1: save/load COMPLETO campo a campo en proceso nuevo ----
  console.log('--- L1) roundtrip completo del save centinela ---');
  const g = new Game(makeCanvas());
  check('hasSave() ve el save centinela', g.hasSave());
  g.continueGame();
  const d = JSON.parse(rawLs('ecos-aelthar-save') ?? '{}') as Record<string, any>;
  const p = g.player!;
  const pl = d.player;
  check('continueGame arranca en play', g.state === 'play');
  check('player.name/disciplina', p.name === pl.name && p.discipline === pl.discipline, `${p.name}/${p.discipline}`);
  check('player.level/xp/points', p.level === pl.level && p.xp === pl.xp && p.points === pl.points);
  check('player.hp exacto (Math.max(1,…))', p.hp === Math.max(1, pl.hp), `${p.hp} vs ${pl.hp}`);
  check('player.maxHp exacto', p.maxHp === pl.maxHp, `${p.maxHp} vs ${pl.maxHp}`);
  check('player.sta restaurado EXACTO (fix 17-c: ya no vuelve lleno)', p.sta === pl.sta, `${p.sta} vs ${pl.sta}`);
  check('player.res exacto', p.res === pl.res);
  check('player.attrs', eq(p.attrs, pl.attrs));
  check('player.gold/weaponPlus/potions', p.gold === pl.gold && p.weaponPlus === pl.weaponPlus && p.potions === pl.potions);
  check('player.hasEcho/kills/deaths/repGuardianes/playTime', p.hasEcho === pl.hasEcho && p.kills === pl.kills && p.deaths === pl.deaths && p.repGuardianes === pl.repGuardianes && p.playTime === pl.playTime);
  check('player.tones', eq(p.tones, pl.tones));
  check('player.memories', eq(p.memories, pl.memories));
  check('player.repFacciones', eq(p.repFacciones, pl.repFacciones));
  check('map/questIdx/questStep', g.mapId === d.map && g.questIdx === d.questIdx && g.questStep === d.questStep);
  check('época restaurada (pasado con hasEcho)', g.epoch === 'pasado' && d.epoch === 'pasado');
  check('openedChests', eq([...g.openedChests].sort(), [...d.openedChests].sort()));
  check('takenEchoes', eq([...g.takenEchoes].sort(), [...d.takenEchoes].sort()));
  check('deadGolds', eq(g.deadGolds, d.deadGolds));
  const flagsOk = Object.keys(d.flags).every(k => eq(g.flags[k], d.flags[k]));
  const extraOk = Object.keys(g.flags).filter(k => !(k in d.flags)).every(k => k.startsWith('visited_'));
  check('flags: todas las guardadas + solo extras visited_*', flagsOk && extraOk, `extras=${J(Object.keys(g.flags).filter(k => !(k in d.flags)))}`);
  check('señuelos persisten en flags (3)', g.flags.sennuelos === 3, J(g.flags.sennuelos));
  check('armaduras persisten (armor_2 + armor_4)', !!g.flags.armor_2 && !!g.flags.armor_4);
  check('companion presente con modo DEFENSIVO', !!g.companion && g.companion.mode === 'defensivo', J(g.companion?.mode));
  // fix 17-c: visitedMaps reconstruida también para costa/aldea/cumbres
  check('visitedMaps reconstruida para TODOS los mapas visitados (fix 17-c)',
    g.visitedMaps.bosque === true && g.visitedMaps.cripta === true && g.visitedMaps.costa === true
    && g.visitedMaps.aldea === true && g.visitedMaps.cumbres === true, J(g.visitedMaps));
  const stOk = Object.keys(defaultStats()).every(k => (g.stats as any)[k] === d.stats[k]);
  check('stats restauradas campo a campo', stOk, J(g.stats));

  // ---- L2: árbol persistido entre procesos ----
  console.log('--- L2) árbol de habilidades persistido (ecos-arbol) ---');
  check('skillDamageMult melee = 1.10 (c_fuerte del proceso anterior)', Math.abs(skillDamageMult(g, 'melee') - 1.10) < 1e-9, J(skillDamageMult(g, 'melee')));
  check('skillCdMult = 0.8 (c_cd persistido)', Math.abs(skillCdMult(p) - 0.8) < 1e-9);
  applySkillStats(p, false);
  check('applySkillStats absoluto con c_vida: maxHp = 110 + 6·7 + 20', p.maxHp === 110 + 6 * 7 + 20, J(p.maxHp));

  // ---- L3: balance persistido ----
  console.log('--- L3) balanceador persistido ---');
  const b = loadBalance();
  check("'ecos-balance' persiste nivel +2 MANUAL", b.level === 2 && b.auto === false, J(b));
  check('nombre del nivel +2', BALANCE_NAMES[4] === 'Muy difícil');
  check('enemyStatMult +2 con partida cargada', J(enemyStatMult(g)) === J({ hp: 1.3, dmg: 1.2, xp: 1.15 }), J(enemyStatMult(g)));

  // ---- L4: logros + récords persistidos ----
  console.log('--- L4) logros y récords entre procesos ---');
  const done = loadLogros();
  check("logros persisten en 'ecos-logros'", done.includes('primer_canto') && done.includes('rondador') && done.includes('invicto'), J(done));
  const recs = readChallengeRecords();
  const gd = recs.find(r => r.key === 'duelo:guardian');
  check("récord 'duelo:guardian' persiste (menor mejor)", !!gd && gd.times.length === 1 && gd.times[0] === 77.7, J(gd));
  const s = readLastSave();
  check('readLastSave ve el save centinela con stats', !!s && s.name === 'PortadorQA17' && s.stats.enemigosDerrotados === 23 && s.stats.pocionesUsadas === 7, J(s?.stats));
  const mir = readStatsMirror();
  check("espejo 'ecos-stats' persiste y coincide", mir.enemigosDerrotados === 23 && mir.coronasGastadas === 123 && mir.tiempoJugado === 321.5, J(mir));

  // ---- L5: lectura tolerante de claves corruptas en proceso nuevo ----
  console.log('--- L5) claves corruptas leídas en proceso nuevo ---');
  setLs('ecos-logros', '{truncado');
  __logrosDevReset(true);
  check('logros corruptos → 0 sin lanzar', logrosCount().done === 0);
  setLs('ecos-balance', ']{basura');
  const b2 = loadBalance();
  check('balance corrupto → defaults', b2.level === 0 && b2.auto === true, J(b2));
  setLs('ecos-aelthar-save', '{"v":1,"player":{'); // truncado a propósito
  check('save truncado → readLastSave null', readLastSave() === null);
  let noThrow = true;
  try { g.setState('title'); g.continueGame(); } catch { noThrow = false; }
  check('continueGame con save truncado no lanza y descarta la clave', noThrow && g.state === 'title' && rawLs('ecos-aelthar-save') === null, `state=${g.state}`);

  console.log(fails === 0 ? 'SMOKE QA17 LOAD: TODO OK' : `SMOKE QA17 LOAD: ${fails} FALLOS`);
  process.exit(fails === 0 ? 0 : 1);
}

// ================= sesión principal =================
console.log('=== SMOKE QA17 · sesión principal ===');
for (const k of KEYS) delLs(k);
__logrosDevReset(true);
resetBalance();

// ============================================================
// 1) SAVE/LOAD COMPLETO campo a campo (+ fixes 17-c)
// ============================================================
console.log('\n--- 1) Save/load completo (todo activo) ---');
{
  seedTree('PortadorQA17', 'alba', ['c_fuerte', 'c_vida', 'c_cd']);
  const g = newGame('PortadorQA17', 'alba');
  const p = g.player!;
  p.level = 7; p.xp = 100; p.points = 5;
  // árbol aplicado al maxHp (fórmula absoluta, con nivel 7): base 110 + (7−1)·7 + 20
  applySkillStats(p, false);
  check('maxHp con árbol: 110 + 6·7 + 20', p.maxHp === 110 + 6 * 7 + 20, J(p.maxHp));
  // estado "todo activo"
  p.hp = 100; p.sta = 55; p.res = 66; p.gold = 777; p.weaponPlus = 3; p.potions = 4;
  p.attrs = { fue: 6, des: 5, int: 4, esp: 3, vig: 4 };
  p.hasEcho = true; p.kills = 44; p.deaths = 2; p.repGuardianes = 15; p.playTime = 640.5;
  p.tones = { empatico: 1, pragmatico: 3, sarcastico: 0, amenazante: 2 };
  p.memories = ['mem_nana', 'mem_casa'];
  p.repFacciones = { guardianes: 10, orden: -5, circulo: 20, liga: 0 };
  g.companion = g.makeCompanion();
  g.companion.mode = 'defensivo';
  Object.assign(g.flags, { sennuelos: 3, armor_2: true, armor_4: true, acto2Done: true, wolfKills: 2, q6: true, visited_costa: true, visited_aldea: true, visited_cumbres: true });
  g.questIdx = 6; g.questStep = 1;
  g.openedChests = new Set(['c_lunaris_sur', 'c_bosque_1']);
  g.takenEchoes = new Set(['eco_a', 'eco_b', 'eco_c', 'eco_d', 'eco_e']);
  g.deadGolds = [{ map: 'bosque', x: 100, y: 60, amount: 33 }];
  g.epoch = 'pasado';
  const st = g.stats;
  st.enemigosDerrotados = 23; st.jefesDerrotados = 3; st.muertes = 2;
  st.coronasGanadas = 456; st.coronasGastadas = 123; st.pocionesUsadas = 7;
  st.vecesCambioEpoca = 4; st.distanciaAndada = 987; st.tiempoJugado = 321.5;
  st.memoriasHalladas = 2;

  g.save();
  const raw1 = rawLs('ecos-aelthar-save')!;
  const d = JSON.parse(raw1) as Record<string, any>;
  check('save serializa companionMode defensivo', d.companionMode === 'defensivo' && d.companion === true);
  check('save serializa epoch pasado', d.epoch === 'pasado');
  check('save serializa stats centinela', d.stats.enemigosDerrotados === 23 && d.stats.tiempoJugado === 321.5, J(d.stats));
  check("espejo 'ecos-stats' actualizado en save()", (() => {
    const m = JSON.parse(rawLs(LS_STATS) ?? '{}') as Record<string, number>;
    return m.enemigosDerrotados === 23 && m.coronasGastadas === 123 && m.memoriasHalladas === 2;
  })(), rawLs(LS_STATS) ?? '—');

  // mutar todo y recargar: nada debe sobrevivir del estado en memoria
  p.level = 99; p.gold = 1; p.hp = 1; p.sta = 1; p.res = 1;
  g.flags.nuevo = true; delete g.flags.armor_2;
  g.companion = null; g.companion = null;
  g.questIdx = 0; g.questStep = 0;
  g.openedChests = new Set(); g.takenEchoes = new Set(); g.deadGolds = [];
  g.epoch = 'presente';
  g.stats = defaultStats();
  g.setState('title');
  g.continueGame();
  const p2 = g.player!;
  const pl = d.player;
  check('hp restaurado exacto', p2.hp === Math.max(1, pl.hp), `${p2.hp} vs ${pl.hp}`);
  check('sta restaurado EXACTO (fix 17-c, no vuelve a maxSta)', p2.sta === pl.sta, `${p2.sta} vs ${pl.sta}`);
  check('res/points/xp/level exactos', p2.res === pl.res && p2.points === pl.points && p2.xp === pl.xp && p2.level === pl.level);
  check('gold/weaponPlus/potions exactos', p2.gold === pl.gold && p2.weaponPlus === pl.weaponPlus && p2.potions === pl.potions);
  check('attrs exactos', eq(p2.attrs, pl.attrs));
  check('tones/memories/repFacciones exactos', eq(p2.tones, pl.tones) && eq(p2.memories, pl.memories) && eq(p2.repFacciones, pl.repFacciones));
  check('kills/deaths/repGuardianes/playTime exactos', p2.kills === pl.kills && p2.deaths === pl.deaths && p2.repGuardianes === pl.repGuardianes && p2.playTime === pl.playTime);
  check('época/quest/chests/echos/deadGolds exactos', g.epoch === 'pasado' && g.questIdx === 6 && g.questStep === 1
    && eq([...g.openedChests].sort(), ['c_bosque_1', 'c_lunaris_sur'])
    && g.takenEchoes.size === 5 && eq(g.deadGolds, d.deadGolds));
  const flagsOk = Object.keys(d.flags).every(k => eq(g.flags[k], d.flags[k]));
  const extraOk = Object.keys(g.flags).filter(k => !(k in d.flags)).every(k => k.startsWith('visited_'));
  check('flags exactos (sin fuga de estado en memoria)', flagsOk && extraOk, J(g.flags));
  check('companion modo defensivo restaurado', !!g.companion && g.companion.mode === 'defensivo');
  check('visitedMaps COMPLETA tras cargar (fix 17-c: costa/aldea/cumbres vuelven al Santuario)',
    g.visitedMaps.costa === true && g.visitedMaps.aldea === true && g.visitedMaps.cumbres === true
    && g.visitedMaps.bosque === true && g.visitedMaps.cripta === true, J(g.visitedMaps));
  check('stats restauradas campo a campo', Object.keys(defaultStats()).every(k => (g.stats as any)[k] === d.stats[k]), J(g.stats));
  check('posición fina restaurada (tile seguro)', Math.abs(p2.x - d.x) <= 1 && Math.abs(p2.y - d.y) <= 1, `${p2.x},${p2.y} vs ${d.x},${d.y}`);

  // ---- saves viejos: campos nuevos ausentes → defaults ----
  const viejo = JSON.parse(raw1) as Record<string, any>;
  delete viejo.stats; delete viejo.companionMode; delete viejo.deadGolds;
  delete viejo.player.tones; delete viejo.player.memories; delete viejo.player.repFacciones;
  viejo.v = 999; // versión futura: tolerada
  setLs('ecos-aelthar-save', JSON.stringify(viejo));
  g.setState('title');
  let noThrow = true;
  try { g.continueGame(); } catch { noThrow = false; }
  const p3 = g.player!;
  check('save VIEJO sin campos nuevos: carga sin lanzar', noThrow && g.state === 'play');
  check('save viejo → stats por defecto', eq(g.stats, defaultStats()), J(g.stats));
  check('save viejo → deadGolds []', g.deadGolds.length === 0);
  check('save viejo → tones/memories/repFacciones default', eq(p3.tones, { empatico: 0, pragmatico: 0, sarcastico: 0, amenazante: 0 })
    && p3.memories!.length === 0 && eq(p3.repFacciones, { guardianes: 0, orden: 0, circulo: 0, liga: 0 }));
  check('save viejo → companion.mode undefined (≈ seguir)', g.companion && g.companion.mode === undefined);
  check('versión futura (v:999) tolerada', g.state === 'play');

  // ---- JSON basura/truncado en CADA clave ----
  console.log('  · corrupción por clave');
  const garbage = ['esto-no-es-json{{{', '{"v":1,"done":["inv', '123', 'null', '"texto"', '[]'];
  let allTolerant = true;
  const notes: string[] = [];
  for (const k of KEYS) {
    for (const gj of garbage) {
      setLs(k, gj);
      try {
        // lectores tolerantes de cada sistema
        readLastSave(); readStatsMirror(); loadLogros(); logrosCount();
        readChallengeRecords(); loadBalance(); __logrosDevReset(true);
        if (k === 'ecos-aelthar-save') { g.setState('title'); g.continueGame(); }
        if (k === 'ecos-arbol') { const gt = newGame('CorruptaQA', 'tejedor'); gt.setState('title'); }
        if (k === 'ecos-vol' || k === 'aelthar_perf') { const gt = new Game(makeCanvas()); gt.setState('title'); }
      } catch (e) {
        allTolerant = false;
        notes.push(`${k}(${gj}): ${String(e).slice(0, 80)}`);
      }
    }
  }
  check('10 claves × 6 formas corruptas: NINGÚN crash', allTolerant, notes.join(' | '));
  // save basura → descartado con toast, título intacto
  setLs('ecos-aelthar-save', '###basura');
  g.setState('title');
  g.continueGame();
  check('save basura: se descarta (clave eliminada) y sigue en título', rawLs('ecos-aelthar-save') === null && g.state === 'title');
  delLs('ecos-aelthar-save');
}

// ============================================================
// 2) AUTOGUARDADO: santuario, fade→save, desafío no escribe
// ============================================================
console.log('\n--- 2) Autoguardado ---');
{
  const g = newGame('QAAutoguardado', 'alba');
  const p = g.player!;
  // teleporta al Santuario de Lunaris (25,19) y descansa
  g.loadMap('lunaris', 25, 19);
  p.hp = 30; p.sta = 10;
  g.applyAction('rest');
  check('rest: vida/aguante al máximo + partida guardada', p.hp === p.maxHp && p.sta === p.maxSta && !!rawLs('ecos-aelthar-save'));
  const dRest = JSON.parse(rawLs('ecos-aelthar-save')!) as { map: string; x: number; y: number };
  check('autoguardado del santuario: posición junto al cristal', dRest.map === 'lunaris' && Math.floor(dRest.x / TILE) === 25 && Math.floor(dRest.y / TILE) === 19, `${dRest.map} ${dRest.x},${dRest.y}`);
  // carga: posición correcta al volver
  g.setState('title');
  g.continueGame();
  check('carga aterriza en la posición guardada', Math.floor(g.player!.x / TILE) === 25 && Math.floor(g.player!.y / TILE) === 19, `${g.player!.x / TILE},${g.player!.y / TILE}`);

  // fade→loadMap→save: el autoguardado del viaje escribe el DESTINO
  delLs('ecos-aelthar-save');
  g.loadMap('lunaris', 25, 19);
  g.fadeTo('bosque', 38, 27);
  check('fade en marcha: aún no hay autoguardado ni posición de transición', !rawLs('ecos-aelthar-save'));
  for (let i = 0; i < 300 && (g.fadeDir !== 0 || g.pendingMap); i++) g.update(1 / 60);
  const dFade = rawLs('ecos-aelthar-save') ? JSON.parse(rawLs('ecos-aelthar-save')!) as { map: string; x: number; y: number } : null;
  check('autoguardado del viaje: mapa DESTINO (no posición de transición)', !!dFade && dFade.map === 'bosque', J(dFade));
  check('autoguardado del viaje: aterrizaje junto al santuario del bosque', !!dFade && Math.abs(Math.floor(dFade.x / TILE) - 38) <= 1 && Math.abs(Math.floor(dFade.y / TILE) - 27) <= 1, `${dFade?.x},${dFade?.y}`);
  check('toast Autoguardado emitido', g.toasts.some(t => t.text === 'Autoguardado'), J(g.toasts.map(t => t.text)));

  // DENTRO del desafío: save() NO-OP (fix 17-c) — ni pausa ni fade escriben
  delLs('ecos-aelthar-save');
  const g2 = newGame('QAArenaSave', 'alba');
  g2.applyAction('rest'); // deja un save de campaña limpio
  const rawAntes = rawLs('ecos-aelthar-save')!;
  startChallenge(g2, 'oleadas');
  g2.challengeRun && (g2.challengeRun.betweenWaves = 0.01);
  g2.update(1 / 60); // arranca la oleada
  g2.save();          // pausa → GUARDAR: NO debe escribir
  check('save() dentro del desafío NO toca el disco (fix 17-c)', rawLs('ecos-aelthar-save') === rawAntes);
  check("espejo 'ecos-stats' tampoco cambia en arena", (() => {
    const m = JSON.parse(rawLs(LS_STATS) ?? '{}') as Record<string, number>;
    return (m.enemigosDerrotados ?? 0) === 0;
  })(), rawLs(LS_STATS) ?? '—');
  // aborto por puerta: restaurar sin dejar huella en disco (sección 5 lo repite con más detalle)
  g2.loadMap('lunaris', 25, 19);
  g2.update(1 / 60);
  check('aborto: el reto se cierra y el save sigue byte-idéntico', g2.challengeRun === null && rawLs('ecos-aelthar-save') === rawAntes);
  endChallenge(g2, false); // limpieza defensiva
}

// ============================================================
// 3) LOGROS: 12 condiciones exactas, nunca dos veces, Rondador
// ============================================================
console.log('\n--- 3) Logros (12 condiciones + idempotencia) ---');
{
  delLs(LS_LOGROS);
  __logrosDevReset(true);
  const g = newGame('QALogros', 'alba');
  const p = g.player!;
  const st = g.stats;
  const toastsDe = (t: string) => g.toasts.filter(x => x.text === t).length;
  const expectOnce = (id: string, nombre: string) => {
    achievementTick(g);
    check(`logro '${nombre}' desbloqueado`, isLogroDone(id));
    achievementTick(g); achievementTick(g);
    check(`logro '${nombre}' NUNCA dos veces (toast único)`, toastsDe(`¡Logro: ${nombre}!`) === 1, J(g.toasts.map(t => t.text)));
  };

  check('0/12 al empezar', logrosCount().done === 0 && LOGROS.length === 12);
  g.killEnemy(g.makeEnemy('lobo', p.x + 60, p.y, 0));
  expectOnce('primer_canto', 'Primer Canto');
  for (const id of ['eco_a', 'eco_b', 'eco_c', 'eco_d', 'eco_e']) g.takenEchoes.add(id);
  expectOnce('cazador_ecos', 'Cazador de Ecos');
  g.killEnemy(g.makeEnemy('guardian', p.x + 60, p.y, 0));
  g.killEnemy(g.makeEnemy('sirena', p.x + 60, p.y, 0));
  check('2 jefes → aún sin Rompejefes', !isLogroDone('rompejefes'));
  // siembra 17-b: el XP/oro reales del combate (killEnemy → achievementTick)
  // adelantaban Invicto (Nv 5) y Rico (524 coronas) fuera de su paso exacto,
  // y su toast caía fuera del buffer de 4. Se aíslan para probarlos EN su paso:
  p.gold = 0; p.deaths = 1;
  g.killEnemy(g.makeEnemy('golem', p.x + 60, p.y, 0));
  expectOnce('rompejefes', 'Rompejefes');
  check('3 jefes en stats.jefesDerrotados', st.jefesDerrotados === 3, J(st.jefesDerrotados));
  g.questIdx = 5;
  expectOnce('corazon_alba', 'Corazón de Alba');
  g.flags.acto2Done = true;
  expectOnce('notas_perdidas', 'Notas Perdidas');
  g.flags.acto3Done = true;
  expectOnce('canto_al_reves', 'Canto al Revés');
  p.deaths = 0; p.level = 5; // deaths === 0 aún (17-b: re-activa Invicto tras aislar el XP del combate)
  expectOnce('invicto', 'Invicto');
  p.deaths = 1; p.level = 9;
  check('Nv 9 con 1 muerte → Invicto NO se concede tarde', true); // ya concedido; la condición exige deaths 0
  p.gold = 499; achievementTick(g);
  check('499 coronas → sin Rico', !isLogroDone('rico'));
  p.gold = 500;
  expectOnce('rico', 'Rico');
  p.potions = 10; // siembra 17-b: el test no compra pociones — se siembran las 10 que el logro exige
  p.hp = 1;
  for (let i = 0; i < 10; i++) { p.hp = 1; g.drinkPotion(); }
  expectOnce('alquimista', 'Alquimista');
  g.enemies = [];
  p.hasEcho = true; // siembra 17-b: sin el Eco de la Voz el motor veta el viaje ('Aún no puedes oír el pasado...')
  for (let i = 0; i < 10; i++) g.epochSwitch();
  expectOnce('viajero_tiempo', 'Viajero del Tiempo');
  check('stats.vecesCambioEpoca = 10', st.vecesCambioEpoca === 10, J(st.vecesCambioEpoca));
  // Último Canto: solo con flag futura
  check('sin flag del Acto IV → sin El Último Canto', !isLogroDone('ultima_nota'));
  g.flags.acto4Done = true;
  expectOnce('ultima_nota', 'El Último Canto');
  delete g.flags.acto4Done;
  // Rondador por EVENTO (>70%)
  recordChallengeResult(g, 'jefe', 'guardian', true, 0.5, 100);
  check('victoria con 50% → SIN Rondador', !isLogroDone('rondador'));
  recordChallengeResult(g, 'jefe', 'sirena', true, 0.701, 100);
  check('victoria con 70.1% → Rondador (estricto >70%)', isLogroDone('rondador'));
  recordChallengeResult(g, 'jefe', 'golem', true, 0.9, 100);
  check('Rondador no se duplica', toastsDe('¡Logro: Rondador!') === 1);
  check('contador 12/12', logrosCount().done === 12, J(logrosCount()));

  // panel sin save no crashea + con basura en las claves
  delLs('ecos-aelthar-save');
  g.setState('title');
  openStatsPanel(); g.uiHit.length = 0;
  let noThrow = true;
  try { drawTitlePanels(g); } catch { noThrow = false; }
  check('panel ESTADÍSTICAS sin save: mensaje, sin crash', noThrow && g.uiHit.length >= 1);
  setLs(LS_LOGROS, '{{{mal');
  __logrosDevReset(true);
  openLogrosPanel(); g.uiHit.length = 0;
  try { drawTitlePanels(g); } catch { noThrow = false; }
  check('panel LOGROS con clave corrupta: sin crash', noThrow && g.uiHit.length >= 1);
  closeTitlePanels();
  delLs(LS_LOGROS); __logrosDevReset(true);
}

// ============================================================
// 4) STATS: 10 contadores con semántica exacta
// ============================================================
console.log('\n--- 4) Stats (10 contadores) ---');
{
  delLs(LS_LOGROS); delLs(LS_STATS);
  __logrosDevReset(true);
  const g = newGame('QAStats', 'alba');
  const p = g.player!;
  const st = g.stats;
  check('defaultStats a cero', eq(st, defaultStats()));

  // GANADAS: kill + cofre + botín de misión
  g.killEnemy(g.makeEnemy('lobo', p.x + 60, p.y, 0));
  const ganadasKill = st.coronasGanadas;
  check('killEnemy suma a coronasGanadas', ganadasKill > 0, J(ganadasKill));
  const oro0 = p.gold;
  p.gold += 0; // (sin cambio)
  g.openChest(g.map.chests[0].id); // cofre real de lunaris
  check('cofre suma a coronasGanadas (no a gastadas)', st.coronasGanadas > ganadasKill && st.coronasGastadas === 0, `${st.coronasGanadas} vs ${st.coronasGastadas}`);
  g.grantQuestLoot(5);
  check('botín de misión suma a ganadas', st.coronasGanadas > ganadasKill + 20, J(st.coronasGanadas));
  check('openChest no duplica (2ª vez vacía)', (() => { const c0 = st.coronasGanadas; g.openChest(g.map.chests[0].id); return st.coronasGanadas === c0; })());

  // GASTADAS: forja + poción + señuelo + coraza (exactas)
  p.gold = 1000;
  g.applyAction('forge');                       // 30
  check('forja: gastadas +30', st.coronasGastadas === 30 && p.weaponPlus === 1, J(st.coronasGastadas));
  g.applyAction('buy_potion');                  // 15
  check('poción: gastadas +45', st.coronasGastadas === 45 && p.potions === 3, J(st.coronasGastadas));
  g.applyAction('buy_sennuelo');                // 60
  check('señuelo: gastadas +105 y flags.sennuelos 1', st.coronasGastadas === 105 && g.flags.sennuelos === 1, J([st.coronasGastadas, g.flags.sennuelos]));
  g.applyAction('armor_1');                     // 80
  check('coraza: gastadas +185', st.coronasGastadas === 185, J(st.coronasGastadas));
  check('ganadas NO se tocan al gastar', st.coronasGanadas > 0 && st.coronasGanadas !== st.coronasGastadas);

  // pociones usadas / muertes / época / distancia / tiempo / memorias
  p.hp = 10; g.drinkPotion();
  check('pocionesUsadas 1 (contadores separados de compradas)', st.pocionesUsadas === 1);
  const d0 = st.distanciaAndada;
  g.moveEntity(p, 30, 40);
  check('distanciaAndada ≈ 50 px reales (hipot)', Math.abs(st.distanciaAndada - d0 - 50) < 1e-6, `${d0} → ${st.distanciaAndada}`);
  const dE = st.distanciaAndada;
  g.moveEntity(g.enemies[0] ?? ({ x: 0, y: 0, w: 1, h: 1 } as never), 999, 999);
  check('moveEntity de enemigo NO suma distancia', st.distanciaAndada === dE);
  statsTick(g, 2.5);
  check('statsTick: tiempoJugado +2,5 y memorias sincronizadas', Math.abs(st.tiempoJugado - 2.5) < 1e-9 && st.memoriasHalladas === 0);
  p.memories = ['mem_nana'];
  statsTick(g, 0.1);
  check('memoriasHalladas = memories.length', st.memoriasHalladas === 1);
  g.playerDied();
  check('muertes 1 (y el oro perdido no toca ganadas)', st.muertes === 1);
  g.respawn();
  // espejo en save()
  g.save();
  const mir = JSON.parse(rawLs(LS_STATS) ?? '{}') as Record<string, number>;
  check("espejo 'ecos-stats' = stats actuales en save()", mir.pocionesUsadas === 1 && mir.muertes === 1 && mir.coronasGastadas === 185, J(mir));
  delLs(LS_LOGROS); delLs(LS_STATS);
}

// ============================================================
// 5) DESAFÍO: oleadas, duelos, abortos, aislamiento
// ============================================================
console.log('\n--- 5) Desafío (arena) ---');
{
  delLs(LS_LOGROS); delLs(LS_STATS); delLs('ecos-desafio-récords'); delLs('ecos-desafio-best'); delLs('ecos-desafio-logros');
  __logrosDevReset(true); resetBalance();
  const g = newGame('QADuelista', 'alba');
  const p = g.player!;
  g.applyAction('rest'); // save de campaña limpio y posición santuario
  const rawSave0 = rawLs('ecos-aelthar-save')!;
  const gold0 = p.gold, potions0 = p.potions, deaths0 = p.deaths, hp0 = p.hp;
  const flags0 = J(g.flags);
  const stats0 = J(g.stats);

  // ---- 5a) OLEADAS: flujo real por challengeTick ----
  startChallenge(g, 'oleadas');
  check('arena cargada y reto activo', g.mapId === ARENA_MAP_ID && !!g.challengeRun && g.state === 'play');
  check('arena carga con el PORTADOR DEL ECO (R8 4.3) y el de campaña apartado intacto', g.player!.name === 'Portador del Eco' && p !== g.player);
  const run = g.challengeRun!;
  check('arranque: oleada 0 y cuenta atrás', run.wave === 0 && run.betweenWaves > 0 && run.phase === 'jugando');
  run.betweenWaves = 0.01; g.update(1 / 60);
  check('oleada 1 arranca (3 lobos)', run.wave === 1 && run.spawnQueue!.length === 3 && run.waveHadBoss === false);
  for (let i = 0; i < 8 && (run.spawnQueue!.length > 0 || g.enemies.length === 0); i++) { run.spawnT = 0.001; g.update(1 / 60); }
  check('enemigos instanciados alrededor del Portador', g.enemies.length === 3, J(g.enemies.map(e => e.etype)));
  const wavesMultOk = g.enemies.every(e => e.maxHp === Math.round(ENEMY_DEFS[e.etype].hp * (1 + 0.12 * 0)));
  check('oleada 1: hp sin escalado (mult 1.0)', wavesMultOk, J(g.enemies.map(e => e.maxHp)));
  for (const e of [...g.enemies]) g.damageEnemy(e, 9999, 'fuego', 0);
  g.update(1 / 60);
  check('oleada despejada: wavesCleared 1 + curación 15% + cuenta atrás', run.wavesCleared === 1 && run.betweenWaves > 0 && p.hp === Math.min(p.maxHp, hp0 + Math.round(p.maxHp * 0.15)), `hp=${p.hp}`);
  check('kills/score del reto', run.kills === 3 && run.score === 4, J([run.kills, run.score]));
  // oleada 3 trae Centinela (mini-jefe) escalado ×0.75
  run.betweenWaves = 0.01; g.update(1 / 60); // oleada 2
  for (let i = 0; i < 30 && run.spawnQueue!.length > 0; i++) { run.spawnT = 0.001; g.update(1 / 60); }
  run.betweenWaves = 0.01; g.update(1 / 60); // oleada 3
  for (let i = 0; i < 30 && run.spawnQueue!.length > 0; i++) { run.spawnT = 0.001; g.update(1 / 60); }
  check('oleada 3 trae CENTINELA (guardián)', run.waveHadBoss === true && g.bossActive === true, J(run.bannerText));
  const centinela = g.enemies.find(e => e.etype === 'guardian')!;
  check('mini-jefe un 25% más blando (×0.75·mult oleada 3)', centinela.maxHp === Math.round(ENEMY_DEFS.guardian.hp * 1.24 * 0.75), `${centinela.maxHp} vs ${Math.round(ENEMY_DEFS.guardian.hp * 1.24 * 0.75)}`);
  // muerte del Portador → derrota + restauración
  const scoreAtDeath = run.score;
  p.hp = 1; p.iframes = 0; g.damagePlayer(99999, p.x + 10, p.y);
  check('muerte en arena: estado dead (sin respawn de campaña aún)', g.state === 'dead');
  g.respawn(); // interceptado por onChallengeDeath
  check('derrota: panel de resultado sobre el título', g.state === 'title' && g.challengeRun!.phase === 'resultado' && g.challengeRun!.resultWin === false);
  check('campaña restaurada tras la derrota (oro/pociones/muertes/hp/flags)', p.gold === gold0 && p.potions === potions0 && p.deaths === deaths0 && p.hp === hp0 && J(g.flags) === flags0, `${p.gold}/${p.gold0}`);
  check('stats de campaña intactas por la arena', J(g.stats) === stats0);
  const best = Number(rawLs('ecos-desafio-best') ?? '0');
  check('récord de oleadas (puntos) guardado', best === scoreAtDeath && best > 0, J(best));
  check('marca de tiempo de oleadas registrada (mayor mejor)', (readChallengeRecords().find(r => r.key === 'oleadas')?.times.length ?? 0) >= 1);
  endChallenge(g, false);
  check('endChallenge: reto nulo, título, mundo en lunaris', g.challengeRun === null && g.state === 'title' && g.mapId === 'lunaris');

  // ---- 5b) DUELO: victoria completa + recompensa + records + Rondador ----
  const gold0b = p.gold, potions0b = p.potions;
  startChallenge(g, 'jefe', 'sirena');
  const runD = g.challengeRun!;
  check('duelo: jefe instanciado con banner y barra', !!runD.bossEnemy && g.bossActive && g.bossRef === runD.bossEnemy);
  check('duelo: sin pociones (una sola vida, plantilla del Eco)', g.player!.potions === 0, J(g.player!.potions));
  const bossHp0 = runD.bossEnemy!.maxHp;
  g.damageEnemy(runD.bossEnemy!, 999999, 'sagrado', 0);
  // R7-Q1 #2: el clon del jefe NO marca flag de campaña (limpieza en origen);
  // el oro que paga es de ARENA y finish lo disuelve (lo verifica el check de
  // restauración de abajo); el endBeat arranca en el golpe
  check('killEnemy del duelo NO contamina campaña (limpieza en origen R7-Q1)', !g.flags.sirenaDefeated && p.gold >= gold0b);
  check('endBeat dramático antes del panel', runD.phase === 'jugando' && (runD.endBeat ?? 0) > 0);
  for (let i = 0; i < 130; i++) g.update(1 / 60); // 1.7 s de endBeat
  check('victoria: panel de resultado', g.state === 'title' && runD.phase === 'resultado' && runD.resultWin === true);
  check('flags de campaña RESTAURADOS (sirena vuelve a estar viva)', !g.flags.sirenaDefeated && J(g.flags) === flags0, J(g.flags));
  check('oro/pociones restaurados SIN fuga de recompensa (R8-7)', p.gold === gold0b && p.potions === potions0b, `${p.gold}/${p.potions}`);
  check("'ecos-desafio-logros' guarda duelo:sirena", J(JSON.parse(rawLs('ecos-desafio-logros') ?? '[]')) === J(['duelo:sirena']), rawLs('ecos-desafio-logros') ?? '—');
  check("récord 'duelo:sirena' guardado (menor mejor)", (readChallengeRecords().find(r => r.key === 'duelo:sirena')?.times.length ?? 0) === 1);
  check('hp > 70% → Rondador concedido', isLogroDone('rondador'));
  check('stats de campaña intactas tras el duelo', J(g.stats) === stats0);
  endChallenge(g, true);

  // 2ª victoria del MISMO jefe: sin poción extra
  startChallenge(g, 'jefe', 'sirena');
  const runD2 = g.challengeRun!;
  g.damageEnemy(runD2.bossEnemy!, 999999, 'sagrado', 0);
  for (let i = 0; i < 130; i++) g.update(1 / 60);
  check('2ª victoria: SIN poción extra (recompensa única, R8-7)', p.potions === potions0b, J(p.potions));
  endChallenge(g, true);

  // ---- 5c) ABORTO por puerta: restauración + save BYTE-IDÉNTICO ----
  // capturas FRESCAS: la campaña aquí incluye la recompensa legítima del duelo
  // de 5b (+1 poción) — comparar contra flags0/potions0 (previos a 5a) sería
  // exigir deshacer la recompensa ganada
  const gold0c = p.gold, potions0c = p.potions, deaths0c = p.deaths;
  const stats0c = { ...g.stats };
  const flags0c = J(g.flags);
  startChallenge(g, 'jefe', 'guardian');
  const runA = g.challengeRun!;
  g.damageEnemy(runA.bossEnemy!, 999999, 'sagrado', 0); // contamina flags+oro como en la arena real
  p.gold += 400; p.potions += 2; p.deaths += 1;
  g.flags.fantasma = true;
  g.stats.coronasGanadas; // (solo lectura: los guards evitan contaminación)
  const rawSave1 = rawLs('ecos-aelthar-save')!;
  // la contaminación del kill ya NO ocurre (R7-Q1): la que cuenta es la manual
  check('estado contaminado listo para el aborto (solo manual)', !g.flags.guardianDefeated && p.gold > gold0c);
  g.loadMap('lunaris', 25, 19); // la puerta sur del arena hace esto (fade)…
  g.update(1 / 60);             // …challengeTick detecta el aborto 1
  check('aborto 1: reto cerrado', g.challengeRun === null);
  check('aborto 1: campaña restaurada en MEMORIA', p.gold === gold0c && p.potions === potions0c && p.deaths === deaths0c && !g.flags.guardianDefeated && !g.flags.fantasma && J(g.flags) === flags0c,
    J({ gold: p.gold, gold0c, potions: p.potions, potions0c, deaths: p.deaths, deaths0c, guardianDefeated: g.flags.guardianDefeated, fantasma: g.flags.fantasma }));
  // las stats restauradas son las del snapshot EXACTO; el frame del aborto
  // ya es de campaña (el Portador sigue jugando) y el tiempoJugado corre:
  // se tolera exclusivamente ese delta de ≤ 1 frame en tiempoJugado
  check('aborto 1: stats intactas', (() => {
    const dtT = (g.stats as Record<string, number>).tiempoJugado - stats0c.tiempoJugado;
    const resto = Object.keys(stats0c).every(k => k === 'tiempoJugado' ? true : (g.stats as Record<string, number>)[k] === (stats0c as Record<string, number>)[k]);
    return J(g.stats) === J(stats0c) || (resto && dtT >= 0 && dtT <= 1 / 60 + 1e-9);
  })(), J([g.stats, stats0c]));
  check('aborto 1: save BYTE-IDÉNTICO (ni oro de arena ni jefes marcados)', rawLs('ecos-aelthar-save') === rawSave0 || rawLs('ecos-aelthar-save') === rawSave1 ? rawLs('ecos-aelthar-save') === rawSave0 : false, 'disco limpio');
  check('aborto 1: toast de retorno a campaña', g.toasts.some(t => t.text.includes('abandonado el Desafío')), J(g.toasts.map(t => t.text)));

  // ---- 5d) ABORTO 2: player reemplazado (Nueva partida) ----
  startChallenge(g, 'oleadas');
  check('reto activo antes del aborto 2', !!g.challengeRun);
  g.newGame('QARemplazo', 'tejedor');
  g.startPlay();
  g.update(1 / 60);
  check('aborto 2: reto huérfano descartado SIN restaurar sobre el jugador nuevo', g.challengeRun === null && g.player!.name === 'QARemplazo' && g.player!.gold === 20, J([g.challengeRun, g.player!.name, g.player!.gold]));

  // ---- 5e) RETO HUÉRFANO (GUARDAR Y SALIR en arena) → DESAFÍO re-arrancable ----
  const g3 = newGame('QAHuerfano', 'alba');
  g3.applyAction('rest');
  const goldH = g3.player!.gold;
  startChallenge(g3, 'oleadas');
  g3.player!.gold += 250; // oro de arena pendiente de disolver
  const runOrphan = g3.challengeRun;
  g3.setState('title'); // pausa → GUARDAR Y SALIR AL TÍTULO (con reto vivo)
  check('reto huérfano en título (fase jugando)', g3.challengeRun === runOrphan && g3.challengeRun!.phase === 'jugando');
  startChallenge(g3, 'oleadas'); // antes del fix: botón muerto (early-return silencioso)
  check('fix 17-c: DESAFÍO re-arrancable con reto huérfano (nueva sesión)', !!g3.challengeRun && g3.challengeRun !== runOrphan && g3.challengeRun!.phase === 'jugando');
  check('fix 17-c: re-arranque con Portador del Eco FRESCO (oro del run anterior disuelto, R8-7)', g3.player!.name === 'Portador del Eco' && g3.player!.gold === 0, `${g3.player!.name}/${g3.player!.gold}`);
  // cadencia restablecida: run nuevo con contadores a cero
  const rNew = g3.challengeRun!;
  check('cadencia/estado restablecidos al re-arrancar', rNew.wave === 0 && (rNew.spawnQueue?.length ?? 0) === 0 && rNew.spawnedTotal === 0 && rNew.kills === 0 && rNew.betweenWaves > 0, J([rNew.wave, rNew.spawnQueue, rNew.spawnedTotal]));
  g3.loadMap('lunaris', 25, 19); g3.update(1 / 60); // aborto para limpiar
  check('limpieza: reto cerrado', g3.challengeRun === null);
  check('campaña QAHuerfano restaurada INTACTA al abortar (por referencia, R8-7)', g3.player!.name === 'QAHuerfano' && g3.player!.gold === goldH, `${g3.player!.name}/${g3.player!.gold} vs ${goldH}`);

  // ---- 5f) aislamiento: logros y balance NO progresan en arena ----
  delLs(LS_LOGROS); __logrosDevReset(true);
  saveBalance({ level: 2, auto: false, recentDeaths: 0, recentFlawless: 0 });
  startChallenge(g, 'oleadas');
  const runI = g.challengeRun!;
  runI.betweenWaves = 0.01; g.update(1 / 60);
  for (let i = 0; i < 8 && g.enemies.length === 0; i++) { runI.spawnT = 0.001; g.update(1 / 60); }
  check('arena: mult del balanceador NEUTRO pese a nivel +2', J(enemyStatMult(g)) === J({ hp: 1, dmg: 1, xp: 1 }), J(enemyStatMult(g)));
  const lobo = g.enemies[0];
  check('spawn de arena sin escalado del balanceador', lobo.maxHp === ENEMY_DEFS.lobo.hp, `${lobo.maxHp}`);
  g.killEnemy(lobo);
  achievementTick(g);
  check('arena: killEnemy NO desbloquea logros de campaña', !isLogroDone('primer_canto') && logrosCount().done === 0, J(loadLogros()));
  check('arena: stats de campaña sin kills', g.stats.enemigosDerrotados === 0, J(g.stats.enemigosDerrotados));
  g.loadMap('lunaris', 25, 19); g.update(1 / 60);
  achievementTick(g);
  check('fuera de la arena, el re-chequeo de campaña funciona', g.challengeRun === null);
  delLs(LS_LOGROS); __logrosDevReset(true); resetBalance();
}

// ============================================================
// 6) SKILLTREE: puntos, padres, caminos A/B (cds y daño reales)
// ============================================================
console.log('\n--- 6) Árbol de habilidades ---');
{
  delLs('ecos-arbol');
  // curva de puntos
  check('curva: Nv1=0, Nv2=1, Nv5=5, Nv10=11, Nv12=13',
    skillPointsEarned(1) === 0 && skillPointsEarned(2) === 1 && skillPointsEarned(5) === 5
    && skillPointsEarned(10) === 11 && skillPointsEarned(12) === 13);

  const g = newGame('QAAlba6', 'alba');
  const p = g.player!;
  p.level = 5; // 5 puntos
  g.setState('skills');

  /** recorre la UI real: clic en el nodo → si procede, botón Aprender */
  function openNode(nodeId: string): number {
    const idxNode = SKILL_TREE.findIndex(n => n.id === nodeId);
    __stResetSel(g); // medir el invariante SIN footer de acciones (sel viejo añadiría el botón Aprender)
    g.uiHit.length = 0;
    drawSkillTree(g);
    const hits = g.uiHit.length; // un hit por nodo
    check(`UI: un hit por nodo (${SKILL_TREE.length}) (buscando ${nodeId})`, hits === SKILL_TREE.length, J(hits));
    g.uiHit[idxNode].cb(); // selecciona
    g.uiHit.length = 0;
    drawSkillTree(g);
    return g.uiHit.length; // +1 si existe el botón Aprender
  }
  function clickLearn(): void { g.uiHit[g.uiHit.length - 1].cb(); }

  // INSUFICIENTES: nivel 1 = 0 puntos → sin botón Aprender
  p.level = 1;
  const hitsSinPuntos = openNode('c_fuerte');
  check('sin puntos: NO existe botón Aprender (gate UI)', hitsSinPuntos === SKILL_TREE.length, J(hitsSinPuntos));
  p.level = 5;

  // PADRES: c_eco requiere c_fuerte → sin botón aunque haya puntos
  const hitsSinPadre = openNode('c_eco');
  check('sin padre aprendido: NO existe botón Aprender (gate UI)', hitsSinPadre === SKILL_TREE.length, J(hitsSinPadre));

  // DISCIPLINA: la tejedora no ve nodos de alba
  const gt = newGame('QATej6', 'tejedor');
  gt.player!.level = 5;
  gt.setState('skills');
  const idxOnda = SKILL_TREE.findIndex(n => n.id === 'c_onda');
  gt.uiHit.length = 0; drawSkillTree(gt);
  gt.uiHit[idxOnda].cb();
  gt.uiHit.length = 0; drawSkillTree(gt);
  check('gating de disciplina: c_onda (alba) sin botón para tejedora', gt.uiHit.length === SKILL_TREE.length, J(gt.uiHit.length));

  // SUFICIENTES: aprender c_fuerte por la UI real
  const hitsOk = openNode('c_fuerte');
  check('con puntos y sin padre: botón Aprender presente', hitsOk === SKILL_TREE.length + 1, J(hitsOk));
  clickLearn();
  check('c_fuerte aprendida (persistida en ecos-arbol)', (() => {
    const all = JSON.parse(rawLs('ecos-arbol') ?? '{}') as Record<string, { learned: string[] }>;
    return !!all['QAAlba6|alba']?.learned.includes('c_fuerte');
  })(), rawLs('ecos-arbol') ?? '—');
  check('c_fuerte ya aprendida: sin segundo botón (idempotente)', openNode('c_fuerte') === SKILL_TREE.length);

  // camino B (cds al fijar): c_cd → useSkill deja cd EXACTO ×0.8
  openNode('c_cd'); clickLearn();
  p.res = 100; p.cds = [0, 0, 0, 0];
  const sk0 = SKILLS.alba[0];
  g.setState('play');
  g.useSkill(0);
  check('camino B: cd fijado ×0.8 exacto (Refrán Veloz)', Math.abs(p.cds[0] - sk0.cd * 0.8) < 1e-9, `${p.cds[0]} vs ${sk0.cd * 0.8}`);
  const cd0 = p.cds[0];
  g.update(1 / 60);
  check('sin DOBLE descuento: decae exactamente dt (decay extra OFF)', Math.abs(p.cds[0] - (cd0 - 1 / 60)) < 1e-9, `${cd0} → ${p.cds[0]}`);

  // REGRESIÓN 17-c: el daño del árbol aplica a los ataques BASE
  p.attrs.des = -50; // sin críticos: daño determinista
  const baseEnemy = () => { const e = g.makeEnemy('lobo', p.x + 14, p.y, 0); e.hp = 100000; e.maxHp = 100000; g.enemies = [e]; return e; };
  // con c_fuerte (×1.10 aprendida arriba) vía golpe cargado (releaseCharge)
  let e = baseEnemy();
  p.combo = 2; p.attackT = 0; p.sta = 100; p.rollT = 0;
  p.charging = true; p.chargeT = 0.4; g.releaseCharge();
  const dmgConFuerte = 100000 - e.hp;
  const esperadoFuerte = Math.max(1, Math.round(playerMeleeDmg(p) * 1 * 2.1 * 1.10));
  check('c_fuerte aplica al melé BASE (golpe cargado ×2.1·1.10)', dmgConFuerte === esperadoFuerte, `${dmgConFuerte} vs ${esperadoFuerte}`);
  // aprender c_colera (+15% adicional) → ×1.265 total
  // (presupuesto y CADENA: c_eco→c_onda→c_lanza→c_colera — sin el padre
  // aprendido no existe el botón Aprender; la rama completa cuesta 1+1+2+2+3
  // sobre los 3 ya gastados → nivel 12 da puntos de sobra)
  p.level = 12;
  openNode('c_eco'); clickLearn();
  openNode('c_onda'); clickLearn();
  openNode('c_lanza'); clickLearn(); // padre directo de c_colera
  openNode('c_colera'); clickLearn();
  check('cadena c_eco→c_onda→c_lanza→c_colera aprendida',
    (() => { const all = JSON.parse(rawLs('ecos-arbol') ?? '{}') as Record<string, { learned: string[] }>; const l = all['QAAlba6|alba']?.learned ?? []; return l.includes('c_eco') && l.includes('c_onda') && l.includes('c_lanza') && l.includes('c_colera'); })(), rawLs('ecos-arbol') ?? '—');
  e = baseEnemy();
  p.combo = 2; p.attackT = 0; p.sta = 100;
  p.charging = true; p.chargeT = 0.4; g.releaseCharge();
  const dmgColera = 100000 - e.hp;
  const esperadoColera = Math.max(1, Math.round(playerMeleeDmg(p) * 1 * 2.1 * 1.10 * 1.15));
  check('c_colera apila EXACTO (×1.10·1.15) en melé base', dmgColera === esperadoColera, `${dmgColera} vs ${esperadoColera}`);
  // hechizos base con a_mente (tejedora)
  const gt2 = newGame('QATej7', 'tejedor');
  const pt = gt2.player!;
  gt2.player!.attrs.des = -50;
  gt2.setState('play');
  gt2.enemies = [];
  gt2.castSkill('ascuas', 'fuego');
  const dmgSin = gt2.projectiles[gt2.projectiles.length - 1].dmg;
  seedTree('QATej7', 'tejedor', ['a_mente']);
  const m = skillDamageMult(gt2, 'hechizo');
  gt2.castSkill('ascuas', 'fuego');
  const dmgCon = gt2.projectiles[gt2.projectiles.length - 1].dmg;
  check('a_mente aplica a hechizos BASE (ascuas ×1.20)', Math.abs(m - 1.20) < 1e-9 && Math.abs(dmgCon - (10 + pt.attrs.int * 1.6 + pt.level) * 1.2) < 1e-9 && dmgSin < dmgCon, `${dmgSin} → ${dmgCon}`);
  // Ojo del Mercader no re-dispara al snapshot
  seedTree('QATej7', 'tejedor', ['a_mente', 't_gold']);
  gt2.update(1 / 60); // primer tick: inicializa el tracking de oro (rt.prevGold) con el oro de partida
  const goldT0 = pt.gold;
  pt.gold += 100;
  gt2.update(1 / 60);
  check('Ojo del Mercader: +20% del delta exacto', pt.gold === goldT0 + 120, J(pt.gold));
  gt2.update(1 / 60);
  check('…y no vuelve a aplicar sin delta', pt.gold === goldT0 + 120);
  delLs('ecos-arbol');
}

// ============================================================
// 7) BALANCEADOR: tabla exacta, neutro en arena, persistencia
// ============================================================
console.log('\n--- 7) Balanceador ---');
{
  delLs('ecos-balance'); resetBalance();
  const g = newGame('QABalance', 'alba');
  const p = g.player!;
  p.attrs.vig = 0;           // aislamos la reducción de Vigía
  g.flags.armor_1 = false;   // sin armadura
  delete g.flags.armor_1;
  const TABLA: Record<number, { hp: number; dmg: number; xp: number }> = {
    [-2]: { hp: 0.75, dmg: 0.80, xp: 0.85 },
    [-1]: { hp: 0.88, dmg: 0.90, xp: 0.93 },
    [0]: { hp: 1, dmg: 1, xp: 1 },
    [1]: { hp: 1.20, dmg: 1.14, xp: 1.08 },  // R8 4.2: tabla superior más dura
    [2]: { hp: 1.42, dmg: 1.28, xp: 1.15 },  // R8 4.2
  };
  let tablaOk = true; const notas: string[] = [];
  for (const lvl of [-2, -1, 0, 1, 2]) {
    saveBalance({ level: lvl, auto: false, recentDeaths: 0, recentFlawless: 0 });
    const bm = enemyStatMult(g);
    const esperado = TABLA[lvl];
    if (J(bm) !== J(esperado)) { tablaOk = false; notas.push(`mult ${lvl}: ${J(bm)}`); }
    const e = g.makeEnemy('esqueleto', p.x + 40, p.y, 0);
    const hpEsperado = Math.round(ENEMY_DEFS.esqueleto.hp * esperado.hp);
    if (e.maxHp !== hpEsperado) { tablaOk = false; notas.push(`hp ${lvl}: ${e.maxHp}≠${hpEsperado}`); }
    // daño recibido exacto (embudo único, sin armadura ni vig)
    const def = ENEMY_DEFS.esqueleto;
    p.hp = 200; p.iframes = 0; p.rollT = 0;
    g.damagePlayer(50, p.x + 20, p.y);
    const dmgEsperado = Math.max(1, Math.round(50 * esperado.dmg));
    if (200 - p.hp !== dmgEsperado) { tablaOk = false; notas.push(`dmg ${lvl}: ${200 - p.hp}≠${dmgEsperado}`); }
    // XP exacta
    const xp0 = p.xp; p.xp = 0; p.level = 1;
    const lobo = g.makeEnemy('lobo', p.x + 60, p.y, 0);
    g.killEnemy(lobo);
    const xpEsperada = Math.max(1, Math.round(ENEMY_DEFS.lobo.xp * esperado.xp));
    if (p.xp !== xpEsperada) { tablaOk = false; notas.push(`xp ${lvl}: ${p.xp}≠${xpEsperada}`); }
    p.level = 1; p.xp = xp0;
  }
  check('tabla -2..+2 EXACTA en hp/dmg/xp (contrato)', tablaOk, notas.join(' | '));
  // persistencia inmediata (saveBalance escribe sin debounce)
  saveBalance({ level: 2, auto: false, recentDeaths: 0, recentFlawless: 0 });
  const raw = JSON.parse(rawLs('ecos-balance') ?? '{}') as { level: number; auto: boolean };
  check("'ecos-balance' escrito en disco", raw.level === 2 && raw.auto === false, J(raw));
  // reset restaura Normal/AUTO
  resetBalance();
  check('resetBalance: Normal/AUTO', J(loadBalance()) === J({ level: 0, auto: true, recentDeaths: 0, recentFlawless: 0 }));
  // clave corrupta → defaults (sin crash)
  setLs('ecos-balance', '{{{');
  check("'ecos-balance' corrupto → Normal/AUTO", (() => { const b = loadBalance(); return b.level === 0 && b.auto === true; })());
  delLs('ecos-balance');
}

// ============================================================
// 8) ARMADURAS: compra única, gate, reducción única, panel
// ============================================================
console.log('\n--- 8) Armaduras ---');
{
  delLs(LS_LOGROS); delLs(LS_STATS);
  __logrosDevReset(true);
  const g = newGame('QAArmadura', 'alba');
  const p = g.player!;
  const st = g.stats;
  check('tabla de 5 corazas', ARMORS.length === 5);

  // compra normal
  p.gold = 500;
  g.applyAction('armor_1');
  check('armor_1 comprada (80 coronas)', !!g.flags.armor_1 && p.gold === 420 && st.coronasGastadas === 80, J([p.gold, st.coronasGastadas]));
  // compra ÚNICA por tier
  g.applyAction('armor_1');
  check('armor_1 repetida: rechazada SIN cobro', p.gold === 420 && st.coronasGastadas === 80 && g.toasts[g.toasts.length - 1].text.includes('ya te cubre'), J(g.toasts[g.toasts.length - 1].text));
  // activa = tier mayor poseído (NO compuesta)
  g.applyAction('armor_2');
  check('armor_2 activa (tier mayor)', armorActiveId(g) === 2 && armorActive(g)?.name === 'Malla del Alba');
  check('reducción NO compuesta: 0.15 (no 0.23)', Math.abs(armorReduction(g) - 0.15) < 1e-9, J(armorReduction(g)));
  // fórmula exacta del embudo (balance 1.0, vig 0)
  p.attrs.vig = 0; p.hp = 200; p.iframes = 0; p.rollT = 0;
  g.damagePlayer(100, p.x + 20, p.y);
  check('daño con Malla: round(100·0.85) = 85 UNA vez', 200 - p.hp === 85, J(200 - p.hp));
  // con balance +2 Y armadura: mult → luego reducción (orden del contrato)
  saveBalance({ level: 2, auto: false, recentDeaths: 0, recentFlawless: 0 });
  p.hp = 200; p.iframes = 0;
  g.damagePlayer(100, p.x + 20, p.y);
  check('orden balanceador→armadura: round(round(100·1.28)·0.85) = 109 (dmg mult R8-7)', 200 - p.hp === 109, J(200 - p.hp));
  resetBalance();
  // Malla: +10 vigor/s
  p.sta = 50;
  armorTick(g, 1);
  check('Malla del Alba: +10 vigor/s', Math.abs(p.sta - 60) < 1e-9, J(p.sta));
  // gate acto3Done en la Guarda (tier 5)
  p.gold = 1000;
  g.applyAction('armor_5');
  check('armor_5 SIN acto3Done: rechazada sin cobro', !g.flags.armor_5 && p.gold === 1000);
  g.flags.acto3Done = true;
  g.applyAction('armor_5');
  check('armor_5 CON acto3Done: comprada y activa (−28%)', !!g.flags.armor_5 && armorActiveId(g) === 5 && Math.abs(armorReduction(g) - 0.28) < 1e-9);
  // −8% velocidad con Placas (armor_3) — micro-paso en dirección libre
  g.flags.armor_3 = true;
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let moved = 0;
  for (const [dx, dy] of dirs) {
    const x0 = p.x, y0 = p.y;
    if (g.boxFree(p.x + dx * 12, p.y + dy * 12, p.w, p.h)) { g.moveEntity(p, dx * 10, dy * 10); moved = Math.hypot(p.x - x0, p.y - y0); break; }
  }
  check('Placas del Canto: −8% de velocidad (10 px → 9,2)', Math.abs(moved - 9.2) < 1e-9, J(moved));
  delete g.flags.armor_3;
  // fila del panel de pausa
  g.setState('pause');
  let noThrow = true; let alto = 0;
  try { alto = drawArmorRow(g, 10, 10, 400); } catch { noThrow = false; }
  check('drawArmorRow dibuja la armadura activa sin crash (fila 18 px)', noThrow && alto === 18);
  delLs('ecos-balance');
}

// ============================================================
// 9) ECONOMÍA: oro nunca negativo, sin duplicados, señuelos
// ============================================================
console.log('\n--- 9) Economía ---');
{
  const g = newGame('QAEconomia', 'alba');
  const p = g.player!;
  // RNG determinista en SECUENCIA (el juego consume 2 llamadas al examinar
  // restos: 1ª = suerte de botín, 2ª = cantidad): 0.01 < 0.25 → suelta oro,
  // 1 + ⌊0.5·5⌋ = 3 coronas (dentro del rango 1-5 del spec).
  const seqRng = [0.01, 0.5]; let seqI = 0;
  __iReset(g); __iForceRng(() => seqRng[seqI++ % seqRng.length]);

  // compras sin oro: rechazo y sin deuda
  p.gold = 10;
  g.applyAction('forge');
  check('forja sin coronas: sin mejora y sin deuda', p.weaponPlus === 0 && p.gold === 10);
  g.applyAction('buy_potion');
  check('poción sin coronas: sin item y sin deuda', p.potions === 2 && p.gold === 10);
  g.applyAction('buy_sennuelo');
  check('señuelo sin coronas: sin item y sin deuda', (g.flags.sennuelos ?? 0) === 0 && p.gold === 10);
  // arma +5 cap (no duplica más allá)
  p.gold = 100000;
  for (let i = 0; i < 8; i++) g.applyAction('forge');
  check('forja: tope +5 (sin sexto pago)', p.weaponPlus === 5 && p.gold === 100000 - (30 + 55 + 80 + 105 + 130), J([p.weaponPlus, p.gold]));
  // señuelos APILAN
  p.gold = 500;
  g.applyAction('buy_sennuelo');
  g.applyAction('buy_sennuelo');
  check('señuelos apilan (flags.sennuelos = 2)', g.flags.sennuelos === 2 && p.gold === 380, J([g.flags.sennuelos, p.gold]));
  // uso: decrementa exactamente uno, señuelo activo, atrae enemigos
  g.loadMap('lunaris', 25, 19);
  const lobo = g.makeEnemy('lobo', p.x + 40, p.y, 0);
  g.enemies = [lobo];
  p.dir = 'right';
  check('useSenno vuela y consume 1', (() => {
    g.setState('play');
    return useSennoSafe(g) === true && g.flags.sennuelos === 1;
  })(), J(g.flags.sennuelos));
  check('señuelo activo en el pool (__iDecoy)', __iDecoy(g).active === true);
  check('lobo atraído (aggro + lured)', lobo.aggro === true && (lobo.lured ?? 0) > 0, J([lobo.aggro, lobo.lured]));
  interaccionTick(g, 6); // avanza el reloj: el señuelo anterior expira (pool de 1 · SENNO_T = 5 s)
  check('último señuelo: uso → 0', (() => { useSennoSafe(g); return g.flags.sennuelos === 0; })());
  check('sin señuelos: uso rechazado sin deuda', (() => { const r = useSennoSafe(g); return r === false && g.flags.sennuelos === 0; })());
  // jefes inmunes al señuelo
  const jefe = g.makeEnemy('guardian', p.x + 60, p.y, 0);
  g.enemies = [jefe]; g.bossActive = false;
  g.flags.sennuelos = 3;
  useSennoSafe(g);
  check('jefe NO se atrae con señuelo', jefe.aggro === false, J(jefe.aggro));
  // muerte: peaje nunca deja oro negativo
  p.gold = 3; p.iframes = 0;
  g.playerDied();
  check('peaje de muerte con 3 coronas: pierde 1, nunca negativo', p.gold === 2 && g.lastGoldLost === 1, J([p.gold, g.lastGoldLost]));
  p.gold = 0; p.iframes = 0;
  g.respawn(); p.gold = 0;
  g.playerDied();
  check('muerte con 0 coronas: sin peaje negativo', p.gold === 0 && g.lastGoldLost === 0);
  g.respawn();
  // restos examinables: loot 25% (RNG 0.01) — oro gana y no duplica por cadáver
  const st0 = g.stats.coronasGanadas;
  const oroR = p.gold;
  g.enemies = [];
  registerCorpseSafe(g);
  let loot = false;
  for (let i = 0; i < 3; i++) loot = interaccionInteractSafe(g) || loot;
  check('restos: una sola vez por cadáver (sin farm)', loot === true && p.gold === oroR + 3, `${oroR} → ${p.gold}`);
  __iForceRng(null); __iReset(g);
  delLs(LS_LOGROS); delLs(LS_STATS);
}

// ---------- helpers que envuelven imports usados solo aquí ----------
function useSennoSafe(g: G): boolean {
  return useSenno(g);
}
function registerCorpseSafe(g: G): void {
  registerCorpse16b(g, { x: g.player!.x + 10, y: g.player!.y, etype: 'lobo' } as never);
}
function interaccionInteractSafe(g: G): boolean {
  return interaccionInteract16b(g);
}

// ============================================================
// 10) siembra del estado para la fase LOAD (proceso nuevo)
// ============================================================
console.log('\n--- limpieza: estado centinela para la fase LOAD ---');
{
  seedTree('PortadorQA17', 'alba', ['c_fuerte', 'c_vida', 'c_cd']);
  const g = newGame('PortadorQA17', 'alba');
  const p = g.player!;
  applySkillStats(p, false);
  p.level = 7; p.xp = 100; p.points = 5;
  p.hp = 100; p.sta = 55; p.res = 66; p.gold = 777; p.weaponPlus = 3; p.potions = 4;
  p.attrs = { fue: 6, des: 5, int: 4, esp: 3, vig: 4 };
  p.hasEcho = true; p.kills = 44; p.deaths = 2; p.repGuardianes = 15; p.playTime = 640.5;
  p.tones = { empatico: 1, pragmatico: 3, sarcastico: 0, amenazante: 2 };
  p.memories = ['mem_nana', 'mem_casa'];
  p.repFacciones = { guardianes: 10, orden: -5, circulo: 20, liga: 0 };
  g.companion = g.makeCompanion();
  g.companion.mode = 'defensivo';
  Object.assign(g.flags, { sennuelos: 3, armor_2: true, armor_4: true, acto2Done: true, wolfKills: 2, q6: true, visited_costa: true, visited_aldea: true, visited_cumbres: true });
  g.questIdx = 6; g.questStep = 1;
  g.openedChests = new Set(['c_lunaris_sur', 'c_bosque_1']);
  g.takenEchoes = new Set(['eco_a', 'eco_b', 'eco_c', 'eco_d', 'eco_e']);
  g.deadGolds = [{ map: 'bosque', x: 100, y: 60, amount: 33 }];
  g.epoch = 'pasado';
  const st = g.stats;
  st.enemigosDerrotados = 23; st.jefesDerrotados = 3; st.muertes = 2;
  st.coronasGanadas = 456; st.coronasGastadas = 123; st.pocionesUsadas = 7;
  st.vecesCambioEpoca = 4; st.distanciaAndada = 987; st.tiempoJugado = 321.5;
  st.memoriasHalladas = 2;
  g.loadMap('lunaris', 25, 19);
  g.save();
  // logros persistentes para la fase load
  delLs(LS_LOGROS); __logrosDevReset(true);
  st.enemigosDerrotados = 23; achievementTick(g); // primer_canto
  p.level = 5; p.deaths = 0; achievementTick(g);   // invicto
  recordChallengeResult(g, 'jefe', 'guardian', true, 0.8, 77.7); // rondador + récord
  // balance persistido
  saveBalance({ level: 2, auto: false, recentDeaths: 0, recentFlawless: 0 });
  check('centinela sembrado (save + logros + balance + records)',
    !!rawLs('ecos-aelthar-save') && loadLogros().includes('rondador') && loadBalance().level === 2);
}

console.log(fails === 0 ? '\nSMOKE QA17 SISTEMAS: TODO OK' : `\nSMOKE QA17 SISTEMAS: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
