import * as THREE from 'three';
import type { ItemId } from '../data/types';
import type { Content } from '../data/registry';
import { makeItemMesh, disposeGroup } from './items';

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
  outline(): THREE.Box3;
}

const REACH = 2.7;

/** Raycasts from the screen centre each frame to find the interactable under the crosshair. */
export class InteractionSystem {
  hovered: Interactable | null = null;
  lastHit: THREE.Intersection | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly interactables = new Set<Interactable>();
  private readonly extraTargets = new Set<THREE.Object3D>();
  private readonly outlineMesh: THREE.LineSegments;

  constructor(
    scene: THREE.Scene,
    private readonly blockers: THREE.Object3D[],
  ) {
    this.raycaster.far = REACH;
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.outlineMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.85, depthTest: false }));
    this.outlineMesh.renderOrder = 999;
    this.outlineMesh.visible = false;
    scene.add(this.outlineMesh);
  }

  register(i: Interactable): void {
    i.root.userData.interactable = i;
    this.interactables.add(i);
  }

  /** Extra objects (e.g. customers) whose userData.interactable points at an owner. */
  addTarget(o: THREE.Object3D): void {
    this.extraTargets.add(o);
  }

  removeTarget(o: THREE.Object3D): void {
    this.extraTargets.delete(o);
  }

  unregister(i: Interactable): void {
    this.interactables.delete(i);
    if (this.hovered === i) this.hovered = null;
  }

  update(camera: THREE.Camera, enabled: boolean, time: number): void {
    this.hovered = null;
    this.lastHit = null;
    if (enabled) {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const roots = [...this.interactables].map((i) => i.root);
      const hits = this.raycaster.intersectObjects([...roots, ...this.extraTargets, ...this.blockers], true);
      for (const hit of hits) {
        const owner = findInteractable(hit.object);
        if (owner) {
          this.hovered = owner;
          this.lastHit = hit;
        }
        break;
      }
    }
    if (this.hovered) {
      const box = this.hovered.outline();
      box.getCenter(this.outlineMesh.position);
      box.getSize(this.outlineMesh.scale);
      this.outlineMesh.scale.addScalar(0.04);
      (this.outlineMesh.material as THREE.LineBasicMaterial).opacity = 0.55 + Math.sin(time * 5) * 0.2;
      this.outlineMesh.visible = true;
    } else {
      this.outlineMesh.visible = false;
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
  private mesh: THREE.Object3D | null = null;
  private readonly holder = new THREE.Group();
  private bob = 0;

  constructor(
    camera: THREE.Camera,
    private readonly content: Content,
  ) {
    this.holder.position.set(0.34, -0.3, -0.72);
    this.holder.rotation.set(0.3, -0.4, 0);
    this.holder.scale.setScalar(0.95);
    camera.add(this.holder);
  }

  get empty(): boolean {
    return this.item === null;
  }

  get name(): string {
    return this.item ? this.content.items.get(this.item).name : '';
  }

  take(item: ItemId): void {
    this.clear();
    this.item = item;
    this.mesh = makeItemMesh(this.content.items.get(item).visual);
    this.mesh.traverse((o) => {
      o.renderOrder = 10;
    });
    this.holder.add(this.mesh);
    this.bob = 0.12;
  }

  clear(): ItemId | null {
    const prev = this.item;
    if (this.mesh) disposeGroup(this.mesh);
    this.mesh = null;
    this.item = null;
    return prev;
  }

  update(dt: number, time: number): void {
    this.bob = Math.max(0, this.bob - dt * 0.6);
    this.holder.position.y = -0.3 - this.bob + Math.sin(time * 2) * 0.004;
  }
}
