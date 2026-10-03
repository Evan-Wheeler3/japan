import * as THREE from 'three';

/** Architecture voxel size (metres). All layout values below sit on this grid. */
export const S = 0.125;

/** Tier-1 floor plan. North (-Z) faces the ocean and Mount Fuji. */
export const ROOM = { minX: -6, maxX: 6, minZ: -4.5, maxZ: 4.5, height: 3.25, wall: 0.25 };

export const DOOR = { minX: 3.625, maxX: 4.75, height: 2.25 };

export const COUNTER = { minX: -6, maxX: -5.125, minZ: -3.625, maxZ: 3.625, top: 1.0 };

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

export const CRATE = { x: -5.4, z: 4.0 };

export const TABLES = [
  { x: -1.375, z: -2.25 },
  { x: 2.625, z: -2.25 },
  { x: -1.375, z: 1.0 },
  { x: 2.625, z: 1.0 },
];

export const TABLE_SIZE = { w: 1.25, d: 0.75, h: 0.75 };
export const SEAT_OFFSET = 0.75;
export const SEAT_HEIGHT = 0.5;

export const AISLE_X = 0.625;
export const ENTRY = new THREE.Vector3(4.19, 0, 3.4);
export const OUTSIDE = new THREE.Vector3(4.19, 0, 9.5);
export const DOORWAY = new THREE.Vector3(4.19, 0, 4.6);

export const PLAYER_SPAWN = new THREE.Vector3(AISLE_X, 0, 3.4);

export const SIGN_POS = new THREE.Vector3(2.75, 1.45, 4.44);

export const WINDOWS_NORTH = [
  { a: -4.75, b: -1.75 },
  { a: -1.25, b: 1.25 },
  { a: 1.75, b: 4.75 },
];
export const WINDOWS_SOUTH = [
  { a: -4.25, b: -2.25 },
  { a: -1.25, b: 1.25 },
];
export const WINDOW_EAST = { a: -3.5, b: -0.75 };
export const WINDOW_Y = { bottom: 0.875, top: 2.25 };

/** Hanging lanterns that each carry a real point light. */
export const LANTERNS: { x: number; y: number; z: number; kind: 'paper' | 'red' }[] = [
  ...TABLES.map((t) => ({ x: t.x, y: ROOM.height, z: t.z, kind: 'paper' as const })),
  { x: -4.1, y: ROOM.height, z: -2.3, kind: 'paper' },
  { x: -4.1, y: ROOM.height, z: 2.3, kind: 'paper' },
];

/** Interior air volume (slightly inflated so inner wall faces count as inside). */
export const INTERIOR_BOUNDS = new THREE.Box3(new THREE.Vector3(-6.05, -0.3, -4.55), new THREE.Vector3(6.05, 3.3, 4.55));

/** Building bounds used to keep snow out of the interior. */
export const BUILDING_BOUNDS = new THREE.Box3(new THREE.Vector3(-6.4, -1, -4.9), new THREE.Vector3(6.4, 5.5, 4.9));
