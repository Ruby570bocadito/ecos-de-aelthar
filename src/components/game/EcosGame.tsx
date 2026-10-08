'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Game, VIEW_W, VIEW_H } from '@/game/engine';
import { audio } from '@/game/audio';

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
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [disc, setDisc] = useState<'alba' | 'tejedor'>('alba');
  const [needsClick, setNeedsClick] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current);
    gameRef.current = g;
    g.onRequestCreate = () => setShowCreate(true);
    g.setState('title');
    g.start();

    const onVis = () => {
      if (document.hidden && g.state === 'play') g.setState('pause');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      g.dispose();
    };
  }, []);

  const beginGame = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    audio.resume();
    setNeedsClick(false);
    g.newGame(name.trim() || 'Portador', disc);
    setShowCreate(false);
  }, [name, disc]);

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="block"
        style={{
          imageRendering: 'pixelated',
          background: '#06070f',
          width: 'min(100vw, 177.78vh)',
          height: 'min(56.25vw, 100vh)',
        }}
        tabIndex={0}
      />

      {/* Aviso de clic para activar el audio */}
      {needsClick && !showCreate && (
        <button
          onClick={() => { audio.resume(); setNeedsClick(false); }}
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
              onChange={e => setName(e.target.value.slice(0, 14))}
              placeholder="Portador"
              className="mb-4 w-full rounded border border-amber-900/50 bg-black/60 px-3 py-2 font-mono text-sm text-amber-100 outline-none placeholder:text-stone-600 focus:border-amber-500"
              onKeyDown={e => { if (e.key === 'Enter') beginGame(); }}
            />

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {DISCIPLINES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDisc(d.id)}
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
