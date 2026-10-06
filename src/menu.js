// Every full-screen menu, in the Lamplight style: the shop itself is the backdrop and the menu sits in a
// warm column on the left. Main menu, your look, settings, hosting/joining co-op, pause, and "come on in".
// Your character, settings and a few lifetime stats are remembered on this device.
import * as THREE from 'three';
import { Person, LOOK_OPTIONS, randomLook } from './npc.js';
import { ICON_SRC } from './service.js';
const STATION_NAMES = { tea: 'Tea urns', sushi: 'Sushi case', onigiri: 'Rice cookers', yakitori: 'Yakitori grills', gyoza: 'Gyoza teppan', tempura: 'Fryers', ramen: 'Ramen stove', icecream: 'Chest freezer' };

// the catalog is a little picture book: a tab for each section, two things to a page, a spread at a time
const BOOK_TABS = [
  ['milestones', 'milestones', 'not for sale: new recipes, the rest of the building and new kit come as the shop grows'],
  ['staff', 'help wanted', 'hire all five and the shop runs itself · wages are paid at sunrise'],
  ['station', 'the kitchen', 'faster stations and dearer dishes · buy these at the station itself, before you turn the sign'],
  ['home', 'for home', 'things for the flat upstairs'],
  ['games', 'fami-com', 'cartridges for the console'],
];
const BOOK_ICON = {
  beltMotor: '⚙️', beltMotor2: '⚙️', binchotan: '🔥', binchotan2: '🔥', dishes: '🍽️', dishes2: '🍽️', heaters: '♨️', heaters2: '♨️', fridge: '🧃', fridge2: '🍶',
  backdoor: '🚪', freezer: '🧊', kura: '🏯', staff_wash: '🧽', staff_waiter: '🛎️', staff_hall: '🧾', staff_sushi: '🔪', staff_cook: '🍳',
  lanterns: '🏮', plants: '🪴', bonsai: '🌲', print: '🌊', catbed: '🐈', fishtank: '🐠', record: '📻', telescope: '🔭', irori: '🫖', crt: '📺', famicom: '🎮',
  game_dash: '⛷️', game_koi: '🐟', game_daruma: '🎎',
};
const DISH_ICON = new Set(['sushi', 'onigiri', 'tempura', 'ramen']);
const MS_ICON = { freezer: 'icecream', backdoor: '🚪', kura: '🏯' };
const starRow = (r) => { const h = Math.round(r * 2) / 2; return [1, 2, 3, 4, 5].map((i) => `<i class="${h >= i ? 'on' : h >= i - 0.5 ? 'half' : ''}">★</i>`).join(''); };

const KEY = 'yoake.profile';
const HAIR_STYLES = [[0, 'short'], [1, 'swept back'], [2, 'long'], [4, 'bun'], [3, 'bald']];
const SCARVES = [['#a82a2a', 'red scarf'], ['#2a5a8a', 'blue scarf'], ['#e8e0d0', 'cream scarf'], ['#d8a030', 'gold scarf']];
const NAMES = ['Hana', 'Yuki', 'Ren', 'Sora', 'Kaito', 'Mei', 'Haru', 'Aoi', 'Kenji', 'Emi'];
const DEFAULT_SETTINGS = { radio: 0.7, wind: 0.8, look: 0.5 };

const rand = () => { let seed = Math.random() * 1e9; return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); };
export function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!p || !p.look || !p.name) p = { name: NAMES[Math.floor(Math.random() * NAMES.length)], look: { ...randomLook(rand()), hat: -1 } };
  p.settings = { ...DEFAULT_SETTINGS, ...(p.settings || {}) };
  p.stats = { shifts: 0, tips: 0, ...(p.stats || {}) };
  return p;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class Menu {
  constructor(screen, overlay, litMat, emitMat, handlers) {
    this.root = screen; this.overlay = overlay; this.litMat = litMat; this.emitMat = emitMat;
    this.h = handlers; // onSolo, onHost, onJoin(code), onStart, onCloseUp, onResume, onQuit, onSettings(settings)
    this.profile = loadProfile();
    this.screen = 'loading'; this.turn = 0;
    this.setupPreview();
    this.render();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.profile)); } catch {} }
  addShift(tips) { this.profile.stats.shifts++; this.profile.stats.tips += tips; this.save(); }

  // ---------------------------------------------------------------- you, standing in the light
  setupPreview() {
    const cv = this.previewCanvas = document.createElement('canvas');
    this.pr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    this.pr.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.ps = new THREE.Scene();
    this.ps.add(new THREE.HemisphereLight(0xfff0e0, 0x302028, 2.6));
    const key = new THREE.DirectionalLight(0xffe0c0, 2.2); key.position.set(1, 2, -2); this.ps.add(key);
    this.pc = new THREE.PerspectiveCamera(30, 0.8, 0.1, 20);
    this.rebuildPreview();
    const draw = () => {
      if (this.person && this.previewCanvas.isConnected) {
        const y = this.turn * Math.PI / 4; // the ‹ › buttons turn you in 45° steps
        this.person.group.rotation.y += (y - this.person.group.rotation.y) * 0.15;
        this.person.pose(0.016, 0, 0, 0.5, false);
        this.pr.render(this.ps, this.pc);
      }
      requestAnimationFrame(draw);
    };
    draw();
  }
  sizePreview(w, h) {
    this.pr.setSize(w, h, false);
    this.pc.aspect = w / h;
    // keep the whole character (about 1.9 m) in frame: a tall frame can come in closer than a wide one
    const half = 1.15, fitV = half / Math.tan(15 * Math.PI / 180), fitH = 0.7 / (Math.tan(15 * Math.PI / 180) * this.pc.aspect);
    this.pc.position.set(0, 1.0, -Math.max(fitV, fitH)); this.pc.lookAt(0, 0.95, 0); this.pc.updateProjectionMatrix();
  }
  rebuildPreview() {
    if (this.person) { this.ps.remove(this.person.group); this.person.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
    this.person = new Person(this.profile.look, this.litMat, this.emitMat);
    this.person.group.rotation.y = this.turn * Math.PI / 4;
    this.ps.add(this.person.group);
  }
  setLook(k, v) { this.profile.look = { ...this.profile.look, [k]: v }; this.save(); this.rebuildPreview(); this.render(); }

  // ---------------------------------------------------------------- screens
  show(screen, extra = {}) { this.screen = screen; Object.assign(this, extra); this.render(); }
  render() {
    const p = this.profile, L = p.look, s = this.screen;
    this.overlay.classList.toggle('blur', s === 'custom');
    this.overlay.classList.toggle('dim', s === 'ready');
    const items = (list) => `<div class="items">${list.map(([act, label, on, big]) => `<button class="item${on ? ' on' : ''}${big ? ' big' : ''}" data-act="${act}"><span class="dot"></span>${label}</button>`).join('')}</div>`;
    const slider = (k, label) => `<label class="slider lbl"><span>${label}</span><input type="range" min="0" max="1" step="0.01" value="${p.settings[k]}" data-set="${k}" style="--p:${p.settings[k] * 100}%"></label>`;
    const keys = this.touch
      ? `<div class="keys glass"><span><kbd>left thumb</kbd>walk</span><span><kbd>push far</kbd>hurry</span><span><kbd>right thumb</kbd>look</span><span><kbd>tap</kbd>use</span></div>`
      : `<div class="keys glass"><span><kbd>WASD</kbd>walk</span><span><kbd>shift</kbd>hurry</span><span><kbd>click</kbd>use</span><span><kbd>Q</kbd>put away</span><span><kbd>M</kbd>radio</span></div>`;
    let html = '';
    if (s === 'loading') {
      html = `<div class="col"><div><div class="neon amber title">YOAKE</div><div class="hand tagline">夜明け · open until dawn · it's snowing</div></div>
        <div class="loading">putting the kettle on…</div></div>`;
    } else if (s === 'main') {
      const st = p.stats;
      html = `<div class="col">
        <div><div class="neon amber title">YOAKE</div><div class="hand tagline">夜明け · open until dawn · it's snowing</div></div>
        ${this.notice ? `<div class="err">${esc(this.notice)}</div>` : ''}
        <div style="margin-top:auto">${items([['solo', this.saveInfo && this.saveInfo.night > 1 ? `carry on · night ${this.saveInfo.night}` : 'come in from the snow', true, true], ['host', 'open with friends'], ['join', 'join a friend'], ['parade', '百鬼夜行 · the night parade'], ['settings', 'settings']])}</div>
        <div class="tip">${this.touch ? (innerHeight > innerWidth ? 'tip · turn your phone sideways for the best view' : 'tip · push the stick all the way to hurry') : 'tip · press <kbd>M</kbd> anytime for the radio'}</div>
      </div>
      <button class="me-card glass" data-act="custom"><div class="pv"></div><div>
        <div class="nm">${esc(p.name)}</div>
        <div class="st">${st.shifts ? `${st.shifts} night${st.shifts > 1 ? 's' : ''} worked · ¥${Math.round(st.tips).toLocaleString('en-US')} in tips` : 'first night on the job'}</div>
        <div class="ch">change my look</div></div></button>`;
    } else if (s === 'settings') {
      html = `<div class="col">
        <div><div class="hand tagline">make yourself at home</div><div style="font:500 44px Fredoka">settings</div></div>
        <div class="sliders glass">${slider('radio', 'radio')}${slider('wind', 'wind & sea')}${slider('look', 'mouse look')}</div>
        <div class="row chips"><button class="chip${this.devYen ? ' on' : ''}" data-act="devYen">dev · infinite yen ${this.devYen ? 'on' : 'off'}</button></div>
        <div class="actions"><button class="pill-btn" data-act="back">done</button>
          <button class="text-btn" data-act="newGame">${this.confirmNew ? 'click again to erase your progress' : 'start a new game'}</button></div></div>`;
    } else if (s === 'custom') {
      const sw = (k, list) => list.map((c) => `<button class="sw${L[k] === c ? ' on' : ''}" style="background:${c}" data-k="${k}" data-v='${JSON.stringify(c)}' aria-label="${c}"></button>`).join('');
      const chip = (k, v, label, on = L[k] === v) => `<button class="chip${on ? ' on' : ''}" data-k="${k}" data-v='${JSON.stringify(v)}'>${label}</button>`;
      html = `<div class="stage"><div class="glowpool"></div><div class="pv"></div>
        <div class="name-row"><button class="round" data-act="turnL" aria-label="turn left">‹</button>
        <input class="name-in" id="m-name" maxlength="16" value="${esc(p.name)}" aria-label="your name">
        <button class="round" data-act="turnR" aria-label="turn right">›</button></div></div>
        <div class="look glass">
          <div class="head"><div>your look</div><button data-act="surprise">surprise me ↻</button></div>
          <div class="scroll"><section><div class="lbl">skin</div><div class="row">${sw('skin', LOOK_OPTIONS.SKIN)}</div></section>
          <section><div class="lbl">hair</div><div class="row">${sw('hair', LOOK_OPTIONS.HAIR)}</div>
            <div class="row chips">${HAIR_STYLES.map(([v, n]) => chip('hairStyle', v, n)).join('')}</div></section>
          <section><div class="lbl">coat</div><div class="row">${sw('coat', LOOK_OPTIONS.COAT)}</div>
            <div class="row chips">${chip('long', false, 'short coat')}${chip('long', true, 'long coat')}</div></section>
          <section><div class="lbl">pants</div><div class="row">${sw('pants', LOOK_OPTIONS.PANTS)}</div></section>
          <section><div class="lbl">extras</div><div class="row chips">
            ${chip('hat', L.hat === 0 ? -1 : 0, 'beanie', L.hat === 0)}${chip('hat', L.hat === 1 ? -1 : 1, 'flat cap', L.hat === 1)}
            ${SCARVES.map(([c, n]) => chip('scarf', L.scarf === c ? null : c, n, L.scarf === c)).join('')}
            ${chip('glasses', !L.glasses, 'glasses', !!L.glasses)}</div></section></div>
          <button class="pill-btn" data-act="back">all set</button>
        </div>`;
    } else if (s === 'join') {
      html = `<div class="col"><div class="hand tagline">join a friend</div>
        <div style="display:flex;flex-direction:column;gap:10px"><div class="lbl">their code</div>
        <input class="code-in" id="m-code" maxlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD" value="${esc(this.code || '')}"></div>
        ${this.error ? `<div class="err">${esc(this.error)}</div>` : ''}
        <div class="actions"><button class="pill-btn" data-act="joinGo" ${this.busy ? 'disabled' : ''}>${this.busy ? 'knocking…' : 'join'}</button>
        <button class="text-btn" data-act="back">back</button></div></div>`;
    } else if (s === 'connecting') {
      html = `<div class="col"><div class="hand tagline">friends are on their way</div><div class="wait">unlocking the front door…</div></div>`;
    } else if (s === 'lobby') {
      const players = [...(this.players || [])].sort((a, b) => b.host - a.host);
      const rows = players.map((q) => `<div class="person glass"><div class="av" style="background:${q.look ? q.look.coat : '#888'}"></div>
        <div class="nm">${esc(q.name)}</div><div class="note hand${q.host ? ' host' : ''}">${q.host ? 'opened up' : 'just walked in'}</div></div>`).join('');
      const empty = players.length < 4 ? `<div class="person empty"><div class="av"></div><div class="wait">waiting at the door…</div></div>` : '';
      html = `<div class="col"><div class="hand tagline">${this.isHost ? 'friends are on their way' : 'you made it in'}</div>
        <div style="display:flex;flex-direction:column;gap:10px"><div class="lbl">${this.isHost ? 'your code' : 'game code'}</div>
          <div class="neon amber code">${esc(this.code)}</div>
          ${this.isHost ? `<div style="display:flex;gap:10px"><button class="chip" data-act="copyCode">${this.copied === 'code' ? 'copied!' : 'copy code'}</button><button class="chip" data-act="copyLink">${this.copied === 'link' ? 'copied!' : 'copy link'}</button></div>` : ''}</div>
        <div style="display:flex;flex-direction:column;gap:12px"><div class="lbl">working tonight · ${players.length} of 4</div><div class="people">${rows}${empty}</div></div>
        <div class="actions">${this.isHost ? '<button class="pill-btn" data-act="start">open the shop</button>' : '<button class="pill-btn" disabled>waiting for the host…</button>'}
          <button class="text-btn" data-act="closeUp">${this.isHost ? 'close up' : 'head home'}</button></div></div>`;
    } else if (s === 'pause') {
      const sub = this.pausePanel;
      html = `<div class="col">
        <div><div class="hand tagline">${esc(this.clock || '')} · ${this.coop ? 'the shop keeps going' : 'the snow will wait'}</div>
        <div style="font:500 44px Fredoka">${this.coop ? 'on a break' : 'paused'}</div></div>
        ${items([['resume', 'step back in', !sub], ['sound', 'sound', sub === 'sound'], ['settings', 'settings', sub === 'settings'], ['quit', this.coop && this.isHost ? 'close the shop' : 'head home']])}
        ${sub === 'sound' ? `<div class="sliders glass">${slider('radio', 'radio')}${slider('wind', 'wind & sea')}</div>` : ''}
        ${sub === 'settings' ? `<div class="sliders glass">${slider('look', 'mouse look')}</div>
          <div class="row chips"><button class="chip${this.devYen ? ' on' : ''}" data-act="devYen">dev · infinite yen ${this.devYen ? 'on' : 'off'}</button></div>` : ''}
      </div>${keys}`;
    } else if (s === 'catalog') {
      const c = this.catalog || { yen: 0, items: [] };
      const tab = this.bookTab || 'milestones', T = BOOK_TABS.find((t) => t[0] === tab) || BOOK_TABS[0];
      const list = tab === 'milestones' ? (c.milestones || []) : c.items.filter((i) => i.kind === tab);
      const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 1080px)').matches, per = wide ? 2 : 1;
      const pages = Math.max(1, Math.ceil(list.length / 2)), views = Math.ceil(pages / per);
      const view = this.bookPage = Math.max(0, Math.min(views - 1, this.bookPage || 0));
      const yen = (v) => `¥${v.toLocaleString('en-US')}`;
      const icon = (it) => {
        const k = it.kind === 'station' ? it.station : it.id;
        return k && (it.kind === 'station' || DISH_ICON.has(k)) ? `<img src="${ICON_SRC(k)}" alt="">` : `<span>${BOOK_ICON[it.id] || '✦'}</span>`;
      };
      // a milestone: what it is, what it takes (and how far along), what to do once it's reached
      const msCard = (m) => {
        const ic = MS_ICON[m.id] || m.id, img = ic === 'icecream' || DISH_ICON.has(ic) ? `<img src="${ICON_SRC(ic)}" alt="">` : `<span>${BOOK_ICON[m.id] || MS_ICON[m.id] || '✦'}</span>`;
        const foot = m.state === 'done' ? '' : m.state === 'pending'
          ? (m.how === 'recipe' ? `<button class="buyb" data-act="learn:${m.id}">learn it</button>` : `<span class="price todo">${m.game === 'shovel' ? 'go and dig it out' : 'go and pick the lock'}</span>`)
          : `<div class="msbar"><i style="width:${Math.round(m.progress * 100)}%"></i></div><span class="price">${esc(m.goal)}${m.needsName ? ` · after ${esc(m.needsName.toLowerCase())}` : ''}</span>`;
        return `<div class="item${m.state === 'done' ? ' owned' : ''}${m.state === 'locked' ? ' later' : ''}"><div class="ic">${img}</div>
          <div class="txt"><b>${m.how === 'recipe' ? 'recipe · ' : m.how === 'task' ? '' : 'kit · '}${esc(m.name)}</b><p>${esc(m.text)}</p><div class="foot">${foot}</div></div>${m.state === 'done' ? '<div class="hanko">yours</div>' : ''}</div>`;
      };
      const card = (it) => {
        if (tab === 'milestones') return msCard(it);
        const station = it.kind === 'station';
        const name = station ? `${STATION_NAMES[it.station]}: ${it.name.toLowerCase()}` : it.name;
        const text = station ? `${it.track === 's' ? 'Speed' : 'Value'}, level ${it.level} of ${it.levels}: ${it.short}.` : it.text;
        const btn = it.owned ? '' : station ? `<span class="price">${yen(it.price)} · at the station</span>`
          : it.blocked ? `<span class="price">needs ${esc(it.needsName.toLowerCase())}</span>`
          : `<button class="buyb" data-act="buy:${it.id}" ${it.price > c.yen ? 'disabled' : ''}>${yen(it.price)}${it.wage ? `<small> + ${yen(it.wage)}/night</small>` : ''}</button>`;
        return `<div class="item${it.owned ? ' owned' : ''}${it.blocked ? ' later' : ''}"><div class="ic">${icon(it)}</div>
          <div class="txt"><b>${esc(name)}</b><p>${esc(text)}</p><div class="foot">${btn}</div></div>${it.owned ? '<div class="hanko">yours</div>' : ''}</div>`;
      };
      const page = (i) => {
        const its = list.slice(i * 2, i * 2 + 2);
        return `<div class="page${i % 2 ? ' right' : ' left'}">${i < pages ? `${its.map(card).join('')}<div class="pno hand">${i + 1}</div>` : '<div class="blank hand">notes</div>'}</div>`;
      };
      const g = c.goal;
      html = `<div class="col"><div><div class="hand tagline">mail order · delivered by morning</div><div style="font:500 44px Fredoka">the catalog</div></div>
        <div class="purse-big">${yen(Math.round(c.yen))}<span>in the cash box</span></div>
        ${g ? `<div class="goalbox glass"><div class="lbl">${g.done ? 'goal reached' : 'the goal'}</div><div class="hand">a five-star shop that runs itself</div>
          <div class="gstars">${starRow(g.rating)}<b>${g.rating.toFixed(1)}</b></div><div class="ghired">${'<i class="on"></i>'.repeat(g.hired)}${'<i></i>'.repeat(g.of - g.hired)}<span>${g.hired} of ${g.of} hired</span></div></div>` : ''}
        ${c.note ? `<div class="err">${esc(c.note)}</div>` : ''}
        ${items([['resume', 'put it down', true]])}</div>
        <div class="look catalog book-wrap"><div class="tabs">${BOOK_TABS.map(([k, label]) => `<button class="tab tab-${k}${k === tab ? ' on' : ''}" data-act="tab:${k}">${label}</button>`).join('')}</div>
          <div class="book${per === 2 ? ' spread' : ''}${this.bookTurn ? ` turn-${this.bookTurn}` : ''}">
            <div class="blurb hand">${esc(T[2])}</div>
            <div class="pages">${Array.from({ length: per }, (_, k) => page(view * per + k)).join('')}</div>
            <div class="nav"><button class="turn" data-act="page:-1" ${view <= 0 ? 'disabled' : ''}>‹ back</button><span class="hand">${view + 1} of ${views}</span><button class="turn" data-act="page:1" ${view >= views - 1 ? 'disabled' : ''}>next ›</button></div>
          </div></div>`;
      this.bookTurn = null;
    } else if (s === 'ready') {
      html = `<div class="col"><div><div class="hand tagline">${esc(this.readyNote || 'the shop is open')}</div><div style="font:500 44px Fredoka">${esc(this.readyTitle || 'clock in')}</div></div>
        ${items([['enter', this.readyItem || 'come on in', true, true]])}</div>${keys}`;
    }
    this.root.innerHTML = html;
    this.wire();
  }
  wire() {
    const r = this.root, p = this.profile;
    const pv = r.querySelector('.pv');
    if (pv) { pv.appendChild(this.previewCanvas); if (this.screen === 'custom') this.sizePreview(260, 480); else this.sizePreview(84, 104); }
    const name = r.querySelector('#m-name');
    if (name) name.oninput = () => { p.name = name.value.trim().slice(0, 16) || 'guest'; this.save(); };
    const code = r.querySelector('#m-code');
    if (code) {
      code.focus();
      code.oninput = () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); this.code = code.value; };
      code.onkeydown = (e) => { if (e.key === 'Enter') this.act('joinGo'); };
    }
    r.querySelectorAll('[data-act]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); this.act(b.dataset.act); }; });
    r.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => this.setLook(b.dataset.k, JSON.parse(b.dataset.v)); });
    r.querySelectorAll('[data-set]').forEach((inp) => {
      inp.oninput = () => {
        p.settings[inp.dataset.set] = +inp.value; inp.style.setProperty('--p', `${inp.value * 100}%`);
        this.save(); if (this.h.onSettings) this.h.onSettings(p.settings);
      };
    });
  }
  act(a) {
    const go = (screen, extra = {}) => this.show(screen, { error: null, notice: null, ...extra });
    if (a === 'solo') this.h.onSolo();
    else if (a === 'parade') this.h.onParade();
    else if (a === 'host') this.h.onHost();
    else if (a === 'join') go('join', { busy: false });
    else if (a === 'sound') this.show('pause', { pausePanel: this.pausePanel === 'sound' ? null : 'sound' });
    else if (a === 'settings' && this.screen === 'pause') this.show('pause', { pausePanel: this.pausePanel === 'settings' ? null : 'settings' });
    else if (a === 'settings') go('settings');
    else if (a === 'custom') go('custom');
    else if (a === 'back') go('main', { confirmNew: false });
    else if (a === 'turnL') this.turn--;
    else if (a === 'turnR') this.turn++;
    else if (a === 'surprise') { this.profile.look = { ...randomLook(rand()), hat: Math.random() < 0.3 ? Math.floor(Math.random() * 2) : -1 }; this.save(); this.rebuildPreview(); this.render(); }
    else if (a === 'joinGo') {
      if (this.busy) return;
      if (!/^[A-Z0-9]{4}$/.test(this.code || '')) return this.show('join', { error: 'codes are 4 letters' });
      this.h.onJoin(this.code);
    } else if (a === 'start') this.h.onStart();
    else if (a === 'closeUp') this.h.onCloseUp();
    else if (a === 'copyCode' || a === 'copyLink') {
      const text = a === 'copyCode' ? this.code : `${location.origin}${location.pathname}?join=${this.code}`;
      navigator.clipboard?.writeText(text).catch(() => {});
      this.show('lobby', { copied: a === 'copyCode' ? 'code' : 'link' });
      clearTimeout(this._copyT); this._copyT = setTimeout(() => { if (this.screen === 'lobby') this.show('lobby', { copied: null }); }, 1600);
    } else if (a === 'resume' || a === 'enter') this.h.onResume();
    else if (a === 'quit') this.h.onQuit();
    else if (a === 'devYen') this.h.onDevYen();
    else if (a.startsWith('buy:')) this.h.onBuy(a.slice(4));
    else if (a.startsWith('learn:')) this.h.onLearn && this.h.onLearn(a.slice(6));
    else if (a.startsWith('tab:')) { this.bookTab = a.slice(4); this.bookPage = 0; this.bookTurn = 'next'; this.render(); }
    else if (a.startsWith('page:')) { const d = +a.slice(5); this.bookPage = (this.bookPage || 0) + d; this.bookTurn = d > 0 ? 'next' : 'prev'; this.render(); }
    else if (a === 'newGame') { if (this.confirmNew) this.h.onNewGame(); else this.show('settings', { confirmNew: true }); }
  }
}
