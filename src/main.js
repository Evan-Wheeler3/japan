import * as THREE from 'three';
import { World, buildWorld, L } from './world.js';
import { PropBatch } from './voxel.js';
import * as Props from './props.js';
import { makeSky, makeSnow, makeGlassMaterial, makeSteam, makeBackdrop, makeComposer, hazeColor, sunDir, FUJI, FOG_COLOR, FOG_DENSITY } from './effects.js';
import { Player } from './player.js';
import { Ambience } from './audio.js';
import { Interactions, Door } from './interact.js';
import { Crowd } from './npc.js';
import { Service } from './service.js';
import { Shift, clockText, START_HOUR, UNLOCKS } from './shift.js';
import { loadSave, writeSave, clearSave, CATALOG, STATION_UPS, itemById, applyUpgrades, ownedGames, Home } from './home.js';
import { Staff } from './staff.js';
import { Chores } from './chores.js';
import { Arcade } from './arcade.js';
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
  scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), FOG_DENSITY);
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 1600);

  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const emitMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  // the menus come up first (on the loading screen); their buttons are wired once the shop is built
  const menu = new Menu($('screen'), $('overlay'), litMat, emitMat, {});
  menu.touch = touchDevice;

  // ---------------------------------------------------------------- world
  status('shoveling the path…'); await frame();
  const T0 = performance.now();
  const world = new World();
  const meta = buildWorld(world);
  const T1 = performance.now();
  status('setting out the cushions…'); await frame();
  const batch = new PropBatch(world);
  Props.placeProps(batch);
  status('lighting the lanterns…'); await frame();
  scene.add(world.mesh(litMat, emitMat));
  scene.add(batch.build(litMat, emitMat));
  console.log(`[yoake] build ${(T1 - T0) | 0}ms, mesh+props ${(performance.now() - T1) | 0}ms`);
  const backdrop = makeBackdrop(); scene.add(backdrop);
  const sky = makeSky(); scene.add(sky);

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0x4a5884, 0x2a1a12, 3.0); scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x30283a, 8.0); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffb080, 0); scene.add(sun, sun.target);
  // There are more lamps than it's cheap to light with, so a fixed pool of point lights follows you:
  // each frame the pool takes the lamps nearest the camera (a fixed count, so shaders never recompile).
  const named = {};
  const lamps = meta.lights.map((l) => ({ ...l, mul: 1, v: new THREE.Vector3(...l.pos) }));
  for (const l of lamps) named[l.name] = l;
  const POOL = 18;
  const pool = Array.from({ length: Math.min(POOL, lamps.length) }, () => { const pl = new THREE.PointLight(0, 0, 1, 2); scene.add(pl); return pl; });
  const assignLamps = () => {
    const cam = camera.position;
    for (const l of lamps) l.score = l.v.distanceTo(cam) - l.distance * 0.6;
    const pick = [...lamps].sort((a, b) => a.score - b.score);
    pool.forEach((pl, i) => { const l = pick[i]; pl.position.copy(l.v); pl.color.setHex(l.color); pl.intensity = l.intensity * l.mul; pl.distance = l.distance; });
  };
  const NIGHT_SKY = new THREE.Color(0x4a5884), NIGHT_GROUND = new THREE.Color(0x2a1a12), DAWN_SKY = new THREE.Color(0xffcbb0), DAWN_GROUND = new THREE.Color(0x8a9ab8);
  const NIGHT_AMB = new THREE.Color(0x30283a), DAWN_AMB = new THREE.Color(0x4a4058);

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

  // ---------------------------------------------------------------- snow, steam
  const snowLights = meta.lights.filter((l) => ['door', 'vending', 'kanban', 'toroA', 'toroB', 'upstairs', 'consL', 'consR'].includes(l.name));
  const snow = makeSnow(7000, snowLights, L.roofDry); scene.add(snow);
  const steam = makeSteam([
    { pos: [6.0, 1.95, 9.65], size: 0.35 }, { pos: [6.6, 1.95, 9.65], size: 0.3 },        // the tea urns on the back bar
    { pos: [11.74, 1.55, 10.98], size: 0.3 },                                                 // the rice cookers by the pass
    { pos: [11.75, 1.6, 15.1], size: 0.7 }, { pos: [13.4, 1.4, 15.1], size: 0.5 },
    { pos: [9.65, 1.3, 15.2], size: 0.9 }, { pos: [10.65, 1.3, 15.2], size: 0.9 }, { pos: [8.1, 1.2, 15.1], size: 0.6 },
    ...meta.steam,
  ]);
  scene.add(steam);

  // ---------------------------------------------------------------- living things
  // the front door and the restroom doors slide into their pockets; the kitchen door swings
  const door = Props.doorModel().mesh(litMat, emitMat);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(15 / 16, 26 / 16), glassMat);
  doorGlass.position.set(9.5 / 16, 22.5 / 16, 0); door.add(doorGlass);
  door.position.set(L.door.hinge, L.floor, L.door.z);
  scene.add(door);
  // doors open away from whoever opens them; closed doors are solid
  const doors = [];
  const frontDoor = new Door(door, { hinge: { x: L.door.hinge, z: L.door.z }, plusDir: [0, -1], max: 1.6, block: [12.75, 14.0, -3.375, -3.125], bell: true, slide: 1.12 });
  doors.push(frontDoor);
  const addDoor = (kind, hx, hz, base, plusDir, block, slide = null, slideDist = 0.95, y = L.floor) => {
    const mesh = Props.swingDoor(kind).mesh(litMat, emitMat);
    mesh.position.set(hx, y, hz); mesh.rotation.y = base; scene.add(mesh);
    const d = new Door(mesh, { hinge: { x: hx, z: hz }, base, plusDir, max: 1.45, block, ...(slide ? { slide: slideDist, slideDir: slide } : {}) }); doors.push(d); return d;
  };
  const kitchenDoor = addDoor('kitchen', 14.0, 10.0625, 0, [0, -1], [14.0, 15.125, 9.875, 10.25]);
  const restDoorA = addDoor('restroom', 1.8125, 11.0, -Math.PI / 2, [1, 0], [1.75, 2.0, 11.0, 12.0], [0, 1]);   // slide along into the wall
  const restDoorB = addDoor('restroom', 1.8125, 13.75, -Math.PI / 2, [1, 0], [1.75, 2.0, 13.75, 14.75], [0, 1]);
  // three doors that open up as the place grows: the hall's back door, the walk-in freezer, the old kura
  const backDoor = addDoor('exit', 0.375, 15.6875, 0, [0, 1], [0.375, 1.625, 15.625, 16.0]);
  const freezerDoor = addDoor('freezer', 15.6875, 11.0, -Math.PI / 2, [1, 0], [15.625, 16.125, 11.0, 12.25]);
  const kuraDoor = addDoor('kura', 23.25, 2.9375, 0, [0, -1], [23.25, 24.75, 2.875, 3.25], [-1, 0], 1.45, 0.5);
  backDoor.locked = freezerDoor.locked = kuraDoor.locked = true;
  backDoor.lockedText = ['Back door (snowed shut)', "a wall of snow on the other side. (the catalog: dig out the back door)"];
  freezerDoor.lockedText = ['Walk-in freezer (switched off)', "the old walk-in's been off for years. (the catalog: get it running)"];
  kuraDoor.lockedText = ['The old kura (boarded up)', "the storehouse is full of junk and cobwebs. (the catalog: restore it)"];
  world.blockers = doors;

  // shoji panels in the partition: paper with a kumiko lattice, drawn once to a canvas
  const shojiCanvas = document.createElement('canvas'); shojiCanvas.width = 256; shojiCanvas.height = 96;
  {
    const g = shojiCanvas.getContext('2d');
    g.fillStyle = 'rgba(255,240,215,0.82)'; g.fillRect(0, 0, 256, 96);
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(200,170,130,${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 96, 1 + Math.random() * 3, 1); }
    g.fillStyle = 'rgba(58,36,20,1)';
    for (let x = 0; x <= 256; x += 32) g.fillRect(x - 2, 0, 4, 96);
    for (let y = 0; y <= 96; y += 24) g.fillRect(0, y - 2, 256, 4);
  }
  const shojiTex = new THREE.CanvasTexture(shojiCanvas); shojiTex.colorSpace = THREE.SRGBColorSpace; shojiTex.wrapS = THREE.RepeatWrapping;
  for (const e of meta.etched) {
    const t = shojiTex.clone(); t.needsUpdate = true; t.repeat.set((e.x1 - e.x0) / 1.4, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(e.x1 - e.x0, e.y1 - e.y0),
      new THREE.MeshLambertMaterial({ map: t, transparent: true, side: THREE.DoubleSide, emissive: 0x3a2410, emissiveMap: t }));
    m.position.set((e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2, e.z); m.renderOrder = 3;
    scene.add(m);
  }

  const clock = Props.clockFace().mesh(litMat, emitMat); clock.position.set(14.56, 2.85, 10.0); scene.add(clock);
  const handMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
  const mkHand = (len, w) => { const g = new THREE.BoxGeometry(w, len, 0.02); g.translate(0, len / 2 - 0.02, 0); const m = new THREE.Mesh(g, handMat); m.position.set(14.56, 2.85, 10.0 - 2 / 16 - 0.02); scene.add(m); return m; };
  const hourHand = mkHand(0.16, 0.035), minHand = mkHand(0.24, 0.025);

  // ---------------------------------------------------------------- player, audio, post
  const player = new Player(camera, world, renderer.domElement);
  const audio = new Ambience();
  player.onStep = () => audio.step(indoor);
  const { composer, bloom, grade, outline } = makeComposer(renderer, scene, camera);
  const resize = () => {
    if (!innerWidth || !innerHeight) return;
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    grade.uniforms.res.value.set(innerWidth, innerHeight);
  };
  addEventListener('resize', resize); resize();

  // ---------------------------------------------------------------- UI
  const overlay = $('overlay');
  const dev = location.hash === '#dev';
  if (dev) overlay.classList.add('hidden');
  let arrived = false, paused = false, net = null, coop = null, introShown = false, catalogOpen = false, arcadeOpen = false;
  // step into the shop (or back in after a pause); must run from a click, for pointer lock
  const enter = () => {
    audio.start();
    if (!arrived) {
      arrived = true;
      audio.clickSound();
      if (!coop || coop.isHost) beginNight(save.night);
      else wakeUp();
    }
    lock();
  };
  // playing = mouse captured (desktop) or touch controls live (phone); otherwise a menu is up
  let touchUI = null;
  const lock = () => (touchUI ? setPlaying(true) : renderer.domElement.requestPointerLock?.()?.catch?.(() => {})); // a refused lock just leaves the menu up
  const unlock = () => (touchUI ? setPlaying(false) : document.exitPointerLock?.());
  // back to the main menu (a co-op host quitting closes the shop for everyone)
  const quit = () => { if (net) net.close(); location.reload(); };
  document.addEventListener('pointerlockchange', () => setPlaying(document.pointerLockElement === renderer.domElement));
  function setPlaying(locked) {
    player.locked = locked;
    if (touchUI && !locked) touchUI.reset();
    if (locked) document.body.classList.remove('summary');
    overlay.classList.toggle('hidden', locked);
    document.body.classList.toggle('playing', locked);
    if (!locked) interactions.clear();
    if (!locked && arcadeOpen) {} // the Fami-Com fills the screen
    else if (!locked && catalogOpen) menu.show('catalog', { catalog: catalogData() });
    else if (!locked && arrived && !document.body.classList.contains('summary'))
      menu.show('pause', { clock: clockText(shift.minutes).toLowerCase(), coop: !!coop, isHost: !!(coop && coop.isHost), pausePanel: null });
    // full pause once you've come in (solo only: in co-op the shop keeps going for everyone else)
    paused = arrived && !locked && !coop && !dev && !sunrise && !arcadeOpen;
    if (audio.ctx) { if (paused && !arcadeOpen) audio.ctx.suspend(); else audio.ctx.resume(); }
    if (locked && !introShown) { introShown = true; setTimeout(() => $('intro').classList.add('gone'), 9000); }
  }
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && audio.ctx) { audio.musicOn = !audio.musicOn; toast(audio.musicOn ? 'radio on' : 'radio off'); }
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
  addEventListener('mousedown', (e) => {
    if (!player.locked) return;
    if (moving && e.button === 2) { endMove(false); return; }
    if (e.button === 0) interactions.click();
  });
  for (const [di, [d, name]] of [
    [frontDoor, 'door'],
    [kitchenDoor, 'kitchen door'],
    [restDoorA, 'restroom door'],
    [restDoorB, 'restroom door'],
    [backDoor, 'back door'],
    [freezerDoor, 'freezer door'],
    [kuraDoor, 'kura door'],
  ].entries()) {
    d.onAutoClose = () => audio.doorSound(false, d.slide);
    interactions.add(() => d.box(), () => (d.locked ? d.lockedText[0] : (d.open ? 'Close the ' : 'Open the ') + name), () => {
      if (d.locked) { audio.rattle(); toast(d.lockedText[1]); return; }
      if (d.open && d.playerInDoorway(player.pos)) { toast('step out of the doorway first'); return; }
      if (coop && coop.door(di)) return;
      const r = d.toggle(player.pos);
      audio.doorSound(r === 'open', d.slide);
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
  for (const rz0 of [10.25, 13.125]) addFaucet(3.1, 1.3, 1.13, rz0 + 0.24, [3.1, 1.2, rz0 + 0.3, 0.34, 0.2, 0.3], 'water'); // the bamboo spouts
  addFaucet(5.46, 1.55, 0.75, 12.3, [5.32, 1.45, 12.3, 0.09, 0.14, 0.12], 'water');
  interactions.add([4.49, 0.6, 12.45, 0.4, 0.45, 0.3], () => 'Flush', () => audio.flush());
  interactions.add([4.3, 0.74, 12.2, 0.14, 0.08, 0.16], () => 'Press the sound princess button', () => { audio.clickSound(); toast('a recording of a babbling brook plays, very politely.'); });
  interactions.add([4.66, 1.5, 14.26, 0.14, 0.22, 0.14], () => 'Pull the chain', () => audio.flush());
  for (const rz0 of [10.25, 13.125]) interactions.add([4.15, 1.1, rz0 + 0.08, 0.22, 0.28, 0.08], () => 'Dry your hands on the tenugui', () => audio.cloth());
  interactions.add([4.3, 1.12, 9.75, 0.22, 0.16, 0.14], () => (audio.musicOn ? 'Turn the radio off' : 'Turn the radio on'), () => {
    audio.musicOn = !audio.musicOn; audio.clickSound(); toast(audio.musicOn ? 'radio on' : 'radio off');
  });
  const cans = ['a hot can of royal milk tea', 'hot corn soup. somehow perfect.', 'a hot can of coffee. it warms your hands.', 'hot lemon. a little treat.'];
  // a hot can warms you up and puts a spring in your step: 1.25x walking speed for two minutes of play
  const BOOST = { mul: 1.25, secs: 120 };
  let boostLeft = 0;
  interactions.add([19.2, 1.2, -2.95, 0.45, 0.6, 0.12], () => (boostLeft > 0 ? 'Buy a hot drink · ¥130 (tops up your boost)' : 'Buy a hot drink · ¥130 · walk 25% faster for 2 min'), () => {
    if (cashBox() < 130) { toast('the cash box is empty. maybe after tonight.'); audio.rattle(); return; }
    if (!save.devYen) { save.yen -= 130; writeSave(save); }
    boostLeft = BOOST.secs; player.speedMul = BOOST.mul;
    audio.vend(); toast(`${cans[Math.floor(Math.random() * cans.length)]} · +25% speed for 2 minutes`);
  });
  interactions.add([12.3, 1.12, -3.0, 0.28, 0.16, 0.16], () => 'Pet the cat', () => { audio.purr(); toast('she stretches one paw. purrrr.'); });

  // ---------------------------------------------------------------- customers + seats
  const isInside = (x, z) => x > L.inside.x0 && x < L.inside.x1 && z > L.inside.z0 && z < L.inside.z1;
  const crowd = new Crowd({ scene, world, seats: batch.seats, doors, litMat, emitMat, audio, player, inside: isInside });
  scene.add(camera); // so things held in your hands render
  const service = new Service({ scene, camera, crowd, audio, interactions, toast, litMat, emitMat, player, batch,
    ui: { orders: $('orders') } });
  service.onPop = pop;
  addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && player.locked && !moving) service.request('drop'); });

  // ---------------------------------------------------------------- the end of the night: the sun comes up over Fuji
  // The view drifts out onto the snowy path in front of the shop and turns to the bay while the sky
  // lightens; the night's card fades in over it.
  // The screen fades to black, then opens on the path by the front door and drifts out toward the bay.
  let sunrise = null;
  const fade = (on, caption = '') => {
    $('fade').classList.toggle('on', on);
    const cap = $('fade').querySelector('.cap'); cap.textContent = caption; cap.classList.toggle('show', !!caption);
  };
  const lookAtBay = (from) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(from, new THREE.Vector3(FUJI.x * 0.5 + 40, 22, FUJI.z * 0.5), new THREE.Vector3(0, 1, 0)));
  const sunriseStart = () => {
    if (sunrise) return;
    const from = new THREE.Vector3(13.4, 1.75, -4.9), to = new THREE.Vector3(6.0, 1.75, -7.4);
    sunrise = { t: 0, t0: performance.now(), from, fromQ: lookAtBay(from), to, toQ: lookAtBay(to), dawn0: dawn, cut: false };
    fade(true);
  };
  const sunriseEnd = () => {
    sunrise = null;
    if (player.seated) player.standUp();
  };

  // ---------------------------------------------------------------- life between nights
  // You wake upstairs each evening; the shop stays closed until you turn the sign by the front door.
  // At dawn you go up to bed and sleep through the short winter day. Progress, yen and what you've
  // bought from the catalog are saved on this device.
  const save = loadSave();
  service.owned = [...save.owned];
  const homeSteam = [];
  // the Fami-Com and the TV it plugs into
  const arcade = new Arcade();
  arcade.hi = { ...(save.hi || {}) };
  arcade.onHi = (id, score) => { save.hi = { ...(save.hi || {}), [id]: score }; writeSave(save); };
  arcade.onSfx = (kind) => audio.chip(kind);
  const home = new Home({ scene, world, litMat, emitMat, interactions, audio, toast, arcade, touch: !!touchUI, layout: save.place,
    addSeat: (seat) => addSitSpot(seat, seat.local.label || 'Sit by the fire', seat.local.note || 'warm hands. the kettle ticks. · walk to stand up'),
    addLamp: (l) => { const r = { ...l, mul: 1, v: new THREE.Vector3(...l.pos) }; lamps.push(r); named[l.name] = r; return r; },
    addSteam: (src) => { const st = makeSteam([src]); scene.add(st); homeSteam.push(st); return st; } });
  home.onMove = (p) => startMove(p);
  service.layout = home.layout;
  // a piece set down somewhere new: keep it (the host's game stores it for everyone)
  service.onPlace = (key, x, z, rot) => {
    home.moveTo(key, x, z, rot);
    service.layout = home.layout;
    if (!coop || coop.isHost) { save.place = { ...home.layout }; writeSave(save); }
  };
  service.onLayout = (lay) => home.applyLayout(lay);

  // ---- moving furniture upstairs: look at a piece, F (or click a piece with nothing to do) to pick it up;
  // it follows your gaze across the floor; R or the wheel turns it; click sets it down; Esc puts it back.
  let moving = null;
  const footMat = new THREE.MeshBasicMaterial({ color: 0x60ff90, transparent: true, opacity: 0.35, depthWrite: false });
  const foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), footMat); foot.rotation.x = -Math.PI / 2; foot.visible = false; foot.renderOrder = 8; scene.add(foot);
  const startMove = (p) => {
    if (moving || !p || player.pos.y < 3 || player.seated) return;
    home.unmark(p);
    moving = { p, from: [p.x, p.z, p.rot], x: p.x, z: p.z, rot: p.rot, ok: true };
    interactions.clear(); audio.clickSound();
  };
  const endMove = (commit) => {
    if (!moving) return;
    const m = moving; moving = null; foot.visible = false;
    if (commit && m.ok) {
      home.pose(m.p, ...m.from); home.mark(m.p); // the real move goes through the host
      service.request('placePiece', m.p.key, m.x, m.z, m.rot);
      if (coop && !coop.isHost) service.onPlace(m.p.key, m.x, m.z, m.rot); // show it at once; the host's copy follows
      audio.doorSound(false, true);
    } else { home.pose(m.p, ...m.from); home.mark(m.p); }
  };
  const updateMove = () => {
    const m = moving;
    if (player.pos.y < 3 || !player.locked) { endMove(false); return; }
    const o = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3());
    if (d.y < -0.05) {
      const t = (3.75 - o.y) / d.y;
      if (t > 0 && t < 6) { m.x = Math.round((o.x + d.x * t) * 8) / 8; m.z = Math.round((o.z + d.z * t) * 8) / 8; }
    }
    m.ok = home.fits(m.p, m.x, m.z, m.rot, player.pos);
    home.pose(m.p, m.x, m.z, m.rot);
    const [x0, x1, z0, z1] = home.rect(m.p, m.x, m.z, m.rot);
    foot.visible = true; foot.position.set((x0 + x1) / 2, 3.77, (z0 + z1) / 2); foot.scale.set(x1 - x0 + 0.16, z1 - z0 + 0.16, 1);
    footMat.color.setHex(m.ok ? 0x60ff90 : 0xff5050);
    const hint = $('hint'), txt = hint.querySelector('.txt') || hint;
    const msg = m.ok ? `set down ${m.p.spec.name} · R to turn · Esc to put it back` : `no room there · R to turn · Esc to put it back`;
    if (txt.textContent !== msg) txt.textContent = msg;
    hint.classList.add('show'); $('reticle').classList.toggle('active', m.ok);
  };
  addEventListener('keydown', (e) => {
    if (!player.locked || arcadeOpen) return;
    if (e.code === 'KeyF') { if (moving) endMove(true); else if (interactions.hover && interactions.hover.piece) startMove(interactions.hover.piece); }
    if (moving && e.code === 'KeyR') moving.rot = (moving.rot + 1) % 4;
    if (moving && e.code === 'KeyQ') endMove(false);
  });
  addEventListener('wheel', (e) => { if (moving) moving.rot = (moving.rot + (e.deltaY > 0 ? 1 : 3)) % 4; }, { passive: true });
  // while you carry a piece, a click (or a tap) sets it down instead of using things
  { const use = interactions.click.bind(interactions); interactions.click = () => (moving ? endMove(true) : use()); }
  // phones: buttons to pick up, turn and put back
  if (touchUI) {
    const bar = $('touchbar'), mk = (label, fn) => { const b = document.createElement('button'); b.className = 'glass'; b.textContent = label; b.style.display = 'none';
      b.addEventListener('touchend', (e) => { e.preventDefault(); fn(); }); bar.prepend(b); return b; };
    const bMove = mk('move', () => startMove(interactions.hover && interactions.hover.piece));
    const bTurn = mk('turn', () => { if (moving) moving.rot = (moving.rot + 1) % 4; });
    const bBack = mk('put back', () => endMove(false));
    touchUI.extra = () => {
      bMove.style.display = !moving && interactions.hover && interactions.hover.piece ? '' : 'none';
      bTurn.style.display = bBack.style.display = moving ? '' : 'none';
    };
  }
  // dev: a cash box that never runs out (the ` key, or the switch in settings)
  const setDevYen = (on) => {
    save.devYen = on; writeSave(save); menu.devYen = on;
    toast(on ? 'dev · infinite yen on' : 'dev · infinite yen off');
  };
  menu.devYen = !!save.devYen;
  addEventListener('keydown', (e) => { if (e.code === 'Backquote' && !arcadeOpen) setDevYen(!save.devYen); });
  // the drift against the back door, until you dig it out
  const snowPile = Props.snowPile().mesh(litMat, emitMat); snowPile.position.set(1.0, 0.125, 16.55); scene.add(snowPile);
  const applyProperty = () => {
    const has = (id) => service.owned.includes(id);
    backDoor.locked = !has('backdoor'); freezerDoor.locked = !has('freezer'); kuraDoor.locked = !has('kura');
    snowPile.visible = backDoor.locked;
    crowd.nav.setBlocked([0.25, 1.75, 15.4, 16.6], backDoor.locked);   // guests can't come through a door that's shut
    const back = [1.0, 17.0], i = crowd.spawns.findIndex((s) => s[1] > 16.5);
    if (!backDoor.locked && i < 0) crowd.spawns.push(back); else if (backDoor.locked && i >= 0) crowd.spawns.splice(i, 1);
  };
  const applyAll = () => {
    applyUpgrades(service, service.owned); home.sync(service.owned); applyProperty();
    arcade.owned = ownedGames(service.owned);
    if (home.tvOn && arcade.mode === 'tv' && service.owned.includes('famicom')) arcade.setPower(true, true);
    if (catalogOpen && !player.locked) menu.show('catalog', { catalog: catalogData() });
  };
  service.onOwned = (list) => { service.owned = [...list]; applyAll(); };
  home.tvOn = false;
  home.onTV = () => { home.tvOn = !home.tvOn; arcade.setPower(home.tvOn, service.owned.includes('famicom')); audio.clickSound(); };
  // playing: you sit on the TV's cushion and the game runs on the set itself, framed in front of you
  home.onPlay = () => {
    const tv = home.pieces.get('crt'), seat = tv && tv.seats[0];
    if (!seat) return;
    if (player.seated !== seat) {
      if (seat.occupant) { toast('someone else has the controller'); return; }
      if (player.seated) player.standUp();
      player.sitOn(seat);
    }
    if (!home.tvOn) { home.tvOn = true; arcade.setPower(true, true); }
    arcadeOpen = true; arcade.open(); audio.clickSound();
    document.body.classList.add('arcade');
    unlock(); if (touchUI || !document.pointerLockElement) setPlaying(false);
  };
  const putDownController = () => {
    if (!arcadeOpen) return;
    arcadeOpen = false; arcade.close();
    document.body.classList.remove('arcade');
    setPlaying(false); // back to the pause menu: one click and you're in the room again, still on the cushion
  };
  // while you play, the view settles on the screen: aim at it and narrow the lens until the set fills it
  const tvAim = new THREE.Vector3();
  const frameTV = (dt) => {
    const tv = home.pieces.get('crt'); if (!tv || !tv.screen) return 68;
    tv.screen.getWorldPosition(tvAim);
    const o = camera.position, dx = tvAim.x - o.x, dy = tvAim.y - o.y, dz = tvAim.z - o.z, flat = Math.hypot(dx, dz), dist = Math.hypot(flat, dy);
    const k = Math.min(1, dt * 6);
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, flat);
    let dyaw = yaw - player.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    player.yaw += dyaw * k; player.pitch += (pitch - player.pitch) * k;
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    // the picture is 0.6 x 0.5 m: leave a little of the set showing round it, on any screen shape
    const vNeed = 2 * Math.atan(0.52 / dist), hNeed = 2 * Math.atan((0.56 / dist) / camera.aspect);
    return THREE.MathUtils.radToDeg(Math.max(vNeed, hNeed));
  };
  $('arcade').querySelector('[data-act="putDown"]').onclick = putDownController;
  for (const b of $('arcade').querySelectorAll('[data-k]')) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); arcade.key(b.dataset.k, true); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => arcade.key(b.dataset.k, false));
  }
  addEventListener('keydown', (e) => {
    if (!arcadeOpen) return;
    if (e.code === 'Escape' || e.code === 'KeyQ') { putDownController(); return; }
    if (arcade.key(e.code, true)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { if (arcadeOpen && arcade.key(e.code, false)) e.preventDefault(); });
  applyAll();
  service.onOpenShop = () => { if (shift.openShop()) { audio.doorBell(); } };
  const WAKE = { x: 12.4, z: 2.4, yaw: 0.15 }; // in the bedroom, beside the futon, facing the bay
  const wakeUp = () => {
    if (player.seated) player.standUp();
    const k = coop && net ? Math.max(0, net.players.findIndex((p) => p.id === net.id)) : 0;
    player.pos.set(WAKE.x, 3.75, WAKE.z + k * 0.55); player.yaw = WAKE.yaw; player.pitch = -0.05; player.vel.set(0, 0, 0);
    $('intro').classList.remove('gone');
    $('intro').innerHTML = 'evening. go down and turn the sign by the front door to <b>OPEN</b> · the catalog is on the kotatsu';
    setTimeout(() => $('intro').classList.add('gone'), 12000);
  };
  const beginNight = (n) => {
    for (let i = 0; i < n - 1; i++) if (UNLOCKS[i]) UNLOCKS[i].apply(service); // perks from the nights before
    shift.start(n);
    applyAll();
    wakeUp();
  };
  // after the night's card: sleep, and wake to the next evening
  const sleepUntil = (n) => {
    fade(true, 'you sleep through the short winter day…');
    setTimeout(() => {
      sunriseEnd();
      document.body.classList.remove('summary');
      dawn = 0.3;
      if (!coop || coop.isHost) beginNight(n); else wakeUp();
    }, 1600);
    setTimeout(() => fade(false), 3800);
  };
  // what's in the cash box: the saved yen plus what tonight has taken so far (a co-op guest sees the host's)
  const INFINITE = 999999999; // what the dev switch puts in the cash box
  const cashBox = () => {
    if (coop && !coop.isHost) return service.cashBox || 0;
    if (save.devYen) return INFINITE;
    const tonight = shift.snap && (shift.active || shift.closing) ? service.money - shift.snap.money : 0;
    return save.yen + tonight;
  };
  const catalogData = () => ({
    yen: cashBox(),
    note: coop && !coop.isHost ? 'orders go on the shop\'s cash box' : '',
    items: CATALOG.map((c) => ({ ...c, owned: service.owned.includes(c.id), blocked: !!c.needs && !service.owned.includes(c.needs), needsName: c.needs ? itemById(c.needs).name : '' })),
  });
  // buying runs on the host (or solo): it comes out of the shared cash box and everyone gets the delivery
  const buyItem = (id) => {
    const it = itemById(id);
    if (!it || service.owned.includes(id) || (it.needs && !service.owned.includes(it.needs)) || cashBox() < it.price) return;
    if (!save.devYen) save.yen -= it.price;
    service.owned.push(id); save.owned = [...service.owned]; writeSave(save);
    applyAll(); audio.kaching();
    service.sayAll(it.kind === 'shop' ? `${it.name.toLowerCase()}: ready tonight` : it.kind === 'station' ? `${it.name.toLowerCase()}: installed (${it.short})`
      : it.kind === 'staff' ? `${it.name.replace('Hire a ', '').toLowerCase()} hired: starts tonight` : it.kind === 'property' ? `${it.name.toLowerCase()}: done` : `${it.name.toLowerCase()}: delivered upstairs`);
  };
  service.onBuy = buyItem;
  const openCatalog = () => { catalogOpen = true; unlock(); if (touchUI || !document.pointerLockElement) setPlaying(false); };
  interactions.add([9.25, 4.28, 3.7, 0.16, 0.06, 0.2], () => 'Read the catalog', openCatalog);

  // the little shrine on the west slope: bow twice, clap twice, bow once. Once a day the kami leave ¥100.
  const SHRINE = { x: -7.6, z: 3.0 };
  const guestBowed = new Map(); // co-op guests: pid -> the night they last bowed
  service.onBow = (pid) => {
    const day = save.night;
    const done = pid === service.me ? save.shrine === day : guestBowed.get(pid) === day;
    if (done) { service.say('the snow falls quietly on the hokora. come back tomorrow.', pid); return; }
    if (pid === service.me) save.shrine = day; else guestBowed.set(pid, day);
    if (!save.devYen) save.yen += 100;
    writeSave(save);
    service.sfx('coin', pid);
    service.say('a ¥100 coin glints on the offering box. the kami must like your cooking.', pid);
  };
  let bowing = 0;
  const bow = () => {
    if (bowing) return;
    bowing = performance.now(); player.frozen = true;
    player.yaw = Math.atan2(player.pos.x - SHRINE.x, player.pos.z - SHRINE.z); player.pitch = -0.12; // face the hokora
  };
  const BOW_LEN = 4.4, bowNod = (t) => {
    const dip = (a, b) => (t > a && t < b ? 0.5 - 0.5 * Math.cos(((t - a) / (b - a)) * Math.PI * 2) : 0);
    return Math.max(dip(0.1, 1.0), dip(1.1, 2.0), dip(3.0, 4.2) * 1.1);
  };
  const updateBow = () => {
    if (!bowing) return;
    const t = (performance.now() - bowing) / 1000, prev = updateBow.t ?? 0; updateBow.t = t;
    player.nod = bowNod(t);
    for (const c of [2.3, 2.65]) if (prev < c && t >= c) audio.clap();
    if (t >= BOW_LEN) { bowing = 0; updateBow.t = 0; player.nod = 0; player.frozen = false; service.request('bow'); }
  };
  interactions.add([-7.45, 0.8, 3.0, 0.55, 0.7, 0.62], () => 'Bow at the shrine', bow, () => !bowing && !player.seated);

  // the OPEN / CLOSED sign in the front window by the door
  const signOpen = Props.openSign().mesh(litMat, emitMat), signClosed = Props.closedSign().mesh(litMat, emitMat);
  for (const m of [signOpen, signClosed]) { m.position.set(14.9, 1.55, -3.07); scene.add(m); }
  interactions.add([14.9, 1.7, -3.05, 0.32, 0.2, 0.14], () => (shift.waiting ? 'Turn the sign to OPEN' : shift.active ? 'Open until dawn' : 'Closed'), () => {
    if (shift.waiting) { service.request('openShop'); audio.clickSound(); }
  });

  // nights: waves of customers, a clock with sunrise in sight, and a stats card between nights
  const money = (v) => `¥${Math.round(v).toLocaleString('en-US')}`;
  const showSummary = (r, canStart) => {
    menu.addShift(r.tips);
    sunriseStart();
    const extra = [r.wages && `${money(r.wages)} in staff wages`, r.walkouts && `${r.walkouts} walked out`, r.burnt && `${r.burnt} burnt`, r.washed && `${r.washed} dishes washed`].filter(Boolean).join(' · ');
    $('summary').innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div class="when hand">sunrise · night ${r.n}</div>
        <div class="closed neon amber">YOAKE</div>
        <div class="stars">${'★'.repeat(r.stars)}<i>${'★'.repeat(5 - r.stars)}</i></div></div>
      <div class="stats">
        <div class="stat glass"><b>${r.fed}</b><span>people fed</span></div>
        <div class="stat glass"><b>${money(r.earned)}</b><span>earned</span></div>
        <div class="stat glass"><b>${money(r.tips)}</b><span>in tips</span></div></div>
      ${extra ? `<div class="small">${extra}</div>` : ''}
      ${r.unlock ? `<div class="unlock"><div class="ic">✦</div><div><b>new: ${r.unlock.name.toLowerCase()}</b><span>${r.unlock.text}</span></div></div>` : ''}
      ${!coop || coop.isHost ? `<div class="small">${money(save.yen)} in the cash box · the catalog is on the kotatsu upstairs</div>` : ''}
      <div class="actions">${canStart ? '<button class="pill-btn" data-act="again">go up to bed</button>' : '<button class="pill-btn" disabled>waiting for the host…</button>'}
        <button class="text-btn" data-act="home">${coop && coop.isHost ? 'close the shop' : 'back to the title'}</button></div>`;
    const again = $('summary').querySelector('[data-act="again"]');
    if (again) again.onclick = () => { lock(); sleepUntil(r.n + 1); };
    $('summary').querySelector('[data-act="home"]').onclick = quit;
    document.body.classList.add('summary');
    audio.kaching();
    unlock();
  };
  const shift = new Shift({ service, crowd, audio, toast, ui: { schedule: $('schedule') }, onEnd: (r) => {
    save.night = r.n + 1; save.yen = Math.max(0, save.yen + r.earned); save.owned = [...service.owned]; writeSave(save);
    if (coop) net.send({ t: 'summary', r: { ...r, unlock: r.unlock && { name: r.unlock.name, text: r.unlock.text } } });
    showSummary(r, true);
  } });
  shift.players = () => (coop && net ? Math.max(1, net.players.length) : 1);
  shift.onStart = (n) => { if (coop && coop.isHost) net.send({ t: 'shiftStart', n }); };
  // between nights (the sign still says CLOSED) you can upgrade the kitchen's stations and do the chores
  service.between = () => shift.active && shift.waiting;
  service.isOpen = () => shift.active && !shift.waiting;
  service.stationUps = STATION_UPS;
  service.crew = new Staff({ scene, service, litMat, emitMat });
  service.chores = new Chores({ scene, service, interactions, audio, litMat, emitMat, between: service.between });
  if (dev) { shift.start(1); shift.openShop(); }

  // ---------------------------------------------------------------- main menu + co-op
  const leaveWith = (why) => { try { sessionStorage.setItem('yoake.notice', why); } catch {} location.reload(); };
  const beginCoop = () => {
    if (coop) return;
    coop = new Coop({ net, service, crowd, shift, player, scene, litMat, emitMat, doors, audio, toast,
      onSummary: (r) => showSummary(r, false),
      onShiftStart: (n) => {
        if (sunrise) sunriseEnd();
        if (document.body.classList.contains('summary')) { document.body.classList.remove('summary'); wakeUp(); fade(false); }
        if (!player.locked && n > 1) menu.show('ready', { readyNote: `night ${n} · ${shift.range.toLowerCase()}`, readyTitle: 'another night', readyItem: 'get up' });
      },
      onHostLeft: (why) => leaveWith(why) });
    // everyone wakes up upstairs, side by side
    wakeUp();
    if (!net.isHost) menu.show('ready', { readyNote: `${net.nameOf(net.players.find((p) => p.host)?.id)} opened up`, readyTitle: 'the shop is open', readyItem: 'come in' });
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
  const applySettings = (st) => { audio.musicVol = st.radio; audio.windVol = st.wind; player.sens = 0.0008 + st.look * 0.0028; };
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
    onQuit: quit,
    onSettings: applySettings,
    onResume: () => { catalogOpen = false; enter(); },
    onBuy: (id) => {
      if (coop && !coop.isHost) { service.request('buy', id); return; } // the host's game takes the order
      buyItem(id);
      menu.show('catalog', { catalog: catalogData() });
    },
    onNewGame: () => { clearSave(); location.reload(); },
    onDevYen: () => { setDevYen(!save.devYen); menu.show(menu.screen); },
  };
  // the shop is built: off the loading screen and onto the main menu (or straight to a friend's code from a shared link)
  let notice = null;
  try { notice = sessionStorage.getItem('yoake.notice'); sessionStorage.removeItem('yoake.notice'); } catch {}
  const joinCode = (new URLSearchParams(location.search).get('join') || '').toUpperCase();
  if (joinCode) { history.replaceState(null, '', location.pathname); menu.show('join', { code: joinCode, notice: null }); }
  else { menu.saveInfo = { night: save.night }; menu.show('main', { notice }); }
  for (const seat of batch.seats) {
    interactions.add([seat.x, seat.y - 0.1, seat.z, 0.24, 0.3, 0.24], () => 'Sit down', () => {
      player.sitOn(seat); audio.clickSound(); toast('take a load off · walk to stand up');
    }, () => !seat.occupant && !player.seated);
  }
  // home: the cushions round the kotatsu (and the hearth, once you have one) are yours alone
  function addSitSpot(seat, label, note) {
    return interactions.add(() => [seat.x, seat.y - 0.15, seat.z, 0.3, 0.15, 0.3], () => label, () => {
      player.sitOn(seat); audio.clickSound(); toast(note);
    }, () => !seat.occupant && !player.seated && !moving);
  }
  for (const seat of batch.homeSeats) addSitSpot(seat, 'Sit at the kotatsu', 'toes under the quilt. warm. · walk to stand up');
  interactions.add([13.6, 3.95, 3.3, 0.5, 0.2, 1.0], () => 'Lie down for a minute', () => {
    audio.purr(); toast(shift.waiting ? "you're wide awake. the shop is waiting." : shift.active ? 'just a minute… then back down to the shop.' : 'the futon is still warm.');
  });
  interactions.add([12.5, 4.8, 8.1, 0.2, 0.15, 0.22], () => 'Put the kettle on', () => { audio.pour(); toast('a cup of hojicha, just for you.'); });
  interactions.add([12.0, 4.2, 4.3, 0.22, 0.45, 0.22], () => 'Andon lamp', () => { const l = named.aptBed; l.mul = l.mul > 0.5 ? 0.15 : 1; audio.clickSound(); });

  // the telescope at the front window: you put your eye to the eyepiece and it swings round to Fuji. A round brass
  // field of view, a narrow lens; the mouse pans it slowly, walking steps back.
  let zoom = false, aimFuji = 0;
  const fujiAt = new THREE.Vector3(FUJI.x, FUJI.y + 118, FUJI.z); // the snowy top of the cone
  home.onTelescope = () => { zoom = true; aimFuji = 1.2; document.body.classList.add('scope'); audio.clickSound(); };
  const scopeOff = () => { zoom = false; document.body.classList.remove('scope'); };

  // ---------------------------------------------------------------- loop
  let indoor = 1, last = performance.now(), time = 0, dawn = 0, purseT = 0;
  const radioPos = new THREE.Vector3(4.3, 1.2, 9.75); // the radio on the back bar
  const sunV = new THREE.Vector3(), haze = new THREE.Color(), wind = new THREE.Vector2();
  const mats = backdrop.userData.mats;

  // A co-op host keeps the shop running even when their tab is in the background (browsers pause
  // requestAnimationFrame there). A worker's timer isn't paused, so it drives the game logic, without drawing.
  try {
    let bgLast = performance.now();
    const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 100)'], { type: 'text/javascript' })));
    ticker.onmessage = () => {
      const now = performance.now(), dt = Math.min(0.25, (now - bgLast) / 1000); bgLast = now;
      if (!document.hidden || !coop || !coop.isHost) return;
      crowd.update(dt); service.update(dt); shift.update(dt);
      for (const d of doors) d.update(dt, [player.pos, ...crowd.positions(), ...crowd.others]);
      coop.update(dt);
    };
  } catch (e) { console.warn('[yoake] no background ticker:', e.message); } // some sandboxes refuse blob workers

  // sky, light and haze all follow one number
  function setDawn(d) {
    sunDir(d, sunV);
    hazeColor(d, haze);
    scene.fog.color.copy(haze);
    scene.fog.density = THREE.MathUtils.lerp(FOG_DENSITY, 0.018, THREE.MathUtils.smoothstep(d, 0.5, 1));
    const u = sky.material.uniforms; u.dawn.value = d; u.sun.value.copy(sunV); u.haze.value.copy(haze);
    for (const m of mats) { m.uniforms.dawn.value = d; m.uniforms.sun.value.copy(sunV); m.uniforms.haze.value.copy(haze); }
    const k = THREE.MathUtils.smoothstep(d, 0.4, 1);
    hemi.color.copy(NIGHT_SKY).lerp(DAWN_SKY, k); hemi.groundColor.copy(NIGHT_GROUND).lerp(DAWN_GROUND, k);
    hemi.intensity = THREE.MathUtils.lerp(3.0, 3.6, k);
    ambient.color.copy(NIGHT_AMB).lerp(DAWN_AMB, k); ambient.intensity = THREE.MathUtils.lerp(8.0, 6.0, k);
    sun.intensity = THREE.MathUtils.smoothstep(d, 0.7, 1) * 2.4;
    sun.position.copy(sunV).multiplyScalar(60).add(sun.target.position.set(8, 0, 0));
    snow.material.uniforms.dawn.value = k;
    glassMat.uniforms.dawn.value = k;
  }

  function tick(now) {
    if (paused) { last = now; requestAnimationFrame(tick); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    updateBow();
    if (boostLeft > 0 && (boostLeft -= dt) <= 0) { boostLeft = 0; player.speedMul = 1; toast('the hot drink wears off. back to a steady pace.'); }
    player.update(dt);
    const p = player.pos;

    // inside-ness
    const I = L.inside, inside = p.x > I.x0 && p.x < I.x1 && p.z > I.z0 && p.z < I.z1;
    const target = inside ? (Math.abs(frontDoor.a) > 0.3 ? 0.8 : 1) : 0;
    indoor += (target - indoor) * Math.min(1, dt * 3);

    // the shop waits for you: nothing ticks behind the menu
    // (a hidden co-op host is run by the background ticker instead, so don't double up)
    const bgHost = document.hidden && coop && coop.isHost;
    if ((arrived || dev || (coop && !coop.isHost)) && !bgHost) { crowd.update(dt); service.update(dt); shift.update(dt); }
    if (coop) coop.update(dt);
    const agents = [player.pos, ...crowd.positions(), ...crowd.others];
    for (const d of doors) d.update(dt, coop && !coop.isHost ? null : agents); // guests: the host decides when doors close
    if (moving) updateMove();
    else if (player.locked) interactions.update();
    if (touchUI && touchUI.extra) touchUI.extra();
    if (touchUI) touchUI.update();
    for (const w of waters) { w.mesh.visible = w.h && w.h.on; if (w.mesh.visible) w.mesh.scale.x = 0.8 + Math.random() * 0.4; }

    // the wall clock keeps the night's time
    const gm = START_HOUR * 60 + shift.minutes, hrs = (gm / 60) % 12, mins = gm % 60;
    hourHand.rotation.z = -hrs / 12 * Math.PI * 2; minHand.rotation.z = -mins / 60 * Math.PI * 2;

    // dawn: the clock brings the sky up to the edge of sunrise; the sunrise itself plays out at the end of the night
    if (sunrise) {
      sunrise.t = (now - sunrise.t0) / 1000; // wall-clock, so a slow frame never stalls the sunrise
      if (!sunrise.cut && sunrise.t > 1.0) { sunrise.cut = true; fade(false); }  // behind the fade: cut outside
      if (sunrise.cut) {
        const u = sunrise.t - 1.0, k = THREE.MathUtils.smootherstep(u, 0, 7);
        camera.position.lerpVectors(sunrise.from, sunrise.to, k);
        camera.position.y += Math.sin(Math.min(1, u / 7) * Math.PI) * 0.6;
        camera.quaternion.slerpQuaternions(sunrise.fromQ, sunrise.toQ, k);
        camera.position.x += Math.sin(time * 0.15) * 0.15 * k;
      }
      dawn = THREE.MathUtils.lerp(sunrise.dawn0, 1, THREE.MathUtils.smoothstep(sunrise.t, 1.0, 14));
    } else {
      dawn += ((shift.active || shift.closing ? shift.dawn : 0) - dawn) * Math.min(1, dt * 0.5);
    }
    setDawn(dawn);
    if (arcade.mode !== 'off') arcade.tick(dt);
    if (arcadeOpen) { const h = $('arcade').querySelector('.hint'); if (h.textContent !== arcade.hint) h.textContent = arcade.hint; }

    // the sign, the cash box, the telescope
    signOpen.visible = shift.active && !shift.waiting; signClosed.visible = !signOpen.visible;
    if ((purseT -= dt) < 0) {
      purseT = 0.5;
      const cash = cashBox();
      if (!coop || coop.isHost) service.cashBox = cash;
      const boost = boostLeft > 0 ? ` · ☕ ${Math.floor(boostLeft / 60)}:${String(Math.floor(boostLeft % 60)).padStart(2, '0')}` : '';
      const txt = (cash >= INFINITE ? '¥∞ · dev' : `¥${Math.round(cash).toLocaleString('en-US')}`) + boost;
      if ($('purse').textContent !== txt) $('purse').textContent = txt;
    }
    if (zoom && (player.keys.KeyW || player.keys.KeyA || player.keys.KeyS || player.keys.KeyD || Math.hypot(player.stick.x, player.stick.y) > 0.4 || !player.locked)) scopeOff();
    if (zoom && aimFuji > 0) { // swing the tube round to the mountain
      aimFuji -= dt;
      const o = camera.position, dx = fujiAt.x - o.x, dy = fujiAt.y - o.y, dz = fujiAt.z - o.z;
      let dyaw = Math.atan2(-dx, -dz) - player.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      const k = Math.min(1, dt * 4);
      player.yaw += dyaw * k; player.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) - player.pitch) * k;
    }
    const fov = arcadeOpen ? frameTV(dt) : zoom ? 13 : 68;
    snow.visible = !zoom; // flakes by the window would fill the lens
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
    player.sensMul = zoom ? 0.1 : 1;

    // gusts of wind carry the snow sideways now and then, rising and falling slowly; the snow's drift is the wind
    // added up over time, so a change in the wind changes how the flakes move, never where they all are
    const gust = Math.max(0, Math.sin(time * 0.07) * Math.sin(time * 0.17 + 1.3));
    wind.set(0.25 + gust * 0.9, 0.08 + gust * 0.2);
    const su = snow.material.uniforms;
    su.wind.value.lerp(wind, Math.min(1, dt * 0.3));
    su.drift.value.x = (su.drift.value.x + su.wind.value.x * dt) % 280; su.drift.value.y = (su.drift.value.y + su.wind.value.y * dt) % 280;
    su.time.value = time; su.cam.value.copy(camera.position);

    // lanterns breathe a little
    if (named.door) named.door.mul = 0.92 + Math.sin(time * 2.1) * 0.04 + Math.sin(time * 5.3) * 0.03;
    if (named.toroA) named.toroA.mul = 0.85 + Math.random() * 0.15;
    if (named.toroB) named.toroB.mul = 0.85 + Math.random() * 0.15;
    assignLamps();

    // shaders
    steam.material.uniforms.time.value = time;
    steam.material.uniforms.scale.value = innerHeight * renderer.getPixelRatio();
    glassMat.uniforms.time.value = time;
    sky.material.uniforms.time.value = time;
    mats[mats.length - 1].uniforms.time.value = time; // the sea
    for (const st of homeSteam) { st.material.uniforms.time.value = time; st.material.uniforms.scale.value = innerHeight * renderer.getPixelRatio(); }
    grade.uniforms.time.value = time;

    audio.update(dt, {
      indoor, listener: camera.position, musicDist: Math.min(camera.position.distanceTo(radioPos), home.recordOn ? camera.position.distanceTo(home.recordPos) : Infinity), sizzleDist: Math.hypot(p.x - 10.15, p.z - 15.2), gust, dawn,
    });

    if (innerWidth && innerHeight) composer.render(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__yoake = window.__diner = { scene, camera, player, renderer, world, composer, bloom, named, interactions, doors, audio, crowd, service, shift, menu, save, home, arcade,
    get coop() { return coop; }, get net() { return net; }, get dawn() { return dawn; }, sunriseStart, sunriseEnd, setDawnOverride: (d) => { dawn = d; } };
}

boot().catch((e) => { console.error(e); status('something spilled: ' + e.message); });
