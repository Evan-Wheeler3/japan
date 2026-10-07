// A long run, for balancing: a bot plays night after night of the real game in a headless browser and logs how the
// shop grows. Between nights it plays the way a sensible player would: learns every recipe and does every milestone
// job the night it comes up, hires help in a sensible order and buys station upgrades, always keeping a reserve back
// for wages. (It doesn't buy anything for the flat: that's for fun, not for the shop.)
// During a night the bot works like the playtest's (taking orders, cooking, the belt, the register, washing,
// restocking, the trash), but it only gets to act every `gap` seconds of game time: the time a person spends walking
// from one thing to the next.
// Usage: node scripts/simulate.mjs [--nights 30] [--gap 2.5] [--out run.json]
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const NIGHTS = +arg('nights', 30), GAP = +arg('gap', 2.5), OUT = arg('out', null), TRACE = +arg('trace', 0);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 160, height: 90 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (r) => r.fulfill({ path: path.join(root, 'node_modules/three', r.request().url().split('three@0.170.0/')[1]), contentType: 'text/javascript' }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
const ready = () => page.waitForFunction(() => window.__yoake && document.querySelector('#screen [data-act="solo"]'), null, { timeout: 240000 });
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`); await ready();
await page.evaluate(() => localStorage.clear()); await page.reload(); await ready();
await page.evaluate(() => document.querySelector('#screen [data-act="solo"]').click()); // (too small a window to click it)

await page.evaluate((GAP) => {
  const d = window.__yoake, s = d.service;
  d.composer.render = () => {}; // nothing to look at: don't spend the time drawing it
  d.save.tutorialDone = true; d.tutorial.stop();
  const act = (n, ...a) => s.request(n, ...a);
  const atSink = () => d.player.pos.set(d.map.test.sink[0], 0.25, d.map.test.sink[1]);
  // one thing at a time, the way you'd do it; true if it did something
  const step = () => {
    const H = s.hands;
    if (s.washing > 0) { atSink(); return 'wash'; }
    if (s.has('tub')) { atSink(); act('sink'); act('sink'); return 'sink'; }
    if (s.has('clean')) { act('mug'); return 'shelve'; }
    if (!H.length && s.rack.mugs + s.rack.plates > 0 && (s.stock.mugs < 3 || s.stock.plates < 3)) { act('rack'); return 'rack'; }
    const people = d.crowd.people.filter((q) => q.svc);
    const payer = s.queue[0];
    if (payer && payer.svc.phase === 'pay' && !H.length) { act('register'); return 'register'; }
    const dry = !H.length && s.supplies.kinds().find((k) => s.supplies.level[k] <= 1);
    if (dry) { if (dry === 'sake') act('kegTake'); else act('crateTake', dry); act('refill', dry); return 'restock'; }
    if (!H.length && s.trash.full() && !(s.staff && s.staff.has('staff_wash'))) { act('trashTake'); act('trashOut', s.trash.station().key); return 'trash'; }
    const orderer = people.find((q) => q.svc.phase === 'order');
    if (orderer && !H.length) { act('cust', orderer.id); return 'order'; }
    if (H.length) {
      const k = H[0].type, q = people.find((p) => p.svc.phase === 'food' && p.svc.items.some((i) => !i.done && i.kind === k));
      if (q && s.seatBeltS(q.seat) !== null) { const free = [0.1, 0.45, 0.8, 1.15].find((x) => s.belt.isFree(x)); if (free !== undefined) act('beltPut', free); return 'belt'; }
      if (q) act('cust', q.id); else act('drop');
      return 'serve';
    }
    const hungry = people.filter((p) => p.svc.phase === 'food'), want = hungry.flatMap((p) => p.svc.items.filter((i) => !i.done).map((i) => i.kind));
    const onBelt = (k) => s.belt.plates.filter((p) => p.type === k).length;
    const count = (k, belt) => hungry.filter((p) => (s.seatBeltS(p.seat) !== null) === belt).reduce((n, p) => n + p.svc.items.filter((i) => !i.done && i.kind === k).length, 0);
    // (what's already on its way: on the belt, on the pass, cooking)
    const coming = (k) => s.counterItems.filter((c) => c.item.type === k).length + s.stations.filter((st) => st.kind === k && st.state !== 'idle' && st.state !== 'burnt').length;
    const need = (k) => count(k, false) + Math.max(0, count(k, true) - onBelt(k)) - coming(k);
    for (const k of want) {
      if (need(k) <= 0 && !s.stations.some((st) => st.kind === k && st.state === 'ready')) continue;
      if (k === 'tea') { if (s.stock.mugs > 0 && s.supplies.ok('tea')) { act('mug'); act('urn'); return 'make'; } continue; }
      if (k === 'sushi' || k === 'onigiri' || k === 'icecream') { if (s.stock.plates > 0 && s.supplies.ok(k)) { act('plate'); act(k); return 'make'; } continue; }
      const idx = s.stations.map((x, i) => i).filter((i) => s.stations[i].kind === k);
      const ready = idx.find((i) => s.stations[i].state === 'ready');
      if (ready !== undefined && s.stock.plates > 0) { act('plate'); act('station', ready); return 'plate'; }
      const burnt = idx.find((i) => s.stations[i].state === 'burnt'); if (burnt !== undefined) { act('station', burnt); return 'scrape'; }
      const idle = idx.find((i) => s.stations[i].state === 'idle');
      if (idle !== undefined && need(k) > 0 && s.supplies.ok(k)) { act('station', idle); return 'fire'; }
    }
    const si = d.crowd.seats.findIndex((seat) => seat.needsBus && !seat.occupant);
    if (si >= 0) { act('bus', si); return 'bus'; }
    return null;
  };
  // a slice of a night: `secs` of game time, the bot acting every GAP seconds (while washing, it just stands there)
  let wait = 0;
  window.simRun = (secs) => {
    const tally = {};
    for (let t = 0; t < secs; t += 0.1) {
      d.crowd.update(0.1); s.update(0.1); d.shift.update(0.1);
      for (const dr of d.doors) dr.update(0.1, [d.player.pos, ...d.crowd.positions(), ...(s.crew ? s.crew.positions() : [])]);
      if ((wait -= 0.1) > 0) continue;
      const what = step();
      tally[what || 'idle'] = (tally[what || 'idle'] || 0) + 1;
      wait = what === 'wash' ? 0.1 : what ? GAP : 0.5; // (nothing to do: look again in a moment)
      if (document.body.classList.contains('summary')) break;
    }
    return { tally, done: document.body.classList.contains('summary') };
  };
  // what each guest thought, and why: how long they waited to order, then for their food
  const review = s.review.bind(s); window.revs = [];
  s.review = (q) => { const v = review(q); window.revs.push([q.svc.orderWait || 0, q.svc.foodWait || 0, v, q.svc.items.map((i) => i.kind).sort().join('+')]); return v; };
  // the night's card, as the game works it out
  const orig = d.shift.onEnd;
  d.shift.onEnd = (r) => { orig(r); window.lastNight = r; };
}, GAP);

// between nights: learn what's there to learn, do the milestone jobs, then spend (keeping a reserve back)
const between = () => page.evaluate(() => {
  const d = window.__yoake, s = d.service, save = d.save, bought = [];
  for (const id of [...(save.pending || [])]) d.ms.complete(id);
  const ORDER = ['staff_wash', 'staff_hall', 'staff_waiter', 'staff_sushi', 'staff_cook', 'staff_stock'];
  const cat = d.catalogData().items, byId = Object.fromEntries(cat.map((c) => [c.id, c]));
  const reserve = (wages) => wages * 2 + 3000;
  for (let guard = 0; guard < 40; guard++) {
    const wages = s.wages || 0;
    const hire = ORDER.find((id) => !s.owned.includes(id) && (id !== 'staff_sushi' || s.menuKinds.has('sushi')));
    const h = hire && byId[hire];
    if (h && save.yen - h.price >= reserve(wages + h.wage)) { d.menu.h.onBuy(hire); bought.push(hire); continue; }
    // otherwise the cheapest station upgrade for something on the menu
    const ups = d.catalogData().items.filter((c) => c.kind === 'station' && !c.owned && !c.blocked && s.menuKinds.has(c.station)).sort((a, b) => a.price - b.price);
    const u = ups[0];
    if (u && save.yen - u.price >= reserve(wages)) { d.menu.h.onBuy(u.id); bought.push(u.id); continue; }
    break;
  }
  return bought;
});

const rows = [];
const t0 = Date.now();
for (let n = 1; n <= NIGHTS; n++) {
  const pre = await page.evaluate(() => { const d = window.__yoake; window.lastNight = null; window.revs = []; d.service.request('openShop'); return { yen: d.save.yen, menu: [...d.service.menuKinds], staff: [...d.service.staff] }; });
  const tally = {};
  let res;
  for (let k = 0; k < 400; k++) {
    res = await page.evaluate(() => window.simRun(60));
    if (n === TRACE) console.log('  ' + await page.evaluate(() => { const d = window.__yoake, s = d.service, c = s.crew;
      const dirty = d.crowd.seats.filter((st) => st.needsBus && !st.occupant).length;
      return `t ${Math.round(d.shift.t)} bin ${s.trash.n}${s.trash.full() ? ' FULL' : ''} overT ${Math.round(s.trash.overT)} dirty ${dirty} dirtyT ${Math.round(s.dirtyT)} sink ${s.sink.mugs + s.sink.plates} stock ${s.stock.mugs}/${s.stock.plates} guests ${d.crowd.people.filter((q) => q.svc).length} · ${Object.values(c.people).filter((p) => c.hired(p.id)).map((p) => `${p.name}:${p.task || '-'}`).join(' ')}`; }));
    for (const [a, c] of Object.entries(res.tally)) tally[a] = (tally[a] || 0) + c;
    if (res.done) break;
  }
  if (!res.done) throw new Error(`night ${n} never ended`);
  const r = await page.evaluate(() => {
    const r = window.lastNight, d = window.__yoake, R = window.revs, avg = (i) => (R.length ? Math.round(R.reduce((a, x) => a + x[i], 0) / R.length * 10) / 10 : 0);
    const by = {}; for (const [, f, , k] of R) (by[k] ||= []).push(f);
    const waitBy = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, [v.length, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]]));
    return { orderWait: avg(0), foodWait: avg(1), review: avg(2), waitBy, fed: r.fed, walkouts: r.walkouts, earned: r.earned, wages: r.wages, supplies: r.supplies, tips: r.tips, rating: r.rating, shop: r.shop,
      milestones: (r.milestones || []).map((m) => m.id), burnt: r.burnt, yen: d.save.yen, served: d.save.served, hits: r.hits };
  });
  const bought = await between();
  const acts = Object.values(tally).reduce((a, b) => a + b, 0), idle = tally.idle || 0;
  const row = { n, ...r, bought, yenAfter: await page.evaluate(() => window.__yoake.save.yen), menu: pre.menu.length, staff: pre.staff.length, idleShare: +(idle / Math.max(1, acts)).toFixed(2), tally };
  rows.push(row);
  console.log(`night ${String(n).padStart(2)}: fed ${String(r.fed).padStart(3)} out ${String(r.walkouts).padStart(2)} ★${r.rating.toFixed(1)} (shop ${r.shop.toFixed(2)}) (waits ${r.orderWait}s/${r.foodWait}s) net ¥${String(r.earned).padStart(6)} wages ¥${r.wages} supplies ¥${r.supplies} → ¥${row.yenAfter} | menu ${pre.menu.length} staff ${pre.staff.length} idle ${Math.round(row.idleShare * 100)}%${r.milestones.length ? ` | ms: ${r.milestones.join(', ')}` : ''}${bought.length ? ` | bought: ${bought.join(', ')}` : ''}`);
  // to bed, and the next evening (without the fades)
  await page.evaluate(() => { const d = window.__yoake; d.sunriseEnd(); document.body.classList.remove('summary'); d.beginNight(d.save.night); d.save.tutorialDone = true; d.tutorial.stop(); });
}
console.log(`(${NIGHTS} nights in ${Math.round((Date.now() - t0) / 1000)} s, an action every ${GAP} s)`);
if (OUT) writeFileSync(OUT, JSON.stringify({ gap: GAP, rows }, null, 1));
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'));
await browser.close(); srv.close();
