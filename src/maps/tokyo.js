// Tokyo: the shop on a narrow, snowy street of little bars and shops under a railway viaduct, late. The serving game
// is played here (the mountain lot is the night parade's). It's the very same shop as on the mountain, so most of
// what the game needs to know about it is the mountain's, word for word; what's different is the street outside, the
// stairs up to the flat (inside, off the restroom hall) and the back door (from the kitchen, onto a little yard and
// the shed at the back of it).
import * as THREE from 'three';
import { L as ML } from '../world.js';
import { MOUNTAIN } from './mountain.js';
import { buildTokyo, TK } from './tokyo/world.js';
import { placeTokyo } from './tokyo/props.js';
import { decorateTokyo, cityBackdrop, TOWER } from './tokyo/decor.js';

const R = Math.PI / 2;
const M = MOUNTAIN.shop;
const lookYaw = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
const N = TK.north, S = TK.south;

export const TOKYO = {
  id: 'tokyo',
  L: {
    ...ML, inside: { ...ML.inside }, door: { ...ML.door },
    cliff: -16,
    bounds: { x0: TK.ends.x0 + 0.3, x1: TK.ends.x1 - 0.3, z0: S + 0.3, z1: 17.6 },
    // where no snow falls: the shop, under the viaduct, the shed, the store fronts' awnings
    roofDry: [[-0.75, 16.75, -4.0, 16.75], [-16, -12.5, -16, 18], [19.0, 24.0, 12.5, 18]],
  },
  build: (world) => buildTokyo(world),
  props: (batch) => placeTokyo(batch),
  backdrop: () => cityBackdrop(),
  decorate: (scene, ctx) => decorateTokyo(scene, ctx),
  view: {
    scope: [TOWER.x, 236, TOWER.z],             // the telescope finds Tokyo Tower's top deck
    sunrise: { from: [13.4, 1.75, -5.0], to: [9.0, 14.5, -7.5], look: [TOWER.x * 0.6, 70, TOWER.z * 0.6] }, // up over the rooftops at first light
    snowLights: ['door', 'kanban', 'vending', 'izakayaE', 'izakayaW', 'laundry', 'conbiniA', 'lamp11.25', 'drug'],
    sky: { city: true },
    fog: 0.014,
    nightHaze: new THREE.Color(0x231a2a),
  },
  shop: {
    ...M,
    // a street full of people: guests come from either end, on either pavement; passers-by just walk through
    crowd: {
      nav: [TK.ends.x0 + 0.2, S + 0.2, TK.ends.x1 - 0.2, 16.0],
      spawns: [[TK.ends.x0 + 0.5, -4.4], [TK.ends.x1 - 0.5, -4.4], [TK.ends.x0 + 0.5, -12.05], [TK.ends.x1 - 0.5, -12.05]],
      back: null,
      passersby: { every: [2.0, 5.0], max: 10, ends: [TK.ends.x0 + 0.5, TK.ends.x1 - 0.5], lanes: [[-4.75, -4.45], [-10.4, -6.4], [-12.2, -11.95]] },
    },
    chores: { ...M.chores, shovel: [[1.5, -4.4], [4.6, -4.6], [7.6, -4.5], [10.5, -4.4], [13.3, -4.8], [15.2, -4.5]] },
    doors: [
      ...M.doors.filter((d) => ['front', 'kitchen', 'freezer'].includes(d.key)),
      { ...M.doors.find((d) => d.key === 'restA'), hinge: [2.5625, 11.0], block: [2.5, 2.75, 11.0, 12.0] }, // the hall's wider here
      { key: 'back', name: 'back door', kind: 'exit', hinge: [15.6875, 14.375], base: -R, plusDir: [1, 0], block: [15.625, 16.125, 14.375, 15.625],
        needs: 'backdoor', locked: ['Back door (snowed shut)', 'snow drifted up against it in the yard. (the catalog: dig out the back door)'] },
      { key: 'kura', name: 'shed door', kind: 'kura', hinge: [TK.shed.x0 + 0.125, 14.5], base: -R, plusDir: [-1, 0], block: [TK.shed.x0, TK.shed.x0 + 0.25, 14.5, 16.0],
        slideDir: [0, -1], slideDist: 1.45, y: TK.shed.floor,
        needs: 'kura', locked: ['The old shed (padlocked)', "it's full of the last owner's junk. (the catalog: clear out the shed)"] },
    ],
    snowPile: [16.6, 0.125, 15.0], snowPileYaw: -R,
    faucets: M.faucets.slice(0, 1).concat(M.faucets.slice(2)),
    acts: [
      ...M.acts.filter((a) => !['chain', 'vending'].includes(a.act) && !(a.act === 'towel' && a.box[2] > 13)),
      { box: [17.9, 1.2, N - 0.8, 0.45, 0.6, 0.12], act: 'vending' },
    ],
    shrine: { x: TK.shrine.x, z: TK.shrine.z, box: [TK.shrine.x, 0.8, TK.shrine.z, 0.55, 0.7, 0.6] },
    // behind the menu: across the street, looking back at the shop under the snow
    title: { x: 1.5, z: -11.0, yaw: lookYaw(1.5, -11.0, 11.5, -3.4), pitch: 0.15 },
  },
  // the flat is the mountain's, but here the whole floor is yours: keep furniture out of the doorways to the hall
  // and to the spare room
  home: { ...MOUNTAIN.home, noGo: [...MOUNTAIN.home.noGo, [6.0, 7.4, 7.6, 8.5], [5.75, 6.7, 6.4, 7.6]] },
  homeKey: 'mountain',                       // the very same flat, so the same arrangement of your things
  // the catalog in this map's words
  catalog: {
    backdoor: { text: "Shovel the drift off the kitchen's back door. The yard behind is ours too: regulars from the bars round the back start dropping in: one more guest in every rush." },
    kura: { name: 'Clear out the old shed', text: "Haul the last owner's junk out of the shed in the yard and keep your own sake there. A cup of house sake goes on every bill: ¥400 more." },
    lanterns: { text: "Little lanterns along the flat's front windows, over the street." },
    telescope: { text: 'At the front window. Look at Tokyo Tower up close.' },
  },
  test: {
    ...MOUNTAIN.test,
    bowFrom: [TK.shrine.x, 0.125, 0.4],
    // on foot from the futon to the flat's door, down the stairs into the restroom hall, and back up again
    walk: [[[11.6, 3.4], [10.3, 3.4], [10.0, 6.6], [6.7, 7.6], [6.7, 9.45, 3.75], [0.75, 9.45], [0.75, 15.35, 0.25], [1.9, 15.35], [1.9, 10.6], [1.9, 9.3, 0.25]],
           [[1.9, 10.6], [1.9, 15.35], [0.75, 15.35], [0.75, 9.45, 3.75], [6.7, 9.45], [6.7, 7.6, 3.75], [10.0, 6.6], [10.3, 3.4], [12.4, 3.0, 3.75]]],
  },
};
