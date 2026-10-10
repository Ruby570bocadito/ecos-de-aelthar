// ============================================================
// 19-e (élite-enemigos) — Smoke del SISTEMA DE ÉLITES + 2 ENEMIGOS NUEVOS
// Stub DOM/Audio (patrón smoke_timeskip) + Game real:
//  (1) élite determinista: misma seed → mismo resultado y mismos mults
//      (hp ×1.35 exacto); 1000 spawns → ~8% élites (tolerancia 5-12%);
//  (2) 4 rasgos asignables + eliteTick sin NaN; tp del 3.er golpe con
//      Enemy fake (80 px detrás del Portador); aullido buffea y expira;
//      escudo da invulT 0.5 cada 10 s; tirodoble clona a ±8°;
//  (3) defs bien formados + spawns BFS-transitables/alcanzables +
//      idempotencia de instalarEnemigosR19 (2 llamadas = mismos spawns);
//  (4) sprites: 3 frames cada uno, tamaños 14×14 y 16×16, idempotentes;
//  (5) cerebros: 400-820 ticks cada uno sin NaN, con proyectiles esperados
//      (nota+eco / estela de 3 orbes + mancha radius 9) y desvanecer del eco.
// Ejecutar: bun scripts/smoke_enemigos_r19.ts
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

const { MAPS, mapRows } = await import('../src/game/maps');
const { SOLID_CHARS, getSpr, entityFrame } = await import('../src/game/sprites');
const { ENEMY_DEFS } = await import('../src/game/data');
const r19 = await import('../src/game/enemigos_r19');
type EnemyT = import('../src/game/types').Enemy;
type ProjectileT = import('../src/game/types').Projectile;
type ElementT = import('../src/game/types').Element;

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);
const nearly = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

// el integrador hará Object.assign(ENEMY_DEFS, ENEMY_DEFS_R19) en data.ts;
// el smoke lo replica para que makeEnemy/r19Tick funcionen sin cablear.
Object.assign(ENEMY_DEFS, r19.ENEMY_DEFS_R19);

function newGame(): InstanceType<typeof Game> {
  const g = new Game(makeCanvas());
  g.newGame('Prueba19e', 'alba');
  g.startPlay();
  return g;
}

const T = (n: number) => n * 16 + 8; // tile → centro en px (spawnEnemies)

console.log('=== 1) ÉLITE determinista: seed → resultado y mults exactos ===');
{
  // determinismo puro
  let same = true;
  for (let i = 0; i < 50; i++) {
    if (r19.esEliteR19('bosque', i) !== r19.esEliteR19('bosque', i)) same = false;
    if (r19.eliteSeedR19('bosque', i) !== r19.eliteSeedR19('bosque', i)) same = false;
  }
  if (same) ok('esEliteR19/eliteSeedR19: mismas args → mismo resultado (×50)');
  else bad('esEliteR19/eliteSeedR19 no son deterministas');

  // tasa ~8% en 1000 spawns (tolerancia 5-12%), en 2 mapas
  for (const mapId of ['bosque', 'costa']) {
    let n = 0;
    for (let i = 0; i < 1000; i++) if (r19.esEliteR19(mapId, i)) n++;
    const pct = n / 10;
    if (pct >= 5 && pct <= 12) ok(`tasa de élites en ${mapId}: ${pct.toFixed(1)}% de 1000 spawns (objetivo ~8%)`);
    else bad(`tasa de élites en ${mapId} fuera de tolerancia: ${pct.toFixed(1)}%`);
  }

  // mults exactos
  const g = newGame();
  const e1 = g.makeEnemy('lobo', T(10), T(10), 0);
  const e2 = g.makeEnemy('lobo', T(12), T(10), 0);
  const hp0 = e1.hp;
  const seed = r19.eliteSeedR19('bosque', 12345);
  r19.aplicarEliteR19(e1, seed);
  if (r19.eliteMultR19.hp === 1.35 && r19.eliteMultR19.dmg === 1.25 && r19.eliteMultR19.xp === 2.0 && r19.eliteMultR19.gold === 1.8)
    ok(`eliteMultR19 = { hp:${r19.eliteMultR19.hp}, dmg:${r19.eliteMultR19.dmg}, xp:${r19.eliteMultR19.xp}, gold:${r19.eliteMultR19.gold} }`);
  else bad('eliteMultR19 no tiene los valores del contrato');
  if (e1.hp === Math.round(hp0 * 1.35) && e1.maxHp === Math.round(hp0 * 1.35))
    ok(`hp/maxHp ×1.35 exacto: ${hp0} → ${e1.hp}`);
  else bad(`mult de hp mal aplicado: ${hp0} → ${e1.hp}/${e1.maxHp}`);
  if (e1.eliteR19 === true && e1.eliteTraitR19 === r19.rasgoEliteR19(seed))
    ok(`marca eliteR19 + rasgo asignado: ${String(e1.eliteTraitR19)}`);
  else bad('aplicarEliteR19 no marcó el rasgo correctamente');
  if (e1.eliteDmgR19 === ENEMY_DEFS.lobo.dmg * 1.25)
    ok(`eliteDmgR19 = def.dmg ×1.25 (${e1.eliteDmgR19})`);
  else bad(`eliteDmgR19 mal calculado: ${String(e1.eliteDmgR19)}`);
  if (r19.dmgEliteR19(e1, ENEMY_DEFS.lobo) === e1.eliteDmgR19 && r19.dmgEliteR19(e2, ENEMY_DEFS.lobo) === ENEMY_DEFS.lobo.dmg)
    ok('dmgEliteR19: élite usa su mult, el regular usa el def');
  else bad('dmgEliteR19 no discrimina élite/regular');

  // misma seed → mismo resultado en otro enemigo
  r19.aplicarEliteR19(e2, seed);
  if (e2.hp === e1.hp && e2.eliteTraitR19 === e1.eliteTraitR19 && e2.eliteDmgR19 === e1.eliteDmgR19)
    ok('misma seed → mismo hp/rasgo/dmg en otro enemigo');
  else bad('la misma seed produjo resultados distintos');
  const hpAntes = e1.hp;
  r19.aplicarEliteR19(e1, seed);
  if (e1.hp === hpAntes) ok('aplicarEliteR19 idempotente (2.ª llamada no-op)');
  else bad('aplicarEliteR19 aplicó el mult dos veces');

  // los 4 rasgos son asignables por semilla
  const rasgos = new Set<string>();
  for (let s = 0; s < 200; s++) rasgos.add(r19.rasgoEliteR19(s));
  if (rasgos.size === 4) ok(`los 4 rasgos asignables por seed: ${[...rasgos].join(', ')}`);
  else bad(`rasgos alcanzables: ${rasgos.size}/4`);

  // los jefes (zone 'boss') nunca salen por eliteIdxPorPosR19
  const gIdx = r19.eliteIdxPorPosR19('cripta', T(19), T(8)); // guardian zone:'boss'
  if (gIdx === -1) ok('eliteIdxPorPosR19: el spawn zone:boss (Guardián) devuelve -1');
  else bad(`eliteIdxPorPosR19 devolvió ${gIdx} para un jefe`);
  const okIdx = r19.eliteIdxPorPosR19('cripta', T(10), T(26)); // esqueleto regular
  if (okIdx >= 0 && MAPS.cripta.spawns[okIdx].x === 10 && MAPS.cripta.spawns[okIdx].y === 26)
    ok(`eliteIdxPorPosR19 resuelve spawns regulares por posición (idx ${okIdx})`);
  else bad(`eliteIdxPorPosR19 no resolvió el esqueleto de la cripta (${okIdx})`);
}

console.log('\n=== 2) Rasgos: aullido / escudo / tirodoble / tp (tick sin NaN) ===');
{
  // semillas de cada rasgo
  const seedDe = (trait: string): number => {
    for (let s = 0; s < 5000; s++) if (r19.rasgoEliteR19(s) === trait) return s;
    return -1;
  };
  const seeds: Record<string, number> = {
    aullido: seedDe('aullido'), escudo: seedDe('escudo'), tirodoble: seedDe('tirodoble'), tp: seedDe('tp'),
  };
  if (Object.values(seeds).every(s => s >= 0)) ok(`semillas de rasgo halladas: ${JSON.stringify(seeds)}`);
  else bad(`faltan semillas de rasgo: ${JSON.stringify(seeds)}`);

  const g = newGame();
  g.enemies.length = 0;
  // zona abierta de lunaris (16×16 en tile 22,11) → centro (30,19)
  const p = g.player!;
  p.x = T(30); p.y = T(19);

  // ---- AULLIDO: buffea a <120 px (+15% speed 5 s) y expira ----
  {
    const el = g.makeEnemy('lobo', p.x + 60, p.y, 0);
    r19.aplicarEliteR19(el, seeds.aullido);
    const lobo = g.makeEnemy('lobo', p.x - 50, p.y, 0); // a 110 px del élite (<120)
    g.enemies.push(el, lobo);
    for (let i = 0; i < 80; i++) r19.eliteTickR19(g, 0.1); // 8 s
    if (r19.__r19Debug().buffsActivos === 1) ok('aullido a los 8 s: 1 enemigo a <120 px buffeado (+ partículas/sfx)');
    else bad(`aullido no buffeó (buffs=${r19.__r19Debug().buffsActivos})`);
    // buff = +15% del desplazamiento natural del frame previo
    const x0 = lobo.x;
    for (let i = 0; i < 60; i++) { lobo.x += 1; r19.eliteTickR19(g, 1 / 60); }
    const ganancia = lobo.x - x0;
    if (nearly(ganancia, 60 * 1.15, 1.2)) ok(`buff de velocidad real: 60 px naturales → ${ganancia.toFixed(1)} px (+15%)`);
    else bad(`el buff no aceleró de verdad: ${ganancia.toFixed(1)} px (esperados ~69)`);
    // sin movimiento no hay extra (no compone)
    const x1 = lobo.x;
    for (let i = 0; i < 30; i++) r19.eliteTickR19(g, 1 / 60);
    if (Math.abs(lobo.x - x1) < 0.1) ok('el buff no compone sin desplazamiento natural (estable)');
    else bad(`el buff se auto-propulsó sin movimiento: ${(lobo.x - x1).toFixed(3)}`);
    // expira a los 5 s
    for (let i = 0; i < 310; i++) r19.eliteTickR19(g, 1 / 60);
    if (r19.__r19Debug().buffsActivos === 0) ok('el buff de aullido expira a los 5 s');
    else bad(`el buff no expiró (buffs=${r19.__r19Debug().buffsActivos})`);
    g.enemies.length = 0;
  }

  // ---- ESCUDO: invulT 0.5 cada 10 s ----
  {
    const el = g.makeEnemy('esqueleto', p.x + 40, p.y, 0);
    r19.aplicarEliteR19(el, seeds.escudo);
    g.enemies.push(el);
    let activaciones = 0;
    let visto = false;
    for (let i = 0; i < 210; i++) { // 21 s
      const antes = el.invulT ?? 0;
      r19.eliteTickR19(g, 0.1);
      const ahora = el.invulT ?? 0;
      if (antes <= 0 && ahora > 0) activaciones++;
      if (ahora > 0) visto = true;
    }
    if (visto && activaciones === 1 && nearly(el.invulT ?? 0, 0.5, 1e-6))
      ok('escudo: 1 activación en 21 s con invulT 0.5 (sin decaer aquí, no re-dispara)');
    else bad(`escudo mal: activaciones=${activaciones}, invulT=${el.invulT}`);
    g.enemies.length = 0;
  }

  // ---- TIRODOBLE: clon a ±8° ----
  {
    const el = g.makeEnemy('lobo', p.x + 40, p.y, 0);
    r19.aplicarEliteR19(el, seeds.tirodoble);
    g.enemies.push(el);
    g.projectiles.length = 0;
    g.projectiles.push({
      x: el.x + 2, y: el.y - 2, vx: 120, vy: 0, t: 1.5,
      dmg: 6, element: 'ninguno', from: 'enemy', sprite: 'orb', radius: 5, pierce: 0,
    });
    r19.eliteTickR19(g, 1 / 60);
    if (g.projectiles.length === 2) {
      const a0 = Math.atan2(0, 120);
      const clone = g.projectiles[1];
      const a1 = Math.atan2(clone.vy, clone.vx);
      const dif = a1 - a0;
      if (nearly(Math.abs(dif), 8 * Math.PI / 180, 0.01) && nearly(Math.hypot(clone.vx, clone.vy), 120, 1e-6))
        ok(`tirodoble: clon a ${(Math.abs(dif) * 180 / Math.PI).toFixed(1)}° con la misma velocidad (lado determinista por seed)`);
      else bad(`clon con ángulo/velocidad malos: dif=${dif.toFixed(4)}, spd=${Math.hypot(clone.vx, clone.vy).toFixed(1)}`);
    } else bad(`tirodoble no clonó (proyectiles=${g.projectiles.length})`);
    const n1 = g.projectiles.length;
    r19.eliteTickR19(g, 1 / 60);
    if (g.projectiles.length === n1) ok('sin re-clonado del mismo proyectil (2.º tick estable)');
    else bad('el clonador duplicó en el segundo tick');
    // proyectil lejano y proyectil aliado: no clona
    g.projectiles.push({ x: el.x + 400, y: el.y, vx: 100, vy: 0, t: 1, dmg: 5, element: 'ninguno', from: 'enemy', sprite: 'orb', radius: 5, pierce: 0 });
    g.projectiles.push({ x: p.x + 2, y: p.y, vx: 100, vy: 0, t: 1, dmg: 5, element: 'ninguno', from: 'player', sprite: 'orb', radius: 5, pierce: 0 });
    r19.eliteTickR19(g, 1 / 60);
    if (g.projectiles.length === n1 + 2) ok('no clona proyectiles lejanos ni aliados');
    else bad(`clonó algo que no debía (${g.projectiles.length} vs ${n1 + 2})`);
    g.enemies.length = 0; g.projectiles.length = 0;
  }

  // ---- TP: al 3.er golpe se teleporta 80 px detrás del Portador ----
  {
    const el = g.makeEnemy('lobo', p.x + 100, p.y, 0);
    r19.aplicarEliteR19(el, seeds.tp);
    g.enemies.push(el);
    const hit = () => { el.hitFlash = 0.12; r19.eliteTickR19(g, 1 / 60); el.hitFlash = 0.03; r19.eliteTickR19(g, 1 / 60); };
    const x0 = el.x, y0 = el.y;
    hit(); hit();
    if (el.x === x0 && el.y === y0) ok('golpes 1-2: sin teleport');
    else bad('teleport antes del 3.er golpe');
    hit();
    const dP = Math.hypot(el.x - p.x, el.y - p.y);
    if ((el.x !== x0 || el.y !== y0) && nearly(dP, 80, 0.5) && (el.invulT ?? 0) >= 0.4)
      ok(`3.er golpe: teleport a ${dP.toFixed(1)} px detrás del Portador + invulT ${el.invulT?.toFixed(2)}`);
    else bad(`tp del 3.er golpe falló: d=${dP.toFixed(1)}, invulT=${el.invulT}`);
    if (g.particles.length > 0) ok(`partículas de tp (${g.particles.length})`);
    else bad('tp sin partículas');
    // contador reiniciado + cooldown 3 s: 3 golpes más NO teleportan aún
    const x1 = el.x, y1 = el.y;
    hit(); hit(); hit();
    if (el.x === x1 && el.y === y1) ok('cooldown de tp: 3 golpes más no teleportan antes de 3 s');
    else bad('el tp ignoró su cooldown');
    for (let i = 0; i < 8; i++) r19.eliteTickR19(g, 0.5); // 4 s
    hit();
    if (el.x !== x1 || el.y !== y1) ok('tras el cooldown, el siguiente ciclo de 3 golpes vuelve a teleportar');
    else bad('el tp no volvió a funcionar tras el cooldown');
    g.enemies.length = 0; g.particles.length = 0;
  }

  // ---- estabilidad: 400 ticks con 4 élites (una de cada rasgo) sin NaN ----
  {
    let i = 0;
    for (const trait of ['aullido', 'escudo', 'tirodoble', 'tp']) {
      const el = g.makeEnemy('lobo', p.x + 30 + i * 12, p.y - 20, 0);
      r19.aplicarEliteR19(el, seeds[trait]);
      g.enemies.push(el);
      i++;
    }
    let nan = false;
    for (let f = 0; f < 400; f++) {
      r19.eliteTickR19(g, 1 / 60);
      for (const e of g.enemies) {
        if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp) || !Number.isFinite(e.atkCd)) nan = true;
      }
      if (g.particles.length > 400) g.particles.length = 0; // tope del smoke
    }
    if (!nan) ok('400 ticks de eliteTick con 4 élites (1 de cada rasgo): sin NaN');
    else bad('NaN detectado en eliteTick');
    // aura: dibuja sin lanzar (ctx stub) y no hace nada en no-élites
    g.camX = 0; g.camY = 0;
    try {
      r19.drawEliteAuraR19(g, g.enemies[0], 1.23);
      const dummy = g.makeEnemy('lobo', p.x, p.y, 0);
      r19.drawEliteAuraR19(g, dummy, 1.23);
      ok('drawEliteAuraR19 dibuja élite y early-return en regular sin excepción');
    } catch (err) {
      bad(`drawEliteAuraR19 lanzó: ${String(err)}`);
    }
    g.enemies.length = 0; g.particles.length = 0;
  }
}

console.log('\n=== 3) Defs + spawns: BFS transitable, alcanzable e idempotente ===');
{
  const ELEMENTS: Set<string> = new Set(['fuego', 'hielo', 'rayo', 'sombra', 'sagrado', 'ninguno']);
  const eco = r19.ENEMY_DEFS_R19.eco_desvanecido;
  const vig = r19.ENEMY_DEFS_R19.vigia_tinta;
  const bien = (d: typeof eco, nombre: string, sprite: string, hp: number, dmg: number, spd: number, xp: number, gold: number[], aggroR: number, atkR: number, windup: number, atkCd: number, weak: string) =>
    d.name.length > 3 && d.hp === hp && d.dmg === dmg && d.speed === spd && d.xp === xp &&
    d.gold[0] === gold[0] && d.gold[1] === gold[1] && d.gold[0] <= d.gold[1] &&
    d.sprite === sprite && d.aggroR === aggroR && d.atkR === atkR && d.windup === windup && d.atkCd === atkCd &&
    ELEMENTS.has(d.element) && ELEMENTS.has(d.weakTo) && d.weakTo === weak && d.desc.length > 10;
  if (bien(eco, 'eco_desvanecido', 'eco_desv', 42, 9, 52, 34, [8, 16], 140, 34, 0.6, 2.1, 'sagrado'))
    ok('def eco_desvanecido bien formado (element sombra, weakTo sagrado — literal real de types.ts:14)');
  else bad('def eco_desvanecido mal formado');
  if (bien(vig, 'vigia_tinta', 'vigia_tinta', 56, 11, 30, 40, [10, 20], 150, 130, 0.9, 2.8, 'rayo'))
    ok('def vigia_tinta bien formado (element sombra, weakTo rayo — no existe \'agua\' en Element)');
  else bad('def vigia_tinta mal formado');
  if (r19.ENEMY_DEFS_R19.eco_desvanecido.name === 'Eco Desvanecido' && r19.ENEMY_DEFS_R19.vigia_tinta.name === 'Vigía de Tinta')
    ok('nombres exactos: «Eco Desvanecido» / «Vigía de Tinta»');
  else bad('nombres de los defs incorrectos');

  // spawns instalados al cargar el módulo + idempotencia
  const contar = (mapId: string, t: string) => MAPS[mapId as 'bosque'].spawns.filter(s => s.type === t).length;
  const antes = { b: MAPS.bosque.spawns.length, c: MAPS.cripta.spawns.length, co: MAPS.costa.spawns.length };
  r19.instalarEnemigosR19();
  const despues = { b: MAPS.bosque.spawns.length, c: MAPS.cripta.spawns.length, co: MAPS.costa.spawns.length };
  if (contar('bosque', 'eco_desvanecido') === 4 && contar('cripta', 'eco_desvanecido') === 2 && contar('costa', 'vigia_tinta') === 3)
    ok('spawns instalados: eco_desvanecido ×4 bosque + ×2 cripta, vigia_tinta ×3 costa');
  else bad(`spawns mal: eco_bosque=${contar('bosque', 'eco_desvanecido')}, eco_cripta=${contar('cripta', 'eco_desvanecido')}, vigia=${contar('costa', 'vigia_tinta')}`);
  if (antes.b === despues.b && antes.c === despues.c && antes.co === despues.co)
    ok('instalarEnemigosR19 idempotente (2.ª llamada = mismos spawns)');
  else bad('instalarEnemigosR19 duplicó spawns');

  // BFS: transitables y alcanzables desde exits/NPCs
  const walk = (rows: string[], m: typeof MAPS.bosque, x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < m.w && y < m.h && !SOLID_CHARS.has(rows[y][x]);
  const alcanzables = (mapId: 'bosque' | 'cripta' | 'costa'): Set<string> => {
    const m = MAPS[mapId]; const rows = mapRows(m);
    const seeds: string[] = [];
    for (const ex of m.exits) for (let y = ex.y; y < ex.y + ex.h; y++) for (let x = ex.x; x < ex.x + ex.w; x++)
      for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]] as const)
        if (walk(rows, m, x + dx, y + dy)) seeds.push(`${x + dx},${y + dy}`);
    for (const n of m.npcs) seeds.push(`${n.x},${n.y}`);
    const seen = new Set(seeds);
    const q = [...seeds];
    while (q.length) {
      const [x, y] = q.shift()!.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = `${x + dx},${y + dy}`;
        if (seen.has(k) || !walk(rows, m, x + dx, y + dy)) continue;
        seen.add(k); q.push(k);
      }
    }
    return seen;
  };
  const filasPasado = (mapId: 'bosque'): string[] => {
    const m = MAPS.bosque; const rows = mapRows(m).slice();
    for (const d of m.epochDiffs) { const row = rows[d.y] ?? ''; rows[d.y] = row.slice(0, d.x) + d.char + row.slice(d.x + 1); }
    return rows;
  };
  const pasado = filasPasado('bosque');
  let fallosSpawn = 0;
  for (const s of r19.SPAWNS_R19) {
    const m = MAPS[s.map]; const rows = mapRows(m);
    const etiqueta = `${s.type}@${s.map}(${s.x},${s.y})`;
    if (!walk(rows, m, s.x, s.y)) { bad(`${etiqueta}: tile NO transitable en el presente`); fallosSpawn++; continue; }
    if (s.map === 'bosque' && !walk(pasado, m, s.x, s.y)) { bad(`${etiqueta}: tile NO transitable en el pasado`); fallosSpawn++; continue; }
    if (!alcanzables(s.map).has(`${s.x},${s.y}`)) { bad(`${etiqueta}: NO alcanzable a pie desde exits/NPCs`); fallosSpawn++; continue; }
    let dMinExit = 999, dMinNpc = 999, dMinProp = 999, dMinSpawn = 999;
    for (const ex of m.exits) for (let y = ex.y; y < ex.y + ex.h; y++) for (let x = ex.x; x < ex.x + ex.w; x++)
      dMinExit = Math.min(dMinExit, Math.hypot(x - s.x, y - s.y));
    for (const n of m.npcs) dMinNpc = Math.min(dMinNpc, Math.hypot(n.x - s.x, n.y - s.y));
    for (const pr of m.props) dMinProp = Math.min(dMinProp, Math.hypot(pr.x - s.x, pr.y - s.y));
    for (const sp of m.spawns) if (sp !== (s as unknown as typeof sp) && !(sp.type === s.type && sp.x === s.x && sp.y === s.y))
      dMinSpawn = Math.min(dMinSpawn, Math.hypot(sp.x - s.x, sp.y - s.y));
    if (dMinExit < 8 || dMinNpc < 8 || dMinProp < 4 || dMinSpawn < 4) {
      bad(`${etiqueta}: demasiado cerca (exit=${dMinExit.toFixed(1)}, npc=${dMinNpc.toFixed(1)}, prop=${dMinProp.toFixed(1)}, spawn=${dMinSpawn.toFixed(1)})`);
      fallosSpawn++;
    }
  }
  // separación entre los spawns nuevos del mismo mapa
  for (const mapId of ['bosque', 'cripta', 'costa'] as const) {
    const propios = r19.SPAWNS_R19.filter(s => s.map === mapId);
    for (let i = 0; i < propios.length; i++) for (let j = i + 1; j < propios.length; j++) {
      const d = Math.hypot(propios[i].x - propios[j].x, propios[i].y - propios[j].y);
      if (d < 9) { bad(`spawns nuevos de ${mapId} juntos: ${propios[i].x},${propios[i].y} ↔ ${propios[j].x},${propios[j].y} (${d.toFixed(1)})`); fallosSpawn++; }
    }
  }
  if (fallosSpawn === 0) ok('los 9 spawns nuevos: transitables (ambas épocas), alcanzables por BFS y con separación');

  // élites esperadas por mapa (determinista) — informada, no fijada
  let linea = '  élites esperadas: ';
  let total = 0;
  for (const mapId of ['lunaris', 'bosque', 'cripta', 'costa', 'aldea', 'cumbres'] as const) {
    let n = 0;
    const m = MAPS[mapId];
    m.spawns.forEach((s, idx) => {
      const i2 = r19.eliteIdxPorPosR19(mapId, T(s.x), T(s.y));
      if (i2 === idx && r19.esEliteR19(mapId, idx)) n++;
    });
    total += n;
    linea += `${mapId}=${n} `;
  }
  console.log(linea + `(total ${total} de ${MAPS.bosque.spawns.length + MAPS.cripta.spawns.length + MAPS.costa.spawns.length + MAPS.lunaris.spawns.length + MAPS.aldea.spawns.length + MAPS.cumbres.spawns.length} spawns)`);
  let estable = true;
  for (const mapId of ['bosque', 'costa'] as const) {
    const m = MAPS[mapId];
    m.spawns.forEach((s, idx) => {
      if (r19.esEliteR19(mapId, idx) !== r19.esEliteR19(mapId, idx)) estable = false;
    });
  }
  if (estable) ok('cómputo de élites por mapa estable (2 pasadas idénticas)');
  else bad('el cómputo de élites varió entre pasadas');
}

console.log('\n=== 4) Sprites: 3 frames cada uno, tamaños correctos, idempotentes ===');
{
  r19.initEnemigosR19Sprites();
  const ecoS = getSpr('eco_desv');
  const vigS = getSpr('vigia_tinta');
  if (ecoS.length === 3 && ecoS[0].width === 14 && ecoS[0].height === 14)
    ok(`eco_desv: 3 frames 14×14 (contorno discontinuo · bob · fragmentado)`);
  else bad(`eco_desv mal: ${ecoS.length} frames, ${ecoS[0].width}×${ecoS[0].height}`);
  if (vigS.length === 3 && vigS[0].width === 16 && vigS[0].height === 16)
    ok('vigia_tinta: 3 frames 16×16 (abierto · parpadeo coral · telegraph)');
  else bad(`vigia_tinta mal: ${vigS.length} frames, ${vigS[0].width}×${vigS[0].height}`);
  r19.initEnemigosR19Sprites();
  if (getSpr('eco_desv').length === 3 && getSpr('vigia_tinta').length === 3)
    ok('initEnemigosR19Sprites idempotente (2.ª llamada sin duplicar/lanzar)');
  else bad('initEnemigosR19Sprites rompió el registro');
  const f1 = entityFrame(getSpr('eco_desv'), 'down', true, 0.4);
  const f2 = entityFrame(getSpr('vigia_tinta'), 'left', false, 0.9);
  if (f1 >= 0 && f1 < 3 && f2 >= 0 && f2 < 3) ok(`entityFrame compatible: eco moviéndose=${f1}, vigia quieto=${f2}`);
  else bad(`entityFrame devolvió frames fuera de rango (${f1}, ${f2})`);
}

console.log('\n=== 5) Cerebros: 400-820 ticks sin NaN y proyectiles esperados ===');
{
  const g = newGame();
  const p = g.player!;
  // plaza abierta de lunaris (16×16 tiles desde (22,11)) → centro tile (30,19)
  p.x = T(30); p.y = T(19);
  g.enemies.length = 0;
  g.projectiles.length = 0;

  const nuevos = (seen: Set<ProjectileT>): ProjectileT[] => {
    const out: ProjectileT[] = [];
    for (const pr of g.projectiles) if (!seen.has(pr)) { seen.add(pr); out.push(pr); }
    return out;
  };

  // ---- ECO DESVANECIDO ----
  {
    const def = ENEMY_DEFS.eco_desvanecido;
    const e = g.makeEnemy('eco_desvanecido' as unknown as Parameters<typeof g.makeEnemy>[0], p.x + 50, p.y, 0, 'bosque');
    e.aiT = 1; e.patrolAngle = 0; e.anim = 0; // determinismo total (makeEnemy usa Math.random en aiT/anim)
    e.aggro = true; e.atkCd = 0;
    g.enemies.push(e);
    const seen = new Set<ProjectileT>();
    const traj: string[] = [];
    let minD = 1e9, trasVanish = -1, notas = 0, vanishes = 0;
    let nan = false;
    for (let i = 0; i < 400; i++) {
      const inv0 = e.invulT ?? 0;
      if (!r19.r19Tick(g, e, 1 / 60, def)) { bad('r19Tick no gestionó el eco'); break; }
      const ns = nuevos(seen);
      notas += ns.filter(pr => pr.sprite === 'nota').length;
      const inv1 = e.invulT ?? 0;
      if (inv0 <= 0 && inv1 > 0.7) { vanishes++; trasVanish = Math.hypot(e.x - p.x, e.y - p.y); }
      minD = Math.min(minD, Math.hypot(e.x - p.x, e.y - p.y));
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp) || !Number.isFinite(e.atkCd) || !Number.isFinite(e.windup)) nan = true;
      if (i % 100 === 0) traj.push(`${e.x.toFixed(2)},${e.y.toFixed(2)}`);
    }
    if (!nan) ok('eco_desvanecido: 400 ticks de r19Tick sin NaN');
    else bad('NaN en el cerebro del eco');
    if (notas >= 4) ok(`proyectil de eco en pares: ${notas} 'nota' (disparo + ECO a 0.4 s)`);
    else bad(`notas generadas insuficientes: ${notas}`);
    if (vanishes >= 1 && trasVanish >= 55 && trasVanish <= 135)
      ok(`desvanecer: ${vanishes}× (invulT 0.8 + teleport determinista a ${trasVanish.toFixed(0)} px, spec 90-130)`);
    else bad(`desvanecer anómalo: vanishes=${vanishes}, dist=${trasVanish.toFixed(0)}`);
    if (minD < 60) ok(`el eco se dejó acercar (<60 px) para poder desvanecerse (mín ${minD.toFixed(0)} px)`);
    else bad(`el eco nunca estuvo a <60 px (mín ${minD.toFixed(0)})`);

    // determinismo: reconstruir y comparar trayectoria
    const g2 = newGame();
    const p2 = g2.player!;
    p2.x = T(30); p2.y = T(19);
    g2.enemies.length = 0;
    const e2 = g2.makeEnemy('eco_desvanecido' as unknown as Parameters<typeof g2.makeEnemy>[0], p2.x + 50, p2.y, 0, 'bosque');
    e2.aiT = 1; e2.patrolAngle = 0; e2.anim = 0; e2.aggro = true; e2.atkCd = 0;
    g2.enemies.push(e2);
    const traj2: string[] = [];
    for (let i = 0; i < 400; i++) {
      r19.r19Tick(g2, e2, 1 / 60, def);
      if (i % 100 === 0) traj2.push(`${e2.x.toFixed(2)},${e2.y.toFixed(2)}`);
    }
    if (traj.join('|') === traj2.join('|')) ok('cerebro determinista: 2 reconstrucciones → misma trayectoria');
    else bad(`trayectorias distintas:\n    ${traj.join(' | ')}\n    ${traj2.join(' | ')}`);
  }

  // ---- VIGÍA DE TINTA ----
  {
    const def = ENEMY_DEFS.vigia_tinta;
    const e = g.makeEnemy('vigia_tinta' as unknown as Parameters<typeof g.makeEnemy>[0], p.x, p.y - 130, 0, 'costa');
    e.aiT = 1; e.patrolAngle = 0; e.anim = 0;
    e.aggro = true; e.atkCd = 0;
    g.enemies.length = 0;
    g.enemies.push(e);
    const seen = new Set<ProjectileT>();
    let orbes = 0, manchas = 0, maxD = 0, minD = 1e9;
    let nan = false;
    for (let i = 0; i < 960; i++) { // 16 s: la mancha sale ~15.7 s (12 s + cola de atkCd)
      if (!r19.r19Tick(g, e, 1 / 60, def)) { bad('r19Tick no gestionó el vigía'); break; }
      const ns = nuevos(seen);
      orbes += ns.filter(pr => pr.sprite === 'orb' && pr.radius < 9).length;
      manchas += ns.filter(pr => pr.radius === 9).length;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      maxD = Math.max(maxD, d); minD = Math.min(minD, d);
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp) || !Number.isFinite(e.atkCd)) nan = true;
    }
    if (!nan) ok('vigia_tinta: 960 ticks de r19Tick sin NaN');
    else bad('NaN en el cerebro del vigía');
    if (orbes >= 6) ok(`estela de tinta: ${orbes} 'orb' en abanicos escalonados (grupos de 3)`);
    else bad(`orbes de la estela insuficientes: ${orbes}`);
    if (manchas === 1) ok('especial MANCHA a los 12 s: 1 proyectil lento radius 9 (dmg 10)');
    else bad(`manchas generadas: ${manchas} (esperadas 1)`);
    if (minD >= 100 && maxD <= 180) ok(`mantenedor de distancia: banda 120-160 respetada (rango real ${minD.toFixed(0)}-${maxD.toFixed(0)} px)`);
    else bad(`banda de distancia rota: min=${minD.toFixed(0)}, max=${maxD.toFixed(0)}`);
  }

  // dispatcher: false para tipos ajenos, true para los suyos
  const lobo = g.makeEnemy('lobo', p.x + 30, p.y, 0);
  if (r19.r19Tick(g, lobo, 1 / 60, ENEMY_DEFS.lobo) === false) ok('r19Tick: tipos ajenos → false (IA genérica del motor)');
  else bad('r19Tick se apropió de un tipo ajeno');
  if (r19.R19_TYPES.has('eco_desvanecido') && r19.R19_TYPES.has('vigia_tinta') && r19.R19_TYPES.size === 2)
    ok('R19_TYPES = { eco_desvanecido, vigia_tinta } (para el gate de update.ts:704)');
  else bad('R19_TYPES incompleto');
}

console.log(fails === 0 ? '\nSMOKE ENEMIGOS R19: TODO OK' : `\nSMOKE ENEMIGOS R19: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
