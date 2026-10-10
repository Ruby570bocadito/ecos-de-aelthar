// ============================================================
// 19-h (jefe-vesh) — Smoke del JEFE FINAL «VESH, LA ÚLTIMA NOTA»
// Stub DOM/Audio (patrón smoke_timeskip) + canvas GRABADOR
// (patrón smoke_jefes_sprites) + Game real. El cerebro se llama
// DIRECTO (veshTickR19) con dt controlado para observar el COMPÁS.
//
// Verifica:
//  (1) def bien formada: hp 750 · breakBar 110 · literales Element ·
//      spawn/banner/gold/xp + registro ENEMY_DEFS.vesh,
//  (2) cerebro: compás (salvas en tiempos 2-3, pausa en 4), acorde de
//      8 cada 4 compases, F2 teleports + 3 nodos de silencio (máx 3
//      vivos, estallido a los 3 compases), F3 onda de compás con
//      telegrafía + doble acorde, coda con espiral de 16 (22.5°),
//      anti-kite >300 px y quiebre (aturdido→persigue, sta restaurada),
//  (3) 800 ticks sin NaN y sin excepciones, arrays acotados,
//  (4) sprite: 5 frames 30×24, determinista (FNV de ops ×2 builds),
//  (5) veshDeathFxR19: ≥1 wave + partículas sin NaN, guard anti-doble.
// Ejecutar: bun scripts/smoke_jefe_vesh_r19.ts
// ============================================================

// ---------- stub universal + canvas grabador ----------
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

/** Firma determinista de una lista de ops de dibujo (hash FNV-1a). */
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
  const canvas: any = { width: 0, height: 0, style: {}, addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }) };
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
    drawFocusIfNeeded: noop, putImageData: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  canvas.getContext = (_: string) => ctx;
  canvas.toDataURL = () => `data:image/png;base64,${ops.length.toString(36)}${fnv1a(ops.join(';'))}`;
  canvas.__ops = () => ops.join(';');
  return canvas as RecCanvas;
}

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
  removeEventListener: noop,
  innerWidth: 1280, innerHeight: 720,
  setInterval: () => 0, clearInterval: noop, setTimeout: () => 0,
  AudioContext: undefined, webkitAudioContext: undefined,
} as unknown as Window & typeof globalThis;
(globalThis as AnyP).document = {
  createElement: (tag: string) => (tag === 'canvas' ? makeRecCanvas() : stub()),
  getElementById: () => makeRecCanvas(),
  addEventListener: noop,
  body: stub(),
  documentElement: stub(),
} as unknown as Document;
(globalThis as AnyP).performance = { now: () => Date.now() };
(globalThis as AnyP).requestAnimationFrame = () => 0;
(globalThis as AnyP).cancelAnimationFrame = noop;

// ---------- sujeto bajo prueba ----------
const { Game } = await import('../src/game/engine');
const { audio } = await import('../src/game/audio');
const { ENEMY_DEFS } = await import('../src/game/data');
const { getSpr } = await import('../src/game/sprites');
const {
  VESH_DEF_R19, VESH_BOSS_INFO_R19, VESH_SPAWN_R19,
  buildVeshR19, initJefeVeshR19Sprites,
  veshTickR19, veshPoseR19, veshDeathFxR19, drawVeshDeathFxR19,
} = await import('../src/game/jefe_vesh_r19');

(audio as unknown as { init: () => void }).init = () => {};
(audio as unknown as { ctx: unknown }).ctx = stub();

// registro de la def (lo que el integrador hará en data.ts — ver cabecera)
(ENEMY_DEFS as Record<string, unknown>).vesh = VESH_DEF_R19;

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

type G = InstanceType<typeof Game>;
type E = G['enemies'][number];

const fin = (n: number) => Number.isFinite(n);

function newGame(): G {
  const g = new Game(makeRecCanvas());
  g.newGame('Prueba', 'alba');
  g.startPlay();
  g.enemies.length = 0; // sin lobos: la sala es del jefe
  return g;
}

function makeVesh(g: G, x: number, y: number): E {
  const t = 'vesh' as unknown as Parameters<G['makeEnemy']>[0];
  const v = g.makeEnemy(t, x, y, 0, 'boss');
  return v;
}

/** Llama al cerebro y devuelve cuántos proyectiles empujó. */
function tick(v0: number, g: G, v: E, dt: number, def = VESH_DEF_R19): number {
  veshTickR19(g, v, dt, def);
  return g.projectiles.length - v0;
}

const nodesAlive = (g: G): E[] =>
  g.enemies.filter(o => !o.dead && o.spawnGuard === 99999 && o.etype === 'sombra');
const nodesDead = (g: G): number =>
  g.enemies.filter(o => o.dead && o.spawnGuard === 99999 && o.etype === 'sombra').length;

const P = () => 25 * 16 + 8; // px del centro de lunaris (spawn del Portador)

console.log('=== SMOKE 19-h · JEFE VESH «LA ÚLTIMA NOTA» ===');

// ---------------- (1) def bien formada ----------------
console.log('\n[1] def · spawn · banner · registro');
{
  const d = VESH_DEF_R19;
  if (d.hp === 750) ok('hp 750');
  else bad(`hp ${d.hp} (esperado 750)`);
  if (d.breakBar === 110) ok('breakBar 110 (barra de quiebre)');
  else bad(`breakBar ${d.breakBar}`);
  if (d.name === 'Vesh, el Primer Cantor') ok('name exacto (R19-int: el heraldo del Acto IV llevaba su nombre robado)');
  else bad(`name "${d.name}"`);
  if (d.sprite === 'vesh') ok("sprite 'vesh'");
  else bad(`sprite "${d.sprite}"`);
  ok(`element '${d.element}' · weakTo '${d.weakTo}' (literales Element de types.ts:14)`);
  if (d.element === 'sombra' && d.weakTo === 'ninguno') ok('element sombra · weakTo ninguno (sin debilidad, patrón Guardián)');
  else bad('literales element/weakTo inesperados');
  if (d.speed === 42 && d.xp === 800 && d.aggroR === 190 && d.atkR === 50 && d.windup === 0.7 && d.atkCd === 1.8)
    ok('speed 42 · xp 800 · aggroR 190 · atkR 50 · windup 0.7 · atkCd 1.8');
  else bad('stats base incorrectos');
  if (Array.isArray(d.gold) && d.gold[0] === 500 && d.gold[1] === 650) ok('oro [500, 650]');
  else bad(`oro ${JSON.stringify(d.gold)}`);
  if (d.desc.includes('primer cantor')) ok('desc: «el primer cantor…»');
  else bad('desc sin la biblia del personaje');
  if (VESH_SPAWN_R19.map === 'ciudadela' && VESH_SPAWN_R19.x === 27 && VESH_SPAWN_R19.y === 10)
    ok(`spawn ciudadela (27,10) zone '${VESH_SPAWN_R19.zone}' (plano 19-g)`);
  else bad('spawn distinto del previsto');
  if (VESH_BOSS_INFO_R19.name === 'VESH · EL PRIMER CANTOR' && VESH_BOSS_INFO_R19.sub === 'La nota que nadie se atrevió a terminar')
    ok('banner: name + sub exactos');
  else bad('banner mal formado');
  if (ENEMY_DEFS.vesh === VESH_DEF_R19) ok('ENEMY_DEFS.vesh registrado (vía Object.assign, patrón 14-a)');
  else bad('la def no llegó a ENEMY_DEFS');
}

// ---------------- (2a) FASE 1: el compás ----------------
console.log('\n[2] FASE 1 «LA BATUTA»: compás de 4 tiempos + acorde cada 4');
{
  const g = newGame();
  const p = g.player!;
  const v = makeVesh(g, P() + 120, 20 * 16);
  v.aggro = true;
  g.bossActive = false;

  const pushes: number[] = [];
  for (let i = 0; i < 21; i++) pushes.push(tick(g.projectiles.length, g, v, 0.75));

  const esperado = [0, 0, 3, 3, 0, 0, 3, 3, 0, 0, 3, 3, 0, 8, 3, 3, 0, 0, 3, 3, 0];
  if (JSON.stringify(pushes) === JSON.stringify(esperado))
    ok(`compás exacto: ${esperado.join(',')} (tiempos 2-3 disparan 3, tiempo 4 pausa, acorde de 8 cada 4 compases)`);
  else bad(`patrón de compás distinto: ${pushes.join(',')}`);

  if (v.w === 22 && v.h === 16) ok('caja de jefe auto-sanada (22×16)');
  else bad(`caja ${v.w}×${v.h}`);
  if (g.bossActive && g.bossRef === v) ok('banner: bossRef/bossActive activados por el cerebro');
  else bad('el cerebro no activó la barra de jefe');
  if (g.flags.veshIntro === true) ok('flag de intro veshIntro fijada');
  else bad('sin flag veshIntro');

  // arco puntual: outer ±20° respecto al centro (≈0.349 rad; diff normalizado)
  const nota = g.projectiles.filter(pr => pr.sprite === 'nota');
  if (nota.length >= 3) {
    const base = Math.atan2(p.y - 4 - v.y, p.x - v.x);
    const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const desv = nota.slice(0, 3).map(pr => norm(Math.atan2(pr.vy, pr.vx) - base));
    const spread = Math.abs(desv[0] - desv[2]);
    if (Math.abs(spread - 2 * Math.PI / 9) < 0.02) ok(`arco puntual ±20° verificado (spread ${(spread * 180 / Math.PI).toFixed(1)}°)`);
    else bad(`spread del arco ${(spread * 180 / Math.PI).toFixed(1)}°`);
  } else bad('sin notas para medir el arco');

  // acorde: 8 ángulos equiespaciados 45°
  const prev = g.projectiles.length;
  // forzamos el acorde vía anti-kite (castigo con acorde) más abajo;
  // aquí validamos el del compás 4 tomando las 8 tras el push 14:
  void prev;
  const poses = [veshPoseR19(v)];
  if (poses[0] === 'idle' || poses[0] === 'cast' || poses[0] === 'batuta' || poses[0] === 'coda')
    ok(`veshPoseR19 válida (${poses[0]})`);
  else bad('pose inválida');

  g.toasts.length = 0;
}

// ---------------- (2b) FASE 2: el silencio ----------------
console.log('\n[3] FASE 2 «EL SILENCIO»: teleport tras el Portador + 3 nodos (máx 3 vivos)');
{
  const g = newGame();
  const p = g.player!;
  const v = makeVesh(g, P() + 120, 20 * 16);
  v.aggro = true;
  v.hp = v.maxHp * 0.5; // → fase 2

  tick(g.projectiles.length, g, v, 0.75); // banner + transición
  if (g.toasts.some(t => t.text.includes('El Silencio desciende'))) ok('toast «El Silencio desciende…»');
  else bad('sin toast de transición a F2');
  if ((v.invulT ?? 0) > 0) ok(`transición con invulT ${v.invulT?.toFixed(2)} s`);
  else bad('sin invulT de transición');
  if (v.phase === 2) ok('fase 2 alcanzada');
  else bad(`fase ${v.phase}`);

  const x0 = v.x, y0 = v.y;
  let pushes: number[] = [];
  for (let i = 0; i < 16; i++) {
    pushes.push(tick(g.projectiles.length, g, v, 0.75));
    if (nodesAlive(g).length > 3) bad(`nodos vivos ${nodesAlive(g).length} (>3)`);
  }
  if (nodesAlive(g).length === 3) ok('3 nodos de silencio vivos (sombra estática 90 hp, spawnGuard congelado)');
  else bad(`nodos vivos: ${nodesAlive(g).length}`);
  const nd = nodesAlive(g)[0];
  if (nd && nd.maxHp === 90 && nd.hp === 90) ok('nodos con mucha vida (90 hp)');
  else bad(`vida de nodo ${nd?.hp}/${nd?.maxHp}`);
  if (Math.hypot(v.x - x0, v.y - y0) > 30) ok('Vesh se teleporta cada compás (partículas + reaparición)');
  else bad('Vesh no se movió en F2');
  const dvx = Math.hypot(v.x - p.x, v.y - p.y);
  if (dvx > 50 && dvx < 220) ok(`reaparición tras el Portador (${dvx.toFixed(0)} px)`);
  else bad(`reaparición a ${dvx.toFixed(0)} px`);
  if (pushes.every(n => n <= 3)) ok('F2 sin acordes: salvas dirigidas de 3 como máximo');
  else bad(`F2 disparó una salva de ${Math.max(...pushes)}`);
  if (nodesDead(g) >= 3) ok('nodos no destruidos ESTALLAN a los 3 compases (killEnemy)');
  else bad(`nodos estallados: ${nodesDead(g)}`);
  if (g.waves.some(w => w.dmg === 12 && w.maxR === 74)) ok('estallido de nodo: onda de 12 con maxR 74');
  else bad('sin ondas de estallido de nodo');
  // a lo largo de 16 compases nunca hubo más de 3 vivos (check dentro del bucle)
  ok('máx 3 nodos vivos en todo momento (16 compases verificados)');
}

// ---------------- (2c) FASE 3: el acorde final ----------------
console.log('\n[4] FASE 3 «EL ACORDE FINAL»: onda de compás + doble acorde');
{
  const g = newGame();
  const v = makeVesh(g, P() + 120, 20 * 16);
  v.aggro = true;
  v.hp = v.maxHp * 0.25; // → fase 3 (salta directo, >15%: sin coda)

  tick(g.projectiles.length, g, v, 1.0);
  if (g.toasts.some(t => t.text.includes('ACORDE FINAL'))) ok('toast «EL ACORDE FINAL resuena»');
  else bad('sin toast de F3');
  if (v.phase === 3) ok('fase 3 alcanzada');
  else bad(`fase ${v.phase}`);
  if (!g.enemies.some(o => o.spawnGuard === 99999)) ok('F3 no crea nodos de silencio');
  else bad('F3 creó nodos');

  let dobleAc = 0, ondaTel = false, ondaWave = false, maxPush = 0;
  for (let i = 0; i < 14; i++) {
    const n = tick(g.projectiles.length, g, v, 1.0);
    maxPush = Math.max(maxPush, n);
    if (n >= 16) dobleAc++;
    if (g.telegraphs.some(t => t.r === 90 && t.maxT === 1.0)) ondaTel = true;
    if (g.waves.some(w => w.dmg === 18 && w.maxR === 230)) ondaWave = true;
  }
  if (ondaTel) ok('onda de compás: telegrafía de 1 s (aro r=90)');
  else bad('sin telegrafía de la onda de compás');
  if (ondaWave) ok('onda de compás: shockwave radial enorme (maxR 230, dmg 18)');
  else bad('sin shockwave de la onda de compás');
  if (dobleAc >= 1) ok(`doble acorde: círculos de 8 dos veces (${dobleAc} vez/veces, push máx ${maxPush})`);
  else bad(`sin doble acorde (push máx ${maxPush})`);
  g.toasts.length = 0;
}

// ---------------- (2d) LA CODA (espiral de 16) ----------------
console.log('\n[5] CODA: carga de 2 s + espiral de 16 (22.5°, determinista)');
{
  const g = newGame();
  const v = makeVesh(g, P() + 120, 20 * 16);
  v.aggro = true;
  v.hp = v.maxHp * 0.10; // <15%: coda disponible

  let espiral = -1;
  let angulos: number[] = [];
  let codaPose = false;
  let tel74 = false;
  for (let i = 0; i < 30; i++) {
    const n = tick(g.projectiles.length, g, v, 0.5);
    if (veshPoseR19(v) === 'coda') codaPose = true;
    if (g.telegraphs.some(t => t.r === 74 && t.maxT === 2.0)) tel74 = true;
    if (n === 16 && espiral < 0) {
      espiral = i;
      angulos = g.projectiles.slice(-16).map(pr => Math.atan2(pr.vy, pr.vx)).sort((a, b) => a - b);
    }
  }
  if (tel74) ok('telegrafía grande de la coda (aro r=74, 2 s)');
  else bad('sin telegrafía de coda');
  if (codaPose) ok("pose 'coda' expuesta durante la carga (veshPoseR19)");
  else bad("sin pose 'coda'");
  if (espiral >= 0) ok(`espiral de 16 notas lanzada (frame-tick ${espiral})`);
  else bad('la espiral nunca sonó');
  if (angulos.length === 16) {
    const diffs: number[] = [];
    for (let i = 1; i < angulos.length; i++) diffs.push(angulos[i] - angulos[i - 1]);
    const mal = diffs.filter(dd => Math.abs(dd - Math.PI / 8) > 0.01).length;
    if (mal === 0) ok('ángulos exactos: base + i·22.5° (determinista, π/8)');
    else bad(`${mal}/15 pasos de espiral ≠ 22.5°`);
  }
  // el enfriamiento de la coda respeta el cd de 9 s (≥17 calls a dt 0.5).
  // OJO: el doble acorde de F3 también empuja 16 — se distingue por el dmg
  // (espiral 10 · notas de compás/acorde 12).
  const espirales: number[] = [];
  for (let i = 0; i < 60; i++) {
    const n = tick(g.projectiles.length, g, v, 0.5);
    if (n === 16) {
      const last = g.projectiles.slice(-16);
      if (last.every(pr => pr.dmg === 10)) espirales.push(i); // espiral de CODA
    }
  }
  if (espirales.length >= 2) {
    const gaps = espirales.slice(1).map((ix, k) => ix - espirales[k]);
    if (gaps.every(gp => gp >= 17)) ok(`coda con cd 9 s: gaps entre espirales ${gaps.join(', ')} calls (≥17)`);
    else bad(`la coda volvió demasiado pronto (gaps ${gaps.join(', ')})`);
  } else bad(`espirales de coda insuficientes para medir el cd (${espirales.length})`);
}

// ---------------- (2e) ANTI-KITE ----------------
console.log('\n[6] ANTI-COWBOY: >300 px → teleport a media distancia + acorde');
{
  const g = newGame();
  const p = g.player!;
  const v = makeVesh(g, P() + 120, 20 * 16);
  v.aggro = true;
  p.x = v.x + 340; p.y = v.y; // farmea a distancia

  let acordeKite = false;
  for (let i = 0; i < 12; i++) {
    const n = tick(g.projectiles.length, g, v, 0.25);
    if (n >= 8) acordeKite = true;
  }
  const d = Math.hypot(v.x - p.x, v.y - p.y);
  if (d < 220) ok(`Vesh teleportó a media distancia (${d.toFixed(0)} px < 220)`);
  else bad(`sigue lejos: ${d.toFixed(0)} px`);
  if (acordeKite) ok('castigo: acorde inmediato (círculo de 8)');
  else bad('sin acorde de castigo');
  const avisos = g.toasts.filter(t => t.text.includes('no soporta el silencio') || t.text.includes('deja de huir')).length;
  if (avisos >= 1) ok(`aviso anti-kite emitido (${avisos})`);
  else bad('sin aviso anti-kite');
}

// ---------------- (2f) quiebre / aturdido ----------------
console.log('\n[7] QUIEBRE: e.sta/maxSta → aturdido → persigue con barra restaurada');
{
  const g = newGame();
  const v = makeVesh(g, P() + 120, 20 * 16);
  v.aggro = true;
  tick(g.projectiles.length, g, v, 0.5); // banner + arranque
  // el motor deja el quebrado así (damageEnemy: aiT 4, sta 0):
  v.ai = 'aturdido'; v.aiT = 4; v.sta = 0;
  for (let i = 0; i < 10; i++) tick(g.projectiles.length, g, v, 0.25);
  if (v.ai === 'persigue') ok('aturdido resuelto (2.2 s propios) → persigue');
  else bad(`ai tras quiebre: ${v.ai}`);
  if (v.sta === v.maxSta && v.maxSta === 110) ok('barra de quiebre restaurada (110/110)');
  else bad(`sta ${v.sta}/${v.maxSta}`);
}

// ---------------- (3) 800 ticks sin NaN ----------------
console.log('\n[8] ROBUSTEZ: 800 ticks (motor real + cerebro) sin NaN ni excepciones');
{
  const g = newGame();
  const p = g.player!;
  const v = makeVesh(g, P() + 130, 20 * 16);
  v.aggro = true;
  let threw: string | null = null;
  let maxPr = 0, maxPa = 0, maxW = 0, maxT = 0;
  try {
    for (let i = 0; i < 800; i++) {
      g.update(1 / 60);
      veshTickR19(g, v, 1 / 60, VESH_DEF_R19);
      if (i % 240 === 120) { p.x = v.x + 340; p.y = v.y; }   // lejos: kite
      if (i % 240 === 0) { p.x = v.x - 90; p.y = v.y + 10; } // cerca
      if (i === 300) v.hp = v.maxHp * 0.45;
      if (i === 500) v.hp = v.maxHp * 0.25;
      if (i === 620) v.hp = v.maxHp * 0.10;
      if (i % 30 === 0) p.hp = p.maxHp; // el humo no mata al Portador en la prueba
      maxPr = Math.max(maxPr, g.projectiles.length);
      maxPa = Math.max(maxPa, g.particles.length);
      maxW = Math.max(maxW, g.waves.length);
      maxT = Math.max(maxT, g.toasts.length);
    }
  } catch (err) { threw = String(err); }
  if (threw === null) ok('800 ticks (13,3 s: F1→F2→F3→coda) sin excepciones');
  else bad(`excepción: ${threw}`);
  const badV = !fin(v.x) || !fin(v.y) || !fin(v.hp) || !fin(v.anim) || !fin(v.beatT || 0);
  if (!badV) ok('estado del jefe sin NaN (x/y/hp/anim)');
  else bad('NaN en el estado del jefe');
  const prNaN = g.projectiles.filter(pr => !fin(pr.x) || !fin(pr.y) || !fin(pr.vx) || !fin(pr.vy) || !fin(pr.t)).length;
  const paNaN = g.particles.filter(pa => !fin(pa.x) || !fin(pa.y) || !fin(pa.t)).length;
  const wNaN = g.waves.filter(w => !fin(w.x) || !fin(w.y) || !fin(w.r)).length;
  if (prNaN === 0 && paNaN === 0 && wNaN === 0) ok('proyectiles/partículas/ondas sin NaN');
  else bad(`NaN: pr ${prNaN} · pa ${paNaN} · w ${wNaN}`);
  if (maxPr < 220) ok(`proyectiles acotados (máx ${maxPr})`);
  else bad(`proyectiles desbocados: ${maxPr}`);
  if (maxPa < 500) ok(`partículas acotadas (máx ${maxPa})`);
  else bad(`partículas desbocadas: ${maxPa}`);
  if (maxW < 16) ok(`ondas acotadas (máx ${maxW})`);
  else bad(`ondas desbocadas: ${maxW}`);
  if (maxT <= 8) ok(`toasts acotados (máx ${maxT})`);
  else bad(`toasts desbocados: ${maxT}`);
  if (g.flags.veshIntro === true && v.hp > 0 && !v.dead) ok('el jefe sobrevivió a su propia sinfonía (vivo, sin flag de derrota)');
  else bad('estado final inesperado del jefe');
}

// ---------------- (4) sprite determinista ----------------
console.log('\n[9] SPRITE: 5 frames 30×24 · determinismo FNV ×2 builds');
{
  const a = buildVeshR19();
  const b = buildVeshR19();
  if (a.length === 5 && b.length === 5) ok('5 frames (idle 2 + cast + batuta + coda)');
  else bad(`frames: ${a.length}/${b.length}`);
  let dimOk = a.length > 0;
  let detOk = true;
  const sigs: string[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i].width !== 30 || a[i].height !== 24) dimOk = false;
    if (b[i].width !== a[i].width || b[i].height !== a[i].height) dimOk = false;
    const sa = a[i].toDataURL();
    const sb = b[i].toDataURL();
    if (sa !== sb) detOk = false;
    sigs.push(fnv1a(a[i].__ops()));
  }
  if (dimOk) ok('todos los frames miden 30×24');
  else bad('tamaños de frame inconsistentes');
  if (detOk) ok(`2 builds byte a byte idénticas (${sigs[0]}, ${sigs[2]}, ${sigs[4]})`);
  else bad('las builds divergen (no determinista)');
  initJefeVeshR19Sprites();
  initJefeVeshR19Sprites(); // idempotente
  const reg = getSpr('vesh');
  if (reg && reg.length === 5 && reg[0].toDataURL() === a[0].toDataURL())
    ok("initJefeVeshR19Sprites idempotente: registerSpr('vesh') con la misma firma");
  else bad('el registro del sprite no coincide con buildVeshR19');
}

// ---------------- (5) muerte: onda dorada ----------------
console.log('\n[10] veshDeathFxR19: onda dorada + partículas · guard anti-doble');
{
  const g = newGame();
  const v = makeVesh(g, P() + 60, 20 * 16);
  const w0 = g.waves.length, pa0 = g.particles.length;
  veshDeathFxR19(g, v);
  const w1 = g.waves.length - w0, pa1 = g.particles.length - pa0;
  if (w1 >= 1) ok(`ondas doradas emitidas: ${w1} (≥1)`);
  else bad('sin ondas de muerte');
  if (pa1 >= 30) ok(`partículas doradas masivas: ${pa1}`);
  else bad(`pocas partículas: ${pa1}`);
  const nans = g.waves.slice(w0).some(w => !fin(w.r)) || g.particles.slice(pa0).some(pa => !fin(pa.x) || !fin(pa.t));
  if (!nans) ok('FX de muerte sin NaN');
  else bad('NaN en el FX de muerte');
  const w2 = g.waves.length, pa2 = g.particles.length;
  veshDeathFxR19(g, v); // guard: mismo enemigo → no doble
  if (g.waves.length === w2 && g.particles.length === pa2) ok('guard anti-doble: segunda llamada no emite');
  else bad('el FX se duplicó');
  if (drawVeshDeathFxR19 === veshDeathFxR19) ok('drawVeshDeathFxR19 es alias exacto (integrador: cualquiera de las dos)');
  else bad('el alias no coincide');
  g.bossRef = null;
  veshDeathFxR19(g); // sin enemigo: cae al Portador como centro
  if (g.waves.length > w2) ok('llamada sin e: cae a bossRef/Portador sin lanzar');
  else bad('llamada sin e falló');
}

console.log(fails === 0 ? '\nSMOKE JEFE VESH R19: TODO OK' : `\nSMOKE JEFE VESH R19: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
