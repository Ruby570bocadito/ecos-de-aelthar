import { MAPS, mapRows } from "../src/game/maps";
// Validación R10: invariantes de mapas tras la ronda
let fails = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.log('  ✗ ' + msg); fails++; } else console.log('  ✓ ' + msg);
}

const SOLID = new Set(['t', 'p', '#', 'H', 'r', 'F', 'R', 'w', 'g', 'P', 'A', 'V', '~', 'd', 'x', 'n']);

for (const id of ['lunaris', 'bosque', 'cripta', 'costa', 'aldea', 'cumbres', 'interior_anciana', 'interior_tienda', 'interior_taberna'] as const) {
  const m: any = (MAPS as any)[id];
  const rows = mapRows(m);
  ok(rows.length === m.h && rows.every((r: string) => r.length === m.w), `${id}: filas ${rows.length}×${rows[0]?.length} = ${m.w}×${m.h}`);
  for (const ex of m.exits) {
    const t = rows[ex.y]?.[ex.x];
    if (!SOLID.has(t ?? '#')) ok(true, `${id}: salida (${ex.x},${ex.y}→${ex.to}) transitable ('${t}')`);
    else ok(ex.needPast === true || ex.needPresent === true, `${id}: salida (${ex.x},${ex.y}→${ex.to}) sólida pero con gate de época ('${t}')`);
  }
}

// cripta: chars nuevos presentes y en secciones
const cr = mapRows((MAPS as any).cripta);
const flat = cr.join('');
ok((flat.match(/\^/g) ?? []).length >= 40, `cripta: pinchos '^' = ${(flat.match(/\^/g) ?? []).length}`);
ok((flat.match(/L/g) ?? []).length === 4, `cripta: palancas 'L' = ${(flat.match(/L/g) ?? []).length}`);
ok((flat.match(/D/g) ?? []).length >= 2, `cripta: puerta 'D' = ${(flat.match(/D/g) ?? []).length}`);
ok((MAPS as any).cripta.spawns.some((s: any) => s.type === 'sepulcro' && s.zone === 'antesala'), 'cripta: sepulcro zone antesala');
ok((MAPS as any).cripta.spawns.filter((s: any) => s.zone === 'boss').length === 1, 'cripta: UN solo spawn boss (guardián intacto)');

// taberna: puerta y retorno transitables EN PASADO (epochDiffs aplicados)
import { lorePropsForMap } from '../src/game/world/props';
const aldeaAny: any = (MAPS as any).aldea;
const alRowsPas = mapRows(aldeaAny).map((r: string, y: number) => {
  let row = r.split('');
  for (const d of (aldeaAny.epochDiffs ?? []) as any[]) {
    if (d.epoch === 'pasado' && d.y === y) for (const c of (d.cells ?? []) as any[]) row[c[0]] = c[1];
  }
  return row.join('');
});
ok(!SOLID.has(alRowsPas[8]?.[9] ?? '#'), `aldea PASADO: (9,8) puerta taberna transitable ('${alRowsPas[8]?.[9]}')`);
const vecinosAldea = [[8, 8], [10, 8], [9, 9]].filter(([x, y]) => !SOLID.has(alRowsPas[y]?.[x] ?? '#'));
ok(vecinosAldea.length >= 1, `aldea PASADO: (9,8) con escapatoria caminable (${vecinosAldea.map(v => `(${v[0]},${v[1]})`).join(' ')})`);

// lunaris: puertas de interiores transitables
const luRows = mapRows((MAPS as any).lunaris);
ok(!SOLID.has(luRows[11]?.[9] ?? '#'), `lunaris: (9,11) casa anciana transitable ('${luRows[11]?.[9]}')`);
ok(!SOLID.has(luRows[29]?.[9] ?? '#'), `lunaris: (9,29) tienda transitable ('${luRows[29]?.[9]}')`);

// interiores: door 'd' presente y NPC dentro
for (const iid of ['interior_anciana', 'interior_tienda', 'interior_taberna'] as const) {
  const m: any = (MAPS as any)[iid];
  const r = mapRows(m);
  ok(r.some((row: string) => row.includes('d')), `${iid}: puerta 'd' presente`);
  ok((m.npcs?.length ?? 0) >= 1, `${iid}: NPC interior presente`);
}

// lore props: la siembra vive en engine.ts (ciclo evitado) → verificar con lorePropsForMap
let lore = 0;
for (const m of Object.values(MAPS) as any[]) {
  if (String(m.rows ? '' : '') === 'never') break;
  lore += lorePropsForMap(m).length;
}
ok(lore >= 60, `lore props generados para el mundo = ${lore}`);

console.log(fails === 0 ? 'VALIDACIÓN R10: ✓ TODO VERDE' : `VALIDACIÓN R10: ✗ ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
