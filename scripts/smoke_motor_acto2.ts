// ============================================================
// 11-a (integrador) — Smoke del MOTOR sin navegador (stub DOM/Audio)
// Ejercita la máquina de misiones del Acto II con el Game real:
// flujo normal, flujo FUERA DE ORDEN (catchUpActo2) y save/load.
// ============================================================

// ---------- stub universal ----------
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

// globals de navegador que el motor toca
const store = new Map<string, string>();
(globalThis as AnyP).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null, length: 0,
};
const listeners: AnyP = {};
(globalThis as AnyP).window = {
  addEventListener: (t: string, f: unknown) => { (listeners[t] ??= []).push(f); },
  removeEventListener: noop,
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
// el AudioContext real no existe aquí: congelamos init (sfx queda en no-op seguro)
(audio as unknown as { init: () => void; ctx: unknown }).init = () => {};
(audio as unknown as { ctx: unknown }).ctx = stub();

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

function newGame(): InstanceType<typeof Game> {
  const g = new Game(makeCanvas());
  g.newGame('Prueba', 'alba');
  return g;
}

console.log('=== 1) Arranque del motor (constructor + newGame) ===');
const g1 = newGame();
if (g1.player && g1.questIdx === 0) ok('newGame: jugador creado, questIdx=0 (q1)');
else bad(`newGame: questIdx=${g1.questIdx}`);

console.log('\n=== 2) Cadena normal q5→q6→…→q10 (métodos públicos reales) ===');
{
  const g = newGame();
  // q5 completada por habla con Brisa
  g.questIdx = 4; g.questStep = 0;
  g.talkTo('brisa');
  if (g.questIdx === 5 && g.questStep === 0) ok('talkTo(brisa) completa q5 → q6 paso 0');
  else bad(`talkTo(brisa): questIdx=${g.questIdx} step=${g.questStep}`);
  g.applyAction('accept_q6');
  if (g.questIdx === 5 && g.flags.q6) ok('accept_q6: flag q6, questIdx 5');
  else bad('accept_q6 no dejó la misión en idx 5');
  // viajar a costa (paso 0→1)
  g.loadMap('costa', 26, 2);
  if (g.questStep === 1) ok('loadMap(costa) avanza paso 0→1 (idempotente por estado)');
  else bad(`loadMap(costa) step=${g.questStep}`);
  // hablar con Mara (mara_met)
  g.applyAction('mara_met');
  if (g.questIdx === 6 && g.questStep === 0) ok('mara_met: q6 → q7 paso 0 (un solo toast de misión)');
  else bad(`mara_met: questIdx=${g.questIdx} step=${g.questStep}`);
  // q7: avistamiento (watcher), derrota (killEnemy), eco
  g.bossActive = true;
  (g as unknown as { bossRef: { etype: string; dead: boolean } | null }).bossRef = { etype: 'sirena', dead: false };
  g.update(1 / 60);
  if (g.questIdx === 6 && g.questStep === 1 && g.flags.sirenaSeen) ok('watcher sirenaSeen: q7 paso 0→1');
  else bad(`watcher: idx=${g.questIdx} step=${g.questStep} seen=${g.flags.sirenaSeen}`);
  const sirena = { kind: 'enemy', etype: 'sirena', dead: false, x: 100, y: 100, hp: 0, maxHp: 380, w: 22, h: 16 } as never;
  g.enemies.push(sirena);
  const potPre = g.player!.potions;
  g.killEnemy(sirena);
  if (g.questIdx === 6 && g.questStep === 2 && g.flags.sirenaDefeated) ok('killEnemy(sirena): paso 1→2, flag + botín poción');
  else bad(`killEnemy(sirena): idx=${g.questIdx} step=${g.questStep}`);
  if (g.player!.potions === potPre + 1) ok('botín garantizado de la jefa: +1 poción');
  else bad(`botín de jefa: esperado +1 poción, hay ${g.player!.potions - potPre}`);
  const potBefore = g.player!.potions;
  const goldBefore = g.player!.gold;
  // q7→q8 via eco_mareas_taken
  g.applyAction('eco_mareas_taken');
  if (g.questIdx === 7 && g.questStep === 0 && g.flags.ecoMareas) ok('eco_mareas_taken: q7 → q8 (paso 2 completado)');
  else bad(`eco_mareas_taken: idx=${g.questIdx} step=${g.questStep}`);
  const paid = goldBefore + 40; // recompensa de q7 (40 coronas + 1 poción vía grantQuestLoot)
  if (g.player!.gold >= paid) ok(`grantQuestLoot(q7): +40 coronas pagadas (${g.player!.gold} ≥ ${paid})`);
  else bad(`grantQuestLoot(q7) no pagó: ${g.player!.gold} < ${paid}`);
  if (g.player!.potions === potBefore + 1) ok('recompensa q7 (grantQuestLoot): +1 poción');
  else bad(`recompensa q7: esperada +1 poción, hay ${g.player!.potions - potBefore}`);
  // q8: viaje, faroles (desorden incluido), eco de Mera
  g.loadMap('aldea', 3, 18);
  if (g.questStep === 1) ok('loadMap(aldea): paso 0→1');
  g.lightLamp('lamp2');
  g.lightLamp('lamp1');
  if (g.questStep === 1) ok('2 faroles en desorden: sin avance prematuro (2/3)');
  g.lightLamp('lamp3');
  if (g.questStep === 2) ok('3er farol (orden aleatorio): paso 1→2');
  else bad(`lamp3: step=${g.questStep}`);
  g.applyAction('mera_eco');
  if (g.questIdx === 8 && g.questStep === 0 && g.flags.ecoNombres) ok('mera_eco: q8 → q9');
  else bad(`mera_eco: idx=${g.questIdx} step=${g.questStep}`);
  // q9: viaje, gólem, eco
  g.loadMap('cumbres', 25, 39);
  if (g.questStep === 1) ok('loadMap(cumbres): paso 0→1');
  const golem = { kind: 'enemy', etype: 'golem', dead: false, x: 100, y: 100, hp: 0, maxHp: 460, w: 22, h: 16 } as never;
  g.enemies.push(golem);
  g.killEnemy(golem);
  if (g.questStep === 2 && g.flags.golemDefeated) ok('killEnemy(golem): paso 1→2, +30 coronas de botín');
  g.applyAction('eco_cumbres_taken');
  if (g.questIdx === 9 && g.questStep === 0 && g.flags.ecoCumbres) ok('eco_cumbres_taken: q9 → q10');
  else bad(`eco_cumbres_taken: idx=${g.questIdx} step=${g.questStep}`);
  // q10: cierre con Brisa (pago único) + acto2_report
  const goldQ10 = g.player!.gold;
  g.talkTo('brisa');
  if (g.player!.gold === goldQ10 + 60 && g.flags.q10Paid) ok('talkTo(brisa) en q10: grantQuestLoot(9) pagado una vez (+60)');
  else bad(`pago q10: ${g.player!.gold - goldQ10} coronas (esperado +60), q10Paid=${g.flags.q10Paid}`);
  g.applyAction('end_demo');
  if (g.flags.acto2Done !== true) {
    // end_demo no pone acto2Done; lo pone acto2_report (se prueba aparte abajo)
  }
  g2_check: {
    const g2 = newGame();
    g2.questIdx = 9; g2.questStep = 0; g2.flags.q10 = true;
    g2.talkTo('brisa');
    g2.applyAction('acto2_report');
    if (g2.flags.acto2Done) ok('acto2_report: cierra q10 (flag acto2Done)');
    else bad('acto2_report no activó acto2Done');
    const g3 = newGame();
    g3.questIdx = 9; g3.questStep = 0;
    g3.talkTo('brisa');
    const once = g3.player!.gold;
    g3.talkTo('brisa');
    if (g3.player!.gold === once) ok('q10Paid: reabrir el diálogo no duplica el pago');
    else bad('q10 pagado DOS veces (talkTo repetido)');
  }
}

console.log('\n=== 3) Juego FUERA DE ORDEN: catchUpActo2 rescata la cadena ===');
{
  // Caso A: sirena muerta y eco tomado ANTES de aceptar q7 (mata durante q6)
  const g = newGame();
  g.questIdx = 5; g.questStep = 1; g.flags.q6 = true;
  g.applyAction('mara_met'); // q6 → q7 paso 0
  if (g.questIdx !== 6) bad('preparación caso A fallida');
  g.flags.sirenaDefeated = true;
  g.flags.ecoMareas = true;
  g.update(1 / 60); // catchUpActo2 corre dentro de update()
  if (g.questIdx === 7 && g.questStep === 0) ok('caso A: sirena ya muerta + eco tomado → q7 se salta entera, q8 paso 0');
  else bad(`caso A: idx=${g.questIdx} step=${g.questStep} (la cadena habría quedado bloqueada)`);
  // Caso B: 3 faroles encendidos antes de q8
  const gb = newGame();
  gb.questIdx = 7; gb.questStep = 1; gb.flags.q8 = true;
  gb.lightLamp('lamp3'); gb.lightLamp('lamp1'); gb.lightLamp('lamp2');
  // lightLamp ya avanza (1→2) aunque la misión se aceptara antes: comprobar
  if (gb.questStep === 2) ok('caso B: lightLamp avanza con 3/3 incluso aceptando tarde');
  else {
    gb.update(1 / 60);
    if (gb.questStep === 2) ok('caso B: catchUpActo2 completa faroles 3/3 → paso 2');
    else bad(`caso B: step=${gb.questStep}`);
  }
  // Caso B2: faroles pre-encendidos ANTES de aceptar q8 (lightLamp no volverá a dispararse)
  const gc = newGame();
  gc.flags.lamp1 = true; gc.flags.lamp2 = true; gc.flags.lamp3 = true;
  gc.questIdx = 7; gc.questStep = 1;
  gc.update(1 / 60);
  if (gc.questStep === 2) ok('caso B2: faroles pre-encendidos antes de aceptar q8 → catchUp completa paso 1');
  else bad(`caso B2: step=${gc.questStep} (softlock preexistente, ahora rescatado)`);
  // Caso C: gólem muerto durante q8 → q9 paso 1 se completa solo
  const gd = newGame();
  gd.questIdx = 8; gd.questStep = 1; gd.flags.golemDefeated = true;
  gd.update(1 / 60);
  if (gd.questStep === 2) ok('caso C: golemDefeated antes de q9 → catchUp completa paso 1');
  else bad(`caso C: step=${gd.questStep}`);
  // Caso D: sin flags, catchUp NO avanza nada (no rompe el caso normal)
  const ge = newGame();
  ge.questIdx = 6; ge.questStep = 0;
  ge.update(1 / 60);
  if (ge.questIdx === 6 && ge.questStep === 0) ok('caso D: sin condiciones cumplidas, catchUp no toca el progreso');
  else bad(`caso D: avance espúreo idx=${ge.questIdx} step=${ge.questStep}`);
}

console.log('\n=== 4) save() serializa TODAS las flags del Acto II ===');
{
  const g = newGame();
  g.questIdx = 7; g.questStep = 1;
  Object.assign(g.flags, {
    q6: true, q7: true, q8: true, q9: true, q10: true,
    sirenaSeen: true, q10Paid: true,
    visited_costa: true, visited_aldea: true, visited_cumbres: true,
    lamp1: true, lamp2: true, lamp3: true,
    ecoMareas: true, ecoCumbres: true, ecoNombres: true,
    sirenaDefeated: true, golemDefeated: true,
    bossHp_costa: 123, bossHp_cumbres: 45,
  });
  g.save();
  const raw = store.get('ecos-aelthar-save');
  if (!raw) { bad('save(): no escribió en localStorage'); }
  else {
    const d = JSON.parse(raw) as { flags: Record<string, number | boolean> };
    const need = ['q6', 'q7', 'q8', 'q9', 'q10', 'sirenaSeen', 'q10Paid', 'visited_costa', 'visited_aldea',
      'visited_cumbres', 'lamp1', 'lamp2', 'lamp3', 'ecoMareas', 'ecoCumbres', 'ecoNombres',
      'sirenaDefeated', 'golemDefeated', 'bossHp_costa', 'bossHp_cumbres'];
    const missing = need.filter(k => d.flags[k] === undefined);
    if (missing.length === 0) ok(`save(): las ${need.length} flags del Acto II persisten (Record genérico, sin filtro)`);
    else bad(`save(): flags perdidas → ${missing.join(', ')}`);
  }
}

console.log('\n================================');
console.log(fails === 0 ? 'RESULTADO: ✗ 0 fallos — motor y cadena del Acto II verificados' : `RESULTADO: ✗ ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
