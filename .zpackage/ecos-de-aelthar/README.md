# Ecos de Aelthar — Demo jugable (v0.2.1)

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
| **Clic izquierdo** | Atacar (combo ×3; mantén para golpe cargado) |
| **Clic derecho** | Parada perfecta (0,2 s — aturde) |
| `Espacio` | Esquiva (i-frames) |
| `1` – `4` | Habilidades de tu disciplina |
| `E` | Interactuar / avanzar diálogo |
| `F` | Beber poción |
| `Q` | Alternar pasado / presente (tras recuperar el Eco) |
| `Shift+T` | Esperar al alba |
| `Esc` / `M` | Pausa (Estado · Equipo · Diario · Sistema) |

En los diálogos con opciones, las respuestas **moldean tu tono** (empático,
pragmático, sarcástico, amenazante): los personajes reaccionan y la cifra
dominante se refleja en el Estado.

## Contenido de la demo

- 3 zonas: **Valle de Lunaris**, **Bosque Susurrante** y **Cripta del Primer Canto**
- 2 disciplinas iniciales: **Espada del Alba** (cuerpo a cuerpo) y **Tejedor de Ecos** (magia elemental)
- Combate táctico: combo ×3, carga, esquiva con i-frames, parada perfecta,
  **barra de quiebre + REMATE**, empuje físico y estados (quemado/congelado)
- Jefe **Guardián Hueco** de 3 fases con banner cinematográfico
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
