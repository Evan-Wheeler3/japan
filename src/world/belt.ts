import * as THREE from 'three';
import type { Game } from '../app/Game';
import { DIRTY_DISHES } from '../data/content';
import type { ItemId } from '../data/types';
import type { Interactable, Prompt } from './interaction';
import { disposeGroup, makeItemMesh } from './items';
import { BELT } from './layout';
import { beltPlate } from './props';
import { modelGroup } from './voxel/vox';

const PLATE_SPACING = 0.3;
const PLATE_COLORS: Record<string, number> = { nigiri_salmon: 0xc8402a, edamame: 0x4f8a2c, tea_green: 0x3d5f90, rice_portion: 0xe0b040 };

export interface BeltPlate {
  item: ItemId;
  s: number;
  mesh: THREE.Group;
  /** Plates the player loaded but no seated customer has claimed yet are free to circle. */
}

/**
 * Kaiten conveyor: a rounded-rectangle loop. Plates travel north lane (+x, kitchen → dining),
 * around the east end, back along the south lane (−x) into the kitchen, and around the west end.
 */
export class ConveyorBelt implements Interactable {
  readonly root = new THREE.Group();
  readonly length: number;
  readonly plates: BeltPlate[] = [];
  private readonly straight = BELT.xb - BELT.xa;
  private readonly arc = Math.PI * BELT.r;
  private readonly slats: THREE.InstancedMesh;
  private readonly slatCount: number;
  private offset = 0;
  private readonly hit: THREE.Group;
  private readonly tmp = new THREE.Object3D();

  constructor(private readonly game: Game) {
    this.length = 2 * this.straight + 2 * this.arc;
    this.slatCount = Math.floor(this.length / 0.1);
    const slatGeo = new THREE.BoxGeometry(0.075, 0.03, BELT.laneHalf * 2 - 0.02);
    const slatMat = new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.5, metalness: 0.5, flatShading: true });
    this.slats = new THREE.InstancedMesh(slatGeo, slatMat, this.slatCount);
    this.slats.frustumCulled = false;
    this.root.add(this.slats);

    // invisible hit volumes over both lanes and the ends
    this.hit = new THREE.Group();
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(this.straight, 0.2, BELT.laneHalf * 2 + 0.04), hidden);
      b.position.set((BELT.xa + BELT.xb) / 2, BELT.top + 0.02, side * BELT.r);
      this.hit.add(b);
    }
    for (const x of [BELT.xa, BELT.xb]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(BELT.r + BELT.laneHalf, BELT.r + BELT.laneHalf, 0.2, 16), hidden);
      b.position.set(x + (x === BELT.xa ? -0.2 : 0.2), BELT.top + 0.02, 0);
      b.scale.set(0.6, 1, 1);
      this.hit.add(b);
    }
    this.root.add(this.hit);
  }

  /** Position and heading along the loop at arc length s. */
  pointAt(s: number, out = new THREE.Vector3()): { pos: THREE.Vector3; angle: number } {
    s = ((s % this.length) + this.length) % this.length;
    const { xa, xb, r } = BELT;
    if (s < this.straight) return { pos: out.set(xa + s, BELT.top, -r), angle: 0 };
    s -= this.straight;
    if (s < this.arc) {
      const a = -Math.PI / 2 + s / r;
      return { pos: out.set(xb + Math.cos(a) * r, BELT.top, Math.sin(a) * r), angle: -a - Math.PI / 2 };
    }
    s -= this.arc;
    if (s < this.straight) return { pos: out.set(xb - s, BELT.top, r), angle: Math.PI };
    s -= this.straight;
    const a = Math.PI / 2 + s / r;
    return { pos: out.set(xa + Math.cos(a) * r, BELT.top, Math.sin(a) * r), angle: -a - Math.PI / 2 };
  }

  /** Arc length of the belt point nearest (x, z). */
  sAt(x: number, z: number): number {
    const { xa, xb, r } = BELT;
    if (x >= xa && x <= xb) return z < 0 ? x - xa : this.straight + this.arc + (xb - x);
    if (x > xb) {
      const a = Math.atan2(z, x - xb);
      return this.straight + (a + Math.PI / 2) * r;
    }
    let a = Math.atan2(z, x - xa);
    if (a < 0) a += Math.PI * 2;
    return 2 * this.straight + this.arc + Math.max(0, a - Math.PI / 2) * r;
  }

  /** Arc length where a customer seated beside the belt at (x, side) reaches across. */
  seatS(x: number, side: -1 | 1): number {
    return side < 0 ? x - BELT.xa : this.straight + this.arc + (BELT.xb - x);
  }

  private gap(a: number, b: number): number {
    const d = Math.abs(a - b) % this.length;
    return Math.min(d, this.length - d);
  }

  isFree(s: number): boolean {
    return this.plates.every((p) => this.gap(p.s, s) >= PLATE_SPACING);
  }

  place(item: ItemId, s: number): boolean {
    if (!this.isFree(s)) return false;
    const mesh = new THREE.Group();
    mesh.add(modelGroup(beltPlate(PLATE_COLORS[item] ?? 0x8a7a5a)));
    const food = makeItemMesh(this.game.content.items.get(item).visual);
    food.position.y = 1 / 48;
    mesh.add(food);
    this.root.add(mesh);
    const plate: BeltPlate = { item, s, mesh };
    this.plates.push(plate);
    this.placeMesh(plate);
    return true;
  }

  remove(p: BeltPlate): void {
    const i = this.plates.indexOf(p);
    if (i >= 0) this.plates.splice(i, 1);
    disposeGroup(p.mesh);
  }

  /** Nearest plate to `s` within `window` metres matching `want`. */
  findNear(s: number, window: number, want: (item: ItemId) => boolean): BeltPlate | null {
    let best: BeltPlate | null = null;
    let bestD = window;
    for (const p of this.plates) {
      const d = this.gap(p.s, s);
      if (d <= bestD && want(p.item)) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  private placeMesh(p: BeltPlate): void {
    const { pos, angle } = this.pointAt(p.s);
    p.mesh.position.set(pos.x, pos.y + 0.012, pos.z);
    p.mesh.rotation.y = angle;
  }

  reset(): void {
    for (const p of [...this.plates]) this.remove(p);
  }

  update(dt: number): void {
    const ds = BELT.speed * dt;
    this.offset = (this.offset + ds) % this.length;
    for (const p of this.plates) {
      p.s = (p.s + ds) % this.length;
      this.placeMesh(p);
    }
    for (let i = 0; i < this.slatCount; i++) {
      const { pos, angle } = this.pointAt(i * (this.length / this.slatCount) + this.offset);
      this.tmp.position.set(pos.x, pos.y - 0.02, pos.z);
      this.tmp.rotation.set(0, angle, 0);
      this.tmp.updateMatrix();
      this.slats.setMatrixAt(i, this.tmp.matrix);
    }
    this.slats.instanceMatrix.needsUpdate = true;
  }

  outlineTargets(): THREE.Object3D[] {
    const hovered = this.hoveredPlate();
    return hovered ? [hovered.mesh] : [this.slats];
  }

  private hoveredPlate(): BeltPlate | null {
    const hit = this.game.interaction.lastHit;
    if (!hit || this.game.interaction.hovered !== this) return null;
    return this.findNear(this.sAt(hit.point.x, hit.point.z), 0.2, () => true);
  }

  prompt(): Prompt {
    const g = this.game;
    const title = 'Sushi Belt';
    if (!g.hand.empty) {
      if (g.hand.item === DIRTY_DISHES) return { title, verb: 'Dirty dishes go to the sink', ok: false };
      const hit = g.interaction.lastHit;
      const free = hit ? this.isFree(this.sAt(hit.point.x, hit.point.z)) : false;
      return free ? { title, verb: `Put ${g.hand.name} on the belt`, detail: 'Customers take what they ordered as it passes', ok: true } : { title, verb: 'No room here', ok: false };
    }
    const p = this.hoveredPlate();
    if (p) return { title, verb: `Take ${g.content.items.get(p.item).name}`, ok: true };
    return { title, verb: 'Carries dishes past the counter seats', ok: false };
  }

  interact(hit: THREE.Intersection): void {
    const g = this.game;
    const s = this.sAt(hit.point.x, hit.point.z);
    if (!g.hand.empty) {
      if (g.hand.item === DIRTY_DISHES || !this.place(g.hand.item!, s)) return g.reject();
      g.hand.clear();
      g.audio.play('place');
      return;
    }
    const p = this.findNear(s, 0.2, () => true);
    if (!p) return g.reject();
    g.hand.take(p.item);
    this.remove(p);
    g.audio.play('pickup');
  }
}
