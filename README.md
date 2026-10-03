# Yoake (working title)

A cozy first-person Japanese restaurant sim. You run a small sushi bar on a snowy mountainside above the sea, work through one night of service, and finish each night by watching the sun rise over Mount Fuji.

The full design is in [`BLUEPRINT.md`](./BLUEPRINT.md). This repository now contains a first playable build that matches the blueprint's **Vertical Slice D/E**: one complete, repeatable night.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (works on GitHub Pages / Cloudflare Pages: base is './')
npm test           # unit tests: clock, economy/rating, orders, spawner, save migration
npm run playtest   # end-to-end: a bot plays a full night in headless Chromium (set CHROME_PATH if needed)
```

Debug URL parameters: `?debug` exposes `window.yoake` (the `Game` instance); `?speed=10` runs the night clock 10× faster.

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Look |
| Left click | Pick up / place / serve / use |
| Shift | Run |
| Q | Set the held item down on the pass counter |
| Esc | Pause (volume, music, mouse sensitivity) |

## What's in this build

- **First-person restaurant**: Tier-1 room with kitchen counter, 4 tables, big north windows, a deck, and an exterior with a snowy roof, lanterns, sign, and stone lantern.
- **Click to pick up, click to place**: a single-slot hand, hover outlines and prompts, gentle rejection when something can't go somewhere.
- **Cooking**: data-driven stations: tea kettle (makes 2 cups per brew), edamame bowl (instant), rice cooker (4 portions per batch), and sushi board (rice + salmon makes nigiri). Ingredient stock, plus a delivery crate for restocking.
- **Customers**: Salaryman, Elderly Couple, and Family, each with their own patience, preferences, tips, looks, and time-of-night weighting. They walk in, read the menu, order (shown on a floating ticket with a patience bar), eat, pay, and leave. If kept waiting too long they walk out.
- **Cleaning**: finished tables leave dirty dishes. Tables must be cleared before new guests can sit, and dishes are washed at the sink.
- **Guidance**: a one-line objective ("Serve the Green Tea to Table 2"), and glowing strips under every station the current orders need.
- **Night clock**: 11 PM to dawn, in phases (Opening → Early Rush → Peak Rush → Late Service → Wind-Down → Last Call). About 26 real minutes by default; tune it in `src/data/content.ts`.
- **Sunrise**: once the last guest leaves and the restaurant is clean, the sky changes from night to deep red and gold, and a large sun rises from behind Mount Fuji's shoulder with its light reflected on the sea. You keep control the whole time.
- **End-of-night summary**: sales, tips, ingredients, net profit, satisfaction, and the reputation change (blueprint rating formula, MVP terms).
- **Save/load**: versioned localStorage save with a migration chain and default-filling. Quitting mid-shift restarts that night.
- **Procedural everything**: no asset files. Pixel textures, signs, and icons are drawn on canvas, and all sound effects, wind/ocean ambience, and generative koto-style music are synthesized with Web Audio.

## Code layout

```
src/data    content tables (items, ingredients, stations, recipes, menu, archetypes, night config) + registries
src/sim     pure logic: clock, economy & rating, order generation, spawner, seeded RNG (unit-tested)
src/save    save schema, migrations, storage adapter (unit-tested)
src/world   three.js: restaurant, environment/sky/sunrise, player, interaction, stations, dining (tables & parties)
src/ui      DOM overlay: HUD, prompts, tickets, screens
src/audio   procedural Web Audio engine
src/app     Game: state machine (title → prep → shift → sunrise → summary) and main loop
```

To add a dish, add an item, a recipe, and a menu entry in `src/data/content.ts`. A new station also needs a counter slot in `src/world/layout.ts` and a model case in `src/world/stations.ts`.

## Not built yet (next milestones per the blueprint)

Upgrade shop and visible upgrades, more dishes and a recipe-choice step at shared stations, character creation, the apartment, staff, weather states beyond snow intensity, restaurant tiers 2–5, and post-5★ content.
