var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// src/game/maps_expansion.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function grid(w, h, fill) {
  const g = [];
  for (let y = 0;y < h; y++) {
    const row = [];
    for (let x = 0;x < w; x++)
      row.push(fill);
    g.push(row);
  }
  return g;
}
function set(g, x, y, ch) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length)
    g[y][x] = ch;
}
function rect(g, x, y, w, h, ch) {
  for (let j = y;j < y + h; j++)
    for (let i = x;i < x + w; i++)
      set(g, i, j, ch);
}
function rectOutline(g, x, y, w, h, ch) {
  for (let i = x;i < x + w; i++) {
    set(g, i, y, ch);
    set(g, i, y + h - 1, ch);
  }
  for (let j = y;j < y + h; j++) {
    set(g, x, j, ch);
    set(g, x + w - 1, j, ch);
  }
}
function pathH(g, x0, x1, y, ch = "=") {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (let x = a;x <= b; x++)
    set(g, x, y, ch);
}
function pathV(g, y0, y1, x, ch = "=") {
  const a = Math.min(y0, y1), b = Math.max(y0, y1);
  for (let y = a;y <= b; y++)
    set(g, x, y, ch);
}
function house(g, x, y, w, doorX) {
  rect(g, x, y, w, 1, "r");
  rect(g, x, y + 1, w, 1, "H");
  set(g, doorX, y + 1, "d");
}
function scatter(g, x0, y0, x1, y1, ch, density, seed, skip) {
  const rng = mulberry32(seed);
  for (let y = y0;y <= y1; y++) {
    for (let x = x0;x <= x1; x++) {
      if (skip(x, y))
        continue;
      if (rng() < density)
        set(g, x, y, ch);
    }
  }
}
function borderForest(g, thickness, base) {
  const w = g[0].length, h = g.length;
  for (let y = 0;y < h; y++) {
    for (let x = 0;x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edge < thickness)
        set(g, x, y, base);
    }
  }
}
function toRows(g) {
  return g.map((r) => r.join(""));
}
function buildCosta() {
  const W = 52, H = 40;
  const g = grid(W, H, ".");
  borderForest(g, 2, "R");
  rect(g, 0, 0, W, 2, "#");
  rect(g, 25, 0, 3, 2, "=");
  pathV(g, 2, 8, 25);
  pathV(g, 2, 8, 26);
  for (let x = 2;x <= 49; x++) {
    const wave = 35 + (x * 7 + 3) % 3;
    for (let y = wave;y < H; y++)
      set(g, x, y, "~");
    set(g, x, wave - 1, "s");
  }
  for (let y = 2;y <= 37; y++) {
    const seaX = 43 + (y * 5 + 1) % 3;
    for (let x = seaX;x < W; x++)
      set(g, x, y, "~");
    if (g[y][seaX - 1] !== "~")
      set(g, seaX - 1, y, "s");
  }
  rect(g, 6, 29, 34, 5, "s");
  pathH(g, 10, 34, 9);
  pathV(g, 10, 20, 21);
  pathV(g, 10, 24, 34);
  pathH(g, 33, 41, 25);
  pathV(g, 9, 17, 7);
  rect(g, 43, 17, 9, 4, "=");
  for (let y = 34;y <= 38; y++) {
    set(g, 27, y, "x");
    set(g, 30, y, "x");
  }
  rect(g, 28, 34, 2, 2, "B");
  set(g, 4, 16, "R");
  set(g, 4, 17, "R");
  set(g, 4, 18, "R");
  set(g, 4, 19, "R");
  set(g, 5, 17, "R");
  set(g, 5, 19, "R");
  set(g, 5, 1, "R");
  set(g, 13, 1, "R");
  set(g, 31, 1, "R");
  set(g, 40, 1, "R");
  set(g, 47, 1, "R");
  set(g, 10, 2, "R");
  set(g, 40, 2, "R");
  set(g, 17, 4, "R");
  scatter(g, 3, 3, 18, 12, "p", 0.05, 411, (x, y) => g[y][x] !== ".");
  scatter(g, 3, 10, 42, 28, ",", 0.05, 412, (x, y) => g[y][x] !== ".");
  const clearKey = [
    [7, 19, "."],
    [30, 32, "s"],
    [4, 15, "."],
    [42, 29, "."],
    [24, 30, "s"],
    [37, 19, "."],
    [11, 25, "."],
    [23, 3, "."],
    [25, 31, "s"],
    [22, 21, "."],
    [36, 27, "."],
    [41, 22, "."],
    [39, 24, "."],
    [12, 32, "s"],
    [20, 34, "."],
    [33, 32, "s"],
    [38, 30, "s"],
    [14, 22, "."],
    [24, 26, "."]
  ];
  for (const [x, y, ch] of clearKey) {
    const c = g[y][x];
    if (c === "p" || c === "R" || c === "H" || c === "r" || c === "#")
      set(g, x, y, ch);
  }
  return toRows(g);
}
var costaDiffs = [
  { x: 28, y: 36, char: "B" },
  { x: 29, y: 36, char: "B" },
  { x: 28, y: 37, char: "B" },
  { x: 29, y: 37, char: "B" },
  { x: 28, y: 38, char: "B" },
  { x: 29, y: 38, char: "B" }
];
function buildAldea() {
  const W = 44, H = 34;
  const g = grid(W, H, ":");
  borderForest(g, 2, "H");
  rect(g, 0, 16, 5, 4, "=");
  pathH(g, 4, 17, 18);
  rect(g, 17, 12, 10, 8, ":");
  set(g, 21, 15, "w");
  house(g, 6, 6, 6, 9);
  set(g, 9, 7, ":");
  set(g, 7, 7, ":");
  set(g, 10, 7, ":");
  set(g, 8, 6, ":");
  house(g, 30, 6, 6, 33);
  set(g, 33, 7, ":");
  set(g, 31, 7, ":");
  set(g, 34, 7, ":");
  set(g, 32, 6, ":");
  house(g, 6, 24, 6, 9);
  set(g, 9, 25, ":");
  set(g, 7, 25, ":");
  set(g, 10, 25, ":");
  set(g, 8, 24, ":");
  house(g, 30, 24, 6, 33);
  set(g, 33, 25, ":");
  set(g, 31, 25, ":");
  set(g, 34, 25, ":");
  set(g, 32, 24, ":");
  pathV(g, 19, 26, 21);
  for (let y = 0;y < H; y++)
    for (let x = 0;x < W; x++) {
      const dx = (x - 40) / 3.4, dy = (y - 27) / 2.6;
      if (dx * dx + dy * dy < 1)
        set(g, x, y, "~");
    }
  pathH(g, 21, 38, 26);
  set(g, 37, 28, "x");
  set(g, 40, 29, "x");
  rect(g, 38, 26, 2, 2, "B");
  rect(g, 38, 28, 2, 2, "~");
  scatter(g, 3, 3, 40, 30, ".", 0.05, 511, (x, y) => {
    if (g[y][x] !== ":")
      return true;
    if (x >= 16 && x <= 27 && y >= 11 && y <= 20)
      return true;
    return false;
  });
  scatter(g, 3, 3, 40, 30, "r", 0.045, 512, (x, y) => g[y][x] !== ":");
  const clearKey = [
    [22, 16],
    [10, 23],
    [32, 9],
    [23, 14],
    [6, 19],
    [5, 16],
    [26, 20],
    [13, 13],
    [28, 14],
    [20, 22],
    [17, 21],
    [9, 12],
    [33, 12],
    [14, 22],
    [30, 21],
    [16, 8],
    [27, 29]
  ];
  for (const [x, y] of clearKey) {
    const c = g[y][x];
    if (c === "r" || c === "H")
      set(g, x, y, ":");
  }
  return toRows(g);
}
var aldeaDiffs = [
  { x: 9, y: 7, char: "d" },
  { x: 7, y: 7, char: "H" },
  { x: 10, y: 7, char: "H" },
  { x: 8, y: 6, char: "r" },
  { x: 33, y: 7, char: "d" },
  { x: 31, y: 7, char: "H" },
  { x: 34, y: 7, char: "H" },
  { x: 32, y: 6, char: "r" },
  { x: 9, y: 25, char: "d" },
  { x: 7, y: 25, char: "H" },
  { x: 10, y: 25, char: "H" },
  { x: 8, y: 24, char: "r" },
  { x: 33, y: 25, char: "d" },
  { x: 31, y: 25, char: "H" },
  { x: 34, y: 25, char: "H" },
  { x: 32, y: 24, char: "r" },
  { x: 19, y: 13, char: "," },
  { x: 24, y: 14, char: "," },
  { x: 18, y: 17, char: "," },
  { x: 25, y: 18, char: "," },
  { x: 20, y: 18, char: "," },
  { x: 38, y: 28, char: "B" },
  { x: 39, y: 28, char: "B" },
  { x: 38, y: 29, char: "B" },
  { x: 39, y: 29, char: "B" }
];
function buildCumbres() {
  const W = 50, H = 42;
  const g = grid(W, H, "S");
  borderForest(g, 2, "p");
  rect(g, 2, 2, 46, 4, "R");
  rect(g, 21, 2, 8, 5, "=");
  rect(g, 24, 40, 3, 2, "=");
  pathV(g, 34, 40, 24);
  pathV(g, 34, 40, 25);
  pathH(g, 12, 25, 34);
  pathV(g, 20, 34, 12);
  pathH(g, 12, 24, 20);
  pathV(g, 8, 20, 23);
  pathV(g, 8, 20, 24);
  pathH(g, 26, 40, 20);
  pathV(g, 20, 30, 40);
  pathH(g, 34, 40, 30);
  for (let y = 0;y < H; y++)
    for (let x = 0;x < W; x++) {
      const dx = (x - 30) / 6, dy = (y - 30) / 4;
      if (dx * dx + dy * dy < 1)
        set(g, x, y, "i");
    }
  rectOutline(g, 8, 33, 3, 3, "R");
  scatter(g, 2, 2, 47, 39, "p", 0.08, 611, (x, y) => g[y][x] !== "S");
  scatter(g, 2, 2, 47, 39, "R", 0.025, 612, (x, y) => g[y][x] !== "S");
  const clearKey = [
    [27, 37],
    [26, 37],
    [27, 38],
    [5, 7],
    [6, 7],
    [43, 30],
    [42, 30],
    [43, 29],
    [27, 4],
    [11, 19],
    [23, 30],
    [22, 30],
    [36, 12],
    [27, 39],
    [7, 34],
    [6, 34],
    [14, 24],
    [13, 24],
    [14, 23],
    [14, 25],
    [15, 15],
    [33, 12],
    [38, 20],
    [12, 30],
    [18, 36],
    [35, 34],
    [24, 8],
    [25, 8],
    [9, 34]
  ];
  for (const [x, y] of clearKey) {
    const c = g[y][x];
    if (c === "p" || c === "R")
      set(g, x, y, "S");
  }
  return toRows(g);
}
var cumbresDiffs = [
  { x: 22, y: 7, char: "=" },
  { x: 23, y: 7, char: "=" },
  { x: 24, y: 7, char: "=" },
  { x: 25, y: 7, char: "=" },
  { x: 26, y: 7, char: "=" },
  { x: 12, y: 33, char: "," },
  { x: 13, y: 35, char: "," },
  { x: 7, y: 32, char: "," },
  { x: 11, y: 36, char: "," }
];
function buildArena() {
  const W = 44, H = 34;
  const g = grid(W, H, ":");
  borderForest(g, 2, "#");
  rectOutline(g, 3, 3, W - 6, H - 6, "=");
  rect(g, 9, 7, 2, 2, "P");
  rect(g, 32, 7, 2, 2, "P");
  rect(g, 9, 23, 2, 2, "P");
  rect(g, 32, 23, 2, 2, "P");
  set(g, 14, 15, "R");
  set(g, 29, 15, "R");
  set(g, 21, 11, "R");
  set(g, 22, 21, "R");
  rect(g, 20, 29, 4, 5, ":");
  return toRows(g);
}
var ARENA_MAP_ID = "arena";
var EXPANSION_MAPS = {
  costa: {
    id: "costa",
    name: "Costa de Bruma",
    subtitle: "Donde el mar guarda las notas · Zona 10–16",
    w: 52,
    h: 40,
    rows: buildCosta(),
    epochDiffs: costaDiffs,
    music: "costa",
    npcs: [
      { id: "mara", x: 7, y: 19, sprite: "mara_farera", name: "Mara, la farera" },
      { id: "uso_faro", x: 5, y: 21, sprite: "uso_faro", name: "Uso, el farero tuerto" },
      { id: "tina_faro", x: 9, y: 20, sprite: "tina_faro", name: "Tina, la niña del faro" },
      { id: "vult", x: 30, y: 32, sprite: "corvin", name: "Vult, cartógrafo de la Liga" }
    ],
    chests: [
      { id: "co1", x: 29, y: 37, gold: 60, potions: 1, needPast: true },
      { id: "co2", x: 4, y: 15, gold: 35 },
      { id: "co3", x: 42, y: 29, gold: 40, potions: 1 }
    ],
    echoes: [
      { id: "co_e1", x: 24, y: 30, title: "Eco menor · El farero que no se dormía", text: "«La abuela de Mara subía cada noche a encender la lámpara cantando, una nota por vuelta de engranaje. Cuando el canto del dios murió, la lámpara siguió girando... pero la luz aprendió a temblar. Los barcos ya no buscan fuego en la costa: buscan permiso para volver.»" },
      { id: "co_e2", x: 37, y: 19, title: "Eco menor · Los barcos sin canción", text: "«Antes, las tripulaciones cantaban al doblar el cabo y el mar respondía liso como zinc. Ahora cruzan en silencio y la Niebla Muda las apunta una a una en su lista de nombres. El mar guarda las notas que faltan: por algo todavía susurra.»" },
      { id: "co_e3", x: 11, y: 25, title: "Eco menor · La marea que borra nombres", text: "«El mar fue el primer archivo de Aelthar: cada ola leía un nombre en voz baja para que el dios-tejedor lo bordara en su canto. La noche del asesinato, la marea subió más que nunca y, desde entonces, borra en vez de leer. La que duerme en el naufragio sabe dónde fueron a parar los nombres.»" }
    ],
    spawns: [
      { type: "neumo", x: 12, y: 32, patrol: 3, zone: "costa" },
      { type: "neumo", x: 20, y: 34, patrol: 3, zone: "costa" },
      { type: "neumo", x: 33, y: 32, patrol: 3, zone: "costa" },
      { type: "neumo", x: 38, y: 30, patrol: 3, zone: "costa" },
      { type: "espectro", x: 14, y: 22, zone: "costa" },
      { type: "espectro", x: 24, y: 26, zone: "costa" },
      { type: "sirena", x: 39, y: 24, zone: "boss" }
    ],
    exits: [
      { x: 25, y: 0, w: 3, h: 2, to: "lunaris", tx: 26, ty: 35, label: "Valle de Lunaris" },
      { x: 50, y: 17, w: 2, h: 4, to: "aldea", tx: 3, ty: 18, label: "Aldea de Merrow" }
    ],
    props: [
      { id: "sanc_co", kind: "sanctuary", x: 22, y: 21 },
      { id: "faro_co", kind: "faro", x: 6, y: 18 },
      { id: "wreck_co", kind: "wreck", x: 41, y: 22 },
      { id: "altar_mareas", kind: "altarEcho", x: 36, y: 27 },
      { id: "sign_co1", kind: "sign", x: 23, y: 3, label: "«Costa de Bruma. Al sur y al este, el mar. Todavía susurra con voz prestada: no le respondas con tu nombre.»" },
      { id: "sign_co2", kind: "sign", x: 25, y: 31, label: "«Muelle viejo de Merrow. En pie solo cuando el ayer lo sostiene.»" },
      { id: "sign_co3", kind: "sign", x: 8, y: 17, label: "«Faro de la Punta de la Cerilla. Tres generaciones de fareros: una cantaba, otra escuchaba, y el que queda cuenta barcos. La lámpara no tiembla de frío: tiembla de ganas. No la mires. Escúchala.»" }
    ]
  },
  aldea: {
    id: "aldea",
    name: "Aldea de Merrow",
    subtitle: "La que la Niebla borró · Zona 12–16",
    w: 44,
    h: 34,
    rows: buildAldea(),
    epochDiffs: aldeaDiffs,
    music: "aldea",
    npcs: [
      { id: "mera", x: 22, y: 16, sprite: "nimue", name: "Espectro de Merrow" }
    ],
    chests: [
      { id: "a1", x: 10, y: 23, gold: 60, potions: 2, needPast: true },
      { id: "a2", x: 32, y: 9, gold: 30 }
    ],
    echoes: [
      { id: "al_e1", x: 23, y: 14, title: "Eco menor · El nombre que nadie dice", text: "«Merrow no es su nombre. Es el que quedó cuando la Niebla borró el verdadero, como quien roba un pañuelo y deja la mano fría. Los espectros caminan la plaza esperando que alguien les diga cómo se llamaban. Tú también has olvidado cosas, Portador. La Niebla trabaja despacio.»" },
      { id: "al_e2", x: 6, y: 19, title: "Eco menor · Los faroles del Recuerdo", text: "«Los faroles de Merrow no se encendían con fuego: se encendían con nombres dichos en voz alta, uno por farol, uno por familia. Tres siguen esperando en el ayer. Enciéndelos allí y acaso el presente aprenda otra vez a iluminarse.»" }
    ],
    spawns: [
      { type: "espectro", x: 9, y: 12, zone: "aldea", needPresent: true },
      { type: "espectro", x: 33, y: 12, zone: "aldea", needPresent: true },
      { type: "espectro", x: 14, y: 22, zone: "aldea", needPresent: true },
      { type: "espectro", x: 30, y: 21, zone: "aldea", needPresent: true },
      { type: "neumo", x: 16, y: 8, zone: "aldea" },
      { type: "neumo", x: 27, y: 29, zone: "aldea" }
    ],
    exits: [
      { x: 0, y: 16, w: 2, h: 4, to: "costa", tx: 47, ty: 18, label: "Costa de Bruma" }
    ],
    props: [
      { id: "sanc_a", kind: "sanctuary", x: 17, y: 21 },
      { id: "lamp1", kind: "lamp", x: 13, y: 13, needPast: true },
      { id: "lamp2", kind: "lamp", x: 28, y: 14, needPast: true },
      { id: "lamp3", kind: "lamp", x: 20, y: 22, needPast: true },
      { id: "sign_al1", kind: "sign", x: 5, y: 16, label: "«Aldea de Merrow. Pregunta por cualquiera: la Niebla respondió por todos.»" },
      { id: "sign_al2", kind: "sign", x: 26, y: 20, label: "«Los Faroles del Recuerdo no se encienden con fuego. Se encienden con nombres, y solo en el ayer.»" }
    ]
  },
  cumbres: {
    id: "cumbres",
    name: "Cumbres Heladas",
    subtitle: "El frío que aprendió a escuchar · Zona 14–20",
    w: 50,
    h: 42,
    rows: buildCumbres(),
    epochDiffs: cumbresDiffs,
    music: "cumbres",
    npcs: [
      { id: "ivo", x: 27, y: 37, sprite: "brokk", name: "Ivo, cazador de cumbres" }
    ],
    chests: [
      { id: "cu1", x: 5, y: 7, gold: 50 },
      { id: "cu2", x: 43, y: 30, gold: 40, potions: 1 },
      { id: "cu3", x: 27, y: 4, gold: 60 }
    ],
    echoes: [
      { id: "cu_e1", x: 11, y: 19, title: "Eco menor · El invierno del silencio", text: "«Hubo un invierno en que la Niebla subió a las cumbres a buscar las últimas voces libres. Los pastores dejaron de cantar para esconderlas, y el frío las guardó mejor que ellos: bajo el hielo aún se oyen, si sabes escuchar de rodillas.»" },
      { id: "cu_e2", x: 23, y: 30, title: "Eco menor · Los turnos de canto", text: "«Los pastores de las Cumbres cantaban por turnos: uno dormía y otro velaba su voz, para que el silencio no encontrara a nadie solo. La última noche cantaron todos a la vez. Nadie recuerda quién quedó para el alba, y la montaña, que todo lo escucha, no lo quiere decir.»" },
      { id: "cu_e3", x: 36, y: 12, title: "Eco menor · Las voces bajo el hielo", text: "«El lago no congela agua: congela coros. Los que la Niebla atrapó durante la huida quedaron suspendidos boca arriba, mirando el cielo desde debajo. En los deshielos breves piden ayuda... en armonía. El Gólem los cuenta cada noche, como un pastor cuenta ovejas.»" }
    ],
    spawns: [
      { type: "arpi", x: 15, y: 15, patrol: 4, zone: "cumbres" },
      { type: "arpi", x: 33, y: 12, patrol: 4, zone: "cumbres" },
      { type: "arpi", x: 38, y: 20, patrol: 4, zone: "cumbres" },
      { type: "arpi", x: 30, y: 20, patrol: 4, zone: "cumbres" },
      { type: "lobo", x: 12, y: 30, zone: "cumbres" },
      { type: "lobo", x: 18, y: 36, zone: "cumbres" },
      { type: "espectro", x: 35, y: 34, zone: "cumbres" },
      { type: "espectro", x: 40, y: 26, zone: "cumbres" },
      { type: "golem", x: 24, y: 8, zone: "boss" }
    ],
    exits: [
      { x: 24, y: 40, w: 3, h: 2, to: "bosque", tx: 51, ty: 7, label: "Bosque Susurrante" }
    ],
    props: [
      { id: "sanc_cu", kind: "sanctuary", x: 14, y: 24 },
      { id: "altar_cumbres", kind: "altarEcho", x: 24, y: 3 },
      { id: "sign_cu1", kind: "sign", x: 27, y: 39, label: "«Paso de las Cumbres. Más arriba el aire corta los nombres por la mitad. Llévalos cerca del pecho.»" },
      { id: "sign_cu2", kind: "sign", x: 7, y: 34, label: "«Hoguera de los pastores. Cantaban por turnos para no velar su voz en soledad. Nadie canta ya la última estrofa.»" }
    ]
  },
  arena: {
    id: ARENA_MAP_ID,
    name: "Arena del Eco",
    subtitle: "Modo Desafío · sobrevive o cae",
    w: 44,
    h: 34,
    rows: buildArena(),
    epochDiffs: [],
    music: "boss",
    npcs: [],
    chests: [],
    echoes: [],
    spawns: [],
    exits: [
      { x: 20, y: 32, w: 4, h: 2, to: "lunaris", tx: 25, ty: 19, label: "Valle de Lunaris" }
    ],
    props: [
      { id: "sign_arena", kind: "sign", x: 18, y: 28, label: "«Arena del Eco. Los caídos no juzgan: cuentan. La puerta del sur devuelve al valle con lo que trajiste.»" }
    ]
  }
};

// src/game/maps.ts
function mulberry322(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function grid2(w, h, fill) {
  const g = [];
  for (let y = 0;y < h; y++) {
    const row = [];
    for (let x = 0;x < w; x++)
      row.push(fill);
    g.push(row);
  }
  return g;
}
function set2(g, x, y, ch) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length)
    g[y][x] = ch;
}
function rect2(g, x, y, w, h, ch) {
  for (let j = y;j < y + h; j++)
    for (let i = x;i < x + w; i++)
      set2(g, i, j, ch);
}
function rectOutline2(g, x, y, w, h, ch) {
  for (let i = x;i < x + w; i++) {
    set2(g, i, y, ch);
    set2(g, i, y + h - 1, ch);
  }
  for (let j = y;j < y + h; j++) {
    set2(g, x, j, ch);
    set2(g, x + w - 1, j, ch);
  }
}
function pathH2(g, x0, x1, y, ch = "=") {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  for (let x = a;x <= b; x++)
    set2(g, x, y, ch);
}
function pathV2(g, y0, y1, x, ch = "=") {
  const a = Math.min(y0, y1), b = Math.max(y0, y1);
  for (let y = a;y <= b; y++)
    set2(g, x, y, ch);
}
function house2(g, x, y, w, doorX) {
  rect2(g, x, y, w, 1, "r");
  rect2(g, x, y + 1, w, 1, "H");
  set2(g, doorX, y + 1, "d");
}
function scatter2(g, x0, y0, x1, y1, ch, density, seed, skip) {
  const rng = mulberry322(seed);
  for (let y = y0;y <= y1; y++) {
    for (let x = x0;x <= x1; x++) {
      if (skip(x, y))
        continue;
      if (rng() < density)
        set2(g, x, y, ch);
    }
  }
}
function borderForest2(g, thickness, base) {
  const w = g[0].length, h = g.length;
  for (let y = 0;y < h; y++) {
    for (let x = 0;x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edge < thickness)
        set2(g, x, y, base);
    }
  }
}
function toRows2(g) {
  return g.map((r) => r.join(""));
}
function buildLunaris() {
  const W = 52, H = 38;
  const g = grid2(W, H, ".");
  borderForest2(g, 2, "t");
  rect2(g, 23, 0, 6, 2, "=");
  pathV2(g, 2, 15, 25);
  pathV2(g, 2, 15, 26);
  rect2(g, 21, 15, 10, 7, ":");
  rect2(g, 22, 14, 8, 1, ":");
  house2(g, 7, 9, 5, 9);
  house2(g, 32, 9, 5, 34);
  house2(g, 7, 27, 5, 9);
  house2(g, 32, 27, 5, 34);
  pathV2(g, 10, 11, 9);
  pathH2(g, 9, 25, 11);
  pathV2(g, 10, 11, 34);
  pathH2(g, 26, 34, 11);
  pathV2(g, 28, 29, 9);
  pathH2(g, 9, 25, 29);
  pathV2(g, 28, 29, 34);
  pathH2(g, 26, 34, 29);
  pathV2(g, 12, 15, 9);
  pathV2(g, 12, 15, 34);
  rectOutline2(g, 14, 23, 8, 6, "F");
  rect2(g, 15, 24, 6, 4, "c");
  set2(g, 17, 23, "c");
  set2(g, 18, 23, "=");
  set2(g, 20, 16, "w");
  set2(g, 17, 20, "g");
  set2(g, 18, 20, "g");
  for (let y = 0;y < 38; y++)
    for (let x = 0;x < 52; x++) {
      const dx = (x - 42) / 4.4, dy = (y - 26) / 3.2;
      if (dx * dx + dy * dy < 1)
        set2(g, x, y, "~");
    }
  set2(g, 6, 31, "R");
  set2(g, 44, 12, "R");
  set2(g, 16, 6, "R");
  set2(g, 46, 33, "R");
  set2(g, 5, 26, "R");
  set2(g, 6, 26, "R");
  set2(g, 5, 25, "R");
  scatter2(g, 3, 3, 48, 34, ",", 0.055, 101, (x, y) => g[y][x] !== ".");
  scatter2(g, 3, 31, 22, 35, "m", 0.06, 77, (x, y) => g[y][x] !== ".");
  scatter2(g, 3, 3, 20, 7, "p", 0.1, 55, (x, y) => g[y][x] !== ".");
  rect2(g, 25, 36, 3, 2, "=");
  pathV2(g, 30, 35, 25);
  pathV2(g, 30, 35, 26);
  return toRows2(g);
}
function buildBosque() {
  const W = 56, H = 44;
  const g = grid2(W, H, ".");
  borderForest2(g, 2, "t");
  rect2(g, 24, 42, 6, 2, "=");
  rect2(g, 0, 10, 56, 3, "~");
  for (let x = 0;x < 56; x++) {
    if (g[9][x] === "t")
      continue;
    if ((x * 13 + 5) % 7 < 2)
      set2(g, x, 9, ",");
    if ((x * 7 + 3) % 8 < 2)
      set2(g, x, 13, ",");
  }
  rect2(g, 25, 10, 2, 3, "x");
  pathV2(g, 13, 14, 25);
  pathV2(g, 13, 14, 26);
  pathV2(g, 2, 9, 25);
  pathV2(g, 2, 9, 26);
  scatter2(g, 2, 2, 53, 41, "p", 0.17, 202, (x, y) => g[y][x] !== ".");
  pathV2(g, 36, 41, 27);
  pathH2(g, 27, 40, 36);
  pathV2(g, 30, 36, 40);
  pathH2(g, 40, 43, 30);
  pathV2(g, 29, 30, 43);
  rect2(g, 36, 20, 12, 9, ":");
  set2(g, 36, 20, "P");
  set2(g, 47, 20, "P");
  set2(g, 36, 28, "P");
  set2(g, 47, 28, "P");
  set2(g, 39, 23, "g");
  set2(g, 44, 26, "g");
  pathH2(g, 26, 40, 24);
  pathH2(g, 43, 25, 24);
  rect2(g, 23, 6, 6, 2, "n");
  rect2(g, 6, 1, 9, 1, "#");
  rect2(g, 6, 2, 1, 3, "#");
  rect2(g, 14, 2, 1, 3, "#");
  rect2(g, 7, 2, 7, 2, ":");
  rect2(g, 7, 4, 7, 1, "#");
  rect2(g, 9, 4, 3, 1, "=");
  set2(g, 10, 3, "A");
  set2(g, 12, 20, "R");
  set2(g, 30, 33, "R");
  set2(g, 50, 30, "R");
  scatter2(g, 2, 14, 53, 41, ",", 0.05, 303, (x, y) => g[y][x] !== ".");
  scatter2(g, 2, 14, 53, 41, "m", 0.035, 404, (x, y) => g[y][x] !== ".");
  pathH2(g, 27, 54, 8);
  rect2(g, 53, 6, 3, 3, "=");
  rect2(g, 50, 7, 3, 2, "=");
  for (let y = 5;y <= 9; y++) {
    for (let x = 6;x <= 15; x++) {
      if (g[y][x] === "p")
        set2(g, x, y, ".");
    }
  }
  for (let x = 16;x <= 22; x++) {
    if (g[7][x] === "p")
      set2(g, x, 7, ".");
  }
  for (let x = 16;x <= 26; x++) {
    if (g[8][x] === "p")
      set2(g, x, 8, ".");
  }
  return toRows2(g);
}
function buildCripta() {
  const W = 40, H = 34;
  const g = grid2(W, H, "V");
  rect2(g, 1, 1, 38, 32, "#");
  rect2(g, 15, 2, 10, 5, ":");
  rect2(g, 18, 7, 4, 22, ":");
  rect2(g, 10, 12, 20, 10, ":");
  rect2(g, 16, 22, 8, 4, ":");
  rect2(g, 6, 24, 8, 5, ":");
  rect2(g, 26, 24, 8, 5, ":");
  pathH2(g, 14, 18, 26);
  pathH2(g, 23, 26, 26);
  pathV2(g, 12, 14, 19);
  pathV2(g, 12, 14, 20);
  pathV2(g, 7, 12, 19);
  pathV2(g, 7, 12, 20);
  rect2(g, 18, 29, 4, 3, ":");
  set2(g, 12, 14, "P");
  set2(g, 27, 14, "P");
  set2(g, 12, 19, "P");
  set2(g, 27, 19, "P");
  return toRows2(g);
}
var lunarisDiffs = [
  { x: 17, y: 20, char: "," },
  { x: 18, y: 20, char: "," },
  { x: 5, y: 26, char: "." },
  { x: 6, y: 26, char: "." },
  { x: 5, y: 25, char: "." },
  { x: 24, y: 16, char: "," },
  { x: 27, y: 18, char: "," },
  { x: 23, y: 19, char: "," },
  { x: 28, y: 15, char: "," },
  { x: 22, y: 20, char: "," },
  { x: 29, y: 20, char: "," },
  { x: 24, y: 21, char: "," },
  { x: 27, y: 21, char: "," },
  { x: 25, y: 3, char: "=" },
  { x: 26, y: 3, char: "=" }
];
var bosqueDiffs = [
  { x: 25, y: 10, char: "B" },
  { x: 26, y: 10, char: "B" },
  { x: 25, y: 11, char: "B" },
  { x: 26, y: 11, char: "B" },
  { x: 25, y: 12, char: "B" },
  { x: 26, y: 12, char: "B" },
  { x: 23, y: 6, char: "." },
  { x: 24, y: 6, char: "." },
  { x: 25, y: 6, char: "." },
  { x: 26, y: 6, char: "." },
  { x: 27, y: 6, char: "." },
  { x: 28, y: 6, char: "." },
  { x: 23, y: 7, char: "." },
  { x: 24, y: 7, char: "." },
  { x: 25, y: 7, char: "." },
  { x: 26, y: 7, char: "." },
  { x: 27, y: 7, char: "." },
  { x: 28, y: 7, char: "." },
  { x: 40, y: 22, char: "," },
  { x: 43, y: 24, char: "," },
  { x: 41, y: 26, char: "," }
];
var BASE_MAPS = {
  lunaris: {
    id: "lunaris",
    name: "Valle de Lunaris",
    subtitle: "Cuna del Portador · Zona 1–8",
    w: 52,
    h: 38,
    rows: buildLunaris(),
    epochDiffs: lunarisDiffs,
    music: "village",
    npcs: [
      { id: "brisa", x: 23, y: 13, sprite: "brisa", name: "Anciana Brisa" },
      { id: "toln", x: 35, y: 11, sprite: "toln", name: "Maestro Toln" },
      { id: "teo", x: 23, y: 20, sprite: "teo", name: "Teo", showFlag: "wolfKills" },
      { id: "heraldo", x: 28, y: 17, sprite: "sombra", name: "Heraldo de Vesh", showFlag: "ecoVoz" }
    ],
    chests: [
      { id: "l1", x: 5, y: 24, gold: 40, needPast: true },
      { id: "l2", x: 48, y: 21, potions: 1, gold: 15 },
      { id: "l3", x: 30, y: 33, gold: 30 },
      { id: "l4", x: 6, y: 7, gold: 25 }
    ],
    echoes: [
      { id: "e1", x: 21, y: 13, title: "Eco menor · El pozo de los nombres", text: "«Antes de la Noche del Silencio, los aldeanos susurraban sus nombres al pozo para que el dios los tejiera en su canto. Ahora el pozo solo devuelve silencio.»" },
      { id: "e2", x: 40, y: 31, title: "Eco menor · La nieta del herrero", text: "«Toln aún forja todas las noches, aunque nadie compra. Dice que el metal recuerda el ritmo del martillo... y que algún día el canto volverá a necesitarlo.»" },
      { id: "e3", x: 14, y: 17, title: "Eco menor · Los Guardianes que aún cantan", text: "«Cada noche, tres capellanes subían a la muralla y cantaban las horas para que el valle durmiera sin miedo. Cuando el canto murió, dos callaron. El tercero aún canta: lo hacen las piedras por él, cuando llueve.»" }
    ],
    spawns: [
      { type: "lobo", x: 13, y: 33, patrol: 4, zone: "valle" },
      { type: "lobo", x: 19, y: 34, patrol: 4, zone: "valle" },
      { type: "lobo", x: 9, y: 30, patrol: 3, zone: "valle" },
      { type: "lobo", x: 34, y: 34, patrol: 4, zone: "valle" }
    ],
    exits: [
      { x: 23, y: 0, w: 6, h: 2, to: "bosque", tx: 27, ty: 40, label: "Bosque Susurrante" },
      { x: 25, y: 36, w: 3, h: 2, to: "costa", tx: 26, ty: 2, label: "Costa de Bruma" }
    ],
    props: [
      { id: "sanc_l", kind: "sanctuary", x: 25, y: 18 },
      { id: "forge", kind: "forge", x: 37, y: 10 },
      { id: "sign_l", kind: "sign", x: 29, y: 3, label: "«Al norte: Bosque Susurrante. Cuidado con la Niebla.»" },
      { id: "sign_l2", kind: "sign", x: 23, y: 34, label: "«Al sur: la Costa de Bruma. El mar... todavía susurra.»" }
    ]
  },
  bosque: {
    id: "bosque",
    name: "Bosque Susurrante",
    subtitle: "Los árboles recuerdan · Zona 8–15",
    w: 56,
    h: 44,
    rows: buildBosque(),
    epochDiffs: bosqueDiffs,
    music: "forest",
    npcs: [
      { id: "ilwen", x: 16, y: 32, sprite: "ilwen", name: "Ilwen", showFlag: "q2_done" },
      { id: "doran", x: 36, y: 24, sprite: "doran", name: "Doran" }
    ],
    chests: [
      { id: "b1", x: 4, y: 40, potions: 2 },
      { id: "b2", x: 52, y: 38, gold: 35 },
      { id: "b3", x: 30, y: 14, gold: 20 },
      { id: "b4", x: 40, y: 4, gold: 60, potions: 1 },
      { id: "b5", x: 21, y: 2, gold: 45 }
    ],
    echoes: [
      { id: "b_e1", x: 33, y: 26, title: "Eco menor · La Madre Espina", text: "«Cuando el canto murió, las raíces del Bosque enloquecieron de dolor. La Madre Espina no es mala: solo tiene roto el corazón.»" },
      { id: "b_e2", x: 48, y: 12, title: "Eco menor · El guardián de la niebla", text: "«Los lobos de niebla fueron una vez perros guardianes de Lunaris. Aún patrullan. Ya no saben para qué.»" },
      { id: "b_e3", x: 12, y: 38, title: "Eco menor · El primer Portador", text: "«Hubo otros antes que tú. Todos oyeron el primer Eco. Ninguno volvió de la Ciudadela. Prepara tu despedida, Portador.»" },
      { id: "b_e4", x: 30, y: 24, title: "Eco menor · La Rebelión de los Sordos", text: '«Hubo un año en que los aldeanos del bosque se taparon los oídos con cera de abejas: "si el canto nos gobernaba, el silencio nos libera". Duraron un invierno. La Niebla los encontró igual: el silencio también se puede robar.»' }
    ],
    spawns: [
      { type: "lobo", x: 32, y: 36, patrol: 4, zone: "bosque" },
      { type: "lobo", x: 20, y: 34, patrol: 4, zone: "bosque" },
      { type: "lobo", x: 44, y: 34, patrol: 4, zone: "bosque" },
      { type: "lobo", x: 14, y: 20, patrol: 3, zone: "bosque" },
      { type: "esqueleto", x: 30, y: 16, patrol: 3, zone: "bosque" },
      { type: "esqueleto", x: 40, y: 14, patrol: 3, zone: "bosque" },
      { type: "esqueleto", x: 10, y: 30, patrol: 3, zone: "bosque" },
      { type: "esqueleto", x: 34, y: 5, patrol: 3, zone: "bosque" },
      { type: "esqueleto", x: 45, y: 7, patrol: 3, zone: "bosque" }
    ],
    exits: [
      { x: 24, y: 42, w: 6, h: 2, to: "lunaris", tx: 26, ty: 3, label: "Valle de Lunaris" },
      { x: 8, y: 2, w: 5, h: 2, to: "cripta", tx: 19, ty: 30, label: "Cripta del Primer Canto" },
      { x: 54, y: 6, w: 2, h: 3, to: "cumbres", tx: 25, ty: 39, label: "Cumbres Heladas" }
    ],
    props: [
      { id: "sanc_b", kind: "sanctuary", x: 38, y: 26 },
      { id: "fragment", kind: "fragment", x: 41, y: 24 },
      { id: "sign_b", kind: "sign", x: 27, y: 41, label: "«Bosque Susurrante. Los caminos cambian con la luz.»" },
      { id: "sign_c", kind: "sign", x: 15, y: 5, label: "«Cripta del Primer Canto. Aquí durmió la voz del dios.»" },
      { id: "sign_nimue", kind: "sign", x: 25, y: 6, needPast: true, label: "Las flores del pasado no crecen en círculo por casualidad. Entre las raíces, apenas un hilo de voz que ya no es voz: «...nimue... nimue...» Alguien duerme aquí debajo, y la Niebla la cuida como a una semilla. (Ilwen busca a su hermana... pero jura que no se llamaba así.)" },
      { id: "sign_b2", kind: "sign", x: 52, y: 9, label: "«Al este: el paso de las Cumbres. Lleva abrigo, Portador.»" },
      { id: "sign_b3", kind: "sign", x: 27, y: 13, label: "«El río se cruzó siempre cantando, y el puente solo es entero en el ayer. Pulsa Q junto a él: el Bosque del norte guarda la Cripta del Primer Canto.»" }
    ]
  },
  cripta: {
    id: "cripta",
    name: "Cripta del Primer Canto",
    subtitle: "Fuera del tiempo",
    w: 40,
    h: 34,
    rows: buildCripta(),
    epochDiffs: [],
    dark: true,
    music: "crypt",
    npcs: [
      { id: "guarda", x: 21, y: 24, sprite: "kael", name: "La Guarda del Primer Canto", showFlag: "acto3Done" }
    ],
    chests: [
      { id: "c1", x: 28, y: 25, gold: 50 },
      { id: "c2", x: 7, y: 25, potions: 2 }
    ],
    echoes: [
      { id: "c_e1", x: 27, y: 13, title: "Eco menor · El eco del guardián", text: "«El Guardián Hueco fue el primer coro de Aelthar. Cuando el dios calló, el coro siguió cantando... hasta que su propia voz lo vació por dentro.»" },
      { id: "c_e2", x: 12, y: 25, title: "Eco menor · El peregrino", text: "«Cientos peregrinos subieron a oír el Primer Canto. Este dejó su lámpara encendida para el siguiente. Aún arde.»" },
      { id: "c_e3", x: 24, y: 26, title: "Eco menor · La Lanza Muda", text: "«Aquí forjaron los Durn la Lanza que mató al dios: una lanza sin canto, sorda de nacimiento, para que el canto del dios no la desviara. Nadie la volvió a ver. Los que la buscaron dicen que sigue silbando en algún rincón del mundo... esperando la segunda vez.»" }
    ],
    spawns: [
      { type: "esqueleto", x: 10, y: 26, patrol: 3, zone: "cripta" },
      { type: "esqueleto", x: 29, y: 27, patrol: 3, zone: "cripta" },
      { type: "esqueleto", x: 13, y: 17, patrol: 2, zone: "cripta" },
      { type: "guardian", x: 19, y: 8, zone: "boss" }
    ],
    exits: [
      { x: 18, y: 31, w: 4, h: 3, to: "bosque", tx: 10, ty: 5, label: "Bosque Susurrante" }
    ],
    props: [
      { id: "sanc_c", kind: "sanctuary", x: 19, y: 23 },
      { id: "altar_c", kind: "altarEcho", x: 19, y: 4 }
    ]
  }
};
var MAPS = { ...BASE_MAPS, ...EXPANSION_MAPS };
function mapRows(m) {
  const rows = [];
  for (let y = 0;y < m.h; y++) {
    const r = m.rows[y] ?? "";
    rows.push(r.length >= m.w ? r.slice(0, m.w) : r + ".".repeat(m.w - r.length));
  }
  return rows;
}
function tileAt(m, rows, tx, ty, epoch) {
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h)
    return "V";
  let ch = rows[ty][tx];
  if (epoch === "pasado") {
    for (const d of m.epochDiffs) {
      if (d.x === tx && d.y === ty) {
        ch = d.char;
        break;
      }
    }
  }
  return ch;
}

// src/game/sprites.ts
var exports_sprites = {};
__export(exports_sprites, {
  registerSpr: () => registerSpr,
  isTallTile: () => isTallTile,
  initSprites: () => initSprites,
  hash2: () => hash2,
  getSpr: () => getSpr,
  getCastFrames: () => getCastFrames,
  getAttackFrames: () => getAttackFrames,
  frameIndex: () => frameIndex,
  entityFrame: () => entityFrame,
  drawTile: () => drawTile,
  drawTallTile: () => drawTallTile,
  drawSlashArc: () => drawSlashArc,
  drawPortrait: () => drawPortrait,
  TILE: () => TILE,
  SOLID_CHARS: () => SOLID_CHARS
});

// src/game/world/palette.ts
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ h >> 13) * 1274126177;
  return ((h ^ h >> 16) >>> 0) / 4294967295;
}
function px(x, X, Y, W, H, C) {
  x.fillStyle = C;
  x.fillRect(X, Y, W, H);
}
var PAL = {
  grassLunaris: ["#4f8a46", "#467c3e", "#578f4c", "#427a3a"],
  grassBosque: ["#3f6d3a", "#396334", "#457540", "#355e31"],
  grassBlade: "#5a9a50",
  grassBladeBosque: "#4f8a48",
  grassDark: "#3a6836",
  grassWet: "#2f5433",
  grassWetBosque: "#28482c",
  flowerCols: ["#f0d060", "#e878a0", "#f0f0f0", "#e88a4a", "#b48ae8"],
  flowerCore: "#fff6dc",
  path: "#b89a6a",
  pathLight: "#c4a878",
  pathDark: "#a08454",
  pathShadow: "#8a7248",
  stone: "#6a6a7a",
  stoneLight: "#7a7a8a",
  stoneDark: "#5a5a6a",
  stoneLine: "#585868",
  stoneDeep: "#3e3e50",
  stoneHi: "#8a8a9a",
  stoneVein: "#63636f",
  water: "#3a6a9a",
  waterHi: "#3f72a4",
  waterGlint: "#6aa0cc",
  waterDeep: "#2c5580",
  foam: "#cfe6f2",
  waterShallow: "#4a7cae",
  waterDeep2: "#1f3f66",
  waterWave: "#5688b5",
  sparkle: "#d8ecf8",
  foamWash: "#9cc8de",
  shoreSand: "#c2a878",
  shoreSandHi: "#d4bc8c",
  shoreMud: "#8a6f4e",
  pebble: "#9a9082",
  pebbleDark: "#6f695c",
  bridgeWater: "#26496f",
  ropeLight: "#c9ad7a",
  ropeDark: "#8f7147",
  plankWet: "#5f462a",
  forestTint: "#3a5a48",
  wood: "#8a6a44",
  woodDark: "#6a4e30",
  woodMid: "#7a5c3a",
  woodLight: "#b89058",
  wall: "#e2d0ac",
  wallShadow: "#d0bc94",
  roof: "#a8503a",
  roofDark: "#7e3626",
  roofLight: "#c86850",
  roofMid: "#94422e",
  door: "#5c3a1e",
  doorMid: "#7a5230",
  gold: "#f0c84a",
  cryptFloor: "#565664",
  cryptWall: "#4a4a5c",
  trunkHi: "#7c5836",
  trunkMid: "#6e4a2a",
  trunkDeep: "#54381e",
  rootSoil: "#4a3520",
  copaDeepL: "#2c5a30",
  copaMidL: "#3f7a3e",
  copaLightL: "#5c9c4e",
  copaDeepB: "#24502c",
  copaMidB: "#356a38",
  copaLightB: "#4c8a44",
  pineDeep: "#16351f",
  pineDark: "#1c4426",
  pineMid: "#2a5c32",
  pineLight: "#3f7844",
  fruitRed: "#e05858",
  fruitShine: "#f09090",
  flowerGold: "#e8c860",
  flowerPink: "#e88ab0",
  nestBrown: "#6a4e2a",
  nestDark: "#4e3a1e",
  eggShell: "#f2e8d0",
  birdBody: "#3a3440",
  birdBeak: "#e0a83c",
  leafHang: "#74a852",
  void0: "#0c0a14",
  voidSpeck: "#1c1828",
  wallHi: "#f2e4c2",
  wallDirt: "#c9b489",
  beam: "#5a4026",
  beamHi: "#70502f",
  plinth: "#8d8d99",
  plinthHi: "#a2a2ae",
  plinthDark: "#66666f",
  winFrame: "#4a3320",
  glass: "#7c9fc4",
  glassHi: "#bcd8ea",
  glassDark: "#5a7a9c",
  step: "#9c9ca8",
  stepDark: "#74747f",
  ridge: "#d8825f",
  ridgeHi: "#ea9c74",
  mossTile: "#6f8a4c",
  brokenTile: "#5c2a1a",
  chimney: "#7d7d8c",
  chimneyHi: "#9696a4",
  chimneyDark: "#5c5c6a",
  chimneyMouth: "#2e2e3c",
  iron: "#3c3126",
  lanternOff: "#565048",
  lanternGlass: "#453f35",
  rope: "#b09a68",
  wellWater: "#54c8d8",
  wellDeep: "#1c2c3c",
  moss: "#5f7d46",
  objShadow: "rgba(0,0,0,0.25)",
  stoneMoss: "#4d6a44",
  stoneMossDark: "#3c5636",
  stoneMossCrypt: "#3f5f52",
  runeCrypt: "#5a8a9a",
  candleFlame: "#f4c878",
  candleWax: "#c8893c"
};
function isForest(mapId) {
  return mapId === "bosque";
}
function isCrypt(mapId) {
  return mapId === "cripta";
}
function pick(r, n) {
  return Math.min(n - 1, Math.floor(r * n));
}

// src/game/world/grass.ts
var TONOS_LUNARIS = [
  PAL.grassDark,
  PAL.grassLunaris[3],
  PAL.grassLunaris[1],
  PAL.grassLunaris[0],
  PAL.grassLunaris[2],
  PAL.grassBlade
];
var TONOS_BOSQUE = [
  "#2c4f2a",
  PAL.grassBosque[3],
  PAL.grassBosque[1],
  PAL.grassBosque[0],
  PAL.grassBosque[2],
  PAL.grassBladeBosque
];
var TONOS_NIEBLA = ["#333f38", "#3a473f", "#414f46", "#48574d", "#505f54", "#586759"];
var TIERRA = ["#54402a", "#5f4629", "#6a4e30", "#71543a"];
var HIERBA = new Set([".", ",", "c", "m"]);
function vnoise(vx, vy, L, seed) {
  const gx = Math.floor(vx / L), gy = Math.floor(vy / L);
  const fx = vx / L - gx, fy = vy / L - gy;
  const s2 = seed * 2;
  const a = hash2(gx + seed, gy + s2);
  const b = hash2(gx + 1 + seed, gy + s2);
  const c = hash2(gx + seed, gy + 1 + s2);
  const d = hash2(gx + 1 + seed, gy + 1 + s2);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function tonoEn(vx, vy, tones) {
  const n = 0.62 * vnoise(vx, vy, 7, 11) + 0.38 * vnoise(vx, vy, 3, 47);
  let k = (n - 0.2) / 0.6;
  if (k < 0)
    k = 0;
  else if (k > 0.999)
    k = 0.999;
  return tones[k * 6 | 0];
}
function tonoTierra(vx, vy) {
  const n = 0.6 * vnoise(vx, vy, 9, 91) + 0.4 * vnoise(vx, vy, 4, 23);
  let k = (n - 0.2) / 0.6;
  if (k < 0)
    k = 0;
  else if (k > 0.999)
    k = 0.999;
  return TIERRA[k * 4 | 0];
}
function baseMoteado(x, X0, Y0, tonoFn) {
  for (let j = 0;j < 16; j++) {
    let ini = 0, tono = "";
    for (let i = 0;i <= 16; i++) {
      const tk = i < 16 ? tonoFn(X0 + i, Y0 + j) : "";
      if (tk !== tono) {
        if (i > ini)
          px(x, X0 + ini, Y0 + j, i - ini, 1, tono);
        ini = i;
        tono = tk;
      }
    }
  }
}
function briznas(x, X0, Y0, tx, ty, cL, cD) {
  const n = 3 + (hash2(tx * 13 + 1, ty * 17 + 2) * 4 | 0);
  for (let k = 0;k < n; k++) {
    const bx = X0 + 1 + (hash2(tx * 31 + k * 7, ty * 29 + k * 3) * 13 | 0);
    const by = Y0 + 2 + (hash2(tx * 17 + k * 5, ty * 41 + k * 11) * 12 | 0);
    const s = hash2(tx * 5 + k * 3, ty * 23 + k);
    const col = s < 0.3 ? cD : cL;
    if (s < 0.45)
      px(x, bx, by, 1, 2, col);
    else if (s < 0.68)
      px(x, bx, by, 2, 1, col);
    else if (s < 0.9) {
      px(x, bx, by, 1, 2, col);
      px(x, bx + 1, by, 1, 1, col);
    } else
      px(x, bx, by, 1, 1, col);
  }
}
function mata(x, X0, Y0, tx, ty, cL, cM, cD) {
  if (hash2(tx * 3 + 11, ty * 5 + 13) >= 0.09)
    return;
  const bx = X0 + 2 + (hash2(tx * 9, ty * 21) * 10 | 0);
  const by = Y0 + 3 + (hash2(tx * 15, ty * 25) * 9 | 0);
  px(x, bx, by, 1, 1, cL);
  px(x, bx + 2, by, 1, 1, cL);
  px(x, bx, by + 1, 3, 1, cM);
  px(x, bx, by + 2, 3, 1, cD);
}
function rareza(x, X0, Y0, tx, ty, cD) {
  if (hash2(tx * 19 + 7, ty * 23 + 3) >= 0.02)
    return;
  const bx = X0 + 3 + (hash2(tx * 7, ty * 31) * 9 | 0);
  const by = Y0 + 3 + (hash2(tx * 11, ty * 37) * 9 | 0);
  switch (pick(hash2(tx * 29, ty * 13), 4)) {
    case 0:
      px(x, bx, by, 2, 1, "#a8503a");
      px(x, bx, by, 1, 1, "#e8d0b0");
      px(x, bx, by + 1, 1, 1, "#d8c9a0");
      break;
    case 1:
      px(x, bx, by, 2, 1, PAL.stoneHi);
      px(x, bx, by + 1, 1, 1, PAL.stoneDark);
      break;
    case 2:
      px(x, bx + 1, by, 1, 1, "#2f7a3e");
      px(x, bx, by + 1, 1, 1, "#2f7a3e");
      px(x, bx + 2, by + 1, 1, 1, "#2f7a3e");
      px(x, bx + 1, by + 2, 1, 1, "#2f7a3e");
      px(x, bx + 1, by + 3, 1, 1, cD);
      break;
    default:
      px(x, bx, by, 1, 1, cD);
      px(x, bx + 1, by + 1, 1, 1, cD);
      px(x, bx + 2, by, 1, 1, cD);
      px(x, bx + 3, by + 1, 1, 1, cD);
      break;
  }
}
function pintorLado(x, X0, Y0, side) {
  if (side === 0)
    return (k, m, c) => px(x, X0 + k, Y0 + m, 1, 1, c);
  if (side === 1)
    return (k, m, c) => px(x, X0 + k, Y0 + 15 - m, 1, 1, c);
  if (side === 2)
    return (k, m, c) => px(x, X0 + m, Y0 + k, 1, 1, c);
  return (k, m, c) => px(x, X0 + 15 - m, Y0 + k, 1, 1, c);
}
function diente1(x, X0, Y0, side, tx, ty, c, umbral) {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0;k < 16; k++) {
    if (hash2(tx * 21 + k + side * 57, ty * 21 + side * 31) < umbral)
      p(k, 0, c);
  }
}
function bordeCamino(x, X0, Y0, side, tx, ty) {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0;k < 16; k++) {
    const h = hash2(tx * 16 + k + side * 57, ty * 16 + side * 31);
    const d = h < 0.25 ? 2 : h < 0.8 ? 1 : 0;
    for (let m = 0;m < d; m++) {
      const h2 = hash2(tx * 32 + k * 3 + m, ty * 32 + side * 7 + m * 5);
      p(k, m, h2 < 0.55 ? PAL.path : PAL.pathDark);
    }
    if (d > 0 && hash2(tx * 8 + k, ty * 8 + side * 13) < 0.3)
      p(k, d - 1, PAL.pathShadow);
    if (d > 0 && d < 2 && hash2(tx * 12 + k, ty * 12 + side * 17) < 0.12)
      p(k, d, PAL.pathLight);
  }
}
function bordeAgua(x, X0, Y0, side, tx, ty, cWet) {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0;k < 16; k++) {
    const h = hash2(tx * 16 + k + side * 71, ty * 16 + side * 13 + 5);
    const d = h < 0.35 ? 2 : h < 0.8 ? 1 : 0;
    for (let m = 0;m < d; m++) {
      const h2 = hash2(tx * 24 + k * 5 + m, ty * 24 + side * 3 + m);
      p(k, m, h2 < 0.75 ? cWet : "#3d4a2c");
    }
  }
}
function bordeCultivo(x, X0, Y0, side, tx, ty, cG) {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0;k < 16; k++) {
    const h = hash2(tx * 21 + k + side * 41, ty * 21 + side * 11);
    if (h < 0.4)
      p(k, 0, "#4a3620");
    else if (h < 0.65)
      p(k, 0, cG);
  }
}
function bordeSolido(x, X0, Y0, side, cD) {
  const p = pintorLado(x, X0, Y0, side);
  for (let k = 0;k < 16; k++)
    p(k, 0, cD);
}
function transiciones(x, X0, Y0, tx, ty, ch, mapId, at) {
  if (!at)
    return;
  const forest = isForest(mapId);
  const cD = forest ? "#2c4f2a" : PAL.grassDark;
  const cWet = forest ? PAL.grassWetBosque : PAL.grassWet;
  const cMid = forest ? TONOS_BOSQUE[3] : TONOS_LUNARIS[3];
  for (let side = 0;side < 4; side++) {
    const dx = side === 2 ? -1 : side === 3 ? 1 : 0;
    const dy = side === 0 ? -1 : side === 1 ? 1 : 0;
    const nb = at(dx, dy);
    if (nb === "=")
      bordeCamino(x, X0, Y0, side, tx, ty);
    else if (nb === "~" || nb === "B" || nb === "x")
      bordeAgua(x, X0, Y0, side, tx, ty, cWet);
    else if (HIERBA.has(nb)) {
      if (ch === "c" && nb !== "c")
        bordeCultivo(x, X0, Y0, side, tx, ty, cMid);
      else if (nb === "m" && ch !== "m")
        diente1(x, X0, Y0, side, tx, ty, TONOS_NIEBLA[3], 0.35);
      else if (nb !== "m" && ch === "m")
        diente1(x, X0, Y0, side, tx, ty, cMid, 0.35);
    } else if (nb !== "V") {
      bordeSolido(x, X0, Y0, side, ch === "c" ? "#4a3620" : cD);
    }
  }
}
function paintAlta(x, X0, Y0, tx, ty, mapId) {
  const forest = isForest(mapId);
  const cL = forest ? PAL.grassBladeBosque : PAL.grassBlade;
  const cD = forest ? "#2c4f2a" : PAL.grassDark;
  const nB = 3 + (hash2(tx, ty) * 3 | 0);
  for (let k = 0;k < nB; k++) {
    const bx = X0 + 1 + (hash2(tx * 3 + k * 5, ty * 13 + k) * 13 | 0);
    const top = Y0 + 3 + (hash2(tx * 9 + k, ty * 7 + k * 3) * 6 | 0);
    const h = 3 + (hash2(tx * 11 + k * 7, ty * 3 + k) * 3 | 0);
    const col = hash2(tx * 17 + k, ty * 19 + k) < 0.4 ? cD : cL;
    px(x, bx, top, 1, h, col);
    px(x, bx, top - 1, 1, 1, forest ? "#67a05e" : "#78b86a");
    if (hash2(tx * 23 + k, ty * 29 + k) < 0.35)
      px(x, bx + 1, top + 1, 1, 1, col);
  }
  const nF = hash2(tx * 7 + 3, ty * 11 + 5) < 0.55 ? 1 : 2;
  for (let f = 0;f < nF; f++) {
    const fx = X0 + 2 + (hash2(tx * 41 + f * 3, ty * 43 + f) * 11 | 0);
    const fy = Y0 + 4 + (hash2(tx * 47 + f, ty * 31 + f * 5) * 9 | 0);
    const col = PAL.flowerCols[pick(hash2(tx * 53 + f, ty * 59 + f), PAL.flowerCols.length)];
    px(x, fx, fy, 2, 2, col);
    px(x, fx, fy, 1, 1, PAL.flowerCore);
    px(x, fx, fy + 2, 2, 1, cD);
  }
}
function paintCultivo(x, X0, Y0, tx, ty) {
  baseMoteado(x, X0, Y0, tonoTierra);
  for (let row = 0;row < 3; row++) {
    const yB = 3 + row * 4 + (ty * 2 + row * 3) % 3;
    const fase = hash2(tx, ty * 3 + row) * 6.283;
    const curva = (i) => Math.max(5, Math.min(13, yB + Math.round(Math.sin((X0 + i) * 0.5 + fase) * 1.4)));
    for (let i = 0;i < 16; i++) {
      const yC = curva(i);
      px(x, X0 + i, Y0 + yC, 1, 1, "#4a3620");
      px(x, X0 + i, Y0 + yC - 1, 1, 1, "#7a5c3a");
    }
    const nS = 3 + (hash2(tx * 7 + row, ty * 5 + row) * 2 | 0);
    for (let s = 0;s < nS; s++) {
      const i = 1 + (hash2(tx * 13 + row * 3 + s * 5, ty * 11 + s * 7) * 14 | 0);
      const yC = curva(i);
      const oscuro = hash2(tx + s * 3, ty * 17 + row * 5 + s) < 0.5;
      px(x, X0 + i, Y0 + yC - 3, 1, 2, oscuro ? "#427a3a" : "#4f8a46");
      px(x, X0 + i, Y0 + yC - 4, 1, 1, oscuro ? "#578f4c" : "#6fbf62");
    }
  }
  if (hash2(tx * 3 + 1, ty * 9 + 7) < 0.5) {
    const gx = X0 + 3 + (hash2(tx * 37, ty * 41) * 10 | 0);
    const gy = Y0 + 2 + (hash2(tx * 43, ty * 47) * 3 | 0);
    px(x, gx, gy, 1, 1, PAL.pathLight);
  }
}
function paintMist(x, X0, Y0, tx, ty, t) {
  baseMoteado(x, X0, Y0, (vx, vy) => tonoEn(vx, vy, TONOS_NIEBLA));
  briznas(x, X0, Y0, tx, ty, "#57695d", "#3a473f");
  x.globalAlpha = 0.16;
  px(x, X0, Y0, 16, 16, "#9ec4b4");
  x.globalAlpha = 0.4;
  const nM = 2 + (hash2(tx * 5 + 3, ty * 7 + 1) * 2 | 0);
  for (let k = 0;k < nM; k++) {
    const mx = X0 + 1 + (((hash2(tx + k * 7, ty * 3 + k) * 12 + t * (1.2 + k * 0.8)) % 12 + 12) % 12 | 0);
    const my = Y0 + 2 + (((hash2(tx * 3 + k, ty + k * 5) * 9 + Math.sin(t * 0.9 + tx + k * 2.1) * 2) % 9 + 9) % 9 | 0);
    if (k % 2 === 0)
      px(x, mx, my, 2, 1, "#b8d8c8");
    else
      px(x, mx, my, 1, 2, "#b8d8c8");
  }
  x.globalAlpha = 1;
}
function paintGrass(x, ch, tx, ty, mapId, t, at) {
  const X0 = tx * 16, Y0 = ty * 16;
  const forest = isForest(mapId);
  const cD = forest ? "#2c4f2a" : PAL.grassDark;
  const cL = forest ? PAL.grassBladeBosque : PAL.grassBlade;
  if (ch === "c") {
    paintCultivo(x, X0, Y0, tx, ty);
  } else if (ch === "m") {
    paintMist(x, X0, Y0, tx, ty, t);
  } else {
    const tones = forest ? TONOS_BOSQUE : TONOS_LUNARIS;
    baseMoteado(x, X0, Y0, (vx, vy) => tonoEn(vx, vy, tones));
    if (ch === ",") {
      paintAlta(x, X0, Y0, tx, ty, mapId);
    } else {
      briznas(x, X0, Y0, tx, ty, cL, cD);
      mata(x, X0, Y0, tx, ty, cL, tones[2], cD);
      rareza(x, X0, Y0, tx, ty, cD);
    }
  }
  transiciones(x, X0, Y0, tx, ty, ch, mapId, at);
}

// src/game/world/water.ts
var T = 16;
function isWaterChar(ch) {
  return ch === "~";
}
function isRiverish(ch) {
  return ch === "~" || ch === "B" || ch === "x";
}
var DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
function countAround(at, ox, oy, pred) {
  if (!at)
    return 6;
  let n = 0;
  for (let dy = -1;dy <= 1; dy++) {
    for (let dx = -1;dx <= 1; dx++) {
      if (dx === 0 && dy === 0)
        continue;
      if (pred(at(ox + dx, oy + dy)))
        n++;
    }
  }
  return n;
}
function depthLevel(n) {
  return n >= 8 ? 2 : n >= 5 ? 1 : 0;
}
var DEPTH_BASE = [PAL.waterHi, PAL.water, PAL.waterDeep];
var DEPTH_DITHER = [PAL.waterShallow, PAL.waterDeep, PAL.waterDeep2];
var DEPTH_DENS = [0.14, 0.12, 0.3];
function paintWater(x, ch, tx, ty, mapId, t, at) {
  const px0 = tx * T, py0 = ty * T;
  if (ch === "B") {
    paintBridge(x, tx, ty, px0, py0, false, at);
    return;
  }
  if (ch === "x") {
    paintBridge(x, tx, ty, px0, py0, true, at);
    return;
  }
  paintWaterTile(x, tx, ty, px0, py0, mapId, at);
}
function paintWaterTile(x, tx, ty, px0, py0, mapId, at) {
  const depth = depthLevel(countAround(at, 0, 0, isWaterChar));
  px(x, px0, py0, T, T, DEPTH_BASE[depth]);
  ditherSpots(x, tx, ty, px0, py0, DEPTH_DITHER[depth], DEPTH_DENS[depth], 11 + depth * 61);
  if (at) {
    for (let d = 0;d < 4; d++) {
      const [ox, oy] = DIRS[d];
      if (!isWaterChar(at(ox, oy)))
        continue;
      const nd = depthLevel(countAround(at, ox, oy, isWaterChar));
      if (nd > depth)
        edgeDither(x, px0, py0, d, DEPTH_BASE[nd], 0.55);
      else if (nd < depth)
        edgeDither(x, px0, py0, d, DEPTH_DITHER[nd], 0.4);
    }
  }
  if (isForest(mapId)) {
    x.globalAlpha = 0.2;
    px(x, px0, py0, T, T, PAL.forestTint);
    x.globalAlpha = 1;
  }
  staticWaves(x, tx, ty, px0, py0);
  if (at) {
    for (let d = 0;d < 4; d++) {
      const c = at(DIRS[d][0], DIRS[d][1]);
      if (c === "V" || isWaterChar(c))
        continue;
      if (isRiverish(c))
        bridgeShadowBand(x, px0, py0, d);
      else
        shoreBand(x, tx, ty, px0, py0, d);
    }
  }
}
function ditherSpots(x, tx, ty, px0, py0, color, density, seed) {
  x.fillStyle = color;
  for (let cy = 0;cy < T; cy += 2) {
    for (let cx = 0;cx < T; cx += 2) {
      if (hash2(tx * 8 + cx / 2 + seed, ty * 8 + cy / 2 - seed) < density) {
        x.fillRect(px0 + cx, py0 + cy, 2, 2);
      }
    }
  }
}
function edgeRect(dir, px0, py0, i, inset, size, seg) {
  if (dir === 0)
    return [px0 + i, py0 + inset, seg, size];
  if (dir === 1)
    return [px0 + i, py0 + T - inset - size, seg, size];
  if (dir === 2)
    return [px0 + inset, py0 + i, size, seg];
  return [px0 + T - inset - size, py0 + i, size, seg];
}
function edgeDither(x, px0, py0, dir, color, density) {
  x.fillStyle = color;
  for (let i = 0;i < T; i += 2) {
    if (hash2(i * 13 + dir * 251, dir * 97 + i * 7) >= density)
      continue;
    const r = edgeRect(dir, px0, py0, i, 0, 2, 2);
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
}
function shoreBand(x, tx, ty, px0, py0, dir) {
  for (let i = 0;i < T; i++) {
    const jag = hash2(tx * T + i + dir * 577, ty * T + i * 13 - dir * 131);
    const d = 2 + (jag > 0.55 ? 1 : 0);
    const r = edgeRect(dir, px0, py0, i, 0, d, 1);
    x.fillStyle = jag > 0.82 ? PAL.shoreSandHi : PAL.shoreSand;
    x.fillRect(r[0], r[1], r[2], r[3]);
    if (jag > 0.3) {
      const m = edgeRect(dir, px0, py0, i, d, 1, 1);
      x.fillStyle = PAL.shoreMud;
      x.fillRect(m[0], m[1], m[2], m[3]);
    }
  }
  for (let k = 0;k < 2; k++) {
    const rp = hash2(tx * 31 + k * 7 + dir * 17, ty * 37 - k * 11 + dir * 3);
    if (rp > 0.62)
      continue;
    const i = 1 + Math.floor(hash2(tx * 17 + k * 5, ty * 19 - k * 3) * (T - 2));
    const row = Math.floor(hash2(tx * 23 + k, ty * 29 + k * 7) * 2);
    const r = edgeRect(dir, px0, py0, i, row, 1, 1);
    x.fillStyle = rp < 0.22 ? PAL.pebbleDark : PAL.pebble;
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
}
function bridgeShadowBand(x, px0, py0, dir) {
  x.fillStyle = PAL.bridgeWater;
  for (let i = 0;i < T; i++) {
    const r = edgeRect(dir, px0, py0, i, 0, 2, 1);
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
  x.fillStyle = PAL.waterDeep2;
  for (let i = 0;i < T; i += 4) {
    if (hash2(i * 3 + dir * 41, dir * 13 + i) < 0.35)
      continue;
    const r = edgeRect(dir, px0, py0, i, 3, 1, 3);
    x.fillRect(r[0], r[1], r[2], r[3]);
  }
}
function staticWaves(x, tx, ty, px0, py0) {
  const lines = 2 + (hash2(tx * 3 + 11, ty * 5 + 3) > 0.5 ? 1 : 0);
  for (let k = 0;k < lines; k++) {
    const ly = 2 + Math.floor(hash2(tx * 7 + k * 13 + 1, ty * 11 + k * 5 + 7) * 12);
    const lx = Math.floor(hash2(tx * 5 + k * 3 + 2, ty * 9 + k * 7 + 4) * 6);
    const len = Math.min(T - lx, 6 + Math.floor(hash2(tx + k * 17, ty * 2 + k * 23) * 7));
    const a = 2 + Math.floor(hash2(tx * 13 + k * 3, ty * 3 + k) * Math.max(1, len - 3));
    x.fillStyle = PAL.waterWave;
    x.fillRect(px0 + lx, py0 + ly, a, 1);
    if (a + 1 < len)
      x.fillRect(px0 + lx + a + 1, py0 + ly, len - a - 1, 1);
  }
}
function paintBridge(x, tx, ty, px0, py0, broken, at) {
  px(x, px0, py0, T, T, PAL.waterDeep);
  ditherSpots(x, tx, ty, px0, py0, PAL.waterDeep2, 0.3, 7);
  if (broken) {
    x.globalAlpha = 0.4;
    px(x, px0, py0, T, T, PAL.bridgeWater);
    x.globalAlpha = 1;
    ditherSpots(x, tx, ty, px0, py0, PAL.waterDeep2, 0.22, 43);
  }
  if (broken)
    paintBridgeBroken(x, tx, ty, px0, py0, at);
  else
    paintBridgeWhole(x, tx, ty, px0, py0, at);
}
function bridgePost(x, X, Y) {
  px(x, X, Y, 3, 4, PAL.woodDark);
  px(x, X, Y, 1, 4, PAL.woodMid);
  px(x, X, Y, 3, 1, PAL.woodLight);
  px(x, X + 1, Y + 2, 2, 1, PAL.ropeLight);
}
function ropeEdge(x, px0, py0, east) {
  const rx = px0 + (east ? T - 1 : 0);
  px(x, rx, py0 + 1, 1, T - 2, PAL.ropeDark);
  px(x, rx + (east ? -1 : 1), py0 + 1, 1, T - 2, PAL.woodDark);
  for (let ky = 2;ky < T - 1; ky += 4)
    px(x, rx, py0 + ky, 1, 2, PAL.ropeLight);
}
function paintBridgeWhole(x, tx, ty, px0, py0, at) {
  const leftCol = !!at && at(-1, 0) !== "B";
  const rightCol = !!at && at(1, 0) !== "B";
  const topEnd = !!at && at(0, -1) !== "B";
  const botEnd = !!at && at(0, 1) !== "B";
  px(x, px0, py0, T, 1, PAL.bridgeWater);
  px(x, px0, py0 + T - 1, T, 1, PAL.bridgeWater);
  const off = Math.floor(hash2(ty * 13 + 7, 911) * 3);
  let y = 1 + off;
  while (y < T - 1) {
    const h = Math.min(3, T - 1 - y);
    px(x, px0, py0 + y, T, h, PAL.woodMid);
    px(x, px0, py0 + y, T, 1, PAL.woodLight);
    if (y + h < T - 1)
      px(x, px0, py0 + y + h, T, 1, PAL.woodDark);
    if (h >= 2) {
      const glen = 3 + Math.floor(hash2(tx * 7 + y * 3, ty * 11 + y) * 6);
      const gx = px0 + Math.floor(hash2(tx * 17 + y, ty * 3 - y) * (T - glen));
      px(x, gx, py0 + y + 1 + Math.floor(hash2(tx * 3 + y, ty * 5 - y) * (h - 1)), glen, 1, PAL.woodDark);
      if (hash2(tx * 5 - y, ty * 7 + y * 3) > 0.78) {
        px(x, px0 + (glen + 4) % (T - 2), py0 + y + 1, 2, 1, PAL.woodDark);
      }
    }
    y += 4;
  }
  if (leftCol)
    ropeEdge(x, px0, py0, false);
  if (rightCol)
    ropeEdge(x, px0, py0, true);
  if (topEnd) {
    if (leftCol)
      bridgePost(x, px0, py0);
    if (rightCol)
      bridgePost(x, px0 + T - 3, py0);
  }
  if (botEnd) {
    if (leftCol)
      bridgePost(x, px0, py0 + T - 4);
    if (rightCol)
      bridgePost(x, px0 + T - 3, py0 + T - 4);
  }
}
function paintBridgeBroken(x, tx, ty, px0, py0, at) {
  const leftCol = !!at && at(-1, 0) !== "x";
  const rightCol = !!at && at(1, 0) !== "x";
  const topEnd = !!at && at(0, -1) !== "x";
  const botEnd = !!at && at(0, 1) !== "x";
  const off = Math.floor(hash2(ty * 13 + 7, 913) * 3);
  let y = 1 + off;
  while (y < T - 1) {
    const h = Math.min(3, T - 1 - y);
    let keep = hash2(tx * 21 + y * 3, ty * 47 + y * 5 + 13);
    if (topEnd && y <= 7)
      keep += 0.5;
    if (botEnd && y >= 8)
      keep = 0;
    if (!topEnd && !botEnd)
      keep -= 0.18;
    if (keep > 0.28) {
      const full = keep > 0.62;
      const fromEast = hash2(tx * 11 + y, ty * 29 - y) > 0.5;
      const w = full ? T : 5 + Math.floor(hash2(tx * 9 - y, ty * 23 + y * 7) * 8);
      const X = px0 + (fromEast && !full ? T - w : 0);
      px(x, X, py0 + y, w, h, PAL.woodMid);
      px(x, X, py0 + y, w, 1, PAL.woodLight);
      if (!full) {
        px(x, fromEast ? X : X + w - 1, py0 + y, 1, 1, PAL.waterDeep2);
      }
      if (y + h < T - 1 && (full || hash2(tx + y, ty - y) > 0.4)) {
        px(x, X, py0 + y + h, w, 1, PAL.woodDark);
      }
      if (h >= 2) {
        const glen = Math.min(w - 2, 3 + Math.floor(hash2(tx * 7 + y * 3, ty * 11 + y) * 4));
        const gx = X + Math.floor(hash2(tx * 3 + y, ty * 5 - y) * Math.max(1, w - glen - 1));
        px(x, gx, py0 + y + 1, glen, 1, PAL.woodDark);
      }
    } else if (keep > 0.12) {
      const fromEast = hash2(tx * 11 + y, ty * 29 - y) > 0.5;
      px(x, px0 + (fromEast ? T - 3 : 0), py0 + y, 3, h, PAL.woodDark);
    }
    y += 4;
  }
  for (let k = 0;k < 3; k++) {
    const sr = hash2(tx * 41 + k * 13, ty * 43 + k * 7 + 5);
    if (sr < 0.35)
      continue;
    const sx = px0 + 1 + Math.floor(hash2(tx * 13 + k * 3, ty * 17 + k) * (T - 4));
    const sy = py0 + 1 + Math.floor(hash2(tx * 19 - k, ty * 7 + k * 5) * (T - 4));
    if (sr > 0.72)
      px(x, sx, sy, 1, 2, PAL.woodDark);
    else
      px(x, sx, sy, 2, 1, PAL.woodMid);
  }
  if (botEnd) {
    px(x, px0 + 3, py0 + 8, 6, 2, PAL.woodMid);
    px(x, px0 + 4, py0 + 10, 5, 2, PAL.woodDark);
    px(x, px0 + 6, py0 + 12, 3, 2, PAL.plankWet);
    px(x, px0 + 7, py0 + 14, 2, 1, PAL.plankWet);
    px(x, px0 + 5, py0 + 14, 4, 1, PAL.bridgeWater);
    px(x, px0 + 5, py0 + 13, 1, 1, PAL.foam);
    px(x, px0 + 10, py0 + 13, 1, 1, PAL.foam);
    px(x, px0 + 11, py0 + 12, 4, 2, PAL.woodDark);
    px(x, px0 + 11, py0 + 12, 4, 1, PAL.woodMid);
    px(x, px0 + 10, py0 + 11, 1, 1, PAL.foam);
    px(x, px0 + 15, py0 + 14, 1, 1, PAL.foam);
  }
  if (topEnd) {
    if (leftCol) {
      px(x, px0, py0, 3, 2, PAL.woodDark);
      px(x, px0, py0, 3, 1, PAL.woodMid);
      px(x, px0 + 1, py0 + 2, 1, 3, PAL.ropeDark);
      px(x, px0 + 2, py0 + 5, 1, 2, PAL.ropeLight);
    }
    if (rightCol) {
      px(x, px0 + T - 3, py0, 3, 2, PAL.woodDark);
      px(x, px0 + T - 3, py0, 3, 1, PAL.woodMid);
      px(x, px0 + T - 2, py0 + 2, 1, 2, PAL.ropeDark);
    }
  }
}

// src/game/world/stone.ts
function p1(x, X, Y, C) {
  x.fillStyle = C;
  x.fillRect(X, Y, 1, 1);
}
function dither(x, X, Y, W, H, C) {
  x.fillStyle = C;
  for (let j = 0;j < H; j++) {
    for (let i = 0;i < W; i++) {
      if (X + i + (Y + j) & 1)
        x.fillRect(X + i, Y + j, 1, 1);
    }
  }
}
var FLOOR_TONES = [
  [
    { b: "#72727e", d: "#666672", l: "#84848e" },
    { b: "#6a6a76", d: "#5e5e6a", l: "#7c7c88" },
    { b: "#666672", d: "#5a5a66", l: "#787884" },
    { b: "#6e6e7a", d: "#62626e", l: "#80808c" },
    { b: "#63636f", d: "#575763", l: "#757581" }
  ],
  [
    { b: "#54546a", d: "#48485c", l: "#64647c" },
    { b: "#4c4c62", d: "#404054", l: "#5c5c74" },
    { b: "#505068", d: "#44445a", l: "#60607a" },
    { b: "#46465c", d: "#3a3a50", l: "#56566e" },
    { b: "#4a4a60", d: "#3e3e54", l: "#5a5a72" }
  ]
];
var FLOOR_MORTAR = ["#50505c", "#3a3a48"];
var FLOOR_CRACK = ["#4a4a56", "#333344"];
var FLOOR_SEAM = ["#4c4c58", "#40404e"];
var FLOOR_SHADOW = ["#3e3e4a", "#33333f"];
var FLOOR_CANTO = ["#7c7c90", "#66667e"];
var FLOOR_CORNER = ["#383844", "#2c2c38"];
var WALL_TONES = [
  [
    { b: "#5c5c6e", d: "#4a4a5a", l: "#6e6e82" },
    { b: "#555566", d: "#444454", l: "#67677b" },
    { b: "#616173", d: "#4f4f60", l: "#737389" },
    { b: "#505060", d: "#40404e", l: "#626274" },
    { b: "#58586a", d: "#474758", l: "#6a6a7e" }
  ],
  [
    { b: "#4a4a5e", d: "#3a3a4c", l: "#5a5a72" },
    { b: "#46465a", d: "#36364a", l: "#56566e" },
    { b: "#4e4e64", d: "#3e3e52", l: "#5e5e78" },
    { b: "#424256", d: "#323244", l: "#52526a" },
    { b: "#48485c", d: "#38384a", l: "#585870" }
  ]
];
var WALL_MORTAR = ["#3c3c4a", "#2c2c3a"];
var RUNES = [
  [" # ", "# #", " # "],
  ["# #", " # ", "# #"],
  ["###", " # ", " # "]
];
var PILLAR = {
  normal: {
    capL: "#9c9cb0",
    cap: "#8a8a9c",
    shaft: "#7a7a8e",
    shaftL: "#9494a6",
    shaftD: "#5e5e6e",
    flute: "#585866",
    base: "#6e6e80",
    baseL: "#84849a",
    baseD: "#4e4e5c",
    shadow: "#46465a",
    ground: "#3a3a46"
  },
  crypt: {
    capL: "#8e8ea8",
    cap: "#7c7c94",
    shaft: "#6a6a84",
    shaftL: "#82829e",
    shaftD: "#4e4e64",
    flute: "#46465c",
    base: "#5e5e76",
    baseL: "#74748e",
    baseD: "#404054",
    shadow: "#3c3c50",
    ground: "#32323e"
  }
};
function floorBase(x, tx, ty, mapId) {
  const crypt = isCrypt(mapId);
  const tones = FLOOR_TONES[crypt ? 1 : 0];
  const mortar = FLOOR_MORTAR[crypt ? 1 : 0];
  const px0 = tx * 16, py0 = ty * 16;
  const mossC = crypt ? PAL.stoneMossCrypt : PAL.stoneMoss;
  const mossD = crypt ? "#33503f" : PAL.stoneMossDark;
  const mossDensity = mapId === "bosque" ? 0.2 : crypt ? 0.16 : 0.1;
  for (let ly = 0;ly < 16; ly++) {
    const gy = py0 + ly;
    const ry = Math.floor(gy / 16);
    const k = Math.floor(gy / 32);
    const merged = hash2(k, 313) > 0.72;
    const splitRow = !merged && hash2(ry, 211) > 0.62;
    let off, w, rowId, jointH;
    let nearTop, nearBot;
    if (merged) {
      off = Math.floor(hash2(k, 517) * 40);
      w = 24 + 12 * pick(hash2(k, 519), 3);
      rowId = 1000 + k;
      jointH = gy % 32 === 0;
      nearTop = gy % 32 === 1;
      nearBot = gy % 32 === 31;
    } else if (splitRow) {
      const half = (gy & 8) !== 0 ? 1 : 0;
      const mj = hash2(ry, 223) > 0.5;
      off = Math.floor(hash2(ry * 2 + half, 217) * 8);
      w = 8;
      rowId = ry * 2 + half;
      jointH = (gy & 15) === 0 || mj && (gy & 15) === 8;
      nearTop = mj ? (gy & 7) === 1 : (gy & 15) === 1;
      nearBot = mj ? (gy & 7) === 7 : (gy & 15) === 15;
    } else {
      off = Math.floor(hash2(ry, 71) * 24);
      w = 16 + 8 * pick(hash2(ry, 137), 3);
      rowId = ry;
      jointH = gy % 16 === 0;
      nearTop = gy % 16 === 1;
      nearBot = gy % 16 === 15;
    }
    for (let lx = 0;lx < 16; lx++) {
      const gx = px0 + lx;
      const u = gx + off;
      const si = Math.floor(u / w);
      const us = u - si * w;
      let c;
      if (jointH || us === 0) {
        c = mortar;
      } else {
        const slab = tones[pick(hash2(si * 7 + rowId * 131, rowId * 17 + si * 3), 5)];
        const n = hash2(gx, gy);
        const rounded = hash2(si * 5 + rowId * 9, rowId * 3 + si * 7) > 0.55;
        if (rounded && (us === 1 || us === w - 1) && (nearTop || nearBot)) {
          c = mortar;
        } else if (n > 0.94) {
          c = slab.l;
        } else if (n < 0.06) {
          c = slab.d;
        } else if ((us === 1 || nearTop) && hash2(gx + 31, gy + 17) > 0.5) {
          c = slab.l;
        } else {
          c = slab.b;
        }
      }
      p1(x, gx, gy, c);
    }
  }
  for (let ly = 0;ly < 16; ly++) {
    for (let lx = 0;lx < 16; lx++) {
      const gx = px0 + lx, gy = py0 + ly;
      const cell = hash2(Math.floor(gx / 5) + 977, Math.floor(gy / 5) + 331);
      if (cell < mossDensity && hash2(gx + 55, gy + 66) > 0.42) {
        p1(x, gx, gy, hash2(gx + 7, gy + 3) > 0.8 ? mossD : mossC);
      }
    }
  }
  if (hash2(tx * 3 + 11, ty * 5 + 7) > 0.62) {
    const crackC = FLOOR_CRACK[crypt ? 1 : 0];
    const startX = px0 + 2 + Math.floor(hash2(tx + 21, ty + 3) * 11);
    const startY = py0 + 2 + Math.floor(hash2(tx + 5, ty + 22) * 11);
    const horizFirst = hash2(tx + 9, ty + 23) > 0.5;
    const l1 = 3 + Math.floor(hash2(tx + 13, ty + 14) * 4);
    const l2 = 3 + Math.floor(hash2(tx + 15, ty + 16) * 4);
    const inTile = (X, Y) => X >= px0 && X < px0 + 16 && Y >= py0 && Y < py0 + 16;
    x.fillStyle = crackC;
    let cx = startX, cy = startY;
    for (let i = 0;i < l1 && inTile(cx, cy); i++) {
      x.fillRect(cx, cy, 1, 1);
      if (horizFirst)
        cx++;
      else
        cy++;
    }
    for (let i = 0;i < l2 && inTile(cx, cy); i++) {
      x.fillRect(cx, cy, 1, 1);
      if (horizFirst)
        cy++;
      else
        cx++;
    }
    let bx = startX, by = startY;
    for (let i = 0;i < 3 && inTile(bx, by); i++) {
      x.fillRect(bx, by, 1, 1);
      if (horizFirst)
        by--;
      else
        bx--;
    }
  }
  if (crypt && hash2(tx + 41, ty + 777) < 0.03) {
    const g = RUNES[pick(hash2(tx, ty + 12), 3)];
    const rx = px0 + 3 + Math.floor(hash2(tx + 1, ty + 2) * 8);
    const ryy = py0 + 3 + Math.floor(hash2(tx + 3, ty + 4) * 8);
    for (let j = 0;j < 3; j++) {
      for (let i = 0;i < 3; i++) {
        if (g[j][i] === "#")
          p1(x, rx + i, ryy + j, PAL.runeCrypt);
      }
    }
  }
}
function floorSeams(x, tx, ty, mapId, at) {
  if (!at)
    return;
  const crypt = isCrypt(mapId);
  const px0 = tx * 16, py0 = ty * 16;
  const shadow = FLOOR_SHADOW[crypt ? 1 : 0];
  const seam = FLOOR_SEAM[crypt ? 1 : 0];
  const canto = FLOOR_CANTO[crypt ? 1 : 0];
  const corner = FLOOR_CORNER[crypt ? 1 : 0];
  const up = at(0, -1), dn = at(0, 1), lf = at(-1, 0), rt = at(1, 0);
  if (up !== ":") {
    if (up === "#" || up === "P") {
      px(x, px0, py0, 16, 2, shadow);
      dither(x, px0, py0 + 2, 16, 1, shadow);
      if (up === "#")
        px(x, px0, py0 - 1, 16, 1, canto);
    } else {
      px(x, px0, py0, 16, 1, seam);
    }
  }
  if (lf !== ":")
    px(x, px0, py0, 1, 16, seam);
  if (rt !== ":")
    px(x, px0 + 15, py0, 1, 16, seam);
  if (dn !== ":")
    px(x, px0, py0 + 15, 16, 1, seam);
  if (up !== ":" && lf !== ":")
    p1(x, px0, py0, corner);
  if (up !== ":" && rt !== ":")
    p1(x, px0 + 15, py0, corner);
  if (dn !== ":" && lf !== ":")
    p1(x, px0, py0 + 15, corner);
  if (dn !== ":" && rt !== ":")
    p1(x, px0 + 15, py0 + 15, corner);
}
function paintWall(x, tx, ty, mapId, at) {
  const crypt = isCrypt(mapId);
  const tones = WALL_TONES[crypt ? 1 : 0];
  const mortar = WALL_MORTAR[crypt ? 1 : 0];
  const px0 = tx * 16, py0 = ty * 16;
  for (let ly = 0;ly < 16; ly++) {
    const gy = py0 + ly;
    const rowG = Math.floor(gy / 4);
    const ry4 = gy & 3;
    const off = Math.floor(hash2(rowG, 41) * 12);
    const w = 6 + pick(hash2(rowG, 23), 3);
    for (let lx = 0;lx < 16; lx++) {
      const gx = px0 + lx;
      const u = gx + off;
      const si = Math.floor(u / w);
      const us = u - si * w;
      const sh = hash2(si * 13 + rowG * 57, rowG * 29 + si * 3);
      let c;
      if (sh < 0.08) {
        c = (gx + gy & 1) === 0 ? "#32323e" : "#2a2a34";
      } else if (ry4 === 3 || us === 0) {
        c = mortar;
      } else {
        const tone = tones[pick(hash2(si * 17 + rowG * 3, rowG * 5 + si * 11), 5)];
        if (ry4 === 0 || us === 1) {
          c = tone.l;
        } else if (us === w - 1) {
          c = tone.d;
        } else {
          const n = hash2(gx, gy);
          c = n > 0.93 ? tone.l : n < 0.07 ? tone.d : tone.b;
        }
        if (sh > 0.3 && sh < 0.38 && ry4 >= 2 && hash2(gx + 77, gy + 13) > 0.6) {
          c = "#5a6a50";
        }
      }
      p1(x, gx, gy, c);
    }
  }
  if (at && at(0, -1) !== "#") {
    px(x, px0, py0, 16, 1, crypt ? "#5e5e76" : "#74748a");
  }
  if (!at || at(0, 1) !== "#") {
    const dens = crypt ? 0.22 : 0.45;
    for (let ly = 10;ly <= 14; ly++) {
      for (let lx = 0;lx < 16; lx++) {
        const gx = px0 + lx, gy = py0 + ly;
        const edge = (ly - 8) / 7;
        if (hash2(gx + 91, gy + 37) < dens * edge) {
          p1(x, gx, gy, hash2(gx, gy + 5) > 0.6 ? "#56654c" : "#46584a");
        }
      }
    }
  }
  if (crypt) {
    if (hash2(tx + 3, ty + 303) < 0.12) {
      const yl = py0 + 4 + Math.floor(hash2(tx + 8, ty + 9) * 6);
      px(x, px0, yl, 16, 1, "#34344a");
      px(x, px0, yl + 1, 16, 1, "#5c5c74");
    }
    if (hash2(tx + 5, ty + 601) < 0.05) {
      const nx = px0 + 4 + Math.floor(hash2(tx + 2, ty + 11) * 6);
      const ny = py0 + 3 + Math.floor(hash2(tx + 6, ty + 13) * 4);
      px(x, nx, ny, 5, 6, "#1e1e28");
      px(x, nx, ny, 5, 1, "#16161e");
      px(x, nx - 1, ny - 1, 7, 1, "#5e5e76");
      px(x, nx - 1, ny, 1, 6, "#333344");
      px(x, nx + 5, ny, 1, 6, "#56566e");
      p1(x, nx + 2, ny + 4, PAL.candleFlame);
      p1(x, nx + 2, ny + 5, PAL.candleWax);
    }
  }
}
var WOOD_TONES = [
  { b: "#8a6a44", d: "#7a5c3a", l: "#96764e" },
  { b: "#82643f", d: "#725635", l: "#8e7049" },
  { b: "#916f47", d: "#81613b", l: "#9d7b51" },
  { b: "#7c5e3c", d: "#6c5032", l: "#886a44" }
];
var WOOD_JOINT = "#5c442a";
var WOOD_GRAIN = "#6e5232";
var WOOD_KNOT = "#4e3a22";
var WOOD_NAIL = "#3a2a16";
function paintWood(x, tx, ty) {
  const px0 = tx * 16, py0 = ty * 16;
  for (let ly = 0;ly < 16; ly++) {
    const gy = py0 + ly;
    const prow = Math.floor(gy / 8);
    const inP = gy & 7;
    const tone = WOOD_TONES[pick(hash2(prow, 91), 4)];
    const butt = px0 + 2 + Math.floor(hash2(prow, 57) * 12);
    const hasKnot = hash2(prow, 71) > 0.72;
    const knotX = px0 + 3 + Math.floor(hash2(prow + 3, 17) * 10);
    for (let lx = 0;lx < 16; lx++) {
      const gx = px0 + lx;
      let c;
      if (inP === 7) {
        c = WOOD_JOINT;
      } else if (gx === butt) {
        c = WOOD_JOINT;
      } else if (inP === 0) {
        c = tone.l;
      } else {
        const seg = Math.floor(gx / 4);
        const grainY1 = 2 + (hash2(seg, prow * 13 + 1) > 0.5 ? 1 : 0);
        const hasG2 = hash2(prow, 33) > 0.5;
        const grainY2 = 5 + (hash2(seg, prow * 17 + 2) > 0.5 ? 1 : 0);
        if (inP === grainY1) {
          c = WOOD_GRAIN;
        } else if (hasG2 && inP === grainY2) {
          c = WOOD_GRAIN;
        } else if (hasKnot && gx >= knotX && gx < knotX + 2 && (inP === 3 || inP === 4)) {
          c = WOOD_KNOT;
        } else if (hasKnot && gx === knotX - 1 && inP === 2) {
          c = tone.d;
        } else {
          const n = hash2(gx, gy);
          c = n > 0.93 ? tone.l : n < 0.07 ? tone.d : tone.b;
        }
      }
      if (inP === 1 && (gx === butt - 1 || gx === butt + 1))
        c = WOOD_NAIL;
      p1(x, gx, gy, c);
    }
  }
}
function paintPillar(x, tx, ty, mapId, at) {
  const P = isCrypt(mapId) ? PILLAR.crypt : PILLAR.normal;
  const px0 = tx * 16, py0 = ty * 16;
  floorBase(x, tx, ty, mapId);
  floorSeams(x, tx, ty, mapId, at);
  px(x, px0 + 2, py0 + 12, 12, 1, P.shadow);
  px(x, px0 + 0, py0 + 13, 16, 1, P.shadow);
  px(x, px0 + 0, py0 + 14, 16, 1, P.shadow);
  dither(x, px0 + 1, py0 + 15, 14, 1, P.ground);
  px(x, px0, py0 - 8, 16, 2, P.cap);
  px(x, px0, py0 - 8, 16, 1, P.capL);
  px(x, px0 + 1, py0 - 6, 14, 2, P.cap);
  px(x, px0 + 1, py0 - 6, 14, 1, P.capL);
  px(x, px0 + 3, py0 - 4, 10, 1, P.shaftD);
  px(x, px0 + 3, py0 - 3, 10, 12, P.shaft);
  px(x, px0 + 3, py0 - 3, 2, 12, P.shaftL);
  px(x, px0 + 11, py0 - 3, 2, 12, P.shaftD);
  for (const fx of [px0 + 6, px0 + 9]) {
    for (let j = 0;j < 12; j++) {
      if (hash2(fx * 3 + j, ty * 7 + 5) > 0.18)
        p1(x, fx, py0 - 3 + j, P.flute);
    }
  }
  if (hash2(tx + 7, ty + 41) > 0.55) {
    const fx = px0 + 4 + Math.floor(hash2(tx + 4, ty + 2) * 6);
    const fy = py0 - 2 + Math.floor(hash2(tx + 3, ty + 9) * 7);
    p1(x, fx, fy, P.shaftD);
    p1(x, fx, fy + 1, P.shaftD);
    p1(x, fx + 1, fy + 2, P.shaftD);
  }
  px(x, px0 + 2, py0 + 9, 12, 2, P.base);
  px(x, px0 + 2, py0 + 9, 12, 1, P.baseL);
  px(x, px0 + 1, py0 + 11, 14, 4, P.base);
  px(x, px0 + 1, py0 + 11, 14, 1, P.baseL);
  px(x, px0 + 1, py0 + 14, 14, 1, P.baseD);
  px(x, px0 + 1, py0 + 15, 14, 1, P.ground);
  dither(x, px0 + 0, py0 + 15, 1, 1, P.ground);
  dither(x, px0 + 15, py0 + 15, 1, 1, P.ground);
}
function paintAltar(x, tx, ty, mapId, at) {
  const px0 = tx * 16, py0 = ty * 16;
  floorBase(x, tx, ty, mapId);
  floorSeams(x, tx, ty, mapId, at);
  px(x, px0 + 2, py0 + 14, 12, 1, "#3a3a46");
  dither(x, px0 + 2, py0 + 15, 12, 1, "#3a3a46");
  px(x, px0 + 3, py0 + 5, 10, 9, "#4c4c5a");
  px(x, px0 + 3, py0 + 5, 2, 9, "#565664");
  px(x, px0 + 9, py0 + 5, 2, 9, "#3e3e4c");
  px(x, px0 + 2, py0 + 2, 12, 3, "#6a6a7c");
  px(x, px0 + 2, py0 + 2, 12, 1, "#84848e");
  px(x, px0 + 2, py0 + 4, 12, 1, "#48485a");
  px(x, px0 + 5, py0 + 9, 1, 3, PAL.gold);
  px(x, px0 + 7, py0 + 7, 1, 5, PAL.gold);
  px(x, px0 + 9, py0 + 8, 1, 4, PAL.gold);
  p1(x, px0 + 5, py0 + 12, "#8a6f22");
  p1(x, px0 + 7, py0 + 12, "#8a6f22");
  p1(x, px0 + 9, py0 + 12, "#8a6f22");
  dither(x, px0 + 4, py0 + 14, 8, 1, "#c9c2ae");
  p1(x, px0 + 5, py0 + 15, "#c9c2ae");
  p1(x, px0 + 8, py0 + 15, "#c9c2ae");
  p1(x, px0 + 10, py0 + 15, "#c9c2ae");
}
function paintVoid(x, tx, ty) {
  const px0 = tx * 16, py0 = ty * 16;
  px(x, px0, py0, 16, 16, PAL.void0);
  for (let ly = 0;ly < 16; ly++) {
    for (let lx = 0;lx < 16; lx++) {
      const n = hash2(px0 + lx, py0 + ly);
      if (n > 0.985)
        p1(x, px0 + lx, py0 + ly, "#3a3454");
      else if (n > 0.94)
        p1(x, px0 + lx, py0 + ly, "#221c30");
    }
  }
  if (hash2(tx + 3, ty + 888) < 0.1) {
    const bx = px0 + 2 + Math.floor(hash2(tx + 1, ty + 4) * 10);
    const by = py0 + 2 + Math.floor(hash2(tx + 2, ty + 5) * 11);
    px(x, bx, by, 3, 2, "#130f1f");
    dither(x, bx - 1, by, 1, 2, "#130f1f");
    dither(x, bx + 3, by, 1, 2, "#130f1f");
    dither(x, bx, by - 1, 3, 1, "#130f1f");
    dither(x, bx, by + 2, 3, 1, "#130f1f");
  }
}
function paintStone(x, ch, tx, ty, mapId, t, at) {
  switch (ch) {
    case ":":
      floorBase(x, tx, ty, mapId);
      floorSeams(x, tx, ty, mapId, at);
      break;
    case "_":
      paintWood(x, tx, ty);
      break;
    case "#":
      paintWall(x, tx, ty, mapId, at);
      break;
    case "P":
      paintPillar(x, tx, ty, mapId, at);
      break;
    case "A":
      paintAltar(x, tx, ty, mapId, at);
      break;
    case "V":
      paintVoid(x, tx, ty);
      break;
  }
}

// src/game/world/village.ts
var isWallCh = (c) => c === "H" || c === "d";
var isStoneCh = (c) => c === ":" || c === "_" || c === "#" || c === "P" || c === "A";
function dropShadow(x, X, Y, W) {
  px(x, X, Y, W, 1, PAL.objShadow);
  px(x, X + 1, Y + 1, W - 2, 1, PAL.objShadow);
}
function grassBase(x, tx, ty, mapId) {
  const X = tx * 16, Y = ty * 16;
  const bosque = isForest(mapId);
  const g0 = bosque ? "#3f6d3a" : "#4f8a46";
  const g1 = bosque ? "#396334" : "#467c3e";
  px(x, X, Y, 16, 16, hash2(tx, ty) < 0.5 ? g0 : g1);
  for (let i = 0;i < 3; i++) {
    const hx = hash2(tx * 4 + i + 9, ty * 7 + i + 2);
    if (hx < 0.4) {
      px(x, X + Math.floor(hx * 14), Y + 2 + Math.floor(hash2(tx + i * 3, ty * 5 + i) * 12), 1, 2, bosque ? PAL.grassBladeBosque : PAL.grassBlade);
    }
  }
}
function stoneBase(x, tx, ty) {
  const X = tx * 16, Y = ty * 16;
  px(x, X, Y, 16, 16, PAL.stone);
  px(x, X, Y, 16, 1, PAL.stoneLight);
  if (hash2(tx, ty) > 0.7)
    px(x, X + 3, Y + 9, 7, 1, PAL.stoneDark);
  px(x, X, Y, 16, 1, PAL.stoneLine);
  px(x, X, Y, 1, 16, PAL.stoneLine);
}
function groundBase(x, tx, ty, mapId, nb) {
  const stone = isStoneCh(nb(-1, 0)) || isStoneCh(nb(1, 0)) || isStoneCh(nb(0, -1)) || isStoneCh(nb(0, 1));
  if (stone)
    stoneBase(x, tx, ty);
  else
    grassBase(x, tx, ty, mapId);
}
function paintRoof(x, tx, ty, nb) {
  const X = tx * 16, Y = ty * 16;
  const contL = nb(-1, 0) === "r", contR = nb(1, 0) === "r";
  px(x, X, Y, 16, 16, PAL.roofDark);
  for (let j = 0;j < 4; j++) {
    const ry = Y + j * 4;
    const off = j % 2 * 2;
    for (let k = -1;k <= 4; k++) {
      const bx = X + off + k * 4;
      if (bx > X + 15 || bx + 3 < X)
        continue;
      const c0 = Math.max(bx, X), c1 = Math.min(bx + 3, X + 15);
      const v = hash2(tx * 4 + k + 31, ty * 4 + j + 7);
      px(x, c0, ry, c1 - c0 + 1, 3, v < 0.28 ? PAL.roofMid : v < 0.78 ? PAL.roof : "#b0583f");
      if (v > 0.86)
        px(x, c0, ry, 1, 1, PAL.roofLight);
    }
  }
  const mv = hash2(tx * 5 + 2, ty * 7 + 1);
  if (mv < 0.12) {
    const mx = X + 2 + Math.floor(hash2(tx + 3, ty * 3) * 10);
    const my = Y + 4 + Math.floor(hash2(tx * 3, ty + 5) * 8);
    px(x, mx, my, 3, 2, PAL.mossTile);
    px(x, mx + 1, my - 1, 2, 1, PAL.mossTile);
  } else if (mv < 0.2) {
    const mx = X + 3 + Math.floor(hash2(tx + 3, ty * 3) * 9);
    const my = Y + 5 + Math.floor(hash2(tx * 3, ty + 5) * 7);
    px(x, mx, my, 3, 2, PAL.brokenTile);
    px(x, mx + 2, my + 2, 1, 1, PAL.brokenTile);
  }
  if (nb(0, -1) !== "r") {
    px(x, X, Y, 16, 1, PAL.ridgeHi);
    px(x, X, Y + 1, 16, 1, PAL.ridge);
  }
  if (!contL) {
    px(x, X, Y, 1, 16, PAL.brokenTile);
    px(x, X + 1, Y, 1, 16, PAL.roofDark);
  }
  if (!contR) {
    px(x, X + 15, Y, 1, 16, PAL.brokenTile);
    px(x, X + 14, Y, 1, 16, PAL.roofDark);
  }
  px(x, X, Y + 15, 16, 1, PAL.brokenTile);
  const up = nb(0, -1);
  const upFree = up === "." || up === "," || up === "=" || up === "c" || up === "m";
  if (hash2(tx * 13 + 5, ty * 17 + 3) < 0.15 && upFree) {
    const cx = X + 4 + Math.floor(hash2(tx * 7 + 1, ty * 3 + 2) * 7);
    px(x, cx - 1, Y - 6, 7, 1, PAL.chimneyHi);
    px(x, cx, Y - 5, 5, 6, PAL.chimney);
    px(x, cx, Y - 5, 1, 6, PAL.chimneyHi);
    px(x, cx + 4, Y - 5, 1, 6, PAL.chimneyDark);
    px(x, cx + 1, Y - 5, 3, 2, PAL.chimneyMouth);
  }
}
function wallBase(x, tx, ty, nb) {
  const X = tx * 16, Y = ty * 16;
  px(x, X, Y, 16, 16, PAL.wall);
  for (let i = 0;i < 6; i++) {
    const hx = hash2(tx * 6 + i * 3 + 1, ty * 8 + i + 4);
    const hy = hash2(tx * 9 + i + 2, ty * 5 + i * 3 + 6);
    px(x, X + 1 + Math.floor(hx * 14), Y + 2 + Math.floor(hy * 10), 1, 1, hx < 0.5 ? PAL.wallDirt : PAL.wallHi);
  }
  if (nb(0, -1) === "r") {
    px(x, X, Y, 16, 3, PAL.objShadow);
    px(x, X, Y + 3, 16, 1, "rgba(0,0,0,0.12)");
  }
  px(x, X, Y + 13, 16, 3, PAL.plinth);
  px(x, X, Y + 13, 16, 1, PAL.plinthHi);
  px(x, X, Y + 15, 16, 1, PAL.plinthDark);
  px(x, X + 2 + Math.floor(hash2(tx * 3 + 5, ty + 9) * 11), Y + 14, 1, 2, PAL.plinthDark);
  px(x, X + 2 + Math.floor(hash2(tx * 7 + 3, ty + 4) * 11), Y + 14, 1, 2, PAL.plinthDark);
  if (!isWallCh(nb(-1, 0))) {
    px(x, X, Y, 3, 16, PAL.beam);
    px(x, X + 1, Y, 1, 16, PAL.beamHi);
  }
  if (!isWallCh(nb(1, 0))) {
    px(x, X + 13, Y, 3, 16, PAL.beam);
    px(x, X + 13, Y, 1, 16, PAL.beamHi);
  }
}
function paintWindowIfAny(x, tx, ty, nb) {
  const chOf = (ax) => nb(ax - tx, 0);
  const q = (ax) => hash2(ax * 9 + 1, ty * 13 + 7) < 0.34;
  let lx = tx, rx = tx;
  while (chOf(lx - 1) === "H")
    lx--;
  while (chOf(rx + 1) === "H")
    rx++;
  const winAt = (ax) => chOf(ax) === "H" && q(ax) && !(chOf(ax - 1) === "H" && q(ax - 1));
  let count = 0;
  for (let ax = lx;ax <= rx; ax++)
    if (winAt(ax))
      count++;
  const mine = count > 0 ? winAt(tx) : chOf(tx - 1) === "d";
  if (!mine)
    return;
  const wx = tx * 16 + 4, wy = ty * 16 + 4;
  px(x, wx, wy, 8, 8, PAL.winFrame);
  px(x, wx + 1, wy + 1, 6, 6, PAL.glass);
  px(x, wx + 1, wy + 6, 6, 1, PAL.glassDark);
  px(x, wx + 3, wy + 1, 1, 1, PAL.glassHi);
  px(x, wx + 2, wy + 2, 1, 1, PAL.glassHi);
  px(x, wx + 1, wy + 3, 1, 1, PAL.glassHi);
  px(x, wx + 2, wy + 1, 1, 1, "#e6f2fa");
  px(x, wx + 4, wy + 1, 1, 6, PAL.winFrame);
  px(x, wx + 1, wy + 4, 6, 1, PAL.winFrame);
  px(x, wx - 1, wy + 8, 10, 1, PAL.plinthHi);
}
function paintDoor(x, tx, ty, nb) {
  const X = tx * 16, Y = ty * 16;
  wallBase(x, tx, ty, nb);
  px(x, X + 2, Y + 2, 12, 2, PAL.step);
  px(x, X + 2, Y + 2, 12, 1, PAL.plinthHi);
  px(x, X + 2, Y + 4, 12, 1, PAL.stepDark);
  px(x, X + 2, Y + 5, 1, 8, PAL.stepDark);
  px(x, X + 13, Y + 5, 1, 8, PAL.stepDark);
  px(x, X + 3, Y + 5, 10, 8, PAL.doorMid);
  px(x, X + 3, Y + 5, 10, 1, PAL.door);
  px(x, X + 6, Y + 6, 1, 7, PAL.door);
  px(x, X + 10, Y + 6, 1, 7, PAL.door);
  px(x, X + 12, Y + 5, 1, 8, PAL.door);
  px(x, X + 4, Y + 8, 2, 1, "#8a6038");
  px(x, X + 7, Y + 10, 2, 1, "#8a6038");
  px(x, X + 3, Y + 6, 3, 1, PAL.iron);
  px(x, X + 3, Y + 10, 3, 1, PAL.iron);
  px(x, X + 6, Y + 6, 1, 1, "#8a8a96");
  px(x, X + 6, Y + 10, 1, 1, "#8a8a96");
  px(x, X + 10, Y + 8, 2, 2, PAL.gold);
  px(x, X + 10, Y + 8, 1, 1, "#fff0b0");
  px(x, X + 2, Y + 13, 12, 3, PAL.step);
  px(x, X + 2, Y + 13, 12, 1, PAL.plinthHi);
  px(x, X + 2, Y + 15, 12, 1, PAL.stepDark);
  if (hash2(tx * 19 + 2, ty * 23 + 4) < 0.45) {
    px(x, X + 1, Y + 4, 2, 1, PAL.iron);
    px(x, X + 1, Y + 5, 2, 1, PAL.iron);
    px(x, X + 1, Y + 6, 2, 3, PAL.lanternOff);
    px(x, X + 1, Y + 7, 2, 1, PAL.lanternGlass);
    px(x, X + 1, Y + 9, 2, 1, PAL.iron);
  }
}
function paintFence(x, tx, ty, nb, mapId) {
  const X = tx * 16, Y = ty * 16;
  grassBase(x, tx, ty, mapId);
  const hL = nb(-1, 0) === "F", hR = nb(1, 0) === "F";
  const vU = nb(0, -1) === "F", vD = nb(0, 1) === "F";
  const q = hash2(tx * 3 + 7, ty * 5 + 11);
  if (vU || vD) {
    const pT = vU ? Y : Y + 2;
    const pB = vD ? Y + 16 : Y + 13;
    for (const cx of [5, 10]) {
      px(x, X + cx, pT, 2, pB - pT, PAL.woodMid);
      px(x, X + cx, pT, 1, pB - pT, PAL.woodLight);
    }
  }
  if (hL || hR) {
    const x0 = hL ? X : X + 6;
    const x1 = hR ? X + 16 : X + 10;
    for (const ry of [4, 10]) {
      px(x, x0, Y + ry, x1 - x0, 2, PAL.wood);
      px(x, x0, Y + ry + 2, x1 - x0, 1, PAL.woodDark);
      px(x, x0 + Math.floor(hash2(tx + ry, ty * 3) * 6), Y + ry, 3, 1, PAL.woodLight);
    }
    if (q > 0.9) {
      const gx = X + 4 + Math.floor(hash2(tx * 5, ty + 2) * 6);
      px(x, gx, Y + 4, 3, 3, hash2(tx, ty) < 0.5 ? "#4f8a46" : "#467c3e");
    }
  }
  const ps = q > 0.82 ? 1 : 0;
  const top = q > 0.82 ? Y + 4 : Y + 2;
  const h = Y + 13 - top;
  px(x, X + 6 + ps, top, 3, h, "#9a7848");
  px(x, X + 6 + ps, top, 1, h, PAL.woodLight);
  px(x, X + 8 + ps, top, 1, h, PAL.woodDark);
  if (q <= 0.82) {
    px(x, X + 5 + ps, Y + 1, 5, 1, PAL.woodLight);
    px(x, X + 6 + ps, Y, 3, 1, "#c8a878");
  }
  px(x, X + 5 + ps, Y + 13, 5, 1, PAL.woodDark);
  dropShadow(x, X + 7, Y + 14, 4);
}
function paintWell(x, tx, ty, mapId) {
  const X = tx * 16, Y = ty * 16;
  grassBase(x, tx, ty, mapId);
  dropShadow(x, X + 3, Y + 14, 11);
  px(x, X + 3, Y - 6, 2, 10, PAL.woodMid);
  px(x, X + 3, Y - 6, 1, 10, PAL.woodLight);
  px(x, X + 11, Y - 6, 2, 10, PAL.woodMid);
  px(x, X + 11, Y - 6, 1, 10, PAL.woodLight);
  px(x, X + 2, Y - 8, 12, 2, PAL.wood);
  px(x, X + 2, Y - 7, 12, 1, PAL.woodDark);
  px(x, X + 6, Y - 7, 3, 3, PAL.winFrame);
  px(x, X + 7, Y - 6, 1, 1, "#20180f");
  px(x, X + 7, Y - 4, 1, 6, PAL.rope);
  px(x, X + 6, Y + 2, 4, 1, PAL.woodDark);
  px(x, X + 6, Y + 3, 4, 2, PAL.woodMid);
  px(x, X + 6, Y + 4, 4, 1, PAL.iron);
  const ring = [
    [4, 5, 10],
    [5, 3, 12],
    [6, 2, 13],
    [7, 2, 13],
    [8, 2, 13],
    [9, 2, 13],
    [10, 2, 13],
    [11, 2, 13],
    [12, 2, 13],
    [13, 2, 13],
    [14, 3, 12],
    [15, 5, 10]
  ];
  for (const [ry, a, b] of ring) {
    const col = ry <= 5 ? PAL.stoneHi : ry >= 14 ? PAL.stoneDark : PAL.stoneLight;
    px(x, X + a, Y + ry, b - a + 1, 1, col);
  }
  px(x, X + 2, Y + 6, 1, 7, PAL.stoneHi);
  px(x, X + 13, Y + 6, 1, 7, PAL.stoneDark);
  px(x, X + 5, Y + 13, 1, 1, PAL.stoneDark);
  px(x, X + 11, Y + 14, 1, 1, PAL.stoneDark);
  px(x, X + 4, Y + 7, 1, 1, PAL.stoneLight);
  const hole = [
    [6, 5, 10],
    [7, 4, 11],
    [8, 4, 11],
    [9, 4, 11],
    [10, 4, 11],
    [11, 4, 11],
    [12, 4, 11],
    [13, 5, 10]
  ];
  for (const [ry, a, b] of hole)
    px(x, X + a, Y + ry, b - a + 1, 1, PAL.wellDeep);
  px(x, X + 5, Y + 9, 6, 1, PAL.wellWater);
  px(x, X + 6, Y + 10, 4, 1, "#38a8b8");
  px(x, X + 2, Y + 14, 1, 2, PAL.grassBlade);
  px(x, X + 13, Y + 13, 1, 2, PAL.mossTile);
  px(x, X + 1, Y + 13, 1, 1, PAL.grassBlade);
}
function paintGrave(x, tx, ty, nb, mapId) {
  const X = tx * 16, Y = ty * 16;
  groundBase(x, tx, ty, mapId, nb);
  dropShadow(x, X + 4, Y + 13, 10);
  const v = hash2(tx * 11 + 1, ty * 7 + 9);
  if (v < 0.34) {
    px(x, X + 6, Y + 5, 4, 1, PAL.stoneHi);
    px(x, X + 5, Y + 6, 6, 1, PAL.stoneHi);
    px(x, X + 4, Y + 7, 8, 6, PAL.stoneLight);
    px(x, X + 4, Y + 7, 1, 6, PAL.stoneHi);
    px(x, X + 11, Y + 7, 1, 6, PAL.stoneDark);
    px(x, X + 4, Y + 13, 8, 1, PAL.stoneDark);
    px(x, X + 6, Y + 9, 4, 1, PAL.stoneDark);
    px(x, X + 6, Y + 11, 3, 1, PAL.stoneDark);
  } else if (v < 0.67) {
    px(x, X + 7, Y + 4, 2, 1, PAL.stoneHi);
    px(x, X + 6, Y + 5, 4, 1, PAL.stoneHi);
    px(x, X + 5, Y + 6, 6, 7, PAL.stoneLight);
    px(x, X + 5, Y + 6, 1, 7, PAL.stoneHi);
    px(x, X + 10, Y + 6, 1, 7, PAL.stoneDark);
    px(x, X + 5, Y + 13, 6, 1, PAL.stoneDark);
    px(x, X + 7, Y + 8, 1, 4, PAL.stoneDark);
  } else {
    px(x, X + 7, Y + 3, 2, 5, PAL.stoneLight);
    px(x, X + 7, Y + 3, 2, 1, PAL.stoneHi);
    px(x, X + 5, Y + 4, 6, 2, PAL.stoneLight);
    px(x, X + 4, Y + 7, 8, 6, PAL.stoneLight);
    px(x, X + 4, Y + 7, 8, 1, PAL.stoneHi);
    px(x, X + 4, Y + 7, 1, 6, PAL.stoneHi);
    px(x, X + 11, Y + 7, 1, 6, PAL.stoneDark);
    px(x, X + 4, Y + 12, 8, 1, PAL.stoneDark);
    px(x, X + 7, Y + 9, 1, 3, PAL.stoneDark);
    px(x, X + 6, Y + 10, 3, 1, PAL.stoneDark);
  }
  px(x, X + 3, Y + 12, 1, 2, PAL.grassBlade);
  px(x, X + 12, Y + 13, 1, 2, PAL.mossTile);
  px(x, X + 11, Y + 12, 1, 1, PAL.grassBlade);
}
function paintRock(x, tx, ty, nb, mapId) {
  const X = tx * 16, Y = ty * 16;
  groundBase(x, tx, ty, mapId, nb);
  const eL = nb(-1, 0) === "R", eR = nb(1, 0) === "R";
  const eU = nb(0, -1) === "R", eD = nb(0, 1) === "R";
  if (!eD)
    dropShadow(x, X + 3, Y + 14, 11);
  const L = eL ? 0 : 3, R = eR ? 15 : 13;
  const T2 = eU ? 0 : 5, B = eD ? 15 : 14;
  const w = R - L + 1;
  const v = hash2(tx * 17 + 3, ty * 13 + 1);
  if (v < 0.34) {
    px(x, X + L, Y + T2, w, B - T2 + 1, PAL.stoneLight);
    if (!eU) {
      px(x, X + L + (eL ? 0 : 1), Y + T2, w - (eL ? 0 : 1) - (eR ? 0 : 1), 1, PAL.stoneHi);
      px(x, X + L + 2, Y + T2 + 1, 3, 1, PAL.moss);
      px(x, X + L + 1, Y + T2 + 2, 2, 1, PAL.moss);
    }
    if (!eL)
      px(x, X + L, Y + T2 + 1, 1, B - T2, PAL.stoneHi);
    if (!eR)
      px(x, X + R, Y + T2 + 1, 1, B - T2, PAL.stoneDark);
    if (!eD)
      px(x, X + L, Y + B, w, 1, PAL.stoneDark);
    px(x, X + L + 2, Y + T2 + 3, 3, 3, PAL.stoneHi);
    px(x, X + R - 4, Y + B - 4, 4, 3, PAL.stoneDark);
    px(x, X + 8, Y + T2 + 3, 1, 2, PAL.stoneVein);
    px(x, X + 9, Y + T2 + 5, 1, 2, PAL.stoneVein);
    px(x, X + 7, Y + T2 + 7, 1, 2, PAL.stoneVein);
  } else if (v < 0.67) {
    const t0 = eL ? L : L + 4, t1 = eR ? R : R - 4;
    const ts = Math.max(T2, B - 10);
    px(x, X + t0, Y + ts, t1 - t0 + 1, B - 8 - ts + 1, PAL.stoneLight);
    px(x, X + t0, Y + ts, t1 - t0 + 1, 1, PAL.stoneHi);
    if (!eU)
      px(x, X + t0 + 1, Y + ts, 2, 1, PAL.moss);
    const m0 = eL ? L : L + 2, m1 = eR ? R : R - 1;
    px(x, X + m0, Y + B - 7, m1 - m0 + 1, 3, PAL.stoneLight);
    px(x, X + m0, Y + B - 7, m1 - m0 + 1, 1, PAL.stoneHi);
    px(x, X + m0, Y + B - 5, m1 - m0 + 1, 1, PAL.stoneDark);
    px(x, X + L, Y + B - 3, w, 3, PAL.stoneLight);
    px(x, X + L, Y + B - 3, w, 1, PAL.stoneHi);
    px(x, X + L, Y + B - 1, w, 1, PAL.stoneDark);
    px(x, X + m0 + 2, Y + B - 6, 1, 1, PAL.stoneVein);
  } else {
    const sy = eD ? B - 3 : Math.max(T2, B - 5);
    px(x, X + L, Y + sy, w, 2, PAL.stoneHi);
    px(x, X + L, Y + sy + 2, w, Math.max(1, B - sy - 2), PAL.stoneLight);
    px(x, X + L, Y + B, w, 1, PAL.stoneDark);
    px(x, X + L + 4, Y + sy, 1, 2, PAL.stoneVein);
    if (!eU)
      px(x, X + L + (eL ? 1 : 3), Y + sy, 3, 1, PAL.mossTile);
  }
}
function paintVillage(x, ch, tx, ty, mapId, t, at) {
  const nb = at ?? (() => "?");
  switch (ch) {
    case "H":
      wallBase(x, tx, ty, nb);
      paintWindowIfAny(x, tx, ty, nb);
      return;
    case "r":
      paintRoof(x, tx, ty, nb);
      return;
    case "d":
      paintDoor(x, tx, ty, nb);
      return;
    case "F":
      paintFence(x, tx, ty, nb, mapId);
      return;
    case "w":
      paintWell(x, tx, ty, mapId);
      return;
    case "g":
      paintGrave(x, tx, ty, nb, mapId);
      return;
    case "R":
      paintRock(x, tx, ty, nb, mapId);
      return;
  }
}

// src/game/world/trees.ts
var isTree = (ch) => ch === "t" || ch === "p";
function lobe(x, cx, cy, rx, ry, col, seed, bite = 0, padL = 0, padR = 0) {
  x.fillStyle = col;
  for (let dy = -ry;dy <= ry; dy++) {
    const k = dy / ry;
    const core = Math.sqrt(Math.max(0, 1 - k * k)) * rx;
    const jA = hash2(seed * 131 + dy * 7, 17);
    const jB = hash2(seed * 173 + dy * 5, 29);
    let hl = Math.max(1, Math.round(core * (0.76 + jA * 0.4))) + padL;
    let hr = Math.max(1, Math.round(core * (0.76 + jB * 0.4))) + padR;
    if (jA < 0.1 + bite)
      hl = Math.max(0, hl - 2);
    else if (jA > 0.88)
      hl += 1;
    if (jB < 0.1 + bite)
      hr = Math.max(0, hr - 2);
    else if (jB > 0.88)
      hr += 1;
    if (hl + hr > 0)
      x.fillRect(cx - hl, cy + dy, hl + hr, 1);
  }
}
function groundShadow(x, cx, cy) {
  x.fillStyle = "rgba(0,0,0,0.28)";
  x.beginPath();
  x.ellipse(cx - 2, cy, 7, 2.5, 0, 0, Math.PI * 2);
  x.fill();
}
function pathShade(x, px0, py0, nb, r) {
  const w = 2 + (r > 0.5 ? 1 : 0);
  const col = `rgba(0,0,0,${(0.16 + r * 0.06).toFixed(2)})`;
  if (nb(1, 0) === "=")
    px(x, px0 + 16, py0 + 3, w, 11, col);
  if (nb(-1, 0) === "=")
    px(x, px0 - w, py0 + 3, w, 11, col);
  if (nb(0, -1) === "=")
    px(x, px0 + 2, py0 - w, 12, w, col);
  if (nb(0, 1) === "=")
    px(x, px0 + 2, py0 + 16, 12, w, col);
}
function trunkCoposo(x, cx, py0, topY, bend, shortBase) {
  const baseY = shortBase ? py0 + 9 : py0 + 14;
  for (let y = topY;y < baseY; y += 3) {
    const h = Math.min(3, baseY - y);
    const t = (y + h - topY) / Math.max(1, baseY - topY);
    const off = Math.round(Math.sin(t * Math.PI) * bend);
    px(x, cx + off - 1, y, 3, h, PAL.trunkMid);
    px(x, cx + off + 1, y, 1, h, PAL.trunkDeep);
    if (t < 0.55)
      px(x, cx + off - 1, y, 1, h, PAL.trunkHi);
  }
  px(x, cx - 3, baseY - 3, 7, 3, PAL.trunkMid);
  px(x, cx - 3, baseY - 1, 7, 1, PAL.trunkDeep);
  if (!shortBase) {
    px(x, cx - 5, baseY - 2, 2, 2, PAL.trunkMid);
    px(x, cx + 4, baseY - 2, 2, 2, PAL.trunkMid);
    px(x, cx - 6, baseY - 1, 2, 1, PAL.rootSoil);
    px(x, cx + 5, baseY - 1, 2, 1, PAL.rootSoil);
  } else {
    px(x, cx - 4, baseY - 1, 2, 1, PAL.rootSoil);
    px(x, cx + 3, baseY - 1, 2, 1, PAL.rootSoil);
  }
}
function trunkPine(x, cx, py0, contTop) {
  const topY = Math.min(py0 + 4, contTop);
  px(x, cx - 1, topY, 2, py0 + 14 - topY, PAL.trunkDeep);
  px(x, cx - 2, py0 + 5, 1, 7, PAL.trunkMid);
  px(x, cx - 3, py0 + 12, 6, 2, PAL.trunkDeep);
  px(x, cx - 5, py0 + 13, 2, 1, PAL.rootSoil);
  px(x, cx + 4, py0 + 13, 2, 1, PAL.rootSoil);
}
function pineCone(x, cx, py0, reach, maxHw, fe, seed, padL, padR, wide) {
  const topY = py0 - reach;
  const botY = py0 + 3;
  const H = botY - topY;
  const hwAt = (y) => {
    const t = (y - topY) / H;
    let hw = Math.max(1, Math.round(1 + (maxHw - 1) * Math.pow(t, 0.85)));
    if (y % fe === 0 && y < botY - 1)
      hw -= wide ? 2 : 1;
    if (wide && y >= botY - 1)
      hw += 1;
    return hw;
  };
  x.fillStyle = PAL.pineDark;
  for (let y = topY;y <= botY; y++) {
    const hw = hwAt(y);
    const jL = hash2(seed * 31 + y, 41);
    const jR = hash2(seed * 47 + y, 43);
    const hl = Math.max(0, hw + padL + (jL < 0.3 ? 1 : 0) - (jL > 0.8 ? 1 : 0));
    const hr = Math.max(0, hw + padR + (jR < 0.3 ? 1 : 0) - (jR > 0.8 ? 1 : 0));
    if (hl + hr > 0)
      x.fillRect(cx - hl, y, hl + hr, 1);
  }
  x.fillStyle = PAL.pineMid;
  for (let y = topY + 2;y <= botY - 1; y++) {
    const hw = Math.max(1, Math.round(hwAt(y) * 0.45));
    x.fillRect(cx - hw, y, hw * 2, 1);
  }
  for (let y = topY + 2;y < botY - 2; y += fe) {
    const j = hash2(seed * 91 + y, 61);
    if (j < 0.85)
      px(x, cx - hwAt(y) - (j < 0.4 ? 1 : 0), y, 2, 1, PAL.pineLight);
    if (j > 0.72)
      px(x, cx + hwAt(y + 1) - 1, y + 1, 1, 1, PAL.pineLight);
  }
}
function paintCoposo(x, tx, ty, mapId, nb) {
  const px0 = tx * 16, py0 = ty * 16;
  const forest = isForest(mapId);
  const s = tx * 3 + 1, s2 = ty * 5 + 7;
  const nUp = nb(0, -1), nDown = nb(0, 1), nL = nb(-1, 0), nR = nb(1, 0);
  const tUp = isTree(nUp), tDown = isTree(nDown), tL = isTree(nL), tR = isTree(nR);
  let leanX = 0, leanY = 0;
  if (nR === "=" && nL !== "=")
    leanX = -2;
  else if (nL === "=" && nR !== "=")
    leanX = 2;
  if (nDown === "=")
    leanY = -1;
  else if (nUp === "=")
    leanY = 1;
  let reach = 24 + Math.floor(hash2(s * 9 + 2, s2 * 13 + 3) * 4);
  if (tUp)
    reach += 3;
  if (isTree(nb(-1, -1)) || isTree(nb(1, -1)))
    reach += 1;
  if (!tUp && !tDown && !tL && !tR)
    reach -= 2;
  reach = Math.min(30, Math.max(20, reach));
  if (nUp === "p")
    reach = Math.min(reach, 20);
  const variant = pick(hash2(s * 41 + 3, s2 * 37 + 9), 3);
  const rh = Math.round(reach / 2);
  const cx = px0 + 7 + leanX;
  const cy = py0 + 1 - rh + leanY;
  const crownTop = py0 - reach + leanY;
  const crownBot = variant === 2 ? cy + rh - 13 : py0 + 2 + leanY;
  const crownRx = rh + 1;
  const cDark = forest ? PAL.copaDeepB : PAL.copaDeepL;
  const cMid = forest ? PAL.copaMidB : PAL.copaMidL;
  const cLight = forest ? PAL.copaLightB : PAL.copaLightL;
  const padL = tL ? 2 : 0, padR = tR ? 2 : 0;
  const qL = Math.max(0, padL - 1), qR = Math.max(0, padR - 1);
  groundShadow(x, px0 + 7, py0 + 13);
  pathShade(x, px0, py0, nb, hash2(s * 53 + 7, s2 * 43 + 11));
  trunkCoposo(x, px0 + 7, py0, crownBot - 2, leanX !== 0 ? Math.sign(leanX) : hash2(s, s2 * 3) < 0.5 ? 1 : -1, tDown);
  if (variant === 0) {
    lobe(x, cx, cy + 6, rh - 3, rh - 5, cDark, s + 1, 0.04, qL, qR);
    lobe(x, cx - 5, cy - 2, 7, rh - 6, cMid, s + 2, 0.08, padL, qR);
    lobe(x, cx + 5, cy - 3, 7, rh - 6, cMid, s + 3, 0.08, qL, padR);
    lobe(x, cx, cy - 6, rh - 5, rh - 6, cMid, s + 4, 0.1, padL, padR);
    lobe(x, cx - 4, cy - 6, 5, Math.max(3, rh - 8), cLight, s + 5);
    px(x, cx - crownRx - 1, cy - 2, 1, 1, cMid);
    px(x, cx + crownRx, cy + 1, 1, 1, cMid);
    px(x, cx + 2, crownTop - 1, 1, 1, cMid);
  } else if (variant === 1) {
    lobe(x, cx - 1, cy + 6, rh - 4, rh - 5, cDark, s + 1, 0.04, qL, qR);
    lobe(x, cx - 4, cy + 1, rh - 5, rh - 6, cMid, s + 2, 0.1, padL, qR);
    lobe(x, cx + 4, cy - 5, rh - 6, rh - 7, cMid, s + 3, 0.1, qL, padR);
    lobe(x, cx + 1, cy - 1, 4, 4, cMid, s + 6, 0.22, qL, qR);
    lobe(x, cx + 2, cy - 7, 4, Math.max(2, rh - 9), cLight, s + 5);
    lobe(x, cx - 7, cy - 3, 3, 3, cLight, s + 7);
    px(x, cx + crownRx - 1, cy - rh + 4, 1, 1, cMid);
    px(x, cx - crownRx - 1, cy + 3, 1, 1, cMid);
  } else {
    lobe(x, cx, cy - 6, rh - 4, rh - 7, cDark, s + 1, 0.05, qL, qR);
    lobe(x, cx - 4, cy - 9, rh - 5, rh - 8, cMid, s + 2, 0.08, padL, qR);
    lobe(x, cx + 4, cy - 8, rh - 5, rh - 8, cMid, s + 3, 0.08, qL, padR);
    lobe(x, cx, cy - 11, rh - 6, Math.max(2, rh - 10), cMid, s + 4, 0.1, padL, padR);
    lobe(x, cx - 3, cy - 8, 4, Math.max(2, rh - 10), cLight, s + 5);
    const drops = [-6, -1, 5];
    for (let i = 0;i < drops.length; i++) {
      const d0 = drops[i];
      const bx0 = cx + d0 + Math.floor(hash2(s + i, s2 * 7 + i * 3) * 3) - 1;
      const len = 4 + Math.floor(hash2(s * 3 + i * 5, s2 + i) * 4);
      const dir = d0 < 0 ? -1 : 1;
      const startY = cy + rh - 13;
      for (let d = 0;d <= len; d++) {
        px(x, bx0 + Math.round(d * 0.3) * dir, startY + d, 1, 1, cDark);
      }
      px(x, bx0 + Math.round(len * 0.3) * dir, startY + len + 1, 1, 1, cLight);
    }
  }
  for (let i = 0;i < 3; i++) {
    const lx = cx - crownRx + Math.floor(hash2(s * 13 + i * 3, s2 * 19 + i) * crownRx);
    const ly = crownTop + 2 + Math.floor(hash2(s * 23 + i, s2 * 41 + i * 3) * Math.max(2, rh - 1));
    px(x, lx, ly, 1, 1, cLight);
  }
  const rFruit = hash2(s * 17 + 5, s2 * 23 + 1);
  const rNest = hash2(s * 11 + 9, s2 * 17 + 2);
  const rBird = hash2(s * 19 + 4, s2 * 29 + 8);
  const rLeaf = hash2(s * 23 + 6, s2 * 13 + 5);
  if (rFruit < 0.2) {
    const kinds = [PAL.fruitRed, PAL.flowerGold, PAL.flowerPink];
    const midY = crownTop + (crownBot - crownTop) * 0.45;
    const halfH = Math.max(2, (crownBot - crownTop) * 0.55);
    let placed = 0;
    for (let i = 0;i < 6 && placed < 3; i++) {
      const fx = cx - crownRx + 2 + Math.floor(hash2(s * 17 + i * 3, s2 * 23 + i) * (crownRx * 2 - 4));
      const fy = crownTop + 3 + Math.floor(hash2(s * 29 + i, s2 * 31 + i * 5) * Math.max(1, crownBot - crownTop - 5));
      const ex = (fx - cx) / (crownRx - 1);
      const ey = (fy - midY) / halfH;
      if (ex * ex + ey * ey > 1)
        continue;
      const kind = kinds[pick(hash2(s * 7 + i, s2 * 11 + i * 3), 3)];
      if (kind === PAL.fruitRed) {
        px(x, fx, fy, 2, 2, kind);
        px(x, fx, fy, 1, 1, PAL.fruitShine);
      } else {
        px(x, fx, fy, 1, 1, kind);
      }
      placed++;
    }
  }
  if (rNest < 0.05) {
    const nx = cx + 3;
    const ny = variant === 2 ? cy - 5 : cy + 1;
    const inCrown = variant !== 2 || ((nx + 2 - cx) / (crownRx - 1)) ** 2 + ((ny - (crownTop + 4)) / Math.max(2, (crownBot - crownTop) * 0.5)) ** 2 <= 1;
    if (inCrown) {
      px(x, nx, ny, 5, 2, PAL.nestBrown);
      px(x, nx, ny + 2, 5, 1, PAL.nestDark);
      px(x, nx + 1, ny, 1, 1, PAL.eggShell);
      px(x, nx + 3, ny + 1, 1, 1, PAL.eggShell);
    }
  }
  if (rBird < 0.02) {
    const bx = cx + crownRx - 2;
    const by = crownTop + 1;
    px(x, bx, by, 2, 2, PAL.birdBody);
    px(x, leanX < 0 ? bx - 1 : bx + 2, by + (rBird < 0.01 ? 0 : 1), 1, 1, PAL.birdBeak);
  }
  if (rLeaf < 0.65) {
    px(x, cx - 3 + Math.floor(rLeaf * 8), crownBot + 2, 1, 1, PAL.leafHang);
    if (rLeaf > 0.3)
      px(x, cx - crownRx - 2, cy + 1, 1, 1, PAL.leafHang);
  }
}
function paintPine(x, tx, ty, _mapId, nb) {
  const px0 = tx * 16, py0 = ty * 16;
  const s = tx * 3 + 1, s2 = ty * 5 + 7;
  const nUp = nb(0, -1), nDown = nb(0, 1), nL = nb(-1, 0), nR = nb(1, 0);
  const tUp = isTree(nUp), tDown = isTree(nDown), tL = isTree(nL), tR = isTree(nR);
  let leanX = 0;
  if (nR === "=" && nL !== "=")
    leanX = -2;
  else if (nL === "=" && nR !== "=")
    leanX = 2;
  let reach = 24 + Math.floor(hash2(s * 9 + 2, s2 * 13 + 3) * 4);
  if (tUp)
    reach += 3;
  if (isTree(nb(-1, -1)) || isTree(nb(1, -1)))
    reach += 1;
  if (!tUp && !tDown && !tL && !tR)
    reach -= 2;
  const variant = pick(hash2(s * 41 + 3, s2 * 37 + 9), 3);
  if (variant === 0)
    reach += 2;
  if (variant === 1)
    reach = Math.min(reach, 26);
  if (variant === 2)
    reach = Math.min(reach, 28);
  reach = Math.min(30, Math.max(20, reach));
  if (nUp === "t")
    reach = Math.min(reach, 18);
  const maxHw = variant === 0 ? 6 : variant === 2 ? 9 : 7;
  const fe = variant === 2 ? 4 : 5;
  const cx = px0 + 7 + leanX;
  const padL = tL ? 2 : 0, padR = tR ? 2 : 0;
  groundShadow(x, px0 + 7, py0 + 13);
  pathShade(x, px0, py0, nb, hash2(s * 53 + 7, s2 * 43 + 11));
  trunkPine(x, px0 + 7, py0, tUp ? py0 - 16 : py0 + 4);
  pineCone(x, cx, py0, reach, maxHw, fe, s + s2, padL, padR, variant === 2);
  const topY = py0 - reach;
  if (variant === 1) {
    const syBase = topY + 8;
    const syTop = topY - 3;
    for (let y = syBase;y >= syTop; y--) {
      const t = (syBase - y) / (syBase - syTop);
      const hw = Math.round(2 * (1 - t));
      px(x, cx + 2 - hw, y, hw * 2 + 1, 1, PAL.pineDark);
    }
    px(x, cx + 2, syTop, 1, 1, PAL.pineLight);
  } else {
    px(x, cx - 1, topY + 1, 1, 1, PAL.pineLight);
  }
  const rBird = hash2(s * 19 + 4, s2 * 29 + 8);
  const rLeaf = hash2(s * 23 + 6, s2 * 13 + 5);
  if (rBird < 0.02) {
    const bx = variant === 1 ? cx - 3 : cx + 2;
    const by = topY + 3;
    px(x, bx, by, 2, 2, PAL.birdBody);
    px(x, leanX < 0 ? bx - 1 : bx + 2, by + (rBird < 0.01 ? 0 : 1), 1, 1, PAL.birdBeak);
  }
  if (rLeaf < 0.5) {
    px(x, cx - maxHw - 2, py0 - Math.round(reach * 0.45), 1, 1, PAL.pineLight);
  }
}
function paintTall(x, ch, tx, ty, mapId, at) {
  const nb = at ?? (() => ".");
  if (ch === "t")
    paintCoposo(x, tx, ty, mapId, nb);
  else if (ch === "p")
    paintPine(x, tx, ty, mapId, nb);
}

// src/game/sprites.ts
var SPR = {};
function mkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  return { c, x };
}
function px2(x, X, Y, W, H, C) {
  x.fillStyle = C;
  x.fillRect(X, Y, W, H);
}
function layoutFor(pal) {
  if (pal.small)
    return { H: 15, headTop: 0, faceTop: 3, bodyTop: 7, bodyH: 4, armLen: 3 };
  return { H: 18, headTop: 1, faceTop: 4, bodyTop: 8, bodyH: 6, armLen: 4 };
}
function drawHumanFrame(x, pal, dir, f, bob, L) {
  const hs = pal.hairS ?? pal.hair;
  const ls = pal.legsS ?? pal.legs;
  const ss = pal.skinS;
  const hT = L.headTop + bob;
  const fT = L.faceTop + bob;
  const bT = L.bodyTop + bob;
  const bodyBot = bT + L.bodyH - 1;
  const legY = bodyBot + 1;
  const bootY = L.H - 1;
  const legH = bootY - legY;
  const beltY = bT + L.bodyH - 2;
  const offL = [1, 0, -1][f];
  const offR = [-1, 0, 1][f];
  if (pal.cape && dir === "side") {
    const sway = f === 0 ? 1 : f === 2 ? -1 : 0;
    px2(x, 3, bT + 1, 2, L.bodyH, pal.cape);
    px2(x, 3 + sway, legY, 2, 1, pal.capeS ?? pal.cape);
  }
  if (pal.cape && dir === "down") {
    const hem = Math.max(1, legH - 1);
    px2(x, 2, legY, 2, hem, pal.cape);
    px2(x, 12, legY, 2, hem, pal.cape);
    px2(x, 7, legY, 2, 1, pal.capeS ?? pal.cape);
  }
  if (dir === "down" || dir === "up") {
    px2(x, 4, hT, 8, 1, pal.outline);
    if (pal.rim)
      px2(x, 4, hT, 3, 1, pal.rim);
    px2(x, 3, hT + 1, 10, 5, pal.hair);
    px2(x, 3, hT + 1, 10, 1, hs);
    if (dir === "up") {
      px2(x, 12, hT + 2, 1, 2, hs);
      px2(x, 3, hT + 4, 10, 1, hs);
    }
    if (pal.hood) {
      px2(x, 3, fT + 2, 10, 2, pal.hair);
      px2(x, 4, fT + 3, 8, 1, hs);
    }
    if (dir === "down") {
      px2(x, 5, fT, 6, 4, pal.mask ? pal.maskC ?? pal.skin : pal.skin);
      if (!pal.mask) {
        if (ss) {
          px2(x, 5, fT + 3, 6, 1, ss);
          px2(x, 10, fT + 1, 1, 2, ss);
        }
        px2(x, 6, fT + 1, 1, 2, pal.eye);
        px2(x, 9, fT + 1, 1, 2, pal.eye);
        if (pal.beard)
          px2(x, 5, fT + 3, 6, 2, pal.beard);
      } else {
        px2(x, 6, fT + 1, 4, 1, "#eae6dc");
      }
      px2(x, 3, fT + 2, 1, 2, pal.hair);
      px2(x, 12, fT + 2, 1, 2, pal.hair);
      if (pal.ears === "elf") {
        px2(x, 2, fT + 1, 1, 2, pal.skin);
        px2(x, 13, fT + 1, 1, 2, pal.skin);
      }
      if (pal.hairLong) {
        px2(x, 3, fT + 4, 2, Math.max(1, bT - fT - 3), pal.hair);
        px2(x, 11, fT + 4, 2, Math.max(1, bT - fT - 3), pal.hair);
      }
    }
    if (pal.ears === "cat") {
      px2(x, 3, 0, 1, 1, hs);
      px2(x, 12, 0, 1, 1, hs);
      px2(x, 3, 1, 2, 1, pal.hair);
      px2(x, 11, 1, 2, 1, pal.hair);
    }
    if (pal.messy) {
      px2(x, 2, hT + 1, 1, 1, pal.hair);
      px2(x, 13, hT + 1, 1, 1, pal.hair);
      px2(x, 5, Math.max(0, hT - 1), 2, 1, pal.hair);
      px2(x, 9, Math.max(0, hT - 1), 3, 1, pal.hair);
    }
    px2(x, 4, bT, 8, L.bodyH, pal.body);
    px2(x, 4, bT, 8, 1, pal.bodyS);
    px2(x, 11, bT + 1, 1, L.bodyH - 2, pal.bodyS);
    if (pal.tabard) {
      px2(x, 6, bT + 1, 4, L.bodyH - 2, pal.tabard);
      px2(x, 6, bT + 1, 1, L.bodyH - 2, pal.tabardS ?? pal.tabard);
      px2(x, 7, beltY - 1, 2, 1, pal.accent);
    }
    if (pal.apron)
      px2(x, 5, bT + 1, 6, L.bodyH - 3, pal.apron);
    if (pal.quiver) {
      px2(x, 5, bT + 1, 1, 1, pal.quiver);
      px2(x, 6, bT + 2, 1, 1, pal.quiver);
      px2(x, 7, bT + 3, 1, 1, pal.quiver);
    }
    if (pal.emblem)
      px2(x, 7, bT + 1, 2, 1, pal.emblem);
    else if (pal.brooch)
      px2(x, 7, bT + 1, 2, 1, pal.brooch);
    if (pal.cape && dir === "up") {
      px2(x, 4, bT, 8, L.bodyH - 1, pal.cape);
      px2(x, 4, bT, 8, 1, pal.capeS ?? pal.cape);
    }
    if (pal.ribs) {
      px2(x, 6, bT + 1, 4, 1, pal.bodyS);
      px2(x, 6, bT + 2, 4, 1, pal.bodyS);
    }
    px2(x, 5, beltY, 6, 1, pal.accent);
    if (pal.belt) {
      px2(x, 4, beltY, 8, 1, pal.belt);
      px2(x, 7, beltY, 2, 1, pal.buckle ?? pal.accent);
    }
    px2(x, 4, bodyBot, 8, 1, pal.outline);
    if (pal.pauldrons) {
      px2(x, 3, bT, 2, 2, pal.accent);
      px2(x, 11, bT, 2, 2, pal.accent);
    }
    if (pal.leafy) {
      px2(x, 3, bT, 2, 1, "#8ac05a");
      px2(x, 11, bT, 2, 1, "#8ac05a");
    }
    px2(x, 2, bT + offL, 2, L.armLen, pal.body);
    px2(x, 2, bT + offL + L.armLen, 2, 1, pal.skin);
    px2(x, 12, bT + offR, 2, L.armLen, pal.bodyS);
    px2(x, 12, bT + offR + L.armLen, 2, 1, ss ?? pal.skin);
    if (pal.hammer) {
      px2(x, 13, bT + offR - 2, 1, L.armLen + 1, "#7a5c3a");
      px2(x, 12, bT + offR - 4, 3, 2, "#9aa4b4");
    }
    if (pal.skirt) {
      px2(x, 4, legY, 8, legH, pal.skirt);
      const sway = f === 0 ? -1 : f === 2 ? 1 : 0;
      px2(x, 4 + sway, bootY - 1, 8, 1, pal.skirtS ?? pal.skirt);
      px2(x, 4, bootY, 3, 1, pal.boots);
      px2(x, 9, bootY, 3, 1, pal.boots);
    } else if (f === 0) {
      px2(x, 4, legY, 3, legH, pal.legs);
      px2(x, 9, legY, 3, legH, ls);
      px2(x, 3, bootY, 4, 1, pal.boots);
      px2(x, 9, bootY, 3, 1, pal.boots);
    } else if (f === 1) {
      px2(x, 5, legY, 3, legH, pal.legs);
      px2(x, 8, legY, 3, legH, ls);
      px2(x, 5, bootY, 3, 1, pal.boots);
      px2(x, 8, bootY, 3, 1, pal.boots);
    } else {
      px2(x, 4, legY + 1, 3, Math.max(1, legH - 1), ls);
      px2(x, 9, legY, 3, legH, pal.legs);
      px2(x, 4, bootY, 3, 1, pal.boots);
      px2(x, 9, bootY, 4, 1, pal.boots);
    }
    return;
  }
  px2(x, 5, hT, 8, 1, pal.outline);
  if (pal.rim)
    px2(x, 9, hT, 3, 1, pal.rim);
  px2(x, 4, hT + 1, 9, 5, pal.hair);
  px2(x, 4, hT + 1, 9, 1, hs);
  px2(x, 4, hT + 2, 1, 3, hs);
  if (pal.hood) {
    px2(x, 4, fT + 2, 8, 2, pal.hair);
  }
  px2(x, 7, fT, 5, 4, pal.mask ? pal.maskC ?? pal.skin : pal.skin);
  if (!pal.mask) {
    if (ss)
      px2(x, 7, fT + 3, 5, 1, ss);
    px2(x, 10, fT + 1, 1, 2, pal.eye);
    if (pal.beard)
      px2(x, 8, fT + 3, 4, 2, pal.beard);
  } else {
    px2(x, 8, fT + 1, 3, 1, "#eae6dc");
  }
  px2(x, 5, fT + 2, 1, 2, pal.hair);
  if (pal.ears === "elf")
    px2(x, 6, fT + 1, 1, 2, pal.skin);
  if (pal.ears === "cat") {
    px2(x, 3, 0, 1, 1, hs);
    px2(x, 4, 1, 2, 1, pal.hair);
  }
  if (pal.hairLong)
    px2(x, 4, fT + 3, 2, Math.max(1, bT - fT - 2), pal.hair);
  if (pal.messy)
    px2(x, 5, Math.max(0, hT - 1), 3, 1, pal.hair);
  px2(x, 5, bT, 6, L.bodyH, pal.body);
  px2(x, 5, bT, 6, 1, pal.bodyS);
  px2(x, 5, bT + 1, 1, L.bodyH - 2, pal.bodyS);
  if (pal.apron)
    px2(x, 7, bT + 1, 1, L.bodyH - 3, pal.apron);
  if (pal.emblem)
    px2(x, 9, bT + 2, 1, 1, pal.emblem);
  px2(x, 6, beltY, 4, 1, pal.accent);
  if (pal.belt) {
    px2(x, 5, beltY, 6, 1, pal.belt);
    px2(x, 8, beltY, 1, 1, pal.buckle ?? pal.accent);
  }
  px2(x, 5, bodyBot, 6, 1, pal.outline);
  if (pal.ribs) {
    px2(x, 6, bT + 1, 3, 1, pal.bodyS);
    px2(x, 6, bT + 2, 3, 1, pal.bodyS);
  }
  if (pal.pauldrons)
    px2(x, 4, bT, 2, 2, pal.accent);
  if (pal.leafy)
    px2(x, 4, bT, 2, 1, "#8ac05a");
  const offF = [1, 0, -1][f];
  px2(x, 8, bT + offF, 3, 3, pal.body);
  px2(x, 10, bT + offF + 3, 2, 1, ss ?? pal.skin);
  px2(x, 5, bT - offF, 2, 3, pal.bodyS);
  if (pal.hammer) {
    px2(x, 11, bT + offF - 2, 1, 4, "#7a5c3a");
    px2(x, 10, bT + offF - 4, 3, 2, "#9aa4b4");
  }
  if (pal.skirt) {
    px2(x, 5, legY, 6, legH, pal.skirt);
    const sway = f === 0 ? 1 : f === 2 ? -1 : 0;
    px2(x, 5 + sway, bootY - 1, 6, 1, pal.skirtS ?? pal.skirt);
    px2(x, 5, bootY, 2, 1, pal.boots);
    px2(x, 8, bootY, 3, 1, pal.boots);
  } else if (f === 0) {
    px2(x, 5, legY, 2, legH, ls);
    px2(x, 8, legY, 2, legH, pal.legs);
    px2(x, 5, bootY, 2, 1, pal.boots);
    px2(x, 8, bootY, 3, 1, pal.boots);
  } else if (f === 1) {
    px2(x, 6, legY, 2, legH, pal.legs);
    px2(x, 8, legY + 1, 2, Math.max(1, legH - 1), ls);
    px2(x, 6, bootY, 2, 1, pal.boots);
    px2(x, 8, bootY, 2, 1, pal.boots);
  } else {
    px2(x, 4, legY, 2, legH, ls);
    px2(x, 7, legY, 2, legH, pal.legs);
    px2(x, 3, bootY, 2, 1, pal.boots);
    px2(x, 7, bootY, 2, 1, pal.boots);
  }
}
function buildHumanoid(pal) {
  const frames = [];
  const dirs = ["down", "up", "side"];
  const L = layoutFor(pal);
  for (const dir of dirs) {
    for (let f = 0;f < 3; f++) {
      const bob = f === 1 ? -1 : 0;
      const { c, x } = mkCanvas(16, L.H);
      drawHumanFrame(x, pal, dir, f, bob, L);
      frames.push(c);
    }
  }
  if (pal.big) {
    return frames.map((fr) => {
      const { c, x } = mkCanvas(32, L.H * 2);
      x.imageSmoothingEnabled = false;
      x.drawImage(fr, 0, 0, 32, L.H * 2);
      return c;
    });
  }
  return frames;
}
function esLateral(dir) {
  return dir === "side" || dir === "left" || dir === "right";
}
function frameIndex(dir, moving, anim) {
  const base = dir === "down" ? 0 : dir === "up" ? 2 : esLateral(dir) ? 4 : 0;
  if (!moving)
    return base;
  return base + Math.floor(anim * 6) % 2;
}
function entityFrame(spr, dir, moving, anim) {
  const n = spr.length;
  if (n === 9) {
    const base = dir === "up" ? 3 : esLateral(dir) ? 6 : 0;
    if (!moving)
      return base + 1;
    return base + Math.floor(anim * 8) % 3;
  }
  if (n >= 2 && moving)
    return Math.floor(anim * 6) % Math.min(2, n);
  return 0;
}
function buildWolf() {
  const frames = [];
  for (let f = 0;f < 2; f++) {
    const { c, x } = mkCanvas(18, 12);
    const O = "#26243a", B = "#7d7d9f", BS = "#5c5c80", W = "#a7a7c4";
    px2(x, 3, 3, 10, 5, B);
    px2(x, 3, 3, 10, 1, W);
    px2(x, 2, 7, 12, 1, O);
    px2(x, 11, 1, 4, 5, B);
    px2(x, 13, 0, 1, 2, B);
    px2(x, 12, 0, 1, 2, BS);
    px2(x, 14, 3, 3, 2, BS);
    px2(x, 12, 2, 1, 1, "#ff6a4d");
    px2(x, 16, 4, 1, 1, O);
    px2(x, 0, 2, 3, 2, BS);
    px2(x, 0, 1, 1, 2, BS);
    const ly = f === 0 ? 8 : 9;
    px2(x, 4, ly, 2, 3, BS);
    px2(x, 7, f === 0 ? 9 : 8, 2, 3, BS);
    px2(x, 10, ly, 2, 3, BS);
    px2(x, 12, f === 0 ? 9 : 8, 2, 3, BS);
    x.globalAlpha = 0.35;
    px2(x, 1 + f, 9, 3, 2, W);
    px2(x, 13 - f, 8, 4, 2, W);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
function buildGuardian() {
  const frames = [];
  for (let f = 0;f < 2; f++) {
    const { c, x } = mkCanvas(32, 34);
    const O = "#141220", S = "#4a4660", S2 = "#5f5a7a", HL = "#8a84a8";
    const GLOW = f === 0 ? "#7ee8ff" : "#baf4ff";
    px2(x, 8, 14, 16, 12, "#2c2440");
    px2(x, 7, 22 + f, 3, 6, "#221c33");
    px2(x, 22, 21 - f, 3, 6, "#221c33");
    px2(x, 2, 12, 8, 6, S2);
    px2(x, 22, 12, 8, 6, S2);
    px2(x, 2, 12, 8, 1, HL);
    px2(x, 22, 12, 8, 1, HL);
    px2(x, 9, 12, 14, 13, S);
    px2(x, 9, 12, 14, 1, HL);
    px2(x, 13, 16, 6, 6, O);
    px2(x, 14, 17, 4, 4, GLOW);
    px2(x, 10, 14, 1, 4, O);
    px2(x, 21, 18, 1, 5, O);
    px2(x, 16, 24, 3, 1, O);
    px2(x, 11, 4, 10, 8, S2);
    px2(x, 11, 4, 10, 1, HL);
    px2(x, 9, 2, 2, 6, HL);
    px2(x, 21, 2, 2, 6, HL);
    px2(x, 8, 1, 2, 3, HL);
    px2(x, 22, 1, 2, 3, HL);
    px2(x, 13, 7, 2, 2, GLOW);
    px2(x, 17, 7, 2, 2, GLOW);
    const ay = f === 0 ? 18 : 16;
    px2(x, 0, ay, 3, 9, S2);
    px2(x, 29, ay, 3, 9, S2);
    px2(x, 0, ay + 9, 3, 2, O);
    px2(x, 29, ay + 9, 3, 2, O);
    x.globalAlpha = 0.8;
    px2(x, 5, 27 + f, 2, 2, S2);
    px2(x, 25, 28 - f, 2, 2, S2);
    px2(x, 15, 30, 2, 2, S2);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
function buildChest() {
  const mk = (open) => {
    const { c, x } = mkCanvas(16, 14);
    const O = "#3a2414", W = "#8a5a2b", W2 = "#6d4520", G = "#f0c84a";
    px2(x, 2, open ? 5 : 3, 12, open ? 8 : 9, W);
    px2(x, 2, open ? 5 : 3, 12, 2, W2);
    px2(x, 2, open ? 12 : 10, 12, 1, O);
    px2(x, 1, 3, 14, 1, O);
    px2(x, 1, 12, 14, 1, O);
    px2(x, 7, open ? 8 : 6, 2, 3, G);
    if (open) {
      px2(x, 2, 1, 12, 3, W2);
      px2(x, 3, 4, 10, 2, "#fff3c0");
      px2(x, 4, 5, 8, 1, G);
    } else {
      px2(x, 2, 3, 12, 2, W2);
    }
    return c;
  };
  return { closed: [mk(false)], open: [mk(true)] };
}
function buildSanctuary() {
  const frames = [];
  for (let f = 0;f < 2; f++) {
    const { c, x } = mkCanvas(20, 30);
    const O = "#1c2438", S = "#5a6a8a", S2 = "#42506c";
    px2(x, 7, 4, 6, 24, S);
    px2(x, 7, 4, 2, 24, S2);
    px2(x, 6, 2, 8, 3, S2);
    px2(x, 5, 27, 10, 3, S2);
    px2(x, 4, 28, 12, 2, O);
    const g = f === 0 ? "#8ef0ff" : "#d4fbff";
    x.globalAlpha = 0.9;
    px2(x, 8, 6 + f, 4, 7, g);
    x.globalAlpha = 0.4;
    px2(x, 7, 5 + f, 6, 9, g);
    x.globalAlpha = 1;
    px2(x, 9, 14, 2, 10, "#7a8aac");
    frames.push(c);
  }
  return frames;
}
function buildFragment() {
  const frames = [];
  for (let f = 0;f < 3; f++) {
    const { c, x } = mkCanvas(12, 12);
    const G = "#ffe9a0", G2 = "#f0c84a";
    if (f === 0) {
      px2(x, 5, 1, 3, 10, G2);
      px2(x, 5, 2, 3, 8, G);
    }
    if (f === 1) {
      px2(x, 3, 2, 6, 8, G2);
      px2(x, 4, 3, 4, 6, G);
    }
    if (f === 2) {
      px2(x, 2, 3, 8, 6, G2);
      px2(x, 3, 4, 6, 4, G);
    }
    px2(x, 5, 4, 2, 2, "#fffbe0");
    frames.push(c);
  }
  return frames;
}
function buildWisp() {
  const frames = [];
  for (let f = 0;f < 2; f++) {
    const { c, x } = mkCanvas(10, 10);
    x.globalAlpha = 0.9;
    px2(x, 3, 3 + f, 4, 4, "#bff4e8");
    x.globalAlpha = 0.5;
    px2(x, 2, 2 + f, 6, 6, "#7fe0cc");
    x.globalAlpha = 1;
    px2(x, 4, 4 + f, 2, 2, "#ffffff");
    frames.push(c);
  }
  return frames;
}
function buildPickups() {
  {
    const { c, x } = mkCanvas(8, 10);
    px2(x, 2, 0, 4, 2, "#8a5a2b");
    px2(x, 1, 2, 6, 7, "#e05078");
    px2(x, 2, 3, 2, 3, "#ff9ab0");
    px2(x, 1, 9, 6, 1, "#8a2a48");
    SPR["potion"] = [c];
  }
  {
    const { c, x } = mkCanvas(10, 8);
    px2(x, 1, 2, 8, 5, "#e8b23a");
    px2(x, 1, 2, 8, 1, "#f8d878");
    px2(x, 0, 3, 1, 3, "#b8842a");
    px2(x, 9, 3, 1, 3, "#b8842a");
    px2(x, 3, 4, 2, 1, "#b8842a");
    px2(x, 6, 4, 1, 1, "#b8842a");
    SPR["goldbag"] = [c];
  }
  {
    const { c, x } = mkCanvas(10, 10);
    px2(x, 2, 1, 6, 8, "#cfd6e2");
    px2(x, 3, 0, 4, 1, "#9aa4b4");
    px2(x, 3, 3, 4, 1, "#7a8494");
    px2(x, 3, 6, 4, 1, "#7a8494");
    SPR["keyEcho"] = [c];
  }
}
var PALS = {
  hero_alba: {
    outline: "#2a1a20",
    hair: "#c8384a",
    hairS: "#9a2438",
    skin: "#f2c99c",
    skinS: "#d8a878",
    body: "#cdd3de",
    bodyS: "#9aa3b4",
    accent: "#c8384a",
    legs: "#5a6070",
    legsS: "#474c5a",
    boots: "#6d4520",
    eye: "#2a2a3a",
    hood: true,
    rim: "#f6e8cc",
    cape: "#7a2634",
    capeS: "#5a1c28",
    brooch: "#f0c84a",
    belt: "#4a3226",
    buckle: "#f0c84a"
  },
  hero_tejedor: {
    outline: "#241a30",
    hair: "#8a5ac0",
    hairS: "#6a3f9a",
    skin: "#f2c99c",
    skinS: "#d8a878",
    body: "#7e58b8",
    bodyS: "#5e3f92",
    accent: "#f0c84a",
    legs: "#4a3a6a",
    legsS: "#3c2f58",
    boots: "#3a2c50",
    eye: "#3ae0c8",
    hood: true,
    rim: "#d8c8f4",
    cape: "#4e3382",
    capeS: "#3a2464",
    tabard: "#6a48a8",
    tabardS: "#583a92",
    belt: "#3a2c50",
    buckle: "#f0c84a"
  },
  brisa: {
    outline: "#2a2a30",
    hair: "#d8dade",
    hairS: "#b0b4bc",
    skin: "#eabf9a",
    skinS: "#c89a74",
    body: "#7a9a6e",
    bodyS: "#5e7a54",
    accent: "#e8d8a8",
    legs: "#6a6a62",
    boots: "#4a3a2a",
    eye: "#3a3a3a",
    rim: "#f4f0e0",
    skirt: "#5e7a54",
    skirtS: "#4c6644",
    brooch: "#e8d8a8"
  },
  toln: {
    outline: "#241a14",
    hair: "#6a4a2e",
    hairS: "#54381e",
    skin: "#e0a87a",
    skinS: "#c08858",
    body: "#8a5a33",
    bodyS: "#6d4520",
    accent: "#3a3a3e",
    legs: "#4a4440",
    boots: "#3a2c20",
    eye: "#2a2a2a",
    beard: "#6a4a2e",
    rim: "#e8c8a0",
    apron: "#5c3a1c",
    belt: "#3a3a3e",
    buckle: "#c8a050"
  },
  ilwen: {
    outline: "#1c2a1e",
    hair: "#8ad058",
    hairS: "#64a83e",
    skin: "#f2d0a8",
    skinS: "#d0ac84",
    body: "#3e7d4c",
    bodyS: "#2e5f3a",
    accent: "#e8c860",
    legs: "#4a5a3a",
    boots: "#54381e",
    eye: "#2a4a2e",
    ears: "elf",
    rim: "#d8f0b0",
    quiver: "#7a5c3a",
    belt: "#54381e",
    buckle: "#e8c860"
  },
  esqueleto: {
    outline: "#20201e",
    hair: "#e6e0c8",
    hairS: "#c2bc9e",
    skin: "#e6e0c8",
    body: "#d8d2b4",
    bodyS: "#a8a284",
    accent: "#7a7460",
    legs: "#c8c2a4",
    legsS: "#a8a284",
    boots: "#8a8468",
    eye: "#e04838",
    ribs: true
  },
  sombra: {
    outline: "#100c1c",
    hair: "#2c2440",
    hairS: "#201a30",
    skin: "#2c2440",
    body: "#241c38",
    bodyS: "#181226",
    accent: "#9f7ae0",
    legs: "#181226",
    boots: "#100c1c",
    eye: "#b48fff",
    hood: true
  },
  sasha: {
    outline: "#16121e",
    hair: "#2e2838",
    hairS: "#221c2c",
    skin: "#e8c49a",
    body: "#3a3448",
    bodyS: "#2a2438",
    accent: "#c89a3a",
    legs: "#2e2a3a",
    legsS: "#242030",
    boots: "#1a1622",
    eye: "#f0c040",
    hood: true,
    ears: "cat"
  },
  brokk: {
    outline: "#241408",
    hair: "#8a4a26",
    hairS: "#6d3a1e",
    skin: "#e8a878",
    body: "#5a4a3a",
    bodyS: "#443828",
    accent: "#b07030",
    legs: "#3e342a",
    boots: "#2e241a",
    eye: "#2a2a2a",
    beard: "#a44e28",
    hammer: true
  },
  maelis: {
    outline: "#12303a",
    hair: "#7ad8c8",
    hairS: "#54b0a4",
    skin: "#f0d8c0",
    body: "#4aa8b0",
    bodyS: "#368088",
    accent: "#e8f0ea",
    legs: "#3a8890",
    boots: "#2a6870",
    eye: "#2a8a8a",
    hairLong: true
  },
  corvin: {
    outline: "#181820",
    hair: "#5a5a64",
    hairS: "#42424a",
    skin: "#eac8a0",
    body: "#3e3e48",
    bodyS: "#2e2e38",
    accent: "#8a8a96",
    legs: "#33333c",
    boots: "#22222a",
    eye: "#3a3a44"
  },
  kael: {
    outline: "#3a3a44",
    hair: "#e8e0c8",
    hairS: "#c8bc9c",
    skin: "#f2d4b0",
    skinS: "#d0b088",
    body: "#e8e6de",
    bodyS: "#c2c0b6",
    accent: "#8a94a8",
    legs: "#b8b6ac",
    boots: "#8a887e",
    eye: "#7a8894",
    pauldrons: true,
    rim: "#ffffff",
    emblem: "#8a94a8",
    belt: "#8a94a8",
    buckle: "#f0c84a"
  },
  inquisidor: {
    outline: "#2a2a30",
    hair: "#e4e2da",
    hairS: "#c6c4ba",
    skin: "#d8d4ca",
    body: "#e4e2da",
    bodyS: "#bcbab0",
    accent: "#8a887e",
    legs: "#b4b2a8",
    boots: "#86847a",
    eye: "#d8d4ca",
    mask: true,
    maskC: "#d8d4ca",
    big: true
  },
  teo: {
    outline: "#2a1e14",
    hair: "#7a5432",
    hairS: "#5e4026",
    skin: "#f2cfa4",
    body: "#c09a54",
    bodyS: "#9a7a40",
    accent: "#7a5432",
    legs: "#6a5a40",
    boots: "#4a3a28",
    eye: "#3a2a1a",
    small: true,
    messy: true
  },
  doran: {
    outline: "#16241a",
    hair: "#3e6a34",
    hairS: "#2e5226",
    skin: "#d8b088",
    skinS: "#b4906a",
    body: "#4a7a3e",
    bodyS: "#375e2e",
    accent: "#8ac05a",
    legs: "#3a5232",
    boots: "#4a3a22",
    eye: "#2a3a24",
    hood: true,
    leafy: true,
    rim: "#c8e8a0",
    belt: "#4a3a22",
    buckle: "#8ac05a"
  },
  nimue: {
    outline: "#1a2a26",
    hair: "#b8d8c8",
    hairS: "#94b8a8",
    skin: "#e4e8de",
    body: "#5a8a72",
    bodyS: "#446a58",
    accent: "#bff0dc",
    legs: "#4a6a5a",
    boots: "#38504a",
    eye: "#7ae8c0",
    ears: "elf",
    hairLong: true
  },
  merrow_h: {
    outline: "#1c222a",
    hair: "#5a5a50",
    hairS: "#46463e",
    skin: "#d8a878",
    body: "#5a6a6a",
    bodyS: "#465454",
    accent: "#8a7a5a",
    legs: "#3e4a50",
    legsS: "#333e44",
    boots: "#3a2e20",
    eye: "#2a2a30",
    beard: "#6a6a5e"
  },
  merrow_m: {
    outline: "#241c22",
    hair: "#4a6a5e",
    hairS: "#3a544a",
    skin: "#e0b088",
    body: "#6a7a72",
    bodyS: "#525f58",
    accent: "#9a8a6a",
    legs: "#4a5450",
    legsS: "#3c443f",
    boots: "#3a2e20",
    eye: "#2a3a34",
    hood: true
  }
};
function initSprites() {
  for (const [name, pal] of Object.entries(PALS))
    SPR[name] = buildHumanoid(pal);
  SPR["lobo"] = buildWolf();
  SPR["guardian"] = buildGuardian();
  const chest = buildChest();
  SPR["chest"] = chest.closed;
  SPR["chest_open"] = chest.open;
  SPR["sanctuary"] = buildSanctuary();
  SPR["fragment"] = buildFragment();
  SPR["wisp"] = buildWisp();
  buildPickups();
}
function getSpr(name) {
  return SPR[name] ?? SPR["hero_alba"];
}
function registerSpr(name, frames) {
  SPR[name] = frames;
}
var ATTACK_POSES = new Set(["hero_alba", "hero_tejedor", "brisa", "toln", "ilwen", "doran", "kael"]);
var CAST_POSES = new Set(["hero_tejedor"]);
var WEAPONS = {
  hero_alba: { kind: "sword", metal: "#d8dee8", glint: "#f6f9fc", grip: "#5a3a28", trim: "#c8384a" },
  kael: { kind: "sword", metal: "#dfe3ea", glint: "#ffffff", grip: "#4a4a54", trim: "#8a94a8" },
  hero_tejedor: { kind: "staff", metal: "#8a6a44", glint: "#fff8d8", grip: "#6a4e30", trim: "#f0c84a" },
  brisa: { kind: "staff", metal: "#9a7a50", glint: "#f8f0d0", grip: "#6a4e30", trim: "#e8d8a8" },
  doran: { kind: "staff", metal: "#6d4520", glint: "#e0f4c0", grip: "#54381e", trim: "#8ac05a" },
  toln: { kind: "hammer", metal: "#9aa4b4", glint: "#c8d2dc", grip: "#7a5c3a", trim: "#3a3a3e" },
  ilwen: { kind: "bow", metal: "#8a5a2b", glint: "#e8e0c8", grip: "#54381e", trim: "#e8c860" }
};
var attackPoseCache = new Map;
var castPoseCache = new Map;
function getAttackFrames(baseName, dir) {
  const key = baseName + "|" + dir;
  if (attackPoseCache.has(key))
    return attackPoseCache.get(key) ?? null;
  const frames = typeof document === "undefined" ? null : buildCombatPose(baseName, dir, "attack");
  attackPoseCache.set(key, frames);
  return frames;
}
function getCastFrames(baseName, dir) {
  const key = baseName + "|" + dir;
  if (castPoseCache.has(key))
    return castPoseCache.get(key) ?? null;
  const frames = typeof document === "undefined" ? null : buildCombatPose(baseName, dir, "cast");
  castPoseCache.set(key, frames);
  return frames;
}
function pxc(x, X, Y, W, H, C) {
  if (W <= 0 || H <= 0)
    return;
  px2(x, X, Y, W, H, C);
}
function poseCanvas(pal, dir3, bob) {
  const L = layoutFor(pal);
  const { c, x } = mkCanvas(16, L.H);
  drawHumanFrame(x, pal, dir3, 1, bob, L);
  return { c, x, bT: L.bodyTop + bob, L };
}
function clearArmR(x, bT, armLen) {
  x.clearRect(12, bT, 2, armLen + 1);
}
function clearArmL(x, bT, armLen) {
  x.clearRect(2, bT, 2, armLen + 1);
}
function clearArmFront(x, bT) {
  x.clearRect(8, bT, 4, 4);
}
function restoreShoulderR(x, pal, bT) {
  if (pal.pauldrons)
    px2(x, 11, bT, 2, 2, pal.accent);
  else if (pal.leafy)
    px2(x, 11, bT, 2, 1, "#8ac05a");
}
function weaponVert(x, W, cx, gy, len, up) {
  pxc(x, cx, gy, 2, 1, W.grip);
  pxc(x, cx - 1, up ? gy - 1 : gy + 1, 4, 1, W.trim);
  const s0 = up ? gy - 2 : gy + 2;
  if (W.kind === "sword") {
    const top = up ? s0 - len + 1 : s0;
    pxc(x, cx, top, 2, len, W.metal);
    pxc(x, cx, top, 1, len, W.glint);
    pxc(x, cx, up ? top : top + len - 1, 2, 1, "#ffffff");
  } else if (W.kind === "staff") {
    const sl = Math.max(1, len - 1);
    const top = up ? s0 - sl + 1 : s0;
    pxc(x, cx, top, 1, sl, W.metal);
    const gemY = up ? top - 1 : top + sl;
    pxc(x, cx, gemY, 2, 1, W.trim);
    pxc(x, cx, gemY, 1, 1, W.glint);
  } else {
    const sl = Math.max(1, len - 2);
    const top = up ? s0 - sl + 1 : s0;
    pxc(x, cx, top, 1, sl, W.grip);
    const headY = up ? top - 2 : top + sl - 1;
    pxc(x, cx - 1, headY, 4, 2, W.metal);
    pxc(x, cx - 1, up ? headY : headY + 1, 4, 1, W.glint);
  }
}
function weaponHoriz(x, W, hx, ry, len) {
  if (W.kind === "sword") {
    pxc(x, hx, ry - 1, 1, 4, W.trim);
    pxc(x, hx + 1, ry, len, 2, W.metal);
    pxc(x, hx + 1, ry, len, 1, W.glint);
    pxc(x, hx + len, ry, 1, 2, "#ffffff");
  } else if (W.kind === "staff") {
    pxc(x, hx + 1, ry, len, 1, W.metal);
    pxc(x, hx + len, ry - 1, 1, 3, W.trim);
    pxc(x, hx + len, ry, 1, 1, W.glint);
  } else {
    pxc(x, hx + 1, ry, Math.max(1, len - 1), 1, W.grip);
    pxc(x, hx + len - 1, ry - 1, 2, 4, W.metal);
    pxc(x, hx + len - 1, ry - 1, 2, 1, W.glint);
  }
}
function weaponPoses(pal, W, dir3, dir) {
  const L = layoutFor(pal);
  const f0 = (() => {
    const P = poseCanvas(pal, dir3, -1);
    if (dir3 === "side") {
      clearArmFront(P.x, P.bT);
      px2(P.x, 9, P.bT - 2, 2, 3, pal.body);
      px2(P.x, 9, P.bT - 3, 2, 1, pal.skin);
      if (W.kind === "hammer") {
        pxc(P.x, 10, P.bT - 4, 1, 2, W.grip);
        pxc(P.x, 9, P.bT - 6, 4, 2, W.metal);
        pxc(P.x, 9, P.bT - 6, 4, 1, W.glint);
      } else {
        weaponVert(P.x, W, 10, P.bT - 4, Math.max(1, P.bT - 5), true);
      }
    } else {
      clearArmR(P.x, P.bT, L.armLen);
      restoreShoulderR(P.x, pal, P.bT);
      px2(P.x, 12, P.bT - 2, 2, 3, pal.body);
      px2(P.x, 12, P.bT - 3, 2, 1, pal.skin);
      if (W.kind === "hammer") {
        pxc(P.x, 13, P.bT - 4, 1, 2, W.grip);
        pxc(P.x, 12, P.bT - 6, 4, 2, W.metal);
        pxc(P.x, 12, P.bT - 6, 4, 1, W.glint);
      } else {
        weaponVert(P.x, W, 13, P.bT - 4, Math.max(1, P.bT - 5), true);
      }
    }
    return P.c;
  })();
  const f1 = (() => {
    if (dir === "down") {
      const P2 = poseCanvas(pal, "down", 0);
      clearArmR(P2.x, P2.bT, L.armLen);
      restoreShoulderR(P2.x, pal, P2.bT);
      px2(P2.x, 9, P2.bT + 2, 2, 2, pal.body);
      px2(P2.x, 9, P2.bT + 4, 2, 1, pal.skin);
      weaponVert(P2.x, W, 9, P2.bT + 5, Math.max(1, L.H - P2.bT - 7), false);
      return P2.c;
    }
    if (dir === "up") {
      const P2 = poseCanvas(pal, "up", 1);
      clearArmR(P2.x, P2.bT, L.armLen);
      restoreShoulderR(P2.x, pal, P2.bT);
      px2(P2.x, 12, P2.bT - 3, 2, 3, pal.body);
      px2(P2.x, 12, P2.bT - 4, 2, 1, pal.skin);
      weaponVert(P2.x, W, 13, P2.bT - 5, Math.max(1, P2.bT - 6), true);
      return P2.c;
    }
    const P = poseCanvas(pal, "side", 0);
    clearArmFront(P.x, P.bT);
    px2(P.x, 9, P.bT + 1, 3, 2, pal.body);
    px2(P.x, 11, P.bT + 1, 1, 2, pal.skin);
    weaponHoriz(P.x, W, 12, P.bT + 1, 3);
    return P.c;
  })();
  return [f0, f1];
}
function bowPoses(pal, W, dir3) {
  const L = layoutFor(pal);
  if (dir3 === "side") {
    const f02 = (() => {
      const P = poseCanvas(pal, "side", 0);
      clearArmFront(P.x, P.bT);
      const bT = P.bT;
      px2(P.x, 9, bT + 1, 3, 2, pal.body);
      px2(P.x, 12, bT + 1, 1, 2, pal.skin);
      px2(P.x, 6, bT + 1, 2, 2, pal.bodyS);
      px2(P.x, 8, bT + 1, 1, 2, pal.skin);
      px2(P.x, 9, bT + 1, 3, 1, "#c8a86a");
      px2(P.x, 12, bT + 1, 1, 1, W.trim);
      px2(P.x, 13, bT - 3, 1, 2, W.metal);
      px2(P.x, 13, bT - 1, 1, 1, W.glint);
      px2(P.x, 14, bT, 1, 2, W.metal);
      px2(P.x, 13, bT + 1, 1, 2, W.grip);
      px2(P.x, 14, bT + 3, 1, 2, W.metal);
      px2(P.x, 13, bT + 3, 1, 1, W.glint);
      px2(P.x, 13, bT + 5, 1, 2, W.metal);
      return P.c;
    })();
    const f12 = (() => {
      const P = poseCanvas(pal, "side", 0);
      clearArmFront(P.x, P.bT);
      const bT = P.bT;
      px2(P.x, 9, bT + 2, 2, 2, pal.body);
      px2(P.x, 12, bT + 2, 1, 2, pal.skin);
      px2(P.x, 13, bT - 1, 1, 7, W.glint);
      px2(P.x, 13, bT - 2, 1, 2, W.metal);
      px2(P.x, 14, bT, 1, 2, W.metal);
      px2(P.x, 13, bT + 2, 1, 2, W.grip);
      px2(P.x, 14, bT + 4, 1, 2, W.metal);
      px2(P.x, 13, bT + 6, 1, 2, W.metal);
      return P.c;
    })();
    return [f02, f12];
  }
  if (dir3 === "down") {
    const f02 = (() => {
      const P = poseCanvas(pal, "down", 0);
      clearArmR(P.x, P.bT, L.armLen);
      const bT = P.bT;
      px2(P.x, 9, bT + 2, 2, 2, pal.body);
      px2(P.x, 9, bT + 4, 2, 1, pal.skin);
      px2(P.x, 6, bT + 4, 6, 1, W.glint);
      px2(P.x, 6, bT + 5, 2, 1, W.metal);
      px2(P.x, 10, bT + 5, 2, 1, W.metal);
      px2(P.x, 8, bT + 6, 2, 1, W.metal);
      px2(P.x, 8, bT + 5, 1, 2, "#c8a86a");
      px2(P.x, 8, bT + 7, 1, 1, W.trim);
      return P.c;
    })();
    const f12 = (() => {
      const P = poseCanvas(pal, "down", 0);
      clearArmR(P.x, P.bT, L.armLen);
      const bT = P.bT;
      px2(P.x, 9, bT + 1, 2, 2, pal.body);
      px2(P.x, 9, bT + 3, 2, 1, pal.skin);
      px2(P.x, 6, bT + 5, 6, 1, W.glint);
      px2(P.x, 6, bT + 6, 2, 1, W.metal);
      px2(P.x, 10, bT + 6, 2, 1, W.metal);
      px2(P.x, 8, bT + 7, 2, 1, W.metal);
      return P.c;
    })();
    return [f02, f12];
  }
  const f0 = (() => {
    const P = poseCanvas(pal, "up", 1);
    clearArmR(P.x, P.bT, L.armLen);
    const bT = P.bT;
    px2(P.x, 9, bT - 3, 2, 3, pal.body);
    px2(P.x, 9, bT - 4, 2, 2, pal.skin);
    pxc(P.x, 7, bT - 8, 2, 1, W.metal);
    pxc(P.x, 5, bT - 7, 2, 1, W.metal);
    pxc(P.x, 9, bT - 7, 2, 1, W.metal);
    pxc(P.x, 5, bT - 6, 6, 1, W.glint);
    pxc(P.x, 7, bT - 7, 1, 2, "#c8a86a");
    pxc(P.x, 7, bT - 8, 1, 1, W.trim);
    return P.c;
  })();
  const f1 = (() => {
    const P = poseCanvas(pal, "up", 0);
    clearArmR(P.x, P.bT, L.armLen);
    const bT = P.bT;
    px2(P.x, 9, bT + 1, 2, 2, pal.body);
    px2(P.x, 12, bT + 1, 1, 2, pal.skin);
    px2(P.x, 13, bT - 1, 1, 7, W.glint);
    px2(P.x, 13, bT - 2, 1, 2, W.metal);
    px2(P.x, 14, bT, 1, 2, W.metal);
    px2(P.x, 13, bT + 2, 1, 2, W.grip);
    px2(P.x, 14, bT + 4, 1, 2, W.metal);
    px2(P.x, 13, bT + 6, 1, 2, W.metal);
    return P.c;
  })();
  return [f0, f1];
}
function castPoses(pal, W, dir3) {
  if (dir3 === "side") {
    const f02 = (() => {
      const P = poseCanvas(pal, "side", 0);
      clearArmFront(P.x, P.bT);
      const bT = P.bT;
      px2(P.x, 9, bT + 1, 3, 2, pal.body);
      px2(P.x, 12, bT + 1, 1, 2, pal.skin);
      px2(P.x, 11, bT + 3, 1, 1, pal.skin);
      pxc(P.x, 13, bT + 1, 2, 2, W.trim);
      pxc(P.x, 13, bT + 1, 1, 1, W.glint);
      return P.c;
    })();
    const f12 = (() => {
      const P = poseCanvas(pal, "side", 0);
      clearArmFront(P.x, P.bT);
      const bT = P.bT;
      px2(P.x, 9, bT + 1, 4, 2, pal.body);
      px2(P.x, 13, bT + 1, 1, 2, pal.skin);
      pxc(P.x, 14, bT, 2, 4, W.trim);
      pxc(P.x, 14, bT + 1, 2, 2, W.glint);
      pxc(P.x, 14, bT + 1, 1, 2, "#ffffff");
      pxc(P.x, 13, bT - 1, 1, 1, W.trim);
      pxc(P.x, 15, bT + 4, 1, 1, W.glint);
      return P.c;
    })();
    return [f02, f12];
  }
  const f0 = (() => {
    const P = poseCanvas(pal, dir3, 0);
    clearArmL(P.x, P.bT, P.L.armLen);
    clearArmR(P.x, P.bT, P.L.armLen);
    const bT = P.bT;
    if (dir3 === "down") {
      px2(P.x, 3, bT + 1, 2, 2, pal.body);
      px2(P.x, 5, bT + 1, 1, 2, pal.skin);
      px2(P.x, 11, bT + 1, 2, 2, pal.body);
      px2(P.x, 10, bT + 1, 1, 2, pal.skin);
      pxc(P.x, 7, bT + 1, 2, 2, W.trim);
      pxc(P.x, 7, bT + 1, 1, 1, W.glint);
    } else {
      px2(P.x, 2, bT - 2, 2, 3, pal.body);
      px2(P.x, 2, bT - 3, 2, 1, pal.skin);
      px2(P.x, 12, bT - 2, 2, 3, pal.body);
      px2(P.x, 12, bT - 3, 2, 1, pal.skin);
      pxc(P.x, 7, bT - 4, 2, 2, W.trim);
      pxc(P.x, 7, bT - 4, 1, 1, W.glint);
    }
    return P.c;
  })();
  const f1 = (() => {
    const P = poseCanvas(pal, dir3, 0);
    clearArmL(P.x, P.bT, P.L.armLen);
    clearArmR(P.x, P.bT, P.L.armLen);
    const bT = P.bT;
    if (dir3 === "down") {
      px2(P.x, 4, bT + 2, 2, 2, pal.body);
      px2(P.x, 4, bT + 4, 2, 1, pal.skin);
      px2(P.x, 10, bT + 2, 2, 2, pal.body);
      px2(P.x, 10, bT + 4, 2, 1, pal.skin);
      pxc(P.x, 6, bT + 2, 4, 3, W.trim);
      pxc(P.x, 7, bT + 3, 2, 1, W.glint);
      pxc(P.x, 7, bT + 3, 1, 1, "#ffffff");
      pxc(P.x, 5, bT + 1, 1, 1, W.trim);
      pxc(P.x, 10, bT + 5, 1, 1, W.glint);
    } else {
      px2(P.x, 2, bT - 3, 2, 3, pal.body);
      px2(P.x, 2, bT - 4, 2, 1, pal.skin);
      px2(P.x, 12, bT - 3, 2, 3, pal.body);
      px2(P.x, 12, bT - 4, 2, 1, pal.skin);
      pxc(P.x, 6, bT - 7, 4, 3, W.trim);
      pxc(P.x, 7, bT - 6, 2, 1, W.glint);
      pxc(P.x, 7, bT - 6, 1, 1, "#ffffff");
      pxc(P.x, 5, bT - 4, 1, 1, W.trim);
      pxc(P.x, 10, bT - 8, 1, 1, W.glint);
    }
    return P.c;
  })();
  return [f0, f1];
}
function buildCombatPose(baseName, dir, kind) {
  if (dir !== "down" && dir !== "up" && dir !== "left" && dir !== "right")
    return null;
  if (kind === "attack" ? !ATTACK_POSES.has(baseName) : !CAST_POSES.has(baseName))
    return null;
  const pal = PALS[baseName];
  const W = WEAPONS[baseName];
  if (!pal || !W)
    return null;
  const dir3 = dir === "down" || dir === "up" ? dir : "side";
  const sideDir = dir === "down" ? "down" : dir === "up" ? "up" : "right";
  const frames = kind === "cast" ? castPoses(pal, W, dir3) : baseName === "ilwen" ? bowPoses(pal, W, dir3) : weaponPoses(pal, W, dir3, sideDir);
  return frames.length === 2 ? [frames[0], frames[1]] : null;
}
function drawSlashArc(ctx, cx, cy, dir, prog, combo, charged, zoom) {
  const base = dir === "down" ? Math.PI / 2 : dir === "up" ? -Math.PI / 2 : dir === "left" ? Math.PI : 0;
  const colors = charged ? "#ffd24a" : ["#f2f6fa", "#ffe86a", "#ffc040"][Math.max(0, Math.min(2, combo))];
  const edgeC = charged ? "#fff3c0" : "#ffffff";
  const r = (charged ? 27 : 19) * zoom;
  const span = 1.2;
  const a0 = base - 1.1 + prog * 1.45;
  ctx.save();
  if (charged) {
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a0 + span);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.07;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r * 1.22, a0 + 0.08, a0 + span - 0.08);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 3;i >= 1; i--) {
    const p2 = prog - i * 0.13;
    if (p2 <= 0)
      continue;
    ctx.globalAlpha = (charged ? 0.3 : 0.22) - i * 0.055;
    ctx.strokeStyle = colors;
    ctx.lineWidth = Math.max(1, (charged ? 5 : 3) - i);
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1 - i * 0.045), base - 1.1 + p2 * 1.45, base - 1.1 + p2 * 1.45 + span * 0.75);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = colors;
  ctx.lineWidth = charged ? 7 : 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a0 + span);
  ctx.stroke();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = charged ? 5 : 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r - zoom, a0 + span * 0.06, a0 + span * 0.98);
  ctx.stroke();
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = charged ? 3 : 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2 * zoom, a0 + span * 0.12, a0 + span * 0.92);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = edgeC;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0 + span - 0.22, a0 + span);
  ctx.stroke();
  if (prog > 0.72) {
    const k = (prog - 0.72) / 0.28;
    const tipA = a0 + span;
    const tx = cx + Math.cos(tipA) * r, ty = cy + Math.sin(tipA) * r;
    ctx.globalAlpha = 1 - k * 0.7;
    for (let i = 0;i < 4; i++) {
      const sa = tipA - 0.9 + i * 0.6;
      const len = (3 + i % 2 * 3) * zoom * (0.6 + k * 0.9);
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(sa) * 2, ty + Math.sin(sa) * 2);
      ctx.lineTo(tx + Math.cos(sa) * (2 + len), ty + Math.sin(sa) * (2 + len));
      ctx.stroke();
    }
  }
  if (charged) {
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(prog * Math.PI);
    ctx.strokeStyle = "#ffe86a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4 * zoom, a0 + 0.15, a0 + span - 0.1);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 7 * zoom, a0 + 0.3, a0 + span - 0.25);
    ctx.stroke();
  }
  ctx.restore();
}
var PORTRAITS = {
  hero_alba: {
    kind: "human",
    bg: "#1a1218",
    skin: "#f2c99c",
    skinS: "#d8a878",
    hair: "#c8384a",
    hairS: "#9a2438",
    eye: "#2a2a3a",
    cloth: "#5a6070",
    clothS: "#474c5a",
    accent: "#c8384a",
    hood: true,
    hoodCol: "#a83044"
  },
  hero_tejedor: {
    kind: "human",
    bg: "#181228",
    skin: "#f2c99c",
    skinS: "#d8a878",
    hair: "#8a5ac0",
    hairS: "#6a3f9a",
    eye: "#3ae0c8",
    cloth: "#7e58b8",
    clothS: "#5e3f92",
    accent: "#f0c84a",
    hood: true,
    hoodCol: "#6a44a0"
  },
  brisa: {
    kind: "human",
    bg: "#141a14",
    skin: "#eabf9a",
    skinS: "#c89a74",
    hair: "#d8dade",
    hairS: "#b0b4bc",
    eye: "#3a3a3a",
    cloth: "#7a9a6e",
    clothS: "#5e7a54",
    accent: "#e8d8a8",
    hairLong: true
  },
  toln: {
    kind: "human",
    bg: "#1a140e",
    skin: "#e0a87a",
    skinS: "#c08858",
    hair: "#6a4a2e",
    hairS: "#54381e",
    eye: "#2a2a2a",
    cloth: "#8a5a33",
    clothS: "#6d4520",
    accent: "#3a3a3e",
    beard: "#6a4a2e"
  },
  ilwen: {
    kind: "human",
    bg: "#101a10",
    skin: "#f2d0a8",
    skinS: "#d0ac84",
    hair: "#8ad058",
    hairS: "#64a83e",
    eye: "#2a4a2e",
    cloth: "#3e7d4c",
    clothS: "#2e5f3a",
    accent: "#e8c860",
    ears: "elf",
    hairLong: true
  },
  sasha: {
    kind: "human",
    bg: "#120e18",
    skin: "#e8c49a",
    skinS: "#c49a70",
    hair: "#2e2838",
    hairS: "#221c2c",
    eye: "#f0c040",
    cloth: "#3a3448",
    clothS: "#2a2438",
    accent: "#c89a3a",
    hood: true,
    hoodCol: "#262032",
    ears: "cat"
  },
  brokk: {
    kind: "human",
    bg: "#1a120a",
    skin: "#e8a878",
    skinS: "#c4885a",
    hair: "#8a4a26",
    hairS: "#6d3a1e",
    eye: "#2a2a2a",
    cloth: "#5a4a3a",
    clothS: "#443828",
    accent: "#b07030",
    beard: "#a44e28"
  },
  maelis: {
    kind: "human",
    bg: "#0e1c20",
    skin: "#f0d8c0",
    skinS: "#ccb094",
    hair: "#7ad8c8",
    hairS: "#54b0a4",
    eye: "#2a8a8a",
    cloth: "#4aa8b0",
    clothS: "#368088",
    accent: "#e8f0ea",
    hairLong: true
  },
  corvin: {
    kind: "human",
    bg: "#141418",
    skin: "#eac8a0",
    skinS: "#c6a67e",
    hair: "#5a5a64",
    hairS: "#42424a",
    eye: "#3a3a44",
    cloth: "#3e3e48",
    clothS: "#2e2e38",
    accent: "#8a8a96"
  },
  kael: {
    kind: "human",
    bg: "#16161c",
    skin: "#f2d4b0",
    skinS: "#d0b088",
    hair: "#e8e0c8",
    hairS: "#c8bc9c",
    eye: "#7a8894",
    cloth: "#e8e6de",
    clothS: "#c2c0b6",
    accent: "#8a94a8"
  },
  inquisidor: {
    kind: "mask",
    bg: "#141416",
    skin: "#d8d4ca",
    skinS: "#b8b4aa",
    hair: "#e4e2da",
    hairS: "#c6c4ba",
    eye: "#d8d4ca",
    cloth: "#e4e2da",
    clothS: "#bcbab0",
    accent: "#8a887e"
  },
  teo: {
    kind: "human",
    bg: "#181208",
    skin: "#f2cfa4",
    skinS: "#d0aa78",
    hair: "#7a5432",
    hairS: "#5e4026",
    eye: "#3a2a1a",
    cloth: "#c09a54",
    clothS: "#9a7a40",
    accent: "#7a5432",
    child: true
  },
  doran: {
    kind: "human",
    bg: "#101a10",
    skin: "#d8b088",
    skinS: "#b4906a",
    hair: "#3e6a34",
    hairS: "#2e5226",
    eye: "#2a3a24",
    cloth: "#4a7a3e",
    clothS: "#375e2e",
    accent: "#8ac05a",
    hood: true,
    hoodCol: "#2e5226"
  },
  nimue: {
    kind: "human",
    bg: "#0e1614",
    skin: "#e4e8de",
    skinS: "#c0c8ba",
    hair: "#b8d8c8",
    hairS: "#94b8a8",
    eye: "#7ae8c0",
    cloth: "#5a8a72",
    clothS: "#446a58",
    accent: "#bff0dc",
    ears: "elf",
    hairLong: true
  },
  guardian: {
    kind: "guardian",
    bg: "#0c0a16",
    skin: "#4a4660",
    skinS: "#3a364c",
    hair: "#5f5a7a",
    hairS: "#4a4660",
    eye: "#7ee8ff",
    cloth: "#2c2440",
    clothS: "#221c33"
  },
  sombra: {
    kind: "sombra",
    bg: "#0a0812",
    skin: "#241c38",
    skinS: "#181226",
    hair: "#2c2440",
    hairS: "#201a30",
    eye: "#b48fff",
    cloth: "#241c38",
    clothS: "#181226"
  },
  wisp: {
    kind: "wisp",
    bg: "#0a1414",
    skin: "#bff4e8",
    skinS: "#7fe0cc",
    hair: "#bff4e8",
    hairS: "#7fe0cc",
    eye: "#ffffff",
    cloth: "#7fe0cc",
    clothS: "#5ab8a8"
  },
  fragment: {
    kind: "crystal",
    bg: "#141020",
    skin: "#ffe9a0",
    skinS: "#f0c84a",
    hair: "#ffe9a0",
    hairS: "#f0c84a",
    eye: "#fffbe0",
    cloth: "#f0c84a",
    clothS: "#c89830"
  },
  sanctuary: {
    kind: "sanctuary",
    bg: "#0c1420",
    skin: "#8ef0ff",
    skinS: "#5ac8dc",
    hair: "#8ef0ff",
    hairS: "#5ac8dc",
    eye: "#e8fbff",
    cloth: "#5a6a8a",
    clothS: "#42506c"
  }
};
var PORTRAIT_OUTLINE = "#1a1420";
function drawPortrait(ctx, key, dx, dy, scale, blink = false) {
  const P = PORTRAITS[key] ?? PORTRAITS["wisp"];
  const q = (X, Y, W, H, C) => {
    ctx.fillStyle = C;
    ctx.fillRect(dx + X * scale, dy + Y * scale, W * scale, H * scale);
  };
  const O = PORTRAIT_OUTLINE;
  q(0, 0, 28, 40, P.bg);
  q(0, 0, 28, 1, "rgba(255,255,255,0.05)");
  ctx.globalAlpha = 0.25;
  q(0, 34, 28, 6, "#000");
  ctx.globalAlpha = 1;
  if (P.kind === "guardian") {
    q(1, 30, 26, 10, P.cloth);
    q(5, 27, 18, 6, P.hairS ?? P.hair);
    q(11, 31, 6, 6, O);
    q(12, 32, 4, 4, P.eye);
    q(7, 7, 14, 13, P.hair);
    q(7, 7, 14, 2, "#8a84a8");
    q(4, 2, 3, 9, "#8a84a8");
    q(21, 2, 3, 9, "#8a84a8");
    q(3, 0, 2, 3, "#8a84a8");
    q(23, 0, 2, 3, "#8a84a8");
    q(10, 13, 3, 3, O);
    q(15, 13, 3, 3, O);
    q(10, 13, 2, 2, P.eye);
    q(16, 13, 2, 2, P.eye);
    q(7, 10, 1, 6, O);
    q(20, 16, 1, 4, O);
    return;
  }
  if (P.kind === "sombra") {
    q(2, 30, 24, 10, P.clothS);
    q(3, 2, 22, 11, P.hair);
    q(3, 13, 5, 21, P.hair);
    q(20, 13, 5, 21, P.hair);
    q(7, 10, 14, 18, "#0c0816");
    q(10, 16, 3, 3, P.eye);
    q(15, 16, 3, 3, P.eye);
    ctx.globalAlpha = 0.5;
    q(9, 15, 5, 5, P.eye);
    q(14, 15, 5, 5, P.eye);
    ctx.globalAlpha = 1;
    return;
  }
  if (P.kind === "wisp") {
    ctx.globalAlpha = 0.3;
    q(7, 8, 14, 20, P.skinS);
    ctx.globalAlpha = 0.55;
    q(9, 10, 10, 16, P.skin);
    ctx.globalAlpha = 1;
    q(11, 13, 6, 10, "#eafff8");
    q(12, 16, 1, 2, P.eye);
    q(15, 16, 1, 2, P.eye);
    if (blink) {
      q(12, 17, 4, 1, P.skinS);
    }
    ctx.globalAlpha = 0.3;
    q(6, 6, 2, 2, P.skinS);
    q(20, 9, 2, 2, P.skinS);
    q(8, 28, 2, 2, P.skinS);
    ctx.globalAlpha = 1;
    return;
  }
  if (P.kind === "crystal") {
    q(12, 6, 4, 28, P.skinS);
    q(9, 10, 10, 20, P.skinS);
    q(11, 12, 6, 16, P.skin);
    q(13, 15, 2, 6, P.eye);
    q(4, 30, 20, 8, "#3a3020");
    q(4, 30, 20, 1, "#5a4a2c");
    ctx.globalAlpha = 0.6;
    q(6, 12, 2, 2, P.skinS);
    q(20, 18, 2, 2, P.skinS);
    q(8, 24, 2, 2, P.skinS);
    ctx.globalAlpha = 1;
    return;
  }
  if (P.kind === "sanctuary") {
    q(10, 5, 8, 24, P.skinS);
    q(12, 7, 4, 20, P.skin);
    q(13, 12, 2, 5, P.eye);
    q(4, 29, 20, 9, P.clothS);
    q(4, 29, 20, 1, P.cloth);
    q(6, 31, 2, 1, "#2c3448");
    q(14, 33, 3, 1, "#2c3448");
    q(19, 30, 2, 1, "#2c3448");
    ctx.globalAlpha = 0.35;
    q(8, 4, 12, 26, P.skinS);
    ctx.globalAlpha = 1;
    return;
  }
  q(1, 31, 26, 9, P.cloth);
  q(1, 31, 26, 2, P.clothS);
  if (P.accent)
    q(1, 31, 26, 1, P.accent);
  q(11, 27, 6, 6, P.skinS);
  if (P.hairLong) {
    q(4, 8, 20, 22, P.hair);
  }
  q(7, 9, 14, 17, P.skin);
  q(9, 25, 10, 4, P.skin);
  q(7, 23, 2, 3, P.skinS);
  q(19, 23, 2, 3, P.skinS);
  if (P.ears === "elf") {
    q(5, 15, 2, 4, P.skin);
    q(21, 15, 2, 4, P.skin);
    q(4, 14, 1, 2, P.skin);
    q(23, 14, 1, 2, P.skin);
  }
  if (P.kind === "mask") {
    q(7, 9, 14, 17, P.skin);
    q(9, 25, 10, 4, P.skin);
    q(9, 11, 4, 9, "rgba(255,255,255,0.14)");
    q(14, 10, 1, 15, "rgba(0,0,0,0.12)");
    q(7, 9, 14, 1, P.hairS ?? P.hair);
    q(5, 4, 18, 7, P.hair);
    q(5, 4, 18, 2, P.hairS ?? P.hair);
    q(3, 9, 3, 10, P.hair);
    q(22, 9, 3, 10, P.hair);
    return;
  }
  q(9, 14, 4, 1, P.hairS ?? P.hair);
  q(15, 14, 4, 1, P.hairS ?? P.hair);
  if (P.child) {
    q(8, 16, 5, 4, O);
    q(15, 16, 5, 4, O);
    if (blink) {
      q(8, 18, 5, 1, P.hairS ?? P.hair);
      q(15, 18, 5, 1, P.hairS ?? P.hair);
    } else {
      q(9, 17, 3, 2, P.eye);
      q(16, 17, 3, 2, P.eye);
      q(9, 17, 1, 1, "#ffffff");
      q(16, 17, 1, 1, "#ffffff");
    }
  } else {
    q(9, 17, 4, 3, O);
    q(15, 17, 4, 3, O);
    if (blink) {
      q(9, 18, 4, 1, P.hairS ?? P.hair);
      q(15, 18, 4, 1, P.hairS ?? P.hair);
    } else {
      q(10, 17, 2, 2, P.eye);
      q(16, 17, 2, 2, P.eye);
      q(10, 17, 1, 1, "#ffffff");
      q(16, 17, 1, 1, "#ffffff");
    }
  }
  q(13, 21, 2, 2, P.skinS);
  if (!P.beard) {
    if (key === "corvin" || key === "sasha") {
      q(11, 24, 5, 1, "#9a5a50");
      q(16, 23, 1, 1, "#9a5a50");
    } else
      q(11, 24, 6, 1, "#9a5a50");
  }
  if (P.beard) {
    q(8, 22, 12, 9, P.beard);
    q(8, 22, 12, 1, P.hairS ?? P.beard);
    if (key === "brokk") {
      q(12, 27, 4, 6, P.beard);
      q(12, 27, 1, 6, P.hairS ?? P.beard);
      q(12, 32, 4, 1, P.accent ?? "#b07030");
      q(11, 24, 1, 3, P.hairS ?? P.beard);
      q(16, 24, 1, 3, P.hairS ?? P.beard);
    }
  }
  q(6, 5, 16, 7, P.hair);
  q(7, 11, 14, 2, P.hairS ?? P.hair);
  q(5, 10, 3, 9, P.hair);
  q(20, 10, 3, 9, P.hair);
  if (P.hairLong) {
    q(4, 8, 3, 22, P.hair);
    q(21, 8, 3, 22, P.hair);
  }
  if (P.child) {
    q(5, 3, 3, 2, P.hair);
    q(12, 2, 4, 3, P.hair);
    q(19, 3, 3, 2, P.hair);
  }
  if (P.hood) {
    const hc = P.hoodCol ?? P.hair;
    q(3, 2, 22, 9, hc);
    q(3, 11, 4, 16, hc);
    q(21, 11, 4, 16, hc);
    q(6, 9, 2, 15, "rgba(0,0,0,0.3)");
    q(20, 9, 2, 15, "rgba(0,0,0,0.3)");
    q(3, 2, 22, 1, "rgba(255,255,255,0.12)");
    if (P.ears === "cat") {
      q(5, 0, 3, 4, hc);
      q(20, 0, 3, 4, hc);
      q(6, 1, 1, 2, "#d88a8a");
      q(21, 1, 1, 2, "#d88a8a");
    }
  }
  if (key === "brisa") {
    q(9, 13, 10, 1, "rgba(0,0,0,0.10)");
    q(8, 20, 1, 2, "rgba(0,0,0,0.07)");
    q(19, 20, 1, 2, "rgba(0,0,0,0.07)");
  }
}
var TILE = 16;
function drawTile(x, ch, tx, ty, mapId, t, at) {
  switch (ch) {
    case ".":
    case ",":
    case "c":
    case "m":
      paintGrass(x, ch, tx, ty, mapId, t, at);
      break;
    case "~":
    case "B":
    case "x":
      paintWater(x, ch, tx, ty, mapId, t, at);
      break;
    case ":":
    case "_":
    case "#":
    case "P":
    case "A":
    case "V":
      paintStone(x, ch, tx, ty, mapId, t, at);
      break;
    case "H":
    case "r":
    case "d":
    case "F":
    case "w":
    case "g":
    case "R":
      paintVillage(x, ch, tx, ty, mapId, t, at);
      break;
    default:
      px2(x, tx * TILE, ty * TILE, TILE, TILE, "#4f8a46");
  }
}
function isTallTile(ch) {
  return ch === "t" || ch === "p";
}
function drawTallTile(x, ch, tx, ty, mapId, at) {
  paintTall(x, ch, tx, ty, mapId, at);
}
var SOLID_CHARS = new Set(["t", "p", "#", "H", "r", "F", "R", "w", "g", "P", "A", "V", "~", "d", "x", "n"]);

// src/game/sprites_expansion.ts
function cv(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  return { c, x };
}
function rc(x, rx, ry, rw, rh, col) {
  x.fillStyle = col;
  x.fillRect(rx, ry, rw, rh);
}
function disc(x, cx, cy, r, col, alpha = 1) {
  x.globalAlpha = alpha;
  x.fillStyle = col;
  const top = Math.ceil(r);
  for (let dy = -top;dy <= top; dy++) {
    const w = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (w < 0.35 && Math.abs(dy) > 0)
      continue;
    x.fillRect(Math.round(cx - w), cy + dy, Math.max(1, Math.round(w * 2 + 1)), 1);
  }
  x.globalAlpha = 1;
}
function mulberry323(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function buildNeumo() {
  const frames = [];
  for (let f = 0;f < 3; f++) {
    const { c, x } = cv(16, 16);
    const O = "#1c5a5e", BD = "#4ec2b8", B = "#7fe8d8", HL = "#d8fcf4", EYE = "#173038";
    const puff = f === 2;
    const bob = f === 1 ? 1 : 0;
    const R = puff ? 6.6 : f === 0 ? 5.6 : 5.9;
    const cy = 8 + (puff ? -0.5 : bob * 0.5);
    disc(x, 8, cy, R, O, 0.85);
    disc(x, 8, cy, R - 1.1, BD, 0.72);
    disc(x, 8, cy, R - 2.2, B, 0.66);
    x.globalAlpha = 0.85;
    const lob = puff ? [[0, -1], [0, 1], [-1, 0], [1, 0]] : f === 0 ? [[-0.7, -0.7], [0.7, 0.7]] : [[0.7, -0.7], [-0.7, 0.7]];
    for (const [lx, ly] of lob) {
      disc(x, 8 + lx * (R - 0.6), cy + ly * (R - 0.6), 1.4, BD, 0.9);
    }
    x.globalAlpha = 0.55;
    if (f === 0) {
      rc(x, 7, 6, 2, 1, B);
      rc(x, 9, 8, 1, 2, B);
    } else if (f === 1) {
      rc(x, 7, 9, 2, 1, B);
      rc(x, 6, 6, 1, 2, B);
    } else {
      rc(x, 6, 7, 4, 1, B);
      rc(x, 7, 9, 2, 1, B);
    }
    x.globalAlpha = 0.92;
    rc(x, 5, 4 + bob - (puff ? 1 : 0), 3, 2, HL);
    rc(x, 4, 5 + bob, 1, 1, HL);
    x.globalAlpha = 0.55;
    rc(x, 9, 5 + bob, 1, 2, HL);
    x.globalAlpha = 1;
    rc(x, 9, 7 + bob, 2, 2, EYE);
    rc(x, 9, 7 + bob, 1, 1, "#ffffff");
    if (puff) {
      x.globalAlpha = 0.8;
      rc(x, 8, 6, 1, 1, "#ffffff");
      x.globalAlpha = 1;
    }
    x.globalAlpha = 0.7;
    rc(x, 3, 12, 2, 2, B);
    rc(x, 11, 12 + (puff ? 0 : bob), 2, 1, B);
    rc(x, 7, 13, 1, 1, HL);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
function buildEspectro() {
  const frames = [];
  for (let f = 0;f < 3; f++) {
    const { c, x } = cv(16, 16);
    const O = "#3a4a5e", B = "#c9d4e4", S = "#a2b2c8", EYE = "#232e42";
    const phase = f === 2;
    const dy = f === 1 ? -1 : 0;
    if (phase) {
      x.globalAlpha = 0.4;
      rc(x, 4, 7 + dy, 8, 5, B);
      rc(x, 5, 11 + dy, 6, 3, B);
      x.globalAlpha = 0.7;
      rc(x, 5, 2 + dy, 6, 5, B);
      rc(x, 4, 3 + dy, 8, 3, B);
      x.globalAlpha = 0.5;
      rc(x, 4, 2 + dy, 3, 1, O);
      rc(x, 9, 2 + dy, 3, 1, O);
      rc(x, 4, 3 + dy, 1, 4, O);
      rc(x, 11, 4 + dy, 1, 3, O);
      x.globalAlpha = 0.35;
      rc(x, 5, 13 + dy, 1, 3, B);
      rc(x, 8, 13 + dy, 2, 2, B);
      rc(x, 11, 12 + dy, 1, 3, B);
      x.globalAlpha = 1;
      rc(x, 6, 4 + dy, 1, 2, "#8ef0ff");
      rc(x, 9, 4 + dy, 1, 2, "#8ef0ff");
      x.globalAlpha = 0.6;
      rc(x, 6, 3 + dy, 1, 1, "#d8f8ff");
      rc(x, 9, 3 + dy, 1, 1, "#d8f8ff");
      x.globalAlpha = 1;
      frames.push(c);
      continue;
    }
    x.globalAlpha = 0.88;
    rc(x, 4, 7 + dy, 8, 4, B);
    rc(x, 5, 11 + dy, 6, 2, B);
    rc(x, 4, 7 + dy, 1, 4, S);
    rc(x, 11, 7 + dy, 1, 4, S);
    x.globalAlpha = 0.95;
    rc(x, 5, 2 + dy, 6, 5, B);
    rc(x, 4, 3 + dy, 8, 3, B);
    rc(x, 5, 6 + dy, 6, 1, S);
    x.globalAlpha = 0.35;
    rc(x, 3, 4 + dy, 1, 6, B);
    rc(x, 12, 4 + dy, 1, 6, B);
    rc(x, 4, 13 + dy, 8, 1, B);
    x.globalAlpha = 0.55;
    if (f === 0) {
      rc(x, 6, 13, 2, 2, S);
      rc(x, 9, 13, 1, 1, S);
    } else {
      rc(x, 5, 12, 1, 2, S);
      rc(x, 8, 13, 2, 1, S);
    }
    x.globalAlpha = f === 0 ? 0.5 : 0.35;
    rc(x, 6 + f, 8 + dy, 2, 2, O);
    x.globalAlpha = f === 0 ? 0.3 : 0.5;
    rc(x, 9 - f, 9 + dy, 1, 2, O);
    x.globalAlpha = 0.22;
    rc(x, 5, 10 + dy, 1, 1, O);
    x.globalAlpha = 1;
    rc(x, 6, 4 + dy, 1, 2, EYE);
    rc(x, 9, 4 + dy, 1, 2, EYE);
    x.globalAlpha = 0.5;
    rc(x, 7, 6 + dy, 2, 1, EYE);
    x.globalAlpha = 0.38;
    rc(x, 4, 2 + dy, 8, 1, O);
    rc(x, 4, 2 + dy, 1, 4, O);
    rc(x, 11, 2 + dy, 1, 4, O);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
function buildArpi() {
  const frames = [];
  for (let f = 0;f < 3; f++) {
    const { c, x } = cv(16, 16);
    const O = "#2e4256", W = "#eef6fc", WS = "#bcdcf0", WSD = "#8fb8d8", BK = "#8a94a0", EYE = "#1e2c3a";
    const glide = f === 2;
    const bodyY = glide ? 7 : f === 0 ? 7 : 8;
    x.globalAlpha = 1;
    if (f === 0) {
      rc(x, 3, 1, 3, 5, WS);
      rc(x, 2, 2, 2, 5, WS);
      rc(x, 4, 0, 2, 2, W);
      rc(x, 10, 1, 3, 5, WS);
      rc(x, 12, 2, 2, 5, WS);
      rc(x, 10, 0, 2, 2, W);
      rc(x, 3, 2, 1, 3, W);
      rc(x, 12, 2, 1, 3, W);
    } else if (f === 1) {
      rc(x, 2, 10, 3, 4, WS);
      rc(x, 1, 12, 2, 3, WS);
      rc(x, 3, 9, 2, 1, W);
      rc(x, 11, 10, 3, 4, WS);
      rc(x, 13, 12, 2, 3, WS);
      rc(x, 11, 9, 2, 1, W);
      rc(x, 2, 11, 1, 2, W);
      rc(x, 13, 11, 1, 2, W);
    } else {
      rc(x, 1, 6, 5, 2, WS);
      rc(x, 0, 6, 2, 1, W);
      rc(x, 2, 8, 3, 1, WSD);
      rc(x, 10, 6, 5, 2, WS);
      rc(x, 14, 6, 2, 1, W);
      rc(x, 11, 8, 3, 1, WSD);
      rc(x, 1, 6, 4, 1, W);
      rc(x, 11, 6, 4, 1, W);
    }
    rc(x, glide ? 1 : 2, bodyY + 2, 3, 2, WSD);
    rc(x, glide ? 0 : 1, bodyY + 3, 1, 1, WSD);
    rc(x, 5, bodyY, 6, 4, W);
    rc(x, 6, bodyY - 1, 4, 6, W);
    rc(x, 5, bodyY + 3, 6, 1, WS);
    rc(x, 6, bodyY + 4, 4, 1, WS);
    if (glide)
      rc(x, 6, bodyY + 5, 4, 1, WSD);
    rc(x, 9, bodyY - 3, 4, 4, W);
    rc(x, 9, bodyY, 4, 1, WS);
    rc(x, 13, bodyY - 2, 2, 2, BK);
    rc(x, 15, bodyY - 1, 1, 1, BK);
    rc(x, 11, bodyY - 2, 1, 1, EYE);
    x.globalAlpha = 0.5;
    rc(x, 5, bodyY - 1, 4, 1, O);
    rc(x, 9, bodyY - 3, 4, 1, O);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
function buildSirena() {
  const HAIR = "#1f5a5c", HAIR2 = "#3f9a8c", HAIR3 = "#8fe8d0", SKIN = "#cfe8dc", SKINS = "#a3c4b4", GLOW = "#8ff2d8", GLOW2 = "#d8fff2", WOOD = "#6d4a2a", WOODD = "#4a3018", GOLD = "#f0c84a", ROPE = "#9a7a4a", BARN = "#e4e0d0", TOP = "#2e7a6e", TOPTRIM = "#dceee6", TAIL = "#2e8a7a", TAIL2 = "#48b09a", FIN = "#5fd0b4", FIN2 = "#8fe8d0", FOAM = "#eef8f4", EYE = "#123a3e", IRIS = "#8ff2d8", AQUA = "#4fb8d8", AQUAD = "#2e88b8", WATER = "#3f8ab8", WATERD = "#2e6a94";
  const frames = [];
  for (let f = 0;f < 5; f++) {
    const { c, x } = cv(36, 36);
    if (f === 4) {
      x.globalAlpha = 0.16;
      rc(x, 12, 20, 12, 6, TAIL);
      rc(x, 13, 26, 10, 3, TAIL2);
      rc(x, 8, 29, 8, 3, FIN);
      rc(x, 20, 29, 8, 3, FIN);
      x.globalAlpha = 1;
      const hy2 = 6;
      rc(x, 11, 5, 14, 1, ROPE);
      rc(x, 11, 1, 3, 4, WOOD);
      rc(x, 13, 1, 1, 4, WOODD);
      rc(x, 12, 2, 1, 1, GOLD);
      rc(x, 16, 2, 2, 3, WOODD);
      rc(x, 17, 1, 1, 1, WOOD);
      rc(x, 22, 1, 3, 4, WOOD);
      rc(x, 24, 1, 1, 4, WOODD);
      rc(x, 23, 2, 1, 1, GOLD);
      rc(x, 10, 4, 1, 1, BARN);
      rc(x, 25, 4, 1, 1, BARN);
      rc(x, 15, 4, 1, 1, BARN);
      x.globalAlpha = 0.9;
      rc(x, 8, hy2, 4, 6, HAIR);
      rc(x, 24, hy2, 4, 6, HAIR);
      x.globalAlpha = 0.6;
      rc(x, 5, hy2 + 4, 4, 2, HAIR2);
      rc(x, 27, hy2 + 4, 4, 2, HAIR2);
      rc(x, 4, hy2 + 6, 2, 1, HAIR3);
      rc(x, 30, hy2 + 6, 2, 1, HAIR3);
      x.globalAlpha = 1;
      rc(x, 13, hy2, 10, 8, SKIN);
      rc(x, 12, hy2, 12, 2, HAIR2);
      rc(x, 12, hy2 + 2, 3, 1, HAIR2);
      rc(x, 21, hy2 + 2, 3, 1, HAIR2);
      rc(x, 14, hy2 + 3, 2, 2, EYE);
      rc(x, 20, hy2 + 3, 2, 2, EYE);
      rc(x, 14, hy2 + 3, 1, 1, IRIS);
      rc(x, 20, hy2 + 3, 1, 1, IRIS);
      x.globalAlpha = 0.85;
      rc(x, 12, hy2 + 4, 1, 1, GLOW);
      rc(x, 23, hy2 + 3, 1, 1, GLOW);
      x.globalAlpha = 1;
      rc(x, 17, hy2 + 7, 2, 1, "#6a8a80");
      rc(x, 13, 14, 10, 2, SKIN);
      rc(x, 14, 15, 1, 1, GLOW);
      x.globalAlpha = 0.8;
      rc(x, 6, 16, 24, 1, WATER);
      x.globalAlpha = 0.65;
      rc(x, 5, 17, 26, 2, WATERD);
      x.globalAlpha = 0.9;
      rc(x, 8, 16, 3, 1, FOAM);
      rc(x, 14, 16, 2, 1, FOAM);
      rc(x, 21, 17, 3, 1, FOAM);
      rc(x, 27, 16, 2, 1, FOAM);
      x.globalAlpha = 0.4;
      rc(x, 3, 18, 5, 1, "#bfe4ea");
      rc(x, 28, 19, 5, 1, "#bfe4ea");
      x.globalAlpha = 0.75;
      rc(x, 10, 13, 1, 1, FOAM);
      rc(x, 25, 12, 1, 1, FOAM);
      rc(x, 17, 11, 1, 1, FOAM);
      x.globalAlpha = 1;
      frames.push(c);
      continue;
    }
    const bob = f === 1 ? 1 : 0;
    const sway = f === 0 ? 1 : -1;
    const inflate = f === 2;
    const whip = f === 3;
    const hy = 6 + bob;
    const ty = 16 + bob;
    const tyy = ty + 5;
    const fl = tyy + 8;
    x.globalAlpha = 0.95;
    rc(x, 10, hy - 2, 16, 15, HAIR);
    if (sway > 0) {
      rc(x, 6, hy, 2, 13, HAIR);
      rc(x, 27, hy, 2, 13, HAIR);
    } else {
      rc(x, 8, hy, 2, 13, HAIR);
      rc(x, 28, hy, 2, 13, HAIR);
    }
    x.globalAlpha = 0.6;
    rc(x, 5, hy + 11 + (sway > 0 ? 1 : 0), 3, 4, HAIR2);
    rc(x, 28, hy + 11 - (sway > 0 ? 1 : 0), 3, 4, HAIR2);
    x.globalAlpha = 0.8;
    rc(x, 7, hy + 8 + sway, 3, 6, HAIR2);
    rc(x, 26, hy + 8 - sway, 3, 6, HAIR2);
    x.globalAlpha = 0.8;
    rc(x, 6, hy + 15 + (sway > 0 ? 1 : 0), 1, 1, HAIR3);
    rc(x, 29, hy + 15 - (sway > 0 ? 1 : 0), 1, 1, HAIR3);
    x.globalAlpha = 1;
    if (inflate)
      disc(x, 17.5, 18, 13.5, GLOW, 0.2);
    rc(x, 11, tyy, 14, 3, TAIL);
    rc(x, 12, tyy + 3, 12, 2, TAIL);
    rc(x, 13, tyy + 5, 10, 2, TAIL2);
    rc(x, 14, tyy + 7, 8, 1, TAIL2);
    const lobeL = whip ? 1 : inflate ? 0 : f === 0 ? 0 : 1;
    const lobeR = whip ? 1 : inflate ? 0 : 1 - lobeL;
    rc(x, 12, fl, 12, 2, FIN);
    rc(x, 5, fl - 1 + lobeL, 8, 3, FIN);
    rc(x, 3, fl + lobeL, 3, 2, FIN2);
    rc(x, 23, fl - 1 + lobeR, 8, 3, FIN);
    rc(x, 30, fl + lobeR, 3, 2, FIN2);
    x.globalAlpha = 0.9;
    rc(x, 3, fl + lobeL, 3, 1, FOAM);
    rc(x, 30, fl + lobeR, 3, 1, FOAM);
    rc(x, 6, fl - 1 + lobeL, 2, 1, FOAM);
    rc(x, 28, fl - 1 + lobeR, 2, 1, FOAM);
    x.globalAlpha = 1;
    x.globalAlpha = 0.7;
    rc(x, 13 + (sway > 0 ? 1 : 0), tyy + 1, 2, 1, TAIL2);
    rc(x, 18, tyy + 4, 2, 1, "#cfeee6");
    rc(x, 15, tyy + 6, 2, 1, FIN2);
    x.globalAlpha = 1;
    x.globalAlpha = 0.85;
    rc(x, 12 + (sway > 0 ? 1 : 0), tyy + 2, 1, 1, GLOW);
    rc(x, 22 - (sway > 0 ? 1 : 0), tyy + 3, 1, 1, GLOW);
    rc(x, 16, tyy + 6, 1, 1, GLOW2);
    rc(x, 19, tyy + 1, 1, 1, GLOW2);
    x.globalAlpha = 1;
    rc(x, 11, hy - 1, 14, 1, ROPE);
    rc(x, 11, hy - 5, 3, 4, WOOD);
    rc(x, 13, hy - 5, 1, 4, WOODD);
    rc(x, 12, hy - 4, 1, 1, GOLD);
    rc(x, 16, hy - 4, 2, 3, WOODD);
    rc(x, 17, hy - 5, 1, 1, WOOD);
    rc(x, 22, hy - 5, 3, 4, WOOD);
    rc(x, 24, hy - 5, 1, 4, WOODD);
    rc(x, 23, hy - 4, 1, 1, GOLD);
    rc(x, 10, hy - 2, 1, 1, BARN);
    rc(x, 25, hy - 2, 1, 1, BARN);
    rc(x, 15, hy - 2, 1, 1, BARN);
    if (inflate) {
      x.globalAlpha = 0.9;
      rc(x, 12, hy - 5, 1, 1, "#fff3c8");
      rc(x, 23, hy - 5, 1, 1, "#fff3c8");
      x.globalAlpha = 1;
    }
    rc(x, 13, hy, 10, 8, SKIN);
    rc(x, 13, hy + 6, 10, 2, SKINS);
    rc(x, 12, hy + 1, 1, 6, SKINS);
    rc(x, 23, hy + 1, 1, 6, SKINS);
    rc(x, 12, hy, 12, 2, HAIR2);
    rc(x, 12, hy + 2, 3, 1, HAIR2);
    rc(x, 21, hy + 2, 3, 1, HAIR2);
    rc(x, 14, hy + 2, 2, 1, SKINS);
    rc(x, 20, hy + 2, 2, 1, SKINS);
    if (whip) {
      rc(x, 14, hy + 3, 2, 1, IRIS);
      rc(x, 20, hy + 3, 2, 1, IRIS);
    } else {
      rc(x, 14, hy + 3, 2, 2, EYE);
      rc(x, 20, hy + 3, 2, 2, EYE);
      rc(x, 14, hy + 3, 1, 1, IRIS);
      rc(x, 20, hy + 3, 1, 1, IRIS);
    }
    if (inflate) {
      rc(x, 16, hy + 7, 3, 2, "#123a3e");
      x.globalAlpha = 0.85;
      rc(x, 17, hy + 7, 1, 1, GLOW);
      x.globalAlpha = 1;
    } else {
      rc(x, 17, hy + 7, 2, 1, "#6a8a80");
    }
    if (!inflate && !whip)
      rc(x, 15, hy + 5, 1, 1, "#bfe8f0");
    x.globalAlpha = 0.85;
    rc(x, 12, hy + 4, 1, 1, GLOW);
    rc(x, 23, hy + 3, 1, 1, GLOW);
    rc(x, 16, hy + 1, 1, 1, GLOW2);
    x.globalAlpha = 1;
    rc(x, 15, hy + 8, 6, 2, SKIN);
    rc(x, inflate ? 10 : 12, ty, inflate ? 16 : 12, 1, SKIN);
    const dw = inflate ? 16 : 14, dx0 = inflate ? 10 : 11;
    rc(x, dx0, ty + 1, dw, 4, TOP);
    rc(x, dx0, ty + 1, dw, 1, TOPTRIM);
    rc(x, dx0, ty + 4, dw, 1, "#256a60");
    rc(x, 14, ty + 2, 1, 1, TOPTRIM);
    rc(x, 16, ty + 3, 1, 1, TOPTRIM);
    rc(x, 19, ty + 3, 1, 1, TOPTRIM);
    rc(x, 21, ty + 2, 1, 1, TOPTRIM);
    if (inflate) {
      rc(x, 7, ty, 2, 4, SKIN);
      rc(x, 5, ty - 5, 2, 5, SKIN);
      rc(x, 3, ty - 7, 4, 2, FIN2);
      rc(x, 27, ty, 2, 4, SKIN);
      rc(x, 29, ty - 5, 2, 5, SKIN);
      rc(x, 29, ty - 7, 4, 2, FIN2);
      x.globalAlpha = 0.8;
      rc(x, 4, ty - 8, 2, 1, GLOW2);
      rc(x, 30, ty - 8, 2, 1, GLOW2);
      x.globalAlpha = 1;
    } else if (whip) {
      rc(x, 25, ty, 2, 4, SKIN);
      rc(x, 27, ty - 4, 2, 4, SKIN);
      rc(x, 27, ty - 6, 2, 2, SKIN);
      rc(x, 8, ty + 1, 2, 6, SKINS);
      rc(x, 29, 8, 2, 2, AQUA);
      rc(x, 31, 9, 2, 3, AQUA);
      rc(x, 33, 11, 2, 3, AQUAD);
      rc(x, 32, 14, 3, 2, AQUAD);
      rc(x, 30, 16, 3, 2, AQUA);
      rc(x, 28, 18, 2, 2, AQUA);
      rc(x, 26, 20, 2, 2, AQUAD);
      x.globalAlpha = 0.9;
      rc(x, 29, 7, 2, 1, FOAM);
      rc(x, 31, 8, 2, 1, FOAM);
      rc(x, 32, 13, 3, 1, FOAM);
      x.globalAlpha = 0.6;
      rc(x, 34, 15, 1, 1, AQUA);
      rc(x, 29, 21, 1, 1, AQUA);
      rc(x, 33, 6, 1, 1, FOAM);
      x.globalAlpha = 0.3;
      rc(x, 34, 12, 1, 5, "#bfe8f0");
      x.globalAlpha = 1;
    } else {
      rc(x, 9, ty, 2, 8, SKIN);
      rc(x, 9, ty, 1, 8, SKINS);
      rc(x, 25, ty, 2, 8, SKIN);
      rc(x, 26, ty, 1, 8, SKINS);
      x.globalAlpha = 0.8;
      rc(x, 9, ty + 8, 2, 1, GLOW);
      rc(x, 25, ty + 8, 2, 1, GLOW);
      x.globalAlpha = 1;
    }
    x.globalAlpha = 0.15;
    rc(x, 4, hy + 2, 2, 14, FIN2);
    rc(x, 30, hy + 2, 2, 14, FIN2);
    x.globalAlpha = 0.7;
    rc(x, 5, hy + 9 + sway, 1, 1, FOAM);
    rc(x, 30, hy + 8 - sway, 1, 1, FOAM);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
function buildGolem() {
  const O = "#1c3048", ICE = "#7ea8cc", ICED = "#5a86b0", ICEDD = "#456e96", L = "#a8cce8", XT = "#c8e4f4", SNOW = "#eef6fc", CRK = "#2c4666", STRATA = ["#82acce", "#6f9cc4", "#5a86b0", "#6f9cc4", "#82acce"], CORE = "#3ec8e8", CORE2 = "#8ef0ff", CORED = "#1c5a7a";
  const rnd = mulberry323(451022);
  const frames = [];
  for (let f = 0;f < 5; f++) {
    const { c, x } = cv(36, 36);
    const cracked = f === 4;
    const tel = f === 2;
    const smash = f === 3;
    const dy = smash ? 1 : 0;
    const tiltL = f === 0 || cracked ? 1 : 0;
    const tiltR = 1 - tiltL;
    rc(x, 8, 10 + dy, 20, 16, ICE);
    for (let i = 0;i < 5; i++)
      rc(x, 8, 10 + dy + i * 3, 20, 3, STRATA[i]);
    rc(x, 8, 10 + dy, 20, 1, L);
    rc(x, 8, 25 + dy, 20, 1, ICED);
    if (cracked)
      rc(x, 8, 25 + dy, 20, 1, "#3a5a7c");
    const crack = (cx, cy0, len, glow) => {
      let cxx = cx;
      for (let i = 0;i < len; i++) {
        rc(x, cxx, cy0 + i, 1, 1, CRK);
        if (glow && i > 0 && i < len - 1) {
          x.globalAlpha = 0.55;
          rc(x, cxx + 1, cy0 + i, 1, 1, CORE);
          x.globalAlpha = 1;
        }
        const rr = rnd();
        if (rr > 0.62)
          cxx += rr > 0.81 ? 1 : -1;
      }
    };
    crack(10, 12 + dy, 4, tel || smash);
    crack(26, 11 + dy, 3, tel || smash);
    crack(19, 22 + dy, 4, tel || smash || cracked);
    if (cracked) {
      crack(14, 10 + dy, 6, true);
      crack(23, 14 + dy, 5, true);
      crack(9, 19 + dy, 4, true);
      crack(21, 10 + dy, 3, true);
      rc(x, 6, 15 + dy, 3, 1, CRK);
      rc(x, 27, 18 + dy, 3, 1, CRK);
    }
    if (tel)
      disc(x, 17.5, 17.5 + dy, 8.5, CORE2, 0.3);
    rc(x, 12, 14 + dy, 10, 7, CORED);
    if (smash) {
      rc(x, 13, 15 + dy, 8, 5, CORE);
      rc(x, 14, 16 + dy, 6, 3, "#ffffff");
    } else if (cracked) {
      rc(x, 14, 15 + dy, 6, 4, "#2aa8c8");
      rc(x, 15, 16 + dy, 3, 2, CORE);
      x.globalAlpha = 0.7;
      rc(x, 16, 16 + dy, 1, 1, CRK);
      x.globalAlpha = 1;
    } else {
      rc(x, 13, 15 + dy, 8, 5, CORE);
      rc(x, 15, 16 + dy, 4, 3, CORE2);
      if (f === 1)
        disc(x, 16.5, 17 + dy, 3.5, CORE2, 0.35);
    }
    rc(x, 13, 4 + dy, 10, 6, ICE);
    rc(x, 13, 4 + dy, 10, 1, L);
    rc(x, 13, 9 + dy, 10, 1, ICED);
    if (cracked) {
      rc(x, 16, 4 + dy, 1, 3, CRK);
    }
    if (smash) {
      rc(x, 15, 6 + dy, 2, 1, "#ffffff");
      rc(x, 19, 6 + dy, 2, 1, "#ffffff");
    } else if (cracked) {
      rc(x, 15, 6 + dy, 1, 1, "#2aa8c8");
      rc(x, 19, 6 + dy, 1, 1, "#2aa8c8");
    } else {
      rc(x, 15, 6 + dy, 2, 1, CORE);
      rc(x, 19, 6 + dy, 2, 1, CORE);
    }
    if (tel) {
      x.globalAlpha = 0.85;
      rc(x, 15, 5 + dy, 2, 1, CORE2);
      rc(x, 19, 5 + dy, 2, 1, CORE2);
      x.globalAlpha = 1;
    }
    const syL = 8 - tiltL + dy, syR = 8 - tiltR + dy;
    rc(x, 2, syL, 9, 6, ICED);
    rc(x, 2, syL, 9, 1, L);
    rc(x, 4, syL - 3, 3, 3, XT);
    rc(x, 5, syL - 4, 2, 1, SNOW);
    rc(x, 2, syL - 1, 2, 2, XT);
    rc(x, 25, syR, 9, 6, ICED);
    rc(x, 25, syR, 9, 1, L);
    rc(x, 29, syR - 3, 3, 3, XT);
    rc(x, 29, syR - 4, 2, 1, SNOW);
    rc(x, 32, syR - 1, 2, 2, XT);
    rc(x, 3, syL, 4, 1, SNOW);
    rc(x, 26, syR, 4, 1, SNOW);
    if (cracked) {
      rc(x, 30, syR + 2, 3, 2, "#0e1c2c");
      rc(x, 29, syR + 3, 2, 1, CRK);
      rc(x, 33, syR - 2, 1, 2, XT);
    }
    if (tel) {
      rc(x, 2, 2, 5, 10, ICED);
      rc(x, 2, 2, 1, 10, L);
      rc(x, 1, 0, 7, 3, ICEDD);
      rc(x, 1, 0, 7, 1, L);
      rc(x, 29, 2, 5, 10, ICED);
      rc(x, 33, 2, 1, 10, "#3a5a7c");
      rc(x, 28, 0, 7, 3, ICEDD);
      rc(x, 28, 0, 7, 1, L);
      x.globalAlpha = 0.8;
      rc(x, 2, 1, 2, 1, SNOW);
      rc(x, 31, 1, 2, 1, SNOW);
      x.globalAlpha = 1;
    } else if (smash) {
      rc(x, 1, 14, 5, 11, ICED);
      rc(x, 1, 14, 1, 11, L);
      rc(x, 0, 25, 8, 6, ICEDD);
      rc(x, 0, 25, 8, 1, L);
      rc(x, 30, 14, 5, 11, ICED);
      rc(x, 34, 14, 1, 11, "#3a5a7c");
      rc(x, 28, 25, 8, 6, ICEDD);
      rc(x, 28, 25, 8, 1, L);
      x.globalAlpha = 0.95;
      rc(x, 0, 32, 2, 1, SNOW);
      rc(x, 4, 33, 2, 1, XT);
      rc(x, 8, 32, 2, 1, SNOW);
      rc(x, 27, 33, 2, 1, XT);
      rc(x, 31, 32, 2, 1, SNOW);
      rc(x, 34, 31, 1, 1, SNOW);
      x.globalAlpha = 0.4;
      rc(x, 0, 34, 36, 1, L);
      x.globalAlpha = 1;
    } else {
      rc(x, 1, 13 + tiltL, 5, 11, ICED);
      rc(x, 1, 13 + tiltL, 1, 11, L);
      rc(x, 0, 23 + tiltL, 7, 5, ICEDD);
      rc(x, 0, 23 + tiltL, 7, 1, L);
      rc(x, 30, 13 + tiltR, 5, 11, ICED);
      rc(x, 34, 13 + tiltR, 1, 11, "#3a5a7c");
      rc(x, 29, 23 + tiltR, 7, 5, ICEDD);
      rc(x, 29, 23 + tiltR, 7, 1, L);
    }
    if (!smash) {
      const stepL = f === 1 && !cracked ? 1 : 0;
      const stepR = 1 - stepL;
      rc(x, 9, 26 + dy + stepL, 7, 6 - stepL, ICEDD);
      rc(x, 19, 26 + dy + stepR, 7, 6 - stepR, ICEDD);
      rc(x, 9, 31 + dy, 7, 1, "#3a5a7c");
      rc(x, 19, 31 + dy, 7, 1, "#3a5a7c");
      rc(x, 8, 32 + dy, 9, 1, SNOW);
      rc(x, 18, 32 + dy, 9, 1, SNOW);
      x.globalAlpha = 0.8;
      for (let i = 0;i < 3; i++) {
        const fx = 6 + Math.floor(rnd() * 26), fy = 30 + Math.floor(rnd() * 3);
        rc(x, fx, fy, 1, 1, SNOW);
      }
      x.globalAlpha = 1;
      if (cracked)
        rc(x, 12, 27 + dy, 1, 4, CRK);
    }
    x.globalAlpha = 0.55;
    rc(x, 0, 28, 7, 1, O);
    rc(x, 29, 28, 7, 1, O);
    if (smash) {
      rc(x, 0, 30, 8, 1, O);
      rc(x, 28, 30, 8, 1, O);
    }
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
function buildOrb() {
  const out = [];
  for (let f = 0;f < 2; f++) {
    const { c, x } = cv(12, 12);
    disc(x, 6, 6, 5, "#2e78b8", 0.9);
    disc(x, 6, 6, 4.1, "#58a8e0", 0.82);
    disc(x, 6, 6, 2.6, "#9ad0f0", 0.8);
    x.globalAlpha = 1;
    rc(x, 4 - f, 3, 2, 2, "#f4fbff");
    rc(x, 8 + f, 9, 1, 1, "#2e78b8");
    if (f === 1) {
      x.globalAlpha = 0.5;
      rc(x, 3, 8, 1, 1, "#d8f0ff");
      x.globalAlpha = 1;
    }
    out.push(c);
  }
  return out;
}
function buildShard() {
  const out = [];
  for (let f = 0;f < 2; f++) {
    const { c, x } = cv(12, 12);
    const inx = f;
    const rows = [
      [0, 5, 2],
      [1, 4, 4],
      [2, 4, 4],
      [3, 3, 6],
      [4, 3, 6],
      [5, 2, 8],
      [6, 2, 8],
      [7, 3, 6],
      [8, 3, 6],
      [9, 4, 4],
      [10, 4, 4],
      [11, 5, 2]
    ];
    for (const [y, x0, w] of rows) {
      const rx0 = x0 + (w >= 6 ? inx : 0), rw = Math.max(2, w - (w >= 6 ? inx * 2 : 0));
      rc(x, rx0, y, rw, 1, rw <= 2 ? "#dff4fc" : "#9fd4ec");
      if (rw >= 6) {
        rc(x, rx0, y, 1, 1, "#5aa8cc");
        rc(x, rx0 + rw - 1, y, 1, 1, "#5aa8cc");
      }
    }
    rc(x, 5, 2, 1, 6, "#eaf8ff");
    rc(x, 6, 3, 1, 3, "#ffffff");
    out.push(c);
  }
  return out;
}
function buildNota() {
  const out = [];
  for (let f = 0;f < 2; f++) {
    const { c, x } = cv(12, 12);
    disc(x, 6, 6, 5, "#bfe0ff", f === 0 ? 0.25 : 0.35);
    x.globalAlpha = 1;
    rc(x, 3, 8, 3, 2, "#e8f4ff");
    rc(x, 3, 9, 3, 1, "#9fc8e8");
    rc(x, 6, 2, 1, 7, "#e8f4ff");
    if (f === 0) {
      rc(x, 7, 2, 2, 1, "#e8f4ff");
      rc(x, 8, 3, 1, 2, "#cfe6fa");
    } else {
      rc(x, 4, 2, 2, 1, "#e8f4ff");
      rc(x, 4, 3, 1, 2, "#cfe6fa");
    }
    rc(x, 9, 5, 1, 1, "#cfe6fa");
    rc(x, f === 0 ? 10 : 1, 1, 1, 1, "#ffffff");
    x.globalAlpha = 1;
    out.push(c);
  }
  return out;
}
function initExpansionSprites() {
  registerSpr("neumo", buildNeumo());
  registerSpr("espectro", buildEspectro());
  registerSpr("arpi", buildArpi());
  registerSpr("sirena", buildSirena());
  registerSpr("golem", buildGolem());
  registerSpr("orb", buildOrb());
  registerSpr("shard", buildShard());
  registerSpr("nota", buildNota());
  registerSpr("vult", buildVult());
  registerSpr("coro1", buildCoro(1));
  registerSpr("coro2", buildCoro(2));
  registerSpr("coro3", buildCoro(3));
  registerSpr("ecodesg", buildEcodesg());
  registerSpr("satiro", buildSatiro());
}
function drawExpansionTile(x, ch, tx, ty, mapId) {
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx, ty);
  const r2 = hash2(tx * 7 + 3, ty * 11 + 5);
  const r3 = hash2(tx * 13 + 1, ty * 3 + 7);
  switch (ch) {
    case "s": {
      rc(x, px0, py0, 16, 16, r < 0.5 ? "#dcc590" : "#d2bb84");
      for (let i = 0;i < 5; i++) {
        const hx = hash2(tx * 5 + i * 3, ty * 7 + i);
        const hy = hash2(tx * 11 + i, ty * 5 + i * 7);
        if (hx < 0.45) {
          x.fillStyle = i % 2 === 0 ? "#c4ab74" : "#e6d2a2";
          x.fillRect(px0 + Math.floor(hx * 30) % 15, py0 + Math.floor(hy * 30) % 15, 1, 1);
        }
      }
      if (r2 > 0.86) {
        rc(x, px0 + 4 + Math.floor(r * 6), py0 + 5 + Math.floor(r3 * 6), 2, 1, "#f0e8d4");
      }
      if (r3 < 0.1)
        rc(x, px0 + 9, py0 + 3, 2, 1, "#e8d4a4");
      return true;
    }
    case "S": {
      rc(x, px0, py0, 16, 16, r < 0.5 ? "#e9eef5" : "#e2e9f1");
      const n = r2 > 0.5 ? 2 : 1;
      for (let i = 0;i < n; i++) {
        const hx = hash2(tx * 3 + i * 11, ty * 9 + i * 5);
        const hy = hash2(tx * 17 + i, ty * 13 + i * 3);
        rc(x, px0 + 2 + Math.floor(hx * 12), py0 + 2 + Math.floor(hy * 12), 1, 1, "#ffffff");
      }
      if (r3 > 0.72)
        rc(x, px0 + 4 + Math.floor(r * 8), py0 + 9, 3, 1, "#d2dde9");
      return true;
    }
    case "i": {
      rc(x, px0, py0, 16, 16, r < 0.5 ? "#a9d2ea" : "#9fc9e4");
      x.globalAlpha = 0.2;
      rc(x, px0 + 2 + Math.floor(r2 * 4), py0, 3, 16, "#eaf7ff");
      x.globalAlpha = 1;
      if (r2 > 0.4) {
        const cx0 = px0 + 3 + Math.floor(r * 6), cy0 = py0 + 3 + Math.floor(r3 * 8);
        rc(x, cx0, cy0, 4, 1, "#d6eefc");
        rc(x, cx0 + 3, cy0 + 1, 1, 3, "#d6eefc");
        rc(x, cx0 + 2, cy0 + 3, 2, 1, "#c2e2f4");
      }
      if (r3 < 0.25)
        rc(x, px0 + 10, py0 + 10, 3, 1, "#c2e2f4");
      rc(x, px0, py0, 16, 1, "#b8dcf0");
      return true;
    }
    case ".": {
      if (mapId === "costa") {
        rc(x, px0, py0, 16, 16, r < 0.5 ? "#8aa860" : "#7e9c56");
        for (let i = 0;i < 4; i++) {
          const hx = hash2(tx * 4 + i, ty * 9 + i);
          if (hx < 0.4) {
            rc(x, px0 + Math.floor(hx * 14), py0 + Math.floor(hash2(tx + i, ty * 3 + i) * 14), 1, 2, i % 2 === 0 ? "#a8c070" : "#6e8c4c");
          }
        }
        if (r2 > 0.8)
          rc(x, px0 + 6, py0 + 8, 2, 1, "#c8b878");
        return true;
      }
      if (mapId === "cumbres") {
        rc(x, px0, py0, 16, 16, r < 0.5 ? "#a8c098" : "#9cb48c");
        for (let i = 0;i < 4; i++) {
          const hx = hash2(tx * 6 + i, ty * 5 + i * 3);
          if (hx < 0.4) {
            rc(x, px0 + Math.floor(hx * 14), py0 + Math.floor(hash2(tx + i * 5, ty + i) * 14), 1, 1, i % 2 === 0 ? "#c4d8b4" : "#8aa07c");
          }
        }
        if (r2 > 0.62)
          rc(x, px0 + 3 + Math.floor(r * 8), py0 + 4 + Math.floor(r3 * 8), 2, 1, "#eef4f0");
        return true;
      }
      return false;
    }
    case ",": {
      if (mapId === "costa") {
        rc(x, px0, py0, 16, 16, r < 0.5 ? "#8aa860" : "#7e9c56");
        const bx = px0 + 3 + Math.floor(r * 7), by = py0 + 3 + Math.floor(r2 * 7);
        rc(x, bx, by, 2, 2, "#f0f4f0");
        rc(x, bx + 1, by - 1, 1, 1, "#ffffff");
        rc(x, bx - 1, by + 1, 1, 1, "#d8e8e0");
        if (r3 > 0.5) {
          const cx2 = px0 + 9 - Math.floor(r * 5), cy2 = py0 + 9 - Math.floor(r2 * 5);
          rc(x, cx2, cy2, 2, 1, "#e4efe6");
          rc(x, cx2, cy2 + 1, 1, 1, "#c8dcd4");
        }
        return true;
      }
      return false;
    }
    case ":": {
      if (mapId === "aldea") {
        rc(x, px0, py0, 16, 16, r < 0.5 ? "#585864" : "#525260");
        rc(x, px0, py0, 16, 1, "#6a6a78");
        x.fillStyle = "#40404c";
        x.fillRect(px0, py0, 1, 16);
        x.fillRect(px0, py0 + (r > 0.5 ? 7 : 9), 16, 1);
        x.fillRect(px0 + (r2 > 0.5 ? 6 : 10), py0, 1, 8);
        if (r2 > 0.7) {
          rc(x, px0 + 3 + Math.floor(r * 6), py0 + 3, 1, 5, "#3c3c48");
          rc(x, px0 + 4 + Math.floor(r * 6), py0 + 7, 2, 1, "#3c3c48");
        }
        if (r3 > 0.85)
          rc(x, px0 + 11, py0 + 11, 2, 1, "#6e6e7c");
        return true;
      }
      return false;
    }
    case "=": {
      if (mapId === "cumbres") {
        rc(x, px0, py0, 16, 16, r < 0.5 ? "#8a7048" : "#7c6440");
        rc(x, px0, py0, 16, 1, "#9a8056");
        for (let i = 0;i < 5; i++) {
          const hx = hash2(tx * 13 + i, ty * 5 + i * 3);
          if (hx < 0.4) {
            rc(x, px0 + Math.floor(hx * 13), py0 + Math.floor(hash2(tx + i * 7, ty + i) * 13), 2, 1, "#6a5436");
          }
        }
        if (r2 > 0.75)
          rc(x, px0 + 5 + Math.floor(r * 6), py0 + 6, 2, 1, "#a8906a");
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}
function drawExpansionTallTile(x, ch, tx, ty, mapId) {
  const px0 = tx * 16, py0 = ty * 16;
  const r = hash2(tx * 3 + 1, ty * 5 + 7);
  const r2 = hash2(tx * 11 + 9, ty * 7 + 3);
  if (ch === "p" && mapId === "costa") {
    const bend = r > 0.5 ? 1 : -1;
    const seg = [
      [7, 13, 2],
      [7, 11, 2],
      [8, 9, 2],
      [8 + bend, 7, 2],
      [8 + bend, 5, 2],
      [9 + bend, 3, 2]
    ];
    for (let i = 0;i < seg.length; i++) {
      const [sx, sy, sw] = seg[i];
      rc(x, px0 + sx + (bend > 0 ? 0 : 0), py0 + sy, sw, 2, i % 2 === 0 ? "#8a6a3e" : "#6d5430");
    }
    rc(x, px0 + 7, py0 + 12, 2, 1, "#5c462a");
    rc(x, px0 + 8 + bend, py0 + 8, 2, 1, "#5c462a");
    const crownX = px0 + 9 + bend, crownY = py0 + 2;
    rc(x, crownX - 6, crownY + 1, 7, 2, "#3e8a4a");
    rc(x, crownX - 7, crownY + 2, 4, 2, "#2e6a38");
    rc(x, crownX + 1, crownY + 1, 7, 2, "#3e8a4a");
    rc(x, crownX + 5, crownY + 2, 4, 2, "#2e6a38");
    rc(x, crownX - 2, crownY - 2, 5, 2, "#5aa858");
    rc(x, crownX - 1, crownY - 3, 3, 1, "#5aa858");
    rc(x, crownX - 5, crownY + 3, 3, 1, "#5aa858");
    rc(x, crownX + 3, crownY + 3, 3, 1, "#5aa858");
    if (r2 > 0.55)
      rc(x, crownX - 8, crownY + 3, 2, 1, "#2e6a38");
    rc(x, crownX - 2, crownY + 3, 2, 2, "#6d4520");
    rc(x, crownX + 1, crownY + 4, 2, 2, "#6d4520");
    return true;
  }
  if ((ch === "t" || ch === "p") && mapId === "cumbres") {
    rc(x, px0 + 7, py0 + 12, 2, 4, "#54381e");
    rc(x, px0 + 7, py0 + 15, 2, 1, "#3e2a16");
    const layers = [
      [3, 7, 10],
      [4, 4, 8],
      [5, 1, 6]
    ];
    for (let i = 0;i < layers.length; i++) {
      const [lx, ly, lw] = layers[i];
      const deep = i % 2 === 0 ? "#1e4a34" : "#21503a";
      rc(x, px0 + lx, py0 + ly, lw, 4, deep);
      rc(x, px0 + lx + 1, py0 + ly + 1, lw - 3, 1, "#2e5e42");
      const snowW = r2 > 0.5 ? lw : lw - 2;
      rc(x, px0 + lx, py0 + ly, snowW, 1, "#e8f0f4");
      rc(x, px0 + lx + 2, py0 + ly + 1, Math.max(1, snowW - 5), 1, "#d4e4ea");
    }
    rc(x, px0 + 7, py0 - 1, 2, 2, "#e8f0f4");
    if (r > 0.7)
      rc(x, px0 + 5, py0 + 3, 2, 1, "#f4fafc");
    return true;
  }
  return false;
}
function drawExpansionProp(ctx, kind, cx, cy, zoom, t, lit) {
  const Z = zoom;
  switch (kind) {
    case "wreck": {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.16);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(0, 11 * Z, 22 * Z, 4 * Z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      for (let i = 0;i < 5; i++) {
        const w = (17 - i * 2.4) * Z;
        ctx.fillStyle = i % 2 === 0 ? "#6d4a2a" : "#54381e";
        ctx.fillRect(-w, (6 - i * 4) * Z, w * 2, 4 * Z);
      }
      ctx.fillStyle = "#8a6438";
      ctx.fillRect(-14 * Z, -12 * Z, 10 * Z, 2 * Z);
      ctx.fillStyle = "#54381e";
      ctx.fillRect(2 * Z, -11 * Z, 7 * Z, 2 * Z);
      ctx.fillStyle = "#7d5630";
      ctx.fillRect(-4 * Z, -9 * Z, 9 * Z, 1.5 * Z);
      ctx.fillStyle = "#4a7a3e";
      ctx.fillRect(-9 * Z, -6 * Z, 5 * Z, 2 * Z);
      ctx.fillRect(6 * Z, 1 * Z, 4 * Z, 2 * Z);
      ctx.fillStyle = "#54381e";
      ctx.fillRect(6 * Z, -26 * Z, 2.4 * Z, 22 * Z);
      ctx.fillStyle = "#3e2a16";
      ctx.fillRect(7.4 * Z, -26 * Z, 1 * Z, 22 * Z);
      const wav = Math.sin(t * 1.7) * 3;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "#cfc8b4";
      ctx.beginPath();
      ctx.moveTo(8.6 * Z, -25 * Z);
      ctx.quadraticCurveTo((26 + wav) * Z, (-20 + wav * 0.6) * Z, (22 + wav) * Z, (-5 + wav) * Z);
      ctx.lineTo(15 * Z, (-9 + wav * 0.4) * Z);
      ctx.lineTo(10.5 * Z, (-15 + wav * 0.2) * Z);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#a89f8a";
      ctx.fillRect((17 + wav * 0.5) * Z, (-13 + wav) * Z, 4 * Z, 2 * Z);
      ctx.fillRect(11 * Z, -19 * Z, 3 * Z, 2 * Z);
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }
    case "faro": {
      for (let i = 0;i < 8; i++) {
        const yTop = cy + (14 - i * 6) * Z - 6 * Z;
        const halfW = (10 - i * 0.5) * Z;
        ctx.fillStyle = i % 2 === 0 ? "#c8c2b4" : "#9a5a4a";
        ctx.fillRect(cx - halfW, yTop, halfW * 2, 6 * Z + 0.6);
      }
      ctx.fillStyle = "#8a8478";
      ctx.fillRect(cx - 11 * Z, cy + 8 * Z, 3 * Z, 2 * Z);
      ctx.fillRect(cx + 7 * Z, cy + 2 * Z, 4 * Z, 2 * Z);
      ctx.fillStyle = "rgba(40,36,30,0.5)";
      ctx.fillRect(cx - 2 * Z, cy - 10 * Z, 1.2 * Z, 10 * Z);
      ctx.fillRect(cx - 1 * Z, cy - 2 * Z, 1.2 * Z, 6 * Z);
      const gy = cy - 34 * Z;
      ctx.fillStyle = "#3a3e48";
      ctx.fillRect(cx - 6 * Z, gy, 12 * Z, 8 * Z);
      if (lit) {
        const pulse = 0.55 + Math.sin(t * 2.4) * 0.45;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#ffe9a0";
        ctx.fillRect(cx - 4 * Z, gy + 2 * Z, 8 * Z, 4 * Z);
        ctx.globalAlpha = 0.25 + pulse * 0.3;
        ctx.fillStyle = "#ffe9a0";
        ctx.beginPath();
        ctx.arc(cx, gy + 4 * Z, 10 * Z, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.12;
        ctx.save();
        ctx.translate(cx, gy + 4 * Z);
        ctx.rotate(t * 0.35);
        ctx.fillStyle = "#fff3c8";
        const L = 64 * Z;
        ctx.beginPath();
        ctx.moveTo(0, -3 * Z);
        ctx.lineTo(L, -12 * Z);
        ctx.lineTo(L, 12 * Z);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -3 * Z);
        ctx.lineTo(-L, -12 * Z);
        ctx.lineTo(-L, 12 * Z);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#1c2028";
        ctx.fillRect(cx - 4 * Z, gy + 2 * Z, 8 * Z, 4 * Z);
      }
      ctx.fillStyle = "#6a6458";
      ctx.fillRect(cx - 6 * Z, gy - 3 * Z, 5 * Z, 3 * Z);
      ctx.fillRect(cx + 1 * Z, gy - 2 * Z, 5 * Z, 2 * Z);
      break;
    }
    case "lamp": {
      ctx.fillStyle = "#2a2a32";
      ctx.fillRect(cx - 3 * Z, cy + 6 * Z, 6 * Z, 2 * Z);
      ctx.fillStyle = "#3a3a44";
      ctx.fillRect(cx - 1 * Z, cy - 8 * Z, 2 * Z, 15 * Z);
      ctx.fillStyle = "#3a3a44";
      ctx.fillRect(cx - 3.5 * Z, cy - 16 * Z, 7 * Z, 9 * Z);
      ctx.fillStyle = "#2a2a32";
      ctx.fillRect(cx - 4.5 * Z, cy - 18 * Z, 9 * Z, 2.5 * Z);
      if (lit) {
        const fl = 0.7 + Math.sin(t * 9) * 0.2 + Math.sin(t * 23.7) * 0.1;
        ctx.globalAlpha = 0.22 + fl * 0.18;
        ctx.fillStyle = "#ffd88a";
        ctx.beginPath();
        ctx.arc(cx, cy - 11.5 * Z, 10 * Z, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(255,216,138,${0.7 + fl * 0.3})`;
        ctx.fillRect(cx - 2.5 * Z, cy - 14.5 * Z, 5 * Z, 6 * Z);
        ctx.fillStyle = "#fff6d8";
        ctx.fillRect(cx - 1 * Z, cy - 13 * Z, 2 * Z, 3 * Z);
      } else {
        ctx.fillStyle = "#8a8f98";
        ctx.fillRect(cx - 2.5 * Z, cy - 14.5 * Z, 5 * Z, 6 * Z);
        ctx.fillStyle = "#6a6f78";
        ctx.fillRect(cx - 1 * Z, cy - 12 * Z, 2 * Z, 3 * Z);
      }
      break;
    }
    default:
      break;
  }
}
function notaGlyph(ctx, x, y, s, col) {
  const u = s / 6;
  ctx.fillStyle = col;
  ctx.fillRect(x - 1.6 * u, y + 1.2 * u, 2.6 * u, 1.8 * u);
  ctx.fillRect(x + 0.4 * u, y - 2.6 * u, 0.8 * u, 4.2 * u);
  ctx.fillRect(x + 1.2 * u, y - 2.6 * u, 0.8 * u, 1.6 * u);
  ctx.fillRect(x + 2 * u, y - 1.6 * u, 0.6 * u, 1.2 * u);
}
function drawExpansionProjectile(ctx, sprite, x, y, r, zoom, t) {
  switch (sprite) {
    case "orb": {
      const wob = 1 + Math.sin(t * 6) * 0.12;
      const R = Math.max(3, r) * zoom * wob;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#2e78b8";
      ctx.beginPath();
      ctx.arc(x, y, R + 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#58a8e0";
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#9ad0f0";
      ctx.beginPath();
      ctx.arc(x - R * 0.2, y - R * 0.25, R * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f4fbff";
      ctx.fillRect(x - R * 0.45, y - R * 0.55, Math.max(1.5, R * 0.35), Math.max(1.5, R * 0.35));
      return true;
    }
    case "shard": {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 3);
      const s = Math.max(3, r + 1) * zoom;
      ctx.fillStyle = "#5aa8cc";
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.55, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.55, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#9fd4ec";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.lineTo(s * 0.3, 0);
      ctx.lineTo(0, s * 0.8);
      ctx.lineTo(-s * 0.3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#eaf8ff";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.45);
      ctx.lineTo(s * 0.12, 0);
      ctx.lineTo(0, s * 0.45);
      ctx.lineTo(-s * 0.12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return true;
    }
    case "nota": {
      const bob = Math.sin(t * 4) * 1.5;
      const pulse = 0.7 + Math.sin(t * 8) * 0.3;
      const s = Math.max(3, r + 1) * zoom;
      ctx.globalAlpha = 0.22 * pulse;
      ctx.fillStyle = "#bfe0ff";
      ctx.beginPath();
      ctx.arc(x, y + bob, s * 1.6, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 1;i <= 2; i++) {
        ctx.globalAlpha = 0.3 / i * pulse;
        notaGlyph(ctx, x - i * 2, y + bob - i * 3, s * (1 - i * 0.18), "#9fc8e8");
      }
      ctx.globalAlpha = 1;
      notaGlyph(ctx, x, y + bob, s, "#f2f9ff");
      return true;
    }
    default:
      return false;
  }
}
function buildVult() {
  const CAP = "#24443a", CAP2 = "#2f5a4a", CAPD = "#16302a", MASK = "#e2ecdc", MASKD = "#a8b8a8", SCARF = "#8ef0c0", CLAW = "#e6f2ea", CLAWD = "#9cbcb0", EYE = "#b8ffd8", BOOT = "#1a2822", BKS = "#12211c";
  const frames = [];
  for (let f = 0;f < 4; f++) {
    const { c, x } = cv(32, 32);
    const run = f < 2;
    const tel = f === 2;
    const lunge = f === 3;
    const sw = f === 1 ? 1 : 0;
    if (run) {
      x.globalAlpha = 0.95;
      rc(x, 7 - sw, 9, 6, 13, CAPD);
      x.globalAlpha = 0.55;
      rc(x, 5 - sw, 13 + sw, 3, 6, CAP);
      x.globalAlpha = 1;
      rc(x, 21 + sw, 7, 5, 2, SCARF);
      x.globalAlpha = 0.7;
      rc(x, 25 + sw * 2, 6, 4, 2, SCARF);
      x.globalAlpha = 0.45;
      rc(x, 28 + sw * 2, 5, 2, 1, SCARF);
      x.globalAlpha = 1;
      rc(x, 12, 10, 9, 9, CAP);
      rc(x, 12, 10, 9, 1, CAP2);
      rc(x, 13, 12, 1, 6, CAP2);
      rc(x, 20, 11, 1, 7, CAPD);
      rc(x, 12, 18, 10, 1, CAPD);
      rc(x, 13, 3, 8, 7, CAP);
      rc(x, 12, 4, 1, 5, CAPD);
      rc(x, 21, 4, 1, 5, CAPD);
      rc(x, 14, 5, 3, 3, BKS);
      rc(x, 17, 4, 4, 5, MASK);
      rc(x, 17, 4, 1, 5, MASKD);
      rc(x, 17, 3, 4, 1, MASKD);
      rc(x, 19, 5, 1, 1, EYE);
      rc(x, 21, 11, 3, 3, CAP);
      rc(x, 24, 13, 1, 3, CLAW);
      rc(x, 25, 15, 1, 3, CLAW);
      rc(x, 26, 17, 1, 2, CLAWD);
      rc(x, 8, 11, 3, 3, CAP);
      rc(x, 7, 14, 1, 3, CLAW);
      rc(x, 6, 16, 1, 3, CLAWD);
      if (f === 0) {
        rc(x, 13, 19, 3, 5, CAPD);
        rc(x, 12, 24, 4, 2, BOOT);
        rc(x, 17, 19, 3, 4, CAPD);
        rc(x, 18, 23, 4, 2, BOOT);
      } else {
        rc(x, 17, 19, 3, 5, CAPD);
        rc(x, 18, 24, 4, 2, BOOT);
        rc(x, 13, 19, 3, 4, CAPD);
        rc(x, 12, 23, 4, 2, BOOT);
      }
      x.globalAlpha = 0.35;
      rc(x, f === 0 ? 8 : 6, 26, 3, 1, "#bfe8d8");
      x.globalAlpha = 1;
    } else if (tel) {
      x.globalAlpha = 0.95;
      rc(x, 7, 12, 6, 10, CAPD);
      x.globalAlpha = 1;
      rc(x, 12, 11, 9, 9, CAP);
      rc(x, 12, 11, 9, 1, CAP2);
      rc(x, 20, 12, 1, 7, CAPD);
      rc(x, 12, 19, 10, 1, CAPD);
      rc(x, 13, 5, 8, 7, CAP);
      rc(x, 12, 6, 1, 5, CAPD);
      rc(x, 21, 6, 1, 5, CAPD);
      rc(x, 14, 7, 3, 3, BKS);
      rc(x, 17, 6, 4, 5, MASK);
      rc(x, 17, 6, 1, 5, MASKD);
      rc(x, 17, 5, 4, 1, MASKD);
      rc(x, 19, 7, 2, 1, EYE);
      rc(x, 9, 8, 3, 3, CAP);
      rc(x, 8, 5, 1, 4, CLAW);
      rc(x, 7, 2, 1, 4, CLAW);
      rc(x, 6, 1, 1, 2, CLAWD);
      x.globalAlpha = 0.8;
      rc(x, 8, 2, 1, 1, "#ffffff");
      x.globalAlpha = 1;
      rc(x, 21, 13, 3, 3, CAP);
      rc(x, 24, 15, 1, 3, CLAW);
      rc(x, 25, 17, 1, 2, CLAWD);
      rc(x, 13, 20, 3, 4, CAPD);
      rc(x, 12, 24, 4, 2, BOOT);
      rc(x, 17, 20, 3, 4, CAPD);
      rc(x, 18, 24, 4, 2, BOOT);
      x.globalAlpha = 0.6;
      rc(x, 5, 4, 1, 1, EYE);
      rc(x, 10, 1, 1, 1, EYE);
      x.globalAlpha = 1;
    } else {
      x.globalAlpha = 0.95;
      rc(x, 3, 11, 9, 3, CAPD);
      x.globalAlpha = 0.6;
      rc(x, 1, 13, 4, 2, CAPD);
      x.globalAlpha = 0.35;
      rc(x, 0, 15, 3, 1, CAPD);
      x.globalAlpha = 1;
      rc(x, 11, 8, 8, 1, SCARF);
      x.globalAlpha = 0.6;
      rc(x, 9, 8, 2, 1, SCARF);
      x.globalAlpha = 1;
      rc(x, 14, 10, 11, 8, CAP);
      rc(x, 14, 10, 11, 1, CAP2);
      rc(x, 24, 11, 1, 6, CAPD);
      rc(x, 17, 4, 8, 6, CAP);
      rc(x, 16, 5, 1, 4, CAPD);
      rc(x, 25, 5, 1, 4, CAPD);
      rc(x, 18, 5, 3, 3, BKS);
      rc(x, 21, 4, 4, 5, MASK);
      rc(x, 21, 4, 1, 5, MASKD);
      rc(x, 21, 3, 4, 1, MASKD);
      rc(x, 23, 5, 1, 1, EYE);
      rc(x, 25, 12, 4, 2, CAP);
      rc(x, 29, 11, 2, 2, CLAW);
      rc(x, 30, 12, 2, 1, CLAW);
      rc(x, 31, 10, 1, 2, CLAWD);
      rc(x, 12, 12, 3, 3, CAP);
      rc(x, 10, 14, 1, 3, CLAW);
      rc(x, 9, 16, 1, 2, CLAWD);
      rc(x, 20, 18, 4, 5, CAPD);
      rc(x, 21, 23, 5, 2, BOOT);
      rc(x, 14, 18, 3, 4, CAPD);
      rc(x, 11, 22, 4, 2, BOOT);
      x.globalAlpha = 0.35;
      rc(x, 2, 10, 5, 1, "#bfe8d8");
      rc(x, 0, 14, 6, 1, "#bfe8d8");
      rc(x, 3, 18, 4, 1, "#bfe8d8");
      x.globalAlpha = 1;
    }
    x.globalAlpha = 0.5;
    rc(x, 13, run ? 3 : tel ? 5 : 4, 8, 1, BKS);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
function buildCoro(fase) {
  const pal = fase === 1 ? { HUESO: "#d8d4c4", HUESO2: "#bdb8a6", GLOW: "#7ee8ff", HUECO: "#1a2030", FILO: "#eef2e8" } : fase === 2 ? { HUESO: "#c8c2b2", HUESO2: "#aaa494", GLOW: "#b48fff", HUECO: "#1c1830", FILO: "#e4e2da" } : { HUESO: "#c4bcae", HUESO2: "#9c9486", GLOW: "#ffd88a", HUECO: "#241f28", FILO: "#dcd8cc" };
  const { HUESO, HUESO2, GLOW, HUECO, FILO } = pal;
  const frames = [];
  for (let f = 0;f < 3; f++) {
    const { c, x } = cv(30, 30);
    const sing = f === 2;
    const bob = sing ? 0 : f;
    const part = sing ? 2 : 0;
    x.globalAlpha = sing ? 0.6 : 0.4;
    rc(x, 8, 14 + bob, 4 - part, 1, GLOW);
    rc(x, 18 + part, 14 - bob, 4 - part, 1, GLOW);
    x.globalAlpha = sing ? 0.3 : 0.22;
    disc(x, 15, 13 + bob, sing ? 12 : 11, GLOW);
    x.globalAlpha = 1;
    const mouthH = sing ? 7 : 5;
    rc(x, 10, 5 + bob, 10, 13 + (sing ? 1 : 0), HUESO);
    rc(x, 9, 6 + bob, 12, 11, HUESO);
    rc(x, 10, 17 + bob, 10, 2, HUESO2);
    rc(x, 9, 6 + bob, 1, 9, HUESO2);
    rc(x, 20, 6 + bob, 1, 9, HUESO2);
    rc(x, 10, 7 + bob, 4, 1, HUESO2);
    rc(x, 16, 7 + bob, 4, 1, HUESO2);
    const eyeH = fase === 1 ? 2 : fase === 2 ? 3 : 4;
    rc(x, 11, 8 + bob, 2, eyeH, HUECO);
    rc(x, 17, 8 + bob, 2, eyeH, HUECO);
    rc(x, 11, 8 + bob, 2, 1, FILO);
    rc(x, 17, 8 + bob, 2, 1, FILO);
    rc(x, 14, 11 + bob, 2, mouthH, HUECO);
    x.globalAlpha = 0.85;
    rc(x, 14, 11 + bob, 1, mouthH - 1, GLOW);
    if (sing) {
      x.globalAlpha = 0.5;
      rc(x, 13, 11 + bob, 1, mouthH - 2, GLOW);
      rc(x, 16, 11 + bob, 1, mouthH - 2, GLOW);
    }
    x.globalAlpha = 1;
    if (fase >= 2) {
      rc(x, 12, 5 + bob, 1, 3, HUESO2);
      rc(x, 18, 13 + bob, 1, 4, HUESO2);
    }
    if (fase === 3) {
      rc(x, 10, 12 + bob, 3, 1, HUECO);
      rc(x, 16, 5 + bob, 1, 4, HUECO);
      rc(x, 13, 18 + bob, 4, 1, HUECO);
      rc(x, 19, 9 + bob, 1, 3, HUESO2);
      rc(x, 11, 16 + bob, 1, 2, HUECO);
    }
    rc(x, 3 - part, 12 + bob, 6, 8, HUESO2);
    rc(x, 2 - part, 13 + bob, 1, 6, HUESO2);
    rc(x, 4 - part, 15 + bob, 2, 2, HUECO);
    rc(x, 5 - part, 20 + bob, 1, 2, HUECO);
    rc(x, 21 + part, 9 + bob, 6, 8, HUESO2);
    rc(x, 27 + part, 10 + bob, 1, 6, HUESO2);
    rc(x, 23 + part, 12 + bob, 2, 2, HUECO);
    rc(x, 24 + part, 17 + bob, 1, 2, HUECO);
    if (sing) {
      if (fase === 1) {
        const orbs = [[4, 4], [24, 4], [4, 24], [24, 24]];
        for (const [ox, oy] of orbs) {
          disc(x, ox + 1, oy + 1, 2.2, GLOW, 0.75);
          disc(x, ox + 1, oy + 1, 1, FILO, 0.95);
        }
      } else if (fase === 2) {
        x.globalAlpha = 0.85;
        rc(x, 14, 0, 2, 4, FILO);
        rc(x, 14, 26, 2, 4, FILO);
        rc(x, 0, 13, 4, 2, FILO);
        rc(x, 26, 13, 4, 2, FILO);
        x.globalAlpha = 0.4;
        rc(x, 14, 4, 2, 1, GLOW);
        rc(x, 14, 25, 2, 1, GLOW);
        rc(x, 4, 13, 1, 2, GLOW);
        rc(x, 25, 13, 1, 2, GLOW);
        x.globalAlpha = 1;
      } else {
        const notas = [[3, 5], [25, 9], [5, 23]];
        for (const [nx, ny] of notas) {
          rc(x, nx, ny + 2, 2, 1, FILO);
          rc(x, nx + 2, ny, 1, 3, FILO);
          rc(x, nx + 3, ny, 1, 1, GLOW);
        }
        x.globalAlpha = 0.5;
        rc(x, 22, 22, 1, 1, GLOW);
        rc(x, 8, 3, 1, 1, GLOW);
        x.globalAlpha = 1;
      }
    }
    if (f === 1) {
      x.globalAlpha = 0.7;
      rc(x, 14, 15 + bob, 1, 1, FILO);
      rc(x, 6, 11 + bob, 1, 1, GLOW);
      rc(x, 23, 8 + bob, 1, 1, GLOW);
      x.globalAlpha = 1;
    }
    frames.push(c);
  }
  return frames;
}
function buildEcodesg() {
  const frames = [];
  for (let f = 0;f < 3; f++) {
    const { c, x } = cv(16, 16);
    const O = "#39465e", B = "#cdd8ea", S = "#a4b2ca", EYE = "#222c44";
    if (f === 2) {
      const GAP2 = 4;
      x.globalAlpha = 0.9;
      rc(x, 1, 5, 4, 6, B);
      rc(x, 0, 7, 1, 3, B);
      rc(x, 11 + GAP2, 5, 4, 6, B);
      rc(x, 15, 7, 1, 3, B);
      x.globalAlpha = 0.5;
      rc(x, 5, 6, GAP2 - 1, 1, B);
      rc(x, 5, 9, GAP2 - 2, 1, S);
      x.globalAlpha = 0.3;
      rc(x, 0, 11, 4, 1, B);
      rc(x, 12, 11, 4, 1, B);
      x.globalAlpha = 1;
      rc(x, 2, 7, 1, 1, EYE);
      rc(x, 13, 7, 1, 1, EYE);
      x.globalAlpha = 0.55;
      rc(x, 6, 3, 5, 1, O);
      x.globalAlpha = 1;
      frames.push(c);
      continue;
    }
    const GAP = f === 0 ? 1 : 2;
    const brightL = f === 0;
    x.globalAlpha = brightL ? 0.95 : 0.7;
    rc(x, 4, 4, 3, 7, B);
    rc(x, 3, 6, 1, 4, B);
    rc(x, 7 - GAP, 5, 1, 2, B);
    x.globalAlpha = brightL ? 0.7 : 0.95;
    rc(x, 9 + GAP, 4, 3, 7, B);
    rc(x, 12 + GAP, 6, 1, 4, B);
    rc(x, 8 + GAP, 5, 1, 2, S);
    rc(x, 9 + GAP, 8, 1, 2, S);
    x.globalAlpha = 0.6;
    rc(x, 4, 11, 2, 2 + (brightL ? 1 : 0), B);
    rc(x, 7, 11 + GAP, 2, 1 + (brightL ? 1 : 0), S);
    rc(x, 10 + GAP, 11, 2, 2 + (brightL ? 0 : 1), B);
    x.globalAlpha = 1;
    rc(x, 4, 6, 1, 2, EYE);
    rc(x, 11 + GAP, 6, 1, 2, EYE);
    x.globalAlpha = 0.5 + (brightL ? 0 : 0.2);
    rc(x, 7, 3 + GAP, 2, 1, O);
    x.globalAlpha = 0.35;
    rc(x, 7 + (brightL ? 0 : 1), 8 + GAP, 1, 2, "#8ef0ff");
    x.globalAlpha = 0.8;
    rc(x, 4, 3, 8, 1, O);
    x.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}
function buildSatiro() {
  const FUR = "#4a5648", FUR2 = "#5e6c58", FUR3 = "#39443a", HORN = "#c8b890", EYE = "#ffd88a", HOOF = "#2c342a", NIEBLA = "#aebcc8", BK = "#262e26", LIRA = "#d8b45a", LIRAD = "#9a7a34";
  const frames = [];
  for (let f = 0;f < 3; f++) {
    const { c, x } = cv(16, 16);
    if (f === 2) {
      x.globalAlpha = 0.4;
      rc(x, 1, 14, 6, 1, NIEBLA);
      rc(x, 9, 14, 6, 1, NIEBLA);
      rc(x, 0, 9, 1, 3, NIEBLA);
      rc(x, 15, 8, 1, 3, NIEBLA);
      x.globalAlpha = 1;
      rc(x, 4, 2, 1, 3, HORN);
      rc(x, 3, 2, 1, 2, HORN);
      rc(x, 9, 2, 1, 3, HORN);
      rc(x, 10, 2, 1, 2, HORN);
      rc(x, 4, 4, 6, 4, FUR);
      rc(x, 9, 5, 2, 2, FUR);
      rc(x, 5, 5, 1, 1, EYE);
      rc(x, 8, 8, 1, 2, FUR2);
      rc(x, 3, 8, 8, 4, FUR);
      rc(x, 3, 8, 8, 1, BK);
      rc(x, 4, 12, 6, 1, FUR2);
      rc(x, 4, 12, 1, 2, FUR2);
      rc(x, 4, 13, 1, 1, HOOF);
      rc(x, 9, 12, 1, 2, FUR2);
      rc(x, 9, 13, 1, 1, HOOF);
      rc(x, 6, 13, 3, 1, FUR3);
      rc(x, 11, 9, 1, 4, LIRA);
      rc(x, 14, 9, 1, 4, LIRA);
      rc(x, 11, 8, 4, 1, LIRAD);
      x.globalAlpha = 0.8;
      rc(x, 12, 9, 1, 4, LIRA);
      rc(x, 13, 9, 1, 4, LIRA);
      x.globalAlpha = 1;
      rc(x, 12, 11, 2, 1, FUR2);
      x.globalAlpha = 0.8;
      rc(x, 13, 5, 1, 2, NIEBLA);
      rc(x, 14, 4, 1, 1, NIEBLA);
      x.globalAlpha = 0.5;
      rc(x, 15, 3, 1, 1, NIEBLA);
      rc(x, 12, 3, 1, 1, NIEBLA);
      x.globalAlpha = 1;
      rc(x, 2, 9, 1, 2, FUR2);
      frames.push(c);
      continue;
    }
    const hop = f === 0 ? 0 : -1;
    x.globalAlpha = 0.35;
    rc(x, 2, 14, 5, 1, NIEBLA);
    rc(x, 9, 14, 5, 1, NIEBLA);
    x.globalAlpha = 1;
    rc(x, 4, 1 + hop, 1, 3, HORN);
    rc(x, 3, 1 + hop, 1, 2, HORN);
    rc(x, 9, 1 + hop, 1, 3, HORN);
    rc(x, 10, 1 + hop, 1, 2, HORN);
    rc(x, 4, 3 + hop, 6, 4, FUR);
    rc(x, 9, 4 + hop, 2, 2, FUR);
    rc(x, 5, 4 + hop, 1, 1, EYE);
    rc(x, 8, 7 + hop, 1, 2, FUR2);
    rc(x, 3, 7 + hop, 8, 4, FUR);
    rc(x, 3, 7 + hop, 8, 1, BK);
    rc(x, 4, 11 + hop, 6, 1, FUR2);
    rc(x, 4, 11 + hop, 1, 3 - f, FUR2);
    rc(x, 4, 13 + hop - f, 1, 1, HOOF);
    rc(x, 9, 11 + hop, 1, 3 - (1 - f), FUR2);
    rc(x, 9, 13 + hop - (1 - f), 1, 1, HOOF);
    rc(x, 3, 11 + hop, 1, 2, FUR2);
    rc(x, 2, 8 + hop, 1, 4, "#8a6a4a");
    rc(x, 3, 8 + hop, 1, 3, "#6a4e36");
    if (f === 1) {
      x.globalAlpha = 0.7;
      rc(x, 11, 5 + hop, 1, 1, NIEBLA);
      x.globalAlpha = 1;
    }
    rc(x, 2, 8 + hop, 1, 2, FUR2);
    frames.push(c);
  }
  return frames;
}

// src/game/audio.ts
var NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;
function noteFreq(n) {
  if (n === "-" || n === ".")
    return null;
  const m = NOTE_RE.exec(n);
  if (!m)
    return null;
  const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  let semi = base[m[1]];
  if (m[2] === "#")
    semi += 1;
  if (m[2] === "b")
    semi -= 1;
  const oct = parseInt(m[3], 10);
  return 440 * Math.pow(2, semi / 12 + (oct - 4));
}
var VILLAGE = {
  bpm: 96,
  leadType: "square",
  bassType: "triangle",
  padType: "sine",
  gainLead: 0.16,
  gainBass: 0.2,
  gainPad: 0.1,
  lead: [
    "E4",
    "-",
    "G4",
    "-",
    "C5",
    "-",
    "B4",
    "G4",
    "A4",
    "-",
    "-",
    "G4",
    "E4",
    "-",
    "-",
    "-",
    "D4",
    "-",
    "E4",
    "-",
    "G4",
    "-",
    "E4",
    "D4",
    "C4",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-"
  ],
  bass: [
    "C3",
    "-",
    "-",
    "G2",
    "C3",
    "-",
    "-",
    "-",
    "A2",
    "-",
    "-",
    "E2",
    "A2",
    "-",
    "-",
    "-",
    "F2",
    "-",
    "-",
    "C3",
    "F2",
    "-",
    "-",
    "-",
    "G2",
    "-",
    "-",
    "D3",
    "G2",
    "-",
    "B2",
    "-"
  ],
  pad: ["C4", "C4", "A3", "A3", "F3", "F3", "G3", "G3"],
  drums: "h...k...h...k...h...k...h.s.k..."
};
var FOREST = {
  bpm: 84,
  leadType: "triangle",
  bassType: "sine",
  padType: "sine",
  gainLead: 0.14,
  gainBass: 0.16,
  gainPad: 0.12,
  lead: [
    "A4",
    "-",
    "-",
    "C5",
    "B4",
    "-",
    "A4",
    "-",
    "E4",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "G4",
    "-",
    "-",
    "A4",
    "B4",
    "-",
    "D5",
    "-",
    "C5",
    "-",
    "B4",
    "A4",
    "-",
    "-",
    "-",
    "-"
  ],
  bass: [
    "A2",
    "-",
    "-",
    "-",
    "E2",
    "-",
    "-",
    "-",
    "F2",
    "-",
    "-",
    "-",
    "C2",
    "-",
    "-",
    "-",
    "D2",
    "-",
    "-",
    "-",
    "A2",
    "-",
    "-",
    "-",
    "E2",
    "-",
    "-",
    "-",
    "E2",
    "-",
    "G2",
    "-"
  ],
  pad: ["A3", "A3", "F3", "F3", "D3", "D3", "E3", "E3"],
  drums: "................h.......h......."
};
var CRYPT = {
  bpm: 68,
  leadType: "triangle",
  bassType: "sawtooth",
  padType: "sine",
  gainLead: 0.1,
  gainBass: 0.16,
  gainPad: 0.14,
  lead: [
    "D4",
    "-",
    "-",
    "-",
    "F4",
    "-",
    "E4",
    "-",
    "D4",
    "-",
    "-",
    "-",
    "C4",
    "-",
    "-",
    "-",
    "D4",
    "-",
    "-",
    "-",
    "A4",
    "-",
    "G4",
    "-",
    "F4",
    "-",
    "E4",
    "-",
    "D4",
    "-",
    "-",
    "-"
  ],
  bass: [
    "D2",
    "-",
    "-",
    "-",
    "D2",
    "-",
    "-",
    "-",
    "A#1",
    "-",
    "-",
    "-",
    "A#1",
    "-",
    "-",
    "-",
    "G1",
    "-",
    "-",
    "-",
    "G1",
    "-",
    "-",
    "-",
    "A1",
    "-",
    "-",
    "-",
    "A1",
    "-",
    "-",
    "-"
  ],
  pad: ["D3", "D3", "A#2", "A#2", "G2", "G2", "A2", "A2"],
  drums: "k.......k.......k.......k......."
};
var BOSS = {
  bpm: 138,
  leadType: "square",
  bassType: "sawtooth",
  padType: "sine",
  gainLead: 0.15,
  gainBass: 0.2,
  gainPad: 0.08,
  lead: [
    "D4",
    "D4",
    "F4",
    "-",
    "G4",
    "-",
    "A4",
    "A4",
    "A#4",
    "-",
    "A4",
    "-",
    "G4",
    "F4",
    "G4",
    "-",
    "D4",
    "D4",
    "F4",
    "-",
    "G4",
    "-",
    "C5",
    "C5",
    "A#4",
    "-",
    "A4",
    "G4",
    "F4",
    "-",
    "D4",
    "-"
  ],
  bass: [
    "D2",
    "D2",
    "D2",
    "D2",
    "D2",
    "D2",
    "F2",
    "F2",
    "G2",
    "G2",
    "G2",
    "G2",
    "A2",
    "A2",
    "A2",
    "A2",
    "D2",
    "D2",
    "D2",
    "D2",
    "D2",
    "D2",
    "F2",
    "F2",
    "G2",
    "G2",
    "A#2",
    "A#2",
    "A2",
    "A2",
    "D2",
    "D2"
  ],
  pad: ["D3", "D3", "D3", "D3"],
  drums: "k.h.s.h.k.h.s.hkk.h.s.h.k.hks.hk"
};
var TITLE = {
  bpm: 72,
  leadType: "triangle",
  bassType: "sine",
  padType: "sine",
  gainLead: 0.13,
  gainBass: 0.14,
  gainPad: 0.14,
  lead: [
    "A4",
    "-",
    "-",
    "-",
    "C5",
    "-",
    "B4",
    "-",
    "E4",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "G4",
    "-",
    "-",
    "-",
    "B4",
    "-",
    "C5",
    "-",
    "A4",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-"
  ],
  bass: [
    "A2",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "F2",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "C2",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "E2",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-"
  ],
  pad: ["A3", "A3", "F3", "F3", "C3", "C3", "E3", "E3"]
};
var COSTA = {
  bpm: 92,
  leadType: "triangle",
  bassType: "sine",
  padType: "sine",
  gainLead: 0.15,
  gainBass: 0.22,
  gainPad: 0.09,
  lead: [
    "G4",
    "B4",
    "D5",
    "G5",
    "F5",
    "D5",
    "B4",
    "G4",
    "A4",
    "C5",
    "E5",
    "A5",
    "G5",
    "E5",
    "C5",
    "A4",
    "B4",
    "D5",
    "F5",
    "B5",
    "A5",
    "F5",
    "D5",
    "B4",
    "C5",
    "E5",
    "G5",
    "E5",
    "C5",
    "A4",
    "G4",
    "-"
  ],
  bass: [
    "G1",
    "-",
    "-",
    "-",
    "G2",
    "-",
    "-",
    "-",
    "C2",
    "-",
    "-",
    "-",
    "C3",
    "-",
    "-",
    "-",
    "A1",
    "-",
    "-",
    "-",
    "A2",
    "-",
    "-",
    "-",
    "G1",
    "-",
    "-",
    "-",
    "D2",
    "-",
    "-",
    "-"
  ],
  pad: ["G3", "G3", "C4", "C4", "A3", "A3", "F3", "G3"],
  drums: "h.....h...h...h.h.....h...h.h..h"
};
var ALDEA = {
  bpm: 58,
  leadType: "sine",
  bassType: "sine",
  padType: "sine",
  gainLead: 0.15,
  gainBass: 0.17,
  gainPad: 0.12,
  lead: [
    "D5",
    "-",
    "-",
    "-",
    "F5",
    "-",
    "-",
    "-",
    "E5",
    "-",
    "-",
    "D5",
    "-",
    "-",
    "-",
    "-",
    "F5",
    "-",
    "-",
    "-",
    "E5",
    "-",
    "-",
    "-",
    "D5",
    "-",
    "-",
    "C5",
    "-",
    "-",
    "-",
    "-"
  ],
  bass: [
    "D2",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "G1",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "A#1",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "A1",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-"
  ],
  pad: ["D3", "D3", "G2", "G2", "A#2", "A#2", "A2", "A2"],
  drums: "h...............h..............."
};
var CUMBRES = {
  bpm: 76,
  leadType: "sine",
  bassType: "sine",
  padType: "sine",
  gainLead: 0.12,
  gainBass: 0.18,
  gainPad: 0.1,
  lead: [
    "A5",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "G5",
    "-",
    "-",
    "E5",
    "-",
    "-",
    "-",
    "-",
    "D5",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "C5",
    "-",
    "-",
    "E5",
    "-",
    "-",
    "G5",
    "-"
  ],
  bass: [
    "A1",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "G1",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "F1",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "E1",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-",
    "-"
  ],
  pad: ["A2", "A2", "G2", "G2", "F2", "F2", "E2", "E2"],
  drums: "h...............h.......h......."
};
var TRACKS = {
  village: VILLAGE,
  forest: FOREST,
  crypt: CRYPT,
  boss: BOSS,
  title: TITLE,
  costa: COSTA,
  aldea: ALDEA,
  cumbres: CUMBRES
};
var SEMI_UP = Math.pow(2, 1 / 12);

class AudioEngine {
  ctx = null;
  master;
  musicGain;
  sfxGain;
  combatBus;
  musicTimer = null;
  step = 0;
  nextNoteTime = 0;
  cur = null;
  combatOn = false;
  drumGain = 0;
  loopNo = 0;
  tensionGain = 0;
  musicVol = 0.7;
  sfxVol = 0.8;
  init() {
    if (this.ctx)
      return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVol;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);
  }
  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended")
      this.ctx.resume();
  }
  setMusicVol(v) {
    this.musicVol = v;
    if (this.musicGain)
      this.musicGain.gain.value = v;
  }
  setSfxVol(v) {
    this.sfxVol = v;
    if (this.sfxGain)
      this.sfxGain.gain.value = v;
  }
  playTrack(name) {
    this.init();
    if (!this.ctx)
      return;
    if (this.cur === name)
      return;
    this.cur = name;
    this.step = 0;
    this.drumGain = 0;
    this.tensionGain = 0;
    this.loopNo = 0;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const pat = TRACKS[name];
    const stepDur = 60 / pat.bpm / 4;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx)
        return;
      if (this.nextNoteTime < this.ctx.currentTime - 0.25) {
        this.nextNoteTime = this.ctx.currentTime + 0.05;
      }
      while (this.nextNoteTime < this.ctx.currentTime + 0.18) {
        this.loopNo = Math.floor(this.step / 32);
        this.scheduleStep(pat, this.step % 32, this.nextNoteTime, stepDur);
        this.step++;
        this.nextNoteTime += stepDur;
      }
    }, 40);
  }
  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.cur = null;
  }
  setCombat(on) {
    this.combatOn = on;
  }
  scheduleStep(pat, step, t, dur) {
    if (!this.ctx)
      return;
    const tr = this.cur !== "boss" && this.cur !== "title" && this.loopNo % 4 === 2 ? SEMI_UP : 1;
    const lead = pat.lead[step % pat.lead.length];
    if (lead && lead !== "-") {
      const f = noteFreq(lead);
      if (f)
        this.tone(f * tr, t, dur * 1.9, pat.leadType, pat.gainLead ?? 0.15, this.musicGain, 0.004, dur * 0.5);
    }
    const bass = pat.bass[step % pat.bass.length];
    if (bass && bass !== "-") {
      const f = noteFreq(bass);
      if (f)
        this.tone(f, t, dur * 0.92, pat.bassType, pat.gainBass ?? 0.18, this.musicGain, 0.006);
    }
    if (step % 4 === 0) {
      const pad = pat.pad[Math.floor(step / 4) % pat.pad.length];
      const f = noteFreq(pad);
      if (f) {
        this.tone(f, t, dur * 15.5, pat.padType, pat.gainPad ?? 0.1, this.musicGain, 0.25);
        this.tone(f * 1.5, t, dur * 15.5, pat.padType, (pat.gainPad ?? 0.1) * 0.5, this.musicGain, 0.25);
      }
    }
    if (pat.drums) {
      const d = pat.drums[step % pat.drums.length];
      const target = this.combatOn ? 1 : this.cur === "boss" ? 1 : 0.55;
      this.drumGain += (target - this.drumGain) * 0.02;
      if (d === "k")
        this.kick(t, 0.5 * this.drumGain);
      else if (d === "s")
        this.noiseBurst(t, 0.07, 1800, 0.16 * this.drumGain, "bandpass");
      else if (d === "h")
        this.noiseBurst(t, 0.03, 7000, 0.05 * this.drumGain, "highpass");
      const tensionTarget = this.combatOn && this.cur !== "boss" ? 1 : 0;
      this.tensionGain += (tensionTarget - this.tensionGain) * 0.03;
      if (step % 2 === 0 && d !== "k" && this.tensionGain > 0.05) {
        this.tensionKick(t, 0.15 * this.tensionGain);
      }
    }
  }
  tone(freq, t, dur, type, gain, bus, attack = 0.01, decay) {
    if (!this.ctx)
      return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const d = decay ?? dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  kick(t, gain) {
    if (!this.ctx)
      return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    g.gain.setValueAtTime(gain * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.15);
  }
  tensionKick(t, gain) {
    if (!this.ctx)
      return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    g.gain.setValueAtTime(gain * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.12);
  }
  noiseBurst(t, dur, freq, gain, filter) {
    if (!this.ctx)
      return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0;i < len; i++)
      data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
  sTone(f0, f1, dur, type, gain, delay = 0) {
    if (!this.ctx)
      return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  sNoise(dur, freq, gain, filter = "bandpass", delay = 0, sweepTo) {
    if (!this.ctx)
      return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0;i < len; i++)
      data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo)
      f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
  sSongTone(f0, dur, gain, delay = 0, vib = 5) {
    if (!this.ctx)
      return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    lfo.type = "sine";
    lfo.frequency.value = vib;
    lg.gain.value = f0 * 0.018;
    lfo.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  sfx(name) {
    this.init();
    if (!this.ctx)
      return;
    switch (name) {
      case "swing":
        this.sNoise(0.09, 2600, 0.16, "bandpass", 0, 900);
        break;
      case "swing2":
        this.sNoise(0.11, 2100, 0.18, "bandpass", 0, 700);
        break;
      case "hit":
        this.sTone(300, 90, 0.1, "square", 0.2);
        this.sNoise(0.06, 1200, 0.14);
        break;
      case "crit":
        this.sTone(520, 110, 0.16, "square", 0.24);
        this.sNoise(0.1, 2400, 0.18);
        break;
      case "parry":
        this.sTone(1250, 1900, 0.09, "square", 0.2);
        this.sTone(2500, 3100, 0.14, "sine", 0.16, 0.02);
        break;
      case "parryFail":
        this.sTone(500, 380, 0.08, "square", 0.1);
        break;
      case "dodge":
        this.sNoise(0.14, 900, 0.1, "bandpass", 0, 3200);
        break;
      case "hurt":
        this.sTone(280, 120, 0.14, "sawtooth", 0.18);
        break;
      case "enemyDie":
        this.sTone(340, 60, 0.3, "sawtooth", 0.16);
        this.sNoise(0.2, 700, 0.12, "lowpass");
        break;
      case "coin":
        this.sTone(1150, 1150, 0.06, "square", 0.1);
        this.sTone(1720, 1720, 0.1, "square", 0.1, 0.06);
        break;
      case "potion":
        this.sTone(420, 780, 0.12, "sine", 0.14);
        this.sTone(640, 990, 0.12, "sine", 0.12, 0.09);
        break;
      case "chest":
        this.sTone(240, 240, 0.08, "square", 0.1);
        this.sTone(480, 480, 0.1, "square", 0.12, 0.09);
        this.sTone(720, 720, 0.16, "square", 0.12, 0.19);
        break;
      case "levelup":
        [523, 659, 784, 1047].forEach((f, i) => this.sTone(f, f, 0.14, "square", 0.14, i * 0.09));
        break;
      case "quest":
        [659, 880].forEach((f, i) => this.sTone(f, f, 0.18, "triangle", 0.14, i * 0.12));
        break;
      case "blip":
        this.sTone(880 + Math.random() * 160, 860, 0.03, "square", 0.05);
        break;
      case "select":
        this.sTone(660, 880, 0.06, "square", 0.09);
        break;
      case "confirm":
        this.sTone(520, 780, 0.1, "square", 0.12);
        break;
      case "echo":
        this.sTone(180, 900, 0.5, "sine", 0.14);
        this.sTone(270, 1350, 0.55, "sine", 0.1, 0.05);
        this.sNoise(0.6, 5200, 0.05, "highpass", 0.1, 9000);
        break;
      case "epoch":
        this.sTone(1400, 220, 0.42, "sine", 0.13);
        this.sNoise(0.4, 3200, 0.07, "bandpass", 0, 500);
        break;
      case "fire":
        this.sNoise(0.24, 640, 0.14, "lowpass", 0, 220);
        this.sTone(190, 70, 0.2, "sawtooth", 0.07);
        break;
      case "ice":
        this.sTone(1480, 880, 0.12, "triangle", 0.13);
        this.sNoise(0.08, 5200, 0.08, "highpass", 0.03);
        break;
      case "bolt":
        this.sTone(2100, 320, 0.09, "square", 0.13);
        this.sNoise(0.07, 3600, 0.12);
        break;
      case "holy":
        [784, 988, 1319].forEach((f, i) => this.sTone(f, f, 0.3, "sine", 0.09, i * 0.05));
        break;
      case "shadow":
        this.sTone(220, 70, 0.35, "sawtooth", 0.11);
        this.sNoise(0.3, 400, 0.08, "lowpass");
        break;
      case "roar":
        this.sTone(120, 42, 0.7, "sawtooth", 0.24);
        this.sNoise(0.6, 300, 0.16, "lowpass", 0, 90);
        break;
      case "slam":
        this.sTone(90, 30, 0.28, "sine", 0.3);
        this.sNoise(0.22, 420, 0.22, "lowpass");
        break;
      case "die":
        this.sTone(420, 60, 0.8, "sawtooth", 0.18);
        break;
      case "save":
        [880, 1175, 1568].forEach((f, i) => this.sTone(f, f, 0.22, "sine", 0.1, i * 0.1));
        break;
      case "uiOpen":
        this.sTone(440, 660, 0.07, "square", 0.07);
        break;
      case "error":
        this.sTone(220, 180, 0.12, "square", 0.1);
        break;
      case "companionShot":
        this.sNoise(0.06, 3000, 0.07, "highpass");
        this.sTone(900, 1500, 0.05, "triangle", 0.05);
        break;
      case "break":
        this.sNoise(0.18, 4200, 0.2, "highpass", 0, 1200);
        this.sTone(1800, 220, 0.28, "triangle", 0.16);
        this.sNoise(0.12, 900, 0.12, "bandpass", 0.05, 300);
        break;
      case "memory":
        [659, 784, 880, 1175].forEach((f, i) => {
          this.sTone(f, f, 0.5, "sine", 0.09, i * 0.16);
          this.sTone(f * 2, f * 2, 0.28, "sine", 0.03, i * 0.16);
        });
        break;
      case "banner":
        this.sTone(98, 92, 0.55, "sawtooth", 0.2);
        this.sTone(147, 138, 0.5, "sawtooth", 0.12, 0.02);
        this.sNoise(0.4, 300, 0.06, "lowpass");
        break;
      case "whoosh":
        this.sNoise(0.16, 1400, 0.09, "bandpass", 0, 3800);
        break;
      case "splash":
        this.sNoise(0.22, 1500, 0.16, "lowpass", 0, 260);
        this.sTone(320, 760, 0.07, "sine", 0.08, 0.04);
        this.sTone(480, 940, 0.06, "sine", 0.07, 0.1);
        break;
      case "song":
        this.sSongTone(784, 1.1, 0.07, 0, 4.6);
        this.sSongTone(988, 1, 0.06, 0.35, 5.3);
        this.sSongTone(659, 1.4, 0.05, 0.7, 4.1);
        this.sNoise(1.2, 5200, 0.02, "highpass", 0.2, 8000);
        break;
      case "gust":
        this.sNoise(0.5, 400, 0.13, "bandpass", 0, 2000);
        break;
      case "lamp":
        this.sTone(196, 524, 0.16, "triangle", 0.13);
        this.sTone(524, 524, 0.1, "sine", 0.06, 0.14);
        this.sNoise(0.05, 5600, 0.07, "highpass", 0.05);
        break;
      case "wraith":
        this.sNoise(0.5, 6200, 0.045, "highpass", 0, 8200);
        this.sTone(880, 240, 0.55, "sine", 0.05);
        this.sTone(830, 200, 0.6, "triangle", 0.035, 0.06);
        break;
    }
  }
}
var audio = new AudioEngine;

// src/game/interludios.ts
var INTERLUDIOS = {
  interludio_acto2_a: {
    name: "El Eco",
    portrait: "fragment",
    text: "El valle se queda atrás, Portador, y por primera vez desde que despertaste el silencio pesa menos. El Eco de la Voz duerme en ti como una brasa bajo la ceniza: todavía no canta, pero calienta. La Niebla Muda, que todo lo borra, se abre a tu paso como si reconociera al mensajero del dios que asesinaron.",
    action: "flag_interludio_acto2_vista",
    options: [{ text: "…", next: "interludio_acto2_b" }]
  },
  interludio_acto2_b: {
    name: "El Eco",
    portrait: "fragment",
    text: "Trescientos años lleva el mundo esperando esta caminata. La Noche del Silencio partió el canto de Aelthar en siete Ecos, y cada Eco que despiertas devuelve un trozo de ayer a un mundo que lo olvida todo: nombres, canciones, el rostro de la madre. La Orden de Vesh creyó que matando al tejedor mataba la tela. Se equivocó: el hilo sigue ahí. Y tú lo estás tirando de nuevo, punto a punto.",
    options: [{ text: "…", next: "interludio_acto2_c" }]
  },
  interludio_acto2_c: {
    name: "El Eco",
    portrait: "fragment",
    text: "Al sur, el mar. Los pescadores juran que la bruma de la Costa canta con voz prestada y que los barcos que la siguen no vuelven. Allí espera el segundo Eco, guardado por algo que aprendió de memoria una letra que nunca fue suya. Camina, Portador: el mundo no se teje solo. Cada nota que devuelves es un punto que la Niebla no podrá deshacer.",
    options: [{ text: "(Seguir camino)", next: "r18_reacc_acto2_brisa" }]
  },
  interludio_acto3_a: {
    name: "El Eco",
    portrait: "fragment",
    text: "Anoche el mundo cantó al revés, Portador. Lo oíste: la nana de Toln bajó cuando debía subir, el pozo de Teo respondió antes de que alguien llamara, y la orilla de Mara devolvió barcos que el mar guardaba desde hace treinta años. Un canto derecho sostiene el mundo. Un canto al revés... lo desteje.",
    action: "flag_interludio_acto3_vista",
    options: [{ text: "…", next: "interludio_acto3_b" }]
  },
  interludio_acto3_b: {
    name: "El Eco",
    portrait: "fragment",
    text: "La Niebla no está robando el Canto: lo está APRENDIÉNDOLO. Nota a nota, del final al principio, como quien deshace un punto de labor para copiar el dibujo. Y lo que la Niebla aprende no lo olvida: canta con las voces de los que se llevó, imita la letra del dios asesinado y espera a que alguien le responda con su propio nombre. Los ecos torcidos son sus lecciones. Enderézalos, y la clase se acaba.",
    options: [{ text: "…", next: "interludio_acto3_c" }]
  },
  interludio_acto3_c: {
    name: "El Eco",
    portrait: "fragment",
    text: "Tres veces sonó torcido esta noche, y tres lugares te esperan: el pozo donde el niño repite lo que oye, la ruina donde el bosque llora hacia atrás, la orilla donde el mar lee los nombres del revés. Camina despacio, Portador: quien le da lecciones a la Niebla todavía no ha dado la cara. Y cuando la dé... mejor que te encuentre cantando derecho.",
    options: [{ text: "(Seguir)", next: "r18_reacc_acto3_brisa" }]
  },
  interludio_acto4_a: {
    name: "El Eco",
    portrait: "fragment",
    text: "Se dice que el silencio tiene miedo, Portador. Desde que enderezaste los tres ecos, la Niebla Muda no sabe qué hacer con las manos: por primera vez en trescientos años, alguien canta más fuerte que ella. Pero tú no cantas solo: estudias. Tu maestro tiene cara de hombre, y la Ciudadela ya oye tu melodía. Lo que viene no se puede esquivar: se canta, o se calla.",
    action: "flag_interludio_acto4_vista",
    options: [{ text: "…", next: "interludio_acto4_b" }]
  },
  interludio_acto4_b: {
    name: "El Eco",
    portrait: "fragment",
    text: "Velmora te lo contó sin rostro: la Orden de Vesh asesinó al dios-tejedor por misericordia, y cada nota del Canto costaba una vida del pasado. Aelthar no fue solo un dios muerto: fue un coro que cobró caro. Ahora la Campana del Ayer de Toln quiere reunir el coro de antes —la voz de Merrow, la resonancia de las cumbres— y tú cargas con la última nota. Que sea la primera que no cobre nada.",
    options: [{ text: "…", next: "interludio_acto4_c" }]
  },
  interludio_acto4_c: {
    name: "El Eco",
    portrait: "fragment",
    text: "Todo canto termina, Portador; los dioses lo saben mejor que nadie. La diferencia está en cómo: hay finales que cierran la herida y finales que la abren en los que quedan. El Último Canto será tuyo: el Eco que elijas, la verdad que digas o calles, la nota que dejes sonar. Camina. El coro de antes espera, y la Campana del Ayer no sabe tocar a medias.",
    options: [{ text: "(Seguir)", next: "r18_reacc_acto4_brisa" }]
  }
};
var ACTO_BANNER_18F = {
  2: "ACTO II — LAS NOTAS PERDIDAS",
  3: "ACTO III — EL CANTO AL REVÉS",
  4: "ACTO IV — EL ÚLTIMO CANTO"
};
var PISTA_TOAST_18F = {
  2: "Nueva pista: el sur guarda el segundo canto",
  3: "Nueva pista: lo que se canta al revés abre puertas",
  4: "Nueva pista: el metal que recuerda quiere ser campana"
};
var QUEST_IDX_18F = { 2: 5, 3: 10, 4: 13 };
var BARRERA_ALTARES_18F = [
  {
    prop: "altar_mareas",
    map: "costa",
    boss: "sirena",
    flag: "sirenaDefeated",
    toast: "La Marea Sin Nombre se interpone entre tú y el Eco"
  },
  {
    prop: "altar_cumbres",
    map: "cumbres",
    boss: "golem",
    flag: "golemDefeated",
    toast: "El Gólem de Escarcha se interpone entre tú y el Eco"
  },
  {
    prop: "altar_c",
    map: "cripta",
    boss: "guardian",
    flag: "guardianDefeated",
    toast: "El Guardián Hueco se interpone entre tú y el Eco"
  }
];
var RADIO_TILES_18F = 4;
var CD_ALTAR_18F = 8;
var TILE_18F = 16;
var ESTADOS_18F = new WeakMap;
function estado18F(g) {
  let e = ESTADOS_18F.get(g);
  if (!e) {
    e = { pendiente: null, banner: null, altarCd: {}, altarDentro: {} };
    ESTADOS_18F.set(g, e);
  }
  return e;
}
function dispararInterludio18F(g, acto) {
  if (!g.player || g.challengeRun)
    return false;
  const flagKey = `interludio_acto${acto}`;
  if (g.flags[flagKey])
    return false;
  g.flags[flagKey] = true;
  const st = estado18F(g);
  if (!st.pendiente)
    st.pendiente = `interludio_acto${acto}_a`;
  audio.sfx("echo");
  g.toast(PISTA_TOAST_18F[acto], "#c8b0e8");
  return true;
}
function interludioTick18F(g) {
  if (!g.player || g.state !== "play" || g.challengeRun)
    return;
  const st = estado18F(g);
  if (g.flags.q6 && g.questIdx === QUEST_IDX_18F[2] && !g.flags.interludio_acto2)
    dispararInterludio18F(g, 2);
  if (g.flags.q11 && g.questIdx === QUEST_IDX_18F[3] && !g.flags.interludio_acto3)
    dispararInterludio18F(g, 3);
  if (g.flags.q14 && g.questIdx === QUEST_IDX_18F[4] && !g.flags.interludio_acto4)
    dispararInterludio18F(g, 4);
  for (const acto of [2, 3, 4]) {
    if (g.flags[`interludio_acto${acto}`] && !g.flags[`interludio_acto${acto}_vista`] && g.questIdx === QUEST_IDX_18F[acto] && !st.pendiente) {
      st.pendiente = `interludio_acto${acto}_a`;
    }
  }
  barreraAltares18F(g, st);
  if (st.pendiente && !g.dlgKey) {
    const acto = st.pendiente.startsWith("interludio_acto2") ? 2 : st.pendiente.startsWith("interludio_acto3") ? 3 : 4;
    st.banner = { texto: ACTO_BANNER_18F[acto], t0: g.globalT };
    const key = st.pendiente;
    st.pendiente = null;
    g.openDialogue(key);
  }
}
function barreraAltares18F(g, st) {
  const p = g.player;
  const alt = BARRERA_ALTARES_18F.find((a) => a.map === g.mapId);
  if (!alt)
    return;
  if (g.flags[alt.flag])
    return;
  const altar = g.map.props.find((pr) => pr.id === alt.prop);
  if (!altar)
    return;
  const ptx = Math.floor(p.x / TILE_18F), pty = Math.floor(p.y / TILE_18F);
  const dentro = Math.hypot(ptx - altar.x, pty - altar.y) <= RADIO_TILES_18F;
  const estaba = st.altarDentro[alt.prop] === true;
  st.altarDentro[alt.prop] = dentro;
  if (!dentro || estaba)
    return;
  const jefe = g.enemies.find((e) => e.etype === alt.boss && !e.dead);
  if (!jefe)
    return;
  if (g.globalT - (st.altarCd[alt.prop] ?? -1e9) < CD_ALTAR_18F)
    return;
  st.altarCd[alt.prop] = g.globalT;
  jefe.aggro = true;
  if (jefe.ai === "patrulla")
    jefe.ai = "persigue";
  if (jefe.spawnGuard && jefe.spawnGuard > 0)
    jefe.spawnGuard = 0;
  if (!g.bossActive) {
    g.bossRef = jefe;
    g.bossActive = true;
  }
  audio.sfx("banner");
  g.toast(alt.toast, "#8ef0ff");
}
var BANNER_DUR_18F = 2.5;
function bannerActo18F(g) {
  const st = ESTADOS_18F.get(g);
  if (!st?.banner)
    return null;
  const e = g.globalT - st.banner.t0;
  if (e < 0)
    return null;
  if (e > BANNER_DUR_18F) {
    st.banner = null;
    return null;
  }
  const alpha = e < 0.35 ? e / 0.35 : e > BANNER_DUR_18F - 0.6 ? Math.max(0, (BANNER_DUR_18F - e) / 0.6) : 1;
  return { texto: st.banner.texto, alpha };
}

// src/game/data.ts
var QUESTS = [
  { id: "q1", name: "El Despertar", steps: ["Habla con la Anciana Brisa en la plaza de Lunaris"] },
  { id: "q2", name: "Lobos en la Niebla", steps: ["Caza 3 Lobos de Niebla en el sur del valle (0/3)", "Vuelve con la Anciana Brisa"] },
  { id: "q3", name: "El Susurro del Bosque", steps: ["Viaja al Bosque Susurrante por el norte", "Encuentra la Ruina Antigua y toca el Fragmento de Eco"] },
  { id: "q4", name: "La Cripta del Primer Canto", steps: ["Cruza el puente roto cambiando al pasado (Q)", "Derrota al Guardián Hueco", "Recupera el Eco de la Voz en el altar"] },
  { id: "q5", name: "Ecos de Esperanza", steps: ["Regresa con la Anciana Brisa a Lunaris"] },
  { id: "q6", name: "El Rumor del Mar", steps: ["Sigue el camino del sur de Lunaris hasta la Costa de Bruma", "Busca a Mara, la farera, junto a su faro apagado en el oeste de la costa"] },
  { id: "q7", name: "La Sirena sin Canto", steps: ["Acércate a la nave naufragada del este de la costa: la Sirena Abisal despertará al oír tu Eco", "Derrota a la Sirena Abisal: quiebra su barra de quiebre y calla su canto", "Recupera el Eco de las Mareas en el altar del sur del naufragio (si su custodia sigue viva, se interpondrá)"] },
  { id: "q8", name: "La Aldea que Olvidó su Nombre", steps: ["Viaja a la Aldea de Merrow, al este de la Costa de Bruma", "Enciende los 3 Faroles del Recuerdo: viaja al pasado con Q junto a cada farol de la aldea", "Habla con la Espectro de Merrow en la plaza"] },
  { id: "q9", name: "La Cumbre del Segundo Canto", steps: ["Cruza el paso del noreste del Bosque: Cumbres Heladas", "Derrota al Gólem de Escarcha", "Recupera el Eco de las Cumbres en su altar"] },
  { id: "q10", name: "Dos Voces más Fuertes", steps: ["Regresa con la Anciana Brisa a Lunaris"] }
];
var MEMORIES = {
  mem_nana: {
    id: "mem_nana",
    title: "Memoria I · La nana",
    text: "Una voz aflora en tu mente: alguien te arrulla junto al río y tararea la melodía que llevas silbando desde que despertaste. No ves su rostro, solo el vaivén de su chal. La melodía frena la Niebla... como si la conociera de memoria."
  },
  mem_casa: {
    id: "mem_casa",
    title: "Memoria II · La casa junto al río",
    text: "Una casa de piedra bajo un sauce llorón. Huele a pan y a tinta. En el umbral, dos tazas: una siempre llena. La Niebla se detiene en la valla, como si algo la mantuviera a raya con una canción. Esta casa estaba en Lunaris... antes."
  },
  mem_madre: {
    id: "mem_madre",
    title: "Memoria III · La madre sin rostro",
    text: "Manos que cosen una marca de onda en tu pañoleta. «Cuando no recuerdes quién eres —dice una voz que ya casi no oye su propio canto—, acuérdate de lo que has hecho.» Intentas girarte. El recuerdo se quiebra en silencio, y por un latido, jurarías que ella tampoco puede verte la cara."
  },
  mem_faro: {
    id: "mem_faro",
    title: "Memoria IV · El farero que contaba barcos",
    text: "Un faro pequeño y un hombre delgado que encendía la lámpara con una cerilla y una canción. «Cada barco que pasa —decía— es una nota que el mar se lleva. Yo solo pongo la luz para que la orquesta no se pierda.» Bajas la cerilla. La luz no era tuya, pero la melodía, sí."
  },
  mem_invierno: {
    id: "mem_invierno",
    title: "Memoria V · El invierno del silencio",
    text: "Nieve hasta las rodillas y una hoguera de pastores cantando por turnos para no dormirse. «Si el canto se apaga, el frío entra», decía el mayor. Una noche el viento se llevó las voces, y las montañas aprendieron a guardarlas bajo el hielo... esperando que alguien volviera a pedirlas."
  }
};
var TOLN_MAIN = [
  { text: "Mejorar arma", next: "toln_forge" },
  { text: "Ver corazas de la forja", next: "toln_armaduras" },
  { text: "Comprar poción (15 coronas)", next: "toln_potion", action: "buy_potion" },
  { text: "Comprar señuelo de caza (60 coronas)", next: "toln_sennuelo", action: "buy_sennuelo" },
  { text: "¿Qué sabes de la Noche del Silencio?", next: "toln_lore" },
  { text: "Hasta luego.", next: "toln_bye" }
];
var D = {
  brisa_intro: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Despierta, Portador. Tres noches dormiste junto al Santuario y tres noches soñaste con una voz que cantaba bajo la tierra. Esa voz tiene nombre: Aelthar.",
    next: "brisa_intro2"
  },
  brisa_intro2: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Hace 300 años, en la Noche del Silencio, el dios-tejedor fue asesinado. Su canto se partió en siete Ecos y desde entonces la Niebla Muda borra aldeas, recuerdos y nombres. Como la de Merrow, al sur.",
    next: "brisa_intro3"
  },
  brisa_intro3: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Tú puedes OÍR los Ecos. El primer fragmento duerme en la Cripta del Primer Canto, al otro lado del Bosque. Pero antes... necesito saber si puedes sostener un arma.",
    options: [
      { text: "Cuéntame qué se perdió aquella noche. Quiero entenderlo, no solo oírlo.", next: "brisa_lore", tone: "empatico" },
      { text: "Sé usar un arma. Dime qué hay que hacer y lo haré.", next: "brisa_quest2", tone: "pragmatico" },
      { text: "Vaya: elegido por un dios muerto... y sin propina de por medio.", next: "brisa_reac_sarc", tone: "sarcastico" },
      { text: "Apártate, vieja. Si ese Eco existe, será mío.", next: "brisa_reac_amenaz", tone: "amenazante" }
    ]
  },
  brisa_reac_sarc: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Je... trescientos años esperando un héroe y la Niebla me manda uno con lengua. Está bien, muchacho: ríete mientras el acero aguante. Toma, para empezar: unos lobos con hambre de tu Eco.",
    next: "brisa_quest2"
  },
  brisa_reac_amenaz: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Esos ojos ya los he visto, Portador, en todos los que subieron a la Cripta con hambre de Eco. Ninguno volvió a cantar. Aquí no se toma lo que se escucha: aprende la diferencia... y ve a cazar esos lobos.",
    next: "brisa_quest2"
  },
  brisa_lore: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Un Eco es un recuerdo del dios hecho cristal. Quien lo toca revive el pasado de esa tierra: verás el mundo como era, y en algunos lugares podrás alternar entre ambas épocas. Los Guardianes del Canto llevamos 300 años buscándolos. Y tú llegaste justo a tiempo.",
    next: "brisa_quest2"
  },
  brisa_quest2: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "La Niebla trae lobos del sur: han olido el Eco que duerme en ti. Caza a tres y el valle respirará. Habla con Toln si necesitas acero. Y... vuelve con vida, Portador.",
    onEnd: "accept_q2"
  },
  brisa_wolves: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Los lobos aúllan hacia el sur, entre la niebla del valle. Usa la esquiva cuando vayan a saltar y golpea cuando bajen la guardia."
  },
  brisa_bosque: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "El Bosque Susurrante está al norte. Busca la Ruina Antigua, más allá del río: allí susurra el Fragmento de Eco. Lleva pociones, descansa en los Santuarios... y no confíes en la noche."
  },
  brisa_reward: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "El valle ya respira. Toma esto: coronas del fondo del pozo y una poción de la vieja receta. Los Guardianes del Canto te recordarán, Portador.",
    onEnd: "accept_q3",
    options: [
      { text: "Gracias, Brisa. El valle huele a menos silencio gracias a ti.", next: "brisa_rw_emp", tone: "empatico" },
      { text: "Anotado. ¿Qué sigue?", next: "brisa_rw_prag", tone: "pragmatico" },
      { text: "¿Coronas del fondo del pozo? Espero que nadie las hubiera deseado a algo peor.", next: "brisa_rw_sarc", tone: "sarcastico" }
    ]
  },
  brisa_rw_emp: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "«Gracias a ti», alma. Hace treinta años que no oigo el valle respirar de noche. Ve al norte: el Bosque Susurrante guarda el primer susurro del Eco."
  },
  brisa_rw_prag: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Directo. Me gusta. Lo siguiente es el Bosque Susurrante, al norte: encuentra la Ruina Antigua y toca el Fragmento de Eco. Lleva pociones."
  },
  brisa_rw_sarc: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Deseadas fueron, y por eso están donde están: el pozo las guardaba de la Niebla. Habla así delante del agua y quizá te las devuelva... mojadas."
  },
  brisa_fragment: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "¿Lo sentiste? El Fragmento ha despertado tu resonancia: ahora puedes alternar entre el presente y el PASADO de estas tierras. Pulsa Q y mira el valle como era antes del Silencio.",
    next: "brisa_fragment2"
  },
  brisa_fragment2: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "El puente del Bosque se rompió hace 300 años... pero en el pasado sigue en pie. Cruza, llega a la Cripta y recupera el Eco de la Voz. Que tu canto sea más fuerte que tu miedo.",
    onEnd: "accept_q4"
  },
  brisa_crypt: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "El puente solo existe en el pasado, Portador. Pulsa Q junto a él. Y dentro de la Cripta... no confíes en lo que la voz te prometa."
  },
  brisa_final: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "El Eco de la Voz... después de 300 años vuelve a sonar en Lunaris. Escucha: ahora la melodía tiene tu nombre entre sus notas. Los Guardianes ya cantan en la capilla. Esta era solo la primera nota, Portador: quedan seis Ecos... y la Niebla seguirá avanzando mientras no los reunas.",
    options: [
      { text: "El mar llama y yo tengo oídos. Hablemos del sur.", next: "brisa_acto2" },
      { text: "Aún tengo cosas que hacer por Velmora.", next: "brisa_stay" }
    ]
  },
  brisa_acto2: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Quedan seis Ecos, Portador, y ahora que el valle respira, el mar llama: los pescadores juran oír una voz entre la bruma de la Costa, al sur de Lunaris. Una voz que canta hacia tierra... y no devuelve a los que van tras ella. Baja por el camino del sur y busca a la farera: su faro lleva 300 años apagado y las cerillas se agotan.",
    onEnd: "accept_q6",
    options: [
      { text: "Iré. Que el mar aprenda mi nombre sin borrarme el propio.", next: "brisa_acto2b", tone: "empatico" },
      { text: "Costa, farera, sirena, Eco. Entendido. Me pongo en camino.", next: "brisa_acto2b", tone: "pragmatico" },
      { text: "Una voz en la bruma que no devuelve a los curiosos. Y voy yo. Encantador.", next: "brisa_acto2b", tone: "sarcastico" }
    ]
  },
  brisa_acto2b: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Je... esa manera de hablar te delata, Portador: aún te queda canto por dentro. Ve, pues. Los Guardianes velarán Lunaris, la Orden contará tus pasos... y yo dejaré una taza llena en el umbral, por si el mar te trae de vuelta."
  },
  brisa_final2: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Dos voces más... tres Ecos de siete. La Niebla retrocede en el mapa de los Guardianes: ya se lee el valle, ya se oye el mar, y las cumbres recuerdan el invierno sin frío. Pero el Heraldo tenía razón en una cosa, Portador: la Ciudadela también oye tu melodía ahora. (Fin del Acto II — la demo continúa hasta que tú decidas partir.)",
    onEnd: "acto2_report",
    options: [
      { text: "Iré a por el cuarto Eco. (Terminar la demo)", action: "end_demo" },
      { text: "Aún no. Queda mundo por escuchar.", next: "brisa_stay" }
    ]
  },
  brisa_stay: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Entonces descansa en los Santuarios, mejora tu acero con Toln y busca los ecos menores que susurran entre las ruinas. Velmora te necesita despierto, no apresurado. Vuelve cuando quieras terminar la demo."
  },
  brisa_end: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Que el canto te acompañe. Nos vemos en la siguiente nota, Portador.",
    onEnd: "end_demo"
  },
  brisa_idle: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "El valle respira y el mundo suena más lejos, Portador: el mar llama desde el sur y la montaña aguarda al norte. Cuando quieras ponerle final a la demo, vuelve a mí y lo cantaremos juntos."
  },
  brisa_idle_emp: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Ahí estás, alma. Ahora que el valle respira, el resto del mundo suena más lejos: el mar al sur, las cumbres al norte, y tú en medio con una melodía que ya no es solo tuya. La demo seguirá esperándote aquí, junto a la taza llena."
  },
  brisa_idle_amenaz: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "...El pueblo cruza de acera cuando pasas y hasta la bruma te deja pasar primero, Portador. Modera esa lengua con la Orden de Vesh: toman los silencios por amenazas, y la Ciudadela ya oye tu melodía. La demo seguirá esperándote aquí."
  },
  toln_intro: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "¡Ja! El viejo Brisa dijo que oíste Ecos. Yo oigo otra cosa: tu arma pidiendo filo. La forja sigue caliente, Portador, y el metal no pregunta por dioses.",
    options: TOLN_MAIN
  },
  toln_intro_listillo: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "¡Ja! Vuelve el Listillo. La forja no descuenta ironías, pero sí cambia filo por coronas. ¿Qué será hoy?",
    options: TOLN_MAIN
  },
  toln_forge: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "(Usa esta conversación para mejorar: cada nivel de forja añade daño a tu arma. Las runas de mejora llegan hasta +5 en esta demo.)",
    options: [
      { text: "Forjar (+1)", next: "toln_intro", action: "forge" },
      { text: "Dale caña al martillo, maestro. Mi oro es tuyo.", next: "toln_intro", action: "forge", tone: "pragmatico" },
      { text: "Casi me haces creer que el metal escucha. Casi.", next: "toln_forge_sarc", tone: "sarcastico" },
      { text: "Volver", next: "toln_intro" }
    ]
  },
  toln_forge_sarc: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "Escucha más que tu boca, Listillo. El acero bien templado canta cuando cae la Niebla... y estas últimas noches canta bajito, como rezando. Vuelve al yunque cuando tengas coronas de verdad.",
    next: "toln_intro"
  },
  toln_armaduras: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "Corazas, ahora que la Niebla pega más fuerte. El cuero es honesto, la malla canta bajito y las Placas pesan como una confesión. Dime cuál y te la forjo.",
    options: [
      { text: "Coraza de Cuero (80 coronas) — daño recibido −8%", next: "toln_armaduras", action: "armor_1" },
      { text: "Malla del Alba (160) — −15% · +10 vigor/s", next: "toln_armaduras", action: "armor_2" },
      { text: "Placas del Canto (240) — −22% · −8% velocidad", next: "toln_armaduras", action: "armor_3" },
      { text: "Manto de Ecos (280) — −12% · refleja 15% melé", next: "toln_armaduras", action: "armor_4" },
      { text: "Guarda del Primer Canto (420) — −28%", next: "toln_armaduras", action: "armor_5" },
      { text: "Volver", next: "toln_intro" }
    ]
  },
  toln_potion: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "Para los caminos largos. Bebe con cabeza.",
    next: "toln_intro"
  },
  toln_sennuelo: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "Señuelo de caza: carne curada, hierro viejo y un olor que los bichos no perdonan. Lo lanzas (tecla 8) tres pasos adelante, ellos van a por él, y tú decides si peleas o te escabulles. Ojo: los jefes no se distraen con panzadas.",
    next: "toln_intro"
  },
  toln_lore: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "Mi abuelo forjó el arma que mató al dios. No lo digo con orgullo: lo digo con vergüenza. Desde entonces, cada martillazo mío es una disculpa. Si algún día vas a la Ciudadela... crimson sobre acero, recuerda mi nombre.",
    next: "toln_intro"
  },
  toln_bye: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "El acero espera. Y cuidado con la niebla al sur: desde ahí no vuelven ni los nombres."
  },
  ilwen_intro: {
    name: "Ilwen",
    portrait: "ilwen",
    text: "Un Portador, aquí... ¿también tú oyes la Niebla robando nombres? Yo busco a mi hermana Naia: la Niebla se la llevó hacia el norte. Sé moverme entre estos árboles y mi arco no falla.",
    options: [
      { text: "Ven conmigo. Nadie debería tener que buscar sola.", next: "ilwen_join", action: "recruit_ilwen", tone: "empatico" },
      { text: "Necesito cobertura a distancia. Tú necesitas pistas. Trato justo.", next: "ilwen_join", action: "recruit_ilwen", tone: "pragmatico" },
      { text: "¿Y si lo que quedó de tu hermana ya no responde a tu silbo?", next: "ilwen_reac_amenaz", tone: "amenazante" },
      { text: "Sigo solo por ahora.", next: "ilwen_wait" }
    ]
  },
  ilwen_reac_amenaz: {
    name: "Ilwen",
    portrait: "ilwen",
    text: "...(baja el arco un dedo) Cuida esa lengua, Portador. La Niebla borra nombres; tú pareces empeñado en borrar también las esperanzas. Cuando hables como alguien con quien caminar, aquí estaré.",
    next: "ilwen_wait"
  },
  ilwen_join: {
    name: "Ilwen",
    portrait: "ilwen",
    text: "Entonces vamos, Portador. Cubriré tu espalda desde la distancia. Que los árboles nos encubran."
  },
  ilwen_wait: {
    name: "Ilwen",
    portrait: "ilwen",
    text: "Te encontraré aquí si cambias de idea. El Bosque no perdona a los solitarios."
  },
  ilwen_chat: {
    name: "Ilwen",
    portrait: "ilwen",
    text: "Naia cantaba mejor que las nereidas. Si la Niebla no borró su nombre, la encontraré. Cuenta con mi arco, Portador."
  },
  ilwen_chat_prag: {
    name: "Ilwen",
    portrait: "ilwen",
    text: "Hablamos claro, los dos: me gusta cómo mandas. Sin promesas ni flores. Mi arco cubre a quien sabe lo que quiere. Naia cantaba mejor que las nereidas... la encontraré. Cuenta conmigo, Portador."
  },
  voz_fragment: {
    name: "???",
    portrait: "fragment",
    text: "...¿quiéeeeen... despierta... el canto...? Ah... otro Portador. Otro pedazo de mí, perdido en el tiempo. Toma mi resonancia: alterna entre lo que fui y lo que soy. (Has desbloqueado el CAMBIO DE ÉPOCA: pulsa Q)",
    onEnd: "fragment_touched",
    options: [
      { text: "Descansa. Te devolveré cada pedazo, aunque me lleve vidas.", next: "voz_frag_emp", tone: "empatico" },
      { text: "Resonancia aceptada. Ahora: ¿dónde oigo el resto?", next: "voz_frag_prag", tone: "pragmatico" },
      { text: "Un dios que se paga a plazos. Qué época tan práctica.", next: "voz_frag_sarc", tone: "sarcastico" }
    ]
  },
  voz_frag_emp: {
    name: "???",
    portrait: "fragment",
    text: "...vides... sí... Yo también tardé vidas en aprender a callar. Ve... el valle recuerda por donde caminas... te canta por debajo... escúchalo de noche..."
  },
  voz_frag_prag: {
    name: "???",
    portrait: "fragment",
    text: "...el primero duerme bajo la Cripta, custodiado por lo que quedó de mi primer coro. Lleva acero... y canto. El resto... ya lo oirás..."
  },
  voz_frag_sarc: {
    name: "???",
    portrait: "fragment",
    text: "...mmm... bromea el pedacito... A los dioses nos matan por partes, ¿sabías? Primero la voz... luego el nombre... Tú verás qué te toca recoger..."
  },
  voz_vesh: {
    name: "Gran Inquisidor Vesh",
    portrait: "sombra",
    text: "Puedo oírte, Portador. Cada paso que das hacia el Eco resuena en MI ciudadela. Sube. Reúne las migajas de tu dios... y yo recogeré lo que quede de ti."
  },
  voz_guardian: {
    name: "Guardián Hueco",
    portrait: "guardian",
    text: "CORO... ROTO. CANTO... VACÍO. TÚ... LLEVAS... RESONANCIA. LA... QUIERO."
  },
  eco_voz: {
    name: "Eco de la Voz",
    portrait: "fragment",
    text: "El primer canto vuelve a nacer entre tus manos. «Cuando el miedo te hable, canta más alto.» (Eco de la Voz recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)",
    onEnd: "eco_taken_mem",
    options: [
      { text: "Tu nana... era esta melodía, ¿verdad? La recordaba sin saber de quién.", next: "eco_voz_emp", tone: "empatico" },
      { text: "Uno de siete. ¿Dónde oigo el siguiente?", next: "eco_voz_prag", tone: "pragmatico" },
      { text: "«Canta más alto», dice la voz. A ver si la Niebla es sorda también.", next: "eco_voz_sarc", tone: "sarcastico" }
    ]
  },
  eco_voz_emp: {
    name: "Eco de la Voz",
    portrait: "fragment",
    text: "...la cantaba junto al río, con el chal al hombro. No recuerdo su cara — a mí tampoco me deja verse, mira tú — pero la canción sí. Ya es tuya. Cuídala: es más vieja que tu nombre."
  },
  eco_voz_prag: {
    name: "Eco de la Voz",
    portrait: "fragment",
    text: "...escucha el bosque: los Ecos llaman a los Ecos. Y ten cuidado con los que rezan a lo que no canta... la Ciudadela también oye tu melodía ahora."
  },
  eco_voz_sarc: {
    name: "Eco de la Voz",
    portrait: "fragment",
    text: "...no es sorda. Es paciente. Peor cosa. Canta, Portador... y ya verás quién responde: los que aman el canto... y los que aprendieron a temerlo."
  },
  doran_intro: {
    name: "Doran",
    portrait: "doran",
    text: "Sin prisa, sin espinas... La Niebla te eriza la piel, ¿eh? A nosotros nos da lástima. El Círculo Verde no la combate: la escucha. No es maldad, Portador: es lo que había ANTES del canto, cuando el mundo era silencio y raíz.",
    options: [
      { text: "Si la Niebla guarda algo, merece que alguien la escuche. Enséñame.", next: "doran_verde", action: "rep_circulo_5", tone: "empatico" },
      { text: "Teoría interesante. ¿Y qué gana el Círculo defendiéndola?", next: "doran_verde", action: "rep_circulo_5", tone: "pragmatico" },
      { text: "Qué bonito: apocalipsis con musgo. ¿Y los pueblos que se borra?", next: "doran_sarc", tone: "sarcastico" },
      { text: "La Orden de Vesh la quemaría con lanza y sal bendita. Y no creo que erraran.", next: "doran_orden", tone: "amenazante" }
    ]
  },
  doran_verde: {
    name: "Doran",
    portrait: "doran",
    text: "Lo oyes, ¿verdad? Debajo del bosque hay una melodía que no canta Aelthar... más vieja. No rendimos culto a la Niebla: le enseñamos dónde parar, como se educa un río con presas. Vuelve cuando lleves el primer Eco: entonces la Niebla te sonará distinto."
  },
  doran_sarc: {
    name: "Doran",
    portrait: "doran",
    text: "Los borra porque no les dejan sitio, como el agua cuando tapan el cauce. Podemos discutirlo sentados una noche de luna... o puedes seguir golpeando raíces con el acero y ver quién se cansa antes."
  },
  doran_orden: {
    name: "Doran",
    portrait: "doran",
    text: "...Lanzas y sal bendita. Sí, esa es la letra de su canción: lo que arde no vuelve a cantar jamás. Así «curó» la Orden el valle de Merrow, ¿lo sabías? Dime, Portador: ¿vas a ser su lanza en este bosque?",
    options: [
      { text: "No. Que la Orden de Vesh se quede con sus lanzas y su miedo.", next: "doran_reject", action: "rep_orden_-5" },
      { text: "Si hay que elegir entre su fuego y tu musgo... ya veremos.", next: "doran_bye" }
    ]
  },
  doran_reject: {
    name: "Doran",
    portrait: "doran",
    text: "Que la Madre Espina te oiga. Los del Círculo no olvidamos a quien se planta frente a la Lanza. Pasa cuando quieras: el bosque ya conoce tu paso."
  },
  doran_bye: {
    name: "Doran",
    portrait: "doran",
    text: "Piénsalo caminando. La Niebla no corre: llega. Y cuando llegue, preferiré teneros a todos cantando del mismo lado."
  },
  heraldo_intro: {
    name: "Heraldo de Vesh",
    portrait: "kael",
    text: "Así que este es el recipiente. No te arrodilles: no sería sincero. El Gran Inquisidor sabía que la Niebla escondía el primero de los siete... y ahora dice: «la Lanza ya está preparada para la segunda vez». Yo solo repito las palabras. Al recipiente no le hace falta entenderlas: basta con que contenga.",
    options: [
      { text: "Dile a tu Inquisidor que si quiere lo que llevo, que baje a buscarlo.", next: "heraldo_amenaz", action: "rep_orden_-5", tone: "amenazante" },
      { text: "No soy «recipiente» de nadie. Pero de momento hablaremos.", next: "heraldo_prag", tone: "pragmatico" },
      { text: "¿Qué es «la segunda vez»?", next: "heraldo_emp", tone: "empatico" }
    ]
  },
  heraldo_amenaz: {
    name: "Heraldo de Vesh",
    portrait: "kael",
    text: "...La guardaré para el informe, palabra por palabra. Sabes, recipiente: el acero de la Ciudadela canta muy bajo, y por eso corta tanto. El Gran Inquisidor os espera a ti y a tu melodía. Camina con cuidado."
  },
  heraldo_prag: {
    name: "Heraldo de Vesh",
    portrait: "kael",
    text: "La calma fingida también es una respuesta; el Inquisidor la acepta, envuelta en papel y sello. Cuando contengas los siete —si llegas—, la Orden vendrá a cobrarlos. Nos veremos, recipiente."
  },
  heraldo_emp: {
    name: "Heraldo de Vesh",
    portrait: "kael",
    text: "La primera vez, la Lanza de los Durn atravesó el costado del dios y su canto se hizo mil pedazos que llamáis Ecos. La segunda vez... eso no me corresponde contarlo. El Gran Inquisidor espera que seas tú quien lo cuente, cuando todo esté en su sitio."
  },
  teo_intro: {
    name: "Teo",
    portrait: "teo",
    text: "¿Eres tú? ¿El que sacó a la gente de la Niebla? Yo no recuerdo cómo salí... solo una nana que me cantaba mi madre: mmm-mm-mmm... La cantas igual que yo la sueño, ¿lo sabías? Cuando la tarareo, la niebla no me pega tanto miedo.",
    options: [
      { text: "Cántala siempre, Teo. Las canciones cuidan a quien las lleva.", next: "teo_emp", tone: "empatico" },
      { text: "Quédate cerca del Santuario y del pozo. Es lo más seguro.", next: "teo_prag", tone: "pragmatico" },
      { text: "Vaya talento: la Niebla borra pueblos enteros y tú la despiertas a dúo.", next: "teo_sarc", tone: "sarcastico" }
    ]
  },
  teo_emp: {
    name: "Teo",
    portrait: "teo",
    text: "¡Prometido! La canto para merendar, para dormir y para que la luna no se pierda. Un día, si te pierdes, me la cantas al revés y me encuentras. Así funciona, ¿no?"
  },
  teo_prag: {
    name: "Teo",
    portrait: "teo",
    text: "Vale... aunque de noche el pozo susurra y yo le susurro de vuelta. Nos entendemos. Si ves que no estoy, es que estoy aprendiendo nombres nuevos."
  },
  teo_sarc: {
    name: "Teo",
    portrait: "teo",
    text: "(se ríe) ¡Mmm-mmm!, ¡aaaah! ¿Ves? La Niebla ni se mueve... Tú también puedes, solo que te da vergüenza cantar delante de la gente mayor."
  },
  mara_intro: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "¿Vivo? Hacía meses que no bajaba nadie por el camino del valle... Un Portador, dice la bruma. Pues mira: el faro lleva trescientos años apagado y mi familia lleva trescientas noches encendiéndole una cerilla a la esperanza. Mi abuelo juraba que el mar guarda las notas que el dios no pudo cantar. Yo digo que algo ha empezado a usarlas.",
    action: "mara_met",
    options: [
      { text: "Lo siento por tu faro... y por los que no vuelven. ¿Qué es eso que canta?", next: "mara_sirena", tone: "empatico" },
      { text: "Una voz en la bruma, un faro apagado. Dime dónde y cuándo.", next: "mara_sirena", tone: "pragmatico" },
      { text: "Trescientas noches de cerillas... ¿y nadie trajo más cerillas?", next: "mara_sarc", tone: "sarcastico" },
      { text: "Si esa voz sabe mi nombre, iré a convencerla de lo contrario.", next: "mara_amenaz", tone: "amenazante" }
    ]
  },
  mara_sirena: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "Al este hay un naufragio que la marea no se lleva; la Sirena canta debajo de la quilla. Cuando canta, los pescados suben a oírla y no vuelven... y los pescadores que la siguen, menos. Si vas —y vas, se te nota en la cara— llévate sal, silencio y no le sigas la letra."
  },
  mara_sarc: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "(se ríe, con cal) Las cerillas se las lleva el viento, Portador, como los nombres. Pero tienes lengua de sal, y en esta costa la sal manda. El naufragio está al este, siguiendo la línea de la marea baja: pregunta por la que canta bajo la quilla. Y no le sigas la letra."
  },
  mara_amenaz: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "...(aprieta la cerilla entre los dedos) Con esa voz no se conversa, Portador: se apaga o se obedece. La del naufragio ya probó lo primero con los barcos. Ve con cuidado, y que tu melodía sea más terca que su hambre."
  },
  mara_idle: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "A esta hora la marea lee los nombres viejos en voz baja. Si te quedas quieto, los oirás; si te mueves, te llevará la cuenta. El naufragio sigue al este, Portador: la que canta debajo no tiene prisa, y nosotros sí."
  },
  mara_idle_emp: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "Eres de los que escuchan antes de pisar. Mi abuelo decía que así empezaron todos los fareros: el mar guarda las notas que el dios no pudo cantar, y alguien tiene que quedarse en la orilla anotando las que vuelven. Vuelve tú, ¿eh? Anota las mías."
  },
  mara_idle_sarc: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "Sí, sí: ríete de la bruma. Ella también se ríe de nosotros, solo que sin dientes. Anda, ve al este antes de que suba la marea y te deje sin chiste ni barco."
  },
  mara_react: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "...El silencio. ¿Lo oyes? Ya no canta. Trescientos años, y esta mañana el mar se ha quedado sin hambre. Ven: ayúdame con la lámpara. La cerilla tiembla, pero la mano no. (Mara enciende el faro por primera vez en tres siglos; la luz rueda sobre la bruma como una nota larga.)",
    action: "mara_gift",
    options: [
      { text: "La luz es tuya, Mara. Yo solo puse el silencio.", next: "mara_react_emp", tone: "empatico" },
      { text: "Dos pociones y una luz encendida. Buen trato.", next: "mara_react_prag", tone: "pragmatico" },
      { text: "Trescientos años apagado y funciona a la primera. Ya no hacen faros como antes.", next: "mara_react_sarc", tone: "sarcastico" }
    ]
  },
  mara_react_emp: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "Tuya la luz, mía la terquedad: repartija justa. Esta noche los Guardianes del Canto cantan por ti en la capilla del valle... y el mar, que de Guardianes entiende, te devuelve la barca vacía."
  },
  mara_react_prag: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "La farera no regala: paga. Dos pociones por un mar en calma, y una luz que te guíe si el sur te trae de vuelta. Serás bien venido... y bien oído."
  },
  mara_react_sarc: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "Cuando encendí la lámpara, hasta la bruma hizo la vista gorda. Anda, vete antes de que me veas llorar y lo cuentes en la Ciudadela: aquí la sal la pone el mar."
  },
  mara_faro: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "La luz del faro sube cada noche, aunque ya nadie la pida. Los barcos del norte hablan de una estrella baja en la costa... Si el mar vuelve a cantar algo bajo el agua, yo apagaría la lámpara y me haría la dormida. Tú no: tú vete hacia la montaña, que tus oídos valen para el hielo también."
  },
  vult_intro: {
    name: "Vult, cartógrafo de la Liga",
    portrait: "corvin",
    text: "Vult, cartógrafo jurado de la Liga de Mercaderes —no te fíes del título: con la bruma que hay aquí, cartógrafo y apóstata venimos a ser lo mismo—. Mapeo la Costa de Bruma porque los mapas sin nombres venden caros en la Ciudadela: un cabo sin bautizar es un cabo que alguien paga por ver en pergamino. ¿Quién me manda? La Liga. ¿Quién me mira? La Orden de Vesh, con ese telescopio que usan para todo menos para ver.",
    action: "flag_metVult",
    options: [
      { text: "Hablas como mercader de verdad: los mapas con leyenda, mejor negocio aún.", next: "vult_gremio", action: "rep_liga_5", tone: "pragmatico" },
      { text: "¿Y Merrow? ¿Qué pone tu mapa donde hubo una aldea?", next: "vult_merrow", tone: "empatico" },
      { text: "Vender caro lo sin nombre... y luego quejarse de que la Niebla borra gratis.", next: "vult_sarc", tone: "sarcastico" },
      { text: "Dile a tu Liga que esta costa ya tiene dueño. Y a tu Inquisidor, que se apriete el telescopio.", next: "vult_amenaz", action: "rep_orden_-5", tone: "amenazante" }
    ]
  },
  vult_gremio: {
    name: "Vult, cartógrafo de la Liga",
    portrait: "corvin",
    text: "Eso es. La Liga no vende seda: vende certezas. Por eso la Orden de Vesh nos teme —la fe no admite escalas de medida—: ellos queman lo que no entienden; nosotros lo tasamos. Apunta, Portador: un mapamundi con tu nombre en la leyenda vale más que una paga de por vida. Piénsalo cuando lleves tres Ecos."
  },
  vult_merrow: {
    name: "Vult, cartógrafo de la Liga",
    portrait: "corvin",
    text: "Merrow, al este de esta costa. En mis mapas figura como «terreno no restituido»: así escribe la Liga lo que la Niebla se comió. Los de la Orden juran que la «curaron» hace siglos con lanza y sal. Curación rara: la aldea sigue ahí, en el ayer, y hasta los faroles piden ser encendidos. Cambia de época si no me crees... aunque los cartógrafos no deberíamos creer en el pasado."
  },
  vult_sarc: {
    name: "Vult, cartógrafo de la Liga",
    portrait: "corvin",
    text: "Ríete, que la tinta es cara. Cuando la Niebla borró Merrow, la Liga perdió tres rutas y la Orden perdió la cara; yo, un encargo. Cada cual su pérdida, Portador."
  },
  vult_amenaz: {
    name: "Vult, cartógrafo de la Liga",
    portrait: "corvin",
    text: "...(anota en su libreta sin dejar de sonreír) «El Portador: hostil, territorial, con oído». Ya que coleccionas amenazas, otra: la Liga negoció con cosas peores que tú y sigue facturando. Y conste — a la Orden le conviene saber dónde NO poner sus lanzas."
  },
  vult_idle: {
    name: "Vult, cartógrafo de la Liga",
    portrait: "corvin",
    text: "Sigo sin poner nombre al promontorio del faro. «Punta de la Cerilla», dice la letra; «Punta de Mara», dice mi conciencia. Los mapas mienten mejor cuando les das tiempo."
  },
  vult_idle_prag: {
    name: "Vult, cartógrafo de la Liga",
    portrait: "corvin",
    text: "Si vas al este, memoriza el camino del naufragio: los clientes preguntan por rutas y yo vendo atajos. Los mapas sin nombres venden caros, Portador... pero los mapas con leyendas venden mejor. Y tú ya vas siendo leyenda."
  },
  mera_intro: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "...¿Me hablas? Hace tanto que nadie me habla con voz de fuera... Espera. Espera. Yo era... yo me llamaba... (la anciana busca su nombre entre los pliegues del chal y no lo encuentra). Los vecinos de Merrow se llamaban los unos a los otros cada mañana, en voz alta, para no perderse. La Niebla se llevó los nombres y a nosotros detrás. Quédate... y escucha.",
    action: "flag_metMera",
    options: [
      { text: "Te ayudaré a buscar tu nombre. Dime por dónde se empieza.", next: "mera_pidetarea", tone: "empatico" },
      { text: "Faroles, el ayer, nombres. Dame la lista exacta.", next: "mera_pidetarea", tone: "pragmatico" },
      { text: "Una aldea que se llamaba a sí misma cada mañana... y yo olvidando las llaves.", next: "mera_sarc", tone: "sarcastico" }
    ]
  },
  mera_pidetarea: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "Cada farol guarda un nombre que la Niebla se llevó: tres siguen esperando en el AYER de Merrow —cambia de época con Q y verás arder el pueblo que fuimos—. Enciéndelos y devuélveme el mío. Los faroles no se encienden con fuego, Portador: se encienden con nombres dichos en voz alta."
  },
  mera_sarc: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "(sonríe sin dientes) Las llaves se pierden, Portador; los nombres se los lleva alguien. Aprende la diferencia antes de llegar a mi edad... si llegas. Tres faroles, en el ayer. Enciéndelos y devuélveme el mío."
  },
  mera_wait: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "¿Los faroles? Aún no arde ninguno, Portador. La Niebla no apaga: espera. Y yo también... pero los nombres tienen frío."
  },
  mera_wait1: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "Uno arde... Lo oigo: un nombre vuelve a la boca de quien lo dijo. Faltan dos, Portador. Dos nombres, dos faroles, dos mañanas de Merrow."
  },
  mera_wait2: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "Dos arden. El ayer ya casi ilumina al presente... Falta uno. El último nombre es siempre el más difícil, Portador: es el que uno se dice a sí mismo."
  },
  mera_grateful: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "...Nera. Me llamaba Nera, y mi hijo la decía «madre Nera» como otros dicen «mañana clara»... Da igual: es MÍO. Lo tengo. (El nombre le vuelve a la cara como el color a un retrato; el Eco de los Nombres rueda hacia tus manos, tibio como una palabra dicha a tiempo.) Tómalo: es pequeño, pero guarda a todos. Los que la Niebla se llevó vuelven cuando alguien los dice en voz alta.",
    onEnd: "mera_eco",
    options: [
      { text: "Nera... Era un buen nombre. Lo diré en voz alta de vez en cuando.", next: "mera_grat_emp", tone: "empatico" },
      { text: "Un Eco menor, tres faroles, un nombre devuelto. Cuenta saldada.", next: "mera_grat_prag", tone: "pragmatico" },
      { text: "Un Eco que es una lista de nombres. A la Niebla le encantará el trámite... en teoría.", next: "mera_grat_sarc", tone: "sarcastico" }
    ]
  },
  mera_grat_emp: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "Díselo a los tuyos, no a mí: los nombres no se guardan, se usan. Y cuando la niebla de tu propia cabeza llegue —que llega—, di en voz alta lo que has hecho. Eso también es un nombre, Portador."
  },
  mera_grat_prag: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "Cuenta saldada, sí. Pero vuelve si pasas por el ayer: los faroles agradecen compañía... y yo ya ni recuerdo a qué le tenía miedo."
  },
  mera_grat_sarc: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "Odia el trámite, sí... pero usa la lista: hay nombres que aún abren puertas. La mía, por ejemplo, ya no."
  },
  mera_idle: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "El presente aprendió otra vez a iluminarse. Si me buscas, estaré junto a un farol encendido: es el sitio más parecido a una cita."
  },
  ivo_intro: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "¡Alto ahí! ...Vaya. Un Portador con el Eco a cuestas y yo con la ballesta a medio tender. Pasa, pasa: aquí arriba los modales escasean y el pan está duro. ¿Lo oyes? Nada. La montaña se levantó cuando el canto murió y lleva 300 años esperando a que alguien le cante de vuelta: el Gólem, en la cumbre. Si vas a despertarle la memoria, primero escúchame a mí.",
    action: "flag_metIvo",
    options: [
      { text: "Trescientos años esperando... Pobre montaña. Enséñame a no morir en el intento.", next: "ivo_consejo", action: "rep_circulo_5", tone: "empatico" },
      { text: "Gólem, cumbre, Eco. Dime debilidades y no te estorbo más.", next: "ivo_golem", tone: "pragmatico" },
      { text: "Una montaña con insomnio y yo sin abrigo. Qué pareja tan bien avenida.", next: "ivo_sarc", tone: "sarcastico" },
      { text: "Aparta, viejo. La cumbre es mía.", next: "ivo_amenaz", tone: "amenazante" }
    ]
  },
  ivo_consejo: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "Las arpías pican en vuelo y se ríen del acero lento: espera el picado y pega cuando giren. El fuego las baja —una pluma ardiendo vale por diez consejos—. Y si oyes la ventisca cantar con voz de mujer, no respondas: es la Niebla probando suerte. Dicho esto: que la montaña te oiga bien, Portador."
  },
  ivo_golem: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "El Gólem guarda el altar del Segundo Canto. Es hielo con memoria: lento, y cada paso suyo es una leyenda entera. Cuando se detenga a reunir la ventisca, pega al quiebre: la montaña también estuvo hecha de canciones, y las canciones se rompen por la mitad."
  },
  ivo_sarc: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "Je. El abrigo lo pones tú: el Canto de Ascuas derrite más que cien mantas. Y ojo con las arpías —se ríen de los listillos primero y de los fríos, después."
  },
  ivo_amenaz: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "...(carga la ballesta sin mirarte) La cumbre es de la montaña, Portador, y la montaña no negocia. Me recuerdas a los de la Orden: llegan rugiendo y bajan callados. Sube si te empeñas — el hielo cura la soberbia a base de astillas."
  },
  ivo_idle: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "Las cumbres estaban hechas para cantar por turnos, como los pastores de la vieja historia. Ahora solo cantan cuando el viento se equivoca. Si subes a la cumbre, lleva fuego... y vuelve por otro camino, que el de subir ya lo conocen las arpías."
  },
  ivo_idle_emp: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "Buen viento traes, Portador. Los del Círculo Verde dicen que la montaña no está muerta, solo a la escucha. Ojalá tengan razón: sería una lástima que el segundo canto se quedara dentro para siempre... igual que mi padre se quedó sin volver a nevar tranquilo."
  },
  ivo_after: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "...Baja despacio, Portador. El eco de la cumbre llega hasta aquí: la montaña cantó de vuelta. Mi padre decía que cuando eso pasara, podría volver a nevar sin miedo. Tómate la cumbre con calma: los ecos viejos marean."
  },
  eco_mareas: {
    name: "Eco de las Mareas",
    portrait: "fragment",
    text: "El segundo canto asciende del naufragio, salado y vivo. «Guardé mi nota bajo la quilla de un barco que soñaba con estrellas —dice la voz—. La que me custodiaba olvidó su propia letra: cantaba a la Niebla lo que era mío. Cántala tú, Portador: hay mareas que solo se curan devolviendo la nota.» (Eco de las Mareas recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)",
    onEnd: "eco_mareas_taken",
    options: [
      { text: "Tu nota ya no duerme bajo ninguna quilla, Eco. Ahora cántame tú.", next: "eco_mareas_emp", tone: "empatico" },
      { text: "Dos de siete. ¿Dónde suena el tercero?", next: "eco_mareas_prag", tone: "pragmatico" },
      { text: "Una sirena que cantaba lo ajeno. Ojalá la Niebla pague derechos de autor.", next: "eco_mareas_sarc", tone: "sarcastico" }
    ]
  },
  eco_mareas_emp: {
    name: "Eco de las Mareas",
    portrait: "fragment",
    text: "...la cantaba un farero con una cerilla y una promesa... ya es tuya, cuídala: el mar devuelve todo lo que se le nombra. Tarde... pero entero."
  },
  eco_mareas_prag: {
    name: "Eco de las Mareas",
    portrait: "fragment",
    text: "...escucha las cumbres, Portador: el hielo también guarda voz. Y no respondas a todo lo que cante en la bruma... hay letras que firman contratos."
  },
  eco_mareas_sarc: {
    name: "Eco de las Mareas",
    portrait: "fragment",
    text: "...cantaba lo ajeno porque ya no tenía propio. Pasa mucho por aquí: la Niebla es un aula de imitaciones... Canta tú con voz prestada y ya verás quién acude."
  },
  eco_cumbres: {
    name: "Eco de las Cumbres",
    portrait: "fragment",
    text: "El tercer canto desciende con la ventisca, limpio y paciente. «Las montañas aprendieron a guardar voces bajo el hielo —dice la voz—. La primera fue la de los pastores que cantaban por turnos para no dormirse. Toma la suya: ahora la cumbre canta contigo, y el frío ya no es silencio: es compás.» (Eco de las Cumbres recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)",
    onEnd: "eco_cumbres_taken",
    options: [
      { text: "Descansad, pastores. Vosotros cantasteis primero; ahora canto yo por todos.", next: "eco_cumbres_emp", tone: "empatico" },
      { text: "Tres de siete. Casi la mitad. ¿Qué nota sigue?", next: "eco_cumbres_prag", tone: "pragmatico" },
      { text: "Una montaña que guarda voces en el congelador. Al menos este dios era organizado.", next: "eco_cumbres_sarc", tone: "sarcastico" }
    ]
  },
  eco_cumbres_emp: {
    name: "Eco de las Cumbres",
    portrait: "fragment",
    text: "...cantaban por turnos para que nadie se durmiera solo... tú también turnas el miedo con quien camina contigo... ya somos tres: el hielo devolverá el resto cuando le toque."
  },
  eco_cumbres_prag: {
    name: "Eco de las Cumbres",
    portrait: "fragment",
    text: "...cuatro notas duermen donde los mapas se rinden... la Ciudadela oye tu melodía, Portador... no dejes que te la doble: el hielo es paciente; el poder, no."
  },
  eco_cumbres_sarc: {
    name: "Eco de las Cumbres",
    portrait: "fragment",
    text: "...organizado hasta la muerte, literalmente... bromea con respeto, Portador: las montañas no perdonan dos veces... y a nosotros solo nos asesinaron una."
  }
};
function getDialogue(nid, ctx) {
  const { questIdx: q, questStep: s } = ctx;
  const td = toneOf(ctx.flags);
  if (nid === "brisa") {
    const idle = td === "empatico" ? "brisa_idle_emp" : td === "amenazante" ? "brisa_idle_amenaz" : "brisa_idle";
    if (ctx.flags.demoEnded)
      return idle;
    if (q === 0)
      return "brisa_intro";
    if (q === 1)
      return s === 0 ? "brisa_wolves" : "brisa_reward";
    if (q === 2)
      return ctx.flags.fragmentTouched ? "brisa_fragment" : "brisa_bosque";
    if (q === 3)
      return ctx.flags.guardianDefeated ? "brisa_final" : "brisa_crypt";
    if (q === 4)
      return "brisa_final";
    if (q >= 9)
      return ctx.flags.acto2Done ? idle : "brisa_final2";
    if (q === 5 && s === 0)
      return "brisa_final";
    if (q >= 5)
      return idle;
    return "brisa_final";
  }
  if (nid === "toln")
    return td === "sarcastico" ? "toln_intro_listillo" : "toln_intro";
  if (nid === "ilwen") {
    if (ctx.companion)
      return td === "pragmatico" ? "ilwen_chat_prag" : "ilwen_chat";
    return "ilwen_intro";
  }
  if (nid === "doran")
    return "doran_intro";
  if (nid === "heraldo")
    return "heraldo_intro";
  if (nid === "teo")
    return "teo_intro";
  if (nid === "mara") {
    if (ctx.flags.sirenaDefeated)
      return ctx.flags.maraGift ? "mara_faro" : "mara_react";
    if (q === 5)
      return "mara_intro";
    return td === "empatico" ? "mara_idle_emp" : td === "sarcastico" ? "mara_idle_sarc" : "mara_idle";
  }
  if (nid === "vult") {
    return ctx.flags.metVult ? td === "pragmatico" ? "vult_idle_prag" : "vult_idle" : "vult_intro";
  }
  if (nid === "mera") {
    if (ctx.flags.ecoNombres)
      return "mera_idle";
    const lamps = ["lamp1", "lamp2", "lamp3"].filter((l) => !!ctx.flags[l]).length;
    if (lamps >= 3)
      return "mera_grateful";
    if (ctx.flags.metMera)
      return lamps === 2 ? "mera_wait2" : lamps === 1 ? "mera_wait1" : "mera_wait";
    return "mera_intro";
  }
  if (nid === "ivo") {
    if (ctx.flags.golemDefeated)
      return "ivo_after";
    if (ctx.flags.metIvo)
      return td === "empatico" ? "ivo_idle_emp" : "ivo_idle";
    return "ivo_intro";
  }
  return "brisa_idle";
}
function toneOf(flags) {
  const v = flags.tonoDominante;
  return typeof v === "string" ? v : null;
}
var DIALOGUES = D;
var ENEMY_DEFS = {
  lobo: {
    name: "Lobo de Niebla",
    hp: 30,
    dmg: 6,
    speed: 58,
    xp: 16,
    gold: [4, 8],
    sprite: "lobo",
    aggroR: 95,
    atkR: 20,
    windup: 0.45,
    atkCd: 1.5,
    element: "sombra",
    weakTo: "fuego",
    desc: "Perro guardián corrompido por la Niebla. Ataca en estampidas. Débil al fuego."
  },
  esqueleto: {
    name: "Esqueleto Cantor",
    hp: 46,
    dmg: 10,
    speed: 44,
    xp: 24,
    gold: [7, 12],
    sprite: "esqueleto",
    aggroR: 90,
    atkR: 22,
    windup: 0.6,
    atkCd: 1.8,
    element: "sombra",
    weakTo: "sagrado",
    desc: "Peregrino que cantó hasta vaciarse. Golpea con su fémula de tambor. Débil a la luz."
  },
  sombra: {
    name: "Sombra sin Rostro",
    hp: 30,
    dmg: 8,
    speed: 66,
    xp: 18,
    gold: [3, 6],
    sprite: "sombra",
    aggroR: 110,
    atkR: 20,
    windup: 0.4,
    atkCd: 1.2,
    element: "sombra",
    weakTo: "sagrado",
    desc: "Criatura de la Niebla. Devora nombres. Rápida y frágil."
  },
  guardian: {
    name: "Guardián Hueco",
    hp: 300,
    dmg: 13,
    speed: 40,
    xp: 220,
    gold: [120, 160],
    sprite: "guardian",
    aggroR: 150,
    atkR: 40,
    windup: 0.8,
    atkCd: 2.2,
    element: "sombra",
    weakTo: "ninguno",
    breakBar: 70,
    desc: "Primer coro de Aelthar, vaciado por su propio canto. Rompe su barra de quiebre con golpes continuos."
  },
  neumo: {
    name: "Neumo de Marea",
    hp: 30,
    dmg: 8,
    speed: 42,
    xp: 20,
    gold: [6, 10],
    sprite: "neumo",
    aggroR: 120,
    atkR: 135,
    windup: 0.7,
    atkCd: 2,
    element: "ninguno",
    weakTo: "rayo",
    desc: "Burbuja de espuma que la Niebla enseñó a silbar. Escupe agua a distancia y retrocede si te acercas. Débil al rayo."
  },
  espectro: {
    name: "Espectro sin Nombre",
    hp: 40,
    dmg: 10,
    speed: 52,
    xp: 26,
    gold: [7, 12],
    sprite: "espectro",
    aggroR: 130,
    atkR: 24,
    windup: 0.5,
    atkCd: 1.6,
    element: "sombra",
    weakTo: "sagrado",
    desc: "Aldeano de Merrow que olvidó hasta su hambre. Flota, se desvanece bajo los golpes y arremete desde la bruma. Débil a la luz."
  },
  arpi: {
    name: "Arpía de Cumbre",
    hp: 32,
    dmg: 9,
    speed: 76,
    xp: 22,
    gold: [6, 10],
    sprite: "arpi",
    aggroR: 125,
    atkR: 20,
    windup: 0.35,
    atkCd: 1.6,
    element: "hielo",
    weakTo: "fuego",
    desc: "Ave de ventisca que antaño guió a los pastores. Picotea en picado y se aleja volando. Débil al fuego."
  },
  sirena: {
    name: "Sirena Abisal",
    hp: 380,
    dmg: 13,
    speed: 46,
    xp: 240,
    gold: [130, 170],
    sprite: "sirena",
    aggroR: 165,
    atkR: 44,
    windup: 0.75,
    atkCd: 2,
    element: "hielo",
    weakTo: "rayo",
    breakBar: 90,
    desc: "Reina del naufragio. Cantaba a los barcos; ahora canta a la Niebla. Tres fases, salvas de marea y coro de neumos."
  },
  golem: {
    name: "Gólem de Escarcha",
    hp: 460,
    dmg: 17,
    speed: 30,
    xp: 280,
    gold: [150, 200],
    sprite: "golem",
    aggroR: 140,
    atkR: 38,
    windup: 0.9,
    atkCd: 2.4,
    element: "hielo",
    weakTo: "fuego",
    breakBar: 110,
    desc: "Memoria de montaña tallada en hielo eterno. Guarda el paso al altar de las Cumbres. Lento, aplastante, incansable."
  }
};
var SKILLS = {
  alba: [
    { id: "tajo", name: "Tajo Lunar", desc: "Embestida con el filo por delante.", cost: 25, cd: 3, icon: "◤", element: "ninguno" },
    { id: "grito", name: "Grito de Guerra", desc: "+50% de daño durante 8 s.", cost: 40, cd: 14, icon: "║", element: "ninguno" },
    { id: "muro", name: "Muro de Alba", desc: "Onda de escudo que aturde a tu alrededor.", cost: 45, cd: 9, icon: "◈", element: "sagrado" },
    { id: "filo", name: "Filo del Alba", desc: "Definitiva: tres ondas giratorias de luz.", cost: 100, cd: 18, icon: "✹", element: "sagrado" }
  ],
  tejedor: [
    { id: "ascuas", name: "Canto de Ascuas", desc: "Nota de FUEGO: proyectil que quema.", cost: 20, cd: 1.2, icon: "▲", element: "fuego" },
    { id: "escarcha", name: "Canto de Escarcha", desc: "Nota de HIELO: congela y ralentiza.", cost: 25, cd: 2.2, icon: "▼", element: "hielo" },
    { id: "chispa", name: "Canto de Chispa", desc: "Nota de RAYO: rebota entre enemigos.", cost: 30, cd: 3, icon: "≫", element: "rayo" },
    { id: "cantomayor", name: "Canto Mayor", desc: "Hechizo mayor con tu última nota usada.", cost: 100, cd: 15, icon: "✺", element: "ninguno" }
  ]
};
var KEY_ITEMS = {
  fragment: { name: "Fragmento de Eco", desc: "Despierta tu resonancia: permite alternar entre presente y pasado (Q)." },
  ecoVoz: { name: "Eco de la Voz", desc: "Primer Eco de Aelthar. La melodía principal ahora lleva tu nombre." },
  ecoMareas: { name: "Eco de las Mareas", desc: "Segundo Eco de Aelthar. El mar vuelve a tener a quién cantarle." },
  ecoCumbres: { name: "Eco de las Cumbres", desc: "Tercer Eco de Aelthar. Las montañas recuerdan el invierno sin frío." },
  ecoNombres: { name: "Eco de los Nombres", desc: "Un Eco menor nacido de los faroles de Merrow. Guarda los nombres que la Niebla se llevó." }
};
var ATTR_INFO = [
  { id: "fue", name: "Fuerza", desc: "+1,5 daño melé por punto" },
  { id: "des", name: "Destreza", desc: "+2% crítico y +2 resistencia máx." },
  { id: "int", name: "Intelecto", desc: "+1,6 daño de Cantos por punto" },
  { id: "esp", name: "Espíritu", desc: "+10% ganancia de Resonancia" },
  { id: "vig", name: "Vigor", desc: "+7 vida máx. y +1% reducción" }
];
var NEW_SKILLS = {
  alba: [
    { id: "onda", name: "Onda Sísmica", desc: "Onda de choque que empuja y daña a tu alrededor.", cost: 30, cd: 8, icon: "◤", element: "sagrado" },
    { id: "lanza", name: "Lanza del Alba", desc: "Lanza de luz que atraviesa hasta 4 enemigos.", cost: 35, cd: 6, icon: "▲", element: "sagrado" },
    { id: "bendi", name: "Bendición del Camino", desc: "Escudo que absorbe daño (25% de tu vida, 10 s).", cost: 40, cd: 16, icon: "✚", element: "sagrado" }
  ],
  tejedor: [
    { id: "nova", name: "Nova de Escarcha", desc: "Explosión de hielo: congela y ralentiza en área.", cost: 35, cd: 9, icon: "▼", element: "hielo" },
    { id: "rayos", name: "Tormenta Encadenada", desc: "Cinco rayos saltan entre tus enemigos.", cost: 45, cd: 12, icon: "✦", element: "rayo" },
    { id: "aurea", name: "Aureola de Ceniza", desc: "Anillo de ascuas que quema durante 6 s.", cost: 35, cd: 14, icon: "✺", element: "fuego" }
  ]
};
var SKILL_TREE = [
  { id: "c_fuerte", branch: "filo", name: "Filo Templado", desc: "Tus golpes melé hacen +10% de daño.", cost: 1, kind: "pasiva", icon: "║" },
  { id: "c_vida", branch: "filo", name: "Corazón de Roble", desc: "+20 de vida máxima.", cost: 1, kind: "pasiva", icon: "✚" },
  { id: "c_eco", branch: "filo", name: "Eco del Filo", desc: "Cada golpe melé libera un eco retardado: 35% de tu daño en un área pequeña.", cost: 1, parent: "c_fuerte", kind: "pasiva", icon: "◈" },
  { id: "c_cd", branch: "filo", name: "Refrán Veloz", desc: "−20% de enfriamiento en todas tus habilidades.", cost: 2, parent: "c_fuerte", kind: "pasiva", icon: "≫" },
  { id: "c_onda", branch: "filo", name: "Onda Sísmica", desc: "Desbloquea ONDA SÍSMICA: empuja y daña en área (tecla del hueco donde la equipes).", cost: 2, parent: "c_eco", kind: "activa", grants: "onda", disc: "alba", icon: "◤" },
  { id: "c_lanza", branch: "filo", name: "Lanza del Alba", desc: "Desbloquea LANZA DEL ALBA: proyectil de luz que perfora a los enemigos.", cost: 2, parent: "c_onda", kind: "activa", grants: "lanza", disc: "alba", icon: "▲" },
  { id: "c_colera", branch: "filo", name: "Cólera del Alba", desc: "Tus golpes melé hacen +15% de daño adicional.", cost: 3, parent: "c_lanza", kind: "pasiva", icon: "✹" },
  { id: "a_res", branch: "eco", name: "Afinación", desc: "Recuperas +1,5 de Resonancia por segundo.", cost: 1, kind: "pasiva", icon: "●" },
  { id: "a_sta", branch: "eco", name: "Aliento Cálido", desc: "+40% de regeneración de Aguante.", cost: 1, kind: "pasiva", icon: "◆" },
  { id: "a_cd", branch: "eco", name: "Cadencia Arcana", desc: "−20% de enfriamiento en todas tus habilidades.", cost: 2, parent: "a_res", kind: "pasiva", icon: "≫" },
  { id: "a_nova", branch: "eco", name: "Nova de Escarcha", desc: "Desbloquea NOVA DE ESCARCHA: congelación y daño en área a tu alrededor.", cost: 2, parent: "a_res", kind: "activa", grants: "nova", disc: "tejedor", icon: "▼" },
  { id: "a_rayos", branch: "eco", name: "Tormenta Encadenada", desc: "Desbloquea TORMENTA ENCADENADA: 5 rayos saltan entre enemigos.", cost: 2, parent: "a_nova", kind: "activa", grants: "rayos", disc: "tejedor", icon: "✦" },
  { id: "a_aura", branch: "eco", name: "Aureola de Ceniza", desc: "Desbloquea AUREOLA DE CENIZA: anillo de ascuas que quema 6 s.", cost: 2, parent: "a_nova", kind: "activa", grants: "aurea", disc: "tejedor", icon: "✺" },
  { id: "a_mente", branch: "eco", name: "Mente de Cristal", desc: "Tus hechizos hacen +20% de daño.", cost: 3, parent: "a_rayos", kind: "pasiva", icon: "✹" },
  { id: "t_speed", branch: "camino", name: "Paso de Brisa", desc: "+12% de velocidad de movimiento.", cost: 1, kind: "pasiva", icon: "☾" },
  { id: "t_gold", branch: "camino", name: "Ojo del Mercader", desc: "+20% de coronas al conseguir oro.", cost: 1, kind: "pasiva", icon: "★" },
  { id: "t_bendi", branch: "camino", name: "Bendición del Camino", desc: "Desbloquea BENDICIÓN: escudo que absorbe daño (25% de tu vida, 10 s).", cost: 2, parent: "t_speed", kind: "activa", grants: "bendi", icon: "✚" },
  { id: "t_campana", branch: "camino", name: "Campana del Retorno", desc: "Herramienta (tecla 5): resuena y te devuelve al Santuario del mapa (120 s de recarga).", cost: 1, parent: "t_gold", kind: "herramienta", grants: "campana", icon: "◉" },
  { id: "t_brujula", branch: "camino", name: "Brújula de Ecos", desc: "Herramienta (tecla 6): un rastro de ecos señala tu misión durante 20 s (45 s de recarga).", cost: 1, parent: "t_campana", kind: "herramienta", grants: "brujula", icon: "◈" },
  { id: "t_amuleto", branch: "camino", name: "Amuleto de Aelthar", desc: "Herramienta (tecla 7): absorbe 1 golpe no letal. Recarga al empezar cada combate.", cost: 2, parent: "t_bendi", kind: "herramienta", grants: "amuleto", icon: "☾" }
];
var TREE_BRANCHES = {
  filo: { name: "VÍA DEL FILO", sub: "cuerpo y acero", color: "#f0a050" },
  eco: { name: "VÍA DEL ECO", sub: "arcano elemental", color: "#5ad0e8" },
  camino: { name: "VÍA DEL CAMINO", sub: "travesía y astucia", color: "#8ef0b0" }
};
var TOOL_INFO = {
  campana: { name: "Campana del Retorno", desc: "Te devuelve al Santuario del mapa actual.", key: "5", cd: 120 },
  brujula: { name: "Brújula de Ecos", desc: "Señala el objetivo de tu misión (20 s).", key: "6", cd: 45 },
  amuleto: { name: "Amuleto de Aelthar", desc: "Absorbe 1 golpe no letal; recarga al iniciar un combate.", key: "7", cd: 0 }
};
var QUEST_COMPASS = {
  0: [{ npc: "brisa" }],
  1: [{ etype: "lobo", map: "lunaris" }, { npc: "brisa" }],
  2: [{ map: "bosque" }, { prop: "fragment" }],
  3: [{ map: "cripta" }, { etype: "guardian", map: "cripta" }, { prop: "altar_c" }],
  4: [{ npc: "brisa" }],
  5: [{ map: "costa" }, { npc: "mara" }],
  6: [{ prop: "wreck_co" }, { etype: "sirena", map: "costa" }, { prop: "altar_mareas" }],
  7: [{ map: "aldea" }, { lamp: true }, { npc: "mera" }],
  8: [{ map: "cumbres" }, { etype: "golem", map: "cumbres" }, { prop: "altar_cumbres" }],
  9: [{ npc: "brisa" }]
};
QUESTS.push({
  id: "q11",
  name: "El Canto al Revés",
  steps: [
    "Habla con Toln en su forja de Lunaris: el metal cantó al revés",
    "Endereza los 3 Ecos Invertidos: el pozo de Teo en Lunaris, la Ruina Antigua de Doran en el Bosque y la orilla de Mara en la Costa (0/3)",
    "Vuelve con la Anciana Brisa a Lunaris"
  ]
}, {
  id: "q12",
  name: "La Aldea sin Ayer",
  steps: [
    "Viaja a la Aldea de Merrow: amaneció sin recuerdos",
    "Devuélvele el ayer a los que conociste: 3 recuerdos perdidos (0/3)",
    "Vuelve con la Anciana Brisa"
  ]
}, {
  id: "q13",
  name: "La Primera Portadora",
  steps: [
    "Escucha a Velmora: la presencia quiere hablarte por boca de Brisa",
    "Derrota al Guardián recordado en la Cripta, fuera del tiempo",
    "Vuelve con la Anciana Brisa"
  ]
});
QUEST_COMPASS[10] = [{ npc: "toln" }, { npc: "teo" }, { npc: "brisa" }];
QUEST_COMPASS[11] = [{ npc: "mera" }, { npc: "mara" }, { npc: "brisa" }];
QUEST_COMPASS[12] = [{ npc: "brisa" }, { prop: "altar_c" }, { npc: "brisa" }];
Object.assign(MEMORIES, {
  mem_cantoalreves: {
    id: "mem_cantoalreves",
    title: "Memoria VI · El Canto al Revés",
    text: "Una mujer sin rostro te tiende su ayer como quien tiende una taza: «Yo canté la primera nota, y el mundo pagó el día. Guarda esta memoria AL REVÉS, Portador: cuando la Niebla te cante con mi voz, dila derecha y devuélvela a su dueña.» Por un latido el Canto suena entero —siete notas, un mundo, un dios con hambre— y luego vuelve el silencio... un poco más cerca de lo que estaba."
  }
});
var D_ACTO3 = {
  acto3_brisa_alba: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "¿Lo oíste anoche, Portador? El Canto sonó AL REVÉS: las notas de Aelthar bajaron cuando debían subir. Toln jura que su forja cantó su nana del final al principio... y lo que se canta al revés no tarda en abrirse paso. Ve a la forja y escúchalo tú: esta noche se han torcido tres ecos, y los ecos torcidos llaman a la Niebla.",
    onEnd: "accept_q11",
    options: [
      { text: "Descansa, Brisa. Yo puse el Eco en marcha: yo enderezaré la melodía.", tone: "empatico" },
      { text: "Tres ecos torcidos. Nombres y lugares, anciana.", tone: "pragmatico" },
      { text: "Un dios que canta al revés. Esta demo se está volviendo experimental.", tone: "sarcastico" }
    ]
  },
  acto3_toln_intro: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "Escucha, Portador: anoche el metal cantó solo. Mi nana —la de mi abuela—, del final al principio. Y el yunque templó al revés: el filo salió ROMO. Tres veces sonó torcido esta noche: en el pozo donde el niño Teo tararea, en la Ruina Antigua donde el druida escucha raíces, y en la orilla de la farera, donde el mar devuelve los barcos por donde los llevó. Un canto al revés no es una canción, Portador: es una puerta abierta del otro lado. Enderézalos antes de que aprendan la letra.",
    onEnd: "acto3_toln",
    options: [
      { text: "Tu abuelo forjó la Lanza, Toln. Esta vez tu forja me guía a mí.", tone: "empatico" },
      { text: "Pozo, ruina, orilla. Enderezaré los tres.", tone: "pragmatico" },
      { text: "Un yunque romo y un dios desafinado. Esta forja necesita vacaciones.", tone: "sarcastico" },
      { text: "Necesito acero y pociones, no poesía.", next: "toln_intro" }
    ]
  },
  acto3_toln_intro_sarc: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "Vuelves con orejas nuevas, Listillo. Pues escucha esto: anoche el metal cantó mi nana del final al principio y el yunque templó ROMO. El pozo del niño, la ruina del druida, la orilla de la farera: tres veces sonó torcido. Ríete tú de eso. Un canto al revés no es broma: es una puerta abierta del otro lado, y las puertas no eligen a quien cruzan.",
    onEnd: "acto3_toln",
    options: [
      { text: "Tu abuelo forjó la Lanza, Toln. Esta vez tu forja me guía a mí.", tone: "empatico" },
      { text: "Pozo, ruina, orilla. Enderezaré los tres.", tone: "pragmatico" },
      { text: "Necesito acero y pociones, no poesía.", next: "toln_intro" }
    ]
  },
  acto3_eco_teo: {
    name: "Eco Invertido · La nana",
    portrait: "fragment",
    text: "Teo tararea junto al pozo, pero la canción sube AL REVÉS del fondo: «...aaaah, mm-mm...» — «¿La oyes? —dice el niño—. Anoche me la cantó la Niebla, del final al principio. Yo solo la repito para que no se pierda. Cuando la canto derecha, nadie responde. Cuando la canto al revés, responde alguien. Antes no había nadie debajo, ¿verdad?»",
    onEnd: "acto3_eco1",
    options: [
      { text: "Cántala derecha, Teo. Yo canto contigo hasta que abajo se canse de imitar.", tone: "empatico" },
      { text: "Deja de repetirla, Teo. La imitación se alimenta de quien la escucha.", tone: "pragmatico" },
      { text: "Un coro bajo el pozo. Qué vecindario tan encantador.", tone: "sarcastico" },
      { text: "Sea lo que sea lo que canta abajo: si sube, lo espero con acero.", tone: "amenazante" }
    ]
  },
  acto3_eco_doran: {
    name: "Eco Invertido · La raíz",
    portrait: "fragment",
    text: "Las raíces respiran al revés, Portador: exhalan donde debían inhalar. La Madre Espina sangra savia que vuelve al brote, y los pájaros aprenden las notas de sus propios cantos fúnebres. El Círculo dice que no es maldad: es DUELO aprendido de memoria... pero el duelo no aprende solo, Portador. Alguien le enseñó al bosque a llorar hacia atrás.",
    onEnd: "acto3_eco2",
    options: [
      { text: "Entonces le enseñaré otra cosa: a descansar. Lo siento por las raíces.", tone: "empatico" },
      { text: "Dueño de ese pesar: quien enseñó la lección pagará la clase.", tone: "pragmatico" },
      { text: "Árboles llorando hacia atrás. El bosque también puede exagerar.", tone: "sarcastico" }
    ]
  },
  acto3_eco_mara: {
    name: "Eco Invertido · La marea",
    portrait: "fragment",
    text: "Anoche la marea devolvió dos barcos que se hundieron hace treinta años. Enteros, Portador. Con sus nombres pintados por DENTRO. El mar lee los nombres del final al principio y mi faro los ilumina... pero la luz se dobla al cruzarlos, como si el ayer no supiera ya por dónde entra. Yo apagué la lámpara por primera vez en mi vida. Y la bruma, agradecida, cantó.",
    onEnd: "acto3_eco3",
    options: [
      { text: "Tú encendiste un faro tras 300 años, Mara. Volverás a enderezar esta luz.", tone: "empatico" },
      { text: "Barcos enteros, nombres por dentro. Eso no es marea: es archivo. Y alguien lo lee.", tone: "pragmatico" },
      { text: "El mar haciendo playback de sus peores éxitos. Encantador.", tone: "sarcastico" },
      { text: "Que devuelva los barcos andando si tanto le gustan.", tone: "amenazante" }
    ]
  },
  acto3_brisa_cierre1: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Tres notas enderezadas... y las tres decían lo mismo, Portador: la Niebla no está robando el Canto. Lo está APRENDIÉNDOLO. Nota a nota, al revés, como quien deshace un punto de labor para copiar el dibujo. Alguien le enseña. O algo lo recuerda. Y en Merrow, esta mañana, la aldea entera ha amanecido sin su ayer... Ve. Los recuerdos que se comen dejan hambre.",
    onEnd: "acto3_report",
    options: [
      { text: "Que nadie en Merrow olvide que lo olvidado se puede volver. Voy.", next: "acto3_brisa_q12", tone: "empatico" },
      { text: "La Niebla aprende; yo enseño. Merrow, y rápido.", next: "acto3_brisa_q12", tone: "pragmatico" },
      { text: "La apocalíptica Niebla sacando clase particular. Ojalá pague por hora.", next: "acto3_brisa_q12", tone: "sarcastico" },
      { text: "Necesito prepararme antes de volver a bajar hacia el mar.", tone: "pragmatico" }
    ]
  },
  acto3_brisa_q12: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Merrow amaneció sin recuerdos, Portador. No muerta: VACÍA. Los que caminan ahí siguen viviendo, pero el día de antes se lo comió la Niebla con la boca pequeña, y sin ayer no hay mañana que esperar. Habla con los que conociste —la farera, la Espectro, el cazador, el cartógrafo—: lo que cada uno vivió ayer no está en su cabeza. Si lo devuelves, quizá la Niebla se quede sin costumbre.",
    onEnd: "accept_q12",
    options: [
      { text: "Volveré con tres ayeres en las manos, Brisa.", tone: "empatico" },
      { text: "Cuatro bocas, tres recuerdos. Cuento hecho.", tone: "pragmatico" }
    ]
  },
  acto3_mera_alba: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "...Portador. La plaza amaneció sin su ayer: los faroles arden y NADIE recuerda encenderlos. Yo misma... anoche tenía un nombre prestado que los vecinos me iban devolviendo, y esta mañana la boca me lo devuelve vacío. La Niebla ha aprendido a comerse el día de antes, y en Merrow ya probó gusto. Pregunta a los que caminan fuera: lo que vivieron ayer no está en su cabeza. Lo que se come una boca... otra boca lo puede devolver.",
    onEnd: "acto3_mera_ayer",
    options: [
      { text: "Tu nombre volverá, Nera. Lo diré en voz alta hasta que lo oigas.", tone: "empatico" },
      { text: "Farera, espectro, cazador, cartógrafo. Empiezo hoy mismo.", tone: "pragmatico" },
      { text: "Una aldea que pierde el ayer y yo perdiendo las llaves. Empatía plena.", tone: "sarcastico" }
    ]
  },
  acto3_mara_ayer: {
    name: "Mara, la farera",
    portrait: "maelis",
    text: "Ayer encendí el faro. ¿Verdad que lo encendí? Sé que lo hago cada noche... pero la noche del faro encendido no está en mi cabeza: hay un hueco con forma de luz y no queda ni el olor a cerilla. (mira el faro, apagado) Si la Niebla se comió mi ayer, que al menos devuelva las calorías: enciéndelo tú esta noche, Portador, y piensa en mí mientras arde.",
    onEnd: "acto3_rec_mara",
    options: [
      { text: "Arderá, Mara. Y tu ayer volverá con él: las luces no saben mentir.", tone: "empatico" },
      { text: "Un hueco con forma de luz. Apúntalo: es la pista más limpia que tenemos.", tone: "pragmatico" },
      { text: "Perder la memoria y quedarte el faro. Qué repartija tan injusta.", tone: "sarcastico" }
    ]
  },
  acto3_ivo_ayer: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "La montaña cantó de vuelta. Te lo juro por mi ballesta: fue ayer... ¿o fue un sueño? Y ahora no sé decir cuál, y eso, Portador, es peor que la ventisca. Un cazador que duda de su memoria pierde el norte, y la montaña pierde al último que la escuchaba. La Niebla no mató el día: lo DESHIZO. Como desafinar deshace una nota.",
    onEnd: "acto3_rec_ivo",
    options: [
      { text: "Cantó de vuelta, Ivo. Y cuando vuelva a cantar, lo recordarás por los dos.", tone: "empatico" },
      { text: "Fue ayer. Confía en el que lo escuchó: eres el único que estaba allí.", tone: "pragmatico" },
      { text: "Un sueño, un canto, una ventisca... la montaña no te va a aclarar cuál.", tone: "sarcastico" }
    ]
  },
  acto3_vult_ayer: {
    name: "Vult, cartógrafo de la Liga",
    portrait: "corvin",
    text: "Ayer dibujé la costa. Hoy el pergamino está en blanco. Y no es tinta que se borra, Portador: es un día que NO PASÓ. La Liga me paga por certezas y acabo de perder la única que tenía: mi ayer. (cierra la libreta) Anota esto en tu odre de profecías: quien coma días ajenos... acabará comiendo los tuyos. Yo facturo la advertencia.",
    onEnd: "acto3_rec_vult",
    options: [
      { text: "Te devolveré el día, Vult. Y la Liga te devolverá la certeza.", tone: "empatico" },
      { text: "Días que no pasaron, mapas en blanco. Busquemos la boca que come.", tone: "pragmatico" },
      { text: "Facturas hasta el apocalipsis. Con ese talante llegarás viejo.", tone: "sarcastico" },
      { text: "La Liga puede facturar mi paciencia. Que la Niebla no pruebe suerte.", tone: "amenazante" }
    ]
  },
  acto3_brisa_cierre2: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Tres ayeres comidos... y una aldea entera. La Niebla ya no avanza borrando, Portador: avanza DIGIRIENDO. Y eso que aprende, alguien se lo enseña... o alguien lo recuerda desde el otro lado. (te mira un largo rato) Velmora te observa. Lleva tres noches de pie detrás de tus ojos, esperando que supieras escuchar. Habla. Yo haré de puerta.",
    onEnd: "acto3_report",
    options: [
      { text: "Velmora... hablemos.", next: "acto3_velmora_revela" },
      { text: "Necesito respirar antes de hablar con presencias.", tone: "pragmatico" }
    ]
  },
  acto3_velmora_revela: {
    name: "Velmora",
    portrait: "wisp",
    text: "...Al fin. Trescientos años esperando un oído que no temblara. Escucha, Portador, porque la letra que te contaron es verdad a medias: Aelthar no murió por su PODER. Murió por su HAMBRE. Cada nota del Canto le costaba un ayer del mundo —un día entero de vidas ajenas, comido y digerido en melodía—. El mundo se quedaba sin ayeres para que un dios tuviera canción. ¿Sigues ahí? Los oídos que no temblan suelen ser los primeros en huir.",
    onEnd: "accept_q13",
    options: [
      { text: "Sigo aquí. Si tu verdad pesa, la sostengo contigo.", next: "acto3_velmora_escucha", tone: "empatico" },
      { text: "Sigo aquí. Los datos primero; el miedo después.", next: "acto3_velmora_escucha", tone: "pragmatico" },
      { text: "Un dios con hambre y un mundo a la carta. Qué menú.", next: "acto3_velmora_hierro", tone: "sarcastico" },
      { text: "A los oídos no se les echa. Habla, presencia.", next: "acto3_velmora_hierro", tone: "amenazante" }
    ]
  },
  acto3_velmora_escucha: {
    name: "Velmora",
    portrait: "wisp",
    text: "...Cálido. Tardaron trescientos años en dejarme hablar sin lanzas en la sala. Entonces toma mi voz, Portador: la tengo guardada desde la primera nota.",
    next: "acto3_velmora_secreto"
  },
  acto3_velmora_hierro: {
    name: "Velmora",
    portrait: "wisp",
    text: "Je. Fiero. Bien: los mansos cantaron lo que la Niebla quería oír; los fieros cambiaron la letra. Entonces toma mi voz, Portador: la tengo guardada desde la primera nota.",
    next: "acto3_velmora_secreto"
  },
  acto3_velmora_secreto: {
    name: "Velmora",
    portrait: "wisp",
    text: "Yo fui la PRIMERA Portadora. Antes que tu nana, antes que tu faro: la primera nota del Canto se pagó con MI ayer. La Orden no asesinó a tu dios por poder — mató por MISERICORDIA: mientras cantara, el mundo entero era su despensa. Dos verdades caben en una noche, Portador: fue un asesinato... y fue un regalo. Lo que ahora canta al revés con voz de mujer es mi nota, devuelta del otro lado: la Niebla aprendió lo que yo supe... y busca el día que di.",
    next: "acto3_decision"
  },
  acto3_decision: {
    name: "Velmora",
    portrait: "wisp",
    text: "Esta verdad pesa más que tu acero, Portador, y las verdades pesadas hay que darlas a quien pueda sostenerlas. Elige quién: los Guardianes, que llevan trescientos años cantando venganza... o el silencio, que también es una misericordia.",
    options: [
      { text: "La verdad es de los Guardianes: la Orden mató por misericordia, y Brisa debe saberlo.", action: "acto3_verdad", next: "acto3_velmora_puerta", tone: "pragmatico" },
      { text: "La Orden guardó su secreto trescientos años. Que lo siga guardando.", action: "acto3_silencio", next: "acto3_velmora_puerta", tone: "empatico" }
    ]
  },
  acto3_velmora_puerta: {
    name: "Velmora",
    portrait: "wisp",
    text: "Escuchado sea, Portador, como se escucha una puerta: de una vez. Mi cripta no guarda mi cuerpo; guarda la puerta del tiempo, fuera del ayer y del mañana. Sube. Lo que aprendió mi voz te espera con mi cara puesta, cantando mi nota al revés. Devuélvele la nota a su dueña... y toma la mía, que ya no la necesito entera.",
    onEnd: "acto3_velmora_fn",
    options: [
      { text: "(Subir a la Cripta: fuera del tiempo)", action: "acto3_subir" },
      { text: "Prepararme antes. Nadie entra a una puerta sin filo.", tone: "pragmatico" }
    ]
  },
  acto3_brisa_cierre3: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "...Así que era eso. Trescientos años cantándole a un dios hambriento y a una Orden misericordiosa, y nosotros en medio, con el canto partido. (seca los ojos sin disimular) El Guardián recordado ya no canta: descansan sus notas. Toma lo prometido, Portador, y guarda esa memoria que te ha quedado: también es mía, de alguna manera. La primera Portadora y esta vieja: a todas nos canta la misma Niebla.",
    onEnd: "acto3_report",
    options: [
      { text: "(Dejar que el Canto descanse: terminar la demo)", action: "end_demo" },
      { text: "Aún hay ecos que enderezar.", tone: "empatico" }
    ]
  }
};
Object.assign(DIALOGUES, D_ACTO3);
var ACTO3_ELITE = { ref: null };
var GET_DIALOGUE_ACTO1_2 = getDialogue;
function getDialogueActo3(nid, ctx) {
  const { questIdx: q, questStep: s, flags: f } = ctx;
  if (nid === "brisa" && q === 9 && f.acto2Done && !f.q11)
    return "acto3_brisa_alba";
  if (q < 10 || q > 12)
    return GET_DIALOGUE_ACTO1_2(nid, ctx);
  switch (nid) {
    case "brisa": {
      if (q === 10)
        return s === 2 ? "acto3_brisa_cierre1" : GET_DIALOGUE_ACTO1_2(nid, ctx);
      if (q === 11) {
        if (s === 2)
          return "acto3_brisa_cierre2";
        return f.q12 ? GET_DIALOGUE_ACTO1_2(nid, ctx) : "acto3_brisa_q12";
      }
      if (!f.q13 || s === 0)
        return "acto3_velmora_revela";
      const eliteDead = !!f.guardianRecordadoDerrotado || ACTO3_ELITE.ref?.dead === true;
      if (!eliteDead)
        return "acto3_velmora_puerta";
      if (!f.acto3Done)
        return "acto3_brisa_cierre3";
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    }
    case "toln":
      if (q === 10 && s === 0)
        return toneOf(ctx.flags) === "sarcastico" ? "acto3_toln_intro_sarc" : "acto3_toln_intro";
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case "teo":
      if (q === 10 && s === 1 && !f.ecoInvTeo)
        return "acto3_eco_teo";
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case "doran":
      if (q === 10 && s === 1 && !f.ecoInvDoran)
        return "acto3_eco_doran";
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case "mara":
      if (q === 10 && s === 1 && !f.ecoInvMara)
        return "acto3_eco_mara";
      if (q === 11 && !f.recMara)
        return "acto3_mara_ayer";
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case "mera":
      if (q === 11 && !f.recMera)
        return "acto3_mera_alba";
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case "ivo":
      if (q === 11 && !f.recIvo)
        return "acto3_ivo_ayer";
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    case "vult":
      if (q === 11 && !f.recVult)
        return "acto3_vult_ayer";
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
    default:
      return GET_DIALOGUE_ACTO1_2(nid, ctx);
  }
}
getDialogue = getDialogueActo3;
var ENEMY_DEFS_14A = {
  vult: {
    name: "Vult, el Cazador de Ecos",
    hp: 420,
    dmg: 14,
    speed: 88,
    xp: 260,
    gold: [140, 180],
    sprite: "vult",
    aggroR: 150,
    atkR: 46,
    windup: 0.5,
    atkCd: 1.7,
    element: "sombra",
    weakTo: "sagrado",
    breakBar: 95,
    desc: "El cartógrafo que la Niebla contrató con el mapa de tus pasos. Ráfagas de dagas, embestidas con estela y, al filo de la muerte, el modo acecho: se desvanece y reaparece a tu espalda. Débil a la luz."
  },
  coro: {
    name: "El Coro Roto",
    hp: 520,
    dmg: 13,
    speed: 34,
    xp: 320,
    gold: [160, 220],
    sprite: "coro1",
    aggroR: 140,
    atkR: 150,
    windup: 0.6,
    atkCd: 2.1,
    element: "sombra",
    weakTo: "sagrado",
    breakBar: 110,
    desc: "Tres máscaras que la Niebla unió con la nota del revés de Velmora. Quebrar la barra hace caer la máscara actual: el Pulso y sus orbes, el Vera y sus rayos en cruz, el Silencio y su lluvia de notas caídas. Débil a la luz."
  },
  ecodesg: {
    name: "Eco Desgarrado",
    hp: 55,
    dmg: 11,
    speed: 84,
    xp: 30,
    gold: [8, 14],
    sprite: "ecodesg",
    aggroR: 130,
    atkR: 26,
    windup: 0.45,
    atkCd: 1.5,
    element: "sombra",
    weakTo: "sagrado",
    desc: "Un eco partido en dos que aún intenta cantarse a sí mismo. Rápido: parpadea distancias cortas hasta tu flanco y arremete. Vigila el destello de su bruma. Débil a la luz."
  },
  satiro: {
    name: "Sátiro de la Niebla",
    hp: 44,
    dmg: 9,
    speed: 62,
    xp: 26,
    gold: [8, 14],
    sprite: "satiro",
    aggroR: 150,
    atkR: 160,
    windup: 0.8,
    atkCd: 2.2,
    element: "ninguno",
    weakTo: "fuego",
    desc: "Músico cabrío que silba baladas curvas: su proyectil describe una parábola que cae sobre quien se esconde. Si te acercas, huye silbando mientras dispara. La quema disipa su niebla."
  }
};
Object.assign(ENEMY_DEFS, ENEMY_DEFS_14A);
var BUFF_JEFES_14A = {
  guardian: { hp: 345, dmg: 14, breakBar: 80 },
  sirena: { hp: 440, dmg: 15, breakBar: 105 },
  golem: { hp: 535, dmg: 19, breakBar: 126 }
};
for (const k of Object.keys(BUFF_JEFES_14A)) {
  const b = BUFF_JEFES_14A[k];
  ENEMY_DEFS[k].hp = b.hp;
  ENEMY_DEFS[k].dmg = b.dmg;
  ENEMY_DEFS[k].breakBar = b.breakBar;
}
QUESTS.push({
  id: "q14",
  name: "Las Campanas de Antes",
  steps: [
    "Escucha a Toln en la forja de Lunaris: el metal que recuerda quiere ser campana",
    "Reúne el coro de antes: la voz robada que guarda la Espectro de Merrow y la resonancia de los pastores con Ivo en las Cumbres (0/2)",
    "Vuelve con la Anciana Brisa: la Campana del Ayer puede sonar"
  ]
}, {
  id: "q15",
  name: "La Sala del Primer Canto",
  steps: [
    "Desciende a la Cripta: la Guarda del Primer Canto custodia la puerta de la Sala",
    "Abre la Sala del Primer Canto y derrota a El Heraldo — Vesh, la Última Nota",
    "Vuelve con la Anciana Brisa"
  ]
}, {
  id: "q16",
  name: "El Eco que Elegiste",
  steps: [
    "Vuelve con la Anciana Brisa: el coro de antes te espera para el Último Canto",
    "Canta el Último Canto: quédate a escuchar... o deja que el mundo descanse"
  ]
});
QUEST_COMPASS[13] = [{ npc: "toln" }, { npc: "mera" }, { npc: "brisa" }];
QUEST_COMPASS[14] = [{ npc: "guarda" }, { etype: "heraldo", map: "cripta" }, { npc: "brisa" }];
QUEST_COMPASS[15] = [{ npc: "brisa" }];
Object.assign(KEY_ITEMS, {
  campanaAyer: {
    name: "La Campana del Ayer",
    desc: "La campana que Toln crió con el metal que recuerda. Reparte las horas, llama al coro de antes y da nombre al valle."
  }
});
Object.assign(MEMORIES, {
  mem_ultimacanto: {
    id: "mem_ultimacanto",
    title: "Memoria VII · El Último Canto",
    text: "La mujer sin rostro por fin tiene cara: es la tuya, la que cierra los ojos y no busca a nadie detrás. «El Canto nunca fue mío —dices, y el valle entero te escucha nombrarte—: fue de todos los que lo cantaron. Yo solo devolví lo que me tocó devolver.» Por una noche entera el mundo no necesita ayeres prestados: la Campana del Ayer reparte horas, el mar lee nombres sin borrarlos, y la Niebla —que tanto aprendió— aprende por fin a descansar. Silencio, sí. Pero de los buenos: el que queda cuando la canción ya está dentro."
  }
});
var D_ACTO4 = {
  acto4_brisa_alba: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "¿Lo oyes, Portador? Desde que enderezaste los tres ecos, el silencio tiene miedo de nosotros: no sabe qué hacemos con las manos mientras no canta. Pero la Niebla aprende rápido, y su maestro tiene cara de hombre... (seca una taza en el umbral) Anoche Toln vino con una idea imposible: el metal de su forja —el que recuerda el ritmo del martillo de su bisabuela— quiere ser CAMPANA. Las campanas de antes no se fundían solas, Portador: se criaban con el coro alrededor. Dale a Toln su campana, trae de vuelta a Merrow la voz que la Sirena cantaba robada y despierta la resonancia de los pastores en las Cumbres. Cuando el coro de antes vuelva a sonar, hasta la Niebla tendrá que aprender una canción nueva. La tuya.",
    onEnd: "accept_q14",
    options: [
      { text: "El coro de antes volverá, Brisa. Te lo devuelvo nota por nota.", tone: "empatico" },
      { text: "Forja, voz, resonancia. Tres campanas para un coro. Voy.", tone: "pragmatico" },
      { text: "Una campana que recuerda y una Niebla que estudia. El barrio va mejorando.", tone: "sarcastico" }
    ]
  },
  acto4_brisa_ruta: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Las campanas no se funden solas, Portador: Toln espera en la forja con el metal que recuerda, y el coro se reúne donde dejaste voces —Merrow, al este de la costa; las Cumbres, al este del bosque—. La Brújula de Ecos (tecla 6) sabe el camino si el valle se hace largo."
  },
  acto4_toln_cam: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "Ah, viniste. Bien: quería que lo tocases tú. (pone tu mano sobre el yunque) ¿Sientes? Lleva trescientos años esperando. Mi bisabuelo fundió las campanas de Lunaris con este metal —los niños lo llaman el eco del pozo— y dicen que guarda el ritmo del martillo de su abuela. Anoche, cuando el coro del valle cantó tus tres notas, el metal LLORÓ en la fragua. Una campana no se hace, Portador: se cría. Yo le doy el cuerpo; a ti te toca traerle lo que la Niebla le robó: la voz que la llame —la que la Sirena cantaba robada, en Merrow— y la resonancia que la sostenga —donde los pastores cantaban por turnos, en las Cumbres—. Tráeme ambas, y esta campana recordará al mundo entero cómo se llama.",
    onEnd: "acto4_toln",
    options: [
      { text: "Tu bisabuelo fundió las campanas, Toln. Tu forja las va a devolver.", tone: "empatico" },
      { text: "Merrow y Cumbres. Dos viajes y una campana criada. Voy.", tone: "pragmatico" },
      { text: "Un yunque que llora y una Niebla que estudia. Necesito vacaciones.", tone: "sarcastico" },
      { text: "Necesito acero y pociones, no canciones.", next: "toln_intro" }
    ]
  },
  acto4_toln_cam_sarc: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "Vuelves con orejas nuevas, Listillo. Pues toca el yunque y deja de reírte: ese metal lleva trescientos años esperando y anoche LLORÓ en la fragua cuando el valle cantó tus notas. Los niños lo llaman el eco del pozo: guarda el ritmo del martillo de mi bisabuela. Voy a criar con él la campana que Lunaris merece... pero las campanas no se funden solas: necesito la voz que la Sirena cantó robada —Merrow— y la resonancia de los pastores —las Cumbres—. Anda, ve a hacer el coro y deja las gracias para el estreno.",
    onEnd: "acto4_toln",
    options: [
      { text: "Merrow y Cumbres. Dos viajes y una campana criada. Voy.", tone: "pragmatico" },
      { text: "Necesito acero y pociones, no canciones.", next: "toln_intro" }
    ]
  },
  acto4_mera_cam: {
    name: "Espectro de Merrow",
    portrait: "nimue",
    text: "...Portador. Esta mañana el mar dijo un nombre y no era el mío. La que cantaba bajo la quilla ya no canta para la Niebla: su voz quedó suelta, como un farol sin gancho... y una voz suelta siempre busca dueño. Merrow fue su primer dueño, ¿sabes? La Sirena aprendió a cantar escuchando a mis vecinas nombrar a sus hijos al alba. Devuélvela: di TÚ en voz alta que la voz del mar vuelve a casa. (junta las manos, como quien espera una cerilla) Dímelo ahora, si te atreves... y la aldea vuelve a nombrar.",
    onEnd: "acto4_cam_mera",
    options: [
      { text: "La voz del mar vuelve a casa, Merrow. Cantad con ella.", tone: "empatico" },
      { text: "Una voz suelta, un dueño, una aldea que nombra. Hecho.", tone: "pragmatico" },
      { text: "La ex ladrona de voces devolviendo el botín. La Niebla debe estar encantada.", tone: "sarcastico" }
    ]
  },
  acto4_ivo_cam: {
    name: "Ivo, cazador de cumbres",
    portrait: "brokk",
    text: "¡Ahí, Portador, ahí! ¡Escucha la hoguera! Anoche ardieron las piedras sin leña, te lo juro por la ballesta: las voces bajo el hielo cantaron la última estrofa. La que nadie cantó. Llevan trescientos años esperando un turno nuevo, y la montaña me ha dicho —sí, HABLADO, búscate otra explicación— que el turno nuevo es tuyo. Pon la mano en la nieve y di «os toca cantar a vosotras», que eran tres hermanas y su hermano el pequeño, y el pequeño es el que no llegaba al final... ¡Ja! La montaña vuelve a tener oído, Portador. Llévate su resonancia a tu campana: el frío ya no guarda voces... las PRESTA.",
    onEnd: "acto4_cam_ivo",
    options: [
      { text: "Os toca cantar a vosotras, pastores. Y al pequeño, el final.", tone: "empatico" },
      { text: "Resonancia prestada, devolución garantizada. Gracias, montaña.", tone: "pragmatico" },
      { text: "Una montaña que habla y tú sin abrigo. Aún hacéis buena pareja.", tone: "sarcastico" }
    ]
  },
  acto4_brisa_cierre1: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Tres campanas... no, Portador: una campana y un coro entero. Escucha. (Lunaris tañe la hora; el sonido baja al mar, cruza la laguna y vuelve puesto de acuerdo con las cumbres) La Campana del Ayer suena, y lo que suena no puede comérselo la Niebla sin masticar. Pero el que enseñó a la Niebla... el de la cara de hombre... ha bajado a la Cripta. La Guarda del Primer Canto lleva tres noches en pie ante la Sala, esperándote. Ve. Y Portador: lo que hay ahí dentro no es un monstruo. Es un hombre al que enseñaron a tener miedo de la música.",
    onEnd: "acto4_report",
    options: [
      { text: "Iré. Nadie muere dos veces por cantar, y él lleva una esperando.", next: "acto4_brisa_sala", tone: "empatico" },
      { text: "La Sala, la Nota, la Guarda. Voy.", next: "acto4_brisa_sala", tone: "pragmatico" },
      { text: "Un hombre con miedo a la música, en una cripta. Perfecto para cerrar un acto.", tone: "sarcastico" },
      { text: "Necesito preparar el acero antes de bajar.", tone: "pragmatico" }
    ]
  },
  acto4_brisa_sala: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "La Sala del Primer Canto es la habitación donde tu dios aprendió a cantar, Portador: la primera nota, la que costó el ayer de Velmora. Desde la Noche del Silencio está sellada, y su llave no es de acero: es de coro. Ahora que la Campana del Ayer llama, la puerta puede abrirse... pero alguien tiene que sostenerla mientras tú entras. La Guarda del Primer Canto —el tercer capellán que cantaba las horas, el que no calló— te espera dentro de la Cripta. Dile que Brisa aún canta. Ella sabrá qué significa.",
    onEnd: "accept_q15",
    options: [
      { text: "Brisa aún canta. Y yo canto con ella. Voy.", tone: "empatico" },
      { text: "Cripta, Guarda, Sala. Entendido. Que suene el final.", tone: "pragmatico" },
      { text: "Una cripta que es cerradura y yo de llave cantora. De acuerdo.", tone: "sarcastico" }
    ]
  },
  acto4_brisa_ruta2: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "La Cripta te espera, Portador: la Guarda del Primer Canto no abandona la puerta ni para dormir, y lleva tres noches escuchando tu campana. Dile que Brisa aún canta... y que esta vieja ya no da más de sí, pero se queda escuchando hasta que vuelvas."
  },
  acto4_brisa_sala_espera: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "La Sala está abierta y su Nota vibra, Portador: no la dejes esperando. Si saliste de la Cripta sin rematar, la Guarda sostiene la puerta: pídele volver a entrar. Y guarda una poción para el final... las últimas notas siempre piden más aire."
  },
  acto4_guarda_intro: {
    name: "La Guarda del Primer Canto",
    portrait: "kael",
    text: "...Dijiste la palabra de Brisa. Entonces puedo bajar la lanza: trescientos años en pie y ninguna orden para apartarla. Escucha, Portador: yo era el tercer capellán de la muralla de Lunaris —el que cantaba las horas—. Cuando el Canto murió, mis compañeros callaron y yo seguí... hasta que seguí dentro de la piedra: las piedras cantan por mí cuando llueve, y la Orden me dio este puesto para que nadie olvide el camino. Esta puerta guarda la Sala del Primer Canto: aquí aprendió a cantar tu dios, y aquí dejó Vesh, el Gran Inquisidor, su Última Nota... por si el mundo volvía a necesitar una lanza. Ahora se hace llamar El Heraldo, y la Niebla le presta la voz. ¿Abro?",
    onEnd: "acto4_guarda",
    options: [
      { text: "(Abre, Guarda. Por Brisa, por Velmora y por los que callaron.)", action: "acto4_subir", tone: "empatico" },
      { text: "¿Por qué la Orden guardó la nota que quiso matar?", next: "acto4_guarda_heraldo" },
      { text: "Prepararme antes. Nadie entra a una Sala sin filo.", tone: "pragmatico" }
    ]
  },
  acto4_guarda_heraldo: {
    name: "La Guarda del Primer Canto",
    portrait: "kael",
    text: "Porque Vesh no era cruel: era un hombre que VIO qué pasaba cuando el Canto tenía hambre. Vio pueblos sin ayeres, con la marea llena de nombres... y cuando la Orden bajó a matar al dios, él quiso guardar una última nota por si el mundo, algún día, la necesitaba de nuevo. Es una obediencia vieja, Portador, y las obediencias viejas no saben retirarse: ahora la Niebla le canta que la nota es SUYA, y él obedece. No lo odies. Rompe su barra... y escucha lo que canta debajo.",
    next: "acto4_guarda_puerta"
  },
  acto4_guarda_puerta: {
    name: "La Guarda del Primer Canto",
    portrait: "kael",
    text: "La Sala no perdona la prisa, y la Nota no perdona la piedad: come ayeres, y el tuyo también sabe a algo. Yo sostengo la puerta y la Campana del Ayer sostiene el coro; tú solo tienes que llegar hasta el final y querer más que él. Di la palabra.",
    options: [
      { text: "(Abrir la Sala: fuera del tiempo)", action: "acto4_subir" },
      { text: "Prepararme antes. Un filo honesto vale más que un verso.", tone: "pragmatico" }
    ]
  },
  acto4_guarda_espera: {
    name: "La Guarda del Primer Canto",
    portrait: "kael",
    text: "La Sala está abierta y la Nota vibra, Portador: no le dejes más silencio del debido. Si saliste sin terminar, vuelve a entrar: la puerta no se cierra mientras yo esté en pie... y en pie llevo trescientos años.",
    options: [
      { text: "(Volver a entrar en la Sala)", action: "acto4_subir" },
      { text: "Un momento. Hasta un coro necesita respirar.", tone: "empatico" }
    ]
  },
  acto4_guarda_gratitud: {
    name: "La Guarda del Primer Canto",
    portrait: "kael",
    text: "...(la Guarda deja la lanza en el suelo, y suena como suena una campana chica) Trescientos años, Portador, y has tardado una sola vida. La Nota ya no llama a la Niebla: ahora es solo una canción triste... y las canciones tristes también curan, si alguien las canta entera. La Brisa te espera en el valle: el Último Canto no se canta solo. Yo me quedo. Alguien tiene que cantar las horas cuando llueva.",
    onEnd: "acto4_report",
    options: [
      { text: "Que llueva mucho, Guarda. Cantaré contigo la próxima vez.", tone: "empatico" },
      { text: "Trescientos años en pie y de pie te quedas. Nota tomada.", tone: "pragmatico" }
    ]
  },
  acto4_guarda_silencio: {
    name: "La Guarda del Primer Canto",
    portrait: "kael",
    text: "...(la Guarda no gira la cabeza; la lanza sigue alta) Aún no, Portador. La Sala solo se abre a un coro entero: cuando el valle tenga su campana, vuelve. Trescientos años esperando no me han hecho prisa."
  },
  acto4_heraldo_aviso: {
    name: "Heraldo de Vesh",
    portrait: "kael",
    text: "...Ya lo sabes, ¿verdad? Se te nota en la manera de mirar los campanarios. Sí: bajé a la Sala. Mi Gran Inquisidor dejó una orden escrita antes de morir: «si alguien reúne el Canto, baja y sé su última nota». Yo creí que era un honor. Es un CASTIGO, recipiente: la última nota de un canto se queda vibrando para siempre, sin poder bajar del aire... (se ajusta la capucha) Nos vemos en la Sala. Y reza por que tu melodía sea más terca que mi obediencia.",
    options: [
      { text: "No eres tu obediencia, Heraldo. Baja, escucha y descansa.", tone: "empatico" },
      { text: "La última nota de un canto también es la más alta. Nos vemos.", tone: "pragmatico" },
      { text: "Si tanto amas vibrar, te dejo afinado en dos notas. Las mías.", tone: "amenazante", action: "rep_orden_-5" }
    ]
  },
  acto4_brisa_cierre2: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "...(Brisa no habla: escucha. Muy lejos —si la Ciudadela sigue existiendo— algo deja de llamar.) Así que el Heraldo era solo un hombre con una obediencia vieja... y la Nota ya es solo una canción triste. Descansa esta noche, Portador: el coro entero tañe, y hasta la Niebla aprende canciones nuevas. Las tuyas. Queda una sola cosa, y no es una misión: es un ECO. El que elegiste, el que has ido siendo mientras devolvías nombres, ayeres y horas. Ven cuando quieras: el Último Canto se canta con la letra que tú escribiste.",
    onEnd: "acto4_report",
    options: [
      { text: "(Respirar. Luego, el Último Canto.)", tone: "empatico" },
      { text: "(Dar una vuelta más a la plaza. Sin motivo.)", tone: "sarcastico" }
    ]
  },
  acto4_epilogo_verdad: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "La verdad, entonces. (Brisa no sonríe: descansa) Contaste lo que Velmora te confió y la Orden dejó de ser un puño cerrado: por primera vez en trescientos años, los de la Ciudadela lloran a sus muertos en voz alta, y las lanzas descansan porque una verdad pesa menos que un secreto. Hay quien te lo reprocha, Portador: hay quien quería a los Guardianes con la causa intacta. Pero el Eco que elegiste es este: una verdad con el suelo mojado de lágrimas viejas. El Último Canto se canta con ella... o no se canta.",
    onEnd: "acto4_epilogo",
    options: [
      { text: "(Cantar con la verdad puesta: es mi letra y la sostengo.)", action: "accept_q16", next: "acto4_epilogo_canto", tone: "empatico" },
      { text: "(Cantar. Llorar encima si hace falta; la nota manda.)", action: "accept_q16", next: "acto4_epilogo_canto", tone: "pragmatico" },
      { text: "(Cantar una versión donde salgo mejor parado. Obviamente.)", action: "accept_q16", next: "acto4_epilogo_canto", tone: "sarcastico" },
      { text: "Todavía no. Déjame respirar antes del Último Canto.", tone: "pragmatico" }
    ]
  },
  acto4_epilogo_silencio: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "El silencio, entonces. (Brisa sí sonríe, y es como ver llover sobre el río) Guardaste el secreto de la Orden y los Guardianes conservaron su causa: trescientos años cantando a un dios que mataba por cantar, y nada de eso se derrumbó. Hay quien dirá que mentiste al mundo con tu callar. Yo digo que elegiste a quién darle el peso: hay verdades que solo sostienen los que ya las cargan. El Eco que elegiste es este: un silencio que suena, como el de una casa vacía donde aún se guarda la taza llena. El Último Canto se canta con él... o no se canta.",
    onEnd: "acto4_epilogo",
    options: [
      { text: "(Cantar con el silencio bien guardado: mi letra es un refugio.)", action: "accept_q16", next: "acto4_epilogo_canto", tone: "empatico" },
      { text: "(Cantar. Lo que se conserva también se comparte.)", action: "accept_q16", next: "acto4_epilogo_canto", tone: "pragmatico" },
      { text: "Todavía no. Déjame respirar antes del Último Canto.", tone: "pragmatico" }
    ]
  },
  acto4_epilogo: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "Hazlo como quieras, Portador: callado o a gritos, el Canto ya es tuyo. (Brisa te mira como se mira el primer día y el último) Tres ecos devueltos, tres campanas criadas, una Sala abierta y una Nota aquietada. Lo que fuiste haciendo mientras caminabas... eso es el Último Canto. Solo falta ponerle letra. ¿La tuya?",
    onEnd: "acto4_epilogo",
    options: [
      { text: "(Cantar. Con todo lo que tengo y lo que me dieron.)", action: "accept_q16", next: "acto4_epilogo_canto", tone: "empatico" },
      { text: "Todavía no. Déjame respirar antes del Último Canto.", tone: "pragmatico" }
    ]
  },
  acto4_epilogo_canto: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "...(Brisa alza la voz, y no canta sola: la Campana del Ayer reparte la primera hora, el pozo de los nombres devuelve un coro que nadie recordaba haber prestado, y hasta la Niebla —que tantas letras robó— se queda a escuchar, quieta, como un perro viejo al que por fin le cantan lo suyo.) Escucha, Portador, y no lo olvides: el Canto de Aelthar no volvió porque un héroe lo buscara. Volvió porque alguien, paso a paso, fue devolviendo lo que le iban dando: una nana, una casa, un faro, un invierno, un canto al revés. Ese es el Eco que elegiste. Ese eres tú. Que suene.",
    options: [
      { text: "(Subir el telón del Último Canto: terminar el viaje)", action: "end_demo" },
      { text: "(Quedarse: el mundo aún tiene mañanas que nombrar)", tone: "empatico" }
    ]
  },
  acto4_epilogo_stay: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "El coro se queda, Portador: Toln le puso badajo al Ayer, la Espectro dicta nombres en la plaza de Merrow, Ivo apuesta a que la montaña desafina en los graves y el mar le lleva la contraparte. Yo tengo una taza llena y trescientas historias nuevas. Cuando quieras terminar el viaje, cierra los ojos y termina: el resto del coro canta donde tú cantes.",
    options: [
      { text: "(Subir el telón del Último Canto: terminar el viaje)", action: "end_demo" },
      { text: "(Quedarse un rato más junto a la taza llena)", tone: "empatico" }
    ]
  }
};
Object.assign(DIALOGUES, D_ACTO4);
var ACTO4_FIN_BASE = "...(Brisa alza la voz, y no canta sola: la Campana del Ayer reparte la primera hora, el pozo de los nombres devuelve un coro que nadie recordaba haber prestado, y hasta la Niebla —que tantas letras robó— se queda a escuchar, quieta, como un perro viejo al que por fin le cantan lo suyo.) Escucha, Portador, y no lo olvides: el Canto de Aelthar no volvió porque un héroe lo buscara. Volvió porque alguien, paso a paso, fue devolviendo lo que le iban dando: una nana, una casa, un faro, un invierno, un canto al revés. Ese es el Eco que elegiste. Ese eres tú. Que suene.";
var ACTO4_FIN_JEFES = {
  coro: "(A lo lejos, algo tañe en tres voces distintas: las tres máscaras del Coro Roto, ahora tres campanas gemelas, aprendiendo por fin a sonar juntas sin nadie que las una a la fuerza.)",
  vult: "(En la colina, un mapa se dobla solo: Vult, el Cazador de Ecos, despide los pasos que robó y saluda con el sombrero de cartógrafo. La Liga facturará la escena.)"
};
var ACTO4_BOSS = { ref: null };
var ENEMY_DEFS_16A = {
  heraldo: {
    name: "El Heraldo · Vesh, la Última Nota",
    hp: 640,
    dmg: 20,
    speed: 46,
    xp: 420,
    gold: [220, 280],
    sprite: "inquisidor",
    aggroR: 175,
    atkR: 42,
    windup: 0.5,
    atkCd: 1.6,
    element: "sombra",
    weakTo: "sagrado",
    breakBar: 130,
    desc: "El último hombre de la Orden de Vesh: entró a la Sala del Primer Canto a ser una nota por obediencia y la Niebla le prestó su voz. Golpea como un silencio que cae; quebra su barra y oirás lo que canta debajo. Débil a la luz."
  }
};
Object.assign(ENEMY_DEFS, ENEMY_DEFS_16A);
var GET_DIALOGUE_ACTO3 = getDialogue;
function getDialogueActo4(nid, ctx) {
  const { questIdx: q, questStep: s, flags: f } = ctx;
  const heraldoMuerto = !!f.heraldoDerrotado || ACTO4_BOSS.ref?.dead === true;
  if (nid === "brisa" && q === 12 && f.acto3Done && !f.q14)
    return "acto4_brisa_alba";
  if (nid === "guarda") {
    if (q === 14) {
      if (s === 0 && !f.acto4Guarda)
        return "acto4_guarda_intro";
      if (heraldoMuerto)
        return "acto4_guarda_gratitud";
      return f.acto4SalaAbierta ? "acto4_guarda_espera" : "acto4_guarda_puerta";
    }
    return heraldoMuerto ? "acto4_guarda_gratitud" : "acto4_guarda_silencio";
  }
  if (q < 13 || q > 15)
    return GET_DIALOGUE_ACTO3(nid, ctx);
  switch (nid) {
    case "brisa": {
      if (q === 13)
        return s === 2 ? "acto4_brisa_cierre1" : "acto4_brisa_ruta";
      if (q === 14) {
        if (s === 2)
          return "acto4_brisa_cierre2";
        if (heraldoMuerto)
          return "acto4_brisa_cierre2";
        return s === 0 ? "acto4_brisa_ruta2" : "acto4_brisa_sala_espera";
      }
      if (f.acto4Done)
        return "acto4_epilogo_stay";
      const rO = typeof f.acto4RepOrden === "number" ? f.acto4RepOrden : 0;
      const rG = typeof f.acto4RepGuard === "number" ? f.acto4RepGuard : 0;
      if (f.acto3RepDecision)
        return rO > rG ? "acto4_epilogo_verdad" : "acto4_epilogo_silencio";
      return "acto4_epilogo";
    }
    case "toln":
      if (q === 13 && s === 0 && !f.camToln) {
        return toneOf(ctx.flags) === "sarcastico" ? "acto4_toln_cam_sarc" : "acto4_toln_cam";
      }
      return GET_DIALOGUE_ACTO3(nid, ctx);
    case "mera":
      if (q === 13 && s === 1 && !f.camMera && f.sirenaDefeated)
        return "acto4_mera_cam";
      return GET_DIALOGUE_ACTO3(nid, ctx);
    case "ivo":
      if (q === 13 && s === 1 && !f.camCumbres && f.golemDefeated)
        return "acto4_ivo_cam";
      return GET_DIALOGUE_ACTO3(nid, ctx);
    case "heraldo":
      if (!heraldoMuerto)
        return "acto4_heraldo_aviso";
      return GET_DIALOGUE_ACTO3(nid, ctx);
    default:
      return GET_DIALOGUE_ACTO3(nid, ctx);
  }
}
getDialogue = getDialogueActo4;
var SENNUEL = {
  key: "sennuelo",
  name: "Señuelo de caza",
  price: 60,
  desc: "Atrae a los enemigos no-jefe cercanos durante 5 s (tecla 8). Los jefes lo ignoran."
};
Object.assign(D, INTERLUDIOS);
var D_REACC_18F = {
  r18_reacc_acto2_brisa: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "(El Eco te trae la voz de la anciana, clara como si caminara a tu lado.) «El valle entero respiró cuando sonaste el primer canto, Portador. Yo ya no puedo doblar la esquina del sur: mis piernas se quedaron en Lunaris hace treinta inviernos. Pero mi taza seguirá llena en el umbral y mi puerta abierta. Trae el segundo Eco... y tráete también las manos intactas: los muertos no beben.»",
    options: [{ text: "…", next: "r18_reacc_acto2_toln" }]
  },
  r18_reacc_acto2_toln: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "(La forja te alcanza en el recuerdo, tibia entre la bruma.) «¡Ja! ¿El mar? Mi bisablero decía que el agua salada deshace los filos y las promesas. Llévate el acero bien templado y no respondas NADA a lo que cante en la niebla: mi abuela juraba que la Niebla aprende lo que le contestas. Yo solo sé de yunque... pero hasta el yunque sabe que esta vez el hierro eres tú.»",
    options: [{ text: "(Seguir camino)" }]
  },
  r18_reacc_acto3_brisa: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "(El Eco te trae la voz de la anciana, pausada como un invierno.) «Trescientos años velando el Canto y nunca lo había oído toser, Portador. Lo que se canta al revés no es canción: es una puerta abierta del otro lado. Yo ya no puedo enderezar ecos: enderezo tazas y palabras. Pero algo aprendí haciéndome vieja: lo torcido se compone donde se rompió. Ve despacio y vuelve entero.»",
    options: [{ text: "…", next: "r18_reacc_acto3_toln" }]
  },
  r18_reacc_acto3_toln: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "(El martillo suena en tu memoria, seguro y derecho.) «El yunque templó ROMO anoche, Portador. ¿Sabes lo que me dolió? Cuarenta años haciendo filos y de pronto el metal me sale cantando al revés. Pues escucha: lo que a mí me pasó con el acero te va a pasar a ti con la melodía. No la pelees con prisa: busca el punto donde se torció y enderézalo desde ahí... o tráeme al desatinado a la forja y lo aplanamos entre los dos.»",
    options: [{ text: "(Seguir)" }]
  },
  r18_reacc_acto4_brisa: {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: "(El Eco te trae la voz de la anciana, y algo tiembla en ella.) «Una campana, Portador. Una campana de verdad, que reparta las horas y llame a los míos por su nombre... Ya ni recuerdo la última vez que oí una. Dile a Toln que la cría despacio: el metal que recuerda no se funde dos veces. Y cuando el coro esté completo, canta tú. Yo canté mi estrofa hace trescientos años, y todavía me duele lo bien que sonaba.»",
    options: [{ text: "…", next: "r18_reacc_acto4_toln" }]
  },
  r18_reacc_acto4_toln: {
    name: "Maestro Toln",
    portrait: "toln",
    text: "(La forja arde en tu memoria, más viva que nunca.) «¡Por las barbas de mi bisablero! ¡Una CAMPANA, Portador! El metal que recuerda... mi bisabla lo llamaba el hierro nostálgico: se cría, no se funde; hay que darle ritmo de martillo y no soltarlo hasta que suene solo. Será la pieza de mi vida. Vuelve con el coro completo: si esta campana llama a los que la Niebla se llevó, hasta la Niebla tendrá que quitarse el sombrero.»",
    options: [{ text: "(Seguir)" }]
  }
};
Object.assign(D, D_REACC_18F);

// src/game/fxcore.ts
function addShake(g, mag) {
  g.shake = Math.max(g.shake, mag);
}
function addFlash(g, color, t = 0.18) {
  if (t >= g.flashT) {
    g.flashT = t;
    g.flashColor = color;
  }
}
function requestSlowmo(g, t = 0.25) {
  g.slowmoT = Math.max(g.slowmoT, t);
}
function applyKnockback(e, dx, dy, force) {
  const l = Math.max(0.001, Math.hypot(dx, dy));
  e.kbVx = (e.kbVx ?? 0) + dx / l * force;
  e.kbVy = (e.kbVy ?? 0) + dy / l * force;
}
function stepKnockback(g, e, dt) {
  const kx = e.kbVx ?? 0, ky = e.kbVy ?? 0;
  if (kx === 0 && ky === 0)
    return false;
  const decay = Math.pow(0.0015, dt);
  e.kbVx = kx * decay;
  e.kbVy = ky * decay;
  if (Math.abs(e.kbVx) < 2 && Math.abs(e.kbVy) < 2) {
    e.kbVx = 0;
    e.kbVy = 0;
  }
  const { x: beforeX, y: beforeY } = e;
  g.moveEntity(e, kx * dt, ky * dt);
  return e.x !== beforeX || e.y !== beforeY;
}

// src/game/fx.ts
var MOTA = 0;
var FIREFLY = 1;
var LEAF = 2;
var SPORE = 3;
var ASH = 4;
var CRYPTWISP = 5;
var SEAMIST = 6;
var FOAM = 7;
var MEMORA = 8;
var SNOW = 9;
var WISPFRIO = 10;
var FAROBEAM = 11;
var AMB_CAP = 120;
var pool = Array.from({ length: AMB_CAP }, () => ({
  active: false,
  kind: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  t: 0,
  maxT: 1,
  seed: 0,
  size: 1
}));
var spawnAcc = 0;
var dustAcc = 0;
var faroAcc = 0;
var bannerElapsed = 0;
var prevBannerT = 0;
var memElapsed = 0;
var memId = "";
var rollTrail = [];
var TRAIL_LIFE = 0.22;
function fxFrame(g) {
  const dt = lastGT < 0 ? 1 / 60 : Math.max(0.0001, Math.min(0.05, g.globalT - lastGT));
  lastGT = g.globalT;
  if (g.state !== "play" && g.state !== "dialogue" && g.shake > 0) {
    g.shake *= Math.pow(0.004, dt);
    if (g.shake < 0.05)
      g.shake = 0;
  }
  return dt;
}
var lastGT = -1;
function spawnAmbient(g) {
  const slot = pool.find((a) => !a.active);
  if (!slot)
    return;
  const margin = 24;
  const wx0 = g.camX / ZOOM - margin, wy0 = g.camY / ZOOM - margin;
  const wx1 = (g.camX + VIEW_W) / ZOOM + margin, wy1 = (g.camY + VIEW_H) / ZOOM + margin;
  const seed = Math.floor(g.globalT * 997) ^ (spawnAcc * 131 | 0);
  const r = hash2(seed, 7);
  const init = (kind, x, y, vx, vy, maxT, size) => {
    slot.active = true;
    slot.kind = kind;
    slot.x = x;
    slot.y = y;
    slot.vx = vx;
    slot.vy = vy;
    slot.t = 0;
    slot.maxT = maxT;
    slot.seed = hash2(seed, 3);
    slot.size = size;
  };
  if (g.mapId === "lunaris") {
    if (isNight(g)) {
      init(FIREFLY, wx0 + r * (wx1 - wx0), wy0 + (wy1 - wy0) * (0.35 + hash2(seed, 11) * 0.6), (r - 0.5) * 10, (hash2(seed, 13) - 0.5) * 8, 5 + hash2(seed, 17) * 3, 1.5);
    } else {
      init(MOTA, wx0 + r * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0), (r - 0.5) * 6, -2 - hash2(seed, 13) * 4, 6 + hash2(seed, 17) * 4, 1 + hash2(seed, 19) * 1.2);
    }
  } else if (g.mapId === "bosque") {
    if (r < 0.62) {
      init(LEAF, wx0 + r * (wx1 - wx0), wy0 - 6, 0, 16 + hash2(seed, 13) * 12, 9, 2);
    } else {
      init(SPORE, wx0 + r * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0), (r - 0.5) * 5, -1 - hash2(seed, 15) * 2, 5 + hash2(seed, 17) * 3, 1);
    }
  } else if (g.mapId === "costa") {
    const night = isNight(g);
    const foamK = night ? 0.16 : 0.42;
    if (r < foamK) {
      init(FOAM, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 + (wy1 - wy0) * (0.6 + hash2(seed, 11) * 0.32), 5 + hash2(seed, 13) * 10, -5 - hash2(seed, 15) * 6, 0.5 + hash2(seed, 17) * 0.4, 1.2);
    } else {
      init(SEAMIST, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0), -9 - hash2(seed, 13) * 5, 0, 7 + hash2(seed, 17) * 3.5, 2.2 + hash2(seed, 19) * 1.8);
    }
  } else if (g.mapId === "aldea") {
    if (r < 0.85) {
      init(MEMORA, wx0 + hash2(seed, 21) * (wx1 - wx0), wy1 - hash2(seed, 11) * 24, (r - 0.5) * 4, -3.5 - hash2(seed, 13) * 3.5, 7 + hash2(seed, 17) * 4, 1 + hash2(seed, 19) * 0.8);
    } else {
      init(ASH, wx0 + hash2(seed, 21) * (wx1 - wx0), wy1 - hash2(seed, 11) * 20, (r - 0.5) * 6, -7 - hash2(seed, 13) * 6, 4 + hash2(seed, 17) * 2.5, 1 + hash2(seed, 19) * 0.6);
    }
  } else if (g.mapId === "cumbres") {
    const night = isNight(g);
    if (r < (night ? 0.7 : 0.8)) {
      init(SNOW, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 - 6, 0, 13 + hash2(seed, 13) * 10, 5 + hash2(seed, 17) * 3, 0.9 + hash2(seed, 19) * 1.3);
    } else {
      init(WISPFRIO, wx0 + hash2(seed, 21) * (wx1 - wx0), wy0 + (wy1 - wy0) * (0.45 + hash2(seed, 11) * 0.45), (r - 0.5) * 8, -1 - hash2(seed, 13) * 2, 4.5 + hash2(seed, 17) * 2, 1.4);
    }
  } else {
    if (r < 0.78) {
      init(ASH, wx0 + r * (wx1 - wx0), wy1 - hash2(seed, 11) * 20, (r - 0.5) * 8, -9 - hash2(seed, 13) * 8, 4.5 + hash2(seed, 17) * 3, 1 + hash2(seed, 19));
    } else {
      init(CRYPTWISP, wx0 + r * (wx1 - wx0), wy0 + hash2(seed, 11) * (wy1 - wy0), (r - 0.5) * 8, -2, 5 + hash2(seed, 17) * 2, 1.5);
    }
  }
}
function updateAmbient(g, dt) {
  if (g.bossBannerT > prevBannerT + 0.03)
    bannerElapsed = 0;
  prevBannerT = g.bossBannerT;
  bannerElapsed += dt;
  if (g.memoryReveal) {
    if (g.memoryReveal.id !== memId) {
      memId = g.memoryReveal.id;
      memElapsed = 0;
    }
    memElapsed += dt;
  } else {
    memId = "";
  }
  const p = g.player;
  dustAcc += dt;
  if (p && p.moving && p.rollT <= 0 && p.attackT <= 0 && dustAcc >= 0.12) {
    dustAcc = 0;
    const feetY = p.y + p.h * 0.5;
    const tch = tileAt(g.map, g.rows, Math.floor(p.x / TILE), Math.floor(feetY / TILE), g.epoch);
    if (tch === "i") {
      const dir = Math.random() < 0.5 ? -1 : 1;
      g.particles.push({
        x: p.x + (Math.random() - 0.5) * 8,
        y: feetY - 1,
        vx: dir * (34 + Math.random() * 40),
        vy: (Math.random() - 0.5) * 6,
        t: 0.2,
        maxT: 0.2,
        color: "#dff0fa",
        size: 1.2,
        grav: 0
      });
    } else if (tch === "s") {
      g.particles.push({
        x: p.x + (Math.random() - 0.5) * 8,
        y: feetY - 1,
        vx: (Math.random() - 0.5) * 16,
        vy: -4 - Math.random() * 5,
        t: 0.36,
        maxT: 0.36,
        color: "#f0e0b0",
        size: 2.3,
        grav: 16
      });
    } else if (tch === "S") {
      g.particles.push({
        x: p.x + (Math.random() - 0.5) * 7,
        y: feetY - 1,
        vx: (Math.random() - 0.5) * 16,
        vy: -4 - Math.random() * 5,
        t: 0.34,
        maxT: 0.34,
        color: "rgba(240,246,255,0.85)",
        size: 1.6,
        grav: 16
      });
    } else {
      g.particles.push({
        x: p.x + (Math.random() - 0.5) * 6,
        y: feetY - 1,
        vx: (Math.random() - 0.5) * 10,
        vy: -6 - Math.random() * 6,
        t: 0.28,
        maxT: 0.28,
        color: "rgba(196,188,164,0.8)",
        size: 1.4,
        grav: 42
      });
    }
  }
  if (g.mapId === "costa") {
    let faro = null;
    for (const pr of g.map.props) {
      if (pr.kind === "faro" && g.flags[pr.id]) {
        faro = pr;
        break;
      }
    }
    if (faro) {
      const lx = faro.x * TILE + 8, ly = faro.y * TILE + 8 - 34;
      if (lx >= g.camX / ZOOM - 48 && lx <= (g.camX + VIEW_W) / ZOOM + 48 && ly >= g.camY / ZOOM - 48 && ly <= (g.camY + VIEW_H) / ZOOM + 48) {
        faroAcc += dt * 3;
        while (faroAcc >= 1) {
          const slot = pool.find((a) => !a.active);
          if (!slot) {
            faroAcc = 1;
            break;
          }
          faroAcc -= 1;
          const s = Math.floor(g.globalT * 997) ^ (faroAcc * 511 | 0);
          slot.active = true;
          slot.kind = FAROBEAM;
          slot.x = lx;
          slot.y = ly;
          slot.vx = 0;
          slot.vy = 0;
          slot.t = 0;
          slot.maxT = 1.5 + hash2(s, 3) * 1.1;
          slot.seed = hash2(s, 5);
          slot.size = 1.1 + hash2(s, 7) * 0.8;
        }
      }
    }
  }
  for (let i = rollTrail.length - 1;i >= 0; i--) {
    rollTrail[i].life -= dt;
    if (rollTrail[i].life <= 0)
      rollTrail.splice(i, 1);
  }
  if (p && p.rollT > 0) {
    const last = rollTrail[rollTrail.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 7) {
      rollTrail.push({ x: p.x, y: p.y, dir: p.dir, anim: p.anim, life: TRAIL_LIFE });
      if (rollTrail.length > 6)
        rollTrail.shift();
    }
  }
  const cfgRate = g.mapId === "bosque" ? 16 : g.mapId === "cripta" ? 15 : g.mapId === "costa" ? 13 : g.mapId === "aldea" ? 8 : g.mapId === "cumbres" ? 17 : 12;
  spawnAcc += dt * cfgRate;
  while (spawnAcc >= 1) {
    spawnAcc -= 1;
    spawnAmbient(g);
  }
  for (const a of pool) {
    if (!a.active)
      continue;
    a.t += dt;
    if (a.t >= a.maxT) {
      a.active = false;
      continue;
    }
    switch (a.kind) {
      case FIREFLY: {
        const w = Math.sin(g.globalT * 1.7 + a.seed * 9);
        a.vx += Math.cos(g.globalT * 1.3 + a.seed * 7) * 14 * dt;
        a.vy += w * 10 * dt;
        a.vx = Math.max(-14, Math.min(14, a.vx));
        a.vy = Math.max(-10, Math.min(10, a.vy));
        break;
      }
      case LEAF: {
        break;
      }
      case ASH: {
        a.vx += Math.sin(g.globalT * 2 + a.seed * 11) * 6 * dt;
        break;
      }
      case CRYPTWISP: {
        a.vx += Math.cos(g.globalT * 1.1 + a.seed * 5) * 10 * dt;
        a.vy += Math.sin(g.globalT * 0.9 + a.seed * 3) * 8 * dt;
        break;
      }
      case SEAMIST: {
        break;
      }
      case FOAM: {
        a.vy += 14 * dt;
        break;
      }
      case MEMORA: {
        a.vx += Math.sin(g.globalT * 1.4 + a.seed * 9) * 5 * dt;
        break;
      }
      case SNOW: {
        a.vx = Math.sin(g.globalT * 0.9 + a.seed * 14) * (7 + a.seed * 11);
        break;
      }
      case WISPFRIO: {
        a.vx += Math.cos(g.globalT * 0.9 + a.seed * 6) * 9 * dt;
        a.vy += Math.sin(g.globalT * 0.7 + a.seed * 4) * 7 * dt;
        break;
      }
      default:
        break;
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (a.x < g.camX / ZOOM - 60 || a.x > (g.camX + VIEW_W) / ZOOM + 60 || a.y < g.camY / ZOOM - 60 || a.y > (g.camY + VIEW_H) / ZOOM + 60) {
      a.active = false;
    }
  }
}
function drawAmbient(g, layer) {
  const ctx = g.ctx;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const sx = (wx) => wx * ZOOM - camX;
  const sy = (wy) => wy * ZOOM - camY;
  if (layer === "sky") {
    drawSky(g, ctx);
    return;
  }
  if (g.mapId === "bosque" && g.map.epochDiffs.length > 0) {
    const density = g.epoch === "pasado" ? 0.045 : 0.14;
    ctx.save();
    ctx.globalAlpha = density;
    ctx.fillStyle = "#9ec4b4";
    for (let i = 0;i < 4; i++) {
      const seed = i * 37 + 5;
      const fx = (g.globalT * 9 + i * 300) % (VIEW_W + 360) - 180;
      const fy = 70 + i * 110 + Math.sin(g.globalT * 0.6 + seed) * 16;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 150, 24 + i % 2 * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const a of pool) {
    if (!a.active)
      continue;
    const lifeK = 1 - a.t / a.maxT;
    const fade = Math.min(1, lifeK * 3, a.t * 4);
    const x = sx(a.x), y = sy(a.y);
    switch (a.kind) {
      case MOTA: {
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = "#ffe9a0";
        const wob = Math.sin(g.globalT * 2 + a.seed * 8) * 2;
        ctx.fillRect(x + wob, y, a.size * ZOOM, a.size * ZOOM);
        break;
      }
      case FIREFLY: {
        const blink = Math.max(0, Math.sin(g.globalT * 2.4 + a.seed * 12));
        const al = blink * blink * fade;
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.35 * al;
        ctx.fillStyle = "#8ef0a8";
        ctx.beginPath();
        ctx.arc(x, y, 5 * ZOOM * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = Math.min(1, 0.4 + al);
        ctx.fillStyle = "#d8ffd0";
        ctx.fillRect(x, y, 2, 2);
        break;
      }
      case LEAF: {
        const sway = Math.sin(a.t * 2.6 + a.seed * 9) * 14;
        const flip = Math.sin(a.t * 5 + a.seed * 4);
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = a.seed > 0.5 ? "#c8a050" : "#8aa050";
        ctx.fillRect(x + sway, y, 2 * ZOOM * 0.7, Math.max(1, Math.abs(flip) * 2.2));
        ctx.fillStyle = a.seed > 0.5 ? "#e0b860" : "#a8bc60";
        ctx.fillRect(x + sway, y, ZOOM * 0.7, Math.max(1, Math.abs(flip) * 1.4));
        break;
      }
      case SPORE: {
        ctx.globalAlpha = 0.45 * fade * (0.6 + 0.4 * Math.sin(g.globalT * 3 + a.seed * 7));
        ctx.fillStyle = "#d8f0e0";
        ctx.fillRect(x, y, 1.5 * ZOOM, 1.5 * ZOOM);
        break;
      }
      case ASH: {
        ctx.globalAlpha = 0.5 * fade;
        ctx.fillStyle = a.seed > 0.6 ? "#b8c8e0" : "#8fa4c8";
        ctx.fillRect(x, y, a.size * ZOOM * 0.8, a.size * ZOOM * 0.8);
        break;
      }
      case CRYPTWISP: {
        const pulse = 0.5 + 0.5 * Math.sin(g.globalT * 2.2 + a.seed * 9);
        ctx.globalAlpha = 0.3 * fade * (0.4 + pulse * 0.6);
        ctx.fillStyle = "#9fe8d8";
        ctx.beginPath();
        ctx.arc(x, y, 3 * ZOOM * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8 * fade * pulse;
        ctx.fillStyle = "#e8fff8";
        ctx.fillRect(x, y, 1.5 * ZOOM, 1.5 * ZOOM);
        break;
      }
      case SEAMIST: {
        const wob = Math.sin(g.globalT * 0.55 + a.seed * 9) * 7;
        ctx.globalAlpha = 0.14 * fade;
        ctx.fillStyle = "#cfe0f2";
        ctx.beginPath();
        ctx.arc(x, y + wob, a.size * ZOOM * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.1 * fade;
        ctx.fillStyle = "#e8f2fa";
        ctx.beginPath();
        ctx.arc(x + a.size * ZOOM, y + wob + 3, a.size * ZOOM * 1.7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case FOAM: {
        const strobe = Math.sin(a.t * (9 + a.seed * 5) + a.seed * 30) > 0 ? 1 : 0.12;
        ctx.globalAlpha = (0.55 + 0.45 * strobe) * fade;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, 2, 2);
        if (strobe > 0) {
          ctx.globalAlpha = 0.25 * fade;
          ctx.fillRect(x - 1, y - 1, 4, 4);
        }
        break;
      }
      case MEMORA: {
        const dying = lifeK < 0.4;
        const pulse = dying ? 0.35 + 0.65 * Math.abs(Math.sin(a.t * 9 + a.seed * 20)) : 1;
        ctx.globalAlpha = (isNight(g) ? 0.34 : 0.55) * fade * pulse;
        ctx.fillStyle = a.seed > 0.5 ? "#ecdcae" : "#d8c898";
        ctx.fillRect(x + Math.sin(g.globalT * 1.6 + a.seed * 8) * 2, y, a.size * ZOOM * 0.9, a.size * ZOOM * 0.9);
        break;
      }
      case SNOW: {
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = "#f2f6ff";
        ctx.fillRect(x, y, a.size * ZOOM * 0.8, a.size * ZOOM * 0.8);
        break;
      }
      case WISPFRIO: {
        const pulseF = 0.5 + 0.5 * Math.sin(g.globalT * 1.9 + a.seed * 8);
        ctx.globalAlpha = 0.28 * fade * (0.4 + pulseF * 0.6);
        ctx.fillStyle = "#9ecdf0";
        ctx.beginPath();
        ctx.arc(x, y, 3 * ZOOM * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.75 * fade * pulseF;
        ctx.fillStyle = "#e6f6ff";
        ctx.fillRect(x, y, 1.5 * ZOOM, 1.5 * ZOOM);
        break;
      }
      case FAROBEAM: {
        const ang = g.globalT * 0.35 + a.seed * 6.28;
        const rad = (9 + a.t * 17 + a.seed * 6) * ZOOM;
        const bx = x + Math.cos(ang) * rad;
        const by = y + Math.sin(ang) * rad * 0.85;
        const tw = 0.75 + 0.25 * Math.sin(g.globalT * 5 + a.seed * 40);
        const nightK = isNight(g) ? 1.25 : 1;
        ctx.globalAlpha = Math.min(0.34, 0.17 * fade * tw * nightK);
        ctx.strokeStyle = "#fff3c8";
        ctx.lineWidth = a.size * ZOOM * 0.7;
        ctx.beginPath();
        ctx.moveTo(bx - Math.sin(ang) * 3.2 * ZOOM, by + Math.cos(ang) * 3.2 * ZOOM);
        ctx.lineTo(bx + Math.sin(ang) * 3.2 * ZOOM, by - Math.cos(ang) * 3.2 * ZOOM);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }
  ctx.globalAlpha = 1;
}
function drawSky(g, ctx) {
  const t = g.globalT;
  if (g.map.dark) {
    const flick = 0.5 + 0.5 * Math.sin(t * 11) * 0.6 + 0.25 * Math.sin(t * 23 + 1.7) + 0.15 * Math.sin(t * 7.7);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.05 + 0.035 * Math.max(0, flick);
    ctx.fillStyle = "#ff9a50";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
    return;
  }
  const dayLight = Math.max(0.1, Math.sin(g.dayT * Math.PI * 2) * 1.25 + 0.25);
  const nf = 1 - Math.min(1, dayLight);
  if (nf < 0.08)
    return;
  for (let i = 0;i < 46; i++) {
    const s1 = hash2(i * 7 + 1, 3);
    const s2 = hash2(i * 13 + 2, 5);
    const s3 = hash2(i * 17 + 4, 9);
    const x = s1 * VIEW_W;
    const y = s2 * VIEW_H * 0.55;
    const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * (0.5 + s3 * 1.2) + s3 * 9));
    ctx.globalAlpha = nf * tw * 0.8;
    ctx.fillStyle = s3 > 0.85 ? "#ffe9c8" : "#dce4ff";
    ctx.fillRect(x, y, s3 > 0.7 ? 2 : 1, s3 > 0.7 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  if (nf > 0.3) {
    const mx = VIEW_W * 0.8, my = 64;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(mx, my, 6, mx, my, 52);
    halo.addColorStop(0, `rgba(214,226,255,${0.3 * nf})`);
    halo.addColorStop(1, "rgba(214,226,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 56, my - 56, 112, 112);
    ctx.restore();
    ctx.globalAlpha = Math.min(1, nf * 1.2);
    ctx.fillStyle = "#e8ecf4";
    ctx.beginPath();
    ctx.arc(mx, my, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(180,192,214,0.7)";
    ctx.fillRect(mx - 4, my - 3, 3, 3);
    ctx.fillRect(mx + 2, my + 3, 2, 2);
    ctx.fillRect(mx + 3, my - 5, 2, 2);
    ctx.globalAlpha = 1;
  }
}
function combatSparks(g, x, y, dirX, dirY, color, n = 6, power = 70) {
  const base = Math.atan2(dirY, dirX);
  for (let i = 0;i < n; i++) {
    const ang = base + (Math.random() - 0.5) * 1.7;
    const spd = power * (0.45 + Math.random() * 0.75);
    const t = 0.2 + Math.random() * 0.15;
    g.particles.push({
      x: x + (Math.random() - 0.5) * 5,
      y: y + (Math.random() - 0.5) * 5,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      t,
      maxT: t,
      color,
      size: 1 + Math.random() * 1.5,
      grav: 60
    });
  }
}
function dodgeRing(g, x, y) {
  const N = 9;
  for (let i = 0;i < N; i++) {
    const a = i / N * Math.PI * 2 + 0.35;
    const rx = Math.cos(a);
    const ry = Math.sin(a) * 0.55;
    g.particles.push({
      x: x + rx * 4,
      y: y + 2 + ry * 4,
      vx: rx * 46,
      vy: ry * 46 - 8,
      t: 0.3,
      maxT: 0.3,
      color: "#cfe0f2",
      size: 1.7,
      grav: 30
    });
  }
}
function critGlint(g, x, y) {
  for (let i = 0;i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + 0.5;
    const t = 0.28 + i * 0.04;
    g.particles.push({
      x: x + Math.cos(a) * 3,
      y: y + Math.sin(a) * 3,
      vx: Math.cos(a) * 24,
      vy: Math.sin(a) * 24,
      t,
      maxT: t,
      color: i === 0 ? "#ffe86a" : "#ffd24a",
      size: 4.4 - i * 0.8,
      grav: 14
    });
  }
}
function getRollTrail() {
  return rollTrail;
}
function bannerInfo(g) {
  return {
    slide: Math.min(1, bannerElapsed / 0.45),
    out: Math.min(1, g.bossBannerT / 0.4),
    elapsed: bannerElapsed
  };
}
function memoryAlpha(g) {
  if (!g.memoryReveal)
    return 0;
  return Math.max(0, Math.min(1, memElapsed / 0.5, g.memoryReveal.t / 0.6));
}

// src/game/enemies_expansion.ts
var T_VULT = "vult";
var T_CORO = "coro";
var spawns14aPuestos = false;
function puestarSpawns14a() {
  if (spawns14aPuestos)
    return;
  spawns14aPuestos = true;
  if (MAPS.bosque)
    MAPS.bosque.spawns.push({ type: "ecodesg", x: 8, y: 12, patrol: 3, zone: "bosque" });
  if (MAPS.cripta)
    MAPS.cripta.spawns.push({ type: "ecodesg", x: 31, y: 14, patrol: 2, zone: "cripta" });
  if (MAPS.bosque)
    MAPS.bosque.spawns.push({ type: "satiro", x: 47, y: 22, patrol: 4, zone: "bosque" });
  if (MAPS.cumbres)
    MAPS.cumbres.spawns.push({ type: "satiro", x: 18, y: 18, patrol: 4, zone: "cumbres" });
}
puestarSpawns14a();
function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
function isNightG(g) {
  return g.dayT > 0.7 || g.dayT < 0.08;
}
function moveDir(g, e, dx, dy, spd, dt) {
  const l = Math.hypot(dx, dy);
  if (l < 0.0001) {
    e.moving = false;
    return;
  }
  g.moveEntity(e, dx / l * spd * dt, dy / l * spd * dt);
  e.moving = true;
  if (Math.abs(dx) > 0.01)
    e.dir = dx > 0 ? "right" : "left";
}
var lastDiveT = -99;
var MEM = new WeakMap;
function mem(e) {
  let m = MEM.get(e);
  if (!m) {
    m = {};
    MEM.set(e, m);
  }
  return m;
}
function commonTick(g, e, dt, def, m) {
  const p = g.player;
  const motorRan = m.lastAnim !== undefined && e.anim !== m.lastAnim;
  m.lastAnim = e.anim;
  if (e.spawnGuard && e.spawnGuard > 0) {
    if (!motorRan)
      e.spawnGuard = Math.max(0, e.spawnGuard - dt);
    if (e.spawnGuard > 0)
      return true;
  }
  const prev = m.prevHitFlash ?? 0;
  m.freshHit = e.hitFlash > prev + 0.0005 && e.hitFlash > 0.06;
  if (!motorRan && e.hitFlash > 0 && Math.abs(e.hitFlash - prev) < 0.000000001) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
  }
  m.prevHitFlash = e.hitFlash;
  if (!motorRan)
    stepKnockback(g, e, dt);
  if (!motorRan) {
    for (let i = e.statuses.length - 1;i >= 0; i--) {
      const s = e.statuses[i];
      s.t -= dt;
      if (s.kind === "quemado") {
        e.hp -= s.power * dt;
        if (Math.random() < 0.15) {
          g.particles.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 6, vx: 0, vy: -24, t: 0.3, maxT: 0.3, color: "#ff9040", size: 1.5, grav: 0 });
        }
        if (e.hp <= 0) {
          g.killEnemy(e);
          return true;
        }
      }
      if (s.t <= 0)
        e.statuses.splice(i, 1);
    }
    if (e.marked !== undefined) {
      e.marked -= dt;
      if (e.marked <= 0)
        e.marked = undefined;
    }
  }
  if (e.hp < e.maxHp)
    e.aggro = true;
  if (e.invulT && e.invulT > 0)
    e.invulT = Math.max(0, e.invulT - dt);
  if (m.lastAtkCd === undefined || Math.abs(e.atkCd - m.lastAtkCd) < 0.000000001)
    e.atkCd -= dt;
  if (!motorRan)
    e.anim += dt * (e.ai === "persigue" ? 1.4 : 0.6);
  e.subT = (e.subT ?? 0) + dt;
  if (p && !e.aggro && g.state === "play") {
    const nightMult = isNightG(g) ? 1.3 : 1;
    if (dist(e.x, e.y, p.x, p.y) < def.aggroR * nightMult) {
      e.aggro = true;
      if (e.etype !== "sirena" && e.etype !== "golem" && e.etype !== T_VULT && e.etype !== T_CORO)
        audio.sfx("blip");
    }
  }
  if (e.ai === "aturdido") {
    const stunT = e.etype === "sirena" ? 2.6 : e.etype === "golem" ? 2.8 : e.etype === T_VULT ? 2 : 1.6;
    if (e.aiT > stunT)
      e.aiT = stunT;
    if (e.etype === T_CORO && !m.maskRoto) {
      m.maskRoto = true;
      e.aiT = 1.4;
      caeMascara(g, e, m, true);
    }
    e.aiT -= dt;
    e.moving = false;
    e.windup = 0;
    if (e.etype === "sirena") {
      for (let i = 0;i < 2; i++) {
        g.particles.push({
          x: e.x + (Math.random() - 0.5) * 16,
          y: e.y - 4 - Math.random() * 10,
          vx: (Math.random() - 0.5) * 18,
          vy: -26 - Math.random() * 18,
          t: 0.55,
          maxT: 0.55,
          color: "#ffe9a0",
          size: 1.6,
          grav: 0
        });
      }
    } else if (e.etype === "golem") {
      for (let i = 0;i < 2; i++) {
        g.particles.push({
          x: e.x + (Math.random() - 0.5) * 20,
          y: e.y - 10 - Math.random() * 8,
          vx: (Math.random() - 0.5) * 14,
          vy: 8 + Math.random() * 14,
          t: 0.5,
          maxT: 0.5,
          color: "#cfe8ff",
          size: 1.6,
          grav: 260
        });
      }
    }
    if (e.aiT <= 0) {
      e.ai = "persigue";
      if (e.maxSta > 0)
        e.sta = e.maxSta;
      if (e.etype === T_CORO)
        m.maskRoto = false;
    }
    return true;
  }
  return false;
}
function contactHit(g, e, def, m) {
  if (m.dashHit)
    return;
  const p = g.player;
  if (!p)
    return;
  if (dist(e.x, e.y, p.x, p.y) < 8 + e.w / 2 + 4) {
    m.dashHit = true;
    g.damagePlayer(def.dmg, e.x, e.y);
  }
}
function idleFloat(g, e, dt) {
  e.moving = false;
  e.anim += dt * 0.4;
}
function tickNeumo(g, e, dt, def, m) {
  if (commonTick(g, e, dt, def, m))
    return true;
  const st = e.subT ?? 0;
  const p = g.player;
  if (!p) {
    idleFloat(g, e, dt);
    return true;
  }
  const d = dist(e.x, e.y, p.x, p.y);
  if (e.aggro && e.ai !== "huye" && e.ai !== "carga" && d < 40) {
    e.ai = "huye";
    e.aiT = 1.5;
  }
  switch (e.ai) {
    case "huye": {
      e.aiT -= dt;
      const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.sin(st * 5) * 0.6;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 1.25, dt);
      if (e.aiT <= 0)
        e.ai = e.aggro ? "persigue" : "patrulla";
      break;
    }
    case "patrulla": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 1.5 + Math.random() * 1.5;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 60;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      const drift = Math.sin(st * 2) * 8;
      const tx = Math.cos(ang) * 20 + Math.cos(ang + Math.PI / 2) * drift * 0.4;
      const ty = Math.sin(ang) * 20 + Math.sin(ang + Math.PI / 2) * drift * 0.4;
      g.moveEntity(e, tx * dt, ty * dt);
      e.moving = true;
      e.dir = tx > 0 ? "right" : "left";
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue":
    case "recupera": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      if (d > def.aggroR * 2.6) {
        e.aggro = false;
        e.ai = "patrulla";
        break;
      }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d < 80)
        moveDir(g, e, -Math.cos(ang), -Math.sin(ang), def.speed, dt);
      else if (d > 140)
        moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else {
        const tang = ang + Math.PI / 2;
        const s = Math.sin(st * 1.4);
        moveDir(g, e, Math.cos(tang) * s, Math.sin(tang) * s, def.speed * 0.6, dt);
      }
      e.dir = p.x > e.x ? "right" : "left";
      if (e.ai === "recupera") {
        e.aiT -= dt;
        if (e.aiT > 0)
          break;
        e.ai = "persigue";
      }
      if (e.atkCd <= 0 && d < def.atkR) {
        e.ai = "carga";
        e.windup = def.windup;
      }
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.windup <= 0) {
        const dx = p.x - e.x, dy = p.y - 4 - e.y;
        const base = Math.atan2(dy, dx);
        const agoniza = e.hp < e.maxHp * 0.35;
        const offs = agoniza ? [-0.2618, 0, 0.2618] : [0];
        for (const off of offs) {
          g.projectiles.push({
            x: e.x,
            y: e.y - 2,
            vx: Math.cos(base + off) * 120,
            vy: Math.sin(base + off) * 120,
            t: 1.8,
            dmg: def.dmg,
            element: "ninguno",
            from: "enemy",
            sprite: "orb",
            radius: 5,
            pierce: 0
          });
        }
        audio.sfx("splash");
        e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
        e.ai = "recupera";
        e.aiT = 0.4;
      }
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}
function tickEspectro(g, e, dt, def, m) {
  if (commonTick(g, e, dt, def, m))
    return true;
  const p = g.player;
  if (!p) {
    idleFloat(g, e, dt);
    return true;
  }
  const d = dist(e.x, e.y, p.x, p.y);
  if (m.freshHit && (e.invulT ?? 0) <= 0) {
    e.invulT = 0.9;
    for (let i = 0;i < 3; i++) {
      g.particles.push({
        x: e.x + (i - 1) * 5,
        y: e.y - 4 - i * 3,
        vx: (Math.random() - 0.5) * 24,
        vy: -16 - Math.random() * 16,
        t: 0.5,
        maxT: 0.5,
        color: "#c9d4e4",
        size: 2,
        grav: -8
      });
    }
    audio.sfx("shadow");
  }
  switch (e.ai) {
    case "patrulla": {
      if ((m.pauseT ?? 0) > 0) {
        m.pauseT = (m.pauseT ?? 0) - dt;
        e.moving = false;
        if (Math.random() < 0.06) {
          g.particles.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y - 8, vx: 0, vy: -12, t: 0.7, maxT: 0.7, color: "#c9d4e4", size: 1.5, grav: -4 });
        }
        break;
      }
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 1.6 + Math.random() * 2;
        e.patrolAngle = Math.random() * Math.PI * 2;
        if (Math.random() < 0.45) {
          m.pauseT = 1 + Math.random();
          break;
        }
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 60;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.45, dt);
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      if (d > def.aggroR * 2.4) {
        e.aggro = false;
        e.ai = "patrulla";
        break;
      }
      if (d > 18)
        moveDir(g, e, p.x - e.x, p.y - e.y, def.speed, dt);
      else
        e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.atkCd <= 0 && d < 58) {
        e.ai = "carga";
        e.windup = def.windup;
      }
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.windup <= 0) {
        const l = Math.max(1, d);
        m.dashDx = (p.x - e.x) / l;
        m.dashDy = (p.y - 4 - e.y) / l;
        m.dashHit = false;
        e.ai = "ataca";
        e.aiT = 0.35;
        audio.sfx("whoosh");
      }
      break;
    }
    case "ataca": {
      e.aiT -= dt;
      g.moveEntity(e, m.dashDx * def.speed * 3 * dt, m.dashDy * def.speed * 3 * dt);
      e.moving = true;
      if (Math.random() < 0.4) {
        g.particles.push({ x: e.x, y: e.y - 4, vx: 0, vy: -6, t: 0.3, maxT: 0.3, color: "#c9d4e4", size: 2, grav: 0 });
      }
      contactHit(g, e, def, m);
      if (e.aiT <= 0) {
        e.ai = "recupera";
        e.aiT = 0.5;
        e.atkCd = def.atkCd * (0.85 + Math.random() * 0.3);
      }
      break;
    }
    case "recupera": {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0)
        e.ai = "persigue";
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}
function tickArpi(g, e, dt, def, m) {
  if (commonTick(g, e, dt, def, m))
    return true;
  const st = e.subT ?? 0;
  const p = g.player;
  if (!p) {
    idleFloat(g, e, dt);
    return true;
  }
  const d = dist(e.x, e.y, p.x, p.y);
  if (e.aggro && e.ai !== "huye" && e.hp < e.maxHp * 0.3) {
    e.ai = "huye";
    e.aiT = 2.5;
  }
  switch (e.ai) {
    case "huye": {
      e.aiT -= dt;
      const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.sin(st * 6) * 0.7;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 1.35, dt);
      if (e.aiT <= 0)
        e.ai = "persigue";
      break;
    }
    case "patrulla": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 1.2 + Math.random() * 1.6;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 70;
      const wob = Math.sin(st * 3) * 0.4;
      const base = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(base + wob), Math.sin(base + wob), def.speed * 0.55, dt);
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      if (d > def.aggroR * 2.4) {
        e.aggro = false;
        e.ai = "patrulla";
        break;
      }
      if (m.orbitDir === undefined)
        m.orbitDir = e.patrolAngle > Math.PI ? -1 : 1;
      if (Math.random() < 0.002)
        m.orbitDir *= -1;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      const corr = Math.max(-1, Math.min(1, (d - 75) / 26));
      const tang = ang + Math.PI / 2 * m.orbitDir;
      const vx = Math.cos(tang) * def.speed - Math.cos(ang) * corr * def.speed * 0.95;
      const vy = Math.sin(tang) * def.speed - Math.sin(ang) * corr * def.speed * 0.95;
      g.moveEntity(e, vx * dt, vy * dt);
      e.moving = true;
      e.dir = vx > 0 ? "right" : "left";
      const packT = g.globalT - lastDiveT;
      if ((st >= 2.5 || packT < 0.4) && d < 150 && d > 30) {
        e.subT = 0;
        lastDiveT = g.globalT;
        e.ai = "carga";
        e.windup = def.windup;
      }
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.windup <= 0) {
        const l = Math.max(1, d);
        m.dashDx = (p.x - e.x) / l;
        m.dashDy = (p.y - 4 - e.y) / l;
        m.dashHit = false;
        e.ai = "ataca";
        e.aiT = 0.45;
        audio.sfx("whoosh");
      }
      break;
    }
    case "ataca": {
      e.aiT -= dt;
      g.moveEntity(e, m.dashDx * 240 * dt, m.dashDy * 240 * dt);
      e.moving = true;
      if (Math.random() < 0.5) {
        g.particles.push({
          x: e.x - m.dashDx * 6,
          y: e.y - m.dashDy * 6,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          t: 0.3,
          maxT: 0.3,
          color: "#e8f4fc",
          size: 1.5,
          grav: 0
        });
      }
      contactHit(g, e, def, m);
      if (e.aiT <= 0) {
        e.ai = "recupera";
        e.aiT = 0.8;
      }
      break;
    }
    case "recupera": {
      e.aiT -= dt;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.9, dt);
      if (e.aiT <= 0) {
        e.ai = "persigue";
        e.atkCd = def.atkCd * (0.85 + Math.random() * 0.3);
      }
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}
function pushNota(g, x, y, vx, vy) {
  g.projectiles.push({
    x,
    y,
    vx,
    vy,
    t: 2,
    dmg: 10,
    element: "hielo",
    from: "enemy",
    sprite: "nota",
    radius: 5,
    pierce: 0
  });
}
function fireNotas(g, e, p, m) {
  const base = Math.atan2(p.y - 4 - e.y, p.x - e.x);
  if (m.pendingSalva === 0) {
    for (let i = 0;i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      pushNota(g, e.x, e.y - 4, Math.cos(a) * 120, Math.sin(a) * 120);
    }
    for (let i = 0;i < 3; i++) {
      const a = base + (i / 2 - 0.5) * 0.52;
      pushNota(g, e.x, e.y - 4, Math.cos(a) * 145, Math.sin(a) * 145);
    }
    audio.sfx("holy");
    audio.sfx("ice");
    addFlash(g, "#8ef0ff");
    requestSlowmo(g, 0.15);
  } else {
    const n = m.pendingSalva ?? 3;
    for (let i = 0;i < n; i++) {
      const a = base + (i / (n - 1) - 0.5) * 0.7;
      pushNota(g, e.x, e.y - 4, Math.cos(a) * 130, Math.sin(a) * 130);
    }
    audio.sfx("ice");
  }
  m.pendingSalva = 0;
}
function summonNeumo(g, e, fase, m) {
  const cap = fase === 3 ? 3 : 2;
  const vivos = g.enemies.filter((o) => !o.dead && o.etype === "neumo").length;
  if (vivos >= cap) {
    e.sumT = 4;
    return;
  }
  for (let i = 0;i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + e.patrolAngle;
    const x = e.x + Math.cos(a) * 26, y = e.y + Math.sin(a) * 26;
    if (!g.tileSolidAt(x, y)) {
      const s = g.makeEnemy("neumo", x, y, 1, "boss");
      s.aggro = true;
      g.enemies.push(s);
      g.burst(x, y, "#8ef0ff", 14, 70);
      g.floatAt(s.x, s.y - 18, "¡un neumo emerge!", "#8ef0ff", 7);
      audio.sfx("splash");
      e.sumT = fase === 3 ? 15 : fase === 2 ? 10 : 12;
      m.lastAtkCd = e.atkCd;
      return;
    }
  }
  e.sumT = 3;
}
function teleportSirena(g, e, p, m) {
  m.tpT = 0;
  g.burst(e.x, e.y, "#8ef0ff", 16, 80);
  audio.sfx("splash");
  audio.sfx("whoosh");
  e.invulT = 0.6;
  const baseAng = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI;
  const radii = [135, 120, 150, 128, 142];
  const jit = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2];
  for (const rr of radii) {
    for (const j of jit) {
      const a = baseAng + j;
      const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
      if (!g.tileSolidAt(x, y)) {
        e.x = x;
        e.y = y;
        g.burst(x, y, "#8ef0ff", 16, 80);
        return;
      }
    }
  }
}
function tickSirena(g, e, dt, def, m) {
  if (e.hp <= 0 && !e.dead) {
    deathSirena(g, e);
    return true;
  }
  if (commonTick(g, e, dt, def, m))
    return true;
  const p = g.player;
  if (!p) {
    idleFloat(g, e, dt);
    return true;
  }
  const d = dist(e.x, e.y, p.x, p.y);
  if (e.aggro && !g.flags.sirenaIntro) {
    g.flags.sirenaIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = "SIRENA ABISAL";
    g.bossBannerSub = "La que olvidó su nombre";
    addFlash(g, "#8ef0ff", 0.25);
    addShake(g, 4);
    audio.sfx("banner");
    e.sumT = 12;
    g.toast("La Sirena Abisal alza su canto entre la bruma", "#8ef0ff");
  }
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
  if (newPhase > e.phase) {
    e.phase = newPhase;
    addFlash(g, newPhase === 3 ? "#b48fff" : "#8ef0ff", 0.2);
    addShake(g, 5);
    requestSlowmo(g, 0.2);
    audio.sfx("roar");
    g.toast(`La Sirena cambia de fase (${e.phase}/3)`, "#8ef0ff");
    e.windup = 0;
    m.pendingSalva = 0;
    if (e.ai === "carga")
      e.ai = "persigue";
    if (e.phase === 2) {
      m.tpT = 0;
      e.sumT = Math.min(e.sumT, 10);
    }
  }
  switch (e.ai) {
    case "patrulla": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 2 + Math.random() * 2;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 50;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.4, dt);
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      let minD = 90, maxD = 140;
      if (e.phase === 2) {
        minD = 100;
        maxD = 150;
      }
      if (e.phase === 3) {
        minD = 60;
        maxD = 100;
      }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > maxD)
        moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else if (d < minD)
        moveDir(g, e, -Math.cos(ang), -Math.sin(ang), def.speed, dt);
      else {
        if (m.orbitDir === undefined)
          m.orbitDir = 1;
        if (Math.random() < 0.003)
          m.orbitDir *= -1;
        const tang = ang + Math.PI / 2 * m.orbitDir;
        moveDir(g, e, Math.cos(tang), Math.sin(tang), def.speed * (e.phase === 3 ? 0.55 : 0.5), dt);
      }
      e.dir = p.x > e.x ? "right" : "left";
      if (e.atkCd <= 0) {
        e.ai = "carga";
        m.pendingSalva = e.phase === 3 ? 0 : e.phase === 2 ? 4 : 3;
        if (e.phase < 3) {
          e.windup = 0.55;
          e.telegraphKind = "aro";
          g.telegraphs.push({ x: e.x, y: e.y, r: 26, t: 0.55, maxT: 0.55, dmg: def.dmg, kind: "aro" });
        } else {
          e.windup = 1;
          e.telegraphKind = "aro";
          g.telegraphs.push({ x: e.x, y: e.y, r: 70, t: 1, maxT: 1, dmg: def.dmg, kind: "aro" });
        }
      }
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.windup <= 0) {
        e.telegraphKind = undefined;
        fireNotas(g, e, p, m);
        e.atkCd = (e.phase === 3 ? 2.2 : 2) * (0.9 + Math.random() * 0.2);
        e.ai = "recupera";
        e.aiT = 0.35;
      }
      break;
    }
    case "recupera": {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0)
        e.ai = "persigue";
      break;
    }
    default:
      break;
  }
  if (e.aggro && e.ai !== "carga" && d < 50) {
    moveDir(g, e, e.x - p.x, e.y - p.y, def.speed * 0.85, dt);
  }
  if (e.aggro) {
    e.sumT -= dt;
    if (e.sumT <= 0)
      summonNeumo(g, e, e.phase, m);
  }
  if (e.aggro && e.phase === 2) {
    m.tpT = (m.tpT ?? 0) + dt;
    if (m.tpT >= 6)
      teleportSirena(g, e, p, m);
  }
  if (e.aggro && e.phase === 2) {
    m.mareaT = (m.mareaT ?? 0) + dt;
    if (m.mareaT >= 9) {
      m.mareaT = 0;
      g.waves.push({ x: e.x, y: e.y, r: 0, maxR: 80, speed: 200, dmg: 10, hit: false });
      g.waves.push({ x: e.x, y: e.y, r: 12, maxR: 80, speed: 200, dmg: 10, hit: false });
      addShake(g, 4);
      audio.sfx("splash");
    }
  }
  m.lastAtkCd = e.atkCd;
  return true;
}
function ventisca(g, e, p, def) {
  audio.sfx("gust");
  audio.sfx("ice");
  const spots = [
    [p.x - 9, p.y],
    [p.x + 9, p.y]
  ];
  const pv = getPortadorVel();
  const fx = p.x + Math.max(-60, Math.min(60, pv.x * 0.5));
  const fy = p.y + Math.max(-60, Math.min(60, pv.y * 0.5));
  spots.push([fx - 9, fy - 4], [fx + 9, fy + 4]);
  for (const [sx, sy] of spots) {
    g.telegraphs.push({ x: sx, y: sy, r: 22, t: 0.85, maxT: 0.85, dmg: def.dmg, kind: "aro" });
    g.waves.push({ x: sx, y: sy, r: 2, maxR: 26, speed: 90, dmg: 0, hit: true });
  }
}
function tickGolem(g, e, dt, def, m) {
  if (e.hp <= 0 && !e.dead) {
    deathGolem(g, e);
    return true;
  }
  if (commonTick(g, e, dt, def, m))
    return true;
  const p = g.player;
  if (!p) {
    idleFloat(g, e, dt);
    return true;
  }
  const d = dist(e.x, e.y, p.x, p.y);
  if (e.aggro && !g.flags.golemIntro) {
    g.flags.golemIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = "GÓLEM DE ESCARCHA";
    g.bossBannerSub = "Memoria de la montaña";
    addFlash(g, "#a8d8ff", 0.25);
    addShake(g, 4);
    audio.sfx("banner");
    g.toast("El Gólem de Escarcha despierta en el paso", "#a8d8ff");
  }
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.5 ? 1 : 2;
  if (newPhase > e.phase) {
    e.phase = newPhase;
    addFlash(g, "#a8d8ff", 0.22);
    addShake(g, 5);
    requestSlowmo(g, 0.25);
    audio.sfx("roar");
    g.toast(`El hielo del Gólem se agrieta (${e.phase}/2)`, "#a8d8ff");
    m.ventT = 0;
    m.actIdx = 0;
    if (e.ai === "carga")
      e.ai = "persigue";
  }
  if ((m.slamPend ?? 0) > 0) {
    m.slamPend = (m.slamPend ?? 0) - dt;
    if ((m.slamPend ?? 0) <= 0) {
      g.waves.push({ x: e.x, y: e.y, r: 0, maxR: 70, speed: 220, dmg: 0, hit: true });
      m.frostT = 1;
    }
  }
  if ((m.frostT ?? 0) > 0) {
    m.frostT = (m.frostT ?? 0) - dt;
    for (let i = 0;i < 4; i++) {
      const ft = 0.3 + Math.random() * 0.15;
      g.particles.push({
        x: e.x + (Math.random() - 0.5) * 40,
        y: e.y - 12 - Math.random() * 10,
        vx: (Math.random() - 0.5) * 24,
        vy: 24 + Math.random() * 26,
        t: ft,
        maxT: ft,
        color: "#a8d8ff",
        size: 1.5,
        grav: 300
      });
    }
  }
  if (e.aggro && e.phase === 2 && e.ai !== "carga") {
    m.ventT = (m.ventT ?? 0) + dt;
    if (m.ventT >= 7) {
      m.ventT = 0;
      ventisca(g, e, p, def);
    }
  }
  if (e.aggro && e.phase === 2 && e.ai !== "carga") {
    m.corazonT = (m.corazonT ?? 0) + dt;
    if (m.corazonT >= 11) {
      m.corazonT = 0;
      g.telegraphs.push({ x: e.x, y: e.y, r: 30, t: 0.7, maxT: 0.7, dmg: def.dmg, kind: "slam" });
      for (let i = 0;i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        g.projectiles.push({
          x: e.x,
          y: e.y - 6,
          vx: Math.cos(a) * 120,
          vy: Math.sin(a) * 120,
          t: 1.7,
          dmg: 12,
          element: "hielo",
          from: "enemy",
          sprite: "shard",
          radius: 5,
          pierce: 0
        });
      }
      audio.sfx("ice");
    }
  }
  switch (e.ai) {
    case "patrulla": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 2.5 + Math.random() * 2.5;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 40;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.4, dt);
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      if (d > def.aggroR * 2.4) {
        e.aggro = false;
        e.ai = "patrulla";
        break;
      }
      if (d > def.atkR * 0.8)
        moveDir(g, e, p.x - e.x, p.y - e.y, def.speed, dt);
      else
        e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.atkCd <= 0 && d < def.aggroR) {
        m.actIdx = (m.actIdx ?? 0) + 1;
        m.act = e.phase === 1 ? m.actIdx % 2 === 1 ? "slam" : "lanza" : ["slam", "embiste", "lanza"][m.actIdx % 3];
        e.ai = "carga";
        e.windup = m.act === "embiste" ? 0.7 : def.windup;
        e.telegraphKind = m.act === "slam" ? "slam" : "salva";
        if (m.act === "slam") {
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          g.telegraphs.push({
            x: e.x + Math.cos(a) * 26,
            y: e.y + Math.sin(a) * 26,
            r: 44,
            t: 0.9,
            maxT: 0.9,
            dmg: def.dmg,
            kind: "slam"
          });
          m.slamPend = 0.9;
        }
      }
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.windup <= 0) {
        e.telegraphKind = undefined;
        if (m.act === "lanza") {
          const a = Math.atan2(p.y - 4 - e.y, p.x - e.x);
          for (const off of [-0.13, 0.13]) {
            g.projectiles.push({
              x: e.x,
              y: e.y - 6,
              vx: Math.cos(a + off) * 150,
              vy: Math.sin(a + off) * 150,
              t: 1.7,
              dmg: 12,
              element: "hielo",
              from: "enemy",
              sprite: "shard",
              radius: 5,
              pierce: 0
            });
          }
          audio.sfx("ice");
          e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
          e.ai = "recupera";
          e.aiT = 0.5;
        } else if (m.act === "embiste") {
          const l = Math.max(1, d);
          m.dashDx = (p.x - e.x) / l;
          m.dashDy = (p.y - e.y) / l;
          m.dashHit = false;
          e.ai = "ataca";
          e.aiT = 0.9;
          audio.sfx("whoosh");
        } else {
          e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
          e.ai = "recupera";
          e.aiT = 0.55;
        }
      }
      break;
    }
    case "ataca": {
      e.aiT -= dt;
      const stepX = m.dashDx * 180 * dt;
      const stepY = m.dashDy * 180 * dt;
      const freeX = g.boxFree(e.x + stepX, e.y, e.w, e.h);
      const freeY = g.boxFree(e.x, e.y + stepY, e.w, e.h);
      if (!freeX && !freeY) {
        addShake(g, 3);
        g.burst(e.x, e.y, "#dceef8", 12, 60);
        e.ai = "recupera";
        e.aiT = 0.6;
        e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
        break;
      }
      g.moveEntity(e, stepX, stepY);
      e.moving = true;
      for (let i = 0;i < 6; i++) {
        g.particles.push({
          x: e.x - m.dashDx * 8 + (Math.random() - 0.5) * 14,
          y: e.y - m.dashDy * 8 + 4 + (Math.random() - 0.5) * 6,
          vx: -m.dashDx * 26 + (Math.random() - 0.5) * 18,
          vy: -12 - Math.random() * 16,
          t: 0.32,
          maxT: 0.32,
          color: "#ffffff",
          size: 1.6,
          grav: 40
        });
      }
      contactHit(g, e, def, m);
      if (e.aiT <= 0) {
        e.ai = "recupera";
        e.aiT = 0.6;
        e.atkCd = def.atkCd * (0.9 + Math.random() * 0.2);
      }
      break;
    }
    case "recupera": {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0)
        e.ai = e.aggro ? "persigue" : "patrulla";
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}
var deathFxVisto = new WeakSet;
function deathSirena(g, e) {
  if (deathFxVisto.has(e))
    return;
  deathFxVisto.add(e);
  for (let i = 0;i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const t = 0.55 + i % 3 * 0.1;
    g.particles.push({
      x: e.x + Math.cos(a) * 6,
      y: e.y - 4 + Math.sin(a) * 4,
      vx: Math.cos(a) * 55 - Math.sin(a) * 42,
      vy: Math.sin(a) * 30 + Math.cos(a) * 42 - 26,
      t,
      maxT: t,
      color: "#8ef0ff",
      size: 2,
      grav: -20
    });
  }
  requestSlowmo(g, 0.3);
}
function deathGolem(g, e) {
  if (deathFxVisto.has(e))
    return;
  deathFxVisto.add(e);
  for (let i = 0;i < 20; i++) {
    const a = i / 20 * Math.PI * 2 + 0.2;
    const spd = 60 + i % 4 * 18;
    const t = 0.6 + i % 5 * 0.08;
    g.particles.push({
      x: e.x + Math.cos(a) * 8,
      y: e.y - 2 + Math.sin(a) * 5,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd * 0.5 - 20,
      t,
      maxT: t,
      color: "#ffffff",
      size: 2,
      grav: 60
    });
  }
  addShake(g, 8);
}
function pushDaga(g, x, y, vx, vy) {
  g.projectiles.push({
    x,
    y,
    vx,
    vy,
    t: 1.5,
    dmg: 11,
    element: "sombra",
    from: "enemy",
    sprite: "shard",
    radius: 4,
    pierce: 0
  });
}
function fireRafaga(g, e, p) {
  const base = Math.atan2(p.y - 4 - e.y, p.x - e.x);
  const n = e.phase >= 3 ? 9 : e.phase === 2 ? 7 : 5;
  for (let i = 0;i < n; i++) {
    const a = base + (i / (n - 1) - 0.5) * 0.9;
    pushDaga(g, e.x, e.y - 4, Math.cos(a) * 175, Math.sin(a) * 175);
  }
  audio.sfx("whoosh");
}
function acechoVult(g, e, p, m) {
  m.acechoCd = 0;
  g.burst(e.x, e.y, "#c8b0e8", 18, 90);
  audio.sfx("whoosh");
  e.invulT = 0.9;
  const ang = Math.atan2(p.y - e.y, p.x - e.x);
  for (const dd of [55, 42, 68, 30, 80]) {
    const x = p.x + Math.cos(ang) * dd, y = p.y + Math.sin(ang) * dd;
    if (!g.tileSolidAt(x, y)) {
      e.x = x;
      e.y = y;
      break;
    }
  }
  g.burst(e.x, e.y, "#c8b0e8", 18, 90);
  e.atkCd = 0.35;
  g.floatAt(e.x, e.y - 22, "¡ACECHO!", "#c8b0e8", 8);
  m.lastAtkCd = e.atkCd;
}
function tickVult(g, e, dt, def, m) {
  if (e.hp <= 0 && !e.dead) {
    deathVult(g, e);
    return true;
  }
  if (commonTick(g, e, dt, def, m))
    return true;
  const p = g.player;
  if (!p) {
    idleFloat(g, e, dt);
    return true;
  }
  const d = dist(e.x, e.y, p.x, p.y);
  if (e.aggro && !g.flags.vultIntro) {
    g.flags.vultIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = "VULT, EL CAZADOR DE ECOS";
    g.bossBannerSub = "El mapa de tus pasos es su contrato";
    addFlash(g, "#c8b0e8", 0.25);
    addShake(g, 4);
    audio.sfx("banner");
    g.toast("Un mapa se despliega en la niebla: Vult ha encontrado tus pasos", "#c8b0e8");
  }
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
  if (newPhase > e.phase) {
    e.phase = newPhase;
    addFlash(g, "#c8b0e8", 0.2);
    addShake(g, 5);
    requestSlowmo(g, 0.2);
    audio.sfx("roar");
    g.toast(e.phase === 3 ? "Vult entra en MODO ACECHO: no parpadees" : `Vult se enfurece (${e.phase}/3)`, "#c8b0e8");
    e.windup = 0;
    if (e.ai === "carga")
      e.ai = "persigue";
  }
  if (e.aggro && e.phase === 3 && e.ai !== "carga") {
    m.acechoCd = (m.acechoCd ?? 0) + dt;
    if (m.acechoCd >= 8)
      acechoVult(g, e, p, m);
  }
  const spd = def.speed * (isNightG(g) ? 1.1 : 1);
  switch (e.ai) {
    case "patrulla": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 2 + Math.random() * 2;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 50;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), spd * 0.4, dt);
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 120)
        moveDir(g, e, Math.cos(ang), Math.sin(ang), spd, dt);
      else if (d < 70)
        moveDir(g, e, -Math.cos(ang), -Math.sin(ang), spd, dt);
      e.dir = p.x > e.x ? "right" : "left";
      if (e.atkCd <= 0) {
        if (d < def.atkR + 10) {
          e.ai = "carga";
          m.vAct = "tajo";
          e.windup = 0.35;
          e.telegraphKind = "aro";
          g.telegraphs.push({ x: e.x, y: e.y, r: 34, t: 0.35, maxT: 0.35, dmg: 12, kind: "aro" });
        } else {
          const ciclo = ["rafaga", "embiste", "salto"];
          m.vIdx = ((m.vIdx ?? -1) + 1) % 3;
          m.vAct = ciclo[m.vIdx];
          e.ai = "carga";
          if (m.vAct === "rafaga") {
            e.windup = 0.5;
            e.telegraphKind = undefined;
          } else if (m.vAct === "embiste") {
            e.windup = 0.42;
            e.telegraphKind = "onda";
          } else {
            const v = getPortadorVel();
            const tx = p.x + v.x * 0.35, ty = p.y + v.y * 0.35;
            m.saltoX = tx;
            m.saltoY = ty;
            e.windup = 0.75;
            e.telegraphKind = "slam";
            e.invulT = Math.max(e.invulT ?? 0, 0.75);
            g.telegraphs.push({ x: tx, y: ty, r: 44, t: 0.75, maxT: 0.75, dmg: 13, kind: "slam" });
            audio.sfx("whoosh");
          }
        }
      }
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.windup <= 0) {
        e.telegraphKind = undefined;
        if (m.vAct === "rafaga") {
          fireRafaga(g, e, p);
          e.atkCd = 1.7 * (0.9 + Math.random() * 0.2);
          e.ai = "recupera";
          e.aiT = 0.3;
        } else if (m.vAct === "embiste") {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          m.dashDx = Math.cos(ang);
          m.dashDy = Math.sin(ang);
          m.dashHit = false;
          e.ai = "ataca";
          e.aiT = 0.5;
          audio.sfx("whoosh");
        } else if (m.vAct === "salto") {
          if (m.saltoX !== undefined && m.saltoY !== undefined) {
            e.x = m.saltoX;
            e.y = m.saltoY;
          }
          g.waves.push({ x: e.x, y: e.y, r: 0, maxR: 54, speed: 210, dmg: 13, hit: false });
          g.burst(e.x, e.y, "#c8b0e8", 14, 80);
          addShake(g, 5);
          audio.sfx("roar");
          e.atkCd = 1.8;
          e.ai = "recupera";
          e.aiT = 0.4;
        } else {
          pushDaga(g, e.x, e.y - 4, (p.x - e.x) * 1.4, (p.y - e.y) * 1.4);
          e.atkCd = 1.2;
          e.ai = "recupera";
          e.aiT = 0.3;
        }
      }
      break;
    }
    case "ataca": {
      e.aiT -= dt;
      g.moveEntity(e, (m.dashDx ?? 0) * 265 * dt, (m.dashDy ?? 0) * 265 * dt);
      e.moving = true;
      g.particles.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y + (Math.random() - 0.5) * 6, vx: 0, vy: -8, t: 0.35, maxT: 0.35, color: "#c8b0e8", size: 1.6, grav: 0 });
      contactHit(g, e, def, m);
      if (g.tileSolidAt(e.x + (m.dashDx ?? 0) * 10, e.y + (m.dashDy ?? 0) * 10)) {
        e.aiT = 0;
        addShake(g, 3);
      }
      if (e.aiT <= 0) {
        e.ai = "recupera";
        e.aiT = 0.35;
        e.atkCd = 1.6;
      }
      break;
    }
    case "recupera": {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0)
        e.ai = "persigue";
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}
var MASCARA_INFO = {
  1: { nombre: "EL PULSO", color: "#7ee8ff" },
  2: { nombre: "EL VERA", color: "#ffe9a0" },
  3: { nombre: "EL SILENCIO", color: "#b48fff" }
};
function caeMascara(g, e, m, _primera) {
  m.maskIdx = (m.maskIdx ?? 1) % 3 + 1;
  e.sprite = `coro${m.maskIdx}`;
  const info = MASCARA_INFO[m.maskIdx] ?? MASCARA_INFO[1];
  g.burst(e.x, e.y - 6, "#c8b0e8", 26, 110);
  addFlash(g, info.color, 0.22);
  addShake(g, 6);
  audio.sfx("holy");
  audio.sfx("roar");
  g.floatAt(e.x, e.y - 26, "¡cae la máscara!", info.color, 8);
  g.toast(`El Coro Roto muestra su siguiente máscara: ${info.nombre}`, info.color);
  e.atkCd = 1;
  m.coroT = 0;
  m.lastAtkCd = e.atkCd;
}
function cantaMascara(g, e, p, m) {
  const maskIdx = m.maskIdx ?? 1;
  if (maskIdx === 1) {
    for (let i = 0;i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + (m.coroRot ?? 0) * 0.4;
      g.projectiles.push({
        x: e.x + Math.cos(a) * 12,
        y: e.y - 4 + Math.sin(a) * 12,
        vx: Math.cos(a) * 88,
        vy: Math.sin(a) * 88,
        t: 2.6,
        dmg: 11,
        element: "sombra",
        from: "enemy",
        sprite: "orb",
        radius: 5.5,
        pierce: 0
      });
    }
    g.waves.push({ x: e.x, y: e.y, r: 0, maxR: 64, speed: 160, dmg: 12, hit: false });
    audio.sfx("holy");
    addShake(g, 3);
  } else if (maskIdx === 2) {
    m.coroRot = ((m.coroRot ?? 0) + 1) % 2;
    const baseA = (m.coroRot ?? 0) === 1 ? Math.PI / 4 : 0;
    for (let k = 0;k < 4; k++) {
      const a = baseA + k / 4 * Math.PI * 2;
      for (let j = 1;j <= 3; j++) {
        const rr = 12 * j;
        g.projectiles.push({
          x: e.x + Math.cos(a) * rr,
          y: e.y - 4 + Math.sin(a) * rr,
          vx: Math.cos(a) * 150,
          vy: Math.sin(a) * 150,
          t: 1.6,
          dmg: 11,
          element: "sombra",
          from: "enemy",
          sprite: "nota",
          radius: 4.5,
          pierce: 0
        });
      }
    }
    audio.sfx("ice");
    addFlash(g, "#ffe9a0", 0.12);
  } else {
    const base = Math.atan2(p.y - 4 - e.y, p.x - e.x);
    for (let i = 0;i < 3; i++) {
      const a = base + (i / 2 - 0.5) * 0.5;
      g.projectiles.push({
        x: e.x,
        y: e.y - 4,
        vx: Math.cos(a) * 135,
        vy: Math.sin(a) * 135,
        t: 1.8,
        dmg: 10,
        element: "sombra",
        from: "enemy",
        sprite: "nota",
        radius: 4.5,
        pierce: 0
      });
    }
    audio.sfx("whoosh");
  }
}
function tickCoro(g, e, dt, def, m) {
  if (e.hp <= 0 && !e.dead) {
    deathCoro(g, e);
    return true;
  }
  if (commonTick(g, e, dt, def, m))
    return true;
  const p = g.player;
  if (!p) {
    idleFloat(g, e, dt);
    return true;
  }
  const d = dist(e.x, e.y, p.x, p.y);
  const maskIdx = m.maskIdx ?? 1;
  if (e.aggro && !g.flags.coroIntro) {
    g.flags.coroIntro = true;
    g.bossBannerT = 3.2;
    g.bossBannerText = "EL CORO ROTO";
    g.bossBannerSub = "Tres máscaras, una nota al revés";
    addFlash(g, "#c8b0e8", 0.25);
    addShake(g, 4);
    audio.sfx("banner");
    g.toast("El altar resuena: las tres máscaras giran hacia ti", "#c8b0e8");
  }
  switch (e.ai) {
    case "patrulla": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 2 + Math.random() * 2;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 44;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.35, dt);
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 170)
        moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else if (d < 100)
        moveDir(g, e, -Math.cos(ang), -Math.sin(ang), def.speed, dt);
      else {
        if (m.orbitDir === undefined)
          m.orbitDir = 1;
        if (Math.random() < 0.002)
          m.orbitDir *= -1;
        const tang = ang + Math.PI / 2 * m.orbitDir;
        moveDir(g, e, Math.cos(tang), Math.sin(tang), def.speed * 0.5, dt);
      }
      e.dir = p.x > e.x ? "right" : "left";
      if (maskIdx === 3) {
        m.coroT = (m.coroT ?? 0) + dt;
        if (m.coroT >= 0.22) {
          m.coroT = 0;
          g.projectiles.push({
            x: p.x + (Math.random() - 0.5) * 130,
            y: p.y - 95 + (Math.random() - 0.5) * 30,
            vx: (Math.random() - 0.5) * 14,
            vy: 118,
            t: 1.35,
            dmg: 10,
            element: "sombra",
            from: "enemy",
            sprite: "nota",
            radius: 4.5,
            pierce: 0
          });
          m.lluviaSfx = (m.lluviaSfx ?? 0) + 1;
          if ((m.lluviaSfx ?? 0) % 6 === 0)
            audio.sfx("ice");
        }
      }
      if (e.atkCd <= 0) {
        e.ai = "carga";
        e.windup = 0.7;
        e.telegraphKind = "aro";
        g.telegraphs.push({ x: e.x, y: e.y, r: 40, t: 0.7, maxT: 0.7, dmg: def.dmg, kind: "aro" });
      }
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.windup <= 0) {
        e.telegraphKind = undefined;
        cantaMascara(g, e, p, m);
        e.atkCd = (maskIdx === 3 ? 2.6 : 2.1) * (0.9 + Math.random() * 0.2);
        e.ai = "recupera";
        e.aiT = 0.4;
      }
      break;
    }
    case "recupera": {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0)
        e.ai = "persigue";
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}
function tickEcodesg(g, e, dt, def, m) {
  if (commonTick(g, e, dt, def, m))
    return true;
  const p = g.player;
  if (!p) {
    idleFloat(g, e, dt);
    return true;
  }
  const d = dist(e.x, e.y, p.x, p.y);
  switch (e.ai) {
    case "patrulla": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 1.5 + Math.random() * 1.5;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 40;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.35, dt);
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 90)
        moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      e.dir = p.x > e.x ? "right" : "left";
      if (e.atkCd <= 0 && d < 135) {
        m.blinkSide = (m.blinkSide ?? 1) * -1;
        const fa = ang + Math.PI / 2 * (m.blinkSide ?? 1);
        g.burst(e.x, e.y, "#b48fff", 12, 70);
        audio.sfx("whoosh");
        for (const dd of [42, 34, 52, 26]) {
          const x = p.x + Math.cos(fa) * dd, y = p.y + Math.sin(fa) * dd;
          if (!g.tileSolidAt(x, y)) {
            e.x = x;
            e.y = y;
            break;
          }
        }
        g.burst(e.x, e.y, "#b48fff", 12, 70);
        e.ai = "carga";
        e.windup = 0.3;
      }
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      if (e.windup <= 0) {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        m.dashDx = Math.cos(ang);
        m.dashDy = Math.sin(ang);
        m.dashHit = false;
        e.ai = "ataca";
        e.aiT = 0.32;
        audio.sfx("blip");
      }
      break;
    }
    case "ataca": {
      e.aiT -= dt;
      g.moveEntity(e, (m.dashDx ?? 0) * 215 * dt, (m.dashDy ?? 0) * 215 * dt);
      e.moving = true;
      contactHit(g, e, def, m);
      if (g.tileSolidAt(e.x + (m.dashDx ?? 0) * 8, e.y + (m.dashDy ?? 0) * 8))
        e.aiT = 0;
      if (e.aiT <= 0) {
        e.ai = "recupera";
        e.aiT = 0.55;
        e.atkCd = 1.5;
      }
      break;
    }
    case "recupera": {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0)
        e.ai = "persigue";
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}
function tickSatiro(g, e, dt, def, m) {
  if (commonTick(g, e, dt, def, m))
    return true;
  const p = g.player;
  if (!p) {
    idleFloat(g, e, dt);
    return true;
  }
  const d = dist(e.x, e.y, p.x, p.y);
  switch (e.ai) {
    case "patrulla": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 2 + Math.random() * 2;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 44;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed * 0.4, dt);
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      if (d < 75)
        moveDir(g, e, -Math.cos(ang), -Math.sin(ang), def.speed * 0.95, dt);
      else if (d > 165)
        moveDir(g, e, Math.cos(ang), Math.sin(ang), def.speed, dt);
      else {
        if (m.orbitDir === undefined)
          m.orbitDir = 1;
        if (Math.random() < 0.004)
          m.orbitDir *= -1;
        const tang = ang + Math.PI / 2 * m.orbitDir;
        moveDir(g, e, Math.cos(tang), Math.sin(tang), def.speed * 0.6, dt);
      }
      e.dir = p.x > e.x ? "right" : "left";
      if (e.atkCd <= 0 && d < def.atkR + 20) {
        const v = getPortadorVel();
        const px3 = p.x + v.x * 0.5, py = p.y + v.y * 0.5;
        m.saltoX = px3;
        m.saltoY = py;
        e.ai = "carga";
        e.windup = 0.8;
        e.telegraphKind = "aro";
        g.telegraphs.push({ x: px3, y: py, r: 24, t: 0.8, maxT: 0.8, dmg: 0, kind: "aro" });
      }
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.windup <= 0) {
        e.telegraphKind = undefined;
        if (m.saltoX !== undefined && m.saltoY !== undefined) {
          const a = Math.atan2(m.saltoY - e.y, m.saltoX - e.x);
          const dd = Math.hypot(m.saltoX - e.x, m.saltoY - e.y);
          let ox = e.x, oy = e.y - 6;
          if (g.tileSolidAt(ox, oy))
            oy = e.y;
          if (g.tileSolidAt(ox, oy)) {
            ox = e.x + Math.cos(a) * 10;
            oy = e.y + Math.sin(a) * 10;
          }
          g.projectiles.push({
            x: ox,
            y: oy,
            vx: Math.cos(a) * Math.max(60, dd / 0.8),
            vy: Math.sin(a) * Math.max(60, dd / 0.8),
            t: 1.1,
            dmg: def.dmg,
            element: "ninguno",
            from: "enemy",
            sprite: "orb",
            radius: 4,
            pierce: 0
          });
        }
        audio.sfx("blip");
        e.atkCd = 2.2 * (0.9 + Math.random() * 0.2);
        e.ai = "recupera";
        e.aiT = 0.4;
      }
      break;
    }
    case "recupera": {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0)
        e.ai = "persigue";
      break;
    }
    default:
      break;
  }
  m.lastAtkCd = e.atkCd;
  return true;
}
function deathVult(g, e) {
  if (deathFxVisto.has(e))
    return;
  deathFxVisto.add(e);
  for (let i = 0;i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    g.particles.push({
      x: e.x + Math.cos(a) * 6,
      y: e.y - 6 + Math.sin(a) * 4,
      vx: Math.cos(a) * 70,
      vy: Math.sin(a) * 40 - 30,
      t: 0.6 + i % 3 * 0.1,
      maxT: 0.7,
      color: i % 2 ? "#c8b0e8" : "#f0ead0",
      size: 2,
      grav: 120
    });
  }
  requestSlowmo(g, 0.3);
}
function deathCoro(g, e) {
  if (deathFxVisto.has(e))
    return;
  deathFxVisto.add(e);
  for (let i = 0;i < 15; i++) {
    const a = i / 15 * Math.PI * 2 + 0.3;
    const t = 0.6 + i % 4 * 0.08;
    g.particles.push({
      x: e.x + Math.cos(a) * 8,
      y: e.y - 6 + Math.sin(a) * 5,
      vx: Math.cos(a) * 60,
      vy: Math.sin(a) * 60 - 24,
      t,
      maxT: t,
      color: i % 3 === 0 ? "#7ee8ff" : i % 3 === 1 ? "#ffe9a0" : "#b48fff",
      size: 2.2,
      grav: -14
    });
  }
  addFlash(g, "#c8b0e8", 0.3);
  requestSlowmo(g, 0.35);
}
function expansionDeathFx(g, e) {
  if (e.etype === "sirena")
    deathSirena(g, e);
  else if (e.etype === "golem")
    deathGolem(g, e);
  else if (e.etype === T_VULT)
    deathVult(g, e);
  else if (e.etype === T_CORO)
    deathCoro(g, e);
}
function expansionBossWatchers(g) {
  if (g.state !== "play" || !g.player)
    return;
  const p = g.player;
  const vult = g.mapId === "cumbres" ? g.enemies.find((e) => e.etype === T_VULT && !e.dead) : undefined;
  if (vult && !g.bossActive) {
    g.bossRef = vult;
    if (dist(p.x, p.y, vult.x, vult.y) < 190) {
      g.bossActive = true;
      audio.playTrack("boss");
    }
  }
  const coro = g.mapId === "cripta" ? g.enemies.find((e) => e.etype === T_CORO && !e.dead) : undefined;
  if (coro && !g.bossActive) {
    g.bossRef = coro;
    if (dist(p.x, p.y, coro.x, coro.y) < 190) {
      g.bossActive = true;
      audio.playTrack("boss");
    }
  }
  if (g.mapId === "cumbres" && !g.flags.vultDefeated && !g.enemies.some((e) => e.etype === T_VULT && !e.dead) && g.questIdx >= 11 && isNightG(g)) {
    const v = g.makeEnemy("vult", p.x, p.y, 2, "boss");
    for (let i = 0;i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + g.globalT;
      const x = p.x + Math.cos(a) * 170, y = p.y + Math.sin(a) * 170;
      if (!g.tileSolidAt(x, y)) {
        v.x = x;
        v.y = y;
        v.homeX = x;
        v.homeY = y;
        break;
      }
    }
    v.spawnGuard = 0.2;
    g.enemies.push(v);
    g.burst(v.x, v.y, "#c8b0e8", 20, 90);
    audio.sfx("whoosh");
    g.toast("Las cumbres susurran: hay un cazador en la noche", "#c8b0e8");
  }
  if (g.mapId === "cripta" && g.flags.acto3Done && g.flags.guardianRecordadoDerrotado && !g.flags.coroDefeated && !g.enemies.some((e) => e.etype === T_CORO && !e.dead)) {
    const altar = g.map.props.find((pr) => pr.id === "altar_c");
    const ax = (altar ? altar.x : 19) * 16 + 8;
    const ay = (altar ? altar.y + 4 : 8) * 16 + 8;
    if (dist(p.x, p.y, ax, ay) < 200) {
      const c = g.makeEnemy("coro", ax, ay, 0, "boss");
      g.enemies.push(c);
      g.burst(ax, ay, "#c8b0e8", 24, 100);
      g.shake = 8;
      g.toast("El altar libre canta al revés... EL CORO ROTO despierta", "#c8b0e8");
    }
  }
}
function expansionTick(g, e, dt, def) {
  switch (e.etype) {
    case "neumo":
      return tickNeumo(g, e, dt, def, mem(e));
    case "espectro":
      return tickEspectro(g, e, dt, def, mem(e));
    case "arpi":
      return tickArpi(g, e, dt, def, mem(e));
    case "sirena":
      return tickSirena(g, e, dt, def, mem(e));
    case "golem":
      return tickGolem(g, e, dt, def, mem(e));
    case "vult":
      return tickVult(g, e, dt, def, mem(e));
    case "coro":
      return tickCoro(g, e, dt, def, mem(e));
    case "ecodesg":
      return tickEcodesg(g, e, dt, def, mem(e));
    case "satiro":
      return tickSatiro(g, e, dt, def, mem(e));
    default:
      return false;
  }
}

// src/game/interaccion.ts
var SENNO_T = 5;
var SENNO_THROW = 3 * TILE;
var LURE_R = 88;
var AGGRO_SEEK_R = 6 * TILE;
var AGGRO_HOLD = 60;
var DEF_DIST = 2 * TILE;
var INTERPOSE_DIST = 1.5 * TILE;
var INTERPOSE_CD = 6;
var RETREAT_HP = 0.3;
var CORPSE_TTL = 30;
var CORPSE_CAP = 12;
var EXAMINE_DIST = 0.8 * TILE;
var LOOT_CHANCE = 0.25;
var RUMOR_WINDOW = 2.5;
var RUMOR_CD = 60;
var BOSS_TYPES = new Set(["guardian", "sirena", "golem", "vult", "coro"]);
var rng = Math.random;
var STATES = new WeakMap;
function stateFor(g) {
  let s = STATES.get(g);
  if (!s) {
    s = {
      clock: 0,
      rot: 0,
      closedNid: null,
      closedAt: 0,
      rumorAt: new Map,
      decoy: { active: false, x: 0, y: 0, t: 0 },
      decoyAcc: 0,
      corpseAcc: 0
    };
    STATES.set(g, s);
  }
  return s;
}
var MEM2 = new WeakMap;
function memFor(c) {
  let m = MEM2.get(c);
  if (!m) {
    m = { interposeCd: 0 };
    MEM2.set(c, m);
  }
  return m;
}
function dist2(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
var DIRS2 = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
function cycleCompanionMode(g) {
  const c = g.companion;
  const cur = c?.mode ?? "seguir";
  const next = cur === "seguir" ? "agresivo" : cur === "agresivo" ? "defensivo" : "seguir";
  if (!c || g.state !== "play") {
    g.toast("No hay nadie a quien dar órdenes...", "#9aa0b8");
    audio.sfx("error");
    return "seguir";
  }
  c.mode = next;
  audio.sfx("select");
  g.toast(next === "agresivo" ? "Orden: AGRESIVO — caza al enemigo con aggro más cercano (retirada bajo 30% de vida)" : next === "defensivo" ? "Orden: DEFENSIVO — guarda a 2 tiles e interpone su cuerpo (50% del daño melé)" : "Orden: SEGUIR — escolta clásica, cubre tu espalda", next === "agresivo" ? "#f0a050" : next === "defensivo" ? "#8ef0b0" : "#a8c8e0");
  g.floatAt(c.x, c.y - 26, next.toUpperCase(), "#a8e8c8", 8);
  return next;
}
function companionOrdersMove(g, c, p, dt, d) {
  const mode = c.mode ?? "seguir";
  if (mode === "seguir")
    return false;
  if (mode === "agresivo") {
    if (c.hp < c.maxHp * RETREAT_HP)
      return false;
    const tgt = nearestAggroTo(g, p.x, p.y, AGGRO_SEEK_R);
    if (!tgt)
      return false;
    const de = dist2(c.x, c.y, tgt.x, tgt.y);
    if (de > AGGRO_HOLD) {
      const l = Math.max(1, de);
      g.moveEntity(c, (tgt.x - c.x) / l * 92 * dt, (tgt.y - c.y) / l * 92 * dt);
      c.moving = true;
      c.anim += dt;
      c.dir = tgt.x > c.x ? "right" : tgt.x < c.x ? "left" : tgt.y > c.y ? "down" : "up";
    } else {
      if (d > 30) {
        const l = Math.max(1, d);
        g.moveEntity(c, (p.x - c.x) / l * 55 * dt, (p.y - c.y) / l * 55 * dt);
        c.moving = true;
        c.anim += dt * 0.7;
      } else {
        c.moving = false;
        c.anim += dt * 0.4;
      }
    }
    return true;
  }
  if (d > DEF_DIST) {
    const l = Math.max(1, d);
    g.moveEntity(c, (p.x - c.x) / l * 86 * dt, (p.y - c.y) / l * 86 * dt);
    c.moving = true;
    c.anim += dt;
    c.dir = p.x > c.x ? "right" : p.x < c.x ? "left" : p.y > c.y ? "down" : "up";
  } else {
    c.moving = false;
    c.anim += dt * 0.4;
  }
  return true;
}
function nearestAggroTo(g, x, y, r) {
  let best = null;
  let bd = r;
  for (const e of g.enemies) {
    if (e.dead || !e.aggro)
      continue;
    const dd = dist2(x, y, e.x, e.y);
    if (dd < bd) {
      bd = dd;
      best = e;
    }
  }
  return best;
}
function companionInterpose(g, final, fromX, fromY) {
  const { companion: c, player: p } = g;
  if (!c || !p || final <= 0)
    return 0;
  if ((c.mode ?? "seguir") !== "defensivo")
    return 0;
  if (c.downT > 0)
    return 0;
  const mem2 = memFor(c);
  if (mem2.interposeCd > 0)
    return 0;
  if (dist2(c.x, c.y, p.x, p.y) >= INTERPOSE_DIST)
    return 0;
  let melee = false;
  for (const e of g.enemies) {
    if (e.dead)
      continue;
    if (Math.abs(e.x - fromX) < e.w / 2 + 6 && Math.abs(e.y - fromY) < e.h / 2 + 8) {
      melee = true;
      break;
    }
  }
  if (!melee)
    return 0;
  const half = Math.min(final - 1, Math.round(final * 0.5));
  if (half <= 0)
    return 0;
  mem2.interposeCd = INTERPOSE_CD;
  c.hp -= half;
  g.floatAt(c.x, c.y - 22, `−${half} ¡INTERPUESTA!`, "#8ef0b0", 6);
  g.burst((c.x + p.x) / 2, (c.y + p.y) / 2 - 4, "#8ef0b0", 10, 60);
  audio.sfx("hit");
  return half;
}
function useSenno(g) {
  const p = g.player;
  if (!p || g.state !== "play")
    return false;
  const st = stateFor(g);
  if (st.decoy.active) {
    g.toast("Ya hay un señuelo activo...", "#9aa0b8");
    audio.sfx("error");
    return false;
  }
  const n = Number(g.flags.sennuelos ?? 0);
  if (n <= 0) {
    g.toast("No te quedan señuelos (Toln vende uno por 60 coronas)", "#e88");
    audio.sfx("error");
    return false;
  }
  const [dx, dy] = DIRS2[p.dir];
  let { x: tx, y: ty } = p;
  for (let r = SENNO_THROW;r >= 8; r -= 8) {
    const cx = p.x + dx * r, cy = p.y + dy * r;
    if (!g.tileSolidAt(cx, cy)) {
      tx = cx;
      ty = cy;
      break;
    }
  }
  st.decoy.active = true;
  st.decoy.x = tx;
  st.decoy.y = ty;
  st.decoy.t = SENNO_T;
  st.decoyAcc = 0;
  g.flags.sennuelos = n - 1;
  audio.sfx("whoosh");
  g.burst(tx, ty - 2, "#e8c88a", 12, 55);
  g.waves.push({ x: tx, y: ty, r: 3, maxR: 26, speed: 70, dmg: 0, hit: true });
  if (g.bossActive) {
    g.floatAt(tx, ty - 16, "nadie muerde...", "#9aa0b8", 6);
    return true;
  }
  let pulled = 0;
  for (const e of g.enemies) {
    if (e.dead || BOSS_TYPES.has(e.etype))
      continue;
    if (e.spawnGuard !== undefined && e.spawnGuard > 0)
      continue;
    if (dist2(e.x, e.y, tx, ty) >= LURE_R)
      continue;
    e.aggro = true;
    if (e.ai === "patrulla")
      e.ai = "persigue";
    e.lured = SENNO_T;
    pulled++;
  }
  if (pulled > 0) {
    g.floatAt(tx, ty - 16, `¡${pulled} atraído${pulled > 1 ? "s" : ""}!`, "#e8c88a", 7);
    audio.sfx("blip");
  } else {
    g.floatAt(tx, ty - 16, "el olor se disipa...", "#9aa0b8", 6);
  }
  return true;
}
function lureActive(g, e) {
  return (e.lured ?? 0) > 0 && stateFor(g).decoy.active;
}
function sennoChase(g, e, dt, spd) {
  const d = stateFor(g).decoy;
  const dx = d.x - e.x, dy = d.y - e.y;
  const l = Math.max(1, Math.hypot(dx, dy));
  g.moveEntity(e, dx / l * spd * dt, dy / l * spd * dt);
  e.moving = true;
  e.dir = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
}
var corpses = Array.from({ length: CORPSE_CAP }, () => ({ active: false, map: "lunaris", x: 0, y: 0, etype: "lobo", ttl: 0, examined: false }));
var corpseIdx = 0;
function registerCorpse16b(g, e) {
  if (BOSS_TYPES.has(e.etype))
    return;
  const c = corpses[corpseIdx];
  corpseIdx = (corpseIdx + 1) % CORPSE_CAP;
  c.active = true;
  c.map = g.mapId;
  c.x = e.x;
  c.y = e.y;
  c.etype = e.etype;
  c.ttl = CORPSE_TTL;
  c.examined = false;
}
function bossSennoLoot16b(g, e) {
  if (!BOSS_TYPES.has(e.etype))
    return;
  if (rng() >= 0.08)
    return;
  g.flags.sennuelos = (Number(g.flags.sennuelos ?? 0) || 0) + 1;
  g.floatAt(e.x, e.y - 40, "Botín del jefe: +1 señuelo de caza", "#e8c88a", 7);
  audio.sfx("chest");
}
function interaccionInteract16b(g) {
  const p = g.player;
  if (!p || g.state !== "play")
    return false;
  const st = stateFor(g);
  for (let i = 0;i < CORPSE_CAP; i++) {
    const c = corpses[i];
    if (!c.active || c.map !== g.mapId)
      continue;
    if (c.examined)
      continue;
    const dx = c.x - p.x, dy = c.y - p.y;
    if (dx * dx + dy * dy > EXAMINE_DIST * EXAMINE_DIST)
      continue;
    c.examined = true;
    c.ttl = Math.min(c.ttl, 1.2);
    const name = ENEMY_DEFS[c.etype]?.name ?? "enemigo";
    g.burst(c.x, c.y - 2, "#9aa0a8", 6, 40);
    if (rng() < LOOT_CHANCE) {
      const n = 1 + Math.floor(rng() * 5);
      p.gold += n;
      g.floatAt(c.x, c.y - 14, `+${n} coronas`, "#f0c84a");
      g.toast(`Examinas los restos del ${name}: ${n} coronas escondidas`, "#f0c84a");
      audio.sfx("coin");
    } else {
      g.floatAt(c.x, c.y - 14, "nada útil", "#9aa0b8");
      g.toast(`Examinas los restos del ${name}: nada útil... solo silencio`, "#9aa0b8");
      audio.sfx("blip");
    }
    return true;
  }
  for (const ch of g.map.chests) {
    if (!g.openedChests.has(ch.id))
      continue;
    if (ch.needPast && g.epoch !== "pasado")
      continue;
    const px3 = ch.x * TILE + 8, py = ch.y * TILE + 8;
    if (dist2(px3, py, p.x, p.y) > 26)
      continue;
    g.floatAt(px3, py - 14, "vacío…", "#9aa0b8");
    g.toast("El cofre está vacío… pero huele a antes.", "#9aa0b8");
    audio.sfx("blip");
    return true;
  }
  return false;
}
var RUMOR_LINES_16B = {
  lunaris: [
    "Dicen que la Niebla respeta las canciones de cuna. Por algo los niños dormían.",
    "El pozo de la plaza fue el primero en quedarse sin nombre.",
    "Toln forjó gratis durante un año. Nadie se lo agradece lo bastante.",
    "Los lobos del valle antes guardaban rebaños. Ahora solo guardan hambre.",
    "Si ves luces doradas de noche, no las sigas. O sí. Yo no soy nadie para opinar.",
    "El Santuario zumba cuando pasas. Lo he oído yo misma.",
    "Mi abuela juraba que el río recordaba todas las canciones. Mi abuela bebía.",
    "Antes había un puente al norte. En algún ayer sigue ahí, dicen.",
    "Que no te quite el nombre la bruma. Y si te lo quita, ven a la plaza a por otro.",
    "El silencio del valle pesa menos desde que llegaste. Se nota, Portador."
  ],
  bosque: [
    "Los árboles del Susurrante repiten lo que oyen. Con siglos de retraso.",
    "Cuidado con las sombras sin rostro: les gustan los nombres frescos.",
    "El Círculo dice que la Madre Espina aún vela el claro viejo.",
    "Hay setas que silban al anochecer. No las comas. Bueno, una. Bueno, dos.",
    "Las flechas de Ilwen vuelven solas al aljaba. O eso jura ella.",
    "La Ruina Antigua era un templo del Canto. Ahora es un nido de ecos.",
    "Si el Bosque te llama por tu nombre, no contestes a la primera.",
    "Los esqueletos del camino no son malos. Solo aturdidos de eternidad.",
    "Doran habla con las raíces. Las raíces, según él, se quejan de ti.",
    "Cuando llueve, dicen las piedras el nombre del tercer capellán."
  ],
  costa: [
    "La bruma de la Costa borra el rumbo y, a veces, el apellido.",
    "Mara encendía el faro con cerillas y con miedo. Ya solo quedan las cerillas.",
    "Los neumos son espuma con mal carácter. No les debes nada.",
    "El naufragio del este canta los días de calma. Acércate solo de día.",
    "Una sirena robó el canto del mar. Por eso las olas susurran en vez de gritar.",
    "Los peces saltan donde no hay que pescar. El mar tiene humor.",
    "La Liga de Vult paga bien por mapas. Y mal por poetas.",
    "Si oyes una nana en la orilla, no es tu madre. Sigue andando.",
    "La sal conserva los barcos y corroe los recuerdos.",
    "Bajo la quilla duerme un Eco, dicen. El mar habla mucho y no firma nada."
  ],
  aldea: [
    "Merrow bailaba en el festival hasta que la Niebla se quedó con la música.",
    "Los faroles del pueblo guardan nombres. Enciéndelos y lo verás.",
    "Mera no es su nombre. Es lo que quedó de él.",
    "Las guirnaldas del festival siguen colgadas. El viento no se atreve a bajarlas.",
    "La laguna no refleja a nadie. Antes reflejaba hasta los secretos.",
    "El Heraldo de la Orden apunta los silencios largos. Sé breve.",
    "Aquí las casas se construyeron cantando. Por eso resisten tanto.",
    "Si encuentras un aldeano que no habla, no es mudo: le falta nombre.",
    "Los espectros eran vecinos. Salúdalos; no muerde quien fue cortés.",
    "El Eco de los Nombres duerme donde el pozo se seca. O era el otro pozo."
  ],
  cumbres: [
    "El lago helado guarda coros enteros debajo. Canta fuerte y quizá respondan.",
    "Los pastores cantaban por turnos para no dormirse. Ahora nadie duerme.",
    "El Gólem no odia. Solo recuerda con demasiado peso.",
    "Las arpías guiaban a los perdidos antes. Ahora guían al fondo del barranco.",
    "Vult cartografió estas cumbres dos veces. La primera no volvió.",
    "La ventisca silba en do menor. Los lobos la afinan.",
    "Si te pierdes, sigue el hielo resbaladizo: al final siempre hay una cabaña.",
    "Ivo dice que la montaña escucha. Yo digo que Ivo debería dormir más.",
    "Las estrellas aquí bajan a beber al lago. Por eso faltan en los mapas.",
    "El paso del norte se abre solo para quien canta. Para los demás, empuja."
  ],
  cripta: [
    "La Cripta existe fuera del tiempo. Los que entran, también un poco.",
    "El Guardián Hueco fue el primer coro. Cuidado: aún sabe de coros.",
    "Las paredes cantan lo que firmas con voz. Piensa antes de prometer.",
    "Aquí el silencio tiene dueño. Y el dueño tiene hambre.",
    "Los peregrinos que cantaron hasta vaciarse aún marcan el paso.",
    "Velmora fue la primera. Nadie sabe de qué. Todos bajan la voz al decirlo.",
    "Si el Eco te habla con voz de tu madre, no es tu madre. Escucha, no respondas.",
    "Las lámparas nunca se apagan. Nadie las enciende. Piénsalo.",
    "El polvo aquí no se posa: espera.",
    "Bajar es fácil. Subir canta."
  ]
};
function noteDialogueClosed16b(g) {
  const p = g.player;
  if (!p)
    return;
  const st = stateFor(g);
  let best = null;
  let bd = 40;
  for (const n of g.npcs) {
    const dd = dist2(n.x, n.y, p.x, p.y);
    if (dd < bd) {
      bd = dd;
      best = n.nid;
    }
  }
  st.closedNid = best;
  st.closedAt = st.clock;
}
function rumorAfterDialogue16b(g) {
  const p = g.player;
  if (!p || g.state !== "play")
    return false;
  const st = stateFor(g);
  if (!st.closedNid)
    return false;
  if (st.clock - st.closedAt > RUMOR_WINDOW) {
    st.closedNid = null;
    return false;
  }
  let npc = null;
  let bd = 34;
  for (const n of g.npcs) {
    const dd = dist2(n.x, n.y, p.x, p.y);
    if (dd < bd) {
      bd = dd;
      npc = n;
    }
  }
  if (!npc || npc.nid !== st.closedNid)
    return false;
  const last = st.rumorAt.get(npc.nid);
  if (last !== undefined && st.clock - last < RUMOR_CD) {
    st.closedNid = null;
    return false;
  }
  const pool2 = RUMOR_LINES_16B[g.mapId];
  const line = pool2[st.rot++ % pool2.length];
  g.floats.push({ x: npc.x, y: npc.y - 26, text: `${npc.dispName}: «${line}»`, t: 3.2, color: "#cfe0f8", vy: -6, size: 7 });
  audio.sfx("blip");
  st.rumorAt.set(npc.nid, st.clock);
  st.closedNid = null;
  return true;
}
function interaccionTick(g, dt) {
  if (!g.player || g.state !== "play")
    return;
  const st = stateFor(g);
  st.clock += dt;
  const c = g.companion;
  if (c) {
    const mem2 = MEM2.get(c);
    if (mem2 && mem2.interposeCd > 0)
      mem2.interposeCd -= dt;
  }
  const d = st.decoy;
  if (d.active) {
    d.t -= dt;
    if (d.t <= 0) {
      d.active = false;
      g.burst(d.x, d.y - 2, "#e8c88a", 6, 40);
    } else {
      st.decoyAcc -= dt;
      if (st.decoyAcc <= 0) {
        st.decoyAcc = 0.38;
        g.particles.push({
          x: d.x + (rng() - 0.5) * 10,
          y: d.y,
          vx: 0,
          vy: -14,
          t: 0.6,
          maxT: 0.6,
          color: "#e8c88a",
          size: 1.6,
          grav: 0
        });
        g.waves.push({ x: d.x, y: d.y, r: 2, maxR: 9, speed: 12, dmg: 0, hit: true });
      }
    }
  }
  for (const e of g.enemies) {
    if (e.lured !== undefined && e.lured > 0) {
      e.lured -= dt;
      if (e.lured <= 0)
        e.lured = undefined;
    }
  }
  st.corpseAcc -= dt;
  if (st.corpseAcc <= 0) {
    st.corpseAcc = 0.5;
    for (let i = 0;i < CORPSE_CAP; i++) {
      const c2 = corpses[i];
      if (!c2.active || c2.map !== g.mapId)
        continue;
      g.particles.push({
        x: c2.x + (rng() - 0.5) * 6,
        y: c2.y - 2,
        vx: 0,
        vy: -5,
        t: 0.7,
        maxT: 0.7,
        color: "#8a9098",
        size: 1.4,
        grav: 0
      });
    }
  }
  for (let i = 0;i < CORPSE_CAP; i++) {
    const c2 = corpses[i];
    if (!c2.active)
      continue;
    c2.ttl -= dt;
    if (c2.ttl <= 0)
      c2.active = false;
  }
}

// src/game/update.ts
var DIRS3 = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
var ARROW_CYCLE = ["fuego", "hielo", "rayo"];
var ilwenMem = new WeakMap;
var finisherUsed = new WeakSet;
var wasAturdido = new WeakMap;
var lastAttackT = new WeakMap;
var iceMem = new WeakMap;
var plLastX = 0;
var plLastY = 0;
var plLastOk = false;
var plVX = 0;
var plVY = 0;
function getPortadorVel() {
  return { x: plVX, y: plVY };
}
function dist3(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
var EXPANSION_TYPES = new Set(["neumo", "espectro", "arpi", "sirena", "golem", "vult", "coro", "ecodesg", "satiro"]);
var fxHitSeen = new WeakMap;
var fxOwnFx = new WeakMap;
var fxF = 0;
function sparkColorFor(p, e) {
  if (p.attackT > 0)
    return p.chargedHit ? "#ffe86a" : "#f5f2ea";
  if (e.statuses.some((s) => s.kind === "quemado"))
    return "#ff9040";
  if (e.statuses.some((s) => s.kind === "congelado"))
    return "#a0e8ff";
  return "#e8e2d4";
}
function updateCombatFx(g) {
  fxF++;
  const p = g.player;
  if (!p)
    return;
  for (const e of g.enemies) {
    if (e.dead)
      continue;
    const seen = fxHitSeen.get(e) ?? 0;
    fxHitSeen.set(e, e.hitFlash);
    if (e.hitFlash <= seen + 0.0005 || e.hitFlash <= 0.06)
      continue;
    if (fxF - (fxOwnFx.get(e) ?? -99) <= 2)
      continue;
    combatSparks(g, e.x, e.y - 4, p.x - e.x, p.y - e.y, sparkColorFor(p, e), 5, 70);
    if (g.hitStop > 0.05)
      critGlint(g, e.x, e.y - 6);
  }
}
function updateGame(g, dt) {
  if (g.state === "dialogue" && g.dlgNode)
    g.dlgCharT += dt * 45;
  g.mapTitleT = Math.max(0, g.mapTitleT - dt);
  g.epochFx = Math.max(0, g.epochFx - dt);
  g.shake = Math.max(0, g.shake - dt * 22);
  for (const t of g.toasts)
    t.t -= dt;
  g.toasts = g.toasts.filter((t) => t.t > 0);
  for (const f of g.floats) {
    f.t -= dt;
    f.y += f.vy * dt;
  }
  g.floats = g.floats.filter((f) => f.t > 0);
  for (const p2 of g.particles) {
    p2.t -= dt;
    p2.x += p2.vx * dt;
    p2.y += p2.vy * dt;
    p2.vy += p2.grav * dt;
  }
  g.particles = g.particles.filter((p2) => p2.t > 0);
  if (g.state !== "play") {
    g.updateCamera();
    return;
  }
  const p = g.player;
  if (!p)
    return;
  p.playTime += dt;
  g.dayT = (g.dayT + dt / 240) % 1;
  if (p.buffT) {
    p.buffT -= dt;
    if (p.buffT <= 0)
      p.buffT = undefined;
  }
  if (g.exitCd > 0)
    g.exitCd -= dt;
  if (g.fadeDir !== 0) {
    g.fadeT += g.fadeDir * dt * 2.4;
    if (g.fadeT >= 1 && g.fadeDir > 0) {
      g.fadeT = 1;
      if (g.pendingMap) {
        const { to, tx, ty } = g.pendingMap;
        g.pendingMap = null;
        g.loadMap(to, tx, ty);
        audio.playTrack(g.map.music);
        g.save();
        g.toast("Autoguardado", "#8ef0ff");
      }
      g.fadeDir = -1;
    }
    if (g.fadeT <= 0 && g.fadeDir < 0) {
      g.fadeT = 0;
      g.fadeDir = 0;
    }
    if (g.fadeDir !== 0) {
      g.updateCamera();
      return;
    }
  }
  const k = g.keys;
  let mx = 0, my = 0;
  if (k.has("a") || k.has("arrowleft"))
    mx -= 1;
  if (k.has("d") || k.has("arrowright"))
    mx += 1;
  if (k.has("w") || k.has("arrowup"))
    my -= 1;
  if (k.has("s") || k.has("arrowdown"))
    my += 1;
  const mlen = Math.hypot(mx, my) || 1;
  p.sta = Math.min(p.maxSta, p.sta + (p.rollT > 0 ? 0 : 26) * dt);
  if (p.iframes > 0)
    p.iframes -= dt;
  if (p.parryT > 0)
    p.parryT -= dt;
  if (p.parryFx > 0)
    p.parryFx -= dt;
  if (p.lastHitT > 0)
    p.lastHitT -= dt;
  for (let i = 0;i < p.cds.length; i++)
    if (p.cds[i] > 0)
      p.cds[i] -= dt;
  stepKnockback(g, p, dt);
  if (p.charging) {
    p.chargeT += dt;
    if (p.chargeT > 0.35 && Math.random() < 0.4) {
      g.particles.push({ x: p.x + (Math.random() - 0.5) * 14, y: p.y - 10, vx: 0, vy: -30, t: 0.3, maxT: 0.3, color: "#ffe86a", size: 1.5, grav: 0 });
    }
  }
  if (p.rollT > 0) {
    p.rollT -= dt;
    const rd = p.rollDir ?? p.dir;
    const [rx, ry] = DIRS3[rd];
    const spd = 168;
    g.moveEntity(p, rx * spd * dt, ry * spd * dt);
    p.moving = true;
    p.anim += dt * 1.4;
    if (Math.random() < 0.5)
      g.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0.25, maxT: 0.25, color: "#d8dce4", size: 2, grav: 0 });
  } else if (p.attackT > 0) {
    p.attackT -= dt;
    p.moving = false;
    p.anim += dt;
  } else {
    const im = iceMem.get(p) ?? { vx: 0, vy: 0 };
    iceMem.set(p, im);
    const kbActive = (p.kbVx ?? 0) !== 0 || (p.kbVy ?? 0) !== 0;
    const onIce = !kbActive && tileAt(g.map, g.rows, Math.floor(p.x / TILE), Math.floor((p.y + p.h / 2) / TILE), g.epoch) === "i";
    const spd = 74;
    if (onIce) {
      if (mx !== 0 || my !== 0) {
        if (im.vx === 0 && im.vy === 0) {
          im.vx = plVX;
          im.vy = plVY;
        }
        const k2 = 1 - Math.pow(0.55, dt * 60);
        im.vx += (mx / mlen * spd - im.vx) * k2;
        im.vy += (my / mlen * spd - im.vy) * k2;
      } else {
        const dec = Math.pow(0.9, dt * 60);
        im.vx *= dec;
        im.vy *= dec;
        if (im.vx * im.vx + im.vy * im.vy < 25) {
          im.vx = 0;
          im.vy = 0;
        }
      }
      if (im.vx !== 0 || im.vy !== 0) {
        g.moveEntity(p, im.vx * dt, im.vy * dt);
        p.moving = true;
        p.anim += dt * (mx !== 0 || my !== 0 ? 1 : 0.7);
        if ((mx !== 0 || my !== 0) && (!p.charging || p.chargeT < 0.2)) {
          if (Math.abs(mx) > Math.abs(my))
            p.dir = mx > 0 ? "right" : "left";
          else
            p.dir = my > 0 ? "down" : "up";
        }
      } else {
        p.moving = false;
        p.anim += dt * 0.4;
      }
    } else {
      im.vx = 0;
      im.vy = 0;
      if (mx !== 0 || my !== 0) {
        g.moveEntity(p, mx / mlen * spd * dt, my / mlen * spd * dt);
        p.moving = true;
        p.anim += dt;
        if (!p.charging || p.chargeT < 0.2) {
          if (Math.abs(mx) > Math.abs(my))
            p.dir = mx > 0 ? "right" : "left";
          else
            p.dir = my > 0 ? "down" : "up";
        }
      } else {
        p.moving = false;
        p.anim += dt * 0.4;
      }
    }
  }
  if (plLastOk) {
    const ddx = p.x - plLastX, ddy = p.y - plLastY;
    if (ddx * ddx + ddy * ddy < 160 * 160) {
      plVX = ddx / Math.max(0.0001, dt);
      plVY = ddy / Math.max(0.0001, dt);
      const vm = Math.hypot(plVX, plVY);
      if (vm > 240) {
        plVX *= 240 / vm;
        plVY *= 240 / vm;
      }
    } else {
      plVX = 0;
      plVY = 0;
    }
  }
  plLastX = p.x;
  plLastY = p.y;
  plLastOk = true;
  updateCombatFx(g);
  const prevAttackT = lastAttackT.get(p) ?? 0;
  const attackStarted = p.attackT > 0 && prevAttackT <= 0;
  lastAttackT.set(p, p.attackT);
  if (p.attackT <= 0 && p.chargedHit)
    p.chargedHit = false;
  if (p.attackT > 0) {
    p.comboT = 1.2;
  } else if ((p.comboT ?? 0) > 0) {
    p.comboT = (p.comboT ?? 0) - dt;
    if ((p.comboT ?? 0) <= 0) {
      p.comboT = 0;
      p.combo = 0;
    }
  }
  if (attackStarted) {
    if (p.rollT <= 0) {
      const [lgx, lgy] = DIRS3[p.dir];
      applyKnockback(p, lgx, lgy, p.chargedHit ? 88 : 62);
    }
    if (p.chargedHit) {
      const [fdx, fdy] = DIRS3[p.dir];
      const cx2 = p.x + fdx * 20, cy2 = p.y + fdy * 20;
      for (const e of g.enemies) {
        if (e.dead)
          continue;
        if (Math.hypot(e.x - cx2, e.y - cy2) < 36 + e.w / 2) {
          applyKnockback(e, e.x - p.x, e.y - p.y, 200);
        }
      }
    }
    for (const e of g.enemies) {
      if (e.dead || e.ai !== "aturdido" || e.maxSta <= 0)
        continue;
      if (finisherUsed.has(e))
        continue;
      if (dist3(p.x, p.y, e.x, e.y) < 30) {
        finisherUsed.add(e);
        const [rdx, rdy] = DIRS3[p.dir];
        g.damageEnemy(e, playerMeleeDmg(p) * 0.6, "ninguno", 90, rdx, rdy);
        fxOwnFx.set(e, fxF);
        combatSparks(g, e.x, e.y - 4, -rdx, -rdy, "#ffe86a", 6, 90);
        critGlint(g, e.x, e.y - 6);
        g.floatAt(e.x, e.y - 26, "¡REMATE!", "#ffe86a", 12);
        addShake(g, 4);
        requestSlowmo(g, 0.2);
        p.res = Math.min(p.maxRes, p.res + 15);
        audio.sfx("break");
        break;
      }
    }
  }
  if (g.rollQueued && p.rollT <= 0 && p.attackT <= 0 && p.sta >= 20) {
    g.rollQueued = false;
    p.rollT = 0.3;
    p.iframes = 0.34;
    p.sta -= 20;
    let rd = p.dir;
    if (mx !== 0 || my !== 0)
      rd = Math.abs(mx) > Math.abs(my) ? mx > 0 ? "right" : "left" : my > 0 ? "down" : "up";
    p.rollDir = rd;
    dodgeRing(g, p.x, p.y);
    audio.sfx("dodge");
  }
  for (let i = g.deadGolds.length - 1;i >= 0; i--) {
    const dgl = g.deadGolds[i];
    if (dgl.map !== g.mapId)
      continue;
    if (dist3(p.x, p.y, dgl.x, dgl.y) < 14) {
      p.gold += dgl.amount;
      g.deadGolds.splice(i, 1);
      audio.sfx("coin");
      g.floatAt(dgl.x, dgl.y - 10, `+${dgl.amount}`, "#f0c84a");
      g.toast(`Recuperas tu eco de oro (+${dgl.amount})`, "#f0c84a");
    }
  }
  if (g.fadeDir === 0 && g.exitCd <= 0) {
    const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    for (const ex of g.map.exits) {
      if (ex.needPast && g.epoch !== "pasado")
        continue;
      if (ptx >= ex.x && ptx < ex.x + ex.w && pty >= ex.y && pty < ex.y + ex.h) {
        g.fadeTo(ex.to, ex.tx, ex.ty);
        audio.sfx("echo");
        break;
      }
    }
  }
  if (g.questIdx >= 2 && !g.flags.q2_done)
    g.flags.q2_done = true;
  if (g.flags.ecoVoz && g.mapId === "bosque" && !g.flags.mem_casa) {
    g.flags.mem_casa = true;
    if (!(p.memories ?? []).includes("mem_casa"))
      g.applyAction("memory_mem_casa");
  }
  if (g.flags.guardianDefeated && !g.flags.mem_madre) {
    g.flags.mem_madre = true;
    if (!(p.memories ?? []).includes("mem_madre"))
      g.applyAction("memory_mem_madre");
  }
  if (g.companion)
    updateCompanion(g, dt);
  interaccionTick(g, dt);
  let anyAggro = false;
  for (const e of g.enemies) {
    if (e.dead) {
      if (e.etype === "sirena" || e.etype === "golem" || e.etype === "vult" || e.etype === "coro")
        expansionDeathFx(g, e);
      continue;
    }
    updateEnemy(g, e, dt);
    if (e.aggro && e.ai !== "muerto")
      anyAggro = true;
  }
  g.enemies = g.enemies.filter((e) => !e.dead);
  if (g.bossRef && g.bossRef.dead)
    g.bossRef = null;
  audio.setCombat(anyAggro);
  const bossSpawn = g.map.spawns.find((s) => s.zone === "boss");
  if (bossSpawn && !g.flags[BOSS_DEFEAT_FLAG[bossSpawn.type] ?? "x_defeated"] && !g.bossActive) {
    const boss = g.enemies.find((e) => e.etype === bossSpawn.type);
    if (boss) {
      g.bossRef = boss;
      if (dist3(p.x, p.y, boss.x, boss.y) < 190) {
        g.bossActive = true;
        audio.playTrack("boss");
        if (bossSpawn.type === "guardian") {
          g.toast("El Guardián Hueco despierta: ROMPE SU BARRA DE QUIEBRE", "#7ee8ff");
          audio.sfx("roar");
        } else if (bossSpawn.type === "sirena") {
          g.toast("La Sirena Abisal despierta: ROMPE SU BARRA DE QUIEBRE", "#8ef0ff");
          audio.sfx("song");
        } else if (bossSpawn.type === "golem") {
          g.toast("El Gólem de Escarcha despierta: ROMPE SU BARRA DE QUIEBRE", "#a8d8ff");
          audio.sfx("roar");
        }
      }
    }
  }
  expansionBossWatchers(g);
  for (let i = g.projectiles.length - 1;i >= 0; i--) {
    const pr = g.projectiles[i];
    pr.t -= dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    let dead = pr.t <= 0 || g.tileSolidAt(pr.x, pr.y);
    if (pr.from !== "enemy") {
      if (Math.random() < 0.5)
        g.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.22, maxT: 0.22, color: pr.element === "fuego" ? "#ff9040" : pr.element === "hielo" ? "#a0e8ff" : "#ffe86a", size: 1.5, grav: 0 });
      for (const e of g.enemies) {
        if (e.dead)
          continue;
        if (dist3(pr.x, pr.y, e.x, e.y - 4) < pr.radius + e.w / 2 + 2) {
          g.damageEnemy(e, pr.dmg, pr.element, 30, Math.sign(pr.vx), Math.sign(pr.vy));
          const kbForce = pr.from === "companion" ? 90 : pr.element === "fuego" ? 150 : pr.element === "rayo" ? 110 : 85;
          applyKnockback(e, pr.vx, pr.vy, kbForce);
          fxOwnFx.set(e, fxF);
          dead = true;
          break;
        }
      }
    } else {
      if (dist3(pr.x, pr.y, p.x, p.y - 4) < pr.radius + 7) {
        if (p.parryT > 0) {
          audio.sfx("parry");
          p.res = Math.min(p.maxRes, p.res + 15);
          g.floatAt(p.x, p.y - 22, "¡PARADA!", "#fff8c0", 7);
          dead = true;
        } else if (p.iframes <= 0 && p.rollT <= 0) {
          g.damagePlayer(pr.dmg, pr.x, pr.y);
          dead = true;
        }
      }
      const trailC = pr.sprite === "orb" ? "#8ef0ff" : pr.sprite === "shard" ? "#a8d8ff" : pr.sprite === "nota" ? "#ffe9a0" : "";
      if (trailC) {
        if (Math.random() < 0.6) {
          g.particles.push({ x: pr.x + (Math.random() - 0.5) * 3, y: pr.y + (Math.random() - 0.5) * 3, vx: 0, vy: 0, t: 0.25, maxT: 0.25, color: trailC, size: 1.4, grav: 0 });
        }
      } else if (Math.random() < 0.4) {
        g.particles.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.25, maxT: 0.25, color: "#b48fff", size: 1.5, grav: 0 });
      }
    }
    if (dead) {
      g.burst(pr.x, pr.y, pr.element === "fuego" ? "#ff9040" : pr.element === "hielo" ? "#a0e8ff" : "#e8d0ff", 6, 40);
      if (pr.sprite === "nota") {
        for (let j = 0;j < 3; j++) {
          g.particles.push({
            x: pr.x + (Math.random() - 0.5) * 6,
            y: pr.y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 14,
            vy: -16 - Math.random() * 14,
            t: 0.55,
            maxT: 0.55,
            color: "#b8a0f0",
            size: 1.6,
            grav: 0
          });
        }
      }
      g.projectiles.splice(i, 1);
    }
  }
  for (let i = g.waves.length - 1;i >= 0; i--) {
    const w = g.waves[i];
    w.r += w.speed * dt;
    if (w.dmg > 0 && !w.hit) {
      if (Math.abs(dist3(w.x, w.y, p.x, p.y) - w.r) < 8) {
        if (p.parryT <= 0 && p.iframes <= 0 && p.rollT <= 0)
          applyKnockback(p, p.x - w.x, p.y - w.y, 260);
        g.damagePlayer(w.dmg, w.x, w.y);
        w.hit = true;
      }
    }
    if (w.r >= w.maxR)
      g.waves.splice(i, 1);
  }
  for (let i = g.telegraphs.length - 1;i >= 0; i--) {
    const t = g.telegraphs[i];
    t.t -= dt;
    if (t.t <= 0) {
      audio.sfx("slam");
      g.shake = 6;
      g.burst(t.x, t.y, "#c8b8a0", 18, 90);
      if (dist3(p.x, p.y, t.x, t.y) < t.r && p.rollT <= 0 && p.iframes <= 0) {
        if (p.parryT <= 0)
          applyKnockback(p, p.x - t.x, p.y - t.y, 260);
        g.damagePlayer(t.dmg, t.x, t.y);
      }
      g.telegraphs.splice(i, 1);
    }
  }
  g.updateCamera();
}
function updateCompanion(g, dt) {
  const c = g.companion;
  const p = g.player;
  const mem2 = ilwenMem.get(c) ?? { rainCd: 8, markCd: 3, arrowIdx: 0, bondT: 0 };
  ilwenMem.set(c, mem2);
  stepKnockback(g, c, dt);
  if (c.downT > 0) {
    c.downT -= dt;
    if (c.downT <= 0) {
      c.hp = Math.floor(c.maxHp * 0.5);
      g.toast("Ilwen se incorpora de nuevo", "#8ef0b0");
    }
    return;
  }
  c.atkCd -= dt;
  const d = dist3(c.x, c.y, p.x, p.y);
  const defensivo16b = (c.mode ?? "seguir") === "defensivo";
  if (!companionOrdersMove(g, c, p, dt, d)) {
    if (d > 30) {
      const spd = Math.min(92, 40 + (d - 30) * 2);
      const dx = (p.x - c.x) / d, dy = (p.y - c.y) / d;
      g.moveEntity(c, dx * spd * dt, dy * spd * dt);
      c.moving = true;
      c.anim += dt;
      c.dir = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
    } else {
      c.moving = false;
      c.anim += dt * 0.4;
    }
  }
  if (c.atkCd <= 0) {
    let best = null, bd = 150;
    for (const e of g.enemies) {
      if (e.dead)
        continue;
      if (defensivo16b && dist3(e.x, e.y, p.x, p.y) >= 2 * TILE)
        continue;
      const dd = dist3(c.x, c.y, e.x, e.y);
      if (dd < bd) {
        bd = dd;
        best = e;
      }
    }
    if (best) {
      c.atkCd = 1.5;
      const el = ARROW_CYCLE[mem2.arrowIdx % ARROW_CYCLE.length];
      mem2.arrowIdx = (mem2.arrowIdx + 1) % ARROW_CYCLE.length;
      const dmg = (7 + p.level * 1.5) * ((best.marked ?? 0) > 0 ? 1.6 : 1);
      const dx = best.x - c.x, dy = best.y - 4 - (c.y - 6);
      const l = Math.max(1, Math.hypot(dx, dy));
      g.projectiles.push({
        x: c.x,
        y: c.y - 6,
        vx: dx / l * 190,
        vy: dy / l * 190,
        t: 1.2,
        dmg,
        element: el,
        from: "companion",
        sprite: "p_arrow",
        radius: 3,
        pierce: 0
      });
      combatSparks(g, c.x, c.y - 6, -dx / l, -dy / l, "#e8d8a0", 3, 42);
      audio.sfx("companionShot");
    }
  }
  mem2.markCd -= dt;
  if (mem2.markCd <= 0) {
    let best = null, bd = 180;
    for (const e of g.enemies) {
      if (e.dead || !e.aggro)
        continue;
      const dd = dist3(c.x, c.y, e.x, e.y);
      if (dd < bd) {
        bd = dd;
        best = e;
      }
    }
    if (best) {
      best.marked = 5;
      g.floatAt(best.x, best.y - 24, "MARCADO", "#e8a8c8", 6);
      mem2.markCd = 6;
    }
  }
  mem2.rainCd -= dt;
  if (mem2.rainCd <= 0 && c.affinity >= 20) {
    const targets = g.enemies.filter((e) => !e.dead && e.aggro && dist3(c.x, c.y, e.x, e.y) < 140 && (!defensivo16b || dist3(e.x, e.y, p.x, p.y) < 2 * TILE));
    if (targets.length > 0) {
      mem2.rainCd = 24;
      const t0 = targets[0];
      const baseAng = Math.atan2(t0.y - c.y, t0.x - c.x);
      for (let i = 0;i < 10; i++) {
        const ang = baseAng + (i / 9 - 0.5) * 1.6;
        g.projectiles.push({
          x: c.x,
          y: c.y - 8,
          vx: Math.cos(ang) * 210,
          vy: Math.sin(ang) * 210,
          t: 1.1,
          dmg: 9 + p.level * 1.8,
          element: ARROW_CYCLE[i % ARROW_CYCLE.length],
          from: "companion",
          sprite: "p_arrow",
          radius: 3,
          pierce: 0
        });
      }
      combatSparks(g, c.x, c.y - 8, -Math.cos(baseAng), -Math.sin(baseAng), "#e8d8a0", 4, 50);
      g.waves.push({ x: c.x, y: c.y, r: 4, maxR: 64, speed: 150, dmg: 0, hit: true });
      g.waves.push({ x: c.x, y: c.y, r: 4, maxR: 96, speed: 190, dmg: 0, hit: true });
      addFlash(g, "#ffe9a0", 0.15);
      addShake(g, 3);
      g.floatAt(c.x, c.y - 26, "LLUVIA DE ESTRELLAS", "#ffe9a0", 9);
      audio.sfx("holy");
      audio.sfx("bolt");
    }
  }
  const fighting = g.enemies.some((e) => !e.dead && e.aggro);
  if (fighting) {
    mem2.bondT += dt;
    if (mem2.bondT >= 10) {
      mem2.bondT -= 10;
      c.affinity = Math.min(30, c.affinity + 1);
      g.floatAt(c.x, c.y - 20, "♥", "#8ef0b0");
    }
  } else {
    mem2.bondT = Math.max(0, mem2.bondT - dt * 0.5);
  }
  if (c.hp < c.maxHp)
    c.hp = Math.min(c.maxHp, c.hp + 2 * dt);
  if (c.hp <= 0) {
    c.downT = 8;
    g.toast("Ilwen cae... se repondrá en unos segundos", "#e8a0a0");
  }
}
function speedMult(e) {
  let m = 1;
  if (e.statuses.some((s) => s.kind === "congelado"))
    m *= 0.5;
  return m;
}
function updateEnemy(g, e, dt) {
  const p = g.player;
  const def = ENEMY_DEFS[e.etype];
  if (e.hitFlash > 0)
    e.hitFlash -= dt;
  if (e.spawnGuard && e.spawnGuard > 0) {
    e.spawnGuard -= dt;
    return;
  }
  const prevStun = wasAturdido.get(e) ?? false;
  if (e.ai === "aturdido" && !prevStun)
    finisherUsed.delete(e);
  wasAturdido.set(e, e.ai === "aturdido");
  stepKnockback(g, e, dt);
  for (let i = e.statuses.length - 1;i >= 0; i--) {
    const s = e.statuses[i];
    s.t -= dt;
    if (s.kind === "quemado") {
      e.hp -= s.power * dt;
      if (Math.random() < 0.15)
        g.particles.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 6, vx: 0, vy: -24, t: 0.3, maxT: 0.3, color: "#ff9040", size: 1.5, grav: 0 });
      if (e.hp <= 0) {
        g.killEnemy(e);
        return;
      }
    }
    if (s.t <= 0)
      e.statuses.splice(i, 1);
  }
  if (e.marked !== undefined) {
    e.marked -= dt;
    if (e.marked <= 0)
      e.marked = undefined;
  }
  if (e.hp < e.maxHp)
    e.aggro = true;
  if (e.invulT !== undefined && e.invulT > 0)
    e.invulT -= dt;
  if (EXPANSION_TYPES.has(e.etype) && expansionTick(g, e, dt, def))
    return;
  const d = dist3(e.x, e.y, p.x, p.y);
  const nightMult = isNight(g) ? 1.3 : 1;
  const aggroR = def.aggroR * nightMult * (e.etype === "guardian" ? g.bossActive ? 99 : 1 : 1);
  if (!e.aggro && d < aggroR && g.state === "play") {
    e.aggro = true;
    if (e.etype === "guardian") {
      if (!g.flags.bossIntro) {
        g.flags.bossIntro = true;
        g.bossBannerT = 3.2;
        g.bossBannerText = "GUARDIÁN HUECO";
        g.bossBannerSub = "Custodio del Eco de la Voz";
        addFlash(g, "#7ee8ff", 0.25);
        audio.sfx("banner");
      }
    } else
      audio.sfx("blip");
  }
  e.atkCd -= dt;
  e.anim += dt * (e.ai === "persigue" ? 1.4 : 0.6);
  if (e.ai === "aturdido") {
    e.aiT -= dt;
    e.moving = false;
    if (e.aiT <= 0) {
      e.ai = "persigue";
      if (e.maxSta > 0)
        e.sta = e.maxSta;
    }
    return;
  }
  switch (e.ai) {
    case "patrulla": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.aiT = 1.5 + Math.random() * 2;
        e.patrolAngle = Math.random() * Math.PI * 2;
      }
      const far = Math.hypot(e.x - e.homeX, e.y - e.homeY) > 60;
      const ang = far ? Math.atan2(e.homeY - e.y, e.homeX - e.x) : e.patrolAngle;
      const vx = Math.cos(ang) * 22, vy = Math.sin(ang) * 22;
      const before = { x: e.x, y: e.y };
      g.moveEntity(e, vx * dt * speedMult(e), vy * dt * speedMult(e));
      if (Math.abs(e.x - before.x) < 0.01 && Math.abs(e.y - before.y) < 0.01) {
        e.patrolAngle += Math.PI * (0.5 + Math.random());
      }
      e.moving = true;
      e.dir = Math.cos(ang) > 0 ? "right" : "left";
      if (e.aggro)
        e.ai = "persigue";
      break;
    }
    case "persigue": {
      if (!e.aggro) {
        e.ai = "patrulla";
        break;
      }
      if (d > aggroR * 2.4) {
        e.aggro = false;
        e.ai = "patrulla";
        break;
      }
      if (lureActive(g, e)) {
        sennoChase(g, e, dt, def.speed * speedMult(e));
        break;
      }
      const dx = (p.x - e.x) / (d || 1), dy = (p.y - e.y) / (d || 1);
      const spd = def.speed * speedMult(e);
      if (d > def.atkR * 0.8) {
        g.moveEntity(e, dx * spd * dt, dy * spd * dt);
        e.moving = true;
        e.dir = dx > 0 ? "right" : "left";
      } else
        e.moving = false;
      if (d <= def.atkR && e.atkCd <= 0) {
        e.ai = "carga";
        e.windup = def.windup * (e.etype === "guardian" && e.phase >= 3 ? 0.7 : 1);
        e.telegraphKind = undefined;
      }
      if (e.etype === "guardian")
        guardianBrain(g, e, dt, d);
      break;
    }
    case "carga": {
      e.windup -= dt;
      e.moving = false;
      e.dir = p.x > e.x ? "right" : "left";
      if (e.windup <= 0) {
        if (e.telegraphKind === "onda") {
          g.waves.push({ x: e.x, y: e.y, r: 10, maxR: 150, speed: 130, dmg: 13 * e.phase, hit: false });
          audio.sfx("slam");
          g.shake = 5;
          e.telegraphKind = undefined;
          e.ai = "recupera";
          e.aiT = 0.6;
          e.atkCd = 2.6;
        } else if (e.etype === "guardian") {
          e.ai = "ataca";
          e.aiT = 0.22;
          audio.sfx("slam");
          if (d < 46) {
            if (p.parryT <= 0 && p.iframes <= 0 && p.rollT <= 0)
              applyKnockback(p, p.x - e.x, p.y - e.y, 260);
            g.damagePlayer(def.dmg * e.phase, e.x, e.y);
          }
          g.burst(e.x, e.y, "#8a84a8", 14, 80);
          g.shake = 5;
        } else {
          e.ai = "ataca";
          e.aiT = 0.22;
          const dx = (p.x - e.x) / (d || 1), dy = (p.y - e.y) / (d || 1);
          g.moveEntity(e, dx * 14, dy * 14);
          if (d < def.atkR + 10) {
            g.damagePlayer(def.dmg, e.x, e.y);
          }
        }
      }
      break;
    }
    case "ataca": {
      e.aiT -= dt;
      if (e.aiT <= 0) {
        e.ai = "recupera";
        e.aiT = 0.45;
        e.atkCd = def.atkCd * (0.85 + Math.random() * 0.3);
      }
      break;
    }
    case "recupera": {
      e.aiT -= dt;
      e.moving = false;
      if (e.aiT <= 0)
        e.ai = e.aggro ? "persigue" : "patrulla";
      break;
    }
    default:
      break;
  }
  if (e.etype === "lobo" && e.hp < e.maxHp * 0.25 && e.ai !== "huye" && Math.random() < 0.01) {
    e.ai = "huye";
    e.aiT = 2.2;
  }
  if (e.ai === "huye") {
    e.aiT -= dt;
    const dx = (e.x - p.x) / (d || 1), dy = (e.y - p.y) / (d || 1);
    g.moveEntity(e, dx * def.speed * 1.2 * dt, dy * def.speed * 1.2 * dt);
    if (e.aiT <= 0)
      e.ai = "persigue";
  }
}
function guardianBrain(g, e, dt, d) {
  const p = g.player;
  const hpPct = e.hp / e.maxHp;
  const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
  if (newPhase !== e.phase) {
    e.phase = newPhase;
    audio.sfx("roar");
    g.toast(`El Guardián cambia de fase (${e.phase}/3)`, "#7ee8ff");
    addShake(g, 5);
    addFlash(g, e.phase === 3 ? "#e8a0ff" : "#7ee8ff", 0.2);
    requestSlowmo(g, 0.25);
    if (e.phase === 2) {
      for (let i = 0;i < 2; i++) {
        const s = g.makeEnemy("sombra", e.x + (i === 0 ? -24 : 24), e.y + 12, 0, "boss");
        s.aggro = true;
        g.enemies.push(s);
      }
      g.toast("El Guardián llama a sombras sin rostro", "#b48fff");
    }
  }
  e.sumT -= dt;
  if (e.atkCd <= 0) {
    if (d < 40) {
      e.ai = "carga";
      e.windup = 0.55;
      e.atkCd = 2.2;
    } else if (e.phase >= 2 && Math.random() < 0.5) {
      e.windup = 0.9;
      e.ai = "carga";
      e.telegraphKind = "onda";
      e.atkCd = 3.2;
    } else {
      g.telegraphs.push({ x: p.x, y: p.y, r: 34, t: 0.85, maxT: 0.85, dmg: 16 * e.phase, kind: "slam" });
      e.atkCd = 2.4 / (e.phase >= 3 ? 1.4 : 1);
      e.ai = "recupera";
      e.aiT = 0.5;
    }
  }
}
function isNight(g) {
  return g.dayT > 0.7 || g.dayT < 0.08;
}

// src/game/ui.ts
var COL = {
  gold: "#f0c84a",
  goldSoft: "#ffe9a0",
  hp: "#e05548",
  hpBg: "#3a1a18",
  sta: "#7ec850",
  staBg: "#1c2e18",
  res: "#5ad0e8",
  resBg: "#123038",
  xp: "#c8a0f0",
  panel: "rgba(12,14,24,0.92)",
  panelBorder: "#5a4a30",
  text: "#e8e4d8",
  dim: "#9aa0b8",
  quest: "#8ef0b0",
  boss: "#b48fff",
  bossBg: "#2a1a3a",
  danger: "#ff7060",
  epochPast: "#ffd88a",
  epochNow: "#a8b8d8"
};
function fTitle(px3) {
  return `${px3}px "Press Start 2P", monospace`;
}
function fBody(px3) {
  return `${px3}px "VT323", "Press Start 2P", monospace`;
}
function text(g, str, x, y, size, color = COL.text, align = "left", title = false) {
  const ctx = g.ctx;
  ctx.font = title ? fTitle(size) : fBody(size);
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
function textShadow(g, str, x, y, size, color = COL.text, shadow = "#000", align = "left", title = false) {
  const ctx = g.ctx;
  ctx.font = title ? fTitle(size) : fBody(size);
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = shadow;
  ctx.fillText(str, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
function wrapText(str, maxChars) {
  const out = [];
  for (const para of str.split(`
`)) {
    let line = "";
    for (const word of para.split(" ")) {
      if ((line + " " + word).trim().length > maxChars) {
        if (line)
          out.push(line.trim());
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    out.push(line.trim());
  }
  return out;
}
function panel(g, x, y, w, h, border = COL.panelBorder, bg = COL.panel) {
  const ctx = g.ctx;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
}
function bar(g, x, y, w, h, pct, color, bg, border = "#000") {
  const ctx = g.ctx;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, pct)) * w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function clearHits(g) {
  g.uiHit = [];
}
function addHit(g, x, y, w, h, cb) {
  const hover = g.mouse.x >= x && g.mouse.x <= x + w && g.mouse.y >= y && g.mouse.y <= y + h;
  g.uiHit.push({ x, y, w, h, cb, hover, state: g.state });
  return hover;
}
function button(g, label, x, y, w, h, cb, size = 12, accent = COL.gold) {
  const hover = addHit(g, x, y, w, h, cb);
  const ctx = g.ctx;
  panel(g, x, y, w, h, hover ? accent : COL.panelBorder, hover ? "rgba(40,34,20,0.95)" : COL.panel);
  textShadow(g, label, x + w / 2, y + h / 2 - size * 0.62, size, hover ? accent : COL.text, "#000", "center", true);
  if (hover) {
    ctx.fillStyle = accent;
    ctx.fillRect(x + 6, y + h - 4, w - 12, 2);
  }
  g.canvas.style.cursor = g.uiHit.some((h2) => h2.hover) ? "pointer" : "default";
}

// src/game/hooks.ts
var TONES = ["empatico", "pragmatico", "sarcastico", "amenazante"];
var FAC_LABEL = {
  guardianes: "Guardianes del Canto",
  orden: "Orden de Vesh",
  circulo: "Círculo Verde",
  liga: "Liga de Mercaderes"
};
function toneFlagOf(flags) {
  const v = flags.tonoDominante;
  return typeof v === "string" ? v : null;
}
function handleCustomAction(g, action) {
  const p = g.player;
  if (!p || !action)
    return false;
  if (action.startsWith("memory_")) {
    grantMemory(g, p, action.slice(7));
    return true;
  }
  if (action.startsWith("rep_")) {
    const m = /^rep_(guardianes|orden|circulo|liga)_([+-]?\d+)$/.exec(action);
    if (!m)
      return false;
    const fac = m[1];
    const delta = parseInt(m[2], 10);
    const rep = p.repFacciones ?? { guardianes: 0, orden: 0, circulo: 0, liga: 0 };
    const before = rep[fac] ?? 0;
    const after = Math.max(-100, Math.min(100, before + delta));
    rep[fac] = after;
    p.repFacciones = rep;
    const applied = after - before;
    g.toast(`${FAC_LABEL[fac]}: ${applied >= 0 ? "+" : ""}${applied}`, applied >= 0 ? "#8ef0b0" : "#e88a8a");
    return true;
  }
  if (action === "eco_taken_mem") {
    g.applyAction("eco_taken");
    grantMemory(g, p, "mem_nana");
    return true;
  }
  if (action.startsWith("flag_")) {
    g.flags[action.slice(5)] = true;
    return true;
  }
  if (action === "accept_q6") {
    if (g.questIdx < 5) {
      g.questIdx = 5;
      g.questStep = g.flags.visited_costa ? 1 : 0;
    }
    if (!g.flags.q6) {
      g.flags.q6 = true;
      audio.sfx("quest");
      g.toast("Nueva misión: El Rumor del Mar", "#8ef0b0");
      dispararInterludio18F(g, 2);
    }
    return true;
  }
  if (action === "mara_met") {
    if (g.questIdx === 5 && g.questStep === 1)
      g.questAdvance();
    return true;
  }
  if (action === "mara_gift") {
    p.potions += 2;
    g.flags.maraGift = true;
    audio.sfx("potion");
    g.applyAction("rep_circulo_5");
    g.toast("Mara enciende el faro tras 300 años: +2 pociones", "#ffe9a0");
    return true;
  }
  if (action === "mera_eco") {
    g.flags.ecoNombres = true;
    p.points += 1;
    audio.sfx("echo");
    g.burst(p.x, p.y - 8, "#ffe9a0", 22, 70);
    if (g.questIdx === 7 && g.questStep === 2)
      g.questAdvance();
    g.toast("Eco de los Nombres recuperado: +1 punto de habilidad", "#ffe9a0");
    return true;
  }
  if (action === "acto2_report") {
    if (g.questIdx === 9 && !g.flags.acto2Done) {
      g.flags.acto2Done = true;
      audio.sfx("quest");
      g.applyAction("rep_guardianes_5");
      g.toast("Misión completada: Dos Voces más Fuertes", "#8ef0b0");
    }
    return true;
  }
  acto3CatchUp(g);
  if (action === "accept_q11") {
    if (g.questIdx < 10) {
      g.questIdx = 10;
      g.questStep = 0;
    }
    if (!g.flags.q11) {
      g.flags.q11 = true;
      audio.sfx("quest");
      g.toast("Nueva misión: El Canto al Revés", "#8ef0b0");
      dispararInterludio18F(g, 3);
    }
    return true;
  }
  if (action === "acto3_toln") {
    if (g.questIdx === 10 && g.questStep === 0) {
      g.questAdvance();
      g.toast("Toln marca los tres lugares: el pozo de Teo, la Ruina Antigua, la orilla de Mara", "#8ef0b0");
    }
    return true;
  }
  if (action === "acto3_eco1" || action === "acto3_eco2" || action === "acto3_eco3") {
    g.flags[action === "acto3_eco1" ? "ecoInvTeo" : action === "acto3_eco2" ? "ecoInvDoran" : "ecoInvMara"] = true;
    audio.sfx("echo");
    if (g.player)
      g.burst(g.player.x, g.player.y - 8, "#ffe9a0", 18, 70);
    const n = ["ecoInvTeo", "ecoInvDoran", "ecoInvMara"].filter((k) => g.flags[k]).length;
    if (g.questIdx === 10 && g.questStep === 1 && n >= 3) {
      g.questAdvance();
      g.toast("Los tres ecos enderezados: vuelve con la Anciana Brisa", "#8ef0b0");
    } else {
      g.toast(`Eco invertido enderezado (${n}/3)`, "#ffe9a0");
    }
    return true;
  }
  if (action === "accept_q12") {
    if (g.questIdx < 11) {
      g.questIdx = 11;
      g.questStep = g.flags.visited_aldea ? 1 : 0;
    }
    g.flags.q12 = true;
    return true;
  }
  if (action === "acto3_mera_ayer") {
    g.flags.recMera = true;
    audio.sfx("echo");
    if (g.questIdx === 11 && g.questStep === 0)
      g.questAdvance();
    const recs = ["recMera", "recMara", "recIvo", "recVult"].filter((k) => g.flags[k]).length;
    if (g.questIdx === 11 && g.questStep === 1 && recs >= 3) {
      g.questAdvance();
      g.toast("Tres recuerdos devueltos: vuelve con la Anciana Brisa", "#8ef0b0");
    } else {
      g.toast(`Recuerdo devuelto (${Math.min(recs, 3)}/3)`, "#ffe9a0");
    }
    return true;
  }
  if (action === "acto3_rec_mara" || action === "acto3_rec_ivo" || action === "acto3_rec_vult") {
    g.flags[action === "acto3_rec_mara" ? "recMara" : action === "acto3_rec_ivo" ? "recIvo" : "recVult"] = true;
    audio.sfx("echo");
    const recs = ["recMera", "recMara", "recIvo", "recVult"].filter((k) => g.flags[k]).length;
    if (g.questIdx === 11 && g.questStep === 1 && recs >= 3) {
      g.questAdvance();
      g.toast("Tres recuerdos devueltos: vuelve con la Anciana Brisa", "#8ef0b0");
    } else {
      g.toast(`Recuerdo devuelto (${Math.min(recs, 3)}/3)`, "#ffe9a0");
    }
    return true;
  }
  if (action === "accept_q13") {
    if (g.questIdx < 12) {
      g.questIdx = 12;
      g.questStep = 0;
    }
    g.flags.q13 = true;
    return true;
  }
  if (action === "acto3_verdad" || action === "acto3_silencio") {
    if (!g.flags.acto3RepDecision) {
      g.flags.acto3RepDecision = true;
      if (action === "acto3_verdad") {
        g.applyAction("rep_orden_10");
        g.applyAction("rep_guardianes_-5");
        g.toast("Contaste la verdad: la Orden de Vesh pronuncia tu nombre con respeto", "#e8a0a0");
      } else {
        g.applyAction("rep_guardianes_10");
        g.applyAction("rep_orden_-5");
        g.toast("Callaste: los Guardianes del Canto conservan su verdad intacta", "#8ef0b0");
      }
    }
    return true;
  }
  if (action === "acto3_velmora_fn") {
    if (g.questIdx === 12 && g.questStep === 0) {
      g.questAdvance();
      g.toast("La Cripta te espera: fuera del tiempo, canta la nota al revés", "#c8b0e8");
    }
    return true;
  }
  if (action === "acto3_subir") {
    g.closeDialogue();
    g.loadMap("cripta", 19, 24);
    if (!g.flags.guardianRecordadoDerrotado) {
      const altar = g.map.props.find((pr) => pr.id === "altar_c");
      const ax = (altar ? altar.x : 19) * 16 + 8;
      const ay = (altar ? altar.y + 5 : 9) * 16 + 8;
      const elite = g.makeEnemy("guardian", ax, ay, 0, "boss");
      g.enemies.push(elite);
      ACTO3_ELITE.ref = elite;
      g.bossRef = elite;
      g.bossActive = true;
      audio.playTrack("boss");
      g.shake = 8;
      g.toast("El Guardián recordado despierta: ROMPE SU BARRA DE QUIEBRE", "#7ee8ff");
    }
    return true;
  }
  if (action === "acto3_report") {
    if (g.questIdx === 10 && g.questStep === 2 && !g.flags.acto3Paid11) {
      g.flags.acto3Paid11 = true;
      p.gold += 60;
      p.potions += 1;
      audio.sfx("coin");
      g.floatAt(p.x, p.y - 26, "Recompensa: +60 coronas y 1 poción", "#f0c84a", 7);
      g.toast("Misión completada: El Canto al Revés (+60 coronas, +1 poción)", "#8ef0b0");
      g.questAdvance();
    }
    if (g.questIdx === 11 && g.questStep === 2 && !g.flags.acto3Paid12) {
      g.flags.acto3Paid12 = true;
      p.gold += 80;
      p.potions += 1;
      audio.sfx("coin");
      g.floatAt(p.x, p.y - 26, "Recompensa: +80 coronas y 1 poción", "#f0c84a", 7);
      g.toast("Misión completada: La Aldea sin Ayer (+80 coronas, +1 poción)", "#8ef0b0");
      g.questAdvance();
    }
    if (g.questIdx === 12 && g.questStep === 2 && !g.flags.acto3Paid13) {
      g.flags.acto3Paid13 = true;
      p.gold += 100;
      p.potions += 1;
      audio.sfx("quest");
      g.floatAt(p.x, p.y - 26, "Recompensa: +100 coronas y 1 poción", "#f0c84a", 7);
      g.toast("Misión completada: La Primera Portadora (+100 coronas, +1 poción)", "#8ef0b0");
      grantMemory(g, p, "mem_cantoalreves");
      g.flags.acto3Done = true;
    }
    return true;
  }
  acto4CatchUp(g);
  if (action === "accept_q14") {
    if (g.questIdx < 13) {
      g.questIdx = 13;
      g.questStep = 0;
    }
    if (!g.flags.q14) {
      g.flags.q14 = true;
      audio.sfx("quest");
      g.toast("Nueva misión: Las Campanas de Antes", "#8ef0b0");
      dispararInterludio18F(g, 4);
    }
    return true;
  }
  if (action === "acto4_toln") {
    g.flags.camToln = true;
    if (g.questIdx === 13 && g.questStep === 0) {
      g.questAdvance();
      g.toast("Toln cría la Campana del Ayer: falta el coro que la llame", "#8ef0b0");
    }
    return true;
  }
  if (action === "acto4_cam_mera" || action === "acto4_cam_ivo") {
    g.flags[action === "acto4_cam_mera" ? "camMera" : "camCumbres"] = true;
    audio.sfx("echo");
    if (g.player)
      g.burst(g.player.x, g.player.y - 8, "#ffe9a0", 18, 70);
    const n = ["camMera", "camCumbres"].filter((k) => g.flags[k]).length;
    if (g.questIdx === 13 && g.questStep === 1 && n >= 2) {
      g.questAdvance();
      g.toast("El coro de antes acompaña a la campana: vuelve con la Anciana Brisa", "#8ef0b0");
    } else {
      g.toast(`Voz devuelta al coro (${Math.min(n, 2)}/2)`, "#ffe9a0");
    }
    return true;
  }
  if (action === "accept_q15") {
    if (g.questIdx < 14) {
      g.questIdx = 14;
      g.questStep = 0;
    }
    g.flags.q15 = true;
    return true;
  }
  if (action === "acto4_guarda") {
    if (g.questIdx === 14 && g.questStep === 0) {
      g.questAdvance();
      g.toast("La Guarda sostiene la puerta: la Sala del Primer Canto puede abrirse", "#c8b0e8");
    }
    return true;
  }
  if (action === "acto4_subir") {
    g.closeDialogue();
    g.flags.acto4SalaAbierta = true;
    g.loadMap("cripta", 19, 24);
    if (!g.flags.heraldoDerrotado) {
      const altar = g.map.props.find((pr) => pr.id === "altar_c");
      const ax = (altar ? altar.x : 19) * 16 + 8;
      const ay = (altar ? altar.y + 2 : 6) * 16 + 8;
      const boss = g.makeEnemy("heraldo", ax, ay, 0, "boss");
      g.enemies.push(boss);
      ACTO4_BOSS.ref = boss;
      g.bossRef = boss;
      g.bossActive = true;
      g.bossBannerT = 3.2;
      g.bossBannerText = "EL HERALDO";
      g.bossBannerSub = "Vesh, la Última Nota";
      audio.playTrack("boss");
      g.shake = 8;
      g.toast("La Sala del Primer Canto se abre: ROMPE SU BARRA DE QUIEBRE", "#c8b0e8");
    }
    return true;
  }
  if (action === "acto4_report") {
    if (g.questIdx === 13 && g.questStep === 2 && !g.flags.acto4Paid14) {
      g.flags.acto4Paid14 = true;
      p.gold += 80;
      p.potions += 1;
      audio.sfx("coin");
      g.floatAt(p.x, p.y - 26, "Recompensa: +80 coronas y 1 poción", "#f0c84a", 7);
      g.toast("Misión completada: Las Campanas de Antes (+80 coronas, +1 poción)", "#8ef0b0");
      g.questAdvance();
    }
    if (g.questIdx === 14 && g.questStep === 2 && !g.flags.acto4Paid15) {
      g.flags.acto4Paid15 = true;
      p.gold += 120;
      p.potions += 1;
      audio.sfx("coin");
      g.floatAt(p.x, p.y - 26, "Recompensa: +120 coronas y 1 poción", "#f0c84a", 7);
      g.toast("Misión completada: La Sala del Primer Canto (+120 coronas, +1 poción)", "#8ef0b0");
      g.questAdvance();
    }
    return true;
  }
  if (action === "accept_q16") {
    if (g.questIdx < 15) {
      g.questIdx = 15;
      g.questStep = 0;
    }
    g.flags.q16 = true;
    return true;
  }
  if (action === "acto4_epilogo") {
    if (g.questIdx < 15) {
      g.questIdx = 15;
      g.questStep = 0;
    }
    g.flags.q16 = true;
    if (!g.flags.acto4Paid16) {
      g.flags.acto4Paid16 = true;
      p.gold += 150;
      p.potions += 1;
      audio.sfx("quest");
      g.floatAt(p.x, p.y - 26, "Recompensa: +150 coronas y 1 poción", "#f0c84a", 7);
      g.toast("Misión completada: El Eco que Elegiste (+150 coronas, +1 poción)", "#8ef0b0");
      grantMemory(g, p, "mem_ultimacanto");
      g.flags.acto4Done = true;
      if (g.questIdx === 15 && g.questStep === 0)
        g.questAdvance();
    }
    g.dynNodes["acto4_epilogo_canto"] = acto4FinNode(g);
    return true;
  }
  return false;
}
function acto4FinNode(g) {
  const f = g.flags;
  let text2 = ACTO4_FIN_BASE;
  if (f.coroDefeated)
    text2 += `

` + ACTO4_FIN_JEFES.coro;
  if (f.vultDefeated)
    text2 += `

` + ACTO4_FIN_JEFES.vult;
  return {
    name: "Anciana Brisa",
    portrait: "brisa",
    text: text2,
    options: [
      { text: "(Subir el telón del Último Canto: terminar el viaje)", action: "end_demo" },
      { text: "(Quedarse: el mundo aún tiene mañanas que nombrar)", tone: "empatico" }
    ]
  };
}
function grantMemory(g, p, id) {
  const mem2 = MEMORIES[id];
  if (!mem2)
    return;
  p.memories = p.memories ?? [];
  if (p.memories.includes(id))
    return;
  p.memories.push(id);
  g.memoryReveal = { id: mem2.id, title: mem2.title, text: mem2.text, t: 5.5 };
  g.toast("Una memoria aflora...", "#ffe9a0");
  audio.sfx("memory");
}
function recordDialogueTone(g, opt) {
  if (!opt.tone || !g.player)
    return;
  const p = g.player;
  p.tones = p.tones ?? { empatico: 0, pragmatico: 0, sarcastico: 0, amenazante: 0 };
  p.tones[opt.tone] = (p.tones[opt.tone] ?? 0) + 1;
  const dom = dominantTone(p);
  if (dom) {
    const prev = toneFlagOf(g.flags);
    if (prev !== dom) {
      g.flags.tonoDominante = dom;
      if (prev)
        g.toast(`Tu forma de hablar empieza a definirte: ${TONE_LABEL[dom]}`, "#c8b0e8");
      if (!g.flags[`toneSeen_${dom}`]) {
        g.flags[`toneSeen_${dom}`] = true;
        if (g.companion) {
          g.companion.affinity += 1;
          g.toast("Ilwen te mira de otra manera... te está entendiendo (+1 afinidad)", "#8ef0b0");
        }
      }
    }
  }
}
var TONE_LABEL = {
  empatico: "Empático",
  pragmatico: "Pragmático",
  sarcastico: "Sarcástico",
  amenazante: "Amenazante"
};
function dominantTone(p) {
  const t = p.tones;
  if (!t)
    return null;
  let best = null, bestN = 0, total = 0;
  for (const k of TONES) {
    total += t[k] ?? 0;
    if ((t[k] ?? 0) > bestN) {
      bestN = t[k] ?? 0;
      best = k;
    }
  }
  if (!best || total < 3)
    return null;
  return best;
}
function acto3CatchUp(g) {
  const f = g.flags;
  if (!g.player)
    return;
  if (g.questIdx === 9 && f.acto2Done && f.q11) {
    g.questIdx = 10;
    g.questStep = 0;
  }
  if (g.questIdx < 10 || g.questIdx > 12)
    return;
  if (ACTO3_ELITE.ref?.dead && !f.guardianRecordadoDerrotado) {
    f.guardianRecordadoDerrotado = true;
    g.toast("El Guardián recordado se aquietó: vuelve con la Anciana Brisa", "#a8d8ff");
  }
  if (g.questIdx === 10 && g.questStep === 1 && f.ecoInvTeo && f.ecoInvDoran && f.ecoInvMara) {
    g.questAdvance();
    g.toast("Los tres ecos enderezados: vuelve con la Anciana Brisa", "#8ef0b0");
  }
  if (g.questIdx === 11 && g.questStep === 1 && ["recMera", "recMara", "recIvo", "recVult"].filter((k) => f[k]).length >= 3) {
    g.questAdvance();
    g.toast("Tres recuerdos devueltos: vuelve con la Anciana Brisa", "#8ef0b0");
  }
  if (g.questIdx === 12 && g.questStep === 1 && f.guardianRecordadoDerrotado) {
    g.questAdvance();
  }
}
function acto4CatchUp(g) {
  const f = g.flags;
  if (!g.player)
    return;
  const rep = g.player.repFacciones;
  if (rep) {
    f.acto4RepOrden = rep.orden ?? 0;
    f.acto4RepGuard = rep.guardianes ?? 0;
  }
  if (g.questIdx === 12 && f.acto3Done && f.q14) {
    g.questIdx = 13;
    g.questStep = 0;
  }
  if (g.questIdx < 13 || g.questIdx > 15)
    return;
  if (ACTO4_BOSS.ref?.dead && !f.heraldoDerrotado) {
    f.heraldoDerrotado = true;
    g.bossActive = false;
    audio.playTrack("crypt");
    g.toast("Vesh, la Última Nota, se aquietó: el coro entero respira", "#c8b0e8");
  }
  if (g.questIdx === 13 && g.questStep === 1 && f.camMera && f.camCumbres) {
    g.questAdvance();
    g.toast("El coro de antes acompaña a la campana: vuelve con la Anciana Brisa", "#8ef0b0");
  }
  if (g.questIdx === 14 && g.questStep === 1 && f.heraldoDerrotado) {
    g.questAdvance();
  }
}

// src/game/balance.ts
var LS_KEY = "ecos-balance";
var VENTANA_S = 10;
var UMBRAL_SUBIR = -2;
var UMBRAL_BAJAR = 3;
var HISTERESIS = 2;
var ENFRIAMIENTO_S = 30;
var GRACIA_S = 60;
var TOAST_GRACIA_S = 300;
var MEMORIA_MUERTE_S = 120;
var MEMORIA_FLAWLESS_S = 120;
var MEMORIA_POCION_S = 60;
var COMBATE_MIN_S = 3;
var FLAWLESS_MIN_S = 4;
var DEBOUNCE_MS = 1500;
var NIVEL_MIN = -2;
var NIVEL_MAX = 2;
var ZONA_NIVEL_REF = {
  lunaris: 2,
  bosque: 4,
  cripta: 5,
  costa: 8,
  aldea: 9,
  cumbres: 11
};
var MULTS = {
  [-2]: { hp: 0.75, dmg: 0.8, xp: 0.85 },
  [-1]: { hp: 0.88, dmg: 0.9, xp: 0.93 },
  [0]: { hp: 1, dmg: 1, xp: 1 },
  [1]: { hp: 1.15, dmg: 1.1, xp: 1.08 },
  [2]: { hp: 1.3, dmg: 1.2, xp: 1.15 }
};
var BALANCE_NAMES = [
  "Muy fácil",
  "Fácil",
  "Normal",
  "Difícil",
  "Muy difícil"
];
function clampLevel(n) {
  return Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, Math.round(n)));
}
function multFor(level) {
  return MULTS[clampLevel(level)];
}
var bal = null;
var saveTimer = null;
function ensureLoaded() {
  if (bal)
    return bal;
  bal = { level: 0, auto: true, recentDeaths: 0, recentFlawless: 0 };
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d.level === "number" && typeof d.auto === "boolean") {
          bal.level = clampLevel(d.level);
          bal.auto = d.auto;
        }
      }
    }
  } catch {}
  return bal;
}
function saveBalance(s) {
  bal = {
    level: clampLevel(s.level),
    auto: !!s.auto,
    recentDeaths: Math.max(0, Math.floor(s.recentDeaths)),
    recentFlawless: Math.max(0, Math.floor(s.recentFlawless))
  };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, level: bal.level, auto: bal.auto }));
    }
  } catch {}
}
function scheduleSave() {
  if (saveTimer !== null)
    return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      saveBalance(ensureLoaded());
    } catch {}
  }, DEBOUNCE_MS);
}
function setBalanceAuto(auto) {
  const b = ensureLoaded();
  if (b.auto === auto)
    return;
  b.auto = auto;
  scheduleSave();
}
function nudgeBalanceLevel(delta) {
  const b = ensureLoaded();
  b.auto = false;
  b.level = clampLevel(Math.abs(delta) === 1 ? b.level + delta : delta);
  scheduleSave();
}
function resetBalance() {
  bal = { level: 0, auto: true, recentDeaths: 0, recentFlawless: 0 };
  try {
    saveBalance(bal);
  } catch {}
  if (mon) {
    mon.votes = [];
    mon.lastChangeT = -1e9;
  }
}
var mon = null;
function newMonitor() {
  return {
    prevPlayer: null,
    prevHp: 0,
    prevDeaths: 0,
    prevPotions: 0,
    inCombat: false,
    spanDmg: 0,
    spanT: 0,
    winT: 0,
    winDmg: 0,
    winCombatT: 0,
    votes: [],
    lastChangeT: -1e9,
    tMuertes: [],
    tFlawless: [],
    tPociones: []
  };
}
function cerrarVentana(g, t) {
  if (!mon)
    return;
  const p = g.player;
  const b = ensureLoaded();
  let voto = 0;
  const muertes = mon.tMuertes.length;
  if (muertes >= 1)
    voto += 2;
  if (muertes >= 2)
    voto += 1;
  if (mon.tPociones.length >= 2)
    voto += 1;
  const huboCombate = mon.winCombatT >= COMBATE_MIN_S;
  const pctVida = p.maxHp > 0 ? mon.winDmg / p.maxHp : 0;
  if (huboCombate && pctVida >= 0.4)
    voto += 1;
  if (huboCombate && pctVida <= 0.1)
    voto -= 1;
  voto -= Math.min(2, mon.tFlawless.length);
  const ref = ZONA_NIVEL_REF[g.mapId] ?? 6;
  if (p.level >= ref + 2)
    voto -= 1;
  if (p.level <= ref - 2)
    voto += 1;
  voto = Math.max(-3, Math.min(3, voto));
  mon.votes.push(voto);
  if (mon.votes.length > HISTERESIS)
    mon.votes.shift();
  if (!b.auto || t < GRACIA_S)
    return;
  if (t - mon.lastChangeT < ENFRIAMIENTO_S)
    return;
  if (mon.votes.length < HISTERESIS)
    return;
  const sube = mon.votes.every((v) => v <= UMBRAL_SUBIR);
  const baja = mon.votes.every((v) => v >= UMBRAL_BAJAR);
  if (!sube && !baja)
    return;
  const dir = sube ? 1 : -1;
  const nuevo = clampLevel(b.level + dir);
  mon.votes = [];
  if (nuevo === b.level)
    return;
  b.level = nuevo;
  mon.lastChangeT = t;
  scheduleSave();
  if (t >= TOAST_GRACIA_S) {
    g.toast(dir < 0 ? "El mundo cede un paso atrás..." : "El mundo se torna más fiero...", dir < 0 ? "#8ef0b0" : "#e0a060");
  }
}
function balanceTick(g, dt) {
  const p = g.player;
  if (!p)
    return;
  if (g.challengeRun)
    return;
  const b = ensureLoaded();
  if (!mon)
    mon = newMonitor();
  if (mon.prevPlayer !== p) {
    mon.prevPlayer = p;
    mon.prevHp = p.hp;
    mon.prevDeaths = p.deaths;
    mon.prevPotions = p.potions;
    mon.inCombat = false;
    mon.spanDmg = 0;
    mon.spanT = 0;
    mon.winT = 0;
    mon.winDmg = 0;
    mon.winCombatT = 0;
    mon.tMuertes = [];
    mon.tFlawless = [];
    mon.tPociones = [];
    return;
  }
  const t = p.playTime;
  const combate = g.enemies.some((e) => !e.dead && e.aggro && e.ai !== "muerto");
  if (p.hp < mon.prevHp) {
    const d = mon.prevHp - p.hp;
    if (combate) {
      mon.winDmg += d;
      mon.spanDmg += d;
    }
  }
  mon.prevHp = p.hp;
  while (mon.prevDeaths < p.deaths) {
    mon.prevDeaths++;
    mon.tMuertes.push(t);
  }
  while (mon.prevPotions > p.potions) {
    mon.prevPotions--;
    mon.tPociones.push(t);
  }
  if (p.potions > mon.prevPotions)
    mon.prevPotions = p.potions;
  if (combate && g.state === "play") {
    if (!mon.inCombat) {
      mon.inCombat = true;
      mon.spanDmg = 0;
      mon.spanT = 0;
    }
    mon.spanT += dt;
    mon.winCombatT += dt;
  } else if (mon.inCombat) {
    mon.inCombat = false;
    if (mon.spanT >= FLAWLESS_MIN_S && mon.spanDmg === 0)
      mon.tFlawless.push(t);
  }
  b.recentDeaths = mon.tMuertes.length;
  b.recentFlawless = mon.tFlawless.length;
  mon.winT += dt;
  if (mon.winT >= VENTANA_S) {
    cerrarVentana(g, t);
    mon.winT = 0;
    mon.winDmg = 0;
    mon.winCombatT = 0;
  }
  const prune = (arr, win) => {
    while (arr.length > 0 && arr[0] < t - win)
      arr.shift();
  };
  prune(mon.tMuertes, MEMORIA_MUERTE_S);
  prune(mon.tFlawless, MEMORIA_FLAWLESS_S);
  prune(mon.tPociones, MEMORIA_POCION_S);
}
function enemyStatMult(g) {
  if (!g.player)
    return { hp: 1, dmg: 1, xp: 1 };
  if (g.challengeRun)
    return { hp: 1, dmg: 1, xp: 1 };
  return { ...multFor(ensureLoaded().level) };
}
function drawBalancePanel(g, x, y, w = 664, opts) {
  const b = ensureLoaded();
  const readOnly = opts?.readOnly === true;
  if (x === undefined)
    x = (g.canvas.width - 720) / 2 + 28;
  if (y === undefined)
    y = (g.canvas.height - 470) / 2 + 398;
  const h = readOnly ? 62 : 70;
  panel(g, x, y, w, h, "rgba(90,74,48,0.6)", "rgba(8,10,18,0.6)");
  textShadow(g, "◆ DIFICULTAD DEL MUNDO ◆", x + 10, y + 5, 16, COL.gold, "#000");
  text(g, b.auto ? "MODO AUTO" : "MODO MANUAL", x + w - 10, y + 7, 14, b.auto ? COL.quest : COL.goldSoft, "right");
  const mult = multFor(b.level);
  const cellW = 84, gap = 4, gy = y + 24, gh = 16;
  let gx = x + 10;
  for (let i = 0;i < 5; i++) {
    const activo = i - 2 === b.level;
    panel(g, gx, gy, cellW, gh, activo ? COL.gold : COL.panelBorder, activo ? "rgba(60,48,24,0.9)" : "rgba(12,14,24,0.8)");
    text(g, BALANCE_NAMES[i], gx + cellW / 2, gy + 2, 12, activo ? COL.goldSoft : COL.dim, "center");
    gx += cellW + gap;
  }
  const pct = (v) => v === 1 ? "+0%" : (v > 1 ? "+" : "-") + Math.round(Math.abs(v - 1) * 100) + "%";
  text(g, `Vida ${pct(mult.hp)} · Daño ${pct(mult.dmg)} · XP ${pct(mult.xp)}`, gx + 10, gy + 2, 13, COL.dim);
  if (!readOnly) {
    const by = y + 46, bh = 20;
    button(g, b.auto ? "Modo: AUTO" : "Modo: MANUAL", x + 10, by, 124, bh, () => setBalanceAuto(!b.auto), 11);
    button(g, "-", x + 138, by, 28, bh, () => nudgeBalanceLevel(-1), 11);
    button(g, "+", x + 170, by, 28, bh, () => nudgeBalanceLevel(1), 11);
    button(g, "Restablecer", x + 202, by, 120, bh, () => resetBalance(), 10);
    text(g, b.auto ? "Se ajusta solo según tu rendimiento (y se guarda)" : "Fijado a mano: el mundo no cambiará solo", x + 332, by + 5, 13, COL.dim);
  } else {
    text(g, b.auto ? "Ajuste automático: observa tu rendimiento y se guarda solo" : "Nivel fijado a mano (persistente entre sesiones)", x + 10, y + 45, 13, COL.dim);
  }
  return h;
}

// src/game/armor.ts
var ARMOR_HEAVY_SPEED = 0.92;
var ARMORS = [
  {
    tier: 1,
    id: "armor_1",
    name: "Coraza de Cuero",
    cost: 80,
    red: 0.08,
    desc: "Cuero curtido de lobo de Niebla. Ligera y honesta."
  },
  {
    tier: 2,
    id: "armor_2",
    name: "Malla del Alba",
    cost: 160,
    red: 0.15,
    desc: "Anillos tejidos con la primera luz. +10 vigor/s.",
    staRegen: 10
  },
  {
    tier: 3,
    id: "armor_3",
    name: "Placas del Canto",
    cost: 240,
    red: 0.22,
    desc: "Placas grabadas con notas. Pesadas: −8% de velocidad.",
    slow: true
  },
  {
    tier: 4,
    id: "armor_4",
    name: "Manto de Ecos",
    cost: 280,
    red: 0.12,
    desc: "Devuelve parte de cada golpe melé: refleja 15% del daño.",
    reflect: 0.15
  },
  {
    tier: 5,
    id: "armor_5",
    name: "Guarda del Primer Canto",
    cost: 420,
    red: 0.28,
    desc: "Única. Solo para quien ha oído el tercer canto hasta el final.",
    needFlag: "acto3Done"
  }
];
function armorDefFor(tier) {
  return ARMORS.find((a) => a.tier === tier) ?? null;
}
function armorActiveId(g) {
  let best = 0;
  for (const a of ARMORS) {
    if (g.flags[a.id] && a.tier > best)
      best = a.tier;
  }
  return best;
}
function armorActive(g) {
  return armorDefFor(armorActiveId(g));
}
function armorReduction(g) {
  return armorActive(g)?.red ?? 0;
}
function armorTick(g, dt) {
  const a = armorActive(g);
  if (!a?.staRegen)
    return;
  const p = g.player;
  if (!p || g.state !== "play")
    return;
  p.sta = Math.min(p.maxSta, p.sta + a.staRegen * dt);
}
function drawArmorRow(g, x, y, w) {
  const act = armorActive(g);
  text(g, "◆ ARMADURA", x, y + 1, 11, COL.gold, "left", true);
  if (!act) {
    text(g, "ninguna — la forja de Toln vende corazas (Coraza de Cuero, Malla del Alba…)", x + 112, y, 14, COL.dim);
  } else {
    const pct = Math.round(act.red * 100);
    const extras = [];
    if (act.staRegen)
      extras.push(`+${act.staRegen} vigor/s`);
    if (act.slow)
      extras.push("−8% velocidad");
    if (act.reflect)
      extras.push(`refleja ${Math.round(act.reflect * 100)}% melé`);
    text(g, `${act.name} — daño recibido −${pct}%${extras.length ? " · " + extras.join(" · ") : ""}`, x + 112, y, 14, COL.goldSoft);
  }
  const ctx = g.ctx;
  ctx.fillStyle = "rgba(90,74,48,0.45)";
  ctx.fillRect(x, y + 16, Math.max(0, w), 1);
  return 18;
}

// src/game/achievements.ts
var LS_LOGROS = "ecos-logros";
var LS_DESAFIO_RECORDS = "ecos-desafio-récords";
var LS_SAVE = "ecos-aelthar-save";
var LS_DESAFIO_BEST = "ecos-desafio-best";
function defaultStats() {
  return {
    enemigosDerrotados: 0,
    jefesDerrotados: 0,
    muertes: 0,
    coronasGanadas: 0,
    coronasGastadas: 0,
    pocionesUsadas: 0,
    vecesCambioEpoca: 0,
    distanciaAndada: 0,
    tiempoJugado: 0,
    memoriasHalladas: 0
  };
}
function sanitizeStats(raw) {
  const out = defaultStats();
  if (!raw || typeof raw !== "object")
    return out;
  const r = raw;
  for (const k of Object.keys(out)) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0)
      out[k] = v;
  }
  return out;
}
function statsTick(g, dt) {
  g.stats.tiempoJugado += dt;
  const p = g.player;
  if (p)
    g.stats.memoriasHalladas = p.memories?.length ?? 0;
}
var LOGROS = [
  { id: "primer_canto", name: "Primer Canto", desc: "Derrota a tu primer enemigo" },
  { id: "cazador_ecos", name: "Cazador de Ecos", desc: "Escucha 5 ecos menores" },
  { id: "rompejefes", name: "Rompejefes", desc: "Derrota a 3 jefes" },
  { id: "corazon_alba", name: "Corazón de Alba", desc: "Completa el Acto I" },
  { id: "notas_perdidas", name: "Notas Perdidas", desc: "Completa el Acto II" },
  { id: "canto_al_reves", name: "Canto al Revés", desc: "Completa el Acto III" },
  { id: "ultima_nota", name: "El Último Canto (próximamente)", desc: "Completa el Acto IV (aún no ha sonado)" },
  { id: "invicto", name: "Invicto", desc: "Alcanza el nivel 5 sin morir" },
  { id: "rico", name: "Rico", desc: "Reúne 500 coronas en mano" },
  { id: "alquimista", name: "Alquimista", desc: "Bebe 10 pociones" },
  { id: "viajero_tiempo", name: "Viajero del Tiempo", desc: "Cambia de época 10 veces" },
  { id: "rondador", name: "Rondador", desc: "Gana un desafío con más del 70% de vida" }
];
var done = new Set;
var loaded = false;
var pendientes = LOGROS.length;
function ensureLoaded2() {
  if (loaded)
    return done;
  loaded = true;
  done = new Set;
  try {
    const raw = localStorage.getItem(LS_LOGROS);
    if (raw) {
      const d = JSON.parse(raw);
      const arr = Array.isArray(d) ? d : d && typeof d === "object" && Array.isArray(d.done) ? d.done : null;
      if (arr) {
        for (const s of arr)
          if (typeof s === "string" && LOGROS.some((l) => l.id === s))
            done.add(s);
      }
    }
  } catch {
    done = new Set;
  }
  pendientes = Math.max(0, LOGROS.length - done.size);
  return done;
}
function logrosCount() {
  ensureLoaded2();
  return { done: done.size, total: LOGROS.length };
}
function isLogroDone(id) {
  return ensureLoaded2().has(id);
}
function persist() {
  try {
    localStorage.setItem(LS_LOGROS, JSON.stringify({ v: 1, done: [...done] }));
  } catch {}
}
function logroName(id, g) {
  const def = LOGROS.find((l) => l.id === id);
  if (!def)
    return id;
  if (id === "ultima_nota" && g && acto4FlagDe(g))
    return "El Último Canto";
  return def.name;
}
function tryUnlock(g, id, cond) {
  if (!cond)
    return;
  const d = ensureLoaded2();
  if (d.has(id))
    return;
  d.add(id);
  pendientes = Math.max(0, pendientes - 1);
  persist();
  g.toast(`¡Logro: ${logroName(id, g)}!`, COL.gold);
  audio.sfx("levelup");
}
var ACTO4_FLAGS = ["acto4Done", "acto4", "actoIVDone", "acto4Report", "acto4Seen", "finalActo4"];
function acto4FlagDe(g) {
  try {
    const f = g.flags;
    for (const k of ACTO4_FLAGS)
      if (f[k])
        return k;
    const anyG = g;
    for (const k of ACTO4_FLAGS)
      if (anyG[k])
        return k;
  } catch {}
  return null;
}
function bossFlagsCount(f) {
  let n = 0;
  for (const flag of Object.values(BOSS_DEFEAT_FLAG))
    if (f[flag])
      n++;
  return n;
}
function achievementTick(g) {
  if (pendientes <= 0)
    return;
  if (g.challengeRun)
    return;
  const p = g.player;
  if (!p)
    return;
  const f = g.flags;
  const st = g.stats;
  tryUnlock(g, "primer_canto", st.enemigosDerrotados >= 1);
  tryUnlock(g, "cazador_ecos", g.takenEchoes.size >= 5);
  tryUnlock(g, "rompejefes", bossFlagsCount(f) >= 3);
  tryUnlock(g, "corazon_alba", g.questIdx >= 5 || !!f.acto2Done);
  tryUnlock(g, "notas_perdidas", !!f.acto2Done);
  tryUnlock(g, "canto_al_reves", !!f.acto3Done);
  tryUnlock(g, "invicto", p.level >= 5 && p.deaths === 0);
  tryUnlock(g, "rico", p.gold >= 500);
  tryUnlock(g, "alquimista", st.pocionesUsadas >= 10);
  tryUnlock(g, "viajero_tiempo", st.vecesCambioEpoca >= 10);
  tryUnlock(g, "ultima_nota", !!acto4FlagDe(g));
}
function readRecords() {
  try {
    const raw = localStorage.getItem(LS_DESAFIO_RECORDS);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && typeof d === "object" && d.times && typeof d.times === "object") {
        const times = {};
        for (const [k, arr] of Object.entries(d.times)) {
          if (Array.isArray(arr)) {
            times[k] = arr.filter((n) => typeof n === "number" && Number.isFinite(n) && n > 0).slice(0, 3);
          }
        }
        return { v: 1, times };
      }
    }
  } catch {}
  return { v: 1, times: {} };
}
function recordChallengeTime(key, sec, lowerIsBetter) {
  if (!(sec > 0))
    return;
  const f = readRecords();
  const arr = f.times[key] ?? [];
  arr.push(Math.round(sec * 10) / 10);
  arr.sort((a, b) => lowerIsBetter ? a - b : b - a);
  f.times[key] = arr.slice(0, 3);
  try {
    localStorage.setItem(LS_DESAFIO_RECORDS, JSON.stringify(f));
  } catch {}
}
function readChallengeRecords() {
  const f = readRecords();
  return Object.entries(f.times).map(([key, times]) => ({ key, times }));
}
function readOleadasBest() {
  try {
    const v = Number(localStorage.getItem(LS_DESAFIO_BEST) ?? "0");
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}
function recordChallengeResult(g, mode, boss, victory, hpRatio, timeSec) {
  if (mode === "jefe" && boss) {
    if (victory)
      recordChallengeTime(`duelo:${boss}`, timeSec, true);
  } else if (mode === "oleadas") {
    recordChallengeTime("oleadas", timeSec, false);
  }
  if (victory && hpRatio > 0.7)
    tryUnlock(g, "rondador", true);
}
function num(v, def) {
  return typeof v === "number" && Number.isFinite(v) ? v : def;
}
function readLastSave() {
  try {
    const raw = localStorage.getItem(LS_SAVE);
    if (!raw)
      return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object")
      return null;
    const pl = d.player;
    if (!pl || typeof pl !== "object")
      return null;
    return {
      name: typeof pl.name === "string" ? pl.name : "Portador",
      level: num(pl.level, 1),
      gold: num(pl.gold, 0),
      kills: num(pl.kills, 0),
      deaths: num(pl.deaths, 0),
      playTime: num(pl.playTime, 0),
      memories: Array.isArray(pl.memories) ? pl.memories.length : 0,
      questIdx: num(d.questIdx, 0),
      stats: sanitizeStats(d.stats)
    };
  } catch {
    return null;
  }
}
var statsOpen = false;
var logrosOpen = false;
function openStatsPanel() {
  statsOpen = true;
  logrosOpen = false;
  audio.sfx("confirm");
}
function openLogrosPanel() {
  logrosOpen = true;
  statsOpen = false;
  audio.sfx("confirm");
}
function closeTitlePanels() {
  statsOpen = false;
  logrosOpen = false;
}
function drawTitlePanels(g) {
  if (g.state !== "title")
    return;
  if (statsOpen)
    drawStatsPanel(g);
  else if (logrosOpen)
    drawLogrosPanel(g);
}
function fmtDur(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}
function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
var RECORD_LABELS = {
  oleadas: "Oleadas (supervivencia)",
  "duelo:guardian": "Duelo · Guardián Hueco",
  "duelo:sirena": "Duelo · Sirena Abisal",
  "duelo:golem": "Duelo · Gólem de Escarcha"
};
function drawStatsPanel(g) {
  const ctx = g.ctx;
  g.uiHit.length = 0;
  const w = 620, h = 440;
  const x = VIEW_W / 2 - w / 2;
  const y = Math.max(18, Math.round(VIEW_H / 2 - h / 2));
  ctx.fillStyle = "rgba(4,6,14,0.72)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, x, y, w, h);
  textShadow(g, "◆ ESTADÍSTICAS DEL PORTADOR ◆", VIEW_W / 2, y + 16, 15, COL.gold, "#000", "center", true);
  const s = readLastSave();
  let ly;
  if (!s) {
    text(g, "Aún no hay partidas.", VIEW_W / 2, y + 64, 19, COL.dim, "center");
    text(g, "Cuando juegues, el juego recordará aquí tus hazañas", VIEW_W / 2, y + 96, 15, "rgba(154,160,184,0.8)", "center");
    text(g, "(se guardan con la partida, igual que tu canto).", VIEW_W / 2, y + 114, 15, "rgba(154,160,184,0.8)", "center");
    ly = y + 150;
  } else {
    const st = s.stats;
    const memTotal = Object.keys(MEMORIES).length;
    const rows = [
      ["Portador", `${s.name} — Nivel ${s.level}`],
      ["Tiempo de juego", fmtDur(st.tiempoJugado || s.playTime)],
      ["Enemigos derrotados", `${st.enemigosDerrotados || s.kills}   ·   Jefes: ${st.jefesDerrotados}`],
      ["Muertes", `${st.muertes || s.deaths}   ·   Pociones usadas: ${st.pocionesUsadas}`],
      ["Coronas ganadas / gastadas", `${st.coronasGanadas} / ${st.coronasGastadas}`],
      ["Cambios de época", `${st.vecesCambioEpoca}   ·   Memorias: ${st.memoriasHalladas || s.memories}/${memTotal}`],
      ["Distancia recorrida", `≈ ${Math.round(st.distanciaAndada / TILE)} tiles`]
    ];
    text(g, "ÚLTIMO GUARDADO", x + 30, y + 46, 13, COL.goldSoft);
    ly = y + 68;
    for (const [k, v] of rows) {
      text(g, k, x + 30, ly, 15, COL.dim);
      text(g, v, x + 250, ly, 15, COL.text);
      ly += 24;
    }
    ly += 2;
  }
  ctx.strokeStyle = "rgba(90,74,48,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 30, ly);
  ctx.lineTo(x + w - 30, ly);
  ctx.stroke();
  ly += 10;
  text(g, "◆ MEJORES MARCAS DEL DESAFÍO ◆", x + 30, ly + 4, 13, COL.gold);
  ly += 26;
  const best = readOleadasBest();
  if (best > 0) {
    text(g, "Récord de oleadas (puntos)", x + 30, ly, 14, COL.dim);
    text(g, `${best}`, x + w - 30, ly, 14, COL.goldSoft, "right");
    ly += 18;
  }
  const recs = readChallengeRecords();
  if (recs.length === 0 && best === 0) {
    text(g, "Sin marcas todavía: la arena te espera.", x + 30, ly, 14, "rgba(154,160,184,0.75)");
    ly += 18;
  } else {
    for (const r of recs) {
      const label = RECORD_LABELS[r.key] ?? r.key;
      text(g, label, x + 30, ly, 14, COL.dim);
      text(g, r.times.map(fmtClock).join("  ·  "), x + w - 30, ly, 14, COL.goldSoft, "right");
      ly += 18;
    }
  }
  button(g, "VOLVER (ESC)", VIEW_W / 2 - 90, y + h - 40, 180, 32, () => closeTitlePanels(), 10);
  if (g.keys.has("escape"))
    closeTitlePanels();
}
function drawLogrosPanel(g) {
  const ctx = g.ctx;
  g.uiHit.length = 0;
  const w = 640, h = 440;
  const x = VIEW_W / 2 - w / 2;
  const y = Math.max(18, Math.round(VIEW_H / 2 - h / 2));
  ctx.fillStyle = "rgba(4,6,14,0.72)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, x, y, w, h);
  textShadow(g, "◆ LOGROS ◆", VIEW_W / 2, y + 16, 16, COL.gold, "#000", "center", true);
  const cnt = logrosCount();
  text(g, `${cnt.done} / ${cnt.total} conseguidos`, VIEW_W / 2, y + 42, 15, cnt.done > 0 ? COL.goldSoft : COL.dim, "center");
  const colW = (w - 70) / 2;
  LOGROS.forEach((def, i) => {
    const cx0 = x + 30 + i % 2 * (colW + 24);
    const ry = y + 70 + Math.floor(i / 2) * 54;
    const got = isLogroDone(def.id);
    text(g, `${got ? "✓" : "·"} ${logroName(def.id, g)}`, cx0, ry, 15, got ? COL.gold : COL.dim);
    const lines = wrapText(def.desc, 36).slice(0, 2);
    lines.forEach((l, j) => text(g, l, cx0 + 13, ry + 18 + j * 13, 13, got ? COL.text : "rgba(154,160,184,0.7)"));
  });
  button(g, "VOLVER (ESC)", VIEW_W / 2 - 90, y + h - 40, 180, 32, () => closeTitlePanels(), 10);
  if (g.keys.has("escape"))
    closeTitlePanels();
}

// src/game/challenge.ts
var LS_BEST = "ecos-desafio-best";
var LS_LOGROS2 = "ecos-desafio-logros";
var SAVE_KEY = "ecos-aelthar-save";
var CENTER_TX = 21;
var CENTER_TY = 16;
var BOSS_INFO = {
  guardian: { name: "GUARDIÁN HUECO", sub: "El primer coro, vaciado de voz" },
  sirena: { name: "SIRENA ABISAL", sub: "La marea que canta nombres ajenos" },
  golem: { name: "GÓLEM DE ESCARCHA", sub: "El invierno que aprendió a esperar" }
};
var menuOpen = false;
function readBest() {
  try {
    const v = Number(localStorage.getItem(LS_BEST) ?? "0");
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}
function readLogros() {
  try {
    const raw = localStorage.getItem(LS_LOGROS2);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}
function writeLogros(list) {
  try {
    localStorage.setItem(LS_LOGROS2, JSON.stringify(list));
  } catch {}
}
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function mulberry324(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeArenaPlayer() {
  const maxHp = 158;
  return {
    kind: "player",
    name: "Portador de Arena",
    discipline: "alba",
    x: 0,
    y: 0,
    w: 10,
    h: 8,
    vx: 0,
    vy: 0,
    dir: "down",
    hp: maxHp,
    maxHp,
    sprite: "hero_alba",
    anim: 0,
    moving: false,
    level: 8,
    xp: 0,
    sta: 100,
    maxSta: 100,
    res: 0,
    maxRes: 100,
    attrs: { fue: 5, des: 5, int: 3, esp: 3, vig: 5 },
    points: 0,
    gold: 0,
    weaponPlus: 2,
    potions: 2,
    cds: [0, 0, 0, 0],
    iframes: 0,
    parryT: 0,
    parryFx: 0,
    attackT: 0,
    combo: 0,
    chargeT: 0,
    charging: false,
    rollT: 0,
    lastHitT: 0,
    hasEcho: false,
    kills: 0,
    deaths: 0,
    repGuardianes: 0,
    playTime: 0,
    tones: { empatico: 0, pragmatico: 0, sarcastico: 0, amenazante: 0 },
    memories: [],
    repFacciones: { guardianes: 0, orden: 0, circulo: 0, liga: 0 }
  };
}
function snapshotCampaign(g) {
  const p = g.player;
  let saveRaw = null;
  try {
    saveRaw = localStorage.getItem(SAVE_KEY);
  } catch {}
  return {
    fromCampaign: !!p,
    gold: p?.gold ?? 0,
    potions: p?.potions ?? 0,
    deaths: p?.deaths ?? 0,
    kills: p?.kills ?? 0,
    playTime: p?.playTime ?? 0,
    hp: p?.hp ?? 0,
    sta: p?.sta ?? 0,
    res: p?.res ?? 0,
    questIdx: g.questIdx,
    questStep: g.questStep,
    flags: { ...g.flags },
    memories: [...p?.memories ?? []],
    repFacciones: p?.repFacciones ? { ...p.repFacciones } : undefined,
    deadGolds: g.deadGolds.slice(),
    saveRaw
  };
}
function restoreCampaign(g, run) {
  const s = run.snap;
  if (!s)
    return;
  const p = g.player;
  if (s.fromCampaign && p) {
    p.gold = s.gold;
    p.potions = s.potions;
    p.deaths = s.deaths;
    p.kills = s.kills;
    p.playTime = s.playTime;
    p.hp = s.hp;
    p.sta = s.sta;
    p.res = s.res;
    p.memories = s.memories;
    p.repFacciones = s.repFacciones;
    g.questIdx = s.questIdx;
    g.questStep = s.questStep;
    g.flags = { ...s.flags };
    g.deadGolds = s.deadGolds;
  } else if (!s.fromCampaign) {
    g.deadGolds = [];
  }
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {}
  if (raw !== s.saveRaw)
    run.resave = s.saveRaw === null ? "remove" : "rewrite";
}
function waveMult(w) {
  return 1 + 0.12 * (w - 1);
}
function waveComposition(w) {
  if (w === 1)
    return ["lobo", "lobo", "lobo"];
  if (w === 2)
    return ["lobo", "sombra", "lobo", "sombra"];
  if (w === 3)
    return ["guardian", "esqueleto", "esqueleto"];
  if (w === 4)
    return ["neumo", "neumo", "espectro", "espectro"];
  if (w === 5)
    return ["arpi", "arpi", "espectro", "neumo"];
  if (w === 6)
    return ["guardian", "arpi", "arpi", "espectro"];
  if (w === 7)
    return ["espectro", "espectro", "neumo", "arpi", "sombra", "lobo"];
  const pool2 = ["lobo", "sombra", "esqueleto", "neumo", "espectro", "arpi"];
  const rng2 = mulberry324(w * 7919);
  const n = Math.min(10, 5 + Math.floor((w - 7) / 2));
  const out = [];
  for (let i = 0;i < n; i++)
    out.push(pool2[Math.floor(rng2() * pool2.length)]);
  if (w % 3 === 0)
    out.unshift("guardian");
  return out;
}
function spawnArenaEnemy(g, run, type, mult) {
  const p = g.player;
  const def = ENEMY_DEFS[type];
  const big = type === "guardian" || type === "sirena" || type === "golem";
  const bw = big ? 22 : 12;
  const bh = big ? 16 : 10;
  const push = (x, y) => {
    const e = g.makeEnemy(type, x, y, 2, "arena");
    const scaled = Math.max(1, Math.round(def.hp * (type === "guardian" ? mult * 0.75 : mult)));
    e.hp = scaled;
    e.maxHp = scaled;
    g.enemies.push(e);
    run.spawnedTotal = (run.spawnedTotal ?? 0) + 1;
  };
  for (let tries = 0;tries < 40; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = (8 + Math.random() * 6) * TILE;
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    if (x < 2.5 * TILE || y < 2.5 * TILE)
      continue;
    if (x > (g.map.w - 2.5) * TILE || y > (g.map.h - 2.5) * TILE)
      continue;
    if (g.tileSolidAt(x, y))
      continue;
    if (!g.boxFree(x, y, bw, bh))
      continue;
    push(x, y);
    return;
  }
  push((CENTER_TX + 0.5) * TILE, (CENTER_TY + 6) * TILE);
}
function startWave(g, run) {
  run.wave++;
  run.spawnQueue = waveComposition(run.wave);
  run.spawnT = 0.2;
  run.waveTime = 0;
  run.waveHadBoss = run.spawnQueue.includes("guardian");
  run.waveBossDown = !run.waveHadBoss;
  run.bannerT = 2.2;
  run.bannerText = run.waveHadBoss ? `OLEADA ${run.wave} · CENTINELA DEL ECO` : `OLEADA ${run.wave}`;
  audio.sfx("banner");
  if (run.waveHadBoss) {
    g.bossActive = true;
    g.toast("Un Centinela del Eco despierta en la arena", COL.boss);
  }
}
function spawnDuelBoss(g, run, id) {
  const info = BOSS_INFO[id] ?? BOSS_INFO.guardian;
  const type = id;
  const bx = (CENTER_TX + 0.5) * TILE;
  const by = (CENTER_TY - 8) * TILE;
  const e = g.makeEnemy(type, bx, by, 0, "boss");
  run.spawnedTotal = (run.spawnedTotal ?? 0) + 1;
  run.bossEnemy = e;
  g.enemies.push(e);
  g.bossRef = e;
  g.bossActive = true;
  g.bossBannerT = 2.6;
  g.bossBannerText = info.name;
  g.bossBannerSub = info.sub;
  audio.sfx("roar");
  g.toast(`DUELO 1v1 — ${info.name}: una sola vida, sin pociones`, COL.boss);
}
function challengeTick(g, dt) {
  const run = g.challengeRun;
  if (!run || run.phase !== "jugando")
    return;
  if (g.state === "play" && g.mapId !== ARENA_MAP_ID) {
    restoreCampaign(g, run);
    const temp = !run.snap?.fromCampaign;
    g.challengeRun = null;
    g.bossRef = null;
    g.bossActive = false;
    audio.setCombat(false);
    if (temp) {
      g.player = null;
      g.setState("title");
    } else {
      g.toast("Has abandonado el Desafío. Tu canto retoma la campaña donde estaba...", "#c8b0e8");
    }
    return;
  }
  if (run.playerRef && g.player !== run.playerRef) {
    g.challengeRun = null;
    g.bossRef = null;
    g.bossActive = false;
    return;
  }
  if (g.state !== "play" || !g.player)
    return;
  const p = g.player;
  run.timeSec = (run.timeSec ?? 0) + dt;
  if (run.bannerT && run.bannerT > 0)
    run.bannerT -= dt;
  if (run.mode === "oleadas" && run.wave > 0)
    run.waveTime += dt;
  run.kills = Math.max(run.kills, (run.spawnedTotal ?? 0) - g.enemies.length);
  run.score = (run.wavesCleared ?? 0) + run.kills;
  if (run.endBeat !== undefined) {
    run.endBeat -= dt;
    if (run.endBeat <= 0)
      finish(g, run, true);
    return;
  }
  if (run.mode === "jefe") {
    const be = run.bossEnemy;
    if (be && be.dead) {
      run.endBeat = 1.7;
      g.enemies = [];
      g.projectiles = [];
      g.waves = [];
      g.telegraphs = [];
      g.bossRef = null;
      g.bossActive = false;
      audio.setCombat(false);
    }
    return;
  }
  if (run.waveHadBoss && !run.waveBossDown && !g.enemies.some((e) => e.etype === "guardian" && !e.dead)) {
    run.waveBossDown = true;
    audio.playTrack("boss");
    g.toasts = g.toasts.filter((t) => !t.text.includes("Guardián Hueco") && !t.text.includes("altar del Eco"));
    g.toast("El Centinela del Eco cae hecho añicos", COL.goldSoft);
  }
  if (run.betweenWaves > 0) {
    run.betweenWaves -= dt;
    if (run.betweenWaves <= 0)
      startWave(g, run);
    return;
  }
  if (run.spawnQueue && run.spawnQueue.length > 0) {
    run.spawnT = (run.spawnT ?? 0) - dt;
    if (run.spawnT <= 0) {
      const type = run.spawnQueue.shift();
      if (type)
        spawnArenaEnemy(g, run, type, waveMult(run.wave));
      run.spawnT = 0.5;
    }
    return;
  }
  if (run.wave > 0 && g.enemies.length === 0) {
    run.wavesCleared = run.wave;
    run.score = (run.wavesCleared ?? 0) + run.kills;
    const heal = Math.round(p.maxHp * 0.15);
    if (p.hp > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + heal);
      g.floatAt(p.x, p.y - 18, `+${heal}`, "#7ef0a0");
    }
    audio.sfx("quest");
    g.toast(`Oleada ${run.wave} superada. Respira: la Niebla vuelve en 3...`, "#8ef0b0");
    run.betweenWaves = 3;
    run.waveHadBoss = false;
    run.waveBossDown = false;
    run.bannerT = 0;
  }
}
function onChallengeDeath(g) {
  const run = g.challengeRun;
  if (!run)
    return;
  if (run.phase !== "jugando") {
    g.challengeRun = null;
    return;
  }
  finish(g, run, false);
}
function startChallenge(g, mode, boss) {
  if (g.challengeRun && g.challengeRun.phase === "jugando")
    return;
  menuOpen = false;
  const snap = snapshotCampaign(g);
  if (!g.player)
    g.player = makeArenaPlayer();
  g.epoch = "presente";
  g.loadMap(ARENA_MAP_ID, CENTER_TX, CENTER_TY);
  g.epoch = "presente";
  const p = g.player;
  if (p) {
    p.hp = p.maxHp;
    p.sta = p.maxSta;
    p.res = 0;
    p.iframes = 0;
    p.rollT = 0;
    p.attackT = 0;
    p.charging = false;
    p.chargeT = 0;
    p.cds = [0, 0, 0, 0];
    if (mode === "jefe")
      p.potions = 0;
  }
  const run = {
    mode,
    boss: mode === "jefe" ? boss && BOSS_INFO[boss] ? boss : "guardian" : undefined,
    wave: 0,
    waveTime: 0,
    betweenWaves: mode === "oleadas" ? 3.4 : 0,
    kills: 0,
    score: 0,
    active: true,
    phase: "jugando",
    wavesCleared: 0,
    timeSec: 0,
    spawnQueue: [],
    spawnT: 0,
    spawnedTotal: 0,
    bossEnemy: null,
    bannerT: 0,
    bannerText: "",
    best: readBest(),
    newBest: false,
    snap,
    playerRef: g.player
  };
  g.challengeRun = run;
  g.projectiles = [];
  g.waves = [];
  g.telegraphs = [];
  g.toasts = [];
  g.bossRef = null;
  g.bossActive = false;
  if (mode === "oleadas") {
    run.bannerT = 3.4;
    run.bannerText = "SOBREVIVE";
    g.toast("El Desafío comienza: la arena juzga, no perdona", COL.goldSoft);
  } else {
    spawnDuelBoss(g, run, run.boss);
  }
  audio.playTrack("boss");
  g.setState("play");
}
function endChallenge(g, _victory) {
  const run = g.challengeRun;
  g.challengeRun = null;
  menuOpen = false;
  if (run?.snap && !run.snap.fromCampaign)
    g.player = null;
  g.enemies = [];
  g.loadMap("lunaris", 25, 19);
  if (run?.resave === "rewrite") {
    g.save();
  } else if (run?.resave === "remove") {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
  }
  g.setState("title");
}
function finish(g, run, victory) {
  run.active = false;
  run.phase = "resultado";
  run.resultWin = victory;
  run.score = (run.wavesCleared ?? 0) + run.kills;
  const hpRatioPre = g.player && g.player.maxHp > 0 ? g.player.hp / g.player.maxHp : 0;
  if (run.mode === "oleadas" && run.score > (run.best ?? 0)) {
    try {
      localStorage.setItem(LS_BEST, String(run.score));
    } catch {}
    run.best = run.score;
    run.newBest = true;
  }
  restoreCampaign(g, run);
  g.enemies = [];
  g.projectiles = [];
  g.waves = [];
  g.telegraphs = [];
  g.bossRef = null;
  g.bossActive = false;
  audio.setCombat(false);
  g.toasts = [];
  recordChallengeResult(g, run.mode, run.boss, victory, hpRatioPre, run.timeSec ?? 0);
  if (victory && run.mode === "jefe" && run.snap?.fromCampaign && run.boss && g.player) {
    const logros = readLogros();
    const key = `duelo:${run.boss}`;
    if (!logros.includes(key)) {
      logros.push(key);
      writeLogros(logros);
      g.player.potions += 1;
      audio.sfx("coin");
      g.toast("Recompensa del Desafío: +1 poción", "#7ef0a0");
      g.floatAt(g.player.x, g.player.y - 26, "+1 poción", "#7ef0a0", 8);
    }
  }
  audio.sfx(victory ? "levelup" : "die");
  menuOpen = false;
  g.setState("title");
}
function drawChallengeOverlay(g) {
  const run = g.challengeRun;
  if (!run || run.phase !== "jugando")
    return;
  const ctx = g.ctx;
  if ((run.bannerT ?? 0) > 0 && run.bannerText) {
    const a = Math.min(1, run.bannerT * 1.4);
    ctx.globalAlpha = a;
    textShadow(g, run.bannerText, VIEW_W / 2, Math.round(VIEW_H * 0.26), 26, COL.gold, "#000", "center", true);
    ctx.globalAlpha = 1;
  }
  if (run.mode === "jefe") {
    text(g, `DUELO 1v1 · una vida · sin pociones · ${fmtTime(run.timeSec ?? 0)}`, VIEW_W / 2, 40, 13, "rgba(200,190,230,0.85)", "center");
    return;
  }
  const py = g.bossActive ? 54 : 6;
  const w = 320;
  const x = VIEW_W / 2 - w / 2;
  panel(g, x, py, w, 46);
  textShadow(g, `OLEADA ${Math.max(1, run.wave)}`, VIEW_W / 2, py + 7, 14, COL.gold, "#000", "center", true);
  const record = run.best ?? 0;
  text(g, `Enemigos: ${g.enemies.length + (run.spawnQueue?.length ?? 0)}   ·   PUNTOS: ${run.score}   ·   RÉCORD: ${record}`, VIEW_W / 2, py + 26, 14, COL.text, "center");
  if (run.betweenWaves > 0) {
    textShadow(g, `Próxima oleada en ${Math.max(1, Math.ceil(run.betweenWaves))}`, VIEW_W / 2, Math.round(VIEW_H * 0.34), 19, COL.goldSoft, "#000", "center", true);
  }
}
function drawChallengeTitleUi(g) {
  const run = g.challengeRun;
  if (run && run.phase === "resultado") {
    drawResults(g, run);
    return;
  }
  if (menuOpen)
    drawMenu(g);
}
function openChallengeMenu() {
  menuOpen = true;
  audio.sfx("confirm");
}
function drawMenu(g) {
  const ctx = g.ctx;
  g.uiHit.length = 0;
  const w = 560, h = 340;
  const x = VIEW_W / 2 - w / 2;
  const y = Math.max(24, Math.round(VIEW_H / 2 - h / 2));
  ctx.fillStyle = "rgba(4,6,14,0.72)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, x, y, w, h);
  textShadow(g, "MODO DESAFÍO", VIEW_W / 2, y + 16, 18, COL.gold, "#000", "center", true);
  text(g, "La arena del Eco recuerda a los Portadores que cayeron de pie.", VIEW_W / 2, y + 44, 15, COL.dim, "center");
  const best = readBest();
  text(g, `Récord de oleadas: ${best > 0 ? String(best) : "—"}`, VIEW_W / 2, y + 64, 15, COL.goldSoft, "center");
  button(g, "OLEADAS · sobrevive sin fin", x + 60, y + 90, w - 120, 38, () => startChallenge(g, "oleadas"), 12);
  const logros = readLogros();
  const mark = (id) => logros.includes(`duelo:${id}`) ? "  ✓" : "";
  button(g, `DUELO · Guardián Hueco${mark("guardian")}`, x + 60, y + 138, w - 120, 34, () => startChallenge(g, "jefe", "guardian"), 11, COL.boss);
  button(g, `DUELO · Sirena Abisal${mark("sirena")}`, x + 60, y + 178, w - 120, 34, () => startChallenge(g, "jefe", "sirena"), 11, COL.boss);
  button(g, `DUELO · Gólem de Escarcha${mark("golem")}`, x + 60, y + 218, w - 120, 34, () => startChallenge(g, "jefe", "golem"), 11, COL.boss);
  const nota = wrapText("El duelo es a una sola vida y sin pociones. Ganar por primera vez a cada jefe con tu Portador de campaña otorga +1 poción. Las coronas de la arena son ecos: se disuelven al salir.", 62);
  nota.forEach((l, i) => text(g, l, x + 34, y + 262 + i * 14, 13, COL.dim, "left"));
  button(g, "VOLVER (ESC)", x + w / 2 - 80, y + h - 42, 160, 30, () => {
    menuOpen = false;
    audio.sfx("uiOpen");
  }, 10);
  if (g.keys.has("escape")) {
    menuOpen = false;
    audio.sfx("uiOpen");
  }
}
function drawResults(g, run) {
  const ctx = g.ctx;
  g.uiHit.length = 0;
  const win = run.resultWin === true;
  const w = 480, h = 336;
  const x = VIEW_W / 2 - w / 2;
  const y = Math.max(28, Math.round(VIEW_H / 2 - h / 2));
  ctx.fillStyle = "rgba(4,6,14,0.78)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, x, y, w, h, win ? COL.gold : "#5a3040");
  textShadow(g, win ? "VICTORIA" : "DERROTA", VIEW_W / 2, y + 18, 22, win ? COL.gold : "#e06878", "#000", "center", true);
  const bossName = BOSS_INFO[run.boss ?? "guardian"]?.name ?? "EL JEFE";
  const sub = run.mode === "jefe" ? win ? `${bossName} ha caído ante tu canto` : `${bossName} sigue en pie... esta vez` : "La Niebla se ha llevado la ronda";
  text(g, sub, VIEW_W / 2, y + 52, 15, COL.dim, "center");
  const lines = [];
  lines.push(run.mode === "jefe" ? `Modalidad: Duelo 1v1 · ${bossName}` : "Modalidad: Oleadas");
  if (run.mode === "oleadas")
    lines.push(`Oleadas superadas: ${run.wavesCleared ?? 0}`);
  lines.push(`Enemigos abatidos: ${run.kills}`);
  lines.push(`Tiempo: ${fmtTime(run.timeSec ?? 0)}`);
  if (run.mode === "oleadas") {
    lines.push(`Puntuación: ${run.score}`);
    lines.push(`Récord: ${run.best ?? 0}`);
  }
  lines.forEach((l, i) => {
    const highlight = run.mode === "oleadas" && l.startsWith("Puntuación");
    text(g, l, VIEW_W / 2, y + 84 + i * 24, 16, highlight ? COL.goldSoft : COL.text, "center");
  });
  let ly = y + 84 + lines.length * 24 + 4;
  if (run.newBest) {
    textShadow(g, "¡NUEVO RÉCORD!", VIEW_W / 2, ly, 15, COL.gold, "#000", "center", true);
    ly += 22;
  }
  if (win && run.mode === "jefe" && run.boss && readLogros().includes(`duelo:${run.boss}`)) {
    text(g, "Recompensa guardada en tu campaña: +1 poción", VIEW_W / 2, ly, 14, "#7ef0a0", "center");
    ly += 20;
  }
  if (win && run.mode === "jefe") {
    text(g, "Los jefes de campaña no recordarán esta derrota: la arena es otra época.", VIEW_W / 2, ly, 13, "rgba(154,160,184,0.85)", "center");
  }
  button(g, "CONTINUAR (ESC)", VIEW_W / 2 - 110, y + h - 46, 220, 34, () => endChallenge(g, win), 11);
  if (g.keys.has("escape") || g.keys.has("enter"))
    endChallenge(g, win);
}

// src/game/screens.ts
var INTRO_SLIDES = [
  {
    title: "ERA DEL CANTO",
    lines: "Hace mil años, el dios-tejedor Aelthar sostenía el mundo con su canto. Cinco pueblos crecieron a su abrigo y las ciudades se alzaron con cada nota."
  },
  {
    title: "LA NOCHE DEL SILENCIO",
    lines: "Hace 300 años, la Orden de Vesh asesinó al dios. Su canto se quebró en siete Ecos y sin él la Niebla Muda avanza, borrando pueblos, recuerdos y nombres."
  },
  {
    title: "ERA DE LAS CENIZAS",
    lines: "Hoy despiertas en el Valle de Lunaris. Eres un Portador: puedes oír los Ecos. Recupera el primero... y recuerda que la voz de un dios no siempre dice la verdad."
  }
];
var LOCKED_HINT = {
  mem_nana: "Una nana medio oída te persigue desde el valle...",
  mem_casa: "¿Dos tazas en un umbral? El olor a pan te resulta conocido...",
  mem_madre: "Unas manos cosen algo en tu memoria. No ves su rostro.",
  mem_faro: "Un faro apagado sueña con una cerilla y una canción...",
  mem_invierno: "Bajo el hielo de las cumbres aguardan voces dormidas..."
};
var ZONE_TEASERS = {
  q6: "«Costa de Bruma — el mar guarda las notas»",
  q8: "«Merrow — la aldea que olvidó su nombre»",
  q9: "«Cumbres Heladas — el frío que aprendió a escuchar»"
};
var KEY_ITEM_FLAGS = [
  ["fragmentTouched", "fragment"],
  ["ecoVoz", "ecoVoz"],
  ["ecoMareas", "ecoMareas"],
  ["ecoCumbres", "ecoCumbres"],
  ["ecoNombres", "ecoNombres"]
];
var NUM_ES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete"];
function drawScreens(g) {
  if (g.state !== "end")
    endArmed = false;
  switch (g.state) {
    case "title":
      drawTitle(g);
      drawChallengeTitleUi(g);
      drawTitlePanels(g);
      break;
    case "controls":
      drawControls(g);
      break;
    case "intro":
      drawIntro(g);
      break;
    case "pause":
      drawPause(g);
      break;
    case "dialogue":
      drawDialogue(g);
      drawBannerActo18F(g);
      break;
    case "dead":
      drawDead(g);
      break;
    case "end":
      drawEnd(g);
      break;
    case "play":
      interludioTick18F(g);
      if (g.challengeRun)
        drawChallengeOverlay(g);
      drawBannerActo18F(g);
      break;
    default:
      break;
  }
}
function drawNote(ctx, x, y, s, color, variant) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + s * 3, s * 2, s * 1.5);
  ctx.fillRect(x + s * 1.5, y, s * 0.75, s * 3.6);
  if (variant === 0) {
    ctx.fillRect(x + s * 2, y, s * 1.25, s * 1.1);
  } else {
    ctx.fillRect(x + s * 2.6, y + s * 2.4, s * 2, s * 1.5);
    ctx.fillRect(x + s * 1.5, y, s * 3, s * 0.8);
  }
}
function drawTitle(g) {
  const ctx = g.ctx;
  const t = g.globalT;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, "#0a0c1e");
  grad.addColorStop(0.6, "#141830");
  grad.addColorStop(1, "#1e1830");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0;i < 70; i++) {
    const x = i * 137.5 % VIEW_W;
    const y = i * 89.7 % (VIEW_H * 0.7);
    const tw = 0.4 + Math.abs(Math.sin(t * 1.5 + i)) * 0.6;
    ctx.fillStyle = `rgba(220,228,255,${tw * 0.5})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = "#0c0e1c";
  ctx.fillRect(VIEW_W / 2 - 30, VIEW_H - 150, 60, 150);
  ctx.fillRect(VIEW_W / 2 - 44, VIEW_H - 130, 88, 130);
  ctx.globalAlpha = 0.6 + Math.sin(t * 2) * 0.2;
  ctx.fillStyle = "#8ef0ff";
  ctx.fillRect(VIEW_W / 2 - 6, VIEW_H - 120, 12, 40);
  ctx.globalAlpha = 1;
  const fogLayer = (alpha, speed, yBase, w, h, col, seed) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    for (let i = 0;i < 5; i++) {
      const fx = (t * speed + i * 240 + seed) % (VIEW_W + 360) - 180;
      const fy = yBase + Math.sin(t * 0.5 + i * 1.3 + seed) * 12 + i % 3 * 22;
      ctx.beginPath();
      ctx.ellipse(fx, fy, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  fogLayer(0.05, 10, VIEW_H - 130, 190, 30, "#9ec4b4", 40);
  fogLayer(0.08, 16, VIEW_H - 90, 170, 34, "#9ec4b4", 0);
  fogLayer(0.11, 26, VIEW_H - 48, 150, 26, "#b8d4c4", 120);
  for (let i = 0;i < 5; i++) {
    const wx = VIEW_W / 6 * i + Math.sin(t + i * 2) * 40 + 60;
    const wy = 330 + Math.cos(t * 0.8 + i * 1.7) * 30;
    const wisp = getSprWisp(t, i);
    if (!wisp)
      continue;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(wisp, wx, wy, 20, 20);
    ctx.globalAlpha = 1;
  }
  for (let i = 0;i < 9; i++) {
    const seed = i * 17 + 3;
    const speed = 0.045 + hashT(i, 7) * 0.04;
    const prog = (t * speed + hashT(i, 3)) % 1;
    const nx = hashT(i, 5) * VIEW_W + Math.sin(t * 1.4 + i * 1.9) * 16;
    const ny = VIEW_H + 20 - prog * (VIEW_H + 60);
    const na = Math.sin(prog * Math.PI) * 0.55;
    if (na <= 0.02)
      continue;
    drawNote(ctx, nx, ny, 2.2, `rgba(255,233,160,${na})`, i % 3 === 0 ? 1 : 0);
    drawNote(ctx, nx + 26, ny - 14, 1.7, `rgba(158,196,180,${na * 0.7})`, i % 2);
  }
  const bob = Math.sin(t * 1.4) * 3;
  const glow = Math.pow(Math.max(0, Math.sin(t * 0.7)), 14);
  if (glow > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = glow * 0.55;
    textShadow(g, "AELTHAR", VIEW_W / 2, 110 + bob, 42, "#fff3c0", "#3a2a08", "center", true);
    ctx.restore();
  }
  textShadow(g, "ECOS DE", VIEW_W / 2, 78 + bob, 20, "#b0b8d0", "#000", "center", true);
  textShadow(g, "AELTHAR", VIEW_W / 2, 110 + bob, 42, COL.gold, "#2a1a08", "center", true);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(VIEW_W / 2 - 180, 168, 360, 2);
  text(g, "RPG 2D de acción y exploración · Demo jugable · Acto II incluido", VIEW_W / 2, 180, 17, COL.dim, "center");
  const bx = VIEW_W / 2 - 130, bw = 260;
  const sw = (bw - 8) / 2;
  button(g, "NUEVA PARTIDA", bx, 236, bw, 44, () => g.requestCreate(), 13);
  hoverCorners(g, bx, 236, bw, 44);
  if (g.hasSave()) {
    button(g, "CONTINUAR", bx, 290, bw, 44, () => g.continueGame(), 13);
    hoverCorners(g, bx, 290, bw, 44);
    button(g, "CONTROLES", bx, 346, sw, 34, () => {
      g.setState("controls");
    }, 9);
    hoverCorners(g, bx, 346, sw, 34);
    button(g, "DESAFÍO", bx + sw + 8, 346, sw, 34, () => openChallengeMenu(), 9);
    hoverCorners(g, bx + sw + 8, 346, sw, 34);
    button(g, "ESTADÍSTICAS", bx, 388, sw, 34, () => openStatsPanel(), 9);
    hoverCorners(g, bx, 388, sw, 34);
    button(g, "LOGROS", bx + sw + 8, 388, sw, 34, () => openLogrosPanel(), 9);
    hoverCorners(g, bx + sw + 8, 388, sw, 34);
  } else {
    button(g, "CONTROLES", bx, 290, sw, 34, () => {
      g.setState("controls");
    }, 9);
    hoverCorners(g, bx, 290, sw, 34);
    button(g, "DESAFÍO", bx + sw + 8, 290, sw, 34, () => openChallengeMenu(), 9);
    hoverCorners(g, bx + sw + 8, 290, sw, 34);
    button(g, "ESTADÍSTICAS", bx, 332, sw, 34, () => openStatsPanel(), 9);
    hoverCorners(g, bx, 332, sw, 34);
    button(g, "LOGROS", bx + sw + 8, 332, sw, 34, () => openLogrosPanel(), 9);
    hoverCorners(g, bx + sw + 8, 332, sw, 34);
  }
  text(g, "Basado en el Documento de Diseño de @papito · 8 oct 2026", VIEW_W / 2, VIEW_H - 40, 15, "rgba(154,160,184,0.8)", "center");
  text(g, "v0.5.0 · Lunaris — Bosque — Cripta — Costa de Bruma — Merrow — Cumbres Heladas · Logros", VIEW_W / 2, VIEW_H - 20, 14, "rgba(122,128,148,0.7)", "center");
}
function hashT(i, k) {
  let h = (i + k * 57) * 2654435761;
  h = (h ^ h >> 13) * 1274126177;
  return ((h ^ h >> 16) >>> 0) / 4294967295;
}
function getSprWisp(t, i) {
  const frames = getSpr("wisp");
  const f = frames?.length ? frames[Math.floor(t * 3 + i) % frames.length] : undefined;
  if (!f) {
    const w = window;
    if (!w.__wispMiss)
      w.__wispMiss = [];
    if (w.__wispMiss.length < 3) {
      w.__wispMiss.push({
        t: Math.round(performance.now()),
        i,
        hasFrames: !!frames,
        len: frames?.length ?? -1,
        hasG: !!window.__g,
        heroAlba: !!getSpr("hero_alba")
      });
    }
  }
  return f;
}
function hoverCorners(g, x, y, w, h, col = COL.gold) {
  const hov = g.mouse.x >= x && g.mouse.x <= x + w && g.mouse.y >= y && g.mouse.y <= y + h;
  if (!hov)
    return;
  const ctx = g.ctx;
  const c = 7;
  ctx.fillStyle = col;
  ctx.fillRect(x - 2, y - 2, c, 2);
  ctx.fillRect(x - 2, y - 2, 2, c);
  ctx.fillRect(x + w + 2 - c, y - 2, c, 2);
  ctx.fillRect(x + w, y - 2, 2, c);
  ctx.fillRect(x - 2, y + h, c, 2);
  ctx.fillRect(x - 2, y + h - c, 2, c);
  ctx.fillRect(x + w + 2 - c, y + h, c, 2);
  ctx.fillRect(x + w, y + h - c, 2, c);
}
var CONTROLS = [
  ["Moverse", "W A S D"],
  ["Ataque ligero (combo ×3)", "Clic izquierdo (mantén: ataque cargado)"],
  ["Ataque cargado", "Mantén clic izquierdo y suelta"],
  ["Esquivar (i-frames)", "Espacio"],
  ["Parada perfecta (0,2 s)", "Clic derecho"],
  ["Habilidades ×4", "Teclas 1 – 4"],
  ["Interactuar / hablar", "E"],
  ["Cambiar de época (con Eco)", "Q"],
  ["Beber poción", "F"],
  ["Menú y mapa", "Esc / M"],
  ["Esperar al alba (accesibilidad)", "Shift + T"]
];
function drawControls(g) {
  const ctx = g.ctx;
  ctx.fillStyle = "#0a0c1e";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const pw = 620, ph = 430;
  const px3 = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2 - 10;
  panel(g, px3, py, pw, ph);
  textShadow(g, "CONTROLES", VIEW_W / 2, py + 18, 16, COL.gold, "#000", "center", true);
  let y = py + 60;
  for (const [action, key] of CONTROLS) {
    text(g, action, px3 + 28, y, 16, COL.text);
    text(g, key, px3 + pw - 28, y, 16, COL.goldSoft, "right");
    y += 30;
  }
  ctx.strokeStyle = COL.panelBorder;
  ctx.strokeRect(px3 + 20, y + 6, pw - 40, 64);
  text(g, "Consejo del GDD: «la posición y el ritmo importan más que los números».", px3 + 28, y + 14, 15, COL.dim);
  text(g, "Esquiva con los i-frames de la voltereta y clava la parada perfecta (0,2 s)", px3 + 28, y + 32, 15, COL.dim);
  text(g, "para aturdir. Los enemigos grandes tienen barra de QUIEBRE.", px3 + 28, y + 50, 15, COL.dim);
  button(g, "VOLVER (ESC)", VIEW_W / 2 - 90, py + ph + 12, 180, 36, () => g.setState("title"), 11);
  hoverCorners(g, VIEW_W / 2 - 90, py + ph + 12, 180, 36);
  if (g.keys.has("escape"))
    g.setState("title");
}
function drawIntro(g) {
  const ctx = g.ctx;
  ctx.fillStyle = "#06070f";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0;i < 24; i++) {
    const x = hashT(i, 11) * VIEW_W;
    const y = (hashT(i, 13) * VIEW_H + g.globalT * (4 + hashT(i, 5) * 5)) % VIEW_H;
    ctx.globalAlpha = 0.12 + Math.abs(Math.sin(g.globalT + i)) * 0.2;
    ctx.fillStyle = "#ffe9a0";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  const slide = INTRO_SLIDES[Math.min(g.introIdx, INTRO_SLIDES.length - 1)];
  const a = 0.75 + Math.sin(g.globalT * 2) * 0.25;
  ctx.globalAlpha = a;
  textShadow(g, slide.title, VIEW_W / 2, 150, 18, COL.goldSoft, "#000", "center", true);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(VIEW_W / 2 - 60, 190, 120, 2);
  const lines = wrapText(slide.lines, 52);
  lines.forEach((l, i) => text(g, l, VIEW_W / 2, 226 + i * 26, 20, COL.text, "center"));
  ctx.globalAlpha = 1;
  for (let i = 0;i < INTRO_SLIDES.length; i++) {
    ctx.fillStyle = i === g.introIdx ? COL.gold : "rgba(255,255,255,0.2)";
    ctx.fillRect(VIEW_W / 2 - 24 + i * 18, 400, 10, 4);
  }
  if (Math.sin(g.globalT * 4) > -0.2) {
    text(g, "E ▸", VIEW_W - 80, VIEW_H - 50, 16, COL.dim, "center");
  }
}
var TABS = ["ESTADO", "EQUIPO", "DIARIO", "SISTEMA"];
function drawPause(g) {
  const ctx = g.ctx;
  ctx.fillStyle = "rgba(4,5,12,0.78)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const p = g.player;
  const pw = 720, ph = 470;
  const px3 = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2;
  panel(g, px3, py, pw, ph);
  textShadow(g, "— PAUSA —", VIEW_W / 2, py + 14, 14, COL.gold, "#000", "center", true);
  let tx = px3 + 20;
  for (let i = 0;i < TABS.length; i++) {
    const tw = 140;
    const selected = g.pauseTab === i;
    const hover = addHit(g, tx, py + 44, tw, 30, () => {
      g.pauseTab = i;
    });
    panel(g, tx, py + 44, tw, 30, selected || hover ? COL.gold : COL.panelBorder, selected ? "rgba(60,48,24,0.9)" : COL.panel);
    text(g, TABS[i], tx + tw / 2, py + 52, 11, selected ? COL.gold : COL.dim, "center", true);
    tx += tw + 8;
  }
  const cx = px3 + 28, cy = py + 92;
  if (g.pauseTab === 0) {
    text(g, `${p.name} — Portador nivel ${p.level}`, cx, cy, 20, COL.goldSoft);
    bar(g, cx, cy + 28, 240, 8, p.xp / g.xpNext(p.level), COL.xp, "#241a30");
    text(g, `XP ${Math.floor(p.xp)} / ${g.xpNext(p.level)}`, cx + 250, cy + 24, 15, COL.dim);
    text(g, `Puntos de atributo: ${p.points}`, cx, cy + 46, 17, p.points > 0 ? "#ffe86a" : COL.dim);
    let y = cy + 72;
    for (const at of ATTR_INFO) {
      text(g, at.name, cx, y, 16, COL.text);
      text(g, `${p.attrs[at.id]}`, cx + 120, y, 16, COL.goldSoft);
      text(g, at.desc, cx + 165, y + 2, 13, COL.dim);
      if (p.points > 0) {
        button(g, "+", cx + 396, y - 4, 30, 24, () => {
          p.attrs[at.id]++;
          p.points--;
          audioClick();
        }, 12);
      }
      y += 26;
    }
    const melee = playerMeleeDmg(p);
    const spell = 6 + p.attrs.int * 1.6 + p.level + p.weaponPlus * 1.5;
    text(g, `Daño melé: ${Math.round(melee)}   Daño de Cantos: ${Math.round(spell)}   Crítico: ${Math.min(40, 5 + p.attrs.des * 2)}%`, cx, y + 6, 14, COL.dim);
    text(g, `Vida: ${p.maxHp}   Reducción: ${Math.min(50, p.attrs.vig)}%   Resonancia máx: ${p.maxRes}`, cx, y + 24, 14, COL.dim);
    const vy0 = y + 50;
    ctx.strokeStyle = "rgba(90,74,48,0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, vy0 - 8);
    ctx.lineTo(px3 + pw - 28, vy0 - 8);
    ctx.stroke();
    text(g, "◆ VELMORA TE OBSERVA ◆", cx + 246, vy0, 13, COL.gold, "center", true);
    const dom = dominantTone(p);
    const memCount = p.memories?.length ?? 0;
    text(g, `Tono dominante: ${dom ? TONE_LABEL[dom] : "Aún por definir"}`, cx, vy0 + 24, 15, "#c8b0e8");
    text(g, `Memorias recuperadas: ${memCount}/${Object.keys(MEMORIES).length}`, cx + 340, vy0 + 24, 15, memCount > 0 ? COL.goldSoft : COL.dim);
    const rep = p.repFacciones ?? {};
    const FACS = [
      ["guardianes", "Guardianes del Canto"],
      ["orden", "Orden de Vesh"],
      ["circulo", "Círculo Verde"],
      ["liga", "Liga de Mercaderes"]
    ];
    FACS.forEach(([id, label], i) => {
      const fx = cx + i % 2 * 336;
      const fy = vy0 + 50 + Math.floor(i / 2) * 24;
      const v = rep[id] ?? 0;
      text(g, label, fx, fy, 15, COL.text);
      const vc = v > 0 ? "#8ef0b0" : v < 0 ? "#ff7060" : COL.dim;
      text(g, `${v > 0 ? "+" : ""}${v}`, fx + 300, fy, 15, vc, "right");
    });
    drawArmorRow(g, cx, py + 440, pw - 56);
  } else if (g.pauseTab === 1) {
    text(g, "ARMA", cx, cy, 16, COL.gold);
    text(g, p.discipline === "alba" ? "Espada y escudo del Alba" : "Báculo del Tejedor", cx + 100, cy, 18, COL.text);
    text(g, `+${p.weaponPlus}`, cx + 380, cy, 18, COL.goldSoft);
    text(g, "CORONAS", cx, cy + 30, 16, COL.gold);
    text(g, `${p.gold}`, cx + 100, cy + 30, 18, COL.text);
    text(g, "POCIONES", cx, cy + 58, 16, COL.gold);
    text(g, `${p.potions}  (beber con F)`, cx + 100, cy + 58, 18, COL.text);
    text(g, "OBJETOS CLAVE", cx, cy + 96, 16, COL.gold);
    let ky = cy + 120;
    for (const [flag, id] of KEY_ITEM_FLAGS) {
      if (!g.flags[flag])
        continue;
      const it = KEY_ITEMS[id];
      if (!it)
        continue;
      text(g, `◆ ${it.name}`, cx, ky, 16, id === "fragment" ? COL.text : "#ffe9a0");
      text(g, it.desc, cx + 16, ky + 17, 13, COL.dim);
      ky += 34;
    }
    if (ky === cy + 120) {
      text(g, "(aún no llevas ninguno)", cx, ky, 15, COL.dim);
      ky += 22;
    }
    text(g, "FACCIÓN: Guardianes del Canto", cx, ky + 8, 16, COL.quest);
    bar(g, cx, ky + 30, 200, 8, (p.repGuardianes + 100) / 200, "#4a8a5c", "#1a2a1c", COL.panelBorder);
    text(g, `${p.repGuardianes >= 0 ? "+" : ""}${p.repGuardianes} / +100`, cx + 210, ky + 26, 15, COL.dim);
    text(g, g.companion ? "Compañera: Ilwen (Arquera Sylvar) — te cubre con su arco" : "Compañeros: ninguno aún (Ilwen espera en el Bosque)", cx, ky + 56, 15, COL.dim);
  } else if (g.pauseTab === 2) {
    text(g, "CADENA PRINCIPAL · ACTO I", cx, cy, 15, COL.gold);
    let y = cy + 22;
    for (let i = 0;i < QUESTS.length; i++) {
      if (i === 5) {
        y += 4;
        text(g, "◆ ACTO II · LAS NOTAS PERDIDAS", cx, y, 14, g.questIdx >= 5 ? COL.quest : "rgba(142,240,176,0.45)");
        y += 20;
      }
      const q = QUESTS[i];
      const done2 = i < g.questIdx;
      const active = i === g.questIdx;
      text(g, `${done2 ? "✔" : active ? "◆" : "·"} ${q.name}`, cx, y, 16, done2 ? "#6a8a6a" : active ? COL.quest : COL.dim);
      y += 18;
      if (active) {
        const stepText = g.questProgressText() ?? q.steps[g.questStep];
        for (const l of wrapText(stepText, 42)) {
          text(g, "   " + l, cx, y, 14, COL.text);
          y += 15;
        }
        y += 4;
      } else if (ZONE_TEASERS[q.id] && i > g.questIdx) {
        text(g, `   ${ZONE_TEASERS[q.id]}`, cx, y, 13, "rgba(154,160,184,0.75)");
        y += 14;
      }
    }
    text(g, `Ecos menores escuchados: ${g.takenEchoes.size}`, cx, py + ph - 52, 14, COL.dim);
    text(g, `Enemigos derrotados: ${p.kills} · Muertes: ${p.deaths}`, cx, py + ph - 32, 14, COL.dim);
    const mx0 = cx + 316;
    text(g, "MEMORIAS DEL PORTADOR", mx0, cy, 15, COL.gold);
    let my = cy + 20;
    const got = p.memories ?? [];
    for (const mid of Object.keys(MEMORIES)) {
      const m = MEMORIES[mid];
      const unlocked = got.includes(mid);
      text(g, unlocked ? m.title : "??? · Recuerdo perdido", mx0, my, 14, unlocked ? COL.goldSoft : COL.dim);
      my += 15;
      if (unlocked) {
        const all = wrapText(m.text, 58);
        const shown = all.slice(0, 3);
        if (all.length > 3 && shown.length === 3) {
          shown[2] = shown[2].replace(/[.,;:]?$/, "…");
        }
        shown.forEach((l, i) => text(g, l, mx0, my + i * 13, 13, COL.text));
        my += shown.length * 13 + 3;
      } else {
        text(g, LOCKED_HINT[mid] ?? "La Niebla aún oculta este recuerdo.", mx0, my, 13, "rgba(154,160,184,0.75)");
        my += 16;
      }
      ctx.strokeStyle = "rgba(90,74,48,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx0, my);
      ctx.lineTo(mx0 + 330, my);
      ctx.stroke();
      my += 7;
    }
  } else {
    text(g, "VOLUMEN DE MÚSICA", cx, cy, 16, COL.text);
    drawSlider(g, cx, cy + 26, 300, (v) => {
      audioSetMusic(g, v);
    }, g.musicVolUi);
    text(g, "VOLUMEN DE EFECTOS", cx, cy + 76, 16, COL.text);
    drawSlider(g, cx, cy + 102, 300, (v) => {
      audioSetSfx(g, v);
    }, g.sfxVolUi);
    text(g, "«La música adaptativa añade una capa de combate cuando", cx, cy + 150, 15, COL.dim);
    text(g, "los enemigos te ven, y cada región tiene su melodía.»", cx, cy + 168, 15, COL.dim);
    drawBalancePanel(g, cx, cy + 196, pw - 56);
    button(g, "GUARDAR Y SALIR AL TÍTULO", cx, py + ph - 96, 280, 40, () => {
      g.save();
      g.setState("title");
    }, 11);
    hoverCorners(g, cx, py + ph - 96, 280, 40);
    text(g, "(el juego también autoguarda en Santuarios y al cambiar de zona)", cx, py + ph - 46, 14, COL.dim);
  }
  text(g, "Esc para volver al juego", VIEW_W / 2, py + ph + 10, 15, COL.dim, "center");
}
function drawSlider(g, x, y, w, cb, cur) {
  const ctx = g.ctx;
  addHit(g, x, y - 4, w, 22, () => {
    const v = Math.max(0, Math.min(1, (g.mouse.x - x) / w));
    cb(v);
  });
  bar(g, x, y, w, 14, cur, COL.res, "#123038");
  ctx.fillStyle = "#fff";
  ctx.fillRect(x + cur * w - 3, y - 3, 6, 20);
}
function drawBannerActo18F(g) {
  const b = bannerActo18F(g);
  if (!b || b.alpha <= 0)
    return;
  const ctx = g.ctx;
  const y = 96, h = 34;
  ctx.save();
  ctx.globalAlpha = b.alpha;
  ctx.fillStyle = "rgba(4,5,12,0.62)";
  ctx.fillRect(0, y, VIEW_W, h);
  ctx.fillStyle = "rgba(240,200,74,0.55)";
  ctx.fillRect(0, y, VIEW_W, 1);
  ctx.fillRect(0, y + h - 1, VIEW_W, 1);
  textShadow(g, b.texto, VIEW_W / 2, y + 9, 16, COL.goldSoft, "#000", "center", true);
  ctx.restore();
}
function audioClick() {
  audio.sfx("select");
}
function audioSetMusic(g, v) {
  g.musicVolUi = v;
  audio.setMusicVol(v * 0.9);
  try {
    localStorage.setItem("ecos-vol", JSON.stringify({ m: g.musicVolUi, s: g.sfxVolUi }));
  } catch {}
}
function audioSetSfx(g, v) {
  g.sfxVolUi = v;
  audio.setSfxVol(v * 0.9);
  try {
    localStorage.setItem("ecos-vol", JSON.stringify({ m: g.musicVolUi, s: g.sfxVolUi }));
  } catch {}
}
function drawDialogue(g) {
  const ctx = g.ctx;
  const node = g.dlgNode;
  if (!node)
    return;
  const bw = VIEW_W - 80, bx = 40;
  const fullLines = wrapText(node.text, 76).length;
  const nOpts = node.options?.length ?? 0;
  const bh = Math.max(150, 46 + fullLines * 19 + (nOpts > 0 ? nOpts * 26 + 14 : 0));
  const by = VIEW_H - bh - 24;
  ctx.fillStyle = "rgba(4,5,12,0.4)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(g, bx, by, bw, bh, "#6a5a38", "rgba(10,12,22,0.96)");
  ctx.strokeStyle = "rgba(240,200,74,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 4.5, by + 4.5, bw - 9, bh - 9);
  ctx.fillStyle = COL.gold;
  for (const [cxx, cyy] of [[bx + 7, by + 7], [bx + bw - 7, by + 7], [bx + 7, by + bh - 7], [bx + bw - 7, by + bh - 7]]) {
    ctx.fillRect(cxx - 1.5, cyy - 1.5, 3, 3);
  }
  const pkey = mapPortrait(node.portrait);
  const blink = g.globalT % 3.7 < 0.14;
  const bob = Math.round(Math.sin(g.globalT * 2.3) * 0.9);
  const frS = 74;
  const frX = bx + 14, frY = by + 14;
  ctx.fillStyle = "#0e0c18";
  ctx.fillRect(frX, frY, frS, frS);
  drawPortrait(ctx, pkey, frX + (frS - 28 * 1.72) / 2, frY + (frS - 40 * 1.72) / 2 + bob, 1.72, blink);
  ctx.strokeStyle = "#6a5a38";
  ctx.strokeRect(frX, frY, frS, frS);
  ctx.strokeStyle = "rgba(240,200,74,0.35)";
  ctx.strokeRect(frX + 2.5, frY + 2.5, frS - 5, frS - 5);
  text(g, node.name, bx + 104, by + 12, 17, COL.goldSoft);
  const shown = node.text.slice(0, Math.floor(g.dlgCharT));
  const lines = wrapText(shown, 76);
  lines.forEach((l, i) => text(g, l, bx + 104, by + 36 + i * 19, 17, COL.text));
  if (node.options && node.options.length > 0 && g.dlgCharT >= node.text.length) {
    const oy = by + 36 + fullLines * 19 + 12;
    for (let i = 0;i < node.options.length; i++) {
      const opt = node.options[i];
      const selected = g.dlgSel === i;
      const ox = bx + 104;
      const hover = addHit(g, ox, oy + i * 26, 400, 24, () => {
        g.dlgSel = i;
        g.advanceDialogue();
      });
      if (selected || hover) {
        ctx.fillStyle = "rgba(240,200,74,0.14)";
        ctx.fillRect(ox - 4, oy + i * 26, 404, 24);
      }
      text(g, `${selected ? "▸" : " "} ${opt.text}`, ox, oy + i * 26 + 3, 16, selected || hover ? COL.gold : COL.text);
    }
  } else if (g.dlgCharT >= node.text.length) {
    if (Math.sin(g.globalT * 5) > -0.2)
      text(g, "E ▸", bx + bw - 44, by + bh - 30, 16, COL.dim, "center");
  }
}
function mapPortrait(p) {
  switch (p) {
    case "brisa":
      return "brisa";
    case "toln":
      return "toln";
    case "ilwen":
      return "ilwen";
    case "fragment":
      return "fragment";
    case "guardian":
      return "guardian";
    case "sombra":
      return "sombra";
    case "sanctuary":
      return "sanctuary";
    case "wisp":
      return "wisp";
    case "sasha":
      return "sasha";
    case "brokk":
      return "brokk";
    case "maelis":
      return "maelis";
    case "corvin":
      return "corvin";
    case "kael":
      return "kael";
    case "inquisidor":
      return "inquisidor";
    case "vesh":
      return "inquisidor";
    case "teo":
      return "teo";
    case "doran":
      return "doran";
    case "nimue":
      return "nimue";
    default:
      return "wisp";
  }
}
function drawDead(g) {
  const ctx = g.ctx;
  ctx.fillStyle = "rgba(20,4,8,0.82)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  textShadow(g, "HAS CAÍDO", VIEW_W / 2, 170, 34, "#c8384a", "#000", "center", true);
  const p = g.player;
  const lost = g.lastGoldLost;
  const lines = [
    "La Niebla Muda susurra tu nombre...",
    lost > 0 ? `Dejas un eco con ${lost} coronas donde caíste. Vuelve por él.` : "Tu oro queda contigo... esta vez.",
    "",
    "Pulsa E para despertar en el último Santuario"
  ];
  lines.forEach((l, i) => text(g, l, VIEW_W / 2, 250 + i * 30, 18, i === 3 ? COL.goldSoft : COL.dim, "center"));
  if (Math.sin(g.globalT * 3) > -0.2)
    text(g, "E ▸", VIEW_W / 2, 420, 18, COL.gold, "center");
}
var endArmed = false;
var endStartT = 0;
function drawEnd(g) {
  const ctx = g.ctx;
  if (!endArmed) {
    endArmed = true;
    endStartT = g.globalT;
  }
  const elapsed = g.globalT - endStartT;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, "#0a0c1e");
  grad.addColorStop(1, "#241a30");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0;i < 60; i++) {
    const x = i * 149.3 % VIEW_W;
    const y = i * 91.7 % VIEW_H;
    ctx.fillStyle = `rgba(240,200,74,${0.2 + Math.abs(Math.sin(g.globalT + i)) * 0.5})`;
    ctx.fillRect(x, y, 2, 2);
  }
  const ecoCount = (g.flags.ecoVoz ? 1 : 0) + (g.flags.ecoMareas ? 1 : 0) + (g.flags.ecoCumbres ? 1 : 0);
  const acto2End = g.questIdx >= 9;
  textShadow(g, acto2End ? "TRES NOTAS COMPLETAS" : "PRIMERA NOTA COMPLETA", VIEW_W / 2, 90, 18, COL.goldSoft, "#000", "center", true);
  textShadow(g, "GRACIAS POR JUGAR LA DEMO", VIEW_W / 2, 130, 26, COL.gold, "#2a1a08", "center", true);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(VIEW_W / 2 - 160, 175, 320, 2);
  const p = g.player;
  const statLines = g.endStats.split(`
`);
  const lines = [
    ...statLines,
    `Memorias recuperadas: ${p.memories?.length ?? 0}/${Object.keys(MEMORIES).length}`,
    `Ecos recuperados: ${ecoCount} de 7`
  ];
  const panelH = 34 + lines.length * 26 + 10;
  panel(g, VIEW_W / 2 - 250, 200, 500, panelH, COL.panelBorder);
  lines.forEach((l, i) => {
    const la = Math.max(0, Math.min(1, (elapsed - 0.6 - i * 0.4) / 0.35));
    if (la <= 0)
      return;
    ctx.globalAlpha = la;
    const off = (1 - la) * 8;
    text(g, l, VIEW_W / 2, 216 + i * 26 + off, 17, COL.text, "center");
  });
  ctx.globalAlpha = 1;
  const qa = Math.max(0, Math.min(1, (elapsed - 0.6 - lines.length * 0.4) / 0.5));
  ctx.globalAlpha = qa;
  text(g, "«Cuando el miedo te hable, canta más alto.»", VIEW_W / 2, 396, 19, COL.epochPast, "center");
  text(g, "— Anciana Brisa", VIEW_W / 2, 418, 15, COL.dim, "center");
  const restantes = NUM_ES[Math.max(0, Math.min(7, 7 - ecoCount))];
  text(g, `Los otros ${restantes} Ecos aguardan en Velmora...`, VIEW_W / 2, 448, 16, COL.dim, "center");
  ctx.globalAlpha = 1;
  button(g, "VOLVER AL TÍTULO (ENTER)", VIEW_W / 2 - 140, VIEW_H - 60, 280, 40, () => g.setState("title"), 11);
  hoverCorners(g, VIEW_W / 2 - 140, VIEW_H - 60, 280, 40);
}

// src/game/skilltree.ts
function skillPointsEarned(level) {
  const lvl = Math.max(0, Math.floor(level));
  return Math.max(0, lvl - 1) + Math.floor(lvl / 5);
}
var STORE_KEY = "ecos-arbol";
var treeCache = new Map;
function treeKey(p) {
  return `${p.name}|${p.discipline}`;
}
function getTree(p) {
  const k = treeKey(p);
  const cached = treeCache.get(k);
  if (cached)
    return cached;
  const t = { learned: [], equip: [null, null, null, null] };
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    const raw = all[k];
    if (raw && Array.isArray(raw.learned)) {
      t.learned = raw.learned.filter((id) => SKILL_TREE.some((n) => n.id === id));
      if (Array.isArray(raw.equip)) {
        for (let i = 0;i < 4; i++)
          t.equip[i] = typeof raw.equip[i] === "string" ? raw.equip[i] : null;
      }
    }
  } catch {}
  treeCache.set(k, t);
  applyLoadout(p.discipline, t.equip);
  return t;
}
function saveTree(p) {
  const t = treeCache.get(treeKey(p));
  if (!t)
    return;
  try {
    const all = {};
    treeCache.forEach((v, key) => {
      all[key] = v;
    });
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {}
}
function spentPoints(t) {
  let s = 0;
  for (const id of t.learned) {
    const n = SKILL_TREE.find((nd) => nd.id === id);
    if (n)
      s += n.cost;
  }
  return s;
}
function pointsAvailable(p) {
  return skillPointsEarned(p.level) - spentPoints(getTree(p));
}
function applySkillStats(p, challengeActive = false) {
  if (challengeActive)
    return;
  const has = (id) => getTree(p).learned.includes(id);
  const base = p.discipline === "alba" ? 110 : 96;
  const desired = base + (p.level - 1) * 7 + (has("c_vida") ? 20 : 0);
  if (p.maxHp !== desired) {
    p.maxHp = desired;
    if (p.hp > p.maxHp)
      p.hp = p.maxHp;
  }
}
function skillDamageMult(g, kind) {
  const p = g.player;
  if (!p)
    return 1;
  const has = (id) => getTree(p).learned.includes(id);
  let m = 1;
  if (kind === "melee" || kind === "todo") {
    if (has("c_fuerte"))
      m *= 1.1;
    if (has("c_colera"))
      m *= 1.15;
  }
  if (kind === "hechizo" || kind === "todo") {
    if (has("a_mente"))
      m *= 1.2;
  }
  return m;
}
function skillCdMult(p) {
  const has = (id) => getTree(p).learned.includes(id);
  let m = 1;
  if (has("c_cd"))
    m *= 0.8;
  if (has("a_cd"))
    m *= 0.8;
  return m;
}
var cdDecayEnabled = true;
function setSkillCdDecay(on) {
  cdDecayEnabled = on;
}
var BASE_SKILLS = {
  alba: [...SKILLS.alba],
  tejedor: [...SKILLS.tejedor]
};
var NEW_SKILL_IDS = new Set([...NEW_SKILLS.alba, ...NEW_SKILLS.tejedor].map((s) => s.id));
function findNewDef(id, disc2) {
  return NEW_SKILLS[disc2].find((s) => s.id === id) ?? null;
}
function applyLoadout(disc2, equip) {
  for (let s = 0;s < 4; s++) {
    const id = equip[s];
    const def = id ? findNewDef(id, disc2) : null;
    SKILLS[disc2][s] = def ?? BASE_SKILLS[disc2][s];
  }
}
function equipNewSkill(p, skillId, slot) {
  if (slot < 0 || slot > 3)
    return false;
  const def = findNewDef(skillId, p.discipline);
  const node = SKILL_TREE.find((n) => n.grants === skillId && n.kind === "activa");
  if (!def || !node)
    return false;
  const t = getTree(p);
  if (!t.learned.includes(node.id))
    return false;
  if (node.disc && node.disc !== p.discipline)
    return false;
  for (let j = 0;j < 4; j++)
    if (t.equip[j] === skillId)
      t.equip[j] = null;
  t.equip[slot] = skillId;
  SKILLS[p.discipline][slot] = def;
  saveTree(p);
  audio.sfx("confirm");
  return true;
}
function unequipSlot(p, slot) {
  if (slot < 0 || slot > 3)
    return;
  const t = getTree(p);
  t.equip[slot] = null;
  SKILLS[p.discipline][slot] = BASE_SKILLS[p.discipline][slot];
  saveTree(p);
}
var rtMap = new WeakMap;
function rtOf(p) {
  let rt = rtMap.get(p);
  if (!rt) {
    rt = {
      loadedKey: null,
      prevHp: p.hp,
      prevGold: p.gold,
      prevKills: p.kills,
      prevLevel: p.level,
      prevKeys: new Set,
      combat: false,
      campanaCd: 0,
      brujulaCd: 0,
      amuletoCharge: false,
      compassT: 0,
      compassTick: 0,
      compassTarget: null,
      compassMap: null,
      shield: 0,
      shieldT: 0,
      auraT: 0,
      auraTick: 0,
      lances: [],
      echoTimers: [],
      attackPrev: 0
    };
    rtMap.set(p, rt);
  }
  return rt;
}
function ensureTreeForPlayer(g, p, rt) {
  const k = treeKey(p);
  if (rt.loadedKey === k)
    return;
  rt.loadedKey = k;
  const t = getTree(p);
  applyLoadout(p.discipline, t.equip);
  applySkillStats(p, !!g.challengeRun);
  rt.prevHp = p.hp;
  rt.prevGold = p.gold;
  rt.prevKills = p.kills;
}
function aimDir(g) {
  const p = g.player;
  const wx = g.mouse.x / ZOOM + g.camX / ZOOM;
  const wy = g.mouse.y / ZOOM + g.camY / ZOOM;
  const dx = wx - p.x, dy = wy - p.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  return { nx: dx / len, ny: dy / len };
}
function castNewSkill(g, skillId) {
  const p = g.player;
  if (!p || g.state !== "play")
    return false;
  const node = SKILL_TREE.find((n) => n.kind === "activa" && n.grants === skillId);
  if (!node)
    return false;
  const t = getTree(p);
  if (!t.learned.includes(node.id))
    return false;
  if (node.disc && node.disc !== p.discipline)
    return false;
  const rt = rtOf(p);
  const def = findNewDef(skillId, p.discipline);
  if (def && def.element !== "ninguno")
    g.lastNote = def.element;
  switch (skillId) {
    case "onda": {
      audio.sfx("slam");
      const dmg = playerMeleeDmg(p) * 1.3 * skillDamageMult(g, "melee");
      g.aoeHit(p.x, p.y, 56, dmg, "sagrado", false);
      for (const e of g.enemies) {
        if (e.dead)
          continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 76 + e.w / 2)
          applyKnockback(e, e.x - p.x, e.y - p.y, 240);
      }
      g.waves.push({ x: p.x, y: p.y, r: 6, maxR: 76, speed: 150, dmg: 0, hit: true });
      g.burst(p.x, p.y, "#e8d8a0", 16, 85);
      addShake(g, 4);
      return true;
    }
    case "lanza": {
      audio.sfx("holy");
      const { nx, ny } = aimDir(g);
      const dmg = playerMeleeDmg(p) * 1.15 * skillDamageMult(g, "melee");
      rt.lances.push({ x: p.x + nx * 10, y: p.y - 6 + ny * 10, vx: nx * 250, vy: ny * 250, t: 1.1, dmg, hits: new Set });
      g.burst(p.x + nx * 12, p.y - 6 + ny * 12, "#fff8c0", 8, 60);
      return true;
    }
    case "bendi": {
      audio.sfx("holy");
      rt.shield = Math.round(p.maxHp * 0.25);
      rt.shieldT = 10;
      g.toast(`Bendición del Camino: escudo de ${rt.shield} (10 s)`, "#ffe9a0");
      addFlash(g, "#fff8c0", 0.12);
      g.burst(p.x, p.y - 6, "#ffe9a0", 18, 80);
      return true;
    }
    case "nova": {
      audio.sfx("ice");
      const dmg = playerSpellDmg(p) * 1.6 * skillDamageMult(g, "hechizo");
      g.aoeHit(p.x, p.y, 64, dmg, "hielo", false);
      for (const e of g.enemies) {
        if (e.dead)
          continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 72 + e.w / 2) {
          e.statuses.push({ kind: "congelado", t: 2.5, power: 1 });
        }
      }
      g.waves.push({ x: p.x, y: p.y, r: 6, maxR: 70, speed: 140, dmg: 0, hit: true });
      g.burst(p.x, p.y, "#a0e8ff", 24, 95);
      addFlash(g, "#a0e8ff", 0.15);
      addShake(g, 3);
      return true;
    }
    case "rayos": {
      audio.sfx("bolt");
      const dmg = playerSpellDmg(p) * 1.15 * skillDamageMult(g, "hechizo");
      const { nx, ny } = aimDir(g);
      g.chainLightning(p.x, p.y - 6, dmg, 5, nx, ny);
      addFlash(g, "#ffe86a", 0.12);
      return true;
    }
    case "aurea": {
      audio.sfx("fire");
      rt.auraT = 6;
      rt.auraTick = 0;
      g.toast("Aureola de Ceniza: el aire arde a tu alrededor (6 s)", "#ff9040");
      g.burst(p.x, p.y, "#ff9040", 16, 70);
      return true;
    }
    default:
      return false;
  }
}
function cardinal(dx, dy) {
  const dirs = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];
  const a = Math.atan2(dy, dx);
  const idx = Math.round((a + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4)) % 8;
  return dirs[idx];
}
var adjCache = null;
function adjacency() {
  if (adjCache)
    return adjCache;
  const sets = {};
  for (const m of Object.values(MAPS)) {
    if (!sets[m.id])
      sets[m.id] = new Set;
    for (const ex of m.exits) {
      sets[m.id].add(ex.to);
      if (!sets[ex.to])
        sets[ex.to] = new Set;
      sets[ex.to].add(m.id);
    }
  }
  const out = {};
  for (const k of Object.keys(sets))
    out[k] = [...sets[k]];
  adjCache = out;
  return out;
}
function nextHop(from, to) {
  const adj = adjacency();
  if (from === to)
    return from;
  const prev = new Map;
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of adj[cur] ?? []) {
      if (seen.has(nb))
        continue;
      seen.add(nb);
      prev.set(nb, cur);
      if (nb === to) {
        let hop = nb;
        while (prev.get(hop) !== from)
          hop = prev.get(hop);
        return hop;
      }
      queue.push(nb);
    }
  }
  return null;
}
function mapOfNpc(nid) {
  if (!nid)
    return null;
  for (const m of Object.values(MAPS))
    if (m.npcs.some((n) => n.id === nid))
      return m.id;
  return null;
}
function mapOfProp(pid) {
  if (!pid)
    return null;
  for (const m of Object.values(MAPS))
    if (m.props.some((pd) => pd.id === pid))
      return m.id;
  return null;
}
function mapOfEnemy(et) {
  if (!et)
    return null;
  for (const m of Object.values(MAPS))
    if (m.spawns.some((s) => s.type === et))
      return m.id;
  return null;
}
function resolveTargetHere(g, t) {
  const p = g.player;
  const tilePos = (tx, ty) => ({ x: tx * TILE + 8, y: ty * TILE + 8 });
  if (t.npc) {
    const live = g.npcs.find((n) => n.nid === t.npc);
    if (live)
      return { x: live.x, y: live.y };
    const def = g.map.npcs.find((n) => n.id === t.npc);
    if (def)
      return tilePos(def.x, def.y);
    return null;
  }
  if (t.etype) {
    let best = null, bd = Infinity;
    for (const e of g.enemies) {
      if (e.dead || e.etype !== t.etype)
        continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  if (t.prop) {
    const pd = g.map.props.find((pr) => pr.id === t.prop);
    return pd ? tilePos(pd.x, pd.y) : null;
  }
  if (t.lamp) {
    let best = null, bd = Infinity;
    for (const pd of g.map.props) {
      if (pd.kind !== "lamp" || g.flags[pd.id])
        continue;
      const w = tilePos(pd.x, pd.y);
      const d = Math.hypot(w.x - p.x, w.y - p.y);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    return best;
  }
  return null;
}
function questTargetPos(g) {
  const list = QUEST_COMPASS[g.questIdx];
  if (!list || list.length === 0)
    return null;
  const t = list[Math.min(g.questStep, list.length - 1)];
  const here = resolveTargetHere(g, t);
  if (here)
    return here;
  const dest = t.map ?? mapOfNpc(t.npc) ?? mapOfProp(t.prop) ?? mapOfEnemy(t.etype);
  if (!dest || dest === g.mapId) {
    if (dest === g.mapId && t.map)
      return { x: g.map.w * TILE / 2, y: g.map.h * TILE / 2 };
    return null;
  }
  const hop = nextHop(g.mapId, dest);
  if (!hop)
    return null;
  const exit = g.map.exits.find((e) => e.to === hop);
  if (!exit)
    return null;
  return { x: (exit.x + exit.w / 2) * TILE, y: (exit.y + exit.h / 2) * TILE };
}
function activateTool(g, toolId) {
  const p = g.player;
  if (!p)
    return false;
  const node = SKILL_TREE.find((n) => n.kind === "herramienta" && n.grants === toolId);
  if (!node || !getTree(p).learned.includes(node.id)) {
    g.toast("Aún no posees ese encantamiento (árbol de habilidades: K)", "#9aa0b8");
    return false;
  }
  const rt = rtOf(p);
  switch (toolId) {
    case "campana": {
      if (rt.campanaCd > 0) {
        g.toast(`La Campana aún resuena (${Math.ceil(rt.campanaCd)} s)`, "#9aa0b8");
        return false;
      }
      const [sx, sy] = g.sanctuaryPos(g.mapId);
      rt.campanaCd = TOOL_INFO.campana.cd;
      audio.sfx("save");
      if (g.state !== "play")
        g.setState("play");
      g.toast("La Campana del Retorno resuena: el mundo se pliega hacia el Santuario...", "#ffe9a0");
      g.fadeTo(g.mapId, sx, sy);
      return true;
    }
    case "brujula": {
      if (rt.brujulaCd > 0) {
        g.toast(`La Brújula descansa (${Math.ceil(rt.brujulaCd)} s)`, "#9aa0b8");
        return false;
      }
      const tgt = questTargetPos(g);
      if (!tgt) {
        g.toast("Ninguna misión reclama tu rumbo", "#9aa0b8");
        return false;
      }
      rt.brujulaCd = TOOL_INFO.brujula.cd;
      rt.compassT = 20;
      rt.compassTick = 0;
      rt.compassTarget = tgt;
      rt.compassMap = g.mapId;
      const dx = tgt.x - p.x, dy = tgt.y - p.y;
      g.toast(`Los ecos susurran: tu misión aguarda hacia el ${cardinal(dx, dy)}...`, "#ffe9a0");
      audio.sfx("quest");
      return true;
    }
    case "amuleto": {
      g.toast(rt.amuletoCharge ? "El Amuleto de Aelthar vibra: absorberá el próximo golpe" : "El Amuleto duerme: entra en combate y despertará", rt.amuletoCharge ? "#ffe9a0" : "#9aa0b8");
      audio.sfx("blip");
      return true;
    }
    default:
      return false;
  }
}
var bridgeDone = false;
function ensureBridge() {
  if (bridgeDone)
    return;
  bridgeDone = true;
  try {
    if (typeof window === "undefined")
      return;
    const proto = Game.prototype;
    const orig = proto.castSkill;
    if (typeof orig !== "function")
      return;
    if (orig.__ecosBridge)
      return;
    const wrapped = function castSkillBridge(id, element) {
      const w = window;
      if (!w.__ecos_no_skill_bridge && NEW_SKILL_IDS.has(id) && castNewSkill(this, id))
        return;
      orig.call(this, id, element);
    };
    wrapped.__ecosBridge = true;
    proto.castSkill = wrapped;
  } catch {}
}
function skillTick(g, dt) {
  ensureBridge();
  const p = g.player;
  if (!p)
    return;
  const rt = rtOf(p);
  ensureTreeForPlayer(g, p, rt);
  const tree = getTree(p);
  const has = (id) => tree.learned.includes(id);
  if (p.level > rt.prevLevel && rt.prevLevel > 0) {
    const n = p.level - rt.prevLevel;
    g.toast(`+${n} punto${n > 1 ? "s" : ""} de habilidad: pulsa K y mira tu constelación`, "#ffe86a");
    audio.sfx("quest");
  }
  rt.prevLevel = p.level;
  const playing = g.state === "play";
  if (playing) {
    if (has("t_gold") && p.gold > rt.prevGold) {
      const bonus = Math.round((p.gold - rt.prevGold) * 0.2);
      if (bonus > 0) {
        p.gold += bonus;
        g.floatAt(p.x, p.y - 26, `+${bonus} (Ojo del Mercader)`, "#f0c84a");
      }
    }
    if (has("a_sta"))
      p.sta = Math.min(p.maxSta, p.sta + 26 * 0.4 * dt);
    if (has("a_res"))
      p.res = Math.min(p.maxRes, p.res + 1.5 * dt);
    if (cdDecayEnabled) {
      const m = skillCdMult(p);
      if (m < 1) {
        const extra = dt * (1 / m - 1);
        for (let i = 0;i < p.cds.length; i++)
          if (p.cds[i] > 0)
            p.cds[i] = Math.max(0, p.cds[i] - extra);
      }
    }
    if (has("t_speed") && p.rollT <= 0 && p.attackT <= 0 && !p.charging) {
      const k = g.keys;
      let mx = 0, my = 0;
      if (k.has("a") || k.has("arrowleft"))
        mx -= 1;
      if (k.has("d") || k.has("arrowright"))
        mx += 1;
      if (k.has("w") || k.has("arrowup"))
        my -= 1;
      if (k.has("s") || k.has("arrowdown"))
        my += 1;
      if (mx !== 0 || my !== 0) {
        const tile = tileAt(g.map, g.rows, Math.floor(p.x / TILE), Math.floor((p.y + p.h / 2) / TILE), g.epoch);
        if (tile !== "i") {
          const l = Math.hypot(mx, my) || 1;
          g.moveEntity(p, mx / l * 74 * 0.12 * dt, my / l * 74 * 0.12 * dt);
        }
      }
    }
    if (p.attackT > 0 && rt.attackPrev <= 0 && has("c_eco") && p.rollT <= 0) {
      rt.echoTimers.push(0.16);
    }
    rt.attackPrev = p.attackT;
    for (let i = rt.echoTimers.length - 1;i >= 0; i--) {
      rt.echoTimers[i] -= dt;
      if (rt.echoTimers[i] <= 0) {
        rt.echoTimers.splice(i, 1);
        if (g.state === "play") {
          const dmg = playerMeleeDmg(p) * 0.35 * skillDamageMult(g, "melee");
          g.aoeHit(p.x, p.y, 30, dmg, "ninguno", false);
          g.waves.push({ x: p.x, y: p.y, r: 4, maxR: 30, speed: 110, dmg: 0, hit: true });
          g.burst(p.x, p.y, "#ffe86a", 6, 50);
          audio.sfx("swing");
        }
      }
    }
    if (rt.auraT > 0) {
      rt.auraT -= dt;
      rt.auraTick -= dt;
      if (rt.auraTick <= 0) {
        rt.auraTick = 0.5;
        const dmg = playerSpellDmg(p) * 0.45 * skillDamageMult(g, "hechizo");
        for (const e of g.enemies) {
          if (e.dead)
            continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < 48 + e.w / 2) {
            g.damageEnemy(e, dmg, "fuego", 0);
            e.statuses.push({ kind: "quemado", t: 1.2, power: 3 + p.attrs.int * 0.25 });
          }
        }
      }
      if (Math.random() < 0.45) {
        const a = Math.random() * Math.PI * 2;
        g.particles.push({
          x: p.x + Math.cos(a) * 40,
          y: p.y + Math.sin(a) * 40 - 4,
          vx: Math.cos(a) * 10,
          vy: -30 - Math.random() * 20,
          t: 0.4,
          maxT: 0.4,
          color: "#ff9040",
          size: 1.6,
          grav: 0
        });
      }
    }
    if (rt.shieldT > 0) {
      rt.shieldT -= dt;
      if (rt.shieldT <= 0) {
        rt.shield = 0;
        g.toast("La Bendición se desvanece", "#9aa0b8");
      } else if (Math.random() < 0.2) {
        const a = Math.random() * Math.PI * 2;
        g.particles.push({
          x: p.x + Math.cos(a) * 16,
          y: p.y - 4 + Math.sin(a) * 16,
          vx: Math.cos(a) * 6,
          vy: Math.sin(a) * 6 - 8,
          t: 0.35,
          maxT: 0.35,
          color: "#ffe9a0",
          size: 1.4,
          grav: 0
        });
      }
    }
    const combat = g.enemies.some((e) => e.aggro && !e.dead);
    if (combat && !rt.combat && has("t_amuleto") && !rt.amuletoCharge) {
      rt.amuletoCharge = true;
      g.toast("El Amuleto de Aelthar despierta: absorberá un golpe", "#ffe9a0");
    }
    rt.combat = combat;
    if (p.hp < rt.prevHp - 0.01 && p.hp > 0) {
      let pend = rt.prevHp - p.hp;
      if (rt.shield > 0) {
        const ab = Math.min(rt.shield, pend);
        rt.shield -= ab;
        p.hp += ab;
        pend -= ab;
        g.floatAt(p.x, p.y - 26, `escudo +${Math.round(ab)}`, "#ffe9a0");
        if (rt.shield <= 0) {
          g.toast("La Bendición se rompe absorbiendo el golpe", "#ffe9a0");
          audio.sfx("parry");
          g.burst(p.x, p.y - 4, "#ffe9a0", 14, 70);
        }
      }
      if (pend > 0 && rt.amuletoCharge && has("t_amuleto")) {
        p.hp += pend;
        rt.amuletoCharge = false;
        p.iframes = Math.max(p.iframes, 0.5);
        g.floatAt(p.x, p.y - 32, "Amuleto: golpe absorbido", "#ffe9a0", 10);
        g.toast("El Amuleto de Aelthar se quiebra: el golpe se disuelve en canto", "#ffe9a0");
        audio.sfx("parry");
        addFlash(g, "#fff8c0", 0.12);
        g.burst(p.x, p.y - 4, "#ffe9a0", 18, 90);
      }
    }
    for (const tid of ["campana", "brujula", "amuleto"]) {
      const key = TOOL_INFO[tid].key;
      if (g.keys.has(key) && !rt.prevKeys.has(key))
        activateTool(g, tid);
    }
    if (rt.campanaCd > 0)
      rt.campanaCd -= dt;
    if (rt.brujulaCd > 0)
      rt.brujulaCd -= dt;
    if (rt.compassT > 0) {
      rt.compassT -= dt;
      if (rt.compassMap !== g.mapId) {
        const t = questTargetPos(g);
        rt.compassTarget = t;
        rt.compassMap = g.mapId;
      }
      rt.compassTick -= dt;
      if (rt.compassTick <= 0 && rt.compassTarget) {
        rt.compassTick = 0.22;
        const dx = rt.compassTarget.x - p.x, dy = rt.compassTarget.y - p.y;
        const l = Math.max(1, Math.hypot(dx, dy));
        g.particles.push({
          x: p.x + (Math.random() - 0.5) * 8,
          y: p.y + (Math.random() - 0.5) * 6,
          vx: dx / l * 46,
          vy: dy / l * 46 - 6,
          t: 0.8,
          maxT: 0.8,
          color: "#ffe9a0",
          size: 1.6,
          grav: 0
        });
      }
    }
    stepLances(g, rt, dt);
  }
  rt.prevHp = p.hp;
  rt.prevGold = p.gold;
  rt.prevKills = p.kills;
  rt.prevKeys = new Set(g.keys);
}
function stepLances(g, rt, dt) {
  for (let i = rt.lances.length - 1;i >= 0; i--) {
    const ln = rt.lances[i];
    ln.x += ln.vx * dt;
    ln.y += ln.vy * dt;
    ln.t -= dt;
    if (Math.random() < 0.7) {
      g.particles.push({
        x: ln.x + (Math.random() - 0.5) * 4,
        y: ln.y + (Math.random() - 0.5) * 4,
        vx: 0,
        vy: 0,
        t: 0.2,
        maxT: 0.2,
        color: "#fff8c0",
        size: 1.8,
        grav: 0
      });
    }
    let dead = ln.t <= 0 || g.tileSolidAt(ln.x, ln.y);
    if (!dead) {
      for (const e of g.enemies) {
        if (e.dead || ln.hits.has(e))
          continue;
        if (Math.hypot(e.x - ln.x, e.y - ln.y) < 12 + e.w / 2) {
          ln.hits.add(e);
          g.damageEnemy(e, ln.dmg, "sagrado", 40, Math.sign(ln.vx), Math.sign(ln.vy));
          g.burst(ln.x, ln.y, "#fff8c0", 6, 55);
          if (ln.hits.size >= 4) {
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) {
      g.burst(ln.x, ln.y, "#ffe86a", 10, 70);
      rt.lances.splice(i, 1);
    }
  }
}
var selMap = new WeakMap;
function nodeById(id) {
  if (!id)
    return null;
  return SKILL_TREE.find((n) => n.id === id) ?? null;
}
function starFrac(i, salt) {
  const a = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return a - Math.floor(a);
}
function drawSkillTree(g) {
  const ctx = g.ctx;
  const p = g.player;
  ctx.fillStyle = "#060a14";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let i = 0;i < 46; i++) {
    const sx = starFrac(i, 1) * VIEW_W;
    const sy = starFrac(i, 2) * VIEW_H;
    const tw = 0.35 + 0.3 * starFrac(i, 3) + 0.2 * Math.sin(g.globalT * 1.5 + i);
    ctx.fillStyle = `rgba(200,214,240,${Math.max(0.08, tw * 0.5).toFixed(2)})`;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
  }
  if (!p) {
    text(g, "Ningún Portador contempla la constelación...", VIEW_W / 2, VIEW_H / 2, 16, COL.dim, "center");
    return;
  }
  const tree = getTree(p);
  const learned = new Set(tree.learned);
  const avail = pointsAvailable(p);
  const sel = selMap.get(g) ?? null;
  const selNode = nodeById(sel);
  textShadow(g, "LA CONSTELACIÓN DEL PORTADOR", VIEW_W / 2, 12, 13, COL.goldSoft, "#000", "center", true);
  text(g, "el árbol de habilidades", VIEW_W / 2, 30, 13, COL.dim, "center");
  textShadow(g, `Puntos de habilidad: ${avail}`, 14, 12, 11, avail > 0 ? COL.gold : COL.dim, "#000", "left", true);
  text(g, `${p.name} · ${p.discipline === "alba" ? "Portador del Alba" : "Tejedora de Cantos"} · Nv ${p.level}`, VIEW_W - 14, 14, 13, COL.dim, "right");
  const pad = 14;
  const top = 50;
  const footerH = 118;
  const colGap = 10;
  const colW = (VIEW_W - pad * 2 - colGap * 2) / 3;
  const treeBottom = VIEW_H - footerH - 6;
  const branches = ["filo", "eco", "camino"];
  const maxTiers = 5;
  const pitch = Math.max(42, Math.min(64, Math.floor((treeBottom - top - 36) / maxTiers)));
  const nodeR = Math.max(12, Math.min(16, Math.floor(pitch * 0.28)));
  for (let bi = 0;bi < 3; bi++) {
    const b = branches[bi];
    const info = TREE_BRANCHES[b];
    const colX = pad + bi * (colW + colGap);
    panel(g, colX, top, colW, treeBottom - top, info.color, "rgba(10,12,22,0.72)");
    textShadow(g, info.name, colX + colW / 2, top + 7, 10, info.color, "#000", "center", true);
    text(g, info.sub, colX + colW / 2, top + 21, 12, COL.dim, "center");
    const bnodes = SKILL_TREE.filter((n) => n.branch === b);
    const tierOf = new Map;
    for (const n of bnodes) {
      const pt = n.parent ? tierOf.get(n.parent) : undefined;
      tierOf.set(n.id, n.parent && pt !== undefined ? pt + 1 : 0);
    }
    const pos = new Map;
    const tiers = [];
    for (const n of bnodes) {
      const t = tierOf.get(n.id) ?? 0;
      (tiers[t] ??= []).push(n);
    }
    for (let t = 0;t < tiers.length; t++) {
      const row = (tiers[t] ?? []).slice().sort((a, c) => {
        const ax = a.parent ? pos.get(a.parent)?.x ?? colX + colW / 2 : colX + colW / 2;
        const cx2 = c.parent ? pos.get(c.parent)?.x ?? colX + colW / 2 : colX + colW / 2;
        return ax - cx2;
      });
      const spacing = Math.min(58, (colW - 20) / Math.max(1, row.length));
      const mid = colX + colW / 2;
      row.forEach((n, idx) => {
        pos.set(n.id, { x: mid + (idx - (row.length - 1) / 2) * spacing, y: top + 40 + t * pitch + nodeR });
      });
    }
    for (const n of bnodes) {
      if (!n.parent)
        continue;
      const from = pos.get(n.parent), to = pos.get(n.id);
      if (!from || !to)
        continue;
      const lit = learned.has(n.id) && learned.has(n.parent);
      ctx.strokeStyle = lit ? info.color : "#2c2c3c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y + nodeR);
      ctx.lineTo(to.x, to.y - nodeR - 10);
      ctx.stroke();
    }
    for (const n of bnodes) {
      const pp = pos.get(n.id);
      if (!pp)
        continue;
      const isLearned = learned.has(n.id);
      const discLocked = n.disc !== undefined && n.disc !== p.discipline;
      const parentOk = !n.parent || learned.has(n.parent);
      const canLearn = !isLearned && !discLocked && parentOk && avail >= n.cost;
      const hover = addHit(g, pp.x - 24, pp.y - nodeR - 4, 48, nodeR * 2 + 24, () => {
        selMap.set(g, n.id);
        audio.sfx("blip");
      });
      let ring = "#33334a";
      let fill = "rgba(16,18,30,0.9)";
      let glyph = "#565668";
      if (isLearned) {
        ring = info.color;
        fill = "rgba(30,26,18,0.92)";
        glyph = info.color;
      } else if (canLearn) {
        ring = hover ? "#ffffff" : `rgba(255,255,255,${(0.45 + 0.25 * Math.sin(g.globalT * 4)).toFixed(2)})`;
        glyph = "#c8c8d8";
      } else if (hover) {
        ring = "#6a6a8a";
        glyph = "#9a9ab0";
      }
      if (sel === n.id) {
        ctx.strokeStyle = COL.goldSoft;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, nodeR + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, nodeR, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = ring;
      ctx.lineWidth = 2;
      ctx.stroke();
      text(g, n.icon, pp.x, pp.y - 8, 13, glyph, "center");
      const name = n.name.length > 15 ? n.name.slice(0, 14) + "…" : n.name;
      text(g, name, pp.x, pp.y + nodeR + 2, 11, isLearned ? COL.text : "#7a7a90", "center");
      if (!isLearned)
        text(g, `◆${n.cost}`, pp.x, pp.y + nodeR + 14, 11, canLearn ? COL.gold : "#6a6a80", "center");
      if (isLearned) {
        ctx.fillStyle = COL.gold;
        ctx.fillRect(pp.x + nodeR - 3, pp.y - nodeR + 1, 3, 3);
      }
      if (discLocked)
        text(g, n.disc === "alba" ? "alba" : "tej.", pp.x, pp.y - nodeR - 12, 10, "#6a6a80", "center");
    }
  }
  const fy = VIEW_H - footerH + 2;
  panel(g, pad, fy, VIEW_W - pad * 2, footerH - 10);
  if (!selNode) {
    text(g, "Elige una estrella de tu constelación: pasivas, magias nuevas y herramientas.", pad + 14, fy + 12, 14, COL.dim);
    text(g, "Clic en un nodo disponible para aprenderlo con puntos de habilidad (◆).", pad + 14, fy + 32, 14, COL.dim);
    text(g, "Las magias nuevas se equipan en los huecos 1-4 (sustituyen a la habilidad base, que duerme).", pad + 14, fy + 52, 14, COL.dim);
  } else {
    const bx = pad + 14;
    const info = TREE_BRANCHES[selNode.branch];
    const btnX = pad + Math.floor((VIEW_W - pad * 2) * 0.52);
    textShadow(g, selNode.name, bx, fy + 10, 11, info.color, "#000", "left", true);
    const kindTxt = selNode.kind === "activa" ? "Habilidad activa" : selNode.kind === "herramienta" ? "Herramienta" : "Pasiva";
    const discTxt = selNode.disc ? selNode.disc === "alba" ? " · solo Alba" : " · solo Tejedora" : "";
    text(g, `${kindTxt}${discTxt} · coste ${selNode.cost} ◆`, bx, fy + 27, 13, COL.dim);
    const maxChars = Math.max(24, Math.floor((btnX - bx - 20) / 7));
    wrapText(selNode.desc, maxChars).slice(0, 3).forEach((l, i) => {
      text(g, l, bx, fy + 44 + i * 15, 14, COL.text);
    });
    const isLearned = learned.has(selNode.id);
    const discLocked = selNode.disc !== undefined && selNode.disc !== p.discipline;
    const parentOk = !selNode.parent || learned.has(selNode.parent);
    if (isLearned && selNode.kind === "activa" && selNode.grants) {
      text(g, "Equipar en hueco:", btnX, fy + 10, 13, COL.dim);
      for (let s = 0;s < 4; s++) {
        const occ = SKILLS[p.discipline][s];
        const isMine = occ ? NEW_SKILL_IDS.has(occ.id) : false;
        const w2 = 30, h2 = 28;
        const bx2 = btnX + s * (w2 + 6);
        const hov = addHit(g, bx2, fy + 26, w2, h2, () => {
          if (selNode.grants)
            equipNewSkill(p, selNode.grants, s);
        });
        panel(g, bx2, fy + 26, w2, h2, hov ? COL.gold : COL.panelBorder, hov ? "rgba(40,34,20,0.95)" : COL.panel);
        text(g, `${s + 1}`, bx2 + 3, fy + 29, 9, COL.gold, "left", true);
        if (occ)
          text(g, occ.icon, bx2 + w2 / 2 + 2, fy + 31, 12, isMine ? COL.goldSoft : "#8a8a9a", "center");
      }
      const equippedHere = tree.equip.some((id) => id === selNode.grants);
      if (equippedHere) {
        const slot = tree.equip.findIndex((id) => id === selNode.grants);
        const hov = addHit(g, btnX, fy + 60, 150, 22, () => {
          unequipSlot(p, slot);
        });
        panel(g, btnX, fy + 60, 150, 22, hov ? COL.danger : COL.panelBorder);
        text(g, `Quitar del hueco ${slot + 1}`, btnX + 75, fy + 64, 12, hov ? COL.danger : COL.dim, "center");
      } else {
        text(g, "Clic en un hueco: la habilidad base duerme hasta que la quites", btnX, fy + 64, 12, COL.dim);
      }
    } else if (isLearned && selNode.kind === "herramienta" && selNode.grants) {
      const ti = TOOL_INFO[selNode.grants];
      button(g, `Usar (tecla ${ti.key})`, btnX, fy + 12, 150, 28, () => {
        activateTool(g, selNode.grants);
      }, 10);
      text(g, ti.desc, btnX, fy + 46, 12, COL.dim);
    } else if (isLearned) {
      text(g, "✓ Aprendida", btnX, fy + 14, 15, COL.quest);
    } else if (discLocked) {
      text(g, selNode.disc === "alba" ? "Reservada al Portador del Alba" : "Reservada a la Tejedora de Cantos", btnX, fy + 14, 13, COL.danger);
    } else if (!parentOk) {
      const par = nodeById(selNode.parent);
      text(g, `Requiere: ${par ? par.name : "???"}`, btnX, fy + 14, 13, COL.dim);
    } else if (avail < selNode.cost) {
      text(g, `Te faltan puntos (${selNode.cost} ◆)`, btnX, fy + 14, 13, COL.danger);
    } else {
      const grants = selNode.grants;
      button(g, `Aprender (−${selNode.cost} ◆)`, btnX, fy + 12, 170, 28, () => {
        learnNode(g, p, selNode);
      }, 10);
      if (selNode.kind === "activa" && grants) {
        text(g, "Se equipará en el hueco 3 (puedes moverla después)", btnX, fy + 46, 12, COL.dim);
      }
    }
  }
  text(g, "K/ESC cerrar · teclas 5/6/7: herramientas · ◆ = punto de habilidad (1 por nivel, +1 en Nv 5 y 10)", VIEW_W / 2, VIEW_H - 12, 12, COL.dim, "center");
}
function learnNode(g, p, node) {
  const t = getTree(p);
  if (t.learned.includes(node.id))
    return;
  if (node.disc && node.disc !== p.discipline)
    return;
  const parentOk = !node.parent || t.learned.includes(node.parent);
  if (!parentOk)
    return;
  if (pointsAvailable(p) < node.cost) {
    g.toast("No tienes puntos de habilidad suficientes", "#e88");
    audio.sfx("error");
    return;
  }
  t.learned.push(node.id);
  saveTree(p);
  applySkillStats(p, !!g.challengeRun);
  audio.sfx("levelup");
  g.burst(p.x, p.y - 6, "#ffe86a", 18, 80);
  if (node.kind === "activa" && node.grants) {
    equipNewSkill(p, node.grants, 2);
    g.toast(`${node.name}: desbloqueada y equipada en el hueco 3`, "#ffe86a");
  } else {
    g.toast(`${node.name} aprendida`, "#ffe86a");
  }
}

// src/game/worldlife.ts
var AVE = 0;
var MARIPOSA = 1;
var LUCIERNAGA = 2;
var PEZ = 3;
var POOL_CAP = 12;
var KIND_CAPS = [4, 6, 6, 3];
var POOL = Array.from({ length: POOL_CAP }, () => ({
  active: false,
  kind: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  ax: 0,
  ay: 0,
  t: 0,
  life: 1,
  state: 0,
  st: 0,
  seed: 0
}));
var kindCount = [0, 0, 0, 0];
var liveCount = 0;
var SPAWN_OK = new Set(["lunaris", "bosque", "costa", "aldea", "cumbres"]);
var STATES2 = new WeakMap;
function stateFor2(g) {
  let s = STATES2.get(g);
  if (!s) {
    s = {
      clock: 0,
      spawnAcc: 0,
      evtIn: 38 + Math.random() * 22,
      evtCount: 0,
      forced: null,
      trav: { active: false, x: 0, y: 0, dir: 1, t: 0 },
      rumorNext: new Map,
      rot: 0,
      rumorsShown: 0,
      lastRumor: ""
    };
    STATES2.set(g, s);
  }
  return s;
}
function viewBounds(g) {
  const x0 = g.camX / ZOOM, y0 = g.camY / ZOOM;
  return [x0, y0, (g.camX + VIEW_W) / ZOOM, (g.camY + VIEW_H) / ZOOM];
}
function inView(x, y, b, margin) {
  return x >= b[0] - margin && x <= b[2] + margin && y >= b[1] - margin && y <= b[3] + margin;
}
function combatActive(g) {
  for (let i = 0;i < g.enemies.length; i++) {
    const e = g.enemies[i];
    if (!e.dead && e.aggro)
      return true;
  }
  return false;
}
function capFor(g) {
  return g.epoch === "pasado" ? POOL_CAP : 8;
}
function spawnInterval(g) {
  return g.epoch === "pasado" ? 1.35 : 2.4;
}
function freeSlot() {
  for (let i = 0;i < POOL_CAP; i++)
    if (!POOL[i].active)
      return POOL[i];
  return null;
}
function spawnAt(g, kind, x, y, life) {
  const c = freeSlot();
  if (!c)
    return false;
  c.active = true;
  c.kind = kind;
  c.x = x;
  c.y = y;
  c.vx = 0;
  c.vy = 0;
  c.ax = x;
  c.ay = y;
  c.t = 0;
  c.life = life;
  c.state = 0;
  c.st = 1 + Math.random() * 4;
  c.seed = Math.random() * Math.PI * 2;
  kindCount[kind]++;
  liveCount++;
  return true;
}
function trySpawn(g) {
  if (liveCount >= capFor(g))
    return;
  const b = viewBounds(g);
  const m = 20;
  for (let i = 0;i < 5; i++) {
    const wx = b[0] - m + Math.random() * (b[2] - b[0] + m * 2);
    const wy = b[1] - m + Math.random() * (b[3] - b[1] + m * 2);
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= g.map.w || ty >= g.map.h)
      continue;
    const ch = tileAt(g.map, g.rows, tx, ty, g.epoch);
    if (ch === "~") {
      if (g.mapId === "costa" && kindCount[PEZ] < KIND_CAPS[PEZ]) {
        if (spawnAt(g, PEZ, tx * TILE + 8, ty * TILE + 12, 24 + Math.random() * 20))
          return;
      }
    } else if (ch === "t" || ch === "p") {
      if (kindCount[AVE] < KIND_CAPS[AVE]) {
        if (spawnAt(g, AVE, tx * TILE + 8, ty * TILE + 5, 14 + Math.random() * 12))
          return;
      }
    } else if (!SOLID_CHARS.has(ch)) {
      const k = isNight(g) ? LUCIERNAGA : MARIPOSA;
      if (kindCount[k] < KIND_CAPS[k]) {
        if (spawnAt(g, k, tx * TILE + 8, ty * TILE + 6, 9 + Math.random() * 7))
          return;
      }
    }
  }
}
function despawn(c) {
  c.active = false;
  kindCount[c.kind]--;
  liveCount--;
}
function tickCritter(g, c, dt, b) {
  c.t += dt;
  const p = g.player;
  switch (c.kind) {
    case AVE: {
      if (c.state === 0) {
        c.st -= dt;
        if (c.st <= 0) {
          c.x += (Math.random() - 0.5) * 6;
          c.st = 2 + Math.random() * 6;
        }
        const dx = c.x - p.x, dy = c.y - p.y;
        if (dx * dx + dy * dy < 46 * 46) {
          c.state = 1;
          c.vx = (dx >= 0 ? 1 : -1) * (55 + Math.random() * 25);
          c.vy = -(55 + Math.random() * 30);
        } else if (c.t > c.life - 2) {
          c.state = 1;
          c.vx = (Math.random() < 0.5 ? -1 : 1) * 45;
          c.vy = -60;
        }
      } else {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vy -= 14 * dt;
      }
      break;
    }
    case MARIPOSA:
    case LUCIERNAGA: {
      c.vx = Math.sin(c.t * 0.9 + c.seed) * 13;
      c.vy = Math.cos(c.t * 1.3 + c.seed) * 8;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (Math.abs(c.x - c.ax) > 42)
        c.x += (c.ax - c.x) * dt * 0.8;
      if (Math.abs(c.y - c.ay) > 30)
        c.y += (c.ay - c.y) * dt * 0.8;
      break;
    }
    case PEZ: {
      if (c.state === 0) {
        c.st -= dt;
        c.y = c.ay;
        if (c.st <= 0) {
          c.state = 1;
          c.vy = -(62 + Math.random() * 26);
          c.vx = (Math.random() - 0.5) * 22;
          g.burst(c.x, c.ay, "#a8d8f0", 8, 46);
          const dx = c.x - p.x, dy = c.y - p.y;
          if (dx * dx + dy * dy < 150 * 150 && Math.random() < 0.8)
            audio.sfx("splash");
        }
      } else {
        c.vy += 250 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.vy > 0 && c.y >= c.ay) {
          c.y = c.ay;
          c.state = 0;
          c.st = 4 + Math.random() * 7;
          g.burst(c.x, c.ay, "#a8d8f0", 5, 34);
        }
      }
      break;
    }
  }
  if (c.t > c.life + 4 || !inView(c.x, c.y, b, 44))
    despawn(c);
}
function tickFauna(g, dt, st) {
  const b = viewBounds(g);
  for (let i = 0;i < POOL_CAP; i++) {
    const c = POOL[i];
    if (c.active)
      tickCritter(g, c, dt, b);
  }
  if (SPAWN_OK.has(g.mapId)) {
    st.spawnAcc += dt;
    if (st.spawnAcc >= spawnInterval(g)) {
      st.spawnAcc = 0;
      trySpawn(g);
    }
  }
}
function tickTraveler(g, dt, st) {
  const tv = st.trav;
  if (!tv.active)
    return;
  tv.t += dt;
  tv.x += tv.dir * 46 * dt;
  const b = viewBounds(g);
  if (!inView(tv.x, tv.y, b, 60) || tv.t > 40)
    tv.active = false;
}
var isPast = (g) => g.epoch === "pasado";
var isPresent = (g) => g.epoch === "presente";
var toneIs = (g, t) => {
  const p = g.player;
  return !!p && dominantTone(p) === t;
};
var RUMORS = {
  brisa: [
    { c: (g) => g.questIdx <= 1, s: "Brisa: «Los lobos rondan al caer el sol. Ve con cuidado, criatura.»" },
    { c: (g) => g.questIdx >= 2 && g.questIdx <= 4, s: "Brisa: «El Bosque susurra nombres que ya no son de nadie.»" },
    { c: (g) => !!g.flags.guardianDefeated && g.questIdx <= 5, s: "Brisa: «El Guardián calla por fin. Me tiemblan las manos de alivio.»" },
    { c: (g) => g.questIdx >= 5 && g.questIdx <= 6, s: "Brisa: «El mar guarda lo que el valle perdió. Búscalo al sur.»" },
    { c: (g) => g.questIdx >= 7 && g.questIdx <= 8 && !g.flags.acto2Done, s: "Brisa: «Merrow... había una nana de allí. Ya no la recuerdo entera.»" },
    { c: (g) => !!g.flags.acto2Done, s: "Brisa: «Vuelves con las manos llenas de ecos. El valle respira mejor.»" },
    { c: isPast, s: "Brisa: «¡El Festival del Canto! Huele a pan y a primavera otra vez...»" },
    { s: "Brisa: «El silencio pesa menos desde que llegaste, Portador.»" }
  ],
  toln: [
    { c: (g) => (g.player?.weaponPlus ?? 0) >= 5, s: "Toln: «+5 es lo que da de sí esta forja, Portador.»" },
    { c: (g) => !!g.flags.guardianDefeated, s: "Toln: «Con el Eco de la Voz, forjaré lo que el valle pida.»" },
    { c: isPresent, s: "Toln: «El metal recuerda el ritmo del martillo. Por eso sigo golpeando.»" },
    { c: isPast, s: "Toln: «¡Encargos del festival! Cola en la forja. Qué luz tan buena.»" },
    { s: "Toln: «Una espada sin canto corta. Con canto, convence.»" }
  ],
  teo: [
    { c: (g) => toneIs(g, "sarcastico"), s: "Teo: «Hablas raro, Portador. Me gustas.»" },
    { c: (g) => !!g.flags.guardianDefeated, s: "Teo: «¿De verdad bajaste a la Cripta? ¡Cuenta! ¡Cuenta!»" },
    { c: isPast, s: "Teo: «En el festival dan pastel con forma de luna. Antes daban tres.»" },
    { s: "Teo: «Yo soñé la Niebla antes de verla. ¿Eso es valiente o es raro?»" },
    { s: "Teo: «Cuando sea mayor quiero ser Portador. O panadero. O las dos cosas.»" }
  ],
  heraldo: [
    { c: (g) => toneIs(g, "amenazante"), s: "Heraldo: «La Orden apunta tu forma de hablar. Habla con cuidado.»" },
    { c: (g) => !!g.flags.guardianDefeated, s: "Heraldo: «El Eco de la Voz nos pertenece. La Orden cobra sus deudas.»" },
    { s: "Heraldo: «Vesh oye todo lo que se firma con voz. Todo.»" },
    { s: "Heraldo: «Las rutas del sur también son de la Orden. En los mapas, al menos.»" }
  ],
  ilwen: [
    { c: (g) => toneIs(g, "empatico"), s: "Ilwen: «Hay calma contigo. El Bosque también la nota.»" },
    { c: (g) => !!g.flags.sirenaDefeated, s: "Ilwen: «El canto de esa sirena ya no duele. Buen ojo, Portador.»" },
    { c: isPast, s: "Ilwen: «Las flores del pasado no crecen en círculo por casualidad.»" },
    { s: "Ilwen: «Nimue... no, nada. Sigue el camino y cubre mi espalda.»" },
    { s: "Ilwen: «Cuida tus flechas y tus promesas: se gastan igual.»" }
  ],
  doran: [
    { c: (g) => toneIs(g, "empatico"), s: "Doran: «El Círculo te escucha. El Bosque camina contigo.»" },
    { c: isPast, s: "Doran: «Huelo el festival de Merrow desde aquí. El mundo era más tierno.»" },
    { s: "Doran: «La Madre Espina tiene roto el corazón, no la voluntad.»" },
    { s: "Doran: «Las raíces gritan bajito. Solo hay que saber escuchar de rodillas.»" }
  ],
  mara: [
    { c: (g) => !!g.flags.maraGift, s: "Mara: «El faro arde. Trescientos años... y vuelve a arder.»" },
    { c: (g) => !!g.flags.sirenaDefeated, s: "Mara: «La marea volvió a leer nombres en vez de borrarlos.»" },
    { c: (g) => isNight(g), s: "Mara: «De noche, la lámpara aprende a temblar. Quédate cerca.»" },
    { s: "Mara: «El mar susurra con voz prestada. No le respondas con tu nombre.»" }
  ],
  vult: [
    { c: (g) => toneIs(g, "pragmatico"), s: "Vult: «Sin mapa no hay negocio. Contigo, quizá.»" },
    { c: (g) => !!g.flags.golemDefeated, s: "Vult: «Las Cumbres abiertas: la Liga lo celebrará con oro.»" },
    { c: isPresent, s: "Vult: «Cartografío el silencio. Es el bioma más extenso de Aelthar.»" },
    { s: "Vult: «La Liga paga por rutas, no por poemas. Pero qué poemas, eh.»" }
  ],
  mera: [
    { c: (g) => !!g.flags.ecoNombres, s: "Mera: «Mi nombre vuelve a mí... pieza a pieza. Gracias.»" },
    { c: (g) => isNight(g), s: "Mera: «Los faroles esperan nombres, no fuego. Díselo al ayer.»" },
    { c: isPast, s: "Mera: «Aquí había música. Ponla otra vez en las paredes.»" },
    { s: "Mera: «Merrow no es mi nombre. Es el que quedó cuando se lo robaron.»" }
  ],
  ivo: [
    { c: (g) => toneIs(g, "amenazante"), s: "Ivo: «Gritas a la montaña y la montaña te oye. Bien.»" },
    { c: (g) => !!g.flags.golemDefeated, s: "Ivo: «El paso está libre. Los pastores te deben el alba.»" },
    { c: isPast, s: "Ivo: «Los pastores cantaban por turnos: uno velaba la voz del otro.»" },
    { s: "Ivo: «El Gólem cuenta los coros bajo el hielo. No dejes que cuente el tuyo.»" }
  ]
};
var GENERIC_NOW = [
  "Aldeano: «¿Oíste eso? Dicen que los ecos te siguen, Portador.»",
  "Viajero: «El silencio aburre. El mundo espera lo que tú traes.»",
  "Voces: «...oye... el canto vuelve... lo dicen las piedras...»"
];
var GENERIC_PAST = [
  "Festejante: «¡El Festival! Canta algo, ¡que el dios te teje en el canto!»",
  "Festejante: «Hoy hasta las piedras parecen querer bailar.»",
  "Festejante: «Dicen que un Portador limpiará la Niebla. ¡Salud, si es tú!»"
];
function rumorPool(g, nid) {
  const rules = RUMORS[nid];
  if (!rules)
    return isPast(g) ? GENERIC_PAST : GENERIC_NOW;
  const out = [];
  for (const r of rules)
    if (!r.c || r.c(g))
      out.push(r.s);
  return out.length ? out : isPast(g) ? GENERIC_PAST : GENERIC_NOW;
}
function fireRumor(g, st, npc) {
  const pool2 = rumorPool(g, npc.nid);
  const text2 = pool2[st.rot++ % pool2.length];
  const color = g.epoch === "pasado" ? "#ffe0a0" : "#cfe0f8";
  g.floats.push({ x: npc.x, y: npc.y - 24, text: text2, t: 2.8, color, vy: -6, size: 7 });
  st.rumorNext.set(npc.nid, st.clock + 8 + Math.random() * 6);
  st.rumorsShown++;
  st.lastRumor = text2;
}
function tickRumors(g, st) {
  if (g.state !== "play" || g.challengeRun || combatActive(g))
    return;
  const p = g.player;
  const r = TILE * 2.5;
  let best = null;
  let bestD = r * r;
  for (let i = 0;i < g.npcs.length; i++) {
    const n = g.npcs[i];
    const dx = n.x - p.x, dy = n.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  if (!best)
    return;
  if (!st.rumorNext.has(best.nid)) {
    st.rumorNext.set(best.nid, st.clock + 2.5 + Math.random() * 3);
    return;
  }
  if (st.clock >= (st.rumorNext.get(best.nid) ?? Infinity))
    fireRumor(g, st, best);
}
var GUST_LINE = {
  lunaris: "Una ráfaga barre las hojas del valle...",
  bosque: "El Bosque se mece: una ráfaga larga remueve las copas.",
  costa: "La bruma se rasga: sal en el viento.",
  aldea: "El polvo del festival gira en una ráfaga.",
  cumbres: "La ventisca silba entre los pinos.",
  cripta: "Un polvo antiguo cae del techo de la Cripta."
};
var GUST_COLORS = {
  lunaris: ["#5a8a44", "#7aa04a", "#a07840"],
  bosque: ["#3e6a34", "#5a8a44", "#8a6a38"],
  costa: ["#c8d8c8", "#a8c0b0", "#d8d0b0"],
  aldea: ["#a89060", "#c0a870", "#907850"],
  cumbres: ["#e8f0f8", "#d0e0f0", "#f0f8ff"],
  cripta: ["#7a7a8a", "#5a5a6a", "#8a8a9a"]
};
function fireEvent(g, st, kind) {
  const roll = kind ?? (() => {
    const r = Math.random();
    if (r < 0.4)
      return "eco";
    if (r < 0.7 && !st.trav.active && g.mapId !== "cripta")
      return "viajero";
    return "rafaga";
  })();
  const p = g.player;
  st.evtCount++;
  if (roll === "eco") {
    audio.sfx(g.mapId === "cripta" ? "wraith" : "echo");
    g.floats.push({ x: p.x, y: p.y - 30, text: "...un eco lejano resuena...", t: 2.6, color: "#c8b0e8", vy: -8, size: 8 });
    const a = Math.random() * Math.PI * 2;
    const cx = Math.cos(a), sy = Math.sin(a);
    for (let i = 0;i < 8; i++) {
      const off = (i - 3.5) * 6;
      g.particles.push({
        x: p.x + cx * 80 - sy * off,
        y: p.y + sy * 80 + cx * off - 8,
        vx: -cx * 52 + (Math.random() - 0.5) * 10,
        vy: -sy * 52 + (Math.random() - 0.5) * 10,
        t: 1.4 + Math.random() * 0.4,
        maxT: 1.8,
        color: "#b8a8e8",
        size: 1.4,
        grav: 0
      });
    }
    return;
  }
  if (roll === "viajero") {
    const dir2 = Math.random() < 0.5 ? 1 : -1;
    const b2 = viewBounds(g);
    st.trav.active = true;
    st.trav.dir = dir2;
    st.trav.x = dir2 > 0 ? b2[0] - 24 : b2[2] + 24;
    st.trav.y = p.y - 4;
    st.trav.t = 0;
    g.toast("Un viajante errante cruza el camino, sin levantar la vista...", "#c8b0e8");
    return;
  }
  audio.sfx(g.mapId === "cripta" ? "wraith" : "gust");
  g.floats.push({ x: p.x, y: p.y - 30, text: GUST_LINE[g.mapId] ?? "Una ráfaga de viento cruza el mundo.", t: 2.6, color: "#9ac0a8", vy: -8, size: 8 });
  const dir = Math.random() < 0.5 ? 1 : -1;
  const b = viewBounds(g);
  const cols = GUST_COLORS[g.mapId] ?? GUST_COLORS.lunaris;
  const n = 12;
  for (let i = 0;i < n; i++) {
    g.particles.push({
      x: dir > 0 ? b[0] - 10 + Math.random() * 20 : b[2] + 10 - Math.random() * 20,
      y: b[1] + Math.random() * (b[3] - b[1]) * 0.7,
      vx: dir * (95 + Math.random() * 65),
      vy: -12 + Math.random() * 26,
      t: 1.6 + Math.random() * 0.8,
      maxT: 2.4,
      color: cols[i % cols.length],
      size: 1.5 + Math.random(),
      grav: g.mapId === "cumbres" ? 12 : 26
    });
  }
}
function tickEvents(g, dt, st) {
  st.evtIn -= dt;
  if (st.evtIn > 0)
    return;
  if (g.state !== "play" || g.challengeRun || combatActive(g)) {
    st.evtIn = 5;
    return;
  }
  fireEvent(g, st, st.forced ?? undefined);
  st.forced = null;
  st.evtIn = 45 + Math.random() * 45;
}
function worldTick(g, dt) {
  if (!g.player)
    return;
  if (g.state !== "play" && g.state !== "dialogue")
    return;
  const st = stateFor2(g);
  st.clock += dt;
  tickFauna(g, dt, st);
  tickTraveler(g, dt, st);
  tickRumors(g, st);
  tickEvents(g, dt, st);
}
var WATER_LINES = {
  lunaris: {
    now: "El estanque está quieto. Ni un reflejo contesta.",
    past: "Los aldeanos susurran sus nombres al agua: el estanque brilla."
  },
  bosque: {
    now: "El río lleva musgo y silencio río abajo.",
    past: "El río canta bajo el puente entero."
  },
  costa: {
    now: "El mar susurra. No le respondas con tu nombre.",
    past: "La marea lee nombres en voz baja; hoy lee el tuyo."
  },
  aldea: {
    now: "La laguna no refleja nada. La Niebla bebió demasiado.",
    past: "La laguna brilla con las guirnaldas del festival."
  },
  cumbres: {
    now: "El lago helado guarda coros boca arriba, debajo.",
    past: "Bajo el hielo del ayer, los coros aún piden ayuda... en armonía."
  },
  cripta: {
    now: "El polvo de la Cripta no conoce el agua.",
    past: "El polvo de la Cripta no conoce el agua."
  }
};
function say(g, text2, color = "#c8d8f0") {
  const p = g.player;
  g.floats.push({ x: p.x, y: p.y - 30, text: text2, t: 2.8, color, vy: -6, size: 7 });
}
function worldInteract(g) {
  const p = g.player;
  if (!p)
    return false;
  for (let i = 0;i < g.map.props.length; i++) {
    const pr = g.map.props[i];
    if (pr.needPast && g.epoch !== "pasado")
      continue;
    if (pr.needPresent && g.epoch !== "presente")
      continue;
    const px3 = pr.x * TILE + 8, py = pr.y * TILE + 8;
    const dx = px3 - p.x, dy = py - p.y;
    if (dx * dx + dy * dy > 34 * 34)
      continue;
    if (pr.kind === "wreck") {
      say(g, g.epoch === "pasado" ? "El barco aún flota en el ayer: la tripulación canta al doblar el cabo." : "El naufragio cruje. Algo canta debajo, salado y vivo.", "#a8d0e0");
      return true;
    }
    if (pr.kind === "faro") {
      say(g, g.flags.maraGift ? "El faro de Mara arde de nuevo: la costa tiene permiso para volver." : g.epoch === "pasado" ? "La lámpara gira cantando: una nota por vuelta de engranaje." : "El faro está a oscuras. Nadie sube ya la lámpara.", "#ffe0a0");
      return true;
    }
    if (pr.kind === "lamp" && !!g.flags[pr.id]) {
      g.burst(px3, py - 8, "#ffe9a0", isNight(g) ? 12 : 6, 40);
      say(g, isNight(g) ? "El farol chispea: el nombre que guarda está inquieto." : "El farol arde con un nombre dentro.", "#ffe9a0");
      if (isNight(g))
        audio.sfx("lamp");
      return true;
    }
  }
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  const OFFS = [
    [0, 0],
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ];
  for (let o = 0;o < OFFS.length; o++) {
    const tx = ptx + OFFS[o][0], ty = pty + OFFS[o][1];
    if (tx < 0 || ty < 0 || tx >= g.map.w || ty >= g.map.h)
      continue;
    const ch = tileAt(g.map, g.rows, tx, ty, g.epoch);
    if (ch === "w") {
      say(g, g.epoch === "pasado" ? "Susurra un nombre al pozo: abajo, algo lo teje en el canto." : "El pozo de los nombres devuelve solo silencio.", "#a8c8e0");
      return true;
    }
    if (ch === "g") {
      say(g, "Una lápida sin nombre. El musgo recuerda lo que los vivos olvidaron.", "#9aa8b8");
      return true;
    }
    if (ch === "R") {
      say(g, g.epoch === "pasado" ? "La talla aún vive en el ayer: una nota del Primer Canto." : "Una piedra antigua. Hubo algo tallado aquí; el tiempo lo borró.", "#9aa8b8");
      return true;
    }
    if (ch === "~") {
      const line = WATER_LINES[g.mapId] ?? {
        now: "El agua te devuelve el silencio.",
        past: "El agua del ayer tiene ecos de fiesta."
      };
      g.burst(tx * TILE + 8, ty * TILE + 8, "#a8d8f0", 10, 50);
      audio.sfx("splash");
      say(g, g.epoch === "pasado" ? line.past : line.now, "#a8d0e0");
      return true;
    }
  }
  return false;
}
function mkCanvas2(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  draw(x);
  return c;
}
var cacheBird = null;
var cacheFly = null;
var cacheGlow = null;
var cacheTrav = null;
function ensureCaches() {
  if (cacheBird)
    return;
  const bird = (wing) => mkCanvas2(12, 9, (c) => {
    c.fillStyle = "#4a3a5a";
    c.beginPath();
    c.ellipse(6, 5, 4, 2.4, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(9.4, 3.6, 2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e8a040";
    c.beginPath();
    c.moveTo(11.2, 3.4);
    c.lineTo(12, 4);
    c.lineTo(11.2, 4.4);
    c.fill();
    c.fillStyle = "#0c0c14";
    c.fillRect(9.8, 3, 1, 1);
    c.fillStyle = "#3a2c48";
    c.fillRect(0, 4, 3, 2);
    c.fillStyle = "#5c4a70";
    c.beginPath();
    if (wing === 0) {
      c.moveTo(5, 4);
      c.lineTo(8, 0);
      c.lineTo(9, 4.4);
    } else {
      c.moveTo(5, 5);
      c.lineTo(8, 8.5);
      c.lineTo(9, 4.6);
    }
    c.closePath();
    c.fill();
  });
  cacheBird = [bird(0), bird(1)];
  const fly = (body, wingCol) => [0, 1].map((f) => mkCanvas2(7, 6, (c) => {
    c.fillStyle = wingCol;
    if (f === 0) {
      c.beginPath();
      c.ellipse(2.2, 2.6, 2, 2.4, -0.5, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(4.8, 2.6, 2, 2.4, 0.5, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.ellipse(2.6, 2.6, 1, 2.4, -0.1, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(4.4, 2.6, 1, 2.4, 0.1, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = body;
    c.fillRect(3.2, 1.2, 0.8, 3.4);
    c.fillRect(3.1, 4.6, 0.4, 1);
    c.fillRect(3.7, 4.6, 0.4, 1);
  }));
  cacheFly = [fly("#3a3a3a", "#e88ab0"), fly("#3a3a3a", "#f0d060")];
  cacheGlow = mkCanvas2(12, 12, (c) => {
    const rg = c.createRadialGradient(6, 6, 0.5, 6, 6, 6);
    rg.addColorStop(0, "rgba(214,255,170,0.95)");
    rg.addColorStop(0.45, "rgba(170,240,130,0.4)");
    rg.addColorStop(1, "rgba(150,230,120,0)");
    c.fillStyle = rg;
    c.fillRect(0, 0, 12, 12);
  });
  cacheTrav = mkCanvas2(16, 20, (c) => {
    c.fillStyle = "#2a3a44";
    c.beginPath();
    c.moveTo(5, 6);
    c.lineTo(11, 6);
    c.lineTo(13, 19);
    c.lineTo(3, 19);
    c.closePath();
    c.fill();
    c.fillStyle = "#d8b890";
    c.beginPath();
    c.arc(8, 4.4, 2.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#22303a";
    c.beginPath();
    c.arc(8, 4, 2.7, Math.PI * 0.9, Math.PI * 2.2);
    c.fill();
    c.fillStyle = "#18242c";
    c.fillRect(6.4, 3.4, 3.2, 1.4);
    c.fillStyle = "#8a7ab0";
    c.fillRect(7.6, 10, 0.8, 0.8);
    c.fillRect(7.6, 13, 0.8, 0.8);
    c.fillStyle = "#6a4a2a";
    c.fillRect(13, 1, 1, 18);
    c.fillStyle = "#8a6a3a";
    c.beginPath();
    c.arc(13.5, 1.6, 1.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#5a4426";
    c.fillRect(3, 10, 3, 3);
  });
}
var TAU = Math.PI * 2;
function drawWorldLife(g, sx, sy) {
  if (!g.player)
    return;
  const st = STATES2.get(g);
  if (!st)
    return;
  const ox = sx ?? ((wx) => wx * ZOOM - Math.round(g.camX));
  const oy = sy ?? ((wy) => wy * ZOOM - Math.round(g.camY));
  ensureCaches();
  const ctx = g.ctx;
  const camXr = Math.round(g.camX), camYr = Math.round(g.camY);
  const vis = (wx, wy, pad) => {
    const sxx = wx * ZOOM - camXr, syy = wy * ZOOM - camYr;
    return sxx > -pad && sxx < VIEW_W + pad && syy > -pad && syy < VIEW_H + pad;
  };
  const tv = st.trav;
  if (tv.active && cacheTrav && vis(tv.x, tv.y, 48)) {
    const bob = Math.floor(tv.t * 6) % 2;
    ctx.drawImage(cacheTrav, ox(tv.x - 8), oy(tv.y - 16 - bob), 16 * ZOOM, 20 * ZOOM);
  }
  for (let i = 0;i < POOL_CAP; i++) {
    const c = POOL[i];
    if (!c.active || !vis(c.x, c.y, 40))
      continue;
    if (c.kind === AVE && cacheBird) {
      const fr = c.state === 1 ? Math.floor(c.t * 12) % 2 : 0;
      const bob = c.state === 0 ? Math.sin(c.t * 2 + c.seed) * 0.6 : 0;
      const img = cacheBird[fr];
      if (c.vx < 0) {
        ctx.save();
        ctx.translate(ox(c.x + 6), oy(c.y - 4.5 - bob));
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, 12 * ZOOM, 9 * ZOOM);
        ctx.restore();
      } else {
        ctx.drawImage(img, ox(c.x - 6), oy(c.y - 4.5 - bob), 12 * ZOOM, 9 * ZOOM);
      }
    } else if (c.kind === MARIPOSA && cacheFly) {
      const fr = Math.floor(c.t * 9) % 2;
      const img = cacheFly[Math.floor(c.seed) % 2][fr];
      ctx.drawImage(img, ox(c.x - 3.5), oy(c.y - 3), 7 * ZOOM, 6 * ZOOM);
    } else if (c.kind === LUCIERNAGA && cacheGlow) {
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(c.t * 2 + c.seed));
      ctx.globalAlpha = pulse;
      ctx.drawImage(cacheGlow, ox(c.x - 6), oy(c.y - 6), 12 * ZOOM, 12 * ZOOM);
      ctx.fillStyle = "#f2ffc8";
      ctx.fillRect(ox(c.x - 0.75), oy(c.y - 0.75), 1.5 * ZOOM, 1.5 * ZOOM);
      ctx.globalAlpha = 1;
    } else if (c.kind === PEZ) {
      if (c.state === 0) {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#204060";
        ctx.beginPath();
        ctx.ellipse(ox(c.x), oy(c.ay + 3), 3 * ZOOM, 1.2 * ZOOM, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#b8ccd8";
        ctx.beginPath();
        ctx.ellipse(ox(c.x), oy(c.y - 2), 2.6 * ZOOM, 1.6 * ZOOM, c.vy < 0 ? -0.4 : 0.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#e8f0f4";
        ctx.fillRect(ox(c.x - 0.5), oy(c.y - 3), 1 * ZOOM, 1 * ZOOM);
      }
    }
  }
}

// src/game/render.ts
var WORLD_FILTER = {
  presente: "saturate(0.74) contrast(0.98)",
  pasado: "saturate(1.35) brightness(1.1)"
};
function drawGame(g) {
  const ctx = g.ctx;
  clearHits(g);
  const dtF = fxFrame(g);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (g.state === "title" || g.state === "controls") {
    drawScreens(g);
    return;
  }
  if (g.state === "skills") {
    drawSkillTree(g);
    return;
  }
  if (g.state === "play" || g.state === "dialogue") {
    updateAmbient(g, dtF);
  }
  drawWorld(g);
  drawHud(g);
  drawOverlays(g);
  drawScreens(g);
}
function drawWorld(g) {
  const ctx = g.ctx;
  const shx = g.shake > 0.2 ? (Math.random() - 0.5) * g.shake * 2 : 0;
  const shy = g.shake > 0.2 ? (Math.random() - 0.5) * g.shake * 2 : 0;
  ctx.save();
  ctx.translate(shx, shy);
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const ground = g.epoch === "pasado" && g.groundPastCanvas ? g.groundPastCanvas : g.groundCanvas;
  if (ground) {
    ctx.save();
    ctx.filter = WORLD_FILTER[g.epoch] ?? "none";
    const gx = Math.floor(camX / ZOOM), gy = Math.floor(camY / ZOOM);
    ctx.drawImage(ground, gx, gy, VIEW_W / ZOOM, VIEW_H / ZOOM, 0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
  const sx = (wx) => wx * ZOOM - camX;
  const sy = (wy) => wy * ZOOM - camY;
  drawWaterGlints(g, sx, sy);
  ctx.save();
  ctx.filter = WORLD_FILTER[g.epoch] ?? "none";
  for (const dgl of g.deadGolds) {
    if (dgl.map !== g.mapId)
      continue;
    const bob = Math.sin(g.globalT * 3) * 2;
    ctx.drawImage(getSpr("goldbag")[0], sx(dgl.x - 5), sy(dgl.y - 8 + bob), 10 * ZOOM, 8 * ZOOM);
  }
  for (const ec of g.map.echoes) {
    if (g.takenEchoes.has(ec.id))
      continue;
    const bob = Math.sin(g.globalT * 2 + ec.x) * 2;
    const fr = Math.floor(g.globalT * 3) % 2;
    ctx.globalAlpha = 0.75;
    ctx.drawImage(getSpr("wisp")[fr], sx(ec.x * TILE + 8 - 5), sy(ec.y * TILE + 2 + bob), 10 * ZOOM, 10 * ZOOM);
    ctx.globalAlpha = 1;
  }
  drawProps(g, sx, sy);
  drawRollTrail(g, sx, sy);
  const ents = [];
  for (const n of g.npcs)
    ents.push({ e: n, y: n.y });
  if (g.companion && g.companion.downT <= 0)
    ents.push({ e: g.companion, y: g.companion.y });
  for (const e of g.enemies)
    if (!e.dead)
      ents.push({ e, y: e.y });
  if (g.player)
    ents.push({ e: g.player, y: g.player.y });
  ents.sort((a, b) => a.y - b.y);
  for (const { e } of ents) {
    drawEntity(g, e, sx, sy);
  }
  ctx.restore();
  for (const ch of g.map.chests) {
    if (ch.needPast && g.epoch !== "pasado")
      continue;
    const opened = g.openedChests.has(ch.id);
    const sprC = getSpr(opened ? "chest_open" : "chest")[0];
    ctx.drawImage(sprC, sx(ch.x * TILE), sy(ch.y * TILE - 2), 16 * ZOOM, 14 * ZOOM);
  }
  drawWorldLife(g, sx, sy);
  drawCombatFx(g, sx, sy);
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.t / p.maxT);
    ctx.fillStyle = p.color;
    ctx.fillRect(sx(p.x) - p.size, sy(p.y) - p.size, p.size * 2 * ZOOM * 0.6, p.size * 2 * ZOOM * 0.6);
  }
  ctx.globalAlpha = 1;
  drawAmbient(g, "world");
  drawBiomeTint(g);
  drawLighting(g);
  drawAmbient(g, "sky");
  drawFloats(g, sx, sy);
  drawInteractPrompt(g, sx, sy);
  if (g.mapTitleT > 0) {
    const a = Math.min(1, g.mapTitleT);
    ctx.globalAlpha = Math.min(1, a * 1.5);
    textShadow(g, g.map.name, VIEW_W / 2, 90, 18, COL.goldSoft, "#000", "center", true);
    text(g, g.map.subtitle, VIEW_W / 2, 120, 16, COL.dim, "center");
    ctx.globalAlpha = 1;
  }
  if (g.epochFx > 0) {
    const a = g.epochFx / 0.8;
    ctx.fillStyle = g.epoch === "pasado" ? `rgba(255, 216, 138, ${a * 0.5})` : `rgba(120, 140, 190, ${a * 0.5})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (a > 0.4) {
      textShadow(g, g.epoch === "pasado" ? "◆ EL PASADO ◆" : "◆ EL PRESENTE ◆", VIEW_W / 2, 180, 16, g.epoch === "pasado" ? COL.epochPast : COL.epochNow, "#000", "center", true);
    }
  }
  if (g.fadeT > 0) {
    ctx.fillStyle = `rgba(4,4,10,${g.fadeT})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.restore();
}
function drawRollTrail(g, sx, sy) {
  const ctx = g.ctx;
  const p = g.player;
  if (!p)
    return;
  const trail = getRollTrail();
  if (trail.length === 0)
    return;
  const spr = getSpr(p.sprite);
  for (const tp of trail) {
    const a = Math.max(0, tp.life / TRAIL_LIFE) * 0.35;
    if (a <= 0.02)
      continue;
    const fr = Math.min(entityFrame(spr, tp.dir, true, tp.anim), spr.length - 1);
    const dx = sx(tp.x) - spr[0].width * ZOOM / 2;
    const dy = sy(tp.y + 4) - spr[0].height * ZOOM;
    ctx.save();
    ctx.filter = WORLD_FILTER[g.epoch] ?? "none";
    ctx.globalAlpha = a;
    if (tp.dir === "left") {
      ctx.translate(dx + spr[0].width * ZOOM, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(spr[fr], 0, dy, spr[0].width * ZOOM, spr[0].height * ZOOM);
    } else {
      ctx.drawImage(spr[fr], dx, dy, spr[0].width * ZOOM, spr[0].height * ZOOM);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawProps(g, sx, sy) {
  const ctx = g.ctx;
  for (const pr of g.map.props) {
    if (pr.needPast && g.epoch !== "pasado")
      continue;
    if (pr.needPresent && g.epoch !== "presente")
      continue;
    const px3 = pr.x * TILE + 8, py = pr.y * TILE + 8;
    if (pr.kind === "sanctuary") {
      const fr = Math.floor(g.globalT * 2) % 2;
      const s = getSpr("sanctuary")[fr];
      ctx.drawImage(s, sx(px3 - 10), sy(py - 22), 20 * ZOOM, 30 * ZOOM);
      const auraR = g.map.dark ? 28 + Math.sin(g.globalT * 2) * 2 : 26;
      ctx.globalAlpha = 0.18 + Math.sin(g.globalT * 2) * 0.08;
      ctx.fillStyle = "#8ef0ff";
      ctx.beginPath();
      ctx.arc(sx(px3), sy(py - 6), auraR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (pr.kind === "forge") {
      ctx.fillStyle = "#4a4a58";
      ctx.fillRect(sx(px3 - 6), sy(py - 4), 12 * ZOOM, 6 * ZOOM);
      ctx.fillStyle = "#5a5a6a";
      ctx.fillRect(sx(px3 - 8), sy(py - 6), 6 * ZOOM, 4 * ZOOM);
      const fl = 0.6 + Math.sin(g.globalT * 7) * 0.3;
      ctx.fillStyle = `rgba(255,120,40,${fl})`;
      ctx.fillRect(sx(px3 - 3), sy(py - 9), 6 * ZOOM, 5 * ZOOM);
      ctx.fillStyle = `rgba(255,200,80,${fl})`;
      ctx.fillRect(sx(px3 - 2), sy(py - 8), 4 * ZOOM, 3 * ZOOM);
    } else if (pr.kind === "fragment") {
      const fr = Math.floor(g.globalT * 4) % 3;
      const bob = Math.sin(g.globalT * 2.4) * 3;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#ffe9a0";
      ctx.beginPath();
      ctx.arc(sx(px3), sy(py - 6 + bob), 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(getSpr("fragment")[fr], sx(px3 - 6), sy(py - 12 + bob), 12 * ZOOM, 12 * ZOOM);
    } else if (pr.kind === "altarEcho") {
      const ecoFlag = pr.id === "altar_mareas" ? "ecoMareas" : pr.id === "altar_cumbres" ? "ecoCumbres" : "ecoVoz";
      const bossFlag = pr.id === "altar_mareas" ? "sirenaDefeated" : pr.id === "altar_cumbres" ? "golemDefeated" : "guardianDefeated";
      const ecoColor = pr.id === "altar_mareas" ? "#8ef0ff" : pr.id === "altar_cumbres" ? "#a8d8ff" : "#ffe9a0";
      ctx.fillStyle = "#6a6a7a";
      ctx.fillRect(sx(px3 - 7), sy(py - 2), 14 * ZOOM, 8 * ZOOM);
      ctx.fillStyle = "#8a8a9a";
      ctx.fillRect(sx(px3 - 5), sy(py - 5), 10 * ZOOM, 4 * ZOOM);
      if (!g.flags[ecoFlag]) {
        const bob = Math.sin(g.globalT * 2.6) * 3;
        const gl = g.flags[bossFlag] ? 0.7 : 0.25;
        ctx.globalAlpha = gl;
        ctx.fillStyle = ecoColor;
        ctx.beginPath();
        ctx.arc(sx(px3), sy(py - 12 + bob), 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(getSpr("fragment")[Math.floor(g.globalT * 3) % 3], sx(px3 - 5), sy(py - 18 + bob), 10 * ZOOM, 10 * ZOOM);
      }
    } else if (pr.kind === "sign") {
      ctx.fillStyle = "#6d4520";
      ctx.fillRect(sx(px3 - 1), sy(py - 6), 2 * ZOOM, 12 * ZOOM);
      ctx.fillStyle = "#8a5a2b";
      ctx.fillRect(sx(px3 - 7), sy(py - 13), 14 * ZOOM, 8 * ZOOM);
      ctx.fillStyle = "#5c3a1e";
      ctx.fillRect(sx(px3 - 6), sy(py - 11), 12 * ZOOM, 1.5 * ZOOM);
      ctx.fillRect(sx(px3 - 6), sy(py - 9), 9 * ZOOM, 1.5 * ZOOM);
    } else if (pr.kind === "wreck" || pr.kind === "faro" || pr.kind === "lamp") {
      drawExpansionProp(ctx, pr.kind, sx(px3), sy(py), ZOOM, g.globalT, !!g.flags[pr.id]);
    }
  }
}
function drawEntity(g, e, sx, sy) {
  const ctx = g.ctx;
  const spr = getSpr(e.sprite);
  const zoomW = spr[0].width, zoomH = spr[0].height;
  let spriteAlpha = 1;
  if (e.kind === "player") {
    const pp = g.player;
    if (pp.iframes > 0 && pp.rollT <= 0)
      spriteAlpha = 0.55 + Math.abs(Math.sin(g.globalT * 24)) * 0.35;
  }
  if (e.kind === "enemy" && e.invulT !== undefined && e.invulT > 0) {
    spriteAlpha = 0.3 + Math.abs(Math.sin(g.globalT * 14)) * 0.18;
  }
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(sx(e.x), sy(e.y + 4), (e.w / 2 + 3) * ZOOM, 3 * ZOOM, 0, 0, Math.PI * 2);
  ctx.fill();
  const fi = entityFrame(spr, e.dir, e.moving, e.anim);
  const idx = Math.min(fi, spr.length - 1);
  let poseCv = null;
  if (e.kind === "player" && g.player && g.player.attackT > 0) {
    const pl = g.player;
    const dur = pl.chargedHit ? 0.4 : 0.26;
    const anticip = pl.attackT > dur * 0.5;
    const SP = exports_sprites;
    const frames = pl.discipline === "tejedor" && SP.getCastFrames ? SP.getCastFrames(pl.sprite, pl.dir) ?? (SP.getAttackFrames ? SP.getAttackFrames(pl.sprite, pl.dir) : null) : SP.getAttackFrames ? SP.getAttackFrames(pl.sprite, pl.dir) : null;
    if (frames && frames.length > 1)
      poseCv = frames[anticip ? 0 : 1] ?? null;
  }
  const flip = e.dir === "left";
  const dx = sx(e.x) - zoomW * ZOOM / 2;
  const dy = sy(e.y + 4) - zoomH * ZOOM;
  const frCv = poseCv ?? spr[idx];
  ctx.globalAlpha = spriteAlpha;
  if (flip) {
    ctx.save();
    ctx.translate(dx + zoomW * ZOOM, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(frCv, 0, dy, zoomW * ZOOM, zoomH * ZOOM);
    ctx.restore();
  } else {
    ctx.drawImage(frCv, dx, dy, zoomW * ZOOM, zoomH * ZOOM);
  }
  ctx.globalAlpha = 1;
  const en = e;
  if (en.hitFlash && en.hitFlash > 0) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#fff";
    ctx.fillRect(dx + 4, dy + 4, zoomW * ZOOM - 8, zoomH * ZOOM - 8);
    ctx.globalAlpha = 1;
  }
  if (en.kind === "enemy" && en.ai === "carga" && en.windup > 0) {
    textShadow(g, "!", sx(e.x), dy - 16, 14, "#ff5040", "#000", "center", true);
  }
  if (en.kind === "enemy" && en.ai === "aturdido") {
    const t = g.globalT * 6;
    text(g, "✦", sx(e.x) + Math.sin(t) * 6, dy - 14, 10, "#ffe86a", "center");
    if (en.maxSta > 0)
      text(g, "QUEBRADO", sx(e.x), dy - 30, 8, "#ffe86a", "center");
  }
  if (en.kind === "enemy" && en.hp < en.maxHp && !en.dead && en.etype !== "guardian") {
    bar(g, sx(e.x) - 12, dy - 6, 24, 3, en.hp / en.maxHp, COL.hp, COL.hpBg);
  }
  if (en.kind === "enemy" && !en.dead) {
    drawStatusIcons(g, en, sx(e.x), dy - 12);
  }
  if (e.kind === "player") {
    const p = g.player;
    if (p.hasEcho && g.map.epochDiffs.length > 0) {
      ctx.globalAlpha = 0.14 + Math.sin(g.globalT * 3) * 0.06;
      ctx.fillStyle = g.epoch === "pasado" ? "#ffd88a" : "#8ab8d8";
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y - 5), 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (p.parryFx > 0) {
      ctx.globalAlpha = Math.min(1, p.parryFx * 3);
      ctx.strokeStyle = "#fff8c0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y - 6), 14 + (0.32 - p.parryFx) * 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (p.charging && p.chargeT > 0.35) {
      const k = Math.min(1, p.chargeT / 0.8);
      ctx.globalAlpha = 0.5 + k * 0.4;
      ctx.strokeStyle = "#ffe86a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y - 4), 12 + k * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      text(g, "▲", sx(p.x), dy - 18, 10, "#ffe86a", "center");
    }
    if (p.attackT > 0) {
      const dur = p.chargedHit ? 0.4 : 0.26;
      const prog = Math.max(0, Math.min(1, 1 - p.attackT / dur));
      drawSlashArc(ctx, sx(p.x), sy(p.y - 4), p.dir, prog, p.combo, !!p.chargedHit, ZOOM);
    }
    if ((p.buffT ?? 0) > 0) {
      text(g, "⚔", sx(p.x) + 10, sy(p.y) - 26, 10, "#f0a050", "center");
    }
  }
  if (e.kind === "npc") {
    text(g, e.dispName, sx(e.x), dy - 10, 10, "#c8e8f8", "center");
  }
  if (e.kind === "companion") {
    text(g, "Ilwen", sx(e.x), dy - 10, 9, "#a8e8b0", "center");
    bar(g, sx(e.x) - 10, dy - 4, 20, 2, e.hp / e.maxHp, COL.sta, COL.staBg);
  }
}
function drawStatusIcons(g, en, cx, y) {
  const ctx = g.ctx;
  const list = en.statuses.filter((s) => s.t > 0).slice(-3);
  const marked = (en.marked ?? 0) > 0;
  const total = list.length + (marked ? 1 : 0);
  if (total === 0)
    return;
  let ix = cx - total * 9 / 2 + 1;
  for (const s of list) {
    drawStatusIcon(g, s.kind, ix, y, s.t / (s.kind === "quemado" ? 3 : 2.5));
    ix += 10;
  }
  if (marked) {
    drawMarkIcon(g, ix, y, Math.min(1, (en.marked ?? 0) / 5));
  }
}
function drawStatusIcon(g, kind, x, y, fill) {
  const ctx = g.ctx;
  const flick = Math.sin(g.globalT * 14 + x) * 0.5 + 0.5;
  if (kind === "quemado") {
    ctx.fillStyle = "#ff7830";
    ctx.fillRect(x + 1, y + 2 + (1 - flick) * 1.5, 4, 3);
    ctx.fillStyle = "#ffd24a";
    ctx.fillRect(x + 2, y + (1 - flick) * 2, 2, 3);
    ctx.fillStyle = "#fff3c0";
    ctx.fillRect(x + 2, y + 1 + (1 - flick) * 2, 1, 1);
  } else if (kind === "congelado") {
    ctx.fillStyle = "#a0e8ff";
    ctx.fillRect(x + 2, y - 1, 2, 2);
    ctx.fillRect(x + 1, y + 1, 4, 2);
    ctx.fillRect(x + 2, y + 3, 2, 2);
    ctx.fillStyle = "#f0fbff";
    ctx.fillRect(x + 2, y + 1, 1, 1);
  }
  ctx.fillStyle = "rgba(8,8,16,0.75)";
  ctx.fillRect(x - 1, y + 6, 8, 2);
  ctx.fillStyle = kind === "quemado" ? "#ff9040" : "#a0e8ff";
  ctx.fillRect(x - 1, y + 6, 8 * Math.max(0, Math.min(1, fill)), 2);
}
function drawMarkIcon(g, x, y, fill) {
  const ctx = g.ctx;
  const pulse = Math.sin(g.globalT * 6) * 0.5 + 0.5;
  ctx.strokeStyle = `rgba(224,138,208,${0.6 + pulse * 0.4})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + 3, y + 2, 2.5 + pulse * 1.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#e08ad0";
  ctx.fillRect(x + 2, y + 1, 2, 2);
  ctx.fillStyle = "rgba(8,8,16,0.75)";
  ctx.fillRect(x - 1, y + 6, 8, 2);
  ctx.fillStyle = "#e08ad0";
  ctx.fillRect(x - 1, y + 6, 8 * fill, 2);
}
function drawCombatFx(g, sx, sy) {
  const ctx = g.ctx;
  for (const t of g.telegraphs) {
    const a = 0.35 + Math.sin(g.globalT * 12) * 0.15;
    ctx.strokeStyle = `rgba(255,80,64,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(t.x), sy(t.y), t.r * ZOOM, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,80,64,${0.12 * (1 - t.t / t.maxT) + 0.08})`;
    ctx.beginPath();
    ctx.arc(sx(t.x), sy(t.y), t.r * ZOOM * (1 - t.t / t.maxT), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const w of g.waves) {
    ctx.strokeStyle = `rgba(180,143,255,${1 - w.r / w.maxR})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx(w.x), sy(w.y), w.r * ZOOM, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const pr of g.projectiles) {
    const x = sx(pr.x), y = sy(pr.y);
    if (pr.sprite === "p_fire") {
      ctx.fillStyle = "#ff7830";
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = "#ffd24a";
      ctx.fillRect(x - 1, y - 1, 4, 4);
    } else if (pr.sprite === "p_ice") {
      ctx.fillStyle = "#a0e8ff";
      ctx.fillRect(x - 3, y - 1, 6, 2);
      ctx.fillRect(x - 1, y - 3, 2, 6);
      ctx.fillStyle = "#f0fbff";
      ctx.fillRect(x - 1, y - 1, 2, 2);
    } else if (pr.sprite === "p_arrow") {
      const ang = Math.atan2(pr.vy, pr.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = "#d8c8a0";
      ctx.fillRect(-5, -1, 10, 2);
      ctx.fillStyle = "#e8e4d8";
      ctx.fillRect(3, -2, 3, 4);
      ctx.restore();
    } else if (pr.sprite === "orb" || pr.sprite === "shard" || pr.sprite === "nota") {
      drawExpansionProjectile(ctx, pr.sprite, x, y, pr.radius, ZOOM, g.globalT);
    } else {
      ctx.fillStyle = "#e8d0ff";
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }
}
function drawBiomeTint(g) {
  const ctx = g.ctx;
  const t = g.globalT;
  switch (g.mapId) {
    case "costa": {
      const dayLight = Math.max(0.1, Math.sin(g.dayT * Math.PI * 2) * 1.25 + 0.25);
      const night = 1 - Math.min(1, dayLight);
      ctx.fillStyle = `rgba(240,224,176,${0.07 * (1 - night)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      if (night > 0.25) {
        ctx.fillStyle = `rgba(24,48,92,${Math.min(0.14, (night - 0.25) * 0.2)})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      drawSeaMist(g);
      break;
    }
    case "aldea": {
      if (g.epoch === "pasado") {
        ctx.fillStyle = "rgba(255,233,192,0.08)";
      } else {
        ctx.fillStyle = "rgba(138,138,160,0.10)";
      }
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      if (g.epoch !== "pasado") {
        const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.8);
        vg.addColorStop(0, "rgba(6,6,16,0)");
        vg.addColorStop(1, "rgba(6,6,16,0.30)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      break;
    }
    case "cumbres": {
      ctx.fillStyle = "rgba(184,216,240,0.10)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.save();
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.rotate(-0.32);
      for (let i = 0;i < 4; i++) {
        const speed = 110 + i * 40;
        const gx = (t * speed + i * 617) % 1500 - 700;
        const gy = -VIEW_H / 2 + 36 + i * 118;
        const a = 0.05 + 0.04 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7));
        ctx.fillStyle = `rgba(240,248,255,${a})`;
        ctx.fillRect(gx, gy, 140 + i * 40, 1.5);
      }
      ctx.restore();
      break;
    }
  }
}
function drawSeaMist(g) {
  const ctx = g.ctx;
  const y0 = g.map.h * TILE * 0.82 * ZOOM - g.camY;
  if (y0 > VIEW_H + 40 || y0 < -80)
    return;
  const t = g.globalT;
  const a = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.5));
  const top = y0 - 30 + Math.sin(t * 0.5) * 8;
  const grad = ctx.createLinearGradient(0, top, 0, top + 260);
  grad.addColorStop(0, "rgba(222,236,250,0)");
  grad.addColorStop(0.35, `rgba(222,236,250,${a})`);
  grad.addColorStop(1, "rgba(178,204,236,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, VIEW_W, 260);
}
function drawWaterGlints(g, sx, sy) {
  if (g.mapId !== "costa" && g.mapId !== "aldea")
    return;
  const ctx = g.ctx;
  const t = g.globalT;
  const tx0 = Math.floor(g.camX / (TILE * ZOOM));
  const ty0 = Math.floor(g.camY / (TILE * ZOOM));
  const tx1 = Math.ceil((g.camX + VIEW_W) / (TILE * ZOOM));
  const ty1 = Math.ceil((g.camY + VIEW_H) / (TILE * ZOOM));
  ctx.fillStyle = "#fff";
  for (let ty = ty0;ty <= ty1; ty++) {
    for (let tx = tx0;tx <= tx1; tx++) {
      if (tileAt(g.map, g.rows, tx, ty, g.epoch) !== "~")
        continue;
      const ph = hash2(tx, ty) * 6.283;
      const w1 = Math.sin(t * 1.6 + ph);
      const a = 0.1 + 0.15 * (0.5 + 0.5 * w1);
      const px3 = tx * TILE + 3 + hash2(tx * 3 + 1, ty) * 9 + w1 * 2.5;
      const py = ty * TILE + 3 + hash2(tx, ty * 3 + 2) * 9 + Math.cos(t * 1.2 + ph) * 1.5;
      ctx.globalAlpha = a;
      ctx.fillRect(Math.round(sx(px3)), Math.round(sy(py)), 2, 1);
      if (hash2(tx * 5 + 2, ty * 7 + 3) > 0.55) {
        ctx.globalAlpha = a * 0.7;
        ctx.fillRect(Math.round(sx(px3 + 6 - w1 * 1.5)), Math.round(sy(py + 4)), 2, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
var lightCv = null;
var lightCtx = null;
function getLightCanvas() {
  if (!lightCv || lightCv.width !== VIEW_W || lightCv.height !== VIEW_H) {
    lightCv = document.createElement("canvas");
    lightCv.width = VIEW_W;
    lightCv.height = VIEW_H;
    lightCtx = lightCv.getContext("2d");
  }
  return { canvas: lightCv, ctx: lightCtx };
}
function drawLighting(g) {
  const ctx = g.ctx;
  const p = g.player;
  if (!p)
    return;
  const dayLight = Math.max(0.1, Math.sin(g.dayT * Math.PI * 2) * 1.25 + 0.25);
  let darkness = (1 - Math.min(1, dayLight)) * 0.62;
  if (g.map.dark) {
    darkness = 0.8 + 0.02 * Math.sin(g.globalT * 7) + 0.015 * Math.sin(g.globalT * 13);
  }
  if (darkness > 0.02) {
    const lc = getLightCanvas();
    const lx = lc.ctx;
    lx.globalCompositeOperation = "source-over";
    lx.clearRect(0, 0, VIEW_W, VIEW_H);
    lx.globalAlpha = Math.min(1, darkness);
    lx.fillStyle = g.map.dark ? "#060810" : "#0a1030";
    lx.fillRect(0, 0, VIEW_W, VIEW_H);
    lx.globalAlpha = 1;
    lx.globalCompositeOperation = "destination-out";
    const px3 = p.x * ZOOM - g.camX, py = (p.y - 6) * ZOOM - g.camY;
    const grad = lx.createRadialGradient(px3, py, 10, px3, py, g.map.dark ? 130 : 170);
    grad.addColorStop(0, "rgba(0,0,0,0.95)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    lx.fillStyle = grad;
    lx.fillRect(px3 - 200, py - 200, 400, 400);
    for (const pr of g.map.props) {
      if (pr.kind !== "sanctuary")
        continue;
      const sxp = pr.x * TILE * ZOOM + 8 - g.camX, syp = pr.y * TILE * ZOOM - g.camY;
      if (sxp < -100 || syp < -100 || sxp > VIEW_W + 100 || syp > VIEW_H + 100)
        continue;
      const rad = 80 + Math.sin(g.globalT * 2 + pr.x) * 5;
      const grad2 = lx.createRadialGradient(sxp, syp, 4, sxp, syp, rad);
      grad2.addColorStop(0, "rgba(0,0,0,0.7)");
      grad2.addColorStop(1, "rgba(0,0,0,0)");
      lx.fillStyle = grad2;
      lx.fillRect(sxp - 95, syp - 95, 190, 190);
    }
    lx.globalCompositeOperation = "source-over";
    ctx.drawImage(lc.canvas, 0, 0);
    if (g.map.dark) {
      ctx.fillStyle = "rgba(30,20,60,0.18)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else if (darkness > 0.25) {
      ctx.fillStyle = `rgba(16,22,52,${darkness * 0.22})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
  if (!g.map.dark) {
    const warm = Math.exp(-Math.pow(g.dayT - 0.52, 2) / (2 * 0.075 * 0.075));
    if (warm > 0.05) {
      ctx.fillStyle = `rgba(255,148,74,${warm * 0.13})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
  if (g.epoch === "presente" && g.map.epochDiffs.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#9ec4b4";
    for (let i = 0;i < 4; i++) {
      const fx = (g.globalT * 12 + i * 260) % (VIEW_W + 300) - 150;
      const fy = 80 + i * 110 + Math.sin(g.globalT * 0.8 + i) * 18;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 130, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  const pl = g.player;
  if (pl.lastHitT > 0) {
    ctx.fillStyle = `rgba(200,40,40,${pl.lastHitT * 0.7})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const hpPct = pl.hp / pl.maxHp;
  if (g.state === "play" && hpPct < 0.3 && pl.hp > 0) {
    const a = 0.18 + 0.06 * Math.sin(g.globalT * 5);
    const rg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78);
    rg.addColorStop(0, "rgba(180,40,40,0)");
    rg.addColorStop(1, `rgba(180,40,40,${a})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
var FLOAT_SPECIAL = new Set(["QUEBRADO", "¡PARADA!", "¡REMATE!", "¡CRÍTICO!"]);
function drawFloats(g, sx, sy) {
  const ctx = g.ctx;
  for (const f of g.floats) {
    const alpha = Math.min(1, f.t * 2.2);
    if (alpha <= 0)
      continue;
    const pop = f.t > 0.74 ? 1.38 : 1;
    const special = FLOAT_SPECIAL.has(f.text);
    let size = f.size * 1.6 * pop;
    let color = f.color;
    if (special) {
      color = "#ffe86a";
      size *= 1.3;
    } else if (f.color === "#ffd24a")
      size *= 1.15;
    else if (f.color === "#ff7060")
      size *= 1.08;
    const x = sx(f.x), y = sy(f.y);
    ctx.globalAlpha = alpha;
    ctx.font = fBody(size);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(14,10,20,0.9)";
    ctx.fillText(f.text, x + 1, y);
    ctx.fillText(f.text, x - 1, y);
    ctx.fillText(f.text, x, y + 1);
    ctx.fillText(f.text, x, y - 1);
    ctx.fillText(f.text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(f.text, x, y);
    if (special) {
      ctx.fillStyle = "rgba(255,232,106,0.8)";
      ctx.fillRect(x - size * f.text.length * 0.22, y + size * 1.05, size * f.text.length * 0.44, 1.5);
    }
  }
  ctx.globalAlpha = 1;
}
function drawInteractPrompt(g, sx, sy) {
  if (g.state !== "play")
    return;
  const it = g.nearestInteract();
  if (!it)
    return;
  const p = g.player;
  const x = sx(p.x), y = sy(p.y - 26);
  const ctx = g.ctx;
  ctx.fillStyle = "rgba(10,12,20,0.85)";
  ctx.fillRect(x - 8, y - 9, 16, 13);
  ctx.strokeStyle = COL.gold;
  ctx.strokeRect(x - 8, y - 9, 16, 13);
  text(g, "E", x, y - 8, 10, COL.gold, "center", true);
  text(g, it.label, x, y - 24, 13, "#e8e4d8", "center");
}
function drawHud(g) {
  const ctx = g.ctx;
  const p = g.player;
  if (!p)
    return;
  panel(g, 8, 8, 224, 74);
  const blinkHud = g.globalT % 3.9 < 0.13;
  const hudBob = Math.round(Math.sin(g.globalT * 2.1)) * 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(14, 14, 44, 44);
  ctx.clip();
  ctx.fillStyle = "#141020";
  ctx.fillRect(14, 14, 44, 44);
  drawPortrait(ctx, p.discipline === "alba" ? "hero_alba" : "hero_tejedor", 14 + (44 - 28 * 1.06) / 2, 14 + (44 - 40 * 1.06) / 2 + hudBob, 1.06, blinkHud);
  ctx.restore();
  ctx.strokeStyle = "#5a4a30";
  ctx.strokeRect(14, 14, 44, 44);
  const bx = 66, bw = 158;
  text(g, `${p.name} · Nv ${p.level}`, bx, 12, 14, COL.goldSoft);
  bar(g, bx, 30, bw, 10, p.hp / p.maxHp, COL.hp, COL.hpBg);
  text(g, `${Math.ceil(p.hp)}/${p.maxHp}`, bx + bw / 2, 30, 13, "#fff", "center");
  bar(g, bx, 44, bw, 7, p.sta / p.maxSta, COL.sta, COL.staBg);
  bar(g, bx, 55, bw, 7, p.res / p.maxRes, COL.res, COL.resBg);
  text(g, "RES", bx + 2, 55, 12, "#0a2a30");
  bar(g, 14, 64, 210, 5, p.xp / g.xpNext(p.level), COL.xp, "#241a30");
  text(g, `XP`, 224, 62, 12, COL.dim, "right");
  text(g, `${p.gold}`, 242, 10, 15, COL.gold);
  text(g, "coronas", 242, 26, 12, COL.dim);
  text(g, `${p.potions}× poción (F)`, 242, 42, 13, p.potions > 0 ? "#f0a0b8" : COL.dim);
  if (p.weaponPlus > 0)
    text(g, `arma +${p.weaponPlus}`, 242, 58, 13, "#d8e0f0");
  if (g.miniCanvas) {
    const mw = 140;
    const mh = Math.round(g.map.h / g.map.w * mw);
    const mx = VIEW_W - mw - 10, my = 10;
    panel(g, mx - 3, my - 3, mw + 6, mh + 6);
    ctx.drawImage(g.miniCanvas, mx, my, mw, mh);
    for (const n of g.npcs) {
      ctx.fillStyle = "#8ecae8";
      ctx.fillRect(mx + n.x / (g.map.w * TILE) * mw - 1, my + n.y / (g.map.h * TILE) * mh - 1, 3, 3);
    }
    for (const e of g.enemies) {
      if (e.dead || e.etype === "guardian")
        continue;
      if (!e.aggro)
        continue;
      ctx.fillStyle = "#ff7060";
      ctx.fillRect(mx + e.x / (g.map.w * TILE) * mw - 1, my + e.y / (g.map.h * TILE) * mh - 1, 3, 3);
    }
    for (const pr of g.map.props) {
      if (pr.kind !== "sanctuary")
        continue;
      const px22 = mx + pr.x / g.map.w * mw;
      const py2 = my + pr.y / g.map.h * mh;
      const pingT = g.globalT % 1.4 / 1.4;
      ctx.globalAlpha = 0.8 * (1 - pingT);
      ctx.strokeStyle = "#8ef0ff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px22, py2, 2 + pingT * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#8ef0ff";
      ctx.fillRect(px22 - 2, py2 - 2, 4, 4);
    }
    const px3 = mx + p.x / (g.map.w * TILE) * mw;
    const py = my + p.y / (g.map.h * TILE) * mh;
    ctx.fillStyle = "#fff";
    ctx.fillRect(px3 - 2, py - 2, 4, 4);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.strokeRect(px3 - 4, py - 4, 8, 8);
    const night = g.dayT > 0.7 || g.dayT < 0.08;
    text(g, night ? "☾" : "☀", mx + mw - 12, my + mh + 8, 14, night ? "#a8b8e8" : "#ffe86a");
    text(g, g.map.name, mx, my + mh + 8, 13, COL.dim);
  }
  const skills = SKILLS[p.discipline];
  const sw = 52, sh = 46, gap = 8;
  const total = skills.length * sw + (skills.length - 1) * gap;
  const sx0 = (VIEW_W - total) / 2, sy0 = VIEW_H - sh - 12;
  for (let i = 0;i < skills.length; i++) {
    const sk = skills[i];
    const x = sx0 + i * (sw + gap);
    const y = sy0;
    panel(g, x, y, sw, sh, p.cds[i] > 0 ? "#3a3448" : COL.panelBorder);
    text(g, sk.icon, x + sw / 2, y + 5, 16, p.res >= sk.cost ? COL.goldSoft : "#666", "center");
    text(g, sk.name.split(" ")[0], x + sw / 2, y + 25, 11, p.res >= sk.cost ? COL.text : COL.dim, "center");
    if (p.cds[i] > 0) {
      ctx.fillStyle = "rgba(10,10,20,0.7)";
      ctx.fillRect(x, y, sw, sh * Math.min(1, p.cds[i] / sk.cd));
      text(g, `${p.cds[i].toFixed(1)}`, x + sw / 2, y + 14, 12, "#fff", "center");
    } else if (p.res < sk.cost) {
      text(g, `${sk.cost}`, x + sw / 2, y + 12, 12, COL.danger, "center");
    }
    text(g, `${i + 1}`, x + 3, y + 2, 10, COL.gold, "left", true);
  }
  const q = g.challengeRun ? null : QUESTS[g.questIdx];
  if (q) {
    const lines = wrapText(g.questProgressText() ?? q.steps[g.questStep], 30);
    const qw = 216;
    const qh = 34 + lines.length * 14;
    panel(g, VIEW_W - qw - 10, VIEW_H - qh - 10, qw, qh);
    text(g, "◆ " + q.name, VIEW_W - qw, VIEW_H - qh + 2, 13, COL.quest);
    lines.forEach((l, i) => text(g, l, VIEW_W - qw, VIEW_H - qh + 20 + i * 14, 14, COL.text));
  }
  if (g.bossActive && g.bossRef && !g.bossRef.dead) {
    const boss = g.bossRef;
    const bw2 = 420, bx2 = (VIEW_W - bw2) / 2, by2 = 16;
    const maxPhase = boss.etype === "golem" ? 2 : 3;
    textShadow(g, ENEMY_DEFS[boss.etype].name, VIEW_W / 2, by2 - 14, 12, COL.boss, "#000", "center", true);
    bar(g, bx2, by2, bw2, 12, boss.hp / boss.maxHp, "#8a4ad0", COL.bossBg);
    if (boss.maxSta > 0) {
      bar(g, bx2, by2 + 14, bw2, 5, boss.sta / boss.maxSta, "#7ee8ff", "#12303a");
      text(g, "QUIEBRE", bx2 + bw2 + 6, by2 + 9, 11, "#7ee8ff");
    }
    text(g, `FASE ${boss.phase}/${maxPhase}`, bx2 - 6, by2 + 2, 12, COL.boss, "right");
  }
  let ty = VIEW_H - 96;
  for (let i = g.toasts.length - 1;i >= 0; i--) {
    const t = g.toasts[i];
    const enter = Math.max(0, Math.min(1, (3.4 - t.t) / 0.28));
    const ease = 1 - Math.pow(1 - enter, 3);
    const offX = (1 - ease) * 300;
    ctx.globalAlpha = Math.min(1, t.t * 2) * (0.35 + 0.65 * ease);
    const lines = wrapText(t.text, 52);
    const th = lines.length * 15 + 10;
    const tw = Math.min(430, Math.max(...lines.map((l) => l.length)) * 6.4 + 20);
    const tx = 12 + offX;
    panel(g, tx, ty - th + 14, tw, th, "rgba(90,74,48,0.6)");
    lines.forEach((l, j) => text(g, l, tx + 10, ty - th + 20 + j * 15, 14, t.color ?? COL.text));
    ctx.globalAlpha = 1;
    ty -= th + 6;
  }
  if (g.state === "play") {
    let hint = null;
    if (p.hasEcho && !g.flags.usedEpoch && g.map.epochDiffs.length > 0)
      hint = "Pulsa Q para alternar entre el presente y el pasado";
    else if (g.questIdx === 0 && !g.flags.hintMove)
      hint = "WASD para moverte · clic izq: atacar · Espacio: esquivar · clic der: parar · E: interactuar";
    if (hint) {
      const lines = wrapText(hint, 60);
      ctx.fillStyle = "rgba(8,10,18,0.7)";
      ctx.fillRect(0, VIEW_H - 24 - lines.length * 14, VIEW_W, lines.length * 14 + 10);
      lines.forEach((l, i) => text(g, l, VIEW_W / 2, VIEW_H - 20 - (lines.length - 1 - i) * 14, 14, "#c8d0e0", "center"));
    }
  }
}
function drawOverlays(g) {
  const ctx = g.ctx;
  const p = g.player;
  if (g.flashT > 0) {
    const a = Math.min(0.85, g.flashT / 0.18 * 0.75);
    const isWhite = g.flashColor.toLowerCase() === "#ffffff";
    ctx.save();
    if (isWhite) {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a;
      ctx.fillStyle = g.flashColor;
    }
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
  if (g.memoryReveal)
    drawMemoryOverlay(g);
  if (g.bossBannerT > 0)
    drawBossBanner(g);
}
function drawMemoryOverlay(g) {
  const ctx = g.ctx;
  const mem2 = g.memoryReveal;
  const a = memoryAlpha(g);
  if (a <= 0.01)
    return;
  const lines = wrapText(mem2.text, 44);
  const w = 580;
  const h = 96 + lines.length * 18 + 34;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  const pulse = 0.5 + 0.5 * Math.sin(g.globalT * 2.2);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 40, VIEW_W / 2, VIEW_H / 2, 340);
  glow.addColorStop(0, `rgba(240,200,120,${0.1 + pulse * 0.05})`);
  glow.addColorStop(1, "rgba(240,200,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(14,12,32,0.94)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(30,24,56,0.5)";
  ctx.fillRect(x, y, w, 10);
  ctx.fillRect(x, y + h - 10, w, 10);
  const wave = (x0, y0, x1, y1, color, lw, amp, freq, ph) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    const steps = 24;
    for (let i = 0;i <= steps; i++) {
      const tt = i / steps;
      const wx = x0 + (x1 - x0) * tt;
      const wy = y0 + (y1 - y0) * tt + Math.sin(tt * freq + ph) * amp;
      if (i === 0)
        ctx.moveTo(wx, wy);
      else
        ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  };
  const g1 = `rgba(255,233,160,${0.75 + pulse * 0.2})`;
  wave(x + 3, y + 5, x + w - 3, y + 5, g1, 2, 2.2, 9, 0);
  wave(x + 3, y + h - 5, x + w - 3, y + h - 5, g1, 2, 2.2, 9, 2);
  wave(x + 5, y + 3, x + 5, y + h - 3, "rgba(200,180,255,0.5)", 1.5, 2, 8, 1);
  wave(x + w - 5, y + 3, x + w - 5, y + h - 3, "rgba(200,180,255,0.5)", 1.5, 2, 8, 3);
  ctx.fillStyle = COL.gold;
  for (const [cxx, cyy] of [[x + 6, y + 8], [x + w - 6, y + 8], [x + 6, y + h - 8], [x + w - 6, y + h - 8]]) {
    ctx.fillRect(cxx - 2, cyy - 2, 4, 4);
  }
  ctx.strokeStyle = `rgba(142,240,255,${0.5 + pulse * 0.3})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0;i <= 40; i++) {
    const wx = VIEW_W / 2 - 60 + i * 3;
    const wy = y + 26 + Math.sin(i * 0.5 + g.globalT * 2.4) * 3;
    if (i === 0)
      ctx.moveTo(wx, wy);
    else
      ctx.lineTo(wx, wy);
  }
  ctx.stroke();
  textShadow(g, mem2.title, VIEW_W / 2, y + 36, 15, COL.goldSoft, "#000", "center", true);
  lines.forEach((l, i) => text(g, l, VIEW_W / 2, y + 62 + i * 18, 16, COL.text, "center"));
  ctx.fillStyle = `rgba(255,233,160,${0.4 + pulse * 0.3})`;
  for (let i = 0;i < 5; i++) {
    const wob = Math.sin(g.globalT * 3 + i) * 2;
    ctx.fillRect(VIEW_W / 2 - 24 + i * 12, y + h - 24 + wob, 3, 3);
  }
  ctx.restore();
}
function drawBossBanner(g) {
  const ctx = g.ctx;
  const { slide, out, elapsed } = bannerInfo(g);
  if (out <= 0.01)
    return;
  const ease = 1 - Math.pow(1 - slide, 3);
  const offsetY = -100 + ease * 104;
  const tremble = Math.sin(elapsed * 42) * 1.1 * (1 - slide);
  const bandH = 82;
  ctx.save();
  ctx.globalAlpha = out;
  const grad = ctx.createLinearGradient(0, offsetY, 0, offsetY + bandH);
  grad.addColorStop(0, "rgba(10,6,20,0.95)");
  grad.addColorStop(1, "rgba(26,12,40,0.88)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, offsetY, VIEW_W, bandH);
  ctx.fillStyle = "rgba(176,143,255,0.85)";
  ctx.fillRect(0, offsetY + bandH - 3, VIEW_W, 2);
  ctx.fillStyle = "rgba(255,233,160,0.5)";
  ctx.fillRect(0, offsetY + bandH, VIEW_W, 1);
  ctx.fillStyle = "rgba(176,143,255,0.4)";
  ctx.fillRect(0, offsetY + 2, VIEW_W, 1);
  const diamond = (dx, dy, s, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(dx, dy - s);
    ctx.lineTo(dx + s, dy);
    ctx.lineTo(dx, dy + s);
    ctx.lineTo(dx - s, dy);
    ctx.closePath();
    ctx.fill();
  };
  const midY = offsetY + bandH / 2 + 4;
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5);
  diamond(90, midY, 5 + pulse * 1.5, `rgba(176,143,255,${0.6 + pulse * 0.4})`);
  diamond(VIEW_W - 90, midY, 5 + pulse * 1.5, `rgba(176,143,255,${0.6 + pulse * 0.4})`);
  ctx.strokeStyle = "rgba(176,143,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(110, midY);
  ctx.lineTo(240, midY);
  ctx.moveTo(VIEW_W - 110, midY);
  ctx.lineTo(VIEW_W - 240, midY);
  ctx.stroke();
  textShadow(g, g.bossBannerText, VIEW_W / 2 + tremble, offsetY + 16, 21, COL.boss, "#000", "center", true);
  text(g, g.bossBannerSub, VIEW_W / 2 - tremble, offsetY + 52, 14, "rgba(200,190,230,0.9)", "center");
  ctx.restore();
}

// src/game/timeskip.ts
var VETO_TILES = 5;
var DUAL_TILES = 6;
var DUAL_CD = 30;
var RESIDUE_SLOTS = 10;
var RECALL_MAX = 6;
var VETO_PHRASES = [
  "Un enemigo te acecha: el tiempo no se teje bajo colmillos.",
  "El Eco calla: primero silencia lo que te muerde.",
  "La hora no cambia con aliento hostil en la nuca."
];
var HUELLAS = [
  {
    key: "puente",
    map: "bosque",
    ax0: 24,
    ay0: 9,
    ax1: 27,
    ay1: 13,
    acquire: "pasado",
    frase: "Ayer cruzaste el puente; hoy el río se lo disputa tablón a tablón.",
    fx: 26,
    fy: 12
  },
  {
    key: "cobertizo",
    map: "lunaris",
    ax0: 4,
    ay0: 24,
    ax1: 7,
    ay1: 27,
    acquire: "pasado",
    frase: "Donde ayer te estorbaba un cobertizo, hoy solo queda ruina y zarza.",
    fx: 6,
    fy: 26
  },
  {
    key: "lapidas",
    map: "lunaris",
    ax0: 16,
    ay0: 19,
    ax1: 19,
    ay1: 21,
    acquire: "pasado",
    frase: "Pisaste flores en el ayer: hoy son dos lápidas que nadie nombra.",
    fx: 18,
    fy: 20
  },
  {
    key: "flores",
    map: "lunaris",
    ax0: 16,
    ay0: 19,
    ax1: 19,
    ay1: 21,
    acquire: "presente",
    frase: "Las lápidas del presente, en el ayer eran flores: el suelo aún no sabe doler.",
    fx: 18,
    fy: 20
  },
  {
    key: "muelle_costa",
    map: "costa",
    ax0: 27,
    ay0: 35,
    ax1: 30,
    ay1: 39,
    acquire: "pasado",
    frase: "El muelle que pisaste en el ayer no existe ya: el mar se lo quedó al despertar.",
    fx: 29,
    fy: 37
  },
  {
    key: "muelle_aldea",
    map: "aldea",
    ax0: 37,
    ay0: 27,
    ax1: 40,
    ay1: 30,
    acquire: "pasado",
    frase: "Pisaste el muelle del festival: el presente ya no sabe sostener la madera.",
    fx: 39,
    fy: 29
  }
];
var LAMP_HUELLAS = [
  { flag: "lamp1", frase: "Un farol arde en el ayer: alguna ventana de Merrow no está sola.", fx: 13, fy: 13 },
  { flag: "lamp2", frase: "La segunda luz cruzó el tiempo: la niebla aprende a temer.", fx: 28, fy: 14 },
  { flag: "lamp3", frase: "El tercer farol brilla donde el presente solo ve sombra.", fx: 20, fy: 22 }
];
var ECO_FRASE = "Un eco que arrancaste tiembla aún entre estas horas del mundo.";
var DUALS = {
  brisa: ["Brisa: «...aún canto, pequeño...»", "Brisa: «...duerme, que el valle canta...»"],
  mara: ["Mara: «...la lámpara gira, la luz ya no...»", "Mara: «...una nota por vuelta, abuela...»"],
  mera: ["Mera: «...dime un nombre y descanso...»", "Mera: «...en el ayer aún lo sabía...»"]
};
var NOTE_CFG = Array.from({ length: 12 }, (_, i) => ({
  a: -Math.PI / 2 + (i % 6 - 2.5) * 0.3,
  d: 8 + i % 3 * 6,
  s: 34 + i % 4 * 16,
  sz: 1.1 + i % 3 * 0.45,
  stem: i % 2 === 0,
  life: 0.8 + i % 5 * 0.12
}));
var prevEpoch = null;
var lastPlayer = null;
var clock = 0;
var vetoIdx = 0;
var acquireAcc = 0;
var rotIdx = 0;
var recalls = [];
var pendingAcq = new Map;
var duets = [];
var duetCd = new WeakMap;
var residue = Array.from({ length: RESIDUE_SLOTS }, (_, i) => ({ next: 0.4 + i * 0.22 }));
var spotCache = new Map;
function beginEpochShift(g) {
  const p = g.player;
  if (!p)
    return true;
  for (const e of g.enemies) {
    if (e.dead || !e.aggro)
      continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) < VETO_TILES * TILE) {
      vetoIdx = (vetoIdx + 1) % VETO_PHRASES.length;
      addShake(g, 4);
      g.toast(VETO_PHRASES[vetoIdx], "#c8b0e8");
      audio.sfx("error");
      return false;
    }
  }
  const toPast = g.epoch === "presente";
  g.waves.push({ x: p.x, y: p.y, r: 6, maxR: 72, speed: 210, dmg: 0, hit: true });
  g.waves.push({ x: p.x, y: p.y, r: 3, maxR: 100, speed: 290, dmg: 0, hit: true });
  addFlash(g, toPast ? "#ffd88a" : "#a8b8d8", 0.12);
  addShake(g, 2);
  audio.sfx(toPast ? "save" : "quest");
  const c1 = toPast ? "#ffd88a" : "#a8c8e8";
  const c2 = toPast ? "#f0c060" : "#cfe0ff";
  for (let i = 0;i < NOTE_CFG.length; i++) {
    const n = NOTE_CFG[i];
    const nx = p.x + Math.cos(n.a) * n.d;
    const ny = p.y - 8 + Math.sin(n.a) * n.d * 0.55;
    g.particles.push({
      x: nx,
      y: ny,
      vx: Math.cos(n.a) * n.s,
      vy: Math.sin(n.a) * n.s - 26,
      t: n.life,
      maxT: n.life,
      color: i % 2 ? c1 : c2,
      size: n.sz,
      grav: -14
    });
    if (n.stem) {
      g.particles.push({
        x: nx + n.sz * 1.6,
        y: ny - n.sz * 2.4,
        vx: Math.cos(n.a) * n.s * 0.9,
        vy: Math.sin(n.a) * n.s - 22,
        t: n.life * 0.8,
        maxT: n.life,
        color: c2,
        size: 0.7,
        grav: -14
      });
    }
  }
  return true;
}
function timeTick(g, dt) {
  const p = g.player;
  clock += dt;
  if (!p) {
    prevEpoch = null;
    return;
  }
  if (g.player !== lastPlayer) {
    lastPlayer = g.player;
    prevEpoch = null;
    pendingAcq.clear();
    recalls.length = 0;
    duets.length = 0;
  }
  if (prevEpoch !== null && prevEpoch !== g.epoch)
    onLanded(g);
  prevEpoch = g.epoch;
  const inGame = g.state === "play" || g.state === "dialogue";
  if (inGame) {
    acquireAcc += dt;
    if (acquireAcc >= 0.2) {
      acquireAcc = 0;
      acquireScan(g);
    }
  }
  recallsTick(g, dt);
  duetsTick(g, dt);
  if (inGame)
    residuesTick(g, dt);
}
function onLanded(g) {
  tryDuets(g);
  const fires = [];
  if (g.epoch === "presente") {
    for (const l of LAMP_HUELLAS) {
      if (g.flags[l.flag] && !g.flags[`ts_${l.flag}`]) {
        g.flags[`ts_${l.flag}`] = true;
        fires.push({ text: l.frase, x: l.fx * TILE + 8, y: l.fy * TILE + 8, map: "aldea", toast: false, delay: 0 });
      }
    }
  }
  for (const [key, h] of pendingAcq) {
    if (g.epoch !== oppositeOf(h.acquire))
      continue;
    pendingAcq.delete(key);
    g.flags[`ts_${h.key}`] = true;
    fires.push({ text: h.frase, x: h.fx * TILE + 8, y: h.fy * TILE + 8, map: h.map, toast: false, delay: 0 });
  }
  let ecoFired = 0;
  for (const id of g.takenEchoes) {
    if (ecoFired >= 2)
      break;
    const ts = `ts_eco_${id}`;
    if (g.flags[ts])
      continue;
    g.flags[ts] = true;
    ecoFired++;
    const def = MAPS[g.mapId].echoes.find((e) => e.id === id);
    fires.push({
      text: ECO_FRASE,
      x: def ? def.x * TILE + 8 : null,
      y: def ? def.y * TILE + 8 : null,
      map: g.mapId,
      toast: false,
      delay: 0
    });
  }
  for (let i = 0;i < fires.length && i < 4; i++) {
    fires[i].delay = 0.35 + i * 0.9;
    fires[i].toast = i === 0;
    recalls.push(fires[i]);
  }
  while (recalls.length > RECALL_MAX)
    recalls.shift();
}
function oppositeOf(e) {
  return e === "presente" ? "pasado" : "presente";
}
function acquireScan(g) {
  const p = g.player;
  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor((p.y + p.h * 0.5) / TILE);
  for (const h of HUELLAS) {
    if (h.map !== g.mapId || h.acquire !== g.epoch)
      continue;
    if (g.flags[`ts_${h.key}`] || pendingAcq.has(h.key))
      continue;
    if (tx < h.ax0 || tx > h.ax1 || ty < h.ay0 || ty > h.ay1)
      continue;
    pendingAcq.set(h.key, h);
    g.floatAt(p.x, p.y - 22, h.acquire === "pasado" ? "...el ayer toma nota..." : "...el hoy toma nota...", "#c8b0e8", 6);
    for (let i = 0;i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      g.particles.push({
        x: p.x + Math.cos(a) * 6,
        y: p.y - 8 + Math.sin(a) * 4,
        vx: Math.cos(a) * 14,
        vy: -14 - Math.random() * 10,
        t: 0.5,
        maxT: 0.5,
        color: "#ffe9a0",
        size: 1,
        grav: 0
      });
    }
  }
}
function recallsTick(g, dt) {
  for (let i = recalls.length - 1;i >= 0; i--) {
    const r = recalls[i];
    r.delay -= dt;
    if (r.delay > 0)
      continue;
    recalls.splice(i, 1);
    const p = g.player;
    const { x: rx, y: ry } = r;
    const local = r.map === g.mapId && rx !== null && ry !== null && Math.hypot(rx - p.x, ry - p.y) <= 20 * TILE;
    if (local)
      g.floatAt(rx, ry, r.text, "#ffe9a0", 8);
    else
      g.floatAt(p.x, p.y - 24, r.text, "#ffe9a0", 8);
    if (r.toast)
      g.toast(r.text, "#ffe9a0");
  }
}
function duetsTick(g, dt) {
  for (let i = duets.length - 1;i >= 0; i--) {
    const d = duets[i];
    if (!g.npcs.includes(d.npc)) {
      duets.splice(i, 1);
      continue;
    }
    d.next -= dt;
    if (d.next > 0)
      continue;
    const past = d.step % 2 === 1;
    g.floats.push({
      x: d.npc.x,
      y: d.npc.y - 18 - d.step % 2 * 15,
      text: d.lines[d.step % 2],
      t: 1.2,
      color: past ? "#ffd88a" : "#cfe0ff",
      vy: -5,
      size: 7
    });
    d.step++;
    d.next = 0.55;
    if (d.step >= 6)
      duets.splice(i, 1);
  }
}
function tryDuets(g) {
  const p = g.player;
  for (const n of g.npcs) {
    const lines = DUALS[n.nid];
    if (!lines)
      continue;
    if (Math.hypot(n.x - p.x, n.y - p.y) > DUAL_TILES * TILE)
      continue;
    const last = duetCd.get(n);
    if (last !== undefined && clock - last < DUAL_CD)
      continue;
    duetCd.set(n, clock);
    duets.push({ npc: n, lines, step: 0, next: 0.15 });
  }
  while (duets.length > 4)
    duets.shift();
}
function residuesTick(g, dt) {
  if (g.particles.length > 240)
    return;
  const spots = spotsOf(g);
  const x0 = g.camX / ZOOM - 24, y0 = g.camY / ZOOM - 24;
  const x1 = (g.camX + VIEW_W) / ZOOM + 24, y1 = (g.camY + VIEW_H) / ZOOM + 24;
  const past = g.epoch === "pasado";
  for (const s of residue) {
    s.next -= dt;
    if (s.next > 0)
      continue;
    s.next = 1 + Math.random() * 0.7;
    const sp = pickVisible(spots, x0, y0, x1, y1, g, past);
    if (!sp)
      continue;
    const life = past ? 1.5 + Math.random() * 0.7 : 1.2 + Math.random() * 0.7;
    g.particles.push({
      x: sp.x + (Math.random() - 0.5) * 14,
      y: sp.y - 4 + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 10,
      vy: past ? -(12 + Math.random() * 10) : 14 + Math.random() * 12,
      t: life,
      maxT: life,
      color: past ? Math.random() < 0.6 ? "#c8b0e8" : "#ffd88a" : Math.random() < 0.7 ? "#ffe9a0" : "#f0d890",
      size: past ? 0.9 + Math.random() * 0.5 : 1 + Math.random() * 0.7,
      grav: past ? -6 : 0
    });
  }
}
function spotsOf(g) {
  const hit = spotCache.get(g.mapId);
  if (hit)
    return hit;
  const spots = [];
  const m = MAPS[g.mapId];
  const cells = new Map;
  for (const d of m.epochDiffs) {
    const k = `${Math.floor(d.x / 4)}:${Math.floor(d.y / 4)}`;
    const c = cells.get(k) ?? { sx: 0, sy: 0, n: 0 };
    c.sx += d.x;
    c.sy += d.y;
    c.n++;
    cells.set(k, c);
  }
  for (const c of cells.values())
    spots.push({ x: c.sx / c.n * TILE + 8, y: c.sy / c.n * TILE + 8 });
  for (const pr of m.props) {
    if (pr.kind === "lamp")
      spots.push({ x: pr.x * TILE + 8, y: pr.y * TILE + 8, gate: pr.id });
  }
  spotCache.set(g.mapId, spots);
  return spots;
}
function pickVisible(spots, x0, y0, x1, y1, g, past) {
  const vis = (s) => {
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1)
      return false;
    if (s.gate && !past && !g.flags[s.gate])
      return false;
    return true;
  };
  let count = 0;
  for (const s of spots)
    if (vis(s))
      count++;
  if (count === 0)
    return null;
  const target = rotIdx++ % count;
  let i = 0;
  for (const s of spots) {
    if (!vis(s))
      continue;
    if (i === target)
      return s;
    i++;
  }
  return null;
}

// src/game/engine.ts
setSkillCdDecay(false);
var compMem = new WeakMap;
var COMPANION_LINES = [
  "¡A tu izquierda!",
  "¡Vienen varios, no te dejes rodear!",
  "¡Detrás de ti!",
  "Cúbreme el flanco.",
  "¡Están flanqueándote!"
];
var VIEW_W = 960;
var VIEW_H = 540;
var ZOOM = 2;
function fitViewToWindow(winW, winH) {
  const a = winW / Math.max(1, winH);
  let vw = Math.round(540 * a);
  let vh = 540;
  if (vw < 840) {
    vw = 840;
    vh = Math.round(vw / a);
  } else if (vw > 1600) {
    vw = 1600;
    vh = Math.round(vw / a);
  }
  vh = Math.max(460, Math.min(800, vh));
  vw = Math.max(840, Math.min(1600, Math.round(vh * a)));
  if (vw !== VIEW_W || vh !== VIEW_H) {
    VIEW_W = vw;
    VIEW_H = vh;
  }
}
var BOSS_DEFEAT_FLAG = {
  guardian: "guardianDefeated",
  sirena: "sirenaDefeated",
  golem: "golemDefeated",
  vult: "vultDefeated",
  coro: "coroDefeated"
};

class Game {
  canvas;
  ctx;
  state = "title";
  onStateChange;
  onRequestCreate;
  musicVolUi = 0.7;
  sfxVolUi = 0.8;
  requestCreate() {
    if (this.state !== "title")
      return;
    audio.sfx("confirm");
    this.onRequestCreate?.();
  }
  mapId = "lunaris";
  map = MAPS.lunaris;
  rows = [];
  groundCanvas = null;
  groundPastCanvas = null;
  miniCanvas = null;
  epoch = "presente";
  epochFx = 0;
  player = null;
  enemies = [];
  npcs = [];
  companion = null;
  visitedMaps = { lunaris: true };
  projectiles = [];
  particles = [];
  floats = [];
  toasts = [];
  waves = [];
  telegraphs = [];
  lastNote = "fuego";
  flashT = 0;
  flashColor = "#ffffff";
  slowmoT = 0;
  memoryReveal = null;
  bossBannerT = 0;
  bossBannerText = "";
  bossBannerSub = "";
  flags = {};
  questIdx = 0;
  questStep = 0;
  openedChests = new Set;
  takenEchoes = new Set;
  deadGolds = [];
  camX = 0;
  camY = 0;
  dayT = 0.15;
  globalT = 0;
  mapTitleT = 0;
  hitStop = 0;
  shake = 0;
  fadeT = 0;
  fadeDir = 0;
  pendingMap = null;
  exitCd = 0;
  rollQueued = false;
  lastGoldLost = 0;
  uiHit = [];
  mouse = { x: 0, y: 0, down: false, rdown: false, worldX: 0, worldY: 0 };
  keys = new Set;
  pauseTab = 0;
  introIdx = 0;
  endStats = "";
  dlgKey = null;
  dlgNode = null;
  dlgCharT = 0;
  dlgSel = 0;
  dynNodes = {};
  bossRef = null;
  bossActive = false;
  challengeRun = null;
  stats = defaultStats();
  raf = 0;
  lastTs = 0;
  running = false;
  loopError = null;
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    initSprites();
    initExpansionSprites();
    this.bindInput();
    try {
      const v = JSON.parse(localStorage.getItem("ecos-vol") ?? "null");
      if (v && typeof v.m === "number" && typeof v.s === "number") {
        this.musicVolUi = Math.min(1, Math.max(0, v.m));
        this.sfxVolUi = Math.min(1, Math.max(0, v.s));
        audio.setMusicVol(this.musicVolUi * 0.9);
        audio.setSfxVol(this.sfxVolUi * 0.9);
      }
    } catch {}
    window.__g = this;
  }
  setState(s) {
    this.state = s;
    if (s !== "play" && s !== "dialogue")
      this.pendingMap = null;
    if (s !== "play")
      this.rollQueued = false;
    if (s !== "play" && s !== "dialogue" && this.player?.charging) {
      this.player.charging = false;
      this.player.chargeT = 0;
    }
    this.onStateChange?.(s);
    if (s === "title")
      audio.playTrack("title");
  }
  update(dt) {
    updateGame(this, dt);
    if (this.bossActive && this.bossRef?.etype === "sirena" && this.questIdx === 6 && this.questStep === 0 && !this.flags.sirenaSeen) {
      this.flags.sirenaSeen = true;
      this.questAdvance();
      this.toast("La Sirena te ha visto...", "#8ef0ff");
    }
    this.catchUpActo2();
    challengeTick(this, dt);
    skillTick(this, dt);
    balanceTick(this, dt);
    worldTick(this, dt);
    timeTick(this, dt);
    armorTick(this, dt);
    statsTick(this, dt);
    achievementTick(this);
    this.companionTick(dt);
    this.antiStuck();
  }
  catchUpActo2() {
    if (this.questIdx < 5 || this.questIdx > 9)
      return;
    if (this.questIdx === 6) {
      if (this.questStep === 0 && this.flags.sirenaDefeated)
        this.questAdvance();
      if (this.questIdx === 6 && this.questStep === 1 && this.flags.sirenaDefeated)
        this.questAdvance();
      if (this.questIdx === 6 && this.questStep === 2 && this.flags.ecoMareas)
        this.questAdvance();
    }
    if (this.questIdx === 7) {
      if (this.questStep === 1 && ["lamp1", "lamp2", "lamp3"].filter((l) => this.flags[l]).length >= 3)
        this.questAdvance();
      if (this.questIdx === 7 && this.questStep === 2 && this.flags.ecoNombres)
        this.questAdvance();
    }
    if (this.questIdx === 8) {
      if (this.questStep === 1 && this.flags.golemDefeated)
        this.questAdvance();
      if (this.questIdx === 8 && this.questStep === 2 && this.flags.ecoCumbres)
        this.questAdvance();
    }
  }
  start() {
    if (this.running)
      return;
    this.running = true;
    this.lastTs = performance.now();
    const loop = (ts) => {
      if (!this.running)
        return;
      try {
        let dt = Math.min(0.05, (ts - this.lastTs) / 1000);
        this.lastTs = ts;
        if (this.flashT > 0)
          this.flashT = Math.max(0, this.flashT - dt);
        if (this.bossBannerT > 0)
          this.bossBannerT = Math.max(0, this.bossBannerT - dt);
        if (this.memoryReveal) {
          this.memoryReveal.t -= dt;
          if (this.memoryReveal.t <= 0)
            this.memoryReveal = null;
        }
        if (this.hitStop > 0) {
          this.hitStop -= dt;
          dt *= 0.12;
        }
        if (this.slowmoT > 0) {
          this.slowmoT -= dt;
          dt *= 0.35;
        }
        this.globalT += dt;
        if (this.state === "play" || this.state === "dialogue")
          this.update(dt);
        drawGame(this);
        this.loopError = null;
      } catch (err) {
        this.loopError = err instanceof Error ? err.stack ?? String(err) : String(err);
        console.error("[EcosAelthar loop]", err);
        try {
          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
          this.ctx.font = "12px monospace";
          this.ctx.fillStyle = "#ff7060";
          this.ctx.textAlign = "left";
          this.ctx.textBaseline = "top";
          this.ctx.fillText("Error: " + String(err).slice(0, 90), 20, 20);
          this.ctx.fillText((err instanceof Error ? err.stack ?? "" : "").slice(0, 600).replace(/\n/g, " | "), 20, 44);
        } catch {}
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    audio.stopMusic();
  }
  newGame(name, disc2) {
    const maxHp = disc2 === "alba" ? 110 : 96;
    this.player = {
      kind: "player",
      name: name || "Portador",
      discipline: disc2,
      x: 25 * TILE + 8,
      y: 20 * TILE,
      w: 10,
      h: 8,
      vx: 0,
      vy: 0,
      dir: "down",
      hp: maxHp,
      maxHp,
      sprite: disc2 === "alba" ? "hero_alba" : "hero_tejedor",
      anim: 0,
      moving: false,
      level: 1,
      xp: 0,
      sta: 100,
      maxSta: 100,
      res: 0,
      maxRes: 100,
      attrs: { fue: 2, des: 2, int: 2, esp: 2, vig: 2 },
      points: 0,
      gold: 20,
      weaponPlus: 0,
      potions: 2,
      cds: [0, 0, 0, 0],
      iframes: 0,
      parryT: 0,
      parryFx: 0,
      attackT: 0,
      combo: 0,
      chargeT: 0,
      charging: false,
      rollT: 0,
      lastHitT: 0,
      hasEcho: false,
      kills: 0,
      deaths: 0,
      repGuardianes: 0,
      playTime: 0,
      tones: { empatico: 0, pragmatico: 0, sarcastico: 0, amenazante: 0 },
      memories: [],
      repFacciones: { guardianes: 0, orden: 0, circulo: 0, liga: 0 }
    };
    this.flags = {};
    this.questIdx = 0;
    this.questStep = 0;
    this.openedChests = new Set;
    this.takenEchoes = new Set;
    this.deadGolds = [];
    this.companion = null;
    this.visitedMaps = { lunaris: true };
    this.stats = defaultStats();
    this.dayT = 0.15;
    this.setState("intro");
    this.introIdx = 0;
    audio.playTrack("title");
  }
  startPlay() {
    this.loadMap("lunaris", 25, 20);
    this.mapTitleT = 3.2;
    this.setState("play");
    audio.playTrack("village");
  }
  hasSave() {
    try {
      return !!localStorage.getItem("ecos-aelthar-save");
    } catch {
      return false;
    }
  }
  continueGame() {
    const raw = (() => {
      try {
        return localStorage.getItem("ecos-aelthar-save");
      } catch {
        return null;
      }
    })();
    if (!raw)
      return;
    let d;
    try {
      d = JSON.parse(raw);
      if (!d || !d.player || typeof d.x !== "number" || typeof d.y !== "number" || !MAPS[d.map])
        throw new Error("forma inválida");
    } catch {
      try {
        localStorage.removeItem("ecos-aelthar-save");
      } catch {}
      this.toast("La partida guardada estaba dañada y no pudo recuperarse.", "#ff8060");
      return;
    }
    const p = d.player;
    const maxHp = p.maxHp;
    this.player = {
      kind: "player",
      name: p.name,
      discipline: p.discipline,
      x: d.x,
      y: d.y,
      w: 10,
      h: 8,
      vx: 0,
      vy: 0,
      dir: "down",
      hp: Math.max(1, p.hp),
      maxHp,
      sprite: p.discipline === "alba" ? "hero_alba" : "hero_tejedor",
      anim: 0,
      moving: false,
      level: p.level,
      xp: p.xp,
      sta: p.maxSta,
      maxSta: p.maxSta,
      res: p.res,
      maxRes: 100,
      attrs: { ...p.attrs },
      points: p.points,
      gold: p.gold,
      weaponPlus: p.weaponPlus,
      potions: p.potions,
      cds: [0, 0, 0, 0],
      iframes: 0,
      parryT: 0,
      parryFx: 0,
      attackT: 0,
      combo: 0,
      chargeT: 0,
      charging: false,
      rollT: 0,
      lastHitT: 0,
      hasEcho: p.hasEcho,
      kills: p.kills,
      deaths: p.deaths,
      repGuardianes: p.repGuardianes,
      playTime: p.playTime,
      tones: p.tones ?? { empatico: 0, pragmatico: 0, sarcastico: 0, amenazante: 0 },
      memories: p.memories ?? [],
      repFacciones: p.repFacciones ?? { guardianes: 0, orden: 0, circulo: 0, liga: 0 }
    };
    this.flags = { ...d.flags };
    this.questIdx = d.questIdx;
    this.questStep = d.questStep;
    this.openedChests = new Set(d.openedChests);
    this.takenEchoes = new Set(d.takenEchoes);
    this.deadGolds = d.deadGolds ?? [];
    this.stats = sanitizeStats(d.stats);
    this.epoch = d.epoch === "pasado" && p.hasEcho ? "pasado" : "presente";
    this.companion = d.companion ? this.makeCompanion() : null;
    if (this.companion && (d.companionMode === "agresivo" || d.companionMode === "defensivo" || d.companionMode === "seguir")) {
      this.companion.mode = d.companionMode;
    }
    this.visitedMaps = { lunaris: true };
    if (this.flags.visitedBosque)
      this.visitedMaps.bosque = true;
    if (this.flags.visitedCripta)
      this.visitedMaps.cripta = true;
    this.loadMap(d.map, Math.floor(d.x / TILE), Math.floor(d.y / TILE));
    const stx = Math.floor(d.x / TILE), sty = Math.floor(d.y / TILE);
    if (this.player && !this.tileSolidAt(d.x, d.y) && !this.inExitZone(stx, sty)) {
      this.player.x = d.x;
      this.player.y = d.y;
    }
    this.mapTitleT = 2.5;
    this.setState("play");
    audio.playTrack(this.map.music);
  }
  save() {
    if (!this.player)
      return;
    const p = this.player;
    const d = {
      v: 1,
      player: {
        name: p.name,
        discipline: p.discipline,
        level: p.level,
        xp: p.xp,
        hp: p.hp,
        maxHp: p.maxHp,
        sta: p.sta,
        maxSta: p.maxSta,
        res: p.res,
        attrs: { ...p.attrs },
        points: p.points,
        gold: p.gold,
        weaponPlus: p.weaponPlus,
        potions: p.potions,
        hasEcho: p.hasEcho,
        kills: p.kills,
        deaths: p.deaths,
        repGuardianes: p.repGuardianes,
        playTime: p.playTime,
        tones: p.tones,
        memories: p.memories,
        repFacciones: p.repFacciones
      },
      map: this.mapId,
      x: Math.round(p.x),
      y: Math.round(p.y),
      epoch: this.epoch,
      flags: { ...this.flags, visitedBosque: !!this.visitedMaps.bosque, visitedCripta: !!this.visitedMaps.cripta },
      questIdx: this.questIdx,
      questStep: this.questStep,
      openedChests: [...this.openedChests],
      takenEchoes: [...this.takenEchoes],
      deadGolds: this.deadGolds,
      companion: !!this.companion,
      companionMode: this.companion?.mode ?? "seguir",
      saveTime: Date.now(),
      stats: { ...this.stats }
    };
    try {
      localStorage.setItem("ecos-aelthar-save", JSON.stringify(d));
    } catch {}
    try {
      localStorage.setItem("ecos-stats", JSON.stringify(this.stats));
    } catch {}
  }
  loadMap(id, tx, ty) {
    if (this.bossRef && !this.bossRef.dead) {
      this.flags[`bossHp_${this.mapId}`] = this.bossRef.hp;
      if (this.mapId === "cripta")
        this.flags.bossHp = this.bossRef.hp;
    }
    this.mapId = id;
    this.map = MAPS[id];
    this.rows = mapRows(this.map);
    this.buildGround();
    if (this.player) {
      const [sx, sy] = this.findSafeTile(tx, ty);
      this.player.x = sx * TILE + 8;
      this.player.y = sy * TILE + 8;
      this.player.iframes = 0;
      this.player.rollT = 0;
      this.player.charging = false;
      this.player.chargeT = 0;
      this.player.parryT = 0;
      this.player.lastHitT = 0;
      this.rollQueued = false;
    }
    this.exitCd = 0.9;
    this.spawnEnemies();
    const savedBossHp = typeof this.flags[`bossHp_${id}`] === "number" ? this.flags[`bossHp_${id}`] : id === "cripta" && typeof this.flags.bossHp === "number" ? this.flags.bossHp : null;
    if (savedBossHp !== null) {
      const boss = this.enemies.find((e) => BOSS_DEFEAT_FLAG[e.etype] !== undefined);
      if (boss)
        boss.hp = Math.max(1, Math.min(boss.maxHp, savedBossHp));
    }
    this.spawnNpcs();
    this.projectiles = [];
    this.waves = [];
    this.telegraphs = [];
    this.bossRef = null;
    this.bossActive = false;
    audio.setCombat(false);
    this.visitedMaps[id] = true;
    if (id === "bosque" && !this.flags.visitedBosque) {
      this.flags.visitedBosque = true;
      if (this.questIdx === 2 && this.questStep === 0)
        this.questAdvance();
    }
    if (id === "cripta" && !this.flags.visitedCripta) {
      this.flags.visitedCripta = true;
      if (this.questIdx === 3 && this.questStep === 0)
        this.questAdvance();
    }
    if (id === "costa" && this.questIdx === 5 && this.questStep === 0)
      this.questAdvance();
    if (id === "aldea" && this.questIdx === 7 && this.questStep === 0)
      this.questAdvance();
    if (id === "cumbres" && this.questIdx === 8 && this.questStep === 0)
      this.questAdvance();
    if (!this.flags[`visited_${id}`])
      this.flags[`visited_${id}`] = true;
    this.mapTitleT = 2.6;
    this.updateCamera(true);
  }
  buildGround() {
    const { w, h } = this.map;
    const mk = (ep) => {
      const c = document.createElement("canvas");
      c.width = w * TILE;
      c.height = h * TILE;
      const x = c.getContext("2d");
      x.imageSmoothingEnabled = false;
      for (let ty = 0;ty < h; ty++) {
        for (let tx = 0;tx < w; tx++) {
          const ch = tileAt(this.map, this.rows, tx, ty, ep);
          if (!drawExpansionTile(x, ch, tx, ty, this.mapId))
            drawTile(x, ch, tx, ty, this.mapId, 0, (dx, dy) => tileAt(this.map, this.rows, tx + dx, ty + dy, ep));
        }
      }
      for (let ty = 0;ty < h; ty++) {
        for (let tx = 0;tx < w; tx++) {
          const ch = tileAt(this.map, this.rows, tx, ty, ep);
          if (SOLID_CHARS.has(ch) && (ch === "t" || ch === "p")) {
            if (!drawExpansionTallTile(x, ch, tx, ty, this.mapId))
              drawTallTile(x, ch, tx, ty, this.mapId, (dx, dy) => tileAt(this.map, this.rows, tx + dx, ty + dy, ep));
          }
        }
      }
      return c;
    };
    this.groundCanvas = mk("presente");
    this.groundPastCanvas = this.map.epochDiffs.length ? mk("pasado") : this.groundCanvas;
    const mini = document.createElement("canvas");
    mini.width = w;
    mini.height = h;
    const mx = mini.getContext("2d");
    for (let ty = 0;ty < h; ty++) {
      for (let tx = 0;tx < w; tx++) {
        const ch = tileAt(this.map, this.rows, tx, ty, "presente");
        mx.fillStyle = ch === "s" ? "#d8c07a" : ch === "S" ? "#dfe8f2" : ch === "i" ? "#a8cfe8" : ch === "~" ? "#3a6a9a" : ch === "=" ? "#b89a6a" : ch === ":" ? "#6a6a7a" : ch === "t" || ch === "p" ? "#24512a" : ch === "#" || ch === "H" || ch === "r" ? "#7a7a8a" : ch === "n" ? "#7ea49a" : "#4a8a44";
        mx.fillRect(tx, ty, 1, 1);
      }
    }
    this.miniCanvas = mini;
  }
  spawnEnemies() {
    this.enemies = [];
    for (const s of this.map.spawns) {
      if (s.needPast && this.epoch !== "pasado")
        continue;
      if (s.needPresent && this.epoch !== "presente")
        continue;
      const defFlag = BOSS_DEFEAT_FLAG[s.type];
      if (defFlag && this.flags[defFlag])
        continue;
      this.enemies.push(this.makeEnemy(s.type, s.x * TILE + 8, s.y * TILE + 8, s.patrol ?? 2, s.zone));
    }
  }
  makeEnemy(type, x, y, patrol, zone) {
    const d = ENEMY_DEFS[type];
    const bm = enemyStatMult(this);
    const hp = Math.max(1, Math.round(d.hp * bm.hp));
    return {
      kind: "enemy",
      etype: type,
      x,
      y,
      w: type === "guardian" || type === "sirena" || type === "golem" || type === "vult" || type === "coro" ? 22 : 12,
      h: type === "guardian" || type === "sirena" || type === "golem" || type === "vult" || type === "coro" ? 16 : 10,
      vx: 0,
      vy: 0,
      dir: "down",
      hp,
      maxHp: hp,
      sprite: d.sprite,
      anim: Math.random() * 9,
      moving: false,
      ai: "patrulla",
      aiT: Math.random() * 2,
      homeX: x,
      homeY: y,
      patrolAngle: Math.random() * Math.PI * 2,
      aggro: false,
      windup: 0,
      atkCd: Math.random(),
      sta: d.breakBar ?? 0,
      maxSta: d.breakBar ?? 0,
      statuses: [],
      slowT: 0,
      phase: 1,
      sumT: 0,
      hitFlash: 0,
      spawnGuard: zone === "boss" ? 0.5 : 0
    };
  }
  spawnNpcs() {
    this.npcs = [];
    for (const n of this.map.npcs) {
      if (n.hideFlag && this.flags[n.hideFlag])
        continue;
      if (n.showFlag && !this.flags[n.showFlag])
        continue;
      this.npcs.push({
        kind: "npc",
        nid: n.id,
        dispName: n.name,
        x: n.x * TILE + 8,
        y: n.y * TILE + 8,
        w: 10,
        h: 8,
        vx: 0,
        vy: 0,
        dir: "down",
        hp: 1,
        maxHp: 1,
        sprite: n.sprite,
        anim: Math.random() * 9,
        moving: false
      });
    }
  }
  makeCompanion() {
    return {
      kind: "companion",
      cname: "Ilwen",
      x: (this.player?.x ?? 0) - 14,
      y: this.player?.y ?? 0,
      w: 10,
      h: 8,
      vx: 0,
      vy: 0,
      dir: "down",
      hp: 60,
      maxHp: 60,
      sprite: "ilwen",
      anim: 0,
      moving: false,
      atkCd: 0,
      downT: 0,
      affinity: 10
    };
  }
  companionTick(dt) {
    const c = this.companion, p = this.player;
    if (!c || !p || c.downT > 0)
      return;
    const mem2 = compMem.get(c) ?? { lastX: c.x, lastY: c.y, stuckT: 0, coverCd: 0.5, lineCd: 14, lineIdx: 0 };
    compMem.set(c, mem2);
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d > 12 * TILE || !this.boxFree(c.x, c.y, c.w, c.h)) {
      this.companionTeleport(c, p);
      mem2.lastX = c.x;
      mem2.lastY = c.y;
      return;
    }
    const moved = Math.hypot(c.x - mem2.lastX, c.y - mem2.lastY);
    mem2.lastX = c.x;
    mem2.lastY = c.y;
    if (d > 40 && moved < 0.6)
      mem2.stuckT += dt;
    else
      mem2.stuckT = 0;
    if (mem2.stuckT >= 1.2) {
      this.companionTeleport(c, p);
      mem2.stuckT = 0;
      return;
    }
    mem2.coverCd -= dt;
    if (mem2.coverCd <= 0 && this.state === "play") {
      let best = null, bd = 190;
      for (const e of this.enemies) {
        if (e.dead || !e.aggro)
          continue;
        if ((c.mode ?? "seguir") === "defensivo" && Math.hypot(e.x - p.x, e.y - p.y) >= 2 * TILE)
          continue;
        const score = Math.hypot(e.x - p.x, e.y - p.y) - ((e.marked ?? 0) > 0 ? 60 : 0);
        if (score < bd) {
          bd = score;
          best = e;
        }
      }
      if (best) {
        mem2.coverCd = 2.4;
        const dx = best.x - c.x, dy = best.y - 4 - (c.y - 6);
        const l = Math.max(1, Math.hypot(dx, dy));
        this.projectiles.push({
          x: c.x,
          y: c.y - 6,
          vx: dx / l * 190,
          vy: dy / l * 190,
          t: 1.2,
          dmg: 6 + p.level * 1.2,
          element: "ninguno",
          from: "companion",
          sprite: "p_arrow",
          radius: 3,
          pierce: 0
        });
        audio.sfx("companionShot");
      }
    }
    const inCombat = this.enemies.some((e) => !e.dead && e.aggro);
    if (!inCombat && c.hp < c.maxHp)
      c.hp = Math.min(c.maxHp, c.hp + 8 * dt);
    mem2.lineCd -= dt;
    if (mem2.lineCd <= 0 && inCombat && this.state === "play") {
      let near = 0;
      for (const e of this.enemies) {
        if (!e.dead && e.aggro && Math.hypot(e.x - p.x, e.y - p.y) < 110)
          near++;
      }
      if (near >= 2) {
        mem2.lineCd = 25;
        this.floatAt(c.x, c.y - 24, COMPANION_LINES[mem2.lineIdx % COMPANION_LINES.length], "#a8e8c8", 6);
        mem2.lineIdx++;
      } else {
        mem2.lineCd = 4;
      }
    }
  }
  companionTeleport(c, p) {
    let placed = false;
    for (let r = 1;r <= 3 && !placed; r++) {
      for (let i = 0;i < 8 * r && !placed; i++) {
        const a = i / (8 * r) * Math.PI * 2;
        const nx = p.x + Math.cos(a) * 18 * r;
        const ny = p.y + Math.sin(a) * 18 * r;
        if (this.boxFree(nx, ny, c.w, c.h)) {
          c.x = nx;
          c.y = ny;
          placed = true;
        }
      }
    }
    if (!placed) {
      c.x = p.x - 14;
      c.y = p.y;
    }
    c.kbVx = 0;
    c.kbVy = 0;
    this.burst(c.x, c.y - 4, "#8ef0b0", 8, 40);
  }
  antiStuck() {
    const p = this.player;
    if (!p || !this.rows.length || this.boxFree(p.x, p.y, p.w, p.h))
      return;
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    for (let r = 1;r <= 6; r++) {
      for (let dy = -r;dy <= r; dy++) {
        for (let dx = -r;dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r)
            continue;
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h)
            continue;
          const wx = nx * TILE + 8, wy = ny * TILE + 8;
          if (this.boxFree(wx, wy, p.w, p.h) && !this.inExitZone(nx, ny)) {
            p.x = wx;
            p.y = wy;
            this.floatAt(p.x, p.y - 20, "El canto te aparta del muro", "#c8b0e8", 6);
            return;
          }
        }
      }
    }
  }
  tileSolidAt(px3, py) {
    const tx = Math.floor(px3 / TILE), ty = Math.floor(py / TILE);
    const ch = tileAt(this.map, this.rows, tx, ty, this.epoch);
    return SOLID_CHARS.has(ch);
  }
  inExitZone(tx, ty) {
    return this.map.exits.some((ex) => {
      if (ex.needPast && this.epoch !== "pasado")
        return false;
      return tx >= ex.x && tx < ex.x + ex.w && ty >= ex.y && ty < ex.y + ex.h;
    });
  }
  findSafeTile(tx, ty) {
    const ok = (x, y) => x >= 0 && y >= 0 && x < this.map.w && y < this.map.h && !this.tileSolidAt(x * TILE + 8, y * TILE + 8) && !this.inExitZone(x, y);
    if (ok(tx, ty))
      return [tx, ty];
    for (let r = 1;r <= 8; r++) {
      for (let dy = -r;dy <= r; dy++) {
        for (let dx = -r;dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r)
            continue;
          if (ok(tx + dx, ty + dy))
            return [tx + dx, ty + dy];
        }
      }
    }
    return [tx, ty];
  }
  boxFree(x, y, w, h) {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2 - 2, y1 = y + h / 2;
    return !(this.tileSolidAt(x0, y0) || this.tileSolidAt(x1, y0) || this.tileSolidAt(x0, y1) || this.tileSolidAt(x1, y1));
  }
  moveEntity(e, dx, dy) {
    if (e === this.player && this.flags.armor_3) {
      dx *= ARMOR_HEAVY_SPEED;
      dy *= ARMOR_HEAVY_SPEED;
    }
    const { x: wasX, y: wasY } = e;
    if (dx !== 0 && this.boxFree(e.x + dx, e.y, e.w, e.h))
      e.x += dx;
    if (dy !== 0 && this.boxFree(e.x, e.y + dy, e.w, e.h))
      e.y += dy;
    if (e === this.player && !this.challengeRun) {
      this.stats.distanciaAndada += Math.hypot(e.x - wasX, e.y - wasY);
    }
  }
  updateCamera(snap = false) {
    if (!this.player)
      return;
    const targetX = this.player.x * ZOOM - VIEW_W / 2;
    const targetY = this.player.y * ZOOM - VIEW_H / 2;
    const maxX = this.map.w * TILE * ZOOM - VIEW_W;
    const maxY = this.map.h * TILE * ZOOM - VIEW_H;
    const cx = Math.max(0, Math.min(maxX, targetX));
    const cy = Math.max(0, Math.min(maxY, targetY));
    if (snap) {
      this.camX = cx;
      this.camY = cy;
    } else {
      this.camX += (cx - this.camX) * 0.14;
      this.camY += (cy - this.camY) * 0.14;
    }
  }
  epochSwitch() {
    if (!this.player || !this.player.hasEcho) {
      this.toast("Aún no puedes oír el pasado...", "#c8b0e8");
      return;
    }
    if (this.map.epochDiffs.length === 0) {
      this.toast("La Cripta existe fuera del tiempo.", "#9aa0b8");
      return;
    }
    if (!beginEpochShift(this))
      return;
    this.epoch = this.epoch === "presente" ? "pasado" : "presente";
    this.epochFx = 0.8;
    if (!this.challengeRun)
      this.stats.vecesCambioEpoca++;
    audio.sfx("epoch");
    if (this.player && this.tileSolidAt(this.player.x, this.player.y)) {
      const [sx, sy] = this.findSafeTile(Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE));
      this.player.x = sx * TILE + 8;
      this.player.y = sy * TILE + 8;
      this.toast("El mundo cambia a tu alrededor... y te aparta del muro.", "#c8b0e8");
    }
    this.toast(this.epoch === "pasado" ? "El pasado canta a tu alrededor" : "Vuelves al presente en ruinas", "#ffe9a0");
  }
  nearestInteract() {
    const p = this.player;
    if (!p)
      return null;
    let best = null;
    const consider = (x, y, kind, label, act, r = 30) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < r && (!best || d < best.dist))
        best = { kind, label, act, dist: d };
    };
    for (const n of this.npcs)
      consider(n.x, n.y, "npc", `Hablar con ${n.dispName}`, () => this.talkTo(n.nid), 34);
    for (const ch of this.map.chests) {
      if (this.openedChests.has(ch.id))
        continue;
      if (ch.needPast && this.epoch !== "pasado")
        continue;
      consider(ch.x * TILE + 8, ch.y * TILE + 8, "chest", "Abrir cofre", () => this.openChest(ch.id), 26);
    }
    for (const pr of this.map.props) {
      if (pr.needPast && this.epoch !== "pasado")
        continue;
      if (pr.needPresent && this.epoch !== "presente")
        continue;
      const px3 = pr.x * TILE + 8, py = pr.y * TILE + 8;
      if (pr.kind === "sanctuary")
        consider(px3, py, "sanc", "Santuario del Eco", () => this.openSanctuary(), 26);
      else if (pr.kind === "forge")
        consider(px3, py, "forge", "Forja de Toln", () => this.talkTo("toln"), 28);
      else if (pr.kind === "fragment")
        consider(px3, py, "frag", "Fragmento de Eco", () => this.openDialogue("voz_fragment"), 30);
      else if (pr.kind === "altarEcho")
        consider(px3, py, "altar", "Altar del Eco", () => this.tryTakeEco(), 30);
      else if (pr.kind === "sign")
        consider(px3, py, "sign", "Leer cartel", () => this.readSign(pr.label ?? ""), 28);
      else if (pr.kind === "lamp" && !this.flags[pr.id])
        consider(px3, py, "lamp", "Encender el Farol del Recuerdo", () => this.lightLamp(pr.id), 28);
    }
    for (const ec of this.map.echoes) {
      if (this.takenEchoes.has(ec.id))
        continue;
      consider(ec.x * TILE + 8, ec.y * TILE + 8, "echo", "Escuchar eco menor", () => this.takeEchoMinor(ec.id, ec.title, ec.text), 26);
    }
    return best;
  }
  openChest(id) {
    const ch = this.map.chests.find((c) => c.id === id);
    if (!ch || this.openedChests.has(id))
      return;
    this.openedChests.add(id);
    audio.sfx("chest");
    const parts = [];
    if (ch.gold) {
      this.player.gold += ch.gold;
      parts.push(`${ch.gold} coronas`);
      this.floatAt(ch.x * TILE + 8, ch.y * TILE, `+${ch.gold}`, "#f0c84a");
      if (!this.challengeRun)
        this.stats.coronasGanadas += ch.gold;
    }
    if (ch.potions) {
      this.player.potions += ch.potions;
      parts.push(`${ch.potions} poción(es)`);
    }
    if (ch.item)
      parts.push(ch.item);
    this.toast(`Cofre abierto: ${parts.join(", ")}`, "#f0c84a");
    this.burst(ch.x * TILE + 8, ch.y * TILE, "#ffe9a0", 10);
  }
  takeEchoMinor(id, title, text2) {
    this.takenEchoes.add(id);
    audio.sfx("echo");
    this.dynNodes["lore"] = { name: title, portrait: "wisp", text: text2 };
    this.openDialogue("lore");
    this.player.res = Math.min(this.player.maxRes, this.player.res + 15);
  }
  readSign(text2) {
    this.dynNodes["lore"] = { name: "Cartel", portrait: "wisp", text: text2 };
    this.openDialogue("lore");
  }
  lightLamp(id) {
    this.flags[id] = true;
    audio.sfx("lamp");
    const pr = this.map.props.find((x) => x.id === id);
    if (pr) {
      this.burst(pr.x * TILE + 8, pr.y * TILE - 6, "#ffe9a0", 14, 60);
      this.floatAt(pr.x * TILE + 8, pr.y * TILE - 14, "Un nombre vuelve", "#ffe9a0", 5);
    }
    const lamps = ["lamp1", "lamp2", "lamp3"].filter((l) => this.flags[l]).length;
    if (this.questIdx === 7 && this.questStep === 1) {
      if (lamps >= 3) {
        this.questAdvance();
        this.toast("Los tres faroles arden: la Espectro de Merrow te espera", "#ffe9a0");
      } else {
        this.toast(`Farol encendido (${lamps}/3)`, "#8ef0b0");
      }
    } else {
      this.toast("El farol se enciende: un recuerdo de Merrow regresa", "#ffe9a0");
    }
  }
  tryTakeEco() {
    if (this.mapId === "costa") {
      if (this.flags.ecoMareas) {
        this.toast("El altar ya está vacío.", "#9aa0b8");
        return;
      }
      if (!this.flags.sirenaDefeated) {
        this.toast("La Sirena custodia el Eco. Calma su canto primero.", "#e88");
        return;
      }
      if (DIALOGUES["eco_mareas"]) {
        this.openDialogue("eco_mareas");
        return;
      }
      this.dynNodes["eco_mareas"] = {
        name: "Eco de las Mareas",
        portrait: "fragment",
        text: "El segundo canto asciende del naufragio, salado y vivo. «El mar guardó mi nota bajo la quilla de un barco que soñaba con estrellas. Cántala, Portador: hay mareás que solo se curan cantando.» (Eco de las Mareas recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)",
        onEnd: "eco_mareas_taken"
      };
      this.openDialogue("eco_mareas");
      return;
    }
    if (this.mapId === "cumbres") {
      if (this.flags.ecoCumbres) {
        this.toast("El altar ya está vacío.", "#9aa0b8");
        return;
      }
      if (!this.flags.golemDefeated) {
        this.toast("El Gólem custodia el Eco. Rompe su hielo primero.", "#e88");
        return;
      }
      if (DIALOGUES["eco_cumbres"]) {
        this.openDialogue("eco_cumbres");
        return;
      }
      this.dynNodes["eco_cumbres"] = {
        name: "Eco de las Cumbres",
        portrait: "fragment",
        text: "El tercer canto desciende con la ventisca, limpio y paciente. «Las montañas aprendieron a guardar voces bajo el hielo. La primera fue la de los pastores que cantaban por turnos para no dormirse. Toma la suya: ahora canta contigo.» (Eco de las Cumbres recuperado: +1 punto de habilidad, +10 reputación con los Guardianes del Canto)",
        onEnd: "eco_cumbres_taken"
      };
      this.openDialogue("eco_cumbres");
      return;
    }
    if (this.flags.ecoVoz) {
      this.toast("El altar ya está vacío.", "#9aa0b8");
      return;
    }
    if (!this.flags.guardianDefeated) {
      this.toast("El Guardián custodia el Eco. Derótalo primero.", "#e88");
      return;
    }
    this.openDialogue("eco_voz");
  }
  openSanctuary() {
    const opts = [
      { text: "Descansar y guardar la partida", action: "rest" }
    ];
    for (const mid of Object.keys(this.visitedMaps)) {
      if (this.visitedMaps[mid] && mid !== this.mapId) {
        const nm = MAPS[mid].name;
        opts.push({ text: `Viajar: ${nm}`, action: `travel_${mid}` });
      }
    }
    opts.push({ text: "Marcharse", action: "close" });
    this.dynNodes["sanctuary"] = {
      name: "Santuario del Eco",
      portrait: "sanctuary",
      text: "El cristal zumba con una melodía antigua. La luz del Santuario te envuelve: aquí puedes descansar, guardar tu canto... o dejarte llevar por él.",
      options: opts
    };
    this.openDialogue("sanctuary");
  }
  talkTo(nid) {
    if (nid === "brisa" && this.questIdx === 4 && this.questStep === 0)
      this.questAdvance();
    if (nid === "brisa" && this.questIdx === 9 && !this.flags.acto2Done)
      this.grantQuestLoot(9);
    const key = getDialogue(nid, { questIdx: this.questIdx, questStep: this.questStep, flags: this.flags, companion: !!this.companion });
    this.openDialogue(key);
  }
  openDialogue(key) {
    this.dlgKey = key;
    this.dlgNode = this.dynNodes[key] ?? DIALOGUES[key] ?? null;
    if (!this.dlgNode && key !== "brisa_idle") {
      console.warn(`[EcosAelthar] Nodo de diálogo inexistente: '${key}' — fallback: 'brisa_idle'`);
      this.dlgKey = "brisa_idle";
      this.dlgNode = DIALOGUES["brisa_idle"] ?? null;
    }
    this.dlgCharT = 0;
    this.dlgSel = 0;
    if (this.dlgNode)
      this.setState("dialogue");
    audio.sfx("uiOpen");
  }
  dialogueFinishedText() {
    if (!this.dlgNode)
      return true;
    return this.dlgCharT >= this.dlgNode.text.length;
  }
  advanceDialogue() {
    if (!this.dlgNode)
      return;
    if (!this.dialogueFinishedText()) {
      this.dlgCharT = this.dlgNode.text.length;
      return;
    }
    if (this.dlgNode.action)
      this.applyAction(this.dlgNode.action);
    if (this.dlgNode.onEnd)
      this.applyAction(this.dlgNode.onEnd);
    if (this.dlgNode.options && this.dlgNode.options.length > 0) {
      const opt = this.dlgNode.options[this.dlgSel];
      recordDialogueTone(this, opt);
      if (opt.action)
        this.applyAction(opt.action);
      if (opt.next) {
        this.openDialogue(opt.next);
        return;
      }
      this.closeDialogue();
      return;
    }
    if (this.dlgNode.next) {
      this.openDialogue(this.dlgNode.next);
      return;
    }
    this.closeDialogue();
  }
  closeDialogue() {
    this.dlgKey = null;
    this.dlgNode = null;
    noteDialogueClosed16b(this);
    if (this.state === "dialogue")
      this.setState("play");
  }
  applyAction(action) {
    const p = this.player;
    if (!p)
      return;
    switch (true) {
      case action === "accept_q2":
        this.questIdx = 1;
        this.questStep = 0;
        this.flags.q2 = true;
        audio.sfx("quest");
        this.toast("Nueva misión: Lobos en la Niebla", "#8ef0b0");
        break;
      case action === "accept_q3":
        this.questIdx = 2;
        this.questStep = this.flags.visitedBosque ? 1 : 0;
        p.gold += 50;
        p.potions += 2;
        p.repGuardianes += 10;
        audio.sfx("quest");
        this.toast("Misión completada: Lobos en la Niebla (+50 coronas, +2 pociones, +10 reputación)", "#8ef0b0");
        this.toast("Nueva misión: El Susurro del Bosque", "#8ef0b0");
        break;
      case action === "accept_q4":
        this.questIdx = 3;
        this.questStep = 0;
        audio.sfx("quest");
        this.toast("Nueva misión: La Cripta del Primer Canto", "#8ef0b0");
        break;
      case action === "accept_q5":
        this.questIdx = 4;
        this.questStep = 0;
        audio.sfx("quest");
        this.toast("Nueva misión: Ecos de Esperanza", "#8ef0b0");
        break;
      case action === "accept_q6":
        this.questIdx = 5;
        this.questStep = 0;
        this.flags.q6 = true;
        audio.sfx("quest");
        this.toast("Nueva misión: El Rumor del Mar", "#8ef0b0");
        break;
      case action === "accept_q7":
        this.questIdx = 6;
        this.questStep = 0;
        this.flags.q7 = true;
        audio.sfx("quest");
        this.toast("Nueva misión: La Sirena sin Canto", "#8ef0b0");
        break;
      case action === "accept_q8":
        this.questIdx = 7;
        this.questStep = 0;
        this.flags.q8 = true;
        audio.sfx("quest");
        this.toast("Nueva misión: La Aldea que Olvidó su Nombre", "#8ef0b0");
        break;
      case action === "accept_q9":
        this.questIdx = 8;
        this.questStep = 0;
        this.flags.q9 = true;
        audio.sfx("quest");
        this.toast("Nueva misión: La Cumbre del Segundo Canto", "#8ef0b0");
        break;
      case action === "accept_q10":
        this.questIdx = 9;
        this.questStep = 0;
        this.flags.q10 = true;
        audio.sfx("quest");
        this.toast("Nueva misión: Dos Voces más Fuertes", "#8ef0b0");
        break;
      case action === "fragment_touched":
        this.flags.fragmentTouched = true;
        p.hasEcho = true;
        audio.sfx("echo");
        this.burst(p.x, p.y - 8, "#ffe9a0", 24, 80);
        if (this.questIdx === 2)
          this.questAdvance();
        this.toast("Resonancia despierta: pulsa Q para alternar entre presente y pasado", "#ffe9a0");
        break;
      case action === "eco_taken":
        this.flags.ecoVoz = true;
        p.points += 1;
        p.repGuardianes += 10;
        p.hp = p.maxHp;
        if (this.questIdx === 3 && this.questStep === 2)
          this.questAdvance();
        this.toast("Eco de la Voz recuperado: +1 punto de habilidad, +10 reputación", "#ffe9a0");
        break;
      case action === "eco_mareas_taken":
        this.flags.ecoMareas = true;
        p.points += 1;
        p.repGuardianes += 10;
        p.hp = p.maxHp;
        if (this.questIdx === 6 && this.questStep === 2)
          this.questAdvance();
        this.applyAction("memory_mem_faro");
        this.toast("Eco de las Mareas recuperado: +1 punto de habilidad, +10 reputación", "#ffe9a0");
        break;
      case action === "eco_cumbres_taken":
        this.flags.ecoCumbres = true;
        p.points += 1;
        p.repGuardianes += 10;
        p.hp = p.maxHp;
        if (this.questIdx === 8 && this.questStep === 2)
          this.questAdvance();
        this.applyAction("memory_mem_invierno");
        this.toast("Eco de las Cumbres recuperado: +1 punto de habilidad, +10 reputación", "#ffe9a0");
        break;
      case action === "fragment":
        break;
      case action === "forge": {
        const cost = 30 + p.weaponPlus * 25;
        if (p.weaponPlus >= 5) {
          this.toast("Toln: «+5 es lo que da de sí esta forja, Portador.»", "#e8a");
          audio.sfx("error");
        } else if (p.gold >= cost) {
          p.gold -= cost;
          p.weaponPlus++;
          if (!this.challengeRun)
            this.stats.coronasGastadas += cost;
          audio.sfx("confirm");
          this.toast(`Arma mejorada a +${p.weaponPlus} (${cost} coronas)`, "#f0c84a");
        } else {
          this.toast(`Te faltan coronas (${cost} necesarias)`, "#e88");
          audio.sfx("error");
        }
        break;
      }
      case action === "buy_potion":
        if (p.gold >= 15) {
          p.gold -= 15;
          p.potions++;
          if (!this.challengeRun)
            this.stats.coronasGastadas += 15;
          audio.sfx("coin");
          this.toast("Poción comprada (15 coronas)", "#f0c84a");
        } else {
          this.toast("Te faltan coronas", "#e88");
          audio.sfx("error");
        }
        break;
      case action === "buy_sennuelo":
        if (p.gold >= SENNUEL.price) {
          p.gold -= SENNUEL.price;
          if (!this.challengeRun)
            this.stats.coronasGastadas += SENNUEL.price;
          this.flags.sennuelos = (Number(this.flags.sennuelos ?? 0) || 0) + 1;
          audio.sfx("coin");
          this.toast(`Señuelo de caza comprado (${SENNUEL.price} coronas) — llevas ${this.flags.sennuelos}`, "#e8c88a");
        } else {
          this.toast(`Te faltan coronas (${SENNUEL.price} necesarias)`, "#e88");
          audio.sfx("error");
        }
        break;
      case action.startsWith("armor_"): {
        const a = armorDefFor(Number(action.slice(6)));
        if (a) {
          if (this.flags[a.id]) {
            this.toast("Toln: «esa coraza ya te cubre, Portador.»", "#e88");
            audio.sfx("error");
            break;
          }
          if (a.needFlag && !this.flags[a.needFlag]) {
            this.toast("Toln: «La Guarda del Primer Canto solo la forjo para quien ha oído el tercer canto hasta el final.»", "#e88");
            audio.sfx("error");
            break;
          }
          if (p.gold >= a.cost) {
            p.gold -= a.cost;
            if (!this.challengeRun)
              this.stats.coronasGastadas += a.cost;
            this.flags[a.id] = true;
            audio.sfx("confirm");
            this.toast(`${a.name} forjada (${a.cost} coronas): daño recibido −${Math.round(a.red * 100)}%`, "#f0c84a");
          } else {
            this.toast(`Te faltan coronas (${a.cost} necesarias)`, "#e88");
            audio.sfx("error");
          }
        }
        break;
      }
      case action === "recruit_ilwen":
        if (!this.companion) {
          this.companion = this.makeCompanion();
          this.toast("Ilwen se une al grupo: cubre tu espalda con su arco", "#8ef0b0");
          audio.sfx("confirm");
        }
        break;
      case action === "rest":
        p.hp = p.maxHp;
        p.sta = p.maxSta;
        this.save();
        audio.sfx("save");
        this.toast("Descansas junto al cristal. Partida guardada. Vida restaurada.", "#8ef0ff");
        break;
      case action.startsWith("travel_"): {
        const dest = action.slice(7);
        if (MAPS[dest]) {
          this.closeDialogue();
          this.fadeTo(dest, ...this.sanctuaryPos(dest));
        }
        break;
      }
      case action === "end_demo": {
        const mins = Math.floor(p.playTime / 60), secs = Math.floor(p.playTime % 60);
        this.endStats = `Nivel ${p.level} · ${p.kills} enemigos derrotados · ${p.gold} coronas
` + `Reputación Guardianes: ${p.repGuardianes >= 0 ? "+" : ""}${p.repGuardianes} · Muertes: ${p.deaths}
` + `Tiempo de juego: ${mins}m ${secs}s · Época favorita: la que tú elijas`;
        if (this.questIdx >= 9)
          this.toast("Fin del Acto II", "#ffe9a0");
        this.save();
        this.setState("end");
        audio.playTrack("title");
        break;
      }
      case action === "close":
        this.closeDialogue();
        break;
      default:
        handleCustomAction(this, action);
        break;
    }
  }
  sanctuaryPos(id) {
    if (id === "lunaris")
      return [25, 19];
    if (id === "bosque")
      return [38, 27];
    return [19, 24];
  }
  questAdvance() {
    if (this.questStep < QUESTS[this.questIdx].steps.length - 1) {
      this.questStep++;
    } else {
      const prev = this.questIdx;
      this.questIdx = Math.min(QUESTS.length - 1, this.questIdx + 1);
      this.questStep = 0;
      this.grantQuestLoot(prev);
      if (this.questIdx !== prev)
        this.toast(`Nueva misión: ${QUESTS[this.questIdx].name}`, "#8ef0b0");
    }
    audio.sfx("quest");
  }
  grantQuestLoot(doneIdx) {
    const LOOT = {
      5: { gold: 20 },
      6: { gold: 40, potions: 1 },
      7: { gold: 35 },
      8: { gold: 50, potions: 1 },
      9: { gold: 60 }
    };
    const loot = LOOT[doneIdx];
    if (!loot || !this.player)
      return;
    if (doneIdx === 9) {
      if (this.flags.q10Paid)
        return;
      this.flags.q10Paid = true;
    }
    const p = this.player;
    p.gold += loot.gold;
    if (!this.challengeRun)
      this.stats.coronasGanadas += loot.gold;
    if (loot.potions)
      p.potions += loot.potions;
    const txt = `Recompensa: +${loot.gold} coronas${loot.potions ? " y 1 poción" : ""}`;
    this.floatAt(p.x, p.y - 26, txt, "#f0c84a", 7);
    this.toast(txt, "#f0c84a");
    audio.sfx("coin");
  }
  questProgressText() {
    if (this.questIdx === 1 && this.questStep === 0) {
      const n = Number(this.flags.wolfKills ?? 0);
      return `Caza 3 Lobos de Niebla en el sur del valle (${n}/3)`;
    }
    return null;
  }
  fadeTo(to, tx, ty) {
    this.pendingMap = { to, tx, ty };
    this.fadeDir = 1;
  }
  toast(text2, color) {
    this.toasts.push({ text: text2, t: 3.4, color });
    if (this.toasts.length > 4)
      this.toasts.shift();
  }
  floatAt(x, y, text2, color, size = 8) {
    this.floats.push({ x, y, text: text2, t: 0.9, color, vy: -26, size });
  }
  burst(x, y, color, n, spd = 60) {
    for (let i = 0;i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: 0.5 + Math.random() * 0.4, maxT: 0.9, color, size: 1 + Math.random() * 2, grav: 90 });
    }
  }
  playerDied() {
    const p = this.player;
    p.deaths++;
    if (!this.challengeRun)
      this.stats.muertes++;
    const lost = Math.floor(p.gold / 2);
    this.lastGoldLost = lost;
    if (lost > 0) {
      p.gold -= lost;
      this.deadGolds.push({ map: this.mapId, x: p.x, y: p.y, amount: lost });
    }
    if (this.companion) {
      if (this.companion.downT <= 0)
        this.companion.hp = this.companion.maxHp;
      this.toast("Ilwen te cubre la retirada...", "#8ef0b0");
    }
    audio.sfx("die");
    this.setState("dead");
  }
  respawn() {
    if (this.challengeRun) {
      onChallengeDeath(this);
      return;
    }
    const p = this.player;
    const [sx, sy] = this.sanctuaryPos(this.mapId);
    this.epoch = "presente";
    this.loadMap(this.mapId, sx, sy);
    p.hp = p.maxHp;
    p.sta = p.maxSta;
    p.res = 0;
    this.setState("play");
    audio.playTrack(this.map.music);
    this.toast("Despiertas junto al Santuario. Un eco de tu oro sigue donde caíste...", "#c8b0e8");
  }
  bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", this.onLoseFocus);
    document.addEventListener("visibilitychange", this.onLoseFocus);
    window.addEventListener("resize", this.onResize);
    this.fitCanvas();
  }
  fitCanvas() {
    const before = `${VIEW_W}x${VIEW_H}`;
    fitViewToWindow(window.innerWidth, window.innerHeight);
    if (this.canvas.width !== VIEW_W || this.canvas.height !== VIEW_H) {
      this.canvas.width = VIEW_W;
      this.canvas.height = VIEW_H;
      this.ctx.imageSmoothingEnabled = false;
    }
    if (before !== `${VIEW_W}x${VIEW_H}`)
      this.updateCamera(true);
  }
  onResize = () => {
    this.fitCanvas();
  };
  onLoseFocus = () => {
    this.keys.clear();
    this.mouse.down = false;
    this.mouse.rdown = false;
  };
  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onLoseFocus);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onLoseFocus);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mouseup", this.onMouseUp);
    this.stop();
  }
  onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    const t = e.target;
    const isDomInput = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (!isDomInput && [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
      e.preventDefault();
    if (e.repeat)
      return;
    this.keys.add(k);
    audio.resume();
    if (this.state === "title") {
      if (k === "enter" || k === "e" || k === " ") {}
    } else if (this.state === "intro") {
      if (k === "e" || k === " " || k === "enter") {
        this.introIdx++;
        audio.sfx("blip");
        if (this.introIdx >= 3)
          this.startPlay();
      }
    } else if (this.state === "dialogue") {
      if (k === "e" || k === " " || k === "enter")
        this.advanceDialogue();
      else if (k === "arrowup" || k === "w") {
        if (this.dlgNode?.options) {
          this.dlgSel = (this.dlgSel + this.dlgNode.options.length - 1) % this.dlgNode.options.length;
          audio.sfx("blip");
        }
      } else if (k === "arrowdown" || k === "s") {
        if (this.dlgNode?.options) {
          this.dlgSel = (this.dlgSel + 1) % this.dlgNode.options.length;
          audio.sfx("blip");
        }
      }
    } else if (this.state === "play") {
      if (k === " " && this.player && this.player.rollT <= 0 && this.player.attackT <= 0 && this.player.sta >= 20) {
        this.rollQueued = true;
      }
      if (k === "e")
        this.tryInteract();
      else if (k === "q")
        this.epochSwitch();
      else if (k === "escape" || k === "m") {
        this.setState("pause");
        audio.sfx("uiOpen");
      } else if (k === "f")
        this.drinkPotion();
      else if (k === "t" && e.shiftKey) {
        this.dayT = 0.22;
        this.toast("Esperas junto al camino hasta el alba...", "#ffe86a");
        audio.sfx("save");
      } else if (k === "t")
        cycleCompanionMode(this);
      else if (k === "8")
        useSenno(this);
      else if (["1", "2", "3", "4"].includes(k))
        this.useSkill(parseInt(k, 10) - 1);
      else if (k === "k") {
        this.setState("skills");
        audio.sfx("uiOpen");
      }
    } else if (this.state === "pause") {
      if (k === "escape" || k === "m")
        this.setState("play");
    } else if (this.state === "skills") {
      if (k === "escape" || k === "k" || k === "m") {
        this.setState("play");
        audio.sfx("uiOpen");
      }
    } else if (this.state === "dead") {
      if (k === "e" || k === "enter")
        this.respawn();
    } else if (this.state === "end") {
      if (k === "enter" || k === "e")
        this.setState("title");
    }
  };
  onKeyUp = (e) => {
    this.keys.delete(e.key.toLowerCase());
    if (this.player && e.key.toLowerCase() === "j" && this.player.charging) {
      this.releaseCharge();
    }
  };
  canvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (VIEW_W / r.width), y: (e.clientY - r.top) * (VIEW_H / r.height) };
  }
  onMouseMove = (e) => {
    if (!this.running)
      return;
    const p = this.canvasPos(e);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
  };
  onMouseDown = (e) => {
    if (!this.running)
      return;
    audio.resume();
    const p = this.canvasPos(e);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
    for (const h of this.uiHit) {
      if (h.state !== this.state)
        continue;
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
        audio.sfx("select");
        h.cb();
        return;
      }
    }
    if (e.button === 2) {
      this.mouse.rdown = true;
      this.startParry();
      return;
    }
    if (e.button !== 0)
      return;
    this.mouse.down = true;
    if (this.state === "dialogue")
      this.advanceDialogue();
    else if (this.state === "intro") {
      this.introIdx++;
      if (this.introIdx >= 3)
        this.startPlay();
      else
        audio.sfx("blip");
    } else if (this.state === "end")
      this.setState("title");
    else if (this.state === "play")
      this.startAttack();
  };
  onMouseUp = (e) => {
    if (!this.running)
      return;
    if (e.button === 0) {
      this.mouse.down = false;
      if (this.player?.charging)
        this.releaseCharge();
    }
    if (e.button === 2)
      this.mouse.rdown = false;
  };
  tryInteract() {
    if (rumorAfterDialogue16b(this)) {
      audio.sfx("select");
      return;
    }
    const it = this.nearestInteract();
    if (it) {
      audio.sfx("select");
      it.act();
    } else if (worldInteract(this)) {
      audio.sfx("select");
    } else if (interaccionInteract16b(this)) {
      audio.sfx("select");
    } else
      this.toast("No hay nada que interactuar aquí.", "#9aa0b8");
  }
  drinkPotion() {
    if (!this.player)
      return;
    const p = this.player;
    if (p.potions <= 0) {
      this.toast("No te quedan pociones", "#e88");
      audio.sfx("error");
      return;
    }
    if (p.hp >= p.maxHp) {
      this.toast("Vida al máximo", "#9aa0b8");
      return;
    }
    p.potions--;
    if (!this.challengeRun)
      this.stats.pocionesUsadas++;
    const heal = Math.round(p.maxHp * 0.4);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    audio.sfx("potion");
    this.floatAt(p.x, p.y - 14, `+${heal}`, "#7ef0a0");
    this.burst(p.x, p.y - 6, "#7ef0a0", 8, 30);
  }
  startAttack() {
    if (!this.player)
      return;
    const p = this.player;
    if (p.attackT > 0 || p.rollT > 0)
      return;
    p.charging = true;
    p.chargeT = 0;
  }
  releaseCharge() {
    const p = this.player;
    const wasCharging = p.charging;
    p.charging = false;
    const charged = wasCharging && p.chargeT > 0.35;
    const chargeTime = p.chargeT;
    p.chargeT = 0;
    if (!wasCharging)
      return;
    if (p.attackT > 0 || p.rollT > 0 || this.state !== "play")
      return;
    if (p.sta < 8) {
      audio.sfx("parryFail");
      return;
    }
    p.attackT = charged ? 0.4 : 0.26;
    p.combo = (p.combo + 1) % 3;
    p.sta -= charged ? 18 : 8;
    p.chargedHit = charged;
    this.aimAtMouse();
    audio.sfx(charged ? "swing2" : "swing");
    const comboMult = [1, 1.12, 1.28][p.combo];
    const dmg = playerMeleeDmg(p) * comboMult * (charged ? 2.1 : 1);
    if (charged) {
      const dirs = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
      const [dx, dy] = dirs[p.dir];
      this.aoeHit(p.x + dx * 20, p.y + dy * 20, 34, dmg, "ninguno", false);
      this.shake = 3;
      this.burst(p.x + dx * 18, p.y + dy * 18, "#ffe86a", 12, 70);
    } else {
      this.meleeHit(24, 20, dmg, "ninguno", 50);
    }
  }
  startParry() {
    if (!this.player)
      return;
    const p = this.player;
    if (this.state !== "play" || p.rollT > 0)
      return;
    if (p.sta < 12) {
      audio.sfx("parryFail");
      return;
    }
    p.sta -= 12;
    p.parryT = 0.2;
    p.parryFx = 0.32;
    audio.sfx("swing");
  }
  aimAtMouse() {
    if (!this.player)
      return;
    const p = this.player;
    const wx = this.mouse.x / ZOOM + this.camX / ZOOM;
    const wy = this.mouse.y / ZOOM + this.camY / ZOOM;
    const dx = wx - p.x, dy = wy - p.y;
    if (Math.abs(dx) > Math.abs(dy))
      p.dir = dx > 0 ? "right" : "left";
    else
      p.dir = dy > 0 ? "down" : "up";
  }
  useSkill(i) {
    if (!this.player)
      return;
    const p = this.player;
    const disc2 = SKILLS[p.discipline];
    if (i < 0 || i >= disc2.length)
      return;
    const sk = disc2[i];
    if (p.cds[i] > 0) {
      this.toast(`${sk.name}: aún en recarga`, "#9aa0b8");
      return;
    }
    if (p.res < sk.cost) {
      this.toast(`Resonancia insuficiente (${sk.cost})`, "#e88");
      audio.sfx("error");
      return;
    }
    p.res -= sk.cost;
    p.cds[i] = sk.cd * skillCdMult(p);
    this.castSkill(sk.id, sk.element);
  }
  castSkill(id, element) {
    if (!this.player)
      return;
    const p = this.player;
    this.aimAtMouse();
    const wx = this.mouse.x / ZOOM + this.camX / ZOOM;
    const wy = this.mouse.y / ZOOM + this.camY / ZOOM;
    const dx = wx - p.x, dy = wy - p.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / len, ny = dy / len;
    const spellDmg = 10 + p.attrs.int * 1.6 + p.level * 1;
    if (id !== "grito" && element !== "ninguno")
      this.lastNote = element;
    switch (id) {
      case "tajo": {
        audio.sfx("dodge");
        const dash = 34;
        this.moveEntity(p, nx * dash, ny * dash);
        this.meleeHit(26, 22, playerMeleeDmg(p) * 1.6, "ninguno", 90);
        this.burst(p.x + nx * 12, p.y + ny * 12, "#cdd3de", 8);
        break;
      }
      case "grito":
        audio.sfx("holy");
        p.buffT = 8;
        this.toast("Grito de Guerra: +50% de daño (8 s)", "#f0a050");
        this.burst(p.x, p.y - 6, "#f0a050", 14);
        break;
      case "muro":
        audio.sfx("slam");
        this.aoeHit(p.x, p.y, 44, playerMeleeDmg(p) * 1.2, "sagrado", true);
        this.waves.push({ x: p.x, y: p.y, r: 6, maxR: 46, speed: 120, dmg: 0, hit: true });
        break;
      case "filo":
        audio.sfx("holy");
        for (let k = 0;k < 3; k++) {
          window.setTimeout(() => {
            if (this.state !== "play" && this.state !== "pause")
              return;
            this.aoeHit(p.x, p.y, 60, playerMeleeDmg(p) * 1.1, "sagrado", false);
            this.waves.push({ x: p.x, y: p.y, r: 6, maxR: 64, speed: 160, dmg: 0, hit: true });
            audio.sfx("swing2");
          }, k * 180);
        }
        break;
      case "ascuas":
        audio.sfx("fire");
        this.projectiles.push({ x: p.x + nx * 8, y: p.y - 6 + ny * 8, vx: nx * 150, vy: ny * 150, t: 1.6, dmg: spellDmg, element: "fuego", from: "player", sprite: "p_fire", radius: 4, pierce: 0 });
        break;
      case "escarcha":
        audio.sfx("ice");
        this.projectiles.push({ x: p.x + nx * 8, y: p.y - 6 + ny * 8, vx: nx * 170, vy: ny * 170, t: 1.4, dmg: spellDmg * 0.9, element: "hielo", from: "player", sprite: "p_ice", radius: 4, pierce: 0 });
        break;
      case "chispa":
        audio.sfx("bolt");
        this.chainLightning(p.x, p.y - 6, spellDmg, 3, nx, ny);
        break;
      case "cantomayor": {
        const el = this.lastNote === "ninguno" ? "fuego" : this.lastNote;
        audio.sfx(el === "fuego" ? "fire" : el === "hielo" ? "ice" : "bolt");
        const wx2 = wx, wy2 = wy;
        this.aoeHit(wx2, wy2, 52, spellDmg * 2.2, el, false);
        this.waves.push({ x: wx2, y: wy2, r: 4, maxR: 56, speed: 150, dmg: 0, hit: true });
        this.burst(wx2, wy2, el === "fuego" ? "#ff9040" : el === "hielo" ? "#a0e8ff" : "#ffe86a", 24, 90);
        this.shake = 5;
        break;
      }
    }
  }
  meleeHit(reach, width, dmg, element, kb) {
    const p = this.player;
    const dirs = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = dirs[p.dir];
    const cx = p.x + dx * reach * 0.6, cy = p.y + dy * reach * 0.6;
    for (const e of this.enemies) {
      if (e.dead)
        continue;
      if (Math.hypot(e.x - cx, e.y - cy) < reach + e.w / 2 + 4) {
        this.damageEnemy(e, dmg, element, kb, dx, dy);
      }
    }
  }
  aoeHit(x, y, r, dmg, element, stun) {
    for (const e of this.enemies) {
      if (e.dead)
        continue;
      if (Math.hypot(e.x - x, e.y - y) < r + e.w / 2) {
        this.damageEnemy(e, dmg, element, 60, Math.sign(e.x - x), Math.sign(e.y - y));
        if (stun) {
          e.ai = "aturdido";
          e.aiT = 1.5;
        }
      }
    }
  }
  chainLightning(x, y, dmg, jumps, nx, ny) {
    let cx = x + nx * 14, cy = y + ny * 14;
    const hitSet = new Set;
    for (let j = 0;j < jumps; j++) {
      let best = null, bd = 90;
      for (const e of this.enemies) {
        if (e.dead || hitSet.has(e))
          continue;
        const d = Math.hypot(e.x - cx, e.y - cy);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best)
        break;
      hitSet.add(best);
      this.damageEnemy(best, dmg * (1 - j * 0.2), "rayo", 20, 0, 0);
      this.lightningFx(cx, cy, best.x, best.y);
      cx = best.x;
      cy = best.y;
    }
  }
  lightningFx(x0, y0, x1, y1) {
    const steps = 6;
    for (let i = 0;i <= steps; i++) {
      const t = i / steps;
      this.particles.push({
        x: x0 + (x1 - x0) * t + (Math.random() - 0.5) * 6,
        y: y0 + (y1 - y0) * t + (Math.random() - 0.5) * 6,
        vx: 0,
        vy: 0,
        t: 0.18,
        maxT: 0.18,
        color: "#ffe86a",
        size: 2,
        grav: 0
      });
    }
  }
  damageEnemy(e, dmg, element, kb, kbx = 0, kby = 0) {
    if (e.invulT !== undefined && e.invulT > 0) {
      this.floatAt(e.x, e.y - 16, "intangible", "#b8c8e0", 5);
      audio.sfx("wraith");
      return;
    }
    if (e.dead)
      return;
    const def = ENEMY_DEFS[e.etype];
    e.aggro = true;
    let final = dmg;
    let crit = false;
    const p = this.player;
    if (Math.random() * 100 < Math.min(40, 5 + p.attrs.des * 2)) {
      final *= 2;
      crit = true;
    }
    if (def.weakTo !== "ninguno" && element === def.weakTo)
      final *= 1.5;
    if (e.ai === "aturdido" && e.etype === "guardian")
      final *= 1.5;
    final = Math.max(1, Math.round(final));
    e.hp -= final;
    e.hitFlash = 0.12;
    if (e.maxSta > 0) {
      e.sta -= final * 1.1;
      if (e.sta <= 0 && e.ai !== "aturdido") {
        e.sta = 0;
        e.ai = "aturdido";
        e.aiT = 4;
        this.toast("¡QUEBRADO! El enemigo queda vulnerable", "#ffe86a");
        this.floatAt(e.x, e.y - 20, "QUEBRADO", "#ffe86a", 7);
        audio.sfx("roar");
      }
    }
    if (element === "fuego") {
      const b = e.statuses.find((s) => s.kind === "quemado");
      if (b) {
        b.t = Math.min(6, b.t + 3);
        b.power = Math.min(8, b.power + 2);
      } else
        e.statuses.push({ kind: "quemado", t: 3, power: 4 });
    }
    if (element === "hielo") {
      const c = e.statuses.find((s) => s.kind === "congelado");
      if (c)
        c.t = Math.min(5, c.t + 2.5);
      else
        e.statuses.push({ kind: "congelado", t: 2.5, power: 0.5 });
    }
    if (element === "hielo" && e.statuses.some((s) => s.kind === "quemado" && s.t > 1)) {
      this.aoeHit(e.x, e.y, 30, 12, "ninguno", false);
      this.floatAt(e.x, e.y - 16, "VAPOR", "#d0f0f8", 6);
      this.burst(e.x, e.y - 6, "#d0f0f8", 12);
    }
    if (kb > 0)
      this.moveEntity(e, kbx * kb * 0.06, kby * kb * 0.06);
    this.floatAt(e.x + (Math.random() - 0.5) * 8, e.y - 14, `${final}`, crit ? "#ffd24a" : "#fff");
    if (crit)
      this.floatAt(e.x, e.y - 22, "¡CRÍTICO!", "#ffd24a", 6);
    this.burst(e.x, e.y - 4, crit ? "#ffd24a" : "#f0e8e0", crit ? 10 : 5);
    audio.sfx(crit ? "crit" : "hit");
    this.hitStop = crit ? 0.09 : 0.04;
    const espMult = 1 + p.attrs.esp * 0.1;
    p.res = Math.min(p.maxRes, p.res + 6 * espMult);
    if (e.hp <= 0)
      this.killEnemy(e);
  }
  killEnemy(e) {
    e.dead = true;
    registerCorpse16b(this, e);
    bossSennoLoot16b(this, e);
    const def = ENEMY_DEFS[e.etype];
    const p = this.player;
    p.kills++;
    const espMult = 1 + p.attrs.esp * 0.1;
    p.res = Math.min(p.maxRes, p.res + 10 * espMult);
    this.gainXp(Math.max(1, Math.round(def.xp * enemyStatMult(this).xp)));
    const gold = Math.round(def.gold[0] + Math.random() * (def.gold[1] - def.gold[0]));
    p.gold += gold;
    if (!this.challengeRun) {
      this.stats.enemigosDerrotados++;
      this.stats.coronasGanadas += gold;
      if (BOSS_DEFEAT_FLAG[e.etype] !== undefined)
        this.stats.jefesDerrotados++;
      achievementTick(this);
    }
    this.floatAt(e.x, e.y - 20, `+${gold} coronas`, "#f0c84a");
    this.burst(e.x, e.y - 4, e.etype === "guardian" ? "#7ee8ff" : "#9ec4b4", e.etype === "guardian" ? 40 : 14, e.etype === "guardian" ? 120 : 60);
    audio.sfx("enemyDie");
    if (e.etype === "lobo" && this.questIdx === 1 && this.questStep === 0) {
      const n = Number(this.flags.wolfKills ?? 0) + 1;
      this.flags.wolfKills = n;
      this.toast(`Lobo de Niebla cazado (${n}/3)`, "#8ef0b0");
      if (n >= 3) {
        this.questAdvance();
        this.toast("Vuelve con la Anciana Brisa", "#8ef0b0");
      }
    }
    if (e.etype === "guardian") {
      this.flags.guardianDefeated = true;
      delete this.flags.bossHp;
      delete this.flags.bossHp_cripta;
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack("crypt");
      this.shake = 8;
      this.toast("El Guardián Hueco se deshace en notas de silencio...", "#7ee8ff");
      this.toast("El altar del Eco brilla al norte", "#ffe9a0");
      if (this.questIdx === 3 && this.questStep === 1)
        this.questAdvance();
    } else if (e.etype === "sirena") {
      this.flags.sirenaDefeated = true;
      delete this.flags.bossHp_costa;
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack("costa");
      this.shake = 8;
      audio.sfx("song");
      this.toast("La Sirena Abisal se deshace en espuma que susurra un nombre...", "#8ef0ff");
      this.toast("El altar del naufragio brilla: el Eco de las Mareas es libre", "#ffe9a0");
      p.potions += 1;
      this.floatAt(e.x, e.y - 34, "Botín del jefe: +1 poción", "#7ef0a0");
      if (this.questIdx === 6 && this.questStep === 1)
        this.questAdvance();
    } else if (e.etype === "golem") {
      this.flags.golemDefeated = true;
      delete this.flags.bossHp_cumbres;
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack("cumbres");
      this.shake = 8;
      this.toast("El Gólem de Escarcha se aquieta: las cumbres recuerdan su canto", "#a8d8ff");
      this.toast("El altar del paso brilla: el Eco de las Cumbres es libre", "#ffe9a0");
      p.gold += 30;
      this.floatAt(e.x, e.y - 34, "Botín del jefe: +30 coronas", "#f0c84a");
      if (this.questIdx === 8 && this.questStep === 1)
        this.questAdvance();
    } else if (e.etype === "vult") {
      this.flags.vultDefeated = true;
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack("cumbres");
      this.shake = 8;
      this.toast("Vult cae: su mapa se deshace y tus pasos vuelven a ser tuyos", "#c8b0e8");
      this.toast("El cartógrafo de la Liga descansará esta noche...", "#c8b0e8");
      p.potions += 1;
      p.gold += 40;
      this.floatAt(e.x, e.y - 34, "Botín del jefe: +1 poción, +40 coronas", "#f0c84a");
    } else if (e.etype === "coro") {
      this.flags.coroDefeated = true;
      this.bossActive = false;
      audio.setCombat(false);
      audio.playTrack("crypt");
      this.shake = 8;
      audio.sfx("song");
      this.toast("Las tres máscaras caen a la vez: el Coro Roto por fin descansa", "#c8b0e8");
      this.toast("La Cripta respira. Fuera del tiempo, algo agradece tu canto", "#ffe9a0");
      p.potions += 1;
      p.gold += 60;
      this.floatAt(e.x, e.y - 34, "Botín del jefe: +1 poción, +60 coronas", "#f0c84a");
    }
  }
  gainXp(xp) {
    const p = this.player;
    p.xp += xp;
    let next = this.xpNext(p.level);
    while (p.xp >= next) {
      p.xp -= next;
      p.level++;
      p.maxHp += 7;
      p.hp = p.maxHp;
      p.points += 3;
      audio.sfx("levelup");
      this.toast(`¡Nivel ${p.level}! +3 puntos de atributo (menú > Estado)`, "#ffe86a");
      this.burst(p.x, p.y - 8, "#ffe86a", 20, 70);
      next = this.xpNext(p.level);
    }
  }
  xpNext(level) {
    return Math.round(36 * Math.pow(level, 1.45));
  }
  damagePlayer(dmg, fromX, fromY) {
    const p = this.player;
    dmg = Math.max(1, Math.round(dmg * enemyStatMult(this).dmg));
    if (p.iframes > 0 || p.rollT > 0 || this.state !== "play")
      return;
    if (p.parryT > 0) {
      audio.sfx("parry");
      p.res = Math.min(p.maxRes, p.res + 20);
      p.parryFx = 0.4;
      this.hitStop = 0.12;
      this.burst(p.x + (fromX - p.x) * 0.3, p.y - 8 + (fromY - p.y) * 0.3, "#fff8c0", 14, 100);
      this.floatAt(p.x, p.y - 22, "¡PARADA!", "#fff8c0", 7);
      let best = null, bd = 34;
      for (const e of this.enemies) {
        if (e.dead)
          continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (best) {
        best.ai = "aturdido";
        best.aiT = 1.6;
        best.windup = 0;
      }
      p.parryT = 0;
      return;
    }
    const ared = armorReduction(this);
    const red = Math.min(0.5, p.attrs.vig * 0.01);
    const final = Math.max(1, Math.round(dmg * (1 - ared) * (1 - red)));
    const interposed16b = companionInterpose(this, final, fromX, fromY);
    p.hp -= final - interposed16b;
    p.iframes = 0.6;
    p.lastHitT = 0.3;
    const refl = armorActive(this)?.reflect;
    if (refl && final > 0) {
      const src = this.enemies.find((e) => !e.dead && Math.abs(e.x - fromX) < e.w / 2 + 6 && Math.abs(e.y - fromY) < e.h / 2 + 8);
      if (src) {
        this.damageEnemy(src, Math.max(1, Math.round(final * refl)), "ninguno", 0);
        this.burst(src.x, src.y - 6, "#ffe9a0", 8, 70);
      }
    }
    this.shake = 4;
    audio.sfx("hurt");
    this.floatAt(p.x, p.y - 16, `-${final}`, "#ff7060");
    const dx = p.x - fromX, dy = p.y - fromY;
    const l = Math.max(1, Math.hypot(dx, dy));
    this.moveEntity(p, dx / l * 8, dy / l * 8);
    if (p.hp <= 0)
      this.playerDied();
  }
}
function playerMeleeDmg(p) {
  const base = p.discipline === "alba" ? 12 : 8;
  const stat = p.discipline === "alba" ? p.attrs.fue * 1.5 : p.attrs.int * 1.2;
  const buff = (p.buffT ?? 0) > 0 ? 1.5 : 1;
  return (base + stat + p.level * 1 + p.weaponPlus * 2.5) * buff;
}
function playerSpellDmg(p) {
  return 10 + p.attrs.int * 1.6 + p.level;
}

// src/game/biomas_costa.ts
function h2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
var C = {
  wetSand: "#b89e6e",
  wetSandDeep: "#a08655",
  damp: "#c9b07d",
  sheen: "#ecd9a8",
  poolDeep: "#3a6a94",
  poolHi: "#6fa2c8",
  poolSpark: "#eaf6ff",
  poolRim: "#dcc590",
  poolRimSh: "#8a6f4e",
  poolRock: "#6f695c",
  pebble: PAL.pebble,
  pebbleDark: PAL.pebbleDark,
  pebbleHi: "#b8b0a0",
  shell: "#f0e8d4",
  star: "#d88a5a",
  starDark: "#b86a44",
  weed: "#4a6838",
  weedDark: "#3a5630",
  weedHi: "#5c7a44",
  rockCrack: "#43424e",
  rockHi: "#8a8a9a",
  rockMoss: "#4d6a44",
  cliffShadow: "#181c28",
  plank: PAL.woodMid,
  plankDark: PAL.woodDark,
  plankHi: PAL.woodLight,
  plankWet: PAL.plankWet,
  barnacle: "#cfc8b4",
  mist: "#d5e2ec",
  mistBlue: "#b9c9dd",
  beam: "rgba(255,243,200,",
  beamMid: "rgba(255,236,170,",
  beamEnd: "rgba(255,230,150,0)",
  gull: "#454052",
  gullTip: "#6a6474",
  gullBeak: "#e0a83c",
  call: "#e8eef4",
  hull: "#dfeef8",
  foam: PAL.foam,
  foamWash: PAL.foamWash
};
var EPOCH_FILTER = {
  presente: "saturate(0.74) contrast(0.98)",
  pasado: "saturate(1.35) brightness(1.1)"
};
function mulberry325(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var POOL_CAP2 = 14;
var S = {
  installed: false,
  builds: 0,
  t: 0,
  ticked: false,
  beamA: 0,
  staticCv: null,
  mistCv: [],
  gullCv: [],
  pools: [],
  blobsFar: [],
  blobsNear: [],
  gulls: []
};
function mkCanvas3(w, h) {
  if (typeof document === "undefined")
    return null;
  const cv2 = document.createElement("canvas");
  cv2.width = w;
  cv2.height = h;
  return cv2;
}
function curT(g) {
  return S.ticked ? S.t : g.globalT;
}
function isSolidRock(ch) {
  return ch === "R" || ch === "#";
}
function buildStatic(x) {
  const map = MAPS.costa;
  const { w: W, h: H } = map;
  const rows = map.rows;
  const busy = new Set;
  for (const pr of map.props)
    busy.add(pr.x + "," + pr.y);
  for (const ch of map.chests)
    busy.add(ch.x + "," + ch.y);
  for (const ec of map.echoes)
    busy.add(ec.x + "," + ec.y);
  const chAt = (tx, ty) => ty < 0 || ty >= H || tx < 0 || tx >= W ? "V" : rows[ty][tx];
  const nearWater = (tx, ty, d) => {
    for (let j = -d;j <= d; j++)
      for (let i = -d;i <= d; i++) {
        if (chAt(tx + i, ty + j) === "~")
          return true;
      }
    return false;
  };
  for (let ty = 0;ty < H; ty++) {
    for (let tx = 0;tx < W; tx++) {
      const ch = chAt(tx, ty);
      if (isSolidRock(ch)) {
        const r = h2(tx * 7 + 1, ty * 13 + 5);
        if (r > 0.62) {
          const x0 = tx * TILE + 2 + Math.floor(h2(tx, ty * 3) * 11);
          let y0 = ty * TILE + 2;
          const segs = 2 + Math.floor(r * 3);
          x.globalAlpha = 0.55;
          for (let k = 0;k < segs; k++) {
            px(x, x0 + (k % 2 === 0 ? 0 : 1), y0, 1, 4, C.rockCrack);
            y0 += 4;
          }
          x.globalAlpha = 1;
        }
        if (!isSolidRock(chAt(tx, ty + 1)) && chAt(tx, ty + 1) !== "~") {
          const r2 = h2(tx * 3 + 9, ty * 5 + 2);
          x.globalAlpha = 0.5;
          px(x, tx * TILE + 2 + Math.floor(r2 * 10), ty * TILE + TILE - 3, 3, 1, C.rockMoss);
          if (r2 > 0.5)
            px(x, tx * TILE + 9 - Math.floor(r2 * 5), ty * TILE + TILE - 2, 2, 1, C.rockMoss);
          x.globalAlpha = 1;
        }
        continue;
      }
      if (ch === "~" || ch === "B" || ch === "x")
        continue;
      if (isSolidRock(chAt(tx, ty - 1))) {
        x.globalAlpha = 0.3;
        px(x, tx * TILE, ty * TILE, TILE, 3, C.cliffShadow);
        x.globalAlpha = 0.16;
        px(x, tx * TILE, ty * TILE + 3, TILE, 3, C.cliffShadow);
        x.globalAlpha = 1;
      }
      if (isSolidRock(chAt(tx - 1, ty))) {
        x.globalAlpha = 0.18;
        px(x, tx * TILE, ty * TILE, 3, TILE, C.cliffShadow);
        x.globalAlpha = 1;
      }
      if (isSolidRock(chAt(tx + 1, ty))) {
        x.globalAlpha = 0.12;
        px(x, tx * TILE + TILE - 2, ty * TILE, 2, TILE, C.cliffShadow);
        x.globalAlpha = 1;
      }
    }
  }
  for (let ty = 0;ty < H; ty++) {
    for (let tx = 0;tx < W; tx++) {
      const ch = chAt(tx, ty);
      if (ch !== "s")
        continue;
      const down = chAt(tx, ty + 1), right = chAt(tx + 1, ty);
      const up = chAt(tx, ty - 1), left = chAt(tx - 1, ty);
      const lvl1 = down === "~" || right === "~" || up === "~" || left === "~";
      const lvl2 = !lvl1 && nearWater(tx, ty, 2);
      const px0 = tx * TILE, py0 = ty * TILE;
      if (lvl1) {
        x.globalAlpha = 0.34;
        px(x, px0, py0, TILE, TILE, C.wetSand);
        if (down === "~") {
          x.globalAlpha = 0.3;
          px(x, px0, py0 + 10, TILE, 6, C.wetSandDeep);
        }
        if (right === "~") {
          x.globalAlpha = 0.3;
          px(x, px0 + 10, py0, 6, TILE, C.wetSandDeep);
        }
        if (up === "~") {
          x.globalAlpha = 0.3;
          px(x, px0, py0, TILE, 6, C.wetSandDeep);
        }
        if (left === "~") {
          x.globalAlpha = 0.3;
          px(x, px0, py0, 6, TILE, C.wetSandDeep);
        }
        x.globalAlpha = 0.5;
        if (down === "~")
          for (let i = 0;i < 5; i++) {
            px(x, px0 + Math.floor(h2(tx * 5 + i, ty) * 16), py0 + Math.floor(h2(tx, ty * 7 + i) * 3), 1, 1, C.damp);
          }
        if (up === "~")
          for (let i = 0;i < 5; i++) {
            px(x, px0 + Math.floor(h2(tx * 7 + i, ty * 3) * 16), py0 + 13 + Math.floor(h2(tx * 3, ty + i) * 3), 1, 1, C.damp);
          }
        if (left === "~")
          for (let i = 0;i < 5; i++) {
            px(x, px0 + 13 + Math.floor(h2(tx * 11, ty + i) * 3), py0 + Math.floor(h2(tx + i, ty * 5) * 16), 1, 1, C.damp);
          }
        if (right === "~")
          for (let i = 0;i < 5; i++) {
            px(x, px0 + Math.floor(h2(tx * 13, ty * 9 + i) * 3), py0 + Math.floor(h2(tx * 9 + i, ty) * 16), 1, 1, C.damp);
          }
        for (let k = 0;k < 3; k++) {
          const hx = h2(tx * 5 + k * 11, ty * 7 + k * 3);
          const hy = h2(tx * 11 + k, ty * 5 + k * 13);
          x.globalAlpha = 0.4;
          px(x, px0 + 2 + Math.floor(hx * 10), py0 + 2 + Math.floor(hy * 12), 3 + Math.floor(hx * 3), 1, C.sheen);
        }
        x.globalAlpha = 1;
      } else if (lvl2) {
        x.globalAlpha = 0.14;
        px(x, px0, py0, TILE, TILE, C.damp);
        if (h2(tx * 13 + 2, ty * 3 + 8) > 0.6) {
          x.globalAlpha = 0.3;
          px(x, px0 + 3 + Math.floor(h2(tx, ty * 9) * 9), py0 + 4 + Math.floor(h2(tx * 9, ty) * 9), 3, 1, C.sheen);
        }
        x.globalAlpha = 1;
      } else {
        for (let k = 0;k < 2; k++) {
          const ry = py0 + 3 + k * 6 + Math.floor(h2(tx * 3 + k, ty * 7) * 4);
          x.globalAlpha = 0.16;
          px(x, px0 + 1 + Math.floor(h2(tx + k, ty * 3) * 4), ry, 7 + Math.floor(h2(tx * 5, ty + k) * 6), 1, "#cbb078");
          x.globalAlpha = 0.1;
          px(x, px0 + 2 + Math.floor(h2(tx * 7, ty + k * 3) * 5), ry + 1, 5, 1, "#bfa575");
        }
        x.globalAlpha = 1;
      }
    }
  }
  S.pools.length = 0;
  for (let ty = 2;ty < H - 1; ty++) {
    for (let tx = 2;tx < W - 1; tx++) {
      if (S.pools.length >= POOL_CAP2)
        break;
      const ch = chAt(tx, ty);
      if (ch !== "s" || busy.has(tx + "," + ty))
        continue;
      if (chAt(tx, ty + 1) !== "~" && chAt(tx + 1, ty) !== "~")
        continue;
      if (chAt(tx, ty) === "=" || chAt(tx - 1, ty) === "=" || chAt(tx, ty - 1) === "=")
        continue;
      const gate = h2(tx * 3 + 7, ty * 5 + 11);
      if (gate < 0.8)
        continue;
      let far = false;
      for (const p of S.pools) {
        if (Math.abs(p.tx - tx) < 3 && Math.abs(p.ty - ty) < 3) {
          far = true;
          break;
        }
      }
      if (far)
        continue;
      const r = 3 + Math.floor(h2(tx * 9, ty * 7) * 3);
      const cx = px0of(tx) + 4 + Math.floor(h2(tx * 5, ty * 11) * (TILE - 8 - r));
      const cy = px0of(ty) + 4 + Math.floor(h2(tx * 11, ty * 3) * (TILE - 8 - r));
      const prof = [Math.floor(r * 0.5), r, r + 1, r + 1, r, Math.floor(r * 0.5)];
      x.globalAlpha = 1;
      px(x, cx - prof[0] - 1, cy - 3, prof[0] * 2 + 2, 1, C.poolRim);
      for (let k = 0;k < prof.length; k++) {
        px(x, cx - prof[k], cy + k - 2, prof[k] * 2, 1, k === 0 ? C.poolHi : C.poolDeep);
      }
      px(x, cx - prof[5] - 1, cy + 3, prof[5] * 2 + 2, 1, C.poolRimSh);
      x.globalAlpha = 0.8;
      px(x, cx - 1 + Math.floor(h2(tx, ty * 17) * 3), cy, 2, 1, C.poolRock);
      x.globalAlpha = 1;
      S.pools.push({ tx, ty, x: cx, y: cy, r, ph: h2(tx * 7, ty * 13) * 6.283 });
    }
  }
  for (let ty = 2;ty < H - 2; ty++) {
    for (let tx = 2;tx < W - 2; tx++) {
      const ch = chAt(tx, ty);
      if (ch !== "s" && ch !== "." && ch !== ",")
        continue;
      if (!nearWater(tx, ty, 3))
        continue;
      const px0 = px0of(tx), py0 = px0of(ty);
      const r1 = h2(tx * 17 + 3, ty * 23 + 5);
      const r2 = h2(tx * 29 + 1, ty * 19 + 7);
      if (r1 > 0.86) {
        const n = 3 + Math.floor(r2 * 3);
        for (let k = 0;k < n; k++) {
          const ox = px0 + 1 + Math.floor(h2(tx * 7 + k * 5, ty * 3 + k) * (TILE - 4));
          const oy = py0 + 1 + Math.floor(h2(tx * 3 + k, ty * 7 + k * 5) * (TILE - 4));
          x.globalAlpha = 0.9;
          px(x, ox, oy, 2, 1, k % 2 === 0 ? C.pebble : C.pebbleDark);
          px(x, ox, oy - 1, 1, 1, C.pebbleHi);
          x.globalAlpha = 0.35;
          px(x, ox, oy + 1, 2, 1, C.cliffShadow);
          x.globalAlpha = 1;
        }
      } else if (ch === "s" && r2 > 0.86) {
        const ox = px0 + 3 + Math.floor(r1 * 8), oy = py0 + 6 + Math.floor(h2(tx * 3, ty) * 6);
        px(x, ox, oy, 4, 1, C.weedDark);
        px(x, ox + 1, oy - 1, 2, 1, C.weed);
        px(x, ox + 3, oy - 1, 1, 1, C.weed);
        px(x, ox + 2, oy - 2, 1, 1, C.weedHi);
        if (r1 > 0.93) {
          px(x, ox - 2, oy, 2, 1, C.weedDark);
          px(x, ox - 1, oy - 1, 1, 1, C.weed);
        }
      } else if (ch === "s" && r2 < 0.022) {
        const ox = px0 + 5 + Math.floor(r1 * 6), oy = py0 + 5 + Math.floor(h2(tx, ty) * 6);
        x.globalAlpha = 0.9;
        px(x, ox, oy - 1, 1, 3, "#cf9a70");
        px(x, ox - 1, oy, 3, 1, "#cf9a70");
        px(x, ox, oy, 1, 1, "#b8764e");
        x.globalAlpha = 1;
      }
    }
  }
  for (let ty = 0;ty < H; ty++) {
    for (let tx = 0;tx < W; tx++) {
      const ch = chAt(tx, ty);
      if (ch !== "B" && ch !== "x")
        continue;
      const px0 = px0of(tx), py0 = px0of(ty);
      for (let k = 0;k < 3; k++) {
        const hy = py0 + 2 + k * 4 + Math.floor(h2(tx * 5 + k, ty * 9) * 3);
        const hx = px0 + Math.floor(h2(tx * 11 + k * 3, ty * 5) * 6);
        const len = 4 + Math.floor(h2(tx * 3 + k, ty * 13 + k) * 6);
        x.globalAlpha = 0.5;
        px(x, hx, hy, len, 1, C.plankDark);
        x.globalAlpha = 0.35;
        px(x, hx + 1, hy - 1, Math.max(2, len - 2), 1, C.plankHi);
        x.globalAlpha = 1;
      }
      if (chAt(tx, ty + 1) === "~") {
        x.globalAlpha = 0.42;
        px(x, px0, py0 + TILE - 2, TILE, 2, C.plankWet);
        x.globalAlpha = 1;
        for (let k = 0;k < 3; k++) {
          if (h2(tx * 7 + k * 13, ty * 3 + k) < 0.6)
            continue;
          px(x, px0 + 1 + Math.floor(h2(tx + k, ty * 5 + k) * 13), py0 + TILE - 3, 1, 1, C.barnacle);
        }
      }
      if (chAt(tx - 1, ty) === "~") {
        x.globalAlpha = 0.42;
        px(x, px0, py0, 2, TILE, C.plankWet);
        x.globalAlpha = 1;
      }
      if (chAt(tx + 1, ty) === "~") {
        x.globalAlpha = 0.42;
        px(x, px0 + TILE - 2, py0, 2, TILE, C.plankWet);
        x.globalAlpha = 1;
      }
    }
  }
  const rng2 = mulberry325(18412);
  const wcx = 41, wcy = 22;
  for (let dy = -3;dy <= 3; dy++) {
    for (let dx = -3;dx <= 3; dx++) {
      const tx = wcx + dx, ty = wcy + dy;
      const ch = chAt(tx, ty);
      if (ch === "V" || ch === "~")
        continue;
      if (isSolidRock(ch) || ch === "=" || ch === "B" || ch === "x")
        continue;
      if (dx === 0 && dy === 0)
        continue;
      const gate = rng2();
      if (gate > 0.55)
        continue;
      const cx = tx * TILE + 3 + Math.floor(rng2() * (TILE - 8));
      const cy = ty * TILE + 3 + Math.floor(rng2() * (TILE - 8));
      x.save();
      x.translate(cx + 4, cy + 1);
      x.rotate((rng2() - 0.5) * 0.7);
      const len = 6 + Math.floor(rng2() * 7);
      x.globalAlpha = 0.95;
      px(x, -len / 2, 0, len, 2, C.plank);
      px(x, -len / 2, 0, len, 1, C.plankHi);
      px(x, -len / 2, 2, len, 1, C.plankDark);
      if (rng2() > 0.5)
        px(x, len / 2 - 2, 0, 2, 2, C.plankWet);
      x.globalAlpha = 1;
      x.restore();
    }
  }
  for (let k = 0;k < 4; k++) {
    const bx = (wcx - 1) * TILE + 2 + k * 9;
    const by = (wcy + 1) * TILE + 6 + k % 2 * 3;
    x.globalAlpha = 0.85;
    px(x, bx, by, 3, 2, C.plankWet);
    px(x, bx + 2, by - 2, 2, 2, C.plankDark);
    px(x, bx + 3, by - 4, 2, 2, C.plankWet);
    x.globalAlpha = 0.4;
    px(x, bx, by + 2, 4, 1, C.cliffShadow);
    x.globalAlpha = 1;
  }
  for (let dy = -2;dy <= 2; dy++) {
    for (let dx = 0;dx <= 3; dx++) {
      const tx = wcx + dx, ty = wcy + dy;
      if (chAt(tx, ty) !== "~")
        continue;
      const g2 = h2(tx * 31 + 7, ty * 17 + 3);
      if (g2 < 0.62)
        continue;
      const fx = tx * TILE + 2 + Math.floor(g2 * 8), fy = ty * TILE + 3 + Math.floor(h2(tx, ty * 7) * 10);
      px(x, fx, fy, 6, 2, C.plankDark);
      px(x, fx, fy, 6, 1, C.plank);
      px(x, fx - 1, fy + 1, 1, 1, C.foam);
      px(x, fx + 6, fy + 1, 1, 1, C.foam);
    }
  }
}
function px0of(t) {
  return t * TILE;
}
function buildMist(variant) {
  const cv2 = mkCanvas3(150, 40);
  if (!cv2)
    return null;
  const x = cv2.getContext("2d");
  const rng2 = mulberry325(7700 + variant * 131);
  x.globalAlpha = 0.22;
  x.fillStyle = variant % 2 === 0 ? C.mist : C.mistBlue;
  x.beginPath();
  x.ellipse(75, 24, 66, 11, 0, 0, Math.PI * 2);
  x.fill();
  x.globalAlpha = 0.18;
  x.beginPath();
  x.ellipse(58 + variant * 6, 18, 40, 8, 0, 0, Math.PI * 2);
  x.fill();
  x.globalAlpha = 0.16;
  x.beginPath();
  x.ellipse(96 - variant * 4, 27, 34, 6, 0, 0, Math.PI * 2);
  x.fill();
  x.globalAlpha = 0.12;
  x.beginPath();
  x.ellipse(75, 13, 26, 5, 0, 0, Math.PI * 2);
  x.fill();
  x.globalAlpha = 0.1;
  for (let k = 0;k < 14; k++) {
    const ox = 12 + rng2() * 126, oy = rng2() < 0.5 ? 8 + rng2() * 6 : 30 + rng2() * 6;
    x.fillRect(Math.floor(ox), Math.floor(oy), 2 + Math.floor(rng2() * 3), 1);
  }
  x.globalAlpha = 1;
  return cv2;
}
function buildGull(frame) {
  const cv2 = mkCanvas3(18, 10);
  if (!cv2)
    return null;
  const x = cv2.getContext("2d");
  px(x, 6, 4, 6, 2, C.gull);
  px(x, 3, 5, 3, 1, C.gull);
  px(x, 12, 3, 2, 2, C.gull);
  px(x, 14, 4, 1, 1, C.gullBeak);
  if (frame === 0) {
    px(x, 5, 3, 2, 1, C.gull);
    px(x, 3, 2, 2, 1, C.gull);
    px(x, 1, 1, 2, 1, C.gullTip);
    px(x, 11, 3, 2, 1, C.gull);
    px(x, 13, 2, 2, 1, C.gull);
    px(x, 15, 1, 2, 1, C.gullTip);
  } else {
    px(x, 5, 5, 2, 1, C.gull);
    px(x, 3, 6, 2, 1, C.gull);
    px(x, 1, 7, 2, 1, C.gullTip);
    px(x, 11, 5, 2, 1, C.gull);
    px(x, 13, 6, 2, 1, C.gull);
    px(x, 15, 7, 2, 1, C.gullTip);
  }
  return cv2;
}
function install() {
  if (S.installed)
    return;
  S.installed = true;
  S.builds++;
  const cv2 = mkCanvas3(MAPS.costa.w * TILE, MAPS.costa.h * TILE);
  if (cv2) {
    const x = cv2.getContext("2d");
    x.imageSmoothingEnabled = false;
    buildStatic(x);
    S.staticCv = cv2;
  }
  S.mistCv.length = 0;
  for (let v = 0;v < 3; v++) {
    const m = buildMist(v);
    if (m)
      S.mistCv.push(m);
  }
  S.gullCv.length = 0;
  for (let f = 0;f < 2; f++) {
    const gl = buildGull(f);
    if (gl)
      S.gullCv.push(gl);
  }
  const rng2 = mulberry325(90210);
  S.blobsFar.length = 0;
  for (let i = 0;i < 6; i++) {
    S.blobsFar.push({
      seed: rng2() * 1800,
      y: (14 + rng2() * 10) * TILE,
      sc: 1.25 + rng2() * 0.5,
      sp: 5 + rng2() * 3,
      a: 0.1 + rng2() * 0.05,
      ph: rng2() * 6.283,
      v: i % 3
    });
  }
  S.blobsNear.length = 0;
  for (let i = 0;i < 4; i++) {
    S.blobsNear.push({
      seed: rng2() * 1800,
      y: (32.5 + rng2() * 6) * TILE,
      sc: 0.9 + rng2() * 0.4,
      sp: 9 + rng2() * 5,
      a: 0.13 + rng2() * 0.06,
      ph: rng2() * 6.283,
      v: i % 3
    });
  }
  for (let i = 0;i < 2; i++) {
    S.blobsNear.push({
      seed: rng2() * 1800,
      y: (24 + rng2() * 7) * TILE,
      sc: 0.9 + rng2() * 0.4,
      sp: 8 + rng2() * 5,
      a: 0.12 + rng2() * 0.05,
      ph: rng2() * 6.283,
      v: (i + 1) % 3
    });
  }
  for (let i = 0;i < 3; i++) {
    S.blobsNear.push({
      seed: 41 * TILE - 70 + i * 55 + rng2() * 20,
      y: (20.5 + rng2() * 3.5) * TILE,
      sc: 0.75 + rng2() * 0.3,
      sp: 3 + rng2() * 2.5,
      a: 0.15 + rng2() * 0.05,
      ph: rng2() * 6.283,
      v: (i + 2) % 3
    });
  }
  S.gulls.length = 0;
  for (let i = 0;i < 4; i++) {
    const far = i < 2;
    S.gulls.push({
      x0: rng2() * 1800,
      y0: (4 + rng2() * (far ? 14 : 16)) * TILE,
      sp: (far ? 20 + rng2() * 8 : 30 + rng2() * 10) * (rng2() > 0.5 ? 1 : -1),
      ph: rng2() * 6.283,
      sc: far ? 0.6 : 1
    });
  }
}
function initCostaBioma() {
  install();
}
function costaBiomaTick(g, dt) {
  if (g.mapId !== "costa")
    return;
  install();
  S.ticked = true;
  S.t = Math.min(S.t + dt, 86400);
  S.beamA = (S.beamA + dt * 0.35) % (Math.PI * 2);
}
function drawCostaBiomaGround(g, sx, sy) {
  if (g.mapId !== "costa" || !S.installed || !S.staticCv)
    return;
  const ctx = g.ctx;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const t = curT(g);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.filter = EPOCH_FILTER[g.epoch] ?? "none";
  const gx = Math.floor(camX / ZOOM), gy = Math.floor(camY / ZOOM);
  ctx.drawImage(S.staticCv, gx, gy, VIEW_W / ZOOM, VIEW_H / ZOOM, 0, 0, VIEW_W, VIEW_H);
  ctx.restore();
  const sxp = sx ?? ((wx) => wx * ZOOM - camX);
  const syp = sy ?? ((wy) => wy * ZOOM - camY);
  const map = g.map;
  const tx0 = Math.max(0, Math.floor(camX / (TILE * ZOOM)) - 1);
  const ty0 = Math.max(0, Math.floor(camY / (TILE * ZOOM)) - 1);
  const tx1 = Math.min(map.w - 1, Math.ceil((camX + VIEW_W) / (TILE * ZOOM)));
  const ty1 = Math.min(map.h - 1, Math.ceil((camY + VIEW_H) / (TILE * ZOOM)));
  ctx.fillStyle = C.foam;
  for (let ty = ty0;ty <= ty1; ty++) {
    for (let tx = tx0;tx <= tx1; tx++) {
      const ch = tileAt(map, g.rows, tx, ty, g.epoch);
      if (ch === "~") {
        const up = tileAt(map, g.rows, tx, ty - 1, g.epoch);
        const left = tileAt(map, g.rows, tx - 1, ty, g.epoch);
        if (up !== "s" && left !== "s")
          continue;
        const ph = h2(tx, ty) * 6.283;
        const adv = Math.sin(t * 0.9 + ph);
        if (up === "s") {
          ctx.globalAlpha = 0.28 + 0.2 * (0.5 + 0.5 * adv);
          ctx.fillRect(Math.round(sxp(tx * TILE)), Math.round(syp(ty * TILE + 1 + adv * 1.2)), TILE, 1);
          const fy = ty * TILE + 2 + adv * 2.4;
          ctx.globalAlpha = 0.5 + 0.28 * adv;
          const march = (t * 5 + h2(tx * 3, ty) * 12) % 16;
          for (let k = 0;k < 3; k++) {
            const dx = k * 6 + march * 0.4 + h2(tx + k, ty) * 2;
            if (dx > TILE - 2)
              continue;
            ctx.fillRect(Math.round(sxp(tx * TILE + dx)), Math.round(syp(fy)), 5, 1);
          }
          ctx.fillStyle = C.foamWash;
          ctx.globalAlpha = 0.28 + 0.14 * Math.sin(t * 0.9 + ph + 1.1);
          const fy2 = ty * TILE + 4 + Math.sin(t * 0.9 + ph + 1.1) * 2.6;
          for (let k = 0;k < 2; k++) {
            const dx = k * 9 + (t * 3.4 + h2(tx, ty * 3) * 10) % 12;
            if (dx > TILE - 3)
              continue;
            ctx.fillRect(Math.round(sxp(tx * TILE + dx)), Math.round(syp(fy2)), 5, 1);
          }
          ctx.fillStyle = C.foam;
        }
        if (left === "s") {
          ctx.globalAlpha = 0.26 + 0.18 * (0.5 + 0.5 * adv);
          ctx.fillRect(Math.round(sxp(tx * TILE + 1 + adv * 1.2)), Math.round(syp(ty * TILE)), 1, TILE);
          const fx2 = tx * TILE + 2 + adv * 2.4;
          ctx.globalAlpha = 0.45 + 0.25 * adv;
          const march = (t * 4 + h2(tx, ty * 5) * 10) % 14;
          for (let k = 0;k < 3; k++) {
            const dy2 = k * 5 + march * 0.35 + h2(tx, ty + k) * 2;
            if (dy2 > TILE - 2)
              continue;
            ctx.fillRect(Math.round(sxp(fx2)), Math.round(syp(ty * TILE + dy2)), 1, 4);
          }
        }
      } else if (ch === "s") {
        const below = tileAt(map, g.rows, tx, ty + 1, g.epoch);
        const right = tileAt(map, g.rows, tx + 1, ty, g.epoch);
        if (below !== "~" && right !== "~")
          continue;
        const pw = below === "~" ? [tx, ty + 1] : [tx + 1, ty];
        const ph = h2(pw[0], pw[1]) * 6.283;
        const adv = Math.sin(t * 0.9 + ph);
        ctx.fillStyle = C.sheen;
        ctx.globalAlpha = 0.05 + 0.15 * (0.5 - 0.5 * adv);
        for (let k = 0;k < 3; k++) {
          const hy = ty * TILE + 2 + k * 5 + Math.cos(t * 1.2 + ph + k) * 1.4;
          const hx = tx * TILE + 2 + h2(tx * 3 + k, ty * 7 + k) * 8;
          ctx.fillRect(Math.round(sxp(hx)), Math.round(syp(hy)), 3 + Math.floor(h2(tx + k, ty) * 4), 1);
        }
        ctx.fillStyle = C.foam;
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.poolHi;
  for (let i = 0;i < S.pools.length; i++) {
    const p = S.pools[i];
    if (p.tx < tx0 || p.tx > tx1 || p.ty < ty0 || p.ty > ty1)
      continue;
    const w1 = Math.sin(t * 0.8 + p.ph);
    ctx.globalAlpha = 0.1 + 0.14 * (0.5 + 0.5 * w1);
    const ry = p.y + w1 * 1.2;
    ctx.fillRect(Math.round(sxp(p.x - p.r * 0.5)), Math.round(syp(ry)), p.r + 2, 1);
    ctx.globalAlpha *= 0.7;
    ctx.fillRect(Math.round(sxp(p.x - p.r * 0.3)), Math.round(syp(ry + 2)), Math.max(2, p.r - 2), 1);
    if (Math.sin(t * 1.7 + p.ph * 2.7) > 0.86) {
      ctx.fillStyle = C.poolSpark;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(Math.round(sxp(p.x + Math.cos(p.ph) * p.r * 0.4)), Math.round(syp(ry - 1)), 1, 1);
      ctx.fillStyle = C.poolHi;
    }
  }
  for (let ty = ty0;ty <= ty1; ty++) {
    for (let tx = tx0;tx <= tx1; tx++) {
      if (tileAt(map, g.rows, tx, ty, g.epoch) !== "B")
        continue;
      ctx.fillStyle = C.plankHi;
      ctx.globalAlpha = 0.08 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.1 + h2(tx, ty) * 6.283));
      ctx.fillRect(Math.round(sxp(tx * TILE)), Math.round(syp(ty * TILE + 1)), TILE, 1);
      if (tileAt(map, g.rows, tx, ty + 1, g.epoch) === "~") {
        ctx.fillStyle = C.foam;
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 0.9 + h2(tx, ty + 1) * 6.283);
        ctx.fillRect(Math.round(sxp(tx * TILE + 2)), Math.round(syp((ty + 1) * TILE)), TILE - 6, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}
function drawCostaBiomaOverlay(g) {
  if (g.mapId !== "costa" || !S.installed)
    return;
  const ctx = g.ctx;
  const camX = Math.round(g.camX), camY = Math.round(g.camY);
  const t = curT(g);
  const worldW = MAPS.costa.w * TILE * ZOOM;
  const dayLight = Math.max(0.1, Math.sin(g.dayT * Math.PI * 2) * 1.25 + 0.25);
  const night = 1 - Math.min(1, dayLight);
  ctx.imageSmoothingEnabled = false;
  drawMistLayers(g, ctx, t, camX, camY, worldW, night);
  drawGulls(g, ctx, t, camX, camY, worldW);
  drawFaroBeam(g, ctx, t, camX, camY, night);
  drawWreckGlint(g, ctx, t, camX, camY);
  ctx.globalAlpha = 1;
}
function drawMistLayers(g, ctx, t, camX, camY, worldW, night) {
  if (S.mistCv.length === 0)
    return;
  const span = worldW + 520;
  const nightK = 0.85 + night * 0.35;
  for (let layer = 0;layer < 2; layer++) {
    const blobs = layer === 0 ? S.blobsFar : S.blobsNear;
    const par = layer === 0 ? 0.25 : 0.55;
    const kMul = layer === 0 ? 0.62 : 1;
    for (let i = 0;i < blobs.length; i++) {
      const b = blobs[i];
      const cv2 = S.mistCv[b.v % S.mistCv.length];
      const drift = (b.seed + t * b.sp) * ZOOM - camX * par;
      const sxp = (drift % span + span) % span - 260;
      const syp = b.y * ZOOM - camY * (par * 0.7 + 0.3) + Math.sin(t * 0.3 + b.ph) * 5;
      if (sxp < -240 || sxp > VIEW_W + 40 || syp < -70 || syp > VIEW_H + 40)
        continue;
      const w = cv2.width * b.sc, h = cv2.height * b.sc;
      ctx.globalAlpha = Math.min(0.24, b.a * kMul * nightK * (0.75 + 0.25 * Math.sin(t * 0.35 + b.ph)));
      ctx.drawImage(cv2, Math.round(sxp), Math.round(syp), w, h);
    }
  }
  ctx.globalAlpha = 1;
}
function drawGulls(g, ctx, t, camX, camY, worldW) {
  if (S.gullCv.length < 2)
    return;
  const span = worldW + 340;
  for (let i = 0;i < S.gulls.length; i++) {
    const gl = S.gulls[i];
    const drift = (gl.x0 + t * gl.sp) * ZOOM - camX;
    const sxp = (drift % span + span) % span - 170;
    const syp = gl.y0 * ZOOM - camY + Math.sin(t * 1.1 + gl.ph) * 6;
    if (sxp < -60 || sxp > VIEW_W + 60 || syp < -40 || syp > VIEW_H + 40)
      continue;
    const fr = Math.floor(t * 2.6 + gl.ph * 2) % 2;
    const w = 18 * ZOOM * gl.sc, h = 10 * ZOOM * gl.sc;
    ctx.globalAlpha = gl.sc < 1 ? 0.55 : 0.85;
    ctx.drawImage(S.gullCv[fr], Math.round(sxp), Math.round(syp), w, h);
    const cp = (t * 0.14 + gl.ph) % 1;
    if (cp < 0.18) {
      const k = cp / 0.18;
      const cxp = sxp + w * 0.55, cyp = syp + h * 0.45;
      ctx.strokeStyle = C.call;
      ctx.lineWidth = 1;
      ctx.globalAlpha = (1 - k) * 0.45;
      ctx.beginPath();
      ctx.arc(cxp, cyp, 3 + k * 9, -2.4, -0.7);
      ctx.stroke();
      if (k < 0.5) {
        ctx.globalAlpha = (0.5 - k) * 0.6;
        ctx.beginPath();
        ctx.arc(cxp, cyp, 2 + k * 5, -2.2, -0.9);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}
function drawFaroBeam(g, ctx, t, camX, camY, night) {
  let fx = -1, fy = -1;
  for (const pr of g.map.props) {
    if (pr.id === "faro_co" || pr.kind === "faro") {
      fx = pr.x * TILE + 8;
      fy = pr.y * TILE + 8;
      break;
    }
  }
  if (fx < 0)
    return;
  const lx = fx * ZOOM - camX, ly = (fy - 34) * ZOOM - camY;
  if (lx < -720 || lx > VIEW_W + 720 || ly < -160 || ly > VIEW_H + 720)
    return;
  const ang = S.ticked ? S.beamA : t * 0.35;
  const aBase = 0.045 + night * 0.19;
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = "lighter";
  const cone = (L, W1, a) => {
    const grad = ctx.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, C.beam + a.toFixed(3) + ")");
    grad.addColorStop(0.45, C.beamMid + (a * 0.5).toFixed(3) + ")");
    grad.addColorStop(0.8, C.beamMid + (a * 0.18).toFixed(3) + ")");
    grad.addColorStop(1, C.beamEnd);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(L, -W1);
    ctx.lineTo(L, W1);
    ctx.lineTo(0, 7);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-L, -W1);
    ctx.lineTo(-L, W1);
    ctx.lineTo(0, 7);
    ctx.closePath();
    ctx.fill();
  };
  cone(560, 112, aBase * 0.5);
  cone(500, 46, aBase);
  ctx.restore();
}
function drawWreckGlint(g, ctx, t, camX, camY) {
  let wx = -1, wy = -1;
  for (const pr of g.map.props) {
    if (pr.id === "wreck_co" || pr.kind === "wreck") {
      wx = pr.x * TILE + 8;
      wy = pr.y * TILE + 8;
      break;
    }
  }
  if (wx < 0)
    return;
  const sxp = wx * ZOOM - camX, syp = wy * ZOOM - camY;
  if (sxp < -80 || sxp > VIEW_W + 80 || syp < -40 || syp > VIEW_H + 40)
    return;
  const ph = (t / 6.5 + 0.35) % 1;
  const k = Math.sin(ph * Math.PI);
  const k3 = k * k * k;
  if (k3 < 0.04)
    return;
  const wl = (wy + 12) * ZOOM - camY;
  ctx.fillStyle = C.hull;
  for (let i = 0;i < 3; i++) {
    const ox = [-15, -4, 10][i] + Math.sin(t * 2.1 + i * 2.4) * 1.5;
    const oy = [0, 3, -2][i];
    ctx.globalAlpha = k3 * 0.5;
    ctx.fillRect(Math.round(sxp + ox * ZOOM), Math.round(wl + oy * ZOOM), 3, 1);
  }
  ctx.fillStyle = C.foam;
  ctx.globalAlpha = k3 * 0.22;
  ctx.fillRect(Math.round(sxp - 18 * ZOOM), Math.round(wl + 3), 15 * ZOOM, 1);
}

// scripts/preview_costa.ts
var VIEW_W2 = 960;
var VIEW_H2 = 540;
function main() {
  const cv2 = document.getElementById("screen");
  if (!cv2)
    return;
  cv2.width = VIEW_W2;
  cv2.height = VIEW_H2;
  const ctx = cv2.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const map = MAPS.costa;
  const rows = [];
  for (let y = 0;y < map.h; y++)
    rows.push(map.rows[y] ?? "");
  const ground = document.createElement("canvas");
  ground.width = map.w * TILE;
  ground.height = map.h * TILE;
  const gx = ground.getContext("2d");
  gx.imageSmoothingEnabled = false;
  for (let ty = 0;ty < map.h; ty++) {
    for (let tx = 0;tx < map.w; tx++) {
      const ch = tileAt(map, rows, tx, ty, "presente");
      if (!drawExpansionTile(gx, ch, tx, ty, "costa")) {
        drawTile(gx, ch, tx, ty, "costa", 0, (dx, dy) => tileAt(map, rows, tx + dx, ty + dy, "presente"));
      }
    }
  }
  for (let ty = 0;ty < map.h; ty++) {
    for (let tx = 0;tx < map.w; tx++) {
      const ch = tileAt(map, rows, tx, ty, "presente");
      if (ch === "p")
        drawExpansionTallTile(gx, ch, tx, ty, "costa");
    }
  }
  const fake = {
    mapId: "costa",
    map,
    rows,
    epoch: "presente",
    camX: 300,
    camY: 640,
    ctx,
    globalT: 0,
    dayT: 0.5
  };
  initCostaBioma();
  let t = 0;
  const props = map.props;
  const q = new URLSearchParams(location.search);
  const fixed = q.has("x");
  let night = q.get("night") === "1";
  function frame() {
    t += 1 / 60;
    fake.globalT = t;
    fake.dayT = night ? 0.02 : 0.5;
    costaBiomaTick(fake, 1 / 60);
    if (fixed) {
      fake.camX = Math.round(Number(q.get("x") ?? "300"));
      fake.camY = Math.round(Number(q.get("y") ?? "640"));
    } else {
      const loop = t * 26 % 2600;
      fake.camX = Math.round(240 + (loop < 1300 ? loop : 2600 - loop));
      fake.camY = Math.round(600 + Math.sin(t * 0.1) * 90);
    }
    ctx.fillStyle = "#0c0a14";
    ctx.fillRect(0, 0, VIEW_W2, VIEW_H2);
    const sx = (wx) => wx * ZOOM - fake.camX;
    const sy = (wy) => wy * ZOOM - fake.camY;
    ctx.drawImage(ground, Math.floor(fake.camX / ZOOM), Math.floor(fake.camY / ZOOM), VIEW_W2 / ZOOM, VIEW_H2 / ZOOM, 0, 0, VIEW_W2, VIEW_H2);
    drawCostaBiomaGround(fake);
    for (const pr of props) {
      if (pr.kind === "faro")
        drawExpansionProp(ctx, "faro", sx(pr.x * TILE + 8), sy(pr.y * TILE + 8), ZOOM, t, true);
      if (pr.kind === "wreck")
        drawExpansionProp(ctx, "wreck", sx(pr.x * TILE + 8), sy(pr.y * TILE + 8), ZOOM, t, false);
    }
    drawCostaBiomaOverlay(fake);
    requestAnimationFrame(frame);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "n" || e.key === "N")
      night = !night;
  });
  requestAnimationFrame(frame);
}
main();
