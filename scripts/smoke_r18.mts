// ============================================================
// R18 «El Portador» + «Más mundo» — Smoke sin navegador
// (stub DOM/Audio/localStorage: patrón de smoke_arbol.ts)
// Verifica la ronda:
//   1) secciones nuevas: tamaño, enlaces, aterrizajes, todo alcanzable en su época
//   2) sellos de la historia (gates): cerrados/abiertos según la misión
//   3) misiones secundarias de principio a fin + reliquias y sus efectos
//   4) IA de los enemigos y mini-jefes nuevos en combate (sin errores, hacen daño)
//   5) Portador v4 con todo el equipo · grimorio de dos páginas · sprint
//   6) cinemáticas (hitos) y menos cofres sueltos
// Ejecutar: npx tsx scripts/smoke_r18.mts
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
const { MAPS, mapRows, tileAt } = await import('../src/game/maps');
const { SOLID_CHARS } = await import('../src/game/sprites');
const { ENEMY_DEFS } = await import('../src/game/data');
const { exitGate } = await import('../src/game/gates');
const SQ = await import('../src/game/sidequests');
const { heroFrame, HERO_FRAMES } = await import('../src/game/actors/hero');
const { switchGrimoirePage, grimoirePage, grimoireHasSecondPage } = await import('../src/game/skilltree');
const { cutsceneActive, skipCutscene, resetCutscenes } = await import('../src/game/cutscene');
const { forceStoryBeats } = await import('../src/game/storybeats');
const { drawGame } = await import('../src/game/render');
const { R18_TYPES } = await import('../src/game/enemies_r18');

let fails = 0;
const ok = (m: string) => console.log('  ✓ ' + m);
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const check = (m: string, c: boolean, extra = '') => (c ? ok(m) : bad(m + (extra ? ' — ' + extra : '')));
type G = InstanceType<typeof Game>;
function boot(disc: 'alba' | 'tejedor' = 'alba'): G {
  const g = new Game(makeCanvas());
  g.newGame('QA18', disc);
  g.startPlay();
  return g;
}
const step = (g: G, n: number, dt = 1 / 60) => { for (let i = 0; i < n; i++) g.update(dt); };
/** Avanza un diálogo hasta el final como un jugador (eligiendo la opción `pick`). */
function finish(g: G, pick = 0) {
  for (let i = 0; i < 40 && g.state === 'dialogue'; i++) {
    g.dlgCharT = 9999;
    if (g.dlgNode?.options?.length) g.dlgSel = pick;
    g.advanceDialogue();
  }
}
const NEW = ['molino', 'hondonada', 'acantilado', 'pantano', 'glaciar'] as const;

console.log('=== 1) Secciones nuevas ===');
{
  for (const id of NEW) {
    const m = MAPS[id];
    check(`${id}: ${m.w}×${m.h} con filas completas`, m.rows.length === m.h && m.rows.every(r => r.length === m.w));
    const ex = m.exits[0];
    const back = MAPS[ex.to];
    const link = back.exits.find(e => e.to === id);
    check(`${id}: enlazada con ${ex.to} en ambos sentidos`, !!link);
    const rowsB = mapRows(back), rowsN = mapRows(m);
    check(`${id}: aterrizajes transitables`, !SOLID_CHARS.has(tileAt(back, rowsB, ex.tx, ex.ty, 'presente')) && !!link && !SOLID_CHARS.has(tileAt(m, rowsN, link.tx, link.ty, 'presente')));
    check(`${id}: diferencias de época reales (${m.epochDiffs.length})`, m.epochDiffs.length > 0);
    check(`${id}: NPC, santuario, mini-jefe y misión`, m.npcs.length >= 1 && m.props.some(p => p.kind === 'sanctuary') && m.spawns.some(s => s.zone === 'boss') && SQ.SIDE_QUESTS.some(q => q.map === id));
    for (const s of m.spawns) if (!ENEMY_DEFS[s.type]) bad(`${id}: tipo de enemigo sin definir ${s.type}`);
  }
  // todo alcanzable a pie desde la entrada, en la época que corresponde
  const reach = (m: typeof MAPS.molino, ep: 'presente' | 'pasado', sx: number, sy: number) => {
    const rows = mapRows(m); const seen = new Uint8Array(m.w * m.h); const q = [sx, sy]; seen[sy * m.w + sx] = 1;
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], y = q[i + 1];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen[ny * m.w + nx] || SOLID_CHARS.has(tileAt(m, rows, nx, ny, ep))) continue;
        seen[ny * m.w + nx] = 1; q.push(nx, ny);
      }
    }
    return (x: number, y: number) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < m.w && Y < m.h && seen[Y * m.w + X] === 1; });
  };
  for (const id of NEW) {
    const m = MAPS[id];
    const ex = m.exits[0];
    const sx = ex.x === 0 ? ex.w : ex.x - 1, sy = ex.y + 1;
    const R = { presente: reach(m, 'presente', sx, sy), pasado: reach(m, 'pasado', sx, sy) };
    const soloPasado = new Set(['botella3', 'vela1']);
    const miss: string[] = [];
    for (const n of m.npcs) if (!R.presente(n.x, n.y)) miss.push(n.id);
    for (const p of m.props) if (!R[p.needPast || soloPasado.has(p.id) ? 'pasado' : 'presente'](p.x, p.kind === 'molino' ? p.y + 3 : p.y)) miss.push(p.id);
    for (const c of m.chests) if (!R[c.needPast ? 'pasado' : 'presente'](c.x, c.y)) miss.push(c.id);
    for (const s of m.spawns) if (s.zone === 'boss' && !R.presente(s.x, s.y)) miss.push(s.type);
    check(`${id}: NPC, objetos, cofre y mini-jefe alcanzables en su época`, miss.length === 0, miss.join(','));
  }
  check('el altar de la savia solo se alcanza por el pasado', (() => { const m = MAPS.hondonada; const ex = m.exits[0]; return !reach(m, 'presente', ex.x - 1, ex.y + 1)(7, 27) && reach(m, 'pasado', ex.x - 1, ex.y + 1)(7, 27); })());
  check('la tercera botella solo con la marea baja del pasado', (() => { const m = MAPS.acantilado; const ex = m.exits[0]; return !reach(m, 'presente', ex.x - 1, ex.y + 1)(7, 29) && reach(m, 'pasado', ex.x - 1, ex.y + 1)(7, 29); })());
  const g = boot();
  let threw = '';
  for (const id of NEW) {
    try { g.loadMap(id, MAPS[id].exits[0].x === 0 ? 3 : MAPS[id].w - 4, MAPS[id].exits[0].y + 1); drawGame(g); g.epoch = 'pasado'; drawGame(g); g.epoch = 'presente'; } catch (e) { threw = `${id}: ${e}`; break; }
  }
  check('cargar y dibujar las 5 secciones en ambas épocas sin errores', !threw, threw);
}

console.log('\n=== 2) Sellos de la historia ===');
{
  const g = boot();
  const gate = (from: string, to: string) => { g.loadMap(from as 'lunaris', 10, 10); const ex = g.map.exits.find(e => e.to === to)!; return exitGate(g, ex); };
  g.questIdx = 0;
  check('al empezar: Bosque, Costa y Molino sellados', !!gate('lunaris', 'bosque') && !!gate('lunaris', 'costa') && !!gate('lunaris', 'molino'));
  g.questIdx = 1;
  check('tras hablar con Brisa: el Molino se abre, el Bosque no', !gate('lunaris', 'molino') && !!gate('lunaris', 'bosque'));
  g.questIdx = 2;
  check('tras los lobos: el Bosque se abre; la Cripta sigue sellada', !gate('lunaris', 'bosque') && !!gate('bosque', 'cripta'));
  g.flags.fragmentTouched = true;
  check('tras el Fragmento: Cripta y Hondonada abiertas', !gate('bosque', 'cripta') && !gate('bosque', 'hondonada'));
  g.questIdx = 5;
  check('Acto II: la Costa se abre; Merrow y Acantilados no', !gate('lunaris', 'costa') && !!gate('costa', 'aldea') && !!gate('costa', 'acantilado'));
  g.questIdx = 9;
  check('tras el Gólem: Cumbres, Pantano y Glaciar abiertos', !gate('bosque', 'cumbres') && !gate('aldea', 'pantano') && !gate('cumbres', 'glaciar'));
  // el sello empuja de verdad
  g.questIdx = 0; g.loadMap('lunaris', 26, 4);
  g.player!.x = 26 * 16 + 8; g.player!.y = 0 * 16 + 8;
  step(g, 2);
  check('pisar un sello cerrado no cambia de mapa (te empuja de vuelta)', g.mapId === 'lunaris' && g.fadeDir === 0);
}

console.log('\n=== 3) Misiones secundarias y reliquias ===');
{
  const g = boot();
  g.questIdx = 10;
  const p = g.player!;
  const talk = (nid: string) => { g.talkTo(nid); return g.dlgNode; };
  // MOLINO
  g.loadMap('molino', 3, 20);
  let n = talk('aldara');
  check('Aldara ofrece «El Molino Mudo»', !!n && (n.options?.length ?? 0) >= 2);
  g.closeDialogue(); g.applyAction('sq_accept_molino');
  check('misión aceptada y seguida en el HUD', SQ.sqOn(g, SQ.SIDE_QUESTS[0]) && SQ.sqTracked(g)?.q.id === 'molino');
  g.epoch = 'pasado';
  const cu = MAPS.molino.props.find(x => x.id === 'cuaderno_mo')!;
  p.x = cu.x * 16 + 8; p.y = cu.y * 16 + 8;
  const it = g.nearestInteract();
  check('en el pasado se puede leer el cuaderno', it?.label.includes('cuaderno') === true, it?.label);
  it?.act(); g.closeDialogue();
  check('cuaderno leído → objetivo siguiente', !!g.flags.sq_molino_cuaderno && (SQ.sqCurrent(g, SQ.SIDE_QUESTS[0]) ?? '').includes('Reina'));
  g.epoch = 'presente';
  const reina = g.enemies.find(e => e.etype === 'reina_cuervo')!;
  check('la Reina de los Cuervos está en el mapa con vida de diseño', !!reina && reina.maxHp >= 300 && reina.maxHp <= 460, String(reina?.maxHp));
  const pts0 = p.points, gold0 = p.gold;
  reina.hp = 1; g.damageEnemy(reina, 50, 'ninguno', 0);
  check('derrotarla deja su flag y botín (+1 punto)', !!g.flags.reinaCuervoDerrotada && p.points >= pts0 + 1);
  n = talk('aldara'); finish(g);
  check('Aldara entrega la recompensa', SQ.sqDone(g, SQ.SIDE_QUESTS[0]) && p.gold > gold0 && SQ.relicOwned(g, 'pluma'));
  check('la Pluma queda equipada y acelera', SQ.relicEquipped(g) === 'pluma' && SQ.relicSpeedMult(g) > 1);
  // HONDONADA: savia de raíces + altar en el pasado
  g.loadMap('hondonada', 50, 30);
  talk('fenna'); g.closeDialogue(); g.applyAction('sq_accept_savia');
  for (let i = 0; i < 3; i++) { const r = g.makeEnemy('raiz', p.x + 40, p.y, 1); g.enemies.push(r); r.hp = 1; g.damageEnemy(r, 50, 'fuego', 0); }
  check('3 raíces → 3 de savia', Number(g.flags.sq_savia_n) === 3);
  const alt = MAPS.hondonada.props.find(x => x.id === 'altar_savia')!;
  p.x = alt.x * 16 + 8; p.y = alt.y * 16 + 8;
  g.epoch = 'presente';
  check('el altar no existe en el presente', g.nearestInteract()?.label?.includes('savia') !== true);
  g.epoch = 'pasado';
  g.nearestInteract()?.act();
  check('en el pasado se vierte la savia', !!g.flags.sq_savia_altar);
  // PANTANO: las velas solo prenden en el pasado
  g.epoch = 'presente';
  g.loadMap('pantano', 3, 20);
  g.applyAction('sq_accept_velas');
  const v = MAPS.pantano.props.find(x => x.id === 'vela2')!;
  p.x = v.x * 16 + 8; p.y = v.y * 16 + 8;
  g.nearestInteract()?.act();
  check('en el presente la vela no prende', !g.flags.vela2);
  g.epoch = 'pasado';
  g.nearestInteract()?.act();
  check('en el pasado sí (y su llama queda)', !!g.flags.vela2);
  // reliquias: corona reduce daño, escarcha congela
  g.flags.reliquia_corona = true; SQ.equipRelic(g, 'corona');
  check('Corona de Ramas: −10% de daño recibido', SQ.relicDamageTakenMult(g) === 0.9);
  g.flags.reliquia_escarcha = true; SQ.equipRelic(g, 'escarcha');
  check('Escarcha Cantora: 12% de congelar', SQ.relicFreezeChance(g) === 0.12);
  g.save();
  const g2 = new Game(makeCanvas()); g2.continueGame();
  check('misiones, reliquias y velas viajan en el save', !!g2.flags.sq_molino_done && !!g2.flags.reliquia_pluma && g2.flags.reliquia === 'escarcha' && !!g2.flags.vela2);
}

console.log('\n=== 4) IA de los enemigos y mini-jefes nuevos ===');
{
  for (const type of [...R18_TYPES]) {
    const g = boot();
    g.questIdx = 10;
    const home = type === 'cangrejo' || type === 'rey_cangrejo' ? 'acantilado' : type === 'fatuo' || type === 'viuda' ? 'pantano' : type === 'arana' || type === 'ciervo' ? 'hondonada' : type === 'wendigo' ? 'glaciar' : 'molino';
    g.loadMap(home as 'molino', 3, 20);
    g.enemies = g.enemies.filter(e => e.zone !== 'boss' && !['reina_cuervo', 'ciervo', 'rey_cangrejo', 'viuda', 'wendigo'].includes(e.etype));
    const p = g.player!;
    p.hp = p.maxHp = 9999;
    const sp = MAPS[home as 'molino'].spawns.find(s => s.type === type) ?? MAPS[home as 'molino'].spawns[0];
    p.x = sp.x * 16 + 8; p.y = sp.y * 16 + 8 + 40;
    const e = g.makeEnemy(type as never, sp.x * 16 + 8, sp.y * 16 + 8, 1);
    e.aggro = true;
    g.enemies.push(e);
    let threw = '';
    const hp0 = p.hp;
    try { for (let i = 0; i < 60 * 12; i++) { g.update(1 / 60); p.hp = Math.max(p.hp, 200); if (g.state !== 'play') g.setState('play'); } } catch (err) { threw = String((err as Error).stack ?? err).split('\n').slice(0, 3).join(' | '); }
    const hurt = p.hp < 9999 || hp0 !== p.hp;
    check(`${type}: 12 s de combate sin errores${type === 'fatuo' ? '' : ' y causa daño'}`, !threw && (type === 'fatuo' || hurt || g.telegraphs.length > 0 || g.projectiles.length > 0), threw || `hp=${p.hp}`);
  }
}

console.log('\n=== 5) Portador v4 · grimorio · sprint ===');
{
  let n = 0, threw = '';
  try {
    for (const disc of ['alba', 'tejedor'] as const) for (let a = 0; a <= 5; a++) for (let w = 0; w <= 5; w += 5)
      for (const dir of ['down', 'up', 'side'] as const) for (const act of Object.keys(HERO_FRAMES) as (keyof typeof HERO_FRAMES)[])
        for (let f = 0; f < HERO_FRAMES[act]; f++) { const fr = heroFrame({ disc, armor: a, weapon: w }, dir, act, f); if (fr.cv.width === 26 && fr.cv.height === 30) n++; }
  } catch (e) { threw = String(e); }
  check(`Portador v4: ${n} fotogramas (2 disciplinas × 6 armaduras × 2 armas × 3 dir.) sin errores`, !threw && n === 2 * 6 * 2 * 3 * 28, threw || String(n));
  const g = boot();
  const p = g.player!;
  check('grimorio: la página II empieza en blanco', grimoirePage(p) === 0 && !grimoireHasSecondPage(p));
  g.switchGrimoire();
  check('TAB sin magias aprendidas no cambia de página', grimoirePage(p) === 0);
  p.cds[0] = 3;
  switchGrimoirePage(p);
  check('cambiar de página guarda las recargas de la otra', grimoirePage(p) === 1 && p.cds[0] === 0);
  switchGrimoirePage(p);
  check('al volver, la recarga de la página I sigue ahí', grimoirePage(p) === 0 && p.cds[0] > 2.5);
  // sprint
  g.loadMap('lunaris', 25, 25);
  g.flags.hintMove = true;
  const x0 = p.x;
  g.keys.add('d'); step(g, 60); g.keys.delete('d');
  const walk = p.x - x0;
  const x1 = p.x; const st0 = p.sta;
  g.keys.add('d'); g.keys.add('shift'); step(g, 60); g.keys.delete('d'); g.keys.delete('shift');
  check('Shift: corre más deprisa y gasta Aguante', p.x - x1 > walk * 1.25 && p.sta < st0, `${(p.x - x1).toFixed(0)} vs ${walk.toFixed(0)}`);
}

console.log('\n=== 6) Cinemáticas y cofres ===');
{
  forceStoryBeats(true);
  const g = boot();
  g.loadMap('lunaris', 25, 20);
  step(g, 60);
  check('la escena del despertar arranca sola al empezar', cutsceneActive() && !!g.flags.cs_despertar);
  const px = g.player!.x;
  g.keys.add('d'); step(g, 30); g.keys.delete('d');
  check('durante la escena el Portador no se mueve', g.player!.x === px);
  skipCutscene(g);
  check('ESC la salta y devuelve el control', !cutsceneActive());
  g.questIdx = 5; step(g, 60);
  check('el rótulo del ACTO II aparece al llegar la historia', !!g.flags.cs_acto2);
  skipCutscene(g);
  g.questIdx = 10; g.loadMap('molino', 3, 20); step(g, 80);
  check('llegada a una sección nueva con su escena', !!g.flags.cs_molino);
  skipCutscene(g); resetCutscenes(); forceStoryBeats(false);
  const total = (['lunaris', 'bosque', 'cripta', 'costa', 'aldea', 'cumbres'] as const).reduce((a, id) => a + MAPS[id].chests.length, 0);
  check(`menos cofres sueltos en las regiones (${total}, antes 30)`, total <= 12);
}

console.log(fails === 0 ? '\nSMOKE R18: TODO OK' : `\nSMOKE R18: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
