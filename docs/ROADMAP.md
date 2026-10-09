# ECOS DE AELTHAR — ROADMAP MAESTRO (v1.0)

> Documento vivo que recoge TODO el feedback del jugador (oct 2026) y lo convierte
> en un plan de trabajo por EPICs y rondas. Cada ronda lanza 8-10 agentes en
> paralelo con propiedad exclusiva de archivos; antes de integrar: typecheck +
> build de producción + prueba en juego con consola limpia. Al cerrar cada ronda:
> commit en `mejora-visual` → merge a `main` → push.
>
> Prioridades: **P0** bugs que rompen la experiencia · **P1** game feel y usabilidad ·
> **P2** visual y ambientación · **P3** contenido nuevo · **P4** sistemas grandes.

---

## EPIC 1 — Bugs críticos (P0)

| # | Bug | Dónde | Estado |
|---|-----|-------|--------|
| 1.1 | La habilidad pasado/presente se pierde al salir y volver a entrar (a veces no la tienes al reentrar) | timeskip/engine (estado de época) | Ronda 8 |
| 1.2 | Enemigos se buguean/atascados en árboles (tiles altos sólidos sin esquiva de obstáculo) | update (pathing/colisión) | Ronda 8 |
| 1.3 | Cofres aparecen bugueados dentro de árboles (spawn sin validar tile alto) | engine (spawn de cofres) | Ronda 8 |
| 1.4 | Al conseguir el primer poder pasado/presente, millones de enemigos bugueados haciendo un círculo | engine (evento de spawn) | Ronda 8 |
| 1.5 | Al salir de la cripta el fantasma se multiplica | update (gestión de enemigos entre mapas) | Ronda 8 |
| 1.6 | A la cripta se entra por el LADO, no por la puerta | engine (colisión/zona de entrada) | Ronda 8 |
| 1.7 | Tras el puente, en presente hay un muro de hierba verde feo (barrera de época sin arte) | engine/maps (barrera de época) | Ronda 8 |
| 1.8 | Revisión general de bugs + optimización continua | QA por ronda | perpetuo |

## EPIC 2 — Game feel: movimiento, combate, parry y jefes (P1)

| # | Mejora | Detalle | Estado |
|---|--------|---------|--------|
| 2.1 | Movimiento del jugador cómodo | aceleración/fricción suaves, respuesta inmediata, buffer de esquiva, sin sensación de hielo | Ronda 8 |
| 2.2 | Ataque cómodo | buffer de input de ataque, cancelación breve al esquivar, hit-stop sutil, estela del arma, feedback de impacto | Ronda 8 |
| 2.3 | Parry v2 | parry a proyectil REFLEJA el proyectil hacia el enemigo (daño propio del proyectil); señal clara y ventana generosa | Ronda 8 |
| 2.4 | Parry vs jefes | los jefes mezclan ataques NORMALES (parryables, con ventana) y de zona (no parryables pero esquivables, con telegrafía clara) | Ronda 8 + 9 |
| 2.5 | IA enemiga más inteligente | no amontonarse (espaciado entre atacantes), flanqueo ligero, retirada tras atacar, reacción al parry | Ronda 8 |
| 2.6 | Animaciones de enemigos y jefes | caminata de jefes/enemigos, poses de viento-ataque-impacto, intro de jefe MÁS CORTA | Ronda 9 |
| 2.7 | Modelo del portador más fluido | animaciones de caminar/atacar/esquivar más densas (más frames), silueta mejorada | Ronda 9 |

## EPIC 3 — Interfaz y menús (P1)

| # | Mejora | Detalle | Estado |
|---|--------|---------|--------|
| 3.1 | Menú principal impresionante | QUITAR "Basado en el Documento de Diseño de Espapito"; título con presencia (logo, atmósfera, partículas, panel de versión discreto) | Ronda 8 |
| 3.2 | Menú de pausa usable | navegación clara entre pestañas, no perder el contexto al abrir/cerrar, atajos visibles | Ronda 8 |
| 3.3 | Equipo intuitivo | cómo equipar armas/armaduras OBVIO: lista con comparación (daño/defensa actual vs nuevo), equipar con 1 clic, indicador de equipado | Ronda 8 |
| 3.4 | Diario/objetivos sin fugas | salir del diario ya no cierra el menú entero; cadenas de misión visibles (paso actual de la cadena), objetivos legibles | Ronda 8 |
| 3.5 | Subida de nivel clara | panel de level-up con los 3 puntos de atributo y qué hacen; qué desbloquea cada atributo | Ronda 8 |
| 3.6 | Creador de portador profesional | más visual: retrato grande animado, descripciones claras, comparación de disciplinas, diseño de panel premium | Ronda 8 |
| 3.7 | Árbol de habilidades v2 | SITIO para las habilidades nuevas (ranuras por rama), prévisualización de qué hace cada nodo, sensación de progresión | Ronda 8 |

## EPIC 4 — Balance (P1)

| # | Mejora | Detalle | Estado |
|---|--------|---------|--------|
| 4.1 | Crítico menos común | probabilidad claramente más baja; cuando sale, MÁS jugoso (efecto y número distintos) | Ronda 8 |
| 4.2 | Dificultad que reta | los enemigos suponen peligro real: más vida/daño escalado, patrones que castigan errores, sin ser injustos | Ronda 8 |
| 4.3 | Desafío separado de la historia | el desafío usa un PORTADOR PROPIO (no el de campaña, para no desvalancear); al vencer jefes NO salen fragmentos de historia; balance y recompensas propios del modo | Ronda 8 |
| 4.4 | XP por Eco | conseguir un Eco otorga algo de XP (la progresión no se estanca) | Ronda 8 |

## EPIC 5 — Cielo, luz y vida ambiental (P2)

| # | Mejora | Detalle | Estado |
|---|--------|---------|--------|
| 5.1 | Nubes realistas | varias capas con parallax, bordes suaves lobulados, deriva por viento, sombras de nube deslizándose por el suelo | Ronda 8-9 |
| 5.2 | Estrellas realistas | titileo individual, densidad variable por zona del cielo, banda tenue de Vía Láctea, alguna estrella fugaz | Ronda 8-9 |
| 5.3 | Noches peligrosas | oscuridad real con radio de luz del portador, enemigos nocturnos más agresivos, sonido de noche; la noche SE SIENTE peligrosa | Ronda 9 |
| 5.4 | Árboles más vivos | el vaivén de copas MÁS amplitud (hoy casi no se mueven), ramas que se mecen, hojas sueltas | Ronda 8-9 |
| 5.5 | Iluminación v4 | revisión integral: fogatas, faroles, ventanas, reflejos; luz que cuenta la historia | Ronda 9 |

## EPIC 6 — Mapas y ambientación (P2)

| # | Mejora | Detalle | Estado |
|---|--------|---------|--------|
| 6.1 | Expansión al nivel v4 | Cumbre Helada, Costa Bruma y Aldea Bruma con efectos nuevos, terreno v4, enemigos propios visuales — mismo nivel que el mundo base | Ronda 9 |
| 6.2 | Mapas más grandes | ampliar los 6 mapas con zonas nuevas interesantes (no relleno) | Ronda 10 |
| 6.3 | Ambientación e historia en el mundo | más objetos de historia y ambiente (placas, restos, altares, carteles) que cuentan lore SIN estorbar el paso; MENOS cofres (no en todos lados) | Ronda 10 |
| 6.4 | Cripta tipo Zelda | más larga, con SECCIONES y apartados nuevos, más enemigos, ZONAS DE PELIGRO (pinchos/láseres de notas estilo Zelda), UN puzzle para avanzar (sin pasarse), entrada MÁS DIFÍCIL (más historia antes + mini-jefe en la entrada), no es trivial llegar a zonas avanzadas | Ronda 10 |
| 6.5 | Interiores de casas | poder ENTRAR en casas (empezar por 2-3: la de la Anciana, la tienda, la taberna) con NPCs y detalles dentro | Ronda 10 |
| 6.6 | Eventos aleatorios | incursiones de enemigos en MANADA que aparecen juntas y te buscan, viajeros, hallazgos, fenómenos del Eco | Ronda 10 |

## EPIC 7 — Contenido: historia, jefes, NPCs y magias (P3)

| # | Mejora | Detalle | Estado |
|---|--------|---------|--------|
| 7.1 | Más jefes y mini-jefes | nuevos mini-jefes por mapa + jefes de historia; variedad de patrones | Ronda 11 |
| 7.2 | Inicio impresionante | cinemática/animación de inicio DIFERENTE según la disciplina elegida | Ronda 11 |
| 7.3 | Más NPCs con vida | más NPCs, rutinas (caminan, trabajan, duermen), diálogos que cambian con la historia, más interacción | Ronda 11 |
| 7.4 | Animaciones de historia | escenas animadas en los puntos clave de la historia (no solo texto) | Ronda 11 |
| 7.5 | Magias espectaculares | que SE SIENTAN poderosas: cast con carga visible, impacto contundente, residuo mágico, sonidos nuevos | Ronda 9 |
| 7.6 | Forzar avance de historia | zonas avanzadas gated por progreso de historia (sin romper exploración) | Ronda 11 |

## EPIC 8 — Sistemas grandes (P4)

| # | Mejora | Detalle | Estado |
|---|--------|---------|--------|
| 8.1 | Multijugador | ver análisis abajo; se diseña la infraestructura (serialización de estado) pero NO se implementa hasta cerrar P0-P3 | futuro |
| 8.2 | Sistema de niveles v2 | más atributos, sinergias con skill tree | futuro |
| 8.3 | Más mecánicas | escalada/interacción con el entorno, combos de canciones, mascotas del Eco | futuro |

---

## Multijugador — análisis (pregunta del jugador)

**Situación actual**: el juego corre 100% en el cliente (loop canvas local, estado en
memoria, guardado en localStorage). No hay servidor de juego.

**Opción A — Coop online (2-4 jugadores)** · esfuerzo ALTO (3-5 rondas dedicadas)
1. Servidor Node + WebSocket (o Socket.IO) con la lógica de ENEMIGOS y DAÑO como
   autoridad; el cliente predice su propio movimiento.
2. El motor ya separa `update.ts`/`render.ts`: el paso clave es extraer el estado
   del juego a un objeto serializable ( snapshots ~10-20/s ) y aplicar deltas.
3. Sincronizar: posiciones, época (pasado/presente — cada jugador o compartida?),
   jefes (fases compartidas), botín, progreso de historia.
4. Necesitaríamos hosting del servidor (el preview actual es estático).
**Recomendación**: dejarlo para después del roadmap single-player; cuando toque,
empezar por un "coop de arena" (modo desafío a 2) que es el caso más barato.

**Opción B — Coop local (2 mandos, misma pantalla)** · esfuerzo MEDIO
- Gamepad API ya disponible en navegador; dividir HUD; cámara compartida con zoom.
- Sin servidor; ideal para "probar cómo se siente" antes de invertir en online.

---

## Plan de rondas

| Ronda | Alcance | Épicas |
|-------|---------|--------|
| **8** (ahora) | Bugs críticos + game feel + menús + balance | 1.1-1.7, 2.1-2.5, 3.1-3.7, 4.1-4.4, 5.4 |
| **9** | Cielo/luz/noche + expansión v4 + magias + animaciones de combate | 5.1-5.3, 5.5, 6.1, 7.5, 2.6-2.7 |
| **10** | Mapas grandes + cripta Zelda + interiores + eventos aleatorios | 6.2-6.6 |
| **11** | Contenido: jefes, NPCs, cinemáticas, historia gated | 7.1-7.4, 7.6 |
| **12** | Sistemas grandes + QA integral final + pulido | 8.2-8.3, QA |
| **13** | Acto V fase 1 «La carta»: Cuna del Canto (época ternaria 'aún'), Fragmento 2, q17 | docs/history.md §19.2 (R13) |
| **14** | Acto V fase 2 «La Ciudadela»: distritos que devuelven verdades, q18, Consejo | docs/history.md §711/§720/§734 (R14) |

Cada ronda: 8-10 agentes → verificación (typecheck, build, juego, consola) →
commit → merge a main → push. QA de solo lectura en cada ronda.

> Rondas 9–12 ejecutadas (merge f1ca32e/fc68b6c). Desde R13 el calendario lo
> gobierna la biblia: docs/history.md §19.2 (rondas 13–22, «El Segundo Canto»).
> R13 «La carta» entregada: mapa 'cuna' (baseEpoch 'aun' — época ternaria),
> Fragmento 2, q17, smoke_acto5.ts (14 smokes verdes).> R14 «La Ciudadela» entregada: 5 mapas nuevos (ciudadela 62×44 por distritos
> + biblioteca, nombres, archivo, antecamara), q18 (4 pasos), las 3 verdades
> devolubles (o forzadas: Orden −8, ciudSangre), catecismo de los faroles
> (Naia), Consejo con la póstuma completa, muralla que canta, hook
> acto5R14Hook + watcher idempotente; smokes acto2/4/5 al contrato R14
> (18 misiones, 13 mapas). tsc 0 + 13/13 smokes verdes. Gancho R15.
