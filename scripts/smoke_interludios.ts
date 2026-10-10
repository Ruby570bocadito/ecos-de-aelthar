// ============================================================
// 18-f (historia-transiciones) — Smoke de INTERLUDIOS DE ACTO +
// BARRERA NARRATIVA DE LOS ALTARES DEL ECO, sin navegador.
// Stub DOM/Audio (patrón de las primeras 60 líneas de scripts/smoke_timeskip.ts)
// + Game real + interludios/hooks/data reales:
//   (a) cada transición de acto dispara su interludio UNA vez
//       (accept_q6 vía watcher de estado; accept_q11/accept_q14 vía hooks;
//       repeticiones y re-ticks no re-abren; recuperación post-guardado;
//       un save antiguo a mitad de Acto II NO dispara),
//   (b) cadena de 3 nodos + 2 reacciones navegable (a→b→c→brisa→toln,
//       ninguna opción muerta, cierre que devuelve a 'play'),
//   (c) watcher del altar: con jefe vivo dispara 1 vez en 10 s
//       (flanco + cooldown 8 s), fuerza aggro/barra de jefe; con jefe
//       derrotado NUNCA (costa/cumbres/cripta),
//   (d) los flags interludio_* (y _vista) persisten en el save y
//       sobreviven a continueGame.
// Ejecutar: bun scripts/smoke_interludios.ts
// ============================================================

// ---------- stub universal (igual que smoke_timeskip.ts) ----------
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

const { DIALOGUES } = await import('../src/game/data');
const { MAPS } = await import('../src/game/maps');
const { INTERLUDIOS, BARRERA_ALTARES_18F, interludioTick18F, bannerActo18F } =
  await import('../src/game/interludios');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

type G = InstanceType<typeof Game>;
function newGame(): G {
  const g = new Game(makeCanvas());
  g.newGame('Prueba18f', 'alba');
  return g;
}
/** El tick tal y como lo llama el juego (screens.drawScreens, case 'play'). */
function tick(g: G) { interludioTick18F(g); }
/** Recorre el diálogo abierto hasta que cierre (2 advances por nodo: texto + opción). */
function walk(g: G, maxNodes = 12): string[] {
  const seen: string[] = [];
  for (let i = 0; i < maxNodes * 2 + 4 && g.state === 'dialogue'; i++) {
    if (g.dlgKey && (seen.length === 0 || seen[seen.length - 1] !== g.dlgKey)) seen.push(g.dlgKey);
    g.advanceDialogue();
  }
  return seen;
}
const toastsCon = (g: G, frag: string) => g.toasts.filter(t => t.text.includes(frag)).length;

console.log('=== 1) ESTRUCTURA: 9 nodos de interludio + 6 reacciones, cadena íntegra ===');
{
  const acts = [2, 3, 4] as const;
  for (const a of acts) {
    const k = (s: string) => `interludio_acto${a}_${s}`;
    const rk = (who: string) => `r18_reacc_acto${a}_${who}`;
    const chain = [k('a'), k('b'), k('c'), rk('brisa'), rk('toln')];
    for (const key of chain) {
      if (!DIALOGUES[key]) { bad(`falta el nodo '${key}' en DIALOGUES`); continue; }
      const n = DIALOGUES[key];
      if (!n.text || n.text.length < 80) bad(`nodo '${key}' con texto demasiado corto (${n.text?.length ?? 0})`);
    }
    const a_ = DIALOGUES[k('a')], b_ = DIALOGUES[k('b')], c_ = DIALOGUES[k('c')];
    if (a_ && b_ && c_) {
      if (a_.portrait === 'fragment' && b_.portrait === 'fragment' && c_.portrait === 'fragment') ok(`acto ${a}: 3 nodos 'fragment' (${k('a')} → _b → _c)`);
      else bad(`acto ${a}: retratos incorrectos (${a_.portrait}/${b_.portrait}/${c_.portrait})`);
      if (a_.action === `flag_interludio_acto${a}_vista`) ok(`acto ${a}: 1er nodo marca flag_interludio_acto${a}_vista`);
      else bad(`acto ${a}: el 1er nodo no marca la flag _vista (${String(a_.action)})`);
      const o1 = a_.options?.[0], o2 = b_.options?.[0], o3 = c_.options?.[0];
      if (o1?.next === k('b') && o2?.next === k('c')) ok(`acto ${a}: '…' encadena a → b → c`);
      else bad(`acto ${a}: encadenado roto (${o1?.next} / ${o2?.next})`);
      if (o3?.next === rk('brisa')) ok(`acto ${a}: el cierre del Eco enlaza la reacción de Brisa`);
      else bad(`acto ${a}: c no enlaza la reacción (${String(o3?.next)})`);
    }
    const rb = DIALOGUES[rk('brisa')], rt = DIALOGUES[rk('toln')];
    if (rb && rt) {
      if (rb.portrait === 'brisa' && rt.portrait === 'toln') ok(`acto ${a}: reacciones Brisa+Toln con retratos correctos`);
      else bad(`acto ${a}: retratos de reacción incorrectos (${rb.portrait}/${rt.portrait})`);
      const orb = rb.options?.[0], ort = rt.options?.[0];
      if (orb?.next === rk('toln')) ok(`acto ${a}: reacción de Brisa → Toln`);
      else bad(`acto ${a}: reacción de Brisa no enlaza a Toln (${String(orb?.next)})`);
      if (rt.options?.length === 1 && !ort?.next) ok(`acto ${a}: opción final de Toln cierra y devuelve al juego`);
      else bad(`acto ${a}: la opción final no cierra (next=${String(ort?.next)})`);
    }
  }
  const nInter = Object.keys(INTERLUDIOS).length;
  if (nInter === 9) ok(`INTERLUDIOS exporta ${nInter} nodos (3 por acto)`);
  else bad(`INTERLUDIOS tiene ${nInter} nodos, se esperaban 9`);
  const reacs = Object.keys(DIALOGUES).filter(k => k.startsWith('r18_reacc_')).length;
  if (reacs === 6) ok(`${reacs} nodos de reacción registrados en DIALOGUES (data.ts, bloque 18-f)`);
  else bad(`${reacs} nodos de reacción, se esperaban 6`);
}

console.log('\n=== 2) DISPARO: cada transición abre su interludio UNA vez ===');
const g = newGame();
g.startPlay();
{
  // --- Acto I→II: 'accept_q6' lo consume ENGINE.applyAction (hooks no llega):
  // el disparo en vivo es el watcher por estado del tick.
  g.applyAction('accept_q6');
  if (!g.flags.interludio_acto2) ok('accept_q6 (motor): el interludio aún no salta fuera de play');
  else bad('accept_q6 abrió el interludio sin pasar por el tick');
  tick(g);
  if (g.flags.interludio_acto2 === true && g.state === 'dialogue' && g.dlgKey === 'interludio_acto2_a') {
    ok('watcher por estado: accept_q6 → interludio_acto2_a abierto (una vez)');
  } else bad(`disparo acto2: flag=${String(g.flags.interludio_acto2)} state=${g.state} key=${g.dlgKey}`);
  const bn = bannerActo18F(g);
  if (bn && bn.texto === 'ACTO II — LAS NOTAS PERDIDAS') ok(`banner de acto activo: '${bn.texto}'`);
  else bad(`banner de acto ausente o incorrecto (${JSON.stringify(bn)})`);
  // ticks repetidos durante el diálogo: no re-abren ni duplican
  tick(g); tick(g);
  if (g.dlgKey === 'interludio_acto2_a') ok('ticks extra durante el diálogo: no re-abren');
  else bad('un tick extra cambió el diálogo en curso');
  const seen2 = walk(g);
  if (JSON.stringify(seen2) === JSON.stringify(['interludio_acto2_a', 'interludio_acto2_b', 'interludio_acto2_c', 'r18_reacc_acto2_brisa', 'r18_reacc_acto2_toln'])) {
    ok(`cadena acto2 navegable completa (${seen2.length} nodos: 3 del Eco + Brisa + Toln)`);
  } else bad(`cadena acto2 inesperada: ${seen2.join(' → ')}`);
  if (g.state === 'play' && !g.dlgKey) ok('el cierre del interludio devuelve al juego (state play)');
  else bad(`el interludio no devolvió al juego: state=${g.state} key=${g.dlgKey}`);
  g.globalT += 3; // > 2,5 s de vida del banner
  if (bannerActo18F(g) === null) ok('banner expirado tras 2,5 s (fade completo, sin estado residual)');
  else bad('el banner no expira');
  // repetir la aceptación + muchos ticks en play: NUNCA re-abre
  g.applyAction('accept_q6');
  for (let i = 0; i < 6; i++) tick(g);
  if (g.state === 'play' && !g.dlgKey) ok('repetir accept_q6 + 6 ticks: el interludio NO se re-abre (idempotente)');
  else bad(`repetición re-abrió el interludio: state=${g.state} key=${g.dlgKey}`);

  // --- Acto II→III: accept_q11 (handler VIVO en hooks) ---
  g.applyAction('accept_q11');
  tick(g);
  if (g.flags.interludio_acto3 === true && g.dlgKey === 'interludio_acto3_a' && g.state === 'dialogue') {
    ok('accept_q11 (hooks) → interludio_acto3_a abierto');
  } else bad(`disparo acto3: flag=${String(g.flags.interludio_acto3)} key=${g.dlgKey}`);
  const bn3 = bannerActo18F(g);
  if (bn3 && bn3.texto === 'ACTO III — EL CANTO AL REVÉS') ok(`banner acto III: '${bn3.texto}'`);
  else bad('banner del acto III ausente');
  const seen3 = walk(g);
  if (seen3.length === 5 && seen3[0] === 'interludio_acto3_a' && seen3[4] === 'r18_reacc_acto3_toln') ok('cadena acto3 navegable completa (5 nodos)');
  else bad(`cadena acto3 inesperada: ${seen3.join(' → ')}`);
  for (let i = 0; i < 6; i++) tick(g);
  if (g.state === 'play' && !g.dlgKey) ok('acto3: repetición no re-abre');
  else bad('acto3 se re-abrió');

  // --- Acto III→IV: accept_q14 (handler VIVO en hooks) ---
  g.applyAction('accept_q14');
  tick(g);
  if (g.flags.interludio_acto4 === true && g.dlgKey === 'interludio_acto4_a' && g.state === 'dialogue') {
    ok('accept_q14 (hooks) → interludio_acto4_a abierto');
  } else bad(`disparo acto4: flag=${String(g.flags.interludio_acto4)} key=${g.dlgKey}`);
  const seen4 = walk(g);
  if (seen4.length === 5 && seen4[0] === 'interludio_acto4_a' && seen4[4] === 'r18_reacc_acto4_toln') ok('cadena acto4 navegable completa (5 nodos)');
  else bad(`cadena acto4 inesperada: ${seen4.join(' → ')}`);
  for (let i = 0; i < 6; i++) tick(g);
  if (g.state === 'play' && !g.dlgKey) ok('acto4: repetición no re-abre');
  else bad('acto4 se re-abrió');
}

console.log('\n=== 3) RECUPERACIÓN y saves antiguos (watcher por estado) ===');
{
  // flag puesto + cinemática nunca vista (se cerró el juego a mitad) → re-abre UNA vez
  const gr = newGame();
  gr.startPlay();
  gr.questIdx = 13; gr.flags.q14 = true; gr.flags.interludio_acto4 = true; // sin _vista
  tick(gr);
  if (gr.dlgKey === 'interludio_acto4_a' && gr.state === 'dialogue') ok('recuperación: flag sin _vista → el interludio se re-encola al cargar');
  else bad(`recuperación fallida: key=${gr.dlgKey}`);
  walk(gr); // navega completa: el 1er avance marca _vista
  for (let i = 0; i < 5; i++) tick(gr);
  if (gr.state === 'play' && !gr.dlgKey) ok('tras marcar _vista, el interludio no vuelve a encolarse');
  else bad('la recuperación se repite con _vista ya marcada');
  // y con _vista YA puesta desde el save: ni siquiera abre
  const gr2 = newGame();
  gr2.startPlay();
  gr2.questIdx = 13; gr2.flags.q14 = true; gr2.flags.interludio_acto4 = true; gr2.flags.interludio_acto4_vista = true;
  for (let i = 0; i < 5; i++) tick(gr2);
  if (gr2.state === 'play' && !gr2.dlgKey) ok('flag + _vista ya puestas: sin recuperación (una sola vez por partida)');
  else bad(`con _vista se re-abrió: key=${gr2.dlgKey}`);

  // save antiguo a mitad del Acto II (q6 con questIdx 7): NO dispara
  const gv = newGame();
  gv.startPlay();
  gv.questIdx = 7; gv.flags.q6 = true;
  for (let i = 0; i < 5; i++) tick(gv);
  if (gv.state === 'play' && !gv.dlgKey && !gv.flags.interludio_acto2) ok('save antiguo a mitad del Acto II (idx 7): sin interludio fuera de sitio');
  else bad(`save antiguo disparó el interludio: key=${gv.dlgKey} flag=${String(gv.flags.interludio_acto2)}`);
}

console.log('\n=== 4) BARRERA DE LOS ALTARES: custodio vivo 1 vez en 10 s; muerto nunca ===');
{
  // --- costa: la Sirena (spawnea sola con loadMap) ---
  g.loadMap('costa', 26, 2);
  const sirena = g.enemies.find(e => e.etype === 'sirena');
  if (!sirena) bad('la Costa no spawneó a la Sirena (fixture rota)');
  else {
    g.globalT = 500; // línea base del cooldown
    g.player!.x = 36 * 16 + 8; g.player!.y = 27 * 16 + 8; // sobre el altar_mareas (36,27)
    tick(g);
    if (sirena.aggro && sirena.ai === 'persigue') ok('custodio vivo a ≤4 tiles del altar: aggro + persecución forzadas');
    else bad(`aggro no forzado: aggro=${String(sirena.aggro)} ai=${sirena.ai}`);
    if (g.bossActive && g.bossRef === sirena) ok('barra de jefe activada con el custodio (bossRef/bossActive)');
    else bad('barra de jefe no activada');
    if (toastsCon(g, 'se interpone entre tú y el Eco') === 1) ok('toast dramático: «La Marea Sin Nombre se interpone entre tú y el Eco»');
    else bad(`toast dramático incorrecto (${toastsCon(g, 'se interpone entre tú y el Eco')})`);
    // salir y volver a los 2 s del disparo: el cooldown de 8 s retiene
    g.player!.x = 10 * 16; g.player!.y = 10 * 16; tick(g); // fuera del radio
    g.globalT += 2;
    g.player!.x = 36 * 16 + 8; g.player!.y = 27 * 16 + 8; tick(g); // re-entrada
    if (toastsCon(g, 'se interpone entre tú y el Eco') === 1) ok('re-entrada a los 2 s: el cooldown de 8 s retiene el spam');
    else bad('el cooldown de 8 s no retuvo la re-entrada');
    // 10 s seguidos dentro del radio: flanco + cooldown → SOLO 1 disparo
    let picos = 0;
    for (let i = 1; i <= 10; i++) { g.globalT += 1; tick(g); picos = toastsCon(g, 'se interpone entre tú y el Eco'); }
    if (picos === 1) ok('10 s dentro del radio: exactamente 1 disparo (flanco + cooldown 8 s)');
    else bad(`10 s dentro del radio produjeron ${picos} disparos`);
  }
  // --- cumbres: Gólem YA DERROTADO → el watcher no hace nada ---
  const gc = newGame();
  gc.startPlay();
  gc.loadMap('cumbres', 25, 39);
  gc.flags.golemDefeated = true;
  const golem = gc.enemies.find(e => e.etype === 'golem');
  if (!golem) bad('las Cumbres no spawnearon al Gólem (fixture rota)');
  else {
    gc.globalT = 100;
    gc.player!.x = 24 * 16 + 8; gc.player!.y = 3 * 16 + 8; // sobre altar_cumbres (24,3)
    for (let i = 0; i < 12; i++) { tick(gc); gc.globalT += 1; }
    if (!golem.aggro && toastsCon(gc, 'se interpone') === 0) ok('jefe derrotado (flag): el watcher nunca interpone ni aggro');
    else bad(`con jefe muerto el watcher actuó: aggro=${String(golem.aggro)} toasts=${toastsCon(gc, 'se interpone')}`);
    // y si el flag se quita, vuelve a interponerse (el custodio sigue vivo en el mapa)
    delete gc.flags.golemDefeated;
    gc.player!.x = 10 * 16; gc.player!.y = 30 * 16; tick(gc); // fuera del radio
    gc.player!.x = 24 * 16 + 8; gc.player!.y = 3 * 16 + 8; tick(gc); // dentro
    if (golem.aggro && toastsCon(gc, 'se interpone') === 1) ok('sin flag de derrota: el custodio vivo vuelve a interponerse (1 vez)');
    else bad(`custodio vivo sin flag no actuó: aggro=${String(golem.aggro)}`);
  }
  // --- cripta: el Guardián Hueco (altar_c 19,4 · guardian 19,8) ---
  const gp = newGame();
  gp.startPlay();
  gp.loadMap('cripta', 19, 24);
  const guard = gp.enemies.find(e => e.etype === 'guardian');
  if (!guard) bad('la Cripta no spawneó al Guardián (fixture rota)');
  else {
    gp.globalT = 42;
    gp.player!.x = 19 * 16 + 8; gp.player!.y = 4 * 16 + 8;
    tick(gp);
    if (guard.aggro && toastsCon(gp, 'se interpone entre tú y el Eco') === 1) ok('cripta: el Guardián Hueco se interpone en el altar del Eco de la Voz');
    else bad(`cripta: watcher inoperante (aggro=${String(guard.aggro)})`);
  }
  // los 3 altares del contrato BARRERA_ALTARES_18F existen en sus mapas
  for (const a of BARRERA_ALTARES_18F) {
    if (MAPS[a.map].props.some(p => p.id === a.prop)) ok(`prop '${a.prop}' presente en '${a.map}'`);
    else bad(`prop '${a.prop}' NO existe en '${a.map}'`);
  }
}

console.log('\n=== 5) PERSISTENCIA: los flags interludio_* viajan en el save ===');
{
  g.save();
  const raw = store.get('ecos-aelthar-save');
  if (!raw) { bad('save() no escribió el guardado'); }
  else {
    const d = JSON.parse(raw) as { flags: Record<string, number | boolean> };
    const need = ['interludio_acto2', 'interludio_acto2_vista', 'interludio_acto3', 'interludio_acto3_vista', 'interludio_acto4', 'interludio_acto4_vista'];
    const missing = need.filter(k => d.flags[k] !== true);
    if (missing.length === 0) ok(`save() serializa las 6 flags del 18-f (${need.join(', ')})`);
    else bad(`flags ausentes en el save: ${missing.join(', ')}`);
    const g6 = newGame();
    g6.continueGame();
    const restored = need.filter(k => g6.flags[k] === true);
    if (restored.length === need.length) ok('continueGame restaura 6/6 flags del 18-f');
    else bad(`continueGame restauró ${restored.length}/${need.length}`);
    for (let i = 0; i < 6; i++) tick(g6);
    if (g6.state === 'play' && !g6.dlgKey) ok('tras continuar: ningún interludio se re-abre (flags ya puestas)');
    else bad(`continueGame re-abrió un interludio: key=${g6.dlgKey}`);
  }
}

console.log('\n================================');
console.log(fails === 0 ? 'SMOKE INTERLUDIOS: TODO OK' : `SMOKE INTERLUDIOS: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
