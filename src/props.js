// Prop models (finer voxel scales) and their placement in and around the diner.
import * as THREE from 'three';
import { Model, C, rng, hash01, glyphPixels, textWidth } from './voxel.js';

const memo = (fn) => { let m; return () => m || (m = fn()); };

// ---------------------------------------------------------------- shared colors
const K = {
  wood: C('#5a2618', 0, 0.06), woodD: C('#3e180e', 0, 0.05), woodL: C('#8a5a32', 0, 0.06), oak: C('#9a6236', 0, 0.07),
  seatRed: C('#6a1820', 0, 0.06), vinyl: C('#a3a476', 0, 0.05), vinylD: C('#7e7f52', 0, 0.05),
  chrome: C('#c9ced4', 0, 0.04), chromeD: C('#8c9197', 0, 0.04), black: C('#141416', 0, 0.04),
  formica: C('#ebe2cc', 0, 0.03), white: C('#eeeae2', 0, 0.03), steel: C('#9aa0a6', 0, 0.05),
  brass: C('#a7843e', 0, 0.06), cream: C('#e6dcc4', 0, 0.04),
};

// ---------------------------------------------------------------- furniture
// cherry slat-back chair (faces -z, back at +z)
export const chair = memo(() => {
  const m = new Model(8, 15, 8, 1 / 16);
  for (const [x, z] of [[0, 0], [7, 0], [0, 7], [7, 7]]) m.box(x, 0, z, x + 1, 7, z + 1, K.wood);
  m.box(0, 2, 0, 1, 3, 8, K.woodD); m.box(7, 2, 0, 8, 3, 8, K.woodD); m.box(0, 2, 0, 8, 3, 1, K.woodD);
  m.box(0, 6, 0, 8, 7, 8, K.wood);
  m.box(0, 7, 0, 8, 8, 8, K.seatRed);
  m.box(0, 8, 7, 1, 15, 8, K.wood); m.box(7, 8, 7, 8, 15, 8, K.wood);
  m.box(1, 14, 7, 7, 15, 8, K.wood); m.box(1, 13, 7, 7, 14, 8, K.woodD);
  for (const x of [2, 4, 5]) m.box(x, 8, 7, x + 1, 13, 8, K.wood);
  return m;
});

// table with a patterned cloth and a glass top (kind: 0 floral, 1 green rings, 2 patchwork, 3 rose)
function clothColor(kind, a, b) {
  if (kind === 0) { const f = hash01(a >> 1, b >> 1, 3); return f > 0.72 ? C('#b8583a', 0, 0.08) : f > 0.55 ? C('#d89a78', 0, 0.08) : C('#efe2c8', 0, 0.05); }
  if (kind === 1) { const r = Math.hypot((a & 3) - 1.5, (b & 3) - 1.5); return r > 1.2 && r < 2.0 ? C('#e8e4c8', 0, 0.05) : C('#6a8a3a', 0, 0.06); }
  if (kind === 2) return C(['#4a6a5a', '#9a7a3a', '#5a5a7a', '#a8a070', '#3a4a3a'][Math.floor(hash01(a >> 1, b >> 1, 9) * 4.99)], 0, 0.06);
  const f = hash01(a >> 1, b >> 1, 4); return f > 0.6 ? C('#a03a3a', 0, 0.08) : C('#d8b8a0', 0, 0.06);
}
const clothCache = {};
export const table = (kind = 0) => clothCache[kind] || (clothCache[kind] = (() => {
  const m = new Model(13, 12, 13, 1 / 16);
  m.box(5, 0, 5, 8, 10, 8, K.black);
  m.box(1, 0, 6, 12, 1, 7, K.black); m.box(6, 0, 1, 7, 1, 12, K.black);
  m.box(1, 10, 1, 12, 11, 12, K.woodD);
  for (let x = 0; x < 13; x++) for (let z = 0; z < 13; z++) m.set(x, 11, z, (x === 0 || z === 0 || x === 12 || z === 12) ? clothColor(kind, x, z) : C('#cfd8d4', 0, 0.03));
  for (let y = 7; y < 11; y++) for (let i = 0; i < 13; i++) {
    if (y === 7 && (i & 1)) continue;
    m.set(i, y, 0, clothColor(kind, i, y)); m.set(i, y, 12, clothColor(kind, i, y + 5)); m.set(0, y, i, clothColor(kind, y, i)); m.set(12, y, i, clothColor(kind, y + 3, i));
  }
  return m;
})());

// cream formica table with an oak edge
export const formicaTable = memo(() => {
  const m = new Model(13, 12, 13, 1 / 16);
  m.box(6, 0, 6, 7, 11, 7, K.black);
  m.box(2, 0, 6, 11, 1, 7, K.black); m.box(6, 0, 2, 7, 1, 11, K.black);
  m.box(0, 11, 0, 13, 12, 13, (x, y, z) => (x === 0 || z === 0 || x === 12 || z === 12 ? K.oak : K.formica));
  return m;
});

// counter swivel chair: cream vinyl, wood-grain side panels, black pedestal (faces -z)
export const stool = memo(() => {
  const m = new Model(8, 17, 8, 1 / 16);
  m.cyl(4, 4, 2.6, 0, 1, K.black);
  m.box(3, 1, 3, 5, 9, 5, K.black);
  m.box(0, 9, 0, 8, 11, 8, K.cream);
  m.box(0, 11, 6, 8, 16, 8, K.cream);
  for (const x of [0, 7]) m.box(x, 9, 4, x + 1, 16, 8, C('#a0603a', 0, 0.07));
  m.box(1, 16, 6, 7, 17, 8, K.cream);
  return m;
});

// booth: wall side is +x, length along z. Sage vinyl with channel tufting, oak frame with curved caps.
export const booth = memo(() => {
  const m = new Model(21, 19, 35, 1 / 16);
  const bench = (z0, z1, back0, back1) => {
    m.box(0, 0, z0, 21, 5, z1, K.oak);
    m.box(0, 5, z0, 21, 7, z1, K.vinyl);
    m.box(0, 6, z0 === 0 ? z1 - 1 : z0, 21, 7, z0 === 0 ? z1 : z0 + 1, K.vinylD);
    m.box(0, 7, back0, 21, 17, back1, (x) => (x % 4 === 0 ? K.vinylD : K.vinyl));
    m.box(0, 17, back0, 21, 18, back1, K.oak);
    for (let x = 0; x < 21; x++) if (x > 3 && x < 17) m.set(x, 18, back0 + 1, K.oak); // curved cap
    m.box(0, 0, back0, 1, 18, back1, K.oak);
  };
  bench(0, 9, 0, 3);
  bench(26, 35, 32, 35);
  m.box(6, 11, 10, 21, 12, 25, (x, y, z) => (x === 6 || z === 10 || z === 24 ? K.oak : K.formica));
  m.box(19, 0, 17, 21, 11, 18, K.black);
  return m;
});

// ---------------------------------------------------------------- lamps
const tiffanyCache = {};
export const tiffany = (chain = 14) => tiffanyCache[chain] || (tiffanyCache[chain] = (() => {
  const m = new Model(13, 7 + chain, 13, 1 / 16);
  const amber = C('#e6a54a', 1.0, 0.08), cream = C('#f3dfa6', 0.85, 0.08), red = C('#d8452f', 1.2, 0.08),
    pink = C('#ea7f7a', 1.05, 0.08), green = C('#4f9a46', 1.0, 0.08), blue = C('#2f5fd0', 1.2, 0.08),
    white = C('#f4ecdc', 1.1, 0.05), lead = C('#2a2016', 0, 0.05), bulb = C('#fff0c8', 9, 0.02);
  const radii = [6.4, 6.2, 5.8, 5.1, 4.1, 2.8];
  for (let y = 0; y < 6; y++) {
    m.cyl(6.5, 6.5, radii[y], y, y + 1, (x, yy, z, ang) => {
      const s = Math.floor((ang + Math.PI) / (Math.PI * 2) * 18);
      if (hash01(x, y, z) > 0.93) return lead;
      if (y === 0) return s & 1 ? amber : white;
      if (y === 1) return s % 3 === 0 ? white : blue;
      if (y === 2) return s % 3 === 0 ? red : s % 3 === 1 ? green : cream;
      if (y === 3) return s % 3 === 0 ? pink : s % 3 === 2 ? green : cream;
      if (y === 4) return s & 1 ? amber : cream;
      return green;
    }, radii[y] - 1.4);
  }
  m.cyl(6.5, 6.5, 1.6, 6, 7, K.brass);
  m.box(6, 7, 6, 7, 7 + chain, 7, C('#3a2a18', 0, 0.05));
  m.box(5, 2, 5, 8, 4, 8, bulb);
  return m;
})());

export const milkGlobe = memo(() => {
  const m = new Model(7, 12, 7, 1 / 16);
  m.sphere(3.5, 3.4, 3.5, 3.3, 3.2, 3.3, C('#ffe2b8', 1.1, 0.03));
  m.box(2, 6, 2, 5, 7, 5, K.brass);
  m.box(3, 7, 3, 4, 12, 4, K.black);
  return m;
});

// ---------------------------------------------------------------- tabletop bits (1/32)
const coffee = C('#2a1608', 0, 0.05);
function mugAt(m, x, z) {
  m.cyl(x + 1.5, z + 1.5, 1.6, 0, 4, K.white);
  m.set(x + 1, 3, z + 1, coffee);
  m.set(x + 3, 1, z + 1, K.white); m.set(x + 3, 2, z + 1, K.white); m.set(x + 4, 1, z + 1, K.white); m.set(x + 4, 2, z + 1, K.white);
}
function napkinAt(m, x, z) { m.box(x, 0, z, x + 5, 5, z + 3, K.chrome); m.box(x + 1, 5, z + 1, x + 4, 6, z + 2, K.white); m.box(x + 1, 2, z, x + 4, 4, z + 1, K.white); }
function sugarAt(m, x, z) { m.box(x, 0, z, x + 3, 5, z + 3, C('#dfe6e8', 0, 0.04)); m.box(x, 5, z, x + 3, 7, z + 3, K.chrome); m.set(x + 1, 7, z + 1, K.chrome); }
function ketchupAt(m, x, z) { m.box(x, 0, z, x + 2, 6, z + 2, C('#b0141c', 0, 0.06)); m.box(x, 6, z, x + 2, 8, z + 2, K.white); m.box(x, 2, z, x + 2, 4, z + 1, K.white); }
function shakersAt(m, x, z) { m.box(x, 0, z, x + 1, 4, z + 1, K.white); m.set(x, 4, z, K.chrome); m.box(x + 2, 0, z, x + 3, 4, z + 1, C('#3a3a3a', 0, 0.05)); m.set(x + 2, 4, z, K.chrome); }
function menuAt(m, x, z) { m.box(x, 0, z, x + 6, 1, z + 2, K.black); m.box(x, 1, z, x + 6, 9, z + 1, C('#5a1018', 0, 0.05)); m.box(x + 1, 2, z, x + 5, 8, z + 1, C('#e9dcc0', 0, 0.05)); }

function tableSet(variant) {
  const m = new Model(26, 10, 26, 1 / 32);
  const r = rng(variant * 31 + 7);
  // condiments only: tables start clear so the only dishes you see are ones customers actually used
  napkinAt(m, 10, 1); sugarAt(m, 16, 1); ketchupAt(m, 7, 1); shakersAt(m, 20, 1); menuAt(m, 2, 1);
  r();
  return m;
}
const tableSets = [0, 1, 2, 3].map((v) => memo(() => tableSet(v)));

// ---------------------------------------------------------------- counter + back-bar stuff
const counterBits = memo(() => {
  const m = new Model(8, 9, 4, 1 / 32);
  napkinAt(m, 0, 0); sugarAt(m, 5, 0);
  return m;
});
const pieRack = memo(() => {
  const m = new Model(13, 20, 11, 1 / 32);
  for (const [x, z] of [[0, 0], [12, 0], [0, 10], [12, 10]]) m.box(x, 0, z, x + 1, 20, z + 1, K.chrome);
  const crust = C('#c99a5a', 0, 0.06);
  const fills = [C('#8e1a28', 0, 0.06), C('#efd25a', 0, 0.05), C('#3e2416', 0, 0.06), C('#e8a24a', 0, 0.06)];
  for (let s = 0; s < 3; s++) {
    const y = s * 7;
    m.box(0, y, 0, 13, y + 1, 11, K.chrome);
    const f = fills[s];
    m.cyl(6.5, 5.5, 4.6, y + 1, y + 3, (x, yy, z) => (yy === y + 2 && ((x + z) & 1) ? f : crust));
    if (s === 1) m.box(2, y + 3, 3, 11, y + 4, 8, C('#f6f2e4', 0, 0.03)); // meringue
  }
  m.box(0, 19, 0, 13, 20, 11, K.chrome);
  return m;
});
const cakeStand = memo(() => {
  const m = new Model(11, 13, 11, 1 / 32);
  m.cyl(5.5, 5.5, 2.2, 0, 1, K.chrome); m.box(5, 1, 5, 6, 4, 6, K.chrome); m.cyl(5.5, 5.5, 5.4, 4, 5, K.chrome);
  const choc = C('#3a2014', 0, 0.06), cream = C('#e8dcc4', 0, 0.04);
  m.cyl(5.5, 5.5, 4.4, 5, 12, (x, y, z, a) => (a > 0.2 && a < 1.5 ? null : (y === 8 ? cream : choc)));
  m.cyl(5.5, 5.5, 4.4, 12, 13, (x, y, z) => ((x + z) & 1 ? cream : choc));
  return m;
});
const urn = memo(() => {
  const m = new Model(8, 14, 8, 1 / 16);
  m.box(1, 0, 1, 2, 2, 2, K.black); m.box(6, 0, 1, 7, 2, 2, K.black); m.box(1, 0, 6, 2, 2, 7, K.black); m.box(6, 0, 6, 7, 2, 7, K.black);
  m.cyl(4, 4, 3.4, 2, 12, (x, y) => (y === 6 ? K.chromeD : K.steel));
  m.cyl(4, 4, 2.2, 12, 13, K.chrome); m.box(3, 13, 3, 5, 14, 5, K.black);
  m.box(3, 3, 0, 5, 4, 1, K.black); m.set(4, 2, 0, K.black);
  m.set(2, 8, 0, C('#ff3020', 4, 0.02)); m.set(6, 8, 0, C('#30ff60', 3, 0.02));
  return m;
});
const brewer = memo(() => {
  const m = new Model(16, 20, 10, 1 / 32);
  m.box(0, 0, 4, 16, 2, 10, K.steel); m.box(0, 14, 0, 16, 20, 10, K.steel); m.box(0, 2, 7, 16, 14, 10, K.black);
  const pot = C('#3a2010', 0, 0.06), orange = C('#e06a1c', 0, 0.05);
  for (const [x, h] of [[2, orange], [10, K.black]]) {
    m.cyl(x + 2, 4, 2.6, 2, 8, (vx, y) => (y >= 6 ? C('#c8d4da', 0, 0.04) : pot));
    m.box(x + 1, 8, 2, x + 4, 9, 6, h); m.box(x + 1, 9, 2, x + 4, 11, 4, K.black);
  }
  m.set(14, 17, 0, C('#ff6a20', 3, 0.02));
  return m;
});
const mixer = memo(() => {
  const m = new Model(8, 16, 6, 1 / 32);
  const mint = C('#8fd6b8', 0, 0.04);
  m.box(0, 0, 0, 8, 2, 6, mint); m.box(5, 2, 2, 8, 16, 5, mint); m.box(1, 13, 2, 5, 16, 5, mint);
  m.cyl(2.5, 3.5, 1.8, 3, 11, K.chrome); m.box(2, 11, 3, 3, 13, 4, K.chrome);
  return m;
});
const plates = memo(() => {
  const m = new Model(9, 14, 9, 1 / 32);
  m.cyl(4.5, 4.5, 4.4, 0, 14, (x, y) => (y % 2 ? K.white : C('#d8d2c4', 0, 0.02)));
  return m;
});
const register = memo(() => {
  const m = new Model(12, 12, 10, 1 / 32);
  m.box(0, 0, 2, 12, 5, 10, K.brass); m.box(1, 5, 4, 11, 8, 10, K.brass);
  for (let x = 2; x < 10; x += 2) for (let z = 3; z < 9; z += 2) m.set(x, 5, z - 1, K.white);
  m.box(3, 8, 7, 9, 12, 9, K.brass); m.box(4, 9, 6, 8, 11, 7, C('#7affb0', 2.0, 0.02));
  m.box(0, 0, 0, 12, 3, 2, K.brass);
  return m;
});
const bell = memo(() => { const m = new Model(4, 3, 4, 1 / 32); m.cyl(2, 2, 2, 0, 1, K.black); m.cyl(2, 2, 1.6, 1, 3, K.chrome); return m; });
const glassesRow = memo(() => {
  const m = new Model(36, 4, 3, 1 / 32);
  const gl = C('#cfe2ea', 0, 0.05), glD = C('#a9c2cc', 0, 0.05);
  for (let x = 0; x < 36; x += 3) m.box(x, 0, 0, x + 2, 4, 2, (vx, y) => (y === 3 ? glD : gl));
  return m;
});
const mugRow = memo(() => {
  const m = new Model(36, 4, 4, 1 / 32);
  for (let x = 0; x < 34; x += 5) mugAt(m, x, 0);
  return m;
});
const pothos = memo(() => {
  const m = new Model(10, 16, 7, 1 / 32, [5, 10, 3.5]);
  const terr = C('#a4572e', 0, 0.06);
  m.box(2, 10, 1, 8, 15, 6, terr); m.box(3, 15, 2, 7, 16, 5, C('#2a1a10', 0, 0.05));
  const lv = [C('#3f7a34', 0, 0.12), C('#5a9a40', 0, 0.12), C('#2e5e28', 0, 0.1)];
  const r = rng(77);
  for (let s = 0; s < 4; s++) {
    let x = 2 + Math.floor(r() * 6), z = 1 + Math.floor(r() * 5);
    for (let y = 15; y > 15 - 8 - s * 3 && y >= 0; y--) {
      if (y < 11) { x += r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0; x = Math.max(0, Math.min(9, x)); }
      m.set(x, y + 1, z === 3 ? 0 : z, lv[Math.floor(r() * 3)]);
      if (y < 11 && r() < 0.5) m.set(Math.min(9, x + 1), y, 0, lv[Math.floor(r() * 3)]);
    }
  }
  for (let x = 1; x < 9; x++) for (let z = 1; z < 6; z++) if (r() < 0.6) m.set(x, 16 - 0, z, lv[Math.floor(r() * 3)]);
  return m;
});

// ---------------------------------------------------------------- features
export const jukebox = memo(() => {
  const m = new Model(14, 23, 9, 1 / 16);
  const body = C('#5a2a14', 0, 0.06);
  const bands = [C('#ff9a2a', 3.0, 0.03), C('#ffd84a', 3.0, 0.03), C('#ff4fa0', 3.0, 0.03)];
  m.box(0, 0, 1, 14, 14, 9, body);
  m.box(1, 0, 0, 2, 1, 1, K.chrome); m.box(12, 0, 0, 13, 1, 1, K.chrome);
  for (let y = 14; y < 23; y++) for (let x = 0; x < 14; x++) {
    const d = Math.hypot(x + 0.5 - 7, y - 14);
    if (d > 7.2) continue;
    for (let z = 1; z < 9; z++) m.set(x, y, z, body);
    m.set(x, y, 0, d > 6.1 ? bands[0] : d > 5.1 ? bands[1] : d > 4.1 ? bands[2] : (d < 2.2 ? K.chrome : C('#15121e', 0, 0.05)));
  }
  for (let y = 9; y < 14; y++) for (let x = 2; x < 12; x++) m.set(x, y, 0, (x === 2 || x === 11 || y === 13) ? K.chrome : C('#2a2236', 0, 0.06));
  m.box(5, 10, 0, 9, 11, 1, C('#e8e0d0', 1.2, 0.05));
  for (let y = 2; y < 8; y++) for (let x = 2; x < 12; x++) m.set(x, y, 0, (x + y) & 1 ? K.chrome : K.black);
  for (let y = 1; y < 14; y++) { m.set(0, y, 0, C('#40d8ff', 3.0, 0.05)); m.set(13, y, 0, C('#40d8ff', 3.0, 0.05)); }
  m.box(1, 8, 0, 13, 9, 1, K.chrome); m.box(1, 1, 0, 13, 2, 1, K.chrome);
  return m;
});

export const clockFace = memo(() => {
  const m = new Model(11, 11, 2, 1 / 16, [5.5, 5.5, 2]);
  const face = C('#f2ead6', 0.7, 0.02), rim = C('#a01c22', 0, 0.04), tick = C('#1a1a1a', 0, 0.02);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
    const d = Math.hypot(x + 0.5 - 5.5, y + 0.5 - 5.5);
    if (d > 5.5) continue;
    m.set(x, y, 1, rim);
    if (d > 4.6) { m.set(x, y, 0, rim); continue; }
    const a = Math.atan2(y + 0.5 - 5.5, x + 0.5 - 5.5);
    const near12 = Math.abs(((a / (Math.PI / 6)) % 1 + 1) % 1 - 0) < 0.2 || Math.abs(((a / (Math.PI / 6)) % 1 + 1) % 1 - 1) < 0.2;
    m.set(x, y, 0, d > 3.6 && near12 ? tick : face);
  }
  return m;
});

export const fanBody = memo(() => {
  const m = new Model(5, 7, 5, 1 / 16);
  m.box(2, 3, 2, 3, 7, 3, K.brass); m.cyl(2.5, 2.5, 2.4, 0, 3, K.brass); m.set(2, 0, 2, C('#ffe0a0', 2, 0.02));
  return m;
});
export const fanBlades = memo(() => {
  const m = new Model(27, 1, 27, 1 / 16);
  const bl = C('#5a3a20', 0, 0.06);
  m.box(11, 0, 0, 16, 1, 11, bl); m.box(11, 0, 16, 16, 1, 27, bl);
  m.box(0, 0, 11, 11, 1, 16, bl); m.box(16, 0, 11, 27, 1, 16, bl);
  m.box(12, 0, 12, 15, 1, 15, K.brass);
  return m;
});

export const cat = memo(() => {
  const m = new Model(15, 9, 8, 1 / 32);
  const o = C('#c8783a', 0, 0.06), st = C('#94501f', 0, 0.06), wh = C('#efe2cc', 0, 0.04), dk = C('#2a1a12', 0, 0.02), pk = C('#e09090', 0, 0.02);
  m.sphere(8.5, 2.6, 4, 6, 3.0, 3.6, (x) => (x % 3 === 0 ? st : o));
  m.sphere(3.2, 4.0, 4, 2.6, 2.5, 2.6, (x, y) => (y < 3 && x < 3 ? wh : o));
  m.set(2, 7, 2, o); m.set(2, 7, 5, o); m.set(3, 7, 2, st); m.set(3, 7, 5, st);
  m.set(0, 4, 3, dk); m.set(0, 4, 4, dk); m.set(1, 5, 2, dk); m.set(1, 5, 5, dk); m.set(0, 3, 3, pk);
  for (let x = 3; x < 14; x++) m.set(x, 0, 7, x % 3 === 0 ? st : o);
  m.set(2, 0, 6, o); m.set(3, 1, 7, o);
  return m;
});

const gumball = memo(() => {
  const m = new Model(10, 30, 10, 1 / 32);
  const red = C('#c01c24', 0, 0.05);
  m.box(2, 0, 2, 8, 2, 8, red); m.box(4, 2, 4, 6, 14, 6, red); m.box(2, 14, 2, 8, 19, 8, red);
  m.box(4, 15, 1, 6, 17, 2, K.chrome);
  const cols = ['#f4f4f4', '#ffd23a', '#ff4a8a', '#4ab0ff', '#5ae070', '#ff8a2a', '#c86aff', '#ff3030'].map((h) => C(h, 0, 0.05));
  m.sphere(5, 23.5, 5, 4.6, 4.6, 4.6, (x, y, z) => cols[Math.floor(hash01(x, y, z) * 7.99)]);
  m.box(3, 28, 3, 7, 30, 7, red);
  return m;
});
const umbrellaStand = memo(() => {
  const m = new Model(8, 30, 8, 1 / 32);
  m.cyl(4, 4, 3.6, 0, 14, (x, y) => (y % 4 === 0 ? K.chromeD : C('#2e3a2e', 0, 0.05)));
  const blk = C('#1a1a1e', 0, 0.06), rd = C('#8e1a24', 0, 0.06);
  for (let y = 10; y < 28; y++) { m.set(2 + (y > 20 ? 1 : 0), y, 3, blk); if (y > 14 && y < 24) m.set(3, y, 3, blk); }
  m.set(3, 28, 3, K.wood); m.set(2, 29, 3, K.wood);
  for (let y = 10; y < 26; y++) { m.set(5, y, 5, rd); if (y > 13 && y < 22) m.set(6, y, 5, rd); }
  m.set(5, 26, 5, K.chrome);
  return m;
});

// Neon sign in the x-y plane facing -z (text mirrored so it reads from the front)
function neonSign(lines, scale, border) {
  const w = Math.max(...lines.map((l) => textWidth(l.text))) + (border ? 6 : 0);
  const h = lines.length * 9 - 2 + (border ? 6 : 0);
  const m = new Model(w, h, 1, scale, [w / 2, 0, 0.5]);
  const off = border ? 3 : 0;
  lines.forEach((l, li) => {
    const lw = textWidth(l.text), x0 = off + Math.floor((w - 2 * off - lw) / 2);
    glyphPixels(l.text, (c, r) => m.set(w - 1 - (x0 + c), h - 1 - off - li * 9 - r, 0, l.color));
  });
  if (border) for (let x = 0; x < w; x++) for (let y = 0; y < h; y++)
    if ((x === 0 || x === w - 1 || y === 0 || y === h - 1) && !((x === 0 || x === w - 1) && (y === 0 || y === h - 1))) m.set(x, y, 0, border);
  return m;
}
const neonR = C('#ff2a3c', 6, 0.03), neonB = C('#3aa0ff', 5, 0.03), neonP = C('#ff5fb0', 5, 0.03), neonY = C('#ffd25a', 5, 0.03), neonG = C('#38ff86', 4.5, 0.03);
const openSign = memo(() => neonSign([{ text: 'OPEN', color: neonR }], 1 / 32, neonB));
const restroomSign = memo(() => neonSign([{ text: 'RESTROOM', color: neonP }], 1 / 48, neonB));
const beerSign = memo(() => neonSign([{ text: 'COLD', color: neonB }, { text: 'BEER', color: neonY }], 1 / 32, 0));
const lottoSign = memo(() => neonSign([{ text: 'LOTTO', color: neonG }], 1 / 32, neonR));
const coffeeSign = memo(() => neonSign([{ text: 'COFFEE', color: neonY }, { text: '& PIE', color: neonP }], 1 / 40, 0));

// Star string lights: thin wire with warm LEDs ending in an outlined star.
function starStrand(len, withStar, seed) {
  const sw = withStar ? 11 : 3;
  const h = len + (withStar ? 11 : 0);
  const m = new Model(sw, h, 1, 1 / 32, [sw / 2, h, 0.5]);
  const wire = C('#2a2620', 0, 0.02), led = C('#ffd590', 2.6, 0.06);
  const cx = Math.floor(sw / 2);
  for (let y = 0; y < len; y++) m.set(cx, h - 1 - y, 0, (y + seed) % 5 === 0 ? led : wire);
  if (withStar) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i & 1 ? 2.1 : 5.2; pts.push([5.5 + Math.cos(a) * r, 5.5 + Math.sin(a) * r]); }
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
      let dmin = 9;
      for (let i = 0; i < 10; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 10];
        const px = x + 0.5 - ax, py = y + 0.5 - ay, dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
        dmin = Math.min(dmin, Math.hypot(px - dx * t, py - dy * t));
      }
      if (dmin < 0.62) m.set(x, 10 - y, 0, led);
    }
  }
  return m;
}
const strands = [0, 1, 2, 3, 4, 5].map((i) => memo(() => starStrand(14 + i * 7, i % 2 === 0 || i === 5, i)));
const topString = memo(() => {
  const m = new Model(64, 1, 1, 1 / 32, [32, 1, 0.5]);
  for (let x = 0; x < 64; x++) m.set(x, 0, 0, x % 4 === 0 ? C('#ffd590', 2.6, 0.06) : C('#2a2620', 0, 0.02));
  return m;
});

// Signed headshots for the wall of fame: frame, white mat, mostly black & white
function framedPhoto(kind) {
  const m = new Model(10, 12, 1, 1 / 16, [5, 0, 0.5]);
  const r = rng(kind * 17 + 3);
  const frame = [C('#141416', 0, 0.04), C('#6a4022', 0, 0.06), C('#b8963c', 0, 0.06), C('#6a1a1a', 0, 0.05)][kind % 4];
  const mat = C('#e8e4da', 0, 0.03);
  const sepia = kind % 5 === 4;
  const g = (v) => (sepia ? C(['#3a2a1c', '#7a6040', '#b89a70', '#d8c4a0'][v], 0, 0.05) : C(['#1a1a1a', '#5a5a5a', '#9a9a9a', '#d0d0cc'][v], 0, 0.04));
  const hair = g(0), skin = g(2), shirt = g(Math.floor(r() * 2)), bg = g(3), mid = g(1);
  const art = [
    ['BBHHBB', 'BHHHHB', 'BHSSHB', 'BSSSSB', 'BBSSBB', 'BCSSCB', 'CCCCCC', 'CCCCCC'],
    ['BHHHHB', 'HHSSHH', 'HSSSSH', 'HSSSSH', 'HBSSBH', 'HCCCCH', 'CCCCCC', 'CCCCCC'],
    ['MMMMMM', 'BHBBHB', 'SSBBSS', 'SSBBSS', 'CCBBCC', 'CCMBCC', 'CCMMCC', 'MMMMMM'],
    ['BBBBBB', 'BBHHHB', 'BHSSSB', 'BHSSSB', 'BBSSBB', 'BCCCCB', 'CCCCCC', 'CCCCCC'],
  ][kind % 4];
  for (let y = 0; y < 12; y++) for (let x = 0; x < 10; x++) {
    let c = frame;
    if (x > 0 && x < 9 && y > 0 && y < 11) c = mat;
    if (x > 1 && x < 8 && y > 1 && y < 10) {
      const ch = art[9 - y][x - 2];
      c = ch === 'H' ? hair : ch === 'S' ? skin : ch === 'C' ? shirt : ch === 'M' ? mid : bg;
      if (kind % 3 !== 1 && ((x === 6 && y === 3) || (x === 5 && y === 4) || (x === 4 && y === 3) || (x === 7 && y === 4))) c = C('#1a2a6a', 0, 0.04);
    }
    m.set(9 - x, y, 0, c);
  }
  return m;
}
const photos = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => memo(() => framedPhoto(k)));

function usFlag(scale, wave) {
  const w = 19, h = 10;
  const m = new Model(w, h, wave ? 3 : 1, scale, [0, h, 0.5]);
  const red = C('#a8161e', 0, 0.06), wht = C('#e8e2d6', 0, 0.04), blu = C('#1c2a5e', 0, 0.05);
  for (let x = 0; x < w; x++) {
    const z = wave ? Math.round(1 + Math.sin(x * 0.7) * 1.0) : 0;
    for (let y = 0; y < h; y++) {
      const ry = h - 1 - y;
      let c = ry % 2 ? wht : red;
      if (x < 8 && ry < 5) c = ((x + ry) & 1) ? blu : wht;
      if (x < 8 && ry < 5 && (ry % 2 === 1 || x % 2 === 1)) c = blu;
      if (x < 8 && ry < 5 && x % 2 === 0 && ry % 2 === 0) c = wht;
      m.set(x, y, z, c);
    }
  }
  return m;
}
const flagSmall = memo(() => usFlag(1 / 32, false));
export const flagBig = memo(() => {
  const m = usFlag(1 / 14, true);
  return m;
});

// ---------------------------------------------------------------- street furniture
const hydrant = memo(() => {
  const m = new Model(8, 13, 8, 1 / 16);
  const red = C('#a8261e', 0, 0.06), silver = C('#b8bcc0', 0, 0.05);
  m.cyl(4, 4, 3.4, 0, 1, red); m.cyl(4, 4, 2.6, 1, 10, red); m.cyl(4, 4, 3.0, 9, 10, red);
  m.cyl(4, 4, 2.2, 10, 12, silver); m.box(3, 12, 3, 5, 13, 5, silver);
  m.box(0, 6, 3, 8, 8, 5, red); m.box(3, 6, 0, 5, 8, 2, silver);
  return m;
});
const trashCan = memo(() => {
  const m = new Model(9, 14, 9, 1 / 16);
  const g = C('#2f5a3a', 0, 0.05);
  m.cyl(4.5, 4.5, 3.2, 0, 1, g);
  m.cyl(4.5, 4.5, 4.3, 1, 14, (x, y, z) => (y === 13 || y === 6 || ((x + z + y) & 1) ? g : null), 3.4);
  const tr = [C('#e8e4d8', 0, 0.08), C('#8a6a44', 0, 0.08), C('#c83030', 0, 0.06), C('#3a3a3a', 0, 0.06)];
  m.cyl(4.5, 4.5, 3.4, 9, 13, (x, y, z) => (y === 12 && hash01(x, y, z) > 0.5 ? null : tr[Math.floor(hash01(x, y, z) * 3.99)]));
  return m;
});
function newsBox(hex) {
  const m = new Model(8, 13, 7, 1 / 16);
  const c = C(hex, 0, 0.05);
  m.box(0, 0, 0, 8, 1, 7, K.black); m.box(1, 1, 1, 7, 4, 6, K.black);
  m.box(0, 4, 0, 8, 12, 7, c); m.box(0, 12, 1, 8, 13, 7, c);
  m.box(1, 7, 0, 7, 11, 1, C('#d8d8cc', 0, 0.04)); m.box(3, 5, 0, 5, 6, 1, K.chrome);
  return m;
}
const newsBlue = memo(() => newsBox('#2a5aa8'));
const newsRed = memo(() => newsBox('#b02a24'));
const mailbox = memo(() => {
  const m = new Model(9, 17, 8, 1 / 16);
  const b = C('#24427a', 0, 0.05);
  for (const [x, z] of [[0, 0], [8, 0], [0, 7], [8, 7]]) m.box(x, 0, z, x + 1, 4, z + 1, b);
  m.box(0, 4, 0, 9, 13, 8, b);
  m.box(0, 13, 1, 9, 15, 7, b); m.box(0, 15, 2, 9, 16, 6, b);
  m.box(2, 11, 0, 7, 12, 1, K.chromeD);
  return m;
});
const barrier = memo(() => {
  const m = new Model(30, 13, 7, 1 / 16);
  const o = C('#e2641a', 0, 0.05), w = C('#e8e4da', 0, 0.04), o2 = C('#c4521a', 0, 0.05);
  for (let y = 0; y < 13; y++) {
    const inset = y < 4 ? 0 : y < 9 ? 1 : 2;
    m.box(0, y, inset, 30, y + 1, 7 - inset, y === 9 || y === 10 ? w : (y === 0 ? o2 : o));
  }
  m.box(3, 1, 0, 9, 3, 7, null); m.box(21, 1, 0, 27, 3, 7, null);
  for (const x0 of [3, 21]) for (let x = x0; x < x0 + 6; x++) for (let z = 0; z < 7; z++) { m.set(x, 1, z, 0); m.set(x, 2, z, 0); }
  return m;
});
const plyFence = memo(() => {
  const m = new Model(48, 38, 2, 1 / 16);
  const ply = C('#2a4a86', 0, 0.05), white = C('#d8d8d0', 0, 0.06);
  m.box(0, 0, 0, 48, 38, 2, (x, y, z) => (x % 16 === 0 && z === 1 ? C('#203a6c', 0, 0.05) : ply));
  const lines = ['POST NO', 'BILLS'];
  lines.forEach((t, li) => {
    const w = textWidth(t), x0 = Math.floor((48 - w) / 2);
    glyphPixels(t, (c, r) => m.set(47 - (x0 + c), 28 - li * 10 - r, 0, white));
  });
  return m;
});
const fruitStand = memo(() => {
  const m = new Model(48, 15, 13, 1 / 16);
  const crate = C('#6a4a2a', 0, 0.08);
  const fruits = ['#e8781a', '#c41e26', '#f0d040', '#6ab43a', '#7a2a6a', '#e8a030', '#b8d050'].map((h) => C(h, 0, 0.12));
  for (let t = 0; t < 3; t++) {
    const z0 = t * 4, y0 = t * 4;
    m.box(0, 0, z0, 48, y0 + 4, z0 + 5, crate);
    for (let c = 0; c < 6; c++) {
      const f = fruits[(c + t * 2) % fruits.length];
      for (let x = c * 8 + 1; x < c * 8 + 7; x++) for (let z = z0 + 1; z < z0 + 4; z++) {
        m.set(x, y0 + 4, z, f);
        if ((x + z) & 1) m.set(x, y0 + 5, z, f);
      }
    }
  }
  return m;
});

// ---------------------------------------------------------------- vehicles (face -x)
export function car(kind) {
  const m = new Model(74, 24, 30, 1 / 16);
  const paint = kind === 'taxi' ? C('#e8b818', 0, 0.04) : kind === 'maroon' ? C('#4a121a', 0, 0.04) : C('#1d2a40', 0, 0.04);
  const glass = C('#121a24', 0, 0.06), tire = C('#121212', 0, 0.04), rim = C('#8a8a8a', 0, 0.04);
  const head = C('#fff2d0', 8, 0.02), tail = C('#ff1a2a', 5, 0.02), plate = C('#e8e4c8', 0, 0.03);
  const cab = (x, y) => y >= 12 && y < 20 && x >= 18 + Math.max(0, 19 - y) * 0.9 && x < 57 - Math.max(0, y - 16) * 0.8;
  for (let x = 0; x < 74; x++) for (let y = 3; y < 20; y++) for (let z = 2; z < 28; z++) {
    const wheel = Math.hypot(x + 0.5 - 14, y + 0.5 - 5) < 6 || Math.hypot(x + 0.5 - 59, y + 0.5 - 5) < 6;
    if (wheel && y < 10) continue;
    if (y < 12) {
      const nose = x < 2 && (y > 10 || y < 4);
      if (nose) continue;
      if (y === 11 && (x < 18 || x > 57) && (z === 2 || z === 27)) continue;
      let c = paint;
      if (y < 4) c = K.black;
      if (x === 0 || x === 73) c = (y === 4 || y === 5) ? K.chrome : (y < 8 ? K.black : paint);
      if (kind === 'taxi' && y === 8 && x > 18 && x < 56 && (z === 2 || z === 27)) c = (x >> 1) & 1 ? K.black : K.white;
      m.set(x, y, z, c);
    } else if (cab(x, y)) {
      const edgeZ = z === 2 || z === 27;
      const pillar = x === 37 || x === 38 || !cab(x - 1, y) || !cab(x + 1, y) || y === 19;
      const innerGlass = !edgeZ && (x < 21 || x > 54) && y < 19;
      m.set(x, y, z, pillar && !innerGlass ? paint : (edgeZ || innerGlass) ? glass : (y === 19 ? paint : null));
    }
  }
  for (const wx of [14, 59]) for (let x = wx - 5; x < wx + 5; x++) for (let y = 0; y < 10; y++) {
    const d = Math.hypot(x + 0.5 - wx, y + 0.5 - 5);
    if (d > 5) continue;
    for (const z of [2, 3, 4, 25, 26, 27]) m.set(x, y, z, d < 2.6 && (z === 2 || z === 27) ? rim : tire);
  }
  for (const z0 of [3, 23]) { m.box(0, 8, z0, 1, 10, z0 + 4, head); m.box(73, 8, z0 + 1, 74, 11, z0 + 4, tail); }
  m.box(73, 5, 12, 74, 7, 18, plate); m.box(0, 5, 12, 1, 7, 18, plate);
  if (kind === 'taxi') { m.box(34, 20, 11, 42, 23, 19, C('#fff0c0', 2.6, 0.03)); m.box(33, 20, 10, 43, 21, 20, K.black); }
  return m;
}

export const waterTower = memo(() => {
  const m = new Model(24, 46, 24, 1 / 8);
  const steel = C('#2a2a2c', 0, 0.05), st1 = C('#5c4a36', 0, 0.08), st2 = C('#4a3a2a', 0, 0.08), hoop = C('#1e1e20', 0, 0.04);
  for (const [x, z] of [[3, 3], [20, 3], [3, 20], [20, 20]]) m.box(x, 0, z, x + 1, 15, z + 1, steel);
  for (let y = 4; y < 15; y += 5) { m.box(3, y, 3, 21, y + 1, 4, steel); m.box(3, y, 20, 21, y + 1, 21, steel); m.box(3, y, 3, 4, y + 1, 21, steel); m.box(20, y, 3, 21, y + 1, 21, steel); }
  m.cyl(12, 12, 11.5, 15, 16, steel);
  m.cyl(12, 12, 10.3, 16, 38, (x, y, z, a) => (y % 6 === 0 ? hoop : (Math.floor((a + Math.PI) * 6) & 1 ? st1 : st2)), 9);
  for (let y = 38; y < 45; y++) m.cyl(12, 12, 10.6 - (y - 38) * 1.5, y, y + 1, st2);
  m.box(11, 44, 11, 13, 46, 13, steel);
  return m;
});

export const doorModel = memo(() => {
  const m = new Model(19, 38, 2, 1 / 16, [0, 0, 1]);
  const mr = C('#4a1218', 0, 0.05);
  for (let y = 0; y < 38; y++) for (let x = 0; x < 19; x++) {
    const frame = x < 2 || x > 16 || y < 6 || y > 35;
    if (frame) { m.set(x, y, 0, (x === 0 || x === 18 || y === 0 || y === 37) ? K.chrome : mr); m.set(x, y, 1, mr); }
  }
  m.box(3, 17, 0, 16, 18, 2, K.chrome);
  return m;
});


// ---------------------------------------------------------------- Chelsea Square details
// porcelain chandelier: painted ceramic body, six brass arms with candle bulbs (hangs from y+1.125)
export const chandelier = memo(() => {
  const m = new Model(31, 36, 31, 1 / 32);
  const c = 15.5;
  const cer = [C('#efe4cc', 0, 0.04), C('#e2d4b8', 0, 0.04)], dots = [C('#3a5aa8', 0, 0.05), C('#b0402e', 0, 0.05), C('#5a8a4a', 0, 0.05)];
  [1.5, 2.5, 3.2, 3.4, 2.6, 1.8, 2.2, 3.0, 3.6, 3.4, 2.4, 1.6].forEach((r, i) =>
    m.cyl(c, c, r, 10 + i, 11 + i, (x, y, z) => (hash01(x, y, z) > 0.78 ? dots[Math.floor(hash01(z, x, y) * 2.99)] : cer[y & 1])));
  m.box(15, 22, 15, 16, 36, 16, K.brass); m.cyl(c, c, 1.5, 22, 23, K.brass);
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + 0.3;
    for (let t = 0; t <= 1.0; t += 0.03) {
      const r = 3 + t * 9, y = 13 - Math.sin(t * Math.PI) * 3 + t;
      m.set(Math.floor(c + Math.cos(a) * r), Math.round(y), Math.floor(c + Math.sin(a) * r), K.brass);
    }
    const ex = Math.floor(c + Math.cos(a) * 12), ez = Math.floor(c + Math.sin(a) * 12);
    m.box(ex - 1, 14, ez - 1, ex + 2, 15, ez + 2, cer[0]);
    m.box(ex, 15, ez, ex + 1, 18, ez + 1, K.white);
    m.set(ex, 18, ez, C('#ffd890', 5, 0.03)); m.set(ex, 19, ez, C('#ffe8b0', 3.5, 0.03));
  }
  return m;
});
const bellCache = {};
export const bellPendant = (cord) => bellCache[cord] || (bellCache[cord] = (() => {
  const m = new Model(8, 7 + cord, 8, 1 / 32);
  [3.6, 3.3, 2.9, 2.4, 1.9, 1.4].forEach((r, i) => m.cyl(4, 4, r, i, i + 1, C('#fff0d8', i === 0 ? 2.2 : 1.1, 0.03), i === 0 ? -1 : r - 1));
  m.cyl(4, 4, 1.2, 6, 7, K.brass);
  m.box(4, 7, 4, 5, 7 + cord, 5, K.black);
  m.box(3, 0, 3, 5, 1, 5, C('#fff4e0', 5, 0.02));
  return m;
})());
const mugColors = ['#2f6fc0', '#e8c830', '#3a9a5a', '#e888a8', '#eeeae2', '#e86a2a', '#4ab8c8'];
export const hangingMug = mugColors.map((h) => memo(() => {
  const m = new Model(5, 6, 4, 1 / 32, [2, 6, 2]);
  const c = C(h, 0, 0.05);
  m.cyl(2, 2, 1.7, 0, 4, c, 0.9); m.cyl(2, 2, 1.7, 0, 1, c);
  m.set(4, 2, 2, c); m.set(4, 3, 2, c); m.set(4, 4, 2, c);
  m.box(2, 4, 2, 3, 6, 3, K.brass);
  return m;
}));
export const pothosBasket = memo(() => {
  const m = new Model(15, 34, 15, 1 / 32, [7.5, 34, 7.5]);
  const r = rng(12);
  const lv = [C('#3f7a34', 0, 0.12), C('#5a9a40', 0, 0.12), C('#2e5e28', 0, 0.1), C('#6aaa48', 0, 0.12)];
  for (const [tx, tz] of [[3, 7], [11, 7], [7, 3], [7, 11]]) for (let t = 0; t <= 1; t += 0.05) m.set(Math.round(7 + (tx - 7) * t), Math.round(33 - 19 * t), Math.round(7 + (tz - 7) * t), C('#2a2620', 0, 0.02));
  m.cyl(7.5, 7.5, 4.6, 10, 15, (x, y) => ((x + y) & 1 ? C('#6a4a2a', 0, 0.08) : C('#4e341c', 0, 0.08)));
  m.sphere(7.5, 16, 7.5, 6.5, 3.5, 6.5, (x, y, z) => (hash01(x, y, z) > 0.3 ? lv[Math.floor(hash01(z, y, x) * 3.99)] : null));
  for (let s = 0; s < 10; s++) {
    const a = r() * Math.PI * 2; let x = 7.5 + Math.cos(a) * 5.5, z = 7.5 + Math.sin(a) * 5.5;
    for (let y = 13; y > 13 - 4 - r() * 11 && y >= 0; y--) { x += (r() - 0.5) * 0.8; z += (r() - 0.5) * 0.8; m.set(Math.max(0, Math.min(14, Math.round(x))), y, Math.max(0, Math.min(14, Math.round(z))), lv[Math.floor(r() * 4)]); }
  }
  return m;
});
export const acUnit = memo(() => {
  const m = new Model(14, 5, 4, 1 / 16);
  m.box(0, 0, 0, 14, 5, 4, C('#e8e8e2', 0, 0.03));
  m.box(1, 0, 0, 13, 1, 1, C('#8a8c8e', 0, 0.04)); m.set(12, 3, 0, C('#30ff60', 2, 0.02));
  return m;
});
// mural of an old brick street, like the one by the counter
export const mural = memo(() => {
  const w = 64, h = 28, m = new Model(w, h, 1, 1 / 16, [w / 2, 0, 0.5]);
  const col = (x, y) => {
    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) return C('#6a4022', 0, 0.05);
    if (y < 4) return y === 3 ? C('#d8b8a0', 0, 0.05) : C('#c8a090', 0, 0.06);
    const tree = Math.hypot(x - 54, (y - 15) * 1.3) < 5.5;
    if (tree) return C('#5a8a4a', 0, 0.12);
    if (x === 54 && y < 12) return C('#5a3a20', 0, 0.05);
    if (x >= 15 && x < 50 && y < 24) {
      if (y === 23 || y === 22) return C('#c8a070', 0, 0.05);
      const wx = (x - 16) % 5, row1 = y >= 6 && y < 11, row2 = y >= 14 && y < 20;
      if ((row1 || row2) && wx >= 1 && wx <= 3) { const top = row1 ? 10 : 19; if (y === top && wx !== 2) return C('#a8483a', 0, 0.06); return wx === 2 || y === (row1 ? 8 : 17) ? C('#efe2c0', 0, 0.04) : C('#c8d8d8', 0, 0.05); }
      if (y >= 8 && y <= 9 && x >= 33 && x < 43) return C('#e8b048', 0, 0.06);
      if (x === 18 && y >= 8 && y < 16) return C('#f0d040', 0, 0.04);
      return C('#a8483a', 0, 0.08);
    }
    if (x < 14 && y < 20) return ((x % 4 === 1 || x % 4 === 2) && (y % 5 === 2 || y % 5 === 3) && y > 6) ? C('#d8d0b0', 0, 0.05) : C('#7a3a2e', 0, 0.08);
    return C('#ead8a8', 0, 0.06);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m.set(w - 1 - x, y, 0, col(x, y));
  for (const [fx, c] of [[8, '#2a2a2a'], [26, '#3a3a6a'], [44, '#e8e8e8'], [60, '#2a2a2a']]) { m.set(w - 1 - fx, 4, 0, C(c, 0, 0.05)); m.set(w - 1 - fx, 5, 0, C(c, 0, 0.05)); m.set(w - 1 - fx, 6, 0, C('#d8b090', 0, 0.05)); }
  return m;
});
export const tv = memo(() => {
  const m = new Model(18, 11, 1, 1 / 16, [9, 0, 0.5]);
  for (let y = 0; y < 11; y++) for (let x = 0; x < 18; x++)
    m.set(x, y, 0, x === 0 || x === 17 || y === 0 || y === 10 ? K.black : C(hash01(x >> 2, y >> 1, 3) > 0.7 ? '#e8e0c0' : y > 6 ? '#3a6ad0' : '#2a3a80', 1.0, 0.1));
  return m;
});
// flat sign: text on a board (faces -z)
function board(lines, scale, bg, ink, frame) {
  const w = Math.max(...lines.map((l) => textWidth(l))) + 4, h = lines.length * 9 + 2;
  const m = new Model(w, h, 1, scale, [w / 2, 0, 0.5]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m.set(x, y, 0, frame && (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? frame : bg);
  lines.forEach((t, li) => { const x0 = Math.floor((w - textWidth(t)) / 2); glyphPixels(t, (c, r) => m.set(w - 1 - (x0 + c), h - 3 - li * 9 - r, 0, ink)); });
  return m;
}
const chalk = C('#e8e8dc', 0.25, 0.08), slate = C('#1e2420', 0, 0.06), frameW = C('#6a4022', 0, 0.05);
const syrupBoard = memo(() => board(['WE SERVE', 'MAPLE', 'SYRUP'], 1 / 56, slate, chalk, frameW));
const coffeeBoard = memo(() => board(['FLAVORED', 'COFFEE', 'VANILLA'], 1 / 56, slate, chalk, frameW));
const newsBoard = memo(() => board(['NEWSPAPERS'], 1 / 56, slate, chalk, C('#e8e4da', 0, 0.03)));
const restroomPlaque = memo(() => board(['RESTROOM'], 1 / 56, C('#2a2420', 0, 0.05), C('#e8dcc0', 0.3, 0.04), C('#6a4022', 0, 0.05)));
const occupancy = memo(() => board(['OCCUPANCY BY', 'MORE THAN', '155 PERSONS'], 1 / 64, C('#efe8d8', 0, 0.03), C('#a02020', 0, 0.04), C('#6a4022', 0, 0.05)));
const beerSignBoard = memo(() => board(['COLD BEER'], 1 / 40, C('#f0c830', 0.5, 0.03), C('#1a2a6a', 0, 0.03), C('#1a2a6a', 0, 0.03)));
const cerealBoxes = memo(() => {
  const m = new Model(36, 10, 3, 1 / 32);
  const cols = ['#d8302a', '#e8e0d0', '#2a5ab0', '#f0c030', '#3a9a4a', '#e86a2a'];
  for (let i = 0; i < 6; i++) { const c = C(cols[i], 0, 0.06); m.box(i * 6, 0, 0, i * 6 + 5, 9 + (i & 1), 3, (x, y) => (y === 6 ? K.white : c)); }
  return m;
});
const cakeBox = memo(() => {
  const m = new Model(18, 7, 9, 1 / 32);
  const clear = C('#c8d8e0', 0, 0.03), loaf = C('#d8a860', 0, 0.06), crust = C('#8a5428', 0, 0.06);
  m.box(0, 0, 0, 18, 1, 9, C('#d8d8d8', 0, 0.02));
  for (let i = 0; i < 5; i++) m.box(1 + i * 3, 1, 2, 3 + i * 3, 4, 7, (x, y) => (y === 3 ? crust : loaf));
  for (let x = 0; x < 18; x++) for (let z = 0; z < 9; z++) if (x === 0 || x === 17 || z === 0 || z === 8) m.set(x, 6, z, clear);
  for (const [x, z] of [[0, 0], [17, 0], [0, 8], [17, 8]]) m.box(x, 1, z, x + 1, 6, z + 1, clear);
  return m;
});
const bananas = memo(() => {
  const m = new Model(10, 16, 10, 1 / 32);
  const y1 = C('#f0d040', 0, 0.08), y2 = C('#c8b030', 0, 0.08);
  m.cyl(5, 5, 4.6, 0, 1, K.black); m.box(5, 0, 5, 6, 16, 6, K.black); m.cyl(5, 5, 3.6, 8, 9, K.black);
  m.sphere(5, 4, 5, 4.4, 3, 4.4, (x, y, z) => (hash01(x, y, z) > 0.25 ? (y & 1 ? y1 : y2) : null));
  m.sphere(5, 11.5, 5, 3.4, 2.5, 3.4, (x, y, z) => (hash01(x, y, z) > 0.25 ? (y & 1 ? y1 : y2) : null));
  return m;
});
const placemat = (ketchup) => {
  const m = new Model(14, 8, 9, 1 / 32);
  const pink = C('#e8807a', 0, 0.04);
  for (let x = 0; x < 14; x++) for (let z = 0; z < 9; z++) if (!((x === 0 || x === 13) && (z & 1))) m.set(x, 0, z, pink);
  m.box(9, 1, 2, 11, 2, 8, K.white); m.box(9, 1, 4, 11, 2, 5, C('#d83a2a', 0, 0.03));
  if (ketchup) { m.box(1, 0, 0, 3, 6, 2, C('#b0141c', 0, 0.06)); m.box(1, 6, 0, 3, 8, 2, K.white); }
  return m;
};
const placematK = memo(() => placemat(true)), placematN = memo(() => placemat(false));
const shelfToys = memo(() => {
  const m = new Model(40, 3, 3, 1 / 32);
  const r = rng(5);
  for (let x = 0; x < 38; x += 3 + Math.floor(r() * 4)) { const c = C(['#c83030', '#3060c0', '#30a050', '#e8c030', '#e8e8e8'][Math.floor(r() * 5)], 0, 0.05); m.box(x, 0, 0, x + 2, 1 + Math.floor(r() * 3), 3, c); }
  return m;
});
const greekFlag = memo(() => {
  const m = new Model(15, 10, 1, 1 / 32, [0, 10, 0.5]);
  const b = C('#1e5ab0', 0, 0.04), w = C('#eeeeee', 0, 0.03);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 15; x++) {
    const ry = 9 - y; let c = Math.floor(ry / 1.111) % 2 ? w : b;
    if (x < 6 && ry < 5) c = (x === 2 || ry === 2) ? w : b;
    m.set(x, y, 0, c);
  }
  return m;
});
const chef = memo(() => {
  const m = new Model(6, 18, 5, 1 / 32);
  const br = C('#8a5a30', 0, 0.06);
  m.box(1, 0, 1, 5, 9, 4, br); m.box(0, 9, 1, 6, 11, 4, br); m.sphere(3, 13, 2.5, 2, 2, 2, C('#c08a5a', 0, 0.05));
  m.box(1, 15, 1, 5, 18, 4, K.white); m.box(0, 7, 0, 6, 8, 2, C('#d8d0c0', 0, 0.04));
  return m;
});
const radio = memo(() => {
  const m = new Model(12, 8, 6, 1 / 32);
  m.box(0, 0, 0, 12, 8, 6, C('#6a3a1a', 0, 0.06));
  m.box(1, 1, 0, 6, 6, 1, (x, y) => ((x + y) & 1 ? C('#c8b080', 0, 0.05) : C('#8a7050', 0, 0.05)));
  m.box(7, 3, 0, 11, 6, 1, C('#ffb860', 2.2, 0.03)); m.set(9, 1, 0, K.brass);
  return m;
});


// ---------------------------------------------------------------- restrooms
const porcelain = C('#f2f0ea', 0, 0.03), porcelainD = C('#d8d6ce', 0, 0.03);
// toilet, faces -z (tank against the wall at +z)
export const toilet = memo(() => {
  const m = new Model(8, 13, 12, 1 / 16);
  m.box(2, 0, 2, 6, 5, 8, porcelain);
  m.box(1, 5, 0, 7, 7, 8, (x, y, z) => (y === 6 && x > 1 && x < 6 && z > 0 && z < 7 ? C('#9ab8c0', 0, 0.04) : porcelain));
  m.box(1, 7, 0, 7, 8, 8, porcelainD);
  m.box(1, 7, 8, 7, 13, 12, porcelain); m.box(1, 13, 8, 7, 13, 12, porcelainD); m.box(0, 12, 8, 8, 13, 12, porcelainD);
  m.set(1, 11, 8, K.chrome);
  return m;
});
// wall-hung sink with faucet, faces -z (wall at +z)
export const sink = memo(() => {
  const m = new Model(10, 15, 8, 1 / 16);
  m.box(0, 10, 0, 10, 13, 7, porcelain); m.box(2, 12, 1, 8, 13, 6, C('#c8d4d8', 0, 0.04));
  m.box(4, 13, 5, 6, 15, 7, K.chrome); m.box(4, 14, 3, 6, 15, 5, K.chrome);
  m.box(4, 0, 6, 6, 10, 8, K.chrome);
  return m;
});
export const mirror = memo(() => {
  const m = new Model(10, 13, 1, 1 / 16, [5, 0, 0.5]);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 10; x++) m.set(x, y, 0, x === 0 || y === 0 || x === 9 || y === 12 ? K.chrome : C(hash01(x, y >> 1, 4) > 0.85 ? '#d8e8f0' : '#9ab0bc', 0.25, 0.05));
  return m;
});
// grab bars: one long horizontal bar with stand-offs (along x), and a short vertical one
export const grabBar = memo(() => {
  const m = new Model(28, 3, 3, 1 / 32, [14, 0, 2.5]);
  m.box(0, 1, 0, 28, 2, 1, K.chrome); m.box(1, 1, 1, 2, 2, 3, K.chrome); m.box(26, 1, 1, 27, 2, 3, K.chrome);
  return m;
});
export const grabBarV = memo(() => {
  const m = new Model(3, 14, 3, 1 / 32, [1.5, 0, 2.5]);
  m.box(1, 0, 0, 2, 14, 1, K.chrome); m.box(1, 1, 1, 2, 2, 3, K.chrome); m.box(1, 12, 1, 2, 13, 3, K.chrome);
  return m;
});
const towelDispenser = memo(() => { const m = new Model(9, 11, 4, 1 / 32); m.box(0, 0, 0, 9, 11, 4, C('#d8d8d4', 0, 0.03)); m.box(2, 0, 0, 7, 1, 1, K.white); m.box(1, 6, 0, 8, 7, 1, C('#8a8c8e', 0, 0.03)); return m; });
const handDryer = memo(() => { const m = new Model(9, 8, 6, 1 / 32); m.box(0, 2, 0, 9, 8, 6, K.chrome); m.box(3, 0, 1, 6, 2, 4, K.chrome); m.set(4, 5, 0, C('#40d0ff', 2, 0.02)); return m; });
const soap = memo(() => { const m = new Model(4, 7, 3, 1 / 32); m.box(0, 0, 0, 4, 6, 3, K.white); m.box(1, 6, 1, 3, 7, 2, K.chrome); m.box(1, 2, 0, 3, 4, 1, C('#e88ab8', 0, 0.04)); return m; });
const paperHolder = memo(() => { const m = new Model(5, 5, 4, 1 / 32); m.box(0, 3, 0, 5, 4, 4, K.chrome); m.cyl(2.5, 2, 2, 0, 3, K.white); return m; });
const binSmall = memo(() => { const m = new Model(8, 12, 8, 1 / 32); m.cyl(4, 4, 3.8, 0, 12, K.chrome, 3); m.cyl(4, 4, 3.8, 0, 1, K.chrome); return m; });
// accessibility sign: white wheelchair symbol on blue
const wheelchairSign = memo(() => {
  const art = ['............', '.....##.....', '.....##.....', '....##......', '....#####...', '....##......', '...#.##.....', '..#...####..', '..#.....#...', '..#....#....', '...###......', '............'];
  const m = new Model(12, 12, 1, 1 / 40, [6, 0, 0.5]);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) m.set(11 - x, 11 - y, 0, art[y][x] === '#' ? C('#ffffff', 0.4, 0.02) : C('#1d4fb0', 0.15, 0.03));
  return m;
});
const washSign = memo(() => board(['EMPLOYEES', 'MUST WASH', 'HANDS'], 1 / 64, C('#efece4', 0, 0.03), C('#1d3a8a', 0, 0.03), C('#8a8a8a', 0, 0.03)));
const exitSign = memo(() => board(['EXIT'], 1 / 40, C('#2a0a0a', 0, 0.03), C('#ff2a2a', 5, 0.03), C('#e8e8e8', 0, 0.03)));
const mopBucket = memo(() => {
  const m = new Model(10, 22, 9, 1 / 32);
  m.box(0, 1, 0, 10, 8, 9, C('#f0c020', 0, 0.05)); m.box(1, 0, 1, 2, 1, 2, K.black); m.box(8, 0, 7, 9, 1, 8, K.black);
  m.box(1, 6, 1, 9, 7, 8, C('#6a8a8a', 0, 0.05)); m.box(6, 7, 4, 7, 22, 5, C('#8a6a40', 0, 0.05));
  return m;
});
// a swinging door panel, hinge at local x 0
const doorCache = {};
export const swingDoor = (kind) => doorCache[kind] || (doorCache[kind] = (() => {
  const w = kind === 'kitchen' ? 18 : 16, h = 34;
  const m = new Model(w, h, 1, 1 / 16, [0, 0, 0.5]);
  const face = kind === 'kitchen' ? C('#a8aeb4', 0, 0.04) : C('#6a4428', 0, 0.06), kick = kind === 'kitchen' ? K.chromeD : C('#4a2c18', 0, 0.05);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = face;
    if (y < 4) c = kick;
    if (kind === 'kitchen') { const d = Math.hypot(x + 0.5 - w / 2, y + 0.5 - 24); if (d < 3) c = C('#ffe8c0', 1.4, 0.04); else if (d < 4) c = K.chrome; }
    else { if (x === 1 || x === w - 2 || y === 4 || y === h - 2 || y === 18) c = C('#5a3820', 0, 0.05); if (x === w - 3 && y === 17) c = K.chrome; }
    m.set(x, y, 0, c);
  }
  return m;
})());

// ---------------------------------------------------------------- kitchen
const st = C('#a8aeb4', 0, 0.05), stD = C('#7c8288', 0, 0.05), grate = C('#1e1e20', 0, 0.04);
// six-burner range with oven below, pots on top (faces -z)
export const range = memo(() => {
  const m = new Model(16, 22, 13, 1 / 16);
  m.box(0, 0, 0, 16, 13, 13, st); m.box(1, 2, 0, 15, 10, 1, stD); m.box(2, 9, 0, 14, 10, 1, K.chrome);
  for (let i = 0; i < 6; i++) m.set(1 + i * 2 + 2, 11, 0, K.black);
  m.box(0, 13, 1, 16, 14, 12, grate);
  for (const [bx, bz] of [[3, 3], [8, 3], [13, 3], [3, 9], [8, 9], [13, 9]]) m.set(bx, 13, bz, C('#3a7aff', 2.5, 0.05));
  m.box(0, 13, 12, 16, 18, 13, st);
  m.cyl(4, 9, 3.2, 14, 21, (x, y) => (y === 20 ? C('#c8b090', 0, 0.06) : K.chrome));       // stock pot of soup
  m.cyl(11.5, 4, 2.6, 14, 16, grate); m.box(13, 15, 4, 16, 16, 5, grate);                    // saute pan
  m.cyl(11.5, 4, 1.8, 15, 16, C('#e0c040', 0, 0.08));
  return m;
});
// flat-top griddle with pancakes, eggs and bacon (faces -z)
export const griddle = memo(() => {
  const m = new Model(16, 16, 13, 1 / 16);
  m.box(0, 0, 0, 16, 13, 13, st); m.box(1, 2, 0, 15, 11, 1, stD);
  m.box(0, 13, 0, 16, 14, 12, C('#2a2a2c', 0, 0.04)); m.box(0, 14, 11, 16, 16, 13, st); m.box(0, 14, 0, 1, 16, 13, st); m.box(15, 14, 0, 16, 16, 13, st);
  for (const [px, pz] of [[3, 4], [7, 4], [3, 8]]) m.box(px, 14, pz, px + 3, 15, pz + 3, C('#d8a050', 0, 0.08));
  for (const [ex, ez] of [[11, 3], [13, 6]]) { m.box(ex, 14, ez, ex + 2, 15, ez + 2, K.white); m.set(ex, 15, ez, C('#f0b020', 0, 0.03)); }
  for (let i = 0; i < 3; i++) m.box(10 + i, 14, 8, 11 + i, 15, 11, C('#a83a2a', 0, 0.08));
  return m;
});
export const fryer = memo(() => {
  const m = new Model(10, 18, 13, 1 / 16);
  m.box(0, 0, 0, 10, 13, 13, st); m.box(1, 2, 0, 9, 11, 1, stD);
  m.box(1, 12, 2, 9, 13, 11, C('#c89030', 0.3, 0.06));
  for (const bx of [1, 5]) { m.box(bx, 13, 3, bx + 4, 15, 9, C('#5a5a5a', 0, 0.05)); m.box(bx + 1, 15, 2, bx + 3, 18, 3, K.black); }
  m.box(0, 13, 12, 10, 17, 13, st);
  return m;
});
export const charbroiler = memo(() => {
  const m = new Model(14, 16, 13, 1 / 16);
  m.box(0, 0, 0, 14, 13, 13, st); m.box(1, 2, 0, 13, 11, 1, stD);
  m.box(0, 13, 0, 14, 14, 12, (x) => (x & 1 ? grate : C('#ff6a20', 1.5, 0.2)));
  m.box(3, 14, 3, 7, 15, 7, C('#5a2a1a', 0, 0.08)); m.box(8, 14, 5, 12, 15, 9, C('#5a2a1a', 0, 0.08));
  m.box(0, 13, 12, 14, 16, 13, st);
  return m;
});
const hangingPans = memo(() => {
  const m = new Model(48, 10, 3, 1 / 32, [24, 10, 1.5]);
  m.box(0, 9, 1, 48, 10, 2, K.chrome);
  for (let i = 0; i < 6; i++) {
    const x = 3 + i * 8;
    m.box(x, 4, 1, x + 1, 9, 2, i % 3 === 0 ? C('#8a5a3a', 0, 0.05) : K.chrome);
    if (i % 2) m.box(x - 2, 0, 1, x + 3, 4, 2, i % 3 === 1 ? grate : K.chrome); else m.box(x - 1, 1, 1, x + 2, 4, 2, K.chrome);
  }
  return m;
});
const prepStuff = memo(() => {
  const m = new Model(150, 8, 24, 1 / 32);
  const board2 = C('#c8a070', 0, 0.06);
  m.box(4, 0, 4, 22, 1, 16, board2);
  for (const [x, z, c] of [[7, 7, '#d83a2a'], [9, 8, '#d83a2a'], [12, 6, '#e8e0c8'], [15, 10, '#4a9a3a'], [17, 9, '#4a9a3a'], [19, 7, '#f0c040']]) m.box(x, 1, z, x + 2, 3, z + 2, C(c, 0, 0.08));
  m.cyl(36, 11, 6, 0, 5, (x, y) => (y === 4 ? C('#f0e8d8', 0, 0.05) : K.chrome));          // mixing bowl of batter
  m.cyl(52, 9, 4, 0, 4, K.chrome); m.cyl(52, 9, 3, 3, 4, C('#e8c050', 0, 0.06));
  m.box(64, 0, 3, 96, 1, 20, K.chrome);                                                     // sheet tray of rolls
  for (let x = 66; x < 94; x += 5) for (let z = 5; z < 18; z += 5) m.box(x, 1, z, x + 4, 3, z + 4, C('#d8a050', 0, 0.08));
  for (let i = 0; i < 6; i++) m.cyl(112, 10, 4.4, i, i + 1, K.white);                       // plates
  m.box(126, 0, 4, 146, 7, 18, C('#e8e4d8', 0, 0.04)); m.box(126, 7, 4, 146, 8, 18, C('#6a8ac0', 0, 0.04)); // tub of potatoes
  m.box(128, 7, 6, 144, 8, 16, C('#b08a5a', 0, 0.08));
  return m;
});
const ticketRail = memo(() => {
  const m = new Model(60, 6, 2, 1 / 32, [30, 6, 1]);
  m.box(0, 5, 0, 60, 6, 2, K.chrome);
  for (let x = 4; x < 56; x += 9) m.box(x, 0, 0, x + 5, 5, 1, (xx, y) => (y === 3 || y === 1 ? C('#8a8a8a', 0, 0.03) : K.white));
  return m;
});
const dishRack = memo(() => {
  const m = new Model(16, 9, 16, 1 / 32);
  m.box(0, 0, 0, 16, 1, 16, C('#3a5a8a', 0, 0.05));
  for (let z = 1; z < 16; z += 3) for (const x of [1, 6, 10, 14]) m.box(x, 1, z, x + 1, 4, z + 1, K.chrome); // wire pegs
  return m;
});
const faucetSpray = memo(() => {
  const m = new Model(4, 24, 6, 1 / 32, [2, 0, 5]);
  m.box(1, 0, 4, 3, 24, 6, K.chrome); m.box(1, 22, 0, 3, 24, 4, K.chrome); m.box(1, 14, 0, 3, 22, 2, C('#2a2a2a', 0, 0.03));
  return m;
});
const sacks = memo(() => {
  const m = new Model(14, 12, 10, 1 / 32);
  m.box(0, 0, 0, 7, 11, 9, C('#e8e2d0', 0, 0.06)); m.box(1, 5, 0, 6, 7, 1, C('#c83a2a', 0, 0.04));
  m.box(7, 0, 1, 14, 9, 10, C('#b08a5a', 0, 0.08));
  return m;
});

// ---------------------------------------------------------------- placement
export function placeProps(batch) {
  const F = 0.25; // diner floor
  // every seat is recorded so people (and you) can sit: hip position, seat height, facing yaw
  const seats = batch.seats = [];
  const chairAt = (x, z, rot) => { batch.add(chair(), x, F, z, rot); seats.push({ x, z, y: 0.75, yaw: rot * Math.PI / 2, kind: 'chair' }); };
  const r = rng(99);

  // ================= conservatory (z -3..0): tables along the glass and along the partition
  const FR = -2.42; // front row, against the glass
  [1.3, 3.9, 6.3, 9.3, 11.7].forEach((tx, i) => {
    batch.add(table(i % 3), tx, F, FR);
    chairAt(tx - 0.66, FR, 3);
    chairAt(tx + 0.66, FR, 1);
    batch.add(tableSets[i % 4](), tx, F + 0.75, FR, 0, false);
    batch.add(tiffany(6), tx, 1.95, FR, 0, false);
  });
  batch.add(table(3), 15.0, F, FR); chairAt(15.0, FR + 0.66, 0);
  batch.add(tableSets[1](), 15.0, F + 0.75, FR, 0, false);
  [1.3, 3.9, 6.3, 9.3, 11.7].forEach((tx, i) => {   // inner row mirrors the window row
    batch.add(table((i + 2) % 4), tx, F, -0.65);
    chairAt(tx - 0.66, -0.65, 3); chairAt(tx + 0.66, -0.65, 1);
    batch.add(tableSets[(i + 2) % 4](), tx, F + 0.75, -0.65, 2, false);
    batch.add(tiffany(8), tx, 2.19, -0.65, 0, false);
  });
  for (const x of [2.6, 5.2, 7.8, 10.4, 14.4]) batch.add(pothosBasket(), x, 2.74, -2.8, Math.floor(r() * 4), false);
  for (const x of [2.6, 5.2, 10.4]) batch.add(pothosBasket(), x, 3.15, -0.45, Math.floor(r() * 4), false);
  for (let x = 0.5; x < 15.6; x += 0.34 + r() * 0.12) {
    if (x > 12.55 && x < 14.2) continue;
    batch.add(strands[Math.floor(r() * 4)](), x, 2.62, -3.05 + r() * 0.04, 0, false);
  }
  for (const x of [1.0, 3.0, 5.0, 7.0, 9.0, 11.0, 15.0]) batch.add(topString(), x, 2.6, -3.09, 0, false);
  batch.add(acUnit(), 4.6, 2.62, -0.12, 0, false); batch.add(acUnit(), 10.9, 2.62, -0.12, 0, false);
  batch.add(cat(), 12.3, 1.0, -3.0, 0, false);
  batch.add(openSign(), 14.9, 1.55, -3.07, 0, false);
  batch.add(coffeeSign(), 3.2, 2.0, -3.09, 0, false);
  batch.add(umbrellaStand(), 14.45, F, -0.5);
  batch.add(gumball(), 15.4, F, -0.5);
  batch.add(flagSmall(), 0.27, 2.55, -2.8, 3, false);

  // ================= main room
  // sage booths backed onto the etched-glass partition
  for (const bx of [1.3, 3.5, 5.65, 9.5, 11.62]) {
    batch.add(booth(), bx, F, 0.25 + 21 / 32, 1);
    for (const sx of [-0.7, 0.7]) seats.push({ x: bx + sx, z: 0.82, y: 0.69, yaw: sx < 0 ? -Math.PI / 2 : Math.PI / 2, kind: 'booth', approach: [bx + sx, 1.95] });
    batch.add(tableSets[Math.floor(bx) % 4](), bx, F + 0.75, 0.72, 0, false);
    batch.add(bellPendant(26), bx, 2.68, 0.75, 0, false);
  }
  // booths under the avenue windows
  for (const bz of [3.1, 5.3, 7.5]) {
    batch.add(booth(), 0.25 + 21 / 32, F, bz, 2);
    for (const sz of [0.7, -0.7]) seats.push({ x: 0.82, z: bz + sz, y: 0.69, yaw: sz > 0 ? 0 : Math.PI, kind: 'booth', approach: [1.95, bz + sz] });
    batch.add(tableSets[Math.floor(bz) % 4](), 0.68, F + 0.75, bz, 1, false);
    batch.add(bellPendant(26), 0.72, 2.68, bz, 0, false);
  }
  // formica four-tops under porcelain chandeliers
  [4.0, 6.75, 9.5, 12.4].forEach((tx, i) => {
    batch.add(formicaTable(), tx, F, 3.9);
    chairAt(tx - 0.66, 3.9, 3); chairAt(tx + 0.66, 3.9, 1);
    chairAt(tx, 3.24, 2); chairAt(tx, 4.56, 0);
    batch.add(tableSets[(i + 1) % 4](), tx, F + 0.75, 3.9, i, false);
    batch.add(chandelier(), tx, 2.375, 3.9, 0, false);
  });
  // colorful mugs hanging along the ceiling beams
  for (const bx of [3.2, 6.4, 9.6, 12.8]) for (let z = 0.7; z < 9.6; z += 0.36 + r() * 0.1) {
    const side = r() < 0.5 ? -0.17 : 0.17;
    batch.add(hangingMug[Math.floor(r() * hangingMug.length)](), bx + side, 3.4, z, Math.floor(r() * 4), false);
  }

  // counter: cream swivel chairs on the wooden step, placemats, bananas, pound cake, pies
  for (let x = 3.5; x < 13.0; x += 0.85) { batch.add(stool(), x, 0.375, 6.6, 2); seats.push({ x, z: 6.6, y: 1.06, yaw: Math.PI, kind: 'stool' }); }
  for (let x = 3.5, i = 0; x < 13.0; x += 0.85, i++) batch.add(i % 3 === 0 ? placematK() : placematN(), x, 1.075, 7.15, 0, false);
  batch.add(bananas(), 8.2, 1.075, 7.55, 0, false);
  batch.add(cakeBox(), 5.4, 1.075, 7.55, 0, false); batch.add(cakeBox(), 10.9, 1.075, 7.55, 0, false);
  batch.add(pieRack(), 12.6, 1.075, 7.45, 0, false, 'pie');
  batch.add(register(), 3.4, 1.075, 7.45, 2, false, 'register');
  for (const x of [4.6, 7.4, 10.2]) batch.add(bellPendant(18), x, 2.95, 7.4, 0, false);

  // back bar: urns, brewers, chalkboards, scalloped shelf with mugs, toys, photos, fridge with cereal on top
  const BT = 1.0;
  batch.add(urn(), 7.3, BT, 9.65, 0, false, 'urns'); batch.add(urn(), 7.9, BT, 9.65, 0, false, 'urns');
  batch.add(brewer(), 8.8, BT, 9.75, 0, false); batch.add(brewer(), 9.4, BT, 9.75, 0, false);
  batch.add(mixer(), 5.35, BT, 9.75, 0, false); batch.add(mixer(), 5.65, BT, 9.75, 0, false);
  batch.add(plates(), 10.2, BT, 9.7, 0, false, 'platesA'); batch.add(plates(), 10.5, BT, 9.7, 0, false, 'platesA'); batch.add(plates(), 13.0, BT, 9.7, 0, false, 'platesB');
  batch.add(chef(), 4.85, BT, 9.75, 0, false);
  batch.add(radio(), 6.2, BT, 9.75, 0, false);
  batch.add(syrupBoard(), 5.5, 1.55, 9.86, 0, false); batch.add(coffeeBoard(), 6.85, 1.55, 9.86, 0, false);
  batch.add(beerSignBoard(), 3.75, 2.05, 9.25, 0, false);
  batch.add(cerealBoxes(), 3.75, 2.0, 9.65, 0, false);
  for (let x = 4.8; x < 13.2; x += 0.3) batch.add(hangingMug[Math.floor(r() * hangingMug.length)](), x, 2.14, 9.72, Math.floor(r() * 4), false, 'mugs');
  batch.add(shelfToys(), 6.0, 2.375, 9.8, 0, false); batch.add(shelfToys(), 10.4, 2.375, 9.8, 0, false);
  for (let x = 2.1, k = 0; x < 13.2; x += 0.68, k++) batch.add(photos[k % 10](), x, 2.52 + (k & 1) * 0.06, 9.99, 0, false);
  batch.add(restroomPlaque(), 1.0, 2.55, 9.86, 0, false);
  batch.add(wheelchairSign(), 2.05, 1.6, 9.99, 0, false);

  // ================= back of house
  // hallway
  batch.add(photos[6](), 0.26, 1.6, 11.6, 3, false); batch.add(photos[1](), 0.26, 1.6, 13.4, 3, false);
  batch.add(exitSign(), 1.0, 2.4, 15.6, 0, false);
  batch.add(mopBucket(), 0.6, F, 14.9, 0);
  // two restrooms, both accessible: toilet 0.55 m off the side wall, grab bars beside and behind, clear turning space
  for (const [rz0, rz1, doorZ] of [[10.25, 13.0, 11.5], [13.125, 15.75, 14.25]]) {
    const tz = rz1 - 0.55;
    batch.add(toilet(), 4.49, F, tz, 1);
    batch.add(paperHolder(), 4.15, 0.85, rz1 - 0.07, 0, false);
    batch.add(grabBar(), 3.95, 1.0, rz1 - 0.02, 0, false);             // side bar
    batch.add(grabBarV(), 3.4, 0.9, rz1 - 0.02, 0, false);
    batch.add(grabBar(), 4.84, 1.18, tz, 1, false);                   // rear bar above the tank
    batch.add(sink(), 3.1, F, rz0 + 0.27, 2);
    batch.add(mirror(), 3.1, 1.4, rz0 + 0.01, 2, false);
    batch.add(soap(), 2.55, 1.15, rz0 + 0.05, 2, false);
    batch.add(towelDispenser(), 2.25, 1.2, rz0 + 0.07, 2, false);
    batch.add(handDryer(), 4.0, 1.15, rz0 + 0.1, 2, false);
    batch.add(binSmall(), 2.2, F, rz0 + 0.25, 0);
    batch.add(washSign(), 3.1, 2.3, rz0 + 0.01, 2, false);
    batch.add(wheelchairSign(), 1.74, 1.6, doorZ + 0.8, 1, false);
  }

  // kitchen: cook line along the back wall under the hood
  const KL = 15.31;
  batch.add(fryer(), 6.45, F, KL, 0); batch.add(fryer(), 7.1, F, KL, 0);
  batch.add(charbroiler(), 8.1, F, KL, 0, true, 'grill8.1');
  batch.add(griddle(), 9.65, F, KL, 0, true, 'grill9.65'); batch.add(griddle(), 10.65, F, KL, 0, true, 'grill10.65');
  batch.add(range(), 12.0, F, KL, 0); batch.add(range(), 13.6, F, KL, 0);
  batch.add(hangingPans(), 10.4, 2.24, 14.2, 0, false);
  batch.add(prepStuff(), 9.5, 0.875, 12.4, 0, false);
  batch.add(sacks(), 9.5, 0.5, 12.4, 0, false);
  batch.add(ticketRail(), 11.75, 2.2, 10.32, 2, false);
  batch.add(plates(), 12.45, 0.875, 10.55, 0, false, 'platesK'); batch.add(plates(), 12.75, 0.875, 10.55, 0, false, 'platesK');
  batch.add(dishRack(), 5.5, 0.875, 13.3, 0, false, 'dishRack');
  batch.add(faucetSpray(), 5.3, 0.875, 12.3, 3, false);
  batch.add(sacks(), 15.4, 0.25, 15.3, 1);
  batch.add(radio(), 15.5, 2.125, 13.4, 1, false);

  // east wall: mural, newspaper board, TV, occupancy sign, Greek flag, photos
  batch.add(mural(), 15.74, 1.35, 5.4, 1, false);
  batch.add(newsBoard(), 15.74, 1.45, 8.1, 1, false);
  batch.add(tv(), 15.72, 2.45, 8.4, 1, false);
  batch.add(occupancy(), 15.74, 2.0, 9.4, 1, false);
  batch.add(greekFlag(), 15.72, 3.3, 3.0, 1, false);
  for (let z = 0.6, k = 3; z < 1.6; z += 0.7, k++) batch.add(photos[k % 10](), 15.74, 2.2, z, 1, false);
  for (let z = 1.9, k = 5; z < 3.0; z += 0.68, k++) batch.add(photos[k % 10](), 15.74, 2.1, z, 1, false);
  // west wall above the restroom
  batch.add(photos[2](), 0.26, 2.5, 9.2, 3, false);

  // ================= outside
  const S = 0.125;
  batch.add(fruitStand(), 18.4, S, -0.45);
  batch.add(beerSign(), 17.3, 1.6, 0.0, 0, false);
  batch.add(lottoSign(), 19.6, 2.1, 0.0, 0, false);
  batch.add(hydrant(), 17.3, S, -4.55);
  batch.add(trashCan(), -0.8, S, -3.6);
  batch.add(trashCan(), 19.6, S, -12.0);
  batch.add(newsBlue(), 9.9, S, -4.6); batch.add(newsRed(), 10.45, S, -4.6);
  batch.add(mailbox(), 11.4, S, -4.55);
  batch.add(barrier(), -0.75, S, 15.6, 0);
  batch.add(barrier(), -0.9, S, -12.3, 1);
  batch.add(plyFence(), 33.35, S, -2.4, 1);
  batch.add(barrier(), 33.4, S, -12.3, 1);
  batch.add(waterTower(), 17.0, 16.0, -15.0, 0, false);
}
