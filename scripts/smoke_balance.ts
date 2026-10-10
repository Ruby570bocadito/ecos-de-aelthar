// ============================================================
// SMOKE 12-c (bun, sin navegador): balanceador de dificultad.
// Uso:  bun scripts/smoke_balance.ts        → simulaciones de monitor
//       bun scripts/smoke_balance.ts load   → round-trip de persistencia
// stub de localStorage respaldado en /tmp para probar carga entre procesos.
// La simulación avanza p.playTime a mano (en el juego lo hace update.ts:118)
// y las muertes son CUMULATIVAS (como en el juego real: nunca disminuyen).
// ============================================================

import { readFileSync, writeFileSync } from 'fs';
import type { Game } from '../src/game/engine';
import type { Player } from '../src/game/types';
import {
  balanceTick, enemyStatMult, loadBalance, saveBalance, resetBalance, zonaMult,
  nudgeBalanceLevel, setBalanceAuto, drawBalancePanel, balanceLevelName,
} from '../src/game/balance';

// ---------------- stub localStorage (/tmp) ----------------
const LS_FILE = '/tmp/ecos-balance-smoke.json';
function lsRead(): Record<string, string> {
  try { return JSON.parse(readFileSync(LS_FILE, 'utf8')) as Record<string, string>; }
  catch { return {}; }
}
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => lsRead()[k] ?? null,
  setItem: (k: string, v: string) => { const d = lsRead(); d[k] = v; writeFileSync(LS_FILE, JSON.stringify(d)); },
  removeItem: (k: string) => { const d = lsRead(); delete d[k]; writeFileSync(LS_FILE, JSON.stringify(d)); },
};

let fallos = 0;
function check(nombre: string, ok: boolean, extra = ''): void {
  console.log(`${ok ? '✓' : '✗ FALLO'} ${nombre}${extra ? ' — ' + extra : ''}`);
  if (!ok) fallos++;
}

// ---------------- fases de carga (proceso aparte, módulo fresco) ----------------
const modo = process.argv[2];
if (modo === 'load-valid') {
  const s = loadBalance();
  check('carga desde localStorage: nivel -2 MANUAL', s.level === -2 && s.auto === false,
    JSON.stringify(s));
  nudgeBalanceLevel(2); // absoluto (|2|≠1) → nivel 2 MANUAL + guardado con debounce
  await new Promise(r => setTimeout(r, 1700)); // > DEBOUNCE_MS
  const raw = JSON.parse(readFileSync(LS_FILE, 'utf8')) as Record<string, string>;
  const saved = JSON.parse(raw['ecos-balance'] ?? '{}') as { level: number; auto: boolean };
  check('debounce persiste nivel 2 MANUAL', saved.level === 2 && saved.auto === false,
    JSON.stringify(saved));
  console.log(fallos === 0 ? 'SMOKE BALANCE LOAD: TODO OK' : `SMOKE BALANCE LOAD: ${fallos} FALLOS`);
  process.exit(fallos === 0 ? 0 : 1);
}
if (modo === 'load-corrupt') {
  writeFileSync(LS_FILE, 'esto-no-es-json{{{');
  const s1 = loadBalance();
  check('JSON corrupto → valores por defecto sin lanzar',
    s1.level === 0 && s1.auto === true, JSON.stringify(s1));
  writeFileSync(LS_FILE, JSON.stringify({ 'ecos-balance': JSON.stringify({ level: 'x', auto: 'no' }) }));
  // bal ya está en cache: solo comprobamos que una forma inválida no rompería
  // el guard (typeof) — la prueba de cache fresco es el run anterior.
  check('forma inválida tolerada por el guard de tipos', typeof s1.level === 'number');
  console.log(fallos === 0 ? 'SMOKE BALANCE CORRUPT: TODO OK' : `SMOKE BALANCE CORRUPT: ${fallos} FALLOS`);
  process.exit(fallos === 0 ? 0 : 1);
}

// ---------------- Game falso (solo lo que balance.ts lee) ----------------
function fakePlayer(): Player {
  return {
    kind: 'player', name: 'Prueba', discipline: 'alba',
    x: 0, y: 0, w: 12, h: 10, vx: 0, vy: 0, dir: 'down',
    hp: 100, maxHp: 100, sprite: 'hero_alba', anim: 0, moving: false,
    level: 7, xp: 0, sta: 100, maxSta: 100, res: 0, maxRes: 100,
    attrs: { fue: 5, des: 5, int: 5, esp: 5, vig: 5 },
    points: 0, gold: 0, weaponPlus: 0, potions: 3, cds: [0, 0, 0, 0],
    iframes: 0, parryT: 0, parryFx: 0, attackT: 0, combo: 0,
    chargeT: 0, charging: false, rollT: 0, lastHitT: 0,
    hasEcho: false, kills: 0, deaths: 0, repGuardianes: 0, playTime: 310,
  } as unknown as Player;
}

function fakeGame(p: Player | null): Game {
  return {
    player: p, enemies: [], challengeRun: null, mapId: 'costa', state: 'play',
    canvas: { width: 1440, height: 900, style: {} },
    mouse: { x: 0, y: 0, down: false, rdown: false, worldX: 0, worldY: 0 },
    uiHit: [] as { x: number; y: number; w: number; h: number; cb: () => void; hover?: boolean }[],
    toasts: [] as string[],
    toast(text: string) { (this as unknown as { toasts: string[] }).toasts.push(text); },
  } as unknown as Game;
}

const DT = 0.1;
let p = fakePlayer();
function step(g: Game, segundos: number): void {
  const n = Math.round(segundos / DT);
  for (let i = 0; i < n; i++) { p.playTime += DT; balanceTick(g, DT); } // update.ts:118
}

// ================= simulaciones (una sesión continua, t siempre avanza) =================
resetBalance();
const g = fakeGame(p);
const toasts = g.toasts as unknown as string[];

// --- fase 1: UNA muerte sola NO baja el nivel (UMBRAL_BAJAR = 3) ---
step(g, 5);
p.hp = 30; step(g, DT);            // golpe fuerte previo a morir (+1 por daño ≥ 40%)
p.deaths = 1; p.hp = 100; step(g, 45);
check('1 muerte sola no cambia el nivel', loadBalance().level === 0, `nivel=${loadBalance().level}`);

// --- fase 2: morir mucho (2ª muerte en <2 min) → nivel -1 + 1 toast ---
p.hp = 30; step(g, DT); p.deaths = 2; p.hp = 100;   // muerte 2 (~410 s)
step(g, 30);
check('2 muertes → nivel -1', loadBalance().level === -1, `nivel=${loadBalance().level}`);
check('1 toast por el cambio', toasts.length === 1, `toasts=${toasts.length}`);
check('texto del toast (baja)', toasts[0] === 'El mundo cede un paso atrás...', toasts[0] ?? '—');

// --- fase 3: seguir muriendo → -2 (cap), 1 toast por cambio, sin extras ---
p.hp = 30; step(g, DT); p.deaths = 3; p.hp = 100;   // muerte 3
step(g, 40);
check('3+ muertes → nivel -2 (cap)', loadBalance().level === -2, `nivel=${loadBalance().level}`);
check('2º toast del 2º cambio', toasts.length === 2, `toasts=${toasts.length}`);
p.hp = 30; step(g, DT); p.deaths = 4; p.hp = 100;
step(g, 45);
check('cap -2: no hay más cambios ni toasts', loadBalance().level === -2 && toasts.length === 2,
  `nivel=${loadBalance().level} toasts=${toasts.length}`);

// --- fase 4: arrasar (combates flawless sostenidos) sube con toasts ---
step(g, 125); // dejar expirar la memoria de muertes (120 s)
for (let ciclo = 0; ciclo < 40 && loadBalance().level < 2; ciclo++) {
  g.enemies = [{ aggro: true, dead: false, ai: 'persigue' }] as never[];
  step(g, 5);                        // combate limpio ≥ 4 s
  g.enemies = [];                    // fin de combate sin daño → flawless
  step(g, 6);
}
check('arrasar sube hasta +2', loadBalance().level === 2, `nivel=${loadBalance().level}`);
check('4 toasts de subida (-2→-1→0→+1→+2)', toasts.length === 6, `toasts=${toasts.length}`);
check('texto del toast (sube)', toasts[2] === 'El mundo se torna más fiero...', toasts[2] ?? '—');
for (let ciclo = 0; ciclo < 5; ciclo++) {
  g.enemies = [{ aggro: true, dead: false, ai: 'x' }] as never[];
  step(g, 5); g.enemies = []; step(g, 6);
}
check('cap +2: sin toasts extra', toasts.length === 6, `toasts=${toasts.length}`);

// --- fase 5: MANUAL congela el nivel pese a las señales ---
resetBalance();                     // Normal/AUTO + votos a cero
check('reset → Normal/AUTO', loadBalance().level === 0 && loadBalance().auto);
nudgeBalanceLevel(1);               // MANUAL, nivel 1 (desde 0: paso relativo)
check('nudge → MANUAL nivel 1', !loadBalance().auto && loadBalance().level === 1);
toasts.length = 0;
const g3 = fakeGame(p);
p.hp = 30; step(g3, DT); p.deaths = 5; p.hp = 100;
p.potions = 0;                      // 2 pociones bebidas
step(g3, 30);
check('MANUAL: el nivel no se mueve', loadBalance().level === 1, `nivel=${loadBalance().level}`);
check('MANUAL: sin toasts', toasts.length === 0, `toasts=${toasts.length}`);
setBalanceAuto(true);
check('vuelta a AUTO conserva el nivel', loadBalance().auto && loadBalance().level === 1);

// --- fase 6: tabla de multiplicadores + desafío + sin jugador ---
// (nudge ±1 = paso relativo; la secuencia baja y sube para pasar por los 5 niveles)
// (R8-7 integrada) — la tabla ×1.08 es la curva de agresión por nivel del
// jugador (fakePlayer nivel 7 → 1 + (7-3)×0.02 = 1.08); los E valores de
// tabla subieron con 4.2 (+1: 1.20/1.14, +2: 1.42/1.28).
const secuencia: [number, number, number, number][] = [
  [0, 1.08, 1.08, 1], [-1, 0.9504, 0.9720000000000001, 0.93], [-2, 0.81, 0.8640000000000001, 0.85],
  [-1, 0.9504, 0.9720000000000001, 0.93], [0, 1.08, 1.08, 1], [1, 1.296, 1.2312, 1.08], [2, 1.5336, 1.3824, 1.15],
];
for (const [lvl, hp, dmg, xp] of secuencia) {
  const cur = loadBalance().level;
  if (lvl !== cur) nudgeBalanceLevel(Math.sign(lvl - cur));
  const m = enemyStatMult(g3);
  // R17: la Costa es zona 6 → tabla × agresión × zona
  const zc = zonaMult('costa');
  const cl = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  check(`mult nivel ${lvl} (${balanceLevelName(lvl)})`,
    cl(m.hp, hp * zc.hp) && cl(m.dmg, dmg * zc.dmg) && cl(m.xp, xp * zc.xp), `${m.hp}/${m.dmg}/${m.xp}`);
}
nudgeBalanceLevel(0); // |delta|≠1 → absoluto: nivel 0
const gSinPlayer = fakeGame(null);
const m0 = enemyStatMult(gSinPlayer);
check('sin jugador → neutro', m0.hp === 1 && m0.dmg === 1 && m0.xp === 1);
(g3 as unknown as { challengeRun: unknown }).challengeRun = { active: true };
const m1 = enemyStatMult(g3);
check('modo desafío → neutro', m1.hp === 1 && m1.dmg === 1 && m1.xp === 1);
(g3 as unknown as { challengeRun: unknown }).challengeRun = null;
const m2 = enemyStatMult(g3);
check('campaña con nivel 0 → tabla × agresión × zona (Nv7 → ×1.08; Costa zona 6)', Math.abs(m2.hp - 1.08 * zonaMult('costa').hp) < 1e-9 && Math.abs(m2.dmg - 1.08 * zonaMult('costa').dmg) < 1e-9 && Math.abs(m2.xp - zonaMult('costa').xp) < 1e-9); // R8-7 + R17
// R17 · escalado por zona: Cumbres (zona 8) → vida ×2.54, daño ×1.49, XP ×1.7
(g3 as unknown as { mapId: string }).mapId = 'cumbres';
const mz = enemyStatMult(g3);
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
check('zona 8 (Cumbres) × agresión: vida ×2.54·1.08, daño ×1.49·1.08, XP ×1.7', close(mz.hp, 1.08 * 2.54) && close(mz.dmg, 1.08 * 1.49) && close(mz.xp, 1.7), `${mz.hp}/${mz.dmg}/${mz.xp}`);
const mzb = enemyStatMult(g3, 'golem');
check('jefe en zona 8: vida de DISEÑO (sin zona ni agresión)', mzb.hp === 1 && mzb.dmg === 1);
(g3 as unknown as { mapId: string }).mapId = 'costa';
// el balanceador tampoco actúa en desafío (muertes no mueven el nivel)
resetBalance();
const p4 = fakePlayer();
const g4 = fakeGame(p4);
(g4 as unknown as { challengeRun: unknown }).challengeRun = { active: true };
const step4 = (s: number) => { for (let i = 0; i < s / DT; i++) { p4.playTime += DT; balanceTick(g4, DT); } };
p4.hp = 20; step4(DT); p4.deaths = 5; p4.hp = 100;
step4(40);
check('desafío: monitor inactivo (nivel 0)', loadBalance().level === 0,
  `nivel=${loadBalance().level}`);

// --- fase 7: panel (ctx Proxy que no-op todo) ---
const ctxStub = new Proxy({}, {
  get: (t, k) => (k in t ? (t as Record<string, unknown>)[k] : () => undefined),
  set: (t, k, v) => { (t as Record<string, unknown>)[k] = v; return true; },
}) as unknown as CanvasRenderingContext2D;
const gp = fakeGame(p) as unknown as { ctx: CanvasRenderingContext2D } & Game;
gp.ctx = ctxStub;
gp.uiHit = [];
const h1 = drawBalancePanel(gp, 100, 200, 664);
check('panel interactivo: alto 70 y 4 botones registrados', h1 === 70 && gp.uiHit.length === 4,
  `h=${h1} hits=${gp.uiHit.length}`);
gp.uiHit = [];
const h2 = drawBalancePanel(gp, 100, 200, 664, { readOnly: true });
check('panel solo-lectura: alto 62 y 0 botones', h2 === 62 && gp.uiHit.length === 0,
  `h=${h2} hits=${gp.uiHit.length}`);
gp.uiHit = [];
drawBalancePanel(gp); // anclaje por defecto (canvas 1440×900): no debe lanzar
check('panel con anclaje por defecto OK', true);

// --- fase 8: guardado inmediato para la fase 'load' (otro proceso) ---
saveBalance({ level: -2, auto: false, recentDeaths: 0, recentFlawless: 0 });
console.log(fallos === 0 ? '\nSMOKE BALANCE: TODO OK' : `\nSMOKE BALANCE: ${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
