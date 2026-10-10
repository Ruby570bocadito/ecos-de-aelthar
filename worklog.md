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

---
Task ID: 2
Agent: Super Z (agente principal)
Task: Empaquetar la demo "Ecos de Aelthar" en un ZIP y subirla a un repositorio privado de GitHub del usuario (token proporcionado por el usuario en el chat).

Work Log:
- Creado ZIP limpio del proyecto (sin node_modules/.next/.git): download/ecos-de-aelthar-demo.zip (228 KB, 96 archivos).
- Staging en .zpackage/ecos-de-aelthar con package.json renombrado a "ecos-de-aelthar", scripts simplificados (dev/build/start sin tee) y README.md con instrucciones de ejecucion y controles.
- Verificado token de GitHub (usuario Ruby570bocadito, scopes repo+workflow).
- Creado repositorio PRIVADO via API: Ruby570bocadito/ecos-de-aelthar.
- git init limpio (rama main) en staging + commit unico con descripcion del juego + push verificado (71d290e).
- Contenido del repo verificado via API: codigo del juego completo en src/game/, README, configs.

Stage Summary:
- ZIP entregable: /home/z/my-project/download/ecos-de-aelthar-demo.zip
- Repo privado: https://github.com/Ruby570bocadito/ecos-de-aelthar (rama main, commit 71d290e)
- PENDIENTE avisar al usuario: revocar/rotar el token ghp_... compartido en el chat por seguridad.

---
Task ID: 3-0
Agent: Super Z (agente principal)
Task: Preparar contrato compartido para mejora en paralelo con 2 agentes (3-a visuales, 3-b mecánicas) alineada con la biblia de la historia.

Work Log:
- types.ts: añadidos ToneKind, DialogueOption.tone, Entity.kbVx/kbVy, Enemy.marked, Player.comboT/tones/memories/repFacciones, SaveData opcional (compatible con guardados antiguos).
- engine.ts: integración de hooks (recordDialogueTone en advanceDialogue, default→handleCustomAction), campos de feedback (flashT/flashColor/slowmoT/memoryReveal/bossBanner*), decaimientos en el bucle, serialización en newGame/continueGame/save.
- fxcore.ts (NUEVO, congelado): addShake, addFlash, requestSlowmo, applyKnockback, stepKnockback.
- hooks.ts (NUEVO, propiedad del agente 3-b): stub con recordDialogueTone/dominantTone/TONE_LABEL funcionales y handleCustomAction no-op.
- data.ts: export MEMORIES (3 memorias de la biblia: nana, casa, madre sin rostro) para Diario y overlays.

Stage Summary:
- Contrato listo: agentes pueden trabajar en paralelo sin tocar engine.ts/types.ts/fxcore.ts.
- Propiedad de archivos: 3-a = sprites/render/screens/audio + fx.ts (nuevo); 3-b = update/data/maps + hooks.ts.
- Lint base en verde y dev.log compila.

---
Task ID: 3-b
Agent: full-stack-developer (3-b mecánicas)
Task: Profundizar mecánicas de combate (knockback, combo, remate, Ilwen mejorada, feedback de jefe) y añadir contenido de la biblia (tono de diálogo, memorias, facciones, NPC Doran/Heraldo/Teo, ecos menores, easter egg Nimue).

Work Log:
- Leído worklog.md y TODOS los archivos del contrato (engine, types, fxcore, audio, render, screens, data, maps, hooks, update) antes de escribir.
- T1 · hooks.ts (implementación completa, sustituye el stub):
  - handleCustomAction: 'memory_<id>' (concede memoria única + overlay memoryReveal t=5.5 + toast + sfx), 'rep_<faccion>_<±n>' (guardianes|orden|circulo|liga, clamp ±100, toast coloreado), 'eco_taken_mem' (llama g.applyAction('eco_taken') y concede mem_nana), 'flag_<clave>' (utilidad). Documentado en comentario para el equipo.
  - recordDialogueTone: mantiene conteo + g.flags.tonoDominante; NUEVO: primera vez que un tono se vuelve dominante → +1 afinidad de Ilwen si está reclutada (biblia: los compañeros reaccionan a tu personalidad).
  - dominantTone y TONE_LABEL intactos; añadido helper toneFlagOf() exportado (lee el tono de flags con narrowing seguro: flags es Record<string, number|boolean> congelado, el tono se guarda como string en runtime con cast documentado).
- T2 · update.ts (combate):
  - stepKnockback aplicado a jugador, enemigos e Ilwen. Knockback generado con applyKnockback en: proyectiles aliados (fuego 150 > rayo 110 > resto 85; flechas de Ilwen 90), ondas y slams del jefe contra el Portador (260, sin empujar si parada), impactos cargados del jugador (onda de empuje frontal 200, detectando p.chargedHit recién activo y limpiándolo al terminar el golpe para que no se herede al render/siguiente ataque).
  - Ventana de combo: p.comboT = 1.2 mientras attackT > 0; decae al terminar el golpe; al caducar p.combo = 0.
  - REMATE: enemigo ai='aturdido' con maxSta>0 a <30px en golpe recién liberado → damageEnemy ×0.6 extra, float '¡REMATE!' grande, addShake(4), requestSlowmo(0.2), +15 resonancia, sfx 'break'. Una vez por periodo de quebrado (WeakSet/WeakMap a nivel de módulo, reset al re-aturdirse).
  - Ilwen: flechas elementales cíclicas fuego→hielo→rayo (fuego/hielo aplican estados vía damageEnemy, rayo solo daño); MARCA cada 6 s al enemigo aggro más cercano (e.marked=5, decae en mi update; flechas a marcados +60% daño); técnica combinada «Lluvia de estrellas» con affinity>=20 + enemigos aggro <140px + cd 24 s (WeakMap<Companion>): ráfaga de 10 proyectiles elementales en abanico + 2 ondas visuales + addFlash('#ffe9a0') + addShake(3) + float + sfx holy/bolt. Fuente de afinidad nueva: +1 cada 10 s de combate codo con codo (cap 30) + tonos (máx +4).
  - Jefe (guardianBrain): banner de primera entrada en aggro (bossBannerT 3.2, 'GUARDIÁN HUECO' / 'Custodio del Eco de la Voz', addFlash #7ee8ff, sfx 'banner', flag bossIntro); cambios de fase con addFlash + addShake(5) + requestSlowmo(0.25); slam directo y ondas arrea al Portador (applyKnockback 260).
  - Estados: e.marked decae; quemado/congelado intactos; balance del jefe sin tocar.
  - FIX en mi archivo: el bucle de proyectiles enviaba las flechas de Ilwen (from='companion') a la rama de proyectiles ENEMIGOS: nunca dañaban a enemigos y podían herir al Portador por fuego amigo. Ahora `pr.from !== 'enemy'` daña enemigos; solo 'enemy' puede dañar al jugador.
  - FIX en mi archivo: flags.q2_done no lo fijaba nadie → el showFlag de Ilwen la dejaba invisible para siempre. Watcher O(1) en updateGame (questIdx>=2 → q2_done=true).
- T3 · data.ts (contenido biblia):
  - Opciones con tone (empático/pragmático/sarcástico/amenazante) en: brisa_intro3, brisa_reward, toln_forge, ilwen_intro, voz_fragment, eco_voz, + nodos de reacción cortos (brisa_reac_*, brisa_rw_*, toln_forge_sarc, ilwen_reac_amenaz, voz_frag_*, eco_voz_*).
  - eco_voz onEnd → 'eco_taken_mem' (primera memoria: la nana, al recuperar el Eco de la Voz).
  - Variantes por tono dominante vía getDialogue (firma intacta): Toln llama 'Listillo' al sarcástico (toln_intro_listillo), Brisa usa 'alma' con el empático y desconfía del amenazante (brisa_idle_emp / brisa_idle_amenaz), Ilwen respeta al pragmático (ilwen_chat_prag 'Hablamos claro, los dos').
  - Watchers de memorias en updateGame (no hooks): flags.ecoVoz + bosque → mem_casa; flags.guardianDefeated → mem_madre (una vez, flags mem_casa/mem_madre).
  - NPC nuevos (diálogos): doran_intro/verde/sarc/orden/reject/bye (Círculo Verde: «no es maldad, es lo que había antes»; rep_circulo_5 en empático/pragmático; rep_orden_-5 al rechazar a la Orden), heraldo_intro/amenaz/prag/emp (te llama «el recipiente», «la Lanza ya está preparada para la segunda vez», Gran Inquisidor; rep_orden_-5 al desafiar), teo_intro/emp/prag/sarc (niño rescatado; la nana de su madre = guiño a la melodía del Portador).
  - Ecos menores nuevos: e3 'Los Guardianes que aún cantan' (Lunaris), b_e4 'La Rebelión de los Sordos' (Bosque), c_e3 'La Lanza Muda' de los Durn (Cripta, conecta con la cita del Heraldo).
  - Easter egg Nimue: cartel needPast en el Bosque (donde la Niebla se disipa en el pasado) que susurra «...nimue... nimue...» y juega con el nombre Naia que usa Ilwen. readSign consume pr.label (verificado: pasa el texto completo).
- T4 · maps.ts: NPC teo (23,20, showFlag wolfKills), heraldo (28,17, showFlag ecoVoz, sprite 'sombra' seguro mientras 3-a crea el suyo), doran (36,24, sprite/portrait 'doran'); ecos/props nuevos en tiles libres sin tocar layout ni diffs de época; fix import Epoch (faltaba y rompía tsc).
- sfx nuevos del contrato ('break', 'memory', 'banner'): verificado que el switch de audio.sfx NO tiene default → nombre desconocido = no-op seguro; se llaman directamente (documentado en comentarios).
- Verificación: bun run lint 0 errores; bunx tsc --noEmit 0 errores en mis 4 archivos; dev.log compila y sirve 200.

Stage Summary:
- Combate: knockback físico suave (fxcore) en jugador/enemigos/Ilwen, ventana de combo real (1.2 s), REMATE potenciado sobre quebrados, ondas y slams del jefe empujan, impactos cargados desplazan.
- Ilwen: arco elemental cíclico, sistema de MARCA (+60% daño focalizado), técnica combinada «Lluvia de estrellas» gated por afinidad (crece combatiendo y con tu tono), y FIX crítico: sus flechas ahora dañan enemigos (antes fuego amigo / inútiles).
- Jefe: banner cinematográfico en su despertar + flash/shake/slowmo en cambios de fase.
- Narrativa: sistema de tono con consecuencias (apodos y trato de Brisa/Toln/Ilwen), 3 memorias del Portador encadenadas al progreso (nana vía Eco, casa vía Bosque post-Eco, madre vía Guardián), reputación de 4 facciones viva en diálogos, 3 NPC nuevos (Doran, Heraldo de Vesh, Teo), 3 ecos menores nuevos y easter egg de Nimue.
- Para el integrador: nuevas acciones de hooks ('memory_<id>', 'rep_<faccion>_<±n>', 'eco_taken_mem', 'flag_<clave>') documentadas en hooks.ts; usarlas en cualquier diálogo futuro. g.flags.tonoDominante contiene un string en runtime (cast documentado).
- Notas para 3-a: sprites/portraits que faltan por crear: 'doran' (mundo+retrato), 'teo' (mundo+retrato), 'kael' (retrato del Heraldo; su sprite de mundo uso 'sombra'), icono de MARCADO (e.marked) sobre enemigos. render/screens aún no dibujan memoryReveal/bossBanner/flashT (los decae el motor). sprites.ts a medio refactor en paralelo: mientras tanto update.ts ya no importa SOLID_CHARS (usa g.tileSolidAt, método público del motor, semántica idéntica).
- Errores preexistentes vistos en archivos congelados/ajenos (NO tocados): engine.ts redeclara VIEW_W/VIEW_H/ZOOM (línea 1209 vs 18-19), render.ts(316) usa e.dispName sin estrechar Entity, sprites.ts WIP de 3-a sin exportar aún SOLID_CHARS/TILE/drawTile/drawTallTile (engine.ts falla igual, se reconciliará al terminar 3-a).

---
Task ID: 3
Agent: Super Z (agente principal) + agentes 3-a y 3-b
Task: Mejora integral de la demo con 2 agentes en paralelo: animaciones/visuales (3-a), mecánicas/funciones/contenido (3-b), integración y QA (principal). Alineado con la biblia de la historia proporcionada por el usuario.

Work Log:
- Contrato compartido (Task 3-0): types.ts (ToneKind, tones/memories/repFacciones, kbVx/kbVy, marked, comboT), fxcore.ts congelado (shake/flash/slowmo/knockback), hooks.ts, integración en engine.ts (applyAction default→hooks, recordDialogueTone, decaimientos de feedback en el bucle, serialización compatible), MEMORIES en data.ts.
- Agente 3-b (mecánicas) COMPLETÓ: hooks.ts completo (memory_<id>, rep_<faccion>_<n>, eco_taken_mem, flag_<k>), tono dominante con +1 afinidad; combate: knockback suave por elemento, ventana de combo, REMATE sobre quebrados (WeakSet), Ilwen con flechas elementales cíclicas + MARCA + «Lluvia de estrellas» (afinidad ≥20, cd 24s), jefe con banner y flash/slowmo por fase; FIX: flechas de Ilwen iban a rama enemiga y Ilwen era invisible (flags.q2_done); contenido: opciones de tono en 6 diálogos, variantes por tono (Listillo/alma/claridad), 3 NPC nuevos (Doran Círculo Verde, Heraldo de Vesh «el recipiente», Teo), 3 ecos menores nuevos, easter egg Nimue (cartel needPast).
- Agente 3-a (visuales) murió por timeout a mitad del refactor de sprites.ts (perdió exports TILE/SOLID_CHARS/drawTile/drawTallTile) PERO completó: ciclos de andar humanoides (drawHumanFrame/layout), paletas y retratos de 9 personajes nuevos (sasha/brokk/maelis/corvin/kael/inquisidor/teo/doran/nimue) + drawPortrait con fallback, drawSlashArc, fx.ts (partículas ambientales por mapa, estelas de esquiva, bannerInfo, memoryAlpha), render (flash, overlay de memoria tipo vitral con marca de onda, banner de jefe con temblor, iconos de estado con marcado, ping de santuarios en minimapa), screens (título con niebla/notas/estrellas, Estado con «Velmora te observa» [tono/memorias/facciones], Diario con memorias y teasers, final con memorias), audio (sfx break/memory/banner/whoosh + default seguro).
- Integración (principal): restaurada sección de tiles desde git HEAD; corregidos reexport VIEW_W/H/ZOOM en engine.ts (conflicto tsc), export TRAIL_LIFE en fx.ts, cast de chargedHit y dispName en render.ts, guards hairS en retratos; loopError ahora guarda stack.
- FIX de UI detectado en navegador: las opciones de diálogo solapaban el texto del nodo → drawDialogue recalcula altura de caja según líneas totales y opciones (box crece, opciones bajo el texto).
- Verificación E2E con agent-browser: título → creación (DOM) → intro → juego (HUD/retrato/partículas/minimapa); diálogo Brisa con 4 tonos visibles sin solape y contador empatico:1; overlay Memoria I y II (watcher automático en bosque); banner GUARDIÁN HUECO; pausa Estado (tono/memorias 1/3/facciones) y Diario (memoria desbloqueada + teasers); combate real: arcos de slash, daño, muerte/respawn, REMATE confirmado (doble golpe 18+18); apodo sarcástico «Listillo» en Toln; NPC Teo y Heraldo con retratos; noche con luna/estrellas/luz radial; Bosque pasado/presente y Cripta sin errores de bucle. Un error transitorio drawImage tras loadMap por consola no fue reproducible tras la integración (loopError con stack quedó instrumentado).
- Final: lint 0, tsc 0 (src), dev.log compila y sirve 200.

Stage Summary:
- Demo mejorada: sistema de Tono con apodos, 3 Memorias del Portador con overlay vitral, reputación de 4 facciones, REMATE, knockback suave, Ilwen elemental con Lluvia de Estrellas, banner de jefe, 3 NPC nuevos de la biblia, 9 sprites/retratos nuevos, partículas ambientales por mapa, ciclo día/noche con luna/estrellas, sfx nuevos, título y menús pulidos.
- Contrato de extensión documentado en hooks.ts para futuro contenido (Actos II-IV).

---
Task ID: 4
Agent: Super Z (agente principal)
Task: Corregir bug reportado por el usuario: "al entrar a la cripta se queda en negro" (pantalla negra en la Cripta de Aelthar).

Work Log:
- Reproducido con agent-browser: nueva partida → fadeTo('cripta',19,30) → pantalla negra total (solo HUD/minimapa). Sin loopError (el render no lanzaba excepción).
- Descartadas causas: groundCanvas con contenido (muestreo de píxeles OK), ctx.filter soportado y funcional (blit con/sin filtro verificado leyendo píxeles), drawWorld alcanzado (niebla/estrellas sí se dibujaban).
- CAUSA RAÍZ (preexistente desde Task 1, latente): drawLighting rellenaba la pantalla con color de oscuridad OPACO y recortaba los "agujeros de luz" con destination-out SOBRE EL CANVAS PRINCIPAL → borraba los píxeles del mundo dibujado (mundo+entidades), dejando ver el fondo CSS de la página (#06070f, casi negro). En la cripta (darkness=0.8 constante) era 100% negro; de noche en exteriores (darkness>0.02) también ocultaba el mundo (captura histórica shot_cryptdoor.png del QA original ya lo mostraba en Bosque-presente nocturno; pasó desapercibido porque la mayoría del QA fue diurno).
- FIX en render.ts (drawLighting): capa de oscuridad en canvas offscreen (getLightCanvas, singleton perezoso VIEW_W×VIEW_H). Secuencia: clear → fillRect con globalAlpha=darkness (0.62 noche / 0.8 cripta con parpadeo) → destination-out para el gradiente del Portador (r 130 cripta / 170 exterior, 0.95 centro) y de santuarios (pulso) sobre SOLO la capa → componer con drawImage sobre el mundo → tintes posteriores intactos (púrpura cripta / azul noche / cálido amanecer).
- Verificación E2E: cripta muestra suelo, muros, esqueletos, cofres, eco y círculo de luz del jugador (shot_cripta_fixed.png); noche de Lunaris con tinte azul, luna, estrellas, santuario iluminado y mundo visible (shot_lunaris_noche_fixed.png); combate en cripta con telegrafías, daño flotante, banner GUARDIÁN HUECO, barra de jefe y santuario brillando (shot_cripta_combate.png); loopError=null en todo el recorrido.
- Lint 0 errores; tsc: 0 errores en src/ del juego (los restantes son de examples/ y skills/ de la plantilla, preexistentes y ajenos).

Stage Summary:
- Bug de pantalla negra corregido de raíz para TODAS las capas de oscuridad: cripta, noches de Lunaris/Bosque y futuros mapas oscuros. La técnica de capa offscreen es la estándar (oscuridad con agujeros de luz compuesta sobre el mundo) y desbloquea el paso del Bosque → Cripta → Guardián Hueco.
- Capturas de verificación en scripts/shot_cripta_fixed.png, shot_lunaris_noche_fixed.png, shot_cripta_combate.png.

---
Task ID: 5
Agent: Super Z (agente principal)
Task: Corregir el bucle cripta↔bosque (P0-1 del informe de 30 agentes + reporte del usuario) + quick-wins asociados y push a GitHub.

Work Log:
- CONFIRMADO el softlock: la salida de la cripta aterriza en bosque (10,3) = tile 'A' (altar SÓLIDO) DENTRO de la zona de salida bosque→cripta (x:8..12, y:2..3) → ping-pong de teletransporte con autoguardado en cada ciclo.
- FIX P0-1 (3 capas):
  1. maps.ts: destino de la salida cripta→bosque cambiado (10,3)→(10,5) — tile libre bajo la puerta (x=9..11,y=4) y fuera de toda zona de salida.
  2. engine.ts loadMap: findSafeTile() — búsqueda por anillos que rechaza tiles sólidos Y dentro de zonas de salida (inExitZone); nunca se aterriza en un muro ni en un teletransporte.
  3. engine.ts/update.ts: exitCd=0.9 tras loadMap, decae en update y las zonas de salida se ignoran mientras exitCd>0 (defensa extra anti-bucle).
- FIX rescate de saves atrapados: continueGame sobreescribía la posición segura de loadMap con las coords crudas del save → ahora solo restaura la posición fina si su tile es seguro (ni sólido ni en zona de salida). Un save del bucle (bosque, altar 10,3) ahora aterriza en (9,4) y queda estable.
- FIX save corrupto (P1): continueGame valida forma (player/x/y/map) con try/catch; si está dañado lo borra, avisa con toast y no deja el juego muerto.
- FIX transición fantasma (P1): setState limpia pendingMap al salir de play/dialogue (Esc durante un fade ya no teletransporta ni reescribe el autoguardado).
- FIX teclas pegadas (P1): blur/visibilitychange limpian keys y botones de ratón (onLoseFocus), con limpieza en dispose().
- FIX nombre con espacios (P1): onKeyDown ya no hace preventDefault cuando el target es un INPUT/TEXTAREA.
- Verificación E2E (agent-browser): (19,31) reubicado a (18,30) por la defensa; salida cripta→bosque aterriza en (10,5) estable sin re-teletransporte; vuelta bosque→cripta aterriza en (19,30); save atrapado rescatado a (9,4) estable; loopError=null en todo el recorrido.
- P0-2 (flechas de Ilwen) y q2_done: YA corregidos en Task 3-b (update.ts pr.from!=='enemy' + watcher); el informe de los 30 agentes revisó el commit 71d290e (anterior a Task 3) y varios hallazgos están desactualizados.
- P0-4: tsconfig excluye examples/skills/scripts (scaffold de plantilla) → `bun run typecheck` (nuevo script) en verde para todo el proyecto; eliminado typescript.ignoreBuildErrors de next.config.ts (el build vuelve a validar tipos).
- README.md reescrito: controles reales (clic izq atacar, clic der parada, Espacio esquiva, 1-4 skills, F poción, Q época, Shift+T alba, Esc/M pausa), Node ≥20.9, novedades v0.2.1 y estructura actual (13 módulos).
- Push a GitHub: sincronizado staging (.zpackage/ecos-de-aelthar) con el proyecto actual, commit 123b8ee "v0.2.1: ..." → main de Ruby570bocadito/ecos-de-aelthar (verificado via API: 13 módulos en src/game). Lint 0, typecheck 0, dev server 200.

Stage Summary:
- Bucle cripta↔bosque roto a 3 niveles (destino seguro + findSafeTile + exitCd) y rescate de saves atrapados; fixes rápidos de save corrupto, transición fantasma, teclas pegadas y nombre con espacios.
- El repo privado quedó en v0.2.1 (123b8ee) con README honesto y typecheck exigente en build.
- Pendiente (backlog del informe): controles táctiles móviles (P0-3), persistencia de volúmenes, fórmulas de ESTADO desde fuente única, rebalance de jefe/quemado, poda de scaffold, OG/SEO, CI.
- Recordatorio reiterado: revocar/rotar el PAT ghp_... (sigue activo a fecha de este push).

---
Task ID: 6
Agent: Super Z (agente principal)
Task: Segunda tanda de fixes del informe de 30 agentes (P1 de jugabilidad) + push.

Work Log:
- P1 crash: startAttack/startParry/drinkPotion/useSkill/castSkill/aimAtMouse con guard `if (!this.player) return` — el clic derecho en título ya no lanza TypeError (verificado: state=title, playerNull=true, err=null).
- P1 esquiva en cadena: detección de borde — keydown ' ' en play encola rollQueued solo si la acción es posible (rollT/attackT/sta válidos), update la consume; mantener Espacio ya no encadena i-frames (verificado: tap → 1 voltereta; mantener 0,6 s → no se relanza).
- P1 quemado infinito: los estados se REFRESCAN en vez de apilarse (quemado: t cap 6 s, power cap 8; congelado: t cap 5). Verificado: 3 impactos de fuego → 1 status, t=6, power=8.
- P1 exploit del jefe: loadMap memoriza bossHp en flags al salir de la cripta con el Guardián vivo y lo restaura al volver (se limpia al derrotarlo). Verificado: 250/300 → salir → volver → sigue 250/300.
- P1 muro por cambio de época: epochSwitch recoloca al Portador con findSafeTile si el nuevo presente/pasado trae un tile sólido hasta su posición (toast informativo).
- P1 pantalla de muerte mentía: playerDied guarda lastGoldLost y drawDead lo muestra (40 coronas → dice 20, no 10). Verificado.
- P1 ESTADO duplicaba fórmula: ahora importa playerMeleeDmg del motor (fuente única); nota: ATTR_INFO de vigor ya era correcta en el código actual (maxHp+=7 y reducción vig*0.01 existen) — hallazgo obsoleto del informe.
- P1 volúmenes: sliders persisten en localStorage 'ecos-vol' y el constructor los restaura (verificado: 0.2/0.2 sobreviven reload).
- P2 título: v0.1 → v0.2.1.
- P1 animación de lobo/guardián clavada: el informe era contra el commit 71d290e; el entityFrame actual ya cicla correctamente los 2 frames (mod min(2,n)) — sin acción.
- Typecheck 0, lint 0. Push 2949fe7 a main (verificado via API).

Stage Summary:
- 8 fixes de jugabilidad del informe aplicados y verificados E2E; repo en 2949fe7.
- Quedan del backlog: controles táctiles móviles (P0-3), contenido narrativo muerto (voz_vesh/voz_guardian/brisa_end), rebalance jefe/quiebre, poda de scaffold, OG/SEO/CI.

---
Task ID: 7-c
Agent: general-purpose (música+fx)
Task: R1-c — Música y FX ambiente para los 3 biomas nuevos (Costa de Bruma, Aldea de Merrow, Las Cumbres). Solo toqué src/game/audio.ts y src/game/fx.ts.

Work Log:
- Leído worklog.md (Task 1: motor de audio; Task 3-a: fx.ts) y los dos archivos completos antes de escribir. types.ts ya tenía el contrato extendido (TrackName/MapId += 'costa'|'aldea'|'cumbres'); tsc fallaba pidiendo las 3 pistas nuevas.

A) audio.ts (379→495 líneas):
- 3 Patterns nuevos con la firma EXACTA de los existentes (bpm/lead/bass/pad + tipos de osc + gains + drums de 32 chars; verificado por script que lead/bass tienen 32 entradas y drums 32 caracteres en TODAS las pistas):
  - COSTA (92 bpm, mixolidio en Sol): arpegios triangle que suben y bajan como olas (G-B-D-G-F-D / A-C-E-A / B-D-F-B / C-E-G-E), bajo sine profundo G1/C2/A1 con "vaivén" G1↔G2, pad cálido G-C-Am-F-G, espuma = hats de ruido agudo dispersos de forma irregular (canal drums). Melancólica y amplia.
  - ALDEA (58 bpm, Re menor, caja de música rota): melodía sine con HUECOS (compases casi vacíos y pasos silenciosos donde debería haber nota), frases que responden como ecos tardíos, bajo mínimo (una nota cada 2 compases: D-G-Bb-A), pad sine largo. Drums = 2 clics de mecanismo por loop (solo respiran en combate). La más melancólica del juego.
  - CUMBRES (76 bpm, pentatónica fría de La m): notas-campana sine muy espaciadas (el envelope exponencial del motor las hace tintinear; el pad a dur*15.5 hace de campana grave con su quinta), bajo sine con bajada de lamento A1-G1-F1-E1, drums = destellos de hielo casi imperceptibles. Sensación de altura y silencio inmenso.
- Capa de combate adaptativa VERIFICADA GENÉRICA: el mecanismo (drumGain → target 1 en combate / 0.55 fuera, 1 siempre en boss) opera sobre pat.drums de CUALQUIER pista de TRACKS, no hay lógica por-nombre para las nuevas → costa/aldea/cumbres la heredan sin cambios (las 3 tienen drums). Comentario documentado junto a setCombat.
- 5 SFX nuevos al switch (estilo sTone/sNoise existente): 'splash' (lowpass 1500→260 + 2 burbujas sine), 'song' (3 tonos sine largos con vibrato REAL vía LFO — nuevo helper privado sSongTone(f0,dur,gain,delay,vib) — + brillo de agua highpass), 'gust' (bandpass barrido 400→2000 Hz, 0.5 s), 'lamp' (triangle cálido 196→524 + chispa highpass), 'wraith' (aliento highpass 6200→8200 muy suave + tono fantasmal descendente 880→240 con detune de 50 cents).
- Switch de sfx SIN default (según protocolo): nombres desconocidos = no-op seguro por diseño; comentario documentado en el propio switch (sustituye el default seguro que añadiera 3-a, misma garantía).
- FIX menor en mi archivo: drums de VILLAGE tenía 31 chars (off-by-one preexistente) → deriva de 1 paso de la batería vs melodía de 32; ahora 32 chars ('h...k...h...k...h...k...h.s.k...').

B) fx.ts (403→487 líneas):
- 5 tipos nuevos al pool: SEAMIST(6) bruma salina (motas grandes blanco-azuladas #cfe0f2, vx oeste constante -9..-14, ondulación en y con sin en el dibujo, vida larga 7-10.5 s, alpha 0.14 semitransparente, doble pompa), FOAM(7) espuma (chispas blancas cerca del suelo, vida corta 0.5-0.9 s, estallan en 2-3 destellos discretos por strobe sin(t·9..14)), MEMORA(8) (motas doradas pálidas que suben MUY lento, pulso de alpha al morir — "los nombres que flotan" — y alpha global reducida de noche), SNOW(9) (copos blancos tamaño variado, vy caída lenta constante 13-23, vx = sin(t·0.9+seed)·(7..18) fijado cada frame → ventisca determinista), WISPFRIO(10) (wisps azul-hielo erráticos lentos cerca del suelo, pariente frío del CRYPTWISP).
- Selección por mapId con coherencia día/noche (isNight ya importado): costa → FOAM 42% día / 16% noche (de noche menos espuma, más bruma); aldea → MEMORA 85% + ASH 15% (duelo de Merrow); cumbres → SNOW 80% día / 70% noche (de noche algo más de wisps).
- AMB_CAP 90 → 110 (dentro del máximo autorizado 120; la ventisca necesita más ranuras). Rates por mapa: costa 13/s, aldea 8/s (nostalgia quieta), cumbres 17/s (ventisca densa); con vidas medias ajustadas el pool no se satura (estimado ~65 costa, ~68 aldea, ~99 cumbres activos) y los mixes no se ahogan entre sí.
- Polvo de pasos por bioma: el paso del Portador consulta tileAt(g.map, g.rows, p.x/TILE, p.y/TILE, g.epoch) (imports de solo lectura: tileAt de maps.ts, TILE de sprites.ts); sobre 'S' (nieve) o 's' (arena) levanta un soplo blanco que flota (rgba(240,246,255), grav 16, deriva horizontal) en vez del polvo marrón.
- drawAmbient y updateAmbient: cases nuevos añadidos a ambos switches (sin tocar los existentes); Niebla del Bosque, cielo/estrellas/luna y feedback (banner/memoria) intactos.

Verificación:
- bunx tsc --noEmit → 0 errores en audio.ts y fx.ts (grep audio|fx vacío). Único error del proyecto: maps.ts(234) Record<MapId,MapDef> sin costa/aldea/cumbres — archivo del agente de mapas en paralelo, IGNORADO según protocolo (desaparecerá cuando registre los 3 mapas).
- bun run lint → sin errores ni warnings.
- Verificación estructural por script (bun): 8 claves en TRACKS, 32 pasos en lead/bass de las 8 pistas, drums de 32 chars en las 8, pads 8 (BOSS 4 por diseño, preexistente).
- NO se ejecutó dev server ni navegador (protocolo).

Notas para el equipo:
- Agente de mapas: al definir los 3 MapDef, usar music: 'costa' | 'aldea' | 'cumbres' (ya resuelven en TRACKS); tiles 'S'/'s' activan automáticamente el soplo blanco de pasos.
- Wiring de sfx disponible para quien integre eventos: 'splash' (pisar agua/barcos), 'song' (sirena/enemigo sirena), 'gust' (ráfaga, telegraph 'ventisca'), 'lamp' (props kind 'lamp'), 'wraith' (espectro).
- audio.sfx sin default: cualquier nombre futuro desconocido es no-op seguro (intencional, documentado en el switch).

Stage Summary:
- 3 pistas chiptune nuevas (costa/aldea/cumbres) con identidad propia dentro de la disciplina Pattern existente, capa de combate adaptativa funcionando de forma genérica, 5 SFX ambientales nuevos con síntesis 100% procedural, y partículas ambientales completas para los 3 biomas (bruma/espuma, memoras, ventisca/wisps fríos) con variación día/noche y polvo de pasos por bioma. tsc y lint en verde para mis archivos.

---
Task ID: 7-a
Agent: general-purpose (mapas) [informe escrito por el integrador: el agente completó el trabajo pero superó el límite de tiempo antes de reportar]
Task: Crear los 3 mapas nuevos del Acto II (Costa de Bruma, Aldea de Merrow, Cumbres Heladas) y cablearlos al mundo.

Work Log:
- Creado src/game/maps_expansion.ts (422 líneas) con EXPANSION_MAPS: costa (52×40, arena 's', mar, muelle 'B', wreck, faro, NPCs mara/vult, 4 neumos + 2 espectros + JEFA sirena zone boss), aldea (44×34, ruinas de Merrow, 3 lamp needPast, NPC mera, 4 espectros needPresent + 2 neumos, diffs de época presente-ruina/pasado-vivo), cumbres (50×42, nieve 'S', hielo 'i', NPC ivo, 3 arpías + 2 lobos + 1 espectro + JEFE golem).
- maps.ts: BASE_MAPS + export const MAPS = { ...BASE_MAPS, ...EXPANSION_MAPS }; abertura sur de lunaris (exit x:25,y:36 → costa 26,2) y abertura este de bosque (exit x:54,y:6 → cumbres 25,39); carteles nuevos.
- Exits inversos: costa→lunaris y costa→aldea; aldea→costa; cumbres→bosque (24,40 → bosque 51,7).

Stage Summary:
- 6 conexiones entre mapas verificadas E2E por el integrador: lunaris↔costa, costa↔aldea, bosque↔cumbres; todos los aterrizajes en tile transitable y fuera de zonas de salida (lección softlock).

---
Task ID: 7-b
Agent: general-purpose (enemigos+sprites) [informe escrito por el integrador: mismo caso de timeout]
Task: 5 enemigos nuevos con IA propia + sprites/proyectiles/props/tiles de la expansión.

Work Log:
- sprites_expansion.ts (867 líneas): initExpansionSprites registra neumo/espectro/arpi/sirena(32px)/golem(32px) + proyectiles orb/shard/nota; drawExpansionTile (s/S/i + suelos por bioma), drawExpansionTallTile (palmera costa, pinos nevados), drawExpansionProp (wreck/faro/lamp), drawExpansionProjectile.
- enemies_expansion.ts (953 líneas): expansionTick(g,e,dt,def) → cerebro completo por tipo: neumo tirador que mantiene distancia y escupe 'orb'; espectro flotante con invulT 0.9 tras golpe (intangible) y lunge; arpi orbital con picado en dash; SIRENA 3 fases (salvas en abanico con telegraph aro, invocación de neumos, teleport-splash fase 2, anillo radial fase 3, banner propio); GOLEM 2 fases (slam + onda, lanzas de hielo, ventisca de 4 telegraphs, embestida), quiebre/aturdido replicando al Guardián.

Stage Summary:
- Verificado E2E: sirena aggro con proyectiles+telegrafías+banner+barra; golem presente en cumbres; espectros solo en presente de aldea; sprites nuevos visibles y animados.

---
Task ID: 7-c
Agent: general-purpose (música+fx)
Task: 3 pistas chiptune nuevas + SFX + partículas ambientales de los 3 biomas.

Work Log:
- audio.ts: TRACKS costa (92bpm mixolidio olas), aldea (58bpm Re menor caja de música rota), cumbres (76bpm pentatónica campanas); capa de combate genérica heredada; SFX splash/song/gust/lamp/wraith; fix off-by-one drums de village (31→32).
- fx.ts: partículas SEAMIST/FOAM (costa), MEMORA (aldea), SNOW/WISPFRIO (cumbres) con variación día/noche; polvo de pasos blanco en nieve/arena; AMB_CAP 90→110.

Stage Summary:
- tsc/lint verdes; las 8 pistas verificadas estructuralmente (32 pasos).

---
Task ID: 7-int
Agent: Super Z (agente principal)
Task: Contrato de expansión + integración de la Ronda 1 + verificación E2E.

Work Log:
- CONTRATO (propio): types.ts (MapId/EnemyType/TrackName ampliados, SpawnDef.needPast/needPresent, PropKind wreck/faro/lamp, telegraphKind salva/ventisca, Enemy.subT/invulT); data.ts (QUESTS q6-q10 del Acto II, ENEMY_DEFS de 5 enemigos, MEMORIES mem_faro/mem_invierno, KEY_ITEMS ecoMareas/ecoCumbres/ecoNombres); sprites.ts registerSpr().
- INTEGRACIÓN: engine.ts (spawnEnemies con epoch+jefes genérico via BOSS_DEFEAT_FLAG; makeEnemy tamaños jefe; minimapa s/S/i; buildGround delega en drawExpansionTile/TallTile; damageEnemy respeta invulT con 'intangible'; killEnemy de sirena/golem con toasts+music+questAdvance; tryTakeEco por mapa con dynNodes eco_mareas/eco_cumbres y acciones eco_*_taken que conceden memoria IV/V; loadMap memoria de jefe generalizada bossHp_<mapId>; visited costa/aldea/cumbres avanzan misiones; lightLamp con watcher 3 faroles → q8). update.ts (expansionTick dispatch para los 5 tipos + decaimiento invulT; activación de jefe generalizada por spawns zone:'boss' con toasts propios). render.ts (drawProps → drawExpansionProp para wreck/faro/lamp; altarEcho generalizado por id con colores propios; proyectiles orb/shard/nota → drawExpansionProjectile; shimmer de intangibilidad; barra de jefe generalizada ENEMY_DEFS[etype] + FASE x/maxPhase).
- E2E (agent-browser): 3 mapas visitados con enemigos/NPCs/props correctos; sirena: aggro, banner 'SIRENA ABISAL', barra generalizada, proyectiles y telegrafías activas, loopError=null; aldea presente 4 espectros vs pasado 0 (needPresent ok); 6 viajes entre mapas OK con aterrizajes seguros; fix barra de jefe hardcodeada al Guardián (crash drawImage era residuo de HMR, no reproducible tras reload con instrumentación de drawImage).
- Capturas: scripts/shot_r1_costa.png, shot_r1_costa_sur.png, shot_r1_sirena.png, shot_r1_aldea_pasado.png, shot_r1_cumbres.png.

Stage Summary:
- Acto II jugable de punta a punta: Lunaris→Costa (Sirena)→Merrow (faroles/época)→Bosque→Cumbres (Gólem). tsc 0, lint 0. Ronda 2 lista: historia/diálogos (data+hooks), motor/misiones (engine), animaciones de combate (update+fx).

---
Task ID: 8-b
Agent: general-purpose (motor-misiones)
Task: R2-b — Cableado en el MOTOR (src/game/engine.ts, único archivo tocado) de la aceptación/finalización de las misiones q6-q10 del Acto II. data.ts/hooks.ts NO se tocaron (los edita el agente 8-a en paralelo).

Work Log:
- applyAction: 5 casos nuevos siguiendo EXACTO el patrón accept_q2..5 — 'accept_q6' (questIdx=5, step=0, flags.q6, toast 'Nueva misión: El Rumor del Mar'), 'accept_q7' (La Sirena sin Canto), 'accept_q8' (La Aldea que Olvidó su Nombre), 'accept_q9' (La Cumbre del Segundo Canto), 'accept_q10' (Dos Voces más Fuertes); todos con sfx 'quest' y toast #8ef0b0. Quedan a la espera de que los nodos de diálogo de 8-a (data.ts) los disparen vía action/onEnd.
- q5→q6: talkTo('brisa') — si questIdx===4 && questStep===0 ejecuta questAdvance() ANTES de resolver el nodo, de modo que q5 ('Regresa con la Anciana Brisa', 1 paso) se complete al hablar y getDialogue reciba la misión nueva (questIdx 5).
- Watcher q7 paso 0→1 (O(1) por frame): vive en Game.update() justo tras updateGame (update.ts es de otro agente y no se tocó). Condición: bossActive && bossRef?.etype==='sirena' && questIdx===6 && questStep===0 && !flags.sirenaSeen → flags.sirenaSeen=true + questAdvance() + toast 'La Sirena te ha visto...' (#8ef0ff). DECISIÓN DOCUMENTADA: se eligió el disparo por ACTIVACIÓN DEL JEFE (bossActive se enciende al acercarte al naufragio, dist<190, con su propio toast/sfx 'song') en lugar de medir distancia al prop 'wreck' — más simple, sin lookup de props y reutiliza la activación existente de Task 7-int; la flag sirenaSeen impide repeticiones y se serializa sola en el guardado.
- questAdvance(): toast generalizado — al CAMBIAR de misión (no de paso) ahora canta `Nueva misión: ${QUESTS[this.questIdx].name}` en vez del hardcodeado 'Ecos de Esperanza' de q4→q5. Beneficio inmediato: eco_mareas_taken (q7→q8) y eco_cumbres_taken (q9→q10) ya anuncian su misión nueva. Guard questIdx!==prev para que el clamp en la última misión (q10) no repita el toast. sfx 'quest' se mantiene.
- end_demo: funciona igual que antes (endStats/pantalla 'end' intactas — screens.ts no se tocó); añadido: si se dispara con questIdx>=9, toast 'Fin del Acto II' antes de setState('end'). Nota honesta: el overlay 'end' pinta un fondo opaco por encima de los toasts, así que el aviso queda registrado en g.toasts (y en el código) pero puede no llegar a leerse en pantalla; no se tocó screens.ts por protocolo (ronda 4).
- Autoguardado: verificado sin cambios — save() serializa {...this.flags} y continueGame los restaura; las flags nuevas (q6..q10, sirenaSeen) son boolean y entran solas en el Record. SaveData intacto.
- ROBUSTEZ multi-agente: openDialogue ahora valida el nodo resuelto; si no existe (dynNodes/DIALOGUES) hace fallback seguro a 'brisa_idle' con console.warn '[EcosAelthar] Nodo de diálogo inexistente: ...' — evita diálogo que no abre / estados raros si 8-a y este agente se desincronizan (NPCs nuevos mara/vult/mera/ivo, nodos next/onEnd aún no escritos). Guard con key!=='brisa_idle' para excluir recursión.
- NADA MÁS: killEnemy sirena/golem (q7/q9), visited costa/aldea/cumbres (q6/q8/q9), lightLamp 3 faroles (q8), tryTakeEco por mapa, jefes con memoria bossHp_<mapId> — todo lo cableado en Task 7-int queda intacto. Sin refactorizaciones extra.

Verificación:
- bunx tsc --noEmit → 0 errores en engine.ts (y 0 en todo el proyecto en este momento).
- bun run lint → sin errores ni warnings.
- No se ejecutó navegador (protocolo).

Notas para el agente 8-a (coordinación de routing en getDialogue/data.ts):
- ESPERA 1: questIdx 4→5. El motor completa q5 al hablar con Brisa (questAdvance antes de resolver), así que getDialogue recibirá questIdx===5 && questStep===0 && !flags.q6 en el primer habla post-Guardián: sirve allí un nodo narrativo cuyo onEnd sea 'accept_q6'. Por robustez conviene servirlo TAMBIÉN con questIdx===4 (saves raros/desync): accept_q6 es idempotente. Efecto secundario aceptado: en el camino normal puede haber 2 toasts iguales de 'Nueva misión: El Rumor del Mar' (uno del questAdvance del motor, otro del accept_q6) — redundancia inocua que garantiza el avance aunque una de las dos mitades falle.
- ESPERA 2: questIdx 9 (q10 'Regresa con la Anciana Brisa a Lunaris') → nodo tipo brisa_final2 cuyo onEnd sea 'end_demo' (el motor ya añade el toast 'Fin del Acto II' cuando questIdx>=9). El actual fallback de getDialogue (q>=4 → brisa_final con end_demo manual) sigue funcionando mientras tanto.
- ESPERA 3: NPCs mara/vult/mera/ivo — si getDialogue devuelve una clave cuyo nodo aún no exista, openDialogue cae a 'brisa_idle' con console.warn (sin pantallas negras).
- Recordatorio: q6 (paso 'Habla con Mara') y q8 (paso 'Habla con la Espectro de Merrow') completan su transición vía los accept_q7/accept_q9 que 8-a cuelgue de esos nodos (el motor ya no hace nada más ahí); los pasos de viaje los avanzan los watchers existentes de loadMap.

Stage Summary:
- Misiones q6-q10 cableadas en el motor (aceptación, q5→q6 por habla con Brisa, watcher de aggro de la Sirena para q7), toast de nueva misión generalizado en questAdvance, 'Fin del Acto II' en end_demo, y fallback seguro de diálogo contra desyncs. tsc 0 y lint 0. Falta solo que 8-a enchufe los nodos de diálogo que disparan accept_q6..q10 (contrato documentado arriba).

---
Task ID: 8-c
Agent: general-purpose (animaciones-combate)
Task: R2-c — Más animaciones a los personajes y a los ataques: capa de feedback de combate que se SIENTE. Solo toqué src/game/update.ts y src/game/fx.ts.

Work Log:
- Leído worklog.md (3-b combate, 7-c fx.ts, 7-int integración) y los archivos del contrato antes de escribir. Verificado que el golpe melee del jugador vive en engine.releaseCharge (CONGELADO) → todo el hooking se hace desde update.ts por observación de estado público (hitFlash/hitStop/attackT), sin tocar el motor.

A) fx.ts (+62 líneas, sección nueva "FX de combate"):
- export combatSparks(g,x,y,dirX,dirY,color,n=6,power=70): cono de chispas con spread angular ±~49°, grav 60, vida 0.2-0.35 s, tamaño 1-2.5, directo al pool g.particles (mismo patrón que el polvo de pasos; render ya las pinta — cero draws nuevos).
- export dodgeRing(g,x,y): 9 partículas #cfe0f2 en anillo achatado (vista cenital) que se abren y se posan — el soplo de la voltereta.
- export critGlint(g,x,y): 3 destellos dorados grandes (#ffe86a/#ffd24a) tamaños decrecientes con vida escalonada → sensación de expansión en críticos.
- drawAmbient/updateAmbient/pool ambiental intactos (solo comentario de cabecera actualizado).

B) update.ts (+56 líneas netas):
- EMBESTIDA DE ATAQUE: en el bloque attackStarted (golpe recién liberado) applyKnockback(p, dir, 62 / 88 cargado) — el peso del tajo empuja al Portador un paso; stepKnockback ya corre para el jugador y mueve con g.moveEntity (respeta tiles, mismo patrón que las ondas del jefe). Excluido en rollT>0.
- CHISPAS DE IMPACTO DIRECCIONALES: updateCombatFx(g) detecta golpes conectados por el borde ASCENDENTE de e.hitFlash (damageEnemy pone 0.12; mismo patrón que enemies_expansion.commonTick, sin tocar engine). 5 chispas opuestas al swing; color por arma: acero #f5f2ea normal / #ffe86a cargado, y por elemento si el golpe fue de skill (quemado→#ff9040, congelado→#a0e8ff). Corre ANTES del bucle de enemigos (hitFlash sin decaer).
- CRÍTICO: g.hitStop>0.05 (motor: 0.09 crítico vs 0.04 normal) → critGlint dorado. Engancha también críticos de skill/proyectil gratis.
- Anti-duplicado: WeakMap fxOwnFx con token de frame — los impactos que ya sueltan FX propio (impacto de proyectil, REMATE) se marcan y el detector los salta.
- SOPLO DE ESQUIVA: dodgeRing al iniciar roll (junto al 'dodge').
- REMATE: ahora además 6 chispas doradas opuestas al swing + critGlint (encima del float/shake/slowmo que ya existía).
- ESTELAS de proyectiles nuevos: en el loop de proyectiles, sprites 'orb' (marea #8ef0ff), 'shard' (escarcha #a8d8ff) y 'nota' (canto #ffe9a0) sueltan soplo fino sin grav, vida 0.25 s (gate 0.6/frame, más barato que 1/frame en la fase 3 de la sirena con 11 notas vivas); el resto de proyectiles enemigos conserva su estela púrpura y los aliados la suya.
- NOTAS DE SIRENA: al morir una 'nota' (pared o Portador) ascienden 3 destellos musicales #b8a0f0.
- ILWEN: micro-recoil de cuerda de arco (3 chispas #e8d8a0 opuestas al disparo) en cada flecha y un solo golpe de cuerda (4 chispas) por ráfaga de «Lluvia de estrellas».
- ARPI (picado): SKIP por protocolo — su IA vive en enemies_expansion.ts (congelado para esta ronda).

Rendimiento:
- Todo son partículas del pool g.particles (nada de allocations por frame fuera del pool, nada nuevo en render.ts). Peor caso razonable: ~100-150 partículas de combate vivas un instante (sirena fase 3) con vida ≤0.55 s. Sin timers/estados nuevos por frame salvo dos WeakMap (GC por enemigo, ya patrón del módulo).

Verificación:
- bunx tsc --noEmit → 0 errores en todo el proyecto (grep update|fx.ts vacío).
- bun run lint → 0 errores.
- bun build (bundle browser de update.ts) → resuelve el grafo completo (el ciclo fx↔update por isNight ya existía y es seguro: uso solo dentro de funciones).

Notas para el equipo:
- Si el integrador quiere chispas en más eventos, la firma es combatSparks(g,x,y,dirX,dirY,color,n,power) — pasar la dirección OPUESTA al swing para el rebote de impactos.
- g.hitStop>0.05 es el detector de crítico disponible sin tocar engine (0.09 vs 0.04); válido también para futuros agentes de FX.

Stage Summary:
- El combate ahora se siente: cada golpe embiste, chispea en dirección del tajo (dorado si cargado, elemental si skill), los críticos destellan, la esquiva sopla un anillo, el REMATE revienta en chispas doradas, los proyectiles del Acto II dejan estela propia (marea/escarcha/canto) y las notas de la sirena mueren en destellos musicales; Ilwen retrocede un suspiro con cada flecha. tsc y lint en verde, cero toques a archivos congelados.

---
Task ID: 8-a
Agent: general-purpose (historia-diálogos)
Task: R2-a — Historia y diálogos del Acto II (NPCs Mara/Vult/Mera/Ivo, Ecos de las Mareas/Cumbres, encadenado Brisa Acto I→II y nuevo final). Solo toqué src/game/data.ts y src/game/hooks.ts.

Work Log:
- Leído worklog (Tasks 7-a/7-b/7-c/7-int) y los contratos reales del motor antes de escribir: engine.talkTo (líneas 702-711) AVANZA q5→q6 antes de resolver el nodo — comentario que coordina explícitamente con el agente 8-a: «con questIdx 5 debe servir el nodo cuyo onEnd es accept_q6; con questIdx 9, el nodo final del Acto II». El routing responde a ese contrato.
- data.ts — NODOS NUEVOS (36) en español, tono melancólico-poético (biblia brisa/doran/eco_voz):
  - MARA (farera, retrato maelis): mara_intro (faro 300 años apagado, «el mar guarda las notas que el dios no pudo cantar», action 'mara_met'), mara_sirena («cuando canta, los pescados suben a oírla y no vuelven»), mara_sarc/mara_amenaz (reacciones de tono), mara_idle + variantes mara_idle_emp/mara_idle_sarc, mara_react (tras sirenaDefeated: enciende el faro, action 'mara_gift', 3 opciones de tono → mara_react_emp/_prag/_sarc), mara_faro (idle post-regalo).
  - VULT (cartógrafo de la Liga, retrato corvin): vult_intro («los mapas sin nombres venden caros en la Ciudadela», recelo a la Orden, action 'flag_metVult'), opciones con rep_liga_5 (pragmático) y rep_orden_-5 (amenazante), lore del gremio (vult_gremio) y de Merrow (vult_merrow: «terreno no restituido», la "curación" de la Orden), vult_sarc/vult_amenaz, vult_idle + vult_idle_prag.
  - MERA (Espectro de Merrow, retrato nimue): mera_intro (anciana que olvida su nombre, action 'flag_metMera'), mera_pidetarea («cada farol guarda un nombre que la Niebla se llevó; enciéndelos y devuélveme el mío»), mera_sarc, mera_wait/mera_wait1/mera_wait2 (cuenta cuántos faroles faltan según flags lamp1..3), mera_grateful (recupera su nombre «Nera», entrega el Eco de los Nombres, onEnd 'mera_eco', 3 tonos → mera_grat_emp/_prag/_sarc), mera_idle.
  - IVO (cazador de cumbres, retrato brokk): ivo_intro (gruñón bondadoso, «la montaña se levantó cuando el canto murió y lleva 300 años esperando a que alguien le cante de vuelta», action 'flag_metIvo', rep_circulo_5 en la opción empática), ivo_consejo (tips anti-arpías: esperar el picado, fuego), ivo_golem (consejo del quiebre), ivo_sarc/ivo_amenaz, ivo_idle + ivo_idle_emp, ivo_after (tras golemDefeated).
  - ECOS: eco_mareas y eco_cumbres en D (sustituyen al dynNode de respaldo del motor; onEnd CONTRACTUAL intacto: 'eco_mareas_taken'/'eco_cumbres_taken') con 3 opciones de tono cada uno → eco_mareas_emp/_prag/_sarc y eco_cumbres_emp/_prag/_sarc (tienden puentes a mem_faro/mem_invierno y al Heraldo: «la Ciudadela también oye tu melodía»).
  - BRISA: brisa_final YA NO ofrece end_demo (opción 1 → brisa_acto2); brisa_acto2 (onEnd 'accept_q6', 3 tonos) y brisa_acto2b (despedida, guiño a la taza de mem_casa); NUEVO FINAL brisa_final2 (texto literal del Acto II: «tres Ecos de siete... la Ciudadela también oye tu melodía ahora», onEnd 'acto2_report') con opciones { 'Iré a por el cuarto Eco. (Terminar la demo)', action 'end_demo' } y { 'Aún no...', next 'brisa_stay' }; end_demo queda SOLO en brisa_final2 (+brisa_end preexistente, no alcanzable por routing). brisa_idle/brisa_idle_emp/brisa_idle_amenaz reescritos para el Acto II (siguen sirviendo tras demoEnded).
- data.ts — ROUTING getDialogue (firma intacta): brisa por questIdx (q3 guardianDefeated → brisa_final; q4 respaldo; q5 s0 → brisa_final/oferta — engine.talkTo ya avanzó q5→q6; q>=9 → brisa_final2, y brisa_idle tras flags.acto2Done; q5-q8 en curso → idle por tono). NPCS NUEVOS: mara (sirenaDefeated → mara_react/mara_faro por flags.maraGift; q===5 → mara_intro; resto → mara_idle por tono), vult (metVult → vult_idle/vult_idle_prag), mera (ecoNombres → mera_idle; lamp1..3 cuentan 0/1/2/3 → mera_wait/mera_wait1/mera_wait2/mera_grateful; metMera → waits; si no → mera_intro), ivo (golemDefeated → ivo_after; metIvo → ivo_idle/ivo_idle_emp). Sin Math.random.
- hooks.ts — 5 acciones nuevas documentadas en el comentario CONVENCIONES (mantengo memory_*, rep_*, eco_taken_mem, flag_*):
  - accept_q6: acepta q6 (toast 'Nueva misión: El Rumor del Mar'); coordinado con engine.talkTo (que ya avanza q5→q6): normalmente solo activa flags.q6; la rama questIdx<5 auto-repara aceptaciones anticipadas (brisa_final en q4) o saves antiguos. Idempotente.
  - mara_met: completa el objetivo de q6 (índice 5, paso 1) → questAdvance + toast q7.
  - mara_gift: una vez (flag maraGift): +2 pociones, sfx 'potion', rep_circulo_5 vía g.applyAction, toast dorado.
  - mera_eco: flags.ecoNombres=true, +1 punto, sfx 'echo', burst dorado (g.burst en el Portador), toast dorado; si q8 (índice 7, paso 2) → questAdvance + toast q9.
  - acto2_report: cierra q10 (flag acto2Done, una vez): sfx 'quest', rep_guardianes_5, toast 'Misión completada'.
- Descubrimiento de coordinación importante: questProgressText/lightLamp/killEnemy/tryTakeEco/eco_*_taken del motor YA avanzaban q7/q8/q9; los pasos que quedaban huérfanos (hablar con Mara en q6, el Eco de los Nombres, el informe q10) quedan cubiertos desde hooks, sin tocar archivos congelados.
- Verificación (protocolo, sin navegador): bunx tsc --noEmit | grep "data|hooks" → vacío (0 errores en el proyecto completo); bun run lint → 0; script estructural (bun): los 36 nodos nuevos sin 'next' roto, todas las acciones referenciadas existen (motor o hooks), onEnd contractuales intactos, y 19 casos de routing simulados (brisa q0..q9±flags, mara/vult/mera/ivo con todas sus flags) devuelven el nodo esperado.

Notas para el equipo:
- Agente de motor (ronda 2): si añades toast de progreso para q8 (faroles X/3 en pantalla de misión), el conteo es flags.lamp1..3 (getDialogue de mera ya lo usa). Los flags de contenido nuevos son: metVult, metMera, metIvo (via flag_*), maraGift, ecoNombres, acto2Done, q6.
- Las cadenas de tono de los nuevos NPCs alimentan recordDialogueTone → rasgo dominante; brisa_acto2 y mara_react son los puntos con más peso de tono del Acto II.

Stage Summary:
- Acto II narrativamente completo y cableado: 4 NPCs nuevos con intro/idle/variantes de tono, 2 Ecos mayores con onEnd contractual y Eco menor de los Nombres, encadenado Brisa Acto I→II (aceptar el sur) y nuevo final del Acto II con end_demo; 5 acciones nuevas en hooks con avance de misión q6/q8/q10 cubierto. tsc 0, lint 0, verificación estructural y de routing en verde.

---
Task ID: 8-int
Agent: Super Z (agente principal)
Task: Integración y verificación E2E de la Ronda 2 (historia/motor/combate).

Work Log:
- Verificados 8-a (36 nodos diálogo Mara/Vult/Mera/Ivo + eco_mareas/eco_cumbres + Acto II de Brisa + acciones hooks mara_met/mara_gift/mera_eco/acto2_report), 8-b (accept_q6..q10, q5→q6 en talkTo brisa, watcher sirenaSeen, questAdvance genérico, fallback openDialogue), 8-c (lunge, chispas direccionales, anillo de esquiva, estelas orb/shard/nota, recoil de Ilwen, combatSparks/dodgeRing/critGlint).
- FIX integrador: el avance de objetivo de viaje (costa/aldea/cumbres) era one-shot por flag visited → si el jugador pisaba el mapa antes de aceptar la misión, el paso quedaba bloqueado. Ahora es idempotente por estado de misión (engine loadMap).
- E2E: Mara 4 tonos → q6 completa (visita idempotente) → q7 aceptada; 3 faroles → paso 2 → Mera agradecida → Eco de los Nombres (+1 punto) → q9; combate Sirena: 4 proyectiles, 31 partículas de estelas, loopError null; tsc 0, lint 0.

Stage Summary:
- Cadena de misiones del Acto II completa y verificada de punta a punta. Ronda 3 lista: profundidad de jefes + hielo resbaladizo (update/enemies_expansion), poses de ataque (sprites), ambiente por bioma (render).

---
Task ID: 9-c
Agent: general-purpose (ambiente-visual)
Task: R3-c — Ambiente visual del mundo: personalidad cromática por bioma, agua viva, poses de ataque (contrato 9-b), viñeta de peligro y pulido de luz. Solo toqué src/game/render.ts.

Work Log:
- Leído worklog (Task 4: iluminación offscreen — técnica intacta; 7-c: partículas por bioma; 7-int: wiring de expansión) y render.ts completo antes de editar.

A) TINTES POR BIOMA (nueva drawBiomeTint, llamada en drawWorld tras drawAmbient('world') y ANTES de drawLighting — el orden de capas se respeta y el hueco de luz del Portador de Task 4 no se toca). Switch por g.mapId: lunaris/bosque/cripta sin cambios:
  - costa: dorado-salino cálido rgba(240,224,176) alpha 0.07·(1-noche); con dayT atardece y aparece azul marino profundo rgba(24,48,92) hasta alpha 0.14. + HORIZONTE DE BRUMA (drawSeaMist): banda gradiente vertical blanco-azulada anclada a la orilla (0.82·h del mapa en coords de mundo → solo aparece cuando el mar está a la vista), ondula con sin(globalT·0.5)±8px y su alpha respira 0.10–0.18.
  - aldea presente: gris-lavanda melancólico rgba(138,138,160) alpha 0.10 + viñeta radial propia rgba(6,6,16,0.30) más densa; aldea pasado: dorado-festival rgba(255,233,192) alpha 0.08 y SIN viñeta extra — el contraste presente/pasado se siente al cambiar de época.
  - cumbres: azul-hielo rgba(184,216,240) alpha 0.10 + 4 destellos de ventisca: líneas diagonales blancas (ctx.rotate(-0.32)) que barren la pantalla, alpha 0.05–0.09 con sin(globalT·0.9+i·1.7), velocidad y offset deterministas por índice.

B) AGUA VIVA (nueva drawWaterGlints, tras el blit del suelo y bajo entidades/props): para cada tile '~' del viewport (costa y también la laguna de la aldea, mismo gate por mapId), 1 píxel blanco 2×1 (más un segundo en ~45% de tiles) con alpha 0.10–0.25 según sin(globalT·1.6 + hash2(tx,ty)·2π); posición ondula con seno/coseno y offsets por hash2 (determinista). Usa tileAt(map, rows, tx, ty, epoch) importado de maps.ts (sin ciclo). Solo tiles visibles, cero asignaciones por frame (~200-300 fillRects peor caso en la playa).

C) POSES DE ATAQUE (contrato 9-b): en drawEntity, si e es el jugador y p.attackT>0 → SPRITES consultado por namespace con optional-call (getAttackFrames?/getCastFrames?: compila aunque 9-b aún no las publique; fallback = frame de andar actual, nunca rompe). dur = chargedHit?0.4:0.26 (igual que el arco slash); attackT>dur/2 → frame[0] anticipación, si no frame[1] golpe. Tejedor prefiere getCastFrames con fallback a attack. Dibuja EN LUGAR del sprite normal con el mismo flip/dx/dy (contrato: mismo tamaño que frames de andar). El arco slash y el resto de indicadores siguen igual.

D) VIÑETA DE PELIGRO: refinada a la especificación — solo estado 'play', hp<30%: gradiente radial transparente→rgba(180,40,40, 0.18+0.06·sin(globalT·5)) en los bordes (antes no filtraba estado y su fórmula dependía de la severidad).

E) PULIDO DE LUZ (cripta): flicker ahora 0.8 + 0.02·sin(t·7) + 0.015·sin(t·13) (dos senos superpuestos, respiración más orgánica). Aura del santuario en mapas oscuros: radio pulsante 26→30 (28+sin(t·2)·2); en mapas claros queda en 26 como antes. La capa offscreen de oscuridad/destination-out NO se tocó.

Verificación:
- bunx tsc --noEmit → 0 errores en TODO el proyecto (incluye render.ts y los módulos nuevos importados).
- bun run lint → sin errores ni warnings.
- Revisión de orden de capas: suelo → agua viva → props/entidades → FX/partículas → tinte de bioma → iluminación offscreen → cielo → textos/HUD/overlays (HUD, banner, memoria, dead intactos).
- Sin texto nuevo → nada que localizar. Sin allocations por frame en los caminos nuevos (solo strings de color, igual que el resto del render).
- NO navegador (protocolo).

Notas para 9-b (sprites): el contrato ya está consumido en render.ts:488-531 aprox (bloque poseCv). Basta con que exportes getAttackFrames(baseName, dir) y getCastFrames(baseName, dir) devolviendo [frameAnticipación, frameGolpe] (2 canvas, tamaño de los frames de andar) o null — se activarán sin ningún cambio adicional en render.

Stage Summary:
- Cada bioma del Acto II tiene personalidad cromática propia (costa dorada→marina con horizonte de bruma, Merrow en duelo lavanda vs festival dorado, cumbres heladas con ventisca), el mar y la laguna brillan con especulares animados, el Portador tiene poses de anticipación/golpe listas para cuando 9-b publique los frames, la cripta respira con dos senos y el santuario empuja su aura. tsc y lint en verde; técnica de iluminación offscreen de Task 4 intacta.

---
Task ID: 9-a
Agent: general-purpose (jefes-mundo)
Task: R3-a — Profundidad de jefes (Sirena Abisal, Gólem de Escarcha) + mecánica de mundo nueva (HIELO RESBALADIZO) + arpías en pandilla + neumo agónico. Solo toqué src/game/enemies_expansion.ts y src/game/update.ts.

Work Log:
- Leído worklog (7-b cerebros, 7-int contrato, 8-c FX de combate) y verificado el contrato real antes de escribir: fxcore (addShake/addFlash/requestSlowmo), fx.ts (combatSparks/critGlint), killEnemy/damageEnemy del motor (llaman killEnemy SÍNCRONAMENTE al hp<=0 → el chequeo de muerte fiable es el e.dead del bucle de enemigos de update.ts, ANTES del filter), tileAt(map,rows,tx,ty,epoch) de maps.ts + g.map/g.rows/g.epoch públicos, y entidad x,y = CENTRO (pies = y + h/2, verificado en boxFree/makePlayer).

A) SIRENA ABISAL (enemies_expansion.ts, brain 7-b pulido a nivel guardianBrain):
- FASE 2 — MAREA BAJA: cada 9 s (m.mareaT) suelta 2 Shockwaves desde su posición (dmg 10, maxR 80, speed 200, hit:false — la 2ª con r=12 desfasada = doble cresta) + addShake(4) + sfx('splash'). El daño lo aplica el bucle de ondas del motor (una vez por cresta, con empujón). Entre salvas, strafe orbital elegante: la banda 100-150 px ahora orbita (orbitDir con inversión ocasional aleatoria) en vez de la deriva sinusoidal; fase 3 mantiene su órbita cerrada 60-100 px.
- FASE 3 — CANTO DEL ABISMO telegrafiado: al iniciar el canto planta un anillo 'aro' GRANDE (r=70 · maxT=1.0, render rojo ya existente) centrado en ELLA y sincroniza windup=1.0 → las 8 notas del estallido radial salen cuando el anillo se cierra. Tras el estallido: addFlash('#8ef0ff') + requestSlowmo(0.15) (en fireNotas, rama Canto). Además AHORA invoca neumos en fase 3: cada 15 s, cap 3 vivos (summonNeumo parametrizado por fase: cap 2→3, cadencia 12/10→15).
- ATURDIDA (quiebre roto): en commonTick, mientras ai==='aturdido' suelta 2 partículas/frame de notas liberadas (#ffe9a0, suben, grav 0) — se ve que el canto la rompe. El bookkeeping REMATE (wasAturdido/finisherUsed de update.ts) queda intacto.
- MUERTE: guarda hp<=0 al inicio de tickSirena + enganche expansionDeathFx en el bucle de enemigos de update.ts (ve e.dead el primer frame, antes del filter g.enemies). Única vez (WeakSet deathFxVisto): 12 partículas #8ef0ff en espiral (radial+tangencial+ascenso) + requestSlowmo(0.3). El motor ya pone sirenaDefeated/toasts — sin tocar.
- MOVIMIENTO: distancia mínima 50 px — tras el switch, si el Portador se cuela bajo su guardia (y no está en 'carga'), retroceso suave moveDir(0.85·speed) alejándose. Nunca entra en sólidos (moveEntity ya lo garantiza).

B) GÓLEM DE ESCARCHA (enemies_expansion.ts):
- FASE 1 — PIZCA DE HIELO: al expirar el telegraph del slam (mismo punto donde salta la onda visual) m.frostT=1.0 → durante 1 s caen 4 partículas/frame de escarcha alrededor (#a8d8ff, grav 300, vida ≤0.45 s).
- FASE 2 — VENTISCA PREDICTIVA: los 4 telegraphs 'aro' ahora son 2 sobre la posición ACTUAL del Portador y 2 sobre su posición futura estimada (pos + velocidad real · 0.5 s, tope ±60 px). La velocidad la mide update.ts (getPortadorVel, ver C) — castiga correr en línea recta. La embestida deja SURCO DE HIELO: 6 partículas blancas por frame durante el dash (sustituye al copo aleatorio suelto).
- NUEVA — CORAZÓN DE HIELO (fase 2, cada 11 s, m.corazonT): el núcleo brilla (telegraph 'slam' centrado en él r=30 · 0.7 s) y lanza 6 'shard' en anillo radial (speed 120, dmg 12) + sfx('ice'). Igual que la ventisca, no arranca durante 'carga'.
- ATURDIDO: en commonTick, 2 partículas/frame de cristales rotos (#cfe8ff, caen, grav 260).
- MUERTE: mismo enganche que la sirena — onda de nieve: 20 copos blancos radiales + addShake(8).

C) MUNDO (update.ts):
- HIELO RESBALADIZO (Acto II): al caminar sobre tile 'i' (lago helado de cumbres, detectado con tileAt(g.map, g.rows, ⌊x/TILE⌋, ⌊(y+h/2)/TILE⌋, g.epoch) — importado de maps.ts, solo lectura) el movimiento conserva inercia: con input, la velocidad de deslizamiento persigue la objetivo con aceleración reducida (×0.55 → factor 1−0.55^(dt·60)); sin input, mantiene la última velocidad con decaimiento 0.90^(dt·60) hasta <5 px/s. Semilla: al pisar hielo parte de la velocidad real del frame anterior (no hay frenazo al entrar). NUNCA con rollT>0 (rama separada) ni knockback activo (kbVx/kbVy ≠ 0 → rama normal). El control en tiles no helados queda 1:1 idéntico (la memoria de hielo se resetea al salir). Documentado en el código con el comentario "HIELO RESBALADIZO (Acto II, 9-a)".
- Velocidad real del Portador: update.ts mide desplazamiento/dt cada frame (módulo, export getPortadorVel()) — la consumen la semilla del hielo y la ventisca del gólem. Teleportes (salto >160 px) → 0, tope 240 px/s. Ciclo nuevo update↔enemies_expansion (getPortadorVel): seguro, uso solo dentro de funciones — mismo patrón ya verificado del ciclo fx↔update por isNight (Task 8-c); comprobado con smoke en bun + bun build browser del grafo completo (0.36 MB, resuelve).
- ARPIES EN PANDILLA: lastDiveT a nivel de módulo (g.globalT del último picado iniciado). En persigue, si st>=2.5 (ciclo propio) O otra arpi picó hace <0.4 s —y está en rango 30-150 px—, picado inmediato y actualiza lastDiveT. Los windup de 0.35 s hacen que la bandada caiga casi a la vez sobre el Portador.
- NEUMO AGÓNICO: con hp<35%, el escupitajo salen 3 'orb' en abanico de ±15° (0.2618 rad) en vez de 1 — aplica a todos los neumos (simple, como pide la ronda).
- MUERTE DE JEFES: el bucle de enemigos llama expansionDeathFx(g,e) para sirena/golem con e.dead ANTES del filter (ver A/B).

Rendimiento:
- Todo por el pool g.particles/g.waves/g.telegraphs — cero allocations nuevas por frame salvo las partículas de siempre (objetos pequeños del pool del motor). Peor caso por instante: ~90-110 partículas vivas (surco de hielo/escarcha con vida ≤0.45 s, notas de aturdimiento ≤0.55 s), coherente con el techo declarado en 8-c. Timers nuevos solo en ExpMem (WeakMap, ya patrón del módulo) + 3 variables de módulo en update.ts + lastDiveT + 1 WeakSet de muerte. tileAt: 1 llamada/frame (jugador). Nada nuevo en render.ts (los telegraphs 'aro' ya pintan rojo, las ondas ya existen).

Verificación:
- bunx tsc --noEmit 2>&1 | grep -E "enemies_expansion|update" → vacío (0 errores en todo el proyecto).
- bun run lint → 0 errores.
- Smoke estructural en bun: el grafo con el ciclo update↔enemies_expansion importa, exports presentes (updateGame/getPortadorVel/expansionTick/expansionDeathFx), vel inicial 0 y curva de deslizamiento simulada (74 px/s → 0.1 px/s tras 1 s de decaimiento 0.90^frame). bun build browser de update.ts → resuelve completo.
- Sin navegador (protocolo).

Notas para el equipo:
- Los sfx usados ya existían (splash/ice/gust/whoosh/holy/banner/roar): audio.sfx no-op seguro si alguno faltara.
- El Canto del Abismo en fase 3 daña DOS veces si te quedas pegado: el aro r=70 al estallar (vía motor) + las 8 notas — es intencional (telegrafía de 1.0 s para salir).
- expansionDeathFx es el punto de enganche exportado si el integrador quiere enganchar más FX de muerte de jefes futuros.

Stage Summary:
- La Sirena orbita, marea, telegrafía su Canto con un anillo rojo de 1 segundo, rompe su canto en notas cuando la quiebras y muere en una espiral de marea con cámara lenta; el Gólem llueve escarcha tras cada slam, predice tu carrera con la ventisca, deja surco de hielo al embestir, expulsa su CORAZÓN DE HIELO cada 11 s y se derrite en una onda de nieve. Las arpías cazan en bandada sincronizada, los neumos agonizan escupiendo abanicos y el lago helado de las Cumbres ahora te desliza: el Acto II se siente vivo. tsc 0, lint 0, solo enemies_expansion.ts + update.ts tocados.

---
Task ID: 9-b
Agent: general-purpose (sprites-personajes) [informe del integrador: el agente completó el código y fue detenido antes de reportar]
Task: Poses de ataque/lanzamiento por dirección para personajes + armas por paleta.

Work Log:
- sprites.ts (+430 líneas): WEAPONS por personaje (alba espada roja-plateada, tejedor bastón dorado, toln martillo, ilwen arco, kael espada Orden, brisa/doran bastones); getAttackFrames(base,dir) y getCastFrames(base,dir) lazy-cacheados (contrato con 9-c: [anticipación, golpe], laterales mirando a derecha, null seguro); poses para 7 personajes; paletas merrow_h/merrow_m reservadas; px con recorte defensivo.
- Verificación del integrador: tsc 0 errores en src/game; lint 0.

Stage Summary:
- El render (9-c) ya consume las poses con optional-call; el jugador ahora muestra anticipación+golpe al atacar y concentración+liberación al lanzar Cantos.

---
Task ID: 9-int
Agent: Super Z (agente principal)
Task: Integración y verificación E2E de la Ronda 3.

Work Log:
- 9-a (jefes+mundo): Marea Baja F2 de la Sirena (ondas dobles), Canto del Abismo F3 telegrafiado con anillo r=70, strafe orbital, invocación F3, FX de aturdido/muerte (espiral + slowmo); Gólem: Ventisca predictiva con getPortadorVel (2 aros sobre posición futura), Corazón de Hielo (6 shards radiales cada 11s), surcos de embestida; HIELO RESBALADIZO en cumbres (inercia 0.90^(dt·60), aceleración ×0.55, nunca en roll/knockback); arpías en pandilla (picado sincronizado <0.4s); neumo agónico (3 orbes hp<35%).
- 9-b (sprites): getAttackFrames/getCastFrames lazy-cacheados, poses anticipación+golpe para 7 personajes, armas por paleta (espada/bastón/martillo/arco), cast solo tejedor, paletas merrow reservadas. Código completado antes de ser detenido; worklog añadido por el integrador.
- 9-c (render): tintes por bioma (costa dorada→azul nocturna, aldea gris-lavanda vs dorado-festival en pasado, cumbres azul-hielo + rayas de ventisca), brillos especulares animados en agua (~ con hash2), poses de ataque en drawEntity con fallback seguro, viñeta roja hp<30%, flicker de cripta orgánico (dos senos), aura de santuario mayor en mapas oscuros.
- E2E: capturas shot_r3_cumbres.png (lago helado translúcido + ventisca + tinte) y shot_r3_ataque.png (mar con reflejos, naufragio, combate Sirena); HIELO verificado con teclado real: al soltar D, el Portador desliza 5.9px adicionales sobre tile 'i'; tsc 0, lint 0.

Stage Summary:
- Los 3 biomas nuevos tienen identidad visual y física propia; los jefes tienen mecánicas memorables; el combate muestra poses y feedback. Ronda 4 lista: HUD/pantallas (screens+ui), balance (data+engine+maps_expansion), audio adaptativo (audio+fx).

---
Task ID: 10-a
Agent: general-purpose (hud-pantallas)
Task: R4-a — HUD y pantallas actualizadas al Acto II. Solo toqué src/game/screens.ts y src/game/ui.ts (engine/render/data CONGELADOS).

Work Log:
- Leído worklog (Task 1 pantallas, 3-a Diario, 7-int/8-int/9-int estado Acto II) y verificados los contratos reales antes de editar: QUESTS re-exportado por engine.ts:1502 (screens ya lo importaba), MEMORIES ahora con 5 entradas, KEY_ITEMS con ecoMareas/ecoCumbres/ecoNombres, flags del motor (ecoVoz/ecoMareas/ecoCumbres/ecoNombres/fragmentTouched/lamp1..3), endStats de 3 líneas y questProgressText().
- DIARIO (pausa, pestaña 2): la cadena se divide en actos — cabecera 'CADENA PRINCIPAL · ACTO I' (q1-q5) y sub-cabecera nueva '◆ ACTO II · LAS NOTAS PERDIDAS' insertada antes de q6 (i===5, leída de QUESTS sin hardcodear nombres), en color misión cuando questIdx>=5 y atenuada antes. Misiones con ✔/◆/· como antes y la ACTIVA muestra su paso (wrap ampliado 30→42 caracteres, 2 líneas máximo en la práctica). NUEVOS teasers de zona (const ZONE_TEASERS, textos literales de la ronda: «Costa de Bruma — el mar guarda las notas», «Merrow — la aldea que olvidó su nombre», «Cumbres Heladas — el frío que aprendió a escuchar») como rumores atenuados SOLO bajo misiones futuras (i>questIdx): al activarse la misión el paso real los sustituye y al completarla callan — altura de la columna acotada en todo momento (peor caso 429px < 453px de las líneas de stats del pie; sin solapes).
- DIARIO — columna de memorias: verificadas dinámicas (itera Object.keys(MEMORIES) → las 5 del Acto II entran solas; el contador X/5 de ESTADO también). BUG de layout corregido de propina: con 5 memorias el reparto antiguo por espacio restante apilaba títulos por debajo del panel (títulos a y>490 con panel terminando en 505). Nuevo reparto compacto y uniforme: máx 3 líneas de texto por recuerdo (wrap 50→58 chars, ellipsis en el corte) con paso 15/13px — 5 memorias desbloqueadas terminan en y≈467, dentro del panel; el texto íntegro sigue visible en el overlay de memoria (render, congelado). LOCKED_HINT completado con mem_faro y mem_invierno (caían al texto genérico).
- EQUIPO: 'OBJETOS CLAVE' era hardcodeado a fragmentTouched/ecoVoz → ahora lista dinámica sobre flags (const KEY_ITEM_FLAGS: flag→clave de KEY_ITEMS, en orden de obtención): los Ecos de las Mareas/Cumbres y el Eco menor de los Nombres aparecen al poseerse. Espaciado compactado 42→34px/objeto para que 5 objetos + bloque FACCIÓN + compañera quepan en el panel (peor caso: companion termina en y≈488 < 505). Facciones de ESTADO intactas (ya visibles).
- FINAL de demo: línea nueva 'Ecos recuperados: X de 7' contando flags ecoVoz/ecoMareas/ecoCumbres (solo lectura), tras 'Memorias recuperadas: X/5'; el panel crece solo (panelH derivado de lines.length, 5 líneas → base en y=374, cita en 396 sin solape). El título ahora refleja el acto: questIdx>=9 → 'TRES NOTAS COMPLETAS' (antes el toast 'Fin del Acto II' del motor quedaba tapado por el overlay; ahora el final del Acto II se ve), Acto I mantiene 'PRIMERA NOTA COMPLETA'. La línea de cierre 'Los otros seis Ecos...' es dinámica con número en letra (NUM_ES): 'Los otros cuatro Ecos aguardan en Velmora...' al cerrar el Acto II con 3 de 7.
- TÍTULO: versión v0.2.1 → v0.3.0 y listado de zonas actualizado ('v0.3.0 · Lunaris — Bosque — Cripta — Costa de Bruma — Merrow — Cumbres Heladas'); subtítulo 'Demo jugable · Acto II incluido'.
- ui.ts: export counterDots(g, x, y, total, done, color=COL.gold, pitch=6) — dibuja 'total' puntos de 2px, los primeros 'done' rellenos con color y el resto apagados rgba(154,160,184,0.35); determinista, sin estado, para trackers visuales futuros (faroles 0/3, Ecos). Exportado y NO cableado todavía (según encargo). panel()/bar() ya soportaban colores y text()/textShadow() ya tenían sombra → sin cambios.

Verificación:
- bunx tsc --noEmit 2>&1 | grep -E "screens|ui\.ts" → vacío (0 errores en todo el proyecto).
- bun run lint (eslint .) → 0 errores, 0 warnings.
- bun build --target=browser de screens.ts (0.38 MB) y ui.ts (3.48 KB) → el grafo resuelve y counterDots aparece en los exports del bundle.
- Simulación aritmética de peores casos de layout (questIdx 0/5/7/9, 0 y 5 objetos clave, 0 y 5 memorias): ninguna línea supera el panel de pausa (505) ni pisa las stats del pie (453/473). No navegador (protocolo).

Notas para el equipo:
- counterDots está lista para el integrador del HUD: p.ej. counterDots(g, x, y, 3, (flags.lamp1?1:0)+(flags.lamp2?1:0)+(flags.lamp3?1:0), COL.quest) junto al paso de q8, o counterDots(..., 7, ecos, COL.goldSoft) en ESTADO.
- KEY_ITEM_FLAGS y ZONE_TEASERS son las únicas tablas de presentación nuevas: un objeto clave/zona del Acto III se añade añadiendo su entrada allí (las listas de render ya son dinámicas sobre flags/QUESTS/MEMORIES).

Stage Summary:
- Las pantallas respiran el Acto II: el Diario separa los dos actos con sus misiones y susurra los rumores de Costa de Bruma, Merrow y Cumbres Heladas; las 5 memorias entran en columna sin desbordar el panel (bug de apilamiento con 5 corregido); el Equipo lista dinámicamente los 5 objetos clave incluidos los 3 Ecos nuevos; el final canta 'TRES NOTAS COMPLETAS' con 'Ecos recuperados: X de 7' y los Ecos que aún faltan; el título es v0.3.0 con 'Acto II incluido'. ui.ts estrena counterDots para futuros trackers. tsc 0, lint 0, solo screens.ts + ui.ts tocados.

---
Task ID: 10-c
Agent: general-purpose (audio-fx)
Task: R4-c — Audio adaptativo y pulido de FX. SOLO src/game/audio.ts y src/game/fx.ts.

Work Log:
- Leído worklog (7-c pistas/SFX/partículas, 7-int wiring, 8-c FX combate, 9-a jefes/hielo) y los 2 archivos completos antes de editar.

A) audio.ts (495→575 líneas):
- AUDITORÍA SFX (script bun sobre update.ts/engine.ts/enemies_expansion.ts/hooks.ts/screens.ts): 40 nombres usados, 40 cases definidos → 0 faltan ('splash/song/gust/lamp/wraith' de 7-c TODOS existían), 0 cases muertos. Nota: engine.ts:1242 interpola por elemento y solo emite 'fire'/'ice'/'bolt' (los literales 'fuego'/'hielo' ahí son Element, no SFX). Lista completa usada/definida DOCUMENTADA en comentario sobre el switch; switch sigue SIN default (no-op seguro por diseño).
- TAMBOR DE TENSIÓN (combate más vivo sin romper lo existente): en scheduleStep, si combatOn && cur!=='boss' (y la pista tiene drums — title queda fuera por no tener canal), en PASOS PARES fuerza un kick suave con tensionKick(t, 0.15·tensionGain) — sine 150→48 Hz, decay 0.1 s (~30% del volumen del kick principal). NUNCA dobla: se salta los pasos donde la batería del patrón ya tiene 'k'. Reversible: fundido propio tensionGain (lerp 0.03/paso) → 0 al salir de combate; playTrack lo resetea. Pulso resultante: 0.31–0.52 s según bpm (aldea 0.517 s ≈ el 0.5 s pedido); verificado con sim bun (boss=0 hits, title sin drums → sin tensión ni transpose).
- MICRO-VARIACIÓN DE PISTA: playTrack YA tenía guard (this.cur===name → return, no reinicia; verificado y documentado en comentario). Añadido: loopNo = floor(step/32) en el scheduler; en tracks de MAPA (no boss/title), cuando loopNo%4===2 la MELODÍA (lead) sube +1 semitono (SEMI_UP=2^(1/12)) durante ESE loop y revierte sola al siguiente — sin estado que restaurar, bajo/pad anclados (color armónico nuevo sin romper el tema). Coste: 1 comparación + 1 multiplicación por nota. Implementado con riesgo bajo: el secuenciador ya computa el loop absoluto.

B) fx.ts (599→695 líneas):
- POLVO DE PASOS por bioma (B2): el tile ahora se muestrea bajo los PIES (y+h/2, convención 9-a; antes centro — al empujar contra muro por arriba leía tile equivocado). 's' arena costa → soplo DORADO pálido #f0e0b0, partículas mayores (size 2.3, vida 0.36 s); 'S' nieve → soplo blanco intacto (7-c); 'i' hielo cumbres → RASPA chispas azul-blanco #dff0fa horizontales cortas (vx ±34-74 dominante, vy ±3, grav 0, vida 0.2 s, dir aleatoria); resto → polvo marrón clásico.
- BRUMA DEL FARO (B4): el faro está encendido cuando su flag de prop está activa — ASÍ lo lee render.ts:282 (drawExpansionProp(..., !!g.flags[pr.id])). Id real greppado: 'faro_co' (x:6,y:18, maps_expansion.ts). Implementación genérica: en updateAmbient (costa), for-of sobre g.map.props buscando kind==='faro' && g.flags[pr.id] (lookup sin allocations, ~12 props). Si la LINTERNA (centro del prop a -34 px, como la dibuja sprites_expansion) está en encuadre ±48: 3 motas/s (faroAcc) al pool como FAROBEAM(11) — vx/vy=0, posición orbital f(t,seed) al DIBUJAR: radio 9→59 px sobre vida 1.5-2.6 s, ángulo = globalT·0.35 + fase (misma velocidad angular que el haz cónico del sprite), trazo alargado orientado a la TANGENTE del giro (#fff3c8, alpha ≤0.34, +25% de noche vía isNight). Cull barato: al salir la linterna de encuadre, el check de posición del pool las desactiva.
- RENDIMIENTO (B5): pool AMB_CAP 110→120 (máximo autorizado por 7-c; headroom para ~6-8 motas del faro; costa estimada ~71 activas). Cero allocations por frame nuevas (lookup find devuelve slot existente; si pool lleno, faroAcc se clampa a 1 — sin ráfaga diferida). Los 4 spawns de polvo son pushes al pool g.particles igual que antes.
- SKIPs DOCUMENTADOS (en cabecera del archivo): B1 mortandad de memoras al encender farol y B3 impacto de proyectil en agua — requieren hooks en engine.ts/update.ts (CONGELADOS ronda 4); no existe punto de enganche limpio desde fx.ts.

Reglas respetadas: sin cambios en firmas exportadas (audio.sfx/setCombat/playTrack; combatSparks/dodgeRing/critGlint/bannerInfo/memoryAlpha/fxFrame/updateAmbient/drawAmbient/getRollTrail/TRAIL_LIFE); sin llamadas nuevas desde módulos congelados; imports nuevos solo de types.ts (PropDef, sin ciclo).

Verificación:
- bunx tsc --noEmit 2>&1 | grep -E "audio|fx\.ts" → vacío (0 errores en todo el proyecto).
- bun run lint → 0 errores, 0 warnings.
- bun build browser de fx.ts y audio.ts → grafos resuelven (0.38 MB / 21.6 KB).
- Sim bun de la lógica del secuenciador: transpose solo en loop%4===2 de tracks de mapa; tensión 0 en boss/title, pulsos 0.31-0.52 s en los 6 tracks de mapa con drums (aldea ≈0.5 s). Auditoría SFX cruzada por script (40/40).
- NO navegador (protocolo).

Notas para el equipo:
- El tambor de tensión es aditivo y autónomo: si un futuro agente cambia setCombat o las pistas, no hay estado que sincronizar (todo se deriva de combatOn/cur/loopNo en scheduleStep).
- Si el integrador quiere FX al encender un farol (mortandad de memoras) o al caer proyectiles en '~', el hook debe exponerse desde engine/update (congelados hoy): sugerencia — llamar una export de fx.ts junto al sfx 'lamp' ya existente y en el loop de proyectiles.
- AMB_CAP llegó a su tope autorizado (120): si un bioma futuro necesita más densidad, hay que renegociar el techo, no pasarse.

Stage Summary:
- Auditoría SFX 40/40 documentada en el propio switch; el combate ahora late con un tambor de tensión que entra y sale con fundido (nunca en boss); las pistas de mapa respiran con un loop de cada 4 subido +1 semitono; la arena de la costa levanta polvo dorado, el hielo de las Cumbres raspa chispas horizontales, y el faro de Mara —una vez encendido— barre la bruma con motas de luz orbitando su linterna. tsc y lint en verde; solo audio.ts y fx.ts tocados.

---
Task ID: 10-b
Agent: general-purpose (balance)
Task: R4-b — Balance y economía del Acto II: curva de dificultad de los 5 enemigos + 2 jefes, oro, botines de jefe, recompensas de misiones q6-q10 y densidad de spawns para que Lunaris→Costa→Merrow→Cumbres se sienta como progresión (rampa ~Nv 1-12). SOLO data.ts, engine.ts y maps_expansion.ts.

Work Log:
- Leído worklog (Task 1 balance original, 7-int integración, 8-b cableado de misiones, 9-int mecánicas) y hooks.ts/enemies_expansion.ts en SOLO LECTURA para no romper flujos.
- A) data.ts ENEMY_DEFS (Acto II únicamente, Acto I intacto):
  - neumo 24/7→30/8, oro [5,9]→[6,10] — ranged molesto, no letal (windup 0.7 y atkCd 2.0 sin tocar).
  - espectro 34/9→40/10, oro [6,10]→[7,12] — su invulT ya lo hace táctico.
  - arpi 28/8→32/9 pero atkCd 1.4→1.6, oro [5,9]→[6,10] — los picados sincronizados en pandilla (9-a) pegan más por golpe; se compensa espaciando la cadencia.
  - sirena (jefa) 340/12→380/13, breakBar 80→90 — pelea más larga, quiebre más recompensado.
  - golem (jefe) 420/16→460/17, breakBar 100→110 — paredón final.
  - XP sin cambios (20-26 regulares, 240/280 jefes); el enunciado ya la daba por buena. Todas las stats se leen en runtime de ENEMY_DEFS (makeEnemy, render barra jefe, telegrafías con def.dmg), cero hardcodes afectados.
- B) engine.ts killEnemy — botín garantizado de jefes (2 líneas por rama, ramas sirena/golem intactas en todo lo demás: flags, música, toasts, questAdvance):
  - sirena: p.potions += 1 + floatAt 'Botín del jefe: +1 poción' (#7ef0a0).
  - golem: p.gold += 30 + floatAt 'Botín del jefe: +30 coronas' (#f0c84a).
- C) engine.ts economía de misiones: questAdvance ahora llama this.grantQuestLoot(prev) SOLO en la rama de CAMBIO de misión (los avances de paso no pagan; los toasts 'Nueva misión: X' existentes siguen idénticos). Map pequeño index-completada→botín: q6 +20 coronas · q7 +40 y 1 poción · q8 +35 · q9 +50 y 1 poción · q10 +60. floatText sobre el jugador ('Recompensa: +N coronas[ y 1 poción]') + sfx 'coin' + toast de respaldo (las recompensas suelen dispararse con diálogo abierto, donde el float puede quedar bajo el panel).
  - Puntos reales de pago verificados contra el cableado existente: q6 vía hooks.mara_met→questAdvance (5→6), q7 vía eco_mareas_taken (6→7), q8 vía hooks.mera_eco (7→8), q9 vía eco_cumbres_taken (8→9).
  - CASO q10 (documentado): q10 es la última misión y NO pasa por questAdvance (el clamp deja questIdx===prev y el cierre real vive en hooks.acto2_report, archivo CONGELADO). Solución mínima en engine.talkTo: si nid==='brisa' && questIdx===9 && !flags.acto2Done → grantQuestLoot(9) (el nodo brisa_final2 de data.ts es exactamente el que sirve getDialogue ahí). Anti-doble pago con flag q10Paid (boolean, se serializa sola en save()); la entrada 9 también está en el mapa por si el motor algún día avanza desde q10, protegida por la misma flag.
- D) maps_expansion.ts spawns (jefes, NPCs, props y cofres INTOCADOS):
  - Costa: verificado el requisito de la entrada norte (26,2) — el spawn más cercano está a 24 tiles (espectro 24,26); no hay nada que realojar (comentario dejado en el código).
  - Cumbres: la premisa 'ya tiene 1-2 spawns más que costa' era INCORRECTA (6 vs 6). Corregido añadiendo 2 spawns sobre tiles '=' del camino (la dispersión de pinos nunca pisa '=' — garantía estructural de tile pisable, sin tocar clearKey): arpi (30,20) en el cruce este del paso (a ≥8 tiles de las otras arpías, la pandilla solo sincroniza si ambas están en rango) y espectro (40,26) guardando el tesoro opcional del este (cofre cu2). Resultado: costa 6 → aldea 6 (4 espectros needPresent) → cumbres 8 (+Gólem): rampa de densidad y de mezcla (lobos/espectros de la zona 1 se mezclan ya solo en cumbres).
  - Progresión resultante: costa (enemigos 30-40 hp/8-10 dmg + Sirena 380) < cumbres (32-40 hp/9-10 dmg, 4 arpías veloces + Gólem 460).
- E) Economía auditada (sin cambios de costes, ya correctos): forja +1=30, +2=55, +3=80, +4=105, +5=130 (30+25·lvl) y poción 15 (cura 40% de vida) intactas. Ingresos de un Acto II completo ≈ 1100 coronas (regulares ~190, jefes ~355 con botín nuevo, misiones 205, cofres 375) + ~7-9 pociones (cofres, mara_gift, botín de sirena, q7/q9): paga ~2 forjas (+3 y +4 = 185) con margen para pociones y algo de grindeo de repuesto. Acto I deja ~200-250 coronas según lo muerto en el camino.
- CONGELADOS respetados: update.ts, enemies_expansion.ts, render.ts, screens.ts, hooks.ts, types.ts, maps.ts — cero toques. En engine.ts no se tocó accept_q*, lightLamp, tryTakeEco, findSafeTile, exitCd, save/load, gainXp/xpNext, ni la estructura de killEnemy (solo las 2 líneas por rama de jefe).

Verificación:
- bunx tsc --noEmit → 0 errores en todo el proyecto (grep por data|engine|maps_expansion vacío).
- bun run lint → 0 errores, 0 warnings.
- No se ejecutó navegador (protocolo).

Stage Summary:
- El Acto II escala de verdad: enemigos +12-25% de hp/dmg escalonados por zona, arpías nerfeadas en cadencia para que la pandilla siga siendo justa, jefes más largos con quiebre más jugoso y botín garantizado, 205 coronas + 2 pociones de recompensas de misión, y densidad 6→6→8 spawns con cumbres como zona final dura. Economía validada para ~2 forjas + pociones por acto. tsc 0, lint 0. Ronda 4 lista para integración (10-int).

---
Task ID: 11-a
Agent: general-purpose (integrador)
Task: R5 — Revisión de integración completa de las 4 rondas de expansión (Acto II) y reparación de problemas. Revisión A→F del checklist de integración; edits mínimos y quirúrgicos.

Work Log:
- Leído worklog completo (Tasks 7/7-int, 8/8-int, 9/9-int, 10) y verificado el estado real de todos los contratos documentados.

A) COMPILACIÓN: `bunx tsc --noEmit` → 0 errores en TODO el proyecto (no solo src/game). `bun run lint` → 0 errores, 0 warnings. Nada que reparar en este punto.

B) IMPORTS Y CICLOS: grafo verificado módulo a módulo (imports de valor vs type-only). Ciclos reales: fx↔update (isNight/combatSparks), update↔enemies_expansion (expansionTick/getPortadorVel), engine↔render↔screens (preexistente), maps→maps_expansion (lineal, sin vuelta). VERIFICACIÓN DE INIT-ORDER: greppado todo el código a nivel de módulo de los ciclos — solo declaraciones de literales/WeakMap/WeakSet/const (ninguna llamada a funciones del módulo del otro lado del ciclo, ninguna lectura de constantes exportadas al cargar). sprites.ts NO importa sprites_expansion (el ciclo reportado en 7-b no existe: engine llama initExpansionSprites() tras initSprites()). bun build --target=browser de engine.ts → 15 módulos, 0.38 MB, resuelve completo (los 4 ciclos incluidos).

C) CONTRATOS CRUZADOS (todos re-verificados con grep + lectura):
1. Poses: sprites.ts:608/619 exportan getAttackFrames/getCastFrames; render.ts los consume con optional-call pasando pl.sprite; engine asigna 'hero_alba'/'hero_tejedor' según disciplina (líneas 225/279) — coincide EXACTO con las claves de WEAPONS (592-594) y de poses (1050+). ✓
2. expansionTick/expansionDeathFx/getPortadorVel: expansionDeathFx se llama en update.ts:387 para e.dead de sirena/golem ANTES del filter g.enemies (línea 393) — corre una única vez y en el frame correcto. ✓
3. BOSS_DEFEAT_FLAG definido en engine:23 y usado en update.ts:399 (activación genérica) y engine:369/448. tryTakeEco usa DIALOGUES['eco_mareas'/'eco_cumbres'] que 8-a añadió en data.ts:625/647 con onEnd contractual 'eco_*_taken' (engine:823/831) — el dynNode de respaldo del motor queda como fallback inactivo, como estaba diseñado. ✓
4. Acciones de data.ts (regex amplia con camelCase): TODAS resueltas — accept_q2..q10/eco_*_taken/eco_taken/forge/buy_potion/recruit_ilwen/fragment_touched/end_demo en engine.applyAction; mara_met/mara_gift/mera_eco/acto2_report/eco_taken_mem/flag_metIvo|metMera|metVult/rep_* en hooks.handleCustomAction (fallback del default de applyAction). 108 nodos de diálogo con next/onEnd/action íntegros (script). ✓
5. SFX: re-auditoría con grep propio: 34 nombres literales + 3 interpolados (swing/swing2, fire/ice/bolt, crit/hit en engine:1174/1280/1401) — 0 faltantes, 0 cases muertos ('crit' y 'hit' sí se usan vía interpolación). ✓
6. Faroles: lightLamp usa ['lamp1','lamp2','lamp3'] (engine:639) = ids EXACTOS de maps_expansion.ts:375-377, los 3 con needPast:true. ✓
7. save(): `flags: { ...this.flags, ... }` — spread sin filtro; las 20 flags del Acto II (q6-q10, sirenaSeen, q10Paid, visited_*, lamp1..3, ecoMareas/ecoCumbres/ecoNombres, sirenaDefeated/golemDefeated, bossHp_costa/cumbres) se serializan solas (verificado además con save() real sobre localStorage stub: 20/20). ✓

D) LÓGICA SOSPECHOSA — 2 PROBLEMAS REALES ENCONTRADOS Y ARREGLADOS:
- FIX 1 (hooks.ts): toasts de 'Nueva misión' DUPLICADOS. El toast genérico de questAdvance (8-b: `Nueva misión: ${QUESTS[idx].name}`) emite el mismo texto que los toasts explícitos de hooks.mara_met ('La Sirena sin Canto') y hooks.mera_eco ('La Cumbre del Segundo Canto') — el jugador veía cada aviso DOS veces apiladas (toasts máx 4, se ven ambos). Eliminados los 2 toasts redundantes (questAdvance siempre cambia de misión en esas ramas, así que no hay caso sin aviso).
- FIX 2 (engine.ts): SOFTLOCKS de la cadena del Acto II por JUEGO FUERA DE ORDEN. Los pasos de q7-q9 se completaban solo por EVENTO (watcher de aggro, killEnemy, lightLamp, eco_*_taken); si el objetivo se completa ANTES de aceptar la misión —matar a la Sirena durante q6, matar al Gólem durante q8, encender los 3 faroles antes de q8 (los props needPast son accesibles en pasado desde q3, con fragmentTouched) o tomar un Eco por adelantado— el evento ya no puede repetirse (jefe muerto no re-spawnea vía BOSS_DEFEAT_FLAG, altar vacío, farol ya encendido) y la cadena quedaba bloqueada para siempre. Nuevo método privado catchUpActo2() llamado desde Game.update() (junto al watcher de 8-b): avance IDEMPOTENTE POR ESTADO, mismo principio del fix de visitas de 8-int — cada paso se completa si su condición final ya es cierta (sirenaDefeated/golemDefeated/ecoMareas/ecoNombres/ecoCumbres/lamp1..3≥3), en cualquier orden, O(1) con early-out fuera de questIdx 5-9. No toca el caso normal (caso D del smoke: sin condiciones no avanza nada).
- Verificados SIN problemas: (1) killEnemy sirena/golem — botines de 10-b dentro de las ramas correctas, UN questAdvance por rama (idx 6/step 1 e idx 8/step 1), sin duplicación; (2) grantQuestLoot — solo en la rama de CAMBIO de misión de questAdvance (los avances de paso no pagan), q10Paid anti-doble-pago verificado E2E (talkTo repetido no paga 2ª vez), pago q10 desde talkTo correcto; (3) toasts de questAdvance no duplican a los de grantQuestLoot (textos distintos; tras FIX 1 no hay más duplicados); (4) lightLamp es orden-independiente (cuenta flags, no secuencia) ✓; (5) loadMap idempotente de 8-int — no rompe el caso normal (condición por estado de misión, no por primera visita); (6) REMATE con jefes aturdidas: el check de 'aturdido' en update.ts:700 está DESPUÉS del dispatch, pero NO es problema — el remate es lógica del JUGADOR (bloque attackStarted ~línea 295, lee g.enemies directamente) y el bookkeeping wasAturdido/finisherUsed está AL INICIO de updateEnemy (648-651, ANTES del dispatch); commonTick de enemies_expansion maneja el aturdimiento (countdown, recupera sta, partículas) y devuelve true sin interferir; (7) drawBiomeTint en render:140 — tras partículas ambientales y ANTES de drawLighting; HUD/floats/cielo se pintan después → no tapa nada; (8) poses: dur = chargedHit?0.4:0.26 coincide EXACTO con engine.releaseCharge (línea 1169); attackT>dur/2 = primera mitad (anticipación) con attackT decayendo en update.ts:182; tejedor usa getCastFrames para su ataque de bastón (los skills NO ponen attackT — castSkill no lo toca — así que no hay poses de skill que coordinar); (9) fx.ts: pool AMB_CAP=120, ambos emisores (spawnAmbient y el haz del faro) usan pool.find(a=>!a.active) con clamp — el faro no acumula ráfaga diferida al estar lleno; anti-doble-conteo de chispas de combate vía fxOwnFx (ventana de 2 frames) intacto en updateCombatFx; rollTrail separada.

E) SMOKE BUN (sin navegador) — 2 scripts nuevos reutilizables:
- scripts/smoke_acto2.ts (stub DOM + importa data/maps/sprites reales): 10 misiones q1-q10 ✓ · ENEMY_DEFS completos para los 9 tipos con todos los campos requeridos (breakBar en los 3 jefes) ✓ · 6 mapas con rows normalizadas a w×h ✓ · 108 nodos de diálogo sin next/onEnd/action rotos ✓ · 5 MEMORIES + 3 KEY_ITEMS + 4 SKILLS/disciplina ✓ · AUDITORÍA ANTI-SOFTLOCK COMPLETA: las 10 salidas del MUNDO COMPLETO (lunaris↔bosque↔cripta + lunaris↔costa↔aldea + bosque↔cumbres) con destino existente, aterrizaje (tx,ty) dentro de bounds, NO sólido en NINGUNA de las 2 épocas (SOLID_CHARS + tileAt con epochDiffs) y NO dentro de otra zona de salida → 0 aterrizajes problemáticos, nada que corregir ✓ · spawns/NPCs/cofres/props de los 3 mapas de expansión sobre tiles pisables en su época, ids únicos ✓ · lamp1..3 exactos con needPast ✓.
- scripts/smoke_motor_acto2.ts (stub window/document/localStorage/Audio + Game REAL): arranca el motor, newGame, y juega la cadena q5→q10 completa con métodos públicos (talkTo/accept_q6/loadMap/mara_met/watcher/killEnemy/eco_mareas_taken/lightLamp en desorden/mera_eco/golem/eco_cumbres_taken/talkTo q10/acto2_report) ✓ · botines de jefes y grantQuestLoot pagan lo documentado (q7 +40 y 1 poción, q10 +60 una vez) ✓ · los 4 casos fuera-de-orden del FIX 2 pasan (y el caso D prueba que no hay avances espúreos) ✓ · save() serializa 20/20 flags del Acto II ✓.

F) VERIFICACIÓN FINAL: tsc --noEmit → 0 en todo el proyecto · bun run lint → 0/0 · bun build --target=browser src/game/engine.ts → 15 módulos, 0.38 MB (grafo completo con los 4 ciclos). No se ejecutó dev server ni navegador (protocolo).

Archivos tocados: src/game/hooks.ts (-6 líneas: 2 toasts duplicados), src/game/engine.ts (+30 líneas: catchUpActo2 + llamada en update + comentario). Nuevos: scripts/smoke_acto2.ts, scripts/smoke_motor_acto2.ts (fuera de src/, tsconfig los excluye; solo para CI/dev manual con bun).

Stage Summary:
- Las 4 rondas del Acto II están integradas y sanas: 0 errores de compilación, contratos cruzados 100% verificados (sprites, expansión, ecos, acciones, SFX 34+3/37, faroles, serialización), ciclos seguros a nivel init, anti-softlock de mapas completo en verde, y el motor arranca y termina el Acto II en bun sin navegador. 2 reparaciones: toasts de misión duplicados en mara_met/mera_eco (hooks) y red de seguridad catchUpActo2 contra el bloqueo permanente de la cadena si se juega fuera de orden (jefes/ecos/faroles completados antes de aceptar la misión). Smoke reutilizables en scripts/ para la próxima ronda.

---
Task ID: 10-int
Agent: Super Z (agente principal)
Task: Integración y verificación E2E de la Ronda 4.

Work Log:
- 10-a (pantallas): Diario con secciones ACTO I/ACTO II + teasers de las 3 zonas, memorias dinámicas (5), KEY_ITEMS dinámicos (5), final 'Ecos recuperados: X de 7', título v0.3.0 con 6 zonas y 'Acto II incluido', helper counterDots.
- 10-b (balance): curva Acto II (neumo 30/8, espectro 40/10, arpi 32/9 con atkCd 1.6, sirena 380/13/quiebre 90, golem 460/17/quiebre 110), botín de jefes (sirena +1 poción, golem +30 coronas), grantQuestLoot por misión completada (q6..q10), q10Paid anti-doble-pago, spawns cumbres 6→8 (rampa 6→6→8).
- 10-c (audio/fx): auditoría SFX 40/40 (0 faltantes, 0 muertos), tambor de tensión en combate para pistas de mapa, micro-variación transposición +1 semitono 1/4 loops, polvo por bioma (arena dorada, hielo azul), bruma del faro rotatoria (FAROBEAM), AMB_CAP 120.
- E2E: título v0.3.0 verificado; tsc 0, lint 0.

---
Task ID: 11-int
Agent: Super Z (agente principal)
Task: Ronda 5 — integrador (11-a) + verificación E2E final del juego completo.

Work Log:
- 11-a (integrador): tsc/lint/bundle 0.38MB verdes; 7 contratos cruzados verificados (poses, expansionDeathFx antes del filtro, BOSS_DEFEAT_FLAG, DIALOGUES eco_*, 34 SFX literales + 3 interpolados, ids lamp1..3 exactos, 20/20 flags serializadas); 2 bugs de integración arreglados: (1) toasts duplicados en mara_met/mera_eco tras generalizar questAdvance, (2) softlocks por juego fuera de orden (Sirena/Gólem muertos antes de aceptar q7/q9, faroles antes de q8, Ecos adelantados) → nuevo catchUpActo2() idempotente O(1) en Game.update; smoke bun: 10 misiones, 9/9 enemigos, 6 mapas, 108 nodos de diálogo, anti-softlock de las 10 salidas del mundo (aterrizajes no sólidos en ambas épocas y fuera de zonas de salida).
- E2E final (agent-browser): partida tejedor; tour de los 6 mapas en juego sin errores; combate con poses de ataque + arcos + estelas + orbes de neumo (captura shot_r5_pose2.png); hielo resbaladizo re-verificado (deriva 5.9px); muerte y respawn limpios; Diario con Acto II y 5 memorias verificado visualmente (shot_r5_diario2.png); loopError=null sostenido; los errores 'drawImage' históricos de la consola dev eran residuos del hot-reload de HMR mientras los agentes editaban (0 nuevos tras reload en combate/muerte/tour/épocas, con instrumentación de CanvasRenderingContext2D.drawImage y hook de console.error).

Stage Summary:
- ECOS DE AELTHAR v0.3.0: Acto II completo — 6 zonas, 3 jefes (Guardián/Sirena/Gólem), 5 enemigos nuevos, 10 misiones, 5 memorias, 8 pistas chiptune, poses de combate, hielo resbaladizo, tintes por bioma, economía y balance de Acto II. Listo para push.

---
Task ID: 12
Agent: Super Z (agente principal)
Task: Fixes reportados por el usuario: (1) botones del menú invisibles que seguían activos durante la partida (clic fantasma → creación de personaje), (2) barra negra permanente abajo (letterbox), (3) glue para las próximas rondas de agentes (modo desafío, árbol de habilidades, balanceador).

Work Log:
- BUG 1 (clics fantasma) — Causa raíz: dispose() NO desvinculaba los listeners de mouse del canvas. Con el doble montaje de React StrictMode (dev), la 1ª instancia quedaba muerta pero ESCUCHANDO: su uiHit conservaba el último frame del título (NUEVA PARTIDA y=236, CONTINUAR 290, CONTROLES 344) y al clicar ahí durante la partida disparaba g1.requestCreate() → overlay DOM de creación (el setState de React sigue vivo). FIX doble: (a) dispose() removeEventListener de mousemove/mousedown/mouseup del canvas; (b) onMouseMove/onMouseDown/onMouseUp ignoran input si !this.running (doble red de seguridad).
- BUG 2 (barra negra) — Causa: letterbox 16:9 fijo en viewport 16:10 (canvas 960×540 con CSS min(100vw,177.78vh) → 45px de barras a 1440×900; verificado con getBoundingClientRect y captura). FIX: vista dinámica — export let VIEW_W/VIEW_H + fitViewToWindow(w,h) (vw=540·aspect clamp [840..1600], vh clamp [460..800]; a 16:9 exacto queda 960×540 como siempre); Game.fitCanvas() redimensiona el bitmap y re-snappea cámara; listener 'resize' en bindInput/dispose; canvas de luz offscreen se re-crea si cambian las dims; canvas CSS 100vw/100vh. Sin capturas a nivel de módulo (verificado por grep). E2E 1440×900: buffer 864×540, rect (0,0,1440,900), HUD/minimapa/quest intactos, resize en vivo estable, clic fantasma testado en juego → overlay NO abierto, uiHit=0, loopError=null.
- EXTRA: error transitorio 'drawImage' del arranque (Next dev overlay "1 Issue") localizado con el stack del overlay: screens.ts:140 getSprWisp tras HMR (módulo de sprites vacío un frame). Guard en drawTitle (skip wisp si no hay frame) + diagnóstico __wispMiss (cap 3). Tras reload limpio: 0 misses.
- GLUE de rondas de agentes (para que no pisen engine.ts): nuevo GState 'skills' (tecla K entra, esc sale), Game.challengeRun, update() llama challengeTick/skillTick/balanceTick, respawn() delega en onChallengeDeath si hay desafío, render.ts despacha 'skills' → drawSkillTree. Esqueletos no-op creados: src/game/challenge.ts, skilltree.ts, balance.ts (build verde en todo momento).
- Token de push PROPORCIONADO POR EL USUARIO INVÁLIDO (ghp_…5YOl: "Invalid username or token" — probablemente revocado por secret-scanning de GitHub al filtrarse en el chat). Commit local 348a911 hecho; push pendiente de token nuevo.

Verificación:
- bunx tsc --noEmit → 0 errores en src/. bun run lint → 0/0.
- E2E agent-browser 1440×900: título y partida sin barras, clics fantasma muertos, resize en vivo OK, loopError=null.

Stage Summary:
- Los 2 bugs del usuario arreglados y verificados E2E + infraestructura de modos lista para las rondas de agentes (12-a desafío, 12-b árbol, 12-c balanceador). Push bloqueado por token revocado — avisar al usuario.

---
Task ID: 12-c
Agent: general-purpose (balanceador)
Task: R6-c — Balanceador de dificultad dinámico: monitor de rendimiento del Portador con histéresis (nivel -2..+2), multiplicadores hp/dmg/xp de enemigos, persistencia localStorage 'ecos-balance' (AUTO/MANUAL), panel para la pestaña ESTADO y toasts anti-abuso. SOLO src/game/balance.ts (+ scripts/smoke_balance.ts).

Work Log:
- Leído worklog (Task 11/12: arquitectura, contratos, GState, glue de módulos) y grepeado el motor antes de editar: fuentes de daño al jugador (ÚNICA: Game.damagePlayer, engine.ts:1591 — verificado que pociones/santuarios solo SUBEN hp), spawns (Game.makeEnemy engine.ts:519 recibe TODOS los spawns + minions de jefe update.ts:831 y enemies_expansion.ts:631), XP (Game.killEnemy engine.ts:1516 → gainXp(def.xp)), definición de combate (update.ts:395: enemigo con !dead && aggro && ai!=='muerto'), playTime += dt (update.ts:118), rampa de niveles por zona de 10-b (~Nv 1-12).
- SEÑALES (todas medibles por tick sin hooks nuevos): muertes = delta p.deaths; daño recibido = hp previo vs actual por frame (patrón hp-previo, atribuido a combate si hay aggro); combates flawless = tramo continuo de aggro ≥ 4 s que termina sin daño; pociones = delta negativo de p.potions (comprar recalibra); nivel vs zona = p.level contra ZONA_NIVEL_REF {lunaris 2, bosque 4, cripta 5, costa 8, aldea 9, cumbres 11}.
- HISTÉRESIS: cada ventana de 10 s cierra un voto -3..+3 (+2 por muerte en memoria móvil de 120 s, +1 más con ≥2 muertes; +1 por ≥2 pociones en 60 s; ±1 por daño en combate ≥40% / ≤10% de la vida con ≥3 s de combate; -1 por flawless en 120 s, cap -2; ±1 por nivel vs zona). El nivel se mueve ±1 SOLO con 2 ventanas consecutivas (HISTERESIS) en el mismo sentido: subir exige voto ≤ -2, bajar voto ≥ +3 (asimétrico: 1 muerte avisa pero no nerfea; 2 muertes en 2 min sí — la memoria móvil sostiene el voto pese a las ventanas tranquilas del respawn). Enfriamiento 30 s entre cambios, gracia 60 s al inicio, consumo de votos tras cada cambio, el nivel NUNCA deriva solo hacia 0. Verificado por simulación: 1 muerte → 0 cambios; 2 muertes → -1 en ~20-30 s; 4 toasts exactos al arrasar de -2 a +2; caps ±2 sin toasts extra.
- TABLA (sobre ENEMY_DEFS, curva suave y asimétrica: bajar protege más de lo que castiga, subir paga XP por debajo del riesgo): nivel -2 Muy fácil {hp 0.75, dmg 0.80, xp 0.85} · -1 Fácil {0.88, 0.90, 0.93} · 0 Normal {1, 1, 1} · +1 Difícil {1.15, 1.10, 1.08} · +2 Muy difícil {1.30, 1.20, 1.15}. Los enemigos ya spawneados conservan stats (el mult se lee al construir el enemigo). La barra de quiebre NO se escala (decisión documentada).
- PERSISTENCIA: localStorage 'ecos-balance' {"v":1,"level","auto"}; carga perezosa SSR-safe en el primer uso (JSON corrupto → Normal/AUTO sin lanzar), guardado con debounce 1.5 s (máx 1 escritura/ventana) vía scheduleSave; API MANUAL: setBalanceAuto/nudgeBalanceLevel (±1 relativo, otro valor = absoluto)/resetBalance (escritura inmediata + limpia votos). Estado vivo en variable de módulo (1 Game por página, documentado; re-sincroniza si cambia el objeto Player: nueva partida/carga).
- MODO DESAFÍO: balanceTick early-out y enemyStatMult neutro si g.challengeRun existe (12-a escala por su cuenta) — verificado por simulación (muertes en arena no mueven el nivel).
- ANTI-ABUSO: 1 toast por cambio automático y nunca con p.playTime < 300: bajar → 'El mundo cede un paso atrás...' (#8ef0b0), subir → 'El mundo se torna más fiero...' (#e0a060). Cambios manuales nunca avisan.
- UI drawBalancePanel(g, x?, y?, w=664, {readOnly?}): bloque compacto 664×70 (62 solo lectura) con cabecera '◆ DIFICULTAD DEL MUNDO ◆', indicador MODO AUTO/MANUAL, galga de 5 celdas con nombres en español (Muy fácil→Muy difícil), efectos actuales 'Vida/Daño/XP ±N%', y 4 botones FUNCIONALES (Modo AUTO/MANUAL, −, +, Restablecer) vía addHit/uiHit global de ui.ts (los hits se despachan en onMouseDown en cualquier estado; clearHits corre al inicio de drawGame → funcionan dentro de drawPause sin tocar screens.ts). readOnly dibuja hint en su lugar. Anclaje por defecto recalculado de g.canvas (bitmap SIEMPRE = VIEW_W×VIEW_H por fitCanvas → no hace falta importar el valor del motor). Devuelve la altura para apilar.
- Smoke bun nuevo scripts/smoke_balance.ts (3 procesos: simulación de 30 checks con localStorage stub en /tmp + round-trip de persistencia entre procesos + JSON corrupto): TODO OK (muertes/histeresis/caps/toasts/MANUAL/tabla/desafío/panel; advance de playTime simulando update.ts:118 y muertes acumulativas como en juego real).

CONTRATO DE INTEGRACIÓN EXACTO (el integrador cablea; NADA de esto toca archivos ajenos):
1) HP — Game.makeEnemy (engine.ts:519, donde `const d = ENEMY_DEFS[type]`):
     const bm = enemyStatMult(this);
     ... hp: Math.round(d.hp * bm.hp), maxHp: Math.round(d.hp * bm.hp), ...
   (cubre spawnEnemies de los 6 mapas y minions de jefe; sta/maxSta sin tocar)
2) DAÑO — Game.damagePlayer (engine.ts:1591), PRIMERA línea:
     dmg = Math.max(1, Math.round(dmg * enemyStatMult(this).dmg));
   (embudo único de TODO el daño enemigo: melé update.ts:770/781, contacto enemies_expansion.ts:248, proyectiles update.ts:455 + enemies_expansion.ts:342, ondas update.ts:496, telegrafías update.ts:514 + enemies_expansion.ts:749/756/843/924/970; la IA telegrafía con def.dmg base pero el impacto final pasa siempre por damagePlayer; no existe autodaño)
3) XP — Game.killEnemy (engine.ts:1516): this.gainXp(Math.round(def.xp * enemyStatMult(this).xp));
4) PANEL — screens.ts · drawPause · pestaña ESTADO (1 línea):
     drawBalancePanel(g, px + 28, py + 398, pw - 56); // 12-c dificultad
   El bloque mide (pw-56)×70 y en ESTADO quedan ~37 px libres al pie (py+433..py+470, tras las filas de reputación de VELMORA que terminan en py+433): el integrador libera ~30 px como prefiera (p.ej. vy0 = y+36 y filas de rep a paso 18) o lo coloca en otra pestaña — la función acepta x/y/w y devuelve su altura; con { readOnly: true } mide 62. Alternativa sin panel: setters exportados listos para tecla (sugerida: 'B' cicla MANUAL -2..+2 en juego).
   balanceTick YA está llamado en Game.update (engine.ts:203, play/dialogue) — no requiere wiring.

Verificación:
- bunx tsc --noEmit 2>&1 | grep -E "src/(game|components)" → VACÍO (0 errores en todo el proyecto).
- bun run lint → 0 errores, 0 warnings.
- bun scripts/smoke_balance.ts (+ load-valid + load-corrupt) → 30 + 2 + 2 checks, TODO OK.
- bun build --target=browser src/game/engine.ts → 18 módulos, 0.43 MB (grafo resuelve; balance→ui sin ciclo: ui importa engine solo en type).
- NO navegador (protocolo).

Archivos tocados: src/game/balance.ts (esqueleto → implementación completa; exportaciones del esqueleto intactas: loadBalance/saveBalance/balanceTick/enemyStatMult/drawBalancePanel/resetBalance + nuevas: BALANCE_NAMES, balanceLevelName, setBalanceAuto, nudgeBalanceLevel). Nuevo: scripts/smoke_balance.ts (excluido de tsconfig, solo dev/CI con bun).

Stage Summary:
- El mundo de Aelthar respira con el Portador: muere mucho y 'El mundo cede un paso atrás...', arrasa y 'El mundo se torna más fiero...' — con histéresis de 2 ventanas de 10 s, memoria móvil de 120 s, enfriamiento de 30 s y silencio durante los primeros 5 minutos. Nivel -2..+2 persistente (AUTO por defecto, MANUAL opcional con panel y botones funcionales listos para la pestaña ESTADO), neutro en modo desafío, y contrato de 4 puntos documentado para que el integrador cablee hp/dmg/xp + panel sin ambigüedad. tsc 0, lint 0, smoke 34/34.

---

---
Task ID: 12-a
Agent: general-purpose (modo-desafio) — sesión agotó contexto ANTES de registrar worklog; entrada reconstruida por el integrador tras verificar el código.
Task: Modo Desafío completo (arena + oleadas sin fin + duelos 1v1 contra los 3 jefes) accesible desde el título.

Work Log (verificado por el integrador, archivos inspeccionados + smokes + E2E):
- src/game/challenge.ts (718 líneas): ChallengeRun extendido (phase, spawnQueue goteada 0.2s+0.5s, spawnedTotal, wavesCleared, bannerT, endBeat, snap de campaña, playerRef); startChallenge fotografiar la campaña (oro, pociones, flags, misión, memorias, facciones) y la RESTAURA al terminar (XP/nivel se conservan a propósito); Portador temporal "Portador de Arena" Nv8 arma+2 si no hay campaña (se retira al volver al título); duelos con 1 vida y 0 pociones, bossBanner reutilizado, hp de ENEMY_DEFS sin tocar y flags de campaña deshechas tras la victoria (logro por jefe con +1 poción solo con Portador de campaña, localStorage ecos-desafio-logros); récord de oleadas en ecos-desafio-best (solo modo oleadas); abortos: salida de mapa (puerta sur) y jugador reemplazado; reparación del guardado escrito dentro de la arena (resave rewrite/remove).
- maps_expansion.ts: mapa 'arena' (ARENA_MAP_ID) con muralla perimetral, puerta sur con zona de salida y SIN spawns propios (todo lo instancia challenge.ts).
- screens.ts: botón DESAFÍO en el título + openChallengeMenu/drawChallengeTitleUi/drawChallengeOverlay integrados.
- El integrador añadió después: quest-tracker de campaña oculto durante el desafío (render.ts, HUD).
- FIXES del integrador sobre el smoke: timing del goteo (3 lobos entran en ~1.2s, el test mata a los 0.3s), aislamiento del récord entre bloques y comparación Map.get undefined vs null (el juego NUNCA escribió el récord en el duelo — falso positivo del test).

Stage Summary:
- MODO DESAFÍO jugable E2E: título → DESAFÍO → OLEADAS/DUELO x3 → arena con banner OLEADA 1, HUD (Enemigos/Puntos/Récord), Portador de Arena Nv8, spawns en anillo 8-14 tiles. smoke_desafio TODO OK (7 bloques), tsc 0, lint 0.

---
Task ID: 12-b
Agent: general-purpose (arbol-habilidades) — sesión agotó contexto ANTES de registrar worklog; entrada reconstruida por el integrador tras verificar el código.
Task: Árbol de habilidades (3 ramas, 20 nodos) + 6 magias nuevas + 3 herramientas activas, con pantalla propia (tecla K).

Work Log (verificado por el integrador):
- src/game/skilltree.ts (1107 líneas): ramas Vía del Filo (cuerpo y acero), Vía del Eco (arcano elemental), Vía del Camino (travesía y astucia); 20 nodos con coste 1-3, padres y grants consistentes; puntos = 1/nivel + hito cada 5 (skillPointsEarned); estado del árbol FUERA del Player (types.ts congelado): localStorage 'ecos-arbol' clave `nombre|disciplina` + cache Map + WeakMap<Player,RT> para lo transitorio; applySkillStats ABSOLUTO e idempotente (base + (nv-1)*7 + 20 por Corazón de Roble).
- Magias nuevas (data.ts, bloque 12-b delimitado): Onda Sísmica, Lanza del Alba, Cólera del Alba (alba); Nova de Escarcha, Tormenta Encadenada, Aureola de Ceniza (tejedor) + Mente de Cristal; equipaje en huecos 1-4 (sustituye a la base, que duerme y vuelve al restaurar).
- Herramientas: Campana del Retorno (5), Brújula de Ecos (6, marca objetivo de misión), Amuleto de Aelthar (7, absorbe 1 golpe con recarga por oleada de combate).
- PUENTE castSkill: envuelve Game.prototype.castSkill (lazy, idempotente, apagable con __ecos_no_skill_bridge) — las magias nuevas funcionan HOY sin tocar engine.ts; skillTick aplica pasivas (oro +20% Ojo del Mercader, regens, decaimiento extra de cds, Paso de Brisa +12% velocidad).
- FIX del integrador: (1) renombrado useTool → activateTool (ESLint lo tomaba como React Hook); (2) BUG REAL de carga: ensureTreeForPlayer solo aplicaba el loadout en cache-miss — otro perfil podía dejar SKILLS mutado y al continuar partida el equipaje se perdía → applyLoadout se re-aplica SIEMPRE al inicializar un jugador; (3) el smoke sección 9 probaba con el Portador equivocado (Amparo sin c_vida/c_cd/onda con expectativas de Albaran) → corregido a ga.save() (Albaran).

Stage Summary:
- Árbol completo E2E (K): 3 ramas visibles, puntos, nodos clicable; smokes smoke_arbol COMPLETO EN VERDE (10 secciones: persistencia, pasivas, equipaje, magias por puente, herramientas con cds, absorción reactiva, guardado/carga del motor, pantalla sin excepciones, integridad de 20 nodos). NOTA para el agente visual: ligeros solapes de etiquetas de nodos en la fila media de Vía del Eco/Camino (posicionamiento de texto, no funcional).

---
Task ID: 12-int
Agent: Super Z (agente principal — integrador Ronda A)
Task: Integrar y verificar la Ronda A (12-a desafío, 12-b árbol, 12-c balanceador) + completar los contratos de 12-c en el motor.

Work Log:
- Contrato 12-c aplicado en engine.ts: (1) makeEnemy — hp/maxHp × enemyStatMult(this).hp (cubre TODOS los spawns incluidos minions de jefe); (2) damagePlayer — PRIMERA línea dmg = max(1, round(dmg × enemyStatMult(this).dmg)) — embudo único de todo el daño enemigo; (3) killEnemy — gainXp(round(def.xp × enemyStatMult(this).xp)); neutro en desafío (guard en balance.ts).
- Panel 12-c en screens.ts pestaña SISTEMA (drawBalancePanel(g, cx, cy+196, pw-56)) — con botones AUTO/MANUAL/±/Restablecer funcionales vía uiHit; sin solapes (SISTEMA tenía ~180px libres).
- Glue del motor (hecho en Task 12): GState 'skills', challengeRun, challengeTick/skillTick/balanceTick en update(), respawn→onChallengeDeath, render despacha 'skills'→drawSkillTree, tecla K.
- Verificación: tsc 0 en src/, lint 0, bun build 18 módulos; smokes: balance 34/34, arbol VERDE, desafío TODO OK, acto2 0 fallos (actualizado el conteo de mapas 6→7 por la arena), motor_acto2 0 fallos.
- E2E agent-browser (1440×900): título con DESAFÍO sin barras; menú Modo Desafío completo (récord, OLEADAS, 3 duelos, reglas); arena jugable (OLEADA 1, 3 lobos en anillo, HUD desafío, Portador de Arena Nv8); árbol K con 3 ramas y 20 nodos; pausa→SISTEMA con panel de dificultad AUTO y botones; quest-tracker oculto en arena.
- INCIDENCIA no reproducible: 1 vez el reto se cerró solo tras pulsar K (state title, run null, player null) — no reproducible en 2 sesiones controladas (3s de polling estable con K mantenida); monitorizar en la Ronda B.
- Renombrado useTool→activateTool (lint React Hooks) y actualizado smoke_acto2 (7 mapas).

Stage Summary:
- Ronda A integrada y verde: Modo Desafío (oleadas + 3 duelos), Árbol de habilidades con 6 magias y 3 herramientas, Balanceador dinámico con panel en SISTEMA y multiplicadores cableados en el motor. tsc/lint/smokes/E2E en verde.

---
Task ID: 12-push
Agent: Super Z (agente principal)
Task: Push a GitHub a RAMA (petición explícita del usuario: "subelo a una rama no al main") + blindaje extra del bug de clics fantasma que el usuario reporta persistente.

Work Log:
- El usuario reportó el bug de clics fantasma PERSISTENTE; verificado E2E en el dev server actual: 10 clics en las posiciones exactas de los botones del título durante la partida → overlay NO abre (el fix de Task 12 funciona; el usuario probablemente probó un bundle obsoleto/caché). Aún así se añadió BLINDAJE TRIPLE adicional: (1) stamp de estado en cada UiHit (ui.ts addHit guarda g.state; engine.onMouseDown solo honra hits del estado actual — mata la ventana de 1 frame en transiciones), (2) requestCreate() guard: solo desde state 'title' (3) junto a las 2 capas previas (dispose desvincula listeners del canvas + guard !running). Verificación adicional del letterbox: 16:9 → buffer 960×540 rect (0,0,1920,1080) EXACTO; 4:3 → 840×630 EXACTO; 16:10 → 864×540 EXACTO. Sin barras en ningún aspecto común.
- Token del usuario ANTERIOR (ghp_…5YOl) inválido; NUEVO token funcionó. PUSH EXITOSO: local main → rama remota expansion-v0.4 (main intacto como pedía el usuario). Commits: 348a911 (fix bugs), a30cc3a (v0.4.0 Ronda A), ab61a49 (blindaje).

Stage Summary:
- Rama expansion-v0.4 publicada con v0.3.0 + fixes + Ronda A completa. Recordar al usuario: hard-refresh (Ctrl+Shift+R) para descartar bundle obsoleto, y REVOCAR AMBOS tokens (quedaron expuestos en el chat).

---
Task ID: 13-c
Agent: general-purpose (inmersion-temporal)
Task: Que viajar con Q se sienta como un ACONTECIMIENTO: transición completa (onda/flash/sfx/notas + veto narrativo), consecuencias que cruzan épocas (huellas genéricas con memoria una vez por huella), NPCs duales con versos superpuestos y residuos del canto. SOLO src/game/timeskip.ts (+ smoke). El cableado del motor ya existía (Task 12/13: timeTick en Game.update, beginEpochShift en epochSwitch ANTES de alternar) — engine.ts/update.ts/render.ts/types.ts/etc. SIN TOCAR.

Work Log:
- Leído worklog (Tasks 12, 12-a/b/c/int/push) y auditados en SOLO LECTURA: engine.ts (epochSwitch:624 — llama beginEpochShift tras los guards de hasEcho/epochDiffs y ANTES del flip; waves procesadas en update.ts:489 con `if (w.dmg > 0)` → dmg 0 es escenografía inocua; flashT decae en el loop RAF; floats/toasts son cosmética que corre en todos los estados), maps.ts + maps_expansion.ts (epochDiffs: puente 'B' bosque 25-26×10-12, cobertizo lunaris 5-6×25-26, lápidas↔flores 17-18×20, muelles 'B' costa 28-29×36-38 y aldea 38-39×28-29; faroles lamp1..3 = props needPast de aldea, engine.lightLamp hace flags[id]=true), fxcore.ts (addShake/addFlash SÍ exportados → usados), screens.ts (drawNote de referencia), audio.ts ('save'=[880,1175,1568] ascendente → ir al ayer; 'quest'=[659,880] → volver al hoy; se apilan sobre el 'epoch' del motor, que suena DESPUÉS de mi true). IMPORTANTE: worldlife.ts (13-b) se implementó EN PARALELO durante esta sesión — sus rumores ambientales también hablan cerca de las NPCs; coordinación: mis versos duales son SOLO por cambio de época (<6 tiles), con firma propia «...» inicial y colores de época (#cfe0ff presente / #ffd88a pasado); sin tocar su archivo.
- 1) TRANSICIÓN (beginEpochShift): veto narrativo NUEVO — enemigo con aggro (e.aggro && !e.dead) a <5 tiles (80 px) → return false + 1 de 3 frases evocadoras ROTATIVAS (contador de módulo) + addShake(4) + sfx 'error' (convención de acciones bloqueadas del motor); el motor NO alterna la época. Si no hay amenaza: doble onda expansiva dmg 0 desde el Portador (r6→72 @210 y r3→100 @290), flash suave teñido por DESTINO (addFlash 0.12 s: #ffd88a al ir al pasado, #a8b8d8 al volver), latido addShake(2), capa sfx, y ráfaga de 12 notas musicales (mitades con palito = 18 partículas) con CONFIGS CACHEADAS en módulo (NOTE_CFG: abanico hacia arriba, grav -14, mismas choreography siempre — cero decisiones por viaje).
- 2) HUELLAS (lo más importante) — sistema GENÉRICO tabla huella→frase en timeskip.ts: (a) huellas de LOCALIZACIÓN: rect de adquisición en tiles por mapa/época; escaneo con throttle 0.2 s sobre los PIES (convención fx.ts). Al tocar: pista sutil «...el ayer toma nota...»/«...el hoy toma nota...» + 4 motas doradas. Al ATERRIZAR en la época opuesta (flip detectado en timeTick comparando g.epoch con el frame anterior — sin tocar engine): floatText evocador escalonado (0.35 s + 0.9 s entre recuerdos, en la posición de la huella si está a ≤20 tiles o en el MISMO mapa; si no, sobre el Portador) + toast del PRIMERO del aterrizaje. UNA VEZ POR HUELLA vía flags ts_* en g.flags (se serializan solas en save()). (b) huellas por FLAG del motor: lamp1/lamp2/lamp3 → recordadas al aterrizar en presente (aunque estés en otro mapa: el recuerdo viaja sobre el Portador). (c) g.takenEchoes: ts_eco_<id> por eco menor, máx 2 por aterrizaje para no spamear. PENDIENTES en runtime (Map pendingAcq): si el veto bloquea el flip, la huella espera al siguiente viaje; nueva partida/carga (objeto Player distinto) → runtime limpio.
- HUELLAS CUBIERTAS (tabla final): puente del Bosque (pasado→presente), cobertizo de Lunaris (pasado→presente), lápidas↔flores de Lunaris BIDIRECCIONAL (ts_lapidas tocando flores en el ayer; ts_flores leyendo las lápidas en el hoy), muelle de la Costa (pasado→presente), muelle de la Aldea (pasado→presente), faroles lamp1/lamp2/lamp3 (flags motor → presente), ecos menores ts_eco_<id> (cualquier dirección).
- 3) NPCs DUALES: Brisa (Lunaris), Mara (farera, Costa) y Mera (Espectro de Merrow, Aldea) — al cambiar de época a <6 tiles, 3 s de duelo de versos: 6 floats escalonados cada 0.55 s alternando línea de presente (azulada) y de pasado (dorada), t 1.2 s / vy -5 → 2-3 líneas visibles SOLAPADAS sobre la NPC; cooldown 30 s por NPC (WeakMap<Npc, clock> con RELOJ PROPIO del módulo — g.globalT solo avanza en el RAF, no en hums). Map change a mitad de duelo → el duelo se cancela (npc ya no está en g.npcs).
- 4) RESIDUOS DEL CANTO: pool fijo de 10 ranuras (estilo fx.ts, cero allocations por frame — la ranura decide CUÁNDO/DÓNDE; cada spawn entra al sistema de partículas del motor como el polvo de pasos). Spots por mapa CACHEADOS (Map<MapId>): centros de celdas 4×4 de epochDiffs + faroles (gate: en presente solo si flags.lampN encendida; en pasado siempre). Solo spots visibles en cámara (selección en 2 pasadas + índice rotatorio, sin arrays temporales). Presente: motas doradas DESCENDENTES (#ffe9a0/#f0d890, vy +14..26); pasado: notas tenues ASCENDENTES (#c8b0e8/#ffd88a, vy −12..22, grav −6). Cap vivo ≤ 30 (<40 pedido) + guard global si g.particles > 240 (el combate manda). Render SIN tocar render.ts: todo sale por los canales públicos g.waves/g.particles/g.floats/g.toast/g.flashT.
- Smoke scripts/smoke_timeskip.ts (stub patrón smoke_desafio + Game real; newGame()+startPlay() — newGame deja 'intro' y SIN mapa, ojo): 5 bloques / 40 checks — (1) veto: epochSwitch NO cambia época, sin FX, frase rotativa ×3 distintas, sacudida, a ≥5 tiles ya veta no; (2) sin amenaza → true, época la alterna el MOTOR, onda doble dmg 0 + flashT 0.12 + 18 notas, 120 frames sin lanzar en lunaris/pasado y bosque/presente; (3) lamp1+eco menor → frase UNA vez (ts_ flags) y segunda vuelta muda; cobertizo: adquisición pisándolo en el ayer («toma nota») → recuerdo al aterrizar y no-repetición (NOTA: los lobos del valle patrullan junto al cobertizo — el veto los bloquea el retorno, comportamiento correcto; el smoke limpia enemies); (4) Brisa cerca (3 líneas solapadas) / cooldown / lejos / tras 30 s vuelve, y Mera en la aldea; (5) 600 frames con 2 flips + huellas bidireccionales sin lanzar, partículas máx 36, floats ≤2, toasts ≤4, ondas ≤2, ts_flores+ts_lapidas verificadas y sin falsos positivos. FIXES durante el smoke: (a) reloj propio en vez de g.globalT (no avanza sin RAF); (b) recuerdo de huella de otro mapa ahora se entrega sobre el Portador en vez de descartarse (los faroles de Merrow se recuerdan aunque vuelvas a Lunaris); (c) asserts de versos por firma «...» para no colisionar con los rumores ambientales de 13-b, que aparecieron a mitad de sesión.

Verificación:
- bunx tsc --noEmit 2>&1 | grep -E "src/(game|components)" → VACÍO (0 errores).
- bunx eslint src/game/timeskip.ts scripts/smoke_timeskip.ts → 0 errores, 0 warnings (bun run lint tiene 1 warning en scripts/smoke_worldlife.ts del agente 13-b, archivo ajeno en curso).
- bun scripts/smoke_timeskip.ts → SMOKE TIMESKIP: TODO OK (40 checks).
- Regresión: smoke_desafio TODO OK, smoke_balance TODO OK, smoke_arbol VERDE, smoke_acto2 0 fallos, smoke_motor_acto2 0 fallos; bun build --target=browser engine.ts → 0.47 MB (grafo resuelve; timeskip⇄engine sin problema: solo valores ESM en alcance de función).
- NO navegador (protocolo).

Archivos tocados: src/game/timeskip.ts (esqueleto → implementación completa; exportaciones timeTick/beginEpochShift intactas). Nuevo: scripts/smoke_timeskip.ts.

CÓMO PROBARLO EN JUEGO: 1) consigue el Eco (fragmento de la Ruina Antigua del Bosque, q2 → «pulsa Q»); 2) pulsa Q: doble onda + flash dorado/azulado + notas ascendentes + capa sonora sobre elEpoch + banner de época del motor; 3) VETO: deja que un lobo de Niebla te aggro y pulsa Q → frase evocadora + sacudida; aléjate >5 tiles y reintenta; 4) HUELLAS: en el AYER cruza el puente del Bosque, rodea el cobertizo SO de Lunaris y pisa las flores de (17-18,20) → «...el ayer toma nota...» al pisar y frase evocadora al VOLVER (una vez por huella, persiste en save); en el HOY lee esas mismas lápidas y viaja → el pasado recuerda las flores; enciende los 3 faroles de Merrow (aldea, ayer) y vuelve → el mundo recuerda cada farol; toma un eco menor (p.ej. el pozo de los nombres) y viaja → «Un eco que arrancaste tiembla aún...»; 5) DUALES: quédate a <6 tiles de Brisa (Lunaris), Mara (Costa) o Mera (Aldea) y pulsa Q → 3 s de versos superpuestos presente/pasado (cooldown 30 s); 6) RESIDUOS: quieto junto a cualquier resto de epochDiffs en cámara (puente roto, ruinas del cobertizo, plaza del festival): motas doradas caen en el presente, notas tenues suben en el pasado.

Stage Summary:
- Viajar con Q es ahora un acontecimiento: onda doble + flash por destino + notas + capas de sonido, veto narrativo si hay colmillos cerca, un mundo que RECUERDA una vez por huella lo que tocaste en la otra época (faroles, puente, cobertizo, lápidas/flores, muelles, ecos menores — persistente en ts_*), NPCs duales que cantan en dos tiempos cuando cambias de hora junto a ellos, y residuos del canto que mantienen viva la memoria del mapa. tsc 0, lint 0 (lo mío), smoke_timeskip 40/40, smokes previos en verde. Sin tocar ningún archivo congelado.
---
Task ID: 13-b
Agent: general-purpose (mundo-vivo)
Task: Que el mundo respire aunque el jugador no avance: fauna ambiental (pájaros/mariposas/luciérnagas/peces), rumores dinámicos de NPCs según progreso REAL, eventos callejeros (viajante errante / eco lejano / ráfaga por bioma) y micro-interacciones con props. SOLO src/game/worldlife.ts (+ scripts/smoke_worldlife.ts).

Work Log:
- Leído el final del worklog (Tasks 12, 12-a, 12-b, 12-int, 12-push) y grepeado el motor antes de escribir: worldTick YA cableado en engine.ts:210 (play/dialogue); nearestInteract (engine.ts:650) atiende npcs/cofres/santuario/forja/fragmento/altar/carteles/faroles SIN encender → worldInteract atiende SOLO lo que ese pipeline ignora; sfx auditados contra los 40 cases de audio.ts (splash/gust/echo/wraith/lamp — todos existen); dominantTone SÍ está exportado en hooks.ts → import directo (sig: (p) => ToneKind | null, exige total ≥ 3); isNight importado de update.ts (mismo patrón que fx.ts); dayT avanza en update.ts:119 (240 s/ciclo).
- FAUNA (pool fijo de 12 ranuras reutilizadas, patrón fx.ts): AVE (posa en copas de tiles 't'/'p', hop ocasional, HUYE remontando si el Portador se acerca a <46 px o cuando expira su paciencia), MARIPOSA (de día: deriva senoidal anclada, 2 variantes de color, 2 frames de aleteo), LUCIERNAGA (de noche con isNight: glow radial pulsante cacheado), PEZ (Costa: oculto bajo '~', salta cada 4-11 s con gravedad propia, salpicadura g.burst + sfx 'splash' solo a <150 px). Spawn SOLO en cámara (muestreo de ≤5 puntos de vista, valida tile con tileAt por época; aves→'t'/'p', peces→'~', voladoras→no sólido). Cap duro POOL_CAP=12 con contadores O(1) (liveCount + kindCount por especie: aves ≤4, peces ≤3); EN 'pasado' cap 12 e intervalo 1.35 s vs cap 8 e intervalo 2.4 s en 'presente' (la fauna reacciona a g.epoch: más vida en el pasado). Cero allocations por frame (for indexado, sin filter/map en el camino caliente). Cripta y arena sin spawns (SPAWN_OK); al cambiar de mapa las criaturas viejas se desvanecen solas al salir de cámara (margen 44 px).
- RUMORES (en el módulo): NPC a <2.5 tiles → burbuja floatText longevo (t 2.8, vy -6, size 7, tinte según época) cada 8-14 s con cooldown POR NPC (Map nid→reloj propio del módulo; primera vez gracia 2.5-5.5 s). Texto según progreso REAL: questIdx (tramos 0-1/2-4/5-6/7-8/post-acto2), flags guardianDefeated/sirenaDefeated/golemDefeated/ecoNombres/maraGift, weaponPlus ≥5, g.epoch (líneas de Festival en el pasado), y tono dominante vía dominantTone(p) (teo sarcástico, heraldo/ivo amenazante, ilwen/doran empático, vult pragmático). 10 NPCs cubiertos (brisa, toln, teo, heraldo, ilwen, doran, mara, vult, mera, ivo) + 3 genéricas por contexto presente y 3 en pasado. Selección determinista por rotación (sin RNG) → testeable. Silenciados en combate (aggro), diálogo y desafío.
- EVENTOS CALLEJEROS: timer propio 45-90 s (el primero a 38-60 s). Eco lejano: sfx 'echo' (o 'wraith' en cripta) + float '...un eco lejano resuena...' + 8 partículas direccionales cruzando al Portador (g.particles, canal existente). Ráfaga: sfx 'gust' + 12 partículas de hojas/polvo/sal/nieve según bioma entrando por el borde de cámara a favor del viento + float por bioma (cripta: polvo del techo con 'wraith'). Viajante errante: entidad decorativa PROPIA del módulo (sprite primitivo cacheado: capa, capucha, cayado, morral) que cruza la cámara a 46 px/s por la fila del Portador, sin colisión ni registro en g.enemies, con toast de aviso; se marcha sola al salir de vista. Pospone 5 s si diálogo abierto, combate con aggro o challengeRun. No allocations salvo en el instante del evento.
- MICRO-INTERACCIONES (worldInteract): 7 features en 5 categorías — (1) TILES 3×3 alrededor: pozo 'w' (presente: «devuelve solo silencio» / pasado: «susurra un nombre»), lápida 'g', roca 'R' (el pasado conserva la talla del Primer Canto), agua '~' con splash (burst + sfx 'splash' + frase por mapa y época: lunaris/bosque/costa/aldea/cumbres); (2) PROPS que nearestInteract ignora: naufragio 'wreck' y faro 'faro' (texto según flags.maraGift y época), farol 'lamp' YA encendido → chispazo (burst #ffe9a0; de noche burst doble + sfx 'lamp'). NUNCA roba NPCs, cofres, santuarios ni faroles sin encender (los gestiona el motor). Todo es float+partículas, sin diálogos ni flags: cero riesgo de progreso.
- DIBUJO: drawWorldLife(g, sx?, sy?) con primitivas canvas CACHEADAS perezosamente en el módulo (pájaro 2 frames, mariposa 2 frames × 2 colores, glow de luciérnaga, viajante) — sprites.ts intacto. Sin contrato cableado NO se dibuja nada (worldTick sola no pinta: render va después de update).

CONTRATO DE INTEGRACIÓN EXACTO (2 líneas para el integrador; rumores y eventos ya funcionan solo con worldTick):
1) FAUNA/VIAJERO — render.ts · drawWorld, justo tras el bucle de cofres (después de `ctx.drawImage(sprC, …)`), ANTES de drawWaterGlints de overlays si se prefiere bajo la luz; línea exacta:
     drawWorldLife(g, sx, sy); // 13-b fauna del mundo
   (sx/sy son los helpers de drawWorld; acepta llamarse sin ellos — calcula los suyos de g.camX/camY — y es no-op si no hay criaturas o el Game nunca hizo worldTick. Import: `import { drawWorldLife } from './worldlife';`)
2) MICRO-INTERACCIONES — engine.ts · tryInteract (línea 1248), forma final exacta:
     tryInteract() {
       const it = this.nearestInteract();
       if (it) { audio.sfx('select'); it.act(); }
       else if (worldInteract(this)) { audio.sfx('select'); }  // ← 13-b: única línea nueva
       else this.toast('No hay nada que interactuar aquí.', '#9aa0b8');
     }
   + ampliar el import de engine.ts:21 a `import { worldTick, worldInteract } from './worldlife';`
   Semántica: worldInteract devuelve true SOLO si consumió la interacción (entonces el motor NO muestra 'No hay nada…'). Es idempotente, no abre diálogos, no toca flags ni quests.

Verificación (protocolo: NO navegador):
- bunx tsc --noEmit 2>&1 | grep -E "src/(game|components)" → VACÍO (0 errores en todo el proyecto).
- bun run lint → exit 0 (0 errores, 0 warnings).
- bun scripts/smoke_worldlife.ts → 31/31 checks TODO OK: (1) worldTick 600 frames × 3 mapas (lunaris/costa/cumbres) × 2 épocas × con/sin enemigos sin lanzar (incluye drawWorldLife con ctx stub), (2) cap respetado (12 pasado / 8 presente), spawn solo en cámara (±64 px verificado), mariposas de día / luciérnagas de noche con g.dayT, peces en Costa, cripta sin fauna, (3) rumor disparado junto a Brisa (gracia 2.5-5.5 s), cooldown por NPC (nada en 5 s posteriores; ventana 8-14 s), pool y texto cambian con questIdx 0→9 simulado, tono sarcástico afecta a Teo, 10 NPCs cubiertos, sin rumores en combate, (4) worldInteract: pozo true con variante presente/pasado, agua con splash de partículas, false en zona libre verificada por tiles, faro true, farol sin encender NO robado, farol encendido chispea, (5) eventos pospuestos con aggro/diálogo/desafío (reto REAL via startChallenge), disparo al liberar, eco con float+partículas, viajante activo y auto-despawn.
- Regresión: smoke_desafio, smoke_acto2, smoke_motor_acto2, smoke_balance, smoke_arbol → todos en verde. bun build --target=browser src/game/engine.ts → OK (grafo con worldlife→update/hooks/maps/sprites/audio sin ciclos nuevos).
- NO navegador (protocolo).

Archivos tocados: src/game/worldlife.ts (esqueleto de 21 líneas → implementación completa de 859 líneas; exportaciones del esqueleto INTACTAS: worldTick/worldInteract + nuevas drawWorldLife, worldlifeStats y helpers dev/smoke __wlArmEvent/__wlRumorPool/__wlResetAll). Nuevo: scripts/smoke_worldlife.ts (excluido de tsconfig, solo dev/CI con bun). CERO toques en engine/update/render/screens/types/data/hooks/challenge/skilltree/balance/timeskip/sprites*/audio/fx*/ui/maps.ts — maps_expansion.ts intacto (no hizo falta ningún prop nuevo).

Stage Summary:
- Aelthar respira: pájaros que huyen al acercarte, mariposas de día y luciérnagas de noche, peces que salpican en la Costa (doble de vida en el pasado), NPCs que murmuran lo que TU partida ha vivido (misión, jefes, época, tono), viajantes que cruzan el camino, ecos lejanos y ráfagas por bioma cada 45-90 s, y pozos/faroles/naufragios que contestan al pulsar E. Presupuesto respetado: ≤12 criaturas, O(1)/frame, cero GC en el camino caliente, pools como fx.ts, todo dentro de worldlife.ts. tsc 0, lint 0, smoke 31/31 + 5 smokes de regresión verdes.

---
Task ID: 13-a
Agent: general-purpose (historia-acto3) — sesión agotó contexto ANTES de smoke/worklog; entrada reconstruida por el integrador tras verificar y completar.
Task: ACTO III "El Canto al Revés" (q11-q13): continuación de la historia tras q10.

Work Log (verificado por el integrador):
- data.ts (bloque delimitado 13-a): misiones q11 'El Canto al Revés' (Toln marca 3 lugares → 3 Ecos Invertidos: pozo de Teo, Ruina Antigua, orilla de Mara), q12 'La Aldea sin Ayer' (Merrow sin recuerdos → 3 recuerdos de 4 aldeanos en cualquier orden), q13 'La Primera Portadora' (Velmora revela: la Orden mató a Aelthar por MISERICORDIA — cada nota del Canto costaba una vida del pasado; Velmora fue la PRIMERA Portadora) + decisión de reputación (verdad→Orden+10/Guardianes-5, silencio→al revés, anti-farm) + jefe ÉLITE 'Guardián recordado' (makeEnemy guardian en la cripta) + memoria VI mem_cantoalreves.
- hooks.ts: handlers accept_q11/q12/q13, acto3_toln, acto3_eco1/2/3 (flags idempotentes ecoInvTeo/Doran/Mara), acto3_mera_ayer + acto3_rec_mara/ivo/vult (recMera/Mara/Ivo/Vult), acto3_verdad/silencio, acto3_velmora_fn, acto3_subir (loadMap cripta + élite + bossActive + toast), acto3_report (pagos UNA VEZ con flags acto3Paid11/12/13: +60/+80/+100 coronas y +1 poción; q13 además memoria + acto3Done) y acto3CatchUp (watcher idempotente O(1) al inicio de handleCustomAction: completa pasos por ESTADO aunque se juegue fuera de orden; detecta ACTO3_ELITE.ref.dead).
- Diálogos nuevos con ramas de tono (dominantTone) y nodos acto3_* encadenados.
- Integrador: smoke_acto3.ts (6 bloques: estructura, flujos en orden, fuera de orden, caso D, anti-doble-pago, memoria una vez) — TODO OK. Correcciones del smoke: pump con acción desconocida (rep_/flag_/memory_ retornan ANTES del catchUp), matar a ACTO3_ELITE.ref (enemies.find cogía al Guardián de campaña y disparaba la cinemática del Acto I) y ticks de update para procesar la muerte. smoke_acto2 actualizado: 13 misiones, 6 memorias, 17 acciones nuevas del Acto III en el validador de handlers.

Stage Summary:
- Acto III jugable y verificado: cadena q11→q13 completa con anti-bloqueo fuera de orden, jefe élite con barra de quiebre, memoria VI y cierre 'acto3Done'. 8/8 smokes en verde, tsc 0, lint 0. Cómo probar: tras acto2Done, hablar con Brisa (q11) → Toln (bosque) → 3 ecos invertidos → Brisa (q12) → Mera/Mara/Ivo/Vult (3 recuerdos) → Brisa (q13) → Velmora en la Cripta → decisión → acto3_subir (jefe élite) → Brisa → cierre.

---
Task ID: 13-int
Agent: Super Z (agente principal — integrador Ronda B)
Task: Integrar y verificar la Ronda B (13-a historia/Acto III, 13-b mundo vivo, 13-c inmersión temporal) + contratos de integración.

Work Log:
- Contratos de 13-b aplicados: (1) engine.tryInteract — fallback worldInteract(g) con sfx select (pozo, lápidas, roca, agua '~', props wreck/faro, faroles encendidos); (2) render.ts drawWorld — drawWorldLife(g, sx, sy) tras los cofres (fauna: aves/mariposas/luciérnagas/peces con cap 12, viajante errante, eventos 45-90s, rumores de 10 NPCs con cooldown).
- 13-c ya auto-integrado (timeTick + beginEpochShift cableados en Task 12-glue): veto narrativo con enemigo aggro <5 tiles (3 frases rotativas + shake), transición (doble onda + flash teñido por destino + 12 notas), huellas que cruzan épocas (lamp1..3, puente, cobertizo, lápidas↔flores, muelles, ecos menores — UNA vez por huella, flags ts_* serializadas), NPCs duales (Brisa/Mara/Mera, 30s cooldown), residuos del canto (pool 10, cap ≤30).
- 13-a integrada (ver Task 13-a). smoke_acto3 nuevo; smoke_acto2 actualizado (13 misiones / 6 memorias / acciones del Acto III).
- Regresión FINAL: 8/8 smokes verdes (acto2, acto3, motor_acto2, desafio, arbol, balance, worldlife, timeskip), tsc 0 en src/, lint 0.

Stage Summary:
- Ronda B integrada: Acto III completo, mundo vivo (fauna/rumores/eventos/micro-interacciones), viaje temporal con veto, transición cinematográfica, huellas entre épocas y NPCs duales. Push a rama expansion-v0.4 tras este commit.

---
Task ID: 14
Agent: Super Z (agente principal — integrador Ronda 14)
Task: Completar la ronda 14-a/14-b a medio integrar de la sesión anterior (jefes Vult y El Coro Roto, Eco Desgarrado y Sátiro, sistema de armaduras) + auditoría de combate + push a GitHub.

Work Log:
- Diagnóstico: la sesión anterior murió a mitad de integración — enemies_expansion.ts usaba T_VULT/T_CORO/caeMascara sin definición (6 errores tsc), armor.ts sin cablear (sin reducción en damagePlayer, sin compra, sin panel), árbol de habilidades con nodos de cd MUERTOS (decay OFF sin camino B aplicado) y smoke_motor_acto2 crashando en antiStuck.
- 14-a COMPLETADA: constantes T_VULT/T_CORO exportadas; cerebros tickVult (ciclo rafaga/embiste/salto + tajo melé + MODO ACECHO fase 3 cada 8s con teleport a la espalda), tickCoro (3 máscaras: EL PULSO orbes+onda, EL VERA rayos en cruz cardinal↔diagonal, EL SILENCIO lluvia de notas; caeMascara al quebrar barra con latch maskRoto), tickEcodesg (parpadeo al flanco alternante + dash) y tickSatiro (balada curva: telegraph 'aro' dmg 0 como marca + orbe real); deathVult/deathCoro en expansionDeathFx; expansionBossWatchers (spawn+activación de barra estilo update.ts:398); spawns de mapa vía mutación de MAPS con guarda anti-HMR; dispatcher con 4 tipos nuevos.
- Cableado: types.ts EnemyType +4 ids; data.ts ENEMY_DEFS → Record<string,EnemyDef>; update.ts EXPANSION_TYPES + deathFx vult/coro + llamada a watchers; engine.ts makeEnemy tamaño jefe, killEnemy con botín/música/toasts de Vult (+1 poción +40 coronas) y Coro (+1 poción +60 coronas), BOSS_DEFEAT_FLAG.
- 14-b COMPLETADA: damagePlayer con reducción de armadura (después del balanceador, antes de Vigia: max(1,round(bm·(1-red)·(1-vig)))) + reflejo Manto de Ecos 15% solo melé (origen en cuerpo de enemigo); applyAction case 'armor_N' (compra con gate acto3Done en la Guarda del Primer Canto); diálogo toln_armaduras + opción en TOLN_MAIN; drawArmorRow en pausa ESTADO (py+440, contrato armor.ts).
- Auditoría de combate: camino B del árbol aplicado de verdad (useSkill: cds[i] = sk.cd · skillCdMult(p) — los nodos Refrán Veloz/Cadencia Arcana vuelven a funcionar); guard antiStuck(!rows.length) para estados pre-loadMap; fix de spawn de orbe del sátiro en tile sólido (probaba boca→centro→empujón direccional).
- Smokes actualizados: smoke_acto2 (prefijo ENGINE armor_), smoke_desafio (hp 380→440 buff 14-a auditable), smoke_arbol (mensaje camino B).
- Verificación: tsc 0 en src/, lint 0, 8/8 smokes verdes con bun, E2E agent-browser (Vult: spawn nocturno+banner+combate sin loopError; Coro: máscara coro1→coro2 al quebrar; armaduras: compra 500→420 coronas, reducción A/B 8→6 dmg con Guarda tier 5, panel visible en captura; sátiro: orbe vuela y daña; ecodesg vivo en bosque; loopError null siempre).
- PUSH BLOQUEADO: token ghp_1vxL6...S5YOl del usuario devuelve 401 Bad credentials (revocado o inválido). Commit local 509d99e listo en main. Credenciales temporales borradas del disco. PENDIENTE: token nuevo válido del usuario para empujar.

Stage Summary:
- Ronda 14 íntegra y verificada: 2 jefes nuevos (caza nocturna + post-Acto III), 2 enemigos de mapa con cerebro, sistema de 5 armaduras completo (compra/efectos/panel), árbol de habilidades con cds operativos, sin regresiones (8/8 smokes + E2E). El push espera token válido: el commit 509d99e está en el repo local (.zpackage/ecos-de-aelthar, main).

---
Task ID: 15
Agent: Super Z (agente principal — integrador de fusión + push)
Task: Fusionar el trabajo del agente visual del usuario (módulos world/ v2 en el remoto) con Ronda B + Ronda 14 locales, verificar sin regresiones y hacer push con el token nuevo.

Work Log:
- Diagnóstico de divergencia: base común ab61a49; remoto = base + 3 commits del agente visual (ec9de18, dd22cf3 refactor world/ con autotiling, 3b65d17 merge de expansion-v0.4); local = base + Ronda B (dd8f440) + Ronda 14 (509d99e). Solapamiento: engine.ts, sprites.ts (solo suyo), timeskip.ts, worldlife.ts.
- Causa raíz de los conflictos add/add: en la rama remota expansion-v0.4 el engine.ts importaba timeTick/beginEpochShift/worldTick pero timeskip.ts/worldlife.ts NUNCA se subieron (push anterior bloqueado por token 401); el agente visual reconstruyó stubs no-op desde el contrato documentado. Nosotros teníamos las implementaciones reales (451/859 líneas).
- Resolución: se conservan NUESTRAS versiones completas (superconjunto estricto de los stubs; exports idénticos). engine.ts y sprites.ts se fusionaron auto (drawTile/drawTallTile v2 con callback de vecinos para autotiling — sin romper firmas).
- Verificación integral: tsc 0 errores (sin filtros), sin marcadores de conflicto, 8/8 smokes verdes con bun (acto2, acto3, arbol, balance, desafio, motor_acto2, timeskip, worldlife), E2E agent-browser: newGame+startPlay, recorrido lunaris→bosque→costa→aldea→cumbres→cripta con loopError=null en todos, capturas verificadas (cripta con oscuridad+luz OK, aldea con tejados v2+minimapa+fauna OK, sin barra negra).
- Commit de fusión f56c02b; PUSH EXITOSO a main con token nuevo del usuario (3b65d17..f56c02b), verificado con ls-remote (remoto = f56c02b). Credenciales NO persistidas en disco (push por URL one-shot).
- Capturas de evidencia en /home/z/my-project/download/merge_e2e_cripta.png y merge_e2e_aldea.png.

Stage Summary:
- El repo remoto queda integrado y al día: trabajo visual (world/ ×11 módulos, minimapa, cielo, clima, autotiling) + todo el contenido de juego (Acto II+III, 4 jefes nuevos, armaduras, árbol, balanceador, desafío, mundo vivo, inmersión temporal). Estado: tsc 0, smokes 8/8, E2E limpio. PENDIENTE para el usuario: REVOCAR el token ghp_6d3Y... (tercera credencial expuesta en el chat).

---
Task ID: 16-c
Agent: general-purpose (logros-stats-menu)
Task: Panel de estadísticas, 12 logros persistentes y menú de título ampliado

Work Log:
- Leído worklog.md COMPLETO ( Tasks 1-15, con foco en 12/13/14/15: glue GState, contrato challenge/balance, fusión world/ v2) y estudiados screens.ts (título/paneles/anti-clic-fantasma), challenge.ts (récords 12-a), balance.ts, engine.ts (save/load 'ecos-aelthar-save', patrón 'ecos-vol'), types.ts, hooks.ts/data.ts (verificado: NO existía ningún flag del Acto IV al empezar).
- NUEVO src/game/achievements.ts (504 líneas, patrón balance.ts/challenge.ts): (1) STATS — defaultStats/sanitizeStats (defaults seguros campo a campo), statsTick (tiempoJugado += dt; corre en Game.update que SOLO corre en play/dialogue; memoriasHalladas = p.memories.length); (2) LOGROS — 12 definiciones con ids, Set en memoria cargado perezosamente de localStorage con tolerancia a JSON corrupto/legacy/array, desbloqueo IDEMPOTENTE (tryUnlock: Set + persist + toast dorado '¡Logro: <nombre>!' + sfx 'levelup' existente), achievementTick O(1) con early-out por contador de pendientes; (3) MARCAS DEL DESAFÍO — recordChallengeTime con top 3 por clave en 'ecos-desafio-récords' (duelos: menor tiempo mejor; oleadas: mayor supervivencia mejor), recordChallengeResult; (4) PANELES del título — drawStatsPanel (cifras del ÚLTIMO guardado leídas de 'ecos-aelthar-save' SIN arrancar partida, fallback stats de player.kills/deaths/playTime para saves antiguos, sección 'MEJORES MARCAS DEL DESAFÍO' con récord de oleadas + top 3 tiempos por desafío, 'Aún no hay partidas.' si no hay save) y drawLogrosPanel (rejilla 2×6 con contador X/12 arriba), ambos con el MISMO lenguaje visual que el menú del Desafío (ui.ts COL/panel/button, overlay que limpia g.uiHit, cierre con ESC o VOLVER).
- types.ts: StatsData (10 campos: enemigosDerrotados, jefesDerrotados, muertes, coronasGanadas, coronasGastadas, pocionesUsadas, vecesCambioEpoca, distanciaAndada, tiempoJugado, memoriasHalladas) + SaveData.stats OPCIONAL (compatibilidad con saves antiguos).
- engine.ts (15 bloques delimitados // ==== 16-c ====): g.stats con default; newGame reset; continueGame restaura con sanitizeStats; save() serializa stats dentro del guardado + ESPEJO 'ecos-stats' (patrón try/catch de 'ecos-vol'); instrumentación con guard `!this.challengeRun` (la arena no contamina la campaña, filosofía 12-a): killEnemy (enemigosDerrotados, coronasGanadas += gold, jefesDerrotados via BOSS_DEFEAT_FLAG — cubre futuros jefes —, chequeo puntual achievementTick), playerDied (muertes), drinkPotion (pocionesUsadas), epochSwitch (vecesCambioEpoca SOLO si el viaje real ocurre, tras el veto de 13-c), openChest/grantQuestLoot (coronasGanadas), forge/buy_potion/armor_N exitosos (coronasGastadas), moveEntity (distanciaAndada = desplazamiento REALMENTE aplicado del Portador; moveEntity es la única puerta del movimiento); Game.update llama statsTick + achievementTick (O(1), early-out).
- challenge.ts (2 bloques 16-c en finish()): captura hpRatio ANTES de restoreCampaign y llama recordChallengeResult DESPUÉS de limpiar toasts → guarda la marca de tiempo del reto ('ecos-desafio-récords') y concede RONDADOR (victoria con vida > 70%). Duelos solo registran en victoria; oleadas registran al completar (caer tras N oleadas).
- Logros Acto I-III por ESTADO en achievementTick: Corazón de Alba (questIdx >= 5), Notas Perdidas (acto2Done), Canto al Revés (acto3Done), Invicto (Nv 5 && deaths === 0), Rico (gold >= 500), Alquimista (pocionesUsadas >= 10), Viajero del Tiempo (vecesCambioEpoca >= 10), Primer Canto (enemigosDerrotados >= 1), Cazador de Ecos (takenEchoes.size >= 5), Rompejefes (3+ flags de BOSS_DEFEAT_FLAG). En la arena (challengeRun) el tick NO desbloquea logros de campaña (Rondador va por evento).
- ÚLTIMA NOTA / Acto IV: verificado en hooks.ts/data.ts que NO existía flag del acto IV → logro con nombre dinámico 'El Último Canto (próximamente)', imposible de desbloquear, con detección TOLERANTE (try/catch) de flags futuros: candidatos acto4Done/acto4/actoIVDone/acto4Report/acto4Seen/finalActo4 en g.flags o propiedades del Game. NOTA de coordinación: el agente 16-a está añadiendo el Acto IV EN PARALELO en esta misma sesión y usa 'acto4Done' — primer candidato de mi lista: al cablear acto4_report el logro se activará y renombrará SOLO. El agente 16-b (interacción, en paralelo) ya usó mi contador coronasGastadas para la compra del señuelo (engine.ts, '16-c: espejo').
- screens.ts: título ampliado — rejilla secundaria 2×2 con CONTROLES/DESAFÍO/ESTADÍSTICAS/LOGROS (botones de 126×34, tamaño 9, hoverCorners, con y sin save), drawTitlePanels(g) tras drawChallengeTitleUi en el case 'title' (limpia uiHit → título de fondo inalcanzable mientras un panel está abierto, mismo blindaje anti-clic-fantasma), versión v0.3.0 → v0.5.0.
- scripts/smoke_logros.ts (bun, stub DOM + Game real, localStorage respaldado en /tmp, fase 'load' en proceso nuevo): 53+7 checks en 6 bloques — (1) desbloqueo ÚNICO (2 ticks extra no duplican toast ni registro; 'ecos-logros' con el id una sola vez), (2) stats acumuladas reales (killEnemy lobo+jefe, drinkPotion, playerDied+respawn, moveEntity jugador SÍ/enemigo NO, epochSwitch, forge 30, buy_potion 15, grantQuestLoot, statsTick; save() serializa stats y espejo; continueGame restaura; sanitizeStats tolerante), (3) JSON corrupto en las 4 claves sin crash ('ecos-logros' basura/forma inválida/ids desconocidos, 'ecos-desafio-récords', 'ecos-stats', save corrupto → readLastSave null + continueGame no lanza), (4) recordChallengeResult: Rondador con 80% de vida SÍ y con 50% NO, top 3 duelos ordenado y recortado ([60,80,95], el 120 cae), oleadas mayor-mejor, (5) paneles dibujados con ctx stub sin excepciones con save y sin save, (6) persistencia real entre procesos (fase 'load' recarga logros/marcas/save del disco).

Stage Summary:
- Menú de título ampliado con ESTADÍSTICAS y LOGROS (paneles overlay estilo Desafío, ESC/VOLVER, sin clics fantasma) + 12 logros persistentes con toast dorado y sfx, estadísticas de partida serializadas en el save (SaveData.stats, defaults seguros) y espejo 'ecos-stats', y top 3 de tiempos del desafío en 'ecos-desafio-récords'.
- CONTRATOS para el integrador/agentes futuros: (1) claves localStorage nuevas: 'ecos-logros' ({v, done: string[]}), 'ecos-stats' (espejo StatsData), 'ecos-desafio-récords' ({v, times: Record<clave, number[]>} — claves 'oleadas' y 'duelo:guardian|sirena|golem'); (2) hooks en el motor YA cableados: Game.update → statsTick+achievementTick (O(1), sin wiring pendiente), Game.save() escribe stats y espejo, challenge.finish() → recordChallengeResult; (3) flag del Acto IV: al existir 'acto4Done' (u otro candidato en achievements.ts ACTO4_FLAGS) el logro 'El Último Canto' se activa solo; (4) para añadir logros: una entrada en LOGROS + su condición en achievementTick (el panel y el contador crecen solos).
- Verificación: `npx tsc --noEmit` → 0 errores en todo el proyecto (grep filtrando examples/ y skills: 0); eslint de mis 6 archivos → 0 errores/0 warnings; bun build --target=browser engine.ts → resuelve (627 KB, ciclo achievements⇄engine seguro, patrón challenge.ts). SMOKE LOGROS: TODO OK (main 53 ✓ + load 7 ✓). smokes de regresión verdes: desafio, acto3, motor_acto2, balance, arbol, timeskip, worldlife. smoke_acto2 falla (25) EXCLUSIVAMENTE por el trabajo EN CURSO del agente paralelo 16-a (nodos acto4_* de data.ts con handlers sin cablear en hooks.ts + QUESTS.length 16 vs 13 + 'buy_sennuelo' de 16-b): ningún fallo es de 16-c (mi sesión dejó smoke_acto2 en 0 fallos con TODO mi código ya integrado; todos los ✗ actuales citan acto4/sennuelo y mis cambios no tocan data.ts ni hooks.ts). Se irán a verde cuando 16-a/16-b cableen sus handlers y actualicen el conteo, como hicieron 13-a/14.
- CÓMO PROBAR EN JUEGO: 1) título → ESTADÍSTICAS con partida guardada muestra las cifras del último save + marcas del desafío (sin save: 'Aún no hay partidas'); 2) título → LOGROS: 0/12 al empezar, la lista persiste entre sesiones; 3) mata 1 enemigo → toast dorado '¡Logro: Primer Canto!'; sube a Nv 5 sin morir → Invicto; llega a 500 coronas → Rico; bebe 10 pociones → Alquimista; pulsa Q 10 veces (con Eco) → Viajero del Tiempo; escucha 5 ecos menores → Cazador de Ecos; termina Acto I/II/III con Brisa/Velmora → Corazón de Alba/Notas Perdidas/Canto al Revés; 3 jefes → Rompejefes; 4) gana un duelo del Desafío con >70% de vida → Rondador, y su tiempo entra en el top 3 visible en ESTADÍSTICAS; 5) guarda en Santuario y comprueba que las cifras aparecen en el panel del título.

---
Task ID: 16-a
Agent: general-purpose (historia-acto4) — sesión agotó contexto DESPUÉS de terminar el código y su smoke; entrada reconstruida por el integrador tras verificar.
Task: ACTO IV 'El Último Canto' (q14-q16): cierre de la historia.

Work Log (verificado por el integrador):
- data.ts (bloque delimitado 16-a): misiones q14 'Las Campanas de Antes' (Toln forja la campana + voz de Merrow + resonancia en Cumbres; flags camToln/camMera/camCumbres), q15 'La Sala del Primer Canto' (jefe final Vesh, la Última Nota en la Cripta, gate acto3Done) y q16 'El Eco que Elegiste' (epílogo ramificado por reputación Orden/Guardianes y verdad/silencio del Acto III + memoria VII mem_ultimacanto).
- hooks.ts: handlers accept_q14/q15/q16, pasos de cada misión con flags idempotentes, acto4_catchUp (watcher anti-bloqueo fuera de orden, patrón acto3CatchUp), pagos únicos acto4Paid14/15/16 y spawn del jefe final (loadMap cripta + bossActive + toast, patrón acto3_subir).
- Diálogos acto4_* con ramas dominantTone encadenadas con los NPCs existentes.
- SMOKE scripts/smoke_acto4.ts: estructura, flujos en orden y fuera de orden, anti-doble-pago, informe tras jefe caído, epílogo por flags espejo — TODO OK.
- smoke_acto2 actualizado (16 misiones / 7 memorias / acciones del Acto IV en el validador).

Stage Summary:
- Acto IV jugable y verificado: q14→q16 con anti-bloqueo, jefe final con barra, memoria VII y cierre de la historia por ramas de reputación. smoke_acto4 verde. Cómo probar: tras acto3Done hablar con Brisa (q14) → Toln/Merrow/Cumbres (3 campanas) → q15 Guarda del Primer Canto (Sala + Vesh) → Brisa (q16) → epílogo según verdad/silencio y reputación.

---
Task ID: 16-b
Agent: general-purpose (interaccion-companeros) — sesión agotó contexto con el código INTEGRADO pero su smoke sin cerrar (5 fallos); entrada reconstruida por el integrador, que completó los 2 arreglos finales.
Task: Órdenes tácticas de compañero (T) + señuelo (8) + restos examinables + cofres vacíos + rumores.

Work Log (verificado/completado por el integrador):
- src/game/interaccion.ts NUEVO (583 líneas): cycleCompanionMode (seguir→agresivo→defensivo, toasts+sfx), companionOrdersMove (agresivo: busca enemigo con aggro en 6 tiles, retirada <30% vida; defensivo: guarda a 2 tiles), companionInterpose (50% del daño melé a la compañera a <1.5 tiles, cd 6 s, convención Manto de Ecos), useSenno (tecla 8, pool de 1, atrae enemigos no-jefe 5 s, jefes y bossActive inmunes), registerCorpse16b (anillo cap 12, ttl 30 s), bossSennoLoot16b (8% +1 señuelo), interaccionInteract16b (restos 25% 1-5 coronas una vez por cadáver + cofres abiertos 'vacío… pero huele a antes'), rumores por mapa (10 líneas × 6 mapas, ventana 2.5 s tras diálogo, cd 60 s por NPC), interaccionTick O(1).
- Cableado completo en engine.ts (teclas T/8, tryInteract, killEnemy, damagePlayer, closeDialogue, save/load companionMode) y update.ts (interaccionTick, dispatch de movimiento, filtrado defensivo de disparos, sennoChase).
- COMPLETADO POR EL INTEGRADOR: (1) interaccion.ts nunca leía el flag examined → añade 'if (c.examined) continue' para que re-examinar caiga en el mensaje por defecto (anti-farm); (2) el smoke probaba 'compañera lejos' con un helper que la recolocaba CERCA → corregido el smoke con golpe manual a 60 px. smoke_interaccion 0 fallos.

Stage Summary:
- Interacción total operativa: T cicla órdenes (con serialización en save), 8 lanza señuelo (jefes inmunes), E examina restos (una vez), cofres abiertos cuentan su historia, NPCs largan rumores al re-pulsar E. Verificado en vivo (agent-browser) y con smoke propio verde + batería completa 11/11.

---
Task ID: 16-int
Agent: Super Z (agente principal — integrador Ronda 16)
Task: Recuperar el trabajo de los agentes 16-a/16-b (agotaron contexto), cerrar huecos, verificar todo y empujar a GitHub.

Work Log:
- 16-a y 16-b murieron por timeout con el código ya escrito e integrado (tsc 0) pero sin cerrar; 16-c terminó completo. smoke_interaccion tenía 5 fallos → 2 fixes (ver 16-b). Batería final: tsc 0, 11/11 smokes verdes con bun (acto2, acto3, acto4, arbol, balance, desafio, interaccion, logros, motor_acto2, timeskip, worldlife).
- HALLAZGO IMPORTANTE: el dev server sirve /home/z/my-project/src/game (árbol VIVO) y el repo está en .zpackage/ecos-de-aelthar — el E2E de la fusión (Task 15) había validado el árbol viejo por falta de sync. rsync repo→vivo ejecutado y verificado (diff vacío). El E2E en vivo AHORA SÍ valida el código fusionado + Ronda 16.
- E2E en vivo (agent-browser): loopError null, g.stats OK (10 campos), kill→stats 0→1 + logro 'primer_canto' persistido en localStorage, examen de restos (oro +2, toast), señuelo por tecla 8 (flags 1→0), tecla T cicla a DEFENSIVO con toast de orden, menú título v0.5.0 con ESTADÍSTICAS y LOGROS (captura e2e_titulo_v050.png).
- PUSH: commit de la Ronda 16 + push a main con el token del usuario.

Stage Summary:
- Ronda 16 íntegra en el remoto: Acto IV (cierre de la historia), órdenes tácticas + señuelo + restos + rumores, estadísticas + 12 logros + menú ampliado. Estado: tsc 0, smokes 11/11, E2E vivo limpio. Pendiente permanente: el usuario debe REVOCAR el token expuesto en el chat.

---
Task ID: 18-pre
Agent: Super Z (agente principal — integrador Ronda 18)
Task: Recon del estado real tras reset del entorno, fixes quirúrgicos de la lista de bugs (facing, cripta bloqueada) y preparación de la ola de agentes R18.

Work Log:
- ENTORNO: el repo .zpackage/ecos-de-aelthar ya no existe; ahora el árbol vivo y el git son UNO (/home/z/my-project, snapshots automáticos con UUID, SIN remote). Los ficheros R17 descritos en la sesión anterior (sidequests_r17.ts, magias_r17.ts, jefes_r17.ts, enemigos_r17.ts) NO existen en el árbol: ese trabajo se perdió con el entorno. Se re-planifica R18 sobre el árbol real (R16 íntegra: actos I-IV, world/ v2, logros, desafío).
- RECON verificado: mapas lunaris/bosque/cripta/costa/aldea/cumbres/arena; altares con gate narrativo en tryTakeEco (sirenaDefeated/golemDefeated/guardianDefeated) PERO sin barrera física del jefe; jefes de zona con sprites registrados en sprites_expansion.ts (sirena/golem/vult/coro1-3/ecodesg/satiro); merrow_h/merrow_m definidos pero SIN usar.
- FIX 1 (bug «al andar a los lados mira al frente»): sprites.ts — frameIndex y entityFrame solo comparaban dir === 'side', pero e.dir del motor es 'left'/'right' → TODO movimiento lateral dibujaba los frames frontales. Nuevo helper esLateral() aplicado en ambos; el flip de render distingue left/right (ya existía).
- FIX 2 (bug «la cripta está bloqueada por árboles»): NUEVO scripts/smoke_rutas.ts — BFS determinista de accesibilidad peatonal de TODOS los mapas × épocas (salidas, NPCs, cofres, altares): 89 checks. Diagnóstico: el puzzle del ayer (puente roto + Niebla Muda en presente) es diseño (pista brisa_crypt), pero el scatter de pinos podía SELLAR la aproximación a la puerta NO de la cripta en el norte. Fix en buildBosque: corredor garantizado sin pinos (x6..15 × y5..9 + ramales y7/y8 hacia el camino de las Cumbres, sin tocar la Niebla) + cartel sign_b3 (27,13) junto al vado sur que explica el puzzle del puente/ayer.
- Batería: bun scripts/smoke_rutas.ts → 89/89 OK; npx tsc --noEmit → 0 errores.
- Estado de los bugs del usuario: (1) animación NPC al moverse → entidad viajero/NPC usa entityFrame: FIX 1 lo cubre; refino de ciclo en 18-d. (2) facing lateral → FIX 1. (3) retrato de Brisa → agente 18-d. (4) Costa Bruma → 18-a. (5) Cumbres + enemigos/animaciones → 18-b/18-c. (6) faro NPCs iguales → 18-e. (7) altar sin jefe → gate YA existe; barrera física + telegraph → 18-f. (8) transiciones bruscas → 18-f. (9) sprites de mini-jefes nuevos → 18-c. (10) héroe detallado + efectos → 18-d. (11) cripta → FIX 2. (12) push → integrador al cierre (falta token GitHub válido: el remoto NO está configurado en este entorno).

Stage Summary:
- R18 en marcha: fixes de facing y cripta en verde (89/89 rutas, tsc 0). 6 agentes en paralelo: 18-a Costa, 18-b Cumbres, 18-c jefes sprites, 18-d héroe/retratos/fx, 18-e faro NPCs, 18-f historia/transiciones/barrera de altares. Verificación + E2E + commit al cierre.

---
Task ID: 18-c
Agent: general-purpose (sprites-jefes)
Task: Rehacer COMPLETOS los sprites de jefes/minibosses (Sirena Abisal, Gólem de Escarcha, Vult, El Coro Roto ×3 máscaras) y mejorar los enemigos regulares con animaciones nuevas (neumo, espectro, arpi, ecodesg, satiro) — pixel-art más profesional, silueta legible, paleta coherente. SOLO src/game/sprites_expansion.ts (+ scripts/smoke_jefes_sprites.ts nuevo).

Work Log:
- Leído worklog (18-pre, 14, 10-b, 15) y contratos verificados con grep: registerSpr/hash2 (sprites.ts), entityFrame (sprites.ts:259 — n>=2 && moving alterna SOLO 0/1; reposo 0), drawEntity (render.ts:323), e.sprite = `coro${m.maskIdx}` (enemies_expansion.ts:1392), ENEMY_DEFS sprite 'sirena'/'golem' (data.ts:826/833), initExpansionSprites() llamado en engine.ts:203. Nombres que debían sobrevivir intactos: los 14 registrados + las 5 funciones públicas (initExpansionSprites, drawExpansionTile, drawExpansionTallTile, drawExpansionProp, drawExpansionProjectile) — todas conservadas con firma idéntica.
- REHECHA SIRENA ABISAL (36×36 · 5 frames): reina del naufragio — corona de NAUFRAGIO (tablones rotos de casco con clavos dorados, cuerda y balanos, paleta del prop 'wreck'), piel abisal pálida-verdosa con LUNARES BIOLUMINISCENTES que derivan 1px con la marea, melena que fluye como marea (mechones cambian de orilla por frame), cola de espuma con aleta en abanico (lóbulos que alternan) y borde de espuma. Frames: 0/1 flotar (bob + marea alterna) · 2 telegraph (se hincha: tórax +2px, brazos abiertos, halo bioluminiscente, boca en O) · 3 ataque (LÁTIGO DE AGUA: arco de 7 segmentos con cresta de espuma y gotas) · 4 sumergida (solo busto+corona sobre línea de agua ondulada, cola tenue bajo el agua, anillos y burbujas — para e.invulT>0 del cerebro 9-a).
- REHECHO GÓLEM DE ESCARCHA (36×36 · 5 frames): coloso ESTRATIFICADO (5 bandas de hielo sedimentado alternas), grietas polilínea con quiebro determinista que CRECEN con la fase (patrulla 3 → telegraph/smash con glow cian interior → agrietado 7+ y esquirla perdida del hombro), núcleo luminoso que pulsa (dim en andar A, bright en B, halo en telegraph, estalla blanco en smash, apagado-agrietado en fase 3). Frames: 0/1 andar (balanceo de hombros + paso alterno + vaho de escarcha con mulberry32 semilla 0x6e1ce) · 2 telegraph (brazos en alto, núcleo encendido, halo) · 3 smash (puños al suelo, crouch, esquirlas, onda) · 4 AGRIETADO (base de reposo de la fase 3).
- SUBIDO EL NIVEL VULT (32×32 · 4 frames): cazador nocturno con MEDIA MÁSCARA de hueso (el rostro que ya no recuerda), pañuelo de eco y GARRAS huesudas curvas de 3 segmentos (ya no dagas). Frames: 0/1 carrera (piernas alternas, capa ondea, polvo) · 2 telegraph (agachado, garra GUADAÑA alzada sobre la capucha, ojos 2px encendidos, chispas) · 3 embestida (estirado, garra delantera extendida horizontal, capa/pañuelo a remanguillo, líneas de velocidad).
- REHECHO EL CORO ROTO (30×30 · 3 frames × 3 máscaras): ceño tallado, boca vertical que SE ABRE (5→7px) al cantar, hilos de bruma que se tensan y máscaras que se separan al cantar, grieta creciente por máscara (f1 intacta / f2 finas / f3 cuarteadas+esquirla) y ojos que crecen por fase. Frame 2 = CANTO con motivo PROPIO por máscara: coro1 EL PULSO 4 orbes en órbita · coro2 EL VERA rayos en cruz cardinal con halo · coro3 EL SILENCIO notas que caen y se apagan.
- MÁS DETALLE EN ECODESG (16×16 · 3): hueco que late, PARPADEO DE FLANCO ALTERNO (f0 brilla la mitad babor, f1 la estribor, nunca ambas) y f2 DASH (mitades estiradas, estelas, ojos al frente). SATIRO (16×16 · 3): f0/1 brinco con zampoña a la espalda y niebla en los cascos · f2 LIRA (sentado tocando la balada curva: lira dorada con cuerdas + notas de niebla) — telegraph del 'aro'.
- ENEMIGOS REGULARES mejorados: NEUMO (16×16 · 3) membrana que ONDULA (lóbulos del borde que giran NO↔SE entre frames) + f2 hinchado (4 lóbulos de tensión, cruz interior, destello) · ESPECTRO (16×16 · 3) TRANSPARENCIA INTERNA ANIMADA (huecos del pecho que derivan y titilan) + f2 fase espectral (cuerpo alpha .4, contorno roto, ojos #8ef0ff — para e.invulT>0) · ARPI (16×16 · 3) ALETEO de 3 fases (alas arriba/abajo que entityFrame alterna + f2 planeo con garras recogidas para el picado). orb/shard/nota pasan a 2 frames (pulso sutil; en pantalla sigue mandando drawExpansionProjectile — los frames son fallback).
- DETERMINISMO TOTAL: cero Math.random en el módulo; mulberry32 con semilla fija (0x6e1ce) para el vaho/esquirlas del gólem, hash2 y aritmética pura en el resto. El smoke compara la FIRMA de ops de canvas (stub grabador + FNV-1a) de una reconstrucción completa: 45/45 frames idénticos.
- CONTRATO PARA EL INTEGRADOR (documentado en la cabecera del módulo, frames ≥2 ya jugables sin tocar nada): e.ai==='carga' && windup>0 → frame 2 (sirena/golem/vult/neumo/coroN/satiro) · e.ai==='ataca' → frame 3 (sirena látigo/golem smash/vult embestida) · e.invulT>0 → frame 4 (sirena sumergida) o 2 (espectro) · golem e.phase===3 → frame 4 de reposo · coro F3 lluvia (m.coroT>0) → frame 2 · arpi picado → frame 2 · ecodesg dash → frame 2. Snippet listo para drawEntity incluido en el comentario.
- Tiles, props y proyectiles a pantalla (drawExpansionTile/TallTile/Prop/Projectile) intocados (API y píxeles idénticos): cero riesgo para 18-a/18-b.

Verificación:
- npx tsc --noEmit → 0 errores en todo el proyecto (exit 0).
- npx eslint src/game/sprites_expansion.ts → 0 errores, 0 warnings.
- bun scripts/smoke_jefes_sprites.ts → scripts/_smoke_jefes.txt: TODO OK — 14/14 nombres registrados sin fallback hero_alba, frames EXACTOS por sprite (neumo/espectro/arpi/ecodesg/satiro/coro1-3: 3 · vult: 4 · sirena/golem: 5 · orb/shard/nota: 2), tamaños 12-36px todos ≤48 y constantes por sprite, entityFrame (reposo 0, alterna 0/1, nunca sale del ciclo), determinismo 45 frames comparados · 0 divergencias.
- Regresión: bun scripts/smoke_desafio.ts → TODO OK (duelos instanciando sirena/golem con los sprites nuevos); bun scripts/smoke_rutas.ts → 89 ok, 0 fallos; extra: bun scripts/smoke_motor_acto2.ts → 0 fallos (motor real con initExpansionSprites en su arranque + cadena completa del Acto II).

Stage Summary:
- Jefes y enemigos rehechos desde cero con pixel-art más profesional (37 canvas en 14 sprites): Sirena Abisal 36×36 5 frames (0/1 flotar · 2 hincharse · 3 látigo de agua · 4 sumergida) · Gólem de Escarcha 36×36 5 frames (0/1 andar · 2 brazos arriba+núcleo · 3 smash · 4 agrietado fase 3) · Vult 32×32 4 frames (0/1 carrera · 2 garra guadaña · 3 embestida) · Coro Roto 30×30 3 frames ×3 máscaras con motivo de canto propio (Pulso orbes/Vera rayos/Silencio notas) y grieta creciente · ecodesg/satiro/neumo/espectro/arpi 16×16 3 frames con animaciones nuevas (parpadeo de flanco+dash, lira, membrana ondulante, transparencia interna, aleteo de 3 fases) · orb/shard/nota 12×12 2 frames. Orden de frames y receta de integración (carga→2, ataca→3, invulT→4/2, phase3→4) documentados en la cabecera de sprites_expansion.ts y en el smoke. Nombres y firmas públicas intactos; tsc 0, eslint 0/0, smoke propio + desafio + rutas (+motor_acto2) en verde. Siguiente: el integrador puede cablear los frames de telegraph/ataque en drawEntity con el snippet del comentario (opcional — el ciclo 0/1 ya funciona solo).

---
Task ID: 18-b
Agent: general-purpose (biomas-cumbres)
Task: Revisualización integral del BIOMA «Cumbres Heladas» (mapa 'cumbres' 50×42) + capas visuales del bioma. NUEVO módulo src/game/biomas_cumbres.ts (propiedad exclusiva 18-b): nieve viva por capas, lago helado con «voces congeladas», aurora boreal nocturna, aliento visible, sombreado de la cordillera/meseta y hoguera de pastores. Los SPRITES de enemigos NO se tocan (agente 18-c).

Work Log:
- Leído worklog.md (Tasks 18-pre, 16-int, 15) y RECON del bioma: maps_expansion.ts buildCumbres (lago elipse centro (30,30) tiles 'i' rx6/ry4, cordillera 'R' filas 2-5, meseta altar rect(21,2,8,5,'='), hoguera rectOutline(8,33,3,3) → centro (9,34), pinos 'p' seed 611, rocas seed 612); render.ts (capas: suelo→entidades→ambient world→biomeTint→lighting→ambient sky→floats; drawGame ~47-49 llama updateAmbient con dtF de render); fx.ts ambient (SNOW/WISPFRIO ya existentes — mi módulo es ADITIVO); world/sky.ts+update.ts (detección noche: isNight = dayT>0.7||dayT<0.08, ciclo 240 s); sprites_expansion.ts (pino nevado cumbres cabe en el tile, top py0-1 → caps robustos a la geometría que rehace 18-c); weather.ts (NO cableado aún — no dependo de él).
- NUEVO src/game/biomas_cumbres.ts (~700 líneas): (1) RASTER ESTÁTICO pre-rasterizado en install perezoso (canvas 800×672 = mapa 1×) con mulberry32 semillas fijas 1847/6317/9203: gorros de nieve + carámbanos en 'p', facetas iluminada/sombra + crestería nevada + ventisqueros en base en 'R' (cordillera norte), orillas reblanecidas + grietas cortas por tile + 3 GRIETAS MAESTRAS en abanico sobre 'i' (mueren en la orilla); blit con UN drawImage recortado a la vista. (2) VENTISCA MEJORADA: 3 capas parallax (36 ráfagas) con envolvente de rachas determinista rachaK(t) (valles largos, picos cortos), ráfagas alargadas ×2.4 en pico + lavado de blancura 0.026..0.056. (3) HUELLAS del Portador: anillo cap 20, TTL 3.2 s, alternancia izq/der perpendicular al dir, solo sobre tile 'S' (nunca 'i'/'='). (4) LAGO HELADO: 6 brillos especulares que CAMINAN en 3 anillos elípticos (ω 0.13-0.22 rad/s) + 3 «voces congeladas» bajo el hielo (eco cu_e3): silueta azulada boca arriba (cabeza/torso/brazos) con halo aditivo, pulso MUY lento (periodos 9.5/11.5/14 s). (5) AURORA BOREAL: 3 cintas ondulantes (verde #4ee89c / violeta #9a74f2 / turquesa #6ce8c4) de 22 rodajas + núcleo brillante, en composite 'lighter', gateada por factorNoche(dayT) que REPLICA isNight (dayT>0.7||<0.08) con fundidos 0.05 en 0.7+ y 0.06-0.08 — sin importar update.ts (cero ciclos). (6) ALIENTO: vaporito de Portador/compañera/NPCs cada ~2.5 s por emisor (fases estables por slot, cap duro 10), asciende 7 px/s y deriva con el viento. (7) HOGUERA (8,33 → centro del anillo (9,34)): halo+interior aditivos que respiran, brasa que late, chispas cap 8 con frenado y vaivén. (8) MESETA DEL ALTAR: velo + 3 bandas de niebla ligera derivando (zona x21..28). Cero allocations por frame fuera de strings rgba imprescindibles; pools prealocados (20/10/8); PROHIBIDO Math.random (verificado por grep); determinismo total (mulberry32+hash2+globalT).
- Ganchos de debug/smoke exportados: __cumbresDebug() (caps y rasterKey) y __cumbresRasterDataUrl() (hash de ops del raster).
- NUEVO scripts/smoke_cumbres_bioma.ts (stub DOM/Audio patrón smoke_timeskip + ctx GRABADOR de ops con toDataURL=FNV del log): 7 bloques/24 checks — install ×2 idempotente; carga cumbres 50×42 + tick/draw sin excepción; 600 frames acotados (día↔noche, andando sobre 'S': huellas máx 18 ≤ 20, aliento máx 1 ≤ 10, chispas máx 2 ≤ 8) + 60 frames de Game.update real; huellas 17→0 tras 3.5 s parado (TTL); draw determinista (×2 misma secuencia de ops con mismo globalT/dayT/cámara), aurora SOLO de noche (día sin cintas, composite restaurado a source-over); raster ×2 rebuild (cumbres→lunaris→cumbres) → mismo dataURL (hash 152ac004) ≠ canvas vacío; fuera de cumbres no-op limpio con pools vacíos.

Stage Summary:
- EXPORTS EXACTOS de src/game/biomas_cumbres.ts: `initCumbresBioma(): void` (idempotente), `cumbresBiomaTick(g: Game, dt: number): void`, `drawCumbresBiomaOverlay(g: Game): void`, `__cumbresDebug()`, `__cumbresRasterDataUrl(): string|null`.
- CABLEADO EXACTO para el integrador (documentado en la cabecera «CABLEADO PARA EL INTEGRADOR (nombres exactos)» del módulo; NO editado por 18-b): (1) src/game/render.ts · drawGame, bloque de updateAmbient (líneas ~47-49) → añadir `cumbresBiomaTick(g, dtF);` tras `updateAmbient(g, dtF);` (alternativa: update.ts · updateGame, junto a `interaccionTick(g, dt);` línea ~384; se recomienda render.ts para que el bioma siga vivo en diálogo); (2) src/game/render.ts · drawWorld, justo tras `drawAmbient(g, 'sky');` (línea ~156, antes de drawFloats, dentro del translate de sacudida) → añadir `drawCumbresBiomaOverlay(g);`; (3) OPCIONAL src/game/engine.ts · constructor, tras `initExpansionSprites();` (línea ~203) → `initCumbresBioma();` (si no, el tick la llama perezosamente); (4) import: `import { cumbresBiomaTick, drawCumbresBiomaOverlay } from './biomas_cumbres';`. Ningún fichero ajeno fue tocado (verificado: solo se crearon biomas_cumbres.ts, scripts/smoke_cumbres_bioma.ts y esta entrada).
- VERIFICACIÓN: `npx tsc --noEmit` → 0 errores; `npx eslint src/game/biomas_cumbres.ts scripts/smoke_cumbres_bioma.ts` → 0 errores/0 warnings; `bun scripts/smoke_cumbres_bioma.ts > scripts/_smoke_cumbres.txt` → SMOKE CUMBRES BIOMA: TODO OK (24/24 checks, exit 0); regresión `bun scripts/smoke_rutas.ts` → 89 ok, 0 fallos; `bun scripts/smoke_timeskip.ts` → TODO OK. Cómo probar en juego: entrar en Cumbres Heladas (desde Bosque sur), caminar sobre la nieve (huellas que se apagan), esperar de noche (dayT>0.7 o <0.08, p.ej. Shift+T) para la aurora, acercarse al lago del centro-sur (voces bajo el hielo + brillos que caminan), subir a la cordillera/meseta del altar (ventisqueros + niebla solemne) y pararse junto a la hoguera de los pastores (8,33).

---
Task ID: 18-f
Agent: general-purpose (historia-transiciones)
Task: Interludios de acto (transición cinemática reutilizando el sistema de diálogo, cero cambios de engine) + barrera narrativa de los Altares del Eco (el custodio vivo se interpone) + peso narrativo (reacciones de Brisa/Toln, toasts de pista, textos de misión). Propiedad: src/game/data.ts, src/game/hooks.ts, src/game/screens.ts + módulo nuevo src/game/interludios.ts.

Work Log:
- Leído worklog (18-pre, 16-a, 16-b, 13-a, 10-b/9/9-c/11-a/11-int) y verificado el contrato REAL de los disparos antes de escribir: 'accept_q6' la consume ENGINE.applyAction (engine.ts:1087, engine congelado) ANTES del fallback de hooks (el accept_q6 de hooks.ts es código muerto), mientras que accept_q11/accept_q14 viven VIVOS en hooks.handleCustomAction (hooks.ts:176/362). El encadenado de diálogo del motor es advanceDialogue (engine.ts:1039): opción con next abre el nodo siguiente; opción sin next cierra (closeDialogue). openDialogue resuelve dynNodes ?? DIALOGUES (engine.ts:1019). El campo que dispara la persecución es Enemy.aggro (types.ts:118, público) + ai 'persigue' (update.ts:749 y brains de enemies_expansion); sfx 'banner' ya existía (update.ts:716).
- NUEVO src/game/interludios.ts (~330 líneas): (1) INTERLUDIOS — 9 nodos (3 por acto) con retrato 'fragment', estética de respiro: 'interludio_acto2_a/b/c', 'interludio_acto3_a/b/c', 'interludio_acto4_a/b/c', encadenados por options[].next (opciones mínimas '…' / '(Seguir camino)'); el nodo _a lleva action 'flag_interludio_actoN_vista' (handler genérico flag_ de hooks) para la recuperación post-guardado; (2) dispararInterludio18F(g, acto) — idempotente por flag interludio_acto2/3/4: pone flag, ENCOLA (no abre durante applyAction, para no pelearse con opt.next/closeDialogue del nodo invocante), toast de pista y sfx 'echo'; (3) interludioTick18F(g) — tick por frame con guard (player, state==='play', !challengeRun): watchers por ESTADO de las 3 transiciones (flags.q6&&questIdx===5 / q11&&idx 10 / q14&&idx 13; cubre el accept_q6 del motor y cualquier vía futura), recuperación si flag sin _vista (índice de misión evita recuperaciones fuera de sitio), barrera de altares y apertura del interludio encolado; (4) BARRERA_ALTARES_18F — altar_mareas/costa/sirena/sirenaDefeated, altar_cumbres/cumbres/golem/golemDefeated, altar_c/cripta/guardian/guardianDefeated; al ENTRAR en radio ≤4 tiles del altar con custodio vivo (flag sin poner + enemigo !dead en g.enemies): jefe.aggro=true + ai 'persigue' + spawnGuard=0 + bossRef/bossActive (barra) + audio.sfx('banner') + toast dramático («La Marea Sin Nombre se interpone entre tú y el Eco» / «El Gólem de Escarcha...» / «El Guardián Hueco...») — flanco dentro/fuera + cooldown 8 s (g.globalT) anti-spam; con jefe muerto el watcher no hace nada; (5) bannerActo18F(g) — fade 2,5 s (0,35 entrada · mantiene · 0,6 salida) con ACTO_BANNER_18F: 'ACTO II — LAS NOTAS PERDIDAS' / 'ACTO III — EL CANTO AL REVÉS' / 'ACTO IV — EL ÚLTIMO CANTO'. Estado por partida en WeakMap (HMR/multi-instancia seguro). TILE como literal 16 (precedente hooks acto3_subir) para cero aristas de valor: interludios solo importa TIPOS de engine + audio → sin ciclos.
- hooks.ts (+14 líneas): import de dispararInterludio18F y llamada dentro de accept_q11 (dispararInterludio18F(g,3)) y accept_q14 (g,4), tras el toast de 'Nueva misión'; en accept_q6 (código muerto hoy) también (g,2) con comentario que documenta que el disparo EN VIVO del Acto I→II es el watcher por estado. Cada transición emite además su toast de pista: 'Nueva pista: el sur guarda el segundo canto' (acto 2) / 'Nueva pista: lo que se canta al revés abre puertas' (acto 3) / 'Nueva pista: el metal que recuerda quiere ser campana' (acto 4).
- data.ts: import INTERLUDIOS + bloque delimitado 18-f al final: Object.assign(D, INTERLUDIOS) (los 9 nodos quedan servibles por openDialogue) + D_REACC_18F con 6 nodos de reacción NUEVOS (2 por acto, patrón de nodos reactivos existentes) — 'r18_reacc_acto2_brisa/_toln', 'r18_reacc_acto3_...', 'r18_reacc_acto4_...' — encadenados como CODA del interludio (actoN_c → brisa → toln, cuya opción final sin next devuelve al juego). DECISIÓN DOCUMENTADA: en vez de desviar el ruteo de getDialogue (hubiera retrasado briefings de misión como acto3_toln_intro o nunca sonado en el Acto IV, donde Brisa/Toln no sirven idle), las reacciones viajan dentro de la cinemática como «voces que el Eco trae» → garantizadas una sola vez y auditables. Textos de misión mejorados (misma estructura/pasos): q6 (camino del sur + faro en el oeste), q7 (naufragio del este despierta a la Sirena + altar al SUR del naufragio y aviso de custodia), q8 (Merrow al este de la Costa + Q en cada farol + Espectro en la plaza), q11 (los 3 lugares exactos: pozo de Teo/Lunaris, Ruina de Doran/Bosque, orilla de Mara/Costa), q14 (portadores reales del coro: Espectro de Merrow e Ivo).
- screens.ts (+34 líneas): import interludioTick18F/bannerActo18F; drawScreens case 'play' → interludioTick18F(g) ANTES del HUD del desafío + drawBannerActo18F(g); case 'dialogue' → drawDialogue + banner (la cinemática es un diálogo del sistema). drawBannerActo18F: banda translúcida con filetes dorados en y=96, una línea 'ACTO N — TÍTULO' con textShadow/COL.goldSoft, alpha del fade de interludios; sin uiHit (no roba clics).
- CABLEADO PARA EL INTEGRADOR (ÚNICO punto en fichero ajeno, documentado en la cabecera de interludios.ts): hoy interludioTick18F se llama desde screens.drawScreens case 'play' (camino de dibujo, porque update.ts/render.ts son de otros agentes). Punto alternativo EXACTO si se prefiere en lógica: update.ts, updateGame, línea ~384, justo tras `interaccionTick(g, dt);` → añadir `import { interludioTick18F } from './interludios';` + `interludioTick18F(g);` y RETIRAR la llamada de screens.ts. El banner debe seguir en screens. Nada más pendiente: hooks/data/screens ya cableados.
- scripts/smoke_interludios.ts (stub DOM patrón smoke_timeskip + Game real): 5 bloques — estructura (9+6 nodos, retratos, cadena íntegra), disparo único por transición + banner + no re-apertura, recuperación/_vista/save antiguo, barrera de altares (aggro+barra+toast+cooldown+flag de jefe muerto en costa/cumbres/cripta), persistencia de las 6 flags en save()+continueGame.

Verificación:
- `npx tsc --noEmit` → 0 errores en todo el proyecto.
- `npx eslint src/game/data.ts src/game/hooks.ts src/game/screens.ts src/game/interludios.ts` → 0 errores / 0 warnings.
- `bun scripts/smoke_interludios.ts` → TODO OK: 56 ✓ / 0 ✗ (salida en scripts/_smoke_interludios.txt): (a) las 3 transiciones disparan 1 vez (repeticiones de accept_q6/q11/q14 + 6 ticks no re-abren; save antiguo idx 7 no dispara; recuperación sin _vista re-abre UNA vez), (b) 3 cadenas de 5 nodos navegables de punta a punta y cierre a 'play', (c) altar: aggro+barra+toast 1 vez en 10 s con custodio vivo, 0 con flag de derrota (3 mapas), (d) save() serializa y continueGame restaura 6/6 flags interludio_*.
- Regresión: smoke_acto2 ✗0 ⚠0 · smoke_acto3 TODO OK · smoke_acto4 TODO OK · smoke_rutas 93 ok / 0 fallos · batería extra verde: motor_acto2, interaccion, logros, timeskip, worldlife, desafio, arbol, balance. `bun build --target=browser src/game/engine.ts` → 30 módulos, 0,71 MB (grafo con interludios.ts, sin ciclos de valor).
- No se ejecutó navegador (protocolo; verificación E2E pendiente del integrador de ronda).

Stage Summary:
- Transiciones de acto suaves: 3 interludios («Las Notas Perdidas» / «El Canto al Revés» / «El Último Canto») de 3 nodos 'fragment' + coda reactiva de Brisa y Toln (15 nodos nuevos en total: interludio_acto2/3/4_a,b,c + r18_reacc_acto2/3/4_brisa,toln), disparados UNA vez por flags interludio_acto2/3/4 (+_vista) en accept_q6 (watcher por estado; engine.applyAction:1087) / accept_q11 (hooks:176) / accept_q14 (hooks:362), con banner «ACTO N — título» (fade 2,5 s) y toast de pista por transición. Barrera de altares: watcher O(1)/frame por mapa (BARRERA_ALTARES_18F) que fuerza aggro+ai del custodio vivo a ≤4 tiles del altar (sirena/golem/guardian), con barra de jefe, sfx 'banner', toast «…se interpone entre tú y el Eco» y cooldown 8 s por flanco; con el jefe muerto no hace nada. Flags serializadas solas (spread de flags en engine.save():463). Único cableado externo opcional para el integrador: mover interludioTick18F de screens.drawScreens('play') a update.ts:384 (snippet exacto en la cabecera de interludios.ts y arriba). Verificado: tsc 0, eslint 0/0, smoke propio 56 ✓/0 ✗, 8 smokes de regresión + rutas 93/93 en verde, bundle 30 módulos OK.

---
Task ID: 18-a
Agent: general-purpose (biomas-costa)
Task: Revisualización integral de la Costa de Bruma (mapa 'costa' 52×40): terreno profesional, bruma viva, faro, gaviotas y naufragio — módulo NUEVO src/game/biomas_costa.ts, sin tocar render/update/engine/maps*/world*/sprites*.

Work Log:
- Leído worklog (18-pre/16-int/15) y recon de render.ts (capas drawWorld: ground→glints→props→entidades→fx→biomeTint→lighting→sky→floats), engine.ts (buildGround/blit con fuente 1× y WORLD_FILTER), maps_expansion.ts (buildCosta: mar sur/este, muelle 'B'/'x', faro_co 6,18, wreck_co 41,22), world/palette.ts (PAL) y sprites_expansion.ts (drawExpansionTile arena '#dcc590/#d2bb84', faro con linterna a −34 px y haz propio 0.35 rad/s).
- NUEVO src/game/biomas_costa.ts (950 líneas): (1) install() idempotente pre-rasteriza UNA vez: raster estático 832×640 (6 pasadas: sombras/grietas de acantilados, bandas de arena húmeda con dithering anti-canto-cuadrado, 14 charcos de marea con cuenca, cantos/algas/estrellas de mar, muelle desgastado con vetas+bertinas+remojo, restos del naufragio con tablones rotos + quilla semihundida + flotantes), 3 bancos de bruma y 2 frames de gaviota — todo con mulberry32 (semillas fijas) + hash local h2 con Math.imul y CERO Math.random; (2) drawCostaBiomaGround: blit del raster con la MISMA matemática de fuente que el ground (incl. EPOCH_FILTER espejo de render.ts para coincidir por época) + por frame O(viewport): espuma de orilla (lámina continua + dashes que marchan + lavado foamWash, seno temporal por tile), brillo especular de arena mojada ACOPLADO a la fase de la ola (retira→más brillo), reflejos animados en tide pools, veteado mojado del muelle; (3) drawCostaBiomaOverlay: bruma viva 2 capas parallax (0.25/0.55, 15 blobs fijos, más densa en banda sur + clúster anclado al naufragio, alpha ≤0.24), 4 gaviotas de 2 frames con oleaje visual y llamada en arcos, haz doble del faro (cono núcleo + abanico ancho, gradiente aditivo 'lighter', anclado LEYENDO g.map.props id 'faro_co', linterna −34 px, 0.35 rad/s = prop, factor noche g.dayT idéntico a render.ts), destello periódico del casco del naufragio (ciclo 6.5 s determinista); (4) costaBiomaTick O(1): acumula t/beamA con caps; arrays de longitud FIJA (pools ≤14 · blobs 6+9 · gulls 4, sin pool de partículas).
- HALLAZGO y fix propio: hash2 de world/palette.ts pierde precisión float ((h^h>>13)*1274126177 supera 2^53 sin imul) y queda SESGADO a [0,~0.45] — todo threshold >0.5 con él es código muerto (verificado: 0 de 1813 muestras >0.8). El módulo usa su propio h2(x,y) uniforme; documentado en la cabecera para futuros agentes.
- Preview visual sin tocar render.ts: scripts/preview_costa.ts → public/costa_preview.html (bun build --target browser; fake Game con la superficie del módulo). 2 rondas de VLM sobre capturas: ronda 1 detectó algas tipo «!» y estrellas tipo «marcador debug» → rediseñados (montón bajo / tono apagado y más raros), espuma reforzada con lámina continua, bruma +α, arena seca con ondulaciones de viento; ronda 2: «professional-enough: YES» en las 3 tomas (orilla día, faro noche, muelle día), haz leído como faro suave aditivo, sin artefactos. Capturas: scripts/shot_18a_final_*.png.
- SMOKE scripts/smoke_costa_bioma.ts (stub DOM/Audio patrón smoke_timeskip): 20 checks en 4 bloques (instalación idempotente 2×init+auto-install perezoso; tick 600 frames con fases sin NaN y arrays fijos que NO crecen; draw ground+overlay con ctx stub en día/noche/atardecer/pasado/5 cámaras/fallback globalT y early-out en lunaris sin contaminar fases; determinismo del raster estático con ctx-grabador __costaRasterTrace — dos builds byte a byte idénticos y estable tras ticks). Salida en scripts/_smoke_costa.txt: TODO OK.
- Regresión: smoke_rutas 0 fallos (93 ok — la batería creció de 89 por agentes R18 paralelos; nada roto), tsc 0 errores en todo el proyecto.

Stage Summary:
- EXPORTS EXACTOS de src/game/biomas_costa.ts: initCostaBioma(): void (idempotente, auto-instalación perezosa también en tick/draw) · costaBiomaTick(g: Game, dt: number): void · drawCostaBiomaGround(g: Game, sx?: (n:number)=>number, sy?: (n:number)=>number): void · drawCostaBiomaOverlay(g: Game): void · ganchos dev __costaDebug(): objeto {installed,builds,t,beamA,pools,blobsFar,blobsNear,gulls,mistCv,gullCv} · __costaReset(): void · __costaRasterTrace(): string.
- PUNTOS DE CABLEADO EXACTOS (documentados también en la cabecera del módulo): (1) render.ts import tras la línea 17: `import { drawCostaBiomaGround, drawCostaBiomaOverlay } from './biomas_costa'; // 18-a: Costa de Bruma`; (2) render.ts drawWorld tras la línea 82 `drawWaterGlints(g, sx, sy);` → `drawCostaBiomaGround(g, sx, sy); // 18-a: detalle de terreno + espuma + charcos (BAJO entidades)`; (3) render.ts drawWorld tras la línea 156 `drawAmbient(g, 'sky');` y antes de drawFloats → `drawCostaBiomaOverlay(g); // 18-a: bruma viva + haz del faro + gaviotas + destello del naufragio`; (4) engine.ts import (~línea 23): `import { costaBiomaTick } from './biomas_costa'; // 18-a: Costa de Bruma` y Game.update tras la línea 256 `armorTick(this, dt);` → `costaBiomaTick(this, dt); // 18-a: fases temporales de la Costa de Bruma`; (5) initCostaBioma() OPCIONAL en initGame() (engine.ts ~1994) — sin ella el módulo se auto-instala igual. El módulo ya funciona solo con (2)+(3)+(4); sin cablear no altera NINGÚN mapa (early-out g.mapId!=='costa').
- VERIFICACIÓN CON NÚMEROS: `npx tsc --noEmit` → 0 errores (exit 0, sin filtrar nada salvo npm notice); `npx eslint src/game/biomas_costa.ts` → 0 errores / 0 warnings; `bun scripts/smoke_costa_bioma.ts` → 20 ✓ / 0 ✗, TODO OK (smoke_exit=0, salida en scripts/_smoke_costa.txt; determinismo: 2 builds del raster → traza idéntica de 50-55k ops serializadas); `bun scripts/smoke_rutas.ts` → 93 ok / 0 fallos (batería de rutas ampliada por otros agentes R18 en paralelo, sin regresiones del 18-a).
- CÓMO VERLO YA (sin esperar al integrador): bun build scripts/preview_costa.ts --outfile public/costa_preview.js --target browser && abrir /costa_preview.html (query ?x=880&y=560 orilla, ?x=180&y=440&night=1 faro de noche, tecla N alterna día/noche).

---
Task ID: 18-d
Agent: general-purpose (héroe-detalle) — sesión murió por timeout CON EL CÓDIGO ESCRITO; verificación completada y entrada reconstruida por el integrador.
Task: Héroe con mucho más detalle, fix del retrato de la anciana Brisa, pulido de humanoides y efectos de ataque.

Work Log (verificado por el integrador):
- sprites.ts (+268/-42): layoutFor/drawHumanFrame con sombreado de 2 tonos, rim light selectivo, detalles de ropa (capa con broche del Alba, tabardo bordado del Tejedor, botas, cinturón) y opción skirt (Brisa); PALS actualizados para todos los humanoides visibles; contrato respetado: 16×H y 9 frames (down/up/side ×3), drawTile/drawTallTile/entityFrame/registerSpr/getSpr/SOLID_CHARS intactos.
- BUG DEL RETRATO DE BRISA encontrado y corregido: la sombra de mandíbula medía 5 filas (y23..27) y se salía 2 filas del contorno — el «brazo donde no debe» que reportó el usuario; franja pulida y auditados los demás retratos.
- drawSlashArc/buildCombatPose mejorados; fx.ts (+138): combatSparks, dodgeRing, critGlint, rollTrail y drawSky con más detalle y caps.
- VERIFICACIÓN DEL INTEGRADOR: npx tsc --noEmit → 0; NUEVO scripts/smoke_hero_fx.ts (escrito por el integrador para cerrar su verificación): 73/73 OK — 14 humanoides con 9 frames uniformes, fix de facing verificado por sprite (left/right/side → mismo frame lateral 7; up 4; down 1; pie = 1), rebuild ×2 → mismos dataURLs, drawPortrait ×23 claves sin excepción (incl. los 3 retratos nuevos del faro ya fusionados), fx ×600 frames sin excepción y acotado.

Stage Summary:
- Héroe y compañía con detalle profesional; retrato de Brisa arreglado (bug de la mandíbula/dedo fuera del contorno); efectos de ataque mejorados con caps. Todo verificado (73/73) y sin regresiones (batería 18/18).

---
Task ID: 18-e
Agent: general-purpose (faro-historia) — sesión murió por timeout tras terminar el código y su smoke; cableado aplicado y entrada reconstruida por el integrador.
Task: El faro como HUB narrativo con 3 NPCs visualmente únicos + micro-historia «La lámpara que aprendió a temblar».

Work Log (verificado/cableado por el integrador):
- NUEVO src/game/faro_historia.ts (44.5 KB): sprites PROPIOS mara_farera/uso_faro/tina_faro (9 frames humanoides, deterministas), retratos FARO_PORTRAITS, 27 nodos FARO_DIALOGUES con ruteo faroRouteDialogue (respeta q6/mara_react/Acto III), faroTick (escucha nocturna + pago único anti-doble), flags faro_uso_hablado/faro_tina_hablado/faro_escucha (+ bookkeeping), recompensa +8 rep Guardianes +15 coronas.
- maps_expansion.ts: mara → sprite 'mara_farera'; NPCs uso_faro (5,21) y tina_faro (9,20) con tiles verificados por BFS; cartel sign_co3.
- CABLEADO APLICADO POR EL INTEGRADOR: data.ts (import + Object.assign(D, FARO_DIALOGUES) tras export DIALOGUES + ruteo faroRouteDialogue al inicio de getDialogueActo4); engine.ts (initFaroSprites() tras initExpansionSprites); update.ts (faroTick(g) junto a interaccionTick); sprites.ts (NUEVO export mergeFaroPortraits(), llamado desde initFaroSprites — sin ciclo de módulo).
- VERIFICACIÓN: smoke_faro 72/72 OK (check de colisiones actualizado a post-integración: las 27 claves fusionadas en DIALOGUES con contenido idéntico; pago único verificado 10→25 oro y anti-doble en reload); smoke_rutas audita los 3 NPCs con acceso peatonal automático → verde; smoke_hero_fx confirma los 3 retratos dibujables.

Stage Summary:
- Los 3 del faro son visualmente ÚNICOS (sprites+retratos propios) con arco narrativo propio enlazado al eco co_e1 y al Acto II. Cableado completo en 4 ficheros por el integrador; 72/72.

---
Task ID: 18-int
Agent: Super Z (agente principal — integrador Ronda 18)
Task: Cablear los 6 módulos R18 en el motor, verificar todo el juego y dejar el árbol en estado entregable.

Work Log:
- Cableado aplicado (todos los puntos documentados por los agentes): render.ts (imports 18-a/18-b; drawCostaBiomaGround tras drawWaterGlints; drawCumbresBiomaOverlay + drawCostaBiomaOverlay tras drawAmbient 'sky'; frames de telegraph/ataque/estado 18-c en drawEntity según contrato de sprites_expansion.ts); engine.ts (initCostaBioma/initCumbresBioma/initFaroSprites en constructor; costaBiomaTick en Game.update tras armorTick); update.ts (faroTick + cumbresBiomaTick tras interaccionTick).
- CORRECCIONES de integración: faroTick(g) firma 1 arg; block de fusión de retratos reescrito como mergeFaroPortraits() exportado (el primer intento quedó incoherente y se limpió).
- BATERÍA: scripts/run_battery.sh → 18/18 VERDE (17 heredados/nuevos + smoke_hero_fx nuevo): acto2, acto3, acto4, arbol, balance, costa_bioma, cumbres_bioma, desafio, faro, hero_fx, interaccion, interludios, jefes_sprites, logros, motor_acto2, rutas, timeskip, worldlife. npx tsc --noEmit → 0 errores.
- Dev server 200 OK.

Stage Summary:
- R18 íntegra en el árbol: Costa Bruma y Cumbres Heladas revisualizadas (terreno/bruma/haz del faro/gaviotas · ventisca/aurora/lago/aliento/huellas), jefes y enemigos con sprites rehechos y frames de ataque cableados, héroe y retratos al detalle (bug de Brisa incluido), faro con 3 NPCs únicos e historia propia, interludios de acto con banner, barrera narrativa de los 3 altares, facing lateral arreglado, cripta con corredor garantizado + cartel, 18/18 smokes y tsc 0. PENDIENTE: E2E en vivo + commit + push (sin token GitHub válido en este entorno: el remoto no está configurado).
