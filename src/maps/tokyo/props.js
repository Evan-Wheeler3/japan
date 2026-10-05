// Everything that stands in (and in front of) the Tokyo shop: the stools and booths and their seats, the counter and
// kitchen gear, the back rooms, the flat upstairs, and the street outside.
import { rng } from '../../voxel.js';
import * as P from '../../props.js';
import { TK } from './world.js';

export const STOOLS = [2.0, 2.8, 3.6, 4.4, 5.2, 6.0, 6.8, 7.6, 8.4];
export const BOOTHS = [1.4, 3.65];
export const KOTATSU = { x: 5.0, z: 3.0 };

export function placeTokyo(batch) {
  const F = 0.25, F2 = TK.F2, R = Math.PI / 2;
  const seats = batch.seats = [];
  const r = rng(77);

  // ================= the counter: nine stools on the step, facing the belt
  for (const x of STOOLS) {
    batch.add(P.stool(), x, 0.375, 3.4, 2);
    seats.push({ x, z: 3.4, y: 1.06, yaw: Math.PI, kind: 'stool', surf: 1.125, reach: 0.62, beltAt: [x, 4.4, 1.125] });
  }
  batch.add(P.beltHatch(), 9.55, 1.125, 4.4, 1, false);     // where the belt comes out of the kitchen...
  batch.add(P.beltHatch(), 1.45, 1.125, 4.4, 3, false);     // ...and goes back in
  for (const x of [2.5, 5.0, 7.5]) batch.add(P.chochin(5, x === 5.0 ? 'red' : 'cream'), x, 3.2, 3.95, 0, false);

  // ================= two booths in the front window, served by hand
  BOOTHS.forEach((bx, i) => {
    batch.add(P.booth(), bx, F, 0.25 + 21 / 32, 1);
    for (const sx of [-0.7, 0.7]) for (const sz of [0.575, 1.175]) seats.push({ x: bx + sx, z: sz, y: 0.69, yaw: sx < 0 ? -R : R, kind: 'booth', surf: 1.0, approach: [bx + sx, 1.955] });
    batch.add(P.tableSets[i % 4](), bx, F + 0.75, 0.705, 0, false);
    batch.add(P.bellPendant(22), bx, 2.95, 0.8, 0, false);
  });
  for (let x = 0.6; x < 4.7; x += 0.34 + r() * 0.12) batch.add(P.strands[Math.floor(r() * 4)](), x, 2.62, 0.32 + r() * 0.04, 0, false);

  // ================= the register by the door, its counter you stand behind
  batch.add(P.register(), 8.9, 1.0, 1.85, 2, false, 'register');
  batch.add(P.maneki(), 9.45, 1.0, 1.75, 0, false);
  batch.add(P.mikan(), 8.35, 1.0, 1.85, 0, false);
  batch.add(P.umbrellaStand(), 5.35, F, 0.55);
  // plastic food in the window: a little parade of dishes on the shelf
  batch.add(P.prepStuff(), 8.5, 0.875, 0.5, 0, false);

  // ================= the walls of the dining room: menu boards, sake, the daruma, a scroll
  [2.2, 4.0, 5.8, 7.6].forEach((x, i) => batch.add(P.menuBoards[i](), x, 2.95, 8.97, 0, false));
  batch.add(P.sakeBottles(), 0.38, 2.0, 2.4, 1, false);
  batch.add(P.darumaRow(), 0.38, 2.2, 3.4, 1, false);
  batch.add(P.kakejiku(), 9.72, 2.6, 2.6, 3, false);
  for (let z = 0.8, k = 2; z < 2.3; z += 0.75, k++) batch.add(P.prints[k % 10](), 9.74, 2.0, z, 3, false);
  batch.add(P.noren(), 8.5, 2.4, 9.0, 0, false);            // the kitchen doorway to the hall

  // ================= the kitchen: the cook line under the hood, the sink on the west wall, the side counter
  const KL = 8.56;
  batch.add(P.fryer(), 1.6, F, KL, 0, true, 'fry'); batch.add(P.fryer(), 2.25, F, KL, 0, true, 'fry');
  batch.add(P.gyozaTeppan(), 3.05, F, KL, 0, true, 'grill3.05');
  batch.add(P.yakitoriGrill(), 4.05, F, KL, 0, true, 'grill4.05'); batch.add(P.yakitoriGrill(), 5.05, F, KL, 0, true, 'grill5.05');
  batch.add(P.range(), 6.1, F, KL, 0, true, 'ramen'); batch.add(P.range(), 7.15, F, KL, 0);
  batch.add(P.hangingPans(), 4.6, 2.24, 7.6, 0, false);
  batch.add(P.ticketRail(), 4.6, 2.1, 4.95, 0, false);
  batch.add(P.dishRack(), 0.625, 0.875, 8.05, 0, false, 'dishRack');
  batch.add(P.faucetSpray(), 0.425, 0.875, 7.05, 3, false);
  batch.add(P.radio(), 0.45, 2.0, 5.3, 1, false);
  // the side counter: plates, the sushi case, the rice cookers, the tea urns; the cups on the shelf above
  const SC = 9.3, T = 1.125;
  batch.add(P.plates(), SC, T, 5.15, 0, false, 'platesK'); batch.add(P.plates(), SC, T, 5.45, 0, false, 'platesK');
  batch.add(P.sushiCase(), SC, T, 6.0, 1, false, 'sushi');
  batch.add(P.riceCooker(), SC, T, 6.65, 1, false, 'rice'); batch.add(P.riceCooker(), SC, T, 7.03, 1, false, 'rice');
  batch.add(P.urn(), SC, T, 7.5, 1, false, 'urns'); batch.add(P.urn(), SC, T, 8.0, 1, false, 'urns');
  batch.add(P.cupRow(), 9.66, 2.0, 5.6, 1, false, 'mugs'); batch.add(P.cupRow(), 9.66, 2.0, 7.55, 1, false, 'mugs');
  batch.add(P.teaTins(), 9.62, 2.0, 8.4, 1, false);

  // ================= the back: the washroom, the freezer, the storeroom
  batch.add(P.washlet(), 3.5, F, 12.35, 2);
  batch.add(P.paperHolder(), 4.18, 0.75, 12.2, 3, false);
  batch.add(P.washBasin(), 3.1, F, 10.9, 1);
  batch.add(P.roundMirror(), 2.79, 1.45, 10.95, 1, false);
  batch.add(P.tenugui(), 4.2, 1.35, 11.1, 3, false);
  batch.add(P.slippers(), 3.5, F, 10.75, 0, false);
  batch.add(P.ikebana(), 4.05, F, 11.6, 0, false);
  batch.add(P.restroomPlaque(), 3.5, 2.3, 10.36, 2, false);
  batch.add(P.chestFreezer(), 5.25, F, 12.35, 0);
  batch.add(P.freezerShelf(), 6.0, F, 11.55, 3);
  for (let i = 0; i < 3; i++) batch.add(P.sakeTaru(), 0.75 + i * 0.7 - 0.0, F, 12.25, 0);
  for (let i = 0; i < 2; i++) batch.add(P.sakeTaru(), 1.1 + i * 0.7, F + 0.75, 12.25, 0, false);
  batch.add(P.sakeRack(), 2.25, F, 10.5, 3);
  batch.add(P.chochin(5, 'red'), 1.4, 3.2, 11.0, 0, false);
  batch.add(P.exitSign(), 9.72, 2.4, 9.9, 3, false);
  batch.add(P.sacks(), 7.1, F, 10.95, 1);
  batch.add(P.prints[6](), 7.5, 1.6, 9.26, 2, false);

  // ================= outside: the noren and lanterns at the door, the vending machines, the street
  batch.add(P.noren(), 6.375, 2.6, -0.12, 0, false);
  batch.add(P.chochin(3, 'red', 1 / 16), 5.4, 1.9, -0.3, 0, false);
  batch.add(P.chochin(3, 'red', 1 / 16), 7.35, 1.9, -0.3, 0, false);
  for (const x of [-3.3, -5.2]) batch.add(P.chochin(4, 'red', 1 / 16), x, 2.1, -0.3, 0, false);  // the izakaya's
  batch.add(P.chochin(3, 'red', 1 / 16), -7.8, 2.0, -0.3, 0, false);                                // the yakitori stall's
  for (const x of [21.25, 22.4, 23.55]) batch.add(P.vending(), x, 0.125, -0.4, 0);
  batch.add(P.postbox(), 11.6, 0.125, -0.5);
  batch.add(P.nobori(), 4.9, 0.125, -0.35, 0); batch.add(P.nobori(), 9.2, 0.125, -0.35, 0);
  batch.add(P.cat(), 20.4, 0.125, -0.35, 1, false);               // a stray, keeping warm by the vending machines
  batch.add(P.pothosBasket(), 7.8, 2.4, -0.25, 0, false);

  // ================= the flat upstairs
  const home = batch.homeSeats = [];
  const KX = KOTATSU.x, KZ = KOTATSU.z;
  batch.add(P.kotatsu(), KX, F2, KZ, 0);
  batch.add(P.akari(), KX, F2 + 1.85, KZ, 0, false);
  batch.add(P.akari(), 7.6, F2 + 1.85, 8.6, 0, false);
  for (const [x, z, rot] of [[KX, KZ - 0.95, 0], [KX, KZ + 0.95, 2], [KX + 0.95, KZ, 3]]) {
    batch.add(P.zabuton(), x, F2, z, 0, false);
    home.push({ x, z, y: F2 + 0.3, yaw: rot * R + Math.PI, kind: 'cushion', app: [x + (x - KX) * 0.9, z + (z - KZ) * 0.9], floorY: F2 });
  }
  batch.add(P.mikan(), KX - 0.2, F2 + 0.5, KZ, 0, false);
  batch.add(P.catalogBook(), KX + 0.35, F2 + 0.5, KZ + 0.1, 0, false);
  batch.add(P.kakejiku(), 9.72, F2 + 1.75, 4.6, 3, false);
  batch.add(P.bookshelf(), 9.5, F2, 1.6, 3);
  batch.add(P.radio(), 9.45, F2 + 1.0, 1.6, 3, false);
  batch.add(P.futon(), 8.0, F2, 8.6, 0, false);
  batch.add(P.andon(), 6.5, F2, 7.4, 0);
  batch.add(P.tansu(), 9.4, F2, 10.4, 3);
  batch.add(P.kitchenette(), 1.6, F2, 6.55, 2);
  batch.add(P.shoeRack(), 5.0, F2, 12.4, 0);
  batch.add(P.noren(), 2.6, F2 + 2.0, 6.0, 0, false);
}
