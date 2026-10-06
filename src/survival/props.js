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
// ---- wall buys, as in Black Ops: the weapon's outline drawn in chalk on the wall, glowing faintly in the dark, its
// name and price written under it. kind: 'blade' | 'pistol' | 'rifle'; len: the weapon's length in metres
export function chalk(kind, len, name, kanji, price) {
  const W = Math.max(0.95, len + 0.4), H = 0.72, ppm = 380, cw = Math.round(W * ppm), ch = Math.round(H * ppm);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,252,240,0.95)'; g.fillStyle = 'rgba(255,252,240,0.95)'; g.lineWidth = 5; g.lineJoin = g.lineCap = 'round';
  g.shadowColor = 'rgba(255,250,230,0.9)'; g.shadowBlur = 10;
  const cx = cw / 2, cy = ch * 0.4, L = len * ppm;
  const x0 = cx - L / 2, x1 = cx + L / 2;
  g.beginPath();
  if (kind === 'blade') { // a long curve of a blade, the guard, the wrapped grip
    const grip = L * 0.3, gx = x1 - grip;
    g.moveTo(x0, cy - 4); g.quadraticCurveTo((x0 + gx) / 2, cy - 22, gx, cy - 12); g.lineTo(gx, cy + 6); g.quadraticCurveTo((x0 + gx) / 2, cy - 6, x0, cy - 4);
    g.moveTo(gx + 6, cy - 4); g.ellipse(gx + 4, cy - 3, 6, 22, 0, 0, Math.PI * 2);
    g.rect(gx + 10, cy - 11, grip - 12, 16);
    for (let x = gx + 22; x < x1 - 4; x += 16) { g.moveTo(x, cy - 11); g.lineTo(x + 8, cy + 5); }
  } else if (kind === 'pistol') { // a barrel, the cylinder, a grip swept back
    g.rect(x0, cy - 12, L * 0.55, 16); g.ellipse(x0 + L * 0.62, cy - 4, L * 0.1, 18, 0, 0, Math.PI * 2);
    g.moveTo(x0 + L * 0.68, cy - 16); g.lineTo(x1, cy - 16); g.lineTo(x1 - 6, cy + 46); g.lineTo(x1 - L * 0.24, cy + 46); g.lineTo(x0 + L * 0.7, cy + 8);
  } else if (kind === 'smg') { // a submachine gun: jacketed barrel, the magazine out to the side (drawn down), a stock
    g.rect(x0, cy - 8, L * 0.42, 14); for (let x = x0 + 10; x < x0 + L * 0.4; x += 16) g.rect(x, cy - 3, 6, 4);
    g.rect(x0 + L * 0.42, cy - 13, L * 0.2, 22); g.rect(x0 + L * 0.47, cy + 9, L * 0.07, 46);
    g.moveTo(x0 + L * 0.62, cy - 6); g.lineTo(x1, cy - 2); g.lineTo(x1, cy + 30); g.lineTo(x0 + L * 0.66, cy + 12); g.closePath();
  } else if (kind === 'lmg') { // a light machine gun: finned barrel, the curved magazine on top, a long stock
    g.rect(x0, cy - 6, L * 0.25, 10); for (let x = x0 + L * 0.25; x < x0 + L * 0.48; x += 9) g.rect(x, cy - 12, 5, 22);
    g.rect(x0 + L * 0.48, cy - 13, L * 0.2, 24); g.moveTo(x0 + L * 0.52, cy - 13); g.quadraticCurveTo(x0 + L * 0.56, cy - 60, x0 + L * 0.64, cy - 64); g.lineTo(x0 + L * 0.66, cy - 13);
    g.moveTo(x0 + L * 0.68, cy - 8); g.lineTo(x1, cy - 2); g.lineTo(x1, cy + 32); g.lineTo(x0 + L * 0.72, cy + 12); g.closePath();
    g.moveTo(x0 + L * 0.18, cy + 4); g.lineTo(x0 + L * 0.12, cy + 40); g.moveTo(x0 + L * 0.2, cy + 4); g.lineTo(x0 + L * 0.26, cy + 40);
  } else { // a rifle: the long barrel, the bolt, the stock
    g.rect(x0, cy - 9, L * 0.55, 12); g.moveTo(x0 + L * 0.55, cy - 14); g.lineTo(x0 + L * 0.72, cy - 14); g.lineTo(x0 + L * 0.72, cy + 10); g.lineTo(x0 + L * 0.55, cy + 10); g.closePath();
    g.moveTo(x0 + L * 0.66, cy - 14); g.lineTo(x0 + L * 0.69, cy - 30); g.moveTo(x0 + L * 0.72, cy - 10); g.lineTo(x1, cy - 4); g.lineTo(x1, cy + 34); g.lineTo(x0 + L * 0.74, cy + 14); g.closePath();
    g.rect(x0 + L * 0.3, cy + 3, L * 0.25, 10);
  }
  g.stroke();
  g.shadowBlur = 6;
  g.textAlign = 'center';
  g.font = `600 ${Math.round(ch * 0.15)}px "Yuji Syuku", serif`; g.fillText(`${kanji}  ${name}`, cx, ch * 0.8);
  g.font = `700 ${Math.round(ch * 0.12)}px Fredoka, sans-serif`; g.fillText(price, cx, ch * 0.95);
  // chalk is never solid: rub bits of it away
  g.globalCompositeOperation = 'destination-out'; g.shadowBlur = 0;
  for (let i = 0; i < cw * ch / 60; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + hash01(i, 3, 7) * 0.6})`; g.fillRect(hash01(i, 1, 7) * cw, hash01(i, 2, 7) * ch, 2, 2); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.3, 1.25, 1.15) }));
  m.renderOrder = 3;
  return m;
}
// over a wall buy: a warm glow on the wall round the outline, and its price on a tag that turns to face you
export function buyGlow(w, h) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 32, 4, 64, 32, 64);
  grd.addColorStop(0, 'rgba(255,214,140,0.3)'); grd.addColorStop(0.6, 'rgba(255,170,80,0.1)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.renderOrder = 2;
  return m;
}
export function priceTag(name, price) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,14,10,0.78)'; g.beginPath(); g.roundRect(4, 4, 312, 88, 44); g.fill();
  g.strokeStyle = 'rgba(255,214,140,0.9)'; g.lineWidth = 4; g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#ffe6b8'; g.font = '600 30px Fredoka, sans-serif'; g.fillText(name, 160, 42);
  g.fillStyle = '#ffd070'; g.font = '700 30px Fredoka, sans-serif'; g.fillText(price, 160, 78);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(0.62, 0.186, 1); s.renderOrder = 5;
  return s;
}

// ---- the blessings' machines: a tall lacquered cabinet in the blessing's colour, a lit crest on top, a hatch the
// bottle drops into, a coin slot (the lit front panel is perkFace, laid over it)
const tone = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
export const perkMachine = (color, on = true) => keyed('perk' + color + on, () => {
  const m = new Model(14, 34, 10, 1 / 16, [7, 0, 5]);
  const body = C(tone(color, on ? 0.55 : 0.32), 0, 0.04), bodyD = C(tone(color, on ? 0.3 : 0.18), 0, 0.04), trim = C(on ? '#d8c8a0' : '#6a6458', 0, 0.03), dark = C('#101012', 0, 0.02);
  const lit = on ? C(tone(color, 1), 2.4, 0.03) : C(tone(color, 0.22), 0, 0.03), chrome = C('#c8ccd0', on ? 0.2 : 0, 0.03);
  m.box(0, 0, 0, 14, 30, 10, (x, y, z) => (x === 0 || x === 13 || z === 9 ? bodyD : y < 2 ? dark : body));
  m.box(1, 30, 1, 13, 34, 9, (x, y) => (y === 33 ? trim : lit));                 // the lit crest on top
  m.box(0, 29, 0, 14, 30, 10, trim); m.box(0, 2, 0, 14, 3, 10, trim);            // brass bands
  m.box(3, 4, 0, 11, 9, 2, dark); m.box(3, 4, 0, 11, 5, 3, chrome);              // the hatch the bottle drops into
  m.box(11, 13, 0, 12, 16, 1, chrome);                                           // the coin slot
  for (const x of [0, 13]) m.box(x, 6, 0, x + 1, 28, 1, lit);                    // a lit strip down each front edge
  return m;
});
// the machine's lit face: the blessing's kanji in a white disc, its name, its price
export function perkFace(P) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 400;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 400); grd.addColorStop(0, tone(P.color, 1.15)); grd.addColorStop(1, tone(P.color, 0.45));
  g.fillStyle = grd; g.fillRect(0, 0, 256, 400);
  g.strokeStyle = '#f8f0d8'; g.lineWidth = 8; g.strokeRect(8, 8, 240, 384);
  g.fillStyle = '#fbf6ea'; g.beginPath(); g.arc(128, 150, 86, 0, Math.PI * 2); g.fill();
  g.strokeStyle = tone(P.color, 0.6); g.lineWidth = 6; g.stroke();
  g.fillStyle = tone(P.color, 0.5); g.textAlign = 'center'; g.font = '700 118px "Yuji Syuku", serif'; g.fillText(P.kanji, 128, 192);
  g.fillStyle = '#fff8e8'; g.font = '700 34px Fredoka, sans-serif'; g.fillText(P.name.toUpperCase(), 128, 284);
  g.font = '600 24px Fredoka, sans-serif'; g.fillText(P.cost.toLocaleString('en-US'), 128, 330);
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < 400; y += 4) g.fillRect(0, y, 256, 1);  // a little scanline glow
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1.03), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) }));
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

// a column of light over a gift, so you see it from across the room, and a ring turning round its foot
export function dropBeam(color) {
  const g = new THREE.Group(), col = new THREE.Color(color);
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const x = c.getContext('2d'), grd = x.createLinearGradient(0, 64, 0, 0); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.fillRect(0, 0, 4, 64);
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  mat.opacity = 0.5;
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.08, 0.2 - i * 0.08, 4.2, 16, 1, true), mat); b.position.y = 1.2; g.add(b); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.85; g.add(ring); g.userData.ring = ring;
  return g;
}

// the power: a grey breaker cabinet on the wall, a big lever with a red grip, yellow and black stripes, 電源 on it
export const breaker = memo(() => {
  const m = new Model(12, 18, 4, 1 / 16, [6, 0, 4]);
  const grey = C('#7a7e82', 0, 0.04), greyD = C('#4a4e52', 0, 0.04), y = C('#e8b830', 0, 0.04), k = C('#141416', 0, 0.03), w = C('#f0ece0', 0, 0.03);
  m.box(0, 0, 0, 12, 18, 4, (x, yy, z) => (x === 0 || x === 11 || yy === 0 || yy === 17 ? greyD : grey));
  m.box(1, 1, 0, 11, 3, 1, (x) => ((x >> 1) & 1 ? y : k));                      // hazard stripes
  m.box(2, 13, 0, 10, 16, 1, w); m.box(3, 14, 0, 4, 15, 1, k); m.box(5, 14, 0, 7, 15, 1, k); m.box(8, 14, 0, 9, 15, 1, k); // the 電源 plate
  m.box(5, 5, 0, 7, 11, 1, k);                                                   // the lever's slot
  return m;
});
export const breakerLever = memo(() => {
  const m = new Model(2, 8, 2, 1 / 16, [1, 0, 1]);
  m.box(0, 0, 0, 2, 6, 2, C('#2a2a2e', 0, 0.03)); m.box(0, 6, 0, 2, 8, 2, C('#c8201a', 0.3, 0.04));
  return m;
});

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
  const m = new Model(10, 10, 10, 1 / 18, [5, 5, 5]);
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
