// Atmosphere: sky, rain, splashes, rainy glass, wet-street reflections, steam, backdrop city, post FX.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

export const FOG_COLOR = new THREE.Color(0x0b0b14);
export const FOG_DENSITY = 0.04;

const NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
`;

// ---------------------------------------------------------------- sky
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, flash: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: NOISE + `
      varying vec3 vDir; uniform float time; uniform float flash;
      void main(){
        float y = vDir.y;
        vec3 top = vec3(0.006,0.007,0.016);
        vec3 glow = vec3(0.085,0.05,0.06);
        vec3 col = mix(glow, top, smoothstep(-0.05, 0.55, y));
        vec2 uv = vDir.xz/(max(y,0.06)) * 0.6 + vec2(time*0.01, time*0.004);
        float c = fbm(uv*1.3);
        col += vec3(0.05,0.03,0.035) * smoothstep(0.35,0.9,c) * smoothstep(0.0,0.3,y) * (1.0 - smoothstep(0.3,0.9,y));
        col += flash * vec3(0.55,0.6,0.8) * (0.4 + c);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

// ---------------------------------------------------------------- rain streaks (instanced camera-facing quads)
export function makeRain(count, lights, dryZones) {
  const base = new THREE.InstancedBufferGeometry();
  base.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
  base.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { off[i * 4] = Math.random(); off[i * 4 + 1] = Math.random(); off[i * 4 + 2] = Math.random(); off[i * 4 + 3] = Math.random(); }
  base.setAttribute('seed', new THREE.InstancedBufferAttribute(off, 4));
  base.instanceCount = count;
  const L = lights.slice(0, 8);
  while (L.length < 8) L.push({ pos: [0, -100, 0], color: 0x000000, intensity: 0 });
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 }, cam: { value: new THREE.Vector3() },
      lpos: { value: L.map((l) => new THREE.Vector3(...l.pos)) },
      lcol: { value: L.map((l) => new THREE.Color(l.color).multiplyScalar(l.intensity / 30)) },
      dry: { value: dryZones.map((d) => new THREE.Vector4(...d)) },
      flash: { value: 0 },
    },
    vertexShader: `
      attribute vec4 seed; uniform float time; uniform vec3 cam; uniform vec3 lpos[8]; uniform vec3 lcol[8]; uniform vec4 dry[3]; uniform float flash;
      varying float vA; varying vec3 vC; varying float vY;
      const vec3 BOX = vec3(36., 20., 36.);
      void main(){
        float speed = 9.0 + seed.w*3.0;
        vec3 p = seed.xyz*BOX;
        p.y = mod(p.y - time*speed, BOX.y);
        p.xz += vec2(0.8, 0.3) * (BOX.y - p.y) * 0.08;
        vec3 w = cam + mod(p - cam + BOX*0.5, BOX) - BOX*0.5;
        w.y = p.y - 2.0;
        float hide = 0.0;
        for(int i=0;i<3;i++){ vec4 d = dry[i]; if(w.x>d.x && w.x<d.y && w.z>d.z && w.z<d.w && w.y < 18.0) hide = 1.0; }
        if (w.y < 0.0) hide = 1.0;
        vec3 lit = vec3(0.10,0.11,0.14) + flash*vec3(0.8);
        for(int i=0;i<8;i++){ vec3 dl = lpos[i]-w; lit += lcol[i] * 6.0 / (1.0 + dot(dl,dl)); }
        vC = lit;
        float len = 0.32 + seed.w*0.25;
        vec3 dir = normalize(vec3(0.08, -1.0, 0.03));
        vec3 a = w + dir * len * position.y;
        vec3 toCam = normalize(cam - a);
        vec3 side = normalize(cross(dir, toCam));
        a += side * position.x * 0.006;
        vA = (1.0 - hide) * (0.35 + 0.65*position.y) ;
        vY = position.y;
        vec4 mv = viewMatrix * vec4(a, 1.0);
        float dist = -mv.z;
        vA *= smoothstep(0.3, 1.2, dist) * (1.0 - smoothstep(14.0, 20.0, dist));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying vec3 vC; varying float vY;
      void main(){ if(vA<=0.001) discard; gl_FragColor = vec4(vC * vA * 0.55, 1.0); }`,
  });
  const mesh = new THREE.Mesh(base, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return mesh;
}

// ---------------------------------------------------------------- splashes (tiny expanding rings on the wet ground)
export function makeSplashes(count, areas) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = areas[Math.floor(Math.random() * areas.length)];
    pos[i * 3] = a[0] + Math.random() * (a[1] - a[0]);
    pos[i * 3 + 1] = a[4] + 0.01;
    pos[i * 3 + 2] = a[2] + Math.random() * (a[3] - a[2]);
    ph[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, scale: { value: 600 } },
    vertexShader: `attribute float phase; uniform float time; uniform float scale; varying float vT;
      void main(){ float t = fract(time*1.7 + phase*13.0); vT = t;
        vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = scale * (0.02 + t*0.07) / -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vT; void main(){ vec2 c = gl_PointCoord-0.5; c.y*=2.2; float d=length(c);
      float ring = smoothstep(0.5,0.42,d)*smoothstep(0.28,0.4,d); float a = ring*(1.0-vT)*0.35; if(a<0.01) discard;
      gl_FragColor = vec4(vec3(0.55,0.6,0.7)*a,1.0); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ---------------------------------------------------------------- rainy window glass
export function makeGlassMaterial(inside) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vUv = vec2(w.x + w.z, w.y); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: NOISE + `
      uniform float time; varying vec2 vUv; varying vec3 vW;
      float h11(float x){ return fract(sin(x*127.1)*43758.5453); }
      // static beads that fade in and out
      float beads(vec2 uv, float s, float t){
        uv *= s; vec2 id = floor(uv); vec2 f = fract(uv)-0.5;
        float n = h21(id); vec2 o = vec2(h21(id+3.7), h21(id+9.1)) - 0.5;
        float life = fract(t*0.08 + n*7.0);
        float r = (0.08 + 0.18*h21(id+1.3)) * smoothstep(0.0,0.15,life) * smoothstep(1.0,0.7,life);
        return smoothstep(r, r*0.45, length(f - o*0.6));
      }
      // sliding drops with trails
      float slide(vec2 uv, float t, out float trail){
        uv *= vec2(9.0, 2.0);
        float col = floor(uv.x);
        float sp = 0.25 + h11(col)*0.5;
        float y = uv.y + t*sp + h11(col+4.2)*9.0;
        float cell = floor(y); float fy = fract(y);
        float on = step(0.6, h21(vec2(col, cell)));
        float x = fract(uv.x) - 0.5 + (h21(vec2(col, cell+.5))-0.5)*0.5 + sin(y*6.0 + col)*0.05;
        float drop = smoothstep(0.12, 0.05, length(vec2(x*0.7, (fy-0.15)*3.5))) * on;
        trail = smoothstep(0.05, 0.0, abs(x)) * smoothstep(0.15, 0.9, fy) * on * (1.0-fy) * 0.8;
        trail *= step(0.5, fract(fy*9.0 + col)) * 0.5 + 0.5;
        return drop;
      }
      void main(){
        float t = time;
        float b = beads(vUv, 18.0, t) * step(0.55, h21(floor(vUv*18.0)+0.3)) + beads(vUv + 3.1, 31.0, t*1.3) * 0.6 * step(0.65, h21(floor((vUv+3.1)*31.0)+0.7));
        float tr; float s = slide(vUv, t, tr);
        float tr2; float s2 = slide(vUv*1.37 + 7.3, t*0.8, tr2);
        float m = clamp(b + s + s2*0.8, 0.0, 1.0);
        float trailM = clamp(tr + tr2, 0.0, 1.0);
        vec3 bokeh = mix(vec3(1.0,0.72,0.45), vec3(1.0,0.28,0.32), smoothstep(0.4,0.7,fbm(vW.xy*0.4)));
        bokeh = mix(bokeh, vec3(0.6,0.75,1.0), smoothstep(0.55,0.8,fbm(vW.xy*0.3+5.0)) * 0.6);
        float fogBand = smoothstep(1.45, 1.0, vW.y) * 0.10;
        vec3 col = bokeh * (m * 0.35 + trailM * 0.12) + vec3(0.6,0.62,0.7) * fogBand;
        float a = 0.03 + m*0.35 + trailM*0.12 + fogBand;
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// ---------------------------------------------------------------- wet street reflections
export function makeWetGround(width, height, rtScale) {
  const shader = {
    name: 'WetReflector',
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, reflInv: { value: new THREE.Matrix4() }, time: { value: 0 }, fogDensity: { value: FOG_DENSITY } },
    vertexShader: `uniform mat4 textureMatrix; uniform mat4 reflInv; varying vec4 vUv; varying vec3 vW;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0); vUv = textureMatrix*(reflInv*w); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: NOISE + `
      uniform sampler2D tDiffuse; uniform float time; uniform float fogDensity; varying vec4 vUv; varying vec3 vW;
      vec2 ripple(vec2 p, float t){
        vec2 acc = vec2(0.0);
        for(int k=0;k<2;k++){
          vec2 q = p*(2.2+float(k)*1.3) + float(k)*7.7;
          vec2 id = floor(q); vec2 f = fract(q)-0.5;
          float n = h21(id+float(k));
          float ph = fract(t*0.9 + n);
          vec2 o = (vec2(h21(id+1.1), h21(id+2.3))-0.5)*0.6;
          vec2 d = f - o; float r = length(d);
          float wave = sin((r - ph*0.5)*40.0) * smoothstep(0.5*ph+0.04, 0.5*ph, r) * (1.0-ph);
          acc += normalize(d+1e-4) * wave;
        }
        return acc;
      }
      void main(){
        vec2 p = vW.xz;
        float n = fbm(p*0.35);
        float puddle = smoothstep(0.42, 0.62, n);
        vec2 rp = ripple(p, time);
        vec2 uv = vUv.xy/vUv.w;
        vec2 dis = rp*0.006 + (vec2(fbm(p*2.5), fbm(p*2.5+3.3))-0.5)*mix(0.012,0.003,puddle);
        float stretch = mix(0.05, 0.012, puddle);
        vec3 acc = vec3(0.0); float ws = 0.0;
        for(int i=0;i<9;i++){
          float fi = float(i)/8.0 - 0.5;
          float w = 1.0 - abs(fi)*1.4;
          acc += texture2D(tDiffuse, uv + dis + vec2(0.0, fi*stretch)).rgb * w; ws += w;
        }
        acc /= ws;
        float strength = mix(0.22, 0.85, puddle);
        float d = length(vW - cameraPosition);
        float fog = exp(-pow(fogDensity*d, 2.0));
        gl_FragColor = vec4(acc*strength*fog, 1.0);
      }`,
  };
  const geo = new THREE.PlaneGeometry(width, height);
  const refl = new Reflector(geo, {
    textureWidth: Math.max(256, Math.floor(window.innerWidth * rtScale)), textureHeight: Math.max(256, Math.floor(window.innerHeight * rtScale)),
    clipBias: 0.003, shader, multisample: 0,
  });
  refl.material.transparent = true;
  refl.material.blending = THREE.AdditiveBlending;
  refl.material.depthWrite = false;
  refl.rotation.x = -Math.PI / 2;
  refl.renderOrder = 2;
  return refl;
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
        gl_FragColor = vec4(vec3(0.5,0.47,0.5), a * smoothstep(0.5, 0.15, d)); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  return pts;
}

// ---------------------------------------------------------------- backdrop city (beyond the voxel grid)
export function makeBackdrop() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { fogDensity: { value: FOG_DENSITY * 0.55 }, fogColor: { value: FOG_COLOR } },
    vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: NOISE + `
      varying vec3 vW; varying vec3 vN; uniform float fogDensity; uniform vec3 fogColor;
      void main(){
        vec2 f = abs(vN.x) > 0.5 ? vec2(vW.z, vW.y) : vec2(vW.x, vW.y);
        vec3 col = vec3(0.028,0.022,0.024);
        if (abs(vN.y) < 0.5) {
          vec2 cell = vec2(f.x/1.6, (f.y-0.6)/3.0);
          vec2 id = floor(cell); vec2 g = fract(cell);
          float win = step(0.25,g.x)*step(g.x,0.75)*step(0.25,g.y)*step(g.y,0.82);
          float lit = step(0.62, h21(id + floor(vW.x*0.02)*13.0 + floor(vW.z*0.02)*7.0));
          vec3 wc = mix(vec3(1.0,0.62,0.3), vec3(0.6,0.75,1.0), step(0.8, h21(id+5.0)));
          col += win * (lit * wc * 0.9 + (1.0-lit)*vec3(0.01,0.012,0.02));
          if (f.y < 4.0) col += vec3(1.0,0.75,0.45) * 0.25 * step(0.7, h21(vec2(floor(f.x/4.0), 3.0)));
        }
        float d = length(vW - cameraPosition);
        float fog = 1.0 - exp(-pow(fogDensity*d, 2.0));
        gl_FragColor = vec4(mix(col, fogColor, fog), 1.0);
      }`,
  });
  const grp = new THREE.Group();
  const add = (x0, x1, z0, z1, h) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, h / 2 - 0.25, (z0 + z1) / 2);
    grp.add(m);
  };
  const r = (a, b) => a + Math.random() * (b - a);
  // continue our street east
  for (let x = 36; x < 130; x += r(10, 18)) { const w = r(9, 18); add(x, x + w, 0, 14, r(12, 26)); add(x, x + w, -30, -13.5, r(12, 30)); }
  // the avenue, both directions
  for (let z = 16; z < 110; z += r(10, 16)) { const w = r(9, 16); add(-60, -9.5, z, z + w, r(14, 34)); add(0, 16, z, z + w, r(14, 30)); }
  for (let z = -16; z > -110; z -= r(10, 16)) { const w = r(9, 16); add(-60, -9.5, z - w, z, r(14, 34)); add(0, 16, z - w, z, r(14, 30)); }
  add(-60, -10, -16, 16, 18);
  add(0, 36, -30, -16, 13);
  // distant towers
  for (let i = 0; i < 12; i++) { const x = r(-200, 200), z = r(-260, -120), w = r(12, 30); add(x, x + w, z, z + w, r(50, 160)); }
  for (let i = 0; i < 8; i++) { const x = r(120, 260), z = r(-150, 150), w = r(12, 30); add(x, x + w, z, z + w, r(50, 130)); }
  // ground beyond the grid
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ color: 0x141418 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.27;
  grp.add(ground);
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
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.35, 1.0);
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
        col = mix(col, col*vec3(1.06,0.99,0.9), smoothstep(0.25,0.85,l));
        col += vec3(0.006,0.010,0.022)*(1.0-l);
        float v = smoothstep(0.95, 0.3, length(c*vec2(1.15,1.0)));
        col *= mix(0.55, 1.0, v);
        col += (hash(vUv*res + fract(time)*91.7) - 0.5) * 0.04;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  composer.addPass(grade);
  return { composer, bloom, grade, outline };
}
