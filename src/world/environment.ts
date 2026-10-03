import * as THREE from 'three';
import { Rng } from '../sim/rng';
import { BUILDING_BOUNDS } from './layout';
import { C } from './voxel/palette';
import { cachedModel, meshGrid, solidMaterial, Vox } from './voxel/vox';

const OCEAN_Y = -38;
const FUJI_POS = new THREE.Vector3(-260, OCEAN_Y, -1650);
const SKY_RADIUS = 3200;
const SUN_DISTANCE = 2700;

interface SkyKey {
  t: number;
  top: number;
  horizon: number;
  glow: number;
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  moon: number;
}

/** Sky palette over skyProgress (0 = night, 0.22 = first light, 1 = sunrise complete). */
const SKY_KEYS: SkyKey[] = [
  { t: 0, top: 0x03081a, horizon: 0x101c3a, glow: 0x101c3a, hemiSky: 0x2a3a66, hemiGround: 0x0a0d18, hemi: 0.6, moon: 0.7 },
  { t: 0.22, top: 0x081028, horizon: 0x2c2c4a, glow: 0x5a2a40, hemiSky: 0x2e3a60, hemiGround: 0x15141e, hemi: 0.55, moon: 0.35 },
  { t: 0.42, top: 0x121c44, horizon: 0x6a2a34, glow: 0xd8381e, hemiSky: 0x40446a, hemiGround: 0x22161c, hemi: 0.6, moon: 0.15 },
  { t: 0.62, top: 0x223c70, horizon: 0xc85a2e, glow: 0xff4a12, hemiSky: 0x6a6480, hemiGround: 0x3a2622, hemi: 0.7, moon: 0.05 },
  { t: 0.82, top: 0x34609a, horizon: 0xe8834a, glow: 0xff6a1e, hemiSky: 0x8a8aa4, hemiGround: 0x4a3830, hemi: 0.8, moon: 0 },
  { t: 1, top: 0x4a78b0, horizon: 0xf0a060, glow: 0xff8030, hemiSky: 0xa0a4ba, hemiGround: 0x5a4436, hemi: 0.85, moon: 0 },
];

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

function sampleSky(t: number) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].t < t) i++;
  const a = SKY_KEYS[i];
  const b = SKY_KEYS[i + 1];
  const f = THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1);
  const col = (ka: number, kb: number, out: THREE.Color) => out.set(ka).lerp(tmpB.set(kb), f);
  return {
    top: col(a.top, b.top, new THREE.Color()),
    horizon: col(a.horizon, b.horizon, new THREE.Color()),
    glow: col(a.glow, b.glow, new THREE.Color()),
    hemiSky: col(a.hemiSky, b.hemiSky, new THREE.Color()),
    hemiGround: col(a.hemiGround, b.hemiGround, new THREE.Color()),
    hemi: THREE.MathUtils.lerp(a.hemi, b.hemi, f),
    moon: THREE.MathUtils.lerp(a.moon, b.moon, f),
  };
}

/** Sun path: hidden below the horizon, emerges from behind Fuji's right flank, climbs up and to the right. */
export function sunDirection(skyT: number, out = new THREE.Vector3()): THREE.Vector3 {
  const f = THREE.MathUtils.clamp((skyT - 0.22) / 0.78, 0, 1);
  const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-5, 9, f));
  const fujiAz = Math.atan2(FUJI_POS.x, -FUJI_POS.z);
  const az = fujiAz + THREE.MathUtils.degToRad(THREE.MathUtils.lerp(4.2, 7.5, f));
  return out.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev));
}

export class Environment {
  readonly group = new THREE.Group();
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly starsMat: THREE.PointsMaterial;
  private readonly moon: THREE.Mesh;
  private readonly sun: THREE.Mesh;
  private readonly sunHalo: THREE.Mesh;
  private readonly sunMat: THREE.MeshBasicMaterial;
  private readonly haloMat: THREE.MeshBasicMaterial;
  readonly sunLight: THREE.DirectionalLight;
  readonly moonLight: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private readonly ocean: THREE.Mesh;
  private readonly oceanBase: Float32Array;
  private readonly snowMat: THREE.ShaderMaterial;
  private readonly fog: THREE.FogExp2;
  private readonly oceanMat: THREE.MeshStandardMaterial;
  private readonly clouds: Clouds;
  private readonly mist: Mist;
  private readonly sunDir = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.group.name = 'environment';
    this.fog = new THREE.FogExp2(0x101c3a, 0.00042);
    scene.fog = this.fog;

    // ---- Sky dome ----
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        glow: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, -1, 0) },
        glowStrength: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z = gl_Position.w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir; uniform float glowStrength;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 col = mix(horizon, top, pow(smoothstep(-0.02, 0.55, h), 0.7));
          float sunAmt = max(dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))), 0.0);
          float band = exp(-max(h, 0.0) * 9.0);
          col += glow * glowStrength * (pow(sunAmt, 6.0) * band * 1.2 + band * 0.25);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), this.skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.group.add(sky);

    // ---- Stars ----
    const rng = new Rng(99);
    const starPos: number[] = [];
    for (let i = 0; i < 900; i++) {
      const az = rng.range(0, Math.PI * 2);
      const el = Math.asin(rng.range(0.04, 1));
      const r = SKY_RADIUS * 0.95;
      starPos.push(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false });
    this.group.add(new THREE.Points(starGeo, this.starsMat));

    // ---- Moon ----
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(42, 12), new THREE.MeshBasicMaterial({ color: 0xb4bccf, fog: false, transparent: true }));
    this.moon.position.set(700, 520, -2500);
    this.moon.lookAt(0, 0, 0);
    this.group.add(this.moon);

    // ---- Sun (exaggerated disc + halo) ----
    this.sunMat = new THREE.MeshBasicMaterial({ color: 0xff3a10, fog: false, transparent: true });
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(185, 16), this.sunMat);
    this.haloMat = new THREE.MeshBasicMaterial({ color: 0xff6a20, fog: false, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sunHalo = new THREE.Mesh(new THREE.CircleGeometry(420, 16), this.haloMat);
    this.group.add(this.sunHalo, this.sun);

    // ---- Lights ----
    this.hemi = new THREE.HemisphereLight(0x223055, 0x0a0d18, 0.5);
    this.moonLight = new THREE.DirectionalLight(0x8aa4e0, 0.6);
    this.moonLight.position.set(700, 520, -2500);
    this.sunLight = new THREE.DirectionalLight(0xff7a3a, 0);
    this.group.add(this.hemi, this.moonLight, this.sunLight, this.sunLight.target);

    // ---- Distant mountains & Fuji ----
    this.group.add(buildFuji());
    this.group.add(buildRidges());

    // ---- Ocean ----
    const oceanGeo = new THREE.PlaneGeometry(4200, 3400, 70, 56);
    oceanGeo.rotateX(-Math.PI / 2);
    oceanGeo.translate(0, OCEAN_Y, -1500);
    this.oceanMat = new THREE.MeshStandardMaterial({ color: 0x0d2238, roughness: 0.92, metalness: 0, flatShading: true });
    this.ocean = new THREE.Mesh(oceanGeo, this.oceanMat);
    this.oceanBase = Float32Array.from(oceanGeo.attributes.position.array as Float32Array);
    this.group.add(this.ocean);

    // ---- Terrain & trees ----
    this.group.add(buildTerrain());
    this.group.add(buildTrees());

    // ---- Snowfall ----
    this.snowMat = buildSnowMaterial();
    this.group.add(buildSnow(this.snowMat));

    this.clouds = new Clouds();
    this.group.add(this.clouds.group);
    this.mist = new Mist();
    this.group.add(this.mist.group);

    scene.add(this.group);
  }

  update(time: number, skyT: number, snowIntensity: number, camera: THREE.Camera): void {
    const s = sampleSky(skyT);
    this.skyMat.uniforms.top.value.copy(s.top);
    this.skyMat.uniforms.horizon.value.copy(s.horizon);
    this.skyMat.uniforms.glow.value.copy(s.glow);
    const sunUp = THREE.MathUtils.smoothstep(skyT, 0.2, 0.55);
    this.skyMat.uniforms.glowStrength.value = sunUp;
    sunDirection(skyT, this.sunDir);
    this.skyMat.uniforms.sunDir.value.copy(this.sunDir);

    // Snowy haze: thick at night (more with heavier snow), lifting as the sun comes up.
    const haze = THREE.MathUtils.lerp(0.55 + snowIntensity * 0.45, 0.28, sunUp);
    this.fog.color.copy(s.horizon).lerp(tmpA.copy(s.top), 0.3).lerp(tmpB.set(0x5a6680), 0.22 * (1 - sunUp));
    this.fog.density = 0.0042 * haze;
    // Distant mountains are fog-exempt; fade them toward the haze colour by hand so Fuji stays a ghost.
    const far = THREE.MathUtils.lerp(0.72, 0.3, sunUp) * (0.8 + snowIntensity * 0.2);
    landMaterial.color.setScalar(1 - far);
    landMaterial.emissive.copy(this.fog.color).multiplyScalar(far);
    this.oceanMat.roughness = THREE.MathUtils.lerp(0.92, 0.5, sunUp);
    this.clouds.update(time, s, this.sunDir, sunUp, snowIntensity, camera);
    this.mist.update(time, this.fog.color, sunUp, snowIntensity, camera);

    this.starsMat.opacity = THREE.MathUtils.clamp(1 - skyT * 3.2, 0, 1) * (1 - snowIntensity * 0.6);
    (this.moon.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(1 - skyT * 2, 0, 1);

    this.hemi.color.copy(s.hemiSky);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemi;
    this.moonLight.intensity = s.moon;

    // Sun disc: deep red low on the horizon, warming to orange as it climbs
    const elevF = THREE.MathUtils.clamp((skyT - 0.22) / 0.78, 0, 1);
    this.sun.position.copy(this.sunDir).multiplyScalar(SUN_DISTANCE);
    this.sun.lookAt(0, 0, 0);
    this.sunHalo.position.copy(this.sunDir).multiplyScalar(SUN_DISTANCE + 10);
    this.sunHalo.lookAt(0, 0, 0);
    this.sunMat.color.setRGB(THREE.MathUtils.lerp(2.4, 2.0, elevF), THREE.MathUtils.lerp(0.22, 0.75, elevF * elevF), THREE.MathUtils.lerp(0.03, 0.18, elevF * elevF));
    this.sunMat.opacity = sunUp;
    this.haloMat.opacity = 0.18 * sunUp;
    this.haloMat.color.copy(s.glow);

    const lightUp = THREE.MathUtils.smoothstep(skyT, 0.38, 0.9);
    this.sunLight.position.copy(this.sunDir).multiplyScalar(500);
    this.sunLight.intensity = lightUp * 1.7;
    this.sunLight.color.setRGB(1, THREE.MathUtils.lerp(0.42, 0.72, lightUp), THREE.MathUtils.lerp(0.22, 0.5, lightUp));

    // Ocean: slow faceted swell
    const pos = this.ocean.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = this.oceanBase[i];
      const z = this.oceanBase[i + 2];
      arr[i + 1] = OCEAN_Y + Math.sin(x * 0.012 + time * 0.6) * 1.6 + Math.cos(z * 0.017 - time * 0.45) * 1.3 + Math.sin((x + z) * 0.03 + time) * 0.5;
    }
    pos.needsUpdate = true;

    this.snowMat.uniforms.time.value = time;
    this.snowMat.uniforms.intensity.value = snowIntensity;
    this.snowMat.uniforms.camPos.value.copy(camera.position);
  }
}

/** Stepped lathe profile: each terrace is a vertical rise then a flat ledge — reads as voxel from afar. */
function terracedLathe(radius: (h: number) => number, height: number, steps: number, segments: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < steps; i++) {
    const y0 = (height * i) / steps;
    const y1 = (height * (i + 1)) / steps;
    const r = radius(y0 / height);
    pts.push(new THREE.Vector2(r, y0), new THREE.Vector2(r, y1));
    pts.push(new THREE.Vector2(i === steps - 1 ? 0.001 : radius(y1 / height), y1));
  }
  return new THREE.LatheGeometry(pts, segments).toNonIndexed();
}

function colorByHeight(geo: THREE.BufferGeometry, snowLine: number, rock: number, snow: number, streaks = 0): void {
  const pos = geo.attributes.position;
  const colors: number[] = [];
  const r = new THREE.Color(rock);
  const sn = new THREE.Color(snow);
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const a = Math.atan2(pos.getX(i), pos.getZ(i));
    const c = y + Math.sin(a * 9) * streaks > snowLine ? sn : r;
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

const landMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, fog: false });

function buildFuji(): THREE.Object3D {
  // Classic concave Fuji profile (radius vs normalised height), terraced for the voxel look.
  const profile: [number, number][] = [
    [0, 410],
    [0.12, 310],
    [0.3, 218],
    [0.53, 144],
    [0.75, 88],
    [0.95, 45],
    [1, 32],
  ];
  const radius = (t: number) => {
    for (let i = 1; i < profile.length; i++)
      if (t <= profile[i][0]) {
        const [t0, r0] = profile[i - 1];
        const [t1, r1] = profile[i];
        return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0);
      }
    return profile[profile.length - 1][1];
  };
  const h = 223;
  const geo = terracedLathe(radius, h, 16, 12);
  colorByHeight(geo, h * 0.5, 0x2b3550, 0xe6ecf8, 14);
  const mesh = new THREE.Mesh(geo, landMaterial);
  mesh.position.copy(FUJI_POS);
  return mesh;
}

function buildRidges(): THREE.Object3D {
  const g = new THREE.Group();
  const rng = new Rng(17);
  const rockColors = [0x1c2438, 0x232c44, 0x182032];
  const peaks: [number, number, number, number][] = [
    [-1300, -1100, 160, 260],
    [-1050, -1350, 120, 300],
    [-800, -900, 90, 200],
    [-650, -500, 110, 180],
    [900, -1200, 150, 300],
    [1200, -900, 190, 280],
    [700, -1500, 110, 340],
    [600, -650, 80, 170],
    [1400, -500, 140, 240],
  ];
  for (const [x, z, h, r] of peaks) {
    const geo = terracedLathe((t) => r * (1 - t) + 8, h, 7 + rng.int(0, 3), 6 + rng.int(0, 2));
    colorByHeight(geo, h * 0.45, rng.pick(rockColors), 0xc8d2e6);
    const m = new THREE.Mesh(geo, landMaterial);
    m.position.set(x, OCEAN_Y - 6, z);
    m.rotation.y = rng.range(0, Math.PI);
    g.add(m);
  }
  return g;
}

/** Plateau around the restaurant falling away to cliffs and the sea to the north; hills rise east and west. */
export function terrainHeight(x: number, z: number): number {
  let h = 0;
  const away = Math.min(1, Math.max(0, (Math.max(Math.abs(x) - 16, z - 18, -z - 10) + 6) / 14));
  const bump = (Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.8 + Math.sin(x * 0.07 + z * 0.05) * 1.6) * away;
  if (z < -9) h -= Math.min(48, Math.pow(-z - 9, 1.35) * 0.9);
  h += Math.max(0, Math.abs(x) - 26) * 0.55;
  if (z > 22) h += (z - 22) * 0.35;
  const nearBuilding = Math.abs(x) < 16 && z > -10 && z < 18;
  return nearBuilding ? -0.125 : h + bump;
}

const TERRAIN_VOXEL = 1.5;
const TERRAIN_Y0 = -0.125;

/** Top surface (metres) of the terrain block column containing (x, z). */
export function terrainTop(x: number, z: number): number {
  const ix = Math.floor(x / TERRAIN_VOXEL);
  const iz = Math.floor(z / TERRAIN_VOXEL);
  const j = Math.round((terrainHeight((ix + 0.5) * TERRAIN_VOXEL, (iz + 0.5) * TERRAIN_VOXEL) - TERRAIN_Y0) / TERRAIN_VOXEL);
  return TERRAIN_Y0 + j * TERRAIN_VOXEL;
}

function buildTerrain(): THREE.Object3D {
  const vox = new Vox();
  const jMin = Math.floor((OCEAN_Y - 3 - TERRAIN_Y0) / TERRAIN_VOXEL);
  for (let ix = -66; ix < 66; ix++)
    for (let iz = -86; iz < 27; iz++) {
      const top = Math.round((terrainHeight((ix + 0.5) * TERRAIN_VOXEL, (iz + 0.5) * TERRAIN_VOXEL) - TERRAIN_Y0) / TERRAIN_VOXEL);
      for (let j = jMin; j < top; j++) {
        const depth = top - 1 - j;
        vox.set(ix, j, iz, depth === 0 ? (((ix * 7 + iz * 3) % 5) + 5) % 5 === 0 ? C.snow2 : C.snow : depth < 2 && (ix + j) % 3 === 0 ? C.snow2 : (ix * 3 + j * 5 + iz) % 4 === 0 ? C.stoneD : C.stone);
      }
    }
  const m = meshGrid(vox.toDense(), TERRAIN_VOXEL);
  const mesh = new THREE.Mesh(m.solid!, solidMaterial);
  mesh.position.y = TERRAIN_Y0;
  return mesh;
}

function pineModel(variant: number) {
  return cachedModel(`pine-${variant}`, 0.25, [2.5, 0, 2.5], (v) => {
    const tiers = 3 + variant;
    v.box(2, 0, 2, 3, 3, 3, C.darkWood);
    let y = 2;
    for (let i = 0; i < tiers; i++) {
      const r = tiers - i + 1;
      const c = 2.5;
      v.box(Math.floor(c - r), y, Math.floor(c - r), Math.ceil(c + r), y + 2, Math.ceil(c + r), (x, yy, z) => ((x + z + yy) % 3 === 0 ? C.leafDark : C.leaf));
      v.box(Math.floor(c - r), y + 2, Math.floor(c - r), Math.ceil(c + r), y + 3, Math.ceil(c + r), (x, _y, z) =>
        Math.abs(x + 0.5 - c) >= r - 0.5 || Math.abs(z + 0.5 - c) >= r - 0.5 ? C.snow : (x * 3 + z) % 4 === 0 ? C.snow2 : C.snow,
      );
      y += 3;
    }
    v.box(2, y, 2, 3, y + 1, 3, C.snow);
  });
}

function buildTrees(): THREE.Object3D {
  const rng = new Rng(5);
  const g = new THREE.Group();
  const spots: [number, THREE.Vector3, number][] = [];
  let tries = 0;
  while (spots.length < 110 && tries++ < 5000) {
    const x = rng.range(-95, 95);
    const z = rng.range(-70, 38);
    if (Math.abs(x) < 17 && z > -11 && z < 19) continue;
    if (Math.abs(x) < 34 && z < -9) continue; // keep the sea view from the windows clear
    const y = terrainTop(x, z);
    if (y < OCEAN_Y + 4) continue;
    spots.push([rng.int(0, 2), new THREE.Vector3(x, y, z), rng.range(0.8, 1.5)]);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let variant = 0; variant < 3; variant++) {
    const mine = spots.filter((s) => s[0] === variant);
    const model = pineModel(variant);
    const inst = new THREE.InstancedMesh(model.solid!, solidMaterial, mine.length);
    mine.forEach(([, p, s], i) => {
      q.setFromAxisAngle(up, (Math.floor(rng.range(0, 4)) * Math.PI) / 2);
      m.compose(p, q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(i, m);
    });
    inst.computeBoundingSphere();
    g.add(inst);
  }
  return g;
}

function buildSnowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      intensity: { value: 1 },
      camPos: { value: new THREE.Vector3() },
      boxMin: { value: BUILDING_BOUNDS.min.clone() },
      boxMax: { value: BUILDING_BOUNDS.max.clone() },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float time; uniform float intensity; uniform vec3 camPos; uniform vec3 boxMin; uniform vec3 boxMax;
      varying float vAlpha;
      const vec3 region = vec3(70.0, 30.0, 60.0);
      void main() {
        vec3 p = position;
        float fall = 0.9 + seed * 0.8;
        p.y -= time * fall;
        p.x += time * 0.5 + sin(time * 0.7 + seed * 40.0) * 0.6;
        p.z += sin(time * 0.5 + seed * 20.0) * 0.4;
        vec3 origin = vec3(camPos.x - region.x * 0.5, -12.0, camPos.z - region.z * 0.6);
        p = origin + mod(p - origin, region);
        bool inside = all(greaterThan(p, boxMin)) && all(lessThan(p, boxMax));
        float visible = step(seed, intensity) * (inside ? 0.0 : 1.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = visible * min(5.0, (0.25 + seed * 0.35) * (60.0 / -mv.z));
        vAlpha = visible * clamp(1.0 - (-mv.z) / 60.0, 0.0, 1.0) * 0.9;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.01) discard;
        gl_FragColor = vec4(0.93, 0.96, 1.0, vAlpha);
      }`,
  });
}

function buildSnow(material: THREE.ShaderMaterial): THREE.Points {
  const count = 9000;
  const rng = new Rng(23);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rng.range(0, 70);
    pos[i * 3 + 1] = rng.range(0, 30);
    pos[i * 3 + 2] = rng.range(0, 60);
    seed[i] = rng.next();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return points;
}

function softTexture(seed: number, blobs: number, size = 128): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size / 2;
  const ctx = c.getContext('2d')!;
  const rng = new Rng(seed);
  for (let i = 0; i < blobs; i++) {
    const x = rng.range(0.2, 0.8) * c.width;
    const y = rng.range(0.35, 0.65) * c.height;
    const r = rng.range(0.12, 0.3) * c.width;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A deck of soft cloud billboards over the sea: dark and heavy at night, lit from below at dawn. */
class Clouds {
  readonly group = new THREE.Group();
  private readonly mats: THREE.SpriteMaterial[] = [];
  private readonly sprites: { s: THREE.Sprite; dir: THREE.Vector3; drift: number }[] = [];
  private readonly tmp = new THREE.Color();

  constructor() {
    const rng = new Rng(41);
    for (let i = 0; i < 4; i++) this.mats.push(new THREE.SpriteMaterial({ map: softTexture(100 + i, 9), transparent: true, depthWrite: false, fog: false }));
    for (let i = 0; i < 34; i++) {
      const az = rng.range(-1.6, 1.6);
      const el = rng.range(0.035, 0.2);
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      const s = new THREE.Sprite(this.mats[i % this.mats.length]);
      const w = rng.range(700, 1500);
      s.scale.set(w, w * rng.range(0.28, 0.45), 1);
      s.position.copy(dir).multiplyScalar(rng.range(2000, 2600));
      s.renderOrder = -5;
      this.group.add(s);
      this.sprites.push({ s, dir, drift: rng.range(0.6, 1.4) });
    }
  }

  update(time: number, sky: { top: THREE.Color; horizon: THREE.Color; glow: THREE.Color }, sunDir: THREE.Vector3, sunUp: number, snow: number, camera: THREE.Camera): void {
    const night = this.tmp.set(0x1a2034).lerp(sky.top, 0.35);
    const lit = new THREE.Color().copy(sky.glow).lerp(new THREE.Color(0xffc8a0), 0.35);
    for (const m of this.mats) {
      m.color.copy(night).lerp(lit, sunUp * 0.85);
      m.opacity = THREE.MathUtils.lerp(0.55 + snow * 0.4, 0.75, sunUp);
    }
    for (const c of this.sprites) {
      const toward = Math.max(0, c.dir.dot(sunDir));
      c.s.material.rotation = 0;
      c.s.position.x += Math.sin(time * 0.01 * c.drift) * 0.05;
      c.s.scale.y = c.s.scale.x * 0.36 * (1 + toward * sunUp * 0.15);
    }
    this.group.position.copy(camera.position);
  }
}

/** Low drifting snow-haze billboards around the plateau: makes the night feel thick and soft. */
class Mist {
  readonly group = new THREE.Group();
  private readonly mat: THREE.SpriteMaterial;
  private readonly sprites: { s: THREE.Sprite; base: THREE.Vector3; speed: number }[] = [];

  constructor() {
    this.mat = new THREE.SpriteMaterial({ map: softTexture(7, 6), transparent: true, depthWrite: false, fog: true });
    const rng = new Rng(77);
    for (let i = 0; i < 46; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(16, 90);
      const base = new THREE.Vector3(Math.sin(a) * r, rng.range(-6, 10), Math.cos(a) * r - 10);
      const s = new THREE.Sprite(this.mat);
      const w = rng.range(30, 70);
      s.scale.set(w, w * 0.35, 1);
      s.position.copy(base);
      this.group.add(s);
      this.sprites.push({ s, base, speed: rng.range(0.4, 1.2) });
    }
  }

  update(time: number, fogColor: THREE.Color, sunUp: number, snow: number, _camera: THREE.Camera): void {
    this.mat.color.copy(fogColor).lerp(new THREE.Color(0x9aa6c0), 0.35 * (1 - sunUp));
    this.mat.opacity = (0.16 + snow * 0.18) * (1 - sunUp * 0.7);
    for (const m of this.sprites) m.s.position.set(m.base.x + Math.sin(time * 0.05 * m.speed) * 6, m.base.y, m.base.z + time * 0.3 * m.speed - Math.floor((time * 0.3 * m.speed) / 40) * 40);
  }
}
