import * as THREE from 'three';

/** Global voxel palette. Index 0 is "empty". Colors are stored linear for vertex colors. */
export class Palette {
  readonly rgb: number[] = [0, 0, 0];
  readonly jitter: number[] = [0];
  readonly glow: number[] = [0];
  private readonly lookup = new Map<string, number>();

  add(hex: number, jitter = 0.05, glow = 0): number {
    const key = `${hex}|${jitter}|${glow}`;
    const hit = this.lookup.get(key);
    if (hit !== undefined) return hit;
    const i = this.jitter.length;
    if (i > 255) throw new Error('Voxel palette full');
    const c = new THREE.Color(hex);
    this.rgb.push(c.r, c.g, c.b);
    this.jitter.push(jitter);
    this.glow.push(glow);
    this.lookup.set(key, i);
    return i;
  }
}

export const PAL = new Palette();

/** Named palette entries shared by every voxel model. */
export const C = {
  // woods
  beam: PAL.add(0x2a170c, 0.05),
  darkWood: PAL.add(0x3d2515, 0.06),
  darkWood2: PAL.add(0x34200f, 0.06),
  midWood: PAL.add(0x5e3a20, 0.06),
  midWood2: PAL.add(0x6c4426, 0.06),
  lightWood: PAL.add(0xa8774a, 0.05),
  hinoki: PAL.add(0xd2a874, 0.04),
  hinoki2: PAL.add(0xc69a64, 0.04),
  floorA: PAL.add(0x6e4428, 0.05),
  floorB: PAL.add(0x7c4e2d, 0.05),
  floorC: PAL.add(0x5e3920, 0.05),
  extWood: PAL.add(0x3a2618, 0.07),
  extWood2: PAL.add(0x2f1e13, 0.07),
  deck: PAL.add(0x7a5a40, 0.08),
  deck2: PAL.add(0x6a4c34, 0.08),
  // walls & stone
  plaster: PAL.add(0xd8c098, 0.035),
  plaster2: PAL.add(0xc9ad80, 0.035),
  extPlaster: PAL.add(0xcbb796, 0.05),
  tile: PAL.add(0xe9e3d3, 0.02),
  tile2: PAL.add(0xe0d9c7, 0.02),
  stone: PAL.add(0x6b6d73, 0.08),
  stoneL: PAL.add(0x8c8e94, 0.07),
  stoneD: PAL.add(0x4c4e55, 0.08),
  roof: PAL.add(0x30353e, 0.05),
  roof2: PAL.add(0x262a32, 0.05),
  snow: PAL.add(0xf0f4fb, 0.025),
  snow2: PAL.add(0xe2eaf6, 0.025),
  ice: PAL.add(0xbfdcef, 0.04),
  // fabric & paper
  paper: PAL.add(0xf3e6c8, 0.03),
  cream: PAL.add(0xefe4cc, 0.03),
  red: PAL.add(0xb3302a, 0.05),
  redDark: PAL.add(0x8a2420, 0.05),
  indigo: PAL.add(0x26365c, 0.05),
  indigo2: PAL.add(0x1e2b4a, 0.05),
  mustard: PAL.add(0xc99a3a, 0.05),
  white: PAL.add(0xf4efe6, 0.02),
  black: PAL.add(0x17120f, 0.03),
  straw: PAL.add(0xd8c08a, 0.06),
  rope: PAL.add(0x6a5030, 0.06),
  // plants
  leaf: PAL.add(0x3f6b3a, 0.1),
  leaf2: PAL.add(0x4f8246, 0.1),
  leafDark: PAL.add(0x2c4f2c, 0.1),
  bamboo: PAL.add(0x8aa04a, 0.06),
  pot: PAL.add(0x8a5a3c, 0.06),
  potBlue: PAL.add(0x3a5a8a, 0.05),
  soil: PAL.add(0x3a2a1e, 0.08),
  // kitchen & food
  steel: PAL.add(0xa8adb5, 0.03),
  steelD: PAL.add(0x6a7078, 0.03),
  iron: PAL.add(0x2c2c30, 0.04),
  ceramic: PAL.add(0xe9e1d0, 0.03),
  ceramicBlue: PAL.add(0x3d5f90, 0.04),
  teacup: PAL.add(0x6d7a5a, 0.04),
  tea: PAL.add(0xa8cf62, 0.03),
  rice: PAL.add(0xfbf8ee, 0.02),
  salmon: PAL.add(0xf08a4a, 0.04),
  salmonL: PAL.add(0xfbd2b0, 0.03),
  nori: PAL.add(0x1b2a1a, 0.05),
  edamame: PAL.add(0x6fae3e, 0.08),
  edamame2: PAL.add(0x4f8a2c, 0.08),
  wasabi: PAL.add(0x8ab84a, 0.04),
  ginger: PAL.add(0xf2b8b0, 0.04),
  soy: PAL.add(0x1a100c, 0.03),
  bottleGreen: PAL.add(0x2f4a30, 0.04),
  bottleBrown: PAL.add(0x4a2a18, 0.04),
  gold: PAL.add(0xe0b040, 0.04),
  // light sources (rendered unlit; glow > 1 feeds bloom)
  lanternPaper: PAL.add(0xffc684, 0.04, 0.95),
  lanternRed: PAL.add(0xff5a38, 0.04, 1.1),
  ember: PAL.add(0xff6a20, 0.15, 2.2),
  candle: PAL.add(0xffc070, 0.05, 2.0),
  windowWarm: PAL.add(0xffb060, 0.04, 1.3),
  indicator: PAL.add(0xffffff, 0, 1.5),
};
