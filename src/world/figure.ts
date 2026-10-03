import * as THREE from 'three';
import type { CustomerLook } from '../data/types';
import { C, PAL } from './voxel/palette';
import { cachedModel, modelGroup, type Vox } from './voxel/vox';

export type Pose = 'stand' | 'walk' | 'sit' | 'eat';

/** Character voxel size: 5cm. A full adult is 32 voxels tall. */
const FV = 0.05;
const HIP = 0.65;
const SHOULDER = 1.17;
const NECK = 1.2;

const blush = PAL.add(0xe89a8a, 0.02);
const shoe = PAL.add(0x2a1e18, 0.04);
const mouth = PAL.add(0x8a3a30, 0.02);

function head(look: CustomerLook) {
  const skin = PAL.add(look.skin, 0.02);
  const hair = PAL.add(look.hair, 0.05);
  const hat = look.hat !== undefined ? PAL.add(look.hat, 0.06) : 0;
  return cachedModel(`head-${look.skin}-${look.hair}-${look.hairStyle}-${look.hat}`, FV, [4, 0, 4], (v: Vox) => {
    v.box(0, 0, 0, 8, 8, 8, skin);
    // face (front is +z)
    for (const x of [2, 5]) v.box(x, 3, 7, x + 1, 5, 8, C.black);
    v.set(1, 2, 7, blush);
    v.set(6, 2, 7, blush);
    v.box(3, 1, 7, 5, 2, 8, mouth);
    const style = look.hairStyle;
    if (style === 'bald') {
      v.box(0, 3, 1, 1, 6, 6, hair);
      v.box(7, 3, 1, 8, 6, 6, hair);
      v.box(0, 3, 0, 8, 6, 1, hair);
    } else {
      v.box(0, 7, 0, 8, 8, 8, hair);
      v.box(0, 2, 0, 8, 8, 2, hair);
      v.box(0, 4, 0, 1, 8, 7, hair);
      v.box(7, 4, 0, 8, 8, 7, hair);
      v.box(0, 6, 7, 8, 7, 8, hair);
      v.set(0, 5, 7, hair);
      v.set(7, 5, 7, hair);
      v.box(-1, 7, -1, 9, 8, 8, hair);
      if (style === 'long') {
        v.box(0, -4, 0, 8, 2, 2, hair);
        v.box(-1, 0, 0, 0, 7, 5, hair);
        v.box(8, 0, 0, 9, 7, 5, hair);
      }
      if (style === 'bun') v.box(2, 8, 1, 6, 11, 5, hair);
    }
    if (hat) {
      v.box(-1, 6, -1, 9, 9, 9, hat);
      v.box(0, 9, 0, 8, 10, 8, hat);
      v.box(-1, 6, -1, 9, 7, 9, C.cream);
      v.box(3, 10, 3, 5, 12, 5, C.cream);
    }
  });
}

function torso(look: CustomerLook) {
  const top = PAL.add(look.top, 0.05);
  const accent = look.accent !== undefined ? PAL.add(look.accent, 0.03) : 0;
  const scarf = look.scarf !== undefined ? PAL.add(look.scarf, 0.06) : 0;
  return cachedModel(`torso-${look.top}-${look.accent}-${look.scarf}`, FV, [4.5, 0, 2.5], (v: Vox) => {
    v.box(0, 0, 0, 9, 11, 5, top);
    v.box(0, 0, 0, 9, 1, 5, C.black);
    if (accent) {
      v.box(4, 3, 5, 5, 10, 6, accent);
      v.box(3, 9, 5, 6, 11, 6, C.white);
    } else {
      for (const y of [3, 6]) v.set(4, y, 5, C.gold);
    }
    if (scarf) {
      v.box(-1, 9, -1, 10, 11, 6, scarf);
      v.box(6, 4, 5, 8, 9, 6, scarf);
    }
  });
}

function arm(look: CustomerLook) {
  const top = PAL.add(look.top, 0.05);
  const skin = PAL.add(look.skin, 0.02);
  return cachedModel(`arm-${look.top}-${look.skin}`, FV, [1.5, 10, 1.5], (v: Vox) => {
    v.box(0, 2, 0, 3, 10, 3, top);
    v.box(0, 0, 0, 3, 2, 3, skin);
  });
}

function leg(look: CustomerLook) {
  const bottom = PAL.add(look.bottom, 0.05);
  return cachedModel(`leg-${look.bottom}`, FV, [1.5, 13, 2], (v: Vox) => {
    v.box(0, 2, 0, 3, 13, 4, bottom);
    v.box(0, 0, 0, 3, 2, 5, shoe);
  });
}

let shadowMat: THREE.MeshBasicMaterial | null = null;
let shadowGeo: THREE.CircleGeometry | null = null;

/** Chunky voxel humanoid. Origin at the feet, facing +Z. */
export class Figure {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly head = new THREE.Group();
  private phase = Math.random() * 10;
  pose: Pose = 'stand';

  constructor(look: CustomerLook) {
    this.legL.add(modelGroup(leg(look)));
    this.legR.add(modelGroup(leg(look)));
    this.legL.position.set(-0.1, HIP, 0);
    this.legR.position.set(0.1, HIP, 0);
    const t = modelGroup(torso(look));
    t.position.y = HIP;
    this.armL.add(modelGroup(arm(look)));
    this.armR.add(modelGroup(arm(look)));
    this.armL.position.set(-0.3, SHOULDER, 0);
    this.armR.position.set(0.3, SHOULDER, 0);
    this.head.add(modelGroup(head(look)));
    this.head.position.set(0, NECK, 0);
    this.body.add(this.legL, this.legR, t, this.armL, this.armR, this.head);
    this.root.add(this.body);
    shadowMat ??= new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
    shadowGeo ??= new THREE.CircleGeometry(0.3, 12);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    this.root.add(shadow);
    this.root.scale.setScalar(look.height);
  }

  setPose(p: Pose): void {
    this.pose = p;
  }

  update(dt: number, seatHeight: number, legAngle = -Math.PI / 2): void {
    this.phase += dt;
    const t = this.phase;
    this.legL.rotation.x = this.legR.rotation.x = 0;
    this.armL.rotation.x = this.armR.rotation.x = 0;
    this.armL.rotation.z = this.armR.rotation.z = 0;
    this.body.position.y = 0;
    this.head.rotation.set(0, 0, 0);
    switch (this.pose) {
      case 'walk': {
        const swing = Math.sin(t * 8) * 0.55;
        this.legL.rotation.x = swing;
        this.legR.rotation.x = -swing;
        this.armL.rotation.x = -swing * 0.8;
        this.armR.rotation.x = swing * 0.8;
        this.body.position.y = Math.abs(Math.cos(t * 8)) * 0.035;
        this.head.rotation.z = Math.sin(t * 4) * 0.04;
        break;
      }
      case 'stand':
        this.head.rotation.x = Math.sin(t * 0.8) * 0.03;
        break;
      case 'sit':
      case 'eat': {
        const scale = this.root.scale.y || 1;
        this.body.position.y = seatHeight / scale - HIP;
        this.legL.rotation.x = this.legR.rotation.x = legAngle;
        this.armL.rotation.x = this.armR.rotation.x = -0.55;
        if (this.pose === 'eat') {
          const bite = Math.max(0, Math.sin(t * 3.2));
          this.armR.rotation.x = -1.2 - bite * 0.6;
          this.head.rotation.x = 0.12 + bite * 0.08;
        } else {
          this.head.rotation.x = Math.sin(t * 0.6) * 0.05;
          this.head.rotation.y = Math.sin(t * 0.37) * 0.25;
        }
        break;
      }
    }
  }
}
