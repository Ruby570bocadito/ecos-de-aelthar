// ============================================================
// Constantes de viewport compartidas por todo el motor.
//
// Viven en un módulo PROPIO (no en engine.ts) porque world/weather.ts las
// lee al EVALUARSE el módulo (const SHAFT_X = [VIEW_W * 0.34, ...]). El grafo
// entra por engine.ts → render.ts → world/*, y engine.ts no termina de
// evaluar su cuerpo hasta que todas sus importaciones estáticas terminan;
// si las constantes vivieran en engine.ts, cualquier lectura en la fase de
// evaluación de un módulo del ciclo caería en TDZ
// ("Cannot access 'VIEW_W' before initialization"). Al estar en el PRIMER
// import de engine.ts y ser re-exportadas desde ahí, todos los módulos
// (incluidos los de world/) las ven inicializadas.
//
// Vista DINÁMICA (fix barra negra, merge main): `let` + live bindings — el
// buffer se ajusta al aspecto real de la ventana vía fitViewToWindow() y
// todos los módulos leen el valor ACTUAL en cada frame.
// ============================================================

export let VIEW_W = 960, VIEW_H = 540;
export const ZOOM = 2;

/**
 * Ajusta el buffer del juego al aspecto de la ventana para eliminar el
 * letterbox (la "barra negra" abajo/arriba). Mantiene 540px de alto base
 * a 16:9 exacto; pantallas más anchas ganan vista lateral (hasta 1600px)
 * y más cuadradas ganan vista vertical (hasta 800px). Clamp de seguridad
 * para aspectos extremos (móvil vertical): ahí el letterbox es aceptable.
 */
export function fitViewToWindow(winW: number, winH: number): void {
  const a = winW / Math.max(1, winH);
  let vw = Math.round(540 * a);
  let vh = 540;
  if (vw < 840) { vw = 840; vh = Math.round(vw / a); }
  else if (vw > 1600) { vw = 1600; vh = Math.round(vw / a); }
  vh = Math.max(460, Math.min(800, vh));
  vw = Math.max(840, Math.min(1600, Math.round(vh * a)));
  if (vw !== VIEW_W || vh !== VIEW_H) { VIEW_W = vw; VIEW_H = vh; }
}
