// The parts of the Tokyo street that aren't voxels: neon and lightbox signs (drawn on canvases, so they can say
// things in Japanese), the tangle of wires between the poles, the skyline all round with Tokyo Tower lit up to the
// south-west, and the trains that rumble across the overpass now and then.
import * as THREE from 'three';
import { hash01 } from '../../voxel.js';
import { TK } from './world.js';
import { Traffic } from './traffic.js';

export const TOWER = { x: -150, z: -520, h: 333 };

// ---------------------------------------------------------------- signs
function signTexture({ text, sub, color, bg, vertical, w, h }) {
  const ppm = 160, cw = Math.round(w * ppm), ch = Math.round(h * ppm);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.strokeRect(5, 5, cw - 10, ch - 10); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = bg ? 10 : 26;
  const font = (px) => `700 ${px}px "Yuji Syuku", "Hiragino Mincho ProN", "Noto Serif CJK JP", serif`;
  if (vertical) {
    const chars = [...text], size = Math.min(cw * 0.72, (ch * (sub ? 0.78 : 0.92)) / chars.length);
    g.font = font(size);
    chars.forEach((k, i) => g.fillText(k, cw / 2, size * (i + 0.6) + ch * 0.03));
    if (sub) { g.font = `600 ${Math.min(cw * 0.22, 26)}px Fredoka, sans-serif`; g.save(); g.translate(cw / 2, ch * 0.9); g.fillText(sub, 0, 0); g.restore(); }
  } else {
    const size = Math.min(ch * (sub ? 0.55 : 0.78), (cw * 0.92) / Math.max(1, [...text].length) * 1.6);
    g.font = font(size); g.fillText(text, cw / 2, ch * (sub ? 0.4 : 0.52));
    if (sub) { g.font = `600 ${ch * 0.25}px Fredoka, sans-serif`; g.fillText(sub, cw / 2, ch * 0.8); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function makeSign(s) {
  const grp = new THREE.Group(); grp.position.set(...s.pos);
  const tex = signTexture(s);
  const glow = s.glow ?? 1.6; // (a lit sign glows; a painted board, like the road works', just catches the light)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !s.bg, toneMapped: false, color: new THREE.Color(glow, glow, glow) });
  const depth = s.vertical ? 0.22 : 0.04;
  if (s.bg) { const box = new THREE.Mesh(new THREE.BoxGeometry(s.vertical ? depth : s.w, s.h, s.vertical ? s.w : depth), new THREE.MeshLambertMaterial({ color: 0x18181c })); grp.add(box); }
  for (const yaw of s.faces) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
    m.rotation.y = yaw;
    const off = depth / 2 + 0.006; m.position.set(Math.sin(yaw) * off, 0, Math.cos(yaw) * off);
    grp.add(m);
  }
  grp.userData.mat = mat; grp.userData.glow = glow;
  return grp;
}

// ---------------------------------------------------------------- wires: sagging lines between poles and buildings

// ---------------------------------------------------------------- wires: sagging lines between the poles, across the
// street, in to the buildings; and the cords the lantern strings hang from
function wires(meta) {
  const pts = [];
  const sag = (a, b, drop, n = 14) => {
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const p = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * drop, a[2] + (b[2] - a[2]) * t];
      pts.push(...p(t0), ...p(t1));
    }
  };
  const poles = meta.poles, north = poles.filter((p) => p[2] > -8).sort((a, b) => a[0] - b[0]), south = poles.filter((p) => p[2] < -8).sort((a, b) => a[0] - b[0]);
  for (const row of [north, south]) {
    for (let i = 0; i < row.length - 1; i++) for (const [dx, dy] of [[-0.6, 0], [0.6, 0], [0, -0.6], [-0.3, -1.2]]) {
      const a = row[i], b = row[i + 1];
      sag([a[0] + dx, a[1] + dy, a[2]], [b[0] + dx, b[1] + dy, b[2]], 0.6 + Math.abs(dx));
    }
    // and on past the ends of the street, to poles out of sight
    const a = row[0], b = row[row.length - 1];
    for (const [dx, dy] of [[-0.6, 0], [0.6, 0], [0, -0.6]]) { sag([a[0] + dx, a[1] + dy, a[2]], [a[0] - 40 + dx, a[1] + dy, a[2]], 1.4, 20); sag([b[0] + dx, b[1] + dy, b[2]], [b[0] + 40 + dx, b[1] + dy, b[2]], 1.4, 20); }
  }
  for (const a of north) { const b = south.reduce((q, s) => (Math.abs(s[0] - a[0]) < Math.abs(q[0] - a[0]) ? s : q)); sag([a[0], a[1] - 0.3, a[2]], [b[0], b[1] - 0.3, b[2]], 0.5); }
  for (const a of north) for (const dx of [-2.5, 2.5]) sag([a[0], a[1] - 1.2, a[2]], [a[0] + dx, a[1] - 3.0, TK.north], 0.25, 6);
  for (const a of south) for (const dx of [-2.0, 2.2]) sag([a[0], a[1] - 1.2, a[2]], [a[0] + dx, a[1] - 3.0, TK.south], 0.25, 6);
  for (const [gx, hN, hS, s] of TK.garlands) sag([gx, hN, TK.north], [gx, hS, TK.south], s, 22);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x0a0a0c }));
}

// ---------------------------------------------------------------- the city round about: textures
// lit windows, 16 x 16 to a tile (a window every ~1.9 m, a storey every 3 m)
function windowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0c12'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const h = hash01(x, y, 5);
    g.fillStyle = h < 0.4 ? '#191a22' : h > 0.93 ? '#cfe4ff' : h > 0.8 ? '#ffd6a0' : h > 0.6 ? '#ffb870' : '#5a4630';
    g.fillRect(x * 16 + 3, y * 16 + 4, 10, 8);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// shopfronts at street level: a strip of lit doorways, glass, shutters and lanterns
function shopTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 32;
  const g = c.getContext('2d');
  const looks = ['#ffe0a8', '#f4f8ff', '#ffb070', '#3a3c40', '#ffd0a0', '#c8e8ff', '#ff9a60', '#2a2a2e', '#fff0c0', '#ffc8e8'];
  for (let i = 0; i < 16; i++) {
    const x = i * 32, col = looks[Math.floor(hash01(i, 3, 9) * looks.length)];
    g.fillStyle = '#151518'; g.fillRect(x, 0, 32, 32);
    g.fillStyle = col; g.fillRect(x + 3, 6, 26, 26);
    if (col === '#3a3c40' || col === '#2a2a2e') { g.fillStyle = '#4a4c52'; for (let y = 6; y < 32; y += 3) g.fillRect(x + 3, y, 26, 1); }  // a shutter
    else { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 15, 6, 2, 26); g.fillRect(x + 3, 6, 26, 2); }
    if (hash01(i, 4, 9) < 0.45) { g.fillStyle = '#ff4a30'; g.beginPath(); g.ellipse(x + 6, 9, 3, 4, 0, 0, 7); g.ellipse(x + 26, 9, 3, 4, 0, 0, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// the road and pavements carried on: snow, two dark ruts, the edge lines, paving under trodden snow
function roadTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const zz = (z) => ((z - TK.north) / (TK.south - TK.north)) * 256; // the texture's v runs across the street
  g.fillStyle = '#8c8aa4'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) { g.fillStyle = hash01(i, 1, 4) > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(40,40,60,0.12)'; g.fillRect(hash01(i, 2, 4) * 256, hash01(i, 3, 4) * 256, 6, 4); }
  g.fillStyle = 'rgba(70,72,84,0.85)';
  for (const [a, b] of [[TK.walkN[1], TK.walkN[0]], [TK.walkS[1], TK.walkS[0]]]) for (let x = 0; x < 256; x += 8) for (let y = zz(a); y < zz(b); y += 8) if (hash01(x, y, 6) > 0.5) g.fillRect(x, y, 7, 7);
  g.fillStyle = '#9a9c9e'; for (const z of TK.road) g.fillRect(0, zz(z) - 2, 256, 4);
  g.fillStyle = '#e8e6dc'; for (const z of [TK.road[1] - 0.2, TK.road[0] + 0.2]) g.fillRect(0, zz(z) - 1, 256, 2);
  g.fillStyle = '#1e2026'; for (const z of [-7.3, -9.4]) g.fillRect(0, zz(z) - 3, 256, 6);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// boxes of buildings, merged into one mesh per material: front faces get the shopfront strip along the bottom storey
function boxes(list, winTex, shopTex) {
  const pos = [], uv = [], col = [], idx = [], spos = [], suv = [], sidx = [];
  const quad = (P, U, I, a, b, c, d, u0, v0, u1, v1, shade, C) => {
    const base = P.length / 3;
    P.push(...a, ...b, ...c, ...d); U.push(u0, v0, u1, v0, u1, v1, u0, v1);
    if (C) for (let i = 0; i < 4; i++) C.push(shade, shade, shade);
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (const { x0, x1, z0, z1, h, shade, front, u } of list) {
    const s = 1 / 30, t = 1 / 48, o = u * 0.37, g0 = front ? 3.0 : 0;
    const W = (a, b, c, d, len, sh) => quad(pos, uv, idx, a, b, c, d, o, g0 * t, o + len * s, h * t, sh, col);
    W([x0, g0, z1], [x1, g0, z1], [x1, h, z1], [x0, h, z1], x1 - x0, shade);
    W([x1, g0, z0], [x0, g0, z0], [x0, h, z0], [x1, h, z0], x1 - x0, shade);
    W([x0, g0, z0], [x0, g0, z1], [x0, h, z1], [x0, h, z0], z1 - z0, shade * 0.75);
    W([x1, g0, z1], [x1, g0, z0], [x1, h, z0], [x1, h, z1], z1 - z0, shade * 0.75);
    quad(pos, uv, idx, [x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], 0.01, 0.01, 0.02, 0.02, 0.12, col);
    if (front) { // the street-level storey: shopfronts on the street face, plain wall round the sides
      const fz = front > 0 ? z1 : z0, a = front > 0 ? [x0, 0, fz] : [x1, 0, fz], b = front > 0 ? [x1, 0, fz] : [x0, 0, fz];
      const c0 = Math.floor(hash01(u, 7, 3) * 16) / 16, n = Math.max(1, Math.round((x1 - x0) / 4));
      quad(spos, suv, sidx, a, b, [b[0], 3.0, fz], [a[0], 3.0, fz], c0, 0, c0 + n / 16, 1, 1, null);
      const back = front > 0 ? z0 : z1;
      quad(pos, uv, idx, front > 0 ? [x1, 0, back] : [x0, 0, back], front > 0 ? [x0, 0, back] : [x1, 0, back], front > 0 ? [x0, 3, back] : [x1, 3, back], front > 0 ? [x1, 3, back] : [x0, 3, back], 0.01, 0.01, 0.02, 0.02, 0.1, col);
      for (const sx of [x0, x1]) quad(pos, uv, idx, [sx, 0, sx === x0 ? z0 : z1], [sx, 0, sx === x0 ? z1 : z0], [sx, 3, sx === x0 ? z1 : z0], [sx, 3, sx === x0 ? z0 : z1], 0.01, 0.01, 0.02, 0.02, 0.1, col);
    }
  }
  const grp = new THREE.Group();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: winTex, vertexColors: true, side: THREE.DoubleSide }));
  m.frustumCulled = false; grp.add(m);
  if (sidx.length) {
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2)); sg.setIndex(sidx);
    const sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: shopTex, side: THREE.DoubleSide }));
    sm.frustumCulled = false; grp.add(sm);
  }
  return grp;
}

// ---------------------------------------------------------------- the city round about the voxel street: the street
// carried on past both ends (road, pavements, shops and signs both sides, the lamps), the viaduct running on north and
// south, the blocks behind ours and behind the far side, and the skyline beyond
function cityAround() {
  const grp = new THREE.Group();
  const winTex = windowTexture(), shopTex = shopTexture();
  const N = TK.north, S = TK.south, V = TK.viaduct;
  // the ground: snow everywhere, and the street's own surface carried on out of both ends
  const snow = new THREE.MeshLambertMaterial({ color: 0xc9cbd6 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), snow); ground.rotation.x = -Math.PI / 2; ground.position.set(10, 0.04, 0); grp.add(ground);
  const rt = roadTexture(); rt.repeat.set(1, 1);
  for (const [x0, x1] of [[-400, -16], [36, 420]]) {
    const geo = new THREE.PlaneGeometry(x1 - x0, N - S); const uvs = geo.attributes.uv;
    for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * (x1 - x0) / 8, 1 - uvs.getY(i));
    const r = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: rt })); r.rotation.x = -Math.PI / 2; r.position.set((x0 + x1) / 2, 0.126, (N + S) / 2); grp.add(r);
  }
  const list = [], signs = [], lamps = [];
  let k = 0;
  const rnd = (a) => hash01(k, a, 19);
  // frontage along the street, both sides, both ways out
  for (const [from, to, dir] of [[-16, -340, -1], [36, 360, 1]]) for (const side of [-1, 1]) {
    let x = from === -16 && side < 0 ? V.x0 : from;       // (the viaduct crosses at the west end: start beyond it)
    if (dir < 0) x = V.x0;
    let lampAt = x + dir * 9;
    while ((to - x) * dir > 0) {
      k++;
      const far = Math.abs(x - (dir < 0 ? -16 : 36));
      const w = 3.5 + rnd(1) * 6.5, h = 7 + rnd(2) ** 1.5 * (far > 60 ? 34 : 15), d = 9 + rnd(3) * 8;
      if (rnd(4) < 0.08 && far > 12) { x += dir * (6 + rnd(5) * 3); continue; }            // a side street
      const xa = x, xb = x + dir * w, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
      if (side < 0) list.push({ x0, x1, z0: N, z1: N + d, h, shade: 0.55 + rnd(6) * 0.45, front: -1, u: k });
      else list.push({ x0, x1, z0: S - d, z1: S, h, shade: 0.55 + rnd(6) * 0.45, front: 1, u: k });
      // signs: vertical ones up the corners of the near buildings, a lit board over many shopfronts
      if (far < 110 && rnd(7) < 0.75) signs.push({ x: (dir > 0 ? x0 : x1) + dir * 0.3, z: side < 0 ? N - 0.5 : S + 0.5, h, k });
      x = xb;
      if ((lampAt - x) * dir <= 0) { lamps.push([x, side < 0 ? N - 1.8 : S + 1.8]); lampAt = x + dir * (11 + rnd(8) * 4); }
    }
  }
  // the blocks behind ours and behind the far side: deeper, taller, all windows
  for (const [z0, z1] of [[18.2, 70], [-70, -16.2]]) {
    let x = -160;
    while (x < 180) {
      k++;
      const w = 6 + rnd(1) * 12;
      if (x + w > V.x0 - 0.5 && x < V.x1 + 0.5) { x = V.x1 + 0.5; continue; }        // leave the viaduct's line clear
      if (rnd(4) < 0.1) { x += 7; continue; }
      const d = 10 + rnd(3) * 14, near = z0 > 0 ? z0 : z1 - d, h = 10 + rnd(2) ** 1.4 * 32;
      list.push({ x0: x, x1: x + w, z0: z0 > 0 ? near : z1 - d, z1: z0 > 0 ? near + d : z1, h, shade: 0.5 + rnd(6) * 0.45, front: 0, u: k });
      x += w + (rnd(9) < 0.3 ? 1.5 : 0);
    }
  }
  grp.add(boxes(list, winTex, shopTex));
  // the viaduct runs on north and south: a long brick spine, the trains' line on top
  const brick = new THREE.MeshLambertMaterial({ color: 0x5a2c22 });
  for (const [z0, z1] of [[18, 520], [-520, -16]]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(V.x1 - V.x0, V.top, z1 - z0), brick); v.position.set((V.x0 + V.x1) / 2, V.top / 2, (z0 + z1) / 2); grp.add(v);
  }
  // street lamps out along the continued street: a glow on a pole
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xf0f4ff }), poleMat = new THREE.MeshLambertMaterial({ color: 0x8a8a88 });
  for (const [x, z] of lamps) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8.5, 0.25), poleMat); p.position.set(x, 4.25, z); grp.add(p);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.3), lampMat); l.position.set(x, 5.4, z + (z > -8 ? -1.25 : 1.25)); grp.add(l);
  }
  // the signs: a lit board over the shopfront and a vertical stack up the corner
  const WORDS = [['居酒屋', '#ff5a3c', '#2a0808'], ['焼肉', '#ffd24a', '#3a0a0a'], ['ラーメン', '#ff8a3c', '#2a1408'], ['薬', '#5ad0ff', '#08202a'], ['寿司', '#ff6a8a', '#2a0812'],
    ['酒', '#ffe2b0', '#2a1a0a'], ['バー', '#c58aff', '#1a0828'], ['ホテル', '#7affc8', '#08201a'], ['喫茶', '#ffb86a', '#2a1408'], ['質', '#5aff8a', '#082a10'], ['カラオケ', '#ff8ae8', '#200828'],
    ['焼鳥', '#ffb060', '#301808'], ['スナック', '#ffd060', '#401010'], ['うどん', '#fff0c0', '#203020'], ['麻雀', '#7affb0', '#0a2a1a']];
  const out = [];
  for (const { x, z, h, k: kk } of signs) {
    const [text, color, bg] = WORDS[kk % WORDS.length];
    const n = Math.min(3, Math.max(1, Math.floor((h - 3.5) / 3)));
    for (let i = 0; i < n; i++) {
      const [t2, c2, b2] = i ? WORDS[(kk * 7 + i) % WORDS.length] : [text, color, bg];
      const sh = 0.55 * [...t2].length + 0.4;
      const sg = makeSign({ text: t2, color: c2, bg: b2, vertical: true, w: 0.65, h: sh, pos: [x, 3.6 + i * 2.9 + sh / 2, z], faces: [Math.PI / 2, -Math.PI / 2] });
      grp.add(sg); out.push(sg);
    }
  }
  grp.userData.signs = out;
  return grp;
}

// the skyline beyond everything: boxes of lit windows all round, out to the horizon
function skyline(tex) {
  const list = [];
  for (let i = 0; i < 520; i++) {
    const a = hash01(i, 1, 3) * Math.PI * 2, r = 80 + hash01(i, 2, 3) ** 1.3 * 380;
    const x = 10 + Math.cos(a) * r, z = Math.sin(a) * r * 0.9;
    if (x > -190 && x < 200 && z > -80 && z < 80) continue;
    if (Math.abs(x - (TK.viaduct.x0 + TK.viaduct.x1) / 2) < 6) continue;
    const h = 20 + hash01(i, 4, 3) ** 2 * 120, w = 10 + hash01(i, 5, 3) * 20, d = 10 + hash01(i, 6, 3) * 20;
    list.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h, shade: 0.6 + hash01(i, 7, 3) * 0.45 - r / 1000, front: 0, u: i });
  }
  const g = boxes(list, tex, null);
  g.traverse((m) => { if (m.material) m.material.fog = false; });
  return g;
}
function tower() {
  const grp = new THREE.Group();
  const orange = new THREE.MeshBasicMaterial({ color: 0xff7a2a, fog: false }), white = new THREE.MeshBasicMaterial({ color: 0xfff0dc, fog: false });
  const dark = new THREE.MeshBasicMaterial({ color: 0x401808, fog: false });
  const H = TOWER.h, base = 80;
  const halfAt = (y) => (base / 2) * Math.pow(1 - y / (H * 1.02), 1.9) + 1.2;
  // four legs, each a chain of beams up the corner, cross-bracing between them
  const beam = (a, b, wdt, mat) => {
    const v = new THREE.Vector3().subVectors(b, a), len = v.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(wdt, len, wdt), mat);
    m.position.copy(a).addScaledVector(v, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    grp.add(m);
  };
  const steps = 22;
  for (let i = 0; i < steps; i++) {
    const y0 = (i / steps) * H * 0.92, y1 = ((i + 1) / steps) * H * 0.92, h0 = halfAt(y0), h1 = halfAt(y1);
    const band = i % 4 === 3 ? white : orange;
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) beam(new THREE.Vector3(sx * h0, y0, sz * h0), new THREE.Vector3(sx * h1, y1, sz * h1), 2.4, band);
    for (const [ax, az, bx, bz] of [[1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1], [1, -1, 1, 1]]) {
      beam(new THREE.Vector3(ax * h0, y0, az * h0), new THREE.Vector3(bx * h1, y1, bz * h1), 0.9, band);
      beam(new THREE.Vector3(bx * h0, y0, bz * h0), new THREE.Vector3(ax * h1, y1, az * h1), 0.9, band);
    }
  }
  for (const [y, w, h] of [[145, 30, 12], [245, 14, 8]]) { const d = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), white); d.position.y = y; grp.add(d); const s = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 1.5, w + 2), dark); s.position.y = y - h / 2; grp.add(s); }
  const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 40, 2), white); mast.position.y = H * 0.92 + 20; grp.add(mast);
  grp.position.set(TOWER.x, -6, TOWER.z);
  return grp;
}

// ---------------------------------------------------------------- the trains on the overpass

// ---------------------------------------------------------------- the handrails on the shop's stairs: smooth wooden
// rails (voxels can only make a staircase of a slope), one on each side of the flight, on brackets, a newel post at
// the foot. The flight rises toward -z from its foot at z 15.0, a quarter metre up for every three eighths along.
function stairRails() {
  const grp = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a2c16 }), dark = new THREE.MeshLambertMaterial({ color: 0x24160c });
  const nose = (z) => 0.25 + (15.375 - z) * (0.25 / 0.375), H = 0.85;
  const bar = (a, b, t, mat) => {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), len = A.distanceTo(Bv);
    const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), mat);
    m.position.copy(A).add(Bv).multiplyScalar(0.5); m.lookAt(Bv); grp.add(m);
  };
  const z0 = 15.0, z1 = 10.2;
  for (const [x, wallX] of [[0.33, 0.25], [1.17, 1.25]]) {
    bar([x, nose(z0) + H, z0], [x, nose(z1) + H, z1], 0.075, wood);
    for (let z = z0 - 0.4; z > z1 + 0.2; z -= 1.1) bar([wallX, nose(z) + H - 0.06, z], [x, nose(z) + H - 0.06, z], 0.03, dark); // brackets
    bar([x, nose(z1) + H, z1], [wallX, nose(z1) + H, z1 - 0.02], 0.075, wood);                                                // turned into the wall at the top
  }
  bar([1.17, nose(z0) + H, z0], [1.17, 0.25, z0], 0.11, wood);                                                                 // the newel post
  bar([0.33, nose(z0) + H, z0], [0.25, nose(z0) + H, z0 + 0.02], 0.075, wood);
  return grp;
}

// ---------------------------------------------------------------- the trains on the viaduct: long, lit, rumbling
function trainSide(len) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c4c9d0'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#2a9a3a'; g.fillRect(0, 44, 512, 6); g.fillStyle = '#e8eef4'; g.fillRect(0, 50, 512, 3);   // a green stripe
  const doors = [0.12, 0.37, 0.62, 0.87];
  for (let x = 6; x < 506; x += 22) {
    if (doors.some((d) => Math.abs(x / 512 - d) < 0.04)) continue;
    g.fillStyle = '#fff3dc'; g.fillRect(x, 10, 17, 24);
    g.fillStyle = 'rgba(40,30,20,0.35)'; if (hash01(x, len, 3) < 0.5) g.fillRect(x + 3, 22, 6, 12);              // someone standing
  }
  for (const d of doors) { const x = d * 512 - 10; g.fillStyle = '#9aa0a8'; g.fillRect(x, 4, 20, 56); g.fillStyle = '#fff3dc'; g.fillRect(x + 3, 10, 6, 22); g.fillRect(x + 11, 10, 6, 22); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function trainCar(len, lead) {
  const grp = new THREE.Group();
  const side = new THREE.MeshBasicMaterial({ map: trainSide(len), color: new THREE.Color(1.25, 1.25, 1.25), toneMapped: false });
  const body = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }), dark = new THREE.MeshLambertMaterial({ color: 0x1a1c20 });
  const ends = new THREE.MeshBasicMaterial({ color: 0x24262c });
  const b = new THREE.Mesh(new THREE.BoxGeometry(2.95, 3.3, len), [side, side, body, dark, ends, ends]); b.position.y = 1.65 + 0.55; grp.add(b);
  for (const z of [-len * 0.36, len * 0.36]) { const bog = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 2.6), dark); bog.position.set(0, 0.28, z); grp.add(bog); }
  // a pantograph on the roof, up to the wire
  const pmat = new THREE.MeshBasicMaterial({ color: 0x2a2c30 });
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.06), pmat); arm.position.set(0, 4.25 + 0.55, s * 0.3); arm.rotation.x = s * 0.45; grp.add(arm); }
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.12), pmat); shoe.position.set(0, 4.85 + 0.55, 0); grp.add(shoe);
  if (lead) { // headlights, and the destination board lit amber
    const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.4), toneMapped: false });
    for (const x of [-0.9, 0.9]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.05), lamp); l.position.set(x, 1.3, -len / 2 - 0.03); grp.add(l); }
    const dest = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.4, 0.3), toneMapped: false }));
    dest.position.set(0, 3.55, -len / 2 - 0.03); grp.add(dest);
  }
  return grp;
}

export function decorateTokyo(scene, { meta }) {
  const signs = meta.signs.map((s) => { const g = makeSign(s); scene.add(g); return g; });
  scene.add(wires(meta));
  scene.add(stairRails());
  const city = new THREE.Group(); const around = cityAround(); city.add(around); city.add(skyline(windowTexture())); city.add(tower());
  signs.push(...around.userData.signs);
  scene.add(city);
  // the road works' lamps, blinking in turn
  const amber = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.2), toneMapped: false });
  const blink = (meta.barriers || []).map(([x, y, z], i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), amber); m.position.set(x, y + 0.08, z); m.userData.i = i; scene.add(m); return m; });
  // a train every so often, one way or the other: ten cars, lit up, along the viaduct and over the street
  const V = TK.viaduct, CAR = 20, CARS = 10;
  const train = new THREE.Group(); const cars = [];
  for (let i = 0; i < CARS; i++) { const c = trainCar(CAR - 0.6, i === 0); c.position.z = i * CAR; train.add(c); cars.push(c); }
  train.position.set((V.x0 + V.x1) / 2, V.top + 0.1, -600); train.visible = false; scene.add(train);
  // its light spills down off the girder onto the street as it passes over
  const spill = new THREE.PointLight(0xfff0d8, 0, 22, 1.6); spill.position.set(V.x1 + 0.8, V.deck + 1.0, (TK.north + TK.south) / 2); scene.add(spill);
  let next = 8, dir = 1, clack = 0, dong = 0, speed = 15;
  // taxis and scooters along the one open lane, and the crossing out front (traffic.js)
  const traffic = new Traffic(scene);
  const span = (CARS - 1) * CAR + CAR / 2;
  return {
    // (for testing: run a train over the street now)
    traffic,
    // who's about in the street (the cars slow for them): set once the crowd is up
    setAgents(fn) { traffic.agents = fn; },
    sendTrain(z = 60, d = -1) { dir = d; train.visible = true; train.rotation.y = d < 0 ? 0 : Math.PI; train.position.z = z; next = 0; },
    update(dt, time, dawn, camera, audio) {
      traffic.update(dt, camera, audio);
      // neon flickers now and then, and fades as it gets light
      for (const g of signs) { const m = g.userData.mat, k = g.userData.glow / 1.6; const f = k < 1 ? 1 : Math.random() < 0.003 ? 0.4 : 1; m.color.setScalar((1.6 - dawn * 0.8) * k * f); }
      const on = Math.floor(time / 0.45) & 1;
      for (const m of blink) m.visible = ((m.userData.i + on) & 1) === 0;
      if (train.visible) {
        train.position.z += dir * speed * dt;
        // the lead car is at the group's origin, the rest trail behind it; turned round when running toward +z
        const zA = dir < 0 ? train.position.z - CAR / 2 : train.position.z - span, zB = dir < 0 ? train.position.z + span : train.position.z + CAR / 2;
        if ((dir > 0 && zA > 420) || (dir < 0 && zB < -420)) { train.visible = false; next = 18 + Math.random() * 24; spill.intensity = 0; }
        const over = Math.max(0, Math.min(zB, TK.north + 6) - Math.max(zA, TK.south - 6));
        spill.intensity = over > 0 ? 7 * (0.85 + Math.random() * 0.15) : 0;
        const cz = Math.max(zA, Math.min(zB, camera.position.z)), d = Math.hypot(camera.position.x - train.position.x, camera.position.y - (V.top + 2), camera.position.z - cz);
        if (audio && audio.ctx && d < 220) {
          const v = Math.min(0.8, 26 / (6 + d));
          if ((clack -= dt) <= 0) { // wheels over the rail joints: clack-clack, clack-clack
            clack = 0.22 + Math.random() * 0.08;
            const t = audio.ctx.currentTime;
            audio.burst(t, 0.1, 160 + Math.random() * 60, 0.8, v, audio.master, 'lowpass');
            audio.burst(t + 0.09, 0.08, 200 + Math.random() * 60, 0.8, v * 0.8, audio.master, 'lowpass');
            if (Math.random() < 0.6) audio.burst(t + 0.02, 0.05, 1800, 3, v * 0.22);
          }
          if (over > 0 && (dong -= dt) <= 0) { dong = 0.35; audio.burst(audio.ctx.currentTime, 0.4, 70, 0.6, v * 0.9, audio.master, 'lowpass'); } // the steel span booms
        }
      } else if ((next -= dt) <= 0) {
        dir = Math.random() < 0.5 ? 1 : -1; train.visible = true; speed = 13 + Math.random() * 5;
        train.rotation.y = dir < 0 ? 0 : Math.PI;
        train.position.z = dir < 0 ? 420 + CAR / 2 : -420 - CAR / 2;
      }
    },
  };
}

// a dummy set of shader uniforms, so the main loop can update the backdrop like the mountain's
export function cityBackdrop() {
  const g = new THREE.Group();
  const u = () => ({ uniforms: { dawn: { value: 0 }, sun: { value: new THREE.Vector3() }, haze: { value: new THREE.Color() }, time: { value: 0 } } });
  g.userData.mats = [u()];
  return g;
}
