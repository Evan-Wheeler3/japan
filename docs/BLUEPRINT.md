# YOAKE — Game Blueprint

**Working title:** *Yoake* (夜明け, "daybreak") — the night always ends in sunrise; the name is the promise the gameplay loop keeps. Rename freely; all systems below are title-agnostic.

**Genre:** Cozy first-person restaurant management / cooking sim.
**Setting:** A small Japanese restaurant on a snowy mountainside overlooking the ocean, run across a single night that ends in a signature sunrise over Mount Fuji.
**Platform:** Browser (WebGL2, desktop-first), static-hosted (GitHub Pages / Cloudflare Pages), no backend.
**Status of this document:** Complete pre-production specification. No game code is implemented yet. This is the contract an implementing agent builds against.

---

## 0. Assumptions Made (read this first)

Where the brief left a decision open, I resolved it rather than leaving a gap. These are the load-bearing assumptions; flag disagreement early because later sections depend on them:

1. **Repo is empty** — no existing architecture to preserve. Section 30 is a fresh recommendation, not a retrofit.
2. **One restaurant, one location, forever.** The player never relocates. Expansion means the *same* building growing (new rooms, bigger kitchen), not new sites. This matches "look around and say this place used to be tiny."
3. **Shift = one playthrough of the core loop**, roughly 20–30 real minutes at default settings, with an explicit in-game clock (11:00 PM → sunrise) that is decoupled from real time via a tunable `minutesPerGameHour` constant (Section 11).
4. **No fail state that ends the game.** A bad night costs rating/money, never a game-over screen. This is a cozy game first; see Section 25.
5. **Single-player, local save only** for the full scope of this document. No multiplayer, no cloud sync, no monetization systems (no IAP) — this is a complete, non-predatory indie product.
6. **Customers are simulated agents with simple finite-state behavior**, not full pathfinding-heavy AI. Movement uses a small set of fixed waypoints/seats, not navmesh crowd simulation. This keeps the "readable, physical" feel and the performance budget intact.
7. **Day-counter, not calendar.** Shifts are "Night 1, Night 2, Night 3…" — there is no real-world date/season system. "Seasonal events" (Section 26) are content flags on specific night numbers, not a calendar simulation.
8. **Currency is ¥ (yen), stylized, not tied to real exchange rates.** Numbers in this doc (prices, costs, upgrade costs) are balance targets, tunable via data files, not hardcoded truths.

---

## 1. GAME VISION

Yoake is about the satisfaction of a well-run service and the quiet reward that follows it. The player spends a night as cook, server, and host in a restaurant that is small, warm, and entirely theirs. Every plate they place, every tea they pour, and every dish they wash is a physical act in a physical room — never a menu abstraction. The tension of a busy rush and the stillness of an empty dining room after close are both the point.

The game's identity rests on three pillars:

- **Physicality** — the restaurant is a real place you walk through, not a UI you navigate. Progress is something you can *see*: a bigger conveyor belt, a new tatami room, a brighter sign.
- **Contrast** — cold/dark outside vs. warm/bright inside; frantic rush vs. peaceful close; the player's first cramped apartment vs. their eventual cozy one. The whole game is built on paired opposites that make each other legible.
- **The Sunrise** — the single recurring moment the entire game is built around. Every night, no matter how it went, ends the same way: the work stops, the light changes, and Mount Fuji appears across the water. This is the emotional thesis of the product, and Section 21 treats it as a first-class system, not a cutscene.

The long-term promise to the player: *this place gets better because I made it better*, expressed through restaurant growth, apartment growth, and reputation — not through numbers alone.

---

## 2. CORE PLAYER EXPERIENCE

Moment-to-moment, the player should always be able to answer "what do I do right now?" within 2 seconds of looking at the screen. The loop that produces this:

1. **See** a signal (an order ticket, a blinking station, a seated customer, a dirty table).
2. **Go** to the object the signal points to (hover text names the action; a soft highlight shows the station).
3. **Click** to pick up / act.
4. **Carry** the result across the room.
5. **Click** again to place / serve / deliver.

No step requires a menu, a drag gesture, a hotbar, or inventory management beyond "one object in your hands at a time." The player is never asked to multitask abstractly (no simultaneous resource bars to babysit) — multitasking emerges naturally from *physical distance* (the kitchen is far from the tea station, so a rush forces real route-planning).

Emotional arc of a single night: **calm open → rising bustle → peak rush → gradual quieting → empty dining room → clean-up → sunrise.** The pacing curve (Section 11/25) is authored specifically to produce this arc every night, not left to random chance.

---

## 3. CORE GAMEPLAY LOOP

```
PREP (before open)
   └─ walk the dining room, restock stations, check tomorrow's upgrade shop
OPEN RESTAURANT
   └─ clock starts, door unlocks, first customers spawn
   ┌─────────────── repeating per customer ───────────────┐
   │ CUSTOMER ARRIVES → seats self → ORDER appears        │
   │        ↓                                              │
   │ PLAYER reads order → goes to required station(s)      │
   │        ↓                                              │
   │ PREPARE dish (1+ interaction steps per Section 7)      │
   │        ↓                                              │
   │ CARRY dish/drink to customer → SERVE (click)           │
   │        ↓                                              │
   │ CUSTOMER EATS (timer) → pays → leaves tip → rating delta│
   │        ↓                                              │
   │ TABLE now dirty → CLEAR plates → WASH at sink          │
   └─────────────────────────────────────────────────────┘
LATE NIGHT
   └─ arrivals taper → last order flag → finish final tickets
CLOSE
   └─ final clean-up pass → lights-down beat → SUNRISE sequence
END-OF-NIGHT SUMMARY
   └─ revenue / costs / tips / rating delta / new unlocks shown
SHOP / UPGRADE (between nights)
   └─ spend money → physical changes appear in the restaurant
APARTMENT (optional, between nights)
   └─ spend money → physical changes appear at home
REPEAT → Night N+1, slightly harder, slightly bigger
```

Everything downstream of Section 6 is this loop with more nouns (more dishes, more stations, more customer types) plugged into the same verbs (pick up, carry, place).

---

## 4. CONTROL SCHEME

| Input | Action |
|---|---|
| `W A S D` | Move |
| Mouse | Look (first-person, standard FPS camera) |
| `Left Click` | Context action: pick up / place / serve / interact / start prep step |
| `Shift` (hold) | Sprint (move speed ×1.6, drains nothing — no stamina system) |
| `Q` | Put away currently held item (returns it to its source station if valid, otherwise drops it on the nearest counter; never destroys it) |
| `Esc` | Pause menu (resumes clock-paused; see Section 28) |
| `E` *(MVP-optional, see below)* | Secondary interact — reserved, OFF by default |
| `Tab` | Toggle order-board overview (see Section 10) — Full implementation only, not MVP |

Design rule: **one additional key beyond WASD/mouse/click is the ceiling** unless a system *proves* it needs more during playtesting. `Q` is the only non-negotiable addition because "I'm holding the wrong thing and want my hands free" is a high-frequency frustration without it. `E` is specified but dormant — reserved for a future "use differently" case (e.g., pouring vs. placing a kettle) rather than invented now.

No inventory hotbar, no numbered item slots, no build mode outside the shop screen. Camera never leaves first-person during active gameplay (shop/upgrade/apartment screens are allowed to use a fixed third-person or orbit camera over the relevant room, as clarified in Section 28).

---

## 5. INTERACTION SYSTEM

**Core mechanic: single-slot hand.** The player can hold exactly one "carryable" at a time (a dish, a drink, a plate of dirty dishes, a raw ingredient portion, a tray). Picking up a second item while holding one is disallowed with a clear rejection cue (short negative sound + UI flash), never a silent failure.

**Raycast-based targeting:** a short-range forward raycast (≈2.5m) from the camera determines the current interactable under the crosshair. The UI layer (Section 23) shows a contextual prompt whenever the raycast hits an interactable:

```
[Station Name]
Action verb (e.g. "Prepare Nigiri", "Pick Up", "Serve", "Wash")
```

**Interactable categories** (every physical object in the world is one of these — this taxonomy is the backbone of the data model in Section 29):

| Category | Examples | Behavior on click |
|---|---|---|
| `Station` | rice cooker, sushi counter, grill, tea kettle | Starts/advances a prep step (Section 7) |
| `Pickup` | a finished dish sitting on a counter, a raw ingredient bin | Picks the item into hand |
| `Placeable surface` | conveyor belt slot, customer table, pass-through counter | Places held item there |
| `Customer` | any seated/standing customer | Click with empty hands = inspect order; click with correct item in hand = serve |
| `Dirty object` | used plate/cup on a table | Pick up → hand now holds "dirty dishes" |
| `Washable surface` | the sink/dishwasher station | Place dirty dishes → starts wash cycle |
| `Decor/Static` | lanterns, windows, signage | No gameplay interaction; hover shows nothing (except in apartment/shop customization contexts) |

**Hover feedback contract** (applies everywhere, not just customers):
- Neutral outline + name on hover (always).
- Verb text changes based on what's in hand (e.g., empty-handed sushi counter says "Prepare," holding-wrong-item says "Can't use here," holding-correct-ingredient says "Add to Counter").
- Stations relevant to the player's *currently visible open orders* get a **subtle persistent glow** (not just on-hover) so a glance across the room tells the player where to go next — this is the literal implementation of "I need to go here → make this → take it there."

**Error feedback:** wrong item at wrong station, serving the wrong dish to a customer, etc. never hard-blocks the player — it's always a soft rejection (sound + tooltip: "This customer didn't order that") so nothing is ever truly a dead end. Misserved dishes are **not destroyed**: the player keeps holding the item and can take it to a customer who did order it, or discard it at a trash/compost interactable (introduced in Section 15 as an upgrade — MVP has no trash object; misplaced food can just be set down on any empty counter).

---

## 6. RESTAURANT LAYOUT

The restaurant is one evolving building, not a level list. Layout is defined per **Restaurant Tier** (Section 16) as a fixed floor plan with designated expansion footprints — i.e., the Tier-2 dining room is a real room that exists (locked/walled off, visible as a dark unlit space through a window or sliding door) from Tier 1 onward, and "buying" the expansion unwalls it rather than procedurally generating new geometry. This keeps art production bounded and makes growth *visible in advance* (the player can see the shape of their future restaurant from night one).

**Tier 1 (starting layout):**
- Single room: ~6×8m.
- Entrance door (south wall) facing the mountainside path.
- 3 small tables (2 seats each) = 6 covers.
- One L-shaped counter: rice cooker + prep board + a 4-slot pass-through to the dining room (no conveyor yet — Section 7 clarifies prep without a belt).
- One large window (north wall) facing the ocean/Fuji view.
- One door to the apartment stairwell (locked from the dining side during service — purely a transition trigger to Section 18).
- Washing basin behind the counter.

**Tier 2:** +conveyor belt bar (6 seats around it) replacing 1 small table, kitchen footprint grows by ~40% (adds tempura/grill station slot), second window added.

**Tier 3:** + second dining alcove (4 more seats), tatami floor option unlocked for that alcove, kitchen gets a dedicated soup/ramen station, exterior covered deck becomes visible through new sliding doors (seating there is Tier 4).

**Tier 4:** + exterior deck seating (weather-exposed, see Section 12 interaction), private dining room (reservation-only, premium ticket), second wash station, staff break nook.

**Tier 5 (endgame facility, reached around/after 5★):** full floor plan unlocked — every room, max seating (~28–32 covers), largest conveyor loop, show-kitchen counter seating facing the chefs, largest window wall.

Floor plans are authored as fixed level geometry (Section 30: one GLB/scene per tier, or one base scene with toggled sub-meshes) — not algorithmically generated. This is a deliberate scope control: hand-authoring 5 tiers is bounded work; a procedural layout system is not justified by the design.

---

## 7. COOKING SYSTEM

**Design rule: every dish is a short, deterministic sequence of station interactions.** No skill-based mini-games (no QTEs, no precision timing bars) in MVP — "cooking" means *being at the right station with the right ingredient at the right time*, executed via the same click-to-pick-up/click-to-place verbs as everything else. This keeps the control scheme honest (Section 4) and keeps difficulty scaling about *logistics and throughput*, not twitch skill (Section 25).

**Station model:**
- A `Station` has a `slotCount` (how many concurrent prep jobs it can hold, 1 at Tier-1 rice cooker, more as upgraded), a `prepTime` per recipe, and an `acceptedRecipeIds` list.
- Starting a prep job: click station (empty-handed or holding the required raw ingredient, recipe-dependent) → job begins, a visible progress indicator appears on the station itself (steam ramps up, a small radial timer billboard, rice cooker lid light) — **no separate progress UI element**, the world object *is* the progress bar.
- Finishing: when `prepTime` elapses, the station visibly signals ready (ding sound, light change, steam puff) and the finished item becomes a `Pickup`.
- Multi-step dishes chain stations: e.g., *Salmon Nigiri* = pick up rice-ball from rice cooker (auto-portioned, no mini-game) → carry to sushi counter → place rice + click salmon bin → sushi counter "cooks" (assembles) for a short fixed time → pick up finished nigiri.
- **Idle stations are not punishing** — a station left idle doesn't spoil ingredients in MVP (no spoilage system; see Future Expansion, Section 36, for an optional spoilage upgrade-mechanic later). This keeps early-game forgiving per the brief's cozy-first mandate.

**Complexity scaling by unlock tier** (concrete, not just "gets harder"):

| Complexity tier | # of station visits | Example | Total prep time (unupgraded) |
|---|---|---|---|
| Tier A (Night 1) | 1 | Green Tea (kettle only) | 4s |
| Tier B | 2 | Salmon Nigiri (rice cooker → sushi counter) | 10s |
| Tier C | 3 | Miso Soup (stock pot → add tofu/wakame → bowl/ladle) | 16s |
| Tier D | 3–4 | Ramen (stock pot → noodle station → topping assembly → bowl) | 28s |
| Tier E | 4–5 | Tempura Donburi (fry station → rice → sauce → plating → garnish) | 36s |

Prep times are **reduced by station upgrades** (Section 15), not by player skill — e.g., "Better Rice Cooker" cuts rice prep time 30%. This directly ties the upgrade economy to the cooking system's pacing, satisfying "upgrades physically appear and matter."

**Batching:** higher-tier stations gain `slotCount > 1` (e.g., upgraded rice cooker holds 3 batches at once), letting the player get ahead of a rush by pre-cooking staples — this is the main "skill expression" of the cooking system: *anticipation and batching*, not reflexes.

---

## 8. FOOD / RECIPE SYSTEM

Recipes are pure data (Section 29 schema) composed of: required station sequence, required ingredient(s) pulled from stock, prep time, sell price, food-cost, and unlock condition. Content growth = adding rows to a table, never new code paths.

**Starting menu (Night 1), intentionally tiny:**
- Green Tea (kettle)
- Salmon Nigiri (rice cooker → sushi counter)
- Edamame (cold prep — pick from bin, place on plate; the one 1-step "food" item, exists so Night 1 has a non-drink safety-net dish)

**Unlock-by-night menu growth (representative, tunable):**

| Unlock point | New dishes added |
|---|---|
| Night 1 | Green Tea, Edamame, Salmon Nigiri |
| Night 2 | Tuna Nigiri, Tamago Nigiri |
| Night 3–4 | Miso Soup, Salmon Roll |
| Night 5–6 | Shrimp Nigiri, Tuna Roll, Matcha |
| Rating ≥2★ | Gyoza, California-style Roll |
| Rating ≥3★ / Tier 2 restaurant | Ramen, Tempura (small), Warm Sake |
| Rating ≥3.5★ | Donburi (2 variants), Yakitori |
| Rating ≥4★ / Tier 3 restaurant | Deluxe Ramen, Chef's Roll (premium multi-ingredient roll), Japanese Beer |
| Rating ≥4.5★ / Tier 4 restaurant | Omakase Plate (a composed "dish of dishes" requiring 3 sub-items plated together — the game's most complex recipe) |
| Post-5★ | Seasonal/limited specials (Section 26) |

Unlocking a dish is **announced physically**: a new ingredient bin appears at the relevant station, a small chalkboard/menu-sign in the dining room updates, and the end-of-night summary names it ("New dish unlocked: Ramen"). No separate "unlocks" menu is required to *discover* a new dish — but a `Recipe Book` UI (Full implementation, Section 23) lets the player review everything unlocked so far, since by late game the menu is large enough that recall matters.

**Ingredient stock:** each raw ingredient (rice, salmon, tuna, nori, tofu, noodles, etc.) has a stock counter that depletes with use and is restocked by the player (MVP: walk to a delivery crate at the back door at any point, click to refill all bins instantly for a flat gold cost deducted automatically — represents "today's delivery," not a minigame) or automatically by a hired Prep Cook (Section 17, Full implementation). Running out mid-rush is a real but *soft* failure: the station simply can't start that recipe until restocked, sign-posted clearly ("Out of Salmon") rather than silently blocking.

---

## 9. CUSTOMER SYSTEM

**Customer = data profile + finite-state agent.** Every customer instance is generated from an `ArchetypeDefinition` (Section 29) plus randomized/seeded variation, and regulars are archetype instances flagged `isRegular: true` with a persistent `CustomerRecord` that survives across nights.

**Archetype roster (MVP ships with 5, Full scope has ~11):**

| Archetype | Patience | Spend tier | Preferred food | Trait |
|---|---|---|---|---|
| Salaryman | Medium | Low–Med | Quick items (nigiri, tea, beer) | Visits late, tips modestly, values speed over quality |
| Elderly Couple | High | Low | Traditional (miso, tea, tamago) | Very forgiving of wait, low spend, high satisfaction if order is right |
| Young Couple | Medium | Medium | Rolls, sake | Mildly social — their satisfaction nudges nearby tables slightly |
| Tourist | Low–Medium | Medium–High | Whatever's "famous" (signature dish flag) | Orders based on menu signage; takes a "photo" (visual beat) on first bite of a signature dish |
| Fisherman | High | Low | Donburi, beer, sashimi-forward dishes | Occasionally "gifts" a rare ingredient (ties into Section 26) |
| Family | Medium | Medium | Mixed simple orders, kids' items | Takes up a larger table (4-top), multiple sub-orders at once |
| Regular | High (knows the drill) | Medium | A remembered favorite dish | Recognized by name in hover UI after 2nd visit; satisfaction carries a small permanent rating weight (Section 14) |
| Food Enthusiast | Medium | High | Always orders the newest/most complex unlocked dish | Big tip on perfect order, vocal (visible frustration) on mistakes |
| Wealthy Patron | Low (expects promptness) | Very high | Premium dishes (sake, Omakase) | Big spend, big tip, but harsh rating penalty if mishandled |
| Difficult Customer | Very low | Low–Medium | Simple orders but complains anyway | Intentional friction/comedy beat; capped frequency so it's spice, not the norm |
| Simple-Order / Complex-Order variants | n/a | n/a | Not a separate archetype — a *modifier* applied to any archetype's generated order (see Section 10) | — |

**Patience model:** each customer has a `patienceSeconds` countdown that starts once their order is placed (not once seated — being seated and waiting to order doesn't stress the player, this is intentional pacing-friendliness). A visible patience indicator sits above their head (Section 23) that shifts color/urgency as it depletes. Patience expiring doesn't make them vanish rudely — they leave with a visible huff animation, no payment, and a rating ding, which is itself useful player feedback.

**Satisfaction model:** computed at the moment of payment from: order accuracy (right dish(es) delivered), wait time vs. patience budget, (Full scope) table cleanliness, and (Full scope) ambiance factors from unlocked restaurant amenities. Satisfaction produces: (a) tip size, (b) a rating contribution (Section 14), (c) whether they become/remain a Regular (repeat visits weighted by average satisfaction across visits).

**Regulars:** after a satisfying visit, an archetype instance has a chance to be "promoted" to a persistent `CustomerRecord` (name, favorite dish, visit count, last-seen night) stored in the save file. Regulars reappear in future nights' spawn pool at elevated frequency. This is the mechanical backbone of "the player should gradually feel like they know the people who visit."

**MVP scope:** 3 archetypes (Salaryman, Elderly Couple, Family), no regulars yet, binary satisfaction (good/bad) rather than the full continuous model. Full scope adds the rest of the roster, the regulars system, and continuous satisfaction scoring.

---

## 10. ORDER SYSTEM

An `Order` is generated per-customer at seating time from: their archetype's preferred-food weighting, the currently unlocked menu, and a **complexity modifier** ("simple" = 1 item, "standard" = 2 items, "complex" = 3+ items incl. a drink) chosen by a probability curve that shifts toward "complex" as nights/rating progress (this *is* the mechanical form of the brief's "customer who orders simple food" / "complex food" distinction — not separate archetypes but an order-generation parameter).

**Order visualization:**
- On hover over a seated customer (or click with empty hands), a small floating ticket appears above them:
  ```
  ORDER
  🍣 Salmon Nigiri
  🍵 Green Tea
  ```
  using icon-first, text-secondary presentation (icons match the station/dish icon set for instant recognition — never require reading at a glance).
- Required stations for *any currently open order in the room* get the ambient glow described in Section 5, aggregated — if three different tables need the rice cooker, it glows once, strongly, not three times.
- (Full implementation) a `Tab`-toggled order-board overview lists every open ticket restaurant-wide with table number, items, and remaining patience as a sortable list — this is the one allowed "menu-like" screen *during* gameplay, strictly opt-in and strictly supplemental, never required to play well.

**Order lifecycle states:** `Seated(no order yet)` → `OrderPlaced` → `InProgress` (≥1 item being prepped) → `PartiallyServed` (some items delivered, some pending — multi-item orders can be served incrementally, which matters a lot for Family tables) → `FullyServed` → `Eating` → `Paid/Leaving`.

**Order accuracy scoring:** delivering the wrong dish to a table is possible (nothing stops the player physically) but is caught at the serve-click: if the held item isn't on that table's open order, the game soft-rejects it (Section 5) rather than silently accepting a wrong delivery — this keeps "mistakes" interesting (wasted travel time) without making "wrong food served and the game didn't tell me" a real failure mode, which would feel unfair rather than cozy.

---

## 11. TIME / NIGHT SYSTEM

**Single authoritative game clock** per shift: `gameMinutesElapsed`, mapped to a display clock from `startTime` (default 23:00) to `sunriseTime` (default ~05:30), via a tunable `minutesPerGameHour` (default: real-time seconds per in-game hour ≈ 240s, i.e. a 6.5 in-game-hour night ≈ 26 real minutes — lands inside the brief's 20–30 minute target and is a single constant to retune).

**Phase table** (phases drive spawn rate, weather bias, music, and lighting together — see cross-references):

| Phase | In-game time | Customer spawn rate | Narrative purpose |
|---|---|---|---|
| Opening | 23:00–23:30 | Low, gentle ramp | Tutorial-safe calm; teaches the loop |
| Early Rush | 23:30–1:00 | Medium, rising | First real multitasking pressure |
| Peak Rush | 1:00–2:30 | High (night's max) | The "satisfying chaos" beat |
| Late Service | 2:30–3:30 | Medium, falling | Recovery; harder/rarer orders (Food Enthusiast, Wealthy Patron bias up) |
| Wind-Down | 3:30–4:30 | Low, falling to near-zero | Last Call triggers here (see below) |
| Last Call → Close | 4:30–~5:00 | Door locks; only seated customers remain | Finish existing tickets, begin clean-up |
| Sunrise | ~5:00–5:30 | None | Scripted lighting/weather/audio sequence (Section 21) |

**"Last Call" trigger:** fires automatically at a phase boundary (or earlier if the player manually locks the door — Full implementation gives the player this agency so a rough night can be ended early at a small rating cost). After Last Call, no new customers spawn; the game is explicitly guiding the player toward the clean-up→sunrise beat so the ending never feels randomly cut off mid-rush.

**Clean-up phase:** once the last customer leaves, any remaining dirty tables/dishes are highlighted; clearing them all is what triggers the Sunrise sequence to begin (small deliberate agency: *the player chooses to let the night end* by finishing their closing duties, reinforcing "the sunrise is the natural conclusion of the night's work," not a timer cutscene). A skip-ahead affordance (Full implementation) lets a player who wants to end faster fast-forward clean-up at a minor cleanliness-rating cost.

**Tunability:** every number above lives in a single `NightTimingConfig` data object (Section 29) so balancing (or a difficulty-mode selector, Section 36) never touches code.

---

## 12. WEATHER SYSTEM

Weather is an **atmospheric + light gameplay-modifier layer**, not a simulation. A `WeatherState` enum: `Clear`, `LightSnow`, `Snow`, `HeavySnow`, `Blizzard`, `Fog`. Each night picks a weather *track* at shift start (weighted random, tunable, with some tracks that transition mid-shift, e.g. `Snow → HeavySnow → Clearing` for pacing variety) — never player-controlled directly.

**Visual implementation (Section 20/31 cross-ref):** snowfall as GPU instanced particles (density scales with state), reduced visibility/fog density scaling by state, wind-shader sway on exterior foliage/lanterns at `HeavySnow`+. `Blizzard` additionally mutes exterior ambient light and pushes window-glow contrast higher (reinforcing the warm/cold visual thesis at its most extreme).

**Gameplay effect (kept intentionally light per the brief's "do not overcomplicate"):**
- Heavier weather → slightly fewer/slower-arriving customers (fewer people want to go out), but the ones who *do* arrive snow-dusted (visual flavor) and are often more generous (cabin-fever warmth bonus to tip/satisfaction) — a small, legible trade, not a punishing one.
- `Blizzard` is the only state that meaningfully suppresses arrivals (rare, dramatic, a "quiet beautiful night" beat) — never a state that strands the player with zero income for a whole shift.
- Exterior deck seating (Tier 4 unlock) is closed automatically in `HeavySnow`/`Blizzard` (world-logical, and a soft reason the deck upgrade matters: better heaters/enclosure as a *further* upgrade, Section 36, could re-enable it).
- Weather never blocks the Sunrise sequence — all tracks resolve toward clearing skies by end of shift (Section 21), because the sunrise is sacred and must always land.

**MVP scope:** `Clear`, `Snow` only, no gameplay effect beyond visuals. **Full scope:** full enum + tip/arrival modifiers + deck interaction. **Future:** rain/mixed precipitation variant for a non-winter seasonal event (Section 26).

---

## 13. MONEY / ECONOMY

**Currency:** ¥, integer-only (no fractional yen), displayed with thousands separators.

**Revenue sources:** dish sale price (defined per-recipe in data) + tips. Tip formula (Full scope): `tip = baseTipRate(archetype) × satisfactionScore × billTotal`, clamped to a sane min/max; MVP uses a flat tip percentage (10%) with no satisfaction weighting, upgraded to the full formula once the continuous satisfaction model (Section 9) ships.

**Costs tracked per night** (shown itemized in the end-of-night summary, Section 23/28):
- **Food cost:** each recipe has a `foodCostPerServing`; summed per dish sold. Target food-cost ratio ≈ 30–35% of sale price (standard restaurant-sim economics, keeps upgrade purchases meaningful without making every dish a pure-profit button).
- **Restocking cost:** flat/variable cost when the player (or auto-restock, once a Prep Cook is hired) refills ingredient bins.
- **Wages:** per-night flat cost per hired employee (Section 17), deducted automatically at night's end regardless of how busy it was — this is what makes overstaffing a real decision, not a free lunch.
- **Upgrade costs:** one-time capital purchases from the shop screen (Section 15), not a nightly expense — shown in lifetime stats, not nightly P&L.

**Nightly summary line items (Section 28 detail):**
```
Revenue:        ¥41,200
Tips:            ¥6,150
Food Cost:      -¥13,800
Wages:           -¥4,000
Restocking:      -¥2,100
───────────────────────
Net Profit:     ¥27,450
Lifetime Earnings: ¥318,900
```

**Persistent economy stats:** lifetime revenue, lifetime profit, best single-night profit, total customers served, total dishes sold (all-time) — feeds both the save file (Section 27) and later "collection/stat" replayability hooks (Section 26).

**HUD display (live, top-right, Section 23):** current night's running cash balance only (not full P&L breakdown — that's reserved for the end-of-night screen to keep in-shift HUD minimal per the brief).

---

## 14. RESTAURANT RATING

**1–5 stars, stored as a float internally (e.g. 3.72★) and displayed rounded to the nearest half-star.** Rating updates at the *end of each night* (not live during service, to avoid HUD clutter and to avoid punishing the player mid-rush for something they can't yet fix) from a weighted blend of that night's performance plus a decay/momentum term against the prior rating — i.e., one bad night dents the average, it doesn't reset it, but a long streak of bad nights will drag a 5★ restaurant back down. This directly satisfies "do not make the rating feel arbitrary" and "the player should understand how their actions affect it."

**Nightly rating-delta formula (weights are the tunable, balance-owned part — these are starting values):**

```
nightScore =
    0.35 × avgOrderAccuracy      (served-correct ÷ total items served)
  + 0.25 × avgSatisfaction        (mean customer satisfaction, 0–1)
  + 0.15 × avgWaitPerformance     (served-within-patience ÷ total orders)
  + 0.10 × cleanlinessScore       (1 − avg(dirty tables outstanding / total tables), sampled over the night)
  + 0.10 × varietyScore           (distinct dishes sold ÷ distinct dishes unlocked, capped contribution)
  + 0.05 × consistencyBonus       (no two consecutive 0-star-equivalent service failures this night)

newRating = clamp( oldRating × 0.75  +  (nightScore × 5) × 0.25,  1.0,  5.0 )
```

This gives the rating real momentum (75% weight on history) while still making every system in the game — accuracy, speed, cleanliness, menu variety, consistency — a legible, additive contributor the player can see broken down on the end-of-night screen as a mini scorecard (not just a single delta number):

```
Tonight's Service: ★★★★☆ (4.1 → trending toward 4.3)
  Order Accuracy    ████████░░ 82%
  Satisfaction       █████████░ 91%
  Speed              ███████░░░ 74%
  Cleanliness        █████████░ 88%
  Menu Variety       ██████░░░░ 60%
```

**Rating gates content** (ties directly to Section 8's unlock table and Section 16's expansion costs) — crossing 2★/3★/3.5★/4★/4.5★ thresholds is what unlocks new dishes/rooms, giving star-rating a *second* job beyond vanity: it's the game's primary gate, alongside raw cash, preventing the player from buying their way past content pacing.

**MVP scope:** accuracy + satisfaction only (two terms, re-normalized), displayed as whole stars. **Full scope:** the full six-term formula and half-star display with breakdown UI.

---

## 15. UPGRADES

Upgrades are **one-time capital purchases**, bought from the Shop screen (Section 28) between nights (never mid-shift — this keeps shift-time purely about execution, not shopping, per the brief's "avoid unnecessary menus... during the core shift"), and each one **changes something visible in the world** the very next night. No purely-numeric invisible upgrades exist in this design — if a system can't be made visible, it's reconsidered rather than shipped invisible.

**Categories and representative items** (full list is data, Section 29 — this is the illustrative backbone):

| Category | Upgrade | Effect | Visible change |
|---|---|---|---|
| Cooking | Better Rice Cooker | −30% rice prep time, +1 batch slot | New cooker model on counter |
| Cooking | Sushi Counter (base) | Unlocks nigiri/roll recipes | New counter furniture appears |
| Cooking | Tempura Station | Unlocks fry recipes | New fryer + oil-shimmer VFX |
| Cooking | Ramen Station | Unlocks noodle recipes | New stockpot rig + steam |
| Cooking | Grill / Yakitori Station | Unlocks grilled recipes | New grill + smoke VFX |
| Service | Conveyor Belt (base→large→fast) | Enables conveyor-served dishes; later tiers add length/speed | Visibly longer/faster belt loop |
| Service | Tea/Sake Station | Unlocks warm drinks | New station prop |
| Service | Extra Seating | +table/seats | New furniture placed in existing/unlocked floorspace |
| Service | Faster Dishwashing | −wash cycle time | New dishwasher unit replacing basin |
| Restaurant | Larger Windows | Cosmetic + small ambiance/rating bump | Literal window geometry swap, better ocean view |
| Restaurant | Lighting Upgrades (lanterns, fixtures) | Ambiance/rating bump | New warm-light fixtures placed |
| Restaurant | Decorations/Signage | Ambiance/rating bump, Tourist-archetype draw | New set-dressing props |
| Restaurant | Room Expansions (Tatami room, 2nd dining room, Deck, Private room) | Unlocks Section 6 tiers | Walls open / new room revealed |
| Staff | Hire Dishwasher / Prep Cook / Sushi Chef / Server / Manager | See Section 17 | New NPC visibly working the station |

**Progression gating (prevents buy-everything-immediately):** every upgrade has a `moneyCost`, and the higher tiers additionally require a **minimum rating** and/or **minimum restaurant tier** and/or **a prerequisite upgrade already owned** (a small directed-acyclic unlock graph, not a flat list) — e.g., you cannot buy the Tatami Room Expansion until you own the 2nd Dining Room and are ≥3★. This is the actual pacing lever for "prevent immediately buying everything," stacked with simple cash scarcity.

**MVP scope:** ~8 upgrades covering one of each category (just enough to prove the shop-and-see-it-in-world loop). **Full scope:** full ~30–40 item upgrade graph across all categories and tiers.

---

## 16. RESTAURANT EXPANSION

Expansion is modeled as discrete **Restaurant Tiers (1–5, see Section 6)**, each unlocked by a specific high-cost "Expansion" upgrade in the Restaurant category (Section 15) gated by rating + cash + sometimes a prior expansion. Expansion is *not* continuous/freeform building — the player is not given a sandbox placement tool (explicitly descoped, Section 38) — because freeform building is a different, much larger game than the one specified here, and the brief's floor-plan descriptions ("more tables," "larger kitchen," "additional rooms") read as a tier ladder, not a sandbox.

Within a tier, smaller **placement upgrades** (extra tables, decorations, lighting) *do* let the player choose among a handful of preset slots in the currently-unlocked floorspace (e.g., "place 1 of 3 remaining table slots in the new dining room") — enough agency to feel like *your* restaurant without needing full freeform placement tooling.

Each tier transition is staged as a short **non-interactive reveal beat** at the start of the next night the player opens after purchasing it (lights come up on the new room, a brief camera-settle moment) before gameplay resumes — reinforcing the brief's "the restaurant itself should visually communicate the player's progress."

---

## 17. EMPLOYEE SYSTEM

Staff are hired from the Shop screen (Section 28) as a Staff-category upgrade (recurring **wage** cost per night, Section 13) and appear as NPCs performing a bounded task loop in the world — visible, not abstracted.

| Role | Unlock point | Behavior |
|---|---|---|
| Dishwasher | Earliest hire (Tier 1, modest rating req.) | Walks to dirty tables on a timer, clears them to the sink, runs wash cycles — removes the player's single most repetitive early chore first |
| Prep Cook | Tier 2 | Periodically auto-restocks ingredient bins from the back-door stock, removing manual restock trips |
| Sushi Chef | Tier 2–3, rating ≥3★ | Autonomously fulfills simple sushi orders end-to-end at the sushi counter without player input (player can still help in a rush) |
| Server | Tier 3 | Autonomously carries finished dishes from pass-through/conveyor to the correct table and collects payment |
| Specialist stations (Grill cook, Ramen cook) | Tier 3–4 | Same pattern as Sushi Chef, scoped to their station |
| Manager/Assistant | Tier 4–5, rating ≥4.5★ | A capstone hire: mildly boosts *all* staff efficiency and can briefly "run the floor" (Full/Future scope: a short auto-pilot mode usable a limited number of times per night, useful for a bathroom-break-style real-life pause without fully pausing the clock) |

**Design intent:** staff don't remove the player's job, they let the player **choose where to spend their own attention** — a Dishwasher frees you to focus on cooking; a Sushi Chef frees you to focus on service and new dishes. Late-game, a fully-staffed restaurant shifts the player's role from "do everything" to "orchestrate and handle the overflow/VIPs/specials personally," which is the correct late-game power fantasy (you're the owner now, not just the cook) and a natural answer to Section 26's "what keeps players playing after 5★."

**MVP scope:** no staff at all (pure solo play, proves the core loop first). **Full scope:** entire roster above, each a straightforward finite-state NPC (go-to-task → perform-task-animation-and-timer → return-to-idle-post), reusing the same waypoint/animation infrastructure as customers (Section 9) to avoid building a second NPC system.

---

## 18. APARTMENT SYSTEM

**Explicitly secondary** — a short, low-stakes diorama the player can walk into between nights, not a second gameplay loop. Reached via a single door/stairwell transition from the restaurant (Section 28 state diagram).

**Structure:** a small fixed-size room (not expandable in footprint — only its *contents* change), starting state per the brief: bare mattress, bare walls, a single window, nothing else. Furniture/decor items are bought from a dedicated (small) Apartment Shop tab — separate list from the Restaurant Shop, same UI pattern (buy → it appears).

**Item categories:** Bed, Rug, Table+Chair, Shelves, Wall Art, Paint/Wallpaper swatches, Plants, Lamps, Radio, CRT TV, Game Console, small decorative clutter (Japanese household items — a kettle, a cushion, a calendar). Each is a single flat-cost placeable with a small number of preset placement spots (same "pick from a few valid slots" pattern as restaurant decorations, Section 16) — no freeform furniture-arranging tool.

**CRT/console mini-interaction:** sitting on the apartment's couch/floor cushion near the TV and clicking it plays a tiny looping low-poly "game-within-the-game" vignette (a simple fishing-rod bobbing animation loop with a score tick, as hinted by the moodboard) — **purely cosmetic/flavor, no real minigame logic, no separate win condition**, explicitly scoped this way per the brief's "lightweight implementation... NOT a second major game." It's a looping idle animation + ambient chiptune SFX the player can sit and watch for as long as they like, nothing more.

**Progression tie-in:** apartment coziness has **no mechanical effect on restaurant performance** (deliberately — keeps it a pure reward track, not a stat-optimization chore) but its *item count/completeness* can optionally feed one Section 26 "collection" achievement track late-game.

**MVP scope:** apartment exists, is visitable, has exactly 2–3 purchasable items to prove the pattern (bed, lamp, rug). **Full scope:** full item catalog + CRT vignette. **Future:** seasonal/cosmetic apartment decor tie-ins (Section 36).

---

## 19. CHARACTER CREATION

A short, static (non-gameplay-camera) customization screen shown once at New Game start, re-enterable later from the Pause menu as a "change appearance" option (Full scope — MVP can lock it to first-run only).

**Options (all discrete preset choices via left/right arrows or a swatch grid — no sliders, per the brief):**

- Body type: Short / Average / Tall (affects character scale + camera eye-height slightly, mostly cosmetic for a first-person game but matters for any future mirror/photo-mode feature)
- Hair style: small preset set (6–8 to start)
- Hair color: swatch grid (6–8 to start)
- Skin tone: swatch grid (5–6 to start)
- Eye style/color: small preset set
- Outfit: a handful of preset chef/server outfits (color variants of the base apron uniform) — distinct from unlockable outfit *rewards* (Future, Section 36)

**Architecture note:** every option is an index into a small enum-backed table mapping to swappable mesh/material assets, stored in the save file as plain indices (Section 27) — trivially extensible by appending new entries to each table (new hairstyle = new mesh + one new table row, no code change). This directly satisfies the brief's "design the system so additional cosmetics could be added later."

**MVP scope:** body type, 3 hairstyles, 4 hair colors, 4 skin tones, 1 outfit (apron is a given, not a choice) — enough to prove the pipeline. **Full scope:** full option breadth above. **Future:** unlockable cosmetic rewards tied to milestones (new outfits, seasonal accessories).

---

## 20. WORLD / ENVIRONMENT

The exterior world is a **fixed, non-walkable backdrop** visible through windows/door, not an explorable outdoor area — the brief's focus is entirely interior gameplay with the exterior as atmosphere, and treating it as backdrop (vs. a walkable zone) is a major, deliberate scope control that keeps the art/performance budget sane.

**Exterior composition (single static scene, time/weather-reactive, viewed from fixed interior vantage points — the big windows):**
- Snowy hillside terrain mesh immediately around the building (the only "outdoor ground" that needs real geometry, since it's visible near the windows).
- Ocean plane with a simple animated shader (scrolling normal maps + fresnel + a subtual rolling vertex displacement) — not a full ocean-sim, per Section 31's performance mandate.
- Mid-distance mountain silhouettes (layered low-poly cards/meshes, parallax-sorted).
- Mount Fuji as a distinct, recognizable, fixed-position silhouette on the horizon, positioned so it's framed by the main dining-room window and dramatically backlit during Sunrise (Section 21) — its silhouette shape is a dedicated hand-authored asset, not a generic mountain, because the brief calls it out as a signature visual beat.
- Falling snow (Section 12), a day/night sky dome (gradient + stars at night, transitioning through the sunrise gradient, Section 21).
- Lanterns/exterior lighting around the building entrance, visible glowing through the snow — the "warm building in a cold dark world" establishing shot the title screen and end-of-night screen (Section 28) can also reuse as a camera composition.

**Interior composition:** dark wood materials throughout, shoji-panel room dividers (sliding, some are literal gameplay doors between tiers' rooms), paper lanterns as the dominant light-prop, hanging fabric signage with Japanese text/kanji (stylized, decorative — not required to be gameplay-legible, matching the moodboard's 寿司 noren curtain), low tables/floor seating in the Tatami room specifically (Tier 3+), the conveyor belt as a continuously-animated physical loop, steam/smoke particle emitters at every hot station, dish/food props modeled as chunky low-poly stylized forms (never literal Minecraft cubes — see Section 21 for the explicit visual-language boundary).

**MVP scope:** one exterior backdrop state (clear night + light snow), Tier-1 interior only. **Full scope:** full weather/time reactivity, all 5 tiers. **Future:** seasonal exterior dressing (Section 26).

---

## 21. LIGHTING / VISUAL DIRECTION

This section is the single most important aesthetic contract in the document, because it's the brief's explicit signature feature.

**The core visual law: warm/bright inside vs. cold/dark outside, always, at every time of night except the Sunrise resolution.** Concretely:
- Interior light sources are warm (≈2700–3400K equivalent color), numerous, low-intensity-individually but dense (lanterns, pendant fixtures, under-counter glow, stove/grill glow) — composited to feel "full" and golden without relying on one or two overpowering lights (performance reason too, see Section 31).
- Exterior "light" at night is mostly *absence* — cool moonlight rim-light on snow, deep blue/near-black sky, with the restaurant's own window-glow being the brightest thing in the exterior shot. This is what sells "warm oasis in the cold dark," and it's mostly an **exposure/contrast and color-temperature trick**, not a complex lighting rig.

**Visual language — "not literal Minecraft" boundary, made concrete:**
- Geometry: chunky, simplified, low-poly-count forms with rounded/beveled edges where it reads as "designed" rather than "raw voxel" — think modeled low-poly props (a teapot is a teapot-shaped low-poly mesh, not a cube with a teapot texture).
- Textures: small, simple, often flat-shaded or lightly painted/pixel-art-influenced, avoiding PBR micro-detail/noise — materials read as clean color fields with soft gradient shading, not photoreal grain.
- Characters: simplified blocky-but-sculpted humanoid proportions (closer to "chunky stylized voxel-adjacent indie character" than a literal voxel-cube avatar) — rounded block heads/limbs, a small expressive face read (simple eyes, not detailed facial rigging), consistent with the attached moodboard's character screenshot.
- Lighting/post-process: cinematic — soft bloom on warm light sources, gentle vignette, filmic tonemapping, volumetric-feeling light shafts through steam/snow (cheap fake volumetrics via light-shafts sprites/particles, not true volumetric raymarching — performance reason, Section 31).

**The Sunrise sequence (the signature system — specified as a real system, not a cutscene):**

1. **Trigger:** final clean-up task completed (Section 11).
2. **Camera behavior:** player retains full control throughout — they can walk to the big window, sit, or keep moving; nothing is taken from them. The game simply *lets the world change around them.*
3. **Sky/light animation (scripted, ~60–90 real-second sequence, independently tunable from the main night clock):**
   - Sky gradient shifts from deep navy → indigo → warm grey-blue (pre-dawn) → the signature **deep red/orange band low on the horizon**.
   - A large, deeply saturated red/orange sun disc rises directly behind/beside Mount Fuji's silhouette — sun size is deliberately exaggerated beyond physical realism (a bigger-than-real sun disc) because the brief explicitly calls for drama over realism here.
   - Sun position is authored to clear Fuji's silhouette partway through the sequence (rises "from behind" it) for the specific dramatic composition the brief describes.
   - As the sun climbs, warm sunlight direction sweeps across: snow (color shifts from cool blue-white to warm pink/gold), ocean (a long specular highlight path forms across the water toward the viewer — the classic "sun road" reflection), restaurant exterior walls/roof (warm rim light catches snow-dusted eaves), window glass (catches and refracts the light, interior warm light and exterior warm light briefly *match* for the first time all night — the visual resolution of the whole night's contrast thesis), clouds (if present, lit from beneath/behind, pink/orange edge-lighting).
   - Exterior ambient light intensity ramps up to "overcast morning" by sequence end; interior lights can optionally auto-dim slightly at the very end (a nice touch, Full scope) since they're no longer needed to read as "the warm place in the dark."
4. **Audio behavior:** see Section 22 — music and ambience crossfade in lockstep with the visual sequence.
5. **End state → End-of-Night Summary UI appears** (Section 23/28) once the sequence completes, letting the player linger in the lit room for a beat before the screen comes up (never an abrupt hard-cut from gameplay to UI).

**MVP scope:** the sunrise sky/light sweep and sun-disc rise exist and work, simplified (fewer light-shaft/cloud flourishes, a fixed non-cloudy sky). **Full scope:** full layered sequence above including ocean sun-road reflection and cloud lighting. **Future:** weather-reactive sunrise variants (a snowy sunrise vs. a clear sunrise look meaningfully different, Section 36).

---

## 22. AUDIO

Audio is organized into **layers that crossfade by game phase**, mirroring the lighting system's phase-driven design so sound and visuals always change together.

**Ambience layers (looping, mixed by phase/weather):**
- Exterior: wind (intensity scales with Weather state, Section 12), muffled snow-hush, distant ocean waves (louder near windows — basic distance-based mix, not full 3D audio propagation).
- Interior: room tone (crackling lantern/electrical hum, very low), general murmur bed once ≥2 occupied tables (crowd-density-scaled, not per-customer-voiced, for performance and sanity).
- Kitchen: ambient sizzle/simmer bed active whenever ≥1 station has an active prep job.

**Discrete SFX (triggered, pooled — see Section 31):** footsteps (surface-aware: wood vs. tatami, a nice-to-have), door open/close, knife chop (sushi counter start), boiling/frying loops tied to station active-state, conveyor belt motor loop (only audible near it), plate clink (serve/clear), dishwashing swish, cash register-ish payment chime, UI confirm/reject stingers (Section 5's soft-rejection cue), customer arrival door-chime, customer seating murmur, patience-warning soft ding, satisfaction stingers (happy chime vs. disappointed sigh), lantern electrical buzz (very subtle, near-light-source only).

**Music:**
- A small rotating set of calm, sparse, traditional-instrument-influenced tracks (shamisen/koto/shakuhachi-style motifs over soft ambient pads) for the main service phases, **intensity/tempo subtly increasing from Opening → Peak Rush** (same track family, layered stems that fade additional percussion/motion in as phases progress — avoids a jarring hard music-switch).
- Late-night (Wind-Down/Last Call) drops to a sparser, slower, mostly-ambient variant — noticeably quieter and more spacious, reinforcing the emotional wind-down the brief asks for.
- **Sunrise theme:** a distinct, warmer, more melodically resolved piece that fades in as the Section 21 sequence begins and swells toward its visual climax (sun clearing Fuji) — this is the game's emotional "theme" in the traditional sense, the track players should remember.
- Menu/Shop/Apartment screens each get a short, quiet, distinct ambient loop (not the in-shift tracks) so mode transitions are audible as well as visual.

**MVP scope:** one ambience bed, ~8 core SFX, one music loop for service + one for sunrise. **Full scope:** full phase-adaptive stems, full SFX list, weather-reactive ambience. **Future:** seasonal/event-specific stingers (Section 26).

---

## 23. UI / UX

**Guiding rule (restated from the brief): the world communicates first; UI is a thin, minimal confirmation layer.**

**Persistent HUD (top-right, always visible during active shift):**
```
¥24,850
2:17 AM
★★★★☆
```
— exactly the three numbers the brief specifies, no more, rendered small and unobtrusive (semi-transparent panel, rounds to whole yen/half-star/HH:MM). No visible health/stamina/inventory bars anywhere, consistent with Section 4's control philosophy.

**Contextual world-space UI (appears attached to objects/customers, never as fixed-screen panels):**
- Hover prompt (object name + verb) near crosshair, as specified in Section 5.
- Floating order ticket above customers (Section 10).
- Floating patience indicator above customers — a small arc/bar that visibly depletes and shifts green→amber→red, mounted just above/beside the order ticket so one glance reads both "what" and "how urgent."
- Station progress indicators are the stations themselves (steam/lights/radial glow, Section 7) — explicitly *not* separate floating progress bars, to keep the world doing the talking.

**Feedback language (consistent iconography/stingers used everywhere, defined once, reused everywhere — this consistency is itself a UX requirement):**
| Event | Feedback |
|---|---|
| Successful pickup/place | Soft positive click/sound, subtle item-snap animation |
| Wrong item at station / wrong dish to customer | Short negative buzz + brief red-tinted tooltip flash, item stays in hand |
| Order completed correctly | Green checkmark pulse over the table + satisfaction chime |
| Station ready | Station-local visual ding (light/steam change) + soft audio ding |
| Upgrade purchased | Shop-screen confirm animation; in-world, the object/room change is itself the main payoff, revealed next night per Section 16 |
| New dish/unlock | End-of-night summary banner + updated menu signage in-world |
| Rating change | End-of-night scorecard (Section 14) only — never a mid-shift rating popup, to avoid stress-spiking the player during service |

**Full-screen UI (used only outside active shift, per Section 28's state machine):** Main Menu, Character Creation, Shop/Upgrades, Apartment Customization, End-of-Night Summary, Pause overlay. These can be conventional 2D panel UI (the brief's "menus are fine where they improve clarity" carve-out) — but even here, where practical, panels are shown *over* a 3D view of the relevant physical space (e.g., the Shop screen shows the actual restaurant behind/around the panel, camera parked at a good vantage point) rather than a flat abstract background, keeping the "real place" feeling even in menu-adjacent states.

**MVP scope:** HUD trio, hover prompts, order tickets+patience, basic positive/negative stingers, plain end-of-night text summary. **Full scope:** full feedback language table, Recipe Book, order-board overview (Tab), polished diegetic-backdrop menus. **Future:** accessibility options (colorblind-safe patience indicator palette, UI scale, subtitles for audio cues) — flagged now so the color-coded patience system (Section 9/23) is designed with a shape+color dual-encoding from the start, not retrofitted.

---

## 24. PROGRESSION CURVE

| Phase | Nights (approx.) | Dishes available | Stations | Customer volume/complexity | Staff | Restaurant tier | Rating band | Typical nightly earnings | New systems introduced | Player goal |
|---|---|---|---|---|---|---|---|---|---|---|
| **Night 1 (tutorial)** | 1 | Tea, Edamame, Salmon Nigiri | Kettle, Rice Cooker, Sushi Counter | 3–5 customers, simple orders only | None | Tier 1 | Unrated → ~2.0★ | ¥3,000–5,000 | Core loop (pick up/place/serve), first order, first sunrise | Learn the verbs; survive one calm night |
| **Early Game** | 2–7 | +Tuna/Tamago Nigiri, Miso Soup, Salmon Roll, Matcha | +Soup station | 6–12 customers, "standard" complexity appears | None → first Dishwasher hire | Tier 1 | 2.0–2.8★ | ¥6,000–10,000 | Ingredient restocking, first upgrade purchases, first regular appears | First upgrades; stop drowning in dishes |
| **Mid Game** | 8–18 | +Shrimp Nigiri, Tuna/Cali Rolls, Ramen, Tempura, Gyoza, Sake | +Conveyor, Tempura/Ramen stations | 12–20 customers, complex orders common, Food Enthusiast/Wealthy appear | +Prep Cook, +Sushi Chef | Tier 2 → Tier 3 | 2.8–4.0★ | ¥12,000–22,000 | Staff management, conveyor logistics, weather variety, Tatami room | Build a real team; chase 3★ then 4★ |
| **Late Game** | 19–30ish | +Donburi, Yakitori, Deluxe Ramen, Chef's Roll, Beer | +Grill, 2nd dining room, Private room | 20–28 customers, frequent simultaneous complex orders | +Server, +specialist cooks | Tier 3 → Tier 4 | 4.0–4.8★ | ¥24,000–38,000 | Private/reservation dining, near-full staffing, deck seating | Push toward 5★; max out most upgrades |
| **5★ Push** | Variable (skill-dependent, not a fixed night count) | +Omakase Plate | All stations | Near-peak volume, VIP-heavy spawn bias | Near-full roster | Tier 4 → Tier 5 | 4.8–5.0★ | ¥35,000–45,000 | Manager hire, full-house nights | The nominal "win": hit 5.0★ |
| **Post-5★ Endgame** | Unbounded | +Seasonal/limited specials (Section 26) | All (fully upgraded) | Escalating "hard mode" nights available by choice | Full roster | Tier 5 (max) | Maintained 4.8–5.0★ (can dip/recover) | ¥40,000+, optimization-driven | Challenge nights, rare customers/ingredients, collection goals | Optimize, collect, maintain excellence, chase records |

Night counts above are **soft targets for a default-paced playthrough**, not hard gates — actual gating is always rating+cash+prerequisite (Section 15), so a highly efficient player can move faster and a casual player slower without the game feeling broken either way.

---

## 25. DIFFICULTY CURVE

Difficulty is built almost entirely from **logistics pressure**, not reflex or RNG cruelty, per the brief's "cozy first, stressful second":

- **Customer volume** ramps per-phase (Section 11) and per-night (Section 24) — more bodies in the room, more simultaneous tickets.
- **Order complexity** ramps via the Section 10 complexity-modifier curve — more items per ticket, more station-chains per item (Section 7).
- **Patience budgets** shrink slightly for higher-spend archetypes (Wealthy, Food Enthusiast) introduced in mid/late game, forcing prioritization decisions ("serve the impatient VIP or the forgiving regular first") rather than just "move faster."
- **Station bottlenecks** are the primary mid-game skill test: a single rice cooker genuinely cannot keep up with Peak Rush at Tier 1 — the *correct* response is buying a second slot/upgrade or a Sushi Chef, not grinding faster clicks. This makes upgrades feel *necessary*, not optional flavor.
- **Cleaning workload** scales with table count and turnover rate — without a Dishwasher hire, a busy late-mid-game night will visibly bury the solo player in dirty tables, which is the game's clearest "you need to hire someone now" signal.
- **No RNG-driven unfair spikes:** customer spawn is weighted-random but bounded (never more than N simultaneous "complex" orders queued without at least M real-seconds of spacing, a safety-valve constant) — chaos should always be *the player having fallen behind*, never *the dice having ganged up on them*.

**Explicit anti-punishment design:** no game-over state (Section 0.4); a terrible night costs rating-momentum and that night's profit, nothing more — the player always gets to see their sunrise and start fresh tomorrow. Patience expiring costs one customer's payment and a small rating ding, never a cascading penalty. This is the mechanical expression of "cozy first."

**"Satisfying chaos" beat:** Peak Rush (Section 11) is *designed* to feel borderline-too-much for a solo, unupgraded Tier-1 player on Night 1–2 — that's intentional and desirable (it's the hook that makes buying the first few upgrades feel earned), but it must always be *survivable* (no station fully blocks forever, no customer combination is mathematically unservable in time) — this is a balancing invariant to test explicitly, not just a vibe.

---

## 26. REPLAYABILITY / POST-5-STAR CONTENT

Reaching 5★ is a **milestone, not an ending** (Section 0.4/24). Post-5★ systems, roughly in build-priority order:

1. **Challenge Nights (opt-in, selected before a shift starts):** modifiers like "Blizzard Night" (harsher weather, big tips), "VIP Night" (Wealthy/Food Enthusiast spawn weight way up — high risk, high reward), "Rush Hour" (compressed clock, higher volume) — these reuse every existing system (Sections 9–12) with retuned parameters, not new mechanics, keeping this cheap to build and endless to extend.
2. **Rare customers & special orders:** low-probability unique archetype variants (e.g., a celebrity chef customer who, if served a perfect Omakase, gives a one-time large cash/rating bonus and a cosmetic unlock) — rare enough to feel like an event, built on the existing archetype system (Section 9) as data, not new code.
3. **Rare ingredients:** occasional special deliveries (tied to the Fisherman archetype's "gift" trait, Section 9) unlock a very limited one-night-only premium recipe variant — a light "spice," not a crafting system.
4. **Seasonal events (flagged by night-number ranges, not a calendar, per Section 0.7):** e.g., a "New Year" night with specific decor/menu flags, a "Hanami" (cherry blossom) night with a one-off exterior dressing swap. Content-only, reusing all existing systems.
5. **Perfect-night challenges / records:** the game already computes a per-night scorecard (Section 14) — surfacing "Best Night" records (highest profit, highest avg satisfaction, perfect 100% accuracy nights) in a simple stats screen gives goal-chasers something to optimize against without new simulation work.
6. **Collection completion:** menu-items-unlocked, apartment-items-owned, and regulars-met counters, each with a simple completion percentage shown in a stats/collection screen — cheap, data-driven, satisfies "collectors."
7. **Fully-upgraded-restaurant state** is itself a reachable, displayable milestone (a "max tier, max upgrades" badge) for players who just want to finish the build-out.

Deliberately **not** pursued (see Section 0/37/38 for why): procedural roguelike runs, permadeath/reset modes, or any system that would contradict the "cozy, same-restaurant-forever" identity established in Section 0.2. Replayability here means *depth and texture within the one restaurant*, not a second game mode bolted on.

---

## 27. SAVE SYSTEM

**Format:** a single versioned JSON blob in `localStorage` (MVP) — migrated to an IndexedDB-backed store (Full scope) once save size grows past comfortable localStorage limits (apartment items + regulars list + lifetime stats are the fields most likely to grow large over a long playthrough).

**Top-level schema (illustrative, not final field names — this is the shape, Section 29 owns exact typing):**

```json
{
  "saveVersion": 3,
  "player": {
    "character": { "bodyType": "avg", "hair": 2, "hairColor": 1, "skinTone": 3, "eyes": 0, "outfit": 0 },
    "settings": { "volumeMaster": 0.8, "volumeMusic": 0.6, "mouseSensitivity": 0.5, "colorblindMode": "off" }
  },
  "economy": {
    "cash": 128450,
    "lifetimeRevenue": 918200,
    "lifetimeProfit": 412300,
    "bestNightProfit": 27450
  },
  "restaurant": {
    "tier": 3,
    "rating": 3.86,
    "ownedUpgradeIds": ["rice_cooker_2", "sushi_counter", "conveyor_1", "..."],
    "unlockedDishIds": ["tea_green", "nigiri_salmon", "..."],
    "unlockedStationIds": ["kettle", "rice_cooker", "sushi_counter", "..."],
    "employees": [{ "roleId": "dishwasher", "hiredNight": 6 }]
  },
  "apartment": {
    "ownedItemIds": ["bed_basic", "rug_01", "lamp_01"]
  },
  "customers": {
    "regulars": [
      { "id": "reg_0007", "archetypeId": "elderly_couple", "name": "The Satos", "visits": 9, "favoriteDishId": "miso_soup", "lastSeenNight": 14 }
    ]
  },
  "progression": {
    "currentNight": 15,
    "statistics": { "totalCustomersServed": 612, "totalDishesSold": 1480, "perfectNights": 3 }
  }
}
```

**Forward-compatibility rule:** every load path runs the save through a **migration chain** keyed on `saveVersion` (v1→v2→v3…, each step a pure function adding/renaming/defaulting fields) rather than branching logic scattered through gameplay code — a new field ships with a default-value migration step, never a schema-breaking assumption baked into gameplay code. This is the concrete mechanism satisfying "design the save format so it can evolve without breaking old saves."

**Autosave points:** end of each night (after the summary screen is dismissed), after any shop/upgrade purchase, after any apartment purchase, on explicit pause-menu "Save" — never mid-shift mid-action (avoids corrupt-mid-prep-job edge cases; a shift interrupted by closing the tab simply restarts that night, which is an acceptable, clearly-communicated loss window).

---

## 28. GAME STATES

```
MainMenu
  ├─(New Game)→ CharacterCreation → Apartment(intro, empty) → RestaurantPrep → ActiveShift
  └─(Continue)→ RestaurantPrep → ActiveShift

RestaurantPrep         (brief walk-around before opening; also the hub between-state)
  ├─(Open Door)→ ActiveShift
  ├─(Shop)→ UpgradeShop → RestaurantPrep
  ├─(Go upstairs)→ Apartment → RestaurantPrep
  └─(Pause→Save&Quit)→ MainMenu

ActiveShift             (clock running; core gameplay loop, Section 3)
  ├─(Esc)→ Paused → (Resume)→ ActiveShift
  ├─(Esc)→ Paused → (Save&Quit)→ MainMenu
  └─(Last Call fulfilled + clean-up done)→ SunriseSequence

SunriseSequence         (non-skippable in MVP; Full scope allows a skip-ahead affordance)
  └─(sequence ends)→ EndOfNightSummary

EndOfNightSummary
  └─(Continue)→ RestaurantPrep   [next night's currentNight increments here]

UpgradeShop             (diegetic-backdrop panel UI, Section 23)
  └─(Close)→ RestaurantPrep

Apartment               (walkable diorama + its own small ApartmentShop sub-panel)
  └─(Leave)→ RestaurantPrep

Paused                  (overlay; clock frozen; reachable only from ActiveShift)
  ├─(Resume)
  ├─(Settings)
  └─(Save & Quit to Main Menu)
```

**Key rule:** the clock only ever runs during `ActiveShift`. Every other state is zero-pressure by construction — shopping, apartment-decorating, and character creation are explicitly never timed, protecting the brief's "avoid unnecessary menus/abstract management... during the core shift" by making sure *all* menu-heavy states live firmly outside the timed loop.

---

## 29. DATA ARCHITECTURE

Everything that is "content" (as opposed to "engine/systems") is a typed data record, loaded from static data modules at boot, referenced everywhere else by string ID. Adding content = adding a record; the systems in Sections 6–22 are written once against these shapes and never special-case a specific dish/customer/upgrade by name.

Representative TypeScript interfaces (schema contract, not final implementation file layout):

```ts
interface Ingredient {
  id: string;
  name: string;
  iconId: string;
  costPerUnit: number;
  startingStockCapacity: number;
}

interface Station {
  id: string;
  name: string;
  category: "cooking" | "service" | "washing";
  baseSlotCount: number;
  acceptedRecipeIds: string[];
  requiredUpgradeId?: string;     // null = available from Tier 1
}

interface Recipe {
  id: string;
  name: string;
  iconId: string;
  category: "sushi" | "hot" | "drink";
  stationSequence: string[];      // ordered station IDs; length = complexity
  requiredIngredients: { ingredientId: string; qty: number }[];
  basePrepTimeSeconds: number;
  sellPrice: number;
  foodCost: number;
  unlock: UnlockCondition;        // see below
  isSignatureDish?: boolean;      // drives Tourist "famous dish" behavior
}

interface UnlockCondition {
  minNight?: number;
  minRating?: number;
  minRestaurantTier?: number;
  requiresUpgradeId?: string;
}

interface CustomerArchetype {
  id: string;
  name: string;
  modelVariantId: string;
  basePatienceSeconds: number;
  spendTier: "low" | "medium" | "high" | "veryHigh";
  preferredRecipeIds: string[];   // weighted via a parallel weights array
  traits: string[];               // e.g. ["regularEligible","giftsIngredients","photoMoment"]
  tipRateBase: number;
  partySize: number;
}

interface Upgrade {
  id: string;
  name: string;
  category: "cooking" | "service" | "restaurant" | "staff";
  moneyCost: number;
  effect: UpgradeEffect;          // tagged union: stationUnlock | statModifier | roomUnlock | staffHire ...
  prerequisites: {
    minRating?: number;
    minRestaurantTier?: number;
    requiresUpgradeIds?: string[];
  };
  worldChangeRef: string;         // asset/scene-toggle ID applied next night
}

interface EmployeeRole {
  id: string;
  name: string;
  nightlyWage: number;
  behaviorId: string;             // FSM behavior tree key, Section 17
  unlock: UnlockCondition;
}

interface ApartmentItem {
  id: string;
  name: string;
  cost: number;
  slotTags: string[];             // which preset placement slots it can occupy
}

interface NightTimingConfig {
  startTime: string; sunriseTime: string;
  minutesPerGameHour: number;
  phases: { id: string; startTime: string; spawnRateMultiplier: number }[];
}

interface WeatherTrack {
  id: string;
  states: { state: WeatherState; untilMinuteOffset: number }[];
  weight: number;                 // selection probability
}
```

**Registries:** at boot, each table above loads into a simple `Map<id, record>` registry (`RecipeRegistry`, `UpgradeRegistry`, etc.) — all runtime systems query these registries by ID, never hold ad-hoc literals. Balancing (Section 35) means editing these data files; no gameplay-code changes required for numeric tuning, new dishes, new customer types, or new upgrades, directly satisfying the brief's "adding a new dish should require defining data rather than rewriting core gameplay code."

---

## 30. TECHNICAL ARCHITECTURE

No existing code to preserve (Section 0.1) — this is a clean recommendation, chosen specifically for a solo/small-team browser project that must stay data-driven, performant, and staticly hostable.

**Stack:**
- **Language:** TypeScript (strict mode) throughout — world systems and UI alike.
- **Renderer:** three.js (WebGL2 renderer). WebGPU is explicitly **not** targeted for MVP/Full (immature cross-browser support as of now would risk the "desktop-first, reliable" goal); architect the render layer behind a thin internal interface so a WebGPU backend swap is *possible* later without touching gameplay code (Future, Section 36).
- **Build tooling:** Vite (dev server + static production build) — output is pure static assets, deployable as-is to GitHub Pages/Cloudflare Pages with zero backend.
- **UI layer:** plain DOM/CSS overlay (absolutely positioned HTML over the WebGL canvas) driven by a small custom reactive store (observable state slices + subscriber callbacks, ~a couple hundred lines, hand-rolled) rather than adopting a full UI framework — keeps bundle size and mental-model overhead low for a project whose UI needs (Section 23) are intentionally minimal. If UI complexity grows faster than expected (e.g., the Shop screen wants real component reuse), promoting this layer to a lightweight framework (Solid or Svelte, both small-bundle) is a contained, acceptable pivot — not a rewrite, since it only touches the DOM layer, never the simulation.
- **Audio:** Howler.js — handles layered/crossfaded music stems and a pooled SFX system with far less boilerplate than hand-rolling Web Audio graph management, acceptable dependency weight for the audio feature list in Section 22.
- **State/simulation core:** a hand-rolled lightweight entity-component pattern (plain objects/classes, no external ECS library) for customers/staff/stations/interactables — the entity counts in this design (dozens, not thousands) don't justify a dedicated ECS library's complexity; revisit only if Future-scope endgame crowd density (Section 36) ever demands it.
- **Persistence:** `localStorage` wrapped in a small typed save-manager module (MVP) → swap internals to `idb-keyval` (IndexedDB) under the same module interface when save size demands it (Full scope) — the swap is internal to one module, never touches calling code.
- **Testing:** Vitest for pure-logic unit tests (economy formulas, rating formula, unlock-gating logic, save migration chain — all pure functions, all highly testable in isolation per Section 35). No heavy e2e/visual testing in MVP; Playwright smoke-test (does the game boot, can the player move) is a reasonable Full-scope addition.
- **Lint/format:** ESLint + Prettier, enforced via a pre-commit hook or CI check once a CI pipeline exists (Future).

**Module boundaries (top-level source layout intent, not file-by-file):**
```
/src
  /data        — all Section 29 content tables (recipes.ts, stations.ts, customers.ts, upgrades.ts, ...)
  /sim         — simulation systems: economy, rating, order lifecycle, customer FSM, staff FSM, weather/time
  /world       — three.js scene setup, interactable registry, raycast/interaction controller, asset loading
  /ui          — DOM overlay components + the reactive store
  /audio       — Howler setup + sound-cue mapping
  /save        — save schema types + migration chain + persistence adapter
  /app         — top-level game-state machine (Section 28) wiring everything together
```
This boundary is the main thing worth protecting as the project grows: **`/sim` never imports from `/world` or `/ui` directly** (it emits events/state that those layers read), which is what keeps "add a dish" or "retune the rating formula" from ever requiring touching rendering or UI code.

---

## 31. PERFORMANCE STRATEGY

Target: stable 60fps on mid-range discrete-GPU laptops in a browser tab, with a graceful-degradation path for integrated GPUs.

- **Geometry budget:** low-poly by design (Section 21) keeps triangle counts naturally low; merge static dining-room/decor geometry into as few draw calls as practical (static batching) since decor is the majority of on-screen triangles and never animates.
- **Lighting:** a strict budget of real-time dynamic lights (a handful of key lantern/fixture lights with shadows, everything else baked/fake via emissive materials + baked light probes or simple vertex lighting) — warm "density of light sources" (Section 21) is achieved mostly through emissive materials and bloom, not through dozens of real dynamic point lights, which would blow the draw-call/shadow-map budget fast.
- **NPCs:** customers/staff are simple skinned low-poly meshes, no per-character cloth/hair simulation; animation via a small shared skeleton + a handful of reused animation clips (walk, sit, eat, idle, pay, leave) across all archetypes (only material/color varies per archetype) — keeps animation system cost flat regardless of roster size.
- **Object pooling:** customers, dirty-dish props, and steam/particle emitters are all pooled (fixed-size pre-allocated pools recycled as customers arrive/leave) rather than instantiated/destroyed per spawn — avoids GC churn during Peak Rush, which is exactly when a frame hitch would be most noticeable/costly.
- **Snow/particles:** GPU-instanced particle system for snowfall (one draw call, instance buffer updated on GPU where possible) rather than per-flake JS-driven objects; density tiers (Section 12) just change instance count/area, not system architecture.
- **Ocean:** a single low-subdivision plane with a cheap vertex-displacement + normal-scroll shader — explicitly not a FFT/Gerstner-wave ocean sim, which would be wildly disproportionate to this being background scenery seen through a window.
- **Collision:** simple AABB/capsule-vs-static-box collision for the player against room geometry and furniture bounding boxes — no physics engine needed (no rigid-body simulation anywhere in this design; held/placed items snap to known slots rather than being physically simulated).
- **UI:** DOM overlay elements are kept to a small, mostly-static count (Section 23 deliberately minimizes concurrent floating UI); any frequently-updating element (patience bars) updates via direct style mutation on a small fixed pool of DOM nodes, not re-render-from-scratch, to avoid layout thrash.
- **Asset loading:** glTF/GLB for all models (three.js-native, compact with Draco/meshopt compression), texture atlasing per room-tier to minimize material/texture-swap overhead, and a lazy-load strategy where Tier 3–5 room assets only load once the player is near/has unlocked them (keeps initial load time low, important for a web game's first-impression window).

None of the above should be read as "build all of this up front" — Section 32–34 sequences performance work to land exactly when the relevant content (first customers, first particle system, first multi-NPC rush) actually exists to be optimized, not speculatively.

---

## 32. DEVELOPMENT PHASES

| Phase | Goal | Exit criteria |
|---|---|---|
| **P0 — Engineering Scaffold** | Project boots, renders an empty room, player can walk around and look | A grey-boxed Tier-1 room, WASD+mouse movement, Esc pause, deployed to a static host |
| **P1 — Interaction Core** | Prove the pick-up/place verb set | Player can pick up a placeholder object and place it on a placeholder surface, with hover prompts |
| **P2 — First Cooking Loop** | One station, one dish, cook it end to end | Rice Cooker → pick up rice → "serve" to a static dummy target; no customers yet |
| **P3 — First Customer** | One customer archetype, one order, full serve-and-pay cycle | A customer spawns, orders Tea, player serves it, customer pays, cash HUD updates |
| **P4 — Time & Shift Loop** | Full single-night loop start to finish | Clock runs, multiple customers arrive over a compressed test-shift, Last Call fires, a (simplified) sunrise plays, end-of-night summary shows |
| **P5 — Night 1 Vertical Slice** | The actual intended Night 1 experience, polished | Real art pass on Tier-1 room + 3 starting dishes + 3 archetypes (Section 9 MVP) + real sunrise (Section 21 MVP) + save/load works across a browser refresh |
| **P6 — Economy & Rating** | Make the loop matter across multiple nights | Rating formula (MVP terms) live, Shop screen with ~8 upgrades purchasable and visible in-world next night, unlock-gating works |
| **P7 — Content Breadth** | Early/Mid game content per Section 24 | Full MVP food tree through Mid Game tier, remaining archetypes, weather MVP (Clear/Snow), conveyor belt, first staff hire (Dishwasher) |
| **P8 — Apartment & Character Creation** | Secondary systems online | Character creation screen (MVP option set), apartment walkable with 2–3 purchasable items |
| **P9 — Full Content Pass** | Everything in Sections 8/9/15/17 at Full scope | Entire dish tree, full archetype roster incl. regulars, full upgrade graph, full staff roster, Tiers 2–5 built |
| **P10 — Full Rating/Weather/Audio/Visual Polish** | Everything at Full scope elsewhere | Full six-term rating formula, full weather enum + effects, full audio phase-adaptive layering, full sunrise sequence flourishes |
| **P11 — Post-5★ Content** | Replayability systems (Section 26) | Challenge nights, rare customers/ingredients, seasonal flags, stats/collection screen |
| **P12 — Hardening** | Ship-quality pass | Performance pass against Section 31 budgets on target hardware, save-migration tested against a real early-version save, accessibility pass (Section 23 Future items), bug pass |

---

## 33. VERTICAL SLICES

Restating the brief's explicit 12-point prototype list as concrete, demo-able milestones (each one strictly playable, each one a strict superset of the last):

1. **Slice A (P0+P1):** Walk around a grey-box room, pick up a cube, place it on a marked surface. *Proves the control scheme is fun on its own.*
2. **Slice B (P2):** Slice A + one real station (Rice Cooker) with a real prep-time/ready-state, one real pickup-able food item.
3. **Slice C (P3):** Slice B + one customer who sits, shows an order ticket, accepts the correct item via the serve-click, pays, leaves. *Proves the full core verb loop end to end on a single customer.*
4. **Slice D (P4):** Slice C + a running clock, multiple customers over a short compressed shift, a basic Last-Call/clean-up/simplified-sunrise beat, and an end-of-night cash total. *This is the first build that is "a whole night," even if ugly.* **This is the "smallest version that proves the game is fun" target (see Section 39.A).**
5. **Slice E (P5):** Slice D with real Night-1 art/lighting/audio (Tier-1 room per Section 6/20/21/22 MVP scope), 3 starting dishes, 3 customer archetypes, and persistent save/load. **This is the "first substantial version worth showing someone" target (Section 39.B).**
6. **Slice F (P6–P8):** Slice E + Shop/upgrades + rating + apartment + character creation — a real multi-night progression loop exists.
7. **Slice G (P9–P11):** Full content breadth across every system — the complete intended game (Section 39.C).

---

## 34. MILESTONE ACCEPTANCE CRITERIA

Concrete, testable "done" conditions per phase (sampled at key milestones — every phase in Section 32 should get an equivalent list at build time; these are the pattern):

**P3 exit (first customer) is done when:**
- A customer entity spawns at the door, walks to an open table via its fixed waypoint, and sits (no navmesh failures, no clipping through furniture in the test room).
- An order ticket appears above them showing exactly one recipe icon, matching data from `CustomerArchetype.preferredRecipeIds`.
- Hovering the Rice Cooker shows the ambient "needed" glow described in Section 5/10.
- Serving the correct item removes the ticket, triggers the payment chime, adds `sellPrice` to the cash HUD, and the customer leaves via a walk-to-door-and-despawn sequence.
- Serving the *wrong* item soft-rejects per Section 5 (player keeps holding it, customer's ticket is unchanged).

**P4 exit (time & shift loop) is done when:**
- The HUD clock advances from `startTime` to `sunriseTime` at the configured rate and is pausable via Esc with zero drift on resume.
- At least 2 phases from Section 11's table produce measurably different spawn rates in a logged test run.
- Last Call correctly stops new spawns and the sunrise sequence only begins after all dirty tables are cleared (test: deliberately leave one dirty table and confirm the sequence withholds).
- The end-of-night summary shows a cash delta that mathematically matches the sum of that test-shift's served orders (automated check against a logged ledger, not eyeballed).

**P6 exit (economy & rating) is done when:**
- Purchasing an upgrade in the Shop deducts the correct `moneyCost`, is blocked correctly if `prerequisites` aren't met (test each prerequisite type at least once), and the corresponding `worldChangeRef` visibly applies on the next `ActiveShift` load.
- The rating formula (Section 14 MVP) produces a changed `restaurant.rating` after a test night with deliberately poor accuracy, and a different (better) result after a deliberately perfect test night — i.e., the formula is verified directionally correct via unit test (Section 35), not just "it runs."
- A save → reload cycle preserves `cash`, `rating`, and `ownedUpgradeIds` exactly.

This pattern (behavioral assertion + at least one automated/loggable check, not just "feels right") should be applied to every phase exit before moving on — it's what keeps "incremental" from silently becoming "accumulating undetected regressions."

---

## 35. BALANCING VARIABLES

Every number below is a named, data-file-resident constant (Section 29) — this is the explicit "balancing owns these, not code" list:

- `NightTimingConfig`: `minutesPerGameHour`, phase boundary times, per-phase `spawnRateMultiplier`.
- Per-recipe: `basePrepTimeSeconds`, `sellPrice`, `foodCost` (and thus the derived food-cost ratio, target ≈30–35%).
- Per-archetype: `basePatienceSeconds`, `tipRateBase`, `spendTier` → actual spend range mapping, order-complexity weighting.
- Rating formula weights (Section 14's six coefficients + the 0.75/0.25 momentum split) — explicitly called out as the single highest-leverage, most-worth-playtesting tuning surface in the whole game, since it indirectly paces nearly everything else (content gating).
- Upgrade `moneyCost` curve and `prerequisites` thresholds — the main anti-rush-buying lever (Section 15).
- Employee `nightlyWage` per role vs. the throughput each role adds — must be tuned so hiring is a clear net-positive once volume justifies it, but not a trivial auto-buy from Night 1.
- Weather track selection weights and per-state arrival/tip multipliers (Section 12).
- Safety-valve constants bounding simultaneous "complex" order queuing (Section 25) — the chaos-but-fair guarantee.
- Customer spawn-pool composition per phase/night (which archetypes are eligible, and at what weight) — the lever that makes Late Game "feel" different from Early Game beyond raw volume.

Recommendation: expose a subset of these (at minimum the rating weights and the spawn-rate curve) behind a simple internal dev-console or a JSON hot-reload path during development, since this is the category of system that genuinely benefits from rapid iterate-and-playtest cycles rather than guessing correctly up front.

---

## 36. FUTURE EXPANSION POSSIBILITIES

Explicitly out of scope for the Full implementation defined above, but compatible with this architecture if pursued later:

- WebGPU renderer backend (behind the Section 30 render-interface seam).
- Optional ingredient spoilage mechanic (adds a light resource-management layer to Section 8 for players who want more logistics depth) — would be an opt-in difficulty-mode toggle, not a default-on system, to protect the cozy-first mandate.
- Unlockable cosmetic rewards (character outfits, apartment decor sets) tied to milestone achievements (Section 26 collection tracks feeding Section 19's cosmetic tables).
- Weather-reactive sunrise visual variants (Section 21).
- A trash/compost interactable and a food-waste stat, if playtesting shows misserved food needs a more tactile "undo."
- Manager auto-pilot mode expanded into a deeper "delegate the whole floor for N minutes" tool, for players deep in the post-5★ phase who want to intentionally play a more managerial, less hands-on late-late-game.
- A photo-mode (natural fit given the Sunrise system's visual ambition and the Tourist archetype's "photo moment" trait already hinting at it).
- Rain/mixed-precipitation weather for a non-winter seasonal event track.
- A second renderer-level detail pass (better ocean shader, volumetric god-rays) once/if WebGPU lands, without touching gameplay.
- Controller input support (the control scheme in Section 4 is simple enough to map to a gamepad relatively cheaply later; not pursued now because "desktop-first" in the brief reads as mouse/keyboard-first).

None of these should be designed against now — they're listed so the architecture (Sections 29/30 especially) doesn't accidentally foreclose them.

---

## 37. RISKS / TECHNICAL CHALLENGES

- **NPC crowd behavior at scale:** the fixed-waypoint/FSM approach (Section 0.6) is intentionally simple, but Late Game's 20–28 covers with multiple staff NPCs simultaneously pathing is the single most likely place "simple" quietly becomes "visually janky" (customers clipping, staff colliding, queueing weirdly at a popular station). Mitigation: cap concurrent active NPCs conservatively, reserve explicit "slots" per station/table so two agents never target the same resource, and playtest Late Game density specifically and early (don't discover this risk at P9).
- **The Sunrise sequence is a lot of coordinated moving parts** (sky shader, sun disc, lighting ramps, ocean reflection, audio crossfade, player retains control throughout) landing in one scripted sequence — the risk is scope creep on the game's most visible, most-screenshotted feature. Mitigation: build the MVP version (Section 21) early and get it *feeling right* before adding flourishes; treat it as its own mini-project with its own acceptance checklist, not a line item inside a bigger phase.
- **Rating-formula legibility vs. balance tension:** a formula transparent enough to "feel fair" (Section 14's design goal) but also correctly pacing a 30+ night content gate is a genuinely hard tuning problem, not just an engineering one. Mitigation: ship the scorecard breakdown UI early (even in MVP, even ugly) so real playtesters can report "I don't understand why my rating dropped" concretely, rather than the designer guessing in the dark.
- **Performance regression risk concentrated at Peak Rush**, specifically: many NPCs + many active particle emitters (steam at every station) + snow + dynamic lighting all peak simultaneously exactly when frame-time matters most to feel (chaos should feel kinetic, not laggy). Mitigation: Section 31's pooling/budget strategy must be validated under a synthetic "worst case Peak Rush" stress test *before* P9's full content lands, not discovered after.
- **Scope discipline on the Apartment system:** explicitly flagged by the brief as secondary, but "small cozy decorating side-system" is exactly the kind of feature that's fun to keep adding to. Mitigation: the Section 18 item catalog should be finite and closed at Full scope (a fixed list, not an open-ended one), with anything beyond it routed to Section 36 Future.
- **Browser audio-autoplay restrictions:** ambience/music can't programmatically start before a user gesture in most browsers — needs an explicit "click to start" gate on the Main Menu (a near-universal web-audio gotcha, cheap to handle if planned for, annoying if discovered late).
- **Save migration discipline requires real tests, not just a plan:** Section 27's migration chain is only as good as the test that runs an actual old-shape save through it on every future field change — this needs to be a committed CI-style check (even a simple one) once P6+ saves exist in the wild (i.e., once anyone but the dev has played across a version bump).

---

## 38. RECOMMENDED BUILD ORDER

Follows Sections 32–34 directly; restated here as a short, unambiguous sequence an implementing agent can start executing immediately after this document is approved:

1. Scaffold the Vite+TypeScript+three.js project, deploy a "hello world" grey box to a static host (proves the full pipeline, including hosting, on day one — don't discover deployment problems at the end).
2. Build the player controller (movement/look/collision) and the Section 5 interaction/raycast system against grey-box placeholders (Slice A).
3. Build the `/data` + registry pattern (Section 29) early, even with just 2–3 records per table — establish the data-driven discipline before content volume makes retrofitting painful.
4. Build one real Station + one real Recipe end to end (Slice B).
5. Build the Customer FSM against one archetype + the Order system MVP (Slice C) — this is the riskiest/most central system (Section 37's first risk), get it proven before content breadth.
6. Build the Night clock/phases + a simplified Sunrise + end-of-night summary (Slice D) — "a whole ugly night" milestone.
7. Reskin Slice D's Tier-1 room with real art direction (Section 20/21 MVP) and bring the Sunrise sequence to its real MVP form — this is the first build worth taking a screenshot of.
8. Build save/load (Section 27) against the state that exists by now — easier to build save correctly against a small schema than retrofit it later.
9. Build the Shop/Upgrades screen + rating formula MVP (Section 14/15/28) — turns "one night" into "a game that remembers and progresses."
10. From here, proceed per Section 32 phases P7 onward (content breadth, apartment, character creation, full systems) — the hard architectural risks are retired by this point; remaining work is substantially data/content authoring against established systems.

---

## 39. FINAL MASTER SPECIFICATION

### A. Smallest version that proves the game is fun
**Vertical Slice D** (Section 33): grey-boxed Tier-1 room, one customer archetype, 3 dishes, one real station chain, a real running clock, a compressed test-shift, a simplified sunrise, cash total at the end. No shop, no rating, no save, no apartment, placeholder art throughout. If the pick-up→carry→serve loop against a ticking clock isn't satisfying *here*, no amount of later content fixes it — this is the go/no-go checkpoint.

### B. First substantial version worth showing someone
**Vertical Slice E / end of Phase P5:** real Night-1 art direction and lighting (Section 20/21 MVP), the real Section 21 MVP sunrise, 3 starting dishes, 3 customer archetypes (Salaryman/Elderly Couple/Family), working save/load, the full HUD (Section 23 MVP). This is a complete, polished *single night*, repeatable, screenshot-worthy, and honest about what's not there yet (no shop, no progression across nights).

### C. The full intended game
Everything specified in Sections 1–31 at **Full implementation** scope: all 5 restaurant tiers, the full dish tree through Omakase, the full 11-archetype customer roster with regulars, the full six-term rating formula, the full ~30–40 item upgrade graph, the full staff roster, apartment with full item catalog + CRT vignette, full weather enum with gameplay effects, full phase-adaptive audio, the full layered sunrise sequence, and the Section 26 post-5★ replayability suite (challenge nights, rare customers/ingredients, seasonal flags, stats/collection screen).

### D. What should explicitly NOT be built yet
- Freeform building/placement tooling (Section 16) — tiered expansion only.
- Any multiplayer, cloud save, or monetization system (Section 0.5) — not part of this product's identity.
- Procedural/roguelike run structure, permadeath (Section 26) — contradicts the "same restaurant forever" thesis.
- WebGPU renderer migration (Section 36) — premature given current browser support reality.
- Ingredient spoilage, trash/compost systems, deep crafting (Section 36) — would add friction before the core loop has even proven itself fun.
- Full NPC crowd-simulation/navmesh pathfinding — fixed-waypoint FSM is sufficient and the correct scope for this design (Section 0.6).
- Photo mode, controller support, cosmetic-unlock economy (Section 36) — polish/retention features, not core-loop features; premature before the core loop ships.
- Any mid-shift shopping/menu system — violates the brief's explicit "avoid unnecessary menus during the core shift" and this document's Section 28 state-machine contract.

---

## First Implementation Tasks (post-approval)

1. Scaffold the repository: Vite + TypeScript + three.js, strict lint/format config, and a deployed-to-static-host "hello box room" to validate the full pipeline immediately (Build Order step 1).
2. Implement the first-person player controller: WASD movement, mouse-look, Shift-sprint, simple AABB collision against a grey-box room (Section 4/31).
3. Implement the core interaction system: forward raycast, hover-prompt UI, single-slot hand, pick-up/place/Q-putaway against placeholder cubes (Section 5, Slice A).
4. Stand up the `/data` registry pattern with 2–3 seed records each for `Ingredient`, `Station`, `Recipe`, `CustomerArchetype` (Section 29) — establish data-driven discipline before any content volume exists.
5. Build one real Station (Rice Cooker) + one real Recipe (Salmon Nigiri, simplified to its first prep step) with a visible ready-state (Section 7, Slice B).
6. Build the Customer FSM (spawn → walk-to-seat → order → wait-with-patience → eat → pay → leave) against one archetype, plus the Section 10 order-ticket UI (Slice C) — treat this as the highest-risk, highest-priority system per Section 37.
7. Build the Night clock + phase table + Last-Call trigger + a bare-bones end-of-night cash summary (Section 11/28, Slice D) — the first build that is "a whole night."
8. Build the Section 21 MVP sunrise sequence (sky gradient sweep, sun-disc rise behind a Fuji silhouette card, basic audio crossfade) as its own focused mini-milestone, independent of the rest of the shift loop's polish level.
9. Build the save/load module against the schema that exists after tasks 1–8 (Section 27) — small schema now, before it grows.
10. Build the Shop/Upgrades screen + the Section 14 MVP rating formula (accuracy + satisfaction only), wiring the first purchasable upgrade (Better Rice Cooker) to a visible in-world change on the next shift load (Section 15/28).
