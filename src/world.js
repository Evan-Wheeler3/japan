// The static voxel world: street, sidewalks, the diner shell and its neighbors.
// World voxels are 1/8 m. Props (furniture etc.) live in props.js at finer scales.
import * as THREE from 'three';
import { Grid, C, rng, hash3, hash01, meshVoxels, glyphPixels, textWidth } from './voxel.js';

export const VS = 0.125, OX = -16, OY = -0.25, OZ = -16;
export const SX = 416, SY = 132, SZ = 256;

// Key layout numbers (meters) shared by other modules
export const L = {
  floor: 0.25,            // diner floor top
  walk: 0.125,            // sidewalk top
  ceil: 3.5,
  diner: { x0: 0, x1: 16, z0: -3.375, z1: 10.25 },
  inside: { x0: 0.25, x1: 15.75, z0: -3.125, z1: 15.75 },
  door: { x0: 12.75, x1: 14.0, z: -3.25, hinge: 12.8125, h: 2.625 },
  lanes: [-6.1, -8.6],
  stopX: 1.6,
  avenueLanes: [-3.0, -5.6],
  bounds: { x0: -1.25, x1: 33.0, z0: -13.2, z1: 15.5 },
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

export function buildWorld(W) {
  const R = rng(20261002);
  const G = W.grid;
  const X = (m) => W.vx(m), Y = (m) => W.vy(m), Z = (m) => W.vz(m);
  const B = (...a) => W.box(...a);
  const meta = { lights: [], glass: [], etched: [], tvs: [], signals: [], lamps: [] };

  // ------------------------------------------------------------ palette
  const P = {
    asph: [C('#1b1c20', 0, 0.08), C('#212227', 0, 0.08), C('#17181b', 0, 0.06), C('#26262a', 0, 0.07)],
    lineW: C('#8e8d88', 0, 0.1), lineY: C('#a3822c', 0, 0.1),
    conc: [C('#55545a', 0, 0.05), C('#5d5b5b', 0, 0.05), C('#4f4f55', 0, 0.05)],
    seam: C('#38373b', 0, 0.03), curb: C('#6a6762', 0, 0.06), dirt: C('#2a1d14', 0, 0.1),
    manhole: C('#2c2a27', 0, 0.05), manhole2: C('#3a3631', 0, 0.05),
    brick: [C('#7e3a2c', 0, 0.08), C('#8c4430', 0, 0.08), C('#6e3226', 0, 0.07)],
    brickL: [C('#9a6450', 0, 0.07), C('#8c5846', 0, 0.07), C('#a86c54', 0, 0.07)],
    brickG: [C('#5e5a58', 0, 0.07), C('#686260', 0, 0.07), C('#544f4e', 0, 0.07)],
    stone: C('#8b8478', 0, 0.05), stoneD: C('#5f5a52', 0, 0.05), cornice: C('#3b3530', 0, 0.05),
    winDark: [C('#0b0e16', 0, 0.15), C('#111521', 0, 0.15), C('#0e1018', 0, 0.1)],
    winWarm: C('#ffb468', 1.3, 0.12), winWarm2: C('#ffcf8a', 1.0, 0.12), curtain: C('#d97a5a', 0.55, 0.1),
    curtain2: C('#e8d2a0', 0.6, 0.1), winCool: C('#9ec2ff', 0.9, 0.1), blinds: C('#ffd9a0', 0.8, 0.05),
    sash: C('#2a2624', 0, 0.05), ac: C('#8d9095', 0, 0.06), acD: C('#5a5d62', 0, 0.06),
    iron: C('#16161a', 0, 0.05), iron2: C('#24242a', 0, 0.05),
    maroon: C('#4a1218', 0, 0.05), maroonD: C('#30090e', 0, 0.05), chrome: C('#c4c9cf', 0, 0.04), black: C('#121214', 0, 0.04),
    awning: C('#a41c2a', 0, 0.06), awningD: C('#86152a', 0, 0.06), awnTrim: C('#efe6d4', 0, 0.04),
    signBg: C('#0d1712', 0, 0.04),
    neonR: C('#ff2a3c', 6, 0.03), neonP: C('#ff5fb0', 4.5, 0.03), neonY: C('#ffd25a', 5, 0.03), neonB: C('#47b4ff', 5, 0.03),
    neonG: C('#38ff86', 5, 0.03), bulb: C('#ffcf7a', 5, 0.05),
    walnut: [C('#3a2215', 0, 0.06), C('#33200f', 0, 0.06)], walnutD: C('#24150c', 0, 0.05),
    pine: [C('#8a5832', 0, 0.06), C('#7b4c2a', 0, 0.06), C('#93613a', 0, 0.06)], knot: C('#5c3618', 0, 0.05),
    crown: C('#2b1a10', 0, 0.05),
    tileA: C('#7a3d24', 0, 0.06), tileB: C('#a8845a', 0, 0.06), tileC: C('#5a2c1a', 0, 0.06), grout: C('#3c2a1f', 0, 0.04),
    tin: C('#7d7b74', 0, 0.03), tinD: C('#55534e', 0, 0.03), tinL: C('#9a978c', 0, 0.03), beam: C('#2e1d12', 0, 0.06),
    counterTop: C('#e7e0cf', 0, 0.03), steel: C('#9aa0a6', 0, 0.05), steelD: C('#6f747a', 0, 0.05), counterRed: C('#7e1820', 0, 0.06),
    kitchenTile: C('#f2ead8', 1.15, 0.05), kitchenTile2: C('#e6dcc4', 1.1, 0.05), heat: C('#ff7a2a', 4, 0.05),
    menuBg: C('#141412', 0, 0.04), menuText: C('#efe6cf', 0.9, 0.08), menuRed: C('#ff4a3a', 1.6, 0.05),
    door: C('#4a2c1a', 0, 0.05), porthole: C('#ffe2b0', 1.4, 0.05),
    fluor: C('#bfe0d4', 0.6, 0.08), fluorW: C('#dce8ec', 0.7, 0.06), shelfD: C('#2a2e35', 0, 0.06),
    shutter: [C('#5f6266', 0, 0.04), C('#4d5054', 0, 0.04)],
    graf: [C('#c23a6a', 0, 0.1), C('#2f7fd0', 0, 0.1), C('#e0b030', 0, 0.1), C('#3ab07a', 0, 0.1), C('#e8e8e8', 0, 0.05)],
    green: C('#1f4a2c', 0, 0.06), greenD: C('#173822', 0, 0.06), shedG: C('#23402c', 0, 0.06),
    blueSign: C('#1d3fa0', 0.7, 0.04), white: C('#f4f4f4', 2.2, 0.03),
    bark: C('#2b1f17', 0, 0.1), leaf: [C('#1e3320', 0, 0.12), C('#25402a', 0, 0.12), C('#2d4a2b', 0, 0.12), C('#1a2a1b', 0, 0.1)],
    fairy: C('#ffd27a', 4.5, 0.08), pole: C('#2a2e2c', 0, 0.05), lampHead: C('#ffb35a', 7, 0.03), lampHeadC: C('#dfe8ff', 6, 0.03),
    sconce: C('#ffc070', 4, 0.04), signalBox: C('#1b1b14', 0, 0.04), plywood: C('#2d4f8a', 0, 0.06),
  };
  const pick = (arr, x, y, z) => arr[Math.floor(hash01(x, y, z) * arr.length * 0.9999)];

  // ------------------------------------------------------------ ground
  // Corner of "23rd St" (our street, runs along x) and "9th Ave" (the avenue, runs along z, west of the diner).
  B(-16, -0.25, -16, 36, 0, 16, (x, y, z) => {
    const h = hash3(x >> 3, 7, z >> 3), h2 = hash3(x >> 4, 9, z >> 5);
    if (h2 > 0.75) return P.asph[3];
    return P.asph[h > 0.55 ? 1 : h < -0.6 ? 2 : 0];
  });
  const top = Y(0) - 1;
  const paint = (x0, z0, x1, z1, c) => G.box(X(x0), top, Z(z0), X(x1), top + 1, Z(z1), c);
  for (let x = 2; x < 36; x += 3) paint(x, -7.375, x + 1.5, -7.25, P.lineW);       // lane dashes
  for (let z = -11; z < -5; z += 1) paint(-1.0, z + 0.25, 1.0, z + 0.75, P.lineW); // crosswalk over our street
  paint(1.5, -10.0, 1.75, -5.25, P.lineW);                                          // stop line
  for (let x = -7; x < -1.5; x += 1) paint(x + 0.25, -4.5, x + 0.75, -2.25, P.lineW); // crosswalk over the avenue
  for (let x = -7; x < -1.5; x += 1) paint(x + 0.25, -13.25, x + 0.75, -11.25, P.lineW);
  for (let z = -16; z < 16; z += 3) if (z + 1.5 < -13.5 || z > -2.25) paint(-4.375, z, -4.25, z + 1.5, P.lineY);
  const manhole = (cx, cz) => {
    for (let z = Z(cz - 0.5); z < Z(cz + 0.5); z++) for (let x = X(cx - 0.5); x < X(cx + 0.5); x++) {
      const dx = OX + (x + 0.5) * VS - cx, dz = OZ + (z + 0.5) * VS - cz, d = Math.hypot(dx, dz);
      if (d < 0.36) G.set(x, top, z, d > 0.26 || ((x + z) & 1) ? P.manhole : P.manhole2);
    }
  };
  manhole(6.0, -7.9); manhole(22, -5.6);

  // ------------------------------------------------------------ sidewalks
  const sidewalk = (x0, z0, x1, z1) => B(x0, -0.25, z0, x1, 0.125, z1, (x, y, z) => {
    const sx = (x - X(x0)), sz = (z - Z(z0));
    if (y === Y(0.125) - 1 && (sx % 12 === 0 || sz % 12 === 0)) return P.seam;
    return P.conc[Math.floor(hash01(Math.floor(sx / 12), 3, Math.floor(sz / 12)) * 2.999)];
  });
  sidewalk(-1.5, -5.0, 36, 0); sidewalk(-1.5, 0, 0, 16);
  sidewalk(-1.5, -13.5, 36, -11); sidewalk(-1.5, -16, 0, -13.5);
  sidewalk(-16, -16, -7, 16);
  const sTop = Y(0.125) - 1;
  const isStreet = (xx, zz) => { const mx = OX + (xx + 0.5) * VS, mz = OZ + (zz + 0.5) * VS; return mx > -7 && ((mz > -11 && mz < -5.0) || mx < -1.5); };
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    if (G.get(x, sTop, z) === 0) continue;
    const edge = (dx, dz) => x + dx >= 0 && x + dx < SX && z + dz >= 0 && z + dz < SZ && !G.get(x + dx, sTop, z + dz) && isStreet(x + dx, z + dz);
    if (edge(1, 0) || edge(-1, 0) || edge(0, 1) || edge(0, -1)) for (let y = 0; y <= sTop; y++) G.set(x, y, z, P.curb);
  }

  const tree = (tx, tz, seed) => {
    const r = rng(seed);
    B(tx - 0.5, 0.0, tz - 0.5, tx + 0.5, 0.125, tz + 0.5, P.dirt);
    for (let x = X(tx - 0.625); x < X(tx + 0.625); x++) for (let z = Z(tz - 0.625); z < Z(tz + 0.625); z++) {
      const edge = x === X(tx - 0.625) || x === X(tx + 0.625) - 1 || z === Z(tz - 0.625) || z === Z(tz + 0.625) - 1;
      if (edge) { G.set(x, Y(0.25), z, P.iron); if (((x + z) & 1) === 0) G.set(x, Y(0.125), z, P.iron); }
    }
    B(tx - 0.125, 0.125, tz - 0.125, tx + 0.125, 3.0, tz + 0.125, P.bark);
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2, len = 0.6 + r() * 0.6, y0 = 2.0 + r() * 1.2;
      for (let t = 0; t < len; t += 0.1) G.set(X(tx + Math.cos(a) * t), Y(y0 + t * 0.8), Z(tz + Math.sin(a) * t), P.bark);
    }
    const cy = 4.2, rr = 1.75;
    for (let y = Y(cy - rr); y < Y(cy + rr); y++) for (let z = Z(tz - rr); z < Z(tz + rr); z++) for (let x = X(tx - rr); x < X(tx + rr); x++) {
      const dx = (OX + (x + 0.5) * VS - tx) / rr, dy = (OY + (y + 0.5) * VS - cy) / (rr * 0.8), dz = (OZ + (z + 0.5) * VS - tz) / rr;
      const d = dx * dx + dy * dy + dz * dz;
      const n = hash3(x >> 1, y >> 1, z >> 1) * 0.25 + hash3(x, y, z) * 0.12;
      if (d < 0.85 + n && d > 0.35 + n && G.get(x, y, z) === 0) G.set(x, y, z, hash01(x, y, z) > 0.955 ? P.fairy : pick(P.leaf, x, y, z));
    }
  };

  // ------------------------------------------------------------ building helpers
  const face = (axis, plane, dir) => {
    if (axis === 'z') { const b = Z(plane); return (u, y, d, c) => G.set(u, y, dir < 0 ? b - d : b - 1 + d, c); }
    const b = X(plane); return (u, y, d, c) => G.set(dir < 0 ? b - d : b - 1 + d, y, u, c);
  };
  const Ufn = (axis) => (axis === 'z' ? X : Z);

  function building(o) {
    const { axis, plane, dir, u0, u1, h, groundH, brick } = o;
    const r = rng(o.seed || 1);
    const set = face(axis, plane, dir), U = Ufn(axis);
    const ua = U(u0), ub = U(u1);
    for (let u = ua; u < ub; u++) for (let y = Y(0.125); y < Y(h); y++) {
      const c = pick(brick, u, y, 1);
      set(u, y, 0, c); set(u, y, -1, c);
    }
    const floors = Math.floor((h - groundH - 0.6) / 3.0);
    const bays = Math.floor((u1 - u0) / 2.0);
    const off = (u1 - u0 - bays * 2.0) / 2;
    for (let f = 0; f < floors; f++) {
      const wy0 = groundH + f * 3.0 + 0.8, wy1 = wy0 + 1.625;
      for (let b = 0; b < bays; b++) {
        const cu = u0 + off + b * 2.0 + 1.0;
        const wa = U(cu - 0.5), wb = U(cu + 0.5);
        const roll = r();
        const kind = roll < 0.34 ? 'warm' : roll < 0.42 ? 'cool' : roll < 0.48 ? 'blinds' : 'dark';
        const cur = r() < 0.5 ? P.curtain : P.curtain2;
        for (let u = wa; u < wb; u++) for (let y = Y(wy0); y < Y(wy1); y++) {
          set(u, y, 0, 0);
          const lu = u - wa, ly = y - Y(wy0), w = wb - wa;
          let c;
          if (ly === 6 || lu === 0 || lu === w - 1) c = P.sash;
          else if (kind === 'warm') c = (lu <= 2 || lu >= w - 3) ? cur : (ly > 9 && hash01(u, y, 3) > 0.6 ? P.winWarm2 : P.winWarm);
          else if (kind === 'cool') c = P.winCool;
          else if (kind === 'blinds') c = ly % 2 ? P.blinds : P.sash;
          else c = pick(P.winDark, u, y, 5);
          set(u, y, -1, c);
        }
        if (kind === 'cool' && r() < 0.6) meta.tvs.push({ axis, plane, dir, u: cu, y: (wy0 + wy1) / 2, w: 0.9, h: 1.5 });
        for (let u = wa - 1; u < wb + 1; u++) { set(u, Y(wy1), 1, P.stone); set(u, Y(wy1), 0, P.stone); set(u, Y(wy0) - 1, 1, P.stone); }
        if (r() < 0.22) for (let u = wa + 1; u < wa + 6; u++) for (let y = Y(wy0) - 1; y < Y(wy0) + 3; y++) for (let d = 1; d < 4; d++)
          set(u, y, d, d === 3 && (y & 1) ? P.acD : P.ac);
      }
    }
    for (let u = ua - 1; u < ub + 1; u++) {
      for (let y = Y(h) - 3; y < Y(h); y++) for (let d = 0; d < 3; d++) set(u, y, d, P.cornice);
      if (u & 1) set(u, Y(h) - 4, 1, P.cornice);
      for (let y = Y(h) - 6; y < Y(h) - 4; y++) set(u, y, 1, P.stoneD);
    }
    if (o.depth) {
      const d1 = Math.round(o.depth / VS);
      for (let d = -d1; d <= 0; d++) for (let y = Y(0.125); y < Y(h); y++) {
        const c = pick(brick, d, y, 2);
        set(ua, y, d, c); set(ub - 1, y, d, c);
      }
      for (let d = -d1; d <= 0; d++) for (let u = ua; u < ub; u++) { set(u, Y(h) - 1, d, P.cornice); set(u, Y(h) - 2, d, P.cornice); }
    }
  }

  // ------------------------------------------------------------ near block (z >= 0): diner on the corner, bodega, tenement
  building({ axis: 'z', plane: 0, dir: -1, u0: 0, u1: 16, h: 16.0, groundH: 4.4, brick: P.brick, seed: 4, depth: 15.9 });
  building({ axis: 'x', plane: 0, dir: -1, u0: 0, u1: 16, h: 16.0, groundH: 4.4, brick: P.brick, seed: 6 });
  building({ axis: 'z', plane: 0, dir: -1, u0: 16, u1: 22, h: 13, groundH: 4.2, brick: P.brickL, seed: 3, depth: 15.9 });
  building({ axis: 'z', plane: 0, dir: -1, u0: 22, u1: 36, h: 15.0, groundH: 4.2, brick: P.brickG, seed: 5, depth: 15.9 });
  // far block (z <= -13.5)
  building({ axis: 'z', plane: -13.5, dir: 1, u0: 0, u1: 10, h: 11.5, groundH: 4.2, brick: P.brickL, seed: 7, depth: 2.4 });
  building({ axis: 'z', plane: -13.5, dir: 1, u0: 10, u1: 24, h: 16.0, groundH: 4.2, brick: P.brick, seed: 8, depth: 2.4 });
  building({ axis: 'z', plane: -13.5, dir: 1, u0: 24, u1: 36, h: 13.5, groundH: 4.2, brick: P.brickG, seed: 9, depth: 2.4 });
  building({ axis: 'x', plane: 0, dir: -1, u0: -16, u1: -13.5, h: 11.5, groundH: 4.2, brick: P.brickL, seed: 10 });
  // across the avenue
  building({ axis: 'x', plane: -9.5, dir: 1, u0: -16, u1: 16, h: 16.0, groundH: 4.2, brick: P.brick, seed: 11 });

  tree(24.0, -4.3, 11); tree(1.5, -12.0, 12); tree(27.5, -12.0, 13);

  // ------------------------------------------------------------ the diner
  // Modeled on Chelsea Square (23rd St & 9th Ave): main room x 0..16, z 0..10 behind an etched-glass
  // partition; a deep glass conservatory on the 23rd St sidewalk (z -3..0); the avenue runs past the west wall.
  const myOf = (y) => OY + (y + 0.5) * VS;
  const oak = [C('#7a4a28', 0, 0.07), C('#6a3e20', 0, 0.07), C('#84522e', 0, 0.07)];
  const brass = C('#b8963c', 0, 0.05), copper = C('#a8685e', 0, 0.06);
  const wood = (u, y) => {
    const my = myOf(y);
    if (my < 1.125) return oak[(u >> 1) & 1];          // vertical oak plank wainscot
    if (my < 1.25) return P.walnutD;                    // chair rail
    if (my > 3.375) return P.crown;
    const dir = (u >> 3) & 1 ? 1 : -1;                 // chevron paneling above
    return P.pine[(((u * dir + y) % 3) + 3) % 3];
  };
  const storefront = (my) => (my < 0.25 ? P.black : (my > 0.85 && my < 1.0) || (my > 2.75 && my < 2.875) ? P.chrome : P.maroon);

  // floor: wood-tone octagon tiles with dark square inserts
  const tileW = [C('#b07a44', 0, 0.07), C('#9a6232', 0, 0.07), C('#c28c52', 0, 0.07), C('#a86a3a', 0, 0.07)];
  const tileWD = [C('#a06e3c', 0, 0.06), C('#8c5a2e', 0, 0.06), C('#b07e48', 0, 0.06), C('#9a6034', 0, 0.06)];
  const tileDot = C('#4a1e12', 0, 0.05);
  B(0, -0.25, -3.375, 16, 0.25, 10.25, (x, y, z) => {
    if (y < Y(0.25) - 1) return P.tileC;
    const tx = x - X(0), tz = z - Z(-3.0), cx = tx & 3, cz = tz & 3;
    if (cx === 0 && cz === 0) return tileDot;
    const k = Math.floor(hash01(tx >> 2, 5, tz >> 2) * 3.999);
    return (cx === 0) !== (cz === 0) ? tileWD[k] : tileW[k];
  });

  // west wall = avenue storefront (outer maroon/chrome, inner wood), windows over the booths
  B(0, 0.125, 0, 0.125, 3.5, 10.25, (x, y, z) => storefront(myOf(y)));
  B(0.125, 0.25, 0.25, 0.25, 3.5, 10.0, (x, y, z) => wood(z, y));
  B(0, 3.5, 0, 0.25, 4.875, 10.25, (x, y, z) => (x === X(0) ? P.signBg : P.brick[0]));
  for (const [a, b] of [[1.875, 4.125], [4.25, 6.5], [6.625, 8.75]]) {
    B(0, 1.0, a, 0.25, 2.75, b, 0);
    meta.glass.push({ axis: 'x', x: 0.125, z0: a, z1: b, y0: 1.0, y1: 2.75 });
  }
  B(-0.125, 0.875, 1.875, 0, 1.0, 8.75, P.chrome);
  // east wall, back wall, crown
  B(15.875, 0.25, 0, 16, 4.4, 10.25, P.brickG[0]);
  B(15.75, 0.25, 0.25, 15.875, 3.5, 10.0, (x, y, z) => wood(z, y));
  B(0, 0.25, 10.0, 16, 3.5, 10.125, (x, y, z) => wood(x, y));
  B(0, 0.25, 10.125, 16, 4.4, 10.25, P.brickG[1]);
  B(0.25, 3.375, 9.875, 15.75, 3.5, 10.0, P.crown); B(0.25, 3.375, 0.25, 0.375, 3.5, 10.0, P.crown); B(15.625, 3.375, 0.25, 15.75, 3.5, 10.0, P.crown);
  // ceiling: white stucco, dark beams, framed vents
  const stucco = [C('#d6cfc0', 0, 0.12), C('#cbc3b2', 0, 0.12)];
  B(0.25, 3.5, 0.25, 15.75, 3.75, 10.0, (x, y, z) => stucco[hash01(x, y, z) > 0.5 ? 1 : 0]);
  for (const bx of [3.2, 6.4, 9.6, 12.8]) B(bx - 0.125, 3.25, 0.25, bx + 0.125, 3.5, 10.0, P.beam);
  B(0.25, 3.25, 9.75, 15.75, 3.5, 10.0, P.beam);
  for (const [vx, vz] of [[4.8, 5.4], [11.2, 5.4], [8.0, 2.4]]) {
    const xa = X(vx - 0.375), xb = X(vx + 0.375), za = Z(vz - 0.375), zb = Z(vz + 0.375);
    G.box(xa, Y(3.5) - 1, za, xb, Y(3.5), zb, (x, y, z) => (x === xa || x === xb - 1 || z === za || z === zb - 1) ? P.beam : ((z & 1) ? P.steel : P.steelD));
  }

  // partition between main room and conservatory: oak half wall, etched glass, brass posts, two openings
  const openings = [[7.25, 8.5], [12.75, 14.0]];
  B(0.125, 0.125, 0, 15.875, 3.0, 0.25, 0);
  for (let x = X(0.25); x < X(15.75); x++) {
    const mx = OX + (x + 0.5) * VS;
    if (openings.some(([a, b]) => mx > a && mx < b)) continue;
    const post = (x - X(0.25)) % 9 === 0;
    for (const z of [Z(0), Z(0.125)]) {
      for (let y = Y(0.25); y < Y(1.25); y++) G.set(x, y, z, oak[(x >> 1) & 1]);
      G.set(x, Y(1.25) - 1, z, P.walnutD);
      for (let y = Y(1.25); y < Y(1.875); y++) if (post) G.set(x, y, z, brass);
      G.set(x, Y(1.875), z, brass);
    }
  }
  for (const [a, b] of openings) for (const px of [X(a) - 1, X(b)]) for (let y = Y(0.25); y < Y(3.0); y++) { G.set(px, y, Z(0), P.walnutD); G.set(px, y, Z(0.125), P.walnutD); }
  B(0.25, 3.0, 0, 15.75, 3.5, 0.25, P.beam);
  for (const [a, b] of [[0.25, 7.125], [8.625, 12.625], [14.125, 15.75]]) meta.etched.push({ x0: a, x1: b, y0: 1.25, y1: 1.875, z: 0.125 });
  B(0, 3.5, 0, 16, 4.875, 0.25, (x, y, z) => (z === Z(0) ? P.signBg : P.brick[0]));

  // ---- conservatory: knee wall with a red radiator, black-framed glass, sloped plank ceiling under the awning
  const consPanes = [[0.375, 1.75], [1.875, 3.375], [3.5, 5.0], [5.125, 6.625], [6.75, 8.25], [8.375, 9.875], [10.0, 11.5], [11.625, 12.625], [14.125, 15.625]];
  const glassWall = (inPane, outer, my) => {
    if (my < 0.875) return outer ? storefront(my) : oak[0];
    if (my < 1.0) return outer ? P.chrome : P.walnutD;
    if (my > 2.625) return P.black;
    return inPane ? 0 : P.black;
  };
  for (let x = X(0); x < X(16); x++) for (let y = Y(0.125); y < Y(2.75); y++) for (const z of [Z(-3.375), Z(-3.25)]) {
    const mx = OX + (x + 0.5) * VS, my = myOf(y);
    if (mx > 12.75 && mx < 14.0 && my > 0.25) { G.set(x, y, z, 0); continue; }
    const frame = Math.abs(mx - 12.69) < 0.07 || Math.abs(mx - 14.06) < 0.07;
    G.set(x, y, z, frame ? P.chrome : glassWall(consPanes.some(([a, b]) => mx > a && mx < b), z === Z(-3.375), my));
  }
  for (const [a, b] of consPanes) meta.glass.push({ axis: 'z', z: -3.25, x0: a, x1: b, y0: 1.0, y1: 2.625 });
  for (const xs of [[X(0), X(0.125)], [X(15.75), X(15.875)]]) for (const x of xs) for (let z = Z(-3.125); z < Z(0); z++) for (let y = Y(0.125); y < Y(2.75); y++) {
    const mz = OZ + (z + 0.5) * VS;
    G.set(x, y, z, glassWall(mz > -3.0 && mz < -0.125, x === X(0) || x === X(15.875), myOf(y)));
  }
  meta.glass.push({ axis: 'x', x: 0.125, z0: -3.0, z1: -0.125, y0: 1.0, y1: 2.625 });
  meta.glass.push({ axis: 'x', x: 15.875, z0: -3.0, z1: -0.125, y0: 1.0, y1: 2.625 });
  B(0.125, 0.875, -3.125, 15.75, 1.0, -2.875, P.walnutD);           // inside sill (the cat's spot)
  B(0.25, 0.25, -3.125, 15.75, 0.5, -3.0, C('#8e1c1c', 0, 0.05)); // radiator
  B(12.75, 0.25, -3.125, 14.0, 1.0, -2.875, 0);
  B(12.75, 0.125, -3.625, 14.0, 0.25, -3.125, P.steel);             // door threshold
  for (let z = Z(-3.75); z < Z(0); z++) {
    const d = Z(0) - 1 - z, yr = Y(3.375) - Math.floor(d / 4.5);
    for (let x = X(-0.375); x < X(16); x++) {
      G.set(x, yr, z, ((x >> 2) & 1) ? P.awning : P.awningD);
      G.set(x, yr - 1, z, P.pine[((x >> 1) + (x & 1)) % 3]);
      if (z === Z(-3.75)) {
        G.set(x, yr - 2, z, P.awnTrim); G.set(x, yr - 3, z, P.awning);
        if ((x & 3) === 1 || (x & 3) === 2) G.set(x, yr - 4, z, P.awning);
      }
      if (x === X(-0.375)) { G.set(x, yr - 2, z, P.awnTrim); if ((z & 3) === 1 || (z & 3) === 2) G.set(x, yr - 3, z, P.awning); }
    }
  }

  // DINER sign above the conservatory roof
  {
    const set = face('z', 0, -1);
    const str = 'DINER', w = textWidth(str);
    const u0 = X(8) + Math.floor(w / 2), y0 = Y(4.55);
    glyphPixels(str, (c, r) => { set(u0 - c, y0 - r, 1, P.neonR); });
    const ua = u0 - w - 3, ub = u0 + 3, ya = y0 - 8, yb = y0 + 2;
    for (let u = ua; u <= ub; u++) { set(u, ya, 1, P.neonP); set(u, yb, 1, P.neonP); }
    for (let y = ya; y <= yb; y++) { set(ua, y, 1, P.neonP); set(ub, y, 1, P.neonP); }
    const star = (cu, cy) => { for (let i = -2; i <= 2; i++) { set(cu + i, cy, 1, P.neonY); set(cu, cy + i, 1, P.neonY); } set(cu + 1, cy + 1, 1, P.neonY); set(cu - 1, cy - 1, 1, P.neonY); set(cu + 1, cy - 1, 1, P.neonY); set(cu - 1, cy + 1, 1, P.neonY); };
    star(ua - 6, (ya + yb) >> 1); star(ub + 6, (ya + yb) >> 1);
    meta.lights.push({ pos: [8, 3.9, -4.0], color: 0xff4050, intensity: 4.5, distance: 9, name: 'dinerSign' });
  }
  // OPEN 24 HRS on the avenue side
  {
    const set = face('x', 0, -1);
    const str = 'OPEN 24 HRS', w = textWidth(str), u0 = Z(5) - (w >> 1);
    glyphPixels(str, (c, r) => set(u0 + c, Y(4.5) - r, 1, c < 24 ? P.neonY : P.neonR));
  }
  // EAT blade sign at the east end, above the conservatory roof
  {
    const xa = X(15.625), xb = X(15.875);
    const za = Z(-1.75), zb = Z(0), ya = Y(3.75), yb = Y(7.0);
    for (let y = ya; y < yb; y++) for (let z = za; z < zb; z++) for (let x = xa; x < xb; x++) G.set(x, y, z, P.black);
    for (const [x, sgn] of [[xa - 1, 1], [xb, -1]]) {
      for (let z = za; z < Z(-0.25); z++) { if ((z & 1) === 0) { G.set(x, ya, z, P.bulb); G.set(x, yb - 1, z, P.bulb); } }
      for (let y = ya; y < yb; y++) if ((y & 1) === 0) { G.set(x, y, za, P.bulb); G.set(x, y, Z(-0.25) - 1, P.bulb); }
      for (let i = 0; i < 3; i++) {
        const ty = yb - 3 - i * 8;
        glyphPixels('EAT'[i], (c, r) => G.set(x, ty - r, sgn > 0 ? za + 3 + c : za + 7 - c, P.neonR));
      }
    }
    meta.lights.push({ pos: [15.75, 5.0, -1.4], color: 0xff2a40, intensity: 10, distance: 10, name: 'eat' });
  }
  // fire escape on the 23rd St facade
  {
    const fx0 = 0.75, fx1 = 6.25;
    for (let f = 0; f < 3; f++) {
      const py = Y(5.125 + f * 3.0);
      for (let z = Z(-1.0); z < Z(0); z++) for (let x = X(fx0); x < X(fx1); x++) {
        if (((x + z) & 1) === 0 || z === Z(-1.0) || x === X(fx0) || x === X(fx1) - 1) G.set(x, py, z, P.iron);
      }
      for (let x = X(fx0); x < X(fx1); x++) { G.set(x, py + 8, Z(-1.0), P.iron); G.set(x, py + 4, Z(-1.0), P.iron2); if (x % 3 === 0) for (let y = py + 1; y < py + 8; y++) G.set(x, y, Z(-1.0), P.iron); }
      for (let z = Z(-1.0); z < Z(0); z++) for (const x of [X(fx0), X(fx1) - 1]) { G.set(x, py + 8, z, P.iron); if (z % 3 === 0) for (let y = py + 1; y < py + 8; y++) G.set(x, y, z, P.iron); }
      if (f < 2) for (let i = 0; i < 24; i++) {
        const x = X(fx1) - 3 - i, y = py + 1 + i;
        for (let z = Z(-0.75); z < Z(-0.25); z++) G.set(x, y, z, P.iron2);
        G.set(x, y + 6, Z(-0.75), P.iron);
      }
    }
  }

  // ---- the counter: long white top, oak plank front, raised wooden step for the stools
  B(3.0, 0.25, 6.25, 13.25, 0.375, 7.0, (x, y, z) => (z === Z(6.25) ? P.walnutD : oak[2]));
  B(3.0, 0.25, 7.0, 13.25, 0.95, 7.75, (x, y, z) => (z === Z(7.0) ? oak[(x >> 1) & 1] : P.steelD));
  B(2.875, 0.95, 6.875, 13.375, 1.075, 7.875, (x, y, z) => (z === Z(6.875) || x === X(2.875) || x === X(13.375) - 1 ? C('#cfc6b4', 0, 0.03) : P.counterTop));
  // back bar: steel cabinets, tile backsplash, scalloped shelf with mugs, glowing fridge case.
  // It starts at x 3.0 so there's a wide, clear approach to the restroom hallway in the corner.
  B(3.0, 0.25, 9.25, 13.25, 0.95, 10.0, (x, y, z) => (z === Z(9.25) && (x & 7) === 0 ? P.steelD : P.steel));
  B(3.0, 0.95, 9.125, 13.25, 1.0, 10.0, P.steel);
  const tileA = C('#e2d8c0', 0, 0.04), tileB2 = C('#9a7a5a', 0, 0.05);
  B(4.625, 1.0, 9.875, 13.25, 2.25, 10.0, (x, y) => (((x + y) & 3) === 0 || ((x - y) & 3) === 0 ? tileB2 : tileA));
  B(4.625, 2.25, 9.625, 13.25, 2.375, 10.0, P.walnutD);
  for (let x = X(4.625); x < X(13.25); x++) { G.set(x, Y(2.25) - 1, Z(9.625), copper); if ((x & 3) === 1 || (x & 3) === 2) G.set(x, Y(2.25) - 2, Z(9.625), copper); }
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
  // doorways in the back wall: kitchen (swinging porthole door is a separate mesh) and the restroom hallway
  B(14.0, 0.25, 9.875, 15.125, 2.375, 10.25, 0);
  B(13.875, 0.25, 9.875, 14.0, 2.5, 10.0, P.steel); B(15.125, 0.25, 9.875, 15.25, 2.5, 10.0, P.steel); B(13.875, 2.375, 9.875, 15.25, 2.5, 10.0, P.steel);
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
      if (reg === 'hall') return my < 1.125 ? oak[(u >> 1) & 1] : my < 1.25 ? P.walnutD : cream;
      if (reg === 'rest') return my < 1.5 ? sub[((u >> 1) + (y & 1)) & 1] : my < 1.625 ? teal : mint;
      return my < 2.25 ? ktile[((u >> 1) + (y & 1)) & 1] : kUpper;
    };
    // floors
    B(0, -0.25, 10.25, 16, 0.25, 15.75, (x, y, z) => {
      if (y < Y(0.25) - 1) return P.tileC;
      const mx = OX + (x + 0.5) * VS, mz = OZ + (z + 0.5) * VS, reg = region(mx, mz);
      if (reg === 'hall') return ((x + z) & 1) ? blackT : whiteT;
      if (reg === 'rest') return ((x >> 1) + (z >> 1)) & 1 ? blackT : whiteT;
      if (mz > 14.0 && mz < 14.875 && mx > 6.0 && mx < 14.75) return ((x + z) % 3 === 0) ? quarry[0] : mat; // rubber mat at the line
      return quarry[((x >> 1) + (z >> 1)) & 1];
    });
    // shell: outer walls (inside faces), back of the dining-room wall, ceiling with acoustic tiles
    B(0.125, 0.25, 10.25, 0.25, 3.0, 15.75, (x, y, z) => wallFinish('hall', z, y));
    B(15.75, 0.25, 10.25, 15.875, 3.0, 15.75, (x, y, z) => wallFinish('kitchen', z, y));
    B(15.875, 0.25, 10.25, 16, 4.4, 16, P.brickG[0]);
    B(0, 0.25, 15.875, 16, 4.4, 16, P.brickG[1]);
    B(0.25, 0.25, 15.75, 15.75, 3.0, 15.875, (x, y) => wallFinish(region(OX + (x + 0.5) * VS, 15), x, y));
    for (let x = X(0.25); x < X(15.75); x++) for (let y = Y(0.25); y < Y(3.0); y++) {
      if (G.get(x, y, Z(10.125)) === 0) continue; // keep the doorways and pass open
      G.set(x, y, Z(10.125), wallFinish(region(OX + (x + 0.5) * VS, 11), x, y));
    }
    B(0.25, 3.0, 10.25, 15.75, 3.125, 15.75, (x, y, z) => ((x & 3) === 0 || (z & 3) === 0 ? ceilG : ceilT));
    B(0, 3.125, 10.25, 16, 3.75, 16, P.brickG[1]);
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

  // ------------------------------------------------------------ bodega (x 16..22)
  {
    const set = face('z', 0, -1);
    for (let u = X(16.25); u < X(20.5); u++) for (let y = Y(0.6); y < Y(2.8); y++) {
      set(u, y, 0, 0);
      const ly = y - Y(0.6);
      const c = (ly % 5 === 0) ? P.shelfD : (ly % 5 >= 3 && hash01(u, y, 8) > 0.35) ? C(['#e04a3a', '#f2c63c', '#4aa0e0', '#e88a2a', '#7ac04a', '#f4f4f0'][Math.floor(hash01(u, y, 9) * 5.99)], 0.9, 0.1) : P.fluor;
      set(u, y, -1, c);
    }
    for (let u = X(16.25); u < X(20.5); u++) { set(u, Y(0.6) - 1, 1, P.chrome); set(u, Y(2.8), 1, P.chrome); }
    for (let u = X(20.75); u < X(21.75); u++) for (let y = Y(0.125); y < Y(2.5); y++) {
      set(u, y, 0, 0);
      set(u, y, -1, (u === X(20.75) || u === X(21.75) - 1 || y === Y(2.5) - 1) ? P.steelD : (y === Y(1.1) ? P.steel : P.fluorW));
    }
    for (let d = 1; d <= 8; d++) {
      const yt = Y(3.0) - Math.floor(d * 0.5);
      for (let u = X(16.125); u < X(22); u++) { set(u, yt, d, ((u >> 2) & 1) ? P.green : P.greenD); if (d === 8) { set(u, yt - 1, d, P.greenD); set(u, yt - 2, d, P.awnTrim); } }
    }
    for (let u = X(16.125); u < X(22); u++) for (let y = Y(3.1); y < Y(4.1); y++) set(u, y, 1, P.counterRed);
    const str = 'DELI', w = textWidth(str), u0 = X(19) + (w >> 1);
    glyphPixels(str, (c, r) => set(u0 - c, Y(3.95) - r, 2, P.neonY));
    meta.lights.push({ pos: [18.8, 1.6, -1.4], color: 0xd8ecff, intensity: 6, distance: 8, name: 'bodega' });
  }

  // ------------------------------------------------------------ tenement (x 22..36) with sidewalk shed
  {
    const set = face('z', 0, -1);
    for (let u = X(22.5); u < X(24.0); u++) for (let y = Y(0.9); y < Y(2.7); y++) {
      set(u, y, 0, (u & 1) ? P.iron : 0);
      set(u, y, -1, hash01(u, y, 4) > 0.4 ? P.winDark[0] : P.winDark[1]);
    }
    for (let u = X(24.25); u < X(25.75); u++) for (let y = Y(0.125); y < Y(2.75); y++) {
      set(u, y, 0, 0); set(u, y, -1, y > Y(2.2) ? P.winWarm2 : P.door);
    }
    set(X(24.0), Y(2.25), 1, P.sconce);
    for (let u = X(26.25); u < X(35.75); u++) for (let y = Y(0.125); y < Y(3.0); y++) {
      const blob = hash3(u >> 3, y >> 2, 41) + hash3(u >> 1, y >> 1, 42) * 0.4;
      set(u, y, 0, (y > Y(0.6) && y < Y(2.4) && blob > 0.75) ? P.graf[Math.floor(hash01(u >> 4, y >> 3, 43) * 4.99)] : P.shutter[y & 1]);
    }
    for (let x = X(26); x < X(36); x++) for (let z = Z(-4.75); z < Z(0); z++) { G.set(x, Y(3.25), z, P.shedG); G.set(x, Y(3.375), z, P.shedG); }
    for (let x = X(26); x < X(36); x++) for (let y = Y(3.5); y < Y(4.25); y++) G.set(x, y, Z(-4.75), P.shedG);
    for (const px of [26, 28.5, 31, 33.5, 35.875]) for (let y = Y(0.125); y < Y(3.25); y++) { G.set(X(px), y, Z(-4.625), P.shedG); G.set(X(px), y, Z(-0.25), P.shedG); }
    for (let x = X(27.25); x < X(36); x += 20) for (let z = Z(-2.25); z < Z(-2.0); z++) G.set(x, Y(3.25) - 1, z, P.bulb);
  }

  // ------------------------------------------------------------ far side storefronts (face +z)
  {
    const set = face('z', -13.5, 1);
    const store = (a, b, y0, y1, fn) => { for (let u = X(a); u < X(b); u++) for (let y = Y(y0); y < Y(y1); y++) { set(u, y, 0, 0); set(u, y, -1, fn(u - X(a), y - Y(y0), u, y)); } };
    store(0.5, 6.5, 0.5, 2.9, (lu, ly, u, y) => (ly % 6 === 0 ? P.shelfD : (ly % 6 >= 4 && hash01(u, y, 12) > 0.5 ? C('#ffffff', 1.0, 0.15) : P.fluorW)));
    store(7.0, 8.5, 0.125, 2.6, () => P.fluorW);
    for (let u = X(0); u < X(10); u++) for (let y = Y(3.0); y < Y(4.0); y++) set(u, y, 1, P.blueSign);
    { const str = 'PHARMACY', w = textWidth(str), u0 = X(5) - (w >> 1); glyphPixels(str, (c, r) => set(u0 + c, Y(3.85) - r, 2, P.white)); }
    for (let d = 1; d < 9; d++) for (let y = Y(3.3); y < Y(4.6); y++) {
      const ly = y - Y(3.3), ld = d - 1;
      if ((ly >= 3 && ly <= 7) || (ld >= 2 && ld <= 5 && ly >= 0 && ly <= 10)) { set(X(9.5), y, d, P.neonG); set(X(9.5) + 1, y, d, P.neonG); }
    }
    meta.lights.push({ pos: [4, 1.8, -12.0], color: 0xdff0ff, intensity: 7, distance: 9, name: 'pharmacy' });
    store(10.5, 23.5, 0.5, 2.9, (lu, ly, u, y) => {
      if (lu % 20 === 0) return P.steelD;
      if (ly < 9) { const cx = lu % 6, d = Math.hypot(cx - 2.5, (ly % 9) - 4); return ly === 8 ? P.steel : d < 2.2 ? C('#9cc4dc', 0.8, 0.1) : P.steel; }
      return ly > 16 || hash01(u >> 2, y >> 2, 21) > 0.2 ? P.fluor : P.shelfD;
    });
    for (let u = X(10); u < X(24); u++) for (let y = Y(3.0); y < Y(4.0); y++) set(u, y, 1, P.signBg);
    { const str = 'LAUNDROMAT', w = textWidth(str), u0 = X(17) - (w >> 1); glyphPixels(str, (c, r) => set(u0 + c, Y(3.85) - r, 2, P.neonP)); }
    meta.lights.push({ pos: [17, 1.8, -12.0], color: 0xc8e4ff, intensity: 8, distance: 10, name: 'laundry' });
    for (let u = X(24.5); u < X(35.5); u++) for (let y = Y(0.125); y < Y(3.0); y++) {
      if (u >= X(30) && u < X(31.5)) { set(u, y, 0, 0); set(u, y, -1, y > Y(2.3) ? P.winWarm2 : P.door); continue; }
      const blob = hash3(u >> 3, y >> 2, 51) + hash3(u >> 1, y >> 1, 52) * 0.4;
      set(u, y, 0, (y > Y(0.6) && y < Y(2.5) && blob > 0.7) ? P.graf[Math.floor(hash01(u >> 4, y >> 3, 53) * 4.99)] : P.shutter[y & 1]);
    }
    set(X(29.75), Y(2.4), 1, P.sconce); set(X(31.75), Y(2.4), 1, P.sconce);
  }
  // across the avenue: pizza place (faces +x, text runs toward -z)
  {
    const set = face('x', -9.5, 1);
    for (let u = Z(-7); u < Z(1); u++) for (let y = Y(0.5); y < Y(2.9); y++) {
      set(u, y, 0, 0);
      const lu = u - Z(-7), ly = y - Y(0.5);
      set(u, y, -1, lu % 16 === 0 ? P.steelD : (ly < 7 && lu % 16 > 2 && lu % 16 < 13) ? (ly === 6 ? P.steel : P.counterRed) : (ly > 13 && ly < 17 && hash01(u >> 1, 0, 7) > 0.4) ? P.menuBg : C('#ffc88a', 0.75, 0.15));
    }
    for (let u = Z(-7.5); u < Z(1.5); u++) for (let y = Y(3.0); y < Y(4.0); y++) set(u, y, 1, P.signBg);
    const str = 'PIZZA', w = textWidth(str), u0 = Z(-3) + (w >> 1);
    glyphPixels(str, (c, r) => set(u0 - c, Y(3.85) - r, 2, r < 3 ? P.neonR : P.neonG));
  }

  // ------------------------------------------------------------ street lamps + signals
  const streetLamp = (x, z, armDir, warm) => {
    B(x - 0.125, 0.125, z - 0.125, x + 0.125, 0.5, z + 0.125, P.pole);
    B(x, 0.5, z, x + 0.125, 7.0, z + 0.125, P.pole);
    const steps = 12;
    for (let i = 0; i <= steps; i++) G.set(X(x), Y(7.0) + Math.min(i, 3), Z(z) + armDir * i, P.pole);
    const hz = Z(z) + armDir * steps;
    for (let dz = -1; dz <= 2; dz++) for (let dx = -1; dx <= 1; dx++) { G.set(X(x) + dx, Y(7.0) + 3, hz + armDir * dz, P.pole); G.set(X(x) + dx, Y(7.0) + 4, hz + armDir * dz, P.pole); }
    for (let dz = 0; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) G.set(X(x) + dx, Y(7.0) + 2, hz + armDir * dz, warm ? P.lampHead : P.lampHeadC);
    const lz = OZ + (hz + 0.5 + armDir * 0.5) * VS;
    meta.lights.push({ pos: [x + 0.06, 6.75, lz], color: warm ? 0xff9a40 : 0xcfdcff, intensity: warm ? 40 : 26, distance: 18, name: 'streetlamp' });
  };
  streetLamp(20.5, -4.5, -1, true);
  streetLamp(3.5, -11.25, 1, false);
  const signalPole = (x, z) => {
    B(x - 0.125, 0.125, z - 0.125, x + 0.125, 0.4, z + 0.125, P.pole);
    B(x, 0.4, z, x + 0.125, 4.4, z + 0.125, P.pole);
    B(x + 0.125, 3.25, z - 0.125, x + 0.375, 4.375, z + 0.25, P.signalBox);
    meta.signals.push({ x: x + 0.39, z: z + 0.0625, y: [4.15, 3.85, 3.55] });
  };
  signalPole(-1.25, -4.75);
  signalPole(-1.25, -11.25);

  return meta;
}
