// ============================================================
// R18 — Smoke determinista de RUTAS (BFS sobre tiles sólidos)
// Diagnóstico del bug «la cripta está bloqueada por árboles» y
// auditoría permanente de todas las rutas clave del juego:
//  · Cada zona de salida de cada mapa es alcanzable desde el
//    interior (época presente y pasada si tiene diffs).
//  · Los altares del Eco son alcanzables (el gating es narrativo,
//    NO de mapa: probarlo aquí y vigilar regresiones).
//  · Cofres/NPCs/props clave alcanzan adyacencia peatonal.
// Ejecutar: bun scripts/smoke_rutas.ts
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

import { MAPS, mapRows, tileAt } from '../src/game/maps';
import { SOLID_CHARS } from '../src/game/sprites';
import type { MapDef, Epoch } from '../src/game/types';

let ok = 0, fail = 0;
function check(cond: boolean, msg: string) {
  if (cond) { ok++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ FALLO: ${msg}`); }
}

interface P { x: number; y: number }

function bfs(m: MapDef, rows: string[], epoch: Epoch, from: P): Set<number> {
  const seen = new Set<number>();
  const q: P[] = [from];
  seen.add(from.y * m.w + from.x);
  while (q.length) {
    const c = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const k = ny * m.w + nx;
      if (seen.has(k)) continue;
      if (SOLID_CHARS.has(tileAt(m, rows, nx, ny, epoch))) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}

function zoneReachable(m: MapDef, rows: string[], epoch: Epoch, reach: Set<number>, zone: { x: number; y: number; w: number; h: number }): P | null {
  for (let y = zone.y; y < zone.y + zone.h; y++) {
    for (let x = zone.x; x < zone.x + zone.w; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      if (reach.has(y * m.w + x)) return { x, y };
    }
  }
  return null;
}

function adjacentWalkable(m: MapDef, rows: string[], epoch: Epoch, reach: Set<number>, tx: number, ty: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]] as const) {
    const x = tx + dx, y = ty + dy;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
    if (reach.has(y * m.w + x)) return true;
  }
  return false;
}

// Semillas interiores seguras (aterrizajes o suelo abierto conocido).
const SEMILLAS: Record<string, P[]> = {
  lunaris: [{ x: 25, y: 19 }, { x: 26, y: 35 }],
  bosque: [{ x: 26, y: 24 }, { x: 51, y: 7 }, { x: 27, y: 40 }],
  cripta: [{ x: 19, y: 30 }, { x: 21, y: 24 }],
  costa: [{ x: 26, y: 2 }, { x: 22, y: 21 }, { x: 47, y: 18 }],
  aldea: [{ x: 3, y: 18 }, { x: 17, y: 21 }],
  cumbres: [{ x: 25, y: 38 }, { x: 14, y: 24 }, { x: 24, y: 6 }],
  arena: [{ x: 21, y: 16 }],
};

console.log('SMOKE RUTAS · BFS de accesibilidad peatonal (todas las épocas)');
for (const id of Object.keys(MAPS) as (keyof typeof MAPS)[]) {
  const m = MAPS[id];
  const rows = mapRows(m);
  const epochs: Epoch[] = m.epochDiffs.length ? ['presente', 'pasado'] : ['presente'];
  for (const epoch of epochs) {
    console.log(`\n[${id} · ${epoch}]`);
    const reach = new Set<number>();
    for (const s of (SEMILLAS[id] ?? [])) {
      if (SOLID_CHARS.has(tileAt(m, rows, s.x, s.y, epoch))) {
        check(false, `semilla (${s.x},${s.y}) es SÓLIDA en ${epoch}`);
        continue;
      }
      for (const k of bfs(m, rows, epoch, s)) reach.add(k);
    }
    // salidas
    for (const ex of m.exits) {
      const hit = zoneReachable(m, rows, epoch, reach, ex);
      check(hit !== null, `salida «${ex.label}» zona (${ex.x},${ex.y} ${ex.w}×${ex.h}) alcanzable${hit ? ` vía (${hit.x},${hit.y})` : ''}`);
    }
    // NPCs (adyacencia)
    for (const n of m.npcs) {
      check(adjacentWalkable(m, rows, epoch, reach, n.x, n.y), `NPC ${n.id} (${n.x},${n.y}) con acceso peatonal`);
    }
    // cofres (adyacencia; needPast se prueba en su época)
    for (const ch of m.chests) {
      const ep = ch.needPast ? 'pasado' : epoch;
      const r2 = ep === epoch ? reach : (() => {
        const s = new Set<number>();
        for (const seed of (SEMILLAS[id] ?? [])) { if (!SOLID_CHARS.has(tileAt(m, rows, seed.x, seed.y, ep))) for (const k of bfs(m, rows, ep, seed)) s.add(k); }
        return s;
      })();
      check(adjacentWalkable(m, rows, ep, r2, ch.x, ch.y), `cofre ${ch.id} (${ch.x},${ch.y}) alcanzable en ${ep}`);
    }
    // altares y props interactivos
    for (const pr of m.props) {
      if (pr.kind === 'altarEcho') {
        check(adjacentWalkable(m, rows, epoch, reach, pr.x, pr.y), `ALTAR ${pr.id} (${pr.x},${pr.y}) alcanzable en ${epoch}`);
      }
    }
  }
}

// ---------- Diagnóstico específico: la CRIPTA ----------
console.log('\n[cripta · diagnóstico fino bosque→cripta]');
{
  const m = MAPS['bosque'];
  const rows = mapRows(m);
  for (const epoch of ['presente', 'pasado'] as Epoch[]) {
    // BFS desde el sur (entrada de Lunaris) y desde el centro
    const reach = new Set<number>();
    for (const s of [{ x: 27, y: 40 }, { x: 26, y: 24 }]) {
      if (!SOLID_CHARS.has(tileAt(m, rows, s.x, s.y, epoch))) for (const k of bfs(m, rows, epoch, s)) reach.add(k);
    }
    // puerta '=' en (9..11,4) y pasillo ':' (7..13, 2..3)
    const puerta = zoneReachable(m, rows, epoch, reach, { x: 9, y: 4, w: 3, h: 1 });
    const pasillo = zoneReachable(m, rows, epoch, reach, { x: 8, y: 2, w: 5, h: 2 });
    if (epoch === 'pasado') {
      // DISEÑO: el puente y la niebla ceden en el ayer (puzzle de q3, pista
      // brisa_crypt) — en el pasado la puerta DEBE ser alcanzable.
      check(puerta !== null, `puerta de la cripta (9-11,4) alcanzable desde el sur en ${epoch}${puerta ? ` vía (${puerta.x},${puerta.y})` : ' — BLOQUEADA'}`);
      check(pasillo !== null, `zona de salida a la cripta (8-12, 2-3) alcanzable en ${epoch}${pasillo ? ` vía (${pasillo.x},${pasillo.y})` : ' — BLOQUEADA'}`);
    } else {
      // DISEÑO: en el presente el puente está roto y la niebla viva — el norte
      // es del ayer. Debe estar bloqueado (regresión si alguien rompe el puzzle)
      // PERO el corredor de la puerta debe estar libre de pinos en AMBAS épocas.
      check(puerta === null && pasillo === null, `presente: norte del bosque bloqueado por el puzzle del ayer (diseño intacto)`);
    }
    // FIX R18: corredor garantizado sin pinos (x6..15 × y5..9 + ramales y7/y8)
    let pinos = 0;
    for (let y = 5; y <= 9; y++) for (let x = 6; x <= 15; x++) if (tileAt(m, rows, x, y, epoch) === 'p') pinos++;
    for (let x = 16; x <= 22; x++) if (tileAt(m, rows, x, 7, epoch) === 'p') pinos++;
    for (let x = 16; x <= 26; x++) if (tileAt(m, rows, x, 8, epoch) === 'p') pinos++;
    check(pinos === 0, `corredor de la puerta de la cripta libre de pinos en ${epoch} (${pinos} pinos)`);
    // cartel-ayuda junto al vado sur (alcanzable en presente)
    const signo = m.props.find(pr => pr.id === 'sign_b3');
    check(!!signo && adjacentWalkable(m, rows, epoch, reach, signo.x, signo.y), `cartel sign_b3 (${signo?.x},${signo?.y}) legible en ${epoch}`);
    // detalle: ¿qué hay alrededor de la puerta?
    const mapa: string[] = [];
    for (let y = 1; y <= 6; y++) {
      let line = '';
      for (let x = 6; x <= 15; x++) line += tileAt(m, rows, x, y, epoch);
      mapa.push(line);
    }
    console.log(`   mapa 6..15 × 1..6 (${epoch}):\n     ${mapa.join('\n     ')}`);
  }
}

console.log(`\nRESULTADO: ${ok} ok, ${fail} fallos`);
if (fail > 0) process.exit(1);
