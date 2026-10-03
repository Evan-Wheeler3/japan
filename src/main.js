import * as THREE from 'three';
import { World, buildWorld, L } from './world.js';
import { PropBatch } from './voxel.js';
import * as Props from './props.js';
import { makeSky, makeRain, makeSplashes, makeGlassMaterial, makeWetGround, makeSteam, makeBackdrop, makeComposer, FOG_COLOR, FOG_DENSITY } from './effects.js';
import { Player } from './player.js';
import { Ambience } from './audio.js';
import { Interactions, Door } from './interact.js';
import { Crowd } from './npc.js';
import { Service } from './service.js';
import { Shift, clockText } from './shift.js';
import { Menu } from './menu.js';
import { Net, newCode } from './net.js';
import { Coop } from './coop.js';
import { TouchControls, isTouch } from './touch.js';

const $ = (id) => document.getElementById(id);
const status = (t) => { const el = document.querySelector('#screen .loading'); if (el) el.textContent = t; };
const frame = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 60); });

async function boot() {
  // ---------------------------------------------------------------- renderer
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const touchDevice = isTouch();
  renderer.setPixelRatio(Math.min(devicePixelRatio, touchDevice ? 1 : 1.5)); // phones: fewer pixels, steadier frame rate
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  $('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 900);

  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const emitMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  // the menus come up first (on the loading screen); their buttons are wired once the diner is built
  const menu = new Menu($('screen'), $('overlay'), litMat, emitMat, {});
  menu.touch = touchDevice;

  // ---------------------------------------------------------------- world
  status('laying the tiles…'); await frame();
  const T0 = performance.now();
  const world = new World();
  const meta = buildWorld(world);
  const T1 = performance.now();
  status('setting the tables…'); await frame();
  const batch = new PropBatch(world);
  Props.placeProps(batch);
  status('turning on the neon…'); await frame();
  scene.add(world.mesh(litMat, emitMat));
  scene.add(batch.build(litMat, emitMat));
  console.log(`[diner] build ${(T1 - T0) | 0}ms, mesh+props ${(performance.now() - T1) | 0}ms`);
  scene.add(makeBackdrop());
  const sky = makeSky(); scene.add(sky);

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0x4a5884, 0x2a1a12, 3.0));
  scene.add(new THREE.AmbientLight(0x30283a, 8.0));
  const named = {};
  for (const l of meta.lights) {
    const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 2);
    pl.position.set(...l.pos);
    scene.add(pl);
    named[l.name] = pl;
  }
  const signalLight = new THREE.PointLight(0xff2020, 6, 9, 2); signalLight.position.set(-0.6, 3.6, -4.75); scene.add(signalLight);
  const carLight = new THREE.PointLight(0xfff0d0, 0, 12, 2); scene.add(carLight);
  const flashLight = new THREE.HemisphereLight(0xb8c8ff, 0x202030, 0); scene.add(flashLight);

  // ---------------------------------------------------------------- glass
  const glassMat = makeGlassMaterial();
  for (const g of meta.glass) {
    let m;
    if (g.axis === 'x') {
      m = new THREE.Mesh(new THREE.PlaneGeometry(g.z1 - g.z0, g.y1 - g.y0), glassMat);
      m.position.set(g.x, (g.y0 + g.y1) / 2, (g.z0 + g.z1) / 2); m.rotation.y = Math.PI / 2;
    } else {
      m = new THREE.Mesh(new THREE.PlaneGeometry(g.x1 - g.x0, g.y1 - g.y0), glassMat);
      m.position.set((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, g.z);
    }
    m.renderOrder = 4;
    scene.add(m);
  }

  // ---------------------------------------------------------------- wet street
  const street = makeWetGround(60, 30, 0.5);
  street.position.set(10, 0.004, -7);
  scene.add(street);
  street.updateMatrixWorld();
  street.material.uniforms.reflInv.value.copy(street.matrixWorld).invert();
  const walkMesh = new THREE.Mesh(new THREE.PlaneGeometry(37.5, 5.0), street.material);
  walkMesh.rotation.x = -Math.PI / 2; walkMesh.position.set(17.25, 0.129, -2.5); walkMesh.renderOrder = 2;
  const farWalk = new THREE.Mesh(new THREE.PlaneGeometry(37.5, 2.5), street.material);
  farWalk.rotation.x = -Math.PI / 2; farWalk.position.set(17.25, 0.129, -12.25); farWalk.renderOrder = 2;
  scene.add(walkMesh, farWalk);
  const origBefore = street.onBeforeRender;
  street.onBeforeRender = function (...a) {
    walkMesh.visible = farWalk.visible = false;
    origBefore.apply(this, a);
    walkMesh.visible = farWalk.visible = true;
  };

  // ---------------------------------------------------------------- rain, splashes, steam
  const rainLights = meta.lights.filter((l) => ['streetlamp', 'eat', 'dinerSign', 'bodega', 'pharmacy', 'laundry', 'shed'].includes(l.name));
  const dry = [[-0.4, 16, -3.8, 16.5], [16, 22, -1.0, 0], [26, 36, -4.75, 0]];
  const rain = makeRain(9000, rainLights, dry); scene.add(rain);
  const splashes = makeSplashes(700, [[-1, 33, -11, -5, 0], [-1, 33, -5, -3.85, 0.125], [-1, 33, -13.4, -11, 0.125]]); scene.add(splashes);
  const steam = makeSteam([
    { pos: [6.0, 0.05, -7.9], size: 2.4 }, { pos: [22, 0.05, -5.6], size: 1.4 },
    { pos: [11.3, 1.25, 10.05], size: 0.6 }, { pos: [12.2, 1.25, 10.05], size: 0.6 },
    { pos: [7.3, 1.95, 9.65], size: 0.35 },
    { pos: [11.75, 1.6, 15.1], size: 0.7 }, { pos: [13.4, 1.4, 15.1], size: 0.5 }, { pos: [10.2, 1.2, 15.0], size: 0.9 },
  ]);
  scene.add(steam);

  // ---------------------------------------------------------------- living things
  const door = Props.doorModel().mesh(litMat, emitMat);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(15 / 16, 30 / 16), glassMat);
  doorGlass.position.set(9.5 / 16, (6 + 15) / 16, 0); door.add(doorGlass);
  door.position.set(L.door.hinge, L.floor, L.door.z);
  scene.add(door);
  // doors swing away from whoever opens them; closed doors are solid
  const doors = [];
  const frontDoor = new Door(door, { hinge: { x: L.door.hinge, z: L.door.z }, plusDir: [0, -1], max: 1.6, block: [12.75, 14.0, -3.375, -3.125], bell: true });
  doors.push(frontDoor);
  const addDoor = (kind, hx, hz, base, plusDir, block) => {
    const mesh = Props.swingDoor(kind).mesh(litMat, emitMat);
    mesh.position.set(hx, L.floor, hz); mesh.rotation.y = base; scene.add(mesh);
    const d = new Door(mesh, { hinge: { x: hx, z: hz }, base, plusDir, max: 1.45, block }); doors.push(d); return d;
  };
  const kitchenDoor = addDoor('kitchen', 14.0, 10.0625, 0, [0, -1], [14.0, 15.125, 9.875, 10.25]);
  const restDoorA = addDoor('restroom', 1.8125, 11.0, -Math.PI / 2, [1, 0], [1.75, 2.0, 11.0, 12.0]);
  const restDoorB = addDoor('restroom', 1.8125, 13.75, -Math.PI / 2, [1, 0], [1.75, 2.0, 13.75, 14.75]);
  world.blockers = doors;

  // etched-glass partition panels (frosted cattails), drawn once to a canvas
  const etchCanvas = document.createElement('canvas'); etchCanvas.width = 512; etchCanvas.height = 96;
  {
    const g = etchCanvas.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 512, 96);
    g.strokeStyle = 'rgba(235,240,240,0.75)'; g.fillStyle = 'rgba(235,240,240,0.8)'; g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 512, h = 30 + Math.random() * 55, lean = (Math.random() - 0.5) * 40;
      g.lineWidth = 2 + Math.random() * 3;
      g.beginPath(); g.moveTo(x, 96); g.quadraticCurveTo(x + lean * 0.3, 96 - h * 0.6, x + lean, 96 - h); g.stroke();
      if (Math.random() < 0.18) { g.beginPath(); g.ellipse(x + lean * 0.9, 96 - h + 4, 3, 9, lean * 0.01, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = 'rgba(235,240,240,0.35)'; g.fillRect(0, 84, 512, 12);
  }
  const etchTex = new THREE.CanvasTexture(etchCanvas); etchTex.colorSpace = THREE.SRGBColorSpace; etchTex.wrapS = THREE.RepeatWrapping;
  for (const e of meta.etched) {
    const t = etchTex.clone(); t.needsUpdate = true; t.repeat.set((e.x1 - e.x0) / 2.2, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(e.x1 - e.x0, e.y1 - e.y0),
      new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xd8dcdc }));
    m.position.set((e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, e.z); m.renderOrder = 3;
    scene.add(m);
  }

  const clock = Props.clockFace().mesh(litMat, emitMat); clock.position.set(14.56, 2.85, 10.0); scene.add(clock);
  const handMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
  const mkHand = (len, w) => { const g = new THREE.BoxGeometry(w, len, 0.02); g.translate(0, len / 2 - 0.02, 0); const m = new THREE.Mesh(g, handMat); m.position.set(14.56, 2.85, 10.0 - 2 / 16 - 0.02); scene.add(m); return m; };
  const hourHand = mkHand(0.16, 0.035), minHand = mkHand(0.24, 0.025);

  const flag = Props.flagBig().mesh(litMat, emitMat);
  flag.position.set(13.6, 5.15, -0.15); flag.rotation.y = Math.PI / 2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9), new THREE.MeshLambertMaterial({ color: 0x9a9890 }));
  pole.rotation.x = Math.PI / 2; pole.position.set(13.6, 5.17, -0.8); scene.add(pole);
  scene.add(flag);

  // TV flicker in a few apartment windows
  const tvs = meta.tvs.slice(0, 5).map((t) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(t.w * 0.8, t.h * 0.7), new THREE.MeshBasicMaterial({ color: 0x4060ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const off = t.dir < 0 ? 0.12 : -0.12;
    if (t.axis === 'z') m.position.set(t.u, t.y, t.plane + off);
    else { m.position.set(t.plane + off, t.y, t.u); m.rotation.y = Math.PI / 2; }
    scene.add(m); return m;
  });

  // traffic signals
  const lampGeo = new THREE.BoxGeometry(0.04, 0.17, 0.17);
  const signals = meta.signals.map((s) => s.y.map((y) => {
    const m = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
    m.position.set(s.x, y, s.z + 0.0); scene.add(m); return m;
  }));
  const SIG = { cycle: 34, green: 14, yellow: 3 };
  const sigState = (t) => { const p = t % SIG.cycle; return p < SIG.green ? 'green' : p < SIG.green + SIG.yellow ? 'yellow' : 'red'; };

  // cars
  const carKinds = ['taxi', 'taxi', 'navy', 'taxi', 'maroon'];
  const carModels = { taxi: Props.car('taxi'), navy: Props.car('navy'), maroon: Props.car('maroon') };
  const parked = carModels.navy.mesh(litMat, emitMat); parked.position.set(30.5, 0, -10.2); parked.rotation.y = Math.PI; scene.add(parked);
  const parked2 = carModels.maroon.mesh(litMat, emitMat); parked2.position.set(25.5, 0, -10.2); parked2.rotation.y = Math.PI; scene.add(parked2);
  const cars = []; let carId = 0, nextCar = 2, nextAve = 1;
  const spawnCar = (avenue) => {
    const kind = carKinds[Math.floor(Math.random() * carKinds.length)];
    const mesh = carModels[kind].mesh(litMat, emitMat);
    const c = { id: carId++, mesh, avenue, speed: 7 + Math.random() * 3, v: 0 };
    if (!avenue) { c.lane = L.lanes[Math.floor(Math.random() * 2)]; c.s = 48; c.dir = -1; mesh.position.set(c.s, 0, c.lane); c.v = c.speed; }
    else { const north = Math.random() < 0.5; c.dir = north ? 1 : -1; c.lane = north ? L.avenueLanes[0] : L.avenueLanes[1]; c.s = north ? -60 : 60; mesh.rotation.y = north ? Math.PI / 2 : -Math.PI / 2; mesh.position.set(c.lane, 0, c.s); c.v = c.speed; }
    scene.add(mesh); cars.push(c);
  };

  // ---------------------------------------------------------------- player, audio, post
  const player = new Player(camera, world, renderer.domElement);
  const audio = new Ambience();
  player.onStep = () => audio.step(indoor);
  const { composer, bloom, grade, outline } = makeComposer(renderer, scene, camera);
  const resize = () => {
    if (!innerWidth || !innerHeight) return;
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    street.getRenderTarget().setSize(Math.max(256, innerWidth * 0.5), Math.max(256, innerHeight * 0.5));
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    grade.uniforms.res.value.set(innerWidth, innerHeight);
  };
  addEventListener('resize', resize); resize();

  // ---------------------------------------------------------------- UI
  const overlay = $('overlay');
  const dev = location.hash === '#dev';
  if (dev) overlay.classList.add('hidden');
  let arrived = false, paused = false, net = null, coop = null, introShown = false;
  // step into the diner (or back in after a pause); must run from a click, for pointer lock
  const enter = () => {
    audio.start();
    if (!arrived) {
      arrived = true;
      audio.clickSound();
      if (!coop || coop.isHost) shift.start(1);
    }
    lock();
  };
  // playing = mouse captured (desktop) or touch controls live (phone); otherwise a menu is up
  let touchUI = null;
  const lock = () => (touchUI ? setPlaying(true) : renderer.domElement.requestPointerLock?.()?.catch?.(() => {})); // a refused lock just leaves the menu up
  const unlock = () => (touchUI ? setPlaying(false) : document.exitPointerLock?.());
  // back to the main menu (a co-op host quitting closes the diner for everyone)
  const quit = () => { if (net) net.close(); location.reload(); };
  document.addEventListener('pointerlockchange', () => setPlaying(document.pointerLockElement === renderer.domElement));
  function setPlaying(locked) {
    player.locked = locked;
    if (touchUI && !locked) touchUI.reset();
    if (locked) document.body.classList.remove('summary');
    overlay.classList.toggle('hidden', locked);
    document.body.classList.toggle('playing', locked);
    if (!locked) interactions.clear();
    if (!locked && arrived && !document.body.classList.contains('summary'))
      menu.show('pause', { clock: clockText(shift.minutes).toLowerCase(), coop: !!coop, isHost: !!(coop && coop.isHost), pausePanel: null });
    // full pause once you've come in (solo only: in co-op the diner keeps going for everyone else)
    paused = arrived && !locked && !coop && !dev;
    if (audio.ctx) { if (paused) audio.ctx.suspend(); else audio.ctx.resume(); }
    if (locked && !introShown) { introShown = true; setTimeout(() => $('intro').classList.add('gone'), 9000); }
  }
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && audio.ctx) { audio.musicOn = !audio.musicOn; toast(audio.musicOn ? 'jukebox on' : 'jukebox off'); }
  });
  const toast = (t) => { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200); };
  const pop = (t) => { const el = $('pop'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2400); };

  // ---------------------------------------------------------------- things you can click
  const interactions = new Interactions(camera, world, $('hint'));
  if (touchDevice) {
    // phones: left thumb walks, right thumb looks, tap to use; buttons for pause and put away
    touchUI = new TouchControls({ player, interactions, onPause: () => setPlaying(false), onDrop: () => service.request('drop'), canDrop: () => service.hands.length > 0 });
    $('intro').textContent = 'left thumb walks · drag on the right to look · tap to use things';
  }
  interactions.attach(outline);
  addEventListener('mousedown', (e) => { if (player.locked && e.button === 0) interactions.click(); });
  for (const [di, [d, name, box]] of [
    [frontDoor, 'door', [13.375, 1.3, -3.25, 0.65, 1.1, 0.25]],
    [kitchenDoor, 'kitchen door', [14.56, 1.2, 10.06, 0.6, 1.1, 0.25]],
    [restDoorA, 'restroom door', [1.875, 1.1, 11.5, 0.25, 1.1, 0.5]],
    [restDoorB, 'restroom door', [1.875, 1.1, 14.25, 0.25, 1.1, 0.5]],
  ].entries()) {
    d.onAutoClose = () => audio.doorSound(false);
    interactions.add(() => d.box(), () => (d.open ? 'Close ' : 'Open ') + name, () => {
      if (d.open && d.playerInDoorway(player.pos)) { toast('step out of the doorway first'); return; }
      if (coop && coop.door(di)) return;
      const r = d.toggle(player.pos);
      audio.doorSound(r === 'open');
      if (r === 'open' && d.bell) audio.doorBell();
    });
  }
  // faucets: a little stream of water + positional running-water sound
  const waters = [];
  const streamMat = new THREE.MeshLambertMaterial({ color: 0xb8d8ec, transparent: true, opacity: 0.55, emissive: 0x203040 });
  const addFaucet = (sx, sy0, sy1, sz, box, label) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.025, sy0 - sy1, 0.025), streamMat);
    mesh.position.set(sx, (sy0 + sy1) / 2, sz); mesh.visible = false; scene.add(mesh);
    const w = { mesh, h: null };
    waters.push(w);
    interactions.add(box, () => (w.h && w.h.on ? 'Turn off the ' : 'Turn on the ') + label, () => {
      if (!w.h) w.h = audio.water([sx, sy1, sz]);
      if (w.h) { w.h.on = !w.h.on; audio.clickSound(); }
    });
  };
  for (const rz0 of [10.25, 13.125]) addFaucet(3.1, 1.12, 1.0, rz0 + 0.33, [3.1, 1.05, rz0 + 0.27, 0.32, 0.16, 0.26], 'water');
  addFaucet(5.46, 1.55, 0.75, 12.3, [5.32, 1.45, 12.3, 0.09, 0.14, 0.12], 'water');
  for (const [tz] of [[12.45], [15.2]]) interactions.add([4.49, 0.6, tz, 0.4, 0.45, 0.3], () => 'Flush', () => audio.flush());
  for (const rz0 of [10.25, 13.125]) interactions.add([4.0, 1.25, rz0 + 0.1, 0.16, 0.16, 0.14], () => 'Dry your hands', () => audio.dryer());
  interactions.add([6.2, 1.12, 9.75, 0.22, 0.16, 0.14], () => (audio.musicOn ? 'Turn the radio off' : 'Turn the radio on'), () => {
    audio.musicOn = !audio.musicOn; audio.clickSound(); toast(audio.musicOn ? 'radio on' : 'radio off');
  });
  interactions.add([15.4, 0.75, -0.5, 0.2, 0.5, 0.2], () => 'Get a gumball', () => { audio.gumball(); toast('a red one. nice.'); });
  interactions.add([12.3, 1.12, -3.0, 0.28, 0.16, 0.16], () => 'Pet the cat', () => { audio.purr(); toast('purrrr'); });
  interactions.add([1.0, 1.2, 15.65, 0.65, 1.0, 0.15], () => 'Exit', () => { audio.rattle(); toast("it's locked. it's raining anyway."); });
  interactions.add([15.68, 1.25, 11.6, 0.12, 1.0, 0.62], () => 'Walk-in cooler', () => { audio.rattle(); toast('brr. not tonight.'); });
  {
    const tvOff = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.56), new THREE.MeshBasicMaterial({ color: 0x050506 }));
    tvOff.position.set(15.685, 2.45 + 11 / 32, 8.4); tvOff.rotation.y = -Math.PI / 2; tvOff.visible = false; scene.add(tvOff);
    interactions.add([15.7, 2.8, 8.4, 0.1, 0.36, 0.58], () => (tvOff.visible ? 'Turn the TV on' : 'Turn the TV off'), () => { tvOff.visible = !tvOff.visible; audio.clickSound(); });
  }

  // ---------------------------------------------------------------- customers + seats
  const isInside = (x, z) => x > L.inside.x0 && x < L.inside.x1 && z > L.inside.z0 && z < L.inside.z1;
  const crowd = new Crowd({ scene, world, seats: batch.seats, doors, litMat, emitMat, audio, player, inside: isInside });
  scene.add(camera); // so things held in your hands render
  const service = new Service({ scene, camera, crowd, audio, interactions, toast, litMat, emitMat, player, batch,
    ui: { orders: $('orders') } });
  service.onPop = pop;
  addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && player.locked) service.request('drop'); });
  // shifts: waves of customers, a clock with an end in sight, and a stats card between shifts
  const money = (v) => `$${v.toFixed(2)}`;
  const showSummary = (r, canStart) => {
    menu.addShift(r.tips);
    const extra = [r.walkouts && `${r.walkouts} walked out`, r.burnt && `${r.burnt} burnt`, r.washed && `${r.washed} dishes washed`].filter(Boolean).join(' · ');
    $('summary').innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div class="when hand">${r.closedAt} · shift ${r.n}</div>
        <div class="closed neon amber">CLOSED</div>
        <div class="stars">${'★'.repeat(r.stars)}<i>${'★'.repeat(5 - r.stars)}</i></div></div>
      <div class="stats">
        <div class="stat glass"><b>${r.fed}</b><span>people fed</span></div>
        <div class="stat glass"><b>${money(r.earned)}</b><span>earned</span></div>
        <div class="stat glass"><b>${money(r.tips)}</b><span>in tips</span></div></div>
      ${extra ? `<div class="small">${extra}</div>` : ''}
      ${r.unlock ? `<div class="unlock"><div class="ic">✦</div><div><b>new: ${r.unlock.name.toLowerCase()}</b><span>${r.unlock.text}</span></div></div>` : ''}
      <div class="actions">${canStart ? '<button class="pill-btn" data-act="again">open up again</button>' : '<button class="pill-btn" disabled>waiting for the host…</button>'}
        <button class="text-btn" data-act="home">${coop && coop.isHost ? 'close the diner' : 'head home'}</button></div>`;
    const again = $('summary').querySelector('[data-act="again"]');
    if (again) again.onclick = () => { shift.start(r.n + 1); lock(); };
    $('summary').querySelector('[data-act="home"]').onclick = quit;
    document.body.classList.add('summary');
    audio.kaching();
    unlock();
  };
  const shift = new Shift({ service, crowd, audio, toast, ui: { schedule: $('schedule') }, onEnd: (r) => {
    if (coop) net.send({ t: 'summary', r: { ...r, unlock: r.unlock && { name: r.unlock.name, text: r.unlock.text } } });
    showSummary(r, true);
  } });
  shift.players = () => (coop && net ? Math.max(1, net.players.length) : 1);
  shift.onStart = (n) => { if (coop && coop.isHost) net.send({ t: 'shiftStart', n }); };
  if (dev) shift.start(1);

  // ---------------------------------------------------------------- main menu + co-op
  const leaveWith = (why) => { try { sessionStorage.setItem('cozyDiner.notice', why); } catch {} location.reload(); };
  const beginCoop = () => {
    if (coop) return;
    coop = new Coop({ net, service, crowd, shift, player, scene, litMat, emitMat, doors, audio, toast,
      onSummary: (r) => showSummary(r, false),
      onShiftStart: (n) => { document.body.classList.remove('summary'); if (!player.locked && n > 1) menu.show('ready', { readyNote: `shift ${n} · ${shift.range.toLowerCase()}`, readyTitle: 'back to work', readyItem: 'clock in' }); },
      onHostLeft: (why) => leaveWith(why) });
    // everyone starts behind the counter by the kitchen door, in a row
    const k = Math.max(0, net.players.findIndex((p) => p.id === net.id));
    player.pos.z -= k * 0.6;
    if (!net.isHost) menu.show('ready', { readyNote: `${net.nameOf(net.players.find((p) => p.host)?.id)} opened up`, readyTitle: 'the diner is open', readyItem: 'clock in' });
  };
  const sentBegin = new Set();
  const wireNet = () => {
    net.onLobby = (players) => {
      if (!coop) menu.show('lobby', { players });
      if (coop) coop.syncAvatars();
      // someone joined after we opened: let them in
      if (net.isHost && coop) for (const p of players) if (p.id !== net.id && !sentBegin.has(p.id)) { sentBegin.add(p.id); net.sendTo(p.id, { t: 'begin' }); }
    };
    net.on('begin', () => { if (!net.isHost) beginCoop(); });
    net.onClose = (why) => leaveWith(why);
  };
  const applySettings = (st) => { audio.musicVol = st.radio; audio.rainVol = st.rain; player.sens = 0.0008 + st.look * 0.0028; };
  applySettings(menu.profile.settings);
  menu.h = {
    onSolo: () => enter(),
    onHost: async () => {
      menu.show('connecting');
      for (let tries = 0; tries < 5 && !net; tries++) {
        const n = new Net();
        try { await n.connect(newCode(), 'host', menu.profile); net = n; }
        catch (e) { if (!/taken/.test(e.message)) return menu.show('main', { notice: e.message }); }
      }
      if (!net) return menu.show('main', { notice: "couldn't get a game code, try again" });
      wireNet();
      menu.show('lobby', { code: net.code, isHost: true, players: net.players });
    },
    onJoin: async (code) => {
      menu.show('join', { busy: true, error: null });
      const n = new Net();
      try { await n.connect(code, 'join', menu.profile); } catch (e) { return menu.show('join', { busy: false, error: e.message }); }
      net = n; menu.busy = false; wireNet();
      menu.show('lobby', { code, isHost: false, players: net.players });
    },
    onStart: () => {
      for (const p of net.players) sentBegin.add(p.id);
      net.send({ t: 'begin' });
      beginCoop(); enter();
    },
    onCloseUp: quit,
    onResume: () => enter(),
    onQuit: quit,
    onSettings: applySettings,
  };
  // the diner is built: off the loading screen and onto the main menu (or straight to a friend's code from a shared link)
  let notice = null;
  try { notice = sessionStorage.getItem('cozyDiner.notice'); sessionStorage.removeItem('cozyDiner.notice'); } catch {}
  const joinCode = (new URLSearchParams(location.search).get('join') || '').toUpperCase();
  if (joinCode) { history.replaceState(null, '', location.pathname); menu.show('join', { code: joinCode, notice: null }); }
  else menu.show('main', { notice });
  for (const seat of batch.seats) {
    interactions.add([seat.x, seat.y - 0.1, seat.z, 0.24, 0.3, 0.24], () => 'Sit down', () => {
      player.sitOn(seat); audio.clickSound(); toast('take a load off · walk to stand up');
    }, () => !seat.occupant && !player.seated);
  }

  // ---------------------------------------------------------------- loop
  let indoor = 1, last = performance.now(), time = 0, nextFlash = 25 + Math.random() * 30, flash = 0;
  const jukePos = new THREE.Vector3(6.2, 1.2, 9.75); // the radio on the back bar
  const tmp = new THREE.Vector3();

  // A co-op host keeps the diner running even when their tab is in the background (browsers pause
  // requestAnimationFrame there). A worker's timer isn't paused, so it drives the game logic, without drawing.
  {
    let bgLast = performance.now();
    const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 100)'], { type: 'text/javascript' })));
    ticker.onmessage = () => {
      const now = performance.now(), dt = Math.min(0.25, (now - bgLast) / 1000); bgLast = now;
      if (!document.hidden || !coop || !coop.isHost) return;
      crowd.update(dt); service.update(dt); shift.update(dt);
      for (const d of doors) d.update(dt, [player.pos, ...crowd.positions(), ...crowd.others]);
      coop.update(dt);
    };
  }

  function tick(now) {
    if (paused) { last = now; requestAnimationFrame(tick); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    player.update(dt);
    const p = player.pos;

    // inside-ness
    const I = L.inside, inside = p.x > I.x0 && p.x < I.x1 && p.z > I.z0 && p.z < I.z1;
    const target = inside ? (Math.abs(frontDoor.a) > 0.3 ? 0.8 : 1) : 0;
    indoor += (target - indoor) * Math.min(1, dt * 3);

    // the diner waits for you: nothing ticks behind the menu
    // (a hidden co-op host is run by the background ticker instead, so don't double up)
    const bgHost = document.hidden && coop && coop.isHost;
    if ((arrived || dev || (coop && !coop.isHost)) && !bgHost) { crowd.update(dt); service.update(dt); shift.update(dt); }
    if (coop) coop.update(dt);
    const agents = [player.pos, ...crowd.positions(), ...crowd.others];
    for (const d of doors) d.update(dt, coop && !coop.isHost ? null : agents); // guests: the host decides when doors close
    if (player.locked) interactions.update();
    if (touchUI) touchUI.update();
    for (const w of waters) { w.mesh.visible = w.h && w.h.on; if (w.mesh.visible) w.mesh.scale.x = 0.8 + Math.random() * 0.4; }

    // clock, flag
    // the wall clock keeps shift time
    const gm = 22 * 60 + shift.minutes, hrs = (gm / 60) % 12, mins = gm % 60;
    hourHand.rotation.z = -hrs / 12 * Math.PI * 2; minHand.rotation.z = -mins / 60 * Math.PI * 2;
    flag.rotation.x = Math.sin(time * 0.7) * 0.05;
    tvs.forEach((m, i) => { const n = Math.sin(time * 7 + i * 3) * Math.sin(time * 2.3 + i) + Math.sin(time * 17 + i * 5) * 0.3; m.material.color.setRGB(0.12 + n * 0.05, 0.18 + n * 0.06, 0.45 + n * 0.15); });

    // traffic signals
    const st = sigState(time + 6);
    for (const s of signals) {
      s[0].material.color.setHex(st === 'red' ? 0xff2a2a : 0x220606);
      s[1].material.color.setHex(st === 'yellow' ? 0xffb020 : 0x221606);
      s[2].material.color.setHex(st === 'green' ? 0x30ffa0 : 0x062214);
      s.forEach((m) => m.material.color.multiplyScalar(m.material.color.r + m.material.color.g > 0.3 ? 4 : 1));
    }
    signalLight.color.setHex(st === 'red' ? 0xff2020 : st === 'yellow' ? 0xffa020 : 0x20ff90);
    const aveGo = st === 'red' && (time + 6) % SIG.cycle < SIG.cycle - 2;

    // cars
    nextCar -= dt; nextAve -= dt;
    if (nextCar < 0) { spawnCar(false); nextCar = 5 + Math.random() * 11; }
    if (nextAve < 0 && aveGo) { spawnCar(true); nextAve = 3 + Math.random() * 6; }
    let nearest = null, nd = 1e9;
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      let target = c.speed;
      if (!c.avenue) {
        const toStop = c.s - (L.stopX + 2.3);
        if (st !== 'green' && toStop > -0.5 && toStop < 28) target = Math.min(target, Math.max(0, toStop - 0.3) * 0.9);
        for (const o of cars) if (o !== c && !o.avenue && o.lane === c.lane && o.s < c.s && c.s - o.s < 9) target = Math.min(target, Math.max(0, (c.s - o.s - 5.5) * 1.2));
        if (Math.abs(p.z - c.lane) < 1.3 && p.x < c.s && c.s - p.x < 7) target = 0;
      } else {
        const toStop = c.dir > 0 ? (-13.8 - c.s) : (c.s - 2.8);
        if (!aveGo && toStop > -0.5 && toStop < 20) target = Math.min(target, Math.max(0, toStop - 0.3) * 0.9);
        for (const o of cars) if (o !== c && o.avenue && o.lane === c.lane && (o.s - c.s) * c.dir > 0 && (o.s - c.s) * c.dir < 9) target = Math.min(target, Math.max(0, (Math.abs(o.s - c.s) - 5.5) * 1.2));
      }
      c.v += (target - c.v) * Math.min(1, dt * (target < c.v ? 2.5 : 0.8));
      c.s += c.dir * c.v * dt;
      if (!c.avenue) c.mesh.position.set(c.s, 0, c.lane); else c.mesh.position.set(c.lane, 0, c.s);
      const dist = c.mesh.position.distanceTo(tmp.set(p.x, 0, p.z));
      if (dist < nd) { nd = dist; nearest = c; }
      const snd = audio.carSound(c.id, true);
      if (snd) {
        const loud = Math.min(1, 9 / (1 + dist * dist * 0.08)) * Math.min(1, c.v / 6) * (1 - indoor * 0.55);
        audio.set(snd.g.gain, loud * 0.5, 0.1);
        audio.set(snd.f.frequency, 500 + c.v * 60 + (1 - indoor) * 400, 0.1);
        const rel = tmp.set(c.mesh.position.x - p.x, 0, c.mesh.position.z - p.z);
        const right = Math.cos(player.yaw) * rel.x - Math.sin(player.yaw) * rel.z;
        audio.set(snd.p.pan, THREE.MathUtils.clamp(right / 8, -1, 1), 0.1);
      }
      if ((!c.avenue && c.s < -40) || (c.avenue && Math.abs(c.s) > 62)) { scene.remove(c.mesh); audio.carSound(c.id, false); cars.splice(i, 1); }
    }
    if (nearest && !nearest.avenue) {
      carLight.position.set(nearest.s - 3.2, 0.8, nearest.lane + 1.0);
      carLight.intensity = THREE.MathUtils.clamp(12 - Math.abs(nearest.s - p.x) * 0.4, 0, 12);
    } else carLight.intensity *= 0.9;

    // lightning
    nextFlash -= dt;
    if (nextFlash < 0) { flash = 1; nextFlash = 35 + Math.random() * 60; audio.thunder(1.2 + Math.random() * 2.5, 0.5 + Math.random() * 0.4); }
    const fl = flash > 0 ? flash * (0.6 + 0.4 * Math.sin(time * 60)) : 0;
    flash = Math.max(0, flash - dt * 2.2);
    sky.material.uniforms.flash.value = fl;
    flashLight.intensity = fl * 2.5;
    rain.material.uniforms.flash.value = fl * 0.6;

    // flicker the EAT neon a touch
    if (named.eat) named.eat.intensity = 10 * (Math.random() < 0.004 ? 0.3 : 1);

    // shaders
    rain.material.uniforms.time.value = time; rain.material.uniforms.cam.value.copy(camera.position);
    splashes.material.uniforms.time.value = time;
    splashes.material.uniforms.scale.value = innerHeight * renderer.getPixelRatio();
    steam.material.uniforms.time.value = time;
    steam.material.uniforms.scale.value = innerHeight * renderer.getPixelRatio();
    glassMat.uniforms.time.value = time;
    street.material.uniforms.time.value = time;
    grade.uniforms.time.value = time;

    audio.update(dt, {
      indoor, listener: camera.position, musicDist: camera.position.distanceTo(jukePos), sizzleDist: Math.hypot(p.x - 10.15, p.z - 15.2),
      underAwning: !inside && ((p.z > -3.8 && p.z < -3.3 && p.x > -0.4 && p.x < 16) || (p.z > -1.0 && p.x > 16 && p.x < 22)),
    });

    if (innerWidth && innerHeight) composer.render(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__diner = { scene, camera, player, renderer, world, composer, bloom, named, interactions, doors, audio, crowd, service, shift, get coop() { return coop; }, get net() { return net; }, menu };
}

boot().catch((e) => { console.error(e); status('something spilled: ' + e.message); });
