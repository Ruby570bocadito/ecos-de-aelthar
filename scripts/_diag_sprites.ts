// 18-d · dump ASCII de sprites humanoides — stub DOM con grabación por canvas
type AnyP = Record<string | symbol, unknown>;
const noop = () => stub();
function stub(): any {
  return new Proxy(noop, {
    get: (_t, prop) => {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'toString') return () => '';
      if (prop === 'valueOf') return () => 0;
      return stub();
    },
    set: () => true, apply: () => stub(),
  }) as unknown as AnyP;
}
interface CvStub { width: number; height: number; grid: (string | null)[][]; }
(globalThis as AnyP).document = {
  createElement: () => {
    const cv: CvStub = { width: 0, height: 0, grid: [] };
    (cv as AnyP).getContext = () => ({
      set fillStyle(v: string) { cur = v; }, get fillStyle() { return cur ?? ''; },
      set globalAlpha(v: number) {}, get globalAlpha() { return 1; },
      fillRect: (x: number, y: number, w: number, h: number) => {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
          if (!cv.grid[yy]) cv.grid[yy] = [];
          if (xx >= 0 && yy >= 0) cv.grid[yy][xx] = cur ?? null;
        }
      },
      clearRect: (x: number, y: number, w: number, h: number) => {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (cv.grid[yy]) cv.grid[yy][xx] = null;
      },
      drawImage: noop, save: noop, restore: noop, setTransform: noop,
      beginPath: noop, arc: noop, fill: noop, stroke: noop, moveTo: noop, lineTo: noop, ellipse: noop, closePath: noop,
    });
    return cv as unknown as HTMLCanvasElement;
  },
  getElementById: () => stub(),
  addEventListener: noop, body: stub(), documentElement: stub(),
} as unknown as Document;
let cur: string | null = null;
const { initSprites, getSpr } = await import('../src/game/sprites');
initSprites();
const name = process.argv[2] ?? 'hero_alba';
const frames = getSpr(name);
const dirs = ['down', 'up', 'side'];
let li = 65;
const letters = new Map<string, string>();
const letter = (c: string | null) => {
  if (c === null) return '.';
  let l = letters.get(c);
  if (!l) { l = String.fromCharCode(li++); letters.set(c, l); }
  return l;
};
for (let i = 0; i < frames.length; i++) {
  const cv = frames[i] as unknown as CvStub;
  console.log(`\n--- ${name} [${i}] ${dirs[Math.floor(i / 3)]} f${i % 3} (${cv.width}×${cv.height}) ---`);
  for (let y = 0; y < cv.height; y++) {
    let row = '';
    for (let x = 0; x < cv.width; x++) row += letter(cv.grid[y]?.[x] ?? null);
    console.log('  ' + row);
  }
}
console.log('paleta: ' + [...letters.entries()].map(([c, l]) => `${l}=${c}`).join(' '));
