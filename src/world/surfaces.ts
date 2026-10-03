import * as THREE from 'three';
import type { Game } from '../app/Game';
import { DIRTY_DISHES } from '../data/content';
import type { ItemId } from '../data/types';
import type { Rect, SurfaceDef } from './geometry';
import type { Interactable, Prompt } from './interaction';
import { disposeGroup, makeItemMesh } from './items';

const MIN_GAP = 0.2;
const SNAP = 0.0625;

/** An item resting on a counter or table, free to pick back up. */
export class LooseItem implements Interactable {
  readonly root = new THREE.Group();

  constructor(
    private readonly game: Game,
    readonly item: ItemId,
    public qty: number,
    pos: THREE.Vector3,
    rotY: number,
  ) {
    this.root.add(makeItemMesh(game.content.items.get(item).visual));
    this.root.position.copy(pos);
    this.root.rotation.y = rotY;
  }

  get name(): string {
    const n = this.game.content.items.get(this.item).name;
    return this.item === DIRTY_DISHES && this.qty > 1 ? `${n} ×${this.qty}` : n;
  }

  outlineTargets(): THREE.Object3D[] {
    return [this.root];
  }

  prompt(): Prompt {
    const hand = this.game.hand;
    if (hand.empty) return { title: this.name, verb: `Pick up ${this.name}`, ok: true };
    if (hand.item === DIRTY_DISHES && this.item === DIRTY_DISHES) return { title: this.name, verb: 'Stack onto your dishes', ok: true };
    return { title: this.name, verb: 'Hands full', ok: false };
  }

  interact(): void {
    const g = this.game;
    if (g.hand.empty || (g.hand.item === DIRTY_DISHES && this.item === DIRTY_DISHES)) {
      if (this.item === DIRTY_DISHES) g.hand.takeDirty(this.qty);
      else g.hand.take(this.item);
      g.loose.remove(this);
      g.audio.play('pickup');
      return;
    }
    g.reject();
  }
}

export class LooseItems {
  readonly items: LooseItem[] = [];

  constructor(
    private readonly game: Game,
    /** Footprints (e.g. stations) where nothing can be set down. */
    private readonly blocked: Rect[],
  ) {}

  canPlace(x: number, z: number, y: number): boolean {
    if (this.blocked.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)) return false;
    return this.items.every((it) => Math.abs(it.root.position.y - y) > 0.3 || Math.hypot(it.root.position.x - x, it.root.position.z - z) >= MIN_GAP);
  }

  place(item: ItemId, qty: number, pos: THREE.Vector3, rotY = 0): boolean {
    if (!this.canPlace(pos.x, pos.z, pos.y)) return false;
    const it = new LooseItem(this.game, item, qty, pos, rotY);
    this.items.push(it);
    this.game.scene.add(it.root);
    this.game.interaction.register(it);
    return true;
  }

  remove(it: LooseItem): void {
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
    this.game.interaction.unregister(it);
    disposeGroup(it.root);
  }

  reset(): void {
    for (const it of [...this.items]) this.remove(it);
  }

  count(item: ItemId): number {
    return this.items.filter((i) => i.item === item).reduce((s, i) => s + i.qty, 0);
  }
}

/** Invisible slab over a counter top; clicking it with something in hand sets that thing down. */
export class SurfaceEntity implements Interactable {
  readonly root: THREE.Mesh;

  constructor(
    private readonly game: Game,
    readonly def: SurfaceDef,
  ) {
    const w = def.maxX - def.minX;
    const d = def.maxZ - def.minZ;
    this.root = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), new THREE.MeshBasicMaterial({ visible: false }));
    this.root.position.set((def.minX + def.maxX) / 2, def.top + 0.005, (def.minZ + def.maxZ) / 2);
  }

  outlineTargets(): THREE.Object3D[] {
    return [];
  }

  private spotFor(hit: THREE.Intersection): THREE.Vector3 {
    const d = this.def;
    const snap = (v: number, lo: number, hi: number) => Math.min(hi - 0.08, Math.max(lo + 0.08, Math.round(v / SNAP) * SNAP));
    return new THREE.Vector3(snap(hit.point.x, d.minX, d.maxX), d.top, snap(hit.point.z, d.minZ, d.maxZ));
  }

  prompt(): Prompt | null {
    const g = this.game;
    if (g.hand.empty) return null;
    const hit = g.interaction.lastHit;
    const p = hit ? this.spotFor(hit) : null;
    if (p && g.loose.canPlace(p.x, p.z, p.y)) return { title: 'Counter', verb: `Set down ${g.hand.name}`, ok: true };
    return { title: 'Counter', verb: 'No room here', ok: false };
  }

  interact(hit: THREE.Intersection): void {
    const g = this.game;
    if (g.hand.empty) return;
    const p = this.spotFor(hit);
    const yaw = Math.atan2(g.camera.position.x - p.x, g.camera.position.z - p.z);
    if (!g.loose.place(g.hand.item!, g.hand.qty, p, Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2))) return g.reject();
    g.hand.clear();
    g.audio.play('place');
  }
}
