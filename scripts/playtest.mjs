// End-to-end playtest: a bot plays one full night through the real raycast/click interaction system.
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
  await page.waitForFunction(() => window.yoake, null, { timeout: 30000 });

  await page.evaluate(() => {
    const g = window.yoake;
    localStorage.clear();
    g.enterPrep();
    g.player.controls.isLocked = true;
    const V = g.camera.position.constructor;
    const use = (stand, look) => {
      g.player.teleport({ x: stand[0], z: stand[1] }, 0);
      g.camera.lookAt(new V(...look));
      g.scene.updateMatrixWorld();
      g.interaction.update(g.camera, true, 0);
      if (!g.interaction.hovered) return false;
      g.interaction.click();
      return true;
    };
    const station = (id) => g.stations.find((s) => s.def.id === id);
    const atStation = (id) => use([-4.6, station(id).z], [-5.5, 1.0, station(id).z]);
    const atTable = (t) => use([0.6, t.z + (t.z < 0 ? 0.6 : -0.6)], [t.x, 0.8, t.z]);

    window.bot = {
      open: () => {
        const s = g.sign.root.position;
        return use([s.x, 3.4], [s.x, s.y, s.z]);
      },
      step() {
        if (g.hand.item === 'dirty_dishes') return use([-4.6, 3.05], [-5.5, 1.0, 3.05]);
        const waiting = g.parties.filter((p) => p.state === 'waiting').sort((a, b) => a.patience - b.patience);
        if (g.hand.item) {
          const t = waiting.find((p) => p.remaining.includes(g.hand.item));
          if (t) return atTable(t.table);
          if (g.hand.item === 'rice_portion') return atStation('sushi_board');
          return use([-4.6, 1.85], [-5.5, 1.0, 1.85]);
        }
        const dirty = g.tables.find((t) => t.dirty && (!t.party || t.party.state === 'leaving'));
        if (dirty) return atTable(dirty);
        if (g.content.ingredients.all().some((i) => g.save.pantry[i.id] <= 1)) return use([-4.4, 3.5], [g.crate.root.position.x, 0.3, g.crate.root.position.z]);
        for (const p of waiting) {
          for (const item of p.remaining) {
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
        return false;
      },
    };
  });

  if (!(await page.evaluate(() => (window.bot.open(), window.yoake.mode === 'shift')))) throw new Error('could not open the restaurant');

  let result = null;
  for (let i = 0; i < 8000 && !result; i++) {
    result = await page.evaluate(() => {
      const g = window.yoake;
      g.debugAdvance(0.6);
      if (g.mode === 'shift' || g.mode === 'sunrise') window.bot.step();
      if (g.mode !== 'summary') return null;
      return { served: g.ledger.partiesServed, lost: g.ledger.partiesLost, net: g.ledger.net, save: JSON.parse(localStorage.getItem('yoake.save')) };
    });
  }
  if (!result) throw new Error('night never reached the summary screen');
  console.log(`served ${result.served}, walked out ${result.lost}, net ¥${result.net}, rating ${result.save.rating.toFixed(2)}`);
  if (result.served < 5) throw new Error('too few parties served');
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
