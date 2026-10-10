// ============================================================
// R17 «Semillas del Eco» (balance por zona · pasado→presente · UI) — Smoke sin navegador
// (stub DOM/Audio/localStorage: patrón de smoke_arbol.ts)
// ============================================================
// Verifica la ronda:
//   1) balance por zona: multiplicadores, jefes con vida de diseño (sin zona)
//   2) Semillas del Eco: parcelas válidas, plantar en el pasado, recoger en el presente
//   3) Lente del Eco: disponibilidad
//   4) HUD/UI: pistas que se retiran, distintivo de época, frame completo sin lanzar
//   5) intro de jefe por mapa (antes solo el primer jefe de la sesión) + logro del Acto IV
// Ejecutar: npx tsx scripts/smoke_r17.mts
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
  // R17: Proxy → cualquier método de canvas que falte es no-op (el frame completo usa muchos)
  const base: AnyP = {
    canvas: { width: 300, height: 150 }, imageSmoothingEnabled: false,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    drawImage: noop, fillText: noop, setTransform: noop, rect: noop, clip: noop,
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    createPattern: () => null, measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData: noop,
  };
  return new Proxy(base, {
    get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[a-z]/.test(k) ? noop : undefined),
    set: (t, k, v) => { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
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
(globalThis as AnyP).window = {
  addEventListener: noop, removeEventListener: noop,
  setInterval: () => 0, clearInterval: noop, setTimeout: () => 0,
  innerWidth: 1440, innerHeight: 900, // fitViewToWindow del motor necesita dims reales
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
(audio as unknown as { init: () => void }).init = () => {};
const { MAPS, mapRows, tileAt, mapEpochs } = await import('../src/game/maps');
const { SOLID_CHARS } = await import('../src/game/sprites');
const { ENEMY_DEFS, BOSS_R17, BOSS_HP_PRE_R17 } = await import('../src/game/data');
const { zonaMult, zonaNivel, enemyStatMult } = await import('../src/game/balance');
const eco = await import('../src/game/ecocausal');
const { drawGame } = await import('../src/game/render');
const { minimapRect } = await import('../src/game/world/minimap');
const { bossIntroActive, startBossIntro } = await import('../src/game/actors/bossintro');
const { logroName } = await import('../src/game/achievements');

let fails = 0;
const ok = (m: string) => console.log('  ✓ ' + m);
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const check = (m: string, c: boolean, extra = '') => (c ? ok(m) : bad(m + (extra ? ' — ' + extra : '')));
type G = InstanceType<typeof Game>;
function boot(disc: 'alba' | 'tejedor' = 'alba'): G {
  const g = new Game(makeCanvas());
  g.newGame('QA17', disc);
  g.startPlay();
  return g;
}
const step = (g: G, n: number, dt = 1 / 60) => { for (let i = 0; i < n; i++) g.update(dt); };

console.log('=== 1) Balance por zona ===');
{
  const z1 = zonaMult('lunaris'), z8 = zonaMult('cumbres');
  check('Lunaris (tutorial) queda neutro', z1.hp === 1 && z1.dmg === 1 && z1.xp === 1);
  check('Cumbres (zona 8): vida ×2,54 · daño ×1,49 · XP ×1,7', Math.abs(z8.hp - 2.54) < 1e-9 && Math.abs(z8.dmg - 1.49) < 1e-9 && Math.abs(z8.xp - 1.7) < 1e-9, JSON.stringify(z8));
  check('mapa fuera de tabla (interior) → zona 1', zonaNivel('interior_tienda') === 1);
  const orden = ['lunaris', 'bosque', 'cripta', 'costa', 'aldea', 'cumbres', 'cuna', 'ciudadela'].map(zonaNivel);
  check('la zona crece con la ruta de la historia', orden.every((v, i) => i === 0 || v >= orden[i - 1]), orden.join(','));
  for (const [k, b] of Object.entries(BOSS_R17)) {
    check(`${k}: vida de diseño R17 = ${b.hp} (antes ${BOSS_HP_PRE_R17[k]})`, ENEMY_DEFS[k]?.hp === b.hp && b.hp > (BOSS_HP_PRE_R17[k] ?? 0));
  }
  // los jefes NO reciben la escala de zona al aparecer (makeEnemy pasa el tipo)
  const g = boot();
  g.player!.level = 12;
  g.loadMap('cumbres', 10, 10);
  const golem = g.makeEnemy('golem', 100, 100, 0, 'boss');
  const lobo = g.makeEnemy('lobo', 100, 100, 1);
  const mJ = enemyStatMult(g, 'golem'), mN = enemyStatMult(g, 'lobo');
  check('Gólem en Cumbres: vida = diseño × dificultad (sin zona)', golem.maxHp === Math.max(1, Math.round(ENEMY_DEFS.golem.hp * mJ.hp)), `${golem.maxHp}`);
  check('Gólem por debajo de 1,2× su vida de diseño', golem.maxHp <= ENEMY_DEFS.golem.hp * 1.2, `${golem.maxHp}`);
  check('lobo en Cumbres SÍ escala con la zona', lobo.maxHp === Math.max(1, Math.round(ENEMY_DEFS.lobo.hp * mN.hp)) && lobo.maxHp > ENEMY_DEFS.lobo.hp * 2, `${lobo.maxHp}`);
  g.loadMap('cripta', 10, 10);
  const sep = g.makeEnemy('sepulcro', 100, 100, 0, 'antesala');
  const gua = g.makeEnemy('guardian', 100, 100, 0, 'boss');
  check('Sepulcro (mini-jefe) más débil que el Guardián', sep.maxHp < gua.maxHp, `${sep.maxHp} vs ${gua.maxHp}`);
}

console.log('\n=== 2) Semillas del Eco ===');
{
  const all = eco.todasLasParcelas();
  check('12 parcelas en 5 mapas', all.length === 12, String(all.length));
  check('ids únicos', new Set(all.map(s => s.id)).size === all.length);
  check('deterministas (misma elección en 2 llamadas)', JSON.stringify(eco.todasLasParcelas()) === JSON.stringify(all));
  for (const s of all) {
    const m = MAPS[s.map];
    const rows = mapRows(m);
    const [a, b] = mapEpochs(m);
    const libre = !SOLID_CHARS.has(tileAt(m, rows, s.tx, s.ty, a)) && !SOLID_CHARS.has(tileAt(m, rows, s.tx, s.ty, b));
    const dentro = s.tx > 0 && s.ty > 0 && s.tx < m.w - 1 && s.ty < m.h - 1;
    if (!libre || !dentro) bad(`${s.id} (${s.tx},${s.ty}) transitable en ambas épocas`);
  }
  ok('todas las parcelas: dentro del mapa y transitables en ambas épocas');

  const g = boot();
  const p = g.player!;
  p.hasEcho = true;
  const s0 = eco.parcelasDe('lunaris')[0];
  g.loadMap('lunaris', s0.tx, s0.ty);
  p.x = s0.tx * 16 + 8; p.y = s0.ty * 16 + 8;
  step(g, 2);
  check('presente sin plantar → «tierra muerta»', g.nearestInteract()?.kind === 'parcela', g.nearestInteract()?.kind);
  g.epochSwitch();
  check('Q te lleva al pasado', g.epoch === 'pasado');
  step(g, 2);
  const it = g.nearestInteract();
  check('pasado → «Plantar una Semilla del Eco»', it?.kind === 'semilla', it?.kind);
  it?.act();
  check('flag semilla_ guardado', g.flags[`semilla_${s0.id}`] === true);
  check('ya plantada: no se ofrece otra vez', g.nearestInteract()?.kind !== 'semilla');
  g.epochSwitch();
  step(g, 2);
  check('al volver al presente el mundo lo recuerda (arbol_visto_)', g.flags[`arbol_visto_${s0.id}`] === true);
  const pot0 = p.potions, gold0 = p.gold;
  p.hp = 1;
  const f = g.nearestInteract();
  check('presente → «Recoger el Fruto del Eco»', f?.kind === 'fruto', f?.kind);
  f?.act();
  check('fruto: vida completa, +1 poción, +25 coronas', p.hp === p.maxHp && p.potions === pot0 + 1 && p.gold === gold0 + 25);
  check('fruto recogido una sola vez', g.nearestInteract()?.kind !== 'fruto');
  const prog = eco.progresoSemillas(g);
  check('progreso: 1 sembrada · 1 fruto', prog.sembradas === 1 && prog.frutos === 1, JSON.stringify(prog));
  // cada 4 frutos: +1 punto de atributo
  for (const s of eco.parcelasDe('lunaris').slice(1).concat(eco.parcelasDe('bosque').slice(0, 1))) {
    g.flags[`semilla_${s.id}`] = true; g.flags[`fruto_${s.id}`] = true;
  }
  check('cuarto fruto contado', eco.frutosRecogidos(g) === 4);
  // el guardado conserva lo plantado
  g.save();
  const g2 = new Game(makeCanvas());
  g2.continueGame();
  check('las semillas viajan en el save', g2.flags[`semilla_${s0.id}`] === true && g2.flags[`fruto_${s0.id}`] === true);
}

console.log('\n=== 3) Lente del Eco ===');
{
  const g = boot();
  g.loadMap('lunaris', 25, 20);
  g.player!.hasEcho = false;
  check('sin el Eco despierto: sin lente', !eco.lensDisponible(g));
  g.player!.hasEcho = true;
  check('con el Eco y otra época en el mapa: lente disponible', eco.lensDisponible(g));
}

console.log('\n=== 4) HUD / UI ===');
{
  const g = boot();
  check('partida nueva: la pista de controles está activa', !g.flags.hintMove);
  g.keys.add('d');
  step(g, 60 * 5);
  g.keys.delete('d');
  check('tras ~4 s caminando se retira sola (hintMove)', g.flags.hintMove === true && g.flags.hintMoveT === undefined);
  g.player!.hasEcho = true;
  check('pista «Pulsa Q» pendiente hasta usar la época', !g.flags.usedEpoch);
  g.player!.x = 25 * 16 + 8; g.player!.y = 20 * 16 + 8;
  g.epochSwitch();
  check('al cambiar de época se retira (usedEpoch)', g.flags.usedEpoch === true);
  let threw = '';
  for (const ep of ['pasado', 'presente'] as const) {
    g.epoch = ep;
    try { drawGame(g); } catch (e) { threw = String(e); }
  }
  check('frame completo con distintivo de época (pasado y presente) sin lanzar', !threw, threw);
  check('el minimapa publica su marco para anclar el distintivo', minimapRect.w > 0 && minimapRect.h > 0, JSON.stringify(minimapRect));
  g.flags[`semilla_${eco.parcelasDe('lunaris')[0].id}`] = true;
  g.player!.weaponPlus = 3;
  try { drawGame(g); } catch (e) { threw = String(e); }
  check('frame con contador de semillas y arma +3 sin lanzar', !threw, threw);
}

console.log('\n=== 5) Intro de jefe por mapa + logro del Acto IV ===');
{
  const g = boot();
  g.loadMap('cripta', 10, 10);
  g.bossRef = g.makeEnemy('guardian', 100, 100, 0, 'boss');
  startBossIntro(g);
  check('primera intro de la sesión activa', bossIntroActive());
  g.loadMap('costa', 10, 10);
  check('cruzar a otro mapa corta la intro en curso', !bossIntroActive());
  g.bossRef = g.makeEnemy('sirena', 100, 100, 0, 'boss');
  startBossIntro(g);
  check('el SEGUNDO jefe de la sesión también tiene su intro', bossIntroActive());
  check('logro del Acto IV ya sin «próximamente»', logroName('ultima_nota') === 'El Último Canto');
}

console.log(fails === 0 ? '\nSMOKE R17: TODO OK' : `\nSMOKE R17: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
