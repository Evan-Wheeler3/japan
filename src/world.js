// The static voxel world: a snowy cliff-top lot above the sea, the shop (Yoake) and its upstairs,
// a storehouse, a little shrine, pines. World voxels are 1/8 m. Props live in props.js at finer scales.
import * as THREE from 'three';
import { Grid, C, rng, hash3, hash01, meshVoxels, glyphPixels, textWidth } from './voxel.js';

export const VS = 0.125, OX = -16, OY = -0.25, OZ = -16;
export const SX = 416, SY = 132, SZ = 272; // to z 18: a strip of yard behind the shop

// Key layout numbers (meters) shared by other modules
export const L = {
  floor: 0.25,            // shop floor top
  walk: 0.125,            // snow / path top
  ceil: 3.5,
  diner: { x0: 0, x1: 16, z0: -3.375, z1: 10.25 },
  inside: { x0: 0.25, x1: 15.75, z0: -3.125, z1: 15.75 },
  door: { x0: 12.75, x1: 14.0, z: -3.25, hinge: 12.8125, h: 2.625 },
  cliff: -11.25,          // the lot ends here; below is the sea
  bounds: { x0: -11.25, x1: 33.0, z0: -10.4, z1: 17.3 },
  roofDry: [[-0.75, 16.75, -4.0, 16.5], [20.5, 27.5, 2.5, 9.5], [-9.25, -6.75, 1.0, 3.0]], // no snow falls under these
};

export class World {
  constructor() {
    this.grid = new Grid(SX, SY, SZ);
    this.col = new Uint8Array(SX * SY * SZ);
  }
  vx(m) { return Math.round((m - OX) / VS); }
  vy(m) { return Math.round((m - OY) / VS); }
  vz(m) { return Math.round((m - OZ) / VS); }
  box(x0, y0, z0, x1, y1, z1, c) {
    this.grid.box(this.vx(x0), this.vy(y0), this.vz(z0), this.vx(x1), this.vy(y1), this.vz(z1), c);
  }
  cell(mx, my, mz) {
    const x = Math.floor((mx - OX) / VS), y = Math.floor((my - OY) / VS), z = Math.floor((mz - OZ) / VS);
    if (x < 0 || y < 0 || z < 0 || x >= SX || y >= SY || z >= SZ) return -1;
    return (y * SZ + z) * SX + x;
  }
  mark(mx, my, mz) { const i = this.cell(mx, my, mz); if (i >= 0) this.col[i] = 1; }
  // walls: true also counts closed doors (horizontal blocking only; doors are never floor)
  solid(mx, my, mz, walls = false) {
    if (walls && this.blockers) for (const b of this.blockers) if (b.blocks(mx, my, mz)) return true;
    const i = this.cell(mx, my, mz);
    if (i < 0) return my < 0;
    return this.grid.d[i] !== 0 || this.col[i] !== 0;
  }
  mesh(litMat, emitMat) {
    const grp = new THREE.Group();
    const G = this.grid, d = G.d;
    const get = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= SX || y >= SY || z >= SZ) ? 0 : d[(y * SZ + z) * SX + x];
    const CS = 64;
    for (let cy = 0; cy < SY; cy += CS) for (let cz = 0; cz < SZ; cz += CS) for (let cx = 0; cx < SX; cx += CS) {
      const { lit, emit } = meshVoxels(get, cx, cy, cz, Math.min(cx + CS, SX), Math.min(cy + CS, SY), Math.min(cz + CS, SZ), VS, OX, OY, OZ);
      if (lit) grp.add(new THREE.Mesh(lit, litMat));
      if (emit) grp.add(new THREE.Mesh(emit, emitMat));
    }
    return grp;
  }
}

// smooth value noise in [0, 1] on a grid of `cell` voxels
function vnoise(x, z, cell, seed) {
  const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz);
  let tx = fx - ix, tz = fz - iz; tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
  const h = (a, b) => hash01(a, seed, b);
  const a = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * tx, b = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * tx;
  return a + (b - a) * tz;
}

export function buildWorld(W) {
  const G = W.grid;
  const X = (m) => W.vx(m), Y = (m) => W.vy(m), Z = (m) => W.vz(m);
  const B = (...a) => W.box(...a);
  const mx = (x) => OX + (x + 0.5) * VS, myOf = (y) => OY + (y + 0.5) * VS, mz = (z) => OZ + (z + 0.5) * VS;
  const meta = { lights: [], glass: [], etched: [], steam: [] };

  // ------------------------------------------------------------ palette
  const P = {
    snow: [C('#eef3fb', 0, 0.025), C('#e6edf8', 0, 0.025), C('#f4f7fc', 0, 0.02), C('#dde6f3', 0, 0.03)],
    snowShade: C('#cfdaea', 0, 0.03), ice: C('#bcd8ee', 0, 0.04), earth: C('#2e241c', 0, 0.08),
    flag: [C('#9a9ca2', 0, 0.06), C('#a6a8ae', 0, 0.06), C('#8e9096', 0, 0.06), C('#b0b2b8', 0, 0.05)],
    stone: C('#8a8b8e', 0, 0.06), stoneD: C('#5c5e63', 0, 0.06), stoneL: C('#a4a5a8', 0, 0.05), moss: C('#4a5a3a', 0, 0.1),
    yaki: [C('#1f1a17', 0, 0.06), C('#28211c', 0, 0.06)], timber: C('#3a2416', 0, 0.06), timberD: C('#2a190f', 0, 0.05),
    plaster: [C('#e8dfcc', 0, 0.035), C('#ddd2bb', 0, 0.035)], plasterD: C('#c4b89e', 0, 0.04),
    tile: [C('#3b3f47', 0, 0.05), C('#30343b', 0, 0.05)], tileEdge: C('#24272d', 0, 0.04),
    sugi: [C('#b98a5a', 0, 0.06), C('#a87a4c', 0, 0.06), C('#c49664', 0, 0.06)],
    oak: [C('#5e3a20', 0, 0.07), C('#6a4426', 0, 0.07), C('#52321b', 0, 0.07)], walnutD: C('#2c1a0e', 0, 0.05),
    floor: [C('#7a5032', 0, 0.06), C('#6c4429', 0, 0.06), C('#84583a', 0, 0.06), C('#73492d', 0, 0.06)], floorSeam: C('#3e2616', 0, 0.04),
    hinoki: C('#d8b07c', 0, 0.035), hinokiE: C('#c49a66', 0, 0.035),
    steel: C('#9aa0a6', 0, 0.05), steelD: C('#6f747a', 0, 0.05), chrome: C('#c4c9cf', 0, 0.04), black: C('#121214', 0, 0.04),
    heat: C('#ff7a2a', 4, 0.05), beam: C('#2a1a10', 0, 0.06), crown: C('#24160c', 0, 0.05),
    shoji: C('#ffd9a0', 1.15, 0.05), shojiDim: C('#e8c890', 0.55, 0.05), shojiDark: C('#2a2a34', 0, 0.06), lattice: C('#3a2414', 0, 0.04),
    lantern: C('#ffc684', 2.2, 0.04), lanternRed: C('#ff5a38', 2.4, 0.05), kanbanInk: C('#ffe2b0', 1.5, 0.04),
    vermilion: C('#c8402a', 0, 0.05), vermilionD: C('#9a2e1e', 0, 0.05),
    bark: C('#3a2a1e', 0, 0.08), needles: [C('#1e3a2a', 0, 0.1), C('#24452f', 0, 0.1), C('#1a3224', 0, 0.09), C('#2b4d35', 0, 0.1)],
    bamboo: [C('#8f9a5c', 0, 0.06), C('#7d8a4c', 0, 0.06)], bambooNode: C('#5f6a38', 0, 0.05), straw: C('#d6c08a', 0, 0.06), paper: C('#f6f2e8', 0, 0.03),
    wood: [C('#6a4a30', 0, 0.08), C('#5a3e28', 0, 0.08)], log: C('#8a6a48', 0, 0.06), logEnd: C('#c8a070', 0, 0.06),
  };
  const pick = (arr, x, y, z) => arr[Math.floor(hash01(x, y, z) * arr.length * 0.9999)];
  const snowAt = (x, z) => { const n = vnoise(x, z, 6, 3); return n > 0.7 ? P.snow[2] : n < 0.3 ? P.snow[3] : P.snow[(x * 7 + z * 3) & 1]; };
  // the lot ends at the cliff; beyond it the land falls away to the sea (see effects.makeBackdrop)
  const onLot = (z) => mz(z) > L.cliff;

  // ------------------------------------------------------------ ground: snow over earth, a flagstone path along the front
  const top = Y(0.125) - 1;
  B(-16, -0.25, L.cliff, 36, 0.125, 18, (x, y, z) => (y < top ? P.earth : snowAt(x, z)));
  const isPath = (x, z) => {
    const px = mx(x), pz = mz(z);
    if (pz > -5.125 && pz < -3.375) return true;                  // along the front of the shop
    if (px > 12.0 && px < 14.75 && pz > -5.5 && pz < -3.25) return true; // the door apron
    if (px > -3.25 && px < -2.125 && pz > -5.25 && pz < 3.625) return true; // up to the shrine
    if (px > -7.0 && px < -2.125 && pz > 2.375 && pz < 3.625) return true;  // the sando, through the torii
    return false;
  };
  for (let z = Z(-6); z < Z(3.75); z++) for (let x = 0; x < SX; x++) {
    if (!isPath(x, z)) continue;
    const row = z >> 2, off = (row & 1) * 2, cx = (x + off) >> 2;
    const seam = ((x + off) & 3) === 0 || (z & 3) === 0;
    const h = hash01(cx, row, 17);
    G.set(x, top, z, seam ? (h > 0.3 ? P.snow[3] : P.stone) : h > 0.8 ? P.snow[1] : P.flag[Math.floor(h * 3.999)]);
  }
  // drifts: soft mounds off the path, deeper against walls (never taller than a step, so everyone can wade through)
  const inFoot = (px, pz) => (px > -0.5 && px < 16.5 && pz > -3.75 && pz < 16) || (px > 20.75 && px < 27.25 && pz > 2.75 && pz < 9.25);
  for (let z = Z(L.cliff) + 2; z < SZ; z++) for (let x = 0; x < SX; x++) {
    if (isPath(x, z)) continue;
    const px = mx(x), pz = mz(z);
    if (inFoot(px, pz)) continue;
    if (px > 18.4 && px < 20.0 && pz > -3.5 && pz < -1.8) continue; // the vending machine stands here
    if (px > 15.9 && px < 18.0 && pz > -1.5 && pz < 8.5) continue;  // dug out around the apartment stairs
    if (px > 15.7 && px < 18.3 && pz > -3.6 && pz < -0.3) continue; // and a shovelled way to them from the front path
    if (px > -0.6 && px < 2.6 && pz > 15.9) continue;                 // outside the back door
    if (px > 15.9 && px < 18.5 && pz > 10.1 && pz < 13.4) continue; // the freezer annex
    if (px > 22.4 && px < 25.6 && pz > 0.8 && pz < 3.0) continue;    // before the kura's door
    let h = Math.floor((vnoise(x, z, 14, 5) * 0.7 + vnoise(x, z, 5, 6) * 0.3 - 0.42) * 7);
    const nearWall = (px > -1.0 && px < 17.0 && pz > -4.25 && pz < 16) || (px > 20.25 && px < 27.75 && pz > 2.25 && pz < 9.75);
    if (nearWall) h += 2;
    if (pz < -5.125 && pz > -5.75) h = Math.min(h, 1);            // the path's shoveled shoulder
    if (pz < L.cliff + 0.5) h = Math.min(h, 1);
    h = Math.max(0, Math.min(3, h));
    for (let i = 1; i <= h; i++) G.set(x, top + i, z, i === h ? snowAt(x + 1, z) : P.snowShade);
  }
  // the cliff edge: a rounded snow lip
  for (let x = 0; x < SX; x++) for (let i = 0; i < 2; i++) G.set(x, top - i, Z(L.cliff), i ? P.earth : P.snow[3]);

  // ------------------------------------------------------------ little helpers
  // snow settles on the topmost surface of each column in a box (trees, fences, lanterns)
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
  const conifer = (tx, tz, h, seed) => {
    const r = rng(seed);
    const base = 0.125, trunkTop = base + h * 0.25;
    B(tx - 0.125, base, tz - 0.125, tx + 0.125, base + h * 0.9, tz + 0.125, P.bark);
    const maxR = 1.0 + h * 0.18, tiers = 4 + Math.floor(h / 3);
    for (let t = 0; t < tiers; t++) {
      const ty0 = trunkTop + (h - h * 0.25) * (t / tiers), ty1 = ty0 + (h * 0.75 / tiers) * 1.35;
      const r0 = maxR * (1 - t / (tiers + 0.6)) + r() * 0.15;
      for (let y = Y(ty0); y < Y(ty1); y++) {
        const k = (myOf(y) - ty0) / (ty1 - ty0), rad = r0 * (1 - k * 0.75);
        for (let z = Z(tz - rad - 0.2); z < Z(tz + rad + 0.2); z++) for (let x = X(tx - rad - 0.2); x < X(tx + rad + 0.2); x++) {
          const d = Math.hypot(mx(x) - tx, mz(z) - tz);
          if (d < rad * (0.85 + hash01(x, y, z) * 0.25)) G.set(x, y, z, pick(P.needles, x, y, z));
        }
      }
    }
    B(tx - 0.0625, base + h * 0.98, tz - 0.0625, tx + 0.0625, base + h + 0.25, tz + 0.0625, P.needles[0]);
    snowCap(tx - maxR - 0.4, tx + maxR + 0.4, tz - maxR - 0.4, tz + maxR + 0.4, trunkTop, base + h + 0.5, 0.82, (v) => v === P.bark);
  };

  // ------------------------------------------------------------ the shop (ground floor). Same footprint as the old diner:
  // main room x 0..16, z 0..10 behind a shoji partition; a glass-fronted booth room along the front (z -3..0) looking out to sea.
  const wood = (u, y) => {
    const my = myOf(y);
    if (my < 1.125) return P.oak[(u >> 1) % 3];          // dark board wainscot
    if (my < 1.25) return P.walnutD;                     // rail
    if (my > 3.375) return P.crown;
    return (u % 14 === 0) ? P.timber : P.plaster[(y >> 3) & 1]; // plaster between timber posts
  };
  // outside face of the ground floor: stone base, charred-cedar boards
  const yakisugi = (u, my) => (my < 0.5 ? (((u >> 2) + Math.floor(my * 8)) & 1 ? P.stone : P.stoneD) : P.yaki[(u >> 1) & 1]);

  // floor: long plank boards running along x
  B(0, -0.25, -3.375, 16, 0.25, 10.25, (x, y, z) => {
    if (y < Y(0.25) - 1) return P.floorSeam;
    const row = z >> 1, seg = Math.floor((x + row * 7) / 22);
    if ((x + row * 7) % 22 === 0) return P.floorSeam;
    return P.floor[Math.floor(hash01(seg, row, 5) * 3.999)];
  });

  // west wall: charred cedar outside, wood + plaster inside, windows over the booths
  B(0, 0.125, 0, 0.125, 3.5, 10.25, (x, y, z) => yakisugi(z, myOf(y)));
  B(0.125, 0.25, 0.25, 0.25, 3.5, 10.0, (x, y, z) => wood(z, y));
  for (const [a, b] of [[1.875, 4.125], [4.25, 6.5], [6.625, 8.75]]) {
    B(0, 1.0, a, 0.25, 2.75, b, 0);
    meta.glass.push({ axis: 'x', x: 0.125, z0: a, z1: b, y0: 1.0, y1: 2.75 });
    B(-0.125, 0.875, a - 0.125, 0.25, 1.0, b + 0.125, P.timber);   // sill
    B(-0.125, 2.75, a - 0.125, 0.25, 2.875, b + 0.125, P.timber);  // head
  }
  // east wall, back wall, crown
  B(15.875, 0.25, 0, 16, 3.5, 10.25, (x, y, z) => yakisugi(z, myOf(y)));
  B(15.75, 0.25, 0.25, 15.875, 3.5, 10.0, (x, y, z) => wood(z, y));
  B(0, 0.25, 10.0, 16, 3.5, 10.125, (x, y, z) => wood(x, y));
  B(0, 0.25, 10.125, 16, 3.5, 10.25, P.plasterD);
  B(0.25, 3.375, 9.875, 15.75, 3.5, 10.0, P.crown); B(0.25, 3.375, 0.25, 0.375, 3.5, 10.0, P.crown); B(15.625, 3.375, 0.25, 15.75, 3.5, 10.0, P.crown);
  // ceiling: cedar planks between dark beams
  B(0.25, 3.5, 0.25, 15.75, 3.75, 10.0, (x, y, z) => ((z & 3) === 0 ? P.sugi[1] : P.sugi[(x >> 4) % 3 === 2 ? 2 : 0]));
  for (const bx of [3.2, 6.4, 9.6, 12.8]) B(bx - 0.125, 3.25, 0.25, bx + 0.125, 3.5, 10.0, P.beam);
  B(0.25, 3.25, 9.75, 15.75, 3.5, 10.0, P.beam);
  for (const bz of [2.6, 5.2, 7.8]) B(0.25, 3.375, bz - 0.0625, 15.75, 3.5, bz + 0.0625, P.beam);

  // shoji partition between the main room and the front booth room: dark wood half wall, shoji panels above, timber posts, two openings
  const openings = [[7.25, 8.5], [12.75, 14.0]];
  B(0.125, 0.125, 0, 15.875, 3.0, 0.25, 0);
  for (let x = X(0.25); x < X(15.75); x++) {
    const px = mx(x);
    if (openings.some(([a, b]) => px > a && px < b)) continue;
    const post = (x - X(0.25)) % 9 === 0;
    for (const z of [Z(0), Z(0.125)]) {
      for (let y = Y(0.25); y < Y(1.25); y++) G.set(x, y, z, P.oak[(x >> 1) & 1]);
      G.set(x, Y(1.25) - 1, z, P.walnutD);
      for (let y = Y(1.25); y < Y(1.875); y++) if (post) G.set(x, y, z, P.timber);
      G.set(x, Y(1.875), z, P.timber);
    }
  }
  for (const [a, b] of openings) for (const px of [X(a) - 1, X(b)]) for (let y = Y(0.25); y < Y(3.0); y++) { G.set(px, y, Z(0), P.timberD); G.set(px, y, Z(0.125), P.timberD); }
  B(0.25, 3.0, 0, 15.75, 3.5, 0.25, P.beam);
  for (const [a, b] of [[0.25, 7.125], [8.625, 12.625], [14.125, 15.75]]) meta.etched.push({ x0: a, x1: b, y0: 1.25, y1: 1.875, z: 0.125 });

  // ---- front room: stone-and-cedar knee wall, timber-framed glass, cedar ceiling under a tiled lean-to roof
  const consPanes = [[0.375, 1.75], [1.875, 3.375], [3.5, 5.0], [5.125, 6.625], [6.75, 8.25], [8.375, 9.875], [10.0, 11.5], [11.625, 12.625], [14.125, 15.625]];
  const glassWall = (inPane, outer, my, u) => {
    if (my < 0.875) return outer ? yakisugi(u, my) : P.oak[0];
    if (my < 1.0) return P.timber;
    if (my > 2.625) return P.timberD;
    return inPane ? 0 : P.timber;
  };
  for (let x = X(0); x < X(16); x++) for (let y = Y(0.125); y < Y(2.75); y++) for (const z of [Z(-3.375), Z(-3.25)]) {
    const px = mx(x), my = myOf(y);
    if (px > 12.75 && px < 14.0 && my > 0.25) { G.set(x, y, z, 0); continue; }
    const frame = Math.abs(px - 12.69) < 0.07 || Math.abs(px - 14.06) < 0.07;
    G.set(x, y, z, frame ? P.timberD : glassWall(consPanes.some(([a, b]) => px > a && px < b), z === Z(-3.375), my, x));
  }
  for (const [a, b] of consPanes) meta.glass.push({ axis: 'z', z: -3.25, x0: a, x1: b, y0: 1.0, y1: 2.625 });
  for (const xs of [[X(0), X(0.125)], [X(15.75), X(15.875)]]) for (const x of xs) for (let z = Z(-3.125); z < Z(0); z++) for (let y = Y(0.125); y < Y(2.75); y++) {
    const pz = mz(z);
    G.set(x, y, z, glassWall(pz > -3.0 && pz < -0.125, x === X(0) || x === X(15.875), myOf(y), z));
  }
  meta.glass.push({ axis: 'x', x: 0.125, z0: -3.0, z1: -0.125, y0: 1.0, y1: 2.625 });
  meta.glass.push({ axis: 'x', x: 15.875, z0: -3.0, z1: -0.125, y0: 1.0, y1: 2.625 });
  B(0.125, 0.875, -3.125, 15.75, 1.0, -2.875, P.hinokiE);            // inside sill (the cat's spot)
  B(12.75, 0.25, -3.125, 14.0, 1.0, -2.875, 0);
  B(12.625, 0.125, -3.75, 14.125, 0.25, -3.125, P.stoneL);           // stone step at the door
  // lean-to roof over the front room: cedar soffit, dark tiles, a thick blanket of snow, icicles at the eave
  for (let z = Z(-4.0); z < Z(0); z++) {
    const d = Z(0) - 1 - z, yr = Y(3.5) - Math.floor(d / 4.5);
    for (let x = X(-0.5); x < X(16.5); x++) {
      G.set(x, yr - 1, z, P.sugi[((x >> 1) + (x & 1)) % 3]);
      G.set(x, yr, z, (x & 1) ? P.tile[0] : P.tile[1]);
      G.set(x, yr + 1, z, z === Z(-4.0) ? P.tileEdge : snowAt(x, z));
      if (z > Z(-3.875) && hash01(x, 7, z) > 0.25) G.set(x, yr + 2, z, snowAt(x + 3, z));
      if (z === Z(-4.0)) {
        G.set(x, yr - 2, z, P.timberD);
        if (hash01(x, 3, 1) > 0.8 && x % 3) { G.set(x, yr - 3, z, P.ice); if (hash01(x, 4, 1) > 0.6) G.set(x, yr - 4, z, P.ice); }
      }
      if (x === X(-0.5) || x === X(16.5) - 1) G.set(x, yr - 2, z, P.timberD);
    }
  }
  // a little gable over the entrance so the door reads from the path
  for (let i = 0; i < 10; i++) {
    const y = Y(3.0) + i, a = X(13.375) - 12 + i, b = X(13.375) + 12 - i;
    for (let z = Z(-4.25); z < Z(-3.25); z++) for (let x = a; x < b; x++) {
      G.set(x, y, z, (x === a || x === b - 1) ? P.tile[0] : (z === Z(-4.25) ? P.timberD : P.sugi[0]));
      if (x === a || x === b - 1) G.set(x, y + 1, z, snowAt(x, z));
    }
  }

  // ---- the kaiten counter: a U. Its long base runs across the room with booths butting up against its front; its
  // east leg runs back to the kitchen pass, where the belt comes out through the wall; a short west return leaves a
  // way into the chef's side, between the counter and the back bar where the tea is made. Stools line both ends.
  const KB = { x0: 2.75, x1: 12.75, z0: 5.75, z1: 6.75 }, KE = { x0: 11.75, x1: 12.75, z0: 6.75, z1: 10.0 }, KW = { x0: 2.75, x1: 3.75, z0: 6.75, z1: 8.0 };
  const CHEF = { x0: 3.75, x1: 11.75, z0: 6.75, z1: 9.25 };
  {
    const inR = (r, px, pz) => px > r.x0 && px < r.x1 && pz > r.z0 && pz < r.z1;
    const inU = (px, pz) => inR(KB, px, pz) || inR(KE, px, pz) || inR(KW, px, pz);
    for (let z = Z(KB.z0); z < Z(KE.z1); z++) for (let x = X(KB.x0); x < X(KB.x1); x++) {
      const px = mx(x), pz = mz(z);
      if (!inU(px, pz)) continue;
      const nb = [[VS, 0], [-VS, 0], [0, VS], [0, -VS]].map(([dx, dz]) => [px + dx, pz + dz]).filter(([qx, qz]) => !inU(qx, qz) && qz < 10.0);
      const lip = nb.some(([qx, qz]) => inR(CHEF, qx, qz)), face = nb.length > 0 && !lip;
      for (let y = Y(0.25); y < Y(1.0); y++) {
        const my = myOf(y);
        G.set(x, y, z, face ? (my < 0.375 ? P.walnutD : ((x + z) % 6 === 0 ? P.timberD : P.oak[((x + z) >> 2) % 3])) : lip ? P.oak[0] : P.timberD);
      }
      G.set(x, Y(1.0), z, face || lip ? P.hinokiE : P.hinoki);
    }
    // raised steps for the stools at the two ends
    B(12.75, 0.25, 5.75, 13.5, 0.375, 9.25, (x, y, z) => (x === X(13.5) - 1 ? P.walnutD : P.oak[2]));
    B(2.0, 0.25, 5.75, 2.75, 0.375, 8.0, (x, y, z) => (x === X(2.0) ? P.walnutD : P.oak[2]));
  }
  // back bar on the chef's side: dark cabinets, a hinoki top, a plank backsplash and the shelf for the tea cups
  B(3.75, 0.25, 9.25, 10.0, 0.95, 10.0, (x, y, z) => (z === Z(9.25) && (x & 7) === 0 ? P.walnutD : P.oak[0]));
  B(3.75, 0.95, 9.125, 10.0, 1.0, 10.0, P.hinoki);
  B(3.75, 1.0, 9.875, 10.0, 2.25, 10.0, (x, y) => ((y & 3) === 0 ? P.timberD : P.sugi[(x >> 3) % 3]));
  B(3.75, 2.25, 9.625, 10.0, 2.375, 10.0, P.walnutD);

  // ---- the genkan inside the door: a stone floor at the east end of the front room, and the register on a counter
  // you can stand behind, between it and the partition
  for (let z = Z(-3.125); z < Z(0); z++) for (let x = X(11.5); x < X(15.75); x++) {
    const row = z >> 2, off = (row & 1) * 2, seam = ((x + off) & 3) === 0 || (z & 3) === 0;
    G.set(x, Y(0.25) - 1, z, seam ? P.stoneD : P.flag[Math.floor(hash01(x >> 2, row, 23) * 3.999)]);
  }
  for (let z = Z(-3.125); z < Z(0); z++) G.set(X(11.5), Y(0.25) - 1, z, P.walnutD);
  B(14.375, 0.25, -1.625, 15.75, 0.875, -1.125, (x, y, z) => (z === Z(-1.625) && (x & 3) === 0 ? P.walnutD : P.oak[1]));
  B(14.25, 0.875, -1.75, 15.75, 1.0, -1.0, (x, y, z) => (x === X(14.25) || z === Z(-1.75) ? P.hinokiE : P.hinoki));
  // a shelf on the back wall for the sake and the daruma, by the restroom door
  B(1.875, 1.875, 9.75, 3.625, 2.0, 10.0, P.walnutD);
  for (const bx of [2.0, 3.375]) B(bx, 1.625, 9.875, bx + 0.125, 1.875, 10.0, P.walnutD);

  // the kitchen pass over the counter's east leg: the belt runs straight through it from the kitchen; heat lamps above
  B(11.375, 1.125, 9.875, 13.75, 2.0, 10.25, 0);
  B(12.75, 1.0, 9.75, 13.75, 1.125, 10.25, P.steel);
  B(11.375, 1.875, 9.875, 13.75, 2.0, 10.25, P.steelD);
  B(11.5, 1.75, 9.875, 13.625, 1.875, 10.125, C('#ff9a50', 1.4, 0.05));
  for (const px of [11.25, 13.75]) B(px, 1.0, 9.875, px + 0.125, 2.125, 10.25, P.timberD);
  // doorways in the back wall: into the kitchen from the chef's side and from the dining room, and the restroom hallway
  for (const [d0, d1] of [[10.0, 11.125], [14.0, 15.125]]) {
    B(d0, 0.25, 9.875, d1, 2.375, 10.25, 0);
    B(d0 - 0.125, 0.25, 9.875, d0, 2.5, 10.0, P.timberD); B(d1, 0.25, 9.875, d1 + 0.125, 2.5, 10.0, P.timberD); B(d0 - 0.125, 2.375, 9.875, d1 + 0.125, 2.5, 10.0, P.timberD);
  }
  B(0.375, 0.25, 9.875, 1.625, 2.375, 10.25, 0);
  B(0.25, 0.25, 9.875, 0.375, 2.5, 10.0, P.walnutD); B(1.625, 0.25, 9.875, 1.75, 2.5, 10.0, P.walnutD); B(0.25, 2.375, 9.875, 1.75, 2.5, 10.0, P.walnutD);

  // ================= back of house (z 10.25..15.75): restroom hallway, two restrooms, the kitchen
  {
    const cream = C('#d8c8a4', 0, 0.04), creamD = C('#b8a47e', 0, 0.04);
    const restClay = [C('#d4bc94', 0, 0.04), C('#cdb48c', 0, 0.04)]; // warm clay plaster in the restrooms
    const ktile = [C('#ecebe4', 0, 0.03), C('#dfded6', 0, 0.03)], kUpper = C('#c8cac4', 0, 0.04);
    const ceilT = C('#e4e2da', 0, 0.04), ceilG = C('#b8b6ae', 0, 0.03);
    const quarry = [C('#8a3a24', 0, 0.07), C('#7a3220', 0, 0.07)], mat = C('#18181a', 0, 0.05);
    const region = (mx, mz) => (mx < 1.75 ? 'hall' : mx < 5.0 ? 'rest' : 'kitchen');
    const wallFinish = (reg, u, y) => {
      const my = myOf(y);
      if (reg === 'hall') return my < 1.125 ? P.oak[(u >> 1) & 1] : my < 1.25 ? P.walnutD : cream;
      // the restrooms: vertical hinoki boards to the dado, a dark rail, warm clay plaster above
      if (reg === 'rest') return my < 1.125 ? ((u & 3) === 0 ? P.hinokiE : P.hinoki) : my < 1.25 ? P.walnutD : restClay[hash01(u >> 1, y >> 1, 41) > 0.5 ? 1 : 0];
      return my < 2.25 ? ktile[((u >> 1) + (y & 1)) & 1] : kUpper;
    };
    // floors
    B(0, -0.25, 10.25, 16, 0.25, 15.75, (x, y, z) => {
      if (y < Y(0.25) - 1) return P.floorSeam;
      const mx = OX + (x + 0.5) * VS, mz = OZ + (z + 0.5) * VS, reg = region(mx, mz);
      if (reg === 'hall') { const row = x >> 1, seg = Math.floor((z + row * 5) / 18); return (z + row * 5) % 18 === 0 ? P.floorSeam : P.floor[Math.floor(hash01(seg, row, 9) * 3.999)]; } // boards
      if (reg === 'rest') { const seam = (x & 3) === 0 || ((z + ((x >> 2) & 1) * 2) & 3) === 0; return seam ? P.stoneD : P.flag[Math.floor(hash01(x >> 2, z >> 2, 31) * 3.999)]; } // slate
      if (mz > 14.0 && mz < 14.875 && mx > 6.0 && mx < 14.75) return ((x + z) % 3 === 0) ? quarry[0] : mat; // rubber mat at the line
      return quarry[((x >> 1) + (z >> 1)) & 1];
    });
    // shell: outer walls (inside faces), back of the dining-room wall, ceiling with acoustic tiles
    B(0.125, 0.25, 10.25, 0.25, 3.0, 15.75, (x, y, z) => wallFinish('hall', z, y));
    B(15.75, 0.25, 10.25, 15.875, 3.0, 15.75, (x, y, z) => wallFinish('kitchen', z, y));
    B(15.875, 0.25, 10.25, 16, 3.5, 16, (x, y, z) => yakisugi(z, myOf(y)));
    B(0, 0.125, 10.25, 0.125, 3.5, 16, (x, y, z) => yakisugi(z, myOf(y)));
    B(0, 0.25, 15.875, 16, 3.5, 16, (x, y, z) => yakisugi(x, myOf(y)));
    B(0.25, 0.25, 15.75, 15.75, 3.0, 15.875, (x, y) => wallFinish(region(OX + (x + 0.5) * VS, 15), x, y));
    for (let x = X(0.25); x < X(15.75); x++) for (let y = Y(0.25); y < Y(3.0); y++) {
      if (G.get(x, y, Z(10.125)) === 0) continue; // keep the doorways and pass open
      G.set(x, y, Z(10.125), wallFinish(region(OX + (x + 0.5) * VS, 11), x, y));
    }
    B(0.25, 3.0, 10.25, 15.75, 3.125, 15.75, (x, y, z) => (mx(x) < 5.0 ? ((x & 3) === 0 ? P.timberD : P.sugi[(z >> 3) % 3]) : (x & 3) === 0 || (z & 3) === 0 ? ceilG : ceilT));
    B(0, 3.125, 10.25, 16, 3.75, 16, P.plasterD);
    // interior walls: hallway | restrooms | kitchen, restroom divider
    // two-voxel shared walls so each side gets its own finish
    B(1.75, 0.25, 10.25, 1.875, 3.0, 15.75, (x, y, z) => wallFinish('hall', z, y));
    B(1.875, 0.25, 10.25, 2.0, 3.0, 15.75, (x, y, z) => wallFinish('rest', z, y));
    B(1.75, 0.25, 11.0, 2.0, 2.25, 12.0, 0); B(1.75, 0.25, 13.75, 2.0, 2.25, 14.75, 0);
    B(1.75, 2.25, 10.9, 1.875, 2.375, 12.1, P.walnutD); B(1.75, 2.25, 13.65, 1.875, 2.375, 14.85, P.walnutD);
    B(2.0, 0.25, 13.0, 4.875, 3.0, 13.125, (x, y, z) => wallFinish('rest', x, y));
    B(4.875, 0.25, 10.25, 5.0, 3.0, 15.75, (x, y, z) => wallFinish('rest', z, y));
    B(5.0, 0.25, 10.25, 5.125, 3.0, 15.75, (x, y, z) => wallFinish('kitchen', z, y));
    // hallway end: the back door (a door panel in main.js; snowed shut until you dig it out), a step outside
    B(0.375, 0.25, 15.625, 1.625, 2.25, 16.0, 0);
    B(0.25, 0.25, 15.625, 0.375, 2.375, 16.0, P.steelD); B(1.625, 0.25, 15.625, 1.75, 2.375, 16.0, P.steelD); B(0.25, 2.25, 15.625, 1.75, 2.375, 16.0, P.steelD);
    B(0.25, 0.125, 16.0, 1.75, 0.25, 16.5, P.stoneL);
    // square washi ceiling lamps in the restrooms and the hall
    const washi = (x0, z0, s) => B(x0, 2.875, z0, x0 + s, 3.0, z0 + s, (x, y, z) => (x === X(x0) || z === Z(z0) || x === X(x0 + s) - 1 || z === Z(z0 + s) - 1 ? P.timberD : C('#ffe2b0', 1.6, 0.04)));
    for (const lz of [11.375, 14.125]) washi(3.125, lz, 0.75);
    washi(0.75, 12.75, 0.5);
    meta.lights.push({ pos: [3.45, 2.6, 13.06], color: 0xffd8a8, intensity: 3.2, distance: 5.5, name: 'restrooms' });

    // ---- kitchen: cook line under a big hood, prep island, plating shelf, dish station, walk-in, dry storage
    B(6.0, 2.25, 14.25, 14.75, 3.0, 15.75, (x, y, z) => (y === Y(2.25) && z === Z(14.375) && (x % 10 < 3) ? C('#fff4d8', 3.0, 0.03) : P.steel));
    // a small prep table, clear of the plating station so there's room to work at the rice cookers
    B(7.25, 0.75, 12.5, 10.5, 0.875, 13.25, P.steel);                       // prep table top
    B(7.375, 0.375, 12.625, 10.375, 0.5, 13.125, P.steelD);                 // undershelf
    for (const [lx, lz] of [[7.25, 12.5], [10.375, 12.5], [7.25, 13.125], [10.375, 13.125]]) B(lx, 0.25, lz, lx + 0.125, 0.75, lz + 0.125, P.steelD);
    B(11.375, 0.25, 10.25, 13.875, 1.125, 11.25, (x, y, z) => (y === Y(1.125) - 1 ? P.steel : P.steelD)); // plating station under the pass, level with the belt: the sushi case, the rice
    // dish station: three-well sink against the restroom wall
    B(5.125, 0.25, 10.75, 5.875, 0.875, 13.75, (x, y, z) => (y === Y(0.25) ? P.black : P.steel));
    B(5.125, 0.875, 10.75, 5.25, 1.375, 13.75, P.steel);
    for (const [a, b] of [[10.875, 11.75], [11.875, 12.75], [12.875, 13.625]]) {
      B(5.25, 0.75, a, 5.75, 0.875, b, 0);
      B(5.25, 0.625, a, 5.75, 0.75, b, C('#7a9aa8', 0, 0.06));
    }
    // the walk-in freezer's doorway on the east wall (the door is a panel in main.js, shut until you get it running)
    B(15.75, 0.25, 11.0, 16.125, 2.25, 12.25, 0);
    B(15.625, 0.25, 10.875, 15.75, 2.375, 11.0, P.steelD); B(15.625, 0.25, 12.25, 15.75, 2.375, 12.375, P.steelD); B(15.625, 2.25, 10.875, 15.75, 2.375, 12.375, P.steelD);
    // dry storage rack
    {
      const goods = ['#c83a2a', '#e8e4d8', '#8a6a44', '#e8c040', '#3a6a3a', '#e8e8e8'].map((h) => C(h, 0, 0.1));
      for (const [px, pz] of [[15.25, 12.75], [15.625, 12.75], [15.25, 14.0], [15.625, 14.0]]) B(px, 0.25, pz, px + 0.125, 2.25, pz + 0.125, P.chrome);
      for (const sy of [0.5, 1.0, 1.5, 2.0]) {
        B(15.25, sy, 12.75, 15.75, sy + 0.125, 14.125, P.chrome);
        for (let z = Z(12.875); z < Z(14.0); z++) if (hash01(z, Y(sy), 1) > 0.25) {
          const g = goods[Math.floor(hash01(z, Y(sy), 2) * 5.99)];
          G.set(X(15.375), Y(sy) + 1, z, g); G.set(X(15.5), Y(sy) + 1, z, g);
          if (hash01(z, Y(sy), 3) > 0.5) G.set(X(15.5), Y(sy) + 2, z, g);
        }
      }
    }
    // fluorescent strips
    for (const fx of [7.5, 11.0]) B(fx, 2.875, 12.375, fx + 1.5, 3.0, 12.5, C('#f4f8ff', 2.0, 0.03));
    meta.lights.push({ pos: [8.0, 2.5, 12.8], color: 0xffeccc, intensity: 3.5, distance: 8, name: 'kitchenA' });
    meta.lights.push({ pos: [12.6, 2.5, 12.8], color: 0xffeccc, intensity: 3.5, distance: 8, name: 'kitchenB' });
  }
  meta.lights.push({ pos: [3.4, 2.0, -1.6], color: 0xffa860, intensity: 5, distance: 7, name: 'consL' });
  meta.lights.push({ pos: [8.6, 2.0, -1.6], color: 0xffa860, intensity: 5, distance: 7, name: 'consR' });
  meta.lights.push({ pos: [5.0, 2.6, 6.2], color: 0xffb070, intensity: 6, distance: 8, name: 'chandA' });
  meta.lights.push({ pos: [10.0, 2.6, 6.2], color: 0xffb070, intensity: 6, distance: 8, name: 'chandB' });
  meta.lights.push({ pos: [3.5, 2.3, 1.3], color: 0xffc890, intensity: 4, distance: 6, name: 'boothsFront' });
  meta.lights.push({ pos: [9.6, 2.3, 1.3], color: 0xffc890, intensity: 4, distance: 6, name: 'boothsWest' });
  meta.lights.push({ pos: [5.5, 2.4, 8.4], color: 0xffc898, intensity: 3.6, distance: 7, name: 'counterL' });
  meta.lights.push({ pos: [9.5, 2.4, 8.4], color: 0xffc898, intensity: 3.6, distance: 7, name: 'counterR' });
  meta.lights.push({ pos: [13.6, 2.1, -1.5], color: 0xffc080, intensity: 3.5, distance: 5, name: 'genkan' });

  // ------------------------------------------------------------ upstairs (the apartment) and the big roof
  const upper = (u, y) => {
    const my = myOf(y);
    if (my < 3.75 || my > 6.875) return P.timberD;      // floor beam, wall plate
    if (u % 16 === 0) return P.timber;                  // posts
    if (Math.abs(my - 5.0) < 0.07) return P.timber;     // rail under the windows
    return P.plaster[(u >> 4) & 1];
  };
  B(0, 3.5, 0, 16, 7.0, 0.25, (x, y) => upper(x, y));
  B(0, 3.5, 15.75, 16, 7.0, 16, (x, y) => upper(x, y));
  B(0, 3.5, 0, 0.25, 7.0, 16, (x, y, z) => upper(z, y));
  B(15.75, 3.5, 0, 16, 7.0, 16, (x, y, z) => upper(z, y));
  // shoji windows: a timber lattice in front, lamp-lit paper behind it (some rooms dark).
  // lit 'glass': a plain timber frame with glass, so the apartment can look out over the bay.
  const shojiWindow = (axis, plane, out, c0, c1, y0, y1, lit) => {
    const ua = axis === 'z' ? X(c0) : Z(c0), ub = axis === 'z' ? X(c1) : Z(c1);
    for (let u = ua; u < ub; u++) for (let y = Y(y0); y < Y(y1); y++) {
      const lu = u - ua, ly = y - Y(y0), edge = lu === 0 || lu === ub - ua - 1 || ly === 0 || ly === Y(y1) - Y(y0) - 1;
      const a = axis === 'z' ? [u, y, plane] : [plane, y, u], b = axis === 'z' ? [u, y, plane - out] : [plane - out, y, u];
      if (lit === 'glass') { const bar = edge || lu === ((ub - ua) >> 1); G.set(...a, bar ? P.lattice : 0); G.set(...b, edge ? P.lattice : 0); continue; }
      const grid = edge || lu % 3 === 0 || ly % 4 === 0;
      const paper = lit === 2 ? P.shoji : lit === 1 ? P.shojiDim : P.shojiDark;
      G.set(...a, grid ? P.lattice : 0);
      G.set(...b, paper);
    }
    if (lit === 'glass') {
      const mid = OX + (plane + (out < 0 ? 1 : 0)) * VS;
      if (axis === 'z') meta.glass.push({ axis: 'z', z: OZ + (plane + (out < 0 ? 1 : 0)) * VS, x0: c0 + 0.125, x1: c1 - 0.125, y0: y0 + 0.125, y1: y1 - 0.125 });
      else meta.glass.push({ axis: 'x', x: mid, z0: c0 + 0.125, z1: c1 - 0.125, y0: y0 + 0.125, y1: y1 - 0.125 });
    }
    // sill
    for (let u = ua - 1; u < ub + 1; u++) { const p = axis === 'z' ? [u, Y(y0) - 1, plane + out] : [plane + out, Y(y0) - 1, u]; G.set(...p, P.timberD); }
  };
  const ZF = Z(0), ZB = Z(16) - 1, XW = X(0), XE = X(16) - 1;
  // the apartment takes the front-east corner (x 5.5..16, z 0..8.75); the rest of the upstairs is the shop's dark storeroom
  for (const [c0, c1] of [[6.0, 8.25], [8.5, 10.75], [11.0, 13.25], [13.5, 15.5]]) shojiWindow('z', ZF, -1, c0, c1, 3.875, 6.25, 'glass'); // the engawa's tall glass
  for (const [c, lit] of [[3.0, 0], [7.5, 0], [12.5, 0]]) shojiWindow('x', XW, -1, c - 0.75, c + 0.75, 5.25, 6.375, lit);
  for (const [c, lit] of [[3.75, 1], [11.5, 0]]) shojiWindow('x', XE, 1, c - 0.75, c + 0.75, 5.0, 6.25, lit);
  for (const [c, lit] of [[4.0, 0], [11.0, 0]]) shojiWindow('z', ZB, 1, c - 0.75, c + 0.75, 5.25, 6.375, lit);
  meta.lights.push({ pos: [2.5, 5.8, -1.2], color: 0xffa860, intensity: 2.5, distance: 5, name: 'upstairs' });

  // the shop's name board (kanban) above the front room's roof: dark cedar, lamp-lit letters
  {
    const str = 'YOAKE', w = textWidth(str);
    const SX0 = 3.0; // over the booth room, where the storeroom's blank wall is
    const xa = X(SX0) - 20, xb = X(SX0) + 20, ya = Y(3.75) + 1, yb = ya + 11;
    for (let x = xa; x < xb; x++) for (let y = ya; y < yb; y++) for (const z of [ZF - 1, ZF - 2]) {
      const edge = x === xa || x === xb - 1 || y === ya || y === yb - 1;
      G.set(x, y, z, edge ? P.hinokiE : P.timberD);
    }
    const u0 = X(SX0) + Math.floor(w / 2);
    glyphPixels(str, (c, r) => G.set(u0 - c, yb - 3 - r, ZF - 2, P.kanbanInk));
    // the little lamps that light it
    for (const lx of [SX0 - 2, SX0 + 2]) { B(lx - 0.0625, myOf(yb) + 0.125, -0.5, lx + 0.0625, myOf(yb) + 0.25, -0.125, P.black); G.set(X(lx), yb + 1, Z(-0.5), P.lantern); }
    meta.lights.push({ pos: [SX0, 4.7, -1.4], color: 0xffc080, intensity: 4.5, distance: 6, name: 'kanban' });
  }

  // gable roof (ridge along x at z 8): dark tiles under a thick blanket of snow, icicles at the eaves
  {
    const xa = X(-0.75), xb = X(16.75), za = Z(-0.75), zbAll = Z(16.75);
    const eave = Y(7.0), slope = 0.45;
    for (let z = za; z < Math.min(SZ, zbAll); z++) {
      const d = Math.min(z - za, zbAll - 1 - z), yr = eave + Math.floor(d * slope);
      const ridge = Math.abs(mz(z) - 8.0) < 0.2;
      for (let x = xa; x < xb; x++) {
        G.set(x, yr - 1, z, P.timberD);
        G.set(x, yr, z, ((x >> 1) & 1) ? P.tile[0] : P.tile[1]);
        const edgeRow = z === za || x === xa || x === xb - 1;
        if (edgeRow) { G.set(x, yr + 1, z, P.tileEdge); if (z !== za || hash01(x, 2, 2) > 0.5) G.set(x, yr + 2, z, snowAt(x, z)); }
        else {
          G.set(x, yr + 1, z, snowAt(x, z)); G.set(x, yr + 2, z, snowAt(x + 5, z));
          if (vnoise(x, z, 9, 8) > 0.55) G.set(x, yr + 3, z, snowAt(x, z + 2));
        }
        if (ridge) { G.set(x, yr + 1, z, P.tileEdge); G.set(x, yr + 2, z, P.tileEdge); G.set(x, yr + 3, z, snowAt(x, z)); G.set(x, yr + 4, z, snowAt(x, z + 1)); }
        if (z === za && x % 2 && hash01(x, 9, 9) > 0.55) { const n = 1 + Math.floor(hash01(x, 10, 9) * 4); for (let i = 0; i < n; i++) G.set(x, yr - 2 - i, z, P.ice); }
      }
      // gable ends: plaster triangles framed in timber
      if (mz(z) > 0) for (const x of [X(0), X(0) + 1, X(16) - 2, X(16) - 1]) for (let y = eave; y < yr - 1; y++) {
        const pz = mz(z);
        G.set(x, y, z, (y === yr - 2 || Math.abs(pz - 8.0) < 0.07 || y === eave) ? P.timber : P.plaster[0]);
      }
    }
    // stovepipe from the kitchen, puffing
    B(10.375, 7.25, 14.875, 10.625, 9.5, 15.125, P.steelD);
    B(10.25, 9.5, 14.75, 10.75, 9.625, 15.25, P.steel);
    meta.steam.push({ pos: [10.5, 9.7, 15.0], size: 1.4 });
  }

  // ------------------------------------------------------------ the apartment upstairs: you live above the shop
  // A small, old-fashioned flat in the front-east corner, reached by an outdoor wooden stair up the east side:
  // an engawa along the bay windows, an eight-mat living room with a tokonoma, a bedroom behind fusuma, and at the
  // back a wood-floored room, a kitchen corner and a stone genkan for your boots.
  {
    const F2 = 3.75, AX0 = 5.75, AZ1 = 8.5;
    const tatami = [C('#b8b47a', 0, 0.04), C('#aaa66c', 0, 0.04)], tatamiEdge = C('#2a3a2a', 0, 0.04);
    const room = (px, pz) => (px < AX0 || pz > AZ1 ? 'store' : pz < 1.625 ? 'engawa' : pz < 5.5 ? (px < 11.0 ? 'living' : 'bed') : px > 14.0 ? 'genkan' : 'boards');
    B(0.25, 3.625, 0.25, 15.75, 3.75, 15.75, (x, y, z) => {
      const px = mx(x), pz = mz(z), r = room(px, pz);
      if (r === 'store' || r === 'boards') return P.sugi[(z >> 1) % 3];
      if (r === 'engawa') return (x & 7) === 0 ? P.sugi[1] : P.hinoki;                // polished boards along the glass
      if (r === 'genkan') return (x + z) & 1 ? P.stone : P.stoneD;
      // tatami: 0.875 x 1.75 mats in a running pattern with dark cloth borders
      const ox = r === 'living' ? AX0 : 11.125, oz = 1.75;
      const row = Math.floor((pz - oz) / 0.875), off = row & 1 ? 0.875 : 0, col = Math.floor((px - ox + off) / 1.75);
      const lu = (px - ox + off) - col * 1.75, lv = (pz - oz) - row * 0.875;
      if (lu < 0.13 || lv < 0.13) return tatamiEdge;
      return tatami[(x + z) & 1];
    });
    // inside, the walls are warm clay plaster (tsuchikabe) between the timbers
    const clay = [C('#c89a6a', 0, 0.05), C('#bf9062', 0, 0.05)];
    const plasterSet = new Set(P.plaster);
    const inner = (x, y, z) => { const v = G.get(x, y, z); if (plasterSet.has(v)) G.set(x, y, z, clay[(x + y + z) & 1]); };
    for (let y = Y(F2); y < Y(7.0); y++) {
      for (let x = X(AX0); x < X(15.75); x++) inner(x, y, Z(0) + 1);
      for (let z = Z(0.25); z < Z(AZ1); z++) inner(X(16) - 2, y, z);
    }
    // ranma: a lattice transom between the lintels and the ceiling, rails top and bottom and slats every half foot
    const ranma = (u, y) => (y === Y(F2 + 2.125) || y === Y(6.375) - 1 || u % 4 === 0 ? P.lattice : 0);
    const wallC = (u, y) => { const my = myOf(y); return my < F2 + 0.125 ? P.timberD : u % 14 === 0 || Math.abs(my - (F2 + 1.875)) < 0.07 ? P.timber : clay[(u + y) & 1]; };
    // the flat's own walls, shutting off the storeroom: west and back
    B(AX0 - 0.25, F2, 0.25, AX0, 6.5, AZ1 + 0.25, (x, y, z) => wallC(z, y));
    B(AX0 - 0.25, F2, AZ1, 15.75, 6.5, AZ1 + 0.25, (x, y) => wallC(x, y));
    // a board ceiling on thin battens
    B(AX0, 6.375, 0.25, 15.75, 6.5, AZ1, (x, y, z) => ((x & 3) === 0 ? P.timberD : P.sugi[(z >> 3) % 3]));
    // shoji between the engawa and the rooms, slid open in two places
    const shojiRow = (x0, x1) => {
      for (let x = X(x0); x < X(x1); x++) for (let y = Y(F2); y < Y(F2 + 2.0); y++) {
        const lu = x - X(x0), ly = y - Y(F2), frame = ly === 0 || ly === Y(F2 + 2.0) - Y(F2) - 1 || lu === 0 || lu === X(x1) - X(x0) - 1;
        const grid = frame || lu % 3 === 0 || ly % 4 === 0 || ly < 4;
        G.set(x, y, Z(1.625), grid ? P.lattice : P.shoji);
      }
    };
    for (const [x0, x1] of [[AX0, 6.75], [9.25, 11.875], [14.125, 15.75]]) shojiRow(x0, x1);
    B(AX0, F2 + 2.0, 1.625, 15.75, F2 + 2.125, 1.75, P.timberD);                       // the lintel over them
    for (let x = X(AX0); x < X(15.75); x++) for (let y = Y(F2 + 2.125); y < Y(6.375); y++) G.set(x, y, Z(1.625), ranma(x, y));
    // fusuma between the living room and the bedroom, with a painted wave, one panel slid aside
    const fus = C('#efe4cc', 0, 0.03), fusInk = C('#3a5a8a', 0, 0.04), fusFrame = C('#2a1a10', 0, 0.04);
    const fusuma = (along, c0, c1, plane, gap) => {
      for (let u = (along === 'z' ? Z(c0) : X(c0)); u < (along === 'z' ? Z(c1) : X(c1)); u++) for (let y = Y(F2); y < Y(F2 + 2.0); y++) {
        const pu = along === 'z' ? mz(u) : mx(u), ly = y - Y(F2), lu = u - (along === 'z' ? Z(c0) : X(c0));
        if (gap && pu > gap[0] && pu < gap[1]) continue;
        const frame = ly === 0 || ly === Y(F2 + 2.0) - Y(F2) - 1 || lu % 14 === 0;
        const wave = Math.abs(ly - 5 - Math.sin(lu * 0.45) * 2) < 0.8;
        G.set(...(along === 'z' ? [plane, y, u] : [u, y, plane]), frame ? fusFrame : wave ? fusInk : fus);
      }
    };
    fusuma('z', 1.75, 5.5, X(11.0), [2.875, 3.875]);
    B(11.0, F2 + 2.0, 1.75, 11.125, F2 + 2.125, 5.5, P.timberD);
    for (let z = Z(1.75); z < Z(5.5); z++) for (let y = Y(F2 + 2.125); y < Y(6.375); y++) G.set(X(11.0), y, z, ranma(z, y));
    // behind the bedroom, a closet (oshiire) behind fusuma; behind the living room it opens wide into the back room,
    // under a lintel with a lattice transom (ranma), so the two read as one L-shaped space
    B(AX0, F2, 5.5, 15.75, 6.375, 5.625, (x, y) => wallC(x, y));
    B(7.625, F2, 5.5, 11.0, F2 + 2.0, 5.625, 0);
    B(7.625, F2 + 2.0, 5.5, 11.0, F2 + 2.125, 5.625, P.timberD);
    for (let x = X(7.625); x < X(11.0); x++) for (let y = Y(F2 + 2.125); y < Y(6.375); y++) G.set(x, y, Z(5.5), ranma(x, y));
    B(11.25, F2, 4.875, 13.75, F2 + 2.0, 5.5, P.timberD);                               // the closet's bulk
    fusuma('x', 11.25, 13.75, Z(4.75), null);
    // the tokonoma: a raised alcove in the living room's back corner for a scroll and a flower
    B(AX0, F2, 4.75, 7.5, F2 + 0.125, 5.5, P.walnutD);
    B(7.5, F2, 4.75, 7.625, F2 + 2.0, 5.5, P.walnutD);                                 // its post (tokobashira)
    B(AX0, F2 + 2.0, 4.75, 7.625, F2 + 2.25, 5.5, P.timberD);
    // a step down into the genkan
    B(14.0, F2 - 0.125, 5.625, 14.125, F2, AZ1, P.walnutD);
    // the doorway out to the stair landing, in the east wall
    B(15.75, F2, 6.5, 16, F2 + 2.125, 7.5, 0);
    B(15.75, F2 + 2.125, 6.375, 16, F2 + 2.25, 7.625, P.timberD);
    for (const z of [6.375, 7.5]) B(15.75, F2, z, 16, F2 + 2.125, z + 0.125, P.timberD);
    // outdoor stair: treads rising north along the east wall from the front path, a landing at the door
    const sz0 = -0.5, sz1 = 6.0;
    for (let z = Z(sz0); z < Z(sz1); z++) {
      const k = (mz(z) - sz0) / (sz1 - sz0), ty = Y(0.125 + k * (F2 - 0.125));
      for (let x = X(16.25); x < X(17.5); x++) {
        G.set(x, ty - 1, z, P.wood[1]); G.set(x, ty - 2, z, P.timberD);
        const edge = x === X(16.25) || x === X(17.5) - 1;
        if (edge && hash01(x, ty, z) > 0.3) G.set(x, ty, z, snowAt(x, z));   // snow banked at the edges
      }
      for (const x of [X(16.25), X(17.5) - 1]) for (let y = Math.max(Y(0.125), ty - 5); y < ty - 2; y++) G.set(x, y, z, P.timberD); // stringers
    }
    for (const z of [0.5, 2.5, 4.5]) { // posts under the stringers
      const k = (z - sz0) / (sz1 - sz0), top = 0.125 + k * (F2 - 0.125) - 0.375;
      for (const x of [16.25, 17.375]) B(x, 0.125, z, x + 0.125, top, z + 0.125, P.timber);
    }
    B(16.0, F2 - 0.25, 6.0, 17.75, F2, 8.0, (x, y) => (y === Y(F2) - 1 ? P.wood[0] : P.timberD));   // landing
    for (const [x, z] of [[16.0, 7.875], [17.625, 6.0], [17.625, 7.875]]) B(x, 0.125, z, x + 0.125, F2 - 0.25, z + 0.125, P.timber);
    // railings: outer side of the stair and round the landing
    for (let z = Z(sz0); z < Z(sz1); z += 1) {
      const k = (mz(z) - sz0) / (sz1 - sz0), ty = Y(0.125 + k * (F2 - 0.125));
      G.set(X(17.5), ty + 7, z, P.timber);
      if ((z - Z(sz0)) % 8 === 0) for (let y = ty; y < ty + 7; y++) G.set(X(17.5), y, z, P.timber);
    }
    B(17.625, F2, 6.0, 17.75, F2 + 0.875, 8.0, (x, y, z) => (y === Y(F2 + 0.875) - 1 || (z & 3) === 0 ? P.timber : 0));
    B(16.0, F2, 7.875, 17.75, F2 + 0.875, 8.0, (x, y) => (y === Y(F2 + 0.875) - 1 || (x & 3) === 0 ? P.timber : 0));
    snowCap(16.0, 17.8, 6.0, 8.05, F2, F2 + 1.2, 0.7);
    meta.lights.push({ pos: [16.35, 5.7, 7.0], color: 0xffb070, intensity: 2.2, distance: 5, name: 'aptDoor' });
    meta.lights.push({ pos: [8.4, 5.6, 3.2], color: 0xffa860, intensity: 5.5, distance: 8, name: 'aptLiving' });
    meta.lights.push({ pos: [12.2, 4.4, 4.2], color: 0xff9a50, intensity: 3, distance: 5, name: 'aptBed' });
    meta.lights.push({ pos: [12.4, 5.6, 7.0], color: 0xffd8a8, intensity: 4, distance: 6, name: 'aptKitchen' });
  }

  // ------------------------------------------------------------ the old storehouse (kura) east of the shop
  {
    const x0 = 21, x1 = 27, z0 = 3, z1 = 9;
    B(x0 - 0.125, 0.125, z0 - 0.125, x1 + 0.125, 0.5, z1 + 0.125, (x, y, z) => (((x >> 2) + (z >> 2) + y) & 1 ? P.stone : P.stoneD));
    const wall = (u, y) => {
      const my = myOf(y);
      if (my < 1.5) { const a = (u + y) & 3, b = (u - y) & 3; return a === 0 || b === 0 ? P.plaster[0] : P.tile[1]; } // namako-kabe
      if (my > 3.75) return P.timberD;
      return P.plaster[(y >> 4) & 1];
    };
    B(x0, 0.5, z0, x1, 4.0, z0 + 0.25, (x, y) => wall(x, y));
    B(x0, 0.5, z1 - 0.25, x1, 4.0, z1, (x, y) => wall(x, y));
    B(x0, 0.5, z0, x0 + 0.25, 4.0, z1, (x, y, z) => wall(z, y));
    B(x1 - 0.25, 0.5, z0, x1, 4.0, z1, (x, y, z) => wall(z, y));
    // heavy door and a small shuttered window facing the path
    // inside: wide floorboards, a timber wainscot and plaster on the walls, a board ceiling under the roof
    B(x0 + 0.25, 0.375, z0 + 0.25, x1 - 0.25, 0.5, z1 - 0.25, (x, y, z) => ((z >> 1) % 5 === 0 ? P.timberD : P.wood[(x >> 3) & 1]));
    for (let y = Y(0.5); y < Y(4.0); y++) {
      const c = (u) => (myOf(y) < 1.375 ? (u % 6 === 0 ? P.timberD : P.wood[0]) : myOf(y) < 1.5 ? P.timberD : P.plaster[(u >> 3) & 1]);
      for (let x = X(x0 + 0.25); x < X(x1 - 0.25); x++) { if (G.get(x, y, Z(z0) + 1)) G.set(x, y, Z(z0) + 1, c(x)); G.set(x, y, Z(z1) - 2, c(x)); }
      for (let z = Z(z0 + 0.25); z < Z(z1 - 0.25); z++) { G.set(X(x0) + 1, y, z, c(z)); G.set(X(x1) - 2, y, z, c(z)); }
    }
    B(x0 + 0.25, 3.75, z0 + 0.25, x1 - 0.25, 3.875, z1 - 0.25, (x) => ((x & 3) === 0 ? P.timberD : P.sugi[(x >> 3) % 3]));
    // (the door itself is a sliding panel in main.js, shut until you restore the place)
    B(23.25, 0.5, z0, 24.75, 2.625, z0 + 0.25, 0);
    B(23.0, 2.625, z0 - 0.25, 25.0, 2.875, z0, P.tile[0]);
    B(22.875, 0.125, z0 - 0.75, 25.125, 0.25, z0 - 0.125, (x, y, z) => ((x + z) & 1 ? P.stone : P.stoneD)); // a stone step
    B(23.5, 3.0, z0 - 0.125, 24.5, 3.5, z0, P.black);
    // roof
    const eave = Y(4.0), za = Z(z0 - 0.5), zb = Z(z1 + 0.5);
    for (let z = za; z < zb; z++) {
      const d = Math.min(z - za, zb - 1 - z), yr = eave + Math.floor(d * 0.5);
      for (let x = X(x0 - 0.5); x < X(x1 + 0.5); x++) {
        G.set(x, yr - 1, z, P.timberD); G.set(x, yr, z, ((x >> 1) & 1) ? P.tile[0] : P.tile[1]);
        G.set(x, yr + 1, z, z === za || z === zb - 1 ? P.tileEdge : snowAt(x, z));
        if (z !== za && z !== zb - 1) G.set(x, yr + 2, z, snowAt(x + 3, z));
        if ((z === za || z === zb - 1) && x % 3 === 1 && hash01(x, z, 4) > 0.5) G.set(x, yr - 2, z, P.ice);
      }
      for (const x of [X(x0), X(x1) - 1]) for (let y = eave; y < yr - 1; y++) G.set(x, y, z, P.plaster[1]);
    }
  }

  // ------------------------------------------------------------ a small shrine on the west slope: torii, a hokora, a stone lantern
  {
    const tx = -5.0, za = 1.75, zb = 4.25;
    for (const z of [za, zb]) {
      B(tx - 0.125, 0.125, z - 0.125, tx + 0.125, 0.375, z + 0.125, P.black);
      B(tx - 0.125, 0.375, z - 0.125, tx + 0.125, 3.0, z + 0.125, P.vermilion);
    }
    B(tx - 0.125, 2.375, za - 0.375, tx + 0.125, 2.5, zb + 0.375, P.vermilion);              // nuki
    B(tx - 0.1875, 2.875, za - 0.625, tx + 0.1875, 3.125, zb + 0.625, P.vermilionD);           // kasagi
    B(tx - 0.1875, 3.125, za - 0.75, tx + 0.1875, 3.25, zb + 0.75, P.black);
    for (const z of [za - 0.875, zb + 0.75]) B(tx - 0.1875, 3.25, z, tx + 0.1875, 3.375, z + 0.125, P.black); // upturned ends
    B(tx - 0.0625, 2.5, (za + zb) / 2 - 0.125, tx + 0.0625, 2.875, (za + zb) / 2 + 0.125, P.black); // plaque
    snowCap(tx - 0.5, tx + 0.5, za - 1, zb + 1, 2.0, 3.6, 0.95);
    // hokora
    const hx = -8.0, hz = 3.0;
    B(hx - 0.5, 0.125, hz - 0.5, hx + 0.5, 0.5, hz + 0.5, P.stone);
    B(hx - 0.375, 0.5, hz - 0.375, hx + 0.375, 1.25, hz + 0.375, (x, y, z) => (x === X(hx + 0.375) - 1 && myOf(y) < 1.0 && Math.abs(mz(z) - hz) < 0.2 ? P.lantern : P.wood[(y >> 1) & 1]));
    for (let i = 0; i < 3; i++) B(hx - 0.625 + i * 0.125, 1.25 + i * 0.125, hz - 0.625 + i * 0.125, hx + 0.625 - i * 0.125, 1.375 + i * 0.125, hz + 0.625 - i * 0.125, P.tile[i & 1]);
    snowCap(hx - 0.8, hx + 0.8, hz - 0.8, hz + 0.8, 1.0, 2.0, 1);
    meta.lights.push({ pos: [hx + 0.7, 0.9, hz], color: 0xffa050, intensity: 1.2, distance: 3.5, name: 'shrine' });
    // the offering box in front, slatted on top
    B(hx + 0.75, 0.125, hz - 0.3125, hx + 1.125, 0.5, hz + 0.3125, (x, y, z) => (y === Y(0.5) - 1 && (z & 1) ? P.walnutD : P.wood[(y >> 1) & 1]));
    snowCap(hx + 0.75, hx + 1.125, hz - 0.3125, hz + 0.3125, 0.4, 0.8, 0.5);
    // a straw rope under the torii's nuki, with paper shide hanging from it
    B(tx - 0.0625, 2.25, za + 0.125, tx + 0.0625, 2.375, zb - 0.125, P.straw);
    for (const z of [2.375, 3.0, 3.625]) for (let i = 0; i < 4; i++) B(tx - 0.0625, 2.125 - i * 0.125, z + (i & 1) * 0.0625 - 0.0625, tx + 0.0625, 2.25 - i * 0.125, z + (i & 1) * 0.0625 + 0.0625, P.paper);
  }

  // a low bamboo fence where the lot ends, to the west and along the back
  {
    const fx = -11.75, fz = 17.6, fe = 33.5;
    const pole = (x, y, z) => ((x + z) % 12 === 0 ? P.bambooNode : P.bamboo[(x + z) & 1]);
    for (let z = L.cliff + 0.75; z < fz; z += 1.25) B(fx - 0.0625, 0.125, z, fx + 0.0625, 1.25, z + 0.125, P.bambooNode);
    for (let x = fx; x < fe; x += 1.25) B(x, 0.125, fz - 0.0625, x + 0.125, 1.25, fz + 0.0625, P.bambooNode);
    for (const y of [0.5, 0.875, 1.125]) {
      B(fx - 0.0625, y, L.cliff + 0.75, fx + 0.0625, y + 0.0625, fz + 0.0625, pole);
      B(fx - 0.0625, y, fz - 0.0625, fe, y + 0.0625, fz + 0.0625, pole);
    }
    snowCap(fx - 0.2, fx + 0.2, L.cliff + 0.75, fz + 0.1, 1.0, 1.5, 0.7);
    snowCap(fx - 0.1, fe, fz - 0.2, fz + 0.2, 1.0, 1.5, 0.7);
  }

  // stone lanterns (toro) along the path
  const toro = (x, z) => {
    B(x - 0.25, 0.125, z - 0.25, x + 0.25, 0.25, z + 0.25, P.stoneD);
    B(x - 0.125, 0.25, z - 0.125, x + 0.125, 0.75, z + 0.125, P.stone);
    B(x - 0.25, 0.75, z - 0.25, x + 0.25, 0.875, z + 0.25, P.stone);
    B(x - 0.1875, 0.875, z - 0.1875, x + 0.1875, 1.25, z + 0.1875, (vx, y, vz) => ((Math.abs(mx(vx) - x) < 0.07 || Math.abs(mz(vz) - z) < 0.07) && myOf(y) > 0.95 && myOf(y) < 1.15 ? P.lantern : P.stone));
    B(x - 0.375, 1.25, z - 0.375, x + 0.375, 1.375, z + 0.375, P.stoneD);
    B(x - 0.25, 1.375, z - 0.25, x + 0.25, 1.5, z + 0.25, P.stoneD);
    B(x - 0.0625, 1.5, z - 0.0625, x + 0.0625, 1.625, z + 0.0625, P.stone);
    snowCap(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 1.2, 2.0, 0.9);
  };
  for (const [x, z] of [[3.5, -5.75], [10.0, -5.75], [20.0, -5.75], [-1.6, 0.5]]) toro(x, z);
  meta.lights.push({ pos: [3.5, 1.1, -5.75], color: 0xffa050, intensity: 1.6, distance: 4, name: 'toroA' });
  meta.lights.push({ pos: [10.0, 1.1, -5.75], color: 0xffa050, intensity: 1.6, distance: 4, name: 'toroB' });
  meta.lights.push({ pos: [-1.6, 1.1, 0.5], color: 0xffa050, intensity: 1.4, distance: 4, name: 'toroC' });

  // firewood stacked under the eave against the east wall, behind the freezer annex
  for (let z = Z(13.5); z < Z(15.75); z++) for (let y = Y(0.125); y < Y(1.25); y++) for (let x = X(16.0); x < X(16.625); x++) {
    const end = x === X(16.625) - 1, ring = Math.hypot(((z & 3) - 1.5), ((y & 3) - 1.5)) < 1.2;
    G.set(x, y, z, end ? (ring ? P.logEnd : P.log) : P.wood[(y >> 2) & 1]);
  }
  snowCap(16.0, 16.75, 13.5, 15.75, 0.5, 1.75, 0.9);

  // a wooden rail where the lot ends at the cliff
  {
    const fz = L.cliff + 0.5;
    for (let x = -16; x < 36; x += 1.5) B(x, 0.125, fz - 0.0625, x + 0.125, 1.0, fz + 0.0625, P.timber);
    B(-16, 0.5, fz - 0.0625, 36, 0.5625, fz + 0.0625, P.timber);
    B(-16, 0.875, fz - 0.0625, 36, 0.9375, fz + 0.0625, P.timber);
    snowCap(-16, 36, fz - 0.2, fz + 0.2, 0.3, 1.3, 0.8);
  }

  // pines: west slope, east of the storehouse, behind the shop. The view out of the front room stays clear.
  [[-12.5, -7.5, 7.5, 1], [-9.0, -8.6, 5.5, 2], [-13.5, -1.5, 8.5, 3], [-11.0, 6.5, 8.0, 4], [-6.0, 10.5, 7.0, 5], [-13.5, 13.0, 8.5, 6],
    [-2.25, 13.5, 6.0, 7], [19.0, -8.6, 6.0, 8], [30.5, -8.4, 7.5, 9], [33.5, 2.0, 8.5, 10], [29.5, 12.5, 8.0, 11], [19.25, 13.0, 6.5, 12],
    [24.0, 13.5, 7.0, 13], [33.5, 9.0, 6.0, 14], [-15.0, 4.0, 6.5, 15]].forEach(([x, z, h, s]) => conifer(x, z, h, s));

  // nothing of the snowy ground shows inside the shop: below floor level, within the walls, it's all floor
  {
    const snowy = new Set([...P.snow, P.snowShade]);
    for (let z = Z(-3.25); z < Z(15.875); z++) for (let x = X(0.125); x < X(15.875); x++) for (let y = 0; y < Y(0.25); y++) {
      const v = G.get(x, y, z);
      if (!v || snowy.has(v)) G.set(x, y, z, P.floorSeam);
    }
  }

  // ---- the walk-in freezer: a small insulated annex against the kitchen's east wall, frost inside
  {
    const panel = (x, y, z) => (((z >> 2) + (y >> 3)) & 1 ? P.steel : C('#b8bec4', 0, 0.04));
    B(16.0, 0.125, 10.375, 18.375, 2.75, 13.125, panel);
    B(16.0, 0.25, 10.5, 18.25, 2.625, 13.0, 0);                                              // hollow
    B(16.0, 0.125, 10.5, 18.25, 0.25, 13.0, (x, y, z) => ((x + z) & 1 ? C('#c8ccd0', 0, 0.03) : C('#b8bcc0', 0, 0.03))); // floor
    B(16.0, 2.5, 10.5, 18.25, 2.625, 13.0, P.ice);                                            // frosted ceiling
    B(18.125, 0.25, 10.5, 18.25, 2.5, 13.0, (x, y, z) => (hash01(y, z, 3) > 0.7 ? P.ice : C('#d8e4ec', 0, 0.03))); // frost on the back wall
    for (const [z0, z1] of [[10.5, 10.625], [12.875, 13.0]]) B(16.0, 0.25, z0, 18.25, 2.5, z1, (x, y) => (hash01(x, y, 5) > 0.7 ? P.ice : C('#d8e4ec', 0, 0.03)));
    snowCap(15.9, 18.5, 10.3, 13.2, 2.5, 3.5, 1);
    meta.lights.push({ pos: [17.2, 2.2, 11.75], color: 0xcfe8ff, intensity: 2.6, distance: 4, name: 'freezer' });
  }
  // ---- inside the kura: a stone floor, a timber ceiling under the roof, lantern light
  meta.lights.push({ pos: [24.0, 3.0, 6.0], color: 0xffb070, intensity: 3.5, distance: 7, name: 'kura' });

  // glass is solid: you can see through the panes but not walk through them
  for (const g of meta.glass) for (let y = g.y0; y < g.y1; y += VS / 2) for (let u = g.axis === 'z' ? g.x0 : g.z0; u < (g.axis === 'z' ? g.x1 : g.z1); u += VS / 2) {
    if (g.axis === 'z') { W.mark(u, y, g.z - VS / 2); W.mark(u, y, g.z + VS / 2); } else { W.mark(g.x - VS / 2, y, u); W.mark(g.x + VS / 2, y, u); }
  }

  meta.lights.push({ pos: [13.4, 2.1, -4.0], color: 0xff9050, intensity: 5, distance: 6, name: 'door' });
  meta.lights.push({ pos: [19.2, 1.2, -3.9], color: 0xcfe4ff, intensity: 4, distance: 5.5, name: 'vending' });

  return meta;
}
