import * as THREE from 'three';
import type { Game } from '../app/Game';
import { DIRTY_DISHES } from '../data/content';
import type { ItemId, RecipeDef, StationDef } from '../data/types';
import { boxMesh } from './geometry';
import type { Interactable, Prompt } from './interaction';
import { disposeGroup, makeItemMesh } from './items';
import { COUNTER, COUNTER_X, CRATE } from './layout';
import { mat } from './materials';

/** Thin glowing strip on the counter front that lights up when a station is needed. */
function makeGlowStrip(z: number, width: number): THREE.Mesh {
  const m = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffb050, emissiveIntensity: 0, flatShading: true });
  const strip = boxMesh(m, 0.015, 0.035, width, COUNTER.maxX + 0.055, COUNTER.top - 0.12, z);
  return strip;
}

class Steam {
  readonly points: THREE.Points;
  private readonly base: Float32Array;
  private readonly mat: THREE.PointsMaterial;
  active = false;
  private level = 0;

  constructor(origin: THREE.Vector3, spread = 0.06) {
    const n = 10;
    this.base = new Float32Array(n * 4);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.base[i * 4] = (Math.random() - 0.5) * spread;
      this.base[i * 4 + 1] = (Math.random() - 0.5) * spread;
      this.base[i * 4 + 2] = Math.random();
      this.base[i * 4 + 3] = 0.5 + Math.random() * 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({ color: 0xf4f0ea, size: 0.06, transparent: true, opacity: 0, depthWrite: false });
    this.points = new THREE.Points(geo, this.mat);
    this.points.position.copy(origin);
    this.points.frustumCulled = false;
  }

  update(dt: number, time: number): void {
    this.level = THREE.MathUtils.damp(this.level, this.active ? 1 : 0, 3, dt);
    this.mat.opacity = this.level * 0.45;
    const attr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const n = attr.count;
    for (let i = 0; i < n; i++) {
      const life = (this.base[i * 4 + 2] + time * 0.35 * this.base[i * 4 + 3]) % 1;
      attr.setXYZ(i, this.base[i * 4] + Math.sin(time * 2 + i) * 0.02 * life, life * 0.45, this.base[i * 4 + 1] + life * 0.03);
    }
    attr.needsUpdate = true;
  }
}

export interface StationLabel {
  anchor: THREE.Vector3;
  progress: number | null;
  ready: number;
}

/** A cooking station driven entirely by the recipes that name it. */
export class StationEntity implements Interactable {
  readonly root = new THREE.Group();
  readonly glow: THREE.Mesh;
  readonly label: StationLabel;
  private readonly recipes: RecipeDef[];
  private placed: ItemId[] = [];
  private placedMeshes: THREE.Object3D[] = [];
  private job: { recipe: RecipeDef; remaining: number } | null = null;
  private readyItem: ItemId | null = null;
  private readyCount = 0;
  private readyMeshes: THREE.Object3D[] = [];
  private readonly outputSpots: THREE.Vector3[];
  private readonly inputSpot: THREE.Vector3;
  private readonly indicator: THREE.MeshStandardMaterial | null;
  private readonly steam: Steam | null;
  private readonly box = new THREE.Box3();

  constructor(
    private readonly game: Game,
    readonly def: StationDef,
    readonly z: number,
  ) {
    this.recipes = game.content.recipes.all().filter((r) => r.station === def.id);
    this.root.position.set(COUNTER_X, COUNTER.top, z);
    const model = buildStationModel(def.id);
    this.root.add(model.group);
    this.outputSpots = model.outputs;
    this.inputSpot = model.input;
    this.indicator = model.indicator;
    this.steam = model.steam ? new Steam(model.steam) : null;
    if (this.steam) this.root.add(this.steam.points);
    this.glow = makeGlowStrip(z, model.width);
    this.label = { anchor: new THREE.Vector3(COUNTER_X + 0.15, COUNTER.top + 0.62, z), progress: null, ready: 0 };
    this.box.setFromObject(model.group);
    this.box.translate(this.root.position);
  }

  get busy(): boolean {
    return this.job !== null;
  }

  outline(): THREE.Box3 {
    return this.box;
  }

  reset(): void {
    this.job = null;
    this.placed = [];
    this.setReady(null, 0);
    this.syncPlaced();
  }

  private recipeAccepting(item: ItemId): RecipeDef | undefined {
    return this.recipes.find((r) => r.inputs.includes(item) && r.inputs.filter((i) => i === item).length > this.placed.filter((p) => p === item).length);
  }

  private missingIngredient(r: RecipeDef): string | null {
    for (const g of r.ingredients) {
      if ((this.game.save.pantry[g.id] ?? 0) < g.qty) return this.game.content.ingredients.get(g.id).name;
    }
    return null;
  }

  private startable(): RecipeDef | undefined {
    return this.recipes.find((r) => r.inputs.length === this.placed.length && r.inputs.every((i) => this.placed.includes(i)));
  }

  prompt(): Prompt {
    const g = this.game;
    const title = this.def.name;
    const hand = g.hand;
    if (this.job) {
      const secs = Math.ceil(this.job.remaining);
      return { title, verb: `${this.job.recipe.verb}… ${secs}s`, ok: false };
    }
    if (this.readyItem) {
      const name = g.content.items.get(this.readyItem).name;
      if (hand.empty) return { title, verb: `Take ${name}`, detail: this.readyCount > 1 ? `${this.readyCount} ready` : undefined, ok: true };
      return { title, verb: `Hands full — ${name} is ready`, ok: false };
    }
    if (!hand.empty) {
      const r = this.recipeAccepting(hand.item!);
      if (r) return { title, verb: `Place ${hand.name}`, ok: true };
      return { title, verb: `Can't use ${hand.name} here`, ok: false };
    }
    const r = this.startable();
    if (r) {
      const missing = this.missingIngredient(r);
      if (missing) return { title, verb: `Out of ${missing}`, detail: 'Restock at the delivery crate', ok: false };
      return { title, verb: r.verb, ok: true };
    }
    const needs = this.recipes[0]?.inputs.filter((i) => !this.placed.includes(i)).map((i) => g.content.items.get(i).name);
    return { title, verb: needs?.length ? `Needs ${needs.join(', ')}` : '—', ok: false };
  }

  interact(): void {
    const g = this.game;
    if (this.job) return g.reject();
    if (this.readyItem) {
      if (!g.hand.empty) return g.reject();
      g.hand.take(this.readyItem);
      this.setReady(this.readyCount > 1 ? this.readyItem : null, this.readyCount - 1);
      g.audio.play('pickup');
      return;
    }
    if (!g.hand.empty) {
      const r = this.recipeAccepting(g.hand.item!);
      if (!r) return g.reject();
      this.placed.push(g.hand.clear()!);
      this.syncPlaced();
      g.audio.play('place');
      this.tryStart();
      return;
    }
    const r = this.startable();
    if (!r || this.missingIngredient(r)) return g.reject();
    this.tryStart();
  }

  private tryStart(): void {
    const r = this.startable();
    if (!r || this.missingIngredient(r)) return;
    for (const ing of r.ingredients) this.game.save.pantry[ing.id] -= ing.qty;
    this.placed = [];
    this.syncPlaced();
    if (r.prepSeconds <= 0) {
      this.game.hand.take(r.output);
      this.game.audio.play('pickup');
      return;
    }
    this.job = { recipe: r, remaining: r.prepSeconds };
    this.game.audio.play(r.station === 'sushi_board' ? 'chop' : 'start');
  }

  update(dt: number, time: number): void {
    if (this.job) {
      this.job.remaining -= dt;
      if (this.job.remaining <= 0) {
        const r = this.job.recipe;
        this.job = null;
        this.setReady(r.output, r.batch);
        this.game.audio.play('ding');
      }
    }
    if (this.steam) {
      this.steam.active = this.job !== null;
      this.steam.update(dt, time);
    }
    if (this.indicator) {
      if (this.job) {
        this.indicator.emissive.setHex(0xff3020);
        this.indicator.emissiveIntensity = 1.5 + Math.sin(time * 6) * 0.5;
      } else if (this.readyItem) {
        this.indicator.emissive.setHex(0x50ff70);
        this.indicator.emissiveIntensity = 1.8;
      } else {
        this.indicator.emissiveIntensity = 0;
      }
    }
    this.label.progress = this.job ? 1 - this.job.remaining / this.job.recipe.prepSeconds : null;
    this.label.ready = this.readyCount;
  }

  private setReady(item: ItemId | null, count: number): void {
    this.readyItem = count > 0 ? item : null;
    this.readyCount = this.readyItem ? count : 0;
    for (const m of this.readyMeshes) disposeGroup(m);
    this.readyMeshes = [];
    if (!this.readyItem) return;
    const visual = this.game.content.items.get(this.readyItem).visual;
    for (let i = 0; i < Math.min(this.readyCount, this.outputSpots.length); i++) {
      const m = makeItemMesh(visual);
      m.position.copy(this.outputSpots[i]);
      this.root.add(m);
      this.readyMeshes.push(m);
    }
  }

  private syncPlaced(): void {
    for (const m of this.placedMeshes) disposeGroup(m);
    this.placedMeshes = this.placed.map((item, i) => {
      const m = makeItemMesh(this.game.content.items.get(item).visual);
      m.position.copy(this.inputSpot).add(new THREE.Vector3(0, 0, i * 0.12));
      this.root.add(m);
      return m;
    });
  }

  /** True if this station currently holds a finished or in-progress `item`. */
  holds(item: ItemId): boolean {
    return this.readyItem === item || this.job?.recipe.output === item;
  }
}

interface StationModel {
  group: THREE.Group;
  outputs: THREE.Vector3[];
  input: THREE.Vector3;
  indicator: THREE.MeshStandardMaterial | null;
  steam: THREE.Vector3 | null;
  width: number;
}

function buildStationModel(id: string): StationModel {
  const g = new THREE.Group();
  const iron = mat(0x2a2a2e, { roughness: 0.5, metalness: 0.4 });
  const wood = mat(0x8a5a32);
  const lightWood = mat(0xc89a62);
  const cream = mat(0xece4d4, { roughness: 0.4 });
  switch (id) {
    case 'kettle': {
      const coals = new THREE.MeshStandardMaterial({ color: 0x3a1a10, emissive: 0xff4a10, emissiveIntensity: 0, flatShading: true });
      g.add(boxMesh(mat(0x4a3a30), 0.34, 0.14, 0.34, -0.05, 0.07, 0));
      g.add(boxMesh(coals, 0.26, 0.02, 0.26, -0.05, 0.145, 0));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.17, 8).translate(-0.05, 0.24, 0), iron));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 8).translate(-0.05, 0.34, 0), iron));
      const spout = boxMesh(iron, 0.14, 0.04, 0.04, 0.1, 0.27, 0);
      spout.rotation.z = 0.5;
      g.add(spout);
      g.add(boxMesh(iron, 0.02, 0.12, 0.2, -0.05, 0.4, 0));
      g.add(boxMesh(wood, 0.3, 0.02, 0.42, 0.18, 0.01, 0));
      return { group: g, outputs: [new THREE.Vector3(0.2, 0.02, -0.12), new THREE.Vector3(0.2, 0.02, 0.12)], input: new THREE.Vector3(0.2, 0.02, 0), indicator: coals, steam: new THREE.Vector3(0.14, 0.32, 0), width: 0.8 };
    }
    case 'edamame_bowl': {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.12, 9).translate(0, 0.06, 0), wood));
      const greens = [mat(0x6fae3e), mat(0x4f8a2c)];
      for (let i = 0; i < 18; i++) {
        const a = i * 2.4;
        const r = 0.04 + (i % 5) * 0.035;
        const pod = boxMesh(greens[i % 2], 0.08, 0.025, 0.03, Math.cos(a) * r, 0.125 + (i % 3) * 0.01, Math.sin(a) * r);
        pod.rotation.y = a;
        g.add(pod);
      }
      g.add(boxMesh(mat(0xefe9dc), 0.2, 0.08, 0.14, 0.14, 0.04, 0.3));
      return { group: g, outputs: [], input: new THREE.Vector3(), indicator: null, steam: null, width: 0.7 };
    }
    case 'rice_cooker': {
      const light = new THREE.MeshStandardMaterial({ color: 0x331111, emissive: 0xff3020, emissiveIntensity: 0, flatShading: true });
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.24, 10).translate(0, 0.12, -0.1), cream));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.06, 10).translate(0, 0.27, -0.1), mat(0xd8d0bf)));
      g.add(boxMesh(iron, 0.09, 0.03, 0.04, 0, 0.32, -0.1));
      g.add(boxMesh(light, 0.03, 0.03, 0.02, 0.16, 0.16, -0.1));
      g.add(boxMesh(iron, 0.02, 0.06, 0.12, 0.17, 0.1, -0.1));
      g.add(boxMesh(lightWood, 0.34, 0.02, 0.34, 0.03, 0.01, 0.32));
      return {
        group: g,
        outputs: [new THREE.Vector3(-0.05, 0.02, 0.24), new THREE.Vector3(-0.05, 0.02, 0.4), new THREE.Vector3(0.12, 0.02, 0.24), new THREE.Vector3(0.12, 0.02, 0.4)],
        input: new THREE.Vector3(),
        indicator: light,
        steam: new THREE.Vector3(0, 0.33, -0.1),
        width: 0.9,
      };
    }
    case 'sushi_board': {
      g.add(boxMesh(lightWood, 0.5, 0.05, 0.95, 0.05, 0.025, 0));
      g.add(boxMesh(mat(0xf08a4a), 0.14, 0.07, 0.24, -0.05, 0.085, -0.3));
      g.add(boxMesh(mat(0xfbd2b0), 0.141, 0.01, 0.24, -0.05, 0.09, -0.3));
      const blade = boxMesh(mat(0xd8dde4, { metalness: 0.7, roughness: 0.25 }), 0.03, 0.005, 0.22, 0.2, 0.055, -0.15);
      g.add(blade);
      g.add(boxMesh(mat(0x2a1a10), 0.025, 0.02, 0.1, 0.2, 0.06, 0.0));
      g.add(boxMesh(mat(0x1b2a1a), 0.12, 0.004, 0.1, -0.12, 0.052, 0.3));
      return { group: g, outputs: [new THREE.Vector3(0.1, 0.05, 0.28)], input: new THREE.Vector3(0.08, 0.05, -0.02), indicator: null, steam: null, width: 1.0 };
    }
    default:
      g.add(boxMesh(wood, 0.4, 0.2, 0.4, 0, 0.1, 0));
      return { group: g, outputs: [new THREE.Vector3(0.1, 0.2, 0)], input: new THREE.Vector3(0, 0.2, 0), indicator: null, steam: null, width: 0.6 };
  }
}

/** Free counter space for setting things down. Q drops the held item here. */
export class PassShelf implements Interactable {
  readonly root = new THREE.Group();
  readonly slots: (ItemId | null)[] = [null, null, null, null];
  private readonly meshes: (THREE.Object3D | null)[] = [null, null, null, null];
  private readonly spots: THREE.Vector3[];
  private readonly box: THREE.Box3;

  constructor(
    private readonly game: Game,
    z: number,
  ) {
    this.root.position.set(COUNTER_X, COUNTER.top, z);
    const board = boxMesh(mat(0x5a3a22), 0.6, 0.03, 1.15, 0.05, 0.015, 0);
    this.root.add(board);
    this.spots = [-0.42, -0.14, 0.14, 0.42].map((dz) => new THREE.Vector3(0.08, 0.03, dz));
    for (const s of this.spots) this.root.add(boxMesh(mat(0x6e4a2c), 0.24, 0.005, 0.22, s.x, 0.031, s.z));
    this.box = new THREE.Box3().setFromObject(board).translate(this.root.position);
    this.box.max.y += 0.15;
  }

  outline(): THREE.Box3 {
    return this.box;
  }

  private nearestSlot(point: THREE.Vector3, filled: boolean): number {
    const local = this.root.worldToLocal(point.clone());
    let best = -1;
    let bestD = Infinity;
    this.spots.forEach((s, i) => {
      if ((this.slots[i] !== null) !== filled) return;
      const d = Math.abs(s.z - local.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  get hasFree(): boolean {
    return this.slots.includes(null);
  }

  prompt(): Prompt {
    const hand = this.game.hand;
    const title = 'Pass Counter';
    if (!hand.empty) return this.hasFree ? { title, verb: `Set down ${hand.name}`, ok: true } : { title, verb: 'No space left', ok: false };
    const items = this.slots.filter((s): s is ItemId => s !== null);
    if (items.length === 0) return { title, verb: 'Empty', detail: 'Press Q to set an item down', ok: false };
    const at = this.game.interaction.lastHit ? this.nearestSlot(this.game.interaction.lastHit.point, true) : -1;
    const name = at >= 0 ? this.game.content.items.get(this.slots[at]!).name : '';
    return { title, verb: `Pick up ${name}`, ok: true };
  }

  interact(hit: THREE.Intersection): void {
    const g = this.game;
    if (!g.hand.empty) {
      if (!this.place(g.hand.item!, this.nearestSlot(hit.point, false))) return g.reject();
      g.hand.clear();
      g.audio.play('place');
      return;
    }
    const i = this.nearestSlot(hit.point, true);
    if (i < 0) return g.reject();
    g.hand.take(this.slots[i]!);
    this.setSlot(i, null);
    g.audio.play('pickup');
  }

  /** Places into `slot`, or the first free slot when slot < 0. */
  place(item: ItemId, slot = -1): boolean {
    const i = slot >= 0 && this.slots[slot] === null ? slot : this.slots.indexOf(null);
    if (i < 0) return false;
    this.setSlot(i, item);
    return true;
  }

  private setSlot(i: number, item: ItemId | null): void {
    this.slots[i] = item;
    const old = this.meshes[i];
    if (old) disposeGroup(old);
    this.meshes[i] = null;
    if (item) {
      const m = makeItemMesh(this.game.content.items.get(item).visual);
      m.position.copy(this.spots[i]);
      this.root.add(m);
      this.meshes[i] = m;
    }
  }

  reset(): void {
    for (let i = 0; i < this.slots.length; i++) this.setSlot(i, null);
  }
}

const WASH_SECONDS = 3.5;

export class Sink implements Interactable {
  readonly root = new THREE.Group();
  readonly label: StationLabel;
  readonly glow: THREE.Mesh;
  queue = 0;
  private remaining = 0;
  private readonly stack: THREE.Object3D[] = [];
  private readonly water: THREE.Mesh;
  private readonly box: THREE.Box3;

  constructor(
    private readonly game: Game,
    z: number,
  ) {
    this.root.position.set(COUNTER_X, COUNTER.top, z);
    const steel = mat(0xa8adb5, { metalness: 0.6, roughness: 0.35 });
    this.root.add(boxMesh(steel, 0.62, 0.04, 0.9, 0.04, 0.02, 0));
    this.root.add(boxMesh(mat(0x6a7078, { metalness: 0.5, roughness: 0.4 }), 0.5, 0.01, 0.7, 0.04, 0.045, 0));
    this.water = boxMesh(new THREE.MeshStandardMaterial({ color: 0x8ab8d8, transparent: true, opacity: 0, roughness: 0.1 }), 0.48, 0.01, 0.66, 0.04, 0.06, 0);
    this.root.add(this.water);
    this.root.add(boxMesh(steel, 0.04, 0.32, 0.04, -0.27, 0.18, 0));
    this.root.add(boxMesh(steel, 0.2, 0.04, 0.04, -0.18, 0.33, 0));
    this.glow = makeGlowStrip(z, 0.9);
    this.label = { anchor: new THREE.Vector3(COUNTER_X + 0.15, COUNTER.top + 0.62, z), progress: null, ready: 0 };
    this.box = new THREE.Box3().setFromObject(this.root);
    this.box.max.y += 0.1;
  }

  outline(): THREE.Box3 {
    return this.box;
  }

  prompt(): Prompt {
    const g = this.game;
    const title = 'Sink';
    if (g.hand.item === DIRTY_DISHES) return { title, verb: 'Wash Dishes', ok: true };
    if (!g.hand.empty) return { title, verb: `Can't wash ${g.hand.name}`, ok: false };
    if (this.queue > 0) return { title, verb: `Washing… ${this.queue} left`, ok: false };
    return { title, verb: 'Bring dirty dishes here', ok: false };
  }

  interact(): void {
    const g = this.game;
    if (g.hand.item !== DIRTY_DISHES) return g.reject();
    g.hand.clear();
    if (this.queue === 0) this.remaining = WASH_SECONDS;
    this.queue++;
    g.audio.play('wash');
    this.syncStack();
  }

  update(dt: number): void {
    if (this.queue > 0) {
      this.remaining -= dt;
      if (this.remaining <= 0) {
        this.queue--;
        this.remaining = WASH_SECONDS;
        this.syncStack();
        this.game.audio.play(this.queue > 0 ? 'wash' : 'clean');
      }
    }
    const m = this.water.material as THREE.MeshStandardMaterial;
    m.opacity = THREE.MathUtils.damp(m.opacity, this.queue > 0 ? 0.6 : 0, 4, dt);
    this.label.progress = this.queue > 0 ? 1 - this.remaining / WASH_SECONDS : null;
    this.label.ready = 0;
  }

  private syncStack(): void {
    while (this.stack.length > this.queue) disposeGroup(this.stack.pop()!);
    while (this.stack.length < Math.min(this.queue, 4)) {
      const m = makeItemMesh('dirtyDishes');
      m.position.set(0.04, 0.05 + this.stack.length * 0.03, -0.15 + this.stack.length * 0.1);
      this.root.add(m);
      this.stack.push(m);
    }
  }

  reset(): void {
    this.queue = 0;
    this.syncStack();
  }
}

export class Crate implements Interactable {
  readonly root = new THREE.Group();
  readonly glow: THREE.Mesh;
  private readonly box: THREE.Box3;

  constructor(private readonly game: Game) {
    this.root.position.set(CRATE.x, 0.5, CRATE.z);
    const contents: [number, number, number, number, number][] = [
      [0xf08a4a, -0.2, 0.06, -0.1, 0.18],
      [0xefe6d0, 0.12, 0.08, -0.1, 0.22],
      [0x6fae3e, -0.2, 0.05, 0.14, 0.14],
      [0x5a8a3a, 0.14, 0.05, 0.14, 0.16],
    ];
    for (const [c, x, h, z, w] of contents) this.root.add(boxMesh(mat(c), w, h * 2, 0.18, x, h, z));
    this.root.add(boxMesh(mat(0x3a2414), 0.82, 0.04, 0.04, 0, 0.02, -0.3));
    this.glow = boxMesh(new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffb050, emissiveIntensity: 0 }), 0.82, 0.03, 0.02, 0, -0.1, -0.335);
    this.root.add(this.glow);
    this.box = new THREE.Box3(new THREE.Vector3(CRATE.x - 0.42, 0, CRATE.z - 0.34), new THREE.Vector3(CRATE.x + 0.42, 0.7, CRATE.z + 0.34));
  }

  outline(): THREE.Box3 {
    return this.box;
  }

  restockCost(): { cost: number; units: number } {
    let cost = 0;
    let units = 0;
    for (const ing of this.game.content.ingredients.all()) {
      const missing = ing.capacity - (this.game.save.pantry[ing.id] ?? 0);
      if (missing > 0) {
        cost += missing * ing.unitCost;
        units += missing;
      }
    }
    return { cost, units };
  }

  prompt(): Prompt {
    const { cost, units } = this.restockCost();
    const stock = this.game.content.ingredients
      .all()
      .map((i) => `${i.name} ${this.game.save.pantry[i.id] ?? 0}/${i.capacity}`)
      .join(' · ');
    if (!this.game.hand.empty) return { title: 'Delivery Crate', verb: 'Hands full', detail: stock, ok: false };
    if (units === 0) return { title: 'Delivery Crate', verb: 'Fully stocked', detail: stock, ok: false };
    return { title: 'Delivery Crate', verb: `Restock (¥${cost.toLocaleString()})`, detail: stock, ok: true };
  }

  interact(): void {
    if (!this.game.hand.empty) return this.game.reject();
    this.game.restock();
  }
}

/** Wooden sign by the door. Flipping it opens the restaurant for the night. */
export class OpenSign implements Interactable {
  readonly root = new THREE.Group();
  private readonly face: THREE.MeshStandardMaterial;
  private readonly box: THREE.Box3;
  private readonly textures: Record<'closed' | 'open', THREE.Texture>;

  constructor(
    private readonly game: Game,
    pos: THREE.Vector3,
    textures: Record<'closed' | 'open', THREE.Texture>,
  ) {
    this.textures = textures;
    this.face = new THREE.MeshStandardMaterial({ map: textures.closed, roughness: 0.9, emissive: 0xffe0b0, emissiveMap: textures.closed, emissiveIntensity: 0.25 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.04), [mat(0x2a1a10), mat(0x2a1a10), mat(0x2a1a10), mat(0x2a1a10), mat(0x2a1a10), this.face]);
    board.rotation.y = Math.PI;
    this.root.add(board);
    this.root.add(boxMesh(mat(0x2a1a10), 0.01, 0.2, 0.01, -0.15, 0.25, 0));
    this.root.add(boxMesh(mat(0x2a1a10), 0.01, 0.2, 0.01, 0.15, 0.25, 0));
    this.root.position.copy(pos);
    this.box = new THREE.Box3().setFromObject(this.root);
  }

  setOpen(open: boolean): void {
    const t = open ? this.textures.open : this.textures.closed;
    this.face.map = t;
    this.face.emissiveMap = t;
    this.face.needsUpdate = true;
  }

  outline(): THREE.Box3 {
    return this.box;
  }

  prompt(): Prompt | null {
    if (this.game.mode === 'prep') return { title: 'Shop Sign', verb: 'Open the restaurant', detail: 'The night begins once you flip the sign', ok: true };
    return { title: 'Shop Sign', verb: 'Open for the night', ok: false };
  }

  interact(): void {
    if (this.game.mode === 'prep') this.game.openRestaurant();
    else this.game.reject();
  }
}
