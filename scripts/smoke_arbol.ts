// ============================================================
// 12-b (árbol-habilidades) — Smoke del árbol SIN navegador (bun)
// Ejercita el contrato completo del módulo skilltree con el Game
// real: carga persistente, pasivas, equipaje en huecos, magias
// nuevas (castNewSkill vía puente y directa), herramientas (activateTool
// y teclas 5/6/7 por flanco), Eco del Filo y pantalla del árbol.
// ============================================================

// ---------- stub universal (mismo patrón que smoke_motor_acto2) ----------
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
    canvas: null, imageSmoothingEnabled: false,
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    drawImage: noop, fillText: noop, setTransform: noop, rect: noop, clip: noop,
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    createPattern: () => null, measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData: noop,
  } as unknown as CanvasRenderingContext2D;
};
const makeCanvas = (): HTMLCanvasElement => ({
  width: 300, height: 150, style: {},
  getContext: (_: string) => ctxStub(),
  addEventListener: noop, removeEventListener: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
} as unknown as HTMLCanvasElement);

const store = new Map<string, string>();
(globalThis as AnyP).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
};
(globalThis as AnyP).window = {
  addEventListener: noop, removeEventListener: noop,
  setInterval: () => 0, clearInterval: noop, setTimeout: () => 0,
  innerWidth: 1440, innerHeight: 900, // fitViewToWindow del motor necesita dims reales
  AudioContext: undefined, webkitAudioContext: undefined,
} as unknown as Window & typeof globalThis;
(globalThis as AnyP).document = {
  createElement: () => makeCanvas(), getElementById: () => makeCanvas(),
  addEventListener: noop, body: stub(), documentElement: stub(),
} as unknown as Document;
(globalThis as AnyP).performance = { now: () => Date.now() };
(globalThis as AnyP).requestAnimationFrame = () => 0;
(globalThis as AnyP).cancelAnimationFrame = noop;

const { Game } = await import('../src/game/engine');
const { audio } = await import('../src/game/audio');
(audio as unknown as { init: () => void }).init = () => {};
(audio as unknown as { ctx: unknown }).ctx = stub();
const { SKILLS, SKILL_TREE } = await import('../src/game/data');
const { skillPointsEarned, skillDamageMult, skillCdMult, castNewSkill, activateTool } = await import('../src/game/skilltree');

let fails = 0;
const bad = (m: string) => { console.log('  ✗ ' + m); fails++; };
const ok = (m: string) => console.log('  ✓ ' + m);

/** árboles pre-aprendidos escritos con el formato EXACTO de 'ecos-arbol' */
function seedTree(name: string, disc: 'alba' | 'tejedor', learned: string[], equip: (string | null)[]) {
  const key = `${name}|${disc}`;
  const all = JSON.parse(store.get('ecos-arbol') ?? '{}');
  all[key] = { learned, equip };
  store.set('ecos-arbol', JSON.stringify(all));
}
function boot(name: string, disc: 'alba' | 'tejedor', level: number) {
  const g = new Game(makeCanvas());
  g.newGame(name, disc);
  g.startPlay();                       // carga Lunaris y pasa a 'play'
  g.player!.level = level;             // nivel alto directo (puntos del árbol)
  for (let i = 0; i < 3; i++) g.update(1 / 60); // frames para que skillTick cargue el árbol
  return g;
}

console.log('=== 1) skillPointsEarned (política 1/nivel + hitos Nv5/Nv10) ===');
if (skillPointsEarned(1) === 0 && skillPointsEarned(2) === 1 && skillPointsEarned(5) === 5
  && skillPointsEarned(10) === 11 && skillPointsEarned(12) === 13) ok('curva 0/1/5/11/13 correcta');
else bad(`curva: ${skillPointsEarned(1)},${skillPointsEarned(2)},${skillPointsEarned(5)},${skillPointsEarned(10)},${skillPointsEarned(12)}`);

console.log('\n=== 2) Carga persistente + pasivas + equipaje (Alba Nv9) ===');
// aprendidos: c_fuerte(+10% melé), c_vida(+20 hp), c_eco, c_cd(−20% cd), c_onda,
//             t_gold(+20% oro), t_campana, t_brujula; equip: onda en hueco 4
seedTree('Albaran', 'alba', ['c_fuerte', 'c_vida', 'c_eco', 'c_cd', 'c_onda', 't_gold', 't_campana', 't_brujula'], [null, null, null, 'onda']);
const ga = boot('Albaran', 'alba', 9);
const pa = ga.player!;
if (SKILLS.alba[3].id === 'onda') ok('equipaje cargado: hueco 4 = Onda Sísmica (SKILLS mutado en runtime)');
else bad(`equipaje: hueco 4 = ${SKILLS.alba[3].id}`);
const expectedMaxHp = 110 + (9 - 1) * 7 + 20;
if (pa.maxHp === expectedMaxHp) ok(`applySkillStats absoluto: maxHp ${pa.maxHp} (base 110 + 8 niveles + 20 del árbol)`);
else bad(`maxHp ${pa.maxHp}, esperado ${expectedMaxHp}`);
if (Math.abs(skillDamageMult(ga, 'melee') - 1.10) < 1e-9) ok('skillDamageMult melee = 1.10 (Filo Templado)');
else bad(`skillDamageMult melee = ${skillDamageMult(ga, 'melee')}`);
if (Math.abs(skillCdMult(pa) - 0.8) < 1e-9) ok('skillCdMult = 0.8 (Refrán Veloz)');
else bad(`skillCdMult = ${skillCdMult(pa)}`);

console.log('\n=== 3) Onda Sísmica por useSkill (puente castSkill → castNewSkill) ===');
{
  const e = ga.makeEnemy('golem', pa.x + 30, pa.y, 0); // tanque: sobrevive para ver el empuje
  ga.enemies.push(e);
  pa.res = 100; pa.cds = [0, 0, 0, 0];
  const hp0 = e.hp;
  ga.useSkill(3); // hueco 4 = 'onda'
  if (e.hp < hp0) ok(`onda daña vía useSkill (hp ${hp0} → ${Math.ceil(e.hp)})`);
  else bad('onda no hizo daño por useSkill (¿puente no instalado?)');
  if ((e.kbVx ?? 0) !== 0 || (e.kbVy ?? 0) !== 0) ok('empuje de la onda (kbVx/kbVy) presente');
  else bad('sin knockback en la onda');
  if (pa.cds[3] > 0 && Math.abs(pa.res - (100 - 30 + 6 * 1.2)) < 0.01) ok('coste/cd por useSkill con la SkillDef equipada (30 res; +7.2 de resonancia por conectar)');
  else bad(`coste/cd: res=${pa.res} cd=${pa.cds[3]}`);
  // 14-b (camino B): el −20% de cd se aplica AL FIJAR en useSkill (decay extra OFF)
  ga.update(1 / 60);
  if (pa.cds[3] < 8 - 1 / 60 - 1e-9) ok(`cd reducido por árbol (fijado con skillCdMult, camino B): ${pa.cds[3].toFixed(3)}`);
  else bad('cd sin descuento de árbol');
  ga.enemies.length = 0;
}

console.log('\n=== 4) Eco del Filo: golpe nuevo → eco retardado en área ===');
{
  const e = ga.makeEnemy('lobo', pa.x + 12, pa.y, 0);
  ga.enemies.push(e);
  const hp0 = e.hp;
  pa.attackT = 0.26;                 // el motor fija attackT al liberar golpe
  ga.update(1 / 60);                 // flanco detectado → cola del eco
  ga.update(0.05);
  if (e.hp === hp0) ok('el eco no pega instantáneo (retardo ~0.16 s)');
  else bad('el eco pegó sin retardo');
  ga.update(0.2);
  if (e.hp < hp0) ok(`eco del filo conecta (hp ${hp0} → ${Math.ceil(e.hp)})`);
  else bad('el eco nunca conectó');
  ga.enemies.length = 0;
}

console.log('\n=== 5) Ojo del Mercader: +20% de oro por delta ===');
{
  const gold0 = pa.gold;
  pa.gold += 100;                    // killEnemy/cofres son del motor: delta equivalente
  ga.update(1 / 60);
  if (pa.gold === gold0 + 120) ok('+100 coronas → +20 de bonus (total 120)');
  else bad(`oro: ${pa.gold} vs ${gold0 + 120}`);
}

console.log('\n=== 6) Herramientas: campana (tecla 5 por flanco), brújula, cd ===');
{
  ga.update(1 / 60); // snapshot de teclas limpio
  ga.keys.add('5');
  ga.update(1 / 60);
  ga.keys.delete('5');
  if (ga.pendingMap !== null && ga.fadeDir === 1) ok('tecla 5 → Campana del Retorno: fadeTo al santuario en marcha');
  else bad(`tecla 5 no activó la campana (pendingMap=${String(ga.pendingMap)} fadeDir=${ga.fadeDir})`);
  // completar el fade manualmente para seguir
  ga.update(0.5); ga.update(0.5);
  if (ga.player!.x !== undefined && ga.mapId === 'lunaris') ok('aterrizaje tras la campana en el mismo mapa (santuario de Lunaris)');
  if (activateTool(ga, 'campana') === false) ok('campana en recarga (120 s) → activateTool devuelve false');
  else bad('campana usable de nuevo inmediatamente');
  const parts0 = ga.particles.length;
  if (activateTool(ga, 'brujula') === true) ok('brújula activada (questIdx 0 → objetivo Brisa en Lunaris)');
  else bad('brújula no se activó');
  for (let i = 0; i < 20; i++) ga.update(1 / 60);
  if (ga.particles.length > parts0) ok('rastro de ecos de la brújula generando partículas');
  else bad('la brújula no genera rastro');
  // amuleto NO aprendido: aviso amable
  if (activateTool(ga, 'amuleto') === false) ok('amuleto sin aprender → false + aviso');
  else bad('amuleto sin aprender se activó');
}

console.log('\n=== 7) Tejedora: Nova de Escarcha + gating de disciplina ===');
seedTree('Cantora', 'tejedor', ['a_res', 'a_nova', 'a_rayos'], ['nova', null, null, null]);
const gt = boot('Cantora', 'tejedor', 6);
const pt = gt.player!;
if (SKILLS.tejedor[0].id === 'nova') ok('equipaje tejedor: hueco 1 = Nova de Escarcha');
else bad(`equipaje tejedor: hueco 1 = ${SKILLS.tejedor[0].id}`);
if (SKILLS.alba[3].id === 'onda') ok('el equipaje de Alba no se contaminó entre partidas');
else bad('el equipaje de Alba se perdió al cargar la tejedora');
{
  const e = gt.makeEnemy('lobo', pt.x + 20, pt.y, 0);
  gt.enemies.push(e);
  pt.res = 100;
  const before = castNewSkill(gt, 'onda'); // aprendida por la OTRA partida: gating por nodo.disc
  if (before === false) ok('gating: onda (nodo solo-alba) rechazada para la tejedora');
  else bad('la tejedora pudo lanzar onda (gating roto)');
  const cast = castNewSkill(gt, 'nova');
  if (cast === true) {
    const frozen = e.statuses.some(s => s.kind === 'congelado');
    if (frozen) ok('nova: daño + estado congelado aplicado');
    else bad('nova no congeló');
  } else bad('castNewSkill(nova) devolvió false');
  // lastNote: sinergia con Canto Mayor
  if (gt.lastNote === 'hielo') ok('lastNote actualizado a hielo (sinergia Canto Mayor)');
  else bad(`lastNote = ${gt.lastNote}`);
  // tormenta encadenada: chainLightning del motor
  const e2 = gt.makeEnemy('lobo', pt.x - 30, pt.y - 10, 0);
  gt.enemies.push(e2);
  pt.res = 100;
  // espía de damageEnemy (propiedad de instancia sobre el prototipo)
  const origDmg = gt.damageEnemy.bind(gt);
  const dmgCalls: string[] = [];
  (gt as unknown as { damageEnemy: typeof gt.damageEnemy }).damageEnemy = (e, d, el, kb, kx, ky) => {
    dmgCalls.push(`${e.etype}@${Math.round(e.x)},${Math.round(e.y)}`);
    origDmg(e, d, el, kb, kx, ky);
  };
  const castR = castNewSkill(gt, 'rayos');
  if (castR === true && e2.hp < e2.maxHp) ok('tormenta encadenada conecta (chainLightning ×5)');
  else bad(`rayos: cast=${castR} hp=${e2.hp}/${e2.maxHp} enemies=${gt.enemies.length} impactos=${dmgCalls.join(';') || 'NINGUNO'} player=(${Math.round(pt.x)},${Math.round(pt.y)}) e2=(${Math.round(e2.x)},${Math.round(e2.y)}) mouse=(${gt.mouse.x},${gt.mouse.y}) cam=(${Math.round(gt.camX)},${Math.round(gt.camY)})`);
  gt.enemies.length = 0;
}

console.log('\n=== 8) Absorción reactiva: Bendición (escudo) + Amuleto ===');
// nombre NUEVO: el cache del módulo ya tenía 'Albaran|alba' sin estos nodos
seedTree('Amparo', 'alba', ['t_bendi', 't_amuleto'], [null, null, null, null]);
const gb = boot('Amparo', 'alba', 9);
const pb = gb.player!;
gb.enemies.length = 0; // sin aggro inicial: el amuleto debe cargar con el flanco de combate
for (let i = 0; i < 2; i++) gb.update(1 / 60);
const hpB0 = pb.hp;
if (castNewSkill(gb, 'bendi') === true) {
  const shield0 = Math.round(pb.maxHp * 0.25);
  pb.iframes = 0; pb.rollT = 0; pb.parryT = 0;
  gb.damagePlayer(20, pb.x + 10, pb.y); // golpe del motor (iframes 0.6 ya puestos)
  gb.update(1 / 60);                    // skillTick revierte sobre el escudo
  if (pb.hp === hpB0) ok(`escudo absorbió el golpe (hp intacta ${pb.hp}, escudo inicial ${shield0})`);
  else bad(`escudo no absorbió: hp ${pb.hp} vs ${hpB0}`);
} else bad('bendi no se lanzó (escudo no probado)');
// amuleto: flanco de combate → carga; golpe → absorbe
{
  const e = gb.makeEnemy('lobo', pb.x + 40, pb.y, 0);
  gb.enemies.push(e);
  e.aggro = true;
  gb.update(1 / 60); // flanco de combate: recarga del amuleto
  pb.iframes = 0; pb.rollT = 0; pb.parryT = 0;
  const hpC0 = pb.hp;
  gb.damagePlayer(15, pb.x + 10, pb.y);
  gb.update(1 / 60);
  if (pb.hp === hpC0) ok('amuleto cargado por oleada de combate y absorbió el golpe');
  else bad(`amuleto no absorbió: hp ${pb.hp} vs ${hpC0}`);
  gb.enemies.length = 0;
}

console.log('\n=== 9) Guardado/carga del MOTOR conserva árbol + equipaje + maxHp ===');
{
  // Albaran (ga): learned c_vida/c_cd, equip onda en hueco 4 — sus expectativas.
  // (gb=Amparo NO tiene c_vida/c_cd ni equipaje: no sirve para este bloque.)
  ga.save();
  const g2 = new Game(makeCanvas());
  g2.continueGame();
  for (let i = 0; i < 3; i++) g2.update(1 / 60);
  const expected = 110 + (9 - 1) * 7 + 20;
  if (g2.player && g2.player.maxHp === expected) ok(`maxHp tras continueGame = ${g2.player.maxHp} (sin doble suma ni pérdida)`);
  else bad(`maxHp tras carga: ${g2.player?.maxHp} vs ${expected}`);
  if (SKILLS.alba[3].id === 'onda') ok('equipaje re-aplicado tras cargar partida (hueco 4 = onda)');
  else bad(`equipaje tras carga: hueco 4 = ${SKILLS.alba[3].id}`);
  if (Math.abs(skillCdMult(g2.player!) - 0.8) < 1e-9) ok('cds del árbol vivos tras carga');
  else bad('cds del árbol perdidos tras carga');
}

console.log('\n=== 10) Pantalla del árbol (drawSkillTree) sin excepciones ===');
{
  ga.setState('skills');
  try {
    const { drawSkillTree } = await import('../src/game/skilltree');
    drawSkillTree(ga); // todos los clicks son uiHit: el stub de ctx absorbe el dibujo
    ok('drawSkillTree ejecuta sin lanzar (Nv5 con 5 nodos aprendidos)');
  } catch (err) {
    bad(`drawSkillTree lanzó: ${err}`);
  }
  ga.setState('play');
}

console.log('\n=== 9) Nodos del árbol: integridad de referencias ===');
{
  const ids = new Set(SKILL_TREE.map(n => n.id));
  let ok2 = true;
  for (const n of SKILL_TREE) {
    if (n.parent && !ids.has(n.parent)) { ok2 = false; bad(`nodo ${n.id}: padre inexistente ${n.parent}`); }
    if (n.kind === 'activa' && !n.grants) { ok2 = false; bad(`nodo activo ${n.id} sin grants`); }
  }
  if (ok2) ok(`${SKILL_TREE.length} nodos: padres y grants consistentes`);
}

console.log(`\n${fails === 0 ? 'SMOKE ÁRBOL COMPLETO EN VERDE' : `FALLOS: ${fails}`}`);
process.exit(fails === 0 ? 0 : 1);
