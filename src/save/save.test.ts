import { describe, expect, it } from 'vitest';
import { buildContent } from '../data/registry';
import { loadSave, migrate, newSave, SAVE_KEY, SAVE_VERSION, writeSave, type SaveStorage } from './save';

const content = buildContent();

function memoryStorage(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('save', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const save = newSave(content);
    save.cash = 12345;
    save.rating = 3.4;
    save.night = 6;
    writeSave(storage, save);
    expect(loadSave(storage, newSave(content))).toEqual(save);
  });

  it('fills fields missing from an older save with defaults', () => {
    const old = { saveVersion: SAVE_VERSION, night: 4, cash: 900, settings: { musicVolume: 0.1 } };
    const loaded = migrate(old, newSave(content))!;
    expect(loaded.night).toBe(4);
    expect(loaded.cash).toBe(900);
    expect(loaded.settings.musicVolume).toBe(0.1);
    expect(loaded.settings.masterVolume).toBe(0.8);
    expect(loaded.stats.nightsCompleted).toBe(0);
    expect(loaded.pantry.salmon).toBeGreaterThan(0);
  });

  it('replaces values of the wrong type with defaults', () => {
    const loaded = migrate({ saveVersion: SAVE_VERSION, cash: 'lots' }, newSave(content))!;
    expect(loaded.cash).toBe(content.economy.startingCash);
  });

  it('rejects corrupt or future saves', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadSave(storage, newSave(content))).toBeNull();
    expect(migrate({ saveVersion: SAVE_VERSION + 1 }, newSave(content))).toBeNull();
  });
});
