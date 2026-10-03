# My Cozy Diner

A voxel NYC diner at night, in the rain. For now it's just the place: walk around, sit with the vibes.

The layout is loosely based on the Chelsea Square Diner (23rd St & 9th Ave): a corner diner with a deep glass conservatory on the sidewalk, sage booths against an etched-glass partition, a long white counter with swivel chairs, porcelain chandeliers, mugs hanging from the beams, and a wall of signed photos.

## Run

```bash
python3 serve.py
```

Then open http://localhost:8517. It needs a local server because the game is split into ES modules. `serve.py` disables caching so edits show up on reload.

Controls: **WASD** walk · mouse look · **Shift** walk faster · **click** use things · **Q** put down what you're holding · **M** radio · **Esc** pause.

You work the night shift: customers with a **!** want to order. Make coffee at the urns (grab a mug from the back bar), pie from the counter rack, pancakes on the griddle and burgers on the broiler (grab a plate). Serve, ring them up at the register when they show **$**, then bus the tables, wash up at the dish station and restock the mugs and plates.

## Layout

| File | What it is |
|---|---|
| `src/voxel.js` | Palette, voxel grid, face-culled mesher with baked AO, `Model` (props) and `PropBatch` (merged static props), 5×7 pixel font |
| `src/world.js` | The 1/8 m voxel world: street, sidewalks, the diner shell, its neighbors and signs. `L` holds the shared layout numbers |
| `src/props.js` | Finer-scale prop models (1/16 and 1/32 m): furniture, Tiffany lamps, star lights, the cat, cars, street furniture, and where they're placed |
| `src/effects.js` | Sky, rain, splashes, rainy glass shader, wet-street reflections, steam, backdrop city, post FX |
| `src/audio.js` | Fully synthesized sound: rain (muffled indoors), room tone, a generative jukebox, thunder, tire hiss, door bell, footsteps |
| `src/player.js` | First-person walker with voxel collision and step-up |
| `src/interact.js` | Click-to-use raycasting and hinged doors |
| `src/npc.js` | Customers: voxel people, walk/sit animation, nav grid + A*, the crowd |
| `src/service.js` | The shift: orders, cooking stations, carrying, serving, paying, dishes, HUD |
| `src/main.js` | Boot, lights, and the living bits: traffic and signals, door, fans, the clock (shows real local time), lightning |

Add `#dev` to the URL to skip the title overlay. `window.__diner` exposes the scene, camera and player for debugging.
