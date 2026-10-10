// Diagnóstico puntual: frontera del BFS hacia la puerta de la cripta (presente)
import { MAPS, mapRows, tileAt } from '../src/game/maps';
import { SOLID_CHARS } from '../src/game/sprites';

const m = MAPS['bosque'];
const rows = mapRows(m);
const ep = 'presente' as const;

const reach = new Set<number>();
const q: [number, number][] = [];
// semilla: lado sur del muro de la puerta, tile abierto (10,5)
q.push([10, 5]); reach.add(5 * m.w + 10);
while (q.length) {
  const [x, y] = q.pop()!;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
    const k = ny * m.w + nx;
    if (reach.has(k)) continue;
    if (SOLID_CHARS.has(tileAt(m, rows, nx, ny, ep))) continue;
    reach.add(k); q.push([nx, ny]);
  }
}
// ¿algún tile de la puerta (9-11,4) es adyacente-caminable desde reach? (debe: la puerta '=' es caminable, pero reach parte de (10,5) SIN cruzar el muro y=4)
// imprimir x6..30, y4..14, '·' = alcanzable, letra = tile
let line10 = '';
for (let y = 4; y <= 14; y++) {
  let line = '';
  for (let x = 6; x <= 30; x++) {
    const t = tileAt(m, rows, x, y, ep);
    line += reach.has(y * m.w + x) ? '·' : t;
  }
  line10 += `y${String(y).padStart(2)} ${line}\n`;
}
console.log(`x→  ${'6         16        26'.padEnd(30)}`);
console.log(line10);
console.log('pines adyacentes al hueco (10,5):');
for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
  console.log(`  (${10+dx},${5+dy}) = '${tileAt(m, rows, 10+dx, 5+dy, ep)}'`);
}
