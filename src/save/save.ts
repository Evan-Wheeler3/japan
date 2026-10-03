import type { Content } from '../data/registry';

export const SAVE_KEY = 'yoake.save';
export const SAVE_VERSION = 1;

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  mouseSensitivity: number;
}

export interface Stats {
  nightsCompleted: number;
  partiesServed: number;
  partiesLost: number;
  itemsServed: number;
  lifetimeRevenue: number;
  lifetimeTips: number;
  lifetimeProfit: number;
  bestNightProfit: number;
}

export interface SaveData {
  saveVersion: number;
  night: number;
  cash: number;
  rating: number;
  pantry: Record<string, number>;
  stats: Stats;
  settings: Settings;
}

type Json = Record<string, unknown>;
type Migration = (data: Json) => Json;

/** Keyed by the version being migrated FROM. Add an entry whenever SAVE_VERSION is bumped. */
export const MIGRATIONS: Record<number, Migration> = {};

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function newSave(c: Content): SaveData {
  const pantry: Record<string, number> = {};
  for (const ing of c.ingredients.all()) pantry[ing.id] = ing.capacity;
  return {
    saveVersion: SAVE_VERSION,
    night: 1,
    cash: c.economy.startingCash,
    rating: c.economy.startingRating,
    pantry,
    stats: {
      nightsCompleted: 0,
      partiesServed: 0,
      partiesLost: 0,
      itemsServed: 0,
      lifetimeRevenue: 0,
      lifetimeTips: 0,
      lifetimeProfit: 0,
      bestNightProfit: 0,
    },
    settings: { masterVolume: 0.8, musicVolume: 0.6, mouseSensitivity: 1 },
  };
}

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Fills any field missing from `data` with the default, recursively, ignoring values of the wrong type. */
function fillDefaults<T>(defaults: T, data: unknown): T {
  if (!isObject(defaults) || !isObject(data)) {
    return typeof data === typeof defaults && data !== null ? (data as T) : defaults;
  }
  const out: Json = { ...data };
  for (const [k, dv] of Object.entries(defaults)) {
    out[k] = k in data ? fillDefaults(dv, data[k]) : dv;
  }
  return out as T;
}

export function migrate(raw: unknown, defaults: SaveData): SaveData | null {
  if (!isObject(raw)) return null;
  let data = raw;
  let version = typeof data.saveVersion === 'number' ? data.saveVersion : 0;
  if (version > SAVE_VERSION) return null;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (step) data = step(data);
    version++;
  }
  const merged = fillDefaults(defaults, data);
  merged.saveVersion = SAVE_VERSION;
  return merged;
}

export function loadSave(storage: SaveStorage, defaults: SaveData): SaveData | null {
  try {
    const text = storage.getItem(SAVE_KEY);
    if (!text) return null;
    return migrate(JSON.parse(text), defaults);
  } catch {
    return null;
  }
}

export function writeSave(storage: SaveStorage, data: SaveData): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): SaveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
