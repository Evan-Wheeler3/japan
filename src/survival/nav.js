// Where the yōkai can walk: a grid of standing spots over the whole lot, two levels deep (the ground, and the
// flat upstairs with the outdoor stair between), read straight off the voxel world. Doorways you haven't paid for
// are gates, shut until bought; boarded windows are one-way portals that only yōkai use, climbing in once the
// boards are torn away. Every few frames a flow field spreads out from the player: each spot knows how far it is
// from you, and a yōkai simply walks downhill.
const STEP = 0.2, STEP_SNOW = 0.33; // highest step between neighbouring spots (snow drifts are rougher going)

export class WalkGrid {
  constructor(world, { x0 = -11.5, x1 = 33.5, z0 = -10.5, z1 = 17.5, cell = 0.25, top = 4.3, indoor = () => false } = {}) {
    Object.assign(this, { world, x0, z0, cell, top, indoor });
    this.w = Math.ceil((x1 - x0) / cell); this.h = Math.ceil((z1 - z0) / cell);
    this.cols = this.w * this.h;
    this.N = this.cols * 2;
    this.y = new Float32Array(this.N).fill(NaN);   // standing height of each spot (NaN: none)
    this.gateOf = new Int16Array(this.N).fill(-1);
    this.nb = new Int32Array(this.N * 8).fill(-1); // neighbours
    this.dist = new Float64Array(this.N).fill(Infinity);
    this.gates = []; this.portals = []; this.portalsTo = new Map(); this.portalsFrom = new Map();
    this.build();
  }
  // ------------------------------------------------------------------ building
  // standing heights in one column, lowest first: a floor with head room above it
  floors(cx, cz) {
    const W = this.world, out = [];
    const VS = 0.125, OY = -0.25;
    let iy = Math.floor((this.top - OY) / VS);
    let above = W.solid(cx, OY + (iy + 0.5) * VS, cz);
    for (iy--; iy >= 0; iy--) {
      const yc = OY + (iy + 0.5) * VS, s = W.solid(cx, yc, cz);
      if (s && !above) {
        const h = OY + (iy + 1) * VS;
        if (this.clear(cx, h, cz)) out.unshift(h);
      }
      above = s;
    }
    return out.slice(0, 2);
  }
  clear(cx, h, cz) {
    const W = this.world, r = 0.17;
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) for (const y of [0.3, 0.75, 1.2, 1.62])
      if (W.solid(cx + dx, h + y, cz + dz)) return false;
    return true;
  }
  build() {
    const { w, h, cols } = this;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const [cx, cz] = this.colCenter(j * w + i), fl = this.floors(cx, cz);
      fl.forEach((y, l) => { this.y[l * cols + j * w + i] = y; });
    }
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let n = 0; n < this.N; n++) {
      if (Number.isNaN(this.y[n])) continue;
      const c = n % cols, i = c % w, j = Math.floor(c / w), y = this.y[n];
      D.forEach(([di, dj], k) => {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) return;
        const m = this.match(nj * w + ni, y, this.step(c, nj * w + ni));
        if (m < 0) return;
        if (di && dj && (this.match(j * w + ni, y, 0.26) < 0 || this.match(nj * w + i, y, 0.26) < 0)) return; // no cutting corners
        this.nb[n * 8 + k] = m;
      });
    }
  }
  step(ca, cb) {
    const [ax, az] = this.colCenter(ca), [bx, bz] = this.colCenter(cb);
    return this.indoor(ax, az) || this.indoor(bx, bz) ? STEP : STEP_SNOW;
  }
  // the spot in column c standing nearest height y (within tol), or -1
  match(c, y, tol) {
    let best = -1, bd = tol + 1e-6;
    for (let l = 0; l < 2; l++) { const n = l * this.cols + c, d = Math.abs(this.y[n] - y); if (d <= bd) { bd = d; best = n; } }
    return best;
  }
  colCenter(c) { return [this.x0 + ((c % this.w) + 0.5) * this.cell, this.z0 + (Math.floor(c / this.w) + 0.5) * this.cell]; }
  pos(n) { const [x, z] = this.colCenter(n % this.cols); return [x, this.y[n], z]; }
  col(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i;
  }
  // the spot under (x, y, z): in this column if there is one near that height, else the nearest one round about
  node(x, y, z, tol = 0.9) {
    const c = this.col(x, z);
    if (c >= 0) { const n = this.match(c, y, tol); if (n >= 0 && this.passable(n)) return n; }
    let best = -1, bd = Infinity;
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
      const cc = this.col(x + di * this.cell, z + dj * this.cell); if (cc < 0) continue;
      const n = this.match(cc, y, tol); if (n < 0 || !this.passable(n)) continue;
      const [px, , pz] = this.pos(n), d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  // ------------------------------------------------------------------ gates and portals
  // a doorway that's shut until you pay: every spot inside the box (and the height range) is off limits
  addGate([x0, x1, z0, z1], y0 = -1, y1 = 2, data = {}) {
    const g = { box: [x0, x1, z0, z1], y0, y1, open: false, ...data }, gi = this.gates.length;
    this.gates.push(g);
    for (let n = 0; n < this.N; n++) {
      if (Number.isNaN(this.y[n])) continue;
      const [x, y, z] = this.pos(n);
      if (x > x0 && x < x1 && z > z0 && z < z1 && y >= y0 && y <= y1) this.gateOf[n] = gi;
    }
    return g;
  }
  passable(n) { const g = this.gateOf[n]; return !Number.isNaN(this.y[n]) && (g < 0 || this.gates[g].open); }
  // a one-way way in (a boarded window, a trapdoor): from the spot by `ext` to the spot by `int`
  addPortal(ext, int, data = {}) {
    const a = this.node(...ext), b = this.node(...int);
    const p = { ext, int, a, b, cost: Math.hypot(ext[0] - int[0], ext[2] - int[2]) + 1.5, ...data };
    this.portals.push(p);
    if (a >= 0 && b >= 0) {
      if (!this.portalsTo.has(b)) this.portalsTo.set(b, []); this.portalsTo.get(b).push(p);
      if (!this.portalsFrom.has(a)) this.portalsFrom.set(a, []); this.portalsFrom.get(a).push(p);
    }
    return p;
  }
  // ------------------------------------------------------------------ the flow field
  // how far every spot is from `goal` (walking, or climbing in through a window on the way)
  flow(goal) {
    const dist = this.dist; dist.fill(Infinity);
    if (goal < 0) return;
    const heap = new Heap();
    dist[goal] = 0; heap.push(goal, 0);
    const c = this.cell, cd = c * Math.SQRT2;
    while (heap.size) {
      const [n, d] = heap.pop();
      if (d > dist[n]) continue;
      for (let k = 0; k < 8; k++) {
        const m = this.nb[n * 8 + k];
        if (m < 0 || !this.passable(m)) continue;
        const nd = d + (k < 4 ? c : cd);
        if (nd < dist[m]) { dist[m] = nd; heap.push(m, nd); }
      }
      const ins = this.portalsTo.get(n);
      if (ins) for (const p of ins) {
        if (p.closed || !this.passable(p.a)) continue;
        const nd = d + p.cost;
        if (nd < dist[p.a]) { dist[p.a] = nd; heap.push(p.a, nd); }
      }
    }
  }
  // the best next step from spot n: a neighbour, or a portal
  downhill(n) {
    let best = null, bd = this.dist[n];
    for (let k = 0; k < 8; k++) {
      const m = this.nb[n * 8 + k];
      if (m >= 0 && this.passable(m) && this.dist[m] < bd) { bd = this.dist[m]; best = m; }
    }
    const outs = this.portalsFrom.get(n);
    if (outs) for (const p of outs) if (!p.closed && this.dist[p.b] + p.cost < bd + 1e-3 && this.dist[p.b] + p.cost <= this.dist[n] + 1e-3) return { portal: p };
    return best === null ? null : { node: best };
  }
  // can you walk straight from (ax, ay, az) to (bx, bz) without leaving solid, open ground?
  straight(ax, ay, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az), steps = Math.ceil(len / 0.12);
    let y = ay;
    for (let s = 1; s <= steps; s++) {
      const x = ax + (bx - ax) * s / steps, z = az + (bz - az) * s / steps, c = this.col(x, z);
      if (c < 0) return false;
      const n = this.match(c, y, 0.3);
      if (n < 0 || !this.passable(n)) return false;
      // keep a body's width off the walls
      for (const [dx, dz] of [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]]) {
        const c2 = this.col(x + dx, z + dz); if (c2 < 0 || this.match(c2, y, 0.3) < 0) return false;
      }
      y = this.y[n];
    }
    return true;
  }
  // the standing height under (x, z) nearest y
  heightAt(x, y, z) { const c = this.col(x, z); if (c < 0) return y; const n = this.match(c, y, 0.6); return n < 0 ? y : this.y[n]; }
}

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (v[p] <= v[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v, top = [k[0], v[0]], lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < k.length && v[l] < v[m]) m = l; if (r < k.length && v[r] < v[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    return top;
  }
}
