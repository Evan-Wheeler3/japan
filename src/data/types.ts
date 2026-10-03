export type ItemId = string;
export type StationId = string;
export type IngredientId = string;
export type ArchetypeId = string;
export type PhaseId = string;

export type ItemVisual = 'teaCup' | 'edamame' | 'riceBowl' | 'nigiriSalmon' | 'dirtyDishes';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  visual: ItemVisual;
}

export interface IngredientDef {
  id: IngredientId;
  name: string;
  unitCost: number;
  capacity: number;
}

export interface StationDef {
  id: StationId;
  name: string;
}

/** A recipe turns placed input items + pantry ingredients into `batch` units of `output` at one station. */
export interface RecipeDef {
  id: string;
  output: ItemId;
  station: StationId;
  verb: string;
  inputs: ItemId[];
  ingredients: { id: IngredientId; qty: number }[];
  prepSeconds: number;
  batch: number;
}

export interface UnlockCondition {
  minNight?: number;
  minRating?: number;
}

export interface MenuEntry {
  item: ItemId;
  price: number;
  unlock: UnlockCondition;
}

export type HairStyle = 'short' | 'long' | 'bald' | 'bun';

export interface CustomerLook {
  skin: number;
  hair: number;
  top: number;
  bottom: number;
  hairStyle: HairStyle;
  accent?: number;
  hat?: number;
  scarf?: number;
  height: number;
}

export interface ArchetypeDef {
  id: ArchetypeId;
  name: string;
  /** One look per party member; party size = looks.length. */
  looks: CustomerLook[][];
  patienceSeconds: number;
  itemsPerPerson: [number, number];
  preferences: Record<ItemId, number>;
  tipRate: number;
  eatSeconds: [number, number];
  baseSpawnWeight: number;
  spawnWeight: Partial<Record<PhaseId, number>>;
}

export interface PhaseDef {
  id: PhaseId;
  name: string;
  startMinute: number;
  partiesPerHour: number;
}

/** All minute values are game-minutes elapsed since the shift opened. */
export interface NightConfig {
  startClockMinute: number;
  secondsPerGameHour: number;
  preDawnStartMinute: number;
  lastCallMinute: number;
  holdMinute: number;
  sunriseEndMinute: number;
  sunriseSeconds: number;
  phases: PhaseDef[];
  volumeGrowthPerNight: number;
  maxVolumeMultiplier: number;
}

export interface EconomyConfig {
  startingCash: number;
  startingRating: number;
  ratingMomentum: number;
  patienceRefillOnServe: number;
}
