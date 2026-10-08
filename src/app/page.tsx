'use client';

import dynamic from 'next/dynamic';

const EcosGame = dynamic(() => import('@/components/game/EcosGame'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[540px] w-full max-w-[960px] items-center justify-center rounded-lg border border-amber-900/40 bg-black">
      <p className="animate-pulse font-mono text-sm text-amber-200/70">Tejiendo el canto de Aelthar…</p>
    </div>
  ),
});

const FEATURES = [
  {
    icon: '⚔️',
    title: 'Combate táctico en tiempo real',
    body: 'Combo de 3 golpes, ataque cargado, esquiva con fotogramas de invulnerabilidad y parada perfecta de 0,2 s que aturde. El Guardián Hueco tiene barra de quiebre: rómpela para dejarlo vulnerable 4 s.',
  },
  {
    icon: '⏳',
    title: 'La mecánica de Ecos: dos épocas',
    body: 'Al tocar el Fragmento de Eco alternas con Q entre el presente (ruinas, desaturado) y el pasado (esplendor, saturado). El puente roto del Bosque solo cruza en el pasado, y hay cofres que solo existen en una época.',
  },
  {
    icon: '🛡️',
    title: 'Dos disciplinas jugables',
    body: 'Espada del Alba (melé y luz sagrada) o Tejedor de Ecos (Cantos elementales con reacciones: Fuego quema, Hielo ralentiza, Rayo rebota, y Hielo sobre Fuego provoca Vapor).',
  },
  {
    icon: '🗺️',
    title: 'Tres zonas del GDD',
    body: 'Valle de Lunaris (tutorial y pueblo), Bosque Susurrante (niebla, río y Ruina Antigua) y la Cripta del Primer Canto (mazmorra a oscuras con el primer jefe).',
  },
  {
    icon: '💛',
    title: 'Sistemas de RPG',
    body: 'Niveles 1–50 con 3 puntos de atributo por nivel (Fuerza, Destreza, Intelecto, Espíritu, Vigor), coronas, forja de Toln hasta +5, pociones, reputación con los Guardianes del Canto y compañera reclutable (Ilwen).',
  },
  {
    icon: '🎵',
    title: 'Música adaptativa chiptune',
    body: 'Cada región tiene su melodía sintetizada en vivo (WebAudio), con capa de combate que entra sin cortes cuando te descubren, tema de jefe propio y efectos con respuesta clara para la parada perfecta.',
  },
];

const ROADMAP = [
  ['Valle de Lunaris', '✅ en la demo'],
  ['Bosque Susurrante', '✅ en la demo'],
  ['Cripta del Primer Canto + Guardián Hueco', '✅ en la demo'],
  ['Cambio de época (presente/pasado)', '✅ en la demo'],
  ['Desierto de Kaar, Costas de Marena, Picos de Orvane, Ciénaga de Nhul, Ciudadela Vesh', '🔮 post-demo'],
  ['Monturas, barco, cooperativo local, 3 finales', '🔮 post-demo'],
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Cabecera */}
      <header className="border-b border-amber-900/30 bg-black/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h1 className="font-mono text-sm font-bold tracking-widest text-amber-300 sm:text-base">
              ECOS DE AELTHAR <span className="text-stone-500">— Demo del GDD</span>
            </h1>
            <p className="text-xs text-stone-500">
              RPG 2D de acción · pixel art 16-bit · vertical slice jugable
            </p>
          </div>
          <div className="flex gap-2 font-mono text-[10px] text-stone-400">
            <span className="rounded border border-emerald-900/60 bg-emerald-950/40 px-2 py-1 text-emerald-400">
              WASD + ratón
            </span>
            <span className="rounded border border-amber-900/60 bg-amber-950/30 px-2 py-1">
              Q: cambiar de época
            </span>
            <span className="hidden rounded border border-stone-800 px-2 py-1 sm:inline">
              Esc: menú
            </span>
          </div>
        </div>
      </header>

      {/* Juego */}
      <section className="mx-auto flex max-w-6xl flex-col items-center px-4 py-6">
        <EcosGame />
      </section>

      {/* Qué incluye la demo */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <h2 className="mb-1 font-mono text-sm font-bold tracking-widest text-amber-300">
          LO QUE PUEDES PROBAR EN ESTA DEMO
        </h2>
        <p className="mb-5 max-w-3xl text-sm leading-relaxed text-stone-400">
          Vertical slice según la recomendación del propio documento de diseño: una región tutorial, el bosque contiguo,
          dos disciplinas, una compañera y la primera mazmorra con su jefe — suficientes sistemas para validar combate,
          exploración y el gancho central del juego (revivir el pasado de cada zona).
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <article
              key={f.title}
              className="rounded-lg border border-stone-800 bg-stone-950/60 p-4 transition hover:border-amber-900/60"
            >
              <div className="mb-2 text-2xl">{f.icon}</div>
              <h3 className="mb-1.5 font-bold text-stone-100">{f.title}</h3>
              <p className="text-xs leading-relaxed text-stone-400">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Alcance */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-5">
            <h2 className="mb-3 font-mono text-xs font-bold tracking-widest text-amber-300">
              ALCANCE: DEMO vs GDD COMPLETO
            </h2>
            <ul className="space-y-2">
              {ROADMAP.map(([item, status]) => (
                <li key={item} className="flex items-start justify-between gap-3 border-b border-stone-900 pb-2 text-sm">
                  <span className="text-stone-300">{item}</span>
                  <span className={`whitespace-nowrap font-mono text-[11px] ${status.startsWith('✅') ? 'text-emerald-400' : 'text-stone-500'}`}>
                    {status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-5">
            <h2 className="mb-3 font-mono text-xs font-bold tracking-widest text-amber-300">
              GUÍA RÁPIDA DE LA CADENA PRINCIPAL
            </h2>
            <ol className="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-stone-300">
              <li>Habla con la <b className="text-stone-100">Anciana Brisa</b> en la plaza de Lunaris y caza a los <b className="text-stone-100">3 Lobos de Niebla</b> del sur (esquiva su embestida con Espacio).</li>
              <li>Visita a <b className="text-stone-100">Toln</b> para mejorar tu arma (+1) y compra pociones antes de salir.</li>
              <li>Sal por el norte al <b className="text-stone-100">Bosque Susurrante</b> y llega a la Ruina Antigua para tocar el <b className="text-stone-100">Fragmento de Eco</b>.</li>
              <li>Con el cambio de época desbloqueado, pulsa <b className="text-amber-300">Q</b> junto al puente roto y cruza al <b className="text-stone-100">pasado</b>. Recluta a Ilwen en el camino.</li>
              <li>Entra en la <b className="text-stone-100">Cripta del Primer Canto</b>, descansa en su Santuario (guarda la partida) y derrota al <b className="text-stone-100">Guardián Hueco</b>: rompe su barra de quiebre para críticos.</li>
              <li>Recoge el <b className="text-amber-300">Eco de la Voz</b> en el altar y vuelve con Brisa para cerrar la demo.</li>
            </ol>
            <p className="mt-4 text-xs leading-relaxed text-stone-500">
              Extras: 9 cofres (uno solo existe en el pasado), 8 ecos menores con lore del mundo, ciclo día/noche
              (los lobos ven más lejos de noche), oro perdido al morir que puedes recuperar, viaje rápido entre
              Santuarios y música que reacciona al combate.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-900 bg-black/40">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-stone-600">
          Ecos de Aelthar · Demo basada en el Documento de Diseño de Juego (RPG 2D) de @papito · 8 oct 2026 ·
          Hecha con Next.js + Canvas, sin assets externos: todo el arte y la música se generan por código.
        </div>
      </footer>
    </main>
  );
}
