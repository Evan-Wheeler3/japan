// End-to-end playtest: a bot plays the whole loop in a headless browser and checks it holds together.
//   wake upstairs → buy from the catalog → open the shop → work a full night (by hand and by belt,
//   cooking every dish, washing up) → sunrise and the night's card → go to bed → wake for night 2
//   → reload and check the save carried over.
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
    d.save.yen = 30000;
    for (const id of ['onigiri', 'tempura', 'ramen', 'beltMotor', 'irori', 'telescope', 'catbed']) d.menu.h.onBuy(id);
    return { owned: d.service.owned, menu: [...d.service.menuKinds], speed: d.service.belt.speed, placed: [...d.home.placed], yen: d.save.yen };
  });
  check(st.owned.length === 7 && st.menu.includes('ramen') && st.speed > 0.5 && st.placed.includes('irori'), `bought ${st.owned.join(', ')} (¥${st.yen} left)`);

  // ---- open the shop and work the night
  await page.evaluate(() => {
    const d = window.__yoake, s = d.service;
    s.request('openShop');
    const stats = window.stats = { ordered: 0, served: 0, belt: 0, washes: 0, kinds: {} };
    const act = (n, ...a) => s.request(n, ...a);
    const atSink = () => d.player.pos.set(5.9, 0.25, 12.3);
    window.botStep = () => {
      const H = s.hands;
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
        if (q && q.seat.kind === 'stool') { const free = [0.1, 0.45, 0.8, 1.15].find((x) => s.belt.isFree(x)); if (free !== undefined) { act('beltPut', free); stats.belt++; } return; }
        if (q) { act('cust', q.id); stats.served++; stats.kinds[k] = (stats.kinds[k] || 0) + 1; } else act('drop');
        return;
      }
      const want = people.filter((p) => p.svc.phase === 'food').flatMap((p) => p.svc.items.filter((i) => !i.done).map((i) => i.kind));
      const need = (k) => want.filter((w) => w === k).length - onBelt(k);
      for (const k of want) {
        if (need(k) <= 0) continue;
        if (k === 'tea') { if (s.stock.mugs > 0) { act('mug'); act('urn'); return; } continue; }
        if (k === 'sushi' || k === 'onigiri') { if (s.stock.plates > 0) { act('plate'); act(k); return; } continue; }
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
  check(await page.evaluate(() => !window.__yoake.shift.waiting), 'turning the sign opens the shop');

  let result = null;
  for (let i = 0; i < 5000 && !result; i++) {
    result = await page.evaluate(() => {
      const d = window.__yoake;
      for (let k = 0; k < 6; k++) { d.crowd.update(0.1); d.service.update(0.1); d.shift.update(0.1); for (const dr of d.doors) dr.update(0.1, [d.player.pos, ...d.crowd.positions()]); }
      window.botStep();
      if (!document.body.classList.contains('summary')) return null;
      const s = d.service;
      return { served: s.served, walkouts: s.walkouts, beltServed: s.beltServed || 0, washed: s.washed, money: s.money, stats: window.stats, save: { ...d.save } };
    });
  }
  if (!result) throw new Error('the night never ended');
  console.log(`  night 1: served ${result.served} (${result.beltServed} by belt), walked out ${result.walkouts}, washed ${result.washed}, earned ¥${result.money}`);
  console.log(`  dishes served by hand: ${JSON.stringify(result.stats.kinds)}`);
  check(result.served >= 5, 'guests were fed');
  check(result.walkouts <= 1, 'almost nobody walked out');
  check(result.beltServed >= 1, 'the belt delivered at least one dish');
  check(result.washed >= 1, 'dishes were washed');
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
  check(st.n === 2 && st.hands === 2 && st.placed.includes('irori') && st.menu.includes('tempura'), "night 2 starts with last night's perk and everything you bought");

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
