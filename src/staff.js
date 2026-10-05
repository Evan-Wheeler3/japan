// Hired help, bought from the catalog and paid at sunrise: a dishwasher at the sink, a sushi chef at the case
// and a hall server by the register. They stand at their posts all night; whoever runs the shop (solo, or the
// co-op host) does their work for them, and everyone sees them at it.
import { Person } from './npc.js';
import { MENU } from './service.js';
import { MAP } from './maps/index.js';

const MENU_PLATE = ['sushi'];
// who stands where comes from the map (MAP.shop.staff); what they look like is theirs
const LOOKS = {
  staff_wash: { name: 'Taro', look: { skin: '#e0ac85', hair: '#1a1412', coat: '#e8e4dc', pants: '#2a3a5a', shoes: '#141414', hairStyle: 0, hat: -1, glasses: true, long: false, umbrella: '#141416', scarf: '#2a5a8a' } },
  staff_sushi: { name: 'Kenji', look: { skin: '#c68863', hair: '#3a2418', coat: '#f0ece4', pants: '#1c1c20', shoes: '#141414', hairStyle: 3, hat: 0, glasses: false, long: false, umbrella: '#141416', scarf: null } },
  staff_hall: { name: 'Hana', look: { skin: '#f1c9a5', hair: '#1a1412', coat: '#24324e', pants: '#24324e', shoes: '#4a2a18', hairStyle: 4, hat: -1, glasses: false, long: true, umbrella: '#141416', scarf: '#a82a2a' } },
};

export class Staff {
  constructor({ scene, service, litMat, emitMat }) {
    this.service = service;
    this.people = {};
    for (const [id, l] of Object.entries(LOOKS)) {
      const p = { ...l, ...MAP.shop.staff[id] };
      const person = new Person(p.look, litMat, emitMat);
      person.group.position.set(p.x, 0.25, p.z); person.group.rotation.y = p.yaw; person.group.visible = false;
      scene.add(person.group);
      this.people[id] = { ...p, person, busy: 0, t: 0 };
    }
    this.t = { wash: 0, carry: 0, sushi: 0, order: 0, pay: 0 };
    this.did = { washed: 0, carried: 0, sushi: 0, orders: 0, rang: 0 }; // a tally, for the playtest
  }
  hired(id) { return !!this.service.staff && this.service.staff.has(id); }

  update(dt, open) {
    const s = this.service;
    for (const [id, p] of Object.entries(this.people)) {
      const on = this.hired(id);
      p.person.group.visible = on;
      if (!on) continue;
      p.busy = Math.max(0, p.busy - dt);
      p.person.pose(dt, 0, 0, 0, false);
      // working arms: scrubbing, slicing, writing an order
      const w = Math.min(1, p.busy * 2);
      p.person.arms.forEach((a, i) => { a.rotation.x = w * (0.9 + Math.sin(p.person.idleT * 9 + i * 2) * 0.25); });
      p.person.neck.rotation.x = 0.25 * w;
    }
    if (s.role === 'guest' || !open) return;
    // the dishwasher: washes what's in the sink whenever you aren't, and carries a full rack back out
    if (this.hired('staff_wash')) {
      const sinkN = s.sink.mugs + s.sink.plates, rackN = s.rack.mugs + s.rack.plates;
      if (!s.washing && sinkN) {
        this.people.staff_wash.busy = 0.6;
        if ((this.t.wash += dt) > s.washTime * 1.5) {
          this.t.wash = 0;
          if (s.sink.mugs > 0) { s.sink.mugs--; s.rack.mugs++; } else { s.sink.plates--; s.rack.plates++; }
          s.washed++; this.did.washed++;
        }
      }
      if (rackN && (rackN >= 4 || !sinkN) && (this.t.carry += dt) > 6) {
        this.t.carry = 0;
        s.stock.mugs += s.rack.mugs; s.stock.plates += s.rack.plates; s.rack.mugs = s.rack.plates = 0; this.did.carried++;
      }
    }
    // the sushi chef: a plate of nigiri down the belt for every guest along it still waiting on one
    if (this.hired('staff_sushi') && (this.t.sushi += dt) > 6) {
      this.t.sushi = 0;
      for (const kind of MENU_PLATE) {
        if (!s.menuKinds.has(kind)) continue;
        let want = 0;
        for (const q of s.crowd.people) if (q.svc && q.svc.phase === 'food' && q.seat && s.seatBeltS(q.seat) !== null) want += q.svc.items.filter((i) => !i.done && i.kind === kind).length;
        want -= s.belt.plates.filter((b) => b.type === kind).length;
        want -= Object.values(s.handsBy).flat().filter((h) => h.type === kind).length + s.counterItems.filter((c) => c.item.type === kind).length;
        if (want <= 0 || s.stock.plates <= 0) continue;
        const at = 0.25; // just past where the belt comes out of the kitchen
        if (!s.belt.isFree(at)) continue;
        s.stock.plates--; s.belt.add(kind, at); this.people.staff_sushi.busy = 1.5; this.did.sushi++;
      }
    }
    // the hall server: takes an order nobody has got to, and rings up whoever's at the register
    if (this.hired('staff_hall')) {
      const waiting = s.crowd.people.find((q) => q.svc && q.svc.phase === 'order' && q.svc.orderWait > 8);
      if (waiting && (this.t.order += dt) > 4) {
        this.t.order = 0;
        const sv = waiting.svc;
        sv.items = s.makeOrder(); sv.phase = 'food';
        s.sayAll(`Hana took ${sv.name}'s order (${s.seatLabel(waiting.seat)}): ${sv.items.map((i) => MENU[i.kind].name.toLowerCase()).join(' and ')}`);
        this.people.staff_hall.busy = 1.2; this.did.orders++;
      }
      const q = s.queue[0];
      if (q && q.svc && q.svc.phase === 'pay') {
        this.people.staff_hall.busy = 0.6;
        if ((this.t.pay += dt) > 5) { this.t.pay = 0; s.runAs(s.me, 'register', []); this.did.rang++; }
      } else this.t.pay = 0;
    }
  }
}
