import * as THREE from 'three';
import type { Rect, SurfaceDef } from './geometry';
import {
  APARTMENT,
  APARTMENT_WINDOW_NORTH,
  APARTMENT_WINDOW_SOUTH,
  APARTMENT_WINDOW_WEST,
  BELT,
  BELT_SLOT,
  CRATE,
  DINING,
  DINING_WINDOWS_EAST,
  DINING_WINDOWS_NORTH,
  DINING_WINDOWS_SOUTH,
  FRONT_DOOR,
  ISLAND,
  KITCHEN,
  KITCHEN_DOOR,
  KITCHEN_WINDOW_NORTH,
  NORTH_COUNTER,
  PASS_WINDOW,
  S,
  SEAT_OFFSET,
  SPOTS,
  STAIRS,
  TABLE_SIZE,
  WEST_COUNTER,
  WINDOW_Y,
} from './layout';
import { signTexture } from './materials';
import { makeGlowPool } from './stations';
import * as P from './props';
import { F } from './props';
import { C, PAL } from './voxel/palette';
import { DenseGrid, glowMaterial, meshGrid, PropBatch, solidMaterial, Vox } from './voxel/vox';

export interface LightDef {
  light: THREE.PointLight;
  flicker: boolean;
}

export interface RestaurantBuild {
  group: THREE.Group;
  blockers: THREE.Object3D[];
  colliders: Rect[];
  surfaces: SurfaceDef[];
  lights: LightDef[];
  menuBoard: THREE.Mesh;
}

const v = (m: number) => Math.round(m / S);
const mod = (a: number, n: number) => ((a % n) + n) % n;
const hash = (a: number, b: number, c = 0) => mod(Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791), 1000) / 1000;

// Voxel-space room bounds (exclusive max).
const KX0 = v(KITCHEN.minX);
const KX1 = v(KITCHEN.maxX);
const DX0 = v(DINING.minX);
const DX1 = v(DINING.maxX);
const Z0 = v(DINING.minZ);
const Z1 = v(DINING.maxZ);
const H = v(DINING.height);
const AF = v(APARTMENT.floor);
const AC = v(APARTMENT.ceiling);

const diningRoofTop = (z: number) => 41 - Math.floor(Math.abs(z + 0.5) / 3);
const wingRoofTop = (x: number) => 60 - Math.floor(Math.abs(x + 50.5) / 3);

const stoneFn = (x: number, y: number, z: number) => [C.stone, C.stoneL, C.stoneD][mod(Math.floor(x / 2) * 7 + Math.floor(z / 2) * 13 + y * 3, 3)];
const planks = (a: number, b: number) => (t: number) => (mod(Math.floor(t / 2), 2) ? a : b);

/** Interior wall finish by height above the room's floor (in voxels). */
function interiorWall(t: number, yl: number, upstairs: boolean): number {
  if (yl < 0) return C.beam;
  if (yl < 7) return yl === 6 ? C.darkWood : planks(C.midWood, C.midWood2)(t);
  if (upstairs) return yl >= 17 ? C.darkWood : C.plaster;
  if (yl < 18) return C.plaster;
  if (yl < 20) return C.darkWood;
  return C.plaster2;
}

function exteriorWall(t: number, y: number): number {
  if (y < 8) return planks(C.extWood, C.extWood2)(t);
  if (y === 8 || y === 19 || y === 26) return C.beam;
  if (y > 26) return planks(C.extWood, C.extWood2)(t);
  return C.extPlaster;
}

interface Opening {
  a: number;
  b: number;
  y0: number;
  y1: number;
  door?: boolean;
  lattice?: number;
}

interface WallSpec {
  axis: 'x' | 'z';
  inner: number;
  outer: number;
  inward: 1 | -1;
  from: number;
  to: number;
  y0: number;
  y1: number;
  floorY: number;
  upstairs?: boolean;
  openings?: Opening[];
  pillars?: number[];
  roomFrom: number;
  roomTo: number;
  /** Outer layer uses the interior finish too (e.g. the kitchen/dining partition). */
  bothInterior?: boolean;
}

function wall(vox: Vox, w: WallSpec): void {
  const put = (t: number, y: number, layer: number, p: number) => (w.axis === 'x' ? vox.set(t, y, layer, p) : vox.set(layer, y, t, p));
  const inRoom = (t: number) => t >= w.roomFrom && t < w.roomTo;
  for (let t = w.from; t < w.to; t++)
    for (let y = w.y0; y < w.y1; y++) {
      const yl = y - w.floorY;
      const o = w.openings?.find((op) => t >= op.a && t < op.b && y >= op.y0 && y < op.y1);
      if (o) {
        const edge = t === o.a || t === o.b - 1 || y === o.y1 - 1 || (!o.door && y === o.y0);
        if (edge) {
          put(t, y, w.inner, C.darkWood);
          put(t, y, w.outer, C.darkWood);
        } else if (!o.door && o.lattice && mod(t - o.a, o.lattice) === 0) {
          put(t, y, w.outer, C.beam);
        }
        if (!o.door && y === o.y0 && t > o.a && t < o.b - 1 && inRoom(t)) put(t, y, w.inner + w.inward, C.hinoki);
        continue;
      }
      put(t, y, w.inner, interiorWall(t, yl, !!w.upstairs));
      put(t, y, w.outer, w.bothInterior ? interiorWall(t, yl, !!w.upstairs) : exteriorWall(t, y));
      if (!w.upstairs && (yl === 18 || yl === 19) && inRoom(t)) put(t, y, w.inner + w.inward, C.darkWood);
    }
  for (const p of w.pillars ?? [])
    for (let t = p; t < p + 2; t++)
      for (let y = w.y0; y < w.y1; y++) {
        if (w.openings?.some((op) => t >= op.a && t < op.b && y >= op.y0 && y < op.y1)) continue;
        put(t, y, w.inner, C.beam);
        put(t, y, w.outer, C.beam);
        if (inRoom(t)) put(t, y, w.inner + w.inward, C.beam);
        if (!w.bothInterior) put(t, y, w.outer - w.inward, C.beam);
      }
}

function snowCover(g: DenseGrid): void {
  for (let x = 0; x < g.sx; x++)
    for (let z = 0; z < g.sz; z++) {
      let top = -1;
      for (let y = g.sy - 1; y >= 0; y--)
        if (g.get(x, y, z)) {
          top = y;
          break;
        }
      if (top < 0 || top + 1 >= g.sy) continue;
      const p = g.get(x, top, z);
      const wy = top + g.min[1];
      if (p === C.snow || p === C.snow2 || PAL.glow[p] > 0 || p === C.ice) continue;
      if (wy <= -1 && (p === C.stone || p === C.stoneL || p === C.stoneD)) continue;
      const wx = x + g.min[0];
      const wz = z + g.min[2];
      g.set(x, top + 1, z, hash(wx, wz) > 0.5 ? C.snow : C.snow2);
      const drift = Math.sin(wx * 0.23) + Math.sin(wz * 0.31 + wx * 0.07);
      if (wy > 20 && drift > 0.9 && top + 2 < g.sy) g.set(x, top + 2, z, C.snow);
    }
}

/** Distance (metres) from (x,z) to the belt island's spine; the oval island is all points within ISLAND.halfWidth. */
export function islandDistance(x: number, z: number): number {
  const cx = Math.max(BELT.xa, Math.min(BELT.xb, x));
  return Math.hypot(x - cx, z);
}

export function buildRestaurant(): RestaurantBuild {
  const vox = new Vox();
  const root = new THREE.Group();
  root.name = 'restaurant';
  const props = new PropBatch();
  const colliders: Rect[] = [];
  const surfaces: SurfaceDef[] = [];
  const lights: LightDef[] = [];
  const rect = (minX: number, maxX: number, minZ: number, maxZ: number, minY?: number, maxY?: number) => colliders.push({ minX, maxX, minZ, maxZ, minY, maxY });
  const UP = APARTMENT.floor;

  // ---------- Ground with drifts, path, foundation ----------
  const pathX = [v(FRONT_DOOR.minX) - 1, v(FRONT_DOOR.maxX) + 1];
  for (let x = -96; x < 96; x++)
    for (let z = -80; z < 112; z++) {
      vox.set(x, -1, z, hash(x, z) > 0.7 ? C.snow2 : C.snow);
      const nearBuilding = x > KX0 - 8 && x < DX1 + 8 && z > -70 && z < Z1 + 6;
      const onPath = x >= pathX[0] - 4 && x <= pathX[1] + 4 && z >= Z1;
      if (nearBuilding || onPath) continue;
      const n = Math.sin(x * 0.09) + Math.sin(z * 0.11 + x * 0.03) + 0.5 * Math.sin(x * 0.23 + z * 0.19);
      const edge = Math.min(1, Math.max(Math.abs(x) - 70, z - 90, 0) / 20);
      const h = Math.max(0, Math.min(5, Math.floor((n - 0.4) * 1.8 + edge * 3)));
      for (let y = 0; y < h; y++) vox.set(x, y, z, y === h - 1 && hash(z, x) > 0.6 ? C.snow2 : C.snow);
    }
  for (let i = 0; i < 9; i++) {
    const z0 = Z1 + 3 + i * 6;
    const x0 = pathX[0] + 1 + (i % 2 ? 2 : 0);
    vox.box(x0, -1, z0, x0 + 6, 0, z0 + 4, i % 2 ? C.stoneL : C.stone);
  }
  vox.box(pathX[0], -1, Z1, pathX[1], 0, Z1 + 3, C.stoneL);
  vox.box(KX0 - 3, -1, Z0 - 3, DX1 + 3, 0, Z1 + 3, stoneFn);
  for (const [x0, x1, z0, z1] of [
    [KX0 - 3, DX1 + 3, Z0 - 3, Z0 - 2],
    [KX0 - 3, DX1 + 3, Z1 + 2, Z1 + 3],
    [KX0 - 3, KX0 - 2, Z0 - 2, Z1 + 2],
    [DX1 + 2, DX1 + 3, Z0 - 2, Z1 + 2],
  ])
    vox.box(x0, 0, z0, x1, 1, z1, stoneFn);
  vox.box(pathX[0] + 1, 0, Z1 + 2, pathX[1] - 1, 1, Z1 + 3, 0);

  // ---------- Floors and ceilings ----------
  vox.box(KX0, -1, Z0, KX1, 0, Z1, (x, _y, z) => (mod(Math.floor(x / 2) + Math.floor(z / 2), 2) ? C.slate : C.slate2));
  vox.box(DX0 - 2, -1, Z0, DX1, 0, Z1, (x, _y, z) => {
    const row = Math.floor(z / 2);
    const seg = Math.floor((x + mod(row * 5, 12)) / 12);
    return [C.floorA, C.floorB, C.floorC][mod(row * 31 + seg * 17, 3)];
  });
  const sx0 = v(STAIRS.topX);
  const sx1 = v(STAIRS.bottomX);
  const sz0 = v(STAIRS.minZ);
  const sz1 = v(STAIRS.maxZ);
  // apartment floor = kitchen ceiling, with the stairwell opening
  vox.box(KX0 - 2, H, Z0 - 2, KX1 + 2, AF, Z1 + 2, (x, _y, z) => {
    if (x >= sx0 && x < sx1 && z >= sz0 && z < sz1) return 0;
    return mod(Math.floor(z / 2), 2) ? C.floorA : C.floorB;
  });
  vox.box(DX0 - 2, H, Z0 - 2, DX1 + 2, H + 1, Z1 + 2, (x) => (mod(Math.floor(x / 2), 2) ? C.darkWood : C.darkWood2));
  vox.box(KX0 - 2, AC, Z0 - 2, KX1 + 2, AC + 1, Z1 + 2, (z) => (mod(Math.floor(z / 2), 2) ? C.darkWood : C.darkWood2));
  for (let bx = DX0 + 6; bx < DX1; bx += 12) vox.box(bx - 1, H - 2, Z0, bx + 1, H, Z1, C.beam);
  vox.box(DX0, H - 3, -1, DX1, H, 1, C.beam);
  for (let bz = Z0 + 6; bz < Z1; bz += 14) vox.box(KX0, H - 2, bz, KX1, H, bz + 2, (x) => (x >= sx0 && x < sx1 && bz >= sz0 - 2 ? 0 : C.beam));
  for (let bx = KX0 + 8; bx < KX1; bx += 12) vox.box(bx - 1, AC - 2, Z0, bx + 1, AC, Z1, C.beam);

  // ---------- Walls ----------
  const win = (a: number, b: number, bottom = WINDOW_Y.bottom, top = WINDOW_Y.top, lattice = 8): Opening => ({ a: v(a), b: v(b), y0: v(bottom), y1: v(top), lattice });
  const upWin = (a: number, b: number): Opening => ({ a: v(a), b: v(b), y0: AF + 6, y1: AF + 15, lattice: 6 });
  // dining hall (single storey)
  wall(vox, { axis: 'x', inner: Z0 - 1, outer: Z0 - 2, inward: 1, from: DX0 - 2, to: DX1 + 2, y0: 0, y1: H, floorY: 0, openings: DINING_WINDOWS_NORTH.map((w) => win(w.a, w.b)), pillars: [DX0, -9, 15, 40, 58], roomFrom: DX0, roomTo: DX1 });
  wall(vox, {
    axis: 'x',
    inner: Z1,
    outer: Z1 + 1,
    inward: -1,
    from: DX0 - 2,
    to: DX1 + 2,
    y0: 0,
    y1: H,
    floorY: 0,
    openings: [...DINING_WINDOWS_SOUTH.map((w) => win(w.a, w.b)), { a: v(FRONT_DOOR.minX), b: v(FRONT_DOOR.maxX), y0: 0, y1: v(FRONT_DOOR.height), door: true }],
    pillars: [DX0, -2, 27, 43, 58],
    roomFrom: DX0,
    roomTo: DX1,
  });
  wall(vox, { axis: 'z', inner: DX1, outer: DX1 + 1, inward: -1, from: Z0, to: Z1, y0: 0, y1: H, floorY: 0, openings: DINING_WINDOWS_EAST.map((w) => win(w.a, w.b)), pillars: [Z0, -4, 30], roomFrom: Z0, roomTo: Z1 });
  // kitchen wing: ground storey and apartment
  const kitchenWin = win(KITCHEN_WINDOW_NORTH.a, KITCHEN_WINDOW_NORTH.b, KITCHEN_WINDOW_NORTH.bottom, KITCHEN_WINDOW_NORTH.top, 5);
  wall(vox, { axis: 'x', inner: Z0 - 1, outer: Z0 - 2, inward: 1, from: KX0 - 2, to: KX1 + 2, y0: 0, y1: H, floorY: 0, openings: [kitchenWin], pillars: [KX0, -44], roomFrom: KX0, roomTo: KX1 });
  wall(vox, { axis: 'x', inner: Z1, outer: Z1 + 1, inward: -1, from: KX0 - 2, to: KX1 + 2, y0: 0, y1: H, floorY: 0, pillars: [KX0], roomFrom: KX0, roomTo: KX1 });
  wall(vox, { axis: 'z', inner: KX0 - 1, outer: KX0 - 2, inward: 1, from: Z0, to: Z1, y0: 0, y1: H, floorY: 0, pillars: [Z0, Z1 - 2], roomFrom: Z0, roomTo: Z1 });
  wall(vox, { axis: 'x', inner: Z0 - 1, outer: Z0 - 2, inward: 1, from: KX0 - 2, to: KX1 + 2, y0: H, y1: AC, floorY: AF, upstairs: true, openings: [upWin(APARTMENT_WINDOW_NORTH.a, APARTMENT_WINDOW_NORTH.b)], pillars: [KX0, KX1 - 2], roomFrom: KX0, roomTo: KX1 });
  wall(vox, { axis: 'x', inner: Z1, outer: Z1 + 1, inward: -1, from: KX0 - 2, to: KX1 + 2, y0: H, y1: AC, floorY: AF, upstairs: true, openings: [upWin(APARTMENT_WINDOW_SOUTH.a, APARTMENT_WINDOW_SOUTH.b)], pillars: [KX0], roomFrom: KX0, roomTo: KX1 });
  wall(vox, { axis: 'z', inner: KX0 - 1, outer: KX0 - 2, inward: 1, from: Z0, to: Z1, y0: H, y1: AC, floorY: AF, upstairs: true, openings: [upWin(APARTMENT_WINDOW_WEST.a, APARTMENT_WINDOW_WEST.b)], pillars: [Z0, Z1 - 2], roomFrom: Z0, roomTo: Z1 });
  // partition: kitchen | dining on the ground floor, apartment | outside above the dining roof
  const slot = (c: number): Opening => ({ a: v(c - BELT_SLOT.halfWidth), b: v(c + BELT_SLOT.halfWidth), y0: v(BELT_SLOT.bottom), y1: v(BELT_SLOT.top) });
  wall(vox, {
    axis: 'z',
    inner: KX1,
    outer: KX1 + 1,
    inward: -1,
    from: Z0,
    to: Z1,
    y0: 0,
    y1: H,
    floorY: 0,
    bothInterior: true,
    openings: [
      { a: v(KITCHEN_DOOR.minZ), b: v(KITCHEN_DOOR.maxZ), y0: 0, y1: v(KITCHEN_DOOR.height), door: true },
      { a: v(PASS_WINDOW.minZ), b: v(PASS_WINDOW.maxZ), y0: v(PASS_WINDOW.bottom), y1: v(PASS_WINDOW.top), lattice: 0 },
      slot(-BELT.r),
      slot(BELT.r),
    ],
    pillars: [-14, 13],
    roomFrom: Z0,
    roomTo: Z1,
  });
  wall(vox, { axis: 'z', inner: KX1 - 1, outer: KX1 + 1, inward: -1, from: Z0, to: Z1, y0: H, y1: AC, floorY: AF, upstairs: true, roomFrom: Z0, roomTo: Z1 });
  // partition outer face above the dining roof reads as exterior siding
  for (let z = Z0 - 2; z < Z1 + 2; z++) for (let y = H + 1; y < AC; y++) vox.set(KX1 + 1, y, z, exteriorWall(z, y));
  // pass-window ledges on both sides
  vox.box(KX1 - 3, v(PASS_WINDOW.bottom) - 1, v(PASS_WINDOW.minZ), KX1 + 5, v(PASS_WINDOW.bottom), v(PASS_WINDOW.maxZ), C.hinoki);
  surfaces.push({ minX: KITCHEN.maxX - 0.35, maxX: DINING.minX + 0.6, minZ: PASS_WINDOW.minZ + 0.05, maxZ: PASS_WINDOW.maxZ - 0.05, top: PASS_WINDOW.bottom });

  // ---------- Roofs ----------
  // dining hall: gable along x, ridge at z = 0
  for (let x = DX0; x < DX1 + 4; x++)
    for (let z = Z0 - 9; z < Z1 + 9; z++) {
      const top = diningRoofTop(z);
      vox.set(x, top - 2, z, C.darkWood);
      vox.set(x, top - 1, z, mod(x, 2) === 0 ? C.roof : C.roof2);
    }
  vox.box(DX0, 41, -2, DX1 + 4, 42, 2, C.roof2);
  vox.box(DX1 + 3, 41, -2, DX1 + 6, 44, 2, C.roof2);
  for (let x = DX1; x < DX1 + 2; x++) for (let z = Z0 - 2; z < Z1 + 2; z++) for (let y = H; y < diningRoofTop(z) - 2; y++) vox.set(x, y, z, mod(z, 10) === 0 || y === H + 1 ? C.beam : C.extPlaster);
  // kitchen wing: taller gable along z, ridge at x = -50.5
  for (let x = KX0 - 5; x < KX1 + 6; x++)
    for (let z = Z0 - 4; z < Z1 + 4; z++) {
      const top = wingRoofTop(x);
      vox.set(x, top - 2, z, C.darkWood);
      vox.set(x, top - 1, z, mod(z, 2) === 0 ? C.roof : C.roof2);
    }
  vox.box(-53, 60, Z0 - 4, -48, 61, Z1 + 4, C.roof2);
  vox.box(-53, 60, Z0 - 6, -48, 63, Z0 - 3, C.roof2);
  vox.box(-53, 60, Z1 + 3, -48, 63, Z1 + 6, C.roof2);
  for (const zw of [Z0 - 2, Z1]) for (let z = zw; z < zw + 2; z++) for (let x = KX0 - 2; x < KX1 + 2; x++) for (let y = AC; y < wingRoofTop(x) - 2; y++) vox.set(x, y, z, mod(x, 10) === 0 || y === AC + 1 ? C.beam : C.extPlaster);
  for (const xw of [KX0 - 2, KX1]) for (let x = xw; x < xw + 2; x++) for (let z = Z0 - 2; z < Z1 + 2; z++) for (let y = AC; y < wingRoofTop(x) - 2; y++) vox.set(x, y, z, C.extWood);
  // icicles
  for (const ez of [Z0 - 9, Z1 + 8])
    for (let x = DX0 + 4; x < DX1 + 4; x += 2) {
      const len = Math.floor(hash(x, ez) * 4);
      for (let k = 1; k <= len; k++) vox.set(x, diningRoofTop(ez) - 2 - k, ez, C.ice);
    }
  for (const ex of [KX0 - 5, KX1 + 5])
    for (let z = Z0 - 4; z < Z1 + 4; z += 2) {
      const len = Math.floor(hash(z, ex) * 4);
      for (let k = 1; k <= len; k++) vox.set(ex, wingRoofTop(ex) - 2 - k, z, C.ice);
    }

  // ---------- Deck along the dining hall's sea side ----------
  const deckZ0 = -66;
  vox.box(DX0 - 2, -1, deckZ0, DX1, 0, Z0 - 3, (_x, _y, z) => (mod(Math.floor(z / 2), 2) ? C.deck : C.deck2));
  for (let x = DX0; x < DX1; x += 16) for (const z of [deckZ0 + 1, -54]) vox.box(x, -26, z, x + 2, -1, z + 2, C.darkWood);
  for (let x = DX0 - 2; x < DX1; x += 10) vox.box(x, 0, deckZ0, x + 1, 8, deckZ0 + 1, C.beam);
  vox.box(DX0 - 2, 7, deckZ0, DX1, 8, deckZ0 + 1, C.darkWood);
  vox.box(DX0 - 2, 4, deckZ0, DX1, 5, deckZ0 + 1, C.darkWood);
  for (const x of [DX0 - 2, DX1 - 1]) {
    for (let z = deckZ0; z < Z0 - 3; z += 10) vox.box(x, 0, z, x + 1, 8, z + 1, C.beam);
    vox.box(x, 7, deckZ0, x + 1, 8, Z0 - 3, C.darkWood);
    vox.box(x, 4, deckZ0, x + 1, 5, Z0 - 3, C.darkWood);
  }

  // ---------- Exterior details ----------
  const toro = (cx: number, cz: number) => {
    vox.box(cx - 2, 0, cz - 2, cx + 3, 1, cz + 3, C.stoneL);
    vox.box(cx, 1, cz, cx + 1, 6, cz + 1, C.stoneL);
    vox.box(cx - 1, 6, cz - 1, cx + 2, 9, cz + 2, C.stoneL);
    for (const [dx, dz] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [0, 0],
    ])
      vox.set(cx + dx, 7, cz + dz, C.candle);
    vox.box(cx - 2, 9, cz - 2, cx + 3, 10, cz + 3, C.stoneL);
    vox.box(cx - 1, 10, cz - 1, cx + 2, 11, cz + 2, C.stone);
  };
  const toros = [
    [pathX[1] + 6, Z1 + 12],
    [pathX[0] - 7, Z1 + 30],
    [pathX[1] + 6, Z1 + 48],
  ];
  for (const [x, z] of toros) toro(x, z);
  // snow drifts against the walls
  for (let x = KX0 - 4; x < DX1 + 4; x++) {
    if (x >= pathX[0] - 1 && x <= pathX[1] + 1) continue;
    const h1 = Math.floor(hash(x, 3) * 4);
    for (let k = 0; k < h1; k++) vox.set(x, k, Z1 + 3, C.snow);
    for (let k = 0; k < Math.floor(hash(x, 5) * 2); k++) vox.set(x, k, Z1 + 4, C.snow2);
  }
  for (let z = Z0 - 3; z < Z1 + 3; z++) {
    for (const x of [KX0 - 4, DX1 + 3]) {
      const h = Math.floor(hash(z, x) * 4);
      for (let k = 0; k < h; k++) vox.set(x, k, z, C.snow);
    }
  }
  vox.box(KX0 - 6, 0, -16, KX0 - 3, 6, 8, (x, y, z) => (mod(x + y * 2 + z, 3) === 0 ? C.lightWood : mod(z + y, 2) ? C.midWood : C.midWood2));

  // ---------- Kitchen: counters, backsplash, shelves ----------
  const wc = { x0: v(WEST_COUNTER.minX), x1: v(WEST_COUNTER.maxX), z0: v(WEST_COUNTER.minZ), z1: v(WEST_COUNTER.maxZ), top: v(WEST_COUNTER.top) };
  vox.box(wc.x0, 0, wc.z0, wc.x1, wc.top - 1, wc.z1, (x, y, z) => (x === wc.x1 - 1 ? (y === 0 ? C.beam : planks(C.midWood, C.midWood2)(z)) : C.darkWood));
  vox.box(wc.x0, wc.top - 1, wc.z0 - 1, wc.x1 + 1, wc.top, wc.z1 + 1, (_x, _y, z) => (mod(Math.floor(z / 4), 2) ? C.hinoki : C.hinoki2));
  const nc = { x0: v(NORTH_COUNTER.minX), x1: v(NORTH_COUNTER.maxX), z0: v(NORTH_COUNTER.minZ), z1: v(NORTH_COUNTER.maxZ) };
  vox.box(nc.x0, 0, nc.z0, nc.x1, wc.top - 1, nc.z1, (x, y, z) => (z === nc.z1 - 1 ? (y === 0 ? C.beam : planks(C.midWood, C.midWood2)(x)) : C.darkWood));
  vox.box(nc.x0, wc.top - 1, nc.z0, nc.x1 + 1, wc.top, nc.z1 + 1, (x) => (mod(Math.floor(x / 4), 2) ? C.hinoki : C.hinoki2));
  vox.box(KX0, wc.top, wc.z0, KX0 + 1, wc.top + 6, wc.z1, (_x, y, z) => (mod(y + z, 2) ? C.tile : C.tile2));
  vox.box(KX0, wc.top, Z0, nc.x1, wc.top + 3, Z0 + 1, (x, y) => (mod(y + x, 2) ? C.tile : C.tile2));
  for (const sy of [15, 20]) {
    vox.box(KX0, sy, wc.z0 + 1, KX0 + 3, sy + 1, wc.z1 - 1, C.midWood);
    for (let z = wc.z0 + 3; z < wc.z1 - 2; z += 10) vox.box(KX0, sy - 1, z, KX0 + 1, sy, z + 1, C.darkWood);
  }
  rect(WEST_COUNTER.minX, WEST_COUNTER.maxX + 0.125, WEST_COUNTER.minZ - 0.125, WEST_COUNTER.maxZ + 0.125, 0, 1.2);
  rect(NORTH_COUNTER.minX, NORTH_COUNTER.maxX + 0.125, NORTH_COUNTER.minZ, NORTH_COUNTER.maxZ + 0.125, 0, 1.2);
  rect(CRATE.x - 0.45, CRATE.x + 0.45, CRATE.z - 0.35, CRATE.z + 0.35, 0, 1);
  surfaces.push({ minX: WEST_COUNTER.minX + 0.05, maxX: WEST_COUNTER.maxX + 0.1, minZ: WEST_COUNTER.minZ, maxZ: WEST_COUNTER.maxZ, top: WEST_COUNTER.top });
  surfaces.push({ minX: NORTH_COUNTER.minX, maxX: NORTH_COUNTER.maxX + 0.1, minZ: NORTH_COUNTER.minZ + 0.05, maxZ: NORTH_COUNTER.maxZ + 0.1, top: NORTH_COUNTER.top });

  const shelfX = KITCHEN.minX + 0.2;
  for (let i = 0; i < 16; i++) {
    const z = WEST_COUNTER.minZ + 0.25 + i * 0.4;
    const kind = i % 4;
    if (kind === 3) props.add(P.jar(i), shelfX, 2.0, z);
    else if (kind === 2) props.add(P.bowlStack(), shelfX, 2.0, z);
    else props.add(P.sakeBottle(i), shelfX, 2.0, z);
  }
  props.add(P.daruma(), shelfX, 2.625, -1.0, Math.PI / 2);
  props.add(P.radio(), shelfX, 2.625, 1.6, Math.PI / 2);
  props.add(P.pottedPlant(1), shelfX, 2.625, -2.6);
  props.add(P.jar(1), shelfX, 2.625, 0.6);
  props.add(P.teapot(), shelfX, 2.625, -0.2, Math.PI / 2);

  // ---------- Stairs to the apartment ----------
  for (let x = sx0; x < sx1; x++) {
    const step = Math.min(AF, (Math.floor((sx1 - 1 - x) / 2) + 1) * 2);
    vox.box(x, 0, sz0, x + 1, step, sz1, (_x, y) => (y === step - 1 ? C.lightWood : C.darkWood));
  }
  for (let x = sx0; x < sx1; x++) {
    const step = Math.min(AF, (Math.floor((sx1 - 1 - x) / 2) + 1) * 2);
    vox.box(x, 0, sz0 - 1, x + 1, step + 6, sz0, (_x, y) => (y >= step + 5 ? C.hinoki : y < step ? C.darkWood : 0));
    if (mod(x, 6) === 0) vox.box(x, step, sz0 - 1, x + 1, step + 5, sz0, C.darkWood);
  }
  rect(STAIRS.topX, STAIRS.bottomX, STAIRS.minZ - 0.15, STAIRS.minZ, 0, 6);
  // apartment railing around the stairwell
  vox.box(sx0, AF, sz0 - 1, sx1 + 1, AF + 7, sz0, (x, y) => (y === AF + 6 ? C.hinoki : mod(x, 4) === 0 ? C.darkWood : 0));
  vox.box(sx1, AF, sz0, sx1 + 1, AF + 7, sz1, (_x, y, z) => (y === AF + 6 ? C.hinoki : mod(z, 4) === 0 ? C.darkWood : 0));
  rect(STAIRS.bottomX, STAIRS.bottomX + 0.15, STAIRS.minZ - 0.15, STAIRS.maxZ, UP - 0.4, 7);

  // ---------- Belt island (spans both rooms through the partition) ----------
  const ix0 = v(BELT.xa - ISLAND.halfWidth) - 1;
  const ix1 = v(BELT.xb + ISLAND.halfWidth) + 1;
  for (let x = ix0; x < ix1; x++)
    for (let z = -9; z < 9; z++) {
      const d = islandDistance((x + 0.5) * S, (z + 0.5) * S);
      if (d >= ISLAND.halfWidth) continue;
      for (let y = 0; y < 11; y++) vox.set(x, y, z, 0);
      if (d < ISLAND.dividerHalf) {
        vox.box(x, 0, z, x + 1, 8, z + 1, (_x, y) => (y === 0 ? C.beam : C.darkWood));
        vox.set(x, 8, z, d < 0.2 ? C.lightWood : C.hinoki);
      } else if (d < BELT.r + BELT.laneHalf) {
        vox.box(x, 0, z, x + 1, 6, z + 1, (_x, y) => (y === 0 ? C.beam : C.darkWood));
        vox.set(x, 6, z, C.steelD);
      } else {
        vox.box(x, 0, z, x + 1, 7, z + 1, (_x, y) => (y === 0 ? C.beam : d > ISLAND.halfWidth - 0.13 ? planks(C.midWood, C.midWood2)(x + z) : C.darkWood));
        vox.set(x, 7, z, mod(Math.floor(x / 4), 2) ? C.hinoki : C.hinoki2);
      }
    }
  // keep the partition wall above the belt
  for (let x = KX1; x < KX1 + 2; x++) for (let z = -9; z < 9; z++) for (let y = 11; y < H; y++) if (!vox.get(x, y, z)) vox.set(x, y, z, interiorWall(z, y, false));
  rect(BELT.xa - ISLAND.halfWidth, BELT.xb + ISLAND.halfWidth, -ISLAND.halfWidth, ISLAND.halfWidth, 0, 1.2);
  // the outer ledges are placeable surfaces (kitchen side is the loading area)
  for (const side of [-1, 1]) {
    const inner = side * (BELT.r + BELT.laneHalf + 0.02);
    const outer = side * ISLAND.halfWidth;
    surfaces.push({ minX: BELT.xa, maxX: KITCHEN.maxX - 0.05, minZ: Math.min(inner, outer), maxZ: Math.max(inner, outer), top: ISLAND.ledgeTop });
  }
  for (let x = DINING.minX + 0.3; x < BELT.xb; x += 1.3) props.add(P.counterCondiments(Math.round(x)), x, ISLAND.ledgeTop + S, 0, Math.PI / 2);

  // stools around the counter
  const cushions = [C.red, C.indigo, C.mustard];
  for (const s of SPOTS.filter((sp) => sp.kind === 'counter'))
    for (const dx of [-0.3125, 0.3125]) {
      props.add(P.stool(cushions[Math.abs(Math.round(s.x)) % 3]), s.x + dx, 0, s.z);
      rect(s.x + dx - 0.16, s.x + dx + 0.16, s.z - 0.16, s.z + 0.16, 0, 1);
    }

  // ---------- Dining hall decor ----------
  // sliding door panel parked beside the entrance
  const fdx0 = v(FRONT_DOOR.minX);
  for (let x = fdx0 - 9; x < fdx0 - 1; x++)
    for (let y = 0; y < 18; y++) vox.set(x, y, Z1 - 1, x === fdx0 - 9 || x === fdx0 - 2 || y === 0 || y === 17 || mod(x, 3) === 0 || mod(y, 4) === 0 ? C.darkWood : C.paper);
  rect(FRONT_DOOR.minX - 1.15, FRONT_DOOR.minX - 0.1, DINING.maxZ - 0.2, DINING.maxZ, 0, 3);
  for (const [x, z, variant] of [
    [7.05, -4.55, 0],
    [7.05, 4.55, 1],
    [-2.9, 4.55, 2],
  ] as const) {
    props.add(P.pottedPlant(variant, 2), x, 0, z);
    rect(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 0, 2);
  }
  props.add(P.umbrellaStand(), 7.05, 0, 3.9);
  rect(6.9, 7.2, 3.75, 4.05, 0, 1);
  props.add(P.wallClock(), -1.5, 2.0, DINING.maxZ - 0.02, Math.PI);
  props.add(P.kamidana(), DINING.maxX - 0.02, 2.62, -2.1, -Math.PI / 2);
  props.add(P.manekiNeko(), DINING.minX + 0.25, PASS_WINDOW.bottom, PASS_WINDOW.maxZ - 0.15, Math.PI / 2);
  for (const w of DINING_WINDOWS_NORTH) props.add(P.candle(), (w.a + w.b) / 2 + 0.6, WINDOW_Y.bottom, DINING.minZ + 0.06);
  for (const w of DINING_WINDOWS_NORTH) props.add(P.pottedPlant(1, 0.6), (w.a + w.b) / 2 - 0.7, WINDOW_Y.bottom, DINING.minZ + 0.06);
  for (const x of [1.0, 2.4, 3.8]) props.add(P.lantern('red', 16, 3, 7), x, DINING.height, 4.55);

  // ---------- Lanterns & lights ----------
  const pointLight = (x: number, y: number, z: number, intensity: number, distance: number, color = 0xffa860, flicker = true, decay = 1.6) => {
    const l = new THREE.PointLight(color, intensity, distance, decay);
    l.position.set(x, y, z);
    root.add(l);
    lights.push({ light: l, flicker });
    return l;
  };
  const hanging = [
    ...SPOTS.filter((s) => s.kind === 'table').map((s) => [s.x, s.z] as const),
    [-0.7, 0] as const,
    [2.4, 0] as const,
  ];
  for (const [x, z] of hanging) {
    props.add(P.lantern('paper', 18), x - F / 2, DINING.height, z - F / 2);
    pointLight(x, DINING.height - 0.85, z, 4.0, 7.5);
  }
  pointLight(5.2, 2.6, 2.5, 2.6, 10, 0xff9a50, true, 1.1);
  for (const [x, z] of [
    [-7.4, -1.6],
    [-5.0, 1.9],
  ]) {
    props.add(P.lantern('paper', 14), x - F / 2, KITCHEN.height, z - F / 2);
    pointLight(x, KITCHEN.height - 0.75, z, 4.2, 8);
  }

  // ---------- Apartment (bare to start: futon, lamp, boxes) ----------
  props.add(P.futon(), -7.6, UP, -2.6);
  props.add(P.andon(), -8.5, UP, -4.4);
  pointLight(-8.35, UP + 0.45, -4.25, 3.6, 9, 0xffb070, true, 1.1);
  pointLight(-5.5, UP + 2.2, 0.5, 1.4, 10, 0xffc890, false, 1.0);
  props.add(P.chabudai(), -5.6, UP, -1.8);
  rect(-6.0, -5.2, -2.2, -1.4, UP - 0.4, 7);
  surfaces.push({ minX: -5.95, maxX: -5.25, minZ: -2.15, maxZ: -1.45, top: UP + 0.375 });
  for (const [x, z, k, y] of [
    [-4.4, -4.4, 0, 0],
    [-4.45, -4.4, 1, 0.375],
    [-4.35, -3.75, 1, 0],
    [-8.4, 2.6, 0, 0],
  ] as const)
    props.add(P.cardboardBox(k), x, UP + y, z, k * 0.3);
  rect(-4.95, -3.7, -4.9, -3.4, UP - 0.4, 7);
  rect(-8.9, -7.9, 2.2, 3.0, UP - 0.4, 7);

  // ---------- Exterior lanterns, props ----------
  for (const x of [FRONT_DOOR.minX - 0.45, FRONT_DOOR.maxX + 0.45]) props.add(P.lantern('red', 8), x, 3.1, DINING.maxZ + 0.6);
  for (const x of [-1.6, 1.5, 4.0]) props.add(P.lantern('paper', 14), x - F / 2, 3.12, DINING.minZ - 0.3);
  pointLight((FRONT_DOOR.minX + FRONT_DOOR.maxX) / 2, 2.5, DINING.maxZ + 0.9, 5, 10, 0xff8a50, false);
  pointLight(1.5, 1.4, DINING.maxZ + 1.4, 2.4, 7, 0xffa060, false);
  pointLight(1.5, 2.3, DINING.minZ - 1.3, 3.5, 9, 0xffb070, false);
  props.add(P.sakeBarrel(true), 7.25, 0, 5.75);
  props.add(P.sakeBarrel(true), 7.75, 0, 6.35);
  props.add(P.sakeBarrel(true), 7.5, 0.47, 6.0, 0.4);
  props.add(P.crate(true), 4.6, 0, 5.85, 0.1);
  props.add(P.crate(true), 4.55, 0.34, 5.85, -0.15);
  props.add(P.bench(), 0.0, 0, 5.75);
  props.add(P.snowman(), -1.8, 0, 8.5, 0.5);
  props.add(P.pottedPlant(2, 1.5), 8.2, 0, 5.4);

  // ---------- Warm glow: halos around lanterns, light pools on the snow ----------
  const halo = (x: number, y: number, z: number, size: number, opacity: number, color = 0xffa860) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.set(x, y, z);
    sp.scale.setScalar(size);
    root.add(sp);
  };
  const pool = (x: number, y: number, z: number, w: number, d: number, opacity: number) => {
    const m = makeGlowPool(x, y, z, w, d);
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
    mat.color.set(0xffa050);
    root.add(m);
  };
  for (const [x, z] of hanging) halo(x, DINING.height - 0.75, z, 1.1, 0.22);
  for (const [x, z] of [
    [-7.4, -1.6],
    [-5.0, 1.9],
  ])
    halo(x, KITCHEN.height - 0.65, z, 1.0, 0.2);
  halo(-8.35, UP + 0.4, -4.25, 1.3, 0.3, 0xffb070);
  for (const x of [FRONT_DOOR.minX - 0.45, FRONT_DOOR.maxX + 0.45]) halo(x, 2.6, DINING.maxZ + 0.6, 1.8, 0.45, 0xff6a40);
  for (const x of [-1.6, 1.5, 4.0]) halo(x, 2.55, DINING.minZ - 0.3, 1.8, 0.4);
  for (const [x, z] of toros) {
    halo((x + 0.5) * S, 0.95, (z + 0.5) * S, 1.6, 0.5);
    pool((x + 0.5) * S, 0.02, (z + 0.5) * S, 2.6, 2.6, 0.3);
  }
  for (const w of DINING_WINDOWS_SOUTH) pool((w.a + w.b) / 2, 0.02, DINING.maxZ + 1.3, w.b - w.a + 1.2, 2.4, 0.32);
  for (const w of DINING_WINDOWS_NORTH) pool((w.a + w.b) / 2, 0.15, DINING.minZ - 1.4, w.b - w.a + 1.2, 2.6, 0.32);
  for (const w of DINING_WINDOWS_EAST) pool(DINING.maxX + 1.3, 0.02, (w.a + w.b) / 2, 2.4, w.b - w.a + 1.2, 0.3);
  pool((FRONT_DOOR.minX + FRONT_DOOR.maxX) / 2, 0.02, DINING.maxZ + 1.6, 3.2, 3.2, 0.45);
  pool((KITCHEN_WINDOW_NORTH.a + KITCHEN_WINDOW_NORTH.b) / 2, 0.02, KITCHEN.minZ - 1.2, 3.2, 2.2, 0.25);

  // ---------- Mesh the architecture ----------
  const dense = vox.toDense();
  snowCover(dense);
  const m = meshGrid(dense, S);
  const archGroup = new THREE.Group();
  archGroup.name = 'restaurant-voxels';
  if (m.solid) archGroup.add(new THREE.Mesh(m.solid, solidMaterial));
  if (m.glow) archGroup.add(new THREE.Mesh(m.glow, glowMaterial));
  root.add(archGroup);
  root.add(props.build());

  // ---------- Walls collision ----------
  const B = { x0: KITCHEN.minX, x1: DINING.maxX, z0: DINING.minZ, z1: DINING.maxZ };
  rect(B.x0 - 0.25, B.x1 + 0.25, B.z0 - 0.25, B.z0 + 0.1, 0, 8);
  rect(B.x0 - 0.25, B.x1 + 0.25, B.z1 - 0.1, B.z1 + 0.25, 0, 8);
  rect(B.x0 - 0.25, B.x0 + 0.1, B.z0, B.z1, 0, 8);
  rect(B.x1 - 0.1, B.x1 + 0.25, B.z0, B.z1, 0, 8);
  rect(KITCHEN.maxX - 0.05, DINING.minX + 0.05, B.z0, KITCHEN_DOOR.minZ, 0, 3.4);
  rect(KITCHEN.maxX - 0.05, DINING.minX + 0.05, KITCHEN_DOOR.maxZ, B.z1, 0, 3.4);
  rect(KITCHEN.maxX - 0.1, KITCHEN.maxX + 0.1, B.z0, B.z1, 3.3, 8);
  for (const s of SPOTS.filter((sp) => sp.kind === 'table')) {
    rect(s.x - TABLE_SIZE.w / 2, s.x + TABLE_SIZE.w / 2, s.z - TABLE_SIZE.d / 2, s.z + TABLE_SIZE.d / 2, 0, 1);
    for (const side of [-1, 1]) {
      const backZ = s.z + side * (SEAT_OFFSET + 0.2);
      rect(s.x - 0.25, s.x + 0.25, backZ - 0.07, backZ + 0.07, 0, 1.2);
    }
  }

  // ---------- Invisible raycast blockers ----------
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const blockers: THREE.Object3D[] = [];
  const blocker = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), hidden);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    root.add(b);
    blockers.push(b);
  };
  blocker(B.x0 - 0.25, 0, B.z0 - 0.25, B.x1 + 0.25, 6, B.z0);
  blocker(B.x0 - 0.25, 0, B.z1, B.x1 + 0.25, 6, B.z1 + 0.25);
  blocker(B.x0 - 0.25, 0, B.z0, B.x0, 6, B.z1);
  blocker(B.x1, 0, B.z0, B.x1 + 0.25, 3.3, B.z1);
  const px0 = KITCHEN.maxX;
  const px1 = DINING.minX;
  blocker(px0, 0, B.z0, px1, 6, PASS_WINDOW.minZ);
  blocker(px0, 0, PASS_WINDOW.minZ, px1, PASS_WINDOW.bottom, PASS_WINDOW.maxZ);
  blocker(px0, PASS_WINDOW.top, PASS_WINDOW.minZ, px1, 6, PASS_WINDOW.maxZ);
  blocker(px0, 0, PASS_WINDOW.maxZ, px1, 6, KITCHEN_DOOR.minZ);
  blocker(px0, KITCHEN_DOOR.height, KITCHEN_DOOR.minZ, px1, 6, KITCHEN_DOOR.maxZ);
  blocker(px0, 0, KITCHEN_DOOR.maxZ, px1, 6, B.z1);
  blocker(KITCHEN.minX, KITCHEN.height, KITCHEN.minZ, KITCHEN.maxX, APARTMENT.floor - 0.01, STAIRS.minZ);
  blocker(WEST_COUNTER.minX, 0, WEST_COUNTER.minZ, WEST_COUNTER.maxX + 0.1, WEST_COUNTER.top - 0.02, WEST_COUNTER.maxZ);
  blocker(NORTH_COUNTER.minX, 0, NORTH_COUNTER.minZ, NORTH_COUNTER.maxX, NORTH_COUNTER.top - 0.02, NORTH_COUNTER.maxZ + 0.1);
  blocker(BELT.xa - 0.4, 0, -0.4, BELT.xb + 0.4, ISLAND.ledgeTop + 0.1, 0.4);

  const menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  menuBoard.position.set(1.0, 2.75, DINING.maxZ - 0.03);
  menuBoard.rotation.y = Math.PI;
  root.add(menuBoard);
  addCanvasDecor(root);
  return { group: root, blockers, colliders, surfaces, lights, menuBoard };
}

let haloTex: THREE.Texture | null = null;
function haloTexture(): THREE.Texture {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

export function menuBoardTexture(lines: { name: string; price: number }[]): THREE.Texture {
  const rows = lines.slice(0, 6);
  return signTexture({
    width: 416,
    height: 64,
    bg: '#2a1a10',
    fg: '#f4e6c4',
    lines: [
      { text: 'お品書き', size: 16, y: 14, color: '#f0b45a' },
      ...rows.map((r, i) => ({ text: `${r.name}  ¥${r.price}`, size: 14, y: 36 + Math.floor(i / 3) * 18, align: 'center' as const, x: 70 + (i % 3) * 138 })),
    ],
  });
}

function canvasPlane(tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, rotY: number, glow = 0): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1, emissive: glow ? 0xffe0b0 : 0, emissiveMap: glow ? tex : null, emissiveIntensity: glow }),
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  return m;
}

function tanzakuTexture(items: string[]): THREE.Texture {
  const w = items.length * 22 + 4;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3a2414';
  ctx.fillRect(0, 0, w, 96);
  items.forEach((text, i) => {
    const x = 4 + i * 22;
    ctx.fillStyle = i % 5 === 3 ? '#f2c95a' : '#f4ead2';
    ctx.fillRect(x, 4, 18, 88);
    ctx.fillStyle = '#2a1a10';
    ctx.font = `14px "DotGothic16", monospace`;
    ctx.textAlign = 'center';
    [...text].slice(0, 5).forEach((ch, k) => ctx.fillText(ch, x + 9, 20 + k * 16));
    ctx.fillStyle = '#b8261c';
    ctx.fillRect(x + 4, 86, 10, 2);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addCanvasDecor(root: THREE.Group) {
  root.add(canvasPlane(tanzakuTexture(['鮭握り', '鮪握り', '玉子', '味噌汁', 'ラーメン', '天ぷら', '枝豆', '焼き鳥', '熱燗', '緑茶', '抹茶', '餃子']), 3.0, 0.62, DINING.maxX - 0.02, 2.86, 1.6, -Math.PI / 2));
  root.add(canvasPlane(tanzakuTexture(['本日', 'おすすめ', '寒ぶり', '牡蠣', 'おでん', '熱燗', '梅酒', '日本酒', '甘酒']), 2.2, 0.62, -1.9, 2.86, DINING.minZ + 0.02, 0));
  const scroll = signTexture({ width: 48, height: 160, bg: '#efe6d0', fg: '#2a1a10', border: '#7a5a3a', lines: ['一', '期', '一', '会'].map((t, i) => ({ text: t, size: 26, y: 34 + i * 32 })) });
  root.add(canvasPlane(scroll, 0.42, 1.3, DINING.maxX - 0.03, 1.55, -0.1, -Math.PI / 2));
  const fish = signTexture({ width: 96, height: 64, bg: '#f2e6c8', fg: '#2a1a10', border: '#3a2414', lines: [{ text: '鮭', size: 30, y: 26 }, { text: 'SALMON', size: 12, y: 50, color: '#b8261c' }] });
  root.add(canvasPlane(fish, 0.75, 0.5, DINING.maxX - 0.03, 1.55, 4.0, -Math.PI / 2));
  // short noren over the kitchen door, dining side
  const kNoren = signTexture({ width: 96, height: 48, bg: '#7a1f1a', fg: '#f4ead2', lines: [{ text: '厨房', size: 20, y: 26 }] });
  const doorZ = (KITCHEN_DOOR.minZ + KITCHEN_DOOR.maxZ) / 2;
  root.add(canvasPlane(kNoren, 1.1, 0.45, DINING.minX + 0.02, 2.0, doorZ, Math.PI / 2));
  root.add(canvasPlane(kNoren, 1.1, 0.45, KITCHEN.maxX - 0.02, 2.0, doorZ, -Math.PI / 2));
  // exterior: tall sign and front noren
  const sushiSign = signTexture({ width: 64, height: 192, bg: '#f4ead2', fg: '#b8261c', border: '#3a2414', lines: [{ text: '寿', size: 44, y: 58 }, { text: '司', size: 44, y: 128 }] });
  root.add(canvasPlane(sushiSign, 0.42, 1.25, FRONT_DOOR.maxX + 0.75, 1.6, DINING.maxZ + 0.27, 0, 0.9));
  const norenTex = signTexture({ width: 96, height: 64, bg: '#1f2c4a', fg: '#f1ead8', lines: [{ text: 'すし', size: 30, y: 36 }] });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x1f2c4a, roughness: 1 });
  const noren = new THREE.Mesh(new THREE.BoxGeometry(FRONT_DOOR.maxX - FRONT_DOOR.minX, 0.6, 0.01), [
    cloth,
    cloth,
    cloth,
    cloth,
    new THREE.MeshStandardMaterial({ map: norenTex, roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: norenTex, roughness: 1 }),
  ]);
  noren.position.set((FRONT_DOOR.minX + FRONT_DOOR.maxX) / 2, FRONT_DOOR.height - 0.3, DINING.maxZ + 0.27);
  root.add(noren);
}
