import * as THREE from 'three';
import type { ItemVisual } from '../data/types';
import { C, PAL } from './voxel/palette';
import { cachedModel, modelGroup, type Vox, type VoxMesh } from './voxel/vox';

/** Food is modelled at ~2cm voxels so sushi reads as chunky little blocks. */
const IF = 1 / 48;
const plateDirty = PAL.add(0xc8c0b0, 0.04);
const crumbs = PAL.add(0x7a5a3a, 0.1);

const builders: Record<ItemVisual, [pivot: [number, number, number], build: (v: Vox) => void]> = {
  teaCup: [
    [2.5, 0, 2.5],
    (v) => {
      v.cyl(2.5, 2.5, 2.6, 0, 5, (_x, y) => (y === 1 ? C.ceramic : C.teacup));
      v.cyl(2.5, 2.5, 1.6, 4, 5, C.tea);
    },
  ],
  edamame: [
    [5, 0, 4],
    (v) => {
      v.box(0, 0, 0, 10, 1, 8, C.ceramic);
      v.box(1, 1, 1, 9, 1, 7, 0);
      const pods: [number, number, number, boolean][] = [
        [1, 1, 1, true],
        [5, 1, 2, true],
        [2, 1, 4, false],
        [6, 1, 5, false],
        [3, 2, 2, true],
        [4, 2, 4, false],
      ];
      for (const [x, y, z, alongX] of pods) {
        if (alongX) v.box(x, y, z, x + 3, y + 1, z + 1, (xx) => ((xx + z) % 2 ? C.edamame : C.edamame2));
        else v.box(x, y, z, x + 1, y + 1, z + 3, (_x, _y, zz) => ((zz + x) % 2 ? C.edamame : C.edamame2));
      }
    },
  ],
  riceBowl: [
    [3.5, 0, 3.5],
    (v) => {
      v.cyl(3.5, 3.5, 2.2, 0, 1, C.ceramicBlue);
      v.cyl(3.5, 3.5, 3.6, 1, 3, (x, y, z) => (y === 2 && (x + z) % 3 === 0 ? C.ceramic : C.ceramicBlue));
      v.cyl(3.5, 3.5, 3.0, 3, 4, C.rice);
      v.cyl(3.5, 3.5, 2.0, 4, 5, C.rice);
    },
  ],
  nigiriSalmon: [
    [6, 0, 3.5],
    (v) => {
      v.box(0, 1, 0, 12, 2, 7, C.lightWood);
      v.box(1, 0, 0, 2, 1, 7, C.midWood);
      v.box(10, 0, 0, 11, 1, 7, C.midWood);
      for (const x0 of [1, 6]) {
        v.box(x0, 2, 2, x0 + 4, 4, 5, C.rice);
        v.box(x0, 4, 1, x0 + 5, 5, 6, (x) => ((x - x0) % 2 === 1 ? C.salmonL : C.salmon));
      }
      v.set(11, 2, 1, C.wasabi);
      v.box(10, 2, 4, 12, 3, 6, C.ginger);
    },
  ],
  dirtyDishes: [
    [5, 0, 4],
    (v) => {
      for (let i = 0; i < 3; i++) v.box(i, i, i % 2, 10 - i, i + 1, 8 - (i % 2), plateDirty);
      v.set(4, 3, 3, crumbs);
      v.set(6, 3, 4, crumbs);
      v.cyl(9, 6, 2, 0, 4, C.teacup);
    },
  ],
};

export function itemModel(visual: ItemVisual): VoxMesh {
  const [pivot, build] = builders[visual];
  return cachedModel(`item-${visual}`, IF, pivot, build);
}

export function makeItemMesh(visual: ItemVisual): THREE.Group {
  const g = modelGroup(itemModel(visual));
  g.userData.visual = visual;
  return g;
}

/** Removes an object, disposing only geometry that isn't shared through the model cache. */
export function disposeGroup(obj: THREE.Object3D): void {
  obj.removeFromParent();
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.geometry.userData.shared) o.geometry.dispose();
  });
}
