// Life between nights: the save file, the mail-order catalog you read at the kotatsu, and everything
// it sells: new dishes and upgrades for the shop, and things to make the apartment upstairs your own.
import * as THREE from 'three';
import { Model, C, PropBatch, hash01 } from './voxel.js';
import { heater, zabuton, drinksFridge } from './props.js';
import { MAP } from './maps/index.js';

// ---------------------------------------------------------------- the save file
const KEY = 'yoake.save';
const fresh = () => ({ v: 1, night: 1, yen: 0, owned: [], pending: [], served: 0 });
export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) {
      const out = { ...fresh(), ...s, owned: Array.isArray(s.owned) ? s.owned : [], pending: Array.isArray(s.pending) ? s.pending : [] };
      if (out.night > 1 && !out.owned.includes('sushi') && !out.pending.includes('sushi')) out.owned.push('sushi'); // (nigiri was on the menu from the start)
      return out;
    }
  } catch {}
  return fresh();
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
export function clearSave() { try { localStorage.removeItem(KEY); } catch {} }

// ---------------------------------------------------------------- the catalog
// which recipe a station's upgrades wait on
const STATION_NEEDS = { sushi: 'sushi', onigiri: 'onigiri', tempura: 'tempura', ramen: 'ramen', icecream: 'freezer' };
export const CATALOG = [
  // Recipes, the rest of the building and the kit aren't bought: they come with milestones (guests served, nights
  // open, the shop's rating). Kit just arrives. A recipe has to be learned (a little puzzle: the ingredients in the
  // right order); a locked part of the building has to be got into (a lock to pick, a drift to shovel).
  // ms: what it takes; how: 'recipe' | 'task' | 'gift'; needs: an earlier one
  { id: 'sushi', kind: 'milestone', how: 'recipe', ms: { served: 6 }, name: 'Salmon nigiri', text: 'Hand-pressed rice, a dab of wasabi, a slice of salmon. Made at the sushi case under the kitchen pass.' },
  { id: 'dishes', kind: 'milestone', how: 'gift', ms: { served: 20 }, name: 'More cups and plates', text: 'A supplier sends six more of each for the shelves.' },
  { id: 'onigiri', kind: 'milestone', how: 'recipe', ms: { served: 45 }, name: 'Onigiri', text: 'Rice balls round a salmon filling, wrapped in nori, pressed at the rice cookers.' },
  { id: 'fridge', kind: 'milestone', how: 'gift', ms: { nights: 3 }, name: 'A drinks fridge', text: 'The drinks company puts a fridge by the east wall: ramune, tea and beer. ¥250 more on every bill.' },
  { id: 'backdoor', kind: 'milestone', how: 'task', game: 'shovel', ms: { served: 75 }, name: 'Dig out the back door', text: "The back door's snowed shut from outside. Go up through the flat and down the fire escape into the yard, and shovel the drift off it. Then there's one more guest in every rush, and the trash goes out the back." },
  { id: 'heaters', kind: 'milestone', how: 'gift', ms: { served: 110 }, name: 'Kerosene heaters', text: 'Two more heaters for the dining room. Warm guests wait 25% longer.' },
  { id: 'tempura', kind: 'milestone', how: 'recipe', ms: { served: 150 }, name: 'Tempura', text: 'Shrimp in a light, lacy batter, fried at the fryers in the kitchen.' },
  { id: 'beltMotor', kind: 'milestone', how: 'gift', ms: { served: 200 }, name: 'A stronger belt motor', text: 'The sushi belt runs half again as fast.' },
  { id: 'freezer', kind: 'milestone', how: 'task', game: 'lockpick', ms: { served: 250 }, name: 'Mochi ice cream', text: "Nobody's seen the key to the old walk-in freezer in years. Pick its lock, get it humming, and mochi ice cream goes on the menu (¥450), from the chest freezer inside." },
  { id: 'dishes2', kind: 'milestone', how: 'gift', ms: { served: 300 }, needs: 'dishes', name: 'A full set of tableware', text: 'Another eight cups and plates: twenty of each.' },
  { id: 'ramen', kind: 'milestone', how: 'recipe', ms: { served: 350 }, name: 'Miso ramen', text: 'Bowls of ramen built up on the stove. Slow to make; everyone wants one.' },
  { id: 'heaters2', kind: 'milestone', how: 'gift', ms: { served: 430, rating: 4 }, needs: 'heaters', name: 'Hot towels at every seat', text: 'Guests wait half again as long before giving up.' },
  { id: 'beltMotor2', kind: 'milestone', how: 'gift', ms: { served: 500 }, needs: 'beltMotor', name: 'An industrial belt motor', text: 'The belt runs at twice its old speed.' },
  { id: 'kura', kind: 'milestone', how: 'task', game: 'lockpick', ms: { served: 580 }, needs: 'backdoor', name: 'The old kura', text: 'The storehouse is padlocked, and the key went with the last owner. Pick the padlock and keep your own sake in there: a cup of house sake goes on every bill, ¥400 more.' },
  { id: 'fridge2', kind: 'milestone', how: 'gift', ms: { served: 680 }, needs: 'kura', name: 'A sake warmer', text: 'Warm sake on snowy nights: another ¥350 on every bill.' },
  // the help: hire them all and the shop runs itself
  { id: 'staff_wash', kind: 'staff', name: 'Hire a dishwasher', price: 8000, wage: 1200, text: 'Taro runs the sink, and buses tables too: as guests leave he clears their dishes, washes them and shelves them, and takes the trash out when the bin is full. ¥1,200 a night.' },
  { id: 'staff_waiter', kind: 'staff', name: 'Hire a waiter', price: 18000, wage: 2400, text: 'Yui takes orders, pours tea, and carries dishes out from the pass (or off any counter) to whoever ordered them. She clears tables too, when there\'s nothing to carry. ¥2,400 a night.' },
  { id: 'staff_hall', kind: 'staff', name: 'Hire a cashier', price: 12000, wage: 1600, text: 'Hana minds the register by the door and rings up everyone who comes to pay. ¥1,600 a night.' },
  { id: 'staff_sushi', kind: 'staff', name: 'Hire a sushi chef', price: 14000, wage: 2000, text: 'Kenji works the sushi case: nigiri (and onigiri) down the belt for the guests along it, onto the pass for everyone else. ¥2,000 a night.' },
  { id: 'staff_cook', kind: 'staff', name: 'Hire a line cook', price: 22000, wage: 2800, text: 'Ren works the grills, the teppan, the fryer and the ramen pot: he cooks what\'s been ordered and plates it onto the pass. ¥2,800 a night.' },
  { id: 'staff_stock', kind: 'staff', name: 'Hire a stock hand', price: 9000, wage: 1200, text: 'Sota keeps the kitchen stocked: when a station runs low he fetches a crate down from the storeroom upstairs, and a fresh keg from the shed when the sake runs dry. Between runs he takes the trash out. ¥1,200 a night.' },
  { id: 'lanterns', kind: 'home', name: 'A string of paper lanterns', price: 1800, text: 'Little lanterns along the engawa, over the bay windows.' },
  { id: 'plants', kind: 'home', name: 'Houseplants', price: 2000, text: 'A monstera and a fern, for the corners.' },
  { id: 'bonsai', kind: 'home', name: 'Bonsai pine', price: 2800, text: 'On a stand by the window. Older than the shop.' },
  { id: 'print', kind: 'home', name: 'A big woodblock print', price: 3200, text: 'The great wave, framed, for the living room wall.' },
  { id: 'catbed', kind: 'home', name: 'A cat bed', price: 3500, text: 'A little black cat moves in upstairs.' },
  { id: 'fishtank', kind: 'home', name: 'A goldfish tank', price: 4500, text: 'Two fat goldfish and a glowing tank.' },
  { id: 'record', kind: 'home', name: 'A record player', price: 6000, text: 'Koto records to play upstairs.' },
  { id: 'telescope', kind: 'home', name: 'A brass telescope', price: 7500, text: 'At the front window. Look at Fuji up close.' },
  { id: 'irori', kind: 'home', name: 'An irori hearth', price: 15000, text: 'A sunken fire pit with a kettle on a hook. Sit by the embers.' },
  { id: 'crt', kind: 'home', name: 'A CRT television', price: 5500, text: 'A chunky old set for the living room, facing the kotatsu.' },
  { id: 'famicom', kind: 'home', needs: 'crt', name: 'A Fami-Com console', price: 7500, text: 'Two red controllers, and Sushi Catch in the slot.' },
  { id: 'game_dash', kind: 'games', needs: 'famicom', game: 'dash', name: 'Snow Dash', price: 1800, text: 'Run through the snow, jump the snowmen, duck the crows.' },
  { id: 'game_koi', kind: 'games', needs: 'famicom', game: 'koi', name: 'Koi Pond', price: 2000, text: 'A koi grows longer with every pellet. Mind the stones.' },
  { id: 'game_daruma', kind: 'games', needs: 'famicom', game: 'daruma', name: 'Daruma Break', price: 2500, text: 'Bounce a ball and knock down every daruma on the shelf.' },
  // the kitchen's own stations: bought at the station itself before the sign turns to OPEN (see service.upNext).
  // Every level makes the station faster or makes each dish worth more: speed levels cut the cooking time by a fifth,
  // value levels put more on the bill for every dish it makes. (The quick stations, tea, sushi, onigiri and ice cream,
  // are all value.)
  ...stationUps({
    tea: [['v', 'Gyokuro leaves', 50, 3000], ['v', 'Kyoto teaware', 80, 8000], ['v', 'Uji first flush', 120, 16000]],
    sushi: [['v', 'Fresh-grated wasabi', 100, 5000], ['v', 'Otoro from the market', 150, 12000], ['v', 'Aged red-vinegar rice', 200, 24000]],
    onigiri: [['v', 'Koshihikari rice', 60, 4000], ['v', 'Kishu umeboshi', 100, 10000], ['v', 'Ariake nori', 140, 20000]],
    icecream: [['v', 'Hokkaido cream', 80, 6000], ['v', 'Ceremonial matcha', 120, 14000], ['v', 'Hand-pounded mochi', 160, 26000]],
    yakitori: [['s', 'Bamboo fans for the coals', 0.2, 6000], ['v', 'Tare aged in a crock', 150, 12000], ['s', 'Binchotan charcoal', 0.2, 20000], ['v', 'Jidori chicken', 250, 32000]],
    gyoza: [['s', 'A heavy lid', 0.2, 5500], ['v', 'Kurobuta pork filling', 150, 12000], ['s', 'A copper teppan', 0.2, 20000], ['v', 'Hand-folded wrappers', 250, 30000]],
    tempura: [['s', 'Fresh frying oil', 0.2, 6000], ['v', 'Tiger prawns', 180, 13000], ['s', 'A deep copper pot', 0.2, 22000], ['v', 'A sesame-oil blend', 280, 34000]],
    ramen: [['s', 'A pressure stockpot', 0.2, 7500], ['v', 'Chashu braised overnight', 200, 15000], ['s', 'A second burner', 0.2, 24000], ['v', 'Hakata tonkotsu broth', 320, 38000]],
  }),
];
function stationUps(table) {
  return Object.entries(table).flatMap(([station, rows]) => rows.map(([track, name, amount, price], i) => ({
    id: `up_${station}${i + 1}`, kind: 'station', station, track, name, amount, price, level: i + 1, levels: rows.length,
    short: track === 's' ? `cooks ${Math.round(amount * 100)}% faster` : `+¥${amount} a dish`,
    needs: i ? `up_${station}${i}` : STATION_NEEDS[station],
  })));
}
export const STATION_UPS = CATALOG.filter((c) => c.kind === 'station');
// the cartridges you own (Sushi Catch comes with the console)
export const ownedGames = (owned) => (owned.includes('famicom') ? ['sushi', ...CATALOG.filter((c) => c.kind === 'games' && owned.includes(c.id)).map((c) => c.game)] : []);
export const itemById = (id) => CATALOG.find((c) => c.id === id);
export const MILESTONES = CATALOG.filter((c) => c.kind === 'milestone');
// how far along a milestone is (0..1), from the shop's record: guests served, nights open, its rating
export function milestoneProgress(m, rec) {
  const parts = [];
  if (m.ms.served) parts.push(Math.min(1, rec.served / m.ms.served));
  if (m.ms.nights) parts.push(Math.min(1, (rec.nights) / m.ms.nights));
  if (m.ms.rating) parts.push(Math.min(1, rec.rating / m.ms.rating));
  return Math.min(...parts);
}
export const milestoneGoal = (m) => [m.ms.served && `${m.ms.served} guests served`, m.ms.nights && `${m.ms.nights} nights open`, m.ms.rating && `a ${m.ms.rating}★ rating`].filter(Boolean).join(' and ');
// newly reached milestones: kit goes straight into `owned`; recipes and locked doors go on the to-do list (`pending`)
export function reachMilestones(save, owned, rec) {
  save.pending = save.pending || [];
  const got = [];
  for (const m of MILESTONES) {
    if (owned.includes(m.id) || save.pending.includes(m.id) || (m.needs && !owned.includes(m.needs))) continue;
    if (milestoneProgress(m, rec) < 1) continue;
    if (m.how === 'gift') owned.push(m.id); else save.pending.push(m.id);
    got.push(m);
  }
  return got;
}

// what the shop upgrades do, applied to the service (and the belt) every time ownership changes
export function applyUpgrades(service, owned) {
  const has = (id) => owned.includes(id);
  service.menuKinds = new Set(['tea', 'yakitori', 'gyoza', ...['sushi', 'onigiri', 'tempura', 'ramen'].filter(has), ...(has('freezer') ? ['icecream'] : [])]);
  const prevMax = service.stockMax;
  service.stockMax = 6 + (has('dishes') ? 6 : 0) + (has('dishes2') ? 8 : 0);
  // new cups and plates go straight onto the shelves (not just from tomorrow night)
  if (prevMax && service.stockMax > prevMax && service.stock) { service.stock.mugs += service.stockMax - prevMax; service.stock.plates += service.stockMax - prevMax; }
  service.patienceBonus = has('heaters2') ? 1.5 : has('heaters') ? 1.25 : 1;
  service.drinkBill = (has('fridge') ? 250 : 0) + (has('fridge2') ? 350 : 0) + (has('kura') ? 400 : 0);
  service.sakeBill = (has('fridge2') ? 350 : 0) + (has('kura') ? 400 : 0); // (the house sake's part: none while the keg's dry)
  service.extraGuests = has('backdoor') ? 1 : 0;
  service.belt.speed = has('beltMotor2') ? 0.84 : has('beltMotor') ? 0.63 : 0.42;
  // station upgrades: speed levels cut the cooking time, value levels add to the bill for every dish
  const ups = STATION_UPS.filter((u) => has(u.id));
  service.twin = new Set();
  service.priceBonus = {};
  for (const u of ups) if (u.track === 'v') service.priceBonus[u.station] = (service.priceBonus[u.station] || 0) + u.amount;
  for (const st of service.stations) {
    st.cook = st.baseCook * ups.filter((u) => u.station === st.kind && u.track === 's').reduce((k, u) => k * (1 - u.amount), 1);
    st.batch = 1; st.burn = 30;
  }
  // staff on the payroll
  service.staff = new Set(CATALOG.filter((c) => c.kind === 'staff' && has(c.id)).map((c) => c.id));
  service.wages = CATALOG.filter((c) => c.kind === 'staff' && has(c.id)).reduce((a, c) => a + c.wage, 0);
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

// Things that hang on walls (and the shop's heaters) stay where they're put.
// (where each goes comes from the map: MAP.home.fixed[id] is a list of [x, y, z, quarter turns])
const FIXED_MODELS = { lanterns: () => lanternString(), print: () => bigPrint(), heaters: () => heater(), fridge: () => drinksFridge() };
const FIXED = Object.fromEntries(Object.entries(FIXED_MODELS).map(([id, model]) => [id, (h) => { for (const at of MAP.home.fixed[id] || []) h.put(model(), ...at); }]));

// Everything that stands on the apartment floor is a piece you can pick up and move (F), turn (R) and
// set down again. Each is described around its own origin: `at` is [x, z, quarter turns] for where it
// first goes, `foot` its half size on the floor, and parts, things to do, seats and lights sit relative
// to it. Boxes are [x, y, z, half x, half y, half z] in the piece's own frame.
const PIECES = [
  { key: 'bonsai', item: 'bonsai', name: 'the bonsai', at: [8.2, 5.1, 0], foot: [0.25, 0.18], parts: [{ model: bonsai }],
    acts: [{ box: [0, 0.4, 0, 0.25, 0.25, 0.2], label: 'Trim the bonsai', fn: (h) => { h.audio.clickSound(); h.toast('snip. one needle out of place, now in place.'); } }] },
  { key: 'plant1', item: 'plants', name: 'the monstera', at: [10.6, 2.15, 0], foot: [0.2, 0.2], parts: [{ model: () => plant(false) }] },
  { key: 'plant2', item: 'plants', name: 'the fern', at: [15.35, 0.7, 0], foot: [0.2, 0.2], parts: [{ model: () => plant(true) }] },
  { key: 'catbed', item: 'catbed', name: 'the cat bed', at: [15.2, 4.85, 0], foot: [0.22, 0.19], parts: [{ model: catBed, collide: false }],
    acts: [{ box: [0, 0.15, 0, 0.25, 0.15, 0.22], label: 'Pet the black cat', fn: (h) => { h.audio.purr(); h.toast('kuro opens one yellow eye, and closes it again.'); } }] },
  { key: 'fishtank', item: 'fishtank', name: 'the goldfish tank', at: [6.0, 6.6, 3], foot: [0.375, 0.19], parts: [{ model: fishtank }],
    acts: [{ box: [0, 0.65, 0, 0.4, 0.25, 0.2], label: 'Feed the goldfish', fn: (h) => { h.audio.clickSound(); h.toast('two goldfish race to the top. they are always hungry.'); } }] },
  { key: 'record', item: 'record', name: 'the record player', at: [6.1, 8.0, 3], foot: [0.375, 0.25], parts: [{ model: recordPlayer }], sound: [0, 0.5, 0],
    acts: [{ box: [0, 0.45, 0, 0.4, 0.1, 0.25], label: (h) => (h.recordOn ? 'Lift the needle' : 'Put a record on'), fn: (h) => { h.recordOn = !h.recordOn; h.audio.clickSound(); } }] },
  { key: 'telescope', item: 'telescope', name: 'the telescope', at: [12.0, 0.85, 0], foot: [0.18, 0.38], parts: [{ model: telescope }],
    acts: [{ box: [0, 1.2, -0.25, 0.15, 0.2, 0.25], label: 'Look through the telescope', fn: (h) => h.onTelescope && h.onTelescope() }] },
  { key: 'irori', item: 'irori', name: 'the hearth', at: [7.95, 7.1, 0], foot: [1.2, 1.2],
    parts: [{ model: irori, collide: false }, { model: hangingKettle, y: 6.6 - F2, collide: false },
      { model: zabuton, x: -0.95, collide: false }, { model: zabuton, x: 0.95, collide: false }, { model: zabuton, z: 0.95, collide: false }],
    seats: [{ x: -0.95, z: 0, yaw: Math.PI * 1.5 }, { x: 0.95, z: 0, yaw: Math.PI / 2 }, { x: 0, z: 0.95, yaw: 0 }],
    lamp: { x: 0, y: 0.4, z: 0, color: 0xff7a30, intensity: 4, distance: 6, name: 'irori' }, steam: { x: 0, y: 0.6, z: 0, size: 0.35 } },
  // the TV comes with a cushion on the floor in front of it, at eye level with the screen; they move together
  { key: 'crt', item: 'crt', name: 'the TV', at: [6.25, 3.6, 3], foot: [0.5, 0.96], footOff: [0, -0.58], parts: [{ model: crt }, { model: zabuton, z: -1.25, collide: false }], screen: true,
    seats: [{ x: 0, z: -1.25, yaw: Math.PI, y: 0.0, app: [0.8, -1.25], label: 'Sit in front of the TV', note: 'cross-legged on the cushion, eye to eye with the set · walk to stand up' }],
    acts: [{ box: [0, 0.75, 0, 0.5, 0.4, 0.38], label: (h) => (h.tvOn ? 'Turn the TV off' : 'Turn the TV on'), fn: (h) => h.onTV && h.onTV() }] },
  // the console sits on the floor between the TV and its cushion, and goes where the TV goes
  { key: 'famicom', item: 'famicom', name: 'the Fami-Com', attach: { to: 'crt', x: 0, z: -0.62 }, foot: [0.38, 0.25], parts: [{ model: famicom, collide: false }],
    acts: [{ box: [0, 0.05, 0, 0.38, 0.08, 0.22], label: 'Play the Fami-Com', fn: (h) => h.onPlay && h.onPlay() }] },
];
// floor you can't put things on: the kotatsu and its cushions, the futon, the genkan, the tokonoma, and the ways
// through: the gaps in the shoji and the fusuma, the doorway to the back room, the kitchen corner
// where furniture can't go (walkways, doorways, the built-in furniture) and the room it must stay in come from the
// map: MAP.home.noGo, MAP.home.room. A piece's first spot is MAP.home.at[key].

// rotate a local (x, z) by quarter turns, the same way three.js turns an object about y
const turn = (x, z, rot) => { const a = rot * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)); return [x * c + z * s, -x * s + z * c]; };

// Places the things you own into the world, once each.
export class Home {
  constructor(o) {
    Object.assign(this, o);
    this.placed = new Set(); this.recordOn = false;
    this.pieces = new Map();   // key → piece
    this.layout = { ...(o.layout || {}) }; // key → [x, z, rot], what's been moved (saved)
    this.recordPos = new THREE.Vector3(); this.models = new Map();
  }
  put(model, x, y, z, rot, collide = true) {
    const b = new PropBatch(collide ? this.world : null);
    b.add(model, x, y, z, rot, collide);
    this.scene.add(b.build(this.litMat, this.emitMat));
  }
  model(fn) { if (!this.models.has(fn)) this.models.set(fn, fn()); return this.models.get(fn); }
  sync(owned) {
    for (const id of owned) {
      if (this.placed.has(id)) continue;
      this.placed.add(id);
      if (FIXED[id]) FIXED[id](this);
      for (const spec of PIECES) if (spec.item === id && !spec.attach) this.makePiece(spec);
    }
    // things that ride on another piece go in once their host is there
    for (const spec of PIECES) if (spec.attach && this.placed.has(spec.item) && !this.pieces.has(spec.key) && this.pieces.has(spec.attach.to)) this.makePiece(spec);
  }

  // ---------------------------------------------------------------- pieces
  makePiece(spec) {
    const p = { spec, key: spec.key, root: new THREE.Group(), cells: [], seats: [], parts: [] };
    for (const part of spec.parts) {
      const m = this.model(part.model), g = m.mesh(this.litMat, this.emitMat);
      g.position.set(part.x || 0, part.y || 0, part.z || 0); g.rotation.y = (part.rot || 0) * Math.PI / 2;
      p.root.add(g); p.parts.push({ m, g, collide: part.collide !== false });
    }
    if (spec.screen) { // the TV's picture: the console's canvas, over the glass
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.5), new THREE.MeshBasicMaterial({ map: this.arcade.texture }));
      scr.position.set(0, 11 / 16, -12 / 32 + 1 / 16 - 0.008); scr.rotation.y = Math.PI; p.root.add(scr);
      p.screen = scr;
    }
    this.scene.add(p.root);
    const move = this.touch ? '' : ' · F to move';
    const boxOf = (b) => () => {
      const [dx, dz] = turn(b[0], b[2], p.rot), odd = p.rot & 1;
      return [p.x + dx, F2 + b[1], p.z + dz, odd ? b[5] : b[3], b[4], odd ? b[3] : b[5]];
    };
    // an attached piece rides along with its host: moving it moves the host
    const host = spec.attach ? this.pieces.get(spec.attach.to) : null;
    if (host) { p.host = host; (host.kids ||= []).push(p); }
    for (const a of spec.acts || []) {
      const it = this.interactions.add(boxOf(a.box), () => (typeof a.label === 'function' ? a.label(this) : a.label) + move, () => a.fn(this));
      it.piece = host || p;
    }
    if (!spec.acts) { // nothing to do with it but look at it: clicking picks it up
      const it = this.interactions.add(boxOf([0, 0.35, 0, spec.foot[0], 0.35, spec.foot[1]]), () => `${spec.name[0].toUpperCase()}${spec.name.slice(1)} · click to move`, () => this.onMove && this.onMove(p));
      it.piece = p;
    }
    for (const s of spec.seats || []) {
      const seat = { kind: 'cushion', y: F2 + (s.y ?? 0.3), floorY: F2, local: s, x: 0, z: 0, yaw: 0, app: [0, 0] };
      p.seats.push(seat);
      const it = this.addSeat(seat); if (it) it.piece = p;
    }
    if (spec.lamp) p.lamp = this.addLamp({ ...spec.lamp, pos: [0, 0, 0] });
    if (spec.steam) { p.steam = this.addSteam({ pos: [0, 0, 0], size: spec.steam.size }); }
    this.pieces.set(spec.key, p);
    if (host) { this.pose(host, host.x, host.z, host.rot); return p; }
    // a spot saved before the flat was rebuilt may be in the storeroom now: start it over where it first goes
    const home = MAP.home.at[spec.key] || spec.at;
    let at = this.layout[spec.key] || home;
    if (at !== home && !this.fits(p, at[0], at[1], at[2])) { at = home; delete this.layout[spec.key]; }
    this.pose(p, at[0], at[1], at[2]);
    this.mark(p);
    return p;
  }
  // put a piece (and everything that hangs off it) at x, z turned rot quarter turns
  pose(p, x, z, rot) {
    p.x = x; p.z = z; p.rot = ((rot % 4) + 4) % 4;
    p.root.position.set(x, F2, z); p.root.rotation.y = p.rot * Math.PI / 2;
    for (const seat of p.seats) {
      const [dx, dz] = turn(seat.local.x, seat.local.z, p.rot);
      seat.x = x + dx; seat.z = z + dz; seat.yaw = seat.local.yaw + p.rot * Math.PI / 2;
      if (seat.local.app) { const [ax, az] = turn(seat.local.app[0], seat.local.app[1], p.rot); seat.app = [x + ax, z + az]; }
      else seat.app = [x + dx * 1.9, z + dz * 1.9];
    }
    for (const k of p.kids || []) { const [dx, dz] = turn(k.spec.attach.x, k.spec.attach.z, p.rot); this.pose(k, x + dx, z + dz, p.rot); }
    const at = (o) => { const [dx, dz] = turn(o.x, o.z, p.rot); return [x + dx, F2 + o.y, z + dz]; };
    if (p.lamp) p.lamp.v.set(...at(p.spec.lamp));
    if (p.steam) p.steam.position.set(...at(p.spec.steam));
    if (p.spec.sound) this.recordPos.set(...at({ x: p.spec.sound[0], y: p.spec.sound[1], z: p.spec.sound[2] }));
  }
  // what it takes up in the voxel world, so you (and only you) bump into it
  mark(p) {
    p.root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const part of p.parts) {
      if (!part.collide) continue;
      const s = part.m.scale, pv = part.m.pivot;
      part.m.forEach((vx, vy, vz) => {
        v.set((vx + 0.5 - pv[0]) * s, (vy + 0.5 - pv[1]) * s, (vz + 0.5 - pv[2]) * s).applyMatrix4(part.g.matrixWorld);
        const i = this.world.cell(v.x, v.y, v.z);
        if (i >= 0 && !this.world.col[i]) { this.world.col[i] = 1; p.cells.push(i); }
      });
    }
  }
  unmark(p) { for (const i of p.cells) this.world.col[i] = 0; p.cells = []; }
  // the floor it would cover at x, z, rot: [x0, x1, z0, z1]
  rect(p, x, z, rot) {
    const [hx, hz] = rot & 1 ? [p.spec.foot[1], p.spec.foot[0]] : p.spec.foot;
    const [ox, oz] = p.spec.footOff ? turn(p.spec.footOff[0], p.spec.footOff[1], rot) : [0, 0];
    return [x + ox - hx, x + ox + hx, z + oz - hz, z + oz + hz];
  }
  // can it go there? Inside the apartment, clear of walls, furniture, the other pieces, the doorway and you.
  fits(p, x, z, rot, who) {
    const [x0, x1, z0, z1] = this.rect(p, x, z, rot);
    const ROOM = MAP.home.room;
    if (x0 < ROOM.x0 || x1 > ROOM.x1 || z0 < ROOM.z0 || z1 > ROOM.z1) return false;
    const hit = (r) => x0 < r[1] && x1 > r[0] && z0 < r[3] && z1 > r[2];
    if (MAP.home.noGo.some(hit)) return false;
    for (const q of this.pieces.values()) if (q !== p && !q.host && hit(this.rect(q, q.x, q.z, q.rot))) return false;
    if (who && who.x > x0 - 0.25 && who.x < x1 + 0.25 && who.z > z0 - 0.25 && who.z < z1 + 0.25) return false;
    for (let px = x0 + 0.03; px <= x1; px += 0.1) for (let pz = z0 + 0.03; pz <= z1; pz += 0.1)
      for (const y of [0.2, 0.7, 1.3]) if (this.world.solid(px, F2 + y, pz)) return false;
    return true;
  }
  // move a piece for good (and remember where)
  moveTo(key, x, z, rot) {
    const p = this.pieces.get(key); if (!p) { this.layout[key] = [x, z, rot]; return; }
    if (p.host) return; // it goes where its host goes
    this.unmark(p); this.pose(p, x, z, rot); this.mark(p);
    this.layout[key] = [x, z, p.rot];
  }
  applyLayout(lay) {
    for (const [key, [x, z, rot]] of Object.entries(lay || {})) {
      const cur = this.layout[key];
      if (!cur || cur[0] !== x || cur[1] !== z || cur[2] !== rot) this.moveTo(key, x, z, rot);
    }
  }
}
