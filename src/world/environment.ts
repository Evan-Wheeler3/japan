import * as THREE from 'three';
import { Rng } from '../sim/rng';
import { BUILDING_BOUNDS } from './layout';
import { mat } from './materials';

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
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(65, 12), new THREE.MeshBasicMaterial({ color: 0xc4cadb, fog: false, transparent: true }));
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
    this.ocean = new THREE.Mesh(oceanGeo, new THREE.MeshStandardMaterial({ color: 0x0e2340, roughness: 0.62, metalness: 0, flatShading: true }));
    this.oceanBase = Float32Array.from(oceanGeo.attributes.position.array as Float32Array);
    this.group.add(this.ocean);

    // ---- Terrain & trees ----
    this.group.add(buildTerrain());
    this.group.add(buildTrees());

    // ---- Snowfall ----
    this.snowMat = buildSnowMaterial();
    this.group.add(buildSnow(this.snowMat));

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

    this.fog.color.copy(s.horizon).lerp(tmpA.copy(s.top), 0.35);
    this.fog.density = THREE.MathUtils.lerp(0.00034, 0.0003, sunUp);

    this.starsMat.opacity = THREE.MathUtils.clamp(1 - skyT * 3.2, 0, 1);
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

function buildFuji(): THREE.Object3D {
  const profile = [
    [330, 0],
    [250, 22],
    [175, 55],
    [115, 98],
    [70, 140],
    [36, 176],
    [26, 186],
    [0, 184],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile, 11);
  const colors: number[] = [];
  const pos = geo.attributes.position;
  const rock = new THREE.Color(0x2b3550);
  const snow = new THREE.Color(0xe6ecf8);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const streak = Math.sin(Math.atan2(pos.getX(i), pos.getZ(i)) * 9) * 10;
    colors.push(...(y + streak > 95 ? snow : rock).toArray());
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  mesh.position.copy(FUJI_POS);
  mesh.scale.set(1.25, 1.2, 1.25);
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
    const geo = new THREE.ConeGeometry(r, h, 7, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < h / 2 - 1) {
        pos.setX(i, pos.getX(i) * rng.range(0.8, 1.2));
        pos.setZ(i, pos.getZ(i) * rng.range(0.8, 1.2));
      }
    }
    const nonIdx = geo.toNonIndexed();
    const p2 = nonIdx.attributes.position;
    const colors: number[] = [];
    const base = new THREE.Color(rng.pick(rockColors));
    const snow = new THREE.Color(0xc8d2e6);
    for (let i = 0; i < p2.count; i++) colors.push(...(p2.getY(i) > h * 0.12 ? snow : base).toArray());
    nonIdx.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const m = new THREE.Mesh(nonIdx, mat(0xffffff, { key: 'ridge' }));
    (m.material as THREE.MeshStandardMaterial).vertexColors = true;
    m.position.set(x, OCEAN_Y + h / 2 - 10, z);
    m.rotation.y = rng.range(0, Math.PI);
    g.add(m);
  }
  return g;
}

/** Plateau around the restaurant falling away to cliffs and the sea to the north; hills rise east and west. */
export function terrainHeight(x: number, z: number): number {
  let h = 0;
  const bump = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.6 + Math.sin(x * 0.07 + z * 0.05) * 1.2;
  if (z < -9) h -= Math.min(48, Math.pow(-z - 9, 1.35) * 0.9);
  h += Math.max(0, Math.abs(x) - 22) * 0.55;
  if (z > 14) h += (z - 14) * 0.35;
  const nearBuilding = Math.abs(x) < 9 && z > -9.5 && z < 12;
  return nearBuilding ? Math.min(h, -0.02) : h + bump - 0.05;
}

function buildTerrain(): THREE.Object3D {
  const geo = new THREE.PlaneGeometry(200, 170, 70, 60).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -45);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const colors: number[] = [];
  const snow = new THREE.Color(0xe8eefa);
  const rock = new THREE.Color(0x3a3c48);
  const n = geo.attributes.normal;
  for (let i = 0; i < pos.count; i += 3) {
    const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
    const c = ny < 0.62 ? rock : snow;
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
}

function buildTrees(): THREE.Object3D {
  const rng = new Rng(5);
  const spots: THREE.Vector3[] = [];
  while (spots.length < 90) {
    const x = rng.range(-95, 95);
    const z = rng.range(-70, 35);
    if (Math.abs(x) < 10 && z > -11 && z < 13) continue;
    const y = terrainHeight(x, z);
    if (y < OCEAN_Y + 4) continue;
    spots.push(new THREE.Vector3(x, y, z));
  }
  const g = new THREE.Group();
  const tiers: { geo: THREE.BufferGeometry; material: THREE.Material }[] = [
    { geo: new THREE.BoxGeometry(0.4, 1.2, 0.4).translate(0, 0.6, 0), material: mat(0x3a2414) },
    { geo: new THREE.BoxGeometry(2.2, 1.1, 2.2).translate(0, 1.6, 0), material: mat(0x1f3a2c) },
    { geo: new THREE.BoxGeometry(2.3, 0.25, 2.3).translate(0, 2.2, 0), material: mat(0xeef3fb) },
    { geo: new THREE.BoxGeometry(1.5, 1.0, 1.5).translate(0, 2.8, 0), material: mat(0x24432f) },
    { geo: new THREE.BoxGeometry(1.6, 0.25, 1.6).translate(0, 3.35, 0), material: mat(0xeef3fb) },
    { geo: new THREE.BoxGeometry(0.8, 0.9, 0.8).translate(0, 3.9, 0), material: mat(0x24432f) },
    { geo: new THREE.BoxGeometry(0.85, 0.3, 0.85).translate(0, 4.4, 0), material: mat(0xeef3fb) },
  ];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  for (const tier of tiers) {
    const inst = new THREE.InstancedMesh(tier.geo, tier.material, spots.length);
    const r2 = new Rng(11);
    spots.forEach((p, i) => {
      const s = r2.range(0.8, 1.6);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r2.range(0, Math.PI));
      m.compose(p, q, sc.set(s, s, s));
      inst.setMatrixAt(i, m);
    });
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
