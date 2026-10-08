// ============================================================
// ECOS DE AELTHAR — Utilidades de actores (módulo actors)
// Canvas helper + píxel helper compartidos por los generadores
// de sprites de personajes/enemigos/objetos.
// ============================================================

export type Frames = HTMLCanvasElement[];

export function mkCanvas(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

export function px(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, C: string) {
  x.fillStyle = C; x.fillRect(X, Y, W, H);
}
