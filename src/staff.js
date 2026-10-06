// Hired help, bought from the catalog and paid at sunrise. They walk the shop and do the work the way you would, by
// the same rules (whoever runs the shop, solo or the co-op host, runs them; everyone sees them at it):
//   Taro, dishwasher and busboy: clears tables as guests leave, carries the tub back to the sink, washes, takes the
//     clean ones back out to the shelves, and takes the trash out when the bin's full.
//   Kenji, sushi chef: nigiri, onigiri and (once the freezer's running) matcha ice cream; down the belt for the
//     belt's guests, onto the pass for everyone else.
//   Ren, cook: fires the grills, the teppan, the fryer and the ramen pot for what's been ordered, and plates it
//     onto the pass.
//   Yui, waiter: takes orders, pours tea, and carries dishes from the pass (or off any counter) out to the tables,
//     up to three at a time on a tray.
//   Hana, hall server: rings people up at the register, and takes orders when nobody's waiting to pay.
// With all five on, the shop runs itself.
import { Person } from './npc.js';
import { MENU } from './service.js';
import { MAP } from './maps/index.js';

const LOOKS = {
  staff_wash: { name: 'Taro', look: { skin: '#e0ac85', hair: '#1a1412', coat: '#e8e4dc', pants: '#2a3a5a', shoes: '#141414', hairStyle: 0, hat: -1, glasses: true, long: false, umbrella: '#141416', scarf: '#2a5a8a' } },
  staff_sushi: { name: 'Kenji', look: { skin: '#c68863', hair: '#3a2418', coat: '#f0ece4', pants: '#1c1c20', shoes: '#141414', hairStyle: 3, hat: 0, glasses: false, long: false, umbrella: '#141416', scarf: null } },
  staff_cook: { name: 'Ren', look: { skin: '#d8a07a', hair: '#141010', coat: '#f4f2ec', pants: '#2a2a2e', shoes: '#141414', hairStyle: 1, hat: 0, glasses: false, long: false, umbrella: '#141416', scarf: '#c8302a' } },
  staff_waiter: { name: 'Yui', look: { skin: '#f0c8a0', hair: '#2a1a12', coat: '#1a1a1e', pants: '#1a1a1e', shoes: '#141414', hairStyle: 4, hat: -1, glasses: false, long: true, umbrella: '#141416', scarf: '#e8e4dc' } },
  staff_hall: { name: 'Hana', look: { skin: '#f1c9a5', hair: '#1a1412', coat: '#24324e', pants: '#24324e', shoes: '#4a2a18', hairStyle: 4, hat: -1, glasses: false, long: true, umbrella: '#141416', scarf: '#a82a2a' } },
};
const COOKED = ['yakitori', 'gyoza', 'tempura', 'ramen'];
const PLATED = ['sushi', 'onigiri', 'icecream'];
const SPEED = 2.0;
const TRAY = 3; // a waiter carries up to three things on a tray

export class Staff {
  constructor({ scene, service, litMat, emitMat }) {
    this.service = service;
    this.people = {};
    for (const [id, l] of Object.entries(LOOKS)) {
      const post = MAP.shop.staff[id]; if (!post) continue;
      const person = new Person(l.look, litMat, emitMat);
      person.group.position.set(post.x, 0.25, post.z); person.group.rotation.y = post.yaw; person.group.visible = false;
      scene.add(person.group);
      this.people[id] = { id, name: l.name, post, person, pos: { x: post.x, y: 0.25, z: post.z }, yaw: post.yaw, path: null, then: null, busy: 0, task: null, dish: null, tray: [], carry: null, carryKey: null, speed: 0 };
    }
    this.t = { wash: 0, sushi: 0, pay: 0, think: 0 };
    this.did = { washed: 0, carried: 0, sushi: 0, orders: 0, rang: 0, bussed: 0, cooked: 0, served: 0, trash: 0 }; // a tally, for the playtest
    this.claimed = new Set(); // guests, counter items, seats and stations someone's already on their way to
  }
  hired(id) { return !!this.service.staff && this.service.staff.has(id) && !!this.people[id]; }
  // where everyone on shift is standing (doors don't swing shut on them)
  positions() { return Object.values(this.people).filter((p) => this.hired(p.id)).map((p) => p.pos); }

  // ---------------------------------------------------------------- getting about
  // along the crowd's walking grid; doors open for staff the way they do for guests
  walk(p, x, z, then) {
    const path = this.service.crowd.nav.path(p.pos.x, p.pos.z, x, z);
    p.path = path ? [...path, [x, z]] : [[x, z]]; p.then = then;
  }
  step(p, dt) {
    if (!p.path) return 0;
    const [tx, tz] = p.path[0], dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz), v = SPEED * dt;
    for (const door of this.service.crowd.doors || []) {
      if (!door.locked && !door.open && Math.hypot(door.center.x - p.pos.x, door.center.z - p.pos.z) < 1.1) door.toggle(p.pos);
    }
    if (d <= v) {
      p.pos.x = tx; p.pos.z = tz; p.path.shift();
      if (!p.path.length) { p.path = null; const f = p.then; p.then = null; if (f) f(); }
    } else {
      p.pos.x += dx / d * v; p.pos.z += dz / d * v;
      const want = Math.atan2(-dx, -dz); let dy = want - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * 10);
    }
    return SPEED;
  }
  // the nearest of a list of guests to someone
  nearest(p, list) { let best = null, bd = Infinity; for (const q of list) { const d = Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z); if (d < bd) { bd = d; best = q; } } return best; }
  face(p, x, z) { p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z)); }
  home(p) { p.task = 'home'; this.walk(p, p.post.x, p.post.z, () => { p.yaw = p.post.yaw; p.task = null; }); }
  // what's in their hands: a dish, the bus tub, a stack of clean ones, the trash bag
  hold(p, key) {
    if (p.carryKey === key) return;
    const s = this.service;
    if (p.carry) p.person.group.remove(p.carry);
    p.carry = null; p.carryKey = key;
    if (!key) return;
    const [kind, mugs, plates] = key.split(':');
    p.carry = s.heldModel({ type: kind, mugs: +mugs || 0, plates: +plates || 0 }).mesh(s.litMat, s.emitMat);
    p.carry.position.set(0, kind === 'trash' ? 0.62 : 0.98, -0.3);
    p.person.group.add(p.carry);
  }
  free(p) { return !p.task && !p.path; }

  update(dt, open) {
    const s = this.service, guest = s.role === 'guest';
    for (const p of Object.values(this.people)) {
      const on = this.hired(p.id);
      p.person.group.visible = on;
      if (!on) continue;
      p.busy = Math.max(0, p.busy - dt);
      const speed = guest ? p.speed : this.step(p, dt);
      p.pos.y += ((s.crowd.floorAt(p.pos.x, p.pos.z) || 0.25) - p.pos.y) * Math.min(1, dt * 10);
      p.person.group.position.set(p.pos.x, p.pos.y, p.pos.z); p.person.group.rotation.y = p.yaw;
      p.person.pose(dt, speed, 0, 0, false);
      // working arms (scrubbing, slicing, writing an order), or both out in front, carrying
      const w = speed ? 0 : Math.min(1, p.busy * 2);
      p.person.arms.forEach((a, i) => { if (p.carry) a.rotation.x = p.carryKey === 'trash' ? 0.25 : 1.2; else if (w) a.rotation.x = w * (0.9 + Math.sin(p.person.idleT * 9 + i * 2) * 0.25); });
      p.person.neck.rotation.x = 0.25 * w;
    }
    if (guest) return;
    if (!open) { this.claimed.clear(); return; }
    this.t.think -= dt;
    const think = this.t.think <= 0; if (think) this.t.think = 0.4; // the bigger decisions, a couple of times a second
    if (this.hired('staff_wash')) this.washer(dt, think);
    if (this.hired('staff_sushi')) this.sushi(dt);
    if (this.hired('staff_cook') && think) this.cook();
    if (this.hired('staff_waiter') && think) this.waiter();
    if (this.hired('staff_hall')) this.cashier(dt, think);
  }

  // ---------------------------------------------------------------- Taro: the sink, the tables, the bin
  washer(dt, think) {
    const s = this.service, p = this.people.staff_wash;
    if (!this.free(p)) return;
    const sinkN = s.sink.mugs + s.sink.plates, rackN = s.rack.mugs + s.rack.plates;
    const low = s.stock.plates < 3 || s.stock.mugs < 3;
    const atSink = Math.hypot(p.pos.x - p.post.x, p.pos.z - p.post.z) < 0.3;
    const wash = () => {
      if (!atSink) return this.home(p);
      p.busy = 0.6;
      if ((this.t.wash += dt) > s.washTime) {
        this.t.wash = 0;
        if (s.sink.mugs > 0) { s.sink.mugs--; s.rack.mugs++; } else { s.sink.plates--; s.rack.plates++; }
        s.washed++; this.did.washed++;
      }
    };
    const canWash = sinkN && !s.washing; // (not while you're at the sink yourself)
    // in order: clean ones out to the shelves when they're running short; washing when the shelves are short; the
    // trash when the bin's full; tables to clear; and the rest of the washing
    if (think && rackN && (rackN >= 4 || !canWash)) return this.shelve(p);
    if (low && canWash) return wash();
    if (think) {
      const r = s.trash && s.trash.full() && s.trash.route();
      if (r) {
        p.task = 'trash';
        return this.walk(p, r.bin[0], r.bin[1], () => {
          if (!s.trash.n) return this.home(p);
          s.trash.empty(); this.hold(p, 'trash');
          const st = s.trash.route();
          this.walk(p, st.out[0], st.out[1], () => { s.trash.dropOff(st.key); this.hold(p, null); this.did.trash++; this.home(p); });
        });
      }
      if (this.dirtySeat(p)) return this.bus(p, { mugs: 0, plates: 0 });
    }
    if (canWash) wash();
  }
  dirtySeat(p, within = Infinity) {
    let best = null, bd = within;
    for (const st of this.service.crowd.seats) {
      if (!st.needsBus || st.occupant || !st.app || this.claimed.has(st)) continue;
      const d = Math.hypot(st.app[0] - p.pos.x, st.app[1] - p.pos.z);
      if (d < bd) { bd = d; best = st; }
    }
    return best;
  }
  bus(p, tub) {
    const s = this.service, seat = this.dirtySeat(p, tub.mugs + tub.plates ? 5 : Infinity);
    if (!seat || tub.mugs + tub.plates >= 8) {
      // back to the sink with what's in the tub
      p.task = 'bus';
      return this.walk(p, p.post.x, p.post.z, () => { s.sink.mugs += tub.mugs; s.sink.plates += tub.plates; this.hold(p, null); p.yaw = p.post.yaw; p.task = null; });
    }
    this.claimed.add(seat); p.task = 'bus';
    this.walk(p, seat.app[0], seat.app[1], () => {
      this.claimed.delete(seat);
      if (seat.needsBus && !seat.occupant) {
        for (const d of seat.dishes || []) { if (d.type === 'mugDirty') tub.mugs++; else tub.plates++; }
        s.dishGroup(seat).clear(); seat.dishes = []; seat.needsBus = false;
        this.face(p, seat.x, seat.z); p.busy = 0.6; this.did.bussed++;
      }
      if (tub.mugs + tub.plates) this.hold(p, `tub:${tub.mugs}:${tub.plates}`);
      this.bus(p, tub);
    });
  }
  // the rack's clean dishes, out to the shelves over the back bar
  shelve(p) {
    const s = this.service;
    const tub = { mugs: s.rack.mugs, plates: s.rack.plates }; s.rack.mugs = s.rack.plates = 0;
    p.task = 'shelve'; this.hold(p, `clean:${tub.mugs}:${tub.plates}`);
    const at = MAP.shop.urnStand || [p.post.x, p.post.z];
    this.walk(p, at[0] + 1.2, at[1], () => { s.stock.mugs += tub.mugs; s.stock.plates += tub.plates; this.hold(p, null); p.busy = 0.6; this.did.carried++; this.home(p); });
  }

  // ---------------------------------------------------------------- Kenji: nigiri and onigiri
  sushi(dt) {
    const s = this.service, p = this.people.staff_sushi;
    if ((this.t.sushi += dt) < 3.5) return;
    this.t.sushi = 0;
    // green tea for the belt's guests rides the belt too
    if (s.menuKinds.has('tea') && s.stock.mugs > 0 && this.wanted('tea').belt > 0 && s.belt.isFree(0.25)) { s.stock.mugs--; s.belt.add('tea', 0.25); p.busy = 1.0; this.did.sushi++; return; }
    for (const kind of PLATED) {
      if (!s.menuKinds.has(kind) || s.stock.plates <= 0) continue;
      const { belt, hand } = this.wanted(kind);
      if (belt > 0 && s.belt.isFree(0.25)) { s.stock.plates--; s.belt.add(kind, 0.25); p.busy = 1.5; this.did.sushi++; return; }
      // (onto the pass for the rest only if there's a waiter to carry it out)
      if (hand > 0 && this.hired('staff_waiter') && this.toPass(kind)) { s.stock.plates--; p.busy = 1.5; this.did.sushi++; return; }
    }
  }
  // how many of a dish are still wanted, by guests along the belt and elsewhere, less what's already on its way: on
  // the belt, in someone's hands, on a counter, cooking or waiting on a station
  wanted(kind) {
    const s = this.service;
    let belt = 0, hand = 0;
    for (const q of s.crowd.people) {
      if (!q.svc || q.svc.phase !== 'food' || !q.seat) continue;
      const n = q.svc.items.filter((i) => !i.done && i.kind === kind).length;
      if (s.seatBeltS(q.seat) !== null) belt += n; else hand += n;
    }
    const onBelt = s.belt.plates.filter((b) => b.type === kind).length;
    // dishes in someone's hands or set down on a counter go out by hand; what's on the belt goes round to the belt's
    // guests; what's still cooking can go either way
    const carried = Object.values(s.handsBy).flat().filter((h) => h.type === kind).length + s.counterItems.filter((c) => c.item.type === kind).length
      + Object.values(this.people).reduce((a, q) => a + (q.dish === kind ? 1 : 0) + q.tray.filter((t) => t.kind === kind).length, 0);
    const cooking = s.stations.filter((st) => st.kind === kind && (st.state === 'cooking' || st.state === 'ready')).reduce((a, st) => a + (st.state === 'ready' ? st.left || 1 : st.batch || 1), 0);
    belt = Math.max(0, belt - onBelt);
    let spare = carried - hand; hand = Math.max(0, hand - carried);
    if (spare > 0) belt = Math.max(0, belt - spare); // (you might put one on the belt)
    spare = cooking - hand; hand = Math.max(0, hand - cooking);
    if (spare > 0) belt = Math.max(0, belt - spare);
    return { belt, hand, total: belt + hand };
  }
  passSlot() { return (MAP.shop.pass || []).find(([x, , z]) => !this.service.counterItems.some((c) => Math.hypot(c.x - x, c.z - z) < 0.15)); }
  // is anyone sat waiting on this dish at all?
  anyoneWants(kind) { return this.service.crowd.people.some((q) => q.svc && q.seat && q.svc.phase === 'food' && q.svc.items.some((i) => !i.done && i.kind === kind)); }
  // a dish going cold on the pass that nobody's waiting on any more: into the sink with it, to make room
  clearStale() {
    const s = this.service;
    const c = s.counterItems.find((it) => !this.claimed.has(it) && (MAP.shop.pass || []).some(([x, , z]) => Math.hypot(it.x - x, it.z - z) < 0.15) && !this.anyoneWants(it.item.type));
    if (!c) return false;
    s.removeCounterItem(c); if (c.item.type === 'tea') s.sink.mugs++; else s.sink.plates++;
    return true;
  }
  toPass(kind) {
    if (!this.passSlot()) this.clearStale();
    const slot = this.passSlot(); if (!slot) return false;
    this.service.addCounterItem(this.service.nextItemId++, { type: kind }, slot[0], slot[1], slot[2], 0);
    return true;
  }

  // ---------------------------------------------------------------- Ren: the cook line
  cook() {
    const s = this.service, p = this.people.staff_cook;
    // a plate in hand and nowhere to put it: wait at the pass for a gap
    if (p.task === 'waitPass') {
      if (!this.anyoneWants(p.dish)) { s.sink.plates++; p.dish = null; this.hold(p, null); this.home(p); return; } // nobody's waiting on it now
      if (this.toPass(p.dish)) { p.dish = null; this.hold(p, null); this.did.cooked++; this.home(p); }
      return;
    }
    if (!this.free(p)) return;
    const stand = (st) => [st.x, st.z - 0.75];
    // something's ready: plate it and walk it to the pass
    const ready = s.stations.find((st) => st.state === 'ready' && COOKED.includes(st.kind) && !this.claimed.has(st));
    if (ready && s.stock.plates > 0) {
      this.claimed.add(ready); p.task = 'plate';
      this.walk(p, ...stand(ready), () => {
        this.claimed.delete(ready); this.face(p, ready.x, ready.z); p.busy = 0.8;
        if (ready.state !== 'ready' || s.stock.plates <= 0) return this.home(p);
        s.stock.plates--; ready.left = (ready.left || 1) - 1; if (ready.left <= 0) ready.state = 'idle';
        p.dish = ready.kind; this.hold(p, ready.kind);
        const at = MAP.shop.passCook || [p.post.x, p.post.z];
        this.walk(p, at[0], at[1], () => { this.face(p, at[0], at[1] - 1); p.task = 'waitPass'; });
      });
      return;
    }
    const burnt = s.stations.find((st) => st.state === 'burnt' && COOKED.includes(st.kind) && !this.claimed.has(st));
    if (burnt) {
      this.claimed.add(burnt); p.task = 'scrape';
      this.walk(p, ...stand(burnt), () => { this.claimed.delete(burnt); this.face(p, burnt.x, burnt.z); if (burnt.state === 'burnt') { burnt.state = 'idle'; s.sfx('sizzleBurst'); } p.busy = 0.6; this.home(p); });
      return;
    }
    // fire a station for something that's wanted and not already on its way
    // (only with a clean plate for it to go on, or it'll sit there and burn)
    const onLine = s.stations.filter((st) => COOKED.includes(st.kind) && (st.state === 'cooking' || st.state === 'ready')).reduce((a, st) => a + (st.state === 'ready' ? st.left || 1 : st.batch || 1), 0);
    if (s.stock.plates <= onLine) return;
    for (const kind of COOKED) {
      if (!s.menuKinds.has(kind) || this.wanted(kind).total <= 0) continue;
      const st = s.stations.find((x) => x.kind === kind && x.state === 'idle' && !this.claimed.has(x));
      if (!st) continue;
      this.claimed.add(st); p.task = 'fire';
      this.walk(p, ...stand(st), () => {
        this.face(p, st.x, st.z); p.busy = 0.8; this.claimed.delete(st);
        if (st.state === 'idle') { st.state = 'cooking'; st.t = 0; s.sfx('sizzleBurst'); }
        p.task = null; // stays by the line, ready for the next
      });
      return;
    }
    // nothing to do: back to the middle of the line
    if (Math.hypot(p.pos.x - p.post.x, p.pos.z - p.post.z) > 0.3) this.home(p);
  }

  // ---------------------------------------------------------------- Yui: dishes out to the tables, orders, tea
  waiter() {
    const s = this.service, p = this.people.staff_waiter;
    if (p.task === 'tray') return;
    if (!this.free(p)) return;
    const seated = (q) => q.svc && q.seat && q.state === 'sit' && !this.claimed.has(q);
    const wants = (q, kind) => q.svc.phase === 'food' && q.svc.items.some((i) => !i.done && i.kind === kind);
    // dishes waiting on the pass (or any counter) that seated guests want: as many as the tray holds
    const load = [];
    for (const c of s.counterItems) {
      if (load.length >= TRAY) break;
      if (c.big || !MENU[c.item.type] || this.claimed.has(c)) continue;
      const q = this.nearest({ pos: c }, s.crowd.people.filter((g) => seated(g) && wants(g, c.item.type) && !load.some((l) => l.q === g)));
      if (q) load.push({ c, q });
    }
    if (load.length) {
      for (const { c, q } of load) { this.claimed.add(c); this.claimed.add(q); }
      p.task = 'deliver';
      const first = load[0].c, onPass = (MAP.shop.pass || []).some(([x, , z]) => Math.hypot(first.x - x, first.z - z) < 0.2);
      const at = onPass && MAP.shop.passGrab ? MAP.shop.passGrab : this.standNear(first.x, first.z);
      this.walk(p, at[0], at[1], () => {
        this.face(p, first.x, first.z); p.busy = 0.5;
        for (const { c, q } of load) {
          this.claimed.delete(c);
          // anything that's not where it was (someone else took it) stays off the tray
          if (s.counterItems.includes(c) && Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < 1.8) { s.removeCounterItem(c); p.tray.push({ kind: c.item.type, q }); }
          else this.claimed.delete(q);
        }
        this.serveNext(p);
      });
      return;
    }
    // an order to take, the nearest first
    const orderer = this.nearest(p, s.crowd.people.filter((g) => seated(g) && g.svc.phase === 'order' && g.svc.orderWait > 1.5));
    if (orderer) return this.takeOrder(p, orderer);
    // tea: pour a trayful at the urns and carry it round (the belt's guests get theirs down the belt, if Kenji's in)
    const beltTea = this.hired('staff_sushi');
    const want = this.wanted('tea'), n = beltTea ? want.hand : want.total;
    if (s.stock.mugs > 0 && s.menuKinds.has('tea') && n > 0) {
      const who = s.crowd.people.filter((g) => seated(g) && wants(g, 'tea') && !(beltTea && s.seatBeltS(g.seat) !== null)).slice(0, Math.min(TRAY, n));
      if (who.length) {
        for (const q of who) this.claimed.add(q);
        p.task = 'tea';
        const at = MAP.shop.urnStand || [p.post.x, p.post.z];
        this.walk(p, at[0], at[1], () => {
          this.face(p, at[0], at[1] + 1); p.busy = 1.0;
          for (const q of who) { if (s.stock.mugs > 0) { s.stock.mugs--; p.tray.push({ kind: 'tea', q }); } else this.claimed.delete(q); }
          if (p.tray.length) s.sfx('pour');
          this.serveNext(p);
        });
        return;
      }
    }
    if (Math.hypot(p.pos.x - p.post.x, p.pos.z - p.post.z) > 0.3) this.home(p);
  }
  takeOrder(p, q) {
    const s = this.service;
    this.claimed.add(q); p.task = 'order';
    this.walk(p, q.seat.app[0], q.seat.app[1], () => {
      this.claimed.delete(q); this.face(p, q.pos.x, q.pos.z); p.busy = 1.2;
      p.task = null;
      if (!q.svc || q.svc.phase !== 'order') return;
      q.svc.items = s.makeOrder(); q.svc.phase = 'food'; this.did.orders++;
      s.sayAll(`${p.name} took ${q.svc.name}'s order (${s.seatLabel(q.seat)}): ${q.svc.items.map((i) => MENU[i.kind].name.toLowerCase()).join(' and ')}`);
    });
  }
  // round the tables with what's on the tray, nearest guest first; whatever nobody wants any more goes to the sink
  serveNext(p) {
    const s = this.service;
    this.hold(p, p.tray.length ? p.tray[0].kind : null);
    if (!p.tray.length) { p.task = null; return; }
    p.task = 'tray';
    let next = p.tray[0], bd = Infinity;
    for (const t of p.tray) { const d = Math.hypot(t.q.pos.x - p.pos.x, t.q.pos.z - p.pos.z); if (d < bd) { bd = d; next = t; } }
    const { q } = next;
    const done = () => { p.tray.splice(p.tray.indexOf(next), 1); this.serveNext(p); };
    if (!q.seat || !q.seat.app) { this.claimed.delete(q); return this.rehome(p, next, done); }
    this.walk(p, q.seat.app[0], q.seat.app[1], () => {
      this.claimed.delete(q);
      const item = q.seat && q.svc && q.svc.phase === 'food' && q.svc.items.find((i) => !i.done && i.kind === next.kind);
      if (item) { this.face(p, q.pos.x, q.pos.z); s.serveItem(q, item); s.sfxAll('clickSound'); this.did.served++; p.busy = 0.4; return done(); }
      this.rehome(p, next, done);
    });
  }
  // a dish whose guest has gone (or been served meanwhile): someone else who wants one, or the sink
  rehome(p, t, done) {
    const s = this.service;
    const other = this.nearest(p, s.crowd.people.filter((g) => g.svc && g.seat && g.state === 'sit' && !this.claimed.has(g) && g.svc.phase === 'food' && g.svc.items.some((i) => !i.done && i.kind === t.kind)));
    if (other) { this.claimed.add(other); t.q = other; return this.serveNext(p); }
    if (t.kind === 'tea') s.sink.mugs++; else s.sink.plates++;
    done();
  }
  // a spot on the walking grid beside a counter
  standNear(x, z) {
    const nav = this.service.crowd.nav, k = nav.nearest(x, z, 1.4);
    return k >= 0 ? nav.center(k) : [x, z];
  }

  // ---------------------------------------------------------------- Hana: the register, and orders when it's quiet
  cashier(dt, think) {
    const s = this.service, p = this.people.staff_hall;
    const q = s.queue[0], payer = q && q.svc && q.svc.phase === 'pay';
    const atPost = Math.hypot(p.pos.x - p.post.x, p.pos.z - p.post.z) < 0.3;
    if (payer && atPost && !p.path) {
      p.busy = 0.6; p.yaw = p.post.yaw;
      if ((this.t.pay += dt) > 3) { this.t.pay = 0; s.runAs(s.me, 'register', []); this.did.rang++; }
      return;
    }
    this.t.pay = 0;
    if (!think || !this.free(p)) return;
    if (payer || s.queue.length) return this.home(p);
    // nobody to ring up: an order nobody's on yet, nearest the front first
    const seated = (g) => g.svc && g.seat && g.state === 'sit' && !this.claimed.has(g);
    const orderer = this.nearest(p, s.crowd.people.filter((g) => seated(g) && g.svc.phase === 'order' && g.svc.orderWait > 3));
    if (orderer) return this.takeOrder(p, orderer);
    if (!atPost) this.home(p);
  }

  // between nights: everyone back at their post, empty-handed
  reset() {
    this.claimed.clear();
    for (const p of Object.values(this.people)) {
      p.path = null; p.then = null; p.task = null; p.dish = null; p.tray = []; this.hold(p, null);
      p.pos.x = p.post.x; p.pos.z = p.post.z; p.yaw = p.post.yaw;
    }
  }
  // co-op: the host sends where everyone is and what they're carrying
  snapshot() {
    const r2 = (v) => Math.round(v * 100) / 100;
    return Object.values(this.people).filter((p) => this.hired(p.id)).map((p) => [p.id, r2(p.pos.x), r2(p.pos.z), r2(p.yaw), p.carryKey || '', p.path ? 1 : 0]);
  }
  applySnapshot(list) {
    for (const [id, x, z, yaw, carry, moving] of list) {
      const p = this.people[id]; if (!p) continue;
      p.pos.x = x; p.pos.z = z; p.yaw = yaw; p.speed = moving ? SPEED : 0;
      this.hold(p, carry || null);
    }
  }
}
