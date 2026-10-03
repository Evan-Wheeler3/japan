import * as THREE from 'three';
import { PAL, type Palette } from './palette';

const D = 4096;
const OFF = 2048;
const key = (x: number, y: number, z: number) => ((x + OFF) * D + (y + OFF)) * D + (z + OFF);

export type Fill = number | ((x: number, y: number, z: number) => number);

/** Sparse voxel builder in integer voxel coordinates. */
export class Vox {
  readonly map = new Map<number, number>();

  set(x: number, y: number, z: number, p: number): void {
    if (p === 0) this.map.delete(key(x, y, z));
    else this.map.set(key(x, y, z), p);
  }

  get(x: number, y: number, z: number): number {
    return this.map.get(key(x, y, z)) ?? 0;
  }

  /** Fills [x0,x1) × [y0,y1) × [z0,z1). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, p: Fill): this {
    for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z < Math.max(z0, z1); z++) this.set(x, y, z, typeof p === 'number' ? p : p(x, y, z));
    return this;
  }

  /** Vertical cylinder centred on (cx, cz) in voxel units (centres may be fractional). */
  cyl(cx: number, cz: number, r: number, y0: number, y1: number, p: Fill): this {
    const r2 = r * r;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
        const dx = x + 0.5 - cx;
        const dz = z + 0.5 - cz;
        if (dx * dx + dz * dz > r2) continue;
        for (let y = y0; y < y1; y++) this.set(x, y, z, typeof p === 'number' ? p : p(x, y, z));
      }
    return this;
  }

  sphere(cx: number, cy: number, cz: number, r: number, p: Fill): this {
    const r2 = r * r;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const dz = z + 0.5 - cz;
          if (dx * dx + dy * dy + dz * dz <= r2) this.set(x, y, z, typeof p === 'number' ? p : p(x, y, z));
        }
    return this;
  }

  /** Replaces existing voxels only (paint). */
  paint(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, p: Fill): this {
    for (let x = x0; x < x1; x++)
      for (let y = y0; y < y1; y++)
        for (let z = z0; z < z1; z++) if (this.get(x, y, z)) this.set(x, y, z, typeof p === 'number' ? p : p(x, y, z));
    return this;
  }

  toDense(pad = 1): DenseGrid {
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    const decoded: number[] = [];
    for (const [k, v] of this.map) {
      const z = (k % D) - OFF;
      const y = (Math.floor(k / D) % D) - OFF;
      const x = Math.floor(k / (D * D)) - OFF;
      decoded.push(x, y, z, v);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    if (decoded.length === 0) return new DenseGrid(1, 1, 1, [0, 0, 0]);
    const g = new DenseGrid(maxX - minX + 1 + pad * 2, maxY - minY + 1 + pad * 2, maxZ - minZ + 1 + pad * 2, [minX - pad, minY - pad, minZ - pad]);
    for (let i = 0; i < decoded.length; i += 4) g.set(decoded[i] - g.min[0], decoded[i + 1] - g.min[1], decoded[i + 2] - g.min[2], decoded[i + 3]);
    return g;
  }
}

export class DenseGrid {
  readonly data: Uint8Array;

  constructor(
    readonly sx: number,
    readonly sy: number,
    readonly sz: number,
    /** World voxel coordinate of local (0,0,0). */
    readonly min: [number, number, number],
  ) {
    this.data = new Uint8Array(sx * sy * sz);
  }

  get(x: number, y: number, z: number): number {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return 0;
    return this.data[(x * this.sy + y) * this.sz + z];
  }

  set(x: number, y: number, z: number, v: number): void {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return;
    this.data[(x * this.sy + y) * this.sz + z] = v;
  }
}

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const AO_LEVEL = [0.46, 0.66, 0.84, 1];
const FACE_SHADE = [0.9, 0.9, 1, 0.78, 0.95, 0.95]; // +x, -x, +y, -y, +z, -z

interface FaceDef {
  d: number;
  s: number;
  u: number;
  v: number;
  corners: [number, number][];
  shade: number;
}

const FACES: FaceDef[] = [];
for (let d = 0; d < 3; d++)
  for (const s of [1, -1]) {
    const corners: [number, number][] =
      s > 0
        ? [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ]
        : [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
          ];
    FACES.push({ d, s, u: (d + 1) % 3, v: (d + 2) % 3, corners, shade: FACE_SHADE[d * 2 + (s > 0 ? 0 : 1)] });
  }

class Buffers {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  geometry(): THREE.BufferGeometry | null {
    if (this.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export interface VoxMesh {
  solid: THREE.BufferGeometry | null;
  glow: THREE.BufferGeometry | null;
  faces: number;
}

/**
 * Builds one quad per exposed voxel face with per-voxel colour jitter and
 * per-vertex ambient occlusion. Glowing palette entries go to a separate geometry.
 * `size` is the voxel edge in metres; `pivot` is in voxel units and maps to the model origin.
 */
export function meshGrid(grid: DenseGrid, size: number, pivot: [number, number, number] = [0, 0, 0], pal: Palette = PAL): VoxMesh {
  const solid = new Buffers();
  const glow = new Buffers();
  const p = [0, 0, 0];
  const n = [0, 0, 0];
  const ox = (grid.min[0] - pivot[0]) * size;
  const oy = (grid.min[1] - pivot[1]) * size;
  const oz = (grid.min[2] - pivot[2]) * size;
  let faces = 0;

  for (let x = 0; x < grid.sx; x++)
    for (let y = 0; y < grid.sy; y++)
      for (let z = 0; z < grid.sz; z++) {
        const v = grid.data[(x * grid.sy + y) * grid.sz + z];
        if (v === 0) continue;
        const wx = x + grid.min[0];
        const wy = y + grid.min[1];
        const wz = z + grid.min[2];
        const j = 1 + (hash3(wx, wy, wz) - 0.5) * 2 * pal.jitter[v];
        const g = pal.glow[v];
        const out = g > 0 ? glow : solid;
        const base = [pal.rgb[v * 3] * j, pal.rgb[v * 3 + 1] * j, pal.rgb[v * 3 + 2] * j];
        for (const f of FACES) {
          p[0] = x;
          p[1] = y;
          p[2] = z;
          p[f.d] += f.s;
          if (grid.get(p[0], p[1], p[2]) !== 0) continue;
          faces++;
          n[0] = n[1] = n[2] = 0;
          n[f.d] = f.s;
          const start = out.pos.length / 3;
          const ao: number[] = [];
          for (const [cu, cv] of f.corners) {
            const du = cu ? 1 : -1;
            const dv = cv ? 1 : -1;
            const s1 = sample(grid, p, f.u, du, f.v, 0);
            const s2 = sample(grid, p, f.u, 0, f.v, dv);
            const cc = sample(grid, p, f.u, du, f.v, dv);
            const a = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
            ao.push(a);
            const c = [x, y, z];
            if (f.s > 0) c[f.d] += 1;
            c[f.u] += cu;
            c[f.v] += cv;
            out.pos.push(ox + c[0] * size, oy + c[1] * size, oz + c[2] * size);
            out.nor.push(n[0], n[1], n[2]);
            const shade = g > 0 ? g * (0.75 + 0.25 * AO_LEVEL[a]) : f.shade * AO_LEVEL[a];
            out.col.push(base[0] * shade, base[1] * shade, base[2] * shade);
          }
          if (ao[0] + ao[2] > ao[1] + ao[3]) out.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
          else out.idx.push(start, start + 1, start + 3, start + 1, start + 2, start + 3);
        }
      }
  return { solid: solid.geometry(), glow: glow.geometry(), faces };
}

function sample(grid: DenseGrid, p: number[], u: number, du: number, v: number, dv: number): number {
  const q = [p[0], p[1], p[2]];
  q[u] += du;
  q[v] += dv;
  return grid.get(q[0], q[1], q[2]) !== 0 ? 1 : 0;
}

export const solidMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });

/**
 * Point lights cast no shadows, so lights inside the restaurant would shine through the roof and walls.
 * Voxel surfaces outside the interior box ignore lights flagged as interior (flags follow scene order).
 */
export const lightMask = {
  pointInterior: { value: new Array<number>(16).fill(0) },
  pointCeiling: { value: new Array<number>(16).fill(1e5) },
  interiorMin: { value: new THREE.Vector3() },
  interiorMax: { value: new THREE.Vector3() },
};

function applyInteriorLightMask(m: THREE.Material): void {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lightMask);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosI;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 wpI = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        wpI = instanceMatrix * wpI;
      #endif
      vWorldPosI = ( modelMatrix * wpI ).xyz;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec3 vWorldPosI;
      uniform float pointInterior[ 16 ];
      uniform float pointCeiling[ 16 ];
      uniform vec3 interiorMin;
      uniform vec3 interiorMax;
      float pointMask( const in int i ) {
        bool inside = all( greaterThanEqual( vWorldPosI, interiorMin ) ) && all( lessThanEqual( vWorldPosI, interiorMax ) );
        return ( ( pointInterior[ i ] > 0.5 && !inside ) || vWorldPosI.y > pointCeiling[ i ] ) ? 0.0 : 1.0;
      }`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        THREE.ShaderChunk.lights_fragment_begin.replace(
          'getPointLightInfo( pointLight, geometryPosition, directLight );',
          'getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tdirectLight.color *= pointMask( UNROLLED_LOOP_INDEX );',
        ),
      );
  };
  m.customProgramCacheKey = () => 'voxel-interior-mask';
}

applyInteriorLightMask(solidMaterial);

/**
 * Flags each point light (in scene traversal order, matching the renderer) as inside the box or not.
 * Outdoor lights below `eave` don't reach surfaces above it (the roof).
 */
export function updateLightMask(scene: THREE.Object3D, interior: THREE.Box3, eave: number): void {
  lightMask.interiorMin.value.copy(interior.min);
  lightMask.interiorMax.value.copy(interior.max);
  const flags = lightMask.pointInterior.value;
  const ceilings = lightMask.pointCeiling.value;
  flags.fill(0);
  ceilings.fill(1e5);
  let i = 0;
  const p = new THREE.Vector3();
  scene.traverseVisible((o) => {
    if (!(o instanceof THREE.PointLight)) return;
    if (i < flags.length) {
      const inside = interior.containsPoint(o.getWorldPosition(p));
      flags[i] = inside ? 1 : 0;
      if (!inside && p.y < eave) ceilings[i] = eave;
    }
    i++;
  });
}
export const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

/** Meshes a builder into a ready-to-add group (solid + glow meshes). */
export function voxGroup(vox: Vox, size: number, pivot: [number, number, number] = [0, 0, 0], glowMat: THREE.Material = glowMaterial): THREE.Group {
  const m = meshGrid(vox.toDense(), size, pivot);
  const g = new THREE.Group();
  if (m.solid) g.add(new THREE.Mesh(m.solid, solidMaterial));
  if (m.glow) g.add(new THREE.Mesh(m.glow, glowMat));
  return g;
}

/** Caches meshed models by key so repeated props share geometry. */
const modelCache = new Map<string, VoxMesh>();

export function cachedModel(id: string, size: number, pivot: [number, number, number], build: (v: Vox) => void): VoxMesh {
  let m = modelCache.get(id);
  if (!m) {
    const v = new Vox();
    build(v);
    m = meshGrid(v.toDense(), size, pivot);
    if (m.solid) m.solid.userData.shared = true;
    if (m.glow) m.glow.userData.shared = true;
    modelCache.set(id, m);
  }
  return m;
}

export function modelGroup(m: VoxMesh, glowMat: THREE.Material = glowMaterial): THREE.Group {
  const g = new THREE.Group();
  if (m.solid) g.add(new THREE.Mesh(m.solid, solidMaterial));
  if (m.glow) g.add(new THREE.Mesh(m.glow, glowMat));
  return g;
}

/** Merges many transformed copies of cached models into single static meshes. */
export class PropBatch {
  private readonly solids: THREE.BufferGeometry[] = [];
  private readonly glows: THREE.BufferGeometry[] = [];

  add(m: VoxMesh, x: number, y: number, z: number, rotY = 0, scale = 1): void {
    const mat = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(scale, scale, scale));
    if (m.solid) this.solids.push(m.solid.clone().applyMatrix4(mat));
    if (m.glow) this.glows.push(m.glow.clone().applyMatrix4(mat));
  }

  build(): THREE.Group {
    const g = new THREE.Group();
    const merge = (list: THREE.BufferGeometry[], material: THREE.Material) => {
      if (!list.length) return;
      const merged = mergeIndexed(list);
      g.add(new THREE.Mesh(merged, material));
      for (const l of list) l.dispose();
    };
    merge(this.solids, solidMaterial);
    merge(this.glows, glowMaterial);
    return g;
  }
}

function mergeIndexed(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let verts = 0;
  let idxCount = 0;
  for (const g of list) {
    verts += g.attributes.position.count;
    idxCount += g.index!.count;
  }
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3);
  const idx = verts > 65535 ? new Uint32Array(idxCount) : new Uint16Array(idxCount);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array as Float32Array, vo * 3);
    nor.set(g.attributes.normal.array as Float32Array, vo * 3);
    col.set(g.attributes.color.array as Float32Array, vo * 3);
    const src = g.index!.array;
    for (let i = 0; i < src.length; i++) idx[io + i] = src[i] + vo;
    vo += g.attributes.position.count;
    io += src.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
