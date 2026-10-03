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

Guests with a **!** want to order: click them. Then make what they asked for:

| Dish | How |
|---|---|
| Green tea | take a clean cup from the shelf behind the counter, pour at a tea urn |
| Salmon nigiri | take a clean plate, use the sushi case on the back counter by the pass |
| Yakitori | lay skewers on a charcoal grill in the kitchen, plate them when they're ready (don't let them burn) |
| Gyoza | fry a batch on the teppan in the kitchen, plate them when they're ready |

Serve it by hand, or set it on the **sushi belt**: it starts on the plating station in the kitchen, slips
through a hatch and runs down the middle of the counter, and guests on the stools lift off whatever they ordered
as it passes. Anything nobody takes goes back round; you can take it off again.

When guests are done they line up at the register (**¥**). Carry dirty dishes to the sink in the kitchen, stay
there while they wash, then take the clean ones from the rack back to the shelf. You can set anything down on
a counter. Each night you finish unlocks a perk.

You live upstairs. Go out the front door and round the east side of the shop, up the wooden stair: there's a
tatami room with a kotatsu (sit and warm your feet), a window over the bay, a futon behind the fusuma, and a
kettle on the hob.

## Layout

| File | What it is |
|---|---|
| `src/voxel.js` | Palette, voxel grid, face-culled mesher with baked AO, `Model` (props) and `PropBatch` (merged static props), 5×7 pixel font |
| `src/world.js` | The 1/8 m voxel world: the snowy lot, the shop, the apartment upstairs and its outdoor stair, the roof, the storehouse, the shrine, pines. `L` holds the shared layout numbers |
| `src/props.js` | Finer-scale prop models: furniture, lanterns, the sushi case, kitchen gear, signs, the cat, the vending machine, and where they're placed |
| `src/effects.js` | Night-to-dawn sky, snowfall, frosted glass, steam, the cliff, the sea, the hills and Mt Fuji, post FX |
| `src/audio.js` | Fully synthesized sound: wind, the sea, room tone, a generative koto radio, the door chime, snowy footsteps |
| `src/player.js` | First-person walker with voxel collision and step-up |
| `src/interact.js` | Click-to-use raycasting, hinged and sliding doors |
| `src/npc.js` | Guests: voxel people, walk/sit animation, nav grid + A*, the crowd |
| `src/service.js` | The night's work: orders, cooking stations, carrying, serving, paying, dishes, HUD |
| `src/belt.js` | The kaiten sushi belt: its loop from the kitchen to the counter, the plates riding it |
| `src/shift.js` | The clock (10 PM → 6 AM), rushes, the dawn, the stats card, perks |
| `src/main.js` | Boot, the lamp pool (the nearest lamps get real lights), the sunrise at the end of the night, the loop |
| `src/menu.js`, `src/coop.js`, `src/net.js`, `src/touch.js` | Menus, online co-op (up to 4), touch controls |
| `server/` | The co-op relay (a Cloudflare Durable Object) and the Pages worker; see `deploy.sh` |
| `docs/BLUEPRINT.md` | The original design blueprint |

Add `#dev` to the URL to skip the title overlay. `window.__yoake` exposes the scene, camera, player and the
night for debugging.

Co-op needs the relay deployed to your own Cloudflare account (`deploy.sh`, plus a binding from the Pages
project to the `yoake-relay` worker's `Room` Durable Object). Solo play needs nothing but the local server.
