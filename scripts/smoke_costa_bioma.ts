// ============================================================
// 18-a (biomas-costa) — Smoke determinista de la revisualización
// de la COSTA DE BRUMA (src/game/biomas_costa.ts) sin navegador:
// (1) instalación IDEMPOTENTE: 2× initCostaBioma no duplican el
//     raster (builds === 1) y el auto-install perezoso del tick
//     tampoco;
// (2) tick × 600 frames: fases temporales avanzan (t≈10 s, sin
//     NaN) y los arrays de longitud fija NO crecen (pools ≤ 14,
//     blobs 6+9, gulls 4 — cero pool de partículas dinámicas);
// (3) draw (ground + overlay) con ctx stub no lanza: día/noche/
//     atardecer, época pasado, cámaras en varias esquinas y mapa
//     NO-costa (early-out silencioso);
// (4) DETERMINISMO: dos reconstrucciones del raster estático
//     (__costaRasterTrace, ctx-grabador) → misma traza exacta
//     (mismo dataURL-lógico: cada op de dibujo serializada).
// Ejecutar: bun scripts/smoke_costa_bioma.ts
// ============================================================

// ---------- stub universal (patrón smoke_timeskip.ts, 13-c) ----------
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
(audio as unknown as { init: () => void }).init = () => {};          // sin WebAudio en bun
(audio as unknown as { ctx: unknown }).ctx = stub();
const {
  initCostaBioma, costaBiomaTick,
  drawCostaBiomaGround, drawCostaBiomaOverlay,
  __costaDebug, __costaRasterTrace, __costaReset,
} = await import('../src/game/biomas_costa');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

function newGameCosta(): InstanceType<typeof Game> {
  const g = new Game(makeCanvas());
  g.newGame('Prueba', 'alba');
  g.startPlay();
  g.loadMap('costa', 26, 3); // aterrizaje norte de la Costa de Bruma
  return g;
}

console.log('=== 1) Instalación IDEMPOTENTE (2× init + auto-install del tick) ===');
{
  initCostaBioma();
  const d1 = __costaDebug();
  initCostaBioma();
  const d2 = __costaDebug();
  if (d1.installed && d2.installed) ok('initCostaBioma instala el bioma (installed=true)');
  else bad(`installed incorrecto (${String(d1.installed)}/${String(d2.installed)})`);
  if (d1.builds === 1 && d2.builds === 1) ok('2× initCostaBioma → UNA sola construcción (builds=1)');
  else bad(`la 2ª llamada duplicó el raster (builds=${d1.builds}→${d2.builds})`);

  // segunda partida/mapa: el auto-install perezoso del tick NO re-construye
  const g2 = newGameCosta();
  costaBiomaTick(g2, 1 / 60);
  const d3 = __costaDebug();
  if (d3.builds === 1) ok('auto-install perezoso del tick: sigue en builds=1 (nada duplicado)');
  else bad(`el tick reconstruyó el raster (builds=${d3.builds})`);
  if (d2.mistCv === 3 && d2.gullCv === 2)
    ok(`sprites pre-rasterizados en install: ${d2.mistCv} bancos de bruma + ${d2.gullCv} frames de gaviota`);
  else bad(`sprites de install incompletos (mist=${d2.mistCv}, gulls=${d2.gullCv})`);
}

console.log('\n=== 2) costaBiomaTick × 600 frames: fases avanzan y arrays ACOtados ===');
{
  __costaReset(); // fases a cero (el raster instalado se conserva)
  const g = newGameCosta();
  const d0 = __costaDebug();
  let threw: string | null = null;
  try {
    for (let i = 0; i < 600; i++) costaBiomaTick(g, 1 / 60);
  } catch (e) { threw = String(e); }
  if (threw === null) ok('600 ticks sin lanzar');
  else bad(`excepción en el tick: ${threw}`);
  const d = __costaDebug();
  if (Math.abs(d.t - 10) < 0.01) ok(`fase temporal acumulada t=${d.t.toFixed(3)} s (600×1/60)`);
  else bad(`t no cuadra (${d.t})`);
  if (Number.isFinite(d.t) && Number.isFinite(d.beamA))
    ok(`sin NaN en fases (t=${d.t}, beamA=${d.beamA.toFixed(3)} rad)`);
  else bad('fases con NaN/Infinity');
  if (d.beamA >= 0 && d.beamA < Math.PI * 2 + 1e-9) ok(`ángulo del haz acotado a [0,2π): ${d.beamA.toFixed(4)}`);
  else bad(`beamA fuera de rango: ${d.beamA}`);
  if (d.pools <= 14) ok(`charcos de marea registrados: ${d.pools} (cap 14)`);
  else bad(`pools desbocados: ${d.pools}`);
  if (d.pools >= 4) ok(`la orilla de la costa genera charcos de verdad (${d.pools} cuencas)`);
  else bad(`demasiados pocos charcos (${d.pools}) — gate del bioma mal calibrado`);
  if (d.blobsFar === 6 && d.blobsNear === 9) ok(`bruma: ${d.blobsFar} blobs lejanos + ${d.blobsNear} cercanos (fijos)`);
  else bad(`bruma mal dimensionada (${d.blobsFar}/${d.blobsNear})`);
  if (d.gulls === 4) ok('gaviotas: 4 circuitos fijos');
  else bad(`gaviotas: ${d.gulls}`);
  const crecio = d.pools !== d0.pools || d.blobsFar !== d0.blobsFar ||
    d.blobsNear !== d0.blobsNear || d.gulls !== d0.gulls;
  if (!crecio) ok('600 ticks NO crecieron ningún array del bioma (todo longitud fija)');
  else bad('algún array del bioma creció con los ticks');
}

console.log('\n=== 3) draw (ground + overlay) con ctx stub: no lanza en ningún estado ===');
{
  __costaReset();
  const g = newGameCosta();
  let threw: string | null = null;
  const scenarios: string[] = [];
  try {
    // día / atardecer / noche (factor dayT del motor)
    g.dayT = 0.5; drawCostaBiomaGround(g); drawCostaBiomaOverlay(g); scenarios.push('día');
    g.dayT = 0.02; drawCostaBiomaGround(g); drawCostaBiomaOverlay(g); scenarios.push('noche');
    g.dayT = 0.52; drawCostaBiomaGround(g); drawCostaBiomaOverlay(g); scenarios.push('atardecer');
    // época pasado (muelle entero, tileAt por diffs)
    g.epoch = 'pasado';
    drawCostaBiomaGround(g); drawCostaBiomaOverlay(g);
    g.epoch = 'presente'; scenarios.push('época pasado');
    // cámaras en las 4 esquinas del mapa (52×40 → 832×640 mundo · 1664×1280 pantalla)
    for (const [cx, cy] of [[0, 0], [9999, 0], [0, 9999], [704, 740], [300, 200]]) {
      g.camX = cx; g.camY = cy;
      drawCostaBiomaGround(g); drawCostaBiomaOverlay(g);
    }
    scenarios.push('5 cámaras');
    // sin tick previo: fallback a globalT (el dibujo no depende del cableado)
    const g3 = newGameCosta();
    g3.globalT = 33.7;
    drawCostaBiomaGround(g3); drawCostaBiomaOverlay(g3); scenarios.push('fallback globalT');
  } catch (e) { threw = String(e); }
  if (threw === null) ok(`draw ground+overlay sin lanzar (${scenarios.join(' · ')})`);
  else bad(`excepción en draw: ${threw}`);

  // mapa NO-costa: early-out silencioso (y el tick no avanza fases ajenas)
  const g4 = newGameCosta();
  g4.loadMap('lunaris', 26, 35);
  let threw2: string | null = null;
  try {
    costaBiomaTick(g4, 1 / 60);
    drawCostaBiomaGround(g4);
    drawCostaBiomaOverlay(g4);
  } catch (e) { threw2 = String(e); }
  const d4 = __costaDebug();
  if (threw2 === null) ok('mapa no-costa (lunaris): tick/draw early-out sin lanzar');
  else bad(`excepción fuera de costa: ${threw2}`);
  if (d4.t === 0) ok('el tick NO acumula fase fuera de la costa (t sigue en 0)');
  else bad(`el tick corrió fuera de costa (t=${d4.t})`);

  // los draws tampoco tocan arrays del motor ni del bioma
  const before = g.particles.length + g.floats.length + g.toasts.length;
  drawCostaBiomaGround(g); drawCostaBiomaOverlay(g);
  if (g.particles.length + g.floats.length + g.toasts.length === before)
    ok('los draws no añaden partículas/floats/toasts al motor (0 allocations de pools)');
  else bad('los draws ensuciaron arrays del motor');
}

console.log('\n=== 4) DETERMINISMO: dos builds del raster estático → misma traza ===');
{
  const t1 = __costaRasterTrace();
  const t2 = __costaRasterTrace();
  let h1 = 0, h2 = 0;
  for (let i = 0; i < t1.length; i++) h1 = (h1 * 31 + t1.charCodeAt(i)) | 0;
  for (let i = 0; i < t2.length; i++) h2 = (h2 * 31 + t2.charCodeAt(i)) | 0;
  if (t1.length > 20000) ok(`traza densa: ${t1.length} ops serializadas (hash ${(h1 >>> 0).toString(16)})`);
  else bad(`traza demasiado corta (${t1.length}) — el raster no dibujó lo esperado`);
  if (t1 === t2) ok('dos builds del raster estático → traza IDÉNTICA byte a byte');
  else bad(`trazas distintas (len ${t1.length} vs ${t2.length}, hash ${(h1 >>> 0).toString(16)} vs ${(h2 >>> 0).toString(16)})`);
  // y una tercera con tick en medio: el estado temporal NO contamina el estático
  const g = newGameCosta();
  for (let i = 0; i < 60; i++) costaBiomaTick(g, 1 / 60);
  const t3 = __costaRasterTrace();
  if (t3 === t1) ok('tras 60 ticks el raster estático sigue siendo EXACTAMENTE el mismo');
  else bad('el tick contaminó el raster estático');
}

console.log(fails === 0 ? '\nSMOKE COSTA BIOMA: TODO OK' : `\nSMOKE COSTA BIOMA: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
