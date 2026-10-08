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
