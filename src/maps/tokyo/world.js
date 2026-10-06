// Tokyo, late at night, snowing: a narrow street of small buildings shoulder to shoulder, under a brick railway
// viaduct. Yoake is the same shop as on the mountain (built by world.js's buildShop, in its city dress): the front
// room's glass looks onto the street, the stairs up to the flat turn off the restroom hall, and the back door opens
// from the kitchen onto a little yard with the walk-in and an old shed.
//
// Layout (metres): our building is x 0..16, z -3.375..16 (the same footprint as on the mountain). The street runs along
// x between the building lines z = -3.375 (north, our side) and z = -13.25 (south): a pavement strip each side and the
// road between. Neighbours butt up against our side walls; the yard behind is x 16..24, z 10..18.
import { C, hash01 } from '../../voxel.js';
import { shopKit, buildShop, finishShop, markGlass } from '../../world.js';

export const TK = {
  north: -3.375, south: -13.25,                 // the building lines
  walkN: [-5.5, -3.375], walkS: [-13.25, -11.25], road: [-11.25, -5.5],
  street: { z0: -13.25, z1: -3.375 },
  F2: 3.75,
  viaduct: { x0: -16, x1: -12.5, deck: 6.0, top: 6.75 },
  yard: { x0: 16, x1: 24, z0: 13.25, z1: 17.75 },
  shed: { x0: 21.0, x1: 23.75, z0: 13.5, z1: 17.75, floor: 0.375 },
  shrine: { x: -5.5, z: 2.3 },
  ends: { x0: -15.25, x1: 35.5 },              // the road-works barriers that close the street off at each end
  // strings of paper lanterns across the street: [x, height at the north, height at the south, sag]
  garlands: [[-9.0, 4.6, 4.4, 0.7], [7.0, 4.9, 4.7, 0.8], [26.75, 4.5, 4.6, 0.7]],
};

function vnoise(x, z, cell, seed) {
  const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz);
  let tx = fx - ix, tz = fz - iz; tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
  const h = (a, b) => hash01(a, seed, b);
  const a = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * tx, b = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * tx;
  return a + (b - a) * tz;
}

export function buildTokyo(W) {
  const meta = { lights: [], glass: [], etched: [], steam: [], signs: [], poles: [] };
  const K = shopKit(W, meta);
  const { G, X, Y, Z, B, mx, myOf: my, mz, snowAt, snowCap } = K;
  const light = (name, pos, color, intensity, distance) => meta.lights.push({ name, pos, color, intensity, distance });
  const sign = (s) => meta.signs.push(s);
  const N = TK.north, S = TK.south;

  // ------------------------------------------------------------ the street's palette
  const P = {
    ...K.P,
    asphalt: [C('#2a2c30', 0, 0.06), C('#24262a', 0, 0.06), C('#303236', 0, 0.05)], wet: C('#1a1c20', 0, 0.04), slush: C('#8a909a', 0, 0.06),
    line: C('#e8e6dc', 0, 0.03), curb: C('#9a9c9e', 0, 0.04), drain: C('#3a3a3c', 0, 0.04), manhole: C('#4a4844', 0, 0.06),
    paveA: [C('#8c8478', 0, 0.05), C('#7e776c', 0, 0.05)], paveB: [C('#6a6e74', 0, 0.05), C('#5e6268', 0, 0.05)],
    concrete: [C('#9a9a98', 0, 0.06), C('#8e8e8c', 0, 0.06), C('#a6a6a2', 0, 0.05)], concreteD: C('#6e6e6c', 0, 0.05),
    tileW: [C('#e2ddd2', 0, 0.03), C('#d6d0c4', 0, 0.03)], tileB: [C('#b8a890', 0, 0.04), C('#a89880', 0, 0.04)], tileG: [C('#6a7468', 0, 0.04), C('#5e685c', 0, 0.04)],
    tileR: [C('#8a5a4a', 0, 0.04), C('#7c4e40', 0, 0.04)], tileK: [C('#3a3c42', 0, 0.04), C('#323438', 0, 0.04)],
    brick: [C('#7a3a2a', 0, 0.07), C('#6c3224', 0, 0.07), C('#843e2c', 0, 0.06)], mortar: C('#4a3a34', 0, 0.04),
    shutter: [C('#7a7c80', 0, 0.03), C('#6a6c70', 0, 0.03)], metal: C('#5a5e64', 0, 0.04), metalD: C('#3a3c40', 0, 0.04),
    girder: C('#3e4a58', 0, 0.04), girderD: C('#2c3640', 0, 0.04),
    frame: C('#2a2c30', 0, 0.03), glassDark: C('#1c2430', 0, 0.03),
    win: [C('#ffd8a0', 1.2, 0.08), C('#ffe6c0', 1.0, 0.08), C('#d8e8ff', 1.1, 0.06), C('#ffc890', 1.3, 0.08)], winDim: C('#3a3428', 0.25, 0.05),
    curtain: [C('#c88a5a', 0.6, 0.06), C('#8aa0c8', 0.5, 0.06), C('#d8c8a0', 0.7, 0.05)],
    neonR: C('#ff3a5a', 3.2, 0.03), neonC: C('#40e8ff', 3.0, 0.03), neonM: C('#ff50e0', 3.0, 0.03), neonY: C('#ffd040', 3.0, 0.03),
    karaoke: [C('#ff60d0', 1.6, 0.06), C('#60d8ff', 1.5, 0.06), C('#ffe080', 1.4, 0.06)],
    fluor: C('#f4f8ff', 2.2, 0.02), shojiGlow: C('#ffd9a0', 1.3, 0.05), lanternOn: C('#ff5a38', 2.4, 0.05),
    conbiniB: C('#2a6ad8', 1.1, 0.03), conbiniG: C('#30b060', 1.1, 0.03), conbiniW: C('#f8fbff', 1.6, 0.02), conbiniFloor: C('#e8eaee', 0.35, 0.02),
    shelf: [C('#e84a3a', 0.4, 0.1), C('#f0c040', 0.4, 0.1), C('#4a8ad8', 0.4, 0.1), C('#f4f4f0', 0.45, 0.08), C('#5ab05a', 0.4, 0.1)],
    stripeY: C('#e8c020', 0.3, 0.03), stripeK: C('#1a1a1a', 0, 0.03), amber: C('#ffa020', 3.2, 0.03),
    namako: C('#2e3036', 0, 0.04),
  };
  const pick = (arr, x, y, z) => arr[Math.floor(hash01(x, y, z) * arr.length * 0.9999)];
  const tiles = (arr) => (x, y) => ((x & 1) && (y & 1) ? arr[1] : arr[0]);
  const concreteFace = (x, y, z) => ((y % 24 === 0) ? P.concreteD : P.concrete[(x + z + (y >> 3)) % 3]);
  const glassZ = (z, x0, x1, y0, y1, frame = P.frame) => { // a pane in a wall running along x
    B(x0, y0, z - 0.125, x1, y1, z + 0.125, 0);
    B(x0 - 0.125, y0 - 0.125, z - 0.125, x1 + 0.125, y0, z + 0.125, frame); B(x0 - 0.125, y1, z - 0.125, x1 + 0.125, y1 + 0.125, z + 0.125, frame);
    meta.glass.push({ axis: 'z', z, x0, x1, y0, y1 });
  };

  // ------------------------------------------------------------ the ground: the road in the middle, snowy and rutted,
  // a paved strip each side behind a granite kerb line; concrete and snow in the yard and the shrine's nook
  const top = Y(0.125) - 1;
  B(-16, -0.25, -16, 36, 0.125, 18, (x, y, z) => {
    if (y < top) return P.asphalt[0];
    const px = mx(x), pz = mz(z);
    if (pz > TK.road[0] && pz < TK.road[1]) {
      const wob = Math.sin(px * 0.21) * 0.12 + Math.sin(px * 0.07 + 1) * 0.15;
      for (const c of [-7.3, -9.4]) { const d = Math.abs(pz - (c + wob)); if (d < 0.18) return d < 0.1 ? P.wet : P.slush; } // tyre tracks
      if (Math.abs(pz - (TK.road[1] - 0.2)) < 0.06 || Math.abs(pz - (TK.road[0] + 0.2)) < 0.06) return P.line;              // the edge lines
      if (Math.abs(px - 6.0) < 2.0 && Math.abs(pz + 8.4) < 0.06 && ((x >> 2) & 1)) return P.line;                       // 止まれ-ish marks
      const mh = Math.hypot(px - 6.4, pz + 8.35); if (mh < 0.38) return mh > 0.3 ? P.metalD : P.manhole;
      const n = vnoise(x, z, 9, 7);
      return n > 0.8 ? P.slush : n < 0.28 ? P.asphalt[(x + z) & 1] : snowAt(x, z);
    }
    if (Math.abs(pz - TK.road[1]) < 0.13 || Math.abs(pz - TK.road[0]) < 0.13) return P.curb;
    if (pz < TK.walkN[1] + 0.01 && pz > TK.walkS[0] - 0.01) { // the pavements: interlocking blocks under trodden snow
      const n = vnoise(x, z, 6, 13);
      if (n > 0.55) return snowAt(x, z);
      const u = x >> 1, v = z >> 1;
      return ((u + v) & 1 ? P.paveA : P.paveB)[(x + z) & 1];
    }
    const n = vnoise(x, z, 7, 11);
    return n > 0.7 ? P.concrete[(x + z) & 1] : snowAt(x, z);
  });
  for (let x = -15.5; x < 35.5; x += 3.7) for (const z of [TK.road[1] - 0.1, TK.road[0] + 0.1]) B(x, 0, z - 0.125, x + 0.5, 0.125, z + 0.125, (vx) => ((vx & 1) ? P.drain : P.black));
  // snow banked along the foot of the buildings, a voxel or two (shovelled away from doors)
  const bank = (x0, x1, z0, z1, h = 2.6) => {
    for (let z = Z(z0); z < Z(z1); z++) for (let x = X(x0); x < X(x1); x++) {
      const k = Math.floor(vnoise(x, z, 5, 4) * h);
      for (let i = 1; i <= k; i++) G.set(x, top + i, z, i === k ? snowAt(x, z) : P.snowShade);
    }
  };
  bank(-12.5, -6.6, N - 0.5, N); bank(-4.4, -0.1, N - 0.5, N); bank(21.5, 23.8, N - 0.5, N); bank(29.6, 35.5, N - 0.5, N);
  bank(-12.4, 35.5, S, S + 0.4);

  // ------------------------------------------------------------ the shop itself, in its city dress
  buildShop(K, { city: true });

  // ------------------------------------------------------------ building helpers
  // a box of a building: walls, floors hidden inside, a parapet and snow on the roof. `face(x, y, z, px, py, pz)` paints
  // the walls; it can return 0 to cut an opening.
  const block = (x0, x1, z0, z1, h, face) => {
    B(x0, 0.125, z0, x1, h, z1, (x, y, z) => {
      const px = mx(x), pz = mz(z), py = my(y);
      const edge = px < x0 + 0.25 || px > x1 - 0.25 || pz < z0 + 0.25 || pz > z1 - 0.25;
      if (!edge) return py < 0.375 ? P.concreteD : 0;
      return face(x, y, z, px, py, pz);
    });
    B(x0, h, z0, x1, h + 0.5, z1, (x, y, z) => { const px = mx(x), pz = mz(z); return px < x0 + 0.25 || px > x1 - 0.25 || pz < z0 + 0.25 || pz > z1 - 0.25 ? P.concreteD : 0; });
    B(x0 + 0.25, h - 0.125, z0 + 0.25, x1 - 0.25, h, z1 - 0.25, P.concreteD);
    snowCap(x0, x1, z0, z1, h - 0.5, h + 0.75, 0.95);
  };
  // windows across a street face at z (outward: -1 faces north-side buildings onto the street, +1 the south side)
  const windows = (x0, x1, z, out, floors, seed, o = {}) => {
    const { y0 = 3.25, fh = 3.0, w = 1.0, gap = 0.55, h = 1.375, litP = 0.6, balcony = false, ac = true } = o;
    for (let f = 0; f < floors; f++) {
      const wy = y0 + f * fh + 0.625;
      for (let wx = x0 + gap; wx + w <= x1 - gap + 0.01; wx += w + gap) {
        const lit = hash01(Math.floor(wx * 4), f, seed) < litP;
        const c = lit ? P.win[Math.floor(hash01(f, Math.floor(wx), seed + 1) * 4)] : P.winDim;
        const curt = lit && hash01(f, Math.floor(wx * 3), seed + 2) < 0.45 ? P.curtain[Math.floor(hash01(f, wx, seed) * 3)] : null;
        B(wx, wy, z - 0.125, wx + w, wy + h, z + 0.125, (vx, vy) => (curt && (vy & 3) !== 0 && ((vx >> 1) & 1) ? curt : (vx === X(wx) + 3 ? P.frame : c)));
        B(wx - 0.0625, wy - 0.125, z + (out < 0 ? -0.25 : 0.125), wx + w + 0.0625, wy, z + (out < 0 ? -0.125 : 0.25), P.concreteD);
        if (balcony && f > 0) {
          const z0 = out < 0 ? z - 0.875 : z + 0.125, z1 = out < 0 ? z - 0.125 : z + 0.875;
          B(wx - 0.25, wy - 0.75, z0, wx + w + 0.25, wy - 0.625, z1, P.concrete[2]);
          B(wx - 0.25, wy - 0.625, out < 0 ? z0 : z1 - 0.125, wx + w + 0.25, wy + 0.125, out < 0 ? z0 + 0.125 : z1, (vx) => ((vx & 1) ? P.metal : 0));
        }
        if (ac && hash01(f, Math.floor(wx), seed + 9) < 0.35) { // an air conditioner's outdoor unit by the window
          const az0 = out < 0 ? z - 0.625 : z + 0.125, az1 = out < 0 ? z - 0.125 : z + 0.625;
          B(wx + w + 0.0625, wy - 0.125, az0, wx + w + 0.5, wy + 0.375, az1, (vx, vy) => (vy === Y(wy) && (vx & 1) ? P.metalD : P.concrete[2]));
        }
      }
    }
  };
  // a recessed shopfront: an opening at z with a glowing back (fill) and an optional frame
  const shopfront = (x0, x1, z, out, y1, fill, frame = P.timberD) => {
    const inner = z - out * 0.25;
    B(x0, 0.125, Math.min(z, inner), x1, y1, Math.max(z, inner), 0);
    B(x0, 0.125, inner - 0.0625, x1, y1, inner + 0.0625, fill);
    B(x0 - 0.125, y1, Math.min(z, inner) - 0.0625, x1 + 0.125, y1 + 0.125, Math.max(z, inner) + 0.0625, frame);
    for (const fx of [x0 - 0.125, x1]) B(fx, 0.125, Math.min(z, inner), fx + 0.125, y1, Math.max(z, inner), frame);
  };
  const shoji = (vx, vy) => ((vx % 5 === 0) || (vy % 5 === 0) ? P.lattice : P.shojiGlow);
  // a stack of vertical signs up a building's corner, one per floor (drawn as canvas signs in decor)
  const NAMES = [['スナック 蘭', '#ffd060', '#401010'], ['麻雀', '#7affb0', '#0a2a1a'], ['BAR 夜', '#60e0ff', '#081830'], ['居酒屋 花', '#ff7a5a', '#2a0808'],
    ['カラオケ', '#ff8ae8', '#2a0830'], ['焼鳥', '#ffb060', '#301808'], ['整体', '#c8f0ff', '#102030'], ['ラーメン', '#ffe040', '#401808'], ['寿司', '#ff9ab0', '#300a14'],
    ['酒場', '#ffe2b0', '#3a1a0a'], ['喫茶', '#ffd8a0', '#2a1408'], ['占い', '#e0a0ff', '#200a30'], ['ホテル', '#9affd0', '#082018'], ['薬', '#80ffea', '#0a2a28']];
  const stack = (x, z, out, floors, seed, y0 = 3.4, fh = 2.5) => {
    for (let f = 0; f < floors; f++) {
      const [text, color, bg] = NAMES[Math.floor(hash01(f, seed, 77) * NAMES.length)];
      const h = Math.min(fh - 0.25, 0.55 * [...text].length + 0.35);
      sign({ text, color, bg, vertical: true, w: 0.62, h, pos: [x, y0 + f * fh + h / 2, z + out * 0.5], faces: [Math.PI / 2, -Math.PI / 2] });
      B(x - 0.0625, y0 + f * fh + 0.25, z + (out < 0 ? -0.25 : 0), x + 0.0625, y0 + f * fh + 0.375, z + (out < 0 ? 0 : 0.25), P.metalD); // its bracket
    }
  };

  // ============================================================ the railway viaduct at the west end: brick arches with
  // little bars under them, a steel girder span across the street, the trains running north-south on top
  {
    const V = TK.viaduct;
    const brick = (x, y, z) => ((y & 1) === 0 && (y % 6 === 0) ? P.mortar : (((x + z + ((y >> 1) & 1) * 2) % 4) === 0 ? P.mortar : P.brick[(x * 3 + y + z) % 3]));
    for (const [z0, z1, face, out] of [[N, 18, N, -1], [-16, S, S, 1]]) {
      B(V.x0, 0.125, z0, V.x1, V.deck, z1, (x, y, z) => brick(x, y, z));
      // an arch on the street face with a tiny yakitori bar in it, its shoji glowing, lanterns at the eaves
      const cx = (V.x0 + V.x1) / 2;
      B(V.x0 + 0.5, 0.125, face + (out < 0 ? 0 : -1.0), V.x1 - 0.5, 4.25, face + (out < 0 ? 1.0 : 0), (x, y) => {
        const px = mx(x), py = my(y);
        return py < 3.25 || ((px - cx) / 1.25) ** 2 + ((py - 3.25) / 1.0) ** 2 < 1 ? 0 : brick(x, y, 0);
      });
      B(V.x0 + 0.5, 0.125, face + (out < 0 ? 0.875 : -1.0), V.x1 - 0.5, 4.25, face + (out < 0 ? 1.0 : -0.875), (x, y) => {
        const py = my(y), px = mx(x);
        if (py > 2.5) return py > 2.625 ? P.timberD : P.lantern;
        return px > cx - 0.75 && px < cx + 0.75 ? shoji(x, y) : (py < 1.0 ? P.timberD : shoji(x + 2, y));
      });
      light('arch' + out, [cx, 2.3, face - out * 0.2], 0xffa060, 3.2, 6);
      sign({ text: out < 0 ? 'やきとり' : 'もつ焼', color: '#fff0d0', bg: '#7a1410', w: 2.2, h: 0.5, pos: [cx, 3.0, face + out * 0.06], faces: [out < 0 ? Math.PI : 0] });
    }
    // the girder span over the street, its rivets and stiffeners; fluorescent tubes underneath
    B(V.x0, V.deck, S, V.x1, V.top, N, (x, y, z) => (y === Y(V.deck) || (z & 7) === 0 ? P.girderD : P.girder));
    for (const gx of [V.x0, V.x1 - 0.25]) B(gx, V.deck - 0.75, S, gx + 0.25, V.deck, N, (x, y, z) => ((z % 6) === 0 ? P.girderD : P.girder));
    for (const z of [-5.0, -8.25, -11.5]) B(V.x0 + 0.5, V.deck - 0.125, z, V.x1 - 0.5, V.deck, z + 0.125, P.fluor);
    light('viaduct', [(V.x0 + V.x1) / 2, V.deck - 0.6, -8.3], 0xdfeaff, 4.5, 10);
    // the deck: ballast, two rails, a parapet each side, and the masts for the overhead wire
    B(V.x0, V.deck, -16, V.x1, V.top, 18, (x, y, z) => (mz(z) > S && mz(z) < N ? G.get(x, y, z) || P.girder : brick(x, y, z)));
    B(V.x0, V.top, -16, V.x0 + 0.25, V.top + 0.75, 18, P.concrete[1]); B(V.x1 - 0.25, V.top, -16, V.x1, V.top + 0.75, 18, P.concrete[1]);
    for (const rx of [-14.875, -13.625]) B(rx, V.top, -16, rx + 0.125, V.top + 0.125, 18, P.chrome);
    for (let z = -15; z < 18; z += 7) { B(V.x1 - 0.375, V.top, z, V.x1 - 0.25, V.top + 4.25, z + 0.25, P.metal); B(V.x0 + 0.25, V.top + 4.0, z, V.x1 - 0.25, V.top + 4.25, z + 0.25, P.metal); }
    snowCap(V.x0, V.x1, -16, 18, V.top - 0.25, V.top + 1.0, 0.7);
    sign({ text: '思い出横丁', sub: 'OMOIDE YOKOCHO', color: '#ffe2b0', bg: '#1a1410', w: 3.2, h: 0.75, pos: [V.x1 + 0.06, V.deck - 0.4, -8.3], faces: [Math.PI / 2] });
  }

  // ============================================================ the north side (our side), west to east
  // W2: a four-storey building with an izakaya on the ground floor, a shoji front and red lanterns
  block(-12.5, -6.5, N, 18, 12.75, (x, y, z, px, py, pz) => (pz > N + 0.25 ? concreteFace(x, y, z) : py < 3.0 ? P.yaki[(x + y) & 1] : py < 3.25 ? P.timberD : tiles(P.tileB)(x, y)));
  shopfront(-11.75, -9.75, N, -1, 2.375, shoji); shopfront(-9.0, -7.75, N, -1, 2.375, (vx, vy) => (vy % 8 === 0 ? P.lattice : P.shojiGlow));
  windows(-12.5, -6.5, N, -1, 3, 11);
  stack(-6.85, N, -1, 4, 3);
  light('izakayaW', [-9.8, 2.2, N - 0.8], 0xff9850, 3.5, 6);
  sign({ text: '炭火焼', color: '#fff2d8', bg: '#2a1408', w: 2.0, h: 0.5, pos: [-9.75, 2.75, N - 0.06], faces: [Math.PI] });
  // the shrine's nook between W2 and W1: a little Inari shrine at the back of a passage, a vermilion torii at the street
  {
    const sx = TK.shrine.x;
    B(-6.5, 0.125, 3.0, -4.5, 6.0, 3.25, (x, y, z) => concreteFace(x, y, z));             // the back wall
    for (let z = Z(N); z < Z(3.0); z++) for (let x = X(-6.5); x < X(-4.5); x++) {           // a stone path in
      const row = z >> 2, seam = (z & 3) === 0 || Math.abs(mx(x) - sx) > 0.5;
      G.set(x, top, z, seam ? snowAt(x, z) : P.flag[Math.floor(hash01(x >> 2, row, 23) * 3.999)]);
    }
    for (const tz of [-2.75, -0.25]) { // two torii, one behind the other
      for (const px of [sx - 0.875, sx + 0.75]) B(px, 0.125, tz, px + 0.125, 2.75, tz + 0.125, P.vermilion);
      B(sx - 1.0, 2.375, tz - 0.0625, sx + 1.0, 2.5, tz + 0.1875, P.vermilion);
      B(sx - 1.0, 2.75, tz - 0.125, sx + 1.0, 2.875, tz + 0.25, P.black);
      snowCap(sx - 1.0, sx + 1.0, tz - 0.2, tz + 0.3, 2.6, 3.2, 0.9);
    }
    B(sx - 0.5, 0.125, 1.75, sx + 0.5, 0.5, 2.875, P.stone);
    B(sx - 0.375, 0.5, 1.875, sx + 0.375, 1.25, 2.75, (x, y, z) => (z === Z(1.875) && my(y) < 1.0 && Math.abs(mx(x) - sx) < 0.2 ? P.lantern : P.oak[(y >> 1) & 1]));
    for (let i = 0; i < 3; i++) B(sx - 0.625 + i * 0.125, 1.25 + i * 0.125, 1.75 + i * 0.125, sx + 0.625 - i * 0.125, 1.375 + i * 0.125, 3.0 - i * 0.125, P.tile[i & 1]);
    B(sx - 0.25, 0.125, 1.25, sx + 0.25, 0.375, 1.625, (x, y) => (y === Y(0.375) - 1 ? P.walnutD : P.oak[0])); // the offering box
    for (const fx of [sx - 0.875, sx + 0.625]) { B(fx, 0.125, 1.0, fx + 0.25, 0.375, 1.25, P.stone); B(fx + 0.0625, 0.375, 1.0625, fx + 0.1875, 0.75, 1.1875, C('#ece8e0', 0, 0.04)); } // foxes
    for (const lz of [0.25, 1.0]) for (const lx of [-6.375, -4.75]) B(lx, 0.75, lz, lx + 0.125, 1.0, lz + 0.125, P.lanternOn); // little red lamps on the walls
    snowCap(sx - 0.8, sx + 0.8, 1.6, 3.1, 1.2, 2.0, 1);
    light('shrine', [sx, 0.9, 1.4], 0xffa050, 1.6, 4);
  }
  // W1: a narrow five-storey building right against ours: a standing bar, then a stack of little bars up the stairs
  block(-4.5, 0, N, 18, 15.25, (x, y, z, px, py, pz) => (pz > N + 0.25 ? concreteFace(x, y, z) : py < 3.0 ? P.tileK[(x + y) & 1] : tiles(P.tileR)(x, y)));
  shopfront(-3.75, -1.0, N, -1, 2.25, (vx, vy) => (vy % 6 === 0 ? P.timberD : vy % 2 ? P.win[3] : P.win[0]));
  windows(-4.5, 0, N, -1, 4, 13, { w: 0.875 });
  stack(-4.15, N, -1, 5, 7);
  light('barW1', [-2.4, 2.1, N - 0.8], 0xffb070, 3, 5);
  sign({ text: '立ち飲み', color: '#ffe8c0', bg: '#202020', w: 1.8, h: 0.45, pos: [-2.4, 2.6, N - 0.06], faces: [Math.PI] });

  // E1: five storeys right against our east wall, back as far as the yard: a row of vending machines in front of its
  // shuttered ground floor (the machines are props), a stack of signs up its west corner
  block(16, 21.5, N, 10, 15.0, (x, y, z, px, py, pz) => (pz > N + 0.25 ? concreteFace(x, y, z) : py < 3.0 ? P.shutter[y & 1] : tiles(P.tileW)(x, y)));
  B(16.25, 2.875, N - 0.75, 21.25, 3.0, N, P.metal); snowCap(16.25, 21.25, N - 0.8, N, 2.8, 3.4, 1); // a canopy over the machines
  B(16.5, 2.75, N - 0.625, 21.0, 2.875, N - 0.5, P.fluor);
  windows(16, 21.5, N, -1, 4, 17, { balcony: true });
  stack(16.4, N, -1, 4, 11);
  light('vending', [18.5, 2.2, N - 1.2], 0xcfe4ff, 4.5, 6);
  // E1b: a pencil-thin building, a tobacconist's window lit under a little sign
  block(21.5, 24, N, 10, 9.5, (x, y, z, px, py, pz) => (pz > N + 0.25 ? concreteFace(x, y, z) : py < 3.0 ? P.tileG[(x + y) & 1] : tiles(P.tileB)(x, y)));
  shopfront(22.0, 23.5, N, -1, 2.25, (vx, vy) => (vy < Y(0.875) ? P.timberD : vy % 3 === 0 ? P.frame : P.win[1]));
  windows(21.5, 24, N, -1, 2, 19, { w: 0.875, gap: 0.5 });
  sign({ text: 'たばこ', color: '#ffffff', bg: '#c01818', w: 1.3, h: 0.42, pos: [22.75, 2.65, N - 0.06], faces: [Math.PI] });
  light('tabako', [22.75, 2.0, N - 0.8], 0xfff0e0, 2.2, 4.5);
  // E2: a three-storey izakaya: dark timber, a long glowing shoji front under a noren, a big red lantern at the door
  block(24, 29.5, N, 18, 9.75, (x, y, z, px, py, pz) => (pz > N + 0.25 ? concreteFace(x, y, z) : py < 0.5 ? P.stoneD : py < 3.25 ? P.yaki[((x >> 1) + y) & 1] : py < 3.5 ? P.timberD : P.yaki[(x + (y >> 2)) & 1]));
  shopfront(24.75, 28.75, N, -1, 2.375, shoji);
  B(24.25, 2.875, N - 0.875, 29.25, 3.0, N, P.tile[0]); B(24.25, 3.0, N - 0.875, 29.25, 3.125, N - 0.5, P.tile[1]); snowCap(24.25, 29.25, N - 0.9, N, 2.9, 3.6, 1);
  windows(24, 29.5, N, -1, 2, 23, { litP: 0.8, ac: false });
  sign({ text: '居酒屋', sub: 'IZAKAYA', color: '#fff2d8', bg: '#3a1408', vertical: true, w: 0.75, h: 2.4, pos: [29.15, 5.4, N - 0.5], faces: [Math.PI / 2, -Math.PI / 2] });
  light('izakayaE', [26.75, 2.0, N - 1.0], 0xff9850, 4.5, 7);
  // E3: a coin laundry glowing white on the corner, apartments over it
  block(29.5, 36, N, 18, 15.25, (x, y, z, px, py, pz) => (pz > N + 0.25 ? concreteFace(x, y, z) : py < 3.0 ? P.metal : tiles(P.tileB)(x, y)));
  glassZ(N + 0.125, 30.0, 35.5, 0.375, 2.625);
  B(29.75, 0.125, N + 0.25, 35.75, 0.25, N + 2.5, P.conbiniFloor); B(29.75, 2.875, N + 0.25, 35.75, 3.0, N + 2.5, P.fluor);
  for (let i = 0; i < 4; i++) { const wx = 30.4 + i * 1.3; B(wx, 0.25, N + 1.6, wx + 1.0, 1.875, N + 2.375, P.chrome); B(wx + 0.25, 0.75, N + 1.55, wx + 0.75, 1.25, N + 1.6, C('#2a3a4a', 0.4, 0.04)); }
  B(29.75, 3.0, N + 2.5, 35.75, 3.125, N + 2.625, P.concreteD);
  sign({ text: 'コインランドリー', color: '#e8f8ff', bg: '#1a5aa8', w: 4.6, h: 0.5, pos: [32.75, 3.3, N - 0.06], faces: [Math.PI] });
  light('laundry', [32.75, 2.4, N + 1.0], 0xe8f4ff, 4.5, 8);
  windows(29.5, 36, N, -1, 4, 29, { balcony: true });

  // the shop's front eaves stop at its own walls (the neighbours' faces come right to the corner)
  for (const [a, b] of [[-0.75, 0], [16, 16.75]]) B(a, 2.5, -4.5, b, 3.875, N, 0);

  // ============================================================ the yard: a plain concrete service yard behind the
  // kitchen, boxed in by the back of E1 (a one-storey wing, its kitchen door and vents onto the yard), the izakaya's
  // side wall, and a block wall at the back. Stepping stones from our back door to the old shed in the far corner; the
  // gomi station, the air conditioners, the crates and a bike are props.
  {
    const Yd = TK.yard, Sh = TK.shed;
    const blockWall = (x, y) => ((y + (x >> 2)) % 3 === 0 ? P.concreteD : P.concrete[(x + y) % 3]);
    block(16, 24, 10, Yd.z0, 3.25, (x, y, z, px, py, pz) => {
      if (pz < Yd.z0 - 0.25) return concreteFace(x, y, z);
      if (px > 20.0 && px < 20.75 && py < 2.25) return py > 2.125 || px < 20.0625 || px > 20.6875 ? P.frame : P.metal;  // E1's kitchen door
      if (px > 16.75 && px < 17.75 && py > 1.25 && py < 2.0) return (x & 3) === 0 ? P.frame : P.winDim;                // a frosted window
      if (px > 21.25 && px < 21.75 && py > 2.375 && py < 2.875) return (y & 1) ? P.concreteD : P.metal;                 // a vent
      return concreteFace(x, y, z);
    });
    for (const px of [17.625, 20.875]) B(px, 0.125, Yd.z0, px + 0.125, 3.25, Yd.z0 + 0.125, P.metal);            // downpipes
    B(16.75, 2.25, Yd.z0, 17.875, 2.375, Yd.z0 + 0.25, P.metal);                                                   // the window's little hood
    B(Yd.x0, 0.125, Yd.z1, Yd.x1, 3.0, 18, (x, y) => blockWall(x, y));                          // a block wall at the back
    B(15.875, 0.125, 16.0, 16.0, 3.0, 18, (x, y, z) => blockWall(z, y));                        // and along our back corner
    snowCap(Yd.x0, Yd.x1, Yd.z1, 18, 2.75, 3.5, 1);
    for (const [cx, cz] of [[16.95, 15.0], [17.75, 15.25], [18.55, 15.0], [19.35, 15.25], [20.15, 15.05]]) { // stepping stones, swept
      for (let z = Z(cz - 0.3); z < Z(cz + 0.3); z++) for (let x = X(cx - 0.3); x < X(cx + 0.3); x++) if (Math.hypot(mx(x) - cx, mz(z) - cz) < 0.3) G.set(x, top, z, P.flag[(x + z) & 3]);
    }
    // a tub of something evergreen by E1's door, and a bare lamp over it
    B(20.0, 0.125, 13.5, 20.625, 0.5, 14.125, P.wood[0]); B(20.125, 0.5, 13.625, 20.5, 1.375, 14.0, (x, y, z) => P.needles[(x + y + z) & 3]);
    snowCap(19.9, 20.7, 13.4, 14.2, 0.4, 1.6, 0.9);
    light('yard', [20.4, 2.5, 13.6], 0xffc890, 1.4, 4.5);
    // the shed: a little kura, namako tiles below and plaster above, a stone footing, a tiled roof
    const { x0, x1, z0, z1, floor } = Sh;
    B(x0 - 0.125, 0.125, z0 - 0.125, x1 + 0.125, floor, z1, (x, y, z) => (((x >> 2) + (z >> 2) + y) & 1 ? P.stone : P.stoneD));
    const wall = (u, y) => { const py = my(y); if (py < 1.5) { const a = (u + y) & 3, b = (u - y) & 3; return a === 0 || b === 0 ? P.plaster[0] : P.namako; } return py > 3.0 ? P.timberD : P.plaster[(y >> 4) & 1]; };
    B(x0, floor, z0, x1, 3.25, z0 + 0.25, (x, y) => wall(x, y)); B(x0, floor, z1 - 0.25, x1, 3.25, z1, (x, y) => wall(x, y));
    B(x0, floor, z0, x0 + 0.25, 3.25, z1, (x, y, z) => wall(z, y)); B(x1 - 0.25, floor, z0, x1, 3.25, z1, (x, y, z) => wall(z, y));
    B(x0 + 0.25, floor - 0.125, z0 + 0.25, x1 - 0.25, floor, z1 - 0.25, (x, y, z) => ((z >> 1) % 5 === 0 ? P.timberD : P.wood[(x >> 3) & 1]));
    B(x0 + 0.25, 3.0, z0 + 0.25, x1 - 0.25, 3.125, z1 - 0.25, (x) => ((x & 3) === 0 ? P.timberD : P.sugi[(x >> 3) % 3]));
    B(x0, floor, 14.5, x0 + 0.25, 2.5, 16.0, 0);                                             // its doorway, facing the back door
    B(x0 - 0.125, 2.5, 14.375, x0 + 0.25, 2.625, 16.125, P.timberD);
    B(x0 - 0.5, 0.125, 14.375, x0, 0.25, 16.125, P.stoneL);                                  // a step up to it
    const eave = Y(3.25), xa = X(x0 - 0.5), xb = X(x1 + 0.5);
    for (let x = xa; x < xb; x++) {
      const d = Math.min(x - xa, xb - 1 - x), yr = eave + Math.floor(d * 0.5);
      for (let z = Z(z0 - 0.5); z < Z(Math.min(z1 + 0.25, 17.875)); z++) {
        G.set(x, yr - 1, z, P.timberD); G.set(x, yr, z, ((z >> 1) & 1) ? P.tile[0] : P.tile[1]);
        G.set(x, yr + 1, z, x === xa || x === xb - 1 ? P.tileEdge : snowAt(x, z));
        if (x !== xa && x !== xb - 1) G.set(x, yr + 2, z, snowAt(x, z + 3));
      }
      for (const z of [Z(z0), Z(z1) - 1]) for (let y = eave; y < yr - 1; y++) G.set(x, y, z, P.plaster[1]);
    }
    light('kura', [(x0 + x1) / 2, 2.6, (z0 + z1) / 2], 0xffb070, 3.2, 6);
    light('backdoor', [16.6, 2.4, 15.0], 0xffd8a0, 1.6, 4.5);
  }

  // ============================================================ the south side, west to east (fronts at z = S)
  // S1: the convenience store: a long glass front pouring white light across the snow, the stripes over it
  {
    const x0 = -12.5, x1 = -5.5;
    block(x0, x1, -16, S, 7.75, (x, y, z, px, py, pz) => (pz < S - 0.25 ? concreteFace(x, y, z) : py > 2.875 && py < 3.875 ? (py < 3.125 ? P.conbiniB : py < 3.375 ? P.conbiniW : P.conbiniG) : tiles(P.tileW)(x, y)));
    glassZ(S - 0.125, x0 + 0.5, x1 - 0.5, 0.375, 2.75, P.metal);
    B(x0 + 0.25, 0.125, -15.75, x1 - 0.25, 0.25, S - 0.25, P.conbiniFloor);
    B(x0 + 0.25, 3.0, -15.75, x1 - 0.25, 3.125, S - 0.25, P.conbiniW);
    B(x0 + 1.0, 0.25, -14.75, x1 - 2.5, 1.5, -14.25, (x, y, z) => (y % 4 === 3 ? P.chrome : pick(P.shelf, x, y >> 1, z)));
    B(x0 + 0.5, 0.25, -15.75, x1 - 0.5, 2.25, -15.375, (x, y) => (y % 5 === 0 ? P.chrome : pick(P.shelf, x, y, 7)));
    B(x1 - 2.0, 0.25, -14.25, x1 - 0.5, 1.0, -13.75, P.tileW[0]);
    light('conbiniA', [-10.5, 2.4, -14.2], 0xeaf4ff, 6, 11); light('conbiniB', [-7.2, 2.4, -14.2], 0xeaf4ff, 6, 11);
    sign({ text: '24 HOURS · コンビニ', color: '#ffffff', w: 4.8, h: 0.42, pos: [-9.0, 3.27, S + 0.06], faces: [0] });
    windows(x0, x1, S, 1, 1, 45, { y0: 4.0, litP: 0.5 });
  }
  // S2: a ramen shop: yellow sign, steamed-up window, red lanterns
  block(-5.5, 0.5, -16, S, 10.0, (x, y, z, px, py, pz) => (pz < S - 0.25 ? concreteFace(x, y, z) : py < 3.0 ? P.timberD : tiles(P.tileG)(x, y)));
  shopfront(-4.75, -2.75, S, 1, 2.375, (vx, vy) => (vy % 6 === 0 || vx % 7 === 0 ? P.timberD : C('#f4e8d0', 1.0, 0.06)));
  shopfront(-2.25, -0.25, S, 1, 2.375, shoji);
  windows(-5.5, 0.5, S, 1, 2, 53);
  sign({ text: 'ラーメン', sub: '味噌 · 醤油 · 塩', color: '#3a1a08', bg: '#ffd020', w: 3.6, h: 0.75, pos: [-2.5, 2.9, S + 0.06], faces: [0] });
  light('ramen', [-2.5, 2.1, S + 0.9], 0xffc070, 4, 6);
  meta.steam.push({ pos: [-0.3, 3.2, S + 0.2], size: 0.9 });
  // S3: a tall, narrow zakkyo building: a drugstore blazing at street level, signs stacked up both corners
  block(0.5, 7.5, -16, S, 15.5, (x, y, z, px, py, pz) => (pz < S - 0.25 ? concreteFace(x, y, z) : py < 3.0 ? P.conbiniW : tiles(P.tileW)(x, y)));
  shopfront(1.0, 7.0, S, 1, 2.5, (vx, vy) => (vy % 4 === 0 ? P.chrome : pick(P.shelf, vx, vy >> 1, 3)), P.metal);
  for (let i = 0; i < 4; i++) B(1.25 + i * 1.5, 0.125, S, 2.25 + i * 1.5, 0.75 + (i & 1) * 0.25, S + 0.5, (x, y, z) => pick(P.shelf, x, y, z)); // baskets of stuff out front
  windows(0.5, 7.5, S, 1, 4, 55, { litP: 0.7 });
  stack(0.85, S, 1, 4, 21); stack(7.15, S, 1, 4, 23);
  sign({ text: '薬', sub: 'ドラッグ', color: '#ffffff', bg: '#e0102a', w: 1.6, h: 0.6, pos: [4.0, 2.85, S + 0.06], faces: [0] });
  light('drug', [4.0, 2.2, S + 1.0], 0xf4f8ff, 5, 8);
  // S4: an old kissaten: brick, a warm bay window, a hanging sign
  block(7.5, 12, -16, S, 9.0, (x, y, z, px, py, pz) => (pz < S - 0.25 ? concreteFace(x, y, z) : (((x + ((y >> 1) & 1) * 2) % 4) === 0 || (y & 1) === 0 && y % 4 === 0 ? P.mortar : P.brick[(x + y) % 3])));
  shopfront(8.25, 11.25, S, 1, 2.25, (vx, vy) => (vy < Y(0.875) ? P.timberD : vx % 6 === 0 || vy % 6 === 0 ? P.timberD : P.win[3]));
  windows(7.5, 12, S, 1, 2, 57, { ac: false });
  sign({ text: '喫茶 ミモザ', color: '#ffe8c0', bg: '#2a1408', vertical: true, w: 0.6, h: 2.2, pos: [11.7, 4.6, S + 0.5], faces: [Math.PI / 2, -Math.PI / 2] });
  light('kissa', [9.75, 1.9, S + 0.8], 0xffb060, 3, 5);
  // S5: a karaoke tower: every window a different colour, a huge sign down its face
  block(12, 19, -16, S, 15.75, (x, y, z, px, py, pz) => (pz < S - 0.25 ? concreteFace(x, y, z) : py < 3.0 ? P.glassDark : tiles(P.tileK)(x, y)));
  for (let f = 0; f < 4; f++) for (let wx = 12.75; wx < 18.5; wx += 1.6) B(wx, 3.9 + f * 3.0, S - 0.125, wx + 1.1, 5.1 + f * 3.0, S + 0.125, pick(P.karaoke, Math.floor(wx), f, 61));
  shopfront(13.5, 17.5, S, 1, 2.5, (vx, vy) => (vy % 5 === 0 ? P.frame : P.karaoke[(vx >> 3) % 3]), P.metal);
  sign({ text: 'カラオケ', sub: 'KARAOKE · 歌広場', color: '#ff8ae8', bg: '#200828', vertical: true, w: 1.1, h: 5.2, pos: [12.2, 8.4, S + 0.6], faces: [Math.PI / 2, -Math.PI / 2] });
  light('karaoke', [15.5, 2.3, S + 0.9], 0xff60d0, 4.5, 8);
  // S6: a yakiniku restaurant: smoke from its vents, red lanterns, a long sign
  block(19, 26, -16, S, 10.0, (x, y, z, px, py, pz) => (pz < S - 0.25 ? concreteFace(x, y, z) : py < 3.0 ? P.yaki[(x + y) & 1] : tiles(P.tileR)(x, y)));
  shopfront(19.75, 25.25, S, 1, 2.375, (vx, vy) => (vy % 8 === 0 ? P.timberD : vx % 9 === 0 ? P.lattice : P.shojiGlow));
  windows(19, 26, S, 1, 2, 63);
  sign({ text: '焼肉', sub: 'YAKINIKU', color: '#fff0d8', bg: '#8a1010', w: 2.6, h: 0.7, pos: [22.5, 2.95, S + 0.06], faces: [0] });
  light('yakiniku', [22.5, 2.0, S + 0.9], 0xff8050, 4, 6.5);
  meta.steam.push({ pos: [25.6, 4.2, S + 0.3], size: 1.2 });
  // S7: a mansion block: balconies, a lit lobby (two more vending machines in front: props)
  block(26, 36, -16, S, 15.75, (x, y, z, px, py, pz) => (pz < S - 0.25 ? concreteFace(x, y, z) : tiles(P.tileB)(x, y)));
  shopfront(30.0, 32.0, S, 1, 2.5, (vx, vy) => (vy % 6 === 0 ? P.frame : P.fluor), P.metal);
  windows(26, 36, S, 1, 4, 65, { balcony: true, litP: 0.5 });
  light('lobby', [31.0, 2.2, S + 0.8], 0xe8f0ff, 3, 6);

  // ============================================================ poles, lamps and the road works at each end
  const poles = [[-1.5, -5.15], [11.25, -5.15], [23.0, -5.15], [33.5, -5.15], [-7.5, -11.6], [5.0, -11.6], [18.0, -11.6], [29.5, -11.6]];
  for (const [px, pz] of poles) {
    for (let y = Y(0.125); y < Y(8.5); y++) for (let z = Z(pz - 0.125); z < Z(pz + 0.125); z++) for (let x = X(px - 0.125); x < X(px + 0.125); x++) G.set(x, y, z, (y % 16 === 0) ? P.concreteD : P.concrete[2]);
    B(px - 0.75, 7.75, pz - 0.0625, px + 0.75, 7.875, pz + 0.0625, P.metalD);
    B(px - 0.25, 6.25, pz - 0.375, px + 0.25, 7.0, pz + 0.125, P.metal);
    const toward = pz > -8 ? -1 : 1;
    B(px - 0.0625, 5.5, Math.min(pz, pz + toward * 1.25), px + 0.0625, 5.625, Math.max(pz, pz + toward * 1.25), P.metalD);
    B(px - 0.1875, 5.375, pz + toward * 1.25 - 0.125, px + 0.1875, 5.5, pz + toward * 1.25 + 0.125, C('#f0f4ff', 2.6, 0.02));
    light('lamp' + px, [px, 5.2, pz + toward * 1.25], 0xdfe6ff, 5, 10);
    snowCap(px - 0.8, px + 0.8, pz - 0.5, pz + 0.5, 5.0, 9.0, 0.7);
    // a street-address plate and a little ad wrapped round the pole
    B(px - 0.1875, 2.0, pz - 0.1875, px + 0.1875, 2.75, pz + 0.1875, (x, y) => (y % 3 === 0 ? P.frame : C('#2a6a3a', 0.3, 0.04)));
  }
  meta.poles = poles.map(([x, z]) => [x, 7.8, z]);
  // road works: striped barriers across the street at both ends, blinking lamps on top (the blinking is decor's)
  for (const bx of [TK.ends.x0, TK.ends.x1]) {
    for (let z = S + 0.25; z < N - 0.25; z += 1.5) {
      B(bx - 0.0625, 0.125, z + 0.125, bx + 0.0625, 1.0, z + 0.25, P.metalD); B(bx - 0.0625, 0.125, z + 1.25, bx + 0.0625, 1.0, z + 1.375, P.metalD);
      B(bx - 0.0625, 0.5, z, bx + 0.0625, 1.0, z + 1.5, (x, y, vz) => (((vz + y) >> 1) & 1 ? P.stripeY : P.stripeK));
      B(bx - 0.0625, 1.0, z + 0.6875, bx + 0.0625, 1.125, z + 0.8125, P.amber);
    }
    B(bx - 0.375, 0.125, -9.0, bx + 0.375, 0.75, -7.75, (x, y) => (y % 2 ? P.stripeY : P.stripeK)); // a sandbagged sign stand
    sign({ text: '工事中', sub: 'ご迷惑をおかけします', color: '#1a1a1a', bg: '#f0e8d8', glow: 0.55, w: 1.1, h: 1.4, pos: [bx, 1.55, -8.4], faces: [bx < 0 ? Math.PI / 2 : -Math.PI / 2] });
  }
  meta.barriers = [TK.ends.x0, TK.ends.x1].flatMap((bx) => { const out = []; for (let z = S + 0.25; z < N - 0.25; z += 1.5) out.push([bx, 1.06, z + 0.75]); return out; });

  // ---- the lights at our door, and the shop's sign
  light('door', [13.4, 2.1, -4.0], 0xff9050, 5, 6);
  sign({ text: '夜明け', sub: 'すし · やきとり', pos: [15.75, 5.6, N - 0.55], w: 0.75, h: 2.6, color: '#fff2dc', bg: '#7a1410', vertical: true, faces: [Math.PI / 2, -Math.PI / 2] });

  finishShop(K);
  markGlass(K);
  return meta;
}
