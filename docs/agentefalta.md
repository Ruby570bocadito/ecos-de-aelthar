# agentefalta.md — Informe QA multiagente de *Ecos de Aelthar*

> **Alcance:** 10 agentes de prueba autónomos, cada uno con 5–6 rondas de juego reales contra el motor del juego (50+ sesiones, ~1.000 verificaciones automatizadas), más una sesión E2E de navegador real.
> **Versión probada:** `main` @ `6ac3033` (Ronda 10) · demo v0.5.9 · typecheck/build/12 smokes del repo en verde al iniciar.
> **Método:** cada agente jugó rondas scriptadas headless instanciando el `Game` real (mismo motor que corre en el navegador) con stubs de DOM/Audio/localStorage, cubriendo un área distinta: combate, persistencia, progresión, mapas, jefes/IA, UI, skilltree/desafío, economía/NPC, mundo vivo y rendimiento/estabilidad. Los hallazgos se verificaron contra el código fuente (archivo:línea) para separar bugs reales de falsos positivos.
> **Fecha:** 2026-10-09

---

## 1) Resumen ejecutivo

El motor es **muy estable**: ~100.000 ticks de simulación sin una sola excepción propia del motor, arrays acotados por caps reales (partículas 400, pools de FX 6+12, toasts 4), sin fugas de memoria ni crecimiento del save (956–999 bytes estables), y el servidor de producción respondió sano (p95 42 ms, 544 KB de JS inicial). El navegador real arranca, crea personaje, juega y pausa **con consola limpia**.

Se **confirmaron 40 hallazgos**: **3 P1** (rompen partidas o atrapan al jugador), **17 P2** (mecánicas rotas o contenido muerto), **17 P3/baja** y varios apuntes de diseño. Los patrones dominantes:

1. **Lectura de saves no tolerante**: `continueGame()` restaura el save sin sanitizar (5 bugs comparten esta causa raíz), contradiciendo lo prometido en `docs/history.md` ("toda lectura tolerante ante corrupción").
2. **Geometría de expansión desincronizada**: los mapas de costa/aldea/cumbres declaran `w/h` menores que las filas realmente generadas → el 30–40 % del contenido de la Ronda 10 (naufragio, mina, campamento, mirador, extramuros de aldea y su pasado) es inalcanzable o no se aplica.
3. **Estado global de skilltree sin ciclo de vida**: `SKILLS` mutado globalmente y `ecos-arbol` pisado por `saveTree` cruzan partidas dentro del mismo proceso.
4. **Narrativa atascable**: 2 softlocks sin red de catchUp en Actos I–II y un epílogo que paga y cierra el juego aunque el jugador elija "no cantar".

---

## 2) Bugs confirmados

### Severidad P1 (rompe la partida o atrapa al jugador)

| # | Bug | Reproducción | Evidencia |
|---|-----|--------------|-----------|
| 1 | **Botón CONTINUAR roto permanentemente** con `openedChests`/`takenEchoes` corruptos: `new Set()` sobre un no-iterable lanza, el save **no se descarta** y queda envenenado en disco; cada clic vuelve a lanzar y la excepción sube sin catch por el handler de UI | Guardar save con `"openedChests":5` → clic en CONTINUAR → `TypeError` | `engine.ts:519-520` (sin `Array.isArray`); el throw ocurre tras mutar flags/quest (`engine.ts:517-518`); descarte solo cubre el parse (`engine.ts:484-488`); sin try/catch en `screens.ts:207` |
| 2 | **Crash al morir** si `deadGolds` no es array (un número pasa el `?? []`): la muerte rompe el frame en juego real | Save con `"deadGolds":7` → cargar → morir → `deadGolds.push is not a function` | `engine.ts:521` (no valida tipo) → `engine.ts:1702` (`playerDied`) |
| 3 | **Fast travel a un interior visitado aterriza FUERA del mapa**: Portador atrapado en un mapa 13×10 desde píxel (312,392) y el autoguardado posterior envenena el save | Santuario de Lunaris → menú → «Viajar: Casa de la Anciana» | `engine.ts:1556` (`sanctuaryPos` fallback `[19,24]` sin caso para interiores) + lista en `engine.ts:1280-1285`; save roto vía `update.ts:269` |

### Severidad P2 (mecánica rota, contenido muerto o daño persistente a la partida)

| # | Bug | Reproducción | Evidencia |
|---|-----|--------------|-----------|
| 4 | **HP = NaN hace al Portador inmortal** (NaN nunca cumple `hp<=0`), HUD roto; 3 variantes de save lo producen | Save con `"hp":"abc"` o `"player":{}` → cargar | `engine.ts:498` (`Math.max(1, p.hp)` = NaN); `maxHp` sin fallback (`engine.ts:491`) |
| 5 | **`attrs` corruptos → daño NaN persistente** que se re-guarda roto | Save con `"attrs":null` → `attrs={}`; `"attrs":"fuerte"` → daño `NaN` | `engine.ts:501` (sin validar forma); motor de daño `engine.ts:2547/2553/2087/2220/2513` |
| 6 | **`level` indefinido + versión futura del save aceptada en silencio**: `d.v` nunca se lee, no hay puerta de versión ni migración | Save `{"v":999999,"player":{}}` → cargar → XP/daño NaN | `engine.ts:500` (sin default), `engine.ts:483` (validación sin `v`); `v:1` solo se escribe (`engine.ts:569`) |
| 7 | **Epílogo del Acto IV completado sin cantar**: elegir "Todavía no…" paga +150 coronas, +1 poción, memoria VII y fija `acto4Done` | q16 paso 0 → hablar con Brisa → opción de no cantar | `data.ts:1659/1670/1680` (`onEnd` en nodos de entrada) + `engine.ts:1338` (onEnd antes de resolver opción) + `hooks.ts:494-502` (pago incondicional) |
| 8 | **Softlock S1 (Acto I)**: matar al Guardián/entrar a la Cripta en q3 consume `visitedCripta`; en q4 el Eco es tomable en paso 0 y la única salida (Brisa) salta q5 entera | q3 → Cripta → jefe+Fragmento → volver → hablar con Brisa | `engine.ts:353` (catchUp solo idx 5-9) + `hooks.ts:119-122` (accept_q6 con `questIdx<5` salta a 5) |
| 9 | **Softlock S2 (Acto II)**: q6 atascable para siempre — si la Sirena muere en q6, Mara sirve `mara_react` y `mara_met` (que vive solo en `mara_intro`) nunca ocurre | q6 paso 1 → matar Sirena → hablar con Mara | `data.ts:723` (prioriza `sirenaDefeated`) + `data.ts:448`/`hooks.ts:134` + `engine.ts:353` (sin cobertura idx 5) |
| 10 | **Feedback de barrera de época nunca aparece**: la Niebla Muda bloquea sin toast/float al caminar (el muestreo del feedback cae a 1 px del centro y el bloqueo real es a 6 px) | Bosque presente, empujar contra 'n' | `engine.ts:1110` + `boxFree:1071` + caja `:433` |
| 11 | **Mapas de expansión declaran `w/h` menores que las filas generadas**: el este de costa (naufragio x51..58), el este de cumbres (mina, campamento, mirador x≥50) y el sur de aldea (y≥34) existen en datos pero `tileAt` devuelve 'V' → sin cofres, spawns, ecos ni contenido jugable; incluye los 17 epochDiffs fuera de límites (el pasado de aldea/cumbres nunca se aplica) | Caminar al este de costa/cumbres o sur de aldea; escaneo de invariantes | `maps.ts:650-654` (recorte) vs `maps_expansion.ts:504` (costa 52×40 vs 64×40), `:556` (aldea 44×34 vs 44×44), `:602` (cumbres 50×42 vs 66×42); diffs `:346-351` y `:452-454` |
| 12 | **Coro de neumos nunca invoca en su mapa**: el cap (2/3) cuenta TODOS los neumos vivos y costa trae 4 salvajes → cap siempre lleno | Combate del Coro con 4 neumos salvajes → no invoca | `enemies_expansion.ts:714-724` + spawns salvajes `maps_expansion.ts:527-530` |
| 13 | **Memoria de jefe `bossHpWho_` con 2 jefes vivos**: solo el `bossRef` activo memoriza; el otro jefe regenera 100 % al recargar (reset de combate explotable) | Dañar Guardián con Sepulcro activo → salir → volver → Guardián 345/345 | `engine.ts:604-610` (solo bossRef) y `engine.ts:641-651` (solo dueño) |
| 14 | **Fantasma al mover magia entre huecos**: la base desplazada no vuelve al hueco origen en memoria viva; `useSkill` del hueco viejo sigue lanzando la magia movida hasta recargar | `equipNewSkill(onda,0)` → `equipNewSkill(onda,2)` → `SKILLS.alba[0]` sigue siendo 'onda' | `skilltree.ts:236-238` (limpia `t.equip[j]` pero no `SKILLS[disc][j]`); contradice el doc de `skilltree.ts:225-226` |
| 15 | **`saveTree` borra árboles de otras partidas**: pisa `'ecos-arbol'` completo con solo las claves cacheadas del proceso → la segunda partida pierde su árbol al aprender/equipar | Proceso con árboles A+B; boot solo A; primer saveTree → B desaparece | `skilltree.ts:113-116` (all={} desde treeCache) vs `getTree:88-107` |
| 16 | **Identidad de árbol por `nombre\|disciplina` sin invalidar en newGame**: borrar partida y recrearla con el mismo nombre hereda árbol aprendido + equipaje a Nv 1 | g1 'Runa' aprende/equipa → `newGame('Runa','alba')` → maxHp 130 y magia heredada | `skilltree.ts:83-85` (treeKey) + `engine.ts:429-467` (newGame no toca treeCache ni SKILLS) |
| 17 | **`advanceDialogue` lanza TypeError si la `action` cierra el diálogo** (lee `dlgNode.onEnd` tras `dlgNode=null`). Latente: no hay nodos `'close'` en `data.ts` hoy | Nodo con `action:'close'` + avanzar 2 veces | `engine.ts:1337-1347` |
| 18 | **HUD: nombre del Portador sin truncar se sale del panel y pisa el oro** (el árbol sí trunca → inconsistencia) | Personaje con nombre de 43 caracteres | `render.ts:921` (texto nace en x=66, oro en x=242); truncado correcto en `skilltree.ts:1059` |
| 19 | **Un AudioContext roto o cerrado derriba el frame de render**: sin try/catch en ninguna ruta de audio, la excepción sube al bucle → pantalla negra con error cada frame en vez de degradar a silencio | Contexto cerrado (caso real: `ctx.close()`, cambio de dispositivo) → `audio.sfx('hit')` lanza y sale de `g.update` | `audio.ts:557` (`o.type = type` sin validar), `:473`, `:420-433`; propagación: `engine.ts:404-416` |

### Severidad P3 / baja (inconsistencias, hardening, cosmético)

| # | Bug | Evidencia |
|---|-----|-----------|
| 20 | `questIdx` se carga sin clamp ni rango: save con `questIdx=999` arranca sin HUD de misión y la historia no puede avanzar (softlock silencioso); `questAdvance()` es una mina latente (`QUESTS[999].steps`) | `engine.ts:518` (carga en crudo), `engine.ts:1560`; HUD blindado en `render.ts:964-965` |
| 21 | El ciclo día/noche no se persiste: cargar SIEMPRE amanece (dayT=0.15) — guardar de noche pierde la noche peligrosa (agro 1.35→1.041, aura 45→74 px) | `dayT` ausente de `SaveData` (`types.ts:229-254`); defaults `engine.ts:218/460` |
| 22 | Aguante queda NEGATIVO tras tajo cargado (−6.47; se cobran 18 con ~11 disponibles, sin clamp) | `engine.ts:1987` (`p.sta -= charged?18:8`) |
| 23 | El ciclo de combo aplica el multiplicador invertido: 1º golpe ×1.12, 3º (remate natural) ×1.0 | `engine.ts:1989-1991` (`combo=(combo+1)%3` ANTES de `mult=[1,1.12,1.28][combo]`) |
| 24 | La carga descartada por Aguante insuficiente no muestra aviso textual (solo sfx `parryFail`) | `engine.ts:1986`; sin toast |
| 25 | El Tejedor arranca con 0 Resonancia y `useSkill` se niega en silencio: el mago debe pegar melé antes de castear, sin explicación | `engine.ts:437` (`res: 0`), `engine.ts:2033`; decay pasivo ~−9/s |
| 26 | Pantalla de muerte sin NINGÚN botón clicable (solo E/Enter) — accesibilidad | `screens.ts:972-987` (solo texto); `engine.ts:1874-1875` |
| 27 | ESC/M no abren pausa durante un diálogo (sin rama `escape/m`) | `engine.ts:1836-1839` |
| 28 | Pausar durante el fundido cancela el viaje pendiente sin aviso al jugador | `engine.ts:293-299` (`pendingMap=null` sin feedback) |
| 29 | La expansión usa noche binaria ×1.3 en vez de la curva `nightAggroMul` 1.0→1.35 del contrato R9 (inconsistencia entre enemigos base y nuevos) | `enemies_expansion.ts:264` vs `lighting.ts:329-332` → `update.ts:541,1030` |
| 30 | `epochSwitch` no re-evalúa spawns por época: espectros `needPresent` siguen vivos en el pasado hasta recargar el mapa | `engine.ts:1134-1158` (sin `spawnEnemies`) |
| 31 | Fuga transitoria de barra global: tras `newGame` de otro personaje, `SKILLS` muestra magias de la partida anterior hasta el primer `skillTick` | `engine.ts:429` no resetea SKILLS; `applyLoadout` solo corre en `getTree` |
| 32 | `weatherStats()` no contabiliza las familias nuevas (P_SNOW de cumbres, P_DEW de costa): telemetría a cero con clima dibujándose | `world/weather.ts:1483-1498` (solo 4 kinds) vs `:277/:279` |
| 33 | `setMusicVol`/`setSfxVol` sin clamp ni isFinite: aceptan −3, 999 y NaN (el NaN queda permanente en el bus) | `audio.ts:316-317` |
| 34 | `update(NaN)` envenena `g.dayT` permanentemente (el ciclo día/noche muere en silencio) | `update.ts:253` (`%1` conserva NaN); sin sanitización de dt en `update.ts:216` |
| 35 | audio.ts mezcla `window.setInterval` con `clearInterval` global (funciona en navegador; rompe entornos polifillados) | `audio.ts:338` vs `:333/:354/:947/:1161/:1383` |
| 36 | Sin rama visual de muerte para El Sepulcro en `expansionDeathFx` (el mini-jefe muere sin salva FX propia); su intro no fija flag propia (`sepulcroIntro`) como sí hacen sirena/gólem | `update.ts:569` |
| 37 | Sepulcro maxHp 218 (base 210) por dificultad dinámica — verificado, por diseño; documentar para evitar confusión | `data.ts:2109` + `balance.ts` |
| 38 | `stats.coronasGanadas` no contabiliza el bonus del talento Ojo del Mercader (descuadre menor entre ganadas y reales) | `interaccion.ts` (bonus tras el registro de stats) |
| 39 | `attackT` descansa en −0.0166 sin clamp (inofensivo; los guards usan >0) pero revela falta de normalizador de invariantes | `update.ts:318` |
| 40 | El veto de época genérico dice «La Cripta existe fuera del tiempo» en taberna/tienda/casa/arena — texto incorrecto por mapa | `engine.ts` (mensaje único parametrizado a medias) |

---

## 3) Funciones que le faltan al juego

### Persistencia y partidas
- **`sanitizeSaveData()`**: lectura tolerante del save de campaña (numéricos finitos con defaults, `attrs` con sus 5 claves, colecciones con `Array.isArray`, gate de versión). El repo ya tiene el patrón en 4 sitios (`sanitizeStats`, `readLastSave`, `getTree`, `ensureLoaded`) pero no en `continueGame` — cierra los bugs 1, 2, 4, 5 y 6 de golpe.
- **Puerta de versión / migración de saves** (`v:1` se escribe pero nunca se lee); preparatorio del NG+ "El Canto Recordado" (campo `canto`, planificado en `docs/history.md` pero inexistente en código).
- **Borrar partida desde la UI** y **export/import del save** (código o JSON) — hoy hay un único slot sin escapatoria.
- **Persistir `dayT`** (y clamp de x/y al mapa destino al cargar).

### Progresión y narrativa
- **Red de catchUp completa**: solo cubre idx 5-9 (Acto II). Faltan Acto I (q4) y q6 — es la raíz de los 2 softlocks.
- **Gate por historia**: la Cripta, El Sepulcro y el Guardián son accesibles desde q3 (el anti-skip solo existe en altares custodiados).
- **Visibilidad de cadenas de misión**: `accept_q6` descarta q5 silenciosamente; el jugador nunca sabe que "Ecos de Esperanza" existió.
- **Epílogo con decisión real**: el cierre del Acto IV debería condicionar pago/`acto4Done` a la opción elegida.
- Escenas animadas (los beats de Velmora/Vesh/epílogo son solo texto) y rutinas/movimiento de NPCs.

### Mapas y mundo
- **`sanctuaryPos` para interiores** (o excluirlos del menú de viaje) — hoy la opción «Viajar» está rota para 3 mapas.
- **Actualización de `w/h` de costa/aldea/cumbres** a las dimensiones reales generadas + registro de cofres/spawns/ecos del extramuros (naufragio, mina, campamento, mirador, huerto/cementerio) — el contenido ya está dibujado, solo falta hacerlo jugable.
- **Validación de `epochDiffs`** (límites + chars) en carga y en `validate_r10` (el check actual da ✓ falso).
- Telemetría de clima completa en `weatherStats()` (nieve, rocío, pétalos, hojas, polen, humo) y `updateWeather` movido del loop de render a `update()`.

### Combate y sistemas
- **Feedback textual/toast al fallar acciones por recurso** (carga, parry, skill silenciosos) y clamp/denegación visible del coste.
- **API pública del skilltree** (snapshot de learned/puntos/equip) y `resetTree`/poda; invalidación de `treeCache` en `newGame` y `applyLoadout` llamada desde `newGame`.
- **Memoria de HP para N jefes por mapa** (`bossHp_{map}_{etype}`) — hoy solo el dueño del `bossRef`.
- Spawns de mapa para vult/coro/ecodesg/satiro en biomas normales (hoy solo eventos/watchers) y `spawnGuard` en spawns normales (hoy 0: la manada nace aggro-capaz si caes encima).
- **Modo degradado de audio** (try/catch por disparo + "suicide switch" `ctx=null` tras N fallos) y sanitización de dt en `updateGame`.
- Pantalla de muerte con botón clicable; pausa accesible durante diálogo; truncado de nombre en HUD/pausa; toast «Viaje cancelado».

---

## 4) Mejoras propuestas (priorizadas por retorno)

1. **Extraer `sanitizeSaveData()` + try/catch en el cuerpo de `continueGame`** (1 función + 1 envoltorio) → cierra 5 bugs (2 P1, 3 P2) y honra el contrato de `docs/history.md:681`.
2. **Actualizar `w/h` en `maps_expansion.ts:504/556/602`** a las dimensiones reales del build → resuelve de raíz el contenido inalcanzable y los 17 epochDiffs muertos.
3. **Fix de 1 línea en `equipNewSkill`** (`if (j!==slot) SKILLS[disc][j]=BASE_SKILLS[disc][j]`) + `saveTree` fusionando con lo que ya hay en localStorage + invalidar `treeCache` en `newGame`.
4. **Extender catchUp a idx 3-5** y servir `mara_intro` si `!mara_met` → elimina los 2 softlocks narrativos.
5. **Mover el pago/cierre del epílogo** a la opción de cantar (no al `onEnd` de entrada) → el final ya no se completa "sin cantar".
6. **SanctuaryPos para interiores** + validar posición de llegada antes del autoguardado (`update.ts:269`) → el P1 de fast travel desaparece.
7. **Blindar WebAudio** (try/catch + contador de fallos) y **clampear volúmenes** (`v = Math.min(1, Math.max(0, +v||0))`).
8. **Persistir `dayT`** en el save y sanear NaN antes de `JSON.stringify` (hp NaN viaja como null).
9. **Cablear `nightAggroMul` en `commonTick` de la expansión** (1 línea) y re-evaluar spawns en `epochSwitch`.
10. **Servir el JS con gzip/brotli** (544 KB → ~150 KB) y evaluar code-split por acto (`MAPS`/`sprites_expansion` cargan íntegros al primer frame); endpoint `/api/health` con RSS/uptime.
11. Truncado de `p.name` con elipsis (reutilizar el helper de `skilltree.ts:1059`), botón en la pantalla de muerte, toast al cancelar viaje.
12. Convertir las suites de los agentes (`scripts/agent_tests/agent*_ronda*.mts`, ~60 scripts ejecutables con exit 0/1) en **smoke tests de CI** — detectarían casi todos estos bugs antes de cada push.

---

## 5) Anexo — Log de rondas por agente

| Agente | Área | Rondas | Verificaciones | Resultado clave |
|--------|------|--------|----------------|-----------------|
| 1 | Combate y game feel | 5 (combo/carga, esquiva/stamina, parry/reflejo, quiebre/remate/knockback, magia tejedora + muerte/respawn) | 99 · 0 fallos activos | 5 bugs menores documentados (sta negativa, combo invertido, carga sin aviso, Resonancia sin doc, attackT sin clamp); buffer de esquiva/ataque y parry verificados sanos |
| 2 | Persistencia y saves | 6 (+ fases load en proceso aparte) | 341 · 11 ✗ reales | 2 P1 (CONTINUAR roto, crash al morir), 3 P2 (HP/attrs/level NaN), 2 P3 (questIdx, dayT); round-trip y autoguardado exactos |
| 3 | Progresión y actos I-IV | 5 (acto1, acto2, actos 3-4, tonos/memorias, softlocks) | 279 · 4 fallos | Epílogo completado sin cantar; 2 softlocks (q4/q5 y q6-Mara); tonos de diálogo y 7 memorias correctos |
| 4 | Mapas y colisiones | 5 (lunaris/bosque, expansión, época, cripta, interiores/fast travel) | 185 · 12 fallos → 2 bugs nuevos | P1 fast travel a interiores; barrera de época sin feedback; raíz única de dims desincronizadas; cripta Zelda (77 pinchos, 4 palancas) 41/41 |
| 5 | Jefes, enemigos e IA | 5 (Guardián, IA, expansión, jefes expansión, casos límite) | 133 · 0 fallos finales | Coro nunca invoca; 2 jefes → HP no memorizada; noite binaria ×1.3; epochSwitch sin re-spawn; Guardián 39/39 y limpieza de Q verificadas |
| 6 | UI, HUD y menús | 5 (título, intro/diálogo, pausa, level-up/árbol, muerte/final/HUD) | ~140 · 6 hallazgos | advanceDialogue latente; nombre sin truncar; muerte sin botones; ESC en diálogo; creador y pausa por pestañas sanos |
| 7 | Skilltree, desafío y balance | 5 (puntos/UI, equipaje, daño base, desafío/arena, globales mutados) | 205 · 3 fallos reales | Fantasma de hueco; saveTree pisa otros árboles; herencia de árbol en newGame mismo nombre; arena y daño base (×1.10) correctos |
| 8 | Economía, NPC e interacción | 5 (tienda, pociones/forja/corazas, señuelos/restos, reputación, logros/stats) | 203 · 0 fallos | Oro nunca negativo, señuelos/cadáveres sanos, 12 logros sin duplicados, JSON corrupto tolerado; 1 descuadre menor de stats |
| 9 | Mundo vivo y tiempo | 5 (ciclo, timeskip, eventos, clima/noche, persistencia temporal) | 137 · 0 fallos finales | weatherStats ciega familias nuevas; nightAggroMul = radio (verificado); 5000 ticks sin desincronización; slowmo se recupera |
| 10 | Rendimiento, audio y estabilidad | 6 (maratón 20k ticks, estrés combate, invariantes 41+6, audio, HTTP E2E, saves/muertes) | ~150 · 5 bugs | 17 epochDiffs OOB (P2); audio sin degradado (P2); vol sin clamp, dayT NaN, timers mixtos (P3); servidor sano p95 42 ms |

**E2E navegador real (complementario):** título → creador (validación de nombre correcta) → intro → Valle de Lunaris (HUD, minimapa, misión, toasts) → movimiento/ataque → pausa por pestañas (Estado con tono/reputación/armadura) — **0 errores de página y 0 de consola**.

---

## 6) Veredicto

La base técnica es sólida y el contenido reciente (cripta Zelda, interiores, eventos del Eco) está bien telegrafiado y balanceado. Las prioridades de arreglo son claras: **(1)** sanitizar la lectura de saves, **(2)** sincronizar las dimensiones de los mapas de expansión con su contenido, **(3)** cerrar el ciclo de vida del estado global de skilltree entre partidas, y **(4)** tender la red de catchUp narrativa. Con esas cuatro correcciones desaparecen los 3 P1 y 14 de los 17 P2, y la demo queda lista para crecer hacia el Acto V y el NG+ que la biblia de historia ya planifica.

---

## 7) Estado tras la Ronda R16 (v0.7.0)

> Verificado con `scripts/smoke_r16.mts` (casos de reproducción del informe convertidos en
> checks) + batería completa 15/15 + E2E en navegador real. Todos los arreglos llevan
> comentario `R16 (#n QA)` en el código.

| # | Estado | Arreglo |
|---|--------|---------|
| 1, 2, 4, 5, 6, 20 | ✅ | `src/game/savefix.ts` — `sanitizeSaveData()` sanea campo a campo (colecciones con `Array.isArray`, numéricos finitos con defaults y clamp, `attrs` con sus 5 claves, `questIdx` acotado) + red `try/catch` en `continueGame`. Versión futura **tolerada** (contrato QA17: rechazarla borraría la partida) pero ya inofensiva |
| 3 | ✅ | `sanctuaryPos` cae junto a la primera salida en mapas sin santuario; `findSafeTile` acota al mapa; el menú «Viajar» solo lista mapas con santuario |
| 7 | ✅ | El pago/cierre del epílogo pasa del `onEnd` de los nodos de entrada a las opciones de cantar |
| 8, 9 | ✅ | catchUp por estado de q3/q4; `mara_gift` completa q6 si la Sirena cayó antes |
| 10 | ✅ | El feedback de barrera muestrea el tile tras el borde de la caja que choca |
| 11 | ✅ | costa 64×40 · aldea 44×44 · cumbres 66×42 + 9 cofres/ecos/carteles/enemigos planificados por R10-2; la lápida que sellaba la cripta familiar de Merrow se mueve; salida costa→aldea al borde real |
| 12 | ✅ | El cap de invocación de la Sirena cuenta solo sus neumos (WeakSet) |
| 13 | ✅ | Memoria de vida por jefe `bossHp_<mapa>_<tipo>` |
| 14, 15, 16, 31 | ✅ | `equipNewSkill` re-aplica la barra; `saveTree` fusiona con disco; `resetTreeForNewGame` en `newGame`; reaplicación de equipaje por identidad |
| 17 | ✅ | `advanceDialogue` sale si la acción cierra el diálogo |
| 18 | ✅ | `shortName()` con elipsis en HUD/pausa/final |
| 19, 33, 35 | ✅ | Audio en modo degradado (proxy con `try/catch` y silencio tras 20 fallos), volúmenes saneados a [0,1], `window.clearInterval` uniforme |
| 21 | ✅ | `dayT` viaja en el save |
| 22, 23, 24 | ✅ | Aguante con clamp a 0, tabla del combo corregida (el 3er golpe es el más fuerte), aviso flotante al quedarse sin aguante |
| 25 | ✅ | El Tejedor despierta con 30 de resonancia y la regenera (+2/s hasta 50); el aviso explica cómo cargarla |
| 26 | ✅ | Botón «DESPERTAR (E)» clicable en la pantalla de muerte |
| 27 | ✅ | ESC/M en diálogo completa el texto y cierra los nodos de pura charla (las decisiones no se saltan a ciegas) |
| 28 | ✅ | Toast «Viaje cancelado» al pausar durante el fundido |
| 29 | ✅ | La expansión usa la curva `nightAggroMul` |
| 30 | ✅ | `Q` re-evalúa los spawns ligados a una época (sin reaparición de los ya derrotados) |
| 32 | ✅ | `weatherStats()` cuenta nieve, rocío, humo, pétalos, hojas, polen y cripta |
| 34 | ✅ | `update()` sanea `dt` NaN/negativo |
| 36 | ✅ | Caída de jefe con VFX propio para TODOS los jefes (Sepulcro y Vesh incluidos) |
| 37 | — | Por diseño (dificultad dinámica): sin cambios |
| 38 | ✅ | El bonus del Ojo del Mercader suma a `coronasGanadas` |
| 39 | ✅ | `attackT` con clamp a 0 |
| 40 | ✅ | El veto de época dice el nombre del mapa («Entre estas paredes…» en salas cubiertas) |

**Bugs nuevos encontrados jugando en navegador y corregidos en R16:** camino `=` sin pintor en
5 mapas (franjas verde liso), cuadrado de suelo plano bajo cada árbol, nubes/estrellas/luna
dentro de casas y salas de la Ciudadela, niebla del alba en rectángulos de borde duro y
niebla muda `m` como baldosas grises sueltas.
