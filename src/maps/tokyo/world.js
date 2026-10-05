// Tokyo, late at night, snowing: a narrow side street under a railway overpass, lit by a convenience store, vending
// machines and neon. Yoake is a hole in the wall on the north side: a sliding glass door under a noren, nine stools
// at a counter with the sushi belt on it, two booths in the window, an open kitchen behind. At the back, a little
// hall: the washroom, the walk-in freezer, the back door out to the east alley, and the stair up to the flat over
// the shop. The storeroom is built onto the back corner; its only door is round the side, in the west alley.
//
// Layout (metres): the street runs along x between the building lines z = -7 (south) and z = 0 (north). Our building
// is x 0..10, z 0..13; alleys either side (x -2..0 and 10..12) lead to a back alley (z 13..15).
import { C, hash01, glyphPixels, textWidth } from '../../voxel.js';
import { OX, OY, OZ, VS, SX, SZ } from '../../world.js';

export const TK = {
  street: { z0: -7.0, z1: 0.0 },
  shop: { x0: 0, x1: 10, z0: 0, z1: 13 },
  F2: 3.75,               // the flat's floor
  ceil1: 3.5, roof: 6.5,  // the shop's ceiling, the flat's roof slab
  overpass: { x0: -12.25, x1: -9.75, deck: 6.0 },
  stair: { x0: 6.375, x1: 8.875 },  // the treads (a landing east of them, x 8.875..9.75, at the foot)
};

function vnoise(x, z, cell, seed) {
  const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz);
  let tx = fx - ix, tz = fz - iz; tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
  const h = (a, b) => hash01(a, seed, b);
  const a = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * tx, b = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * tx;
  return a + (b - a) * tz;
}

export function buildTokyo(W) {
  const G = W.grid;
  const X = (m) => W.vx(m), Y = (m) => W.vy(m), Z = (m) => W.vz(m);
  const B = (...a) => W.box(...a);
  const mx = (x) => OX + (x + 0.5) * VS, my = (y) => OY + (y + 0.5) * VS, mz = (z) => OZ + (z + 0.5) * VS;
  const meta = { lights: [], glass: [], etched: [], steam: [], signs: [] };
  const light = (name, pos, color, intensity, distance) => meta.lights.push({ name, pos, color, intensity, distance });

  // ------------------------------------------------------------ palette
  const P = {
    snow: [C('#eef3fb', 0, 0.025), C('#e6edf8', 0, 0.025), C('#f4f7fc', 0, 0.02), C('#dde6f3', 0, 0.03)], snowShade: C('#cfdaea', 0, 0.03),
    asphalt: [C('#2a2c30', 0, 0.06), C('#24262a', 0, 0.06), C('#303236', 0, 0.05)], wet: C('#1a1c20', 0, 0.04), slush: C('#8a909a', 0, 0.06),
    line: C('#e8e6dc', 0, 0.03), curb: C('#8c8e92', 0, 0.05), drain: C('#3a3a3c', 0, 0.04), manhole: C('#4a4844', 0, 0.06),
    concrete: [C('#9a9a98', 0, 0.06), C('#8e8e8c', 0, 0.06), C('#a6a6a2', 0, 0.05)], concreteD: C('#6e6e6c', 0, 0.05),
    tileW: [C('#e2ddd2', 0, 0.03), C('#d6d0c4', 0, 0.03)], tileB: [C('#b8a890', 0, 0.04), C('#a89880', 0, 0.04)], tileG: [C('#6a7468', 0, 0.04), C('#5e685c', 0, 0.04)],
    tileR: [C('#8a5a4a', 0, 0.04), C('#7c4e40', 0, 0.04)],
    shutter: [C('#7a7c80', 0, 0.03), C('#6a6c70', 0, 0.03)], metal: C('#5a5e64', 0, 0.04), metalD: C('#3a3c40', 0, 0.04), black: C('#141416', 0, 0.03),
    frame: C('#2a2c30', 0, 0.03), glassDark: C('#1c2430', 0, 0.03),
    win: [C('#ffd8a0', 1.2, 0.08), C('#ffe6c0', 1.0, 0.08), C('#d8e8ff', 1.1, 0.06), C('#ffc890', 1.3, 0.08)], winDim: C('#3a3428', 0.25, 0.05), curtain: [C('#c88a5a', 0.6, 0.06), C('#8aa0c8', 0.5, 0.06), C('#d8c8a0', 0.7, 0.05)],
    yaki: [C('#1f1a17', 0, 0.06), C('#28211c', 0, 0.06)], timber: C('#3a2416', 0, 0.06), timberD: C('#2a190f', 0, 0.05),
    plaster: [C('#e8dfcc', 0, 0.035), C('#ddd2bb', 0, 0.035)], plasterD: C('#c4b89e', 0, 0.04),
    oak: [C('#5e3a20', 0, 0.07), C('#6a4426', 0, 0.07), C('#52321b', 0, 0.07)], walnutD: C('#2c1a0e', 0, 0.05),
    floor: [C('#7a5032', 0, 0.06), C('#6c4429', 0, 0.06), C('#84583a', 0, 0.06), C('#73492d', 0, 0.06)], floorSeam: C('#3e2616', 0, 0.04),
    hinoki: C('#d8b07c', 0, 0.035), hinokiE: C('#c49a66', 0, 0.035), sugi: [C('#b98a5a', 0, 0.06), C('#a87a4c', 0, 0.06), C('#c49664', 0, 0.06)],
    beam: C('#2a1a10', 0, 0.06), crown: C('#24160c', 0, 0.05),
    steel: C('#9aa0a6', 0, 0.05), steelD: C('#6f747a', 0, 0.05), chrome: C('#c4c9cf', 0, 0.04),
    tileFloor: [C('#3a3e44', 0, 0.04), C('#32363c', 0, 0.04)], slate: [C('#4a4c50', 0, 0.05), C('#55575c', 0, 0.05)],
    tatami: [C('#b8b47a', 0, 0.04), C('#aaa66c', 0, 0.04)], tatamiEdge: C('#2a3a2a', 0, 0.04),
    roofTile: [C('#3b3f47', 0, 0.05), C('#30343b', 0, 0.05)],
    lantern: C('#ffc684', 2.2, 0.04), lanternRed: C('#ff5a38', 2.4, 0.05), shoji: C('#ffd9a0', 1.15, 0.05), lattice: C('#3a2414', 0, 0.04),
    fluor: C('#f4f8ff', 2.2, 0.02), heat: C('#ff9a50', 1.4, 0.05),
    neonR: C('#ff3a5a', 3.2, 0.03), neonC: C('#40e8ff', 3.0, 0.03), neonM: C('#ff50e0', 3.0, 0.03), neonY: C('#ffd040', 3.0, 0.03), neonG: C('#60ff90', 2.8, 0.03), neonW: C('#fff4e0', 2.6, 0.03),
    conbiniB: C('#2a6ad8', 1.1, 0.03), conbiniG: C('#30b060', 1.1, 0.03), conbiniW: C('#f8fbff', 1.6, 0.02), conbiniFloor: C('#e8eaee', 0.35, 0.02),
    shelf: [C('#e84a3a', 0.4, 0.1), C('#f0c040', 0.4, 0.1), C('#4a8ad8', 0.4, 0.1), C('#f4f4f0', 0.45, 0.08), C('#5ab05a', 0.4, 0.1)],
    vermilion: C('#c8402a', 0, 0.05), vermilionD: C('#9a2e1e', 0, 0.05), stone: C('#8a8b8e', 0, 0.06), stoneD: C('#5c5e63', 0, 0.06), paper: C('#f6f2e8', 0, 0.03), straw: C('#d6c08a', 0, 0.06),
    rust: C('#7a4a30', 0, 0.08), green: C('#3a5a3a', 0, 0.08), blue: C('#2a3a5a', 0, 0.05),
  };
  const pick = (arr, x, y, z) => arr[Math.floor(hash01(x, y, z) * arr.length * 0.9999)];
  const snowAt = (x, z) => { const n = vnoise(x, z, 6, 3); return n > 0.7 ? P.snow[2] : n < 0.3 ? P.snow[3] : P.snow[(x * 7 + z * 3) & 1]; };
  // snow settles on the topmost surface of each column in a box
  const snowCap = (x0, x1, z0, z1, y0, y1, chance = 1, skip = null) => {
    for (let z = Z(z0); z < Z(z1); z++) for (let x = X(x0); x < X(x1); x++) {
      for (let y = Y(y1); y >= Y(y0); y--) {
        const v = G.get(x, y, z);
        if (!v) continue;
        if (skip && skip(v)) break;
        if (hash01(x, y, z + 99) < chance && !G.get(x, y + 1, z)) G.set(x, y + 1, z, snowAt(x, z));
        break;
      }
    }
  };
  // a pane of glass in a wall: carve the hole, frame it, record it for the glass shader (which also makes it solid)
  const glassX = (x, z0, z1, y0, y1, frame = P.frame) => { // in a wall at x (running along z)
    B(x - 0.125, y0, z0, x + 0.125, y1, z1, 0);
    B(x - 0.125, y0 - 0.125, z0 - 0.125, x + 0.125, y0, z1 + 0.125, frame); B(x - 0.125, y1, z0 - 0.125, x + 0.125, y1 + 0.125, z1 + 0.125, frame);
    meta.glass.push({ axis: 'x', x, z0, z1, y0, y1 });
  };
  const glassZ = (z, x0, x1, y0, y1, frame = P.frame) => { // in a wall at z (running along x)
    B(x0, y0, z - 0.125, x1, y1, z + 0.125, 0);
    B(x0 - 0.125, y0 - 0.125, z - 0.125, x1 + 0.125, y0, z + 0.125, frame); B(x0 - 0.125, y1, z - 0.125, x1 + 0.125, y1 + 0.125, z + 0.125, frame);
    meta.glass.push({ axis: 'z', z, x0, x1, y0, y1 });
  };

  // ------------------------------------------------------------ the ground: snowy asphalt, two dark tyre tracks, the
  // painted edge lines; plain concrete in the alleys
  const top = Y(0.125) - 1;
  B(-16, -0.25, -16, 36, 0.125, 18, (x, y, z) => {
    if (y < top) return P.asphalt[0];
    const px = mx(x), pz = mz(z);
    const street = pz > TK.street.z0 && pz < TK.street.z1;
    if (street) {
      // tyre tracks through the snow, wet and dark, wandering a little
      const wob = Math.sin(px * 0.21) * 0.12 + Math.sin(px * 0.07 + 1) * 0.15;
      for (const c of [-2.5, -4.4]) { const d = Math.abs(pz - (c + wob)); if (d < 0.17) return d < 0.1 ? P.wet : P.slush; }
      if (Math.abs(pz + 0.85) < 0.06 && ((x >> 2) & 1)) return P.line;         // dashed edge lines, half buried
      if (Math.abs(pz + 6.15) < 0.06 && ((x >> 2) & 1)) return P.line;
      const mh = Math.hypot(px - 6.4, pz + 3.4); if (mh < 0.38) return mh > 0.3 ? P.metalD : P.manhole; // a manhole cover, swept by tyres
      const n = vnoise(x, z, 9, 7);
      return n > 0.78 ? P.slush : snowAt(x, z);
    }
    // alleys and the back: snow over concrete, a path trodden down the middle
    const n = vnoise(x, z, 7, 11);
    return n > 0.72 ? P.concrete[(x + z) & 1] : snowAt(x, z);
  });
  // drain grates along the kerbs
  for (let x = -15.5; x < 35.5; x += 3.7) for (const z of [-0.45, -6.55]) B(x, 0, z - 0.125, x + 0.5, 0.125, z + 0.125, (vx) => ((vx & 1) ? P.drain : P.black));
  // snow banked against the building lines (not across doorways)
  const bank = (x0, x1, z0, z1) => {
    for (let z = Z(z0); z < Z(z1); z++) for (let x = X(x0); x < X(x1); x++) {
      const h = Math.floor(vnoise(x, z, 5, 4) * 2.6);
      for (let i = 1; i <= h; i++) G.set(x, top + i, z, i === h ? snowAt(x, z) : P.snowShade);
    }
  };

  // ------------------------------------------------------------ building helpers
  // a lit (or dark) window in a street facade, with a sill; vertical: on a wall running along x at z
  const facadeWindows = (x0, x1, z, outward, floors, seed, opts = {}) => {
    const { y0 = 3.5, fh = 3.0, w = 1.0, gap = 0.6, h = 1.25, litP = 0.55, balcony = false } = opts;
    for (let f = 0; f < floors; f++) {
      const wy = y0 + f * fh + 0.75;
      for (let wx = x0 + gap; wx + w <= x1 - gap + 0.01; wx += w + gap) {
        const lit = hash01(Math.floor(wx * 4), f, seed) < litP;
        const c = lit ? P.win[Math.floor(hash01(f, Math.floor(wx), seed + 1) * 4)] : P.winDim;
        const curt = lit && hash01(f, Math.floor(wx * 3), seed + 2) < 0.4 ? P.curtain[Math.floor(hash01(f, wx, seed) * 3)] : null;
        B(wx, wy, z - 0.125, wx + w, wy + h, z + 0.125, (vx, vy) => (curt && (vy & 3) !== 0 && ((vx >> 1) & 1) ? curt : c));
        B(wx - 0.0625, wy - 0.125, z - 0.125 + outward * 0.125, wx + w + 0.0625, wy, z + 0.125 + outward * 0.125, P.concreteD); // sill
        if (balcony && f > 0) {
          B(wx - 0.25, wy - 0.75, z + outward * 0.125, wx + w + 0.25, wy - 0.625, z + outward * 1.0, P.concrete[2]);
          B(wx - 0.25, wy - 0.625, z + outward * 0.875, wx + w + 0.25, wy + 0.125, z + outward * 1.0, (vx) => ((vx & 1) ? P.metal : 0));
          if (hash01(f, wx, seed + 9) < 0.5) B(wx + w - 0.3, wy - 0.625, z + outward * 0.3, wx + w + 0.15, wy - 0.2, z + outward * 0.8, P.concrete[1]); // an AC unit
        }
      }
    }
  };
  // a plain box of a building: four walls, a roof slab with a parapet and snow on top; `face` paints the walls
  const block = (x0, x1, z0, z1, h, face, seed = 1) => {
    B(x0, 0.125, z0, x1, h, z1, (x, y, z) => {
      const px = mx(x), pz = mz(z);
      const edge = px < x0 + 0.25 || px > x1 - 0.25 || pz < z0 + 0.25 || pz > z1 - 0.25;
      if (!edge && my(y) < h - 0.375) return 0;
      return face(x, y, z, px, my(y), pz);
    });
    B(x0, h, z0, x1, h + 0.5, z1, (x, y, z) => { const px = mx(x), pz = mz(z); return px < x0 + 0.25 || px > x1 - 0.25 || pz < z0 + 0.25 || pz > z1 - 0.25 ? P.concreteD : 0; });
    snowCap(x0, x1, z0, z1, h - 0.5, h + 0.75, 0.95);
    void seed;
  };
  const tiles = (arr) => (x, y) => ((x & 1) && (y & 1) ? arr[1] : arr[0]);
  const concreteFace = (x, y, z) => ((y % 24 === 0) ? P.concreteD : P.concrete[(x + z + (y >> 3)) % 3]);
  // a corrugated roller shutter over a shopfront
  const shutter = (x0, x1, z, y1) => B(x0, 0.125, z - 0.125, x1, y1, z + 0.125, (x, y) => (y % 2 ? P.shutter[0] : P.shutter[1]));

  // ============================================================ north side, west to east
  // the railway overpass: a concrete deck on piers, crossing high over the street (the trains run along z)
  {
    const O = TK.overpass;
    for (const [z0, z1] of [[-9.0, -7.25], [0.75, 2.5], [10.0, 11.75]]) B(O.x0 + 0.25, 0.125, z0, O.x1 - 0.25, O.deck, z1, (x, y, z) => ((y % 16 === 0) ? P.concreteD : P.concrete[(x + y) % 2]));
    B(O.x0, O.deck, -16, O.x1, O.deck + 0.75, 18, (x, y, z) => (y === Y(O.deck) ? P.concreteD : P.concrete[(z >> 3) % 3]));
    B(O.x0, O.deck + 0.75, -16, O.x0 + 0.125, O.deck + 1.75, 18, P.concrete[1]); B(O.x1 - 0.125, O.deck + 0.75, -16, O.x1, O.deck + 1.75, 18, P.concrete[1]);
    for (const rx of [-11.5, -10.5]) B(rx, O.deck + 0.75, -16, rx + 0.125, O.deck + 0.875, 18, P.chrome); // rails
    for (let z = -15; z < 18; z += 6) { B(O.x1 - 0.25, O.deck + 0.75, z, O.x1 - 0.125, O.deck + 4.0, z + 0.25, P.metal); B(O.x0 + 0.25, O.deck + 3.75, z, O.x1 - 0.125, O.deck + 4.0, z + 0.25, P.metal); }
    snowCap(O.x0, O.x1, -16, 18, O.deck + 0.5, O.deck + 2.0, 0.6);
    // fluorescent tubes under the deck, over the road
    for (const z of [-5.5, -3.5, -1.5]) B(O.x0 + 0.5, O.deck - 0.125, z, O.x1 - 0.5, O.deck, z + 0.125, P.fluor);
    light('overpass', [(O.x0 + O.x1) / 2, O.deck - 0.6, -3.5], 0xdfeaff, 4, 9);
    // a lamp-lit wall of posters on the north pier
    B(O.x0 + 0.25, 0.75, 0.625, O.x1 - 0.25, 2.25, 0.75, (x, y) => [P.neonW, P.tileR[0], P.tileB[0], P.blue][((x >> 2) + (y >> 3)) % 4]);
  }
  // a bar building west of the overpass, a vertical neon sign
  block(-16, -12.75, 0, 13, 10, (x, y, z, px, py, pz) => (pz < 0.25 && py < 3.0 ? P.shutter[(y & 1)] : tiles(P.tileG)(x, y)));
  facadeWindows(-16, -12.75, 0, -1, 2, 11);
  // the yakitori stall between the overpass and the izakaya: shutters down, two lanterns still lit
  block(-9.5, -6.5, 0, 13, 6.5, (x, y, z, px, py, pz) => (pz < 0.25 && py < 2.75 ? P.shutter[y & 1] : P.yaki[(x + y) & 1]));
  // the izakaya next door: dark cedar, a noren'd sliding door, shoji glowing warm
  block(-6.5, -2.0, 0, 13, 7.0, (x, y, z, px, py, pz) => (py < 0.5 ? P.stoneD : pz < 0.25 && py > 2.75 && py < 3.0 ? P.timberD : P.yaki[((x >> 1) + y) & 1]));
  {
    B(-5.75, 0.25, 0, -4.25, 2.5, 0.25, 0);                                      // its doorway, closed with a shoji door
    B(-5.75, 0.25, 0.0625, -4.25, 2.5, 0.1875, (x, y) => ((x % 6 === 0) || (y % 6 === 0) ? P.lattice : P.shoji));
    B(-3.75, 1.0, 0, -2.5, 2.25, 0.25, 0); B(-3.75, 1.0, 0.0625, -2.5, 2.25, 0.1875, (x, y) => ((x % 4 === 0) || (y % 4 === 0) ? P.lattice : P.shoji));
    light('izakaya', [-4.2, 2.2, -0.9], 0xff9850, 3.5, 6);
    facadeWindows(-6.5, -2.0, 0, -1, 1, 13, { litP: 0.8 });
  }
  // the west alley (x -2..0) and the back alley (z 13..15) are open; the backs of the next street close them in
  block(-16, 36, 15.25, 18, 9, (x, y, z, px, py, pz) => (pz < 15.5 ? (py < 0.5 ? P.concreteD : concreteFace(x, y, z)) : P.concrete[0]));
  // pipes, meters and AC units on the alley walls
  for (const [x, z] of [[-2.0, 4.0], [-2.0, 9.5], [12.0, 5.5], [12.0, 11.0]]) B(x - 0.125, 0.125, z, x + 0.125, 6.5, z + 0.125, P.metal);
  for (const [x0, z0] of [[3.0, 15.0], [7.5, 15.0], [-5.0, 15.0], [14.0, 15.0], [26.0, 15.0]]) { B(x0, 0.125, z0 - 0.75, x0 + 0.875, 0.75, z0, P.concrete[2]); B(x0 + 0.125, 0.25, z0 - 0.8, x0 + 0.75, 0.625, z0 - 0.75, P.metalD); }

  // ============================================================ Yoake: x 0..10, z 0..13
  const S = TK.shop, F = 0.25, F2 = TK.F2;
  {
    // ---- shell: charred cedar outside on the alley sides, plaster and timber on the front; tiled hip at the eave
    B(S.x0, 0.125, S.z0, S.x1, TK.roof, S.z1, (x, y, z) => {
      const px = mx(x), pz = mz(z), py = my(y);
      const outer = px < S.x0 + 0.125 || px > S.x1 - 0.125 || pz < S.z0 + 0.125 || pz > S.z1 - 0.125;
      const wall = px < S.x0 + 0.25 || px > S.x1 - 0.25 || pz < S.z0 + 0.25 || pz > S.z1 - 0.25;
      if (!wall) return 0;
      if (!outer) return py < 1.125 ? P.oak[(x >> 1) % 3] : py < 1.25 ? P.walnutD : P.plaster[(y >> 3) & 1]; // inside face
      if (py < 0.5) return ((x + z + y) & 1) ? P.stone : P.stoneD;
      if (pz < S.z0 + 0.125) return py > 3.25 && py < 3.75 ? P.timberD : (x % 16 === 0 ? P.timber : P.plaster[(y >> 3) & 1]);
      return P.yaki[((x + z) >> 1) & 1];
    });
    // floor: long planks; the kitchen behind the counter is tiled; the back hall boards
    B(S.x0 + 0.25, -0.25, S.z0 + 0.25, S.x1 - 0.25, F, S.z1 - 0.25, (x, y, z) => {
      if (y < Y(F) - 1) return P.floorSeam;
      const pz = mz(z), px = mx(x);
      if (pz > 4.9 && pz < 9.0 && px > 1.0) return ((x >> 2) + (z >> 2)) & 1 ? P.tileFloor[0] : P.tileFloor[1];
      const row = x >> 1, seg = Math.floor((z + row * 7) / 22);
      if ((z + row * 7) % 22 === 0) return P.floorSeam;
      return P.floor[Math.floor(hash01(seg, row, 5) * 3.999)];
    });
    // ceiling (the flat's floor above), with beams
    B(S.x0 + 0.25, TK.ceil1, S.z0 + 0.25, S.x1 - 0.25, F2, S.z1 - 0.25, (x, y, z) => ((x & 3) === 0 ? P.sugi[1] : P.sugi[(z >> 4) % 3 === 2 ? 2 : 0]));
    for (const bz of [3.0, 6.25, 9.25]) B(S.x0 + 0.25, 3.25, bz - 0.125, S.x1 - 0.25, TK.ceil1, bz + 0.125, P.beam);
    // flat roof: slab, parapet, snow
    B(S.x0, TK.roof - 0.25, S.z0, S.x1, TK.roof, S.z1, P.concreteD);
    B(S.x0, TK.roof, S.z0, S.x1, TK.roof + 0.5, S.z1, (x, y, z) => { const px = mx(x), pz = mz(z); return px < S.x0 + 0.25 || px > S.x1 - 0.25 || pz < S.z0 + 0.25 || pz > S.z1 - 0.25 ? P.concrete[2] : 0; });
    // a water tank and an AC unit on the roof
    B(6.5, TK.roof, 8.5, 8.5, TK.roof + 1.75, 10.5, (x, y) => (y % 4 === 0 ? P.metalD : P.metal));
    B(1.5, TK.roof, 10.5, 2.5, TK.roof + 0.75, 11.25, P.concrete[2]);
    snowCap(S.x0, S.x1, S.z0, S.z1, TK.roof - 0.25, TK.roof + 2.25, 0.97);

    // ---- the front: booth window, the door, the food-sample window; a tiled eave over them all
    glassZ(0.125, 0.5, 4.75, 1.0, 2.5);
    for (const lx of [1.5, 2.5, 3.5]) B(lx, 1.0, 0.0625, lx + 0.0625, 2.5, 0.1875, P.lattice); // a little lattice over the glass
    B(5.75, F, 0, 7.0, 2.625, 0.25, 0);                           // the doorway (the glass door slides into the wall)
    B(5.625, 2.625, 0, 7.125, 2.75, 0.25, P.timberD); B(5.625, 0.125, 0, 5.75, 2.75, 0.25, P.timberD); B(7.0, 0.125, 0, 7.125, 2.75, 0.25, P.timberD);
    B(5.75, 0.125, -0.25, 7.0, F, 0, P.stone);                   // the step at the door
    glassZ(0.125, 7.5, 9.5, 0.875, 1.875);                        // the sampuru window
    B(7.5, 0.75, 0.25, 9.5, 0.875, 0.75, P.hinoki);               // ...its shelf inside
    // the eave: dark tiles on brackets, a thick lip of snow
    for (let x = X(-0.25); x < X(10.25); x++) for (let z = Z(-0.875); z < Z(0); z++) {
      const d = Z(0) - 1 - z, y = Y(3.0) - Math.floor(d / 3);
      G.set(x, y, z, (x & 1) ? P.roofTile[0] : P.roofTile[1]); G.set(x, y - 1, z, P.timberD);
    }
    snowCap(-0.25, 10.25, -0.875, 0, 2.5, 3.4, 0.98);
    // the signboard on the eave: YOAKE in warm letters on dark wood
    {
      const str = 'YOAKE', w = textWidth(str), x0 = X(5.0) - (w >> 1);
      B(3.25, 3.375, -0.0625, 6.75, 4.375, 0.0, P.walnutD);
      glyphPixels(str, (gx, gy) => G.set(x0 + w - 1 - gx, Y(4.25) - gy, Z(-0.0625) - 1, C('#ffe2b0', 1.6, 0.04))); // (read from the street: x runs right to left)
      light('kanban', [5.0, 3.9, -0.8], 0xffc080, 3.5, 5);
    }
    // ---- the flat's front window, the shop's light falling from it
    glassZ(0.125, 0.75, 9.25, F2 + 0.75, F2 + 2.0);
    B(0.75, F2 + 0.625, -0.25, 9.25, F2 + 0.75, 0.0, P.timberD);  // a sill outside
    snowCap(0.75, 9.25, -0.25, 0.0, F2 + 0.5, F2 + 1.0, 1);

    // ---- the counter: a long hinoki top over dark cabinets, the belt running along it; stools on a low step
    B(1.25, F, 3.9, 9.75, 1.0, 4.9, (x, y, z) => { const pz = mz(z); return pz < 4.0 ? (my(y) < 0.375 ? P.walnutD : ((x % 6 === 0) ? P.timberD : P.oak[(x >> 2) % 3])) : P.timberD; });
    B(1.25, 1.0, 3.875, 9.75, 1.125, 4.9, (x, y, z) => (mz(z) < 4.0 ? P.hinokiE : P.hinoki));
    B(1.25, F, 3.0, 8.875, 0.375, 3.875, (x, y, z) => (mz(z) < 3.125 ? P.walnutD : P.oak[2]));
    // the register counter by the door: you stand behind it (north), guests pay from the door side
    B(8.0, F, 1.625, 9.75, 0.875, 2.125, (x, y, z) => (z === Z(1.625) && (x & 3) === 0 ? P.walnutD : P.oak[1]));
    B(7.875, 0.875, 1.5, 9.75, 1.0, 2.25, (x, y, z) => (x === X(7.875) || z === Z(1.5) ? P.hinokiE : P.hinoki));
    // the side counter along the east wall of the kitchen: steel, level with the belt (plates, the sushi case,
    // rice cookers, the tea urns); a shelf of cups on the wall above it
    B(8.875, F, 4.9, 9.75, 1.125, 8.375, (x, y) => (y === Y(1.125) - 1 ? P.steel : P.steelD));
    B(9.5, 1.875, 4.75, 9.75, 2.0, 8.5, P.walnutD);
    // the kitchen: tiled walls, the cook line under a big hood along the back wall, the dish sink on the west wall
    B(S.x0 + 0.25, F, 4.9, S.x0 + 0.375, 2.5, 9.0, (x, y) => (((x + y) & 3) === 0 ? P.tileW[1] : P.tileW[0]));
    B(1.0, 2.25, 8.0, 7.75, 3.0, 9.0, (x, y, z) => (y === Y(2.25) && z === Z(8.125) && (x % 10 < 3) ? C('#fff4d8', 3.0, 0.03) : P.steel));
    B(0.25, F, 5.5, 1.0, 0.875, 8.5, (x, y, z) => (y === Y(F) ? P.black : P.steel));   // the sink counter
    B(0.25, 0.875, 5.5, 0.375, 1.375, 8.5, P.steel);
    for (const [a, b] of [[5.625, 6.5], [6.625, 7.5], [7.625, 8.375]]) { B(0.375, 0.75, a, 0.875, 0.875, b, 0); B(0.375, 0.625, a, 0.875, 0.75, b, C('#7a9aa8', 0, 0.06)); }
    for (const fx of [2.5, 5.5]) B(fx, 3.375, 6.5, fx + 1.5, 3.5, 6.625, P.fluor);
    light('kitchenA', [2.75, 2.7, 6.6], 0xfff2dc, 3.5, 7); light('kitchenB', [6.75, 2.7, 6.6], 0xfff2dc, 3.5, 7);
    light('counterL', [3.0, 2.6, 3.6], 0xffbe7a, 4.5, 6.5); light('counterR', [7.0, 2.6, 3.6], 0xffbe7a, 4.5, 6.5);
    light('booths', [2.5, 2.4, 1.2], 0xffc890, 4, 6); light('genkan', [8.6, 2.5, 1.4], 0xffc080, 3, 5);
    // the back wall of the kitchen, its doorway (with a noren) to the hall
    B(S.x0 + 0.25, F, 9.0, S.x1 - 0.25, TK.ceil1, 9.25, (x, y) => (my(y) < 1.125 ? P.tileW[(x + y) & 1] : P.plaster[(y >> 3) & 1]));
    B(7.875, F, 9.0, 9.125, 2.125, 9.25, 0); B(7.75, 2.125, 8.95, 9.25, 2.25, 9.3, P.timberD);
    // ---- the back: storeroom (west), washroom, freezer, the stair up (north-east), the hall
    // storeroom walls (its door is in the west wall, outside)
    B(2.5, F, 9.25, 2.75, TK.ceil1, S.z1 - 0.25, (x, y) => P.plaster[(y >> 3) & 1]);
    B(S.x0, 0.125, 10.5, S.x0 + 0.25, 2.625, 12.0, 0);                  // its doorway
    B(S.x0 - 0.125, 2.625, 10.375, S.x0 + 0.25, 2.75, 12.125, P.timberD);
    light('kura', [1.4, 2.8, 11.0], 0xffb070, 3, 5.5);
    // washroom (x 2.75..4.25, z 10.5..12.75): slate floor, hinoki walls; door on the hall side
    B(2.75, F, 10.375, 4.25, TK.ceil1, 10.5, (x, y) => P.plaster[(y >> 3) & 1]); B(3.0, F, 10.375, 4.0, 2.125, 10.5, 0);
    B(4.25, F, 10.375, 4.375, TK.ceil1, S.z1 - 0.25, (x, y) => P.plaster[(y >> 3) & 1]);
    for (let z = Z(10.5); z < Z(S.z1 - 0.25); z++) for (let x = X(2.75); x < X(4.25); x++) G.set(x, Y(F) - 1, z, P.slate[((x >> 2) + (z >> 2)) & 1]);
    light('restrooms', [3.5, 2.6, 11.6], 0xffd8a8, 2.4, 4);
    // walk-in freezer (x 4.375..6.25): steel, its doorway on the hall side
    B(4.375, F, 10.375, 6.25, TK.ceil1, 10.5, P.steelD); B(4.5, F, 10.375, 5.75, 2.25, 10.5, 0);
    B(6.25, F, 10.375, 6.375, TK.ceil1, S.z1 - 0.25, P.steelD);
    B(4.375, F, 10.5, 6.25, TK.ceil1, S.z1 - 0.25, (x, y, z) => { const px = mx(x), pz = mz(z); return (px < 4.5 || px > 6.125 || pz > S.z1 - 0.375 || my(y) > TK.ceil1 - 0.125) ? C('#dfe8ee', 0, 0.03) : 0; });
    for (let z = Z(10.5); z < Z(S.z1 - 0.375); z++) for (let x = X(4.5); x < X(6.125); x++) G.set(x, Y(F) - 1, z, C('#c8d0d8', 0, 0.04));
    light('freezer', [5.3, 2.8, 11.6], 0xcfe8ff, 2.4, 4);
    // the stair: a landing at the foot in the north-east corner (step on from the hall), then steep treads rising
    // west along the north wall to the flat (x 8.875 -> 6.375, z 11.75..12.75); you come out on the flat's floor
    // heading west, by the shoe rack
    {
      const sx1 = TK.stair.x1, sx0 = TK.stair.x0, rise = F2 - F;
      for (let x = X(sx0); x < X(sx1); x++) {
        const k = Math.min(1, (sx1 - mx(x + 1)) / (sx1 - sx0 - 0.125)), ty = Y(F) + Math.round(k * (Y(F2) - Y(F)));
        for (let z = Z(11.75); z < Z(S.z1 - 0.25); z++) { G.set(x, ty - 1, z, (z - Z(11.75)) % 8 === 0 ? P.timberD : P.oak[1]); if (ty - 2 >= Y(F)) G.set(x, ty - 2, z, P.timberD); }
        // the stringer wall under it, closing the space beneath the stair, and the banister on the hall side
        for (let y = Y(F); y < ty - 2; y++) G.set(x, y, Z(11.75), (y & 3) === 0 ? P.timberD : P.oak[2]);
        if (ty < Y(F2) - 2) {
          if ((X(sx1) - x) % 6 === 0) for (let y = ty; y < ty + 7; y++) G.set(x, y, Z(11.75) - 1, P.timber);
          G.set(x, ty + 7, Z(11.75) - 1, P.timber);
        }
      }
      void rise;
      // the opening above it in the flat's floor (the landing has the flat's floor over it, with room to stand)
      B(sx0, TK.ceil1, 11.75, sx1, F2, S.z1 - 0.25, 0);
      light('stair', [8.0, 3.2, 12.2], 0xffc890, 2, 4);
    }
    // the hall light
    light('hall', [7.0, 2.6, 10.0], 0xffd8a8, 2.6, 5);
    // the back door to the east alley (the door itself is a panel in main.js)
    B(S.x1 - 0.25, F, 9.3, S.x1, 2.375, 10.55, 0);
    B(S.x1 - 0.25, 2.375, 9.25, S.x1 + 0.125, 2.5, 10.625, P.timberD);
    B(S.x1, 0.125, 9.25, S.x1 + 0.375, F, 10.625, P.stone);
    light('backdoor', [S.x1 + 0.6, 2.6, 9.9], 0xffd8a0, 1.6, 4);

    // ================= the flat upstairs: tatami in front by the big window, a kitchenette and the futon room behind
    {
      const tat = (x, z) => {
        const u = x - X(0.25), v = z - Z(0.25), lu = (u % 14), lv = (v % 7);
        if (lu < 1 || lv < 1) return P.tatamiEdge;
        return P.tatami[(x + z) & 1];
      };
      for (let z = Z(0.25); z < Z(S.z1 - 0.25); z++) for (let x = X(0.25); x < X(S.x1 - 0.25); x++) {
        const px = mx(x), pz = mz(z);
        if (px > TK.stair.x0 && px < TK.stair.x1 && pz > 11.75) continue; // the stairwell
        G.set(x, Y(F2) - 1, z, pz < 6.0 || (px > 5.0 && pz < 11.0) ? tat(x, z) : P.floor[(x >> 1) % 4]);
      }
      // ceiling
      B(S.x0 + 0.25, TK.roof - 0.375, S.z0 + 0.25, S.x1 - 0.25, TK.roof - 0.25, S.z1 - 0.25, (x, y, z) => ((z & 3) === 0 ? P.sugi[1] : P.sugi[0]));
      // fusuma between the front room and the back, with two openings
      for (let x = X(0.25); x < X(9.75); x++) {
        const px = mx(x); if ((px > 3.25 && px < 4.5) || (px > 6.5 && px < 7.75)) continue;
        for (let y = Y(F2); y < Y(F2 + 2.0); y++) G.set(x, y, Z(6.0), (y - Y(F2)) % 8 === 0 || (x & 15) === 0 ? P.timberD : C('#e8dcc0', 0, 0.03));
        for (let y = Y(F2 + 2.0); y < Y(TK.roof - 0.375); y++) G.set(x, y, Z(6.0), (x & 1) ? P.timberD : P.plaster[0]);
      }
      // a railing round the stairwell
      // (open on the west, where the stair comes up)
      for (let x = X(TK.stair.x0 + 0.25); x < X(TK.stair.x1) + 1; x++) { G.set(x, Y(F2 + 0.875), Z(11.75) - 1, P.timber); if (x % 6 === 0) for (let y = Y(F2); y < Y(F2 + 0.875); y++) G.set(x, y, Z(11.75) - 1, P.timber); }
      for (let z = Z(11.75) - 1; z < Z(S.z1 - 0.25); z++) { G.set(X(TK.stair.x1), Y(F2 + 0.875), z, P.timber); if (z % 6 === 0) for (let y = Y(F2); y < Y(F2 + 0.875); y++) G.set(X(TK.stair.x1), y, z, P.timber); }
      light('aptLiving', [5.0, 5.6, 3.0], 0xffa860, 5.5, 8);
      light('aptBed', [8.0, 4.6, 8.4], 0xff9a50, 3, 5);
      light('aptKitchen', [2.5, 5.6, 8.0], 0xffd8a8, 4, 6);
    }
  }
  bank(-2.0, 0, 0, 13); bank(10, 12, 0, 13); bank(-16, 36, 13, 15.25);

  // ---- a vertical lightbox sign on the shop's east corner: 夜明け, glowing (drawn as a canvas sign in decorate)
  meta.signs.push({ text: '夜明け', sub: 'すし · やきとり', pos: [10.1, 4.9, -0.45], w: 0.7, h: 2.6, color: '#fff2dc', bg: '#7a1410', vertical: true, faces: [Math.PI / 2, -Math.PI / 2] });

  // the coin laundry east of the east alley: bright fluorescent glass front, apartments above
  block(12, 18, 0, 13, 10, (x, y, z, px, py, pz) => (py < 3.25 && pz < 0.25 ? P.metal : tiles(P.tileW)(x, y)));
  glassZ(0.125, 12.5, 17.5, 0.375, 2.875);
  B(12.25, 0.125, 0.25, 17.75, 0.25, 6.0, P.conbiniFloor);
  for (let i = 0; i < 4; i++) { const wx = 12.75 + i * 1.2; B(wx, 0.25, 4.5, wx + 0.9, 1.875, 5.4, P.chrome); B(wx + 0.2, 0.75, 4.45, wx + 0.7, 1.25, 4.5, C('#2a3a4a', 0.4, 0.04)); } // washers
  B(12.5, 3.0, 0.25, 17.5, 3.125, 5.5, P.fluor);
  light('laundry', [15.0, 2.5, 2.0], 0xe8f4ff, 4.5, 8);
  facadeWindows(12, 18, 0, -1, 2, 21, { balcony: true });
  meta.signs.push({ text: 'コインランドリー', pos: [15.0, 3.35, -0.05], w: 4.6, h: 0.5, color: '#e8f8ff', bg: '#1a5aa8', faces: [Math.PI] });
  // the little Inari shrine between buildings: a stone path, a vermilion torii, the hokora, two foxes
  {
    block(18.0, 24.0, 3.0, 13, 7, (x, y) => P.concrete[(x + y) % 3]);
    const hx = 19.25;
    for (const x of [18.375, 20.0]) { B(x, 0.125, 0.75, x + 0.125, 2.625, 0.875, P.vermilion); }
    B(18.125, 2.25, 0.6875, 20.375, 2.375, 0.9375, P.vermilion); B(18.0, 2.625, 0.625, 20.5, 2.75, 1.0, P.black);
    B(hx - 0.5, 0.125, 2.0, hx + 0.5, 0.5, 3.0, P.stone);
    B(hx - 0.375, 0.5, 2.125, hx + 0.375, 1.25, 2.875, (x, y, z) => (z === Z(2.125) && my(y) < 1.0 && Math.abs(mx(x) - hx) < 0.2 ? P.lantern : P.oak[(y >> 1) & 1]));
    for (let i = 0; i < 3; i++) B(hx - 0.625 + i * 0.125, 1.25 + i * 0.125, 1.875 + i * 0.125, hx + 0.625 - i * 0.125, 1.375 + i * 0.125, 3.125 - i * 0.125, P.roofTile[i & 1]);
    B(hx - 0.25, 0.125, 1.5, hx + 0.25, 0.375, 1.875, (x, y) => (y === Y(0.375) - 1 ? P.walnutD : P.oak[0])); // offering box
    for (const fx of [18.6, 19.9]) { B(fx, 0.125, 1.25, fx + 0.25, 0.375, 1.5, P.stone); B(fx + 0.0625, 0.375, 1.3125, fx + 0.1875, 0.75, 1.4375, C('#ece8e0', 0, 0.04)); }
    snowCap(18.0, 20.75, 0.5, 3.25, 0.2, 2.5, 0.9);
    light('shrine', [hx, 0.9, 1.6], 0xffa050, 1.4, 3.5);
    B(18.0, 0.125, 0, 20.75, 0.2, 2.0, P.stone);
  }
  // the vending machine corner, under a little steel canopy
  block(20.75, 24.0, 0, 3.0, 4.0, (x, y) => P.concrete[(x + y) % 3]);
  B(20.75, 2.625, -0.875, 24.0, 2.75, 0.0, P.metal); snowCap(20.75, 24.0, -0.875, 0, 2.5, 3.2, 1);
  light('vending', [22.4, 1.2, -1.4], 0xcfe4ff, 4.5, 6);
  // a tall building on the east end: karaoke on every floor
  block(24.0, 36, 0, 13, 15.75, (x, y, z, px, py, pz) => (py < 3.0 && pz < 0.25 ? P.glassDark : tiles(P.tileB)(x, y)));
  facadeWindows(24.0, 36, 0, -1, 4, 31, { litP: 0.7 });
  meta.signs.push({ text: 'カラオケ', sub: 'KARAOKE', pos: [24.4, 8.0, -0.45], w: 0.9, h: 4.2, color: '#ff8ae8', bg: '#2a0830', vertical: true, faces: [Math.PI / 2, -Math.PI / 2] });
  light('karaoke', [24.4, 6.0, -1.4], 0xff60d0, 4, 7);

  // ============================================================ south side, west to east (fronts at z = -7)
  const SZ0 = TK.street.z0;
  block(-16, -12.75, -16, SZ0, 9, (x, y, z, px, py, pz) => (pz > SZ0 - 0.25 && py < 3.0 ? P.shutter[y & 1] : concreteFace(x, y, z)));
  facadeWindows(-16, -12.75, SZ0, 1, 2, 41);
  // a three-storey bar building: tiled, neon down its face
  block(-9.5, -3.0, -16, SZ0, 10, (x, y, z, px, py, pz) => (pz > SZ0 - 0.25 && py < 3.0 ? (py < 2.6 && px > -8 && px < -4.5 ? 0 : P.timberD) : tiles(P.tileR)(x, y)));
  B(-8.0, 0.125, SZ0 - 0.25, -4.5, 2.625, SZ0 - 0.125, (x, y) => ((x % 5 === 0) || (y % 5 === 0) ? P.lattice : P.shoji));
  facadeWindows(-9.5, -3.0, SZ0, 1, 2, 43, { litP: 0.7 });
  meta.signs.push({ text: 'スナック 月', pos: [-9.1, 6.0, SZ0 + 0.45], w: 0.8, h: 3.4, color: '#ffe060', bg: '#401010', vertical: true, faces: [Math.PI / 2, -Math.PI / 2] });
  meta.signs.push({ text: 'BAR', pos: [-6.2, 3.3, SZ0 + 0.06], w: 1.6, h: 0.6, color: '#60f0ff', bg: null, faces: [0] });
  light('bar', [-6.2, 2.6, SZ0 + 1.2], 0xff7a50, 3, 6); light('barNeon', [-9.1, 5.5, SZ0 + 1.0], 0xffd060, 3, 6);
  // the convenience store: a long glass front pouring white light across the snow, its stripes over the door
  {
    const x0 = -3.0, x1 = 9.0;
    block(x0, x1, -16, SZ0, 7.5, (x, y, z, px, py, pz) => (pz > SZ0 - 0.25 && py > 2.875 && py < 3.875 ? (py < 3.125 ? P.conbiniB : py < 3.375 ? P.conbiniW : P.conbiniG) : tiles(P.tileW)(x, y)));
    glassZ(SZ0 - 0.125, x0 + 0.5, x1 - 0.5, 0.375, 2.75, P.metal);
    B(x0 + 0.25, 0.125, -15.75, x1 - 0.25, 0.25, SZ0 - 0.25, P.conbiniFloor);
    B(x0 + 0.25, 3.0, -15.75, x1 - 0.25, 3.125, SZ0 - 0.25, P.conbiniW);
    // shelves of everything, a fridge wall at the back, the counter by the door
    for (let r = 0; r < 4; r++) {
      const sz = -9.5 - r * 1.6;
      B(x0 + 1.5, 0.25, sz - 0.4, x1 - 3.5, 1.5, sz, (x, y, z) => (y % 4 === 3 ? P.chrome : pick(P.shelf, x, y >> 1, z)));
    }
    B(x0 + 0.5, 0.25, -15.75, x1 - 0.5, 2.25, -15.25, (x, y) => (y % 5 === 0 ? P.chrome : pick(P.shelf, x, y, 7)));
    B(x1 - 2.75, 0.25, -9.75, x1 - 0.5, 1.0, -8.5, P.tileW[0]);
    for (const lx of [0.0, 3.0, 6.0]) light('conbini' + lx, [lx, 2.6, -9.5], 0xeaf4ff, 6, 11);
    meta.signs.push({ text: '24 HOURS · DAILY', pos: [3.0, 3.375, SZ0 + 0.06], w: 4.5, h: 0.5, color: '#ffffff', bg: null, faces: [0] });
    facadeWindows(x0, x1, SZ0, 1, 1, 45, { y0: 4.25, litP: 0.4 });
  }
  // an apartment block: balconies, lights on here and there, a lit lobby
  block(9.0, 16.0, -16, SZ0, 15.75, (x, y, z, px, py, pz) => (pz > SZ0 - 0.25 && py < 2.75 && px > 11.5 && px < 13.5 ? 0 : tiles(P.tileB)(x, y)));
  B(11.5, 0.125, -9.0, 13.5, 0.25, SZ0, P.stone); B(11.5, 2.625, -9.0, 13.5, 2.75, SZ0, P.fluor);
  light('lobby', [12.5, 2.2, -8.0], 0xe8f0ff, 3, 6);
  facadeWindows(9.0, 16.0, SZ0, 1, 4, 47, { balcony: true, litP: 0.5 });
  // coin parking: an open lot, a low fence, a pay machine glowing, two snowed-in cars
  {
    for (let x = X(16.0); x < X(24.0); x++) if ((x & 7) === 0) for (let y = Y(0.125); y < Y(0.875); y++) G.set(x, y, Z(SZ0 + 0.125), P.metal);
    B(16.0, 0.75, SZ0 + 0.0625, 24.0, 0.875, SZ0 + 0.1875, P.metal);
    B(16.25, 0.125, SZ0 - 1.0, 16.75, 1.375, SZ0 - 0.5, (x, y) => (y > Y(0.75) ? C('#ffd040', 1.2, 0.03) : P.metalD));
    light('parking', [16.5, 1.6, SZ0 + 0.5], 0xffe080, 1.6, 4);
    for (const [cx, cz, c] of [[18.5, -11.0, C('#c8ccd2', 0, 0.04)], [21.5, -11.4, C('#3a3a42', 0, 0.04)]]) {
      B(cx - 0.85, 0.375, cz - 2.1, cx + 0.85, 1.0, cz + 2.1, c); B(cx - 0.75, 1.0, cz - 1.0, cx + 0.75, 1.5, cz + 1.2, (x, y, z) => (my(y) > 1.125 && my(y) < 1.4 ? P.glassDark : c));
      for (const [wx, wz] of [[-0.85, -1.4], [0.6, -1.4], [-0.85, 1.4], [0.6, 1.4]]) B(cx + wx, 0.125, cz + wz - 0.3, cx + wx + 0.25, 0.5, cz + wz + 0.3, P.black);
      snowCap(cx - 0.9, cx + 0.9, cz - 2.2, cz + 2.2, 0.5, 1.75, 1);
    }
    block(16.0, 24.0, -16, -14.0, 12, (x, y) => concreteFace(x, y, 0));
    facadeWindows(16.0, 24.0, -14.0, 1, 3, 49);
  }
  // an office building at the east end, a few late lights
  block(24.0, 36, -16, SZ0, 15.75, (x, y, z, px, py, pz) => (pz > SZ0 - 0.25 && py < 3.0 ? P.glassDark : concreteFace(x, y, z)));
  facadeWindows(24.0, 36, SZ0, 1, 4, 51, { litP: 0.3 });

  // ============================================================ utility poles, wires and street lamps
  const poles = [[-4.5, -0.45], [12.3, -0.45], [26.5, -0.45], [-7.0, -6.55], [3.0, -6.55], [16.5, -6.55], [30.0, -6.55]];
  for (const [px, pz] of poles) {
    for (let y = Y(0.125); y < Y(8.5); y++) for (let z = Z(pz - 0.125); z < Z(pz + 0.125); z++) for (let x = X(px - 0.125); x < X(px + 0.125); x++) G.set(x, y, z, (y % 16 === 0) ? P.concreteD : P.concrete[2]);
    B(px - 0.75, 7.75, pz - 0.0625, px + 0.75, 7.875, pz + 0.0625, P.metalD);       // the crossarm
    B(px - 0.25, 6.25, pz - 0.375, px + 0.25, 7.0, pz + 0.125, P.metal);             // a transformer
    // a street lamp on an arm over the road
    const toward = pz > -3.5 ? -1 : 1;
    B(px - 0.0625, 5.5, Math.min(pz, pz + toward * 1.25), px + 0.0625, 5.625, Math.max(pz, pz + toward * 1.25), P.metalD);
    B(px - 0.1875, 5.375, pz + toward * 1.25 - 0.125, px + 0.1875, 5.5, pz + toward * 1.25 + 0.125, C('#f0f4ff', 2.6, 0.02));
    light('lamp' + px, [px, 5.2, pz + toward * 1.25], 0xdfe6ff, 5, 10);
    snowCap(px - 0.8, px + 0.8, pz - 0.5, pz + 0.5, 5.0, 9.0, 0.7);
  }
  meta.poles = poles.map(([x, z]) => [x, 7.8, z]);

  // ---- the door lantern and the neon on our side of the street
  light('door', [6.4, 2.1, -0.9], 0xff9050, 4.5, 6);
  light('toroA', [-3.3, 2.1, -0.8], 0xff7040, 2.5, 5); light('toroB', [-7.8, 2.0, -0.8], 0xff7040, 2.2, 5);
  light('backAlley', [5.0, 3.0, 14.0], 0xffd8a0, 2.2, 6);
  void SX; void SZ;
  return meta;
}
