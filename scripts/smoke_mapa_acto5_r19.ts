// ============================================================
// 19-g — SMOKE del mapa «Ciudadela de Vesh» (maps_acto5_r19.ts)
// Sin navegador y sin stubs DOM (el módulo solo importa types +
// maps_expansion; Game entra como import type = borrado).
// Checks:
//  (1) builder determinista: 2 llamadas → mismo raster
//  (2) dimensiones 54×44, todas las filas iguales de largas, paleta
//      de chars ya dibujados por el motor
//  (3) BFS COMPLETO desde la llegada sur (27,41): cero islas y todos
//      los puntos clave alcanzables (3 sellos, 2 santuarios, jefe,
//      3 cofres, exit, npc, altar, gate, carteles, llegadas)
//  (4) spawns de enemigos: tiles transitables, sin solape (≥3 tiles
//      entre ellos y vs npcs/props)
//  (5) MapDef coherente (id/dark/música/epochDiffs/rows)
//  (6) no bloqueo: la puerta 'acto5_puerta' NO encierra nada — BFS
//      tratando como intransitables los tiles a ≤1.5 tiles del gate:
//      sellos/santuarios/cofres 1-2/npc/exit siguen alcanzables y la
//      sala del jefe queda INALCANZABLE (la puerta guarda de verdad)
//  (7) bounds de exits/npcs/props/chests/echoes/spawns
//  (8) instalarMapaActo5R19 idempotente (2 llamadas, misma referencia)
//  (9) ciudadelaGateTickR19 con Game stub: empuje + toast cada 3 s,
//      silencio con flag, early-outs
// Ejecutar: bun scripts/smoke_mapa_acto5_r19.ts
// ============================================================

import {
  buildCiudadelaR19, ACTO5_MAP_DEF_R19, ACTO5_MAP_ID,
  instalarMapaActo5R19, ciudadelaGateTickR19,
} from '../src/game/maps_acto5_r19';
import type { Game } from '../src/game/engine';
import { EXPANSION_MAPS } from '../src/game/maps_expansion';

// ---------- helpers ----------

let fails = 0, oks = 0;
function check(cond: boolean, msg: string): void {
  if (cond) { oks++; console.log(`  ✓ ${msg}`); }
  else { fails++; console.error(`  ✗ ${msg}`); }
}

// Copia exacta de SOLID_CHARS (sprites.ts:1595) — el smoke no importa
// sprites.ts como valor para no arrastrar el registro de sprites.
const SOLID = new Set(['t', 'p', '#', 'H', 'r', 'F', 'R', 'w', 'g', 'P', 'A', 'V', '~', 'd', 'x', 'n']);

const rows1 = buildCiudadelaR19();
const W = 54, H = 44;
const at = (x: number, y: number): string => rows1[y][x];
const walkable = (x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < W && y < H && !SOLID.has(rows1[y][x]);

function bfs(sx: number, sy: number, blocked: (x: number, y: number) => boolean): Set<number> {
  const seen = new Set<number>();
  if (!walkable(sx, sy) || blocked(sx, sy)) return seen;
  const q: [number, number][] = [[sx, sy]];
  seen.add(sy * W + sx);
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (seen.has(ny * W + nx)) continue;
      if (!walkable(nx, ny) || blocked(nx, ny)) continue;
      seen.add(ny * W + nx);
      q.push([nx, ny]);
    }
  }
  return seen;
}

// ---------- (1) determinismo ----------

console.log('· (1) builder determinista');
const rows2 = buildCiudadelaR19();
check(rows1.join('|') === rows2.join('|'), '2 llamadas → mismo raster');
check(ACTO5_MAP_DEF_R19.rows.join('|') === rows1.join('|'), 'MapDef.rows === builder()');

// ---------- (2) dimensiones + paleta ----------

console.log('· (2) dimensiones y paleta');
check(rows1.length === H, `44 filas (${rows1.length})`);
check(rows1.every(r => r.length === W), 'todas las filas miden 54');
const PALETA = new Set(['#', 'V', 'P', 'R', 'r', ':', '=']); // todos dibujados (drawTile/paintStone/paintVillage)
let desconocidos = 0;
for (const r of rows1) for (const ch of r) if (!PALETA.has(ch)) desconocidos++;
check(desconocidos === 0, `solo chars ya dibujados por el motor (${desconocidos} ajenos)`);

// ---------- (3) BFS completo desde la llegada sur ----------

console.log('· (3) BFS completo desde (27,41)');
check(walkable(27, 41), 'llegada sur (27,41) pisable (explanada)');
const full = bfs(27, 41, () => false);
let totWalk = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walkable(x, y)) totWalk++;
check(full.size === totWalk, `cero islas: ${full.size}/${totWalk} tiles pisables alcanzables`);
const CLAVES: [number, number, string][] = [
  [12, 39, 'sello acto5_s1 (anteportón)'],
  [41, 31, 'sello acto5_s2 (coro)'],
  [4, 26, 'sello acto5_s3 (capilla oeste)'],
  [42, 38, 'santuario anteportón'],
  [6, 30, 'santuario capilla oeste'],
  [27, 10, 'spawn jefe vesh'],
  [9, 36, 'cofre c1 (80)'],
  [48, 27, 'cofre c2 (120+poción)'],
  [21, 8, 'cofre c3 (200)'],
  [27, 42, 'zona de exit sur'],
  [30, 39, 'NPC Eco Guía'],
  [27, 7, 'altar vacío'],
  [26, 22, 'prop gate acto5_puerta'],
  [18, 37, 'estatua 1'],
  [35, 37, 'estatua 2'],
  [32, 41, 'cartel entrada'],
  [24, 24, 'cartel puerta'],
  [19, 24, 'aterrizaje sanctuaryPos por defecto'],
];
for (const [x, y, name] of CLAVES) check(full.has(y * W + x), `alcanzable: ${name} (${x},${y})`);

// ---------- (4) spawns ----------

console.log('· (4) spawns de enemigos');
const spawns = ACTO5_MAP_DEF_R19.spawns;
check(spawns.length === 8, `8 spawns (3 eco anteportón + 2 vigía + 2 eco coro + jefe) (${spawns.length})`);
const pos = spawns.map(s => [s.x, s.y] as [number, number]);
check(pos.every(([x, y]) => walkable(x, y)), 'todos los spawns en tile transitable');
check(!pos.some(([x, y]) => x >= 25 && x <= 28 && y >= 42 && y <= 43), 'ningún spawn sobre la zona de exit');
let minDist = Infinity, minPair = '';
for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
  const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]);
  if (d < minDist) { minDist = d; minPair = `(${pos[i][0]},${pos[i][1]})-(${pos[j][0]},${pos[j][1]})`; }
}
check(minDist >= 3, `spawns separados ≥3 (mín ${minDist.toFixed(2)} entre ${minPair})`);
const npc = ACTO5_MAP_DEF_R19.npcs[0];
let minNpc = Infinity;
for (const [x, y] of pos) minNpc = Math.min(minNpc, Math.hypot(x - npc.x, y - npc.y));
check(minNpc >= 3, `spawns vs NPC ≥3 (mín ${minNpc.toFixed(2)})`);
let minProp = Infinity, minPropName = '';
for (const [x, y] of pos) for (const pr of ACTO5_MAP_DEF_R19.props) {
  const d = Math.hypot(x - pr.x, y - pr.y);
  if (d < minProp) { minProp = d; minPropName = pr.id; }
}
check(minProp >= 3, `spawns vs props ≥3 (mín ${minProp.toFixed(2)} vs ${minPropName})`);

// ---------- (5) MapDef coherente ----------

console.log('· (5) MapDef');
check(ACTO5_MAP_DEF_R19.id === 'ciudadela', `id 'ciudadela' (${String(ACTO5_MAP_DEF_R19.id)})`);
check(ACTO5_MAP_DEF_R19.name === 'Ciudadela de Vesh', 'name');
check(ACTO5_MAP_DEF_R19.subtitle === 'Donde el canto se hizo silencio', 'subtitle');
check(ACTO5_MAP_DEF_R19.w === W && ACTO5_MAP_DEF_R19.h === H, 'w/h 54×44');
check(ACTO5_MAP_DEF_R19.dark === true, 'dark: true');
check(ACTO5_MAP_DEF_R19.music === 'crypt', `música 'crypt' (existente en TrackName) (${ACTO5_MAP_DEF_R19.music})`);
check(ACTO5_MAP_DEF_R19.epochDiffs.length === 0, 'epochDiffs vacío');
const props = ACTO5_MAP_DEF_R19.props;
check(props.filter(p => p.id === 'acto5_s1' || p.id === 'acto5_s2' || p.id === 'acto5_s3').length === 3, '3 sellos acto5_s1..s3');
check(props.filter(p => p.kind === 'fragment').length === 3, 'los 3 sellos son kind fragment');
check(props.filter(p => p.kind === 'sanctuary').length === 2, '2 santuarios');
check(props.filter(p => p.id === 'acto5_puerta' && p.kind === 'gate').length === 1, "1 gate 'acto5_puerta'");
check(props.filter(p => p.kind === 'sign').length === 4, '4 sign (2 estatuas + 2 carteles)');
check(ACTO5_MAP_DEF_R19.chests.length === 3, '3 cofres');
check(ACTO5_MAP_DEF_R19.chests.some(c => c.gold === 80) && ACTO5_MAP_DEF_R19.chests.some(c => c.gold === 120) && ACTO5_MAP_DEF_R19.chests.some(c => c.gold === 200), 'oro 80/120/200');
check(ACTO5_MAP_DEF_R19.chests.some(c => (c.potions ?? 0) >= 1), '1 cofre con poción');
check(ACTO5_MAP_DEF_R19.echoes.length === 2, '2 ecos menores');
check(ACTO5_MAP_DEF_R19.npcs.length === 1 && ACTO5_MAP_DEF_R19.npcs[0].id === 'eco_guia' && ACTO5_MAP_DEF_R19.npcs[0].sprite === 'wisp', "NPC 'eco_guia' sprite 'wisp'");
const boss = spawns.find(s => s.zone === 'boss');
check(!!boss && boss.x === 27 && boss.y === 10, 'jefe en (27,10) zone boss');
check(props.some(p => p.id === 'acto5_puerta' && p.x === 26 && p.y === 22), "gate en (26,22) delante de la sala del jefe");

// ---------- (6) la puerta no encierra nada ----------

console.log('· (6) no bloqueo por la puerta (BFS sin radio del gate)');
const GATE_X = 26, GATE_Y = 22;
const gx = GATE_X * 16 + 8, gy = GATE_Y * 16 + 8;
const blocked = (x: number, y: number): boolean => Math.hypot(x * 16 + 8 - gx, y * 16 + 8 - gy) <= 24; // 1.5 tiles
const sinPuerta = bfs(27, 41, blocked);
const alcance = (x: number, y: number): boolean => sinPuerta.has(y * W + x);
check(alcance(12, 39) && alcance(41, 31) && alcance(4, 26), 'los 3 sellos siguen alcanzables sin cruzar la puerta');
check(alcance(42, 38) && alcance(6, 30), 'los 2 santuarios siguen alcanzables sin cruzar la puerta');
check(alcance(9, 36) && alcance(48, 27) && alcance(30, 39) && alcance(27, 42), 'cofres c1/c2, NPC y exit alcanzables sin cruzar la puerta');
check(!alcance(27, 10), 'la sala del jefe (27,10) queda INALCANZABLE sin cruzar el radio del gate');
check(!alcance(21, 8), 'c3 (200) queda tras la puerta (por diseño)');
// radio del gate cubre TODO el hueco de la puerta (x26..27, y21..22):
const hueco: [number, number][] = [[26, 21], [27, 21], [26, 22], [27, 22]];
check(hueco.every(([x, y]) => blocked(x, y)), 'el radio de 1.5 tiles cubre las 4 casillas del hueco de la puerta');

// ---------- (7) bounds ----------

console.log('· (7) bounds de entidades');
const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
check(ACTO5_MAP_DEF_R19.exits.every(e => inBounds(e.x, e.y) && inBounds(e.x + e.w - 1, e.y + e.h - 1)), 'exits dentro de bounds');
check(ACTO5_MAP_DEF_R19.exits.every(e => e.to === 'cripta' && e.tx === 20 && e.ty === 30), "exit único → cripta (20,30) legal y sin bucle");
check(ACTO5_MAP_DEF_R19.npcs.every(n => inBounds(n.x, n.y) && walkable(n.x, n.y)), 'npcs en bounds y pisables');
check(props.every(p => inBounds(p.x, p.y) && walkable(p.x, p.y)), 'props en bounds y pisables');
check(ACTO5_MAP_DEF_R19.chests.every(c => inBounds(c.x, c.y) && walkable(c.x, c.y)), 'cofres en bounds y pisables');
check(ACTO5_MAP_DEF_R19.echoes.every(e => inBounds(e.x, e.y) && walkable(e.x, e.y)), 'ecos en bounds y pisables');
check(spawns.every(s => inBounds(s.x, s.y)), 'spawns en bounds');
// el aterrizaje en cripta (20,30) debe ser pisable en el raster REAL de cripta
// y NO estar en su zona de salida al Bosque {x:18,y:31,w:4,h:3}
const { MAPS } = await import('../src/game/maps');
const criptaRows = MAPS.cripta.rows;
check(!SOLID.has(criptaRows[30][20]), 'aterrizaje cripta (20,30) pisable en buildCripta');
check(!(20 >= 18 && 20 < 22 && 30 >= 31 && 30 < 34), '(20,30) fuera de la zona de salida cripta→bosque (sin bucle)');

// ---------- (8) instalación idempotente ----------

console.log('· (8) instalarMapaActo5R19');
instalarMapaActo5R19();
const ref1 = (EXPANSION_MAPS as unknown as Record<string, unknown>)['ciudadela'];
instalarMapaActo5R19();
const ref2 = (EXPANSION_MAPS as unknown as Record<string, unknown>)['ciudadela'];
check(ref1 === ACTO5_MAP_DEF_R19 && ref2 === ACTO5_MAP_DEF_R19, 'EXPANSION_MAPS[ciudadela] === MapDef tras 2 llamadas (guard idempotente)');

// ---------- (9) tick de la puerta con Game stub ----------

console.log('· (9) ciudadelaGateTickR19 (stub de Game)');
interface Stub {
  mapId: string; state: string; globalT: number;
  flags: Record<string, number | boolean>;
  map: typeof ACTO5_MAP_DEF_R19; toasts: string[];
  toast(text: string, color?: string): void;
  player: { x: number; y: number; vx: number; vy: number; dead: boolean };
}
const mkStub = (px: number, py: number, sellos = false, mapId = 'ciudadela'): Stub => ({
  mapId, state: 'play', globalT: 0,
  flags: sellos ? { acto5_sellos_3: true } : {},
  map: ACTO5_MAP_DEF_R19, toasts: [],
  toast(text: string) { this.toasts.push(text); },
  player: { x: px, y: py, vx: 1, vy: -1, dead: false },
});
const tick = (g: Stub): void => ciudadelaGateTickR19(g as unknown as Game);

// A: jugador 1 tile al sur del gate (26,23) → empuje a (26,24) + 1 toast
const a = mkStub(26 * 16 + 8, 23 * 16 + 8);
tick(a);
check(a.player.x === 26 * 16 + 8 && a.player.y === 24 * 16 + 8, `empuje 1 tile atrás: (${a.player.x},${a.player.y})`);
check(a.player.vx === 0 && a.player.vy === 0, 'velocidad anulada en el empuje');
check(a.toasts.length === 1 && a.toasts[0] === 'La puerta no canta aún: faltan sellos', 'toast exacto de la puerta');
// B: anti-spam — 60 reintentos con el reloj congelado → NO repite toast
for (let i = 0; i < 60; i++) { a.player.y = 23 * 16 + 8; tick(a); }
check(a.toasts.length === 1, `anti-spam: 60 reintentos con globalT congelado → 1 toast (${a.toasts.length})`);
// C: pasan 3.1 s → vuelve a avisar (y empujar)
a.globalT = 3.1; a.player.y = 23 * 16 + 8; tick(a);
check(a.toasts.length === 2 && a.player.y === 24 * 16 + 8, 'toast cada 3 s: segundo aviso a los 3.1 s');
// D: con la flag acto5_sellos_3 → puerta abierta, ni empuje ni toast
const d = mkStub(26 * 16 + 8, 23 * 16 + 8, true);
tick(d);
check(d.player.y === 23 * 16 + 8 && d.toasts.length === 0, 'con acto5_sellos_3: no empuja ni avisa');
// E: jugador lejos → nada
const e = mkStub(10 * 16 + 8, 38 * 16 + 8);
tick(e);
check(e.player.x === 10 * 16 + 8 && e.player.y === 38 * 16 + 8 && e.toasts.length === 0, 'jugador lejos del gate: nada');
// F: convergencia desde dentro del hueco (27,21) → (27,22) → (27,23) → (27,24)
const f = mkStub(27 * 16 + 8, 21 * 16 + 8);
for (let i = 0; i < 4; i++) { f.globalT += 3.2; tick(f); }
check(f.player.y === 24 * 16 + 8, `empuje converge hacia el sur desde el hueco (${f.player.y})`);
// G: mapa ajeno → early-out
const g2 = mkStub(26 * 16 + 8, 23 * 16 + 8, false, 'cripta');
tick(g2);
check(g2.player.y === 23 * 16 + 8 && g2.toasts.length === 0, 'early-out fuera de la ciudadela');

// ---------- resumen ----------

console.log('');
if (fails === 0) {
  console.log(`SMOKE MAPA ACTO5: TODO OK (${oks} checks)`);
} else {
  console.error(`SMOKE MAPA ACTO5: ${fails} FALLOS / ${oks} ok`);
  process.exit(1);
}
