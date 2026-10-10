// ============================================================
// 18-a — HARNESS DE PREVIEW VISUAL de la Costa de Bruma (solo QA)
// NO forma parte del juego: es un bundle de navegador para ver
// biomas_costa.ts sin cablear render.ts (prohibido para 18-a).
// Construir:  bun build scripts/preview_costa.ts --outfile public/costa_preview.js --target browser
// Abrir:      /costa_preview.html servido desde public/
// ============================================================

import { MAPS, tileAt, TILE, ZOOM } from '../src/game/engine';
import { drawTile } from '../src/game/sprites';
import { drawExpansionTile, drawExpansionTallTile, drawExpansionProp } from '../src/game/sprites_expansion';
import {
  initCostaBioma, costaBiomaTick, drawCostaBiomaGround, drawCostaBiomaOverlay,
} from '../src/game/biomas_costa';

const VIEW_W = 960, VIEW_H = 540;

function main(): void {
  const cv = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!cv) return;
  cv.width = VIEW_W; cv.height = VIEW_H;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const map = MAPS.costa;
  const rows: string[] = [];
  for (let y = 0; y < map.h; y++) rows.push(map.rows[y] ?? '');

  // suelo base (misma receta que engine.buildGround, sin epoch diffs)
  const ground = document.createElement('canvas');
  ground.width = map.w * TILE; ground.height = map.h * TILE;
  const gx = ground.getContext('2d')!;
  gx.imageSmoothingEnabled = false;
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      const ch = tileAt(map, rows, tx, ty, 'presente');
      if (!drawExpansionTile(gx, ch, tx, ty, 'costa')) {
        drawTile(gx, ch, tx, ty, 'costa', 0, (dx: number, dy: number) =>
          tileAt(map, rows, tx + dx, ty + dy, 'presente'));
      }
    }
  }
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      const ch = tileAt(map, rows, tx, ty, 'presente');
      if (ch === 'p') drawExpansionTallTile(gx, ch, tx, ty, 'costa');
    }
  }

  // fake Game con la superficie que consume el módulo
  const fake = {
    mapId: 'costa' as const,
    map, rows,
    epoch: 'presente' as const,
    camX: 300, camY: 640,
    ctx, globalT: 0, dayT: 0.5,
  };
  type Fake = typeof fake;

  initCostaBioma();

  let t = 0;
  const props = map.props;
  // cámara por query (?x=..&y=..&night=1) o paneo automático
  const q = new URLSearchParams(location.search);
  const fixed = q.has('x');
  let night = q.get('night') === '1'; // tecla N alterna día/noche para ver el haz del faro
  function frame(): void {
    t += 1 / 60;
    fake.globalT = t;
    fake.dayT = night ? 0.02 : 0.5;
    costaBiomaTick(fake as unknown as Parameters<typeof costaBiomaTick>[0], 1 / 60);
    if (fixed) {
      fake.camX = Math.round(Number(q.get('x') ?? '300'));
      fake.camY = Math.round(Number(q.get('y') ?? '640'));
    } else {
      // paneo lento por la orilla sur (muelle → naufragio → faro → muelle)
      const loop = (t * 26) % 2600;
      fake.camX = Math.round(240 + (loop < 1300 ? loop : 2600 - loop));
      fake.camY = Math.round(600 + Math.sin(t * 0.1) * 90);
    }

    ctx.fillStyle = '#0c0a14';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const sx = (wx: number) => wx * ZOOM - fake.camX;
    const sy = (wy: number) => wy * ZOOM - fake.camY;
    ctx.drawImage(ground, Math.floor(fake.camX / ZOOM), Math.floor(fake.camY / ZOOM),
      VIEW_W / ZOOM, VIEW_H / ZOOM, 0, 0, VIEW_W, VIEW_H);
    drawCostaBiomaGround(fake as unknown as Parameters<typeof drawCostaBiomaGround>[0]);
    // props expansión que el módulo complementa (faro + naufragio)
    for (const pr of props) {
      if (pr.kind === 'faro') drawExpansionProp(ctx, 'faro', sx(pr.x * TILE + 8), sy(pr.y * TILE + 8), ZOOM, t, true);
      if (pr.kind === 'wreck') drawExpansionProp(ctx, 'wreck', sx(pr.x * TILE + 8), sy(pr.y * TILE + 8), ZOOM, t, false);
    }
    drawCostaBiomaOverlay(fake as unknown as Parameters<typeof drawCostaBiomaOverlay>[0]);
    requestAnimationFrame(frame);
  }
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'n' || e.key === 'N') night = !night;
  });
  requestAnimationFrame(frame);
}

main();
