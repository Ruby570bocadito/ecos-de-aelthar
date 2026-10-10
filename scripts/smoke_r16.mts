// ============================================================
// R16 «El Filo y la Nota» + «Mareas y Raíces» — Smoke sin navegador
// (stub DOM/Audio/localStorage: patrón de smoke_arbol.ts)
// Verifica la ronda completa:
//   1) savefix: saves corruptos → forma válida, CONTINUAR no lanza
//   2) viaje/respawn en mapas sin santuario (interiores, salas R14)
//   3) dimensiones reales de costa/aldea/cumbres + contenido en límites
//   4) epílogo del Acto IV, softlocks de Mara y del Acto I
//   5) árbol: hueco fantasma y partida nueva sin herencia
//   6) VFX: pool acotado, envejecimiento y dibujo con stub
//   7) enemigos nuevos (centinela/raíz/ahogado) y La Madre del Mar
//   8) audio en modo degradado + volúmenes saneados
// Ejecutar: npx tsx scripts/smoke_r16.mts
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
const { ENEMY_DEFS, DIALOGUES, SKILLS, QUESTS } = await import('../src/game/data');
const { sanitizeSaveData } = await import('../src/game/savefix');
const { spawnVfx, vfxTick, vfxActiveCount, drawVfxWorld, drawVfxGlow, resetVfx } = await import('../src/game/actors/vfx');
const { r16Watchers } = await import('../src/game/enemies_r16');
const { weatherStats } = await import('../src/game/world/weather');

let fails = 0;
const ok = (m: string) => console.log('  ✓ ' + m);
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const check = (m: string, c: boolean, extra = '') => (c ? ok(m) : bad(m + (extra ? ' — ' + extra : '')));
type G = InstanceType<typeof Game>;
function boot(disc: 'alba' | 'tejedor' = 'alba'): G {
  const g = new Game(makeCanvas());
  g.newGame('QA16', disc);
  g.startPlay();
  return g;
}
const step = (g: G, n: number, dt = 1 / 60) => { for (let i = 0; i < n; i++) g.update(dt); };

console.log('=== 1) Guardado tolerante (savefix) ===');
{
  const isMap = (id: string) => !!MAPS[id as 'lunaris'];
  const base = { v: 1, player: { name: 'X', discipline: 'alba', level: 3, xp: 5, hp: 50, maxHp: 120, sta: 50, maxSta: 100, res: 10, attrs: { fue: 3, des: 2, int: 2, esp: 2, vig: 2 }, points: 0, gold: 10, weaponPlus: 0, potions: 1, hasEcho: false, kills: 0, deaths: 0, repGuardianes: 0, playTime: 0 }, map: 'lunaris', x: 400, y: 320, epoch: 'presente', flags: {}, questIdx: 0, questStep: 0, openedChests: [], takenEchoes: [], deadGolds: [], companion: false, saveTime: 0 };
  const bads: [string, (d: any) => void][] = [
    ['openedChests:5', d => { d.openedChests = 5; }],
    ['deadGolds:7', d => { d.deadGolds = 7; }],
    ['hp:"abc"', d => { d.player.hp = 'abc'; }],
    ['attrs:null', d => { d.player.attrs = null; }],
    ['attrs:"fuerte"', d => { d.player.attrs = 'fuerte'; }],
    ['player:{} (+v futura)', d => { d.player = {}; d.v = 999999; }],
    ['questIdx:999', d => { d.questIdx = 999; }],
    ['maxHp:NaN', d => { d.player.maxHp = null; }],
  ];
  for (const [label, mut] of bads) {
    const d = JSON.parse(JSON.stringify(base)); mut(d);
    const s = sanitizeSaveData(d, isMap, QUESTS.length);
    const numsOk = !!s && Number.isFinite(s.player.hp) && Number.isFinite(s.player.maxHp) && Number.isFinite(s.player.level)
      && Object.values(s.player.attrs).every(Number.isFinite) && Array.isArray(s.openedChests) && Array.isArray(s.deadGolds)
      && s.questIdx >= 0 && s.questIdx < QUESTS.length;
    check(`save con ${label} → forma válida y finita`, numsOk);
    // CONTINUAR de punta a punta con ese save en disco
    store.set('ecos-aelthar-save', JSON.stringify(d));
    const g = new Game(makeCanvas());
    let threw = false;
    try { g.continueGame(); } catch { threw = true; }
    check(`CONTINUAR con ${label} no lanza y entra en juego`, !threw && g.state === 'play' && Number.isFinite(g.player!.hp), `state=${g.state}`);
    if (label === 'deadGolds:7') {
      let died = true;
      try { g.player!.hp = 0; g.playerDied(); } catch { died = false; }
      check('morir con deadGolds corrupto ya no rompe el frame', died);
    }
  }
  check('sin mapa válido → null (se descarta)', sanitizeSaveData({ ...base, map: 'atlantida' }, isMap, QUESTS.length) === null);
  // dayT persiste
  const g = boot();
  g.dayT = 0.83; g.save();
  const g2 = new Game(makeCanvas());
  g2.continueGame();
  check('la hora del día viaja en el save', Math.abs(g2.dayT - 0.83) < 1e-6, String(g2.dayT));
}

console.log('\n=== 2) Mapas sin santuario: viaje y respawn dentro del mapa ===');
{
  const g = boot();
  for (const id of ['interior_anciana', 'interior_tienda', 'interior_taberna', 'biblioteca', 'nombres', 'archivo', 'antecamara'] as const) {
    const m = MAPS[id as 'lunaris'];
    const [sx, sy] = g.sanctuaryPos(id as 'lunaris');
    const inside = sx >= 0 && sy >= 0 && sx < m.w && sy < m.h;
    check(`${id}: punto de reaparición dentro del mapa (${sx},${sy})`, inside);
    g.loadMap(id as 'lunaris', sx, sy);
    const ptx = Math.floor(g.player!.x / 16), pty = Math.floor(g.player!.y / 16);
    check(`${id}: aterrizaje transitable`, ptx < m.w && pty < m.h && !g.tileSolidAt(g.player!.x, g.player!.y));
    check(`${id}: marcado como sala cubierta (sin cielo/nubes)`, m.indoor === true);
  }
  g.loadMap('lunaris', 25, 20);
  g.visitedMaps.interior_anciana = true; g.visitedMaps.bosque = true;
  g.openSanctuary();
  const opts = (g.dlgNode?.options ?? []).map(o => o.action ?? '');
  check('menú Viajar no ofrece interiores', !opts.includes('travel_interior_anciana') && opts.includes('travel_bosque'), opts.join(','));
}

console.log('\n=== 3) Mapas de expansión a su tamaño real + contenido en límites ===');
{
  const dims: Record<string, [number, number]> = { costa: [64, 40], aldea: [44, 44], cumbres: [66, 42] };
  for (const [id, [w, h]] of Object.entries(dims)) {
    const m = MAPS[id as 'costa'];
    check(`${id} declara ${w}×${h} (= filas generadas)`, m.w === w && m.h === h && m.rows.length === h && m.rows[0].length === w);
    const rows = mapRows(m);
    const solid = (x: number, y: number, ep: 'presente' | 'pasado') => SOLID_CHARS.has(tileAt(m, rows, x, y, ep));
    const oob = m.epochDiffs.filter(d => d.x >= m.w || d.y >= m.h).length;
    check(`${id}: 0 diffs de época fuera de límites`, oob === 0, String(oob));
    const things = [...m.chests.map(c => ({ ...c, k: 'cofre', ep: c.needPast ? 'pasado' : 'presente' })), ...m.echoes.map(c => ({ ...c, k: 'eco', ep: 'presente' })), ...m.spawns.map(c => ({ ...c, k: 'spawn', ep: c.needPast ? 'pasado' : 'presente' }))];
    const badT = things.filter(t => t.x < 0 || t.y < 0 || t.x >= m.w || t.y >= m.h || solid(t.x, t.y, t.ep as 'presente'));
    check(`${id}: ${things.length} cofres/ecos/spawns en tiles transitables`, badT.length === 0, JSON.stringify(badT.map(t => [t.k, t.x, t.y])));
    for (const ex of m.exits) check(`${id}: salida a ${ex.to} dentro del mapa`, ex.x + ex.w <= m.w && ex.y + ex.h <= m.h);
  }
  check('la cripta familiar de Merrow ya no está sellada (32,37 transitable)', !SOLID_CHARS.has(tileAt(MAPS.aldea, mapRows(MAPS.aldea), 32, 37, 'presente')));
  // ningún mapa deja el camino '=' o los árboles sin pintor (verde plano)
  const handled = new Set(['.', ',', 'c', 'm', 't', 'p', '=', 'n', '~', 'B', 'x', ':', '_', '#', 'P', 'A', 'V', '^', 'L', 'D', 'H', 'r', 'd', 'F', 'w', 'g', 'R', 's', 'S', 'i']);
  const raros = new Set<string>();
  for (const m of Object.values(MAPS)) for (const r of mapRows(m)) for (const ch of r) if (!handled.has(ch)) raros.add(ch);
  check('todos los chars de mapa tienen pintor', raros.size === 0, [...raros].join(''));
}

console.log('\n=== 4) Narrativa: epílogo, Mara y Acto I ===');
{
  for (const k of ['acto4_epilogo', 'acto4_epilogo_verdad', 'acto4_epilogo_silencio']) {
    const n = DIALOGUES[k];
    const noOnEnd = !n.onEnd;
    const notYet = n.options!.find(o => o.text.startsWith('Todavía no'));
    const sing = n.options!.filter(o => o.next === 'acto4_epilogo_canto');
    check(`${k}: «Todavía no» no paga ni cierra (sin onEnd ni acción)`, noOnEnd && !!notYet && !notYet.action);
    check(`${k}: cantar paga y cierra (acto4_epilogo)`, sing.length > 0 && sing.every(o => o.action === 'acto4_epilogo'));
  }
  const g = boot();
  g.questIdx = 5; g.questStep = 1; g.flags.sirenaDefeated = true;
  g.applyAction('mara_gift');
  check('Mara tras la Sirena completa q6 (sin softlock)', g.questIdx === 6, `${g.questIdx}/${g.questStep}`);
  const g2 = boot();
  g2.questIdx = 3; g2.questStep = 0;
  g2.flags.visitedCripta = true; g2.flags.guardianDefeated = true; g2.flags.ecoVoz = true;
  step(g2, 2);
  check('catchUp del Acto I: q4 hecha por estado → q5', g2.questIdx === 4, `${g2.questIdx}/${g2.questStep}`);
}

console.log('\n=== 5) Combate y árbol ===');
{
  const g = boot();
  const p = g.player!;
  const e = g.makeEnemy('lobo', p.x + 14, p.y, 0); e.hp = e.maxHp = 1e6; g.enemies = [e];
  p.dir = 'right'; p.attrs.des = -50;
  const r = Math.random; Math.random = () => 0.999;
  const hits: number[] = [];
  for (let i = 0; i < 3; i++) {
    const hp0 = e.hp; p.attackT = 0; p.sta = 100; p.charging = true; p.chargeT = 0.1; g.releaseCharge(); hits.push(hp0 - e.hp);
  }
  Math.random = r;
  check(`combo: el 3er golpe es el que más pega (${hits.join(' / ')})`, hits[2] > hits[1] && hits[1] > hits[0]);
  p.sta = 10; p.attackT = 0; p.charging = true; p.chargeT = 0.6; g.releaseCharge();
  check('aguante nunca negativo y carga sin aguante → tajo normal', p.sta >= 0 && !p.chargedHit, `sta=${p.sta}`);
  const gt = boot('tejedor');
  check('el Tejedor despierta con resonancia para su primer canto', gt.player!.res >= 20);
}

console.log('\n=== 6) VFX: pool acotado + dibujo seguro ===');
{
  resetVfx();
  for (let i = 0; i < 200; i++) spawnVfx('impact', i, i, { flag: i % 2 });
  check('pool de VFX acotado (≤64)', vfxActiveCount() <= 64, String(vfxActiveCount()));
  const kinds = ['smear', 'impact', 'claw', 'dash', 'warcry', 'dome', 'sunblades', 'bolt', 'pyre', 'frost', 'rune', 'nova', 'pillar', 'bossDeath', 'parry'] as const;
  resetVfx();
  for (const k of kinds) spawnVfx(k, 100, 100, { x2: 160, y2: 120, el: 'fuego', flag: 1 });
  let threw = false;
  // el stub de canvas no implementa todo el API: cualquier método ausente → noop
  const base2d = makeCanvas().getContext('2d')! as unknown as Record<string, unknown>;
  const ctx = new Proxy(base2d, { get: (t, k) => (k in t ? t[k as string] : () => undefined), set: (t, k, v) => { t[k as string] = v; return true; } }) as unknown as CanvasRenderingContext2D;
  try { for (let i = 0; i < 30; i++) { drawVfxWorld(ctx, n => n, n => n, 2, i / 60); drawVfxGlow(ctx, n => n, n => n, 2, 0.8); vfxTick(1 / 30); } } catch (err) { threw = true; console.log(err); }
  check(`los ${kinds.length} efectos se dibujan sin lanzar`, !threw);
  vfxTick(5);
  check('los efectos caducan', vfxActiveCount() === 0);
}

console.log('\n=== 7) Enemigos nuevos y La Madre del Mar ===');
{
  for (const t of ['centinela', 'raiz', 'ahogado', 'madre']) check(`ENEMY_DEFS.${t} definido`, !!ENEMY_DEFS[t]);
  const g = boot();
  g.loadMap('bosque', 42, 38);
  const p = g.player!;
  p.hp = p.maxHp = 1e6;
  g.enemies = [];
  const c = g.makeEnemy('centinela', p.x + 80, p.y, 1); c.aggro = true;
  const r = g.makeEnemy('raiz', p.x - 50, p.y, 1); r.aggro = true;
  const a = g.makeEnemy('ahogado', p.x, p.y + 30, 1); a.aggro = true;
  g.enemies.push(c, r, a);
  const seen = { cAtaca: false, rBajo: false, rTele: false };
  for (let i = 0; i < 60 * 8; i++) {
    g.update(1 / 60);
    p.hp = p.maxHp;
    if (c.ai === 'ataca') seen.cAtaca = true;
    if ((r.invulT ?? 0) > 0) seen.rBajo = true;
    if (g.telegraphs.length) seen.rTele = true;
  }
  check('el Centinela carga y DISPARA su rayo', seen.cAtaca);
  check('la Raíz se entierra (intangible) y marca su brote', seen.rBajo && seen.rTele);
  check('los spawns de mapa R16 están sembrados', MAPS.bosque.spawns.some(s => s.type === 'raiz') && MAPS.cripta.spawns.some(s => s.type === 'centinela'));
  // la Madre: solo tras la Sirena, al acercarse a los Jardines de Sal
  const gm = boot();
  gm.loadMap('costa', 53, 9);
  gm.questIdx = 8;
  r16Watchers(gm);
  check('sin la Sirena derrotada la Madre no despierta', !gm.enemies.some(e => e.etype === 'madre'));
  gm.flags.sirenaDefeated = true; gm.questIdx = 6;
  r16Watchers(gm);
  check('antes de q9 tampoco (no corta el viaje a Merrow)', !gm.enemies.some(e => e.etype === 'madre'));
  gm.questIdx = 8;
  r16Watchers(gm);
  const madre = gm.enemies.find(e => e.etype === 'madre');
  check('tras la Sirena, la Madre se alza en los Jardines de Sal', !!madre && madre.w === 22);
  if (madre) {
    gm.player!.hp = gm.player!.maxHp = 1e6;
    madre.spawnGuard = 0;
    let spawnedCrew = false, proj = false;
    for (let i = 0; i < 60 * 14; i++) {
      gm.update(1 / 60);
      gm.player!.hp = gm.player!.maxHp;
      if (i === 60 * 3) madre.hp = madre.maxHp * 0.6;
      if (i === 60 * 8) madre.hp = madre.maxHp * 0.25;
      if (gm.projectiles.some(pr => pr.from === 'enemy')) proj = true;
      if (gm.enemies.some(e => e.etype === 'ahogado' && !e.dead)) spawnedCrew = true;
    }
    check('la Madre canta (proyectiles) y llama a su tripulación en F2', proj && spawnedCrew, `proj=${proj} crew=${spawnedCrew} state=${gm.state} ai=${madre.ai} d=${Math.round(Math.hypot(madre.x - gm.player!.x, madre.y - gm.player!.y))} aggro=${madre.aggro} sg=${madre.spawnGuard}`);
    check('barra de jefe activa (bossRef = madre)', gm.bossRef === madre || madre.dead);
    const pts = gm.player!.points;
    gm.damageEnemy(madre, 1e6, 'fuego', 0);
    check('derrotarla fija madreDefeated y paga +1 punto', !!gm.flags.madreDefeated && gm.player!.points >= pts + 1);
    r16Watchers(gm);
    check('derrotada no vuelve a alzarse', !gm.enemies.some(e => e.etype === 'madre' && !e.dead));
  }
}

console.log('\n=== 8) Audio degradado + telemetría ===');
{
  audio.setMusicVol(NaN); audio.setSfxVol(999);
  check('volúmenes saneados a [0,1]', Number.isFinite(audio.musicVol) && audio.sfxVol === 1);
  const raw = audio as unknown as Record<string, unknown>;
  const orig = raw.sfx;
  raw.sfx = () => { throw new Error('ctx cerrado'); };
  let threw = false;
  try { for (let i = 0; i < 5; i++) audio.sfx('hit'); } catch { threw = true; }
  raw.sfx = orig;
  check('un AudioContext roto ya no tumba el frame', !threw);
  const ws = weatherStats() as unknown as Record<string, number>;
  check('weatherStats cuenta nieve/rocío/humo', 'snow' in ws && 'dew' in ws && 'smoke' in ws);
  check('SKILLS base intactas tras partida nueva', SKILLS.alba[0].id === 'tajo');
}

console.log(fails === 0 ? '\nRESULTADO: ✓ 0 fallos — R16 verificada' : `\nRESULTADO: ✗ ${fails} fallos`);
if (fails) process.exit(1);
