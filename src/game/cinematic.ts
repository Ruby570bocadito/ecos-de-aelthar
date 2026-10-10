// ============================================================
// ECOS DE AELTHAR — CINEMÁTICA DE INTRO (Ronda 15 «El Prólogo Viviente»)
// Sustituye las 3 diapositivas estáticas por un PRÓLOGO ANIMADO:
// pixel-art 100% procedural con personajes que INTERACTÚAN en la
// historia del comienzo, barra de cine (letterbox), grano de
// película, subtítulos y música por escena.
//
//   Escena 0 · LA ERA DEL CANTO      — Aelthar teje el mundo; los
//     hilos de luz nacen de su arpa y los 5 pueblos se encienden
//     uno a uno con cada nota.
//   Escena 1 · LA NOCHE DEL SILENCIO — tres figuras encapuchadas
//     de la Orden de Vesh trepan hasta el dios; el puñal cae; el
//     Canto SE ROMPE en 7 Ecos que salen despedidos; la Niebla
//     Muda devora las aldeas (las ventanas se apagan en orden
//     inverso al que se encendieron).
//   Escena 2 · LA ERA DE LAS CENIZAS — el Portador despierta en
//     el valle de Lunaris (tumbado → arrodillado → en pie), la
//     wisp Brisa desciende y orbita a su alrededor, y una calidez
//     antigua florece bajo el título del juego.
//
// SALTABLE por diseño (pedimento explícito):
//   · ESC → salta TODA la cinemática (arranca el juego al acto).
//   · E / ESPACIO / ENTER / clic → avanza a la siguiente escena.
//   · Botón «SALTAR ▸» clicable en la barra inferior.
//   · Auto-avance al terminar cada línea temporal de escena.
//
// Determinismo: cero Math.random — todo hash2() (mismo patrón que
// sky/weather). El dt se deriva de g.globalT (avanza en TODOS los
// estados, ver engine.loop) y se recorta a 50 ms para evitar saltos
// tras pestañas en segundo plano.
// ============================================================

import type { Game } from './engine'; // SOLO tipo: borrado en runtime (sin ciclo)
import { VIEW_W, VIEW_H } from './consts';
import { COL, text, textShadow, button } from './ui';
import { audio } from './audio';
import { hash2 } from './world/palette';
import { heroFrame, HERO_W, HERO_H } from './actors/hero'; // R18: el Portador v4 en el prólogo
import { getSpr } from './sprites';


// ---------------- líneas temporales ----------------
const SCENE_DUR = [12.5, 13.5, 11.5];
const BAR_H = 46;                       // altura de cada barra letterbox
const ECHO_COLORS = ['#7ee8ff', '#ffd24a', '#ff7830', '#8ef0a0', '#e88aff', '#a8d0ff', '#ff5a6a'];

// subtítulos (mismo texto que las antiguas INTRO_SLIDES — continuidad
// canónica con la biblia de historia, docs/history.md)
const CAPS = [
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

// ---------------- estado del módulo ----------------
let cineT = 0;      // segundos dentro de la escena actual
let lastT = -1;     // g.globalT del frame anterior (para dt)
let lastIdx = -1;   // escena anterior (detección de cambio de escena)
let stung = false;  // stinger de audio de la escena ya lanzado
let struck = false; // sonido del golpe del puñal (escena 1) ya lanzado

export function resetCinematic(): void {
  cineT = 0; lastT = -1; lastIdx = -1; stung = false; struck = false;
}

// ---------------- utilidades ----------------
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (v: number): number => 1 - (1 - clamp01(v)) * (1 - clamp01(v));
const easeInOut = (v: number): number => {
  const x = clamp01(v);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};
/** alpha 0→1 en [a,a+d], 1→0 en [b-d,b] (para subtítulos) */
function fadeWin(t: number, a: number, b: number, d: number): number {
  return clamp01((t - a) / d) * clamp01((b - t) / d);
}
function R(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
}
/** nota musical pixel (como la del título, escala s) */
function note(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string): void {
  R(ctx, x, y + s * 3, s * 2, s * 1.5, c);        // cabeza
  R(ctx, x + s * 1.5, y, s * 0.75, s * 3.6, c);   // palo
  R(ctx, x + s * 2, y, s * 1.25, s * 1.1, c);     // banderín
}

// ---------------- cielo ----------------
const _skies = new Map<string, CanvasGradient>();
function skyGrad(ctx: CanvasRenderingContext2D, id: string, top: string, bottom: string): CanvasGradient {
  let gr = _skies.get(id);
  if (!gr) {
    gr = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    _skies.set(id, gr);
  }
  return gr;
}
function drawStars(ctx: CanvasRenderingContext2D, t: number, mul: number): void {
  for (let i = 0; i < 80; i++) {
    const x = hash2(i, 7) * VIEW_W;
    const y = hash2(i * 3 + 1, 13) * VIEW_H * 0.62;
    const a = (0.25 + Math.abs(Math.sin(t * 1.6 + i * 1.7)) * 0.55) * mul;
    ctx.globalAlpha = a;
    const s = hash2(i, 29) > 0.85 ? 2 : 1;
    R(ctx, x, y, s, s, '#e8ecff');
  }
  ctx.globalAlpha = 1;
}

// ---------------- R18: cordilleras en parallax ----------------
// Dos capas de montañas (lejana azulada, cercana oscura) que derivan con la
// cámara; el perfil sale de senos con hash (determinista).
function drawRanges(ctx: CanvasRenderingContext2D, horizon: number, t: number, far: string, near: string): void {
  for (let layer = 0; layer < 2; layer++) {
    const amp = layer === 0 ? 96 : 52, base = horizon - (layer === 0 ? 10 : 2);
    const drift = t * (layer === 0 ? 2 : 5);
    ctx.fillStyle = layer === 0 ? far : near;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 4);
    for (let x = 0; x <= VIEW_W + 6; x += 6) {
      const u = (x + drift) * (layer === 0 ? 0.0105 : 0.017) + layer * 3.1;
      // crestas afiladas: 1 − |sen| da picos hacia arriba
      const h = 0.62 * (1 - Math.abs(Math.sin(u))) + 0.38 * (1 - Math.abs(Math.sin(u * 2.17 + 1.3))) * 0.8;
      ctx.lineTo(x, base - h * amp);
    }
    ctx.lineTo(VIEW_W, horizon + 4);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------------- EL DIOS-TEJEDOR (Aelthar) ----------------
// Figura radiante con arpa: túnica apilada, halo, brazos hacia el
// instrumento y aura pulsante. alpha + diss controlan la disolución
// de la escena 1 (diss>0: speckles de hash "se comen" el cuerpo).
function drawWeaver(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, alpha: number, diss: number): void {
  if (alpha <= 0) return;
  const breathe = Math.sin(t * 1.4) * 1.5;
  ctx.save();
  ctx.globalAlpha = alpha;
  // aura (radial, pulsa con el canto)
  const aur = ctx.createRadialGradient(cx, cy, 6, cx, cy, 78 + Math.sin(t * 2) * 8);
  aur.addColorStop(0, 'rgba(255,232,150,0.34)');
  aur.addColorStop(0.55, 'rgba(255,210,110,0.12)');
  aur.addColorStop(1, 'rgba(255,210,110,0)');
  ctx.fillStyle = aur;
  ctx.fillRect(cx - 96, cy - 110, 192, 200);
  // halo doble sobre la cabeza
  const hy = cy - 40 + breathe;
  ctx.strokeStyle = 'rgba(255,232,150,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, hy - 6, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = alpha * 0.35;
  ctx.beginPath(); ctx.arc(cx, hy - 6, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = alpha;
  // túnica (5 tramos apilados, se estrechan arriba; luz arriba-izquierda)
  const robe = ['#efe3b0', '#e3d296', '#d2bd7e', '#b8a468', '#9a8754'];
  const rw = [10, 14, 18, 22, 26];
  for (let i = 0; i < 5; i++) {
    const w = rw[i], y = cy - 34 + i * 7 + breathe * (1 - i * 0.15);
    if (diss > 0 && hash2(i * 31 + 7, Math.floor(t * 9)) < diss) continue; // speckle que se disuelve
    R(ctx, cx - w / 2, y, w, 7.5, robe[i]);
    R(ctx, cx - w / 2, y, 2, 7.5, 'rgba(255,246,200,0.5)');   // brillo lateral
    R(ctx, cx + w / 2 - 2, y, 2, 7.5, 'rgba(90,74,40,0.5)');  // sombra lateral
  }
  // cinturón de notas
  R(ctx, cx - 8, cy - 6 + breathe, 16, 2, '#c8a84a');
  // cabeza + rostro sereno
  if (!(diss > 0 && hash2(91, Math.floor(t * 9)) < diss)) {
    R(ctx, cx - 3, hy - 4, 7, 7, '#f2dcae');
    R(ctx, cx - 3, hy - 5, 7, 2, '#6a5a3c');   // melena
    R(ctx, cx + 1, hy - 1, 2, 1, '#3a3020');   // ojo (perfil sereno)
  }
  // brazos hacia el arpa (izquierda abajo)
  const ax = cx - 10, ay = cy - 16 + breathe;
  R(ctx, ax, ay, 3, 6, '#e8d8a8'); R(ctx, ax - 2, ay + 5, 3, 3, '#f2dcae');
  // arpa dorada: marco triangular + 4 cuerdas que vibran
  const hx = ax - 9, hyy = ay - 6;
  ctx.strokeStyle = '#e8c060'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hx, hyy + 14); ctx.lineTo(hx, hyy); ctx.lineTo(hx + 9, hyy + 14); ctx.closePath(); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const vib = Math.sin(t * 9 + i * 2.1) * (0.6 + 0.5 * Math.sin(t * 1.1 + i));
    ctx.strokeStyle = 'rgba(255,236,170,0.85)';
    ctx.beginPath();
    ctx.moveTo(hx + 1.5 + i * 2, hyy + 2);
    ctx.lineTo(hx + 1.5 + i * 2 + vib * 0.5, hyy + 12);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------- aldeas del valle (horizonte) ----------------
// 5 clusters; lightK 0..1 por cluster (0 = ventanas apagadas).
const VILL_X = [0.11, 0.3, 0.5, 0.7, 0.89];
function drawValley(ctx: CanvasRenderingContext2D, horizon: number, lights: number[], t: number, dark: number): void {
  // colina base
  R(ctx, 0, horizon, VIEW_W, VIEW_H - horizon, '#20263a');
  R(ctx, 0, horizon, VIEW_W, 2, '#2c3450');
  for (let v = 0; v < VILL_X.length; v++) {
    const vx = VILL_X[v] * VIEW_W;
    const lit = lights[v] ?? 0;
    for (let h = 0; h < 4; h++) {
      const hx = vx + (h - 1.5) * 16 + (hash2(v * 7 + h, 3) - 0.5) * 8;
      const hy = horizon + 10 + hash2(v * 5 + h, 11) * 14;
      // casa: muro + tejado de 2 aguas
      R(ctx, hx - 4, hy, 8, 5, dark > 0.5 ? '#151a28' : '#2c2c40');
      R(ctx, hx - 5, hy - 2, 10, 2, dark > 0.5 ? '#10141f' : '#4a4660');
      R(ctx, hx - 4, hy - 3, 8, 1, dark > 0.5 ? '#10141f' : '#4a4660');
      if (lit > 0) {
        // ventanas cálidas + halo (parpadeo de hogar por hash)
        const fl = 0.75 + Math.abs(Math.sin(t * 3 + v * 2 + h)) * 0.25;
        ctx.globalAlpha = lit * fl;
        R(ctx, hx - 2, hy + 1, 2, 2, '#ffd97a');
        R(ctx, hx + 1, hy + 1, 2, 2, '#ffc860');
        ctx.globalAlpha = lit * 0.16 * fl;
        const gr = ctx.createRadialGradient(hx, hy + 2, 2, hx, hy + 2, 22);
        gr.addColorStop(0, 'rgba(255,210,120,0.9)'); gr.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = gr; ctx.fillRect(hx - 22, hy - 20, 44, 44);
        ctx.globalAlpha = 1;
      }
    }
  }
}

// ============================================================
// ESCENA 0 · LA ERA DEL CANTO — el dios teje; hilos de luz; los
// 5 pueblos se encienden con cada nota.
// ============================================================
function drawScene0(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.fillStyle = skyGrad(ctx, 'c0', '#0a0c1e', '#1a2140');
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawStars(ctx, t, 1);
  // el dios desciende suavemente en el primer segundo (aparece en calma)
  const inK = easeOut(t / 1.4);
  const drift = Math.sin(t * 0.5) * 3;
  drawWeaver(ctx, VIEW_W / 2, VIEW_H * 0.34 + (1 - inK) * -26 + drift, t, inK, 0);
  // hilos de luz que nacen del corazón del dios y alcanzan el mundo
  const threadK = easeInOut((t - 1) / 5.5);
  const cx = VIEW_W / 2, cy = VIEW_H * 0.34 + drift + 6;
  for (let i = 0; i < 14; i++) {
    const ang = -Math.PI * 0.92 + (i / 13) * Math.PI * 1.84;
    const len = (150 + hash2(i, 5) * 240) * threadK;
    const ex = cx + Math.cos(ang) * len, ey = cy + Math.sin(ang) * len * 0.72;
    ctx.strokeStyle = 'rgba(255,224,130,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    // la nota viaja por el hilo (cabeza+ palo 1px)
    if (threadK > 0.35) {
      const prog = ((t * 0.22 + hash2(i, 17)) % 1);
      const nx = cx + Math.cos(ang) * len * prog;
      const ny = cy + Math.sin(ang) * len * 0.72 * prog;
      ctx.globalAlpha = 0.85;
      note(ctx, nx, ny, 1.4, '#ffe9a0');
      ctx.globalAlpha = 1;
    }
  }
  // los 5 pueblos se encienden uno a uno (cada nota llega a su casa)
  const horizon = VIEW_H * 0.78;
  drawRanges(ctx, horizon, t, '#262e52', '#1c2240');
  const lights = VILL_X.map((_, v) => easeOut((t - (4.2 + v * 1.35)) / 0.9));
  drawValley(ctx, horizon, lights, t, 0);
  // polvo dorado de memoria (como la vieja intro, más denso)
  for (let i = 0; i < 30; i++) {
    const x = hash2(i, 11) * VIEW_W;
    const y = (hash2(i, 13) * VIEW_H + t * (5 + hash2(i, 5) * 6)) % VIEW_H;
    ctx.globalAlpha = 0.10 + Math.abs(Math.sin(t + i)) * 0.18;
    R(ctx, x, y, 2, 2, '#ffe9a0');
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// ESCENA 1 · LA NOCHE DEL SILENCIO — los asesinos trepan, el
// puñal cae, el Canto se rompe en 7 Ecos y la niebla devora
// las aldeas (las ventanas se apagan en orden inverso).
// ============================================================
const SHARD_ANG = [-1.28, -0.86, -0.44, -0.02, 0.4, 0.82, 1.24]; // abanico de los 7 Ecos
function drawScene1(ctx: CanvasRenderingContext2D, t: number): void {
  // cielo que se abre en sangre-dusca conforme llega la Orden
  const dusk = clamp01(t / 6);
  ctx.fillStyle = skyGrad(ctx, `c1a${Math.round(dusk * 8)}`,
    dusk > 0.5 ? '#0d0812' : '#0a0c1e',
    dusk > 0.5 ? '#2a1220' : '#1a2140');
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawStars(ctx, t, 1 - clamp01(t / 5.5)); // las estrellas huyen
  const drift = Math.sin(t * 0.5) * 3;
  const cx = VIEW_W / 2, cy = VIEW_H * 0.34 + drift;
  // el dios flaquea: aura intermitente y disolución al final
  const flick = t > 5.6 ? clamp01(1 - (t - 5.6) / 2.6) : 1;
  drawWeaver(ctx, cx, cy + 6, t, flick, t > 6.2 ? clamp01((t - 6.2) / 4.5) * 0.55 : 0);
  // TRES FIGURAS DE VESH trepan desde abajo (rutas curvadas, escalonadas)
  for (let k = 0; k < 3; k++) {
    const kt = clamp01((t - 1.2 - k * 0.7) / 4.2);
    if (kt <= 0) continue;
    const ek = easeInOut(kt);
    const gx = cx + (k - 1) * 74 + Math.sin(ek * Math.PI) * (k === 1 ? -26 : 30);
    const gy = VIEW_H * 0.88 - ek * (VIEW_H * 0.42);
    const sway = Math.sin(t * 7 + k * 2.4) * 1.4; // trepada
    ctx.save();
    ctx.globalAlpha = 0.96;
    // R18: los asesinos de la Orden son figuras de verdad (sprite «sombra»
    // ×3, de espaldas, trepando con el ciclo de andar) con borde de luna
    const spr = getSpr('sombra');
    const fr = spr[Math.min(spr.length - 1, 9 + (Math.floor(t * 7 + k * 2) % 6))] ?? spr[0]; // bloque de espaldas (andar)
    const sc = k === 1 ? 1.75 : 1.55; // R19: sprite v2 (32×38) · el del centro, el de la Lanza, algo mayor
    const fw = fr.width * sc, fh = fr.height * sc;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fr, gx - fw / 2 + sway, gy - fh, fw, fh);
    // borde de luz de luna (tinte frío sobre el contorno izquierdo)
    ctx.globalAlpha = 0.18;
    R(ctx, gx - fw / 2 + sway, gy - fh * 0.85, 3, fh * 0.7, '#8aa0d8');
    // puñal con destello
    const gl = 0.5 + Math.abs(Math.sin(t * 5 + k)) * 0.5;
    ctx.globalAlpha = 1;
    R(ctx, gx + fw / 2 - 4 + sway, gy - fh * 0.62, 2, 10, '#cfd8e8');
    ctx.globalAlpha = gl * 0.9;
    R(ctx, gx + fw / 2 - 4 + sway, gy - fh * 0.62 - 2, 2, 2, '#ffffff');
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // EL GOLPE (t≈5.6): flash + onda expansiva
  if (t >= 5.6) {
    const fk = (t - 5.6) / 0.38;
    if (fk < 1) {
      ctx.globalAlpha = (1 - fk) * 0.92;
      R(ctx, 0, 0, VIEW_W, VIEW_H, '#f4f0ff');
      ctx.globalAlpha = 1;
    }
    const rk = (t - 5.6) / 0.9;
    if (rk < 1) {
      ctx.strokeStyle = `rgba(255,240,210,${(1 - rk) * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy + 6, 12 + easeOut(rk) * 130, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // EL CANTO SE ROMPE (t≈5.8): 7 Ecos salen despedidos en abanico
  if (t >= 5.8) {
    const sk = clamp01((t - 5.8) / 5.2);
    for (let i = 0; i < 7; i++) {
      const sp = (170 + hash2(i, 23) * 130) * easeOut(sk);
      const wob = Math.sin(t * 2 + i * 1.8) * 10 * sk;
      const sx = cx + Math.cos(SHARD_ANG[i]) * sp;
      const sy = cy + 6 + Math.sin(SHARD_ANG[i]) * sp * 0.8 + wob * 0.4;
      // estela (3 posiciones previas, alpha decreciente)
      for (let tr = 1; tr <= 3; tr++) {
        const tp = Math.max(0, sk - tr * 0.045);
        const tx2 = cx + Math.cos(SHARD_ANG[i]) * (170 + hash2(i, 23) * 130) * easeOut(tp);
        const ty2 = cy + 6 + Math.sin(SHARD_ANG[i]) * (170 + hash2(i, 23) * 130) * easeOut(tp) * 0.8;
        ctx.globalAlpha = (1 - sk * 0.3) * (0.34 - tr * 0.09);
        R(ctx, tx2 - 1, ty2 - 1, 3, 3, ECHO_COLORS[i]);
      }
      // fragmento: rombo 2 capas + halo
      ctx.globalAlpha = 1;
      R(ctx, sx - 2, sy - 2, 5, 5, ECHO_COLORS[i]);
      R(ctx, sx - 1, sy - 3, 3, 7, ECHO_COLORS[i]);
      R(ctx, sx - 3, sy - 1, 7, 3, ECHO_COLORS[i]);
      ctx.globalAlpha = 0.5;
      R(ctx, sx - 1, sy - 1, 3, 3, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }
  // LA NIEBLA MUDA sube y apaga las aldeas (orden inverso al encendido)
  const horizon = VIEW_H * 0.78;
  const lights = VILL_X.map((_, v) => {
    const wasLit = 1;
    return wasLit * clamp01(1 - (t - (7.2 + (VILL_X.length - 1 - v) * 0.9)) / 0.8);
  });
  drawRanges(ctx, horizon, t, '#2a1a2c', '#1e1422');
  drawValley(ctx, horizon, lights, t, t > 7 ? 1 : 0);
  for (let f = 0; f < 3; f++) {
    const fa = clamp01((t - 6.6 - f * 0.5) / 1.2) * (0.10 + f * 0.05);
    if (fa <= 0) continue;
    const fy = VIEW_H - 40 - f * 26 + Math.sin(t * 0.7 + f * 2) * 6;
    ctx.globalAlpha = fa;
    ctx.fillStyle = '#c8d8da';
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 24) {
      ctx.lineTo(x, fy + Math.sin(x * 0.014 + t * (0.5 + f * 0.22) + f * 3) * 9);
    }
    ctx.lineTo(VIEW_W, VIEW_H); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// ESCENA 2 · LA ERA DE LAS CENIZAS — el Portador despierta en
// Lunaris (tumbado → arrodillado → en pie), Brisa desciende y
// orbita, la calidez vuelve y el título del juego florece.
// ============================================================
function drawScene2(ctx: CanvasRenderingContext2D, t: number, g: Game): void {
  // amanecer ceniciento (el filtro de época lo agradece)
  ctx.fillStyle = skyGrad(ctx, 'c2', '#141826', '#3a4052');
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawStars(ctx, t, 0.25);
  const horizon = VIEW_H * 0.62;
  drawRanges(ctx, horizon - 6, t, '#2e3550', '#262c40');
  // ruinas lejanas en silueta (la aldea que fue)
  R(ctx, 0, horizon - 8, VIEW_W, 8, '#252b3d');
  for (let i = 0; i < 7; i++) {
    const rx = hash2(i, 41) * VIEW_W;
    const rw2 = 10 + hash2(i, 43) * 22;
    const rh2 = 6 + hash2(i, 47) * 16;
    R(ctx, rx, horizon - 8 - rh2, rw2, rh2, '#20253a');
    if (hash2(i, 53) > 0.5) R(ctx, rx + rw2 * 0.3, horizon - 8 - rh2 - 4, 2, 4, '#20253a'); // muro roto
  }
  // suelo del valle (hierba gris-verde con speckles deterministas)
  R(ctx, 0, horizon, VIEW_W, VIEW_H - horizon, '#39463c');
  R(ctx, 0, horizon, VIEW_W, 2, '#465446');
  for (let i = 0; i < 90; i++) {
    const gx2 = hash2(i, 61) * VIEW_W;
    const gy2 = horizon + 4 + hash2(i, 67) * (VIEW_H - horizon - 8);
    ctx.globalAlpha = 0.3;
    R(ctx, gx2, gy2, 2, 1, hash2(i, 71) > 0.5 ? '#4a5a4c' : '#2e3a32');
    ctx.globalAlpha = 1;
  }
  // árboles muertos (ramas desnudas en silueta)
  for (const fx of [0.14, 0.84]) {
    const bx = fx * VIEW_W, by = horizon + 26;
    R(ctx, bx - 2, by - 40, 4, 40, '#242430');
    R(ctx, bx - 8, by - 30, 6, 2, '#242430'); R(ctx, bx + 3, by - 34, 7, 2, '#242430');
    R(ctx, bx - 6, by - 24, 5, 2, '#242430'); R(ctx, bx + 2, by - 20, 5, 2, '#242430');
  }
  // EL PORTADOR (R18: modelo v4 ×3): tumbado → de rodillas → en pie y, al
  // final, se gira hacia el horizonte donde estaba su aldea
  const px = VIEW_W / 2 - 46, py = horizon + 40;
  const disc = g.player?.discipline ?? 'alba';
  const look = { disc, armor: 0, weapon: 0 };
  const SC = 3;
  const hw = HERO_W * SC, hh = HERO_H * SC;
  ctx.imageSmoothingEnabled = false;
  // sombra en la hierba
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(px, py, 34, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  if (t < 2.6) {
    // tumbado: el cuerpo girado sobre la hierba, respira despacio
    const cv = heroFrame(look, 'side', 'idle', 2).cv;
    ctx.save();
    ctx.translate(px, py - 6 + Math.sin(t * 1.6) * 1);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(cv, -hh + 18, -hw / 2, hw, hh);
    ctx.restore();
  } else if (t < 4.6) {
    // de rodillas, incorporándose (el cuerpo sube con el ease)
    const k = easeInOut((t - 2.6) / 2);
    const cv = heroFrame(look, 'down', k < 0.5 ? 'hurt' : 'idle', 0).cv;
    const sink = (1 - k) * 34;
    ctx.save();
    ctx.beginPath(); ctx.rect(px - hw, py - hh - 10, hw * 2, hh + 10 - 2); ctx.clip();
    ctx.drawImage(cv, px - hw / 2, py - hh + sink, hw, hh);
    ctx.restore();
  } else {
    // en pie: respira; al final mira hacia el horizonte (de espaldas)
    const turn = t > 9.2;
    const cv = heroFrame(look, turn ? 'up' : 'down', 'idle', Math.floor(t / 1.1) % 2).cv;
    ctx.drawImage(cv, px - hw / 2, py - hh, hw, hh);
  }
  // BRISA (wisp): desciende y orbita al Portador
  if (t > 5) {
    const dk = easeOut((t - 5) / 1.6);
    const oy = -110 * (1 - dk);
    const orb = t > 6.6;
    const ang = t * 1.5;
    const wx = orb ? px + 4 + Math.cos(ang) * 24 : px + 16;
    const wy = (orb ? py - 14 + Math.sin(ang) * 9 : py - 30) + oy;
    const gr = ctx.createRadialGradient(wx, wy, 1, wx, wy, 16);
    gr.addColorStop(0, 'rgba(140,236,255,0.8)'); gr.addColorStop(1, 'rgba(140,236,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(wx - 16, wy - 16, 32, 32);
    R(ctx, wx - 2, wy - 2, 5, 5, '#bff2ff');
    R(ctx, wx - 1, wy - 1, 3, 3, '#ffffff');
    // cola de cometa (posiciones previas del ángulo)
    if (orb) for (let tr = 1; tr <= 4; tr++) {
      const ta = ang - tr * 0.28;
      ctx.globalAlpha = 0.5 - tr * 0.1;
      R(ctx, px + 4 + Math.cos(ta) * 24 - 1, py - 14 + Math.sin(ta) * 9 - 1, 3, 3, '#8cecff');
      ctx.globalAlpha = 1;
    }
  }
  // calidez antigua que florece bajo el Portador
  const wk = clamp01((t - 6.2) / 2.4);
  if (wk > 0) {
    const gr2 = ctx.createRadialGradient(px + 2, py - 10, 6, px + 2, py - 10, 130 * wk);
    gr2.addColorStop(0, `rgba(255,224,150,${0.20 * wk})`);
    gr2.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = gr2;
    ctx.fillRect(px - 140, py - 150, 290, 290);
  }
  // niebla baja en deriva (2 bandas lentas)
  for (let f = 0; f < 2; f++) {
    ctx.globalAlpha = 0.10 + f * 0.05;
    ctx.fillStyle = '#c8d8da';
    const fy = VIEW_H * 0.7 + f * 30;
    ctx.beginPath(); ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 26) {
      ctx.lineTo(x, fy + Math.sin(x * 0.011 + t * (0.35 + f * 0.2) + f * 4) * 8);
    }
    ctx.lineTo(VIEW_W, VIEW_H); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // TÍTULO del juego: florece al final de la cinemática
  const tk = clamp01((t - 7.4) / 1.6);
  if (tk > 0) {
    ctx.globalAlpha = tk;
    textShadow(g, 'ECOS DE AELTHAR', VIEW_W / 2, BAR_H + 44, 30, COL.gold, '#000', 'center', true);
    const dw = 170 * tk;
    R(ctx, VIEW_W / 2 - dw / 2, BAR_H + 66, dw, 1, 'rgba(240,200,74,0.7)');
    R(ctx, VIEW_W / 2 - 2, BAR_H + 64, 4, 4, COL.goldSoft);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// VESTUARIO CINEMATOGRÁFICO — letterbox, grano, viñeta, rótulos
// ============================================================
let _vig: CanvasGradient | null = null; let _vigView = '';
function vignette(ctx: CanvasRenderingContext2D): void {
  const v = VIEW_W + 'x' + VIEW_H;
  if (v !== _vigView || !_vig) {
    _vig = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    _vig.addColorStop(0, 'rgba(0,0,0,0)');
    _vig.addColorStop(1, 'rgba(0,0,0,0.42)');
    _vigView = v;
  }
  ctx.fillStyle = _vig;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
function grain(ctx: CanvasRenderingContext2D, t: number): void {
  const step = Math.floor(t * 14);
  for (let i = 0; i < 110; i++) {
    const x = hash2(i * 13 + 5, step) * VIEW_W;
    const y = hash2(i * 7 + 3, step * 2 + 11) * VIEW_H;
    ctx.globalAlpha = 0.04 + hash2(i, step) * 0.07;
    R(ctx, x, y, hash2(i, 3) > 0.8 ? 2 : 1, 1, i % 3 === 0 ? '#ffffff' : '#c8ccd8');
  }
  ctx.globalAlpha = 1;
}
function caption(ctx: CanvasRenderingContext2D, g: Game, idx: number, t: number, dur: number): void {
  const a = fadeWin(t, 0.7, dur - 0.5, 0.9);
  if (a <= 0) return;
  // banda de legibilidad bajo el rótulo (gradiente, no caja dura)
  const gr = ctx.createLinearGradient(0, VIEW_H - BAR_H - 108, 0, VIEW_H - BAR_H);
  gr.addColorStop(0, 'rgba(4,6,12,0)');
  gr.addColorStop(1, `rgba(4,6,12,${0.62 * a})`);
  ctx.fillStyle = gr;
  ctx.fillRect(0, VIEW_H - BAR_H - 108, VIEW_W, 108);
  ctx.globalAlpha = a;
  const cap = CAPS[idx];
  textShadow(g, cap.title, VIEW_W / 2, VIEW_H - BAR_H - 78, 16, COL.goldSoft, '#000', 'center', true);
  R(ctx, VIEW_W / 2 - 44, VIEW_H - BAR_H - 58, 88, 1, 'rgba(240,200,74,0.55)');
  // R18: el subtítulo se escribe solo (≈38 caracteres/s)
  const shown = cap.lines.slice(0, Math.max(0, Math.floor((t - 0.7) * 38)));
  const lines = shown.match(/.{1,86}(\s|$)/g) ?? [shown];
  lines.forEach((l, i) => text(g, l.trim(), VIEW_W / 2, VIEW_H - BAR_H - 46 + i * 20, 14, COL.text, 'center'));
  ctx.globalAlpha = 1;
}
function chrome(ctx: CanvasRenderingContext2D, g: Game, t: number, idx: number): void {
  // barras letterbox (entran suaves solo en la 1.ª escena)
  const barK = idx === 0 ? easeOut(t / 0.7) : 1;
  const bh = Math.round(BAR_H * barK);
  R(ctx, 0, 0, VIEW_W, bh, '#05060c');
  R(ctx, 0, VIEW_H - bh, VIEW_W, bh, '#05060c');
  if (barK > 0.95) {
    // filete dorado de 1px en el borde interno de cada barra
    R(ctx, 0, bh, VIEW_W, 1, 'rgba(240,200,74,0.28)');
    R(ctx, 0, VIEW_H - bh - 1, VIEW_W, 1, 'rgba(240,200,74,0.28)');
    // puntos de progreso (3 escenas) en la barra inferior
    for (let i = 0; i < 3; i++) {
      const on = i < idx, cur = i === idx;
      ctx.globalAlpha = cur ? 0.65 + Math.sin(t * 4) * 0.3 : on ? 0.9 : 0.25;
      R(ctx, VIEW_W / 2 - 18 + i * 14, VIEW_H - bh / 2 - 1, 8, 3, on || cur ? COL.gold : '#3a3f52');
      ctx.globalAlpha = 1;
    }
    // ayuda de teclado (izquierda) + botón SALTAR (derecha)
    text(g, 'E · avanzar    ESC · saltar todo', 18, VIEW_H - bh / 2 - 8, 11, '#8a90a8');
    button(g, 'SALTAR ▸', VIEW_W - 102, VIEW_H - bh + 9, 90, 28, () => {
      g.introIdx = 99;
      g.startPlay();
      audio.sfx('blip');
    }, 11);
  }
}

// ============================================================
// API PRINCIPAL — drawCinematic(g): dt desde globalT, cambio de
// escena, stingers de audio, auto-avance y composición final.
// ============================================================
export function drawCinematic(g: Game): void {
  const ctx = g.ctx;
  const now = g.globalT;
  if (lastT < 0) lastT = now;
  const dt = Math.min(0.05, Math.max(0, now - lastT));
  lastT = now;
  const idx = Math.min(g.introIdx, 2);
  if (g.introIdx !== lastIdx) { cineT = 0; stung = false; struck = false; lastIdx = g.introIdx; }
  cineT += dt;

  // stinger de entrada por escena (música sigue en 'title')
  if (!stung) {
    stung = true;
    audio.sfx(idx === 0 ? 'song' : idx === 1 ? 'shadow' : 'echo');
  }
  // golpe del puñal (escena 1, t≈5.62 — casado con el flash)
  if (idx === 1 && !struck && cineT >= 5.62) { struck = true; audio.sfx('break'); }

  // escena — R18: zoom lento de cámara (Ken Burns) y fundido de entrada
  const zk = 1 + 0.045 * Math.min(1, cineT / SCENE_DUR[idx]);
  ctx.save();
  ctx.translate(VIEW_W / 2, VIEW_H * 0.45);
  ctx.scale(zk, zk);
  ctx.translate(-VIEW_W / 2, -VIEW_H * 0.45);
  if (idx === 0) drawScene0(ctx, cineT);
  else if (idx === 1) drawScene1(ctx, cineT);
  else drawScene2(ctx, cineT, g);
  ctx.restore();
  const fin = 1 - clamp01(cineT / 0.7);
  const fout = clamp01((cineT - (SCENE_DUR[idx] - 0.5)) / 0.5);
  const dip = Math.max(fin, fout);
  if (dip > 0) { ctx.globalAlpha = dip; R(ctx, 0, 0, VIEW_W, VIEW_H, '#05060c'); ctx.globalAlpha = 1; }

  // vestuario + rótulos + controles
  vignette(ctx);
  grain(ctx, now);
  caption(ctx, g, idx, cineT, SCENE_DUR[idx]);
  chrome(ctx, g, cineT, idx);

  // auto-avance al agotarse la línea temporal de la escena
  if (g.introIdx < 3 && cineT >= SCENE_DUR[idx]) g.advanceIntro();
}
