// Tokyo: a hole-in-the-wall on a narrow, snowy side street, late. The shop where the game is played now (the
// mountain lot is the night parade's). Everything the serving game needs to know about where things are.
import * as THREE from 'three';
import { Model, C } from '../voxel.js';
import { buildTokyo, TK } from './tokyo/world.js';
import { placeTokyo, KOTATSU } from './tokyo/props.js';
import { decorateTokyo, cityBackdrop, TOWER } from './tokyo/decor.js';

const F2 = TK.F2, R = Math.PI / 2;
const KX = KOTATSU.x, KZ = KOTATSU.z;

// beer crates stacked against the back door until you clear them
const crates = () => {
  const m = new Model(14, 16, 7, 1 / 16, [7, 0, 3.5]);
  const cols = [C('#c8302a', 0, 0.05), C('#e8c040', 0, 0.05), C('#2a5ab0', 0, 0.05)];
  for (let i = 0; i < 6; i++) {
    const cx = (i % 2) * 7, cy = Math.floor(i / 2) * 5, c = cols[i % 3];
    m.box(cx, cy, 0, cx + 7, cy + 5, 7, (x, y, z) => (x === cx || x === cx + 6 || z === 0 || z === 6 || y === cy ? c : (y === cy + 4 ? C('#2a2620', 0, 0.04) : null)));
    for (let b = 0; b < 2; b++) m.box(cx + 1 + b * 3, cy + 1, 2, cx + 3 + b * 3, cy + 4, 4, C('#5a3a1a', 0, 0.05));
  }
  m.box(0, 15, 0, 14, 16, 7, C('#eef3fb', 0, 0.03));
  return m;
};

const lookYaw = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

export const TOKYO = {
  id: 'tokyo',
  L: {
    floor: 0.25, walk: 0.125, ceil: 3.5,
    inside: { x0: 0.25, x1: 9.75, z0: 0.25, z1: 12.75 },
    door: { x0: 5.75, x1: 7.0, z: 0.125, hinge: 5.8125, h: 2.625 },
    cliff: -16,
    bounds: { x0: -15.6, x1: 35.6, z0: -6.75, z1: 15.0 },
    // where no snow falls: the shop, the street under the overpass, the laundry, the convenience store
    roofDry: [[0, 10, 0, 13], [-12.25, -9.75, -16, 18], [12, 18, 0, 13], [-3, 9, -16, -7]],
  },
  build: (world) => buildTokyo(world),
  props: (batch) => placeTokyo(batch),
  backdrop: () => cityBackdrop(),
  decorate: (scene, ctx) => decorateTokyo(scene, ctx),
  view: {
    scope: [TOWER.x, 236, TOWER.z],             // the telescope finds Tokyo Tower's top deck
    sunrise: { from: [6.4, 1.75, -1.8], to: [4.0, 13.5, -3.6], look: [0, 60, -500] }, // up over the rooftops at first light
    snowLights: ['door', 'kanban', 'vending', 'izakaya', 'laundry', 'conbini0', 'conbini3', 'lamp11'],
    sky: { city: true },
    fog: 0.016,
    nightHaze: new THREE.Color(0x231a2a),
  },
  shop: {
    counters: [
      [1.5, 9.35, 4.58, 4.88, 1.125],   // the counter, your side of the belt
      [8.9, 9.72, 4.95, 8.3, 1.125],    // the side counter along the kitchen's east wall
      [8.05, 9.72, 1.6, 2.1, 1.0],      // the register counter by the door
    ],
    keepClear: [[9.3, 5.15, 0.2], [9.3, 5.45, 0.2], [9.3, 6.0, 0.45], [9.3, 6.65, 0.22], [9.3, 7.03, 0.22], [9.3, 7.5, 0.3], [9.3, 8.0, 0.3],
      [8.9, 1.85, 0.3], [9.45, 1.75, 0.2], [8.35, 1.85, 0.2], [9.55, 4.4, 0.3], [1.45, 4.4, 0.3]],
    register: { x: 8.9, z: 1.85, box: [8.9, 1.12, 1.85, 0.24, 0.22, 0.22] },
    queue: [[8.9, 1.0], [8.2, 0.75], [9.45, 0.7]],
    stations: [
      { label: 'Yakitori', kind: 'yakitori', x: 4.05, z: 8.56, cook: 10, idle: 'Lay skewers on the grill' },
      { label: 'Yakitori', kind: 'yakitori', x: 5.05, z: 8.56, cook: 10, idle: 'Lay skewers on the grill' },
      { label: 'Gyoza', kind: 'gyoza', x: 3.05, z: 8.56, cook: 13, idle: 'Fry a batch of gyoza' },
      { label: 'Tempura', kind: 'tempura', x: 1.925, z: 8.56, cook: 11, shape: 'fry', idle: 'Drop tempura in the fryer' },
      { label: 'Ramen', kind: 'ramen', x: 6.1, z: 8.56, cook: 15, shape: 'ramen', idle: 'Start a bowl of ramen' },
    ],
    sink: { x: 0.625, z: 7.0 },
    boxes: {
      mugs: [9.66, 2.08, 6.6, 0.12, 0.12, 2.0],
      plates: [[[9.3, 1.35, 5.3, 0.18, 0.24, 0.32], 'platesK']],
      urns: [9.3, 1.55, 7.75, 0.25, 0.45, 0.55],
      sushi: [9.3, 1.3, 6.0, 0.2, 0.2, 0.42],
      icecream: [5.25, 1.05, 12.35, 0.6, 0.15, 0.38],
      rice: [9.3, 1.3, 6.84, 0.2, 0.2, 0.4],
    },
    // straight along the counter, out of the hatch at the east end and back in at the west
    belt: { path: [[9.4, 4.4], [1.6, 4.4]], kitchen: () => false },
    seatWeight: (s) => (s.kind === 'booth' ? 1.4 : 1.6),
    crowd: {
      nav: [-15.5, -6.9, 35.5, 13.0], spawns: [[-15.0, -3.4], [35.0, -3.6]],
      blocked: [[9.6, 10.8, 9.2, 10.7]],      // the back door: guests come in the front
      back: null,
      passersby: { every: [2.5, 6], max: 9 },  // the street's never empty
    },
    chores: {
      sweep: [[6.4, 0.85], [5.4, 2.45], [3.2, 2.35], [1.2, 2.5], [7.6, 2.6], [2.2, 2.0]], sweepY: 0.25,
      shovel: [[0.8, -0.95], [2.6, -1.25], [4.3, -0.85], [6.4, -1.15], [8.3, -1.3], [9.9, -0.8]], shovelY: 0.125,
    },
    staff: {
      staff_wash: { x: 1.2, z: 6.6, yaw: R },
      staff_sushi: { x: 8.4, z: 6.1, yaw: -R },
      staff_hall: { x: 9.45, z: 2.6, yaw: 0 },
    },
    steam: [
      { pos: [9.3, 2.0, 7.5], size: 0.3 }, { pos: [9.3, 2.0, 8.0], size: 0.3 }, { pos: [9.3, 1.55, 6.84], size: 0.3 },
      { pos: [6.1, 1.6, 8.4], size: 0.7 }, { pos: [7.15, 1.4, 8.4], size: 0.5 },
      { pos: [4.05, 1.3, 8.45], size: 0.85 }, { pos: [5.05, 1.3, 8.45], size: 0.85 }, { pos: [3.05, 1.2, 8.4], size: 0.6 },
    ],
    doors: [
      { key: 'front', name: 'door', front: true, hinge: [5.8125, 0.125], plusDir: [0, -1], max: 1.6, block: [5.75, 7.0, 0.0, 0.25], bell: true, slide: 1.12 },
      { key: 'rest', name: 'washroom door', kind: 'restroom', hinge: [3.0, 10.4375], base: 0, plusDir: [0, 1], block: [3.0, 4.0, 10.375, 10.5] },
      { key: 'back', name: 'back door', kind: 'exit', hinge: [9.875, 9.3], base: -R, plusDir: [1, 0], block: [9.75, 10.0, 9.3, 10.55],
        needs: 'backdoor', locked: ['Back door (blocked)', "beer crates are stacked against it outside. (the catalog: clear the back door)"] },
      { key: 'freezer', name: 'freezer door', kind: 'freezer', hinge: [4.5, 10.4375], base: 0, plusDir: [0, 1], block: [4.5, 5.75, 10.375, 10.5],
        needs: 'freezer', locked: ['Walk-in freezer (switched off)', "the old walk-in's been off for years. (the catalog: get it running)"] },
      { key: 'kura', name: 'storeroom door', kind: 'kura', hinge: [0.125, 10.5], base: -R, plusDir: [-1, 0], block: [0.0, 0.25, 10.5, 12.0], slideDir: [0, -1], slideDist: 1.45, y: 0.125,
        needs: 'kura', locked: ['The storeroom (padlocked)', "it's full of the last owner's junk. (the catalog: clear out the storeroom)"] },
    ],
    backPile: crates, snowPile: [10.5, 0.125, 9.95], snowPileYaw: R,
    clock: { pos: [8.5, 2.85, 8.98], yaw: 0 },
    sign: { pos: [9.0, 1.55, 0.3], yaw: 0, box: [9.0, 1.7, 0.32, 0.32, 0.2, 0.14] },
    radio: [0.45, 2.1, 5.3],
    sizzle: [4.2, 8.6],
    faucets: [
      { stream: [0.585, 1.55, 0.75, 7.05], box: [0.445, 1.45, 7.05, 0.09, 0.14, 0.12] },
      { stream: [3.04, 1.3, 1.13, 10.9], box: [3.1, 1.2, 10.9, 0.3, 0.2, 0.34] },
    ],
    acts: [
      { box: [3.5, 0.6, 12.35, 0.3, 0.45, 0.4], act: 'flush' },
      { box: [3.25, 0.74, 12.1, 0.14, 0.08, 0.16], act: 'princess' },
      { box: [4.18, 1.1, 11.1, 0.08, 0.28, 0.22], act: 'towel' },
      { box: [0.45, 2.1, 5.3, 0.14, 0.16, 0.22], act: 'radio' },
      { box: [20.4, 0.25, -0.35, 0.28, 0.16, 0.2], act: 'cat' },
      { box: [22.4, 1.2, -0.75, 0.45, 0.6, 0.12], act: 'vending' },
      { box: [KX + 0.35, 4.28, KZ + 0.1, 0.16, 0.06, 0.2], act: 'catalog' },
      { box: [8.0, 3.95, 8.6, 0.5, 0.2, 1.0], act: 'futon' },
      { box: [1.35, 4.8, 6.55, 0.2, 0.15, 0.22], act: 'kettle' },
      { box: [6.5, 4.2, 7.4, 0.22, 0.45, 0.22], act: 'andon' },
    ],
    shrine: { x: 19.25, z: 2.5, box: [19.25, 0.8, 2.5, 0.55, 0.7, 0.62] },
    wake: { x: 6.9, z: 8.8, yaw: 0.25 },
    title: { x: 2.0, z: -5.7, yaw: lookYaw(2.0, -5.7, 6.4, 0.0), pitch: 0.2 }, // across the street, looking at the shop
  },
  home: {
    fixed: {
      lanterns: [[2.6, 5.95, 0.45, 0], [7.4, 5.95, 0.45, 0]],
      print: [[9.73, F2 + 1.3, 7.4, 1]],
      heaters: [[0.55, 0.25, 2.55, 1], [9.45, 0.25, 3.1, 3]],
      fridge: [[5.2, 0.25, 1.6, 3]],
    },
    at: {
      bonsai: [8.9, 0.75, 0], plant1: [0.7, 0.75, 0], plant2: [9.3, 5.4, 0], catbed: [9.3, 9.0, 0], fishtank: [0.55, 4.6, 3],
      record: [9.45, 3.8, 1], telescope: [7.6, 0.85, 0], irori: [2.8, 8.6, 0], crt: [2.3, KZ, 3],
    },
    noGo: [[5.25, 9.8, 11.6, 12.8], [3.25, 4.5, 5.6, 6.4], [6.5, 7.75, 5.6, 6.4], [KX - 1.1, KX + 1.5, KZ - 1.25, KZ + 1.25],
      [7.4, 8.6, 7.5, 9.7], [0.3, 2.9, 6.1, 7.0], [9.2, 9.8, 0.9, 2.3], [9.1, 9.8, 9.7, 11.1], [4.5, 5.5, 12.1, 12.7], [6.2, 6.8, 7.1, 7.7], [4.6, 6.3, 9.2, 11.6]],
    room: { x0: 0.4, x1: 9.6, z0: 0.4, z1: 12.6 },
  },
  test: {
    sink: [1.25, 7.0], beltCam: [[9.0, 1.8, 5.2], [9.0, 1.125, 4.4]],
    bowFrom: [19.25, 0.125, 0.9], bonsaiTo: [1.4, 1.6, 1], iroriNo: [4.5, 4.5], tvTo: [7.0, 2.6],
  },
};
