// ============================================================
// R16 · LECTURA TOLERANTE DEL GUARDADO DE CAMPAÑA
// continueGame() restauraba el save tal cual: un campo con tipo raro
// (p.ej. "openedChests":5, "deadGolds":7, "hp":"abc", "attrs":null,
// "questIdx":999, "v":999999) lanzaba al pulsar CONTINUAR, hacía al
// Portador inmortal (hp NaN) o envenenaba el daño (attrs NaN) — y el
// siguiente autoguardado volvía a escribir la basura en disco.
// sanitizeSaveData() devuelve SIEMPRE un SaveData con la forma exacta
// que espera el motor, o null si el save no es recuperable (sin
// player/mapa/posición válidos).
// Función pura (sin DOM): la usan engine.continueGame y los smokes.
// ============================================================

import type { SaveData, MapId, Epoch, ToneKind, CompMode, StatsData } from './types';

/** Versión del formato de guardado que escribe este build. */
export const SAVE_VERSION = 1;

const num = (v: unknown, def: number, min = -Infinity, max = Infinity): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return def;
  return n < min ? min : n > max ? max : n;
};
const int = (v: unknown, def: number, min = -Infinity, max = Infinity): number =>
  Math.round(num(v, def, min, max));
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const TONES: ToneKind[] = ['empatico', 'pragmatico', 'sarcastico', 'amenazante'];
const FACCIONES = ['guardianes', 'orden', 'circulo', 'liga'];
const ATTRS = ['fue', 'des', 'int', 'esp', 'vig'] as const;

/**
 * Normaliza un objeto leído de localStorage.
 * @param raw     el JSON ya parseado (cualquier cosa)
 * @param isMap   validador de MapId (inyectado: evita importar MAPS aquí)
 * @param questCount nº de misiones (clamp de questIdx)
 */
export function sanitizeSaveData(
  raw: unknown, isMap: (id: string) => boolean, questCount: number,
): SaveData | null {
  if (!isObj(raw)) return null;
  // versión: un save de un build FUTURO se TOLERA (contrato QA17: rechazarlo
  // borraría la partida del jugador al volver a una versión anterior); como
  // cada campo se sanea por separado, lo desconocido simplemente se ignora.
  const v = int(raw.v, SAVE_VERSION, 0);
  const p = raw.player;
  if (!isObj(p)) return null;
  if (typeof raw.map !== 'string' || !isMap(raw.map)) return null;
  const x = num(raw.x, NaN), y = num(raw.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const discipline = p.discipline === 'tejedor' ? 'tejedor' : 'alba';
  const maxHp = num(p.maxHp, discipline === 'alba' ? 110 : 96, 1, 99999);
  const maxSta = num(p.maxSta, 100, 1, 9999);
  const attrsIn = isObj(p.attrs) ? p.attrs : {};
  const attrs = { fue: 2, des: 2, int: 2, esp: 2, vig: 2 };
  for (const k of ATTRS) attrs[k] = int(attrsIn[k], 2, 0, 999);
  const tonesIn = isObj(p.tones) ? p.tones : {};
  const tones = {} as Record<ToneKind, number>;
  for (const k of TONES) tones[k] = num(tonesIn[k], 0, 0);
  const repIn = isObj(p.repFacciones) ? p.repFacciones : {};
  const repFacciones: Record<string, number> = {};
  for (const k of FACCIONES) repFacciones[k] = num(repIn[k], 0, -999, 999);

  const flagsIn = isObj(raw.flags) ? raw.flags : {};
  const flags: Record<string, number | boolean | string> = {};
  for (const [k, val] of Object.entries(flagsIn)) {
    if (typeof val === 'boolean' || typeof val === 'string' || (typeof val === 'number' && Number.isFinite(val))) flags[k] = val;
  }

  const deadGolds: SaveData['deadGolds'] = [];
  if (Array.isArray(raw.deadGolds)) {
    for (const dg of raw.deadGolds) {
      if (!isObj(dg) || typeof dg.map !== 'string' || !isMap(dg.map)) continue;
      const amount = int(dg.amount, 0, 0);
      const gx = num(dg.x, NaN), gy = num(dg.y, NaN);
      if (amount > 0 && Number.isFinite(gx) && Number.isFinite(gy)) deadGolds.push({ map: dg.map as MapId, x: gx, y: gy, amount });
    }
  }

  const epoch: Epoch = raw.epoch === 'pasado' ? 'pasado' : raw.epoch === 'aun' ? 'aun' : 'presente';
  const mode = raw.companionMode;
  const companionMode: CompMode | undefined =
    mode === 'agresivo' || mode === 'defensivo' || mode === 'seguir' ? mode : undefined;
  const qMax = Math.max(0, questCount - 1);

  return {
    v,
    player: {
      name: typeof p.name === 'string' && p.name.trim() ? p.name.slice(0, 24) : 'Portador',
      discipline,
      level: int(p.level, 1, 1, 99),
      xp: num(p.xp, 0, 0),
      hp: num(p.hp, maxHp, 1, maxHp),
      maxHp,
      sta: num(p.sta, maxSta, 0, maxSta),
      maxSta,
      res: num(p.res, 0, 0, 100),
      attrs,
      points: int(p.points, 0, 0, 999),
      gold: int(p.gold, 0, 0, 9999999),
      weaponPlus: int(p.weaponPlus, 0, 0, 99),
      potions: int(p.potions, 0, 0, 999),
      hasEcho: p.hasEcho === true,
      kills: int(p.kills, 0, 0),
      deaths: int(p.deaths, 0, 0),
      repGuardianes: num(p.repGuardianes, 0, -999, 999),
      playTime: num(p.playTime, 0, 0),
      tones,
      memories: strArr(p.memories),
      repFacciones,
    },
    map: raw.map as MapId,
    x, y,
    epoch,
    flags,
    questIdx: int(raw.questIdx, 0, 0, qMax),
    questStep: int(raw.questStep, 0, 0, 99),
    openedChests: strArr(raw.openedChests),
    takenEchoes: strArr(raw.takenEchoes),
    deadGolds,
    companion: raw.companion === true,
    companionMode,
    saveTime: num(raw.saveTime, 0, 0),
    stats: isObj(raw.stats) ? (raw.stats as unknown as StatsData) : undefined, // sanitizeStats en el motor
    dayT: Number.isFinite(raw.dayT as number) ? ((raw.dayT as number) % 1 + 1) % 1 : undefined,
  };
}
