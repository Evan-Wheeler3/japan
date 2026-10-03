import * as THREE from 'three';

/** Architecture voxel size (metres). Layout values sit on this grid. */
export const S = 0.125;
export const WALL = 0.25;

/**
 * Plan (north = -Z faces the sea and Mount Fuji):
 *   west wing  x -9..-3.625   kitchen (ground) + apartment (upstairs)
 *   partition  x -3.625..-3.375  door, pass window, two belt slots
 *   east hall  x -3.375..7.5  dining hall with the conveyor-belt island and window tables
 */
export const KITCHEN = { minX: -9, maxX: -3.625, minZ: -5, maxZ: 5, height: 3.25 };
export const DINING = { minX: -3.375, maxX: 7.5, minZ: -5, maxZ: 5, height: 3.25 };
export const APARTMENT = { minX: -9, maxX: -3.625, minZ: -5, maxZ: 5, floor: 3.375, ceiling: 5.875 };
export const PARTITION = { minX: -3.625, maxX: -3.375 };
export const BUILDING = { minX: KITCHEN.minX, maxX: DINING.maxX, minZ: -5, maxZ: 5 };

export const FRONT_DOOR = { minX: 5.625, maxX: 6.75, height: 2.25 };
export const KITCHEN_DOOR = { minZ: 2.375, maxZ: 3.5, height: 2.25 };
export const PASS_WINDOW = { minZ: -3.25, maxZ: -2.0, bottom: 1.0, top: 1.875 };
export const BELT_SLOT = { halfWidth: 0.25, bottom: 0.875, top: 1.375 };

/** Kitchen work counters. */
export const WEST_COUNTER = { minX: -9, maxX: -8.25, minZ: -4.25, maxZ: 2.5, top: 1.0 };
export const NORTH_COUNTER = { minX: -8.25, maxX: -5.0, minZ: -5, maxZ: -4.25, top: 1.0 };
export const COUNTER_X = (WEST_COUNTER.minX + WEST_COUNTER.maxX) / 2;
export const COUNTER_TOP = 1.0;

/** Z position along the west counter of each cooking station. */
export const STATION_SLOTS: Record<string, number> = {
  kettle: -3.4,
  edamame_bowl: -2.3,
  rice_cooker: -1.15,
  sushi_board: 0.2,
};
export const SINK_POS = { x: -7.25, z: (NORTH_COUNTER.minZ + NORTH_COUNTER.maxZ) / 2 };
export const RACK_POS = { x: -5.85, z: (NORTH_COUNTER.minZ + NORTH_COUNTER.maxZ) / 2 };
export const CRATE = { x: -8.5, z: 3.3 };

/** Steep Japanese stairs along the kitchen's south wall: bottom at the east end, 1:1 rise. */
export const STAIRS = { bottomX: -4.5, topX: -7.875, minZ: 4.125, maxZ: 5.0 };

/** Conveyor belt loop: straight lanes at z = ±R between X_A (kitchen) and X_B (dining), semicircle ends. */
export const BELT = { xa: -6.0, xb: 4.4, r: 0.6, top: 0.94, laneHalf: 0.15, speed: 0.42 };
export const ISLAND = { halfWidth: 1.0, ledgeTop: 1.0, dividerHalf: 0.45 };
export const STOOL_Z = 1.45;
export const STOOL_HEIGHT = 0.72;

export interface SpotDef {
  id: string;
  label: string;
  kind: 'counter' | 'table';
  x: number;
  z: number;
  /** Counter spots: which belt lane they face (-1 north, +1 south). */
  side: -1 | 1;
}

export const TABLE_SIZE = { w: 1.25, d: 0.75, h: 0.75 };
export const SEAT_OFFSET = 0.75;
export const SEAT_HEIGHT = 0.5;

export const SPOTS: SpotDef[] = [
  { id: 'c1', label: 'Counter 1', kind: 'counter', x: -2.0, z: -STOOL_Z, side: -1 },
  { id: 'c2', label: 'Counter 2', kind: 'counter', x: 0.6, z: -STOOL_Z, side: -1 },
  { id: 'c3', label: 'Counter 3', kind: 'counter', x: 3.2, z: -STOOL_Z, side: -1 },
  { id: 'c4', label: 'Counter 4', kind: 'counter', x: 3.2, z: STOOL_Z, side: 1 },
  { id: 'c5', label: 'Counter 5', kind: 'counter', x: 0.6, z: STOOL_Z, side: 1 },
  { id: 'c6', label: 'Counter 6', kind: 'counter', x: -2.0, z: STOOL_Z, side: 1 },
  { id: 't1', label: 'Table 1', kind: 'table', x: -1.375, z: -3.875, side: -1 },
  { id: 't2', label: 'Table 2', kind: 'table', x: 2.625, z: -3.875, side: -1 },
  { id: 't3', label: 'Table 3', kind: 'table', x: 0.375, z: 3.875, side: 1 },
];

/** Customer walkways. */
export const AISLE_NORTH_Z = -2.25;
export const AISLE_SOUTH_Z = 2.25;
export const EAST_AISLE_X = 6.2;
export const OUTSIDE = new THREE.Vector3(6.19, 0, 11);
export const DOORWAY = new THREE.Vector3(6.19, 0, 5.2);
export const ENTRY = new THREE.Vector3(6.19, 0, 4.2);

export const SIGN_POS = new THREE.Vector3(5.1, 1.45, DINING.maxZ - 0.06);
export const PLAYER_SPAWN_APARTMENT = new THREE.Vector3(-6.2, APARTMENT.floor, -2.0);
export const PLAYER_SPAWN_KITCHEN = new THREE.Vector3(-5.0, 0, 3.0);

export const DINING_WINDOWS_NORTH = [
  { a: -2.75, b: -0.25 },
  { a: 0.75, b: 3.25 },
  { a: 4.25, b: 6.75 },
];
export const DINING_WINDOWS_SOUTH = [
  { a: -2.5, b: -0.5 },
  { a: 1.25, b: 3.25 },
];
export const DINING_WINDOWS_EAST = [
  { a: -3.5, b: -0.75 },
  { a: 0.75, b: 3.0 },
];
export const KITCHEN_WINDOW_NORTH = { a: -8.0, b: -5.5, bottom: 1.375, top: 2.25 };
export const APARTMENT_WINDOW_NORTH = { a: -8.25, b: -4.5 };
export const APARTMENT_WINDOW_SOUTH = { a: -4.5, b: -3.875 };
export const APARTMENT_WINDOW_WEST = { a: -1.25, b: 1.25 };
export const WINDOW_Y = { bottom: 0.875, top: 2.25 };

/** Interior air volumes for the light mask (slightly inflated so inner wall faces count as inside). */
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
export const ROOM_BOXES = [
  box(DINING.minX - 0.05, -0.3, DINING.minZ - 0.05, DINING.maxX + 0.05, DINING.height + 0.05, DINING.maxZ + 0.05),
  box(KITCHEN.minX - 0.05, -0.3, KITCHEN.minZ - 0.05, KITCHEN.maxX + 0.05, KITCHEN.height + 0.05, KITCHEN.maxZ + 0.05),
  box(APARTMENT.minX - 0.05, APARTMENT.floor - 0.06, APARTMENT.minZ - 0.05, APARTMENT.maxX + 0.05, APARTMENT.ceiling + 0.05, APARTMENT.maxZ + 0.05),
];

/** Building bounds used to keep snow out of the interior. */
export const BUILDING_BOUNDS = box(BUILDING.minX - 0.4, -1, BUILDING.minZ - 0.4, BUILDING.maxX + 0.4, 9, BUILDING.maxZ + 0.4);
