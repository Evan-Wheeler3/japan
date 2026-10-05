// The parts of the Tokyo street that aren't voxels: neon and lightbox signs (drawn on canvases, so they can say
// things in Japanese), the tangle of wires between the poles, the skyline all round with Tokyo Tower lit up to the
// south-west, and the trains that rumble across the overpass now and then.
import * as THREE from 'three';
import { hash01 } from '../../voxel.js';
import { TK } from './world.js';

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
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !s.bg, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) });
  const depth = s.vertical ? 0.22 : 0.04;
  if (s.bg) { const box = new THREE.Mesh(new THREE.BoxGeometry(s.vertical ? depth : s.w, s.h, s.vertical ? s.w : depth), new THREE.MeshLambertMaterial({ color: 0x18181c })); grp.add(box); }
  for (const yaw of s.faces) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
    m.rotation.y = yaw;
    const off = depth / 2 + 0.006; m.position.set(Math.sin(yaw) * off, 0, Math.cos(yaw) * off);
    grp.add(m);
  }
  grp.userData.mat = mat;
  return grp;
}

// ---------------------------------------------------------------- wires: sagging lines between poles and buildings
function wires(meta) {
  const pts = [];
  const sag = (a, b, drop, n = 14) => {
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const p = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * drop, a[2] + (b[2] - a[2]) * t];
      pts.push(...p(t0), ...p(t1));
    }
  };
  const poles = meta.poles, north = poles.filter((p) => p[2] > -3.5).sort((a, b) => a[0] - b[0]), south = poles.filter((p) => p[2] < -3.5).sort((a, b) => a[0] - b[0]);
  for (const row of [north, south]) for (let i = 0; i < row.length - 1; i++) for (const [dx, dy] of [[-0.6, 0], [0.6, 0], [0, -0.6], [-0.3, -1.2]]) {
    const a = row[i], b = row[i + 1];
    sag([a[0] + dx, a[1] + dy, a[2]], [b[0] + dx, b[1] + dy, b[2]], 0.6 + Math.abs(dx));
  }
  // across the street, and in to the buildings
  for (const a of north) { const b = south.reduce((q, s) => (Math.abs(s[0] - a[0]) < Math.abs(q[0] - a[0]) ? s : q)); sag([a[0], a[1] - 0.3, a[2]], [b[0], b[1] - 0.3, b[2]], 0.5); }
  for (const a of north) for (const dx of [-2.5, 2.5]) sag([a[0], a[1] - 1.2, a[2]], [a[0] + dx, a[1] - 3.5, 0.0], 0.25, 6);
  for (const a of south) for (const dx of [-2.0, 2.2]) sag([a[0], a[1] - 1.2, a[2]], [a[0] + dx, a[1] - 3.2, TK.street.z0], 0.25, 6);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x0a0a0c }));
}

// ---------------------------------------------------------------- the skyline: boxes of lit windows all round
function windowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#07080c'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const h = hash01(x, y, 5);
    if (h < 0.42) continue;
    g.fillStyle = h > 0.93 ? '#cfe4ff' : h > 0.8 ? '#ffd6a0' : h > 0.6 ? '#ffb870' : '#3a3024';
    g.fillRect(x * 16 + 3, y * 16 + 4, 10, 8);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function skyline() {
  const pos = [], uv = [], col = [], idx = [];
  const quad = (a, b, c, d, u0, v0, u1, v1, shade) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d); uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let i = 0; i < 4; i++) col.push(shade, shade, shade);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const box = (x, z, w, d, h, shade) => {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, s = 1 / 30, t = 1 / 52;
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], 0, 0, w * s, h * t, shade);
    quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], 0, 0, w * s, h * t, shade);
    quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], 0, 0, d * s, h * t, shade * 0.8);
    quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], 0, 0, d * s, h * t, shade * 0.8);
    quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], 0.01, 0.01, 0.02, 0.02, 0.05); // roofs: dark (snow, really)
  };
  let k = 0;
  for (let i = 0; i < 420; i++) {
    const a = hash01(i, 1, 3) * Math.PI * 2, r = 46 + hash01(i, 2, 3) ** 1.4 * 330;
    const x = 10 + Math.cos(a) * r, z = Math.sin(a) * r * 0.9;
    if (x > -100 && x < 120 && z > -30 && z < 32) continue;      // (the street itself runs on out that way: see streetEnds)
    const near = r < 90, h = (near ? 12 : 18) + hash01(i, 4, 3) ** 2 * (near ? 28 : 110), w = 8 + hash01(i, 5, 3) * 18, d = 8 + hash01(i, 6, 3) * 18;
    box(x, z, w, d, h, 0.65 + hash01(i, 7, 3) * 0.5 - r / 900); k++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: windowTexture(), vertexColors: true, fog: false }));
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- the street carries on past the end of the voxels,
// both ways: a snowy road, blocks either side with their windows lit, a sign or two, and a crossing far off
function streetEnds(tex) {
  const grp = new THREE.Group();
  const snow = new THREE.MeshLambertMaterial({ color: 0xc9cbd6 }), road = new THREE.MeshLambertMaterial({ color: 0x8a8c98 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), snow); ground.rotation.x = -Math.PI / 2; ground.position.set(10, 0.05, 0); grp.add(ground);
  for (const [x0, x1] of [[-300, -16], [36, 320]]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 6.4), road); r.rotation.x = -Math.PI / 2; r.position.set((x0 + x1) / 2, 0.08, -3.5); grp.add(r);
  }
  const pos = [], uv = [], col = [], idx = [];
  const quad = (a, b, c, d, u0, v0, u1, v1, shade) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d); uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let i = 0; i < 4; i++) col.push(shade, shade, shade);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const box = (x0, x1, z0, z1, h, shade, u) => {
    const s = 1 / 30, t = 1 / 52, o = u * 0.37;
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], o, 0, o + (x1 - x0) * s, h * t, shade);
    quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], o, 0, o + (x1 - x0) * s, h * t, shade);
    quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], o, 0, o + (z1 - z0) * s, h * t, shade * 0.75);
    quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], o, 0, o + (z1 - z0) * s, h * t, shade * 0.75);
    quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], 0.01, 0.01, 0.02, 0.02, 0.08);
  };
  const signs = [];
  let k = 0;
  for (const [from, to, dir] of [[-16, -230, -1], [36, 250, 1]]) {
    for (const side of [1, -1]) {
      let x = from;
      while ((to - x) * dir > 0) {
        const w = 5 + hash01(k, 1, 9) * 9, h = 7 + hash01(k, 2, 9) ** 1.6 * (Math.abs(x) > 80 ? 40 : 18);
        const xa = x, xb = x + dir * w;
        // a cross street every so often, so it doesn't run on like a corridor
        if (hash01(k, 3, 9) < 0.12) { x = xb + dir * 4; k++; continue; }
        const zf = side > 0 ? 0.6 + hash01(k, 4, 9) * 0.8 : -7.6 - hash01(k, 4, 9) * 0.8;
        box(Math.min(xa, xb), Math.max(xa, xb), side > 0 ? zf : zf - 14, side > 0 ? zf + 14 : zf, h, 0.55 + hash01(k, 5, 9) * 0.45, k);
        if (hash01(k, 6, 9) < 0.45 && Math.abs(x) < 120) signs.push([(xa + xb) / 2, Math.min(h - 1.5, 4 + hash01(k, 7, 9) * 5), side > 0 ? zf - 0.6 : zf + 0.6, k]);
        x = xb; k++;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true })));
  const WORDS = [['居酒屋', '#ff5a3c'], ['焼肉', '#ffd24a'], ['ラーメン', '#ff8a3c'], ['薬', '#5ad0ff'], ['寿司', '#ff6a8a'], ['酒', '#ffe2b0'], ['バー', '#c58aff'], ['ホテル', '#7affc8'], ['喫茶', '#ffb86a'], ['質', '#5aff8a']];
  const out = [];
  for (const [x, y, z, i] of signs) {
    const [text, color] = WORDS[i % WORDS.length];
    const sg = makeSign({ text, color, bg: '#1a0f14', vertical: true, w: 0.7, h: 0.75 * [...text].length + 0.4, pos: [x, y, z], faces: [Math.PI / 2, -Math.PI / 2] });
    grp.add(sg); out.push(sg);
  }
  grp.userData.signs = out;
  return grp;
}

// ---------------------------------------------------------------- Tokyo Tower: an orange lattice lit up, two white decks
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
function trainCar(len) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#b8bec6'; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#2a8a3a'; g.fillRect(0, 22, 256, 4);               // a green line along the side
  for (let i = 0; i < 9; i++) { g.fillStyle = '#fff1d8'; g.fillRect(8 + i * 28, 6, 20, 12); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const side = new THREE.MeshBasicMaterial({ map: t }), body = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  return new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, len), [side, side, body, body, body, body]);
}

export function decorateTokyo(scene, { meta }) {
  const signs = meta.signs.map((s) => { const g = makeSign(s); scene.add(g); return g; });
  scene.add(wires(meta));
  const city = new THREE.Group(); const sky = skyline(); city.add(sky); city.add(tower());
  const ends = streetEnds(sky.material.map); city.add(ends); signs.push(...ends.userData.signs);
  scene.add(city);
  // a train every so often, one way or the other
  const train = new THREE.Group(); const cars = [];
  for (let i = 0; i < 6; i++) { const c = trainCar(19.5); c.position.z = i * 20; train.add(c); cars.push(c); }
  const O = TK.overpass;
  train.position.set((O.x0 + O.x1) / 2, O.deck + 0.75 + 1.75, -400); train.visible = false; scene.add(train);
  let next = 12, dir = 1, clack = 0;
  return {
    update(dt, time, dawn, camera, audio) {
      // neon flickers now and then, and fades as it gets light
      for (const g of signs) { const m = g.userData.mat; const f = Math.random() < 0.004 ? 0.4 : 1; m.color.setScalar((1.6 - dawn * 0.8) * f); }
      if (train.visible) {
        train.position.z += dir * 17 * dt;
        if (Math.abs(train.position.z) > 260) { train.visible = false; next = 25 + Math.random() * 35; }
        // the rumble and the clack of the wheels, louder as it passes over
        const d = Math.hypot(camera.position.x - train.position.x, camera.position.z - (train.position.z + 50 * dir * -1));
        if (audio && audio.ctx && (clack -= dt) <= 0 && d < 140) {
          clack = 0.16 + Math.random() * 0.05;
          const v = Math.min(0.6, 18 / (8 + d));
          audio.burst(audio.ctx.currentTime, 0.12, 180 + Math.random() * 80, 0.9, v, audio.master, 'lowpass');
          if (Math.random() < 0.5) audio.burst(audio.ctx.currentTime + 0.05, 0.05, 1600, 3, v * 0.25);
        }
      } else if ((next -= dt) <= 0) {
        dir = Math.random() < 0.5 ? 1 : -1; train.visible = true;
        train.position.z = -dir * 250 - (dir > 0 ? 120 : 0);
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
