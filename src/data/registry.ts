import { ARCHETYPES, ECONOMY, INGREDIENTS, ITEMS, MENU, NIGHT, RECIPES, STATIONS } from './content';
import type {
  ArchetypeDef,
  EconomyConfig,
  IngredientDef,
  ItemDef,
  ItemId,
  MenuEntry,
  NightConfig,
  RecipeDef,
  StationDef,
  StationId,
  UnlockCondition,
} from './types';

export class Registry<T extends { id: string }> {
  private readonly map = new Map<string, T>();

  constructor(
    readonly label: string,
    items: T[],
  ) {
    for (const item of items) {
      if (this.map.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
      this.map.set(item.id, item);
    }
  }

  get(id: string): T {
    const v = this.map.get(id);
    if (!v) throw new Error(`Unknown ${this.label}: ${id}`);
    return v;
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  all(): T[] {
    return [...this.map.values()];
  }
}

export interface Content {
  items: Registry<ItemDef>;
  ingredients: Registry<IngredientDef>;
  stations: Registry<StationDef>;
  recipes: Registry<RecipeDef>;
  archetypes: Registry<ArchetypeDef>;
  menu: MenuEntry[];
  night: NightConfig;
  economy: EconomyConfig;
}

export function buildContent(): Content {
  return {
    items: new Registry('item', ITEMS),
    ingredients: new Registry('ingredient', INGREDIENTS),
    stations: new Registry('station', STATIONS),
    recipes: new Registry('recipe', RECIPES),
    archetypes: new Registry('archetype', ARCHETYPES),
    menu: MENU,
    night: NIGHT,
    economy: ECONOMY,
  };
}

export function validateContent(c: Content): string[] {
  const errors: string[] = [];
  for (const r of c.recipes.all()) {
    if (!c.items.has(r.output)) errors.push(`recipe ${r.id}: unknown output ${r.output}`);
    if (!c.stations.has(r.station)) errors.push(`recipe ${r.id}: unknown station ${r.station}`);
    for (const i of r.inputs) if (!c.items.has(i)) errors.push(`recipe ${r.id}: unknown input ${i}`);
    for (const g of r.ingredients) if (!c.ingredients.has(g.id)) errors.push(`recipe ${r.id}: unknown ingredient ${g.id}`);
    if (r.batch < 1) errors.push(`recipe ${r.id}: batch must be >= 1`);
  }
  for (const m of c.menu) {
    if (!c.items.has(m.item)) errors.push(`menu: unknown item ${m.item}`);
    else if (!recipeFor(c, m.item)) errors.push(`menu: no recipe produces ${m.item}`);
  }
  for (const a of c.archetypes.all()) {
    if (a.looks.length === 0) errors.push(`archetype ${a.id}: needs at least one look`);
    for (const id of Object.keys(a.preferences)) if (!c.items.has(id)) errors.push(`archetype ${a.id}: unknown preference ${id}`);
  }
  const phases = c.night.phases;
  if (phases.length === 0 || phases[0].startMinute !== 0) errors.push('night: first phase must start at minute 0');
  return errors;
}

export function recipeFor(c: Content, item: ItemId): RecipeDef | undefined {
  return c.recipes.all().find((r) => r.output === item);
}

/** Every station involved in producing `item`, including stations for its inputs. */
export function stationChain(c: Content, item: ItemId, seen = new Set<ItemId>()): StationId[] {
  if (seen.has(item)) return [];
  seen.add(item);
  const r = recipeFor(c, item);
  if (!r) return [];
  const out = [r.station];
  for (const input of r.inputs) out.push(...stationChain(c, input, seen));
  return out;
}

export function isUnlocked(u: UnlockCondition, night: number, rating: number): boolean {
  return (u.minNight ?? 0) <= night && (u.minRating ?? 0) <= rating;
}

export function unlockedMenu(c: Content, night: number, rating: number): MenuEntry[] {
  return c.menu.filter((m) => isUnlocked(m.unlock, night, rating));
}

export function priceOf(c: Content, item: ItemId): number {
  return c.menu.find((m) => m.item === item)?.price ?? 0;
}
