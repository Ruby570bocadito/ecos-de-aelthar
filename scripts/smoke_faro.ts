// ============================================================
// 18-e (faro-historia) — Smoke del HUB narrativo del faro
// Stub DOM patrón de las primeras 60 líneas de scripts/smoke_timeskip.ts
// (con canvas GRABADOR para probar determinismo por ops de dibujo):
//  (a) los 3 sprites ('mara_farera', 'uso_faro', 'tina_faro') registrados con
//      9 frames (down/up/side ×3) y determinismo: build ×2 → mismas ops →
//      mismo dataURL; initFaroSprites() idempotente (mismas refs en registro);
//  (b) los 3 NPCs existen en MAPS['costa'].npcs con tiles LIBRES y CADA uno
//      con tile vecino caminable (BFS con SOLID_CHARS sobre mapRows, ambas
//      épocas — patrón scripts/smoke_rutas.ts) + cartel sign_co3;
//  (c) FARO_DIALOGUES: nodos completos (name/portrait/text), sin colisiones
//      con DIALOGUES de data.ts, options/next/onEnd/action sin enlaces rotos
//      (validador contra el mismo whitelist de acciones del motor+hooks) y
//      ruteo faroRouteDialogue: progreso completo del arco y delegación null;
//  (d) installer idempotente + faroTick: pago único (+15 coronas), escucha
//      nocturna una sola vez, guards (día/mapa/época/distancia/desafío).
// Ejecutar: bun scripts/smoke_faro.ts
// ============================================================

// ---------- stub universal (patrón smoke_timeskip/smoke_desafio) ----------
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
const makeCanvas = (): HTMLCanvasElement => {
  return {
    width: 300, height: 150, style: {},
    getContext: (_: string) => stub(),
    addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
  } as unknown as HTMLCanvasElement;
};

/** Canvas grabador: registra los fillRect para que toDataURL() sea
 *  determinista y comparable (dos builds → misma secuencia de ops). */
function recordingCanvas(): HTMLCanvasElement {
  const ops: string[] = [];
  const ctx: AnyP = {
    imageSmoothingEnabled: false,
    fillStyle: '#000',
    fillRect(X: number, Y: number, W: number, H: number) {
      ops.push(`F${X},${Y},${W},${H},${this.fillStyle}`);
    },
  };
  const c: AnyP = {
    width: 0, height: 0,
    getContext: (_: string) => ctx,
    toDataURL: () => `ops|${String(c.width)}x${String(c.height)}|${ops.join(';')}`,
  };
  return c as unknown as HTMLCanvasElement;
}

const g: AnyP = globalThis as unknown as AnyP;
if (typeof (g as { document?: unknown }).document === 'undefined') {
  (g as { document: unknown }).document = {
    createElement: (tag: string) => (tag === 'canvas' ? recordingCanvas() : makeCanvas()),
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
import { SOLID_CHARS, getSpr, registerSpr } from '../src/game/sprites';
import type { MapDef, Epoch } from '../src/game/types';
import { DIALOGUES } from '../src/game/data';
import {
  FARO_DIALOGUES, FARO_PORTRAITS, faroRouteDialogue, faroTick,
  initFaroSprites, buildFaroSprites,
} from '../src/game/faro_historia';
import { audio } from '../src/game/audio';

(audio as unknown as { init: () => void }).init = () => {}; // stub de WebAudio (patrón 13-c)

let ok = 0, fail = 0;
function check(cond: boolean, msg: string) {
  if (cond) { ok++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ FALLO: ${msg}`); }
}

console.log('SMOKE FARO-HISTORIA · 18-e «La lámpara que aprendió a temblar»');

// ============================================================
// (a) SPRITES: 9 frames, tamaños y determinismo build ×2
// ============================================================
console.log('\n[a] sprites del faro (build ×2 → mismo dataURL)');
const build1 = buildFaroSprites();
const build2 = buildFaroSprites();
const SPRITES: [string, number][] = [
  ['mara_farera', 18],   // adulto 16×18
  ['uso_faro', 18],      // adulto 16×18
  ['tina_faro', 15],     // niña (layout small) 16×15
];
for (const [name, h] of SPRITES) {
  const f1 = build1[name], f2 = build2[name];
  check(!!f1 && f1.length === 9, `${name}: 9 frames (down/up/side ×3) — ${f1?.length ?? 0}`);
  let dimsOk = true, detOk = true;
  for (let i = 0; i < (f1?.length ?? 0); i++) {
    const c1 = f1[i] as unknown as { width: number; height: number; toDataURL: () => string };
    const c2 = f2[i] as unknown as { width: number; height: number; toDataURL: () => string };
    if (c1.width !== 16 || c1.height !== h) dimsOk = false;
    if (c1.toDataURL() !== c2.toDataURL()) detOk = false;
  }
  check(dimsOk, `${name}: canvas 16×${h} en los 9 frames`);
  check(detOk, `${name}: determinismo (build ×2 → mismo dataURL)`);
}
initFaroSprites();
const refs1 = SPRITES.map(([n]) => getSpr(n));
initFaroSprites(); // idempotente: no re-registra
const refs2 = SPRITES.map(([n]) => getSpr(n));
check(refs1.every(r => !!r) && refs1.every((r, i) => r === refs2[i]),
  'initFaroSprites() idempotente (mismas refs tras 2 llamadas) y los 3 nombres resueltos por getSpr');
// el registro no pisa sprites existentes
const probe: unknown[] = [];
registerSpr('__probe_18e', probe);
check(getSpr('__probe_18e') === probe, 'registerSpr intacto (contrato con sprites.ts)');

// ============================================================
// (b) NPCs en costa: tiles libres + adyacencia peatonal (BFS × 2 épocas)
// ============================================================
console.log('\n[b] NPCs del faro en MAPS[\'costa\'] + BFS (patrón smoke_rutas)');
const m: MapDef = MAPS['costa'];
const rows = mapRows(m);
const npcById = new Map(m.npcs.map(n => [n.id, n]));
const ESPERADOS: [string, number, number, string, string][] = [
  ['mara', 7, 19, 'mara_farera', 'Mara, la farera'],
  ['uso_faro', 5, 21, 'uso_faro', 'Uso, el farero tuerto'],
  ['tina_faro', 9, 20, 'tina_faro', 'Tina, la niña del faro'],
];
check(m.npcs.length === 4, `costa.npcs = ${m.npcs.length} (mara + uso_faro + tina_faro + vult)`);
// vult sigue en la costa, intacto
check(!!npcById.get('vult') && npcById.get('vult')?.sprite === 'corvin', 'vult (30,32) intacto');

function bfs(epoch: Epoch, from: { x: number; y: number }): Set<number> {
  const seen = new Set<number>();
  const q: { x: number; y: number }[] = [from];
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
function adjacentWalkable(reach: Set<number>, tx: number, ty: number): boolean {
  return ([[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]] as const)
    .some(([dx, dy]) => reach.has((ty + dy) * m.w + (tx + dx)));
}
const SEMILLAS: { x: number; y: number }[] = [{ x: 26, y: 2 }, { x: 22, y: 21 }, { x: 47, y: 18 }];
for (const epoch of ['presente', 'pasado'] as Epoch[]) {
  const reach = new Set<number>();
  for (const s of SEMILLAS) {
    if (!SOLID_CHARS.has(tileAt(m, rows, s.x, s.y, epoch))) for (const k of bfs(epoch, s)) reach.add(k);
  }
  for (const [id, x, y, spr] of ESPERADOS) {
    const n = npcById.get(id);
    check(!!n && n.x === x && n.y === y && n.sprite === spr,
      `[${epoch}] ${id} en (${x},${y}) con sprite '${spr}'`);
    check(!SOLID_CHARS.has(tileAt(m, rows, x, y, epoch)), `[${epoch}] tile de ${id} (${x},${y}) NO sólido`);
    check(adjacentWalkable(reach, x, y), `[${epoch}] ${id} (${x},${y}) con tile vecino caminable (BFS)`);
  }
  // prop decorativo propio: cartel del faro
  const sign = m.props.find(p => p.id === 'sign_co3');
  check(!!sign && adjacentWalkable(reach, sign.x, sign.y),
    `[${epoch}] cartel sign_co3 (${sign?.x},${sign?.y}) legible (BFS)`);
}

// ============================================================
// (c) FARO_DIALOGUES: grafo íntegro + ruteo sin regresiones
// ============================================================
console.log('\n[c] FARO_DIALOGUES (27 nodos) + faroRouteDialogue');
// whitelist = el validador de smoke_acto2 (engine.applyAction + hooks.handleCustomAction)
const ENGINE_ACTIONS = new Set(['accept_q2', 'accept_q3', 'accept_q4', 'accept_q5', 'accept_q6', 'accept_q7',
  'accept_q8', 'accept_q9', 'accept_q10', 'fragment_touched', 'eco_taken', 'eco_mareas_taken', 'eco_cumbres_taken',
  'forge', 'buy_potion', 'recruit_ilwen', 'rest', 'end_demo', 'close', 'fragment', 'buy_sennuelo']);
const HOOKS_EXACT = new Set(['eco_taken_mem', 'mara_met', 'mara_gift', 'mera_eco', 'acto2_report', 'accept_q6',
  'accept_q11', 'acto3_toln', 'acto3_eco1', 'acto3_eco2', 'acto3_eco3', 'acto3_report',
  'accept_q12', 'accept_q13', 'acto3_mera_ayer', 'acto3_rec_mara', 'acto3_rec_ivo', 'acto3_rec_vult',
  'acto3_verdad', 'acto3_silencio', 'acto3_subir', 'acto3_velmora_fn',
  'accept_q14', 'acto4_toln', 'acto4_cam_mera', 'acto4_cam_ivo', 'accept_q15',
  'acto4_guarda', 'acto4_subir', 'acto4_report', 'accept_q16', 'acto4_epilogo']);
const HOOKS_PREFIX = ['memory_', 'rep_', 'flag_'];
const actionHandled = (a: string) =>
  ENGINE_ACTIONS.has(a) || HOOKS_EXACT.has(a) || HOOKS_PREFIX.some(p => a.startsWith(p));

check(Object.keys(FARO_DIALOGUES).length === 27, `FARO_DIALOGUES = ${Object.keys(FARO_DIALOGUES).length} nodos (27 esperados)`);
// R18 POST-INTEGRACIÓN: data.ts ahora fusiona con Object.assign(D, FARO_DIALOGUES)
// (cableado del integrador) → las claves DEBEN existir en DIALOGUES y el
// contenido fusionado debe ser EXACTAMENTE el del módulo (el faro gana el assign).
const colisiones = Object.keys(FARO_DIALOGUES).filter(k => !DIALOGUES[k]);
check(colisiones.length === 0, `todas las claves del faro fusionadas en DIALOGUES (${colisiones.join(',') || '27/27'})`);
const divergentes = Object.keys(FARO_DIALOGUES).filter(k => DIALOGUES[k] !== FARO_DIALOGUES[k]);
check(divergentes.length === 0, `contenido fusionado idéntico al módulo (${divergentes.join(',') || 'sin divergencias'})`);

const MERGED = { ...DIALOGUES, ...FARO_DIALOGUES };
let enlacesRotos = 0, nodosIncompletos = 0;
for (const [key, node] of Object.entries(FARO_DIALOGUES)) {
  if (!node.name || !node.text || !node.portrait) { nodosIncompletos++; fail++; console.log(`  ✗ nodo ${key} sin name/portrait/text`); }
  if (!MERGED[key]) { enlacesRotos++; continue; }
  for (const o of node.options ?? []) {
    if (o.next && !MERGED[o.next]) { enlacesRotos++; fail++; console.log(`  ✗ ${key}: option.next → '${o.next}' NO EXISTE`); }
    if (o.action && !actionHandled(o.action)) { enlacesRotos++; fail++; console.log(`  ✗ ${key}: option.action → '${o.action}' sin handler`); }
    if (o.tone && !['empatico', 'pragmatico', 'sarcastico', 'amenazante'].includes(o.tone)) { enlacesRotos++; fail++; console.log(`  ✗ ${key}: tone '${o.tone}' inválido`); }
  }
  if (node.next && !MERGED[node.next]) { enlacesRotos++; fail++; console.log(`  ✗ ${key}: next → '${node.next}' NO EXISTE`); }
  if (node.onEnd && !actionHandled(node.onEnd)) { enlacesRotos++; fail++; console.log(`  ✗ ${key}: onEnd → '${node.onEnd}' sin handler`); }
  if (node.action && !actionHandled(node.action)) { enlacesRotos++; fail++; console.log(`  ✗ ${key}: action → '${node.action}' sin handler`); }
}
check(nodosIncompletos === 0 && enlacesRotos === 0, `27 nodos completos (name/portrait/text) y sin enlaces rotos ni acciones sin handler`);

// retratos: estructura completa para drawPortrait (kind 'human' + campos base)
for (const [k, p] of Object.entries(FARO_PORTRAITS)) {
  const base = p.kind === 'human' && !!p.bg && !!p.skin && !!p.skinS && !!p.hair && !!p.eye && !!p.cloth && !!p.clothS;
  check(base, `FARO_PORTRAITS['${k}'] compatible con PortraitDef/drawPortrait (28×40, kind 'human')`);
}

// --- ruteo: delegación y estados de protección (regresión 0) ---
type Ctx = { questIdx: number; questStep: number; flags: Record<string, number | boolean>; companion: boolean };
const ctx = (q: number, s: number, flags: Record<string, number | boolean> = {}): Ctx => ({ questIdx: q, questStep: s, flags, companion: false });
check(faroRouteDialogue('vult', ctx(6, 0)) === null, 'vult → null (delega en data.ts, regresión 0)');
check(faroRouteDialogue('mara', ctx(5, 0)) === null, 'mara en q6 → null (mara_intro intocable)');
check(faroRouteDialogue('mara', ctx(6, 0, { sirenaDefeated: true })) === null, 'mara post-Sirena sin faro encendido → null (mara_react)');
check(faroRouteDialogue('mara', ctx(10, 1)) === null, 'mara q11 s1 → null (acto3_eco_mara)');
check(faroRouteDialogue('mara', ctx(11, 0)) === null, 'mara q12 → null (acto3_mara_ayer)');

// --- progreso completo del arco (simulador mínimo de talkTo/advanceDialogue) ---
function talk(nid: string, optIdx: number, flags: Record<string, number | boolean>, ruta: string[]): void {
  let key = faroRouteDialogue(nid, ctx(6, 0, flags));
  let guard = 0;
  while (key && guard++ < 30) {
    ruta.push(`${nid}:${key}`);
    const node = FARO_DIALOGUES[key];
    if (!node) { ruta.push('¡NODO INEXISTENTE!'); return; }
    if (node.onEnd) flags[node.onEnd.slice(5)] = true; // patrón 'flag_<clave>' de hooks
    let next: string | undefined;
    const opt = node.options?.[optIdx];
    if (opt) {
      if (opt.action === 'flag_faro_escucha') flags.faro_escucha = true;
      next = opt.next;                                   // engine: openDialogue(opt.next)
    } else {
      next = node.next;
    }
    key = next;
  }
}
// Recorrido narrativo real: hablar con USO (cadena completa) → TINA → MARA
// (u1/t1 → o1 → o2 pide la noche → re-hablar c1 cuenta → fin paga)
{
  const flags: Record<string, number | boolean> = {};
  const ruta: string[] = [];
  talk('uso_faro', 0, flags, ruta);
  check(!!flags.faro_uso_hablado, `hablar con Uso fija faro_uso_hablado (${ruta[ruta.length - 1]})`);
  talk('tina_faro', 0, flags, ruta);
  check(!!flags.faro_tina_hablado, 'hablar con Tina fija faro_tina_hablado');
  talk('mara', 0, flags, ruta);   // u1→u2 (manda a Uso)
  talk('mara', 0, flags, ruta);   // t1→t2 (manda a Tina)
  talk('mara', 0, flags, ruta);   // o1→o2 (la petición, faro_escuchaPendiente)
  check(!!flags.faro_escuchaPendiente, 'la petición de Mara fija faro_escuchaPendiente');
  talk('mara', 0, flags, ruta);   // c1 (cuenta lo oído) → fin (recompensa)
  check(!!flags.faro_escucha && !!flags.faro_recompensa,
    `arco completo por diálogo: escucha=${!!flags.faro_escucha} recompensa=${!!flags.faro_recompensa}`);
  check(faroRouteDialogue('mara', ctx(6, 0, flags)) === null,
    `arco cerrado: Mara vuelve a sus rutas originales (pasos mara: ${ruta.filter(r => r.startsWith('mara')).join(' · ')})`);
  check(ruta.some(r => r.endsWith(':faro_mara_fin')), 'el cierre pasa por el nodo de recompensa faro_mara_fin');
  // orden libre: Tina primero, Uso después — el arco también se cierra
  const flags2: Record<string, number | boolean> = {};
  const ruta2: string[] = [];
  talk('tina_faro', 0, flags2, ruta2);
  talk('uso_faro', 0, flags2, ruta2);
  check(faroRouteDialogue('mara', ctx(6, 0, flags2)) === 'faro_mara_o1',
    'orden libre (Tina→Uso): Mara pasa directo a la petición (o1)');
  talk('mara', 0, flags2, ruta2);  // o1→o2 (la petición)
  check(faroRouteDialogue('mara', ctx(6, 0, flags2)) === 'faro_mara_c1',
    'tras la petición (pendiente) → faro_mara_c1 (cuenta lo oído)');
}
// vía del tick: escucha nocturna ANTES de hablar → va directo a fin tras u1/t1
{
  const flags: Record<string, number | boolean> = { faro_uso_hablado: true, faro_tina_hablado: true, faro_escucha: true };
  const k1 = faroRouteDialogue('mara', ctx(6, 0, flags));
  check(k1 === 'faro_mara_fin', `escucha vía faroTick → faro_mara_fin directamente (${k1})`);
  const k2 = faroRouteDialogue('mara', ctx(6, 0, { ...flags, ecoMareas: true }));
  check(k2 === 'faro_mara_fin_eco', `con ecoMareas → variante faro_mara_fin_eco (${k2})`);
}
// NPCs nuevos: intro → idle
check(faroRouteDialogue('uso_faro', ctx(6, 0)) === 'faro_uso_1', 'uso_faro sin hablar → faro_uso_1');
check(faroRouteDialogue('uso_faro', ctx(6, 0, { faro_uso_hablado: true })) === 'faro_uso_id', 'uso_faro tras arco → faro_uso_id');
check(faroRouteDialogue('uso_faro', ctx(6, 0, { faro_uso_hablado: true, tonoDominante: 'empatico' as unknown as number })) === 'faro_uso_id_emp', 'uso_faro tono empático dominante → faro_uso_id_emp');
check(faroRouteDialogue('tina_faro', ctx(6, 0)) === 'faro_tina_1', 'tina_faro sin hablar → faro_tina_1');
check(faroRouteDialogue('tina_faro', ctx(6, 0, { faro_tina_hablado: true })) === 'faro_tina_id', 'tina_faro tras arco → faro_tina_id');
check(faroRouteDialogue('tina_faro', ctx(6, 0, { faro_tina_hablado: true, faro_escucha: true })) === 'faro_tina_feliz', 'tina_faro tras escuchar → faro_tina_feliz');

// ============================================================
// (d) installer idempotente + faroTick (pago único + escucha nocturna)
// ============================================================
console.log('\n[d] faroTick: recompensa +15 y escucha nocturna idempotentes');
interface FakeG {
  player: { x: number; y: number; gold: number } | null;
  mapId: string; epoch: string; state: string; challengeRun: unknown; dayT: number;
  flags: Record<string, number | boolean>;
  stats: { coronasGanadas: number };
  toasts: string[]; bursts: number; floats: number;
  toast(t: string): void; burst(): void; floatAt(): void;
}
function fakeG(over: Partial<FakeG> = {}): FakeG {
  const gg: FakeG = {
    player: { x: 6 * 16 + 8, y: 18 * 16 + 8, gold: 10 },
    mapId: 'costa', epoch: 'presente', state: 'play', challengeRun: null, dayT: 0.9,
    flags: {}, stats: { coronasGanadas: 0 },
    toasts: [], bursts: 0, floats: 0,
    toast(t: string) { gg.toasts.push(t); }, burst() { gg.bursts++; }, floatAt() { gg.floats++; },
  };
  return Object.assign(gg, over);
}
// 1) escucha nocturna: noche + costa + presente + junto al faro
{
  const gg = fakeG();
  faroTick(gg as never);
  check(gg.flags.faro_escucha === true && gg.bursts === 1, `noche junto al faro → faro_escucha + ráfaga (toasts: ${gg.toasts.length})`);
  faroTick(gg as never);
  check(gg.bursts === 1 && gg.flags.faro_escucha === true, '2º tick idempotente (no repite ráfaga ni toast)');
}
// 2) guards: de día / otro mapa / pasado / lejos / desafío
{
  const dia = fakeG({ dayT: 0.5 }); faroTick(dia as never);
  check(dia.flags.faro_escucha === undefined, 'guard día (dayT 0.5): faro_escucha NO se activa');
  const otro = fakeG({ mapId: 'lunaris' }); faroTick(otro as never);
  check(otro.flags.faro_escucha === undefined, 'guard mapa (lunaris): NO se activa');
  const pasado = fakeG({ epoch: 'pasado' }); faroTick(pasado as never);
  check(pasado.flags.faro_escucha === undefined, 'guard época (pasado): NO se activa');
  const lejos = fakeG({ player: { x: 400, y: 100, gold: 0 } }); faroTick(lejos as never);
  check(lejos.flags.faro_escucha === undefined, 'guard distancia (>2.6 tiles): NO se activa');
  const desafio = fakeG({ challengeRun: {} }); faroTick(desafio as never);
  check(desafio.flags.faro_escucha === undefined && desafio.toasts.length === 0, 'guard desafío: NO se activa');
  const sinP = fakeG({ player: null }); faroTick(sinP as never);
  check(sinP.flags.faro_escucha === undefined, 'guard sin jugador: no lanza');
}
// 3) pago único de la recompensa
{
  const gg = fakeG({ flags: { faro_recompensa: true } });
  faroTick(gg as never);
  check(gg.player!.gold === 25 && gg.flags.faro_pagada === true && gg.stats.coronasGanadas === 15,
    `pago: oro 10→${gg.player!.gold}, faro_pagada=${!!gg.flags.faro_pagada}, stats.coronasGanadas=${gg.stats.coronasGanadas}`);
  faroTick(gg as never);
  check(gg.player!.gold === 25, '2º tick: SIN doble pago (anti-doble con faro_pagada)');
}
// 4) pago sobrevive a la recarga (flags persisten, estado del módulo no)
{
  const gg = fakeG({ flags: { faro_recompensa: true, faro_pagada: true } });
  faroTick(gg as never);
  check(gg.player!.gold === 10, 'recarga con faro_pagada ya en save → NO vuelve a pagar');
}

// ============================================================
console.log(`\nRESULTADO: ${ok} ok, ${fail} fallos`);
if (fail > 0) process.exit(1);
