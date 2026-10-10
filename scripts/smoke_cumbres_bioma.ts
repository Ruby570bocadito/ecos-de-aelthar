// ============================================================
// 18-b (biomas-cumbres) — Smoke del BIOMA «CUMBRES HELADAS» sin navegador
// Stub DOM/Audio (patrón de las primeras 60 líneas de scripts/smoke_timeskip.ts)
// + Game real. Verifica:
//   (1) initCumbresBioma idempotente (2 llamadas, sin estado duplicado),
//   (2) tick+draw sobre 'cumbres' (50×42) sin excepciones con ctx stub,
//   (3) 600 frames acotados: huellas ≤ 20 · aliento ≤ 10 · chispas ≤ 8,
//       huellas aparecen al andar sobre 'S' y decaen con TTL corto,
//   (4) draw determinista: dos draws con el mismo (globalT, dayT, cámara)
//       producen EXACTAMENTE la misma secuencia de ops; aurora solo de noche
//       y composite restaurado al final,
//   (5) raster ×2 determinista: reconstruido (cumbres→lunaris→cumbres) →
//       mismo dataURL (hash FNV del log de ops del canvas),
//   (6) fuera de 'cumbres': tick/draw no-op limpio.
// Ejecutar: bun scripts/smoke_cumbres_bioma.ts > scripts/_smoke_cumbres.txt
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

/** FNV-1a (32 bit) sobre un string → hash hex estable. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const num = (v: unknown): string => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v));

/** ctx stub que REGISTRA las ops de dibujo → toDataURL determinista (hash). */
function makeRecCtx(): Record<string, unknown> & { ops: string[]; toDataURL: () => string } {
  const ops: string[] = [];
  const ctx: AnyP = {
    canvas: null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    measureText: () => ({ width: 10 }),
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    translate: (x: unknown, y: unknown) => ops.push(`tr:${num(x)},${num(y)}`),
    rotate: (a: unknown) => ops.push(`ro:${num(a)}`),
    scale: (x: unknown, y: unknown) => ops.push(`sc:${num(x)},${num(y)}`),
    setTransform: (a: unknown, b: unknown, c: unknown, d: unknown, e: unknown, f: unknown) =>
      ops.push(`st:${num(a)},${num(b)},${num(c)},${num(d)},${num(e)},${num(f)}`),
    beginPath: () => ops.push('bp'),
    closePath: () => ops.push('cp'),
    moveTo: (x: unknown, y: unknown) => ops.push(`mv:${num(x)},${num(y)}`),
    lineTo: (x: unknown, y: unknown) => ops.push(`ln:${num(x)},${num(y)}`),
    arc: (x: unknown, y: unknown, r: unknown) => ops.push(`ar:${num(x)},${num(y)},${num(r)}`),
    ellipse: (x: unknown, y: unknown, r: unknown) => ops.push(`el:${num(x)},${num(y)},${num(r)}`),
    fill: () => ops.push('fill'),
    stroke: () => ops.push('stroke'),
    fillRect: (x: unknown, y: unknown, w: unknown, h: unknown) =>
      ops.push(`fr:${num(x)},${num(y)},${num(w)},${num(h)}`),
    strokeRect: (x: unknown, y: unknown, w: unknown, h: unknown) =>
      ops.push(`sr:${num(x)},${num(y)},${num(w)},${num(h)}`),
    clearRect: (x: unknown, y: unknown, w: unknown, h: unknown) =>
      ops.push(`cr:${num(x)},${num(y)},${num(w)},${num(h)}`),
    drawImage: (...a: unknown[]) =>
      ops.push(`di:${num(a[1])},${num(a[2])},${num(a[3])},${num(a[4])},${num(a[5])},${num(a[6])},${num(a[7])},${num(a[8])}`),
    fillText: (s: unknown, x: unknown, y: unknown) => ops.push(`ft:${String(s).slice(0, 12)},${num(x)},${num(y)}`),
    rect: (x: unknown, y: unknown, w: unknown, h: unknown) => ops.push(`rc:${num(x)},${num(y)},${num(w)},${num(h)}`),
    clip: () => ops.push('clip'),
    ops,
  };
  // propiedades de estado también se registran (afectan al píxel)
  for (const prop of ['fillStyle', 'strokeStyle', 'globalAlpha', 'globalCompositeOperation', 'lineWidth', 'font']) {
    let val: unknown = prop === 'globalAlpha' || prop === 'lineWidth' ? 1 : prop === 'globalCompositeOperation' ? 'source-over' : '';
    Object.defineProperty(ctx, prop, {
      get: () => val,
      set: (v: unknown) => { val = v; ops.push(`${prop}=${typeof v === 'number' ? num(v) : String(v)}`); },
    });
  }
  (ctx as { toDataURL: () => string }).toDataURL = () =>
    'data:image/png;base64,' + fnv1a(String(ops.length) + '|' + ops.join('|'));
  return ctx as Record<string, unknown> & { ops: string[]; toDataURL: () => string };
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

// canvases internos (sprites/suelo/raster del bioma) → grabadores
const makeCanvas = (): HTMLCanvasElement => {
  const rec = makeRecCtx();
  return {
    width: 300, height: 150, style: {},
    getContext: (_: string) => rec as unknown as CanvasRenderingContext2D,
    toDataURL: () => rec.toDataURL(),
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

const BC = await import('../src/game/biomas_cumbres');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

console.log('=== 1) INIT idempotente ===');
{
  try {
    BC.initCumbresBioma();
    const d1 = BC.__cumbresDebug();
    BC.initCumbresBioma();
    const d2 = BC.__cumbresDebug();
    if (d1.installed && d2.installed) ok('initCumbresBioma ×2: installed=true en ambas');
    else bad(`installed no queda a true (${d1.installed}/${d2.installed})`);
    if (d1.huellas === 0 && d1.aliento === 0 && d1.chispas === 0) ok('pools limpios tras install');
    else bad(`pools sucios tras install: ${JSON.stringify(d1)}`);
  } catch (e) {
    bad(`init lanzó excepción: ${String(e)}`);
  }
}

console.log('=== 2) Mapa cumbres cargado + primer tick/draw sin excepción ===');
const g = new Game(makeCanvas());
g.newGame('Prueba', 'alba');
g.startPlay();
try {
  g.loadMap('cumbres', 24, 38);
} catch (e) {
  bad(`loadMap('cumbres') lanzó: ${String(e)}`);
}
if (g.mapId === 'cumbres') ok("mapId = 'cumbres'");
else bad(`mapId=${g.mapId}`);
if (g.map.w === 50 && g.map.h === 42 && g.rows.length === 42) ok('dimensiones 50×42 correctas');
else bad(`dimensiones ${g.map.w}×${g.map.h}, rows=${g.rows.length}`);
try {
  BC.cumbresBiomaTick(g, 1 / 60);
  BC.drawCumbresBiomaOverlay(g);
  ok('tick + draw iniciales sin excepción');
} catch (e) {
  bad(`tick/draw inicial lanzó: ${String(e)}`);
}
if (BC.__cumbresDebug().rasterKey.startsWith('cumbres')) ok('raster pre-rasterizado con key cumbres:*');
else bad(`rasterKey inesperado: ${BC.__cumbresDebug().rasterKey}`);

console.log('=== 3) 600 frames acotados (día↔noche, caminando sobre nieve) ===');
{
  // busca una losa 2×2 de nieve 'S' (el Portador camina dentro sin salir de nieve)
  let wx = -1, wy = -1;
  outer:
  for (let y = 8; y < 40; y++) {
    for (let x = 6; x < 44; x++) {
      if (g.rows[y].charAt(x) === 'S' && g.rows[y].charAt(x + 1) === 'S' &&
          g.rows[y + 1].charAt(x) === 'S' && g.rows[y + 1].charAt(x + 1) === 'S') {
        wx = x; wy = y; break outer;
      }
    }
  }
  if (wx < 0) bad('no se encontró losa de nieve para el test de huellas');
  const p = g.player!;
  const maxH = { h: 0, a: 0, c: 0 };
  let threw: string | null = null;
  try {
    for (let i = 0; i < 600; i++) {
      g.globalT += 1 / 60;
      g.dayT = (0.66 + i * 0.00075) % 1; // noche → madrugada → día (cubre factorNoche)
      if (wx >= 0) {
        p.x = wx * 16 + 3 + ((i * 0.9) % 20); // deambula dentro de la losa 2×2
        p.y = wy * 16 + 5;
        p.moving = true;
        p.rollT = 0;
      }
      BC.cumbresBiomaTick(g, 1 / 60);
      BC.drawCumbresBiomaOverlay(g);
      const d = BC.__cumbresDebug();
      maxH.h = Math.max(maxH.h, d.huellas);
      maxH.a = Math.max(maxH.a, d.aliento);
      maxH.c = Math.max(maxH.c, d.chispas);
    }
  } catch (e) {
    threw = String(e);
  }
  if (threw === null) ok('600 frames (tick+draw) sin lanzar');
  else bad(`excepción a mitad del bucle: ${threw}`);
  if (maxH.h > 0 && maxH.h <= 20) ok(`huellas vivas acotadas (máx ${maxH.h} ≤ 20) y aparecen al andar`);
  else bad(`huellas fuera de rango: máx ${maxH.h} (esperado 1..20)`);
  if (maxH.a <= 10) ok(`aliento acotado (máx ${maxH.a} ≤ 10, se emitió: ${maxH.a > 0 ? 'sí' : 'no'})`);
  else bad(`aliento desbocado: ${maxH.a}`);
  if (maxH.c <= 8) ok(`chispas de la hoguera acotadas (máx ${maxH.c} ≤ 8, se emitió: ${maxH.c > 0 ? 'sí' : 'no'})`);
  else bad(`chispas desbocadas: ${maxH.c}`);

  // 60 frames a través del motor real (compatibilidad de integración)
  try {
    for (let i = 0; i < 60; i++) g.update(1 / 60);
    ok('60 frames de Game.update real sobre cumbres sin lanzar');
  } catch (e) {
    bad(`Game.update lanzó sobre cumbres: ${String(e)}`);
  }
}

console.log('=== 4) Huellas: TTL corto (desaparecen al parar) ===');
{
  const p = g.player!;
  p.moving = false;
  const antes = BC.__cumbresDebug().huellas;
  for (let i = 0; i < 210; i++) { // 3.5 s > TTL 3.2 s
    g.globalT += 1 / 60;
    BC.cumbresBiomaTick(g, 1 / 60);
  }
  const despues = BC.__cumbresDebug().huellas;
  if (antes > 0 && despues === 0) ok(`huellas ${antes}→0 tras 3.5 s parado (TTL corto)`);
  else bad(`huellas no decaen: antes=${antes} después=${despues}`);
}

console.log('=== 5) Draw determinista + aurora solo de noche ===');
{
  const rec = makeRecCtx();
  const realCtx = g.ctx;
  g.ctx = rec as unknown as CanvasRenderingContext2D;
  const drawFijo = () => {
    g.camX = 320; g.camY = 400;
    g.globalT = 12.34;
    BC.drawCumbresBiomaOverlay(g);
  };
  drawFijo();
  const hash1 = rec.toDataURL();
  const hayAurora1 = rec.ops.join('|').includes('rgba(78,232,156');
  rec.ops.length = 0;
  drawFijo();
  const hash2 = rec.toDataURL();
  if (hash1 === hash2) ok('dos draws con el mismo estado → misma secuencia de ops (determinismo)');
  else bad('draw NO determinista (hash1=' + hash1 + ' hash2=' + hash2 + ')');
  g.dayT = 0.85; // noche explícita
  rec.ops.length = 0;
  drawFijo();
  const opsNight = rec.ops.join('|');
  if (opsNight.includes('rgba(78,232,156') && opsNight.includes('rgba(154,116,242'))
    ok('de noche se dibujan las cintas de la aurora (verde + violeta)');
  else bad('la aurora no aparece de noche (dayT 0.85)');
  if (opsNight.includes('globalCompositeOperation=lighter')) ok('aurora en modo aditivo (lighter)');
  else bad('aurora sin composite lighter');
  const lastComp = opsNight.split('|').filter(s => s.startsWith('globalCompositeOperation=')).pop();
  if (lastComp === 'globalCompositeOperation=source-over') ok('composite restaurado a source-over al terminar');
  else bad(`composite final inesperado: ${lastComp}`);
  g.dayT = 0.35; // pleno día
  rec.ops.length = 0;
  drawFijo();
  if (!rec.ops.join('|').includes('rgba(78,232,156')) ok('de día NO hay aurora (factorNoche=0)');
  else bad('la aurora se dibuja de día');
  g.ctx = realCtx;
}

console.log('=== 6) Raster ×2 determinista (rebuild cumbres→lunaris→cumbres) ===');
{
  const url1 = BC.__cumbresRasterDataUrl();
  g.loadMap('lunaris', 25, 20);
  g.loadMap('cumbres', 24, 38);
  BC.cumbresBiomaTick(g, 1 / 60); // fuerza el rebuild del raster
  const url2 = BC.__cumbresRasterDataUrl();
  if (url1 && url2 && url1 === url2) ok(`raster ×2 → mismo dataURL (${url1.slice(0, 34)}…) de ${url1.length} chars`);
  else bad(`raster NO determinista: len1=${url1?.length} len2=${url2?.length} iguales=${url1 === url2}`);
  const vacio = makeCanvas().toDataURL(); // hash de un canvas SIN ops
  if (url1 && url1 !== vacio) ok('el raster tiene contenido real (hash ≠ canvas vacío)');
  else bad('raster sospechosamente vacío (hash = canvas sin ops)');
}

console.log('=== 7) Fuera de cumbres: no-op limpio ===');
{
  g.loadMap('lunaris', 25, 20);
  let threw: string | null = null;
  try {
    BC.cumbresBiomaTick(g, 1 / 60);
    BC.drawCumbresBiomaOverlay(g);
  } catch (e) {
    threw = String(e);
  }
  const d = BC.__cumbresDebug();
  if (threw === null) ok('tick/draw fuera de cumbres sin excepción');
  else bad(`fuera de cumbres lanzó: ${threw}`);
  if (d.huellas === 0 && d.aliento === 0 && d.chispas === 0) ok('pools vacíos fuera del bioma');
  else bad(`pools contaminados fuera del bioma: ${JSON.stringify(d)}`);
}

console.log(fails === 0 ? '\nSMOKE CUMBRES BIOMA: TODO OK' : `\nSMOKE CUMBRES BIOMA: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
