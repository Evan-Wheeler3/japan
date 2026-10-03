import type { ArchetypeDef, ItemId } from '../data/types';
import type { Rng } from './rng';

export const MAX_ORDER_ITEMS = 4;
const UNLISTED_PREFERENCE = 0.3;

export function generateOrder(arch: ArchetypeDef, members: number, available: ItemId[], rng: Rng): ItemId[] {
  const items: ItemId[] = [];
  if (available.length === 0) return items;
  for (let p = 0; p < members; p++) {
    const count = rng.int(arch.itemsPerPerson[0], arch.itemsPerPerson[1]);
    const chosen = new Set<ItemId>();
    for (let i = 0; i < count; i++) {
      const pool = available
        .filter((id) => !chosen.has(id))
        .map((id) => [id, arch.preferences[id] ?? UNLISTED_PREFERENCE] as const);
      const pick = rng.weighted(pool);
      if (!pick) break;
      chosen.add(pick);
      items.push(pick);
    }
  }
  if (items.length === 0) items.push(rng.pick(available));
  return items.slice(0, MAX_ORDER_ITEMS);
}
