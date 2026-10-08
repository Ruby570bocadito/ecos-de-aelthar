// ============================================================
// ECOS DE AELTHAR — Pantallas y overlays
// Título, controles, intro, pausa, diálogo, muerte, final
// ============================================================

import type { Game } from './engine';
import { VIEW_W, VIEW_H, getSpr, QUESTS } from './engine';
import { ATTR_INFO, KEY_ITEMS } from './data';
import { audio } from './audio';
import { COL, text, textShadow, panel, bar, button, wrapText, addHit } from './ui';

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

export function drawScreens(g: Game) {
  switch (g.state) {
    case 'title': drawTitle(g); break;
    case 'controls': drawControls(g); break;
    case 'intro': drawIntro(g); break;
    case 'pause': drawPause(g); break;
    case 'dialogue': drawDialogue(g); break;
    case 'dead': drawDead(g); break;
    case 'end': drawEnd(g); break;
    default: break;
  }
}

// ---------------- Título ----------------

function drawTitle(g: Game) {
  const ctx = g.ctx;
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
    const tw = 0.4 + Math.abs(Math.sin(g.globalT * 1.5 + i)) * 0.6;
    ctx.fillStyle = `rgba(220,228,255,${tw * 0.5})`;
    ctx.fillRect(x, y, 2, 2);
  }
  // niebla
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#9ec4b4';
  for (let i = 0; i < 6; i++) {
    const fx = ((g.globalT * 16 + i * 220) % (VIEW_W + 320)) - 160;
    ctx.beginPath();
    ctx.ellipse(fx, VIEW_H - 90 + (i % 3) * 36, 170, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // wisps flotantes
  for (let i = 0; i < 5; i++) {
    const wx = (VIEW_W / 6) * i + Math.sin(g.globalT + i * 2) * 40 + 60;
    const wy = 330 + Math.cos(g.globalT * 0.8 + i * 1.7) * 30;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(getSpr('wisp')[Math.floor(g.globalT * 3 + i) % 2], wx, wy, 20, 20);
    ctx.globalAlpha = 1;
  }
  // silueta de la cripta / obelisco
  ctx.fillStyle = '#0c0e1c';
  ctx.fillRect(VIEW_W / 2 - 30, VIEW_H - 150, 60, 150);
  ctx.fillRect(VIEW_W / 2 - 44, VIEW_H - 130, 88, 130);
  ctx.globalAlpha = 0.6 + Math.sin(g.globalT * 2) * 0.2;
  ctx.fillStyle = '#8ef0ff';
  ctx.fillRect(VIEW_W / 2 - 6, VIEW_H - 120, 12, 40);
  ctx.globalAlpha = 1;

  // logo
  const bob = Math.sin(g.globalT * 1.4) * 3;
  textShadow(g, 'ECOS DE', VIEW_W / 2, 78 + bob, 20, '#b0b8d0', '#000', 'center', true);
  textShadow(g, 'AELTHAR', VIEW_W / 2, 110 + bob, 42, COL.gold, '#2a1a08', 'center', true);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(VIEW_W / 2 - 180, 168, 360, 2);
  text(g, 'RPG 2D de acción y exploración · Demo jugable (vertical slice)', VIEW_W / 2, 180, 17, COL.dim, 'center');

  // botones
  const bx = VIEW_W / 2 - 130, bw = 260;
  button(g, 'NUEVA PARTIDA', bx, 236, bw, 44, () => g.requestCreate(), 13);
  if (g.hasSave()) {
    button(g, 'CONTINUAR', bx, 290, bw, 44, () => g.continueGame(), 13);
    button(g, 'CONTROLES', bx, 344, bw, 40, () => { g.setState('controls'); }, 12);
  } else {
    button(g, 'CONTROLES', bx, 290, bw, 44, () => { g.setState('controls'); }, 13);
  }

  text(g, 'Basado en el Documento de Diseño de @papito · 8 oct 2026', VIEW_W / 2, VIEW_H - 40, 15, 'rgba(154,160,184,0.8)', 'center');
  text(g, 'v0.1 · Lunaris — Bosque Susurrante — Cripta del Primer Canto', VIEW_W / 2, VIEW_H - 20, 14, 'rgba(122,128,148,0.7)', 'center');
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
  if (g.keys.has('escape')) g.setState('title');
}

// ---------------- Intro ----------------

function drawIntro(g: Game) {
  const ctx = g.ctx;
  ctx.fillStyle = '#06070f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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
  const pw = 640, ph = 420;
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

  const cx = px + 24, cy = py + 92;

  if (g.pauseTab === 0) {
    // ESTADO
    text(g, `${p.name} — Portador nivel ${p.level}`, cx, cy, 20, COL.goldSoft);
    bar(g, cx, cy + 28, 240, 8, p.xp / g.xpNext(p.level), COL.xp, '#241a30');
    text(g, `XP ${Math.floor(p.xp)} / ${g.xpNext(p.level)}`, cx + 250, cy + 24, 15, COL.dim);
    text(g, `Puntos de atributo: ${p.points}`, cx, cy + 48, 17, p.points > 0 ? '#ffe86a' : COL.dim);
    let y = cy + 76;
    for (const at of ATTR_INFO) {
      text(g, at.name, cx, y, 17, COL.text);
      text(g, `${p.attrs[at.id]}`, cx + 120, y, 17, COL.goldSoft);
      text(g, at.desc, cx + 170, y + 2, 14, COL.dim);
      if (p.points > 0) {
        button(g, '+', cx + 400, y - 4, 30, 24, () => {
          p.attrs[at.id]++; p.points--;
          audioClick();
        }, 12);
      }
      y += 30;
    }
    // stats derivados
    const melee = 12 + p.attrs.fue * 1.5 + p.level + p.weaponPlus * 2.5;
    const spell = 10 + p.attrs.int * 1.6 + p.level;
    text(g, `Daño melé: ${Math.round(melee)}   Daño de Cantos: ${Math.round(spell)}   Crítico: ${Math.min(40, 5 + p.attrs.des * 2)}%`, cx, y + 8, 15, COL.dim);
    text(g, `Vida: ${p.maxHp}   Reducción: ${Math.min(50, p.attrs.vig)}%   Resonancia máx: ${p.maxRes}`, cx, y + 28, 15, COL.dim);
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
    if (g.flags.fragmentTouched) { text(g, `◆ ${KEY_ITEMS.fragment.name}`, cx, ky, 16, COL.text); ky += 22; text(g, KEY_ITEMS.fragment.desc, cx + 16, ky, 13, COL.dim); ky += 20; }
    if (g.flags.ecoVoz) { text(g, `◆ ${KEY_ITEMS.ecoVoz.name}`, cx, ky, 16, '#ffe9a0'); ky += 22; text(g, KEY_ITEMS.ecoVoz.desc, cx + 16, ky, 13, COL.dim); ky += 20; }
    if (ky === cy + 120) { text(g, '(aún no llevas ninguno)', cx, ky, 15, COL.dim); ky += 22; }
    text(g, 'FACCIÓN: Guardianes del Canto', cx, ky + 8, 16, COL.quest);
    bar(g, cx, ky + 30, 200, 8, (p.repGuardianes + 100) / 200, '#4a8a5c', '#1a2a1c', COL.panelBorder);
    text(g, `${p.repGuardianes >= 0 ? '+' : ''}${p.repGuardianes} / +100`, cx + 210, ky + 26, 15, COL.dim);
    text(g, g.companion ? 'Compañera: Ilwen (Arquera Sylvar) — te cubre con su arco' : 'Compañeros: ninguno aún (Ilwen espera en el Bosque)', cx, ky + 56, 15, COL.dim);
  } else if (g.pauseTab === 2) {
    // DIARIO
    text(g, 'CADENA PRINCIPAL', cx, cy, 15, COL.gold);
    let y = cy + 26;
    for (let i = 0; i < QUESTS.length; i++) {
      const q = QUESTS[i];
      const done = i < g.questIdx;
      const active = i === g.questIdx;
      text(g, `${done ? '✔' : active ? '◆' : '·'} ${q.name}`, cx, y, 17, done ? '#6a8a6a' : active ? COL.quest : COL.dim);
      y += 22;
      if (active) {
        const stepText = g.questProgressText() ?? q.steps[g.questStep];
        for (const l of wrapText(stepText, 48)) { text(g, '   ' + l, cx, y, 15, COL.text); y += 18; }
        y += 4;
      }
    }
    text(g, `Ecos menores escuchados: ${g.takenEchoes.size}`, cx, py + ph - 46, 15, COL.dim);
    text(g, `Enemigos derrotados: ${p.kills} · Muertes: ${p.deaths}`, cx, py + ph - 26, 15, COL.dim);
  } else {
    // SISTEMA
    text(g, 'VOLUMEN DE MÚSICA', cx, cy, 16, COL.text);
    drawSlider(g, cx, cy + 26, 300, v => { audioSetMusic(g, v); }, g.musicVolUi);
    text(g, 'VOLUMEN DE EFECTOS', cx, cy + 76, 16, COL.text);
    drawSlider(g, cx, cy + 102, 300, v => { audioSetSfx(g, v); }, g.sfxVolUi);
    text(g, '«La música adaptativa añade una capa de combate cuando', cx, cy + 150, 15, COL.dim);
    text(g, 'los enemigos te ven, y cada región tiene su melodía.»', cx, cy + 168, 15, COL.dim);
    button(g, 'GUARDAR Y SALIR AL TÍTULO', cx, py + ph - 96, 280, 40, () => {
      g.save();
      g.setState('title');
    }, 11);
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

function audioClick() { audio.sfx('select'); }
function audioSetMusic(g: Game, v: number) { g.musicVolUi = v; audio.setMusicVol(v * 0.9); }
function audioSetSfx(g: Game, v: number) { g.sfxVolUi = v; audio.setSfxVol(v * 0.9); }

// ---------------- Diálogo ----------------

function drawDialogue(g: Game) {
  const ctx = g.ctx;
  const node = g.dlgNode;
  if (!node) return;
  const bw = VIEW_W - 80, bh = 150, bx = 40, by = VIEW_H - bh - 24;
  ctx.fillStyle = 'rgba(4,5,12,0.4)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, bx, by, bw, bh, '#6a5a38', 'rgba(10,12,22,0.96)');

  // retrato
  const pr = mapPortrait(node.portrait);
  const s2 = getSpr(pr)[0];
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx + 14, by + 14, 74, 74);
  ctx.clip();
  const scale = Math.max(74 / s2.width, 74 / s2.height) * 1.6;
  ctx.drawImage(s2, bx + 14 + (74 - s2.width * scale) / 2, by + 14 + (74 - s2.height * scale) / 2, s2.width * scale, s2.height * scale);
  ctx.restore();
  ctx.strokeStyle = '#6a5a38';
  ctx.strokeRect(bx + 14, by + 14, 74, 74);

  // nombre y texto
  text(g, node.name, bx + 104, by + 12, 17, COL.goldSoft);
  const shown = node.text.slice(0, Math.floor(g.dlgCharT));
  const lines = wrapText(shown, 76);
  lines.forEach((l, i) => text(g, l, bx + 104, by + 36 + i * 19, 17, COL.text));

  // opciones
  if (node.options && node.options.length > 0 && g.dlgCharT >= node.text.length) {
    let oy = by + bh - 26 - node.options.length * 26;
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

function mapPortrait(p: string): string {
  switch (p) {
    case 'brisa': return 'brisa';
    case 'toln': return 'toln';
    case 'ilwen': return 'ilwen';
    case 'fragment': return 'hero_tejedor';
    case 'guardian': return 'guardian';
    case 'sombra': return 'sombra';
    case 'sanctuary': return 'brisa';
    case 'wisp': return 'hero_tejedor';
    default: return 'brisa';
  }
}

// ---------------- Muerte ----------------

function drawDead(g: Game) {
  const ctx = g.ctx;
  ctx.fillStyle = 'rgba(20,4,8,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  textShadow(g, 'HAS CAÍDO', VIEW_W / 2, 170, 34, '#c8384a', '#000', 'center', true);
  const p = g.player!;
  const lost = Math.floor(p.gold / 2);
  const lines = [
    'La Niebla Muda susurra tu nombre...',
    lost > 0 ? `Dejas un eco con ${lost} coronas donde caíste. Vuelve por él.` : 'Tu oro queda contigo... esta vez.',
    '',
    'Pulsa E para despertar en el último Santuario',
  ];
  lines.forEach((l, i) => text(g, l, VIEW_W / 2, 250 + i * 30, 18, i === 3 ? COL.goldSoft : COL.dim, 'center'));
  if (Math.sin(g.globalT * 3) > -0.2) text(g, 'E ▸', VIEW_W / 2, 420, 18, COL.gold, 'center');
}

// ---------------- Final de la demo ----------------

function drawEnd(g: Game) {
  const ctx = g.ctx;
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
  textShadow(g, 'PRIMERA NOTA COMPLETA', VIEW_W / 2, 90, 18, COL.goldSoft, '#000', 'center', true);
  textShadow(g, 'GRACIAS POR JUGAR LA DEMO', VIEW_W / 2, 130, 26, COL.gold, '#2a1a08', 'center', true);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(VIEW_W / 2 - 160, 175, 320, 2);

  const p = g.player!;
  panel(g, VIEW_W / 2 - 250, 200, 500, 170, COL.panelBorder);
  let y = 216;
  for (const l of g.endStats.split('\n')) {
    text(g, l, VIEW_W / 2, y, 17, COL.text, 'center');
    y += 26;
  }
  text(g, '«Cuando el miedo te hable, canta más alto.»', VIEW_W / 2, 386, 19, COL.epochPast, 'center');
  text(g, '— Anciana Brisa', VIEW_W / 2, 408, 15, COL.dim, 'center');
  text(g, 'Los otros seis Ecos aguardan en Velmora...', VIEW_W / 2, 446, 16, COL.dim, 'center');
  button(g, 'VOLVER AL TÍTULO (ENTER)', VIEW_W / 2 - 140, VIEW_H - 60, 280, 40, () => g.setState('title'), 11);
}
