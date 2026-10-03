// Voxel core: palette, grids, face-culled mesher with baked AO, prop models.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- palette
// Each entry: linear rgb, emissive intensity (0 = lit surface), jitter amount.
export const palette = [{ r: 0, g: 0, b: 0, e: 0, j: 0 }];
const palMap = new Map();
const _col = new THREE.Color();

export function C(hex, emit = 0, jitter = 0.06) {
  const key = hex + '|' + emit + '|' + jitter;
  let i = palMap.get(key);
  if (i !== undefined) return i;
  _col.set(hex);
  palette.push({ r: _col.r, g: _col.g, b: _col.b, e: emit, j: jitter });
  i = palette.length - 1;
  palMap.set(key, i);
  return i;
}

// ---------------------------------------------------------------- random
export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// deterministic hash in [-1, 1]
export function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, -2048144777);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
export const hash01 = (x, y, z) => hash3(x, y, z) * 0.5 + 0.5;

// ---------------------------------------------------------------- grid
export class Grid {
  constructor(sx, sy, sz) {
    this.sx = sx; this.sy = sy; this.sz = sz;
    this.d = new Uint16Array(sx * sy * sz);
  }
  get(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return 0;
    return this.d[(y * this.sz + z) * this.sx + x];
  }
  set(x, y, z, c) {
    x |= 0; y |= 0; z |= 0;
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return;
    this.d[(y * this.sz + z) * this.sx + x] = c;
  }
  // half-open integer box; c may be a palette index or fn(x,y,z) -> index | null (skip)
  box(x0, y0, z0, x1, y1, z1, c) {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0); z0 = Math.max(0, z0 | 0);
    x1 = Math.min(this.sx, x1 | 0); y1 = Math.min(this.sy, y1 | 0); z1 = Math.min(this.sz, z1 | 0);
    const fn = typeof c === 'function';
    for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      const v = fn ? c(x, y, z) : c;
      if (v === null || v === undefined || v < 0) continue;
      this.d[(y * this.sz + z) * this.sx + x] = v;
    }
  }
}

// ---------------------------------------------------------------- mesher
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.86 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], shade: 0.86 },
  { n: [0, 1, 0], c: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.7 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.93 },
  { n: [0, 0, -1], c: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], shade: 0.93 },
];
for (const f of FACES) {
  const [a, b, c] = f.c;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (cr[0] * f.n[0] + cr[1] * f.n[1] + cr[2] * f.n[2] < 0) f.c.reverse();
  f.ao = f.c.map((corner) => {
    const s = [];
    for (let ax = 0; ax < 3; ax++) if (f.n[ax] === 0) { const o = [0, 0, 0]; o[ax] = corner[ax] ? 1 : -1; s.push(o); }
    return [s[0], s[1], [s[0][0] + s[1][0], s[0][1] + s[1][1], s[0][2] + s[1][2]]];
  });
}
const AO = [0.42, 0.62, 0.82, 1.0];

function bucket() { return { p: [], n: [], c: [], i: [] }; }
function toGeo(B) {
  if (!B.i.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
  g.setIndex(B.i);
  g.computeBoundingSphere();
  return g;
}

// get(x,y,z) -> palette index. Emits two geometries: lit (AO-shaded) and emissive.
export function meshVoxels(get, x0, y0, z0, x1, y1, z1, scale, ox, oy, oz) {
  const L = bucket(), E = bucket();
  const ao = [1, 1, 1, 1];
  for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
    const v = get(x, y, z);
    if (!v) continue;
    const P = palette[v];
    const jit = 1 + hash3(x, y, z) * P.j;
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi];
      const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
      if (get(nx, ny, nz)) continue;
      const B = P.e ? E : L;
      const base = B.p.length / 3;
      if (!P.e) {
        for (let k = 0; k < 4; k++) {
          const s = f.ao[k];
          const a = get(nx + s[0][0], ny + s[0][1], nz + s[0][2]) ? 1 : 0;
          const b = get(nx + s[1][0], ny + s[1][1], nz + s[1][2]) ? 1 : 0;
          const c = get(nx + s[2][0], ny + s[2][1], nz + s[2][2]) ? 1 : 0;
          ao[k] = AO[a && b ? 0 : 3 - (a + b + c)];
        }
      }
      for (let k = 0; k < 4; k++) {
        const cr = f.c[k];
        B.p.push(ox + (x + cr[0]) * scale, oy + (y + cr[1]) * scale, oz + (z + cr[2]) * scale);
        B.n.push(f.n[0], f.n[1], f.n[2]);
        const m = P.e ? P.e * (1 + (jit - 1) * 0.5) : jit * ao[k] * f.shade;
        B.c.push(P.r * m, P.g * m, P.b * m);
      }
      if (P.e || ao[0] + ao[2] >= ao[1] + ao[3]) B.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else B.i.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
  }
  return { lit: toGeo(L), emit: toGeo(E) };
}

// ---------------------------------------------------------------- models (props)
export class Model {
  constructor(sx, sy, sz, scale = 1 / 16, pivot) {
    this.g = new Grid(sx, sy, sz);
    this.scale = scale;
    this.pivot = pivot || [sx / 2, 0, sz / 2];
  }
  set(x, y, z, c) { this.g.set(x, y, z, c); return this; }
  get(x, y, z) { return this.g.get(x, y, z); }
  box(x0, y0, z0, x1, y1, z1, c) { this.g.box(x0, y0, z0, x1, y1, z1, c); return this; }
  // vertical cylinder centered at (cx, cz) (voxel units, can be fractional)
  cyl(cx, cz, r, y0, y1, c, inner = -1) {
    for (let y = y0; y < y1; y++) for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = x + 0.5 - cx, dz = z + 0.5 - cz, d2 = dx * dx + dz * dz;
      if (d2 <= r * r && d2 > inner * inner * Math.sign(inner)) {
        const v = typeof c === 'function' ? c(x, y, z, Math.atan2(dz, dx)) : c;
        if (v !== null && v !== undefined && v >= 0) this.g.set(x, y, z, v);
      }
    }
    return this;
  }
  sphere(cx, cy, cz, rx, ry, rz, c) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let z = Math.floor(cz - rz - 1); z <= cz + rz + 1; z++)
        for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, dz = (z + 0.5 - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1) {
            const v = typeof c === 'function' ? c(x, y, z) : c;
            if (v !== null && v !== undefined && v >= 0) this.g.set(x, y, z, v);
          }
        }
    return this;
  }
  geo() {
    if (!this._geo) {
      const g = this.g, s = this.scale;
      this._geo = meshVoxels((x, y, z) => g.get(x, y, z), 0, 0, 0, g.sx, g.sy, g.sz, s,
        -this.pivot[0] * s, -this.pivot[1] * s, -this.pivot[2] * s);
    }
    return this._geo;
  }
  // Standalone mesh pair (for animated props)
  mesh(litMat, emitMat) {
    const grp = new THREE.Group();
    const { lit, emit } = this.geo();
    if (lit) grp.add(new THREE.Mesh(lit, litMat));
    if (emit) grp.add(new THREE.Mesh(emit, emitMat));
    return grp;
  }
  forEach(cb) {
    const g = this.g;
    for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++)
      if (g.d[(y * g.sz + z) * g.sx + x]) cb(x, y, z);
  }
}

// Merges many static prop placements into two meshes; stamps collision into the world.
const SHAPE_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
export class PropBatch {
  constructor(world) { this.world = world; this.lit = []; this.emit = []; this.tagged = {}; }
  // tag: also keep this prop's geometry under a name, so it can be outlined on its own (see shape())
  add(model, x, y, z, rot = 0, collide = true, tag = null) {
    const m = new THREE.Matrix4().makeRotationY(rot * Math.PI / 2);
    m.setPosition(x, y, z);
    const { lit, emit } = model.geo();
    if (lit) this.lit.push(lit.clone().applyMatrix4(m));
    if (emit) this.emit.push(emit.clone().applyMatrix4(m));
    if (tag) (this.tagged[tag] ||= []).push(...[lit, emit].filter(Boolean).map((g) => g.clone().applyMatrix4(m)));
    if (collide && this.world) {
      const s = model.scale, p = model.pivot, v = new THREE.Vector3();
      model.forEach((vx, vy, vz) => {
        v.set((vx + 0.5 - p[0]) * s, (vy + 0.5 - p[1]) * s, (vz + 0.5 - p[2]) * s).applyMatrix4(m);
        this.world.mark(v.x, v.y, v.z);
      });
    }
    return m;
  }
  // an invisible stand-in mesh with the exact shape of the tagged props (outline passes still see it)
  shape(tag) {
    const geos = this.tagged[tag];
    if (!geos) throw new Error(`no props tagged ${tag}`);
    return new THREE.Mesh(mergeGeometries(geos), SHAPE_MAT);
  }
  build(litMat, emitMat) {
    const grp = new THREE.Group();
    if (this.lit.length) grp.add(new THREE.Mesh(mergeGeometries(this.lit), litMat));
    if (this.emit.length) grp.add(new THREE.Mesh(mergeGeometries(this.emit), emitMat));
    this.lit.forEach((g) => g.dispose()); this.emit.forEach((g) => g.dispose());
    return grp;
  }
}

// ---------------------------------------------------------------- 5x7 pixel font
const GLYPHS = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110',
  C: '01110100011000010000100001000101110', D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001',
  I: '01110001000010000100001000010001110', J: '00111000100001000010000101001001100',
  K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001',
  O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100',
  W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110',
  2: '01110100010000100010001000100011111', 4: '00010001100101010010111110001000010',
  '-': '00000000000000011111000000000000000', '&': '01100100101010001000101011001001101',
  "'": '00100001000000000000000000000000000', '.': '00000000000000000000000000110001100',
};
export function textWidth(str) { return str.length * 6 - 1; }
// Calls put(col, row) for each lit pixel; col advances along the string, row 0 = top.
export function glyphPixels(str, put) {
  for (let i = 0; i < str.length; i++) {
    const g = GLYPHS[str[i]];
    if (!g) continue;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '1') put(i * 6 + c, r);
  }
}
