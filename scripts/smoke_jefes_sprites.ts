// ============================================================
// 18-c (sprites-jefes) — Smoke de los sprites de jefes/enemigos
// refechos, SIN navegador. Stub DOM con canvas GRABADOR: cada
// fillRect se registra (posición, fillStyle, globalAlpha) y
// canvas.toDataURL() devuelve una FIRMA determinista de la lista
// de ops — así podemos probar determinismo real sin decodificar
// PNG. Patrón de stub de las primeras 60 líneas de
// scripts/smoke_timeskip.ts.
//
// Verifica:
//  (1) initExpansionSprites() registra los 14 nombres EXACTOS y
//      getSpr() NO cae en el fallback hero_alba;
//  (2) cada sprite tiene los frames documentados en 18-c (≥2) y
//      tamaños sanos (0 < lado ≤ 48, todos los frames iguales);
//  (3) entityFrame() mantiene el ciclo jugable (0/1 al moverse,
//      0 quieto) para todos los sprites multi-frame;
//  (4) DETERMINISMO TOTAL: reconstruir todo dos veces produce la
//      misma firma por frame (y objetos canvas nuevos).
// Ejecutar: bun scripts/smoke_jefes_sprites.ts > scripts/_smoke_jefes.txt
// ============================================================

// ---------- stub universal + canvas grabador ----------
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

/** Firma determinista de una lista de ops de dibujo (hash FNV-1a). */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

interface RecCanvas extends HTMLCanvasElement {
  __ops: () => string;
}

function makeRecCanvas(): RecCanvas {
  const canvas: any = { width: 0, height: 0, style: {} };
  const ops: string[] = [];
  const ctx: any = {
    canvas,
    fillStyle: '',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    fillRect(x: number, y: number, w: number, h: number) {
      ops.push(`R${x},${y},${w},${h}|${ctx.fillStyle}|${Number(ctx.globalAlpha).toFixed(3)}`);
    },
    // el resto del API del ctx que puedan tocar los builders:
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, strokeRect: noop, clearRect: noop,
    drawImage: noop, fillText: noop, setTransform: noop, rect: noop, clip: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
  };
  canvas.getContext = (_: string) => ctx;
  canvas.toDataURL = () => `data:image/png;base64,${ops.length.toString(36)}${fnv1a(ops.join(';'))}`;
  canvas.__ops = () => ops.join(';');
  return canvas as RecCanvas;
}

(globalThis as AnyP).document = {
  createElement: (tag: string) => (tag === 'canvas' ? makeRecCanvas() : stub()),
  getElementById: () => makeRecCanvas(),
  addEventListener: noop,
  body: stub(),
  documentElement: stub(),
} as unknown as Document;
(globalThis as AnyP).localStorage = {
  getItem: () => null, setItem: noop, removeItem: noop, clear: noop, key: () => null, length: 0,
};
(globalThis as AnyP).performance = { now: () => Date.now() };
(globalThis as AnyP).requestAnimationFrame = () => 0;

// ---------- sujeto bajo prueba ----------
import { initExpansionSprites } from '../src/game/sprites_expansion';
import { getSpr, initSprites, entityFrame } from '../src/game/sprites';

// ---------- aserciones ----------
let fails = 0;
const ok = (cond: boolean, label: string) => {
  if (!cond) { fails++; console.log(`  ✗ ${label}`); }
  return cond;
};

// Contrato 18-c: nombre → nº de frames documentado (+ tamaños esperados).
const EXPECT: Record<string, { frames: number; w: number; h: number }> = {
  neumo: { frames: 3, w: 16, h: 16 },
  espectro: { frames: 3, w: 16, h: 16 },
  arpi: { frames: 3, w: 16, h: 16 },
  sirena: { frames: 5, w: 36, h: 36 },
  golem: { frames: 5, w: 36, h: 36 },
  orb: { frames: 2, w: 12, h: 12 },
  shard: { frames: 2, w: 12, h: 12 },
  nota: { frames: 2, w: 12, h: 12 },
  vult: { frames: 4, w: 32, h: 32 },
  coro1: { frames: 3, w: 30, h: 30 },
  coro2: { frames: 3, w: 30, h: 30 },
  coro3: { frames: 3, w: 30, h: 30 },
  ecodesg: { frames: 3, w: 16, h: 16 },
  satiro: { frames: 3, w: 16, h: 16 },
};
const NAMES = Object.keys(EXPECT);

console.log('=== SMOKE 18-c · sprites-jefes (canvas grabador determinista) ===');

// base real para el fallback: initSprites crea hero_alba de verdad
initSprites();
const heroFrames = getSpr('hero_alba');
if (!ok(!!heroFrames, 'initSprites crea hero_alba')) process.exit(1);

initExpansionSprites();

const sigs = new Map<string, string>();
console.log('\n[1] registro · frames · tamaños');
for (const name of NAMES) {
  const fr = getSpr(name);
  const exp = EXPECT[name];
  if (!ok(!!fr && fr !== heroFrames, `${name}: registrado (no cae en fallback hero_alba)`)) continue;
  ok(fr!.length === exp.frames, `${name}: ${fr!.length} frames (esperados ${exp.frames})`);
  const w = fr![0].width, h = fr![0].height;
  ok(w === exp.w && h === exp.h, `${name}: ${w}×${h} (esperado ${exp.w}×${exp.h})`);
  ok(w > 0 && h > 0 && w <= 48 && h <= 48, `${name}: tamaño sano 0 < ${w}×${h} ≤ 48`);
  let same = true;
  for (let i = 0; i < fr!.length; i++) {
    if (fr![i].width !== w || fr![i].height !== h) same = false;
    sigs.set(`${name}#${i}`, fr![i].toDataURL());
  }
  ok(same, `${name}: todos los frames miden lo mismo`);
  console.log(`  · ${name.padEnd(9)} ${String(fr!.length)} frames  ${w}×${h}  ${sigs.get(`${name}#0`)}`);
}

console.log('\n[2] ciclo jugable con entityFrame (patrulla 0/1 · reposo 0)');
for (const name of NAMES) {
  const fr = getSpr(name)!;
  const idle = entityFrame(fr, 'down', false, 0);
  const walkA = entityFrame(fr, 'right', true, 0.0);
  const walkB = entityFrame(fr, 'right', true, 0.2);
  ok(idle === 0, `${name}: reposo → frame 0 (got ${idle})`);
  ok(walkA === 0 && walkB === 1, `${name}: andando alterna 0/1 (got ${walkA}/${walkB})`);
  ok(entityFrame(fr, 'down', true, 9.7) < 2, `${name}: nunca sale del ciclo de patrulla`);
}

console.log('\n[3] determinismo: reconstrucción completa idéntica');
initExpansionSprites(); // reconstruye TODOS los canvas desde cero
let mismatches = 0, checked = 0;
for (const name of NAMES) {
  const fr = getSpr(name)!;
  for (let i = 0; i < fr.length; i++) {
    checked++;
    const s2 = fr[i].toDataURL();
    if (sigs.get(`${name}#${i}`) !== s2) { mismatches++; console.log(`  ✗ ${name}#${i}: firma distinta ${sigs.get(`${name}#${i}`)} → ${s2}`); }
  }
}
ok(mismatches === 0, `determinismo: ${checked} frames comparados, ${mismatches} divergencias`);

console.log('\n[4] resumen para el integrador (orden de frames 18-c)');
console.log('  sirena  5: 0/1 flotar · 2 telegraph (carga+windup) · 3 látigo (ataca) · 4 sumergida (invulT)');
console.log('  golem   5: 0/1 andar · 2 telegraph · 3 smash · 4 agrietado (phase 3, reposo)');
console.log('  vult    4: 0/1 carrera · 2 garra alzada (carga) · 3 embestida (ataca)');
console.log('  coro1-3 3: 0/1 bob · 2 canto con motivo (Pulso orbes / Vera rayos / Silencio notas)');
console.log('  neumo   3: 0/1 membrana · 2 hinchado (carga)   | espectro 3: 0/1 flotar · 2 fase (invulT)');
console.log('  arpi    3: 0 alas↑ · 1 alas↓ · 2 planeo (picado) | ecodesg 3: 0/1 parpadeo · 2 dash');
console.log('  satiro  3: 0/1 brinco · 2 lira (carga)          | orb/shard/nota 2: pulso (fallback)');

console.log(`\n=== RESULTADO: ${fails === 0 ? 'TODO OK' : fails + ' FALLOS'} ===`);
if (fails > 0) process.exit(1);
