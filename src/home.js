// Life between nights: the save file, the mail-order catalog you read at the kotatsu, and everything
// it sells: new dishes and upgrades for the shop, and things to make the apartment upstairs your own.
import * as THREE from 'three';
import { Model, C, PropBatch, hash01 } from './voxel.js';
import { heater, zabuton } from './props.js';

// ---------------------------------------------------------------- the save file
const KEY = 'yoake.save';
const fresh = () => ({ v: 1, night: 1, yen: 0, owned: [] });
export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return { ...fresh(), ...s, owned: Array.isArray(s.owned) ? s.owned : [] };
  } catch {}
  return fresh();
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
export function clearSave() { try { localStorage.removeItem(KEY); } catch {} }

// ---------------------------------------------------------------- the catalog
export const CATALOG = [
  { id: 'onigiri', kind: 'shop', name: 'Onigiri', price: 1500, text: 'Rice balls with salmon and nori, pressed at the rice cookers. Quick to make, cheap to buy.' },
  { id: 'tempura', kind: 'shop', name: 'Tempura', price: 3500, text: 'Shrimp and vegetables in a light batter, fried at the fryers in the kitchen.' },
  { id: 'ramen', kind: 'shop', name: 'Miso ramen', price: 6000, text: 'Bowls of ramen simmered on the stove. Slow to make; everyone wants one.' },
  { id: 'beltMotor', kind: 'shop', name: 'A stronger belt motor', price: 3000, text: 'The sushi belt runs half again as fast.' },
  { id: 'binchotan', kind: 'shop', name: 'Binchotan charcoal', price: 2500, text: 'White oak charcoal burns hotter: yakitori and gyoza cook 30% faster.' },
  { id: 'dishes', kind: 'shop', name: 'More cups and plates', price: 2000, text: 'Four more of each on the shelves every night.' },
  { id: 'heaters', kind: 'shop', name: 'Kerosene heaters', price: 4000, text: 'Two more heaters in the dining room. Warm guests wait 25% longer.' },
  { id: 'beltMotor2', kind: 'shop', needs: 'beltMotor', name: 'An industrial belt motor', price: 6000, text: 'The belt runs at twice its old speed.' },
  { id: 'binchotan2', kind: 'shop', needs: 'binchotan', name: "A grill master's konro", price: 5500, text: 'Yakitori and gyoza cook in half the time.' },
  { id: 'dishes2', kind: 'shop', needs: 'dishes', name: 'A full set of tableware', price: 4000, text: 'Another four cups and plates: fourteen of each.' },
  { id: 'heaters2', kind: 'shop', needs: 'heaters', name: 'Hot towels at every seat', price: 7000, text: 'Guests wait half again as long before giving up.' },
  { id: 'lanterns', kind: 'home', name: 'A string of paper lanterns', price: 600, text: 'Little lanterns along the living room walls.' },
  { id: 'plants', kind: 'home', name: 'Houseplants', price: 700, text: 'A monstera and a fern, for the corners.' },
  { id: 'bonsai', kind: 'home', name: 'Bonsai pine', price: 900, text: 'On a stand by the window. Older than the shop.' },
  { id: 'print', kind: 'home', name: 'A big woodblock print', price: 1100, text: 'The great wave, framed, for the bedroom wall.' },
  { id: 'catbed', kind: 'home', name: 'A cat bed', price: 1200, text: 'A little black cat moves in upstairs.' },
  { id: 'fishtank', kind: 'home', name: 'A goldfish tank', price: 1500, text: 'Two fat goldfish and a glowing tank.' },
  { id: 'record', kind: 'home', name: 'A record player', price: 2000, text: 'Koto records to play upstairs.' },
  { id: 'telescope', kind: 'home', name: 'A brass telescope', price: 2500, text: 'At the front window. Look at Fuji up close.' },
  { id: 'irori', kind: 'home', name: 'An irori hearth', price: 5000, text: 'A sunken fire pit with a kettle on a hook. Sit by the embers.' },
  { id: 'crt', kind: 'home', name: 'A CRT television', price: 1800, text: 'A chunky old set for the living room, facing the kotatsu.' },
  { id: 'famicom', kind: 'home', needs: 'crt', name: 'A Fami-Com console', price: 2500, text: 'Two red controllers, and Sushi Catch in the slot.' },
  { id: 'game_dash', kind: 'games', needs: 'famicom', game: 'dash', name: 'Snow Dash', price: 600, text: 'Run through the snow, jump the snowmen, duck the crows.' },
  { id: 'game_koi', kind: 'games', needs: 'famicom', game: 'koi', name: 'Koi Pond', price: 700, text: 'A koi grows longer with every pellet. Mind the stones.' },
  { id: 'game_daruma', kind: 'games', needs: 'famicom', game: 'daruma', name: 'Daruma Break', price: 900, text: 'Bounce a ball and knock down every daruma on the shelf.' },
];
// the cartridges you own (Sushi Catch comes with the console)
export const ownedGames = (owned) => (owned.includes('famicom') ? ['sushi', ...CATALOG.filter((c) => c.game && owned.includes(c.id)).map((c) => c.game)] : []);
export const itemById = (id) => CATALOG.find((c) => c.id === id);

// what the shop upgrades do, applied to the service (and the belt) every time ownership changes
export function applyUpgrades(service, owned) {
  const has = (id) => owned.includes(id);
  service.menuKinds = new Set(['tea', 'sushi', 'yakitori', 'gyoza', ...['onigiri', 'tempura', 'ramen'].filter(has)]);
  service.stockMax = 6 + (has('dishes') ? 4 : 0) + (has('dishes2') ? 4 : 0);
  service.patienceBonus = has('heaters2') ? 1.5 : has('heaters') ? 1.25 : 1;
  service.belt.speed = has('beltMotor2') ? 0.84 : has('beltMotor') ? 0.63 : 0.42;
  const grill = has('binchotan2') ? 0.5 : has('binchotan') ? 0.7 : 1;
  for (const st of service.stations) st.cook = st.baseCook * (st.kind === 'yakitori' || st.kind === 'gyoza' ? grill : 1);
}

// ---------------------------------------------------------------- models for the apartment
const F2 = 3.75;
const wood = C('#5a3a20', 0, 0.06), woodD = C('#2e1a0e', 0, 0.05), black = C('#141416', 0, 0.04);
const bonsai = () => {
  const m = new Model(14, 18, 10, 1 / 32);
  m.box(0, 0, 0, 14, 6, 10, (x, y, z) => (y === 5 || x === 0 || x === 13 || z === 0 || z === 9 ? wood : null)); // stand
  m.box(3, 6, 2, 11, 9, 8, C('#2a3a5a', 0, 0.04)); m.box(4, 9, 3, 10, 10, 7, C('#3a2a1e', 0, 0.06));
  const trunk = C('#4a3020', 0, 0.06), lv = [C('#2e5a2a', 0, 0.1), C('#3e6e34', 0, 0.1)];
  for (let y = 10; y < 15; y++) m.set(6 + ((y - 10) >> 1), y, 5, trunk);
  for (const [cx, cy, cz, r] of [[4.5, 14, 5, 3], [10, 16, 5, 2.6], [8, 13, 4, 2]]) m.sphere(cx, cy, cz, r, 1.4, r * 0.8, (x, y, z) => lv[(x + y + z) & 1]);
  return m;
};
const fishtank = () => {
  const m = new Model(12, 15, 6, 1 / 16);
  m.box(0, 0, 0, 12, 7, 6, (x, y, z) => (y === 6 || x === 0 || x === 11 ? wood : (z === 0 && y > 1 && y < 5 && x % 4 !== 0 ? woodD : null)));
  const water = (x, y, z) => (hash01(x, y, z) > 0.92 ? C('#e8f4ff', 1.2, 0.05) : C('#3a8ac8', 0.75, 0.08));
  m.box(0, 7, 0, 12, 14, 6, (x, y, z) => (x === 0 || x === 11 || z === 0 || z === 5 || y === 7 ? C('#bcd8e8', 0.3, 0.03) : water(x, y, z)));
  m.box(1, 8, 1, 11, 9, 5, C('#c8b890', 0.2, 0.08)); // gravel
  for (const [x, y] of [[3, 11], [8, 12]]) { m.set(x, y, 0, C('#ff7a20', 1.1, 0.05)); m.set(x + 1, y, 0, C('#ff9a3a', 1.1, 0.05)); }
  m.set(6, 9, 2, C('#3a8a3a', 0.4, 0.1)); m.set(6, 10, 2, C('#3a8a3a', 0.4, 0.1)); m.set(6, 11, 3, C('#3a8a3a', 0.4, 0.1));
  m.box(0, 14, 0, 12, 15, 6, black);
  return m;
};
const recordPlayer = () => {
  const m = new Model(12, 9, 8, 1 / 16);
  m.box(0, 0, 0, 12, 6, 8, (x, y, z) => (z === 0 && y > 0 && y < 5 && (x === 6) ? woodD : wood));
  m.box(0, 6, 0, 12, 7, 8, woodD);
  m.cyl(5, 4, 3.2, 7, 8, black); m.set(5, 7, 4, C('#d84a2a', 0, 0.04)); m.box(9, 7, 1, 10, 9, 6, C('#c0c4c8', 0, 0.04));
  for (let i = 0; i < 4; i++) m.box(1 + i * 2, 1, 0, 2 + i * 2, 5, 1, C(['#c83a2a', '#2a4a8a', '#e8d8a0', '#3a3a3a'][i], 0, 0.05)); // records on the shelf
  return m;
};
const catBed = () => {
  const m = new Model(14, 7, 12, 1 / 32);
  m.cyl(7, 6, 6.5, 0, 3, (x, y, z) => (Math.hypot(x + 0.5 - 7, z + 0.5 - 6) > 4.8 || y === 0 ? C('#a8483a', 0, 0.06) : C('#e8d8c0', 0, 0.05)));
  const fur = C('#1e1a1c', 0, 0.06);
  m.sphere(7.5, 3.6, 6, 4, 2.4, 3, fur); m.sphere(3.6, 4.2, 6, 2.2, 2, 2, fur);
  m.set(2, 6, 5, fur); m.set(2, 6, 7, fur); m.set(1, 4, 5, C('#e8c040', 0.6, 0.02)); m.set(1, 4, 7, C('#e8c040', 0.6, 0.02));
  return m;
};
const telescope = () => {
  const m = new Model(10, 40, 24, 1 / 32, [5, 0, 12]);
  const brass = C('#b8903a', 0, 0.05), leg = woodD;
  for (const [dx, dz] of [[-4, -4], [4, -4], [0, 5]]) for (let y = 0; y < 22; y++) m.set(Math.round(5 + dx * (1 - y / 22)), y, Math.round(12 + dz * (1 - y / 22)), leg);
  for (let t = 0; t < 26; t++) { const y = 22 + t * 0.55, z = 18 - t * 0.9; m.box(4, Math.round(y), Math.round(z), 6, Math.round(y) + 2, Math.round(z) + 1, t > 20 ? C('#2a2a2a', 0, 0.03) : brass); }
  return m;
};
const lanternString = () => {
  const m = new Model(160, 10, 3, 1 / 32, [80, 10, 1.5]);
  for (let x = 0; x < 160; x++) m.set(x, 9, 1, C('#2a2620', 0, 0.02));
  for (let x = 6; x < 160; x += 16) {
    const c = (x >> 4) % 2 ? C('#ff6a3a', 1.3, 0.05) : C('#ffd49a', 1.2, 0.05);
    m.box(x - 2, 2, 0, x + 3, 8, 3, c); m.box(x - 1, 1, 1, x + 2, 2, 2, black); m.box(x - 1, 8, 1, x + 2, 9, 2, black);
  }
  return m;
};
const plant = (fern) => {
  const m = new Model(12, 26, 12, 1 / 32);
  m.cyl(6, 6, 4, 0, 8, C(fern ? '#8a4a2a' : '#d8d0c0', 0, 0.05)); m.cyl(6, 6, 3.4, 7, 8, C('#2a1a10', 0, 0.06));
  const lv = [C('#2e6a2a', 0, 0.12), C('#4a8a3a', 0, 0.12), C('#1e4a22', 0, 0.1)];
  for (let i = 0; i < (fern ? 14 : 7); i++) {
    const a = i * 2.4, len = fern ? 6 : 8;
    for (let t = 0; t < len; t++) {
      const x = 6 + Math.cos(a) * t * 0.7, z = 6 + Math.sin(a) * t * 0.7, y = 8 + (fern ? t * 0.9 - t * t * 0.08 : 6 + t * 1.2 - t * t * 0.12) ;
      m.set(Math.round(x), Math.round(y), Math.round(z), lv[(i + t) % 3]);
      if (!fern && t > 3) { m.set(Math.round(x) + 1, Math.round(y), Math.round(z), lv[1]); m.set(Math.round(x), Math.round(y), Math.round(z) + 1, lv[0]); }
    }
  }
  return m;
};
const bigPrint = () => {
  const w = 22, h = 15, m = new Model(w, h, 1, 1 / 16, [w / 2, 0, 0.5]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c = woodD;
    else if (x === 1 || y === 1 || x === w - 2 || y === h - 2) c = C('#e8e0cc', 0, 0.03);
    else {
      const wave = 6 + Math.sin(x * 0.5) * 2 + (x > 9 && x < 15 ? (15 - Math.abs(x - 12) * 1.6) - 6 : 0);
      if (y < wave - 1) c = C('#1e3a6a', 0, 0.05);
      else if (y < wave) c = C('#f4f0e6', 0, 0.03);
      else if (x > 14 && x < 19 && y < 6 + (18 - x)) c = C('#3a5a8a', 0, 0.05); // little Fuji
      else c = C('#e8d8b0', 0, 0.05);
    }
    m.set(w - 1 - x, y, 0, c);
  }
  return m;
};
const irori = () => {
  const m = new Model(20, 2, 20, 1 / 16);
  m.box(0, 0, 0, 20, 2, 20, (x, y, z) => {
    const edge = x < 2 || z < 2 || x > 17 || z > 17;
    if (edge) return y === 1 ? C('#3a2416', 0, 0.05) : null;
    if (y === 1) return null;
    const d = Math.hypot(x - 9.5, z - 9.5), h = hash01(x, 3, z);
    return d < 3 && h > 0.35 ? C(h > 0.7 ? '#ff6a20' : '#ff9a3a', 2.2, 0.2) : C('#8a8680', 0, 0.08);
  });
  return m;
};
const hangingKettle = () => {
  const m = new Model(8, 44, 8, 1 / 16, [4, 44, 4]);
  m.box(3, 8, 3, 5, 44, 5, C('#8a6a40', 0, 0.06));    // the jizai hook's bamboo
  m.box(2, 14, 3, 6, 16, 5, woodD);                    // its wooden fish
  m.cyl(4, 4, 3.4, 1, 7, black); m.box(3, 7, 3, 5, 8, 5, black); m.box(6, 4, 3, 8, 5, 5, black);
  return m;
};

// a chunky CRT on a low stand (faces -z); the picture is a separate plane laid over the glass
const crt = () => {
  const m = new Model(16, 18, 12, 1 / 16);
  m.box(0, 0, 0, 16, 5, 12, (x, y, z) => (y === 4 || x === 0 || x === 15 ? wood : (z === 0 && y > 0 ? woodD : null)));
  const body = C('#2a2a30', 0, 0.04), bodyL = C('#3a3a42', 0, 0.04);
  m.box(1, 5, 1, 15, 17, 12, (x, y, z) => (z === 1 && x > 2 && x < 13 && y > 6 && y < 16 ? C('#101418', 0, 0.02) : y === 16 || x === 1 || x === 14 ? bodyL : body));
  m.box(13, 7, 0, 14, 8, 1, C('#ff3020', 2.0, 0.02)); m.box(13, 9, 0, 14, 10, 1, C('#a8a8b0', 0, 0.03)); m.box(13, 11, 0, 14, 12, 1, C('#a8a8b0', 0, 0.03));
  m.box(7, 17, 6, 8, 18, 7, C('#a8a8b0', 0, 0.03)); m.box(5, 17, 6, 6, 18, 7, C('#a8a8b0', 0, 0.03)); // rabbit ears
  return m;
};
// a cream-and-red console with two controllers on their cords (faces -z)
const famicom = () => {
  const m = new Model(24, 3, 16, 1 / 32);
  const cream = C('#ece4d0', 0, 0.03), red = C('#b8282a', 0, 0.04), dark = C('#2a1a1a', 0, 0.04);
  m.box(6, 0, 8, 18, 2, 15, cream); m.box(6, 2, 9, 18, 3, 14, red); m.box(10, 2, 13, 14, 3, 15, dark);
  for (const x0 of [1, 15]) { m.box(x0, 0, 1, x0 + 8, 1, 5, red); m.set(x0 + 1, 1, 3, dark); m.set(x0 + 2, 1, 2, dark); m.set(x0 + 2, 1, 4, dark); m.set(x0 + 3, 1, 3, dark); m.set(x0 + 6, 1, 3, C('#e8c040', 0, 0.03)); }
  for (let z = 5; z < 9; z++) { m.set(4, 0, z, dark); m.set(19, 0, z, dark); }
  return m;
};

// where each item goes, and what you can do with it
const PLACE = {
  lanterns: (h) => { h.put(lanternString(), 4.5, 6.35, 0.45, 0); h.put(lanternString(), 4.5, 6.35, 9.85, 0); },
  plants: (h) => { h.put(plant(false), 8.7, F2, 9.4, 0); h.put(plant(true), 14.9, F2, 0.8, 0); },
  bonsai: (h) => { h.put(bonsai(), 1.4, F2, 0.75, 0); h.act([1.4, F2 + 0.4, 0.75, 0.25, 0.25, 0.2], 'Trim the bonsai', () => { h.audio.clickSound(); h.toast('snip. one needle out of place, now in place.'); }); },
  print: (h) => { h.put(bigPrint(), 0.27, F2 + 1.2, 13.0, 3); },
  catbed: (h) => { h.put(catBed(), 7.6, F2, 1.3, 0); h.act([7.6, F2 + 0.15, 1.3, 0.25, 0.15, 0.22], 'Pet the black cat', () => { h.audio.purr(); h.toast('kuro opens one yellow eye, and closes it again.'); }); },
  fishtank: (h) => { h.put(fishtank(), 0.6, F2, 2.6, 3); h.act([0.6, F2 + 0.65, 2.6, 0.2, 0.25, 0.4], 'Feed the goldfish', () => { h.audio.clickSound(); h.toast('two goldfish race to the top. they are always hungry.'); }); },
  record: (h) => {
    h.put(recordPlayer(), 8.65, F2, 6.0, 1);
    h.recordPos = new THREE.Vector3(8.65, F2 + 0.5, 6.0);
    h.act([8.65, F2 + 0.45, 6.0, 0.25, 0.1, 0.4], () => (h.recordOn ? 'Lift the needle' : 'Put a record on'), () => { h.recordOn = !h.recordOn; h.audio.clickSound(); });
  },
  telescope: (h) => {
    h.put(telescope(), 5.75, F2, 1.0, 0);
    h.act([5.75, F2 + 1.2, 0.75, 0.15, 0.2, 0.25], 'Look through the telescope', () => h.onTelescope && h.onTelescope());
  },
  irori: (h) => {
    h.put(irori(), 12.5, F2, 5.5, 0, false);
    h.put(hangingKettle(), 12.5, 6.6, 5.5, 0, false);
    for (const [x, z, rot] of [[11.55, 5.5, 1], [13.45, 5.5, 3], [12.5, 6.45, 2]]) {
      h.put(zabuton(), x, F2, z, 0, false);
      h.seat({ x, z, y: F2 + 0.3, yaw: rot * Math.PI / 2 + Math.PI, kind: 'cushion', app: [x + (x - 12.5) * 0.9, z + (z - 5.5) * 0.9], floorY: F2 });
    }
    h.lamp({ pos: [12.5, F2 + 0.4, 5.5], color: 0xff7a30, intensity: 4, distance: 6, name: 'irori' });
    h.steam({ pos: [12.5, F2 + 0.6, 5.5], size: 0.35 });
  },
  heaters: (h) => { h.put(heater(), 0.65, 0.25, 9.6, 1); h.put(heater(), 15.35, 0.25, 4.9, 3); },
  crt: (h) => {
    h.put(crt(), 7.7, F2, 4.5, 1);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), new THREE.MeshBasicMaterial({ map: h.arcade.texture }));
    scr.position.set(7.7 - 12 / 32 + 1 / 16 - 0.008, F2 + 11 / 16, 4.5); scr.rotation.y = -Math.PI / 2; h.scene.add(scr); // over the glass
    h.act([7.7, F2 + 0.75, 4.5, 0.38, 0.4, 0.5], () => (h.tvOn ? 'Turn the TV off' : 'Turn the TV on'), () => h.onTV && h.onTV());
  },
  famicom: (h) => {
    h.put(famicom(), 7.1, F2, 4.5, 1, false);
    h.act([7.1, F2 + 0.05, 4.5, 0.22, 0.08, 0.38], 'Play the Fami-Com', () => h.onPlay && h.onPlay());
  },
};

// Places the things you own into the world, once each.
export class Home {
  constructor(o) { Object.assign(this, o); this.placed = new Set(); this.recordOn = false; }
  put(model, x, y, z, rot, collide = true) {
    const b = new PropBatch(collide ? this.world : null);
    b.add(model, x, y, z, rot, collide);
    this.scene.add(b.build(this.litMat, this.emitMat));
  }
  act(box, label, fn) { this.interactions.add(box, typeof label === 'function' ? label : () => label, fn); }
  seat(s) { this.addSeat(s); }
  lamp(l) { this.addLamp(l); }
  steam(s) { this.addSteam(s); }
  sync(owned) { for (const id of owned) if (!this.placed.has(id) && PLACE[id]) { this.placed.add(id); PLACE[id](this); } }
}
