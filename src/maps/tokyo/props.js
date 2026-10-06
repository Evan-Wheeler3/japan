// What stands in the Tokyo shop (the same as on the mountain: props.placeProps in its city dress) and out on the
// street: lanterns at the bars' doors, strings of them across the street, rows of vending machines, the postbox, the
// shed's barrels.
import * as P from '../../props.js';
import { TK } from './world.js';

export function placeTokyo(batch) {
  P.placeProps(batch, { city: true });
  const S = 0.125, N = TK.north, SO = TK.south;

  // ================= our door: the noren, a lantern either side, banners on the pavement
  batch.add(P.noren(), 13.375, 2.75, N - 0.095, 0, false);
  batch.add(P.chochin(3, 'red', 1 / 16), 12.35, 1.7, N - 0.245, 0, false);
  batch.add(P.chochin(3, 'red', 1 / 16), 14.4, 1.7, N - 0.245, 0, false);
  batch.add(P.nobori(), 11.75, S, -5.1, 0); batch.add(P.nobori(), 15.25, S, -5.1, 0);

  // ================= the neighbours' doors: red lanterns at the izakaya, the bars, the ramen shop, the yakiniku place
  for (const [x, z] of [[-11.9, N - 0.3], [-7.6, N - 0.3], [-3.9, N - 0.3], [24.6, N - 0.95], [28.9, N - 0.95]]) batch.add(P.chochin(4, 'red', 1 / 16), x, 2.1, z, 0, false);
  batch.add(P.chochin(6, 'red', 1 / 12), 26.75, 2.1, N - 0.7, 0, false);                 // the izakaya's big one
  batch.add(P.noren(), 26.75, 2.35, N - 0.1, 0, false); batch.add(P.noren(), -10.75, 2.35, N - 0.1, 0, false);
  for (const [x, z] of [[-5.0, SO + 0.3], [-0.0, SO + 0.3], [19.5, SO + 0.3], [25.5, SO + 0.3], [-15.3, SO + 0.3], [-13.2, SO + 0.3]]) batch.add(P.chochin(4, 'red', 1 / 16), x, 2.1, z, 2, false);
  for (const [x, z] of [[-15.3, N - 0.3], [-13.2, N - 0.3]]) batch.add(P.chochin(4, 'cream', 1 / 16), x, 2.1, z, 0, false); // the arch bar under the tracks
  batch.add(P.noren(), -1.25, 2.35, SO + 0.1, 2, false);
  // strings of paper lanterns across the street
  for (const [gx, hN, hS, sag] of TK.garlands) {
    const n = 11;
    for (let i = 1; i < n; i++) {
      const t = i / n, z = N + (SO - N) * t, y = hN + (hS - hN) * t - Math.sin(t * Math.PI) * sag - 0.35;
      batch.add(P.chochin(3, i % 3 === 0 ? 'cream' : 'red', 1 / 16), gx, y, z, 0, false);
    }
  }

  // ================= vending machines: a row of four under E1's canopy, two more by the mansion over the road
  for (const x of [16.75, 17.9, 19.05, 20.2]) batch.add(P.vending(), x, S, N - 0.42, 0);
  for (const x of [27.4, 28.55]) batch.add(P.vending(), x, S, SO + 0.42, 2);
  batch.add(P.vending(), -5.0 + 0.6, S, SO + 0.42, 2);                              // the ramen shop's ticket machine
  batch.add(P.postbox(), -0.45, S, N - 0.3);
  batch.add(P.umbrellaStand(), -2.2, S, N - 0.35);

  // ================= the gomi stations: one out front on the pavement, one in the corner of the yard
  batch.add(P.gomiCage(), 1.0, S, N - 0.45, 0, true, 'gomi_front');
  batch.add(P.gomiCage(), 16.95, S, 17.2, 0, true, 'gomi_back');
  // ================= the yard: the neighbours' air conditioners, the brewery's empty crates, somebody's bike
  for (const x of [17.6, 18.7]) batch.add(P.acUnit(), x, 3.25, 11.0, 2);            // up on next door's roof, by the fire escape's way across
  batch.add(P.beerCrates(), 18.9, S, 13.72, 2);                                    // tucked under the fire escape
  batch.add(P.bicycle(), 19.35, S, 17.42, 0);
  // ================= the shed: barrels along the back wall, racks, a lantern (opened up from the catalog)
  const Sh = TK.shed, F = Sh.floor;
  for (let i = 0; i < 3; i++) batch.add(P.sakeTaru(), Sh.x0 + 0.75 + i * 0.7, F, Sh.z1 - 0.55, 0);
  for (let i = 0; i < 2; i++) batch.add(P.sakeTaru(), Sh.x0 + 1.1 + i * 0.7, F + 0.75, Sh.z1 - 0.55, 0, false);
  batch.add(P.sakeRack(), Sh.x1 - 0.5, F, 15.0, 1);
  batch.add(P.chochin(6, 'red'), (Sh.x0 + Sh.x1) / 2, 2.6, 15.2, 0, false);
}
