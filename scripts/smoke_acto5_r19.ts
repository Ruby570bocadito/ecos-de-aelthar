// ============================================================
// 19-f (acto 5 narrativa) — Smoke «LA ÚLTIMA NOTA» sin navegador
// Stub DOM/Audio (patrón de scripts/smoke_timeskip.ts) + Game real:
//  (1) 3 quests bien formadas + COMPASS_ACTO5 (claves 16/17/18) + 0 colisiones
//      de claves con DIALOGUES/MEMORIES/KEY_ITEMS existentes,
//  (2) validación de GRAFO COMPLETO: todo next/options[].next de los 37 nodos
//      apunta a un nodo existente en D_ACTO5 ∪ INTERLUDIOS_ACTO5; tonos válidos
//      (ToneKind types.ts:18); textos/puertas/nombres no vacíos,
//  (3) flujo: watcher (A) del Heraldo → accept_q17 → interludio_acto5_a
//      (encolado → apertura → navegación completa),
//  (4) intro de la Ciudadela + cruce del umbral (q17 0→1→q18) sobre un mapa
//      'ciudadela' simulado (props acto5_puerta + acto5_s1..s3),
//  (5) sellos vía dynNodes['voz_fragment'] (E real del motor) → 3/3 →
//      interludio_acto5_b → elección MORAL (despertar / tregua «aún no» /
//      apagar en partida limpia) → q19,
//  (6) veshDefeated → epílogo del camino UNA vez (2ª llamada no-op), pago de
//      q19, Memoria VIII sin doble otorgamiento, toast FIN VERDADERO,
//  (7) acto5TickR19 600 frames en estados play/dialogue/pause sin NaN.
// Ejecutar: bun scripts/smoke_acto5_r19.ts
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

// Simulación EXACTA del cableado del integrador (puntos 1-3 de la cabecera):
// push de misiones + merge de nodos/memoria/objeto clave ANTES de crear juegos.
const { QUESTS, DIALOGUES, MEMORIES, KEY_ITEMS } = await import('../src/game/data');
const {
  QUESTS_ACTO5, COMPASS_ACTO5, D_ACTO5, INTERLUDIOS_ACTO5, MEMORIA_ACTO5, KEY_ITEM_ACTO5,
  acto5TickR19, acto5ActionR19, acto5CaminoR19, dispararActo5,
} = await import('../src/game/acto5_narrativa_r19');
const preD = new Set(Object.keys(DIALOGUES));
const preM = new Set(Object.keys(MEMORIES));
const preK = new Set(Object.keys(KEY_ITEMS));
const preQ = QUESTS.length;
// R19-int: el wiring 1/3 YA es real — data.ts hace los pushes (q17/q18/q19 en
// índices 19/20/21, tras las secundarias sq4/sq5/sq6 de 19-a en 16/17/18) y el
// Object.assign de DIALOGUES/MEMORIES/KEY_ITEMS. Aquí ya NO se duplica.

// wiring 4 (simulado): la delegación real vive DENTRO de hooks.handleCustomAction
// (el integrador añade `if (acto5ActionR19(g, action)) return true;`). Aquí la
// simulamos sobre Game.prototype.applyAction para que los onEnd/options de los
// nodos recorran el camino REAL del motor (advanceDialogue → applyAction).
const GameProto = Game as unknown as { prototype: { applyAction: (this: G, action: string) => void } };
const origApply = GameProto.prototype.applyAction;
GameProto.prototype.applyAction = function (this: G, action: string) {
  if (acto5ActionR19(this, action)) return;
  origApply.call(this, action);
};

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

type G = InstanceType<typeof Game>;
function newGame(): G {
  const g = new Game(makeCanvas());
  g.newGame('Prueba', 'alba');
  g.startPlay();
  return g;
}
const DT = 1 / 60;
function tick(g: G, n = 1, secsPer = DT) {
  for (let i = 0; i < n; i++) acto5TickR19(g, secsPer);
}
function toastHas(g: G, sub: string): boolean {
  return g.toasts.some(t => t.text.includes(sub));
}
/** Avanza el diálogo abierto: rellena el texto y llama a advanceDialogue. */
function adv(g: G): void {
  if (!g.dlgNode) return;
  g.dlgCharT = g.dlgNode.text.length;
  g.advanceDialogue();
}
/** Navega la cadena abierta hasta cerrar (máx 40 saltos anti-bucle). Si se
 *  pasa `elegir`, fija dlgSel en el PRIMER nodo con opciones suficientes. */
function chain(g: G, elegir?: number): number {
  let pasos = 0;
  for (let i = 0; i < 40; i++) {
    if (!g.dlgKey || !g.dlgNode) break;
    if (elegir !== undefined && g.dlgNode.options && g.dlgNode.options.length > elegir) {
      g.dlgSel = elegir;
    }
    adv(g);
    pasos++;
  }
  return pasos;
}
/** Mapa 'ciudadela' simulado (solo hace falta props para el tick del 19-f). */
function fakeCiudadela(sellos: [string, number, number][], puerta?: [number, number]) {
  return {
    id: 'ciudadela', name: 'Ciudadela de Vesh', subtitle: '', w: 44, h: 34, rows: [],
    epochDiffs: [], music: 'crypt', npcs: [], chests: [], echoes: [], spawns: [], exits: [],
    props: [
      ...sellos.map(([id, x, y]) => ({ id, kind: 'fragment' as const, x, y })),
      ...(puerta ? [{ id: 'acto5_puerta', kind: 'gate' as const, x: puerta[0], y: puerta[1] }] : []),
    ],
  } as unknown as import('../src/game/types').MapDef;
}

console.log('=== 1) Estructura: quests, brújula, colisiones y GRAFO COMPLETO ===');
{
  if (QUESTS.length === 22) ok(`QUESTS integradas: ${preQ} cargadas de data.ts (q1..q16 + q17..q19 Acto V + sq4..sq6 = 22)`);
  else bad(`QUESTS.length = ${QUESTS.length} (esperado 22 tras la integración)`);
  if (QUESTS[16]?.id === 'q17' && QUESTS[17]?.id === 'q18' && QUESTS[18]?.id === 'q19')
    ok('ids en orden: q17 (idx 16), q18 (idx 17), q19 (idx 18) — como hard-codea el módulo');
  else bad(`ids/tipo: ${QUESTS[16]?.id}/${QUESTS[17]?.id}/${QUESTS[18]?.id}`);
  const qsOk = QUESTS_ACTO5.every(q => q.id && q.name && q.steps.length > 0 && q.steps.every(s => s.length > 8));
  if (qsOk) ok('3 quests bien formadas (id, nombre, pasos con texto)');
  else bad('alguna quest mal formada');

  const ck = [16, 17, 18];
  const compOk = ck.every(k => Array.isArray(COMPASS_ACTO5[k]) && COMPASS_ACTO5[k].length > 0 &&
    COMPASS_ACTO5[k].every(t => t.npc || t.etype || t.prop || t.lamp || t.map));
  if (compOk) ok('COMPASS_ACTO5: claves 16/17/18 con objetivos con formato CompassTarget');
  else bad('COMPASS_ACTO5 mal formada');

  const colD = Object.keys(D_ACTO5).filter(k => preD.has(k));
  const colI = Object.keys(INTERLUDIOS_ACTO5).filter(k => preD.has(k));
  const colM = Object.keys(MEMORIA_ACTO5).filter(k => preM.has(k));
  const colK = Object.keys(KEY_ITEM_ACTO5).filter(k => preK.has(k));
  // R19-int: el Object.assign de data.ts ya registró TODO → los nodos deben
  // ESTAR (presencia), no ausentes (la aserción pre-integración era la inversa).
  const faltaD = Object.keys(D_ACTO5).filter(k => !preD.has(k));
  const faltaI = Object.keys(INTERLUDIOS_ACTO5).filter(k => !preD.has(k));
  const faltaM = Object.keys(MEMORIA_ACTO5).filter(k => !preM.has(k));
  const faltaK = Object.keys(KEY_ITEM_ACTO5).filter(k => !preK.has(k));
  if (!faltaD.length && !faltaI.length && !faltaM.length && !faltaK.length)
    ok('integración real: todos los nodos/memoria/item registrados en DIALOGUES/MEMORIES/KEY_ITEMS');
  else bad(`NO registrados por data.ts: ${[...faltaD, ...faltaI, ...faltaM, ...faltaK].join(',')}`);

  const nD = Object.keys(D_ACTO5).length, nI = Object.keys(INTERLUDIOS_ACTO5).length;
  const total = nD + nI;
  if (total >= 30) ok(`nodos de diálogo del Acto V: ${nD} (D_ACTO5) + ${nI} (INTERLUDIOS_ACTO5) = ${total} (≥30)`);
  else bad(`solo ${total} nodos (se pedían ≥30)`);

  // GRAFO COMPLETO: todo destino existe dentro del propio módulo
  const propio = new Set([...Object.keys(D_ACTO5), ...Object.keys(INTERLUDIOS_ACTO5)]);
  const TONES = ['empatico', 'pragmatico', 'sarcastico', 'amenazante'];
  let rotos = 0, tonosMalos = 0, textosVacios = 0;
  const destinos: string[] = [];
  for (const [k, n] of [...Object.entries(D_ACTO5), ...Object.entries(INTERLUDIOS_ACTO5)]) {
    if (!n.name || !n.portrait || !n.text || n.text.length < 20) { textosVacios++; destinos.push(k + ':vacio'); }
    if (n.next) destinos.push(`${k}.next→${n.next}`);
    if (n.onEnd && typeof n.onEnd !== 'string') { rotos++; destinos.push(k + ':onEnd'); }
    if (n.action && typeof n.action !== 'string') { rotos++; destinos.push(k + ':action'); }
    for (const o of n.options ?? []) {
      if (o.next) destinos.push(`${k}.opt→${o.next}`);
      if (o.tone && !TONES.includes(o.tone)) { tonosMalos++; destinos.push(`${k}:tone:${o.tone}`); }
      if (!o.text) { textosVacios++; destinos.push(k + ':optTexto'); }
    }
  }
  const faltan = destinos.filter(d => {
    const m = /→(.+)$/.exec(d);
    return m ? !propio.has(m[1]) : false;
  });
  if (!faltan.length && !rotos && !tonosMalos && !textosVacios)
    ok(`grafo íntegro: ${destinos.filter(d => d.includes('→')).length} aristas next todas resueltas · tonos válidos · textos completos`);
  else bad(`grafo: faltan=${faltan.join(',')} rotos=${rotos} tonosMalos=${tonosMalos} vacios=${textosVacios}`);
}

console.log('\n=== 2) Watcher (A): Heraldo caído → aviso → accept_q17 → interludio_acto5_a ===');
{
  const g = newGame();
  g.questIdx = 15; g.flags.acto4Done = true; g.flags.heraldoDerrotado = true;

  tick(g, 3);
  if (g.flags.acto5_aviso && g.flags.acto5_q17_activa) ok('watcher (A): acto5_aviso + acto5_q17_activa tras heraldoDerrotado');
  else bad('watcher (A) no se disparó');
  if (toastHas(g, 'Ciudadela de Vesh ha empezado a cantar')) ok('toast exacto del aviso presente');
  else bad('falta el toast «La Ciudadela de Vesh ha empezado a cantar...»');
  if (g.questIdx === 15) ok('el tick NO toca questIdx (gestión solo vía accept_q*)');
  else bad(`el tick tocó questIdx (${g.questIdx})`);

  const consumio = acto5ActionR19(g, 'accept_q17');
  if (consumio && g.flags.q17 && g.questIdx === 16 && g.questStep === 0)
    ok('accept_q17: consumida, flag q17 + questIdx 15→16 (auto-reparación con acto4Done)');
  else bad(`accept_q17: consumio=${consumio} q17=${g.flags.q17} idx=${g.questIdx}`);
  if (toastHas(g, 'Nueva misión: La Puerta que Canta')) ok('toast de nueva misión presente');
  else bad('falta toast «Nueva misión: La Puerta que Canta»');

  tick(g, 2);
  if (g.dlgKey === 'interludio_acto5_a' && g.state === 'dialogue') ok('interludio_acto5_a encolado y ABIERTO por el tick');
  else bad(`interludio no abierto (dlgKey=${g.dlgKey}, state=${g.state})`);
  const pasos = chain(g);
  if (!g.dlgKey && g.state === 'play' && pasos >= 3) ok(`interludio navegado de punta a punta (${pasos} saltos) y cierre a 'play'`);
  else bad(`cadena del interludio rota (pasos=${pasos}, dlgKey=${g.dlgKey})`);
  if (g.flags.interludio_acto5_a && g.flags.interludio_acto5_a_vista) ok('flags interludio_acto5_a + _vista marcadas');
  else bad('faltan flags del interludio a');
  tick(g, 3);
  if (!g.dlgKey) ok('sin re-apertura del interludio (idempotente)');
  else bad('el interludio se re-abrió');
}

console.log('\n=== 3) Ciudadela: intro de entrada + cruce del umbral (q17 completa) ===');
{
  const g = newGame();
  g.questIdx = 16; g.questStep = 0; g.flags.q17 = true; g.flags.acto5_q17_activa = true;

  // fuera de la ciudadela: nada se abre
  tick(g, 3);
  if (!g.dlgKey) ok('fuera de la ciudadela no se dispara nada');
  else bad(`disparo fuera de sitio (dlgKey=${g.dlgKey})`);

  (g as unknown as { mapId: string }).mapId = 'ciudadela';
  g.map = fakeCiudadela([['acto5_s1', 20, 15]], [22, 15]);
  const p = g.player!;
  p.x = 20 * 16 + 8; p.y = 30 * 16 + 8; // dentro del mapa, lejos del umbral

  tick(g, 2);
  if (g.dlgKey === 'acto5_intro_a' && g.state === 'dialogue') ok('primera entrada en la Ciudadela: cadena acto5_intro_a abierta');
  else bad(`intro no abierta (dlgKey=${g.dlgKey})`);
  chain(g);
  if (g.questIdx === 16 && g.questStep === 1) ok('acto5_intro_fin: q17 paso 0 → 1 (la Puerta ya te reconoce)');
  else bad(`intro no avanzó la misión (idx=${g.questIdx}, step=${g.questStep})`);
  if (toastHas(g, 'busca la Puerta que Canta')) ok('toast de objetivo del umbral presente');
  else bad('falta el toast del umbral');

  // alejarse y acercarse al umbral 'acto5_puerta' (22,15)
  p.x = 22 * 16 + 8; p.y = 15 * 16 + 8;
  tick(g, 2);
  if (g.dlgKey === 'acto5_puerta_a') ok('umbral acto5_puerta (radio 40 px): cadena del cruce abierta');
  else bad(`el cruce no se abrió (dlgKey=${g.dlgKey})`);
  chain(g);
  if (g.questIdx === 17 && g.questStep === 0 && g.flags.acto5_q18) ok('acto5_puerta_fin: q17 → q18 «El Coro de Ceniza» (toast de questAdvance)');
  else bad(`q17 no cerró (idx=${g.questIdx}, step=${g.questStep})`);
  if (toastHas(g, 'Nueva misión: El Coro de Ceniza')) ok('toast «Nueva misión: El Coro de Ceniza» (lo emite questAdvance)');
  else bad('falta el toast de q18');
}

console.log('\n=== 4) Sellos vía dynNodes[voz_fragment] + elección MORAL (despertar) ===');
{
  const g = newGame();
  g.questIdx = 17; g.questStep = 0; g.flags.acto5_q18 = true; g.flags.acto5_q17_activa = true;
  (g as unknown as { mapId: string }).mapId = 'ciudadela';
  g.map = fakeCiudadela([['acto5_s1', 20, 15], ['acto5_s2', 26, 15], ['acto5_s3', 20, 20]]);
  const p = g.player!;
  p.x = 20 * 16 + 8; p.y = 15 * 16 + 8; // sobre acto5_s1

  tick(g, 2);
  const ov = g.dynNodes['voz_fragment'];
  if (ov === D_ACTO5['acto5_sello_1']) ok('override dynNodes[voz_fragment] = nodo del sello más cercano (s1)');
  else bad('el override del sello no se armó');
  g.openDialogue('voz_fragment'); // el E real del motor
  if (g.dlgKey === 'voz_fragment' && g.dlgNode === D_ACTO5['acto5_sello_1']) ok('E del motor abre el sello correcto sin tocar engine');
  else bad('el E no resolvió el sello');
  chain(g);
  if (g.flags.acto5_sello1 && toastHas(g, '(1/3)')) ok('acto5_sello_tomado_1: flag + contador (1/3)');
  else bad('el sello 1 no se registró');

  // sello 2: el Portador camina hasta él (26,15) y el override re-apunta
  p.x = 26 * 16 + 8; p.y = 15 * 16 + 8;
  tick(g, 2);
  if (g.dynNodes['voz_fragment'] === D_ACTO5['acto5_sello_2']) ok('override re-armado al siguiente sello sin tomar (s2)');
  else bad('el override no re-apuntó al sello 2');
  g.openDialogue('voz_fragment');
  chain(g);
  if (g.flags.acto5_sello2 && toastHas(g, '(2/3)')) ok('sello 2 registrado (2/3)');
  else bad('el sello 2 no se registró');

  // sello 3: el Portador camina hasta él (20,20)
  p.x = 20 * 16 + 8; p.y = 20 * 16 + 8;
  tick(g, 2);
  g.openDialogue('voz_fragment'); // sello 3
  chain(g);
  if (g.flags.acto5_sello3 && toastHas(g, 'Los tres sellos cantan a la vez')) ok('sello 3: contador completo + toast del silencio antes de Vesh');
  else bad('el 3er sello no cerró el paso 0');
  if (g.questIdx === 17 && g.questStep === 1) ok('q18 paso 0 → 1 (3/3)');
  else bad(`el paso de q18 no avanzó (idx=${g.questIdx}, step=${g.questStep})`);

  tick(g, 2);
  if (g.dlgKey === 'interludio_acto5_b') ok('interludio_acto5_b «El silencio antes de Vesh» encolado y abierto');
  else bad(`interludio b no abierto (dlgKey=${g.dlgKey})`);
  chain(g);
  if (g.flags.interludio_acto5_b_vista) ok('interludio b navegado y marcado _vista');
  else bad('interludio b sin _vista');

  tick(g, 2);
  if (g.dlgKey === 'acto5_puerta_vesh_a') ok('watcher (E): los tres sellos abren la Sala del Silencio (elección moral)');
  else bad(`la elección no se abrió (dlgKey=${g.dlgKey})`);
  chain(g, 2); // en el nodo de la elección: opción 2 «(Aún no...)»
  if (g.state === 'play') ok('«(Aún no...)» cierra sin elegir (no atrapa al jugador)');
  else bad('la tregua no cerró el diálogo');
  tick(g, 2);
  if (!g.dlgKey) ok('tregua activa: la Sala NO se re-abre inmediatamente');
  else bad('la Sala se re-abrió sin respetar la tregua');
  acto5TickR19(g, 21); // dt=21 s: consume la tregua de 20 s
  tick(g, 2);
  if (g.dlgKey === 'acto5_puerta_vesh') ok('pasada la tregua, la Sala se re-abre DIRECTO en el nodo de la elección (pv_vista)');
  else bad(`no re-abrió la elección (dlgKey=${g.dlgKey})`);

  // elegir DESPERTAR (opción 0)
  g.dlgSel = 0;
  adv(g); // aplica acto5_camino_despertar + abre acto5_puerta_despues
  if (typeof g.flags.acto5_camino === 'string' && g.flags.acto5_camino === 'despertar' && g.flags.acto5_sala_abierta)
    ok('elección DESPERTAR: flags acto5_camino + acto5_sala_abierta (señal para el 19-h)');
  else bad('la elección no fijó los flags del camino');
  if (g.questIdx === 18 && g.questStep === 0) ok('q18 → q19 «Vesh, la Última Nota» tras la elección');
  else bad(`q18 no avanzó a q19 (idx=${g.questIdx})`);
  chain(g);
  if (!g.dlgKey && g.state === 'play') ok('cierre de la cadena de la Sala: el mundo espera al jefe');
  else bad(`la cadena de la Sala no cerró (dlgKey=${g.dlgKey})`);
  if (toastHas(g, 'Has elegido DESPERTAR')) ok('toast de la elección presente');
  else bad('falta el toast de la elección');
}

console.log('\n=== 5) veshDefeated → epílogo «despertar» UNA vez + memoria + FIN VERDADERO ===');
{
  const g = newGame();
  g.questIdx = 18; g.questStep = 1;
  g.flags.acto5_camino = 'despertar' as unknown as number;
  const gold0 = g.player!.gold;
  g.flags.veshDefeated = true;

  tick(g, 2);
  if (g.dlgKey === 'acto5_final_despertar_a') ok('watcher (F): epílogo del camino «despertar» abierto');
  else bad(`epílogo no abierto (dlgKey=${g.dlgKey})`);
  chain(g, 1); // en el nodo final: quedarse (opción 1) para no lanzar end_demo
  if (!g.dlgKey && g.state === 'play') ok('epílogo navegado completo (3 nodos) y cerrado');
  else bad(`el epílogo no cerró (dlgKey=${g.dlgKey})`);
  if (g.flags.acto5_fin) ok('flag acto5_fin fijada por acto5_fin_verdadero');
  else bad('falta flag acto5_fin');
  if (toastHas(g, 'FIN VERDADERO')) ok('toast «FIN VERDADERO — La Última Nota ha sonado»');
  else bad('falta el toast de FIN VERDADERO');
  if (g.player!.gold === gold0 + 150 && g.player!.potions >= 1) ok('acto5_report19: +150 coronas y +1 poción (pago único)');
  else bad(`pago de q19: oro ${gold0}→${g.player!.gold}`);
  if (g.player!.memories?.includes('mem_ultimanota') && !!g.memoryReveal) ok('Memoria VIII «La Última Nota» otorgada con revelación');
  else bad('la memoria no se otorgó');
  const memN = g.player!.memories!.length;
  acto5ActionR19(g, 'acto5_memoria');
  if (g.player!.memories!.length === memN) ok('acto5_memoria idempotente (sin doble otorgamiento)');
  else bad('la memoria se otorgó dos veces');
  if (QUESTS[18].steps.length === 2) ok('q19 bien formada (2 pasos) — el clamp de questAdvance es seguro');
  else bad('q19 mal formada');

  tick(g, 5);
  if (!g.dlgKey) ok('2ª llamada tras veshDefeated: NO-OP (el epílogo no se repite)');
  else bad(`el epílogo se re-abrió (dlgKey=${g.dlgKey})`);
  const toastsFin = g.toasts.filter(t => t.text.includes('FIN VERDADERO')).length;
  acto5ActionR19(g, 'acto5_fin_verdadero');
  const toastsFin2 = g.toasts.filter(t => t.text.includes('FIN VERDADERO')).length;
  if (toastsFin2 === toastsFin) ok('acto5_fin_verdadero idempotente (sin FIN duplicado)');
  else bad('FIN VERDADERO duplicado');
}

console.log('\n=== 6) Camino «apagar» (partida limpia): epílogo alternativo ===');
{
  const g = newGame();
  g.questIdx = 17; g.questStep = 1; g.flags.acto5_q18 = true; g.flags.acto5_q17_activa = true;
  g.flags.acto5_sello1 = true; g.flags.acto5_sello2 = true; g.flags.acto5_sello3 = true;
  g.flags.acto5_pv_vista = true;

  tick(g, 2);
  if (g.dlgKey === 'acto5_puerta_vesh') ok('con pv_vista, la Sala se abre directo en la elección');
  else bad(`no abrió la elección (dlgKey=${g.dlgKey})`);
  g.dlgSel = 1; // APAGAR
  adv(g);
  if (acto5CaminoR19(g) === 'apagar' && g.flags.acto5_sala_abierta) ok('acto5CaminoR19 → «apagar» (helper para el 19-h)');
  else bad('el camino apagar no se leyó bien');
  if (g.questIdx === 18) ok('q18 → q19 también en el camino «apagar»');
  else bad('la elección apagar no avanzó la misión');
  chain(g);

  g.flags.veshDefeated = true;
  tick(g, 2);
  if (g.dlgKey === 'acto5_final_apagar_a') ok('epílogo «apagar» disparado (texto distinto por camino)');
  else bad(`epílogo apagar no abierto (dlgKey=${g.dlgKey})`);
  const t0 = D_ACTO5['acto5_final_apagar_a'].text;
  if (t0.includes('APAGASTE')) ok('el epílogo «apagar» tiene texto propio (no reutiliza el de despertar)');
  else bad('texto del epílogo apagar genérico');
  chain(g, 1);
  if (g.flags.acto5_fin && !g.dlgKey) ok('epílogo apagar completado: acto5_fin');
  else bad('el epílogo apagar no cerró');
}

console.log('\n=== 7) Ilwen + dispararActo5 + limpieza del override + tick sin NaN ===');
{
  const g = newGame();
  g.questIdx = 17; g.flags.acto5_q17_activa = true; g.flags.acto5_intro_vista = true;
  (g as unknown as { mapId: string }).mapId = 'ciudadela';
  g.map = fakeCiudadela([]);
  const p = g.player!;
  p.x = 300; p.y = 300;
  g.companion = {
    kind: 'companion', x: p.x, y: p.y, w: 12, h: 14, vx: 0, vy: 0, dir: 'down',
    hp: 40, maxHp: 40, sprite: 'ilwen', anim: 0, moving: false,
    cname: 'Ilwen', atkCd: 0, downT: 0, affinity: 5,
  } as unknown as import('../src/game/types').Companion;

  tick(g, 2);
  if (g.dlgKey === 'acto5_ilwen' && g.flags.acto5_ilwen_reacc) ok('Ilwen canta la primera armonía (una vez, con compañera en la ciudadela)');
  else bad(`la reacción de Ilwen no se disparó (dlgKey=${g.dlgKey})`);
  chain(g);
  tick(g, 5);
  if (!g.dlgKey) ok('la reacción de Ilwen no se repite');
  else bad('Ilwen se repite');

  // limpieza del override al salir del mapa
  g.flags.acto5_sello2 = true; g.flags.acto5_sello3 = true;
  p.x = 20 * 16 + 8; p.y = 15 * 16 + 8;
  g.map = fakeCiudadela([['acto5_s1', 20, 15]]);
  tick(g, 2);
  if (g.dynNodes['voz_fragment']) ok('override re-armado al volver a la ciudadela');
  else bad('el override no se re-armó');
  (g as unknown as { mapId: string }).mapId = 'lunaris';
  tick(g, 2);
  if (!g.dynNodes['voz_fragment']) ok('override RETIRADO al salir de la ciudadela (voz_fragment original intacto)');
  else bad('el override quedó sucio fuera del mapa');

  dispararActo5(g, 'acto5_intro_a');
  tick(g, 2);
  if (g.dlgKey === 'acto5_intro_a') ok('dispararActo5 encola y el tick abre (API pública)');
  else bad('dispararActo5 no abrió');
  chain(g);

  // 600 frames en los tres estados, sin NaN y sin excepciones
  const p2 = g.player!;
  let nan = false;
  try {
    for (const st of ['play', 'dialogue', 'pause'] as const) {
      g.state = st;
      if (st === 'dialogue') { g.openDialogue('acto5_intro_a'); }
      for (let i = 0; i < 200; i++) acto5TickR19(g, 1 / 60);
      if (!Number.isFinite(p2.x) || !Number.isFinite(p2.y) || !Number.isFinite(g.globalT)) { nan = true; break; }
    }
  } catch (e) { nan = true; console.log('  excepción en tick: ' + e); }
  if (!nan && Number.isFinite(p2.x) && Number.isFinite(p2.y)) ok('acto5TickR19 600 frames en play/dialogue/pause sin NaN ni excepciones');
  else bad('NaN o excepción en el tick');
}

console.log('\n' + (fails === 0
  ? 'SMOKE ACTO5 NARRATIVA: TODO OK'
  : `SMOKE ACTO5 NARRATIVA: ${fails} FALLO(S)`));
process.exit(fails === 0 ? 0 : 1);
