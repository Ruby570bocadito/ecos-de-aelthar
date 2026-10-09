// ============================================================
// ECOS DE AELTHAR — Helpers de UI para canvas
// R5-O9: cachés de strings de fuente, de estado de canvas y de wrapText
// (ver notas junto a cada caché). Firmas y aspecto píxel-iguales.
// ============================================================

import type { UiHit } from './engine';
import type { Game } from './engine';
import { VIEW_W } from './consts';

export const COL = {
  gold: '#f0c84a',
  goldSoft: '#ffe9a0',
  hp: '#e05548',
  hpBg: '#3a1a18',
  sta: '#7ec850',
  staBg: '#1c2e18',
  res: '#5ad0e8',
  resBg: '#123038',
  xp: '#c8a0f0',
  panel: 'rgba(12,14,24,0.92)',
  panelBorder: '#5a4a30',
  text: '#e8e4d8',
  dim: '#9aa0b8',
  quest: '#8ef0b0',
  boss: '#b48fff',
  bossBg: '#2a1a3a',
  danger: '#ff7060',
  epochPast: '#ffd88a',
  epochNow: '#a8b8d8',
  // R3-A3 — acentos de combate v2 (coherentes con la paleta de arriba y con
  // GUARDIAN_PHASE_GLOW de actors/enemies.ts: p3=#ff5a4a, p2≈dorado, p1=#7ee8ff)
  hpLow: '#ff5a4a',   // vida crítica (<30%)
  hpMid: '#f0a03a',   // vida media (<60%)
  phase: '#7ee8ff',   // acento de fase de jefe / quiebre
};

// R5-O9 — caché de strings de fuente por tamaño: fTitle/fBody se llaman
// decenas de veces por frame (HUD + toasts + floats vía fx.ts) y cada template
// literal era una alocación nueva. Tamaños usados: pocos; tope 64 con reset.
const FONT_TITLE_CACHE = new Map<number, string>();
const FONT_BODY_CACHE = new Map<number, string>();

export function fTitle(px: number): string {
  let s = FONT_TITLE_CACHE.get(px);
  if (s === undefined) {
    s = `${px}px "Press Start 2P", monospace`;
    if (FONT_TITLE_CACHE.size >= 64) FONT_TITLE_CACHE.clear();
    FONT_TITLE_CACHE.set(px, s);
  }
  return s;
}

export function fBody(px: number): string {
  let s = FONT_BODY_CACHE.get(px);
  if (s === undefined) {
    s = `${px}px "VT323", "Press Start 2P", monospace`;
    if (FONT_BODY_CACHE.size >= 64) FONT_BODY_CACHE.clear();
    FONT_BODY_CACHE.set(px, s);
  }
  return s;
}

// R5-O9 — asignar ctx.font es la operación cara (invalida métricas internas);
// leer el getter es barato. Como el navegador NORMALIZA el string (comillas,
// orden), aprendemos UNA sola vez por string de fuente cómo lo serializa
// ctx.font y comparamos contra esa serialización antes de asignar. Es seguro
// aunque otros módulos toquen ctx.font directamente (render/toasts/fx lo
// hacen): si el getter no coincide con lo esperado, simplemente se reasigna.
const FONT_SER_CACHE = new Map<string, string>();

function ensureFont(ctx: CanvasRenderingContext2D, font: string): void {
  const ser = FONT_SER_CACHE.get(font);
  if (ser === undefined) {
    ctx.font = font; // primera vez: asigna y aprende la serialización real
    if (FONT_SER_CACHE.size >= 64) FONT_SER_CACHE.clear();
    FONT_SER_CACHE.set(font, ctx.font);
  } else if (ctx.font !== ser) {
    ctx.font = font; // solo si la fuente vigente es OTRA
  }
}

export function text(
  g: Game, str: string, x: number, y: number,
  size: number, color = COL.text, align: CanvasTextAlign = 'left', title = false,
) {
  const ctx = g.ctx;
  // R5-O9 — solo se toca font/align/baseline/fillStyle si difiere de lo
  // vigente: el estado final del contexto es IDÉNTICO al de antes.
  ensureFont(ctx, title ? fTitle(size) : fBody(size));
  if (ctx.textAlign !== align) ctx.textAlign = align;
  if (ctx.textBaseline !== 'top') ctx.textBaseline = 'top';
  if (ctx.fillStyle !== color) ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function textShadow(
  g: Game, str: string, x: number, y: number,
  size: number, color = COL.text, shadow = '#000', align: CanvasTextAlign = 'left', title = false,
) {
  const ctx = g.ctx;
  // R5-O9 — mismas garantías que text(): comparar antes de asignar. Los
  // colores llegan como literales de los llamadores (internados, sin alocar
  // por frame); el string fijo interno de sombra tampoco cambia por frame.
  ensureFont(ctx, title ? fTitle(size) : fBody(size));
  if (ctx.textAlign !== align) ctx.textAlign = align;
  if (ctx.textBaseline !== 'top') ctx.textBaseline = 'top';
  if (ctx.fillStyle !== shadow) ctx.fillStyle = shadow;
  ctx.fillText(str, x + 2, y + 2);
  if (ctx.fillStyle !== color) ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// R5-O9 — núcleo original de wrapText (lógica idéntica), como ayuda privada.
function wrapTextUncached(str: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const para of str.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if ((line + ' ' + word).trim().length > maxChars) {
        if (line) out.push(line.trim());
        line = word;
      } else {
        line = (line + ' ' + word).trim();
      }
    }
    out.push(line.trim());
  }
  return out;
}

// R5-O9 — caché LRU (256 entradas) del resultado por (maxChars, string): los
// textos de misión/hint/diálogo/toast se re-wrapean IDÉNTICOS cada frame y el
// split/trim alocaba arrays y strings por frame. NOTA: el array devuelto es
// COMPARTIDO entre llamadas/frames (los llamadores actuales solo lo leen:
// forEach/for..of/.length/.slice — verificado); no mutarlo.
const WRAP_CACHE_MAX = 256;
const wrapCache = new Map<string, string[]>();

export function wrapText(str: string, maxChars: number): string[] {
  const key = maxChars + '\u0000' + str;
  const hit = wrapCache.get(key);
  if (hit !== undefined) {
    wrapCache.delete(key); // refresca recencia (Map = orden de inserción)
    wrapCache.set(key, hit);
    return hit;
  }
  const out = wrapTextUncached(str, maxChars);
  if (wrapCache.size >= WRAP_CACHE_MAX) {
    const oldest: string | undefined = wrapCache.keys().next().value;
    if (oldest !== undefined) wrapCache.delete(oldest);
  }
  wrapCache.set(key, out);
  return out;
}

// R5-O9 — estilo fijo del bisel interior, hoisted (string constante).
const PANEL_INNER = 'rgba(255,255,255,0.08)';

export function panel(g: Game, x: number, y: number, w: number, h: number, border = COL.panelBorder, bg = COL.panel) {
  const ctx = g.ctx;
  // R5-O9 — comparar antes de asignar (estado final idéntico).
  if (ctx.fillStyle !== bg) ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  if (ctx.strokeStyle !== border) ctx.strokeStyle = border;
  if (ctx.lineWidth !== 2) ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  if (ctx.strokeStyle !== PANEL_INNER) ctx.strokeStyle = PANEL_INNER;
  if (ctx.lineWidth !== 1) ctx.lineWidth = 1;
  ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
}

export function bar(
  g: Game, x: number, y: number, w: number, h: number,
  pct: number, color: string, bg: string, border = '#000',
) {
  const ctx = g.ctx;
  // R5-O9 — comparar antes de asignar (estado final idéntico).
  if (ctx.fillStyle !== bg) ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  if (ctx.fillStyle !== color) ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, pct)) * w, h);
  if (ctx.strokeStyle !== border) ctx.strokeStyle = border;
  if (ctx.lineWidth !== 1) ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/**
 * Puntos contador para trackers visuales (faroles 0/3, Ecos, etc.).
 * Dibuja `total` puntos de 2 px con paso `pitch`; los primeros `done`
 * van rellenos con `color` y el resto, apagados. Determinista y sin
 * estado: pensado para HUD/pantallas futuras (agente 10-a).
 */
export function counterDots(
  g: Game, x: number, y: number, total: number, done: number, color = COL.gold, pitch = 6,
) {
  const ctx = g.ctx;
  const filled = Math.max(0, Math.min(total, Math.floor(done)));
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < filled ? color : 'rgba(154,160,184,0.35)';
    ctx.fillRect(x + i * pitch, y, 2, 2);
  }
}

export function clearHits(g: Game) {
  g.uiHit = [];
}

export function addHit(g: Game, x: number, y: number, w: number, h: number, cb: () => void) {
  const hover = g.mouse.x >= x && g.mouse.x <= x + w && g.mouse.y >= y && g.mouse.y <= y + h;
  // stamp anti-fantasma: el hit recuerda el estado en que se dibujó; el motor
  // solo lo honra si el estado NO ha cambiado (evita reabrir menús en la frame
  // de una transición o con uiHit residual de otra instancia muerta)
  g.uiHit.push({ x, y, w, h, cb, hover, state: g.state });
  return hover;
}

export function button(
  g: Game, label: string, x: number, y: number, w: number, h: number,
  cb: () => void, size = 12, accent = COL.gold,
) {
  const hover = addHit(g, x, y, w, h, cb);
  const ctx = g.ctx;
  panel(g, x, y, w, h, hover ? accent : COL.panelBorder, hover ? 'rgba(40,34,20,0.95)' : COL.panel);
  textShadow(g, label, x + w / 2, y + h / 2 - size * 0.62, size, hover ? accent : COL.text, '#000', 'center', true);
  if (hover) {
    ctx.fillStyle = accent;
    ctx.fillRect(x + 6, y + h - 4, w - 12, 2);
  }
  g.canvas.style.cursor = g.uiHit.some(h2 => h2.hover) ? 'pointer' : 'default';
}

// ============================================================
// R3-A3 — Widgets de combate v2 (todo aditivo; las export anteriores
// quedan intactas). 100% determinista: nada de Math.random/Date.now,
// fillRect con enteros, timing derivado de g.globalT.
// ============================================================

// --- estado interno débil (no toca el motor; se limpia solo con el Game) ---

// Retardo "daño reciente" de barV2: por Game → celda (clave numérica x,y,w).
type V2Delay = { v: number; t: number };
const v2Delay = new WeakMap<object, Map<number, V2Delay>>();

// Entrada deslizante de bossBarV2: por Game → nombre del jefe.
type V2Boss = { t0: number; lastHp: number };
const bossSlide = new WeakMap<object, Map<string, V2Boss>>();

const PHASE_COLOR = ['#7ee8ff', '#ffd24a', '#ff5a4a']; // = GUARDIAN_PHASE_GLOW (actors/enemies.ts)
const PHASE_MARKS = [0.6, 0.3]; // fronteras de fase del jefe → 3 segmentos
const BOSS_W = 420;

/** Clave numérica estable de celda para v2Delay (coordenadas HUD < 2048). */
function v2Key(x: number, y: number, w: number): number {
  return y * 4194304 + x * 2048 + w;
}

/** Rombito pixel de 5 filas centrado en (cx, cy). */
function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, col: string) {
  const rows = [1, 3, 5, 3, 1];
  ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) {
    const rw = rows[i];
    ctx.fillRect(cx - (rw >> 1), cy - 2 + i, rw, 1);
  }
}

/**
 * Barra v2 con marco doble, brillo/sombra, muescas, glow y retardo de daño.
 *
 * - Marco: 1 px exterior oscuro + 1 px interior claro sutil.
 * - Fill: highlight superior de 1 px y sombra inferior de 1 px (sobre el fill).
 * - `segment` (N px): muesca oscura de 1 px cada N px (no pinta sobre el marco).
 * - `glow`: borde interior dorado claro pulsante con sin(g.globalT).
 * - `delayPct`: capa blanca tenue que enseña el valor ANTERIOR ("daño reciente").
 *   Gestión ELEGIDA: si `delayPct` llega, se usa tal cual (clamp [0,1]); si NO
 *   llega, el widget lo auto-gestiona con un WeakMap<Game, Map<clave(x,y,w)>>
 *   que drena hacia pct (~0.35–1.5/s según distancia; sube al instante si el
 *   pct crece — curación sin retardo). La capa solo se pinta cuando el valor
 *   retardado supera al actual. Nota: la clave usa la Y redondeada, así que
 *   durante una animación de entrada (y cambiante) el seguimiento empieza
 *   limpio al asentarse.
 * - pct fuera de [0,1] se satura (clamp); w/h se redondean a enteros.
 */
export function barV2(
  g: Game, x: number, y: number, w: number, h: number,
  pct: number, color: string, bg: string,
  opts?: { label?: string; segment?: number; glow?: boolean; delayPct?: number },
): void {
  const ctx = g.ctx;
  const px = Math.round(x), py = Math.round(y);
  const pw = Math.max(2, Math.round(w)), ph = Math.max(3, Math.round(h));
  const p = Math.max(0, Math.min(1, pct));
  const prevAlpha = ctx.globalAlpha; // componible: respeta el alpha del llamador

  // --- valor con retardo (daño reciente) ---
  let ghost = p;
  if (opts && opts.delayPct !== undefined) {
    ghost = Math.max(0, Math.min(1, opts.delayPct));
  } else {
    let map = v2Delay.get(g);
    if (!map) { map = new Map(); v2Delay.set(g, map); }
    const key = v2Key(px, py, pw);
    const now = g.globalT;
    const e = map.get(key);
    if (!e) {
      map.set(key, { v: p, t: now });
    } else {
      const dt = Math.max(0, Math.min(0.1, now - e.t));
      e.t = now;
      if (p >= e.v) e.v = p; // curación: sin retardo al alza
      else e.v = Math.max(p, e.v - dt * (0.35 + 1.15 * (e.v - p))); // drena hacia pct
      ghost = e.v;
    }
  }

  const innerW = pw - 2, innerH = ph - 2;
  const fw = Math.round(p * innerW);
  const ghostW = ghost > p + 0.001 ? Math.round(ghost * innerW) : 0;

  // fondo
  ctx.fillStyle = bg;
  ctx.fillRect(px, py, pw, ph);

  // capa fantasma blanca tenue (valor anterior con retardo)
  if (ghostW > 0) {
    ctx.globalAlpha = prevAlpha * 0.42;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 1, py + 1, ghostW, innerH);
  }

  // fill actual + highlight superior 1px + sombra inferior 1px
  if (fw > 0) {
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, fw, innerH);
    ctx.globalAlpha = prevAlpha * 0.38;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 1, py + 1, fw, 1);
    ctx.globalAlpha = prevAlpha * 0.32;
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + 1, py + ph - 2, fw, 1);
  }

  // muescas de segmento: línea oscura de 1px cada N px (dentro del marco)
  if (opts && opts.segment && opts.segment >= 4) {
    ctx.globalAlpha = prevAlpha * 0.4;
    ctx.fillStyle = '#000000';
    for (let sx = px + opts.segment; sx <= px + pw - 2; sx += opts.segment) {
      ctx.fillRect(sx, py + 1, 1, innerH);
    }
  }

  // marco: exterior oscuro 1px + interior claro 1px
  ctx.globalAlpha = prevAlpha;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = prevAlpha * 0.16;
  ctx.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);

  // glow pulsante: borde interior claro que respira (sin(g.globalT))
  if (opts && opts.glow) {
    ctx.strokeStyle = COL.goldSoft;
    ctx.globalAlpha = prevAlpha * (0.3 + 0.28 * Math.sin(g.globalT * 5.2));
    ctx.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
  }
  ctx.globalAlpha = prevAlpha;

  // etiqueta centrada (fBody)
  if (opts && opts.label) {
    const size = Math.max(9, ph - 3);
    text(g, opts.label, px + pw / 2, py + Math.round((ph - size) / 2) - 1, size, '#ffffff', 'center');
  }
}

/**
 * Icono de habilidad cuadrado (s×s) con esquina superior-derecha recortada.
 *
 * - Marco 1 px que respeta el recorte mediante escalón pixel; color apagado
 *   durante el enfriamiento, dorado pulsante si `selected`.
 * - Glifo centrado (fBody) en COL.goldSoft (apagado si cdFrac ≥ 1).
 * - Overlay de cooldown: relleno oscuro anclado ABAJO cuya altura es
 *   cdFrac·interior; su frente (línea clara de 1 px) BAJA de arriba a abajo
 *   mientras el enfriamiento recupera (cdFrac 1 = recién usado → 0 = listo).
 * - Número de tecla en la esquina inferior derecha (fBody, dorado).
 * - cdFrac fuera de [0,1] se satura; selected añade un halo dorado pulsante.
 *
 * PUNTO DE CONEXIÓN — render.ts drawHud (bloque inline actual ~líneas 664–684,
 * iconos 52×46 con 'Tajo'/'cds'): el bucle puede sustituirse por
 *   skillIcon(g, x, y, 46, sk.icon, Math.min(1, p.cds[i] / sk.cd), String(i + 1), false)
 *   + text(g, sk.name.split(' ')[0], x + 23, y + 30, 11, ..., 'center')
 *   + el coste/faltante de res como hoy (text con COL.danger)
 * manteniendo el layout 52×46 (icono 46 arriba + nombre debajo).
 */
export function skillIcon(
  g: Game, x: number, y: number, s: number,
  glyph: string, cdFrac: number, keyLabel: string, selected: boolean,
): void {
  const ctx = g.ctx;
  const px = Math.round(x), py = Math.round(y);
  const ps = Math.max(14, Math.round(s));
  const cut = ps >= 36 ? 5 : 3; // recorte pixel de la esquina sup-der
  const cd = Math.max(0, Math.min(1, cdFrac));
  const prevAlpha = ctx.globalAlpha;

  // fondo (deja vacía la esquina recortada)
  ctx.fillStyle = COL.panel;
  ctx.fillRect(px, py, ps - cut, ps);
  ctx.fillRect(px + ps - cut, py, cut, ps - cut);

  // marco 1 px con escalón en la esquina recortada
  ctx.fillStyle = selected ? COL.gold : cd > 0 ? '#3a3448' : COL.panelBorder;
  ctx.fillRect(px, py, ps - cut, 1);                        // arriba
  ctx.fillRect(px, py, 1, ps);                              // izquierda
  ctx.fillRect(px, py + ps - 1, ps, 1);                     // abajo
  ctx.fillRect(px + ps - 1, py + cut, 1, ps - cut);         // derecha
  for (let i = 0; i < cut; i++) ctx.fillRect(px + ps - 1 - i, py + i, 1, 1); // escalón

  // glifo centrado (fBody)
  const gs = Math.min(18, ps - 14);
  text(g, glyph, px + ps / 2, py + Math.round((ps - gs) / 2) - 1, gs,
    cd >= 1 ? '#6a6a7a' : COL.goldSoft, 'center');

  // overlay de cooldown (anclado abajo; el frente baja al recuperar)
  if (cd > 0) {
    const ih = ps - 2;
    const oh = Math.round(cd * ih);
    const fy = py + 1 + (ih - oh);
    ctx.fillStyle = 'rgba(8,8,18,0.72)';
    ctx.fillRect(px + 1, fy, ps - 2, oh);
    ctx.fillStyle = '#cfe8ff'; // frente del barrido
    ctx.fillRect(px + 1, fy, ps - 2, 1);
  }

  // tecla en la esquina inferior derecha
  text(g, keyLabel, px + ps - 3, py + ps - 12, 10, COL.gold, 'right');

  // selección: halo dorado pulsante alrededor del marco
  if (selected) {
    ctx.globalAlpha = prevAlpha * (0.45 + 0.35 * Math.sin(g.globalT * 6.5));
    ctx.fillStyle = COL.goldSoft;
    ctx.fillRect(px - 1, py - 1, ps + 2, 1);
    ctx.fillRect(px - 1, py - 1, 1, ps + 2);
    ctx.fillRect(px - 1, py + ps, ps + 2, 1);
    ctx.fillRect(px + ps, py - 1, 1, ps + 2);
    ctx.globalAlpha = prevAlpha;
  }
}

/**
 * Barra de jefe v2: centrada arriba (420 px), nombre en fTitle con sombra
 * dura, HP con color por fase (PHASE_COLOR ≡ GUARDIAN_PHASE_GLOW de
 * actors/enemies.ts) y marcas de frontera de fase en 60% y 30% (3 segmentos),
 * barra fina de QUIEBRE debajo (cian claro, glow si staPct < 0.35) y rombos
 * pixel ornamentales en los extremos.
 *
 * ENTRADA DESLIZANTE: la primera llamada por (Game, nombre) guarda t0 en un
 * WeakMap y la barra entra desde arriba (~0.6 s, easeOutCubic, con fade).
 * REINICIO: si hpPct SUBE bruscamente (> +0.2 entre llamadas — nueva pelea o
 * curación total del jefe) se resetea t0 y vuelve a entrar deslizándose.
 * Todo el timing deriva de g.globalT (determinista).
 *
 * PUNTO DE CONEXIÓN — render.ts drawHud (barra actual ~líneas 697–708):
 *   if (g.bossActive && g.bossRef && !g.bossRef.dead)
 *     bossBarV2(g, ENEMY_DEFS.guardian.name, boss.hp / boss.maxHp,
 *               boss.maxSta > 0 ? boss.sta / boss.maxSta : 0, boss.phase);
 */
export function bossBarV2(g: Game, name: string, hpPct: number, staPct: number, phase: number): void {
  const ctx = g.ctx;
  const now = g.globalT;

  // --- entrada deslizante (WeakMap por Game → nombre; reset si hp sube de golpe) ---
  let m = bossSlide.get(g);
  if (!m) { m = new Map(); bossSlide.set(g, m); }
  let e = m.get(name);
  if (!e) {
    e = { t0: now, lastHp: hpPct };
    m.set(name, e);
  } else {
    if (hpPct - e.lastHp > 0.2) e.t0 = now; // reinicio brusco de vida → re-entrada
    e.lastHp = hpPct;
  }
  const ent = Math.max(0, Math.min(1, (now - e.t0) / 0.6));
  const ease = 1 - Math.pow(1 - ent, 3);
  const offY = Math.round((1 - ease) * -46);
  const a = Math.min(1, ent * 2.5);
  ctx.globalAlpha = a;

  const ph = Math.max(1, Math.min(3, Math.round(phase)));
  const col = PHASE_COLOR[ph - 1];
  const bx = Math.round((VIEW_W - BOSS_W) / 2);
  const by = 22 + offY;

  // nombre (fTitle con sombra dura)
  textShadow(g, name, VIEW_W / 2, by - 18, 12, col, '#03121c', 'center', true);

  // rombos ornamentales + tirantes hacia la barra
  diamond(ctx, bx - 11, by + 6, col);
  diamond(ctx, bx + BOSS_W + 11, by + 6, col);
  ctx.fillStyle = col;
  ctx.fillRect(bx - 9, by + 5, 9, 2);
  ctx.fillRect(bx + BOSS_W + 1, by + 5, 9, 2);

  // barra de HP (con retardo de daño auto-gestionado; se asienta al entrar)
  barV2(g, bx, by, BOSS_W, 13, hpPct, col, COL.bossBg);

  // marcas de frontera de fase (60% y 30% → 3 segmentos)
  for (let i = 0; i < PHASE_MARKS.length; i++) {
    const mx = bx + Math.round(BOSS_W * PHASE_MARKS[i]);
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(mx, by + 1, 1, 11);
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(mx + 1, by + 1, 1, 11);
  }

  // barra fina de QUIEBRE (cian claro; glow cerca del quiebre)
  const staY = by + 16;
  const low = staPct < 0.35;
  barV2(g, bx, staY, BOSS_W, 4, staPct, '#7ee8ff', '#12303a', { glow: low });
  text(g, 'QUIEBRE', bx + BOSS_W + 22, staY - 2, 11, low ? '#cfeaff' : '#7ee8ff');

  // indicador de fase (izquierda)
  text(g, `FASE ${ph}/3`, bx - 22, by + 2, 12, col, 'right');

  ctx.globalAlpha = 1;
}
