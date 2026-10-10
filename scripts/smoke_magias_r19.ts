// ============================================================
// 19-b (magias) — Smoke del SISTEMA DE MAGIAS sin navegador
// Stub DOM/Audio (patrón scripts/smoke_timeskip.ts) + Game real:
//  (1) estructura del grimorio (6 magias bien formadas) + sprite
//      'vendaval_p' registrado + cero Math.random en el módulo,
//  (2) gate del Tomo del Canto (sin tomo: cast=false, panel gate),
//  (3) loadout: asignar/quitar/ids inválidos + save→continueGame,
//  (4) lanzamiento y cooldowns: curación 35%, vendaval (pierce 2,
//      dmg 18+esp·1.2), nota_hielo (proyectil hielo), nova (aoe +
//      slowT 3 + congelado del motor), estandarte (buff+aura 4/s),
//      eco_escudo (absorbe 40 vía ecoEscudoAbsorbR19), recast con
//      cd activo → false, decaimiento por tick,
//  (5) boost +20% del Estandarte (comparado contra partida sin él),
//  (6) interacción de la pestaña: click slot → lista → asignar →
//      QUITAR (callbacks reales de addHit) + draw sin lanzar y
//      alto devuelto acotado,
//  (7) tick sin NaN en 3 estados y con dt NaN/Infinity/0/-1.
// Ejecutar: bun scripts/smoke_magias_r19.ts
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

const {
  MAGIAS_R19, magiaDefR19, magiasGateR19, magiaSlotR19, setMagiaSlotR19,
  magiaCdLeftR19, castMagiaR19, magiasTickR19, drawMagiasPanelR19,
  initMagiasR19, ecoEscudoAbsorbR19,
} = await import('../src/game/magias_r19');
const { getSpr } = await import('../src/game/sprites');
const { readFileSync } = await import('node:fs');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

function newGame(): InstanceType<typeof Game> {
  const g = new Game(makeCanvas());
  g.newGame('Prueba', 'alba');
  g.startPlay();
  g.player!.hasEcho = true;
  return g;
}

const DDT = 1 / 60;
function tickMagias(g: InstanceType<typeof Game>, secs: number) {
  for (let i = 0; i < Math.round(secs * 60); i++) magiasTickR19(g, DDT);
}

/** Ejecuta el callback del uiHit cuya celda contenga (px,py). */
function clickEn(g: InstanceType<typeof Game>, px: number, py: number): boolean {
  for (const h of g.uiHit) {
    if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) { h.cb(); return true; }
  }
  return false;
}

const PX = 148, PY = 127, PW = 664; // lo que pasará drawPause (cx, cy, pw-56)

console.log('=== 1) Estructura del grimorio + sprite + determinismo ===');
{
  if (MAGIAS_R19.length === 6) ok('6 magias en el grimorio');
  else bad(`grimorio: ${MAGIAS_R19.length} magias`);
  const ids = new Set(MAGIAS_R19.map(m => m.id));
  if (ids.size === 6) ok('ids únicos');
  else bad(`ids duplicados (${ids.size}/6)`);
  let bien = true;
  for (const m of MAGIAS_R19) {
    if (!m.id || !m.nombre || !(m.cd > 0) || !m.desc || !m.color || !m.letra) bien = false;
    if (m.escuela !== 'alba' && m.escuela !== 'tejedor') bien = false;
    if (magiaDefR19(m.id) !== m) bien = false;
  }
  if (bien) ok('todas con id/nombre/cd>0/desc/color/letra y escuela alba|tejedor');
  else bad('alguna magia mal formada');
  const esperados = ['canto_curativo', 'vendaval', 'estandarte', 'nota_hielo', 'nota_hielo_mayor', 'eco_escudo'];
  if (esperados.every(id => ids.has(id))) ok('los 6 ids del diseño están (curativo/vendaval/estandarte/2 hielos/escudo)');
  else bad('faltan ids del diseño: ' + esperados.filter(id => !ids.has(id)).join(','));

  initMagiasR19();
  initMagiasR19(); // idempotente
  const spr = getSpr('vendaval_p');
  if (spr !== getSpr('__probe_inexistente__') && spr.length >= 1 && spr[0].width === 12)
    ok(`sprite 'vendaval_p' registrado (canvas 12×12, ${spr.length} frame, idempotente)`);
  else bad(`sprite vendaval_p: len=${spr.length} w=${spr[0]?.width}`);

  const srcRaw = readFileSync(new URL('../src/game/magias_r19.ts', import.meta.url), 'utf8');
  const srcCodigo = srcRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // sin comentarios
  if (!srcCodigo.includes('Math.random')) ok('cero Math.random en el CÓDIGO del módulo (solo en comentarios)');
  else bad('el módulo contiene Math.random ejecutable');
}

console.log('\n=== 2) Gate del Tomo del Canto ===');
{
  const g = newGame();
  g.state = 'pause'; // drawMagias se usa en pausa; cast exige play
  g.state = 'play';
  setMagiaSlotR19(g, 0, 'canto_curativo');
  if (magiasGateR19(g) === false) ok('sin tomo_canto el gate cierra');
  else bad('gate abierto sin tomo');
  const hp0 = g.player!.hp;
  if (castMagiaR19(g, 0) === false && g.player!.hp === hp0) ok('sin tomo: castMagiaR19 → false (y no cura)');
  else bad('cast sin tomo no fue rechazado');
  if (magiaCdLeftR19(g, 'canto_curativo') === 0) ok('sin tomo: no se fijó cooldown');
  else bad('cooldown fijado sin tomo');
  // panel de gate dibujable y elegante (no lanza, alto acotado)
  g.state = 'pause';
  g.uiHit.length = 0;
  let threw: string | null = null, h = 0;
  try { h = drawMagiasPanelR19(g, PX, PY, PW); } catch (e) { threw = String(e); }
  if (threw === null && h > 60 && h < 260) ok(`panel de gate dibuja sin lanzar (alto ${h})`);
  else bad(`panel de gate: threw=${threw} alto=${h}`);
  if (g.uiHit.length === 0) ok('panel de gate: sin zonas de click (solo-lectura)');
  else bad(`panel de gate con ${g.uiHit.length} hits`);
  g.state = 'play';
}

console.log('\n=== 3) Loadout: asignar/quitar/validación + save→continueGame ===');
{
  const g = newGame();
  g.flags['tomo_canto'] = true; // para verificar que TAMBIÉN viaja en el save
  if (magiaSlotR19(g, 0) === '') ok('slots vacíos de serie');
  else bad('slot 0 no vacío de serie');
  if (setMagiaSlotR19(g, 0, 'vendaval') && magiaSlotR19(g, 0) === 'vendaval') ok('asignar vendaval → slot 0');
  else bad('asignación slot 0 falló');
  if (setMagiaSlotR19(g, 3, 'nota_hielo') && magiaSlotR19(g, 3) === 'nota_hielo') ok('asignar nota_hielo → slot 3');
  else bad('asignación slot 3 falló');
  if (!setMagiaSlotR19(g, 1, 'magia_inventada') && magiaSlotR19(g, 1) === '') ok('id inventado RECHAZADO');
  else bad('se aceptó un id que no existe');
  if (!setMagiaSlotR19(g, 7, 'vendaval') && !setMagiaSlotR19(g, -1, 'vendaval')) ok('slots fuera de rango rechazados');
  else bad('índices de slot fuera de rango aceptados');
  if (setMagiaSlotR19(g, 0, '') && magiaSlotR19(g, 0) === '') ok('quitar (id \'\') → slot vacío');
  else bad('quitar falló');
  setMagiaSlotR19(g, 0, 'vendaval'); setMagiaSlotR19(g, 1, 'nota_hielo_mayor');

  // round-trip de guardado (los ids de slot son strings en flags: viajan en JSON)
  g.save();
  const g2 = new Game(makeCanvas());
  g2.continueGame();
  if (magiaSlotR19(g2, 0) === 'vendaval' && magiaSlotR19(g2, 1) === 'nota_hielo_mayor')
    ok('save() → continueGame(): los ids de los slots sobreviven');
  else bad(`round-trip de slots: s0='${magiaSlotR19(g2, 0)}' s1='${magiaSlotR19(g2, 1)}'`);
  if (magiasGateR19(g2) === true) ok('tomo_canto también sobrevive al guardado');
  else bad('tomo_canto perdido en el round-trip');
}

console.log('\n=== 4) Lanzamiento, cooldowns y efectos ===');
{
  // ---- canto_curativo ----
  const g = newGame();
  g.flags['tomo_canto'] = true;
  setMagiaSlotR19(g, 0, 'canto_curativo');
  const p = g.player!;
  p.hp = Math.floor(p.maxHp * 0.5);
  if (castMagiaR19(g, 0) === true) ok('canto_curativo se lanza con tomo');
  else bad('canto_curativo rechazado con tomo');
  const cura = Math.round(p.maxHp * 0.35);
  if (p.hp === Math.floor(p.maxHp * 0.5) + cura) ok(`cura exacta: +${cura} (35% de ${p.maxHp})`);
  else bad(`cura incorrecta: hp=${p.hp} esperado ${Math.floor(p.maxHp * 0.5) + cura}`);
  if (Math.abs(magiaCdLeftR19(g, 'canto_curativo') - 45) < 1e-9) ok('cd 45 s fijado');
  else bad(`cd curativo: ${magiaCdLeftR19(g, 'canto_curativo')}`);
  if (castMagiaR19(g, 0) === false) ok('recast con cd activo → false');
  else bad('recast permitido con cd');
  tickMagias(g, 2.5);
  if (Math.abs(magiaCdLeftR19(g, 'canto_curativo') - 42.5) < 0.05) ok('el tick decae el cd (45 → 42.5 en 2.5 s)');
  else bad(`decaimiento cd: ${magiaCdLeftR19(g, 'canto_curativo')}`);

  // ---- vendaval ----
  setMagiaSlotR19(g, 1, 'vendaval');
  const npr0 = g.projectiles.length;
  if (castMagiaR19(g, 1) === true && g.projectiles.length === npr0 + 1) {
    const pr = g.projectiles[g.projectiles.length - 1];
    const dmgEsp = Math.round(18 + p.attrs.esp * 1.2);
    if (pr.sprite === 'vendaval_p' && pr.pierce === 2 && pr.from === 'player' && pr.element === 'sagrado')
      ok('vendaval: proyectil perforante (pierce 2, sprite propio, from player)');
    else bad(`vendaval mal: sprite=${pr.sprite} pierce=${pr.pierce}`);
    if (pr.dmg === dmgEsp) ok(`vendaval dmg = 18 + esp·1.2 = ${dmgEsp}`);
    else bad(`vendaval dmg ${pr.dmg} ≠ ${dmgEsp}`);
    if (Math.hypot(pr.vx, pr.vy) > 0) ok('vendaval vuela hacia el aim (velocidad no nula)');
    else bad('vendaval sin velocidad');
  } else bad('vendaval no empujó proyectil');
  if (Math.abs(magiaCdLeftR19(g, 'vendaval') - 6) < 1e-9) ok('cd 6 s del vendaval');
  else bad(`cd vendaval: ${magiaCdLeftR19(g, 'vendaval')}`);

  // ---- nota_hielo ----
  setMagiaSlotR19(g, 2, 'nota_hielo');
  if (castMagiaR19(g, 2) === true) {
    const pr = g.projectiles[g.projectiles.length - 1];
    if (pr.element === 'hielo' && pr.dmg === 14 && pr.from === 'player') ok('nota_hielo: proyectil hielo dmg 14');
    else bad(`nota_hielo mal: el=${pr.element} dmg=${pr.dmg}`);
  } else bad('nota_hielo rechazada');
  if (Math.abs(magiaCdLeftR19(g, 'nota_hielo') - 8) < 1e-9) ok('cd 8 s de la nota');
  else bad(`cd nota: ${magiaCdLeftR19(g, 'nota_hielo')}`);

  // ---- nota_hielo_mayor: nova + slow + congelado ----
  const eCerca = g.makeEnemy('lobo', p.x + 40, p.y, 0);
  const eLejos = g.makeEnemy('lobo', p.x + 400, p.y, 0);
  eCerca.hp = eCerca.maxHp = 500; // tanques: el crit del motor (×2) no debe matarlos a mitad del test
  eLejos.hp = eLejos.maxHp = 500;
  g.enemies.push(eCerca, eLejos);
  const hpCerca0 = eCerca.hp, hpLejos0 = eLejos.hp;
  setMagiaSlotR19(g, 3, 'nota_hielo_mayor');
  if (castMagiaR19(g, 3) === true) {
    ok('nota_hielo_mayor se lanza');
    if (eCerca.hp < hpCerca0) ok(`nova daña al cercano (${hpCerca0} → ${eCerca.hp})`);
    else bad('la nova no dañó al enemigo cercano');
    if (eLejos.hp === hpLejos0) ok('a >90 px la nova NO alcanza');
    else bad('la nova alcanzó al enemigo lejano');
    if (eCerca.slowT >= 3) ok(`slow 3 s aplicado (slowT=${eCerca.slowT.toFixed(1)})`);
    else bad(`slowT=${eCerca.slowT}`);
    if (eCerca.statuses.some(s => s.kind === 'congelado')) ok('estado congelado del motor presente (elemento hielo)');
    else bad('sin estado congelado');
  } else bad('nota_hielo_mayor rechazada');
  if (Math.abs(magiaCdLeftR19(g, 'nota_hielo_mayor') - 18) < 1e-9) ok('cd 18 s de la nova');
  else bad(`cd nova: ${magiaCdLeftR19(g, 'nota_hielo_mayor')}`);

  // ---- estandarte: buff + aura 4/s ----
  setMagiaSlotR19(g, 2, 'estandarte');
  const hpAura0 = eLejos.hp; // usamos al lejano para el aura (reseteamos su distancia)
  eLejos.x = p.x + 30; eLejos.y = p.y;
  if (castMagiaR19(g, 2) === true) {
    if (g.flags['estandarte_t'] === 8) ok('estandarte: buff 8 s en flag');
    else bad(`estandarte_t=${String(g.flags['estandarte_t'])}`);
    if (Math.abs(magiaCdLeftR19(g, 'estandarte') - 40) < 1e-9) ok('cd 40 s del estandarte (fijado al lanzar)');
    else bad(`cd estandarte al lanzar: ${magiaCdLeftR19(g, 'estandarte')}`);
    if (g.waves.length >= 1) ok('anillo visual del estandarte en waves');
    else bad('sin anillo visual');
    const waves0 = g.waves.length;
    tickMagias(g, 1.15); // 1 pulso
    if (eLejos.hp < hpAura0) ok(`aura 4/s: hp del enemigo en radio baja (${hpAura0} → ${eLejos.hp})`);
    else bad('el aura no dañó al enemigo en radio');
    if (eLejos.hitFlash > 0) ok('aura marca hitFlash (vía damageEnemy del motor)');
    else bad('sin hitFlash en el aura');
    if (g.waves.length > waves0 || waves0 > 0) ok('pulso del aura con anillo propio');
    else bad('el aura no emite anillo');
    if (g.flags['estandarte_t'] > 0 && g.flags['estandarte_t'] < 8)
      ok(`buff decae con el tick (quedan ${(g.flags['estandarte_t'] as number).toFixed(2)} s)`);
    else bad(`buff no decae: ${String(g.flags['estandarte_t'])}`);
    tickMagias(g, 8);
    if ((g.flags['estandarte_t'] as number) === 0) ok('buff expira a 0 exacto');
    else bad(`buff residual: ${String(g.flags['estandarte_t'])}`);
  } else bad('estandarte rechazado');
  if (Math.abs(magiaCdLeftR19(g, 'estandarte') - (40 - 9.15)) < 0.06)
    ok(`cd del estandarte decayó con los ticks (40 → ${magiaCdLeftR19(g, 'estandarte').toFixed(2)} tras 9.15 s)`);
  else bad(`cd estandarte tras ticks: ${magiaCdLeftR19(g, 'estandarte')}`);

  // ---- eco_escudo + absorción (secuencial: cada paso comprueba su estado) ----
  setMagiaSlotR19(g, 2, 'eco_escudo');
  if (castMagiaR19(g, 2) === true && g.flags['eco_escudo_t'] === 6 && g.flags['eco_escudo_hp'] === 40)
    ok('eco_escudo: 6 s / 40 hp en flags');
  else bad(`eco_escudo flags: t=${String(g.flags['eco_escudo_t'])} hp=${String(g.flags['eco_escudo_hp'])}`);
  const atraviesa1 = ecoEscudoAbsorbR19(g, 25);
  if (atraviesa1 === 0 && g.flags['eco_escudo_hp'] === 15) ok('absorbe 25 → atraviesa 0, quedan 15 de escudo');
  else bad(`absorción 1: atraviesa=${atraviesa1} hp=${String(g.flags['eco_escudo_hp'])}`);
  const atraviesa2 = ecoEscudoAbsorbR19(g, 25);
  if (atraviesa2 === 10 && (g.flags['eco_escudo_t'] as number) === 0 && (g.flags['eco_escudo_hp'] as number) === 0)
    ok('escudo roto con 15: absorbe 15 y atraviesa 10 (flags a 0)');
  else bad(`rotura: atraviesa=${atraviesa2} t=${String(g.flags['eco_escudo_t'])} hp=${String(g.flags['eco_escudo_hp'])}`);
  if (ecoEscudoAbsorbR19(g, 30) === 30) ok('sin escudo: el daño atraviesa íntegro');
  else bad('sin escudo sigue absorbiendo');

  // ---- slots vacíos y fuera de rango ----
  const g3 = newGame();
  g3.flags['tomo_canto'] = true;
  if (castMagiaR19(g3, 0) === false) ok('slot vacío → false con aviso');
  else bad('cast en slot vacío devolvió true');
  if (castMagiaR19(g3, 9) === false && castMagiaR19(g3, -2) === false) ok('índices de cast fuera de rango → false');
  else bad('cast con índice inválido aceptado');
  g3.state = 'pause';
  setMagiaSlotR19(g3, 0, 'vendaval');
  if (castMagiaR19(g3, 0) === false) ok('fuera de \'play\' no se lanza');
  else bad('cast aceptado fuera de play');
}

console.log('\n=== 5) Boost de velocidad +20% del Estandarte ===');
{
  // dos partidas idénticas: una con buff, otra sin — misma "marcha" manual
  const run = (conBuff: boolean): number => {
    const g = newGame();
    g.enemies.length = 0;
    const p = g.player!;
    g.flags['tomo_canto'] = true;
    setMagiaSlotR19(g, 0, 'estandarte');
    if (conBuff) castMagiaR19(g, 0);
    const x0 = p.x, y0 = p.y;
    for (let i = 0; i < 120; i++) { // 2 s andando "hacia la derecha" a 74 px/s
      magiasTickR19(g, DDT);
      p.x += 74 * DDT;
      p.moving = true;
    }
    return Math.hypot(p.x - x0, p.y - y0);
  };
  const dSin = run(false), dCon = run(true);
  const ratio = dCon / Math.max(1e-6, dSin);
  if (ratio > 1.08 && ratio < 1.34)
    ok(`desplazamiento ${dSin.toFixed(1)} px sin buff → ${dCon.toFixed(1)} px con buff (×${ratio.toFixed(2)} ≈ +20%)`);
  else bad(`ratio de velocidad fuera de rango: ${ratio.toFixed(3)}`);
}

console.log('\n=== 6) Pestaña MAGIAS: interacción real (addHit) y draw sin lanzar ===');
{
  const g = newGame();
  g.flags['tomo_canto'] = true;
  g.state = 'pause';
  g.uiHit.length = 0;
  let threw: string | null = null, h = 0;
  try { h = drawMagiasPanelR19(g, PX, PY, PW); } catch (e) { threw = String(e); }
  if (threw === null && h > 200 && h < 400) ok(`panel completo dibuja sin lanzar (alto ${h})`);
  else bad(`panel: threw=${threw} alto=${h}`);
  if (g.uiHit.length === 4 + 6) ok(`hits de una pasada: 4 slots + 6 magias (${g.uiHit.length})`);
  else bad(`hits esperados 10, hay ${g.uiHit.length}`);

  // click en slot 0 → abre la lista (sin mágicos: el slot está vacío)
  const slot0 = { x: PX, y: PY + 24, w: 54, h: 54 };
  if (clickEn(g, slot0.x + 5, slot0.y + 5)) ok('click en slot 0 abre la lista');
  else bad('click en slot 0 no cayó en ningún hit');
  g.uiHit.length = 0;
  try { drawMagiasPanelR19(g, PX, PY, PW); } catch (e) { threw = String(e); }
  if (threw !== null) bad('draw con lista abierta lanzó: ' + threw);
  else ok('draw con lista abierta OK');

  // click en la fila del grimorio 'vendaval' (índice 1 → columnas 0/1, fila superior)
  // orden de hits tras slots: filas del grimorio en orden MAGIAS_R19
  const filaVendaval = g.uiHit[4 + 1];
  if (filaVendaval) {
    filaVendaval.cb();
    if (magiaSlotR19(g, 0) === 'vendaval') ok('click en magia de la lista → asignada al slot 0 abierto');
    else bad('la asignación por click no llegó al flag');
  } else bad('no encontré la fila del grimorio en uiHit');

  // reabrir slot 0 (ahora ocupado) → QUITAR (dibujado antes que CERRAR)
  g.uiHit.length = 0;
  drawMagiasPanelR19(g, PX, PY, PW);
  clickEn(g, slot0.x + 5, slot0.y + 5);
  g.uiHit.length = 0;
  drawMagiasPanelR19(g, PX, PY, PW);
  const btns = g.uiHit.filter(h2 => h2.w === 104 && h2.h === 22 && h2.x > PX + PW - 130);
  if (btns.length >= 2) {
    btns[0].cb(); // QUITAR
    if (magiaSlotR19(g, 0) === '') ok('botón QUITAR vacía el slot');
    else bad(`QUITAR no vació: slot0='${magiaSlotR19(g, 0)}'`);
  } else bad(`sin botones QUITAR/CERRAR con slot abierto (${btns.length})`);

  // cooldown activo se refleja en el panel (dibuja sin lanzar con cds)
  g.flags['magia_cd_vendaval'] = 3.3;
  g.uiHit.length = 0;
  try { drawMagiasPanelR19(g, PX, PY, PW); } catch (e) { threw = String(e); }
  if (threw === null) ok('panel con cooldown activo dibuja sin lanzar');
  else bad('panel con cd lanzó: ' + threw);
  g.state = 'play';
}

console.log('\n=== 7) Tick robusto: 3 estados + dt hostiles (sin NaN) ===');
{
  const g = newGame();
  g.flags['tomo_canto'] = true;
  setMagiaSlotR19(g, 0, 'estandarte');
  setMagiaSlotR19(g, 1, 'eco_escudo');
  castMagiaR19(g, 0); castMagiaR19(g, 1);
  const gEstados = ['play', 'pause', 'dialogue'] as const;
  let limpio = true;
  for (const st of gEstados) {
    g.state = st;
    for (let i = 0; i < 120; i++) magiasTickR19(g, DDT);
    const flagsOk = [g.flags['estandarte_t'], g.flags['eco_escudo_t'], g.flags['eco_escudo_hp'],
      g.flags['magia_cd_estandarte'], g.flags['magia_cd_eco_escudo']]
      .every(v => v === undefined || v === 0 || (typeof v === 'number' && Number.isFinite(v)));
    if (!flagsOk) limpio = false;
  }
  if (limpio) ok(`tick 120 frames en 3 estados (play/pause/dialogue) sin NaN en flags`);
  else bad('flags con NaN tras los ticks de estados');
  // dt hostiles: no toca nada y no rompe
  g.state = 'play';
  const t0 = g.flags['estandarte_t'];
  for (const dt of [NaN, Infinity, -1, 0]) magiasTickR19(g, dt as number);
  if (g.flags['estandarte_t'] === t0) ok('dt NaN/Infinity/-1/0 → el tick no toca nada');
  else bad(`dt hostil mutó flags: ${String(g.flags['estandarte_t'])} (antes ${String(t0)})`);
  // arrays acotados tras todo el smoke
  if (g.particles.length < 240 && g.waves.length < 40)
    ok(`arrays acotados (partículas ${g.particles.length}, ondas ${g.waves.length})`);
  else bad(`arrays desbocados: p=${g.particles.length} w=${g.waves.length}`);
}

console.log(fails === 0 ? '\nSMOKE MAGIAS R19: TODO OK' : `\nSMOKE MAGIAS R19: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
