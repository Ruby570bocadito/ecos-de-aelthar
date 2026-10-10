// ============================================================
// ECOS DE AELTHAR — Pantallas y overlays (AGENTE 3-a · visuales;
// pestañas y final actualizados al ACTO II por el agente 10-a)
// Título (niebla en capas + notas flotantes), controles, intro,
// pausa (Estado con "Velmora te observa", Diario con memorias y
// misiones del Acto II), diálogo con retratos, muerte y final.
// ============================================================

import type { Game } from './engine';
import { VIEW_W, VIEW_H, QUESTS, getSpr, playerMeleeDmg } from './engine';
import { ATTR_INFO, KEY_ITEMS, MEMORIES } from './data';
import { dominantTone, TONE_LABEL } from './hooks';
import { drawBalancePanel } from './balance'; // 12-c: dificultad (pestaña SISTEMA)
import { drawArmorRow } from './armor'; // 14-b: armadura activa (pestaña ESTADO)
import { drawPortrait } from './sprites';
import { audio } from './audio';
import { COL, text, textShadow, panel, bar, button, wrapText, addHit } from './ui';
import { openChallengeMenu, drawChallengeTitleUi, drawChallengeOverlay } from './challenge'; // 12-a (modo desafío)
import { drawTitlePanels, openStatsPanel, openLogrosPanel } from './achievements'; // 16-c: Estadísticas y Logros
import { interludioTick18F, bannerActo18F } from './interludios'; // 18-f: interludios de acto + banner (agente historia-transiciones)

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

export function drawScreens(g: Game) {
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
    case 'dialogue':
      drawDialogue(g);
      drawBannerActo18F(g); // 18-f: el banner de acto sigue durante la cinemática
      break;
    case 'dead': drawDead(g); break;
    case 'end': drawEnd(g); break;
    case 'play':
      // ==== 18-f (historia-transiciones): tick de los interludios de acto +
      // barrera de los altares del Eco. Corre en el camino de dibujo porque
      // update.ts/render.ts son de otros agentes — ver la cabecera de
      // interludios.ts para el punto alternativo EXACTO en update.ts:384.
      // Guard interno: solo estado 'play', con jugador y fuera de la arena.
      interludioTick18F(g);
      // 12-a: HUD del modo desafío (oleada/enemigos/puntos, cuenta atrás y banner)
      if (g.challengeRun) drawChallengeOverlay(g);
      drawBannerActo18F(g); // 18-f: banner «ACTO N — título» (fade 2,5 s)
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
  // fondo
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#0a0c1e');
  grad.addColorStop(0.6, '#141830');
  grad.addColorStop(1, '#1e1830');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // estrellas
  for (let i = 0; i < 70; i++) {
    const x = (i * 137.5) % VIEW_W;
    const y = (i * 89.7) % (VIEW_H * 0.7);
    const tw = 0.4 + Math.abs(Math.sin(t * 1.5 + i)) * 0.6;
    ctx.fillStyle = `rgba(220,228,255,${tw * 0.5})`;
    ctx.fillRect(x, y, 2, 2);
  }
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

  // logo con brillo periódico
  const bob = Math.sin(t * 1.4) * 3;
  const glow = Math.pow(Math.max(0, Math.sin(t * 0.7)), 14);
  if (glow > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow * 0.55;
    textShadow(g, 'AELTHAR', VIEW_W / 2, 110 + bob, 42, '#fff3c0', '#3a2a08', 'center', true);
    ctx.restore();
  }
  textShadow(g, 'ECOS DE', VIEW_W / 2, 78 + bob, 20, '#b0b8d0', '#000', 'center', true);
  textShadow(g, 'AELTHAR', VIEW_W / 2, 110 + bob, 42, COL.gold, '#2a1a08', 'center', true);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(VIEW_W / 2 - 180, 168, 360, 2);
  text(g, 'RPG 2D de acción y exploración · Demo jugable · Acto II incluido', VIEW_W / 2, 180, 17, COL.dim, 'center');

  // botones (con brillo de hover). 16-c: menú ampliado — Estadísticas y
  // Logros en una rejilla secundaria de 2 columnas (mismo lenguaje visual)
  const bx = VIEW_W / 2 - 130, bw = 260;
  const sw = (bw - 8) / 2; // ancho de los botones secundarios (2 columnas)
  button(g, 'NUEVA PARTIDA', bx, 236, bw, 44, () => g.requestCreate(), 13);
  hoverCorners(g, bx, 236, bw, 44);
  if (g.hasSave()) {
    button(g, 'CONTINUAR', bx, 290, bw, 44, () => g.continueGame(), 13);
    hoverCorners(g, bx, 290, bw, 44);
    button(g, 'CONTROLES', bx, 346, sw, 34, () => { g.setState('controls'); }, 9);
    hoverCorners(g, bx, 346, sw, 34);
    button(g, 'DESAFÍO', bx + sw + 8, 346, sw, 34, () => openChallengeMenu(), 9);
    hoverCorners(g, bx + sw + 8, 346, sw, 34);
    button(g, 'ESTADÍSTICAS', bx, 388, sw, 34, () => openStatsPanel(), 9);
    hoverCorners(g, bx, 388, sw, 34);
    button(g, 'LOGROS', bx + sw + 8, 388, sw, 34, () => openLogrosPanel(), 9);
    hoverCorners(g, bx + sw + 8, 388, sw, 34);
  } else {
    button(g, 'CONTROLES', bx, 290, sw, 34, () => { g.setState('controls'); }, 9);
    hoverCorners(g, bx, 290, sw, 34);
    button(g, 'DESAFÍO', bx + sw + 8, 290, sw, 34, () => openChallengeMenu(), 9);
    hoverCorners(g, bx + sw + 8, 290, sw, 34);
    button(g, 'ESTADÍSTICAS', bx, 332, sw, 34, () => openStatsPanel(), 9);
    hoverCorners(g, bx, 332, sw, 34);
    button(g, 'LOGROS', bx + sw + 8, 332, sw, 34, () => openLogrosPanel(), 9);
    hoverCorners(g, bx + sw + 8, 332, sw, 34);
  }

  text(g, 'Basado en el Documento de Diseño de @papito · 8 oct 2026', VIEW_W / 2, VIEW_H - 40, 15, 'rgba(154,160,184,0.8)', 'center');
  text(g, 'v0.5.0 · Lunaris — Bosque — Cripta — Costa de Bruma — Merrow — Cumbres Heladas · Logros', VIEW_W / 2, VIEW_H - 20, 14, 'rgba(122,128,148,0.7)', 'center');
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
  ['Ataque ligero (combo ×3)', 'Clic izquierdo (mantén: ataque cargado)'],
  ['Ataque cargado', 'Mantén clic izquierdo y suelta'],
  ['Esquivar (i-frames)', 'Espacio'],
  ['Parada perfecta (0,2 s)', 'Clic derecho'],
  ['Habilidades ×4', 'Teclas 1 – 4'],
  ['Interactuar / hablar', 'E'],
  ['Cambiar de época (con Eco)', 'Q'],
  ['Beber poción', 'F'],
  ['Menú y mapa', 'Esc / M'],
  ['Esperar al alba (accesibilidad)', 'Shift + T'],
];

function drawControls(g: Game) {
  const ctx = g.ctx;
  ctx.fillStyle = '#0a0c1e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const pw = 620, ph = 430;
  const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2 - 10;
  panel(g, px, py, pw, ph);
  textShadow(g, 'CONTROLES', VIEW_W / 2, py + 18, 16, COL.gold, '#000', 'center', true);
  let y = py + 60;
  for (const [action, key] of CONTROLS) {
    text(g, action, px + 28, y, 16, COL.text);
    text(g, key, px + pw - 28, y, 16, COL.goldSoft, 'right');
    y += 30;
  }
  ctx.strokeStyle = COL.panelBorder;
  ctx.strokeRect(px + 20, y + 6, pw - 40, 64);
  text(g, 'Consejo del GDD: «la posición y el ritmo importan más que los números».', px + 28, y + 14, 15, COL.dim);
  text(g, 'Esquiva con los i-frames de la voltereta y clava la parada perfecta (0,2 s)', px + 28, y + 32, 15, COL.dim);
  text(g, 'para aturdir. Los enemigos grandes tienen barra de QUIEBRE.', px + 28, y + 50, 15, COL.dim);
  button(g, 'VOLVER (ESC)', VIEW_W / 2 - 90, py + ph + 12, 180, 36, () => g.setState('title'), 11);
  hoverCorners(g, VIEW_W / 2 - 90, py + ph + 12, 180, 36);
  if (g.keys.has('escape')) g.setState('title');
}

// ---------------- Intro ----------------

function drawIntro(g: Game) {
  const ctx = g.ctx;
  ctx.fillStyle = '#06070f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // motas de polvo doradas flotando (atmósfera de memoria)
  for (let i = 0; i < 24; i++) {
    const x = hashT(i, 11) * VIEW_W;
    const y = (hashT(i, 13) * VIEW_H + g.globalT * (4 + hashT(i, 5) * 5)) % VIEW_H;
    ctx.globalAlpha = 0.12 + Math.abs(Math.sin(g.globalT + i)) * 0.2;
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  const slide = INTRO_SLIDES[Math.min(g.introIdx, INTRO_SLIDES.length - 1)];
  const a = 0.75 + Math.sin(g.globalT * 2) * 0.25;
  ctx.globalAlpha = a;
  textShadow(g, slide.title, VIEW_W / 2, 150, 18, COL.goldSoft, '#000', 'center', true);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(VIEW_W / 2 - 60, 190, 120, 2);
  const lines = wrapText(slide.lines, 52);
  lines.forEach((l, i) => text(g, l, VIEW_W / 2, 226 + i * 26, 20, COL.text, 'center'));
  ctx.globalAlpha = 1;
  // puntos de progreso
  for (let i = 0; i < INTRO_SLIDES.length; i++) {
    ctx.fillStyle = i === g.introIdx ? COL.gold : 'rgba(255,255,255,0.2)';
    ctx.fillRect(VIEW_W / 2 - 24 + i * 18, 400, 10, 4);
  }
  if (Math.sin(g.globalT * 4) > -0.2) {
    text(g, 'E ▸', VIEW_W - 80, VIEW_H - 50, 16, COL.dim, 'center');
  }
}

// ---------------- Pausa ----------------

const TABS = ['ESTADO', 'EQUIPO', 'DIARIO', 'SISTEMA'];

function drawPause(g: Game) {
  const ctx = g.ctx;
  ctx.fillStyle = 'rgba(4,5,12,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const p = g.player!;
  const pw = 720, ph = 470;
  const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2;
  panel(g, px, py, pw, ph);
  textShadow(g, '— PAUSA —', VIEW_W / 2, py + 14, 14, COL.gold, '#000', 'center', true);

  // pestañas
  let tx = px + 20;
  for (let i = 0; i < TABS.length; i++) {
    const tw = 140;
    const selected = g.pauseTab === i;
    const hover = addHit(g, tx, py + 44, tw, 30, () => { g.pauseTab = i as 0 | 1 | 2 | 3; });
    panel(g, tx, py + 44, tw, 30, selected || hover ? COL.gold : COL.panelBorder, selected ? 'rgba(60,48,24,0.9)' : COL.panel);
    text(g, TABS[i], tx + tw / 2, py + 52, 11, selected ? COL.gold : COL.dim, 'center', true);
    tx += tw + 8;
  }

  const cx = px + 28, cy = py + 92;

  if (g.pauseTab === 0) {
    // ESTADO
    text(g, `${p.name} — Portador nivel ${p.level}`, cx, cy, 20, COL.goldSoft);
    bar(g, cx, cy + 28, 240, 8, p.xp / g.xpNext(p.level), COL.xp, '#241a30');
    text(g, `XP ${Math.floor(p.xp)} / ${g.xpNext(p.level)}`, cx + 250, cy + 24, 15, COL.dim);
    text(g, `Puntos de atributo: ${p.points}`, cx, cy + 46, 17, p.points > 0 ? '#ffe86a' : COL.dim);
    let y = cy + 72;
    for (const at of ATTR_INFO) {
      text(g, at.name, cx, y, 16, COL.text);
      text(g, `${p.attrs[at.id]}`, cx + 120, y, 16, COL.goldSoft);
      text(g, at.desc, cx + 165, y + 2, 13, COL.dim);
      if (p.points > 0) {
        button(g, '+', cx + 396, y - 4, 30, 24, () => {
          p.attrs[at.id]++; p.points--;
          audioClick();
        }, 12);
      }
      y += 26;
    }
    // stats derivados
    const melee = playerMeleeDmg(p); // fuente única de verdad (motor)
    const spell = 6 + p.attrs.int * 1.6 + p.level + p.weaponPlus * 1.5;
    text(g, `Daño melé: ${Math.round(melee)}   Daño de Cantos: ${Math.round(spell)}   Crítico: ${Math.min(40, 5 + p.attrs.des * 2)}%`, cx, y + 6, 14, COL.dim);
    text(g, `Vida: ${p.maxHp}   Reducción: ${Math.min(50, p.attrs.vig)}%   Resonancia máx: ${p.maxRes}`, cx, y + 24, 14, COL.dim);

    // ---- VELMORA TE OBSERVA (reputaciones, tono y memorias) ----
    const vy0 = y + 50;
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
    const FACS: [string, string][] = [
      ['guardianes', 'Guardianes del Canto'],
      ['orden', 'Orden de Vesh'],
      ['circulo', 'Círculo Verde'],
      ['liga', 'Liga de Mercaderes'],
    ];
    FACS.forEach(([id, label], i) => {
      const fx = cx + (i % 2) * 336;
      const fy = vy0 + 50 + Math.floor(i / 2) * 24;
      const v = rep[id] ?? 0;
      text(g, label, fx, fy, 15, COL.text);
      const vc = v > 0 ? '#8ef0b0' : v < 0 ? '#ff7060' : COL.dim;
      text(g, `${v > 0 ? '+' : ''}${v}`, fx + 300, fy, 15, vc, 'right');
    });
    // 14-b: armadura activa (fila compacta, contrato armor.ts)
    drawArmorRow(g, cx, py + 440, pw - 56);
  } else if (g.pauseTab === 1) {
    // EQUIPO
    text(g, 'ARMA', cx, cy, 16, COL.gold);
    text(g, p.discipline === 'alba' ? 'Espada y escudo del Alba' : 'Báculo del Tejedor', cx + 100, cy, 18, COL.text);
    text(g, `+${p.weaponPlus}`, cx + 380, cy, 18, COL.goldSoft);
    text(g, 'CORONAS', cx, cy + 30, 16, COL.gold);
    text(g, `${p.gold}`, cx + 100, cy + 30, 18, COL.text);
    text(g, 'POCIONES', cx, cy + 58, 16, COL.gold);
    text(g, `${p.potions}  (beber con F)`, cx + 100, cy + 58, 18, COL.text);
    text(g, 'OBJETOS CLAVE', cx, cy + 96, 16, COL.gold);
    let ky = cy + 120;
    for (const [flag, id] of KEY_ITEM_FLAGS) {
      if (!g.flags[flag]) continue;
      const it = KEY_ITEMS[id];
      if (!it) continue;
      text(g, `◆ ${it.name}`, cx, ky, 16, id === 'fragment' ? COL.text : '#ffe9a0');
      text(g, it.desc, cx + 16, ky + 17, 13, COL.dim);
      ky += 34;
    }
    if (ky === cy + 120) { text(g, '(aún no llevas ninguno)', cx, ky, 15, COL.dim); ky += 22; }
    text(g, 'FACCIÓN: Guardianes del Canto', cx, ky + 8, 16, COL.quest);
    bar(g, cx, ky + 30, 200, 8, (p.repGuardianes + 100) / 200, '#4a8a5c', '#1a2a1c', COL.panelBorder);
    text(g, `${p.repGuardianes >= 0 ? '+' : ''}${p.repGuardianes} / +100`, cx + 210, ky + 26, 15, COL.dim);
    text(g, g.companion ? 'Compañera: Ilwen (Arquera Sylvar) — te cubre con su arco' : 'Compañeros: ninguno aún (Ilwen espera en el Bosque)', cx, ky + 56, 15, COL.dim);
  } else if (g.pauseTab === 2) {
    // DIARIO — misiones por acto (izquierda) + memorias del Portador (derecha)
    text(g, 'CADENA PRINCIPAL · ACTO I', cx, cy, 15, COL.gold);
    let y = cy + 22;
    for (let i = 0; i < QUESTS.length; i++) {
      // sub-cabecera del Acto II justo antes de q6 (leída de QUESTS, sin hardcodear nombres)
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
        const stepText = g.questProgressText() ?? q.steps[g.questStep];
        for (const l of wrapText(stepText, 42)) { text(g, '   ' + l, cx, y, 14, COL.text); y += 15; }
        y += 4;
      } else if (ZONE_TEASERS[q.id] && i > g.questIdx) {
        // rumor de zona nueva: solo mientras la misión siga en el futuro
        text(g, `   ${ZONE_TEASERS[q.id]}`, cx, y, 13, 'rgba(154,160,184,0.75)');
        y += 14;
      }
    }
    text(g, `Ecos menores escuchados: ${g.takenEchoes.size}`, cx, py + ph - 52, 14, COL.dim);
    text(g, `Enemigos derrotados: ${p.kills} · Muertes: ${p.deaths}`, cx, py + ph - 32, 14, COL.dim);

    // ---- memorias del Portador (biblia: cada Eco devuelve un recuerdo) ----
    // Con las 5 memorias del Acto II el reparto es fijo y compacto: máximo 3
    // líneas de texto por recuerdo para que la columna nunca desborde el panel
    // (el texto íntegro ya se muestra en el overlay de memoria al desbloquearla).
    const mx0 = cx + 316;
    text(g, 'MEMORIAS DEL PORTADOR', mx0, cy, 15, COL.gold);
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
      ctx.strokeStyle = 'rgba(90,74,48,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx0, my);
      ctx.lineTo(mx0 + 330, my);
      ctx.stroke();
      my += 7;
    }
  } else {
    // SISTEMA
    text(g, 'VOLUMEN DE MÚSICA', cx, cy, 16, COL.text);
    drawSlider(g, cx, cy + 26, 300, v => { audioSetMusic(g, v); }, g.musicVolUi);
    text(g, 'VOLUMEN DE EFECTOS', cx, cy + 76, 16, COL.text);
    drawSlider(g, cx, cy + 102, 300, v => { audioSetSfx(g, v); }, g.sfxVolUi);
    text(g, '«La música adaptativa añade una capa de combate cuando', cx, cy + 150, 15, COL.dim);
    text(g, 'los enemigos te ven, y cada región tiene su melodía.»', cx, cy + 168, 15, COL.dim);
    // dificultad dinámica del mundo (12-c): AUTO por defecto, editable aquí
    drawBalancePanel(g, cx, cy + 196, pw - 56);
    button(g, 'GUARDAR Y SALIR AL TÍTULO', cx, py + ph - 96, 280, 40, () => {
      g.save();
      g.setState('title');
    }, 11);
    hoverCorners(g, cx, py + ph - 96, 280, 40);
    text(g, '(el juego también autoguarda en Santuarios y al cambiar de zona)', cx, py + ph - 46, 14, COL.dim);
  }
  text(g, 'Esc para volver al juego', VIEW_W / 2, py + ph + 10, 15, COL.dim, 'center');
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

// ==== 18-f (historia-transiciones): banner «ACTO N — título del acto» ====
// Una línea, tipografía del juego, banda translúcida con filetes dorados y
// fade de 2,5 s (0,35 entrada · mantiene · 0,6 salida — lo calcula
// interludios.bannerActo18F). Se dibuja en 'play' y 'dialogue' (la
// cinemática es un diálogo del sistema existente). Sin uiHit: no roba clics.
function drawBannerActo18F(g: Game) {
  const b = bannerActo18F(g);
  if (!b || b.alpha <= 0) return;
  const ctx = g.ctx;
  const y = 96, h = 34;
  ctx.save();
  ctx.globalAlpha = b.alpha;
  ctx.fillStyle = 'rgba(4,5,12,0.62)';
  ctx.fillRect(0, y, VIEW_W, h);
  ctx.fillStyle = 'rgba(240,200,74,0.55)';
  ctx.fillRect(0, y, VIEW_W, 1);
  ctx.fillRect(0, y + h - 1, VIEW_W, 1);
  textShadow(g, b.texto, VIEW_W / 2, y + 9, 16, COL.goldSoft, '#000', 'center', true);
  ctx.restore();
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
  drawPortrait(ctx, pkey, frX + (frS - 28 * 1.72) / 2, frY + (frS - 40 * 1.72) / 2 + bob, 1.72, blink);
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
    // FIX R18: passthrough general — drawPortrait ya cae a 'wisp' de forma
    // segura para claves desconocidas, así que cualquier retrato nuevo (los
    // tres del faro 18-e y los futuros) se muestra sin tocar esta lista.
    default: return p;
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
  if (Math.sin(g.globalT * 3) > -0.2) text(g, 'E ▸', VIEW_W / 2, 420, 18, COL.gold, 'center');
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
