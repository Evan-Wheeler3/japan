import { C, PAL } from './voxel/palette';
import { cachedModel, type VoxMesh } from './voxel/vox';

/** Fine voxel size for small props (≈3cm). */
export const F = 1 / 32;

const ribPaper = PAL.add(0xe0985a, 0.04, 0.7);
const ribRed = PAL.add(0xc83a28, 0.04, 0.9);
const labelRed = PAL.add(0xc8302a, 0.03);
const flower = PAL.add(0xe86a8a, 0.06);
const flower2 = PAL.add(0xf4d26a, 0.06);
const skinCat = PAL.add(0xf6f1e6, 0.02);

/** Chochin paper lantern; origin at the top of the cord. */
export function lantern(kind: 'paper' | 'red', cord = 10, r0 = 5, h = 11): VoxMesh {
  return cachedModel(`lantern-${kind}-${cord}-${r0}-${h}`, F, [0, 0, 0], (v) => {
    const body = kind === 'paper' ? C.lanternPaper : C.lanternRed;
    const rib = kind === 'paper' ? ribPaper : ribRed;
    const top = -cord;
    v.box(0, top, 0, 1, 0, 1, C.black);
    v.cyl(0.5, 0.5, r0 * 0.6, top - 2, top, C.black);
    for (let y = 0; y < h; y++) {
      const r = r0 * (0.8 + 0.2 * Math.sin((Math.PI * (y + 0.5)) / h));
      v.cyl(0.5, 0.5, r, top - 2 - y - 1, top - 2 - y, y % 3 === 1 ? rib : body);
    }
    v.cyl(0.5, 0.5, r0 * 0.6, top - 2 - h - 2, top - 2 - h, C.black);
  });
}

export function sakeBottle(variant: number): VoxMesh {
  return cachedModel(`bottle-${variant}`, F, [1.5, 0, 1.5], (v) => {
    const glass = variant % 2 ? C.bottleBrown : C.bottleGreen;
    v.box(0, 0, 0, 3, 7, 3, glass);
    v.box(1, 7, 1, 2, 10, 2, glass);
    v.box(1, 10, 1, 2, 11, 2, variant % 3 === 0 ? C.gold : C.red);
    v.box(0, 2, 2, 3, 5, 3, C.white);
    v.set(1, 3, 2, labelRed);
  });
}

export function jar(variant: number): VoxMesh {
  return cachedModel(`jar-${variant}`, F, [2.5, 0, 2.5], (v) => {
    const body = [C.ceramic, C.ceramicBlue, C.pot][variant % 3];
    v.cyl(2.5, 2.5, 2.6, 0, 5, body);
    v.cyl(2.5, 2.5, 1.8, 5, 6, C.darkWood);
    v.box(2, 6, 2, 3, 7, 3, C.darkWood);
  });
}

export function bowlStack(): VoxMesh {
  return cachedModel('bowls', F, [3, 0, 3], (v) => {
    for (let i = 0; i < 3; i++) {
      v.cyl(3, 3, 2, i * 2, i * 2 + 1, i % 2 ? C.ceramicBlue : C.ceramic);
      v.cyl(3, 3, 3, i * 2 + 1, i * 2 + 2, i % 2 ? C.ceramicBlue : C.ceramic);
    }
  });
}

export function daruma(): VoxMesh {
  return cachedModel('daruma', F, [3.5, 0, 3.5], (v) => {
    v.sphere(3.5, 3.5, 3.5, 3.6, C.red);
    v.box(2, 3, 6, 6, 6, 7, C.white);
    v.set(2, 4, 7, C.black);
    v.set(5, 4, 7, C.black);
    v.box(1, 1, 6, 6, 2, 7, C.gold);
  });
}

export function manekiNeko(): VoxMesh {
  return cachedModel('neko', F, [2.5, 0, 2], (v) => {
    v.box(0, 0, 0, 5, 4, 4, skinCat);
    v.box(0, 4, 0, 5, 8, 4, skinCat);
    v.set(0, 8, 1, skinCat);
    v.set(4, 8, 1, skinCat);
    v.box(4, 6, 3, 5, 10, 4, skinCat);
    v.box(0, 4, 0, 5, 5, 4, C.red);
    v.set(2, 3, 4, C.gold);
    v.set(1, 6, 4, C.black);
    v.set(3, 6, 4, C.black);
    v.set(2, 5, 4, flower);
  });
}

export function pottedPlant(variant: number, scale = 1): VoxMesh {
  return cachedModel(`plant-${variant}-${scale}`, F, [5 * scale, 0, 5 * scale], (v) => {
    const s = scale;
    v.cyl(5 * s, 5 * s, 3.5 * s, 0, Math.round(6 * s), variant % 2 ? C.potBlue : C.pot);
    v.cyl(5 * s, 5 * s, 3 * s, Math.round(6 * s) - 1, Math.round(6 * s), C.soil);
    if (variant % 3 === 2) {
      for (const [x, z, hh] of [
        [4, 4, 22],
        [6, 5, 18],
        [5, 7, 25],
      ])
        v.box(Math.round(x * s), Math.round(6 * s), Math.round(z * s), Math.round(x * s) + 1, Math.round((6 + hh) * s), Math.round(z * s) + 1, C.bamboo);
      v.sphere(5 * s, 26 * s, 5 * s, 3 * s, C.leaf2);
      v.sphere(6 * s, 22 * s, 6 * s, 2.5 * s, C.leaf);
    } else {
      v.sphere(5 * s, 10 * s, 5 * s, 4.5 * s, (x, y, z) => ((x + y + z) % 3 === 0 ? C.leaf2 : (x * 7 + z) % 5 === 0 ? C.leafDark : C.leaf));
      v.sphere(5 * s, 14 * s, 5 * s, 3 * s, C.leaf2);
      if (variant % 3 === 1) v.set(Math.round(4 * s), Math.round(15 * s), Math.round(7 * s), flower);
    }
  });
}

export function soyBottle(): VoxMesh {
  return cachedModel('soy', F, [1, 0, 1], (v) => {
    v.box(0, 0, 0, 2, 3, 2, C.soy);
    v.box(0, 3, 0, 2, 4, 2, C.red);
  });
}

export function chopstickCup(): VoxMesh {
  return cachedModel('chopsticks', F, [1, 0, 1], (v) => {
    v.box(0, 0, 0, 2, 3, 2, C.darkWood);
    v.box(0, 3, 0, 1, 6, 1, C.hinoki);
    v.box(1, 3, 1, 2, 5, 2, C.hinoki2);
  });
}

export function flowerVase(): VoxMesh {
  return cachedModel('vase', F, [1, 0, 1], (v) => {
    v.box(0, 0, 0, 2, 4, 2, C.ceramicBlue);
    v.box(0, 4, 0, 1, 7, 1, C.leaf);
    v.set(0, 7, 0, flower);
    v.set(1, 6, 1, flower2);
    v.box(1, 4, 1, 2, 6, 2, C.leaf);
  });
}

export function candle(): VoxMesh {
  return cachedModel('candle', F, [1, 0, 1], (v) => {
    v.box(0, 0, 0, 2, 1, 2, C.ceramic);
    v.box(0, 1, 0, 2, 3, 2, C.cream);
    v.set(0, 3, 0, C.candle);
  });
}

export function wallClock(): VoxMesh {
  return cachedModel('clock', F, [4.5, 4.5, 0], (v) => {
    for (let x = 0; x < 9; x++)
      for (let y = 0; y < 9; y++) {
        const dx = x + 0.5 - 4.5;
        const dy = y + 0.5 - 4.5;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 4.6 * 4.6) continue;
        v.set(x, y, 0, C.darkWood);
        v.set(x, y, 1, d2 < 3.6 * 3.6 ? C.cream : C.darkWood);
      }
    v.box(4, 4, 2, 5, 8, 3, C.black);
    v.box(4, 4, 2, 7, 5, 3, C.black);
  });
}

export function umbrellaStand(): VoxMesh {
  return cachedModel('umbrellas', F, [3, 0, 3], (v) => {
    v.box(0, 0, 0, 6, 8, 6, C.midWood);
    v.box(1, 1, 1, 5, 8, 5, 0);
    v.box(1, 1, 1, 5, 2, 5, C.darkWood);
    v.box(1, 2, 1, 3, 26, 3, C.red);
    v.box(2, 26, 2, 3, 29, 3, C.darkWood);
    v.box(3, 2, 3, 5, 24, 5, C.indigo);
    v.box(3, 24, 4, 4, 27, 5, C.darkWood);
  });
}

export function kamidana(): VoxMesh {
  return cachedModel('kamidana', F, [8, 0, 0], (v) => {
    v.box(0, 0, 0, 16, 1, 6, C.hinoki);
    v.box(4, 1, 1, 12, 7, 5, C.hinoki2);
    v.box(3, 7, 0, 13, 8, 6, C.darkWood);
    v.box(4, 8, 1, 12, 9, 5, C.darkWood);
    v.box(7, 2, 5, 9, 6, 6, C.gold);
    v.box(0, 1, 2, 1, 4, 3, C.leaf);
    v.box(15, 1, 2, 16, 4, 3, C.leaf);
    v.box(2, 9, 5, 14, 10, 6, C.rope);
    for (const x of [4, 8, 12]) v.box(x, 6, 5, x + 1, 9, 6, C.white);
  });
}

/** Straw-wrapped sake barrel (komodaru). */
export function sakeBarrel(snow: boolean): VoxMesh {
  return cachedModel(`barrel-${snow}`, F, [7, 0, 7], (v) => {
    v.cyl(7, 7, 7, 0, 14, (x, y, z) => ((x + z + y) % 4 === 0 ? C.cream : C.straw));
    for (const y of [2, 11]) v.cyl(7, 7, 7.3, y, y + 1, C.rope);
    v.cyl(7, 7, 6, 14, 15, C.lightWood);
    v.box(4, 4, 13, 10, 10, 14, C.red);
    v.box(6, 6, 14, 8, 8, 15, C.white);
    if (snow) v.cyl(7, 7, 5.5, 15, 16, C.snow);
  });
}

export function crate(snow: boolean): VoxMesh {
  return cachedModel(`crate-${snow}`, F, [8, 0, 6], (v) => {
    v.box(0, 0, 0, 16, 10, 12, (x, y, z) => (x === 0 || x === 15 || z === 0 || z === 11 || y === 0 ? (y % 3 === 0 ? C.darkWood : C.midWood) : C.midWood2));
    v.box(1, 9, 1, 15, 10, 11, 0);
    v.box(2, 8, 2, 7, 10, 10, C.edamame);
    v.box(8, 8, 2, 14, 11, 6, C.salmon);
    v.box(8, 8, 6, 14, 10, 10, C.cream);
    if (snow) v.box(0, 10, 0, 16, 11, 12, (x, _y, z) => ((x * 3 + z) % 7 === 0 ? 0 : C.snow));
  });
}

export function snowman(): VoxMesh {
  return cachedModel('snowman', F, [8, 0, 8], (v) => {
    v.sphere(8, 7, 8, 7.5, C.snow);
    v.sphere(8, 18, 8, 5.5, C.snow);
    v.sphere(8, 26, 8, 4, C.snow);
    v.set(6, 27, 11, C.black);
    v.set(9, 27, 11, C.black);
    v.box(7, 25, 11, 8, 26, 14, C.mustard);
    v.cyl(8, 8, 5.2, 21, 23, C.red);
    v.box(9, 14, 12, 12, 21, 13, C.red);
    v.cyl(8, 8, 4.5, 30, 31, C.black);
    v.cyl(8, 8, 3, 31, 35, C.black);
    v.set(8, 18, 13, C.black);
    v.set(8, 15, 13, C.black);
    v.box(0, 18, 7, 3, 19, 8, C.darkWood);
    v.box(13, 19, 8, 16, 20, 9, C.darkWood);
  });
}

export function bench(): VoxMesh {
  return cachedModel('bench', F, [24, 0, 6], (v) => {
    v.box(0, 12, 0, 48, 14, 12, C.deck);
    for (const x of [2, 44]) v.box(x, 0, 2, x + 2, 12, 10, C.darkWood);
    v.box(0, 14, 0, 48, 15, 12, (x, _y, z) => ((x + z * 3) % 9 === 0 ? 0 : C.snow));
  });
}

export function radio(): VoxMesh {
  return cachedModel('radio', F, [4, 0, 2], (v) => {
    v.box(0, 0, 0, 8, 5, 4, C.midWood);
    v.box(1, 1, 4, 4, 4, 5, C.cream);
    v.set(5, 3, 4, C.gold);
    v.set(6, 3, 4, C.gold);
    v.box(1, 5, 1, 7, 6, 2, C.black);
  });
}

export function teapot(): VoxMesh {
  return cachedModel('teapot', F, [3, 0, 3], (v) => {
    v.cyl(3, 3, 3, 0, 4, C.iron);
    v.cyl(3, 3, 2, 4, 5, C.iron);
    v.box(6, 2, 2, 8, 3, 3, C.iron);
    v.box(0, 5, 2, 6, 6, 3, C.darkWood);
  });
}

/** Bar stool for the sushi counter, 1/16 m voxels; seat top at 0.75 m. */
export function stool(cushion: number): VoxMesh {
  return cachedModel(`stool-${cushion}`, 1 / 16, [3.5, 0, 3.5], (v) => {
    v.box(3, 0, 3, 4, 10, 4, C.darkWood);
    v.cyl(3.5, 3.5, 2.6, 0, 1, C.darkWood);
    v.box(1, 5, 3, 6, 6, 4, C.beam);
    v.cyl(3.5, 3.5, 3.6, 10, 11, C.darkWood);
    v.cyl(3.5, 3.5, 3.3, 11, 12, cushion);
  });
}

/** Thin futon mattress with a quilt and pillow, laid on the floor (~2 m × 1 m). */
export function futon(): VoxMesh {
  return cachedModel('futon', 1 / 16, [8, 0, 16], (v) => {
    v.box(0, 0, 0, 16, 2, 32, C.cream);
    v.box(0, 2, 8, 16, 3, 32, (x, _y, z) => ((x + z) % 6 === 0 ? C.indigo2 : C.indigo));
    v.box(4, 2, 1, 12, 4, 6, C.white);
  });
}

/** Paper floor lamp (andon) — the apartment's only light at first. */
export function andon(): VoxMesh {
  return cachedModel('andon', F, [5, 0, 5], (v) => {
    for (const [x, z] of [
      [0, 0],
      [9, 0],
      [0, 9],
      [9, 9],
    ])
      v.box(x, 0, z, x + 1, 22, z + 1, C.darkWood);
    v.box(1, 4, 1, 9, 20, 9, C.lanternPaper);
    v.box(0, 20, 0, 10, 22, 10, C.darkWood);
    v.box(1, 21, 1, 9, 22, 9, 0);
  });
}

/** Round low table (chabudai) with a tea cup. */
export function chabudai(): VoxMesh {
  return cachedModel('chabudai', 1 / 16, [6, 0, 6], (v) => {
    v.cyl(6, 6, 6.2, 5, 6, (x, _y, z) => ((x + z) % 4 === 0 ? C.midWood2 : C.midWood));
    for (const [x, z] of [
      [3, 3],
      [8, 3],
      [3, 8],
      [8, 8],
    ])
      v.box(x, 0, z, x + 1, 5, z + 1, C.darkWood);
    v.box(5, 6, 5, 7, 8, 7, C.teacup);
  });
}

export function cardboardBox(variant: number): VoxMesh {
  return cachedModel(`box-${variant}`, 1 / 16, [4, 0, 3], (v) => {
    const c = variant % 2 ? PAL.add(0xb08a5a, 0.06) : PAL.add(0xa07a4c, 0.06);
    v.box(0, 0, 0, 8, 6, 6, c);
    v.box(3, 5, 0, 5, 6, 6, PAL.add(0xd8c8a0, 0.03));
  });
}

/** Colored kaiten plate that rides the belt under each dish. */
export function beltPlate(color: number): VoxMesh {
  return cachedModel(`belt-plate-${color}`, 1 / 48, [6, 0, 6], (v) => {
    const rim = PAL.add(color, 0.03);
    v.cyl(6, 6, 6.2, 0, 1, (x, _y, z) => {
      const d = Math.hypot(x + 0.5 - 6, z + 0.5 - 6);
      return d > 4.8 ? rim : C.ceramic;
    });
  });
}

/** Wooden drying rack frame for clean plates. */
export function dryingRack(): VoxMesh {
  return cachedModel('drying-rack', F, [0, 0, 0], (v) => {
    v.box(-12, 0, -9, 12, 1, 9, C.lightWood);
    for (const x of [-12, 11]) for (const z of [-9, 8]) v.box(x, 0, z, x + 1, 10, z + 1, C.lightWood);
    for (let x = -10; x <= 10; x += 3) v.box(x, 1, -9, x + 1, 6, -8, C.hinoki2);
    v.box(-12, 9, -9, 12, 10, -8, C.lightWood);
    v.box(-12, 9, 8, 12, 10, 9, C.lightWood);
  });
}

/** Tea set and condiments that line the middle of the sushi bar. */
export function counterCondiments(variant: number): VoxMesh {
  return cachedModel(`condiments-${variant}`, F, [4, 0, 2], (v) => {
    v.box(0, 0, 0, 3, 4, 3, C.soy);
    v.box(0, 4, 0, 3, 5, 3, C.red);
    v.cyl(6, 1.5, 1.6, 0, 4, variant % 2 ? C.ceramicBlue : C.ceramic);
    v.box(5, 4, 1, 7, 5, 2, C.darkWood);
    for (let i = 0; i < 3; i++) v.cyl(1.5 + i * 0.2, 4.5, 1.6, i * 2, i * 2 + 2, C.teacup);
  });
}

export function plateStack(n: number): VoxMesh {
  return cachedModel(`plate-stack-${n}`, 1 / 48, [5, 0, 5], (v) => {
    for (let i = 0; i < n; i++) v.cyl(5, 5, 4.8, i, i + 1, (x, _y, z) => (Math.hypot(x + 0.5 - 5, z + 0.5 - 5) > 3.8 ? C.ceramicBlue : C.ceramic));
  });
}
