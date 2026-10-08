// ============================================================
// ECOS DE AELTHAR — Render de mundo y HUD
// ============================================================

import type { Game } from './engine';
import { VIEW_W, VIEW_H, ZOOM, TILE, getSpr, frameIndex, SKILLS, QUESTS } from './engine';
import type { Entity, Enemy } from './types';
import { ENEMY_DEFS } from './data';
import { COL, text, textShadow, panel, bar, clearHits, wrapText } from './ui';
import { drawScreens } from './screens';

const WORLD_FILTER: Record<string, string> = {
  presente: 'saturate(0.74) contrast(0.98)',
  pasado: 'saturate(1.35) brightness(1.1)',
};

export function drawGame(g: Game) {
  const ctx = g.ctx;
  clearHits(g);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  if (g.state === 'title' || g.state === 'controls') {
    drawScreens(g);
    return;
  }

  drawWorld(g);
  drawHud(g);
  drawScreens(g); // intro, pause, dialogue, dead, end (overlays)
}

// ---------------- Mundo ----------------

function drawWorld(g: Game) {
  const ctx = g.ctx;
  // sacudida de pantalla
  const shx = g.shake > 0.2 ? (Math.random() - 0.5) * g.shake * 2 : 0;
  const shy = g.shake > 0.2 ? (Math.random() - 0.5) * g.shake * 2 : 0;
  ctx.save();
  ctx.translate(shx, shy);
  const camX = Math.round(g.camX), camY = Math.round(g.camY);

  // suelo (prerenderizado por época) — el canvas está en píxeles de mundo (1x)
  const ground = g.epoch === 'pasado' && g.groundPastCanvas ? g.groundPastCanvas : g.groundCanvas;
  if (ground) {
    ctx.save();
    ctx.filter = WORLD_FILTER[g.epoch] ?? 'none';
    const gx = Math.floor(camX / ZOOM), gy = Math.floor(camY / ZOOM);
    ctx.drawImage(ground, gx, gy, VIEW_W / ZOOM, VIEW_H / ZOOM, 0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  const sx = (wx: number) => wx * ZOOM - camX;
  const sy = (wy: number) => wy * ZOOM - camY;

  ctx.save();
  ctx.filter = WORLD_FILTER[g.epoch] ?? 'none';

  // oro perdido
  for (const dgl of g.deadGolds) {
    if (dgl.map !== g.mapId) continue;
    const bob = Math.sin(g.globalT * 3) * 2;
    ctx.drawImage(getSpr('goldbag')[0], sx(dgl.x - 5), sy(dgl.y - 8 + bob), 10 * ZOOM, 8 * ZOOM);
  }

  // ecos menores (susurros)
  for (const ec of g.map.echoes) {
    if (g.takenEchoes.has(ec.id)) continue;
    const bob = Math.sin(g.globalT * 2 + ec.x) * 2;
    const fr = Math.floor(g.globalT * 3) % 2;
    ctx.globalAlpha = 0.75;
    ctx.drawImage(getSpr('wisp')[fr], sx(ec.x * TILE + 8 - 5), sy(ec.y * TILE + 2 + bob), 10 * ZOOM, 10 * ZOOM);
    ctx.globalAlpha = 1;
  }

  // props
  drawProps(g, sx, sy);

  // entidades ordenadas por Y
  type Drawable = { e: Entity; y: number };
  const ents: Drawable[] = [];
  for (const n of g.npcs) ents.push({ e: n, y: n.y });
  if (g.companion && g.companion.downT <= 0) ents.push({ e: g.companion, y: g.companion.y });
  for (const e of g.enemies) if (!e.dead) ents.push({ e, y: e.y });
  if (g.player) ents.push({ e: g.player, y: g.player.y });
  ents.sort((a, b) => a.y - b.y);

  for (const { e } of ents) {
    drawEntity(g, e, sx, sy);
  }

  ctx.restore();

  // cofres (encima, siempre visibles)
  for (const ch of g.map.chests) {
    if (ch.needPast && g.epoch !== 'pasado') continue;
    const opened = g.openedChests.has(ch.id);
    const sprC = getSpr(opened ? 'chest_open' : 'chest')[0];
    ctx.drawImage(sprC, sx(ch.x * TILE), sy(ch.y * TILE - 2), 16 * ZOOM, 14 * ZOOM);
  }

  drawCombatFx(g, sx, sy);

  // partículas
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.t / p.maxT);
    ctx.fillStyle = p.color;
    ctx.fillRect(sx(p.x) - p.size, sy(p.y) - p.size, p.size * 2 * ZOOM * 0.6, p.size * 2 * ZOOM * 0.6);
  }
  ctx.globalAlpha = 1;

  // textos flotantes
  for (const f of g.floats) {
    ctx.globalAlpha = Math.min(1, f.t * 2);
    text(g, f.text, sx(f.x), sy(f.y), f.size, f.color, 'center', false);
  }
  ctx.globalAlpha = 1;

  drawLighting(g);

  // prompt de interacción
  drawInteractPrompt(g, sx, sy);

  // banner del mapa
  if (g.mapTitleT > 0) {
    const a = Math.min(1, g.mapTitleT);
    ctx.globalAlpha = Math.min(1, a * 1.5);
    textShadow(g, g.map.name, VIEW_W / 2, 90, 18, COL.goldSoft, '#000', 'center', true);
    text(g, g.map.subtitle, VIEW_W / 2, 120, 16, COL.dim, 'center');
    ctx.globalAlpha = 1;
  }

  // aviso de época
  if (g.epochFx > 0) {
    const a = g.epochFx / 0.8;
    ctx.fillStyle = g.epoch === 'pasado' ? `rgba(255, 216, 138, ${a * 0.5})` : `rgba(120, 140, 190, ${a * 0.5})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (a > 0.4) {
      textShadow(g, g.epoch === 'pasado' ? '◆ EL PASADO ◆' : '◆ EL PRESENTE ◆', VIEW_W / 2, 180, 16, g.epoch === 'pasado' ? COL.epochPast : COL.epochNow, '#000', 'center', true);
    }
  }

  // fade de transición
  if (g.fadeT > 0) {
    ctx.fillStyle = `rgba(4,4,10,${g.fadeT})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.restore();
}

function drawProps(g: Game, sx: (n: number) => number, sy: (n: number) => number) {
  const ctx = g.ctx;
  for (const pr of g.map.props) {
    if (pr.needPast && g.epoch !== 'pasado') continue;
    if (pr.needPresent && g.epoch !== 'presente') continue;
    const px = pr.x * TILE + 8, py = pr.y * TILE + 8;
    if (pr.kind === 'sanctuary') {
      const fr = Math.floor(g.globalT * 2) % 2;
      const s = getSpr('sanctuary')[fr];
      ctx.drawImage(s, sx(px - 10), sy(py - 22), 20 * ZOOM, 30 * ZOOM);
      // aura
      ctx.globalAlpha = 0.18 + Math.sin(g.globalT * 2) * 0.08;
      ctx.fillStyle = '#8ef0ff';
      ctx.beginPath();
      ctx.arc(sx(px), sy(py - 6), 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (pr.kind === 'forge') {
      // yunque + brasa
      ctx.fillStyle = '#4a4a58';
      ctx.fillRect(sx(px - 6), sy(py - 4), 12 * ZOOM, 6 * ZOOM);
      ctx.fillStyle = '#5a5a6a';
      ctx.fillRect(sx(px - 8), sy(py - 6), 6 * ZOOM, 4 * ZOOM);
      const fl = 0.6 + Math.sin(g.globalT * 7) * 0.3;
      ctx.fillStyle = `rgba(255,120,40,${fl})`;
      ctx.fillRect(sx(px - 3), sy(py - 9), 6 * ZOOM, 5 * ZOOM);
      ctx.fillStyle = `rgba(255,200,80,${fl})`;
      ctx.fillRect(sx(px - 2), sy(py - 8), 4 * ZOOM, 3 * ZOOM);
    } else if (pr.kind === 'fragment') {
      const fr = Math.floor(g.globalT * 4) % 3;
      const bob = Math.sin(g.globalT * 2.4) * 3;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath();
      ctx.arc(sx(px), sy(py - 6 + bob), 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(getSpr('fragment')[fr], sx(px - 6), sy(py - 12 + bob), 12 * ZOOM, 12 * ZOOM);
    } else if (pr.kind === 'altarEcho') {
      // altar con el Eco (si no recogido)
      ctx.fillStyle = '#6a6a7a';
      ctx.fillRect(sx(px - 7), sy(py - 2), 14 * ZOOM, 8 * ZOOM);
      ctx.fillStyle = '#8a8a9a';
      ctx.fillRect(sx(px - 5), sy(py - 5), 10 * ZOOM, 4 * ZOOM);
      if (!g.flags.ecoVoz) {
        const bob = Math.sin(g.globalT * 2.6) * 3;
        const gl = g.flags.guardianDefeated ? 0.7 : 0.25;
        ctx.globalAlpha = gl;
        ctx.fillStyle = '#ffe9a0';
        ctx.beginPath();
        ctx.arc(sx(px), sy(py - 12 + bob), 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(getSpr('fragment')[Math.floor(g.globalT * 3) % 3], sx(px - 5), sy(py - 18 + bob), 10 * ZOOM, 10 * ZOOM);
      }
    } else if (pr.kind === 'sign') {
      ctx.fillStyle = '#6d4520';
      ctx.fillRect(sx(px - 1), sy(py - 6), 2 * ZOOM, 12 * ZOOM);
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(sx(px - 7), sy(py - 13), 14 * ZOOM, 8 * ZOOM);
      ctx.fillStyle = '#5c3a1e';
      ctx.fillRect(sx(px - 6), sy(py - 11), 12 * ZOOM, 1.5 * ZOOM);
      ctx.fillRect(sx(px - 6), sy(py - 9), 9 * ZOOM, 1.5 * ZOOM);
    }
  }
}

function drawEntity(g: Game, e: Entity, sx: (n: number) => number, sy: (n: number) => number) {
  const ctx = g.ctx;
  const spr = getSpr(e.sprite);
  const zoomW = spr[0].width, zoomH = spr[0].height;

  // sombra
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(sx(e.x), sy(e.y + 4), (e.w / 2 + 3) * ZOOM, 3 * ZOOM, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const fi = frameIndex(e.dir, e.moving, e.anim);
  const idx = Math.min(fi, spr.length - 1);
  const flip = e.dir === 'left';
  const dx = sx(e.x) - (zoomW * ZOOM) / 2;
  const dy = sy(e.y + 4) - zoomH * ZOOM;

  if (flip) {
    ctx.save();
    ctx.translate(dx + zoomW * ZOOM, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(spr[idx], 0, dy, zoomW * ZOOM, zoomH * ZOOM);
    ctx.restore();
  } else {
    ctx.drawImage(spr[idx], dx, dy, zoomW * ZOOM, zoomH * ZOOM);
  }

  // flash de daño
  if ((e as Enemy).hitFlash && (e as Enemy).hitFlash > 0) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    ctx.fillRect(dx + 4, dy + 4, zoomW * ZOOM - 8, zoomH * ZOOM - 8);
    ctx.globalAlpha = 1;
  }

  // telegrafía de ataque
  const en = e as Enemy;
  if (en.kind === 'enemy' && en.ai === 'carga' && en.windup > 0) {
    textShadow(g, '!', sx(e.x), dy - 16, 14, '#ff5040', '#000', 'center', true);
  }
  if (en.kind === 'enemy' && en.ai === 'aturdido') {
    const t = g.globalT * 6;
    text(g, '✦', sx(e.x) + Math.sin(t) * 6, dy - 14, 10, '#ffe86a', 'center');
    if (en.maxSta > 0) text(g, 'QUEBRADO', sx(e.x), dy - 30, 8, '#ffe86a', 'center');
  }

  // barras de vida de enemigos dañados
  if (en.kind === 'enemy' && en.hp < en.maxHp && !en.dead && en.etype !== 'guardian') {
    bar(g, sx(e.x) - 12, dy - 6, 24, 3, en.hp / en.maxHp, COL.hp, COL.hpBg);
  }

  // indicador del jugador
  if (e.kind === 'player') {
    const p = g.player!;
    // aura de época si puede cambiar
    if (p.hasEcho && g.map.epochDiffs.length > 0) {
      ctx.globalAlpha = 0.14 + Math.sin(g.globalT * 3) * 0.06;
      ctx.fillStyle = g.epoch === 'pasado' ? '#ffd88a' : '#8ab8d8';
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y - 5), 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (p.parryFx > 0) {
      ctx.globalAlpha = Math.min(1, p.parryFx * 3);
      ctx.strokeStyle = '#fff8c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y - 6), 14 + (0.32 - p.parryFx) * 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (p.charging && p.chargeT > 0.35) {
      text(g, '▲', sx(p.x), dy - 18, 10, '#ffe86a', 'center');
    }
    // arco de ataque
    if (p.attackT > 0) {
      const prog = 1 - p.attackT / (p.chargedHit ? 0.4 : 0.26);
      const dirs: Record<string, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
      const base = dirs[p.dir] ?? 0;
      const r = (p.chargedHit ? 30 : 20) * ZOOM * 0.8;
      ctx.strokeStyle = p.chargedHit ? '#ffe86a' : '#f0f4f8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y - 4), r, base - 1.1 + prog * 1.4, base + 0.3 + prog * 1.4);
      ctx.stroke();
    }
    // buff grito
    if ((p.buffT ?? 0) > 0) {
      text(g, '⚔', sx(p.x) + 10, sy(p.y) - 26, 10, '#f0a050', 'center');
    }
  }

  // nombre de NPC
  if (e.kind === 'npc') {
    text(g, e.dispName, sx(e.x), dy - 10, 10, '#c8e8f8', 'center');
  }
  if (e.kind === 'companion') {
    text(g, 'Ilwen', sx(e.x), dy - 10, 9, '#a8e8b0', 'center');
    bar(g, sx(e.x) - 10, dy - 4, 20, 2, e.hp / e.maxHp, COL.sta, COL.staBg);
  }
}

function drawCombatFx(g: Game, sx: (n: number) => number, sy: (n: number) => number) {
  const ctx = g.ctx;
  // telegrafías
  for (const t of g.telegraphs) {
    const a = 0.35 + Math.sin(g.globalT * 12) * 0.15;
    ctx.strokeStyle = `rgba(255,80,64,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(t.x), sy(t.y), t.r * ZOOM, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,80,64,${0.12 * (1 - t.t / t.maxT) + 0.08})`;
    ctx.beginPath();
    ctx.arc(sx(t.x), sy(t.y), t.r * ZOOM * (1 - t.t / t.maxT), 0, Math.PI * 2);
    ctx.fill();
  }
  // ondas
  for (const w of g.waves) {
    ctx.strokeStyle = `rgba(180,143,255,${1 - w.r / w.maxR})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx(w.x), sy(w.y), w.r * ZOOM, 0, Math.PI * 2);
    ctx.stroke();
  }
  // proyectiles
  for (const pr of g.projectiles) {
    const x = sx(pr.x), y = sy(pr.y);
    if (pr.sprite === 'p_fire') {
      ctx.fillStyle = '#ff7830';
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(x - 1, y - 1, 4, 4);
    } else if (pr.sprite === 'p_ice') {
      ctx.fillStyle = '#a0e8ff';
      ctx.fillRect(x - 3, y - 1, 6, 2);
      ctx.fillRect(x - 1, y - 3, 2, 6);
      ctx.fillStyle = '#f0fbff';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    } else if (pr.sprite === 'p_arrow') {
      const ang = Math.atan2(pr.vy, pr.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = '#d8c8a0';
      ctx.fillRect(-5, -1, 10, 2);
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(3, -2, 3, 4);
      ctx.restore();
    } else {
      ctx.fillStyle = '#e8d0ff';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
}

function drawLighting(g: Game) {
  const ctx = g.ctx;
  const p = g.player;
  if (!p) return;
  // oscuridad por noche
  const dayLight = Math.max(0.1, Math.sin(g.dayT * Math.PI * 2) * 1.25 + 0.25);
  let darkness = (1 - Math.min(1, dayLight)) * 0.62;
  if (g.map.dark) darkness = 0.8;
  if (darkness > 0.02) {
    ctx.save();
    ctx.fillStyle = g.map.dark ? '#060810' : '#0a1030';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalCompositeOperation = 'destination-out';
    const px = p.x * ZOOM - g.camX, py = (p.y - 6) * ZOOM - g.camY;
    const grad = ctx.createRadialGradient(px, py, 10, px, py, g.map.dark ? 130 : 170);
    grad.addColorStop(0, 'rgba(0,0,0,0.95)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - 200, py - 200, 400, 400);
    // santuarios iluminan
    for (const pr of g.map.props) {
      if (pr.kind !== 'sanctuary') continue;
      const sxp = pr.x * TILE * ZOOM + 8 - g.camX, syp = pr.y * TILE * ZOOM - g.camY;
      if (sxp < -100 || syp < -100 || sxp > VIEW_W + 100 || syp > VIEW_H + 100) continue;
      const grad2 = ctx.createRadialGradient(sxp, syp, 4, sxp, syp, 80);
      grad2.addColorStop(0, 'rgba(0,0,0,0.7)');
      grad2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(sxp - 90, syp - 90, 180, 180);
    }
    ctx.restore();
    if (g.map.dark) {
      ctx.fillStyle = 'rgba(30,20,60,0.18)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
  // niebla del presente
  if (g.epoch === 'presente' && g.map.epochDiffs.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#9ec4b4';
    for (let i = 0; i < 5; i++) {
      const fx = ((g.globalT * 12 + i * 260) % (VIEW_W + 300)) - 150;
      const fy = 80 + i * 95 + Math.sin(g.globalT * 0.8 + i) * 18;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 130, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // destello de daño
  const pl = g.player!;
  if (pl.lastHitT > 0) {
    ctx.fillStyle = `rgba(200,40,40,${pl.lastHitT * 0.7})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // viñeta
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawInteractPrompt(g: Game, sx: (n: number) => number, sy: (n: number) => number) {
  if (g.state !== 'play') return;
  const it = g.nearestInteract();
  if (!it) return;
  const p = g.player!;
  const x = sx(p.x), y = sy(p.y - 26);
  const ctx = g.ctx;
  ctx.fillStyle = 'rgba(10,12,20,0.85)';
  ctx.fillRect(x - 8, y - 9, 16, 13);
  ctx.strokeStyle = COL.gold;
  ctx.strokeRect(x - 8, y - 9, 16, 13);
  text(g, 'E', x, y - 8, 10, COL.gold, 'center', true);
  text(g, it.label, x, y - 24, 13, '#e8e4d8', 'center');
}

// ---------------- HUD ----------------

function drawHud(g: Game) {
  const ctx = g.ctx;
  const p = g.player;
  if (!p) return;

  // ---- panel del jugador (arriba-izquierda) ----
  panel(g, 8, 8, 224, 74);
  // retrato
  const spr = getSpr(p.sprite)[0];
  ctx.save();
  ctx.beginPath();
  ctx.rect(14, 14, 44, 44);
  ctx.clip();
  ctx.drawImage(spr, 14 - (spr.width * 3 - 44) / 2, 14 - (spr.height * 3 - 44) / 2, spr.width * 3, spr.height * 3);
  ctx.restore();
  ctx.strokeStyle = '#5a4a30';
  ctx.strokeRect(14, 14, 44, 44);
  const bx = 66, bw = 158;
  text(g, `${p.name} · Nv ${p.level}`, bx, 12, 14, COL.goldSoft);
  bar(g, bx, 30, bw, 10, p.hp / p.maxHp, COL.hp, COL.hpBg);
  text(g, `${Math.ceil(p.hp)}/${p.maxHp}`, bx + bw / 2, 30, 13, '#fff', 'center');
  bar(g, bx, 44, bw, 7, p.sta / p.maxSta, COL.sta, COL.staBg);
  bar(g, bx, 55, bw, 7, p.res / p.maxRes, COL.res, COL.resBg);
  text(g, 'RES', bx + 2, 55, 12, '#0a2a30');
  // xp
  bar(g, 14, 64, 210, 5, p.xp / g.xpNext(p.level), COL.xp, '#241a30');
  text(g, `XP`, 224, 62, 12, COL.dim, 'right');
  // pociones y oro
  text(g, `${p.gold}`, 242, 10, 15, COL.gold);
  text(g, 'coronas', 242, 26, 12, COL.dim);
  text(g, `${p.potions}× poción (F)`, 242, 42, 13, p.potions > 0 ? '#f0a0b8' : COL.dim);
  if (p.weaponPlus > 0) text(g, `arma +${p.weaponPlus}`, 242, 58, 13, '#d8e0f0');

  // ---- minimapa (arriba-derecha) ----
  if (g.miniCanvas) {
    const mw = 140;
    const mh = Math.round((g.map.h / g.map.w) * mw);
    const mx = VIEW_W - mw - 10, my = 10;
    panel(g, mx - 3, my - 3, mw + 6, mh + 6);
    ctx.drawImage(g.miniCanvas, mx, my, mw, mh);
    // puntos
    for (const n of g.npcs) {
      ctx.fillStyle = '#8ecae8';
      ctx.fillRect(mx + (n.x / (g.map.w * TILE)) * mw - 1, my + (n.y / (g.map.h * TILE)) * mh - 1, 3, 3);
    }
    for (const e of g.enemies) {
      if (e.dead || e.etype === 'guardian') continue;
      if (!e.aggro) continue;
      ctx.fillStyle = '#ff7060';
      ctx.fillRect(mx + (e.x / (g.map.w * TILE)) * mw - 1, my + (e.y / (g.map.h * TILE)) * mh - 1, 3, 3);
    }
    for (const pr of g.map.props) {
      if (pr.kind !== 'sanctuary') continue;
      ctx.fillStyle = '#8ef0ff';
      ctx.fillRect(mx + (pr.x / g.map.w) * mw - 2, my + (pr.y / g.map.h) * mh - 2, 4, 4);
    }
    const px = mx + (p.x / (g.map.w * TILE)) * mw;
    const py = my + (p.y / (g.map.h * TILE)) * mh;
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 2, py - 2, 4, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(px - 4, py - 4, 8, 8);
    // icono día/noche
    const night = g.dayT > 0.7 || g.dayT < 0.08;
    text(g, night ? '☾' : '☀', mx + mw - 12, my + mh + 8, 14, night ? '#a8b8e8' : '#ffe86a');
    text(g, g.map.name, mx, my + mh + 8, 13, COL.dim);
  }

  // ---- habilidades (abajo-centro) ----
  const skills = SKILLS[p.discipline];
  const sw = 52, sh = 46, gap = 8;
  const total = skills.length * sw + (skills.length - 1) * gap;
  const sx0 = (VIEW_W - total) / 2, sy0 = VIEW_H - sh - 12;
  for (let i = 0; i < skills.length; i++) {
    const sk = skills[i];
    const x = sx0 + i * (sw + gap);
    const y = sy0;
    panel(g, x, y, sw, sh, p.cds[i] > 0 ? '#3a3448' : COL.panelBorder);
    text(g, sk.icon, x + sw / 2, y + 5, 16, p.res >= sk.cost ? COL.goldSoft : '#666', 'center');
    text(g, sk.name.split(' ')[0], x + sw / 2, y + 25, 11, p.res >= sk.cost ? COL.text : COL.dim, 'center');
    if (p.cds[i] > 0) {
      ctx.fillStyle = 'rgba(10,10,20,0.7)';
      ctx.fillRect(x, y, sw, sh * Math.min(1, p.cds[i] / sk.cd));
      text(g, `${p.cds[i].toFixed(1)}`, x + sw / 2, y + 14, 12, '#fff', 'center');
    } else if (p.res < sk.cost) {
      text(g, `${sk.cost}`, x + sw / 2, y + 12, 12, COL.danger, 'center');
    }
    text(g, `${i + 1}`, x + 3, y + 2, 10, COL.gold, 'left', true);
  }

  // ---- misión (abajo-derecha) ----
  const q = QUESTS[g.questIdx];
  if (q) {
    const lines = wrapText(g.questProgressText() ?? q.steps[g.questStep], 30);
    const qw = 216;
    const qh = 34 + lines.length * 14;
    panel(g, VIEW_W - qw - 10, VIEW_H - qh - 10, qw, qh);
    text(g, '◆ ' + q.name, VIEW_W - qw, VIEW_H - qh + 2, 13, COL.quest);
    lines.forEach((l, i) => text(g, l, VIEW_W - qw, VIEW_H - qh + 20 + i * 14, 14, COL.text));
  }

  // ---- barra del jefe ----
  if (g.bossActive && g.bossRef && !g.bossRef.dead) {
    const boss = g.bossRef;
    const bw2 = 420, bx2 = (VIEW_W - bw2) / 2, by2 = 16;
    textShadow(g, ENEMY_DEFS.guardian.name, VIEW_W / 2, by2 - 14, 12, COL.boss, '#000', 'center', true);
    bar(g, bx2, by2, bw2, 12, boss.hp / boss.maxHp, '#8a4ad0', COL.bossBg);
    if (boss.maxSta > 0) {
      bar(g, bx2, by2 + 14, bw2, 5, boss.sta / boss.maxSta, '#7ee8ff', '#12303a');
      text(g, 'QUIEBRE', bx2 + bw2 + 6, by2 + 9, 11, '#7ee8ff');
    }
    text(g, `FASE ${boss.phase}/3`, bx2 - 6, by2 + 2, 12, COL.boss, 'right');
  }

  // ---- toasts ----
  let ty = VIEW_H - 96;
  for (let i = g.toasts.length - 1; i >= 0; i--) {
    const t = g.toasts[i];
    const alpha = Math.min(1, t.t * 2);
    ctx.globalAlpha = alpha;
    const lines = wrapText(t.text, 52);
    const th = lines.length * 15 + 10;
    const tw = Math.min(430, Math.max(...lines.map(l => l.length)) * 6.4 + 20);
    panel(g, 12, ty - th + 14, tw, th, 'rgba(90,74,48,0.6)');
    lines.forEach((l, j) => text(g, l, 22, ty - th + 20 + j * 15, 14, t.color ?? COL.text));
    ctx.globalAlpha = 1;
    ty -= th + 6;
  }

  // ---- pista contextual ----
  if (g.state === 'play') {
    let hint: string | null = null;
    if (p.hasEcho && !g.flags.usedEpoch && g.map.epochDiffs.length > 0) hint = 'Pulsa Q para alternar entre el presente y el pasado';
    else if (g.questIdx === 0 && !g.flags.hintMove) hint = 'WASD para moverte · clic izq: atacar · Espacio: esquivar · clic der: parar · E: interactuar';
    if (hint) {
      const lines = wrapText(hint, 60);
      ctx.fillStyle = 'rgba(8,10,18,0.7)';
      ctx.fillRect(0, VIEW_H - 24 - lines.length * 14, VIEW_W, lines.length * 14 + 10);
      lines.forEach((l, i) => text(g, l, VIEW_W / 2, VIEW_H - 20 - (lines.length - 1 - i) * 14, 14, '#c8d0e0', 'center'));
    }
  }
}
