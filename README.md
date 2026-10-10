# Ecos de Aelthar — Demo jugable (v0.9.0)

RPG de acción 2D con mecánica de **Ecos**: viaja entre el presente y el pasado para
devolver el Primer Canto al mundo. Todo el juego es procedural (pixel art y música
chiptune generados por código), sin un solo asset externo.

## Requisitos

- **Node.js 20.9 o superior** (Next.js 16 lo exige) o **Bun 1.x**

## Ejecutar

```bash
bun install        # o npm install
bun run dev        # o npm run dev
```

Abre http://localhost:3000 — la página es el juego a pantalla completa.

Otros scripts: `bun run build` / `bun run start` (producción), `bun run lint`,
`bun run typecheck` (validación de tipos en todo el proyecto).

## Controles

| Entrada | Acción |
|---|---|
| `WASD` / flechas | Moverse |
| `Shift` (mantener) | Correr (gasta Aguante) |
| `TAB` / rueda del ratón | Cambiar de página del grimorio (I ↔ II: 8 habilidades) |
| **Clic izquierdo** | Atacar (combo ×3; mantén para golpe cargado) |
| **Clic derecho** | Parada perfecta (0,2 s — aturde) |
| `Espacio` | Esquiva (i-frames) |
| `1` – `4` | Habilidades de tu disciplina |
| `E` | Interactuar / avanzar diálogo (en una cinemática: avanzar; `Esc` la salta) |
| `F` | Beber poción |
| `Q` | Alternar pasado / presente (tras recuperar el Eco) |
| `R` (mantener) | **Lente del Eco**: asoma la otra época alrededor del Portador |
| `Shift+T` | Esperar al alba |
| `Esc` / `M` | Pausa (Estado · Equipo · Inventario · Diario · Encargos · Opciones) |

En los diálogos con opciones, las respuestas **moldean tu tono** (empático,
pragmático, sarcástico, amenazante): los personajes reaccionan y la cifra
dominante se refleja en el Estado.

## Contenido de la demo

- **Actos I–V** (18 misiones, de «El Despertar» a «La Ciudadela»)
- Zonas: **Valle de Lunaris**, **Bosque Susurrante**, **Cripta del Primer Canto**,
  **Costa de Bruma**, **Aldea de Merrow**, **Cumbres Heladas**, **La Cuna del Canto**
  y **La Ciudadela de Vesh** (con Biblioteca, Sala de los Nombres, Archivo y
  Antecámara), más interiores y la **Arena del Eco** (modo desafío)
- 5 secciones opcionales (v0.9.0): **Campos del Molino**, **Hondonada de las
  Raíces**, **Acantilados del Faro Viejo**, **Pantano de las Velas** y **Glaciar
  del Eco**, cada una con su NPC, misión secundaria, puzle de épocas, mini-jefe
  y reliquia
- 2 disciplinas iniciales: **Espada del Alba** (cuerpo a cuerpo) y **Tejedor de Ecos** (magia elemental)
- Combate táctico: combo ×3, carga, esquiva con i-frames, parada perfecta,
  **barra de quiebre + REMATE**, empuje físico y estados (quemado/congelado)
- Jefes con fases e intro cinematográfica: **Guardián Hueco**, **Sirena Abisal**,
  **Gólem de Escarcha**, **Vult**, **el Coro**, **el Heraldo** y la opcional
  **Madre del Mar** (más el mini-jefe **El Sepulcro**)
- Compañera **Ilwen**: arco elemental cíclico, sistema de MARCA y técnica
  combinada «Lluvia de estrellas» (sube su afinidad combatiendo a tu lado)
- Sistema de **tono de diálogo** con apodos y reacciones de los NPC
- **Memorias del Portador** (overlay vitral) ligadas al progreso
- **Reputación** con 4 facciones (Guardianes, Orden, Círculo Verde, Liga)
- NPC de la biblia: Doran, el Heraldo de Vesh, Teo… y un secreto bajo las flores
- Santuarios con **guardado** y **viaje rápido**, ciclo día/noche,
  misiones, forja, tienda y pantalla final con estadísticas

> El juego funciona íntegramente en el cliente (canvas + WebAudio). La partida
> se guarda en `localStorage` (Santuarios y autoguardado al cambiar de zona).
> No requiere base de datos.

## Novedades v0.9.0 (Ronda 18)

- **Una historia que se sigue**: la Niebla Muda **sella los caminos** hasta que
  la historia te deja pasar (te empuja con niebla y te dice qué falta).
  **Cinemáticas en el motor** (cámara, diálogo, actores, rótulos de ACTO I–V) en
  el despertar, al recuperar el Eco, en la Cripta, la Costa, Merrow, las
  Cumbres y al llegar a cada sección nueva. Intro con cordilleras en parallax,
  los asesinos de Vesh y el Portador que se levanta.
- **El Portador v4** (26×30 px, volumen de 3 tonos y contorno selectivo):
  animaciones de reposo, andar, correr, ataque, conjuro, esquiva y daño, y
  **cambia según tu equipo** — 6 armaduras (túnica → cuero → malla → placas →
  Manto de Ecos → placas del Primer Canto) y arma que crece con la forja
  (espada y escudo / báculo con cristal) con brillo en la punta.
- **Movimiento y combate más rápidos**: correr con `Shift`, inercia corta,
  esquiva que cancela el ataque, polvo al pisar y **alarma de manada**.
  **Grimorio de dos páginas** (`TAB`/rueda): 8 habilidades a mano.
- **Mapas más grandes**: 5 secciones nuevas conectadas (molino, hondonada,
  acantilado, pantano, glaciar) con puzles que obligan a cruzar de época.
- **Contenido**: 9 criaturas esculpidas con volumen (cuervo, araña, cangrejo,
  fuego fatuo) y 5 **mini-jefes** con patrones propios (Reina de los Cuervos,
  Ciervo de Ceniza, Rey Cangrejo, Viuda de Niebla, Wendigo de Escarcha);
  5 NPCs y **misiones secundarias** con diálogos que cambian según el
  progreso; **reliquias** equipables (velocidad, defensa, Resonancia,
  regeneración, congelar).
- **Menos cofres sueltos**: de 30 a 12 en las regiones; las recompensas
  vienen ahora de misiones, mini-jefes y puzles.
- **Pasado y presente que se notan**: la música cambia de época (presente
  apagado; pasado brillante con eco de memoria) y se hunde al viajar; esfera
  de reloj que gira hacia atrás o hacia delante y cartela «EL PASADO · hace
  trescientos años»; ceniza que cae en el presente.
- **UI**: pestaña **ENCARGOS** en la pausa (misiones secundarias + reliquias:
  fijar misión en el HUD, equipar reliquia), seguimiento de misión secundaria
  en el HUD, pestaña del grimorio junto a la barra, retratos de los NPCs
  nuevos.
- **Profundidad en todos los sprites**: pase de volumen horneado (luz
  arriba-izquierda, sombra fría) para NPCs y enemigos humanoides.
- **Arreglos**: el destello del Filo del Alba blanqueaba toda la pantalla
  (destellos de color con tope); los NPCs nuevos salían con el retrato del
  fuego fatuo.

## Novedades v0.8.0 (Ronda 17)

- **Pasado y presente con consecuencias**: 12 **Semillas del Eco** repartidas
  por Lunaris, Bosque, Costa, Merrow y Cumbres. En el presente solo hay tierra
  muerta; plántalas en el pasado (`Q` + `E`) y, al volver, habrá crecido un
  **Árbol del Eco** cuyo fruto cura del todo y da poción y coronas (cada 4
  frutos, +1 punto de atributo). Se guardan en la partida.
- **Lente del Eco** (mantén `R`): un círculo alrededor del Portador muestra el
  suelo y los cofres/objetos de la otra época antes de viajar.
- **Transición de época** con barrido circular y atmósfera propia: el pasado,
  cálido y con motas doradas; el presente, frío y apagado.
- **Equilibrio**: los enemigos escalan con el **nivel de zona** (Lunaris 1 →
  Ciudadela 12) y los jefes tienen vida de diseño nueva (Guardián 470 → Heraldo
  1180), sin escalar por zona. Antes el Acto II se pasaba de 1-2 golpes.
- **Mapas**: nieve con ventisqueros, huellas y piedras; arena con ondas de
  marea; prados salinos con juncos.
- **UI**: fila de recursos con iconos (coronas · pociones · mejora de arma),
  distintivo de época bajo el minimapa (con teclas `Q`/`R` y contador de
  semillas), pistas que ya se retiran y no tapan la barra de habilidades,
  paneles de Estado/Equipo y árbol de habilidades sin textos solapados.
- **Arreglos**: la intro cinemática de jefe solo salía con el primer jefe de la
  sesión; el banner de jefe persistía al cambiar de mapa; textos de versión y
  del título desfasados.

## Novedades v0.7.0 (Ronda 16)

- **Efectos de combate y magia** (`src/game/actors/vfx.ts`): media luna de filo
  en cada golpe del combo, impactos y críticos, zarpazos al recibir daño,
  Tajo Lunar, Grito de Guerra con aura, cúpula del Muro de Alba, hojas solares
  del Filo del Alba, firmas elementales del Tejedor (fuego, hielo, rayo, círculo
  rúnico), pilar de subida de nivel y caída de jefe. Brillan de noche.
- **Enemigos nuevos**: Centinela de Cristal (rayo telegrafiado), Raíz Hambrienta
  (se entierra y brota) y Marinero Ahogado.
- **Jefa opcional «La Madre del Mar»** en los Jardines de Sal de la Costa
  (tras derrotar a la Sirena, desde la misión 9): 3 fases.
- Zonas de la expansión que estaban fuera del mapa ahora son jugables (naufragio,
  mina, mirador, campamento, huerto y cementerio de Merrow).
- Guardado tolerante a corrupción, viaje rápido seguro y ~40 arreglos de QA
  (detalle en `docs/agentefalta.md` §7).

## Pruebas

```bash
npx tsc --noEmit                 # tipos
npx tsx scripts/smoke_r18.mts    # smoke de la ronda 18 (hay uno por ronda en scripts/)
```

## Estructura

```
src/
  game/
    engine.ts     # máquina de estados, guardado, misiones, interacción
    update.ts     # IA de enemigos, jefe de 3 fases, compañera, proyectiles
    render.ts     # mundo + HUD + iluminación por capas (canvas offscreen)
    screens.ts    # título, intro, pausa, diálogo, muerte, final
    maps.ts       # Lunaris, Bosque y Cripta + diferencias entre épocas
    data.ts       # misiones, diálogos, enemigos, habilidades, memorias
    sprites.ts    # pixel art por código (personajes, tiles, retratos)
    fx.ts         # partículas ambientales, estelas, banner de jefe
    fxcore.ts     # shake / flash / slowmo / knockback
    hooks.ts      # acciones de diálogo extendidas (memorias, reputación)
    audio.ts      # chiptune procedural + ~30 SFX sintetizados
    types.ts      # tipos del motor
    ui.ts         # helpers de UI en canvas
  components/game/EcosGame.tsx
```

## Estado

Demo vertical slice (Acto I). v0.2.1: sistema de tono, memorias, reputación,
remate, knockback, Ilwen elemental, iluminación por capas corregida y
defensas anti-softlock en los viajes entre mapas.
