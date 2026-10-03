import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AudioEngine, type MusicMood } from '../audio/audio';
import { DIRTY_DISHES } from '../data/content';
import { buildContent, recipeFor, stationChain, unlockedMenu } from '../data/registry';
import type { ArchetypeDef, ItemId } from '../data/types';
import { browserStorage, loadSave, newSave, writeSave, type SaveData } from '../save/save';
import { NightClock, skyProgress } from '../sim/clock';
import { NightLedger, nextRating, nightScore } from '../sim/economy';
import { generateOrder } from '../sim/orders';
import { Rng } from '../sim/rng';
import { pickArchetype, Spawner, volumeMultiplier } from '../sim/spawner';
import { StationBadge, Ticket, UI, yen } from '../ui/ui';
import { ConveyorBelt } from '../world/belt';
import { Party, Spot } from '../world/dining';
import { Environment } from '../world/environment';
import type { Rect } from '../world/geometry';
import { Hand, InteractionSystem } from '../world/interaction';
import { COUNTER_X, DINING, PLAYER_SPAWN_APARTMENT, RACK_POS, ROOM_BOXES, SIGN_POS, SINK_POS, SPOTS, STATION_SLOTS } from '../world/layout';
import { signTexture } from '../world/materials';
import { Player } from '../world/player';
import { buildRestaurant, menuBoardTexture, type RestaurantBuild } from '../world/restaurant';
import { Crate, DishRack, OpenSign, Sink, StationEntity, type StationLabel } from '../world/stations';
import { LooseItems, SurfaceEntity } from '../world/surfaces';
import { glowMaterial, updateLightMask } from '../world/voxel/vox';

export type Mode = 'title' | 'prep' | 'shift' | 'sunrise' | 'summary';

/** Cozy grade in linear space before tone mapping: saturation, warm shadow lift, vignette. */
const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.18 }, lift: { value: new THREE.Vector3(0.006, 0.0025, 0.0) }, vignette: { value: 1.05 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation; uniform vec3 lift; uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 col = mix(vec3(l), c.rgb, saturation);
      col += lift * (1.0 - smoothstep(0.0, 0.25, l));
      vec2 d = vUv - 0.5;
      col *= clamp(1.0 - dot(d, d) * vignette, 0.0, 1.0);
      gl_FragColor = vec4(col, c.a);
    }`,
};

const SUMMARY_DELAY = 4;

export class Game {
  readonly content = buildContent();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly outline: OutlinePass;
  private readonly env: Environment;
  private readonly build: RestaurantBuild;
  readonly interaction: InteractionSystem;
  readonly player: Player;
  readonly hand: Hand;
  readonly ui: UI;
  readonly audio = new AudioEngine();
  private readonly storage = browserStorage();

  save: SaveData;
  mode: Mode = 'title';
  paused = false;
  clock: NightClock;
  ledger = new NightLedger();
  rng = new Rng(Date.now());
  private spawner = new Spawner(this.rng);
  readonly dishes = { clean: 12 };

  readonly stations: StationEntity[] = [];
  readonly spots: Spot[] = [];
  readonly belt: ConveyorBelt;
  readonly loose: LooseItems;
  readonly sink: Sink;
  readonly rack: DishRack;
  readonly crate: Crate;
  readonly sign: OpenSign;
  parties: Party[] = [];
  private readonly tickets = new Map<Party, Ticket>();
  private readonly badges: [StationBadge, StationLabel][] = [];
  private readonly glows = new Map<string, THREE.MeshBasicMaterial>();

  private sunriseT = 0;
  private summaryTimer = 0;
  private lastCallAnnounced = false;
  private snowBase = 0.7;
  private time = 0;
  private last = performance.now();
  private readonly speed: number;

  constructor(container: HTMLElement) {
    const params = new URLSearchParams(location.search);
    this.speed = Math.max(0.1, Number(params.get('speed')) || 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 7000);
    this.scene.add(this.camera);

    const target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.outline = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
    this.outline.edgeStrength = 3.2;
    this.outline.edgeGlow = 0.7;
    this.outline.edgeThickness = 1.6;
    this.outline.visibleEdgeColor.set(0xffcf7a);
    this.outline.hiddenEdgeColor.set(0x000000);
    this.composer.addPass(this.outline);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.7, 0.7);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(GRADE_SHADER));
    this.composer.addPass(new OutputPass());

    this.env = new Environment(this.scene);
    this.build = buildRestaurant();
    this.scene.add(this.build.group);
    this.scene.add(new THREE.AmbientLight(0x2a2a3a, 0.35));

    this.interaction = new InteractionSystem(this.build.blockers);
    this.player = new Player(this.camera, this.renderer.domElement, this.build.colliders);
    this.player.onStep = () => this.audio.play('step');
    this.hand = new Hand(this.camera, this.content);
    this.ui = new UI(container);

    const blocked: Rect[] = [];
    for (const def of this.content.stations.all()) {
      const z = STATION_SLOTS[def.id];
      if (z === undefined) throw new Error(`No counter slot for station ${def.id}`);
      const s = new StationEntity(this, def, z);
      this.addEntity(s);
      this.scene.add(s.glow);
      this.glows.set(def.id, s.glow.material as THREE.MeshBasicMaterial);
      this.addBadge(s.label);
      this.stations.push(s);
      blocked.push({ minX: COUNTER_X - 0.5, maxX: COUNTER_X + 0.5, minZ: z - (def.id === 'sushi_board' ? 0.55 : 0.4), maxZ: z + (def.id === 'rice_cooker' ? 0.55 : 0.4) });
    }
    this.sink = new Sink(this, SINK_POS.x, SINK_POS.z);
    this.addEntity(this.sink);
    this.scene.add(this.sink.glow);
    this.glows.set('sink', this.sink.glow.material as THREE.MeshBasicMaterial);
    this.addBadge(this.sink.label);
    this.rack = new DishRack(this, RACK_POS.x, RACK_POS.z);
    this.addEntity(this.rack);
    blocked.push({ minX: SINK_POS.x - 0.6, maxX: SINK_POS.x + 0.6, minZ: SINK_POS.z - 0.5, maxZ: SINK_POS.z + 0.5 });
    blocked.push({ minX: RACK_POS.x - 0.45, maxX: RACK_POS.x + 0.45, minZ: RACK_POS.z - 0.4, maxZ: RACK_POS.z + 0.4 });
    this.crate = new Crate(this);
    this.addEntity(this.crate);
    this.scene.add(this.crate.glow);
    this.glows.set('crate', this.crate.glow.material as THREE.MeshBasicMaterial);
    const signTex = (jp: string, en: string, bg: string) =>
      signTexture({ width: 120, height: 68, bg, fg: '#f4ead2', border: '#2a1a10', lines: [{ text: jp, size: 24, y: 26 }, { text: en, size: 14, y: 52 }] });
    this.sign = new OpenSign(this, SIGN_POS, { closed: signTex('準備中', 'CLOSED', '#5a2a20'), open: signTex('営業中', 'OPEN', '#2a4a30') });
    this.addEntity(this.sign);
    this.belt = new ConveyorBelt(this);
    this.addEntity(this.belt);
    SPOTS.forEach((def, i) => {
      const spot = new Spot(this, def, i);
      this.addEntity(spot);
      this.spots.push(spot);
    });
    this.loose = new LooseItems(this, blocked);
    for (const def of this.build.surfaces) this.addEntity(new SurfaceEntity(this, def));

    this.scene.updateMatrixWorld(true);
    updateLightMask(this.scene, ROOM_BOXES, DINING.height + 0.1);
    this.clock = new NightClock(this.content.night);
    const defaults = newSave(this.content);
    const loaded = this.storage ? loadSave(this.storage, defaults) : null;
    this.save = loaded ?? defaults;
    this.applySettings();
    this.refreshMenuBoard();
    this.bindInput();
    this.showTitle(loaded !== null);

    if (params.has('debug')) (window as unknown as { yoake: Game }).yoake = this;
  }

  private addEntity(e: { root: THREE.Object3D } & Parameters<InteractionSystem['register']>[0]): void {
    this.scene.add(e.root);
    this.interaction.register(e);
  }

  private addBadge(label: StationLabel): void {
    const b = new StationBadge();
    b.label.anchor.copy(label.anchor);
    b.label.maxDistance = 9;
    this.ui.labels.add(b.label);
    this.badges.push([b, label]);
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------------- input
  private bindInput(): void {
    window.addEventListener('resize', () => this.resize());
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (this.isPlaying && !this.player.locked && !this.paused) this.lockPointer();
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.player.locked && this.isPlaying && !this.paused) this.interaction.click();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyQ' && this.player.locked && this.isPlaying && !this.paused) this.putDown();
    });
    this.player.controls.addEventListener('unlock', () => {
      if (this.isPlaying) this.pause();
    });
    this.player.controls.addEventListener('lock', () => this.resume());
  }

  private get isPlaying(): boolean {
    return this.mode === 'prep' || this.mode === 'shift' || this.mode === 'sunrise';
  }

  private lockPointer(): void {
    this.audio.resume();
    try {
      const r = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => undefined);
    } catch {
      /* browsers throttle re-locking right after Esc; the pause screen stays up */
    }
  }

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    const s = this.save.settings;
    this.ui.showPause(
      { master: s.masterVolume, music: s.musicVolume, sensitivity: s.mouseSensitivity, midShift: this.mode !== 'prep' },
      {
        resume: () => this.lockPointer(),
        quit: () => this.quitToTitle(),
        change: (k, v) => {
          if (k === 'master') s.masterVolume = v;
          else if (k === 'music') s.musicVolume = v;
          else s.mouseSensitivity = v;
          this.applySettings();
        },
      },
    );
  }

  private resume(): void {
    this.paused = false;
    this.ui.hidePause();
  }

  private applySettings(): void {
    const s = this.save.settings;
    this.audio.setVolumes(s.masterVolume, s.musicVolume);
    this.player.setSensitivity(s.mouseSensitivity);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.outline.setSize(w, h);
  }

  // ---------------------------------------------------------------- states
  private showTitle(hasSave: boolean): void {
    this.mode = 'title';
    this.ui.setPlaying(false);
    const info = `Night ${this.save.night} · ${yen(this.save.cash)}`;
    this.ui.showTitle(
      hasSave,
      info,
      () => this.enterPrep(),
      () => {
        this.save = newSave(this.content);
        this.persist();
        this.applySettings();
        this.enterPrep();
      },
    );
  }

  private quitToTitle(): void {
    // Mid-shift progress is discarded: the stored save is still the start-of-night snapshot.
    const midShift = this.mode !== 'prep';
    if (!midShift) this.persist();
    else {
      const settings = this.save.settings;
      this.save = (this.storage && loadSave(this.storage, newSave(this.content))) || newSave(this.content);
      this.save.settings = settings;
      this.persist();
    }
    this.paused = false;
    this.ui.hidePause();
    this.resetNight();
    this.showTitle(true);
  }

  private enterPrep(): void {
    this.audio.resume();
    this.ui.hideTitle();
    this.ui.hideSummary();
    this.resetNight();
    this.mode = 'prep';
    this.ui.setPlaying(true);
    this.ui.setLegendVisible(this.save.night <= 2);
    this.ui.snapCash(this.save.cash);
    this.ui.toast(`Night ${this.save.night}`, 'big', 3.5);
    this.ui.fadeTo(0, 1.2);
    this.lockPointer();
  }

  openRestaurant(): void {
    this.mode = 'shift';
    this.sign.setOpen(true);
    this.audio.play('door');
    this.ui.toast('Open for business', 'info');
  }

  private beginSunrise(): void {
    this.mode = 'sunrise';
    this.sunriseT = 0;
    this.summaryTimer = 0;
    this.sign.setOpen(false);
    this.ui.toast('The last guests have gone home. Dawn is coming.', 'info', 5);
  }

  private showSummary(): void {
    this.mode = 'summary';
    const l = this.ledger;
    const score = nightScore(l);
    const before = this.save.rating;
    const after = nextRating(before, score?.score ?? null, this.content.economy.ratingMomentum);
    const st = this.save.stats;
    st.nightsCompleted++;
    st.partiesServed += l.partiesServed;
    st.partiesLost += l.partiesLost;
    st.itemsServed += l.itemsServed;
    st.lifetimeRevenue += l.revenue;
    st.lifetimeTips += l.tips;
    st.lifetimeProfit += l.net;
    st.bestNightProfit = Math.max(st.bestNightProfit, l.net);
    const night = this.save.night;
    this.save.rating = after;
    this.save.night = night + 1;
    this.persist();
    this.refreshMenuBoard();

    this.paused = false;
    this.ui.setPlaying(false);
    this.ui.fadeTo(1, 0);
    requestAnimationFrame(() => this.ui.fadeTo(0, 2));
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.showSummary(
      {
        night,
        revenue: l.revenue,
        tips: l.tips,
        ingredients: l.ingredientSpend,
        net: l.net,
        cash: this.save.cash,
        served: l.partiesServed,
        lost: l.partiesLost,
        items: l.itemsServed,
        ratingBefore: before,
        ratingAfter: after,
        satisfaction: score?.satisfaction ?? null,
        servedRatio: score?.served ?? null,
      },
      () => this.enterPrep(),
    );
  }

  private resetNight(): void {
    for (const p of this.parties) this.removeParty(p);
    this.parties = [];
    for (const s of this.spots) s.reset();
    for (const s of this.stations) s.reset();
    this.belt.reset();
    this.loose.reset();
    this.sink.reset();
    this.dishes.clean = this.content.economy.startingCleanDishes;
    this.rack.sync();
    this.hand.clear();
    this.clock = new NightClock(this.content.night);
    this.ledger = new NightLedger();
    this.rng = new Rng((Date.now() ^ (this.save.night * 7919)) | 0);
    this.spawner = new Spawner(this.rng);
    this.sunriseT = 0;
    this.lastCallAnnounced = false;
    this.sign.setOpen(false);
    this.snowBase = this.rng.weighted([
      [0.45, 1],
      [0.75, 2],
      [1, 1.4],
    ])!;
    this.player.teleport(PLAYER_SPAWN_APARTMENT, 0);
  }

  private persist(): void {
    if (this.storage) writeSave(this.storage, this.save);
  }

  private refreshMenuBoard(): void {
    const menu = unlockedMenu(this.content, this.save.night, this.save.rating).map((m) => ({ name: this.content.items.get(m.item).name, price: m.price }));
    const material = this.build.menuBoard.material as THREE.MeshStandardMaterial;
    material.map?.dispose();
    material.map = menuBoardTexture(menu);
    material.needsUpdate = true;
  }

  // ---------------------------------------------------------------- gameplay API (used by entities)
  reject(): void {
    this.audio.play('reject');
    this.ui.flashReject();
  }

  /** Q: set the held item down on whatever counter, ledge or belt you're looking at. */
  putDown(): void {
    if (this.hand.empty) return;
    const h = this.interaction.hovered;
    const hit = this.interaction.lastHit;
    if (h && hit && (h instanceof SurfaceEntity || h instanceof ConveyorBelt)) {
      h.interact(hit);
      return;
    }
    this.reject();
    this.ui.toast('Look at a counter or the belt to set it down', 'info', 2);
  }

  patienceScale(): number {
    const e = this.content.economy;
    return Math.max(1, e.patienceBonusNight1 - e.patienceBonusDecay * (this.save.night - 1));
  }

  restock(): void {
    let spent = 0;
    for (const ing of this.content.ingredients.all()) {
      const have = this.save.pantry[ing.id] ?? 0;
      const affordable = Math.floor((this.save.cash - spent) / ing.unitCost);
      const buy = Math.max(0, Math.min(ing.capacity - have, affordable));
      this.save.pantry[ing.id] = have + buy;
      spent += buy * ing.unitCost;
    }
    if (spent === 0) {
      this.reject();
      this.ui.toast('Not enough money to restock', 'info', 2);
      return;
    }
    this.save.cash -= spent;
    if (this.mode === 'prep') this.persist();
    else this.ledger.recordRestock(spent);
    this.audio.play('dishes');
    this.ui.toast(`Restocked ingredients (${yen(-spent)})`, 'info', 2.5);
  }

  generateOrder(arch: ArchetypeDef, members: number): ItemId[] {
    const available = unlockedMenu(this.content, this.save.night, this.save.rating).map((m) => m.item);
    return generateOrder(arch, members, available, this.rng);
  }

  receivePayment(party: Party, bill: number, tip: number): void {
    this.save.cash += bill + tip;
    this.ledger.recordPayment(bill, tip, party.satisfaction);
    const s = party.spot.def;
    this.ui.floater(new THREE.Vector3(s.x, 1.8, s.z), tip > 0 ? `+${yen(bill)}  +${yen(tip)} tip` : `+${yen(bill)}`, 'money');
    this.audio.play('cash');
  }

  emote(party: Party, text: string): void {
    const s = party.spot.def;
    this.ui.floater(new THREE.Vector3(s.x, 2.0, s.z), text, text === '💢' ? 'angry' : 'happy', 1.8);
  }

  warnImpatient(party: Party): void {
    this.ui.toast(`${party.spot.label} is getting impatient`, 'warn', 3);
    this.audio.play('toast');
  }

  walkout(party: Party): void {
    this.emote(party, '💢');
    this.audio.play('angry');
    this.ui.toast(`${party.spot.label} left — they waited too long`, 'warn', 4);
  }

  private spawnParty(): void {
    const arch = pickArchetype(this.content.archetypes.all(), this.clock.phase().id, this.rng);
    const free = this.spots.filter((s) => s.available);
    const fits = free.filter((s) => arch.seating === 'any' || s.kind === arch.seating);
    const spot = this.rng.pick(fits.length ? fits : free);
    const party = new Party(this, arch, this.rng.pick(arch.looks), spot);
    spot.party = party;
    this.parties.push(party);
    const ticket = new Ticket();
    this.tickets.set(party, ticket);
    this.ui.labels.add(ticket.label);
    this.audio.play('door');
  }

  private removeParty(p: Party): void {
    p.dispose();
    const t = this.tickets.get(p);
    if (t) this.ui.labels.remove(t.label);
    this.tickets.delete(p);
    if (p.spot.party === p) p.spot.party = null;
  }

  // ---------------------------------------------------------------- frame
  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.tick(dt);
    this.composer.render();
  }

  /** Runs the simulation without rendering — used by automated playtests. */
  debugAdvance(seconds: number, step = 0.05): void {
    for (let t = 0; t < seconds; t += step) this.tick(step);
  }

  private tick(dt: number): void {
    this.time += dt;
    const sim = this.isPlaying && !this.paused ? dt : 0;

    if (this.mode === 'title' || this.mode === 'summary') this.updateTitleCamera();
    else if (sim > 0) this.player.update(sim);

    if (this.mode === 'shift') this.updateShift(sim);
    if (this.mode === 'sunrise') this.updateSunrise(sim);

    this.belt.update(sim);
    for (const p of this.parties) p.update(sim);
    for (const p of this.parties.filter((p) => p.state === 'done')) this.removeParty(p);
    this.parties = this.parties.filter((p) => p.state !== 'done');
    for (const s of this.stations) s.update(sim, this.time);
    this.sink.update(sim);
    this.hand.update(dt, this.time);

    const skyT = this.mode === 'title' ? 0 : skyProgress(this.content.night, this.clock.minute);
    const snow = this.mode === 'sunrise' || this.mode === 'summary' ? this.snowBase * Math.max(0.1, 1 - this.sunriseT * 1.4) : this.snowBase;
    this.env.update(this.time, skyT, snow, this.camera);
    this.updateLights();

    this.interaction.update(this.camera, this.isPlaying && !this.paused && this.player.locked);
    this.outline.selectedObjects = this.interaction.hovered ? this.interaction.hovered.outlineTargets() : [];
    this.updateUi(dt);
    this.updateHighlights();
    this.audio.update(dt, { mood: this.musicMood(), busy: Math.min(1, this.parties.filter((p) => p.state === 'waiting').length / 4), snow });
  }

  private updateShift(dt: number): void {
    const cfg = this.content.night;
    const advanced = this.clock.tick(dt, this.speed);
    if (!this.clock.isLastCall) {
      const anyFree = this.spots.some((s) => s.available);
      if (this.spawner.tick(advanced, this.clock.phase(), volumeMultiplier(cfg, this.save.night), anyFree)) this.spawnParty();
    } else if (!this.lastCallAnnounced) {
      this.lastCallAnnounced = true;
      this.ui.toast('Last call — no more guests tonight', 'info', 4);
      this.sign.setOpen(false);
    }
    if (this.clock.isLastCall && this.allClear()) this.beginSunrise();
  }

  private allClear(): boolean {
    return (
      this.parties.length === 0 &&
      this.spots.every((s) => s.dirty === 0) &&
      this.hand.item !== DIRTY_DISHES &&
      this.loose.count(DIRTY_DISHES) === 0 &&
      this.sink.queue === 0
    );
  }

  private updateSunrise(dt: number): void {
    const cfg = this.content.night;
    this.sunriseT = Math.min(1, this.sunriseT + dt / cfg.sunriseSeconds);
    this.clock.minute = cfg.holdMinute + (cfg.sunriseEndMinute - cfg.holdMinute) * this.sunriseT;
    if (this.sunriseT >= 1) {
      this.summaryTimer += dt;
      if (this.summaryTimer >= SUMMARY_DELAY) this.showSummary();
    }
  }

  private updateLights(): void {
    const dawn = this.mode === 'sunrise' || this.mode === 'summary' ? THREE.MathUtils.smoothstep(this.sunriseT, 0.5, 1) : 0;
    const f = 1 - dawn * 0.45;
    this.build.lights.forEach(({ light, flicker }, i) => {
      const wobble = flicker ? 1 + Math.sin(this.time * 7.3 + i * 1.7) * 0.035 + Math.sin(this.time * 13.9 + i * 3.1) * 0.025 : 1;
      light.intensity = (light.userData.base ??= light.intensity) * f * wobble;
    });
    glowMaterial.color.setScalar(f * (1 + Math.sin(this.time * 5.1) * 0.02));
  }

  private updateTitleCamera(): void {
    const a = Math.sin(this.time * 0.05) * 0.1;
    this.camera.position.set(13 + a * 6, 5.2 + Math.sin(this.time * 0.13) * 0.15, 17 - a * 3);
    this.camera.lookAt(-1.5, 2.8, -1.5);
  }

  private musicMood(): MusicMood {
    switch (this.mode) {
      case 'title':
        return 'title';
      case 'prep':
        return 'late';
      case 'shift': {
        const id = this.clock.phase().id;
        return this.clock.isLastCall || id === 'winddown' ? 'late' : 'service';
      }
      case 'sunrise':
      case 'summary':
        return this.sunriseT > 0.05 || this.mode === 'summary' ? 'sunrise' : 'quiet';
    }
  }

  private phaseLabel(): string {
    if (this.mode === 'prep') return 'Closed';
    if (this.mode === 'sunrise') return 'Dawn';
    if (this.clock.isLastCall) return 'Last Call';
    return this.clock.phase().name;
  }

  private updateUi(dt: number): void {
    const playing = this.isPlaying;
    this.ui.updateHud(this.save.cash, this.clock.label(), this.save.rating, this.phaseLabel(), dt);
    this.ui.setPrompt(playing && this.interaction.hovered ? this.interaction.hovered.prompt() : null);
    this.ui.setHeld(this.hand.item ? this.hand.name : null, this.hand.item ? this.content.items.get(this.hand.item).icon : null);
    this.ui.setObjective(playing ? this.objective() : '');

    const hoveredSpot = this.interaction.hovered instanceof Spot ? this.interaction.hovered : null;
    for (const [party, ticket] of this.tickets) {
      party.ticketAnchor(ticket.label.anchor);
      if (party.state === 'ordering') {
        ticket.label.visible = true;
        ticket.set('reading', null, false);
      } else if (party.state === 'waiting') {
        ticket.label.visible = true;
        const icons = party.remaining.map((i) => {
          const def = this.content.items.get(i);
          return { icon: def.icon, name: def.name };
        });
        ticket.set(icons, party.patience / party.patienceMax, hoveredSpot === party.spot || (!this.hand.empty && party.remaining.includes(this.hand.item!)));
      } else {
        ticket.label.visible = false;
      }
    }
    for (const [badge, label] of this.badges) badge.set(label.progress, label.ready);
    this.ui.labels.update(this.camera, playing && !this.paused);
  }

  /** Warm light pools on the counter under every station the current orders depend on. */
  private updateHighlights(): void {
    const needed = new Set<string>();
    if (this.mode === 'shift' || this.mode === 'sunrise') {
      for (const p of this.parties) {
        if (p.state !== 'waiting') continue;
        for (const item of p.remaining) for (const s of stationChain(this.content, item)) needed.add(s);
      }
      if (this.hand.item === DIRTY_DISHES || this.sink.queue > 0 || this.dishes.clean < 3) needed.add('sink');
      if (this.content.ingredients.all().some((i) => (this.save.pantry[i.id] ?? 0) === 0)) needed.add('crate');
    }
    const pulse = 0.8 + Math.sin(this.time * 3) * 0.35;
    for (const [id, m] of this.glows) {
      const target = needed.has(id) ? 0.35 + pulse * 0.25 : 0;
      m.opacity += (target - m.opacity) * 0.12;
    }
  }

  /** One short line answering "what should I do right now?" */
  private objective(): string {
    const c = this.content;
    if (this.mode === 'prep') return this.player.upstairs ? 'Head downstairs — the stairs lead into the kitchen' : 'Flip the shop sign by the front door to open for the night';
    if (this.mode === 'sunrise') return this.sunriseT < 1 ? 'The night’s work is done. Watch the sunrise.' : 'Good work tonight.';
    if (this.hand.item === DIRTY_DISHES) return 'Take the dirty dishes to the sink, and stay there while they wash';
    if (this.sink.queue > 0 && this.hand.empty && this.dishes.clean < 3) return 'You’re nearly out of clean dishes — stand at the sink to wash';
    const waiting = this.parties.filter((p) => p.state === 'waiting').sort((a, b) => a.patience - b.patience);
    if (this.hand.item) {
      const target = waiting.find((p) => p.remaining.includes(this.hand.item!));
      if (target) return target.spot.kind === 'counter' ? `Put the ${this.hand.name} on the belt for ${target.spot.label}, or hand it over` : `Carry the ${this.hand.name} to ${target.spot.label}`;
      const usedFor = c.recipes.all().find((r) => r.inputs.includes(this.hand.item!));
      if (usedFor) return `Take the ${this.hand.name} to the ${c.stations.get(usedFor.station).name}`;
    }
    for (const p of waiting) {
      for (const item of p.remaining) {
        const ready = this.stations.find((s) => s.label.ready > 0 && s.holds(item));
        if (ready && this.hand.empty) return `Pick up the ${c.items.get(item).name} from the ${ready.def.name}`;
      }
      const item = p.remaining[0];
      const r = recipeFor(c, item);
      if (!r) continue;
      const name = c.items.get(item).name;
      if (this.belt.plates.some((pl) => pl.item === item) && p.spot.kind === 'counter') return `${name} is riding the belt to ${p.spot.label}`;
      if (this.stations.some((s) => s.busy && s.holds(item))) return `${name} is on its way — check other orders`;
      if (r.dish && this.dishes.clean === 0) return 'No clean dishes — collect dirty ones and wash them at the sink';
      if (r.inputs.length) {
        const input = r.inputs[0];
        const inputReady = this.stations.some((s) => s.label.ready > 0 && s.holds(input)) || this.loose.count(input) > 0;
        const inputRecipe = recipeFor(c, input);
        if (!inputReady && inputRecipe && !this.stations.some((s) => s.busy && s.holds(input)))
          return `${p.spot.label} wants ${name} — start with the ${c.stations.get(inputRecipe.station).name}`;
        return `${p.spot.label} wants ${name} — bring ${c.items.get(input).name} to the ${c.stations.get(r.station).name}`;
      }
      return `${p.spot.label} wants ${name} — use the ${c.stations.get(r.station).name}`;
    }
    const dirty = this.spots.find((s) => s.dirty > 0);
    if (dirty) return `Collect the dirty dishes from ${dirty.label}`;
    if (this.content.ingredients.all().some((i) => (this.save.pantry[i.id] ?? 0) === 0)) return 'You’re out of an ingredient — restock at the delivery crate';
    if (this.parties.some((p) => p.state !== 'leaving')) return 'Guests are settling in';
    if (this.clock.isLastCall) return 'Last call — finish up and wash the last dishes';
    if (this.clock.minute >= this.content.night.preDawnStartMinute) return 'Quiet hours. The sky is starting to change.';
    return 'Waiting for guests… cook rice or brew tea ahead of time';
  }
}
