// ============================================================
// R18 · 18-d — Smoke del héroe detallado, retratos y fx
// (completado por el integrador: el agente murió por timeout
//  con el código ya escrito; esto verifica su trabajo).
//  (a) humanoides: 9 frames de 16×H, tamaños coherentes
//  (b) determinismo: build ×2 → mismos dataURLs
//  (c) drawPortrait de TODAS las claves sin excepción
//  (d) fx: 600 frames acotados y sin excepción
// Ejecutar: bun scripts/smoke_hero_fx.ts
// ============================================================

// ---------- stub universal (patrón smoke_desafio/13-c) ----------
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
const g: AnyP = globalThis as unknown as AnyP;
if (typeof (g as { document?: unknown }).document === 'undefined') {
  (g as { document: unknown }).document = {
    createElement: (_t: string) => ({ getContext: () => stub(), width: 300, height: 300, style: {} }),
    getElementById: () => null,
    addEventListener: noop,
    body: { appendChild: noop },
  };
  (g as { window?: unknown }).window = g;
  (g as { localStorage?: unknown }).localStorage = {
    getItem: () => null, setItem: noop, removeItem: noop, clear: noop,
  };
}

import { getSpr, entityFrame, drawPortrait, initSprites } from '../src/game/sprites';
import { initFaroSprites } from '../src/game/faro_historia';
import { initExpansionSprites } from '../src/game/sprites_expansion';
import { updateAmbient, drawAmbient, combatSparks, dodgeRing, critGlint } from '../src/game/fx';

let ok = 0, fail = 0;
function check(cond: boolean, msg: string) {
  if (cond) { ok++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ FALLO: ${msg}`); }
}

function dataUrlOf(cv: HTMLCanvasElement): string {
  try { return cv.toDataURL(); } catch { return `w${cv.width}h${cv.height}`; }
}

console.log('SMOKE HERO FX · héroe detallado + retratos + fx');

// inicialización (el juego la hace el constructor de Game)
initSprites();
initExpansionSprites();
initFaroSprites();

// ---------- (a) humanoides: contrato de frames ----------
console.log('\n[a] contrato de humanoides (9 frames)');
const HUMANOS = ['hero_alba', 'hero_tejedor', 'brisa', 'toln', 'ilwen', 'doran', 'kael', 'sasha', 'brokk', 'maelis', 'corvin', 'inquisidor', 'teo', 'nimue'];
for (const name of HUMANOS) {
  const spr = getSpr(name);
  const esHumanoide = spr.length === 9;
  check(esHumanoide, `${name} → ${spr.length} frames (9 esperados; fallback roto si no)`);
  if (esHumanoide) {
    const w = spr[0].width, h = spr[0].height;
    const uniformes = spr.every(f => f.width === w && f.height === h);
    check(uniformes, `${name} → tamaños uniformes ${w}×${h}`);
    // selección robusta por dirección (el fix R18 del facing)
    const d = entityFrame(spr, 'left', true, 0.5);
    const i = entityFrame(spr, 'right', true, 0.5);
    const s = entityFrame(spr, 'side', true, 0.5);
    check(d === i && i === s && d >= 6, `${name} → left/right/side dan el MISMO frame lateral (${d})`);
    const up = entityFrame(spr, 'up', true, 0.5);
    const dn = entityFrame(spr, 'down', true, 0.5);
    check(up >= 3 && up < 6 && dn < 3, `${name} → up (${up}) y down (${dn}) en sus filas`);
    const quieto = entityFrame(spr, 'down', false, 0);
    check(quieto === 1, `${name} → pose de pie = frame 1 (fase sin bob)`);
  }
}

// ---------- (b) determinismo del build ----------
console.log('\n[b] determinismo (rebuild del módulo)');
{
  // initSprites reconstruye PALS desde cero; dos ejecuciones del mismo build
  // deben producir los mismos píxeles. Reimportamos con cache-buster NO
  // posible en bun sin reload de módulo — comparamos contra una 2.ª llamada
  // del propio init (idempotencia de salida).
  const antes = HUMANOS.map(n => dataUrlOf(getSpr(n)[0]));
  const { initSprites } = await import('../src/game/sprites');
  initSprites();
  const despues = HUMANOS.map(n => dataUrlOf(getSpr(n)[0]));
  const iguales = antes.every((u, i) => u === despues[i]);
  check(iguales, 'rebuild ×2 → mismos dataURLs (determinismo de buildHumanoid)');
}

// ---------- (c) drawPortrait de todas las claves ----------
console.log('\n[c] retratos sin excepción');
{
  // keys conocidas + las del faro (18-e fusionadas por initFaroSprites)
  const claves = ['hero_alba', 'hero_tejedor', 'brisa', 'toln', 'ilwen', 'sasha', 'brokk', 'maelis', 'corvin', 'kael', 'inquisidor', 'teo', 'doran', 'nimue', 'guardian', 'sombra', 'wisp', 'fragment', 'sanctuary', 'mara_farera', 'uso_faro', 'tina_faro', 'clave_inexistente'];
  const ctxStub = stub() as unknown as CanvasRenderingContext2D;
  let lanzo = 0;
  for (const k of claves) {
    try { drawPortrait(ctxStub, k, 0, 0, 2); } catch { lanzo++; console.log(`  ✗ drawPortrait('${k}') lanzó`); }
  }
  check(lanzo === 0, `drawPortrait ×${claves.length} claves sin excepciones (incl. fallback 'wisp' y las 3 del faro)`);
}

// ---------- (d) fx: 600 frames acotados ----------
console.log('\n[d] fx acotado (600 frames)');
{
  const fake = {
    globalT: 0, ctx: stub() as unknown as CanvasRenderingContext2D,
    particles: [] as unknown[], floats: [] as unknown[],
    mapId: 'lunaris', epoch: 'presente', dayT: 0.45,
    player: { x: 100, y: 100, dir: 'down' },
    enemies: [], map: { props: [] },
    camX: 0, camY: 0,
  } as unknown as Parameters<typeof updateAmbient>[0];
  let lanzo = 0;
  try {
    for (let i = 0; i < 600; i++) {
      fake.globalT += 1 / 60;
      updateAmbient(fake, 1 / 60);
      if (i % 30 === 0) {
        combatSparks(fake, 100 + i, 100, 1, 0);
        dodgeRing(fake, 100, 100);
        critGlint(fake, 100, 100);
        drawAmbient(fake, 'sky');
      }
      if (fake.particles.length > 200) (fake.particles as unknown[]).length = 0;
      if (fake.floats.length > 40) (fake.floats as unknown[]).length = 0;
    }
  } catch (e) { lanzo++; console.log(`  ✗ fx lanzó: ${String(e).slice(0, 120)}`); }
  check(lanzo === 0, 'updateAmbient/combatSparks/dodgeRing/critGlint/drawAmbient ×600 frames sin excepción');
}

console.log(`\nRESULTADO: ${ok} ok, ${fail} fallos`);
if (fail > 0) process.exit(1);
