// ============================================================
// RONDA 19 · Task 19-d — Smoke del JEFE «EL HERALDO DE CENIZA»
// Stub DOM/Audio (patrón smoke_timeskip 13-c) + Game real.
// (1) def bien formada + inyección en ENEMY_DEFS + exports,
// (2) BFS del spawn (13,8) en cumbres 50×42: transitable, componente,
//     lejos de la salida y del Gólem, interior norte,
// (3) cerebro: 3 fases, PULSO DEL FARO anti-spam (5 hits → shockwave),
//     cono en abanico (5), doble abanico (10), invocaciones con tope 2,
//     lluvia de ceniza determinista (mulberry32 por tick count), quiebre,
//     botín por watcher (flags + poción, UNA vez),
// (4) sprite >= 4 frames y determinista (FNV-1a de ops grabadas),
// (5) integración: 900 frames g.update + tick manual sin NaN y acotado.
// Ejecutar: bun scripts/smoke_jefe_ceniza_r19.ts
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

const { MAPS } = await import('../src/game/maps');
const { ENEMY_DEFS } = await import('../src/game/data');
const { getSpr, SOLID_CHARS } = await import('../src/game/sprites');
const {
  CENIZA_DEF_R19, CENIZA_BOSS_INFO_R19, CENIZA_SPAWN_R19,
  tickCenizaR19, cenizaWatchR19, spawnCenizaR19,
  initJefeCenizaR19Sprites, buildCenizaR19, __cenizaDebug, __cenizaReset,
} = await import('../src/game/jefe_ceniza_r19');

let fails = 0;
let checks = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => { console.log('  ✓ ' + m); };
function check(cond: boolean, m: string, detalle?: string): void {
  checks++;
  if (cond) ok(m);
  else bad(detalle ? `${m} — ${detalle}` : m);
}

type GameT = InstanceType<typeof Game>;

function newGameCumbres(tx: number, ty: number): GameT {
  const g = new Game(makeCanvas());
  g.newGame('Prueba', 'alba');
  g.startPlay();
  g.loadMap('cumbres' as never, tx, ty);
  g.enemies.length = 0; // escenario limpio: solo los enemigos del test
  return g;
}

/** Instancia al jefe con el guard de spawn neutralizado (los ticks manuales
 *  no pasan por updateEnemy del motor, que es quien consume spawnGuard). */
function bossDePrueba(g: GameT): ReturnType<typeof spawnCenizaR19> {
  const e = spawnCenizaR19(g);
  e.spawnGuard = 0;
  return e;
}

/** dt fijo de 1/60 y tick manual del cerebro (contrato de cableado). */
const DT = 1 / 60;
function tickN(g: GameT, e: ReturnType<typeof spawnCenizaR19>, n: number): void {
  const def = ENEMY_DEFS.ceniza;
  for (let i = 0; i < n; i++) tickCenizaR19(g, e, DT, def);
}

function esqVivos(g: GameT): number {
  return g.enemies.filter(e => e.etype === 'esqueleto' && !e.dead).length;
}

// ============================================================
console.log('=== 1) DEF bien formada + inyección + exports ===');
{
  const d = CENIZA_DEF_R19;
  check(d.name === 'El Heraldo de Ceniza', "name === 'El Heraldo de Ceniza'", d.name);
  check(d.hp === 540, 'hp 540', String(d.hp));
  check(d.dmg === 15, 'dmg 15', String(d.dmg));
  check(d.speed === 38, 'speed 38', String(d.speed));
  check(d.xp === 360, 'xp 360', String(d.xp));
  check(Array.isArray(d.gold) && d.gold[0] === 240 && d.gold[1] === 320, 'gold [240,320]', JSON.stringify(d.gold));
  check(d.sprite === 'ceniza', "sprite 'ceniza'", d.sprite);
  check(d.aggroR === 175, 'aggroR 175', String(d.aggroR));
  check(d.atkR === 44, 'atkR 44', String(d.atkR));
  check(d.windup === 0.75, 'windup 0.75', String(d.windup));
  check(d.atkCd === 2.0, 'atkCd 2.0', String(d.atkCd));
  check(d.element === 'hielo' && d.weakTo === 'fuego', "element 'hielo' · weakTo 'fuego' (literales reales de Element)", `${d.element}/${d.weakTo}`);
  check(d.breakBar === 85, 'breakBar 85 (quiebre de jefe)', String(d.breakBar));
  check(d.desc.toLowerCase().includes('apagar') && d.desc.toLowerCase().includes('ceniza'), 'desc con identidad («apagar el último canto» + ceniza)');
  check(ENEMY_DEFS.ceniza === d, "inyectada en ENEMY_DEFS['ceniza'] (patrón ENEMY_DEFS_16A)");
  check(__cenizaDebug().defInENEMY_DEFS === true, '__cenizaDebug().defInENEMY_DEFS === true');
  check(CENIZA_BOSS_INFO_R19.name === 'El Heraldo de Ceniza'
    && CENIZA_BOSS_INFO_R19.sub === 'Vinieron a apagar el canto',
    'CENIZA_BOSS_INFO_R19 exacto (name + sub)', JSON.stringify(CENIZA_BOSS_INFO_R19));
  check(CENIZA_SPAWN_R19.map === 'cumbres' && CENIZA_SPAWN_R19.tx === 13 && CENIZA_SPAWN_R19.ty === 8
    && CENIZA_SPAWN_R19.x === 216 && CENIZA_SPAWN_R19.y === 136,
    'CENIZA_SPAWN_R19 = cumbres (13,8) → px (216,136)', JSON.stringify(CENIZA_SPAWN_R19));
}

// ============================================================
console.log('\n=== 2) BFS del spawn (interior norte, lejos de salida y Gólem) ===');
{
  const rows = MAPS.cumbres.rows;
  const H = rows.length, W = rows[0].length;
  check(W === 50 && H === 42, 'cumbres 50×42', `${W}×${H}`);
  const walk = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && !SOLID_CHARS.has(rows[y][x]);

  const { tx, ty } = CENIZA_SPAWN_R19;
  check(walk(tx, ty), `tile (${tx},${ty}) transitable (char '${rows[ty][tx]}')`);
  // margen libre 5×3 alrededor (el jefe kitea/orbita ahí)
  let margen = true;
  for (let dy = -1; dy <= 1 && margen; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (!walk(tx + dx, ty + dy)) { margen = false; break; }
  }
  check(margen, 'margen 5×3 libre alrededor del spawn (kite orbital)');

  // componente conexo por BFS
  const seen = new Set<string>([`${tx},${ty}`]);
  const q: [number, number][] = [[tx, ty]];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || !walk(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  check(seen.size >= 1400, `componente transitable desde el spawn: ${seen.size} tiles (≥ 1400)`);

  // distancia BFS a la ÚNICA salida de cumbres (leída de MAPS.cumbres.exits)
  const exits = MAPS.cumbres.exits;
  check(exits.length === 1, 'cumbres tiene 1 salida (leída de maps_expansion)', JSON.stringify(exits.map(e => ({ x: e.x, y: e.y }))));
  const ex = exits[0];
  const qd: [number, number, number][] = [[tx, ty, 0]];
  const seenD = new Set<string>([`${tx},${ty}`]);
  let dExit = -1;
  while (qd.length) {
    const [x, y, dd] = qd.shift()!;
    if (x === ex.x && y === ex.y) { dExit = dd; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seenD.has(k) || !walk(nx, ny)) continue;
      seenD.add(k); qd.push([nx, ny, dd + 1]);
    }
  }
  check(dExit >= 30, `BFS spawn→salida (${ex.x},${ex.y}): ${dExit} pasos (≥ 30, lejos del exit)`);

  // lejos del Gólem de Escarcha (jefe de mapa en 24,8 — leído de spawns)
  const golemSpawn = MAPS.cumbres.spawns.find(s => s.zone === 'boss');
  check(!!golemSpawn && golemSpawn.type === 'golem', 'spawn de jefe de cumbres es el Gólem (24,8)');
  const dGolem = golemSpawn ? Math.hypot(tx - golemSpawn.x, ty - golemSpawn.y) : -1;
  check(dGolem >= 10, `distancia spawn→Gólem: ${dGolem.toFixed(1)} tiles (≥ 10, sin solaparse)`);

  check(ty <= 14, `interior NORTE: ty=${ty} ≤ 14 (bajo la cordillera 2-5, sobre el paso central)`);
}

// ============================================================
console.log('\n=== 3) CEREBRO: fases, pulso anti-spam, cono, invocaciones, lluvia, quiebre, botín ===');
{
  // ---- 3a. aggro + banner + patrulla/aggro sin summons en fase 1 ----
  const g = newGameCumbres(13, 20); // el Portador aterriza al sur del jefe
  const e = bossDePrueba(g);
  const p = g.player!;
  p.x = CENIZA_SPAWN_R19.x + 120; p.y = CENIZA_SPAWN_R19.y + 40; // d ≈ 126 < aggroR 175
  tickN(g, e, 2);
  check(e.aggro === true, 'aggro por proximidad (<175 px)');
  check(g.flags.cenizaIntro === true, 'flag cenizaIntro (banner UNA vez)');
  check(g.bossBannerText === 'EL HERALDO DE CENIZA' && g.bossBannerSub === 'Vinieron a apagar el canto',
    'banner del jefe con CENIZA_BOSS_INFO_R19', `${g.bossBannerText} / ${g.bossBannerSub}`);
  check(e.phase === 1 && esqVivos(g) === 0, 'fase 1 «CENIZA»: sin invocaciones');

  // ---- 3b. KITE perpendicular en fase 1 (<100 px se aparta) ----
  // reposiciona al jefe EXACTO en su spawn (los ticks de aggro lo dejaron
  // derivar con el Math.random de patrulla del motor → muro posible cerca)
  e.x = CENIZA_SPAWN_R19.x; e.y = CENIZA_SPAWN_R19.y;
  e.homeX = e.x; e.homeY = e.y;
  e.ai = 'persigue'; e.windup = 0;
  const px0 = e.x, py0 = e.y;
  p.x = e.x + 60; p.y = e.y; // d=60 < KITE_NEAR 100
  tickN(g, e, 80); // 1.33 s < 1.4 s de flip orbital: deriva constante
  const moved = Math.hypot(e.x - px0, e.y - py0);
  check(moved > 8, `fase 1 kite: se aparta perpendicular (desplazamiento ${moved.toFixed(1)} px en 80 ticks)`);
  const dTras = Math.hypot(p.x - e.x, p.y - e.y);
  check(dTras > 50, `el kite NO se pega: d final ${dTras.toFixed(0)} px`);

  // ---- 3c. CONO DE CENIZA: 5 proyectiles en abanico de 40°, lentos ----
  g.projectiles.length = 0;
  p.x = e.x + 150; p.y = e.y - 20; // dentro de 215, fuera de melé
  e.ai = 'persigue'; e.windup = 0; e.atkCd = 0; // escenario limpio (el kite pudo dejar carga pendiente)
  tickN(g, e, 1);
  check(e.ai === 'carga' && e.windup > 0.4 && e.telegraphKind === 'salva',
    'cono: entra en carga con telegraph (frame TELEGRAPH)', `ai=${e.ai} windup=${e.windup.toFixed(2)}`);
  tickN(g, e, 34); // windup 0.55 s
  const cono = g.projectiles.filter(pr => pr.from === 'enemy' && pr.sprite === 'shard');
  check(cono.length === 5, `cono de ceniza: 5 proyectiles (fase 1)`, String(cono.length));
  if (cono.length === 5) {
    const base = Math.atan2(p.y - 4 - e.y, p.x - e.x);
    const offsets = cono.map(pr => {
      let a = Math.atan2(pr.vy, pr.vx) - base;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    });
    const spread = Math.max(...offsets) - Math.min(...offsets);
    check(spread <= (40 * Math.PI) / 180 + 1e-6, `abanico ≤ 40° (${(spread * 180 / Math.PI).toFixed(1)}°)`);
    const speeds = cono.map(pr => Math.hypot(pr.vx, pr.vy));
    check(speeds.every(s => Math.abs(s - 92) < 1), `lentos: speed ${speeds[0].toFixed(0)} px/s (≈92)`);
    check(cono.every(pr => pr.element === 'sombra' && pr.t === 2.2), "element 'sombra' · t 2.2");
  }
  tickN(g, e, 40); // recupera → persigue; atkCd vuelve a subir
  check(e.atkCd > 1.0, 'atkCd repuesto tras el cono (2.0 - 0.67 s de ticks)', String(e.atkCd.toFixed(2)));

  // ---- 3d. EL PULSO DEL FARO: 4+ golpes en 2.5 s → shockwave + ascuas ----
  // NOTA de fidelidad: con el cableado real, update.ts:673 decae hitFlash
  // ANTES de delegar en el cerebro → cada golpe nuevo SUBE el flash y cuenta.
  // En este smoke manual no corre el motor entre golpes: 2 ticks/hit
  // reproducen ese decaimiento (1 tick de golpe + 1 tick de decaimiento).
  g.projectiles.length = 0; g.waves.length = 0; g.telegraphs.length = 0;
  p.x = e.x + 300; p.y = e.y; // lejos: sin cono mientras se prueba el pulso
  e.atkCd = 2;
  // 4 golpes rápidos (damageEnemy = la vía real del motor: hitFlash 0.12)
  for (let i = 0; i < 4; i++) { g.damageEnemy(e, 4, 'ninguno', 0); tickN(g, e, 2); }
  check(e.ai === 'carga' && e.windup > 0.6, 'pulso anti-spam: 4 hits/ventana → telegrafía 0.8 s',
    `ai=${e.ai} windup=${e.windup.toFixed(2)}`);
  check(g.telegraphs.some(t => t.dmg === 0 && t.r === 48 && Math.abs(t.t - 0.8) < 0.05),
    'telegraph de aviso del pulso (r 48 · dmg 0 · t 0.8)');
  e.hp = Math.max(e.hp, e.maxHp * 0.9); // cura el sondeo: la fase la mide el propio test 3e
  tickN(g, e, 50); // 0.83 s > windup
  const ondas = g.waves.filter(w => w.dmg === 12 && w.maxR === 96);
  check(ondas.length === 1, `PULSO: shockwave generada (dmg 12 · maxR 96 · speed 190)`, `waves=${g.waves.length}`);
  const ascuas = g.projectiles.filter(pr => pr.element === 'fuego' && pr.sprite === 'orb');
  check(ascuas.length === 8, `PULSO: 8 ascuas element 'fuego' (la «quema» del estallido)`, String(ascuas.length));
  check(e.telegraphKind === undefined, 'telegraphKind limpio tras el pulso');
  // segunda andanada de 3 hits NO repite (contador reseteado + ventana)
  g.waves.length = 0; g.projectiles.length = 0; g.telegraphs.length = 0;
  for (let i = 0; i < 3; i++) { g.damageEnemy(e, 4, 'ninguno', 0); tickN(g, e, 2); }
  check(g.waves.length === 0, '3 hits tras el reset NO disparan otro pulso (umbral 4 en fase 1)');
  // ventana: 2.6 s sin hits resetean el contador (lejos: sin cono que bloquee)
  p.x = e.x + 400; p.y = e.y;
  tickN(g, e, 170);
  for (let i = 0; i < 4; i++) { g.damageEnemy(e, 4, 'ninguno', 0); tickN(g, e, 2); }
  tickN(g, e, 50); // la shockwave sale al expirar la telegrafía (0.8 s)
  check(g.waves.length === 1, 'ventana 2.5 s: 4 hits frescos vuelven a reflejar (pulso 2)');

  // ---- 3e. FASE 2 «BRASA»: toast + invulT + 2 cenizas menores ----
  g.enemies = g.enemies.filter(x => x === e); // limpia esqueletos de pruebas previas si los hubiera
  const rsRun = (e.hp = e.maxHp * 0.5); // 50% → fase 2
  void rsRun;
  tickN(g, e, 2);
  check(e.phase === 2, 'fase 2 «BRASA» al 65-35%');
  check((e.invulT ?? 0) > 0.9, `transición BRASA: invulT 1 s (${(e.invulT ?? 0).toFixed(2)})`);
  check(g.toasts.some(t => t.text.includes('aviva su fuego')), 'toast «¡El Heraldo aviva su fuego!»');
  check(esqVivos(g) === 2, 'invoca 2 cenizas menores (esqueletos, lados alternos)');
  check(g.enemies.filter(x => x.etype === 'esqueleto').every(x => x.aggro === true), 'las cenizas menores nacen aggro');

  // ---- 3f. tope 2 vivas + repesca cada 9 s ----
  e.hp = e.maxHp * 0.5; // seguir en fase 2 (por si los hits bajaron algo)
  tickN(g, e, 560); // 9.3 s: con 2 vivas NO repite
  check(esqVivos(g) === 2, '9 s después con 2 vivas: NO invoca más (tope 2)');
  for (const mn of g.enemies) if (mn.etype === 'esqueleto') mn.dead = true;
  tickN(g, e, 545); // ~9.1 s con 0 vivas → repesca
  check(esqVivos(g) === 2, 'repesca a los 9 s con <2 vivas: vuelve a 2');
  let maxEsq = 0;
  tickN(g, e, 300);
  maxEsq = Math.max(maxEsq, esqVivos(g));
  check(maxEsq <= 2, 'el tope de cenizas menores nunca se supera');

  // ---- 3g. DOBLE ABANICO en fase 2 (2 × 5) ----
  g.projectiles.length = 0;
  p.x = e.x + 160; p.y = e.y;
  e.atkCd = 0;
  tickN(g, e, 1);
  check(e.ai === 'carga', 'cono en carga (fase 2)');
  tickN(g, e, 34);
  const doble = g.projectiles.filter(pr => pr.from === 'enemy' && pr.sprite === 'shard');
  check(doble.length === 10, `doble abanico fase 2: 10 proyectiles (2×5)`, String(doble.length));

  // ---- 3h. FASE 3 «EL ÚLTIMO ALIENTO»: lluvia cada 8 s + umbral pulso 3 ----
  g.projectiles.length = 0;
  e.hp = e.maxHp * 0.3; // 30% → fase 3
  tickN(g, e, 2);
  check(e.phase === 3, 'fase 3 «EL ÚLTIMO ALIENTO» al <35%');
  check(g.toasts.some(t => t.text.includes('ÚLTIMO ALIENTO')), 'toast de fase 3');
  p.x = e.x + 130; p.y = e.y; // hold: sin acercarse ni huir (determinismo posicional)
  tickN(g, e, 482); // 8.03 s → 1ª lluvia
  const lluvia = g.projectiles.filter(pr => pr.from === 'enemy' && pr.t === 2);
  check(lluvia.length === 6, `lluvia de ceniza: 6 proyectiles desde arriba (cada 8 s)`, String(lluvia.length));
  check(lluvia.every(pr => pr.vy > 0 && pr.y <= e.y - 16), 'lluvia: vy positivo y nacen por encima del jefe');
  check(lluvia.every(pr => pr.element === 'sombra' && pr.t === 2), "lluvia: element 'sombra' · t 2 s");
  const vxPrimera = lluvia.map(pr => Math.round(pr.vx * 1000));
  tickN(g, e, 480); // siguiente ciclo: 6 más
  const lluvia2 = g.projectiles.filter(pr => pr.from === 'enemy' && pr.t === 2).slice(-6);
  check(lluvia2.length === 6, 'segunda lluvia a los 8 s');
  // determinismo: DOS partidas paralelas limpias con LA MISMA cuenta de ticks
  // (tickN del jefe → semilla) producen la MISMA secuencia de vx
  const mkRun = () => {
    const gg = newGameCumbres(13, 20);
    const ee = bossDePrueba(gg);
    ee.aggro = true;
    ee.hp = ee.maxHp * 0.3;
    ee.phase = 3; // sin transición: cuenta de ticks idéntica en ambas partidas
    tickN(gg, ee, 482);
    return gg.projectiles.filter(pr => pr.from === 'enemy' && pr.t === 2).map(pr => Math.round(pr.vx * 1000));
  };
  const vxA = mkRun();
  const vxB = mkRun();
  check(vxA.length === 6, 'partida paralela: primera lluvia en el mismo tick');
  check(JSON.stringify(vxA) === JSON.stringify(vxB),
    'lluvia determinista: vx idénticos por mulberry32 sembrado con el tick count',
    `${JSON.stringify(vxA)} vs ${JSON.stringify(vxB)}`);
  check(JSON.stringify(vxPrimera.map(v => Math.round(v))) !== '[]' && vxPrimera.length === 6,
    'la partida acumulada también soltó sus 6 gotas (semilla por tickN propia)');

  // umbral del pulso en fase 3: 3 golpes
  g.waves.length = 0; g.projectiles.length = 0; g.telegraphs.length = 0;
  p.x = e.x + 500; p.y = e.y; // lejos: la espera no deja un cono pendiente
  tickN(g, e, 170); // ventana 2.5 s expira
  e.atkCd = 2;
  for (let i = 0; i < 3; i++) { g.damageEnemy(e, 4, 'ninguno', 0); tickN(g, e, 2); }
  check(g.telegraphs.some(t => t.dmg === 0 && t.r === 48), 'fase 3: umbral anti-spam BAJO a 3 golpes/2.5 s');
  tickN(g, e, 50);
  check(g.waves.some(w => w.dmg === 12), 'pulso fase 3 generó su shockwave');

  // ---- 3i. QUIEBRE (breakBar 85) como los demás jefes ----
  e.hp = e.maxHp * 0.9; e.phase = 1; e.invulT = 0; // escenario limpio de fase
  tickN(g, e, 2);
  check(e.maxSta === 85 && e.sta <= 85, 'barra de quiebre 85 (makeEnemy la lee de breakBar)', `${e.sta}/${e.maxSta}`);
  e.sta = e.maxSta; e.atkCd = 2; // escenario limpio: la barra la desgasta SOLO este test
  let guard = 0;
  while (e.ai !== 'aturdido' && guard < 20) { g.damageEnemy(e, 8, 'ninguno', 0); guard++; }
  check(e.ai === 'aturdido', `quebrado tras ${guard} golpes (sta ${e.sta.toFixed(0)}/85)`);
  const sta0 = e.sta;
  tickN(g, e, 112); // 1.87 s > 1.8 s de aturdimiento del Heraldo
  check(e.ai === 'persigue' && e.sta === e.maxSta, 'sale del quebrado con la barra LLENA (patrón dispatcher)');
  void sta0;

  // ---- 3j. BOTÍN por watcher (killEnemy del motor no tiene rama 'ceniza') ----
  e.hp = 3;
  g.damageEnemy(e, 50, 'fuego', 0); // débil al fuego (weakTo) — remate
  check(e.dead === true, 'killEnemy del motor ejecutado (dead=true, XP/oro de la def)');
  const pociones0 = p.potions;
  cenizaWatchR19(g); // el watcher aporta flags + botín + toasts
  check(g.flags.cenizaDefeated === true, 'flag cenizaDefeated');
  check(g.flags.ascua_ceniza === true, 'flag ascua_ceniza (la Ascua queda con el Portador)');
  check(p.potions === pociones0 + 1, 'botín: +1 poción');
  check(g.toasts.some(t => t.text.includes('Heraldo de Ceniza')), 'toast de derrota del Heraldo');
  check(g.bossActive === false, 'barra de jefe desactivada');
  cenizaWatchR19(g);
  check(p.potions === pociones0 + 1, 'botín UNA vez (watcher repetido no duplica)');
}

// ============================================================
console.log('\n=== 4) SPRITE: 5 frames (26×22), build determinista (FNV-1a) ===');
{
  const realDoc = (globalThis as AnyP).document;
  const ops: string[] = [];
  const recordingCanvas = () => ({
    width: 0, height: 0, style: {},
    getContext: (_: string) => {
      let alpha = 1;
      const c = {
        imageSmoothingEnabled: false,
        fillRect: (x: number, y: number, w: number, h: number) => { ops.push(`r${x},${y},${w},${h}`); },
        save: () => {}, restore: () => {},
      } as unknown as CanvasRenderingContext2D;
      Object.defineProperty(c, 'globalAlpha', {
        get: () => alpha,
        set: (v: number) => { alpha = v; ops.push(`a${Math.round(v * 100)}`); },
      });
      return c;
    },
  });
  (globalThis as AnyP).document = {
    createElement: recordingCanvas,
    getElementById: () => makeCanvas(),
    addEventListener: noop, body: stub(), documentElement: stub(),
  } as unknown as Document;

  const fnv1a = (s: string): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };

  const dbgB0 = __cenizaDebug().builds;
  __cenizaReset();            // permite re-registrar (dev hook)
  initJefeCenizaR19Sprites(); // build A
  const hashA = fnv1a(ops.join('|'));
  const nOpsA = ops.length;
  ops.length = 0;
  initJefeCenizaR19Sprites(); // idempotente: NO reconstruye
  check(ops.length === 0, 'initJefeCenizaR19Sprites idempotente (2ª llamada no reconstruye)');
  __cenizaReset();
  initJefeCenizaR19Sprites(); // build B (reconstrucción forzada)
  const hashB = fnv1a(ops.join('|'));
  (globalThis as AnyP).document = realDoc;

  check(nOpsA > 120, `build con ${nOpsA} ops de dibujo (fillRect/alpha) — no vacío`);
  check(hashA === hashB, `build determinista: FNV-1a idéntico en 2 builds (0x${hashA.toString(16)})`,
    `0x${hashA.toString(16)} vs 0x${hashB.toString(16)}`);

  const frames = getSpr('ceniza');
  check(frames.length >= 4, `frames registrados: ${frames.length} (≥ 4; contrato 5: 0/1 patrulla, 2 telegraph, 3 dispersa, 4 lluvia)`);
  check(frames[0].width === 26 && frames[0].height === 22, 'lienzo 26×22', `${frames[0].width}×${frames[0].height}`);
  check(frames.every(f => f.width === 26 && f.height === 22), 'los 5 frames miden 26×22');
  const dbg = __cenizaDebug();
  check(dbg.sprInited === true && dbg.builds === dbgB0 + 2, `__cenizaDebug: sprInited ${dbg.sprInited}, builds ${dbg.builds} (+2 forzados)`);

  // buildCenizaR19 exportado directo: 5 canvases nuevos sin tocar el registro
  const extra = buildCenizaR19();
  check(extra.length === 5 && extra[0].width === 26, 'buildCenizaR19() exportado: 5 × 26×22');
}

// ============================================================
console.log('\n=== 5) INTEGRACIÓN: 900 frames g.update + tick (sin NaN, acotado) ===');
{
  const g = newGameCumbres(13, 20);
  const e = bossDePrueba(g);
  const p = g.player!;
  p.maxHp = 9999; p.hp = 9999; // el brain-less genérico puede golpear: que no muera
  e.aggro = true;
  const def = ENEMY_DEFS.ceniza;
  let threw: string | null = null;
  let maxProj = 0, maxWaves = 0, maxTel = 0, maxPart = 0, maxEsq = 0;
  try {
    for (let i = 0; i < 900; i++) {
      // órbita determinista del Portador (radio 60..200)
      const rad = 130 + Math.sin(i * 0.01) * 70;
      p.x = e.x + Math.cos(i * 0.02) * rad;
      p.y = e.y + Math.sin(i * 0.02) * rad;
      p.hp = p.maxHp;
      if (i === 300) e.hp = e.maxHp * 0.5;  // fase 2 a mitad
      if (i === 600) e.hp = e.maxHp * 0.3;  // fase 3 al final
      if (i % 200 === 0) g.damageEnemy(e, 6, 'ninguno', 0);
      g.update(DT);               // motor completo (IA genérica + ondas + proyectiles)
      const consumido = tickCenizaR19(g, e, DT, def); // wiring simulado (1/frame)
      if (!consumido) { threw = 'tickCenizaR19 devolvió false'; break; }
      if (e.dead) break; // muerto por el sondeo de daño → el watcher haría el botín
      maxProj = Math.max(maxProj, g.projectiles.length);
      maxWaves = Math.max(maxWaves, g.waves.length);
      maxTel = Math.max(maxTel, g.telegraphs.length);
      maxPart = Math.max(maxPart, g.particles.length);
      maxEsq = Math.max(maxEsq, esqVivos(g));
      const vals = [e.x, e.y, e.hp, e.sta, e.aiT, e.windup, e.atkCd, e.anim, p.hp, p.x, p.y];
      if (vals.some(v => !Number.isFinite(v))) { threw = `NaN en frame ${i}`; break; }
    }
  } catch (err) {
    threw = String(err);
  }
  check(threw === null, '900 frames (motor + cerebro) sin excepciones ni NaN', threw ?? '');
  check(maxEsq <= 2, `cenizas menores acotadas (máx ${maxEsq} ≤ 2)`);
  check(maxProj <= 100, `proyectiles acotados (máx ${maxProj})`);
  check(maxWaves <= 8, `ondas acotadas (máx ${maxWaves})`);
  check(maxTel <= 10, `telegraphs acotados (máx ${maxTel})`);
  check(maxPart <= 500, `partículas acotadas (máx ${maxPart})`);
  check(e.phase === 3, 'la simulación recorrió las 3 fases (fase 3 al cierre)');
  // watcher en integración: barra + botín sin excepción
  try {
    cenizaWatchR19(g);
    ok('cenizaWatchR19 integrado: spawn/barra/botín sin lanzar');
    checks++;
  } catch (err) {
    bad(`cenizaWatchR19 lanzó: ${String(err)}`);
    checks++;
  }
  // spawn del watcher: lejos NO nace, cerca SÍ, y cenizaDefeated cierra
  const g3 = newGameCumbres(24, 39); // sur, junto a la salida
  cenizaWatchR19(g3);
  check(!g3.enemies.some(x => (x.etype as string) === 'ceniza'), 'a >260 px del spawn el watcher NO convoca');
  const p3 = g3.player!;
  p3.x = CENIZA_SPAWN_R19.x + 60; p3.y = CENIZA_SPAWN_R19.y + 40;
  cenizaWatchR19(g3);
  check(g3.enemies.some(x => (x.etype as string) === 'ceniza'), 'a <260 px el watcher convoca al Heraldo');
  const g4 = newGameCumbres(13, 9);
  g4.flags.cenizaDefeated = true;
  const p4 = g4.player!;
  p4.x = CENIZA_SPAWN_R19.x + 30; p4.y = CENIZA_SPAWN_R19.y + 10;
  cenizaWatchR19(g4);
  check(!g4.enemies.some(x => (x.etype as string) === 'ceniza'), 'cenizaDefeated cierra el spawn para siempre');
}

console.log(fails === 0 ? `\nSMOKE JEFE CENIZA R19: TODO OK (${checks} checks)` : `\nSMOKE JEFE CENIZA R19: ${fails} FALLOS de ${checks}`);
process.exit(fails === 0 ? 0 : 1);
