// Probe: qué spawns de costa están a <4 tiles de (25,33) tras la integración
const stub: any = new Proxy({}, {
  get: (t, p) => {
    if (p === Symbol.toPrimitive) return () => 0;
    if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    if (p === 'measureText') return () => ({ width: 0 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: () => {} });
    return stub;
  },
  apply: () => stub,
});
(globalThis as any).window = globalThis;
(globalThis as any).document = { getElementById: () => null, createElement: () => ({ getContext: () => stub, width: 0, height: 0, style: {} }), addEventListener: () => {}, body: { appendChild: () => {} } };
(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
(globalThis as any).performance = { now: () => 0 };
(globalThis as any).requestAnimationFrame = () => 0;

const { MAPS } = await import('../src/game/maps');
const costa: any = (MAPS as any).costa;
console.log('spawns costa total:', costa.spawns.length);
for (const s of costa.spawns) {
  const d = Math.hypot(s.x - 25, s.y - 33);
  if (d < 6) console.log('CERCANO', s.type, `(${s.x},${s.y})`, 'dist=' + d.toFixed(2), 'zone=' + s.zone);
}
