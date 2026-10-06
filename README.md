# Yoake (夜明け)

A cozy voxel night shift in a hole-in-the-wall shop on a narrow Tokyo street, late at night, in the snow. You keep
it open from 10 PM until dawn: pour green tea, make salmon nigiri, grill yakitori and fry gyoza, then bus the tables,
wash up and restock the cups and plates. When the last guest leaves, the sun comes up behind Tokyo Tower.

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

## The street

The shop stands shoulder to shoulder with its neighbours on a narrow, snowy street of little bars and shops, under a
brick railway viaduct. Inside it's the same shop as ever: the kaiten island with its booths and stools, the glass front
room looking onto the street, the genkan and register by the door, the kitchen, and the restroom hall.
A narrow flight of stairs runs up one side of the restroom hall, a rail either side, and the whole floor upstairs
is your flat: a hall along the back, the living room with the kotatsu and the long front windows, the bedroom, the
back room with the little kitchen, a spare tatami room full of boxes and closets, a bathroom with a hinoki tub, and a
storeroom with the futons and the cleaning things. The kitchen's back door opens onto a plain concrete service yard,
boxed in by the back of the building next door (its kitchen door, a frosted window, the downpipes), the izakaya's
side wall and a block wall at the back: air-conditioner units, the brewery's empty crates, somebody's bike, the gomi
station in the corner, and the old shed in the far corner.

Outside: an izakaya and a standing bar either side, a tiny Inari shrine down a passage between them, a row of vending
machines under a canopy, a tobacconist, a coin laundry; across the road a konbini, a ramen shop, a drugstore, an old
kissaten, a karaoke tower and a yakiniku place. Signs are stacked up the buildings' corners, lanterns are strung
across the street, and the wires sag from pole to pole. Every so often a train rumbles over the viaduct at the west
end. The road works at both ends close all but one lane, so the street's one way tonight: taxis, the odd white kei
van and delivery scooters squeeze past the barriers and through, lights on in the snow. They slow for anyone in the
road (and honk if you stand there), and stop at the zebra crossing outside the shop when its lights change; while
it's green for walkers it plays the kakkō, the two-note cuckoo chirp. People pass by all night, and some of them come
in.

The game used to be set on a snowy cliff above the sea, looking across the bay at Mt Fuji. That map is still there:
add `?map=mountain` to the URL to run the shop up there (the flat is the same, and so is the arrangement of your
things). The night parade is always played on the mountain.

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

Guests with a **!** want to order: click them. The **!** shows through walls, so you can find whoever's waiting
from anywhere in the shop; once their order's taken their bubble shows what they're waiting on, and only when
you can see them. Pick up a dish someone ordered and their bubble rings gold and shows through the walls again,
so you can find them; if they're at the belt, a marker over the belt's way into the kitchen lights up too. Then
make what they asked for:

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

**The trash.** Every guest leaves a little rubbish, and the bin at the end of the dish station fills up over the
night. When it's full it says so (a bin icon through the walls): tie the bag off and carry it out to the gomi
station, out the back door into the yard, or, until you've dug the back door out, out the front to the one on the
pavement. The bags are collected in the morning. A bin left overflowing costs you stars.

**The rating.** Every guest rates their night when they pay, by how long they waited to order and then to eat; a
walkout gives one star. Tonight's rating is the guests' average, less a bit for a bin left overflowing, tables left
dirty and anything burnt. The shop's rating (under the clock) is a rolling average of its nights, and a
better-rated shop draws bigger crowds: a 5★ shop gets 30% more guests a rush, a 1★ shop 20% fewer.

**The goal: a five-star shop that runs itself.** Get the shop's rating to five stars and hire all five of the
help. The catalog keeps track.

At 6 AM the last guests leave and the sun comes up. Then go up to bed: you sleep through the short
winter day and wake for the next night. Your night, your yen, your perks and everything you've bought are
saved in this browser ("start a new game" in settings wipes it).

## Between nights

You live in a small old-fashioned flat upstairs: out the front door, round the east side of the shop and up
the wooden stair. Take your boots off in the genkan. There's an engawa along the tall windows over the bay, an
eight-mat living room with a kotatsu (sit and warm your feet) and a tokonoma with a scroll, opening at the back
into a wood-floored room, a bedroom with a futon behind the fusuma, and a kitchen corner with a kettle on the hob.
The rest of the upstairs is the shop's storeroom.

The **catalog** on the kotatsu is a little picture book: a tab for each section, two things to a page, turn the
pages with back and next. Things you own are stamped. A good night clears ¥15,000-30,000, and the help has to be
paid, so it takes a good many nights to have it all. It sells, for the yen in your cash box:

- **for the shop:** onigiri, tempura and miso ramen for the menu; a stronger belt motor; binchotan charcoal
  (faster yakitori and gyoza); more cups and plates; kerosene heaters (guests wait longer); a drinks fridge (a
  bottle on every bill, ¥250). Each of those five upgrades has a second level once you own the first (the
  fridge's is a sake warmer, another ¥350 a bill).
- **for the property:** dig out the hall's back door (guests come in from the shrine path too: one more in every
  rush), get the walk-in freezer off the kitchen running (matcha ice cream on the menu, scooped from the chest
  freezer inside), and, once the back door's open, restore the old kura across the yard as your sake cellar (house
  sake on every bill).
- **help wanted** (paid out of the till at sunrise). They walk the shop and do the work the way you would:
  - **Taro, dishwasher** (¥1,200 a night): runs the sink, and buses tables too. As guests leave he clears their
    dishes (a few tables to a tub), washes them, carries the clean ones back out to the shelves, and takes the trash
    out when the bin's full.
  - **Yui, waiter** (¥2,400): takes orders, pours tea, and carries dishes out from the pass (or off any counter) to
    whoever ordered them, up to three at a time on a tray.
  - **Hana, cashier** (¥1,600): rings people up at the register, and takes orders when nobody's waiting to pay.
  - **Kenji, sushi chef** (¥2,000): nigiri and onigiri down the belt for the guests along it, onto the pass for
    everyone else; green tea down the belt for the belt's guests.
  - **Ren, line cook** (¥2,800): fires the grills, the teppan, the fryer and the ramen pot for whatever's been ordered
    and plates it onto the pass.

  With all five hired the shop runs itself (you can still pitch in).
- **for home:** paper lanterns, houseplants, a bonsai, a big woodblock print, a cat bed (a black cat moves
  in), a goldfish tank, a record player, a brass telescope at the front window (put your eye to it and it swings round to Tokyo Tower, or Fuji on the mountain), and an
  irori hearth to sit by, a CRT television, and a Fami-Com console that plugs into it.
- **for the Fami-Com:** the console comes with *Sushi Catch* (catch falling sushi, dodge the wasabi). Three more
  cartridges: *Snow Dash* (jump snowmen, duck crows), *Koi Pond* (a snake game in a koi pond) and
  *Daruma Break* (breakout with daruma dolls). The TV comes with a floor cushion in front of it. Click the
  console to play: you sit down on the cushion, eye level with the set, and the game plays on the CRT itself.
  Arrow keys or WASD, space, Esc to put the controller down. High scores are saved.

**Before you open** (while the sign still says CLOSED):

- **Upgrade the kitchen.** Walk up to a station with empty hands and it offers its next upgrade, paid from the
  cash box. Each station has two levels. The tea urns, sushi case and rice cookers first make two at once (into
  your other hand), then earn more per dish (gyokuro tea +¥100, otoro +¥150, koshihikari onigiri +¥100). The
  yakitori grills, gyoza teppan, fryers and ramen stove first cook 25% faster, then make two plates a batch. The
  catalog lists them all under "kitchen stations". Once the shop opens, the stations go back to cooking.

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

The vending machines next door (on the mountain, the one along the path past the stair) take ¥130 from the cash box for a hot drink. It warms you
up: you walk 25% faster for two minutes of play (the cash box shows the time left, and another can tops it up).

Down the street, a little Inari shrine is tucked down a passage between two buildings: two red torii, a hokora and
two stone foxes (on the mountain it's up a flagstone path in the pines). Bow there (click the shrine: two bows, two claps, one bow) and once a day the kami leave a ¥100
coin on the offering box.

## 百鬼夜行 · the night parade

A survival mode on the title screen, separate from the shop: your save, yen and purchases are never touched.

It's the old shop up on the snowy mountain, boarded up, with the gaki (the hungry dead, in tattered burial white) coming up out
of the snow in rounds. It plays like Black Ops' zombies, solo. The first five rounds are counted a stroke of 正 at a
time (the Japanese tally), after that as kanji numerals in the corner. You start in the front room with
500 points and nothing in your hands. The dishes on the booth tables are your first weapons: grab them with **E** and
throw them with the mouse or **Q** (plates, tea cups and sake flasks all break on whatever they hit). With no weapon
your fists work too. **G** throws a hōrokudama, an old clay fire-pot: you start with two, get two more each round (four
at most), and it bounces, rolls and goes off a couple of seconds later, blowing apart whatever's close.

**Controls:**

| Input | Action |
|---|---|
| **Mouse** | strike or shoot (hold it to keep swinging a blade) |
| **Right-click**, **V** or **F** | quick melee |
| **R** | reload |
| **1 / 2 / 3** or the wheel | switch weapons |
| **Q** | throw a dish |
| **G** | throw a fire-pot |
| **Space** | jump |
| **E** | use things |
| hold **E** at a window | rebuild its boards |

On a phone there are strike, use, dish, pot, jump, 1/2 and reload buttons.

- **Rounds: Black Ops' rules, eased.** Four-fifths as many come (4 in round one, then 6, 10, 14, 19, 21 and on up),
  they rise 30% more slowly (2.75 s apart on round one, 5% quicker each round, down to 0.3 s), and no more than 24
  are up at once; the rest come as those fall. They have 100 health on round one, 75 more each round to the ninth,
  then 8% more every round. They walk early on, run from about round five and sprint from about round nine. A hit
  takes 40 health (an oni's 60), so it takes three to put you down without Tetsu. Between rounds there are 20
  seconds to catch your breath (the countdown's at the top of the screen).
- **The power:** the blessings' machines stand dark and the lamps burn low until you throw the breaker in the
  washrooms' hall (open the washrooms to reach it). Then the machines light up one after another, each playing its
  tune.
- **Points:** 10 for a hit, 60 for a kill, 100 for a headshot kill, 130 for a melee kill and 300 for an oni. Rebuilding
  boards is worth 10 a plank (up to 500 a round).
- **Windows and the front door** are boarded. The gaki tear the planks off one at a time and climb through. They
  find their way anywhere you can go: through doors, round the outside of the building, and up the stair to the
  flat.
- **Sealed doorways:** ofuda talismans and straw rope seal off the rest of the place until you pay to break them.
  Breaking one seal opens the whole room: every doorway into it unseals at once. Each opens more of the map:
  - the dining room: 750 (both openings in the partition);
  - the kitchen: 1,000 (both doors);
  - the washrooms: 1,000;
  - the back door to the grounds: 1,250;
  - the walk-in freezer: 1,250;
  - the old kura: 1,000;
  - the flat upstairs: 1,250.

  Once the kitchen and the washrooms are open, gaki also break up through the floorboards there.
- **Windows:** three in the front room (the west window, the bay and the front door), two in the dining room.
- **Weapons on the walls** are drawn in glowing chalk with the weapon hung over its outline, its name and price
  written underneath, as in Black Ops, with a warm glow round them and a price tag floating over them so you can
  spot them across a room:
  - a tantō (750) and a Type 26 revolver (1,000) in the front room;
  - a katana (1,500) and a Type 100 submachine gun (1,200, fully automatic) in the dining room;
  - a Murata rifle (1,250) in the kitchen;
  - a Type 96 light machine gun (2,000, fully automatic) in the walk-in freezer;
  - an ōdachi (3,000), the great battle sword, longer and far heavier than the katana, in the kura.

  Guns have no range limit: a round carries until it hits something.

  Buying a gun you already carry refills its ammunition. You carry two weapons (three with Sanbon no Ya).
- **The omikuji box** (950, in the dining room to start) rattles its fortune sticks and draws you a fortune and a
  weapon. That might be a naginata, a kanabō, one of the automatics, a tanegashima matchlock or, at 大吉 (great blessing), the cursed
  Muramasa, which heals you with every kill. Draw 凶 (a curse) and it refunds your points and moves to the kitchen
  or the shrine.
- **Blessings** come from tall machines that glow in their colours and play their own tunes now and then. Buy one
  and you drink it (the weapon goes down and a bottle comes up); its tile lights in the top corner. Each is one of
  Black Ops' perks:

  | Where | Blessing | Price | Effect (the perk it is) |
  |---|---|---|---|
  | Front room | 守 Omamori | 500 | go down and get back up, three times in a game (quick revive, solo) |
  | Walk-in freezer | 鉄 Tetsu | 2,500 | 250 health instead of 100 (juggernog) |
  | By the vending machine | 速 Hayate | 2,000 | swing and shoot a third faster (double tap) |
  | Kura | 酒 Sake Courage | 3,000 | reload twice as fast (speed cola) |
  | The flat upstairs | 三 Sanbon no Ya | 4,000 | a third weapon (mule kick) |

  Going down with the omamori costs you every blessing, and the third weapon with Sanbon no Ya.

- **Gifts:** as in Black Ops, every time your points earned pass the next mark (2,000, then each mark 14% further
  on) the next yōkai you kill leaves a gift, and now and then one drops by luck, up to four a round. It comes up in
  a burst of sparks with a chime, under a column of light in its colour that you can see across the lot. Walk into it
  to take it: the screen flashes its colour.

  | Gift | Effect |
  |---|---|
  | A maneki-neko | double points |
  | A hannya mask | one blow kills |
  | The great drum | every yōkai on the lot falls |
  | A carpenter's mallet | every window boarded again |
  | A crate of cartridges | full ammunition and dishes |

- **Every fifth round is an oni night.** Only oni come, two on the fifth round and one more every five rounds after: big red and blue brutes with iron kanabō. They smash a
  window's boards in one blow and hit hard enough to knock you back. With a clear run at you, an oni stamps, roars
  and charges in a straight line. If it misses it stands there blowing for a moment and takes extra damage. The last
  oni of the night always leaves ammunition.
- **Gore:** no two die alike. Each yōkai bleeds its own amount, and the killing blow decides how it goes: a blade
  takes the head, an arm, or (a big one) cuts it clean in half at the waist, the top half flying while the legs fold;
  a kanabō can burst it like a melon; a heavy round can take an arm or a leg off, or go through the middle; a
  headshot can burst the head; a fire-pot throws it apart, limbs and all. Pieces come off with red stumps that keep
  spurting, chunks scatter, blood sprays up the walls and runs down, and it all stays on the floor. A gaki that loses
  a leg keeps coming, dragging itself along the floor.
- **Health and falling:** health comes back if you stay out of reach for a few seconds. When you fall, the night's
  card shows your round, kills, headshots, limbs taken and points.

## Layout

| File | What it is |
|---|---|
| `src/voxel.js` | Palette, voxel grid, face-culled mesher with baked AO, `Model` (props) and `PropBatch` (merged static props), 5×7 pixel font |
| `src/maps/` | The maps: `index.js` holds the current one (`MAP`), `tokyo.js` and `mountain.js` give every position the game needs (counters, stations, the belt, doors, seats, where guests walk in, furniture spots); Tokyo's shop is the mountain's, so most of it is shared. `tokyo/world.js` builds the street round the shop in voxels, `tokyo/props.js` furnishes it, `tokyo/decor.js` adds the signs, wires, the city beyond the street's ends, Tokyo Tower and the trains, `tokyo/traffic.js` the cars, scooters and the crossing |
| `src/world.js` | The 1/8 m voxel world: `buildShop` builds the shop for either map (in its city dress on Tokyo); `buildWorld` the mountain: the snowy lot, the shop (kaiten island, front booth room, genkan, kitchen), the flat upstairs and its outdoor stair, the roof, the storehouse, the shrine, pines. `L` holds the shared layout numbers |
| `src/props.js` | Finer-scale prop models: furniture, lanterns, the sushi case, kitchen gear, signs, the cat, the vending machine, and where they're placed |
| `src/effects.js` | Night-to-dawn sky, snowfall, frosted glass, steam, the cliff, the sea, the hills and Mt Fuji, post FX |
| `src/audio.js` | Fully synthesized sound: wind, the sea, room tone, a generative koto radio, the door chime, snowy footsteps |
| `src/player.js` | First-person walker with voxel collision and step-up |
| `src/interact.js` | Click-to-use raycasting, hinged and sliding doors |
| `src/npc.js` | Guests: voxel people, walk/sit animation, nav grid + A*, the crowd |
| `src/service.js` | The night's work: orders, cooking stations, carrying, serving, paying, dishes, HUD |
| `src/staff.js` | The hired help: five who walk the shop and do the work (bussing, washing, cooking, waiting, the register) |
| `src/trash.js` | The kitchen bin, the bags and the gomi stations |
| `src/survival/` | The night parade: `mode.js` (rounds, points, seals, buys, the power, blessings, the box, the HUD), `nav.js` (a two-level walking grid and flow field over the whole lot), `horde.js` and `yokai.js` (the gaki and oni, their rigs and dismemberment), `weapons.js` (first-person weapons and thrown dishes), `grenade.js` (the fire-pots), `gore.js`, `props.js`, `sfx.js` |
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
and check the save, hire all five and let them run night 2 with nobody playing, then hold the front room in the night parade with a katana, break a seal, sit through an oni
night and fall. Set `CHROME_PATH` if Playwright can't find a Chromium.

`.github/workflows/pages.yml` publishes the game to GitHub Pages on every push and runs the playtest. Turn it
on once in the repository's Settings → Pages → Source: **GitHub Actions**; the site is then at
`https://<your-user>.github.io/<repo>/`. That link is for solo play.

Add `#dev` to the URL to skip the title overlay. `window.__yoake` exposes the scene, camera, player and the
night for debugging.

Co-op needs the relay deployed to your own Cloudflare account (`deploy.sh`, plus a binding from the Pages
project to the `yoake-relay` worker's `Room` Durable Object). Solo play needs nothing but the local server.
