import * as THREE from 'three';
import type { ItemVisual } from '../data/types';
import { boxMesh } from './geometry';
import { mat } from './materials';

const C = {
  cup: mat(0x6d7a5a),
  tea: mat(0x9cbf5a, { roughness: 0.3 }),
  plate: mat(0xefe9dc, { roughness: 0.5 }),
  plateDirty: mat(0xc8c0b0, { roughness: 0.6 }),
  bean: mat(0x6fae3e),
  beanDark: mat(0x4f8a2c),
  bowl: mat(0x2b2f3a, { roughness: 0.5 }),
  rice: mat(0xfbf8ee),
  salmon: mat(0xf08a4a, { emissive: 0x401000, emissiveIntensity: 0.4 }),
  salmonStripe: mat(0xfbd2b0),
  geta: mat(0x8a5a32),
  scrap: mat(0x8a6a4a),
};

const builders: Record<ItemVisual, () => THREE.Group> = {
  teaCup: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.085, 8).translate(0, 0.0425, 0), C.cup));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.005, 8).translate(0, 0.078, 0), C.tea));
    return g;
  },
  edamame: () => {
    const g = new THREE.Group();
    g.add(boxMesh(C.plate, 0.2, 0.025, 0.14, 0, 0.0125, 0));
    const pods: [number, number, number][] = [
      [-0.05, 0.035, -0.02],
      [0.0, 0.04, 0.03],
      [0.05, 0.035, -0.01],
      [-0.02, 0.05, 0.0],
      [0.03, 0.055, 0.02],
      [-0.06, 0.04, 0.035],
    ];
    pods.forEach(([x, y, z], i) => {
      const pod = boxMesh(i % 2 ? C.bean : C.beanDark, 0.07, 0.022, 0.028, x, y, z);
      pod.rotation.y = i * 0.9;
      g.add(pod);
    });
    return g;
  },
  riceBowl: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.06, 8).translate(0, 0.03, 0), C.bowl));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.05, 0), C.rice));
    return g;
  },
  nigiriSalmon: () => {
    const g = new THREE.Group();
    g.add(boxMesh(C.geta, 0.22, 0.025, 0.12, 0, 0.0125, 0));
    for (const x of [-0.05, 0.05]) {
      g.add(boxMesh(C.rice, 0.075, 0.035, 0.045, x, 0.043, 0));
      g.add(boxMesh(C.salmon, 0.088, 0.018, 0.055, x, 0.069, 0));
      g.add(boxMesh(C.salmonStripe, 0.088, 0.004, 0.008, x, 0.079, -0.01));
      g.add(boxMesh(C.salmonStripe, 0.088, 0.004, 0.008, x, 0.079, 0.012));
    }
    return g;
  },
  dirtyDishes: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const p = boxMesh(C.plateDirty, 0.2 - i * 0.02, 0.02, 0.16 - i * 0.02, (i % 2) * 0.01, 0.01 + i * 0.022, 0);
      p.rotation.y = i * 0.3;
      g.add(p);
    }
    g.add(boxMesh(C.scrap, 0.04, 0.01, 0.03, 0.02, 0.072, 0.01));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.075, 8).translate(0.07, 0.1, 0.02), C.cup));
    return g;
  },
};

export function makeItemMesh(visual: ItemVisual): THREE.Group {
  const g = builders[visual]();
  g.userData.visual = visual;
  return g;
}

export function disposeGroup(obj: THREE.Object3D): void {
  obj.removeFromParent();
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
