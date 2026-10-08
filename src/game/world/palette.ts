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
  // camino
  path: '#b89a6a', pathLight: '#c4a878', pathDark: '#a08454', pathShadow: '#8a7248',
  // piedra
  stone: '#6a6a7a', stoneLight: '#7a7a8a', stoneDark: '#5a5a6a', stoneLine: '#585868',
  stoneDeep: '#3e3e50', stoneHi: '#8a8a9a', stoneVein: '#63636f',
  // agua
  water: '#3a6a9a', waterHi: '#3f72a4', waterGlint: '#6aa0cc', waterDeep: '#2c5580',
  foam: '#cfe6f2',
  // madera / aldea
  wood: '#8a6a44', woodDark: '#6a4e30', woodMid: '#7a5c3a', woodLight: '#b89058',
  wall: '#e2d0ac', wallShadow: '#d0bc94', roof: '#a8503a', roofDark: '#7e3626',
  roofLight: '#c86850', roofMid: '#94422e', door: '#5c3a1e', doorMid: '#7a5230',
  gold: '#f0c84a',
  // cripta
  cryptFloor: '#565664', cryptWall: '#4a4a5c',
  // vacío
  void0: '#0c0a14', voidSpeck: '#1c1828',
} as const;

/** Versión de mapId para paletas. */
export function isForest(mapId: string): boolean {
  return mapId === 'bosque';
}

/** Elección determinista entre n opciones según hash. */
export function pick(r: number, n: number): number {
  return Math.min(n - 1, Math.floor(r * n));
}
