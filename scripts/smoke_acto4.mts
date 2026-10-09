// ============================================================
// 16-a (historia-acto4) — Smoke del ACTO IV "El Último Canto" sin navegador
// Stub DOM/Audio (patrón smoke_acto3) + Game real + hooks reales:
// q14 (Toln + 2 voces del coro, cualquier orden) → q15 (Guarda + JEFE FINAL
// 'El Heraldo · Vesh, la Última Nota') → q16 (epílogo ramificado por
// reputación + memoria VII), con juego FUERA de orden, anti-doble-pago y
// ruteo de diálogos (envoltorio en capas 13-a → 16-a).
// Ejecutar: bun scripts/smoke_acto4.ts
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
const { QUESTS, MEMORIES, ENEMY_DEFS, QUEST_COMPASS, DIALOGUES, ACTO4_BOSS, ACTO4_FIN_JEFES, getDialogue } =
  await import('../src/game/data');
const { MAPS } = await import('../src/game/maps');
import type { DialogueCtx, Enemy } from '../src/game/types';

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

type G = InstanceType<typeof Game>;
/** Partida situada al FINAL del Acto III (q13 pagado, acto3Done, biomas del Acto II limpios). */
function newActo4(): G {
  const g = new Game(makeCanvas());
  g.newGame('Prueba4', 'alba');
  g.questIdx = 12; g.questStep = 2;
  g.flags.acto2Done = true;
  g.flags.acto3Done = true;
  g.flags.guardianDefeated = true;   // Guardián de campaña del Acto I (spawn oculto)
  g.flags.guardianRecordadoDerrotado = true; // élite del Acto III (q13)
  g.flags.sirenaDefeated = true;     // jefa del Acto II (voz para camMera)
  g.flags.golemDefeated = true;      // jefe del Acto II (resonancia para camCumbres)
  return g;
}
/** Dispara una acción pasando por el fallback real del motor (engine.applyAction → hooks). */
function act(g: G, a: string) { g.applyAction(a); }
/** El catchUp del Acto IV corre dentro de handleCustomAction: cualquier acción inofensiva lo dispara. */
function pump(g: G) { act(g, 'acto4_smoke_nop'); }
/** Ruteo directo del envoltorio (capa 16-a → 13-a → base). */
function route(nid: string, questIdx: number, questStep: number, flags: Record<string, number | boolean> = {}): string {
  const ctx: DialogueCtx = { questIdx, questStep, flags, companion: false };
  return getDialogue(nid, ctx);
}

console.log('=== 1) ESTRUCTURA: misiones, memoria VII, jefe final, Guarda, brújula ===');
{
  const q14 = QUESTS.find(q => q.id === 'q14'), q15 = QUESTS.find(q => q.id === 'q15'), q16 = QUESTS.find(q => q.id === 'q16');
  if (q14 && q15 && q16) ok('q14/q15/q16 presentes: ' + [q14, q15, q16].map(q => q.name).join(' · '));
  else bad('faltan misiones del Acto IV');
  if (QUESTS.length === 16) ok(`QUESTS.length = ${QUESTS.length} (q1..q16, Acto IV incluido)`);
  else bad(`QUESTS.length = ${QUESTS.length}, se esperaban 16`);
  if (q14 && q14.steps.length === 3 && q15 && q15.steps.length === 3 && q16 && q16.steps.length === 2) ok('pasos: q14 3 · q15 3 · q16 2');
  else bad('pasos de las misiones del Acto IV incompletos');
  if (MEMORIES['mem_ultimacanto' as keyof typeof MEMORIES]) ok('memoria VII mem_ultimacanto definida');
  else bad('memoria final del Acto IV ausente');
  const her = ENEMY_DEFS['heraldo'];
  if (her && her.hp >= 500 && her.breakBar && her.breakBar > 100 && her.sprite === 'inquisidor') {
    ok(`jefe final 'heraldo': hp ${her.hp}, quiebre ${her.breakBar}, sprite existente '${her.sprite}'`);
  } else bad(`ENEMY_DEFS.heraldo incorrecto: ${JSON.stringify(her)}`);
  const guarda = MAPS['cripta'].npcs.find(n => n.id === 'guarda');
  if (guarda && guarda.showFlag === 'acto3Done') ok(`Guarda del Primer Canto en la Cripta (showFlag '${guarda.showFlag}', sprite '${guarda.sprite}')`);
  else bad('NPC Guarda ausente o con showFlag incorrecto');
  if (QUEST_COMPASS[13] && QUEST_COMPASS[14] && QUEST_COMPASS[15]) ok('Brújula: objetivos de q14-q16 definidos');
  else bad('faltan objetivos de Brújula del Acto IV');
  if (ACTO4_BOSS && 'ref' in ACTO4_BOSS) ok('ACTO4_BOSS exportado (patrón ACTO3_ELITE)');
  else bad('ACTO4_BOSS ausente');
  if (DIALOGUES['acto4_epilogo_canto']) ok('nodo de respaldo acto4_epilogo_canto presente');
  else bad('falta el nodo de respaldo del epílogo');
  // regresión del envoltorio en capas: rutas del Acto I/II intactas a través de 16-a → 13-a → base
  if (route('brisa', 0, 0) === 'brisa_intro') ok('envoltorio 16-a: delegación base intacta (brisa q0 → brisa_intro)');
  else bad(`delegación base rota: ${route('brisa', 0, 0)}`);
  if (route('mara', 5, 0) === 'mara_intro') ok('envoltorio 16-a: delegación Acto III intacta (mara q5 → mara_intro)');
  else bad(`delegación Acto III rota: ${route('mara', 5, 0)}`);
  // transición q12 → q13: el briefing de q14 es alcanzable tras acto3Done
  if (route('brisa', 12, 2, { acto2Done: true, acto3Done: true }) === 'acto4_brisa_alba') ok('transición q12→q13: Brisa abre el Acto IV (briefing alcanzable)');
  else bad(`transición q12→q13 rota: ${route('brisa', 12, 2, { acto2Done: true, acto3Done: true })}`);
  if (route('brisa', 12, 2, { acto2Done: true }) !== 'acto4_brisa_alba') ok('sin acto3Done: la capa 13-a conserva el cierre del Acto III');
  else bad('la transición salta por encima del Acto III sin cerrarlo');
}

console.log('\n=== 2) Flujo q14: aceptar → Toln → 2 voces (cualquier orden) → reporte ===');
{
  const g = newActo4();
  act(g, 'accept_q14');
  if (g.questIdx === 13 && g.questStep === 0 && g.flags.q14) ok('accept_q14: misión activa (idx 13, paso 0)');
  else bad(`accept_q14: idx=${g.questIdx} step=${g.questStep}`);
  act(g, 'acto4_toln');
  if (g.questIdx === 13 && g.questStep === 1 && g.flags.camToln) ok('acto4_toln: campana criada, paso 0→1');
  else bad(`acto4_toln: step=${g.questStep} camToln=${String(g.flags.camToln)}`);
  // voces en orden NO secuencial (Ivo primero, Mera después)
  act(g, 'acto4_cam_ivo');
  if (g.questStep === 1 && g.flags.camCumbres) ok('acto4_cam_ivo: voz 1/2 (paso aún abierto)');
  else bad(`acto4_cam_ivo: step=${g.questStep}`);
  act(g, 'acto4_cam_mera');
  if (g.questIdx === 13 && g.questStep === 2) ok('acto4_cam_mera: coro completo (desordenado) → paso 1→2');
  else bad(`voces: step=${g.questStep}`);
  const goldPre = g.player!.gold, potPre = g.player!.potions;
  act(g, 'acto4_report');
  if (g.questIdx === 14 && g.flags.acto4Paid14) ok('acto4_report paga q14 y avanza a q15');
  else bad(`report q14: idx=${g.questIdx} paid=${String(g.flags.acto4Paid14)}`);
  if (g.player!.gold === goldPre + 80 && g.player!.potions === potPre + 1) ok('recompensa q14: +80 coronas y +1 poción');
  else bad(`recompensa q14: oro=${g.player!.gold} (esperado ${goldPre + 80}) poc=${g.player!.potions}`);
}

console.log('\n=== 3) Flujo q15: Guarda → JEFE FINAL (Vesh, la Última Nota) → catchUp → reporte ===');
{
  const g = newActo4();
  g.questIdx = 14; g.questStep = 0; g.flags.q15 = true;
  act(g, 'acto4_guarda');
  if (g.questStep === 1) ok('acto4_guarda: paso 0→1');
  else bad(`guarda: step=${g.questStep}`);
  act(g, 'acto4_subir');
  const boss = ACTO4_BOSS.ref as unknown as Enemy | null;
  if (g.mapId === 'cripta' && boss && !boss.dead && g.bossActive) ok('acto4_subir: Cripta + jefe final con barra de jefe activa');
  else bad(`subir: map=${g.mapId} boss=${String(!!boss)} bossActive=${String(g.bossActive)}`);
  if (boss && boss.etype === 'heraldo' && boss.maxSta > 0) ok(`jefe final instanciado: etype 'heraldo', quiebre ${boss.maxSta}`);
  else if (boss) bad(`jefe final con etype/quiebre incorrectos: ${boss.etype}/${boss.maxSta}`);
  if (boss) {
    const goldPre = g.player!.gold;
    g.damageEnemy(boss, 100000, 'sagrado', 0);
    for (let i = 0; i < 3; i++) g.update(1 / 60); // la muerte se procesa en el tick (killEnemy)
    pump(g); // catchUp: ACTO4_BOSS.ref.dead → heraldoDerrotado → barra fuera + paso 1→2
    if (g.flags.heraldoDerrotado && g.questStep === 2) ok('jefe final caído → catchUp avanza paso 1→2');
    else bad(`heraldo muerto: flag=${String(g.flags.heraldoDerrotado)} step=${g.questStep}`);
    if (!g.bossActive) ok('barra de jefe y música limpiados por el catchUp');
    else bad('bossActive sigue activo tras la muerte');
    if (g.player!.gold > goldPre) ok('botín del jefe otorgado por killEnemy (rama por defecto)');
    else bad('el jefe no dio botín');
  }
  // anti-respawn: re-invocar acto4_subir con el jefe muerto NO lo trae de vuelta
  act(g, 'acto4_subir');
  const vivos = g.enemies.filter(e => e.etype === 'heraldo' && !e.dead).length;
  if (vivos === 0 && !g.flags.acto4SalaAbierta === false) ok('acto4_subir idempotente: el jefe derrotado no renace');
  else bad(`acto4_subir revivió al jefe (${vivos} vivos)`);
  const potPre = g.player!.potions, goldPre2 = g.player!.gold;
  act(g, 'acto4_report');
  if (g.questIdx === 15 && g.flags.acto4Paid15) ok('acto4_report paga q15 → q16 (epílogo)');
  else bad(`report q15: idx=${g.questIdx} paid=${String(g.flags.acto4Paid15)}`);
  const delta = g.player!.gold - goldPre2;
  if (g.player!.potions === potPre + 1 && delta === 120) ok('recompensa q15: +120 coronas y +1 poción');
  else bad(`recompensa q15: poc=${g.player!.potions} delta oro=${delta}`);
  act(g, 'acto4_report'); // anti-doble-pago
  if (g.player!.gold === goldPre2 + 120) ok('anti-doble-pago q15: repetir report no paga dos veces');
  else bad('acto4_report pagó dos veces');
}

console.log('\n=== 4) q16 · Epílogo: ramas por reputación, pago, memoria UNA VEZ, final dinámico ===');
{
  const g = newActo4();
  g.questIdx = 15; g.questStep = 0; g.flags.q16 = true;
  g.flags.acto3RepDecision = true;
  // rama VERDAD: Orden > Guardianes
  g.player!.repFacciones.orden = 10; g.player!.repFacciones.guardianes = 0;
  pump(g); // el catchUp espeja la reputación en flags (DialogueCtx no la lleva)
  const routeBrisa = () => g.talkTo('brisa');
  routeBrisa();
  if (g.dlgKey === 'acto4_epilogo_verdad') ok('epílogo: Orden > Guardianes → rama VERDAD (espejo de reputación)');
  else bad(`epílogo verdad: dlgKey=${g.dlgKey}`);
  g.closeDialogue();
  // rama SILENCIO: Guardianes >= Orden
  g.player!.repFacciones.orden = 0; g.player!.repFacciones.guardianes = 8;
  pump(g);
  routeBrisa();
  if (g.dlgKey === 'acto4_epilogo_silencio') ok('epílogo: Guardianes >= Orden → rama SILENCIO');
  else bad(`epílogo silencio: dlgKey=${g.dlgKey}`);
  g.closeDialogue();
  // pago + memoria + acto4Done (una sola vez)
  const goldPre = g.player!.gold, potPre = g.player!.potions;
  act(g, 'acto4_epilogo');
  if (g.flags.acto4Paid16 && g.flags.acto4Done) ok('acto4_epilogo: pago final + acto4Done');
  else bad(`epilogo: paid=${String(g.flags.acto4Paid16)} done=${String(g.flags.acto4Done)}`);
  if (g.player!.gold === goldPre + 150 && g.player!.potions === potPre + 1) ok('recompensa q16: +150 coronas y +1 poción');
  else bad(`recompensa q16: oro=${g.player!.gold} (esperado ${goldPre + 150}) poc=${g.player!.potions}`);
  if ((g.player!.memories ?? []).includes('mem_ultimacanto') && g.questStep === 1) ok('memoria VII otorgada y paso 0→1 del epílogo');
  else bad(`memoria/paso: mems=${JSON.stringify(g.player!.memories)} step=${g.questStep}`);
  if (g.dynNodes['acto4_epilogo_canto']) ok('final dinámico del epílogo instalado en dynNodes');
  else bad('dynNodes acto4_epilogo_canto no instalado');
  act(g, 'acto4_epilogo'); act(g, 'acto4_epilogo'); // anti-doble-pago + memoria única
  const memN = (g.player!.memories ?? []).filter(m => m === 'mem_ultimacanto').length;
  if (g.player!.gold === goldPre + 150 && memN === 1) ok('anti-doble-pago q16: ni oro ni memoria duplicados');
  else bad(`epilogo repetido: oro=${g.player!.gold} mems=${memN}`);
  // final dinámico según jefes opcionales derrotados (Coro Roto / Vult)
  g.flags.coroDefeated = true; g.flags.vultDefeated = true;
  act(g, 'acto4_epilogo');
  const finTxt = String(g.dynNodes['acto4_epilogo_canto']?.text ?? '');
  if (finTxt.includes('máscaras') && finTxt.includes('cartógrafo')) ok('final dinámico: menciona al Coro Roto y a Vult al haber caído');
  else bad('el final dinámico no reacciona a los jefes opcionales');
  if (ACTO4_FIN_JEFES.coro && ACTO4_FIN_JEFES.vult) ok('textos de jefes del epílogo definidos en data.ts');
  else bad('ACTO4_FIN_JEFES incompleto');
  // post-epílogo: Brisa sirve el nodo de despedida con end_demo
  g.closeDialogue();
  routeBrisa();
  if (g.dlgKey === 'brisa_r11_ultimo' && (g.dlgNode?.options ?? []).some(o => o.action === 'end_demo')) ok('post-epílogo: despedida R11 (brisa_r11_ultimo) con opción de terminar el viaje (end_demo)');
  else bad(`post-epílogo: dlgKey=${g.dlgKey}`);
}

console.log('\n=== 5) Juego FUERA DE ORDEN: voces/jefe/recuerdos ANTES de aceptar ===');
{
  // q14: las dos voces se consiguieron antes de aceptar la misión
  const g = newActo4();
  g.flags.camMera = true; g.flags.camCumbres = true;
  act(g, 'accept_q14');
  act(g, 'acto4_toln');   // paso 0→1
  pump(g);                // catchUp: ambas voces ya cierran el paso 1→2
  if (g.questIdx === 13 && g.questStep === 2) ok('q14 fuera de orden: voces previas + catchUp cierran el paso');
  else bad(`fuera de orden q14: idx=${g.questIdx} step=${g.questStep}`);
  // q15: el jefe ya murió en una sesión anterior (solo la flag persiste)
  const g2 = newActo4();
  g2.questIdx = 14; g2.questStep = 1; g2.flags.q15 = true; g2.flags.heraldoDerrotado = true;
  pump(g2);
  if (g2.questStep === 2) ok('q15 fuera de orden: flag del jefe muerto avanza el paso');
  else bad('q15 fuera de orden bloqueada');
  // save a medio aceptar: flag q14 con questIdx aún 12 (fin del Acto III)
  const g3 = newActo4();
  g3.flags.q14 = true;
  pump(g3);
  if (g3.questIdx === 13 && g3.questStep === 0) ok('save a medio aceptar: q14 con idx 12 auto-reparado');
  else bad(`auto-reparación: idx=${g3.questIdx} step=${g3.questStep}`);
}

console.log('\n=== 6) Caso sin condiciones: el catchUp NO avanza nada espúreo ===');
{
  const g = newActo4();
  act(g, 'accept_q14');
  pump(g); pump(g);
  if (g.questIdx === 13 && g.questStep === 0) ok('sin condiciones: la misión sigue en paso 0');
  else bad(`avance espúreo: idx=${g.questIdx} step=${g.questStep}`);
  // sin decisión de Acto III: el epílogo cae en la rama neutra
  const g2 = newActo4();
  g2.questIdx = 15; g2.questStep = 0; g2.flags.q16 = true;
  g2.talkTo('brisa');
  if (g2.dlgKey === 'acto4_epilogo') ok('sin decisión de Acto III: rama neutra del epílogo');
  else bad(`rama neutra: dlgKey=${g2.dlgKey}`);
  g2.closeDialogue();
}

console.log('\n=== 7) RUTEO de diálogos del Acto IV (envoltorio en capas) ===');
{
  // El bloque 3 dejó el singleton del jefe en estado 'muerto': se limpia para
  // probar los ruteos en estado limpio (el juego real no comparte partidas).
  ACTO4_BOSS.ref = null;
  const f = (over: Record<string, number | boolean> = {}): Record<string, number | boolean> =>
    ({ acto2Done: true, acto3Done: true, sirenaDefeated: true, golemDefeated: true, ...over });
  // q14
  if (route('brisa', 13, 0, f()) === 'acto4_brisa_ruta') ok('brisa q14 paso 0 → guía de campanas');
  else bad('brisa q14 paso 0 mal ruteado');
  if (route('brisa', 13, 2, f()) === 'acto4_brisa_cierre1') ok('brisa q14 paso 2 → cierre con informe');
  else bad('brisa q14 paso 2 mal ruteado');
  if (route('toln', 13, 0, f()) === 'acto4_toln_cam') ok('toln q14 paso 0 → forja de la campana');
  else bad('toln q14 paso 0 mal ruteado');
  if (route('toln', 13, 0, f({ tonoDominante: 'sarcastico' })) === 'acto4_toln_cam_sarc') ok('toln con tono sarcástico → variante Listillo');
  else bad('variante sarcástica de Toln mal ruteada');
  if (route('toln', 13, 1, f()) === 'toln_intro') ok('toln con campana criada → menú normal (forja/tienda)');
  else bad('toln delega mal tras la campana');
  if (route('mera', 13, 1, f()) === 'acto4_mera_cam') ok('mera q14 paso 1 (Sirena caída) → voz de Merrow');
  else bad('mera q14 mal ruteado');
  if (route('ivo', 13, 1, f()) === 'acto4_ivo_cam') ok('ivo q14 paso 1 (Gólem caído) → resonancia de las Cumbres');
  else bad('ivo q14 mal ruteado');
  if (route('mera', 13, 1, f({ camMera: true })) !== 'acto4_mera_cam') ok('mera con voz entregada → delega (no repite el nodo)');
  else bad('mera repite el nodo de la voz');
  // q15 y la Guarda
  if (route('guarda', 14, 0, f()) === 'acto4_guarda_intro') ok('guarda q15 paso 0 → presentación');
  else bad('guarda paso 0 mal ruteado');
  if (route('guarda', 14, 1, f()) === 'acto4_guarda_puerta') ok('guarda paso 1 → ofrecimiento de la puerta');
  else bad('guarda paso 1 mal ruteado');
  if (route('guarda', 14, 1, f({ acto4SalaAbierta: true })) === 'acto4_guarda_espera') ok('guarda con Sala abierta → re-entrada (anti-bloqueo)');
  else bad('guarda re-entrada mal ruteada');
  if (route('guarda', 14, 1, f({ heraldoDerrotado: true })) === 'acto4_guarda_gratitud') ok('guarda tras el jefe → gratitud');
  else bad('guarda gratitud mal ruteada');
  if (route('guarda', 12, 2, f()) === 'acto4_guarda_silencio') ok('guarda antes de q15 → silencio (la Sala aún duerme)');
  else bad('guarda pre-q15 mal ruteada');
  // el Heraldo NPC de Lunaris avisa durante el Acto IV
  if (route('heraldo', 13, 0, f()) === 'acto4_heraldo_aviso') ok('heraldo NPC durante el Acto IV → último aviso');
  else bad('heraldo aviso mal ruteado');
  if (route('heraldo', 14, 2, f({ heraldoDerrotado: true })) !== 'acto4_heraldo_aviso') ok('heraldo tras su muerte → delega (aviso retirado)');
  else bad('el Heraldo sigue avisando tras morir');
  // brisa en q15
  if (route('brisa', 14, 0, f()) === 'acto4_brisa_ruta2') ok('brisa q15 paso 0 → guía hacia la Cripta');
  else bad('brisa q15 paso 0 mal ruteado');
  if (route('brisa', 14, 1, f()) === 'acto4_brisa_sala_espera') ok('brisa q15 paso 1 con jefe vivo → "no la dejes esperando"');
  else bad('brisa q15 paso 1 mal ruteado');
  if (route('brisa', 14, 1, f({ heraldoDerrotado: true })) === 'acto4_brisa_cierre2') ok('brisa q15 con jefe caído → informe inmediato (anti-bloqueo)');
  else bad('brisa no rutea el informe con el jefe caído');
  if (route('brisa', 15, 0, f({ acto3RepDecision: true, acto4RepOrden: 10, acto4RepGuard: 0 })) === 'acto4_epilogo_verdad') ok('epílogo por flags espejo: verdad');
  else bad('epílogo verdad mal ruteado por flags');
}

console.log(fails === 0 ? '\nSMOKE ACTO IV: TODO OK' : `\nSMOKE ACTO IV: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
