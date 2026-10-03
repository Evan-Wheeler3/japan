import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { C } from './palette';
import { meshGrid, Vox } from './vox';

describe('voxel mesher', () => {
  it('emits 6 faces for a lone voxel and culls shared faces', () => {
    const one = new Vox().box(0, 0, 0, 1, 1, 1, C.stone);
    expect(meshGrid(one.toDense(), 1).faces).toBe(6);
    const two = new Vox().box(0, 0, 0, 2, 1, 1, C.stone);
    expect(meshGrid(two.toDense(), 1).faces).toBe(10);
  });

  it('winds every triangle to face along its stored normal', () => {
    const m = meshGrid(new Vox().box(0, 0, 0, 1, 1, 1, C.stone).toDense(), 1).solid!;
    const pos = m.attributes.position;
    const nor = m.attributes.normal;
    const idx = m.index!;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i));
      b.fromBufferAttribute(pos, idx.getX(i + 1));
      c.fromBufferAttribute(pos, idx.getX(i + 2));
      const face = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
      const stored = new THREE.Vector3().fromBufferAttribute(nor, idx.getX(i));
      expect(face.dot(stored)).toBeCloseTo(1);
    }
  });

  it('darkens vertices tucked into a corner (ambient occlusion)', () => {
    // floor with a wall on one edge: floor vertices touching the wall get darker
    const v = new Vox().box(0, 0, 0, 3, 1, 3, C.stone).box(0, 1, 0, 1, 3, 3, C.stone);
    const m = meshGrid(v.toDense(), 1).solid!;
    const pos = m.attributes.position;
    const col = m.attributes.color;
    let nearWall = 1;
    let open = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) !== 1 || m.attributes.normal.getY(i) !== 1) continue;
      if (pos.getX(i) === 1) nearWall = Math.min(nearWall, col.getX(i));
      if (pos.getX(i) === 3) open = Math.max(open, col.getX(i));
    }
    expect(nearWall).toBeLessThan(open);
  });

  it('routes glowing palette entries to a separate geometry', () => {
    const m = meshGrid(new Vox().box(0, 0, 0, 1, 1, 1, C.lanternPaper).box(1, 0, 0, 2, 1, 1, C.stone).toDense(), 1);
    expect(m.glow).not.toBeNull();
    expect(m.solid).not.toBeNull();
  });
});
