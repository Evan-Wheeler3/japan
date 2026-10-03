import * as THREE from 'three';
import type { Game } from '../app/Game';
import { DIRTY_DISHES } from '../data/content';
import type { ItemId, RecipeDef, StationDef } from '../data/types';
import type { Interactable, Prompt } from './interaction';
import { disposeGroup, makeItemMesh } from './items';
import { COUNTER_TOP, COUNTER_X, CRATE } from './layout';
import { dryingRack, plateStack } from './props';
import { F } from './props';
import { C } from './voxel/palette';
import { cachedModel, glowMaterial, modelGroup, type Vox } from './voxel/vox';

let poolTexture: THREE.Texture | null = null;

/** Soft warm light pool on the counter: lights up when a station is needed. */
export function makeGlowPool(x: number, y: number, z: number, w: number, d: number): THREE.Mesh {
  if (!poolTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    poolTexture = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: poolTexture, color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = 2;
  return m;
}

class Steam {
  readonly points: THREE.Points;
  private readonly base: Float32Array;
  private readonly mat: THREE.PointsMaterial;
  active = false;
  private level = 0;

  constructor(origin: THREE.Vector3, spread = 0.06) {
    const n = 12;
    this.base = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      this.base[i * 4] = (Math.random() - 0.5) * spread;
      this.base[i * 4 + 1] = (Math.random() - 0.5) * spread;
      this.base[i * 4 + 2] = Math.random();
      this.base[i * 4 + 3] = 0.5 + Math.random() * 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.mat = new THREE.PointsMaterial({ color: 0xfff4e8, size: 0.05, transparent: true, opacity: 0, depthWrite: false });
    this.points = new THREE.Points(geo, this.mat);
    this.points.position.copy(origin);
    this.points.frustumCulled = false;
  }

  update(dt: number, time: number): void {
    this.level = THREE.MathUtils.damp(this.level, this.active ? 1 : 0, 3, dt);
    this.mat.opacity = this.level * 0.5;
    const attr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      const life = (this.base[i * 4 + 2] + time * 0.35 * this.base[i * 4 + 3]) % 1;
      attr.setXYZ(i, this.base[i * 4] + Math.sin(time * 2 + i) * 0.03 * life, life * 0.5, this.base[i * 4 + 1] + life * 0.04);
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
  private readonly model: THREE.Group;
  private readonly recipes: RecipeDef[];
  private placed: ItemId[] = [];
  private placedMeshes: THREE.Object3D[] = [];
  private job: { recipe: RecipeDef; remaining: number } | null = null;
  private readyItem: ItemId | null = null;
  private readyCount = 0;
  private readyMeshes: THREE.Object3D[] = [];
  private readonly spec: StationSpec;
  private readonly lightMat: THREE.MeshBasicMaterial;
  private readonly steam: Steam | null;

  constructor(
    private readonly game: Game,
    readonly def: StationDef,
    readonly z: number,
  ) {
    this.recipes = game.content.recipes.all().filter((r) => r.station === def.id);
    this.root.position.set(COUNTER_X, COUNTER_TOP, z);
    this.spec = STATION_SPECS[def.id] ?? STATION_SPECS.default;
    this.lightMat = glowMaterial.clone();
    this.model = modelGroup(cachedModel(`station-${def.id}`, F, [0, 0, 0], this.spec.build), this.lightMat);
    this.root.add(this.model);
    this.steam = this.spec.steam ? new Steam(this.spec.steam) : null;
    if (this.steam) this.root.add(this.steam.points);
    this.glow = makeGlowPool(COUNTER_X + 0.15, COUNTER_TOP + 0.004, z, 1.1, 0.9);
    this.label = { anchor: new THREE.Vector3(COUNTER_X + 0.15, COUNTER_TOP + 0.62, z), progress: null, ready: 0 };
  }

  get busy(): boolean {
    return this.job !== null;
  }

  outlineTargets(): THREE.Object3D[] {
    return [this.model, ...this.readyMeshes, ...this.placedMeshes];
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
    if (r.dish && this.game.dishes.clean <= 0) return 'clean dishes';
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
    if (this.job) return { title, verb: `${this.job.recipe.verb}… ${Math.ceil(this.job.remaining)}s`, ok: false };
    if (this.readyItem) {
      const name = g.content.items.get(this.readyItem).name;
      if (hand.empty) return { title, verb: `Take ${name}`, detail: this.readyCount > 1 ? `${this.readyCount} ready` : undefined, ok: true };
      return { title, verb: `Hands full — ${name} is ready`, ok: false };
    }
    if (!hand.empty) {
      if (this.recipeAccepting(hand.item!)) return { title, verb: `Place ${hand.name}`, ok: true };
      return { title, verb: `Can't use ${hand.name} here`, ok: false };
    }
    const r = this.startable();
    if (r) {
      const missing = this.missingIngredient(r);
      if (missing) return { title, verb: `Out of ${missing}`, detail: missing === 'clean dishes' ? 'Wash dirty dishes at the sink' : 'Restock at the delivery crate', ok: false };
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
      if (!this.recipeAccepting(g.hand.item!)) return g.reject();
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
    if (r.dish) this.game.dishes.clean--;
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
    const flicker = 1 + Math.sin(time * 9.1) * 0.08 + Math.sin(time * 23.7) * 0.05;
    if (this.spec.light === 'embers') this.lightMat.color.setScalar((this.job ? 1.25 : 0.55) * flicker);
    else if (this.spec.light === 'indicator') {
      if (this.job) this.lightMat.color.setRGB(1.5, 0.22, 0.12).multiplyScalar(0.8 + Math.sin(time * 6) * 0.25);
      else if (this.readyItem) this.lightMat.color.setRGB(0.35, 1.5, 0.45);
      else this.lightMat.color.setScalar(0.12);
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
    for (let i = 0; i < Math.min(this.readyCount, this.spec.outputs.length); i++) {
      const m = makeItemMesh(visual);
      m.position.copy(this.spec.outputs[i]);
      this.root.add(m);
      this.readyMeshes.push(m);
    }
  }

  private syncPlaced(): void {
    for (const m of this.placedMeshes) disposeGroup(m);
    this.placedMeshes = this.placed.map((item, i) => {
      const m = makeItemMesh(this.game.content.items.get(item).visual);
      m.position.copy(this.spec.input).add(new THREE.Vector3(0, 0, i * 0.12));
      this.root.add(m);
      return m;
    });
  }

  /** True if this station currently holds a finished or in-progress `item`. */
  holds(item: ItemId): boolean {
    return this.readyItem === item || this.job?.recipe.output === item;
  }
}

interface StationSpec {
  build: (v: Vox) => void;
  outputs: THREE.Vector3[];
  input: THREE.Vector3;
  steam: THREE.Vector3 | null;
  light: 'embers' | 'indicator' | null;
}

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const stripes = (a: number, b: number, period = 2) => (_x: number, _y: number, z: number) => (((Math.floor(z / period) % 2) + 2) % 2 ? a : b);

/** Voxel station models in ~3cm voxels; local origin is the counter top at the slot centre, +X faces the room. */
const STATION_SPECS: Record<string, StationSpec> = {
  kettle: {
    build: (v) => {
      v.box(-11, 0, -7, 2, 6, 7, (x, y) => (y === 5 || x === -11 || x === 1 ? C.stoneD : C.stone));
      v.box(-10, 5, -6, 1, 6, 6, C.ember);
      v.cyl(-4.5, 0, 4.6, 6, 12, C.iron);
      v.cyl(-4.5, 0, 3.2, 12, 13, C.iron);
      v.box(-5, 13, -1, -4, 14, 1, C.darkWood);
      v.box(0, 8, -1, 3, 9, 1, C.iron);
      v.box(2, 9, -1, 4, 10, 1, C.iron);
      v.box(-5, 12, -5, -4, 16, -4, C.darkWood);
      v.box(-5, 12, 4, -4, 16, 5, C.darkWood);
      v.box(-5, 16, -5, -4, 17, 5, C.darkWood);
      v.box(3, 0, -10, 12, 1, 10, stripes(C.lightWood, C.hinoki));
    },
    outputs: [V3(0.235, 0.031, -0.13), V3(0.235, 0.031, 0.13)],
    input: V3(0.235, 0.031, 0),
    steam: V3(0.1, 0.3, 0),
    light: 'embers',
  },
  edamame_bowl: {
    build: (v) => {
      v.box(-8, 0, -8, 8, 5, 8, C.lightWood);
      v.box(-7, 1, -7, 7, 5, 7, 0);
      v.box(-7, 1, -7, 7, 4, 7, (x, y, z) => ((x + y * 2 + z) % 3 === 0 ? C.edamame2 : C.edamame));
      v.box(-5, 4, -5, 5, 6, 5, (x, y, z) => ((x * 2 + y + z) % 3 === 0 ? C.edamame2 : C.edamame));
      v.box(-2, 6, -2, 3, 7, 3, C.edamame);
      v.box(3, 0, 9, 11, 3, 15, (_x, y) => (y % 2 ? C.ceramicBlue : C.ceramic));
    },
    outputs: [],
    input: V3(0, 0, 0),
    steam: null,
    light: null,
  },
  rice_cooker: {
    build: (v) => {
      v.cyl(-3, -4, 6.2, 0, 8, (_x, y) => (y === 1 ? C.mustard : C.white));
      v.cyl(-3, -4, 6.4, 8, 9, C.ceramic);
      v.cyl(-3, -4, 4.4, 9, 10, C.ceramic);
      v.box(-4, 10, -6, -2, 11, -2, C.black);
      v.box(3, 2, -7, 4, 5, -1, C.steelD);
      v.set(4, 4, -5, C.indicator);
      v.set(4, 3, -3, C.white);
      v.box(-3, 0, 4, 10, 1, 15, stripes(C.lightWood, C.hinoki));
    },
    outputs: [V3(0.03, 0.031, 0.22), V3(0.21, 0.031, 0.22), V3(0.03, 0.031, 0.4), V3(0.21, 0.031, 0.4)],
    input: V3(0, 0, 0),
    steam: V3(-0.09, 0.32, -0.12),
    light: 'indicator',
  },
  sushi_board: {
    build: (v) => {
      v.box(-8, 1, -16, 9, 2, 16, stripes(C.hinoki, C.hinoki2, 4));
      v.box(-8, 0, -16, 9, 1, -14, C.midWood);
      v.box(-8, 0, 14, 9, 1, 16, C.midWood);
      v.box(-7, 2, -14, -1, 5, -6, (x) => (x % 2 === 0 ? C.salmonL : C.salmon));
      v.box(4, 2, -13, 5, 3, -4, C.steel);
      v.box(4, 2, -4, 5, 3, 0, C.darkWood);
      v.box(-6, 2, 11, -4, 3, 13, C.wasabi);
      v.box(-3, 2, 11, 0, 3, 13, C.ginger);
    },
    outputs: [V3(0.03, 0.0625, 0.22)],
    input: V3(0.03, 0.0625, -0.02),
    steam: null,
    light: null,
  },
  default: {
    build: (v) => v.box(-6, 0, -6, 6, 6, 6, C.midWood),
    outputs: [V3(0.1, 0.19, 0)],
    input: V3(0, 0.19, 0),
    steam: null,
    light: null,
  },
};

const WASH_SECONDS_PER_DISH = 0.9;
const WASH_REACH = 1.7;

/** Sink on the north counter. Dishes only get washed while the player stands at it. */
export class Sink implements Interactable {
  readonly root = new THREE.Group();
  readonly label: StationLabel;
  readonly glow: THREE.Mesh;
  queue = 0;
  private progress = 0;
  private readonly stack: THREE.Object3D[] = [];
  private readonly water: THREE.Mesh;
  private readonly model: THREE.Group;

  constructor(
    private readonly game: Game,
    x: number,
    z: number,
  ) {
    this.root.position.set(x, COUNTER_TOP, z);
    this.root.rotation.y = -Math.PI / 2;
    this.model = modelGroup(
      cachedModel('sink', F, [0, 0, 0], (v) => {
        v.box(-9, 0, -14, 9, 4, 14, C.steel);
        v.box(-8, 1, -13, 8, 4, 13, 0);
        v.box(-8, 1, -13, 8, 2, 13, C.steelD);
        v.box(-10, 4, -1, -8, 12, 1, C.steel);
        v.box(-10, 11, -1, -3, 12, 1, C.steel);
        v.box(-4, 10, -1, -3, 11, 1, C.steel);
        v.box(3, 0, 15, 8, 2, 18, C.mustard);
      }),
    );
    this.root.add(this.model);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.8), new THREE.MeshStandardMaterial({ color: 0x8ab8d8, transparent: true, opacity: 0, roughness: 0.1 }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, 3.5 * F, 0);
    this.root.add(this.water);
    this.glow = makeGlowPool(x, COUNTER_TOP + 0.004, z + 0.2, 1.1, 0.9);
    this.label = { anchor: new THREE.Vector3(x, COUNTER_TOP + 0.62, z + 0.1), progress: null, ready: 0 };
  }

  outlineTargets(): THREE.Object3D[] {
    return [this.model, ...this.stack];
  }

  private get playerNear(): boolean {
    const p = this.game.player.position;
    const w = this.root.position;
    return p.y < 1 && Math.hypot(p.x - w.x, p.z - w.z) < WASH_REACH;
  }

  prompt(): Prompt {
    const g = this.game;
    const title = 'Sink';
    if (g.hand.item === DIRTY_DISHES) return { title, verb: `Put ${g.hand.qty} dish${g.hand.qty > 1 ? 'es' : ''} in the sink`, ok: true };
    if (!g.hand.empty) return { title, verb: `Can't wash ${g.hand.name}`, ok: false };
    if (this.queue > 0) return { title, verb: `Washing… ${this.queue} left`, detail: 'Stay at the sink while you wash', ok: false };
    return { title, verb: 'Bring dirty dishes here', detail: `${g.dishes.clean} clean dishes on the rack`, ok: false };
  }

  interact(): void {
    const g = this.game;
    if (g.hand.item !== DIRTY_DISHES) return g.reject();
    this.queue += g.hand.qty;
    g.hand.clear();
    g.audio.play('wash');
    this.syncStack();
  }

  update(dt: number): void {
    const washing = this.queue > 0 && this.playerNear;
    if (washing) {
      this.progress += dt / WASH_SECONDS_PER_DISH;
      if (this.progress >= 1) {
        this.progress = 0;
        this.queue--;
        this.game.dishes.clean++;
        this.game.rack.sync();
        this.syncStack();
        this.game.audio.play(this.queue > 0 ? 'wash' : 'clean');
      }
    }
    const m = this.water.material as THREE.MeshStandardMaterial;
    m.opacity = THREE.MathUtils.damp(m.opacity, this.queue > 0 ? 0.6 : 0, 4, dt);
    this.label.progress = this.queue > 0 ? this.progress : null;
    this.label.ready = 0;
  }

  private syncStack(): void {
    while (this.stack.length > Math.min(this.queue, 4)) disposeGroup(this.stack.pop()!);
    while (this.stack.length < Math.min(this.queue, 4)) {
      const m = makeItemMesh('dirtyDishes');
      m.position.set(0, 2 * F + this.stack.length * 0.02, -0.18 + this.stack.length * 0.12);
      this.root.add(m);
      this.stack.push(m);
    }
  }

  reset(): void {
    this.queue = 0;
    this.progress = 0;
    this.syncStack();
  }
}

/** Drying rack: shows how many clean dishes are ready. */
export class DishRack implements Interactable {
  readonly root = new THREE.Group();
  private readonly frame: THREE.Group;
  private stacks: THREE.Object3D[] = [];

  constructor(
    private readonly game: Game,
    x: number,
    z: number,
  ) {
    this.root.position.set(x, COUNTER_TOP, z);
    this.frame = modelGroup(dryingRack());
    this.root.add(this.frame);
  }

  sync(): void {
    for (const s of this.stacks) s.removeFromParent();
    this.stacks = [];
    let left = Math.min(this.game.dishes.clean, 24);
    for (let i = 0; left > 0 && i < 3; i++) {
      const n = Math.min(8, left);
      left -= n;
      const s = modelGroup(plateStack(n));
      s.position.set(-0.22 + i * 0.22, F, 0);
      this.root.add(s);
      this.stacks.push(s);
    }
  }

  outlineTargets(): THREE.Object3D[] {
    return [this.frame, ...this.stacks];
  }

  prompt(): Prompt {
    const n = this.game.dishes.clean;
    return { title: 'Drying Rack', verb: `${n} clean dish${n === 1 ? '' : 'es'}`, detail: n < 4 ? 'Running low — wash dirty dishes at the sink' : 'Cooking uses a clean dish', ok: false };
  }

  interact(): void {
    this.game.reject();
  }
}

export class Crate implements Interactable {
  readonly root = new THREE.Group();
  readonly glow: THREE.Mesh;
  private readonly model: THREE.Group;

  constructor(private readonly game: Game) {
    this.root.position.set(CRATE.x, 0, CRATE.z);
    this.model = modelGroup(
      cachedModel('delivery-crate', F, [0, 0, 0], (v) => {
        v.box(-13, 0, -10, 13, 15, 10, (x, y, z) => (y % 5 === 4 || x === -13 || x === 12 || z === -10 || z === 9 ? C.midWood : C.midWood2));
        v.box(-12, 4, -9, 12, 15, 9, 0);
        v.box(-12, 4, -9, -1, 13, -1, C.straw);
        v.box(-11, 13, -8, -2, 15, -2, C.straw);
        v.box(1, 4, -9, 12, 12, -1, C.cream);
        v.box(2, 12, -8, 11, 14, -2, C.salmon);
        v.box(-12, 4, 0, 0, 12, 9, C.edamame);
        v.box(-11, 12, 1, -1, 14, 8, C.edamame2);
        v.box(1, 4, 0, 12, 11, 9, C.leaf);
        v.box(3, 11, 2, 9, 15, 7, C.red);
      }),
    );
    this.root.add(this.model);
    this.glow = makeGlowPool(CRATE.x + 0.1, 0.01, CRATE.z, 1.3, 1.1);
  }

  outlineTargets(): THREE.Object3D[] {
    return [this.model];
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
  private readonly textures: Record<'closed' | 'open', THREE.Texture>;

  constructor(
    private readonly game: Game,
    pos: THREE.Vector3,
    textures: Record<'closed' | 'open', THREE.Texture>,
  ) {
    this.textures = textures;
    this.face = new THREE.MeshStandardMaterial({ map: textures.closed, roughness: 0.9, emissive: 0xffe0b0, emissiveMap: textures.closed, emissiveIntensity: 0.25 });
    const frame = modelGroup(
      cachedModel('sign-frame', F, [10.5, 6, 1], (v) => {
        v.box(0, 0, 0, 21, 12, 1, C.darkWood);
        v.box(4, 12, 0, 5, 18, 1, C.rope);
        v.box(16, 12, 0, 17, 18, 1, C.rope);
      }),
    );
    frame.rotation.y = Math.PI;
    this.root.add(frame);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.32), this.face);
    board.rotation.y = Math.PI;
    board.position.z = -0.02;
    this.root.add(board);
    this.root.position.copy(pos);
  }

  setOpen(open: boolean): void {
    const t = open ? this.textures.open : this.textures.closed;
    this.face.map = t;
    this.face.emissiveMap = t;
    this.face.needsUpdate = true;
  }

  outlineTargets(): THREE.Object3D[] {
    return [this.root];
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
