# Worklog

---
Task ID: 1
Agent: Super Z (agente principal)
Task: Crear la demo jugable del juego "Ecos de Aelthar" a partir del Documento de Diseño de Juego (RPG 2D) proporcionado por el usuario. Luego, a petición del usuario, la página se redujo a SOLO el juego a pantalla completa.

Work Log:
- Inicializado entorno fullstack Next.js 16 (skill fullstack-dev) con `init-fullstack.sh`.
- Clasificación: Type 3 (desarrollo web interactivo — juego en canvas).
- Arquitectura del juego (todo procedural, sin assets externos):
  - `src/game/types.ts` — tipos del motor (entidades, mapas, guardado, FX).
  - `src/game/audio.ts` — motor WebAudio: 5 pistas chiptune originales (village/forest/crypt/boss/title) con secuenciador de 32 pasos, capa de combate adaptativa y ~30 SFX sintetizados.
  - `src/game/sprites.ts` — pixel art por código: humanoides con paletas intercambiables (héroe Alba/Tejedor, Brisa, Toln, Ilwen, esqueleto, sombra), lobo, Guardián Hueco (32px), cofres, santuario, fragmento, wisps + 18 tiles dibujados con ruido determinista.
  - `src/game/maps.ts` — 3 mapas generados por código (Lunaris 52×38, Bosque 56×44, Cripta 40×34) con diffs de época (puente roto→entero, niebla→despejada, cobertizo→en pie, lápidas→flores), NPCs, cofres, ecos menores, spawns, salidas y props.
  - `src/game/data.ts` — contenido editable: 5 misiones de la cadena principal, ~25 nodos de diálogo (Brisa/Toln/Ilwen/voces), 4 tipos de enemigos con debilidades elementales, 8 habilidades (2 disciplinas), objetos clave y atributos.
  - `src/game/engine.ts` — máquina de estados (título/controles/intro/juego/pausa/diálogo/muerte/final), bucle con hit-stop, colisiones, guardado en localStorage, diálogos con acciones, misiones, muerte con oro perdido, viaje rápido, época, forja, tienda.
  - `src/game/update.ts` — IA de enemigos (patrulla→alerta→persigue→carga→ataca→recupera→huye), jefe de 3 fases con slam telegrafiado, onda expansiva e invocación de sombras, barra de quiebre, estados (quemado/congelado), compañera Ilwen (escolta + arco), proyectiles, día/noche.
  - `src/game/render.ts` — render de mundo (prerender por época con filtros de saturación), entidades ordenadas por Y, iluminación dinámica (noche radial + santuarios), niebla del presente, HUD completo (retrato, barras Vida/Resistencia/Resonancia/XP, oro, pociones, minimapa con NPCs/enemigos/santuarios, 4 slots de habilidad, tracker de misión, barra de jefe + quiebre, toasts, pistas contextuales).
  - `src/game/screens.ts` — título, controles, intro (3 diapositivas), pausa con 4 pestañas (Estado con reparto de atributos / Equipo con objetos clave y reputación / Diario / Sistema con sliders de volumen y guardar-salir), diálogo con retratos y máquina de escribir, muerte y final de demo con estadísticas.
  - `src/game/ui.ts` — helpers de UI canvas (texto pixel con Press Start 2P/VT323 + fallback, paneles, barras, botones con hover, sliders).
- Componente React: `src/components/game/EcosGame.tsx` (canvas 960×540 escalado a pantalla completa con letterbox, overlay de creación de personaje con nombre + 2 disciplinas, aviso de audio). `src/app/page.tsx` reducido a SOLO el juego (a petición del usuario). Layout con fuentes pixel y metadata del juego.
- Verificación end-to-end con agent-browser (múltiples capturas en `scripts/shot_*.png`):
  - Título, controles, creación de personaje, intro, juego.
  - BUG corregido: faltaba `Game.update()` (delegaba en updateGame) → bucle se congelaba al entrar en juego.
  - BUG corregido: blit del suelo en coordenadas de pantalla en vez de mundo → mapa mal escalado.
  - Balance ajustado (lobos 30hp/6dmg, jefe 300hp/13dmg/quiebre 70, vida inicial 110/96) tras verificar que 4 lobos simultáneos mataban al héroe.
  - BUG corregido: `talkTo('voz_fragment')` caía en `brisa_idle` → ahora abre su diálogo directamente.
  - BUG corregido: Brisa solapada con el Santuario → reubicada a (23,13) y radio del santuario 30→26.
  - Añadido Shift+T (esperar al alba, accesibilidad/QoL) tras 2 muertes nocturnas en pruebas.
  - Añadido capturador de errores en el bucle (overlay de diagnóstico) y `window.__g` para depuración.
  - Flujo completo jugado y verificado: misión de lobos (3/3) → recompensa → Bosque → noche/día → Fragmento → cambio de época Q (pasado saturado/presente desaturado) → puente roto cruzado en pasado → niebla bloquea en presente y abre en pasado → Cripta → Santuario → jefe con fases y QUEBRADO → muerte del jefe → Eco de la Voz (+1 punto, +10 rep) → viaje rápido entre santuarios → Brisa → pantalla final con estadísticas (Nv 4, 7 enemigos, 223 coronas, rep +20, 4 muertes, 11m59s).
  - Menú de pausa: reparto de atributos verificado (+1 Fuerza), pestañas y sliders correctos.
  - Diálogo refinado: pista específica de Brisa para q3 (brisa_bosque).
- Lint final: 0 errores, 0 warnings. dev.log: compila y sirve 200 sin errores.

Stage Summary:
- Demo vertical slice completa y verificada en navegador: 3 zonas, 2 disciplinas, combate táctico (combo×3, carga, esquiva i-frames, parada perfecta 0,2 s, quiebre), mecánica de Ecos con dos épocas, jefe de 3 fases, cadena principal de 5 misiones, Santuarios con guardado/viaje rápido, compañera reclutable, ciclo día/noche, música adaptativa chiptune, pantalla final con estadísticas.
- La página contiene únicamente el juego a pantalla completa (petición explícita del usuario).
- Partida persistente vía localStorage (guardado en Santuarios, autoguardado al cambiar de zona).
