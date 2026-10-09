'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Game, VIEW_W, VIEW_H } from '@/game/engine';
import { audio } from '@/game/audio';

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

const DISCIPLINES = [
  {
    id: 'alba' as const,
    name: 'Espada del Alba',
    role: 'Cuerpo a cuerpo equilibrado',
    weapon: 'Espada y escudo',
    desc: 'Combo de 3 golpes, parada perfecta que aturde y ondas de luz sagrada. Más vida base. Ideal para aprender el ritmo del combate.',
    skills: ['Tajo Lunar (embestida)', 'Grito de Guerra (+50% daño)', 'Muro de Alba (aturde en área)', 'Filo del Alba (definitiva)'],
    color: '#c8384a',
  },
  {
    id: 'tejedor' as const,
    name: 'Tejedor de Ecos',
    role: 'Magia elemental a distancia',
    weapon: 'Báculo de resonancia',
    desc: 'Lanza notas elementales (Fuego, Hielo, Rayo) y combina reacciones como Vapor. Menos vida, más daño a distancia.',
    skills: ['Canto de Ascuas (quema)', 'Canto de Escarcha (ralentiza)', 'Canto de Chispa (rebota)', 'Canto Mayor (nota acumulada)'],
    color: '#8a5ac0',
  },
];

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
  const [disc, setDisc] = useState<'alba' | 'tejedor'>('alba');
  const [needsClick, setNeedsClick] = useState(true);
  // Espejos ref de name/disc (patrón latest-value, sincronizados EN EL EVENTO,
  // no durante el render — regla react-hooks/refs): permiten a beginGame leer
  // el valor VIGENTE en el momento del clic con identidad ESTABLE ([] deps).
  const nameRef = useRef('');
  const discRef = useRef<'alba' | 'tejedor'>('alba');
  const updateName = useCallback((v: string) => { nameRef.current = v; setName(v); }, []);
  const chooseDisc = useCallback((d: 'alba' | 'tejedor') => { discRef.current = d; setDisc(d); }, []);

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
    setNeedsClick(false);
    g.newGame(nameRef.current.trim() || 'Portador', discRef.current);
    setShowCreate(false);
  }, []);

  // Handler del aviso de audio: también estable.
  const resumeAudio = useCallback(() => {
    audio.resume();
    setNeedsClick(false);
  }, []);

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

      {/* Creación de personaje (overlay DOM) */}
      {showCreate && (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[#06070f]/95 p-4">
          <div className="w-full max-w-3xl">
            <h2 className="mb-1 text-center font-mono text-lg font-bold tracking-widest text-amber-300">
              CREA A TU PORTADOR
            </h2>
            <p className="mb-4 text-center text-xs text-stone-400">
              Sin clase cerrada: en la demo eliges una disciplina inicial. En el juego final podrás mezclar dos y cambiarlas en los Santuarios.
            </p>

            <label className="mb-1 block font-mono text-xs text-amber-200/80">NOMBRE</label>
            <input
              value={name}
              onChange={e => updateName(e.target.value.slice(0, 14))}
              placeholder="Portador"
              className="mb-4 w-full rounded border border-amber-900/50 bg-black/60 px-3 py-2 font-mono text-sm text-amber-100 outline-none placeholder:text-stone-600 focus:border-amber-500"
              onKeyDown={e => { if (e.key === 'Enter') beginGame(); }}
            />

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {DISCIPLINES.map(d => (
                <button
                  key={d.id}
                  onClick={() => chooseDisc(d.id)}
                  className={`rounded border p-4 text-left transition-all ${disc === d.id ? 'border-amber-400 bg-white/5 ring-1 ring-amber-400/60' : 'border-stone-800 bg-black/40 hover:border-stone-600'}`}
                >
                  <div className={`mb-1 inline-block rounded px-2 py-0.5 font-mono text-[10px] ${disc === d.id ? 'bg-amber-400 text-black' : 'bg-stone-800 text-stone-400'}`}>
                    {disc === d.id ? 'SELECCIONADA' : 'ELEGIR'}
                  </div>
                  <div className="font-bold" style={{ color: d.color }}>{d.name}</div>
                  <div className="mb-2 text-xs text-stone-400">{d.role} · {d.weapon}</div>
                  <p className="mb-2 text-xs leading-relaxed text-stone-300">{d.desc}</p>
                  <ul className="space-y-0.5 text-[11px] text-stone-400">
                    {d.skills.map(s => <li key={s}>◆ {s}</li>)}
                  </ul>
                </button>
              ))}
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={beginGame}
                className="rounded bg-amber-500 px-8 py-2.5 font-mono text-sm font-bold text-black transition hover:bg-amber-400"
              >
                ▶ DESPERTAR EN LUNARIS
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded border border-stone-700 px-4 py-2.5 font-mono text-xs text-stone-400 transition hover:border-stone-500 hover:text-stone-200"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
