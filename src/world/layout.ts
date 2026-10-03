import * as THREE from 'three';

/** Tier-1 floor plan. North (-Z) faces the ocean and Mount Fuji. */
export const ROOM = { minX: -6, maxX: 6, minZ: -4.5, maxZ: 4.5, height: 3.2, wall: 0.2 };

export const DOOR = { minX: 3.65, maxX: 4.75, height: 2.2 };

export const COUNTER = { minX: -6, maxX: -5.15, minZ: -3.6, maxZ: 3.6, top: 0.95 };

/** Z position (along the west counter) of each kitchen object. */
export const COUNTER_SLOTS = {
  kettle: -3.0,
  edamame_bowl: -1.95,
  rice_cooker: -0.85,
  sushi_board: 0.45,
  pass: 1.85,
  sink: 3.05,
} as const;

export const COUNTER_X = (COUNTER.minX + COUNTER.maxX) / 2;

export const CRATE = { x: -5.45, z: 4.0 };

export const TABLES = [
  { x: -1.4, z: -2.3 },
  { x: 2.6, z: -2.3 },
  { x: -1.4, z: 1.0 },
  { x: 2.6, z: 1.0 },
];

export const TABLE_SIZE = { w: 1.1, d: 0.8, h: 0.74 };
export const SEAT_OFFSET = 0.74;
export const SEAT_HEIGHT = 0.46;

export const AISLE_X = 0.6;
export const ENTRY = new THREE.Vector3(4.2, 0, 3.4);
export const OUTSIDE = new THREE.Vector3(4.2, 0, 9.5);
export const DOORWAY = new THREE.Vector3(4.2, 0, 4.5);

export const PLAYER_SPAWN = new THREE.Vector3(AISLE_X, 0, 3.4);

export const SIGN_POS = new THREE.Vector3(3.2, 1.45, 4.38);

export const WINDOWS_NORTH = [
  { a: -4.8, b: -1.8 },
  { a: -1.4, b: 1.4 },
  { a: 1.8, b: 4.8 },
];
export const WINDOW_EAST = { a: -3.6, b: -0.6 };
export const WINDOW_Y = { bottom: 0.85, top: 2.65 };

/** Building bounds used to keep snow out of the interior. */
export const BUILDING_BOUNDS = new THREE.Box3(new THREE.Vector3(-6.4, -1, -4.9), new THREE.Vector3(6.4, 5, 4.9));
