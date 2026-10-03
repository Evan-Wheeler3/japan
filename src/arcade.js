// The retro console upstairs: a tiny 8-bit machine drawn on a 256x224 canvas. The same canvas is the
// texture on the CRT in the living room, which is where you play it, sitting on the cushion in front.
// Games are small arcade loops: Sushi Catch (comes with the console), Snow Dash, Koi Pond, Daruma Break.
import * as THREE from 'three';
import { glyphPixels, textWidth } from './voxel.js';

const W = 256, H = 224;
const COL = {
  ink: '#0e0c14', night: '#141a3a', navy: '#1e2a5a', blue: '#3a6ad0', sky: '#7ab0f0', white: '#f4f0e6', grey: '#8a8a96',
  red: '#d83a2a', pink: '#f0a0a0', orange: '#f08a3a', gold: '#f2c840', green: '#4ab04a', dgreen: '#2a6a3a', brown: '#7a4a2a', rice: '#fbf8ee',
};

// ---------------------------------------------------------------- drawing helpers
function text(g, str, x, y, col, s = 1, align = 'left') {
  str = String(str).toUpperCase();
  const w = textWidth(str) * s;
  const x0 = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
  g.fillStyle = col;
  glyphPixels(str, (c, r) => g.fillRect(x0 + c * s, y + r * s, s, s));
}
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- the games
// Each game: make() → state; step(s, dt, input); draw(g, s). A state has score and over.
const GAMES = {
  sushi: {
    name: 'Sushi Catch', hint: 'left / right · catch the sushi, dodge the wasabi',
    make: () => ({ x: 128, lives: 3, score: 0, items: [], spawn: 0.6, t: 0, flash: 0 }),
    step(s, dt, k) {
      s.t += dt; s.flash = Math.max(0, s.flash - dt);
      s.x = Math.max(18, Math.min(W - 18, s.x + ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * 170 * dt));
      if ((s.spawn -= dt) < 0) {
        s.spawn = Math.max(0.32, 1.05 - s.score / 700);
        const r = Math.random(), wasabi = Math.min(0.32, 0.12 + s.score / 3000);
        s.items.push({ x: rnd(16, W - 16), y: 30, vy: rnd(45, 65) + s.score / 12, kind: r < wasabi ? 'wasabi' : r < wasabi + 0.08 ? 'ikura' : r < wasabi + 0.35 ? 'tamago' : 'nigiri' });
      }
      for (const it of [...s.items]) {
        it.y += it.vy * dt;
        if (it.y > 190 && it.y < 204 && Math.abs(it.x - s.x) < 20) {
          s.items.splice(s.items.indexOf(it), 1);
          if (it.kind === 'wasabi') { s.lives--; s.flash = 0.4; } else s.score += it.kind === 'ikura' ? 50 : it.kind === 'tamago' ? 20 : 10;
        } else if (it.y > H) {
          s.items.splice(s.items.indexOf(it), 1);
          if (it.kind !== 'wasabi') { s.lives--; s.flash = 0.25; }
        }
      }
      if (s.lives <= 0) s.over = true;
    },
    draw(g, s) {
      rect(g, 0, 0, W, H, s.flash > 0 ? '#3a1a2a' : COL.night);
      for (let x = 0; x < W; x += 8) rect(g, x - ((s.t * 40) % 8), 22, 6, 4, COL.grey); // the belt overhead
      rect(g, 0, 26, W, 2, COL.ink);
      for (const it of s.items) {
        const x = it.x - 8, y = it.y - 5;
        if (it.kind === 'wasabi') { rect(g, x + 3, y + 2, 10, 8, COL.green); rect(g, x + 5, y, 6, 3, COL.green); rect(g, x + 5, y + 4, 2, 2, COL.dgreen); }
        else {
          rect(g, x, y + 5, 16, 6, COL.rice);
          const top = it.kind === 'tamago' ? COL.gold : it.kind === 'ikura' ? COL.red : COL.orange;
          rect(g, x - 1, y + 1, 18, 5, top);
          if (it.kind === 'nigiri') for (let i = 2; i < 16; i += 4) rect(g, x + i, y + 2, 1, 3, COL.pink);
          if (it.kind === 'tamago') rect(g, x + 6, y + 1, 3, 10, COL.ink);
          if (it.kind === 'ikura') for (let i = 1; i < 16; i += 3) rect(g, x + i, y, 2, 2, COL.orange);
        }
      }
      rect(g, s.x - 20, 200, 40, 4, COL.white); rect(g, s.x - 17, 204, 34, 3, COL.blue); // the plate
      text(g, s.score, 6, 6, COL.white);
      for (let i = 0; i < s.lives; i++) { rect(g, W - 14 - i * 14, 8, 10, 3, COL.white); rect(g, W - 13 - i * 14, 11, 8, 2, COL.blue); }
    },
  },

  dash: {
    name: 'Snow Dash', hint: 'space / up to jump · down to duck under the crows',
    make: () => ({ y: 0, vy: 0, duck: false, obs: [], speed: 95, dist: 0, spawn: 1.2, score: 0, t: 0, flakes: Array.from({ length: 40 }, () => [rnd(0, W), rnd(0, H)]) }),
    step(s, dt, k) {
      s.t += dt; s.speed = Math.min(270, s.speed + 7 * dt); s.dist += s.speed * dt; s.score = Math.floor(s.dist / 6);
      const ground = s.y <= 0;
      if (ground && (k.up || k.a)) s.vy = 270;
      s.vy -= 760 * dt; s.y = Math.max(0, s.y + s.vy * dt); if (s.y === 0) s.vy = 0;
      s.duck = k.down && ground;
      if ((s.spawn -= dt) < 0) {
        s.spawn = rnd(0.75, 1.6) * (120 / s.speed) + 0.35;
        const r = Math.random();
        s.obs.push(r < 0.4 ? { kind: 'snowman', x: W + 10, w: 14, h: 22, y: 0 } : r < 0.72 ? { kind: 'rock', x: W + 10, w: 16, h: 9, y: 0 } : { kind: 'crow', x: W + 10, w: 14, h: 8, y: 20 });
      }
      for (const o of [...s.obs]) { o.x -= s.speed * dt * (o.kind === 'crow' ? 1.25 : 1); if (o.x < -20) s.obs.splice(s.obs.indexOf(o), 1); }
      const ph = s.duck ? 11 : 20, px = 40;
      for (const o of s.obs) if (px + 10 > o.x && px < o.x + o.w && s.y < o.y + o.h && s.y + ph > o.y) s.over = true;
      for (const f of s.flakes) { f[0] -= (s.speed * 0.3 + 10) * dt; f[1] += 20 * dt; if (f[0] < 0) f[0] += W; if (f[1] > H) f[1] -= H; }
    },
    draw(g, s) {
      for (let i = 0; i < 6; i++) rect(g, 0, i * 30, W, 30, ['#0e1430', '#141c40', '#1c2650', '#26325e', '#34406c', '#46507a'][i]);
      const fx = 170 - (s.dist * 0.02) % 360; // Fuji, slowly sliding by
      for (let y = 0; y < 50; y++) { const w = 20 + y * 2.4; rect(g, fx - w / 2, 120 + y, w, 1, y < 14 ? COL.white : '#3a4a7a'); }
      rect(g, 0, 170, W, H - 170, COL.white); rect(g, 0, 170, W, 2, '#c8d4e8');
      for (const f of s.flakes) rect(g, f[0], f[1], 2, 2, COL.white);
      const gy = 170, px = 40, py = gy - s.y;
      if (s.duck) { rect(g, px, py - 11, 14, 11, COL.navy); rect(g, px + 8, py - 13, 7, 6, COL.pink); rect(g, px - 2, py - 9, 6, 3, COL.red); }
      else {
        const leg = Math.floor(s.t * 10) % 2;
        rect(g, px + 2, py - 20, 9, 14, COL.navy); rect(g, px + 2, py - 27, 9, 7, COL.pink); rect(g, px + 2, py - 29, 9, 3, COL.red);
        rect(g, px, py - 20, 13, 3, COL.red); rect(g, px + (leg ? 2 : 6), py - 6, 3, 6, COL.ink); rect(g, px + (leg ? 7 : 3), py - 6, 3, 6, COL.ink);
      }
      for (const o of s.obs) {
        const y = gy - o.y - o.h;
        if (o.kind === 'snowman') { rect(g, o.x + 1, y + 10, 12, 12, COL.white); rect(g, o.x + 3, y, 8, 10, COL.white); rect(g, o.x + 5, y + 3, 1, 1, COL.ink); rect(g, o.x + 8, y + 3, 1, 1, COL.ink); rect(g, o.x + 6, y + 5, 3, 1, COL.orange); rect(g, o.x + 3, y - 2, 8, 3, COL.red); }
        else if (o.kind === 'rock') { rect(g, o.x, y + 2, o.w, o.h - 2, COL.grey); rect(g, o.x + 2, y, o.w - 4, 3, COL.white); }
        else { const f = Math.floor(s.t * 8) % 2; rect(g, o.x, y + 3, 12, 4, COL.ink); rect(g, o.x + 3, y + (f ? 0 : 6), 6, 3, COL.ink); rect(g, o.x - 2, y + 4, 2, 2, COL.gold); }
      }
      text(g, s.score, 6, 6, COL.white);
    },
  },

  koi: {
    name: 'Koi Pond', hint: 'arrow keys · eat the pellets, don\'t hit the stones',
    make: () => {
      const s = { body: [[8, 7], [7, 7], [6, 7]], dir: [1, 0], next: [1, 0], t: 0, rate: 0.15, score: 0, pads: [], eaten: 0 };
      s.food = koiFree(s); return s;
    },
    step(s, dt, k) {
      const want = k.left ? [-1, 0] : k.right ? [1, 0] : k.up ? [0, -1] : k.down ? [0, 1] : null;
      if (want && (want[0] !== -s.dir[0] || want[1] !== -s.dir[1])) s.next = want;
      if ((s.t += dt) < s.rate) return;
      s.t = 0; s.dir = s.next;
      const head = [s.body[0][0] + s.dir[0], s.body[0][1] + s.dir[1]];
      if (head[0] < 0 || head[1] < 0 || head[0] >= 17 || head[1] >= 13 || s.body.some((b) => b[0] === head[0] && b[1] === head[1]) || s.pads.some((p) => p[0] === head[0] && p[1] === head[1])) { s.over = true; return; }
      s.body.unshift(head);
      if (head[0] === s.food[0] && head[1] === s.food[1]) {
        s.score += 10; s.eaten++; s.rate = Math.max(0.07, s.rate - 0.004);
        if (s.eaten % 4 === 0) s.pads.push(koiFree(s));
        s.food = koiFree(s);
      } else s.body.pop();
    },
    draw(g, s) {
      rect(g, 0, 0, W, H, '#0e2a3a');
      const ox = 9, oy = 30, c = 14;
      rect(g, ox - 3, oy - 3, 17 * c + 6, 13 * c + 6, '#5a5a5a');
      rect(g, ox, oy, 17 * c, 13 * c, '#1e5a7a');
      for (let i = 0; i < 30; i++) rect(g, ox + ((i * 53) % (17 * c)), oy + ((i * 37) % (13 * c)), 3, 1, '#2a6a8a');
      for (const p of s.pads) { rect(g, ox + p[0] * c + 1, oy + p[1] * c + 1, c - 2, c - 2, COL.grey); rect(g, ox + p[0] * c + 3, oy + p[1] * c + 2, c - 7, 3, '#aaaab4'); }
      rect(g, ox + s.food[0] * c + 5, oy + s.food[1] * c + 5, 4, 4, COL.gold);
      s.body.forEach((b, i) => {
        const x = ox + b[0] * c, y = oy + b[1] * c;
        rect(g, x + 1, y + 1, c - 2, c - 2, i % 3 === 1 ? COL.white : COL.orange);
        if (i === 0) { rect(g, x + 3 + (s.dir[0] > 0 ? 6 : 0), y + 3 + (s.dir[1] > 0 ? 6 : 0), 2, 2, COL.ink); }
      });
      text(g, s.score, 6, 8, COL.white);
    },
  },

  daruma: {
    name: 'Daruma Break', hint: 'left / right · space to serve · knock down every daruma',
    make: () => { const s = { px: 128, ball: null, lives: 3, score: 0, level: 1, bricks: [] }; darumaWall(s); return s; },
    step(s, dt, k) {
      s.px = Math.max(20, Math.min(W - 20, s.px + ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * 190 * dt));
      if (!s.ball) { if (k.a || k.up) s.ball = { x: s.px, y: 194, vx: rnd(-60, 60), vy: -(130 + s.level * 14) }; return; }
      const b = s.ball;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 3 || b.x > W - 3) { b.vx *= -1; b.x = Math.max(3, Math.min(W - 3, b.x)); }
      if (b.y < 26) { b.vy = Math.abs(b.vy); }
      if (b.vy > 0 && b.y > 196 && b.y < 204 && Math.abs(b.x - s.px) < 21) {
        const sp = Math.hypot(b.vx, b.vy) * 1.01, off = (b.x - s.px) / 21;
        b.vx = sp * off * 0.8; b.vy = -Math.sqrt(Math.max(1, sp * sp - b.vx * b.vx));
      }
      for (const br of s.bricks) {
        if (br.hit || b.x < br.x - 2 || b.x > br.x + 18 || b.y < br.y - 2 || b.y > br.y + 12) continue;
        br.hit = true; s.score += br.gold ? 30 : 10;
        const fromSide = Math.min(Math.abs(b.x - br.x), Math.abs(b.x - br.x - 16)) < Math.min(Math.abs(b.y - br.y), Math.abs(b.y - br.y - 10));
        if (fromSide) b.vx *= -1; else b.vy *= -1;
        break;
      }
      if (b.y > H) { s.ball = null; if (--s.lives <= 0) s.over = true; }
      if (s.bricks.every((br) => br.hit)) { s.level++; s.ball = null; darumaWall(s); }
    },
    draw(g, s) {
      rect(g, 0, 0, W, H, '#2a1418');
      for (const br of s.bricks) {
        if (br.hit) continue;
        rect(g, br.x, br.y, 16, 10, br.gold ? COL.gold : COL.red);
        rect(g, br.x + 4, br.y + 2, 8, 5, COL.white); rect(g, br.x + 5, br.y + 4, 2, 2, COL.ink); rect(g, br.x + 9, br.y + 4, 2, 2, br.eye ? COL.ink : COL.white);
      }
      rect(g, s.px - 20, 200, 40, 5, COL.brown); rect(g, s.px - 20, 200, 40, 1, COL.gold);
      const bx = s.ball ? s.ball.x : s.px, by = s.ball ? s.ball.y : 194;
      rect(g, bx - 2, by - 2, 5, 5, COL.white);
      text(g, s.score, 6, 8, COL.white); text(g, `LV ${s.level}`, W / 2, 8, COL.pink, 1, 'center');
      for (let i = 0; i < s.lives; i++) rect(g, W - 12 - i * 9, 9, 6, 6, COL.white);
      if (!s.ball) text(g, 'SPACE TO SERVE', W / 2, 150, COL.white, 1, 'center');
    },
  },
};
function koiFree(s) {
  for (;;) {
    const p = [Math.floor(Math.random() * 17), Math.floor(Math.random() * 13)];
    if (!s.body.some((b) => b[0] === p[0] && b[1] === p[1]) && !(s.pads || []).some((q) => q[0] === p[0] && q[1] === p[1]) && !(s.food && s.food[0] === p[0] && s.food[1] === p[1])) return p;
  }
}
function darumaWall(s) {
  s.bricks = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 13; c++) s.bricks.push({ x: 10 + c * 18.2, y: 36 + r * 14, gold: (r + c + s.level) % 7 === 0, eye: (r * 13 + c) % 3 === 0 });
}
export const GAME_IDS = Object.keys(GAMES);
export { GAMES };
export const gameName = (id) => GAMES[id].name;

// ---------------------------------------------------------------- the console
export class Arcade {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.magFilter = THREE.NearestFilter; this.texture.minFilter = THREE.LinearFilter;
    this.mode = 'off';        // off · tv (static, no console) · attract (console idle) · menu · play · over
    this.owned = [];          // cartridges you have
    this.hi = {};             // best scores by game
    this.onHi = null;
    this.keys = {}; this.pressed = new Set();
    this.t = 0; this.pick = 0;
    this.draw();
  }
  sfx(kind) { if (this.onSfx) this.onSfx(kind); }
  get active() { return this.mode === 'menu' || this.mode === 'play' || this.mode === 'over'; }
  // the TV in the room: on shows static (or the console's title loop); off is a dark screen
  setPower(on, hasConsole) { this.mode = on ? (hasConsole ? 'attract' : 'tv') : 'off'; this.draw(); }
  open() { this.mode = 'menu'; this.pick = Math.min(this.pick, this.owned.length - 1); this.keys = {}; }
  close() { this.mode = 'attract'; this.game = null; this.keys = {}; }
  key(code, down) {
    const map = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'a', Enter: 'a', KeyZ: 'a' };
    const k = map[code]; if (!k) return false;
    if (down && !this.keys[k]) this.pressed.add(k);
    this.keys[k] = down;
    return true;
  }
  tick(dt) {
    if (this.mode === 'off') return;
    this.t += dt;
    const tap = (k) => this.pressed.has(k);
    if (this.mode === 'menu') {
      if (tap('up')) { this.pick = (this.pick + this.owned.length - 1) % this.owned.length; this.sfx('move'); }
      if (tap('down')) { this.pick = (this.pick + 1) % this.owned.length; this.sfx('move'); }
      if (tap('a') && this.owned.length) { this.gameId = this.owned[this.pick]; this.game = GAMES[this.gameId]; this.s = this.game.make(); this.mode = 'play'; this.sfx('start'); }
    } else if (this.mode === 'play') {
      const score = this.s.score, lives = this.s.lives;
      this.game.step(this.s, Math.min(dt, 0.05), this.keys);
      if (this.s.score > score) this.sfx('point');
      if (this.s.lives < lives) this.sfx('hurt');
      if (this.s.over) {
        this.sfx('over');
        this.mode = 'over'; this.overT = 0;
        if (this.s.score > (this.hi[this.gameId] || 0)) { this.hi[this.gameId] = this.s.score; this.newHi = true; if (this.onHi) this.onHi(this.gameId, this.s.score); } else this.newHi = false;
      }
    } else if (this.mode === 'over') {
      this.overT += dt;
      if (this.overT > 0.8 && tap('a')) { this.s = this.game.make(); this.mode = 'play'; this.sfx('start'); }
      if (this.overT > 0.8 && (tap('up') || tap('down'))) this.mode = 'menu';
    }
    this.pressed.clear();
    this.draw();
  }
  draw() {
    const g = this.g;
    if (this.mode === 'off') { rect(g, 0, 0, W, H, '#050608'); rect(g, 0, 0, W, 1, '#0c0e12'); }
    else if (this.mode === 'tv') {
      // no console plugged in: static, and a channel number
      if (!this.noise) { this.noise = document.createElement('canvas'); this.noise.width = W / 4; this.noise.height = H / 4; }
      const nc = this.noise.getContext('2d'), img = nc.createImageData(W / 4, H / 4);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 180; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      nc.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = false; g.drawImage(this.noise, 0, 0, W, H);
      text(g, 'CH 3', W - 40, 12, COL.gold, 2);
    } else if (this.mode === 'attract') {
      rect(g, 0, 0, W, H, COL.night);
      for (let i = 0; i < 40; i++) rect(g, (i * 97 + this.t * 8) % W, (i * 53 + this.t * 20 * ((i % 3) + 1)) % H, 2, 2, COL.white);
      text(g, 'YOAKE', W / 2, 60, COL.red, 4, 'center');
      text(g, 'FAMI-COM', W / 2, 96, COL.gold, 2, 'center');
      if (Math.floor(this.t * 2) % 2) text(g, 'PICK UP THE CONTROLLER', W / 2, 150, COL.white, 1, 'center');
    } else if (this.mode === 'menu') {
      rect(g, 0, 0, W, H, COL.night);
      text(g, 'FAMI-COM', W / 2, 18, COL.gold, 2, 'center');
      text(g, 'CARTRIDGES', W / 2, 42, COL.grey, 1, 'center');
      this.owned.forEach((id, i) => {
        const y = 66 + i * 30, on = i === this.pick;
        if (on) rect(g, 24, y - 6, W - 48, 22, COL.navy);
        text(g, (on ? '> ' : '  ') + GAMES[id].name, 32, y, on ? COL.white : COL.grey, 1);
        text(g, `HI ${this.hi[id] || 0}`, W - 32, y, on ? COL.gold : COL.grey, 1, 'right');
      });
      text(g, 'UP/DOWN · SPACE TO PLAY', W / 2, H - 22, COL.grey, 1, 'center');
    } else {
      this.game.draw(g, this.s);
      if (this.mode === 'over') {
        rect(g, 40, 70, W - 80, 84, COL.ink);
        text(g, 'GAME OVER', W / 2, 82, COL.red, 2, 'center');
        text(g, `SCORE ${this.s.score}`, W / 2, 106, COL.white, 1, 'center');
        text(g, this.newHi ? 'NEW HIGH SCORE!' : `HI ${this.hi[this.gameId] || 0}`, W / 2, 120, this.newHi ? COL.gold : COL.grey, 1, 'center');
        if (this.overT > 0.8) text(g, 'SPACE AGAIN · UP FOR MENU', W / 2, 138, COL.grey, 1, 'center');
      }
    }
    // scanlines, so it reads as a CRT on the set and full screen alike
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
    this.texture.needsUpdate = true;
  }
  get hint() { return this.mode === 'play' || this.mode === 'over' ? this.game.hint : 'up / down to pick a game · space to play'; }
}
