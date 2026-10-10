// ============================================================
// 19-c (jefe-marea) — Smoke de «LA MAREA SIN NOMBRE» sin navegador.
// Stub DOM/Audio (patrón scripts/smoke_timeskip.ts) + canvas GRABADOR
// (patrón scripts/smoke_jefes_sprites.ts: fillRect registrados + firma
// FNV-1a vía toDataURL — determinismo real sin decodificar PNG).
//
// Verifica:
//  (1) MAREA_DEF_R19 bien formado (hp 580, weakTo 'rayo' literal válido,
//      gold [260,340], breakBar 90, sprite/aggroR/atkR/windup/atkCd…),
//      MAREA_BOSS_INFO_R19 y MAREA_SPAWN_R19;
//  (2) BFS sobre MAPS.costa.rows con SOLID_CHARS: el spawn (25,35) es
//      transitable y alcanzable desde la llegada de lunaris→costa
//      (exit.tx/ty leída de MAPS.lunaris) — y documenta que el (25,39)
//      propuesto era mar sólido ('~');
//  (3) cerebro determinista: 600 ticks con Enemy fake a 95/50/20% hp
//      (fake Game: stubs que NO procesan proyectiles/telegraphs/ondas —
//      solo acumulan). Comprueba fases, abanico de 3 en F1, barrido
//      telegrafiado, PLEAMAR (invulT + espuma-línea de 4 + salto con
//      shockwave), RESACA (2 sombras-espuma, cadencia 60%, daño +20%),
//      aturdido→recuperación de sta, aggro por distancia y banner;
//      determinismo: 2 runs → traza idéntica tick a tick;
//  (4) sprite 'marea': 5 canvas 26×22, firmas deterministas entre builds
//      e idempotencia de initJefeMareaR19Sprites();
//  (5) sin NaN en 600 ticks (entidad + proyectiles + ondas + telegraphs);
//      y fuente sin Math.random (mulberry32 local).
// Ejecutar: bun scripts/smoke_jefe_marea_r19.ts
// ============================================================

// ---------- stub universal (patrón smoke_timeskip) ----------
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

/** Firma determinista de ops de dibujo (hash FNV-1a, patrón 18-c). */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

interface RecCanvas extends HTMLCanvasElement { __ops: () => string }

function makeRecCanvas(): RecCanvas {
  const canvas: any = { width: 0, height: 0, style: {} };
  const ops: string[] = [];
  const ctx: any = {
    canvas,
    fillStyle: '',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    fillRect(x: number, y: number, w: number, h: number) {
      ops.push(`R${x},${y},${w},${h}|${ctx.fillStyle}|${Number(ctx.globalAlpha).toFixed(3)}`);
    },
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, strokeRect: noop, clearRect: noop,
    drawImage: noop, fillText: noop, setTransform: noop, rect: noop, clip: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
  };
  canvas.getContext = (_: string) => ctx;
  canvas.toDataURL = () => `data:image/png;base64,${ops.length.toString(36)}${fnv1a(ops.join(';'))}`;
  canvas.__ops = () => ops.join(';');
  return canvas as RecCanvas;
}

(globalThis as AnyP).document = {
  createElement: (tag: string) => (tag === 'canvas' ? makeRecCanvas() : stub()),
  getElementById: () => makeRecCanvas(),
  addEventListener: noop,
  body: stub(),
  documentElement: stub(),
} as unknown as Document;
const store = new Map<string, string>();
(globalThis as AnyP).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null, length: 0,
};
(globalThis as AnyP).window = {
  addEventListener: noop, removeEventListener: noop,
  innerWidth: 1280, innerHeight: 720,
  setInterval: () => 0, clearInterval: noop, setTimeout: () => 0,
  AudioContext: undefined, webkitAudioContext: undefined,
} as unknown as Window & typeof globalThis;
(globalThis as AnyP).performance = { now: () => Date.now() };
(globalThis as AnyP).requestAnimationFrame = () => 0;
(globalThis as AnyP).cancelAnimationFrame = noop;

// ---------- sujetos bajo prueba (imports dinámicos: stubs ya puestos) ----------
const { MAPS } = await import('../src/game/maps');
const { SOLID_CHARS, getSpr } = await import('../src/game/sprites');
const { audio } = await import('../src/game/audio');
(audio as unknown as { init: () => void }).init = () => {};
(audio as unknown as { ctx: unknown }).ctx = stub();
const {
  MAREA_DEF_R19, MAREA_BOSS_INFO_R19, MAREA_SPAWN_R19,
  tickMareaR19, buildMareaR19, initJefeMareaR19Sprites,
} = await import('../src/game/jefe_marea_r19');

// ---------- aserciones ----------
let fails = 0;
const ok = (cond: boolean, label: string): boolean => {
  if (!cond) { fails++; console.log('  ✗ ' + label); }
  return cond;
};
const eq = (a: unknown, b: unknown, label: string): boolean =>
  ok(a === b, `${label} (esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)})`);
const near = (a: number, b: number, eps: number, label: string): boolean =>
  ok(Math.abs(a - b) <= eps, `${label} (esperado ≈${b}, obtenido ${a})`);
const finite = (v: unknown, label: string): boolean =>
  ok(typeof v === 'number' && Number.isFinite(v), `${label} finito (${String(v)})`);

console.log('=== SMOKE 19-c · JEFE MAREA SIN NOMBRE ===');

// ============================================================
// [1] DEF + banner + spawn bien formados
// ============================================================
console.log('\n[1] MAREA_DEF_R19 / banner / spawn');
{
  const d = MAREA_DEF_R19;
  eq(d.name, 'La Marea Sin Nombre', 'name');
  eq(d.hp, 580, 'hp');
  eq(d.dmg, 16, 'dmg');
  eq(d.speed, 34, 'speed');
  eq(d.xp, 380, 'xp');
  ok(Array.isArray(d.gold) && d.gold.length === 2 && d.gold[0] === 260 && d.gold[1] === 340, 'gold [260,340]');
  eq(d.sprite, 'marea', 'sprite');
  eq(d.aggroR, 170, 'aggroR');
  eq(d.atkR, 46, 'atkR');
  eq(d.windup, 0.9, 'windup');
  eq(d.atkCd, 2.4, 'atkCd');
  eq(d.element, 'hielo', 'element (literal acuático existente en Element)');
  eq(d.weakTo, 'rayo', 'weakTo');
  eq(d.breakBar, 90, 'breakBar');
  ok(typeof d.desc === 'string' && d.desc.length > 40 && d.desc.includes('cantores'), 'desc evocadora (2 frases)');
  ok(typeof MAREA_BOSS_INFO_R19.name === 'string' && MAREA_BOSS_INFO_R19.name.length > 0
    && typeof MAREA_BOSS_INFO_R19.sub === 'string' && MAREA_BOSS_INFO_R19.sub.length > 0,
  'MAREA_BOSS_INFO_R19 {name, sub}');
  eq(MAREA_BOSS_INFO_R19.sub, 'El abismo también canta', 'banner sub');
  eq(MAREA_SPAWN_R19.map, 'costa', 'spawn.map');
  eq(MAREA_SPAWN_R19.x, 25, 'spawn.x');
  eq(MAREA_SPAWN_R19.y, 33, 'spawn.y (corregido: (25,39) era mar sólido)');
}

// ============================================================
// [2] BFS: spawn transitable y alcanzable desde lunaris→costa
// ============================================================
console.log('\n[2] BFS costa (spawn alcanzable desde la exit de lunaris)');
{
  const rows = MAPS.costa.rows;
  const H = rows.length, W = rows[0].length;
  eq(W, 52, 'costa ancho 52');
  eq(H, 40, 'costa alto 40');
  const solid = (x: number, y: number) =>
    x < 0 || y < 0 || x >= W || y >= H || SOLID_CHARS.has(rows[y][x]);
  // llegada REAL de lunaris→costa: exit de MAPS.lunaris hacia 'costa'
  const exit = MAPS.lunaris.exits.find(e2 => e2.to === 'costa');
  ok(!!exit, 'MAPS.lunaris tiene exit a costa');
  const sx = exit!.tx, sy = exit!.ty;
  ok(!solid(sx, sy), `llegada (${sx},${sy}) transitable (char '${rows[sy]?.[sx]}')`);
  // BFS 4-dir desde la llegada
  const seen = new Set<string>([`${sx},${sy}`]);
  const queue: [number, number][] = [[sx, sy]];
  while (queue.length) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || solid(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  const tx = MAREA_SPAWN_R19.x, ty = MAREA_SPAWN_R19.y;
  ok(seen.has(`${tx},${ty}`), `spawn (${tx},${ty}) ALCANZABLE por BFS (char '${rows[ty][tx]}')`);
  // espacio de maniobra: ≥6 de 8 vecinos libres (hitbox de jefe 22×16)
  let libres = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    if (!solid(tx + dx, ty + dy)) libres++;
  }
  ok(libres >= 6, `espacio de maniobra: ${libres}/8 vecinos libres (≥6)`);
  // el tile propuesto en la misión (25,39) era MAR SÓLIDO → nota documentada
  const original = rows[39][25];
  console.log(`  · nota: el (25,39) propuesto es '${original}' → ${SOLID_CHARS.has(original) ? 'SÓLIDO (oleaje), spawn corregido a (25,33) playa sur' : 'transitable (mapa cambió: revisar spawn)'}`);
  // sanidad: lejos de la salida norte (el jefe no acampa la entrada)
  const distEntrada = Math.hypot(tx - 26, ty - 2);
  ok(distEntrada >= 12, `spawn lejos de la entrada norte (${distEntrada.toFixed(1)} tiles ≥ 12)`);
  // sanidad: ningún spawn REGULAR a menos de 4 tiles (neumo (20,34) está a 5.1).
  // R19-int: se excluyen los zone:'boss' — el propio jefe ya vive en MAPS tras
  // la integración (maps.ts lo pushea) y se contaría a sí mismo a dist 0.
  const cerca = MAPS.costa.spawns.filter(s2 => s2.zone !== 'boss' && Math.hypot(s2.x - tx, s2.y - ty) < 4);
  eq(cerca.length, 0, 'sin spawns regulares a <4 tiles del jefe');
}

// ============================================================
// [3] CEREBRO determinista — fake Game + Enemy fake
// ============================================================

type FakeGame = {
  player: { x: number; y: number };
  enemies: unknown[];
  projectiles: any[];
  waves: any[];
  telegraphs: any[];
  particles: any[];
  flags: Record<string, number | boolean>;
  state: string;
  dayT: number;
  shake: number; flashT: number; flashColor: string; slowmoT: number;
  bossBannerT: number; bossBannerText: string; bossBannerSub: string;
  toasts: string[];
  tileSolidAt: (x: number, y: number) => boolean;
  toast: (text: string, color?: string) => void;
  burst: (x: number, y: number, c: string, n: number, s?: number) => void;
  floatAt: (x: number, y: number, t: string, c: string, s?: number) => void;
  moveEntity: (e: unknown, dx: number, dy: number) => void;
  makeEnemy: (t: 'sombra', x: number, y: number, patrol: number, zone?: string) => any;
};

function mkGame(px: number, py: number, tileSolid = false): FakeGame {
  const g: FakeGame = {
    player: { x: px, y: py },
    enemies: [], projectiles: [], waves: [], telegraphs: [], particles: [],
    flags: {}, state: 'play', dayT: 0.5,
    shake: 0, flashT: 0, flashColor: '', slowmoT: 0,
    bossBannerT: 0, bossBannerText: '', bossBannerSub: '',
    toasts: [],
    tileSolidAt: () => tileSolid,
    toast: (text: string) => { g.toasts.push(text); },
    burst: () => {},
    floatAt: () => {},
    moveEntity: () => {}, // no-op: distancias constantes → aserciones exactas
    makeEnemy: (t: 'sombra', x: number, y: number) => ({
      kind: 'enemy', etype: t, x, y, w: 12, h: 10, vx: 0, vy: 0, dir: 'down',
      hp: 30, maxHp: 30, sprite: 'sombra', anim: 0, moving: false,
      ai: 'patrulla', aiT: 0, homeX: x, homeY: y, patrolAngle: 0,
      aggro: false, windup: 0, atkCd: 0, sta: 0, maxSta: 0,
      statuses: [], slowT: 0, phase: 1, sumT: 0, hitFlash: 0,
    }),
  };
  return g; // los métodos cierran sobre `g` (llamados siempre tras la creación)
}

function mkMarea(x: number, y: number, hpPct: number, over: Record<string, unknown> = {}): any {
  return {
    kind: 'enemy', etype: 'sirena', // el cerebro no lee etype; 'sirena' ∈ EnemyType
    x, y, w: 22, h: 16, vx: 0, vy: 0, dir: 'down',
    hp: Math.round(580 * hpPct), maxHp: 580,
    sprite: 'marea', anim: 0, moving: false,
    ai: 'persigue', aiT: 0, homeX: x, homeY: y, patrolAngle: 0,
    aggro: true, windup: 0, atkCd: 0, sta: 90, maxSta: 90,
    statuses: [], slowT: 0, phase: 1, sumT: 0, hitFlash: 0,
    spawnGuard: 0, subT: 0,
    ...over,
  };
}

const DT = 1 / 60;
const TICKS = 600;

/** Snapshot serializable del estado (determinismo tick a tick). */
function snap(g: FakeGame, e: any): string {
  const f = (n: number) => Number(n).toFixed(6);
  return [
    f(e.x), f(e.y), f(e.hp), f(e.anim), f(e.atkCd), f(e.windup), f(e.aiT),
    e.ai, e.phase, e.moving ? 1 : 0, e.telegraphKind ?? '-',
    e.invulT === undefined ? '-' : f(e.invulT),
    g.projectiles.map((p: any) => [f(p.x), f(p.y), f(p.vx), f(p.vy), f(p.t), p.dmg, p.element, p.sprite, p.radius, p.pierce].join(',')).join('#'),
    g.waves.map((w: any) => [f(w.x), f(w.y), f(w.r), f(w.maxR), f(w.speed), w.dmg, w.hit ? 1 : 0].join(',')).join('#'),
    g.telegraphs.map((t: any) => [f(t.x), f(t.y), f(t.r), f(t.t), t.dmg, t.kind].join(',')).join('#'),
    g.enemies.length,
  ].join('|');
}

/** Ejecuta TICKS ticks y devuelve { g, e, snaps, maxAtkCd }. */
function sim(hpPct: number, px: number, py: number, tileSolid: boolean, over: Record<string, unknown> = {}) {
  const g = mkGame(px, py, tileSolid);
  const e = mkMarea(400, 300, hpPct, over);
  const snaps: string[] = [];
  let maxAtkCd = 0;
  for (let i = 0; i < TICKS; i++) {
    tickMareaR19(g as unknown as import('../src/game/engine').Game, e, DT, MAREA_DEF_R19, {});
    if (e.atkCd > maxAtkCd) maxAtkCd = e.atkCd;
    snaps.push(snap(g, e));
  }
  return { g, e, snaps, maxAtkCd };
}

const hyp = (p: any) => Math.hypot(p.vx, p.vy);

console.log('\n[3] cerebro tickMareaR19 · 600 ticks × 3 hp%');

// ---- FASE 1 · FLUJO (95%): abanico puro a 160 px ----
{
  const { g, e, maxAtkCd } = sim(0.95, 560, 300, false); // d=160 (>150, <aggroR 170)
  eq(e.phase, 1, 'F1: fase se mantiene 1');
  // cadencia exacta con dt=1/60: windup 0.9 resuelve en tick 56 (t≈0.933) y
  // atkCd 2.4 consume 144 ticks → volleys en t≈0.93 / 4.27 / 7.60 (el 4º
  // caería en t≈11.9, fuera de los 600 ticks) → 3 volleys × 3 = 9 orbes.
  eq(g.projectiles.length, 9, 'F1: 3 volleys × 3 orbes en abanico (600 ticks)');
  ok(g.projectiles.every((p: any) => p.sprite === 'orb' && p.element === 'hielo' && p.from === 'enemy'), 'F1: orbes orb/hielo/from enemy');
  ok(g.projectiles.every((p: any) => p.dmg === 11), 'F1: dmg de orbe = round(16×0.7) = 11');
  ok(g.projectiles.every((p: any) => Math.abs(hyp(p) - 130) < 1e-6), 'F1: velocidad de orbe 130');
  // abanico de 25°: todos los orbes de un volley salen del mismo punto
  eq(g.projectiles[0].x, g.projectiles[1].x, 'F1: volley desde el mismo origen');
  eq(g.telegraphs.length, 0, 'F1: sin barridos a >150 px (0 telegraphs)');
  eq(g.waves.length, 0, 'F1: sin ondas en fase 1');
  eq(g.enemies.length, 0, 'F1: sin invocaciones en fase 1');
  eq(g.flags.mareaIntro, true, 'F1: banner del jefe al primer aggro');
  eq(g.bossBannerText, 'LA MAREA SIN NOMBRE', 'F1: banner text');
  eq(g.bossBannerSub, 'El abismo también canta', 'F1: banner sub');
  near(maxAtkCd, 2.4, 1e-6, 'F1: cadencia base atkCd 2.4');
}

// ---- F1 · BARRIDO a <150 px ----
{
  const { g, e } = sim(0.95, 490, 300, false); // d=90
  ok(g.telegraphs.length >= 1, 'F1 barrido: telegraph emitido a <150 px');
  const t0 = g.telegraphs[0];
  eq(t0.kind, 'aro', 'F1 barrido: telegraph kind aro');
  eq(t0.r, 64, 'F1 barrido: radio 64');
  eq(t0.dmg, 16, 'F1 barrido: dmg 16');
  near(t0.t, 0.9, 0.02, 'F1 barrido: telegrafía 0.9');
  eq(g.projectiles.length, 0, 'F1 barrido: el barrido no emite orbes');
  ok(g.telegraphs.every((t: any) => t.kind === 'aro'), 'F1 barrido: siempre prefiere barrido a 90 px');
  // durante el windup la marca de telegrafía está puesta (se limpia al resolver)
  const e2 = mkMarea(400, 300, 0.95);
  const g2 = mkGame(490, 300, false) as unknown as import('../src/game/engine').Game;
  tickMareaR19(g2, e2, DT, MAREA_DEF_R19, {});
  eq(e2.telegraphKind, 'aro', 'F1 barrido: e.telegraphKind=aro durante windup');
}

// ---- FASE 2 · PLEAMAR (50%): invulT + espuma-línea ×4 + salto con onda ----
{
  const { g, e } = sim(0.5, 560, 300, true); // tileSolid=true: NO se teletransporta al caer
  eq(e.phase, 2, 'F2: fase 2');
  eq(g.toasts.some((t: string) => t.includes('PLEAMAR')), true, 'F2: toast PLEAMAR');
  eq(e.invulT, 1.2, 'F2: invulT 1.2 en la transición (fake no decae)');
  eq(g.waves.length, 2, 'F2: 2 shockwaves (salto del ciclo ×2 en 10 s)');
  ok(g.waves.every((w: any) => w.maxR === 110 && w.speed === 150 && w.hit === false), 'F2: onda maxR 110 · speed 150 · sin golpear');
  ok(g.waves.every((w: any) => w.dmg === 13), 'F2: dmg onda = round(16×0.8) = 13');
  const lentos = g.projectiles.filter((p: any) => Math.abs(hyp(p) - 55) < 1e-6);
  const rapidos = g.projectiles.filter((p: any) => Math.abs(hyp(p) - 130) < 1e-6);
  eq(lentos.length, 4, 'F2: espuma-línea = 4 orbes lentos (|v| 55) en 10 s');
  ok(lentos.every((p: any) => p.dmg === 10), 'F2: dmg espuma = round(16×0.6) = 10');
  eq(rapidos.length, 3, 'F2: 1 abanico del ciclo alterno (3 orbes)');
  eq(g.telegraphs.length, 2, 'F2: 2 telegraphs slam del salto');
  ok(g.telegraphs.every((t: any) => t.kind === 'slam' && t.r === 44), 'F2: telegraph slam r 44');
  // el muro barre lateralmente: velocidad perpendicular al eje jefe→Portador
  const e0 = { x: 400, y: 300 };
  const p0 = lentos[0];
  const angJeP = Math.atan2(g.player.y - e0.y, g.player.x - e0.x);
  const angV = Math.atan2(p0.vy, p0.vx);
  const dif = Math.abs(((angV - angJeP) % Math.PI + Math.PI) % Math.PI - Math.PI / 2);
  ok(dif < 1e-6, 'F2: velocidad de la espuma perpendicular al eje jefe→Portador');
  // el muro es lineal: los 4 salen alineados en el eje (separación 13 px)
  const mismos = lentos.every((p: any) => Math.abs(p.vx - p0.vx) < 1e-9 && Math.abs(p.vy - p0.vy) < 1e-9);
  ok(mismos, 'F2: los 4 orbes avanzan como muro (misma velocidad)');
}

// ---- FASE 3 · RESACA (20%): sombras + cadencia 60% + daño +20% ----
{
  const { g, e, maxAtkCd } = sim(0.2, 560, 300, true);
  eq(e.phase, 3, 'F3: fase 3');
  eq(g.toasts.some((t: string) => t.includes('RESACA')), true, 'F3: toast RESACA');
  eq(g.enemies.length, 2, 'F3: invoca 2 sombras-espuma (una vez)');
  ok(g.enemies.every((s: any) => s.aggro === true), 'F3: las sombras salen en aggro');
  eq(g.waves.length, 1, 'F3: 1 shockwave del primer salto (cadencia 60%)');
  ok(g.waves.every((w: any) => w.dmg === 15), 'F3: dmg onda = round(16×1.2×0.8) = 15 (+20%)');
  const lentos = g.projectiles.filter((p: any) => Math.abs(hyp(p) - 55) < 1e-6);
  const rapidos = g.projectiles.filter((p: any) => Math.abs(hyp(p) - 130) < 1e-6);
  eq(lentos.length, 4, 'F3: espuma-línea sigue activa (4 orbes lentos)');
  ok(lentos.every((p: any) => p.dmg === 12), 'F3: dmg espuma = round(16×1.2×0.6) = 12');
  eq(rapidos.length, 3, 'F3: 1 abanico en 10 s (cadencia al 60%)');
  ok(rapidos.every((p: any) => p.dmg === 13), 'F3: dmg orbe = round(16×1.2×0.7) = 13');
  eq(g.telegraphs.length, 2, 'F3: 2 telegraphs slam (1º resuelto con onda; el 2º arranca en t≈9.8 y queda en windup)');
  ok(g.telegraphs.every((t: any) => t.dmg === 19), 'F3: dmg telegraph = round(16×1.2) = 19');
  near(maxAtkCd, 4.0, 1e-6, 'F3: atkCd = 2.4/0.6 = 4.0 (cadencia 60%)');
}

// ---- aturdido/quebrado (barra de quiebre como los demás jefes) ----
{
  const g = mkGame(490, 300, false);
  const e = mkMarea(400, 300, 0.95, { ai: 'aturdido', aiT: 4, sta: 0 });
  const G = g as unknown as import('../src/game/engine').Game;
  tickMareaR19(G, e, DT, MAREA_DEF_R19, {});
  ok(e.aiT <= 2.6, `aturdido: aiT del motor (4) ajustado a ${e.aiT.toFixed(3)} ≤ 2.6`);
  eq(e.moving, false, 'aturdido: quieta');
  eq(e.windup, 0, 'aturdido: windup a 0');
  for (let i = 0; i < 300; i++) tickMareaR19(G, e, DT, MAREA_DEF_R19, {});
  eq(e.ai, 'persigue', 'aturdido: sale a persigue');
  eq(e.sta, 90, 'aturdido: barra de quiebre recuperada al completo');
}

// ---- aggro por distancia (el motor lo hace tras el despacho: réplica) ----
{
  // hp LLENA: así la única vía de aggro es la distancia (hp<maxHp también
  // aggroa, como en el motor — se prueba aparte en el simulador del juego)
  const g = mkGame(480, 300, false); // d=80 < aggroR 170
  const e = mkMarea(400, 300, 1, { aggro: false });
  tickMareaR19(g as unknown as import('../src/game/engine').Game, e, DT, MAREA_DEF_R19, {});
  eq(e.aggro, true, 'aggro: activa por distancia de día (hp llena)');
  const g2 = mkGame(480, 300, false);
  (g2 as any).state = 'dialogue';
  const e2 = mkMarea(400, 300, 1, { aggro: false });
  tickMareaR19(g2 as unknown as import('../src/game/engine').Game, e2, DT, MAREA_DEF_R19, {});
  eq(e2.aggro, false, 'aggro: NO en diálogo (guard g.state)');
  const g3 = mkGame(480, 300, false);
  const e3 = mkMarea(400, 300, 0.95, { aggro: false }); // hp<maxHp → aggro inmediato
  tickMareaR19(g3 as unknown as import('../src/game/engine').Game, e3, DT, MAREA_DEF_R19, {});
  eq(e3.aggro, true, 'aggro: dañada (hp<maxHp) → aggro como el motor');
}

// ---- determinismo: 2 runs idénticas tick a tick ----
{
  const a = sim(0.5, 560, 300, true);
  const b = sim(0.5, 560, 300, true);
  eq(a.snaps.length, b.snaps.length, 'determinismo: misma longitud de traza');
  let iguales = true;
  for (let i = 0; i < a.snaps.length; i++) {
    if (a.snaps[i] !== b.snaps[i]) { iguales = false; console.log(`  ✗ divergencia en tick ${i}\n    A: ${a.snaps[i]}\n    B: ${b.snaps[i]}`); fails++; break; }
  }
  if (iguales) ok(true, 'determinismo: 600 snapshots idénticos (2 runs, misma semilla)');
  const c = sim(0.2, 560, 300, true);
  const d2 = sim(0.2, 560, 300, true);
  ok(c.snaps.every((s, i) => s === d2.snaps[i]), 'determinismo: fase 3 también reproducible');
}

// ---- sin NaN en entidad + salidas (todas las sims) ----
{
  const sims = [
    sim(0.95, 560, 300, false), sim(0.95, 490, 300, false),
    sim(0.5, 560, 300, true), sim(0.2, 560, 300, true),
    sim(0.95, 490, 300, false, { ai: 'aturdido', aiT: 4, sta: 0 }), // partículas de espuma (rng)
  ];
  let allFin = true;
  for (const { g, e } of sims) {
    for (const [k, v] of Object.entries({ x: e.x, y: e.y, hp: e.hp, anim: e.anim, atkCd: e.atkCd, windup: e.windup, aiT: e.aiT, sta: e.sta, invulT: e.invulT ?? 0 })) {
      if (typeof v !== 'number' || !Number.isFinite(v)) { allFin = false; console.log(`  ✗ NaN en e.${k}`); fails++; }
    }
    for (const arr of [g.projectiles, g.waves, g.telegraphs, g.particles]) {
      for (const o of arr) for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'number' && !Number.isFinite(v)) { allFin = false; console.log(`  ✗ NaN en salida.${k}: ${JSON.stringify(o)}`); fails++; }
      }
    }
  }
  if (allFin) ok(true, 'sin NaN en 4 sims × 600 ticks (entidad + proyectiles + ondas + telegraphs + partículas)');
  // las partículas usan rng determinista: misma longitud entre runs gemelas
  const p1 = sims[2].g.particles.length, p2 = sim(0.5, 560, 300, true).g.particles.length;
  eq(p1, p2, 'partículas de espuma: count determinista');
}

// ============================================================
// [4] SPRITE — 5 frames 26×22, determinista, init idempotente
// ============================================================
console.log('\n[4] sprite buildMareaR19 / initJefeMareaR19Sprites');
{
  const direct = buildMareaR19();
  eq(direct.length, 5, 'buildMareaR19: 5 frames (idle 2 + cast + ataque + sumergida)');
  ok(direct.every(f => f.width === 26 && f.height === 22), 'buildMareaR19: todos 26×22');
  const sigsDirecto = direct.map(f => f.toDataURL());
  ok(new Set(sigsDirecto).size >= 2, `buildMareaR19: animación variada (${new Set(sigsDirecto).size} firmas distintas)`);

  initJefeMareaR19Sprites();
  const fr = getSpr('marea');
  ok(!!fr && Array.isArray(fr), "getSpr('marea') registrado (no undefined)");
  eq(fr!.length, 5, "getSpr('marea'): 5 frames");
  const sigsReg = fr!.map(f => f.toDataURL());
  ok(sigsReg.every((s, i) => s === sigsDirecto[i]), 'registro idéntico al build directo');

  initJefeMareaR19Sprites(); // idempotente
  const fr2 = getSpr('marea');
  ok(fr2!.map(f => f.toDataURL()).every((s, i) => s === sigsReg[i]), '2ª init: mismo raster (idempotente)');

  const rebuilt = buildMareaR19();
  ok(rebuilt.map(f => f.toDataURL()).every((s, i) => s === sigsDirecto[i]), 'determinismo: 2º build → firmas idénticas (FNV de ops)');
  ok(rebuilt.every((f, i) => f !== direct[i]), '2º build: canvas NUEVOS (sin reuso)');
}

// ============================================================
// [5] CERO Math.random en la fuente del módulo
// ============================================================
{
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const src = readFileSync(join(import.meta.dir, '..', 'src', 'game', 'jefe_marea_r19.ts'), 'utf8');
  // se ignoran líneas de comentario (la cabecera DOCUMENTA la ausencia de
  // Math.random y contiene el literal)
  const codigo = src.split('\n').filter(l => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');
  ok(!codigo.includes('Math.random'), 'fuente (sin comentarios) sin Math.random (mulberry32 local)');
  ok(src.includes('PUNTOS DE CABLEADO PARA EL INTEGRADOR'), 'cabecera de cableado presente');
}

console.log('');
if (fails === 0) {
  console.log('SMOKE JEFE MAREA R19: TODO OK');
} else {
  console.log(`SMOKE JEFE MAREA R19: ${fails} FALLOS`);
  process.exit(1);
}
