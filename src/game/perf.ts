// ============================================================
// ECOS DE AELTHAR — Supervisión de rendimiento (R5-O1)
// fps meter + calidad adaptativa + overlay de depuración
// ============================================================
// Reglas de diseño de este módulo:
// · NO importa NADA en tiempo de ejecución de engine.ts (evita ciclos):
//   el tipo Game entra por `import type` (se borra al compilar) y todo lo
//   demás llega por parámetro.
// · Coste por frame con el overlay APAGADO: acumular ~3 números y una
//   comparación. Cero alocaciones en estado estacionario (buffer fijo).
// · La calidad (0=alta, 1=media, 2=baja) es SOLO un escalón consultable vía
//   perfQuality(): los sistemas futuros (partículas/clima) podrán leerlo;
//   este módulo no fuerza nada del motor por su cuenta.

// ÚNICO acoplamiento con engine.ts: el tipo, borrado en runtime (sin ciclo).
import type { Game } from './engine';

// ---------------- Ventana móvil de muestreo ----------------
const WIN = 60;                        // últimos 60 frames
const buf = new Float64Array(WIN);     // ms REALES por frame (ring buffer fijo)
let bufIdx = 0;
let bufFill = 0;                       // muestras válidas acumuladas (≤ WIN)
let lastNow = -1;                      // performance.now() del perfFrame anterior
let avgMs = 1000 / 60;                 // media móvil actual (ms/frame)
let worstMs = 1000 / 60;               // peor frame de la ventana (ms)

// ---------------- Escalón de calidad + histéresis ----------------
export type PerfQuality = 'alta' | 'media' | 'baja';
const Q_NAMES: readonly PerfQuality[] = ['alta', 'media', 'baja'];

let quality = 0;        // 0=alta · 1=media · 2=baja
let lowT = 0;           // segundos sostenidos por DEBAJO del umbral bajo
let highT = 0;          // segundos sostenidos por ENCIMA del umbral alto
const LOW_FPS = 45;     // media < 45 fps sostenida 3 s → baja un escalón
const HIGH_FPS = 58;    // media > 58 fps sostenida 6 s → sube un escalón
const DOWN_S = 3;       // histéresis: bajar es rápido (protege la jugabilidad)
const UP_S = 6;         // ...y subir es lento (evita oscilar alrededor de 45-58)
const READY_FRAMES = 30; // no juzgar la calidad hasta tener media ventana llena
const RESYNC_MS = 1000;  // hueco mayor = pestaña oculta/alt-tab (no es carga real)

// ---------------- Estado del overlay ----------------
const LS_KEY = 'aelthar_perf';
let overlayOn = false;
let recheckFrames = 0;  // re-chequeo perezoso del flag de localStorage

/** Lee localStorage de forma blindada (SSR / storage bloqueado → false). */
function readFlag(): boolean {
  if (typeof window === 'undefined') return false; // SSR: no-op seguro
  try { return window.localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
}

/**
 * Inicializa el módulo (1× al crear la Game). No-op seguro en SSR:
 * solo lee localStorage['aelthar_perf'] para respetar un valor puesto
 * antes de montar (o desde consola entre sesiones).
 */
export function initPerf(_g: Game): void {
  if (typeof window === 'undefined') return; // SSR: nada que hacer
  overlayOn = readFlag();
  lastNow = -1; // por si la Game se recrea (remontaje): ventana y reloj frescos
  bufFill = 0; bufIdx = 0; buf.fill(0);
  lowT = 0; highT = 0;
}

/**
 * Muestreo 1×/frame, DESPUÉS de update+draw. Mide el TIEMPO REAL entre
 * llamadas (performance.now): el dt del motor viene clampeado a 1/20 y
 * escalado por hitStop/slowmo, así que NO refleja el coste real del frame.
 * El parámetro dt solo sirve como fallback del primer frame. Acumula la
 * ventana móvil (60 frames) y ajusta el escalón de calidad con histéresis.
 */
export function perfFrame(g: Game, dt: number): void {
  void g; // la firma reserva el sitio; hoy no necesitamos estado del motor
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  let ms = lastNow >= 0 ? now - lastNow : Math.max(0, dt * 1000);
  lastNow = now;
  if (!(ms > 0) || !isFinite(ms)) ms = 1000 / 60; // guard ante relojes raros
  if (ms > RESYNC_MS) {
    // Hueco enorme (pestaña oculta/vuelta de alt-tab): no es carga del juego,
    // reiniciamos la ventana para no envenenar la media ni el "peor".
    bufFill = 0; bufIdx = 0; lowT = 0; highT = 0;
    ms = 1000 / 60;
  }
  buf[bufIdx] = ms;
  bufIdx = (bufIdx + 1) % WIN;
  if (bufFill < WIN) bufFill++;

  // Media y peor SOLO sobre muestras válidas (coste: 60 sumas, sin alocar)
  let sum = 0, worst = 0;
  for (let i = 0; i < bufFill; i++) { const m = buf[i]; sum += m; if (m > worst) worst = m; }
  avgMs = bufFill > 0 ? sum / bufFill : 1000 / 60;
  worstMs = worst;

  // Calidad adaptativa con histéresis asimétrica (banda muerta 45-58 fps:
  // dentro de ella ningún temporizador avanza → no oscila). Tras cada cambio
  // se resetean ambos temporizadores: hay que volver a sostener el umbral.
  if (bufFill >= READY_FRAMES) {
    const fps = 1000 / avgMs;
    if (fps < LOW_FPS) { lowT += ms / 1000; highT = 0; }
    else if (fps > HIGH_FPS) { highT += ms / 1000; lowT = 0; }
    else { lowT = 0; highT = 0; }
    if (lowT >= DOWN_S && quality < 2) { quality++; lowT = 0; highT = 0; }
    else if (highT >= UP_S && quality > 0) { quality--; lowT = 0; highT = 0; }
  }

  // Re-chequeo perezoso del flag (cada ~30 frames): permite activar el overlay
  // escribiendo localStorage['aelthar_perf']='1' en consola sin tocar F3.
  if (++recheckFrames >= 30) { recheckFrames = 0; overlayOn = readFlag(); }
}

/** Escalón actual de calidad: 0=alta, 1=media, 2=baja (lectura O(1)). */
export function perfQuality(): 0 | 1 | 2 {
  return quality as 0 | 1 | 2;
}

/** Estadísticas para HUD/consumo externo (valores ya redondeados). */
export function getPerfStats(): { fps: number; worstMs: number; quality: PerfQuality } {
  return {
    fps: Math.round(1000 / avgMs),
    worstMs: Math.round(worstMs * 10) / 10,
    quality: Q_NAMES[quality],
  };
}

/**
 * Alterna el overlay (ligado a F3 desde engine.ts). Persiste el estado en
 * localStorage para sobrevivir recargas. Devuelve el nuevo estado.
 */
export function togglePerfOverlay(): boolean {
  overlayOn = !overlayOn;
  try {
    if (overlayOn) window.localStorage.setItem(LS_KEY, '1');
    else window.localStorage.removeItem(LS_KEY);
  } catch { /* storage bloqueado: el toggle queda solo en memoria */ }
  return overlayOn;
}

/**
 * Panel de depuración 120×34 arriba-izquierda: fps medio, peor frame (ms) y
 * calidad. SOLO pinta si el overlay está activo (coste cero si no). Usa
 * save/restore para no ensuciar el estado del ctx del bucle principal.
 */
export function drawPerfOverlay(g: Game): void {
  if (!overlayOn) return; // apagado → ni un draw call
  const ctx = g.ctx;
  ctx.save();
  // panel
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, 120, 34);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#3a4650';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 119, 33);
  // textos
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const fps = Math.round(1000 / avgMs);
  const fpsColor = fps >= 50 ? '#7dff8a' : fps >= 30 ? '#ffd45e' : '#ff6b5e';
  ctx.fillStyle = fpsColor;
  ctx.fillText(`FPS ${fps}`, 5, 4);
  ctx.fillStyle = '#cfe3ef';
  ctx.fillText(`peor ${worstMs.toFixed(1)} ms`, 5, 14);
  ctx.fillStyle = quality === 0 ? '#7dff8a' : quality === 1 ? '#ffd45e' : '#ff6b5e';
  ctx.fillText(`calidad ${Q_NAMES[quality]}`, 5, 24);
  ctx.restore();
}
