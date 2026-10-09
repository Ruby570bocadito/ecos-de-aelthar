// ============================================================
// 13-c (inmersion-temporal) — Smoke del VIAJE TEMPORAL sin navegador
// Stub DOM/Audio (patrón de scripts/smoke_desafio.ts, 12-a) + Game real:
// (1) veto narrativo con enemigo aggro <5 tiles (beginEpochShift false,
//     epochSwitch NO cambia época, 3 frases rotativas, sacudida),
// (2) sin amenaza → true, época alterna y la transición programa FX
//     (ondas/flash/notas) — timeTick 120 frames sin lanzar, 2 mapas
//     con diffs × 2 épocas,
// (3) huellas: lamp1 + eco menor → frase UNA vez (flag ts_ propia),
//     segunda vuelta NO repite; cobertizo: adquisición pisándolo en el
//     ayer y recuerdo al aterrizar en el presente,
// (4) NPCs duales: Brisa cerca (versos) / cooldown 30 s / lejos (nada)
//     y Mera en la aldea,
// (5) 600 frames sin lanzar con arrays acotados (residuos ≤ cap).
// Ejecutar: bun scripts/smoke_timeskip.ts
// ============================================================

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

const { MAPS } = await import('../src/game/maps');
const { beginEpochShift } = await import('../src/game/timeskip');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

function newGame(): InstanceType<typeof Game> {
  const g = new Game(makeCanvas());
  g.newGame('Prueba', 'alba');
  g.startPlay(); // carga lunaris (25,20) y estado 'play' (newGame deja 'intro')
  g.player!.hasEcho = true; // el Eco ya despertó: Q disponible
  return g;
}

function tick(g: InstanceType<typeof Game>, secs: number) {
  const frames = Math.round(secs * 60);
  for (let i = 0; i < frames; i++) g.update(1 / 60);
}

function toastHas(g: InstanceType<typeof Game>, sub: string): boolean {
  return g.toasts.some(t => t.text.includes(sub));
}
function floatHas(g: InstanceType<typeof Game>, sub: string): boolean {
  return g.floats.some(f => f.text.includes(sub));
}
/** Verso dual PROPIO (los duales de 13-c empiezan con elipsis «...» — los
 *  rumores ambientales de worldlife (13-b) también hablan cerca de las NPCs). */
function verseHas(g: InstanceType<typeof Game>, name: string): boolean {
  return g.floats.some(f => f.text.startsWith(`${name}: «...`));
}

console.log('=== 1) VETO narrativo: enemigo con aggro <5 tiles ===');
{
  const g = newGame();
  const p = g.player!;
  const ep0 = g.epoch; // 'presente'
  // lobo pegado al Portador (30 px ≈ 1.9 tiles) y con aggro
  const lobo = g.makeEnemy('lobo', p.x + 30, p.y, 0);
  lobo.aggro = true;
  g.enemies.push(lobo);

  // vía del motor completo: epochSwitch NO alterna
  g.epochSwitch();
  tick(g, 0.05);
  if (g.epoch === ep0) ok('epochSwitch vetado: la época NO cambia');
  else bad(`la época cambió pese al veto (${g.epoch})`);
  if (g.flashT === 0 && g.waves.length === 0) ok('sin FX de transición (flash/ondas limpios)');
  else bad(`el veto programó FX (flashT=${g.flashT}, waves=${g.waves.length})`);
  if (g.toasts.length > 0 && g.toasts.some(t => t.text.includes('enemigo') || t.text.includes('Eco calla') || t.text.includes('aliento hostil')))
    ok(`frase evocadora de veto: «${g.toasts[g.toasts.length - 1].text.slice(0, 42)}...»`);
  else bad('el veto no soltó frase evocadora');
  if (g.shake > 0) ok(`sacudida aplicada (shake=${g.shake.toFixed(1)})`);
  else bad('el veto no sacudió la cámara');

  // rotación: 3 vetos consecutivos → 3 frases distintas
  const frases = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const before = g.toasts.length;
    if (!beginEpochShift(g)) {
      const nuevas = g.toasts.slice(before).map(t => t.text);
      if (nuevas.length > 0) frases.add(nuevas[nuevas.length - 1]);
    } else bad('beginEpochShift devolvió true con enemigo en aggro');
    g.toasts.length = 0;
  }
  if (frases.size === 3) ok('3 frases de veto rotativas y distintas');
  else bad(`frases rotativas: ${frases.size}/3`);

  // límite exacto: a ≥5 tiles NO veta (80 px)
  lobo.x = p.x + 5 * 16 + 1;
  if (beginEpochShift(g) === true) ok('a ≥5 tiles el viaje ya no se veta');
  else bad('el veto se extendió más allá de 5 tiles');
}

console.log('\n=== 2) Sin amenaza: transición programa FX (2 mapas con diffs × 2 épocas) ===');
{
  if (MAPS.lunaris.epochDiffs.length > 0 && MAPS.bosque.epochDiffs.length > 0)
    ok(`mapas con diffs: lunaris (${MAPS.lunaris.epochDiffs.length}) + bosque (${MAPS.bosque.epochDiffs.length})`);
  else bad('faltan epochDiffs en los mapas de prueba');

  const g = newGame();
  g.enemies.length = 0; // sin amenaza
  const fx = beginEpochShift(g);
  if (fx === true) ok('beginEpochShift → true sin amenaza');
  else bad('beginEpochShift → false sin amenaza');
  if (g.epoch === 'presente') ok('beginEpochShift NO alterna la época (lo hace el motor tras true)');
  else bad('beginEpochShift alteró la época por su cuenta');
  if (g.waves.length >= 2 && g.waves.every(w => w.dmg === 0)) ok(`onda expansiva doble inocua (${g.waves.length} ondas, dmg 0)`);
  else bad(`ondas expansivas: ${g.waves.length}`);
  if (g.flashT > 0) ok(`flash suave programado (flashT=${g.flashT.toFixed(2)})`);
  else bad('sin flash de transición');
  if (g.particles.length >= 12) ok(`ráfaga de notas musicales (${g.particles.length} partículas)`);
  else bad(`notas de la transición: ${g.particles.length}`);

  g.epochSwitch(); // ahora sí: el motor alterna (presente → pasado)
  if (g.epoch === 'pasado') ok('epochSwitch: presente → pasado');
  else bad(`época tras epochSwitch: ${g.epoch}`);
  tick(g, 2); // 120 frames con timeTick, sin lanzar
  ok('timeTick 120 frames en lunaris/pasado sin lanzar');

  g.loadMap('bosque', 27, 40);
  if (g.mapId === 'bosque') ok('viaje a Bosque Susurrante (la época se conserva)');
  else bad(`mapa tras loadMap: ${g.mapId}`);
  g.enemies.length = 0;
  g.epochSwitch(); // bosque, pasado → presente
  if (g.epoch === 'presente') ok('bosque: pasado → presente (2 mapas × 2 épocas verificados)');
  else bad(`época en bosque: ${g.epoch}`);
  tick(g, 2);
  ok('timeTick 120 frames en bosque/presente sin lanzar');
}

console.log('\n=== 3) HUELLAS: farol + eco menor (una vez) y cobertizo (adquisición→recuerdo) ===');
{
  const g = newGame();
  g.epochSwitch(); tick(g, 0.3);      // presente → pasado (nada que recordar aún)
  g.flags.lamp1 = true;               // como engine.lightLamp: flags[id] = true
  g.takenEchoes.add('e1');            // eco menor tomado en el ayer
  g.epochSwitch(); tick(g, 1.6);      // pasado → presente: el mundo recuerda
  if (toastHas(g, 'farol arde en el ayer')) ok('lamp1: toast evocador al volver al presente');
  else bad(`sin recuerdo del farol (toasts: ${g.toasts.map(t => t.text).join(' | ')})`);
  if (g.flags.ts_lamp1 === true) ok('marca persistente ts_lamp1 en flags (viaja en save())');
  else bad('falta flag ts_lamp1');
  if (floatHas(g, 'eco que arrancaste')) ok('eco menor: floatText evocador (ts_eco_e1)');
  else bad('sin recuerdo del eco menor');
  if (g.flags.ts_eco_e1 === true) ok('marca persistente ts_eco_e1');
  else bad('falta flag ts_eco_e1');

  // segunda vuelta: NADA se repite
  g.toasts.length = 0;
  g.epochSwitch(); tick(g, 0.3);      // → pasado
  g.epochSwitch(); tick(g, 1.6);      // → presente
  if (!toastHas(g, 'farol') && !floatHas(g, 'eco que arrancaste'))
    ok('segunda vuelta: ni farol ni eco se repiten (UNA VEZ por huella)');
  else bad('los recuerdos se repitieron en la segunda vuelta');

  // cobertizo: adquisición pisándolo EN el pasado → recuerdo al volver
  g.epochSwitch(); tick(g, 0.3);      // → pasado
  g.player!.x = 5 * 16 + 8;           // tile (5,25): ruinas en presente, suelo libre en ayer
  g.player!.y = 25 * 16 + 8;
  g.enemies.length = 0;               // los lobos del valle patrullan cerca del cobertizo:
                                      // sin esta línea el VETO de 1) bloquearía el retorno (comportamiento correcto en juego)
  tick(g, 0.35);                      // escaneo de adquisición (throttle 0.2 s)
  if (floatHas(g, 'toma nota')) ok('pista sutil al tocar la huella («...el ayer toma nota...»)');
  else bad('sin pista de adquisición junto al cobertizo');
  g.epochSwitch(); tick(g, 0.6);      // → presente: recuerdo del cobertizo
  if (toastHas(g, 'cobertizo') && g.flags.ts_cobertizo === true)
    ok('cobertizo: el presente recuerda la ruina que ayer estaba en pie (ts_cobertizo)');
  else bad(`sin recuerdo del cobertizo (toasts: ${g.toasts.map(t => t.text).join(' | ')})`);
  g.toasts.length = 0;
  g.epochSwitch(); tick(g, 0.3);
  g.epochSwitch(); tick(g, 0.6);
  if (!toastHas(g, 'cobertizo')) ok('cobertizo NO se repite en la siguiente vuelta');
  else bad('el recuerdo del cobertizo se repitió');
}

console.log('\n=== 4) NPCs DUALES: Brisa cerca/lejos + cooldown 30 s + Mera en la aldea ===');
{
  const g = newGame();
  const p = g.player!;
  const brisa = g.npcs.find(n => n.nid === 'brisa');
  if (!brisa) { bad('Brisa no está en lunaris'); }
  else {
    tick(g, 0.1);                          // inicializa prevEpoch (en juego siempre hay ticks)
    p.x = brisa.x + 30; p.y = brisa.y;     // ~2 tiles
    g.epochSwitch();                        // → pasado: duelo de versos
    let saw = false, maxLines = 0;
    for (let i = 0; i < 200; i++) {
      g.update(1 / 60);
      if (verseHas(g, 'Brisa')) saw = true;
      maxLines = Math.max(maxLines, g.floats.filter(f => f.text.startsWith('Brisa: «...')).length);
    }
    if (saw) ok(`versos superpuestos de Brisa durante ~3 s (hasta ${maxLines} líneas solapadas)`);
    else bad('Brisa no cantó sus versos duales');
    // cooldown: nuevo cambio cerca de ella, inmediatamente → nada
    tick(g, 2.0); // deja morir los floats restantes
    g.epochSwitch();                        // → presente, MUY cerca de ella aún
    tick(g, 1.0);
    if (!verseHas(g, 'Brisa')) ok('cooldown activo: sin segunda ronda inmediata');
    else bad('los versos se repitieron sin respetar el cooldown');
    // lejos: tampoco
    p.x = 44 * 16; p.y = 6 * 16;
    g.epochSwitch();                        // → pasado, lejos de Brisa
    tick(g, 1.0);
    if (!verseHas(g, 'Brisa')) ok('lejos de Brisa: sin versos');
    else bad('los versos suenan a kilómetros de la NPC');
    // expiración del cooldown (30 s)
    tick(g, 30.5);
    p.x = brisa.x + 30; p.y = brisa.y;
    g.epochSwitch();                        // → presente de nuevo, cerca
    let saw2 = false;
    for (let i = 0; i < 120; i++) { g.update(1 / 60); if (verseHas(g, 'Brisa')) saw2 = true; }
    if (saw2) ok('tras 30 s el duelo de versos vuelve a despertar');
    else bad('el cooldown no se agotó nunca');
  }
  // Mera (Espectro de Merrow, aldea) — misma vía, otro mapa del Acto II
  g.loadMap('aldea', 22, 16);
  const mera = g.npcs.find(n => n.nid === 'mera');
  if (!mera) bad('Mera no está en la aldea');
  else {
    tick(g, 0.1);
    p.x = mera.x; p.y = mera.y;
    g.epochSwitch();
    let sawM = false;
    for (let i = 0; i < 120; i++) { g.update(1 / 60); if (verseHas(g, 'Mera')) sawM = true; }
    if (sawM) ok('Mera (aldea): versos duales al cambiar de época junto a ella');
    else bad('Mera no cantó sus versos duales');
  }
}

console.log('\n=== 5) 600 frames sin lanzar + arrays acotados (residuos del canto) ===');
{
  const g = newGame();
  g.enemies.length = 0;
  const p = g.player!;
  let maxP = 0, maxF = 0, maxT = 0, maxW = 0;
  let threw = null as string | null;
  try {
    for (let i = 0; i < 600; i++) {
      g.update(1 / 60);
      if (i === 200) g.epochSwitch();                    // flip en caliente
      if (i === 400) g.epochSwitch();
      if (i % 120 === 0) { p.x = 17 * 16 + 8; p.y = 20 * 16 + 8; } // lápidas/flores
      maxP = Math.max(maxP, g.particles.length);
      maxF = Math.max(maxF, g.floats.length);
      maxT = Math.max(maxT, g.toasts.length);
      maxW = Math.max(maxW, g.waves.length);
    }
  } catch (e) {
    threw = String(e);
  }
  if (threw === null) ok('600 frames (2 flips + 2 huellas bidireccionales) sin lanzar');
  else bad(`excepción a mitad del tick: ${threw}`);
  if (maxP > 0 && maxP < 60) ok(`partículas acotadas (máx ${maxP}; residuos ≤ cap ~30 + notas de transición)`);
  else bad(`partículas fuera de rango: ${maxP}`);
  if (maxF < 24) ok(`floats acotados (máx ${maxF})`);
  else bad(`floats desbocados: ${maxF}`);
  if (maxT <= 4) ok(`toasts acotados (máx ${maxT})`);
  else bad(`toasts desbocados: ${maxT}`);
  if (maxW < 8) ok(`ondas acotadas (máx ${maxW})`);
  else bad(`ondas desbocadas: ${maxW}`);
  if (g.flags.ts_flores === true && g.flags.ts_lapidas === true)
    ok('huellas bidireccionales en las lápidas: ts_flores (presente→pasado) y ts_lapidas (pasado→presente)');
  else bad(`huellas de lápidas incompletas (ts_flores=${String(g.flags.ts_flores)}, ts_lapidas=${String(g.flags.ts_lapidas)})`);
  if (g.flags.ts_cobertizo === undefined) ok('sin falsos positivos: el cobertizo no se tocó en este bloque');
  else bad('ts_cobertizo marcado sin haberlo pisado');
}

console.log(fails === 0 ? '\nSMOKE TIMESKIP: TODO OK' : `\nSMOKE TIMESKIP: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
