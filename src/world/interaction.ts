import * as THREE from 'three';
import type { Content } from '../data/registry';
import { DIRTY_DISHES } from '../data/content';
import type { ItemId } from '../data/types';
import { disposeGroup, makeItemMesh } from './items';

export interface Prompt {
  title: string;
  verb?: string;
  detail?: string;
  ok: boolean;
}

export interface Interactable {
  readonly root: THREE.Object3D;
  prompt(): Prompt | null;
  interact(hit: THREE.Intersection): void;
  /** Visible objects that get the soft hover outline. */
  outlineTargets(): THREE.Object3D[];
}

const REACH = 2.7;

/** Raycasts from the screen centre each frame to find the interactable under the crosshair. */
export class InteractionSystem {
  hovered: Interactable | null = null;
  lastHit: THREE.Intersection | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly interactables = new Set<Interactable>();
  private readonly extraTargets = new Set<THREE.Object3D>();
  private readonly centre = new THREE.Vector2(0, 0);

  constructor(private readonly blockers: THREE.Object3D[]) {
    this.raycaster.far = REACH;
  }

  register(i: Interactable): void {
    i.root.userData.interactable = i;
    this.interactables.add(i);
  }

  unregister(i: Interactable): void {
    this.interactables.delete(i);
    if (this.hovered === i) this.hovered = null;
  }

  /** Extra objects (e.g. customers) whose userData.interactable points at an owner. */
  addTarget(o: THREE.Object3D): void {
    this.extraTargets.add(o);
  }

  removeTarget(o: THREE.Object3D): void {
    this.extraTargets.delete(o);
  }

  update(camera: THREE.Camera, enabled: boolean): void {
    this.hovered = null;
    this.lastHit = null;
    if (!enabled) return;
    this.raycaster.setFromCamera(this.centre, camera);
    const roots = [...this.interactables].map((i) => i.root);
    const hits = this.raycaster.intersectObjects([...roots, ...this.extraTargets, ...this.blockers], true);
    const hit = hits[0];
    const owner = hit ? findInteractable(hit.object) : null;
    if (owner && hit) {
      this.hovered = owner;
      this.lastHit = hit;
    }
  }

  click(): void {
    if (this.hovered && this.lastHit) this.hovered.interact(this.lastHit);
  }
}

function findInteractable(o: THREE.Object3D | null): Interactable | null {
  while (o) {
    const i = o.userData.interactable as Interactable | undefined;
    if (i) return i;
    o = o.parent;
  }
  return null;
}

/** The player's single carrying slot, rendered in the lower-right of the view. */
export class Hand {
  item: ItemId | null = null;
  /** Number of plates when carrying a stack of dirty dishes. */
  qty = 1;
  private mesh: THREE.Object3D | null = null;
  private readonly holder = new THREE.Group();
  private bob = 0;

  constructor(
    camera: THREE.Camera,
    private readonly content: Content,
  ) {
    this.holder.position.set(0.3, -0.27, -0.62);
    this.holder.rotation.set(0.35, -0.45, 0);
    this.holder.scale.setScalar(0.62);
    camera.add(this.holder);
  }

  get empty(): boolean {
    return this.item === null;
  }

  get name(): string {
    if (!this.item) return '';
    const n = this.content.items.get(this.item).name;
    return this.item === DIRTY_DISHES && this.qty > 1 ? `${n} ×${this.qty}` : n;
  }

  /** Picks up (or adds to) a stack of dirty dishes. */
  takeDirty(n: number): void {
    const total = this.item === DIRTY_DISHES ? this.qty + n : n;
    this.take(DIRTY_DISHES);
    this.qty = total;
  }

  take(item: ItemId): void {
    this.clear();
    this.item = item;
    this.qty = 1;
    this.mesh = makeItemMesh(this.content.items.get(item).visual);
    this.holder.add(this.mesh);
    this.bob = 0.12;
  }

  clear(): ItemId | null {
    const prev = this.item;
    if (this.mesh) disposeGroup(this.mesh);
    this.mesh = null;
    this.item = null;
    this.qty = 1;
    return prev;
  }

  update(dt: number, time: number): void {
    this.bob = Math.max(0, this.bob - dt * 0.6);
    this.holder.position.y = -0.27 - this.bob + Math.sin(time * 2) * 0.004;
  }
}
