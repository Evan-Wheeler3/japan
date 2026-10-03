import * as THREE from 'three';
import type { CustomerLook } from '../data/types';
import { boxMesh } from './geometry';
import { mat } from './materials';

export type Pose = 'stand' | 'walk' | 'sit' | 'eat';

/** Chunky voxel-style humanoid. Origin at the feet, facing +Z. */
export class Figure {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly head: THREE.Group;
  private phase = Math.random() * 10;
  pose: Pose = 'stand';

  constructor(look: CustomerLook) {
    const skin = mat(look.skin);
    const top = mat(look.top);
    const bottom = mat(look.bottom);
    const hair = mat(look.hair);
    const dark = mat(0x111111);

    const limb = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      pivot.add(boxMesh(m, w, h, d, 0, -h / 2, 0));
      this.body.add(pivot);
      return pivot;
    };

    this.legL = limb(bottom, 0.17, 0.74, 0.19, -0.11, 0.76);
    this.legR = limb(bottom, 0.17, 0.74, 0.19, 0.11, 0.76);
    this.body.add(boxMesh(top, 0.48, 0.6, 0.27, 0, 1.06, 0));
    if (look.accent !== undefined) this.body.add(boxMesh(mat(look.accent), 0.07, 0.36, 0.02, 0, 1.12, 0.14));
    this.armL = limb(top, 0.13, 0.56, 0.15, -0.31, 1.34);
    this.armR = limb(top, 0.13, 0.56, 0.15, 0.31, 1.34);
    this.armL.children[0].add(boxMesh(skin, 0.12, 0.1, 0.13, 0, -0.32, 0));
    this.armR.children[0].add(boxMesh(skin, 0.12, 0.1, 0.13, 0, -0.32, 0));

    this.head = new THREE.Group();
    this.head.position.set(0, 1.36, 0);
    this.head.add(boxMesh(skin, 0.38, 0.38, 0.36, 0, 0.21, 0));
    this.head.add(boxMesh(dark, 0.06, 0.07, 0.01, -0.08, 0.23, 0.181));
    this.head.add(boxMesh(dark, 0.06, 0.07, 0.01, 0.08, 0.23, 0.181));
    this.head.add(boxMesh(mat(0xd88a7a), 0.06, 0.03, 0.01, -0.13, 0.15, 0.181));
    this.head.add(boxMesh(mat(0xd88a7a), 0.06, 0.03, 0.01, 0.13, 0.15, 0.181));
    switch (look.hairStyle) {
      case 'short':
        this.head.add(boxMesh(hair, 0.41, 0.12, 0.39, 0, 0.42, -0.01));
        this.head.add(boxMesh(hair, 0.41, 0.2, 0.08, 0, 0.3, -0.16));
        this.head.add(boxMesh(hair, 0.4, 0.06, 0.06, 0, 0.36, 0.17));
        break;
      case 'long':
        this.head.add(boxMesh(hair, 0.42, 0.13, 0.4, 0, 0.42, -0.01));
        this.head.add(boxMesh(hair, 0.42, 0.46, 0.1, 0, 0.18, -0.17));
        this.head.add(boxMesh(hair, 0.06, 0.3, 0.3, -0.2, 0.25, -0.02));
        this.head.add(boxMesh(hair, 0.06, 0.3, 0.3, 0.2, 0.25, -0.02));
        break;
      case 'bun':
        this.head.add(boxMesh(hair, 0.41, 0.12, 0.39, 0, 0.42, -0.01));
        this.head.add(boxMesh(hair, 0.41, 0.24, 0.08, 0, 0.3, -0.16));
        this.head.add(boxMesh(hair, 0.16, 0.14, 0.14, 0, 0.53, -0.1));
        break;
      case 'bald':
        this.head.add(boxMesh(hair, 0.06, 0.12, 0.26, -0.2, 0.24, -0.04));
        this.head.add(boxMesh(hair, 0.06, 0.12, 0.26, 0.2, 0.24, -0.04));
        this.head.add(boxMesh(hair, 0.41, 0.12, 0.06, 0, 0.24, -0.17));
        break;
    }
    this.body.add(this.head);
    this.root.add(this.body);
    this.root.scale.setScalar(look.height);
  }

  setPose(p: Pose): void {
    this.pose = p;
  }

  update(dt: number, seatHeight: number): void {
    this.phase += dt;
    const t = this.phase;
    let legSwing = 0;
    let armSwing = 0;
    let bob = 0;
    this.legL.rotation.x = this.legR.rotation.x = 0;
    this.armL.rotation.x = this.armR.rotation.x = 0;
    this.body.position.y = 0;
    this.head.rotation.x = 0;
    switch (this.pose) {
      case 'walk':
        legSwing = Math.sin(t * 9) * 0.5;
        armSwing = -legSwing * 0.8;
        bob = Math.abs(Math.cos(t * 9)) * 0.03;
        this.legL.rotation.x = legSwing;
        this.legR.rotation.x = -legSwing;
        this.armL.rotation.x = armSwing;
        this.armR.rotation.x = -armSwing;
        this.body.position.y = bob;
        break;
      case 'stand':
        this.head.rotation.x = Math.sin(t * 0.8) * 0.03;
        break;
      case 'sit':
      case 'eat': {
        const scale = this.root.scale.y || 1;
        this.body.position.y = seatHeight / scale - 0.76 + 0.02;
        this.legL.rotation.x = this.legR.rotation.x = -Math.PI / 2;
        this.armL.rotation.x = this.armR.rotation.x = -0.5;
        if (this.pose === 'eat') {
          this.armR.rotation.x = -1.1 - Math.max(0, Math.sin(t * 3.2)) * 0.6;
          this.head.rotation.x = 0.12 + Math.max(0, Math.sin(t * 3.2)) * 0.06;
        } else {
          this.head.rotation.x = Math.sin(t * 0.6) * 0.04;
        }
        break;
      }
    }
  }
}
