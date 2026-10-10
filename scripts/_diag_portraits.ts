// 18-d · Diagnóstico de retratos: reproduce drawPortrait con un ctx stub que
// graba fillRect en un buffer exacto 28×40 (unidades lógicas) y lo vuelca a
// ASCII con una letra por color. Muestra píxeles que caen FUERA del lienzo y
// colores raros por retrato. Ejecutar: bun scripts/_diag_portraits.ts
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
    set: () => true,
    apply: () => stub(),
  }) as unknown as AnyP;
}

const W = 28, H = 40;
const grid: string[][] = [];
const palette = new Map<string, string>(); // color → letra
let nextLetter = 65; // 'A'

function letterFor(color: string): string {
  let l = palette.get(color);
  if (!l) {
    l = String.fromCharCode(nextLetter++);
    if (nextLetter > 90) nextLetter = 97; // tras Z, minúsculas
    palette.set(color, l);
  }
  return l;
}

function reset(): void {
  grid.length = 0; palette.clear(); nextLetter = 65;
  for (let y = 0; y < H; y++) { grid.push([]); for (let x = 0; x < W; x++) grid[y].push('.'); }
}

const orphans: string[] = [];
function mkCtx(): CanvasRenderingContext2D {
  return {
    fillRect: (rx: number, ry: number, rw: number, rh: number) => {
      rx = Math.round(rx); ry = Math.round(ry); rw = Math.round(rw); rh = Math.round(rh);
      const fillStyle = (curFill ?? '') as string;
      const letter = letterFor(fillStyle);
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) {
            orphans.push(`FUERA (${x},${y}) color=${fillStyle}`);
            continue;
          }
          grid[y][x] = letter;
        }
      }
    },
    set fillStyle(v: string) { curFill = v; },
    get fillStyle() { return curFill ?? ''; },
    set globalAlpha(v: number) { curAlpha = v; },
    get globalAlpha() { return curAlpha ?? 1; },
    save: noop, restore: noop,
  } as unknown as CanvasRenderingContext2D;
}
let curFill: string | null = null;
let curAlpha = 1;

const { drawPortrait } = await import('../src/game/sprites');

const keys = process.argv[2] ? [process.argv[2]] : [
  'hero_alba', 'hero_tejedor', 'brisa', 'toln', 'ilwen', 'sasha', 'brokk', 'maelis',
  'corvin', 'kael', 'inquisidor', 'teo', 'doran', 'nimue', 'guardian', 'sombra', 'wisp',
  'fragment', 'sanctuary',
];

for (const key of keys) {
  reset(); orphans.length = 0;
  curFill = null; curAlpha = 1;
  drawPortrait(mkCtx(), key, 0, 0, 1, false);
  const letters = [...palette.entries()].map(([c, l]) => `${l}=${c}`).join(' ');
  console.log(`\n===== ${key} =====`);
  console.log(letters);
  for (const o of orphans) console.log('  ' + o);
  for (let y = 0; y < H; y++) console.log(String(y).padStart(2) + ' ' + grid[y].join(''));
}
