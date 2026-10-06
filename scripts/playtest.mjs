// End-to-end playtest: a bot plays the whole loop in a headless browser and checks it holds together.
//   start in the street where the title camera was, walk to the shop (the tutorial follows along) → up to the flat
//   → buy from the catalog (the TV, the Fami-Com and its games) → milestones: the drinks fridge arrives, the back door
//   is shovelled out, two locks picked → play the Fami-Com → station upgrades → open the shop → work a full night
//   (by hand and by belt, cooking every dish, washing up) → sunrise and the night's card → learn nigiri on it by
//   dragging the ingredients onto the dish → go to bed → wake for night 2
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

  // ---- evening: the menu goes and you're standing in the street where its camera was, the shop closed
  await page.click('#screen [data-act="solo"]');
  let st = await page.evaluate(() => { const d = window.__yoake, T = d.map.shop.title; return { y: d.player.pos.y, at: Math.hypot(d.player.pos.x - T.x, d.player.pos.z - T.z), waiting: d.shift.waiting, n: d.shift.n, tut: d.tutorial.on && document.getElementById('tut').classList.contains('on') }; });
  check(st.y < 1 && st.at < 0.01 && st.waiting && st.n === 1 && st.tut, 'night 1 starts in the street, right where the title camera was, shop closed, the tutorial up');
  // a walker for the bot: real input and collision, no teleporting
  await page.evaluate(() => {
    window.walkTo = (wx, wz) => {
      const pl = window.__yoake.player; let best = 1e9, still = 0, t = 0;
      for (;;) {
        const dx = wx - pl.pos.x, dz = wz - pl.pos.z, dist = Math.hypot(dx, dz);
        if (dist < 0.15) break;
        pl.locked = true; pl.keys = { KeyW: true }; pl.yaw = Math.atan2(-dx, -dz); pl.update(1 / 30); t += 1 / 30;
        if (dist < best - 0.01) { best = dist; still = 0; } else still += 1 / 30;
        if (still > 1.5 || t > 60) break;
      }
      pl.keys = {}; pl.locked = false;
      return [pl.pos.x, pl.pos.y, pl.pos.z].map((v) => +v.toFixed(2));
    };
  });
  // across the street to the door: the tutorial ticks off its first step and points at the sign
  // (headless, nothing has the pointer, so the game's own loop is paused: the bot ticks the tutorial itself)
  st = await page.evaluate(() => { const d = window.__yoake, S = d.map.shop.sign.pos; const at = window.walkTo(S[0], S[2] - 1.0); d.tutorial.update(0.05); return { at, step: d.tutorial.i }; });
  check(st.step === 1, `walked across the street to the shop's door on foot (${st.at.join(', ')}): the tutorial moves on to the sign`);
  await page.evaluate(() => { const d = window.__yoake, W = d.map.shop.wake; d.player.pos.set(W.x, 3.75, W.z); d.player.vel.set(0, 0, 0); });
  // ---- on foot (no teleporting): down the stairs to the shop and back up, with real input and collision
  st = await page.evaluate(() => {
    const d = window.__yoake, pl = d.player, routes = d.map.test.walk || [], log = [];
    for (const path of routes) for (const [wx, wz, wy] of path) {
      let best = 1e9, still = 0, t = 0;
      for (;;) {
        const dx = wx - pl.pos.x, dz = wz - pl.pos.z, dist = Math.hypot(dx, dz);
        if (dist < 0.15) break;
        pl.locked = true; pl.keys = { KeyW: true }; pl.yaw = Math.atan2(-dx, -dz); pl.update(1 / 30); t += 1 / 30;
        if (dist < best - 0.01) { best = dist; still = 0; } else still += 1 / 30;
        if (still > 1.5 || t > 60) { pl.keys = {}; pl.locked = false; return { ok: false, at: [pl.pos.x, pl.pos.y, pl.pos.z].map((v) => +v.toFixed(2)), to: [wx, wz] }; }
      }
      if (wy !== undefined && Math.abs(pl.pos.y - wy) > 0.2) { pl.keys = {}; pl.locked = false; return { ok: false, floor: pl.pos.y, want: wy }; }
      log.push(wx);
    }
    pl.keys = {}; pl.locked = false;
    return { ok: true, legs: log.length };
  });
  check(st.ok, `walking down the stairs into the shop and back up to the flat works on foot (${JSON.stringify(st)})`);

  // ---- the catalog: things for home (recipes and the shop's kit aren't for sale: they come with milestones)
  st = await page.evaluate(() => {
    const d = window.__yoake;
    d.save.yen = 150000;
    for (const id of ['onigiri', 'beltMotor', 'freezer', 'up_tea2']) d.menu.h.onBuy(id); // milestones, and a level two before level one: refused
    const early = d.service.owned.length;
    for (const id of ['irori', 'telescope', 'catbed', 'crt', 'famicom', 'game_dash', 'game_koi', 'game_daruma']) d.menu.h.onBuy(id);
    return { early, owned: d.service.owned, placed: [...d.home.placed], games: d.arcade.owned, yen: d.save.yen };
  });
  check(st.early === 0, "recipes and kit can't be bought, and a level-two upgrade waits for level one");
  check(st.owned.length === 8 && st.placed.includes('irori') && st.games.length === 4, `bought ${st.owned.join(', ')} (¥${st.yen} left)`);
  // ---- milestones: what the shop's record reaches. Kit arrives on its own; recipes and jobs go on the to-do list
  st = await page.evaluate(async () => {
    const M = await import('/src/home.js');
    const save = { pending: [] }, owned = [];
    const got = M.reachMilestones(save, owned, { served: 45, nights: 3, rating: 3 }).map((m) => m.id);
    const again = M.reachMilestones(save, owned, { served: 45, nights: 3, rating: 3 }).length;
    const ladder = M.STATION_UPS.every((u) => u.track === 's' || u.track === 'v');
    return { got, owned, pending: save.pending, again, ladder };
  });
  check(st.got.join() === 'sushi,dishes,onigiri,fridge,backdoor' && st.owned.join() === 'dishes,fridge' && st.pending.join() === 'sushi,onigiri,backdoor' && st.again === 0 && st.ladder,
    `45 guests and 3 nights reach ${st.got.join(', ')}: the kit arrives, the recipes and the back door wait to be done`);

  // ---- dev: the ` key toggles a cash box that never runs out
  await page.keyboard.press('Backquote');
  st = await page.evaluate(() => { const d = window.__yoake, before = d.save.yen; d.menu.h.onBuy('bonsai'); return { dev: d.save.devYen, spent: before - d.save.yen, owned: d.service.owned.includes('bonsai') }; });
  await page.keyboard.press('Backquote');
  check(st.dev && st.spent === 0 && st.owned && !(await page.evaluate(() => window.__yoake.save.devYen)), 'the dev switch buys for free and toggles back off');
  st = await page.evaluate(() => { const d = window.__yoake; d.ms.complete('fridge'); return { drink: d.service.drinkBill }; });
  check(st.drink === 250, 'the drinks fridge (a milestone) puts ¥250 on every bill');
  // ---- the property, by milestone: shovel the drift off the back door (the fire escape opens for it), then pick
  // the freezer's lock and the kura's padlock. Each is a little full-screen game; the bot plays them to the end.
  const finishMini = async () => {
    await page.waitForFunction(() => document.getElementById('mini').classList.contains('on') && window.__yoake.mini.debugWin, null, { timeout: 30000 });
    await page.evaluate(() => window.__yoake.mini.debugWin());
    await page.waitForSelector('#mini .mg-done [data-act="ok"]', { timeout: 30000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('#mini .mg-done [data-act="ok"]').click());
    await page.waitForFunction(() => !document.getElementById('mini').classList.contains('on'), null, { timeout: 10000 });
  };
  const actOn = (re) => page.evaluate((src) => {
    const d = window.__yoake, re = new RegExp(src);
    const it = d.interactions.items.find((x) => { try { return (!x.enabled || x.enabled()) && re.test(x.label()); } catch { return false; } });
    if (!it) return false; d.mini.debugWin = null; it.act(); return true;
  }, re.source);
  st = await page.evaluate(() => {
    const d = window.__yoake, locked = () => d.doors.filter((x) => x.spec.needs).map((x) => x.locked), fire = d.doors.find((x) => x.spec.opensWith);
    const r = { before: locked(), fireBefore: !fire || fire.locked };
    d.save.pending = ['backdoor', 'freezer']; d.ms.apply();
    r.fireAfter = !fire || !fire.locked;
    return r;
  });
  check(st.before.every(Boolean) && st.fireBefore && st.fireAfter, 'the property starts locked up; the back door job opens the fire escape down to the yard');
  check(await actOn(/^Shovel the drift/), 'the drift on the back door can be shovelled');
  await finishMini();
  check(await actOn(/^Pick the lock .*mochi ice cream/), "the walk-in freezer's lock can be picked");
  await finishMini();
  st = await page.evaluate(() => { const d = window.__yoake; d.save.pending.push('kura'); d.ms.apply(); return true; });
  check(await actOn(/^Pick the lock .*(kura|shed)/), "the kura's padlock can be picked");
  await finishMini();
  st = await page.evaluate(() => {
    const d = window.__yoake, B = d.map.shop.crowd.back;
    return { after: d.doors.filter((x) => x.spec.needs).map((x) => x.locked), pending: d.save.pending, ice: d.service.menuKinds.has('icecream'), drink: d.service.drinkBill, extra: d.service.extraGuests,
      back: !B || !B.spawn || d.crowd.spawns.some((sp) => sp[0] === B.spawn[0] && sp[1] === B.spawn[1]), saved: JSON.parse(localStorage.getItem('yoake.save')).owned };
  });
  check(st.after.every((l) => !l) && !st.pending.length && st.ice && st.drink === 650 && st.extra === 1 && st.back && ['backdoor', 'freezer', 'kura'].every((id) => st.saved.includes(id)),
    'shovelling and two picked locks open the back door, the freezer and the kura: mochi ice cream, house sake and more guests');

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
    const places = d.save.places && d.save.places[d.map.homeKey || d.map.id];
    return { blocked, at: [p.x, p.z, p.rot].join(), want: T.bonsaiTo.join(), solid: d.world.solid(T.bonsaiTo[0], 3.95, T.bonsaiTo[1]), oldClear: !d.world.solid(ox, 3.95, oz), saved: places && places.bonsai };
  });
  check(!st.blocked && st.at === st.want && st.solid && st.oldClear && st.saved, 'furniture moves, takes its collision with it, and the spot is saved');

  // ---- before opening: upgrade the kitchen's stations and hire help
  st = await page.evaluate(() => {
    const d = window.__yoake, s = d.service;
    d.save.devYen = true; s.cashBox = 1e9;
    const label = s.upLabel(s.upNext('tea')), yLabel = s.upLabel(s.upNext('yakitori'));
    for (const k of ['tea', 'tea', 'yakitori', 'yakitori']) s.upBuy(s.upNext(k));
    for (const id of ['staff_wash', 'staff_sushi', 'staff_hall']) s.request('buy', id);
    d.save.devYen = false;
    d.ms.complete('beltMotor'); // (a milestone at 85 guests: the bot sends everything it can down the belt)
    const yak = s.stations.find((x) => x.kind === 'yakitori'), gy = s.stations.find((x) => x.kind === 'gyoza');
    return { label, yLabel, fast: Math.abs(yak.cook / yak.baseCook - 0.8 * gy.cook / gy.baseCook) < 1e-9, tea: s.priceBonus.tea, yak: s.priceBonus.yakitori, batch: yak.batch,
      staff: [...s.staff].length, wages: s.wages, nextTea: s.upLabel(s.upNext('tea')), sushi: !s.upNext('sushi') };
  });
  check(/^Upgrade 1\/3 · value: gyokuro leaves \(\+¥50 a dish\)/.test(st.label) && /^Upgrade 1\/4 · speed: bamboo fans/.test(st.yLabel) && st.tea === 130 && /^Upgrade 3\/3 · value/.test(st.nextTea),
    `station upgrades between nights are speed or value: "${st.label}", tea now +¥${st.tea} a cup`);
  check(st.fast && st.yak === 150 && st.batch === 1 && st.sushi, 'the grill cooks a fifth faster and its yakitori earns ¥150 more (no sushi upgrades until the recipe)');
  check(st.staff === 3 && st.wages === 4800, 'hired a dishwasher, a sushi chef and a cashier (¥4,800 a night)');

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
      const hungry = people.filter((p) => p.svc.phase === 'food'), want = hungry.flatMap((p) => p.svc.items.filter((i) => !i.done).map((i) => i.kind));
      // what's on the belt only covers the guests along it; the booths it doesn't reach need theirs made and carried
      const count = (k, belt) => hungry.filter((p) => (s.seatBeltS(p.seat) !== null) === belt).reduce((n, p) => n + p.svc.items.filter((i) => !i.done && i.kind === k).length, 0);
      const need = (k) => count(k, false) + Math.max(0, count(k, true) - onBelt(k));
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
  check(await page.evaluate(() => !window.__yoake.shift.waiting && !window.__yoake.service.upNext('tea')), 'turning the sign opens the shop (and closes the upgrade counter)');

  let result = null;
  for (let i = 0; i < 5000 && !result; i++) {
    result = await page.evaluate(() => {
      const d = window.__yoake;
      for (let k = 0; k < 6; k++) { d.crowd.update(0.1); d.service.update(0.1); d.shift.update(0.1); d.tutorial.update(0.1); for (const dr of d.doors) dr.update(0.1, [d.player.pos, ...d.crowd.positions()]); }
      window.botStep();
      if (!document.body.classList.contains('summary')) return null;
      const s = d.service;
      return { served: s.served, walkouts: s.walkouts, beltServed: s.beltServed || 0, washed: s.washed, money: s.money, stats: window.stats, save: { ...d.save },
        crew: s.crew.did, card: document.querySelector('#summary').textContent, tut: d.tutorial.i, learn: !!document.querySelector('#summary [data-learn="sushi"]') };
    });
  }
  if (!result) throw new Error('the night never ended');
  console.log(`  night 1: served ${result.served} (${result.beltServed} by belt), walked out ${result.walkouts}, washed ${result.washed}, earned ¥${result.money}`);
  console.log(`  dishes served by hand: ${JSON.stringify(result.stats.kinds)}`);
  check(result.served >= 5, 'guests were fed');
  check(result.walkouts <= 1, 'almost nobody walked out');
  check(result.beltServed >= 1, 'the belt delivered at least one dish');
  check(result.washed >= 1, 'dishes were washed');
  check(Object.values(result.crew).some((n) => n > 0) && result.card.includes('¥4,800 in staff wages'), `the staff pitched in (${JSON.stringify(result.crew)}) and were paid at sunrise`);
  check(result.save.night === 2 && result.save.yen > 0, `the save moved on to night 2 with ¥${result.save.yen}`);
  check(typeof result.save.rating === 'number' && /the shop's rating/.test(result.card) && /the goal/.test(result.card), `the night was rated and the shop's rating saved (★${result.save.rating})`);
  check(result.tut >= 3 && result.save.tutorialDone, `the tutorial followed the night along (to step ${result.tut + 1}) and won't come back`);
  check(result.save.served >= 6 && result.save.pending.includes('sushi') && result.learn, `${result.save.served} guests served: the nigiri milestone is on the card, ready to learn`);

  // ---- learn nigiri: the card's button opens the recipe game; drag the ingredients onto the dish in order
  await page.waitForTimeout(6000);
  await page.click('#summary [data-learn="sushi"]');
  await page.waitForFunction(() => document.getElementById('mini').classList.contains('on') && document.querySelector('#mini .mg-tile'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const steps = await page.evaluate(async () => (await import('/src/minigames.js')).RECIPES.sushi.steps);
  const drag = async (k) => {
    const a = await page.locator(`#mini .mg-tile[data-k="${k}"]`).boundingBox(), b = await page.locator('#mini .mg-dish').boundingBox();
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
    await page.mouse.move(ax, ay); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8);
    await page.mouse.up(); await page.waitForTimeout(400);
  };
  await drag(steps[1]); // the wrong one first: it bounces back
  st = await page.evaluate(() => ({ tries: document.querySelector('#mini .mg-tries').textContent, used: document.querySelectorAll('#mini .mg-tile.used').length }));
  check(/1 wrong turn/.test(st.tries) && st.used === 0, `dropping the ${steps[1]} on first sends it back to the tray`);
  for (const k of steps) await drag(k);
  await page.waitForSelector('#mini .mg-done [data-act="ok"]', { timeout: 30000 });
  await page.waitForTimeout(300);
  await page.click('#mini .mg-done [data-act="ok"]');
  st = await page.evaluate(() => { const d = window.__yoake; return { menu: d.service.menuKinds.has('sushi'), saved: JSON.parse(localStorage.getItem('yoake.save')).owned.includes('sushi'), pending: d.save.pending, open: document.getElementById('mini').classList.contains('on') }; });
  check(st.menu && st.saved && !st.pending.includes('sushi') && !st.open, `${steps.join(', ')}: nigiri learned by hand, on the menu from tomorrow`);

  // ---- sunrise, then bed
  await page.click('#summary [data-act="again"]');
  await page.waitForTimeout(5000);
  st = await page.evaluate(() => { const d = window.__yoake; return { n: d.shift.n, waiting: d.shift.waiting, y: d.player.pos.y, summary: document.body.classList.contains('summary') }; });
  check(st.n === 2 && st.waiting && st.y > 3.5 && !st.summary, 'going to bed wakes you upstairs for night 2, shop closed');

  // ---- reload: the save carries over
  await page.reload(); await ready();
  st = await page.evaluate(() => ({ label: document.querySelector('#screen [data-act="solo"]').textContent, save: JSON.parse(localStorage.getItem('yoake.save')) }));
  check(/night 2/.test(st.label) && st.save.owned.includes('irori'), `after a reload the title offers "${st.label.trim()}" and the purchases are kept`);
  await page.click('#screen [data-act="solo"]');
  st = await page.evaluate(() => { const d = window.__yoake, T = d.map.shop.title; return { n: d.shift.n, hands: d.service.handCap, placed: [...d.home.placed], menu: [...d.service.menuKinds], street: Math.hypot(d.player.pos.x - T.x, d.player.pos.z - T.z) < 0.01, tut: d.tutorial.on }; });
  check(st.n === 2 && st.hands === 2 && st.placed.includes('irori') && st.placed.includes('famicom') && st.menu.includes('sushi') && st.menu.includes('icecream') && st.street && !st.tut,
    "night 2 starts in the street (no tutorial this time) with last night's perk, the nigiri and everything you got");
  st = await page.evaluate(() => { const d = window.__yoake, p = d.home.pieces.get('bonsai'); return { at: [p.x, p.z, p.rot].join(), want: d.map.test.bonsaiTo.join() }; });
  check(st.at === st.want, 'the bonsai is still where you put it');

  // ---- night 2: all five hired, and nobody playing. The shop runs itself
  st = await page.evaluate(() => {
    const d = window.__yoake, s = d.service;
    d.save.devYen = true; s.cashBox = 1e9;
    for (const id of ['staff_waiter', 'staff_cook']) s.request('buy', id);
    d.save.devYen = false;
    for (const id of ['dishes', 'dishes2']) d.ms.complete(id); // (a five-star crowd needs the full set of tableware)
    s.request('openShop');
    d.player.pos.set(9, 3.75, 4); // upstairs, out of the way
    return { staff: [...s.staff].length, wages: s.wages };
  });
  check(st.staff === 5 && st.wages === 10000, 'hired the waiter and the cook as well: all five (¥10,000 a night)');
  result = null;
  for (let i = 0; i < 6000 && !result; i++) {
    result = await page.evaluate(() => {
      const d = window.__yoake, s = d.service;
      for (let k = 0; k < 8; k++) { d.crowd.update(0.1); s.update(0.1); d.shift.update(0.1); for (const dr of d.doors) dr.update(0.1, [d.player.pos, ...d.crowd.positions(), ...s.crew.positions()]); }
      if (!document.body.classList.contains('summary')) return null;
      return { served: s.served, walkouts: s.walkouts, crew: s.crew.did, bags: s.trash.bags, save: { ...d.save }, card: document.querySelector('#summary').textContent };
    });
  }
  if (!result) throw new Error('night 2 never ended');
  console.log(`  night 2 (nobody playing): served ${result.served}, walked out ${result.walkouts}, crew ${JSON.stringify(result.crew)}`);
  const c = result.crew;
  check(result.served >= 10 && result.walkouts <= Math.max(3, result.served / 4), 'with all five hired the shop runs itself: guests fed, few walkouts');
  check(c.orders > 0 && c.served > 0 && c.bussed > 0 && c.washed > 0 && c.cooked > 0 && c.sushi > 0 && c.rang > 0, 'everyone pitched in: orders, cooking, sushi, serving, bussing, washing, the register');

  // ---- 百鬼夜行: the night parade (a survival mode that leaves the shop's save alone)
  await page.reload(); await ready();
  const saveBefore = await page.evaluate(() => localStorage.getItem('yoake.save'));
  check(await page.evaluate(() => window.__yoake.map.id) === 'tokyo', 'the shop is on the Tokyo street');
  // the parade is played up on the mountain: the menu item reloads onto that map, and a click goes in
  // (clicked from the page: at this tiny size, the card with your lifetime stats can sit over the menu)
  await Promise.all([page.waitForEvent('load', { timeout: 240000 }), page.evaluate(() => document.querySelector('#screen [data-act="parade"]').click())]);
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
  // (rounds one and two bring 4 and 6)
  check(st.round >= 3 && st.kills >= 10 && st.tore && st.splats > 0, `two rounds held: ${st.kills} yōkai cut down, ${st.limbs} limbs taken, boards torn off the windows`);
  st = await page.evaluate(() => {
    const d = window.__yoake, P = d.parade, pl = d.player, I = d.interactions;
    P.points = 10000;
    pl.pos.set(7.9, 0.25, -0.9); pl.update(0.016); pl.yaw = Math.PI; pl.pitch = -0.1; pl.update(0.016); I.update();
    const label = I.hover && I.hover.label();
    P.key('KeyE', true); P.key('KeyE', false);
    return { label, open: P.zones.has('dining'), both: P.gates.filter((g) => g.zone === 'dining').every((g) => g.open), points: P.points };
  });
  check(/break the seal/.test(st.label || '') && st.open && st.both && st.points === 9250, 'breaking an ofuda seal (750) opens the dining room: both its doorways');
  // the rules, as in Black Ops (solo): how many come and how fast
  st = await page.evaluate(async () => {
    const M = await import('/src/survival/mode.js');
    return { counts: [1, 2, 3, 4, 5, 6, 10].map(M.roundCount), d1: M.spawnDelay(1), d56: M.spawnDelay(56), oni: [5, 10, 15].map(M.oniCount), hp: [1, 10].map((r) => Math.round(M.roundHealth(r))) };
  });
  check(st.counts.join() === '4,6,10,14,19,21,26' && st.d1 === 2.75 && st.d56 === 0.3 && st.oni.join() === '2,3,4' && st.hp.join() === '100,756',
    `rounds follow Black Ops, eased: ${st.counts.join(', ')} come, ${st.d1} s apart on round one, ${st.d56} s by round 56; oni ${st.oni.join(', ')}`);
  // the power: the machines are dark until the breaker in the washrooms' hall is thrown
  st = await page.evaluate(() => {
    const d = window.__yoake, P = d.parade, before = P.points;
    P.buyPerk(P.perkMachines.find((m) => m.P.id === 'tetsu').P);
    const refused = P.points === before && !P.perks.has('tetsu');
    P.powerOn();
    return { refused, power: P.power };
  });
  check(st.refused && st.power, "the blessings stay dark (and won't sell) until the power's thrown");
  // a fire-pot: thrown, it bounces, goes off, and takes the yōkai near it apart
  st = await page.evaluate(() => {
    const d = window.__yoake, P = d.parade, pl = d.player, G = P.grenades;
    while (P.horde.list.length) { P.horde.list[0].remove(); P.horde.list.shift(); }
    pl.pos.set(8.0, 0.25, -1.0); pl.yaw = 0; pl.pitch = -0.35; pl.update(0.016); d.camera.updateMatrixWorld();
    const st = P.roundStats(2, 'gaki');
    const ks = [0, 1, 2].map((i) => P.horde.spawn('gaki', 7.4 + i * 0.6, 0.25, -2.6, st, { look: i }));
    for (const k of ks) { k.state = 'idle'; k.riseT = 9; }
    const left = G.left, kills = P.kills; G.throw(d.camera);
    for (let i = 0; i < 60; i++) { G.update(0.05); P.gore.update(0.05); }
    return { used: left - G.left, killed: ks.filter((k) => !k.alive).length, limbs: ks.reduce((a, k) => a + Object.values(k.limbs).filter((v) => v === false).length, 0), kills: P.kills - kills };
  });
  check(st.used === 1 && st.killed >= 2 && st.limbs >= 2, `a fire-pot goes off: ${st.killed} of 3 yōkai blown apart (${st.limbs} pieces off)`);
  // the new wall buys are up, and space jumps
  st = await page.evaluate(() => {
    const d = window.__yoake, P = d.parade, pl = d.player;
    const ids = P.buys.map((b) => b.id);
    pl.pos.set(8.0, 0.25, -1.0); pl.vel.set(0, 0, 0); pl.update(0.05);
    pl.keys.Space = true; let top = pl.pos.y; for (let i = 0; i < 20; i++) { pl.update(0.02); top = Math.max(top, pl.pos.y); } pl.keys.Space = false;
    for (let i = 0; i < 60; i++) pl.update(0.02);
    return { ids, jump: top - 0.25, back: Math.abs(pl.pos.y - 0.25) < 0.01 };
  });
  check(['type100', 'type96', 'odachi'].every((id) => st.ids.includes(id)) && st.jump > 0.6 && st.back, `the automatic wall buys and the ōdachi are up; space jumps ${st.jump.toFixed(2)} m and lands`);
  // a blessing: the machine takes your points, you drink, and it shows in the corner
  st = await page.evaluate(() => {
    const d = window.__yoake, P = d.parade;
    const before = P.points; P.buyPerk(P.perkMachines.find((m) => m.P.id === 'tetsu').P);
    return { spent: before - P.points, max: P.maxHp, drinking: P.arsenal.drinkT > 0, hud: document.querySelector('.zm-perks').textContent };
  });
  check(st.spent === 2500 && st.max === 250 && st.drinking && st.hud.includes('鉄'), 'the Tetsu machine (2,500): you drink, and can take two and a half times the punishment');
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
