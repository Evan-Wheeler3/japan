// The night parade with four players: four separate browsers (each its own profile and save) on the local co-op
// server (scripts/coop-server.mjs: the game and the relay). One hosts from the parade's screen; three join from the
// shop's title and are sent on to the mountain. Then: the horde rises on every screen, a guest's kill is decided by
// the host's game and paid to the guest, a guest breaks a seal for everyone, a guest goes down and another gets them
// up, all four go down and the night ends on every screen, and "rise again" brings everyone back with the same code.
// Usage: npm run coop-playtest     (CHROME_PATH=/path/to/chrome to pick a browser; needs port 8787 free)
import { chromium } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';
import { startCoopServer } from './coop-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8787; // (the game looks for the relay here when it's served from anywhere but 8788)
const srv = await startCoopServer(PORT, true);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, what) => { if (!ok) throw new Error(what); console.log(`  ok · ${what}`); };
const ev = (p, f, a) => p.evaluate(f, a);
// four of them is a lot of drawing for a software renderer: nobody's looking, so don't
const quiet = (p) => p.evaluate(() => { window.__yoake.composer.render = () => {}; });
const ready = async (p, sel) => { await p.waitForFunction((s) => window.__yoake && document.querySelector(s), sel, { timeout: 300000 }); await quiet(p); };

let exitCode = 0;
try {
  const pages = [];
  for (let i = 0; i < 4; i++) {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 180 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`player ${i + 1}: ${e.message}`));
    await p.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (r) => r.fulfill({ path: path.join(root, 'node_modules/three', r.request().url().split('three@0.170.0/')[1]), contentType: 'text/javascript' }));
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.goto(`http://localhost:${PORT}/index.html`, { timeout: 300000, waitUntil: 'domcontentloaded' });
    await ready(p, '#screen [data-act="solo"]');
    pages.push(p);
  }
  const [H, ...G] = pages, all = (f, a) => Promise.all(pages.map((p) => ev(p, f, a)));

  // ---- the host: the parade's screen, "with friends"
  await Promise.all([H.waitForEvent('load', { timeout: 300000 }), ev(H, () => window.__yoake.menu.h.onParade())]);
  await ready(H, '#screen [data-act="host"]');
  await ev(H, () => window.__yoake.menu.h.onHost());
  await H.waitForFunction(() => window.__yoake.net && window.__yoake.net.code, null, { timeout: 30000 });
  const code = await ev(H, () => window.__yoake.net.code);
  // ---- three friends join from the shop's title: they're sent up the mountain and join again there
  for (const g of G) {
    const loaded = g.waitForEvent('load', { timeout: 300000 });
    await ev(g, (c) => window.__yoake.menu.h.onJoin(c), code);
    await loaded;
    await g.waitForFunction(() => window.__yoake && window.__yoake.net && window.__yoake.net.id && window.__yoake.map.id === 'mountain', null, { timeout: 300000 });
    await quiet(g);
  }
  await H.waitForFunction(() => window.__yoake.net.players.length === 4, null, { timeout: 30000 });
  check(await ev(H, () => window.__yoake.net.players.length === 4) && (await all(() => window.__yoake.map.id)).every((m) => m === 'mountain'),
    `four in the lobby (code ${code}): the three who joined from the shop were taken up the mountain`);

  // ---- into the night
  await ev(H, () => window.__yoake.menu.h.onStart());
  for (const g of G) await g.waitForFunction(() => window.__yoake.parade && window.__yoake.parade.team, null, { timeout: 30000 });
  await Promise.all(pages.map((p) => p.waitForFunction(() => [...window.__yoake.parade.team.avatars.values()].filter((a) => a.target).length === 3, null, { timeout: 30000 })));
  check((await all(() => window.__yoake.parade.host)).filter(Boolean).length === 1, 'the parade starts for all four, each seeing the other three, with one host');
  await ev(H, () => { window.__yoake.parade.breakT = 0.01; });
  await H.waitForFunction(() => window.__yoake.parade.horde.list.filter((k) => k.alive).length >= 2, null, { timeout: 180000 });
  await sleep(1500);
  const counts = await all(() => [window.__yoake.parade.round, window.__yoake.parade.horde.list.filter((k) => k.alive).map((k) => k.id).sort().join()]);
  check(counts.every(([r, ids]) => r === 1 && ids && ids === counts[0][1]), `round one: the same yōkai (${counts[0][1]}) rise on every screen`);
  check(await ev(H, () => window.__yoake.parade.toSpawn + window.__yoake.parade.horde.list.length) >= 8, 'four players bring more of them (8 in round one, not 4)');

  // ---- a guest's kill: the host's game decides it, everyone sees it, the guest gets the points
  const before = await ev(G[0], () => window.__yoake.parade.points);
  const id = await ev(G[0], () => {
    const P = window.__yoake.parade, k = P.horde.list.find((y) => y.alive);
    P.horde.strike(k, { dmg: 1e9, part: 'torso', gun: true, dir: P.player.pos.clone().set(0, 0, 1) }, { gun: true });
    return k.id;
  });
  await sleep(1500);
  const states = await all((id) => { const k = window.__yoake.parade.horde.byId(id); return k ? k.state : 'gone'; }, id);
  check(states.every((s) => s === 'dead' || s === 'gone') && (await ev(G[0], () => window.__yoake.parade.points)) === before + 60, `a guest's shot kills on every screen and pays the guest (${before} → ${before + 60})`);

  // ---- a guest breaks a seal: open for all of them, paid by the guest alone
  const pts0 = await all(() => window.__yoake.parade.points);
  await ev(G[1], () => { const P = window.__yoake.parade; P.points += 1000; P.buyGate(P.gates.find((g) => g.id === 'partA')); });
  await sleep(1500);
  const gate = await all(() => { const P = window.__yoake.parade; return [P.gates.find((g) => g.id === 'partA').open, P.points]; });
  check(gate.every(([open]) => open) && gate[2][1] === pts0[2] + 1000 - 750 && gate[0][1] === pts0[0] && gate[3][1] === pts0[3],
    'a guest breaks the dining room seal: it opens for everyone, and only they pay the 750');

  // ---- down, and back up
  await ev(G[0], () => { const P = window.__yoake.parade; P.hp = 1; P.hurt({ dmg: 50, kind: 'gaki', state: 'attack', pos: P.player.pos.clone() }); });
  await sleep(1000);
  const seen = await all(() => [...window.__yoake.parade.team.avatars.values()].filter((a) => a.st === 1).length);
  check((await ev(G[0], () => window.__yoake.parade.status)) === 1 && seen.filter((n) => n === 1).length === 3, 'a guest goes down instead of dying, and the other three see it');
  await ev(G[1], () => { const d = window.__yoake, P = d.parade, a = [...P.team.avatars.values()].find((x) => x.st === 1); d.player.pos.set(a.pos.x + 0.6, a.pos.y, a.pos.z); P.keys.KeyE = true; });
  await G[0].waitForFunction(() => window.__yoake.parade.status === 0, null, { timeout: 20000 });
  await ev(G[1], () => { window.__yoake.parade.keys.KeyE = false; });
  check(true, 'another guest stands over them holding E, and they get up');

  // ---- all four down: the night's over on every screen
  await all(() => { const P = window.__yoake.parade; P.hp = 1; P.hurt({ dmg: 50, kind: 'gaki', state: 'attack', pos: P.player.pos.clone() }); });
  await Promise.all(pages.map((p) => p.waitForFunction(() => document.getElementById('zm-over').classList.contains('on'), null, { timeout: 60000 })));
  const card = await ev(H, () => document.querySelectorAll('#zm-over .team .tr').length);
  check(card === 4, 'with all four down the night ends for everyone, the card listing all four');

  // ---- rise again: the host opens up again with the same code, and the others follow
  const loads = pages.map((p) => p.waitForEvent('load', { timeout: 300000 }));
  await ev(H, () => document.querySelector('#zm-over [data-act="again"]').click());
  await Promise.all(loads);
  await H.waitForFunction((c) => window.__yoake && window.__yoake.net && window.__yoake.net.code === c && window.__yoake.net.players.length === 4, code, { timeout: 300000 });
  check(true, `"rise again, all of you": back in the lobby together, the code still ${code}`);

  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`);
  console.log('CO-OP PLAYTEST PASSED');
} catch (e) {
  console.error('CO-OP PLAYTEST FAILED:', e.message);
  if (errors.length) console.error(errors.join('\n'));
  exitCode = 1;
} finally {
  await browser.close();
  srv.close();
}
process.exit(exitCode);
