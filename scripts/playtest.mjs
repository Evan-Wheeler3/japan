// End-to-end playtest: a bot plays the whole loop in a headless browser and checks it holds together.
//   wake upstairs → buy from the catalog (dishes, upgrade levels, the TV, the Fami-Com and its games)
//   → play the Fami-Com → open the shop → work a full night (by hand and by belt,
//   cooking every dish, washing up) → sunrise and the night's card → go to bed → wake for night 2
//   → reload and check the save carried over → the night parade: hold the front room with a katana, break a seal,
//   an oni night, and the card when you fall.
// Usage: npm install && npm run playtest     (CHROME_PATH=/path/to/chrome to pick a browser)
import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/index.html`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// three.js comes from a CDN in the page; serve it from node_modules so the test runs offline
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (r) =>
  r.fulfill({ path: path.join(root, 'node_modules/three', r.request().url().split('three@0.170.0/')[1]), contentType: 'text/javascript' }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));

const check = (ok, what) => { if (!ok) throw new Error(what); console.log(`  ok · ${what}`); };
const ready = () => page.waitForFunction(() => window.__yoake && document.querySelector('#screen [data-act="solo"]'), null, { timeout: 240000 });
let exitCode = 0;
try {
  await page.goto(url); await ready();
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await ready();

  // ---- evening: wake upstairs, the shop closed
  await page.click('#screen [data-act="solo"]');
  let st = await page.evaluate(() => { const d = window.__yoake; return { y: d.player.pos.y, waiting: d.shift.waiting, n: d.shift.n }; });
  check(st.y > 3.5 && st.waiting && st.n === 1, 'night 1 starts upstairs with the shop closed');

  // ---- the catalog: new dishes, an upgrade and things for home
  st = await page.evaluate(() => {
    const d = window.__yoake;
    d.save.yen = 45000;
    d.menu.h.onBuy('beltMotor2'); // needs the first motor: refused
    const early = d.service.owned.length;
    for (const id of ['onigiri', 'tempura', 'ramen', 'beltMotor', 'beltMotor2', 'irori', 'telescope', 'catbed', 'crt', 'famicom', 'game_dash', 'game_koi', 'game_daruma']) d.menu.h.onBuy(id);
    return { early, owned: d.service.owned, menu: [...d.service.menuKinds], speed: d.service.belt.speed, placed: [...d.home.placed], games: d.arcade.owned, yen: d.save.yen };
  });
  check(st.early === 0, 'a level-two upgrade waits for level one');

  check(st.owned.length === 13 && st.menu.includes('ramen') && st.speed > 0.8 && st.placed.includes('irori') && st.games.length === 4, `bought ${st.owned.join(', ')} (¥${st.yen} left)`);

  // ---- dev: the ` key toggles a cash box that never runs out
  await page.keyboard.press('Backquote');
  st = await page.evaluate(() => { const d = window.__yoake, before = d.save.yen; d.menu.h.onBuy('bonsai'); d.menu.h.onBuy('fridge'); return { dev: d.save.devYen, spent: before - d.save.yen, owned: d.service.owned.includes('bonsai'), drink: d.service.drinkBill }; });
  await page.keyboard.press('Backquote');
  check(st.dev && st.spent === 0 && st.owned && !(await page.evaluate(() => window.__yoake.save.devYen)), 'the dev switch buys for free and toggles back off');
  check(st.drink === 250, 'the drinks fridge puts ¥250 on every bill');
  // ---- the property: the back door, the walk-in freezer and the kura open up from the catalog
  st = await page.evaluate(() => {
    const d = window.__yoake, locked = () => d.doors.filter((x) => x.spec.needs).map((x) => x.locked);
    const before = locked();
    d.save.devYen = true; for (const id of ['backdoor', 'freezer', 'kura']) d.menu.h.onBuy(id); d.save.devYen = false;
    const B = d.map.shop.crowd.back;
    return { before, after: locked(), ice: d.service.menuKinds.has('icecream'), drink: d.service.drinkBill, extra: d.service.extraGuests, back: !B || !B.spawn || d.crowd.spawns.some((sp) => sp[0] === B.spawn[0] && sp[1] === B.spawn[1]) };
  });
  check(st.before.every(Boolean) && st.after.every((l) => !l) && st.ice && st.drink === 650 && st.extra === 1 && st.back,
    'digging out the back door, fixing the freezer and restoring the kura open their doors, add ice cream, house sake and more guests');

  // ---- the shrine: walk out past the old border, bow, and the kami leave ¥100 once a day
  const bowAt = () => page.evaluate(() => {
    const d = window.__yoake; d.player.pos.set(...d.map.test.bowFrom);
    d.interactions.items.find((it) => { try { return it.label() === 'Bow at the shrine'; } catch { return false; } }).act();
  });
  const yen0 = await page.evaluate(() => window.__yoake.save.yen);
  // the bow runs on real time inside the frame loop; a slow CI renderer takes longer than 4.4 s to get there
  const bowDone = async () => { await page.waitForTimeout(500); await page.waitForFunction(() => !window.__yoake.player.frozen, null, { timeout: 60000 }); await page.waitForTimeout(300); };
  await bowAt(); await bowDone();
  const yen1 = await page.evaluate(() => window.__yoake.save.yen);
  await bowAt(); await bowDone();
  st = await page.evaluate(() => { const d = window.__yoake, [x, y, z] = d.map.test.bowFrom, S = d.map.shop.shrine; return { yen: d.save.yen, near: Math.hypot(d.player.pos.x - S.x, d.player.pos.z - S.z) < 2.2, free: !d.player.frozen, clear: !d.player.blocked(x, z, y) }; });
  check(yen1 === yen0 + 100 && st.yen === yen1 && st.free && st.clear && st.near, `bowing at the shrine leaves ¥100, once a day (¥${yen0} → ¥${yen1} → ¥${st.yen})`);

  // ---- the vending machine: ¥130 for a hot can and a quarter more walking speed for a while
  st = await page.evaluate(() => {
    const d = window.__yoake, before = d.save.yen;
    d.interactions.items.find((it) => { try { return it.label().startsWith('Buy a hot drink'); } catch { return false; } }).act();
    return { spent: before - d.save.yen, mul: d.player.speedMul };
  });
  check(st.spent === 130 && st.mul === 1.25, 'a hot drink costs ¥130 and gives 1.25x walking speed');

  // ---- the Fami-Com: pick up the controller, play Sushi Catch, set a high score, put it down
  await page.evaluate(() => window.__yoake.home.onPlay());
  check(await page.evaluate(() => document.body.classList.contains('arcade') && window.__yoake.arcade.mode === 'menu'), 'the Fami-Com opens on its cartridge menu');
  await page.keyboard.press('Space');
  // the room renders behind the game now, so on a software renderer the game runs slow: play until we score
  for (let i = 0; i < 400; i++) {
    const score = await page.evaluate(() => { // a steady hand: slide under the lowest sushi
      const a = window.__yoake.arcade, s = a.s; if (!s || !s.items) return 0;
      const it = s.items.filter((x) => x.kind !== 'wasabi').sort((p, q) => q.y - p.y)[0];
      a.keys.left = !!it && it.x < s.x - 4; a.keys.right = !!it && it.x > s.x + 4;
      return s.score;
    });
    if (i >= 40 && score > 0) break;
    await page.waitForTimeout(250);
  }
  st = await page.evaluate(() => { const d = window.__yoake, seat = d.home.pieces.get('crt').seats[0]; return { sat: d.player.seated === seat, fov: d.camera.fov }; });
  check(st.sat && st.fov < 60, `playing sits you on the TV's cushion and frames the set (fov ${st.fov.toFixed(0)})`);
  st = await page.evaluate(() => { const a = window.__yoake.arcade; const score = a.s.score; a.s.lives = 0; return { mode: a.mode, game: a.gameId, score }; });
  await page.waitForFunction(() => window.__yoake.save.hi && window.__yoake.save.hi.sushi > 0, null, { timeout: 30000 }).catch(() => {});
  st.hi = await page.evaluate(() => window.__yoake.save.hi && window.__yoake.save.hi.sushi);
  st.score = await page.evaluate(() => window.__yoake.arcade.s.score); // it may have caught one more on the way out
  check(st.game === 'sushi' && st.score > 0 && st.hi === st.score, `Sushi Catch played: ${st.score} points, saved as the high score`);
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => !document.body.classList.contains('arcade')), 'Esc puts the controller down');

  // ---- the TV carries its cushion and the console with it
  st = await page.evaluate(() => {
    const d = window.__yoake, tv = d.home.pieces.get('crt'), fc = d.home.pieces.get('famicom'), from = [tv.x, tv.z, tv.rot], [tx, tz] = d.map.test.tvTo;
    d.home.moveTo('crt', tx, tz, 0);
    const r = { fc: [fc.x, fc.z, fc.rot], seat: [tv.seats[0].x, tv.seats[0].z], to: [tx, tz] };
    d.home.moveTo('crt', ...from);
    return r;
  });
  check(st.fc[0] === st.to[0] && Math.abs(st.fc[1] - (st.to[1] - 0.62)) < 0.01 && st.fc[2] === 0 && Math.abs(st.seat[1] - (st.to[1] - 1.25)) < 0.01, `moving the TV brings the Fami-Com and the cushion (${st.fc.join(', ')})`);

  // ---- moving furniture: the bonsai goes somewhere new (and the hearth won't fit on the kotatsu)
  st = await page.evaluate(() => {
    const d = window.__yoake, p = d.home.pieces.get('bonsai'), irori = d.home.pieces.get('irori'), T = d.map.test;
    const blocked = d.home.fits(irori, ...T.iroriNo, 0);
    const [ox, oz] = [p.x, p.z];
    d.service.request('placePiece', 'bonsai', ...T.bonsaiTo);
    const places = d.save.places && d.save.places[d.map.id];
    return { blocked, at: [p.x, p.z, p.rot].join(), want: T.bonsaiTo.join(), solid: d.world.solid(T.bonsaiTo[0], 3.95, T.bonsaiTo[1]), oldClear: !d.world.solid(ox, 3.95, oz), saved: places && places.bonsai };
  });
  check(!st.blocked && st.at === st.want && st.solid && st.oldClear && st.saved, 'furniture moves, takes its collision with it, and the spot is saved');

  // ---- before opening: upgrade the kitchen's stations, hire help, and do the chores
  st = await page.evaluate(() => {
    const d = window.__yoake, s = d.service;
    d.save.devYen = true; s.cashBox = 1e9;
    const label = s.upLabel(s.upNext('tea'));
    for (const k of ['tea', 'tea', 'yakitori', 'yakitori']) s.upBuy(s.upNext(k));
    for (const id of ['staff_wash', 'staff_sushi', 'staff_hall']) s.request('buy', id);
    d.save.devYen = false;
    // the twin taps fill a second cup into your free hand
    s.handCap = 2; s.request('mug'); s.request('urn'); const teas = s.hands.filter((h) => h.type === 'tea').length;
    s.request('drop'); s.request('drop'); s.handCap = 1;
    // a big batch of yakitori plates twice
    const yak = s.stations[0], gy = s.stations[2];
    yak.state = 'cooking'; yak.t = yak.cook; s.update(0.01);
    const left = yak.left;
    s.request('plate'); s.request('station', 0); s.request('drop');
    const still = yak.state;
    s.request('plate'); s.request('station', 0); s.request('drop');
    // sweep every patch, shovel every drift
    for (const kind of ['sweep', 'shovel']) s.chores.left[kind].forEach((_, i) => { for (let k = 0; k < 3; k++) s.request('chore', kind, i); });
    return { label, teas, left, still, after: yak.state, fast: Math.abs(yak.cook / yak.baseCook - 0.75 * gy.cook / gy.baseCook) < 1e-9, bonus: s.priceBonus.tea,
      staff: [...s.staff].length, wages: s.wages, nextTea: s.upNext('tea'), tip: s.tipMul, wait: s.choreP };
  });
  check(/^Upgrade 1\/2: twin urn taps/.test(st.label) && st.teas === 2 && st.bonus === 100 && !st.nextTea, `station upgrades between nights: "${st.label}", two cups at once, gyokuro +¥100`);
  check(st.fast && st.left === 2 && st.still === 'ready' && st.after === 'idle', 'upgraded grills cook 25% faster and a batch plates twice');
  check(st.staff === 3 && st.wages === 2100, 'hired a dishwasher, a sushi chef and a hall server (¥2,100 a night)');
  check(st.tip === 1.3 && st.wait === 1.25, 'sweeping and shovelling before opening: better tips and more patient guests tonight');

  // ---- open the shop and work the night
  await page.evaluate(() => {
    const d = window.__yoake, s = d.service;
    s.request('openShop');
    const stats = window.stats = { ordered: 0, served: 0, belt: 0, washes: 0, kinds: {} };
    const act = (n, ...a) => s.request(n, ...a);
    const atSink = () => d.player.pos.set(d.map.test.sink[0], 0.25, d.map.test.sink[1]);
    let looks = 0;
    window.botStep = () => {
      const H = s.hands;
      // now and then look at the belt the way a player does, so the reticle code runs too
      if (looks++ % 7 === 0) {
        const cam = d.camera, [cp, ct] = d.map.test.beltCam; cam.position.set(...cp); cam.lookAt(...ct); cam.updateMatrixWorld();
        d.interactions.update();
      }
      if (s.washing > 0) { atSink(); return; }
      if (s.has('tub')) { atSink(); act('sink'); act('sink'); stats.washes++; return; }
      if (s.has('clean')) { act('mug'); return; }
      if (!H.length && s.rack.mugs + s.rack.plates > 0 && (s.stock.mugs < 3 || s.stock.plates < 3)) { act('rack'); return; }
      const people = d.crowd.people.filter((q) => q.svc);
      const payer = s.queue[0];
      if (payer && payer.svc.phase === 'pay' && !H.length) { act('register'); return; }
      const orderer = people.find((q) => q.svc.phase === 'order');
      if (orderer && !H.length) { act('cust', orderer.id); stats.ordered++; return; }
      const onBelt = (k) => s.belt.plates.filter((p) => p.type === k).length;
      if (H.length) {
        const k = H[0].type, q = people.find((p) => p.svc.phase === 'food' && p.svc.items.some((i) => !i.done && i.kind === k));
        // guests round the island get it by belt; the window booths get theirs carried
        if (q && s.seatBeltS(q.seat) !== null) { const free = [0.1, 0.45, 0.8, 1.15].find((x) => s.belt.isFree(x)); if (free !== undefined) { act('beltPut', free); stats.belt++; } return; }
        if (q) { act('cust', q.id); stats.served++; stats.kinds[k] = (stats.kinds[k] || 0) + 1; } else act('drop');
        return;
      }
      const want = people.filter((p) => p.svc.phase === 'food').flatMap((p) => p.svc.items.filter((i) => !i.done).map((i) => i.kind));
      const need = (k) => want.filter((w) => w === k).length - onBelt(k);
      for (const k of want) {
        if (need(k) <= 0) continue;
        if (k === 'tea') { if (s.stock.mugs > 0) { act('mug'); act('urn'); return; } continue; }
        if (k === 'sushi' || k === 'onigiri' || k === 'icecream') { if (s.stock.plates > 0) { act('plate'); act(k); return; } continue; }
        const idx = s.stations.map((x, i) => i).filter((i) => s.stations[i].kind === k);
        const ready = idx.find((i) => s.stations[i].state === 'ready');
        if (ready !== undefined && s.stock.plates > 0) { act('plate'); act('station', ready); return; }
        const burnt = idx.find((i) => s.stations[i].state === 'burnt'); if (burnt !== undefined) { act('station', burnt); return; }
        const cooking = idx.filter((i) => s.stations[i].state === 'cooking').length, idle = idx.find((i) => s.stations[i].state === 'idle');
        if (idle !== undefined && cooking < need(k)) { act('station', idle); return; }
      }
      const si = d.crowd.seats.findIndex((seat) => seat.needsBus && !seat.occupant);
      if (si >= 0) act('bus', si);
    };
  });
  check(await page.evaluate(() => !window.__yoake.shift.waiting && !window.__yoake.service.upNext('sushi')), 'turning the sign opens the shop (and closes the upgrade counter)');

  let result = null;
  for (let i = 0; i < 5000 && !result; i++) {
    result = await page.evaluate(() => {
      const d = window.__yoake;
      for (let k = 0; k < 6; k++) { d.crowd.update(0.1); d.service.update(0.1); d.shift.update(0.1); for (const dr of d.doors) dr.update(0.1, [d.player.pos, ...d.crowd.positions()]); }
      window.botStep();
      if (!document.body.classList.contains('summary')) return null;
      const s = d.service;
      return { served: s.served, walkouts: s.walkouts, beltServed: s.beltServed || 0, washed: s.washed, money: s.money, stats: window.stats, save: { ...d.save },
        crew: s.crew.did, card: document.querySelector('#summary').textContent };
    });
  }
  if (!result) throw new Error('the night never ended');
  console.log(`  night 1: served ${result.served} (${result.beltServed} by belt), walked out ${result.walkouts}, washed ${result.washed}, earned ¥${result.money}`);
  console.log(`  dishes served by hand: ${JSON.stringify(result.stats.kinds)}`);
  check(result.served >= 5, 'guests were fed');
  check(result.walkouts <= 1, 'almost nobody walked out');
  check(result.beltServed >= 1, 'the belt delivered at least one dish');
  check(result.washed >= 1, 'dishes were washed');
  check(Object.values(result.crew).some((n) => n > 0) && result.card.includes('¥2,100 in staff wages'), `the staff pitched in (${JSON.stringify(result.crew)}) and were paid at sunrise`);
  check(result.save.night === 2 && result.save.yen > 0, `the save moved on to night 2 with ¥${result.save.yen}`);

  // ---- sunrise, then bed
  await page.waitForTimeout(6000);
  await page.click('#summary [data-act="again"]');
  await page.waitForTimeout(5000);
  st = await page.evaluate(() => { const d = window.__yoake; return { n: d.shift.n, waiting: d.shift.waiting, y: d.player.pos.y, summary: document.body.classList.contains('summary') }; });
  check(st.n === 2 && st.waiting && st.y > 3.5 && !st.summary, 'going to bed wakes you upstairs for night 2, shop closed');

  // ---- reload: the save carries over
  await page.reload(); await ready();
  st = await page.evaluate(() => ({ label: document.querySelector('#screen [data-act="solo"]').textContent, save: JSON.parse(localStorage.getItem('yoake.save')) }));
  check(/night 2/.test(st.label) && st.save.owned.includes('irori'), `after a reload the title offers "${st.label.trim()}" and the purchases are kept`);
  await page.click('#screen [data-act="solo"]');
  st = await page.evaluate(() => { const d = window.__yoake; return { n: d.shift.n, hands: d.service.handCap, placed: [...d.home.placed], menu: [...d.service.menuKinds] }; });
  check(st.n === 2 && st.hands === 2 && st.placed.includes('irori') && st.placed.includes('famicom') && st.menu.includes('tempura'), "night 2 starts with last night's perk and everything you bought");
  st = await page.evaluate(() => { const d = window.__yoake, p = d.home.pieces.get('bonsai'); return { at: [p.x, p.z, p.rot].join(), want: d.map.test.bonsaiTo.join() }; });
  check(st.at === st.want, 'the bonsai is still where you put it');

  // ---- 百鬼夜行: the night parade (a survival mode that leaves the shop's save alone)
  await page.reload(); await ready();
  const saveBefore = await page.evaluate(() => localStorage.getItem('yoake.save'));
  check(await page.evaluate(() => window.__yoake.map.id) === 'tokyo', 'the shop is on the Tokyo street');
  // the parade is played up on the mountain: the menu item reloads onto that map, and a click goes in
  await Promise.all([page.waitForEvent('load', { timeout: 240000 }), page.click('#screen [data-act="parade"]')]);
  await page.waitForFunction(() => window.__yoake && document.querySelector('#screen [data-act="enter"]'), null, { timeout: 240000 });
  check(await page.evaluate(() => window.__yoake.map.id) === 'mountain', 'the night parade loads the snowy mountain');
  await page.click('#screen [data-act="enter"]');
  st = await page.evaluate(() => {
    const d = window.__yoake, P = d.parade;
    d.player.locked = true;
    return { on: !!P, pts: P.points, boards: P.barriers.map((b) => b.boards), x: d.player.pos.x, z: d.player.pos.z, zones: [...P.zones] };
  });
  check(st.on && st.pts === 500 && st.boards.every((n) => n === 6) && st.zones.join() === 'front' && st.z < 0, 'the night parade starts in the boarded-up front room with 500 points');
  // a bot holds the front room with a katana: it turns to the nearest yōkai and cuts
  st = await page.evaluate(() => {
    const d = window.__yoake, P = d.parade, A = P.arsenal, pl = d.player;
    P.hp = P.maxHp = 1e6;
    A.give('katana');
    let tore = false;
    for (let i = 0; i < 3000 && P.round < 3; i++) {
      for (let k = 0; k < 3; k++) { P.update(0.05); pl.update(0.05); }
      if (P.barriers.some((b) => b.boards < 6)) tore = true;
      const t = P.horde.list.filter((k) => k.alive && k.state !== 'rise' && k.state !== 'climb').sort((a, b) => a.pos.distanceTo(pl.pos) - b.pos.distanceTo(pl.pos))[0];
      if (t) {
        pl.yaw = Math.atan2(-(t.pos.x - pl.pos.x), -(t.pos.z - pl.pos.z)); pl.pitch = -0.1; pl.update(0.001);
        if (t.pos.distanceTo(pl.pos) < 1.8) A.attack(pl);
      }
    }
    return { round: P.round, kills: P.kills, tore, points: P.points, limbs: P.limbs, splats: P.gore.sN };
  });
  check(st.round >= 3 && st.kills >= 15 && st.tore && st.splats > 0, `two rounds held: ${st.kills} yōkai cut down, ${st.limbs} limbs taken, boards torn off the windows`);
  st = await page.evaluate(() => {
    const d = window.__yoake, P = d.parade, pl = d.player, I = d.interactions;
    P.points = 10000;
    pl.pos.set(7.9, 0.25, -0.9); pl.update(0.016); pl.yaw = Math.PI; pl.pitch = -0.1; pl.update(0.016); I.update();
    const label = I.hover && I.hover.label();
    P.key('KeyE', true); P.key('KeyE', false);
    return { label, open: P.zones.has('dining'), points: P.points };
  });
  check(/break the seal/.test(st.label || '') && st.open && st.points === 9250, 'breaking an ofuda seal (750) opens the dining room');
  // every fifth round is an oni night: only oni, and they charge
  st = await page.evaluate(() => {
    const d = window.__yoake, P = d.parade, pl = d.player;
    while (P.horde.list.length) { P.horde.list[0].remove(); P.horde.list.shift(); }
    P.round = 4; P.toSpawn = 0; P.breakT = 0.01;
    pl.pos.set(8.0, 0.25, 3.2);
    const states = new Set(), kinds = new Set();
    for (let i = 0; i < 3000 && !states.has('charge'); i++) { P.update(0.05); pl.update(0.05); for (const k of P.horde.list) { states.add(k.state); kinds.add(k.kind); } }
    return { round: P.round, oni: P.oniRound, kinds: [...kinds], charged: states.has('charge') };
  });
  check(st.round === 5 && st.oni && st.kinds.join() === 'oni' && st.charged, `round 5 is an oni night: only oni come, and they charge (${JSON.stringify(st)})`);
  // falling: the night's card
  await page.evaluate(() => { const P = window.__yoake.parade; P.maxHp = 100; P.hp = 1; P.hurt({ dmg: 50, pos: window.__yoake.player.pos.clone(), kind: 'gaki', state: 'attack' }); });
  await page.waitForFunction(() => document.getElementById('zm-over').classList.contains('on'), null, { timeout: 30000 });
  st = await page.evaluate(() => ({ text: document.getElementById('zm-over').textContent, save: localStorage.getItem('yoake.save') }));
  check(/the night parade took you/.test(st.text) && /round 5/.test(st.text) && st.save === saveBefore, "falling ends the night with its card, and the shop's save is untouched");
  // and back to the shop: the street again
  await page.reload(); await ready();
  check(await page.evaluate(() => window.__yoake.map.id) === 'tokyo', 'leaving the parade goes back to the shop on the street');

  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`);
  console.log('PLAYTEST PASSED');
} catch (e) {
  console.error('PLAYTEST FAILED:', e.message);
  if (errors.length) console.error(errors.join('\n'));
  exitCode = 1;
} finally {
  await browser.close();
  srv.close();
}
process.exit(exitCode);
