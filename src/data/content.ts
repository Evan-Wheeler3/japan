import type {
  ArchetypeDef,
  EconomyConfig,
  IngredientDef,
  ItemDef,
  MenuEntry,
  NightConfig,
  RecipeDef,
  StationDef,
} from './types';

export const DIRTY_DISHES = 'dirty_dishes';

export const ITEMS: ItemDef[] = [
  { id: 'tea_green', name: 'Green Tea', icon: 'tea', visual: 'teaCup' },
  { id: 'edamame', name: 'Edamame', icon: 'edamame', visual: 'edamame' },
  { id: 'rice_portion', name: 'Sushi Rice', icon: 'rice', visual: 'riceBowl' },
  { id: 'nigiri_salmon', name: 'Salmon Nigiri', icon: 'nigiriSalmon', visual: 'nigiriSalmon' },
  { id: DIRTY_DISHES, name: 'Dirty Dishes', icon: 'dirty', visual: 'dirtyDishes' },
];

export const INGREDIENTS: IngredientDef[] = [
  { id: 'tea_leaves', name: 'Tea Leaves', unitCost: 30, capacity: 16 },
  { id: 'edamame_pods', name: 'Edamame', unitCost: 90, capacity: 10 },
  { id: 'rice', name: 'Rice', unitCost: 60, capacity: 6 },
  { id: 'salmon', name: 'Salmon', unitCost: 190, capacity: 10 },
];

export const STATIONS: StationDef[] = [
  { id: 'kettle', name: 'Tea Kettle' },
  { id: 'edamame_bowl', name: 'Edamame Bowl' },
  { id: 'rice_cooker', name: 'Rice Cooker' },
  { id: 'sushi_board', name: 'Sushi Board' },
];

export const RECIPES: RecipeDef[] = [
  {
    id: 'r_tea_green',
    output: 'tea_green',
    station: 'kettle',
    verb: 'Brew Tea',
    inputs: [],
    ingredients: [{ id: 'tea_leaves', qty: 1 }],
    prepSeconds: 5,
    batch: 2,
    dish: true,
  },
  {
    id: 'r_edamame',
    output: 'edamame',
    station: 'edamame_bowl',
    verb: 'Scoop Edamame',
    inputs: [],
    ingredients: [{ id: 'edamame_pods', qty: 1 }],
    prepSeconds: 0,
    batch: 1,
    dish: true,
  },
  {
    id: 'r_rice',
    output: 'rice_portion',
    station: 'rice_cooker',
    verb: 'Cook Rice',
    inputs: [],
    ingredients: [{ id: 'rice', qty: 1 }],
    prepSeconds: 9,
    batch: 4,
  },
  {
    id: 'r_nigiri_salmon',
    output: 'nigiri_salmon',
    station: 'sushi_board',
    verb: 'Make Salmon Nigiri',
    inputs: ['rice_portion'],
    ingredients: [{ id: 'salmon', qty: 1 }],
    prepSeconds: 4,
    batch: 1,
    dish: true,
  },
];

export const MENU: MenuEntry[] = [
  { item: 'tea_green', price: 250, unlock: { minNight: 1 } },
  { item: 'edamame', price: 350, unlock: { minNight: 1 } },
  { item: 'nigiri_salmon', price: 700, unlock: { minNight: 1 } },
];

const SKIN = [0xf1c9a5, 0xe0ac85, 0xc68a62, 0x9c6a48, 0xf6d8bc];

export const ARCHETYPES: ArchetypeDef[] = [
  {
    id: 'salaryman',
    name: 'Salaryman',
    looks: [
      [{ skin: SKIN[1], hair: 0x1b1714, top: 0x2b3140, bottom: 0x22252e, hairStyle: 'short', accent: 0xa8322d, scarf: 0x7a2a2a, height: 1 }],
      [{ skin: SKIN[0], hair: 0x241c18, top: 0x3a3f4c, bottom: 0x23262d, hairStyle: 'short', accent: 0x2d5ea8, height: 1.03 }],
      [{ skin: SKIN[2], hair: 0x120f0d, top: 0x4a3a2c, bottom: 0x1d1f25, hairStyle: 'short', accent: 0x7a6a2a, hat: 0x3a4a6a, height: 0.98 }],
    ],
    patienceSeconds: 75,
    itemsPerPerson: [1, 2],
    preferences: { nigiri_salmon: 3, tea_green: 1, edamame: 1.5 },
    tipRate: 0.12,
    eatSeconds: [8, 11],
    baseSpawnWeight: 1,
    spawnWeight: { opening: 0.6, early: 1.2, peak: 1.5, late: 1.8, winddown: 1.4 },
    seating: 'counter',
  },
  {
    id: 'elderly_couple',
    name: 'Elderly Couple',
    looks: [
      [
        { skin: SKIN[0], hair: 0xc9c6c0, top: 0x5b4636, bottom: 0x3b3430, hairStyle: 'bald', scarf: 0x9a8a5a, height: 0.95 },
        { skin: SKIN[4], hair: 0xd8d5d0, top: 0x6c3b47, bottom: 0x3a3236, hairStyle: 'bun', accent: 0xc9a46a, height: 0.9 },
      ],
      [
        { skin: SKIN[1], hair: 0xb8b4ae, top: 0x3f5544, bottom: 0x33302c, hairStyle: 'short', hat: 0x8a3a3a, height: 0.94 },
        { skin: SKIN[1], hair: 0xe2dfda, top: 0x4c5a78, bottom: 0x2f3038, hairStyle: 'bun', scarf: 0xd8b25c, height: 0.88 },
      ],
    ],
    patienceSeconds: 130,
    itemsPerPerson: [1, 1],
    preferences: { tea_green: 3, edamame: 1, nigiri_salmon: 1.2 },
    tipRate: 0.15,
    eatSeconds: [12, 16],
    baseSpawnWeight: 1,
    spawnWeight: { opening: 1.6, early: 1.2, peak: 0.6, late: 0.5, winddown: 1.0 },
    seating: 'any',
  },
  {
    id: 'family',
    name: 'Family',
    looks: [
      [
        { skin: SKIN[2], hair: 0x2a1d16, top: 0xb5553a, bottom: 0x2f3a52, hairStyle: 'long', height: 0.97 },
        { skin: SKIN[2], hair: 0x2a1d16, top: 0xe0b23c, bottom: 0x3a5a8a, hairStyle: 'short', hat: 0xd94f4f, height: 0.68 },
      ],
      [
        { skin: SKIN[3], hair: 0x16110e, top: 0x3d6b5a, bottom: 0x2c2c34, hairStyle: 'short', scarf: 0xc8a050, height: 1.02 },
        { skin: SKIN[3], hair: 0x16110e, top: 0xd96a8a, bottom: 0x40405a, hairStyle: 'bun', scarf: 0xf2e6c8, height: 0.66 },
      ],
    ],
    patienceSeconds: 95,
    itemsPerPerson: [1, 2],
    preferences: { edamame: 2.5, nigiri_salmon: 2, tea_green: 1 },
    tipRate: 0.1,
    eatSeconds: [10, 14],
    baseSpawnWeight: 1,
    spawnWeight: { opening: 1.4, early: 1.4, peak: 0.8, late: 0.3, winddown: 0.2 },
    seating: 'table',
  },
];

export const NIGHT: NightConfig = {
  startClockMinute: 23 * 60,
  secondsPerGameHour: 240,
  preDawnStartMinute: 255,
  lastCallMinute: 330,
  holdMinute: 360,
  sunriseEndMinute: 390,
  sunriseSeconds: 80,
  phases: [
    { id: 'opening', name: 'Opening', startMinute: 0, partiesPerHour: 2.0 },
    { id: 'early', name: 'Early Rush', startMinute: 30, partiesPerHour: 3.2 },
    { id: 'peak', name: 'Peak Rush', startMinute: 120, partiesPerHour: 4.2 },
    { id: 'late', name: 'Late Service', startMinute: 210, partiesPerHour: 2.6 },
    { id: 'winddown', name: 'Wind-Down', startMinute: 270, partiesPerHour: 1.2 },
  ],
  volumeGrowthPerNight: 0.08,
  maxVolumeMultiplier: 1.8,
};

export const ECONOMY: EconomyConfig = {
  startingCash: 2000,
  startingRating: 1,
  ratingMomentum: 0.75,
  patienceRefillOnServe: 0.25,
  patienceBonusNight1: 1.7,
  patienceBonusDecay: 0.1,
  startingCleanDishes: 12,
};
