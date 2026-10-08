# Ecos de Aelthar — Demo jugable (vertical slice)

RPG 2D de acción con píxeles dibujados por código, mecánica de **Ecos** (viaje entre el pasado y el presente), combate táctico, 3 zonas, jefe final de 3 fases y cadena principal de 5 misiones. Todo el arte, los mapas y la música chiptune se generan proceduralmente: **no necesita assets externos**.

## Requisitos

- Node.js 18 o superior (o Bun 1.x)
- Navegador moderno (Chrome / Edge / Firefox)

## Cómo ejecutar

```bash
# 1. Instalar dependencias
npm install        # o: bun install

# 2. Arrancar en modo desarrollo
npm run dev        # o: bun run dev

# 3. Abrir en el navegador
# http://localhost:3000
```

Producción:

```bash
npm run build
npm start          # http://localhost:3000
```

> El juego funciona íntegramente en el cliente (canvas + WebAudio). La partida se guarda en `localStorage` al activar Santuarios y al cambiar de zona. No requiere base de datos.

## Estructura del proyecto

```
src/
  components/game/EcosGame.tsx   # Componente React: canvas a pantalla completa + creación de personaje
  game/
    engine.ts     # Máquina de estados, bucle principal, guardado, misiones, forja/tienda
    update.ts     # IA de enemigos, jefe de 3 fases, compañera, proyectiles, día/noche
    render.ts     # Render del mundo, iluminación, HUD, minimapa, barra de jefe
    screens.ts    # Título, intro, pausa (4 pestañas), diálogos, muerte, final
    maps.ts       # Lunaris, Bosque y Cripta + diferencias entre épocas
    data.ts       # Misiones, diálogos, enemigos, habilidades y objetos (editable)
    sprites.ts    # Pixel art generado por código (héroe, NPCs, enemigos, tiles)
    audio.ts      # Chiptune procedural (5 pistas) + ~30 efectos de sonido sintetizados
    ui.ts         # Helpers de UI en canvas (texto pixel, paneles, barras, sliders)
    types.ts      # Tipos del motor
```

## Controles

| Tecla | Acción |
|---|---|
| WASD / Flechas | Moverse |
| J / Z | Atacar (combo ×3) |
| K / X | Habilidad (según disciplina) |
| L / C | Esquiva (con i-frames) |
| Shift (en defensa) | Parada perfecta (0,2 s) |
| E | Interactuar / Hablar |
| Q | Cambiar de época (Ecos) |
| 1–4 | Habilidades |
| Shift+T | Esperar al alba |
| Esc / P | Pausa (Estado / Equipo / Diario / Sistema) |

## Contenido de la demo

- 3 zonas: **Lunaris** (pueblo), **Bosque de Susurros** y **Cripta de Aelthar**
- 2 disciplinas iniciales: **Tejedor de Vientos** y **Eco de Piedra**
- Combate táctico: combo, carga, esquiva, parada perfecta y **quiebre** de guardia
- Mecánica de Ecos: dos épocas por mapa (puente roto/entero, niebla, cobertizo…)
- Jefe final **Guardián Hueco** con 3 fases, onda expansiva e invocación de sombras
- 5 misiones de la cadena principal, ~25 nodos de diálogo, santuarios con guardado y viaje rápido, ciclo día/noche y música adaptativa por zona/combate
