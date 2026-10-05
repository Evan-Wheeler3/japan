// Prop models (finer voxel scales) and their placement in and around the shop.
import * as THREE from 'three';
import { Model, C, rng, hash01, glyphPixels, textWidth } from './voxel.js';

const memo = (fn) => { let m; return () => m || (m = fn()); };

// ---------------------------------------------------------------- shared colors
const K = {
  wood: C('#4a2c18', 0, 0.06), woodD: C('#2e1a0e', 0, 0.05), woodL: C('#8a5a32', 0, 0.06), oak: C('#6a4426', 0, 0.07),
  hinoki: C('#d8b07c', 0, 0.04), hinokiD: C('#c49a66', 0, 0.04),
  indigo: C('#2a3a60', 0, 0.05), indigoD: C('#1e2a48', 0, 0.05), tatami: C('#a8a46a', 0, 0.05), tatamiD: C('#8a8650', 0, 0.05),
  chrome: C('#c9ced4', 0, 0.04), chromeD: C('#8c9197', 0, 0.04), black: C('#141416', 0, 0.04),
  white: C('#eeeae2', 0, 0.03), steel: C('#9aa0a6', 0, 0.05), brass: C('#a7843e', 0, 0.06), cream: C('#e6dcc4', 0, 0.04),
  red: C('#b8302a', 0, 0.05), redD: C('#8a2420', 0, 0.05), snow: C('#eef3fb', 0, 0.025), snow2: C('#e2eaf6', 0, 0.025),
  bamboo: C('#c8b070', 0, 0.06), bambooD: C('#a8904e', 0, 0.06),
};

// ---------------------------------------------------------------- furniture



// counter stool: round cedar seat with an indigo cushion and a low back (faces -z)
export const stool = memo(() => {
  const m = new Model(8, 17, 8, 1 / 16);
  for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) m.box(x, 0, z, x + 1, 9, z + 1, K.wood);
  m.box(1, 3, 1, 7, 4, 7, (x, y, z) => (x === 1 || x === 6 || z === 1 || z === 6 ? K.woodD : null));
  m.cyl(4, 4, 3.9, 9, 10, K.wood);
  m.cyl(4, 4, 3.4, 10, 11, K.indigo);
  m.box(1, 11, 6, 7, 15, 7, K.wood);
  m.box(1, 15, 6, 7, 16, 7, K.woodD);
  return m;
});

// booth: wall side is +x, length along z. Dark cedar frame, indigo cushions, hinoki table.
export const booth = memo(() => {
  const m = new Model(21, 19, 35, 1 / 16);
  const bench = (z0, z1, back0, back1) => {
    m.box(0, 0, z0, 21, 5, z1, K.wood);
    m.box(0, 5, z0, 21, 7, z1, K.indigo);
    m.box(0, 6, z0 === 0 ? z1 - 1 : z0, 21, 7, z0 === 0 ? z1 : z0 + 1, K.indigoD);
    m.box(0, 7, back0, 21, 17, back1, (x, y) => (y < 11 ? K.indigo : (x % 4 === 0 ? K.woodD : K.wood)));
    m.box(0, 17, back0, 21, 18, back1, K.woodD);
    m.box(0, 0, back0, 1, 18, back1, K.woodD);
  };
  bench(0, 9, 0, 3);
  bench(26, 35, 32, 35);
  m.box(6, 11, 10, 21, 12, 25, (x, y, z) => (x === 6 || z === 10 || z === 24 ? K.wood : K.hinoki));
  m.box(19, 0, 17, 21, 11, 18, K.woodD);
  return m;
});

// ---------------------------------------------------------------- lanterns
// chochin: a ribbed paper lantern with black caps, hung from a cord `chain` voxels long
const chochinCache = {};
export const chochin = (chain = 6, kind = 'cream', scale = 1 / 24) => {
  const key = `${chain}|${kind}|${scale}`;
  return chochinCache[key] || (chochinCache[key] = (() => {
    const m = new Model(9, 12 + chain, 9, scale);
    const paper = kind === 'red' ? C('#e8482a', 1.5, 0.05) : C('#ffd49a', 1.35, 0.05);
    const rib = kind === 'red' ? C('#b83020', 1.0, 0.05) : C('#e8b070', 0.9, 0.05);
    const ink = kind === 'red' ? C('#1a0e0a', 0.15, 0.02) : C('#3a2010', 0.2, 0.02);
    [2.4, 3.3, 3.9, 4.3, 4.5, 4.5, 4.3, 3.9, 3.3, 2.4].forEach((r, i) =>
      m.cyl(4.5, 4.5, r, i + 1, i + 2, (x, y, z, a) => {
        if (i >= 2 && i <= 7 && Math.abs(a + Math.PI / 2) < 0.28) return i === 4 ? paper : ink; // a big brush character on the front
        return i & 1 ? paper : rib;
      }));
    m.cyl(4.5, 4.5, 2.6, 0, 1, K.black); m.cyl(4.5, 4.5, 2.6, 11, 12, K.black);
    m.box(4, 12, 4, 5, 12 + chain, 5, C('#2a1a10', 0, 0.04));
    return m;
  })());
};
// akari: a big washi globe pendant (hangs from the top of its cord)
export const akari = memo(() => {
  const m = new Model(15, 34, 15, 1 / 24);
  const paper = C('#ffe2b4', 1.25, 0.04), seam = C('#f0c890', 0.9, 0.04);
  m.sphere(7.5, 7, 7.5, 7, 6.6, 7, (x, y) => (y % 3 === 0 ? seam : paper));
  m.cyl(7.5, 7.5, 1.6, 13, 14, K.black);
  m.box(7, 14, 7, 8, 34, 8, C('#2a1a10', 0, 0.04));
  return m;
});
export const chandelier = akari;

// ---------------------------------------------------------------- tabletop bits (1/32)
function chopsticksAt(m, x, z) { m.box(x, 0, z, x + 3, 5, z + 3, K.hinokiD); for (const dx of [0, 2]) m.box(x + dx, 5, z + 1, x + dx + 1, 8, z + 2, K.hinoki); }
function soyAt(m, x, z) { m.cyl(x + 1.5, z + 1.5, 1.4, 0, 4, C('#c8dce4', 0, 0.04)); m.cyl(x + 1.5, z + 1.5, 1.0, 0, 3, C('#2a140a', 0, 0.04)); m.box(x + 1, 4, z + 1, x + 2, 6, z + 2, K.red); }
function shichimiAt(m, x, z) { m.box(x, 0, z, x + 2, 5, z + 2, K.bamboo); m.box(x, 5, z, x + 2, 6, z + 2, K.red); }
function menuStandAt(m, x, z) { m.box(x, 0, z, x + 6, 1, z + 2, K.wood); m.box(x, 1, z, x + 6, 9, z + 1, K.woodD); m.box(x + 1, 2, z, x + 5, 8, z + 1, C('#efe2c4', 0, 0.05)); }

function tableSet(variant) {
  const m = new Model(26, 10, 26, 1 / 32);
  // condiments only: tables start clear so the only dishes you see are ones customers actually used
  chopsticksAt(m, 10, 1); soyAt(m, 15, 1); shichimiAt(m, 7, 1); m.box(19, 0, 1, 21, 3, 3, K.white); menuStandAt(m, 1 + (variant & 1), 1);
  return m;
}
const tableSets = [0, 1, 2, 3].map((v) => memo(() => tableSet(v)));

// ---------------------------------------------------------------- counter + back-bar stuff
// glass sushi case: neta on crushed ice (where the nigiri come from)
const sushiCase = memo(() => {
  const m = new Model(26, 11, 12, 1 / 32);
  m.box(0, 0, 0, 26, 2, 12, K.hinoki);
  m.box(1, 2, 1, 25, 3, 11, (x, y, z) => ((x * 3 + z) % 5 === 0 ? C('#d8e8f0', 0, 0.04) : C('#f0f6fa', 0, 0.03)));
  const neta = [
    (x, y, z) => ((x + y) % 3 === 0 ? C('#fbe0c8', 0, 0.03) : C('#f08a4a', 0, 0.04)), // salmon
    () => C('#b0182a', 0, 0.05),                                                        // tuna
    (x, y, z) => ((x + z) % 3 === 0 ? C('#f4d8d0', 0, 0.03) : C('#e8a8a0', 0, 0.04)), // yellowtail
    () => C('#f2c840', 0, 0.04),                                                        // tamago
  ];
  neta.forEach((f, i) => m.box(2 + i * 6, 3, 3, 6 + i * 6, 5, 9, f));
  m.box(3, 5, 4, 5, 6, 6, C('#7ab040', 0, 0.06)); m.box(15, 5, 6, 16, 6, 8, C('#7ab040', 0, 0.06)); // shiso leaves
  const frame = K.woodD;
  for (const [x, z] of [[0, 0], [25, 0], [0, 11], [25, 11]]) m.box(x, 2, z, x + 1, 11, z + 1, frame);
  m.box(0, 10, 0, 26, 11, 1, frame); m.box(0, 10, 11, 26, 11, 12, frame); m.box(0, 10, 0, 1, 11, 12, frame); m.box(25, 10, 0, 26, 11, 12, frame);
  m.box(1, 8, 0, 25, 9, 1, C('#cfe2ea', 0, 0.05)); // a glint of glass along the front
  return m;
});
// tea urn: a tall glazed hot-water urn with a tap (faces -z)
const urn = memo(() => {
  const m = new Model(8, 14, 8, 1 / 16);
  const glaze = C('#6a7a5a', 0, 0.05), band = C('#3a2a1a', 0, 0.05);
  m.box(1, 0, 1, 7, 1, 7, K.woodD);
  m.cyl(4, 4, 3.4, 1, 12, (x, y) => (y === 3 || y === 10 ? band : glaze));
  m.cyl(4, 4, 2.4, 12, 13, K.wood); m.box(3, 13, 3, 5, 14, 5, K.woodD);
  m.box(3, 3, 0, 5, 4, 1, K.chrome); m.set(4, 2, 0, K.chrome);
  m.set(2, 8, 0, C('#ff6020', 3, 0.02));
  return m;
});
// two rice cookers keeping the rice warm
const riceCooker = memo(() => {
  const m = new Model(12, 11, 12, 1 / 32);
  m.cyl(6, 6, 5.6, 0, 8, (x, y) => (y === 2 ? C('#d8d4cc', 0, 0.03) : K.white));
  m.cyl(6, 6, 5.0, 8, 10, C('#c8c4bc', 0, 0.03)); m.box(5, 10, 5, 7, 11, 7, K.black);
  m.box(4, 3, 0, 8, 6, 1, C('#3a3a40', 0, 0.03)); m.set(5, 4, 0, C('#ff9a30', 2.5, 0.02));
  return m;
});
// tins of tea leaves
const teaTins = memo(() => {
  const m = new Model(8, 10, 5, 1 / 32);
  m.cyl(2, 2.5, 1.8, 0, 9, (x, y) => (y === 8 ? K.chrome : C('#3a6a3a', 0, 0.05)));
  m.cyl(6, 2.5, 1.8, 0, 7, (x, y) => (y === 6 ? K.chrome : C('#8a3020', 0, 0.05)));
  return m;
});
const plates = memo(() => {
  const m = new Model(9, 14, 9, 1 / 32);
  m.cyl(4.5, 4.5, 4.4, 0, 14, (x, y) => (y % 2 ? K.white : C('#2a4a7a', 0, 0.04)));
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
// maneki-neko: the beckoning cat, paw up, by the register (faces -z)
const maneki = memo(() => {
  const m = new Model(8, 14, 7, 1 / 32);
  const w = C('#f4f0e6', 0, 0.03), pink = C('#f0a0a0', 0, 0.03), gold = C('#e8c040', 0.6, 0.03);
  m.box(1, 0, 1, 7, 7, 6, w); m.box(1, 7, 1, 7, 12, 6, w);
  m.set(1, 12, 3, w); m.set(6, 12, 3, w); m.set(1, 13, 3, pink); m.set(6, 13, 3, pink);
  m.set(2, 9, 0, K.black); m.set(5, 9, 0, K.black); m.set(3, 8, 0, pink); m.set(4, 8, 0, pink);
  m.box(1, 6, 0, 7, 7, 6, K.red); m.set(3, 5, 0, gold); m.set(4, 5, 0, gold);
  m.box(7, 7, 2, 8, 13, 4, w); m.set(7, 13, 2, pink);    // raised paw
  m.box(2, 2, 0, 6, 5, 1, gold);                         // koban coin
  return m;
});
const glassesRow = memo(() => {
  const m = new Model(36, 4, 3, 1 / 32);
  const gl = C('#cfe2ea', 0, 0.05), glD = C('#a9c2cc', 0, 0.05);
  for (let x = 0; x < 36; x += 3) m.box(x, 0, 0, x + 2, 4, 2, (vx, y) => (y === 3 ? glD : gl));
  return m;
});
// a row of yunomi tea cups on the shelf
const cupColors = ['#6d7a5a', '#3d5f90', '#8a5a3c', '#d8cfc0', '#4a5a3a', '#a86a4a'];
const cupRow = memo(() => {
  const m = new Model(64, 5, 4, 1 / 32);
  for (let i = 0; i < 12; i++) {
    const c = C(cupColors[i % cupColors.length], 0, 0.05), x = 1 + i * 5.3;
    m.cyl(x + 1.5, 2, 1.6, 0, 4, c, 0.8); m.cyl(x + 1.5, 2, 1.6, 0, 1, c);
    m.cyl(x + 1.5, 2, 1.7, 4, 5, (vx, y, z) => (hash01(vx, i, z) > 0.4 ? C('#e8e0d0', 0, 0.03) : c), 1.0);
  }
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
export const clockFace = memo(() => {
  const m = new Model(11, 11, 2, 1 / 16, [5.5, 5.5, 2]);
  const face = C('#f2ead6', 0.7, 0.02), rim = C('#3a2416', 0, 0.04), tick = C('#1a1a1a', 0, 0.02);
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

// the shop cat: a calico asleep on the front window sill
export const cat = memo(() => {
  const m = new Model(15, 9, 8, 1 / 32);
  const w = C('#efe8dc', 0, 0.04), o = C('#d8803a', 0, 0.06), b = C('#2a2220', 0, 0.05), dk = C('#2a1a12', 0, 0.02), pk = C('#e09090', 0, 0.02);
  const patch = (x, y, z) => { const h = hash01(x >> 1, y >> 1, z >> 1); return h > 0.72 ? o : h < 0.2 ? b : w; };
  m.sphere(8.5, 2.6, 4, 6, 3.0, 3.6, patch);
  m.sphere(3.2, 4.0, 4, 2.6, 2.5, 2.6, (x, y, z) => (y < 3 && x < 3 ? w : patch(x, y, z)));
  m.set(2, 7, 2, o); m.set(2, 7, 5, b); m.set(3, 7, 2, o); m.set(3, 7, 5, b);
  m.set(0, 4, 3, dk); m.set(0, 4, 4, dk); m.set(1, 5, 2, dk); m.set(1, 5, 5, dk); m.set(0, 3, 3, pk);
  for (let x = 3; x < 9; x++) m.set(x, 0, 7, x % 3 === 0 ? b : o);
  return m;
});

// umbrella stand by the door: snowy wagasa and a clear plastic one
const umbrellaStand = memo(() => {
  const m = new Model(8, 30, 8, 1 / 32);
  m.cyl(4, 4, 3.6, 0, 14, (x, y) => (y % 4 === 0 ? K.woodD : C('#5a3a20', 0, 0.05)));
  const ind = C('#2a3a60', 0, 0.06), rd = C('#a82a24', 0, 0.06), clear = C('#d8e4ea', 0, 0.04);
  for (let y = 10; y < 28; y++) { m.set(2 + (y > 20 ? 1 : 0), y, 3, ind); if (y > 14 && y < 24) m.set(3, y, 3, ind); }
  m.set(3, 28, 3, K.bamboo); m.set(2, 29, 3, K.bamboo);
  for (let y = 10; y < 26; y++) { m.set(5, y, 5, rd); if (y > 13 && y < 22) m.set(6, y, 5, rd); }
  m.set(5, 26, 5, K.bamboo);
  for (let y = 12; y < 25; y++) m.set(5, y, 2, clear);
  return m;
});

// lamp-lit board in the x-y plane facing -z (text mirrored so it reads from the front)
function glowSign(lines, scale, border) {
  const w = Math.max(...lines.map((l) => textWidth(l.text))) + (border ? 6 : 0);
  const h = lines.length * 9 - 2 + (border ? 6 : 0);
  const m = new Model(w, h, 2, scale, [w / 2, 0, 1]);
  const off = border ? 3 : 0;
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) m.set(x, y, 1, K.woodD);
  lines.forEach((l, li) => {
    const lw = textWidth(l.text), x0 = off + Math.floor((w - 2 * off - lw) / 2);
    glyphPixels(l.text, (c, r) => m.set(w - 1 - (x0 + c), h - 1 - off - li * 9 - r, 0, l.color));
  });
  if (border) for (let x = 0; x < w; x++) for (let y = 0; y < h; y++)
    if ((x === 0 || x === w - 1 || y === 0 || y === h - 1) && !((x === 0 || x === w - 1) && (y === 0 || y === h - 1))) m.set(x, y, 0, border);
  return m;
}
const warmInk = C('#ffd9a0', 3.5, 0.03), redInk = C('#ff6a40', 3.5, 0.03), hinokiEdge = C('#d8b07c', 0.4, 0.04);
export const openSign = memo(() => glowSign([{ text: 'OPEN', color: warmInk }], 1 / 32, hinokiEdge));
export const closedSign = memo(() => glowSign([{ text: 'CLOSED', color: C('#b8a890', 0.25, 0.03) }], 1 / 32, C('#5a3a20', 0, 0.04)));

// warm string lights along the front glass, ending in tiny lanterns
function lanternStrand(len, withLantern, seed) {
  const sw = withLantern ? 5 : 3;
  const h = len + (withLantern ? 7 : 0);
  const m = new Model(sw, h, 3, 1 / 32, [sw / 2, h, 1.5]);
  const wire = C('#2a2620', 0, 0.02), led = C('#ffd590', 1.5, 0.06);
  const cx = Math.floor(sw / 2);
  for (let y = 0; y < len; y++) m.set(cx, h - 1 - y, 1, (y + seed) % 5 === 0 ? led : wire);
  if (withLantern) {
    const paper = seed % 3 === 0 ? C('#ff6a3a', 1.2, 0.05) : C('#ffd49a', 1.1, 0.05);
    m.box(0, 1, 0, 5, 6, 3, paper); m.box(1, 0, 1, 4, 1, 2, K.black); m.box(1, 6, 1, 4, 7, 2, K.black);
  }
  return m;
}
const strands = [0, 1, 2, 3, 4, 5].map((i) => memo(() => lanternStrand(14 + i * 7, i % 2 === 0 || i === 5, i)));
const topString = memo(() => {
  const m = new Model(64, 1, 1, 1 / 32, [32, 1, 0.5]);
  for (let x = 0; x < 64; x++) m.set(x, 0, 0, x % 4 === 0 ? C('#ffd590', 1.5, 0.06) : C('#2a2620', 0, 0.02));
  return m;
});

// woodblock prints: the wave, Fuji at dawn, a crane, plum blossom
function print(kind) {
  const m = new Model(10, 12, 1, 1 / 16, [5, 0, 0.5]);
  const frame = [C('#2a1a10', 0, 0.04), C('#5a3a20', 0, 0.06)][kind & 1];
  const mat = C('#e8e0cc', 0, 0.03);
  const pal = {
    S: C('#e8d8b0', 0, 0.05), W: C('#f4f0e6', 0, 0.03), B: C('#3a6aa0', 0, 0.05), D: C('#1e3a6a', 0, 0.05),
    R: C('#d04a2a', 0, 0.04), K: C('#1a1614', 0, 0.03), P: C('#e890a8', 0, 0.05),
  };
  const art = [
    ['SSSSSS', 'SSSWSS', 'SSWBWS', 'SWBBBW', 'WBBDBB', 'BBDDDB', 'BDDDDD', 'DDDDDD'],
    ['SSSSRS', 'SSSSSS', 'SSWWSS', 'SWWWWS', 'SBBBBS', 'BBBBBB', 'BBDDBB', 'DDDDDD'],
    ['SSSRSS', 'SSSWSS', 'SSWWSS', 'SWWWWS', 'WWWKWS', 'SSWKSS', 'SSKSKS', 'SSSSSS'],
    ['SKSSPS', 'SSKSSS', 'SPSKSS', 'SSSSKS', 'SSPSKP', 'SSSSSK', 'SSSPSS', 'SSSSSS'],
  ][kind % 4];
  for (let y = 0; y < 12; y++) for (let x = 0; x < 10; x++) {
    let c = frame;
    if (x > 0 && x < 9 && y > 0 && y < 11) c = mat;
    if (x > 1 && x < 8 && y > 1 && y < 10) c = pal[art[9 - y][x - 2]];
    m.set(9 - x, y, 0, c);
  }
  return m;
}
const prints = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => memo(() => print(k)));
// hanging scroll: brocade mount, a brush stroke and a red seal (hangs from its top)
const kakejiku = memo(() => {
  const m = new Model(10, 26, 1, 1 / 32, [5, 26, 0.5]);
  const mount = C('#5a4a3a', 0, 0.05), paper = C('#efe6d0', 0, 0.03), ink = C('#1a1614', 0, 0.03), seal = C('#c03020', 0, 0.03);
  for (let y = 0; y < 26; y++) for (let x = 0; x < 10; x++) m.set(x, y, 0, x === 0 || x === 9 || y < 2 || y > 22 ? mount : paper);
  for (let y = 5; y < 20; y++) { const x = 4 + Math.round(Math.sin(y * 0.6) * 1.2); m.set(x, y, 0, ink); if (y % 4 < 2) m.set(x + 1, y, 0, ink); }
  m.set(6, 4, 0, seal); m.set(7, 4, 0, seal);
  m.box(0, 25, 0, 10, 26, 1, K.woodD);
  return m;
});
// noren: split indigo curtain over the door with a white emblem (hangs from its rod)
export const noren = memo(() => {
  const w = 22, h = 11, m = new Model(w, h, 1, 1 / 16, [w / 2, h, 0.5]);
  const ind = C('#24345a', 0, 0.05), wht = C('#ece6d8', 0, 0.03);
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) {
    const slit = (x === 5 || x === 11 || x === 16) && y < 7;
    if (slit) continue;
    const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 5.5);
    m.set(w - 1 - x, y, 0, d > 2.2 && d < 3.3 ? wht : ind);
  }
  for (let x = 0; x < w; x++) m.set(x, h - 1, 0, K.wood);
  return m;
});
// nobori: tall banner on a pole (pole at local x 0)
const nobori = memo(() => {
  const m = new Model(8, 42, 2, 1 / 16, [0.5, 0, 1]);
  const red = C('#b83226', 0, 0.05), wht = C('#f0e8d8', 0, 0.03);
  m.box(0, 0, 0, 1, 42, 1, K.black);
  for (let y = 12; y < 40; y++) for (let x = 1; x < 8; x++) {
    const stroke = x >= 3 && x <= 5 && ((y % 5 !== 0 && (x === 4 || y % 5 === 2)) && y < 37 && y > 14);
    m.set(x, y, 0, x === 1 || y === 39 ? wht : stroke ? wht : red);
  }
  m.box(0, 39, 0, 8, 40, 1, K.black);
  return m;
});
// a glowing drink vending machine with snow on its roof (faces -z)
const vending = memo(() => {
  const m = new Model(14, 30, 11, 1 / 16);
  const body = C('#e8eaee', 0, 0.03), blue = C('#2a5ab0', 0, 0.04), back = C('#f4f8ff', 2.0, 0.03);
  m.box(0, 0, 0, 14, 29, 11, (x, y, z) => (y < 2 ? K.black : x === 0 || x === 13 ? blue : body));
  const cans = ['#d83a2a', '#3a8a4a', '#e8b030', '#2a4a9a', '#8a5a3a', '#f0f0f0', '#1a1a1a', '#e86a9a'];
  for (let y = 15; y < 27; y++) for (let x = 2; x < 12; x++) {
    const row = Math.floor((y - 15) / 4), ly = (y - 15) % 4;
    m.set(x, y, 0, ly === 3 ? C('#c8ccd4', 1.0, 0.03) : (x % 2 === 0 && ly < 3) ? C(cans[(x / 2 + row * 3) % cans.length], 1.6, 0.05) : back);
  }
  for (let x = 2; x < 12; x += 2) m.set(x, 14, 0, C(x % 4 ? '#ff4040' : '#40c0ff', 2.5, 0.02));
  m.box(9, 8, 0, 12, 12, 1, C('#3a3e46', 0, 0.03)); m.set(10, 10, 0, C('#40ff80', 2, 0.02));
  m.box(2, 3, 0, 9, 6, 1, K.black);
  m.box(0, 29, 0, 14, 30, 11, (x, y, z) => (hash01(x, y, z) > 0.15 ? K.snow : null));
  return m;
});
// a red Japan Post box with a cap of snow
const postbox = memo(() => {
  const m = new Model(8, 17, 8, 1 / 16);
  const red = C('#c8282a', 0, 0.05);
  m.cyl(4, 4, 3.2, 0, 1, K.black); m.cyl(4, 4, 3.0, 1, 14, red);
  m.cyl(4, 4, 3.6, 14, 15, red); m.cyl(4, 4, 3.0, 15, 16, K.snow); m.cyl(4, 4, 2.0, 16, 17, K.snow2);
  m.box(2, 10, 0, 6, 11, 1, K.black); m.box(3, 5, 0, 5, 7, 1, C('#e8e0d0', 0, 0.03));
  return m;
});

// the front door: a sliding cedar door with a lattice of glass panes (slides into its pocket toward -x)
export const doorModel = memo(() => {
  const m = new Model(19, 38, 2, 1 / 16, [0, 0, 1]);
  for (let y = 0; y < 38; y++) for (let x = 0; x < 19; x++) {
    const frame = x < 2 || x > 16 || y < 10 || y > 35;
    const bar = !frame && (y % 6 === 4 || x === 9);
    if (frame) { m.set(x, y, 0, y < 10 && y > 1 && x > 1 && x < 17 ? K.wood : K.woodD); m.set(x, y, 1, K.woodD); }
    else if (bar) m.set(x, y, 0, K.woodD);
  }
  m.box(3, 18, 0, 4, 22, 2, K.black); // pull
  return m;
});

// ---------------------------------------------------------------- the main room's details
const bellCache = {};
export const bellPendant = (cord) => bellCache[cord] || (bellCache[cord] = (() => {
  const m = new Model(8, 7 + cord, 8, 1 / 32);
  [3.6, 3.3, 2.9, 2.4, 1.9, 1.4].forEach((r, i) => m.cyl(4, 4, r, i, i + 1, C('#ffe2b8', i === 0 ? 2.2 : 1.1, 0.03), i === 0 ? -1 : r - 1));
  m.cyl(4, 4, 1.2, 6, 7, K.woodD);
  m.box(4, 7, 4, 5, 7 + cord, 5, K.black);
  m.box(3, 0, 3, 5, 1, 5, C('#fff4e0', 5, 0.02));
  return m;
})());
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
// a bathhouse-style mural of Fuji over the sea
export const mural = memo(() => {
  const w = 64, h = 28, m = new Model(w, h, 1, 1 / 16, [w / 2, 0, 0.5]);
  const col = (x, y) => {
    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) return C('#3a2416', 0, 0.05);
    const fuji = 30 - Math.abs(x - 26) * 0.62;
    if (y < 7) { const crest = (x + y * 3) % 11 < 2 && y > 3; return crest ? C('#f0f4f8', 0, 0.04) : y < 4 ? C('#1e4a8a', 0, 0.06) : C('#2e62a8', 0, 0.06); }
    if (y < fuji && y >= 7) { if (y > 18 && y > fuji - 6 + Math.sin(x * 1.3) * 1.2) return C('#f4f4f0', 0, 0.03); return x < 26 ? C('#3a5a9a', 0, 0.05) : C('#2e4a82', 0, 0.05); }
    if (Math.hypot(x - 50, y - 20) < 3.2) return C('#e85a3a', 0, 0.04);
    if (x > 54 && x < 60 && y > 6 && y < 20 && Math.abs(x - 57) < (20 - y) * 0.45) return C('#2a5a3a', 0, 0.1);
    return y > 22 ? C('#8ab8d8', 0, 0.06) : C('#c8dce8', 0, 0.06);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m.set(w - 1 - x, y, 0, col(x, y));
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
const menuWood = C('#d8b07c', 0, 0.05), menuInk = C('#2a1a10', 0, 0.03), menuFrame = C('#4a2c18', 0, 0.05);
const menuBoards = [['TEA 300'], ['SUSHI 600'], ['YAKITORI 800'], ['GYOZA 700']].map((l) => memo(() => board(l, 1 / 64, menuWood, menuInk, menuFrame)));
const restroomPlaque = memo(() => board(['RESTROOM'], 1 / 56, C('#2a2420', 0, 0.05), C('#e8dcc0', 0.3, 0.04), C('#6a4022', 0, 0.05)));
// big sake bottles on top of the drinks fridge
const sakeBottles = memo(() => {
  const m = new Model(36, 14, 4, 1 / 32);
  const glass = ['#2a4a2a', '#4a2a14', '#c8d8d0', '#1e3a2a', '#5a3018', '#2a3a4a'];
  for (let i = 0; i < 6; i++) {
    const c = C(glass[i], 0, 0.05), x = i * 6 + 1;
    m.box(x, 0, 0, x + 4, 9, 4, (vx, y) => (y > 3 && y < 7 && vx > x && vx < x + 3 ? C('#efe6d0', 0, 0.03) : c));
    m.box(x + 1, 9, 1, x + 3, 13, 3, c); m.box(x + 1, 13, 1, x + 3, 14, 3, K.red);
  }
  return m;
});
// daruma dolls along the shelf
const darumaRow = memo(() => {
  const m = new Model(40, 5, 4, 1 / 32);
  for (let x = 1; x < 38; x += 6) {
    const c = x % 4 === 1 ? K.red : C('#e8c040', 0, 0.05);
    m.box(x, 0, 0, x + 4, 5, 3, c); m.box(x + 1, 2, 0, x + 3, 4, 1, K.white); m.set(x + 1, 3, 0, K.black);
  }
  return m;
});
// a basket of mikan oranges on the counter
export const mikan = memo(() => {
  const m = new Model(10, 8, 10, 1 / 32);
  m.cyl(5, 5, 4.6, 0, 3, (x, y) => ((x + y) & 1 ? C('#8a6a3a', 0, 0.06) : C('#6a4a2a', 0, 0.06)));
  const o = [C('#f08a20', 0, 0.06), C('#e87a18', 0, 0.06)];
  m.sphere(5, 4, 5, 4, 2.4, 4, (x, y, z) => (hash01(x, y, z) > 0.15 ? o[(x + z) & 1] : null));
  m.sphere(5, 6.5, 5, 2, 1.5, 2, o[0]);
  m.set(5, 8 - 1, 5, C('#3a7a2a', 0, 0.05));
  return m;
});
// bamboo place mat with chopsticks on a rest and a little soy dish
const placemat = (soy) => {
  const m = new Model(14, 3, 9, 1 / 32);
  for (let x = 0; x < 14; x++) for (let z = 0; z < 9; z++) m.set(x, 0, z, z & 1 ? K.bamboo : K.bambooD);
  m.box(10, 1, 2, 11, 2, 7, C('#6a7a5a', 0, 0.04)); m.box(9, 1, 1, 10, 2, 8, K.woodD); m.box(11, 1, 1, 12, 2, 8, K.woodD);
  if (soy) { m.box(2, 1, 3, 6, 2, 7, K.white); m.box(3, 1, 4, 5, 2, 6, C('#2a140a', 0, 0.03)); }
  return m;
};
const placematK = memo(() => placemat(true)), placematN = memo(() => placemat(false));
const radio = memo(() => {
  const m = new Model(12, 8, 6, 1 / 32);
  m.box(0, 0, 0, 12, 8, 6, C('#6a3a1a', 0, 0.06));
  m.box(1, 1, 0, 6, 6, 1, (x, y) => ((x + y) & 1 ? C('#c8b080', 0, 0.05) : C('#8a7050', 0, 0.05)));
  m.box(7, 3, 0, 11, 6, 1, C('#ffb860', 2.2, 0.03)); m.set(9, 1, 0, K.brass);
  return m;
});
// a little kerosene space heater with a glowing grille
// a round kerosene stove: a steel drum with a glowing window round its middle, a grille on top and a kettle on it
export const heater = memo(() => {
  const m = new Model(11, 15, 11, 1 / 16);
  const drum = C('#4a5a5a', 0, 0.05), drumD = C('#2e3838', 0, 0.05), glow = C('#ff7a30', 2.4, 0.06), grille = C('#1c1c1e', 0, 0.03);
  m.cyl(5.5, 5.5, 5.2, 0, 1, drumD);
  m.cyl(5.5, 5.5, 4.6, 1, 9, (x, y) => (y >= 4 && y <= 6 ? glow : y === 3 || y === 7 ? drumD : drum));
  m.cyl(5.5, 5.5, 5.0, 9, 10, (x, y, z) => ((x + z) & 1 ? grille : drumD));
  m.cyl(5.5, 5.5, 2.6, 10, 13, C('#b8302a', 0, 0.05)); m.cyl(5.5, 5.5, 1.2, 13, 14, K.black);   // the kettle
  m.box(7, 12, 5, 9, 13, 6, C('#b8302a', 0, 0.05));                                           // its spout
  return m;
});
// a glass-fronted drinks fridge: ramune, tea and beer on lit shelves (faces -z)
export const drinksFridge = memo(() => {
  const m = new Model(18, 28, 12, 1 / 16);
  const bottles = ['#3a7a4a', '#e8e0c8', '#c8902a', '#5a2a18', '#e8d070', '#2a4a7a', '#7ac8e8'].map((h) => C(h, 0.55, 0.08));
  const lit = C('#fff0d8', 0.7, 0.05), frame = C('#2a1a10', 0, 0.04);
  m.box(0, 0, 0, 18, 28, 12, (x, y, z) => {
    if (x === 0 || x === 17 || y < 3 || y > 25 || z === 11) return frame;
    if (z > 0) return y % 6 === 2 ? K.chrome : (y % 6 === 3 || y % 6 === 4) && z < 9 ? bottles[Math.floor(hash01(x, y, z) * 6.99)] : lit;
    return y % 6 === 2 ? K.chrome : null;                                                     // the glass front: just the shelf edges
  });
  m.box(1, 26, 0, 17, 28, 1, C('#c8302a', 0.8, 0.05));                                       // a lit sign across the top
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
const exitSign = memo(() => board(['EXIT'], 1 / 40, C('#0a3a1a', 0, 0.03), C('#5aff8a', 4, 0.03), C('#e8e8e8', 0, 0.03)));
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
// yakitori grill (konro): a trough of glowing binchotan with skewers laid across it (faces -z)
export const yakitoriGrill = memo(() => {
  const m = new Model(16, 16, 13, 1 / 16);
  m.box(0, 0, 0, 16, 13, 13, st); m.box(1, 2, 0, 15, 11, 1, stD);
  m.box(0, 13, 1, 16, 15, 12, (x, y, z) => (y === 14 && x > 0 && x < 15 && z > 2 && z < 10 ? null : C('#d8cfc0', 0, 0.04))); // clay-lined box
  const coals = [C('#ff6a20', 2.2, 0.25), C('#ff9a3a', 1.6, 0.2), C('#3a1a10', 0, 0.06)];
  for (let x = 1; x < 15; x++) for (let z = 3; z < 10; z++) m.set(x, 13, z, coals[Math.floor(hash01(x, 13, z) * 2.999)]);
  for (let x = 2; x < 15; x += 2) {
    m.box(x, 15, 1, x + 1, 16, 12, K.bamboo);
    for (let z = 4; z < 9; z++) m.set(x, 16 - 1, z, z === 6 ? C('#e8f0d0', 0, 0.05) : (z & 1 ? C('#8a4a20', 0, 0.08) : C('#6a3014', 0, 0.08)));
  }
  return m;
});
// gyoza teppan: a black flat-top with rows of crisp-bottomed dumplings and a lid (faces -z)
export const gyozaTeppan = memo(() => {
  const m = new Model(14, 16, 13, 1 / 16);
  m.box(0, 0, 0, 14, 13, 13, st); m.box(1, 2, 0, 13, 11, 1, stD);
  m.box(0, 13, 0, 14, 14, 12, C('#1e1e20', 0, 0.04));
  m.box(0, 13, 12, 14, 16, 13, st);
  for (let r = 0; r < 3; r++) for (let x = 2; x < 9; x += 2) { m.box(x, 14, 2 + r * 3, x + 1, 15, 4 + r * 3, C('#f0e6d0', 0, 0.04)); m.set(x, 14, 4 + r * 3, C('#c8902a', 0, 0.05)); }
  m.box(10, 14, 2, 13, 17 - 1, 10, (x, y) => (y === 15 ? K.woodD : K.wood));
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
  for (const [x, z, c] of [[7, 7, '#f08a4a'], [9, 8, '#f08a4a'], [12, 6, '#f4f0e6'], [15, 10, '#4a9a3a'], [17, 9, '#e8f0d0'], [19, 7, '#b0182a']]) m.box(x, 1, z, x + 2, 3, z + 2, C(c, 0, 0.08));
  m.cyl(36, 11, 7, 0, 4, (x, y) => (y === 3 ? C('#fbf8ee', 0, 0.03) : C('#a8784a', 0, 0.05)));   // hangiri tub of sushi rice
  m.cyl(52, 9, 4, 0, 4, K.chrome); m.cyl(52, 9, 3, 3, 4, C('#d8c8a0', 0, 0.06));             // bowl of gyoza filling
  m.box(64, 0, 3, 96, 1, 20, K.chrome);                                                       // tray of folded gyoza
  for (let x = 66; x < 94; x += 4) for (let z = 5; z < 18; z += 4) m.box(x, 1, z, x + 3, 3, z + 2, C('#f0e6d0', 0, 0.05));
  for (let i = 0; i < 6; i++) m.cyl(112, 10, 4.4, i, i + 1, K.white);                         // plates
  m.box(126, 0, 4, 146, 6, 18, C('#8a6a44', 0, 0.06));                                        // crate of negi
  for (let x = 128; x < 144; x += 2) m.box(x, 6, 6, x + 1, 7, 16, (xx, y, z) => (z < 11 ? C('#f0f4e0', 0, 0.04) : C('#4a9a3a', 0, 0.08)));
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
  m.box(0, 0, 0, 7, 11, 9, C('#e8e2d0', 0, 0.06)); m.box(1, 5, 0, 6, 8, 1, C('#2a5a3a', 0, 0.04)); // rice sacks
  m.box(7, 0, 1, 14, 9, 10, C('#b08a5a', 0, 0.08));
  return m;
});


// ---------------------------------------------------------------- the apartment upstairs
// the mail-order catalog lying on the kotatsu
const catalogBook = memo(() => {
  const m = new Model(8, 2, 10, 1 / 32);
  m.box(0, 0, 0, 8, 2, 10, (x, y) => (y === 1 ? (x < 4 ? C('#c83a2a', 0, 0.04) : C('#f0e8d8', 0, 0.03)) : C('#e8e0d0', 0, 0.03)));
  return m;
});
// kotatsu: a low table over a heater, wrapped in a quilt (glows faintly where the quilt meets the floor)
export const kotatsu = memo(() => {
  const m = new Model(18, 8, 18, 1 / 16);
  const quilt = (x, y, z) => (((x >> 1) + (z >> 1)) & 1 ? C('#c0582a', 0, 0.05) : C('#d8783a', 0, 0.05));
  m.box(0, 0, 0, 18, 6, 18, (x, y, z) => (x === 0 || z === 0 || x === 17 || z === 17 || y === 5 ? (y === 0 && (x + z) % 3 === 0 ? C('#ff8a3a', 1.6, 0.1) : quilt(x, y, z)) : null));
  m.box(1, 6, 1, 17, 7, 17, K.wood); m.box(2, 7, 2, 16, 7 + 1, 16, null);
  m.box(1, 6, 1, 17, 7, 17, (x, y, z) => (x === 1 || z === 1 || x === 16 || z === 16 ? K.woodD : K.hinoki));
  return m;
});
export const zabuton = memo(() => {
  const m = new Model(9, 2, 9, 1 / 16);
  m.box(0, 0, 0, 9, 2, 9, (x, y, z) => (y === 1 && x > 0 && x < 8 && z > 0 && z < 8 ? C('#3a4a7a', 0, 0.05) : C('#2a3660', 0, 0.05)));
  m.set(4, 2 - 1, 4, C('#e8c040', 0, 0.03));
  return m;
});
// futon laid out on the bedroom tatami: mattress, a patterned quilt turned down, a buckwheat pillow
export const futon = memo(() => {
  const m = new Model(16, 4, 32, 1 / 16);
  m.box(0, 0, 0, 16, 2, 32, C('#f0ece2', 0, 0.03));
  m.box(0, 2, 0, 16, 4, 22, (x, y, z) => (((x >> 2) + (z >> 2)) & 1 ? C('#5a7aa8', 0, 0.05) : C('#e8e0d0', 0, 0.04)));
  m.box(0, 2, 20, 16, 3, 24, C('#d8d0c0', 0, 0.04));
  m.box(4, 2, 26, 12, 4, 30, C('#c8b890', 0, 0.06));
  return m;
});
// andon: a paper floor lamp in a wooden frame
export const andon = memo(() => {
  const m = new Model(6, 14, 6, 1 / 16);
  m.box(0, 0, 0, 6, 1, 6, K.woodD);
  for (const [x, z] of [[0, 0], [5, 0], [0, 5], [5, 5]]) m.box(x, 1, z, x + 1, 14, z + 1, K.woodD);
  m.box(1, 2, 1, 5, 12, 5, (x, y, z) => (x === 1 || x === 4 || z === 1 || z === 4 ? C('#ffd49a', 1.4, 0.05) : null));
  m.box(0, 13, 0, 6, 14, 6, (x, y, z) => (x === 0 || z === 0 || x === 5 || z === 5 ? K.woodD : null));
  return m;
});
// tansu: a stepped chest of drawers with iron pulls (faces -z)
export const tansu = memo(() => {
  const m = new Model(20, 18, 8, 1 / 16);
  m.box(0, 0, 0, 20, 12, 8, K.oak); m.box(0, 12, 0, 12, 18, 8, K.oak);
  for (let y = 1; y < 18; y += 4) for (const x0 of [1, 11]) { if (y > 11 && x0 > 1) continue; m.box(x0, y, 0, x0 + 8, y + 3, 1, K.wood); m.set(x0 + 4, y + 1, 0, K.black); }
  return m;
});
// kitchenette against the back wall: cabinet, a little sink, a two-ring gas hob with a kettle (faces -z)
export const kitchenette = memo(() => {
  const m = new Model(40, 18, 10, 1 / 16);
  m.box(0, 0, 0, 40, 13, 10, (x, y, z) => (z === 0 && x % 10 === 0 ? K.woodD : C('#d8d0c0', 0, 0.03)));
  m.box(0, 13, 0, 40, 14, 10, K.steel);
  m.box(4, 12, 2, 14, 14, 8, (x, y) => (y === 13 ? null : C('#8a9098', 0, 0.04))); m.box(9, 14, 8, 10, 18, 9, K.chrome); m.box(9, 17, 5, 10, 18, 8, K.chrome);
  for (const x of [22, 31]) m.cyl(x + 2, 5, 2.4, 14, 15, K.black);
  m.cyl(24, 5, 2.2, 15, 18, C('#a8302a', 0, 0.05)); m.box(26, 17, 4, 28, 18, 6, K.black); // kettle
  m.cyl(33, 5, 1.0, 14, 15, C('#4a8aff', 2.2, 0.05));
  return m;
});
export const shoeRack = memo(() => {
  const m = new Model(14, 10, 6, 1 / 16);
  m.box(0, 0, 0, 14, 10, 6, (x, y, z) => (y % 5 === 0 || x === 0 || x === 13 ? K.wood : null));
  m.box(2, 1, 1, 6, 2, 5, C('#3a2a1a', 0, 0.05)); m.box(8, 6, 1, 12, 7, 5, C('#7a2a2a', 0, 0.05));
  return m;
});
export const bookshelf = memo(() => {
  const m = new Model(20, 16, 6, 1 / 16);
  const r = rng(31);
  m.box(0, 0, 0, 20, 16, 6, (x, y) => (y % 5 === 0 || x === 0 || x === 19 ? K.wood : null));
  for (let sh = 0; sh < 3; sh++) for (let x = 1; x < 19; x++) {
    if (r() < 0.15) continue;
    const h = 2 + Math.floor(r() * 3), c = C(['#8a2a24', '#2a4a7a', '#e8dcc0', '#3a5a3a', '#c89a3a', '#5a3a5a'][Math.floor(r() * 6)], 0, 0.06);
    m.box(x, sh * 5 + 1, 1, x + 1, sh * 5 + 1 + h, 5, c);
  }
  return m;
});
// a little rounded hatch where the sushi belt goes through the wall (opening faces -z)
export const beltHatch = memo(() => {
  const m = new Model(12, 10, 10, 1 / 32);
  m.box(0, 0, 0, 12, 10, 10, (x, y, z) => (z === 0 && x > 1 && x < 10 && y < 5 ? null : (z > 0 && x > 1 && x < 10 && y < 5 ? C('#0e0a08', 0, 0.02) : (y === 9 ? K.woodD : K.wood))));
  m.box(3, 6, 0, 9, 8, 1, C('#e8482a', 1.0, 0.05)); // a little red noren
  return m;
});

// ---------------------------------------------------------------- placement
export function placeProps(batch) {
  const F = 0.25; // shop floor
  // every seat is recorded so people (and you) can sit: hip position, seat height, facing yaw
  const seats = batch.seats = [];

  // `surf` is the height of the table a seat's dishes go on; seats round the island also have `beltAt`, the point
  // on the sushi belt in front of them, where they can lift off what they ordered.
  const r = rng(99);

  // ================= the kaiten counter: booths butt up against the front of its base (two to a bench), stools line
  // its two ends, and you work on the chef's side behind it
  [3.9, 6.15, 8.4, 10.65].forEach((bx, i) => {
    batch.add(booth(), bx, F, 5.75 - 21 / 32, 3);
    for (const sx of [-0.7, 0.7]) for (const sz of [5.45, 4.85]) seats.push({ x: bx + sx, z: sz, y: 0.69, yaw: sx < 0 ? -Math.PI / 2 : Math.PI / 2, kind: 'booth', surf: 1.0, beltAt: [bx, 6.15, 1.125], approach: [bx + sx, 4.05] });
    batch.add(tableSets[i % 4](), bx, F + 0.75, 5.3, 2, false);
    batch.add(bellPendant(26), bx, 2.68, 5.1, 0, false);
  });
  for (const z of [6.25, 7.1, 7.95, 8.8]) {
    batch.add(stool(), 13.12, 0.375, z, 1);
    seats.push({ x: 13.12, z, y: 1.06, yaw: Math.PI / 2, kind: 'stool', surf: 1.125, beltAt: [12.35, z, 1.125] });
  }
  for (const z of [6.25, 7.1]) {
    batch.add(stool(), 2.38, 0.375, z, 3);
    seats.push({ x: 2.38, z, y: 1.06, yaw: -Math.PI / 2, kind: 'stool', surf: 1.125, beltAt: [3.15, z, 1.125] });
  }
  // the belt comes out of a hatch under the pass and goes back into one at the end of the west return
  batch.add(beltHatch(), 12.35, 1.125, 9.95, 0, false); batch.add(beltHatch(), 3.15, 1.125, 7.95, 0, false);
  for (const x of [4.0, 6.5, 9.0, 11.25]) batch.add(chochin(6, x === 6.5 || x === 11.25 ? 'red' : 'cream'), x, 2.7, 6.2, 0, false);
  for (const x of [5.5, 9.5]) batch.add(chochin(4, 'cream'), x, 2.75, 8.4, 0, false);

  // the back bar: tea urns, the radio, tins, plates, and the cups on the shelf over it
  const BT = 1.0;
  batch.add(radio(), 4.3, BT, 9.75, 0, false);
  batch.add(teaTins(), 5.0, BT, 9.75, 0, false);
  batch.add(urn(), 6.0, BT, 9.65, 0, false, 'urns'); batch.add(urn(), 6.6, BT, 9.65, 0, false, 'urns');
  batch.add(plates(), 7.8, BT, 9.7, 0, false, 'platesA'); batch.add(plates(), 8.1, BT, 9.7, 0, false, 'platesA');
  batch.add(plates(), 9.5, BT, 9.7, 0, false, 'platesB');
  for (const x of [4.9, 6.9, 8.9]) batch.add(cupRow(), x, 2.375, 9.8, 0, false, 'mugs');

  // booths backed onto the shoji partition, served by hand
  [1.3, 3.5, 5.65, 9.6, 11.72].forEach((bx, i) => {
    batch.add(booth(), bx, F, 0.25 + 21 / 32, 1);
    for (const sx of [-0.7, 0.7]) for (const sz of [0.6, 1.2]) seats.push({ x: bx + sx, z: sz, y: 0.69, yaw: sx < 0 ? -Math.PI / 2 : Math.PI / 2, kind: 'booth', surf: 1.0, approach: [bx + sx, 1.95] });
    batch.add(tableSets[(i + 2) % 4](), bx, F + 0.75, 0.72, 0, false);
    batch.add(bellPendant(26), bx, 2.68, 0.75, 0, false);
  });

  // ================= the front room behind the shoji: booths end-on to the glass, looking out over the bay.
  // No belt out here: these guests are served by hand.
  [1.4, 3.65, 5.9, 8.15, 10.4].forEach((bx, i) => {
    batch.add(booth(), bx, F, -3.125 + 21 / 32, 1);
    for (const sx of [-0.7, 0.7]) for (const sz of [-2.8, -2.2]) seats.push({ x: bx + sx, z: sz, y: 0.69, yaw: sx < 0 ? -Math.PI / 2 : Math.PI / 2, kind: 'booth', surf: 1.0, approach: [bx + sx, -1.42] });
    batch.add(tableSets[(i + 1) % 4](), bx, F + 0.75, -2.67, 0, false);
    batch.add(chochin(5, i % 2 ? 'red' : 'cream'), bx, 2.0, -2.55, 0, false);
  });
  for (const x of [2.6, 5.2, 7.8, 10.4, 14.4]) batch.add(pothosBasket(), x, 2.74, -2.8, Math.floor(r() * 4), false);
  for (let x = 0.5; x < 15.6; x += 0.34 + r() * 0.12) {
    if (x > 12.55 && x < 14.2) continue;
    batch.add(strands[Math.floor(r() * 4)](), x, 2.62, -3.05 + r() * 0.04, 0, false);
  }
  for (const x of [1.0, 3.0, 5.0, 7.0, 9.0, 11.0, 15.0]) batch.add(topString(), x, 2.6, -3.09, 0, false);

  // ================= the genkan: the cat on the sill, umbrellas by the door, the register on its counter
  batch.add(cat(), 12.3, 1.0, -3.0, 0, false);
  batch.add(umbrellaStand(), 12.2, F, -2.55);
  batch.add(register(), 15.0, 1.0, -1.35, 2, false, 'register');
  batch.add(maneki(), 15.55, 1.0, -1.45, 0, false);
  batch.add(mikan(), 14.5, 1.0, -1.35, 0, false);

  // back wall: wooden menu boards over the back bar, sake and daruma on the shelf, signs for the restrooms
  [4.8, 6.8, 8.8, 12.6].forEach((x, i) => batch.add(menuBoards[i](), x, 2.62, 9.99, 0, false));
  batch.add(sakeBottles(), 2.3, 2.0, 9.87, 0, false);
  batch.add(darumaRow(), 3.15, 2.0, 9.9, 0, false);
  batch.add(restroomPlaque(), 1.0, 2.55, 9.86, 0, false);
  batch.add(wheelchairSign(), 2.05, 1.6, 9.99, 0, false);
  for (const x of [10.56, 14.56]) batch.add(noren(), x, 2.4, 9.92, 0, false); // the kitchen doorways

  // ================= back of house
  // hallway
  batch.add(prints[6](), 0.26, 1.6, 11.6, 3, false); batch.add(prints[1](), 0.26, 1.6, 13.4, 3, false);
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

  // kitchen: the cook line along the back wall under the hood
  const KL = 15.31;
  batch.add(fryer(), 6.45, F, KL, 0, true, 'fry'); batch.add(fryer(), 7.1, F, KL, 0, true, 'fry');
  batch.add(gyozaTeppan(), 8.1, F, KL, 0, true, 'grill8.1');
  batch.add(yakitoriGrill(), 9.65, F, KL, 0, true, 'grill9.65'); batch.add(yakitoriGrill(), 10.65, F, KL, 0, true, 'grill10.65');
  batch.add(range(), 12.0, F, KL, 0, true, 'ramen'); batch.add(range(), 13.6, F, KL, 0);
  batch.add(hangingPans(), 10.4, 2.24, 14.2, 0, false);
  batch.add(prepStuff(), 9.5, 0.875, 12.65, 0, false);
  batch.add(sacks(), 9.5, 0.5, 12.65, 0, false);
  batch.add(ticketRail(), 12.6, 2.2, 10.32, 2, false);
  // the plating station under the pass: plates, the rice cookers and the sushi case right by the belt, which runs
  // along it and out through a hatch under the pass into the dining room
  batch.add(plates(), 11.6, 0.875, 10.48, 0, false, 'platesK'); batch.add(plates(), 11.9, 0.875, 10.48, 0, false, 'platesK');
  batch.add(riceCooker(), 11.7, 0.875, 10.98, 2, false, 'rice'); batch.add(riceCooker(), 12.15, 0.875, 10.98, 2, false, 'rice');
  batch.add(sushiCase(), 13.1, 0.875, 10.98, 2, false, 'sushi');
  batch.add(beltHatch(), 12.35, 0.875, 10.32, 2, false);
  batch.add(dishRack(), 5.5, 0.875, 13.3, 0, false, 'dishRack');
  batch.add(faucetSpray(), 5.3, 0.875, 12.3, 3, false);
  batch.add(sacks(), 15.4, 0.25, 15.3, 1);
  batch.add(radio(), 15.5, 2.125, 13.4, 1, false);

  // east wall: the Fuji mural, a hanging scroll, prints
  batch.add(mural(), 15.74, 1.35, 5.4, 1, false);
  batch.add(kakejiku(), 15.72, 3.05, 2.25, 1, false);
  for (let z = 7.9, k = 3; z < 9.6; z += 0.75, k++) batch.add(prints[k % 10](), 15.74, 2.0, z, 1, false);
  for (let z = 0.6, k = 5; z < 1.6; z += 0.7, k++) batch.add(prints[k % 10](), 15.74, 2.2, z, 1, false);
  batch.add(prints[2](), 0.26, 2.5, 9.2, 3, false);

  // ================= outside
  const S = 0.125;
  batch.add(noren(), 13.375, 2.75, -3.47, 0, false);
  batch.add(chochin(3, 'red', 1 / 16), 12.35, 1.7, -3.62, 0, false);
  batch.add(chochin(3, 'red', 1 / 16), 14.4, 1.7, -3.62, 0, false);
  batch.add(vending(), 19.2, S, -2.6, 0);
  batch.add(postbox(), 11.1, S, -5.75);
  batch.add(nobori(), 11.9, S, -5.6, 0); batch.add(nobori(), 15.0, S, -5.6, 0);

  // ================= the apartment upstairs (nobody but you comes up here)
  const F2 = 3.75;
  const home = batch.homeSeats = [];
  const KX = 8.9, KZ = 3.3; // the kotatsu, facing the TV's spot by the west wall
  batch.add(kotatsu(), KX, F2, KZ, 0);
  batch.add(akari(), KX, F2 + 1.85, KZ, 0, false);   // a paper globe over the kotatsu
  batch.add(akari(), 12.4, F2 + 1.85, 7.0, 0, false);
  for (const [x, z, rot] of [[KX, KZ - 0.95, 0], [KX, KZ + 0.95, 2], [KX + 0.95, KZ, 3]]) {
    batch.add(zabuton(), x, F2, z, 0, false);
    home.push({ x, z, y: F2 + 0.3, yaw: rot * Math.PI / 2 + Math.PI, kind: 'cushion', app: [x + (x - KX) * 0.9, z + (z - KZ) * 0.9], floorY: F2 });
  }
  batch.add(mikan(), KX - 0.2, F2 + 0.5, KZ, 0, false);
  batch.add(catalogBook(), KX + 0.35, F2 + 0.5, KZ + 0.1, 0, false); // the mail-order catalog
  batch.add(kakejiku(), 6.6, F2 + 1.75, 5.48, 0, false);              // the scroll in the tokonoma
  batch.add(pothos(), 7.1, F2 + 0.125, 5.1, 0, false);
  batch.add(bookshelf(), 15.5, F2, 2.0, 3);
  batch.add(radio(), 15.45, F2 + 1.0, 2.0, 3, false);
  batch.add(futon(), 13.6, F2, 2.95, 0, false);
  batch.add(andon(), 12.0, F2, 4.3, 0);
  batch.add(tansu(), 10.25, F2, 8.1, 0);
  batch.add(kitchenette(), 12.25, F2, 8.1, 0);
  batch.add(shoeRack(), 15.3, F2, 8.0, 3);
  batch.add(noren(), 15.85, F2 + 2.1, 7.0, 1, false);
}
