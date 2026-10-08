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
// ============================================================

export const VIEW_W = 960, VIEW_H = 540;
export const ZOOM = 2;
