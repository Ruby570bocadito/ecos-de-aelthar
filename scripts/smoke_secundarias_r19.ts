// ============================================================
// 19-a (misiones secundarias) — Smoke sin navegador
// Stub DOM/Audio (patrón scripts/smoke_timeskip.ts 29-92) + Game real.
// Verifica: (1) los 3 QuestDefs (sq4/sq5/sq6, steps ≥ 2), (2) los 30 nodos de
// diálogo (name/portrait/text, encadenado next/options válido y alcanzable,
// acciones whitelisted, sin colisión de claves con DIALOGUES), (3) NPCs y
// props: coordenadas dentro del mapa, sobre tiles transitables en AMBAS
// épocas, con vecino 4-dir pisable, sin pisar entidades existentes e
// instalación idempotente en MAPS, (4) flujo accept→progreso→recompensa con
// Game real (una sola secundaria en curso, recompensa UNA vez, weaponPlus
// exacto, tomo_canto, ruteo sqDialogueR19, etiquetas), (5) cero NaN en ticks
// en varios estados + reparación de flags corruptas.
// Ejecutar: bun scripts/smoke_secundarias_r19.ts
// ============================================================

// ---------- stub universal (igual que smoke_timeskip.ts) ----------
type AnyP = Record<string | symbol, unknown>;
const noop = () => stub();
function stub(): any {
  return new Proxy(noop, {
    get: (_t, prop) => {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'toString') return () => '';
      if (prop === 'valueOf') return () => 0;
      if (prop === 'width' || prop === 'height') return 300;
      if (prop === 'length') return 0;
      return stub();
    },
    set: () => true,
    apply: () => stub(),
  }) as unknown as AnyP;
}
const ctxStub = () => {
  const gradient = { addColorStop: noop };
  return {
    canvas: null,
    imageSmoothingEnabled: false,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    drawImage: noop, fillText: noop, setTransform: noop, rect: noop, clip: noop,
    drawFocusIfNeeded: noop,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
  } as unknown as CanvasRenderingContext2D;
};
const makeCanvas = (): HTMLCanvasElement => {
  return {
    width: 300, height: 150, style: {},
    getContext: (_: string) => ctxStub(),
    addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
  } as unknown as HTMLCanvasElement;
};

const store = new Map<string, string>();
(globalThis as AnyP).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null, length: 0,
};
const listeners: AnyP = {};
(globalThis as AnyP).window = {
  addEventListener: (t: string, f: unknown) => { (listeners[t] ??= []).push(f); },
  removeEventListener: noop,
  innerWidth: 1280, innerHeight: 720,
  setInterval: () => 0, clearInterval: noop, setTimeout: () => 0,
  AudioContext: undefined, webkitAudioContext: undefined,
} as unknown as Window & typeof globalThis;
(globalThis as AnyP).document = {
  createElement: () => makeCanvas(),
  getElementById: () => makeCanvas(),
  addEventListener: noop,
  body: stub(),
  documentElement: stub(),
} as unknown as Document;
(globalThis as AnyP).performance = { now: () => Date.now() };
(globalThis as AnyP).requestAnimationFrame = () => 0;
(globalThis as AnyP).cancelAnimationFrame = noop;

// ---------- imports SOLO tras el stub ----------
const { Game } = await import('../src/game/engine');
const { audio } = await import('../src/game/audio');
(audio as unknown as { init: () => void; ctx: unknown }).init = () => {};
(audio as unknown as { ctx: unknown }).ctx = stub();

const { MAPS, tileAt } = await import('../src/game/maps');
const { SOLID_CHARS } = await import('../src/game/sprites');
const { DIALOGUES } = await import('../src/game/data');
const SQ = await import('../src/game/sidequests_r19');

// ---------- simulación del CABLEADO DEL INTEGRADOR ----------
// hooks.handleCustomAction (hooks.ts:59) delegará 1ª línea: `if (sqActionR19(g, action)) return true;`
// engine.applyAction cae en default → handleCustomAction (engine.ts:1235). Aquí
// se reproduce EXACTAMENTE ese comportamiento en el prototipo para probar la
// ruta completa sin editar ficheros ajenos:
const origApplyAction = Game.prototype.applyAction;
Game.prototype.applyAction = function (this: G, action: string) {
  if (SQ.sqActionR19(this, action)) return; // 19-a: consumida (como hooks hará)
  origApplyAction.call(this, action);
} as typeof Game.prototype.applyAction;

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

type G = InstanceType<typeof Game>;
type Player = NonNullable<G['player']>;

/** XP total proxy (misma fórmula que engine.xpNext) para medir ganancias. */
function totalXp(p: Player): number {
  let t = p.xp;
  for (let l = 1; l < p.level; l++) t += Math.round(36 * Math.pow(l, 1.45));
  return t;
}

function newGame(): G {
  const g = new Game(makeCanvas());
  SQ.initSecundariasR19(); // como engine.ts:210 (antes de cualquier loadMap)
  g.newGame('Prueba19a', 'alba');
  g.startPlay();
  g.enemies.length = 0; // determinismo: sin patrullas mordiendo el flujo
  return g;
}

function toastHas(g: G, sub: string): boolean {
  return g.toasts.some(t => t.text.includes(sub));
}

// ============================================================
console.log('=== 1) QUESTDEFS: sq4 / sq5 / sq6 bien formados ===');
{
  const qs = SQ.SQ_R19_QUESTS;
  if (qs.length === 3) ok('3 QuestDefs exportados');
  else bad(`QuestDefs: ${qs.length} (se esperaban 3)`);
  for (const [i, id] of ['sq4', 'sq5', 'sq6'].entries()) {
    const q = qs.find(x => x.id === id);
    if (!q) { bad(`falta el QuestDef ${id}`); continue; }
    if (q.name && q.name.length > 3) ok(`${id} «${q.name}»: nombre evocador`);
    else bad(`${id}: nombre vacío/corto`);
    if (q.steps.length >= 2 && q.steps.length <= 4 && q.steps.every(s => s.length > 8))
      ok(`${id}: ${q.steps.length} pasos con objetivo claro`);
    else bad(`${id}: steps malformados (${q.steps.length})`);
    if (qs.indexOf(q) === i) ok(`${id} en posición ${i} (orden estable)`);
  }
  // cero Math.random en el módulo + mulberry32 presente (regla de la ronda;
  // se ignoran comentarios para no detectar la PROHIBICIÓN documentada)
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/game/sidequests_r19.ts', import.meta.url), 'utf8')
    .replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (!src.includes('Math.random')) ok('cero Math.random en el código del módulo');
  else bad('el módulo usa Math.random');
  if (src.includes('mulberry32')) ok('mulberry32 local con semilla fija presente');
  else bad('falta mulberry32 en el módulo');
}

// ============================================================
console.log('\n=== 2) DIÁLOGOS: 30 nodos, cadena válida y alcanzable ===');
{
  const D = SQ.SQ_R19_DIALOGUES;
  const keys = Object.keys(D);
  if (keys.length === 30) ok(`30 nodos de diálogo (${keys.filter(k => k.startsWith('sq4')).length} sq4 · ${keys.filter(k => k.startsWith('sq5')).length} sq5 · ${keys.filter(k => k.startsWith('sq6')).length} sq6)`);
  else bad(`nodos: ${keys.length} (se esperaban 30)`);
  const ACTIONS_OK = new Set(['accept_sq4', 'accept_sq5', 'accept_sq6', 'sq4_reward', 'sq5_reward', 'sq6_reward']);
  let malformed = 0, badNext = 0, badAction = 0;
  for (const [k, n] of Object.entries(D)) {
    if (!n.name || !n.portrait || !n.text || n.text.length < 40) { malformed++; bad(`nodo ${k}: name/portrait/text incompletos`); }
    for (const o of n.options ?? []) {
      if (!o.text) { malformed++; bad(`nodo ${k}: opción sin texto`); }
      if (o.next && !(o.next in D)) { badNext++; bad(`nodo ${k}: next '${o.next}' inexistente`); }
      if (o.action && !ACTIONS_OK.has(o.action)) { badAction++; bad(`nodo ${k}: action '${o.action}' fuera de whitelist`); }
    }
    if (n.next && !(n.next in D)) { badNext++; bad(`nodo ${k}: next '${n.next}' inexistente`); }
    if (n.onEnd && !ACTIONS_OK.has(n.onEnd)) { badAction++; bad(`nodo ${k}: onEnd '${n.onEnd}' fuera de whitelist`); }
  }
  if (malformed === 0 && badNext === 0 && badAction === 0) ok('encadenado next/options/onEnd válido y con tonos (0 defectos)');
  // alcanzabilidad por quest desde las raíces del ruteo (intro/progress/listo/done/busy)
  for (const [qid, nid] of [['sq4', 'iria'], ['sq5', 'odrik'], ['sq6', 'erev']] as const) {
    const roots = [`${qid}_${nid}_intro`, `${qid}_${nid}_progress`, `${qid}_${nid}_listo`, `${qid}_${nid}_done`, `${qid}_${nid}_busy`];
    const seen = new Set<string>();
    const queue = [...roots.filter(r => r in D)];
    while (queue.length) {
      const cur = queue.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const node = D[cur];
      for (const o of node.options ?? []) if (o.next) queue.push(o.next);
      if (node.next) queue.push(node.next);
    }
    const mine = keys.filter(k => k.startsWith(qid + '_'));
    if (mine.every(k => seen.has(k))) ok(`${qid}: los ${mine.length} nodos alcanzables (diálogo + ruteo)`);
    else bad(`${qid}: nodos inalcanzables: ${mine.filter(k => !seen.has(k)).join(', ')}`);
  }
  // R19-int: el Object.assign de data.ts YA registró las claves → deben ESTAR
  // (la aserción pre-integración comprobaba la ausencia).
  const clash = keys.filter(k => !(k in DIALOGUES));
  if (clash.length === 0) ok('integración real: las 30 claves están en DIALOGUES (Object.assign de data.ts)');
  else bad(`claves NO registradas en DIALOGUES: ${clash.join(', ')}`);
  // tonos usados (biblia: el Portador moldea)
  const tones = new Set<string>();
  for (const n of Object.values(D)) for (const o of n.options ?? []) if (o.tone) tones.add(o.tone);
  if (['empatico', 'pragmatico', 'amenazante', 'sarcastico'].every(t => tones.has(t)))
    ok(`los 4 ToneKind presentes (${tones.size})`);
  else bad(`tonos incompletos: ${[...tones].join(', ')}`);
}

// ============================================================
console.log('\n=== 3) NPCs/PROPS: coordenadas legales + instalación idempotente ===');
{
  const SOLID = SOLID_CHARS;
  const walkable = (mapId: string, x: number, y: number): boolean => {
    const m = (MAPS as Record<string, typeof MAPS.lunaris>)[mapId];
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    return !SOLID.has(tileAt(m, m.rows, x, y, 'presente')) && !SOLID.has(tileAt(m, m.rows, x, y, 'pasado'));
  };
  let legal = 0, illegal = 0;
  const spotTaken = (mapId: string, x: number, y: number, self: string): boolean => {
    const m = (MAPS as Record<string, typeof MAPS.lunaris>)[mapId];
    const all: [string, number, number][] = [
      ...m.npcs.map(n => [`npc:${n.id}`, n.x, n.y] as [string, number, number]),
      ...m.chests.map(c => [`chest:${c.id}`, c.x, c.y] as [string, number, number]),
      ...m.echoes.map(e => [`echo:${e.id}`, e.x, e.y] as [string, number, number]),
      ...m.props.map(p => [`prop:${p.id}`, p.x, p.y] as [string, number, number]),
      ...m.spawns.map(s => [`spawn:${s.type}`, s.x, s.y] as [string, number, number]),
    ];
    return all.some(([tag, tx, ty]) => tx === x && ty === y && !tag.endsWith(self));
  };
  for (const [key, { map, def }] of Object.entries(SQ.SQ_R19_NPCS)) {
    if (!walkable(map, def.x, def.y)) { illegal++; bad(`NPC ${key}: tile sólido o fuera de mapa (${map} ${def.x},${def.y})`); continue; }
    if (!([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => walkable(map, def.x + dx, def.y + dy))) {
      illegal++; bad(`NPC ${key}: sin vecino pisable (encerrado)`); continue;
    }
    if (spotTaken(map, def.x, def.y, def.id)) { illegal++; bad(`NPC ${key}: pisa una entidad existente`); continue; }
    legal++;
  }
  for (const [key, { map, def }] of Object.entries(SQ.SQ_R19_PROPS)) {
    if (!walkable(map, def.x, def.y)) { illegal++; bad(`prop ${key}: tile sólido o fuera de mapa (${map} ${def.x},${def.y})`); continue; }
    if (!([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => walkable(map, def.x + dx, def.y + dy))) {
      illegal++; bad(`prop ${key}: sin vecino pisable (encerrado)`); continue;
    }
    if (spotTaken(map, def.x, def.y, def.id)) { illegal++; bad(`prop ${key}: pisa una entidad existente`); continue; }
    legal++;
  }
  if (illegal === 0) ok(`11 posiciones legales (${legal}/11 transitables en ambas épocas, con acceso y sin pisar nada)`);
  // instalación: MAPS reciben NPCs/props y repetir NO duplica
  SQ.instalarSecundariasR19();                      // 1ª llamada: instala
  const beforeN = (m: string) => (MAPS as Record<string, typeof MAPS.lunaris>)[m].npcs.length + (MAPS as Record<string, typeof MAPS.lunaris>)[m].props.length;
  const snap = ['costa', 'aldea', 'cripta', 'cumbres', 'bosque'].map(beforeN);
  SQ.instalarSecundariasR19(); SQ.instalarSecundariasR19(); // 2 veces más: nada
  const snap2 = ['costa', 'aldea', 'cripta', 'cumbres', 'bosque'].map(beforeN);
  if (snap.every((v, i) => v === snap2[i])) ok('instalación idempotente (3 llamadas → mismo tamaño)');
  else bad(`la instalación duplica: ${snap} → ${snap2}`);
  const has = (m: string, id: string, arr: 'npcs' | 'props') =>
    (MAPS as Record<string, typeof MAPS.lunaris>)[m][arr].some(x => x.id === id);
  if (has('costa', 'iria', 'npcs') && has('aldea', 'odrik', 'npcs') && has('cripta', 'erev', 'npcs')
    && has('costa', 'sq4_c1', 'props') && has('cumbres', 'sq5_v1', 'props') && has('bosque', 'sq6_l1', 'props')
    && has('costa', 'sq6_l2', 'props') && has('aldea', 'sq6_l3', 'props'))
    ok('MAPS contienen los 3 NPCs y los 8 props tras instalar');
  else bad('faltan NPCs/props en MAPS tras instalar');
}

// ============================================================
console.log('\n=== 4) FLUJO REAL sq4: accept → campanas → recompensa UNA vez ===');
{
  const g = newGame();
  const p = g.player!;
  const prop = (id: string) => SQ.SQ_R19_PROPS[id].def;
  // etiquetas antes de aceptar: nada
  if (SQ.sqPropLabelR19(g, prop('sq4_c1')) === null) ok('sqPropLabelR19 → null con la quest sin aceptar');
  else bad('la etiqueta aparece sin quest activa');
  if (SQ.sqPropTargetR19(g) === null) ok('sqPropTargetR19 → null sin quest activa');
  else bad('target sin quest activa');
  // ruteo: intro
  const ctx0 = { questIdx: 0, questStep: 0, flags: g.flags, companion: false };
  if (SQ.sqDialogueR19('iria', ctx0) === 'sq4_iria_intro') ok('ruteo limpio → sq4_iria_intro');
  else bad(`ruteo limpio: ${SQ.sqDialogueR19('iria', ctx0)}`);
  // aceptar
  g.applyAction('accept_sq4');
  if (g.flags.accept_sq4 === true && g.flags.sq4 === true && Number(g.flags.sq4_step) === 0)
    ok('accept_sq4: flags.accept_sq4/sq4/sq4_step=0');
  else bad(`accept_sq4: ${String(g.flags.accept_sq4)}/${String(g.flags.sq4)}/${String(g.flags.sq4_step)}`);
  if (toastHas(g, 'Nueva misión secundaria: La Marea que Fue Canción')) ok('toast de misión secundaria');
  else bad('sin toast de aceptación');
  // «una sola secundaria en curso»
  g.toasts.length = 0;
  g.applyAction('accept_sq5');
  if (g.flags.sq5 === undefined && toastHas(g, 'Termínala primero'))
    ok('regla «una sola»: accept_sq5 rechazado con toast «Termínala primero»');
  else bad(`accept_sq5 debería rechazarse (sq5=${String(g.flags.sq5)}, toasts=${g.toasts.map(t => t.text).join('|')})`);
  // proximidad: target solo si el Portador está al lado
  g.loadMap('costa', 12, 27); g.enemies.length = 0;
  p.x = 12 * 16 + 8; p.y = 28 * 16 + 8;
  const t1 = SQ.sqPropTargetR19(g);
  if (t1 && t1.id === 'sq4_c1') ok(`sqPropTargetR19 junto a la campana oeste → ${t1.id}`);
  else bad(`target junto a campana: ${String(t1?.id)}`);
  if (SQ.sqPropLabelR19(g, prop('sq4_c1')) === 'Recoger campana de bruma') ok('etiqueta «Recoger campana de bruma» activa');
  else bad(`etiqueta campana: ${String(SQ.sqPropLabelR19(g, prop('sq4_c1')))}`);
  // recoger 1/3
  g.toasts.length = 0;
  if (SQ.sqPropUseR19(g, prop('sq4_c1')) === true && g.flags.sq4_c1 === true && Number(g.flags.sq4_step) === 0)
    ok('campana oeste recogida (1/3, step 0)');
  else bad('sqPropUseR19 no consumió la campana oeste');
  if (toastHas(g, 'Campana de bruma recuperada (1/3)')) ok('toast de progreso (1/3)');
  else bad('sin toast de progreso');
  if (SQ.sqPropUseR19(g, prop('sq4_c1')) === false) ok('reusar la misma campana NO consume (anti-doble)');
  else bad('la campana se pudo recoger dos veces');
  // recoger 2 y 3 → step 1
  SQ.sqPropUseR19(g, prop('sq4_c2'));
  g.toasts.length = 0;
  SQ.sqPropUseR19(g, prop('sq4_c3'));
  if (Number(g.flags.sq4_step) === 1 && toastHas(g, 'Guardiana Iria'))
    ok('3/3 campanas → sq4_step 1 + toast de vuelta');
  else bad(`objetivo no completa (step=${String(g.flags.sq4_step)})`);
  if (SQ.sqPropLabelR19(g, prop('sq4_c2')) === null) ok('etiqueta → null en fase de vuelta');
  else bad('la etiqueta sigue activa en fase de vuelta');
  // recompensa UNA vez
  const gold0 = p.gold, pot0 = p.potions, xp0 = totalXp(p);
  g.applyAction('sq4_reward');
  const dGold = p.gold - gold0, dPot = p.potions - pot0, dXp = totalXp(p) - xp0;
  if (dGold === 150 && dPot === 1 && dXp === 120 && g.flags.sq4_done === true && g.flags.sq4 === false)
    ok(`recompensa exacta: +${dGold} coronas +${dPot} poción +${dXp} XP (sq4_done, sq4 off)`);
  else bad(`recompensa mal: oro ${dGold}, pociones ${dPot}, xp ${dXp}`);
  g.applyAction('sq4_reward'); // segunda vez = no-op
  if (p.gold - gold0 === 150 && p.potions - pot0 === 1 && totalXp(p) - xp0 === 120)
    ok('segunda llamada a sq4_reward = no-op (recompensa UNA vez)');
  else bad('la recompensa se cobró dos veces');
  // ruteo post-recompensa
  if (SQ.sqDialogueR19('iria', { ...ctx0, flags: g.flags }) === 'sq4_iria_done') ok('ruteo → done tras cobrar');
  else bad(`ruteo post-reward: ${SQ.sqDialogueR19('iria', { ...ctx0, flags: g.flags })}`);
}

// ============================================================
console.log('\n=== 5) FLUJO REAL sq5: vetas → arma +1 exacta (y tope +5) ===');
{
  const g = newGame();
  const p = g.player!;
  const prop = (id: string) => SQ.SQ_R19_PROPS[id].def;
  g.applyAction('accept_sq5');
  if (g.flags.sq5 === true && Number(g.flags.sq5_step) === 0) ok('accept_sq5 → activa, paso 0');
  else bad(`accept_sq5 no activó (sq5=${String(g.flags.sq5)})`);
  if (SQ.sqPropLabelR19(g, prop('sq5_v1')) === 'Extraer veta de hierro-niebla') ok('etiqueta «Extraer veta de hierro-niebla»');
  else bad(`etiqueta veta: ${String(SQ.sqPropLabelR19(g, prop('sq5_v1')))}`);
  g.toasts.length = 0;
  SQ.sqPropUseR19(g, prop('sq5_v1'));
  if (toastHas(g, 'Veta de hierro-niebla extraída (1/2)')) ok('progreso (1/2)');
  else bad('sin toast (1/2)');
  SQ.sqPropUseR19(g, prop('sq5_v2'));
  if (Number(g.flags.sq5_step) === 1) ok('2/2 vetas → step 1');
  else bad(`vetas no completan (step=${String(g.flags.sq5_step)})`);
  const gold0 = p.gold, wp0 = p.weaponPlus;
  g.applyAction('sq5_reward');
  if (p.weaponPlus === wp0 + 1 && p.gold - gold0 === 80 && g.flags.sq5_done === true)
    ok(`arma +1 exacta (${wp0}→${p.weaponPlus}) y +80 coronas`);
  else bad(`sq5_reward: wp ${wp0}→${p.weaponPlus}, oro +${p.gold - gold0}`);
  g.applyAction('sq5_reward');
  if (p.weaponPlus === wp0 + 1 && p.gold - gold0 === 80) ok('segunda sq5_reward = no-op');
  else bad('sq5_reward duplica');
  // variante tope: yunque ya en +5 → compensa en coronas
  const g2 = newGame();
  const p2 = g2.player!;
  g2.flags.sq5 = true; g2.flags.sq5_step = 1; g2.flags.sq5_v1 = true; g2.flags.sq5_v2 = true;
  p2.weaponPlus = 5;
  const gold2 = p2.gold;
  g2.applyAction('sq5_reward');
  if (p2.weaponPlus === 5 && p2.gold - gold2 === 140 && g2.flags.sq5_done === true)
    ok('tope +5: sin subida de arma, compensación +140 coronas');
  else bad(`tope +5: wp=${p2.weaponPlus}, oro +${p2.gold - gold2}`);
}

// ============================================================
console.log('\n=== 6) FLUJO REAL sq6: lámparas → tomo_canto + XP (y vía lightLamp) ===');
{
  const g = newGame();
  const p = g.player!;
  const prop = (id: string) => SQ.SQ_R19_PROPS[id].def;
  // ocupada de nuevo: con sq4 ya cobrada, accept_sq6 debe ir limpio
  g.applyAction('accept_sq6');
  if (g.flags.sq6 === true) ok('tras cobrar sq4, accept_sq6 pasa (una en curso, no dos)');
  else bad('accept_sq6 rechazado sin causa');
  const gold0 = p.gold, xp0 = totalXp(p);
  SQ.sqPropUseR19(g, prop('sq6_l1')); // bosque
  SQ.sqPropUseR19(g, prop('sq6_l2')); // costa
  SQ.sqPropUseR19(g, prop('sq6_l3')); // aldea
  if (Number(g.flags.sq6_step) === 1) ok('3/3 lámparas → step 1');
  else bad(`lámparas no completan (step=${String(g.flags.sq6_step)})`);
  g.applyAction('sq6_reward');
  if (g.flags.tomo_canto === true && p.gold - gold0 === 100 && totalXp(p) - xp0 === 200 && g.flags.sq6_done === true)
    ok(`tomo_canto=true · +100 coronas · +${totalXp(p) - xp0} XP`);
  else bad(`sq6_reward: tomo=${String(g.flags.tomo_canto)}, oro +${p.gold - gold0}, xp +${totalXp(p) - xp0}`);
  // vía de RECUPERACIÓN: el motor enciende por su rama 'lamp' (lightLamp) y el
  // tick reconcilia — con flags puestas a mano, el tick avanza el paso.
  const g3 = newGame();
  g3.flags.sq6 = true; g3.flags.sq6_step = 0;
  g3.flags.sq6_l1 = true; g3.flags.sq6_l2 = true; g3.flags.sq6_l3 = true;
  g3.toasts.length = 0;
  for (let i = 0; i < 5; i++) SQ.secundariasTickR19(g3, 0.016);
  if (Number(g3.flags.sq6_step) === 1 && toastHas(g3, 'vuelve con el Custodio Erev'))
    ok('recuperación: tick reconcilia lámparas encendidas por el motor → step 1');
  else bad(`tick no reconcilió (step=${String(g3.flags.sq6_step)})`);
}

// ============================================================
console.log('\n=== 7) RUTEO + ETIQUETAS + BUSY por NPC ===');
{
  const f: Record<string, number | boolean> = {};
  const ctx = { questIdx: 3, questStep: 0, flags: f, companion: false };
  if (SQ.sqDialogueR19('odrik', ctx) === 'sq5_odrik_intro') ok('odrik limpio → intro');
  else bad('ruteo odrik limpio falla');
  f.sq4 = true; // otra secundaria en curso
  if (SQ.sqDialogueR19('odrik', ctx) === 'sq5_odrik_busy' && SQ.sqDialogueR19('erev', ctx) === 'sq6_erev_busy')
    ok('«una sola en curso»: odrik y erev derivan a su nodo busy');
  else bad('el ruteo busy no se dispara');
  f.sq4 = false; f.sq6 = true; f.sq6_step = 0;
  if (SQ.sqDialogueR19('erev', ctx) === 'sq6_erev_progress' && SQ.sqDialogueR19('iria', ctx) === 'sq4_iria_busy')
    ok('activa → progress (dueña) y busy (la otra)');
  else bad('ruteo progress/busy mixto falla');
  f.sq6_step = 1;
  if (SQ.sqDialogueR19('erev', ctx) === 'sq6_erev_listo') ok('objetivo completo → nodo listo');
  else bad('ruteo listo falla');
  f.sq6_done = true;
  if (SQ.sqDialogueR19('erev', ctx) === 'sq6_erev_done') ok('done tiene prioridad sobre todo');
  else bad('ruteo done falla');
  if (SQ.sqDialogueR19('brisa', ctx) === null) ok('NPC ajenos → null (no secuestra el ruteo)');
  else bad('sqDialogueR19 secuestra un nid ajeno');
  // etiquetas de NPC (contrato): el motor ya etiqueta, se expone igual
  const g = newGame();
  g.loadMap('costa', 12, 27); g.enemies.length = 0; // Iria vive en la costa
  const iria = g.npcs.find(n => n.nid === 'iria');
  if (!iria) bad('la NPC Iria no apareció en costa (spawnNpcs no la vio)');
  else if (SQ.sqNpcLabelR19(g, iria) === 'Hablar con Guardiana Iria') ok('sqNpcLabelR19(Iria) exacto');
  else bad(`etiqueta Iria: ${String(SQ.sqNpcLabelR19(g, iria))}`);
  const ajena = g.npcs.find(n => n.nid === 'mara'); // NPC de costa que no es mía
  if (ajena && SQ.sqNpcLabelR19(g, ajena) === null) ok('sqNpcLabelR19(Mara) → null');
  else bad('sqNpcLabelR19 secuestra NPCs ajenos');
}

// ============================================================
console.log('\n=== 8) TICKS sin NaN en varios estados + reparación de flags ===');
{
  // estado 'title' sin jugador
  const gT = new Game(makeCanvas());
  SQ.secundariasTickR19(gT, 0.016);
  ok('tick en estado title sin jugador: sin lanzar');
  // juego real en 'play' y 'dialogue'
  const g = newGame();
  g.applyAction('accept_sq4');
  let threw: string | null = null;
  try {
    for (let i = 0; i < 600; i++) {
      SQ.secundariasTickR19(g, 0.016);
      if (i === 300) g.setState('dialogue');
      if (i === 450) g.setState('play');
    }
  } catch (e) { threw = String(e); }
  if (threw === null) ok('600 ticks en play/dialogue sin lanzar');
  else bad(`tick lanzó: ${threw}`);
  // challengeRun: guard — con la quest activa y TODO recogido, el tick NO
  // debe reconciliar (la arena no toca la campaña)
  const gC = newGame();
  (gC as unknown as { challengeRun: unknown }).challengeRun = { arena: true };
  gC.flags.sq4 = true; gC.flags.sq4_step = 0;
  gC.flags.sq4_c1 = true; gC.flags.sq4_c2 = true; gC.flags.sq4_c3 = true;
  SQ.secundariasTickR19(gC, 0.016);
  if (Number(gC.flags.sq4_step) === 0) ok('challengeRun: el tick no reconcilia la campaña');
  else bad('el tick opera dentro del desafío');
  // flags corruptas: NaN y basura se reparan sin lanzar
  const gN = newGame();
  gN.flags.sq4 = true; gN.flags.sq4_step = NaN; gN.flags.sq4_c1 = true;
  SQ.secundariasTickR19(gN, 0.016);
  const st = Number(gN.flags.sq4_step);
  if (Number.isFinite(st) && (st === 0 || st === 1)) ok(`NaN reparado → ${st}`);
  else bad(`NaN no reparado: ${String(gN.flags.sq4_step)}`);
  gN.flags.sq5_step = 42;
  SQ.secundariasTickR19(gN, 0.016);
  if (Number(gN.flags.sq5_step) === 0) ok('step fuera de rango (42) reparado → 0');
  else bad('step fuera de rango sin reparar');
  // sin NaN en ningún flag del juego tras todo el flujo
  const nanFlags = Object.entries(g.flags).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v));
  if (nanFlags.length === 0) ok('cero flags NaN tras la batería completa');
  else bad(`flags NaN: ${nanFlags.map(([k]) => k).join(', ')}`);
}

console.log(fails === 0 ? '\nSMOKE SECUNDARIAS R19: TODO OK' : `\nSMOKE SECUNDARIAS R19: ${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
