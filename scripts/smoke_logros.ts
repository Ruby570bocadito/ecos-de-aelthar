// ============================================================
// SMOKE 16-c (bun, sin navegador): ESTADÍSTICAS + LOGROS + MARCAS.
// Stub DOM/Audio (patrón scripts/smoke_desafio.ts) + Game real:
//  1) desbloqueo ÚNICO de logros (dos ticks no duplican),
//  2) stats acumuladas por los puntos instrumentados (killEnemy, muerte,
//     poción, época, forja/tienda, movimiento) + save() con stats y espejo,
//  3) tolerancia a JSON corrupto en las 4 claves (sin crash, defaults),
//  4) marcas del desafío (top 3) + logro Rondador vía recordChallengeResult,
//  5) paneles del título dibujados sin excepciones (con y sin save).
// Ejecutar:  bun scripts/smoke_logros.ts            (sesión principal)
//            bun scripts/smoke_logros.ts load       (recarga en proceso nuevo)
// localStorage respaldado en /tmp para verificar persistencia entre procesos.
// ============================================================

import { readFileSync, writeFileSync } from 'fs';

// ---------- stub universal (igual que smoke_desafio.ts) ----------
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

// ---------- localStorage respaldado en /tmp (persiste entre procesos) ----------
const LS_FILE = '/tmp/ecos-logros-smoke.json';
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
const { audio } = await import('../src/game/audio');
(audio as unknown as { init: () => void; ctx: unknown }).init = () => {};
(audio as unknown as { ctx: unknown }).ctx = stub();

const {
  achievementTick, statsTick, loadLogros, logrosCount, isLogroDone, logroName,
  recordChallengeResult, readChallengeRecords, readLastSave, readStatsMirror,
  defaultStats, sanitizeStats, drawTitlePanels, openStatsPanel, openLogrosPanel,
  closeTitlePanels, __logrosDevReset, LOGROS, LS_LOGROS, LS_STATS,
} = await import('../src/game/achievements');

let fails = 0;
const bad = (m: string, extra = '') => { console.log(`  ✗ ${m}${extra ? ' — ' + extra : ''}`); fails++; };
const ok = (m: string, extra = '') => console.log(`  ✓ ${m}${extra ? ' — ' + extra : ''}`);
function check(nombre: string, cond: boolean, extra = ''): void {
  if (cond) ok(nombre, extra); else bad(nombre, extra);
}
const rawLs = (k: string): string | null => lsRead()[k] ?? null;

// ---------- fase 'load': proceso NUEVO, estado recargado de localStorage ----------
const modo = process.argv[2];
if (modo === 'load') {
  console.log('=== SMOKE LOGROS · fase LOAD (proceso nuevo, lee /tmp) ===');
  const done = loadLogros();
  check('persistencia: logros recargados de localStorage', done.includes('rondador') && done.includes('primer_canto'), JSON.stringify(done));
  const cnt = logrosCount();
  check('contador X/Y coherente tras recargar', cnt.total === 12 && cnt.done === done.length, `${cnt.done}/${cnt.total}`);
  const recs = readChallengeRecords();
  const gRec = recs.find(r => r.key === 'duelo:guardian');
  const oRec = recs.find(r => r.key === 'oleadas');
  check('top 3 duelos persiste ordenado (menor mejor)', !!gRec && gRec.times.length === 3 && gRec.times[0] === 60 && gRec.times[2] === 95, JSON.stringify(gRec));
  check('top 3 oleadas persiste ordenado (mayor mejor)', !!oRec && oRec.times.length === 2 && oRec.times[0] === 150 && oRec.times[1] === 100, JSON.stringify(oRec));
  const s = readLastSave();
  check('readLastSave: cifras del último guardado', !!s && s.name === 'Humo' && s.stats.enemigosDerrotados === 2 && s.stats.jefesDerrotados === 1, JSON.stringify(s?.stats));
  const mir = readStatsMirror();
  check("espejo 'ecos-stats' persiste", mir.enemigosDerrotados === 2 && mir.muertes === 1 && mir.pocionesUsadas === 1, JSON.stringify(mir));
  check("logro del Acto IV con nombre 'próximamente' (no existe flag)", logroName('ultima_nota') === 'El Último Canto (próximamente)', logroName('ultima_nota'));
  console.log(fails === 0 ? 'SMOKE LOGROS LOAD: TODO OK' : `SMOKE LOGROS LOAD: ${fails} FALLOS`);
  process.exit(fails === 0 ? 0 : 1);
}

// ---------- sesión principal ----------
console.log('=== SMOKE LOGROS · sesión principal ===');

// arranque limpio de las claves del smoke
for (const k of [LS_LOGROS, LS_STATS, 'ecos-desafio-récords', 'ecos-aelthar-save', 'ecos-desafio-best']) {
  (globalThis as AnyP).localStorage.removeItem(k);
}
__logrosDevReset(true); // recarga desde localStorage (ahora vacío)

function newGame(): InstanceType<typeof Game> {
  const g = new Game(makeCanvas());
  g.newGame('Humo', 'alba');
  g.startPlay();
  return g;
}

// ================= 1) desbloqueo ÚNICO (idempotencia) =================
console.log('--- 1) Desbloqueo único (dos ticks no duplican) ---');
{
  const g = newGame();
  const p = g.player!;
  check('partida recién empezada: 0/12 logros', logrosCount().done === 0, JSON.stringify(logrosCount()));
  check('estado inicial de stats a cero', JSON.stringify(g.stats) === JSON.stringify(defaultStats()));
  achievementTick(g);
  check('tick sin condiciones: nada desbloqueado', logrosCount().done === 0);
  p.level = 5; // Invicto: Nv 5 con deaths 0
  achievementTick(g);
  check('Nv 5 sin morir → Invicto', isLogroDone('invicto'));
  check('toast dorado único', g.toasts.length === 1 && g.toasts[0].text === '¡Logro: Invicto!' && g.toasts[0].color === '#f0c84a', g.toasts.map(t => t.text).join('|'));
  achievementTick(g);
  achievementTick(g);
  check('dos ticks más: NO duplican ni toast ni registro', logrosCount().done === 1 && g.toasts.length === 1);
  const ls = JSON.parse(rawLs(LS_LOGROS) ?? '{}') as { done: string[] };
  check("'ecos-logros' persiste Invicto una sola vez", ls.done.length === 1 && ls.done[0] === 'invicto', rawLs(LS_LOGROS) ?? '—');
  (g as unknown as { __smoke?: boolean }).__smoke = true; // conserva referencia viva
}

// ================= 2) stats acumuladas + save con stats =================
console.log('--- 2) Stats acumuladas (kill/muerte/poción/época/forja/movimiento) ---');
{
  const g = newGame();
  const p = g.player!;
  const st = g.stats;

  // killEnemy: enemigo normal
  g.killEnemy(g.makeEnemy('lobo', p.x + 60, p.y, 0));
  check('killEnemy → enemigosDerrotados 1', st.enemigosDerrotados === 1);
  check('killEnemy → coronasGanadas > 0', st.coronasGanadas > 0, String(st.coronasGanadas));
  check('killEnemy dispara chequeo puntual → Primer Canto', isLogroDone('primer_canto'));

  // killEnemy: jefe (cuenta por BOSS_DEFEAT_FLAG)
  g.killEnemy(g.makeEnemy('guardian', p.x + 60, p.y, 0));
  check('killEnemy jefe → jefesDerrotados 1', st.jefesDerrotados === 1);
  check('flag de jefe de campaña fijada', !!g.flags.guardianDefeated);

  // poción
  p.hp = 10;
  g.drinkPotion();
  check('drinkPotion → pocionesUsadas 1', st.pocionesUsadas === 1);

  // muerte del jugador
  g.playerDied();
  check('playerDied → muertes 1', st.muertes === 1 && g.state === 'dead');
  g.respawn();
  check('respawn vuelve a play', g.state === 'play');

  // movimiento (moveEntity: única puerta del movimiento)
  const d0 = st.distanciaAndada;
  g.moveEntity(p, 4, 3);
  check('moveEntity del jugador suma distancia', st.distanciaAndada > d0, `${d0} → ${st.distanciaAndada}`);
  const dEnemy0 = st.distanciaAndada;
  g.moveEntity(g.enemies[0] ?? ({ x: 0, y: 0, w: 1, h: 1 } as never), 50, 50);
  check('moveEntity de un ENEMIGO no suma', st.distanciaAndada === dEnemy0);

  // cambio de época (tras el veto de 13-c: sin enemigos con aggro)
  g.enemies = [];
  p.hasEcho = true;
  g.epochSwitch();
  check('epochSwitch → vecesCambioEpoca 1', st.vecesCambioEpoca === 1, String(st.vecesCambioEpoca));

  // pagos: forja y tienda
  p.gold = 500;
  g.applyAction('forge');
  check('forja pagada → coronasGastadas 30', st.coronasGastadas === 30 && p.weaponPlus === 1, String(st.coronasGastadas));
  g.applyAction('buy_potion');
  check('poción comprada → coronasGastadas 45', st.coronasGastadas === 45);

  // botín de misión (grantQuestLoot)
  g.grantQuestLoot(5);
  check('grantQuestLoot → coronasGanadas suma el botín', st.coronasGanadas > 0);

  // ticks directos: tiempoJugado y memorias
  p.memories = ['mem_nana', 'mem_casa'];
  statsTick(g, 1.5);
  check('statsTick: tiempoJugado + memoriasHalladas', Math.abs(st.tiempoJugado - 1.5) < 1e-9 && st.memoriasHalladas === 2);

  // save(): stats dentro del guardado + espejo 'ecos-stats'
  g.save();
  const saved = JSON.parse(rawLs('ecos-aelthar-save') ?? '{}') as { stats?: Record<string, number> };
  check('save() serializa stats (2 kills: lobo + jefe)', saved.stats?.enemigosDerrotados === 2 && saved.stats?.jefesDerrotados === 1 && saved.stats?.muertes === 1 && saved.stats?.pocionesUsadas === 1, JSON.stringify(saved.stats));
  const mirror = JSON.parse(rawLs(LS_STATS) ?? '{}') as Record<string, number>;
  check("espejo 'ecos-stats' escrito", mirror.enemigosDerrotados === 2 && mirror.coronasGastadas === 45, JSON.stringify(mirror));

  // continueGame restaura stats con defaults seguros
  g.setState('title');
  g.continueGame();
  check('continueGame restaura stats del guardado', g.stats.enemigosDerrotados === 2 && g.stats.coronasGastadas === 45 && g.stats.jefesDerrotados === 1, JSON.stringify(g.stats));

  // sanitizeStats tolerante (saves antiguos sin stats)
  const viejo = sanitizeStats(undefined);
  check('sanitizeStats(undefined) → defaults', JSON.stringify(viejo) === JSON.stringify(defaultStats()));
  const raro = sanitizeStats({ enemigosDerrotados: 3, muertes: 'x', oro: -5 });
  check('sanitizeStats mezcla válidos/inválidos', raro.enemigosDerrotados === 3 && raro.muertes === 0 && raro.oro === undefined, JSON.stringify(raro));
}

// ================= 3) tolerancia a JSON corrupto =================
console.log('--- 3) Tolerancia a JSON corrupto (sin crash, defaults) ---');
{
  const g = newGame();

  localStorage.setItem(LS_LOGROS, 'esto-no-es-json{{{');
  __logrosDevReset(true);
  check("'ecos-logros' corrupto → 0 logros sin lanzar", logrosCount().done === 0 && loadLogros().length === 0);
  g.player!.level = 5; // condición real (Nv 5, deaths 0) para el re-desbloqueo
  achievementTick(g); // con el set vacío vuelve a desbloquear sin romperse
  check('tick tras corrupto re-desbloquea y persiste JSON válido', logrosCount().done >= 1 && rawLs(LS_LOGROS)!.startsWith('{'), rawLs(LS_LOGROS) ?? '—');

  localStorage.setItem(LS_LOGROS, JSON.stringify({ foo: 1, done: 'no-soy-array' }));
  __logrosDevReset(true);
  check('forma inválida de ecos-logros → 0 sin lanzar', logrosCount().done === 0);

  localStorage.setItem('ecos-desafio-récords', '(((basura');
  check("'ecos-desafio-récords' corrupto → lista vacía", readChallengeRecords().length === 0);

  localStorage.setItem(LS_STATS, 'no-json');
  const mir = readStatsMirror();
  check("'ecos-stats' corrupto → defaults", mir.enemigosDerrotados === 0 && mir.tiempoJugado === 0);

  localStorage.setItem('ecos-aelthar-save', '###corrupto');
  check('save corrupto → readLastSave null', readLastSave() === null);
  let noThrow = true;
  try { g.setState('title'); g.continueGame(); } catch { noThrow = false; }
  check('continueGame con save corrupto no lanza', noThrow && g.state === 'title');

  localStorage.setItem(LS_LOGROS, JSON.stringify({ v: 1, done: ['invicto', 'no_existe', 42] }));
  __logrosDevReset(true);
  check('carga filtra ids desconocidos y tipos raros', logrosCount().done === 1 && isLogroDone('invicto'));
}

// ================= 4) marcas del desafío + Rondador =================
console.log('--- 4) recordChallengeResult: top 3 tiempos + Rondador ---');
{
  const g = newGame();
  g.killEnemy(g.makeEnemy('lobo', g.player!.x + 60, g.player!.y, 0)); // condición de campaña para el re-chequeo final
  const toasts0 = g.toasts.length; // tras el kill ya cayó el toast de Primer Canto

  recordChallengeResult(g, 'jefe', 'guardian', true, 0.8, 95);
  check('victoria con 80% de vida → Rondador', isLogroDone('rondador'));
  check('toast de Rondador emitido', g.toasts.length === toasts0 + 1 && g.toasts[g.toasts.length - 1].text === '¡Logro: Rondador!');
  let recs = readChallengeRecords();
  check('marca de duelo guardada', recs.find(r => r.key === 'duelo:guardian')?.times[0] === 95, JSON.stringify(recs));

  // más marcas: orden menor-mejor y recorte a 3
  recordChallengeResult(g, 'jefe', 'guardian', true, 0.9, 80);
  recordChallengeResult(g, 'jefe', 'guardian', true, 0.9, 120);
  recordChallengeResult(g, 'jefe', 'guardian', true, 0.9, 60); // 120 debe caer del top 3
  recs = readChallengeRecords();
  const gt = recs.find(r => r.key === 'duelo:guardian')!.times;
  check('top 3 duelos ordenado (60/80/95) y recortado', JSON.stringify(gt) === '[60,80,95]', JSON.stringify(gt));

  // Rondador NO se concede con vida ≤ 70%
  const nRondador = loadLogros().length;
  recordChallengeResult(g, 'jefe', 'sirena', true, 0.5, 200);
  check('victoria con 50% de vida → sin Rondador extra', loadLogros().length === nRondador);
  check('marca de la Sirena guardada', readChallengeRecords().find(r => r.key === 'duelo:sirena')?.times[0] === 200);

  // oleadas: se registra la supervivencia (mayor mejor) al completar el reto
  recordChallengeResult(g, 'oleadas', undefined, false, 0, 150);
  recordChallengeResult(g, 'oleadas', undefined, false, 0, 100);
  const ot = readChallengeRecords().find(r => r.key === 'oleadas')!.times;
  check('oleadas: tiempos ordenados mayor-mejor', JSON.stringify(ot) === '[150,100]', JSON.stringify(ot));

  // despues de todo, re-chequeo de campaña: primer_canto sigue disponible
  achievementTick(g);
  check('achievementTick tras la arena re-desbloquea campaña', isLogroDone('primer_canto'));
  check('killEnemy de arena NO duplica el toast de Primer Canto', g.toasts.filter(t => t.text === '¡Logro: Primer Canto!').length === 1, JSON.stringify(g.toasts.map(t => t.text)));
}

// ================= 5) paneles del título sin excepciones =================
console.log('--- 5) Paneles ESTADÍSTICAS / LOGROS (con y sin save) ---');
{
  const g = newGame();
  const p = g.player!;
  p.memories = ['mem_nana'];
  g.save(); // deja un save válido con stats para el panel
  g.setState('title');
  g.toasts.length = 0;

  openStatsPanel();
  g.uiHit.length = 0;
  drawTitlePanels(g);
  check('panel ESTADÍSTICAS dibuja sin lanzar y registra botones', g.uiHit.length >= 1, `hits=${g.uiHit.length}`);

  openLogrosPanel();
  g.uiHit.length = 0;
  drawTitlePanels(g);
  check('panel LOGROS dibuja sin lanzar y registra botones', g.uiHit.length >= 1, `hits=${g.uiHit.length}`);
  check('los 12 logros definidos', LOGROS.length === 12, String(LOGROS.length));
  check("logro del Acto IV visible como 'próximamente'", logroName('ultima_nota', g) === 'El Último Canto (próximamente)');

  // flag del Acto IV FUTURO: si existiera, cambia nombre y puede desbloquearse
  g.flags.acto4Done = true;
  check('con flag futuro → nombre sin (próximamente)', logroName('ultima_nota', g) === 'El Último Canto');
  achievementTick(g);
  check('con flag futuro → logro se desbloquea', isLogroDone('ultima_nota'));
  delete g.flags.acto4Done;

  closeTitlePanels();
  g.uiHit.length = 0;
  drawTitlePanels(g); // cerrado: no dibuja nada
  check('cerrado: no registra hits', g.uiHit.length === 0);

  // sin save: mensaje 'Aún no hay partidas'
  localStorage.removeItem('ecos-aelthar-save');
  openStatsPanel();
  g.uiHit.length = 0;
  let noThrow = true;
  try { drawTitlePanels(g); } catch { noThrow = false; }
  check('panel ESTADÍSTICAS sin save no lanza (mensaje vacío)', noThrow && g.uiHit.length >= 1);
  closeTitlePanels();
}

// ---------- dejar estado limpio y persistente para la fase 'load' ----------
console.log('--- limpieza: save válido + logros para la fase LOAD ---');
{
  const g = newGame();
  const p = g.player!;
  g.killEnemy(g.makeEnemy('lobo', p.x + 60, p.y, 0));
  g.killEnemy(g.makeEnemy('guardian', p.x + 60, p.y, 0));
  p.hp = 10; g.drinkPotion();
  g.playerDied();
  g.save();
  // garantiza los logros que la fase load espera (persisten de la sesión)
  if (!isLogroDone('primer_canto')) achievementTick(g);
  if (!isLogroDone('rondador')) recordChallengeResult(g, 'jefe', 'guardian', true, 0.8, 95);
  check('estado final persistido', readLastSave()?.stats.enemigosDerrotados === 2 && loadLogros().includes('rondador'));
}

console.log(fails === 0 ? '\nSMOKE LOGROS: TODO OK' : `\nSMOKE LOGROS: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
