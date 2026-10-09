'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Game, VIEW_W, VIEW_H } from '@/game/engine';
import { audio } from '@/game/audio';
// R8-5 (EPIC 3.6) — retratos del creador: SOLO LECTURA del módulo actors.
// buildHumanoid genera los 24 frames procedurales (16×18 por héroe) y PALS
// trae las paletas hero_alba / hero_tejedor. Ningún archivo ajeno se modifica.
import { buildHumanoid, type HumanPal } from '@/game/actors/humanoid';
import { PALS } from '@/game/actors/palettes';
import {
  Flame, Heart, Megaphone, MoveHorizontal, Music, Shield, Snowflake, Sunrise,
  Swords, Zap, type LucideIcon,
} from 'lucide-react';

// R7-O4 — Valores INICIALES del buffer capturados UNA vez por evaluación del
// módulo. El motor es el ÚNICO dueño de canvas.width/height tras el montaje
// (engine.fitCanvas los ajusta al aspecto real y guarda por valor en R5-O6);
// si pasáramos los bindings vivos VIEW_W/VIEW_H al JSX, un re-render posterior
// (abrir creación, escribir el nombre...) vería el valor nuevo en el diff de
// props y REESCRIBIRÍA el atributo: eso borra el bitmap del canvas y resetea el
// estado del ctx (imageSmoothing→true) hasta el drawGame siguiente. Fijando
// los props a constantes, prev===next siempre y React jamás los toca después
// del primer render (mismo primer pintado: 960×540 → fitCanvas ajusta ya en el
// efecto de montaje, antes de que el jugador vea el título).
const INITIAL_VIEW_W = VIEW_W;
const INITIAL_VIEW_H = VIEW_H;
// Objeto de estilo estable (módulo): sin object literal nuevo por render.
const CANVAS_STYLE = {
  imageRendering: 'pixelated',
  background: '#06070f',
  // sin letterbox: el motor ajusta el buffer al aspecto real de la
  // ventana (fitViewToWindow), así que aquí basta llenar el viewport
  width: '100vw',
  height: '100vh',
} as const;

// ============================================================
// R8-5 · CREADOR DE PORTADOR — panel premium (EPIC 3.6)
// Contrato de rendimiento (heredado de R7-O4 y ampliado): este overlay es
// 100% POR-EVENTO. El motor sigue siendo el dueño del RAF; el nombre se
// escribe (evento input), la disciplina se elige (evento click) y el
// parpadeo/respiración de los retratos lo pinta un setInterval que hace
// drawImage DIRECTO sobre el canvas del retrato — cero setState por frame.
// Los callbacks que bajan a los hijos son estables (refs latest-value +
// useCallback []) y las tarjetas van memo(): teclear el nombre NO vuelve a
// renderizar los retratos. Los estados React siguen siendo solo cambios de
// ESCENA/overlay (showCreate/name/disc/needsClick), nunca valores por-frame.
// ============================================================

type DiscId = 'alba' | 'tejedor';

interface DiscDef {
  id: DiscId;
  name: string;
  role: string;
  weapon: string;
  desc: string;
  color: string;
  pal: HumanPal;
  swatches: string[];
  skills: { icon: LucideIcon; name: string; hint: string }[];
  // Perfil COMPARATIVO solo para las barras del creador (0-100, visual).
  // Vida sí refleja la proporción REAL de maxHp del motor (110 vs 96 →
  // 89 vs 77); daño/alcance describen el estilo de juego. NO alimenta a
  // newGame ni a balance.ts: cero cambios de balance de verdad.
  stats: { vida: number; dano: number; alcance: number };
}

const swatchesOf = (pal: HumanPal): string[] => [
  pal.hair, pal.body, pal.bodyS ?? pal.body, pal.accent, pal.legs, pal.boots,
];

const HERO_PAL: Record<DiscId, HumanPal> = {
  alba: PALS.hero_alba,
  tejedor: PALS.hero_tejedor,
};

const DISCIPLINES: DiscDef[] = [
  {
    id: 'alba',
    name: 'Espada del Alba',
    role: 'Cuerpo a cuerpo equilibrado',
    weapon: 'Espada y escudo',
    desc: 'Combo de 3 golpes, parada perfecta que aturde y ondas de luz sagrada. Más vida base. Ideal para aprender el ritmo del combate.',
    color: '#c8384a',
    pal: HERO_PAL.alba,
    swatches: swatchesOf(HERO_PAL.alba),
    skills: [
      { icon: Swords, name: 'Tajo Lunar', hint: 'Embestida que atraviesa enemigos' },
      { icon: Megaphone, name: 'Grito de Guerra', hint: '+50% daño unos segundos' },
      { icon: Shield, name: 'Muro de Alba', hint: 'Aturde en área' },
      { icon: Sunrise, name: 'Filo del Alba', hint: 'Definitiva de luz sagrada' },
    ],
    stats: { vida: 89, dano: 58, alcance: 36 },
  },
  {
    id: 'tejedor',
    name: 'Tejedor de Ecos',
    role: 'Magia elemental a distancia',
    weapon: 'Báculo de resonancia',
    desc: 'Lanza notas elementales (Fuego, Hielo, Rayo) y combina reacciones como Vapor. Menos vida, más daño a distancia.',
    color: '#8a5ac0',
    pal: HERO_PAL.tejedor,
    swatches: swatchesOf(HERO_PAL.tejedor),
    skills: [
      { icon: Flame, name: 'Canto de Ascuas', hint: 'Nota ígnea que quema' },
      { icon: Snowflake, name: 'Canto de Escarcha', hint: 'Ralentiza al objetivo' },
      { icon: Zap, name: 'Canto de Chispa', hint: 'Rayo que rebota' },
      { icon: Music, name: 'Canto Mayor', hint: 'Nota acumulada masiva' },
    ],
    stats: { vida: 77, dano: 84, alcance: 92 },
  },
];

// Sprites de retrato: construcción PEREZOSA en cliente. buildHumanoid usa
// document.createElement → jamás en el scope de módulo (el SSR de Next
// evaluaría el módulo en servidor y rompería). Se construye una sola vez al
// abrir el creador y queda cacheado para el resto de la sesión.
let HERO_FRAMES: Record<DiscId, HTMLCanvasElement[]> | null = null;
function heroFrames(): Record<DiscId, HTMLCanvasElement[]> | null {
  if (HERO_FRAMES) return HERO_FRAMES;
  if (typeof document === 'undefined') return null;
  HERO_FRAMES = {
    alba: buildHumanoid(PALS.hero_alba),
    tejedor: buildHumanoid(PALS.hero_tejedor),
  };
  return HERO_FRAMES;
}

// CSS del creador (keyframes propios con prefijo eca-, sin chocar con
// globals.css que no es archivo de este agente). Entrada fade/slide 250-300ms
// + borde dorado animado en la disciplina elegida + guard de reduced-motion.
const CREATOR_CSS = `
@keyframes ecaFade{from{opacity:0}to{opacity:1}}
@keyframes ecaRise{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
@keyframes ecaGold{0%,100%{box-shadow:0 0 0 1px rgba(232,192,74,.5),0 0 14px rgba(232,192,74,.18)}50%{box-shadow:0 0 0 1px rgba(232,192,74,.95),0 0 30px rgba(232,192,74,.42)}}
.eca-overlay{animation:ecaFade .25s ease-out both}
.eca-panel{animation:ecaRise .3s cubic-bezier(.16,1,.3,1) both}
.eca-d1{animation:ecaRise .3s cubic-bezier(.16,1,.3,1) both;animation-delay:.06s}
.eca-d2{animation:ecaRise .3s cubic-bezier(.16,1,.3,1) both;animation-delay:.14s}
.eca-d3{animation:ecaRise .3s cubic-bezier(.16,1,.3,1) both;animation-delay:.22s}
.eca-gold{animation:ecaGold 2.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.eca-overlay,.eca-panel,.eca-d1,.eca-d2,.eca-d3,.eca-gold{animation:none!important}}
`;

// Escala del retrato: sprite 16×18 → 96×108 px nítidos (rango pedido ×4-6).
const PORTRAIT_SCALE = 6;

/**
 * Retrato pixelado del héroe: canvas pequeño que estampa los frames de
 * buildHumanoid(PALS.hero_*) a escala ×6 con image-rendering: pixelated.
 * Idle animado por EVENTO: frame 6 (idle neutro, ojos abiertos) y cada ~3,4 s
 * un parpadeo de 170 ms con el frame 7 (bob de respiración horneado). El
 * intervalo pinta directo en el canvas — no toca estado React. memo(): mientras
 * se teclea el nombre este componente ni se entera.
 */
const PortraitCanvas = memo(function PortraitCanvas({ disc, tint }: { disc: DiscId; tint: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = ref.current;
    const ctx = cvs?.getContext('2d');
    const all = heroFrames();
    if (!cvs || !ctx || !all) return;
    const fr = all[disc];
    ctx.imageSmoothingEnabled = false; // nitidez pixel-art al escalar
    const paint = (i: number) => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(fr[i], 0, 0, cvs.width, cvs.height);
    };
    paint(6); // idle de frente, ojos abiertos
    let unblink = 0;
    const iv = window.setInterval(() => {
      paint(7); // parpadeo + bob de respiración (frames idle de humanoid.ts)
      window.clearTimeout(unblink);
      unblink = window.setTimeout(() => paint(6), 170);
    }, 3400);
    return () => { window.clearInterval(iv); window.clearTimeout(unblink); };
  }, [disc]);
  return (
    <div
      className="relative flex h-[136px] items-end justify-center overflow-hidden border-b border-white/5"
      style={{ background: `radial-gradient(ellipse at 50% 100%, ${tint}2e 0%, ${tint}14 40%, transparent 72%)` }}
    >
      {/* sombra de suelo bajo el personaje */}
      <div aria-hidden className="absolute bottom-3 h-2 w-16 rounded-full bg-black/70 blur-[2px]" />
      <canvas
        ref={ref}
        width={16 * PORTRAIT_SCALE}
        height={18 * PORTRAIT_SCALE}
        className="relative mb-1"
        style={{ imageRendering: 'pixelated' }}
        aria-hidden
      />
    </div>
  );
});

/** Barra comparativa del perfil (solo visual, 0-100). */
function StatBar({ icon: Icon, label, value, color }: {
  icon: LucideIcon; label: string; value: number; color: string;
}) {
  return (
    <div className="flex items-center gap-1.5" title={`${label}: perfil ${value}/100`}>
      <Icon size={11} className="shrink-0 text-stone-500" aria-hidden />
      <span className="w-[52px] shrink-0 font-mono text-[9px] uppercase tracking-wider text-stone-500">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className="block h-full rounded-full transition-[width] duration-300"
          style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}55, ${color})` }}
        />
      </span>
      <span className="w-6 shrink-0 text-right font-mono text-[9px] tabular-nums text-stone-500">{value}</span>
    </div>
  );
}

/**
 * Tarjeta de disciplina (memo): retrato grande + paleta + estilo + habilidades
 * con icono + perfil comparativo. Props estables (d: constante de módulo,
 * selected: bool, onSelect: useCallback []) → teclear el nombre no la
 * re-renderiza. Botón real: Tab/Enter la selecciona (accesible por teclado).
 */
const DisciplineCard = memo(function DisciplineCard({ d, selected, onSelect }: {
  d: DiscDef;
  selected: boolean;
  onSelect: (id: DiscId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(d.id)}
      aria-pressed={selected}
      className={`group relative overflow-hidden rounded-lg border text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
        selected
          ? 'eca-gold border-amber-400/80 bg-[#171307]/60'
          : 'border-stone-800 bg-black/40 hover:border-stone-600'
      }`}
    >
      <PortraitCanvas disc={d.id} tint={d.color} />

      {/* chip de estado */}
      <span
        className={`absolute right-2.5 top-2.5 rounded px-2 py-0.5 font-mono text-[9px] tracking-widest ${
          selected ? 'bg-amber-400 text-black' : 'border border-stone-700 bg-black/70 text-stone-400'
        }`}
      >
        {selected ? '✓ SELECCIONADA' : 'ELEGIR'}
      </span>

      <div className="p-4">
        <div className="font-mono text-base font-bold tracking-wide" style={{ color: d.color }}>
          {d.name}
        </div>
        <div className="mt-0.5 text-[11px] text-stone-400">
          {d.role} · <span className="text-stone-300">{d.weapon}</span>
        </div>

        {/* paleta de la disciplina (leída de PALS, solo visual) */}
        <div className="mt-2 flex items-center gap-1" aria-label="Paleta de la disciplina">
          {d.swatches.map((c, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full border border-black/60" style={{ background: c }} />
          ))}
          <span className="ml-1.5 font-mono text-[9px] uppercase tracking-widest text-stone-600">paleta</span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-stone-300">{d.desc}</p>

        {/* habilidades con icono y descripción de una línea */}
        <ul className="mt-3 grid grid-cols-2 gap-1.5">
          {d.skills.map(s => {
            const Icon = s.icon;
            return (
              <li key={s.name} className="flex items-start gap-1.5 rounded border border-white/5 bg-white/[0.03] p-1.5">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                  style={{ background: `${d.color}22`, color: d.color }}
                >
                  <Icon size={12} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[11px] text-stone-200">{s.name}</span>
                  <span className="block text-[10px] leading-tight text-stone-500">{s.hint}</span>
                </span>
              </li>
            );
          })}
        </ul>

        {/* perfil comparativo (solo visual; vida = proporción real de maxHp) */}
        <div className="mt-3 space-y-1 border-t border-white/5 pt-2.5">
          <StatBar icon={Heart} label="Vida" value={d.stats.vida} color={d.color} />
          <StatBar icon={Swords} label="Daño" value={d.stats.dano} color={d.color} />
          <StatBar icon={MoveHorizontal} label="Alcance" value={d.stats.alcance} color={d.color} />
        </div>
      </div>
    </button>
  );
});

export default function EcosGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  // Estado REACT = solo cambios de ESCENA/overlay (nunca valores por-frame):
  //  · showCreate  → 1 vez por transición título↔creación (via engine.requestCreate,
  //    que trae guard title-only anti clic-fantasma; NUNCA durante el loop RAF).
  //  · name/disc   → solo mientras el overlay de creación está abierto (escritura).
  //  · needsClick  → 1 vez (primer clic que activa el audio).
  // Durante 'play' este componente NO se re-renderiza jamás: el juego entero
  // vive dentro del canvas y del RAF del motor.
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [disc, setDisc] = useState<DiscId>('alba');
  const [needsClick, setNeedsClick] = useState(true);
  // Espejos ref de name/disc (patrón latest-value, sincronizados EN EL EVENTO,
  // no durante el render — regla react-hooks/refs): permiten a beginGame leer
  // el valor VIGENTE en el momento del clic con identidad ESTABLE ([] deps).
  const nameRef = useRef('');
  const discRef = useRef<DiscId>('alba');
  const updateName = useCallback((v: string) => { nameRef.current = v; setName(v); }, []);
  const chooseDisc = useCallback((d: DiscId) => {
    discRef.current = d;
    setDisc(d);
    audio.sfx('select'); // feedback sonoro de selección (por-evento)
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current);
    gameRef.current = g;
    // Se dispara SOLO desde engine.requestCreate() (botón NUEVA PARTIDA del
    // título): guard title-only en el motor + stamp de estado en uiHit → este
    // setState nunca ocurre por frame ni en plena partida (blindaje ab61a49/a30cc3a).
    g.onRequestCreate = () => setShowCreate(true);
    g.setState('title');
    g.start(); // guard running + cancelAnimationFrame anti-doble-rAF (R5-O6)

    const onVis = () => {
      if (document.hidden && g.state === 'play') g.setState('pause');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      // dispose() del motor: window keydown/keyup/blur/resize + visibilitychange
      // + mousemove/down/up del canvas + stop() (running=false + cancelAnimationFrame).
      // Única excepción conocida: el listener anónimo 'contextmenu' del canvas
      // (preventDefault idempotente, benigno; vive en engine.ts, fuera de alcance).
      // reactStrictMode: false en next.config.ts → sin doble montaje en dev;
      // ante un remontaje real, Game re-bindInput limpia los named listeners.
      g.dispose();
    };
  }, []);

  // Identidad estable ([] deps): antes se recreaba por CADA TECLA (deps
  // name/disc) y forzaba new props onKeyDown/onClick en todo el overlay.
  // Lee los valores vigentes vía refs → mismo comportamiento exacto.
  const beginGame = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    audio.resume();
    audio.sfx('confirm'); // R8-5: jugo al despertar (por-evento; newGame no suena)
    setNeedsClick(false);
    g.newGame(nameRef.current.trim() || 'Portador', discRef.current);
    setShowCreate(false);
  }, []);

  // R8-5: cierre del creador (botón Volver / Esc). Estable; devuelve el foco
  // al canvas para que el flujo por teclado siga en el título.
  const closeCreate = useCallback(() => {
    setShowCreate(false);
    canvasRef.current?.focus();
  }, []);

  // Esc cierra el creador (solo mientras está abierto; por-evento). No toca
  // el guard anti-clic-fantasma del motor: el overlay solo se abre vía
  // requestCreate desde el título y el estado del motor sigue siendo 'title'.
  useEffect(() => {
    if (!showCreate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCreate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCreate, closeCreate]);

  // Handler del aviso de audio: también estable.
  const resumeAudio = useCallback(() => {
    audio.resume();
    setNeedsClick(false);
  }, []);

  // Validación suave: el despertar exige nombre (botón disabled + Enter
  // bloqueado). El fallback 'Portador' de newGame queda como red de seguridad.
  const nameOk = name.trim().length > 0;

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        width={INITIAL_VIEW_W}
        height={INITIAL_VIEW_H}
        className="block"
        style={CANVAS_STYLE}
        tabIndex={0}
      />

      {/* Aviso de clic para activar el audio */}
      {needsClick && !showCreate && (
        <button
          onClick={resumeAudio}
          className="absolute right-4 top-4 rounded border border-amber-900/40 bg-black/60 px-3 py-1.5 font-mono text-[10px] text-amber-200/70 hover:text-amber-200"
        >
          (haz clic para activar el sonido)
        </button>
      )}

      {/* Creación de personaje (overlay DOM · R8-5 panel premium) */}
      {showCreate && (
        <div
          className="eca-overlay absolute inset-0 z-10 flex overflow-y-auto bg-[#06070f]/85 p-4 backdrop-blur-[3px] sm:p-6"
          role="dialog"
          aria-label="Crea a tu Portador"
        >
          <style>{CREATOR_CSS}</style>
          {/* viñeta sobre el título animado de fondo */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.6)_100%)]"
          />

          <div className="eca-panel relative m-auto w-full max-w-4xl overflow-hidden rounded-xl border border-amber-900/50 bg-[#0a0c18]/95 shadow-[0_24px_70px_rgba(0,0,0,0.75)]">
            {/* brillo superior + esquinas ornamentales */}
            <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
            <div aria-hidden className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 border-l-2 border-t-2 border-amber-500/40" />
            <div aria-hidden className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 border-r-2 border-t-2 border-amber-500/40" />
            <div aria-hidden className="pointer-events-none absolute bottom-2 left-2 h-3.5 w-3.5 border-b-2 border-l-2 border-amber-500/40" />
            <div aria-hidden className="pointer-events-none absolute bottom-2 right-2 h-3.5 w-3.5 border-b-2 border-r-2 border-amber-500/40" />

            <div className="px-6 pb-6 pt-7 sm:px-10">
              {/* cabecera */}
              <header className="eca-d1 text-center">
                <p className="font-mono text-[10px] tracking-[0.35em] text-amber-500/70">
                  SANTUARIO DE LUNARIS · PRUEBA DE INICIACIÓN
                </p>
                <h2
                  className="mt-2 font-mono text-2xl font-bold uppercase tracking-[0.2em] text-amber-200 sm:text-3xl"
                  style={{ textShadow: '0 0 26px rgba(232,192,74,0.35)' }}
                >
                  Crea a tu Portador
                </h2>
                <div className="mx-auto mt-3 flex max-w-md items-center gap-2" aria-hidden>
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-700/60" />
                  <span className="text-[9px] text-amber-500/70">◆</span>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-700/60" />
                </div>
                <p className="mx-auto mt-3 max-w-xl text-[11px] leading-relaxed text-stone-400">
                  Sin clase cerrada: eliges una disciplina inicial. En el juego final podrás mezclar dos y cambiarlas en los Santuarios.
                </p>
              </header>

              {/* nombre del Portador */}
              <div className="eca-d1 mx-auto mt-5 w-full max-w-sm">
                <div className="mb-1 flex items-end justify-between">
                  <label htmlFor="portador-name" className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-200/80">
                    Nombre del Portador
                  </label>
                  <span className={`font-mono text-[10px] tabular-nums ${name.length >= 12 ? 'text-amber-400/90' : 'text-stone-600'}`}>
                    {name.length}/14
                  </span>
                </div>
                <input
                  id="portador-name"
                  value={name}
                  onChange={e => updateName(e.target.value.slice(0, 14))}
                  placeholder="Portador"
                  maxLength={14}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="portador-name-hint"
                  className="w-full rounded-md border border-amber-900/50 bg-black/60 px-3 py-2 text-center font-mono text-sm text-amber-100 outline-none transition-colors placeholder:text-stone-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40"
                  onKeyDown={e => { if (e.key === 'Enter' && nameOk) beginGame(); }}
                />
                <p id="portador-name-hint" className="mt-1 text-center text-[10px] text-stone-500">
                  {nameOk ? 'El Eco recordará este nombre.' : 'El mundo necesita saber a quién despierta.'}
                </p>
              </div>

              {/* disciplinas lado a lado */}
              <div className="eca-d2 mt-5 grid gap-4 sm:grid-cols-2" aria-label="Disciplinas">
                {DISCIPLINES.map(d => (
                  <DisciplineCard key={d.id} d={d} selected={disc === d.id} onSelect={chooseDisc} />
                ))}
              </div>

              <p className="eca-d2 mt-2.5 text-center font-mono text-[10px] text-stone-500">
                ◆ Disciplinas equilibradas: cada una destaca en algo distinto — la Vida refleja los valores reales del juego.
              </p>

              {/* confirmación */}
              <div className="eca-d3 mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={beginGame}
                  disabled={!nameOk}
                  className={`rounded-md px-10 py-3 font-mono text-sm font-bold uppercase tracking-[0.15em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                    nameOk
                      ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_0_20px_rgba(232,192,74,0.35)] hover:from-amber-200 hover:to-amber-400 hover:shadow-[0_0_30px_rgba(232,192,74,0.55)] active:translate-y-px'
                      : 'cursor-not-allowed bg-stone-800 text-stone-500'
                  }`}
                >
                  ▶ Despertar en Lunaris
                </button>
                <button
                  type="button"
                  onClick={closeCreate}
                  className="rounded-md border border-stone-700 px-5 py-3 font-mono text-xs text-stone-400 transition-colors hover:border-stone-500 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
                >
                  Volver al título (Esc)
                </button>
              </div>
              <div className="eca-d3 mt-2 h-4" aria-live="polite">
                {!nameOk && (
                  <p className="text-center font-mono text-[10px] text-amber-500/80">
                    Escribe un nombre para tu Portador para poder despertar.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
