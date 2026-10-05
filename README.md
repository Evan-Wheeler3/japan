# Yoake (夜明け)

A cozy voxel night shift in a little Japanese shop on a snowy cliff above the sea. You keep it open from
10 PM until dawn: pour green tea, make salmon nigiri, grill yakitori and fry gyoza, then bus the tables,
wash up and restock the cups and plates. When the last guest leaves, the sun comes up over Mt Fuji across the bay.

Built on **My Cozy Diner**, a friend's voxel diner game, used with permission: the voxel engine, lighting,
customers, shift loop, menus, co-op and touch controls are theirs. This version swaps the rainy NYC diner
for the snowy shop, the food, the people, the sounds and the sunrise.

## Run

```bash
python3 serve.py
```

Then open http://localhost:8517. It needs a local server because the game is split into ES modules (no build
step; three.js loads from a CDN). `serve.py` disables caching so edits show up on reload.

Controls: **WASD** walk · mouse look · **Shift** walk faster · **click** use things · **Q** put down what you're holding · **M** radio · **Esc** pause.
On a phone: left thumb walks, drag on the right to look, tap to use.

## How a night goes

You wake upstairs in the evening. The shop stays closed until you go down and turn the sign by the front
door to **OPEN**, so take your time: sit at the kotatsu, read the catalog, look out at the bay.

The shop is laid out like a kaiten-zushi. A U-shaped counter runs across the main room with the belt on its top:
booths butt up against the front of it, stools line both ends, and its east leg runs back to the kitchen pass,
where the belt comes out through the wall. You work on the chef's side behind it, at the back bar where the tea
is made; a doorway leads straight from there into the kitchen. More booths are backed onto the shoji partition,
and behind it a front room of booths looks out through the glass over the bay; the belt doesn't reach those, so
they're served by hand. The register is by the entrance, in the stone-floored genkan; stand behind it to ring
guests up. Down the hall behind a noren are two restrooms done the Japanese way, toilet slippers waiting inside
sliding lattice doors: a washlet in one, an old squat toilet with a pull-chain cistern in the other, and a bamboo
spout over a ceramic bowl to wash your hands.

Guests with a **!** want to order: click them. Then make what they asked for:

| Dish | How |
|---|---|
| Green tea | take a clean cup from the shelf over the back bar, pour at a tea urn |
| Salmon nigiri | take a clean plate, use the sushi case on the plating station under the kitchen pass |
| Yakitori | lay skewers on a charcoal grill in the kitchen, plate them when they're ready (don't let them burn) |
| Gyoza | fry a batch on the teppan in the kitchen, plate them when they're ready |
| Onigiri *(catalog)* | take a clean plate, press them at the rice cookers under the kitchen pass |
| Tempura *(catalog)* | drop a batch in the fryers in the kitchen, plate it when it's ready |
| Miso ramen *(catalog)* | start a bowl on the stove in the kitchen; it takes a while |

Serve it by hand, or set it on the **sushi belt**, anywhere along it: it starts on the plating station in the
kitchen, right by the sushi case, rides straight out through the pass and goes round the counter's rounded
corners past the stools and the booths. Every guest at the counter lifts off whatever they ordered as it passes their seat. Anything nobody takes goes back round; you can take it off again. The orders panel counts dishes already
on the belt, so it only asks for what still needs making.

When guests are done they line up at the register (**¥**). Carry dirty dishes to the sink in the kitchen, stay
there while they wash, then take the clean ones from the rack back to the shelf. You can set anything down on
a counter. Each night you finish unlocks a perk.

At 6 AM the last guests leave and the sun comes up over Fuji. Then go up to bed: you sleep through the short
winter day and wake for the next night. Your night, your yen, your perks and everything you've bought are
saved in this browser ("start a new game" in settings wipes it).

## Between nights

You live in a small old-fashioned flat upstairs: out the front door, round the east side of the shop and up
the wooden stair. Take your boots off in the genkan. There's an engawa along the tall windows over the bay, an
eight-mat living room with a kotatsu (sit and warm your feet) and a tokonoma with a scroll, opening at the back
into a wood-floored room, a bedroom with a futon behind the fusuma, and a kitchen corner with a kettle on the hob.
The rest of the upstairs is the shop's storeroom.

The **catalog** on the kotatsu sells, for the yen in your cash box:

- **for the shop:** onigiri, tempura and miso ramen for the menu; a stronger belt motor; binchotan charcoal
  (faster yakitori and gyoza); more cups and plates; kerosene heaters (guests wait longer); a drinks fridge (a
  bottle on every bill, ¥250). Each of those five upgrades has a second level once you own the first (the
  fridge's is a sake warmer, another ¥350 a bill).
- **for home:** paper lanterns, houseplants, a bonsai, a big woodblock print, a cat bed (a black cat moves
  in), a goldfish tank, a record player, a brass telescope at the front window (put your eye to it and it swings round to Fuji), and an
  irori hearth to sit by, a CRT television, and a Fami-Com console that plugs into it.
- **for the Fami-Com:** the console comes with *Sushi Catch* (catch falling sushi, dodge the wasabi). Three more
  cartridges: *Snow Dash* (jump snowmen, duck crows), *Koi Pond* (a snake game in a koi pond) and
  *Daruma Break* (breakout with daruma dolls). The TV comes with a floor cushion in front of it. Click the
  console to play: you sit down on the cushion, eye level with the set, and the game plays on the CRT itself.
  Arrow keys or WASD, space, Esc to put the controller down. High scores are saved.

**Rearranging:** anything you bought that stands on the apartment floor can be moved. Look at it and press
**F** (or click it, if it has nothing else to do) to pick it up; it follows your gaze across the floor. **R** or
the mouse wheel turns it, a click sets it down where the outline is green, **Esc** or right-click puts it back.
On a phone, use the move / turn / put back buttons. The TV takes its cushion and the console with it. Things on
the walls (the lanterns, the print) stay put.
Where everything stands is saved.

In co-op everyone can order from the catalog; it all comes out of the shop's one cash box, and everyone
shares one arrangement of the apartment.

**Dev switch:** the **`** key (or "dev · infinite yen" in settings) toggles a cash box that never runs out, for
testing. It's remembered until you switch it off.

The vending machine outside, along the path past the stair, takes ¥130 from the cash box for a hot drink. It warms you
up: you walk 25% faster for two minutes of play (the cash box shows the time left, and another can tops it up).

West of the shop, a flagstone path leads past a stone lantern and through a torii to a little hokora in the
pines. Bow there (click the shrine: two bows, two claps, one bow) and once a day the kami leave a ¥100
coin on the offering box.

## Layout

| File | What it is |
|---|---|
| `src/voxel.js` | Palette, voxel grid, face-culled mesher with baked AO, `Model` (props) and `PropBatch` (merged static props), 5×7 pixel font |
| `src/world.js` | The 1/8 m voxel world: the snowy lot, the shop (kaiten island, front booth room, genkan, kitchen), the flat upstairs and its outdoor stair, the roof, the storehouse, the shrine, pines. `L` holds the shared layout numbers |
| `src/props.js` | Finer-scale prop models: furniture, lanterns, the sushi case, kitchen gear, signs, the cat, the vending machine, and where they're placed |
| `src/effects.js` | Night-to-dawn sky, snowfall, frosted glass, steam, the cliff, the sea, the hills and Mt Fuji, post FX |
| `src/audio.js` | Fully synthesized sound: wind, the sea, room tone, a generative koto radio, the door chime, snowy footsteps |
| `src/player.js` | First-person walker with voxel collision and step-up |
| `src/interact.js` | Click-to-use raycasting, hinged and sliding doors |
| `src/npc.js` | Guests: voxel people, walk/sit animation, nav grid + A*, the crowd |
| `src/service.js` | The night's work: orders, cooking stations, carrying, serving, paying, dishes, HUD |
| `src/belt.js` | The kaiten sushi belt: its loop from the kitchen round the island, the plates riding it |
| `src/home.js` | The save file, the catalog, what each upgrade does, and the things you can buy for the apartment |
| `src/arcade.js` | The Fami-Com: a 256×224 canvas that is the CRT's picture, and its four games |
| `src/shift.js` | The clock (10 PM → 6 AM), rushes, the dawn, the stats card, perks |
| `src/main.js` | Boot, the lamp pool (the nearest lamps get real lights), the sunrise at the end of the night, the loop |
| `src/menu.js`, `src/coop.js`, `src/net.js`, `src/touch.js` | Menus, online co-op (up to 4), touch controls |
| `server/` | The co-op relay (a Cloudflare Durable Object) and the Pages worker; see `deploy.sh` |
| `docs/BLUEPRINT.md` | The original design blueprint |

## Testing and hosting

`npm install && npm run playtest` runs a bot through the whole loop in a headless browser: wake upstairs, buy
from the catalog (including upgrade levels and the Fami-Com), play Sushi Catch, open, work a full night (every dish, the belt, washing up), sleep, wake for night 2, reload
and check the save. Set `CHROME_PATH` if Playwright can't find a Chromium.

`.github/workflows/pages.yml` publishes the game to GitHub Pages on every push and runs the playtest. Turn it
on once in the repository's Settings → Pages → Source: **GitHub Actions**; the site is then at
`https://<your-user>.github.io/<repo>/`. That link is for solo play.

Add `#dev` to the URL to skip the title overlay. `window.__yoake` exposes the scene, camera, player and the
night for debugging.

Co-op needs the relay deployed to your own Cloudflare account (`deploy.sh`, plus a binding from the Pages
project to the `yoake-relay` worker's `Room` Durable Object). Solo play needs nothing but the local server.
