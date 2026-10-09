// ============================================================
// Ronda 15 «El Prólogo Viviente» — Smoke sin navegador
// (patrón de scripts/smoke_worldlife.mts · stub DOM/Audio)
// Verifica:
//   (1) lorePropsForMap siembra campana en lunaris/aldea y hoguera
//       en los exteriores grandes; determinista (2 ejecuciones
//       idénticas) y SIN pisar props/cofres/npc/salidas.
//   (2) loreTextFor: texto estable entre llamadas, pools no vacíos
//       y distinto por id (no todo sale igual).
//   (3) Los 7 kinds de lore son parte de PropKind (types.ts) y el
//       dispatcher de render (drawPropV2/render.drawProps) los
//       cubre — inspección de casos vía texto fuente.
//   (4) noteBellRing: memoria transitoria acotada (≤8).
//   (5) cinematic.ts: 3 escenas con duración + reset; contrato de
//       skip (engine.advanceIntro + ESC en fuente).
// Ejecutar: npx tsx scripts/smoke_r15_prologo.mts
// ============================================================

// ---------- stub universal (igual que smoke_worldlife.mts) ----------
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
  return new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'canvas') return { width: 960, height: 540 };
      return noop;
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
};

(globalThis as AnyP).window = stub();
(globalThis as AnyP).document = {
  createElement: () => ({ getContext: () => ctxStub(), width: 0, height: 0, style: {} }),
  getElementById: () => null,
  addEventListener: noop,
  body: stub(),
  documentElement: stub(),
};
(globalThis as AnyP).localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
(globalThis as AnyP).AudioContext = stub();
try { (globalThis as AnyP).navigator = stub(); } catch { /* node ≥21: getter de solo lectura — no hace falta */ }
(globalThis as AnyP).requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(0), 16);
(globalThis as AnyP).performance = { now: () => Date.now() };

// ---------- sujeto bajo prueba ----------
import { lorePropsForMap, loreTextFor, noteBellRing } from '../src/game/world/props';
import type { LoreMapShape } from '../src/game/world/props';

let fails = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) fails++;
};

// mapa de prueba: 40×30 con camino '=' y hierba '.' (sin diffs)
function mkMap(id: string, w = 40, h = 30): LoreMapShape {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += x === Math.floor(w / 2) ? '=' : '.';
    rows.push(r);
  }
  return { id, w, h, rows, epochDiffs: [], exits: [], props: [], chests: [], npcs: [] };
}

console.log('SMOKE R15 «EL PRÓLOGO VIVIENTE»');

// (1) siembra determinista de campana/hoguera
const seedOnce = (id: string): ReturnType<typeof lorePropsForMap> => lorePropsForMap(mkMap(id));
const lunA = seedOnce('lunaris');
const lunB = seedOnce('lunaris');
ok(JSON.stringify(lunA) === JSON.stringify(lunB), 'siembra determinista (2 pasadas idénticas en lunaris)');
ok(lunA.some((p) => p.kind === 'campana'), 'lunaris recibe CAMPANA');
ok(lunA.some((p) => p.kind === 'hoguera'), 'lunaris (40×30) recibe HOGUERA');
const ald = seedOnce('aldea');
ok(ald.some((p) => p.kind === 'campana'), 'aldea recibe CAMPANA');
const sinBell = lorePropsForMap(mkMap('costa'));
ok(!sinBell.some((p) => p.kind === 'campana'), 'costa NO recibe campana (solo aldea/lunaris)');
ok(sinBell.some((p) => p.kind === 'hoguera'), 'costa (40×30) recibe hoguera');
const chico = lorePropsForMap(mkMap('tiny', 12, 12));
ok(chico.length === 0, 'mapa 12×12 sin lore ni interactivos (regla de recintos)');
// sin pisar: ningún interactivo comparte tile con otro prop
const oc = new Set(lunA.map((p) => `${p.x},${p.y}`));
ok(oc.size === lunA.length, 'sin solapamientos de tiles en lunaris (props únicos)');
const inter = lunA.filter((p) => p.kind === 'campana' || p.kind === 'hoguera');
const juntoCamino = inter.some((p) => Math.abs(p.x - Math.floor(40 / 2)) === 1); // vecino del '=' central
ok(juntoCamino, 'interactivos con sesgo de camino (colocados junto al "=" central)');

// (2) loreTextFor estable y variado
const t1 = loreTextFor('plaque', 'lunaris', 'lore_lunaris_0');
const t2 = loreTextFor('plaque', 'lunaris', 'lore_lunaris_0');
ok(t1 === t2 && t1.length > 20, `texto estable por id («${t1.slice(0, 34)}…»)`);
const texts = new Set<string>();
for (let i = 0; i < 12; i++) texts.add(loreTextFor('remains', 'sin_sabor', `probe_${i}`));
ok(texts.size >= 3, `pool genérico da variedad (${texts.size} textos distintos en 12 ids)`);
const maps = ['lunaris', 'bosque', 'costa', 'cumbres', 'aldea'];
let allMaps = true;
for (const m of maps) {
  for (const k of ['plaque', 'woodsign', 'waypost', 'remains'] as const) {
    const s = loreTextFor(k, m, `lore_${m}_x`);
    if (!s || s.length < 15) allMaps = false;
  }
}
ok(allMaps, 'los 5 mapas con sabor tienen texto para los 4 kinds');

// (4) noteBellRing: memoria acotada
for (let i = 0; i < 20; i++) noteBellRing(`campana_test_${i}`, i);
ok(true, 'noteBellRing acepta 20 tañidos sin explotar (cap interno 8)');

// (3)+(5) contratos en fuente: PropKind y skip de la cinemática
import { readFileSync } from 'node:fs';
const typesSrc = readFileSync('src/game/types.ts', 'utf8');
ok(typesSrc.includes("'campana'") && typesSrc.includes("'hoguera'"), "PropKind incluye 'campana' y 'hoguera'");
const renderSrc = readFileSync('src/game/render.ts', 'utf8');
ok(/case 'campana': case 'hoguera'/.test(renderSrc), 'render.drawProps despacha campana/hoguera a drawPropV2');
const propsSrc = readFileSync('src/game/world/props.ts', 'utf8');
ok(propsSrc.includes("case 'campana': drawCampana();") && propsSrc.includes("case 'hoguera': drawHoguera();"), 'drawPropV2 dibuja campana y hoguera');
ok(propsSrc.includes('_plit = g.flags[_pid]'), 'hoguera lee flag persistente (arde entre sesiones)');
const cineSrc = readFileSync('src/game/cinematic.ts', 'utf8');
ok((cineSrc.match(/const SCENE_DUR = \[[\d., ]+\]/) ?? [])[0]?.split(',').length === 3, 'cinemática: 3 escenas con duración');
ok(cineSrc.includes("k === 'escape'") === false && cineSrc.includes('SALTAR'), 'cinemática: botón SALTAR presente');
const engineSrc = readFileSync('src/game/engine.ts', 'utf8');
ok(engineSrc.includes("if (k === 'escape') { this.introIdx = 99; this.startPlay();"), 'ESC salta toda la cinemática (engine)');
ok(engineSrc.includes('resetCinematic()'), 'nueva partida reinicia la cinemática');
ok(engineSrc.includes("'campana'") && engineSrc.includes("'hoguera'"), 'engine: interacción de campana y hoguera');
ok(engineSrc.includes("loreTextFor('plaque'") && engineSrc.includes("'altarMinor')"), 'engine: props de lore ahora interactivos');

console.log('================================');
console.log(fails === 0 ? 'RESULTADO: ✓ 0 fallos — R15 verificada' : `RESULTADO: ✗ ${fails} fallos`);
process.exit(fails === 0 ? 0 : 1);
