// ============================================================
// 13-b (mundo-vivo) — Smoke del módulo worldlife sin navegador
// Stub DOM/Audio (patrón de scripts/smoke_desafio.ts, 12-a) + Game real:
// (1) worldTick 600 frames en 3 mapas × 2 épocas con y sin enemigos,
// (2) cap de fauna (≤12; ≤8 en presente) y spawn solo en cámara,
// (3) rumores: cooldown por NPC y cambio de texto con questIdx simulado,
// (4) worldInteract: false sin feature cercana, true con prop/tile.
// (5) eventos: posponer con combate/diálogo/desafío + viajante forzado.
// Ejecutar: bun scripts/smoke_worldlife.ts
// ============================================================

// ---------- stub universal (igual que smoke_desafio.ts) ----------
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

const { worldTick, worldInteract, drawWorldLife, worldlifeStats, __wlArmEvent, __wlRumorPool, __wlResetAll } =
  await import('../src/game/worldlife');
const { tileAt } = await import('../src/game/maps');
const { startChallenge } = await import('../src/game/challenge');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

type G = InstanceType<typeof Game>;

__wlResetAll();

function newGame(): G {
  const g = new Game(makeCanvas());
  g.newGame('Smoke', 'alba');
  return g;
}

function campaignGame(map: 'lunaris' | 'costa' | 'cumbres' | 'aldea' | 'cripta', tx: number, ty: number): G {
  __wlResetAll(); // el pool es de módulo (1 Game por página en producción): limpiar entre tests
  const g = newGame();
  g.setState('play');
  g.loadMap(map, tx, ty);
  return g;
}

/** Enemigo pegado al Portador con aggro sostenido (el leash de update.ts
 *  des-aggroa a los del mapa si están lejos de casa). Lo devuelve para
 *  hacer splice después. */
function pushNearAggro(g: G): number {
  const p = g.player!;
  const e = g.makeEnemy('lobo', p.x + 22, p.y, 0, 'test');
  e.aggro = true;
  g.enemies.push(e);
  return g.enemies.length - 1;
}

function tick(g: G, secs: number) {
  const frames = Math.round(secs * 60);
  for (let i = 0; i < frames; i++) g.update(1 / 60);
}

console.log('=== 1) worldTick: 600 frames × 3 mapas × 2 épocas × con/sin enemigos (sin lanzar) ===');
{
  const MAPS3: ('lunaris' | 'costa' | 'cumbres')[] = ['lunaris', 'costa', 'cumbres'];
  const EP: ('presente' | 'pasado')[] = ['presente', 'pasado'];
  let ran = 0;
  let threw = false;
  try {
    for (const m of MAPS3) {
      for (const ep of EP) {
        for (const withEnemies of [true, false]) {
          const g = campaignGame(m, 26, 20);
          g.epoch = ep;
          if (!withEnemies) g.enemies = [];
          tick(g, 10); // 600 frames
          drawWorldLife(g); // el dibujo (ctx stub) no debe lanzar tampoco
          ran++;
          const st = worldlifeStats(g);
          if (st && st.count > 12) { bad(`fauna por encima del cap en ${m}/${ep}`); ran = -1; }
        }
      }
    }
  } catch (e) {
    threw = true;
    bad('worldTick lanzó: ' + String(e));
  }
  if (!threw && ran === 12) ok('12 configuraciones × 600 frames sin excepciones (con drawWorldLife)');
}

console.log('\n=== 2) fauna: cap por época y spawn solo en cámara ===');
{
  // pasado: cap 12 — tras 30 s la población se satura
  const g = campaignGame('lunaris', 25, 20);
  g.epoch = 'pasado';
  tick(g, 30);
  const st = worldlifeStats(g);
  if (st && st.count <= 12) ok(`cap respetado en pasado: ${st.count}/12 vivas`);
  else bad(`cap pasado violado: ${st?.count}`);
  if (st && st.count >= 4) ok(`la fauna vive: ${st.count} criaturas (aves ${st.aves}, mariposas ${st.mariposas}, luciérnagas ${st.luciernagas}, peces ${st.peces})`);
  else bad(`fauna apenas aparece: ${st?.count}`);
  // spawn solo en cámara: todas las criaturas dentro de la vista ±64 px de mundo
  const b0 = g.camX / 2 - 64, b1 = (g.camX + 960) / 2 + 64;
  const c0 = g.camY / 2 - 64, c1 = (g.camY + 540) / 2 + 64;
  const fuera = st ? st.critters.filter(c => c.x < b0 || c.x > b1 || c.y < c0 || c.y > c1) : [];
  if (st && fuera.length === 0) ok(`spawn solo en cámara: ${st.critters.length} dentro de la vista (±64)`);
  else bad(`criaturas fuera de cámara: ${fuera.length}`);
  // presente: cap 8
  const g2 = campaignGame('lunaris', 25, 20);
  tick(g2, 30);
  const st2 = worldlifeStats(g2);
  if (st2 && st2.count <= 8) ok(`cap respetado en presente: ${st2.count}/8 (menos vida que en el pasado)`);
  else bad(`cap presente violado: ${st2?.count}`);
  // día/noche: mariposas de día, luciérnagas de noche
  const g3 = campaignGame('lunaris', 25, 20);
  g3.epoch = 'pasado';
  g3.dayT = 0.3; // día
  tick(g3, 12);
  const s3 = worldlifeStats(g3);
  if (s3 && s3.mariposas > 0 && s3.luciernagas === 0) ok('de día: mariposas sí, luciérnagas no');
  else bad(`día: mariposas=${s3?.mariposas} luciérnagas=${s3?.luciernagas}`);
  g3.dayT = 0.85; // noche (isNight: >0.7)
  tick(g3, 22); // las mariposas diurnas expiran (vida ≤16 s + margen)
  const s4 = worldlifeStats(g3);
  if (s4 && s4.luciernagas > 0 && s4.mariposas === 0) ok('de noche: luciérnagas sí, mariposas no');
  else bad(`noche: mariposas=${s4?.mariposas} luciérnagas=${s4?.luciernagas}`);
  // peces en la Costa (jugador en la playa, mar visible)
  const g4 = campaignGame('costa', 25, 33);
  g4.epoch = 'pasado';
  g4.updateCamera(true);
  tick(g4, 20);
  const s5 = worldlifeStats(g4);
  if (s5 && s5.peces > 0) ok(`Costa: peces salpicando (${s5.peces})`);
  else bad(`Costa sin peces: ${s5?.peces} (¿mar visible en cámara?)`);
  // cripta: fuera del tiempo, sin fauna
  const g5 = campaignGame('cripta', 19, 23);
  tick(g5, 10);
  const s6 = worldlifeStats(g5);
  if (s6 && s6.count === 0) ok('cripta: sin fauna (existe fuera del tiempo)');
  else bad(`cripta con fauna: ${s6?.count}`);
}

console.log('\n=== 3) rumores: cooldown por NPC y texto según progreso REAL ===');
{
  const g = campaignGame('lunaris', 23, 13);
  g.player!.x = 23 * 16 + 8; // encima de Brisa
  g.player!.y = 13 * 16 + 8;
  if (g.npcs.some(n => n.nid === 'brisa')) ok('Brisa presente en lunaris');
  else { bad('Brisa no spawneó'); }
  // primera burbuja en 2.5-5.5 s
  let first = '';
  let frames = 0;
  while (frames < 60 * 14) {
    g.update(1 / 60); frames++;
    const st = worldlifeStats(g);
    if (st && st.rumorsShown >= 1) { first = st.lastRumor; break; }
  }
  if (first.startsWith('Brisa:')) ok(`rumor disparado junto al NPC (${(frames / 60).toFixed(1)} s): «${first.slice(0, 46)}...»`);
  else bad(`ningún rumor en 14 s junto a Brisa (frames=${frames})`);
  // cooldown: en los 5 s siguientes NO hay segunda burbuja (mínimo 8 s)
  const shown0 = worldlifeStats(g)!.rumorsShown;
  tick(g, 5);
  const shown1 = worldlifeStats(g)!.rumorsShown;
  if (shown1 === shown0) ok('cooldown respetado: nada en los 5 s posteriores (mínimo 8 s)');
  else bad(`cooldown violado: ${shown0}→${shown1} en 5 s`);
  // y en ≤ 16 s vuelve a salir (ventana 8-14 s)
  let frames2 = 0;
  while (frames2 < 60 * 16) {
    g.update(1 / 60); frames2++;
    if (worldlifeStats(g)!.rumorsShown > shown1) break;
  }
  if (worldlifeStats(g)!.rumorsShown > shown1) ok(`segunda burbuja a los ${(frames2 / 60).toFixed(1)} s del reinicio (ventana 8-14 s)`);
  else bad('segunda burbuja no llegó en 16 s');
  // cambio de texto con questIdx simulado (progreso REAL)
  const poolQ0 = __wlRumorPool(g, 'brisa');
  const firstRumor = first; // texto de la PRIMERA burbuja (fase inicial q0)
  g.questIdx = 9;
  const poolQ9 = __wlRumorPool(g, 'brisa');
  if (poolQ0[0] !== poolQ9[0]) ok('pool de Brisa cambia con questIdx 0 → 9 (progreso real)');
  else bad('el pool de Brisa no cambió con el progreso');
  let frames3 = 0;
  while (frames3 < 60 * 16) {
    g.update(1 / 60); frames3++;
    if (worldlifeStats(g)!.rumorsShown > shown1 + 1) break;
  }
  const late = worldlifeStats(g)!.lastRumor;
  if (late !== firstRumor) ok(`texto de rumor cambia con la misión: «${firstRumor.slice(0, 30)}...» → «${late.slice(0, 30)}...»`);
  else bad('el rumor disparado no cambió con questIdx');
  // tono dominante (dominantTone de hooks)
  g.questIdx = 0;
  g.player!.tones = { empatico: 0, pragmatico: 0, sarcastico: 5, amenazante: 0 };
  const teoSarc = __wlRumorPool(g, 'teo').some(s => s.includes('Hablas raro'));
  if (teoSarc) ok('tono dominante sarcástico presente en el pool de Teo');
  else bad('el tono dominante no afecta a los rumores');
  // genéricas por contexto (≥2) y cobertura de NPCs
  const gen = __wlRumorPool(g, 'npc_inexistente');
  if (gen.length >= 2) ok(`frases genéricas por contexto: ${gen.length}`);
  else bad('faltan frases genéricas');
  const cubiertos = ['brisa', 'toln', 'teo', 'heraldo', 'ilwen', 'doran', 'mara', 'vult', 'mera', 'ivo']
    .filter(nid => __wlRumorPool(g, nid).length > 0);
  if (cubiertos.length === 10) ok(`10 NPCs con rumores (${cubiertos.join(', ')})`);
  else bad(`NPCs cubiertos: ${cubiertos.length}/10`);
  // sin rumores en combate (enemigo pegado con aggro sostenido)
  const shownC = worldlifeStats(g)!.rumorsShown;
  const idxE = pushNearAggro(g);
  tick(g, 3);
  if (worldlifeStats(g)!.rumorsShown === shownC) ok('sin rumores durante combate con aggro');
  else bad('los rumores no se silencian en combate');
  g.enemies.splice(idxE, 1);
}

console.log('\n=== 4) worldInteract: features que nearestInteract ignora ===');
{
  // pozo de Lunaris (tile 'w' en 20,16) — presente vs pasado
  const g = campaignGame('lunaris', 21, 16);
  g.player!.x = 21 * 16 + 8;
  g.player!.y = 16 * 16 + 8;
  const pre = g.floats.length;
  if (worldInteract(g) && g.floats.length > pre) ok('pozo de Lunaris: worldInteract true + frase en float');
  else bad('el pozo no respondió a worldInteract');
  const tNow = g.floats[g.floats.length - 1]?.text ?? '';
  g.epoch = 'pasado';
  worldInteract(g);
  const tPast = g.floats[g.floats.length - 1]?.text ?? '';
  if (tNow !== tPast && tNow.length > 0 && tPast.length > 0) ok('el texto del pozo varía presente/pasado');
  else bad(`textos del pozo idénticos o vacíos: '${tNow}' vs '${tPast}'`);
  // agua: estanque de Lunaris (38,26 es '~'; el jugador en 37,26)
  const g2 = campaignGame('lunaris', 37, 26);
  if (tileAt(g2.map, g2.rows, 38, 26, 'presente') === '~') {
    g2.player!.x = 37 * 16 + 8; g2.player!.y = 26 * 16 + 8;
    const parts0 = g2.particles.length;
    if (worldInteract(g2)) ok(`agua: splash + frase (${g2.particles.length - parts0} partículas nuevas)`);
    else bad('el agua no respondió a worldInteract');
  } else bad('fixture rota: (38,26) de lunaris no es agua');
  // false en zona sin features (3×3 sin w/g/R/~ y sin props atendibles)
  const g3 = campaignGame('lunaris', 25, 17);
  const clean = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ch = tileAt(g3.map, g3.rows, x + dx, y + dy, 'presente');
      if (ch === 'w' || ch === 'g' || ch === 'R' || ch === '~') return false;
    }
    return true;
  };
  let fx = -1, fy = -1;
  for (let y = 14; y <= 20 && fx < 0; y++) for (let x = 22; x <= 30; x++) {
    if (clean(x, y)) { fx = x; fy = y; break; }
  }
  if (fx >= 0) {
    g3.player!.x = fx * 16 + 8; g3.player!.y = fy * 16 + 8;
    const floats0 = g3.floats.length;
    const consumed = worldInteract(g3);
    if (!consumed && g3.floats.length === floats0) ok(`zona libre (${fx},${fy}): worldInteract false y sin efectos`);
    else bad(`worldInteract consumió en zona libre (${fx},${fy})`);
  } else bad('fixture: no se encontró tile libre en la plaza');
  // faro de la Costa (prop 'faro' en 6,18 — nearestInteract lo ignora)
  const g4 = campaignGame('costa', 7, 17);
  g4.player!.x = 6 * 16 + 8 + 14;
  g4.player!.y = 17 * 16 + 8;
  if (worldInteract(g4)) ok('faro de la Costa: worldInteract true (prop no atendido por el motor)');
  else bad('el faro no respondió a worldInteract');
  // farol YA encendido de la Aldea (lamp1, needPast) — chispazo
  const g5 = campaignGame('aldea', 13, 13);
  g5.epoch = 'pasado';
  g5.player!.x = 13 * 16 + 8 + 14;
  g5.player!.y = 13 * 16 + 8;
  if (!g5.flags.lamp1 && !worldInteract(g5)) ok('farol SIN encender no lo roba worldInteract (lo gestiona el motor)');
  else bad('worldInteract robó un farol sin encender');
  g5.flags.lamp1 = true;
  const parts1 = g5.particles.length;
  if (worldInteract(g5) && g5.particles.length > parts1) ok('farol encendido: chispazo (burst) + frase');
  else bad('el farol encendido no chispó');
}

console.log('\n=== 5) eventos callejeros: cadencia, aplazamiento y viajante ===');
{
  const g = campaignGame('lunaris', 25, 20);
  // combate activo → pospuesto (enemigo pegado: el leash no lo suelta)
  const idxE = pushNearAggro(g);
  __wlArmEvent(g, 0.05);
  tick(g, 1);
  let ev = worldlifeStats(g)!.eventCount;
  if (ev === 0) ok('evento pospuesto con enemigo en aggro');
  else bad(`evento disparó en combate (${ev})`);
  g.enemies.splice(idxE, 1); // fin del combate
  // diálogo abierto → pospuesto
  __wlArmEvent(g, 0.05);
  g.setState('dialogue');
  tick(g, 1);
  ev = worldlifeStats(g)!.eventCount;
  if (ev === 0) ok('evento pospuesto con diálogo abierto');
  else bad(`evento disparó en diálogo (${ev})`);
  // liberar el diálogo: el timer armado dispara en cuanto vuelve play
  __wlArmEvent(g, 0.05);
  g.setState('play');
  tick(g, 1);
  const evPrev = ev;
  ev = worldlifeStats(g)!.eventCount;
  if (ev === evPrev + 1) ok('evento disparado al volver a play (el aplazamiento no lo pierde)');
  else bad(`evento no disparó al liberar (${ev} vs ${evPrev})`);
  // eco lejano: float + partículas direccionales
  __wlArmEvent(g, 0.05, 'eco');
  tick(g, 1);
  ev = worldlifeStats(g)!.eventCount;
  const ecoFloat = g.floats.some(f => f.text.includes('eco lejano'));
  const parts = g.particles.length;
  if (ev === evPrev + 2 && ecoFloat && parts > 0) ok(`eco lejano: float + ${parts} partículas vivas`);
  else bad(`eco lejano incompleto: ev=${ev} float=${ecoFloat} parts=${parts}`);
  // viajante forzado: entidad decorativa activa
  __wlArmEvent(g, 0.05, 'viajero');
  tick(g, 1);
  const st = worldlifeStats(g)!;
  if (st.eventCount === evPrev + 3 && st.viajero) ok('viajante errante activo (entidad decorativa propia)');
  else bad(`viajante: ev=${st.eventCount} activo=${st.viajero}`);
  tick(g, 20); // cruza la pantalla y se va
  if (!worldlifeStats(g)!.viajero) ok('el viajante se marcha solo al salir de cámara');
  else bad('el viajante sigue activo tras 20 s');
  // modo desafío: sin eventos (reto REAL de challenge.ts, aborto por loadMap)
  const g2 = campaignGame('lunaris', 25, 20);
  startChallenge(g2, 'oleadas');
  __wlArmEvent(g2, 0.05);
  tick(g2, 1); // cuenta atrás del reto: challengeRun activo
  if (worldlifeStats(g2)!.eventCount === 0 && g2.challengeRun) ok('sin eventos en modo desafío');
  else bad(`eventos activos en desafío (ev=${worldlifeStats(g2)!.eventCount}, run=${String(g2.challengeRun)})`);
  g2.loadMap('lunaris', 25, 19); // aborto del reto (igual que smoke_desafio)
  tick(g2, 0.05);
  __wlArmEvent(g2, 0.05);
  tick(g2, 1);
  if (worldlifeStats(g2)!.eventCount === 1) ok('cadencia restablecida tras abortar el desafío');
  else bad(`el evento no disparó tras liberar el desafío (ev=${worldlifeStats(g2)!.eventCount})`);
}

console.log('\n' + (fails === 0 ? '=== SMOKE WORLDLIFE: TODO OK ===' : `=== SMOKE WORLDLIFE: ${fails} FALLOS ===`));
process.exit(fails === 0 ? 0 : 1);
