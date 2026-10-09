// ============================================================
// ECOS DE AELTHAR — Mapas del mundo
// Valle de Lunaris · Bosque Susurrante · Cripta del Primer Canto
// Generación determinista (sin azar de ejecución)
// R10-1 (épicas 6.2/6.4): lunaris y bosque ampliados POR ZONAS (claro del
// Eco + cuecos · santuario caído del Círculo) y cripta rediseñada como
// mazmorra tipo Zelda por SECCIONES (pinchos '^', palancas 'L', puerta 'D'
// — contrato completo documentado sobre buildCripta).
// ============================================================

import type { MapDef, MapId, EpochDiff, Epoch } from './types';
import { EXPANSION_MAPS } from './maps_expansion';
import { INTERIOR_MAPS, INTERIOR_MAP_IDS } from './maps_interiores'; // R10-5: interiores de casas

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Grid = string[][];

function grid(w: number, h: number, fill: string): Grid {
  const g: Grid = [];
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) row.push(fill);
    g.push(row);
  }
  return g;
}

function set(g: Grid, x: number, y: number, ch: string) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
}

function rect(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, ch);
}

function rectOutline(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let i = x; i < x + w; i++) { set(g, i, y, ch); set(g, i, y + h - 1, ch); }
  for (let j = y; j < y + h; j++) { set(g, x, j, ch); set(g, x + w - 1, j, ch); }
}

function pathH(g: Grid, x0: number, x1: number, y: number, ch = '=') {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (let x = a; x <= b; x++) set(g, x, y, ch);
}

function pathV(g: Grid, y0: number, y1: number, x: number, ch = '=') {
  const a = Math.min(y0, y1), b = Math.max(y0, y1);
  for (let y = a; y <= b; y++) set(g, x, y, ch);
}

function house(g: Grid, x: number, y: number, w: number, doorX: number) {
  rect(g, x, y, w, 1, 'r');
  rect(g, x, y + 1, w, 1, 'H');
  set(g, doorX, y + 1, 'd');
}

function scatter(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string, density: number, seed: number, skip: (x: number, y: number) => boolean) {
  const rng = mulberry32(seed);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (skip(x, y)) continue;
      if (rng() < density) set(g, x, y, ch);
    }
  }
}

function borderForest(g: Grid, thickness: number, base: string) {
  const w = g[0].length, h = g.length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edge < thickness) set(g, x, y, base);
    }
  }
}

function toRows(g: Grid): string[] { return g.map(r => r.join('')); }

// ---------------- LUNARIS (64×44) ----------------
// R10-1 (6.2): ampliación POR ZONAS hacia el este y el sur. El valle
// histórico (plaza, casas, granja, estanque) conserva TODAS sus coordenadas:
// diffs de época, NPCs y aterrizajes desde otros mapas siguen siendo válidos.
// Zonas nuevas, cada una con razón para visitarla:
//  · CLARO DEL ECO (NE, tras el estanque): anillo de piedras con altar menor
//    ('A'), eco menor e4, cartel de lore y cofre l5 SOLO EN EL PASADO (el
//    claro era un lugar de culto: razón para usar Q).
//  · CUECO DEL POZO (SE): hondonada hundida con el pozo seco de la aldea
//    ('w') y cofre l6 — botín que premia el desvío por el camino este.
//  · CUECO DE LAS CENIZAS (SO): horno comunitario derruido con eco menor e5
//    (lore del Festival del Canto) y cartel.

function buildLunaris(): string[] {
  const W = 64, H = 44;
  const g = grid(W, H, '.');
  borderForest(g, 2, 't');
  // abertura norte hacia el bosque (intacta: llegada bosque→lunaris (26,3))
  rect(g, 23, 0, 6, 2, '=');
  pathV(g, 2, 15, 25); pathV(g, 2, 15, 26);
  // plaza central de piedra
  rect(g, 21, 15, 10, 7, ':');
  rect(g, 22, 14, 8, 1, ':');
  // casas
  house(g, 7, 9, 5, 9);      // casa de Brisa (puerta 9,10)
  house(g, 32, 9, 5, 34);    // forja de Toln (puerta 34,10)
  house(g, 7, 27, 5, 9);     // casa oeste sur
  house(g, 32, 27, 5, 34);   // casa sur
  // caminos a puertas
  pathV(g, 10, 11, 9); pathH(g, 9, 25, 11);
  pathV(g, 10, 11, 34); pathH(g, 26, 34, 11);
  pathV(g, 28, 29, 9); pathH(g, 9, 25, 29);
  pathV(g, 28, 29, 34); pathH(g, 26, 34, 29);
  pathV(g, 12, 15, 9); pathV(g, 12, 15, 34);
  // granja
  rectOutline(g, 14, 23, 8, 6, 'F');
  rect(g, 15, 24, 6, 4, 'c');
  set(g, 17, 23, 'c'); set(g, 18, 23, '=');
  // pozo y memoria
  set(g, 20, 16, 'w');
  set(g, 17, 20, 'g'); set(g, 18, 20, 'g');
  // estanque
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - 42) / 4.4, dy = (y - 26) / 3.2;
    if (dx * dx + dy * dy < 1) set(g, x, y, '~');
  }
  // rocas y flores
  set(g, 6, 31, 'R'); set(g, 44, 12, 'R'); set(g, 16, 6, 'R'); set(g, 46, 33, 'R');
  // cobertizo en ruinas (desaparece en el pasado) + cofre detrás
  set(g, 5, 26, 'R'); set(g, 6, 26, 'R'); set(g, 5, 25, 'R');
  // dispersión decorativa (rangos ampliados al este/sur para vestir las
  // zonas nuevas; se ejecuta ANTES de tallar las zonas nuevas)
  scatter(g, 3, 3, 60, 41, ',', 0.055, 101, (x, y) => g[y][x] !== '.');
  scatter(g, 3, 31, 30, 41, 'm', 0.06, 77, (x, y) => g[y][x] !== '.');
  scatter(g, 3, 3, 20, 7, 'p', 0.10, 55, (x, y) => g[y][x] !== '.');
  // ---- CLARO DEL ECO (NE) ----
  pathH(g, 31, 55, 14);                       // ramal este del camino de la plaza
  rect(g, 51, 4, 11, 12, 'm');                // claro de musgo
  // anillo de piedras con huecos al sur (entrada) y al norte
  set(g, 52, 7, 'R'); set(g, 52, 11, 'R'); set(g, 54, 4, 'R'); set(g, 58, 4, 'R');
  set(g, 60, 7, 'R'); set(g, 60, 11, 'R'); set(g, 58, 14, 'R'); set(g, 54, 14, 'R');
  set(g, 56, 9, 'A');                         // altar menor (piedra sólida, escenario)
  set(g, 54, 9, 'g'); set(g, 58, 9, 'g');     // piedras de ofrenda musgo-crecidas
  // ---- CUECO DEL POZO (SE) ----
  pathV(g, 17, 32, 58);                       // camino este hacia la hondonada
  rectOutline(g, 55, 32, 7, 6, 'R');          // brocal hundido
  rect(g, 56, 33, 5, 4, 'm');                 // interior
  set(g, 58, 32, '=');                        // boquilla de entrada (norte)
  set(g, 57, 35, 'w');                        // el pozo seco de la aldea
  // ---- CUECO DE LAS CENIZAS (SO) ----
  pathV(g, 30, 32, 9);                        // bajada desde el camino de la casa sur
  rectOutline(g, 5, 33, 7, 6, 'R');
  rect(g, 6, 34, 5, 4, '.');
  set(g, 9, 33, '.');                         // boquilla de entrada (norte)
  set(g, 7, 37, 'g'); set(g, 9, 37, 'g');     // cenizas del horno comunitario
  // despejar coordenadas clave (patrón 17-d de QA-mundo)
  const clearKey: [number, number][] = [
    [53, 12],             // cartel del claro
    [56, 11],             // eco e4 (claro)
    [59, 5],              // cofre l5 (claro, pasado)
    [58, 34],             // cofre l6 (cueco del pozo)
    [8, 35],              // eco e5 (cueco de las cenizas)
    [10, 32],             // cartel del cueco de las cenizas
    [50, 17], [56, 28],   // lobos nuevos
  ];
  for (const [x, y] of clearKey) {
    const c = g[y][x];
    if (c === 'p' || c === 'R') set(g, x, y, '.');
  }
  // abertura sur hacia la Costa de Bruma (Acto II): camino x25..27 prolongado
  // hasta el nuevo borde (y38..43). La llegada costa→lunaris (26,35) intacta.
  rect(g, 25, 36, 3, 2, '=');
  rect(g, 25, 38, 3, 6, '=');
  pathV(g, 30, 35, 25); pathV(g, 30, 35, 26);
  return toRows(g);
}

// ---------------- BOSQUE (64×50) ----------------
// R10-1 (6.2): ampliación POR ZONAS hacia el este y el sur. El bosque
// histórico (río, puente, ruina, camino a la cripta) conserva TODAS sus
// coordenadas: diffs de época, NPCs, aterrizajes de lunaris/cumbres y el
// blindaje R8 de la puerta de la cripta (columnas x9..11, y2..3) siguen
// siendo válidos. Zona nueva:
//  · SANTUARIO CAÍDO DEL CÍRCULO (SE): círculo de piedras del Círculo Verde
//    con eco menor b_e5, cartel de lore, pilares rotos y cofre b6 SOLO EN EL
//    PASADO (la piedra central vuelve a estar en pie: diff de época 'g'→'A').

function buildBosque(): string[] {
  const W = 64, H = 50;
  const g = grid(W, H, '.');
  borderForest(g, 2, 't');
  // abertura sur (vuelta a Lunaris)
  rect(g, 24, 42, 6, 2, '=');
  // río
  rect(g, 0, 10, W, 3, '~');
  for (let x = 0; x < W; x++) {
    if (g[9][x] === 't') continue;
    if ((x * 13 + 5) % 7 < 2) set(g, x, 9, ',');
    if ((x * 7 + 3) % 8 < 2) set(g, x, 13, ',');
  }
  // puente principal (roto en el presente)
  rect(g, 25, 10, 2, 3, 'x');
  pathV(g, 13, 14, 25); pathV(g, 13, 14, 26);
  pathV(g, 2, 9, 25); pathV(g, 2, 9, 26);
  // pinos
  scatter(g, 2, 2, 61, 47, 'p', 0.17, 202, (x, y) => g[y][x] !== '.');
  // camino serpenteante al sur (entrada → ruina)
  pathV(g, 36, 41, 27);
  pathH(g, 27, 40, 36);
  pathV(g, 30, 36, 40);
  pathH(g, 40, 43, 30);
  pathV(g, 29, 30, 43);
  // ruina antigua
  rect(g, 36, 20, 12, 9, ':');
  set(g, 36, 20, 'P'); set(g, 47, 20, 'P'); set(g, 36, 28, 'P'); set(g, 47, 28, 'P');
  set(g, 39, 23, 'g'); set(g, 44, 26, 'g');
  pathH(g, 26, 40, 24);   // del puente a la ruina
  pathH(g, 43, 25, 24);   // tramo oeste
  // niebla muda que bloquea el camino norte (se disipa en el pasado)
  rect(g, 23, 6, 6, 2, 'n');
  // entrada de la cripta (noroeste)
  rect(g, 6, 1, 9, 1, '#');
  rect(g, 6, 2, 1, 3, '#'); rect(g, 14, 2, 1, 3, '#');
  rect(g, 7, 2, 7, 2, ':');
  rect(g, 7, 4, 7, 1, '#');
  rect(g, 9, 4, 3, 1, '=');
  set(g, 10, 3, 'A');
  // decoración
  set(g, 12, 20, 'R'); set(g, 30, 33, 'R'); set(g, 50, 30, 'R');
  scatter(g, 2, 14, 61, 47, ',', 0.05, 303, (x, y) => g[y][x] !== '.');
  scatter(g, 2, 14, 61, 47, 'm', 0.035, 404, (x, y) => g[y][x] !== '.');
  // ==== 17-d (qa-mundo): despejar coordenadas clave. La dispersión de pinos
  // (semilla 202) plantó 'p' SÓLIDO sobre puntos de interés: los spawns lobo
  // (44,34) y esqueleto (30,16) nacían dentro de un árbol (moveEntity sin
  // ejes válidos → patrulla muerta de por vida), Ilwen (16,32) quedaba dentro
  // de un pino, el cofre b2 (52,38) era inalcanzable de vista y el eco b_e3
  // (12,38) se enterraba bajo copas. Mismo pase "despejar coordenadas clave"
  // que ya usan costa/aldea/cumbres; solo sustituye decoración ('p'/'R').
  const clearKey: [number, number][] = [
    [44, 34], [30, 16],   // spawns de zona (lobo, esqueleto)
    [16, 32],             // NPC Ilwen
    [52, 38],             // cofre b2
    [12, 38],             // eco menor b_e3
    // R10-1: POIs del santuario caído + cartel de cumbres reubicado
    [56, 43], [58, 44], [54, 44],   // eco b_e5, cofre b6, cartel del círculo
    [50, 41], [48, 45],             // lobo y esqueleto nuevos
    [58, 9],                        // sign_b2 (paso de cumbres, borde este nuevo)
  ];
  for (const [x, y] of clearKey) {
    const c = g[y][x];
    if (c === 'p' || c === 'R') set(g, x, y, '.');
  }
  // ==== R10-1: SANTUARIO CAÍDO DEL CÍRCULO (SE) ====
  rect(g, 53, 40, 7, 5, '.');                  // interior del círculo
  set(g, 56, 42, 'g');                         // piedra central caída ('A' en el pasado)
  set(g, 55, 40, 'g'); set(g, 57, 44, 'g');    // piedras menores
  set(g, 53, 40, 'P'); set(g, 59, 40, 'P');    // pilares rotos del pórtico
  set(g, 52, 42, 'R'); set(g, 60, 42, 'R');    // anillo de piedras (hueco al norte)
  set(g, 53, 39, 'R'); set(g, 59, 39, 'R');
  set(g, 53, 45, 'R'); set(g, 59, 45, 'R'); set(g, 56, 46, 'R');
  // acceso desde el camino serpenteante (y36) hasta la boca norte del círculo
  pathH(g, 41, 55, 36);
  pathV(g, 36, 38, 56);
  // abertura este hacia las Cumbres Heladas (Acto II) — movida al nuevo borde
  // (x61..63). El camino va por y=8 para no cruzar la Niebla Muda ni el río.
  pathH(g, 27, 61, 8);
  rect(g, 61, 6, 3, 3, '=');
  // plataforma de aterrizaje para quien vuelve de las Cumbres (51,7) — intacta
  rect(g, 50, 7, 3, 2, '=');
  // abertura sur prolongada hasta el nuevo borde (y44..49)
  rect(g, 24, 44, 6, 6, '=');
  return toRows(g);
}

// ---------------- CRIPTA (48×54) — R10-1 (6.4): mazmorra tipo Zelda ----------------
//
// REDISEÑO POR SECCIONES (sur → norte, dificultad y drama crecientes):
//   1. VESTÍBULO (y44..51): sala de entrada con pilares. Espacio libre en las
//      paredes norte (y44..45) para los carteles/restos de historia que añade
//      otro agente (épica 6.3). ÚNICA salida del mapa (sur, x22..25) — R8: la
//      cripta SOLO se entra/sale por su puerta; los bordes laterales siguen
//      sellados ('#' continuo, sin aberturas).
//   2. SALA DE PINCHOS (y31..39): corredor ancho con tiles de pinchos '^' en
//      filas alternas deterministas, con UN hueco seguro de 2 tiles por fila
//      que deriva por fórmula fija → zigzag obligatorio (4 cruces). Isla
//      segura con cofre c3 (riesgo/recompensa) y eco c_e3 en la cornisa oeste.
//   3. SALA DEL PUZZLE (y19..27): 4 palancas 'L' en las esquinas + PUERTA 'D'
//      (2×2 en x23..24 / y17..18) que SOLO se abre al activar TODAS las
//      palancas. Alcoba oeste secreta con cofre c2. El Santuario (sanc_c)
//      queda aquí: punto de control tras los pinchos y antes del puzzle.
//   4. ANTESALA DEL MINI-JEFE (y10..16): arena amplia con dais central y
//      pilares (cobertura y forma interesante) para el mini-jefe de entrada
//      (spawn lo define otro agente en data.ts; el vestíbulo también queda
//      espacioso por si prefiere colocarlo en la entrada).
//   5. SANCTUM DEL GUARDIÁN (y2..7): sala final con el altar (prop altar_c,
//      lo lee hooks acto4_subir) y el spawn del Guardián Hueco (zone 'boss',
//      intacto). Nichos laterales: eco c_e1 (oeste) y cofre c4 (este).
//
// ================= CONTRATO DE LOS CHARS NUEVOS (para el orquestador) =================
// '^' PINCHOS (sala de pinchos, ~77 tiles en filas y32/34/36/38):
//   · NO SÓLIDO: se pisa. tileSolidAt/SOLID_CHARS NO deben incluirlo.
//   · Daño al pisar (lógica del orquestador): si el tile bajo el centro del
//     Portador es '^' y p.iframes <= 0 → daño sugerido 6-8 hp + iframes 0.8 s
//     + sfx de dolor. NO aplicar knockback fuerte (podría empujar a otro '^').
//     Opcional: aplicar también a enemigos que pasen por encima.
//   · Determinismo: patrón FIJO calculado en build (paridad de fila + hueco
//     por fórmula ((y*5+3)%14)) — cero RNG de ejecución. Huecos: y38→x27..29,
//     y36→x17..18, y34→x21..22, y32→x25..26. Isla segura x27..29/y34..35.
// 'L' PALANCA (apagada):
//   · NO SÓLIDA: palanca de suelo, se pisa/rodea. Interacción por proximidad
//     al estilo de engine.ts:1156 (altarEcho/sign → consider(...)).
//   · Las 4 palancas del mapa: (11,20), (36,20), (11,26), (36,26).
//   · Estado ACTIVADA: char 'l' (minúscula, NO usado en este mapa) — el motor
//     puede sustituir el tile en this.rows (copia mutable) o pintar por flags;
//     stone.ts pintará 'L' (apagada) y 'l' (activada).
// 'D' PUERTA CERRADA (puzzle):
//   · SÓLIDA: añadir 'D' a SOLID_CHARS (sprites.ts) o tratarla en tileSolidAt.
//     Mientras no esté cableada, la puerta es decorativa (no bloquea) — el
//     enganche del orquestador la hace real.
//   · Tiles exactos: (23,17), (24,17), (23,18), (24,18). El corredor C es
//     exactamente x23..24 × y17..18: la puerta sella el ÚNICO paso entre la
//     sala del puzzle y la antesala (paredes '#' continuas, sin alternativa).
//   · APERTURA: al activarse las 4 palancas, sustituir los 4 'D' por ':' en
//     this.rows (rows[y] es string → rebanar y reasignar), forzar repintado
//     del ground (groundCacheKey usa nº de filas: alterar el contador o
//     invalidar) + sfx + toast, y PERSISTIR (p.ej. flags.criptaPuertaAbierta)
//     reaplicando la apertura en loadMap('cripta') — si no persiste, el puzzle
//     se re-resuelve cada visita (jugable, pero molesto para Acto IV, cuya
//     q15 habla con la Guarda en esta cripta).
//   · PALANCAS FALTANTES: escanear las 4 coords de 'L' vía tileAt (o mantener
//     un Set de coords activadas / flags `lev_x_y`); faltantes = 4 − activadas.
//     Al completarse: abrir 'D' (ver arriba).
// ENGANCHES DE RENDER (no bloqueantes — sin ellos NO hay crash):
//   · world/stone.ts → paintStone: casos '^', 'L', 'D' (y 'l'); hoy caen al
//     default de drawTile (hierba verde) hasta que se pinten.
//   · world/minimap.ts → catOf/baseColor: los 3 chars caen a 'void' (oscuro;
//     legible en la cripta, conviene darles color propio).
//   · sprites.ts SOLID_CHARS: SOLO añadir 'D'. '^' y 'L' deben seguir
//     transitables (¡NO añadirlos!).
// COMPATIBILIDAD: ids c1/c2 (saves), c_e1..c_e3 (takenEchoes), prop 'altar_c'
// (hooks acto4_subir: el heraldo nace en altar.x, altar.y+2 = (23,5)),
// NPC 'guarda' (q15) y spawn guardian zone 'boss' (update.ts:571) conservados.
// hooks.ts aterriza el santuario y acto4_subir en (19,24) — tile ':' de la
// sala del puzzle, junto al santuario (19,23). Aquellos saves antiguos con
// posición de la cripta vieja los rescata findSafeTile (anillos r≤8).

function buildCripta(): string[] {
  const W = 48, H = 54;
  const g = grid(W, H, 'V');
  rect(g, 1, 1, 46, 52, '#');       // losa de muros: bordes laterales SIEMPRE sellados

  // ---- 5. SANCTUM DEL GUARDIÁN (final, norte) ----
  rect(g, 14, 2, 20, 6, ':');       // sala del altar (x14..33, y2..7)
  rect(g, 12, 3, 2, 4, ':');        // nicho oeste (eco c_e1)
  rect(g, 34, 3, 2, 4, ':');        // nicho este (cofre c4)
  rect(g, 22, 8, 4, 2, ':');        // corredor D (antesala → sanctum), x22..25 y8..9

  // ---- 4. ANTESALA DEL MINI-JEFE ----
  rect(g, 10, 10, 28, 7, ':');      // arena amplia (x10..37, y10..16)
  rect(g, 38, 12, 2, 3, ':');       // hornacina este (cofre c1)
  // dais central con pilar de quiebre + pilares perimetrales: cobertura y forma
  set(g, 20, 12, 'P'); set(g, 26, 12, 'P'); set(g, 23, 13, 'P');
  set(g, 20, 14, 'P'); set(g, 26, 14, 'P');
  set(g, 13, 11, 'P'); set(g, 13, 15, 'P'); set(g, 34, 11, 'P'); set(g, 34, 15, 'P');

  // ---- 3. PUERTA DEL PUZZLE + SALA DEL PUZZLE ----
  rect(g, 23, 17, 2, 2, ':');       // corredor C (x23..24, y17..18)
  set(g, 23, 17, 'D'); set(g, 24, 17, 'D'); set(g, 23, 18, 'D'); set(g, 24, 18, 'D');
  rect(g, 9, 19, 30, 9, ':');       // sala del puzzle (x9..38, y19..27)
  rect(g, 6, 22, 3, 3, ':');        // alcoba oeste secreta (cofre c2)
  set(g, 17, 23, 'P'); set(g, 23, 23, 'P'); set(g, 29, 23, 'P'); // pilares-guía
  set(g, 11, 20, 'L'); set(g, 36, 20, 'L'); set(g, 11, 26, 'L'); set(g, 36, 26, 'L');

  // ---- corredor B (puzzle → pinchos), x17..18 y28..30 ----
  rect(g, 17, 28, 2, 3, ':');

  // ---- 2. SALA DE PINCHOS ----
  rect(g, 13, 31, 22, 9, ':');      // sala (x13..34, y31..39)
  // campo de pinchos: filas pares y32..38 con UN hueco seguro de 2 tiles que
  // deriva por fórmula fija (determinista, sin RNG de ejecución) → zigzag:
  //   y38 hueco x27..29 · y36 hueco x17..18 · y34 hueco x21..22 · y32 hueco x25..26
  for (let y = 32; y <= 38; y += 2) {
    const gap = 16 + ((y * 5 + 3) % 14);
    for (let x = 13; x <= 34; x++) {
      if (x === gap || x === gap + 1) continue;
      set(g, x, y, '^');
    }
  }
  rect(g, 27, 34, 3, 2, ':');       // isla segura del cofre c3 dentro del campo

  // ---- corredor A (vestíbulo → pinchos), x22..24 y40..43 ----
  rect(g, 22, 40, 3, 4, ':');

  // ---- 1. VESTÍBULO (entrada sur) ----
  rect(g, 13, 44, 22, 8, ':');      // sala de entrada (x13..34, y44..51)
  set(g, 16, 46, 'P'); set(g, 31, 46, 'P'); set(g, 16, 49, 'P'); set(g, 31, 49, 'P');
  return toRows(g);
}

// ---------------- Diffs de época ----------------

const lunarisDiffs: EpochDiff[] = [
  // las lápidas se convierten en flores: nadie murió aún en el pasado
  { x: 17, y: 20, char: ',' }, { x: 18, y: 20, char: ',' },
  // el cobertizo está en pie: desaparecen las ruinas
  { x: 5, y: 26, char: '.' }, { x: 6, y: 26, char: '.' }, { x: 5, y: 25, char: '.' },
  // el pueblo celebra el Festival del Canto: flores y hierba alta
  { x: 24, y: 16, char: ',' }, { x: 27, y: 18, char: ',' }, { x: 23, y: 19, char: ',' },
  { x: 28, y: 15, char: ',' }, { x: 22, y: 20, char: ',' }, { x: 29, y: 20, char: ',' },
  { x: 24, y: 21, char: ',' }, { x: 27, y: 21, char: ',' },
  // el camino norte está empedrado y cuidado
  { x: 25, y: 3, char: '=' }, { x: 26, y: 3, char: '=' },
];

const bosqueDiffs: EpochDiff[] = [
  // el puente principal está entero en el pasado
  { x: 25, y: 10, char: 'B' }, { x: 26, y: 10, char: 'B' },
  { x: 25, y: 11, char: 'B' }, { x: 26, y: 11, char: 'B' },
  { x: 25, y: 12, char: 'B' }, { x: 26, y: 12, char: 'B' },
  // la Niebla Muda no existía: se disipa
  { x: 23, y: 6, char: '.' }, { x: 24, y: 6, char: '.' }, { x: 25, y: 6, char: '.' },
  { x: 26, y: 6, char: '.' }, { x: 27, y: 6, char: '.' }, { x: 28, y: 6, char: '.' },
  { x: 23, y: 7, char: '.' }, { x: 24, y: 7, char: '.' }, { x: 25, y: 7, char: '.' },
  { x: 26, y: 7, char: '.' }, { x: 27, y: 7, char: '.' }, { x: 28, y: 7, char: '.' },
  // la ruina estaba viva: guirnaldas de flores
  { x: 40, y: 22, char: ',' }, { x: 43, y: 24, char: ',' }, { x: 41, y: 26, char: ',' },
  // R10-1: el círculo del Círculo Verde estaba en pie: la piedra central era
  // el altar del equinoccio (caída en el presente)
  { x: 56, y: 42, char: 'A' },
];

// ---------------- Definición completa ----------------

const BASE_MAPS: Record<'lunaris' | 'bosque' | 'cripta', MapDef> = {
  lunaris: {
    id: 'lunaris',
    name: 'Valle de Lunaris',
    subtitle: 'Cuna del Portador · Zona 1–8',
    w: 64, h: 44,
    rows: buildLunaris(),
    epochDiffs: lunarisDiffs,
    music: 'village',
    npcs: [
      { id: 'brisa', x: 23, y: 13, sprite: 'brisa', name: 'Anciana Brisa' },
      { id: 'toln', x: 35, y: 11, sprite: 'toln', name: 'Maestro Toln' },
      // Teo (biblia: niño rescatado de la Niebla) — aparece en cuanto empiezas a
      // empujar la Niebla (primer lobo cazado)
      { id: 'teo', x: 23, y: 20, sprite: 'teo', name: 'Teo', showFlag: 'wolfKills' },
      // Heraldo de la Orden de Vesh (biblia) — aparece tras recuperar el Eco de la Voz
      { id: 'heraldo', x: 28, y: 17, sprite: 'sombra', name: 'Heraldo de Vesh', showFlag: 'ecoVoz' },
    ],
    chests: [
      { id: 'l1', x: 5, y: 24, gold: 40, needPast: true },
      { id: 'l2', x: 48, y: 21, potions: 1, gold: 15 },
      { id: 'l3', x: 30, y: 33, gold: 30 },
      { id: 'l4', x: 6, y: 7, gold: 25 },
      // R10-1: razones para visitar las zonas nuevas
      { id: 'l5', x: 59, y: 5, gold: 45, potions: 1, needPast: true },  // claro del Eco (ofrenda del ayer)
      { id: 'l6', x: 58, y: 34, gold: 40, potions: 1 },                 // cueco del pozo
    ],
    echoes: [
      { id: 'e1', x: 21, y: 13, title: 'Eco menor · El pozo de los nombres', text: '«Antes de la Noche del Silencio, los aldeanos susurraban sus nombres al pozo para que el dios los tejiera en su canto. Ahora el pozo solo devuelve silencio.»' },
      { id: 'e2', x: 40, y: 31, title: 'Eco menor · La nieta del herrero', text: '«Toln aún forja todas las noches, aunque nadie compra. Dice que el metal recuerda el ritmo del martillo... y que algún día el canto volverá a necesitarlo.»' },
      { id: 'e3', x: 14, y: 17, title: 'Eco menor · Los Guardianes que aún cantan', text: '«Cada noche, tres capellanes subían a la muralla y cantaban las horas para que el valle durmiera sin miedo. Cuando el canto murió, dos callaron. El tercero aún canta: lo hacen las piedras por él, cuando llueve.»' },
      // R10-1: ecos de las zonas nuevas
      { id: 'e4', x: 56, y: 11, title: 'Eco menor · El claro de ensayo', text: '«Antes de cada siembra, el valle entero subía al claro: el altar menor guardaba la primera nota del año. Cuando el canto murió, el altar se quedó esperando. Las piedras del anillo aún están tibias.»' },
      { id: 'e5', x: 8, y: 35, title: 'Eco menor · Las cenizas compartidas', text: '«El horno no era de nadie: el pan era del horno y el horno del valle. La última hornada sigue dentro, dura como piedra. Nadie se atrevió a tirarla: era de todos.»' },
    ],
    spawns: [
      { type: 'lobo', x: 13, y: 33, patrol: 4, zone: 'valle' },
      { type: 'lobo', x: 19, y: 34, patrol: 4, zone: 'valle' },
      { type: 'lobo', x: 9, y: 30, patrol: 3, zone: 'valle' },
      { type: 'lobo', x: 34, y: 34, patrol: 4, zone: 'valle' },
      // R10-1: guardias de las zonas nuevas
      { type: 'lobo', x: 50, y: 17, patrol: 3, zone: 'valle' },
      { type: 'lobo', x: 56, y: 28, patrol: 4, zone: 'valle' },
    ],
    exits: [
      { x: 23, y: 0, w: 6, h: 2, to: 'bosque', tx: 27, ty: 40, label: 'Bosque Susurrante' },
      // R10-5 · interiores de Lunaris (puertas usables; la 'd' exterior es sólida —
      // la zona está en el tile LIBRE bajo la puerta)
      { x: 9, y: 11, w: 1, h: 1, to: INTERIOR_MAP_IDS.anciana, tx: 6, ty: 7, label: 'Casa de la Anciana' },
      { x: 9, y: 29, w: 1, h: 1, to: INTERIOR_MAP_IDS.tienda, tx: 7, ty: 7, label: 'Tienda de Taln' },
      // aterrizaje en costa (26,2): camino '=' bajo la abertura norte, fuera de su zona de salida
      // R10-1: la abertura sur se prolonga hasta el nuevo borde (y42..43); la
      // llegada costa→lunaris (26,35) sigue siendo camino '=' transitable.
      { x: 25, y: 42, w: 3, h: 2, to: 'costa', tx: 26, ty: 2, label: 'Costa de Bruma' },
    ],
    props: [
      { id: 'sanc_l', kind: 'sanctuary', x: 25, y: 18 },
      { id: 'forge', kind: 'forge', x: 37, y: 10 },
      { id: 'sign_l', kind: 'sign', x: 29, y: 3, label: '«Al norte: Bosque Susurrante. Cuidado con la Niebla.»' },
      { id: 'sign_l2', kind: 'sign', x: 23, y: 34, label: '«Al sur: la Costa de Bruma. El mar... todavía susurra.»' },
      // R10-1: lore de las zonas nuevas
      { id: 'sign_claro', kind: 'sign', x: 53, y: 12, label: '«Claro del Eco. Aquí el valle ensayaba el canto antes del alba; el altar menor aún pide una nota. En el ayer estaba cubierto de ofrendas.»' },
      { id: 'sign_cenizas', kind: 'sign', x: 10, y: 32, label: '«El horno de la fiesta. Toda cosecha se compartía al filo de la hoguera, y las cenizas se repartían entre las casas para que el calor no se apagara nunca.»' },
    ],
  },

  bosque: {
    id: 'bosque',
    name: 'Bosque Susurrante',
    subtitle: 'Los árboles recuerdan · Zona 8–15',
    w: 64, h: 50,
    rows: buildBosque(),
    epochDiffs: bosqueDiffs,
    music: 'forest',
    npcs: [
      { id: 'ilwen', x: 16, y: 32, sprite: 'ilwen', name: 'Ilwen', showFlag: 'q2_done' },
      // Doran, druida del Círculo Verde (biblia) — cerca del santuario de la Ruina Antigua
      { id: 'doran', x: 36, y: 24, sprite: 'doran', name: 'Doran' },
    ],
    chests: [
      { id: 'b1', x: 4, y: 40, potions: 2 },
      { id: 'b2', x: 52, y: 38, gold: 35 },
      { id: 'b3', x: 30, y: 14, gold: 20 },
      { id: 'b4', x: 40, y: 4, gold: 60, potions: 1 },
      { id: 'b5', x: 21, y: 2, gold: 45 },
      // R10-1: ofrenda del santuario caído — intacta SOLO en el pasado
      { id: 'b6', x: 58, y: 44, gold: 30, potions: 2, needPast: true },
    ],
    echoes: [
      { id: 'b_e1', x: 33, y: 26, title: 'Eco menor · La Madre Espina', text: '«Cuando el canto murió, las raíces del Bosque enloquecieron de dolor. La Madre Espina no es mala: solo tiene roto el corazón.»' },
      // ==== 17-d (qa-mundo): antes en (48,12) — DENTRO del río ('~' en ambas
      // épocas): el eco flotaba en el agua y obligaba a interactuar desde la
      // orilla. (48,13) es la orilla este libre, misma lectura.
      { id: 'b_e2', x: 48, y: 13, title: 'Eco menor · El guardián de la niebla', text: '«Los lobos de niebla fueron una vez perros guardianes de Lunaris. Aún patrullan. Ya no saben para qué.»' },
      { id: 'b_e3', x: 12, y: 38, title: 'Eco menor · El primer Portador', text: '«Hubo otros antes que tú. Todos oyeron el primer Eco. Ninguno volvió de la Ciudadela. Prepara tu despedida, Portador.»' },
      { id: 'b_e4', x: 30, y: 24, title: 'Eco menor · La Rebelión de los Sordos', text: '«Hubo un año en que los aldeanos del bosque se taparon los oídos con cera de abejas: "si el canto nos gobernaba, el silencio nos libera". Duraron un invierno. La Niebla los encontró igual: el silencio también se puede robar.»' },
      // R10-1: eco del santuario caído del Círculo (SE)
      { id: 'b_e5', x: 56, y: 43, title: 'Eco menor · El círculo que espera', text: '«El Círculo Verde no adoraba al dios: lo ACOMPAÑABA. Cada equinoccio, sus druidas se sentaban entre estas piedras para que el canto descansara en compañía. Cuando el canto murió, el círculo decidió esperar de pie. Las piedras se sentaron primero.»' },
    ],
    spawns: [
      { type: 'lobo', x: 32, y: 36, patrol: 4, zone: 'bosque' },
      { type: 'lobo', x: 20, y: 34, patrol: 4, zone: 'bosque' },
      { type: 'lobo', x: 44, y: 34, patrol: 4, zone: 'bosque' },
      { type: 'lobo', x: 14, y: 20, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 30, y: 16, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 40, y: 14, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 10, y: 30, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 34, y: 5, patrol: 3, zone: 'bosque' },
      { type: 'esqueleto', x: 45, y: 7, patrol: 3, zone: 'bosque' },
      // R10-1: guardias del santuario caído
      { type: 'lobo', x: 50, y: 41, patrol: 4, zone: 'bosque' },
      { type: 'esqueleto', x: 48, y: 45, patrol: 3, zone: 'bosque' },
    ],
    exits: [
      // R10-1: la abertura sur se prolonga hasta el nuevo borde (y48..49)
      { x: 24, y: 48, w: 6, h: 2, to: 'lunaris', tx: 26, ty: 3, label: 'Valle de Lunaris' },
      // destino (23,49): suelo del vestíbulo de la cripta, fuera de su zona de salida
      { x: 8, y: 2, w: 5, h: 2, to: 'cripta', tx: 23, ty: 49, label: 'Cripta del Primer Canto' },
      // aterrizaje en cumbres (25,39): camino '=' sobre la abertura sur, fuera de su zona de salida
      // R10-1: la abertura este se mueve al nuevo borde (x62..63); la
      // llegada cumbres→bosque (51,7) sigue siendo la plataforma '='.
      { x: 62, y: 6, w: 2, h: 3, to: 'cumbres', tx: 25, ty: 39, label: 'Cumbres Heladas' },
    ],
    props: [
      { id: 'sanc_b', kind: 'sanctuary', x: 38, y: 26 },
      { id: 'fragment', kind: 'fragment', x: 41, y: 24 },
      { id: 'sign_b', kind: 'sign', x: 27, y: 41, label: '«Bosque Susurrante. Los caminos cambian con la luz.»' },
      { id: 'sign_c', kind: 'sign', x: 15, y: 5, label: '«Cripta del Primer Canto. Aquí durmió la voz del dios.»' },
      // easter egg Nimue (biblia: hermana de Ilwen, atrapada en la Niebla) — solo en el pasado
      { id: 'sign_nimue', kind: 'sign', x: 25, y: 6, needPast: true, label: 'Las flores del pasado no crecen en círculo por casualidad. Entre las raíces, apenas un hilo de voz que ya no es voz: «...nimue... nimue...» Alguien duerme aquí debajo, y la Niebla la cuida como a una semilla. (Ilwen busca a su hermana... pero jura que no se llamaba así.)' },
      { id: 'sign_b2', kind: 'sign', x: 58, y: 9, label: '«Al este: el paso de las Cumbres. Lleva abrigo, Portador.»' },
      // R10-1: lore del santuario caído del Círculo
      { id: 'sign_cir', kind: 'sign', x: 54, y: 44, label: '«Santuario del Círculo Verde. Una piedra por nota del Primer Canto; en el equinoccio, la del centro cantaba sola. Doran aún poda la hiedra que nadie le pide.»' },
    ],
  },

  cripta: {
    id: 'cripta',
    name: 'Cripta del Primer Canto',
    subtitle: 'Fuera del tiempo',
    w: 48, h: 54,
    rows: buildCripta(),
    epochDiffs: [],
    dark: true,
    music: 'crypt',
    npcs: [
      // 16-a: La Guarda del Primer Canto — el tercer capellán que no calló,
      // atado al umbral de la Cripta. Solo aparece cuando el tercer canto
      // terminó (acto3Done): custodia la puerta de la Sala (misiones q15).
      // R10-1: en el vestíbulo (siempre alcanzable, nunca tras la puerta 'D').
      { id: 'guarda', x: 27, y: 46, sprite: 'kael', name: 'La Guarda del Primer Canto', showFlag: 'acto3Done' },
    ],
    chests: [
      // c1/c2 conservan id (compat de saves openedChests); c3/c4 nuevos
      { id: 'c1', x: 39, y: 13, gold: 50 },             // antesala, hornacina este
      { id: 'c2', x: 7, y: 23, potions: 2 },            // sala del puzzle, alcoba oeste
      { id: 'c3', x: 28, y: 34, gold: 40 },             // sala de pinchos, isla segura
      { id: 'c4', x: 35, y: 4, gold: 60, potions: 1 },  // sanctum, nicho este (botín final)
    ],
    echoes: [
      { id: 'c_e1', x: 12, y: 5, title: 'Eco menor · El eco del guardián', text: '«El Guardián Hueco fue el primer coro de Aelthar. Cuando el dios calló, el coro siguió cantando... hasta que su propia voz lo vació por dentro.»' },
      { id: 'c_e2', x: 11, y: 15, title: 'Eco menor · El peregrino', text: '«Cientos peregrinos subieron a oír el Primer Canto. Este dejó su lámpara encendida para el siguiente. Aún arde.»' },
      { id: 'c_e3', x: 13, y: 37, title: 'Eco menor · La Lanza Muda', text: '«Aquí forjaron los Durn la Lanza que mató al dios: una lanza sin canto, sorda de nacimiento, para que el canto del dios no la desviara. Nadie la volvió a ver. Los que la buscaron dicen que sigue silbando en algún rincón del mundo... esperando la segunda vez.»' },
      // R10-1: eco del vestíbulo — insinúa el puzzle de las palancas
      { id: 'c_e4', x: 15, y: 50, title: 'Eco menor · El eco del umbral', text: '«Los que abrieron esta cripta dejaron escrito el orden de las palancas en cuatro lápidas... y las lápidas cantan, pero solo de noche. Cuenta las notas: son cuatro. La puerta no se abre con llaves: se abre con coro.»' },
    ],
    spawns: [
      { type: 'esqueleto', x: 13, y: 13, patrol: 3, zone: 'cripta' },  // antesala, pilares oeste
      { type: 'esqueleto', x: 35, y: 12, patrol: 2, zone: 'cripta' },  // antesala, hornacina
      { type: 'esqueleto', x: 24, y: 24, patrol: 4, zone: 'cripta' },  // sala del puzzle, guarda-palancas
      { type: 'esqueleto', x: 32, y: 37, patrol: 2, zone: 'cripta' },  // sala de pinchos, cornisa este
      { type: 'esqueleto', x: 29, y: 50, patrol: 3, zone: 'cripta' },  // vestíbulo
      { type: 'guardian', x: 23, y: 5, zone: 'boss' },                 // sanctum (contrato intacto)
      // R10-9 · EL SEPULCRO, mini-jefe de la antesala (zone 'antesala' — NUNCA
      // 'boss': el watcher genérico resuelve el PRIMER 'boss' y rompería al Guardián)
      { type: 'sepulcro', x: 19, y: 18, patrol: 1, zone: 'antesala' },
    ],
    exits: [
      // destino (10,5): tile libre justo bajo la puerta del recinto del bosque
      // (x=9..11, y=4) y FUERA de la zona de salida bosque→cripta (x:8..12, y:2..3).
      // R10-1: la salida sigue siendo la ÚNICA del mapa (vestíbulo sur); los
      // bordes laterales están sellados con '#' continuo (garantía R8).
      { x: 22, y: 51, w: 4, h: 3, to: 'bosque', tx: 10, ty: 5, label: 'Bosque Susurrante' },
    ],
    props: [
      // sanc_c (19,23): hooks.ts aterriza el santuario y acto4_subir en (19,24)
      // — suelo ':' de la sala del puzzle, junto al santuario (punto de control
      // tras los pinchos, antes del puzzle y de los jefes).
      { id: 'sanc_c', kind: 'sanctuary', x: 19, y: 23 },
      // altar_c (23,3): hooks acto4_subir hace nacer al heraldo en
      // (altar_c.x, altar_c.y+2) = (23,5), centro del sanctum.
      { id: 'altar_c', kind: 'altarEcho', x: 23, y: 3 },
    ],
  },
};

// Mundo completo: mapa base + expansión del Acto II (Costa, Aldea, Cumbres)
// + interiores (R10-5) re-keyeados por su MapId completo ('interior_*') —
// las salidas del mundo apuntan a esos ids y loadMap hace MAPS[id].
// NOTA: la siembra de props de lore (R10-6) vive en engine.ts — aquí crearía
// un ciclo maps→props→engine→enemies_expansion→MAPS.
const INTERIOR_MAPS_BY_ID: Partial<Record<MapId, MapDef>> = {
  [INTERIOR_MAP_IDS.anciana]: INTERIOR_MAPS.anciana,
  [INTERIOR_MAP_IDS.tienda]: INTERIOR_MAPS.tienda,
  [INTERIOR_MAP_IDS.taberna]: INTERIOR_MAPS.taberna,
};
export const MAPS: Record<MapId, MapDef> = { ...BASE_MAPS, ...EXPANSION_MAPS, ...INTERIOR_MAPS_BY_ID } as Record<MapId, MapDef>;

// Rellena filas cortas por seguridad
export function mapRows(m: MapDef): string[] {
  const rows: string[] = [];
  for (let y = 0; y < m.h; y++) {
    const r = m.rows[y] ?? '';
    rows.push(r.length >= m.w ? r.slice(0, m.w) : r + '.'.repeat(m.w - r.length));
  }
  return rows;
}

export function tileAt(m: MapDef, rows: string[], tx: number, ty: number, epoch: Epoch): string {
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return 'V';
  if (ty >= rows.length || rows[ty].length === 0) return 'V'; // mapa aún no cargado (intro)
  let ch = rows[ty][tx];
  if (epoch === 'pasado') {
    for (const d of m.epochDiffs) {
      if (d.x === tx && d.y === ty) { ch = d.char; break; }
    }
  }
  return ch;
}
