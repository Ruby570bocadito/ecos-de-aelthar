// ============================================================
// ECOS DE AELTHAR - R11-1 · DATOS de los 5 MINI-JEFES (EPIC 7.1)
// SOLO DATOS + CONTRATO: la IA de patrones la escribe R11-2 en otro
// archivo; diálogos (R11-5) y audio (R11-8) consumen estos etypes.
// Los etypes aquí son CONGELADOS.
//
// CONTRATO (qué cablea el orquestador):
// (1) REGISTRO — los 5 etypes NO están en EnemyType (types.ts:13).
//     Patrón ENEMY_DEFS_R10A (data.ts:2105): Object.assign(ENEMY_DEFS,
//     <Record<string,EnemyDef> derivado>) con mapeo atk→dmg,
//     botin.eco→xp, palette→sprite-pal, lore→desc. Al añadir los 5 a
//     la unión EnemyType, desaparecen los casts de SPAWNS_R11.
// (2) SPAWNS — push sobre MAPS[def.map].spawns (patrón
//     SPAWN_SEPULCRO_R10, data.ts:2130). zone PROPIA por def; NUNCA
//     'boss' (update.ts:585: find(zone==='boss') devuelve el primero).
// (3) WATCHER — update.ts junto al bloque del Sepulcro (update.ts:620):
//     find(zone && type), gate !g.flags[MINIBOSS_FLAGS[etype]] &&
//     !g.bossActive && g.questIdx >= 5 (guard historia: Acto II,
//     engine.ts:352 usa questIdx 5..9) y radio 190 px; activar con
//     g.bossRef, g.bossActive, startBossIntro(g), g.toast(def.intro),
//     playBossRoarVariant (R11-8). Espantapajaros: EXTRA isNight(g)
//     (update.ts:1256: dayT>0.7||<0.08) — de día no se activa.
// (4) MUERTE → FLAG + BOTÍN — killEnemy rama por etype (estilo
//     data.ts:2061): this.flags[MINIBOSS_FLAGS[e.etype]] = true y
//     botín def.botin (eco = xp del Eco). COLISIÓN 'coro': el etype
//     'coro' YA EXISTE como jefe (El Coro Roto, data.ts:1379, flag
//     engine.ts:101 'coroDefeated') — la rama killEnemy debe consultar
//     MINIBOSS_FLAGS ANTES que BOSS_DEFEAT_FLAG; el mini-jefe fija
//     mb_coro_muerto, no coroDefeated (watcher filtra por map+zone).
// (5) BANNER INTRO — bossintro por g.bossRef.etype (patrón R9-5):
//     usar def.intro como subtítulo; sin enganche cae al fallback.
// (6) GUARD — needPresent en todos (en el AYER el huerto tenía gente,
//     la nao navegaba, la mina trabajaba).
//
// COORDS VERIFICADAS offline (r11_check_minibosses.mts, npx tsx sobre
// MAPS reales + SOLID_CHARS sprites.ts:157): tile transitable presente
// y pasado, vecindario 3x3 >= 6 libres, 0 POIs a radio 2, BFS ok desde
// los aterrizajes. TODOS dentro de map.w×map.h (el motor recorta a
// w×h: engine.ts:817/1019/1055/1124).
// ⚠ HALLAZGO: maps_expansion.ts tiene w/h viejos vs rows en
// costa/aldea/cumbres (w/h 52×40 · 44×34 · 50×42 vs rows 64×40 ·
// 44×44 · 66×42) → zonas R10-2 este/sur (naufragio x51..58,
// campamento x52..61, huerto/cementerio y34..43) IN-ENGINE
// inaccesibles hasta corregir w/h. Los spawns evitan esa zona muerta.
// ============================================================

import type { MapId, SpawnDef, EnemyType } from '../types';

/**
 * Def de mini-jefe (SOLO DATOS). Mapeo a EnemyDef en la cabecera (1).
 * night: solo espantapajaros (aparece/activa SOLO de noche).
 */
export interface MinibossDef {
  etype: string;
  name: string;
  map: MapId;
  hp: number;
  atk: number;
  speed: number;
  aggroR: number;
  atkR: number;
  windup: number;
  atkCd: number;
  pattern: 'carga' | 'abanico' | 'coro' | 'guardia' | 'nueces' | 'vigilia';
  palette: string;
  intro: string;
  lore: string;
  botin: { potions?: number; gold?: number; eco?: number };
  night?: boolean;
}

// ⚠ R11-1b (fix del orquestador): el mini-jefe del bosque usa etype
// 'coro_mini' — el etype 'coro' YA EXISTE como jefe de historia (El Coro
// Roto, data.ts, flag coroDefeated). Un Object.assign(ENEMY_DEFS, {coro})
// habría PISADO el def del jefe y el watcher lo habría activado dos veces.
// R11-2 resuelve 'coro_mini' → patrón 'coro' (enganche en update.ts).

import type { EnemyDef } from '../data';   // solo tipos: sin ciclo runtime
import type { Element } from '../types';   // Element vive en types.ts (data.ts no lo reexporta)

/** Los 5 mini-jefes (Ronda 11 · EPIC 7.1). Datos CONGELADOS — coords verificadas (BFS + SOLID_CHARS). */
export const MINIBOSS_DEFS: Record<string, MinibossDef> = {
  nodriza: {
    etype: 'nodriza', name: 'La Nodriza del Naufragio', map: 'costa',
    hp: 185, atk: 16, speed: 30, aggroR: 170, atkR: 34, windup: 0.85, atkCd: 2.4,
    pattern: 'nueces', palette: 'costa',
    intro: 'El casco podrido exhala un canto de cuna.',
    lore: 'Cuna a los ahogados como si aún respiraran. Nadie le ha arrancado un hijo sin pagar.',
    botin: { potions: 1, gold: 40, eco: 30 },
  },
  cazador: {
    etype: 'cazador', name: 'Cazador de Cumbres', map: 'cumbres',
    hp: 175, atk: 18, speed: 66, aggroR: 200, atkR: 30, windup: 0.75, atkCd: 2.0,
    pattern: 'carga', palette: 'cumbres',
    intro: 'Un silbido. La niebla se aparta.',
    lore: 'Caza lo que la mina despertó. Distingue el eco de tu paso entre mil huellas.',
    botin: { potions: 2, gold: 55, eco: 35 },
  },
  espantapajaros: {
    etype: 'espantapajaros', name: 'El Espantapájaros', map: 'aldea',
    hp: 165, atk: 14, speed: 38, aggroR: 160, atkR: 26, windup: 0.8, atkCd: 1.8,
    pattern: 'abanico', palette: 'aldea',
    intro: 'El huerto se llena de alas que no tiene.',
    lore: 'De día vela el trigal. De noche cobra la cosecha que nadie sembró.',
    botin: { potions: 1, gold: 35, eco: 25 },
    night: true, // SOLO de noche (watcher: dayT > 0.7 || dayT < 0.08)
  },
  coro_mini: {
    etype: 'coro_mini', name: 'Voz del Coro Perdido', map: 'bosque',
    hp: 195, atk: 15, speed: 26, aggroR: 180, atkR: 40, windup: 0.9, atkCd: 2.6,
    pattern: 'coro', palette: 'bosque',
    intro: 'Una voz entona lo que el santuario calló.',
    lore: 'Le quedó una sola nota del coro caído. La repite hasta que alguien la escuche entera.',
    botin: { potions: 1, gold: 50, eco: 40 },
  },
  centinela: {
    etype: 'centinela', name: 'Centinela del Eco', map: 'lunaris',
    hp: 205, atk: 17, speed: 24, aggroR: 150, atkR: 32, windup: 0.8, atkCd: 2.2,
    pattern: 'guardia', palette: 'lunaris',
    intro: 'El claro deja de respirar. Algo levanta la guardia.',
    lore: 'Guarda el claro desde antes del Eco. No obedece: espera. Y tú has llegado tarde.',
    botin: { potions: 2, gold: 60, eco: 45 },
  },
};

/**
 * Spawns listos para push en MAPS[def.map].spawns (patrón SPAWN_SEPULCRO_R10).
 * zone PROPIA por mini-jefe — NUNCA 'boss' (el find() de update.ts coge el primero).
 * needPresent: en el AYER el huerto tenía gente, la nao navegaba, la mina trabajaba.
 * Coords R11-1 verificadas: tile transitable presente+pasado, 3×3 ≥6 libres,
 * 0 POIs a radio 2, BFS alcanzable desde los aterrizajes.
 */
export const SPAWNS_R11: SpawnDef[] = [
  { type: 'nodriza' as unknown as EnemyType, x: 50, y: 25, patrol: 0, zone: 'naufragio', needPresent: true },  // junto al casco de La Madre del Mar
  { type: 'cazador' as unknown as EnemyType, x: 46, y: 20, patrol: 0, zone: 'campamento', needPresent: true }, // camino '=' y20 hacia el campamento
  { type: 'espantapajaros' as unknown as EnemyType, x: 21, y: 31, patrol: 0, zone: 'huerto', needPresent: true }, // junto a la puerta sur del huerto
  { type: 'coro_mini' as unknown as EnemyType, x: 56, y: 40, patrol: 0, zone: 'santuario', needPresent: true }, // hueco norte del círculo caído (piedra 'g' en 56,42)
  { type: 'centinela' as unknown as EnemyType, x: 56, y: 14, patrol: 0, zone: 'claro', needPresent: true },    // boca sur del anillo del claro del Eco
];

/** Flag de derrota por etype — killEnemy la fija ANTES que BOSS_DEFEAT_FLAG. */
export const MINIBOSS_FLAGS: Record<string, string> = {
  nodriza: 'mb_nodriza_muerto',
  cazador: 'mb_cazador_muerto',
  espantapajaros: 'mb_espantapajaros_muerto',
  coro_mini: 'mb_coro_muerto',
  centinela: 'mb_centinela_muerto',
};

// ── Derivación MinibossDef → EnemyDef (la ejecuta el orquestador con
//    Object.assign(ENEMY_DEFS, minibossEnemyDefs()), patrón ENEMY_DEFS_R10A).

const SPRITE_OF_ETYPE: Record<string, string> = {
  nodriza: 'sirena',      // nodriza ahogada — familia visual de la sirena
  cazador: 'lobo',        // bestia de la niebla alta
  espantapajaros: 'sombra', // trapo y nada dentro
  coro_mini: 'coro',      // misma familia que El Coro Roto (jefe) — apropiado
  centinela: 'guardian',  // centinela del claro — familia del Guardián
};

const ELEMENT_OF_ETYPE: Record<string, Element> = {
  nodriza: 'sombra', cazador: 'ninguno', espantapajaros: 'sombra',
  coro_mini: 'rayo', centinela: 'hielo',
};

const WEAK_TO_ETYPE: Record<string, Element> = {
  nodriza: 'sagrado', cazador: 'fuego', espantapajaros: 'fuego',
  coro_mini: 'sagrado', centinela: 'sagrado',
};

const BREAK_BAR_ETYPE: Record<string, number> = {
  nodriza: 50, cazador: 45, espantapajaros: 45, coro_mini: 55, centinela: 60,
};

/** Deriva los EnemyDef de los 5 mini-jefes (atk→dmg, botin.eco→xp, gold→[80%,100%]). */
export function minibossEnemyDefs(): Record<string, EnemyDef> {
  const out: Record<string, EnemyDef> = {};
  for (const k of Object.keys(MINIBOSS_DEFS)) {
    const d = MINIBOSS_DEFS[k];
    const g = d.botin.gold ?? 40;
    out[d.etype] = {
      name: d.name, hp: d.hp, dmg: d.atk, speed: d.speed,
      xp: d.botin.eco ?? 25, gold: [Math.round(g * 0.8), g],
      sprite: SPRITE_OF_ETYPE[d.etype] ?? 'sombra',
      aggroR: d.aggroR, atkR: d.atkR, windup: d.windup, atkCd: d.atkCd,
      element: ELEMENT_OF_ETYPE[d.etype] ?? 'sombra',
      weakTo: WEAK_TO_ETYPE[d.etype] ?? 'sagrado',
      breakBar: BREAK_BAR_ETYPE[d.etype] ?? 50,
      desc: d.lore,
    };
  }
  return out;
}
