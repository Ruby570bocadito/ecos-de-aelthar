// ============================================================
// ECOS DE AELTHAR — Arte pixel procedural
// Sprites generados en canvas (humanoides con paleta, lobos,
// jefe, cofres, santuario...) + tiles del mundo
// ============================================================

export function hash2(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export type Frames = HTMLCanvasElement[];

const SPR: Record<string, Frames> = {};

function mkCanvas(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return { c, x };
}

// ---------------- Humanoides (16×18) ----------------

export interface HumanPal {
  outline: string;
  hair: string; hairS?: string;
  skin: string;
  body: string; bodyS: string;
  accent: string;
  legs: string; legsS?: string;
  boots: string;
  eye: string;
  hood?: boolean;
  ribs?: boolean;
  beard?: string;
}

function px(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, C: string) {
  x.fillStyle = C; x.fillRect(X, Y, W, H);
}

function buildHumanoid(pal: HumanPal): Frames {
  const frames: Frames = [];
  const dirs: ('down' | 'up' | 'side')[] = ['down', 'up', 'side'];
  const hs = pal.hairS ?? pal.hair;
  const ls = pal.legsS ?? pal.legs;
  for (const dir of dirs) {
    for (let f = 0; f < 2; f++) {
      const { c, x } = mkCanvas(16, 18);
      if (dir === 'down') {
        // cabeza
        px(x, 4, 1, 8, 1, pal.outline);
        px(x, 3, 2, 10, 5, pal.hair);
        px(x, 3, 2, 10, 1, hs);
        if (pal.hood) { px(x, 3, 6, 10, 2, pal.hair); px(x, 4, 7, 8, 1, hs); }
        px(x, 5, 4, 6, 4, pal.skin);
        px(x, 6, 5, 1, 2, pal.eye); px(x, 9, 5, 1, 2, pal.eye);
        if (pal.beard) px(x, 5, 7, 6, 2, pal.beard);
        px(x, 3, 6, 1, 2, pal.hair); px(x, 12, 6, 1, 2, pal.hair);
        // cuerpo
        px(x, 4, 8, 8, 6, pal.body);
        px(x, 4, 8, 8, 1, pal.bodyS);
        px(x, 5, 11, 6, 1, pal.accent);
        px(x, 4, 13, 8, 1, pal.outline);
        if (pal.ribs) { px(x, 6, 9, 4, 1, pal.bodyS); px(x, 6, 10, 4, 1, pal.bodyS); }
        // brazos (balanceo)
        const aL = f === 0 ? 8 : 7, aR = f === 0 ? 8 : 9;
        px(x, 2, aL, 2, 4, pal.body); px(x, 2, aL + 4, 2, 1, pal.skin);
        px(x, 12, aR, 2, 4, pal.body); px(x, 12, aR + 4, 2, 1, pal.skin);
        // piernas
        if (f === 0) {
          px(x, 5, 14, 3, 3, pal.legs); px(x, 8, 14, 3, 3, pal.legs);
          px(x, 5, 17, 3, 1, pal.boots); px(x, 8, 17, 3, 1, pal.boots);
        } else {
          px(x, 4, 14, 3, 3, ls); px(x, 9, 14, 3, 3, ls);
          px(x, 4, 17, 3, 1, pal.boots); px(x, 9, 17, 3, 1, pal.boots);
        }
      } else if (dir === 'up') {
        px(x, 4, 1, 8, 1, pal.outline);
        px(x, 3, 2, 10, 6, pal.hair);
        px(x, 3, 2, 10, 1, hs);
        px(x, 4, 8, 8, 6, pal.body);
        px(x, 4, 8, 8, 1, pal.bodyS);
        if (pal.hood) px(x, 4, 13, 8, 1, pal.accent);
        px(x, 4, 13, 8, 1, pal.outline);
        const aL = f === 0 ? 8 : 7, aR = f === 0 ? 8 : 9;
        px(x, 2, aL, 2, 4, pal.body);
        px(x, 12, aR, 2, 4, pal.body);
        if (f === 0) {
          px(x, 5, 14, 3, 3, pal.legs); px(x, 8, 14, 3, 3, pal.legs);
          px(x, 5, 17, 3, 1, pal.boots); px(x, 8, 17, 3, 1, pal.boots);
        } else {
          px(x, 4, 14, 3, 3, ls); px(x, 9, 14, 3, 3, ls);
          px(x, 4, 17, 3, 1, pal.boots); px(x, 9, 17, 3, 1, pal.boots);
        }
      } else { // side (mirando a la derecha)
        px(x, 5, 1, 8, 1, pal.outline);
        px(x, 4, 2, 9, 5, pal.hair);
        px(x, 4, 2, 9, 1, hs);
        if (pal.hood) { px(x, 4, 6, 8, 2, pal.hair); }
        px(x, 7, 4, 5, 4, pal.skin);
        px(x, 10, 5, 1, 2, pal.eye);
        if (pal.beard) px(x, 8, 7, 4, 2, pal.beard);
        px(x, 5, 8, 6, 6, pal.body);
        px(x, 5, 8, 6, 1, pal.bodyS);
        px(x, 6, 11, 4, 1, pal.accent);
        px(x, 5, 13, 6, 1, pal.outline);
        if (pal.ribs) { px(x, 6, 9, 3, 1, pal.bodyS); px(x, 6, 10, 3, 1, pal.bodyS); }
        // brazo delantero
        px(x, 8, f === 0 ? 9 : 8, 3, 3, pal.body);
        px(x, 10, f === 0 ? 11 : 10, 2, 1, pal.skin);
        // piernas zancada
        if (f === 0) {
          px(x, 6, 14, 2, 3, pal.legs); px(x, 8, 14, 2, 3, pal.legs);
          px(x, 6, 17, 2, 1, pal.boots); px(x, 8, 17, 2, 1, pal.boots);
        } else {
          px(x, 5, 14, 2, 3, ls); px(x, 9, 14, 2, 3, ls);
          px(x, 5, 17, 2, 1, pal.boots); px(x, 9, 17, 2, 1, pal.boots);
        }
      }
      frames.push(c);
    }
  }
  // orden frames: [downA, downB, upA, upB, sideA, sideB]
  return frames;
}

export function frameIndex(dir: string, moving: boolean, anim: number): number {
  const base = dir === 'down' ? 0 : dir === 'up' ? 2 : 4;
  if (!moving) return base;
  return base + (Math.floor(anim * 6) % 2);
}

// ---------------- Lobo de niebla (18×12) ----------------

function buildWolf(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(18, 12);
    const O = '#26243a', B = '#7d7d9f', BS = '#5c5c80', W = '#a7a7c4';
    px(x, 3, 3, 10, 5, B);            // cuerpo
    px(x, 3, 3, 10, 1, W);
    px(x, 2, 7, 12, 1, O);
    px(x, 11, 1, 4, 5, B);            // cabeza
    px(x, 13, 0, 1, 2, B);            // oreja
    px(x, 12, 0, 1, 2, BS);
    px(x, 14, 3, 3, 2, BS);           // hocico
    px(x, 12, 2, 1, 1, '#ff6a4d');    // ojo
    px(x, 16, 4, 1, 1, O);
    px(x, 0, 2, 3, 2, BS);            // cola
    px(x, 0, 1, 1, 2, BS);
    const ly = f === 0 ? 8 : 9;
    px(x, 4, ly, 2, 3, BS); px(x, 7, f === 0 ? 9 : 8, 2, 3, BS);
    px(x, 10, ly, 2, 3, BS); px(x, 12, f === 0 ? 9 : 8, 2, 3, BS);
    // niebla
    x.globalAlpha = 0.35;
    px(x, 1 + f, 9, 3, 2, W); px(x, 13 - f, 8, 4, 2, W);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Guardián Hueco (32×34) ----------------

function buildGuardian(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(32, 34);
    const O = '#141220', S = '#4a4660', S2 = '#5f5a7a', HL = '#8a84a8';
    const GLOW = f === 0 ? '#7ee8ff' : '#baf4ff';
    // capa
    px(x, 8, 14, 16, 12, '#2c2440');
    px(x, 7, 22 + f, 3, 6, '#221c33'); px(x, 22, 21 - f, 3, 6, '#221c33');
    // hombros
    px(x, 2, 12, 8, 6, S2); px(x, 22, 12, 8, 6, S2);
    px(x, 2, 12, 8, 1, HL); px(x, 22, 12, 8, 1, HL);
    // torso con hueco
    px(x, 9, 12, 14, 13, S);
    px(x, 9, 12, 14, 1, HL);
    px(x, 13, 16, 6, 6, O);            // hueco
    px(x, 14, 17, 4, 4, GLOW);         // brillo interior
    // astillas/cracks
    px(x, 10, 14, 1, 4, O); px(x, 21, 18, 1, 5, O); px(x, 16, 24, 3, 1, O);
    // cabeza/casco con cuernos
    px(x, 11, 4, 10, 8, S2);
    px(x, 11, 4, 10, 1, HL);
    px(x, 9, 2, 2, 6, HL); px(x, 21, 2, 2, 6, HL);   // cuernos
    px(x, 8, 1, 2, 3, HL); px(x, 22, 1, 2, 3, HL);
    px(x, 13, 7, 2, 2, GLOW); px(x, 17, 7, 2, 2, GLOW); // ojos
    // brazos y garras
    const ay = f === 0 ? 18 : 16;
    px(x, 0, ay, 3, 9, S2); px(x, 29, ay, 3, 9, S2);
    px(x, 0, ay + 9, 3, 2, O); px(x, 29, ay + 9, 3, 2, O);
    // fragmentos flotantes
    x.globalAlpha = 0.8;
    px(x, 5, 27 + f, 2, 2, S2); px(x, 25, 28 - f, 2, 2, S2); px(x, 15, 30, 2, 2, S2);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

// ---------------- Objetos ----------------

function buildChest(): { closed: Frames; open: Frames } {
  const mk = (open: boolean) => {
    const { c, x } = mkCanvas(16, 14);
    const O = '#3a2414', W = '#8a5a2b', W2 = '#6d4520', G = '#f0c84a';
    px(x, 2, open ? 5 : 3, 12, open ? 8 : 9, W);
    px(x, 2, open ? 5 : 3, 12, 2, W2);
    px(x, 2, open ? 12 : 10, 12, 1, O);
    px(x, 1, 3, 14, 1, O); px(x, 1, 12, 14, 1, O);
    px(x, 7, open ? 8 : 6, 2, 3, G);
    if (open) {
      px(x, 2, 1, 12, 3, W2);           // tapa abierta
      px(x, 3, 4, 10, 2, '#fff3c0');    // brillo interior
      px(x, 4, 5, 8, 1, G);
    } else {
      px(x, 2, 3, 12, 2, W2);
    }
    return c;
  };
  return { closed: [mk(false)], open: [mk(true)] };
}

function buildSanctuary(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(20, 30);
    const O = '#1c2438', S = '#5a6a8a', S2 = '#42506c';
    px(x, 7, 4, 6, 24, S);
    px(x, 7, 4, 2, 24, S2);
    px(x, 6, 2, 8, 3, S2);
    px(x, 5, 27, 10, 3, S2); px(x, 4, 28, 12, 2, O);
    const g = f === 0 ? '#8ef0ff' : '#d4fbff';
    x.globalAlpha = 0.9;
    px(x, 8, 6 + f, 4, 7, g);
    x.globalAlpha = 0.4;
    px(x, 7, 5 + f, 6, 9, g);
    x.globalAlpha = 1;
    px(x, 9, 14, 2, 10, '#7a8aac');
    frames.push(c);
  }
  return frames;
}

function buildFragment(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 3; f++) {
    const { c, x } = mkCanvas(12, 12);
    const G = '#ffe9a0', G2 = '#f0c84a';
    if (f === 0) { px(x, 5, 1, 3, 10, G2); px(x, 5, 2, 3, 8, G); }
    if (f === 1) { px(x, 3, 2, 6, 8, G2); px(x, 4, 3, 4, 6, G); }
    if (f === 2) { px(x, 2, 3, 8, 6, G2); px(x, 3, 4, 6, 4, G); }
    px(x, 5, 4, 2, 2, '#fffbe0');
    frames.push(c);
  }
  return frames;
}

function buildWisp(): Frames {
  const frames: Frames = [];
  for (let f = 0; f < 2; f++) {
    const { c, x } = mkCanvas(10, 10);
    x.globalAlpha = 0.9; px(x, 3, 3 + f, 4, 4, '#bff4e8');
    x.globalAlpha = 0.5; px(x, 2, 2 + f, 6, 6, '#7fe0cc');
    x.globalAlpha = 1; px(x, 4, 4 + f, 2, 2, '#ffffff');
    frames.push(c);
  }
  return frames;
}

function buildPickups(): void {
  {
    const { c, x } = mkCanvas(8, 10);
    px(x, 2, 0, 4, 2, '#8a5a2b'); px(x, 1, 2, 6, 7, '#e05078');
    px(x, 2, 3, 2, 3, '#ff9ab0'); px(x, 1, 9, 6, 1, '#8a2a48');
    SPR['potion'] = [c];
  }
  {
    const { c, x } = mkCanvas(10, 8);
    px(x, 1, 2, 8, 5, '#e8b23a'); px(x, 1, 2, 8, 1, '#f8d878');
    px(x, 0, 3, 1, 3, '#b8842a'); px(x, 9, 3, 1, 3, '#b8842a');
    px(x, 3, 4, 2, 1, '#b8842a'); px(x, 6, 4, 1, 1, '#b8842a');
    SPR['goldbag'] = [c];
  }
  {
    const { c, x } = mkCanvas(10, 10);
    px(x, 2, 1, 6, 8, '#cfd6e2'); px(x, 3, 0, 4, 1, '#9aa4b4');
    px(x, 3, 3, 4, 1, '#7a8494'); px(x, 3, 6, 4, 1, '#7a8494');
    SPR['keyEcho'] = [c];
  }
}

// ---------------- Registro ----------------

const PALS: Record<string, HumanPal> = {
  hero_alba: {
    outline: '#2a1a20', hair: '#c8384a', hairS: '#9a2438', skin: '#f2c99c',
    body: '#cdd3de', bodyS: '#9aa3b4', accent: '#c8384a',
    legs: '#5a6070', legsS: '#474c5a', boots: '#6d4520', eye: '#2a2a3a', hood: true,
  },
  hero_tejedor: {
    outline: '#241a30', hair: '#8a5ac0', hairS: '#6a3f9a', skin: '#f2c99c',
    body: '#7e58b8', bodyS: '#5e3f92', accent: '#f0c84a',
    legs: '#4a3a6a', legsS: '#3c2f58', boots: '#3a2c50', eye: '#3ae0c8', hood: true,
  },
  brisa: {
    outline: '#2a2a30', hair: '#d8dade', hairS: '#b0b4bc', skin: '#eabf9a',
    body: '#7a9a6e', bodyS: '#5e7a54', accent: '#e8d8a8',
    legs: '#6a6a62', boots: '#4a3a2a', eye: '#3a3a3a', beard: undefined,
  },
  toln: {
    outline: '#241a14', hair: '#6a4a2e', hairS: '#54381e', skin: '#e0a87a',
    body: '#8a5a33', bodyS: '#6d4520', accent: '#3a3a3e',
    legs: '#4a4440', boots: '#3a2c20', eye: '#2a2a2a', beard: '#6a4a2e',
  },
  ilwen: {
    outline: '#1c2a1e', hair: '#8ad058', hairS: '#64a83e', skin: '#f2d0a8',
    body: '#3e7d4c', bodyS: '#2e5f3a', accent: '#e8c860',
    legs: '#4a5a3a', boots: '#54381e', eye: '#2a4a2e',
  },
  esqueleto: {
    outline: '#20201e', hair: '#e6e0c8', hairS: '#c2bc9e', skin: '#e6e0c8',
    body: '#d8d2b4', bodyS: '#a8a284', accent: '#7a7460',
    legs: '#c8c2a4', legsS: '#a8a284', boots: '#8a8468', eye: '#e04838', ribs: true,
  },
  sombra: {
    outline: '#100c1c', hair: '#2c2440', hairS: '#201a30', skin: '#2c2440',
    body: '#241c38', bodyS: '#181226', accent: '#9f7ae0',
    legs: '#181226', boots: '#100c1c', eye: '#b48fff', hood: true,
  },
};

export function initSprites(): void {
  for (const [name, pal] of Object.entries(PALS)) SPR[name] = buildHumanoid(pal);
  SPR['lobo'] = buildWolf();
  SPR['guardian'] = buildGuardian();
  const chest = buildChest();
  SPR['chest'] = chest.closed;
  SPR['chest_open'] = chest.open;
  SPR['sanctuary'] = buildSanctuary();
  SPR['fragment'] = buildFragment();
  SPR['wisp'] = buildWisp();
  buildPickups();
}

export function getSpr(name: string): Frames {
  return SPR[name] ?? SPR['hero_alba'];
}

// ---------------- Tiles (16×16) ----------------

export const TILE = 16;

export function drawTile(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number,
  mapId: string, t: number,
): void {
  const px0 = tx * TILE, py0 = ty * TILE;
  const r = hash2(tx, ty);
  const r2 = hash2(tx * 7 + 3, ty * 11 + 5);
  switch (ch) {
    case '.': case ',': { // hierba
      const g = mapId === 'bosque' ? ['#3f6d3a', '#396334'] : ['#4f8a46', '#467c3e'];
      px(x, px0, py0, TILE, TILE, r < 0.5 ? g[0] : g[1]);
      for (let i = 0; i < 4; i++) {
        const hx = hash2(tx * 4 + i, ty * 9 + i);
        if (hx < 0.35) {
          x.fillStyle = '#5a9a50';
          x.fillRect(px0 + Math.floor(hx * 14), py0 + Math.floor(hash2(tx + i, ty * 3 + i) * 14), 1, 2);
        }
      }
      if (ch === ',') {
        const cols = ['#f0d060', '#e878a0', '#f0f0f0', '#e88a4a'];
        const col = cols[Math.floor(r2 * cols.length)];
        x.fillStyle = col;
        x.fillRect(px0 + 4 + Math.floor(r * 7), py0 + 4 + Math.floor(r2 * 7), 2, 2);
        x.fillStyle = '#fff';
        x.fillRect(px0 + 4 + Math.floor(r * 7), py0 + 4 + Math.floor(r2 * 7), 1, 1);
      }
      break;
    }
    case '=': { // camino
      px(x, px0, py0, TILE, TILE, '#b89a6a');
      px(x, px0, py0, TILE, 1, '#c4a878');
      for (let i = 0; i < 5; i++) {
        const hx = hash2(tx * 13 + i, ty * 5 + i * 3);
        if (hx < 0.4) {
          x.fillStyle = '#a08454';
          x.fillRect(px0 + Math.floor(hx * 13), py0 + Math.floor(hash2(tx + i * 7, ty + i) * 13), 2, 1);
        }
      }
      break;
    }
    case '~': { // agua
      const w = Math.sin((t * 2 + tx * 0.9 + ty * 1.3)) * 0.5 + 0.5;
      px(x, px0, py0, TILE, TILE, '#3a6a9a');
      px(x, px0, py0, TILE, TILE, w > 0.5 ? '#3f72a4' : '#3a6a9a');
      x.fillStyle = '#6aa0cc';
      if (r > 0.5) x.fillRect(px0 + 2, py0 + 4 + Math.floor(w * 3), 6, 1);
      if (r2 > 0.5) x.fillRect(px0 + 8, py0 + 10 + Math.floor(w * 2), 5, 1);
      break;
    }
    case 'B': case 'x': { // puente / roto
      px(x, px0, py0, TILE, TILE, '#3a6a9a');
      if (ch === 'B') {
        px(x, px0, py0 + 2, TILE, 12, '#9a7040');
        for (let i = 0; i < 4; i++) px(x, px0, py0 + 2 + i * 3, TILE, 1, '#7a5530');
        px(x, px0, py0 + 2, TILE, 1, '#b89058');
      } else {
        px(x, px0 + 1, py0 + 3, 5, 3, '#8a6438');
        px(x, px0 + 9, py0 + 9, 6, 3, '#8a6438');
      }
      break;
    }
    case ':': case '_': { // suelo piedra / madera
      if (ch === ':') {
        px(x, px0, py0, TILE, TILE, '#6a6a7a');
        px(x, px0, py0, TILE, 1, '#7a7a8a');
        if (r > 0.7) { x.fillStyle = '#5a5a6a'; x.fillRect(px0 + 3, py0 + 9, 7, 1); }
        x.fillStyle = '#585868';
        x.fillRect(px0, py0, TILE, 1); x.fillRect(px0, py0, 1, TILE);
      } else {
        px(x, px0, py0, TILE, TILE, '#8a6a44');
        px(x, px0, py0 + 7, TILE, 1, '#6a4e30');
        px(x, px0, py0, 1, TILE, '#6a4e30');
        px(x, px0 + (r > 0.5 ? 4 : 10), py0 + 2, 1, 5, '#7a5c3a');
      }
      break;
    }
    case '#': { // muro piedra
      px(x, px0, py0, TILE, TILE, '#5a5a6e');
      x.fillStyle = '#4a4a5c';
      for (let row = 0; row < 4; row++) {
        x.fillRect(px0, py0 + row * 4 + 3, TILE, 1);
        const off = row % 2 === 0 ? 0 : 8;
        x.fillRect(px0 + ((off + 3) % 16), py0 + row * 4, 1, 3);
        x.fillRect(px0 + ((off + 11) % 16), py0 + row * 4, 1, 3);
      }
      x.fillStyle = '#6e6e84';
      x.fillRect(px0, py0, TILE, 1);
      if (r > 0.75) { x.fillStyle = '#3e3e50'; x.fillRect(px0 + 5, py0 + 6, 3, 2); }
      break;
    }
    case 'H': { // pared casa
      px(x, px0, py0, TILE, TILE, '#e2d0ac');
      x.fillStyle = '#7a5c38';
      x.fillRect(px0, py0, TILE, 2);
      x.fillRect(px0, py0, 2, TILE);
      x.fillRect(px0 + 14, py0, 2, TILE);
      x.fillStyle = '#d0bc94';
      x.fillRect(px0 + 4, py0 + 6, 8, 6);
      break;
    }
    case 'r': { // tejado
      px(x, px0, py0, TILE, TILE, '#a8503a');
      for (let row = 0; row < 4; row++) {
        x.fillStyle = row % 2 === 0 ? '#94422e' : '#a8503a';
        x.fillRect(px0, py0 + row * 4, TILE, 4);
        x.fillStyle = '#7e3626';
        x.fillRect(px0, py0 + row * 4 + 3, TILE, 1);
      }
      x.fillStyle = '#c86850';
      x.fillRect(px0, py0, TILE, 1);
      break;
    }
    case 'd': { // puerta
      px(x, px0, py0, TILE, TILE, '#e2d0ac');
      px(x, px0 + 3, py0 + 2, 10, 14, '#5c3a1e');
      px(x, px0 + 4, py0 + 3, 8, 13, '#7a5230');
      px(x, px0 + 10, py0 + 9, 1, 2, '#f0c84a');
      break;
    }
    case 'F': { // valla
      px(x, px0, py0 + 4, TILE, 2, '#8a6a3e');
      px(x, px0, py0 + 10, TILE, 2, '#8a6a3e');
      px(x, px0 + 2, py0 + 2, 3, 13, '#9a7848');
      px(x, px0 + 11, py0 + 2, 3, 13, '#9a7848');
      px(x, px0 + 2, py0 + 2, 3, 1, '#b89868');
      break;
    }
    case 'c': { // cultivo
      px(x, px0, py0, TILE, TILE, '#6a4e30');
      for (let row = 0; row < 3; row++) {
        x.fillStyle = '#4f8a46';
        x.fillRect(px0 + 2, py0 + 3 + row * 5, 12, 2);
        x.fillStyle = '#5a9a50';
        x.fillRect(px0 + 2, py0 + 3 + row * 5, 12, 1);
      }
      break;
    }
    case 'w': { // pozo
      px(x, px0, py0, TILE, TILE, '#4f8a46');
      px(x, px0 + 2, py0 + 4, 12, 10, '#6a6a7a');
      px(x, px0 + 3, py0 + 5, 10, 8, '#2a3444');
      px(x, px0 + 2, py0 + 4, 12, 2, '#7a7a8a');
      px(x, px0 + 3, py0 - 4, 10, 2, '#8a6a3e');
      break;
    }
    case 'R': { // roca
      px(x, px0, py0, TILE, TILE, r < 0.5 ? '#4f8a46' : '#396334');
      px(x, px0 + 3, py0 + 6, 10, 8, '#7a7a88');
      px(x, px0 + 5, py0 + 4, 7, 4, '#8a8a98');
      px(x, px0 + 4, py0 + 13, 9, 2, '#5a5a6a');
      px(x, px0 + 6, py0 + 5, 3, 2, '#a0a0b0');
      break;
    }
    case 'g': { // lápida
      px(x, px0, py0, TILE, TILE, '#396334');
      px(x, px0 + 4, py0 + 5, 8, 9, '#8a8a98');
      px(x, px0 + 5, py0 + 3, 6, 4, '#9a9aa8');
      px(x, px0 + 6, py0 + 7, 4, 1, '#6a6a7a');
      px(x, px0 + 4, py0 + 14, 8, 1, '#5a5a6a');
      break;
    }
    case 'P': { // pilar
      px(x, px0, py0, TILE, TILE, ch === 'P' ? '#6a6a7a' : '#6a6a7a');
      px(x, px0 + 2, py0 - 6, 12, 22, '#8a8a9a');
      px(x, px0 + 2, py0 - 6, 3, 22, '#a4a4b4');
      px(x, px0 + 1, py0 - 8, 14, 3, '#9a9aaa');
      px(x, px0 + 1, py0 + 14, 14, 2, '#5a5a6a');
      break;
    }
    case 'A': { // altar
      px(x, px0, py0, TILE, TILE, '#585868');
      px(x, px0 + 2, py0 + 4, 12, 9, '#7a7a8a');
      px(x, px0 + 3, py0 + 2, 10, 3, '#8a8a9a');
      px(x, px0 + 4, py0 + 6, 8, 1, '#f0c84a');
      px(x, px0 + 5, py0 + 8, 6, 1, '#f0c84a');
      break;
    }
    case 'V': { // vacío
      px(x, px0, py0, TILE, TILE, '#0c0a14');
      if (r > 0.8) { x.fillStyle = '#1c1828'; x.fillRect(px0 + 3, py0 + 5, 4, 2); }
      break;
    }
    case 'm': { // niebla muda (suelo)
      px(x, px0, py0, TILE, TILE, '#4a5a52');
      x.globalAlpha = 0.3;
      px(x, px0, py0 + 4 + Math.floor(Math.sin(t + tx) * 2), TILE, 8, '#9ec4b4');
      x.globalAlpha = 1;
      break;
    }
    case 'n': { // niebla densa (bloquea)
      px(x, px0, py0, TILE, TILE, '#3c4a48');
      x.globalAlpha = 0.55;
      px(x, px0, py0 + 3, TILE, 10, '#7ea49a');
      x.globalAlpha = 1;
      px(x, px0, py0 + 2, TILE, 2, '#2c3a38');
      break;
    }
    default: {
      px(x, px0, py0, TILE, TILE, '#4f8a46');
      break;
    }
  }
}

// Objetos altos (dibujados por encima del suelo, con orden por fila)
export function isTallTile(ch: string): boolean {
  return ch === 't' || ch === 'p';
}

export function drawTallTile(
  x: CanvasRenderingContext2D, ch: string, tx: number, ty: number, mapId: string,
): void {
  const px0 = tx * TILE, py0 = ty * TILE;
  const r = hash2(tx * 3 + 1, ty * 5 + 7);
  if (ch === 't') { // árbol coposo
    x.fillStyle = '#5c4028';
    x.fillRect(px0 + 6, py0 + 8, 4, 8);
    x.fillStyle = '#4a3420';
    x.fillRect(px0 + 6, py0 + 14, 4, 2);
    const c1 = mapId === 'bosque' ? '#2e5d34' : '#3a703c';
    const c2 = mapId === 'bosque' ? '#3e7244' : '#4a8a4c';
    x.fillStyle = c1;
    x.fillRect(px0 + 1, py0 - 6, 14, 14);
    x.fillRect(px0 + 3, py0 - 10, 10, 6);
    x.fillStyle = c2;
    x.fillRect(px0 + 2, py0 - 8, 8, 6);
    x.fillRect(px0 + 4, py0 - 11, 5, 4);
    if (r > 0.6) {
      x.fillStyle = r > 0.8 ? '#e05858' : '#e8c860';
      x.fillRect(px0 + 3 + Math.floor(r * 6), py0 - 4, 2, 2);
    }
  } else if (ch === 'p') { // pino
    x.fillStyle = '#54381e';
    x.fillRect(px0 + 6, py0 + 10, 4, 6);
    x.fillStyle = '#1e4a2c';
    x.fillRect(px0 + 3, py0 - 2, 10, 8);
    x.fillRect(px0 + 5, py0 - 8, 6, 7);
    x.fillRect(px0 + 6, py0 - 12, 4, 5);
    x.fillStyle = '#2e6238';
    x.fillRect(px0 + 4, py0 - 4, 6, 4);
    x.fillRect(px0 + 6, py0 - 10, 3, 3);
    x.fillStyle = '#e8f0f4';
    if (r > 0.7) x.fillRect(px0 + 5, py0 - 9, 2, 1);
  }
}

// Árbol cortado en el pasado (diffs usan '.')
export const SOLID_CHARS = new Set(['t', 'p', '#', 'H', 'r', 'F', 'R', 'w', 'g', 'P', 'A', 'V', '~', 'd', 'x', 'n']);
