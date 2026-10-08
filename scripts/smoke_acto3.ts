// ============================================================
// 13-a (historia-acto3) — Smoke del ACTO III "El Canto al Revés" sin navegador
// Stub DOM/Audio (patrón smoke_motor_acto2) + Game real + hooks reales:
// q11 (Toln + 3 ecos invertidos) → q12 (3 recuerdos, cualquier orden) →
// q13 (decisión Velmora + Guardián recordado ÉLITE) → acto3_report con
// anti-doble-pago, juego fuera de orden y otorgamiento de la memoria VI.
// Ejecutar: bun scripts/smoke_acto3.ts
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
const { QUESTS, ACTO3_ELITE } = await import('../src/game/data');
const { MEMORIES } = await import('../src/game/data');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

type G = InstanceType<typeof Game>;
function newActo3(): G {
  const g = new Game(makeCanvas());
  g.newGame('Prueba3', 'alba');
  g.questIdx = 9; g.questStep = 2;
  g.flags.acto2Done = true;
  g.flags.guardianDefeated = true; // en un q13 real el Guardián del Acto I ya cayó (spawn oculto)
  return g;
}
/** Dispara una acción pasando por el fallback real del motor (engine.applyAction → hooks). */
function act(g: G, a: string) { g.applyAction(a); }
/** El catchUp del Acto III corre dentro de handleCustomAction: cualquier acción inofensiva lo dispara. */
function pump(g: G) { act(g, 'acto3_smoke_nop'); } // acción desconocida: cae al fallback de hooks DESPUÉS de acto3CatchUp (rep_/flag_/memory_ retornan antes)

console.log('=== 1) QUESTS q11-q13: estructura y encadenado tras q10 ===');
{
  const q11 = QUESTS.find(q => q.id === 'q11'), q12 = QUESTS.find(q => q.id === 'q12'), q13 = QUESTS.find(q => q.id === 'q13');
  if (q11 && q12 && q13) ok('q11/q12/q13 presentes: ' + [q11, q12, q13].map(q => q.name).join(' · '));
  else bad('faltan misiones del Acto III');
  if (q11 && q11.steps.length >= 3) ok(`q11 con ${q11.steps.length} pasos`);
  else bad('q11 sin pasos suficientes');
  if (MEMORIES['mem_cantoalreves' as keyof typeof MEMORIES]) ok('memoria VI mem_cantoalreves definida');
  else bad('memoria del Acto III ausente');
}

console.log('\n=== 2) Flujo q11: aceptar → Toln → 3 ecos (cualquier orden) → reporte ===');
{
  const g = newActo3();
  act(g, 'accept_q11');
  if (g.questIdx === 10 && g.questStep === 0 && g.flags.q11) ok('accept_q11: misión activa (idx 10, paso 0)');
  else bad(`accept_q11: idx=${g.questIdx} step=${g.questStep}`);
  act(g, 'acto3_toln');
  if (g.questIdx === 10 && g.questStep === 1) ok('acto3_toln: paso 0→1');
  else bad(`acto3_toln: step=${g.questStep}`);
  // ecos en orden NO secuencial
  act(g, 'acto3_eco2'); act(g, 'acto3_eco1'); act(g, 'acto3_eco3');
  if (g.questIdx === 10 && g.questStep === 2) ok('3 ecos invertidos (desordenados) → paso 1→2');
  else bad(`ecos: step=${g.questStep}`);
  const goldPre = g.player!.gold, potPre = g.player!.potions;
  act(g, 'acto3_report');
  if (g.questIdx === 11 && g.flags.acto3Paid11) ok('acto3_report paga q11 y avanza a q12');
  else bad(`report q11: idx=${g.questIdx} paid=${String(g.flags.acto3Paid11)}`);
  if (g.player!.gold === goldPre + 60 && g.player!.potions === potPre + 1) ok('recompensa q11: +60 coronas y +1 poción');
  else bad(`recompensa q11: oro=${g.player!.gold} (esperado ${goldPre + 60}) poc=${g.player!.potions}`);
}

console.log('\n=== 3) Flujo q12: 3 recuerdos de 4 en CUALQUIER orden (cualquiera cuenta) ===');
{
  const g = newActo3();
  g.questIdx = 11; g.questStep = 0; g.flags.q12 = true;
  act(g, 'acto3_mera_ayer');
  if (g.questStep === 1) ok('informe de Mera: paso 0→1');
  else bad(`mera: step=${g.questStep}`);
  act(g, 'acto3_rec_vult'); act(g, 'acto3_rec_ivo'); // Vult e Ivo: 3 recuerdos con Mera
  if (g.questIdx === 11 && g.questStep === 2) ok('3 recuerdos (Mera+Vult+Ivo, sin Mara) → paso 1→2');
  else bad(`recuerdos: step=${g.questStep}`);
  act(g, 'acto3_report');
  if (g.questIdx === 12 && g.flags.acto3Paid12) ok('acto3_report paga q12 → q13');
  else bad(`report q12: idx=${g.questIdx}`);
}

console.log('\n=== 4) q13: decisión de reputación (1 vez), Velmora, JEFE ÉLITE y memoria ===');
{
  const g = newActo3();
  g.questIdx = 12; g.questStep = 0; g.flags.q13 = true;
  const repO0 = g.player!.repFacciones.orden, repG0 = g.player!.repFacciones.guardianes;
  act(g, 'acto3_verdad');
  if (g.player!.repFacciones.orden === repO0 + 10 && g.player!.repFacciones.guardianes === repG0 - 5) ok('acto3_verdad: Orden +10 / Guardianes -5');
  else bad(`verdad: orden=${g.player!.repFacciones.orden} guard=${g.player!.repFacciones.guardianes}`);
  act(g, 'acto3_silencio'); // anti-farm: no debe repetir
  if (g.player!.repFacciones.orden === repO0 + 10) ok('decisión anti-farm: la 2ª no cambia reputación');
  else bad('la decisión se pudo farmear');
  act(g, 'acto3_velmora_fn');
  if (g.questStep === 1) ok('acto3_velmora_fn: paso 0→1');
  else bad(`velmora_fn: step=${g.questStep}`);
  act(g, 'acto3_subir');
  // OJO: el élite es ACTO3_ELITE.ref (spawn del altar); enemies.find('guardian')
  // podría coger al Guardián de campaña si el flag de derrota no está puesto.
  const elite = ACTO3_ELITE.ref;
  if (g.mapId === 'cripta' && elite && g.bossActive) ok('acto3_subir: Cripta + Guardián recordado con barra de jefe');
  else bad(`subir: map=${g.mapId} elite=${String(!!elite)} boss=${String(g.bossActive)}`);
  if (elite) {
    g.damageEnemy(elite, 100000, 'sagrado', 0);
    for (let i = 0; i < 3; i++) g.update(1 / 60); // la muerte se procesa en el tick (killEnemy)
    pump(g); // catchUp: ACTO3_ELITE.ref.dead → guardianRecordadoDerrotado → paso 1→2
    if (g.flags.guardianRecordadoDerrotado && g.questStep === 2) ok('jefe élite caído → catchUp avanza paso 1→2');
    else bad(`elite muerto: flag=${String(g.flags.guardianRecordadoDerrotado)} step=${g.questStep}`);
  }
  const potPre = g.player!.potions;
  act(g, 'acto3_report');
  if (g.flags.acto3Paid13 && g.flags.acto3Done) ok('acto3_report cierra el Acto III (acto3Done)');
  else bad('acto3Done no se marcó');
  if (g.player!.potions === potPre + 1 && (g.player!.memories ?? []).includes('mem_cantoalreves')) ok('recompensa q13: +1 poción + memoria VI otorgada');
  else bad(`q13: poc=${g.player!.potions} mems=${JSON.stringify(g.player!.memories)}`);
  const goldPost = g.player!.gold;
  act(g, 'acto3_report'); act(g, 'acto3_report');
  if (g.player!.gold === goldPost && (g.player!.memories ?? []).filter(m => m === 'mem_cantoalreves').length === 1) ok('anti-doble-pago: repetir report no paga ni repite memoria');
  else bad('acto3_report se pagó más de una vez');
}

console.log('\n=== 5) Juego FUERA DE ORDEN: ecos/recuerdos/jefe ANTES de aceptar ===');
{
  const g = newActo3();
  // q11 completada de facto antes de aceptarla
  g.flags.ecoInvTeo = true; g.flags.ecoInvDoran = true; g.flags.ecoInvMara = true;
  act(g, 'accept_q11');           // auto-repara idx 9→10, paso 0
  act(g, 'acto3_toln');           // paso 0→1
  pump(g);                        // catchUp: 3 ecos ya cierran el paso 1→2
  if (g.questIdx === 10 && g.questStep === 2) ok('q11 fuera de orden: ecos previos + catchUp cierran el paso');
  else bad(`fuera de orden q11: idx=${g.questIdx} step=${g.questStep}`);
  // q12: recuerdos antes de aceptar
  g.flags.recMara = true; g.flags.recIvo = true; g.flags.recVult = true;
  act(g, 'accept_q12');
  act(g, 'acto3_mera_ayer');
  pump(g);
  if (g.questIdx === 11 && g.questStep === 2) ok('q12 fuera de orden: 4 recuerdos previos cierran el paso');
  else bad(`fuera de orden q12: idx=${g.questIdx} step=${g.questStep}`);
  // q13: jefe ya muerto de una partida anterior (flag) → catchUp avanza
  g.questIdx = 12; g.questStep = 1; g.flags.guardianRecordadoDerrotado = true;
  pump(g);
  if (g.questStep === 2) ok('q13 fuera de orden: flag del jefe muerto avanza el paso');
  else bad('q13 fuera de orden bloqueada');
}

console.log('\n=== 6) Caso D (sin condiciones): catchUp NO avanza nada espúreo ===');
{
  const g = newActo3();
  act(g, 'accept_q11');
  pump(g); pump(g);
  if (g.questIdx === 10 && g.questStep === 0) ok('sin condiciones: el reto sigue en paso 0');
  else bad(`avance espúreo: idx=${g.questIdx} step=${g.questStep}`);
}

console.log(fails === 0 ? '\nSMOKE ACTO III: TODO OK' : `\nSMOKE ACTO III: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
