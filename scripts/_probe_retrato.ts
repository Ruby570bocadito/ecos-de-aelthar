// Probe: ¿el retrato uso_faro se fusionó y dibuja su propio bg?

// stub DOM mínimo (document.createElement('canvas') real para pixel data)
const makeCanvas = () => {
  const c = {
    width: 300, height: 300,
    getContext: (_t: string) => makeCtx(),
  };
  return c as unknown as HTMLCanvasElement;
};
const makeCtx = (): CanvasRenderingContext2D => {
  const data: string[] = [];
  return {
    fillStyle: '',
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) { data.push(`${this.fillStyle}`); },
    drawImage() { }, save() { }, restore() { },
    scale() { }, translate() { },
    createLinearGradient: () => ({ addColorStop: () => { } }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => { },
    beginPath() { }, arc() { }, fill() { }, stroke() { },
    canvas: null as unknown as HTMLCanvasElement,
    __ops: data,
  } as unknown as CanvasRenderingContext2D;
};
(g0 => { })((globalThis as unknown as { document?: unknown }));
(globalThis as unknown as { document: unknown }).document = {
  createElement: (t: string) => makeCanvas(),
  getElementById: () => null,
};

import { drawPortrait, initSprites } from '../src/game/sprites';
import { initFaroSprites } from '../src/game/faro_historia';

// ctx grabador de fillStyle/fillRect
const ops: string[] = [];
const ctx = {
  set fillStyle(v: string) { this._f = v; },
  get fillStyle() { return this._f ?? ''; },
  _f: '',
  fillRect(x: number, y: number, w: number, h: number) {
    if (ops.length < 6) ops.push(`${this._f} @${x},${y} ${w}x${h}`);
  },
  globalAlpha: 1,
  save() { }, restore() { },
} as unknown as CanvasRenderingContext2D;

initSprites();
initFaroSprites();
drawPortrait(ctx, 'uso_faro', 0, 0, 2);
console.log('primeras llamadas:', JSON.stringify(ops, null, 1));
console.log(ops[0] === '#1a1710 @0,0 56x80' ? 'USO_FARO OK (bg propio)' : 'FALLBACK wisp o incoherente');

