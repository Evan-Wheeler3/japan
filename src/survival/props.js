// Things the night parade puts in the shop: planks over the windows, doorways sealed with ofuda talismans and a
// straw rope, weapon racks with paper price tags, the omikuji box, dishes to throw, and the gifts the dead drop.
import * as THREE from 'three';
import { Model, C, hash01 } from '../voxel.js';

const memo = (f) => { let v; return () => v || (v = f()); };
const cache = new Map();
const keyed = (k, f) => cache.get(k) || cache.set(k, f()).get(k);

const WOODS = [C('#7a5a3a', 0, 0.1), C('#6a4a2e', 0, 0.1), C('#8a6a48', 0, 0.1), C('#5e4430', 0, 0.1)];
const nail = C('#3a3a3e', 0, 0.03);
// a rough plank `len` metres long (along x), 0.14 tall, 3 cm thick
export const plank = (len) => keyed('plank' + Math.round(len * 16), () => {
  const n = Math.max(4, Math.round(len * 16)), m = new Model(n, 2, 1, 1 / 16, [n / 2, 1, 0.5]);
  const seed = n * 7;
  m.box(0, 0, 0, n, 2, 1, (x, y) => WOODS[(Math.floor(hash01(x >> 2, y, seed) * 4) + (x % 9 === 0 ? 1 : 0)) % 4]);
  m.set(1, 1, 0, nail); m.set(n - 2, 0, 0, nail);
  return m;
});

// an ofuda: a strip of white paper with a red seal and lines of black brush-writing
const paper = C('#f2ece0', 0, 0.03), ink = C('#141010', 0, 0.02), cinnabar = C('#c8201a', 0, 0.04);
export const ofuda = memo(() => {
  const m = new Model(5, 16, 1, 1 / 40, [2.5, 8, 0.5]);
  m.box(0, 0, 0, 5, 16, 1, paper);
  for (let y = 3; y < 13; y++) if (hash01(2, y, 9) > 0.25) m.set(2, y, 0, ink);
  m.box(1, 12, 0, 4, 15, 1, cinnabar); m.set(2, 13, 0, paper);
  m.set(1, 5, 0, ink); m.set(3, 8, 0, ink);
  return m;
});
// shimenawa: a twisted straw rope with zig-zag paper shide hanging from it
const straw = C('#c8a860', 0, 0.08), strawD = C('#9a7e40', 0, 0.08);
export const shimenawa = (len) => keyed('rope' + Math.round(len * 16), () => {
  const n = Math.round(len * 16), m = new Model(n, 8, 2, 1 / 16, [n / 2, 7, 1]);
  for (let x = 0; x < n; x++) { m.set(x, 7, 0, (x & 2) ? straw : strawD); m.set(x, 6, 1, (x & 2) ? strawD : straw); }
  for (let x = 3; x < n - 2; x += Math.max(4, Math.floor(n / 4))) for (let i = 0; i < 5; i++) m.set(x + (i & 1), 5 - i, 0, paper);
  return m;
});

// a wall rack: a dark board with two pegs (the weapon rests on them)
export const rack = memo(() => {
  const m = new Model(16, 5, 1, 1 / 16, [8, 2.5, 0.5]);
  m.box(0, 0, 0, 16, 5, 1, (x, y) => (x === 0 || x === 15 || y === 0 || y === 4 ? C('#2a1a10', 0, 0.04) : C('#4a2e1a', 0, 0.06)));
  return m;
});
// a paper tag with a price, drawn on a canvas
export function tag(text, sub = '') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#c8201a'; g.lineWidth = 6; g.strokeRect(8, 8, 240, 112);
  g.fillStyle = '#1a1010'; g.textAlign = 'center';
  g.font = '600 46px "Yuji Syuku", serif'; g.fillText(text, 128, sub ? 62 : 80);
  if (sub) { g.font = '600 32px Fredoka, sans-serif'; g.fillStyle = '#8a1a14'; g.fillText(sub, 128, 104); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshLambertMaterial({ map: tex, emissive: 0x241810, emissiveMap: tex }));
  return m;
}
// a glowing talisman that floats over a perk: its kanji, a soft halo
export function perkSign(kanji, color = '#ff5a3a') {
  const c = document.createElement('canvas'); c.width = 128; c.height = 192;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 96, 10, 64, 96, 90); grd.addColorStop(0, color + 'aa'); grd.addColorStop(1, color + '00');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 192);
  g.fillStyle = '#f6efe0'; g.fillRect(34, 24, 60, 144);
  g.strokeStyle = '#c8201a'; g.lineWidth = 4; g.strokeRect(38, 28, 52, 136);
  g.fillStyle = '#1a0a08'; g.font = '700 46px "Yuji Syuku", serif'; g.textAlign = 'center'; g.fillText(kanji, 64, 108);
  g.fillStyle = '#c8201a'; g.fillRect(52, 132, 24, 22);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.42, 0.63, 1);
  return s;
}
// a soft glow behind a floating gift
export function halo(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(0.9, 0.9, 1);
  return s;
}

// the omikuji box: a hexagonal wooden box of fortune sticks on a red-lacquered stand, a paper sign
export const omikuji = memo(() => {
  const m = new Model(14, 30, 14, 1 / 24, [7, 0, 7]);
  const lac = C('#8a1a14', 0, 0.05), lacD = C('#5a0e0a', 0, 0.05), wood = C('#b88a52', 0, 0.06), woodD = C('#6a4a2a', 0, 0.06), gold = C('#d8b050', 0, 0.04);
  for (const [x, z] of [[1, 1], [12, 1], [1, 12], [12, 12]]) m.box(x, 0, z, x + 1, 14, z + 1, lacD);
  m.box(0, 14, 0, 14, 16, 14, lac); m.box(0, 5, 0, 14, 6, 14, (x, y, z) => (x === 0 || x === 13 || z === 0 || z === 13 ? lacD : null));
  m.cyl(7, 7, 4.2, 16, 28, (x, y, z, a) => ((Math.round(a / (Math.PI / 3)) & 1) ? wood : woodD));
  m.cyl(7, 7, 4.2, 28, 29, woodD); m.box(6, 29, 6, 8, 30, 8, C('#2a1a10', 0, 0.04));
  m.box(4, 19, 2, 10, 26, 3, paper); m.box(5, 20, 2, 9, 25, 3, (x, y) => ((x + y) % 3 === 0 ? ink : paper)); m.box(4, 18, 2, 10, 19, 3, gold);
  return m;
});
// a fortune stick
export const stick = memo(() => { const m = new Model(1, 14, 1, 1 / 32, [0.5, 0, 0.5]); m.box(0, 0, 0, 1, 14, 1, C('#d8b880', 0, 0.05)); m.set(0, 13, 0, cinnabar); return m; });

// a little pile of dishes on a table
export const dishPile = (n) => keyed('pile' + n, () => {
  const m = new Model(12, 8, 8, 1 / 32, [6, 0, 4]);
  const white = C('#f2eee4', 0, 0.03), blue = C('#2a4a8a', 0, 0.04), brown = C('#8a5a3a', 0, 0.06);
  if (n > 0) { m.box(1, 0, 1, 7, 1, 7, white); m.box(1, 1, 1, 7, 2, 7, (x, y, z) => (x === 1 || x === 6 || z === 1 || z === 6 ? blue : white)); }
  if (n > 1) m.box(8, 0, 2, 11, 3, 5, brown);
  if (n > 2) { m.box(3, 2, 3, 6, 6, 6, white); m.box(4, 6, 4, 5, 8, 5, white); m.box(3, 3, 3, 6, 4, 6, blue); }
  return m;
});

// ---- the gifts the dead leave behind
export const DROPS = {
  double: { name: 'Maneki-neko', text: 'double points', color: 'rgba(255,214,90,0.9)' },
  insta: { name: 'Hannya mask', text: 'one blow kills', color: 'rgba(255,60,40,0.9)' },
  nuke: { name: 'The great drum', text: 'clears the night', color: 'rgba(255,140,60,0.9)' },
  carpenter: { name: "Carpenter's hammer", text: 'every window boarded', color: 'rgba(160,220,255,0.9)' },
  ammo: { name: 'Ammunition', text: 'full ammo and dishes', color: 'rgba(170,255,150,0.9)' },
};
export const dropModel = (kind) => keyed('drop' + kind, () => {
  const m = new Model(10, 10, 10, 1 / 28, [5, 5, 5]);
  const white = C('#f4f0e8', 0.25, 0.03), red = C('#d8281a', 0.3, 0.04), gold = C('#f0c040', 0.4, 0.03), black = C('#141010', 0, 0.02);
  if (kind === 'double') { // a beckoning cat
    m.box(2, 0, 3, 8, 6, 7, white); m.box(2, 6, 3, 8, 10, 7, white); m.set(3, 10 - 1, 3, white);
    m.box(2, 5, 2, 8, 6, 3, red); m.set(5, 4, 2, gold); m.set(3, 8, 2, black); m.set(6, 8, 2, black);
    m.box(8, 6, 4, 10, 10, 6, white); m.box(2, 9, 4, 3, 10, 5, red); m.box(7, 9, 4, 8, 10, 5, red);
  } else if (kind === 'insta') { // a hannya mask
    const face = C('#c8281a', 0.35, 0.04);
    m.box(1, 1, 4, 9, 9, 6, face); m.box(1, 8, 4, 2, 10, 5, gold); m.box(8, 8, 4, 9, 10, 5, gold);
    m.set(3, 6, 3, gold); m.set(6, 6, 3, gold); m.box(2, 2, 3, 8, 3, 4, white); m.box(3, 1, 3, 7, 2, 4, black);
  } else if (kind === 'nuke') { // a taiko drum
    m.cyl(5, 5, 4.5, 1, 9, (x, y, z, a) => (y === 1 || y === 8 ? C('#e8dcc0', 0.25, 0.03) : (Math.round(a * 3) & 1 ? red : C('#9a1a10', 0.3, 0.04))));
    m.cyl(5, 5, 4.5, 0, 1, gold); m.cyl(5, 5, 4.5, 9, 10, gold);
  } else if (kind === 'carpenter') { // a wooden mallet
    m.box(1, 6, 3, 9, 10, 7, C('#b8885a', 0.25, 0.06)); m.box(4, 0, 4, 6, 6, 6, C('#7a5232', 0.2, 0.06));
  } else { // a crate of cartridges
    m.box(1, 1, 1, 9, 7, 9, C('#6a7a3a', 0.25, 0.06)); m.box(1, 7, 1, 9, 8, 9, C('#4a5a2a', 0.25, 0.06)); m.box(3, 3, 0, 7, 5, 1, gold);
  }
  return m;
});
