// ============================================================
// 12-a (modo-desafío) — Smoke del MODO DESAFÍO sin navegador
// Stub DOM/Audio (patrón de scripts/smoke_motor_acto2.ts, 11-a) + Game real:
// mapa arena, oleadas (spawn/kills/despeje/récord), duelo 1v1 (victoria con
// restauración de campaña + logro), derrota con Portador temporal, aborto
// por salida de mapa y reparación del guardado escrito dentro de la arena.
// Ejecutar: bun scripts/smoke_desafio.ts
// ============================================================

// ---------- stub universal (igual que smoke_motor_acto2.ts) ----------
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

const { ARENA_MAP_ID } = await import('../src/game/maps_expansion');
const { MAPS } = await import('../src/game/maps');
const { SOLID_CHARS } = await import('../src/game/sprites');
const { startChallenge, endChallenge, challengeTick, onChallengeDeath, drawChallengeOverlay, drawChallengeTitleUi } =
  await import('../src/game/challenge');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

function newGame(): InstanceType<typeof Game> {
  const g = new Game(makeCanvas());
  g.newGame('Prueba', 'alba');
  return g;
}

function tick(g: InstanceType<typeof Game>, secs: number) {
  const frames = Math.round(secs * 60);
  for (let i = 0; i < frames; i++) g.update(1 / 60);
}

console.log('=== 1) Mapa ARENA: filas, centro pisable, puerta sur, borde sólido ===');
{
  const arena = MAPS['arena' as keyof typeof MAPS] as { w: number; h: number; rows: string[]; spawns: unknown[]; exits: { x: number; y: number; w: number; h: number }[] } | undefined;
  if (!arena) bad('MAPS no contiene la arena en runtime');
  else {
    const rowsOk = arena.rows.length === arena.h && arena.rows.every(r => r.length === arena.w);
    if (rowsOk) ok(`filas normalizadas ${arena.w}×${arena.h}`);
    else bad('filas de arena mal normalizadas');
    if (arena.spawns.length === 0) ok('arena sin spawns de mapa (challenge.ts instancia todo)');
    else bad('la arena tiene spawns propios: el motor los crearía también');
    const center = arena.rows[16][21];
    if (!SOLID_CHARS.has(center)) ok(`centro (21,16) pisable ('${center}')`);
    else bad(`centro sólido: '${center}'`);
    // corredor de la puerta sur: x20..23, y29..33 todos transitables
    const doorOk = [29, 30, 31, 32, 33].every(y => [20, 21, 22, 23].every(x => !SOLID_CHARS.has(arena.rows[y][x])));
    if (doorOk) ok('corredor de la puerta sur (x20..23, y29..33) transitable');
    else bad('la puerta sur tiene tiles sólidos');
    // zona de salida dentro del corredor y pisable
    const ex = arena.exits[0];
    const zoneOk = !SOLID_CHARS.has(arena.rows[ex.y][ex.x]) && !SOLID_CHARS.has(arena.rows[ex.y + ex.h - 1][ex.x + ex.w - 1]);
    if (zoneOk) ok('zona de salida (20..23, 32..33) pisable');
    else bad('zona de salida sobre tiles sólidos');
    // borde perimetral sólido (arena cerrada salvo la puerta)
    const border = arena.rows[0][0] === '#' && arena.rows[0][arena.w - 1] === '#' && arena.rows[arena.h - 1][0] === '#';
    if (border) ok('muralla perimetral sólida');
    else bad('muralla perimetral no sólida');
  }
}

console.log('\n=== 2) OLEADAS: arranque, oleada 1, kills, despeje, oleada 2, aborto con restauración ===');
{
  const g = newGame();
  const goldPre = g.player!.gold;           // 20
  startChallenge(g, 'oleadas');
  if (g.state === 'play' && g.mapId === ARENA_MAP_ID && g.challengeRun?.phase === 'jugando')
    ok('startChallenge: estado play, mapa arena, reto en marcha');
  else bad(`startChallenge: state=${g.state} map=${String(g.mapId)} phase=${g.challengeRun?.phase}`);
  if (g.player && g.player.hp === g.player.maxHp) ok('Portador curado al entrar (campaña conservada)');
  else bad('el Portador no entró curado');
  tick(g, 3.7);                             // 3.4 s de cuenta atrás + margen
  if (g.challengeRun?.wave === 1) ok('cuenta atrás 3.4 s → oleada 1 lanzada');
  else bad(`wave=${g.challengeRun?.wave}`);
  // el goteo entra a 0.2s + 0.5s por enemigo: tras 0.3s de oleada solo ha
  // entrado el 1º — verificamos anillo/1º enemigo ahora y el total después
  const p = g.player!;
  if (g.enemies.length >= 1) {
    const d0 = Math.hypot(g.enemies[0].x - p.x, g.enemies[0].y - p.y) / 16;
    if (d0 >= 7.5 && d0 <= 14.5) ok('primer spawn en anillo 8–14 tiles (nunca encima del Portador)');
    else bad(`spawn fuera del anillo: ${d0.toFixed(1)}`);
  }
  tick(g, 2.0);                             // margen para que entren los 3 del goteo
  const n1 = g.enemies.length;
  if (n1 === 3 && g.enemies.every(e => e.etype === 'lobo')) ok(`oleada 1: 3 lobos instanciados (${n1})`);
  else bad(`oleada 1: ${n1} enemigos ${g.enemies.map(e => e.etype).join(',')}`);
  // hp escalado de la oleada 1 = base (mult 1.0)
  if (g.enemies[0].maxHp === 30) ok('oleada 1: hp base sin escala (mult 1.0)');
  else bad(`hp oleada 1: ${g.enemies[0].maxHp} (esperado 30)`);
  // matar la oleada → despeje → cuenta atrás → oleada 2
  for (const e of [...g.enemies]) g.damageEnemy(e, 5000, 'fuego', 0);
  tick(g, 0.05);
  if (g.challengeRun?.kills === 3 && g.challengeRun.score === 4) ok('kills=3, score=oleadas+kills=4 (espec)');
  else bad(`kills=${g.challengeRun?.kills} score=${g.challengeRun?.score}`);
  if ((g.challengeRun?.betweenWaves ?? 0) > 0) ok('oleada despejada → cuenta atrás de 3 s');
  else bad('no hay cuenta atrás tras el despeje');
  tick(g, 3.3);
  if (g.challengeRun?.wave === 2) ok('oleada 2 lanzada tras la cuenta atrás');
  else bad(`wave tras despeje=${g.challengeRun?.wave}`);
  const goldMid = g.player!.gold;
  if (goldMid > goldPre) ok(`killEnemy pagó oro de campaña (${goldPre}→${goldMid}); la restauración lo devuelve`);
  else bad('killEnemy no pagó oro (¿cambió el motor?)');
  // ABORTO: salir de la arena (equivalente a la puerta sur) → restauración
  g.loadMap('lunaris', 25, 19);
  tick(g, 0.02);
  if (g.challengeRun === null) ok('aborto: challengeRun cerrado al salir del mapa');
  else bad('el reto sigue abierto fuera de la arena');
  if (g.player!.gold === goldPre) ok(`oro restaurado exacto (${g.player!.gold})`);
  else bad(`oro tras aborto: ${g.player!.gold} ≠ ${goldPre}`);
  if (g.flags.visited_arena === undefined) ok('flags restauradas (sin visited_arena residual)');
  else bad('flags con visited_arena residual');
  if (g.questIdx === 0 && g.questStep === 0) ok('misión intacta tras el aborto');
  else bad(`misión alterada: idx=${g.questIdx} step=${g.questStep}`);
}

console.log('\n=== 3) DUELO (victoria, Portador de campaña): restauración + logro + botín deshecho ===');
{
  store.delete('ecos-desafio-best'); // aislamiento: ningún bloque anterior debe dejar récord: el aborto del bloque 2 escribió récord (1 kill)
  const g = newGame();
  const goldPre = g.player!.gold;   // 20
  const potPre = g.player!.potions; // 2
  startChallenge(g, 'jefe', 'sirena');
  const boss = g.enemies.find(e => e.etype === 'sirena');
  if (boss && g.bossActive && g.bossRef === boss) ok('duelo: Sirena instanciada con barra de jefe activa (bossActive/bossRef)');
  else bad('duelo: la Sirena no quedó activa');
  if (g.player!.potions === 0) ok('duelo: pociones a 0 (1 sola vida, sin curas)');
  else bad(`pociones en duelo: ${g.player!.potions}`);
  if ((g.bossBannerText ?? '').includes('SIRENA')) ok('banner de jefe del motor reutilizado (bossBannerText)');
  else bad(`banner: '${g.bossBannerText}'`);
  tick(g, 0.05);
  // 14-a (buff auditable ENEMY_DEFS_14A): la Sirena de arena comparte defs con
  // la de campaña y sube con ella: 380 → 440 hp (mismo espíritu del pedido)
  if (boss.maxHp === 440) ok('jefe de arena: hp con el buff 14-a de ENEMY_DEFS (380→440, comparte defs)');
  else bad(`hp jefe: ${boss.maxHp}`);
  g.damageEnemy(boss, 100000, 'rayo', 0);   // killEnemy: flag+botín de campaña (se deshace solo)
  tick(g, 2.0);                             // pausa dramática 1.7 s → finish
  const run = g.challengeRun;
  if (g.state === 'title' && run?.phase === 'resultado' && run.resultWin === true)
    ok('victoria: panel de resultados sobre el título');
  else bad(`victoria: state=${g.state} phase=${run?.phase}`);
  if (g.flags.sirenaDefeated === undefined) ok('flag de campaña sirenaDefeated DESHECHA (la arena no marca campaña)');
  else bad('sirenaDefeated quedó marcada por el duelo');
  if (g.player!.potions === potPre + 1) ok(`recompensa: +1 poción por primer duelo (${potPre}→${g.player!.potions})`);
  else bad(`recompensa: pociones=${g.player!.potions} (esperado ${potPre + 1})`);
  if (g.player!.gold === goldPre) ok(`oro restaurado exacto tras el botín del motor (${g.player!.gold})`);
  else bad(`oro tras victoria: ${g.player!.gold} ≠ ${goldPre}`);
  const logros = JSON.parse(store.get('ecos-desafio-logros') ?? '[]') as string[];
  if (logros.includes('duelo:sirena')) ok('logro escrito en ecos-desafio-logros: duelo:sirena');
  else bad(`logros: ${store.get('ecos-desafio-logros')}`);
  // OJO: Map.get devuelve undefined (no null) — normalizar antes de comparar
  if ((store.get('ecos-desafio-best') ?? null) === null) ok('el duelo NO escribe récord de oleadas');
  else bad('el duelo escribió récord');
  drawChallengeTitleUi(g);                  // el panel de resultados debe dibujar sin lanzar
  ok('drawChallengeTitleUi (resultados) dibuja sin excepciones');
  endChallenge(g, true);
  if (g.state === 'title' && g.challengeRun === null && g.mapId === 'lunaris')
    ok('endChallenge: título, reto limpio, mundo lunaris cargado bajo el título');
  else bad(`endChallenge: state=${g.state} run=${String(g.challengeRun)} map=${g.mapId}`);
}

console.log('\n=== 4) OLEADAS: récord en ecos-desafio-best + derrota sin peaje de campaña ===');
{
  const g = newGame();
  const goldPre = g.player!.gold;
  const deathsPre = g.player!.deaths;
  startChallenge(g, 'oleadas');
  tick(g, 3.8);
  for (const e of [...g.enemies]) g.damageEnemy(e, 5000, 'ninguno', 0);
  tick(g, 0.05);
  const scoreEsperado = g.challengeRun!.score;
  // muerte en pleno desafío → pantalla dead → E → onChallengeDeath
  g.damagePlayer(99999, g.player!.x, g.player!.y - 10);
  if (g.state === 'dead') ok('muerte en arena: pantalla de muerte del motor (E para continuar)');
  else bad(`estado tras daño letal: ${g.state}`);
  g.respawn(); // delega en onChallengeDeath (contrato del motor, Task 12)
  const run = g.challengeRun;
  if (g.state === 'title' && run?.phase === 'resultado' && run.resultWin === false)
    ok('derrota: panel de resultados sobre el título');
  else bad(`derrota: state=${g.state} phase=${run?.phase}`);
  const best = Number(store.get('ecos-desafio-best') ?? '0');
  if (best === scoreEsperado) ok(`récord guardado en ecos-desafio-best: ${best}`);
  else bad(`récord: ${best} ≠ ${scoreEsperado}`);
  if (g.player!.gold === goldPre) ok('peaje de muerte de campaña devuelto (oro intacto)');
  else bad(`oro tras derrota: ${g.player!.gold} ≠ ${goldPre}`);
  if (g.player!.deaths === deathsPre) ok('contador de muertes de campaña intacto');
  else bad(`muertes: ${g.player!.deaths} ≠ ${deathsPre}`);
  endChallenge(g, false);
  if (g.challengeRun === null && g.state === 'title') ok('endChallenge tras derrota: título limpio');
  else bad('endChallenge tras derrota no dejó el título limpio');
}

console.log('\n=== 5) DUELO con Portador TEMPORAL (desde título sin campaña) ===');
{
  const g = new Game(makeCanvas());         // sin newGame: g.player === null
  startChallenge(g, 'jefe', 'golem');
  if (g.player && g.player.name === 'Portador de Arena' && g.player.level === 8)
    ok('Portador temporal creado (Alba Nv 8, arma +2)');
  else bad('no se creó Portador temporal');
  if (g.enemies.some(e => e.etype === 'golem') && g.bossActive) ok('Gólem de Escarcha instanciado');
  else bad('Gólem no instanciado');
  const boss = g.enemies.find(e => e.etype === 'golem')!;
  g.damageEnemy(boss, 100000, 'fuego', 0);
  tick(g, 2.0);
  const logros = JSON.parse(store.get('ecos-desafio-logros') ?? '[]') as string[];
  if (!logros.includes('duelo:golem')) ok('victoria temporal NO escribe logro (premio reservado a campaña)');
  else bad('el Portador temporal wrote logro');
  if (g.challengeRun?.phase === 'resultado') ok('resultados al terminar (Portador temporal)');
  else bad(`fase: ${g.challengeRun?.phase}`);
  endChallenge(g, true);
  if (g.player === null) ok('Portador temporal retirado al volver al título');
  else bad('el Portador temporal sigue en g.player');
}

console.log('\n=== 6) Guardado escrito DENTRO de la arena → reparado al salir ===');
{
  const g = newGame();
  g.save();                                  // guardado de campaña legítimo
  const rawPre = store.get('ecos-aelthar-save')!;
  startChallenge(g, 'oleadas');
  tick(g, 3.8);
  for (const e of [...g.enemies]) g.damageEnemy(e, 5000, 'ninguno', 0);
  g.save();                                  // simula GUARDAR Y SALIR desde la pausa en arena
  // ==== 17-a: contrato nuevo — save() es NO-OP dentro del desafío: el
  // fichero de campaña ni siquiera se escribe (antes se contaminaba y
  // endChallenge lo "reparaba"; con el bloqueo ya no hay nada que reparar)
  if (store.get('ecos-aelthar-save') === rawPre) ok('guardado en arena BLOQUEADO (save de campaña intacto)');
  else bad('el guardado en arena escribió (regresión del fix 17-a)');
  g.damagePlayer(99999, g.player!.x, g.player!.y - 10);
  g.respawn();                               // derrota → resultados
  endChallenge(g, false);                    // cierre; el save sigue siendo el de campaña legítimo
  const d = JSON.parse(store.get('ecos-aelthar-save')!) as { map: string; player: { gold: number }; flags: Record<string, unknown> };
  if (d.map === 'lunaris') ok('save intacto con mapId lunaris (nunca atrapa en la arena)');
  else bad(`save con map=${d.map}`);
  if (d.player.gold === 20 && d.flags.visited_arena === undefined) ok('save intacto con campaña sana (oro/flags)');
  else bad(`save con oro=${d.player.gold}`);
  void rawPre;
}

console.log('\n=== 7) HUD/overlays del desafío dibujan sin excepciones ===');
{
  const g = newGame();
  startChallenge(g, 'oleadas');
  g.update(1 / 60);
  drawChallengeOverlay(g);
  drawChallengeTitleUi(g);                   // menú cerrado: no-op
  ok('drawChallengeOverlay (play) + drawChallengeTitleUi (título, sin menú)');
  endChallenge(g, false);
}

console.log(fails === 0 ? '\nSMOKE DESAFÍO: TODO OK' : `\nSMOKE DESAFÍO: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
