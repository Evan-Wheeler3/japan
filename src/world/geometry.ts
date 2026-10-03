import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * BoxGeometry with UVs scaled to world size (1 texture repeat per `texel` metres),
 * so tiling textures line up across boxes of different sizes.
 */
export function worldBox(w: number, h: number, d: number, texel = 1): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const faceSize: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let face = 0; face < 6; face++) {
    const [su, sv] = faceSize[face];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, (uv.getX(i) * su) / texel, (uv.getY(i) * sv) / texel);
    }
  }
  return g;
}

/** Collects static boxes and merges them into one mesh per material to keep draw calls low. */
export class StaticBatcher {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(material: THREE.Material, geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4): void {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (matrix) g.applyMatrix4(matrix);
    const list = this.parts.get(material) ?? [];
    list.push(g);
    this.parts.set(material, list);
  }

  /** Axis-aligned box from min/max corners. */
  box(material: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, texel = 1) {
    const g = worldBox(x1 - x0, y1 - y0, z1 - z0, texel);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.add(material, g);
  }

  build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [material, geoms] of this.parts) {
      const merged = mergeGeometries(geoms, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      for (const g of geoms) g.dispose();
    }
    this.parts.clear();
    return group;
  }
}

/** Convenience for small dynamic props: a box mesh positioned by its centre. */
export function boxMesh(material: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(worldBox(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}
