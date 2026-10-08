// ============================================================
// ECOS DE AELTHAR — Paleta y utilidades compartidas del mundo
// Fuente única de colores del terreno para coherencia visual
// entre módulos (grass/water/stone/village/trees).
// ============================================================

export type NeighborFn = (tx: number, ty: number) => string;

/** Hash determinista 2D (igual al original de sprites.ts). */
export function hash2(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

/** Pinta un rectángulo (helper mínimo de px). */
export function px(
  x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, C: string,
): void {
  x.fillStyle = C; x.fillRect(X, Y, W, H);
}

// ---------------- Paleta base del mundo ----------------

export const PAL = {
  // hierba
  grassLunaris: ['#4f8a46', '#467c3e', '#578f4c', '#427a3a'],
  grassBosque: ['#3f6d3a', '#396334', '#457540', '#355e31'],
  grassBlade: '#5a9a50',
  grassBladeBosque: '#4f8a48',
  grassDark: '#3a6836',
  grassWet: '#2f5433',       // hierba húmeda junto al agua (valle)
  grassWetBosque: '#28482c', // hierba húmeda junto al agua (bosque)
  flowerCols: ['#f0d060', '#e878a0', '#f0f0f0', '#e88a4a', '#b48ae8'],
  flowerCore: '#fff6dc',
  // camino
  path: '#b89a6a', pathLight: '#c4a878', pathDark: '#a08454', pathShadow: '#8a7248',
  // piedra
  stone: '#6a6a7a', stoneLight: '#7a7a8a', stoneDark: '#5a5a6a', stoneLine: '#585868',
  stoneDeep: '#3e3e50', stoneHi: '#8a8a9a', stoneVein: '#63636f',
  // agua
  water: '#3a6a9a', waterHi: '#3f72a4', waterGlint: '#6aa0cc', waterDeep: '#2c5580',
  foam: '#cfe6f2',
  // agua — aditivos R1-A2 (profundidad, orilla, puentes y capa animada)
  waterShallow: '#4a7cae',  // agua somera junto a la orilla
  waterDeep2: '#1f3f66',    // fondo del centro de la masa de agua
  waterWave: '#5688b5',     // línea de ola estática sutil (prerrender)
  sparkle: '#d8ecf8',       // destello animado sobre el agua
  foamWash: '#9cc8de',      // lavado de espuma secundario
  shoreSand: '#c2a878',     // arena de orilla
  shoreSandHi: '#d4bc8c',   // arena seca (brillo del borde superior)
  shoreMud: '#8a6f4e',      // lodo mojado pegado al agua
  pebble: '#9a9082',        // piedrita clara de la orilla
  pebbleDark: '#6f695c',    // piedrita oscura
  bridgeWater: '#26496f',   // sombra del puente proyectada sobre el agua
  ropeLight: '#c9ad7a',     // cuerda clara (nudos)
  ropeDark: '#8f7147',      // cuerda en sombra
  plankWet: '#5f462a',      // madera mojada / semihundida
  forestTint: '#3a5a48',    // tinte del río del bosque (reflejo de espesura)
  // madera / aldea
  wood: '#8a6a44', woodDark: '#6a4e30', woodMid: '#7a5c3a', woodLight: '#b89058',
  wall: '#e2d0ac', wallShadow: '#d0bc94', roof: '#a8503a', roofDark: '#7e3626',
  roofLight: '#c86850', roofMid: '#94422e', door: '#5c3a1e', doorMid: '#7a5230',
  gold: '#f0c84a',
  // cripta
  cryptFloor: '#565664', cryptWall: '#4a4a5c',
  // —— árboles (R1-A5 · bloque aditivo: solo entradas nuevas) ——
  trunkHi: '#7c5836', trunkMid: '#6e4a2a', trunkDeep: '#54381e', rootSoil: '#4a3520',
  copaDeepL: '#2c5a30', copaMidL: '#3f7a3e', copaLightL: '#5c9c4e',   // coposo Lunaris
  copaDeepB: '#24502c', copaMidB: '#356a38', copaLightB: '#4c8a44',   // coposo Bosque
  pineDeep: '#16351f', pineDark: '#1c4426', pineMid: '#2a5c32', pineLight: '#3f7844',
  fruitRed: '#e05858', fruitShine: '#f09090', flowerGold: '#e8c860', flowerPink: '#e88ab0',
  nestBrown: '#6a4e2a', nestDark: '#4e3a1e', eggShell: '#f2e8d0',
  birdBody: '#3a3440', birdBeak: '#e0a83c', leafHang: '#74a852',
  // vacío
  void0: '#0c0a14', voidSpeck: '#1c1828',
  // --- R1-A4 · Aldea (aditivo, módulo village.ts) ---
  wallHi: '#f2e4c2', wallDirt: '#c9b489',            // enlucido: brillo y motas
  beam: '#5a4026', beamHi: '#70502f',                // vigas de madera
  plinth: '#8d8d99', plinthHi: '#a2a2ae', plinthDark: '#66666f', // zócalo piedra
  winFrame: '#4a3320',                               // marco ventana/puerta
  glass: '#7c9fc4', glassHi: '#bcd8ea', glassDark: '#5a7a9c',    // cristal
  step: '#9c9ca8', stepDark: '#74747f',              // escalones / arco
  ridge: '#d8825f', ridgeHi: '#ea9c74',              // caballete del tejado
  mossTile: '#6f8a4c', brokenTile: '#5c2a1a',        // teja musgo / rota
  chimney: '#7d7d8c', chimneyHi: '#9696a4', chimneyDark: '#5c5c6a', chimneyMouth: '#2e2e3c',
  iron: '#3c3126', lanternOff: '#565048', lanternGlass: '#453f35', // forja y farol
  rope: '#b09a68',                                   // cuerda del pozo
  wellWater: '#54c8d8', wellDeep: '#1c2c3c',         // agua del pozo
  moss: '#5f7d46',                                   // musgo en rocas
  objShadow: 'rgba(0,0,0,0.25)',                     // sombra proyectada
  // --- R1-A3 · Piedra y cripta (aditivo, módulo stone.ts) ---
  stoneMoss: '#4d6a44', stoneMossDark: '#3c5636',    // musgo apagado en losas
  stoneMossCrypt: '#3f5f52',                         // musgo azulado de cripta
  runeCrypt: '#5a8a9a',                              // glifo cian apagado (suelo cripta)
  candleFlame: '#f4c878', candleWax: '#c8893c',      // vela 1×2 de nicho (ámbar)
} as const;

/** Versión de mapId para paletas. */
export function isForest(mapId: string): boolean {
  return mapId === 'bosque';
}

/** ¿Mapa de la cripta? (piedra azulado-oscura, runas y nichos). */
export function isCrypt(mapId: string): boolean {
  return mapId === 'cripta';
}

// ---------------- Paleta de luces (R1-A6 · módulo lighting) ----------------
// Solo lectura para lighting.ts; no altera PAL (aditivo).

export const LIGHT_PAL = {
  sanctuaryCyan: '#7de8ff',   // santuarios: cian pulsante
  forgeEmber: '#ff9040',      // forja: brasa naranja
  altarGold: '#ffd97a',       // altar de la cripta: dorado
  burnOrange: '#ff8830',      // estado quemado (NPC/jefe): naranja parpadeo
  weaverViolet: '#b080ff',    // disciplina tejedor: violeta tenue
  torchAmber: '#ffb050',      // antorchas de muro (cripta): ámbar
  playerBeam: '#dfe6ff',      // haz suave alrededor del jugador en la cripta
  nightBlue: '#0a0e28',       // oscuridad nocturna rgb(10,14,40)
  nightDeep: '#080c24',       // medianoche rgb(8,12,36)
  dawnPink: '#ff96aa',        // amanecer rosa rgb(255,150,170)
  duskAmber: '#ff944a',       // tarde ámbar rgb(255,148,74)
  cryptVoid: '#060810',       // penumbra base de la cripta rgb(6,8,16)
} as const;

/** Elección determinista entre n opciones según hash. */
export function pick(r: number, n: number): number {
  return Math.min(n - 1, Math.floor(r * n));
}

// ---------------- Paleta de props v2 (R1-A10 · aditivo) ----------------
// Solo lectura para world/props.ts; no altera PAL ni LIGHT_PAL (aditivo).

export const PAL_PROP = {
  // santuario (piedra azulada + runas cian)
  sanctStone: '#5a6a8a', sanctLight: '#7a8aac', sanctShade: '#42506c',
  runeCyan: '#8ef0ff', runeCyanHi: '#d4fbff', runeDim: '#4ac8dc',
  // musgo (bases de losas)
  moss: '#4f8a46', mossDark: '#3a6836',
  // forja (hierro, brasa, humo)
  iron: '#4a4a58', ironDeep: '#3a3a48', ironLight: '#5a5a6a', ironHi: '#7a7a8a',
  ember1: '#ff7828', ember2: '#ffa040', emberCore: '#ffc850', emberGlow: '#ff9040',
  smoke: '#c8ccd8', spark: '#ffb050',
  // fragmento (grietas doradas)
  crackGold: '#ffe9a0', crackGoldHi: '#fffbe0', crackGoldDeep: '#f0c84a',
  // altar de la cripta (velas, canal, niebla)
  wax: '#e8e4d8', waxShade: '#c8c0b0', waxHi: '#f4f1e6',
  flame1: '#ff9040', flame2: '#ffc850', flame3: '#fff3c0',
  fog: '#bec8e1',
  // puerta / barrotes
  bar: '#3a3a48', barDeep: '#2a2a34', barHi: '#6a6a7a',
} as const;
