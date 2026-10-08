// ============================================================
// ECOS DE AELTHAR — Helpers de UI para canvas
// ============================================================

import type { UiHit } from './engine';
import type { Game } from './engine';

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
};

export function fTitle(px: number): string {
  return `${px}px "Press Start 2P", monospace`;
}

export function fBody(px: number): string {
  return `${px}px "VT323", "Press Start 2P", monospace`;
}

export function text(
  g: Game, str: string, x: number, y: number,
  size: number, color = COL.text, align: CanvasTextAlign = 'left', title = false,
) {
  const ctx = g.ctx;
  ctx.font = title ? fTitle(size) : fBody(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function textShadow(
  g: Game, str: string, x: number, y: number,
  size: number, color = COL.text, shadow = '#000', align: CanvasTextAlign = 'left', title = false,
) {
  const ctx = g.ctx;
  ctx.font = title ? fTitle(size) : fBody(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = shadow;
  ctx.fillText(str, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function wrapText(str: string, maxChars: number): string[] {
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

export function panel(g: Game, x: number, y: number, w: number, h: number, border = COL.panelBorder, bg = COL.panel) {
  const ctx = g.ctx;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
}

export function bar(
  g: Game, x: number, y: number, w: number, h: number,
  pct: number, color: string, bg: string, border = '#000',
) {
  const ctx = g.ctx;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, pct)) * w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
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
