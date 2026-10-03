import * as THREE from 'three';
import type { Game } from '../app/Game';
import { DIRTY_DISHES } from '../data/content';
import { priceOf } from '../data/registry';
import type { ArchetypeDef, CustomerLook, ItemId } from '../data/types';
import { satisfactionFor, tipFor } from '../sim/economy';
import { Figure } from './figure';
import type { Interactable, Prompt } from './interaction';
import { disposeGroup, makeItemMesh } from './items';
import {
  AISLE_NORTH_Z,
  AISLE_SOUTH_Z,
  DOORWAY,
  EAST_AISLE_X,
  ENTRY,
  ISLAND,
  OUTSIDE,
  SEAT_HEIGHT,
  SEAT_OFFSET,
  STOOL_HEIGHT,
  TABLE_SIZE,
  type SpotDef,
} from './layout';
import * as P from './props';
import { C } from './voxel/palette';
import { cachedModel, modelGroup } from './voxel/vox';

const WALK_SPEED = 1.35;
const ORDER_DELAY = 2.5;
const BELT_REACH = 0.14;
const FUR = 1 / 16;
const CUSHIONS = [C.red, C.indigo, C.mustard, C.redDark];

function tableModel(index: number) {
  return cachedModel(`table-${index % CUSHIONS.length}`, FUR, [0, 0, 0], (v) => {
    v.box(-10, 11, -6, 10, 12, 6, (_x, _y, z) => (((Math.floor(z / 3) % 2) + 2) % 2 ? C.lightWood : C.hinoki2));
    v.box(-9, 10, -5, 9, 11, 5, C.darkWood);
    v.box(-8, 10, -4, 8, 11, 4, 0);
    for (const [lx, lz] of [
      [-9, -5],
      [7, -5],
      [-9, 3],
      [7, 3],
    ])
      v.box(lx, 0, lz, lx + 2, 10, lz + 2, C.darkWood);
    for (const side of [-1, 1]) {
      const c = side * 12;
      v.box(-4, 5, c - 4, 4, 6, c + 4, C.darkWood);
      v.box(-4, 6, c - 4, 4, 8, c + 4, (x, y, z) => (y === 7 && (x === -4 || x === 3 || z === c - 4 || z === c + 3) ? C.cream : CUSHIONS[index % CUSHIONS.length]));
      for (const [lx, lz] of [
        [-4, c - 4],
        [3, c - 4],
        [-4, c + 3],
        [3, c + 3],
      ])
        v.box(lx, 0, lz, lx + 1, 5, lz + 1, C.beam);
      const back = c + side * 4 - (side > 0 ? 1 : 0);
      for (let x = -4; x < 4; x++) for (let y = 6; y < 16; y++) if (x === -4 || x === 3 || y === 15 || y === 11 || x === -1 || x === 0) v.set(x, y, back, C.darkWood);
    }
  });
}

export interface Seat {
  pos: THREE.Vector3;
  facing: number;
  height: number;
  legAngle: number;
  /** Waypoints from the dining-room entry to the seat. */
  approach: THREE.Vector3[];
}

/** Somewhere a party sits: a pair of counter stools beside the belt, or a window table. */
export class Spot implements Interactable {
  readonly root = new THREE.Group();
  party: Party | null = null;
  dirty = 0;
  readonly seats: Seat[];
  readonly beltS: number;
  private served: THREE.Object3D[] = [];
  private dirtyMesh: THREE.Object3D | null = null;
  private readonly model: THREE.Group | null = null;

  constructor(
    private readonly game: Game,
    readonly def: SpotDef,
    index: number,
  ) {
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const { x, z } = def;
    const V = (a: number, b: number) => new THREE.Vector3(a, 0, b);
    if (def.kind === 'counter') {
      const hit = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 1.05), hidden);
      hit.position.set(x, 0.85, def.side * (ISLAND.halfWidth - 0.24 + 0.52));
      this.root.add(hit);
      const aisle = def.side < 0 ? AISLE_NORTH_Z : AISLE_SOUTH_Z;
      this.seats = [-0.3125, 0.3125].map((dx) => ({
        pos: V(x + dx, z),
        facing: def.side < 0 ? 0 : Math.PI,
        height: STOOL_HEIGHT,
        legAngle: -1.05,
        approach: [V(EAST_AISLE_X, aisle), V(x + dx, aisle), V(x + dx, z)],
      }));
      this.beltS = game.belt.seatS(x, def.side);
    } else {
      const hit = new THREE.Mesh(new THREE.BoxGeometry(TABLE_SIZE.w + 0.1, 1.5, TABLE_SIZE.d + SEAT_OFFSET * 2 + 0.3), hidden);
      hit.position.set(x, 0.75, z);
      this.root.add(hit);
      this.model = modelGroup(tableModel(index));
      this.model.position.set(x, 0, z);
      for (const [m, dx, dz] of [
        [P.soyBottle(), 0.5, -0.05],
        [P.chopstickCup(), 0.5, 0.08],
        [P.flowerVase(), -0.48, 0.0],
      ] as const) {
        const g = modelGroup(m);
        g.position.set(dx, TABLE_SIZE.h, dz);
        this.model.add(g);
      }
      this.root.add(this.model);
      const aisle = z < 0 ? AISLE_NORTH_Z : AISLE_SOUTH_Z;
      const towardAisle = Math.sign(aisle - z);
      const inner = V(x, z + towardAisle * SEAT_OFFSET);
      const outer = V(x, z - towardAisle * SEAT_OFFSET);
      const side = x + 0.95;
      this.seats = [inner, outer].map((pos) => ({
        pos,
        facing: pos.z < z ? 0 : Math.PI,
        height: SEAT_HEIGHT,
        legAngle: -Math.PI / 2,
        approach: pos === inner ? [V(EAST_AISLE_X, aisle), V(x, aisle), pos.clone()] : [V(EAST_AISLE_X, aisle), V(side, aisle), V(side, pos.z), pos.clone()],
      }));
      this.beltS = -1;
    }
  }

  get label(): string {
    return this.def.label;
  }

  get kind(): 'counter' | 'table' {
    return this.def.kind;
  }

  get available(): boolean {
    return !this.party && this.dirty === 0;
  }

  outlineTargets(): THREE.Object3D[] {
    return [...(this.model ? [this.model] : []), ...(this.party?.members.map((m) => m.figure.root) ?? []), ...this.served, ...(this.dirtyMesh ? [this.dirtyMesh] : [])];
  }

  prompt(): Prompt {
    const g = this.game;
    const p = this.party;
    const title = p ? `${this.label} · ${p.arch.name}` : this.label;
    if (p && p.state === 'waiting') {
      const wants = summarize(p.remaining.map((i) => g.content.items.get(i).name));
      const via = this.kind === 'counter' ? ' (or send it on the belt)' : '';
      if (g.hand.empty) return { title, verb: 'Waiting for their order', detail: `Wants: ${wants}${via}`, ok: false };
      if (p.remaining.includes(g.hand.item!)) return { title, verb: `Serve ${g.hand.name}`, detail: `Wants: ${wants}`, ok: true };
      return { title, verb: `They didn't order ${g.hand.name}`, detail: `Wants: ${wants}`, ok: false };
    }
    if (p && (p.state === 'arriving' || p.state === 'ordering')) return { title, verb: 'Reading the menu…', ok: false };
    if (p && p.state === 'eating') return { title, verb: 'Enjoying their meal', ok: false };
    if (this.dirty > 0) {
      if (g.hand.empty || g.hand.item === DIRTY_DISHES) return { title, verb: `Collect ${this.dirty} dirty dish${this.dirty > 1 ? 'es' : ''}`, ok: true };
      return { title, verb: 'Hands full', detail: 'Dirty dishes to collect', ok: false };
    }
    if (p && p.state === 'leaving') return { title, verb: 'Heading home', ok: false };
    return { title, verb: 'Clean and ready', ok: false };
  }

  interact(): void {
    const g = this.game;
    const p = this.party;
    if (p && p.state === 'waiting' && !g.hand.empty && p.remaining.includes(g.hand.item!)) {
      const item = g.hand.clear()!;
      p.serve(item);
      g.audio.play('serve');
      return;
    }
    if (this.dirty > 0 && (!p || p.state === 'leaving') && (g.hand.empty || g.hand.item === DIRTY_DISHES)) {
      g.hand.takeDirty(this.dirty);
      this.setDirty(0);
      g.audio.play('dishes');
      return;
    }
    g.reject();
  }

  /** Puts a served dish in front of the next seat. */
  placeServed(item: ItemId): void {
    const i = this.served.length;
    const seat = this.seats[i % this.seats.length];
    const m = makeItemMesh(this.game.content.items.get(item).visual);
    if (this.kind === 'counter') {
      const lateral = [0, 0.16, -0.16][Math.floor(i / 2) % 3];
      m.position.set(seat.pos.x + lateral, ISLAND.ledgeTop, this.def.side * (ISLAND.halfWidth - 0.13));
    } else {
      const lateral = [-0.12, 0.18, -0.32, 0.28][Math.floor(i / 2) % 4];
      m.position.set(this.def.x + lateral, TABLE_SIZE.h, this.def.z + (seat.pos.z < this.def.z ? -0.2 : 0.2));
    }
    m.rotation.y = seat.facing;
    this.game.scene.add(m);
    this.served.push(m);
  }

  clearServed(): void {
    for (const m of this.served) disposeGroup(m);
    this.served = [];
  }

  setDirty(count: number): void {
    this.dirty = count;
    this.clearServed();
    if (this.dirtyMesh) disposeGroup(this.dirtyMesh);
    this.dirtyMesh = null;
    if (count > 0) {
      this.dirtyMesh = makeItemMesh('dirtyDishes');
      if (this.kind === 'counter') this.dirtyMesh.position.set(this.def.x, ISLAND.ledgeTop, this.def.side * (ISLAND.halfWidth - 0.13));
      else this.dirtyMesh.position.set(this.def.x - 0.1, TABLE_SIZE.h, this.def.z);
      this.game.scene.add(this.dirtyMesh);
    }
  }

  reset(): void {
    this.party = null;
    this.setDirty(0);
  }
}

function summarize(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(', ');
}

export type PartyState = 'arriving' | 'ordering' | 'waiting' | 'eating' | 'leaving' | 'done';

interface Member {
  figure: Figure;
  path: THREE.Vector3[];
  step: number;
  delay: number;
  seat: Seat;
  seated: boolean;
}

export class Party {
  state: PartyState = 'arriving';
  readonly members: Member[];
  order: ItemId[] = [];
  remaining: ItemId[] = [];
  patience = 0;
  patienceMax = 0;
  waited = 0;
  warned = false;
  private timer = 0;
  angry = false;
  satisfaction = 0;

  constructor(
    private readonly game: Game,
    readonly arch: ArchetypeDef,
    looks: CustomerLook[],
    readonly spot: Spot,
  ) {
    this.members = looks.map((look, i) => {
      const seat = spot.seats[i % spot.seats.length];
      const figure = new Figure(look);
      const path = [OUTSIDE.clone().add(new THREE.Vector3(i * 0.5, 0, i * 0.9)), DOORWAY.clone(), ENTRY.clone(), ...seat.approach.map((p) => p.clone())];
      figure.root.position.copy(path[0]);
      figure.root.userData.interactable = spot;
      figure.setPose('walk');
      game.scene.add(figure.root);
      game.interaction.addTarget(figure.root);
      return { figure, path, step: 1, delay: i * 0.9, seat, seated: false };
    });
    this.patienceMax = arch.patienceSeconds * game.patienceScale();
  }

  get bill(): number {
    return this.order.reduce((s, i) => s + priceOf(this.game.content, i), 0);
  }

  ticketAnchor(out: THREE.Vector3): THREE.Vector3 {
    const s = this.spot.def;
    return out.set(s.x, s.kind === 'counter' ? 2.15 : 2.05, s.z);
  }

  serve(item: ItemId): void {
    const idx = this.remaining.indexOf(item);
    if (idx < 0) return;
    this.remaining.splice(idx, 1);
    this.spot.placeServed(item);
    this.game.ledger.itemsServed++;
    this.patience = Math.min(this.patienceMax, this.patience + this.patienceMax * this.game.content.economy.patienceRefillOnServe);
    if (this.patience > this.patienceMax * 0.3) this.warned = false;
    if (this.remaining.length === 0) {
      this.state = 'eating';
      this.timer = this.game.rng.range(this.arch.eatSeconds[0], this.arch.eatSeconds[1]);
      this.satisfaction = satisfactionFor(Math.min(1, this.waited / this.patienceMax));
      for (const m of this.members) m.figure.setPose('eat');
      this.game.emote(this, this.satisfaction > 0.85 ? '♪' : '…');
    }
  }

  private walk(m: Member, dt: number): boolean {
    if (m.delay > 0) {
      m.delay -= dt;
      return false;
    }
    const target = m.path[m.step];
    if (!target) return true;
    const pos = m.figure.root.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const stepLen = WALK_SPEED * dt;
    m.figure.setPose('walk');
    m.figure.root.rotation.y = Math.atan2(dx, dz);
    if (dist <= stepLen) {
      pos.set(target.x, 0, target.z);
      m.step++;
      return m.step >= m.path.length;
    }
    pos.x += (dx / dist) * stepLen;
    pos.z += (dz / dist) * stepLen;
    return false;
  }

  private leave(angry: boolean): void {
    this.angry = angry;
    this.state = 'leaving';
    for (const m of this.members) {
      m.path = [m.figure.root.position.clone(), ...[...m.path].reverse().slice(1)];
      m.step = 1;
      m.seated = false;
      m.delay = this.members.indexOf(m) * 0.4;
    }
  }

  update(dt: number): void {
    for (const m of this.members) m.figure.update(dt, m.seat.height, m.seat.legAngle);
    switch (this.state) {
      case 'arriving': {
        let all = true;
        for (const m of this.members) {
          if (m.seated) continue;
          if (this.walk(m, dt)) {
            m.seated = true;
            m.figure.root.rotation.y = m.seat.facing;
            m.figure.setPose('sit');
          } else all = false;
        }
        if (all) {
          this.state = 'ordering';
          this.timer = ORDER_DELAY;
        }
        break;
      }
      case 'ordering':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.order = this.game.generateOrder(this.arch, this.members.length);
          this.remaining = [...this.order];
          this.patience = this.patienceMax;
          this.state = 'waiting';
          this.game.audio.play('order');
        }
        break;
      case 'waiting': {
        if (this.spot.kind === 'counter') {
          const plate = this.game.belt.findNear(this.spot.beltS, BELT_REACH, (item) => this.remaining.includes(item));
          if (plate) {
            this.game.belt.remove(plate);
            this.serve(plate.item);
            this.game.audio.play('serve');
            if (this.state !== 'waiting') break;
          }
        }
        this.patience -= dt;
        this.waited += dt;
        if (!this.warned && this.patience < this.patienceMax * 0.3) {
          this.warned = true;
          this.game.warnImpatient(this);
        }
        if (this.patience <= 0) {
          this.game.ledger.recordWalkout();
          this.game.walkout(this);
          if (this.remaining.length < this.order.length) this.spot.setDirty(this.order.length - this.remaining.length);
          else this.spot.clearServed();
          this.leave(true);
        }
        break;
      }
      case 'eating':
        this.timer -= dt;
        if (this.timer <= 0) {
          const bill = this.bill;
          const tip = tipFor(bill, this.satisfaction, this.arch.tipRate);
          this.game.receivePayment(this, bill, tip);
          this.spot.setDirty(this.order.length);
          this.leave(false);
        }
        break;
      case 'leaving': {
        let all = true;
        for (const m of this.members) {
          if (m.step >= m.path.length) {
            m.figure.root.visible = false;
            continue;
          }
          if (!this.walk(m, dt)) all = false;
        }
        if (all) this.state = 'done';
        break;
      }
      case 'done':
        break;
    }
  }

  dispose(): void {
    for (const m of this.members) {
      this.game.interaction.removeTarget(m.figure.root);
      disposeGroup(m.figure.root);
    }
  }
}
