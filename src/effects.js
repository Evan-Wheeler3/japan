// Atmosphere: night sky that turns to dawn, falling snow, frosted glass, steam, the sea and the
// mountains (Mt Fuji across the bay), post FX. `dawn` runs 0 (deep night) .. 1 (the sun is up).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { L } from './world.js';

export const FOG_COLOR = new THREE.Color(0x141b2a);
export const FOG_DENSITY = 0.03;
// where things are in the sky: Fuji across the bay to the south-west, the sun comes up just right of it
export const FUJI = new THREE.Vector3(-150, -40, -650);
export const sunDir = (dawn, out = new THREE.Vector3()) => out.set(0.32, THREE.MathUtils.lerp(-0.12, 0.1, THREE.MathUtils.smoothstep(dawn, 0.45, 1)), -1).normalize();
export const MOON_DIR = new THREE.Vector3(0.6, 0.3, -0.75).normalize();

// The horizon/haze color for a given dawn, shared by the sky, the fog and the sea so they meet seamlessly.
const NIGHT_HAZE = new THREE.Color(0x141b2a), BLUE_HOUR = new THREE.Color(0x46506e), DAWN_HAZE = new THREE.Color(0xc0928a);
export function hazeColor(dawn, out = new THREE.Color()) {
  if (dawn < 0.55) return out.copy(NIGHT_HAZE).lerp(BLUE_HOUR, THREE.MathUtils.smoothstep(dawn, 0.15, 0.55));
  return out.copy(BLUE_HOUR).lerp(DAWN_HAZE, THREE.MathUtils.smoothstep(dawn, 0.55, 1));
}

const NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
`;

// ---------------------------------------------------------------- sky: stars, moon, a snowy cloud deck, then dawn
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, dawn: { value: 0 }, sun: { value: new THREE.Vector3() }, moon: { value: MOON_DIR.clone() }, haze: { value: new THREE.Color() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: NOISE + `
      varying vec3 vDir; uniform float time; uniform float dawn; uniform vec3 sun; uniform vec3 moon; uniform vec3 haze;
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        float up = smoothstep(-0.02, 0.6, y);
        // night: inky blue overhead fading into the snowy haze
        vec3 night = mix(haze, vec3(0.008,0.012,0.03), up);
        // dawn: deep blue overhead, warm band low around the sun, rosy away from it
        float toward = max(dot(normalize(vec3(d.x,0.,d.z)), normalize(vec3(sun.x,0.,sun.z))), 0.);
        vec3 dawnTop = mix(vec3(0.05,0.08,0.2), vec3(0.22,0.36,0.62), smoothstep(0.7,1.0,dawn));
        vec3 dawnLow = mix(vec3(0.75,0.45,0.5), vec3(1.25,0.62,0.3), toward*toward);
        vec3 dawnSky = mix(dawnLow, dawnTop, smoothstep(-0.02, 0.45 - toward*0.15, y));
        dawnSky = mix(haze, dawnSky, smoothstep(-0.03, 0.06, y));
        float k = smoothstep(0.3, 0.85, dawn);
        vec3 col = mix(night, dawnSky, k);
        // stars, hidden by cloud and by morning
        vec2 sp = d.xz / (y + 1.0) * 220.0;
        float st = step(0.9965, h21(floor(sp))) * smoothstep(0.08, 0.3, y);
        st *= 0.6 + 0.4*sin(time*2.0 + h21(floor(sp)+3.0)*30.0);
        // clouds: a slow deck with gaps
        vec2 cuv = d.xz/(max(y,0.05)) * 0.35 + vec2(time*0.004, time*0.0015);
        float c = smoothstep(0.42, 0.85, fbm(cuv*1.6)) * smoothstep(0.02, 0.25, y);
        col += vec3(1.0) * st * (1.0 - c) * (1.0 - k) * 0.9;
        vec3 cloudCol = mix(vec3(0.07,0.08,0.11), mix(vec3(0.9,0.55,0.55), vec3(1.4,0.8,0.5), toward), k);
        // moonlight on the cloud edges
        cloudCol += vec3(0.12,0.13,0.16) * pow(max(dot(d, moon),0.), 6.0) * (1.0-k);
        col = mix(col, cloudCol, c * 0.85);
        // moon
        float md = dot(d, moon);
        col += vec3(1.0,0.97,0.9) * smoothstep(0.9993, 0.9996, md) * (1.0 - c*0.8) * (1.0 - k) * 1.6;
        col += vec3(0.25,0.28,0.35) * pow(max(md,0.), 300.0) * (1.0 - k);
        // sun
        float sd = dot(d, sun);
        col += vec3(1.6,1.0,0.55) * pow(max(sd,0.), 18.0) * k * 0.9;
        col += vec3(5.0,3.4,1.8) * smoothstep(0.99955, 0.9998, sd) * smoothstep(0.75, 0.95, dawn);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

// ---------------------------------------------------------------- snowfall (instanced camera-facing flakes that sway)
export function makeSnow(count, lights, dryZones) {
  const base = new THREE.InstancedBufferGeometry();
  base.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  base.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) off[i] = Math.random();
  base.setAttribute('seed', new THREE.InstancedBufferAttribute(off, 4));
  base.instanceCount = count;
  const L8 = lights.slice(0, 8);
  while (L8.length < 8) L8.push({ pos: [0, -100, 0], color: 0x000000, intensity: 0 });
  const dry = dryZones.slice(0, 4);
  while (dry.length < 4) dry.push([0, 0, 0, 0]);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      time: { value: 0 }, cam: { value: new THREE.Vector3() }, dawn: { value: 0 }, wind: { value: new THREE.Vector2(0.4, 0.1) },
      lpos: { value: L8.map((l) => new THREE.Vector3(...l.pos)) },
      lcol: { value: L8.map((l) => new THREE.Color(l.color).multiplyScalar(l.intensity / 30)) },
      dry: { value: dry.map((d) => new THREE.Vector4(...d)) },
    },
    vertexShader: `
      attribute vec4 seed; uniform float time; uniform vec3 cam; uniform vec3 lpos[8]; uniform vec3 lcol[8]; uniform vec4 dry[4];
      uniform float dawn; uniform vec2 wind;
      varying float vA; varying vec3 vC; varying vec2 vP;
      const vec3 BOX = vec3(28., 14., 28.);
      void main(){
        float speed = 0.7 + seed.w*0.8;
        vec3 p = seed.xyz*BOX;
        float fall = time*speed;
        p.y = mod(p.y - fall, BOX.y);
        p.x += wind.x*time + sin(time*0.9 + seed.x*40.0)*0.35;
        p.z += wind.y*time + cos(time*0.7 + seed.z*40.0)*0.35;
        vec3 w = cam + mod(p - cam + BOX*0.5, BOX) - BOX*0.5;
        w.y = cam.y + p.y - BOX.y*0.45;
        float hide = 0.0;
        for(int i=0;i<4;i++){ vec4 d = dry[i]; if(w.x>d.x && w.x<d.y && w.z>d.z && w.z<d.w && w.y < 12.0) hide = 1.0; }
        if (w.y < 0.05 || w.z < ${(L.cliff - 40).toFixed(1)}) hide = 1.0;
        vec3 lit = mix(vec3(0.42,0.46,0.58), vec3(1.0,0.86,0.8), dawn);
        for(int i=0;i<8;i++){ vec3 dl = lpos[i]-w; lit += lcol[i] * 5.0 / (1.0 + dot(dl,dl)); }
        vC = lit;
        float size = 0.012 + seed.w*0.018;
        vec4 mv = viewMatrix * vec4(w, 1.0);
        mv.xy += position.xy * size;
        float dist = -mv.z;
        vA = (1.0 - hide) * smoothstep(0.7, 1.8, dist) * (1.0 - smoothstep(9.0, 14.0, dist));
        vP = position.xy;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying vec3 vC; varying vec2 vP;
      void main(){ if(vA<=0.001) discard; float r = max(abs(vP.x), abs(vP.y)); float a = vA * (1.0 - smoothstep(0.6, 1.0, r)*0.6);
        gl_FragColor = vec4(vC, a * 0.85); }`,
  });
  const mesh = new THREE.Mesh(base, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return mesh;
}

// ---------------------------------------------------------------- frosted window glass
export function makeGlassMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, dawn: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vUv = vec2(w.x + w.z, w.y); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: NOISE + `
      uniform float time; uniform float dawn; varying vec2 vUv; varying vec3 vW;
      void main(){
        // frost creeps up from the sill in feathery patches; a band of condensation above it
        float n = fbm(vUv*vec2(6.0, 9.0)) * 0.6 + fbm(vUv*24.0) * 0.4;
        float frost = smoothstep(0.55, 0.85, n + smoothstep(1.55, 1.0, vW.y)*0.55 - smoothstep(1.4, 2.4, vW.y)*0.15);
        float fern = smoothstep(0.7, 0.75, fbm(vUv*40.0 + vec2(0.0, vW.y*3.0))) * smoothstep(1.6, 1.0, vW.y);
        float mist = smoothstep(1.7, 1.0, vW.y) * 0.08;
        vec3 col = mix(vec3(0.75,0.82,0.95), vec3(1.0,0.85,0.7), 0.35) * (frost*0.45 + fern*0.35) + vec3(0.6,0.65,0.75) * mist;
        col *= mix(0.6, 1.2, dawn);
        float a = 0.04 + frost*0.32 + fern*0.25 + mist;
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// ---------------------------------------------------------------- steam puffs
export function makeSteam(sources) {
  const per = 18;
  const n = sources.length * per;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  sources.forEach((s, si) => {
    for (let i = 0; i < per; i++) {
      const k = si * per + i;
      pos.set(s.pos, k * 3);
      seed.set([Math.random(), Math.random(), Math.random(), s.size], k * 4);
    }
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, scale: { value: 600 } },
    vertexShader: `attribute vec4 seed; uniform float time; uniform float scale; varying float vA; varying float vS;
      void main(){
        float t = fract(time*0.12*(0.7+seed.x*0.6) + seed.y);
        vec3 p = position;
        float sz = seed.w;
        p.y += t * 2.2 * sz;
        p.x += sin(t*5.0 + seed.z*6.28) * 0.25 * sz + t*0.5*sz;
        p.z += cos(t*4.0 + seed.x*6.28) * 0.15 * sz;
        vA = smoothstep(0.0, 0.2, t) * (1.0 - t) * 0.09;
        vS = seed.z;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_PointSize = scale * sz * (0.5 + t*1.6) / -mv.z;
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `varying float vA; varying float vS;
      void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); float a = smoothstep(0.5,0.0,d) * vA; if(a<0.004) discard;
        gl_FragColor = vec4(vec3(0.55,0.55,0.6), a * smoothstep(0.5, 0.15, d)); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  return pts;
}

// ---------------------------------------------------------------- beyond the voxel lot: the cliff, the sea, the hills, Fuji
// Distant shapes share one shader: snow on the heights, alpenglow on the sun side at dawn, and a thin
// haze of their own (so Fuji stays visible far past where the scene fog would swallow it).
function farMaterial() {
  return new THREE.ShaderMaterial({
    fog: false, side: THREE.DoubleSide,
    uniforms: { dawn: { value: 0 }, sun: { value: new THREE.Vector3() }, haze: { value: new THREE.Color() }, density: { value: 0.0016 }, snowLine: { value: 0.55 },
      white: { value: new THREE.Color(0.32, 0.36, 0.46) } },
    vertexShader: `varying vec3 vW; varying vec3 vN; varying float vH; attribute float height;
      void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vH = height; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: NOISE + `
      varying vec3 vW; varying vec3 vN; varying float vH; uniform float dawn; uniform vec3 sun; uniform vec3 haze; uniform float density; uniform float snowLine; uniform vec3 white;
      void main(){
        float streak = fbm(vec2(atan(vW.x, vW.z)*40.0, vW.y*0.05));
        float snow = smoothstep(snowLine - 0.08, snowLine + 0.04, vH + (streak-0.5)*0.25);
        vec3 rock = vec3(0.05,0.06,0.09);
        vec3 col = mix(rock, white, snow);
        vec3 nn = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        float k = smoothstep(0.35, 1.0, dawn);
        float ndl = max(dot(nn, normalize(sun + vec3(0.,0.25,0.))), 0.0);
        vec3 lit = mix(vec3(0.5,0.6,0.85), vec3(1.4,0.7,0.6), k) * (0.45 + 0.9*ndl*k);
        col *= mix(vec3(0.9), lit, 0.85);
        col += vec3(1.2,0.55,0.35) * snow * ndl * k * smoothstep(0.6, 1.0, dawn) * 0.6;
        float d = length(vW - cameraPosition);
        float f = 1.0 - exp(-d*density);
        gl_FragColor = vec4(mix(col, haze, clamp(f,0.,1.)), 1.0);
      }`,
  });
}
function lathe(profile, segs, mat, heightOf) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
  const pos = g.attributes.position, h = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) h[i] = heightOf(pos.getY(i));
  g.setAttribute('height', new THREE.BufferAttribute(h, 1));
  return new THREE.Mesh(g, mat);
}

export function makeBackdrop() {
  const grp = new THREE.Group();
  const far = farMaterial(), mats = [far];
  // Fuji: a concave cone, broad skirts, a snow cap that reaches well down
  {
    const H = 165, prof = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push([4 + 470 * Math.pow(1 - t, 1.9), t * H]); }
    prof.push([0, H + 1.5]);
    const fujiMat = far.clone(); fujiMat.uniforms.density.value = 0.0009; fujiMat.uniforms.snowLine.value = 0.5; fujiMat.uniforms.white.value.setRGB(0.4, 0.44, 0.56);
    const m = lathe(prof, 40, fujiMat, (y) => y / H);
    m.position.copy(FUJI); grp.add(m); mats.push(fujiMat);
  }
  // the coastline's hills: low ridges strung across the horizon
  const r = (a, b) => a + Math.random() * (b - a);
  const hillMat = far.clone(); hillMat.uniforms.snowLine.value = 0.72; hillMat.uniforms.density.value = 0.0024;
  for (const [x, z, rad, h] of [[-560, -520, 260, 70], [-420, -380, 160, 42], [380, -620, 300, 85], [560, -420, 200, 50], [120, -760, 220, 38], [-320, -760, 200, 46], [700, -200, 260, 90], [-700, -150, 240, 75]]) {
    const prof = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([rad * (1 - t * t * 0.4) * (1 - t) + 4, t * h]); }
    const m = lathe(prof, 18, hillMat, (y) => y / h);
    m.position.set(x, -40, z); m.scale.z = r(0.6, 1.2); m.rotation.y = r(0, 6); grp.add(m);
  }
  // the mountain we're on, rising behind the shop (and the slopes either side)
  const back = new THREE.PlaneGeometry(900, 500, 60, 40);
  back.rotateX(-Math.PI / 2);
  const p = back.attributes.position, colors = [], hgt = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i) + 250 + L.cliff; // from the cliff edge back ~500 m
    const side = Math.max(0, Math.abs(x - 10) - 40);
    let y = Math.max(0, z - 14) * 0.32 + side * 0.08 + Math.sin(x * 0.03) * 6 * Math.min(1, z / 60);
    y += (Math.sin(x * 0.11 + z * 0.07) + Math.sin(x * 0.05 - z * 0.13)) * Math.min(3, Math.max(0, z - 16) * 0.05);
    p.setXYZ(i, x, y + 0.1, z);
    hgt.push(Math.min(1, y / 120) + 0.6);
  }
  back.setAttribute('height', new THREE.Float32BufferAttribute(hgt, 1));
  back.computeVertexNormals();
  const slopeMat = far.clone(); slopeMat.uniforms.density.value = 0.012; slopeMat.uniforms.snowLine.value = 0.3;
  slopeMat.uniforms.white.value.setRGB(0.6, 0.66, 0.8);
  const backMesh = new THREE.Mesh(back, slopeMat); grp.add(backMesh);
  // the cliff: from the edge of the lot down to the sea, ragged and snowy
  const cliff = new THREE.PlaneGeometry(900, 70, 80, 14);
  cliff.rotateX(-Math.PI / 2);
  const cp = cliff.attributes.position, ch = [];
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), t = (cp.getZ(i) + 35) / 70; // 0 at the far (sea) end .. 1 at the lot
    const z = L.cliff - (1 - t) * 70;
    const drop = Math.pow(1 - t, 0.55);
    const y = -0.3 - drop * 40 + (Math.sin(x * 0.4) + Math.sin(x * 0.13 + t * 9)) * 1.2 * (1 - t) * t * 4;
    cp.setXYZ(i, x + 10, y, z + Math.sin(x * 0.07) * 4 * (1 - t));
    ch.push(t > 0.97 ? 0.9 : 0.3 + Math.sin(x * 0.9 + t * 20) * 0.15);
  }
  cliff.setAttribute('height', new THREE.Float32BufferAttribute(ch, 1));
  cliff.computeVertexNormals();
  const cliffMesh = new THREE.Mesh(cliff, slopeMat); grp.add(cliffMesh);
  // the sea: dark swell with a path of moonlight (later sunlight) running toward you
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShaderMaterial({
    fog: false,
    uniforms: { time: { value: 0 }, dawn: { value: 0 }, sun: { value: new THREE.Vector3() }, moon: { value: MOON_DIR.clone() }, haze: { value: new THREE.Color() } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: NOISE + `
      varying vec3 vW; uniform float time; uniform float dawn; uniform vec3 sun; uniform vec3 moon; uniform vec3 haze;
      void main(){
        vec3 v = normalize(vW - cameraPosition);
        vec2 p = vW.xz * 0.05;
        float n1 = fbm(p + vec2(time*0.03, time*0.02)), n2 = fbm(p*3.1 - vec2(time*0.05, -time*0.03));
        vec3 nrm = normalize(vec3((n1-0.5)*0.5 + (n2-0.5)*0.3, 1.0, (n2-0.5)*0.5));
        vec3 r = reflect(v, nrm);
        float k = smoothstep(0.35, 1.0, dawn);
        vec3 base = mix(vec3(0.008,0.014,0.028), vec3(0.12,0.16,0.26), k);
        float glint = pow(max(dot(r, mix(moon, sun, step(0.6, dawn))), 0.0), mix(160.0, 60.0, k));
        float sparkle = step(0.6, fbm(vW.xz*0.6 + time*0.4));
        vec3 glintCol = mix(vec3(0.6,0.65,0.8), vec3(2.2,1.2,0.6), k) * (0.5 + sparkle);
        vec3 col = base + glintCol * glint + haze * 0.25 * pow(1.0 - max(-v.y, 0.0), 6.0);
        float d = length(vW - cameraPosition);
        float f = 1.0 - exp(-d * 0.0022);
        gl_FragColor = vec4(mix(col, haze, clamp(f, 0., 1.)), 1.0);
      }`,
  }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -40, 0); grp.add(sea);
  // one place to drive all the far-away materials from the clock
  grp.userData.mats = [...mats, hillMat, slopeMat, sea.material];
  return grp;
}

// ---------------------------------------------------------------- post processing
export function makeComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // warm glow around whatever you're looking at (seen or not: the same color either way)
  const outline = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
  outline.visibleEdgeColor.set(0xffc870); outline.hiddenEdgeColor.set(0xffc870);
  outline.edgeStrength = 6; outline.edgeGlow = 0.8; outline.edgeThickness = 2; outline.pulsePeriod = 1.6;
  composer.addPass(outline);
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.4, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 c = vUv - 0.5;
        float ca = 0.004 * dot(c,c);
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + c*ca*2.0).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - c*ca*2.0).b;
        float l = dot(col, vec3(0.299,0.587,0.114));
        col = mix(col, col*vec3(1.07,0.99,0.88), smoothstep(0.25,0.85,l));   // warm highlights
        col += vec3(0.006,0.010,0.024)*(1.0-l);                              // cool shadows
        float v = smoothstep(0.95, 0.3, length(c*vec2(1.15,1.0)));
        col *= mix(0.6, 1.0, v);
        col += (hash(vUv*res + fract(time)*91.7) - 0.5) * 0.035;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(grade);
  return { composer, bloom, grade, outline };
}
