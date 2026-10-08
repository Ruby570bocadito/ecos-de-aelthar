// ============================================================
// Task 16-b (interacción-compañeros) — Smoke sin navegador
// Patrón de scripts/smoke_worldlife.ts (stub DOM/Audio + Game real).
// Bloques:
//  (1) Órdenes tácticas al compañero: ciclo de modos con T, agresivo busca
//      objetivo y se retira bajo 30% de vida, defensivo guarda a 2 tiles y
//      filtra disparos, INTERPOSICIÓN (50% del daño melé) con cooldown 6 s.
//  (2) Señuelo: aggro redirigido 5 s (e.lured + persecución del señuelo),
//      jefe inmune, inmunidad total con aggro en jefe (bossActive), consumo.
//  (3) Examen de restos: rng forzado (25% → 1-5 coronas) + FuerzaBruta con
//      Math.random verificando rango, una vez por cadáver, radio <0.8 tile.
//  (4) Cofres ya abiertos: reinteractuar → texto, SIN loot.
//  (5) Rumor al re-pulsar E tras un diálogo (ventana + cooldown 60 s/NPC).
//  (6) save/load preserva companion.mode + tolerancia con saves antiguos.
//  (7) Estabilidad: 600 frames con señuelo/cadáveres/compañero sin lanzar.
// Ejecutar: bun scripts/smoke_interaccion.ts
// ============================================================

// ---------- stub universal (igual que smoke_desafio/smoke_worldlife) ----------
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
(audio as unknown as { init: () => void }).init = () => {};
(audio as unknown as { ctx: unknown }).ctx = stub();

const {
  cycleCompanionMode, useSenno, __iForceRng, __iReset, __iDecoy, interaccionInteract16b,
} = await import('../src/game/interaccion');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);
const assert = (cond: boolean, m: string) => { if (cond) ok(m); else bad(m); };

type G = InstanceType<typeof Game>;

/** Claro de Lunaris tile (33,21): sin props/cofres/NPCs/ecos/tiles con historia. */
const CX = 33 * 16 + 8, CY = 21 * 16 + 8;

function newGame(): G {
  const g = new Game(makeCanvas());
  g.newGame('Smoke16b', 'alba');
  return g;
}

function campaignGame(): G {
  __iReset();
  __iForceRng(null);
  const g = newGame();
  g.setState('play');
  g.loadMap('lunaris', 33, 21);
  g.enemies = []; // sin fauna del valle: los tests colocan sus propios enemigos
  g.player!.x = CX; g.player!.y = CY;
  return g;
}

function tick(g: G, secs: number) {
  const frames = Math.round(secs * 60);
  for (let i = 0; i < frames; i++) g.update(1 / 60);
}

/** Lobo congelado (spawnGuard alto: update.ts lo ignora) para pruebas quirúrgicas. */
function frozenLobo(g: G, x: number, y: number) {
  const e = g.makeEnemy('lobo', x, y, 0, 'test');
  e.spawnGuard = 999;
  g.enemies.push(e);
  return e;
}

console.log('=== 1) Órdenes tácticas al compañero (tecla T) ===');
{
  const g = campaignGame();
  const p = g.player!;
  // ciclo de modos
  g.companion = g.makeCompanion();
  const c = g.companion;
  assert(!c.mode, 'sin orden previa la compañera usa el modo por defecto (seguir)');
  assert(cycleCompanionMode(g) === 'agresivo' && c.mode === 'agresivo', 'T: seguir → agresivo');
  assert(cycleCompanionMode(g) === 'defensivo' && c.mode === 'defensivo', 'T: agresivo → defensivo');
  assert(cycleCompanionMode(g) === 'seguir' && (c.mode === 'seguir'), 'T: defensivo → seguir');

  // agresivo: busca al enemigo con aggro más cercano (radio 6 tiles) y ataca
  c.mode = 'agresivo';
  c.hp = c.maxHp;
  const sk = g.makeEnemy('esqueleto', CX + 60, CY, 0, 'test');
  sk.aggro = true;
  g.enemies.push(sk);
  tick(g, 0.2);
  assert(g.projectiles.some(pr => pr.from === 'companion'), 'agresivo: la compañera abre fuego');
  const d0 = Math.hypot(sk.x - c.x, sk.y - c.y);
  tick(g, 2);
  const d1 = Math.hypot(sk.x - c.x, sk.y - c.y);
  assert(d1 < d0 - 5, `agresivo: aborda al objetivo (${d0.toFixed(0)} → ${d1.toFixed(0)} px)`);

  // agresivo: retirada bajo 30% de vida → vuelve a la escolta del Portador
  c.hp = c.maxHp * 0.2;
  c.x = CX + 70; c.y = CY; // la alejamos a propósito: la escolta debe traerla
  tick(g, 1.5);
  assert(Math.hypot(p.x - c.x, p.y - c.y) <= 34, 'agresivo: con HP<30% vuelve al Portador (escolta original)');
  c.hp = c.maxHp;
  g.enemies = [];

  // defensivo: guarda a 2 tiles y solo dispara a enemigos a <2 tiles del Portador
  c.mode = 'defensivo';
  c.x = CX + 80; c.y = CY;
  tick(g, 1);
  assert(Math.hypot(p.x - c.x, p.y - c.y) <= 34, 'defensivo: se queda a 2 tiles del Portador');
  const far = frozenLobo(g, CX + 90, CY);
  far.aggro = true;
  g.projectiles.length = 0;
  tick(g, 0.5);
  assert(g.projectiles.length === 0, 'defensivo: NO dispara a un enemigo a >2 tiles del Portador');
  // contraste: en seguir sí dispara (escolta clásica intacta) — la flecha
  // puede impactar dentro de la ventana, así que la buscamos frame a frame
  c.mode = 'seguir';
  let sawArrow = false;
  for (let i = 0; i < 20 && !sawArrow; i++) {
    g.update(1 / 60);
    if (g.projectiles.some(pr => pr.from === 'companion')) sawArrow = true;
  }
  assert(sawArrow, 'seguir: el comportamiento original se conserva (dispara)');
  g.enemies = [];

  // INTERPOSICIÓN: defensivo + compañera a <1.5 tiles + golpe melé → 50% a ella
  tick(g, 6.2); // cooldown de interposición a cero
  c.mode = 'defensivo';
  const lobo = frozenLobo(g, p.x + 8, p.y);
  // pump que mantiene al lobo vivo (las flechas de Ilwen no deben matar al
  // maniquí) y limpia proyectiles, para mediciones quirúrgicas
  const tickKeep = (secs: number) => {
    for (let i = 0; i < Math.round(secs * 60); i++) {
      lobo.hp = 200; lobo.dead = false;
      g.projectiles.length = 0;
      g.update(1 / 60);
    }
  };
  const hitOnce = () => {
    p.x = CX; p.y = CY;         // anula el empuje del golpe anterior
    c.x = p.x - 14; c.y = p.y;  // compañera a 14 px (< 1.5 tiles)
    lobo.hp = 200;
    g.projectiles.length = 0;
    p.iframes = 0; p.parryT = 0; p.rollT = 0;
    const hpP = p.hp, hpC = c.hp;
    g.damagePlayer(10, lobo.x, lobo.y);
    return { pLoss: hpP - p.hp, cLoss: hpC - c.hp };
  };
  p.hp = p.maxHp; c.hp = c.maxHp;
  let r = hitOnce();
  assert(r.pLoss === 5 && r.cLoss === 5, `interposición: Portador −5 / compañera −5 (50% de 10) [got ${r.pLoss}/${r.cLoss}]`);
  tickKeep(0.7); // iframes fuera, cooldown de 6 s sigue vivo
  r = hitOnce();
  assert(r.pLoss === 10 && r.cLoss === 0, `cooldown 6 s: el 2º golpe entra completo [got ${r.pLoss}/${r.cLoss}]`);
  tickKeep(6.1); // cooldown consumido
  r = hitOnce();
  assert(r.pLoss === 5 && r.cLoss === 5, `tras 6 s la interposición vuelve a funcionar [got ${r.pLoss}/${r.cLoss}]`);
  // no interposición fuera del modo defensivo
  c.mode = 'seguir';
  tickKeep(6.1);
  r = hitOnce();
  assert(r.pLoss === 10 && r.cLoss === 0, 'con orden SEGUIR no hay interposición');
  // no interposición con la compañera lejos (>1.5 tiles = 24 px)
  // (hitOnce la recoloca cerca: para la prueba de distancia golpeamos a mano)
  c.mode = 'defensivo';
  tickKeep(6.1);
  {
    p.x = CX; p.y = CY;
    c.x = p.x - 60; c.y = p.y; // lejos: 60 px > 24 px (1.5 tiles)
    lobo.hp = 200;
    g.projectiles.length = 0;
    p.iframes = 0; p.parryT = 0; p.rollT = 0;
    const hpP2 = p.hp, hpC2 = c.hp;
    g.damagePlayer(10, lobo.x, lobo.y);
    assert(hpP2 - p.hp === 10 && hpC2 - c.hp === 0, 'con la compañera a >1.5 tiles no hay interposición');
  }
  // y SI la acercamos de nuevo, vuelve a interponerse (distancia es la condición;
  // el golpe anterior no consumió cooldown porque no hubo interposición)
  c.hp = c.maxHp;
  r = hitOnce();
  assert(r.pLoss === 5 && r.cLoss === 5, 'recuperada la distancia (<1.5 tiles), interposición activa');
  g.enemies = [];
}

console.log('=== 2) Señuelo (tecla 8): aggro redirigido 5 s, jefe inmune ===');
{
  const g = campaignGame();
  const p = g.player!;
  // sin señuelos → no vuela
  g.flags.sennuelos = 0;
  assert(!useSenno(g), 'sin señuelos: useSenno devuelve false y avisa');
  // lanzamiento + atracción (lobo NORMAL: los congelados por spawnGuard son
  // inmunes por diseño, igual que durante el spawn real)
  g.flags.sennuelos = 3;
  const lobo = g.makeEnemy('lobo', CX, CY + 130, 0, 'test'); // fuera del aggroR (95), dentro del radio del señuelo (88 del aterrizaje)
  g.enemies.push(lobo);
  assert(useSenno(g), 'con señuelos: vuela');
  assert(Number(g.flags.sennuelos) === 2, 'el señuelo se consume (stack 3 → 2)');
  const dec = __iDecoy(g);
  assert(dec.active && Math.abs(dec.x - CX) < 1 && Math.abs(dec.y - (CY + 48)) < 1, 'el señuelo aterriza 3 tiles adelante (abajo)');
  assert(lobo.aggro === true && lobo.lured !== undefined, 'enemigo no-jefe cercano: aggro + e.lured fijados');
  tick(g, 0.5);
  const decNow = __iDecoy(g);
  const dLure = Math.hypot(lobo.x - decNow.x, lobo.y - decNow.y);
  assert(lobo.lured !== undefined && lobo.lured < 5 && lobo.lured > 4, `el timer de atracción decae (${(lobo.lured ?? 0).toFixed(2)} s)`);
  assert(dLure < 80, `el enemigo camina hacia el señuelo (dist ${dLure.toFixed(0)} px < 80)`);
  tick(g, 4.8); // total > 5 s
  assert(lobo.lured === undefined, 'a los 5 s el señuelo expira (e.lured a undefined)');
  assert(!__iDecoy(g).active, 'el señuelo desaparece al expirar (pool de 1)');
  assert(lobo.aggro, 'tras el señuelo el enemigo sigue en combate (aggro intacta)');
  g.enemies = [];

  // jefe inmune (aunque esté pegado al aterrizaje)
  g.flags.sennuelos = 2;
  const boss = g.makeEnemy('guardian', CX, CY + 48, 0, 'test');
  g.enemies.push(boss);
  assert(useSenno(g), 'señuelo lanzado junto a un jefe');
  assert(boss.lured === undefined, 'el JEFE nunca queda señuelizado (inmune)');
  g.enemies = [];
  __iReset(g); // el señuelo anterior expira (pool de 1: solo estado)

  // aggro en jefe (bossActive): TODOS los enemigos ignoran señuelos
  g.flags.sennuelos = 2;
  g.bossActive = true;
  const lobo2 = g.makeEnemy('lobo', CX, CY + 130, 0, 'test');
  g.enemies.push(lobo2);
  useSenno(g);
  assert(lobo2.aggro === false && lobo2.lured === undefined, 'con aggro en jefe (bossActive) nadie muerde el señuelo');
  g.bossActive = false;
  g.enemies = [];
}

console.log('=== 3) Examen de restos (E): 25% → 1-5 coronas, una vez por cadáver ===');
{
  const g = campaignGame();
  const p = g.player!;

  // rng forzado: 0.1 < 0.25 → botín de 1 a 5 coronas (determinista)
  __iForceRng(() => 0.1);
  const e1 = g.makeEnemy('lobo', CX + 4, CY, 0, 'test');
  g.enemies.push(e1);
  const gold0 = p.gold;
  g.killEnemy(e1);
  const goldKill = p.gold - gold0; // oro propio del kill (rng 0.1 → 4 coronas)
  g.tryInteract();
  const gain = p.gold - gold0 - goldKill;
  assert(gain >= 1 && gain <= 5, `examen con rng forzado 0.1: botín en [1,5] (got ${gain})`);
  // una sola vez por cadáver
  const before2 = p.gold;
  g.tryInteract();
  assert(p.gold === before2, 'reexaminar el MISMO cadáver no da nada (flag en la entidad)');
  assert(g.toasts.some(t => t.text.includes('No hay nada que interactuar')), 'y la cadena cae en el mensaje por defecto');

  // rng forzado 0.9 → sin botín
  __iForceRng(() => 0.9);
  const e2 = g.makeEnemy('lobo', CX - 4, CY, 0, 'test');
  g.enemies.push(e2);
  g.killEnemy(e2);
  const before3 = p.gold;
  g.tryInteract();
  assert(p.gold === before3, 'examen con rng forzado 0.9: nada útil (75%)');

  // radio: un cadáver a >0.8 tile NO se examina
  const e3 = g.makeEnemy('lobo', CX + 100, CY, 0, 'test');
  g.enemies.push(e3);
  g.killEnemy(e3);
  assert(!interaccionInteract16b(g), 'cadáver a >0.8 tile: fuera de alcance');

  // FuerzaBruta con Math.random real: N intentos, verificando rango y proporción
  __iForceRng(null);
  let gains = 0;
  let rangeOk = true;
  for (let i = 0; i < 30; i++) {
    const ei = g.makeEnemy('lobo', CX + (i % 3), CY, 0, 'test');
    g.enemies.push(ei);
    g.killEnemy(ei);
    const before = p.gold;
    g.tryInteract();
    const d = p.gold - before;
    if (d > 0) { gains++; if (d < 1 || d > 5) rangeOk = false; }
  }
  assert(rangeOk, `FuerzaBruta (30 intentos, Math.random): todo botín en [1,5]`);
  assert(gains >= 2 && gains <= 20, `FuerzaBruta: ${gains}/30 éxitos ≈ 25% (25% forzado, sin rng inyectado)`);
  __iForceRng(null);
  g.enemies = [];
}

console.log('=== 4) Cofres ya abiertos: reinteractuar cuenta, no lootea ===');
{
  const g = campaignGame();
  const p = g.player!;
  const ch = g.map.chests.find(c => c.id === 'l3')!;
  g.openChest('l3'); // motor: loot una vez
  const goldAfterOpen = p.gold, potAfterOpen = p.potions;
  p.x = ch.x * 16 + 8; p.y = ch.y * 16 + 8;
  g.tryInteract();
  assert(p.gold === goldAfterOpen && p.potions === potAfterOpen, 'reinteractuar un cofre abierto NO da loot');
  assert(g.toasts.some(t => t.text.includes('vacío')), 'y suelta el texto «vacío… pero huele a antes»');
  // reintentos infinitos: sigue respondiendo (interactuable para siempre)
  g.tryInteract();
  assert(g.toasts.some(t => t.text.includes('vacío')), 'y puede repetirse sin límite');
}

console.log('=== 5) Rumor al re-pulsar E tras un diálogo (cooldown 60 s por NPC) ===');
{
  const g = campaignGame();
  const p = g.player!;
  p.x = 23 * 16 + 8; p.y = 13 * 16 + 8; // junto a Brisa
  g.tryInteract();
  assert(g.state === 'dialogue', 'E junto a Brisa abre el diálogo (pipeline original intacto)');
  g.closeDialogue();
  const floats0 = g.floats.length;
  g.tryInteract();
  assert(g.state === 'play' && g.dlgKey === null, 'E de nuevo tras el diálogo: NO reabre el diálogo');
  assert(g.floats.length > floats0 && g.floats[g.floats.length - 1].text.includes('Anciana Brisa: «'),
    'y suelta un rumor corto firmado por la NPC');
  // cooldown 60 s: el rumor no se repite; E vuelve a abrir el diálogo normal
  g.tryInteract();
  assert(g.state === 'dialogue', 'inmediatamente después, E reabre el diálogo (cooldown 60 s)');
  g.closeDialogue();
  g.tryInteract();
  assert(g.state === 'dialogue', 'dentro de los 60 s el rumor no se repite');
  // ventana de 2.5 s: pasado un rato, E vuelve a comportarse como siempre
  g.closeDialogue();
  tick(g, 3);
  g.tryInteract();
  assert(g.state === 'dialogue', 'pasada la ventana de 2.5 s, E abre el diálogo normal');
  g.closeDialogue();
}

console.log('=== 6) save/load preserva companion.mode (+ tolerancia saves antiguos) ===');
{
  const g = campaignGame();
  g.companion = g.makeCompanion();
  g.companion.mode = 'defensivo';
  g.save();
  const raw = JSON.parse(store.get('ecos-aelthar-save')!);
  assert(raw.companion === true && raw.companionMode === 'defensivo', 'save() serializa companionMode');

  const g2 = new Game(makeCanvas());
  g2.continueGame();
  assert(!!g2.companion && g2.companion.mode === 'defensivo', 'continueGame restaura la orden táctica (defensivo)');

  // save antiguo SIN companionMode (ni stats) → default seguro 'seguir'
  delete raw.companionMode;
  delete raw.stats;
  store.set('ecos-aelthar-save', JSON.stringify(raw));
  const g3 = new Game(makeCanvas());
  g3.continueGame();
  assert(!!g3.companion && g3.companion.mode === undefined, 'save antiguo sin companionMode: la compañera existe sin orden (seguir)');
  assert(cycleCompanionMode(g3) === 'agresivo', 'y el ciclo de órdenes funciona igual de cero');
}

console.log('=== 7) Estabilidad: 600 frames con todo activo (sin lanzar) ===');
{
  const g = campaignGame();
  const p = g.player!;
  g.companion = g.makeCompanion();
  g.companion.mode = 'agresivo';
  const e = frozenLobo(g, CX + 60, CY + 40);
  e.aggro = true;
  g.flags.sennuelos = 2;
  useSenno(g);
  let threw = false;
  try { tick(g, 10); } catch (err) { threw = true; console.log(String(err)); }
  assert(!threw, '600 frames con compañero agresivo + señuelo + cadáveres: sin excepciones');
  assert(e.lured === undefined, 'tras 10 s todo timer transitorio quedó limpio');
  const st0 = p.hp; p.iframes = 0;
  g.damagePlayer(10, e.x, e.y);
  assert(p.hp < st0, 'el motor sigue dañando al Portador con normalidad');
}

console.log(fails === 0 ? '\nSMOKE INTERACCIÓN: TODO OK' : `\nSMOKE INTERACCIÓN: ${fails} FALLOS`);
if (fails > 0) process.exitCode = 1;
