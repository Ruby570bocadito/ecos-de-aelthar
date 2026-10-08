// ============================================================
// ECOS DE AELTHAR — Render de mundo y HUD (AGENTE 3-a · visuales)
// Capas: suelo → props → estelas → entidades → FX → ambiente →
// iluminación → cielo → números flotantes → HUD → overlays.
// ============================================================

import type { Game } from './engine';
import type { Entity, Enemy } from './types';
import { VIEW_W, VIEW_H, ZOOM, TILE, getSpr, SKILLS, QUESTS } from './engine';
import { tileAt } from './maps';
import { ENEMY_DEFS } from './data';
import { COL, text, textShadow, panel, bar, clearHits, wrapText, fBody } from './ui';
import { drawScreens } from './screens';
import { drawSlashArc, entityFrame, drawPortrait } from './sprites';
import {
  fxFrame, updateAmbient, drawAmbient, getRollTrail,
  bannerInfo, memoryAlpha, TRAIL_LIFE,
} from './fx';
import { drawLightingV2 } from './world/lighting';
import { updateWeather, drawWeatherWorld, drawWeatherSky } from './world/weather';
import { drawDayNightGrade, drawCloudShadows } from './world/sky';
import { waterOverlay } from './world/water';
import { drawPropV2 } from './world/props';
import { drawMinimapOverlay } from './world/minimap';
// Ronda 2 · Terror: overlay de pavor, presentación del jefe, FX de fases y frames nuevos
import { drawHorrorOverlay, getHorrorShake } from './actors/horror';
import { drawBossIntro } from './actors/bossintro';
import { drawBossFx } from './actors/bossfx';
import { wolfFrameAI, guardianFrame } from './actors/enemies';
import type { GuardianState } from './actors/enemies';

const WORLD_FILTER: Record<string, string> = {
  presente: 'saturate(0.74) contrast(0.98)',
  pasado: 'saturate(1.35) brightness(1.1)',
};

export function drawGame(g: Game) {
  const ctx = g.ctx;
  clearHits(g);
  const dtF = fxFrame(g); // dt de dibujado + decaimiento seguro del shake
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  if (g.state === 'title' || g.state === 'controls') {
    drawScreens(g);
    return;
  }

  if (g.state === 'play' || g.state === 'dialogue') {
    updateAmbient(g, dtF);
    updateWeather(g, dtF); // clima por mapa (R1): pool determinista, resetea al cambiar mapa/época
  }

  drawWorld(g);
  drawHud(g);
  drawOverlays(g); // destello, memoria, banner de jefe (sobre el HUD)
  drawScreens(g); // intro, pause, dialogue, dead, end (overlays)
}

// ---------------- Mundo ----------------

function drawWorld(g: Game) {
  const ctx = g.ctx;
  // sacudida de cámara (g.shake decae en update y, por seguridad, en fxFrame)
  // + micro-temblor del terror (Ronda 2): solo activo con el jefe en fase final
  const hs = getHorrorShake();
  const shx = (g.shake > 0.2 ? (Math.random() - 0.5) * g.shake * 2 : 0) + hs;
  const shy = (g.shake > 0.2 ? (Math.random() - 0.5) * g.shake * 2 : 0) + hs * 0.7;
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

  // sombras de nube (módulo sky): solo exterior de día; se dibuja ENCIMA del
  // suelo y SIN WORLD_FILTER (atmósfera, no terreno)
  drawCloudShadows(ctx, g);

  // agua animada (módulo water): olas/espuma sobre el prerrender estático,
  // con el MISMO filtro de época que el suelo para fundirse con él
  ctx.save();
  ctx.filter = WORLD_FILTER[g.epoch] ?? 'none';
  waterOverlay(ctx, camX, camY, g.globalT, g.mapId,
    (tx, ty) => tileAt(g.map, g.rows, tx, ty, g.epoch));
  ctx.restore();

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
    const fr = Math.floor(g.globalT * 3) % getSpr('wisp').length;
    ctx.globalAlpha = 0.75;
    ctx.drawImage(getSpr('wisp')[fr], sx(ec.x * TILE + 8 - 5), sy(ec.y * TILE + 2 + bob), 10 * ZOOM, 10 * ZOOM);
    ctx.globalAlpha = 1;
  }

  // props (v2: obeliscos, forja, fragmentos, altares, carteles, portones)
  drawProps(g);

  // aura de suelo, esquirlas orbitando y grietas del Guardián (Ronda 2):
  // bajo las entidades, dentro del filtro de época para fundirse con el mundo
  drawBossFx(ctx, g);

  // estelas de esquiva (afterimages del jugador, bajo las entidades)
  drawRollTrail(g, sx, sy);

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
    ctx.drawImage(sprC, sx(ch.x * TILE), sy(ch.y * TILE - 2), sprC.width * ZOOM, sprC.height * ZOOM);
  }

  drawCombatFx(g, sx, sy);

  // partículas
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.t / p.maxT);
    ctx.fillStyle = p.color;
    ctx.fillRect(sx(p.x) - p.size, sy(p.y) - p.size, p.size * 2 * ZOOM * 0.6, p.size * 2 * ZOOM * 0.6);
  }
  ctx.globalAlpha = 1;

  // partículas ambientales del mapa (motas, hojas, ceniza, niebla...)
  drawAmbient(g, 'world');
  // clima por mapa (R1): niebla/haces/bruma + partículas del pool, SIN filtro de época
  drawWeatherWorld(ctx, g);

  // iluminación v2 (módulo lighting): ciclo día/noche + oscuridad recortada
  // por luces + tinte aditivo + viñeta
  drawLightingV2(ctx, g);
  // feedback de juego que vivía en el antiguo drawLighting y NO es iluminación:
  // niebla del presente, destello de daño y viñeta roja por vida baja
  drawLightingExtras(g);

  // grading día/noche por franjas (módulo sky), sobre la luz y bajo el HUD
  if (g.state === 'play' || g.state === 'dialogue') {
    drawDayNightGrade(ctx, g);
  }

  // capa de cielo: estrellas, luna, antorchas (sobre la iluminación)
  drawAmbient(g, 'sky');
  // clima capa cielo (R1): luciérnagas/briznas/polen/chispas con halo 'lighter'
  drawWeatherSky(ctx, g);

  // terror ambiental (Ronda 2): viñeta cardiaca + susurros junto a sombras +
  // ojos en la niebla del bosque nocturno (después de la luz, antes del HUD)
  drawHorrorOverlay(ctx, g);

  // textos flotantes (después de la luz: siempre legibles)
  drawFloats(g, sx, sy);

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

// ---------------- Estelas de esquiva ----------------

function drawRollTrail(g: Game, sx: (n: number) => number, sy: (n: number) => number) {
  const ctx = g.ctx;
  const p = g.player;
  if (!p) return;
  const trail = getRollTrail();
  if (trail.length === 0) return;
  const spr = getSpr(p.sprite);
  for (const tp of trail) {
    const a = Math.max(0, tp.life / TRAIL_LIFE) * 0.35;
    if (a <= 0.02) continue;
    const fr = Math.min(entityFrame(spr, tp.dir, true, tp.anim), spr.length - 1);
    const dx = sx(tp.x) - (spr[0].width * ZOOM) / 2;
    const dy = sy(tp.y + 4) - spr[0].height * ZOOM;
    ctx.save();
    ctx.filter = WORLD_FILTER[g.epoch] ?? 'none';
    ctx.globalAlpha = a;
    if (tp.dir === 'left') {
      ctx.translate(dx + spr[0].width * ZOOM, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(spr[fr], 0, dy, spr[0].width * ZOOM, spr[0].height * ZOOM);
    } else {
      ctx.drawImage(spr[fr], dx, dy, spr[0].width * ZOOM, spr[0].height * ZOOM);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------------- Props ----------------

function drawProps(g: Game) {
  const p = g.player;
  for (const pr of g.map.props) {
    if (pr.needPast && g.epoch !== 'pasado') continue;
    if (pr.needPresent && g.epoch !== 'presente') continue;
    const px = pr.x * TILE + 8, py = pr.y * TILE + 8;
    // prop "seleccionado": cerca del jugador (<24 px) — lo usa 'sign' para
    // el temblor y el globo de lectura (drawPropV2 aplica su propia cámara)
    const selected = !!(p && Math.hypot(px - p.x, py - p.y) < 24);
    drawPropV2(g.ctx, pr.kind, px, py, g, selected);
  }
}

// ---------------- Entidades ----------------

function drawEntity(g: Game, e: Entity, sx: (n: number) => number, sy: (n: number) => number) {
  const ctx = g.ctx;
  const spr = getSpr(e.sprite);
  const zoomW = spr[0].width, zoomH = spr[0].height;

  // parpadeo suave del jugador durante i-frames (esquiva/daño reciente)
  let spriteAlpha = 1;
  if (e.kind === 'player') {
    const pp = g.player!;
    if (pp.iframes > 0 && pp.rollT <= 0) spriteAlpha = 0.55 + Math.abs(Math.sin(g.globalT * 24)) * 0.35;
  }

  // sombra (estable)
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(sx(e.x), sy(e.y + 4), (e.w / 2 + 3) * ZOOM, 3 * ZOOM, 0, 0, Math.PI * 2);
  ctx.fill();

  // frames v2 (Ronda 2): el lobo usa su ciclo de 6 fases por IA y el Guardián
  // sus 8 frames por estado (idle/grito/invoca/colapso); el resto, ciclo normal
  const enF = e as Enemy;
  let fi: number;
  if (e.kind === 'enemy' && enF.etype === 'lobo') {
    fi = wolfFrameAI(enF.ai, e.anim);
  } else if (e.kind === 'enemy' && enF.etype === 'guardian') {
    const st: GuardianState = enF.ai === 'aturdido' || enF.phase >= 3 ? 'colapso'
      : enF.ai === 'carga' && enF.windup > 0 ? 'grito'
      : enF.sumT > 0 ? 'invoca' : 'idle';
    fi = guardianFrame(st, e.anim);
  } else {
    fi = entityFrame(spr, e.dir, e.moving, e.anim);
  }
  const idx = Math.min(fi, spr.length - 1);
  const flip = e.dir === 'left';
  const dx = sx(e.x) - (zoomW * ZOOM) / 2;
  const dy = sy(e.y + 4) - zoomH * ZOOM;

  ctx.globalAlpha = spriteAlpha;
  if (flip) {
    ctx.save();
    ctx.translate(dx + zoomW * ZOOM, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(spr[idx], 0, dy, zoomW * ZOOM, zoomH * ZOOM);
    ctx.restore();
  } else {
    ctx.drawImage(spr[idx], dx, dy, zoomW * ZOOM, zoomH * ZOOM);
  }
  ctx.globalAlpha = 1;

  // flash de daño
  const en = e as Enemy;
  if (en.hitFlash && en.hitFlash > 0) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    ctx.fillRect(dx + 4, dy + 4, zoomW * ZOOM - 8, zoomH * ZOOM - 8);
    ctx.globalAlpha = 1;
  }

  // telegrafía de ataque
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

  // iconos de estado con mini-barra de tiempo
  if (en.kind === 'enemy' && !en.dead) {
    drawStatusIcons(g, en, sx(e.x), dy - 12);
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
      // indicador de carga: aro que crece + flecha
      const k = Math.min(1, p.chargeT / 0.8);
      ctx.globalAlpha = 0.5 + k * 0.4;
      ctx.strokeStyle = '#ffe86a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y - 4), 12 + k * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      text(g, '▲', sx(p.x), dy - 18, 10, '#ffe86a', 'center');
    }
    // arco de ataque (combo: blanco → amarillo → dorado; cargado: dorado con estela)
    if (p.attackT > 0) {
      const dur = p.chargedHit ? 0.4 : 0.26;
      const prog = Math.max(0, Math.min(1, 1 - p.attackT / dur));
      drawSlashArc(ctx, sx(p.x), sy(p.y - 4), p.dir, prog, p.combo, !!p.chargedHit, ZOOM);
    }
    // buff grito
    if ((p.buffT ?? 0) > 0) {
      text(g, '⚔', sx(p.x) + 10, sy(p.y) - 26, 10, '#f0a050', 'center');
    }
  }

  // nombre de NPC
  if (e.kind === 'npc') {
    text(g, (e as unknown as { dispName: string }).dispName, sx(e.x), dy - 10, 10, '#c8e8f8', 'center');
  }
  if (e.kind === 'companion') {
    text(g, 'Ilwen', sx(e.x), dy - 10, 9, '#a8e8b0', 'center');
    bar(g, sx(e.x) - 10, dy - 4, 20, 2, e.hp / e.maxHp, COL.sta, COL.staBg);
  }
}

// ---------------- Iconos de estado ----------------

function drawStatusIcons(g: Game, en: Enemy, cx: number, y: number) {
  const ctx = g.ctx;
  const list = en.statuses.filter(s => s.t > 0).slice(-3);
  const marked = (en.marked ?? 0) > 0;
  const total = list.length + (marked ? 1 : 0);
  if (total === 0) return;
  let ix = cx - (total * 9) / 2 + 1;
  for (const s of list) {
    drawStatusIcon(g, s.kind, ix, y, s.t / (s.kind === 'quemado' ? 3 : 2.5));
    ix += 10;
  }
  if (marked) {
    drawMarkIcon(g, ix, y, Math.min(1, (en.marked ?? 0) / 5));
  }
}

function drawStatusIcon(g: Game, kind: string, x: number, y: number, fill: number) {
  const ctx = g.ctx;
  const flick = Math.sin(g.globalT * 14 + x) * 0.5 + 0.5;
  if (kind === 'quemado') {
    // llama
    ctx.fillStyle = '#ff7830';
    ctx.fillRect(x + 1, y + 2 + (1 - flick) * 1.5, 4, 3);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x + 2, y + (1 - flick) * 2, 2, 3);
    ctx.fillStyle = '#fff3c0';
    ctx.fillRect(x + 2, y + 1 + (1 - flick) * 2, 1, 1);
  } else if (kind === 'congelado') {
    // cristal
    ctx.fillStyle = '#a0e8ff';
    ctx.fillRect(x + 2, y - 1, 2, 2);
    ctx.fillRect(x + 1, y + 1, 4, 2);
    ctx.fillRect(x + 2, y + 3, 2, 2);
    ctx.fillStyle = '#f0fbff';
    ctx.fillRect(x + 2, y + 1, 1, 1);
  }
  // mini-barra de tiempo restante
  ctx.fillStyle = 'rgba(8,8,16,0.75)';
  ctx.fillRect(x - 1, y + 6, 8, 2);
  ctx.fillStyle = kind === 'quemado' ? '#ff9040' : '#a0e8ff';
  ctx.fillRect(x - 1, y + 6, 8 * Math.max(0, Math.min(1, fill)), 2);
}

function drawMarkIcon(g: Game, x: number, y: number, fill: number) {
  const ctx = g.ctx;
  const pulse = Math.sin(g.globalT * 6) * 0.5 + 0.5;
  // marca de onda / ojo del Eco
  ctx.strokeStyle = `rgba(224,138,208,${0.6 + pulse * 0.4})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + 3, y + 2, 2.5 + pulse * 1.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e08ad0';
  ctx.fillRect(x + 2, y + 1, 2, 2);
  ctx.fillStyle = 'rgba(8,8,16,0.75)';
  ctx.fillRect(x - 1, y + 6, 8, 2);
  ctx.fillStyle = '#e08ad0';
  ctx.fillRect(x - 1, y + 6, 8 * fill, 2);
}

// ---------------- FX de combate ----------------

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

// ---------------- Iluminación ----------------

/** Feedback de juego que vivía dentro del antiguo drawLighting y que NO forma
 *  parte de la iluminación (esa la lleva ahora world/lighting.ts). Se llama
 *  justo después de drawLightingV2. */
function drawLightingExtras(g: Game) {
  const ctx = g.ctx;

  // niebla del presente (además de las bandas de fx.ts)
  if (g.epoch === 'presente' && g.map.epochDiffs.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#9ec4b4';
    for (let i = 0; i < 4; i++) {
      const fx = ((g.globalT * 12 + i * 260) % (VIEW_W + 300)) - 150;
      const fy = 80 + i * 110 + Math.sin(g.globalT * 0.8 + i) * 18;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 130, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // destello de daño
  const p = g.player;
  if (p && p.lastHitT > 0) {
    ctx.fillStyle = `rgba(200,40,40,${p.lastHitT * 0.7})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (!p) return;

  // viñeta roja pulsante con poca vida
  const hpPct = p.hp / p.maxHp;
  if (hpPct < 0.3 && p.hp > 0) {
    const severity = 1 - hpPct / 0.3;               // 0 → 1
    const pulse = 0.5 + 0.5 * Math.sin(g.globalT * 5);
    const a = (0.10 + pulse * 0.10) * (0.4 + severity * 0.6);
    const rg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78);
    rg.addColorStop(0, 'rgba(160,20,30,0)');
    rg.addColorStop(1, `rgba(180,20,30,${a})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

// ---------------- Números de daño flotantes ----------------

const FLOAT_SPECIAL = new Set(['QUEBRADO', '¡PARADA!', '¡REMATE!', '¡CRÍTICO!']);

function drawFloats(g: Game, sx: (n: number) => number, sy: (n: number) => number) {
  const ctx = g.ctx;
  for (const f of g.floats) {
    const alpha = Math.min(1, f.t * 2.2);
    if (alpha <= 0) continue;
    // pop: más grande los primeros ~0.15 s
    const pop = f.t > 0.74 ? 1.38 : 1;
    const special = FLOAT_SPECIAL.has(f.text);
    let size = f.size * 1.6 * pop;
    let color = f.color;
    if (special) { color = '#ffe86a'; size *= 1.3; }
    else if (f.color === '#ffd24a') size *= 1.15; // críticos dorados
    else if (f.color === '#ff7060') size *= 1.08; // daño propio
    const x = sx(f.x), y = sy(f.y);
    ctx.globalAlpha = alpha;
    ctx.font = fBody(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // contorno oscuro (4 direcciones + diagonal)
    ctx.fillStyle = 'rgba(14,10,20,0.9)';
    ctx.fillText(f.text, x + 1, y);
    ctx.fillText(f.text, x - 1, y);
    ctx.fillText(f.text, x, y + 1);
    ctx.fillText(f.text, x, y - 1);
    ctx.fillText(f.text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(f.text, x, y);
    if (special) {
      // subrayado brillante para los remates
      ctx.fillStyle = 'rgba(255,232,106,0.8)';
      ctx.fillRect(x - size * f.text.length * 0.22, y + size * 1.05, size * f.text.length * 0.44, 1.5);
    }
  }
  ctx.globalAlpha = 1;
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
  // retrato pixel del Portador (respira y parpadea)
  const blinkHud = (g.globalT % 3.9) < 0.13;
  const hudBob = Math.round(Math.sin(g.globalT * 2.1)) * 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(14, 14, 44, 44);
  ctx.clip();
  ctx.fillStyle = '#141020';
  ctx.fillRect(14, 14, 44, 44);
  drawPortrait(ctx, p.discipline === 'alba' ? 'hero_alba' : 'hero_tejedor', 14 + (44 - 28 * 1.06) / 2, 14 + (44 - 40 * 1.06) / 2 + hudBob, 1.06, blinkHud, performance.now());
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

  // ---- minimapa v2 (arriba-derecha): marco remachado + placa + marcadores.
  // El canvas depende de la época (el pasado se genera aparte en buildGround).
  const mini = g.epoch === 'pasado' && g.miniCanvasPast ? g.miniCanvasPast : g.miniCanvas;
  if (mini) {
    drawMinimapOverlay(ctx, mini, g);
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

  // ---- toasts (entrada deslizante desde la derecha + fade) ----
  let ty = VIEW_H - 96;
  for (let i = g.toasts.length - 1; i >= 0; i--) {
    const t = g.toasts[i];
    const enter = Math.max(0, Math.min(1, (3.4 - t.t) / 0.28));
    const ease = 1 - Math.pow(1 - enter, 3);
    const offX = (1 - ease) * 300;
    ctx.globalAlpha = Math.min(1, t.t * 2) * (0.35 + 0.65 * ease);
    const lines = wrapText(t.text, 52);
    const th = lines.length * 15 + 10;
    const tw = Math.min(430, Math.max(...lines.map(l => l.length)) * 6.4 + 20);
    const tx = 12 + offX;
    panel(g, tx, ty - th + 14, tw, th, 'rgba(90,74,48,0.6)');
    lines.forEach((l, j) => text(g, l, tx + 10, ty - th + 20 + j * 15, 14, t.color ?? COL.text));
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

// ---------------- Overlays a pantalla completa ----------------

function drawOverlays(g: Game) {
  const ctx = g.ctx;
  const p = g.player;

  // 1) destello de pantalla (impactos en 'lighter', blancos normales)
  if (g.flashT > 0) {
    const a = Math.min(0.85, (g.flashT / 0.18) * 0.75);
    const isWhite = g.flashColor.toLowerCase() === '#ffffff';
    ctx.save();
    if (isWhite) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.fillStyle = g.flashColor;
    }
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  // 2) overlay de memoria (vitral-eco): no bloquea el input
  if (g.memoryReveal) drawMemoryOverlay(g);

  // 3) presentación cinematográfica del jefe (Ronda 2): letterbox + banner
  drawBossIntro(ctx, g);

  // 4) banner dramático de jefe
  if (g.bossBannerT > 0) drawBossBanner(g);

  void p;
}

// ---- vitral-eco de memoria ----
function drawMemoryOverlay(g: Game) {
  const ctx = g.ctx;
  const mem = g.memoryReveal!;
  const a = memoryAlpha(g);
  if (a <= 0.01) return;
  const lines = wrapText(mem.text, 44);
  const w = 580;
  const h = 96 + lines.length * 18 + 34;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  const pulse = 0.5 + 0.5 * Math.sin(g.globalT * 2.2);

  ctx.save();
  ctx.globalAlpha = a;

  // resplandor trasero
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 40, VIEW_W / 2, VIEW_H / 2, 340);
  glow.addColorStop(0, `rgba(240,200,120,${0.10 + pulse * 0.05})`);
  glow.addColorStop(1, 'rgba(240,200,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalCompositeOperation = 'source-over';

  // panel vitral
  ctx.fillStyle = 'rgba(14,12,32,0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(30,24,56,0.5)';
  ctx.fillRect(x, y, w, 10);
  ctx.fillRect(x, y + h - 10, w, 10);

  // marco ondulado (vitral) — segmentos con seno
  const wave = (x0: number, y0: number, x1: number, y1: number, color: string, lw: number, amp: number, freq: number, ph: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps;
      const wx = x0 + (x1 - x0) * tt;
      const wy = y0 + (y1 - y0) * tt + Math.sin(tt * freq + ph) * amp;
      if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  };
  const g1 = `rgba(255,233,160,${0.75 + pulse * 0.2})`;
  wave(x + 3, y + 5, x + w - 3, y + 5, g1, 2, 2.2, 9, 0);
  wave(x + 3, y + h - 5, x + w - 3, y + h - 5, g1, 2, 2.2, 9, 2);
  wave(x + 5, y + 3, x + 5, y + h - 3, 'rgba(200,180,255,0.5)', 1.5, 2, 8, 1);
  wave(x + w - 5, y + 3, x + w - 5, y + h - 3, 'rgba(200,180,255,0.5)', 1.5, 2, 8, 3);
  // esquinas doradas
  ctx.fillStyle = COL.gold;
  for (const [cxx, cyy] of [[x + 6, y + 8], [x + w - 6, y + 8], [x + 6, y + h - 8], [x + w - 6, y + h - 8]]) {
    ctx.fillRect(cxx - 2, cyy - 2, 4, 4);
  }

  // motivo de onda sobre el título (la marca del Eco)
  ctx.strokeStyle = `rgba(142,240,255,${0.5 + pulse * 0.3})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const wx = VIEW_W / 2 - 60 + i * 3;
    const wy = y + 26 + Math.sin(i * 0.5 + g.globalT * 2.4) * 3;
    if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
  }
  ctx.stroke();

  // título y texto
  textShadow(g, mem.title, VIEW_W / 2, y + 36, 15, COL.goldSoft, '#000', 'center', true);
  lines.forEach((l, i) => text(g, l, VIEW_W / 2, y + 62 + i * 18, 16, COL.text, 'center'));

  // marca de onda inferior
  ctx.fillStyle = `rgba(255,233,160,${0.4 + pulse * 0.3})`;
  for (let i = 0; i < 5; i++) {
    const wob = Math.sin(g.globalT * 3 + i) * 2;
    ctx.fillRect(VIEW_W / 2 - 24 + i * 12, y + h - 24 + wob, 3, 3);
  }
  ctx.restore();
}

// ---- banner de jefe ----
function drawBossBanner(g: Game) {
  const ctx = g.ctx;
  const { slide, out, elapsed } = bannerInfo(g);
  if (out <= 0.01) return;
  const ease = 1 - Math.pow(1 - slide, 3);
  const offsetY = -100 + ease * 104;
  const tremble = Math.sin(elapsed * 42) * 1.1 * (1 - slide);
  const bandH = 82;

  ctx.save();
  ctx.globalAlpha = out;

  // banda superior
  const grad = ctx.createLinearGradient(0, offsetY, 0, offsetY + bandH);
  grad.addColorStop(0, 'rgba(10,6,20,0.95)');
  grad.addColorStop(1, 'rgba(26,12,40,0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, offsetY, VIEW_W, bandH);
  // líneas decorativas
  ctx.fillStyle = 'rgba(176,143,255,0.85)';
  ctx.fillRect(0, offsetY + bandH - 3, VIEW_W, 2);
  ctx.fillStyle = 'rgba(255,233,160,0.5)';
  ctx.fillRect(0, offsetY + bandH, VIEW_W, 1);
  ctx.fillStyle = 'rgba(176,143,255,0.4)';
  ctx.fillRect(0, offsetY + 2, VIEW_W, 1);

  // rombos laterales
  const diamond = (dx: number, dy: number, s: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(dx, dy - s); ctx.lineTo(dx + s, dy); ctx.lineTo(dx, dy + s); ctx.lineTo(dx - s, dy);
    ctx.closePath();
    ctx.fill();
  };
  const midY = offsetY + bandH / 2 + 4;
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5);
  diamond(90, midY, 5 + pulse * 1.5, `rgba(176,143,255,${0.6 + pulse * 0.4})`);
  diamond(VIEW_W - 90, midY, 5 + pulse * 1.5, `rgba(176,143,255,${0.6 + pulse * 0.4})`);
  ctx.strokeStyle = 'rgba(176,143,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(110, midY); ctx.lineTo(240, midY);
  ctx.moveTo(VIEW_W - 110, midY); ctx.lineTo(VIEW_W - 240, midY);
  ctx.stroke();

  // textos con temblor sutil
  textShadow(g, g.bossBannerText, VIEW_W / 2 + tremble, offsetY + 16, 21, COL.boss, '#000', 'center', true);
  text(g, g.bossBannerSub, VIEW_W / 2 - tremble, offsetY + 52, 14, 'rgba(200,190,230,0.9)', 'center');
  ctx.restore();
}
