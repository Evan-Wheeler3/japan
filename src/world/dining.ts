import * as THREE from 'three';
import type { Game } from '../app/Game';
import { DIRTY_DISHES } from '../data/content';
import { priceOf } from '../data/registry';
import type { ArchetypeDef, CustomerLook, ItemId } from '../data/types';
import { satisfactionFor, tipFor } from '../sim/economy';
import { Figure } from './figure';
import type { Interactable, Prompt } from './interaction';
import { disposeGroup, makeItemMesh } from './items';
import { AISLE_X, DOORWAY, ENTRY, OUTSIDE, SEAT_HEIGHT, SEAT_OFFSET, TABLE_SIZE } from './layout';
import * as P from './props';
import { C } from './voxel/palette';
import { cachedModel, modelGroup } from './voxel/vox';

const WALK_SPEED = 1.35;
const ORDER_DELAY = 2.5;

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
      for (let x = -4; x < 4; x++)
        for (let y = 6; y < 16; y++) if (x === -4 || x === 3 || y === 15 || y === 11 || x === -1 || x === 0) v.set(x, y, back, C.darkWood);
    }
  });
}

export class TableEntity implements Interactable {
  readonly root = new THREE.Group();
  party: Party | null = null;
  dirty = false;
  readonly seats: { pos: THREE.Vector3; facing: number }[];
  private served: THREE.Object3D[] = [];
  private dirtyMesh: THREE.Object3D | null = null;
  private readonly model: THREE.Group;

  constructor(
    private readonly game: Game,
    readonly index: number,
    readonly x: number,
    readonly z: number,
  ) {
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(TABLE_SIZE.w + 0.1, 1.5, TABLE_SIZE.d + SEAT_OFFSET * 2 + 0.3), hitMat);
    hit.position.set(x, 0.75, z);
    this.root.add(hit);
    this.model = modelGroup(tableModel(index));
    this.model.position.set(x, 0, z);
    const decor: [ReturnType<typeof P.soyBottle>, number, number][] = [
      [P.soyBottle(), 0.5, -0.05],
      [P.chopstickCup(), 0.5, 0.08],
      [P.flowerVase(), -0.48, 0.0],
    ];
    for (const [m, dx, dz] of decor) {
      const g = modelGroup(m);
      g.position.set(dx, TABLE_SIZE.h, dz);
      this.model.add(g);
    }
    this.root.add(this.model);
    this.seats = [
      { pos: new THREE.Vector3(x, 0, z - SEAT_OFFSET), facing: 0 },
      { pos: new THREE.Vector3(x, 0, z + SEAT_OFFSET), facing: Math.PI },
    ];
  }

  get label(): string {
    return `Table ${this.index + 1}`;
  }

  get available(): boolean {
    return !this.party && !this.dirty;
  }

  outlineTargets(): THREE.Object3D[] {
    return [this.model, ...(this.party?.members.map((m) => m.figure.root) ?? []), ...this.served];
  }

  prompt(): Prompt {
    const g = this.game;
    const p = this.party;
    const title = p ? `${this.label} · ${p.arch.name}` : this.label;
    if (p && p.state === 'waiting') {
      const wants = summarize(p.remaining.map((i) => g.content.items.get(i).name));
      if (g.hand.empty) return { title, verb: 'Waiting for their order', detail: `Wants: ${wants}`, ok: false };
      if (p.remaining.includes(g.hand.item!)) return { title, verb: `Serve ${g.hand.name}`, detail: `Wants: ${wants}`, ok: true };
      return { title, verb: `They didn't order ${g.hand.name}`, detail: `Wants: ${wants}`, ok: false };
    }
    if (p && (p.state === 'arriving' || p.state === 'ordering')) return { title, verb: 'Reading the menu…', ok: false };
    if (p && p.state === 'eating') return { title, verb: 'Enjoying their meal', ok: false };
    if (this.dirty) {
      if (g.hand.empty) return { title, verb: 'Clear Dishes', ok: true };
      return { title, verb: 'Hands full', detail: 'Dirty dishes to clear', ok: false };
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
      this.placeServed(item);
      g.audio.play('serve');
      return;
    }
    if (this.dirty && g.hand.empty && (!p || p.state === 'leaving')) {
      this.setDirty(false);
      g.hand.take(DIRTY_DISHES);
      g.audio.play('dishes');
      return;
    }
    g.reject();
  }

  private placeServed(item: ItemId): void {
    const i = this.served.length;
    const seat = i % 2;
    const lateral = [-0.12, 0.18, -0.32, 0.28][Math.floor(i / 2) % 4];
    const m = makeItemMesh(this.game.content.items.get(item).visual);
    m.position.set(this.x + lateral, TABLE_SIZE.h, this.z + (seat === 0 ? -0.2 : 0.2));
    m.rotation.y = seat === 0 ? 0 : Math.PI;
    this.game.scene.add(m);
    this.served.push(m);
  }

  clearServed(): void {
    for (const m of this.served) disposeGroup(m);
    this.served = [];
  }

  setDirty(dirty: boolean): void {
    this.dirty = dirty;
    this.clearServed();
    if (this.dirtyMesh) disposeGroup(this.dirtyMesh);
    this.dirtyMesh = null;
    if (dirty) {
      this.dirtyMesh = makeItemMesh('dirtyDishes');
      this.dirtyMesh.position.set(this.x - 0.1, TABLE_SIZE.h, this.z);
      this.game.scene.add(this.dirtyMesh);
    }
  }

  reset(): void {
    this.party = null;
    this.setDirty(false);
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
  seat: { pos: THREE.Vector3; facing: number };
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
  private timer = 0;
  angry = false;
  satisfaction = 0;

  constructor(
    private readonly game: Game,
    readonly arch: ArchetypeDef,
    looks: CustomerLook[],
    readonly table: TableEntity,
  ) {
    this.members = looks.map((look, i) => {
      const seat = table.seats[i % table.seats.length];
      const figure = new Figure(look);
      const path = [
        OUTSIDE.clone().add(new THREE.Vector3(i * 0.5, 0, i * 0.9)),
        DOORWAY.clone(),
        ENTRY.clone(),
        new THREE.Vector3(AISLE_X, 0, ENTRY.z),
        new THREE.Vector3(AISLE_X, 0, seat.pos.z),
        seat.pos.clone(),
      ];
      figure.root.position.copy(path[0]);
      figure.root.userData.interactable = table;
      figure.setPose('walk');
      game.scene.add(figure.root);
      game.interaction.addTarget(figure.root);
      return { figure, path, step: 1, delay: i * 0.9, seat, seated: false };
    });
    this.patienceMax = arch.patienceSeconds;
  }

  get bill(): number {
    return this.order.reduce((s, i) => s + priceOf(this.game.content, i), 0);
  }

  /** Anchor for the floating order ticket. */
  ticketAnchor(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.table.x, 2.05, this.table.z);
  }

  serve(item: ItemId): void {
    const idx = this.remaining.indexOf(item);
    if (idx < 0) return;
    this.remaining.splice(idx, 1);
    this.game.ledger.itemsServed++;
    this.patience = Math.min(this.patienceMax, this.patience + this.patienceMax * this.game.content.economy.patienceRefillOnServe);
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
    for (const m of this.members) m.figure.update(dt, SEAT_HEIGHT);
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
      case 'waiting':
        this.patience -= dt;
        this.waited += dt;
        if (this.patience <= 0) {
          this.game.ledger.recordWalkout();
          this.game.emote(this, '💢');
          this.game.audio.play('angry');
          if (this.remaining.length < this.order.length) this.table.setDirty(true);
          else this.table.clearServed();
          this.leave(true);
        }
        break;
      case 'eating':
        this.timer -= dt;
        if (this.timer <= 0) {
          const bill = this.bill;
          const tip = tipFor(bill, this.satisfaction, this.arch.tipRate);
          this.game.receivePayment(this, bill, tip);
          this.table.setDirty(true);
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
