import * as THREE from 'three';
import { boxMesh, StaticBatcher, type Rect } from './geometry';
import {
  AISLE_X,
  COUNTER,
  CRATE,
  DOOR,
  ROOM,
  SEAT_HEIGHT,
  SEAT_OFFSET,
  TABLE_SIZE,
  TABLES,
  WINDOW_EAST,
  WINDOW_Y,
  WINDOWS_NORTH,
} from './layout';
import { mat, plasterTexture, roofTileTexture, shojiTexture, signTexture, tileTexture, woodTexture } from './materials';

export interface RestaurantBuild {
  group: THREE.Group;
  blockers: THREE.Object3D[];
  colliders: Rect[];
  interiorLights: THREE.PointLight[];
  lanternMaterial: THREE.MeshStandardMaterial;
  menuBoard: THREE.Mesh;
}

const WAINSCOT = 1.0;
export const LANTERN_GLOW = 0.95;

export function buildRestaurant(): RestaurantBuild {
  const b = new StaticBatcher();
  const root = new THREE.Group();
  root.name = 'restaurant';

  const M = {
    floor: mat(0xffffff, { map: woodTexture(0x6e4529, 11), key: 'floor' }),
    wainscot: mat(0xffffff, { map: woodTexture(0x3e2717, 12, 4), key: 'wainscot' }),
    plaster: mat(0xffffff, { map: plasterTexture(0xd8c29a), key: 'plaster' }),
    extWood: mat(0xffffff, { map: woodTexture(0x34231a, 13, 4), key: 'extWood' }),
    beam: mat(0x2a1a10),
    darkWood: mat(0x3a2414),
    counterTop: mat(0xffffff, { map: woodTexture(0xa2713f, 14), key: 'counterTop' }),
    counterBody: mat(0xffffff, { map: woodTexture(0x6a4026, 15, 4), key: 'counterBody' }),
    tile: mat(0xffffff, { map: tileTexture(0xe9e3d3), key: 'tile' }),
    tableWood: mat(0xffffff, { map: woodTexture(0x7d4c2a, 16), key: 'tableWood' }),
    stone: mat(0x5f6168),
    stoneLight: mat(0x8a8c92),
    snow: mat(0xf2f6ff, { roughness: 0.95 }),
    roof: mat(0xffffff, { map: roofTileTexture(), key: 'roof' }),
    shoji: mat(0xffffff, { map: shojiTexture(), key: 'shoji', emissive: 0xffd9a0, emissiveIntensity: 0.25 }),
    plant: mat(0x3f6b3a),
    pot: mat(0x8a5a3c),
    red: mat(0xb8322a),
    cream: mat(0xf2e8d0),
  };

  const colliders: Rect[] = [];
  const rect = (minX: number, maxX: number, minZ: number, maxZ: number) => colliders.push({ minX, maxX, minZ, maxZ });

  // ---------- Floor, foundation, ceiling ----------
  b.box(M.floor, ROOM.minX, -0.1, ROOM.minZ, ROOM.maxX, 0, ROOM.maxZ);
  b.box(M.stone, ROOM.minX - 0.35, -1.2, ROOM.minZ - 0.35, ROOM.maxX + 0.35, -0.05, ROOM.maxZ + 0.35, 0.5);
  b.box(M.darkWood, ROOM.minX, ROOM.height, ROOM.minZ, ROOM.maxX, ROOM.height + 0.12, ROOM.maxZ);
  for (let x = ROOM.minX + 1.2; x < ROOM.maxX; x += 1.5) {
    b.box(M.beam, x - 0.09, ROOM.height - 0.2, ROOM.minZ, x + 0.09, ROOM.height, ROOM.maxZ);
  }
  b.box(M.beam, ROOM.minX, ROOM.height - 0.26, -0.1, ROOM.maxX, ROOM.height - 0.2, 0.1);

  // ---------- Walls (split into dark wainscot + plaster) ----------
  const piece = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
    if (y1 <= y0) return;
    const split = Math.min(Math.max(WAINSCOT, y0), y1);
    if (split > y0) b.box(M.wainscot, x0, y0, z0, x1, split, z1);
    if (y1 > split) b.box(M.plaster, x0, split, z0, x1, y1, z1);
  };

  type Opening = { a: number; b: number; y0: number; y1: number };
  const wall = (axis: 'x' | 'z', fixed0: number, fixed1: number, from: number, to: number, openings: Opening[]) => {
    const sorted = [...openings].sort((p, q) => p.a - q.a);
    let cursor = from;
    const span = (a: number, c: number, y0: number, y1: number) => {
      if (c - a <= 0.001) return;
      if (axis === 'x') piece(a, c, y0, y1, fixed0, fixed1);
      else piece(fixed0, fixed1, y0, y1, a, c);
    };
    for (const o of sorted) {
      span(cursor, o.a, 0, ROOM.height);
      span(o.a, o.b, 0, o.y0);
      span(o.a, o.b, o.y1, ROOM.height);
      cursor = o.b;
    }
    span(cursor, to, 0, ROOM.height);
  };

  const W = ROOM.wall;
  const northWin = WINDOWS_NORTH.map((w) => ({ a: w.a, b: w.b, y0: WINDOW_Y.bottom, y1: WINDOW_Y.top }));
  wall('x', ROOM.minZ - W, ROOM.minZ, ROOM.minX - W, ROOM.maxX + W, northWin);
  wall('x', ROOM.maxZ, ROOM.maxZ + W, ROOM.minX - W, ROOM.maxX + W, [{ a: DOOR.minX, b: DOOR.maxX, y0: 0, y1: DOOR.height }]);
  wall('z', ROOM.maxX, ROOM.maxX + W, ROOM.minZ, ROOM.maxZ, [{ a: WINDOW_EAST.a, b: WINDOW_EAST.b, y0: WINDOW_Y.bottom, y1: WINDOW_Y.top }]);
  wall('z', ROOM.minX - W, ROOM.minX, ROOM.minZ, ROOM.maxZ, []);

  rect(ROOM.minX - W, ROOM.maxX + W, ROOM.minZ - W, ROOM.minZ);
  rect(ROOM.minX - W, ROOM.maxX + W, ROOM.maxZ, ROOM.maxZ + W);
  rect(ROOM.maxX, ROOM.maxX + W, ROOM.minZ, ROOM.maxZ);
  rect(ROOM.minX - W, ROOM.minX, ROOM.minZ, ROOM.maxZ);

  // Window frames, sills and mullions
  const frame = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) => b.box(M.beam, x0, y0, z0, x1, y1, z1);
  for (const w of WINDOWS_NORTH) {
    const z0 = ROOM.minZ - W - 0.02;
    const z1 = ROOM.minZ + 0.02;
    frame(w.a, w.b, z0, z1 + 0.12, WINDOW_Y.bottom - 0.06, WINDOW_Y.bottom);
    frame(w.a, w.b, z0, z1, WINDOW_Y.top, WINDOW_Y.top + 0.06);
    frame(w.a, w.a + 0.06, z0, z1, WINDOW_Y.bottom, WINDOW_Y.top);
    frame(w.b - 0.06, w.b, z0, z1, WINDOW_Y.bottom, WINDOW_Y.top);
    const panes = Math.round((w.b - w.a) / 0.75);
    for (let i = 1; i < panes; i++) {
      const x = w.a + ((w.b - w.a) * i) / panes;
      frame(x - 0.025, x + 0.025, ROOM.minZ - W / 2 - 0.02, ROOM.minZ - W / 2 + 0.02, WINDOW_Y.bottom, WINDOW_Y.top);
    }
    frame(w.a, w.b, ROOM.minZ - W / 2 - 0.02, ROOM.minZ - W / 2 + 0.02, 2.05, 2.09);
  }
  {
    const w = WINDOW_EAST;
    const x0 = ROOM.maxX - 0.02;
    const x1 = ROOM.maxX + W + 0.02;
    b.box(M.beam, x0 - 0.12, WINDOW_Y.bottom - 0.06, w.a, x1, WINDOW_Y.bottom, w.b);
    b.box(M.beam, x0, WINDOW_Y.top, w.a, x1, WINDOW_Y.top + 0.06, w.b);
    for (let i = 0; i <= 4; i++) {
      const z = w.a + ((w.b - w.a) * i) / 4;
      b.box(M.beam, ROOM.maxX + W / 2 - 0.02, WINDOW_Y.bottom, z - 0.025, ROOM.maxX + W / 2 + 0.02, WINDOW_Y.top, z + 0.025);
    }
  }

  // ---------- Kitchen counter ----------
  b.box(M.counterBody, COUNTER.minX, 0, COUNTER.minZ, COUNTER.maxX, COUNTER.top - 0.05, COUNTER.maxZ);
  b.box(M.counterTop, COUNTER.minX, COUNTER.top - 0.05, COUNTER.minZ - 0.03, COUNTER.maxX + 0.05, COUNTER.top, COUNTER.maxZ + 0.03);
  b.box(M.tile, ROOM.minX, COUNTER.top, COUNTER.minZ, ROOM.minX + 0.02, 1.75, COUNTER.maxZ, 0.5);
  b.box(M.darkWood, ROOM.minX, 2.0, COUNTER.minZ, ROOM.minX + 0.3, 2.04, COUNTER.maxZ);
  rect(COUNTER.minX, COUNTER.maxX + 0.05, COUNTER.minZ - 0.03, COUNTER.maxZ + 0.03);
  const jarColors = [0xc9b48a, 0x7b4a2a, 0xe6dccb, 0x3f5c4a, 0xa33a2a, 0xd8c08a];
  for (let i = 0; i < 14; i++) {
    const z = COUNTER.minZ + 0.25 + i * 0.5;
    if (Math.abs(z) < 0.35) continue;
    const h = 0.14 + (i % 3) * 0.05;
    b.box(mat(jarColors[i % jarColors.length]), ROOM.minX + 0.06, 2.04, z - 0.07, ROOM.minX + 0.2, 2.04 + h, z + 0.07);
  }
  buildManekiNeko(root, ROOM.minX + 0.14, 2.04, 0);

  // Delivery crate
  b.box(M.counterBody, CRATE.x - 0.4, 0, CRATE.z - 0.32, CRATE.x + 0.4, 0.5, CRATE.z + 0.32, 0.5);
  rect(CRATE.x - 0.42, CRATE.x + 0.42, CRATE.z - 0.34, CRATE.z + 0.34);

  // ---------- Tables & chairs ----------
  for (const t of TABLES) {
    const { w, d, h } = TABLE_SIZE;
    b.box(M.tableWood, t.x - w / 2, h - 0.05, t.z - d / 2, t.x + w / 2, h, t.z + d / 2);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const lx = t.x + sx * (w / 2 - 0.08);
        const lz = t.z + sz * (d / 2 - 0.08);
        b.box(M.darkWood, lx - 0.04, 0, lz - 0.04, lx + 0.04, h - 0.05, lz + 0.04);
      }
    rect(t.x - w / 2, t.x + w / 2, t.z - d / 2, t.z + d / 2);
    for (const side of [-1, 1]) {
      const cz = t.z + side * SEAT_OFFSET;
      b.box(M.darkWood, t.x - 0.21, SEAT_HEIGHT - 0.06, cz - 0.21, t.x + 0.21, SEAT_HEIGHT, cz + 0.21);
      const backZ = cz + side * 0.19;
      b.box(M.darkWood, t.x - 0.21, SEAT_HEIGHT, backZ - 0.03, t.x + 0.21, SEAT_HEIGHT + 0.5, backZ + 0.03);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) b.box(M.beam, t.x + sx * 0.17 - 0.025, 0, cz + sz * 0.17 - 0.025, t.x + sx * 0.17 + 0.025, SEAT_HEIGHT - 0.06, cz + sz * 0.17 + 0.025);
      rect(t.x - 0.22, t.x + 0.22, backZ - 0.04, backZ + 0.04);
    }
    // soy sauce + chopstick cup
    b.box(mat(0x1a1210), t.x + w / 2 - 0.16, h, t.z - 0.05, t.x + w / 2 - 0.1, h + 0.12, t.z + 0.01);
    b.box(M.red, t.x + w / 2 - 0.155, h + 0.12, t.z - 0.045, t.x + w / 2 - 0.105, h + 0.15, t.z + 0.005);
    b.box(mat(0x5b3a22), t.x + w / 2 - 0.16, h, t.z + 0.06, t.x + w / 2 - 0.09, h + 0.1, t.z + 0.13);
  }

  // ---------- Decor ----------
  // shoji panels flanking the east window
  b.box(M.shoji, ROOM.maxX - 0.03, 0.3, 0.2, ROOM.maxX, 2.5, 3.8, 1);
  b.box(M.beam, ROOM.maxX - 0.06, 0.25, 0.15, ROOM.maxX, 0.3, 3.85);
  b.box(M.beam, ROOM.maxX - 0.06, 2.5, 0.15, ROOM.maxX, 2.55, 3.85);
  // plants
  for (const [px, pz] of [
    [5.55, 4.05],
    [5.55, -4.05],
    [-0.5, 4.1],
  ]) {
    b.box(M.pot, px - 0.2, 0, pz - 0.2, px + 0.2, 0.35, pz + 0.2);
    b.box(M.plant, px - 0.28, 0.35, pz - 0.28, px + 0.28, 0.8, pz + 0.28);
    b.box(mat(0x4f8246), px - 0.18, 0.8, pz - 0.18, px + 0.18, 1.1, pz + 0.18);
    rect(px - 0.25, px + 0.25, pz - 0.25, pz + 0.25);
  }
  addWallArt(root);

  // ---------- Exterior: roof, deck, path ----------
  buildRoof(b, M.roof, M.snow, M.extWood);
  buildDeck(b, M.extWood, M.beam, M.snow, M.stone);
  for (let i = 0; i < 6; i++) {
    const z = 5.2 + i * 0.9;
    const x = 4.2 + (i % 2 === 0 ? -0.15 : 0.15);
    b.box(M.stoneLight, x - 0.35, -0.04, z - 0.3, x + 0.35, 0.05, z + 0.3, 0.5);
  }
  // stone lantern (toro)
  {
    const x = 6.4;
    const z = 6.6;
    b.box(M.stoneLight, x - 0.3, 0, z - 0.3, x + 0.3, 0.15, z + 0.3);
    b.box(M.stoneLight, x - 0.1, 0.15, z - 0.1, x + 0.1, 0.8, z + 0.1);
    b.box(M.stoneLight, x - 0.25, 0.8, z - 0.25, x + 0.25, 0.9, z + 0.25);
    b.box(mat(0xffc070, { emissive: 0xffa040, emissiveIntensity: 2.2 }), x - 0.16, 0.9, z - 0.16, x + 0.16, 1.15, z + 0.16);
    b.box(M.stoneLight, x - 0.35, 1.15, z - 0.35, x + 0.35, 1.27, z + 0.35);
    b.box(M.snow, x - 0.33, 1.27, z - 0.33, x + 0.33, 1.33, z + 0.33);
  }

  const staticGroup = b.build('restaurant-static');
  root.add(staticGroup);
  const blockers: THREE.Object3D[] = [...staticGroup.children];

  // ---------- Glass ----------
  const glass = mat(0xa8c8e8, { opacity: 0.08, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide });
  for (const w of WINDOWS_NORTH) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w.b - w.a, WINDOW_Y.top - WINDOW_Y.bottom), glass);
    pane.position.set((w.a + w.b) / 2, (WINDOW_Y.top + WINDOW_Y.bottom) / 2, ROOM.minZ - W / 2);
    root.add(pane);
  }
  {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW_EAST.b - WINDOW_EAST.a, WINDOW_Y.top - WINDOW_Y.bottom), glass);
    pane.rotation.y = Math.PI / 2;
    pane.position.set(ROOM.maxX + W / 2, (WINDOW_Y.top + WINDOW_Y.bottom) / 2, (WINDOW_EAST.a + WINDOW_EAST.b) / 2);
    root.add(pane);
  }

  // ---------- Lanterns & lights ----------
  const lanternMaterial = new THREE.MeshStandardMaterial({ color: 0xffd59a, emissive: 0xff9a48, emissiveIntensity: LANTERN_GLOW, flatShading: true });
  const interiorLights: THREE.PointLight[] = [];
  const lanternSpots = [...TABLES.map((t) => [t.x, 2.3, t.z] as const), [-4.4, 2.45, -1.6] as const, [-4.4, 2.45, 2.0] as const];
  for (const [x, y, z] of lanternSpots) {
    root.add(paperLantern(lanternMaterial, x, y, z));
    const light = new THREE.PointLight(0xffa860, 5.5, 9, 1.7);
    light.position.set(x, y - 0.1, z);
    root.add(light);
    interiorLights.push(light);
  }
  const fill = new THREE.PointLight(0xff9a50, 3.5, 8, 1.6);
  fill.position.set(AISLE_X, 2.5, 3.6);
  root.add(fill);
  interiorLights.push(fill);

  // Exterior entrance lanterns, sign and noren
  const redLantern = new THREE.MeshStandardMaterial({ color: 0xd8402e, emissive: 0xe0452a, emissiveIntensity: 1.1, flatShading: true });
  for (const x of [DOOR.minX - 0.35, DOOR.maxX + 0.35]) root.add(paperLantern(redLantern, x, 2.35, ROOM.maxZ + W + 0.35, 0.18, 0.42));
  const doorLight = new THREE.PointLight(0xff8a50, 6, 10, 1.6);
  doorLight.position.set(4.2, 2.4, 5.6);
  root.add(doorLight);

  const sushiSign = signTexture({
    width: 64,
    height: 192,
    bg: '#f4ead2',
    fg: '#b8261c',
    border: '#3a2414',
    lines: [
      { text: '寿', size: 44, y: 58 },
      { text: '司', size: 44, y: 128 },
    ],
  });
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 1.25, 0.08),
    [M.beam, M.beam, M.beam, M.beam, new THREE.MeshStandardMaterial({ map: sushiSign, emissive: 0xffe0b0, emissiveMap: sushiSign, emissiveIntensity: 0.9 }), M.beam],
  );
  signBoard.position.set(DOOR.maxX + 0.95, 1.55, ROOM.maxZ + W + 0.06);
  root.add(signBoard);

  const norenTex = signTexture({
    width: 96,
    height: 64,
    bg: '#1f2c4a',
    fg: '#f1ead8',
    lines: [{ text: 'すし', size: 30, y: 36 }],
  });
  // Text must read correctly from both sides, so the inner face gets a mirrored copy of the texture.
  const norenInner = norenTex.clone();
  norenInner.wrapS = THREE.RepeatWrapping;
  norenInner.repeat.x = -1;
  const cloth = mat(0x1f2c4a, { roughness: 1 });
  const noren = new THREE.Mesh(new THREE.BoxGeometry(DOOR.maxX - DOOR.minX, 0.6, 0.01), [
    cloth,
    cloth,
    cloth,
    cloth,
    new THREE.MeshStandardMaterial({ map: norenTex, roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: norenInner, roughness: 1 }),
  ]);
  noren.position.set((DOOR.minX + DOOR.maxX) / 2, DOOR.height - 0.3, ROOM.maxZ + W + 0.02);
  root.add(noren);

  // ---------- Menu board (texture refreshed when menu changes) ----------
  const menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.85), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  menuBoard.rotation.y = Math.PI / 2;
  menuBoard.position.set(ROOM.minX + 0.03, 2.62, 0);
  root.add(menuBoard);

  return { group: root, blockers, colliders, interiorLights, lanternMaterial, menuBoard };
}

export function menuBoardTexture(lines: { name: string; price: number }[]): THREE.Texture {
  const rows = lines.slice(0, 6);
  return signTexture({
    width: 448,
    height: 136,
    bg: '#2a1a10',
    fg: '#f4e6c4',
    border: '#8a5a2c',
    lines: [
      { text: 'お品書き  MENU', size: 20, y: 20, color: '#f0b45a' },
      ...rows.map((r, i) => ({
        text: r.name,
        size: 18,
        y: 50 + (i % 3) * 28,
        align: 'left' as const,
        x: i < 3 ? 22 : 236,
      })),
      ...rows.map((r, i) => ({
        text: `¥${r.price}`,
        size: 18,
        y: 50 + (i % 3) * 28,
        align: 'right' as const,
        x: i < 3 ? 212 : 426,
        color: '#f0b45a',
      })),
    ],
  });
}

function paperLantern(material: THREE.Material, x: number, y: number, z: number, r = 0.2, h = 0.38): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), material);
  g.add(body);
  const capMat = mat(0x22150c);
  g.add(boxMesh(capMat, r * 1.3, 0.05, r * 1.3, 0, h / 2 + 0.02, 0));
  g.add(boxMesh(capMat, r * 1.3, 0.05, r * 1.3, 0, -h / 2 - 0.02, 0));
  const cord = boxMesh(capMat, 0.02, 0.6, 0.02, 0, h / 2 + 0.32, 0);
  g.add(cord);
  g.position.set(x, y, z);
  return g;
}

function buildRoof(b: StaticBatcher, roofMat: THREE.Material, snowMat: THREE.Material, wallMat: THREE.Material) {
  const ridgeY = 4.75;
  const eaveY = 3.05;
  const eaveZ = ROOM.maxZ + 1.0;
  const run = eaveZ;
  const rise = ridgeY - eaveY;
  const len = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  const width = ROOM.maxX - ROOM.minX + 1.6;
  for (const side of [-1, 1]) {
    const m = new THREE.Matrix4()
      .makeTranslation(0, (ridgeY + eaveY) / 2, (side * run) / 2)
      .multiply(new THREE.Matrix4().makeRotationX(side * angle));
    const slab = new THREE.BoxGeometry(width, 0.22, len);
    b.add(roofMat, slab, m);
    const snow = new THREE.BoxGeometry(width - 0.2, 0.16, len - 0.25);
    snow.translate(0, 0.18, -side * 0.05);
    b.add(snowMat, snow, m);
  }
  b.box(snowMat, -width / 2, ridgeY + 0.05, -0.25, width / 2, ridgeY + 0.3, 0.25);
  // gable ends
  const shape = new THREE.Shape();
  shape.moveTo(ROOM.minZ - ROOM.wall, ROOM.height);
  shape.lineTo(ROOM.maxZ + ROOM.wall, ROOM.height);
  shape.lineTo(0, ridgeY - 0.1);
  shape.closePath();
  for (const x of [ROOM.minX - ROOM.wall, ROOM.maxX]) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: ROOM.wall, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    g.translate(x, 0, 0);
    b.add(wallMat, g);
  }
}

function buildDeck(b: StaticBatcher, wood: THREE.Material, beam: THREE.Material, snow: THREE.Material, stone: THREE.Material) {
  const x0 = -5.6;
  const x1 = 5.6;
  const z0 = -8.2;
  const z1 = ROOM.minZ - ROOM.wall;
  b.box(wood, x0, -0.14, z0, x1, 0, z1);
  for (let x = x0 + 0.2; x <= x1; x += 2.2) for (const z of [z0 + 0.2, (z0 + z1) / 2]) b.box(stone, x - 0.15, -4, z - 0.15, x + 0.15, -0.14, z + 0.15);
  for (let x = x0; x <= x1 + 0.01; x += 1.4) {
    b.box(beam, x - 0.05, 0, z0, x + 0.05, 0.95, z0 + 0.1);
    b.box(snow, x - 0.07, 0.95, z0 - 0.01, x + 0.07, 1.02, z0 + 0.11);
  }
  b.box(beam, x0, 0.88, z0, x1, 0.95, z0 + 0.1);
  b.box(beam, x0, 0.45, z0, x1, 0.5, z0 + 0.08);
  b.box(snow, x0, 0.95, z0 - 0.01, x1, 0.99, z0 + 0.11);
  for (const x of [x0, x1]) {
    b.box(beam, x - 0.05, 0.88, z0, x + 0.05, 0.95, z1);
    b.box(snow, x - 0.06, 0.95, z0, x + 0.06, 0.99, z1);
  }
  // drifted snow on the deck
  b.box(snow, x0, 0, z0 + 0.1, x1, 0.05, z0 + 1.2);
  b.box(snow, x0, 0, z0, x0 + 1.1, 0.08, z1);
  b.box(snow, x1 - 0.8, 0, z0, x1, 0.06, z1);
}

function buildManekiNeko(root: THREE.Group, x: number, y: number, z: number) {
  const g = new THREE.Group();
  const white = mat(0xf6f1e6);
  g.add(boxMesh(white, 0.14, 0.14, 0.12, 0, 0.07, 0));
  g.add(boxMesh(white, 0.13, 0.11, 0.11, 0, 0.19, 0));
  g.add(boxMesh(white, 0.03, 0.04, 0.03, -0.045, 0.265, 0));
  g.add(boxMesh(white, 0.03, 0.04, 0.03, 0.045, 0.265, 0));
  const paw = boxMesh(white, 0.035, 0.08, 0.035, 0.07, 0.2, 0.03);
  paw.name = 'paw';
  g.add(paw);
  g.add(boxMesh(mat(0xc0302a), 0.135, 0.02, 0.115, 0, 0.135, 0));
  g.add(boxMesh(mat(0xe0b040), 0.03, 0.03, 0.01, 0, 0.115, 0.065));
  const eye = mat(0x111111);
  g.add(boxMesh(eye, 0.02, 0.01, 0.005, -0.03, 0.2, 0.056));
  g.add(boxMesh(eye, 0.02, 0.01, 0.005, 0.03, 0.2, 0.056));
  g.rotation.y = Math.PI / 2;
  g.position.set(x, y, z);
  g.name = 'maneki-neko';
  root.add(g);
}

function addWallArt(root: THREE.Group) {
  // wave print on the south wall
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#efe2c0';
  ctx.fillRect(0, 0, 48, 32);
  ctx.fillStyle = '#e9d0a0';
  ctx.fillRect(0, 0, 48, 14);
  ctx.fillStyle = '#5d6f8c';
  ctx.beginPath();
  ctx.moveTo(30, 18);
  ctx.lineTo(36, 9);
  ctx.lineTo(42, 18);
  ctx.fill();
  ctx.fillStyle = '#fbf7ef';
  ctx.fillRect(34, 9, 4, 3);
  ctx.fillStyle = '#1f3d6b';
  for (let x = 0; x < 48; x++) ctx.fillRect(x, 20 + Math.round(Math.sin(x / 3) * 2), 1, 12);
  ctx.fillStyle = '#2c5590';
  ctx.beginPath();
  ctx.arc(10, 30, 16, Math.PI, Math.PI * 1.85);
  ctx.lineTo(10, 30);
  ctx.fill();
  ctx.fillStyle = '#fbf7ef';
  for (let i = 0; i < 9; i++) ctx.fillRect(14 + i * 1.5, 14 + (i % 3), 2, 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const print = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  print.position.set(-1.6, 1.85, ROOM.maxZ - 0.03);
  print.rotation.y = Math.PI;
  root.add(print);
  const frame = boxMesh(mat(0x2a1a10), 1.32, 0.92, 0.03, -1.6, 1.85, ROOM.maxZ - 0.015);
  root.add(frame);

  // hanging scroll on the east wall, between shoji panels
  const scroll = signTexture({
    width: 48,
    height: 160,
    bg: '#efe6d0',
    fg: '#2a1a10',
    border: '#7a5a3a',
    lines: [
      { text: '一', size: 26, y: 38 },
      { text: '期', size: 26, y: 72 },
      { text: '一', size: 26, y: 106 },
      { text: '会', size: 26, y: 136 },
    ],
  });
  const kakejiku = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.4), new THREE.MeshStandardMaterial({ map: scroll, roughness: 1 }));
  kakejiku.rotation.y = -Math.PI / 2;
  kakejiku.position.set(ROOM.maxX - 0.05, 1.55, -4.0);
  root.add(kakejiku);

  // red paper lantern by the door, inside
  const lanternTex = signTexture({ width: 48, height: 64, bg: '#c8352a', fg: '#1a0e08', lines: [{ text: '寿司', size: 18, y: 32 }] });
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.5, 10),
    new THREE.MeshStandardMaterial({ map: lanternTex, emissive: 0xff5a3a, emissiveMap: lanternTex, emissiveIntensity: 1.4 }),
  );
  lantern.position.set(2.4, 2.45, ROOM.maxZ - 0.35);
  root.add(lantern);
}
