// ============================================================
// ECOS DE AELTHAR — Pantallas y overlays (AGENTE 3-a · visuales;
// pestañas y final actualizados al ACTO II por el agente 10-a)
// Título (niebla en capas + notas flotantes), controles, intro,
// pausa (Estado con "Velmora te observa", Diario con memorias y
// misiones del Acto II), diálogo con retratos, muerte y final.
// R8-4 (menús y usabilidad): título con más presencia y pie de
// versión discreto; pausa reorganizada en HUB + 5 secciones visibles
// (Estado/Equipo/Inventario/Diario/Opciones) con teclado y capas que
// NUNCA cierran el menú entero; Equipo con comparación de stats;
// Diario con la cadena de misión paso a paso; gasto de atributos con
// confirmación y badges de puntos disponibles.
// ============================================================

import type { Game, GState } from './engine';
import { VIEW_W, VIEW_H, QUESTS, getSpr, playerMeleeDmg, playerSpellDmg } from './engine';
import { ATTR_INFO, KEY_ITEMS, MEMORIES } from './data';
import { dominantTone, TONE_LABEL } from './hooks';
import { drawBalancePanel, critChance } from './balance'; // 12-c: dificultad (pestaña SISTEMA) + R8-7 crítico
import { drawArmorRow, ARMORS, armorActive, type ArmorDef } from './armor'; // 14-b: datos de corazas (solo lectura)
import { drawPortrait } from './sprites';
import { hasPortrait } from './actors/portraits'; // R18
import { audio } from './audio';
import { COL, text, textShadow, panel, bar, button, wrapText, addHit, refreshCursor, shortName } from './ui';
import { drawSkyBackdrop } from './world/sky';
import { drawCinematic } from './cinematic'; // R15: prólogo animado saltable
import { openChallengeMenu, drawChallengeTitleUi, drawChallengeOverlay } from './challenge'; // 12-a (modo desafío)
import { drawTitlePanels, openStatsPanel, openLogrosPanel } from './achievements'; // 16-c: Estadísticas y Logros
import { SIDE_QUESTS, RELICS, sqOn, sqDone, sqCurrent, sqTracked, sqPin, relicOwned, relicEquipped, relicIs, equipRelic } from './sidequests'; // R18
import { MAPS } from './maps';

const INTRO_SLIDES = [
  {
    title: 'ERA DEL CANTO',
    lines: 'Hace mil años, el dios-tejedor Aelthar sostenía el mundo con su canto. Cinco pueblos crecieron a su abrigo y las ciudades se alzaron con cada nota.',
  },
  {
    title: 'LA NOCHE DEL SILENCIO',
    lines: 'Hace 300 años, la Orden de Vesh asesinó al dios. Su canto se quebró en siete Ecos y sin él la Niebla Muda avanza, borrando pueblos, recuerdos y nombres.',
  },
  {
    title: 'ERA DE LAS CENIZAS',
    lines: 'Hoy despiertas en el Valle de Lunaris. Eres un Portador: puedes oír los Ecos. Recupera el primero... y recuerda que la voz de un dios no siempre dice la verdad.',
  },
];

// pistas sugerentes de las memorias bloqueadas (biblia)
const LOCKED_HINT: Record<string, string> = {
  mem_nana: 'Una nana medio oída te persigue desde el valle...',
  mem_casa: '¿Dos tazas en un umbral? El olor a pan te resulta conocido...',
  mem_madre: 'Unas manos cosen algo en tu memoria. No ves su rostro.',
  mem_faro: 'Un faro apagado sueña con una cerilla y una canción...',
  mem_invierno: 'Bajo el hielo de las cumbres aguardan voces dormidas...',
};

// Acto II — teasers de las zonas nuevas (Diario, solo misiones futuras:
// al activarse la misión el paso real los sustituye, y al completarla callan)
const ZONE_TEASERS: Record<string, string> = {
  q6: '«Costa de Bruma — el mar guarda las notas»',
  q8: '«Merrow — la aldea que olvidó su nombre»',
  q9: '«Cumbres Heladas — el frío que aprendió a escuchar»',
};

// objetos clave: flag del motor/hooks → clave en KEY_ITEMS (orden de obtención).
// Lista dinámica: cualquier Eco u objeto nuevo aparece al activarse su flag.
const KEY_ITEM_FLAGS: [string, string][] = [
  ['fragmentTouched', 'fragment'],
  ['ecoVoz', 'ecoVoz'],
  ['ecoMareas', 'ecoMareas'],
  ['ecoCumbres', 'ecoCumbres'],
  ['ecoNombres', 'ecoNombres'],
];

// números en letra para la pantalla final (restantes de 7)
const NUM_ES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete'];

// R8-4 — pie del título: una sola línea discreta con la versión
const GAME_VERSION = 'v0.9.0'; // R17: una sola fuente para título y pausa · R18: v0.9.0
const TITLE_FOOTER = `${GAME_VERSION} · Ecos de Aelthar`; // R17: semillas del Eco · lente · equilibrio por zona

export function drawScreens(g: Game) {
  installLayerGuard(g); // R8-4: capas de pausa — Esc cierra SOLO la capa activa
  if (g.state !== 'end') endArmed = false; // rearma la escalonada del final
  switch (g.state) {
    case 'title':
      drawTitle(g);
      // 12-a: sub-menú de selección del Desafío / panel de resultados (dibujados
      // por challenge.ts sobre el título; limpian los uiHit del título de fondo)
      drawChallengeTitleUi(g);
      // 16-c: paneles de Estadísticas y Logros (mismo patrón de overlay; se
      // dibujan al final y limpian uiHit para que el título de fondo quede
      // inalcanzable mientras están abiertos)
      drawTitlePanels(g);
      break;
    case 'controls': drawControls(g); break;
    case 'intro': drawIntro(g); break;
    case 'pause': drawPause(g); break;
    case 'dialogue': drawDialogue(g); break;
    case 'dead': drawDead(g); break;
    case 'end': drawEnd(g); break;
    case 'play':
      // 12-a: HUD del modo desafío (oleada/enemigos/puntos, cuenta atrás y banner)
      if (g.challengeRun) drawChallengeOverlay(g);
      break;
    default: break;
  }
}

// ---------------- Título ----------------

// nota musical pixel (sin depender de glifos de fuente)
function drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, variant: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + s * 3, s * 2, s * 1.5);          // cabeza
  ctx.fillRect(x + s * 1.5, y, s * 0.75, s * 3.6);     // palo
  if (variant === 0) {
    ctx.fillRect(x + s * 2, y, s * 1.25, s * 1.1);     // banderín
  } else {
    ctx.fillRect(x + s * 2.6, y + s * 2.4, s * 2, s * 1.5); // segunda cabeza
    ctx.fillRect(x + s * 1.5, y, s * 3, s * 0.8);      // barra
  }
}

function drawTitle(g: Game) {
  const ctx = g.ctx;
  const t = g.globalT;
  // fondo: cielo v2 del módulo world/sky (bandas + estrellas + luna + nubes;
  // fuerza escena nocturna en title/controls) — sustituye al gradiente plano
  drawSkyBackdrop(ctx, g);
  // silueta de la cripta / obelisco
  ctx.fillStyle = '#0c0e1c';
  ctx.fillRect(VIEW_W / 2 - 30, VIEW_H - 150, 60, 150);
  ctx.fillRect(VIEW_W / 2 - 44, VIEW_H - 130, 88, 130);
  ctx.globalAlpha = 0.6 + Math.sin(t * 2) * 0.2;
  ctx.fillStyle = '#8ef0ff';
  ctx.fillRect(VIEW_W / 2 - 6, VIEW_H - 120, 12, 40);
  ctx.globalAlpha = 1;

  // niebla en 3 capas sinusoidales (profundidad)
  const fogLayer = (alpha: number, speed: number, yBase: number, w: number, h: number, col: string, seed: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const fx = ((t * speed + i * 240 + seed) % (VIEW_W + 360)) - 180;
      const fy = yBase + Math.sin(t * 0.5 + i * 1.3 + seed) * 12 + (i % 3) * 22;
      ctx.beginPath();
      ctx.ellipse(fx, fy, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  fogLayer(0.05, 10, VIEW_H - 130, 190, 30, '#9ec4b4', 40);
  fogLayer(0.08, 16, VIEW_H - 90, 170, 34, '#9ec4b4', 0);
  fogLayer(0.11, 26, VIEW_H - 48, 150, 26, '#b8d4c4', 120);

  // wisps flotantes (guard: durante HMR el módulo de sprites puede estar
  // vacío un frame — antes drawImage(undefined) lanzaba y mataba el frame)
  for (let i = 0; i < 5; i++) {
    const wx = (VIEW_W / 6) * i + Math.sin(t + i * 2) * 40 + 60;
    const wy = 330 + Math.cos(t * 0.8 + i * 1.7) * 30;
    const wisp = getSprWisp(t, i);
    if (!wisp) continue;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(wisp, wx, wy, 20, 20);
    ctx.globalAlpha = 1;
  }

  // notas musicales que ascienden (motivo: el mundo cantado)
  for (let i = 0; i < 9; i++) {
    const seed = i * 17 + 3;
    const speed = 0.045 + hashT(i, 7) * 0.04;
    const prog = (t * speed + hashT(i, 3)) % 1;
    const nx = (hashT(i, 5) * VIEW_W) + Math.sin(t * 1.4 + i * 1.9) * 16;
    const ny = VIEW_H + 20 - prog * (VIEW_H + 60);
    const na = Math.sin(prog * Math.PI) * 0.55;
    if (na <= 0.02) continue;
    drawNote(ctx, nx, ny, 2.2, `rgba(255,233,160,${na})`, i % 3 === 0 ? 1 : 0);
    drawNote(ctx, nx + 26, ny - 14, 1.7, `rgba(158,196,180,${na * 0.7})`, i % 2);
  }

  // logo con brillo periódico — R8-4: más presencia (tipografía mayor,
  // subrayado dorado con remates de rombo y eco suave bajo el trazo)
  const bob = Math.sin(t * 1.4) * 3;
  const glow = Math.pow(Math.max(0, Math.sin(t * 0.7)), 14);
  if (glow > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow * 0.55;
    textShadow(g, 'AELTHAR', VIEW_W / 2, 104 + bob, 52, '#fff3c0', '#3a2a08', 'center', true);
    ctx.restore();
  }
  textShadow(g, 'ECOS DE', VIEW_W / 2, 70 + bob, 22, '#b0b8d0', '#000', 'center', true);
  textShadow(g, 'AELTHAR', VIEW_W / 2, 104 + bob, 52, COL.gold, '#2a1a08', 'center', true);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(VIEW_W / 2 - 196, 170, 392, 3);
  pixelDiamond(ctx, VIEW_W / 2 - 203, 171, COL.gold);
  pixelDiamond(ctx, VIEW_W / 2 + 203, 171, COL.gold);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = COL.goldSoft;
  ctx.fillRect(VIEW_W / 2 - 150, 176, 300, 1);
  ctx.globalAlpha = 1;
  text(g, 'RPG 2D de acción y exploración · Actos I–V · Pasado y presente', VIEW_W / 2, 186, 17, COL.dim, 'center');

  // botones (con brillo de hover). 16-c: menú ampliado — Estadísticas y
  // Logros en una rejilla secundaria de 2 columnas (mismo lenguaje visual).
  // R8-4: más aire entre botones (46 px de alto en los principales).
  const bx = VIEW_W / 2 - 130, bw = 260;
  const sw = (bw - 8) / 2; // ancho de los botones secundarios (2 columnas)
  button(g, 'NUEVA PARTIDA', bx, 238, bw, 46, () => g.requestCreate(), 13);
  hoverCorners(g, bx, 238, bw, 46);
  if (g.hasSave()) {
    button(g, 'CONTINUAR', bx, 294, bw, 46, () => g.continueGame(), 13);
    hoverCorners(g, bx, 294, bw, 46);
    button(g, 'CONTROLES', bx, 352, sw, 34, () => { g.setState('controls'); }, 9);
    hoverCorners(g, bx, 352, sw, 34);
    button(g, 'DESAFÍO', bx + sw + 8, 352, sw, 34, () => openChallengeMenu(), 9);
    hoverCorners(g, bx + sw + 8, 352, sw, 34);
    button(g, 'ESTADÍSTICAS', bx, 394, sw, 34, () => openStatsPanel(), 9);
    hoverCorners(g, bx, 394, sw, 34);
    button(g, 'LOGROS', bx + sw + 8, 394, sw, 34, () => openLogrosPanel(), 9);
    hoverCorners(g, bx + sw + 8, 394, sw, 34);
  } else {
    button(g, 'CONTROLES', bx, 294, sw, 34, () => { g.setState('controls'); }, 9);
    hoverCorners(g, bx, 294, sw, 34);
    button(g, 'DESAFÍO', bx + sw + 8, 294, sw, 34, () => openChallengeMenu(), 9);
    hoverCorners(g, bx + sw + 8, 294, sw, 34);
    button(g, 'ESTADÍSTICAS', bx, 336, sw, 34, () => openStatsPanel(), 9);
    hoverCorners(g, bx, 336, sw, 34);
    button(g, 'LOGROS', bx + sw + 8, 336, sw, 34, () => openLogrosPanel(), 9);
    hoverCorners(g, bx + sw + 8, 336, sw, 34);
  }

  // R8-3.1: pie discreto con versión — fuera la línea del GDD y el listado
  // largo de zonas (el jugador lo pidió explícitamente)
  text(g, TITLE_FOOTER, VIEW_W / 2, VIEW_H - 26, 14, 'rgba(122,128,148,0.75)', 'center');
}

// R8-4 — remate pixel en rombo (5 filas, mismo lenguaje que ui.ts diamond)
const DIAMOND_ROWS5 = [1, 3, 5, 3, 1];
function pixelDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, col: string) {
  ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) ctx.fillRect(cx - (DIAMOND_ROWS5[i] >> 1), cy - 2 + i, DIAMOND_ROWS5[i], 1);
}

// helpers deterministas locales (evitan importar hash2 aquí)
function hashT(i: number, k: number): number {
  let h = (i + k * 57) * 2654435761;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function getSprWisp(t: number, i: number): HTMLCanvasElement {
  const frames = getSpr('wisp');
  const f = frames?.length ? frames[Math.floor(t * 3 + i) % frames.length] : (undefined as unknown as HTMLCanvasElement);
  if (!f) {
    const w = window as unknown as { __wispMiss?: unknown[] };
    if (!w.__wispMiss) w.__wispMiss = [];
    if (w.__wispMiss.length < 3) {
      w.__wispMiss.push({
        t: Math.round(performance.now()), i,
        hasFrames: !!frames, len: frames?.length ?? -1,
        hasG: !!(window as unknown as { __g?: unknown }).__g,
        heroAlba: !!getSpr('hero_alba'),
      });
    }
  }
  return f;
}

// esquinas doradas al pasar el ratón (hover más vivo)
function hoverCorners(g: Game, x: number, y: number, w: number, h: number, col = COL.gold) {
  const hov = g.mouse.x >= x && g.mouse.x <= x + w && g.mouse.y >= y && g.mouse.y <= y + h;
  if (!hov) return;
  const ctx = g.ctx;
  const c = 7;
  ctx.fillStyle = col;
  ctx.fillRect(x - 2, y - 2, c, 2); ctx.fillRect(x - 2, y - 2, 2, c);
  ctx.fillRect(x + w + 2 - c, y - 2, c, 2); ctx.fillRect(x + w, y - 2, 2, c);
  ctx.fillRect(x - 2, y + h, c, 2); ctx.fillRect(x - 2, y + h - c, 2, c);
  ctx.fillRect(x + w + 2 - c, y + h, c, 2); ctx.fillRect(x + w, y + h - c, 2, c);
}

// ---------------- Controles ----------------

const CONTROLS: [string, string][] = [
  ['Moverse', 'W A S D'],
  ['Correr (gasta Aguante)', 'Mantén Shift'],
  ['Cambiar página del grimorio', 'TAB / rueda del ratón'],
  ['Ataque ligero (combo ×3)', 'Clic izquierdo (mantén: ataque cargado)'],
  ['Ataque cargado', 'Mantén clic izquierdo y suelta'],
  ['Esquivar (i-frames)', 'Espacio'],
  ['Parada perfecta (0,2 s)', 'Clic derecho'],
  ['Habilidades ×4', 'Teclas 1 – 4'],
  ['Interactuar / hablar', 'E'],
  ['Cambiar de época (con Eco)', 'Q'],
  ['Lente del Eco: ver la otra época', 'Mantén R'],
  ['Beber poción', 'F'],
  ['Menú y mapa', 'Esc / M'],
  ['Esperar al alba (accesibilidad)', 'Shift + T'],
];

function drawControls(g: Game) {
  const ctx = g.ctx;
  ctx.fillStyle = '#0a0c1e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const pw = 640, ph = 446; // R18: 14 controles (Shift · TAB · R)
  const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2 - 10;
  panel(g, px, py, pw, ph);
  textShadow(g, 'CONTROLES', VIEW_W / 2, py + 16, 16, COL.gold, '#000', 'center', true);
  let y = py + 50;
  for (const [action, key] of CONTROLS) {
    text(g, action, px + 28, y, 15, COL.text);
    text(g, key, px + pw - 28, y, 15, COL.goldSoft, 'right');
    y += 23;
  }
  ctx.strokeStyle = COL.panelBorder;
  ctx.strokeRect(px + 20, y + 4, pw - 40, 58);
  text(g, 'Consejo del GDD: «la posición y el ritmo importan más que los números».', px + 28, y + 10, 14, COL.dim);
  text(g, 'Esquiva con los i-frames de la voltereta y clava la parada perfecta (0,2 s)', px + 28, y + 26, 14, COL.dim);
  text(g, 'para aturdir. Los enemigos grandes tienen barra de QUIEBRE.', px + 28, y + 42, 14, COL.dim);
  button(g, 'VOLVER (ESC)', VIEW_W / 2 - 90, py + ph + 12, 180, 36, () => g.setState('title'), 11);
  hoverCorners(g, VIEW_W / 2 - 90, py + ph + 12, 180, 36);
  if (g.keys.has('escape')) g.setState('title');
}

// ---------------- Intro (R15: cinemática animada) ----------------
// Las 3 diapositivas estáticas (INTRO_SLIDES se conservan arriba como
// fuente canónica de los rótulos) dejaron paso a un PRÓLOGO ANIMADO:
// personajes que interactúan sobre la historia del comienzo, letterbox,
// grano, subtítulos y SALTO por ESC / botón / E. Todo vive en
// cinematic.ts; aquí solo delegamos (el estado y el avance siguen en
// engine.advanceIntro — mismo contrato, nueva piel).

function drawIntro(g: Game) {
  drawCinematic(g);
}

// ---------------- Pausa (R8-4 · hub + capas) ----------------
//
// Arquitectura de usabilidad R8-4 (3.2-3.5):
//  · HUB de pausa: Reanudar / Estado / Equipo / Inventario / Diario /
//    Opciones / Guardar y salir — cursor de teclado (↑↓ + E) y clic.
//  · Cada sección abre una CAPA con las 5 pestañas SIEMPRE visibles arriba
//    (clic o ←→ salta entre ellas sin volver a pasar por el hub) y la
//    pestaña activa se ve clara (relleno dorado).
//  · Esc/M dentro de una capa vuelve al HUB (nunca cierra todo el menú):
//    engine.onKeyDown sigue cerrando la pausa con Esc (es un evento de
//    teclado entre frames); installLayerGuard revierte ese cierre en el
//    MISMO tick cuando hay capa abierta y la cierra solo a ella (3.4).
//  · Anti-clic-fantasma R7 intacto: todo pasa por addHit (stamps de estado
//    + pool de UiHit) y hub/capa no se dibujan en el mismo frame, así que
//    no hay hits solapados entre capas.

const SECTIONS = ['ESTADO', 'EQUIPO', 'INVENTARIO', 'DIARIO', 'ENCARGOS', 'OPCIONES'];
const SEC_TITLES = ['ESTADO DEL PORTADOR', 'ARMA Y ARMADURA', 'INVENTARIO', 'DIARIO DEL PORTADOR', 'ENCARGOS Y RELIQUIAS', 'OPCIONES Y SISTEMA'];
// filas seleccionables con ↑↓ por sección (R18: ENCARGOS = 5 misiones + 5 reliquias)
const SEC_ROWS = [5, 5, 0, 0, SIDE_QUESTS.length + RELICS.length, 0];
const HUB_ROWS = ['REANUDAR', 'ESTADO', 'EQUIPO', 'INVENTARIO', 'DIARIO', 'ENCARGOS', 'OPCIONES', 'GUARDAR Y SALIR'];

// reputaciones de VELMORA — hoisted (antes: array literal nuevo por frame)
const FACS: [string, string][] = [
  ['guardianes', 'Guardianes del Canto'],
  ['orden', 'Orden de Vesh'],
  ['circulo', 'Círculo Verde'],
  ['liga', 'Liga de Mercaderes'],
];

// números cortos para badges (evita String(n) por frame)
const NUMSTR: string[] = [];
for (let i = 0; i < 32; i++) NUMSTR.push(String(i));

// estado del menú de pausa (patrón challenge.menuOpen): la sección elegida
// PERSISTE entre aperturas — no perder el contexto al abrir/cerrar (3.2)
let pauseSec = 0;           // sección activa (0..5)
let pauseLayerOpen = false; // ¿capa de sección abierta sobre el hub?
let hubSel = 1;             // cursor del hub (0..7; arranca en ESTADO)
let rowSel = 0;             // cursor de filas dentro de la sección
let spentConf = '';         // confirmación del último gasto de atributo (3.5)
let spentConfT = -99;

// ---- borde de tecla por frame (la pausa no navega por eventos) ----
// engine.ts solo atiende Esc/M en pausa vía keydown; la navegación interna se
// lee de g.keys contra la instantánea del frame anterior. keyEdge se llama
// UNA vez por tecla y frame (readNavKeys) para no corromper el memo.
const KEY_EDGE = new WeakMap<Game, Map<string, boolean>>();
function keyEdge(g: Game, k: string): boolean {
  let m = KEY_EDGE.get(g);
  if (!m) { m = new Map(); KEY_EDGE.set(g, m); }
  const held = g.keys.has(k);
  const was = m.get(k) === true;
  m.set(k, held);
  return held && !was;
}
const NAV = { up: false, down: false, left: false, right: false, confirm: false };
function readNavKeys(g: Game) {
  NAV.up = keyEdge(g, 'arrowup') || keyEdge(g, 'w');
  NAV.down = keyEdge(g, 'arrowdown') || keyEdge(g, 's');
  NAV.left = keyEdge(g, 'arrowleft') || keyEdge(g, 'a');
  NAV.right = keyEdge(g, 'arrowright') || keyEdge(g, 'd');
  NAV.confirm = keyEdge(g, 'e') || keyEdge(g, 'enter');
}

// ---- guard de capas: Esc/M dentro de una capa vuelve al HUB (3.4) ----
// Si hay capa abierta y el motor cambia pause→play por Esc/M, se revierte
// sincrónicamente (mismo tick del evento: cero frames de juego de por
// medio, sin parpadeo) y se cierra SOLO la capa. Encadena cualquier
// onStateChange previo (hoy no hay; mañana, un integrador, también).
const UI_HOOKED = new WeakSet<Game>();
let prevUiState = '';
function installLayerGuard(g: Game) {
  if (UI_HOOKED.has(g)) return;
  UI_HOOKED.add(g);
  const prev = g.onStateChange;
  g.onStateChange = (s: GState) => {
    if (s === 'play' && prevUiState === 'pause' && pauseLayerOpen) {
      pauseLayerOpen = false; // cierra SOLO la capa actual
      audio.sfx('uiOpen');
      g.setState('pause');    // revierte el cierre global del motor
      return;
    }
    if (s !== 'pause') pauseLayerOpen = false; // pausa cerrada → capa fuera
    prevUiState = s;
    prev?.(s);
  };
}

function openSection(i: number) {
  pauseSec = i;
  rowSel = 0;
  hubSel = i + 1; // el hub recuerda la última sección (contexto)
  pauseLayerOpen = true;
  audio.sfx('uiOpen');
}

function hubAction(g: Game, i: number) {
  if (i === 0) { audio.sfx('confirm'); g.setState('play'); }
  else if (i >= 1 && i <= SECTIONS.length) openSection(i - 1);
  else { g.save(); g.setState('title'); } // save() ya se blinda en desafío
}

// gasto de un punto de atributo (clic en '+' o tecla E) — 3.5
function spendAttr(g: Game, i: number) {
  const p = g.player;
  if (!p || p.points <= 0 || i < 0 || i >= ATTR_INFO.length) return;
  const at = ATTR_INFO[i];
  p.attrs[at.id]++; p.points--;
  spentConf = `+1 ${at.name} — ${at.desc}`;
  spentConfT = g.globalT;
  audioClick();
}

function drawPause(g: Game) {
  if (!g.player) return;
  const ctx = g.ctx;
  readNavKeys(g);
  ctx.fillStyle = 'rgba(4,5,12,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const pw = 720, ph = 470;
  const px = (VIEW_W - pw) / 2, py = Math.max(0, Math.round((VIEW_H - ph) / 2));
  panel(g, px, py, pw, ph);
  if (pauseLayerOpen) drawPauseLayer(g, px, py, pw, ph);
  else drawPauseHub(g, px, py, pw, ph);
  refreshCursor(g);
  text(g, pauseLayerOpen ? 'Esc vuelve a la pausa' : 'Esc para volver al juego',
    VIEW_W / 2, Math.min(py + ph + 10, VIEW_H - 14), 15, COL.dim, 'center');
}

// ---- fila de menú reutilizable (panel + hover + selección por teclado) ----
function menuRow(g: Game, label: string, x: number, y: number, w: number, h: number,
  active: boolean, cb: () => void, size = 12): boolean {
  const hover = addHit(g, x, y, w, h, cb);
  const on = active || hover;
  panel(g, x, y, w, h, on ? COL.gold : COL.panelBorder, on ? 'rgba(60,48,24,0.9)' : COL.panel);
  textShadow(g, label, x + w / 2, y + h / 2 - size * 0.62, size, on ? COL.gold : COL.text, '#000', 'center', true);
  return hover;
}

// badge dorado pulsante (puntos de atributo sin gastar — 3.5)
function badge(g: Game, x: number, y: number, n: number) {
  const ctx = g.ctx;
  const bw = n >= 10 ? 22 : 16;
  ctx.globalAlpha = 0.7 + Math.sin(g.globalT * 5) * 0.3;
  ctx.fillStyle = COL.gold;
  ctx.fillRect(x, y, bw, 15);
  ctx.globalAlpha = 1;
  text(g, NUMSTR[n] ?? String(n), x + bw / 2, y + 2, 11, '#1a1408', 'center', true);
}

// ---------------- Pausa · HUB ----------------

function drawPauseHub(g: Game, px: number, py: number, pw: number, ph: number) {
  const p = g.player!;
  textShadow(g, '— PAUSA —', VIEW_W / 2, py + 14, 14, COL.gold, '#000', 'center', true);
  text(g, `${shortName(p.name, 20)} — Portador de nivel ${p.level}`, VIEW_W / 2, py + 38, 15, COL.dim, 'center');

  if (NAV.up) { hubSel = (hubSel + HUB_ROWS.length - 1) % HUB_ROWS.length; audio.sfx('blip'); }
  if (NAV.down) { hubSel = (hubSel + 1) % HUB_ROWS.length; audio.sfx('blip'); }
  if (NAV.confirm) hubAction(g, hubSel);

  const rx = px + 190, rw = 340;
  const sqNew = SIDE_QUESTS.filter(q => sqOn(g, q) && !sqDone(g, q)).length;
  for (let i = 0; i < HUB_ROWS.length; i++) {
    const y = py + 62 + i * 44;
    menuRow(g, HUB_ROWS[i], rx, y, rw, 38, hubSel === i, () => hubAction(g, i), 12);
    if (hubSel === i) text(g, '▸', rx - 18, y + 12, 14, COL.gold, 'center', true);
    if (i === 1 && p.points > 0) badge(g, rx + rw - 28, y + 11, p.points); // 3.5
    if (i === 5 && sqNew > 0) badge(g, rx + rw - 28, y + 11, sqNew); // R18: encargos en curso
  }
  text(g, '↑↓ elegir · E / clic confirmar · Esc reanudar', px + 24, py + ph - 24, 13, COL.dim);
  text(g, GAME_VERSION, px + pw - 24, py + ph - 24, 13, 'rgba(122,128,148,0.8)', 'right');
}

// ---------------- Pausa · capa de sección ----------------

function drawPauseLayer(g: Game, px: number, py: number, pw: number, ph: number) {
  const p = g.player!;
  // teclado de capa: ←→ pestañas · ↑↓ filas · E confirmar
  if (NAV.left) { pauseSec = (pauseSec + SECTIONS.length - 1) % SECTIONS.length; rowSel = 0; audio.sfx('blip'); }
  if (NAV.right) { pauseSec = (pauseSec + 1) % SECTIONS.length; rowSel = 0; audio.sfx('blip'); }
  const rows = SEC_ROWS[pauseSec];
  if (rows > 0) {
    if (NAV.up) { rowSel = (rowSel + rows - 1) % rows; audio.sfx('blip'); }
    if (NAV.down) { rowSel = (rowSel + 1) % rows; audio.sfx('blip'); }
  }
  if (NAV.confirm && pauseSec === 0) spendAttr(g, rowSel);
  if (NAV.confirm && pauseSec === 4) encargoAction(g, rowSel);

  // pestañas SIEMPRE visibles (3.2) con la activa en dorado
  const tw = 112, gap = 4;
  const tx0 = px + (pw - (SECTIONS.length * tw + (SECTIONS.length - 1) * gap)) / 2;
  for (let i = 0; i < SECTIONS.length; i++) {
    const tx = tx0 + i * (tw + gap), ty = py + 10;
    const on = pauseSec === i;
    const hover = addHit(g, tx, ty, tw, 28, () => {
      if (pauseSec !== i) { pauseSec = i; rowSel = 0; audio.sfx('blip'); }
    });
    panel(g, tx, ty, tw, 28, on || hover ? COL.gold : COL.panelBorder, on ? 'rgba(60,48,24,0.9)' : COL.panel);
    text(g, SECTIONS[i], tx + tw / 2, ty + 8, 10, on ? COL.gold : COL.dim, 'center', true);
    if (i === 0 && p.points > 0) badge(g, tx + tw - 12, ty - 6, p.points); // 3.5
  }

  const cx = px + 28, cy = py + 66;
  text(g, SEC_TITLES[pauseSec], cx, py + 46, 13, COL.goldSoft, 'left', true);
  text(g, '←→ pestañas · Esc volver', px + pw - 28, py + 47, 12, COL.dim, 'right');

  switch (pauseSec) {
    case 0: drawSecEstado(g, px, py, pw, cx, cy); break;
    case 1: drawSecEquipo(g, px, py, pw, cx, cy); break;
    case 2: drawSecInventario(g, cx, cy); break;
    case 3: drawSecDiario(g, px, py, pw, ph, cx, cy); break;
    case 4: drawSecEncargos(g, px, py, pw, ph, cx, cy); break;
    default: drawSecOpciones(g, px, py, pw, cx, cy); break;
  }
}

// ---------------- Sección ESTADO (3.5 · level-up claro) ----------------

function drawSecEstado(g: Game, px: number, py: number, pw: number, cx: number, cy: number) {
  const p = g.player!;
  const ctx = g.ctx;
  text(g, `${shortName(p.name, 20)} — Portador nivel ${p.level}`, cx, cy, 19, COL.goldSoft);
  bar(g, cx, cy + 26, 240, 8, p.xp / g.xpNext(p.level), COL.xp, '#241a30');
  text(g, `XP ${Math.floor(p.xp)} / ${g.xpNext(p.level)}`, cx + 250, cy + 22, 15, COL.dim);
  // aviso de puntos disponibles (pulsa mientras haya sin gastar)
  const ptsCol = p.points > 0 ? (Math.sin(g.globalT * 4) > 0 ? '#ffe86a' : '#d8b84a') : COL.dim;
  text(g, `Puntos de atributo: ${p.points}`, cx, cy + 42, 16, ptsCol);
  if (p.points > 0) text(g, '↑↓ elige · E gasta', cx + 226, cy + 44, 13, COL.gold);

  // una línea por atributo explicando qué hace (datos de ATTR_INFO) — 3.5
  const ay = cy + 68;
  for (let i = 0; i < ATTR_INFO.length; i++) {
    const at = ATTR_INFO[i];
    const y = ay + i * 30;
    const x0 = cx - 8, y0 = y - 7, w0 = pw - 56 + 16, h0 = 29;
    const sel = rowSel === i;
    const hov = g.mouse.x >= x0 && g.mouse.x <= x0 + w0 && g.mouse.y >= y0 && g.mouse.y <= y0 + h0;
    if (sel || hov) { ctx.fillStyle = 'rgba(240,200,74,0.09)'; ctx.fillRect(x0, y0, w0, h0); }
    // orden de registro: primero '+' (gana los clics dentro de la fila)
    if (p.points > 0) button(g, '+', cx + 396, y - 3, 30, 24, () => spendAttr(g, i), 13);
    addHit(g, x0, y0, w0, h0, () => { rowSel = i; });
    if (sel) text(g, '▸', cx - 20, y + 1, 14, COL.gold, 'center', true);
    text(g, at.name, cx, y, 16, sel || hov ? COL.goldSoft : COL.text);
    text(g, `${p.attrs[at.id]}`, cx + 120, y, 16, COL.goldSoft);
    text(g, at.desc, cx + 165, y + 2, 13, COL.dim); // una línea: qué hace
  }

  // confirmación del gasto (4 s) + stats derivados (verdad del motor)
  const confY = ay + ATTR_INFO.length * 30 + 6;
  if (g.globalT - spentConfT < 4) text(g, `✔ Gasto confirmado: ${spentConf}`, cx, confY, 14, COL.gold);
  text(g, `Daño melé: ${Math.round(playerMeleeDmg(p))}   Daño de Cantos: ${Math.round(playerSpellDmg(p))}   Crítico: ${Math.round(critChance(p.attrs.des))}%`, cx, confY + 20, 14, COL.dim); // R8-7: valor real de critChance
  text(g, `Vida: ${p.maxHp}   Reducción: ${Math.min(50, p.attrs.vig)}%   Resonancia máx: ${p.maxRes}`, cx, confY + 38, 14, COL.dim);

  // ---- VELMORA TE OBSERVA (reputaciones, tono y memorias) ----
  const vy0 = confY + 62;
  ctx.strokeStyle = 'rgba(90,74,48,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, vy0 - 8);
  ctx.lineTo(px + pw - 28, vy0 - 8);
  ctx.stroke();
  text(g, '◆ VELMORA TE OBSERVA ◆', cx + 246, vy0, 13, COL.gold, 'center', true);
  const dom = dominantTone(p);
  const memCount = p.memories?.length ?? 0;
  text(g, `Tono dominante: ${dom ? TONE_LABEL[dom] : 'Aún por definir'}`, cx, vy0 + 24, 15, '#c8b0e8');
  text(g, `Memorias recuperadas: ${memCount}/${Object.keys(MEMORIES).length}`, cx + 340, vy0 + 24, 15, memCount > 0 ? COL.goldSoft : COL.dim);
  const rep = p.repFacciones ?? {};
  FACS.forEach(([id, label], i) => {
    const fx = cx + (i % 2) * 336;
    const fy = vy0 + 46 + Math.floor(i / 2) * 20; // R17 (UI): filas más juntas → sitio para la armadura
    const v = rep[id] ?? 0;
    text(g, label, fx, fy, 15, COL.text);
    const vc = v > 0 ? '#8ef0b0' : v < 0 ? '#ff7060' : COL.dim;
    text(g, `${v > 0 ? '+' : ''}${v}`, fx + 300, fy, 15, vc, 'right');
  });
  // 14-b: armadura activa (fila compacta, contrato armor.ts). R17 (UI): se ancla
  // bajo la última fila de facciones (antes iba fija en py+438 y la pisaba)
  drawArmorRow(g, cx, vy0 + 46 + Math.ceil(FACS.length / 2) * 20 + 4, pw - 56);
}

// ---------------- Sección EQUIPO (3.3 · equipado intuitivo) ----------------

function armorExtras(a: ArmorDef): string {
  const ex: string[] = [];
  if (a.staRegen) ex.push(`+${a.staRegen} vigor/s`);
  if (a.slow) ex.push('−8% velocidad');
  if (a.reflect) ex.push(`refleja ${Math.round(a.reflect * 100)}% melé`);
  return ex.length ? ` · ${ex.join(' · ')}` : '';
}

function slotBox(g: Game, x: number, y: number, w: number, h: number, label: string, name: string, stat: string) {
  panel(g, x, y, w, h, COL.panelBorder, 'rgba(16,18,30,0.9)');
  text(g, label, x + 12, y + 8, 11, COL.gold, 'left', true);
  text(g, name, x + 12, y + 26, 15, COL.goldSoft);
  text(g, stat, x + 12, y + 50, 13, COL.dim);
}

function drawSecEquipo(g: Game, px: number, py: number, pw: number, cx: number, cy: number) {
  const p = g.player!;
  const ctx = g.ctx;
  const act = armorActive(g);
  const actRed = act?.red ?? 0;

  // slots actuales arriba (3.3): arma y armadura en marcha
  slotBox(g, cx, cy, 326, 78, 'ARMA ACTUAL',
    `${p.discipline === 'alba' ? 'Espada y escudo del Alba' : 'Báculo del Tejedor'} +${p.weaponPlus}`,
    `Daño melé ${Math.round(playerMeleeDmg(p))} · Daño de Cantos ${Math.round(playerSpellDmg(p))}`);
  slotBox(g, cx + 338, cy, 326, 78, 'ARMADURA ACTUAL',
    act?.name ?? 'Ninguna',
    act ? `Daño recibido −${Math.round(actRed * 100)}%${armorExtras(act)}` : 'la forja de Toln vende corazas');

  // CÓMO SE EQUIPA — la duda real del jugador, resuelta por escrito
  const hint = wrapText('◆ Cómo se equipa: las corazas se equipan SOLAS — siempre llevas la de MAYOR defensa que poseas. Cómpralas (y mejora tu arma) en la forja de Toln, en Lunaris.', 88);
  hint.forEach((l, i) => text(g, l, cx, cy + 88 + i * 15, 13, COL.goldSoft));

  // mejora de arma (comparación con la siguiente)
  text(g, 'MEJORA DE ARMA', cx, cy + 128, 11, COL.gold, 'left', true);
  text(g, p.weaponPlus >= 5
    ? 'Mejora máxima: +5 (Toln: «es lo que da de sí esta forja»)'
    : `Siguiente: +${p.weaponPlus + 1} → +2,5 daño melé · ${30 + p.weaponPlus * 25} coronas · forja de Toln`,
    cx + 176, cy + 128, 14, p.weaponPlus >= 5 ? COL.dim : '#ffe9a0'); // R17 (UI): tras el título (14 glifos × 11 px)

  // corazas del inventario con stats COMPARADAS (verde/rojo) — 3.3
  text(g, 'CORAZAS', cx, cy + 152, 11, COL.gold, 'left', true);
  text(g, '↑↓ o clic para comparar', px + pw - 28, cy + 152, 12, COL.dim, 'right');
  const ry = cy + 170;
  for (let i = 0; i < ARMORS.length; i++) {
    const a = ARMORS[i];
    const y = ry + i * 28;
    const equipped = (act?.tier ?? 0) === a.tier;
    const owned = !!g.flags[a.id];
    const sel = rowSel === i;
    const x0 = cx - 8, y0 = y - 6, w0 = pw - 56 + 16, h0 = 26;
    const hov = g.mouse.x >= x0 && g.mouse.x <= x0 + w0 && g.mouse.y >= y0 && g.mouse.y <= y0 + h0;
    if (sel || hov) { ctx.fillStyle = 'rgba(240,200,74,0.09)'; ctx.fillRect(x0, y0, w0, h0); }
    addHit(g, x0, y0, w0, h0, () => { rowSel = i; });
    if (sel) text(g, '▸', cx - 20, y, 14, COL.gold, 'center', true);
    text(g, a.name, cx, y, 15, equipped ? COL.gold : sel || hov ? COL.goldSoft : COL.text);
    text(g, `−${Math.round(a.red * 100)}%`, cx + 196, y, 15, COL.text);
    // delta vs la equipada: verde si mejora, rojo si empeora
    const d = Math.round((a.red - actRed) * 100);
    if (d > 0) text(g, `+${d}% def`, cx + 248, y, 15, '#8ef0b0');
    else if (d < 0) text(g, `${d}% def`, cx + 248, y, 15, '#ff7060');
    else text(g, '=', cx + 256, y, 15, COL.dim);
    if (equipped) text(g, '◆ EQUIPADA', px + pw - 40, y, 14, COL.gold, 'right');
    else if (owned) text(g, 'comprada · en el baúl', px + pw - 40, y, 14, COL.dim, 'right');
    else if (a.needFlag && !g.flags[a.needFlag]) text(g, `${a.cost} coronas · fin del Acto II`, px + pw - 40, y, 14, 'rgba(154,160,184,0.75)', 'right');
    else text(g, `${a.cost} coronas · forja`, px + pw - 40, y, 14, COL.dim, 'right');
  }

  // detalle de la coraza seleccionada (siempre visible bajo la lista)
  const a = ARMORS[Math.max(0, Math.min(rowSel, ARMORS.length - 1))];
  const equipped = (act?.tier ?? 0) === a.tier;
  const owned = !!g.flags[a.id];
  const dy = ry + ARMORS.length * 28 + 8;
  panel(g, cx - 8, dy, pw - 56 + 16, 60, COL.panelBorder);
  wrapText(a.desc, 86).forEach((l, i) => text(g, l, cx + 6, dy + 8 + i * 14, 13, COL.text));
  text(g, equipped
    ? 'Tu coraza activa: la de mayor defensa que posees.'
    : owned
      ? 'Guardada en el baúl: se equipa sola la de mayor defensa.'
      : a.needFlag && !g.flags[a.needFlag]
        ? 'Toln solo la forja para quien ha oído el tercer canto hasta el final.'
        : 'A la venta en la forja de Toln.',
    cx + 6, dy + 40, 13, COL.quest);
}

// ---------------- Sección INVENTARIO (nueva · 3.2) ----------------

function drawSecInventario(g: Game, cx: number, cy: number) {
  const p = g.player!;
  text(g, 'CONSUMIBLES', cx, cy, 11, COL.gold, 'left', true);
  text(g, `Pociones de vida ×${p.potions}`, cx, cy + 22, 16, COL.text);
  text(g, 'beber con F', cx + 320, cy + 24, 13, COL.dim);
  const sen = Number(g.flags.sennuelos ?? 0);
  text(g, `Señuelo de caza ×${sen}`, cx, cy + 44, 16, sen > 0 ? COL.text : COL.dim);
  text(g, 'usar con 8 (atrae a los enemigos)', cx + 320, cy + 46, 13, COL.dim);
  text(g, `Coronas: ${p.gold}`, cx, cy + 66, 16, '#ffe9a0');
  text(g, 'la forja y la tienda de Lunaris aceptan', cx + 320, cy + 68, 13, COL.dim);

  text(g, 'OBJETOS CLAVE', cx, cy + 98, 11, COL.gold, 'left', true);
  let ky = cy + 120;
  let any = false;
  for (const [flag, id] of KEY_ITEM_FLAGS) {
    if (!g.flags[flag]) continue;
    const it = KEY_ITEMS[id];
    if (!it) continue;
    any = true;
    text(g, `◆ ${it.name}`, cx, ky, 16, id === 'fragment' ? COL.text : '#ffe9a0');
    text(g, it.desc, cx + 16, ky + 17, 13, COL.dim);
    ky += 36;
  }
  if (!any) {
    text(g, '(aún no llevas ninguno: los Ecos y la historia te darán objetos)', cx, ky, 14, COL.dim);
    ky += 24;
  }
  text(g, g.companion
    ? 'Compañera: Ilwen (Arquera Sylvar) — órdenes con T; te cubre con su arco'
    : 'Compañeros: ninguno aún (Ilwen espera en el Bosque Susurrante)',
    cx, ky + 12, 14, COL.dim);
}

// ---------------- Sección DIARIO (3.4 · cadena sin fugas) ----------------

function drawSecDiario(g: Game, px: number, py: number, pw: number, ph: number, cx: number, cy: number) {
  const p = g.player!;
  // cabecera de la cadena: dónde estás (paso actual) y cuántas quedan
  text(g, 'CADENA PRINCIPAL', cx, cy, 11, COL.gold, 'left', true);
  text(g, `Misión ${Math.min(g.questIdx + 1, QUESTS.length)} de ${QUESTS.length}`, cx + 300, cy + 1, 13, COL.dim, 'right');
  let y = cy + 22;
  for (let i = 0; i < QUESTS.length; i++) {
    // sub-cabecera del Acto II justo antes de q6 (leída de QUESTS)
    if (i === 5) {
      y += 4;
      text(g, '◆ ACTO II · LAS NOTAS PERDIDAS', cx, y, 14, g.questIdx >= 5 ? COL.quest : 'rgba(142,240,176,0.45)');
      y += 20;
    }
    const q = QUESTS[i];
    const done = i < g.questIdx;
    const active = i === g.questIdx;
    text(g, `${done ? '✔' : active ? '◆' : '·'} ${q.name}`, cx, y, 16, done ? '#6a8a6a' : active ? COL.quest : COL.dim);
    y += 18;
    if (active) {
      // CADENA de la misión activa: hechos ✔ · actual ▸ · lo que viene ·
      for (let j = 0; j < q.steps.length; j++) {
        const mark = j < g.questStep ? '✔' : j === g.questStep ? '▸' : '·';
        const col = j < g.questStep ? '#6a8a6a' : j === g.questStep ? COL.text : 'rgba(154,160,184,0.7)';
        let stText = q.steps[j];
        if (j === g.questStep) {
          const pt = g.questProgressText(); // contadores vivos del motor (q2)
          if (pt) stText = pt;
        }
        const lines2 = wrapText(stText, 44);
        for (let k = 0; k < lines2.length; k++) {
          text(g, k === 0 ? `${mark} ${lines2[k]}` : `  ${lines2[k]}`, cx + 12, y, 14, col);
          y += 14;
        }
      }
      y += 4;
      if (i + 1 < QUESTS.length) {
        text(g, `Después: ${QUESTS[i + 1].name}`, cx + 12, y, 13, 'rgba(154,160,184,0.75)');
        y += 15;
      }
    } else if (ZONE_TEASERS[q.id] && i > g.questIdx) {
      // rumor de zona nueva: solo mientras la misión siga en el futuro
      text(g, `   ${ZONE_TEASERS[q.id]}`, cx, y, 13, 'rgba(154,160,184,0.75)');
      y += 14;
    }
  }
  if (g.questIdx >= QUESTS.length) text(g, '✔ Cadena completa. Velmora vuelve a cantar.', cx, y + 2, 14, COL.gold);
  text(g, `Ecos menores escuchados: ${g.takenEchoes.size}`, cx, py + ph - 52, 14, COL.dim);
  text(g, `Enemigos derrotados: ${p.kills} · Muertes: ${p.deaths}`, cx, py + ph - 32, 14, COL.dim);

  // ---- memorias del Portador (biblia: cada Eco devuelve un recuerdo) ----
  // Máximo 3 líneas por recuerdo para que la columna nunca desborde.
  const mx0 = cx + 316;
  text(g, 'MEMORIAS DEL PORTADOR', mx0, cy, 11, COL.gold, 'left', true);
  let my = cy + 20;
  const got = p.memories ?? [];
  for (const mid of Object.keys(MEMORIES)) {
    const m = MEMORIES[mid];
    const unlocked = got.includes(mid);
    text(g, unlocked ? m.title : '??? · Recuerdo perdido', mx0, my, 14, unlocked ? COL.goldSoft : COL.dim);
    my += 15;
    if (unlocked) {
      const all = wrapText(m.text, 58);
      const shown = all.slice(0, 3);
      if (all.length > 3 && shown.length === 3) {
        shown[2] = shown[2].replace(/[.,;:]?$/, '…');
      }
      shown.forEach((l, i) => text(g, l, mx0, my + i * 13, 13, COL.text));
      my += shown.length * 13 + 3;
    } else {
      text(g, LOCKED_HINT[mid] ?? 'La Niebla aún oculta este recuerdo.', mx0, my, 13, 'rgba(154,160,184,0.75)');
      my += 16;
    }
    // divisor sutil entre memorias
    g.ctx.strokeStyle = 'rgba(90,74,48,0.45)';
    g.ctx.lineWidth = 1;
    g.ctx.beginPath();
    g.ctx.moveTo(mx0, my);
    g.ctx.lineTo(mx0 + 330, my);
    g.ctx.stroke();
    my += 7;
  }
}

// ---------------- Sección ENCARGOS (R18 · misiones secundarias + reliquias) ----------------
// Filas 0..4: misiones (E fija la que sigue el HUD) · filas 5..9: reliquias
// (E equipa la elegida; E sobre la equipada la guarda).

function encargoAction(g: Game, row: number) {
  const nq = SIDE_QUESTS.length;
  if (row < nq) {
    const q = SIDE_QUESTS[row];
    if (!sqOn(g, q) || sqDone(g, q)) { audio.sfx('error'); return; }
    sqPin(g, q.id);
    audio.sfx('confirm');
    return;
  }
  const r = RELICS[row - nq];
  if (!r) return;
  if (!relicOwned(g, r.id)) { audio.sfx('error'); return; }
  equipRelic(g, relicIs(g, r.id) ? null : r.id);
}

function drawSecEncargos(g: Game, px: number, py: number, pw: number, ph: number, cx: number, cy: number) {
  const ctx = g.ctx;
  const nq = SIDE_QUESTS.length;
  const done = SIDE_QUESTS.filter(q => sqDone(g, q)).length;
  text(g, 'MISIONES SECUNDARIAS', cx, cy, 11, COL.gold, 'left', true);
  text(g, `${done}/${nq} completadas`, cx + 388, cy + 1, 13, COL.dim, 'right');
  const pinned = sqTracked(g)?.q.id;
  const colW = 396;
  let y = cy + 20;
  for (let i = 0; i < nq; i++) {
    const q = SIDE_QUESTS[i];
    const on = sqOn(g, q), fin = sqDone(g, q);
    const sel = rowSel === i;
    const h = 60;
    const hov = addHit(g, cx - 8, y - 4, colW + 8, h - 4, () => { if (rowSel === i) encargoAction(g, i); else rowSel = i; });
    if (sel || hov) { ctx.fillStyle = 'rgba(240,200,74,0.09)'; ctx.fillRect(cx - 8, y - 4, colW + 8, h - 4); }
    if (sel) text(g, '▸', cx - 20, y, 14, COL.gold, 'center', true);
    const where = MAPS[q.map]?.name ?? q.map;
    if (!on && !fin) {
      text(g, '? Encargo sin descubrir', cx, y, 15, COL.dim);
      text(g, `Alguien espera en ${where}.`, cx + 12, y + 18, 13, 'rgba(154,160,184,0.75)');
    } else {
      const mark = fin ? '✔' : pinned === q.id ? '◆' : '·';
      text(g, `${mark} ${q.name}`, cx, y, 15, fin ? '#6a8a6a' : pinned === q.id ? COL.quest : COL.goldSoft);
      text(g, `${q.giverName} · ${where}`, cx + colW - 6, y + 2, 12, COL.dim, 'right');
      if (fin) {
        const r = RELICS.find(x => x.id === q.reward.relic);
        text(g, `Entregada · recompensa: ${r?.name ?? 'reliquia'}`, cx + 12, y + 18, 13, '#6a8a6a');
      } else {
        const cur = sqCurrent(g, q) ?? '';
        wrapText(`▸ ${cur}`, 54).slice(0, 2).forEach((l, k) => text(g, l, cx + 12, y + 18 + k * 14, 13, COL.text));
      }
    }
    y += h;
  }

  // reliquias (columna derecha)
  const rx = cx + colW + 24, rw = pw - (rx - px) - 28;
  text(g, 'RELIQUIAS', rx, cy, 11, COL.gold, 'left', true);
  const eq = relicEquipped(g);
  text(g, eq ? 'una equipada a la vez' : 'ninguna equipada', rx + rw, cy + 1, 12, COL.dim, 'right');
  let ry = cy + 20;
  for (let j = 0; j < RELICS.length; j++) {
    const r = RELICS[j];
    const row = nq + j;
    const own = relicOwned(g, r.id);
    const isEq = eq === r.id;
    const sel = rowSel === row;
    const h = 60;
    const hov = addHit(g, rx - 6, ry - 4, rw + 10, h - 4, () => { if (rowSel === row) encargoAction(g, row); else rowSel = row; });
    if (sel || hov) { ctx.fillStyle = 'rgba(240,200,74,0.09)'; ctx.fillRect(rx - 6, ry - 4, rw + 10, h - 4); }
    if (sel) text(g, '▸', rx - 16, ry + 4, 14, COL.gold, 'center', true);
    // ficha del icono
    ctx.fillStyle = own ? 'rgba(20,18,30,0.95)' : 'rgba(14,14,20,0.8)';
    ctx.fillRect(rx, ry, 30, 30);
    ctx.strokeStyle = isEq ? COL.gold : own ? r.color : '#3a3a48';
    ctx.lineWidth = isEq ? 2 : 1;
    ctx.strokeRect(rx + 0.5, ry + 0.5, 29, 29);
    text(g, own ? r.icon : '?', rx + 15, ry + 6, 16, own ? r.color : '#4a4a58', 'center');
    if (own) {
      text(g, r.name, rx + 40, ry, 14, isEq ? COL.gold : COL.goldSoft);
      wrapText(r.desc, 30).slice(0, 2).forEach((l, k) => text(g, l, rx + 40, ry + 17 + k * 13, 12, COL.text));
      if (isEq) text(g, '◆', rx + rw, ry, 13, COL.gold, 'right');
    } else {
      const q = SIDE_QUESTS.find(x => x.reward.relic === r.id);
      text(g, 'Reliquia oculta', rx + 40, ry, 14, COL.dim);
      text(g, q ? `Recompensa de «${q.name}»` : '', rx + 40, ry + 17, 12, 'rgba(154,160,184,0.75)');
    }
    ry += h;
  }
  text(g, '↑↓ elegir · E fija la misión en el HUD / equipa la reliquia', cx, py + ph - 26, 13, COL.dim);
}

// ---------------- Sección OPCIONES (antes SISTEMA) ----------------

function drawSecOpciones(g: Game, px: number, py: number, pw: number, cx: number, cy: number) {
  text(g, 'VOLUMEN DE MÚSICA', cx, cy, 16, COL.text);
  drawSlider(g, cx, cy + 26, 300, v => { audioSetMusic(g, v); }, g.musicVolUi);
  text(g, 'VOLUMEN DE EFECTOS', cx, cy + 76, 16, COL.text);
  drawSlider(g, cx, cy + 102, 300, v => { audioSetSfx(g, v); }, g.sfxVolUi);
  text(g, '(haz clic o arrastra sobre las barras)', cx + 320, cy + 104, 13, COL.dim);
  text(g, '«La música adaptativa añade una capa de combate cuando', cx, cy + 150, 15, COL.dim);
  text(g, 'los enemigos te ven, y cada región tiene su melodía.»', cx, cy + 168, 15, COL.dim);
  // dificultad dinámica del mundo (12-c): AUTO por defecto, editable aquí
  drawBalancePanel(g, cx, cy + 196, pw - 56);
  button(g, 'GUARDAR Y SALIR AL TÍTULO', cx, py + 374, 280, 40, () => {
    g.save();
    g.setState('title');
  }, 11);
  hoverCorners(g, cx, py + 374, 280, 40);
  text(g, '(el juego también autoguarda en Santuarios y al cambiar de zona)', cx, py + 424, 14, COL.dim);
}

function drawSlider(g: Game, x: number, y: number, w: number, cb: (v: number) => void, cur: number) {
  const ctx = g.ctx;
  addHit(g, x, y - 4, w, 22, () => {
    const v = Math.max(0, Math.min(1, (g.mouse.x - x) / w));
    cb(v);
  });
  bar(g, x, y, w, 14, cur, COL.res, '#123038');
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + cur * w - 3, y - 3, 6, 20);
}

function audioClick() { audio.sfx('select'); }
function audioSetMusic(g: Game, v: number) {
  g.musicVolUi = v; audio.setMusicVol(v * 0.9);
  try { localStorage.setItem('ecos-vol', JSON.stringify({ m: g.musicVolUi, s: g.sfxVolUi })); } catch { /* noop */ }
}
function audioSetSfx(g: Game, v: number) {
  g.sfxVolUi = v; audio.setSfxVol(v * 0.9);
  try { localStorage.setItem('ecos-vol', JSON.stringify({ m: g.musicVolUi, s: g.sfxVolUi })); } catch { /* noop */ }
}

// ---------------- Diálogo ----------------

function drawDialogue(g: Game) {
  const ctx = g.ctx;
  const node = g.dlgNode;
  if (!node) return;
  const bw = VIEW_W - 80, bx = 40;
  // la caja crece según texto y opciones para que nunca se solapen
  const fullLines = wrapText(node.text, 76).length;
  const nOpts = node.options?.length ?? 0;
  const bh = Math.max(150, 46 + fullLines * 19 + (nOpts > 0 ? nOpts * 26 + 14 : 0));
  const by = VIEW_H - bh - 24;
  ctx.fillStyle = 'rgba(4,5,12,0.4)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, bx, by, bw, bh, '#6a5a38', 'rgba(10,12,22,0.96)');
  // borde doble pulido + remaches
  ctx.strokeStyle = 'rgba(240,200,74,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 4.5, by + 4.5, bw - 9, bh - 9);
  ctx.fillStyle = COL.gold;
  for (const [cxx, cyy] of [[bx + 7, by + 7], [bx + bw - 7, by + 7], [bx + 7, by + bh - 7], [bx + bw - 7, by + bh - 7]]) {
    ctx.fillRect(cxx - 1.5, cyy - 1.5, 3, 3);
  }

  // retrato pixel (respira 1px y parpadea de vez en cuando)
  const pkey = mapPortrait(node.portrait);
  const blink = (g.globalT % 3.7) < 0.14;
  const bob = Math.round(Math.sin(g.globalT * 2.3) * 0.9);
  const frS = 74;
  const frX = bx + 14, frY = by + 14;
  ctx.fillStyle = '#0e0c18';
  ctx.fillRect(frX, frY, frS, frS);
  drawPortrait(ctx, pkey, frX + (frS - 28 * 1.72) / 2, frY + (frS - 40 * 1.72) / 2 + bob, 1.72, blink, performance.now());
  ctx.strokeStyle = '#6a5a38';
  ctx.strokeRect(frX, frY, frS, frS);
  ctx.strokeStyle = 'rgba(240,200,74,0.35)';
  ctx.strokeRect(frX + 2.5, frY + 2.5, frS - 5, frS - 5);

  // nombre y texto
  text(g, node.name, bx + 104, by + 12, 17, COL.goldSoft);
  const shown = node.text.slice(0, Math.floor(g.dlgCharT));
  const lines = wrapText(shown, 76);
  lines.forEach((l, i) => text(g, l, bx + 104, by + 36 + i * 19, 17, COL.text));

  // opciones (debajo de la última línea de texto, sin solaparse nunca)
  if (node.options && node.options.length > 0 && g.dlgCharT >= node.text.length) {
    const oy = by + 36 + fullLines * 19 + 12;
    for (let i = 0; i < node.options.length; i++) {
      const opt = node.options[i];
      const selected = g.dlgSel === i;
      const ox = bx + 104;
      const hover = addHit(g, ox, oy + i * 26, 400, 24, () => {
        g.dlgSel = i;
        g.advanceDialogue();
      });
      if (selected || hover) {
        ctx.fillStyle = 'rgba(240,200,74,0.14)';
        ctx.fillRect(ox - 4, oy + i * 26, 404, 24);
      }
      text(g, `${selected ? '▸' : ' '} ${opt.text}`, ox, oy + i * 26 + 3, 16, selected || hover ? COL.gold : COL.text);
    }
  } else if (g.dlgCharT >= node.text.length) {
    if (Math.sin(g.globalT * 5) > -0.2) text(g, 'E ▸', bx + bw - 44, by + bh - 30, 16, COL.dim, 'center');
  }
}

/**
 * Claves de retrato: las existentes se mantienen y se añaden las de
 * los nuevos personajes de la biblia. drawPortrait ya aplica fallback
 * seguro a 'wisp' para cualquier clave desconocida.
 */
function mapPortrait(p: string): string {
  switch (p) {
    case 'brisa': return 'brisa';
    case 'toln': return 'toln';
    case 'ilwen': return 'ilwen';
    case 'fragment': return 'fragment';
    case 'guardian': return 'guardian';
    case 'sombra': return 'sombra';
    case 'sanctuary': return 'sanctuary';
    case 'wisp': return 'wisp';
    case 'sasha': return 'sasha';
    case 'brokk': return 'brokk';
    case 'maelis': return 'maelis';
    case 'corvin': return 'corvin';
    case 'kael': return 'kael';
    case 'inquisidor': return 'inquisidor';
    case 'vesh': return 'inquisidor';
    case 'teo': return 'teo';
    case 'doran': return 'doran';
    case 'nimue': return 'nimue';
    default: return hasPortrait(p) ? p : 'wisp'; // R18: aldara, fenna, bram, ysolde, haldor…
  }
}

// ---------------- Muerte ----------------

function drawDead(g: Game) {
  const ctx = g.ctx;
  ctx.fillStyle = 'rgba(20,4,8,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  textShadow(g, 'HAS CAÍDO', VIEW_W / 2, 170, 34, '#c8384a', '#000', 'center', true);
  const p = g.player!;
  const lost = g.lastGoldLost; // oro REAL perdido (calculado en playerDied)
  const lines = [
    'La Niebla Muda susurra tu nombre...',
    lost > 0 ? `Dejas un eco con ${lost} coronas donde caíste. Vuelve por él.` : 'Tu oro queda contigo... esta vez.',
    '',
    'Pulsa E para despertar en el último Santuario',
  ];
  lines.forEach((l, i) => text(g, l, VIEW_W / 2, 250 + i * 30, 18, i === 3 ? COL.goldSoft : COL.dim, 'center'));
  // R16 (#26 QA): botón clicable (antes solo E/Enter — inaccesible con ratón)
  button(g, 'DESPERTAR  (E)', VIEW_W / 2 - 110, 400, 220, 40, () => g.respawn(), 13);
  void p;
}

// ---------------- Final de la demo (estadísticas escalonadas) ----------------

let endArmed = false;
let endStartT = 0;

function drawEnd(g: Game) {
  const ctx = g.ctx;
  if (!endArmed) { endArmed = true; endStartT = g.globalT; }
  const elapsed = g.globalT - endStartT;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#0a0c1e');
  grad.addColorStop(1, '#241a30');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0; i < 60; i++) {
    const x = (i * 149.3) % VIEW_W;
    const y = (i * 91.7) % VIEW_H;
    ctx.fillStyle = `rgba(240,200,74,${0.2 + Math.abs(Math.sin(g.globalT + i)) * 0.5})`;
    ctx.fillRect(x, y, 2, 2);
  }
  // Ecos mayores recuperados (de los 7 en que se quebró el canto de Aelthar)
  const ecoCount = (g.flags.ecoVoz ? 1 : 0) + (g.flags.ecoMareas ? 1 : 0) + (g.flags.ecoCumbres ? 1 : 0);
  const acto2End = g.questIdx >= 9; // el mismo cierre sirve al Acto I o al Acto II (motor)
  textShadow(g, acto2End ? 'TRES NOTAS COMPLETAS' : 'PRIMERA NOTA COMPLETA', VIEW_W / 2, 90, 18, COL.goldSoft, '#000', 'center', true);
  textShadow(g, 'GRACIAS POR JUGAR LA DEMO', VIEW_W / 2, 130, 26, COL.gold, '#2a1a08', 'center', true);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(VIEW_W / 2 - 160, 175, 320, 2);

  const p = g.player!;
  // estadísticas una a una (cada 0.4 s) + memorias + Ecos del Acto II
  const statLines = g.endStats.split('\n');
  const lines = [
    ...statLines,
    `Memorias recuperadas: ${(p.memories?.length ?? 0)}/${Object.keys(MEMORIES).length}`,
    `Ecos recuperados: ${ecoCount} de 7`,
  ];
  const panelH = 34 + lines.length * 26 + 10;
  panel(g, VIEW_W / 2 - 250, 200, 500, panelH, COL.panelBorder);
  lines.forEach((l, i) => {
    const la = Math.max(0, Math.min(1, (elapsed - 0.6 - i * 0.4) / 0.35));
    if (la <= 0) return;
    ctx.globalAlpha = la;
    // pequeño deslizamiento vertical al aparecer
    const off = (1 - la) * 8;
    text(g, l, VIEW_W / 2, 216 + i * 26 + off, 17, COL.text, 'center');
  });
  ctx.globalAlpha = 1;

  // cita final tras las estadísticas (los Ecos restantes dependen del acto)
  const qa = Math.max(0, Math.min(1, (elapsed - 0.6 - lines.length * 0.4) / 0.5));
  ctx.globalAlpha = qa;
  text(g, '«Cuando el miedo te hable, canta más alto.»', VIEW_W / 2, 396, 19, COL.epochPast, 'center');
  text(g, '— Anciana Brisa', VIEW_W / 2, 418, 15, COL.dim, 'center');
  const restantes = NUM_ES[Math.max(0, Math.min(7, 7 - ecoCount))];
  text(g, `Los otros ${restantes} Ecos aguardan en Velmora...`, VIEW_W / 2, 448, 16, COL.dim, 'center');
  ctx.globalAlpha = 1;
  button(g, 'VOLVER AL TÍTULO (ENTER)', VIEW_W / 2 - 140, VIEW_H - 60, 280, 40, () => g.setState('title'), 11);
  hoverCorners(g, VIEW_W / 2 - 140, VIEW_H - 60, 280, 40);
}
