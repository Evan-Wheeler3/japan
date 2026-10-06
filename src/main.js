import * as THREE from 'three';
import { World, L } from './world.js';
import { PropBatch } from './voxel.js';
import * as Props from './props.js';
import { makeSky, makeSnow, makeGlassMaterial, makeSteam, makeComposer, hazeColor, sunDir, FOG_COLOR, FOG_DENSITY } from './effects.js';
import { Player } from './player.js';
import { Ambience } from './audio.js';
import { Interactions, Door } from './interact.js';
import { Crowd } from './npc.js';
import { Service } from './service.js';
import { Shift, clockText, START_HOUR, UNLOCKS, starRow } from './shift.js';
import { loadSave, writeSave, clearSave, CATALOG, STATION_UPS, itemById, applyUpgrades, ownedGames, Home, MILESTONES, reachMilestones, milestoneProgress, milestoneGoal } from './home.js';
import { MiniGames } from './minigames.js';
import { Tutorial } from './tutorial.js';
import { Staff } from './staff.js';
import { Arcade } from './arcade.js';
import { Menu } from './menu.js';
import { Net, newCode } from './net.js';
import { Coop } from './coop.js';
import { TouchControls, isTouch } from './touch.js';
import { Parade } from './survival/mode.js';
import { MAP, setMap } from './maps/index.js';
import { MOUNTAIN } from './maps/mountain.js';
import { TOKYO } from './maps/tokyo.js';

const $ = (id) => document.getElementById(id);
const status = (t) => { const el = document.querySelector('#screen .loading'); if (el) el.textContent = t; };
const frame = () => new Promise((r) => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 60); });

// which map to build: the night parade (and ?map=mountain) are on the mountain; the shop is on the Tokyo street
const paradeNext = (() => { try { const v = sessionStorage.getItem('yoake.parade'); sessionStorage.removeItem('yoake.parade'); return v; } catch { return null; } })();
const MAPS = { mountain: MOUNTAIN, tokyo: TOKYO };
const pickMap = () => {
  const asked = new URLSearchParams(location.search).get('map');
  if (paradeNext) return MOUNTAIN;
  return MAPS[asked] || MAPS.tokyo || MOUNTAIN;
};

async function boot() {
  setMap(pickMap()); Object.assign(L, MAP.L);
  for (const [id, words] of Object.entries(MAP.catalog || {})) Object.assign(itemById(id) || {}, words); // the catalog in this map's words
  // ---------------------------------------------------------------- renderer
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const touchDevice = isTouch();
  renderer.setPixelRatio(Math.min(devicePixelRatio, touchDevice ? 1 : 1.5)); // phones: fewer pixels, steadier frame rate
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  $('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), FOG_DENSITY); // (the map's own density is set once it's chosen, in setDawn)
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
  const meta = MAP.build(world);
  const T1 = performance.now();
  status('setting out the cushions…'); await frame();
  const batch = new PropBatch(world);
  MAP.props(batch);
  status('lighting the lanterns…'); await frame();
  scene.add(world.mesh(litMat, emitMat));
  scene.add(batch.build(litMat, emitMat));
  console.log(`[yoake] build ${(T1 - T0) | 0}ms, mesh+props ${(performance.now() - T1) | 0}ms`);
  const backdrop = MAP.backdrop(); scene.add(backdrop);
  const sky = makeSky(MAP.view.sky); scene.add(sky);
  // the map's own things that aren't voxels: signs, wires, trains (and how they change with the night)
  const deco = MAP.decorate ? MAP.decorate(scene, { meta, audio: null, litMat, emitMat }) : null;

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
  const glassPanes = []; // (the night parade knocks some out)
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
    scene.add(m); glassPanes.push({ g, m });
  }

  // ---------------------------------------------------------------- snow, steam
  const snowLights = meta.lights.filter((l) => MAP.view.snowLights.includes(l.name));
  const snow = makeSnow(7000, snowLights, L.roofDry); scene.add(snow);
  const steam = makeSteam([
    ...MAP.shop.steam,
    ...meta.steam,
  ]);
  scene.add(steam);

  // ---------------------------------------------------------------- living things
  // doors open away from whoever opens them; closed doors are solid. The front door slides into its pocket (its own
  // model); the rest are props.swingDoor kinds, some sliding. Doors with `needs` stay locked until it's bought.
  const doors = [], D = {};
  for (const spec of MAP.shop.doors) {
    let mesh;
    if (spec.front) {
      mesh = Props.doorModel().mesh(litMat, emitMat);
      const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(15 / 16, 26 / 16), glassMat);
      doorGlass.position.set(9.5 / 16, 22.5 / 16, 0); mesh.add(doorGlass);
    } else mesh = Props.swingDoor(spec.kind).mesh(litMat, emitMat);
    mesh.position.set(spec.hinge[0], spec.y ?? L.floor, spec.hinge[1]); mesh.rotation.y = spec.base || 0; scene.add(mesh);
    const d = new Door(mesh, { hinge: { x: spec.hinge[0], z: spec.hinge[1] }, base: spec.base || 0, plusDir: spec.plusDir, max: spec.max || 1.45, block: spec.block, bell: !!spec.bell, y0: spec.y > 1 ? spec.y : 0,
      ...(spec.slide ? { slide: spec.slide } : spec.slideDir ? { slide: spec.slideDist || 0.95, slideDir: spec.slideDir } : {}) });
    d.spec = spec; d.name = spec.name;
    if (spec.needs || spec.opensWith) { d.locked = true; d.lockedText = spec.locked; }
    doors.push(d); D[spec.key] = d;
  }
  const frontDoor = D.front;
  world.blockers = doors;
  // a swinging door opens toward the wall or corner beside it, where it lies flat out of the way, never out into the
  // room: try both ways, and keep the one whose open panel is clear of things and has a wall close alongside
  for (const d of doors) {
    if (d.slide || d.spec.front) continue;
    let best = 0, bestScore = -Infinity;
    for (const s of [1, -1]) {
      const ang = d.base + s * d.max, dx = Math.cos(ang), dz = -Math.sin(ang), nx = -dz, nz = dx;
      let score = 0;
      for (let t = 0.15; t <= 1.0; t += 0.1) {
        const px = d.hinge.x + dx * d.width * t, pz = d.hinge.z + dz * d.width * t;
        if (world.solid(px, d.y0 + 1.0, pz)) score -= 10;                                   // it would swing into something
        for (const o of [0.18, 0.3]) for (const k of [1, -1]) if (world.solid(px + nx * o * k, d.y0 + 1.0, pz + nz * o * k)) score += o < 0.2 ? 2 : 1;
      }
      if (score > bestScore) { bestScore = score; best = s; }
    }
    d.openSign = best;
  }

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

  // the wall clock (it faces into the room: -z for yaw 0)
  const CK = MAP.shop.clock, clockRoot = new THREE.Group(); clockRoot.position.set(...CK.pos); clockRoot.rotation.y = CK.yaw; scene.add(clockRoot);
  const clock = Props.clockFace().mesh(litMat, emitMat); clockRoot.add(clock);
  const handMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
  const mkHand = (len, w) => { const g = new THREE.BoxGeometry(w, len, 0.02); g.translate(0, len / 2 - 0.02, 0); const m = new THREE.Mesh(g, handMat); m.position.set(0, 0, -2 / 16 - 0.02); clockRoot.add(m); return m; };
  const hourHand = mkHand(0.16, 0.035), minHand = mkHand(0.24, 0.025);

  // ---------------------------------------------------------------- player, audio, post
  const player = new Player(camera, world, renderer.domElement);
  { const T = MAP.shop.title; player.pos.set(T.x, L.floor, T.z); player.yaw = T.yaw; player.pitch = T.pitch; } // the view behind the menu
  const audio = new Ambience();
  const mini = new MiniGames(audio); let miniOpen = false; // the little full-screen games (minigames.js)
  audio.city = !!(MAP.view.sky && MAP.view.sky.city); // the street hums with traffic where the mountain has the sea
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
      if (!coop || coop.isHost) beginNight(save.night, true);
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
    overlay.classList.toggle('hidden', locked || miniOpen || !!(parade && parade.dead));
    document.body.classList.toggle('playing', locked);
    if (!locked) interactions.clear();
    if (!locked && (arcadeOpen || miniOpen)) {} // the Fami-Com (or a little game) fills the screen
    else if (!locked && catalogOpen) menu.show('catalog', { catalog: catalogData() });
    else if (!locked && parade && parade.dead) {} // the night's over: its card is up
    else if (!locked && arrived && !document.body.classList.contains('summary'))
      menu.show('pause', { clock: parade ? parade.pauseText() : clockText(shift.minutes).toLowerCase(), coop: !!coop, isHost: !!(coop && coop.isHost), pausePanel: null });
    // full pause once you've come in (solo only: in co-op the shop keeps going for everyone else)
    paused = arrived && !locked && !coop && !dev && !sunrise && !arcadeOpen;
    if (audio.ctx) { if (paused && !arcadeOpen && !miniOpen) audio.ctx.suspend(); else audio.ctx.resume(); }
    if (locked && !introShown) { introShown = true; setTimeout(() => $('intro').classList.add('gone'), 9000); }
  }
  addEventListener('keydown', (e) => {
    if (!arrived && !parade && menu.screen === 'main' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].includes(e.code)) { menu.h.onSolo(); player.keys[e.code] = true; return; }
  });
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
    if (parade) { parade.mouse(e.button, true); return; }
    if (moving && e.button === 2) { endMove(false); return; }
    if (e.button === 0) interactions.click();
  });
  for (const [di, d] of doors.entries()) {
    const name = d.name;
    d.onAutoClose = () => audio.doorSound(false, d.slide);
    const task = () => d.locked && d.spec.needs && pending(d.spec.needs) && itemById(d.spec.needs);
    interactions.add(() => d.box(), () => {
      const t = task();
      if (t && t.game === 'lockpick') return `Pick the lock (the key's long gone) · ${t.name.toLowerCase()}`;
      if (t && t.game === 'shovel') return `${d.lockedText[0]} · dig it out from outside`;
      return d.locked ? d.lockedText[0] : (d.open ? 'Close the ' : 'Open the ') + name;
    }, () => {
      const t = task();
      if (t && t.game === 'lockpick') { playMini('lockpick', t.id).then((ok) => { if (ok) completeMilestone(t.id); }); return; }
      if (t && t.game === 'shovel') { audio.rattle(); toast(MAP.shop.backHint || 'snowed shut from outside: go round and dig it out'); return; }
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
  for (const f of MAP.shop.faucets) addFaucet(...f.stream, f.box, f.label || 'water');
  const cans = ['a hot can of royal milk tea', 'hot corn soup. somehow perfect.', 'a hot can of coffee. it warms your hands.', 'hot lemon. a little treat.'];
  // a hot can warms you up and puts a spring in your step: 1.25x walking speed for two minutes of play
  const BOOST = { mul: 1.25, secs: 120 };
  let boostLeft = 0;
  // the little things to click round the shop, the street and the flat (the map says where)
  const ACTS = {
    flush: [() => 'Flush', () => audio.flush()],
    princess: [() => 'Press the sound princess button', () => { audio.clickSound(); toast('a recording of a babbling brook plays, very politely.'); }],
    chain: [() => 'Pull the chain', () => audio.flush()],
    towel: [() => 'Dry your hands on the tenugui', () => audio.cloth()],
    radio: [() => (audio.musicOn ? 'Turn the radio off' : 'Turn the radio on'), () => { audio.musicOn = !audio.musicOn; audio.clickSound(); toast(audio.musicOn ? 'radio on' : 'radio off'); }],
    cat: [() => 'Pet the cat', () => { audio.purr(); toast('she stretches one paw. purrrr.'); }],
    vending: [() => (boostLeft > 0 ? 'Buy a hot drink · ¥130 (tops up your boost)' : 'Buy a hot drink · ¥130 · walk 25% faster for 2 min'), () => {
      if (cashBox() < 130) { toast('the cash box is empty. maybe after tonight.'); audio.rattle(); return; }
      if (!save.devYen) { save.yen -= 130; writeSave(save); }
      boostLeft = BOOST.secs; player.speedMul = BOOST.mul;
      audio.vend(); toast(`${cans[Math.floor(Math.random() * cans.length)]} · +25% speed for 2 minutes`);
    }],
    catalog: [() => 'Read the catalog', () => openCatalog()],
    futon: [() => 'Lie down for a minute', () => { audio.purr(); toast(shift.waiting ? "you're wide awake. the shop is waiting." : shift.active ? 'just a minute… then back down to the shop.' : 'the futon is still warm.'); }],
    kettle: [() => 'Put the kettle on', () => { audio.pour(); toast('a cup of hojicha, just for you.'); }],
    andon: [() => 'Andon lamp', () => { const l = named.aptBed; if (l) l.mul = l.mul > 0.5 ? 0.15 : 1; audio.clickSound(); }],
  };
  for (const a of MAP.shop.acts) { const [label, fn] = ACTS[a.act]; interactions.add(a.box, label, fn); }

  // ---------------------------------------------------------------- customers + seats
  const isInside = (x, z) => x > L.inside.x0 && x < L.inside.x1 && z > L.inside.z0 && z < L.inside.z1;
  const crowd = new Crowd({ scene, world, seats: batch.seats, doors, litMat, emitMat, audio, player, inside: isInside });
  if (deco && deco.setAgents) deco.setAgents(() => [player.pos, ...crowd.positions()]); // the street's traffic slows for people
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
  const lookAtBay = (from) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(from, new THREE.Vector3(...MAP.view.sunrise.look), new THREE.Vector3(0, 1, 0)));
  const sunriseStart = () => {
    if (sunrise) return;
    const from = new THREE.Vector3(...MAP.view.sunrise.from), to = new THREE.Vector3(...MAP.view.sunrise.to);
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
  service.rating = save.rating ?? 3;
  // the shop's record, for milestones; what's waiting to be done; doing it
  const record = () => ({ served: save.served || 0, nights: (save.night || 1) - 1, rating: save.rating ?? 0 });
  const pending = (id) => (save.pending || []).includes(id);
  const completeMilestone = (id) => {
    save.pending = (save.pending || []).filter((x) => x !== id);
    if (!service.owned.includes(id)) service.owned.push(id);
    save.owned = [...service.owned]; writeSave(save); applyAll();
    toast(`${itemById(id).name.toLowerCase()}: done`);
  };
  // a little full-screen game: the mouse is let go while it's up, and the game picks up again after
  const playMini = (kind, id) => {
    miniOpen = true; unlock(); setPlaying(false);
    return mini.play(kind, id, id && itemById(id) && itemById(id).name).then((ok) => { miniOpen = false; if (!catalogOpen && !document.body.classList.contains('summary')) lock(); else setPlaying(false); return ok; });
  };
  const learnRecipe = (id, then) => playMini('recipe', id).then((ok) => { if (ok) { completeMilestone(id); if (then) then(); } });
  const homeSteam = [];
  // the Fami-Com and the TV it plugs into
  const arcade = new Arcade();
  arcade.hi = { ...(save.hi || {}) };
  arcade.onHi = (id, score) => { save.hi = { ...(save.hi || {}), [id]: score }; writeSave(save); };
  arcade.onSfx = (kind) => audio.chip(kind);
  const home = new Home({ scene, world, litMat, emitMat, interactions, audio, toast, arcade, touch: !!touchUI, layout: (save.places || {})[MAP.homeKey || MAP.id] || ((MAP.homeKey || MAP.id) === 'mountain' ? save.place : undefined),
    addSeat: (seat) => addSitSpot(seat, seat.local.label || 'Sit by the fire', seat.local.note || 'warm hands. the kettle ticks. · walk to stand up'),
    addLamp: (l) => { const r = { ...l, mul: 1, v: new THREE.Vector3(...l.pos) }; lamps.push(r); named[l.name] = r; return r; },
    addSteam: (src) => { const st = makeSteam([src]); scene.add(st); homeSteam.push(st); return st; } });
  home.onMove = (p) => startMove(p);
  service.layout = home.layout;
  // a piece set down somewhere new: keep it (the host's game stores it for everyone)
  service.onPlace = (key, x, z, rot) => {
    home.moveTo(key, x, z, rot);
    service.layout = home.layout;
    if (!coop || coop.isHost) { save.places = { ...(save.places || {}), [MAP.homeKey || MAP.id]: { ...home.layout } }; writeSave(save); } // each map keeps its own arrangement
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
  // what's piled against the back door until it's cleared (snow on the mountain)
  const snowPile = (MAP.shop.backPile ? MAP.shop.backPile() : Props.snowPile()).mesh(litMat, emitMat); snowPile.position.set(...MAP.shop.snowPile); snowPile.rotation.y = MAP.shop.snowPileYaw || 0; scene.add(snowPile);
  interactions.add([MAP.shop.snowPile[0], 0.55, MAP.shop.snowPile[2], 0.9, 0.5, 0.9], () => 'Shovel the drift off the back door', () => {
    playMini('shovel').then((ok) => { if (ok) completeMilestone('backdoor'); });
  }, () => snowPile.visible && pending('backdoor'));
  const applyProperty = () => {
    const has = (id) => service.owned.includes(id);
    for (const d of doors) if (d.spec.needs) d.locked = !has(d.spec.needs);
    for (const d of doors) if (d.spec.opensWith) d.locked = !has(d.spec.opensWith) && !pending(d.spec.opensWith); // (the fire escape)
    const back = D.back, B = MAP.shop.crowd.back;
    snowPile.visible = !!back && back.locked;
    if (back && B) {
      crowd.nav.setBlocked(B.block, back.locked);   // guests can't come through a door that's shut
      if (B.spawn) {
        const i = crowd.spawns.findIndex((s) => s[0] === B.spawn[0] && s[1] === B.spawn[1]);
        if (!back.locked && i < 0) crowd.spawns.push(B.spawn); else if (back.locked && i >= 0) crowd.spawns.splice(i, 1);
      }
    }
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
  const WAKE = MAP.shop.wake; // in the bedroom, beside the futon
  const wakeUp = () => {
    if (player.seated) player.standUp();
    const k = coop && net ? Math.max(0, net.players.findIndex((p) => p.id === net.id)) : 0;
    player.pos.set(WAKE.x, 3.75, WAKE.z + k * 0.55); player.yaw = WAKE.yaw; player.pitch = -0.05; player.vel.set(0, 0, 0);
    $('intro').classList.remove('gone');
    $('intro').innerHTML = 'evening. go down and turn the sign by the front door to <b>OPEN</b> · the catalog is on the kotatsu';
    setTimeout(() => $('intro').classList.add('gone'), 12000);
  };
  // a night: from the title you're already standing in the street where the menu's view was (the menu just goes);
  // after a night's sleep you wake upstairs
  const beginNight = (n, street = false) => {
    for (let i = 0; i < n - 1; i++) if (UNLOCKS[i]) UNLOCKS[i].apply(service); // perks from the nights before
    shift.start(n);
    applyAll();
    if (!street) wakeUp();
    else {
      player.pitch = 0; player.vel.set(0, 0, 0);
      $('intro').classList.remove('gone');
      $('intro').innerHTML = 'evening. cross to the shop and turn the sign by the front door to <b>OPEN</b>';
      setTimeout(() => $('intro').classList.add('gone'), 9000);
    }
    // the first night walks you through it
    if (n === 1 && !save.tutorialDone && (!coop || coop.isHost)) { $('intro').classList.add('gone'); tutorial.start(); }
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
    goal: goalState(),
    milestones: MILESTONES.map((m) => ({ id: m.id, name: m.name, how: m.how, game: m.game, text: m.text, goal: milestoneGoal(m), needsName: m.needs ? itemById(m.needs).name : '',
      state: service.owned.includes(m.id) ? 'done' : pending(m.id) ? 'pending' : 'locked', progress: milestoneProgress(m, record()) })),
    record: record(),
  });
  // buying runs on the host (or solo): it comes out of the shared cash box and everyone gets the delivery
  const buyItem = (id) => {
    const it = itemById(id);
    if (!it || it.kind === 'milestone' || !(it.price > 0) || service.owned.includes(id) || (it.needs && !service.owned.includes(it.needs)) || cashBox() < it.price) return;
    if (!save.devYen) save.yen -= it.price;
    service.owned.push(id); save.owned = [...service.owned]; writeSave(save);
    applyAll(); audio.kaching();
    service.sayAll(it.kind === 'shop' ? `${it.name.toLowerCase()}: ready tonight` : it.kind === 'station' ? `${it.name.toLowerCase()}: installed (${it.short})`
      : it.kind === 'staff' ? `${it.name.replace('Hire a ', '').toLowerCase()} hired: starts tonight` : it.kind === 'property' ? `${it.name.toLowerCase()}: done` : `${it.name.toLowerCase()}: delivered upstairs`);
  };
  service.onBuy = buyItem;
  const openCatalog = () => { catalogOpen = true; unlock(); if (touchUI || !document.pointerLockElement) setPlaying(false); };

  // the little shrine on the west slope: bow twice, clap twice, bow once. Once a day the kami leave ¥100.
  const SHRINE = MAP.shop.shrine;
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
  interactions.add(SHRINE.box, () => 'Bow at the shrine', bow, () => !bowing && !player.seated);

  // the OPEN / CLOSED sign in the front window by the door
  const signOpen = Props.openSign().mesh(litMat, emitMat), signClosed = Props.closedSign().mesh(litMat, emitMat);
  for (const m of [signOpen, signClosed]) { m.position.set(...MAP.shop.sign.pos); m.rotation.y = MAP.shop.sign.yaw || 0; scene.add(m); }
  interactions.add(MAP.shop.sign.box, () => (shift.waiting ? 'Turn the sign to OPEN' : shift.active ? 'Open until dawn' : 'Closed'), () => {
    if (shift.waiting) { service.request('openShop'); audio.clickSound(); }
  });

  // nights: waves of customers, a clock with sunrise in sight, and a stats card between nights
  const money = (v) => `¥${Math.round(v).toLocaleString('en-US')}`;
  // the goal: a five-star rating, and the shop running itself (everyone hired)
  const goalState = () => {
    const staff = CATALOG.filter((c) => c.kind === 'staff'), hired = staff.filter((c) => service.owned.includes(c.id)).length, rating = save.rating ?? service.rating ?? 3;
    return { rating, hired, of: staff.length, done: rating >= 4.75 && hired === staff.length,
      line: `the goal: a five-star shop that runs itself · ★${rating.toFixed(1)} of 5 · ${hired} of ${staff.length} hired` };
  };
  const hitText = (r) => { const h = r.hits || {}, bits = [h.trash >= 0.05 && 'the bin overflowed', h.dirty >= 0.05 && 'tables sat dirty', h.burnt >= 0.05 && 'food burned'].filter(Boolean); return bits.length ? ` (${bits.join(', ')})` : ''; };
  const showSummary = (r, canStart) => {
    menu.addShift(r.tips);
    sunriseStart();
    const extra = [r.wages && `${money(r.wages)} in staff wages`, r.supplies && `${money(r.supplies)} to the wholesaler`, r.walkouts && `${r.walkouts} walked out`, r.burnt && `${r.burnt} burnt`, r.washed && `${r.washed} dishes washed`].filter(Boolean).join(' · ');
    $('summary').innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div class="when hand">sunrise · night ${r.n}</div>
        <div class="closed neon amber">YOAKE</div>
        <div class="stars">${'★'.repeat(r.stars)}<i>${'★'.repeat(5 - r.stars)}</i></div>
        ${r.shop !== undefined ? `<div class="small">tonight ★${r.rating.toFixed(1)}${r.reviews ? ` from ${r.reviews} guest${r.reviews > 1 ? 's' : ''}` : ''}${hitText(r)} · the shop's rating <b>★${r.shop.toFixed(1)}</b>${r.prev !== undefined && Math.abs(r.shop - r.prev) >= 0.05 ? ` (${r.shop > r.prev ? '▲' : '▼'}${Math.abs(r.shop - r.prev).toFixed(1)})` : ''}</div>` : ''}</div>
      <div class="stats">
        <div class="stat glass"><b>${r.fed}</b><span>people fed</span></div>
        <div class="stat glass"><b>${money(r.earned)}</b><span>earned</span></div>
        <div class="stat glass"><b>${money(r.tips)}</b><span>in tips</span></div></div>
      ${extra ? `<div class="small">${extra}</div>` : ''}
      ${r.goal ? `<div class="unlock goal"><div class="ic">★</div><div><b>five stars, and it runs itself</b><span>Yoake is the best little shop on the street, and the help have it all in hand. People are talking: there's an empty shopfront further down the street…</span></div></div>`
        : r.goalLine ? `<div class="small goal">${r.goalLine}</div>` : ''}
      ${(r.milestones || []).map((m) => `<div class="unlock ms"><div class="ic">${m.how === 'recipe' ? '料' : m.how === 'task' ? '鍵' : '✦'}</div><div><b>${m.how === 'recipe' ? 'a new recipe: ' : m.how === 'gift' ? 'arrived: ' : ''}${m.name.toLowerCase()}</b><span>${m.how === 'recipe' ? "Learn it and it's on the menu tonight." : m.text}</span></div>${m.how === 'recipe' && (!coop || coop.isHost) ? `<button class="pill-btn learn" data-learn="${m.id}">learn it</button>` : ''}</div>`).join('')}
      ${r.unlock ? `<div class="unlock"><div class="ic">✦</div><div><b>new: ${r.unlock.name.toLowerCase()}</b><span>${r.unlock.text}</span></div></div>` : ''}
      ${!coop || coop.isHost ? `<div class="small">${money(save.yen)} in the cash box · the catalog is on the kotatsu upstairs</div>` : ''}
      <div class="actions">${canStart ? '<button class="pill-btn" data-act="again">go up to bed</button>' : '<button class="pill-btn" disabled>waiting for the host…</button>'}
        <button class="text-btn" data-act="home">${coop && coop.isHost ? 'close the shop' : 'back to the title'}</button></div>`;
    const again = $('summary').querySelector('[data-act="again"]');
    if (again) again.onclick = () => { lock(); sleepUntil(r.n + 1); };
    for (const b of $('summary').querySelectorAll('[data-learn]')) b.onclick = () => learnRecipe(b.dataset.learn, () => { b.textContent = 'learned ✓'; b.disabled = true; });
    $('summary').querySelector('[data-act="home"]').onclick = quit;
    document.body.classList.add('summary');
    audio.kaching();
    unlock();
  };
  const shift = new Shift({ service, crowd, audio, toast, ui: { schedule: $('schedule') }, onEnd: (r) => {
    save.night = r.n + 1; save.yen = Math.max(0, save.yen + r.earned);
    // the shop's rating: a rolling average of its nights (the newest counts for 40%)
    r.prev = save.rating; save.rating = r.shop = save.rating === undefined ? r.rating : Math.round((save.rating * 0.6 + r.rating * 0.4) * 100) / 100;
    service.rating = save.rating;
    // milestones: kit arrives, recipes are there to learn, and parts of the building want getting into
    save.served = (save.served || 0) + r.fed;
    r.milestones = reachMilestones(save, service.owned, record()).map((m) => ({ id: m.id, name: m.name, how: m.how, game: m.game, text: m.text }));
    save.owned = [...service.owned]; applyAll();
    if (!save.tutorialDone) save.tutorialDone = true;
    const g = goalState();
    if (g.done && !save.goal) { save.goal = r.n; r.goal = true; } else if (!save.goal) r.goalLine = g.line;
    writeSave(save);
    if (coop) net.send({ t: 'summary', r: { ...r, unlock: r.unlock && { name: r.unlock.name, text: r.unlock.text } } });
    showSummary(r, true);
  } });
  const tutorial = new Tutorial({ scene, service, shift, crowd, player, audio, el: $('tut') }); // the first night's walk-through
  shift.players = () => (coop && net ? Math.max(1, net.players.length) : 1);
  shift.onStart = (n) => { if (coop && coop.isHost) net.send({ t: 'shiftStart', n }); };
  // between nights (the sign still says CLOSED) you can upgrade the kitchen's stations
  service.between = () => shift.active && shift.waiting;
  service.isOpen = () => shift.active && !shift.waiting;
  service.stationUps = STATION_UPS;
  service.crew = new Staff({ scene, service, litMat, emitMat });
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
    // the night parade is played on the mountain: off the street and up there (a reload, as the shop's world is built once)
    onParade: () => { if (MAP === MOUNTAIN) return startParade(); try { sessionStorage.setItem('yoake.parade', '1'); } catch {} location.reload(); },
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
    onLearn: (id) => { if (coop && !coop.isHost) return; learnRecipe(id, () => { if (catalogOpen) menu.show('catalog', { catalog: catalogData() }); }); },
    onNewGame: () => { clearSave(); location.reload(); },
    onDevYen: () => { setDevYen(!save.devYen); menu.show(menu.screen); },
  };
  // the shop is built: off the loading screen and onto the main menu (or straight to a friend's code from a shared link)
  let notice = null;
  try { notice = sessionStorage.getItem('yoake.notice'); sessionStorage.removeItem('yoake.notice'); } catch {}
  const joinCode = (new URLSearchParams(location.search).get('join') || '').toUpperCase();
  if (joinCode) { history.replaceState(null, '', location.pathname); menu.show('join', { code: joinCode, notice: null }); }
  else if (paradeNext) {
    menu.h.onResume = () => startParade();
    menu.show('ready', { readyNote: 'the snow is falling. something is coming up out of it', readyTitle: '百鬼夜行', readyItem: 'rise again' });
  }
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

  // the telescope at the front window: you put your eye to the eyepiece and it swings round to Fuji. A round brass
  // field of view, a narrow lens; the mouse pans it slowly, walking steps back.
  let zoom = false, aimFuji = 0;
  const fujiAt = new THREE.Vector3(...MAP.view.scope); // what the telescope swings round to
  home.onTelescope = () => { zoom = true; aimFuji = 1.2; document.body.classList.add('scope'); audio.clickSound(); };
  const scopeOff = () => { zoom = false; document.body.classList.remove('scope'); };

  // ---------------------------------------------------------------- 百鬼夜行: the night parade (a survival mode; the shop's save is untouched)
  let parade = null;
  const startParade = () => {
    if (parade) { lock(); return; }
    if (arrived) return;
    audio.start();
    arrived = true;
    if (zoom) scopeOff();
    service.held.visible = false; crowd.auto = false; crowd.clearAll();
    frontDoor.stuck = true;
    parade = new Parade({ scene, camera, player, world, interactions, audio, toast, litMat, emitMat, glassMat, composer, snowPile,
      doors: D,
      allDoors: doors, glass: glassPanes, lamps, hud: $('zm'),
      onQuit: () => location.reload(),
      onAgain: () => { try { sessionStorage.setItem('yoake.parade', '1'); } catch {} location.reload(); } });
    parade.start();
    // phones: buttons to strike (hold to keep swinging), throw a dish or a fire-pot, jump, switch weapons, reload, and
    // use (hold to rebuild)
    if (touchUI) {
      const bar = $('touchbar');
      const btn = (label, down, up = null) => {
        const b = document.createElement('button'); b.className = 'glass zm-btn'; b.textContent = label; b.dataset.k = label;
        b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
        b.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); if (up) up(); }, { passive: false });
        bar.prepend(b); return b;
      };
      btn('reload', () => parade.key('KeyR', true), () => parade.key('KeyR', false));
      btn('1/2', () => parade.wheel());
      btn('dish', () => parade.key('KeyQ', true), () => parade.key('KeyQ', false));
      btn('pot', () => parade.key('KeyG', true), () => parade.key('KeyG', false));
      btn('jump', () => { player.keys.Space = true; }, () => { player.keys.Space = false; });
      btn('use', () => parade.key('KeyE', true), () => parade.key('KeyE', false));
      btn('strike', () => parade.mouse(0, true), () => parade.mouse(0, false));
    }
    lock();
  };
  addEventListener('mouseup', (e) => { if (parade) parade.mouse(e.button, false); });
  addEventListener('keydown', (e) => { if (parade && player.locked) parade.key(e.code, true); });
  addEventListener('keyup', (e) => { if (parade) parade.key(e.code, false); });
  addEventListener('wheel', () => { if (parade && player.locked) parade.wheel(); }, { passive: true });
  addEventListener('contextmenu', (e) => { if (parade) e.preventDefault(); });

  // ---------------------------------------------------------------- loop
  let indoor = 1, last = performance.now(), time = 0, dawn = 0, purseT = 0;
  const radioPos = new THREE.Vector3(...MAP.shop.radio); // the shop's radio
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
      for (const d of doors) d.update(dt, [player.pos, ...crowd.positions(), ...crowd.others, ...service.crew.positions()]);
      coop.update(dt);
    };
  } catch (e) { console.warn('[yoake] no background ticker:', e.message); } // some sandboxes refuse blob workers

  // sky, light and haze all follow one number
  function setDawn(d) {
    sunDir(d, sunV);
    hazeColor(d, haze, MAP.view.nightHaze);
    scene.fog.color.copy(haze);
    scene.fog.density = THREE.MathUtils.lerp(MAP.view.fog ?? FOG_DENSITY, 0.018, THREE.MathUtils.smoothstep(d, 0.5, 1));
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
    player.loadMul = service.has('keg') ? 0.7 : 1;
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
    if (parade) parade.update(dt);
    else if ((arrived || dev || (coop && !coop.isHost)) && !bgHost) { crowd.update(dt); service.update(dt); shift.update(dt); tutorial.update(dt); }
    if (coop) coop.update(dt);
    const agents = parade ? [player.pos, ...parade.horde.list.filter((k) => k.alive).map((k) => k.pos)] : [player.pos, ...crowd.positions(), ...crowd.others, ...service.crew.positions()];
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
    if (deco) deco.update(dt, time, dawn, camera, audio);

    audio.update(dt, {
      indoor, listener: camera.position, musicDist: Math.min(camera.position.distanceTo(radioPos), home.recordOn ? camera.position.distanceTo(home.recordPos) : Infinity), sizzleDist: Math.hypot(p.x - MAP.shop.sizzle[0], p.z - MAP.shop.sizzle[1]), gust, dawn,
    });

    if (innerWidth && innerHeight) composer.render(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__yoake = window.__diner = { scene, camera, player, renderer, world, composer, bloom, named, interactions, doors, audio, crowd, service, shift, menu, save, home, arcade,
    catalogData, mini, tutorial, ms: { record, pending, complete: completeMilestone, learn: learnRecipe, play: playMini, apply: applyAll }, get coop() { return coop; }, get net() { return net; }, map: MAP, get parade() { return parade; }, startParade, get dawn() { return dawn; }, deco, sunriseStart, sunriseEnd, setDawnOverride: (d) => { dawn = d; } };
}

boot().catch((e) => { console.error(e); status('something spilled: ' + e.message); });
