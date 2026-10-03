// End-to-end playtest: a bot plays one full night through the real raycast/click interaction system.
// Counter guests are served via the conveyor belt, tables by hand; dishes are collected and washed.
// Usage: npm run playtest   (set CHROME_PATH to use a specific Chromium build)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = `${server.resolvedUrls.local[0]}?debug`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

let exitCode = 0;
try {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.yoake, null, { timeout: 60000 });

  await page.evaluate(() => {
    const g = window.yoake;
    localStorage.clear();
    g.enterPrep();
    g.player.controls.isLocked = true;
    const V = g.camera.position.constructor;
    const stats = { beltPlaced: 0, beltDelivered: 0, handServed: 0, washed: 0, collected: 0 };
    window.botStats = stats;
    const use = (stand, look) => {
      g.player.teleport({ x: stand[0], y: 0, z: stand[1] }, 0);
      g.camera.lookAt(new V(...look));
      g.scene.updateMatrixWorld();
      g.interaction.update(g.camera, true);
      if (!g.interaction.hovered) return false;
      g.interaction.click();
      return true;
    };
    const station = (id) => g.stations.find((s) => s.def.id === id);
    const atStation = (id) => {
      const p = station(id).root.position;
      return use([p.x + 1.15, p.z], [p.x + 0.1, 1.05, p.z]);
    };
    const atSpot = (s) => {
      const d = s.def;
      if (d.kind === 'counter') return use([d.x, d.side * 2.3], [d.x, 1.0, d.side * 1.1]);
      return use([d.x, d.z < 0 ? -2.2 : 2.2], [d.x, 0.8, d.z]);
    };
    const atSink = () => {
      const p = g.sink.root.position;
      return use([p.x, p.z + 1.1], [p.x, 1.0, p.z]);
    };
    const onBelt = () => use([-4.8, -1.75], [-4.8, 0.95, -0.6]);
    let washing = false;

    window.bot = {
      open: () => {
        const s = g.sign.root.position;
        return use([s.x, 3.9], [s.x, s.y, s.z]);
      },
      step() {
        if (washing) {
          atSink();
          if (g.sink.queue === 0) washing = false;
          return;
        }
        if (g.hand.item === 'dirty_dishes') {
          const q = g.hand.qty;
          atSink();
          if (g.hand.empty) {
            stats.washed += q;
            washing = true;
          }
          return;
        }
        const waiting = g.parties.filter((p) => p.state === 'waiting').sort((a, b) => a.patience - b.patience);
        if (g.hand.item) {
          const t = waiting.find((p) => p.remaining.includes(g.hand.item));
          if (t && t.spot.kind === 'counter' && g.hand.item === 'nigiri_salmon') {
            if (onBelt() && g.hand.empty) stats.beltPlaced++;
            return;
          }
          if (t) {
            if (atSpot(t.spot) && g.hand.empty) stats.handServed++;
            return;
          }
          if (g.hand.item === 'rice_portion') return atStation('sushi_board');
          return use([-7.6, 1.4], [-8.6, 1.05, 1.6]); // set it down on the free end of the counter
        }
        const dirty = g.spots.find((s) => s.dirty > 0 && (!s.party || s.party.state === 'leaving'));
        if (dirty) {
          const n = dirty.dirty;
          if (atSpot(dirty) && g.hand.item === 'dirty_dishes') stats.collected += n;
          return;
        }
        if (g.content.ingredients.all().some((i) => g.save.pantry[i.id] <= 1)) {
          const c = g.crate.root.position;
          return use([c.x + 1.1, c.z], [c.x, 0.3, c.z]);
        }
        const loose = g.loose.items.find((it) => waiting.some((p) => p.remaining.includes(it.item)));
        if (loose) {
          const p = loose.root.position;
          return use([p.x + 0.9, p.z], [p.x, p.y + 0.03, p.z]);
        }
        const onBeltAlready = (item) => g.belt.plates.filter((pl) => pl.item === item).length;
        for (const p of waiting) {
          for (const item of p.remaining) {
            if (item === 'nigiri_salmon' && p.spot.kind === 'counter' && onBeltAlready(item) >= waiting.filter((w) => w.spot.kind === 'counter' && w.remaining.includes(item)).length) continue;
            if (item === 'tea_green' && !station('kettle').busy) return atStation('kettle');
            if (item === 'edamame') return atStation('edamame_bowl');
            if (item === 'nigiri_salmon') {
              const sb = station('sushi_board');
              if (sb.label.ready > 0) return atStation('sushi_board');
              if (sb.busy) continue;
              const rc = station('rice_cooker');
              if (rc.label.ready > 0 || !rc.busy) return atStation('rice_cooker');
            }
          }
        }
      },
    };
    // count belt deliveries by watching plates disappear next to waiting counter parties
    const origRemove = g.belt.remove.bind(g.belt);
    g.belt.remove = (p) => {
      if (g.parties.some((pt) => pt.spot.kind === 'counter' && pt.state === 'waiting')) stats.beltDelivered++;
      origRemove(p);
    };
  });

  if (!(await page.evaluate(() => (window.bot.open(), window.yoake.mode === 'shift')))) throw new Error('could not open the restaurant');

  let result = null;
  for (let i = 0; i < 9000 && !result; i++) {
    result = await page.evaluate(() => {
      const g = window.yoake;
      g.debugAdvance(0.6);
      if (g.mode === 'shift' || g.mode === 'sunrise') window.bot.step();
      if (g.mode !== 'summary') return null;
      return { served: g.ledger.partiesServed, lost: g.ledger.partiesLost, net: g.ledger.net, stats: window.botStats, save: JSON.parse(localStorage.getItem('yoake.save')) };
    });
  }
  if (!result) {
    const state = await page.evaluate(() => {
      const g = window.yoake;
      return { mode: g.mode, time: g.clock.label(), parties: g.parties.map((p) => `${p.spot.label}:${p.state}`), dirty: g.spots.filter((s) => s.dirty).map((s) => s.label), hand: g.hand.item, sink: g.sink.queue, stats: window.botStats };
    });
    throw new Error(`night never reached the summary screen: ${JSON.stringify(state)}`);
  }
  console.log(`served ${result.served}, walked out ${result.lost}, net ¥${result.net}, rating ${result.save.rating.toFixed(2)}`);
  console.log(`bot: ${JSON.stringify(result.stats)}`);
  if (result.served < 5) throw new Error('too few parties served');
  if (result.stats.beltDelivered < 1) throw new Error('no dish was delivered by the conveyor belt');
  if (result.stats.washed < 1) throw new Error('no dishes were washed');
  if (result.save.night !== 2) throw new Error(`save should advance to night 2, got ${result.save.night}`);
  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`);
  console.log('PLAYTEST PASSED');
} catch (e) {
  console.error('PLAYTEST FAILED:', e.message);
  exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
process.exit(exitCode);
