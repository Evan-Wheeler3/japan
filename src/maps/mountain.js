// The cliff-top lot above the sea: the shop's first home (the big kaiten shop with the front room, the kitchen and
// the washrooms, the walk-in, the kura across the yard, the flat upstairs), the shrine on the west slope, Fuji over
// the bay. The night parade is always played here; the shop can still be opened here with ?map=mountain.
import { L, buildWorld } from '../world.js';
import { placeProps } from '../props.js';
import { makeBackdrop, FUJI } from '../effects.js';

const F2 = 3.75;
const R = Math.PI / 2;

export const MOUNTAIN = {
  id: 'mountain',
  L: { ...L, inside: { ...L.inside }, door: { ...L.door }, bounds: { ...L.bounds }, roofDry: L.roofDry.map((r) => [...r]) },
  build: (world) => buildWorld(world),
  props: (batch) => placeProps(batch),
  backdrop: () => makeBackdrop(),
  // the telescope swings round to Fuji's snowy top; the sun comes up over the bay
  view: {
    scope: [FUJI.x, FUJI.y + 118, FUJI.z],
    sunrise: { from: [13.4, 1.75, -4.9], to: [6.0, 1.75, -7.4], look: [FUJI.x * 0.5 + 40, 22, FUJI.z * 0.5] },
    snowLights: ['door', 'vending', 'kanban', 'toroA', 'toroB', 'upstairs', 'consL', 'consR'],
  },
  shop: {
    // counter tops things can be set down on: [x0, x1, z0, z1, top]
    counters: [
      [3.8, 11.7, 6.32, 6.7, 1.125],     // the kaiten counter, your side of the belt
      [11.8, 12.17, 6.8, 9.6, 1.125],    // ...and its east leg
      [3.8, 9.95, 9.15, 9.5, 1.0],       // the back bar, in front of the urns and plates
      [14.3, 15.7, -1.7, -1.05, 1.0],    // the register counter in the genkan
      [7.35, 10.4, 12.55, 13.2, 0.875],  // kitchen prep table
    ],
    // ...but not on top of what's already there: [x, z, radius]
    keepClear: [[4.3, 9.75, 0.25], [5.0, 9.75, 0.25], [6.3, 9.65, 0.6], [7.95, 9.7, 0.35], [9.5, 9.7, 0.22],
      [15.0, -1.35, 0.3], [15.55, -1.45, 0.2], [14.5, -1.35, 0.2], [8.9, 12.875, 0.45]],
    register: { x: 15.0, z: -1.35, box: [15.0, 1.12, -1.35, 0.24, 0.22, 0.22] },
    queue: [[15.0, -2.3], [15.3, -2.85], [14.45, -2.75]],
    stations: [
      { label: 'Yakitori', kind: 'yakitori', x: 9.65, z: 15.3, cook: 10, idle: 'Lay skewers on the grill' },
      { label: 'Yakitori', kind: 'yakitori', x: 10.65, z: 15.3, cook: 10, idle: 'Lay skewers on the grill' },
      { label: 'Gyoza', kind: 'gyoza', x: 8.1, z: 15.3, cook: 13, idle: 'Fry a batch of gyoza' },
      { label: 'Tempura', kind: 'tempura', x: 6.78, z: 15.3, cook: 11, shape: 'fry', idle: 'Drop tempura in the fryer' },
      { label: 'Ramen', kind: 'ramen', x: 12.0, z: 15.3, cook: 15, shape: 'ramen', idle: 'Start a bowl of ramen' },
    ],
    sink: { x: 5.5, z: 12.25 },            // the dish sink's middle; it runs along z with the rack past its +z end
    boxes: {                               // things to click: [x, y, z, half x, half y, half z]
      mugs: [6.9, 2.45, 9.8, 3.0, 0.12, 0.18],
      plates: [[[7.95, 1.2, 9.7, 0.35, 0.25, 0.25], 'platesA'], [[9.5, 1.2, 9.7, 0.2, 0.25, 0.25], 'platesB'], [[11.75, 1.35, 10.48, 0.32, 0.24, 0.18], 'platesK']],
      urns: [6.3, 1.45, 9.65, 0.55, 0.45, 0.25],
      sushi: [13.1, 1.3, 10.98, 0.42, 0.2, 0.2],
      icecream: [17.35, 1.05, 10.85, 0.6, 0.15, 0.38],
      rice: [11.74, 1.3, 10.98, 0.4, 0.2, 0.2],
    },
    // the kaiten belt's visible run (rounded at the corners), and which part of it is still in the kitchen
    belt: { path: [[12.35, 11.1], [12.35, 10.0], [12.35, 6.15], [3.15, 6.15], [3.15, 7.85]], kitchen: (x, z) => z > 10.0 },
    // the window booths are popular
    seatWeight: (s) => (s.z < 0 ? 1.6 : s.kind === 'stool' ? 1.7 : s.kind === 'booth' ? 1.6 : 0.8),
    crowd: { nav: [-1.5, -5.0, 34, 17.5], spawns: [[33.5, -4.3], [-1.0, 15.2], [-1.0, -4.6]], back: { spawn: [1.0, 17.0], block: [0.25, 1.75, 15.4, 16.6] } },
    // the hired help's posts (they walk from them to wherever the work is, and back)
    staff: {
      staff_wash: { x: 6.05, z: 12.55, yaw: Math.PI / 2 },
      staff_sushi: { x: 13.55, z: 11.62, yaw: 0 },
      staff_cook: { x: 10.2, z: 14.3, yaw: Math.PI },
      staff_waiter: { x: 13.25, z: 9.3, yaw: Math.PI },
      staff_hall: { x: 15.48, z: -0.62, yaw: 0 },
    },
    // the pass: dishes the cooks have plated wait here for whoever carries them out [x, top, z]; where the cook stands
    // to set one down (kitchen side), where a waiter stands to pick one up (dining side); where tea gets poured
    pass: [[12.92, 1.125, 10.05], [13.26, 1.125, 10.05], [13.6, 1.125, 10.05]],
    passCook: [13.0, 11.6], passGrab: [13.2, 9.35], urnStand: [6.3, 8.75],
    // the kitchen bin [x, floor, z] (how deep it is, where to stand at it) and the gomi stations a full bag goes out to:
    // the back one when the back door's open, the front one otherwise
    trash: {
      bin: [5.45, 0.25, 14.2], depth: 0.6, stand: [6.0, 14.2], box: [5.45, 0.5, 14.2, 0.26, 0.4, 0.26],
      stations: [
        { key: 'back', door: 'back', at: [2.9, 0.125, 17.1], yaw: 0, stand: [2.9, 16.35], box: [2.9, 0.55, 17.1, 0.8, 0.5, 0.45] },
        { key: 'front', at: [10.4, 0.125, -3.85], yaw: 0, stand: [10.4, -4.6], box: [10.4, 0.55, -3.85, 0.8, 0.5, 0.45] },
      ],
    },
    steam: [
      { pos: [6.0, 1.95, 9.65], size: 0.35 }, { pos: [6.6, 1.95, 9.65], size: 0.3 },        // the tea urns on the back bar
      { pos: [11.74, 1.55, 10.98], size: 0.3 },                                                 // the rice cookers by the pass
      { pos: [11.75, 1.6, 15.1], size: 0.7 }, { pos: [13.4, 1.4, 15.1], size: 0.5 },
      { pos: [9.65, 1.3, 15.2], size: 0.9 }, { pos: [10.65, 1.3, 15.2], size: 0.9 }, { pos: [8.1, 1.2, 15.1], size: 0.6 },
    ],
    // doors: the front door (its own model) and the rest (props.swingDoor kinds). hinge [x, z], block [x0, x1, z0, z1]
    doors: [
      { key: 'front', name: 'door', front: true, hinge: [12.8125, -3.25], plusDir: [0, -1], max: 1.6, block: [12.75, 14.0, -3.375, -3.125], bell: true, slide: 1.12 },
      { key: 'kitchen', name: 'kitchen door', kind: 'kitchen', hinge: [14.0, 10.0625], base: 0, plusDir: [0, -1], block: [14.0, 15.125, 9.875, 10.25] },
      { key: 'restA', name: 'restroom door', kind: 'restroom', hinge: [1.8125, 11.0], base: -R, plusDir: [1, 0], block: [1.75, 2.0, 11.0, 12.0], slideDir: [0, 1] },
      { key: 'restB', name: 'restroom door', kind: 'restroom', hinge: [1.8125, 13.75], base: -R, plusDir: [1, 0], block: [1.75, 2.0, 13.75, 14.75], slideDir: [0, 1] },
      { key: 'back', name: 'back door', kind: 'exit', hinge: [0.375, 15.6875], base: 0, plusDir: [0, 1], block: [0.375, 1.625, 15.625, 16.0],
        needs: 'backdoor', locked: ['Back door (snowed shut)', "a wall of snow on the other side. (it'll be dug out when the shop's grown a bit: see the catalog's milestones)"] },
      { key: 'freezer', name: 'freezer door', kind: 'freezer', hinge: [15.6875, 11.0], base: -R, plusDir: [1, 0], block: [15.625, 16.125, 11.0, 12.25],
        needs: 'freezer', locked: ['Walk-in freezer (locked)', "nobody's seen its key in years. (see the catalog's milestones)"] },
      { key: 'kura', name: 'kura door', kind: 'kura', hinge: [23.25, 2.9375], base: 0, plusDir: [0, -1], block: [23.25, 24.75, 2.875, 3.25], slideDir: [-1, 0], slideDist: 1.45, y: 0.5,
        needs: 'kura', locked: ['The old kura (boarded up)', "it's padlocked, and nobody has the key. (see the catalog's milestones)"] },
    ],
    snowPile: [1.0, 0.125, 16.55],          // heaped against the back door until it's dug out
    backHint: 'snowed shut from outside: go out the front, round the side of the shop, and dig it out',
    clock: { pos: [14.56, 2.85, 10.0], yaw: 0 },
    sign: { pos: [14.9, 1.55, -3.07], box: [14.9, 1.7, -3.05, 0.32, 0.2, 0.14] },
    radio: [4.3, 1.2, 9.75],
    sizzle: [10.15, 15.2],
    // taps: a little stream of water [x, top y, bottom y, z] and where to click
    faucets: [
      { stream: [3.1, 1.3, 1.13, 10.49], box: [3.1, 1.2, 10.55, 0.34, 0.2, 0.3] },
      { stream: [3.1, 1.3, 1.13, 13.365], box: [3.1, 1.2, 13.425, 0.34, 0.2, 0.3] },
      { stream: [5.46, 1.55, 0.75, 12.3], box: [5.32, 1.45, 12.3, 0.09, 0.14, 0.12] },
    ],
    // everything else to click, by what it does (main.js knows how to do each)
    acts: [
      { box: [4.49, 0.6, 12.45, 0.4, 0.45, 0.3], act: 'flush' },
      { box: [4.3, 0.74, 12.2, 0.14, 0.08, 0.16], act: 'princess' },
      { box: [4.66, 1.5, 14.26, 0.14, 0.22, 0.14], act: 'chain' },
      { box: [4.15, 1.1, 10.33, 0.22, 0.28, 0.08], act: 'towel' }, { box: [4.15, 1.1, 13.205, 0.22, 0.28, 0.08], act: 'towel' },
      { box: [4.3, 1.12, 9.75, 0.22, 0.16, 0.14], act: 'radio' },
      { box: [12.3, 1.12, -3.0, 0.28, 0.16, 0.16], act: 'cat' },
      { box: [19.2, 1.2, -2.95, 0.45, 0.6, 0.12], act: 'vending' },
      { box: [9.25, 4.28, 3.7, 0.16, 0.06, 0.2], act: 'catalog' },
      { box: [13.6, 3.95, 3.3, 0.5, 0.2, 1.0], act: 'futon' },
      { box: [12.5, 4.8, 8.1, 0.2, 0.15, 0.22], act: 'kettle' },
      { box: [12.0, 4.2, 4.3, 0.22, 0.45, 0.22], act: 'andon' },
    ],
    shrine: { x: -7.6, z: 3.0, box: [-7.45, 0.8, 3.0, 0.55, 0.7, 0.62] },
    wake: { x: 12.4, z: 2.4, yaw: 0.15 },  // in the bedroom, beside the futon, facing the bay
    title: { x: 15.3, z: 9.45, yaw: 0.82, pitch: 0.03 }, // where the camera waits behind the menu
  },
  home: {
    fixed: {
      lanterns: [[8.4, 6.3, 0.95, 0], [13.3, 6.3, 0.95, 0]],
      print: [[5.77, F2 + 1.25, 2.35, 3]],
      heaters: [[0.6, 0.25, 3.0, 1], [15.3, 0.25, 4.3, 3]],
      fridge: [[15.3, 0.25, 2.25, 1]],
    },
    at: {
      bonsai: [8.2, 5.1, 0], plant1: [10.6, 2.15, 0], plant2: [15.35, 0.7, 0], catbed: [15.2, 4.85, 0], fishtank: [6.0, 6.6, 3],
      record: [6.1, 8.0, 3], telescope: [12.0, 0.85, 0], irori: [7.95, 7.1, 0], crt: [6.25, 3.6, 3],
    },
    noGo: [[7.85, 10.3, 2.5, 4.7], [13.05, 14.15, 2.3, 4.3], [13.9, 15.8, 5.6, 8.5], [5.75, 7.65, 4.7, 5.5],
      [6.7, 9.3, 1.45, 1.95], [11.8, 14.2, 1.45, 1.95], [10.85, 11.4, 2.85, 3.95], [7.7, 11.0, 5.35, 5.85], [10.9, 13.9, 7.4, 8.5]],
    room: { x0: 5.8, x1: 15.7, z0: 0.3, z1: 8.45 },
  },
  // the catalog in this map's words: no fire escape up here, the back's reached round the outside
  catalog: {
    backdoor: { text: "The back door's snowed shut from outside. Go out the front, round the side of the shop, and shovel the drift off it. Then guests come down from the shrine path the back way (one more in every rush), and the trash goes out the back." },
  },
  // spots the playtest walks to
  test: {
    sink: [5.9, 12.3], beltCam: [[12.35, 1.8, 11.75], [12.35, 1.125, 10.9]],
    bowFrom: [-6.4, 0.125, 3.0], bonsaiTo: [6.5, 2.5, 1], iroriNo: [4.5, 4.5], tvTo: [10.5, 2.5],
  },
};
