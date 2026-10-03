// The static voxel world: a snowy cliff-top lot above the sea, the shop (Yoake) and its upstairs,
// a storehouse, a little shrine, pines. World voxels are 1/8 m. Props live in props.js at finer scales.
import * as THREE from 'three';
import { Grid, C, rng, hash3, hash01, meshVoxels, glyphPixels, textWidth } from './voxel.js';

export const VS = 0.125, OX = -16, OY = -0.25, OZ = -16;
export const SX = 416, SY = 132, SZ = 256;

// Key layout numbers (meters) shared by other modules
export const L = {
  floor: 0.25,            // shop floor top
  walk: 0.125,            // snow / path top
  ceil: 3.5,
  diner: { x0: 0, x1: 16, z0: -3.375, z1: 10.25 },
  inside: { x0: 0.25, x1: 15.75, z0: -3.125, z1: 15.75 },
  door: { x0: 12.75, x1: 14.0, z: -3.25, hinge: 12.8125, h: 2.625 },
  cliff: -11.25,          // the lot ends here; below is the sea
  bounds: { x0: -1.25, x1: 33.0, z0: -10.4, z1: 15.5 },
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
    wood: [C('#6a4a30', 0, 0.08), C('#5a3e28', 0, 0.08)], log: C('#8a6a48', 0, 0.06), logEnd: C('#c8a070', 0, 0.06),
  };
  const pick = (arr, x, y, z) => arr[Math.floor(hash01(x, y, z) * arr.length * 0.9999)];
  const snowAt = (x, z) => { const n = vnoise(x, z, 6, 3); return n > 0.7 ? P.snow[2] : n < 0.3 ? P.snow[3] : P.snow[(x * 7 + z * 3) & 1]; };
  // the lot ends at the cliff; beyond it the land falls away to the sea (see effects.makeBackdrop)
  const onLot = (z) => mz(z) > L.cliff;

  // ------------------------------------------------------------ ground: snow over earth, a flagstone path along the front
  const top = Y(0.125) - 1;
  B(-16, -0.25, L.cliff, 36, 0.125, 16, (x, y, z) => (y < top ? P.earth : snowAt(x, z)));
  const isPath = (x, z) => {
    const px = mx(x), pz = mz(z);
    if (pz > -5.125 && pz < -3.375) return true;                  // along the front of the shop
    if (px > 12.0 && px < 14.75 && pz > -5.5 && pz < -3.25) return true; // the door apron
    return false;
  };
  for (let z = Z(-6); z < Z(-3.25); z++) for (let x = 0; x < SX; x++) {
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
    if (px > 16.3 && px < 17.9 && pz > -3.5 && pz < -1.8) continue; // the vending machine stands here
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
  // main room x 0..16, z 0..10 behind a shoji partition; a glass veranda along the front (z -3..0) looking out to sea.
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

  // partition between main room and veranda: dark wood half wall, shoji panels above, timber posts, two openings
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

  // ---- veranda: stone-and-cedar knee wall, timber-framed glass, cedar ceiling under a tiled lean-to roof
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
  // lean-to roof over the veranda: cedar soffit, dark tiles, a thick blanket of snow, icicles at the eave
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

  // ---- the counter: hinoki top, dark board front, raised step for the stools
  B(3.0, 0.25, 6.25, 13.25, 0.375, 7.0, (x, y, z) => (z === Z(6.25) ? P.walnutD : P.oak[2]));
  B(3.0, 0.25, 7.0, 13.25, 0.95, 7.75, (x, y, z) => (z === Z(7.0) ? P.oak[(x >> 1) % 3] : P.timberD));
  B(2.875, 0.95, 6.875, 13.375, 1.075, 7.875, (x, y, z) => (z === Z(6.875) || x === X(2.875) || x === X(13.375) - 1 ? P.hinokiE : P.hinoki));
  // back bar: dark cabinets with a hinoki top, plank backsplash with a shelf for sake bottles, a glowing drinks fridge
  B(3.0, 0.25, 9.25, 13.25, 0.95, 10.0, (x, y, z) => (z === Z(9.25) && (x & 7) === 0 ? P.walnutD : P.oak[0]));
  B(3.0, 0.95, 9.125, 13.25, 1.0, 10.0, P.hinoki);
  B(4.625, 1.0, 9.875, 13.25, 2.25, 10.0, (x, y) => ((y & 3) === 0 ? P.timberD : P.sugi[(x >> 3) % 3]));
  B(4.625, 2.25, 9.625, 13.25, 2.375, 10.0, P.walnutD);
  {
    const lit = C('#e8f0ff', 1.3, 0.05);
    const goods = ['#3a8a4a', '#c08a2a', '#e8e0d0', '#b02a2a', '#f0d060', '#5a3018'].map((h) => C(h, 0.9, 0.1));
    B(3.0, 0.25, 9.25, 4.5, 2.0, 10.0, (x, y, z) => {
      const my = myOf(y);
      if (my < 0.5 || my > 1.875 || x === X(3.0) || x === X(4.5) - 1 || x === X(3.75)) return P.steel;
      const ly = y - Y(0.5);
      if (ly % 4 === 0) return P.steelD;
      if (z === Z(9.25) && ly % 4 === 3) return lit;
      return goods[Math.floor(hash01(x, y, z) * 5.99)];
    });
  }
  // kitchen pass with heat lamps (the kitchen itself is built below)
  B(10.75, 1.125, 9.875, 12.75, 2.0, 10.25, 0);
  B(10.75, 1.0, 9.75, 12.75, 1.125, 10.5, P.steel);
  B(10.75, 1.875, 9.875, 12.75, 2.0, 10.25, P.steelD);
  B(10.875, 1.75, 9.875, 12.625, 1.875, 10.125, P.heat);
  // doorways in the back wall: kitchen and the restroom hallway
  B(14.0, 0.25, 9.875, 15.125, 2.375, 10.25, 0);
  B(13.875, 0.25, 9.875, 14.0, 2.5, 10.0, P.timberD); B(15.125, 0.25, 9.875, 15.25, 2.5, 10.0, P.timberD); B(13.875, 2.375, 9.875, 15.25, 2.5, 10.0, P.timberD);
  B(0.375, 0.25, 9.875, 1.625, 2.375, 10.25, 0);
  B(0.25, 0.25, 9.875, 0.375, 2.5, 10.0, P.walnutD); B(1.625, 0.25, 9.875, 1.75, 2.5, 10.0, P.walnutD); B(0.25, 2.375, 9.875, 1.75, 2.5, 10.0, P.walnutD);

  // ================= back of house (z 10.25..15.75): restroom hallway, two restrooms, the kitchen
  {
    const cream = C('#d8c8a4', 0, 0.04), creamD = C('#b8a47e', 0, 0.04);
    const sub = [C('#e8e8e2', 0, 0.03), C('#dcdcd4', 0, 0.03)], teal = C('#3a8a8a', 0, 0.05), mint = C('#bcd8c8', 0, 0.04);
    const ktile = [C('#ecebe4', 0, 0.03), C('#dfded6', 0, 0.03)], kUpper = C('#c8cac4', 0, 0.04);
    const ceilT = C('#e4e2da', 0, 0.04), ceilG = C('#b8b6ae', 0, 0.03);
    const blackT = C('#1c1c1e', 0, 0.04), whiteT = C('#e8e6e0', 0, 0.03);
    const quarry = [C('#8a3a24', 0, 0.07), C('#7a3220', 0, 0.07)], mat = C('#18181a', 0, 0.05);
    const region = (mx, mz) => (mx < 1.75 ? 'hall' : mx < 5.0 ? 'rest' : 'kitchen');
    const wallFinish = (reg, u, y) => {
      const my = myOf(y);
      if (reg === 'hall') return my < 1.125 ? P.oak[(u >> 1) & 1] : my < 1.25 ? P.walnutD : cream;
      if (reg === 'rest') return my < 1.5 ? sub[((u >> 1) + (y & 1)) & 1] : my < 1.625 ? teal : mint;
      return my < 2.25 ? ktile[((u >> 1) + (y & 1)) & 1] : kUpper;
    };
    // floors
    B(0, -0.25, 10.25, 16, 0.25, 15.75, (x, y, z) => {
      if (y < Y(0.25) - 1) return P.floorSeam;
      const mx = OX + (x + 0.5) * VS, mz = OZ + (z + 0.5) * VS, reg = region(mx, mz);
      if (reg === 'hall') return ((x + z) & 1) ? blackT : whiteT;
      if (reg === 'rest') return ((x >> 1) + (z >> 1)) & 1 ? blackT : whiteT;
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
    B(0.25, 3.0, 10.25, 15.75, 3.125, 15.75, (x, y, z) => ((x & 3) === 0 || (z & 3) === 0 ? ceilG : ceilT));
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
    // hallway end: back exit door with push bar
    B(0.375, 0.25, 15.625, 1.625, 2.25, 15.75, (x, y) => (y === Y(1.1) ? P.chrome : (x === X(0.375) || x === X(1.625) - 1 || y === Y(2.25) - 1) ? P.steelD : C('#7a7e84', 0, 0.04)));
    // restroom ceiling lights
    for (const lz of [11.625, 14.375]) B(3.0, 2.875, lz - 0.25, 3.875, 3.0, lz + 0.25, C('#f4f8ff', 2.4, 0.03));
    B(0.75, 2.875, 12.75, 1.25, 3.0, 13.25, C('#fff0d0', 2.0, 0.03));
    meta.lights.push({ pos: [3.45, 2.6, 13.06], color: 0xeef4ff, intensity: 3.5, distance: 5.5, name: 'restrooms' });

    // ---- kitchen: cook line under a big hood, prep island, plating shelf, dish station, walk-in, dry storage
    B(6.0, 2.25, 14.25, 14.75, 3.0, 15.75, (x, y, z) => (y === Y(2.25) && z === Z(14.375) && (x % 10 < 3) ? C('#fff4d8', 3.0, 0.03) : P.steel));
    B(7.0, 0.75, 12.0, 12.0, 0.875, 12.875, P.steel);                       // prep island top
    B(7.125, 0.375, 12.125, 11.875, 0.5, 12.75, P.steelD);                  // undershelf
    for (const [lx, lz] of [[7.0, 12.0], [11.875, 12.0], [7.0, 12.75], [11.875, 12.75]]) B(lx, 0.25, lz, lx + 0.125, 0.75, lz + 0.125, P.steelD);
    B(10.5, 0.25, 10.25, 13.0, 0.875, 10.875, (x, y, z) => (y === Y(0.875) - 1 ? P.steel : P.steelD)); // plating station under the pass
    // dish station: three-well sink against the restroom wall
    B(5.125, 0.25, 10.75, 5.875, 0.875, 13.75, (x, y, z) => (y === Y(0.25) ? P.black : P.steel));
    B(5.125, 0.875, 10.75, 5.25, 1.375, 13.75, P.steel);
    for (const [a, b] of [[10.875, 11.75], [11.875, 12.75], [12.875, 13.625]]) {
      B(5.25, 0.75, a, 5.75, 0.875, b, 0);
      B(5.25, 0.625, a, 5.75, 0.75, b, C('#7a9aa8', 0, 0.06));
    }
    // walk-in cooler door on the east wall
    B(15.625, 0.25, 11.0, 15.75, 2.25, 12.25, (x, y, z) => {
      const ly = y - Y(0.25), lz = z - Z(11.0);
      if (lz === 0 || lz === 9 || ly === 15) return P.steelD;
      if (lz === 1 && ly > 6 && ly < 9) return P.chrome;
      if (ly > 9 && ly < 13 && lz > 3 && lz < 7) return C('#b8d8f0', 0.7, 0.05);
      return C('#b8bec4', 0, 0.04);
    });
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
  // tall glowing dessert case in the east corner
  {
    const cakes = ['#f4e8d0', '#5a2a18', '#e8a0b0', '#f2d060', '#8e1a28', '#fff6e8'].map((h) => C(h, 1.0, 0.08));
    const lit = C('#fff0d8', 1.4, 0.05);
    B(14.625, 0.25, 1.625, 15.75, 1.875, 2.875, (x, y, z) => {
      const my = myOf(y);
      if (my < 0.5 || my > 1.75) return P.chrome;
      if (z === Z(1.625) || z === Z(2.875) - 1) return P.chrome;
      const ly = y - Y(0.5);
      if (ly % 3 === 0) return P.chrome;
      return ly % 3 === 1 ? cakes[Math.floor(hash01(x >> 1, y, z >> 1) * 5.99)] : lit;
    });
  }

  meta.lights.push({ pos: [4.0, 2.0, -1.6], color: 0xffb070, intensity: 5, distance: 7, name: 'consL' });
  meta.lights.push({ pos: [10.5, 2.0, -1.6], color: 0xffb070, intensity: 5, distance: 7, name: 'consR' });
  meta.lights.push({ pos: [5.2, 2.45, 3.9], color: 0xffc080, intensity: 6, distance: 8, name: 'chandA' });
  meta.lights.push({ pos: [11.0, 2.45, 3.9], color: 0xffc080, intensity: 6, distance: 8, name: 'chandB' });
  meta.lights.push({ pos: [6.0, 2.2, 1.1], color: 0xffd0a0, intensity: 4, distance: 6, name: 'boothsFront' });
  meta.lights.push({ pos: [1.0, 2.2, 5.3], color: 0xffd0a0, intensity: 4, distance: 6, name: 'boothsWest' });
  meta.lights.push({ pos: [5.5, 2.4, 7.8], color: 0xffd8a8, intensity: 5, distance: 7, name: 'counterL' });
  meta.lights.push({ pos: [10.5, 2.4, 7.8], color: 0xffd8a8, intensity: 5, distance: 7, name: 'counterR' });

  // glowing drinks case in the east corner
  {
    const bottles = ['#3a7a4a', '#e8e0c8', '#c8902a', '#5a2a18', '#e8d070', '#2a4a7a'].map((h) => C(h, 1.0, 0.08));
    const lit = C('#fff0d8', 1.4, 0.05);
    B(14.625, 0.25, 1.625, 15.75, 1.875, 2.875, (x, y, z) => {
      const my = myOf(y);
      if (my < 0.5 || my > 1.75) return P.timberD;
      if (z === Z(1.625) || z === Z(2.875) - 1) return P.timberD;
      const ly = y - Y(0.5);
      if (ly % 3 === 0) return P.chrome;
      return ly % 3 === 1 ? bottles[Math.floor(hash01(x >> 1, y, z >> 1) * 5.99)] : lit;
    });
  }

  meta.lights.push({ pos: [4.0, 2.0, -1.6], color: 0xffa860, intensity: 5, distance: 7, name: 'consL' });
  meta.lights.push({ pos: [10.5, 2.0, -1.6], color: 0xffa860, intensity: 5, distance: 7, name: 'consR' });
  meta.lights.push({ pos: [5.2, 2.45, 3.9], color: 0xffb070, intensity: 6, distance: 8, name: 'chandA' });
  meta.lights.push({ pos: [11.0, 2.45, 3.9], color: 0xffb070, intensity: 6, distance: 8, name: 'chandB' });
  meta.lights.push({ pos: [6.0, 2.2, 1.1], color: 0xffc890, intensity: 4, distance: 6, name: 'boothsFront' });
  meta.lights.push({ pos: [1.0, 2.2, 5.3], color: 0xffc890, intensity: 4, distance: 6, name: 'boothsWest' });
  meta.lights.push({ pos: [5.5, 2.4, 7.8], color: 0xffc898, intensity: 3.6, distance: 7, name: 'counterL' });
  meta.lights.push({ pos: [10.5, 2.4, 7.8], color: 0xffc898, intensity: 3.6, distance: 7, name: 'counterR' });

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
  // shoji windows: a timber lattice in front, lamp-lit paper behind it (some rooms dark)
  const shojiWindow = (axis, plane, out, c0, c1, y0, y1, lit) => {
    const ua = axis === 'z' ? X(c0) : Z(c0), ub = axis === 'z' ? X(c1) : Z(c1);
    for (let u = ua; u < ub; u++) for (let y = Y(y0); y < Y(y1); y++) {
      const lu = u - ua, ly = y - Y(y0), edge = lu === 0 || lu === ub - ua - 1 || ly === 0 || ly === Y(y1) - Y(y0) - 1;
      const grid = edge || lu % 3 === 0 || ly % 4 === 0;
      const paper = lit === 2 ? P.shoji : lit === 1 ? P.shojiDim : P.shojiDark;
      const a = axis === 'z' ? [u, y, plane] : [plane, y, u], b = axis === 'z' ? [u, y, plane - out] : [plane - out, y, u];
      G.set(...a, grid ? P.lattice : 0);
      G.set(...b, paper);
    }
    // sill
    for (let u = ua - 1; u < ub + 1; u++) { const p = axis === 'z' ? [u, Y(y0) - 1, plane + out] : [plane + out, Y(y0) - 1, u]; G.set(...p, P.timberD); }
  };
  const ZF = Z(0), ZB = Z(16) - 1, XW = X(0), XE = X(16) - 1;
  for (const [c, lit] of [[2.5, 2], [13.5, 1]]) shojiWindow('z', ZF, -1, c - 0.75, c + 0.75, 5.25, 6.5, lit);
  for (const [c, lit] of [[5.75, 2], [10.25, 0]]) shojiWindow('z', ZF, -1, c - 0.6, c + 0.6, 5.625, 6.5, lit);
  for (const [c, lit] of [[3.0, 2], [7.5, 0], [12.5, 1]]) shojiWindow('x', XW, -1, c - 0.75, c + 0.75, 5.25, 6.5, lit);
  for (const [c, lit] of [[4.0, 1], [11.5, 2]]) shojiWindow('x', XE, 1, c - 0.75, c + 0.75, 5.25, 6.5, lit);
  for (const [c, lit] of [[4.0, 0], [11.0, 1]]) shojiWindow('z', ZB, 1, c - 0.75, c + 0.75, 5.25, 6.5, lit);
  meta.lights.push({ pos: [2.5, 5.8, -1.2], color: 0xffa860, intensity: 2.5, distance: 5, name: 'upstairs' });

  // the shop's name board (kanban) above the veranda roof: dark cedar, lamp-lit letters
  {
    const str = 'YOAKE', w = textWidth(str);
    const xa = X(8) - 20, xb = X(8) + 20, ya = Y(3.75) + 1, yb = ya + 11;
    for (let x = xa; x < xb; x++) for (let y = ya; y < yb; y++) for (const z of [ZF - 1, ZF - 2]) {
      const edge = x === xa || x === xb - 1 || y === ya || y === yb - 1;
      G.set(x, y, z, edge ? P.hinokiE : P.timberD);
    }
    const u0 = X(8) + Math.floor(w / 2);
    glyphPixels(str, (c, r) => G.set(u0 - c, yb - 3 - r, ZF - 2, P.kanbanInk));
    // the little lamps that light it
    for (const lx of [6.0, 10.0]) { B(lx - 0.0625, myOf(yb) + 0.125, -0.5, lx + 0.0625, myOf(yb) + 0.25, -0.125, P.black); G.set(X(lx), yb + 1, Z(-0.5), P.lantern); }
    meta.lights.push({ pos: [8, 4.7, -1.4], color: 0xffc080, intensity: 4.5, distance: 6, name: 'kanban' });
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
    B(23.25, 0.5, z0 - 0.125, 24.75, 2.625, z0 + 0.0, (x, y) => (((x + y) % 6 === 0) ? P.steelD : P.timberD));
    B(23.0, 2.625, z0 - 0.25, 25.0, 2.875, z0, P.tile[0]);
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

  // firewood stacked under the eave against the east wall
  for (let z = Z(1.0); z < Z(4.5); z++) for (let y = Y(0.125); y < Y(1.25); y++) for (let x = X(16.0); x < X(16.625); x++) {
    const end = x === X(16.625) - 1, ring = Math.hypot(((z & 3) - 1.5), ((y & 3) - 1.5)) < 1.2;
    G.set(x, y, z, end ? (ring ? P.logEnd : P.log) : P.wood[(y >> 2) & 1]);
  }
  snowCap(16.0, 16.75, 1.0, 4.5, 0.5, 1.75, 0.9);

  // a wooden rail where the lot ends at the cliff
  {
    const fz = L.cliff + 0.5;
    for (let x = -16; x < 36; x += 1.5) B(x, 0.125, fz - 0.0625, x + 0.125, 1.0, fz + 0.0625, P.timber);
    B(-16, 0.5, fz - 0.0625, 36, 0.5625, fz + 0.0625, P.timber);
    B(-16, 0.875, fz - 0.0625, 36, 0.9375, fz + 0.0625, P.timber);
    snowCap(-16, 36, fz - 0.2, fz + 0.2, 0.3, 1.3, 0.8);
  }

  // pines: west slope, east of the storehouse, behind the shop. The view out of the veranda stays clear.
  [[-12.5, -7.5, 7.5, 1], [-9.0, -8.6, 5.5, 2], [-13.5, -1.5, 8.5, 3], [-11.0, 6.5, 8.0, 4], [-6.0, 10.5, 7.0, 5], [-13.5, 13.0, 8.5, 6],
    [-2.25, 13.5, 6.0, 7], [19.0, -8.6, 6.0, 8], [30.5, -8.4, 7.5, 9], [33.5, 2.0, 8.5, 10], [29.5, 12.5, 8.0, 11], [19.25, 13.0, 6.5, 12],
    [24.0, 13.5, 7.0, 13], [33.5, 9.0, 6.0, 14], [-15.0, 4.0, 6.5, 15]].forEach(([x, z, h, s]) => conifer(x, z, h, s));

  meta.lights.push({ pos: [13.4, 2.1, -4.0], color: 0xff9050, intensity: 5, distance: 6, name: 'door' });
  meta.lights.push({ pos: [17.0, 1.2, -3.9], color: 0xcfe4ff, intensity: 4, distance: 5.5, name: 'vending' });

  return meta;
}
