import * as THREE from 'three';
import type { Rect } from './geometry';
import {
  COUNTER,
  CRATE,
  DOOR,
  LANTERNS,
  ROOM,
  S,
  SEAT_OFFSET,
  TABLE_SIZE,
  TABLES,
  WINDOW_EAST,
  WINDOW_Y,
  WINDOWS_NORTH,
  WINDOWS_SOUTH,
} from './layout';
import { signTexture } from './materials';
import * as P from './props';
import { F } from './props';
import { C, PAL } from './voxel/palette';
import { DenseGrid, glowMaterial, meshGrid, PropBatch, solidMaterial, Vox } from './voxel/vox';

export interface RestaurantBuild {
  group: THREE.Group;
  blockers: THREE.Object3D[];
  colliders: Rect[];
  interiorLights: THREE.PointLight[];
  menuBoard: THREE.Mesh;
}

const v = (m: number) => Math.round(m / S);
const mod = (a: number, n: number) => ((a % n) + n) % n;
const hash = (a: number, b: number, c = 0) => mod(Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791), 1000) / 1000;

const X0 = v(ROOM.minX);
const X1 = v(ROOM.maxX);
const Z0 = v(ROOM.minZ);
const Z1 = v(ROOM.maxZ);
const H = v(ROOM.height);
const W = 2;

/** Roof surface height (voxels) as a function of z — stair-stepped gable. */
const roofTop = (z: number) => 41 - Math.floor(Math.abs(z + 0.5) / 3);

const stoneFn = (x: number, y: number, z: number) => [C.stone, C.stoneL, C.stoneD][mod(Math.floor(x / 2) * 7 + Math.floor(z / 2) * 13 + y * 3, 3)];

function interiorWall(t: number, y: number): number {
  if (y < 7) return y === 6 ? C.darkWood : mod(Math.floor(t / 2), 2) ? C.midWood : C.midWood2;
  if (y < 18) return C.plaster;
  if (y < 20) return C.darkWood;
  return C.plaster2;
}

function exteriorWall(t: number, y: number): number {
  if (y < 8) return mod(Math.floor(t / 2), 2) ? C.extWood : C.extWood2;
  if (y === 8 || y === 19) return C.beam;
  return C.extPlaster;
}

interface Opening {
  a: number;
  b: number;
  y0: number;
  y1: number;
  door?: boolean;
}

/**
 * A 2-voxel-thick wall. `axis` is the direction the wall runs; `inner`/`outer` are the
 * fixed-axis voxel layers; `inward` points into the room.
 */
function wall(vox: Vox, axis: 'x' | 'z', inner: number, outer: number, inward: 1 | -1, from: number, to: number, openings: Opening[], pillars: number[], roomFrom: number, roomTo: number) {
  const put = (t: number, y: number, layer: number, p: number) => (axis === 'x' ? vox.set(t, y, layer, p) : vox.set(layer, y, t, p));
  for (let t = from; t < to; t++)
    for (let y = 0; y < H; y++) {
      const o = openings.find((op) => t >= op.a && t < op.b && y >= op.y0 && y < op.y1);
      if (o) {
        const edge = t === o.a || t === o.b - 1 || y === o.y1 - 1 || (!o.door && y === o.y0);
        if (edge) {
          put(t, y, inner, C.darkWood);
          put(t, y, outer, C.darkWood);
        } else if (!o.door && mod(t - o.a, 8) === 0) {
          put(t, y, outer, C.beam);
        }
        if (!o.door && y === o.y0 && t > o.a && t < o.b - 1) put(t, y, inner + inward, C.hinoki);
        continue;
      }
      put(t, y, inner, interiorWall(t, y));
      put(t, y, outer, exteriorWall(t, y));
      if ((y === 18 || y === 19) && t >= roomFrom && t < roomTo) put(t, y, inner + inward, C.darkWood);
    }
  for (const p of pillars)
    for (let t = p; t < p + 2; t++)
      for (let y = 0; y < H; y++) {
        put(t, y, inner, C.beam);
        put(t, y, outer, C.beam);
        if (t >= roomFrom && t < roomTo) put(t, y, inner + inward, C.beam);
        put(t, y, outer - inward, C.beam);
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

export function buildRestaurant(): RestaurantBuild {
  const vox = new Vox();
  const root = new THREE.Group();
  root.name = 'restaurant';
  const props = new PropBatch();
  const colliders: Rect[] = [];
  const rect = (minX: number, maxX: number, minZ: number, maxZ: number) => colliders.push({ minX, maxX, minZ, maxZ });

  // ---------- Ground, foundation, floor ----------
  vox.box(-68, -1, -40, 69, 0, 82, (x, _y, z) => (hash(x, z) > 0.7 ? C.snow2 : C.snow));
  for (let i = 0; i < 7; i++) {
    const z0 = 39 + i * 6;
    const x0 = 31 + (i % 2 ? 2 : -1);
    vox.box(x0, -1, z0, x0 + 5, 0, z0 + 4, i % 2 ? C.stoneL : C.stone);
  }
  vox.box(29, -1, 38, 39, 0, 40, C.stoneL);
  vox.box(X0 - W - 1, -1, Z0 - W - 1, X1 + W + 1, 0, Z1 + W + 1, stoneFn);
  for (const [x0, x1, z0, z1] of [
    [X0 - W - 1, X1 + W + 1, Z0 - W - 1, Z0 - W],
    [X0 - W - 1, X1 + W + 1, Z1 + W, Z1 + W + 1],
    [X0 - W - 1, X0 - W, Z0 - W, Z1 + W],
    [X1 + W, X1 + W + 1, Z0 - W, Z1 + W],
  ])
    vox.box(x0, 0, z0, x1, 1, z1, stoneFn);
  vox.box(29, 0, Z1 + W, 38, 1, Z1 + W + 1, 0); // gap in the plinth at the door
  vox.box(X0, -1, Z0, X1, 0, Z1, (x, _y, z) => {
    const row = Math.floor(z / 2);
    const seg = Math.floor((x + mod(row * 5, 12)) / 12);
    return [C.floorA, C.floorB, C.floorC][mod(row * 31 + seg * 17, 3)];
  });

  // ---------- Walls ----------
  const win = (a: number, b: number): Opening => ({ a: v(a), b: v(b), y0: v(WINDOW_Y.bottom), y1: v(WINDOW_Y.top) });
  wall(vox, 'x', Z0 - 1, Z0 - 2, 1, X0 - W, X1 + W, WINDOWS_NORTH.map((w) => win(w.a, w.b)), [-48, -43, -13, 11, 41, 46], X0, X1);
  wall(vox, 'x', Z1, Z1 + 1, -1, X0 - W, X1 + W, [...WINDOWS_SOUTH.map((w) => win(w.a, w.b)), { a: v(DOOR.minX), b: v(DOOR.maxX), y0: 0, y1: v(DOOR.height), door: true }], [-48, -37, -13, 11, 27, 46], X0, X1);
  wall(vox, 'z', X1, X1 + 1, -1, Z0, Z1, [win(WINDOW_EAST.a, WINDOW_EAST.b)], [-36, -31, -5, 14, 34], Z0, Z1);
  wall(vox, 'z', X0 - 1, X0 - 2, 1, Z0, Z1, [], [-36, 34], Z0, Z1);

  // ---------- Ceiling & beams ----------
  vox.box(X0 - W, H, Z0 - W, X1 + W, H + 1, Z1 + W, (x) => (mod(Math.floor(x / 2), 2) ? C.darkWood : C.darkWood2));
  for (const bx of [-42, -30, -18, -6, 6, 18, 30, 42]) vox.box(bx - 1, H - 2, Z0, bx + 1, H, Z1, C.beam);
  vox.box(X0, H - 3, -1, X1, H, 1, C.beam);

  // ---------- Roof (stair-stepped gable, tiles, ridge, gables, icicles) ----------
  for (let x = -55; x < 55; x++)
    for (let z = -47; z < 47; z++) {
      const top = roofTop(z);
      vox.set(x, top - 2, z, C.darkWood);
      vox.set(x, top - 1, z, mod(x, 2) === 0 ? C.roof : C.roof2);
    }
  vox.box(-55, 41, -2, 55, 42, 2, C.roof2);
  vox.box(-57, 41, -2, -54, 44, 2, C.roof2);
  vox.box(54, 41, -2, 57, 44, 2, C.roof2);
  for (const gx of [X0 - W, X1])
    for (let x = gx; x < gx + W; x++)
      for (let z = Z0 - W; z < Z1 + W; z++)
        for (let y = H; y < roofTop(z) - 2; y++) vox.set(x, y, z, mod(z, 10) === 0 || y === H + 1 ? C.beam : C.extPlaster);
  for (const ez of [-47, 46])
    for (let x = -55; x < 55; x += 2) {
      const len = Math.floor(hash(x, ez) * 4);
      for (let k = 1; k <= len; k++) vox.set(x, roofTop(ez) - 2 - k, ez, C.ice);
    }

  // ---------- Deck with railings ----------
  vox.box(-45, -1, -66, 45, 0, Z0 - W - 1, (_x, _y, z) => (mod(Math.floor(z / 2), 2) ? C.deck : C.deck2));
  for (const x of [-44, -28, -12, 4, 20, 36]) for (const z of [-65, -52]) vox.box(x, -26, z, x + 2, -1, z + 2, C.darkWood);
  for (let x = -45; x <= 44; x += 10) vox.box(x, 0, -66, x + 1, 8, -65, C.beam);
  vox.box(-45, 7, -66, 45, 8, -65, C.darkWood);
  vox.box(-45, 4, -66, 45, 5, -65, C.darkWood);
  for (const x of [-45, 44]) {
    for (let z = -66; z < -40; z += 10) vox.box(x, 0, z, x + 1, 8, z + 1, C.beam);
    vox.box(x, 7, -66, x + 1, 8, -40, C.darkWood);
    vox.box(x, 4, -66, x + 1, 5, -40, C.darkWood);
  }

  // ---------- Exterior details ----------
  // stone lantern (toro) by the path
  vox.box(49, 0, 51, 54, 1, 56, C.stoneL);
  vox.box(51, 1, 53, 52, 6, 54, C.stoneL);
  vox.box(50, 6, 52, 53, 9, 55, C.stoneL);
  for (const [x, z] of [
    [51, 52],
    [51, 54],
    [50, 53],
    [52, 53],
  ])
    vox.set(x, 7, z, C.candle);
  vox.set(51, 7, 53, C.candle);
  vox.box(49, 9, 51, 54, 10, 56, C.stoneL);
  vox.box(50, 10, 52, 53, 11, 55, C.stone);
  // snow drifts against the walls
  for (let x = -54; x < 54; x++) {
    const h1 = Math.floor(hash(x, 3) * 3);
    for (let k = 0; k < h1; k++) if (x < 28 || x > 39) vox.set(x, k, Z1 + W + 1, C.snow);
    const h2 = Math.floor(hash(x, 5) * 2);
    for (let k = 0; k < h2; k++) if (x < 28 || x > 39) vox.set(x, k, Z1 + W + 2, C.snow2);
  }
  for (let z = -40; z < 40; z++) {
    for (const x of [X0 - W - 2, X1 + W + 1]) {
      const h = Math.floor(hash(z, x) * 3);
      for (let k = 0; k < h; k++) vox.set(x, k, z, C.snow);
    }
  }
  // woodpile on the east wall
  vox.box(X1 + W + 1, 0, 8, X1 + W + 4, 5, 24, (x, y, z) => (mod(x + y * 2 + z, 3) === 0 ? C.lightWood : mod(z + y, 2) ? C.midWood : C.midWood2));

  // ---------- Kitchen counter, backsplash, shelves ----------
  const cx0 = v(COUNTER.minX);
  const cx1 = v(COUNTER.maxX);
  const cz0 = v(COUNTER.minZ);
  const cz1 = v(COUNTER.maxZ);
  const ctop = v(COUNTER.top);
  vox.box(cx0, 0, cz0, cx1, ctop - 1, cz1, (x, y, z) => (x === cx1 - 1 ? (y === 0 ? C.beam : mod(Math.floor(z / 2), 2) ? C.midWood : C.midWood2) : C.darkWood));
  vox.box(cx0, ctop - 1, cz0 - 1, cx1 + 1, ctop, cz1 + 1, (_x, _y, z) => (mod(Math.floor(z / 4), 2) ? C.hinoki : C.hinoki2));
  vox.box(X0, ctop, cz0, X0 + 1, ctop + 6, cz1, (_x, y, z) => (mod(y + z, 2) ? C.tile : C.tile2));
  for (const sy of [15, 20]) {
    vox.box(X0, sy, cz0 + 1, X0 + 3, sy + 1, cz1 - 1, C.midWood);
    for (let z = cz0 + 3; z < cz1 - 2; z += 10) vox.box(X0, sy - 1, z, X0 + 1, sy, z + 1, C.darkWood);
  }
  rect(COUNTER.minX, COUNTER.maxX + 0.125, COUNTER.minZ - 0.125, COUNTER.maxZ + 0.125);
  rect(CRATE.x - 0.45, CRATE.x + 0.45, CRATE.z - 0.35, CRATE.z + 0.35);

  // shelf props
  const shelf1 = 2.0;
  const shelf2 = 2.625;
  const shelfX = ROOM.minX + 0.2;
  for (let i = 0; i < 18; i++) {
    const z = COUNTER.minZ + 0.25 + i * 0.4;
    if (Math.abs(z - 0.1) < 0.25) continue;
    const kind = i % 4;
    if (kind === 3) props.add(P.jar(i), shelfX, shelf1, z);
    else if (kind === 2) props.add(P.bowlStack(), shelfX, shelf1, z);
    else props.add(P.sakeBottle(i), shelfX, shelf1, z);
  }
  props.add(P.manekiNeko(), shelfX, shelf2, 0.2, Math.PI / 2);
  props.add(P.daruma(), shelfX, shelf2, -1.0, Math.PI / 2);
  props.add(P.radio(), shelfX, shelf2, 2.4, Math.PI / 2);
  props.add(P.pottedPlant(1), shelfX, shelf2, -2.6);
  props.add(P.jar(1), shelfX, shelf2, 1.2);
  props.add(P.jar(2), shelfX, shelf2, -1.8);
  props.add(P.sakeBottle(3), shelfX, shelf2, 3.0);
  props.add(P.teapot(), shelfX, shelf2, -0.4, Math.PI / 2);

  // hanging menu board over the kitchen (texture set later)
  const bx = v(-4.5) - 1;
  for (let y = 19; y < 25; y++)
    for (let z = -14; z < 14; z++) if (y === 19 || y === 24 || z === -14 || z === 13) vox.set(bx, y, z, C.darkWood);
  vox.box(bx, 25, -12, bx + 1, H - 2, -11, C.rope);
  vox.box(bx, 25, 10, bx + 1, H - 2, 11, C.rope);
  const menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  menuBoard.rotation.y = Math.PI / 2;
  menuBoard.position.set(-4.5 + 0.002, 2.75, -0.0625);
  root.add(menuBoard);

  // ---------- Dining-room decor ----------
  // sliding door panel parked beside the entrance
  for (let x = 38; x < 46; x++)
    for (let y = 0; y < 18; y++) vox.set(x, y, Z1 - 1, x === 38 || x === 45 || y === 0 || y === 17 || mod(x - 38, 3) === 0 || mod(y, 4) === 0 ? C.darkWood : C.paper);
  rect(4.75, 5.75, 4.3, 4.5);
  // plants
  for (const [x, z, variant] of [
    [5.45, -4.05, 0],
    [-1.0, 4.1, 1],
    [-5.55, -4.05, 2],
  ] as const) {
    props.add(P.pottedPlant(variant, 2), x, 0, z);
    rect(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
  }
  props.add(P.umbrellaStand(), 5.35, 0, 3.95);
  rect(5.2, 5.5, 3.8, 4.1);
  props.add(P.wallClock(), -2.0, 1.95, ROOM.maxZ - 0.02, Math.PI);
  props.add(P.kamidana(), ROOM.maxX - 0.02, 2.62, 2.6, -Math.PI / 2);
  // window-sill candles and succulents
  for (const [x, kind] of [
    [-4.2, 0],
    [-2.3, 1],
    [-0.6, 0],
    [0.7, 1],
    [2.3, 0],
    [4.2, 1],
  ] as const)
    props.add(kind ? P.pottedPlant(1, 0.6) : P.candle(), x, WINDOW_Y.bottom, ROOM.minZ + 0.06);
  for (const x of [-3.6, 0.6]) props.add(P.candle(), x, WINDOW_Y.bottom, ROOM.maxZ - 0.06);
  // little red lanterns along the south wall
  for (const x of [-2.6, -1.0, 0.6, 2.0]) props.add(P.lantern('red', 16, 3, 7), x, ROOM.height, 4.2);

  // hanging paper lanterns (each carries a point light)
  const interiorLights: THREE.PointLight[] = [];
  for (const l of LANTERNS) {
    props.add(P.lantern(l.kind, 18), l.x - F / 2, l.y, l.z - F / 2);
    const light = new THREE.PointLight(0xffa860, 4.2, 7.5, 1.6);
    light.position.set(l.x, l.y - 0.85, l.z);
    root.add(light);
    interiorLights.push(light);
  }
  // Broad, soft fills keep the warmth indoors (a global ambient would tint the snow outside).
  for (const [x, y, z, intensity] of [
    [0.6, 2.6, 3.4, 2.4],
    [0.6, 2.9, -0.8, 3.2],
    [-4.4, 2.6, 0.2, 2.6],
  ] as const) {
    const fill = new THREE.PointLight(0xff9a50, intensity, 10, 1.1);
    fill.position.set(x, y, z);
    root.add(fill);
    interiorLights.push(fill);
  }

  // ---------- Exterior lanterns, props ----------
  for (const x of [DOOR.minX - 0.45, DOOR.maxX + 0.45]) props.add(P.lantern('red', 8), x, 3.1, ROOM.maxZ + 0.6);
  for (const x of [-5.25, -1.5, 1.5, 5.25]) props.add(P.lantern('paper', 14), x - F / 2, 3.12, -5.3);
  const doorLight = new THREE.PointLight(0xff8a50, 5, 9, 1.6);
  doorLight.position.set(4.2, 2.5, 5.4);
  root.add(doorLight);
  const spill = new THREE.PointLight(0xffa060, 2.2, 6, 1.6);
  spill.position.set(-1.6, 1.3, 5.3);
  root.add(spill);
  const deckLight = new THREE.PointLight(0xffb070, 3.5, 9, 1.6);
  deckLight.position.set(0, 2.3, -5.8);
  root.add(deckLight);
  props.add(P.sakeBarrel(true), 5.6, 0, 5.1);
  props.add(P.sakeBarrel(true), 6.05, 0, 5.75);
  props.add(P.sakeBarrel(true), 5.8, 0.47, 5.4, 0.4);
  props.add(P.crate(true), 2.5, 0, 5.2, 0.1);
  props.add(P.crate(true), 2.45, 0.34, 5.2, -0.15);
  props.add(P.bench(), -2.2, 0, 5.15);
  props.add(P.snowman(), -4.6, 0, 7.2, 0.5);
  props.add(P.pottedPlant(2, 1.5), 6.6, 0, 4.9);

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

  // ---------- Walls collision; invisible raycast blockers ----------
  rect(ROOM.minX - 0.25, ROOM.maxX + 0.25, ROOM.minZ - 0.25, ROOM.minZ + 0.125);
  rect(ROOM.minX - 0.25, ROOM.maxX + 0.25, ROOM.maxZ - 0.125, ROOM.maxZ + 0.25);
  rect(ROOM.maxX - 0.125, ROOM.maxX + 0.25, ROOM.minZ, ROOM.maxZ);
  rect(ROOM.minX - 0.25, ROOM.minX + 0.125, ROOM.minZ, ROOM.maxZ);
  for (const t of TABLES) {
    rect(t.x - TABLE_SIZE.w / 2, t.x + TABLE_SIZE.w / 2, t.z - TABLE_SIZE.d / 2, t.z + TABLE_SIZE.d / 2);
    for (const side of [-1, 1]) {
      const backZ = t.z + side * (SEAT_OFFSET + 0.2);
      rect(t.x - 0.25, t.x + 0.25, backZ - 0.07, backZ + 0.07);
    }
  }
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const blocker = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), hidden);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    root.add(b);
    return b;
  };
  const blockers = [
    blocker(ROOM.minX - 0.25, 0, ROOM.minZ - 0.25, ROOM.maxX + 0.25, ROOM.height, ROOM.minZ),
    blocker(ROOM.minX - 0.25, 0, ROOM.maxZ, ROOM.maxX + 0.25, ROOM.height, ROOM.maxZ + 0.25),
    blocker(ROOM.maxX, 0, ROOM.minZ, ROOM.maxX + 0.25, ROOM.height, ROOM.maxZ),
    blocker(ROOM.minX - 0.25, 0, ROOM.minZ, ROOM.minX, ROOM.height, ROOM.maxZ),
    blocker(COUNTER.minX, 0, COUNTER.minZ, COUNTER.maxX + 0.12, COUNTER.top - 0.02, COUNTER.maxZ),
  ];

  addCanvasDecor(root);
  return { group: root, blockers, colliders, interiorLights, menuBoard };
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
  // tanzaku menu strips — the classic izakaya wall
  root.add(canvasPlane(tanzakuTexture(['鮭握り', '鮪握り', '玉子', '味噌汁', 'ラーメン', '天ぷら', '枝豆', '焼き鳥', '熱燗', '緑茶', '抹茶', '餃子']), 3.0, 0.62, ROOM.maxX - 0.02, 2.86, 2.0, -Math.PI / 2));
  root.add(canvasPlane(tanzakuTexture(['本日', 'おすすめ', '寒ぶり', '牡蠣', 'おでん', '熱燗', '梅酒', '日本酒', '甘酒']), 2.4, 0.62, -3.4, 2.86, ROOM.maxZ - 0.02, Math.PI));

  // wave print
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#efe2c0';
  ctx.fillRect(0, 0, 48, 32);
  ctx.fillStyle = '#e9cfa0';
  ctx.fillRect(0, 0, 48, 14);
  ctx.fillStyle = '#5d6f8c';
  ctx.beginPath();
  ctx.moveTo(30, 18);
  ctx.lineTo(36, 9);
  ctx.lineTo(42, 18);
  ctx.fill();
  ctx.fillStyle = '#fbf7ef';
  ctx.fillRect(34, 9, 4, 3);
  ctx.fillStyle = '#1f3d6b';
  for (let x = 0; x < 48; x++) ctx.fillRect(x, 20 + Math.round(Math.sin(x / 3) * 2), 1, 12);
  ctx.fillStyle = '#2c5590';
  ctx.beginPath();
  ctx.arc(10, 30, 16, Math.PI, Math.PI * 1.85);
  ctx.lineTo(10, 30);
  ctx.fill();
  ctx.fillStyle = '#fbf7ef';
  for (let i = 0; i < 9; i++) ctx.fillRect(14 + i * 1.5, 14 + (i % 3), 2, 2);
  const wave = new THREE.CanvasTexture(canvas);
  wave.magFilter = THREE.NearestFilter;
  wave.colorSpace = THREE.SRGBColorSpace;
  root.add(canvasPlane(wave, 0.6, 0.4, -5.3, 1.6, ROOM.maxZ - 0.03, Math.PI));

  // hanging scroll and a fish poster on the east wall
  const scroll = signTexture({ width: 48, height: 160, bg: '#efe6d0', fg: '#2a1a10', border: '#7a5a3a', lines: ['一', '期', '一', '会'].map((t, i) => ({ text: t, size: 26, y: 34 + i * 32 })) });
  root.add(canvasPlane(scroll, 0.42, 1.3, ROOM.maxX - 0.03, 1.55, 0.7, -Math.PI / 2));
  const fish = signTexture({ width: 96, height: 64, bg: '#f2e6c8', fg: '#2a1a10', border: '#3a2414', lines: [{ text: '鮭', size: 30, y: 26 }, { text: 'SALMON', size: 12, y: 50, color: '#b8261c' }] });
  root.add(canvasPlane(fish, 0.75, 0.5, ROOM.maxX - 0.03, 1.55, 3.4, -Math.PI / 2));

  // exterior: tall sign and noren
  const sushiSign = signTexture({ width: 64, height: 192, bg: '#f4ead2', fg: '#b8261c', border: '#3a2414', lines: [{ text: '寿', size: 44, y: 58 }, { text: '司', size: 44, y: 128 }] });
  root.add(canvasPlane(sushiSign, 0.42, 1.25, DOOR.maxX + 0.95, 1.6, ROOM.maxZ + 0.27, 0, 0.9));
  const norenTex = signTexture({ width: 96, height: 64, bg: '#1f2c4a', fg: '#f1ead8', lines: [{ text: 'すし', size: 30, y: 36 }] });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x1f2c4a, roughness: 1 });
  const noren = new THREE.Mesh(new THREE.BoxGeometry(DOOR.maxX - DOOR.minX, 0.6, 0.01), [
    cloth,
    cloth,
    cloth,
    cloth,
    new THREE.MeshStandardMaterial({ map: norenTex, roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: norenTex, roughness: 1 }),
  ]);
  noren.position.set((DOOR.minX + DOOR.maxX) / 2, DOOR.height - 0.3, ROOM.maxZ + 0.27);
  root.add(noren);
}
