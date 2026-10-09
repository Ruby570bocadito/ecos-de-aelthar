// ============================================================
// R13 «La carta» — Smoke del ACTO V fase 1 sin navegador
// ÉPOCA TERNARIA (exigida por la biblia en R13: «los smokes de época
// ternaria se escriben en R13, no después») + cadena q17 completa.
// Stub DOM/Audio (patrón smoke_acto4) + Game real + hooks reales:
//   1) ESTRUCTURA: mapa cuna (baseEpoch 'aun', diffs del primer día),
//      q17, brújula 16, KEY_ITEM carta, fragment2, escalera gated.
//   2) tileAt ternario: Cuna invierte la convención; mapas viejos intactos.
//   3) epochSwitch ternario: gate Fragmento 2, estrena UNA vez, el Aún no
//      se fuga a mapas viejos, binario intacto en bosque (regresión).
//   4) Cadena q17: carta → aceptar → bajar (paso auto por loadMap) →
//      fragmento → Q/estrena (cualquier orden) → informe → pago UNA vez.
//   5) Cofre del primer día (needPresent) + ritmo del Aún (acto5Tick).
//   6) save/load con 'aun' + reacciones de Brisa + rutas de capas intactas.
// Ejecutar: bun scripts/smoke_acto5.ts
// ============================================================

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
    canvas: null, imageSmoothingEnabled: false,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    drawImage: noop, fillText: noop, setTransform: noop, rect: noop, clip: noop,
    drawFocusIfNeeded: noop,
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    createPattern: () => null, measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData: noop,
  } as unknown as CanvasRenderingContext2D;
};
const makeCanvas = (): HTMLCanvasElement => ({
  width: 300, height: 150, style: {},
  getContext: (_: string) => ctxStub(),
  addEventListener: noop, removeEventListener: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
} as unknown as HTMLCanvasElement);

const store = new Map<string, string>();
(globalThis as AnyP).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
};
const listeners: AnyP = {};
(globalThis as AnyP).window = {
  addEventListener: (t: string, f: unknown) => { (listeners[t] ??= []).push(f); },
  removeEventListener: noop, innerWidth: 1280, innerHeight: 720,
  setInterval: () => 0, clearInterval: noop, setTimeout: () => 0,
  AudioContext: undefined, webkitAudioContext: undefined,
} as unknown as Window & typeof globalThis;
(globalThis as AnyP).document = {
  createElement: () => makeCanvas(), getElementById: () => makeCanvas(),
  addEventListener: noop, body: stub(), documentElement: stub(),
} as unknown as Document;
(globalThis as AnyP).performance = { now: () => Date.now() };
(globalThis as AnyP).requestAnimationFrame = () => 0;
(globalThis as AnyP).cancelAnimationFrame = noop;

const { Game } = await import('../src/game/engine');
const { audio } = await import('../src/game/audio');
(audio as unknown as { init: () => void; ctx: unknown }).init = () => {};
(audio as unknown as { ctx: unknown }).ctx = stub();
const { QUESTS, QUEST_COMPASS, KEY_ITEMS, DIALOGUES, getDialogue } =
  await import('../src/game/data');
const { MAPS, tileAt } = await import('../src/game/maps');
const { acto5Tick } = await import('../src/game/acto5');
import type { DialogueCtx } from '../src/game/types';

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

type G = InstanceType<typeof Game>;
/** Partida situada al FINAL del Acto IV (epílogo cantado, acto4Done). */
function newActo5(): G {
  const g = new Game(makeCanvas());
  g.newGame('Prueba5', 'alba');
  g.questIdx = 15; g.questStep = 1;        // q16 (epílogo) en su paso final
  g.flags.acto4Done = true;
  g.flags.heraldoDerrotado = true;
  return g;
}
/** Dispara una acción pasando por el fallback real del motor (applyAction → hooks). */
function act(g: G, a: string) { g.applyAction(a); }
/** Ruteo directo del envoltorio (capa R13 → 16-a → 13-a → base). */
function route(nid: string, questIdx: number, questStep: number, flags: Record<string, number | boolean> = {}): string {
  const ctx: DialogueCtx = { questIdx, questStep, flags, companion: false };
  return getDialogue(nid, ctx);
}
const TILE = 16;

console.log('=== 1) ESTRUCTURA: mapa cuna, q17, brújula, carta, fragmento2, escalera gated ===');
{
  const cuna = MAPS['cuna'];
  if (!cuna) { bad('MAPS.cuna ausente'); }
  else {
    ok(`MAPS.cuna: '${cuna.name}' ${cuna.w}×${cuna.h}, baseEpoch '${cuna.baseEpoch}'`);
    if (cuna.baseEpoch === 'aun') ok('baseEpoch aun: la época ternaria nace SOLO en la Cuna');
    else bad(`baseEpoch incorrecto: ${String(cuna.baseEpoch)}`);
    if (cuna.w === 46 && cuna.h === 36 && cuna.rows.length === 36 && cuna.rows.every(r => r.length === 46))
      ok('rejilla íntegra: 36 filas × 46 columnas');
    else bad('rejilla de la Cuna incompleta');
    // frontera sellada: el borde NO deja escapar al Portador
    const sealed = cuna.rows.every((r, y) => r.split('').every((ch, x) =>
      (x < 2 || y < 2 || x >= 44 || y >= 34) ? ch === '#' : true));
    if (sealed) ok('frontera sellada: bordes íntegramente de muro (el sótano no tiene fugas)');
    else bad('la Cuna tiene fugas en el borde');
    if (cuna.epochDiffs.length >= 25) ok(`diffs del primer día: ${cuna.epochDiffs.length} (agua del lago + flores + musgo)`);
    else bad(`diffs del primer día insuficientes: ${cuna.epochDiffs.length}`);
    if (cuna.npcs.length === 0) ok('sin NPCs: la Cuna habla por ecos y carteles (Naia llega en R14)');
    else bad('la Cuna no debería tener NPCs en fase 1');
    const frag = cuna.props.find(p => p.kind === 'fragment2');
    if (frag && frag.id === 'fragmento_cn') ok(`segundo Fragmento en (${frag.x},${frag.y}) kind 'fragment2'`);
    else bad('prop fragment2 ausente o mal id');
    const sanc = cuna.props.find(p => p.kind === 'sanctuary');
    if (sanc) ok(`santuario de la Cuna en (${sanc.x},${sanc.y})`);
    else bad('santuario de la Cuna ausente');
    const stairs = cuna.exits[0];
    if (stairs && stairs.to === 'cripta') ok(`escalera de vuelta a la Sala: zona (${stairs.x},${stairs.y}) → cripta (${stairs.tx},${stairs.ty})`);
    else bad('salida de la Cuna a la cripta rota');
    const criptaExit = MAPS['cripta'].exits.find(e => e.to === 'cuna');
    if (criptaExit && criptaExit.needFlag === 'acto5CunaAbierta')
      ok(`escalera gated en la cripta (needFlag '${criptaExit.needFlag}')`);
    else bad('la escalera cripta→cuna no está gated por acto5CunaAbierta');
    const cofreDia = cuna.chests.find(c => c.needPresent);
    if (cofreDia) ok(`cofre del primer día '${cofreDia.id}' (needPresent, +${cofreDia.gold} coronas)`);
    else bad('cofre needPresent ausente');
    if (cuna.spawns.length > 0 && cuna.spawns.every(s => s.needPresent))
      ok(`fauna needPresent ×${cuna.spawns.length}: los neumos nacen con el primer día`);
    else bad('la fauna de la Cuna no es needPresent');
  }
  const q17 = QUESTS.find(q => q.id === 'q17');
  if (q17 && q17.steps.length === 4) ok(`q17 '${q17.name}': 4 pasos (carta → Cuna → Fragmento+estrena → informe)`);
  else bad('q17 ausente o con pasos incompletos');
  if (QUESTS.length === 18) ok(`QUESTS.length = ${QUESTS.length} (q1..q18, Acto V fases 1+2 incluidas)`);
  else bad(`QUESTS.length = ${QUESTS.length}, se esperaban 18 (R14 añadió q18)`);
  if (QUEST_COMPASS[16] && QUEST_COMPASS[16].length === 4) ok('brújula 16: objetivos de q17 definidos');
  else bad('brújula de q17 incompleta');
  if (KEY_ITEMS['laCartaVesh' as keyof typeof KEY_ITEMS]) ok('KEY_ITEM laCartaVesh definido (el gancho material)');
  else bad('falta KEY_ITEM laCartaVesh');
  for (const nid of ['acto5_guarda_carta', 'acto5_guarda_baja', 'acto5_guarda_estrena', 'acto5_guarda_informe', 'acto5_guarda_post', 'voz_fragmento2', 'acto5_brisa_reaccion']) {
    if (DIALOGUES[nid]) ok(`nodo '${nid}' presente`);
    else bad(`falta el nodo '${nid}'`);
  }
}

console.log('\n=== 2) tileAt TERNARIO: la Cuna invierte la convención; los viejos intactos ===');
{
  const cuna = MAPS['cuna'];
  // el lago nace con el primer día: '~' en presente, piedra en aun
  const agua = cuna.epochDiffs.find(d => d.char === '~');
  if (agua) {
    const aun = tileAt(cuna, cuna.rows, agua.x, agua.y, 'aun');
    const pre = tileAt(cuna, cuna.rows, agua.x, agua.y, 'presente');
    if (aun === ':' && pre === '~') ok(`lago ternario (${agua.x},${agua.y}): aun=':' → presente='~' (el agua nace con el tiempo)`);
    else bad(`lago: aun='${aun}' presente='${pre}'`);
  } else bad('no hay diffs de agua en la Cuna');
  // las flores solo existen en presente
  const flor = cuna.epochDiffs.find(d => d.char === ',');
  if (flor) {
    const aun = tileAt(cuna, cuna.rows, flor.x, flor.y, 'aun');
    const pre = tileAt(cuna, cuna.rows, flor.x, flor.y, 'presente');
    if (aun === ':' && pre === ',') ok(`flores ternarias (${flor.x},${flor.y}): aun=':' → presente=','`);
    else bad(`flores: aun='${aun}' presente='${pre}'`);
  }
  // REGRESIÓN: lunaris conserva la convención histórica (diffs en pasado)
  const lun = MAPS['lunaris'];
  const dLun = lun.epochDiffs[0];
  const lPre = tileAt(lun, lun.rows, dLun.x, dLun.y, 'presente');
  const lPas = tileAt(lun, lun.rows, dLun.x, dLun.y, 'pasado');
  if (lPre !== dLun.char && lPas === dLun.char) ok(`regresión lunaris: presente base, pasado aplica diffs (${dLun.x},${dLun.y})`);
  else bad(`regresión lunaris rota: presente='${lPre}' pasado='${lPas}'`);
  if (!lun.baseEpoch) ok('mapas viejos sin baseEpoch: convención histórica intacta');
  else bad('un mapa viejo define baseEpoch (no debería)');
}

console.log('\n=== 3) ÉPOCA TERNARIA: gate del Fragmento 2, estrena UNA vez, sin fugas ===');
{
  const g = newActo5();
  g.player!.hasEcho = true;
  // entrar a la Cuna cargando 'presente' de la superficie: aterriza en 'aun'
  g.loadMap('cuna', 23, 5);
  if (g.mapId === 'cuna' && g.epoch === 'aun') ok('bajar a la Cuna con presente: aterriza en AÚN (el tiempo no estrenado te recibe)');
  else bad(`entrada: map=${g.mapId} epoch=${g.epoch}`);
  // situar la cadena en el paso del Fragmento (q17 aceptada y descendida:
  // patrón smoke_acto4 — la sección 3 prueba el MOTOR, la 4/5 la cadena)
  g.questIdx = 16; g.questStep = 2;
  // sin Fragmento 2: Q no estrena
  g.epochSwitch();
  if (g.epoch === 'aun') ok('Q sin Fragmento de la Cuna: el tiempo no se estrena (gate)');
  else bad(`Q sin fragmento cambió la época: ${g.epoch}`);
  // sin hasEcho (imposible en progresión, pero el gate del motor manda)
  const g2 = newActo5();
  g2.loadMap('cuna', 23, 5);
  g2.player!.hasEcho = false;
  g2.epochSwitch();
  if (g2.epoch === 'aun') ok('Q sin hasEcho: veto del motor intacto también en la Cuna');
  else bad(`sin hasEcho cambió época: ${g2.epoch}`);
  // despierta el Fragmento → Q estrena UNA vez
  act(g, 'acto5_fragmento');
  if (g.flags.cunaFragmento) ok('acto5_fragmento: el segundo Fragmento despierta (flag)');
  else bad('acto5_fragmento no fijó cunaFragmento');
  if (g.questIdx === 16 && g.questStep === 2) ok('paso 2 activo (fragmento despierto, día sin estrenar)');
  else bad(`paso tras fragmento: idx=${g.questIdx} step=${g.questStep}`);
  g.epochSwitch();
  if (g.epoch === 'presente' && g.flags.cunaEstrenada) ok('Q → presente: LA ESTRENA del primer día (flag cunaEstrenada)');
  else bad(`estrena: epoch=${g.epoch} flag=${String(g.flags.cunaEstrenada)}`);
  if (g.questIdx === 16 && g.questStep === 3) ok('estrena + fragmento: paso 2→3 (cualquier orden completa)');
  else bad(`paso tras estrena: step=${g.questStep}`);
  const stepPre = g.questStep;
  // irse al Aún y volver: NO re-estrena (la flag manda)
  g.epochSwitch(); // → aun
  if (g.epoch === 'aun') ok('Q de vuelta al Aún (tras estrenar, ambos estados conviven)');
  else bad(`vuelta al aún: ${g.epoch}`);
  g.epochSwitch(); // → presente otra vez
  if (g.epoch === 'presente' && g.questStep === stepPre) ok('re-estrenar NO dispara la escena (guard cunaEstrenada, paso intacto)');
  else bad(`re-estrena: epoch=${g.epoch} step=${g.questStep} (pre ${stepPre})`);
  // el Aún NO se fuga a mapas viejos
  g.epochSwitch(); // → aun
  g.loadMap('lunaris', 25, 20);
  if (g.mapId === 'lunaris' && g.epoch === 'presente') ok('salir de la Cuna en Aún: lunaris normaliza a presente (el Aún nunca se fuga)');
  else bad(`fuga del Aún: map=${g.mapId} epoch=${g.epoch}`);
  // binario intacto (regresión smoke_timeskip)
  g.epochSwitch();
  if (g.epoch === 'pasado') ok('regresión: lunaris alterna presente→pasado (binario intacto)');
  else bad(`binario roto: ${g.epoch}`);
  g.epochSwitch();
  if (g.epoch === 'presente') ok('regresión: pasado→presente (binario intacto)');
  else bad(`binario roto (2): ${g.epoch}`);
  // 'pasado' anómalo en la Cuna ya estrenada → 'aun'
  g.epoch = 'pasado';
  g.loadMap('cuna', 23, 5);
  if (g.mapId === 'cuna' && g.epoch === 'aun') ok('entrada anómala con pasado (post-estrena): normaliza a Aún');
  else bad(`normalización anómala: ${g.epoch}`);
  // la Cuna NUNCA guarda 'pasado': re-entrada conserva la hora (estrenada + presente)
  g.epoch = 'presente';
  g.loadMap('cuna', 23, 5);
  if (g.epoch === 'presente') ok('re-entrada post-estrena con presente: conserva la hora (el primer día ya existió)');
  else bad(`re-entrada: ${g.epoch}`);
}

console.log('\n=== 4) CADENA q17: carta → aceptar → bajar → informe → pago UNA vez ===');
{
  const g = newActo5();
  g.player!.hasEcho = true;
  // gancho: la Guarda lee la carta (solo tras el epílogo del Acto IV)
  if (route('guarda', 15, 1, { acto4Done: true, heraldoDerrotado: true }) === 'acto5_guarda_carta')
    ok('gancho: la Guarda rutea la carta tras acto4Done (sin q17)');
  else bad('el gancho de la carta no rutea');
  if (route('guarda', 15, 1, { heraldoDerrotado: true }) !== 'acto5_guarda_carta')
    ok('sin acto4Done: la capa del Acto IV conserva gratitud/silencio (la carta no se adelanta)');
  else bad('la carta se ofrece sin el epílogo hecho');
  act(g, 'accept_q17');
  if (g.questIdx === 16 && g.questStep === 1 && g.flags.q17) ok('accept_q17: idx 16, paso 1 (la conversación completa el paso 0)');
  else bad(`accept_q17: idx=${g.questIdx} step=${g.questStep} flag=${String(g.flags.q17)}`);
  act(g, 'accept_q17'); // idempotente
  if (g.questIdx === 16 && g.questStep === 1) ok('accept_q17 idempotente (re-lectura no rebota pasos)');
  else bad(`idempotencia: step=${g.questStep}`);
  if (route('guarda', 16, 1, { q17: true }) === 'acto5_guarda_baja') ok('ruta paso 1: la Guarda abre la escalera');
  else bad('ruta paso 1 rota');
  act(g, 'acto5_bajar');
  if (g.mapId === 'cuna' && g.epoch === 'aun' && g.flags.acto5CunaAbierta) ok('acto5_bajar: desciende a la Cuna en AÚN + escalera abierta para siempre');
  else bad(`bajar: map=${g.mapId} epoch=${g.epoch} flag=${String(g.flags.acto5CunaAbierta)}`);
  if (g.questIdx === 16 && g.questStep === 2) ok('pisar la Cuna completa el descenso (loadMap avanza paso 1→2)');
  else bad(`paso tras bajar: step=${g.questStep}`);
  // informar SIN estrenar: la Guarda empuja a estrenar (no paga)
  if (route('guarda', 16, 2, { q17: true, cunaFragmento: true }) === 'acto5_guarda_estrena')
    ok('ruta paso 2 sin estrenar: la Guarda pide el primer día');
  else bad('ruta paso 2 (sin estrenar) rota');
  // estrena el jugador (Q), el Fragmento ya despierto: cualquier orden completa
  act(g, 'acto5_fragmento');
  g.epochSwitch(); // → presente + estrena
  if (g.questStep === 3) ok('fragmento→Q: paso 2→3 (estrena avanza)');
  else bad(`paso tras Q: ${g.questStep}`);
  if (route('guarda', 16, 3, { q17: true, cunaFragmento: true, cunaEstrenada: true }) === 'acto5_guarda_informe')
    ok('ruta paso 3: el informe de la Guarda');
  else bad('ruta paso 3 rota');
  const goldPre = g.player!.gold, potPre = g.player!.potions;
  act(g, 'acto5_report');
  if (g.flags.acto5Paid17 && g.flags.acto5Fase1) ok('acto5_report: pago + fase 1 del Acto V cerrada');
  else bad(`report: paid=${String(g.flags.acto5Paid17)} fase1=${String(g.flags.acto5Fase1)}`);
  if (g.player!.gold === goldPre + 150 && g.player!.potions === potPre + 1)
    ok('recompensa q17: +150 coronas y +1 poción (tarifa del Acto IV)');
  else bad(`recompensa q17: oro=${g.player!.gold} (esperado ${goldPre + 150}) poc=${g.player!.potions}`);
  act(g, 'acto5_report'); // anti-doble-pago
  if (g.player!.gold === goldPre + 150) ok('anti-doble-pago q17: repetir el informe no paga dos veces');
  else bad('acto5_report pagó dos veces');
  // R14: tras el pago la 4ª capa rutea a la OFERTA de la Ciudadela (acto5_guarda_ciud);
  // acto5_guarda_post (el gancho pasivo del norte) queda bajo la capa para saves raros.
  if (route('guarda', 16, 3, { q17: true, acto5Fase1: true, cunaFragmento: true, cunaEstrenada: true }) === 'acto5_guarda_ciud')
    ok('post-pago: la Guarda OFRECE la Ciudadela (gancho R14 activo)');
  else bad('ruta post-pago rota');
}

console.log('\n=== 5) ORDEN INVERSO (Q primero, fragmento después) + cofre del primer día + ritmo ===');
{
  const g = newActo5();
  g.player!.hasEcho = true;
  act(g, 'accept_q17');
  act(g, 'acto5_bajar');
  act(g, 'acto5_fragmento');
  // ritmo del Aún: caminar AL RITMO sobre el camino '=' suelta notas
  g.setState('play');
  const p = g.player!;
  p.x = 23 * TILE + 8; p.y = 18 * TILE + 8; // cruce de caminos (pathH y18 × pathV x23)
  const partPre = g.particles.length;
  acto5Tick(g, 1 / 60);
  p.x += TILE; acto5Tick(g, 1 / 60);
  p.x += TILE; acto5Tick(g, 1 / 60);
  p.x += TILE; acto5Tick(g, 1 / 60); // 3 tiles de camino = una nota
  if (g.particles.length > partPre) ok('ritmo del Aún: 3 tiles al ritmo sobre el camino sueltan una nota');
  else bad('el ritmo del Aún no suena (acto5Tick sin partículas)');
  const fueraPre = g.particles.length;
  p.x = 12 * TILE + 8; p.y = 12 * TILE + 8; // piedra desnuda (fuera del camino)
  acto5Tick(g, 1 / 60);
  p.x += TILE; acto5Tick(g, 1 / 60);
  if (g.particles.length === fueraPre) ok('fuera del camino el compás se rompe (la Cuna no improvisa)');
  else bad('el ritmo suena fuera del camino');
  // cofre del primer día: no existe en Aún, nace en presente
  const cofre = MAPS['cuna'].chests.find(c => c.needPresent)!;
  p.x = cofre.x * TILE + 8; p.y = cofre.y * TILE + 8;
  g.epoch = 'aun';
  if (g.nearestInteract()?.kind !== 'chest') ok('cofre del primer día en AÚN: no existe (needPresent)');
  else bad('el cofre del primer día existe en el Aún');
  g.epochSwitch(); // → presente (estrena)
  const best = g.nearestInteract();
  if (best?.kind === 'chest') ok('estrenar el día: el cofre del primer día NACE (interactuable)');
  else bad(`cofre en presente: kind=${String(best?.kind)}`);
  if (g.questStep === 3) ok('orden inversa completa: fragmento→Q también avanza 2→3');
  else bad(`paso (orden inverso): ${g.questStep}`);
  // la estrena nace fauna needPresent EN EL ACTO
  const vivos = g.enemies.filter(e => !e.dead).length;
  if (vivos >= 3) ok(`la estrena nace la fauna del primer día EN EL ACTO (${vivos} neumos)`);
  else bad(`fauna tras estrena: ${vivos} vivos`);
}

console.log('\n=== 6) SAVE/LOAD con AÚN + Brisa + rutas de capas intactas ===');
{
  const g = newActo5();
  g.player!.hasEcho = true;
  act(g, 'accept_q17');
  act(g, 'acto5_bajar');
  act(g, 'acto5_fragmento');
  g.player!.x = 23 * TILE + 8; g.player!.y = 20 * TILE + 8;
  g.save();
  const g2 = new Game(makeCanvas());
  g2.continueGame();
  if (g2.mapId === 'cuna' && g2.epoch === 'aun' && g2.flags.cunaFragmento && g2.flags.q17)
    ok('save/load en la Cuna: mapa, época AÚN y flags del Fragmento viajan byte a byte');
  else bad(`load: map=${g2.mapId} epoch=${g2.epoch} frag=${String(g2.flags.cunaFragmento)}`);
  // save en presente (post-estrena) también restaura
  act(g2, 'acto5_fragmento'); // ya estaba (idempotente)
  g2.epochSwitch(); // estrena
  g2.save();
  const g3 = new Game(makeCanvas());
  g3.continueGame();
  if (g3.mapId === 'cuna' && g3.epoch === 'presente' && g3.flags.cunaEstrenada)
    ok('save/load post-estrena: el primer día ya existió y se recuerda');
  else bad(`load post-estrena: map=${g3.mapId} epoch=${g3.epoch}`);
  // Brisa reacciona UNA vez tras el Fragmento (durante q17)
  const rutaBrisa = route('brisa', 16, 3, { q17: true, cunaFragmento: true });
  if (rutaBrisa === 'acto5_brisa_reaccion') ok('Bisa reacciona al norte que respira (ruta única en q17)');
  else bad(`brisa: ${rutaBrisa}`);
  const rutaBrisa2 = route('brisa', 16, 3, { q17: true, cunaFragmento: true, acto5Brisa: true });
  if (rutaBrisa2 !== 'acto5_brisa_reaccion') ok('flag acto5Brisa: la reacción no se repite');
  else bad('la reacción de Brisa se repite');
  // regresión del envoltorio en capas: Acto I, III y IV intactos a través de R13 → 16-a → 13-a → base
  if (route('brisa', 0, 0) === 'brisa_intro') ok('envoltorio R13: delegación base intacta (brisa q0 → brisa_intro)');
  else bad(`delegación base rota: ${route('brisa', 0, 0)}`);
  if (route('mara', 5, 0) === 'mara_intro') ok('envoltorio R13: delegación Acto III intacta (mara q5 → mara_intro)');
  else bad(`delegación Acto III rota: ${route('mara', 5, 0)}`);
  if (route('toln', 13, 0, { acto2Done: true, acto3Done: true }) === 'acto4_toln_cam')
    ok('envoltorio R13: la capa del Acto IV intacta (toln q13 → campana)');
  else bad(`capa del Acto IV rota: ${route('toln', 13, 0, { acto2Done: true, acto3Done: true })}`);
  if (route('guarda', 14, 0, { acto3Done: true }) === 'acto4_guarda_intro')
    ok('envoltorio R13: la Guarda conserva su ruta del Acto IV (intro de q15)');
  else bad(`guarda Acto IV rota: ${route('guarda', 14, 0, { acto3Done: true })}`);
  // la Cuna no entra en el routeo de diálogo con épocas raras: 'aun' viaja en flags, no en rutas
  if (route('guarda', 16, 2, { q17: true }) === 'acto5_guarda_estrena') ok('saves raros (s2 sin flags): la Guarda empuja a estrenar');
  else bad('ruta de save raro rota');
}

console.log(fails === 0 ? '\nSMOKE ACTO 5 (R13 «La carta»): TODO OK' : `\nSMOKE ACTO 5: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
