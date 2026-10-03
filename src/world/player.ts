import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { Rect } from './geometry';
import { APARTMENT, KITCHEN, STAIRS } from './layout';

const EYE_HEIGHT = 1.62;
const RADIUS = 0.28;
const WALK_SPEED = 3.0;
const SPRINT_MULT = 1.6;
const STEP_LENGTH = 0.7;

/** Floor height under (x, z): ground, the 1:1 stair ramp, or the apartment floor once upstairs. */
export function floorHeight(x: number, z: number, current: number): number {
  if (z >= STAIRS.minZ && z <= STAIRS.maxZ && x >= STAIRS.topX && x <= STAIRS.bottomX) return Math.min(APARTMENT.floor, Math.max(0, STAIRS.bottomX - x));
  const inWing = x >= KITCHEN.minX - 0.3 && x <= KITCHEN.maxX + 0.1 && z >= KITCHEN.minZ - 0.3 && z <= KITCHEN.maxZ + 0.3;
  return inWing && current > 1.7 ? APARTMENT.floor : 0;
}

export class Player {
  readonly controls: PointerLockControls;
  readonly position = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private readonly velocity = new THREE.Vector3();
  private bobPhase = 0;
  private stepAcc = 0;
  onStep: (() => void) | null = null;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    private readonly colliders: Rect[],
  ) {
    this.controls = new PointerLockControls(camera, dom);
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get locked(): boolean {
    return this.controls.isLocked;
  }

  get upstairs(): boolean {
    return this.position.y > 1.7;
  }

  setSensitivity(v: number): void {
    this.controls.pointerSpeed = v;
  }

  teleport(p: THREE.Vector3, yaw: number): void {
    this.position.set(p.x, p.y, p.z);
    this.velocity.set(0, 0, 0);
    this.camera.position.set(p.x, p.y + EYE_HEIGHT, p.z);
    this.camera.rotation.set(0, yaw, 0, 'YXZ');
  }

  update(dt: number): void {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(WALK_SPEED * (sprint ? SPRINT_MULT : 1));
    this.velocity.lerp(wish, 1 - Math.exp(-dt * 14));

    const beforeX = this.position.x;
    const beforeZ = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    const feet = this.position.y;
    for (let i = 0; i < 2; i++)
      for (const r of this.colliders) {
        if ((r.minY ?? -Infinity) >= feet + 1.5 || (r.maxY ?? Infinity) <= feet + 0.25) continue;
        pushOut(this.position, r);
      }
    const target = floorHeight(this.position.x, this.position.z, feet);
    this.position.y = THREE.MathUtils.damp(this.position.y, target, 18, dt);
    if (Math.abs(this.position.y - target) < 0.002) this.position.y = target;

    const moved = Math.hypot(this.position.x - beforeX, this.position.z - beforeZ);
    this.stepAcc += moved;
    if (this.stepAcc > STEP_LENGTH) {
      this.stepAcc = 0;
      this.onStep?.();
    }
    const speed = moved / Math.max(dt, 1e-4);
    this.bobPhase += moved * 9;
    const bob = Math.min(1, speed / WALK_SPEED) * Math.sin(this.bobPhase) * 0.025;
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT + bob, this.position.z);
  }
}

function pushOut(p: THREE.Vector3, r: Rect): void {
  const cx = Math.max(r.minX, Math.min(p.x, r.maxX));
  const cz = Math.max(r.minZ, Math.min(p.z, r.maxZ));
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= RADIUS * RADIUS) return;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * RADIUS;
    p.z = cz + (dz / d) * RADIUS;
    return;
  }
  const left = p.x - r.minX;
  const rightD = r.maxX - p.x;
  const back = p.z - r.minZ;
  const front = r.maxZ - p.z;
  const m = Math.min(left, rightD, back, front);
  if (m === left) p.x = r.minX - RADIUS;
  else if (m === rightD) p.x = r.maxX + RADIUS;
  else if (m === back) p.z = r.minZ - RADIUS;
  else p.z = r.maxZ + RADIUS;
}
